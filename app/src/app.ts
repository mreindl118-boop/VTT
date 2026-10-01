// mistLAB app: one location loaded, one level active, DM or Player Display mode.
import * as THREE from 'three';
import type { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { bounds, pointInPolygon, type Vec2 } from './core/geometry';
import { CoverageMap, Cov } from './core/coverage';
import { squareCellAt, squareCellCenter, squareDistanceFt, worldToHex, hexToWorld, hexDistanceFt, hexSizeFromWidth, type DiagonalRule } from './core/grid';
import { OPENABLE_KINDS, type Container, type GridFile, type Level, type LightSource, type SceneFile, type SceneObject, type Wall, type Ambient } from './core/schema';
import { moveBlockers } from './core/light';
import { canWalk } from './core/movement';
import { classOpacity, fogCurve, hiddenCurve, labelCurve } from './core/slider';
import { baseRingFt, CELL_FT } from './core/units';
import { baseRing } from './kit/pieces';
import { adventurer } from './kit/creatures';
import { PALETTE } from './kit/palette';
import { buildLevel, hitObjectId, type BuiltLevel, type LabelSpec } from './render/build';
import { fogUniforms, sectionClip, setOpacity, setWallCut, WALL_CLIP } from './render/materials';
const WALL_CUT_FT = 5;
import { setGridType } from './render/gridOverlay';
import { World, type CameraPreset } from './render/world';
import { loadLocation } from './data';
import { ICON } from './ui/icons';
import { pinForScene, useWorld } from './ui/worldmap';
import { campaignOf, worldOf, type Campaign } from './campaigns';
import { buildBackdrop } from './render/backdrop';
import { Channel, type Msg } from './state/channel';
import { newCampaign, revealSets, type CampaignState, type Combatant, type Encounter, type Reveal, type Sheet, type Token } from './state/campaign';
import { tacticalRange, type RangeResult } from './core/range';
import { buildRangeOverlay } from './render/rangeOverlay';
import { SHELL_ROLES } from './render/materials';
import { skyAt, type Sky } from './core/sky';
const PARTY_RED = '#c0392b';
import { creatureById, figureFor, aliasFor, seenAs, statsOf, speedFtOf, colorOf } from './bestiary';
import { sightBlockers } from './core/light';
import { idbGet, idbSet } from './state/idb';

export type Mode = 'dm' | 'player';
export type Tool = 'none' | 'reveal' | 'brush-reveal' | 'brush-fog' | 'measure';
export type GridMode = 'off' | 'square' | 'hex';
export interface TapHit {
  room?: { key: string; name: string; revealed: boolean; desc?: string; dm?: string; page?: number; enter?: string };
  pos: Vec2;
  door?: { wallId: string; open: boolean };
  secretDoor?: { id: string; revealed: boolean };
  object?: { id: string; label: string; playerLabel?: string; container?: { locked: boolean; open: boolean; contents?: string }; vis: string; revealed: boolean; kind: string; desc?: string; dm?: string; page?: number; visibleToPlayers: boolean };
  /** A creature the players can see: what they call it and what they make of it. */
  token?: { id: string; name: string; desc?: string };
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
}

const storeKey = (campaignId: string) => (campaignId === 'cos' ? 'campaign:default' : `campaign:${campaignId}`); // CoS keeps its original save

export class App {
  readonly world: World;
  t = 0;
  state: CampaignState = newCampaign();
  cur: Loaded | null = null;
  levelId = '';
  tool: Tool = 'none';
  gridMode: GridMode = 'square';
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
  onStatus: ((s: string) => void) | null = null;
  onChange: (() => void) | null = null;
  private channel: Channel;
  private saveTimer = 0;
  private camTimer = 0;
  private maskSwap = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  private maskHidden: THREE.Object3D[] = [];
  private raycaster = new THREE.Raycaster();

  constructor(host: HTMLElement, readonly mode: Mode) {
    this.world = new World(host);
    this.channel = new Channel((m) => this.onMsg(m));
    this.world.onCamera = () => { this.sendCamera(); this.labelDensity(); this.onCameraUi?.(); };
    this.onCameraUi = null;
    this.installPointer();
  }

  /** Effective slider: the Player Display is pinned at 0. */
  get T(): number { return this.mode === 'player' || this.view === 'players' ? 0 : this.t; }

  campaign: Campaign = campaignOf('appB/death-house');
  /** Load the saved state of the campaign a path belongs to (each campaign has its own save). */
  private async loadCampaign(path: string): Promise<void> {
    const c = campaignOf(path);
    if (this.cur && c.id === this.campaign.id) return;
    if (this.cur) await this.flush();
    this.campaign = c;
    const saved = await idbGet<CampaignState>(storeKey(c.id)).catch(() => undefined);
    this.state = saved ? { ...newCampaign(c.id), ...saved } : newCampaign(c.id); // older saves lack newer fields
    useWorld(worldOf(c), c.theme.id === 'pastoral' ? 'pastoral' : 'gothic');
    this.world.setTheme(c.theme);
    document.body.dataset.campaign = c.id;
  }
  async init(path: string): Promise<void> {
    await this.loadCampaign(path);
    await this.open(path);
    if (this.mode === 'player') this.channel.send({ kind: 'hello' });
    else this.broadcast();
  }

  // ------------------------------------------------------------------ loading

  async open(path: string, levelId?: string): Promise<void> {
    await this.loadCampaign(path);
    if (this.cur) {
      // Labels are page elements: detach each one, or they linger over the next location.
      for (const lb of this.cur.labels) { lb.obj.removeFromParent(); lb.obj.element.remove(); }
      // Token markers and their name tags are page elements too: they would follow the party into the next map.
      for (const g of this.cur.tokens.values()) { g.traverse((c) => { const e = (c as CSS2DObject).element; if (e instanceof HTMLElement) e.remove(); }); g.removeFromParent(); }
      this.cur.tokens.clear();
      this.select(null);
      this.onLeave?.();
      for (const b of this.cur.levels.values()) this.world.scene.remove(b.root);
      for (const tx of this.cur.covTex.values()) tx.dispose();
    }
    const { scene, grid } = await loadLocation(path);
    const levels = new Map<string, BuiltLevel>();
    const coverage = new Map<string, CoverageMap>();
    const covTex = new Map<string, THREE.DataTexture>();
    const labels: Loaded['labels'] = [];
    for (const l of scene.levels) {
      const b = buildLevel(l, grid.levels[l.id]);
      levels.set(l.id, b);
      this.world.scene.add(b.root);
      const cov = CoverageMap.forPolygons([...l.rooms.map((r) => r.polygon), ...grid.levels[l.id].floorPolygons]);
      const seen = this.state.seen[`${scene.location}/${l.id}`];
      if (seen) cov.load({ seen, paint: '' });
      coverage.set(l.id, cov);
      const tex = new THREE.DataTexture(cov.toTexture() as Uint8Array<ArrayBuffer>, cov.width, cov.height, THREE.RGBAFormat);
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearFilter;
      tex.needsUpdate = true;
      covTex.set(l.id, tex);
      for (const k of scene.links) for (const [end, other] of [[k.from, k.to], [k.to, k.from]] as const) {
        if (end.level !== l.id) continue;
        const to = scene.levels.find((x) => x.id === other.level);
        const up = (to?.elevationFt ?? 0) > l.elevationFt;
        b.labels.push({ id: `link:${k.id}:${end.level}`, text: `${up ? '↑' : '↓'} ${to?.name ?? other.level}`, pos: new THREE.Vector3(end.pos[0], l.elevationFt + 3, end.pos[1]), vis: 'player', kind: 'link', linkId: k.id });
      }
      for (const spec of b.labels) {
        if (this.mode === 'player' && spec.vis === 'dm-note') continue; // no DM UI on the Player Display
        const obj = this.world.label(spec.text, spec.sub, `${spec.kind} ${spec.vis}`);
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
    this.cur = { path, scene, grid, levels, coverage, covTex, labels, tokens: new Map() };
    // The world-map marker follows the party into whichever pin this scene belongs to.
    const pin = pinForScene(path) ?? (scene.parent ? pinForScene(scene.parent) : undefined);
    // Outdoors: the land, forest, mountains and the castle continue to the horizon.
    this.backdrop?.removeFromParent(); this.backdrop = undefined;
    // The level that meets the open air (the one with terrain: a courtyard, a street) decides outdoor fog and the backdrop.
    const l0 = scene.levels.find((l) => l.terrain?.length) ?? scene.levels[0], outdoor = !!pin && !!l0.terrain?.length && (l0.ambient ?? scene.ambient) !== 'darkness';
    if (outdoor) {
      const bb = bounds([...l0.rooms.map((r) => r.polygon), ...(l0.terrain ?? []).map((t) => t.polygon)]);
      const roadLike = (f: string | undefined, name = '') => f === 'cobble' || f === 'dirt' || /road|street|lane|square|path|trail|track/i.test(name);
      const roads = [...l0.rooms.filter((r) => roadLike(r.floor, r.name)).map((r) => r.polygon), ...(l0.terrain ?? []).filter((t) => roadLike(t.floor)).map((t) => t.polygon)];
      this.backdrop = buildBackdrop({ center: [(bb.minX + bb.maxX) / 2, (bb.minZ + bb.maxZ) / 2], radius: Math.hypot(bb.maxX - bb.minX, bb.maxZ - bb.minZ) / 2, elevation: l0.elevationFt, pin: pin!.pos as Vec2, world: worldOf(this.campaign), theme: this.campaign.theme, valley: !!scene.valley, bounds: bb, north: l0.north, roads, crag: pin!.heightFt ?? 0 });
      this.world.scene.add(this.backdrop);
    }
    const span = Math.hypot(bounds(l0.rooms.map((r) => r.polygon).concat((l0.terrain ?? []).map((t) => t.polygon))).maxX - bounds(l0.rooms.map((r) => r.polygon).concat((l0.terrain ?? []).map((t) => t.polygon))).minX, 1);
    this.world.fogScale = outdoor ? Math.min(1, 900 / span) : 1;
    this.world.setOutdoor(outdoor);
    this.applySky();
    if (pin && this.state.world?.key !== pin.key) this.moveWorld([...pin.pos] as Vec2, pin.key, this.state.world ? Math.hypot(this.state.world.pos[0] - pin.pos[0], this.state.world.pos[1] - pin.pos[1]) : 0, false);
    this.ensureDefaultToken();
    this.setLevel(levelId && levels.has(levelId) ? levelId : scene.entry && levels.has(scene.entry) ? scene.entry : scene.levels[0].id, true);
    this.onChange?.();
  }

  setLevel(id: string, frame = false): void {
    if (!this.cur) return;
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
    this.world.mistFloor.position.y = this.level.elevationFt - 1.2;
    this.world.mistFloor.visible = !this.backdrop && this.world.fogOn;
    this.syncTokens();
    this.recompute();
    if (frame) this.frameLevel();
    this.onChange?.();
  }

  /** The floors that stand on one another around a level: each one's ceiling meets the next one's floor.
   *  A house and the dungeon dug under its garden are two stacks; an open site (a tower) is one. */
  stackOf(id: string): Set<string> {
    const ls = this.cur!.scene.levels, out = new Set<string>([id]);
    if (this.cur!.scene.stacked === 'open') { for (const l of ls) out.add(l.id); return out; }
    const top = (l: Level) => l.elevationFt + (l.ceilingFt ?? 10);
    const meets = (a: Level, b: Level) => Math.abs(top(a) - b.elevationFt) <= 3 || Math.abs(top(b) - a.elevationFt) <= 3;
    for (let grew = true; grew;) { grew = false; for (const l of ls) if (!out.has(l.id) && ls.some((o) => out.has(o.id) && meets(o, l))) { out.add(l.id); grew = true; } }
    return out;
  }

  get level(): Level { return this.cur!.scene.levels.find((l) => l.id === this.levelId)!; }
  get built(): BuiltLevel { return this.cur!.levels.get(this.levelId)!; }

  frameLevel(preset = this.camPreset): void {
    this.camPreset = preset;
    const l = this.level;
    // A stacked site frames the current floor's footprint: the floors above and below share it (a tower,
    // a house), while a level that sits elsewhere in plan (the dungeon under the garden) stays out of frame.
    // With the cut lifted clear above the whole stack the building shows entire: frame every floor of the stack.
    const whole = this.cur!.scene.stacked && this.cutFt !== undefined && this.cutFt !== null && this.sectionRange && this.cutFt >= this.sectionRange.max - 1;
    const polys = whole ? [...this.stackOf(l.id)].flatMap((id) => this.cur!.scene.levels.find((x) => x.id === id)!.rooms.map((r) => r.polygon)) : l.rooms.map((r) => r.polygon);
    const b = bounds(polys);
    this.world.controls.maxDistance = Math.max(400, Math.hypot(b.maxX - b.minX, b.maxZ - b.minZ) * 2.5);
    this.world.frame(b, l.elevationFt, preset);
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
    if (cur && this.follow) this.world.moveTo(new THREE.Vector3(cur.token.pos[0], this.level.elevationFt, cur.token.pos[1]), Math.min(this.world.camera.position.distanceTo(this.world.controls.target), 66), true);
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
    this.rangeMesh?.removeFromParent(); this.rangeMesh = undefined; this.rangeFor = undefined;
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
    this.world.frame({ minX: b.minX - pad, minZ: b.minZ - pad, maxX: b.maxX + pad, maxZ: b.maxZ + pad }, hit.level.elevationFt, this.camPreset, true);
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
    this.world.moveTo(new THREE.Vector3(t.pos[0], l.elevationFt, t.pos[1]), dist, animate);
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
    for (const [id, g] of this.cur!.tokens) { g.traverse((c) => { const e = (c as CSS2DObject).element; if (e instanceof HTMLElement) e.remove(); }); g.parent?.remove(g); this.cur!.tokens.delete(id); }
    for (const t of this.tokensHere()) {
      if (t.role === 'creature' && t.hidden && this.restricted) continue; // not yet shown to the players
      const base = baseRingFt(t.size);
      const g = new THREE.Group();
      const entry = t.creatureId ? creatureById(t.creatureId) : undefined;
      const fig = entry ? figureFor(entry) : adventurer(t.role === 'member' ? { cloth: t.color } : undefined); fig.position.y = 0.3;
      g.add(baseRing(base, t.role === 'party' ? PARTY_RED : t.color), fig);
      if (t.role === 'party') { const amp = this.world.label('&', undefined, 'token party-amp'); amp.position.set(0, 7.6, 0); g.add(amp); }
      if (t.role === 'member' || t.role === 'creature') {
        const lb = this.world.label(this.restricted ? (t.playerName ?? t.name) : t.name, undefined, `token${t.role === 'creature' ? ' creature' : ''}${t.hidden ? ' hidden' : ''}`);
        lb.position.set(0, 7.2, 0); lb.element.style.setProperty('--tok', t.color); g.add(lb);
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
    if (this.gridMode !== 'off') setGridType(b.grid, this.gridMode);
    // Cutaway: walls and doors keep their real height; the top is clipped at 5 ft above the floor.
    // The section cut: on stacked sites it is a slicer the DM can move; elsewhere it trims walls at 5 ft.
    // The follow cut sits just under the floor above (the roof, on the top storey): the whole room shows, nothing in it is cut.
    const followCut = this.cur.scene.stacked === 'open' ? this.sectionRange!.max : this.level.elevationFt + (this.level.ceilingFt ?? 10) - 0.5;
    const cut = this.cur.scene.stacked ? (this.cutFt ?? followCut) : this.lowWalls ? this.level.elevationFt + WALL_CUT_FT : null;
    this.followCutFt = followCut;
    setWallCut(cut);
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
    const d = this.world.camera.position.distanceTo(this.world.controls.target);
    const z = d > 900 ? 'far' : d > 420 ? 'mid' : 'near';
    if (document.body.dataset.zoom !== z) document.body.dataset.zoom = z;
  }
  setT(t: number): void { this.t = t; this.applySlider(); }
  setView(v: 'dm' | 'players'): void { this.view = v; this.tool = 'none'; this.clearRuler(); this.stopPlacing(); this.select(null); if (this.cur) { this.syncTokens(); this.recompute(); } this.applySlider(); this.onChange?.(); }

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
  /** Move the party on the world map (miles); keeps a short trail of moves. */
  moveWorld(pos: Vec2, key: string | undefined, miles: number, save = true): void {
    const w = this.state.world, trail = [...(w?.trail ?? (w ? [{ pos: w.pos, key: w.key, miles: 0, at: Date.now() }] : [])), { pos, key, miles: Math.round(miles * 100) / 100, at: Date.now() }].slice(-50);
    this.state.world = { pos, key, trail };
    if (key) this.revealPin(key, true, false); // a place the party has been to is known to the players
    if (save) this.commit();
  }
  /** World-map places the players know. */
  get pinsRevealed(): Set<string> { return new Set(this.state.worldRevealed ?? []); }
  revealPin(key: string, on: boolean, save = true): void {
    const set = this.pinsRevealed; if (set.has(key) === on) return;
    if (on) set.add(key); else set.delete(key);
    this.state.worldRevealed = [...set];
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
    this.world.setSky(this.sky, this.openAir(l0) && !!this.backdrop);
  }

  // ------------------------------------------------------------------ creatures: the repository on the map
  /** The creature being placed by taps, if any. */
  placing: string | null = null;
  placed = 0;
  startPlacing(creatureId: string): void {
    this.placing = creatureId; this.placed = 0; this.select(null);
    const e = creatureById(creatureId);
    this.setStatus(`Tap the map to place ${e?.name ?? 'it'} · Esc to stop`);
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
    const hit = this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.level.elevationFt), p);
    return hit ? [p.x, p.z] : null;
  }
  private pick(e: PointerEvent): THREE.Intersection | undefined {
    this.raycaster.setFromCamera(this.ndc(e), this.world.camera);
    const cut = this.lowWalls ? this.level.elevationFt + WALL_CUT_FT : Infinity;
    return this.raycaster.intersectObject(this.built.root, true).find((h) => h.object.visible && (h.object as THREE.Mesh).isMesh && h.object.userData.role !== 'grid' && h.object.userData.role !== 'marker' && isShown(h.object)
      // The cutaway clips walls visually; ignore hits on the clipped-away part.
      && !((h.object.userData.role === 'wall' || h.object.userData.role === 'door') && h.point.y > cut + 0.01));
  }

  snap(p: Vec2): Vec2 {
    const g = this.cur!.grid.levels[this.levelId];
    if (this.gridMode === 'hex') { const s = hexSizeFromWidth(CELL_FT); return hexToWorld(worldToHex(p, s, g.hexOrientation, g.origin), s, g.hexOrientation, g.origin); }
    return squareCellCenter(squareCellAt(p, g.origin), g.origin);
  }
  // ------------------------------------------------------------------ the measure tool: tap two points, read the distance
  private ruler?: { a: Vec2; b?: Vec2; line: THREE.Line; label: CSS2DObject };
  measureTap(p: Vec2): void {
    const at: Vec2 = [Math.round(p[0] * 2) / 2, Math.round(p[1] * 2) / 2];
    if (!this.ruler || this.ruler.b) { this.clearRuler(); const geo = new THREE.BufferGeometry(); const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#f2b35b', linewidth: 2 })); line.userData.role = 'marker'; line.renderOrder = 6; const label = this.world.label('', undefined, 'ruler'); this.world.scene.add(line, label); this.ruler = { a: at, line, label }; this.setStatus('Tap the other end'); this.rulerTo(at); return; }
    this.ruler.b = at; this.rulerTo(at); this.setStatus(`${this.distanceFt(this.ruler.a, at)} ft · ${Math.round(this.distanceFt(this.ruler.a, at) / 5)} squares · tap to measure again`);
  }
  /** Stretch the ruler to a point (the preview end, or the fixed second end). */
  rulerTo(p: Vec2): void {
    const r = this.ruler; if (!r) return;
    const y = this.level.elevationFt + 0.4, a = r.a;
    r.line.geometry.setFromPoints([new THREE.Vector3(a[0], y, a[1]), new THREE.Vector3(p[0], y, p[1])]);
    const ft = this.distanceFt(a, p); r.label.position.set((a[0] + p[0]) / 2, y + 1.5, (a[1] + p[1]) / 2); r.label.element.textContent = `${ft} ft`; r.label.visible = ft > 0;
    this.world.invalidate();
  }
  clearRuler(): void { if (!this.ruler) return; this.ruler.line.removeFromParent(); this.ruler.line.geometry.dispose(); this.ruler.label.element.remove(); this.ruler.label.removeFromParent(); this.ruler = undefined; this.world.invalidate(); }
  distanceFt(a: Vec2, b: Vec2): number {
    const g = this.cur!.grid.levels[this.levelId];
    if (this.gridMode === 'hex') { const s = hexSizeFromWidth(CELL_FT); return hexDistanceFt(worldToHex(a, s, g.hexOrientation, g.origin), worldToHex(b, s, g.hexOrientation, g.origin)); }
    return squareDistanceFt(squareCellAt(a, g.origin), squareCellAt(b, g.origin), (localStorage.getItem('mistlab.diagonal') as 'five' | 'five-ten-five') ?? 'five');
  }

  private installPointer(): void {
    const el = this.world.renderer.domElement;
    let drag: { kind: 'brush'; pts: Vec2[] } | { kind: 'tap'; x: number; y: number } | null = null;
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
      } else if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) {
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
  /** Where north points on screen (radians, 0 = up, clockwise) and how many pixels a foot covers at the target. */
  cameraFrame(): { north: number; pxPerFt: number } {
    const l = this.cur ? this.level : undefined, n = l?.north ?? '-z';
    const nv = n === '+z' ? [0, 1] : n === '-x' ? [-1, 0] : n === '+x' ? [1, 0] : [0, -1];
    const az = this.world.controls.getAzimuthalAngle();
    // screen up is the direction from camera to target in plan: (-sin az, -cos az); north's screen angle is measured from it
    const upx = -Math.sin(az), upz = -Math.cos(az);
    const north = Math.atan2(nv[0] * upz - nv[1] * upx, nv[0] * upx + nv[1] * upz);
    const t = this.world.controls.target, r = this.world.renderer.domElement.getBoundingClientRect();
    const p0 = new THREE.Vector3(t.x, t.y, t.z).project(this.world.camera), p1 = new THREE.Vector3(t.x + 10 * upz, t.y, t.z - 10 * upx).project(this.world.camera);
    const px = Math.hypot((p1.x - p0.x) * r.width / 2, (p1.y - p0.y) * r.height / 2) / 10;
    return { north: -north, pxPerFt: px };
  }
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
    if (!g.parent) this.world.scene.add(g);
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
      if (cur?.token.id !== id) { this.flashStatus(`Not ${t.name}'s turn`); return false; }
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
  onHover?: (tip: { title: string; sub?: string } | null, x: number, y: number) => void;
  /** Mouse hover: name what is under the cursor. The DM sees everything; players only what they can see. */
  private hover(e: PointerEvent): void {
    if (!this.cur || !this.onHover) return;
    this.onHover(this.describe(e), e.clientX, e.clientY);
  }
  describe(e: PointerEvent): { title: string; sub?: string } | null {
    const hit = this.pick(e), o = hit?.object, loc = this.cur!.scene.location, p = this.floorPoint(e);
    const room = p ? this.roomAt(this.level, p) : undefined;
    const where = room ? `${room.key} · ${room.name}` : undefined;
    const players = this.restricted;
    const tokId = o && findUp(o, 'tokenId');
    if (tokId) {
      const t = this.state.tokens.find((x) => x.id === tokId); if (!t) return null;
      if (t.role === 'creature') {
        const en = t.creatureId ? creatureById(t.creatureId) : undefined, st = en && statsOf(en);
        if (players) return t.hidden ? null : { title: t.playerName ?? t.name, sub: en ? seenAs(en) : undefined };
        return { title: t.name, sub: [t.hidden ? 'Hidden from players' : `Players see: ${t.playerName ?? t.name}`, st ? `AC ${st.ac}` : '', t.hp ? `${t.hp.cur}/${t.hp.max} hp` : '', 'tap to pick up'].filter(Boolean).join(' · ') };
      }
      return { title: t.name, sub: this.selected === tokId ? 'Tap where it goes' : 'Tap to pick up and move' };
    }
    const oid = hitObjectId(hit);
    const obj = oid ? this.level.objects.find((x) => x.id === oid) : undefined;
    if (obj) {
      const ci = this.containerInfo(obj, players);
      const cs = ci ? (ci.open ? 'Open' : ci.locked ? (players ? 'Locked' : 'Locked · closed') : 'Closed · tap to open') : undefined;
      if (players) return this.playerCanSee(obj) ? { title: playerLabel(obj), sub: cs } : null;
      const rs = revealSets(this.state, loc);
      const vis = obj.vis === 'player' || !obj.vis ? undefined : `${obj.vis.replace('-', ' ')} · ${rs.objects.has(obj.id) ? 'revealed' : 'hidden from players'}`;
      return { title: obj.label ?? kindName(obj.kind), sub: [cs, vis, where].filter(Boolean).join(' · ') || undefined };
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
    if (room && (!players || this.isRevealed(room.key))) return { title: players ? room.name : `${room.key} · ${room.name}`, sub: players ? undefined : `${this.isRevealed(room.key) ? 'Revealed' : 'Not revealed'}${room.page ? ` · p.${room.page}` : ''}` };
    return null;
  }

  private lastTap = 0;
  private tap(e: PointerEvent): void {
    // Moving is two deliberate taps: the token, then where it goes. A swipe never moves anyone.
    const tokHit = this.pick(e), fp = this.floorPoint(e);
    if (this.placing && !this.restricted) { if (fp) { this.addCreature(this.placing, fp); this.placed++; this.setStatus(`${this.placed} placed · tap for more · Esc to stop`); } return; }
    // The figure is small from above: a tap anywhere on its base ring picks it up too.
    const tokId = (tokHit && findUp(tokHit.object, 'tokenId')) || (fp && this.tokensHere().filter((t) => this.playerSees(t) || !this.restricted).find((t) => Math.hypot(t.pos[0] - fp[0], t.pos[1] - fp[1]) <= baseRingFt(t.size) / 2 + 1)?.id);
    if (tokId) {
      const tk = this.state.tokens.find((x) => x.id === tokId)!;
      if (this.restricted && tk.role === 'creature') { // players may look, not move
        const en = tk.creatureId ? creatureById(tk.creatureId) : undefined;
        this.onTap?.({ pos: fp ?? tk.pos, token: { id: tk.id, name: tk.playerName ?? tk.name, desc: en ? seenAs(en) : undefined } }, e.clientX, e.clientY); return;
      }
      const cur = this.current;
      if (this.encounter && this.restricted && cur && cur.token.id !== tokId) { this.flashStatus(`Not ${this.state.tokens.find((x) => x.id === tokId)?.name ?? 'their'}'s turn`); return; }
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
      if (obj && this.onTap && this.playerCanSee(obj)) { this.onTap({ pos: [0, 0], object: { id: obj.id, label: playerLabel(obj), container: this.containerInfo(obj, true), vis: obj.vis, revealed: true, kind: obj.kind, desc: playerDesc(obj), visibleToPlayers: true } }, e.clientX, e.clientY); return; }
      // A revealed room: its name and what the party notices there.
      const fp = this.floorPoint(e), room = fp && this.roomAt(this.level, fp);
      if (room && this.onTap && this.isRevealed(room.key)) this.onTap({ pos: fp!, room: { key: room.key, name: room.name, revealed: true, desc: room.desc, enter: room.enter } }, e.clientX, e.clientY);
      return;
    }
    const sd = hit && (findUp(hit.object, 'secretDoor') ?? (hit.object.userData.role === 'door' ? this.built.secretDoors.find((s) => s.door === hit.object)?.objectId : undefined));
    const wallId = hit && hit.object.userData.role === 'door' ? (hit.object.userData.wallId as string | undefined) : undefined;
    if (this.tool === 'measure') { if (fp) this.measureTap(fp); return; }
    if (this.tool === 'none' && this.onTap) {
      const oid = hitObjectId(hit);
      const p = this.floorPoint(e);
      const room = p && this.roomAt(this.level, p);
      const obj = oid ? this.level.objects.find((o) => o.id === oid) : undefined;
      const pos = p ? ([p[0], p[1]] as Vec2) : ([0, 0] as Vec2);
      const rs = revealSets(this.state, this.cur!.scene.location);
      const info: TapHit = { room: room ? { key: room.key, name: room.name, revealed: this.isRevealed(room.key), desc: room.desc, dm: room.dm, page: room.page, enter: room.enter } : undefined, pos,
        door: wallId ? { wallId, open: !!(this.state.doorsOpen[`${this.cur!.scene.location}/${wallId}`] ?? this.level.walls.find((w) => w.id === wallId)?.open) } : undefined,
        secretDoor: sd ? { id: sd, revealed: rs.secretDoors.has(sd) } : undefined,
        object: obj ? { id: obj.id, label: obj.label ?? kindName(obj.kind), playerLabel: playerLabel(obj), container: this.containerInfo(obj, false), vis: obj.vis, revealed: rs.objects.has(obj.id), kind: obj.kind, desc: playerDesc(obj), dm: obj.dm, page: this.level.rooms.find((r) => r.key === obj.key)?.page, visibleToPlayers: this.playerCanSee(obj) } : undefined };
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

  setStatus(s: string): void { this.status = s; this.onStatus?.(s); }

  // ------------------------------------------------------------------ Player Display sync

  private broadcast(): void {
    if (this.mode !== 'dm' || !this.cur) return;
    this.channel.send({ kind: 'state', state: this.state, location: this.cur.path, level: this.levelId });
    this.channel.send({ kind: 'layout', grid: this.gridMode === 'hex' ? 'hex' : 'square', gridOn: this.gridMode !== 'off', lowWalls: this.lowWalls, cut: this.cutFt ?? undefined, fog: this.world.fogOn });
    this.sendCamera(true);
  }
  layoutChanged(): void { this.applySlider(); this.broadcast(); }

  private sendCamera(now = false): void {
    if (this.mode !== 'dm' || !this.lockPlayerCamera) return;
    const send = () => {
      const c = this.world.camera.position, t = this.world.controls.target;
      this.channel.send({ kind: 'camera', pos: [c.x, c.y, c.z], target: [t.x, t.y, t.z], locked: true });
    };
    if (now) return send();
    if (this.camTimer) return;
    this.camTimer = window.setTimeout(() => { this.camTimer = 0; send(); }, 40);
  }

  private async onMsg(m: Msg): Promise<void> {
    if (this.mode === 'dm') { if (m.kind === 'hello') this.broadcast(); return; }
    if (m.kind === 'state') {
      if (!this.cur || this.cur.path !== m.location) await this.open(m.location, m.level);
      this.state = { ...newCampaign(this.campaign.id), ...m.state };
      this.applySky();
      if (this.levelId !== m.level) this.setLevel(m.level);
      else { this.syncTokens(); this.recompute(); }
    } else if (m.kind === 'camera' && m.locked) {
      this.world.camera.position.set(...m.pos);
      this.world.controls.target.set(...m.target);
      this.world.camera.lookAt(this.world.controls.target);
      this.world.invalidate();
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
      this.world.scene.background = new THREE.Color('#000000'); this.world.mistFloor.visible = false; this.world.scene.fog = null; if (this.backdrop) this.backdrop.visible = false;
    } else {
      for (const [m, mat] of this.maskSwap) m.material = mat;
      this.maskSwap.clear();
      for (const o of this.maskHidden) o.visible = true;
      this.maskHidden = [];
      this.world.scene.background = null; this.world.mistFloor.visible = !this.backdrop; this.world.scene.fog = new THREE.FogExp2(this.world.theme.mist, this.world.fogDensity); if (this.backdrop) this.backdrop.visible = true;
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

/** Generic player-facing descriptions by kind, used when an object has none of its own. Original wording. */
export const KIND_DESC: Record<string, string> = {
  table: 'A wooden table.', chair: 'A wooden chair.', bed: 'A bed with a straw mattress.', 'bed-plain': 'A plain wood-framed bed.', 'four-poster-bed': 'A four-poster bed hung with curtains.',
  'child-bed': 'A small bed, sized for a child.', chest: 'A wooden chest.', trunk: 'A wooden trunk.', 'crate-chest': 'A wooden chest with an iron padlock.', 'claw-chest-skeleton': 'A heavy chest on clawed iron feet. A skeleton in leather armor hangs half out of it.',
  coffin: 'A wooden coffin.', 'bier-coffin': 'A stone bier with a coffin resting on it.', 'stone-slab': 'A heavy stone slab.', column: 'A stone pillar.', post: 'A thick wooden post with a crossbeam.',
  fireplace: 'A fireplace, unlit.', chandelier: 'A chandelier hangs from the ceiling.', drapes: 'Heavy drapes cover the window.', 'shield-of-arms': 'A shield painted with a coat of arms: a golden windmill on a red field.',
  portrait: 'A framed portrait.', 'stag-head': "A stag's head mounted above the mantel.", 'stuffed-wolf': 'A stuffed wolf, posed mid-snarl.', 'cloak-hooks': 'Cloaks hang from hooks on the wall; a top hat sits on the shelf above.',
  shelves: 'Shelves stacked with wares.', bookshelf: 'Shelves of books.', desk: 'A writing desk.', wardrobe: 'A tall wardrobe.', stove: 'A small iron stove.', oven: 'A domed stone oven with a bent stovepipe.',
  crib: 'A crib draped in a black shroud.', harpsichord: 'A harpsichord with a bench.', harp: 'A tall standing harp.', 'armor-suit': 'A suit of armor with a wolf-shaped visor, holding a spear.', 'glass-hanging': 'A stained-glass hanging of figures singing and playing.',
  tub: 'A wooden tub on clawed feet.', 'barrel-spigot': 'A barrel beneath a spigot in the wall.', 'standing-mirror': 'A full-length mirror in a carved frame.', nightstand: 'A small bedside table.', 'rocking-chair': 'A rocking chair.',
  candlestick: 'An iron candlestick.', 'oil-lamp': 'An oil lamp, unlit.', lamp: 'An oil lamp.', tapestry: 'A tapestry of riders and hounds at the hunt.', bench: 'A long wooden bench.', 'torch-crate': 'An open crate of torches.',
  doll: 'A smiling doll in a lacy yellow dress, draped in cobwebs.', bones: 'Moldy bones scattered on the floor.', skeleton: 'Skeletal remains.', 'shackled-skeleton': 'A skeleton hangs from rusted shackles on the wall.', 'small-skeletons': 'Two small skeletons in tattered clothes; the smaller cradles a stuffed doll.',
  'strahd-statue': 'A painted wooden statue of a gaunt, pale man in a black cloak, one hand resting on the head of a wolf. He holds a smoky crystal orb.', 'ghoul-altar': 'A stone altar carved with grasping ghouls, stained dark with old blood.',
  chains: 'Rusty chains and shackles hang from the ceiling.', 'planks-ceiling': 'A low ceiling of close-fitting planks.', 'pit-open': 'An open pit lined with sharpened stakes.', 'pit-cover': 'The earthen floor.', well: 'A stone-lipped well; a bucket hangs from a rope and pulley.',
  pallet: 'A moldy straw pallet.', niche: 'A wall niche holding a small object.', dais: 'An octagonal stone dais rising from the water.', ledge: 'A dry stone ledge above the water.', altar: 'A stone altar.', wheel: 'A wooden wheel half-embedded in the wall.',
  refuse: 'A half-submerged heap of refuse.', portcullis: 'A rusty iron portcullis.', gate: 'A wrought-iron gate on shrieking hinges.', 'timber-brace': 'Timber braces shore up the tunnel.', cobweb: 'Thick cobwebs.', sheeted: 'Old furniture draped in dusty white sheets.',
  'wine-cask': 'A small cask of wine.', 'dumbwaiter-shaft': 'A small door in the wall opens onto a dumbwaiter shaft.', dumbwaiter: 'A dumbwaiter door.', trapdoor: 'A trapdoor set into the floor.', 'toy-chest-windmills': 'A toy chest painted with windmills.', 'dollhouse-replica': 'A dollhouse: an exact replica of this house.',
  'toy-chest': 'A small box.', 'spiral-stair': 'A spiral staircase.', 'stairs-straight': 'A staircase.', cabinet: 'A wooden cabinet.', 'secret-panel': 'A section of wall.', 'pressure-plate': 'The floor.',
  ghoul: 'A hunched, gray-skinned corpse with long claws.', ghast: 'A gaunt, robed corpse that reeks of the grave.', shadow: 'A patch of darkness shaped like a person.', ghost: 'A translucent figure drifting above the floor.', specter: 'A skeletally thin, translucent woman, screaming silently.',
  'animated-armor': 'A suit of black plate armor draped in cobwebs.', mimic: 'A wooden door.', 'shambling-mound': 'A mound of rotting vegetation and refuse.', grick: 'A worm-like thing with a beak ringed by tentacles.', 'swarm-of-insects': 'A boiling mass of centipedes.', 'broom-of-animated-attack': 'A cobweb-covered broom leaning against the wall.',
};
export function kindName(kind: string): string { return kind.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()); }

/** What players call a thing: never the DM label of something hidden or disguised. */
export function playerLabel(o: SceneObject): string {
  if (o.playerLabel) return o.playerLabel;
  return o.vis === 'player' || !o.vis ? o.label ?? kindName(o.kind) : kindName(o.kind);
}
/** What players read: the authored description, else a generic one for plainly visible things. */
export function playerDesc(o: SceneObject): string | undefined {
  return o.desc ?? (o.vis === 'player' || !o.vis || o.vis === 'hidden-creature' ? KIND_DESC[o.kind] : undefined);
}
