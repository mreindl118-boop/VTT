// Streaming the valley's maps (the continuous world, step 3). As the camera nears a place its map is read, built in
// small slices between frames and drawn in place over its proxy; the camera's target picks the active map; as the
// camera pulls away a map folds back into its proxy and, a little later, is freed.
//
// The measure is how big a map's footprint is on screen (its diagonal in CSS pixels, seen from the camera), which
// suits a 60-ft house and a 9,500-ft town alike. A map with more objects (atlas `units`: Vallaki, Krezk) needs a
// proportionally bigger footprint before it is built (it costs more to build and to draw). A footprint seen edge-on
// from low down is foreshortened (it counts as smaller), and one lost in the mist is not in view at all.
//
//   prefetch the scene files  px ≥ 60 × units, in view
//   build and draw            px ≥ 140 × units, in view (one build at a time, never during a glide or while the
//                             user's hand moves the camera; the place under the camera's target first, then the
//                             nearest to it); a build whose place drops under the fold line on the way is dropped
//   fold into the proxy       px < 70 × units, or out of view (at once, with a crossfade)
//   free                      folded for 4 s, unless pinned (the active map), or at once when the unit cap needs the
//                             room (least recently wanted first)
//   cap                       4 units resident (2 on a small device: navigator.deviceMemory < 4, or a phone); the
//                             active map, while it is folded away, does not count (it is kept whatever the cap, so a
//                             phone can still stream Vallaki in from the valley)
//   activate                  the drawn map whose footprint (10 ft pad) holds the camera's target, the smallest such;
//                             the active map keeps the role until the target leaves it by a quarter of its
//                             half-diagonal (it is never left with none: the last one stays active at valley zoom)
//
// Nesting (step 4): a town's buildings, area maps and dungeons (atlas depth 1, 2) stream in under their parent once
// it is resident, by stricter rules (DEPTHS: bigger on screen, and near the camera's target), and the depth decides
// who is active: a child drawn under the target takes over from its parent once it fills a good part of the screen
// (enterPx), and gives the role back as the camera pulls away (under leavePx, or the target leaves it), so zooming
// in goes town → building and zooming out climbs back building → town → valley.
//
// planStream is the pure rule (tests/streamer.test.ts); Streamer measures the camera and keeps the clock.
import * as THREE from 'three';
import type { AtlasScene } from '../../../scripts/world-atlas';
import type { World } from './world';

/** The thresholds by nesting depth: a pin's root map (0), a building or area map in it (1), a building of that (2).
 *  A child is built only near the camera's target (nearFt) and folds once the target is farther than farFt. */
export const DEPTHS: { prefetchPx: number; showPx: number; hidePx: number; nearFt?: number; farFt?: number }[] = [
  { prefetchPx: 60, showPx: 140, hidePx: 70 },
  { prefetchPx: 120, showPx: 220, hidePx: 110, nearFt: 600, farFt: 1000 },
  { prefetchPx: 160, showPx: 260, hidePx: 130, nearFt: 250, farFt: 400 },
];
export const STREAM = {
  prefetchPx: DEPTHS[0].prefetchPx, showPx: DEPTHS[0].showPx, hidePx: DEPTHS[0].hidePx,
  /** A child takes the active role from its parent once its footprint is this big on screen: the larger of
   *  `enterK` × its build line and `enterScreen` × the screen's smaller side; it gives the role back under
   *  `leaveK` of that. */
  enterK: 1.6, enterScreen: 0.45, leaveK: 0.6,
  /** A folded map is freed this long after it stopped being wanted (ms). */
  lingerMs: 4000,
  units: 4, unitsSmall: 2,
  /** In view: the footprint's middle or a corner within this many half-screens of the middle. */
  viewPad: 1.5,
  /** Activation: the target inside a footprint padded this much (ft); the active map holds until the target is a
   *  quarter of its half-diagonal outside. */
  insidePadFt: 10, leaveMargin: 0.25,
  /** The crossfade between a proxy and its map (ms). */
  fadeMs: 250,
  /** Build slices: at most this long each (ms), one per frame. */
  sliceMs: 8,
  /** The rule is re-read this often while the camera moves (ms). */
  tickMs: 100,
  /** Foreshortening: a footprint seen at an elevation angle e counts sqrt(sin e) × this of its size, at most whole,
   *  at least `flatMin` of it (a town on the horizon is a sliver). */
  foreshorten: 1.15, flatMin: 0.3,
  /** Out of view in the mist: less than this much of the footprint's nearest point shows through the fog. */
  mistSeen: 0.2,
};

