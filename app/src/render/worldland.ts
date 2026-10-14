// The land of the continuous world: the whole region's heightfield as one static mesh in the absolute world frame W
// (feet, x east, z south; see core/frames.ts), with every placed map's footprint baked in whether or not its map is
// loaded, so nothing changes shape when a map streams in.
//
//  - LandField: the surface as a function. The heightfield (RELIEF-steepened) flattened to each map's base near its
//    footprint (frames.flattenWeight: 120–900 ft, a crag 320–1400 ft; overlapping bands are normalised), lakes cut
//    to their level, and the layering backdrop.ts uses: flush with the map (−0.4 ft) within 150 ft of its edge, 3 ft
//    under the ground beyond.
//  - The land lattice (the world lattice subdivided ×2, plus a coarse skirt fading into the mist) carries the region;
//    round every footprint it is cut away and a fine apron (backdrop's rings, laid as rounded-rectangle offsets of
//    the footprint out to APRON_REACH) carries the ground instead, its rim diving under the lattice.
//  - Roads, rivers, lakes, Bluto's boat and the crag pedestals are drawn once for the whole region.
// Lit by the scene's lights and fogged by the scene's fog (not baked haze), so it reads right from any side.
import * as THREE from 'three';
import type { Theme, WorldData } from '../campaigns';
import { terrainOf, type Terrain } from '../core/terrain';
import { MI_FT, RELIEF, CRAG_IN, CRAG_OUT, FLATTEN_IN, FLATTEN_OUT, mapDist, smooth, type Bounds } from '../core/frames';
import type { Vec2 } from '../core/geometry';
import { FLOOR_COLOR } from '../kit/palette';
import { merge } from '../kit/pieces';
import { matClone, patchFog, setSurface } from './materials';
import type { GroundCut } from '../core/siteInterfaces';
import { mistTexture } from './backdrop';

/** A placed root map as the land sees it: its footprint and base in W, and what its edges are made of. */
export interface LandSite {
  path: string; key: string;
  /** The map's footprint in W (axis-aligned: every map is turned by a multiple of 90°). */
  bounds: Bounds;
  /** Its open-air floor's height in W: the land there is flattened to this. */
  base: number;
  /** A site on its own crag (Ravenloft): the land falls away later and farther. */
  crag: boolean;
  /** How far the land round it is felled (no trees). */
  clearingFt: number;
  /** The ground the land beside it blends into ('grass', 'snow'). */
  ground: string;
  cuts?: GroundCut[];
  shoreLake?: string;
  exactExits?: boolean;
  /** Where each world road leaving the map starts (W), by road name. */
  exits: { road: string; x: number; z: number }[];
}

/** The fine apron reaches this far past a footprint's edge; the lattice is cut away inside. */
export const APRON_REACH = 3000;
/** Offsets of the apron's rings past the footprint edge: fine through the flatten band, coarser beyond. */
const RINGS = [0, 20, 50, 90, 135, 185, 245, 315, 400, 500, 620, 760, 920, 1100, 1300, 1530, 1790, 2080, 2400, 2700, 2850, APRON_REACH];
/** The lattice is dropped where a whole triangle lies this deep inside an apron. */
const HOLE = APRON_REACH - 500;
/** Lattice step: the world lattice (cellMiles) subdivided ×2. */
const SUB = 2;
/** The skirt round the region: this many miles, in this many coarse steps. */
const SKIRT_MI = 3, SKIRT_STEPS = 6;
/** The skirt's outer rim sinks to this height (ft), under the lowest of the valley. */
const SKIRT_FLOOR = -1200;
/** A lake's shore rises from the water to the surveyed land between its ellipse and this many times its radii. */
export const SHORE = 1.3;
/** Land lower than a lake's level (the level a lakeshore map sets) climbs to the shore from this far out instead. */
const SHORE_UP = 1.8;
/** The relief shading's light: from the north-west, 40° up (a unit vector in W: x east, y up, z south). */
const HILL_LIGHT = (() => { const el = THREE.MathUtils.degToRad(40), h = Math.cos(el) / Math.SQRT2; return [-h, Math.sin(el), -h] as const; })();
/** Where the high ground turns white (ft). */
const SNOW_LINE = 4200;

