// Props and figures for one wilderness site of chapter 2 (its own file so each site is built on its own).
// Every kind registered here starts with 'm-' so it never collides with another site's. Build from THREE meshes
// with mat() so the world-space surface grain applies; declare new colours with surfaceFor from '../surfaces'.
//
// M: Mount Baratok, the granite shelf above the valley fog where the Mad Mage lives as an elk. Feet; origin at the
// piece's foot; +z is plan south. Shape-driven pieces (the bench, the cascade) take their plan points as dims
// (x0/z0 … or named points) relative to the piece's origin, so the layout lives in scripts/authoring/wild_m.py.
import * as THREE from 'three';
import { PROPS_V1, pine } from '../props';
import { CREATURES } from '../creatures';
import { mat, matClone } from '../../render/materials';
import { FLOOR_COLOR } from '../palette';
import { surfaceFor } from '../surfaces';
import { waterfall } from './wild';

type Dims = Record<string, number>;
type P2 = [number, number];

// ---------------------------------------------------------------- colours and what they are made of
const C = {
  granite: '#6b6862', graniteDeep: '#58564f', granitePale: '#7d7a72', joint: '#36353a', wetRock: '#41444a', talus: '#64625c',
  lichen: '#77795c', moss: '#3b4431', snow: '#d9dde3', snowDirty: '#b8b7b0', print: '#8d8c87', rime: '#c9d5dc', ice: '#a9c3d2',
  water: '#4f6777', waterDeep: '#33475a', foam: '#d6dee4', pool: '#0f1418', mirror: '#7f8c97', fitted: '#77736a',
  glass: '#141419', scorch: '#2a2624', ash: '#4c4a47', glint: '#bcd4ff',
  krum: '#2a4232', krumDark: '#1f3127', needleBrown: '#6b5a3a', needleDead: '#5a4a32', hollow: '#4d4232',
  bark: '#45362a', deadwood: '#8a8273', deadwoodDark: '#6f685c', char: '#1d1b1a', charBark: '#2b2523', blaze: '#a8956f',
  bone: '#d8cfb6', boneDark: '#b3a98f', tin: '#8a8d91', rust: '#5a3a2a', robe: '#141216', lining: '#4a4152', liningDark: '#3a3342',
  pole: '#5c4b39', lash: '#8c7b5c', scratch: '#c9c4b5', elkHair: '#6a5038', trap: '#4a3329', trapDark: '#33241c',
  hound: '#a9bdd0', houndDeep: '#7f95ab', cloud: '#34353d', cloudDeep: '#26272e', cloudPale: '#4a4b55', flicker: '#d9dcff',
  castle: '#2d2b33', castleDeep: '#232129', castleRock: '#34333a', ghakis: '#4a4743',
  mist0: '#dcdee2', mist1: '#c7cad0', mist2: '#b3b7be',
} as const;
surfaceFor([C.granite, C.graniteDeep, C.granitePale, C.joint, C.wetRock, C.talus, C.fitted, C.castleRock, C.ghakis], 'rock');
surfaceFor([C.lichen, C.moss, C.krum, C.krumDark, C.needleBrown, C.needleDead, C.hollow], 'foliage');
surfaceFor([C.snow, C.snowDirty, C.print], 'snow');
surfaceFor([C.water, C.waterDeep], 'water');
surfaceFor([C.bark, C.charBark], 'bark');
surfaceFor([C.deadwood, C.deadwoodDark, C.blaze, C.pole], 'wood');
surfaceFor([C.robe, C.lining, C.liningDark, C.lash], 'cloth');
surfaceFor([C.tin, C.rust, C.trap, C.trapDark], 'metal');
surfaceFor([C.castle, C.castleDeep], 'ashlar');
surfaceFor([C.rime, C.ice, C.foam, C.pool, C.mirror, C.glass, C.scorch, C.ash, C.glint, C.char, C.bone, C.boneDark, C.scratch, C.elkHair,
  C.hound, C.houndDeep, C.cloud, C.cloudDeep, C.cloudPale, C.flicker, C.mist0, C.mist1, C.mist2], 'generic');

// ---------------------------------------------------------------- helpers
const grp = (...m: THREE.Object3D[]) => { const g = new THREE.Group(); if (m.length) g.add(...m); return g; };
const place = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): T => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };
const hash = (i: number, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7 + 0.5) * 43758.5453; return x - Math.floor(x); };
/** Scenery that stands past the map's edge (the mountain, the sky, the far valley) keeps its colour in the players'
 *  fog of war, as the backdrop does: exempt materials, cached per colour. */
const exempt = new Map<string, THREE.MeshLambertMaterial>();
function exm(color: string): THREE.MeshLambertMaterial { let m = exempt.get(color); if (!m) { m = matClone(color, true); exempt.set(color, m); } return m; }
/** A faceted lump (rock, billow, mat of needles): an icosahedron pushed in and out, then squashed. */
function lumpGeo(r: number, seed: number, sx = 1, sy = 1, sz = 1, detail = 1): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(r, detail), pv = geo.attributes.position;
  for (let i = 0; i < pv.count; i++) {
    const x = pv.getX(i), y = pv.getY(i), z = pv.getZ(i), k = 0.8 + 0.34 * Math.abs(Math.sin(x * 2.9 + y * 1.7 + z * 2.3 + seed * 1.37));
    pv.setXYZ(i, x * k * sx, y * k * sy, z * k * sz);
  }
  geo.computeVertexNormals();
  return geo;
}
/** Fog: the palette's mist, lit, see-through and drawn without depth writes (cached per colour and opacity). */
const fogMats = new Map<string, THREE.MeshLambertMaterial>();
function fogMat(color: string, opacity: number, far = false): THREE.MeshLambertMaterial {
  const k = color + opacity + far;
  let m = fogMats.get(k);
  if (!m) { m = matClone(color, far); m.transparent = true; m.opacity = opacity; m.depthWrite = false; m.side = THREE.DoubleSide; fogMats.set(k, m); }
  return m;
}
/** Unlit see-through glow (lightning inside a cloud, the glass of a bolt scar catching the light). */
const glows = new Map<string, THREE.MeshBasicMaterial>();
function glow(color: string, opacity: number): THREE.MeshBasicMaterial {
  const k = color + opacity;
  let m = glows.get(k);
  if (!m) { m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, fog: false }); glows.set(k, m); }
  return m;
}
/** A flat polygon lying in the plan at height y. */
function flatGeo(pts: P2[], y: number): THREE.BufferGeometry {
  const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)))); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g;
}
/** A strip `w` wide along a polyline whose points carry their own height: water in a channel, a chute. */
function stripGeo(pts: [number, number, number][], w: number | ((t: number) => number)): THREE.BufferGeometry {
  const pos: number[] = [], n = pts.length;
  const side = (i: number): [number, number, number, number] => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1;
    const hw = (typeof w === 'function' ? w(i / (n - 1)) : w) / 2;
    return [pts[i][0] - (dz / L) * hw, pts[i][2] + (dx / L) * hw, pts[i][0] + (dz / L) * hw, pts[i][2] - (dx / L) * hw];
  };
  for (let i = 0; i + 1 < n; i++) {
    const [ax, az, bx, bz] = side(i), [cx, cz, dx, dz] = side(i + 1), ya = pts[i][1], yb = pts[i + 1][1];
    pos.push(ax, ya, az, cx, yb, cz, bx, ya, bz, bx, ya, bz, cx, yb, cz, dx, yb, dz);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  // keep it facing up whichever way the line runs
  const nv = g.attributes.normal; if (nv.count && nv.getY(0) < 0) { const p = g.attributes.position; for (let i = 0; i < p.count; i += 3) { const x = p.getX(i + 1), y = p.getY(i + 1), z = p.getZ(i + 1); p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)); p.setXYZ(i + 2, x, y, z); } g.computeVertexNormals(); }
  return g;
}
const pt = (d: Dims, k: string): P2 => [d[k + 'x'] ?? 0, d[k + 'z'] ?? 0];
const polyOf = (d: Dims, p = ''): P2[] => { const out: P2[] = []; for (let i = 0; i < (d[p + 'n'] ?? 0); i++) out.push([d[p + 'x' + i], d[p + 'z' + i]]); return out; };
function inPoly([x, z]: P2, poly: P2[]): boolean { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; }
/** Outward unit normals at a polygon's vertices (bisectors), whichever way it winds. */
function outwardNormals(P: P2[]): P2[] {
  const n = P.length, out: P2[] = [];
  for (let i = 0; i < n; i++) {
    const a = P[(i + n - 1) % n], b = P[i], c = P[(i + 1) % n];
    const e1 = [b[0] - a[0], b[1] - a[1]], e2 = [c[0] - b[0], c[1] - b[1]], l1 = Math.hypot(e1[0], e1[1]) || 1, l2 = Math.hypot(e2[0], e2[1]) || 1;
    let nx = e1[1] / l1 + e2[1] / l2, nz = -e1[0] / l1 - e2[0] / l2; const L = Math.hypot(nx, nz) || 1; nx /= L; nz /= L;
    out.push([nx, nz]);
  }
  const t: P2 = [P[0][0] + out[0][0] * 0.05, P[0][1] + out[0][1] * 0.05];
  return inPoly(t, P) ? out.map(([x, z]) => [-x, -z] as P2) : out;
}
/** Collect meshes of one colour into one geometry (a big piece stays a handful of meshes). */
class Bucket {
  private by = new Map<string, { m: THREE.Material; gs: THREE.BufferGeometry[] }>();
  add(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0): void {
    const o = new THREE.Object3D(); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.updateMatrix(); geo.applyMatrix4(o.matrix);
    const k = m.uuid; let e = this.by.get(k); if (!e) { e = { m, gs: [] }; this.by.set(k, e); } e.gs.push(geo.index ? geo.toNonIndexed() : geo);
  }
  mesh(o: THREE.Mesh): void { o.updateMatrix(); const g = o.geometry.clone().applyMatrix4(o.matrix); this.add(g, o.material as THREE.Material); }
  into(g: THREE.Group): THREE.Group {
    for (const { m, gs } of this.by.values()) {
      for (const x of gs) for (const k of Object.keys(x.attributes)) if (k !== 'position' && k !== 'normal') x.deleteAttribute(k);
      const merged = mergeAll(gs); merged.computeVertexNormals(); g.add(new THREE.Mesh(merged, m));
    }
    return g;
  }
}
function mergeAll(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let n = 0; for (const g of gs) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3); let o = 0;
  for (const g of gs) { pos.set(g.attributes.position.array as Float32Array, o); o += g.attributes.position.count * 3; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); return out;
}

// ---------------------------------------------------------------- the land: the shelf and the cliffs
/** Raised ground: a table of land whose top is the polygon x0/z0… (local), `h` ft high, its flanks a steep bouldery
 *  talus spreading `s` ft out at the foot. The top itself sits a little under `h` so a level's floor covers it; past the
 *  map's edge (where no floor is drawn) it shows as the campaign's grass. */