/** What the streamer knows about one place this tick. */
export interface SiteView {
  path: string;
  units: number;
  /** Footprint diagonal on screen (CSS px). */
  px: number;
  inView: boolean;
  /** The camera's target is inside the footprint (padded), and its area (smaller wins). */
  inside: boolean;
  area: number;
  /** Plan distance (ft) from the camera's target to the footprint (0 inside): the nearest place is built first. */
  dTarget: number;
  resident: boolean;
  drawn: boolean;
  loading: boolean;
  pinned: boolean;
  /** When it was last wanted (ms), and since when it has been unwanted while resident. */
  lastWanted: number;
  lowSince?: number;
  /** Nesting depth (0: a pin's root map) and the maps it hangs in, nearest first. */
  depth?: number;
  chain?: string[];
}

export interface StreamPlan {
  prefetch: string[];
  load: string[];
  show: string[];
  fold: string[];
  unload: string[];
  /** Builds in flight to drop: their place fell under the fold line (or out of view) before they were done. */
  cancel: string[];
  activate?: string;
}

type Measured = Pick<SiteView, 'px' | 'inView' | 'units'> & Partial<Pick<SiteView, 'depth' | 'dTarget'>>;
const rule = (s: { depth?: number }) => DEPTHS[Math.min(DEPTHS.length - 1, s.depth ?? 0)];
export const wanted = (s: Measured): boolean => { const r = rule(s); return s.inView && s.px >= r.showPx * s.units && (r.nearFt === undefined || (s.dTarget ?? 0) < r.nearFt); };
export const low = (s: Measured): boolean => { const r = rule(s); return !s.inView || s.px < r.hidePx * s.units || (r.farFt !== undefined && (s.dTarget ?? 0) > r.farFt); };
const prefetchable = (s: Measured): boolean => { const r = rule(s); return s.inView && s.px >= r.prefetchPx * s.units && (r.farFt === undefined || (s.dTarget ?? 0) <= r.farFt); };
/** How big a child must be on screen to take the active role (CSS px), and under which it gives it back. */
export const enterPx = (s: { depth?: number; units: number }, screen = 768): number => Math.max(rule(s).showPx * s.units * STREAM.enterK, STREAM.enterScreen * screen);
export const leavePx = (s: { depth?: number; units: number }, screen = 768): number => STREAM.leaveK * enterPx(s, screen);

/** The rule: given every place's view, what to prefetch, build, show, fold, free and which map to make active. */
/** Does a place count against the unit cap: resident or being built, and not the active map folded away. */
const counts = (s: SiteView): boolean => (s.resident || s.loading) && !(s.pinned && low(s));
/** The units a plan leaves resident, as the cap counts them. */
export function unitsAfter(sites: SiteView[], plan: StreamPlan): number {
  return sites.reduce((a, s) => a + ((counts(s) && !plan.unload.includes(s.path)) || plan.load.includes(s.path) ? s.units : 0), 0);
}

/** Which wanted place is built first: the one holding the camera's target, then the nearest to it, then the biggest. */
const first = (a: SiteView, b: SiteView): number => Number(b.inside) - Number(a.inside) || a.dTarget - b.dTarget || b.px - a.px;