/** The surface of the region, sampled anywhere in W. Pure apart from the heightfield lookups; no meshes. */
export class LandField {
  readonly terrain: Terrain;
  readonly hasHeight: boolean;
  readonly cx: number; readonly cy: number;
  private lakeLevels: number[] = [];
  constructor(readonly world: WorldData, readonly sites: LandSite[]) {
    this.terrain = terrainOf(world); this.hasHeight = this.terrain.hasHeight;
    this.cx = (world.bounds.minX + world.bounds.maxX) / 2; this.cy = (world.bounds.minY + world.bounds.maxY) / 2;
    this.lakeLevels = world.lakes.map((l) => this.levelOf(l));
  }
  /** W feet → world-map miles. */
  miles(x: number, z: number): Vec2 { return [this.cx + x / MI_FT, this.cy + z / MI_FT]; }
  /** W of a world-map point. */
  feet([mx, my]: Vec2): Vec2 { return [(mx - this.cx) * MI_FT, (my - this.cy) * MI_FT]; }
  /** The surveyed ground in W (the heightfield, RELIEF-steepened), before any map flattens it. */
  ground(x: number, z: number): number { if (!this.hasHeight) return 0; const [mx, my] = this.miles(x, z); return this.terrain.heightAt(mx, my) * RELIEF; }
  /** The land with every footprint's flattening applied (weights normalised where bands overlap). */
  height(x: number, z: number): number {
    const g = this.ground(x, z);
    let sw = 0, sb = 0;
    for (const s of this.sites) {
      const d = mapDist(s.bounds, x, z), o = s.crag ? CRAG_OUT : FLATTEN_OUT;
      if (d >= o) continue;
      const w = 1 - smooth(s.crag ? CRAG_IN : FLATTEN_IN, o, d);
      sw += w; sb += w * s.base;
    }
    if (sw <= 0) return g;
    return sw > 1 ? sb / sw : sb + (1 - sw) * g;
  }
  /** Distance past the nearest footprint's edge, which one, and the next nearest's. */
  nearest(x: number, z: number): { i: number; d: number; other: number } {
    let i = -1, d = Infinity, other = Infinity;
    for (let k = 0; k < this.sites.length; k++) { const dk = mapDist(this.sites[k].bounds, x, z); if (dk < d) { other = d; d = dk; i = k; } else if (dk < other) other = dk; }
    return { i, d, other };
  }
  /** Which lake (index) a W point lies in, or −1. */
  lakeAt(x: number, z: number): number { return this.lakeNear(x, z, 1).i; }
  /** The lake whose ellipse, grown by a factor, holds a W point, and how far out in it the point lies (0 centre, 1 shore). */
  lakeNear(x: number, z: number, grow = SHORE): { i: number; rho: number } {
    const [mx, my] = this.miles(x, z);
    let i = -1, rho = Infinity;
    this.world.lakes.forEach((l, k) => { const r = Math.sqrt(((mx - l.center[0]) / l.r[0]) ** 2 + ((my - l.center[1]) / l.r[1]) ** 2); if (r < grow && r < rho) { rho = r; i = k; } });
    return { i, rho };
  }
  lakeLevel(i: number): number { return this.lakeLevels[i]; }
  /** Ground openings affect every overlapping mesh, not just their owner's apron. */
  cut(x: number, z: number, y: number): number {
    for (const s of this.sites) for (const c of s.cuts ?? []) {
      const b = c.bounds, dx = Math.min(x - b.minX, b.maxX - x), dz = Math.min(z - b.minZ, b.maxZ - z);
      if (dx < 0 || dz < 0) continue;
      const w = (c.featherX ? smooth(0, c.featherX, dx) : 1) * (c.featherZ ? smooth(0, c.featherZ, dz) : 1);
      y = Math.min(y, y + (c.floor - y) * w);
    }
    return y;
  }
  /** A lake's surface: just under its lowest shore, or at a map's own ground if the map stands on the shore (the
   *  town on its shore, Lake Zarovich's own map). A map only sets the level when it stands down at the water, no
   *  higher than the middle of the shore's heights: a map up the slope above a lake (a pass, a ridge) would hold the
   *  water up in the air, a disc standing on walls over the land round it. */
  private levelOf(l: WorldData['lakes'][number]): number {
    const shoreSite = this.sites.find(s => s.shoreLake === l.name);
    if (shoreSite) return shoreSite.base + 0.05;
    const shore = (k: number, n: number, f = 1): Vec2 => { const a = (k / n) * Math.PI * 2; return this.feet([l.center[0] + Math.cos(a) * l.r[0] * f, l.center[1] + Math.sin(a) * l.r[1] * f]); };
    const hs: number[] = []; for (let k = 0; k < 32; k++) hs.push(this.height(...shore(k, 32)));
    hs.sort((a, b) => a - b);
    const lo = Math.min(hs[0], this.height(...this.feet(l.center))) - 4, mid = hs[hs.length >> 1];
    for (let k = 0; k < 64; k++) { const [x, z] = shore(k, 64); const n = this.nearest(x, z); if (n.i >= 0 && n.d < 700 && this.sites[n.i].base - 2.5 <= mid) return this.sites[n.i].base - 2.5; }
    return lo;
  }
  /** Cut a vertex down to a lake's bed; round the lake a shore rises from just above the water to the surveyed land
   *  (the heightfield and the drawn ellipse disagree: no water hangs over lower land, no wall stands out of it).
   *  Never inside a footprint's flush zone: a map carries its own water. */
  private lake(x: number, z: number, y: number, flush: boolean): number {
    if (!this.world.lakes.length) return y;
    const { i, rho } = this.lakeNear(x, z, SHORE_UP); if (i < 0) return y;
    const owner = this.sites.find(s => s.shoreLake === this.world.lakes[i].name);
    if (flush && !owner) return y;
    const level = this.lakeLevels[i];
    if (rho < 1 || (owner && rho <= 1.000001)) return Math.min(y, level - 6);
    // A detailed shore already owns the dry floor. A raised regional bank must
    // never cover it, including its tactical grid and approach.
    if (owner && flush) return Math.min(y, owner.base - 0.4);
    // land above the water slopes down to it within SHORE; land below it (a map set the level) rises to the shore
    // over the wider SHORE_UP, a long bank rather than a dike
    const k = smooth(1, y < level ? SHORE_UP : SHORE, rho); return level + 1.5 + (y - level - 1.5) * k;
  }
  /** An apron vertex of site i at mapDist d: flush with the map near it, 3 ft under the land beyond, sinking under a
   *  neighbour's apron where that map is nearer, and diving under the lattice at the rim. */
  apronY(i: number, x: number, z: number, d = mapDist(this.sites[i].bounds, x, z)): number {
    let other = Infinity; for (let k = 0; k < this.sites.length; k++) if (k !== i) other = Math.min(other, mapDist(this.sites[k].bounds, x, z));
    let y = this.height(x, z) - (d < 150 ? 0.4 : 3);
    y -= 6 * smooth(0, 200, d - other);
    y -= 35 * smooth(APRON_REACH - 250, APRON_REACH, d);
    return this.cut(x, z, this.lake(x, z, y, d < FLATTEN_IN));
  }
  /** A lattice vertex: 3 ft under the land, and well under any apron that covers it. */
  latticeY(x: number, z: number, md = this.nearest(x, z).d): number {
    const y = this.height(x, z) - 3 - 25 * (1 - smooth(HOLE - 50, APRON_REACH - 150, md));
    return this.cut(x, z, this.lake(x, z, y, false));
  }
  /** The drawn ground's top in W at (x, z): the apron over its footprint's surroundings, else the lattice. Lakes are
   *  their beds here (the water is a separate surface). */
  surface(x: number, z: number): number {
    let best = -Infinity;
    for (let i = 0; i < this.sites.length; i++) { const d = mapDist(this.sites[i].bounds, x, z); if (d <= APRON_REACH) best = Math.max(best, this.apronY(i, x, z, d)); }
    const n = this.nearest(x, z);
    if (n.d > HOLE - 340) best = Math.max(best, this.latticeY(x, z, n.d));
    return best;
  }
}

