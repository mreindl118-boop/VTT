// The streaming rule (app/src/render/streamer.ts planStream): which maps of the valley are built, drawn, folded into
// their proxies, freed, and which one the camera makes active.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DEPTHS, enterPx, leavePx, planStream, STREAM, Streamer, unitsAfter, type SiteView, type StreamHost } from '../app/src/render/streamer';
import type { AtlasScene } from '../scripts/world-atlas';

const site = (path: string, o: Partial<SiteView> = {}): SiteView => ({
  path, units: 1, px: 0, inView: true, inside: false, area: 1e6, dTarget: 5000, resident: false, drawn: false, loading: false, pinned: false, lastWanted: 0, ...o,
});
const opts = (o: Partial<Parameters<typeof planStream>[1]> = {}) => ({ now: 10_000, cap: 4, activeHolds: false, flying: false, activate: true, ...o });

describe('planStream', () => {
  it('prefetches at 60 px, builds at 140 px (scaled by units), only in view', () => {
    const p = planStream([site('a', { px: 61 }), site('b', { px: 150 }), site('c', { px: 150, inView: false }), site('big', { px: 200, units: 2 })], opts());
    expect(p.prefetch).toEqual(['a', 'b', 'big']);
    expect(p.load).toEqual(['b']); // Vallaki (2 units) waits for 280 px
    expect(planStream([site('big', { px: 2 * STREAM.showPx })], opts()).load).toEqual(['big']);
  });
  it('builds one map at a time, the place under the camera first, then the nearest, and none during a glide or a zoom', () => {
    expect(planStream([site('a', { px: 150 }), site('b', { px: 400 })], opts()).load).toEqual(['b']); // as near: the bigger
    // a town far off but big on screen waits for the place the camera is over, and for the one nearer the target
    expect(planStream([site('town', { px: 419, dTarget: 30000 }), site('pool', { px: 219, inside: true, dTarget: 0 })], opts()).load).toEqual(['pool']);
    expect(planStream([site('town', { px: 419, dTarget: 30000 }), site('pool', { px: 219, dTarget: 800 })], opts()).load).toEqual(['pool']);
    expect(planStream([site('a', { px: 150 })], opts({ busy: true })).load).toEqual([]); // the wheel still turning
    expect(planStream([site('a', { px: 150 }), site('b', { px: 400, loading: true })], opts()).load).toEqual([]);
    expect(planStream([site('a', { px: 150 })], opts({ flying: true })).load).toEqual([]);
  });
  it('folds under 70 px or out of view, draws again at 140 px: hysteresis in between', () => {
    const p = planStream([
      site('small', { resident: true, drawn: true, px: 60 }),
      site('gone', { resident: true, drawn: true, px: 900, inView: false }),
      site('between', { resident: true, drawn: true, px: 100 }),
      site('back', { resident: true, drawn: false, px: 141 }),
      site('notyet', { resident: true, drawn: false, px: 100 }),
    ], opts());
    expect(p.fold).toEqual(['small', 'gone']);
    expect(p.show).toEqual(['back']);
  });
  it('drops a build whose place fell under the fold line or out of view before it was done', () => {
    const p = planStream([site('passed', { loading: true, px: 50 }), site('turned', { loading: true, px: 300, inView: false }), site('kept', { loading: true, px: 100 }), site('next', { px: 300 })], opts());
    expect(p.cancel).toEqual(['passed', 'turned']);
    expect(p.load).toEqual([]); // 'kept' is still being built: one at a time
    // with the only build dropped, the next one starts at once
    expect(planStream([site('passed', { loading: true, px: 50 }), site('next', { px: 300 })], opts()).load).toEqual(['next']);
  });
  it('frees a folded map after 4 s, never a pinned one', () => {
    const now = 10_000;
    const p = planStream([
      site('old', { resident: true, px: 10, lowSince: now - STREAM.lingerMs }),
      site('fresh', { resident: true, px: 10, lowSince: now - 1000 }),
      site('party', { resident: true, px: 10, lowSince: now - 60_000, pinned: true }),
    ], opts({ now }));
    expect(p.unload).toEqual(['old']);
  });
  it('keeps to the unit cap: the least recently wanted map makes room, a pinned one never does', () => {
    const sites = [
      site('vallaki', { resident: true, drawn: true, units: 2, px: 10, lastWanted: 5 }),
      site('camp', { resident: true, drawn: true, px: 20, lastWanted: 9 }),
      site('active', { resident: true, drawn: true, px: 900, pinned: true, lastWanted: 1 }),
      site('next', { px: 300 }),
    ];
    const p = planStream(sites, opts());
    expect(p.load).toEqual(['next']);
    expect(p.unload).toEqual(['vallaki']); // 2 + 1 + 1 + 1 > 4: Vallaki (wanted longest ago) goes, at once
    expect(unitsAfter(sites, p)).toBe(3);
    // with nothing to spare, the new map stays a proxy
    const full = planStream([site('a', { resident: true, pinned: true, units: 2, px: 900 }), site('b', { resident: true, pinned: true, units: 2, px: 900 }), site('c', { px: 300 })], opts());
    expect(full.load).toEqual([]);
    expect(full.unload).toEqual([]);
    // a small device keeps two units
    expect(planStream([site('a', { resident: true, pinned: true, px: 900 }), site('b', { px: 300, units: 2 })], opts({ cap: 2 })).load).toEqual([]);
    // the active map folded away (the camera left it) does not count: a phone can still stream Vallaki in
    expect(planStream([site('a', { resident: true, pinned: true, px: 20 }), site('b', { px: 300, units: 2 })], opts({ cap: 2 })).load).toEqual(['b']);
  });
  it('activates the smallest drawn map holding the target, unless the active one still holds it', () => {
    const sites = [site('town', { resident: true, drawn: true, inside: true, area: 9e6, px: 900 }), site('camp', { resident: true, drawn: true, inside: true, area: 1e5, px: 900 }), site('far', { resident: true, drawn: true, px: 900 })];
    expect(planStream(sites, opts({ active: 'far' })).activate).toBe('camp');
    expect(planStream(sites, opts({ active: 'far', activeHolds: true })).activate).toBeUndefined();
    expect(planStream(sites, opts({ active: 'camp' })).activate).toBeUndefined(); // already active
    expect(planStream(sites, opts({ active: 'far', flying: true })).activate).toBeUndefined(); // never mid-glide
    expect(planStream(sites, opts({ active: 'far', activate: false })).activate).toBeUndefined(); // the Player Display follows the DM
    // a folded map (not drawn) is never made active
    expect(planStream([site('x', { resident: true, drawn: false, inside: true })], opts({ active: 'far' })).activate).toBeUndefined();
  });
});