export function planStream(sites: SiteView[], o: { now: number; cap: number; active?: string; activeHolds: boolean; flying: boolean; activate: boolean; busy?: boolean; screen?: number }): StreamPlan {
  const plan: StreamPlan = { prefetch: [], load: [], show: [], fold: [], unload: [], cancel: [] };
  const used = () => sites.reduce((a, s) => a + (counts(s) ? s.units : 0), 0) - plan.unload.reduce((a, p) => { const s = sites.find((x) => x.path === p); return a + (s && counts(s) ? s.units : 0); }, 0);
  for (const s of sites) {
    if (s.loading && low(s)) plan.cancel.push(s.path);
    if (prefetchable(s) && !s.resident) plan.prefetch.push(s.path);
    if (!s.resident) continue;
    if (s.drawn && low(s)) plan.fold.push(s.path);
    if (!s.drawn && wanted(s)) plan.show.push(s.path);
    if (!s.pinned && low(s) && s.lowSince !== undefined && o.now - s.lowSince >= STREAM.lingerMs) plan.unload.push(s.path);
  }
  // one build at a time, and none while the camera glides (it would hitch the glide) or the user's hand moves it (the
  // place the camera comes to rest over is the one wanted)
  if (!o.flying && !o.busy && !sites.some((s) => s.loading && !plan.cancel.includes(s.path))) {
    for (const s of sites.filter((x) => !x.resident && !x.loading && wanted(x)).sort(first)) {
      // make room: free the least recently wanted maps that are not wanted now and not pinned
      // A phone must fit the child under its camera together with its required ancestors.
      // This allowance is exactly that chain's cost, not spare capacity for neighbouring maps.
      const chain = s.inside ? sites.filter((x) => counts(x) && (s.chain ?? []).includes(x.path)) : [];
      const cap = Math.max(o.cap, s.units + chain.reduce((n, x) => n + x.units, 0));
      const spare = sites.filter((x) => x.resident && !x.pinned && !wanted(x) && !chain.includes(x) && !plan.unload.includes(x.path)).sort((a, b) => a.lastWanted - b.lastWanted);
      const free: string[] = [];
      let need = used() + s.units - cap;
      for (const x of spare) { if (need <= 0) break; free.push(x.path); need -= x.units; }
      if (need > 0) continue; // no room: it stays a proxy
      plan.unload.push(...free); plan.load.push(s.path);
      break;
    }
  }
  if (o.activate && !o.flying) {
    // a drawn map under the target may take the role; a child only once it is big on screen
    const live = (s: SiteView) => s.resident && s.drawn && !plan.fold.includes(s.path) && !plan.unload.includes(s.path);
    const claims = (s: SiteView) => live(s) && s.inside && (!s.depth || s.px >= enterPx(s, o.screen));
    const act = o.active ? sites.find((s) => s.path === o.active) : undefined;
    // the active map keeps the role while the target stays on it (a child: while it is still big enough on screen)
    const keeps = !!o.active && o.activeHolds && (!act || !act.depth || act.px >= leavePx(act, o.screen));
    const smallest = (xs: SiteView[]) => xs.sort((a, b) => a.area - b.area)[0];
    let c: SiteView | undefined;
    // kept: only a map inside it (a building of the town) can take over, zooming in
    if (keeps) c = smallest(sites.filter((s) => claims(s) && !!act && (s.chain ?? []).includes(act.path)));
    else {
      c = smallest(sites.filter(claims));
      // a child gives the role back to the map it hangs in, zooming out (drawn; or as it is, folded away like the
      // child itself, out over the valley)
      if (!c && act?.depth) c = (act.chain ?? []).map((p) => sites.find((s) => s.path === p)).find((s) => !!s && s.resident && (live(s) || !live(act)));
    }
    if (c && c.path !== o.active) plan.activate = c.path;
  }
  return plan;
}

/** A small device keeps fewer maps (Safari tells nothing of its memory: a phone-sized screen counts as small). */
export function unitCap(): number {
  const m = (globalThis.navigator as { deviceMemory?: number } | undefined)?.deviceMemory;
  const phone = typeof matchMedia === 'function' && matchMedia('(max-width: 600px), (max-height: 500px)').matches;
  return (m !== undefined && m < 4) || phone ? STREAM.unitsSmall : STREAM.units;
}

/** What the streamer asks of the app. */
export interface StreamHost {
  readonly world: World;
  /** Streaming runs (a pin map is open in the valley, the normal render). */
  streaming(): boolean;
  /** The places that can stream: the open campaign's pin roots, and the children of the resident maps (their
   *  `worldBounds` and `placement` in W, composed through their parents). */
  sites(): AtlasScene[];
  /** The maps a map hangs in, nearest first (none for a root). */
  chainOf?(path: string): string[];
  residentState(path: string): { drawn: boolean } | undefined;
  loading(path: string): boolean;
  pinned(): Set<string>;
  activePath(): string | undefined;
  /** The camera activates maps (the DM's screen; the Player Display follows the DM's choice). */
  autoActivate(): boolean;
  /** The user's hand is on the camera (a wheel turn, a drag or pinch in motion): no build starts. */
  busy(): boolean;
  cancel(path: string): void;
  /** Every place as measured this tick (its detailed proxy follows its size on screen). */
  measured?(sites: SiteView[]): void;
  prefetch(path: string): void;
  streamIn(path: string): void;
  fold(path: string, on: boolean): void;
  unload(path: string): void;
  activateStreamed(path: string): void;
}