/** Colours of the land: the region's cover (forest, hills, rock, water), the crags' rock, snow on the heights, and each
 *  map's own ground for the first few hundred feet past its edge (backdrop.ts's colAt, with real fog for its haze). */
function colourer(field: LandField, theme: Theme): (x: number, z: number, y: number, n: { i: number; d: number }) => THREE.Color {
  const t = field.terrain, W = field.world;
  const rock = new THREE.Color('#6a6d74'), hillC = new THREE.Color('#66705f'), forestC = new THREE.Color(theme.forest[0]), waterC = new THREE.Color('#5e7d94'), snowC = new THREE.Color('#aab0ba');
  const apronC = new THREE.Color(theme.forest[1]).lerp(new THREE.Color(theme.apron), 0.35), mist = new THREE.Color(theme.mist);
  const grounds = new Map<string, THREE.Color>();
  const groundC = (g: string) => { let c = grounds.get(g); if (!c) { c = new THREE.Color(FLOOR_COLOR[g as keyof typeof FLOOR_COLOR] ?? FLOOR_COLOR.grass); grounds.set(g, c); } return c; };
  const crags = W.pins.filter((p) => p.heightFt).map((p) => field.feet(p.pos));
  const b = W.bounds, c = new THREE.Color();
  return (x, z, y, n) => {
    const [mx, my] = field.miles(x, z);
    c.copy(apronC);
    if (t.hasCover) {
      c.lerp(forestC, Math.min(1, t.cover('f', mx, my) * 1.2)); c.lerp(hillC, t.cover('h', mx, my));
      c.lerp(rock, Math.min(1, t.cover('m', mx, my) * 1.1 + t.cover('x', mx, my) * 0.8));
      // the cover's water lies flat: on a slope (a lake's ellipse and the heightfield disagree there) it is a bank,
      // not blue streaks running down it
      const wc = t.cover('w', mx, my);
      if (wc > 0) { const e = 200, gx = (field.ground(x + e, z) - field.ground(x - e, z)) / (2 * e), gz = (field.ground(x, z + e) - field.ground(x, z - e)) / (2 * e); c.lerp(waterC, Math.min(1, wc * 1.5) * (1 - smooth(0.06, 0.2, Math.hypot(gx, gz)))); }
    }
    for (const [qx, qz] of crags) { const dd = Math.hypot(x - qx, z - qz) / MI_FT; if (dd < 0.3) c.lerp(rock, 1 - dd / 0.3); }
    if (n.i >= 0) { const st = field.sites[n.i]; c.lerp(st.crag ? rock : groundC(st.ground), st.crag ? 1 - smooth(320, 1600, n.d) : 1 - smooth(120, 1400, n.d)); }
    // a lakeshore map's water part (the land is not cut there: the map carries its own water) reads as water
    if (n.i >= 0 && n.d < FLATTEN_IN && field.lakeAt(x, z) >= 0) c.copy(waterC);
    // snow lies on the heights, but not on their steep faces: there the rock shows, so a peak reads by its ridges. Its
    // albedo is kept under what the valley's light saturates (hemisphere and sun together lift it about 2.3 times), so
    // the lit and the shaded faces of a peak stay apart instead of both clipping to white
    if (y > SNOW_LINE) {
      const e = 260, gx = (field.ground(x + e, z) - field.ground(x - e, z)) / (2 * e), gz = (field.ground(x, z + e) - field.ground(x, z - e)) / (2 * e);
      c.lerp(rock, 0.35);
      c.lerp(snowC, Math.min(1, (y - SNOW_LINE) / 1200) * (1 - 0.9 * smooth(0.16, 0.45, Math.hypot(gx, gz))));
    }
    // relief shading, as a drawn map shades its hills: lit from the north-west, slopes facing the light a little
    // brighter and the far sides darker (flat ground unchanged), so a ridge and its valleys read from the whole-valley
    // distance, where the lights alone leave a mountain one smooth mound. Not next to a map: its edge keeps its colours.
    const near = n.i >= 0 ? 1 - smooth(120, 1400, n.d) : 0;
    if (near < 1) {
      const e = 260, gx = (field.ground(x + e, z) - field.ground(x - e, z)) / (2 * e), gz = (field.ground(x, z + e) - field.ground(x, z - e)) / (2 * e);
      const nl = (gx * HILL_LIGHT[0] - HILL_LIGHT[1] * 1 + gz * HILL_LIGHT[2]) / -Math.hypot(gx, 1, gz); // normal (−gx, 1, −gz) · light
      c.multiplyScalar(1 + (THREE.MathUtils.clamp(1 + 1.6 * (nl - HILL_LIGHT[1]), 0.45, 1.3) - 1) * (1 - near));
    }
    // past the region's edge the land fades into the mist (the skirt)
    const out = Math.max(0, b.minX - mx, mx - b.maxX, b.minY - my, my - b.maxY);
    if (out > 0) c.lerp(mist, smooth(0, SKIRT_MI * 0.8, out));
    return c;
  };
}