export function bench(d: Dims): THREE.Group {
  const P = polyOf(d), H = d.h ?? 40, S = d.s ?? 26, sd = d.seed ?? 3, nrm = outwardNormals(P), n = P.length, g = grp(), B = new Bucket();
  const rows = [{ k: 0, y: H - 0.3 }, { k: 0.42, y: H * 0.52 }, { k: 1.05, y: -0.6 }];
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n], na = nrm[i], nb = nrm[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.max(1, Math.round(L / 9));
    const at = (t: number, r: number, j: number) => {
      const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, nx = na[0] + (nb[0] - na[0]) * t, nz = na[1] + (nb[1] - na[1]) * t, nl = Math.hypot(nx, nz) || 1;
      const jit = r === 0 ? 0 : (hash(i * 31 + j, sd + r) - 0.5) * S * 0.35, k = rows[r].k * S + jit;
      return [x + (nx / nl) * k, rows[r].y + (r === 1 ? (hash(i * 17 + j, sd) - 0.5) * H * 0.2 : 0), z + (nz / nl) * k];
    };
    for (let j = 0; j < m; j++) for (let r = 0; r < 2; r++) {
      const p00 = at(j / m, r, i * 100 + j), p10 = at((j + 1) / m, r, i * 100 + j + 1), p01 = at(j / m, r + 1, i * 100 + j), p11 = at((j + 1) / m, r + 1, i * 100 + j + 1);
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([...p00, ...p01, ...p10, ...p10, ...p01, ...p11], 3));
      B.add(geo, exm(hash(i * 7 + j, r + sd) > 0.55 ? C.granite : hash(i + j, sd) > 0.5 ? C.talus : C.graniteDeep));
    }
    // boulders spilled along the foot and lodged in the slope
    for (let j = 0; j < m; j++) {
      const t = (j + 0.5) / m, q = at(t, 2, i * 100 + j), r = 2 + hash(i * 13 + j, sd) * 4;
      B.add(lumpGeo(r, i * 13 + j, 1.3, 0.62, 1.1, 1), exm(j % 3 ? C.graniteDeep : C.granite), q[0], r * 0.25, q[2], hash(j, i) * 6);
      if (hash(j, i + sd) > 0.45) { const q2 = at(t + 0.3 / m, 1, i * 100 + j), r2 = 1.6 + hash(j, i + 3) * 2.6; B.add(lumpGeo(r2, j + i * 3, 1.2, 0.7, 1, 1), exm(C.granite), q2[0], q2[1] + r2 * 0.2, q2[2], hash(i, j) * 6); }
    }
  }
  // the top, under the map's own ground: grass past the map's edge
  if (d.cap ?? 1) { const top = flatGeo(P, H - 0.3); B.add(top, exm(FLOOR_COLOR.grass)); }
  return B.into(g);
}

/** Sheet granite: the polygon x0/z0… (local) paved by nature with broad, thin plates of fractured rock, each tilted a
 *  little toward +z (downslope), grass and moss showing in the joints between them; a few plates cracked across.
 *  Circles cx/cz/cr0… (cn of them) stay bare (a stream, a drift). */
export function slabs(d: Dims): THREE.Group {
  const P = polyOf(d), sd = d.seed ?? 1, step = d.step ?? 11, B = new Bucket(), g = grp();
  const holes: [number, number, number][] = []; for (let k = 0; k < (d.cn ?? 0); k++) holes.push([d['cx' + k], d['cz' + k], d['cr' + k]]);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  let i = 0;
  for (let z = z0 + step / 2; z < z1; z += step * 0.86) for (let x = x0 + step / 2 + ((Math.round((z - z0) / step) % 2) * step) / 2; x < x1; x += step, i++) {
    const cx = x + (hash(i, sd) - 0.5) * step * 0.7, cz = z + (hash(i, sd + 1) - 0.5) * step * 0.7;
    if (!inPoly([cx, cz], P) || hash(i, sd + 2) < 0.12) continue;
    if (holes.some(([hx, hz, hr]) => Math.hypot(cx - hx, cz - hz) < hr)) continue;
    // an irregular plate: 5 to 8 corners at uneven angles and radii, stretched one way, some plates much bigger
    const pts: P2[] = [], m = 5 + Math.floor(hash(i, sd + 15) * 4), big = hash(i, sd + 16) > 0.8 ? 1.45 : 0.75 + hash(i, sd + 17) * 0.4, sx = 1 + hash(i, sd + 18) * 0.6;
    let a = hash(i, sd + 3) * 6;
    for (let k = 0; k < m; k++) { a += ((Math.PI * 2) / m) * (0.6 + hash(i * 7 + k, sd + 19) * 0.8); const rr = step * big * (0.3 + hash(i * 7 + k, sd + 4) * 0.32); pts.push([Math.cos(a) * rr * sx, Math.sin(a) * rr]); }
    const th = 0.35 + hash(i, sd + 5) * 0.4, sh = new THREE.Shape(pts.map(([px, pz]) => new THREE.Vector2(px, -pz)));
    const geo = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
    const col = hash(i, sd + 6) > 0.7 ? C.granitePale : hash(i, sd + 7) > 0.45 ? C.granite : C.talus;
    B.add(geo, mat(col), cx, 0.02, cz, hash(i, sd + 8) * 6, 0.035 + hash(i, sd + 9) * 0.03, (hash(i, sd + 10) - 0.5) * 0.05);
    if (hash(i, sd + 11) > 0.65) B.add(new THREE.BoxGeometry(step * 0.7, 0.08, 0.22), mat(C.joint), cx, th + 0.25, cz, hash(i, sd + 12) * 3);   // a crack across
    if (hash(i, sd + 13) > 0.6) B.add(new THREE.BoxGeometry(step * 0.5, 0.1, 0.9), mat(hash(i, 1) > 0.5 ? C.moss : C.lichen), cx + step * 0.3, 0.12, cz + step * 0.35, hash(i, sd + 14) * 3);   // moss in a joint
  }
  return B.into(g);
}

/** A cliff band `len` ft long (local x), `h` high, its face along z = 0 looking toward +z and the rock running `d` ft
 *  back: layered grey strata that step in and out, joints, lichen and wet streaks, broken talus at its foot.
 *  tw/te taper the west/east ends down; notch (local x), notchW, notchD cut a gully down from the top (the scree
 *  feeds from it); stair (local x of its foot) cuts a diagonal crack with chockstone steps rising toward -x; ovh juts
 *  the top strata out as an overhang (kept off clear ± clearW); snow 1 lays old snow on top. */
export function headwall(d: Dims): THREE.Group {
  const L = d.len ?? 200, H = d.h ?? 120, D = d.d ?? 120, sd = d.seed ?? 1, tw = d.tw ?? 0, te = d.te ?? 0, ovh = d.ovh ?? 0, snow = d.snow ?? 0;
  const B = new Bucket(), g = grp(), COL = [C.granite, C.graniteDeep, C.granitePale];
  const ys: number[] = [0]; for (let y = 0, k = 0; y < H; k++) { y += 5 + hash(k, sd + 40) * 7; ys.push(Math.min(H, y)); }
  // columns of uneven width: buttresses and recesses that run the height of the cliff, not courses of masonry
  const xs: number[] = [-L / 2]; for (let k = 0; xs[xs.length - 1] < L / 2 - 6; k++) xs.push(Math.min(L / 2, xs[xs.length - 1] + 7 + hash(k, sd + 60) * 13)); xs[xs.length - 1] = L / 2;
  const n = xs.length - 1;
  const topAt = (x: number) => {
    let top = H;
    if (tw && x < -L / 2 + tw) top = H * (0.3 + 0.7 * Math.max(0, (x + L / 2) / tw));
    if (te && x > L / 2 - te) top = H * (0.3 + 0.7 * Math.max(0, (L / 2 - x) / te));
    if (d.notch !== undefined) { const nw = (d.notchW ?? 30) / 2, nd = Math.abs(x - d.notch); if (nd < nw) top -= (d.notchD ?? 30) * (1 - nd / nw); }
    return top;
  };
  const stairAt = (y: number) => (d.stair ?? 0) - (y / H) * (d.stairRun ?? 34);   // the crack's x at height y
  for (let i = 0; i < n; i++) {
    const w = xs[i + 1] - xs[i], x = (xs[i] + xs[i + 1]) / 2, top = topAt(x), inNotch = d.notch !== undefined && Math.abs(x - d.notch) < (d.notchW ?? 30) / 2;
    // the rock behind the face
    B.add(new THREE.BoxGeometry(w + 0.4, top - 0.3, D - 6), exm(C.graniteDeep), x, (top - 0.3) / 2, -6 - (D - 6) / 2);
    const clear = d.clear !== undefined && Math.abs(x - d.clear) < (d.clearW ?? 10);
    // this column stands out or back as a whole (a buttress, a gully), leaning back a little with height
    const col = (hash(i, sd + 61) - 0.5) * 7 + Math.sin(i * 0.9 + sd) * 1.5, bulgeAt = hash(i, sd + 62) * H, bulge = (hash(i, sd + 63) - 0.3) * 4;
    for (let j = 0; j + 1 < ys.length; j++) {
      // bedding dips gently along the cliff, so the courses never line up like masonry
      const dip = (x / L) * 7 + Math.sin(x * 0.05 + sd) * 1.5;
      const y0 = j ? Math.max(0, ys[j] + dip + (hash(i, j + sd) - 0.5) * 1.4) : 0, y1 = Math.min(top - 0.3, ys[j + 1] + dip + (hash(i, j + 1 + sd) - 0.5) * 1.4);
      if (y1 - y0 < 0.5) continue;
      const ym = (y0 + y1) / 2;
      let front = col + (hash(i * 3 + j, sd + 7) - 0.5) * 2.2 + Math.sin(j * 1.3 + sd) * 1.0 + bulge * Math.exp(-(((ym - bulgeAt) / 25) ** 2)) - ym * 0.02;
      if (inNotch) front -= 7;
      if (ovh && !clear && y1 > top - 16) front += ovh * Math.min(1, (y1 - (top - 16)) / 14) * (0.6 + 0.4 * hash(i, sd + 9));
      const dep = 9 + Math.max(0, front);
      const ry = (hash(i * 5 + j, sd + 64) - 0.5) * 0.08;
      B.add(new THREE.BoxGeometry(w + 0.6 + hash(i, j) * 0.8, y1 - y0, dep), exm(COL[(j + (hash(i, j + 3) > 0.9 ? 1 : 0)) % 3]), x + (hash(j, i) - 0.5) * 0.6, ym, front - dep / 2, ry);
      // lichen and moss on the strata that stand out
      if (front > 0.8 && hash(i * 5 + j, sd + 2) > 0.7 && y1 < top - 2) B.add(new THREE.BoxGeometry(w * (0.4 + hash(i, j) * 0.5), 0.3, 1.6), exm(hash(j, i) > 0.5 ? C.lichen : C.moss), x, y1 + 0.12, front - 0.9);
      if (snow && y1 > top * 0.55 && front > 0.5 && hash(i * 7 + j, sd + 5) > 0.55) B.add(new THREE.BoxGeometry(w * (0.5 + hash(i, j + 9) * 0.5), 0.5, 2.2), exm(C.snow), x, y1 + 0.2, front - 1.2);
    }
    // joints: dark, deep, thin, so they show only where they meet the face
    if (hash(i, sd + 11) > 0.7) { const jh = 14 + hash(i, sd + 12) * 40, jy = hash(i, sd + 13) * Math.max(0, top - jh); B.add(new THREE.BoxGeometry(0.7, jh, 7), exm(C.joint), x + w / 2, jy + jh / 2, -1); }
    if (hash(i, sd + 14) > 0.8) { const jw = w * 1.6, jy = 8 + hash(i, sd + 15) * (top - 16); B.add(new THREE.BoxGeometry(jw, 0.6, 7), exm(C.joint), x, jy, -1.2); }
    // wet black streaks where water seeps down
    if (hash(i, sd + 16) > 0.82) { const sh = 20 + hash(i, sd + 17) * 50; B.add(new THREE.BoxGeometry(2 + hash(i, 3) * 2, sh, 7.2), exm(C.wetRock), x, Math.max(sh / 2, top - sh / 2 - 4), -1); }
    if (snow) B.add(new THREE.BoxGeometry(w + 0.6, 1.4, D - 4 - (hash(i, sd + 18) * 4)), exm(hash(i, 2) > 0.3 ? C.snow : C.snowDirty), x, top + 0.3, -(D - 4) / 2 - 1 + ovh * 0.4);
    // talus at the foot
    if (d.talus ?? 1) {
      for (let k = 0; k < 2; k++) { const r = 2.4 + hash(i * 2 + k, sd + 19) * 4.6, tx = x + (hash(i, k + 20) - 0.5) * w; if (d.stair && Math.abs(tx - (d.stair ?? 0)) < 6) continue;
        B.add(lumpGeo(r, i * 2 + k, 1.35, 0.68, 1.1, 1), exm(k ? C.talus : C.granite), tx, r * 0.3, 2 + hash(i, k + 21) * 9, hash(i, k) * 6); }
      if (hash(i, sd + 22) > 0.5) B.add(lumpGeo(1 + hash(i, 23) * 1.4, i + 50, 1.2, 0.7, 1, 0), exm(C.granitePale), x + (hash(i, 24) - 0.5) * w, 0.35, 10 + hash(i, 25) * 8);
    }
  }
  // the notch: a dark gully down the face with jammed blocks, feeding the scree below
  if (d.notch !== undefined) {
    const nx = d.notch, nd = d.notchD ?? 30, top = H - nd;
    B.add(new THREE.BoxGeometry(7, top, 4), exm(C.joint), nx, top / 2, -4.5);
    for (let k = 0; k < 6; k++) { const y = 6 + k * (top - 10) / 5, r = 2 + hash(k, sd + 30) * 1.6; B.add(lumpGeo(r, k + 70, 1.2, 0.8, 1, 0), exm(C.granitePale), nx + (hash(k, 31) - 0.5) * 4, y, -3 + hash(k, 32) * 1.5, hash(k, 33) * 6); }
  }
  // the crack-stair: a diagonal slot up the face, chockstones wedged across it, their tops worn pale
  if (d.stair) {
    const nk = Math.round(H / 6);
    for (let k = 0; k < nk; k++) {
      const y = (k + 0.5) * (H / nk), x = stairAt(y);
      B.add(new THREE.BoxGeometry(4.6, H / nk + 0.4, 6.5), exm(C.joint), x, y, -1.6, 0, 0, 0.32);
      const cy = (k + 1) * (H / nk) - 0.6, cx = stairAt(cy);
      B.add(new THREE.BoxGeometry(3.8, 1.2, 3.2), exm(k % 2 ? C.granitePale : C.talus), cx + (hash(k, 40) - 0.5) * 0.8, cy, 1.4, hash(k, 41) * 0.6);
      B.add(new THREE.BoxGeometry(2.6, 0.12, 2.2), exm(C.fitted), cx, cy + 0.66, 1.4);
    }
    // the foot of the stair: flat stepping stones out over the talus
    for (let k = 0; k < 3; k++) B.add(new THREE.BoxGeometry(3.4, 0.9 + k * 0.9, 3), exm(C.granitePale), (d.stair ?? 0) + 2 + k * 1.2, 0.45 + k * 0.45, 5 - k * 2.4, 0.2 * k);
  }
  return B.into(g);
}

