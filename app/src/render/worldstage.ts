// The world stage: one campaign's whole valley as a 3-D place the maps stand in (the continuous world). It owns, under
// World.root and in absolute world feet (W, core/frames.ts):
//  - the land (render/worldland.ts): the region's heightfield with every placed map's footprint baked in, aprons,
//    roads, rivers, lakes, the crags;
//  - the proxies (render/worldproxies.ts): each place's massing at true scale while its map is not loaded;
//  - the forest: one instanced pool of pines scattered per one-mile tile round the camera's target;
//  - the sky's bodies and the place labels, and the party's marker on the road;
//  - the inked map (render/worldcarto.ts, worldletters.ts, worldglyphs.ts): from high up the same land is drawn as a
//    hand-inked D&D map of the region, and gives way to the 3-D world as the camera comes down.
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
import { buildDetail } from './proxydetail';
import { GHOST_TINT } from './ghost';
import type { Massing } from '../../../scripts/world-massing';
import type { World } from './world';
import { CARTO_STYLES, bakeLand, buildInk, cartoBands, cartoUniforms, liveCarto, patchCarto, setWash, type CartoStyleId, type CartoUniforms } from './worldcarto';
import { CartoLetters } from './worldletters';
import { glyphKind, glyphSvg } from './worldglyphs';

/** The world map's view: straight down, north up (a hair south of vertical, so the heading is defined). */
const TOP_DOWN = new THREE.Vector3(0, 1, 0.002).normalize();

/** Where every built map stands (scripts/world-atlas.ts → manifests/world-atlas.json). */
export const ATLAS = ATLAS_JSON as unknown as Atlas;

/** Forest: pines per one-mile tile, at most; the pool covers the 3 × 3 tiles round the camera's target. */
const TILE_FT = MI_FT, PER_TILE = 1333, POOL = 12000, CANDIDATES = 2600;
/** A device that says it has under 4 GB (navigator.deviceMemory: Chrome, Android) gets half the forest. */
const lowMemory = (): boolean => { const m = (globalThis.navigator as { deviceMemory?: number } | undefined)?.deviceMemory; return m !== undefined && m < 4; };
/** Above this camera distance the forest goes (the land's own forest colour carries the woods). */
const FOREST_MAX_DIST = 25000;
/** A place's detailed proxy (its map's own massing, render/proxydetail.ts) is drawn once it is this many pixels
 *  across per atlas unit on screen, and its plain massing again under the second figure; one not wanted for this long
 *  is freed. */