describe('planStream: nesting (the buildings and area maps of a town)', () => {
  // Vallaki is resident and active; the Blue Water Inn (depth 1) hangs in it
  const town = (o: Partial<SiteView> = {}) => site('ch05/N', { resident: true, drawn: true, units: 2, px: 5000, inside: true, area: 9e6, dTarget: 0, pinned: true, ...o });
  const inn = (o: Partial<SiteView> = {}) => site('ch05/N2', { depth: 1, chain: ['ch05/N'], area: 3e4, dTarget: 0, ...o });
  it('admits the child under a phone camera with its necessary parent, without adding unrelated maps to that allowance', () => {
    const child = inn({ px: 900, inside: true });
    const p = planStream([town(), child], opts({ cap: 2, active: 'ch05/N', activeHolds: true }));
    expect(p.load).toEqual(['ch05/N2']);
    expect(p.unload).toEqual([]);
    expect(unitsAfter([town(), child], p)).toBe(3);
    expect(planStream([town(), inn({ px: 900, inside: false, dTarget: 100 })], opts({ cap: 2 })).load).toEqual([]);
    expect(planStream([town(), child, site('other', { resident: true, pinned: true, px: 900 })], opts({ cap: 2 })).load).toEqual([]);
    const old = site('old', { resident: true, px: 100, lastWanted: 1 });
    const replaced = planStream([town(), child, old], opts({ cap: 2 }));
    expect(replaced.unload).toEqual(['old']);
    expect(replaced.load).toEqual(['ch05/N2']);
  });
  it('builds a child only big on screen and near the target, and folds it far from the target', () => {
    expect(planStream([town(), inn({ px: DEPTHS[1].showPx + 1, dTarget: 100 })], opts()).load).toEqual(['ch05/N2']);
    expect(planStream([town(), inn({ px: DEPTHS[0].showPx + 1, dTarget: 100 })], opts()).load).toEqual([]); // a root's line is not enough
    expect(planStream([town(), inn({ px: 900, dTarget: 700 })], opts()).load).toEqual([]); // 700 ft from the target
    expect(planStream([town(), inn({ px: DEPTHS[1].prefetchPx + 1, dTarget: 900 })], opts()).prefetch).toEqual(['ch05/N2']);
    expect(planStream([town(), inn({ resident: true, drawn: true, px: 900, dTarget: 1100 })], opts()).fold).toEqual(['ch05/N2']);
    expect(planStream([town(), inn({ resident: true, drawn: true, px: DEPTHS[1].hidePx - 1, dTarget: 0 })], opts()).fold).toEqual(['ch05/N2']);
  });
  it('a child under the target takes the role once it fills a good part of the screen, and gives it back zooming out', () => {
    const big = enterPx({ depth: 1, units: 1 }, 768), small = leavePx({ depth: 1, units: 1 }, 768);
    expect(small).toBeLessThan(big);
    expect(small).toBeGreaterThan(DEPTHS[1].hidePx); // it gives the role back while it is still drawn
    // zooming in: the town holds the target, yet its building takes over
    expect(planStream([town(), inn({ resident: true, drawn: true, inside: true, px: big + 1 })], opts({ active: 'ch05/N', activeHolds: true, screen: 768 })).activate).toBe('ch05/N2');
    // between the two lines nothing changes, whichever is active (Back leaves the building there, the town active)
    const mid = (big + small) / 2;
    expect(planStream([town(), inn({ resident: true, drawn: true, inside: true, px: mid })], opts({ active: 'ch05/N', activeHolds: true, screen: 768 })).activate).toBeUndefined();
    expect(planStream([town(), inn({ resident: true, drawn: true, inside: true, px: mid })], opts({ active: 'ch05/N2', activeHolds: true, screen: 768 })).activate).toBeUndefined();
    // zooming out: under the lower line the town takes the role back
    expect(planStream([town(), inn({ resident: true, drawn: true, inside: true, px: small - 1 })], opts({ active: 'ch05/N2', activeHolds: true, screen: 768 })).activate).toBe('ch05/N');
    // panned off the building onto the street: the town
    expect(planStream([town(), inn({ resident: true, drawn: true, inside: false, px: big + 1 })], opts({ active: 'ch05/N2', activeHolds: false, screen: 768 })).activate).toBe('ch05/N');
    // out over the valley, both folded: the role climbs to the town as it is (the building is freed later)
    expect(planStream([town({ drawn: false, px: 20 }), inn({ resident: true, drawn: false, px: 1 })], opts({ active: 'ch05/N2', activeHolds: false })).activate).toBe('ch05/N');
    // a building of another town never takes over from a town that holds the target
    expect(planStream([town(), site('ch03/E', { resident: true, drawn: true, inside: false, area: 5e6, px: 900 }), site('appB/death-house', { depth: 1, chain: ['ch03/E'], resident: true, drawn: true, inside: true, area: 2e3, px: 2000 })], opts({ active: 'ch05/N', activeHolds: true })).activate).toBeUndefined();
  });
  it('the active building keeps its town (the chain is pinned by the app); the town counts its units', () => {
    const p = planStream([town({ pinned: true }), inn({ resident: true, drawn: true, pinned: true, px: 900, dTarget: 0 }), site('far', { px: 300, units: 2 })], opts({ cap: 4 }));
    expect(p.load).toEqual([]); // 2 + 1 + 2 > 4, and nothing may be freed
    expect(p.unload).toEqual([]);
  });
});