// ---------------------------------------------------------------- the Elk's Spur
/** A granite promontory thrusting out like a ship's prow along local +x: its back (x 0) is a boulder scramble down to
 *  the slope, its sides and prow sheer, its flat top at `h`. Top outline: half-width hw at the back narrowing to the
 *  tip at `len`. Black glassy lightning scars branch across the top; fish bones lie scattered on it. */
export function spur(d: Dims): THREE.Group {
  const L = d.len ?? 70, HW = d.hw ?? 19, H = d.h ?? 25, B = new Bucket(), g = grp();
  const base: P2[] = [[-2, -HW], [L * 0.62, -HW * 0.92], [L * 0.9, -HW * 0.42], [L, 0], [L * 0.9, HW * 0.42], [L * 0.62, HW * 0.92], [-2, HW]];
  // each stratum's outline: the prow shape subdivided and pushed in and out, so the faces break like real rock
  const outline = (grow: number, k: number): P2[] => {
    const out: P2[] = [], nb = outwardNormals(base);
    for (let i = 0; i < base.length; i++) {
      const a = base[i], b = base[(i + 1) % base.length], na = nb[i], nbb = nb[(i + 1) % base.length], m = i === base.length - 1 ? 1 : Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6));
      for (let j = 0; j < m; j++) {
        const t = j / m, nx = na[0] + (nbb[0] - na[0]) * t, nz = na[1] + (nbb[1] - na[1]) * t, nl = Math.hypot(nx, nz) || 1, e = grow + (j === 0 ? 0 : (hash(i * 13 + j, k + 5) - 0.45) * 2.6);
        out.push([a[0] + (b[0] - a[0]) * t + (nx / nl) * e, a[1] + (b[1] - a[1]) * t + (nz / nl) * e]);
      }
    }
    return out;
  };
  // the body in strata, each a little proud of or behind the last, darkest at the foot
  const layers = [0, 4.5, 9, 13, 17.5, 21.5, H - 0.05];
  for (let k = 0; k + 1 < layers.length; k++) {
    const grow = 0.6 + Math.sin(k * 1.9) * 0.9 - (k === layers.length - 2 ? 0.3 : 0), sh = new THREE.Shape(outline(grow, k).map(([x, z]) => new THREE.Vector2(x + (hash(k, 3) - 0.5) * 0.8, -z)));
    const geo = new THREE.ExtrudeGeometry(sh, { depth: layers[k + 1] - layers[k], bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
    B.add(geo, mat([C.graniteDeep, C.granite, C.granitePale][k % 3]), 0, layers[k], 0);
  }
  // vertical joints on the sheer faces
  for (let i = 0; i < 9; i++) { const t = (i + 0.5) / 9, x = t * L * 0.95, s = i % 2 ? 1 : -1, z = s * (HW * (t < 0.62 ? 0.95 : 0.95 - (t - 0.62) * 1.5) + 0.4); B.add(new THREE.BoxGeometry(0.6, 8 + hash(i, 4) * 12, 2), mat(C.joint), x, 5 + hash(i, 5) * 12, z); }
  // the back: a staircase of boulders down to the slope
  for (let k = 0; k < 7; k++) { const r = 4.5 + hash(k, 6) * 2.5, y = H - 4 - k * 3.4, x = -3 - k * 3.6, z = (hash(k, 7) - 0.5) * HW * 1.2; if (y < -1) break; B.add(lumpGeo(r, k + 11, 1.35, 0.75, 1.25, 1), mat(k % 2 ? C.granite : C.talus), x, Math.max(r * 0.4, y), z, hash(k, 8) * 6); }
  for (let k = 0; k < 6; k++) B.add(lumpGeo(2.2 + hash(k, 9) * 2, k + 30, 1.3, 0.7, 1.1, 1), mat(C.talus), -14 - hash(k, 10) * 14, 1, (hash(k, 11) - 0.5) * HW * 2);
  // talus at the foot of the sheer sides
  for (let i = 0; i < 16; i++) { const t = hash(i, 12), s = i % 2 ? 1 : -1, x = t * L * 0.9 + 4, half = HW * (t < 0.62 ? 1 : 1 - (t - 0.62) * 1.4), r = 1.6 + hash(i, 13) * 3; B.add(lumpGeo(r, i + 40, 1.3, 0.62, 1.1, 1), mat(i % 3 ? C.graniteDeep : C.talus), x, r * 0.25, s * (half + 2 + hash(i, 14) * 4), hash(i, 15) * 6); }
  // the top: moss in the joints, the lightning scars, the fish bones
  const top = H + 0.03;
  for (let i = 0; i < 6; i++) B.add(new THREE.BoxGeometry(3 + hash(i, 16) * 5, 0.12, 0.7), mat(C.moss), 6 + hash(i, 17) * L * 0.6, top, (hash(i, 18) - 0.5) * HW * 1.4, hash(i, 19) * 3);
  const scar = (x: number, z: number, a: number, len: number, depth: number, seed: number) => {
    let px = x, pz = z, ang = a;
    const n = Math.max(2, Math.round(len / 2.2));
    for (let k = 0; k < n; k++) {
      const seg = 2 + hash(k, seed) * 1.2, nx = px + Math.cos(ang) * seg, nz = pz + Math.sin(ang) * seg, w = Math.max(0.25, 0.8 - k * 0.06 - depth * 0.2);
      B.add(new THREE.BoxGeometry(seg + 0.3, 0.14, w), mat(C.glass), (px + nx) / 2, top + 0.04, (pz + nz) / 2, -ang);
      B.add(new THREE.BoxGeometry(seg + 0.9, 0.06, w + 1.4), mat(C.scorch), (px + nx) / 2, top, (pz + nz) / 2, -ang);
      if (k % 3 === 1) B.add(new THREE.OctahedronGeometry(0.16, 0), glow(C.glint, 1), nx, top + 0.18, nz);
      if (depth < 2 && hash(k, seed + 1) > 0.62) scar(nx, nz, ang + (hash(k, seed + 2) > 0.5 ? 0.8 : -0.8), len * 0.4, depth + 1, seed + k * 7);
      px = nx; pz = nz; ang += (hash(k, seed + 3) - 0.5) * 0.9;
    }
  };
  scar(L * 0.86, 0, Math.PI + 0.1, 30, 0, 3); scar(L * 0.55, -HW * 0.5, Math.PI * 0.8, 18, 1, 9); scar(L * 0.3, HW * 0.55, -Math.PI * 0.85, 16, 1, 21);
  for (let i = 0; i < 14; i++) {
    const x = L * (0.45 + hash(i, 20) * 0.45), z = (hash(i, 21) - 0.5) * HW * 0.9;
    if (i % 3 === 0) B.add(new THREE.CylinderGeometry(0.12, 0.12, 1.8, 5), mat(C.bone), x, top + 0.12, z, hash(i, 22) * 3, 0, Math.PI / 2);   // a spine
    else B.add(new THREE.BoxGeometry(0.5, 0.12, 0.22), mat(C.boneDark), x, top + 0.06, z, hash(i, 23) * 3);                                  // vertebrae
  }
  return B.into(g);
}

// ---------------------------------------------------------------- the cascade
/** The ice-cold cascade, from the ledge to the plunge pool; all points relative to the pool's centre (the origin):
 *  the stream across the ledge (s0…s3 at `lh`), the first drop at d1 (`h1`), the stepped rock in the cleft from d1 to
 *  d2 at lh − h1 with icy cheeks, the second drop at d2 (`h2`), the boulder chute on a rock rib from d2 to d3 falling
 *  `cf`, the last drop at d3 into the pool (radius `pr`): black water, iced rim, the outflow lip toward +z. */
export function cascade(d: Dims): THREE.Group {
  const lh = d.lh ?? 120, h1 = d.h1 ?? 30, h2 = d.h2 ?? 45, cf = d.cf ?? 15, pr = d.pr ?? 17.5, B = new Bucket(), g = grp();
  const y1 = lh - h1, y2 = y1 - h2, y3 = y2 - cf;
  const S = [pt(d, 's0'), pt(d, 's1'), pt(d, 's2'), pt(d, 's3')], D1 = pt(d, 'd1'), D2 = pt(d, 'd2'), D3 = pt(d, 'd3');
  const dir = (a: P2, b: P2): P2 => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; };
  const u1 = dir(D1, D2), u2 = dir(D2, D3), u3 = dir(D3, [0, 0]);
  const rock = (r: number, c: string, x: number, y: number, z: number, seed: number, sx = 1.3, sy = 0.8, sz = 1.1, det = 1) => B.add(lumpGeo(r, seed, sx, sy, sz, det), mat(c), x, y, z, hash(seed, 2) * 6);
  // 1. the stream across the ledge, rimed banks and stones
  const ledgeLine: [number, number, number][] = [...S, D1].map(([x, z]) => [x, lh + 0.12, z]);
  B.add(stripGeo(ledgeLine, 8), mat(C.water));
  B.add(stripGeo(ledgeLine.map(([x, y, z]) => [x, y + 0.02, z]), 2.2), mat(C.foam));
  for (let i = 0; i + 1 < ledgeLine.length; i++) {
    const [ax, , az] = ledgeLine[i], [bx, , bz] = ledgeLine[i + 1], L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L, m = Math.max(1, Math.round(L / 7));
    for (let k = 0; k < m; k++) for (const s of [-1, 1]) {
      const t = (k + hash(k, i + s)) / m, x = ax + (bx - ax) * t + nx * s * (4.8 + hash(k, i) * 1.5), z = az + (bz - az) * t + nz * s * (4.8 + hash(k, i + 1) * 1.5);
      rock(1.3 + hash(k * 3 + i, s + 5) * 1.6, k % 2 ? C.granite : C.wetRock, x, lh + 0.3, z, k * 5 + i * 50 + s);
      if (hash(k, i + s + 9) > 0.45) B.add(new THREE.BoxGeometry(2.4, 0.1, 1.3), mat(C.rime), x - nx * s * 1.4, lh + 0.14, z - nz * s * 1.4, Math.atan2(-(bz - az), bx - ax));
    }
  }
  // 2. the stepped rock in the cleft (top at y1) from behind the first drop out to the second drop's lip
  const strata = (from: P2, to: P2, top: (t: number) => number, w: number, seed: number) => {
    const L = Math.hypot(to[0] - from[0], to[1] - from[1]), u = dir(from, to), nx = -u[1], nz = u[0], m = Math.max(2, Math.round(L / 8)), ang = Math.atan2(-u[1], u[0]);
    for (let k = 0; k < m; k++) {
      const t = (k + 0.5) / m, cx = from[0] + (to[0] - from[0]) * t, cz = from[1] + (to[1] - from[1]) * t, tp = top(t), seg = L / m + 0.4;
      B.add(new THREE.BoxGeometry(seg, tp - 0.4, w - 3), mat(C.graniteDeep), cx, (tp - 0.4) / 2, cz, ang);
      // the flanks batter outward toward the foot (a buttress of the cliff, not a built wall): each course a little
      // wider than the one above, broken into blocks of uneven length
      for (const s of [-1, 1]) for (let y = 0, j = 0; y < tp - 0.5; j++) {
        const th = Math.min(tp - 0.4 - y, 5 + hash(j, seed + k) * 6), batter = (1 - (y + th / 2) / tp) * Math.min(8, tp * 0.16);
        const off = w / 2 - 1.5 + batter + (hash(k * 5 + j, seed + s) - 0.5) * 2.6, dep = 3 + batter * 2;
        const split = hash(k * 7 + j, seed + s + 2) > 0.55, c0 = [C.granite, C.graniteDeep, C.granitePale][(j + k + (s > 0 ? 1 : 0)) % 3];
        for (const [f, l] of (split ? [[-0.25, 0.5], [0.25, 0.5]] : [[0, 1]]) as [number, number][]) {
          const jog = split ? (hash(k + j, seed + f * 8) - 0.5) * 1.6 : 0;
          B.add(new THREE.BoxGeometry(seg * l + 0.3, th, dep), mat(f > 0 ? c0 : [C.granite, C.graniteDeep, C.talus][(j + k) % 3]), cx + u[0] * seg * f + nx * s * (off - dep / 2 + 1.5 + jog), y + th / 2, cz + u[1] * seg * f + nz * s * (off - dep / 2 + 1.5 + jog), ang + (hash(j, k + seed) - 0.5) * 0.06);
        }
        y += th;
      }
      // the talus apron at the foot of each flank
      for (const s of [-1, 1]) for (let q = 0; q < 2; q++) {
        const r = 2.6 + hash(k * 3 + q, seed + s + 9) * 2.8, o = w / 2 + Math.min(8, tp * 0.16) + 1 + q * 4 + hash(k, q + s) * 3, along = (hash(k * 2 + q, seed + 30 + s) - 0.5) * seg;
        rock(r, q ? C.talus : C.granite, cx + u[0] * along + nx * s * o, r * 0.3, cz + u[1] * along + nz * s * o, k * 40 + q * 7 + seed + (s > 0 ? 3 : 0), 1.3, 0.6, 1.1);
      }
    }
  };
  const back1: P2 = [D1[0] - u1[0] * 14, D1[1] - u1[1] * 14];
  strata(back1, D2, () => y1, d.wb ?? 30, 5);
  B.add(stripGeo([[D1[0], y1 + 0.1, D1[1]], [(D1[0] + D2[0]) / 2, y1 + 0.1, (D1[1] + D2[1]) / 2], [D2[0], y1 + 0.1, D2[1]]], 9), mat(C.water));
  B.add(stripGeo([[D1[0] + u1[0] * 3, y1 + 0.13, D1[1] + u1[1] * 3], [D2[0], y1 + 0.13, D2[1]]], 3), mat(C.foam));
  // the cleft's cheeks: rock rising either side of the step, highest against the headwall
  const n1x = -u1[1], n1z = u1[0], L1 = Math.hypot(D2[0] - back1[0], D2[1] - back1[1]);
  for (let k = 0; k < 8; k++) for (const s of [-1, 1]) {
    const t = (k + 0.5) / 8, cx = back1[0] + u1[0] * L1 * t + n1x * s * ((d.wb ?? 30) / 2 - 3), cz = back1[1] + u1[1] * L1 * t + n1z * s * ((d.wb ?? 30) / 2 - 3), hh = 6 + (1 - t) * 22;
    rock(4 + hash(k, s) * 1.5, k % 2 ? C.granite : C.graniteDeep, cx, y1 + hh * 0.35, cz, k * 9 + s + 300, 1.1, hh / 9, 1.1);
  }
  // 3. the chute: a rock rib from the second drop to the last, its top falling cf, the water racing in a groove of boulders
  const wc = d.wc ?? 34, back2: P2 = [D2[0] - u2[0] * 2, D2[1] - u2[1] * 2];
  strata(back2, D3, (t) => y2 - cf * t, wc, 17);
  const L2 = Math.hypot(D3[0] - D2[0], D3[1] - D2[1]), n2x = -u2[1], n2z = u2[0], groove: [number, number, number][] = [];
  for (let k = 0; k <= 10; k++) { const t = k / 10, w = Math.sin(t * 9) * 1.5; groove.push([D2[0] + u2[0] * L2 * t + n2x * w, y2 - cf * t + 0.15, D2[1] + u2[1] * L2 * t + n2z * w]); }
  B.add(stripGeo(groove, 9), mat(C.water));
  B.add(stripGeo(groove.map(([x, y, z], i) => [x + n2x * Math.sin(i * 2.1) * 1.4, y + 0.04, z + n2z * Math.sin(i * 2.1) * 1.4]), 3.4), mat(C.foam));
  for (let k = 0; k < 16; k++) {
    const t = (k + 0.5) / 16, s = k % 2 ? 1 : -1, off = (hash(k, 50) - 0.5) * 5, cx = D2[0] + u2[0] * L2 * t, cz = D2[1] + u2[1] * L2 * t, cy = y2 - cf * t;
    rock(1.6 + hash(k, 51) * 1.5, C.wetRock, cx + n2x * off, cy + 0.5, cz + n2z * off, k + 500, 1.2, 0.8, 1, 0);           // boulders in the race
    B.add(new THREE.BoxGeometry(2.6, 0.12, 2), mat(C.foam), cx + n2x * (off + 1.2), cy + 0.25, cz + n2z * (off + 1.2), hash(k, 52) * 3);
    // the banks: boulders heaped either side of the groove
    // the cheeks: two tiers of boulders either side make a slot the torrent races down, about 12 ft deep
    if (Math.abs((d.bt ?? -1) - t) < 0.06) continue;   // where the fallen pine lies across, the bridge's own piers stand
    const bo = 9 + hash(k, 53) * 3;
    rock(3.2 + hash(k, 54) * 1.6, k % 3 ? C.granite : C.talus, cx + n2x * s * bo, cy + 2.2, cz + n2z * s * bo, k + 600 + s, 1.25, 1.1, 1.1);
    rock(2.6 + hash(k, 55) * 1.4, C.graniteDeep, cx - n2x * s * (bo + 1), cy + 1.6, cz - n2z * s * (bo + 1), k + 700 + s, 1.2, 0.9, 1.1);
    for (const ss of [-1, 1]) rock(2.6 + hash(k, 56 + ss) * 1.2, (k + ss) % 3 ? C.granite : C.granitePale, cx + n2x * ss * (bo + 1.5), cy + 7.5, cz + n2z * ss * (bo + 1.5), k + 760 + ss, 1.25, 1.0, 1.1);
  }
  // the piers the fallen pine rests on: a tall block either side of the slot, rimed with spray
  if (d.bt !== undefined) {
    const cx = D2[0] + u2[0] * L2 * d.bt, cz = D2[1] + u2[1] * L2 * d.bt, cy = y2 - cf * d.bt;
    for (const s of [-1, 1]) {
      rock(4.4, s > 0 ? C.granite : C.graniteDeep, cx + n2x * s * 9.5, cy + 6.5, cz + n2z * s * 9.5, 950 + s, 1.0, 1.75, 1.05);
      B.add(new THREE.BoxGeometry(5, 0.12, 3), mat(C.rime), cx + n2x * s * 9.5, cy + 14.2, cz + n2z * s * 9.5, Math.atan2(-u2[1], u2[0]));
    }
  }
  // 4. the three drops (the kit's falls), spray at their feet
  const fall = (at: P2, u: P2, w: number, h: number, y: number) => { const f = waterfall({ w, h }); place(f, at[0] + u[0] * 0.6, y, at[1] + u[1] * 0.6, Math.atan2(u[0], u[1])); f.updateMatrixWorld(true); f.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh) { m.updateWorldMatrix(true, false); const geo = m.geometry.clone().applyMatrix4(m.matrixWorld); B.add(geo, m.material as THREE.Material); } }); };
  fall(D1, u1, 11, h1, y1); fall(D2, u2, 13, h2, y2); fall(D3, u3, 13, y3, 0);
  // the drop faces under the lips: wet black rock
  for (const [p, u, yb, h] of [[D1, u1, y1, h1], [D2, u2, y2, h2], [D3, u3, 0, y3]] as [P2, P2, number, number][]) B.add(new THREE.BoxGeometry(16, h - 0.4, 1.2), mat(C.wetRock), p[0] - u[0] * 0.2, yb + h / 2 - 0.2, p[1] - u[1] * 0.2, Math.atan2(-u[1], u[0]) + Math.PI / 2);
  // 5. ice: icicle fringes under the lips and on the shaded cheek, rime on the rocks the spray reaches
  const icicles = (x: number, y: number, z: number, along: P2, n: number, seed: number) => {
    for (let k = 0; k < n; k++) { const t = (k / Math.max(1, n - 1) - 0.5) * n * 0.9, len = 1.2 + hash(k, seed) * 4.2; B.add(new THREE.ConeGeometry(0.22 + hash(k, seed + 1) * 0.25, len, 5).rotateX(Math.PI), mat(k % 3 ? C.ice : C.rime), x + along[0] * t, y - len / 2, z + along[1] * t); }
  };
  icicles(D1[0] - u1[0] * 0.2 + n1x * 6, y1 + h1 - 0.6, D1[1] - u1[1] * 0.2 + n1z * 6, [n1x, n1z], 7, 1);
  icicles(D2[0] + n2x * 7.5, y2 + h2 - 0.8, D2[1] + n2z * 7.5, [n2x, n2z], 8, 2);
  icicles(D2[0] - n2x * 7.5, y2 + h2 * 0.55, D2[1] - n2z * 7.5, [n2x, n2z], 6, 3);
  for (let k = 0; k < 6; k++) { const t = (k + 0.5) / 6, cx = back1[0] + u1[0] * L1 * t + n1x * ((d.wb ?? 30) / 2 - 0.5), cz = back1[1] + u1[1] * L1 * t + n1z * ((d.wb ?? 30) / 2 - 0.5); icicles(cx, y1 - 2 - hash(k, 60) * 20, cz, u1, 5, 70 + k); }
  if (d.bt !== undefined) for (const s of [-1, 1]) icicles(D2[0] + u2[0] * L2 * d.bt + n2x * s * 6.4, y2 - cf * d.bt + 12, D2[1] + u2[1] * L2 * d.bt + n2z * s * 6.4, u2, 5, 90 + s);   // under the bridge's piers
  for (let k = 0; k < 14; k++) { const a = hash(k, 61) * Math.PI * 2, r = pr + 2 + hash(k, 62) * 6; B.add(new THREE.BoxGeometry(2 + hash(k, 63) * 3, 0.1, 1.2 + hash(k, 64) * 1.4), mat(C.rime), Math.cos(a) * r, 0.5 + hash(k, 65) * 0.6, Math.sin(a) * r, a); }
  // 6. the plunge pool: black glass water ringed with spray-wet boulders and rime, a lip to the outflow (+z)
  const disc = new THREE.CircleGeometry(pr, 24).rotateX(-Math.PI / 2); disc.translate(0, 0.07, 0); B.add(disc, glow(C.pool, 0.72));
  for (let k = 0; k < 22; k++) {
    const a = (k / 22) * Math.PI * 2 + hash(k, 70) * 0.2; if (Math.abs(Math.atan2(Math.sin(a - (d.outA ?? Math.PI / 2)), Math.cos(a - (d.outA ?? Math.PI / 2)))) < 0.32) continue;
    const r = 1.8 + hash(k, 71) * 1.8, rr = pr + 0.8 + hash(k, 72) * 1.2;
    rock(r, k % 3 ? C.wetRock : C.granite, Math.cos(a) * rr, r * 0.28, Math.sin(a) * rr, k + 800, 1.3, 0.62, 1.1);
    if (k % 2) B.add(new THREE.BoxGeometry(r * 1.6, 0.12, r * 0.9), mat(C.rime), Math.cos(a) * rr, r * 0.55 + 0.1, Math.sin(a) * rr, -a);
  }
  for (let k = 0; k < 9; k++) { const a = Math.PI * (1.05 + k * 0.1); B.add(new THREE.BoxGeometry(3.2, 0.08, 1.8), mat(C.ice), Math.cos(a) * (pr - 1.2), 0.1, Math.sin(a) * (pr - 1.2), -a + Math.PI / 2); }
  // spray drifting over the pool
  for (let k = 0; k < 5; k++) B.add(lumpGeo(3 + hash(k, 80) * 3, k + 900, 1.5, 0.5, 1.2, 1), fogMat(C.mist0, 0.32), -u3[0] * 6 + (hash(k, 81) - 0.5) * 14, 2 + hash(k, 82) * 6, -u3[1] * 6 + (hash(k, 83) - 0.5) * 14);
  return B.into(g);
}