/** The clock and the measuring: ticks on camera moves (at most every 100 ms) and while anything is pending. */
export class Streamer {
  private last = new Map<string, { lastWanted: number; lowSince?: number }>();
  private timer = 0;
  private lastTick = 0;
  /** Units resident at most so far (tests read it), and what each tick decided (the HUD). */
  maxUnits = 0;
  lastPlan: StreamPlan = { prefetch: [], load: [], show: [], fold: [], unload: [], cancel: [] };
  cap = unitCap();
  enabled = true;

  constructor(private host: StreamHost) {}

  /** The camera moved: tick soon (throttled). */
  poke(): void {
    if (this.timer) return;
    const wait = Math.max(0, STREAM.tickMs - (performance.now() - this.lastTick));
    this.timer = window.setTimeout(() => { this.timer = 0; this.tick(); }, wait);
  }
  stop(): void { clearTimeout(this.timer); this.timer = 0; this.last.clear(); }

  /** Each place as seen from the camera now. */
  views(now = performance.now()): SiteView[] {
    const h = this.host, w = h.world, cam = w.camera, a = w.anchor;
    const host = w.renderer.domElement.getBoundingClientRect(), H = host.height || 1;
    const focal = H / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const eye = w.toAbsolute(cam.position), tgt = w.toAbsolute(w.controls.target), dist = cam.position.distanceTo(w.controls.target);
    const fog = w.scene.fog as THREE.FogExp2 | null, density = fog?.isFogExp2 ? fog.density : 0;
    const pinned = h.pinned(), active = h.activePath();
    const v = new THREE.Vector3();
    const ndcIn = (x: number, y: number, z: number) => { v.set(x - a.x, y - a.y, z - a.z).project(cam); return v.z < 1 && Math.abs(v.x) <= STREAM.viewPad && Math.abs(v.y) <= STREAM.viewPad; };
    return h.sites().map((e) => {
      const b = e.worldBounds!, y = e.placement.position[1] + e.elevationFt;
      const diag = Math.hypot(b.maxX - b.minX, b.maxZ - b.minZ);
      // seen from the eye: the nearest point of the footprint (a town the camera stands over is big on screen)
      const nx = THREE.MathUtils.clamp(eye.x, b.minX, b.maxX), nz = THREE.MathUtils.clamp(eye.z, b.minZ, b.maxZ);
      const near = Math.max(1, Math.hypot(eye.x - nx, eye.y - y, eye.z - nz));
      // edge-on from low down it is a sliver (the elevation angle of the eye over its middle)
      const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, toMid = Math.max(1, Math.hypot(eye.x - cx, eye.y - y, eye.z - cz));
      const flat = THREE.MathUtils.clamp(Math.sqrt(Math.max(0, eye.y - y) / toMid) * STREAM.foreshorten, STREAM.flatMin, 1);
      const px = ((diag * focal) / near) * flat;
      const tx = THREE.MathUtils.clamp(tgt.x, b.minX, b.maxX), tz = THREE.MathUtils.clamp(tgt.z, b.minZ, b.maxZ), dT = Math.hypot(tgt.x - tx, tgt.z - tz);
      // the mist between the eye and its nearest point (FogExp2: what shows through is exp(-(density × d)²))
      const misted = density > 0 && Math.exp(-((density * near) ** 2)) < STREAM.mistSeen;
      // a place the eye stands over (in plan, and within its own size of its ground) is in view: its ground fills the
      // foot of the screen though neither its middle nor a corner may be on it (the Gates of Ravenloft seen from their own
      // sill, looking across the chasm at the castle); one the eye flies high over keeps the rule above
      const over = Math.abs(eye.y - y) < diag && eye.x >= b.minX && eye.x <= b.maxX && eye.z >= b.minZ && eye.z <= b.maxZ;
      const inView = !misted && (over || dT < 0.5 * dist || ndcIn(cx, y, cz) || ndcIn(b.minX, y, b.minZ) || ndcIn(b.maxX, y, b.minZ) || ndcIn(b.minX, y, b.maxZ) || ndcIn(b.maxX, y, b.maxZ));
      const r = h.residentState(e.path), st = this.last.get(e.path) ?? { lastWanted: 0 };
      const s: SiteView = {
        path: e.path, units: Math.max(1, e.units), px, inView, inside: dT <= STREAM.insidePadFt, area: (b.maxX - b.minX) * (b.maxZ - b.minZ), dTarget: dT,
        resident: !!r, drawn: !!r?.drawn, loading: h.loading(e.path), pinned: pinned.has(e.path) || e.path === active, lastWanted: st.lastWanted, lowSince: st.lowSince,
        depth: e.depth, chain: h.chainOf?.(e.path),
      };
      if (wanted(s)) st.lastWanted = now;
      if (s.resident && low(s)) st.lowSince ??= now; else st.lowSince = undefined;
      s.lastWanted = st.lastWanted; s.lowSince = st.lowSince;
      this.last.set(e.path, st);
      return s;
    });
  }
  /** Does the active map still hold the target (a quarter of its half-diagonal of slack)? */
  private holds(path: string | undefined): boolean {
    if (!path) return false;
    const e = this.host.sites().find((x) => x.path === path); if (!e?.worldBounds) return true; // not a streamed map: it holds
    const b = e.worldBounds, w = this.host.world, t = w.toAbsolute(w.controls.target);
    const m = STREAM.leaveMargin * Math.hypot(b.maxX - b.minX, b.maxZ - b.minZ) / 2;
    return t.x >= b.minX - m && t.x <= b.maxX + m && t.z >= b.minZ - m && t.z <= b.maxZ + m;
  }

