// The world stage: one campaign's whole valley as a 3-D place the maps stand in (the continuous world). It owns, under
// World.root and in absolute world feet (W, core/frames.ts):
//  - the land (render/worldland.ts): the region's heightfield with every placed map's footprint baked in, aprons,
//    roads, rivers, lakes, the crags;
//  - the proxies (render/worldproxies.ts): each place's massing at true scale while its map is not loaded;
//  - the forest: one instanced pool of pines scattered per one-mile tile round the camera's target;
//  - the sky's bodies and the place labels, and the party's marker on the road.
// Maps themselves hang from World.root at their atlas placement (placeRoot), or under their parent map (placeChild).
import * as THREE from 'three';
import type { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Campaign, WorldData } from '../campaigns';
import type { Atlas, AtlasScene } from '../../../scripts/world-atlas';
import ATLAS_JSON from '../../../manifests/world-atlas.json';
import { MI_FT, mapDist, rootPlacement, rotate, worldOfMiles, type Bounds, type Placement } from '../core/frames';
import type { Vec2 } from '../core/geometry';
import { merge } from '../kit/pieces';
import { pineTier } from '../kit/props';
import { patchFog, setSurface } from './materials';
import { buildLand, vertexLambert, type Land, type LandSite } from './worldland';
import { buildSky, siteMassing, type ProxySite } from './worldproxies';
import type { World } from './world';

/** Where every built map stands (scripts/world-atlas.ts → manifests/world-atlas.json). */
export const ATLAS = ATLAS_JSON as unknown as Atlas;

/** Forest: pines per one-mile tile, at most; the pool covers the 3 × 3 tiles round the camera's target. */
const TILE_FT = MI_FT, PER_TILE = 1333, POOL = 12000, CANDIDATES = 2600;
/** Above this camera distance the forest goes (the land's own forest colour carries the woods). */
const FOREST_MAX_DIST = 25000;
/** Road rides through the wood: a mask of cells this size along every road. */
const MASK_FT = 50;

/** A placed root's footprint and base in W, from its atlas entry. */
export function siteOf(e: AtlasScene): LandSite {
  const [px, py, pz] = e.placement.position, th = e.placement.rotationY, base = py + e.elevationFt;
  return {
    path: e.path, key: e.pin ?? e.location, bounds: e.worldBounds!, base, crag: !!e.crag, clearingFt: e.clearingFt ?? 0,
    // the land beside a map high in the mountains is snow (Tsolenka, the Amber Temple, Mount Baratok)
    ground: base > 3500 ? 'snow' : 'grass',
    exits: e.roadExits.map((x) => { const [wx, wz] = rotate(th, [x.x, x.z]); return { road: x.road, x: wx + px, z: wz + pz }; }),
  };
}

export class WorldStage {
  /** Everything the stage draws; a child of World.root, so it is drawn round the floating origin. */
  readonly root = new THREE.Group();
  readonly land: Land;
  readonly sites: LandSite[];
  /** Proxy groups by path (`path@key` for a pin that repeats another pin's map): each stands at its pin and marks
   *  where the place is; their massing is drawn by two shared meshes (lit and glowing), in which each place owns a run
   *  of faces that collapses while the place is hidden, so the whole valley's places cost two draws. */
  readonly proxies = new Map<string, THREE.Group>();
  private proxyMeshes: { mesh: THREE.Mesh; ranges: Map<string, { start: number; count: number; saved?: Float32Array }> }[] = [];
  readonly forest: THREE.InstancedMesh;
  private sky: ReturnType<typeof buildSky>;
  private labels: { obj: CSS2DObject; key: string; pri: number }[] = [];
  private party: CSS2DObject;
  private roadMask: { m: Uint8Array; nx: number; nz: number; x0: number; z0: number };
  private tiles = new Map<string, { m: Float32Array; c: Float32Array; n: number }>();
  private tileKey = '';
  private declutterQ = 0;
  /** Milliseconds the stage took to build (the HUD shows it). */
  readonly buildMs: number;