const landMaterial = (vertexColors = true): THREE.MeshLambertMaterial => {
  const m = matClone('#ffffff', true); m.vertexColors = vertexColors;
  setSurface(m, 'grass'); return m;
};

/** The lattice: the region at twice the world lattice's resolution, a coarse skirt round it, and holes where aprons lie. */
function buildLattice(field: LandField, colour: ReturnType<typeof colourer>): THREE.Mesh {
  const W = field.world, step = (W.cellMiles ?? 0.125) / SUB;
  const axis = (lo: number, hi: number) => {
    const out: number[] = []; for (let k = 1; k <= SKIRT_STEPS; k++) out.unshift(lo - (k * SKIRT_MI) / SKIRT_STEPS);
    const n = Math.max(1, Math.round((hi - lo) / step)); for (let k = 0; k <= n; k++) out.push(lo + ((hi - lo) * k) / n);
    for (let k = 1; k <= SKIRT_STEPS; k++) out.push(hi + (k * SKIRT_MI) / SKIRT_STEPS);
    return out;
  };
  const xs = axis(W.bounds.minX, W.bounds.maxX), ys = axis(W.bounds.minY, W.bounds.maxY), nx = xs.length, ny = ys.length;
  const P = new Float32Array(nx * ny * 3), C = new Float32Array(nx * ny * 3), hole = new Uint8Array(nx * ny);
  for (let r = 0; r < ny; r++) for (let k = 0; k < nx; k++) {
    const [x, z] = field.feet([xs[k], ys[r]]), n = field.nearest(x, z), v = r * nx + k;
    // past the region's edge the heightfield only repeats its edge (stripes of snow on a flat shelf): the skirt falls
    // away instead, down into the mist, so the valley stands like an island in it, ringed by its own mountains
    const out = Math.max(0, W.bounds.minX - xs[k], xs[k] - W.bounds.maxX, W.bounds.minY - ys[r], ys[r] - W.bounds.maxY), fall = smooth(0, SKIRT_MI, out);
    const y0 = field.latticeY(x, z, n.d), y = y0 + (SKIRT_FLOOR - y0) * fall;
    P[v * 3] = x; P[v * 3 + 1] = y; P[v * 3 + 2] = z;
    const h = field.height(x, z), c = colour(x, z, h + (SKIRT_FLOOR - h) * fall, n); C[v * 3] = c.r; C[v * 3 + 1] = c.g; C[v * 3 + 2] = c.b;
    hole[v] = n.d < HOLE ? 1 : 0;
  }
  const idx: number[] = [];
  for (let r = 0; r + 1 < ny; r++) for (let k = 0; k + 1 < nx; k++) {
    const a = r * nx + k, b = a + 1, c = a + nx, d = c + 1;
    if (!(hole[a] && hole[d] && hole[c])) idx.push(a, c, d);
    if (!(hole[a] && hole[b] && hole[d])) idx.push(a, d, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  g.setIndex(new THREE.BufferAttribute(nx * ny > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), 1));
  g.computeVertexNormals(); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, landMaterial()); m.name = 'land'; return m;
}

/** A footprint's outline as samples (a point on the box's edge and an outward offset direction): each side with the
 *  side's normal, each corner swept between the two normals along the square (n1 + t·n2, then t·n1 + n2). Offset by
 *  d, the samples trace the box grown by d, and each sample's distance past the footprint (frames.mapDist, the
 *  largest axis distance) is exactly d, so the apron covers just what the lattice leaves out. */