/** White water racing down a steep step: `len` ft along local +z while falling `drop` ft (origin at the top), `w` wide,
 *  boulders breaking it and spray at the foot. */
export function rapids(d: Dims): THREE.Group {
  const L = d.len ?? 26, Dr = d.drop ?? 40, W = d.w ?? 8, B = new Bucket(), g = grp(), line: [number, number, number][] = [];
  for (let k = 0; k <= 12; k++) { const t = k / 12, y = -Dr * (t * t * (3 - 2 * t)); line.push([Math.sin(k * 1.7) * 1.2, y + 0.4, t * L]); }
  B.add(stripGeo(line, W), mat(C.water)); B.add(stripGeo(line.map(([x, y, z]) => [x * 0.6, y + 0.15, z]), W * 0.55), mat(C.foam));
  for (let k = 0; k < 10; k++) { const t = (k + 0.5) / 10, y = -Dr * (t * t * (3 - 2 * t)), s = k % 2 ? 1 : -1; B.add(lumpGeo(1.4 + hash(k, 1) * 1.6, k + 5, 1.2, 0.9, 1, 0), mat(k % 3 ? C.wetRock : C.granite), s * (W / 2 + 0.6 + hash(k, 2) * 1.5), y + 0.8, t * L); }
  for (let k = 0; k < 4; k++) B.add(lumpGeo(3 + hash(k, 3) * 3, k + 30, 1.5, 0.55, 1.2, 1), fogMat(C.mist0, 0.35), (hash(k, 4) - 0.5) * 8, -Dr + 2 + hash(k, 5) * 4, L + 2 + hash(k, 6) * 5);
  return B.into(g);
}