describe('Streamer.views: what is in view', () => {
  /** One place (a 400 x 350 ft map at ground 0, the Gates of Ravenloft's size) seen from `eye` looking at `target`. */
  const view = (eye: [number, number, number], target: [number, number, number]): SiteView => {
    const camera = new THREE.PerspectiveCamera(50, 1366 / 768, 1, 1e6);
    camera.position.set(...eye); camera.lookAt(...target); camera.updateMatrixWorld();
    const world = {
      camera, anchor: new THREE.Vector3(), scene: { fog: null }, controls: { target: new THREE.Vector3(...target) },
      renderer: { domElement: { getBoundingClientRect: () => ({ height: 768 }) } },
      toAbsolute: (v: THREE.Vector3, out = new THREE.Vector3()) => out.copy(v),
    };
    const gates = { path: 'ch02/J', units: 1, elevationFt: 0, worldBounds: { minX: 0, maxX: 400, minZ: 0, maxZ: 350 }, placement: { position: [0, 0, 0], rotationY: 0 } } as unknown as AtlasScene;
    const host = { world, sites: () => [gates], residentState: () => ({ drawn: true }), loading: () => false, pinned: () => new Set<string>(), activePath: () => 'ch02/J' } as unknown as StreamHost;
    return new Streamer(host).views(0)[0];
  };
  it('a place the eye stands over is in view, though neither its middle nor a corner is on screen', () => {
    // on the Gates' sill at their east edge, looking east across the chasm at the castle: the Gates' ground fills the
    // foot of the screen, and the active map must not fold into its proxy (owner 2026-10-22)
    expect(view([380, 6, 175], [520, 40, 175]).inView).toBe(true);
  });
  it('a place behind the eye, beside it, is not', () => {
    expect(view([420, 6, 175], [560, 40, 175]).inView).toBe(false);
  });
  it('nor one the eye flies high over, looking far away: standing over it means within its own size of its ground', () => {
    // 2,000 ft over the Gates (their footprint is 530 ft across), looking out over the valley to the east
    expect(view([200, 2000, 175], [20000, 0, 175]).inView).toBe(false);
  });
});