function outline(b: Bounds, corner = 4): { p: Vec2; n: Vec2 }[] {
  const out: { p: Vec2; n: Vec2 }[] = [];
  const side = (a: Vec2, e: Vec2, n: Vec2) => { const L = Math.hypot(e[0] - a[0], e[1] - a[1]), k = Math.max(1, Math.min(60, Math.ceil(L / 120))); for (let i = 0; i <= k; i++) out.push({ p: [a[0] + ((e[0] - a[0]) * i) / k, a[1] + ((e[1] - a[1]) * i) / k], n }); };
  const square = (p: Vec2, n1: Vec2, n2: Vec2) => {
    for (let j = 1; j <= corner; j++) { const t = j / corner; out.push({ p, n: [n1[0] + t * n2[0], n1[1] + t * n2[1]] }); }
    for (let j = corner - 1; j >= 1; j--) { const t = j / corner; out.push({ p, n: [t * n1[0] + n2[0], t * n1[1] + n2[1]] }); }
  };
  side([b.maxX, b.minZ], [b.maxX, b.maxZ], [1, 0]); square([b.maxX, b.maxZ], [1, 0], [0, 1]);
  side([b.maxX, b.maxZ], [b.minX, b.maxZ], [0, 1]); square([b.minX, b.maxZ], [0, 1], [-1, 0]);
  side([b.minX, b.maxZ], [b.minX, b.minZ], [-1, 0]); square([b.minX, b.minZ], [-1, 0], [0, -1]);
  side([b.minX, b.minZ], [b.maxX, b.minZ], [0, -1]); square([b.maxX, b.minZ], [0, -1], [1, 0]);
  return out;
}