/** The still eye: a side-pool ten feet across walled with a neat ring of fitted stones, its surface a dull mirror. */
export function stillEye(d: Dims): THREE.Group {
  const r = d.r ?? 5, B = new Bucket(), g = grp();
  const disc = new THREE.CircleGeometry(r - 0.4, 20).rotateX(-Math.PI / 2); disc.translate(0, 0.35, 0); B.add(disc, mat(C.mirror, { surface: 'none' }));
  const n = 16;
  for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; B.add(new THREE.BoxGeometry(2.1, 1.1 + (k % 2) * 0.15, 1.1), mat(k % 3 ? C.fitted : C.granitePale), Math.cos(a) * (r + 0.2), 0.55, Math.sin(a) * (r + 0.2), -a + Math.PI / 2); }
  for (let k = 0; k < n; k++) { const a = ((k + 0.5) / n) * Math.PI * 2; B.add(new THREE.BoxGeometry(1.5, 0.5, 0.9), mat(C.fitted), Math.cos(a) * (r + 0.25), 1.3, Math.sin(a) * (r + 0.25), -a + Math.PI / 2); }
  return B.into(g);
}

// ---------------------------------------------------------------- the fog sea and the sky
/** The sea of mist below the shelf: thin ragged sheets over the drowned band of the map (hx0…hz1, local), billows
 *  along the foot of the step (e0…), and past the map a dense white floor out to `R` ft that hides the whole valley. */
export function fogSea(d: Dims): THREE.Group {
  const R = d.R ?? 22000, x0 = d.hx0 ?? -300, x1 = d.hx1 ?? 300, z0 = d.hz0 ?? -260, z1 = d.hz1 ?? 260, g = grp(), B = new Bucket();
  // past the map: the dense sea, holed where the map is so the band itself stays readable
  const outer = new THREE.Shape(); for (let k = 0; k <= 48; k++) { const a = (k / 48) * Math.PI * 2; if (k === 0) outer.moveTo(Math.cos(a) * R, Math.sin(a) * R); else outer.lineTo(Math.cos(a) * R, Math.sin(a) * R); }
  const hole = new THREE.Path(); hole.moveTo(x0, -z0); hole.lineTo(x0, -z1); hole.lineTo(x1, -z1); hole.lineTo(x1, -z0); hole.lineTo(x0, -z0); outer.holes.push(hole);
  const sea = new THREE.ShapeGeometry(outer, 2); sea.rotateX(-Math.PI / 2); B.add(sea, fogMat(C.mist0, 0.9, true), 0, -4, 0);
  const sea2 = new THREE.CircleGeometry(R * 0.5, 40).rotateX(-Math.PI / 2); B.add(sea2, fogMat(C.mist1, 0.22, true), 0, 4, 0);
  // over the band: ragged sheets the pine tops break through
  for (let k = 0; k < 3; k++) {
    const pts: P2[] = [], m = 18;
    for (let i = 0; i <= m; i++) pts.push([x0 - 60 + (i / m) * (x1 - x0 + 120), z0 - 8 - hash(i, k + 1) * 26]);
    for (let i = m; i >= 0; i--) pts.push([x0 - 60 + (i / m) * (x1 - x0 + 120), z1 + 60 + hash(i, k + 4) * 30]);
    B.add(flatGeo(pts, 0), fogMat(k % 2 ? C.mist1 : C.mist2, 0.16 + k * 0.03, true), 0, -2 + k * 4.5, 0);
  }
  // far off (gx, gz), the one thing breaking the white: a bald dark crown of a mountain, a few tufts of trees on it
  if (d.gx !== undefined) {
    const gx = d.gx, gz = d.gz ?? 0, gr = d.gr ?? 4200, gh = d.gh ?? 1100;
    const crown = new THREE.ConeGeometry(gr, gh + 300, 11, 3), pv = crown.attributes.position;
    for (let k = 0; k < pv.count; k++) { const y = pv.getY(k), f = 1 + (hash(k % 37, 3) - 0.5) * 0.18 * (1 - Math.abs(y) / (gh + 300)); pv.setXYZ(k, pv.getX(k) * f, y * (y > 0 ? 0.92 : 1), pv.getZ(k) * f); }
    crown.computeVertexNormals();
    B.add(crown, exm(C.ghakis), gx, (gh + 300) / 2 - 300, gz, 0.4);
    for (let k = 0; k < 9; k++) { const a = hash(k, 40) * Math.PI * 2, rr = gr * (0.25 + hash(k, 41) * 0.35), ty = gh * (1 - rr / gr) - 300; B.add(new THREE.ConeGeometry(160 + hash(k, 42) * 120, 260, 6), exm(C.krumDark), gx + Math.cos(a) * rr, ty, gz + Math.sin(a) * rr); }
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2, r = 900 + hash(k, 43) * 600; B.add(lumpGeo(r, k + 140, 1.6, 0.3, 1.2, 1), fogMat(C.mist0, 0.85, true), gx + Math.cos(a) * gr * 0.95, 30, gz + Math.sin(a) * gr * 0.95); }
  }
  // billows lapping at the foot of the step
  const E = polyOf(d, 'e');
  for (let i = 0; i + 1 < E.length; i++) {
    const [ax, az] = E[i], [bx, bz] = E[i + 1], L = Math.hypot(bx - ax, bz - az), m = Math.max(1, Math.round(L / 22));
    for (let k = 0; k < m; k++) { const t = (k + hash(k, i)) / m, r = 7 + hash(k, i + 7) * 7; B.add(lumpGeo(r, k + i * 20, 1.8, 0.45, 1.2, 1), fogMat(C.mist0, 0.34, true), ax + (bx - ax) * t, r * 0.25 + hash(k, i + 3) * 6, az + (bz - az) * t + 6 + hash(k, i + 2) * 14, hash(k, i) * 6); }
  }
  return B.into(g);
}

