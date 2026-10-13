// The streaming rule (app/src/render/streamer.ts planStream): which maps of the valley are built, drawn, folded into
// their proxies, freed, and which one the camera makes active.
import { describe, expect, it } from 'vitest';
import { planStream, STREAM, unitsAfter, type SiteView } from '../app/src/render/streamer';

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