/** Every footprint's apron in one mesh: a flat fan under the map, then rings out to APRON_REACH. */
function buildAprons(field: LandField, colour: ReturnType<typeof colourer>): THREE.Mesh {
  const P: number[] = [], C: number[] = [], idx: number[] = [];
  field.sites.forEach((s, i) => {
    if (s.shoreLake) {
      // Follow the water's polygon explicitly. A rectangular sample grid bridges
      // across the shore discontinuity, producing submerged banks and dry spikes.
      const lake=field.world.lakes.find(l=>l.name===s.shoreLake)!;
      const [cx,cz]=field.feet(lake.center), rx=lake.r[0]*MI_FT, rz=lake.r[1]*MI_FT;
      const b=s.bounds, x0=b.minX-APRON_REACH, x1=b.maxX+APRON_REACH, z0=b.minZ-APRON_REACH, z1=b.maxZ+APRON_REACH;
      const angles=new Set(Array.from({length:128},(_,k)=>k/128*Math.PI*2));
      for(const x of [x0,x1])for(const z of [z0,z1])angles.add((Math.atan2((z-cz)/rz,(x-cx)/rx)+Math.PI*2)%(Math.PI*2));
      const aa=[...angles].sort((a,b)=>a-b), n=aa.length, first=P.length/3;
      const add=(x:number,z:number)=>{const d=mapDist(b,x,z),y=field.apronY(i,x,z,d),c=colour(x,z,y,{i,d});P.push(x,y,z);C.push(c.r,c.g,c.b);};
      add(cx,cz);
      const rings=[.5,.9,.99,1,1.00001,1.02,1.12,1.3,1.8,2.2,3,4];
      for(let ring=0;ring<rings.length+6;ring++)for(const a of aa){
        const dx=rx*Math.cos(a),dz=rz*Math.sin(a);
        const edge=Math.min(Math.abs(dx)>1e-9?((dx>0?x1:x0)-cx)/dx:Infinity,Math.abs(dz)>1e-9?((dz>0?z1:z0)-cz)/dz:Infinity);
        const rho=ring<rings.length?rings[ring]:4+(edge-4)*(ring-rings.length+1)/6;
        add(cx+dx*rho,cz+dz*rho);
      }
      for(let k=0;k<n;k++)idx.push(first,first+1+(k+1)%n,first+1+k);
      for(let r=0;r<rings.length+5;r++)for(let k=0;k<n;k++){
        const a=first+1+r*n+k, next=first+1+r*n+(k+1)%n;
        idx.push(a,next,next+n,a,next+n,a+n);
      }
      return;
    }
    if (s.cuts?.length) {
      // Tensor grid with explicit lip/room-edge vertices: a centre fan would bridge
      // right over a narrow gorge, even when the sampled height function is correct.
      const axis = (lo: number, hi: number, key: 'X' | 'Z') => {
        const a = new Set<number>([lo, hi]);
        // Cut boundaries already partition the flat floor exactly. Extending an
        // extra 20-ft grid and every apron ring across both axes multiplies
        // triangles even far from the opening. Keep every cut edge, with a
        // coarser sampling of the smooth outer apron and its unchanged rim.
        for (const d of RINGS.filter((_, i) => i % 2 === 0 || i === RINGS.length - 1)) { a.add(lo - d); a.add(hi + d); }
        for (const c of s.cuts ?? []) {
          const min = key === 'X' ? c.bounds.minX : c.bounds.minZ, max = key === 'X' ? c.bounds.maxX : c.bounds.maxZ;
          const f = key === 'X' ? c.featherX : c.featherZ;
          for (const p of [min, min + f / 2, min + f, max - f, max - f / 2, max]) if (p > lo - APRON_REACH && p < hi + APRON_REACH) a.add(p);
        }
        return [...a].sort((a,b) => a-b);
      };
      const xs = axis(s.bounds.minX, s.bounds.maxX, 'X'), zs = axis(s.bounds.minZ, s.bounds.maxZ, 'Z'), n = xs.length, v = P.length / 3;
      for (const z of zs) for (const x of xs) {
        const d = mapDist(s.bounds, x, z), y = field.apronY(i, x, z, d), c = colour(x, z, y, { i, d });
        P.push(x,y,z); C.push(c.r,c.g,c.b);
      }
      for (let r=0;r<zs.length-1;r++) for(let k=0;k<n-1;k++) { const a=v+r*n+k; idx.push(a,a+n,a+n+1,a,a+n+1,a+1); }
      return;
    }
    const ol = outline(s.bounds), S = ol.length, v0 = P.length / 3, cx = (s.bounds.minX + s.bounds.maxX) / 2, cz = (s.bounds.minZ + s.bounds.maxZ) / 2;
    P.push(cx, s.base - 0.4, cz); { const c = colour(cx, cz, s.base, { i, d: 0 }); C.push(c.r, c.g, c.b); }
    for (const d of RINGS) for (const { p, n } of ol) {
      const x = p[0] + n[0] * d, z = p[1] + n[1] * d, y = field.apronY(i, x, z, d);
      P.push(x, y, z); const c = colour(x, z, field.height(x, z), { i, d }); C.push(c.r, c.g, c.b);
    }
    for (let k = 0; k < S; k++) idx.push(v0, v0 + 1 + ((k + 1) % S), v0 + 1 + k);
    for (let r = 0; r + 1 < RINGS.length; r++) for (let k = 0; k < S; k++) {
      const k1 = (k + 1) % S, a0 = v0 + 1 + r * S + k, a1 = v0 + 1 + r * S + k1, b0 = a0 + S, b1 = a1 + S;
      idx.push(a0, a1, b1, a0, b1, b0); // wound to face up
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, landMaterial()); m.name = 'aprons'; return m;
}

type Path = { pts: Vec2[]; w: number; hex: string; lift: number; water?: boolean };

/** World roads and rivers as paths in W. A road through a map stops at the map's edge, on the line toward the far end
 *  of the map's own road that leaves that way (the atlas's road exits, backdrop.ts's exitFor); rivers pass under maps. */
export function worldPaths(field: LandField): { roads: Path[]; rivers: Path[] } {
  const W = field.world, roads: Path[] = [], rivers: Path[] = [];
  const densify = (pts: Vec2[], step = 160): Vec2[] => {
    const out: Vec2[] = [];
    for (let i = 0; i < pts.length; i++) { if (i) { const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let k = 1; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); } out.push(pts[i]); }
    return out;
  };
  const inside = (s: LandSite, [x, z]: Vec2, pad: number) => x > s.bounds.minX - pad && x < s.bounds.maxX + pad && z > s.bounds.minZ - pad && z < s.bounds.maxZ + pad;
  /** Where a path leaving a map meets its edge: on the line from the map's road exit (nearest the path) to the first point outside. */
  const edgeFrom = (s: LandSite, road: string, out: Vec2): Vec2 => {
    const ex = s.exits.filter((e) => e.road === road), cand = ex.length ? ex : s.exits;
    let from: Vec2 = [(s.bounds.minX + s.bounds.maxX) / 2, (s.bounds.minZ + s.bounds.maxZ) / 2];
    let best = Infinity; for (const e of cand) { const d = Math.hypot(e.x - out[0], e.z - out[1]); if (d < best) { best = d; from = [e.x, e.z]; } }
    if (s.exactExits) return from;
    // walk from the exit toward the outside point until the map's edge
    const dx = out[0] - from[0], dz = out[1] - from[1];
    let lo = 0, hi = 1; for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (inside(s, [from[0] + dx * m, from[1] + dz * m], 0)) lo = m; else hi = m; }
    return [from[0] + dx * hi, from[1] + dz * hi];
  };
  for (const road of W.roads) {
    const path = road.kind === 'trail' || /path|trail|track/i.test(road.name), w = path ? 9 : 16, hex = path ? '#6d6150' : '#7a6c5a';
    const pts = densify(road.pts.map((p) => field.feet(p)));
    let cur: Vec2[] = [], last: LandSite | undefined;
    for (const p of pts) {
      const s = field.sites.find((q) => inside(q, p, 0));
      if (!s) { if (!cur.length && last) cur.push(edgeFrom(last, road.name, p)); cur.push(p); last = undefined; continue; }
      if (cur.length) { cur.push(edgeFrom(s, road.name, cur[cur.length - 1])); if (cur.length > 1) roads.push({ pts: densify(cur), w, hex, lift: 0.8 }); cur = []; }
      last = s;
    }
    if (cur.length > 1) roads.push({ pts: densify(cur), w, hex, lift: 0.8 });
  }
  for (const river of W.rivers) {
    const pts = densify(river.pts.map((p) => field.feet(p)));
    let cur: Vec2[] = [];
    for (const p of pts) { if (field.sites.some((q) => !q.cuts?.length && !q.shoreLake && inside(q, p, 10))) { if (cur.length > 1) rivers.push({ pts: cur, w: 40, hex: '#5e7d94', lift: 0.6, water: true }); cur = []; } else cur.push(p); }
    if (cur.length > 1) rivers.push({ pts: cur, w: 40, hex: '#5e7d94', lift: 0.6, water: true });
  }
  return { roads, rivers };
}