/** Thunderheads: a low deck of dark billows `len` × `d` (local), heaped highest in the middle, lit from within by a few
 *  pale flickers; nothing in its south-east quarter (`gap` 1), where the deck has torn. */
export function thunderhead(d: Dims): THREE.Group {
  const L = d.len ?? 1400, D = d.d ?? 500, n = d.n ?? 40, B = new Bucket(), g = grp();
  for (let i = 0; i < n; i++) {
    const x = (hash(i, 1) - 0.5) * L, z = (hash(i, 2) - 0.5) * D;
    if ((d.gap ?? 1) && x > L * 0.22 && z > 0) continue;
    const r = 45 + hash(i, 3) * 70, mid = 1 - Math.abs(x) / (L / 2);
    B.add(lumpGeo(r, i + 3, 1.6, 0.42 + mid * 0.2, 1.2, 1), exm(i % 3 ? C.cloud : C.cloudDeep), x, (hash(i, 4) - 0.3) * 40 + mid * 25, z, hash(i, 5) * 6);
    if (i % 4 === 0) B.add(lumpGeo(r * 0.7, i + 50, 1.5, 0.35, 1.2, 1), exm(C.cloudPale), x + 10, -r * 0.3, z + 10, hash(i, 6) * 6);
  }
  for (let i = 0; i < 6; i++) B.add(lumpGeo(14 + hash(i, 7) * 12, i + 90, 1.4, 0.5, 1.2, 1), glow(C.flicker, 0.22), (hash(i, 8) - 0.5) * L * 0.6, -18 + hash(i, 9) * 10, (hash(i, 10) - 0.5) * D * 0.5);
  return B.into(g);
}

/** Castle Ravenloft glimpsed far off through a tear in the cloud: a black pinnacle of rock crowned with walls and a
 *  thicket of spires (scale `s`, feet at s = 1 for a site about a mile off), standing up out of the fog. */
export function castleGlimpse(d: Dims): THREE.Group {
  const s = d.s ?? 1, B = new Bucket(), g = grp();
  B.add(lumpGeo(60 * s, 7, 1.3, 2.2, 1.1, 1), exm(C.castleRock), 0, 0, 0);
  B.add(new THREE.BoxGeometry(150 * s, 40 * s, 90 * s), exm(C.castleDeep), 0, 120 * s, 0);
  const spires: [number, number, number, number][] = [[-60, -30, 70, 9], [55, -28, 60, 8], [-50, 30, 55, 8], [60, 32, 62, 8], [0, 0, 120, 12], [-15, -35, 85, 7], [25, 20, 95, 9]];
  for (const [x, z, h, r] of spires) {
    B.add(new THREE.CylinderGeometry(r * s, r * 1.1 * s, h * s, 8), exm(C.castle), x * s, (140 + h / 2) * s, z * s);
    B.add(new THREE.ConeGeometry(r * 1.3 * s, h * 0.6 * s, 8), exm(C.castleDeep), x * s, (140 + h + h * 0.3) * s, z * s);
  }
  return B.into(g);
}

// ---------------------------------------------------------------- the set pieces on the shelf
/** A boulder struck by lightning again and again: one face (+z) fused into a branching scar of black glass. */
export function fulguriteBoulder(d: Dims): THREE.Group {
  const r = d.r ?? 4, sd = d.seed ?? 1, B = new Bucket(), g = grp();
  B.add(lumpGeo(r, sd, 1.25, 0.85, 1, 1), mat(C.granite), 0, r * 0.55, 0);
  B.add(lumpGeo(r * 0.9, sd + 4, 1.1, 0.5, 0.9, 1), mat(C.scorch), 0, r * 0.75, r * 0.12);
  // the scar: a trunk down the face and branches, glassy black, with a few glints
  const branch = (x: number, y: number, a: number, len: number, w: number, depth: number, seed: number) => {
    let px = x, py = y, ang = a;
    for (let k = 0; k < len; k++) {
      const seg = 0.9, nx = px + Math.cos(ang) * seg, ny = py + Math.sin(ang) * seg;
      B.add(new THREE.BoxGeometry(seg + 0.2, w, 0.4), mat(C.glass), (px + nx) / 2, (py + ny) / 2, r * 0.98, 0, 0, ang);
      if (k % 2 && depth < 2) branch(nx, ny, ang + (hash(k, seed) > 0.5 ? 0.7 : -0.7), Math.max(2, len - k - 2), w * 0.6, depth + 1, seed + k);
      px = nx; py = ny; ang += (hash(k, seed + 1) - 0.5) * 0.7;
    }
  };
  branch(0, r * 1.25, -Math.PI / 2, 5, 0.42, 0, sd * 7);
  for (let k = 0; k < 4; k++) B.add(new THREE.OctahedronGeometry(0.14, 0), glow(C.glint, 1), (hash(k, sd) - 0.5) * r, r * (0.5 + hash(k, sd + 1) * 0.6), r * 1.02);
  return B.into(g);
}

/** The bolt-shot pine: broken at chest height where a bolt blew through the trunk, a charred splintered shard still
 *  standing, the top half lying along local +x with its needles browned by the heat. */
export function boltShotPine(d: Dims): THREE.Group {
  const s = d.scale ?? 1.3, B = new Bucket(), g = grp();
  B.add(new THREE.CylinderGeometry(0.85 * s, 1.15 * s, 4.6 * s, 8), mat(C.bark), 0, 2.3 * s, 0);
  B.add(new THREE.CylinderGeometry(0.9 * s, 0.9 * s, 1.1 * s, 8), mat(C.char), 0, 4.6 * s, 0);
  // the shard and the splinters round the break
  B.add(new THREE.BoxGeometry(0.7 * s, 6 * s, 0.55 * s), mat(C.charBark), -0.45 * s, 7.6 * s, 0.3 * s, 0, 0, 0.06);
  for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2, h = (1 + hash(k, 1) * 2.2) * s; B.add(new THREE.ConeGeometry(0.2 * s, h, 4), mat(k % 2 ? C.blaze : C.char), Math.cos(a) * 0.65 * s, 5.1 * s + h / 2, Math.sin(a) * 0.65 * s, 0, (hash(k, 2) - 0.5) * 0.5, (hash(k, 3) - 0.5) * 0.5); }
  // roots
  for (let k = 0; k < 4; k++) { const a = k * 1.6 + 0.3; B.add(new THREE.BoxGeometry(2.4 * s, 0.6 * s, 0.7 * s), mat(C.bark), Math.cos(a) * 1.5 * s, 0.25, Math.sin(a) * 1.5 * s, -a, 0, 0.2); }
  // the fallen top: trunk along +x, scorched where it broke, browned tiers lying on their side
  const T0 = 3 * s, TL = 26 * s;
  B.add(new THREE.CylinderGeometry(0.35 * s, 0.85 * s, TL, 7), mat(C.bark), T0 + TL / 2, 1.2 * s, 0.4 * s, 0, 0, Math.PI / 2);
  B.add(new THREE.CylinderGeometry(0.88 * s, 0.88 * s, 1.2 * s, 7), mat(C.char), T0, 1.2 * s, 0.4 * s, 0, 0, Math.PI / 2);
  for (let i = 0; i < 4; i++) { const r = (5.6 - i * 1.2) * s, h = (6.5 - i * 0.6) * s, x = T0 + (8 + i * 4.6) * s; B.add(new THREE.ConeGeometry(r, h, 7), mat(i % 2 ? C.needleBrown : C.needleDead), x, r * 0.62, 0.4 * s, hash(i, 4), 0, -Math.PI / 2); }
  B.add(new THREE.ConeGeometry(1 * s, 3.5 * s, 5), mat(C.needleDead), T0 + TL + 0.8 * s, 1.1 * s, 0.4 * s, 0, 0, -Math.PI / 2);
  // scorch on the ground along the bolt's line (local -x/+x through the trunk), and charred needles
  B.add(new THREE.BoxGeometry(16 * s, 0.06, 3 * s), mat(C.scorch), 0, 0.05, 0, 0.35);
  return B.into(g);
}

/** A pine blasted off at the root, its stump charred black and its trunk thrown downhill along local +x. */
export function blastedStump(d: Dims): THREE.Group {
  const r = d.r ?? 1.3, len = d.len ?? 22, B = new Bucket(), g = grp();
  B.add(new THREE.CylinderGeometry(r * 0.9, r * 1.25, 2.4, 8), mat(C.char), 0, 1.2, 0);
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2, h = 0.8 + hash(k, len) * 1.8; B.add(new THREE.ConeGeometry(0.25, h, 4), mat(C.charBark), Math.cos(a) * r * 0.6, 2.4 + h / 2, Math.sin(a) * r * 0.6); }
  B.add(new THREE.CylinderGeometry(r * 2.4, r * 2.4, 0.06, 10), mat(C.scorch), 0, 0.04, 0);
  B.add(new THREE.CylinderGeometry(0.4, r * 0.9, len, 7), mat(C.charBark), 3 + len / 2, r * 0.8, 0.6, (hash(r, 1) - 0.5) * 0.3, 0, Math.PI / 2);
  B.add(new THREE.CylinderGeometry(r * 0.92, r * 0.92, 0.6, 7), mat(C.char), 3, r * 0.8, 0.6, 0, 0, Math.PI / 2);
  for (let k = 0; k < 4; k++) B.add(new THREE.BoxGeometry(0.25, 2.5 + hash(k, 2) * 2, 0.25), mat(C.char), 6 + k * len * 0.2, r * 1.4, 0.6 + (hash(k, 3) - 0.5) * 1.2, 0, (hash(k, 4) - 0.5) * 1.2, (hash(k, 5) - 0.5) * 1.4);
  return B.into(g);
}

