// mistLAB app: one location loaded, one level active, DM or Player Display mode.
import * as THREE from 'three';
import type { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { bounds, pointInPolygon, type Vec2 } from './core/geometry';
import { CoverageMap, Cov } from './core/coverage';
import { squareCellAt, squareCellCenter, squareDistanceFt, worldToHex, hexToWorld, hexDistanceFt, hexSizeFromWidth } from './core/grid';
import type { GridFile, Level, LightSource, SceneFile } from './core/schema';
import { classOpacity, fogCurve, hiddenCurve, labelCurve } from './core/slider';
import { baseRingFt, CELL_FT } from './core/units';
import { baseRing } from './kit/pieces';
import { adventurer } from './kit/creatures';
import { PALETTE } from './kit/palette';
import { buildLevel, type BuiltLevel, type LabelSpec } from './render/build';
import { fogUniforms, setOpacity } from './render/materials';
import { setGridType } from './render/gridOverlay';
import { World, type CameraPreset } from './render/world';
import { loadLocation } from './data';
import { Channel, type Msg } from './state/channel';
import { newCampaign, revealSets, type CampaignState, type Reveal, type Token } from './state/campaign';
import { idbGet, idbSet } from './state/idb';

export type Mode = 'dm' | 'player';
export type Tool = 'none' | 'reveal' | 'brush-reveal' | 'brush-fog';
export type GridMode = 'off' | 'square' | 'hex';

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

const STORE_KEY = 'campaign:default';

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
    this.world.onCamera = () => this.sendCamera();
    this.installPointer();
  }

  /** Effective slider: the Player Display is pinned at 0. */
  get T(): number { return this.mode === 'player' || this.view === 'players' ? 0 : this.t; }

  async init(path: string): Promise<void> {
    const saved = await idbGet<CampaignState>(STORE_KEY).catch(() => undefined);
    if (saved) this.state = saved;
    await this.open(path);
    if (this.mode === 'player') this.channel.send({ kind: 'hello' });
    else this.broadcast();
  }

  // ------------------------------------------------------------------ loading

  async open(path: string, levelId?: string): Promise<void> {
    if (this.cur) {
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
      for (const spec of b.labels) {
        if (this.mode === 'player' && spec.vis === 'dm-note') continue; // no DM UI on the Player Display
        const obj = this.world.label(spec.text, spec.sub, `${spec.kind} ${spec.vis}`);
        obj.position.copy(spec.pos);
        b.root.add(obj);
        labels.push({ obj, spec, level: l.id });
      }
    }
    this.cur = { path, scene, grid, levels, coverage, covTex, labels, tokens: new Map() };
    this.ensureDefaultToken();
    this.setLevel(levelId && levels.has(levelId) ? levelId : scene.levels[0].id, true);
    this.onChange?.();
  }

  setLevel(id: string, frame = false): void {
    if (!this.cur) return;
    this.levelId = id;
    for (const [lid, b] of this.cur.levels) b.root.visible = lid === id;
    const cov = this.cur.coverage.get(id)!;
    fogUniforms.uCovTex.value = this.cur.covTex.get(id)!;
    fogUniforms.uCovOrigin.value.set(cov.originX, cov.originZ);
    fogUniforms.uCovSize.value.set(cov.width, cov.height);
    this.syncTokens();
    this.recompute();
    if (frame) this.frameLevel();
    this.onChange?.();
  }

  get level(): Level { return this.cur!.scene.levels.find((l) => l.id === this.levelId)!; }
  get built(): BuiltLevel { return this.cur!.levels.get(this.levelId)!; }

  frameLevel(preset = this.camPreset): void {
    this.camPreset = preset;
    const l = this.level;
    this.world.frame(bounds(l.rooms.map((r) => r.polygon)), l.elevationFt, preset);
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
    this.state.tokens.push({ id: `pc-${loc}`, name: 'Party', location: loc, level: level.id, pos: c, size: 'medium', darkvisionFt: 0, color: PALETTE.amber, light: { bright: 20, dim: 40 } });
  }

  /** The party token for the loaded location. */
  get party(): Token | undefined { return this.state.tokens.find((t) => t.location === this.cur?.scene.location); }

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
    this.world.frame(b, hit.level.elevationFt, this.camPreset, true);
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
    this.world.moveTo(new THREE.Vector3(t.pos[0], l.elevationFt, t.pos[1]), undefined, animate);
  }

  isRevealed(key: string): boolean {
    const loc = this.cur!.scene.location;
    const last = [...this.state.reveals].reverse().find((r) => r.type === 'room' && r.location === loc && r.key === key) as Extract<Reveal, { type: 'room' }> | undefined;
    return !!last && last.mode !== 'fog';
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
    for (const [id, g] of this.cur!.tokens) { g.parent?.remove(g); this.cur!.tokens.delete(id); }
    for (const t of this.tokensHere()) {
      const base = baseRingFt(t.size);
      const g = new THREE.Group();
      const fig = adventurer(); fig.position.y = 0.3;
      g.add(baseRing(base, t.color), fig);
      g.traverse((c) => {
        const m = c as THREE.Mesh;
        if (!m.isMesh) return;
        const src = m.material as THREE.MeshLambertMaterial;
        m.material = new THREE.MeshLambertMaterial({ color: src.color, flatShading: true }); // tokens are never fogged
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
    const walls = l.walls.map((w) => ({
      ...w,
      flags: w.flags.includes('secret-door') && rs.secretWalls.has(w.id) ? (['door'] as typeof w.flags) : w.flags,
      open: this.state.doorsOpen[`${loc}/${w.id}`] ?? w.open,
    }));
    const lights: LightSource[] = [...l.lights];
    const viewers = this.tokensHere().map((t) => {
      if (t.light) lights.push({ id: `tok:${t.id}`, pos: [t.pos[0], 4, t.pos[1]], bright: t.light.bright, dim: t.light.dim });
      return { pos: t.pos, darkvisionFt: t.darkvisionFt };
    });
    cov.updateVision(viewers, this.cur.grid.levels[l.id].floorPolygons.concat(l.rooms.map((r) => r.polygon)), walls, lights, l.ambient ?? this.cur.scene.ambient, rs.secretWalls);
    this.state.seen[`${loc}/${l.id}`] = cov.serialize().seen;
    const tex = this.cur.covTex.get(l.id)!;
    cov.toTexture(tex.image.data as Uint8Array);
    tex.needsUpdate = true;
    for (const [wid, door] of this.built.doors) door.visible = !(this.state.doorsOpen[`${loc}/${wid}`] ?? l.walls.find((w) => w.id === wid)?.open);
    this.applySlider();
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
    const T = this.T;
    const rs = revealSets(this.state, this.cur.scene.location);
    fogUniforms.uFog.value = fogCurve(T);
    fogUniforms.uMemory.value = 1 - hiddenCurve(T);
    fogUniforms.uCovEnabled.value = this.renderMode === 'floorMask' ? 0 : 1;
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
      if (lb.level !== this.levelId) continue;
      let o: number;
      if (lb.spec.vis === 'dm-note') o = labelCurve(T);
      else o = cov.state(lb.spec.pos.x, lb.spec.pos.z) !== Cov.Unexplored ? 1 : 1 - fogCurve(T);
      if (this.renderMode === 'floorMask') o = 0;
      if (this.labelMode === 'none' || (this.labelMode === 'keys' && lb.spec.vis === 'dm-note' && lb.spec.kind !== 'key')) o = 0;
      lb.obj.element.style.opacity = o.toFixed(3);
      lb.obj.visible = o > 0.001;
    }
    this.world.setWorkLight(this.renderMode === 'floorMask' ? 0 : T);
    b.grid.visible = this.gridMode !== 'off' && this.renderMode === 'normal';
    if (this.gridMode !== 'off') setGridType(b.grid, this.gridMode);
    const s = this.lowWalls ? 0.4 : 1;
    b.wallsGroup.scale.y = s;
    b.wallsGroup.position.y = this.level.elevationFt * (1 - s);
    this.world.invalidate();
  }

  setT(t: number): void { this.t = t; this.applySlider(); }
  setView(v: 'dm' | 'players'): void { this.view = v; this.tool = 'none'; this.applySlider(); this.onChange?.(); }

  // ------------------------------------------------------------------ reveals

  private commit(): void {
    this.state.updatedAt = Date.now();
    this.recompute();
    this.broadcast();
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => void idbSet(STORE_KEY, this.state), 150);
    this.onChange?.();
  }

  /** Awaitable save (tests, pagehide). */
  async flush(): Promise<void> { clearTimeout(this.saveTimer); await idbSet(STORE_KEY, this.state); }

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
  revealSecretDoor(id: string): void {
    const loc = this.cur!.scene.location;
    const sd = this.built.secretDoors.find((s) => s.objectId === id);
    if (!sd) return;
    const i = this.state.reveals.findIndex((r) => r.type === 'secret-door' && r.location === loc && r.id === id);
    if (i >= 0) this.state.reveals.splice(i, 1);
    else this.state.reveals.push({ type: 'secret-door', location: loc, id, wallId: sd.wallId });
    this.commit();
  }
  toggleDoor(wallId: string): void {
    const k = `${this.cur!.scene.location}/${wallId}`;
    const w = this.level.walls.find((x) => x.id === wallId);
    this.state.doorsOpen[k] = !(this.state.doorsOpen[k] ?? w?.open ?? false);
    this.commit();
  }
  undo(): void { if (this.state.reveals.pop()) this.commit(); }
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
    return this.raycaster.intersectObject(this.built.root, true).find((h) => h.object.visible && (h.object as THREE.Mesh).isMesh && h.object.userData.role !== 'grid' && h.object.userData.role !== 'marker' && isShown(h.object));
  }

  snap(p: Vec2): Vec2 {
    const g = this.cur!.grid.levels[this.levelId];
    if (this.gridMode === 'hex') { const s = hexSizeFromWidth(CELL_FT); return hexToWorld(worldToHex(p, s, g.hexOrientation, g.origin), s, g.hexOrientation, g.origin); }
    return squareCellCenter(squareCellAt(p, g.origin), g.origin);
  }
  distanceFt(a: Vec2, b: Vec2): number {
    const g = this.cur!.grid.levels[this.levelId];
    if (this.gridMode === 'hex') { const s = hexSizeFromWidth(CELL_FT); return hexDistanceFt(worldToHex(a, s, g.hexOrientation, g.origin), worldToHex(b, s, g.hexOrientation, g.origin)); }
    return squareDistanceFt(squareCellAt(a, g.origin), squareCellAt(b, g.origin), (localStorage.getItem('mistlab.diagonal') as 'five' | 'five-ten-five') ?? 'five');
  }

  private installPointer(): void {
    const el = this.world.renderer.domElement;
    let drag: { kind: 'token'; id: string; start: Vec2 } | { kind: 'brush'; pts: Vec2[] } | { kind: 'tap'; x: number; y: number } | null = null;
    el.addEventListener('pointerdown', (e) => {
      if (this.mode === 'player' || !this.cur || e.button > 0) return;
      if (this.view === 'players' && this.tool !== 'none') this.tool = 'none';
      const hit = this.pick(e);
      const tokId = hit && findUp(hit.object, 'tokenId');
      if (tokId) {
        const t = this.state.tokens.find((x) => x.id === tokId)!;
        drag = { kind: 'token', id: tokId, start: [...t.pos] as Vec2 };
      } else if (this.tool === 'brush-reveal' || this.tool === 'brush-fog') {
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
      if (!drag || drag.kind === 'tap') return;
      const p = this.floorPoint(e);
      if (!p) return;
      if (drag.kind === 'token') {
        const s = this.snap(p);
        this.cur!.tokens.get(drag.id)?.position.set(s[0], this.level.elevationFt, s[1]);
        this.setStatus(`${this.distanceFt(drag.start, s)} ft`);
        this.world.invalidate();
      } else {
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
      if (d.kind === 'token') {
        const p = this.floorPoint(e);
        const t = this.state.tokens.find((x) => x.id === d.id)!;
        if (p) t.pos = this.snap(p);
        this.setStatus('');
        if (t.id === this.party?.id) this.afterPartyMove();
        this.commit();
      } else if (d.kind === 'brush') {
        if (d.pts.length) this.state.reveals.push({ type: 'brush', location: this.cur!.scene.location, level: this.levelId, mode: this.tool === 'brush-fog' ? 'fog' : 'reveal', r: 3, pts: d.pts.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]) });
        this.commit();
      } else if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) {
        this.tap(e);
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  private lastTap = 0;
  private tap(e: PointerEvent): void {
    const now = performance.now();
    const dbl = now - this.lastTap < 320; this.lastTap = now;
    if (dbl) { const p = this.floorPoint(e); const room = p && this.roomAt(this.level, p); if (room) { this.jumpTo(room.key); return; } }
    if (this.view === 'players') return;
    const hit = this.pick(e);
    const sd = hit && (findUp(hit.object, 'secretDoor') ?? (hit.object.userData.role === 'door' ? this.built.secretDoors.find((s) => s.door === hit.object)?.objectId : undefined));
    const wallId = hit && hit.object.userData.role === 'door' ? (hit.object.userData.wallId as string | undefined) : undefined;
    if (this.tool === 'reveal') {
      if (sd) return this.revealSecretDoor(sd);
      const oid = hit && findUp(hit.object, 'objectId');
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

  setStatus(s: string): void { this.status = s; this.onStatus?.(s); }

  // ------------------------------------------------------------------ Player Display sync

  private broadcast(): void {
    if (this.mode !== 'dm' || !this.cur) return;
    this.channel.send({ kind: 'state', state: this.state, location: this.cur.path, level: this.levelId });
    this.channel.send({ kind: 'layout', grid: this.gridMode === 'hex' ? 'hex' : 'square', gridOn: this.gridMode !== 'off', lowWalls: this.lowWalls });
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
      this.state = m.state;
      if (!this.cur || this.cur.path !== m.location) await this.open(m.location, m.level);
      else if (this.levelId !== m.level) this.setLevel(m.level);
      else { this.syncTokens(); this.recompute(); }
    } else if (m.kind === 'camera' && m.locked) {
      this.world.camera.position.set(...m.pos);
      this.world.controls.target.set(...m.target);
      this.world.camera.lookAt(this.world.controls.target);
      this.world.invalidate();
    } else if (m.kind === 'layout') {
      this.gridMode = m.gridOn ? m.grid : 'off';
      this.lowWalls = m.lowWalls;
      this.applySlider();
    }
  }

  // ------------------------------------------------------------------ test/debug hooks

  setRenderMode(mode: 'normal' | 'floorMask'): void {
    if (mode === this.renderMode) return;
    if (mode === 'normal') this.renderMode = mode;
    const root = this.built.root;
    if (mode === 'floorMask') {
      this.renderMode = mode;
      this.applySlider();
      const white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
      const black = new THREE.MeshBasicMaterial({ color: '#000000' });
      root.traverse((o) => {
        if (o.userData.role === 'grid') return;
        const m = o as THREE.Mesh;
        const mat = m.material as THREE.Material | undefined;
        // Translucent ghosts and line overlays do not occlude the floor: hide them from the mask.
        if ((o as THREE.Line).isLine || (m.isMesh && mat && mat.transparent && mat.opacity < 0.999)) {
          if (o.visible) { this.maskHidden.push(o); o.visible = false; }
          return;
        }
        if (!m.isMesh) return;
        this.maskSwap.set(m, m.material);
        m.material = o.userData.role === 'floor' ? white : black;
      });
      this.world.scene.background = new THREE.Color('#000000');
    } else {
      for (const [m, mat] of this.maskSwap) m.material = mat;
      this.maskSwap.clear();
      for (const o of this.maskHidden) o.visible = true;
      this.maskHidden = [];
      this.world.scene.background = new THREE.Color(PALETTE.fog);
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
