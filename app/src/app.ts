// mistLAB app: one location loaded, one level active, DM or Player Display mode.
import * as THREE from 'three';
import type { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { bounds, pointInPolygon, type Vec2 } from './core/geometry';
import { CoverageMap, Cov } from './core/coverage';
import { squareCellAt, squareCellCenter, squareDistanceFt, worldToHex, hexToWorld, hexDistanceFt, hexSizeFromWidth, type DiagonalRule } from './core/grid';
import { OPENABLE_KINDS, type Container, type GridFile, type Level, type LightSource, type SceneFile, type SceneObject, type Room, type Wall, type Ambient } from './core/schema';
import { moveBlockers } from './core/light';
import { canWalk } from './core/movement';
import { SITE_INTERFACES } from './core/siteInterfaces';
import { classOpacity, fogCurve, hiddenCurve, labelCurve } from './core/slider';
import { baseRingFt, CELL_FT } from './core/units';
import { baseRing } from './kit/pieces';
import { adventurer } from './kit/creatures';
import { PALETTE } from './kit/palette';
import { buildLevel, buildLevelSteps, hitObjectId, mergeByMaterial, type BuiltLevel, type LabelSpec } from './render/build';
import { gridUniforms } from './render/gridOverlay';
import { fogUniforms, sectionClip, setOpacity, setWallCut, WALL_CLIP } from './render/materials';
const WALL_CUT_FT = 5;
import { clipGrid, fadeGridBelow, setGridType } from './render/gridOverlay';
import { World, type CameraPreset } from './render/world';
import { builtPaths, loadLocation } from './data';
import { kindName, playerDesc, playerLabel } from './core/objectText';
export { KIND_DESC, kindName, playerDesc, playerLabel } from './core/objectText';
import { ICON } from './ui/icons';
import { pinForScene, useWorld } from './ui/worldmap';
import { campaignOf, worldOf, type Campaign } from './campaigns';
import { buildBackdrop, cutLand, landHole, underBox } from './render/backdrop';
import { BAROVIAN_GRASS, setGrass } from './kit/surfaces';
import { Channel, type Msg } from './state/channel';
import { newCampaign, revealSets, type CampaignState, type Combatant, type Encounter, type Reveal, type Sheet, type Token } from './state/campaign';
import { tacticalRange, type RangeResult } from './core/range';
import { buildRangeOverlay } from './render/rangeOverlay';
import { SHELL_ROLES } from './render/materials';
import { skyAt, type Sky } from './core/sky';
const PARTY_RED = '#c0392b';
/** How far round an area map its parent's surroundings are drawn, past the map's own half-extent (ft). */
const CONTEXT_FT = 450;
const northVec = (n?: string): [number, number] => (n === '+z' ? [0, 1] : n === '-x' ? [-1, 0] : n === '+x' ? [1, 0] : [0, -1]);
/** The turn that carries a parent level's north onto a child level's north (plan angle, radians). */
const northTurn = (child?: string, parent?: string) => { const nb = northVec(child), np = northVec(parent); return Math.atan2(nb[1], nb[0]) - Math.atan2(np[1], np[0]); };
const centroidOf = (poly: Vec2[]): Vec2 => [poly.reduce((a, p) => a + p[0], 0) / poly.length, poly.reduce((a, p) => a + p[1], 0) / poly.length];
/** A map's open-air level (the one with terrain, else the first) and its extent: rooms and terrain. */
const groundOf = (scene: SceneFile): Level => scene.levels.find((l) => l.terrain?.length) ?? scene.levels[0];
const extentOf = (l: Level) => bounds([...l.rooms.map((r) => r.polygon), ...(l.terrain ?? []).map((t) => t.polygon)]);
/** Every level's rooms and terrain together (a building's whole stack). */
const wholes = new WeakMap<SceneFile, Bounds>();
const wholeExtent = (s: SceneFile): Bounds => {
  let b = wholes.get(s);
  if (!b) { const lv = s.levels.filter((l) => l.rooms.length || l.terrain?.length); b = bounds(lv.flatMap((l) => [...l.rooms.map((r) => r.polygon), ...(l.terrain ?? []).map((t) => t.polygon)])); wholes.set(s, b); }
  return b;
};
/** Where the DM came in: the room of the parent map whose Enter opened the child. */
export interface EnteredFrom { parent: string; level: string; key: string; child: string }
import { creatureById, figureFor, aliasFor, seenAs, statsOf, speedFtOf, colorOf } from './bestiary';
import { playerFacing } from './core/identity';
import { sightBlockers } from './core/light';
import { idbGet, idbSet } from './state/idb';
import { boundsInParent, compose, covBasisOf, grow, worldOfMiles, type Bounds, type Placement } from './core/frames';
import { ATLAS, WorldStage } from './render/worldstage';
import { disposeTree } from './render/dispose';
import { Ghost, GHOST_TINT, type GhostLook } from './render/ghost';
import { enterPx, leavePx, STREAM, Streamer, type StreamHost } from './render/streamer';
import { hideUnder, restoreUnder, veil, type NestMask } from './render/hideUnder';
import type { AtlasScene } from '../../scripts/world-atlas';

/** The continuous world (maps stand in one 3-D valley) is on unless `?nested=0`, or the device was told so
 *  (localStorage mistlab.nested = '0'); `?nested=1` forces it on. */
export function nestedPref(): boolean {
  const q = new URLSearchParams(location.search).get('nested');
  if (q === '0' || q === '1') return q === '1';
  try { return localStorage.getItem('mistlab.nested') !== '0'; } catch { return true; }
}

export type Mode = 'dm' | 'player';
export type Tool = 'none' | 'reveal' | 'brush-reveal' | 'brush-fog' | 'measure';
export type GridMode = 'off' | 'square' | 'hex';
/** A finished measurement: the distance, its squares and the rule the maths used (the readout's rules card names it). */
export interface MeasureResult { ft: number; squares: number; rule: 'five' | 'five-ten-five' | 'hex' }
export interface TapHit {
  room?: { key: string; name: string; revealed: boolean; desc?: string; dm?: string; page?: number; enter?: string };
  pos: Vec2;
  door?: { wallId: string; open: boolean };
  secretDoor?: { id: string; revealed: boolean };
  object?: { id: string; label: string; playerLabel?: string; container?: { locked: boolean; open: boolean; contents?: string }; vis: string; revealed: boolean; kind: string; desc?: string; dm?: string; page?: number; visibleToPlayers: boolean };
  /** A creature the players can see: what they call it and what they make of it. */
  token?: { id: string; name: string; desc?: string; seenAsOf?: string };
}

interface Loaded {
  path: string;
  scene: SceneFile;
  grid: GridFile;
  levels: Map<string, BuiltLevel>;
  coverage: Map<string, CoverageMap>;
  covTex: Map<string, THREE.DataTexture>;
  labels: { obj: CSS2DObject; spec: LabelSpec; level: string }[];
  tokens: Map<string, THREE.Group>;
  /** The scene's own frame: its levels, backdrop and surroundings hang from it, and it hangs from the world root at the
   *  scene's absolute placement (identity until the continuous world places it). */
  root: THREE.Group;
  /** In the valley: drawn (not folded into its proxy). */
  drawn: boolean;
  /** In the valley and not the active map: drawn as a ghost (render/ghost.ts). */
  ghost?: Ghost;
  /** A child map drawn in its parent: what the parent hid under it (render/hideUnder.ts). */
  nest?: NestMask;
}

const storeKey = (campaignId: string) => (campaignId === 'cos' ? 'campaign:default' : `campaign:${campaignId}`); // CoS keeps its original save

/** A breadcrumb back out to a town frames at least this much of it round the place left (ft). */
const CRUMB_TOWN_FT = 1400;

export class App {
  readonly world: World;
  /** The continuous world: pin maps open in place inside the valley (see render/worldstage.ts). The View menu's
   *  'Continuous world' switches it (setNestedMode); the Player Display follows the DM's. */
  nested = nestedPref();
  /** The campaign's valley, built the first time one of its pin maps opens in the continuous world. */
  stage?: WorldStage;
  /** The open map stands in the valley (placed at its pin), rather than alone in the mist with its own backdrop. */
  staged = false;
  t = 1; // the DM starts at the DM end of the view slider: the whole map, every secret
  state: CampaignState = newCampaign();
  cur: Loaded | null = null;
  levelId = '';
  tool: Tool = 'none';
  gridMode: GridMode = 'square';
  /** How strongly the grid draws (0..1) and whether moves land on cell centres; both remembered on this device. */
  gridOpacity = Number(localStorage.getItem('mistlab.gridOpacity') ?? 0.6);
  gridSnap = localStorage.getItem('mistlab.gridSnap') !== '0';
  setGridOpacity(v: number): void { this.gridOpacity = Math.max(0, Math.min(1, v)); localStorage.setItem('mistlab.gridOpacity', String(this.gridOpacity)); this.applySlider(); }
  setGridSnap(on: boolean): void { this.gridSnap = on; localStorage.setItem('mistlab.gridSnap', on ? '1' : '0'); this.onChange?.(); }
  /** DM label density: area keys only, everything, or none. */
  labelMode: 'keys' | 'all' | 'none' = 'keys';
  /** Camera follows the party token after it moves. */
  follow = true;
  /** Entering a room reveals and remembers it for the players. */
  autoReveal = true;
  /** One-screen play: 'players' hides every DM affordance and pins t = 0. */
  view: 'dm' | 'players' = 'dm';
  lowWalls = true;
  camPreset: CameraPreset = 'tabletop';
  lockPlayerCamera = true;
  secretAsWall = false;
  renderMode: 'normal' | 'floorMask' = 'normal';
  backdrop?: THREE.Group;
  /** The parent map's surroundings drawn round an area map. */
  context?: THREE.Object3D;
  /** The room the DM last used Enter from: Back, zooming out and the surroundings of the map it opened go by it. */
  enteredFrom?: EnteredFrom;
  /** Section height (ft, absolute) on a stacked site; undefined follows the current level, null = none. */
  cutFt: number | null | undefined = undefined;
  private keepCut = false;
  /** Where the cut sits while it follows the floor (5 ft up with low walls, else just under the ceiling). */
  followCutFt = 0;
  /** Move the section cut; the current level becomes the highest floor below it. */
  setCut(ft: number | undefined): void {
    if (!this.cur?.scene.stacked) return;
    this.cutFt = ft;
    if (ft !== undefined) {
      const below = [...this.cur.scene.levels].filter((l) => l.elevationFt < ft - 0.5).sort((a, b) => b.elevationFt - a.elevationFt)[0] ?? this.cur.scene.levels[0];
      if (below.id !== this.levelId) { this.keepCut = true; this.setLevel(below.id); this.keepCut = false; this.broadcast(); return; }
    }
    this.applySlider(); this.broadcast();
  }
  /** Each floor's default section height on a stacked site: the slicer's detents. */
  get floorCuts(): { level: string; name: string; ft: number }[] {
    if (!this.cur?.scene.stacked) return [];
    const stack = this.stackOf(this.levelId);
    if (this.cur.scene.stacked === 'open') return this.cur.scene.levels.filter((l) => stack.has(l.id)).map((l) => ({ level: l.id, name: l.name, ft: l.elevationFt + (l.ceilingFt ?? 10) + 2 }));
    return this.cur.scene.levels.filter((l) => stack.has(l.id)).map((l) => ({ level: l.id, name: l.name, ft: l.elevationFt + (l.ceilingFt ?? 10) - 0.5 }));
  }
  /** The span of floors on a stacked site, for the slicer. */
  get sectionRange(): { min: number; max: number } | undefined {
    if (!this.cur?.scene.stacked) return undefined;
    const ls = this.cur.scene.levels;
    return { min: Math.min(...ls.map((l) => l.elevationFt)) - 2, max: Math.max(...ls.map((l) => l.elevationFt + (l.ceilingFt ?? 10))) + 12 };
  }
  status = '';
  onStatus: ((s: string, measure?: MeasureResult) => void) | null = null;
  onChange: (() => void) | null = null;
  private channel: Channel;
  private saveTimer = 0;
  private camTimer = 0;
  private maskSwap = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  private maskHidden: THREE.Object3D[] = [];
  private maskMats: THREE.Material[] = [];
  private raycaster = new THREE.Raycaster();

  constructor(host: HTMLElement, readonly mode: Mode) {
    this.world = new World(host);
    this.channel = new Channel((m) => this.onMsg(m));
    this.world.onCamera = () => { this.followGround(); this.sendCamera(); this.labelDensity(); this.onCameraUi?.(); this.streamer.poke(); };
    this.onCameraUi = null;
    // the floating origin moved: the scene's drawn placement, the coverage basis and the clip plane follow
    // (while a new map is being placed the level is still the old map's: the slider waits for setLevel)
    this.world.onReanchor = () => { this.syncPlacement(); if (this.cur?.levels.has(this.levelId)) this.applySlider(); for (const r of this.resident.values()) r.ghost?.place(r.root); };
    this.installPointer();
  }

  /** Effective slider: the Player Display is pinned at 0. */
  get T(): number { return this.mode === 'player' || this.view === 'players' ? 0 : this.t; }

  campaign: Campaign = campaignOf('appB/death-house');
  /** Read the saved state of a campaign (each campaign has its own save); nothing changes until useCampaign. */
  private async readCampaign(c: Campaign): Promise<CampaignState> {
    const saved = await idbGet<CampaignState>(storeKey(c.id)).catch(() => undefined);
    return saved ? { ...newCampaign(c.id), ...saved } : newCampaign(c.id); // older saves lack newer fields
  }
  /** Switch to a campaign and its save (only the authoritative DM saves the old campaign). */
  private useCampaign(c: Campaign, state: CampaignState): void {
    if (this.mode === 'dm' && this.cur && c.id !== this.campaign.id) { clearTimeout(this.saveTimer); void idbSet(storeKey(this.campaign.id), this.state).catch(() => {}); }
    this.campaign = c;
    // another campaign, another valley: the old one goes, the new one is built when one of its maps opens in it
    if (this.stage && this.stage.campaign.id !== c.id) { this.stage.dispose(); this.stage = undefined; }
    this.state = state;
    useWorld(worldOf(c), c.theme.id === 'pastoral' ? 'pastoral' : 'gothic', c.world);
    this.world.setTheme(c.theme);
    document.body.dataset.campaign = c.id;
  }
  async init(path: string): Promise<void> {
    await this.open(path);
    if (this.mode === 'player') this.channel.send({ kind: 'hello' });
    else this.broadcast();
  }

  // ------------------------------------------------------------------ loading

  /** Every open() takes a number; only the latest may change the world (the latest request wins). */
  private navSeq = 0;
  /** The map the party was last taken to by an open (and its level): the camera making another map active does not
   *  change it. The Player Display stays on it while the players' camera is unlocked. */
  private home?: string;
  private homeLevel?: string;
  /** Open a map: the new one is read and built first, while the old one stays on screen; then, in one step, the old
   *  one is released and the new one placed (at its pin in the valley, or alone in the mist with its backdrop, the
   *  legacy way) and made active. In the valley the camera glides to it from wherever it was.
   *  Atomic: an open overtaken by a later one is dropped (its build freed) and changes nothing; one that fails (a
   *  scene that cannot be fetched offline) keeps the open map, its campaign and its save, and says so. Resolves to
   *  whether this map opened; it never rejects. */
  async open(path: string, levelId?: string): Promise<boolean> {
    const seq = ++this.navSeq, c = campaignOf(path), switching = !this.cur || c.id !== this.campaign.id;
    this.cancelSwitch();
    // in the valley a map comes with the maps it hangs in (a building with its town), the root first; any of them the
    // valley already holds (streamed in, or the one left a moment ago) is used as it stands, without a build
    const chain = this.stageEntry(path, c.id) ? [...this.chainOf(path)].reverse() : [];
    const holding = (p: string) => (!switching && this.staged && this.stageEntry(p) ? this.resident.get(p) : undefined);
    const built: Loaded[] = [], ups: Loaded[] = [];
    let state = this.state;
    const take = async (p: string): Promise<Loaded> => {
      const h = holding(p); if (h) return h;
      const l = await this.load(p, { campaign: c, state });
      // the streamer stood its own copy of this map in the valley meanwhile: that one opens, this build is freed
      const streamed = holding(p); if (streamed) { this.dispose(l); return streamed; }
      built.push(l); return l;
    };
    let next: Loaded;
    try {
      if (switching) state = await this.readCampaign(c);
      if (seq !== this.navSeq) return false;
      for (const p of chain) { ups.push(await take(p)); if (seq !== this.navSeq) break; }
      next = await take(path);
    } catch (err) {
      for (const b of built) this.dispose(b);
      if (seq === this.navSeq) this.openFailed(path, err);
      return false;
    }
    // overtaken, or a map it holds went meanwhile (the streamer freed it): nothing changes
    const gone = [...ups, next].some((l) => !built.includes(l) && this.resident.get(l.path) !== l);
    if (seq !== this.navSeq || gone) { for (const b of built) this.dispose(b); return false; }
    // from here on nothing waits: the swap happens between two frames
    this.cancelSwitch(); // (one the streamer began while this map was read)
    if (switching) { this.releaseAll(); this.useCampaign(c, state); }
    const inValley = !!this.stageEntry(path), fly = !switching && this.staged && inValley; // already in the valley: glide to the next place
    const prev = this.cur;
    if (prev && prev !== next) {
      // in the valley the map left behind stays as a ghost (the streamer folds and frees it as the camera leaves);
      // anything else is freed now
      if (inValley && this.staged && this.resident.get(prev.path) === prev) this.leaveActive(prev);
      else this.release(prev);
    }
    if (!inValley) this.releaseAll();
    this.place(next, ups);
    // the Player Display's camera is the DM's (camera messages): it never frames a map it follows the DM onto
    const follow = this.mode === 'player' && !!prev;
    this.home = path; // the party's map (the camera alone never changes it)
    this.activate(next, { levelId, frame: follow ? false : fly ? 'fly' : true });
    // it resolves when the camera has arrived (a glide across the valley), or at once
    if (fly) await this.world.settled();
    this.streamer.tick(); // what the camera has come to: the place left behind folds into its proxy
    return this.cur === next;
  }
  /** A map could not be opened: the open one stays, and the status line says why for a while. */
  private openFailed(path: string, err: unknown): void {
    console.warn(`mistLAB: could not open ${path}`, err);
    const name = ATLAS.scenes[path]?.name ?? path;
    this.setStatus(`Couldn't open ${name} (offline?)`);
    clearTimeout(this.flashT); this.flashT = window.setTimeout(() => { if (this.status.startsWith("Couldn't open")) this.setStatus(''); }, 6000);
  }

  /** Switch the continuous world on or off (the View menu's 'Continuous world'; remembered on this device): the open
   *  map opens again the other way, on the same level. Off disposes the valley. */
  async setNestedMode(on: boolean, remember = true): Promise<void> {
    if (remember) try { localStorage.setItem('mistlab.nested', on ? '1' : '0'); } catch { /* private mode: this session only */ }
    if (on === this.nested) return;
    this.nested = on;
    if (this.cur) await this.open(this.cur.path, this.levelId);
    this.dropStage();
    this.layoutChanged();
  }
  /** With the continuous world off, the valley goes (its GPU buffers, its labels). */
  private dropStage(): void {
    if (this.nested || !this.stage || this.staged) return;
    this.stage.dispose(); this.stage = undefined;
  }

  /** The atlas entry a map is placed by in the continuous world: a pin's root map of the open campaign (or of the one
   *  given), or a map that hangs in one (a building, an area map, a dungeon: atlas `parent`, at any depth). Orphans
   *  (dev/*) open the legacy way. */
  stageEntry(path: string, campaignId = this.campaign.id): AtlasScene | undefined {
    if (!this.nested) return undefined;
    const e = ATLAS.scenes[path];
    if (!e || e.orphan || e.campaign !== campaignId) return undefined;
    if (!e.depth) return e.pin && e.worldBounds ? e : undefined;
    return e.parent && e.placement && e.enterRoom && this.stageEntry(e.parent, campaignId) ? e : undefined;
  }
  /** The maps a map hangs in, nearest first (the atlas's parents): the inn's is [Vallaki]. */
  chainOf(path: string): string[] {
    const out: string[] = [];
    for (let p = ATLAS.scenes[path]?.parent; p && !out.includes(p); p = ATLAS.scenes[p]?.parent) out.push(p);
    return out;
  }
  /** The maps that hang in a map (its buildings and area maps), by the atlas. */
  private childrenOf(path: string): AtlasScene[] {
    let list = this.kids.get(path);
    if (!list) { list = Object.values(ATLAS.scenes).filter((e) => e.parent === path && !e.orphan && !!e.placement && !!e.enterRoom); this.kids.set(path, list); }
    return list;
  }
  private kids = new Map<string, AtlasScene[]>();
  /** A map's placement in W: a root's at its pin, a child's composed through the maps it hangs in. */
  private placementInW(path: string): Placement | undefined {
    let pl = this.placedW.get(path);
    if (pl) return pl;
    const e = ATLAS.scenes[path]; if (!e) return undefined;
    if (!e.depth) pl = (this.stage && e.pin ? this.stage.rootPlacementOf(e) : e.placement);
    else { const up = e.parent ? this.placementInW(e.parent) : undefined; pl = up ? compose(up, e.placement) : undefined; }
    if (pl) this.placedW.set(path, pl);
    return pl;
  }
  private placedW = new Map<string, Placement>();
  /** A child as the streamer measures it: its footprint and floor in W (composed through its parents). */
  private streamSite(e: AtlasScene): AtlasScene | undefined {
    let s = this.siteCache.get(e.path);
    if (s) return s;
    const pl = this.placementInW(e.path); if (!pl) return undefined;
    s = { ...e, placement: pl, worldBounds: boundsInParent(pl, e.extent ?? e.bbox) }; // (its whole stack)
    this.siteCache.set(e.path, s);
    return s;
  }
  private siteCache = new Map<string, AtlasScene>();
  /** Where a placed map's root stands (absolute feet), however deep it hangs. */
  private absOf(l: Loaded): THREE.Vector3 {
    if (l.root.parent === this.world.root) return l.root.position.clone(); // a root stands in W (exactly)
    l.root.updateWorldMatrix(true, false);
    return this.world.toAbsolute(new THREE.Vector3().setFromMatrixPosition(l.root.matrixWorld));
  }

  /** Build a map: its levels, coverage maps and textures, and its labels; nothing is added to the world yet. The
   *  campaign and save it is built for (its grass, what the party has seen) are the open one's unless given. */
  async load(path: string, ctx: { campaign: Campaign; state: CampaignState } = { campaign: this.campaign, state: this.state }): Promise<Loaded> {
    const files = await loadLocation(path), it = this.loadSteps(path, files, ctx);
    for (;;) { const r = it.next(); if (r.done) return r.value; }
  }
  /** load() in small steps (render/build.ts buildLevelSteps): the streamer spreads a map's build over frames. */
  private *loadSteps(path: string, { scene, grid }: { scene: SceneFile; grid: GridFile }, ctx: { campaign: Campaign; state: CampaignState }): Generator<void, Loaded> {
    const levels = new Map<string, BuiltLevel>();
    const coverage = new Map<string, CoverageMap>();
    const covTex = new Map<string, THREE.DataTexture>();
    const labels: Loaded['labels'] = [];
    const root = new THREE.Group();
    root.name = `scene:${path}`;
    for (const l of scene.levels) {
      setGrass(ctx.campaign.theme.grass ?? BAROVIAN_GRASS);
      const b = yield* buildLevelSteps(l, grid.levels[l.id]);
      levels.set(l.id, b);
      root.add(b.root);
      yield;
      const cov = CoverageMap.forPolygons([...l.rooms.map((r) => r.polygon), ...grid.levels[l.id].floorPolygons]);
      const seen = ctx.state.seen[`${scene.location}/${l.id}`];
      if (seen) cov.load({ seen, paint: '' });
      coverage.set(l.id, cov);
      const tex = new THREE.DataTexture(cov.toTexture() as Uint8Array<ArrayBuffer>, cov.width, cov.height, THREE.RGBAFormat);
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearFilter;
      tex.needsUpdate = true;
      covTex.set(l.id, tex);
      yield;
      const linkSpots: [number, number][] = [];
      for (const k of scene.links) for (const [end, other] of [[k.from, k.to], [k.to, k.from]] as const) {
        if (end.level !== l.id) continue;
        if (linkSpots.some((q) => Math.hypot(q[0] - end.pos[0], q[1] - end.pos[1]) < 12)) continue; // one marker per stair
        linkSpots.push([end.pos[0], end.pos[1]]);
        const to = scene.levels.find((x) => x.id === other.level);
        const up = (to?.elevationFt ?? 0) > l.elevationFt;
        b.labels.push({ id: `link:${k.id}:${end.level}`, text: `${up ? '↑' : '↓'} ${to?.name ?? other.level}`, pos: new THREE.Vector3(end.pos[0], l.elevationFt + 3, end.pos[1]), vis: 'player', kind: 'link', linkId: k.id });
      }
      for (const spec of b.labels) {
        if (this.mode === 'player' && spec.vis === 'dm-note') continue; // no DM UI on the Player Display
        const obj = this.world.label(spec.text, spec.sub, `${spec.kind} ${spec.vis}`, spec.page);
        obj.position.copy(spec.pos);
        if (spec.kind === 'door') {
          const locked = spec.text === 'locked';
          obj.element.innerHTML = `<i class="closed">${ICON.doorClosed}</i><i class="opened">${ICON.doorOpen}</i>${locked ? `<b>${ICON.padlock}</b>` : ''}`;
          obj.element.title = locked ? 'Locked door · the DM opens it' : 'Door · click to open or close';
          if (locked) obj.element.classList.add('locked');
          obj.element.addEventListener('click', () => this.toggleDoor(spec.wallId!));
        }
        if (spec.kind === 'link') {
          const up = spec.text.startsWith('↑');
          obj.element.innerHTML = `${up ? ICON.stairsUp : ICON.stairsDown}<span>${spec.text.slice(2)}</span>`;
          const lk = scene.links.find((k) => k.id === spec.linkId);
          obj.element.title = `${lk?.kind === 'trapdoor' ? 'Trapdoor' : lk?.kind === 'dumbwaiter' ? 'Dumbwaiter' : 'Stairs'} ${up ? 'up' : 'down'} to ${spec.text.slice(2)} · click to take the party`;
          obj.element.addEventListener('click', () => this.takeLink(spec.linkId!));
        }
        b.root.add(obj);
        labels.push({ obj, spec, level: l.id });
      }
    }
    return { path, scene, grid, levels, coverage, covTex, labels, tokens: new Map(), root, drawn: true };
  }

  /** Take a map out of the world and free it: its page elements (labels, token tags), its graph, its geometries,
   *  private materials and textures (render/dispose.ts); its proxy shows again. */
  release(loaded: Loaded): void {
    // the maps that hang in it go first (they are drawn inside its root); a child gives its parent's massing back
    for (const r of [...this.resident.values()]) if (r !== loaded && ATLAS.scenes[r.path]?.parent === loaded.path && this.resident.get(loaded.path) === loaded) this.release(r);
    if (loaded.nest) { this.unnestAll(); }
    if (loaded === this.cur) {
      this.select(null); this.onLeave?.(); this.clearRuler();
      // the app's own markers outlive the map: take them off it before it is freed
      this.ghost?.removeFromParent(); this.selRing?.removeFromParent();
      this.rangeMesh = undefined; this.rangeFor = undefined;
    }
    const inside = (o?: THREE.Object3D) => { for (let p = o?.parent; p; p = p.parent) if (p === loaded.root) return true; return false; };
    if (inside(this.backdrop)) this.backdrop = undefined;
    if (inside(this.context)) this.context = undefined;
    this.fades.delete(loaded);
    if (this.resident.get(loaded.path) === loaded) this.resident.delete(loaded.path);
    this.dispose(loaded);
    this.stage?.showProxy(loaded.path, true);
    this.syncNest();
  }
  /** Free a built map (placed or not): everything under its root, its coverage textures, its token figures, its ghost. */
  private dispose(loaded: Loaded): void {
    if (this.freed.has(loaded)) return;
    this.freed.add(loaded);
    disposeTree(loaded.root);
    loaded.ghost?.dispose(); loaded.ghost = undefined;
    for (const tx of loaded.covTex.values()) tx.dispose();
    loaded.tokens.clear();
  }
  private freed = new WeakSet<Loaded>();
  /** Leaving the valley (a legacy map, another campaign): every map it holds is freed, every build in flight dropped. */
  private releaseAll(): void {
    for (const t of this.streams.values()) t.cancelled = true;
    this.streams.clear();
    for (const r of [...this.resident.values()]) if (r !== this.cur) this.release(r);
    this.resident.clear();
    this.streamer.stop();
  }

  // ------------------------------------------------------------------ streaming: the valley's maps come and go

  /** The maps standing in the valley, by path: the active one and the ghosts (render/streamer.ts decides which). */
  readonly resident = new Map<string, Loaded>();
  /** Builds in flight (the streamer's), by path. */
  private streams = new Map<string, { cancelled: boolean }>();
  /** A place whose map could not be read (offline) is not tried again for a while; its proxy stays. */
  private streamFailed = new Map<string, number>();
  /** Scenes whose files were asked for ahead of a build (once each). */
  private prefetched = new Set<string>();
  /** What each streamed build cost: total ms, slices, the longest slice (tests and the HUD read it). */
  readonly streamLog: { path: string; ms: number; slices: number; longest: number; flying: number; uploads?: number }[] = [];
  /** Crossfades in flight: a ghost's opacity and tint gliding to a target, then a callback. */
  private fades = new Map<Loaded, { from: number; to: number; tint0: number; tint1: number; t0: number; dur: number; done?: () => void; switch?: boolean }>();
  private fadeRaf = 0;
  readonly streamer: Streamer = new Streamer(this.streamHost());

  private streamHost(): StreamHost {
    // the open campaign's pin roots: the maps that stand in the valley by themselves
    let sites: { id: string; list: AtlasScene[] } | undefined;
    const app = this; // eslint-disable-line @typescript-eslint/no-this-alias
    return {
      get world() { return app.world; }, // (the field is set in the constructor, after this host is made)
      streaming: () => this.nested && this.staged && !!this.stage && this.renderMode === 'normal',
      sites: () => {
        if (sites?.id !== this.campaign.id) sites = { id: this.campaign.id, list: Object.values(ATLAS.scenes).filter((e) => e.campaign === this.campaign.id && e.depth === 0 && !e.orphan && !!e.pin && !!e.worldBounds) };
        const now = performance.now(), ok = (e: AtlasScene) => !((this.streamFailed.get(e.path) ?? -Infinity) > now);
        // and the buildings and area maps of every map the valley holds (measured where they hang, in W)
        const kids: AtlasScene[] = [];
        for (const r of this.resident.values()) if (!this.streams.has(r.path)) for (const k of this.childrenOf(r.path)) { const e = ok(k) ? this.streamSite(k) : undefined; if (e) kids.push(e); }
        return [...sites.list.filter(ok), ...kids];
      },
      chainOf: (p) => this.chainOf(p),
      // a map still being got ready (its buffers going up) counts as loading, not resident
      residentState: (p) => { const r = this.resident.get(p); return r && !this.streams.has(p) ? { drawn: r.drawn } : undefined; },
      loading: (p) => this.streams.has(p),
      // the active map is kept (the party's map is not: it is built again when the camera comes back to it)
      // (and the maps it hangs in: a building's town stays while the building is active)
      pinned: () => new Set(this.cur ? [this.cur.path, ...this.chainOf(this.cur.path)] : []),
      activePath: () => this.cur?.path,
      autoActivate: () => this.mode === 'dm',
      busy: () => this.world.userMoving,
      measured: (list) => { const st = this.stage; if (st) for (const s of list) st.viewDetail(s.path, s.inView ? s.px / s.units : 0); },
      cancel: (p) => { const t = this.streams.get(p); if (t) t.cancelled = true; },
      // a scene's files are read once ahead of its build; one that cannot be read (offline) is left for a while, like
      // a failed build (the proxy stays)
      prefetch: (p) => {
        if (this.prefetched.has(p)) return;
        this.prefetched.add(p);
        loadLocation(p).catch(() => { this.prefetched.delete(p); this.streamFailed.set(p, performance.now() + 20000); });
      },
      streamIn: (p) => { void this.streamIn(p); },
      fold: (p, on) => this.fold(p, on),
      unload: (p) => { const r = this.resident.get(p); if (r && r !== this.cur) this.release(r); this.syncStage(); },
      activateStreamed: (p) => { const r = this.resident.get(p); if (r) this.switchActive(r); },
    };
  }

  /** Stand a built map at its pin in the valley (it joins the resident maps; its grid stays on its own floors). */
  private standInValley(l: Loaded, entry: AtlasScene): boolean {
    if (!entry.depth) this.stage!.placeRoot(l, entry);
    else {
      // a child hangs in its parent's root, at the room that opens it (its own placement is in the parent's frame)
      const up = entry.parent ? this.resident.get(entry.parent) : undefined;
      if (!up) return false;
      this.stage!.placeChild(l, entry, up);
    }
    // the grid stays on the map, not over the valley, and goes as the camera pulls back to the town and road bands
    l.root.traverse((o) => { if (o.userData.role === 'grid') { clipGrid(o as THREE.Mesh, 10); fadeGridBelow(o as THREE.Mesh, 0.6); } });
    l.root.traverse((o) => { if (o.userData.worldStandin) veil(o, 'world-standin', true); });
    this.resident.set(l.path, l);
    return true;
  }
  /** Each place's proxy shows exactly while its map is not drawn whole (a crossfade keeps it until the map is in). */
  private syncProxies(): void {
    const st = this.stage; if (!st) return;
    for (const id of st.proxies.keys()) {
      if (id.includes('@')) continue;
      const r = this.resident.get(id), f = r && this.fades.get(r);
      st.showProxy(id, !(r && r.drawn && !(f && f.to > f.from)));
    }
    this.syncSecrets();
    this.syncNest();
  }
  /** A child drawn whole in its parent hides the parent's own model of it (its house, its yard: render/hideUnder.ts),
   *  exactly while it is drawn (a crossfade keeps the model until the child is in; folding brings it back at once).
   *  Overlapping children are undone and redone together, so every face comes back exactly. */
  private syncNest(): void {
    const want: Loaded[] = [];
    for (const r of this.resident.values()) {
      const e = ATLAS.scenes[r.path], up = e?.depth && e.parent ? this.resident.get(e.parent) : undefined;
      const f = this.fades.get(r);
      if (up && r.drawn && r.root.visible && !(f && f.to > f.from)) want.push(r);
    }
    const key = want.map((r) => r.path).sort().join('|');
    if (key !== this.nestKey) {
      this.unnestAll();
      for (const r of want) {
        const e = ATLAS.scenes[r.path], up = this.resident.get(e.parent!)!;
        r.nest = { child: r.path, faces: [], objects: [], labels: [] };
        for (const [id, box] of this.nestBoxes(e, up)) {
          const m = hideUnder(up, id, grow(boundsInParent(e.placement, box), 8), r.path);
          r.nest.faces.push(...m.faces); r.nest.objects.push(...m.objects); r.nest.labels.push(...m.labels);
        }
        this.nests.push(r);
      }
      this.nestKey = key;
      this.world.invalidate();
    }
    this.syncUnderground();
  }
  /** What a child covers on each level of its parent (in the child's frame): the child's levels that stand within that
   *  level's height (its floor up to its ceiling), so a building hides the town's model of it on the street and an
   *  abbey the village's model of it on the ledge 400 ft up; the room that opens it is always covered. */
  private nestBoxes(e: AtlasScene, up: Loaded): Map<string, Bounds> {
    const out = new Map<string, Bounds>(), dy = e.placement.position[1];
    const add = (id: string, b: Bounds) => { const o = out.get(id); out.set(id, o ? { minX: Math.min(o.minX, b.minX), minZ: Math.min(o.minZ, b.minZ), maxX: Math.max(o.maxX, b.maxX), maxZ: Math.max(o.maxZ, b.maxZ) } : b); };
    if (e.enterRoom) add(e.enterRoom.level, e.bbox);
    for (const pl of up.scene.levels) {
      const lo = pl.elevationFt - 2, hi = pl.elevationFt + Math.max(2, pl.ceilingFt ?? 10);
      for (const cl of e.levels) { const y = cl.elevationFt + dy; if (cl.bbox && y >= lo && y < hi) add(pl.id, cl.bbox); }
    }
    return out;
  }
  private nests: Loaded[] = [];
  private nestKey = '';
  /** Every parent's massing back (latest first). */
  private unnestAll(): void {
    for (const r of this.nests.reverse()) if (r.nest) { restoreUnder(r.nest); r.nest = undefined; }
    this.nests = []; this.nestKey = '';
  }
  /** A child's floor below the ground it stands on (Death House's dungeon) would lie buried under its town and the
   *  land: while one is shown the valley and the other maps are left out of the frame, the mist floor under it, as
   *  the legacy way hides the surroundings. */
  underground = false;
  private syncUnderground(): void {
    const c = this.cur, e = c ? this.stageEntry(c.path) : undefined;
    const lv = c && c.levels.has(this.levelId) ? c.scene.levels.find((l) => l.id === this.levelId) : undefined;
    const under = !!(c && lv && e && (e.depth || SITE_INTERFACES[c.path]?.excavate) && this.staged && lv.elevationFt < groundOf(c.scene).elevationFt - 1);
    if (!under && !this.underground) return;
    this.underground = under;
    if (this.stage) veil(this.stage.root, 'under', under);
    // every map in the valley goes (or comes back), then the active one, which may hang inside one of them (Death
    // House in its village), comes back whole: no root is skipped, so nothing keeps a reason from a scope left behind
    for (const r of this.resident.values()) if (r.root.parent === this.world.root) veil(r.root, 'under', under && r !== c);
    if (c) veil(c.root, 'under', false);
    this.world.mistFloor.visible = ((!this.backdrop && !this.staged) || under) && this.world.fogOn && this.renderMode === 'normal';
    this.world.invalidate();
  }
  /** What a ghost of this map shows: its ground level and the floors on it, cut as the active map would be. */
  private ghostLook(l: Loaded): GhostLook {
    const sc = l.scene, lv = groundOf(sc), shown = sc.stacked ? this.stackOf(lv.id, sc) : new Set([lv.id]);
    const top = Math.max(...sc.levels.map((x) => x.elevationFt + (x.ceilingFt ?? 10)));
    const cutFt = sc.stacked === 'open' ? top + 12 : sc.stacked ? lv.elevationFt + (lv.ceilingFt ?? 10) - 0.5 : this.lowWalls ? lv.elevationFt + WALL_CUT_FT : null;
    return { level: lv.id, shown, cutFt, lowWalls: this.lowWalls, revealed: revealSets(this.state, sc.location).objects, restricted: this.restricted };
  }
  /** Draw a map as a ghost (render/ghost.ts), at a tint (0 looks exactly as active). */
  private ghostify(l: Loaded, tint: number): void {
    const g = (l.ghost ??= new Ghost(new THREE.Color(this.world.theme.mist)));
    g.apply(l, this.ghostLook(l)); g.set(g.opacity, tint); g.place(l.root);
    // players never see inside a place they are not in (an interior's ghost is hidden on their side)
    l.root.visible = l.drawn && !(this.restricted && ATLAS.scenes[l.path]?.interior);
  }
  /** The active map steps down to a ghost: what only the active map has (selection, ruler, range, tokens) goes. */
  private leaveActive(l: Loaded): void {
    this.select(null); this.onLeave?.(); this.clearRuler();
    this.ghost?.removeFromParent(); this.selRing?.removeFromParent();
    if (this.rangeMesh) disposeTree(this.rangeMesh); this.rangeMesh = undefined; this.rangeFor = undefined;
    for (const g of l.tokens.values()) disposeTree(g);
    l.tokens.clear();
    this.ghostify(l, 0);
    this.fadeTo(l, l.drawn ? 1 : 0, GHOST_TINT); // the mist's tint comes on gently
  }
  /** The camera's target settled in another drawn map: it becomes the active one (no flight, no travel: the party
   *  stays where it is). The tint glides off first, so the swap to its live materials does not show. */
  private switchActive(next: Loaded): void {
    const old = this.cur;
    if (!old || old === next || !this.staged || this.resident.get(next.path) !== next || this.switching === next) return;
    const seq = this.navSeq; // an open or a climb meanwhile (Enter on a building, Back, a crumb) wins over this
    const swap = () => {
      if (seq !== this.navSeq || this.cur === next || this.resident.get(next.path) !== next || !this.staged) return;
      const prev = this.cur;
      if (prev) this.leaveActive(prev);
      this.cur = next;
      if (next.drawn) next.ghost?.restore(next);
      this.world.reanchor(this.absOf(next));
      // looking is not travelling: the map a reload opens (mistlab.scene) stays the one the party was taken to, and a
      // map the camera alone made active gets no party token
      this.activate(next, { levelId: groundOf(next.scene).id, travel: false, token: false });
      this.broadcast();
      this.syncStage();
      this.syncNest();
    };
    // folded away (the camera is out over the valley): nothing to fade, it takes the role as it is; it takes its own
    // materials when it is drawn again
    if (!next.drawn) { swap(); return; }
    this.switching = next;
    this.fadeTo(next, 1, 0, true, () => {
      this.switching = undefined;
      if (!next.drawn) return;
      swap();
    });
  }
  private switching?: Loaded;
  /** A navigation (an open, a climb) takes over: a camera activation still fading in is dropped, its map stays a
   *  ghost where it is (the streamer may make it active again later, if the camera settles on it). */
  private cancelSwitch(): void {
    const left = [...this.fades].filter(([, f]) => f.switch).map(([l]) => l);
    this.switching = undefined;
    // (its tint was gliding off to take the role: it glides back on, a ghost among the others)
    for (const l of left) { this.fades.get(l)!.switch = false; this.fades.get(l)!.done = undefined; if (l !== this.cur) this.fadeTo(l, l.drawn ? 1 : 0, GHOST_TINT); }
  }
  /** Fold a map into its proxy (the proxy shows, the map fades out and goes) or bring it back (it fades in over the
   *  proxy, which then goes). The active map folds too at valley zoom (it stays active: tokens, tools and minimap). */
  private fold(path: string, on: boolean): void {
    const l = this.resident.get(path); if (!l) return;
    if (on) {
      if (!l.drawn) return;
      l.drawn = false;
      if (!l.ghost?.on) this.ghostify(l, 0); // the active map: a ghost that looks exactly like it, to fade
      l.root.visible = true;
      this.fadeTo(l, 0, l.ghost!.tint);
    } else {
      if (l.drawn) return;
      const tint = l === this.cur ? 0 : GHOST_TINT;
      if (!l.root.visible) l.ghost?.set(0);
      l.drawn = true;
      if (!l.ghost?.on) this.ghostify(l, tint); else l.root.visible = !(this.restricted && ATLAS.scenes[l.path]?.interior);
      this.fadeTo(l, 1, tint);
    }
    this.syncProxies();
    this.syncStage();
  }
  /** Glide a ghost's opacity and tint (render/streamer.ts STREAM.fadeMs); a later glide takes over from where this
   *  one is. At the end: a map faded out goes, a proxy shows exactly while its map is not drawn whole, the active map
   *  faded back in takes its own materials again; `done` (a camera activation) runs only if not overtaken. */
  private fadeTo(l: Loaded, to: number, tint: number, isSwitch = false, done?: () => void): void {
    const g = l.ghost; if (!g) { done?.(); return; }
    if (this.fades.get(l)?.switch) this.switching = undefined; // an activation overtaken (the camera moved on)
    this.fades.set(l, { from: g.opacity, to, tint0: g.tint, tint1: tint, t0: performance.now(), dur: STREAM.fadeMs, done, switch: isSwitch });
    if (!this.fadeRaf) this.fadeRaf = requestAnimationFrame(this.stepFades);
  }
  private fadeEnded(l: Loaded): void {
    const g = l.ghost;
    if (g && !l.drawn && g.opacity < 0.001) l.root.visible = false;
    if (g?.on && l === this.cur && l.drawn && g.opacity >= 0.999 && this.resident.get(l.path) === l) { g.restore(l); this.setLevel(this.levelId); }
    this.syncProxies();
  }
  private stepFades = (): void => {
    this.fadeRaf = 0;
    const now = performance.now();
    for (const [l, f] of [...this.fades]) {
      const k = Math.min(1, (now - f.t0) / f.dur), e = k * k * (3 - 2 * k);
      l.ghost?.set(f.from + (f.to - f.from) * e, f.tint0 + (f.tint1 - f.tint0) * e);
      if (k >= 1) { this.fades.delete(l); this.fadeEnded(l); f.done?.(); }
    }
    this.world.invalidate();
    if (this.fades.size) this.fadeRaf = requestAnimationFrame(this.stepFades);
  };
  /** Stream a map in: read it, build it a slice per frame (never during a glide), stand it at its pin as a ghost and
   *  crossfade it in over its proxy. A map that cannot be read keeps its proxy, and the status line says so once. */
  private async streamIn(path: string): Promise<void> {
    if (this.streams.has(path) || this.resident.has(path)) return;
    const token = { cancelled: false }, campaign = this.campaign, state = this.state, name = ATLAS.scenes[path]?.name ?? path;
    this.streams.set(path, token);
    const t0 = performance.now(); let slices = 0, longest = 0, flying = 0;
    let next: Loaded | undefined;
    // the DM sees what is on its way (the title still names the active map until the camera makes this one active)
    const loadingNote = `Loading ${name}…`;
    if (this.mode === 'dm') this.setStatus(loadingNote);
    try {
      const files = await loadLocation(path);
      const it = this.loadSteps(path, files, { campaign, state });
      let r: IteratorResult<void, Loaded> | undefined;
      while (!r?.done) {
        await new Promise<void>((go) => requestAnimationFrame(() => setTimeout(go, 0))); // after a frame is drawn
        if (token.cancelled || this.campaign !== campaign) { it.return(undefined as never); return; }
        if (this.world.flying) { flying++; continue; }
        const s0 = performance.now();
        do r = it.next(); while (!r.done && performance.now() - s0 < STREAM.sliceMs);
        longest = Math.max(longest, performance.now() - s0); slices++;
      }
      next = r.value;
      const entry = this.stageEntry(path);
      if (token.cancelled || this.campaign !== campaign || !this.staged || !this.stage || !entry || this.resident.has(path)) return;
      if (entry.depth && !(entry.parent && this.resident.get(entry.parent)?.drawn)) return; // its town folded or went meanwhile
      this.streamLog.push({ path, ms: Math.round(performance.now() - t0), slices, longest: Math.round(longest * 10) / 10, flying });
      if (this.streamLog.length > 50) this.streamLog.shift();
      next.drawn = false;
      this.standInValley(next, entry);
      this.ghostify(next, GHOST_TINT);
      // its shaders and buffers on the GPU a little at a time, so its first frame does not stall: as a ghost (how it
      // fades in) and with its own materials (how it draws once the camera makes it active)
      const g = next.ghost!, built = next, live = () => this.resident.get(path) === built && this.staged && !token.cancelled && this.cur !== built;
      const pause = () => this.world.flying;
      g.set(1);
      const up = await this.world.upload(next.root, STREAM.sliceMs, pause, () => !live());
      if (!live()) return;
      g.set(0.5); // half faded: how it draws during the crossfade
      await this.world.upload(next.root, STREAM.sliceMs, pause, () => !live() || !g.on);
      if (!live()) return;
      g.set(0);
      const look = this.ghostLook(next);
      g.restore(next); this.liveLook(next, look);
      await this.world.upload(next.root, STREAM.sliceMs, pause, () => !live() || g.on);
      if (this.cur !== built && !g.on) this.ghostify(built, GHOST_TINT); // (unless an open() made it the active map meanwhile)
      if (!live()) return;
      g.set(0);
      this.streamLog[this.streamLog.length - 1].uploads = up;
      this.fold(path, false); // in it comes, over its proxy
    } catch (err) {
      console.warn(`mistLAB: could not stream ${path}`, err);
      this.streamFailed.set(path, performance.now() + 20000);
      if (this.mode === 'dm') this.flashStatus(`Couldn't load ${name} (offline?)`);
    } finally {
      if (this.streams.get(path) === token) this.streams.delete(path);
      // a build that will not be drawn is freed: dropped, overtaken by an open() of its own map, or the valley gone
      if (next && this.cur !== next) {
        const placed = this.resident.get(path) === next;
        if (placed && (token.cancelled || !this.staged)) this.release(next);
        else if (!placed) this.dispose(next);
      }
      if (this.status === loadingNote) this.setStatus('');
      this.streamer.poke();
    }
  }
  /** A ghost's map with its own materials, levels shown and cut as it will be when active (the warm-up before its
   *  first frame as the active map; its root stays hidden). */
  private liveLook(l: Loaded, look: GhostLook): void {
    for (const [lid, b] of l.levels) b.root.visible = look.shown.has(lid);
  }

  /** Make a built map the current one and stand it in the world: at its pin inside the valley (the continuous world),
   *  or alone at the origin with its backdrop and, for an area map, its parent's surroundings (the legacy way). */
  private place(loaded: Loaded, ups: Loaded[] = []): void {
    this.cur = loaded;
    // (a map the valley already holds stays where it stands: a building streamed in hangs in its town's root)
    if (this.resident.get(loaded.path) !== loaded) this.world.root.add(loaded.root);
    if (this.backdrop) disposeTree(this.backdrop); this.backdrop = undefined;
    if (this.context) disposeTree(this.context); this.context = undefined;
    const entry = this.stageEntry(loaded.path);
    if (entry) {
      if (!this.stage) {
        this.stage = new WorldStage(this.world, this.campaign, worldOf(this.campaign)); this.world.root.add(this.stage.root);
        this.stage.onPick = (p) => { if (this.mode === 'dm' && !this.restricted) this.onPlacePick?.(p); };
        this.stage.onCartoHalf = () => { if (this.staged) this.stage?.setParty(this.partyMark()); };
      }
      this.stage.root.visible = this.renderMode === 'normal';
      this.staged = true;
      this.world.setNested(true);
      // the maps it hangs in stand first (root first), drawn as ghosts round it
      for (const u of ups) {
        if (this.resident.get(u.path) !== u) { this.standInValley(u, this.stageEntry(u.path)!); u.drawn = true; this.fades.delete(u); this.ghostify(u, GHOST_TINT); }
        else if (!u.drawn) this.fold(u.path, false); // folded away: it comes back round the map that opens in it
      }
      if (this.resident.get(loaded.path) !== loaded) this.standInValley(loaded, entry);
      // the map comes alive: drawn whole, with its own materials
      this.fades.delete(loaded); loaded.root.visible = true; loaded.drawn = true;
      if (loaded.ghost?.on) { loaded.ghost.restore(loaded); loaded.ghost.set(1, 0); }
      this.syncProxies();
      this.stage.fitCamera(); // the far limit frames the whole valley
      // the floating origin moves onto the map: it is drawn where it always was, the valley round it
      this.world.reanchor(this.absOf(loaded));
      return;
    }
    if (this.stage) { this.stage.root.visible = false; this.stage.detachLabels(); } // (hidden names never stay in the page)
    this.staged = false;
    loaded.root.traverse((o) => { if (o.userData.worldStandin) veil(o, 'world-standin', false); });
    if (this.world.nested) this.world.setNested(false);
    this.world.reanchor(new THREE.Vector3());
    const { scene } = loaded, path = loaded.path;
    const pin = pinForScene(path) ?? (scene.parent ? pinForScene(scene.parent) : undefined);
    // The level that meets the open air (the one with terrain: a courtyard, a street) decides outdoor fog and the backdrop.
    const l0 = scene.levels.find((l) => l.terrain?.length) ?? scene.levels[0], outdoor = !!pin && !!l0.terrain?.length && (l0.ambient ?? scene.ambient) !== 'darkness';
    // Outdoors: the land, forest, mountains and the castle continue to the horizon.
    if (outdoor) {
      const bb = bounds([...l0.rooms.map((r) => r.polygon), ...(l0.terrain ?? []).map((t) => t.polygon)]);
      const roadLike = (f: string | undefined, name = '') => f === 'cobble' || f === 'dirt' || /road|street|lane|square|path|trail|track/i.test(name);
      const roads = [...l0.rooms.filter((r) => roadLike(r.floor, r.name)).map((r) => r.polygon), ...(l0.terrain ?? []).filter((t) => roadLike(t.floor)).map((t) => t.polygon)];
      // the map's own ground (by area: grass, snow, marsh, earth) is what the land beside it blends into
      const area = (poly: Vec2[]) => Math.abs(poly.reduce((a, [x, z], i) => { const [x2, z2] = poly[(i + 1) % poly.length]; return a + x * z2 - x2 * z; }, 0)) / 2;
      const byFloor = new Map<string, number>(); for (const t of l0.terrain ?? []) if (['grass', 'snow', 'marsh', 'dirt', 'shallow-water'].includes(t.floor)) byFloor.set(t.floor, (byFloor.get(t.floor) ?? 0) + area(t.polygon as Vec2[]));
      const ground = [...byFloor.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      this.groundFt = l0.elevationFt;
      this.backdrop = buildBackdrop({ ground: ground === 'shallow-water' || ground === 'dirt' ? undefined : ground, center: [(bb.minX + bb.maxX) / 2, (bb.minZ + bb.maxZ) / 2], radius: Math.hypot(bb.maxX - bb.minX, bb.maxZ - bb.minZ) / 2, elevation: l0.elevationFt, pin: pin!.pos as Vec2, world: worldOf(this.campaign), theme: this.campaign.theme, valley: !!scene.valley, bounds: bb, north: l0.north, roads, crag: pin!.heightFt ?? 0, clearing: scene.clearingFt ?? (scene.parent ? 1100 : undefined) }); // an area map inside a town keeps the town's ground clear
      loaded.root.add(this.backdrop); // the land round the map is in the map's own frame
    }
    // An area map stands in its surroundings: the parent map's streets, houses and trees round it, as scenery.
    if (scene.parent) void this.buildContext(path, scene, l0);
  }

  /** The current map comes alive: fog and light for where it stands, the party's place on the world map, its tokens,
   *  its level; framed (or flown to) if asked. Looking is not travelling: an open (a place's name, the world map's
   *  disc, a crumb, the library, a reload) moves the camera and gives the map the party's token (`token`), but the
   *  party's place on the world map and its trail change only on an explicit travel (`travel`; the drag of the
   *  party's '&' in ui/worldnest.ts and ui/worldmap.ts calls moveWorld itself), or when the party has no place yet
   *  (a new campaign starts where its first map is, with no trail behind it). */
  activate(loaded: Loaded, opts: { levelId?: string; frame?: boolean | 'fly'; travel?: boolean; token?: boolean } = {}): void {
    this.cur = loaded;
    const { scene, levels } = loaded, path = loaded.path, levelId = opts.levelId;
    // The world-map marker follows the party into whichever pin this scene belongs to.
    const pin = pinForScene(path) ?? (scene.parent ? pinForScene(scene.parent) : undefined);
    const l0 = scene.levels.find((l) => l.terrain?.length) ?? scene.levels[0], outdoor = !!pin && !!l0.terrain?.length && (l0.ambient ?? scene.ambient) !== 'darkness';
    const span = Math.hypot(bounds(l0.rooms.map((r) => r.polygon).concat((l0.terrain ?? []).map((t) => t.polygon))).maxX - bounds(l0.rooms.map((r) => r.polygon).concat((l0.terrain ?? []).map((t) => t.polygon))).minX, 1);
    this.world.fogScale = outdoor ? Math.min(1, 900 / span) : 1;
    this.world.setOutdoor(outdoor);
    this.applySky();
    // the party's place on the world map: an explicit travel, or its first place when an open finds it has none yet
    // (never the camera looking at a map)
    const travel = opts.travel ?? false, token = opts.token ?? true;
    if (pin && (travel || (token && !this.state.world)) && this.state.world?.key !== pin.key) this.moveWorld([...pin.pos] as Vec2, pin.key, this.state.world ? Math.hypot(this.state.world.pos[0] - pin.pos[0], this.state.world.pos[1] - pin.pos[1]) : 0, false);
    if (token) this.ensureDefaultToken();
    const id = levelId && levels.has(levelId) ? levelId : scene.entry && levels.has(scene.entry) ? scene.entry : scene.levels[0].id;
    this.setLevel(id, opts.frame === true);
    if (opts.frame === 'fly') this.frameLevel(this.camPreset, true);
    this.syncStage();
    this.onChange?.();
  }

  /** A place's name was tapped in the valley (the DM's view): main.ts opens its map, which flies there. */
  onPlacePick: ((path: string) => void) | null = null;

  /** In the valley the camera's target rides on the ground: off the open map it follows the land (a pan onto a
   *  mountain lifts it), so zooming in there comes down onto the ground and never under it. On the map the level's
   *  floor holds it, as always. */
  followGround(): void {
    const st = this.stage, c = this.cur; if (!st || !this.staged || !c || this.world.flying || this.renderMode !== 'normal') return;
    // (the whole map: a building's every floor, an abbey's ledge 400 ft over the foot of its cliff)
    const w = this.world, t = w.controls.target, p = this.toLocal3(t), e = wholeExtent(c.scene);
    if (p.x >= e.minX - 20 && p.x <= e.maxX + 20 && p.z >= e.minZ - 20 && p.z <= e.maxZ + 20) return;
    // off a building but over its town: the town's ground holds it
    let y = NaN;
    for (const up of this.chainOf(c.path)) {
      const u = this.resident.get(up); if (!u) continue;
      const g = groundOf(u.scene), b = extentOf(g), q = u.root.worldToLocal(t.clone());
      if (q.x >= b.minX - 20 && q.x <= b.maxX + 20 && q.z >= b.minZ - 20 && q.z <= b.maxZ + 20) { y = u.root.localToWorld(new THREE.Vector3(q.x, g.elevationFt, q.z)).y; break; }
    }
    if (!Number.isFinite(y)) { const abs = w.toAbsolute(t); y = st.groundAt(abs.x, abs.z) - w.anchor.y; }
    if (!Number.isFinite(y) || Math.abs(y - t.y) < 1) return;
    w.camera.position.y += y - t.y; t.y = y;
    w.camera.updateMatrixWorld(); w.invalidate();
  }

  /** The valley follows the table: labels by what the players know, the party's marker where it stands. */
  syncStage(): void {
    const st = this.stage; if (!st || !this.staged) return;
    st.setParty(this.partyMark());
    st.trail = (this.state.world?.trail ?? []).slice(-12).map((t) => t.pos);
    st.onView({ restricted: this.playersSide, revealed: this.pinsRevealed });
    this.syncSecrets();
  }
  /** The players' side never sees a place it does not know: a map the valley holds (streamed in as the camera passed)
   *  whose place is not revealed is not drawn for them, unless it is the open map or one it stands in. The DM sees
   *  them all. (Its proxy, its label and its symbol go too: worldstage.ts.) */
  private syncSecrets(): void {
    const rev = this.pinsRevealed, keep = new Set(this.cur ? [this.cur.path, ...this.chainOf(this.cur.path)] : []);
    for (const r of this.resident.values()) {
      if (r.root.parent !== this.world.root) continue; // (a building hangs in its town and goes with it)
      const key = ATLAS.scenes[r.path]?.pin, secret = this.playersSide && !!key && !rev.has(key) && !keep.has(r.path);
      if (!!r.root.userData.secret !== secret) { r.root.userData.secret = secret; veil(r.root, 'secret', secret); this.world.invalidate(); }
    }
  }
  /** Where the party's '&' stands on the land (absolute feet), or null where the party's own token shows: on the active
   *  map while it is drawn. On a ghost (the party's map drawn but not active) it stands on the party token's spot;
   *  otherwise on the party's place on the world map. */
  private partyMark(): { at: Vec2; y?: number } | null {
    const w = this.state.world; if (!w) return null;
    const root = w.key ? ATLAS.pins.find((p) => p.campaign === this.campaign.id && p.key === w.key)?.root : undefined;
    // the map the party was taken to, if the valley holds it (a building of the town), else the town
    const path = this.home && this.resident.get(this.home) && (this.home === root || this.chainOf(this.home).includes(root ?? '')) ? this.home : root;
    const r = path ? this.resident.get(path) : undefined;
    // (far out, where the land is drawn as the world map, the '&' stands on the party's token: the token is too small to see)
    if (r && r === this.cur && r.drawn && (this.stage?.carto.k ?? 0) < 0.5) return null;
    const tok = r?.drawn ? this.state.tokens.find((t) => t.location === r.scene.location && t.role === 'party') : undefined;
    const lv = tok && r ? r.scene.levels.find((l) => l.id === tok.level) : undefined;
    if (r && tok && lv) {
      const v = r.root.localToWorld(new THREE.Vector3(tok.pos[0], lv.elevationFt, tok.pos[1])), a = this.world.toAbsolute(v);
      return { at: [a.x, a.z], y: a.y };
    }
    return { at: worldOfMiles(worldOf(this.campaign), w.pos) };
  }

  // ------------------------------------------------------------------ nesting: in and out of a town's buildings

  /** The map this one belongs to: its parent, else the town its world-map place opens first (Death House and the
   *  church stand in the village). Undefined on a top-level map. */
  get parentPath(): string | undefined {
    const c = this.cur; if (!c) return undefined;
    // in the valley: the map it hangs in, by the atlas (a pin's root map hangs in the valley itself: the breadcrumb)
    if (this.staged) { const e = ATLAS.scenes[c.path]; return e?.depth && e.parent && this.resident.has(e.parent) ? e.parent : undefined; }
    if (c.scene.parent) return builtPaths.has(c.scene.parent) ? c.scene.parent : undefined;
    const first = pinForScene(c.path)?.scenes?.[0];
    return first && first !== c.path && builtPaths.has(first) ? first : undefined;
  }

  /** Enter: open the map a room of this one opens, remembering that room. */
  async enter(path: string, fromKey: string): Promise<void> {
    if (this.cur) this.enteredFrom = { parent: this.cur.path, level: this.levelId, key: fromKey, child: path };
    await this.open(path);
  }

  /** The room of a parent map that opens a child map: the one the DM entered from, else one on the level that stands
   *  at the height of the child's ground floor (Krezk's ledge for the abbey), else the first that opens it. */
  anchorIn(par: SceneFile, parPath: string, path: string, scene: SceneFile): { level: Level; room: Room } | undefined {
    const e = this.enteredFrom;
    if (e && e.parent === parPath && e.child === path) {
      const l = par.levels.find((x) => x.id === e.level), r = l?.rooms.find((x) => x.key === e.key && x.enter === path);
      if (l && r) return { level: l, room: r };
    }
    const ground = (scene.levels.find((l) => l.id === scene.entry) ?? scene.levels[0]).elevationFt;
    const opens = par.levels.flatMap((l) => l.rooms.filter((r) => r.enter === path).map((room) => ({ level: l, room })));
    const pick = (xs: typeof opens) => xs.find((x) => x.room.key === scene.location) ?? xs[0];
    return pick(opens.filter((x) => Math.abs(x.level.elevationFt - ground) < 1)) ?? pick(opens);
  }

  /** Up one level: open the map this one belongs to, framed on the room that opens this one, at about this map's span,
   *  on that room's level, with the same compass heading. Without such a room the parent opens as usual. */
  async openParent(): Promise<boolean> {
    const cur = this.cur, up = this.parentPath; if (!cur || !up) return false;
    if (this.staged) return this.climb(up); // in the valley: the camera pulls back and the town takes over
    const par = await loadLocation(up).catch(() => undefined);
    const at = par && this.anchorIn(par.scene, up, cur.path, cur.scene);
    const l0 = groundOf(cur.scene), ext = extentOf(l0);
    const heading = this.world.controls.getAzimuthalAngle() + northTurn(l0.north, at?.level.north);
    await this.open(up, at?.level.id);
    if (!at || this.cur?.path !== up) return true;
    const [cx, cz] = centroidOf(at.room.polygon), hw = (ext.maxX - ext.minX) / 2, hd = (ext.maxZ - ext.minZ) / 2;
    this.frameBox({ minX: cx - hw, minZ: cz - hd, maxX: cx + hw, maxZ: cz + hd }, at.level.elevationFt, this.camPreset, false, heading - this.world.controls.getAzimuthalAngle());
    this.onChange?.();
    return true;
  }

  /** Up the nesting in the valley, without opening anything: the camera glides out to a map this one hangs in and
   *  that map becomes the active one (looking is not travelling: the party stays). `keep` frames it on the place left
   *  (the building stays drawn, small, in its street: Back); otherwise it frames the whole of its open-air level (a
   *  breadcrumb). Resolves once the map is active. */
  async climb(path: string, keep = true): Promise<boolean> {
    const cur = this.cur, up = this.resident.get(path);
    if (!cur || !up || !this.staged || cur === up) return cur === up;
    const g = groundOf(up.scene), seq = ++this.navSeq; // (the latest request wins: an open still loading is dropped)
    this.cancelSwitch();
    if (keep) {
      // over the place just left, pulled back until it is half way between taking the role and giving it back
      // (render/streamer.ts enterPx, leavePx): it stays drawn in its street, small, and the town is the active map
      const f = extentOf(groundOf(cur.scene)), y = groundOf(cur.scene).elevationFt, w = this.world;
      const mid = up.root.worldToLocal(cur.root.localToWorld(new THREE.Vector3((f.minX + f.maxX) / 2, y, (f.minZ + f.maxZ) / 2)));
      const at = up.root.localToWorld(new THREE.Vector3(mid.x, g.elevationFt, mid.z));
      const rc = w.renderer.domElement.getBoundingClientRect(), scr = Math.min(rc.width, rc.height) || 768;
      const focal = (rc.height || 768) / 2 / Math.tan(THREE.MathUtils.degToRad(w.camera.fov / 2));
      const site = { depth: ATLAS.scenes[cur.path]?.depth ?? 1, units: 1 }, px = (enterPx(site, scr) + leavePx(site, scr)) / 2;
      const x = ATLAS.scenes[cur.path]?.extent ?? f; // (the streamer measures a child by its whole stack)
      w.flyTo(at, Math.hypot(x.maxX - x.minX, x.maxZ - x.minZ) * focal / px);
    } else {
      // its open-air level whole, or, when that is much bigger than a town (Vallaki's level runs out over its fields
      // for a mile and more), the town round the place just left, at a span its streets read at
      let box: Bounds = extentOf(g);
      const x = ATLAS.scenes[cur.path]?.extent ?? extentOf(groundOf(cur.scene));
      const span = Math.max(CRUMB_TOWN_FT, 6 * Math.hypot(x.maxX - x.minX, x.maxZ - x.minZ));
      if (Math.max(box.maxX - box.minX, box.maxZ - box.minZ) > 2 * span) {
        const m = up.root.worldToLocal(cur.root.localToWorld(new THREE.Vector3((x.minX + x.maxX) / 2, 0, (x.minZ + x.maxZ) / 2)));
        box = { minX: m.x - span / 2, minZ: m.z - span / 2, maxX: m.x + span / 2, maxZ: m.z + span / 2 };
      }
      const c = up.root.localToWorld(new THREE.Vector3((box.minX + box.maxX) / 2, g.elevationFt, (box.minZ + box.maxZ) / 2)), hw = (box.maxX - box.minX) / 2, hd = (box.maxZ - box.minZ) / 2;
      this.world.frame({ minX: c.x - hw, minZ: c.z - hd, maxX: c.x + hw, maxZ: c.z + hd }, c.y, this.camPreset, 'fly');
    }
    await this.world.settled();
    if (seq !== this.navSeq || this.resident.get(path) !== up) return false;
    if (!up.drawn) this.fold(path, false);
    this.switchActive(up);
    // the role changes once the town's tint has glided off (render/ghost.ts)
    const end = performance.now() + 3000;
    while (this.cur !== up && performance.now() < end && seq === this.navSeq) await new Promise((r) => setTimeout(r, 40));
    this.streamer.tick();
    return this.cur === up;
  }
  /** Where the active map hangs, from the whole valley down to the floor shown: the breadcrumb. */
  crumbs(): { label: string; path?: string; level?: string; kind: 'valley' | 'map' | 'level' }[] {
    const c = this.cur; if (!c) return [];
    // the legacy way: one map alone in the mist, its name as the title always showed it
    if (!this.staged) return [{ label: c.scene.name, path: c.path, kind: 'map' }];
    const short = (n: string) => n.replace(/^The /, '');
    const out: ReturnType<App['crumbs']> = [];
    {
      out.push({ label: short(worldOf(this.campaign).name).replace(/^Lands of /, ''), kind: 'valley' });
      for (const p of [...this.chainOf(c.path)].reverse()) { const u = this.resident.get(p); out.push({ label: short(u?.scene.name ?? ATLAS.scenes[p]?.name ?? p), path: p, kind: 'map' }); }
    }
    out.push({ label: short(c.scene.name), path: c.path, kind: 'map' });
    // (a level named as its map, Krezk's 'Village of Krezk', is the map itself: no second crumb)
    const same = (a: string, b: string) => short(a).toLowerCase() === short(b).toLowerCase();
    if (c.scene.levels.length > 1 && !same(this.level.name, c.scene.name)) out.push({ label: this.level.name, path: c.path, level: this.levelId, kind: 'level' });
    return out;
  }
  /** A breadcrumb was tapped: frame that scope (the whole valley, a map the active one hangs in, the active map, its
   *  floor), flying there; a map up the chain becomes the active one. */
  async goCrumb(i: number): Promise<void> {
    const k = this.crumbs()[i]; if (!k) return;
    if (k.kind === 'valley') { this.stage?.frameWorld('fly'); return; }
    if (k.path && k.path !== this.cur?.path) { await this.climb(k.path, false); return; }
    if (k.kind === 'level') { this.frameLevel(this.camPreset, true); return; }
    // the map itself: its open-air level whole
    const g = groundOf(this.cur!.scene);
    if (g.id !== this.levelId && !this.cur!.scene.stacked) this.setLevel(g.id);
    this.frameBox(extentOf(g), g.elevationFt, this.camPreset, 'fly');
  }

  setLevel(id: string, frame = false): void {
    if (!this.cur) return;
    if (this.cur.path === this.home) this.homeLevel = id;
    if (this.levelId !== id && this.cutFt !== undefined && !this.keepCut) this.cutFt = undefined;
    this.levelId = id;
    // Stacked sites (a house, a treehouse, a tower) show every level at once; the section cut hides what is above.
    const stacked = !!this.cur.scene.stacked;
    const stack = this.stackOf(id);
    for (const [lid, b] of this.cur.levels) b.root.visible = lid === id || (stacked && stack.has(lid));
    if (stacked && this.cutFt === null) this.cutFt = undefined; // follow the level
    const cov = this.cur.coverage.get(id)!;
    fogUniforms.uCovTex.value = this.cur.covTex.get(id)!;
    fogUniforms.uCovOrigin.value.set(cov.originX, cov.originZ);
    fogUniforms.uCovSize.value.set(cov.widthFt, cov.heightFt);
    this.syncPlacement();
    this.world.mistFloor.position.copy(this.toWorld3(0, this.level.elevationFt - 1.2, 0));
    this.world.mistFloor.visible = !this.backdrop && !this.staged && this.world.fogOn; // in the valley the land is the floor
    this.syncUnderground(); // (but not under it: a dungeon below its town stands in the mist)
    this.syncContext();
    this.syncTokens();
    this.recompute();
    if (frame) this.frameLevel();
    this.onChange?.();
  }

  /** The height of the ground the land beyond the map is drawn at (the level that meets the open air). */
  private groundFt = 0;
  /** The plan box of the current stack's floors below that ground (render/backdrop.ts, underBox). */
  private belowGround(): { minX: number; minZ: number; maxX: number; maxZ: number } | null {
    const stack = this.stackOf(this.levelId);
    return underBox(this.cur!.scene.levels.filter((l) => stack.has(l.id)), this.groundFt);
  }
  /** The floors that stand on one another around a level: each one's ceiling meets the next one's floor.
   *  A house and the dungeon dug under its garden are two stacks; an open site (a tower) is one. */
  stackOf(id: string, scene: SceneFile = this.cur!.scene): Set<string> {
    const ls = scene.levels, out = new Set<string>([id]);
    if (scene.stacked === 'open') { for (const l of ls) out.add(l.id); return out; }
    const top = (l: Level) => l.elevationFt + (l.ceilingFt ?? 10);
    const meets = (a: Level, b: Level) => Math.abs(top(a) - b.elevationFt) <= 3 || Math.abs(top(b) - a.elevationFt) <= 3;
    for (let grew = true; grew;) { grew = false; for (const l of ls) if (!out.has(l.id) && ls.some((o) => out.has(o.id) && meets(o, l))) { out.add(l.id); grew = true; } }
    return out;
  }

  get level(): Level { return this.cur!.scene.levels.find((l) => l.id === this.levelId)!; }
  get built(): BuiltLevel { return this.cur!.levels.get(this.levelId)!; }

  frameLevel(preset = this.camPreset, fly = false): void {
    this.camPreset = preset;
    const l = this.level;
    // A stacked site frames the current floor's footprint: the floors above and below share it (a tower,
    // a house), while a level that sits elsewhere in plan (the dungeon under the garden) stays out of frame.
    // With the cut lifted clear above the whole stack the building shows entire: frame every floor of the stack.
    const whole = this.cur!.scene.stacked && this.cutFt !== undefined && this.cutFt !== null && this.sectionRange && this.cutFt >= this.sectionRange.max - 1;
    const polys = whole ? [...this.stackOf(l.id)].flatMap((id) => this.cur!.scene.levels.find((x) => x.id === id)!.rooms.map((r) => r.polygon)) : l.rooms.map((r) => r.polygon);
    const b = bounds(polys);
    if (!this.world.nested) {
      // An area map pulls back far enough to show some of the parent's surroundings drawn round it (buildContext's reach).
      const e = extentOf(l), reach = this.cur!.scene.parent ? (Math.max(e.maxX - e.minX, e.maxZ - e.minZ) / 2 + CONTEXT_FT) * 1.25 : 0;
      this.world.controls.maxDistance = Math.max(400, Math.hypot(b.maxX - b.minX, b.maxZ - b.minZ) * 2.5, reach);
    }
    this.frameBox(b, l.elevationFt, preset, fly ? 'fly' : false);
  }

  // ------------------------------------------------------------------ the scene's placement in the world

  /** Scene → drawn (anchored world) coordinates: the active scene root's matrixWorld, and its inverse. Every
   *  conversion between what the table works in (scene feet, per level) and what the camera sees goes through these. */
  readonly placement = new THREE.Matrix4();
  readonly placementInv = new THREE.Matrix4();
  /** Re-read the active scene's placement and hand the shaders the matching coverage basis. */
  syncPlacement(): void {
    const r = this.cur?.root;
    if (r) { r.updateWorldMatrix(true, false); this.placement.copy(r.matrixWorld); } else this.placement.identity();
    this.placementInv.copy(this.placement).invert();
    covBasisOf(this.placement, fogUniforms.uCovBasis.value);
  }
  /** A scene plan point as drawn (anchored world xz). */
  toWorld(p: Vec2): Vec2 { const v = new THREE.Vector3(p[0], 0, p[1]).applyMatrix4(this.placement); return [v.x, v.z]; }
  /** A drawn (anchored world) xz point in scene feet. */
  toLocal(p: Vec2): Vec2 { const v = new THREE.Vector3(p[0], 0, p[1]).applyMatrix4(this.placementInv); return [v.x, v.z]; }
  toWorld3(x: number, y: number, z: number): THREE.Vector3 { return new THREE.Vector3(x, y, z).applyMatrix4(this.placement); }
  toLocal3(v: THREE.Vector3): THREE.Vector3 { return v.clone().applyMatrix4(this.placementInv); }
  /** How far the scene's floor 0 is lifted in the drawn frame (placements only turn about y, so planes stay level). */
  get placementY(): number { return this.placement.elements[13]; }
  /** The horizontal plane of a scene height, as drawn. */
  private planeAt(y: number): THREE.Plane { return new THREE.Plane(new THREE.Vector3(0, 1, 0), -(y + this.placementY)); }
  /** Frame a box given in scene feet: its centre is placed, its size (what the fit reads) does not change with a turn. */
  frameBox(b: { minX: number; minZ: number; maxX: number; maxZ: number }, y: number, preset: CameraPreset, animate: boolean | 'fly' = false, azimuthDelta = 0): void {
    const c = this.toWorld3((b.minX + b.maxX) / 2, y, (b.minZ + b.maxZ) / 2), hw = (b.maxX - b.minX) / 2, hd = (b.maxZ - b.minZ) / 2;
    this.world.frame({ minX: c.x - hw, minZ: c.z - hd, maxX: c.x + hw, maxZ: c.z + hd }, c.y, preset, animate, azimuthDelta);
  }
  /** Test hook: stand the active scene at an absolute world position, turned about y, and (by default) anchor the
   *  floating origin on it, as the continuous world will. The camera keeps its view of the scene. */
  setPlacement(abs: [number, number, number], rotationY: number, reanchor = true): void {
    if (!this.cur) return;
    const look = this.toLocal3(this.world.controls.target), eye = this.toLocal3(this.world.camera.position);
    this.cur.root.position.set(...abs); this.cur.root.rotation.set(0, rotationY, 0);
    this.syncPlacement(); // before the reanchor: the root moved even if the origin does not
    if (reanchor) this.world.reanchor(new THREE.Vector3(...abs)); else this.world.reanchor(new THREE.Vector3());
    this.world.controls.target.copy(this.toWorld3(look.x, look.y, look.z)); this.world.camera.position.copy(this.toWorld3(eye.x, eye.y, eye.z));
    this.world.camera.lookAt(this.world.controls.target); this.world.controls.update();
    this.setLevel(this.levelId);
    this.applySlider();
  }

  // ------------------------------------------------------------------ tokens

  private ensureDefaultToken(): void {
    const loc = this.cur!.scene.location;
    if (this.state.tokens.some((t) => t.location === loc)) return;
    // Prefer an authored spawn point; otherwise the cell under the first room's centroid.
    let level = this.cur!.scene.levels[0];
    let pos: Vec2 | null = null;
    for (const l of this.cur!.scene.levels) {
      const sp = l.objects.find((o) => o.kind === 'spawn');
      if (sp) { level = l; pos = [sp.pos[0], sp.pos[2]]; break; }
    }
    if (!pos) {
      const b = bounds([level.rooms[0].polygon]);
      pos = [(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2];
    }
    const c = squareCellCenter(squareCellAt(pos));
    // The party carries a torch (PHB 20/40) so unlit maps are playable out of the box.
    this.state.tokens.push({ id: `pc-${loc}`, name: 'Party', location: loc, level: level.id, pos: c, size: 'medium', darkvisionFt: 0, color: PARTY_RED, light: { bright: 20, dim: 40 }, role: 'party' });
  }

  /** The party token for the loaded location. */
  get party(): Token | undefined { const here = this.state.tokens.filter((t) => t.location === this.cur?.scene.location); return here.find((t) => t.role !== 'member') ?? here[0]; }

  // ------------------------------------------------------------------ encounters: initiative, turns, ranges

  get encounter(): Encounter | undefined { const e = this.state.encounter; return e && e.location === this.cur?.scene.location ? e : undefined; }
  get current(): { c: Combatant; sheet: Sheet; token: Token } | undefined {
    const e = this.encounter; if (!e || !e.order.length) return undefined;
    const c = e.order[e.turn % e.order.length], sheet = this.state.roster.find((x) => x.id === c.sheetId), token = this.state.tokens.find((t) => t.id === c.tokenId);
    return sheet && token ? { c, sheet, token } : undefined;
  }
  /** Roll initiative and put one token per combatant on the map around the party marker. */
  startEncounter(entries: { sheetId: string; init: number; tokenId?: string }[]): void {
    if (!this.cur || !entries.length) return;
    const loc = this.cur.scene.location, party = this.party;
    const level = party?.level ?? this.levelId, l = this.cur.scene.levels.find((x) => x.id === level)!;
    const at = party ? this.snap(party.pos) : this.snap([bounds([l.rooms[0].polygon]).minX + 2.5, bounds([l.rooms[0].polygon]).minZ + 2.5]);
    this.endEncounter(false);
    const floor = this.cur.grid.levels[level].floorPolygons.concat(l.rooms.map((r) => r.polygon));
    const free: Vec2[] = [];
    // Spiral outward from the party marker over floor cells.
    for (let ring = 0; ring < 6 && free.length < entries.length + 2; ring++) for (let dj = -ring; dj <= ring; dj++) for (let di = -ring; di <= ring; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue;
      const p: Vec2 = [at[0] + di * 5, at[1] + dj * 5];
      if (floor.some((poly) => pointInPolygon(p, poly)) && canWalk(at, p, moveBlockers(this.effectiveWalls()), floor)) free.push(p);
    }
    const order: Combatant[] = [];
    entries.slice().sort((a, b) => b.init - a.init).forEach((en, i) => {
      const sh = this.state.roster.find((x) => x.id === en.sheetId); if (!sh) return;
      if (en.tokenId) { const t = this.state.tokens.find((x) => x.id === en.tokenId); if (!t) return; t.sheetId = sh.id; order.push({ sheetId: sh.id, tokenId: t.id, init: en.init }); return; }
      const id = `tok-${loc}-${sh.id}`;
      this.state.tokens.push({ id, name: sh.name, location: loc, level, pos: free[i] ?? at, size: sh.size, darkvisionFt: sh.darkvisionFt, color: sh.color, role: 'member', sheetId: sh.id, light: sh.kind === 'pc' && i === 0 ? { bright: 20, dim: 40 } : undefined });
      order.push({ sheetId: sh.id, tokenId: id, init: en.init });
    });
    if (party) this.state.tokens = this.state.tokens.filter((t) => t !== party);
    this.state.encounter = { location: loc, level, round: 1, order, turn: 0, movedFt: 0, partyPos: party?.pos ?? at };
    this.select(null);
    if (level !== this.levelId) this.setLevel(level); else this.syncTokens();
    this.commit();
    this.findParty(true);
  }
  /** Fold the combatants back into one party marker where the first of them stands. */
  endEncounter(save = true): void {
    const e = this.state.encounter; if (!e) return;
    const loc = e.location, members = this.state.tokens.filter((t) => t.role === 'member' && t.location === loc);
    const lead = members[0];
    this.state.tokens = this.state.tokens.filter((t) => !(t.role === 'member' && t.location === loc));
    if (!this.state.tokens.some((t) => t.location === loc)) this.state.tokens.push({ id: `pc-${loc}`, name: 'Party', location: loc, level: lead?.level ?? e.level, pos: lead?.pos ?? e.partyPos, size: 'medium', darkvisionFt: 0, color: PARTY_RED, light: { bright: 20, dim: 40 }, role: 'party' });
    this.state.encounter = undefined;
    this.select(null);
    if (this.cur?.scene.location === loc) this.syncTokens();
    if (save) this.commit();
  }
  nextTurn(dir = 1): void {
    const e = this.encounter; if (!e) return;
    let t = e.turn + dir;
    if (t >= e.order.length) { t = 0; e.round++; } else if (t < 0) { t = e.order.length - 1; e.round = Math.max(1, e.round - 1); }
    e.turn = t; e.movedFt = 0;
    this.select(null);
    const cur = this.current;
    if (cur && cur.token.level !== this.levelId) this.setLevel(cur.token.level);
    this.commit();
    if (cur && this.follow) this.world.moveTo(this.toWorld3(cur.token.pos[0], this.level.elevationFt, cur.token.pos[1]), Math.min(this.world.camera.position.distanceTo(this.world.controls.target), 66), true);
  }
  /** Tactical range of a combatant token from where it stands, with the movement it has left. */
  rangeOf(tokenId: string): RangeResult | undefined {
    const e = this.encounter, t = this.state.tokens.find((x) => x.id === tokenId);
    if (!t || t.level !== this.levelId) return undefined;
    const sheet: Sheet | undefined = (t.sheetId ? this.state.roster.find((x) => x.id === t.sheetId) : undefined) ?? (t.role === 'creature' ? this.creatureSheet(t) : undefined)
      ?? { id: 'party', name: 'Party', color: t.color, speedFt: 30, reachFt: 5, rangeFt: 0, initMod: 0, size: t.size, darkvisionFt: t.darkvisionFt, kind: 'pc' };
    if (!sheet) return undefined;
    const spent = e && this.current?.token.id === tokenId ? e.movedFt : 0;
    const walls = this.effectiveWalls(), g = this.cur!.grid.levels[this.levelId];
    return tacticalRange({ start: t.pos, speedFt: Math.max(0, sheet.speedFt - spent), reachFt: sheet.reachFt, rangeFt: sheet.rangeFt || undefined,
      floor: g.floorPolygons.concat(this.level.rooms.map((r) => r.polygon)), moveBlockers: moveBlockers(walls), sightBlockers: sightBlockers(walls, revealSets(this.state, this.cur!.scene.location).secretWalls),
      occupied: this.tokensHere().filter((x) => x.id !== tokenId).map((x) => x.pos), origin: g.origin, rule: this.diagonalRule });
  }
  diagonalRule: DiagonalRule = 'five';
  private rangeMesh?: THREE.Group;
  private rangeFor?: RangeResult;
  /** Show the current combatant's ranges (per turn, in initiative only). */
  refreshRange(): void {
    if (this.rangeMesh) disposeTree(this.rangeMesh); this.rangeMesh = undefined; this.rangeFor = undefined;
    const cur = this.current;
    // In initiative the current combatant's ranges show every turn; outside it the helper shows the picked-up token's.
    const tokenId = cur ? cur.token.id : this.rangeHelper && this.selected && !this.restricted ? this.selected : undefined;
    const tok = tokenId ? this.state.tokens.find((x) => x.id === tokenId) : undefined;
    if (!tok || tok.level !== this.levelId || this.renderMode === 'floorMask' || this.gridMode === 'hex') { this.world.invalidate(); return; }
    const r = this.rangeOf(tok.id); if (!r) return;
    this.rangeFor = r;
    this.rangeMesh = buildRangeOverlay(r, this.level.elevationFt);
    this.built.root.add(this.rangeMesh);
    this.world.invalidate();
  }

  roomAt(level: Level, p: Vec2) { return level.rooms.find((r) => pointInPolygon(p, r.polygon)); }
  /** The room an object of the current level belongs to: its area key, else the room it stands in (a shaped piece by its outline). */
  roomOf(o: SceneObject): Room | undefined { return (o.key ? this.level.rooms.find((r) => r.key === o.key) : undefined) ?? this.roomAt(this.level, o.polygon?.length ? centroidOf(o.polygon as Vec2[]) : [o.pos[0], o.pos[2]]); }
  /** The map a room opens with Enter, when it is built: offered to the DM only. */
  enterOf(room: Pick<Room, 'enter'> | undefined): string | undefined { return !this.restricted && room?.enter && builtPaths.has(room.enter) ? room.enter : undefined; }

  /** Rooms across levels matching a key or name fragment. */
  findRooms(q: string): { level: Level; room: Level['rooms'][number] }[] {
    const n = q.trim().toLowerCase();
    if (!n || !this.cur) return [];
    const out: { level: Level; room: Level['rooms'][number] }[] = [];
    for (const l of this.cur.scene.levels) for (const r of l.rooms) if (r.key.toLowerCase() === n || r.key.toLowerCase().startsWith(n) || r.name.toLowerCase().includes(n)) out.push({ level: l, room: r });
    return out.sort((a, b) => (a.room.key.toLowerCase() === n ? -1 : b.room.key.toLowerCase() === n ? 1 : a.room.key.length - b.room.key.length));
  }

  /** Jump the camera to an area key (switching level if needed). */
  jumpTo(key: string): boolean {
    const hit = this.findRooms(key)[0];
    if (!hit) return false;
    if (hit.level.id !== this.levelId) this.setLevel(hit.level.id);
    const b = bounds([hit.room.polygon]);
    // On a placement layer a "room" is one 40-ft square: frame it with its neighbourhood, not its doorstep.
    const pad = this.cur!.scene.placementFt ? this.cur!.scene.placementFt * 1.5 : 0;
    this.frameBox({ minX: b.minX - pad, minZ: b.minZ - pad, maxX: b.maxX + pad, maxZ: b.maxZ + pad }, hit.level.elevationFt, this.camPreset, true);
    this.flashKey = hit.room.key;
    this.onChange?.();
    return true;
  }
  flashKey = '';

  /** Frame the camera on the party token. */
  findParty(animate = true): void {
    const t = this.party;
    if (!t || !this.cur) return;
    if (t.level !== this.levelId) this.setLevel(t.level);
    const l = this.level;
    // Close working distance: the party's room and its neighbours fill the screen.
    const dist = Math.min(this.world.camera.position.distanceTo(this.world.controls.target), 66); // ~same on-screen size as before at the wider 40° lens
    this.world.moveTo(this.toWorld3(t.pos[0], l.elevationFt, t.pos[1]), dist, animate);
  }

  /** Is this object currently shown to players (class + reveals + coverage)? */
  playerCanSee(o: SceneObject): boolean {
    const rs = revealSets(this.state, this.cur!.scene.location);
    const base = o.vis === 'player' || o.vis === 'explored' || rs.objects.has(o.id) || (o.vis === 'secret-door' && rs.secretDoors.has(o.id));
    if (!base) return false;
    const cov = this.cur!.coverage.get(this.levelId)!;
    return cov.state(o.pos[0], o.pos[2]) !== Cov.Unexplored;
  }

  /** UI moved the party token directly (menu / list). */
  afterPartyMoveFromUi(): void { this.afterPartyMove(); this.commit(); }

  /** Move the party through a vertical link (either end). */
  takeLink(linkId: string): void {
    const t = this.party, k = this.cur?.scene.links.find((x) => x.id === linkId);
    if (!t || !k) return;
    const here = k.from.level === t.level ? k.from : k.to.level === t.level ? k.to : k.from;
    t.level = here.level; t.pos = squareCellCenter(squareCellAt(here.pos));
    this.afterPartyMove();
    this.commit();
  }

  /** What the DM tapped; the UI turns it into a menu of actions. */
  onTap: ((hit: TapHit, x: number, y: number) => void) | null = null;

  isRevealed(key: string): boolean {
    const loc = this.cur!.scene.location;
    const last = [...this.state.reveals].reverse().find((r) => r.type === 'room' && r.location === loc && r.key === key) as Extract<Reveal, { type: 'room' }> | undefined;
    return !!last && last.mode !== 'fog';
  }

  /** A combatant moved: reveal the room it entered (players' side sees by its own light). */
  private afterMemberMove(t: Token): void {
    const room = this.roomAt(this.level, t.pos), loc = this.cur!.scene.location;
    if (this.autoReveal && room && !this.isRevealed(room.key)) this.state.reveals.push({ type: 'room', location: loc, key: room.key, mode: 'explored' });
    this.recompute();
  }
  /** After the party moves: reveal the room it entered, take stairs it stepped on, follow with the camera. */
  private afterPartyMove(): void {
    const t = this.party;
    if (!t || !this.cur) return;
    const loc = this.cur.scene.location;
    // vertical links: stepping within one cell of an endpoint takes the stairs
    for (const k of this.cur.scene.links) {
      for (const [end, other] of [[k.from, k.to], [k.to, k.from]] as const) {
        if (end.level !== t.level) continue;
        if (Math.hypot(end.pos[0] - t.pos[0], end.pos[1] - t.pos[1]) <= 5.5) {
          t.level = other.level; t.pos = squareCellCenter(squareCellAt(other.pos));
          this.setStatus(`${k.kind === 'trapdoor' ? 'Through the trapdoor' : k.kind === 'dumbwaiter' ? 'Down the dumbwaiter' : 'Took the stairs'} → ${this.cur.scene.levels.find((l) => l.id === other.level)?.name ?? other.level}`);
          this.setLevel(other.level);
          break;
        }
      }
    }
    const l = this.cur.scene.levels.find((x) => x.id === t.level)!;
    const room = this.roomAt(l, t.pos);
    if (room && this.autoReveal && !this.isRevealed(room.key)) this.state.reveals.push({ type: 'room', location: loc, key: room.key, mode: 'explored' });
    if (this.follow) this.findParty(true);
  }

  tokensHere(): Token[] { return this.state.tokens.filter((t) => t.location === this.cur?.scene.location && t.level === this.levelId); }

  private syncTokens(): void {
    const b = this.built;
    // the old figures are freed (their geometry and materials are their own); the selection ring rides on and comes back
    const ringOn = this.selRing?.parent?.userData.tokenId as string | undefined;
    this.selRing?.removeFromParent();
    for (const [id, g] of this.cur!.tokens) { disposeTree(g); this.cur!.tokens.delete(id); }
    for (const t of this.tokensHere()) {
      if (t.role === 'creature' && t.hidden && this.restricted) continue; // not yet shown to the players
      const base = baseRingFt(t.size);
      const g = new THREE.Group();
      const entry = t.creatureId ? creatureById(t.creatureId) : undefined;
      const fig = mergeByMaterial(entry ? figureFor(entry) : adventurer(t.role === 'member' ? { cloth: t.color } : undefined)); fig.position.y = 0.3;
      g.add(baseRing(base, t.role === 'party' ? PARTY_RED : t.color), fig);
      if (t.role === 'party') { const amp = this.world.label('&', undefined, 'token party-amp'); amp.position.set(0, 7.6, 0); g.add(amp); }
      if (t.role === 'member' || t.role === 'creature') {
        // The name goes through the players' projection (core/identity.ts): a hidden creature has no tag on the players'
        // side, a revealed one its own alias, never its real or sheet name.
        const f = playerFacing(t, { restricted: this.playersSide });
        if (f.visible) {
          const lb = this.world.label(f.name ?? t.name, undefined, `token${t.role === 'creature' ? ' creature' : ''}${t.hidden ? ' hidden' : ''}`);
          lb.position.set(0, 7.2, 0); lb.element.style.setProperty('--tok', t.color); g.add(lb);
        }
      }
      const ghostly = t.role === 'creature' && !!t.hidden; // the DM sees an unrevealed creature faintly
      g.traverse((c) => {
        const m = c as THREE.Mesh;
        if (!m.isMesh) return;
        const src = m.material as THREE.MeshLambertMaterial;
        m.material = new THREE.MeshLambertMaterial({ color: src.color, flatShading: true, transparent: ghostly, opacity: ghostly ? 0.45 : 1 }); // tokens are never fogged
        m.userData.role = 'token';
        m.userData.tokenId = t.id;
      });
      g.position.set(t.pos[0], this.level.elevationFt, t.pos[1]);
      g.userData.tokenId = t.id;
      b.root.add(g);
      this.cur!.tokens.set(t.id, g);
    }
    const back = ringOn && this.selected === ringOn ? this.cur!.tokens.get(ringOn) : undefined;
    if (back && this.selRing) back.add(this.selRing);
  }

  // ------------------------------------------------------------------ vision + slider

  /** Rebuild coverage for the active level from tokens, lights, doors and the reveal log; then restyle. */
  recompute(): void {
    if (!this.cur) return;
    const loc = this.cur.scene.location;
    const l = this.level;
    const cov = this.cur.coverage.get(l.id)!;
    const rs = revealSets(this.state, loc);
    cov.paint.fill(0);
    for (const r of this.state.reveals) this.applyReveal(r, cov, l);
    const walls = this.effectiveWalls();
    const lights: LightSource[] = [...l.lights];
    // The party and its members see for the players; placed creatures never do (what they see is the DM's business).
    const viewers = this.tokensHere().filter((t) => t.role !== 'creature').map((t) => {
      if (t.light) lights.push({ id: `tok:${t.id}`, pos: [t.pos[0], 4, t.pos[1]], bright: t.light.bright, dim: t.light.dim });
      return { pos: t.pos, darkvisionFt: t.darkvisionFt };
    });
    cov.updateVision(viewers, this.cur.grid.levels[l.id].floorPolygons.concat(l.rooms.map((r) => r.polygon)), walls, lights, this.ambientNow(l), rs.secretWalls);
    this.state.seen[`${loc}/${l.id}`] = cov.serialize().seen;
    const tex = this.cur.covTex.get(l.id)!;
    cov.toTexture(tex.image.data as Uint8Array);
    tex.needsUpdate = true;
    for (const [oid, h] of this.built.openables) { const o = l.objects.find((x) => x.id === oid); if (o) h.set(this.isOpen(o)); }
    for (const [wid, door] of this.built.doors) door.visible = !(this.state.doorsOpen[`${loc}/${wid}`] ?? l.walls.find((w) => w.id === wid)?.open);
    this.applySlider();
    this.refreshRange();
  }

  private applyReveal(r: Reveal, cov: CoverageMap, l: Level): void {
    if (r.location !== this.cur!.scene.location) return;
    if (r.type === 'room') {
      const room = l.rooms.find((x) => x.key === r.key);
      if (room) cov.stamp(room.polygon, r.mode);
    } else if (r.type === 'brush' && r.level === l.id) {
      for (const p of r.pts) cov.brush(p[0], p[1], r.r, r.mode);
    }
  }

  applySlider(): void {
    if (!this.cur) return;
    // Restore what the section hid last pass before the visibility rules below run again.
    if (this.cur.scene.stacked) for (const b of this.cur.levels.values()) b.root.traverse((o) => { if (o.userData.secHidden) { o.visible = true; delete o.userData.secHidden; } });
    const T = this.T;
    const rs = revealSets(this.state, this.cur.scene.location);
    fogUniforms.uFog.value = fogCurve(T);
    fogUniforms.uMemory.value = 1 - hiddenCurve(T);
    fogUniforms.uCovEnabled.value = this.renderMode === 'floorMask' || this.cur.scene.kind === 'placement' ? 0 : 1;
    const b = this.built;
    for (const tg of b.targets) {
      const revealed = rs.objects.has(tg.id);
      const o = classOpacity(tg.vis, T, revealed);
      tg.root.visible = o > 0.001;
      for (const m of tg.materials) {
        setOpacity(m, o);
        if (m.userData.fogExempt) m.userData.fogExempt.value = revealed ? 1 : 0;
      }
    }
    for (const sd of b.secretDoors) {
      const revealed = rs.secretDoors.has(sd.objectId);
      const h = revealed ? 1 : hiddenCurve(T);
      const open = this.state.doorsOpen[`${this.cur.scene.location}/${sd.wallId}`];
      sd.panel.visible = !revealed && !this.secretAsWall;
      setOpacity(sd.panel.material as THREE.Material, 1 - 0.8 * h);
      sd.door.visible = h > 0.001 && !this.secretAsWall && !(revealed && open);
      for (const m of sd.doorMaterials) setOpacity(m, h);
      (sd.marker.material as THREE.MeshBasicMaterial).opacity = revealed ? 0 : labelCurve(T) * 0.9;
      sd.marker.visible = !this.secretAsWall && (sd.marker.material as THREE.MeshBasicMaterial).opacity > 0.001;
    }
    for (const w of b.secretAsWall) w.visible = this.secretAsWall;
    for (const r of b.lightRings) { (r.material as THREE.LineBasicMaterial).opacity = labelCurve(T) * r.userData.baseOpacity; r.visible = labelCurve(T) > 0.001; }
    const cov = this.cur.coverage.get(this.levelId)!;
    for (const lb of this.cur.labels) {
      if (lb.level !== this.levelId) { lb.obj.visible = false; continue; } // stacked sites: only the current floor is annotated
      let o: number;
      if (lb.spec.vis === 'dm-note') o = labelCurve(T);
      else o = cov.state(lb.spec.pos.x, lb.spec.pos.z) !== Cov.Unexplored ? 1 : 1 - fogCurve(T);
      if (this.renderMode === 'floorMask') o = 0;
      if (this.labelMode === 'none' || (this.labelMode === 'keys' && lb.spec.vis === 'dm-note' && lb.spec.kind !== 'key')) o = 0;
      if (lb.spec.kind === 'door') { const open = this.state.doorsOpen[`${this.cur.scene.location}/${lb.spec.wallId}`] ?? this.level.walls.find((w) => w.id === lb.spec.wallId)?.open; lb.obj.element.classList.toggle('open', !!open); }
      lb.obj.element.style.opacity = o.toFixed(3);
      lb.obj.visible = o > 0.001;
    }
    this.world.setWorkLight(this.renderMode === 'floorMask' ? 0 : T);
    b.grid.visible = this.gridMode !== 'off' && this.renderMode === 'normal';
    for (const [lid, o] of this.cur.levels) if (lid !== this.levelId) o.grid.visible = false;
    if (this.gridMode !== 'off') { setGridType(b.grid, this.gridMode); (b.grid.material as THREE.ShaderMaterial).uniforms.uOpacity.value = this.gridOpacity * 0.75; }
    // Cutaway: walls and doors keep their real height; the top is clipped at 5 ft above the floor.
    // The section cut: on stacked sites it is a slicer the DM can move; elsewhere it trims walls at 5 ft.
    // The follow cut sits just under the floor above (the roof, on the top storey): the whole room shows, nothing in it is cut.
    const followCut = this.cur.scene.stacked === 'open' ? this.sectionRange!.max : this.level.elevationFt + (this.level.ceilingFt ?? 10) - 0.5;
    const cut = this.cur.scene.stacked ? (this.cutFt ?? followCut) : this.lowWalls ? this.level.elevationFt + WALL_CUT_FT : null;
    this.followCutFt = followCut;
    setWallCut(cut === null ? null : cut + this.placementY); // the cut is a scene height; the clip plane is drawn space
    // the land cut over the floors below ground: its planes are scene space too, and the land hangs in the placed frame
    if (this.backdrop && this.cur.scene.stacked && this.cur.scene.landCut) cutLand(this.backdrop, landHole(this.belowGround(), cut !== null && cut < this.groundFt - 0.3 ? cut : null)?.map((pl) => pl.applyMatrix4(this.placement)) ?? null);
    // Roofs raised over authored walls (a shop's gable, a tower's cone) go whenever the walls are cut down to a cutaway,
    // and come back with full walls; on stacked sites the section plane slices them instead.
    if (!this.cur.scene.stacked) for (const b2 of this.cur.levels.values()) b2.root.traverse((o) => { if (o.userData.cap) o.visible = !this.lowWalls; });
    // a map that is not stacked slices only its walls: the shared materials a stacked map's section plane took (a
    // building that was active a moment ago, in its town) come back whole, or the town's houses would be cut open
    if (!this.cur.scene.stacked) for (const b2 of this.cur.levels.values()) sectionClip(b2.root, false);
    this.declutter();
    if (this.cur.scene.stacked) for (const [lid, b] of this.cur.levels) {
      sectionClip(b.root, true);
      // What stands on a floor is never sliced: it shows whole while the cut is above that floor and goes with the floor when the cut drops below it.
      const lv = this.cur.scene.levels.find((x) => x.id === lid)!, show = cut === null || cut >= lv.elevationFt + 1;
      b.root.traverse((o) => { if (SHELL_ROLES.has(o.userData.role) || o.userData.role === 'grid' || !(o as THREE.Mesh).isMesh) return; if (!show) { if (o.visible) { o.visible = false; o.userData.secHidden = true; } } });
    }
    this.world.invalidate();
  }

  /** Far out, a big map keeps only its area keys: notes, door and stair markers and sublabels wait until you come closer. */
  labelDensity(): void {
    // By what a foot is worth on screen, not by distance: a 5-ft square under 14 px is 'far', under 32 px is 'mid'.
    const px = this.cameraFrame().pxPerFt;
    gridUniforms.uPxPerFt.value = px;
    const z = px < 2.8 ? 'far' : px < 6.4 ? 'mid' : 'near';
    if (document.body.dataset.zoom !== z) document.body.dataset.zoom = z;
    // the continuous world's zoom bands (a separate attribute, so the far/mid/near rules keep matching)
    const band = px < 0.02 ? 'valley' : px < 0.1 ? 'road' : px < 1 ? 'town' : 'map';
    if (document.body.dataset.band !== band) document.body.dataset.band = band;
    if (this.staged && this.stage) { this.stage.onView({ restricted: this.playersSide, revealed: this.pinsRevealed }); this.stage.setParty(this.partyMark()); }
    this.declutter();
  }

  /** Labels never pile up: once the frame is drawn, labels are placed in order of importance (room keys, then stairs,
   *  objects, doors, notes) and any that would overlap one already placed is hidden until the view changes. */
  private declutterQ = 0;
  declutter(): void {
    if (this.declutterQ) return;
    this.declutterQ = requestAnimationFrame(() => requestAnimationFrame(() => {
      this.declutterQ = 0;
      if (!this.cur) return;
      const PRI: Record<string, number> = { key: 0, link: 1, object: 2, door: 3, note: 4, tread: 5 };
      const live = this.cur.labels.filter((l) => l.obj.visible && l.obj.element.style.display !== 'none' && Number(l.obj.element.style.opacity || 1) > 0.05);
      for (const l of live) l.obj.element.classList.remove('declutter');
      live.sort((a, b) => (PRI[a.spec.kind] ?? 9) - (PRI[b.spec.kind] ?? 9));
      const placed: DOMRect[] = [];
      for (const l of live) {
        const r = l.obj.element.getBoundingClientRect(); if (!r.width) continue;
        if (placed.some((p) => r.left < p.right + 2 && r.right > p.left - 2 && r.top < p.bottom + 1 && r.bottom > p.top - 1)) { l.obj.element.classList.add('declutter'); continue; }
        placed.push(r);
      }
    }));
  }
  setT(t: number): void {
    const was = this.playersSide;
    this.t = t; this.applySlider();
    // Into or out of the players' preview: token names follow the players' projection (or the DM's names again).
    if (this.cur && was !== this.playersSide) { this.syncTokens(); this.syncStage(); }
  }
  setView(v: 'dm' | 'players'): void { this.view = v; this.tool = 'none'; this.clearRuler(); this.stopPlacing(); this.select(null); if (this.cur) { this.syncTokens(); this.recompute(); } this.applySlider(); this.restyleGhosts(); this.syncStage(); this.onChange?.(); }

  // ------------------------------------------------------------------ reveals

  commit(): void {
    this.state.updatedAt = Date.now();
    this.recompute();
    this.broadcast();
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => void idbSet(storeKey(this.campaign.id), this.state), 150);
    this.onChange?.();
  }

  /** Awaitable save (tests, pagehide). */
  async flush(): Promise<void> { clearTimeout(this.saveTimer); await idbSet(storeKey(this.campaign.id), this.state); }

  toggleRoom(key: string): void {
    const loc = this.cur!.scene.location;
    const last = [...this.state.reveals].reverse().find((r) => r.type === 'room' && r.location === loc && r.key === key) as Extract<Reveal, { type: 'room' }> | undefined;
    this.state.reveals.push({ type: 'room', location: loc, key, mode: last?.mode === 'reveal' ? 'fog' : 'reveal' });
    this.commit();
  }
  toggleObject(id: string): void {
    const loc = this.cur!.scene.location;
    const i = this.state.reveals.findIndex((r) => r.type === 'object' && r.location === loc && r.id === id);
    if (i >= 0) this.state.reveals.splice(i, 1);
    else this.state.reveals.push({ type: 'object', location: loc, id });
    this.commit();
  }
  /** What a card may show about a container; players learn the contents only once it is open. */
  containerInfo(o: SceneObject, players: boolean): { locked: boolean; open: boolean; contents?: string } | undefined {
    const c = this.containerOf(o); if (!c) return undefined;
    const open = this.isOpen(o);
    return { locked: !!c.locked, open, contents: players && !open ? undefined : c.contents };
  }
  /** Container record for an object: authored, or a default for any kind that opens. */
  containerOf(o: SceneObject): Container | undefined {
    return o.container ?? (OPENABLE_KINDS[o.kind] ? {} : undefined);
  }
  isOpen(o: SceneObject): boolean { return this.state.opened[`${this.cur!.scene.location}/${o.id}`] ?? !!o.container?.open; }
  /** Open or close a container. Players cannot open locked ones; opening reveals what it held. */
  toggleOpen(id: string): boolean {
    const o = this.level.objects.find((x) => x.id === id), c = o && this.containerOf(o);
    if (!o || !c) return false;
    const open = this.isOpen(o);
    if (!open && c.locked && this.restricted) { this.flashStatus('Locked'); return false; }
    const loc = this.cur!.scene.location;
    this.state.opened[`${loc}/${id}`] = !open;
    if (!open) for (const r of c.reveals ?? []) if (!this.state.reveals.some((x) => x.type === 'object' && x.location === loc && x.id === r)) this.state.reveals.push({ type: 'object', location: loc, id: r });
    this.commit();
    return true;
  }
  revealSecretDoor(id: string): void {
    const loc = this.cur!.scene.location;
    const sd = this.built.secretDoors.find((s) => s.objectId === id);
    if (!sd) return;
    const i = this.state.reveals.findIndex((r) => r.type === 'secret-door' && r.location === loc && r.id === id);
    if (i >= 0) this.state.reveals.splice(i, 1);
    else this.state.reveals.push({ type: 'secret-door', location: loc, id, wallId: sd.wallId });
    this.commit();
  }
  /** Walls as they stand now: revealed secret doors act as doors, doors carry their open state. */
  effectiveWalls(): Wall[] {
    const loc = this.cur!.scene.location, rs = revealSets(this.state, loc);
    return this.level.walls.map((w) => ({
      ...w,
      flags: w.flags.includes('secret-door') && rs.secretWalls.has(w.id) ? (['door'] as typeof w.flags) : w.flags,
      open: this.state.doorsOpen[`${loc}/${w.id}`] ?? w.open,
    }));
  }
  /** Players' side (Players view or the Player Display) is bound by walls; the DM moves freely. */
  get restricted(): boolean { return this.mode === 'player' || this.view === 'players'; }
  /** What the players' side reads (cards, tips, the turn bar, token names): Players view, the Player Display, and the
   *  slider at its players' end (t = 0, 'safe to point at players'). Moving and acting still follow `restricted`. */
  get playersSide(): boolean { return this.restricted || this.t <= 0; }
  /** The DM's stat line for a creature token from its one source (ui/creature.ts, cached once loaded). */
  statLine?: (t: Token) => string | undefined;
  canWalkTo(from: Vec2, to: Vec2): boolean {
    if (!this.restricted) return true;
    const floor = this.cur!.grid.levels[this.levelId].floorPolygons.concat(this.level.rooms.map((r) => r.polygon));
    return canWalk(from, to, moveBlockers(this.effectiveWalls()), floor);
  }
  toggleDoor(wallId: string): void {
    const k = `${this.cur!.scene.location}/${wallId}`;
    const w = this.level.walls.find((x) => x.id === wallId);
    if (this.restricted && w?.flags.includes('locked') && !(this.state.doorsOpen[k] ?? w.open)) { this.flashStatus('Locked'); return; }
    this.state.doorsOpen[k] = !(this.state.doorsOpen[k] ?? w?.open ?? false);
    this.commit();
  }
  /** Move the party on the world map (miles): an explicit travel (the drag of its '&' on the valley or the flat
   *  sheet), never an open. Keeps a short trail of moves, drawn along the roads (render/worldstage.ts, drawTrail). */
  moveWorld(pos: Vec2, key: string | undefined, miles: number, save = true): void {
    const w = this.state.world, trail = [...(w?.trail ?? (w ? [{ pos: w.pos, key: w.key, miles: 0, at: Date.now() }] : [])), { pos, key, miles: Math.round(miles * 100) / 100, at: Date.now() }].slice(-50);
    this.state.world = { pos, key, trail };
    if (key) this.revealPin(key, true, false); // a place the party has been to is known to the players
    this.syncStage();
    if (save) this.commit();
  }
  /** World-map places the players know. */
  get pinsRevealed(): Set<string> { return new Set(this.state.worldRevealed ?? []); }
  revealPin(key: string, on: boolean, save = true): void {
    const set = this.pinsRevealed; if (set.has(key) === on) return;
    if (on) set.add(key); else set.delete(key);
    this.state.worldRevealed = [...set];
    this.syncStage();
    if (save) this.commit();
  }
  undo(): void { if (this.state.reveals.pop()) this.commit(); }

  // ------------------------------------------------------------------ the clock: day, hour, sun and moon
  get clock(): { day: number; hour: number } { return this.state.clock ?? { day: 1, hour: 14 }; }
  get sky(): Sky { return skyAt(this.clock, this.campaign.theme.id === 'pastoral' ? 'pastoral' : 'gothic', this.cur?.scene.ambient ?? 'barovian-overcast'); }
  /** Is this level under the open sky? (It has terrain and is not a cave or cellar.) */
  private openAir(l: Level): boolean { return !!l.terrain?.length && (l.ambient ?? this.cur!.scene.ambient) !== 'darkness'; }
  /** The light the rules see on a level now: outdoors it follows the hour; indoors it is as authored. */
  ambientNow(l: Level): Ambient {
    const authored = l.ambient ?? this.cur!.scene.ambient;
    if (!this.openAir(l)) return authored;
    const s = skyAt(this.clock, this.campaign.theme.id === 'pastoral' ? 'pastoral' : 'gothic', authored);
    return s.ambient;
  }
  setClock(day: number, hour: number): void {
    const h = ((hour % 24) + 24) % 24;
    this.state.clock = { day: Math.max(1, Math.round(day)), hour: Math.round(h * 4) / 4 };
    this.applySky(); this.recompute(); this.commit(); this.onChange?.();
  }
  advance(hours: number): void { const c = this.clock; let h = c.hour + hours, d = c.day; while (h >= 24) { h -= 24; d++; } while (h < 0) { h += 24; d = Math.max(1, d - 1); } this.setClock(d, h); }
  applySky(): void {
    if (!this.cur) return;
    const l0 = this.cur.scene.levels.find((l) => l.terrain?.length) ?? this.cur.scene.levels[0];
    this.world.setSky(this.sky, this.openAir(l0) && (!!this.backdrop || this.staged));
    (this.backdrop?.userData.setMoon as ((p: number, n: boolean, h: number) => void) | undefined)?.(this.sky.phase, this.sky.night, this.clock.hour);
    if (this.staged) this.stage?.setMoon(this.sky.phase, this.sky.night, this.clock.hour);
  }

  // ------------------------------------------------------------------ creatures: the repository on the map
  /** The creature being placed by taps, if any. */
  placing: string | null = null;
  placed = 0;
  startPlacing(creatureId: string): void {
    this.placing = creatureId; this.placed = 0; this.select(null);
    const e = creatureById(creatureId);
    this.setStatus(this.playersSide ? 'Tap the map to place it · Esc to stop' : `Tap the map to place ${e?.name ?? 'it'} · Esc to stop`);
    this.onChange?.();
  }
  stopPlacing(): void { if (!this.placing) return; this.placing = null; this.setStatus(''); this.onChange?.(); }
  /** Put one creature on the current level at a cell. It starts hidden from the players. */
  addCreature(creatureId: string, pos: Vec2, level = this.levelId): Token | undefined {
    const e = creatureById(creatureId); if (!e || !this.cur) return undefined;
    const loc = this.cur.scene.location, n = this.state.tokens.filter((t) => t.creatureId === creatureId && t.location === loc).length + 1;
    const st = statsOf(e);
    const t: Token = { id: `cr-${loc}-${creatureId}-${Date.now().toString(36)}-${n}`, name: n > 1 ? `${e.name} ${n}` : e.name, location: loc, level, pos: this.snap(pos), size: e.size, darkvisionFt: e.kind === 'npc' ? 0 : 60,
      color: colorOf(e), role: 'creature', creatureId, hidden: true, playerName: aliasFor(e), hp: st ? { cur: st.hp, max: st.hp } : undefined };
    this.state.tokens.push(t);
    if (level === this.levelId) this.syncTokens();
    this.commit();
    return t;
  }
  /** Place one on a free cell next to the party marker (or the level's first room). */
  addCreatureNearParty(creatureId: string): Token | undefined {
    const p = this.party, l = this.level, at = p && p.level === this.levelId ? this.snap(p.pos) : this.snap([bounds([l.rooms[0].polygon]).minX + 2.5, bounds([l.rooms[0].polygon]).minZ + 2.5]);
    const taken = new Set(this.tokensHere().map((t) => `${t.pos[0]},${t.pos[1]}`));
    const floor = this.cur!.grid.levels[this.levelId].floorPolygons.concat(l.rooms.map((r) => r.polygon));
    for (let ring = 1; ring < 8; ring++) for (let dj = -ring; dj <= ring; dj++) for (let di = -ring; di <= ring; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue;
      const c: Vec2 = [at[0] + di * 5, at[1] + dj * 5];
      if (!taken.has(`${c[0]},${c[1]}`) && floor.some((poly) => pointInPolygon(c, poly))) return this.addCreature(creatureId, c);
    }
    return this.addCreature(creatureId, at);
  }
  removeToken(id: string): void {
    const t = this.state.tokens.find((x) => x.id === id); if (!t || t.role === 'party') return;
    this.state.tokens = this.state.tokens.filter((x) => x.id !== id);
    const e = this.state.encounter; if (e) { e.order = e.order.filter((c) => c.tokenId !== id); if (e.turn >= e.order.length) e.turn = 0; if (!e.order.length) this.state.encounter = undefined; }
    if (this.selected === id) this.select(null);
    this.syncTokens(); this.recompute(); this.commit();
  }
  setTokenHidden(id: string, hidden: boolean): void { const t = this.state.tokens.find((x) => x.id === id); if (!t) return; t.hidden = hidden; this.syncTokens(); this.recompute(); this.commit(); this.onChange?.(); }
  setPlayerName(id: string, name: string): void { const t = this.state.tokens.find((x) => x.id === id); if (!t) return; t.playerName = name.trim() || t.playerName; this.syncTokens(); this.commit(); }
  adjustHp(id: string, delta: number): void { const t = this.state.tokens.find((x) => x.id === id); if (!t?.hp) return; t.hp.cur = Math.max(0, Math.min(t.hp.max, t.hp.cur + delta)); this.commit(); this.onChange?.(); }
  /** The sheet an initiative needs for a placed creature: one per creature kind, shared by every copy. */
  creatureSheet(t: Token): Sheet | undefined {
    const e = t.creatureId ? creatureById(t.creatureId) : undefined; if (!e) return undefined;
    const id = `cr:${e.id}`;
    let sh = this.state.roster.find((x) => x.id === id);
    if (!sh) { sh = { id, name: e.name, color: colorOf(e), speedFt: speedFtOf(e), reachFt: 5, rangeFt: 0, initMod: 0, size: e.size, darkvisionFt: e.kind === 'npc' ? 0 : 60, kind: 'npc' }; this.state.roster.push(sh); }
    return sh;
  }
  /** What a token is for the players: only a revealed creature or the party. */
  playerSees(t: Token): boolean { return t.role !== 'creature' || !t.hidden; }
  /** The range helper outside initiative: green and red squares for whichever token is picked up. */
  rangeHelper = false;
  setRangeHelper(on: boolean): void { this.rangeHelper = on; this.refreshRange(); this.onChange?.(); }
  resetCampaign(): void { this.state = newCampaign(); this.ensureDefaultToken(); this.syncTokens(); this.commit(); }

  // ------------------------------------------------------------------ pointer: tokens, taps, brushes

  private ndc(e: PointerEvent): THREE.Vector2 {
    const r = this.world.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }
  private floorPoint(e: PointerEvent): Vec2 | null {
    this.raycaster.setFromCamera(this.ndc(e), this.world.camera);
    const p = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.planeAt(this.level.elevationFt), p);
    return hit ? this.toLocal([p.x, p.z]) : null;
  }
  /** The parent map's surroundings round an area map: what stands within a few hundred feet of the room that opens
   *  this map (the one the DM entered from: anchorIn), moved into this map's frame (offset and north) on this map's
   *  level at that room's height, skipping whatever lies inside this map's own extent.
   *  Built with the same kit, muted a little toward the mist, never picked, never fogged, never cut. */
  private async buildContext(path: string, scene: SceneFile, l0: Level): Promise<void> {
    const par = await loadLocation(scene.parent!).catch(() => undefined);
    if (!par || this.cur?.path !== path) return;
    const KINDS = new Set(['house', 'church-building', 'temple', 'pine', 'oak', 'stump', 'well', 'fence', 'wagon', 'vardo', 'big-tent', 'mound', 'dais', 'pillory', 'brazier', 'campfire', 'trough', 'signpost', 'roof-gable', 'washline', 'bush', 'boulder', 'gravestone']);
    const at = this.anchorIn(par.scene, scene.parent!, path, scene);
    if (at) {
      const { level: pl, room } = at;
      // the surroundings stand at the room's height, round the level of this map that stands there (the abbey's ground floor on Krezk's ledge)
      const cl = scene.levels.find((l) => Math.abs(l.elevationFt - pl.elevationFt) < 1) ?? l0;
      const pc: Vec2 = centroidOf(room.polygon);
      const bb = extentOf(cl);
      const bc: Vec2 = [(bb.minX + bb.maxX) / 2, (bb.minZ + bb.maxZ) / 2], pad = 8;
      const th = northTurn(cl.north, pl.north), c = Math.cos(th), sn = Math.sin(th);
      const tf = (p: number[]): [number, number] => { const x = p[0] - pc[0], z = p[1] - pc[1]; return [bc[0] + x * c - z * sn, bc[1] + x * sn + z * c]; };
      const inside = (p: [number, number]) => p[0] > bb.minX - pad && p[0] < bb.maxX + pad && p[1] > bb.minZ - pad && p[1] < bb.maxZ + pad;
      const R = Math.max(bb.maxX - bb.minX, bb.maxZ - bb.minZ) / 2 + CONTEXT_FT, near = (p: [number, number]) => Math.hypot(p[0] - bc[0], p[1] - bc[1]) < R;
      const objects = pl.objects.filter((o) => KINDS.has(o.kind)).map((o) => { const q = tf([o.pos[0], o.pos[2]]); return { ...o, id: `ctx-${o.id}`, key: undefined, label: undefined, vis: 'player' as const, pos: [q[0], o.pos[1], q[1]] as [number, number, number], rotY: (o.rotY ?? 0) - (th * 180) / Math.PI }; })
        .filter((o) => { const q: [number, number] = [o.pos[0], o.pos[2]]; return near(q) && !inside(q); });
      const terrain = (pl.terrain ?? []).filter((t) => t.floor !== 'grass').map((t) => ({ ...t, polygon: t.polygon.map(tf) }))
        .filter((t) => { const cx = t.polygon.reduce((a, p) => a + p[0], 0) / t.polygon.length, cz = t.polygon.reduce((a, p) => a + p[1], 0) / t.polygon.length; return near([cx, cz]) && !t.polygon.every((p) => inside(p as [number, number])); });
      terrain.unshift({ polygon: [[bc[0] - R, bc[1] - R], [bc[0] + R, bc[1] - R], [bc[0] + R, bc[1] + R], [bc[0] - R, bc[1] + R]], floor: 'grass' } as (typeof terrain)[number]);
      const lvl = { id: 'context', name: 'Surroundings', elevationFt: cl.elevationFt - 0.05, ceilingFt: 10, north: cl.north, rooms: [], walls: [], lights: [], objects, terrain } as unknown as Level;
      const built = buildLevel(lvl, { floorPolygons: [], type: 'square', hexOrientation: 'pointy', origin: [0, 0], color: '#000000', opacity: 0 });
      built.root.userData.anchor = { level: pl.id, key: room.key };
      const mist = new THREE.Color(this.world.theme.mist);
      built.root.traverse((o) => {
        const m = o as THREE.Mesh; if (!m.isMesh) return;
        if (o.userData.role === 'grid') { o.visible = false; return; }
        const mats = (Array.isArray(m.material) ? m.material : [m.material]).map((mm) => { const k = mm.clone() as THREE.MeshLambertMaterial; k.clippingPlanes = null; if (k.color) k.color.lerp(mist, 0.22); return k; });
        m.material = Array.isArray(m.material) ? mats : mats[0];
        o.userData.role = 'context';
      });
      built.root.name = 'context';
      if (this.cur?.path !== path) { disposeTree(built.root); return; } // the DM moved on while it was read
      built.root.userData.groundFt = lvl.elevationFt;
      this.context = built.root; this.cur.root.add(built.root); this.syncContext(); this.world.invalidate(); // in the area map's own frame
      return;
    }
  }

  /** The surroundings stand on the parent's ground: a floor below it (a cellar, a dungeon) would be buried under the
   *  parent's grass and houses, so they hide while such a floor is shown, and in the floor-mask render like the backdrop. */
  private syncContext(): void {
    if (!this.context || !this.cur) return;
    this.context.visible = this.renderMode === 'normal' && this.level.elevationFt >= (this.context.userData.groundFt as number) - 1;
  }

  private pick(e: PointerEvent): THREE.Intersection | undefined {
    this.raycaster.setFromCamera(this.ndc(e), this.world.camera);
    const cut = (this.lowWalls ? this.level.elevationFt + WALL_CUT_FT : Infinity) + this.placementY; // hits are in drawn space
    return this.raycaster.intersectObject(this.built.root, true).find((h) => h.object.visible && (h.object as THREE.Mesh).isMesh && h.object.userData.role !== 'grid' && h.object.userData.role !== 'marker' && isShown(h.object)
      // The cutaway clips walls visually; ignore hits on the clipped-away part.
      && !((h.object.userData.role === 'wall' || h.object.userData.role === 'door') && h.point.y > cut + 0.01));
  }

  snap(p: Vec2): Vec2 {
    if (!this.gridSnap) return p;
    const g = this.cur!.grid.levels[this.levelId];
    if (this.gridMode === 'hex') { const s = hexSizeFromWidth(CELL_FT); return hexToWorld(worldToHex(p, s, g.hexOrientation, g.origin), s, g.hexOrientation, g.origin); }
    return squareCellCenter(squareCellAt(p, g.origin), g.origin);
  }
  // ------------------------------------------------------------------ the measure tool: tap two points, read the distance
  private ruler?: { a: Vec2; b?: Vec2; line: THREE.Line; label: CSS2DObject };
  measureTap(p: Vec2): void {
    const at: Vec2 = [Math.round(p[0] * 2) / 2, Math.round(p[1] * 2) / 2];
    if (!this.ruler || this.ruler.b) { this.clearRuler(); const geo = new THREE.BufferGeometry(); const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#f2b35b', linewidth: 2 })); line.userData.role = 'marker'; line.renderOrder = 6; const label = this.world.label('', undefined, 'ruler'); this.cur!.root.add(line, label); this.ruler = { a: at, line, label }; this.setStatus('Tap the other end'); this.rulerTo(at); return; }
    this.ruler.b = at; this.rulerTo(at);
    const ft = this.distanceFt(this.ruler.a, at), squares = Math.round(ft / 5);
    // The readout's distance is a rules chip (main.ts) whose card names the diagonal rule the maths used.
    this.setStatus(`${ft} ft · ${squares} squares · tap to measure again`, { ft, squares, rule: this.gridMode === 'hex' ? 'hex' : this.measureDiagonal() });
  }
  /** Stretch the ruler to a point (the preview end, or the fixed second end). */
  rulerTo(p: Vec2): void {
    const r = this.ruler; if (!r) return;
    const y = this.level.elevationFt + 0.4, a = r.a;
    r.line.geometry.setFromPoints([new THREE.Vector3(a[0], y, a[1]), new THREE.Vector3(p[0], y, p[1])]);
    const ft = this.distanceFt(a, p); r.label.position.set((a[0] + p[0]) / 2, y + 1.5, (a[1] + p[1]) / 2); r.label.element.textContent = `${ft} ft`; r.label.visible = ft > 0;
    this.world.invalidate();
  }
  clearRuler(): void { if (!this.ruler) return; this.ruler.line.removeFromParent(); this.ruler.line.geometry.dispose(); (this.ruler.line.material as THREE.Material).dispose(); this.ruler.label.element.remove(); this.ruler.label.removeFromParent(); this.ruler = undefined; this.world.invalidate(); }
  distanceFt(a: Vec2, b: Vec2): number {
    const g = this.cur!.grid.levels[this.levelId];
    if (this.gridMode === 'hex') { const s = hexSizeFromWidth(CELL_FT); return hexDistanceFt(worldToHex(a, s, g.hexOrientation, g.origin), worldToHex(b, s, g.hexOrientation, g.origin)); }
    return squareDistanceFt(squareCellAt(a, g.origin), squareCellAt(b, g.origin), this.measureDiagonal());
  }
  /** The diagonal rule the measure tool uses (the setting 'mistlab.diagonal', 5 ft per diagonal by default). */
  measureDiagonal(): 'five' | 'five-ten-five' { let v: string | null = null; try { v = localStorage.getItem('mistlab.diagonal'); } catch { /* no storage */ } return v === null || v === 'five' ? 'five' : 'five-ten-five'; }

  private installPointer(): void {
    const el = this.world.renderer.domElement;
    let drag: { kind: 'brush'; pts: Vec2[] } | { kind: 'tap'; x: number; y: number } | null = null;
    // A gesture with a second finger (a pinch, a twist) is never a tap, even where one finger stayed put: on a place's
    // name that would fly away mid-pinch.
    const down = new Set<number>(); let multi = false;
    const lifted = (e: PointerEvent) => { down.delete(e.pointerId); if (!down.size) setTimeout(() => { if (!down.size) multi = false; }); };
    el.addEventListener('pointerdown', (e) => { down.add(e.pointerId); if (down.size > 1) multi = true; }, { capture: true });
    el.addEventListener('pointerup', lifted); el.addEventListener('pointercancel', lifted);
    el.addEventListener('pointerdown', (e) => {
      if (this.mode === 'player' || !this.cur || e.button > 0) return;
      if (this.view === 'players' && this.tool !== 'none') this.tool = 'none';
      if (this.tool === 'brush-reveal' || this.tool === 'brush-fog') {
        const p = this.floorPoint(e);
        drag = { kind: 'brush', pts: p ? [p] : [] };
      } else {
        drag = { kind: 'tap', x: e.clientX, y: e.clientY };
        return; // let OrbitControls pan
      }
      this.world.controls.enabled = false;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag && this.selected && e.pointerType === 'mouse') return this.previewMove(e);
      if (!drag && this.tool === 'measure' && this.ruler && !this.ruler.b) { const fp2 = this.floorPoint(e); if (fp2) this.rulerTo([Math.round(fp2[0] * 2) / 2, Math.round(fp2[1] * 2) / 2]); }
      if (!drag && e.pointerType === 'mouse') { this.hoverEvt = e; if (!this.hoverRaf) this.hoverRaf = requestAnimationFrame(() => { this.hoverRaf = 0; if (this.hoverEvt) this.hover(this.hoverEvt); }); }
      if (!drag || drag.kind === 'tap') return;
      const p = this.floorPoint(e);
      if (!p) return;
      {
        drag.pts.push(p);
        const cov = this.cur!.coverage.get(this.levelId)!;
        cov.brush(p[0], p[1], 3, this.tool === 'brush-fog' ? 'fog' : 'reveal');
        const tex = this.cur!.covTex.get(this.levelId)!;
        cov.toTexture(tex.image.data as Uint8Array);
        tex.needsUpdate = true;
        this.world.invalidate();
      }
    });
    const end = (e: PointerEvent) => {
      const d = drag;
      drag = null;
      this.world.controls.enabled = true;
      if (!d) return;
      if (d.kind === 'brush') {
        if (d.pts.length) this.state.reveals.push({ type: 'brush', location: this.cur!.scene.location, level: this.levelId, mode: this.tool === 'brush-fog' ? 'fog' : 'reveal', r: 3, pts: d.pts.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]) });
        this.commit();
      } else if (!multi && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) {
        this.tap(e);
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  /** The token picked up for a move (tap it, then tap where it goes). */
  selected: string | null = null;
  private selRing?: THREE.Mesh;
  private ghost?: THREE.Mesh;
  select(id: string | null): void {
    this.selected = id;
    const ring = (this.selRing ??= this.makeRing('#ffffff', 0.85)), ghost = (this.ghost ??= this.makeRing(PALETTE.amber, 0.55));
    ring.removeFromParent(); ghost.visible = false;
    const t = id ? this.state.tokens.find((x) => x.id === id) : undefined;
    const obj = id ? this.cur?.tokens.get(id) : undefined;
    if (t && obj) {
      const r = baseRingFt(t.size) * 0.31 + 0.6; ring.scale.setScalar(r); ghost.scale.setScalar(r);
      obj.add(ring);
      this.setStatus(this.restricted ? 'Tap where the party goes' : 'Tap where it goes · tap the token again to cancel');
    } else this.setStatus('');
    if (!this.encounter) this.refreshRange();
    this.onSelect?.(id);
    this.world.invalidate();
  }
  onSelect?: (id: string | null) => void;
  /** The compass and scale bar follow the camera. */
  onCameraUi: (() => void) | null = null;
  /** A level's north includes its nested placement, just as the compass read-out does. */
  alignNorth(): void {
    const n = northVec(this.cur ? this.level.north : undefined);
    this.world.alignNorth(new THREE.Vector3(n[0], 0, n[1]).transformDirection(this.placement));
  }
  /** Where north points on screen (radians, 0 = up, clockwise) and how many pixels a foot covers at the target. */
  cameraFrame(): { north: number; pxPerFt: number } {
    const l = this.cur ? this.level : undefined, n = l?.north ?? '-z';
    const n0 = n === '+z' ? [0, 1] : n === '-x' ? [-1, 0] : n === '+x' ? [1, 0] : [0, -1];
    // the level's north as drawn: the scene's placement turns it
    const nd = new THREE.Vector3(n0[0], 0, n0[1]).transformDirection(this.placement), nv = [nd.x, nd.z];
    const az = this.world.controls.getAzimuthalAngle();
    // screen up is the direction from camera to target in plan: (-sin az, -cos az); north's screen angle is measured from it
    const upx = -Math.sin(az), upz = -Math.cos(az);
    const north = Math.atan2(nv[0] * upz - nv[1] * upx, nv[0] * upx + nv[1] * upz);
    const t = this.world.controls.target, r = this.world.renderer.domElement.getBoundingClientRect();
    const p0 = new THREE.Vector3(t.x, t.y, t.z).project(this.world.camera), p1 = new THREE.Vector3(t.x + 10 * upz, t.y, t.z - 10 * upx).project(this.world.camera);
    const px = Math.hypot((p1.x - p0.x) * r.width / 2, (p1.y - p0.y) * r.height / 2) / 10;
    return { north: -north, pxPerFt: px };
  }
  /** The current level as flat outlines for the minimap: floor, terrain (with its surface), rooms, walls, the party. */
  plan(): { floor: Vec2[][]; terrain: { poly: Vec2[]; floor?: string }[]; rooms: Vec2[][]; walls: [Vec2, Vec2][]; party?: Vec2; north: [number, number] } | null {
    if (!this.cur) return null;
    const l = this.level, g = this.cur.grid.levels[l.id];
    const n = l.north ?? '-z', north: [number, number] = n === '+z' ? [0, 1] : n === '-x' ? [-1, 0] : n === '+x' ? [1, 0] : [0, -1];
    const party = this.tokensHere().find((t) => t.role === 'party');
    return { floor: g.floorPolygons as Vec2[][], terrain: (l.terrain ?? []).map((t) => ({ poly: t.polygon as Vec2[], floor: t.floor })), rooms: l.rooms.map((r) => r.polygon as Vec2[]), walls: l.walls.map((w) => [w.a as Vec2, w.b as Vec2]), party: party?.pos, north };
  }
  /** Where the camera looks on the ground: the four screen corners dropped onto the level's floor plane (null where a corner sees sky). */
  cameraGround(): (Vec2 | null)[] {
    const y = this.cur ? this.level.elevationFt : 0, plane = this.planeAt(y), ray = new THREE.Raycaster();
    return ([[-1, 1], [1, 1], [1, -1], [-1, -1]] as [number, number][]).map(([x, yy]) => {
      ray.setFromCamera(new THREE.Vector2(x, yy), this.world.camera); const hit = new THREE.Vector3();
      return ray.ray.intersectPlane(plane, hit) ? this.toLocal([hit.x, hit.z]) : null;
    });
  }
  /** Look at a plan point without changing height or heading. */
  lookAt(p: Vec2): void { const t = this.world.controls.target, w = this.toWorld(p); this.world.moveTo(new THREE.Vector3(w[0], t.y, w[1]), undefined, true); }
  /** Called before a location closes, so menus, cards and tooltips can go too. */
  onLeave?: () => void;
  private makeRing(color: string, opacity: number): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    m.position.y = 0.12; m.renderOrder = 5; m.userData.role = 'marker';
    return m;
  }
  /** Mouse hover while a token is picked up: a ghost ring where it would land, and the distance. */
  private previewMove(e: PointerEvent): void {
    const t = this.state.tokens.find((x) => x.id === this.selected), p = this.floorPoint(e), g = this.ghost;
    if (!t || !g) return;
    if (!p) { g.visible = false; this.world.invalidate(); return; }
    const s = this.snap(p);
    if (g.userData.at?.[0] === s[0] && g.userData.at?.[1] === s[1]) return;
    g.userData.at = s;
    const ok = this.canWalkTo(t.pos, s);
    if (g.parent !== this.cur!.root) this.cur!.root.add(g); // in scene feet, like the tokens
    g.visible = true; g.position.set(s[0], this.level.elevationFt + 0.12, s[1]);
    (g.material as THREE.MeshBasicMaterial).color.set(ok ? PALETTE.amber : '#c0392b');
    this.setStatus(ok ? `${this.distanceFt(t.pos, s)} ft` : 'No way through');
    this.world.invalidate();
  }
  /** Move a token if it can get there; players' side must walk (walls and closed doors stop it). */
  moveTokenTo(id: string, to: Vec2): boolean {
    const t = this.state.tokens.find((x) => x.id === id);
    if (!t) return false;
    const e = this.encounter, cur = this.current;
    const inInitiative = !!e && e.order.some((c) => c.tokenId === id);
    if (!inInitiative && t.role !== 'party' && !this.restricted) { /* the DM places people and monsters where the story needs them */ }
    else if (e && inInitiative) {
      if (cur?.token.id !== id) { this.flashStatus(this.playersSide ? 'Not your turn' : `Not ${t.name}'s turn`); return false; }
      const cell = this.rangeFor?.move.find((m) => m.cell[0] === to[0] && m.cell[1] === to[1]);
      if (cell) e.movedFt += cell.costFt;
      else if (this.restricted) { this.flashStatus('Out of movement range'); return false; }
      else this.flashStatus('Placed by the DM: no movement spent');
    } else if (!this.canWalkTo(t.pos, to)) { this.flashStatus('No way through: walls block the party. Open a door first.'); return false; }
    t.pos = to;
    this.cur!.tokens.get(id)?.position.set(to[0], this.level.elevationFt, to[1]);
    if (id === this.party?.id) this.afterPartyMove();
    else if (this.encounter) this.afterMemberMove(t);
    else if (this.rangeHelper) this.refreshRange();
    this.commit();
    return true;
  }

  private hoverEvt?: PointerEvent;
  private hoverRaf = 0;
  /** Forget the hover still waiting for its frame. */
  private dropHover(): void { this.hoverEvt = undefined; if (this.hoverRaf) cancelAnimationFrame(this.hoverRaf); this.hoverRaf = 0; }
  onHover?: (tip: { title: string; sub?: string; enter?: string } | null, x: number, y: number) => void;
  /** Mouse hover: name what is under the cursor. The DM sees everything; players only what they can see. */
  private hover(e: PointerEvent): void {
    if (!this.cur || !this.onHover) return;
    // a place's name over the valley: it lights up (the DM's) and its world-map tip shows (what it is; for the DM, the
    // note, whether the players know it and where a tap goes)
    const pin = this.pinAt(e), place = this.placeAt(e);
    this.stage?.hoverLabel(place?.el ?? null);
    this.world.renderer.domElement.style.cursor = pin && (place || this.onPinTap) ? 'pointer' : '';
    if (pin && this.onPinHover) { this.onHover(null, e.clientX, e.clientY); this.onPinHover(pin.key, e.clientX, e.clientY); return; }
    this.onPinHover?.(null, e.clientX, e.clientY);
    if (place) { this.onHover({ title: place.el.dataset.tip ?? place.name, sub: place.el.dataset.tipSub }, e.clientX, e.clientY); return; }
    this.onHover(this.describe(e), e.clientX, e.clientY);
  }
  /** The world map's place tip (main.ts: the nested world map, ui/worldnest.ts): key null hides it. */
  onPinHover: ((key: string | null, x: number, y: number) => void) | null = null;
  /** A tap on a place in the valley (either side): the world map decides (fly in, or its card). Returns false to let
   *  the app's own tap go on. */
  onPinTap: ((key: string, path: string | undefined) => boolean) | null = null;
  /** Any shown place (a pin's label) under a point, on either side, in the valley. */
  pinAt(e: { clientX: number; clientY: number; pointerType?: string }): ReturnType<WorldStage['pinAt']> {
    if (!this.stage || !this.staged || this.renderMode !== 'normal') return null;
    return this.stage.pinAt(e.clientX, e.clientY, !!e.pointerType && e.pointerType !== 'mouse');
  }
  /** The place name a tap or the mouse is on, in the valley, for the DM (players' names fly nowhere). */
  placeAt(e: { clientX: number; clientY: number; pointerType?: string }): ReturnType<WorldStage['labelAt']> {
    if (!this.stage || !this.staged || this.mode !== 'dm' || this.restricted || this.renderMode !== 'normal') return null;
    return this.stage.labelAt(e.clientX, e.clientY, !!e.pointerType && e.pointerType !== 'mouse');
  }
  describe(e: PointerEvent): { title: string; sub?: string; enter?: string } | null {
    const hit = this.pick(e), o = hit?.object, loc = this.cur!.scene.location, p = this.floorPoint(e);
    const room = p ? this.roomAt(this.level, p) : undefined;
    const where = room ? `${room.key} · ${room.name}` : undefined;
    const players = this.playersSide;
    const tokId = o && findUp(o, 'tokenId');
    if (tokId) {
      const t = this.state.tokens.find((x) => x.id === tokId); if (!t) return null;
      if (t.role === 'creature') {
        const en = t.creatureId ? creatureById(t.creatureId) : undefined;
        if (players) { const f = playerFacing(t, { restricted: true }); return f.visible ? { title: f.name!, sub: en ? seenAs(en) : undefined } : null; }
        // The DM's stat line comes from the creature's one source (the books' entry, else the module's numbers).
        return { title: t.name, sub: [t.hidden ? 'Hidden from players' : `Players see: ${t.playerName ?? t.name}`, this.statLine?.(t) ?? '', t.hp ? `${t.hp.cur}/${t.hp.max} hp` : '', 'tap to pick up'].filter(Boolean).join(' · ') };
      }
      return { title: t.name, sub: this.selected === tokId ? 'Tap where it goes' : 'Tap to pick up and move' };
    }
    const oid = hitObjectId(hit);
    const obj0 = oid ? this.level.objects.find((x) => x.id === oid) : undefined;
    // roofs and chimneys are scenery: hovering one describes the room beneath, not the roof
    const obj = obj0 && !['roof-gable', 'roof-cone', 'chimney'].includes(obj0.kind) ? obj0 : undefined;
    // a thing names the room it stands in (as its tap card does), and the DM is told when that room can be entered
    const own = obj0 ? this.roomOf(obj0) ?? room : room;
    // at the slider's players' end a room the players have not found keeps its name to itself (as the tap menu does)
    const enter = own && this.enterOf(own) ? (players && !this.isRevealed(own.key) ? 'Enter this place' : `Enter ${own.name}`) : undefined;
    if (obj0 && !obj) return own ? { title: players ? own.name : `${own.key} · ${own.name}`, enter } : null;
    if (obj) {
      const ci = this.containerInfo(obj, players);
      const cs = ci ? (ci.open ? 'Open' : ci.locked ? (players ? 'Locked' : 'Locked · closed') : 'Closed · tap to open') : undefined;
      if (players) return this.playerCanSee(obj) ? { title: playerLabel(obj), sub: cs } : null;
      const rs = revealSets(this.state, loc);
      const vis = obj.vis === 'player' || !obj.vis ? undefined : `${obj.vis.replace('-', ' ')} · ${rs.objects.has(obj.id) ? 'revealed' : 'hidden from players'}`;
      return { title: obj.label ?? kindName(obj.kind), sub: [cs, vis, own ? `${own.key} · ${own.name}` : undefined].filter(Boolean).join(' · ') || undefined, enter };
    }
    const role = o?.userData.role as string | undefined;
    const wallId = o?.userData.wallId as string | undefined;
    const sd = o && (findUp(o, 'secretDoor') ?? this.built.secretDoors.find((x) => x.door === o || x.panel === o)?.objectId);
    if (sd) {
      if (players) return null;
      const r = revealSets(this.state, loc).secretDoors.has(sd);
      const so = this.level.objects.find((x) => x.id === sd);
      return { title: so?.label ?? 'Secret door', sub: r ? 'Revealed · tap to open or close' : 'Hidden from players · Reveal tool shows it' };
    }
    if (role === 'door' && wallId) {
      const w = this.level.walls.find((x) => x.id === wallId), open = this.state.doorsOpen[`${loc}/${wallId}`] ?? w?.open;
      const locked = w?.flags.includes('locked');
      return { title: locked ? 'Locked door' : 'Door', sub: `${open ? 'Open' : 'Closed'}${players && locked && !open ? ' · the DM holds the key' : ' · tap the door icon to ' + (open ? 'close' : 'open')}` };
    }
    if (role === 'stairs') return { title: 'Stairs', sub: where };
    if (role === 'wall') {
      if (players) return null;
      const glass = o?.userData.window;
      return { title: glass ? 'Window' : 'Wall', sub: where };
    }
    if (room && (!players || this.isRevealed(room.key))) return { title: players ? room.name : `${room.key} · ${room.name}`, sub: players ? undefined : `${this.isRevealed(room.key) ? 'Revealed' : 'Not revealed'}${room.page ? ` · p.${room.page}` : ''}`, enter };
    return null;
  }

  /** What a tap tells the card about an object: the players' version (their label, no DM note) or the DM's. */
  tapObject(obj: SceneObject, players: boolean): NonNullable<TapHit['object']> {
    if (players) return { id: obj.id, label: playerLabel(obj), container: this.containerInfo(obj, true), vis: obj.vis, revealed: true, kind: obj.kind, desc: playerDesc(obj), visibleToPlayers: true };
    const rs = revealSets(this.state, this.cur!.scene.location);
    return { id: obj.id, label: obj.label ?? kindName(obj.kind), playerLabel: playerLabel(obj), container: this.containerInfo(obj, false), vis: obj.vis, revealed: rs.objects.has(obj.id), kind: obj.kind, desc: playerDesc(obj), dm: obj.dm, page: this.level.rooms.find((r) => r.key === obj.key)?.page, visibleToPlayers: this.playerCanSee(obj) };
  }
  /** What a tap tells the card about a room (the players' version carries no DM note and no page). */
  tapRoom(room: Room, players: boolean): NonNullable<TapHit['room']> {
    return players ? { key: room.key, name: room.name, revealed: true, desc: room.desc, enter: room.enter }
      : { key: room.key, name: room.name, revealed: this.isRevealed(room.key), desc: room.desc, dm: room.dm, page: room.page, enter: room.enter };
  }

  private lastTap = 0;
  private tap(e: PointerEvent): void {
    // Moving is two deliberate taps: the token, then where it goes. A swipe never moves anyone.
    const tokHit = this.pick(e), fp = this.floorPoint(e);
    if (this.placing && !this.restricted) { if (fp) { this.addCreature(this.placing, fp); this.placed++; this.setStatus(`${this.placed} placed · tap for more · Esc to stop`); } return; }
    // a place over the valley: the world map's (fly there and open its map, or its card), else fly there
    // (a mouse's click comes with its own move, whose hover waits for the next frame: a tap the world map or a name
    // takes drops it, or it would show the place's tip again after the tap hid it, and keep it through the flight)
    const pin = this.pinAt(e);
    if (pin && this.onPinTap?.(pin.key, pin.path)) { this.dropHover(); return; }
    const place = this.placeAt(e);
    if (place) { this.dropHover(); this.stage!.onPick?.(place.path); return; }
    // The figure is small from above: a tap anywhere on its base ring picks it up too.
    const tokId = (tokHit && findUp(tokHit.object, 'tokenId')) || (fp && this.tokensHere().filter((t) => this.playerSees(t) || !this.restricted).find((t) => Math.hypot(t.pos[0] - fp[0], t.pos[1] - fp[1]) <= baseRingFt(t.size) / 2 + 1)?.id);
    if (tokId) {
      const tk = this.state.tokens.find((x) => x.id === tokId)!;
      if (this.restricted && tk.role === 'creature') { // players may look, not move
        const en = tk.creatureId ? creatureById(tk.creatureId) : undefined, f = playerFacing(tk, { restricted: true });
        if (!f.visible) return;
        this.onTap?.({ pos: fp ?? tk.pos, token: { id: tk.id, name: f.name!, desc: en ? seenAs(en) : undefined, seenAsOf: en?.id } }, e.clientX, e.clientY); return;
      }
      const cur = this.current;
      if (this.encounter && this.restricted && cur && cur.token.id !== tokId) { this.flashStatus('Not your turn'); return; }
      this.select(this.selected === tokId ? null : tokId); return;
    }
    if (this.selected) {
      const p = fp;
      if (p && this.moveTokenTo(this.selected, this.snap(p))) this.select(null);
      else if (!p) this.select(null);
      return;
    }
    const now = performance.now();
    const dbl = now - this.lastTap < 320; this.lastTap = now;
    if (dbl) { const p = this.floorPoint(e); const room = p && this.roomAt(this.level, p); if (room) { this.jumpTo(room.key); return; } }
    const hit = this.pick(e);
    if (this.view === 'players') {
      // Players may look at what they can see: a description card, nothing else.
      const oid = hitObjectId(hit);
      const obj = oid ? this.level.objects.find((o) => o.id === oid) : undefined;
      if (obj && this.onTap && this.playerCanSee(obj)) { this.onTap({ pos: [0, 0], object: this.tapObject(obj, true) }, e.clientX, e.clientY); return; }
      // A revealed room: its name and what the party notices there.
      const fp = this.floorPoint(e), room = fp && this.roomAt(this.level, fp);
      if (room && this.onTap && this.isRevealed(room.key)) this.onTap({ pos: fp!, room: this.tapRoom(room, true) }, e.clientX, e.clientY);
      return;
    }
    const sd = hit && (findUp(hit.object, 'secretDoor') ?? (hit.object.userData.role === 'door' ? this.built.secretDoors.find((s) => s.door === hit.object)?.objectId : undefined));
    const wallId = hit && hit.object.userData.role === 'door' ? (hit.object.userData.wallId as string | undefined) : undefined;
    if (this.tool === 'measure') { if (fp) this.measureTap(fp); return; }
    if (this.tool === 'none' && this.onTap) {
      const oid = hitObjectId(hit);
      const p = this.floorPoint(e);
      const obj = oid ? this.level.objects.find((o) => o.id === oid) : undefined;
      // A thing belongs to the room it stands in (its key, else its footing), not to the ground the ray meets behind it:
      // a tap on a tall roof still names its site, and the card can offer that site's Enter.
      const room = (obj && this.roomOf(obj)) || (p && this.roomAt(this.level, p));
      const pos = p ? ([p[0], p[1]] as Vec2) : ([0, 0] as Vec2);
      const rs = revealSets(this.state, this.cur!.scene.location);
      const info: TapHit = { room: room ? this.tapRoom(room, false) : undefined, pos,
        door: wallId ? { wallId, open: !!(this.state.doorsOpen[`${this.cur!.scene.location}/${wallId}`] ?? this.level.walls.find((w) => w.id === wallId)?.open) } : undefined,
        secretDoor: sd ? { id: sd, revealed: rs.secretDoors.has(sd) } : undefined,
        object: obj ? this.tapObject(obj, false) : undefined };
      this.onTap(info, e.clientX, e.clientY);
      return;
    }
    if (this.tool === 'reveal') {
      if (sd) return this.revealSecretDoor(sd);
      const oid = hitObjectId(hit);
      if (oid && this.built.targets.some((t) => t.id === oid)) return this.toggleObject(oid);
      const p = this.floorPoint(e);
      const room = p && this.level.rooms.find((r) => pointInPolygon(p, r.polygon));
      if (room) this.toggleRoom(room.key);
      return;
    }
    if (wallId) return this.toggleDoor(wallId);
    if (sd && revealSets(this.state, this.cur!.scene.location).secretDoors.has(sd)) {
      const s = this.built.secretDoors.find((x) => x.objectId === sd)!;
      this.toggleDoor(s.wallId);
    }
  }
  private flashT = 0;
  /** A status line that clears itself after a moment. */
  flashStatus(s: string): void { this.setStatus(s); clearTimeout(this.flashT); this.flashT = window.setTimeout(() => { if (this.status === s) this.setStatus(""); }, 2600); }

  setStatus(s: string, measure?: MeasureResult): void { this.status = s; this.onStatus?.(s, measure); }

  // ------------------------------------------------------------------ Player Display sync

  private broadcast(): void {
    if (this.mode !== 'dm' || !this.cur) return;
    // the room the DM entered from travels too, so the display draws the surroundings round the same spot
    const look = this.home && this.cur.path !== this.home ? { home: this.home, level: this.homeLevel } : undefined;
    this.channel.send({ kind: 'state', state: this.state, location: this.cur.path, level: this.levelId, from: this.enteredFrom?.child === this.cur.path ? this.enteredFrom : undefined, nested: this.nested, camLocked: this.lockPlayerCamera, look });
    this.channel.send({ kind: 'layout', grid: this.gridMode === 'hex' ? 'hex' : 'square', gridOn: this.gridMode !== 'off', lowWalls: this.lowWalls, cut: this.cutFt ?? undefined, fog: this.world.fogOn, nested: this.nested });
    this.sendCamera(true);
  }
  layoutChanged(): void { this.applySlider(); this.restyleGhosts(); this.broadcast(); }
  /** The ghosts follow what the active map would show (low or full walls; Players view hides interiors). */
  private restyleGhosts(): void { for (const r of this.resident.values()) if (r !== this.cur && r.ghost?.on) this.ghostify(r, r.ghost.tint); this.syncNest(); }

  private sendCamera(now = false): void {
    if (this.mode !== 'dm' || !this.lockPlayerCamera) return;
    const send = () => {
      // absolute world feet: each end draws round its own anchor
      const c = this.world.toAbsolute(this.world.camera.position), t = this.world.toAbsolute(this.world.controls.target);
      this.channel.send({ kind: 'camera', pos: [c.x, c.y, c.z], target: [t.x, t.y, t.z], locked: true });
    };
    if (now) return send();
    if (this.camTimer) return;
    this.camTimer = window.setTimeout(() => { this.camTimer = 0; send(); }, 40);
  }

  private displayStateSeq = 0;
  private displayPending?: { cur: Loaded | null; nested: boolean; from?: EnteredFrom };
  /** A failed or superseded load must not leave its provisional display settings behind. */
  private restoreDisplayPending(): void {
    const p = this.displayPending;
    if (p && this.cur === p.cur) { this.nested = p.nested; this.enteredFrom = p.from; }
    this.displayPending = undefined;
  }

  private async onMsg(m: Msg): Promise<void> {
    if (this.mode === 'dm') { if (m.kind === 'hello') this.broadcast(); return; }
    if (m.kind === 'state') {
      const seq = ++this.displayStateSeq;
      // Even a message for the current map supersedes a pending open of another campaign.
      ++this.navSeq;
      this.cancelSwitch();
      this.restoreDisplayPending();
      const previous = { cur: this.cur, nested: this.nested, from: this.enteredFrom };
      // the display stands in the same world as the DM (camera messages are absolute feet): the valley or the old way
      const flip = m.nested !== undefined && m.nested !== this.nested;
      if (flip) this.nested = !!m.nested;
      // the DM's camera came to another map: with the players' camera locked to the DM's the display follows it; with
      // it unlocked the players stay on the party's map (looking is not travelling)
      const stay = m.camLocked === false && m.look;
      const location = stay ? stay.home : m.location;
      let level = stay ? (this.cur?.path === stay.home ? this.levelId : stay.level) : m.level;
      if (!this.cur || this.cur.path !== location || flip) {
        this.displayPending = previous;
        this.enteredFrom = stay ? undefined : m.from;
        const opened = await this.open(location, level);
        if (seq !== this.displayStateSeq) return;
        if (!opened) { this.restoreDisplayPending(); return; }
        this.displayPending = undefined;
      }
      if (seq !== this.displayStateSeq || this.cur?.path !== location) return;
      this.dropStage();
      if (!this.cur) return;
      if (!level || !this.cur.levels.has(level)) level = this.levelId;
      this.state = { ...newCampaign(this.campaign.id), ...m.state };
      this.applySky();
      this.syncStage(); // the places the players know, the party's marker
      if (this.levelId !== level) this.setLevel(level);
      else { this.syncTokens(); this.recompute(); }
    } else if (m.kind === 'camera' && m.locked) {
      this.world.toAnchored(new THREE.Vector3(...m.pos), this.world.camera.position);
      this.world.toAnchored(new THREE.Vector3(...m.target), this.world.controls.target);
      this.world.camera.lookAt(this.world.controls.target);
      this.world.invalidate();
      this.labelDensity(); // the zoom band, the valley's forest and names follow the DM's camera here too
      this.streamer.poke(); // and the maps the DM's camera streams in
    } else if (m.kind === 'layout') {
      this.gridMode = m.gridOn ? m.grid : 'off';
      this.lowWalls = m.lowWalls; this.cutFt = m.cut; if (m.fog !== undefined) this.world.setFog(m.fog);
      this.applySlider();
    }
  }

  // ------------------------------------------------------------------ test/debug hooks

  setRenderMode(mode: 'normal' | 'floorMask'): void {
    if (mode === this.renderMode) return;
    if (mode === 'normal') this.renderMode = mode;
    if (mode === 'floorMask') {
      this.renderMode = mode;
      this.applySlider();
      const white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
      const black = new THREE.MeshBasicMaterial({ color: '#000000' });
      const blackWall = new THREE.MeshBasicMaterial({ color: '#000000', clippingPlanes: [WALL_CLIP] }); // same cutaway as the render
      const stacked = !!this.cur!.scene.stacked;
      const blackCut = new THREE.MeshBasicMaterial({ color: '#000000', clippingPlanes: [WALL_CLIP] });
      const whiteCut = new THREE.MeshBasicMaterial({ color: '#ffffff', clippingPlanes: [WALL_CLIP], polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
      this.maskMats = [white, black, blackWall, blackCut, whiteCut];
      for (const [lid, b] of this.cur!.levels) { if (!b.root.visible) continue; const here = lid === this.levelId; b.root.traverse((o) => {
        if (o.userData.role === 'grid') return;
        const m = o as THREE.Mesh;
        const mat = m.material as THREE.Material | undefined;
        // Translucent ghosts and line overlays do not occlude the floor: hide them from the mask.
        // On another floor of a stacked site only its floor and walls count: a stair-top or prop that just
        // grazes this floor's plane is drawn under the grid, not over it.
        const shell = o.userData.role === 'floor' || o.userData.role === 'wall' || o.userData.role === 'door';
        if ((o as THREE.Line).isLine || (m.isMesh && mat && mat.transparent && mat.opacity < 0.999) || (m.isMesh && stacked && !here && !shell)) {
          if (o.visible) { this.maskHidden.push(o); o.visible = false; }
          return;
        }
        if (!m.isMesh) return;
        this.maskSwap.set(m, m.material);
        m.material = stacked ? (o.userData.role === 'floor' && here ? whiteCut : blackCut) : o.userData.role === 'floor' ? white : o.userData.role === 'wall' || o.userData.role === 'door' ? blackWall : black;
      }); }
      this.world.scene.background = new THREE.Color('#000000'); this.world.mistFloor.visible = false; this.world.scene.fog = null; if (this.backdrop) this.backdrop.visible = false; if (this.stage) this.stage.root.visible = false; this.syncContext();
      for (const r of this.resident.values()) if (r !== this.cur && r.root.visible) { r.root.visible = false; this.maskHidden.push(r.root); } // the other maps of the valley
    } else {
      for (const [m, mat] of this.maskSwap) m.material = mat;
      this.maskSwap.clear();
      for (const m of this.maskMats) m.dispose(); this.maskMats = [];
      for (const o of this.maskHidden) o.visible = true;
      this.maskHidden = [];
      this.world.scene.background = null; this.world.mistFloor.visible = (!this.backdrop && !this.staged) || this.underground; this.world.scene.fog = new THREE.FogExp2(this.world.theme.mist, this.world.fogDensity); if (this.backdrop) this.backdrop.visible = true; if (this.stage) this.stage.root.visible = this.staged; this.syncContext();
      this.applySlider();
    }
    this.world.invalidate();
  }
}

function findUp(o: THREE.Object3D | null, key: string): string | undefined {
  while (o) { if (o.userData[key]) return o.userData[key]; o = o.parent; }
  return undefined;
}
function isShown(o: THREE.Object3D | null): boolean {
  while (o) { if (!o.visible) return false; o = o.parent; }
  return true;
}