/** Roads and rivers as flat ribbons laid on the land (mitred strips, one mesh). */
function buildRibbons(field: LandField, paths: Path[]): THREE.Mesh {
  const P: number[] = [], C: number[] = [], idx: number[] = [], col = new THREE.Color();
  for (const r of paths) {
    col.set(r.hex); const v0 = P.length / 3, h = r.w / 2, n = r.pts.length;
    for (let i = 0; i < n; i++) {
      const a = r.pts[Math.max(0, i - 1)], b = r.pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
      const nx = (-dz / L) * h, nz = (dx / L) * h, [x, z] = r.pts[i];
      const waterY = field.lakeAt(x,z) >= 0 ? field.lakeLevel(field.lakeAt(x,z)) : field.surface(x,z) + r.lift;
      for (const s of [1, -1]) { const px = x + nx * s, pz = z + nz * s; P.push(px, r.water ? waterY : field.surface(px, pz) + r.lift, pz); C.push(col.r, col.g, col.b); }
    }
    for (let i = 0; i + 1 < n; i++) { const a = v0 + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
  const material = matClone('#ffffff', true); material.vertexColors = true; material.side = THREE.DoubleSide;
  const m = new THREE.Mesh(g, material); m.name = 'ribbons'; return m;
}

/** The lakes at their levels (one mesh) and Bluto Krogarov's rowboat on Lake Zarovich, off the shore nearest Vallaki. */
function buildWater(field: LandField): THREE.Object3D[] {
  const W = field.world, gs: THREE.BufferGeometry[] = [], out: THREE.Object3D[] = [];
  W.lakes.forEach((l, i) => { const g = new THREE.CircleGeometry(1, field.sites.some(s=>s.shoreLake===l.name)?128:64); g.rotateX(-Math.PI / 2); g.scale(l.r[0] * MI_FT, 1, l.r[1] * MI_FT); const [x, z] = field.feet(l.center); g.translate(x, field.lakeLevel(i), z); gs.push(g); });
  if (gs.length) { const material = matClone(FLOOR_COLOR['shallow-water'], true); setSurface(material, 'water'); const m = new THREE.Mesh(merge(gs), material); m.name = 'lakes'; out.push(m); }
  const zi = W.lakes.findIndex((l) => /Zarovich/.test(l.name)), town = W.pins.find((p) => p.key === 'N');
  if (zi >= 0 && town) {
    const l = W.lakes[zi], [tx, tz] = field.feet(town.pos);
    let best: Vec2 = field.feet(l.center), bd = Infinity;
    for (let k = 0; k < 48; k++) { const a = (k / 48) * Math.PI * 2, p = field.feet([l.center[0] + Math.cos(a) * l.r[0] * 0.82, l.center[1] + Math.sin(a) * l.r[1] * 0.82]), d = Math.hypot(p[0] - tx, p[1] - tz); if (d < bd) { bd = d; best = p; } }
    const parts: [THREE.BufferGeometry, string][] = [];
    const hull = new THREE.CylinderGeometry(2.4, 1.6, 13, 8, 1, false, 0, Math.PI); hull.rotateZ(Math.PI / 2); hull.rotateX(Math.PI); hull.scale(1, 0.75, 1); hull.translate(0, 1.4, 0); parts.push([hull, '#5a4632']);
    parts.push([new THREE.BoxGeometry(0.6, 0.3, 4).translate(1, 1.6, 0), '#6b5640']);
    parts.push([new THREE.CylinderGeometry(0.7, 0.9, 3.2, 6).translate(1, 3.2, 0), '#3f3a33']);
    parts.push([new THREE.SphereGeometry(0.55, 8, 6).translate(1, 5.2, 0), '#b08a6a']);
    parts.push([new THREE.CylinderGeometry(0.05, 0.08, 10, 4).rotateZ(-1.0).translate(4.5, 6, 0), '#2b2420']);
    parts.push([new THREE.SphereGeometry(1.1, 8, 6).scale(1, 0.7, 0.8).translate(-2.5, 2.1, 0), '#8a7a5a']);
    const boat = new THREE.Mesh(colourMerge(parts), vertexLambert()); boat.name = 'blutos-boat';
    boat.scale.setScalar(3); boat.position.set(best[0], field.lakeLevel(zi) + 0.3, best[1]); boat.rotation.y = 0.7;
    out.push(boat);
  }
  return out;
}

/** Geometries with a colour each, merged into one vertex-coloured geometry. */
export function colourMerge(parts: [THREE.BufferGeometry, string][]): THREE.BufferGeometry {
  const col = new THREE.Color();
  const gs = parts.map(([g0, hex]) => {
    const g = (g0.index ? g0.toNonIndexed() : g0); for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    col.set(hex); const n = g.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
  });
  const out = new THREE.BufferGeometry();
  const total = gs.reduce((a, g) => a + g.attributes.position.count, 0), P = new Float32Array(total * 3), N = new Float32Array(total * 3), C = new Float32Array(total * 3);
  let o = 0; for (const g of gs) { P.set(g.attributes.position.array as Float32Array, o * 3); N.set(g.attributes.normal.array as Float32Array, o * 3); C.set(g.attributes.color.array as Float32Array, o * 3); o += g.attributes.position.count; g.dispose(); }
  out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('color', new THREE.BufferAttribute(C, 3));
  out.computeBoundingSphere(); return out;
}
/** A lit, flat-shaded, vertex-coloured material that the players' fog never covers (scenery). */
export function vertexLambert(surf: Parameters<typeof setSurface>[1] = 'generic'): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: true }); setSurface(m, surf); return patchFog(m, true);
}