/** The watcher effigy: lashed pine poles in the shape of a man, hung with a cloak's ragged lining, a bundle for a head
 *  under a cap of fish skulls, wards scratched across its chest. Faces local +z, down at the fog. */
export function watcherEffigy(): THREE.Group {
  const B = new Bucket(), g = grp();
  B.add(new THREE.CylinderGeometry(0.22, 0.28, 8.6, 6), mat(C.pole), 0, 4.3, 0);
  B.add(new THREE.CylinderGeometry(0.18, 0.18, 5.4, 6), mat(C.pole), 0, 5.6, 0, 0, 0, Math.PI / 2);
  for (const sx of [-1, 1]) { const p = new THREE.CylinderGeometry(0.15, 0.2, 4.2, 5); B.add(p, mat(C.pole), sx * 0.9, 1.8, -0.9, 0, 0.35, sx * 0.25); }   // the props behind
  for (const [x, y] of [[0, 5.6], [-2.3, 5.6], [2.3, 5.6]]) B.add(new THREE.TorusGeometry(0.3, 0.08, 4, 8), mat(C.lash), x, y, 0, 0, Math.PI / 2);
  // the lining: a ragged cape from the crossbar, front panels, a torn hem
  B.add(new THREE.BoxGeometry(4.8, 3.8, 0.15), mat(C.lining), 0, 3.75, -0.3);
  for (const sx of [-1, 1]) B.add(new THREE.BoxGeometry(1.5, 3.4, 0.15), mat(C.liningDark), sx * 1.15, 3.9, 0.25, sx * 0.12);
  for (let k = 0; k < 8; k++) B.add(new THREE.BoxGeometry(0.5, 0.6 + hash(k, 1) * 1.2, 0.12), mat(k % 2 ? C.lining : C.liningDark), -2.1 + k * 0.6, 1.6 - hash(k, 2) * 0.5, -0.3 + (k % 2) * 0.05);
  // the wards on its chest
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI; B.add(new THREE.BoxGeometry(0.9, 0.08, 0.04), mat(C.scratch), Math.cos(a) * 0.3, 4.6 + Math.sin(a) * 0.3, 0.36, 0, 0, a); }
  B.add(new THREE.TorusGeometry(0.55, 0.04, 3, 10), mat(C.scratch), 0, 4.6, 0.35);
  // the head: a bundle of rags, the cap of fish skulls round it
  B.add(lumpGeo(0.75, 3, 1, 1.1, 0.9, 1), mat(C.liningDark), 0, 8.2, 0);
  for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; B.add(lumpGeo(0.32, k + 9, 1.4, 0.7, 0.8, 0), mat(C.bone), Math.cos(a) * 0.62, 8.85, Math.sin(a) * 0.62, -a); }
  B.add(lumpGeo(0.36, 21, 1.5, 0.7, 0.8, 0), mat(C.bone), 0, 9.35, 0);
  // stones heaped round the foot
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; B.add(lumpGeo(0.6, k + 30, 1.2, 0.7, 1, 0), mat(C.talus), Math.cos(a) * 0.9, 0.3, Math.sin(a) * 0.9); }
  return B.into(g);
}

/** Krummholz: a knee-high mat of wind-flattened dwarf pine `r` ft across, combed downslope toward local +z. */
export function krummholz(d: Dims): THREE.Group {
  const r = d.r ?? 4, sd = d.seed ?? 1, B = new Bucket(), g = grp();
  for (let k = 0; k < 4; k++) { const rr = r * (0.55 + hash(k, sd) * 0.35), x = (hash(k, sd + 1) - 0.5) * r, z = (hash(k, sd + 2) - 0.2) * r; B.add(lumpGeo(rr, k + sd * 5, 1.15, 0.32, 1.35, 1), mat(k % 2 ? C.krum : C.krumDark), x, rr * 0.22 + (k ? 0.1 : 0.4), z, hash(k, sd + 3) * 0.5, 0.18); }
  for (let k = 0; k < 3; k++) B.add(new THREE.BoxGeometry(0.25, 0.25, r * 0.8), mat(C.deadwoodDark), (hash(k, sd + 4) - 0.5) * r, 0.25, (hash(k, sd + 5) - 0.5) * r * 0.6, (hash(k, sd + 6) - 0.5) * 0.6);
  return B.into(g);
}

/** The elk bed: a hollow pressed into the krummholz the size of a large animal, hair caught in the twigs, and under
 *  it a few black threads of wool. */
export function elkBed(): THREE.Group {
  const B = new Bucket(), g = grp();
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; B.add(lumpGeo(1.4, k + 3, 1.3, 0.45, 1, 1), mat(k % 2 ? C.krum : C.krumDark), Math.cos(a) * 4.6, 0.45, Math.sin(a) * 2.9); }
  const bed = new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2); bed.scale(4.1, 1, 2.5); B.add(bed, mat(C.hollow), 0, 0.1, 0);
  for (let k = 0; k < 9; k++) B.add(new THREE.BoxGeometry(0.5, 0.08, 0.2), mat(C.elkHair), (hash(k, 1) - 0.5) * 6, 0.16, (hash(k, 2) - 0.5) * 3.6, hash(k, 3) * 3);
  for (let k = 0; k < 4; k++) B.add(new THREE.BoxGeometry(0.9, 0.05, 0.06), mat(C.robe), (hash(k, 4) - 0.5) * 3, 0.15, (hash(k, 5) - 0.5) * 2, hash(k, 6) * 3);
  return B.into(g);
}

/** The scree: a fan of loose grey stone from its apex (origin) spilling `len` ft toward local +z, `w` wide at its foot,
 *  the stones growing toward the foot; and the house-sized blocks: block a (bax, baz, bar°) is the leaning pair (a
 *  25-ft slab propped on a smaller one over a dry slot), b and c (bbx, bbz, bbs…) lie alone. */
export function scree(d: Dims): THREE.Group {
  const L = d.len ?? 180, W = d.w ?? 170, n = d.n ?? 260, B = new Bucket(), g = grp(), COL = [C.talus, C.granite, C.granitePale, C.graniteDeep];
  for (let i = 0; i < n; i++) {
    const t = Math.sqrt(hash(i, 1)), z = t * L, x = (hash(i, 2) - 0.5) * W * (0.12 + 0.88 * t), r = 0.45 + t * (0.6 + hash(i, 3) * 1.4) + (hash(i, 4) > 0.94 ? 1.5 : 0);
    B.add(lumpGeo(r, i, 1.2, 0.55, 1, 0), mat(COL[i % 4]), x, r * 0.22, z, hash(i, 5) * 6);
  }
  // the leaning pair
  if (d.bax !== undefined) {
    const ax = d.bax, az = d.baz ?? 0, ar = ((d.bar ?? 0) * Math.PI) / 180, c = Math.cos(ar), s = Math.sin(ar);
    const at = (lx: number, lz: number): P2 => [ax + lx * c + lz * s, az - lx * s + lz * c];
    const [px, pz] = at(-9, 0); B.add(lumpGeo(6.5, 41, 1.1, 1.0, 1.0, 1), mat(C.graniteDeep), px, 5.5, pz, ar);                     // the prop
    const [qx, qz] = at(5, 0); const slab = new THREE.BoxGeometry(11, 25, 16, 2, 3, 2), pv = slab.attributes.position;
    for (let k = 0; k < pv.count; k++) pv.setXYZ(k, pv.getX(k) * (0.9 + hash(k, 42) * 0.2), pv.getY(k), pv.getZ(k) * (0.9 + hash(k, 43) * 0.2));
    B.add(slab, mat(C.granite), qx, 11.5, qz, ar, 0, 0.42);                                                                       // leaning over toward -x
    for (let k = 0; k < 4; k++) { const [rx, rz] = at(-2 + k * 3, 8 + hash(k, 44) * 3); B.add(lumpGeo(1.4 + hash(k, 45), k + 46, 1.2, 0.6, 1, 0), mat(C.talus), rx, 0.5, rz); }
  }
  for (const k of ['b', 'c', 'd']) {
    if (d[k + 'bx'] === undefined) continue;
    const s = d[k + 'bs'] ?? 12; B.add(lumpGeo(s / 2, k.charCodeAt(0), 1.3, 0.85, 1.05, 1), mat(k === 'c' ? C.granitePale : C.granite), d[k + 'bx'], s * 0.36, d[k + 'bz'] ?? 0, hash(s, 7) * 6);
    B.add(lumpGeo(s * 0.18, k.charCodeAt(0) + 9, 1.3, 0.6, 1, 0), mat(C.talus), d[k + 'bx'] + s * 0.5, 0.6, (d[k + 'bz'] ?? 0) + s * 0.35);
  }
  return B.into(g);
}

/** Old snow lying in the shade: a dirty, hard-packed drift `w` × `d`, a line of bare footprints and a line of
 *  hoofprints crossing it each way, never together (`prints` 0: a plain drift). */