  tick(): StreamPlan | undefined {
    const h = this.host;
    this.lastTick = performance.now();
    if (!this.enabled || !h.streaming()) return undefined;
    // a glide carries the camera through places it does not stop at: nothing folds, unfolds, builds or activates on
    // the way (the map flown to stands ready); the rule is read again when it lands
    if (h.world.flying) { if (!this.timer) this.timer = window.setTimeout(() => { this.timer = 0; this.tick(); }, STREAM.tickMs); return undefined; }
    const now = performance.now(), sites = this.views(now), active = h.activePath();
    h.measured?.(sites);
    const busy = h.busy();
    const rc = h.world.renderer.domElement.getBoundingClientRect();
    const plan = planStream(sites, { now, cap: this.cap, active, activeHolds: this.holds(active), flying: h.world.flying, activate: h.autoActivate(), busy, screen: Math.min(rc.width, rc.height) || 768 });
    this.lastPlan = plan;
    for (const p of plan.cancel) h.cancel(p);
    for (const p of plan.unload) { h.unload(p); this.last.delete(p); }
    for (const p of plan.fold) h.fold(p, true);
    for (const p of plan.show) h.fold(p, false);
    for (const p of plan.prefetch) h.prefetch(p);
    for (const p of plan.load) h.streamIn(p);
    if (plan.activate) h.activateStreamed(plan.activate);
    this.lastUnits = unitsAfter(sites, plan);
    this.maxUnits = Math.max(this.maxUnits, this.lastUnits);
    // come back while something waits: a fold's countdown, a build, a glide
    // (a map just drawn again may hold the target: it is made active once its crossfade is done)
    const pending = sites.some((s) => s.loading || (s.resident && !s.pinned && s.lowSince !== undefined)) || h.world.flying || busy
      || plan.load.length > 0 || plan.show.length > 0 || plan.fold.length > 0 || !!plan.activate;
    if (pending && !this.timer) this.timer = window.setTimeout(() => { this.timer = 0; this.tick(); }, STREAM.fadeMs + 150);
    return plan;
  }
  private lastUnits = 0;
  /** Units resident (or being built) after the last tick, as the cap counts them (the active map folded away does not). */
  units(): number { return this.lastUnits; }
}