  constructor(readonly world: World, readonly campaign: Campaign, readonly data: WorldData) {
    const t0 = performance.now();
    this.root.name = 'world-stage';
    this.root.userData.role = 'stage';
    const roots = Object.values(ATLAS.scenes).filter((e) => e.campaign === campaign.id && e.depth === 0 && !e.orphan && e.pin && e.worldBounds);
    this.sites = roots.map(siteOf);
    this.land = buildLand(data, this.sites, campaign.theme);
    this.root.add(this.land.group);
    // proxies and place labels: every pin with a map; a pin that only repeats another's map gets a proxy and a label only
    const field = this.land.field, labels = new THREE.Group(); labels.name = 'place-labels';
    const parts: Record<'massing' | 'glow', { id: string; geo: THREE.BufferGeometry }[]> = { massing: [], glow: [] };
    for (const pin of ATLAS.pins.filter((p) => p.campaign === campaign.id && p.scenes.length)) {
      const e = pin.root ? ATLAS.scenes[pin.root] : undefined;
      const [x, z] = pin.world;
      const site: ProxySite = e
        ? { id: e.path, key: pin.key, name: pin.name, type: pin.type, x, z, y: e.placement.position[1] + e.elevationFt, bounds: e.worldBounds!, rotationY: e.placement.rotationY, centre: e.centre }
        : { id: `${pin.scenes[0]}@${pin.key}`, key: pin.key, name: pin.name, type: pin.type, x, z, y: field.height(x, z), bounds: { minX: x - 60, minZ: z - 60, maxX: x + 60, maxZ: z + 60 }, rotationY: 0, centre: [0, 0] };
      const g = siteMassing(site, field);
      g.updateMatrix();
      for (const m of [...g.children]) if ((m as THREE.Mesh).isMesh && (m.name === 'massing' || m.name === 'glow')) {
        parts[m.name as 'massing' | 'glow'].push({ id: site.id, geo: (m as THREE.Mesh).geometry.applyMatrix4(g.matrix) });
        ((m as THREE.Mesh).material as THREE.Material).dispose(); m.removeFromParent();
      }
      this.proxies.set(site.id, g); this.root.add(g);
      const lb = world.label(`${pin.key} · ${pin.name}`, undefined, 'place');
      lb.position.set(x, site.y + 60, z); lb.userData.role = 'stage'; lb.element.dataset.key = pin.key;
      labels.add(lb); this.labels.push({ obj: lb, key: pin.key, pri: /settlement|castle/.test(pin.type) ? 0 : pin.root ? 1 : 2 });
    }
    for (const [name, list] of Object.entries(parts)) if (list.length) {
      const total = list.reduce((a, p) => a + p.geo.attributes.position.count, 0), P = new Float32Array(total * 3), N = new Float32Array(total * 3), C = new Float32Array(total * 3);
      const ranges = new Map<string, { start: number; count: number }>(); let o = 0;
      for (const { id, geo } of list) { const n = geo.attributes.position.count; P.set(geo.attributes.position.array as Float32Array, o * 3); N.set(geo.attributes.normal.array as Float32Array, o * 3); C.set(geo.attributes.color.array as Float32Array, o * 3); ranges.set(id, { start: o, count: n }); o += n; geo.dispose(); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3)); geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, name === 'glow' ? new THREE.MeshBasicMaterial({ vertexColors: true, fog: true }) : vertexLambert());
      mesh.name = `proxies-${name}`; mesh.userData.role = 'stage'; mesh.matrixAutoUpdate = false;
      this.root.add(mesh); this.proxyMeshes.push({ mesh, ranges });
    }
    this.root.add(labels);
    this.party = world.label('&', undefined, 'world-party'); this.party.visible = false; this.root.add(this.party);
    // the forest pool
    const tree = merge([pineTier(6.2, 16, 6, 0).translate(0, 12, 0), pineTier(3.8, 14, 6, 1).translate(0, 21, 0)]);
    const fm = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true, fog: true }); setSurface(fm, 'foliage'); patchFog(fm, true);
    this.forest = new THREE.InstancedMesh(tree, fm, POOL); this.forest.name = 'forest'; this.forest.count = 0; this.forest.frustumCulled = false;
    this.forest.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(POOL * 3), 3);
    this.forest.userData.role = 'stage';
    this.root.add(this.forest);
    this.roadMask = this.maskRoads();
    this.sky = buildSky(); this.root.add(this.sky.node);
    world.beforeRender.add(this.followSky);
    this.buildMs = performance.now() - t0;
  }

  // ------------------------------------------------------------------ queries

  /** The ground's top in W at an absolute point (feet): what the drawn land or apron is there. */
  groundAt(x: number, z: number): number { return this.land.field.surface(x, z); }
  /** The region's extent in W. */
  get bounds(): Bounds {
    const b = this.data.bounds, [x0, z0] = worldOfMiles(this.data, [b.minX, b.minY]), [x1, z1] = worldOfMiles(this.data, [b.maxX, b.maxY]);
    return { minX: x0, minZ: z0, maxX: x1, maxZ: z1 };
  }

  // ------------------------------------------------------------------ placing maps

  /** Where a root map stands, computed afresh from its pin and footprint (frames.rootPlacement; the atlas keeps the
   *  same numbers rounded to 1e-6). */
  rootPlacementOf(entry: AtlasScene): Placement {
    const pin = this.data.pins.find((p) => p.key === entry.pin);
    return pin ? rootPlacement({ north: entry.north, elevationFt: entry.elevationFt, bbox: entry.bbox }, pin, this.data) : entry.placement;
  }
  /** Stand a root map at its pin: its open-air level's centre on the pin, its floor on the ground, turned to world north. */
  placeRoot(loaded: { root: THREE.Object3D }, entry: AtlasScene): void {
    const p = this.rootPlacementOf(entry), [x, y, z] = p.position;
    loaded.root.position.set(x, y, z); loaded.root.rotation.set(0, p.rotationY, 0);
    if (loaded.root.parent !== this.root.parent) this.root.parent?.add(loaded.root);
    loaded.root.updateMatrixWorld(true);
  }
  /** Hang a child map under its parent at the room that opens it (the atlas's placement is in the parent's frame). */
  placeChild(loaded: { root: THREE.Object3D }, entry: AtlasScene, parent: { root: THREE.Object3D }): void {
    const [x, y, z] = entry.placement.position;
    loaded.root.position.set(x, y, z); loaded.root.rotation.set(0, entry.placement.rotationY, 0);
    parent.root.add(loaded.root); loaded.root.updateMatrixWorld(true);
  }
  /** Show or hide a place's proxy (hidden while its map is drawn): its run of faces collapses onto one point, or comes back. */
  showProxy(path: string, on: boolean): void {
    const g = this.proxies.get(path); if (!g || g.visible === on) return;
    g.visible = on;
    for (const { mesh, ranges } of this.proxyMeshes) {
      const r = ranges.get(path); if (!r) continue;
      const pos = mesh.geometry.attributes.position as THREE.BufferAttribute, a = pos.array as Float32Array, s = r.start * 3, e = (r.start + r.count) * 3;
      if (!on) { r.saved = a.slice(s, e); for (let i = s; i < e; i += 3) { a[i] = a[s]; a[i + 1] = a[s + 1]; a[i + 2] = a[s + 2]; } }
      else if (r.saved) { a.set(r.saved, s); r.saved = undefined; }
      pos.clearUpdateRanges(); pos.addUpdateRange(s, e - s); pos.needsUpdate = true;
    }
    this.world.invalidate();
  }
  /** Exactly these maps are drawn: their proxies go, every other root's proxy shows. */
  setResident(paths: Set<string>): void { for (const id of this.proxies.keys()) if (!id.includes('@')) this.showProxy(id, !paths.has(id)); }

  /** Frame the whole valley (the camera's widest view). */
  frameWorld(animate = false): void {
    const b = this.bounds, a = this.world.anchor, f = this.land.field;
    const y = f.height((b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2);
    this.world.frame({ minX: b.minX - a.x, minZ: b.minZ - a.z, maxX: b.maxX - a.x, maxZ: b.maxZ - a.z }, y - a.y, 'tabletop', animate);
  }

  // ------------------------------------------------------------------ the view

  /** The camera moved: the forest pool follows the target, labels follow the reveals. */
  onView(o: { restricted: boolean; revealed: Set<string> }): void {
    const w = this.world, tgt = w.toAbsolute(w.controls.target), dist = w.camera.position.distanceTo(w.controls.target);
    this.forest.visible = dist < FOREST_MAX_DIST;
    if (this.forest.visible) this.fillForest(tgt.x, tgt.z);
    for (const l of this.labels) l.obj.visible = !o.restricted || o.revealed.has(l.key);
    this.declutter();
  }
  /** Before every render: the sky's bodies stand round the eye (absolute), however far it has moved. */
  private followSky = (): void => {
    if (!this.root.visible) return;
    const w = this.world; this.sky.follow(w.toAbsolute(w.camera.position), w.camera.position.distanceTo(w.controls.target));
  };
  /** The moon in its phase and the bodies on their arcs (the clock). */
  setMoon(phase: number, night: boolean, hour: number): void { this.sky.setMoon(phase, night, hour); }
  /** The party's marker on the land (W), when the party is not on a map that is drawn. */
  setParty(at: Vec2 | null): void {
    this.party.visible = !!at;
    if (at) this.party.position.set(at[0], this.land.field.surface(at[0], at[1]) + 12, at[1]);
  }

  /** Place labels never pile up: in order of importance, any that would overlap one already placed waits. */
  private declutter(): void {
    if (this.declutterQ) return;
    this.declutterQ = requestAnimationFrame(() => requestAnimationFrame(() => {
      this.declutterQ = 0;
      const live = this.labels.filter((l) => l.obj.visible && l.obj.element.style.display !== 'none').sort((a, b) => a.pri - b.pri);
      for (const l of live) l.obj.element.classList.remove('declutter');
      const placed: DOMRect[] = [];
      for (const l of live) {
        const r = l.obj.element.getBoundingClientRect(); if (!r.width) continue;
        if (placed.some((p) => r.left < p.right + 2 && r.right > p.left - 2 && r.top < p.bottom + 1 && r.bottom > p.top - 1)) { l.obj.element.classList.add('declutter'); continue; }
        placed.push(r);
      }
    }));
  }

  // ------------------------------------------------------------------ the forest pool

  /** A grid over the region marking cells a road runs through (with their neighbours): rides through the wood. */
  private maskRoads(): WorldStage['roadMask'] {
    const b = this.bounds, nx = Math.ceil((b.maxX - b.minX) / MASK_FT) + 1, nz = Math.ceil((b.maxZ - b.minZ) / MASK_FT) + 1, m = new Uint8Array(nx * nz);
    const mark = (x: number, z: number) => {
      const i = Math.floor((x - b.minX) / MASK_FT), k = Math.floor((z - b.minZ) / MASK_FT);
      for (let dk = -1; dk <= 1; dk++) for (let di = -1; di <= 1; di++) { const ii = i + di, kk = k + dk; if (ii >= 0 && kk >= 0 && ii < nx && kk < nz) m[kk * nx + ii] = 1; }
    };
    for (const r of [...this.land.paths.roads, ...this.land.paths.rivers]) for (let j = 0; j + 1 < r.pts.length; j++) {
      const [ax, az] = r.pts[j], [bx, bz] = r.pts[j + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / (MASK_FT / 2)));
      for (let k = 0; k <= n; k++) mark(ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n);
    }
    return { m, nx, nz, x0: b.minX, z0: b.minZ };
  }
  private onRoad(x: number, z: number): boolean {
    const r = this.roadMask, i = Math.floor((x - r.x0) / MASK_FT), k = Math.floor((z - r.z0) / MASK_FT);
    return i >= 0 && k >= 0 && i < r.nx && k < r.nz && r.m[k * r.nx + i] === 1;
  }
  /** One tile's pines, deterministic (seeded by the tile): where the land is forest, off the roads, the water, the
   *  mountains and every map's felled ground. */
  private tile(tx: number, tz: number): { m: Float32Array; c: Float32Array; n: number } {
    const key = `${tx},${tz}`, hit = this.tiles.get(key); if (hit) return hit;
    const f = this.land.field, t = f.terrain, b = this.bounds, T = this.campaign.theme;
    let seed = ((tx * 73856093) ^ (tz * 19349663)) >>> 0; seed = (seed % 2147483646) + 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const m = new Float32Array(PER_TILE * 16), c = new Float32Array(PER_TILE * 3), M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const cols = [new THREE.Color(T.forest[0]), new THREE.Color(T.forest[1])];
    let n = 0;
    for (let i = 0; i < CANDIDATES && n < PER_TILE; i++) {
      const x = (tx + rnd()) * TILE_FT, z = (tz + rnd()) * TILE_FT, r0 = rnd(), r1 = rnd(), r2 = rnd(), r3 = rnd();
      if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
      if (this.onRoad(x, z) || f.lakeAt(x, z) >= 0) continue;
      if (this.sites.some((st) => mapDist(st.bounds, x, z) < Math.max(30, st.clearingFt))) continue;
      if (t.hasCover) { const [mx, my] = f.miles(x, z); if (t.cover('w', mx, my) > 0.3 || t.cover('m', mx, my) > 0.6 || t.cover('f', mx, my) < 0.4 + r0 * 0.3) continue; }
      else if (r0 < 0.65) continue;
      const k = 1.25 * (0.75 + r1 * 0.7);
      p.set(x, f.surface(x, z) - 1, z); q.setFromAxisAngle(up, r2 * Math.PI * 2); s.set(k, k * (0.9 + r3 * 0.4), k);
      M.compose(p, q, s).toArray(m, n * 16);
      cols[i % 3 ? 0 : 1].toArray(c, n * 3);
      n++;
    }
    const out = { m, c, n };
    this.tiles.set(key, out);
    if (this.tiles.size > 64) this.tiles.delete(this.tiles.keys().next().value!); // the oldest tile goes
    return out;
  }
  /** Refill the pool from the 3 × 3 tiles round a target (one upload), when the target crosses a tile edge. */
  private fillForest(x: number, z: number): void {
    const tx = Math.floor(x / TILE_FT), tz = Math.floor(z / TILE_FT), key = `${tx},${tz}`;
    if (key === this.tileKey) return;
    this.tileKey = key;
    const mat = this.forest.instanceMatrix.array as Float32Array, col = this.forest.instanceColor!.array as Float32Array;
    let n = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const t = this.tile(tx + dx, tz + dz), k = Math.min(t.n, POOL - n);
      mat.set(t.m.subarray(0, k * 16), n * 16); col.set(t.c.subarray(0, k * 3), n * 3); n += k;
    }
    this.forest.count = n;
    this.forest.instanceMatrix.needsUpdate = true; this.forest.instanceColor!.needsUpdate = true;
    this.world.invalidate();
  }

  // ------------------------------------------------------------------ bookkeeping

  /** What the HUD shows. */
  stats(): { tris: number; proxies: number; shown: number; forest: number; tiles: number; buildMs: number } {
    let tris = 0;
    this.land.group.traverse((o) => { const g = (o as THREE.Mesh).geometry; if (g) tris += (g.index ? g.index.count : g.attributes.position.count) / 3; });
    return { tris: Math.round(tris), proxies: this.proxies.size, shown: [...this.proxies.values()].filter((g) => g.visible).length, forest: this.forest.visible ? this.forest.count : 0, tiles: this.tiles.size, buildMs: Math.round(this.buildMs) };
  }
  /** Take the stage out of the world and free what it holds on the GPU and in the page. */
  dispose(): void {
    if (this.declutterQ) cancelAnimationFrame(this.declutterQ);
    this.root.removeFromParent();
    this.world.beforeRender.delete(this.followSky);
    for (const l of [...this.labels.map((x) => x.obj), this.party]) { l.removeFromParent(); l.element.remove(); }
    this.sky.dispose();
    this.root.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      m.geometry.dispose();
      for (const mt of Array.isArray(m.material) ? m.material : [m.material]) mt.dispose(); // the crag mist's texture is shared (backdrop's), and stays
    });
    this.tiles.clear();
  }
}