export function snowPatch(d: Dims): THREE.Group {
  const W = d.w ?? 30, D = d.d ?? 18, B = new Bucket(), g = grp();
  const pts: P2[] = []; for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2, rk = 0.75 + hash(k, 1) * 0.3; pts.push([Math.cos(a) * W / 2 * rk, Math.sin(a) * D / 2 * rk]); }
  const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z))), geo = new THREE.ExtrudeGeometry(sh, { depth: 0.9, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
  B.add(geo, mat(C.snowDirty), 0, 0, 0);
  B.add(flatGeo(pts.map(([x, z]) => [x * 0.8, z * 0.7] as P2), 0.93), mat(C.snow));
  if (d.prints === 0) return B.into(g);   // a plain drift
  for (let k = 0; k < 9; k++) { const t = (k / 8 - 0.5) * W * 0.8, side = k % 2 ? 0.45 : -0.45; B.add(new THREE.BoxGeometry(0.9, 0.06, 0.4), mat(C.print), t, 0.97, -D * 0.12 + side, 0.15); }
  for (let k = 0; k < 7; k++) { const t = (k / 6 - 0.5) * W * 0.75; for (const s of [-0.22, 0.22]) B.add(new THREE.BoxGeometry(0.32, 0.06, 0.26), mat(C.print), t + 0.3, 0.97, D * 0.16 + s, -0.2); }
  return B.into(g);
}

/** A flat slab under the cliff scratched over and over with pale warding sigils, the newest cut across the oldest. */
export function sigilRock(): THREE.Group {
  const B = new Bucket(), g = grp();
  B.add(lumpGeo(4.2, 5, 1.35, 0.32, 1, 1), mat(C.granitePale), 0, 0.9, 0);
  const top = 1.92;
  for (let k = 0; k < 5; k++) {
    const cx = -2.6 + (k % 3) * 2.6 + (hash(k, 1) - 0.5), cz = -1.2 + Math.floor(k / 3) * 2.4;
    B.add(new THREE.TorusGeometry(0.75, 0.06, 3, 12), mat(C.scratch), cx, top, cz, 0, Math.PI / 2);
    for (let j = 0; j < 3; j++) { const a = (j / 3) * Math.PI + hash(k, j) * 0.4; B.add(new THREE.BoxGeometry(1.8, 0.05, 0.08), mat(C.scratch), cx, top + 0.01, cz, a); }
  }
  for (let k = 0; k < 10; k++) B.add(new THREE.BoxGeometry(1 + hash(k, 3) * 2.2, 0.05, 0.07), mat(C.scratch), (hash(k, 4) - 0.5) * 7, top + 0.02, (hash(k, 5) - 0.5) * 4.2, hash(k, 6) * 3);
  return B.into(g);
}

/** A flat stone the size of two hands, one crooked ward scratched in it: a route marker. */
export function wardStone(): THREE.Group {
  const B = new Bucket(), g = grp();
  B.add(lumpGeo(0.95, 2, 1.3, 0.3, 1, 0), mat(C.granitePale), 0, 0.22, 0);
  B.add(new THREE.TorusGeometry(0.42, 0.04, 3, 8), mat(C.scratch), 0, 0.5, 0, 0, Math.PI / 2);
  B.add(new THREE.BoxGeometry(1, 0.04, 0.07), mat(C.scratch), 0, 0.52, 0, 0.6);
  return B.into(g);
}

/** The fish midden: a cold ring of blackened stones, a heap of charred bones and lake-trout skulls, some spines fused
 *  into glass; a bent tin cup; a scrap of black robe snagged on a rock beside it. */
export function fishMidden(): THREE.Group {
  const B = new Bucket(), g = grp();
  for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; B.add(lumpGeo(0.6, k, 1.2, 0.7, 1, 0), mat(k % 2 ? C.char : C.scorch), Math.cos(a) * 2, 0.32, Math.sin(a) * 2); }
  B.add(new THREE.CylinderGeometry(1.6, 1.7, 0.12, 9), mat(C.ash), 0, 0.06, 0);
  B.add(lumpGeo(1.6, 3, 1.3, 0.35, 1.1, 1), mat(C.boneDark), 3.8, 0.25, 0.8);
  for (let k = 0; k < 16; k++) { const a = hash(k, 1) * Math.PI * 2, r = 0.5 + hash(k, 2) * 2.4; B.add(new THREE.BoxGeometry(0.9, 0.1, 0.12), mat(k % 3 ? C.bone : C.boneDark), 3.8 + Math.cos(a) * r, 0.55 + hash(k, 3) * 0.25, 0.8 + Math.sin(a) * r, a); }
  for (let k = 0; k < 5; k++) B.add(lumpGeo(0.32, k + 20, 1.5, 0.7, 0.8, 0), mat(C.bone), 3.2 + hash(k, 4) * 2, 0.7, 0.2 + hash(k, 5) * 1.6, hash(k, 6) * 3);
  for (let k = 0; k < 3; k++) B.add(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 4), mat(C.glass), 2.4 + k * 0.9, 0.45, 2.3 - k * 0.4, hash(k, 7) * 3, 0, Math.PI / 2);
  // the cup, bent and on its side
  B.add(new THREE.CylinderGeometry(0.28, 0.24, 0.55, 8), mat(C.tin), -2.9, 0.28, 1.4, 0.4, 0, Math.PI / 2 - 0.2);
  // the snagged scrap on its rock
  B.add(lumpGeo(1.1, 9, 1.2, 0.8, 1, 0), mat(C.talus), -3.2, 0.7, -1.8);
  B.add(new THREE.BoxGeometry(1.4, 0.06, 0.9), mat(C.robe), -3.0, 1.55, -1.8, 0.4, 0.2, 0.3);
  B.add(new THREE.BoxGeometry(0.5, 1.1, 0.06), mat(C.robe), -2.4, 1.0, -1.4, 0.4, 0, 0.1);
  return B.into(g);
}

/** A dead pine lying across a gap, `len` ft along local x: bark long gone, weathered silver, glazed with ice, a few
 *  branch stubs, resting on its root plate (−x) and its broken top (+x). `tilt` (deg) lifts the +x end. */
export function logBridge(d: Dims): THREE.Group {
  const L = d.len ?? 40, r = d.r ?? 1.4, B = new Bucket(), g = grp();
  B.add(new THREE.CylinderGeometry(r * 0.7, r, L, 9), mat(C.deadwood), 0, 0, 0, 0, 0, Math.PI / 2);
  for (let k = 0; k < 5; k++) B.add(new THREE.BoxGeometry(L * 0.14, 0.06, r * 0.9), mat(C.ice), -L / 2 + (k + 0.6) * L / 5.2, r * 0.9, (hash(k, 1) - 0.5) * 0.4);
  for (let k = 0; k < 7; k++) { const x = -L / 2 + (k + 0.7) * L / 7.5; B.add(new THREE.BoxGeometry(0.3, 1.4 + hash(k, 2) * 1.6, 0.3), mat(C.deadwoodDark), x, (hash(k, 3) > 0.5 ? 1 : -1) * r * 0.9, (hash(k, 4) - 0.5) * r * 1.6, 0, (hash(k, 5) - 0.5) * 1.2, (hash(k, 6) - 0.5) * 1.2); }
  // the root plate, torn up with its stones
  B.add(new THREE.CylinderGeometry(r * 3, r * 3, 0.8, 9), mat(C.hollow), -L / 2 - 0.3, 0, 0, 0, 0, Math.PI / 2);
  for (let k = 0; k < 4; k++) B.add(lumpGeo(0.6, k, 1.2, 0.8, 1, 0), mat(C.talus), -L / 2 - 0.6, (hash(k, 7) - 0.5) * r * 4, (hash(k, 8) - 0.5) * r * 4);
  g.rotation.z = ((d.tilt ?? 0) * Math.PI) / 180;
  return B.into(g);
}

/** A trapper's steel jaw-trap, rusted solid and never sprung, half under pine needles, chained to a stake. */
export function wolfTrap(): THREE.Group {
  const B = new Bucket(), g = grp();
  B.add(new THREE.CylinderGeometry(2.2, 2.4, 0.1, 10), mat(C.needleBrown), 0, 0.05, 0);
  B.add(new THREE.BoxGeometry(0.8, 0.12, 0.8), mat(C.trapDark), 0, 0.2, 0);
  for (const s of [-1, 1]) { const jaw = new THREE.TorusGeometry(0.85, 0.07, 3, 10, Math.PI); B.add(jaw, mat(C.trap), 0, 0.22, s * 0.05, 0, s * 1.2, 0); }
  for (let k = 0; k < 7; k++) B.add(new THREE.ConeGeometry(0.05, 0.22, 3), mat(C.trap), -0.75 + k * 0.25, 0.32, 0.6, 0, 0, 0);
  for (const s of [-1, 1]) B.add(new THREE.BoxGeometry(1.4, 0.09, 0.22), mat(C.trapDark), s * 1.3, 0.18, 0);
  for (let k = 0; k < 6; k++) B.add(new THREE.TorusGeometry(0.12, 0.03, 3, 6), mat(C.rust), 1.6 + k * 0.22, 0.1, 0.6 + k * 0.12, 0, Math.PI / 2 * (k % 2), 0);
  B.add(new THREE.CylinderGeometry(0.08, 0.06, 0.9, 4), mat(C.deadwoodDark), 3, 0.35, 1.4);
  for (let k = 0; k < 12; k++) B.add(new THREE.BoxGeometry(0.6, 0.04, 0.05), mat(C.needleDead), (hash(k, 1) - 0.5) * 3, 0.32, (hash(k, 2) - 0.5) * 3, hash(k, 3) * 3);
  return B.into(g);
}

/** A pine with the last pale axe-blaze of a trapper's line cut in its trunk (facing local +z). */
export function blazedPine(d: Dims): THREE.Group {
  const g = pine(d), sc = d.scale ?? 1;
  g.add(place(new THREE.Mesh(new THREE.BoxGeometry(0.8 * sc, 1.3 * sc, 0.2), mat(C.blaze)), 0, 4.6 * sc, 0.62 * sc, 0, -0.05));
  g.add(place(new THREE.Mesh(new THREE.BoxGeometry(0.6 * sc, 0.7 * sc, 0.2), mat(C.blaze)), 0.1, 6.1 * sc, 0.6 * sc, 0, -0.05));
  return g;
}

// ---------------------------------------------------------------- figures
/** The faithful hound: a big spectral watchdog sitting alert, pale and see-through (faces local +x). */
export function faithfulHound(d: Dims): THREE.Group {
  const s = (d.scale ?? 1) * 1.35, m = fogMat(C.hound, 0.55), m2 = fogMat(C.houndDeep, 0.6), g = grp();
  const add = (geo: THREE.BufferGeometry, mm: THREE.Material, x: number, y: number, z: number, rz = 0) => g.add(place(new THREE.Mesh(geo, mm), x * s, y * s, z * s, 0, 0, rz));
  add(lumpGeo(1, 3, 1.25, 1.1, 0.8, 1), m, -0.4, 2.0, 0, 0.6);              // haunches and chest, sitting up
  add(lumpGeo(0.85, 5, 1, 1.2, 0.85, 1), m, 0.6, 2.9, 0);
  add(new THREE.BoxGeometry(1.0, 0.85, 0.8), m, 1.25, 3.95, 0);              // head
  add(new THREE.BoxGeometry(0.75, 0.45, 0.5), m2, 1.85, 3.8, 0);             // muzzle
  for (const z of [-0.3, 0.3]) { add(new THREE.ConeGeometry(0.16, 0.5, 4), m2, 1.05, 4.55, z); add(new THREE.CylinderGeometry(0.16, 0.12, 2.2, 5), m, 0.8, 1.1, z); add(new THREE.BoxGeometry(1.2, 0.5, 0.36), m2, -0.6, 0.35, z * 1.6); }
  add(new THREE.ConeGeometry(0.2, 1.4, 4), m2, -1.5, 1.0, 0, 2.2);
  for (const z of [-0.22, 0.22]) g.add(place(new THREE.Mesh(new THREE.OctahedronGeometry(0.09 * s, 0), glow('#e9f0ff', 1)), 1.72 * s, 4.1 * s, z * s));
  return g;
}

Object.assign(PROPS_V1, {
  'm-bench': bench, 'm-slabs': slabs, 'm-headwall': headwall, 'm-spur': spur, 'm-cascade': cascade, 'm-rapids': rapids, 'm-still-eye': stillEye, 'm-fog-sea': fogSea,
  'm-thunderhead': thunderhead, 'm-castle-glimpse': castleGlimpse, 'm-fulgurite-boulder': fulguriteBoulder, 'm-bolt-shot-pine': boltShotPine,
  'm-blasted-stump': blastedStump, 'm-watcher-effigy': watcherEffigy, 'm-krummholz': krummholz, 'm-elk-bed': elkBed, 'm-scree': scree,
  'm-snow-patch': snowPatch, 'm-sigil-rock': sigilRock, 'm-ward-stone': wardStone, 'm-fish-midden': fishMidden, 'm-log-bridge': logBridge,
  'm-wolf-trap': wolfTrap, 'm-blazed-pine': blazedPine,
} as Record<string, (d: Dims) => THREE.Object3D>);
Object.assign(CREATURES, { 'm-faithful-hound': (d) => faithfulHound(d) } as Record<string, (d: Dims) => THREE.Group>);