export const DETAIL = { showPx: 24, keepPx: 14, sliceMs: 6, forgetMs: 30000 };
/** The massing digest, read once (a chunk of its own: only the continuous world needs it). */
let massingLoad: Promise<Massing | null> | undefined;
const loadMassing = (): Promise<Massing | null> => (massingLoad ??= import('../../../manifests/world-massing.json').then((m) => m.default as unknown as Massing, () => { massingLoad = undefined; return null; }));
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
  /** Residency handles by path (`path@key` for a repeated map). Their visibility records the map/proxy handover.
   *  Geographic sites have empty handles only; built places own face runs in two shared massing meshes (lit and
   *  glowing), which collapse while hidden, so the whole valley's places cost two draws. */
  readonly proxies = new Map<string, THREE.Group>();
  private proxyMeshes: { mesh: THREE.Mesh; ranges: Map<string, { start: number; count: number; saved?: Float32Array }> }[] = [];
  readonly forest: THREE.InstancedMesh;
  private sky: ReturnType<typeof buildSky>;
  /** Place labels (key: the pin's) and the land's own names (key ''; at: where they stand, miles; text). */
  private labels: { obj: CSS2DObject; key: string; pri: number; at?: Vec2; text?: string }[] = [];
  private placeLabels = new THREE.Group();
  /** Drawable proxies only: their pin controls audience visibility and eligibility for fine massing. Geographic
   *  residency handles have no geometry to reveal and never enter this map. */
  private proxyKey = new Map<string, string>();
  /** Proxies kept from the players' side: their place is not revealed (and the view is the players'). */
  private secret = new Set<string>();
  /** The valley is put away (a legacy map is open): its names leave the page; the label renderer puts them back the
   *  next time the valley is drawn. */
  detachLabels(): void { for (const l of [...this.labels.map((x) => x.obj), this.party]) l.element.remove(); }
  private party: CSS2DObject;
  private roadMask: { m: Uint8Array; nx: number; nz: number; x0: number; z0: number };
  private tiles = new Map<string, { m: Float32Array; c: Float32Array; n: number }>();
  private tileKey = '';
  private declutterQ = 0;
  /** Pines a tile holds at most, and the pool (halved on a low-memory device). */
  readonly perTile: number;
  /** The inked map crossed half strength (the party's & shows over its token from there out): the app re-places it. */
  onCartoHalf: (() => void) | null = null;
  /** A place label was tapped (the DM's): fly there and open its map. */
  onPick: ((path: string) => void) | null = null;
  /** Milliseconds the stage took to build (the HUD shows it). */
  readonly buildMs: number;

  constructor(readonly world: World, readonly campaign: Campaign, readonly data: WorldData) {
    const t0 = performance.now();
    this.perTile = lowMemory() ? Math.floor(PER_TILE / 2) : PER_TILE;
    this.root.name = 'world-stage';
    this.root.userData.role = 'stage';
    const roots = Object.values(ATLAS.scenes).filter((e) => e.campaign === campaign.id && e.depth === 0 && !e.orphan && e.pin && e.worldBounds);
    this.sites = roots.map(siteOf);
    this.land = buildLand(data, this.sites, campaign.theme);
    this.root.add(this.land.group);
    // Every mapped pin has a residency handle; only built places have massing. Repeated maps have no resident scene.
    const field = this.land.field, labels = this.placeLabels; labels.name = 'place-labels';
    const parts: Record<'massing' | 'glow', { id: string; geo: THREE.BufferGeometry }[]> = { massing: [], glow: [] };
    // Every keyed place keeps its marker, including mountain marks with no battle map.
    for (const pin of ATLAS.pins.filter((p) => p.campaign === campaign.id)) {
      const e = pin.root ? ATLAS.scenes[pin.root] : undefined, wp = data.pins.find((q) => q.key === pin.key);
      const [x, z] = pin.world;
      let y = field.height(x, z);
      if (pin.scenes.length) {
        const site: ProxySite = e
          ? { id: e.path, key: pin.key, name: pin.name, type: pin.type, x, z, y: e.placement.position[1] + e.elevationFt, bounds: e.worldBounds!, rotationY: e.placement.rotationY, centre: e.centre }
          : { id: `${pin.scenes[0]}@${pin.key}`, key: pin.key, name: pin.name, type: pin.type, x, z, y, bounds: { minX: x - 60, minZ: z - 60, maxX: x + 60, maxZ: z + 60 }, rotationY: 0, centre: [0, 0] };
        y = site.y;
        const geographic = ['lake', 'river', 'road', 'peak'].includes(pin.type);
        const g = geographic ? new THREE.Group() : siteMassing(site, field);
        if (geographic) { g.name = `site:${site.id}`; g.position.set(site.x, site.y, site.z); g.userData.role = 'stage'; }
        else this.proxyKey.set(site.id, pin.key);
        g.updateMatrix();
        for (const m of [...g.children]) if ((m as THREE.Mesh).isMesh && (m.name === 'massing' || m.name === 'glow')) {
          parts[m.name as 'massing' | 'glow'].push({ id: site.id, geo: (m as THREE.Mesh).geometry.applyMatrix4(g.matrix) });
          ((m as THREE.Mesh).material as THREE.Material).dispose(); m.removeFromParent();
        }
        this.proxies.set(site.id, g); this.root.add(g);
      }
      // A place's label, two ways in one element: the app's chip (key · name) close in, and the inked map's pin from
      // high up (its symbol, a keyed disc and the name in the map's lettering), cross-faded by the map's strength
      // (styles.css, --carto). The key and the name apart: where the full name has no room, the key alone marks the
      // place (declutter).
      const lb = world.label('', undefined, `place t-${pin.type}${pin.scenes.length ? ' has-scene' : ''}`);
      const chip = document.createElement('span'), kb = document.createElement('b'), nm = document.createElement('em');
      chip.className = 'chip'; kb.textContent = pin.key; nm.textContent = ` · ${pin.name}`; chip.append(kb, nm);
      const mark = document.createElement('span'); mark.className = 'mark';
      mark.innerHTML = `${glyphSvg(glyphKind({ type: pin.type, name: pin.name, heightFt: wp?.heightFt }))}<span class="pd"><b class="pk"></b><span class="pn"></span></span>`;
      mark.querySelector('.pk')!.textContent = discKey(pin.key); mark.querySelector('.pn')!.textContent = pin.name;
      lb.element.append(chip, mark);
      lb.position.set(x, y + 60, z); lb.userData.role = 'stage'; lb.element.dataset.key = pin.key; lb.element.dataset.name = pin.name;
      // a tap on the name flies there and opens the place's map (a pin that repeats another's opens that map). The
      // name takes no pointer itself (a wheel or a pinch over it zooms like anywhere else): the app's tap and hover
      // on the canvas ask labelAt.
      if (pin.scenes.length) {
        const go = pin.root ?? pin.scenes[0];
        lb.element.dataset.path = go; lb.element.dataset.tip = pin.name; lb.element.dataset.tipSub = 'Fly there and open its map';
      }
      labels.add(lb); this.labels.push({ obj: lb, key: pin.key, pri: /settlement|castle/.test(pin.type) ? 0 : pin.scenes.length ? 1 : 2, at: pin.pos as Vec2, text: pin.name });
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
    this.party.element.dataset.tip = 'The party';
    // the party's trail (its last moves, dashed on the land): an overlay over the canvas, under the names, on both screens
    this.trailEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.trailEl.setAttribute('class', 'nesttrail'); this.trailEl.innerHTML = '<path d=""/>';
    (world.renderer.domElement.parentElement ?? document.body).insertBefore(this.trailEl, world.labelRenderer.domElement);
    // the forest pool
    const tree = merge([pineTier(6.2, 16, 6, 0).translate(0, 12, 0), pineTier(3.8, 14, 6, 1).translate(0, 21, 0)]);
    const fm = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true, fog: true }); setSurface(fm, 'foliage'); patchFog(fm, true);
    fm.alphaHash = true; // the pines thin out (dithered, depth-writing, no sorting) as the inked map comes in
    this.forest = new THREE.InstancedMesh(tree, fm, lowMemory() ? POOL / 2 : POOL); this.forest.name = 'forest'; this.forest.count = 0; this.forest.frustumCulled = false;
    this.forest.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.forest.instanceMatrix.count * 3), 3);
    this.forest.userData.role = 'stage';
    this.root.add(this.forest);
    this.roadMask = this.maskRoads();
    this.sky = buildSky(); this.root.add(this.sky.node);
    // the inked map: the land and the lakes paint it, massing turns to ink blocks, roads and rivers are ink ribbons;
    // the 3-D partners (ribbons, pines, the crags' mist) fade out by dithering as it comes in
    {
      const style: CartoStyleId = campaign.theme.id === 'pastoral' ? 'pastoral' : 'gothic', u = cartoUniforms(field, CARTO_STYLES[style]);
      this.land.group.traverse((o) => {
        const m = o as THREE.Mesh; if (!m.isMesh) return;
        const mt = m.material as THREE.Material;
        if (m.name === 'land' || m.name === 'aprons' || m.name === 'lakes') this.cartoMats.push(patchCarto(mt, u, style));
        else if (m.name === 'ribbons') mt.alphaHash = true;
        else if (m.name === 'crag-mist') m.userData.baseOpacity = (mt as THREE.MeshBasicMaterial).opacity;
      });
      // (the massing, the crags and the detailed proxies are washed toward the map's ink and paper exactly as the maps
      // are, materials.ts uCartoWash: a place's proxy and its map look the same at the hand-over)
      const ink = buildInk(field, u); ink.visible = false; this.root.add(ink);
      const letters = new CartoLetters(world, data, field, style);
      this.root.add(letters.group);
      for (const l of letters.labels) this.labels.push(l);
      this.carto = { u, style, k: 0, fit: 0, ftPerPx: 0, ready: false, bakeMs: 0, ink, letters, textures: [] };
      // the land is baked for the map once it is first wanted (the camera climbing toward it, the World map button),
      // in idle slices (the page never stalls); the map stays off until then
      this.bake = () => { if (this.bakeJob || this.carto.ready) return; this.bakeJob = bakeLand(field, u); this.pumpBake(); };
    }
    world.beforeRender.add(this.followSky);
    this.buildMs = performance.now() - t0;
  }

  /** The inked map (render/worldcarto.ts): its uniforms, how far it is drawn now (k), the view's ground width over the
   *  region's (fit), feet per CSS pixel at the target, whether the land's bake is in, what the bake cost. */
  readonly carto: { u: CartoUniforms; style: CartoStyleId; k: number; fit: number; ftPerPx: number; ready: boolean; bakeMs: number; ink: THREE.Mesh; letters: CartoLetters; textures: THREE.Texture[] };
  /** The land's materials that paint the map (their programs take its code once the camera first climbs toward it). */
  private cartoMats: THREE.Material[] = [];
  private bakeJob?: Generator<void, { land: THREE.DataTexture; cover: THREE.DataTexture; ms: number }>;
  private bakeWaiters: (() => void)[] = [];
  /** Start the land's bake for the inked map (once). */
  private bake: () => void = () => {};
  /** Resolves once the land is baked for the inked map (starting the bake if it has not started). */
  cartoReady(): Promise<void> { if (this.carto.ready) return Promise.resolve(); this.bake(); return new Promise((r) => this.bakeWaiters.push(r)); }
  /** The bake runs in idle slices of at most 8 ms (a frame apart where the browser has no idle callback), so it never
   *  holds up a frame or a tap. */
  private pumpBake(): void {
    const idle = (globalThis as { requestIdleCallback?: (f: (d: { timeRemaining(): number }) => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const later = (f: (d?: { timeRemaining(): number }) => void) => { if (idle) idle(f, { timeout: 250 }); else setTimeout(f, 16); };
    const step = (d?: { timeRemaining(): number }): void => {
      const job = this.bakeJob; if (!job || this.disposed) return;
      const t0 = performance.now(), budget = Math.max(2, Math.min(8, d ? d.timeRemaining() : 8));
      let r: IteratorResult<void, { land: THREE.DataTexture; cover: THREE.DataTexture; ms: number }>;
      do r = job.next(); while (!r.done && performance.now() - t0 < budget);
      if (!r.done) { later(step); return; }
      this.bakeJob = undefined;
      this.carto.textures = [r.value.land, r.value.cover]; this.carto.bakeMs = r.value.ms; this.carto.ready = true;
      this.world.invalidate();
      for (const w of this.bakeWaiters.splice(0)) w();
    };
    later(step);
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
  /** Show or hide a place's proxy (hidden while its map is drawn): its run of faces collapses onto one point, or comes
   *  back (or its detailed proxy shows instead, near enough). */
  showProxy(path: string, on: boolean): void {
    const g = this.proxies.get(path); if (!g) return;
    g.userData.want = on;
    this.applyProxy(path);
  }
  /** A proxy shows while it is wanted (its map not drawn) and its place is not kept from the players' side. */
  private applyProxy(path: string): void {
    const g = this.proxies.get(path); if (!g) return;
    const on = g.userData.want !== false && !this.secret.has(path);
    if (g.visible === on) return;
    g.visible = on;
    this.syncProxy(path);
  }
  /** A place's plain massing shows while its proxy does and its detailed one is not drawn. */
  private syncProxy(path: string): void {
    const g = this.proxies.get(path); if (!g) return;
    const d = this.details.get(path), detail = !!d?.mesh && d.want && this.carto.k < 0.95;
    if (d?.mesh) d.mesh.visible = detail;
    const on = g.visible && !detail;
    for (const { mesh, ranges } of this.proxyMeshes) {
      const r = ranges.get(path); if (!r || on === !r.saved) continue;
      const pos = mesh.geometry.attributes.position as THREE.BufferAttribute, a = pos.array as Float32Array, s = r.start * 3, e = (r.start + r.count) * 3;
      if (!on) { r.saved = a.slice(s, e); for (let i = s; i < e; i += 3) { a[i] = a[s]; a[i + 1] = a[s + 1]; a[i + 2] = a[s + 2]; } }
      else { a.set(r.saved!, s); r.saved = undefined; }
      pos.clearUpdateRanges(); pos.addUpdateRange(s, e - s); pos.needsUpdate = true;
    }
    this.world.invalidate();
  }

  // ------------------------------------------------------------------ detailed proxies

  /** Detailed proxies by path: built once wanted, drawn while wanted (and the place's proxy shows). */
  private details = new Map<string, { mesh?: THREE.Mesh; want: boolean; lastWanted: number }>();
  private detailJob?: { path: string; it: Generator<void, THREE.BufferGeometry | null> };
  private detailRaf = 0;
  private disposed = false;
  /** The streamer's measure of a place this tick (footprint pixels per atlas unit; 0 out of view or lost in the mist):
   *  its detailed proxy is drawn from DETAIL.showPx (built the first time), the plain massing again under keepPx. */
  viewDetail(path: string, px: number, now = performance.now()): void {
    if (!this.proxyKey.has(path) || path.includes('@') || this.disposed) return;
    let d = this.details.get(path);
    const want = this.carto.k < 0.95 && px >= (d?.want ? DETAIL.keepPx : DETAIL.showPx);
    if (!d) { if (!want) return; d = { want: false, lastWanted: now }; this.details.set(path, d); }
    if (want) d.lastWanted = now;
    if (d.want !== want) { d.want = want; this.syncProxy(path); }
    if (want && !d.mesh) this.pumpDetails();
    if (!want && now - d.lastWanted > DETAIL.forgetMs) {
      if (d.mesh) { d.mesh.removeFromParent(); d.mesh.geometry.dispose(); (d.mesh.material as THREE.Material).dispose(); }
      if (this.detailJob?.path === path) this.detailJob = undefined;
      this.details.delete(path); this.syncProxy(path);
    }
  }
  /** Which places have a detailed proxy built, and which of them is drawn (tests and the HUD). */
  detailState(): Record<string, { built: boolean; drawn: boolean }> {
    return Object.fromEntries([...this.details].map(([p, d]) => [p, { built: !!d.mesh, drawn: !!d.mesh?.visible && !!this.proxies.get(p)?.visible }]));
  }
  /** Build the wanted detailed proxies, one at a time, a few milliseconds a frame. */
  private pumpDetails(): void {
    if (this.detailRaf || this.disposed) return;
    this.detailRaf = requestAnimationFrame(() => {
      this.detailRaf = 0;
      void loadMassing().then((m) => {
        if (!m || this.disposed) return;
        if (!this.detailJob) {
          const next = [...this.details].filter(([, d]) => d.want && !d.mesh).sort((a, b) => b[1].lastWanted - a[1].lastWanted)[0]?.[0];
          const site = next ? m.sites[next] : undefined;
          if (!next) return;
          if (!site) { this.details.delete(next); this.pumpDetails(); return; } // (Castle Ravenloft keeps its own)
          this.detailJob = { path: next, it: buildDetail(site, m.lines, m.wallMaterials, new THREE.Color(this.world.theme.mist), GHOST_TINT) };
        }
        const job = this.detailJob, t0 = performance.now();
        let r: IteratorResult<void, THREE.BufferGeometry | null>;
        do r = job.it.next(); while (!r.done && performance.now() - t0 < DETAIL.sliceMs);
        if (r.done) {
          this.detailJob = undefined;
          const d = this.details.get(job.path), g = this.proxies.get(job.path), e = ATLAS.scenes[job.path];
          if (d && g && e && r.value) {
            const mesh = new THREE.Mesh(r.value, vertexLambert()), p = this.rootPlacementOf(e);
            mesh.name = 'detail'; mesh.userData.role = 'stage'; mesh.visible = false;
            mesh.position.set(p.position[0] - g.position.x, p.position[1] - g.position.y, p.position[2] - g.position.z); mesh.rotation.y = p.rotationY;
            g.add(mesh); mesh.updateMatrixWorld(true);
            d.mesh = mesh; this.syncProxy(job.path);
          } else r.value?.dispose();
        }
        if ([...this.details.values()].some((d) => d.want && !d.mesh)) this.pumpDetails();
      });
    });
  }
  /** Exactly these maps are drawn: their proxies go, every other root's proxy shows. */
  setResident(paths: Set<string>): void { for (const id of this.proxies.keys()) if (!id.includes('@')) this.showProxy(id, !paths.has(id)); }

  /** How far the camera stands to see the whole valley at this screen's shape (see fit). */
  fitDistance(): number { return this.fit().dist; }
  /** The view the whole valley fits: the region's edges (at the land's height), its peaks and its places all inside
   *  the screen less the bars along its edges (the top bar, the camera buttons, the side slider), from the camera's
   *  present heading and tilt. The target is moved so the valley sits in the middle of that clear part, not of the
   *  screen. Projected, not a bounding sphere: a portrait phone fits the valley's width, a wide screen its depth. */
  fit(look?: THREE.Vector3, topInset = 0): { target: THREE.Vector3; dist: number } {
    const w = this.world, c = this.valleyCentre(), a = w.anchor, f = this.land.field, b = this.bounds;
    const host = w.renderer.domElement.getBoundingClientRect(), W = host.width || 1, H = host.height || 1;
    // the clear part of the view (canvas pixels): each bar trims the edge it runs along (wider than tall: the top or
    // the bottom; else a side)
    let l = 0, t = 0, r = W, btm = H;
    for (const q of w.chrome().bars) {
      const x0 = q.left - host.left, x1 = q.right - host.left, y0 = q.top - host.top, y1 = q.bottom - host.top;
      if (x1 <= 0 || y1 <= 0 || x0 >= W || y0 >= H) continue;
      if (q.width >= q.height) { if (y0 < H - y1) t = Math.max(t, y1); else btm = Math.min(btm, y0); }
      else if (x0 < W - x1) l = Math.max(l, x1); else r = Math.min(r, x0);
    }
    t = Math.max(t, topInset - host.top);
    if (r - l < W * 0.4 || btm - t < H * 0.4) { l = 0; t = 0; r = W; btm = H; } // never squeeze the valley into a sliver
    const pad = 10; l += pad; t += pad; r -= pad; btm -= pad;
    // what must show: the region's edge, every peak, every place
    const pts: THREE.Vector3[] = [], at = (x: number, z: number) => pts.push(new THREE.Vector3(x - a.x, f.height(x, z) - a.y, z - a.z));
    for (let k = 0; k <= 12; k++) { const u = k / 12, x = b.minX + (b.maxX - b.minX) * u, z = b.minZ + (b.maxZ - b.minZ) * u; at(x, b.minZ); at(x, b.maxZ); at(b.minX, z); at(b.maxX, z); }
    for (const p of [...(this.data.peaks ?? []), ...this.data.pins]) { const [x, z] = worldOfMiles(this.data, p.pos as Vec2); at(x, z); }
    const k = w.camera.clone(); k.far = 1e8; k.updateProjectionMatrix();
    const dir = (look ?? TOP_DOWN).clone().normalize(), ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -c.y), g = new THREE.Vector3(), v = new THREE.Vector3();
    const mid = new THREE.Vector2(((l + r) / 2 / W) * 2 - 1, 1 - ((t + btm) / 2 / H) * 2);
    const place = (d: number): THREE.Vector3 => {
      k.position.copy(c).addScaledVector(dir, d); k.lookAt(c); k.updateMatrixWorld();
      // slide the view so the valley's middle sits under the middle of the clear part
      ray.setFromCamera(mid, k);
      const s = ray.ray.intersectPlane(plane, g) ? c.clone().sub(g) : new THREE.Vector3();
      s.y = 0; k.position.add(s); k.updateMatrixWorld();
      return c.clone().add(s);
    };
    const fits = (d: number): boolean => {
      place(d);
      for (const p of pts) {
        v.copy(p).project(k); if (v.z > 1) return false;
        const x = ((v.x + 1) / 2) * W, y = ((1 - v.y) / 2) * H;
        if (x < l || x > r || y < t || y > btm) return false;
      }
      return true;
    };
    let lo = 2000, hi = 4e6;
    if (fits(lo)) hi = lo; else for (let i = 0; i < 32 && hi / lo > 1.002; i++) { const m = Math.sqrt(lo * hi); if (fits(m)) hi = m; else lo = m; }
    return { target: place(hi), dist: hi };
  }
  private fitAspect = 0;
  /** The far limit frames the whole valley (never nearer than the continuous world's 120,000 ft), and the far plane
   *  reaches past its far side. Re-read when the screen changes shape. */
  fitCamera(): void {
    const w = this.world, d = this.fitDistance(), b = this.bounds;
    this.fitAspect = w.camera.aspect;
    w.controls.maxDistance = Math.max(120000, Math.ceil(d)); // framing the valley is the far limit: one more zoom out asks for the world map
    const far = Math.max(300000, Math.ceil(w.controls.maxDistance + Math.hypot(b.maxX - b.minX, b.maxZ - b.minZ)));
    if (w.camera.far !== far) { w.camera.far = far; w.camera.updateProjectionMatrix(); }
  }
  /** Where the camera stands to see the whole valley: the region's middle, on the land there (anchored). */
  private valleyCentre(): THREE.Vector3 {
    const b = this.bounds, a = this.world.anchor, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    return new THREE.Vector3(cx - a.x, this.land.field.height(cx, cz) - a.y, cz - a.z);
  }
  /** Frame the whole valley (the camera's widest view), at once, gliding there, or flying (a glide that may rise):
   *  straight down with north up, as the world map (the camera's pitch there, world.ts applyPolar), the region fitting
   *  the clear part of the view. `map`: the World map button's, which keeps clear of its bar too. */
  frameWorld(animate: boolean | 'fly' = false, map = false): void {
    this.bake();
    this.fitCamera();
    // (the world map's bar, under the top bar, is kept clear too)
    const bar = map ? document.querySelector('.nestbar:not([hidden])')?.getBoundingClientRect().bottom ?? 0 : 0;
    const dir = TOP_DOWN, f = this.fit(dir, bar);
    if (map) { this.world.controls.maxDistance = Math.max(this.world.controls.maxDistance, Math.ceil(f.dist)); }
    if (animate === 'fly') this.world.flyTo(f.target, f.dist, undefined, dir); else this.world.moveTo(f.target, f.dist, animate, 0, dir);
  }
  /** The camera sees the whole valley from about its middle (what the zoom-out chip asks before offering more). */
  get framed(): boolean {
    const w = this.world, f = this.fit(), t = w.controls.target;
    return Math.hypot(t.x - f.target.x, t.z - f.target.z) < 0.08 * Math.hypot(this.bounds.maxX - this.bounds.minX, this.bounds.maxZ - this.bounds.minZ) && w.camera.position.distanceTo(t) > 0.9 * f.dist;
  }

  // ------------------------------------------------------------------ the view

  /** The camera moved: the forest pool follows the target, labels follow the reveals. */
  onView(o: { restricted: boolean; revealed: Set<string> }): void {
    const w = this.world, tgt = w.toAbsolute(w.controls.target), dist = w.camera.position.distanceTo(w.controls.target);
    if (w.camera.aspect !== this.fitAspect) this.fitCamera();
    this.forest.visible = dist < FOREST_MAX_DIST && this.carto.k < 0.75;
    if (this.forest.visible) this.fillForest(tgt.x, tgt.z);
    this.audience = o;
    const shownPins: { text: string; at: Vec2 }[] = [];
    for (const l of this.labels) {
      if (!l.key) continue;
      // A place the players do not know has no label on their side at all: no page element (so no name, no symbol,
      // no tip to find in the page), and no proxy. The DM sees every place; one the players do not know has a dashed
      // ring on its disc.
      const known = o.revealed.has(l.key), show = !o.restricted || known, el = l.obj.element;
      l.obj.visible = show;
      if (show && !l.obj.parent) this.placeLabels.add(l.obj); else if (!show && l.obj.parent) l.obj.removeFromParent();
      el.classList.toggle('unknown', !known);
      if (show && l.text && l.at) shownPins.push({ text: l.text, at: l.at });
      // the players' names fly nowhere, so they promise nothing either
      if (o.restricted) { delete el.dataset.tip; delete el.dataset.tipSub; }
      else {
        el.dataset.tip = el.dataset.name ?? '';
        if (el.dataset.path) el.dataset.tipSub = 'Fly there and open its map';
        else delete el.dataset.tipSub;
      }
    }
    // the land's own names are geography, public to all; one a shown pin already carries close by is not lettered twice
    for (const l of this.labels) if (!l.key && l.text && l.at) l.obj.visible = !shownPins.some((p) => p.text === l.text && Math.hypot(p.at[0] - l.at![0], p.at[1] - l.at![1]) < 1.5);
    for (const [id, key] of this.proxyKey) this.setSecret(id, o.restricted && !o.revealed.has(key));
    this.declutter();
  }
  /** Who is looking, as onView last heard it. */
  audience: { restricted: boolean; revealed: Set<string> } = { restricted: false, revealed: new Set() };
  private setSecret(path: string, on: boolean): void {
    if (on === this.secret.has(path)) return;
    if (on) this.secret.add(path); else this.secret.delete(path);
    this.applyProxy(path);
  }
  /** Whether a pin's place is shown on this side (the DM's: always; the players': once revealed). */
  pinShown(key: string): boolean { return !this.audience.restricted || this.audience.revealed.has(key); }
  /** Before every render: the sky's bodies stand round the eye (absolute), however far it has moved. */
  private followSky = (): void => {
    if (!this.root.visible) { this.setCarto(0); this.carto.letters.sync(0, 0, 0, () => ({ bars: [] })); this.drawTrail(false); return; }
    const w = this.world; this.sky.follow(w.toAbsolute(w.camera.position), w.camera.position.distanceTo(w.controls.target));
    this.syncCarto();
    this.drawTrail(true);
  };
  private trailEl: SVGSVGElement;
  /** The party's last moves (miles, at most 12), drawn dashed on the land in the valley and road bands. */
  trail: Vec2[] = [];
  private drawTrail(on: boolean): void {
    const path = this.trailEl.firstElementChild as SVGPathElement, band = document.body.dataset.band;
    if (!on || this.trail.length < 2 || (band !== 'valley' && band !== 'road')) { if (path.getAttribute('d')) path.setAttribute('d', ''); return; }
    const host = this.trailEl.getBoundingClientRect();
    const d = this.trail.map((t, i) => { const [x, z] = worldOfMiles(this.data, t), s = this.screenOfAbs(new THREE.Vector3(x, this.groundAt(x, z), z)); return `${i ? 'L' : 'M'}${(s.x - host.left).toFixed(1)} ${(s.y - host.top).toFixed(1)}`; }).join('');
    if (path.getAttribute('d') !== d) path.setAttribute('d', d);
  }
  /** The inked map follows the camera: feet per CSS pixel at the target decides how far it is drawn (fully above
   *  18 effective ft/px, gone below 8; narrow screens normalize their span), and the fit (the view's ground width over the region's) decides the sheet's frame. A
   *  pure function of the camera and the canvas: the same view always looks the same, on each screen its own. */
  private syncCarto(): void {
    const w = this.world, c = this.carto, b = this.bounds;
    const v = cartoBands(w.camera, w.controls.target, w.renderer.domElement, b.maxX - b.minX);
    c.ftPerPx = v.ftPerPx; c.fit = v.fit; w.fit = v.fit;
    c.u.uPxK.value = v.pxK; c.u.uDpr.value = w.renderer.getPixelRatio(); c.u.uAnchor.value.copy(w.anchor);
    if (v.ftPerPx > 2) this.bake();
    if (v.ftPerPx > 3.5) liveCarto(this.cartoMats);
    this.setCarto(c.ready ? v.k : 0);
    c.letters.sync(c.k, c.fit, w.controls.getAzimuthalAngle(), () => w.chrome());
  }
  /** Open map floors paint the same geography as the land beside them. They keep their realistic appearance at
   *  k=0 and blend continuously; hiding them at k=0.5 used to expose a hard rectangular seam. */
  private groundKey = '';
  private groundMeshes: THREE.Mesh[] = [];
  private groundPatches = new Map<THREE.Material, () => void>();
  private openGround(): void {
    const roots = (this.root.parent?.children ?? []).filter((r) => r !== this.root && r.type !== 'Light'), key = roots.map((r) => r.uuid).join();
    if (key !== this.groundKey) {
      this.groundKey = key; this.groundMeshes = [];
      for (const r of roots) r.traverse((o) => { if ((o as THREE.Mesh).isMesh && /^floor:(grass|snow|marsh)$/.test(o.name)) this.groundMeshes.push(o as THREE.Mesh); });
    }
    // Ghost activation swaps materials without changing roots. Check only the cached open floors, not whole maps.
    for (const mesh of this.groundMeshes) for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!this.groundPatches.has(m)) {
        const compile = m.onBeforeCompile, cacheKey = m.customProgramCacheKey;
        const restore = () => {
          m.onBeforeCompile = compile; m.customProgramCacheKey = cacheKey;
          delete m.userData.carto; delete m.userData.cartoLive; m.needsUpdate = true;
          m.removeEventListener('dispose', forget); this.groundPatches.delete(m);
        };
        const forget = () => restore();
        this.groundPatches.set(m, restore); m.addEventListener('dispose', forget);
        patchCarto(m, this.carto.u, this.carto.style);
      }
      if (this.carto.ftPerPx > 3.5) liveCarto([m]);
    }
  }
  private setCarto(k: number): void {
    const c = this.carto, w = this.world, S = THREE.MathUtils.smoothstep;
    this.openGround();
    if (c.k === k && c.u.uCarto.value === k) return;
    const half = (c.k >= 0.5) !== (k >= 0.5), detailChange = (c.k < 0.95) !== (k < 0.95);
    c.k = k; c.u.uCarto.value = k; w.cartoK = k;
    // At region scale the existing plain silhouettes carry places; fine buildings add no readable detail.
    if (detailChange) for (const path of this.details.keys()) this.syncProxy(path);
    if (half) queueMicrotask(() => this.onCartoHalf?.());
    if (w.scene.fog instanceof THREE.FogExp2) w.scene.fog.density = w.fogDensity;
    setWash(k * 0.9, CARTO_STYLES[c.style]);
    c.ink.visible = k > 0.001;
    // the 3-D partners fade by dithering (alphaHash: depth-writing, no sorting), never a flip inside their band
    (this.forest.material as THREE.Material).opacity = 1 - S(k, 0.25, 0.75);
    this.forest.visible = this.forest.visible && k < 0.75;
    this.land.group.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      if (m.name === 'ribbons') { (m.material as THREE.Material).opacity = 1 - S(k, 0.4, 0.8); m.visible = k < 0.8; }
      else if (m.name === 'crag-mist') { (m.material as THREE.Material).opacity = (m.userData.baseOpacity ?? 1) * (1 - S(k, 0.4, 0.6)); m.visible = k < 0.6; }
    });
    document.body.style.setProperty('--carto', k.toFixed(3));
    if (k > 0.05) document.body.dataset.carto = '1'; else delete document.body.dataset.carto;
    w.invalidate();
  }
  /** The hex grid at the map's scale (one setting, shared with the flat sheet's hex button). */
  setHex(on: boolean): void { this.carto.u.uHexOn.value = on ? 1 : 0; this.world.invalidate(); }
  /** The moon in its phase and the bodies on their arcs (the clock). */
  setMoon(phase: number, night: boolean, hour: number): void { this.sky.setMoon(phase, night, hour); }
  /** The party's marker (W): on the land at a place, or at a given height (the party token's spot on a ghost map);
   *  none where the party's own token shows. */
  setParty(p: { at: Vec2; y?: number } | null): void {
    this.party.visible = !!p;
    if (p) this.party.position.set(p.at[0], (p.y ?? this.land.field.surface(p.at[0], p.at[1])) + 12, p.at[1]);
  }

  /** The place name under a point of the page (client pixels), if the DM could tap it: shown, not crowded out, and
   *  on touch at least 44 px square round its middle. The nearest middle wins. */
  labelAt(x: number, y: number, touch = false): { path: string; name: string; el: HTMLElement } | null {
    const l = this.hitLabel(x, y, touch, (q) => !!q.obj.element.dataset.path);
    return l ? { path: l.obj.element.dataset.path!, name: l.obj.element.dataset.name ?? '', el: l.obj.element } : null;
  }
  /** The shown place label under a page point: inside its box (on touch at least 44 px square round its mark), the
   *  nearest mark winning. Its mark is its middle, or on the inked map its disc (the symbol stands over it). */
  private hitLabel(x: number, y: number, touch: boolean, ok: (l: WorldStage['labels'][number]) => boolean): WorldStage['labels'][number] | null {
    let best: WorldStage['labels'][number] | null = null, bd = Infinity;
    for (const l of this.labels) {
      const el = l.obj.element;
      if (!l.key || !l.obj.visible || !l.obj.parent || el.classList.contains('declutter') || !ok(l)) continue;
      const r = el.getBoundingClientRect(); if (!r.width) continue; // a band that hides the names: display none
      const pk = this.carto.k >= 0.5 ? el.querySelector('.pk')?.getBoundingClientRect() : undefined;
      const cx = pk?.width ? (pk.left + pk.right) / 2 : (r.left + r.right) / 2, cy = pk?.width ? (pk.top + pk.bottom) / 2 : (r.top + r.bottom) / 2;
      const pn = pk?.width && !el.classList.contains('dot') ? el.querySelector('.pn')?.getBoundingClientRect() : undefined;
      const inBox = (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) || (!!pn?.width && x >= pn.left && x <= pn.right && y >= pn.top && y <= pn.bottom);
      if (!inBox && !(touch && Math.abs(x - cx) <= 22 && Math.abs(y - cy) <= 22) && !(touch && !pk?.width && Math.abs(x - cx) <= Math.max(r.width, 44) / 2 && Math.abs(y - cy) <= Math.max(r.height, 44) / 2)) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d < bd) { bd = d; best = l; }
    }
    return best;
  }
  /** The place (any shown pin, on either side) under a point of the page, for the world map's tips, cards and the
   *  party's snap: like labelAt, without needing a map to fly to. */
  pinAt(x: number, y: number, touch = false): { key: string; path?: string; el: HTMLElement } | null {
    const l = this.hitLabel(x, y, touch, () => true);
    return l ? { key: l.key, path: l.obj.element.dataset.path, el: l.obj.element } : null;
  }
  /** The party's marker on the page (its middle), while it shows. */
  partyAt(): { x: number; y: number } | null {
    if (!this.party.visible || !this.party.parent || !this.root.visible) return null;
    const r = this.party.element.getBoundingClientRect(); if (!r.width) return null;
    return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 };
  }
  /** The party's place on the page (its anchor on the land, which its & stands a little off on the inked map). */
  partyAnchor(): { x: number; y: number } | null {
    if (!this.party.visible || !this.party.parent) return null;
    const s = this.screenOfAbs(this.party.position.clone()); return s.behind ? null : { x: s.x, y: s.y }; // (the stage's own frame is absolute feet)
  }
  /** Where a page point falls on the land (absolute feet): the ray from the eye meets the ground, refined on the
   *  heightfield (a few steps; the camera looks down on the valley). */
  groundOf(x: number, y: number): THREE.Vector3 | null {
    const w = this.world, r = w.renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, 1 - ((y - r.top) / r.height) * 2), w.camera);
    const a = w.anchor, o = ray.ray.origin, d = ray.ray.direction; if (d.y > -1e-4) return null;
    let h = w.controls.target.y + a.y, p = new THREE.Vector3();
    for (let i = 0; i < 6; i++) { const t = (h - a.y - o.y) / d.y; if (t < 0) return null; p = o.clone().addScaledVector(d, t).add(a); h = this.land.field.surface(p.x, p.z); }
    p.y = h; return p;
  }
  /** Where a pin stands on the page (its land point projected), for the party's snap. */
  screenOfAbs(p: THREE.Vector3): { x: number; y: number; behind: boolean } {
    const w = this.world, r = w.renderer.domElement.getBoundingClientRect(), v = w.toAnchored(p).project(w.camera);
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, behind: v.z > 1 };
  }
  private hovered: HTMLElement | null = null;
  /** The name the mouse is over shows it can be tapped (the names take no pointer themselves). */
  hoverLabel(el: HTMLElement | null): void {
    if (this.hovered === el) return;
    this.hovered?.classList.remove('hover'); this.hovered = el; el?.classList.add('hover');
  }
  /** On the inked map every place keeps its disc; names yield to all discs before other names. Close in, chips
   *  show their full name where it fits, else their key, and wait for room when even the key would collide. */
  private declutter(): void {
    if (this.declutterQ) return;
    this.declutterQ = requestAnimationFrame(() => requestAnimationFrame(() => {
      this.declutterQ = 0;
      const live = this.labels.filter((l) => l.obj.visible && l.obj.element.style.display !== 'none').sort((a, b) => a.pri - b.pri);
      for (const l of live) l.obj.element.classList.remove('declutter', 'dot');
      const vp = this.world.renderer.domElement.getBoundingClientRect();
      const fixed = [...this.world.chrome().panels, ...this.carto.letters.blockers()], placed: { left: number; right: number; top: number; bottom: number }[] = [...fixed];
      const onView = (r: DOMRect, list: typeof placed) => r.left >= vp.left + 2 && r.right <= vp.right - 2 && r.top >= vp.top + 2 && r.bottom <= vp.bottom - 2
        && !list.some((p) => r.left < p.right + 2 && r.right > p.left - 2 && r.top < p.bottom + 1 && r.bottom > p.top - 1);
      const clear = (r: DOMRect) => onView(r, placed);
      const discs = this.carto.k >= 0.5;
      if (discs) {
        // Reserve every disc before placing any names. A late pin must not disappear just because an earlier
        // name took its spot. Nearby discs can share space at region fit; hitLabel chooses the nearest centre.
        const marks = live.filter((l) => l.key).map((l) => ({ label: l, rect: l.obj.element.querySelector('.pk')!.getBoundingClientRect() }));
        for (const l of live) {
          const el = l.obj.element;
          const r = l.key ? el.querySelector('.pn')!.getBoundingClientRect() : el.getBoundingClientRect();
          if (!r.width) continue;
          const blockers = [...placed, ...marks.filter((m) => m.label !== l).map((m) => m.rect)];
          if (onView(r, blockers)) placed.push(r);
          else el.classList.add(l.key ? 'dot' : 'declutter');
        }
        return;
      }
      const crowded: typeof live = [];
      for (const l of live) {
        const r = l.obj.element.getBoundingClientRect(); if (!r.width) continue;
        if (clear(r)) placed.push(r); else crowded.push(l);
      }
      for (const l of crowded) {
        const el = l.obj.element;
        if (!l.key) { el.classList.add('declutter'); continue; } // a land name never shrinks to a tag: it waits for room
        el.classList.add('dot');
        const r = el.getBoundingClientRect();
        if (clear(r)) placed.push(r);
        else el.classList.add('declutter');
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
    const PT = this.perTile, m = new Float32Array(PT * 16), c = new Float32Array(PT * 3), M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const cols = [new THREE.Color(T.forest[0]), new THREE.Color(T.forest[1])];
    let n = 0;
    for (let i = 0; i < CANDIDATES && n < PT; i++) {
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
      const t = this.tile(tx + dx, tz + dz), k = Math.min(t.n, this.forest.instanceMatrix.count - n);
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
    this.disposed = true; this.detailJob = undefined;
    if (this.detailRaf) cancelAnimationFrame(this.detailRaf);
    if (this.declutterQ) cancelAnimationFrame(this.declutterQ);
    this.hovered = null;
    for (const restore of [...this.groundPatches.values()]) restore();
    this.groundMeshes = []; this.groundKey = '';
    this.root.removeFromParent();
    this.world.beforeRender.delete(this.followSky);
    for (const l of [...this.labels.map((x) => x.obj), this.party]) { l.removeFromParent(); l.element.remove(); }
    this.trailEl.remove();
    this.sky.dispose();
    this.bakeJob = undefined;
    this.carto.letters.dispose(); for (const t of this.carto.textures) t.dispose(); setWash(0, CARTO_STYLES[this.carto.style]); this.world.cartoK = 0; this.world.fit = 0;
    delete document.body.dataset.carto; document.body.style.removeProperty('--carto');
    this.root.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      m.geometry.dispose();
      for (const mt of Array.isArray(m.material) ? m.material : [m.material]) mt.dispose(); // the crag mist's texture is shared (backdrop's), and stays
    });
    this.tiles.clear();
  }
}

/** The letter on a pin's disc: the key without a trailing number after letters (B2 shows B, M3 shows M); a key that is
 *  all digits (A Wild Sheep Chase's 1 to 5) shows whole. */
export const discKey = (key: string): string => key.replace(/(\D)\d+$/, '$1');