/** The crag a site stands on (Ravenloft's Pillarstone): ribbed rock columns round the plateau the land makes, from
 *  the valley floor to just under the map's floor, talus at the foot and mist pooled round it. */
function buildCrag(field: LandField, s: LandSite): THREE.Object3D[] {
  const b = s.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, hx = (b.maxX - b.minX) / 2, hz = (b.maxZ - b.minZ) / 2;
  let sd = 97; const r1 = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const foot = Math.min(...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => { const a = (k / 8) * Math.PI * 2; return field.ground(cx + Math.cos(a) * (hx + 900), cz + Math.sin(a) * (hz + 900)); }));
  const lift = Math.max(60, s.base - foot), parts: [THREE.BufferGeometry, string][] = [];
  const column = (x: number, z: number, rBase: number, rTop: number, top: number, bottom: number, lean: number, hex: string, segs = 9) => {
    const h = Math.max(10, top - bottom), g = new THREE.CylinderGeometry(rTop, rBase, h, segs, 7); g.translate(0, h / 2, 0);
    const rib = Array.from({ length: segs + 1 }, () => 1 + (r1() - 0.5) * 0.5); rib[segs] = rib[0];
    const pv = g.attributes.position;
    for (let i = 0; i < pv.count; i++) { const ang = Math.atan2(pv.getZ(i), pv.getX(i)), si = Math.round(((ang + Math.PI) / (Math.PI * 2)) * segs) % (segs + 1), k = rib[si]; pv.setX(i, pv.getX(i) * k); pv.setZ(i, pv.getZ(i) * k); }
    g.rotateX(lean * (r1() - 0.5)); g.rotateY(r1() * Math.PI); g.rotateZ(lean * (r1() - 0.5)); g.translate(x, bottom, z); parts.push([g, hex]);
  };
  // spurs and buttresses crowding the plateau's rim (the land holds the map's floor 320 ft past its edge, then falls to
  // the valley by 1,400 ft), shoulder to shoulder, so the rock reads as a cliff with a ragged outline from every side
  const n = 40;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r1() * 0.1, ca = Math.cos(a), sa = Math.sin(a);
    const edge = Math.min(Math.abs(ca) > 1e-6 ? hx / Math.abs(ca) : Infinity, Math.abs(sa) > 1e-6 ? hz / Math.abs(sa) : Infinity);
    const d = edge + 380 + r1() * 380, x = cx + ca * d, z = cz + sa * d, g = field.ground(x, z) - 40;
    const top = s.base - 4 - lift * r1() * 0.12, r = 110 + r1() * 110;
    column(x, z, r, r * (0.45 + r1() * 0.3), top, g, 0.08, i % 3 === 0 ? '#3a3a42' : i % 3 === 1 ? '#4a4a52' : '#45454d', 9);
  }
  for (let i = 0; i < 26; i++) { const a = r1() * Math.PI * 2, r = Math.hypot(hx, hz) + 700 + r1() * 700, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; parts.push([new THREE.IcosahedronGeometry(10 + r1() * 16, 0).translate(x, field.height(x, z) - 2, z), '#44444c']); }
  const rock = new THREE.Mesh(colourMerge(parts), vertexLambert('rock')); rock.name = `crag:${s.key}`;
  const out: THREE.Object3D[] = [rock];
  // mist pooled round the foot of the rock: soft-edged layers (a radial fade, no rim to catch the eye)
  const R = Math.hypot(hx, hz) + 300;
  for (const [k, op, rr] of [[0.92, 0.5, 2.4], [0.72, 0.32, 1.9], [0.5, 0.18, 1.5]] as const) {
    const ring = new THREE.Mesh(new THREE.CircleGeometry(R * rr, 40), new THREE.MeshBasicMaterial({ color: '#c6ccd6', map: mistTexture(), transparent: true, opacity: op, fog: true, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(cx, s.base - lift * k, cz); ring.name = 'crag-mist'; out.push(ring);
  }
  return out;
}

export interface Land {
  group: THREE.Group;
  field: LandField;
  paths: { roads: Path[]; rivers: Path[] };
}

/** Build the whole region's land for a world and its placed maps. */
export function buildLand(world: WorldData, sites: LandSite[], theme: Theme): Land {
  const field = new LandField(world, sites), colour = colourer(field, theme), group = new THREE.Group();
  group.name = 'world-land';
  group.add(buildLattice(field, colour), buildAprons(field, colour));
  const paths = worldPaths(field);
  const rib = [...paths.rivers, ...paths.roads];
  if (rib.length) group.add(buildRibbons(field, rib));
  for (const o of buildWater(field)) group.add(o); // a region with no lakes adds nothing (add() with no argument logs an error)
  for (const s of sites) if (s.crag) for (const o of buildCrag(field, s)) group.add(o);
  group.traverse((o) => { o.userData.role = 'stage'; o.matrixAutoUpdate = false; o.updateMatrix(); });
  return { group, field, paths };
}
