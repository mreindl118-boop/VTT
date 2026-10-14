import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CoverageMap } from '../app/src/core/coverage';
import { pointInPolygon, polygonArea, type Polygon, type Vec2 } from '../app/src/core/geometry';
import type { GridFile, SceneFile } from '../app/src/core/schema';
import { newCampaign, type CampaignState, type Token } from '../app/src/state/campaign';
import { CASTLE_MAP_REVISION, migrateMapState } from '../app/src/state/mapMigrations';

const scene: SceneFile = JSON.parse(readFileSync('locations/ch04/K/scene.json', 'utf8'));
const grid: GridFile = JSON.parse(readFileSync('locations/ch04/K/grid.json', 'utf8'));
const token = (id: string, pos: Vec2, role: Token['role'] = 'party', level = 'spires'): Token => ({
  id, name: id, location: 'K', level, pos, role, size: 'medium', color: '#abc', darkvisionFt: 60,
  hp: { cur: 7, max: 11 }, hidden: true, sheetId: 'pc-1', creatureId: 'bat', playerName: 'shadow',
});
const legacy = (): CampaignState => ({ ...newCampaign('cos'), updatedAt: 42, tokens: [token('party', [190, 260])] });
const room = (level: string, key: string) => scene.levels.find(l => l.id === level)!.rooms.find(r => r.key === key)!;
const coverage = (level: string) => CoverageMap.forPolygons([
  ...scene.levels.find(l => l.id === level)!.rooms.map(r => r.polygon), ...grid.levels[level].floorPolygons,
]);
const oldSpireCoverage = () => new CoverageMap(78, 103, 174, 164);
const oldTowerCoverage = () => new CoverageMap(160, 125, 72, 132);
const seenAt = (state: CampaignState, level: string, pos: Vec2) => {
  const cov = coverage(level); cov.load({ seen: state.seen[`K/${level}`] ?? '', paint: '' });
  return cov.seen[cov.idx(...pos)];
};
// Independent legacy room masks from the retained 37ae2ff layout. The smaller
// stair room owns the old K48-t/K54 overlap, just as the semantic room keys do.
const oldRooms: { level: string; key: string; polygon: Polygon }[] = [
  { level: 'spires', key: 'K48', polygon: [[199.394,217.5],[205.606,217.5],[210,221.894],[210,228.106],[205.606,232.5],[199.394,232.5],[195,228.106],[195,221.894]] },
  { level: 'spires', key: 'K49', polygon: [[165,215],[190,215],[190,255],[175,255],[165,245]] },
  { level: 'spires', key: 'K50', polygon: [[190,235],[215,235],[215,255],[190,255]] },
  { level: 'spires', key: 'K51', polygon: [[180,255],[200,255],[200,265],[180,265]] },
  { level: 'south-tower', key: 'K55', polygon: [[165,215],[195,215],[195,255],[175,255],[165,245]] },
  { level: 'south-tower', key: 'K54', polygon: [[195,215],[215,215],[215,235],[195,235]] },
  { level: 'south-tower', key: 'K56', polygon: [[195,235],[215,235],[215,255],[195,255]] },
  { level: 'south-tower', key: 'K48-t', polygon: [[200.947,221.25],[204.053,221.25],[206.25,223.447],[206.25,226.553],[204.053,228.75],[200.947,228.75],[198.75,226.553],[198.75,223.447]] },
];
const oldOwner = (level: string, p: Vec2) => oldRooms.filter(r => r.level === level && pointInPolygon(p, r.polygon))
  .sort((a, b) => Math.abs(polygonArea(a.polygon)) - Math.abs(polygonArea(b.polygon)))[0]?.key;
const newOwner = (level: string, p: Vec2) => scene.levels.find(l => l.id === level)!.rooms
  .filter(r => pointInPolygon(p, r.polygon)).sort((a, b) => Math.abs(polygonArea(a.polygon)) - Math.abs(polygonArea(b.polygon)))[0]?.key;
const cellCenter = (cov: CoverageMap, k: number): Vec2 => [
  cov.originX + (k % cov.width + 0.5) * cov.cell, cov.originZ + (Math.floor(k / cov.width) + 0.5) * cov.cell,
];
const boundaryCells: { key: string; source: Vec2; forbidden: Vec2 }[] = [
  { key: 'K48-t', source: [201.5, 221.5], forbidden: [171.5, 238.5] },
  { key: 'K54', source: [200.5, 221.5], forbidden: [185.5, 215.5] },
];

describe('Castle authored-coordinate migration', () => {
  it('recovers legacy party, member and creature positions without changing their other fields', () => {
    const state = legacy();
    state.tokens.push(token('member', [190, 263], 'member'), token('creature', [192.5, 262.5], 'creature'));
    const original = structuredClone(state);
    const result = migrateMapState(state, scene, grid);
    expect(result.issues).toEqual([]); expect(result.applied).toBe(true);
    expect(result.state.tokens.map(t => t.pos)).toEqual([[210, 257.5], [210, 257.5], [210, 257.5]]);
    for (let i = 0; i < state.tokens.length; i++) expect(result.state.tokens[i]).toEqual({ ...state.tokens[i], pos: [210, 257.5] });
    expect(state).toEqual(original);
  });

  it('preserves valid same-room positions and unaffected scene/level state', () => {
    const state = legacy();
    state.tokens = [token('valid', [197.5, 247.5]), token('other-room', [172.5, 202.5]),
      { ...token('other-map', [190, 260]), location: 'N1' }, token('other-level', [190, 260], 'party', 'court')];
    const result = migrateMapState(state, scene, grid);
    expect(result.applied).toBe(true); expect(result.state.tokens).toEqual(state.tokens);
  });

  it('keeps legacy room identity when old coordinates now belong to another room', () => {
    const state = legacy(); state.tokens = [token('guest', [212.5, 237.5])];
    expect(pointInPolygon(state.tokens[0].pos, room('spires', 'K50').polygon)).toBe(false);
    const result = migrateMapState(state, scene, grid);
    expect(result.issues).toEqual([]);
    expect(pointInPolygon(result.state.tokens[0].pos, room('spires', 'K50').polygon)).toBe(true);
  });

  it('recovers an encounter return point and preserves initiative, combatants and campaign data', () => {
    const state = legacy();
    state.encounter = { location: 'K', level: 'south-tower', round: 3, order: [{ sheetId: 'pc-1', tokenId: 'party', init: 14 }], turn: 0, movedFt: 15, partyPos: [190, 256] };
    state.doorsOpen = { 'K/K51-door': true, 'N1/door': false };
    state.opened = { 'K/chest': true }; state.reveals = [{ type: 'room', location: 'K', key: 'K51', mode: 'explored' }];
    const result = migrateMapState(state, scene, grid);
    expect(result.state.encounter).toEqual({ ...state.encounter, partyPos: [210, 257.5] });
    for (const key of ['id', 'name', 'roster', 'reveals', 'doorsOpen', 'opened', 'updatedAt'] as const) expect(result.state[key]).toEqual(state[key]);
  });

  it('marks fresh state once, survives serialization and is deterministic/idempotent', () => {
    const fresh = newCampaign('cos');
    const migrated = migrateMapState(fresh, scene, grid);
    expect(migrated.applied).toBe(true); expect(migrated.state.mapRevisions?.K).toBe(CASTLE_MAP_REVISION);
    expect(migrated.state.tokens).toEqual([]);
    expect(migrateMapState(migrated.state, scene, grid)).toEqual({ state: migrated.state, applied: false, issues: [] });
    const saved = JSON.parse(JSON.stringify(migrated.state));
    expect(migrateMapState(saved, scene, grid).state).toBe(saved);
    const old = legacy(); expect(migrateMapState(old, scene, grid)).toEqual(migrateMapState(structuredClone(old), scene, grid));
  });

  it('reprojects explored room cells using old dimensions, preserving unrelated cells without new-room spoilers', () => {
    const state = legacy(), spires = oldSpireCoverage(), tower = oldTowerCoverage();
    spires.stamp([[180, 255], [200, 255], [200, 265], [180, 265]], 'explored');
    spires.seen[spires.idx(180.5, 145.5)] = 1;
    tower.stamp([[195, 235], [215, 235], [215, 255], [195, 255]], 'explored');
    state.seen = { 'K/spires': spires.serialize().seen, 'K/south-tower': tower.serialize().seen, 'N1/ground': 'unchanged' };
    const result = migrateMapState(state, scene, grid);
    expect(result.issues).toEqual([]);
    expect(seenAt(result.state, 'spires', [210.5, 257.5])).toBe(1);
    expect(seenAt(result.state, 'spires', [190.5, 260.5])).toBe(0);
    expect(seenAt(result.state, 'spires', [180.5, 145.5])).toBe(1);
    expect(seenAt(result.state, 'south-tower', [210.5, 257.5])).toBe(0);
    expect(seenAt(result.state, 'south-tower', [200.5, 242.5])).toBe(1);
    expect(result.state.seen['N1/ground']).toBe('unchanged');
  });

  it('remaps brush cells and preserves event order, unaffected brushes and semantic reveals', () => {
    const state = legacy();
    state.reveals = [
      { type: 'room', location: 'K', key: 'K50', mode: 'explored' },
      { type: 'brush', location: 'K', level: 'spires', r: 3, pts: [[190, 260]], mode: 'reveal' },
      { type: 'brush', location: 'K', level: 'spires', r: 0, pts: [[190.5, 260.5]], mode: 'fog' },
      { type: 'brush', location: 'K', level: 'court', r: 4, pts: [[190, 260]], mode: 'clear' },
      { type: 'object', location: 'K', id: 'hidden-chest' },
    ];
    const result = migrateMapState(state, scene, grid), cov = coverage('spires');
    expect(result.issues).toEqual([]); expect(result.state.reveals).toHaveLength(state.reveals.length);
    for (const i of [0, 3, 4]) expect(result.state.reveals[i]).toEqual(state.reveals[i]);
    for (const r of result.state.reveals) if (r.type === 'brush' && r.level === 'spires') {
      expect(r.r).toBe(0);
      for (const p of r.pts) { expect(pointInPolygon(p, room('spires', 'K51').polygon)).toBe(true); cov.brush(...p, r.r, r.mode); }
    }
    expect(cov.paint.some(v => v === 1)).toBe(true); expect(cov.paint.some(v => v === 2)).toBe(true);
    expect(cov.paint[cov.idx(190.5, 260.5)]).toBe(0);
  });

  it('returns malformed legacy explored data unresolved without partial mutation or a revision stamp', () => {
    const state = legacy(); state.seen['K/spires'] = 'invalid-rle';
    const original = structuredClone(state), result = migrateMapState(state, scene, grid);
    expect(result.applied).toBe(false); expect(result.issues.length).toBeGreaterThan(0);
    expect(result.state).toBe(state); expect(state).toEqual(original); expect(state.mapRevisions).toBeUndefined();
  });

  it.each(boundaryCells)('keeps one explored $key cell out of the other room after quantization', ({ key, source, forbidden }) => {
    const state = legacy(), old = oldTowerCoverage();
    expect(oldOwner('south-tower', source)).toBe(key);
    old.seen[old.idx(...source)] = 1; state.seen['K/south-tower'] = old.serialize().seen;
    const result = migrateMapState(state, scene, grid), cov = coverage('south-tower');
    expect(result.issues).toEqual([]); expect(result.applied).toBe(true);
    cov.load({ seen: result.state.seen['K/south-tower'], paint: '' });
    expect(cov.seen[cov.idx(...forbidden)]).toBe(0);
    const known = Array.from(cov.seen.keys()).filter(k => cov.seen[k]);
    expect(known.length).toBeGreaterThan(0);
    expect([...new Set(known.map(k => newOwner('south-tower', cellCenter(cov, k))))]).toEqual([key]);
  });

  it.each(boundaryCells.flatMap(cell => (['reveal', 'fog', 'clear'] as const).map(mode => ({ ...cell, mode }))))(
    'keeps a one-cell $mode brush in $key after quantization', ({ key, source, mode, forbidden }) => {
      const state = legacy();
      state.reveals = [{ type: 'brush', location: 'K', level: 'south-tower', r: 0, pts: [source], mode }];
      const result = migrateMapState(state, scene, grid), cov = coverage('south-tower');
      expect(result.issues).toEqual([]); expect(result.applied).toBe(true);
      const initial = mode === 'reveal' ? 0 : mode === 'fog' ? 1 : 2;
      cov.paint.fill(initial);
      for (const r of result.state.reveals) if (r.type === 'brush') for (const p of r.pts) cov.brush(...p, r.r, r.mode);
      expect(cov.paint[cov.idx(...forbidden)]).toBe(initial);
      const changed = Array.from(cov.paint.keys()).filter(k => cov.paint[k] !== initial);
      expect(changed.length).toBeGreaterThan(0);
      expect([...new Set(changed.map(k => newOwner('south-tower', cellCenter(cov, k))))]).toEqual([key]);
    },
  );

  it.each(oldRooms)('preserves $level/$key room-only knowledge and ordered brush overrides', ({ level, key }) => {
    const state = legacy(), old = level === 'spires' ? oldSpireCoverage() : oldTowerCoverage();
    const pts: Vec2[] = [];
    for (let k = 0; k < old.seen.length; k++) if (oldOwner(level, cellCenter(old, k)) === key) {
      old.seen[k] = 1; pts.push(cellCenter(old, k));
    }
    state.seen[`K/${level}`] = old.serialize().seen;
    const modes = ['reveal', 'fog', 'clear', 'reveal'] as const;
    state.reveals = modes.map(mode => ({ type: 'brush', location: 'K', level, r: 0, pts, mode }));
    const result = migrateMapState(state, scene, grid), cov = coverage(level);
    expect(result.issues).toEqual([]); expect(result.applied).toBe(true);
    cov.load({ seen: result.state.seen[`K/${level}`], paint: '' });
    const known = Array.from(cov.seen.keys()).filter(k => cov.seen[k]);
    expect(known.length).toBeGreaterThan(0);
    expect([...new Set(known.map(k => newOwner(level, cellCenter(cov, k))))]).toEqual([key]);
    expect(result.state.reveals.map(r => r.type === 'brush' ? r.mode : r.type)).toEqual(modes);
    for (const r of result.state.reveals) if (r.type === 'brush') {
      expect(r.pts.length).toBeGreaterThan(0);
      expect([...new Set(r.pts.map(p => newOwner(level, p)))]).toEqual([key]);
      for (const p of r.pts) cov.brush(...p, r.r, r.mode);
      if (r.mode === 'clear') expect(cov.paint.every(v => v === 0)).toBe(true);
      else {
        const paint = r.mode === 'reveal' ? 1 : 2;
        expect(cov.paint.some(v => v === paint)).toBe(true);
        expect(cov.paint.every(v => v === 0 || v === paint)).toBe(true);
      }
    }
  });

  const malformed: [string, (state: Record<string, any>) => void][] = [
    ['token NaN serialized to null', s => { s.tokens[0].pos = [NaN, 260]; }],
    ['token missing position', s => { delete s.tokens[0].pos; }],
    ['token short tuple', s => { s.tokens[0].pos = [190]; }],
    ['token extra coordinate', s => { s.tokens[0].pos = [190, 260, 0]; }],
    ['token string coordinate', s => { s.tokens[0].pos = ['190', 260]; }],
    ['token object position', s => { s.tokens[0].pos = { x: 190, z: 260 }; }],
    ['token null record', s => { s.tokens.push(null); }],
    ['token missing level', s => { delete s.tokens[0].level; }],
    ['tokens wrong container', s => { s.tokens = {}; }],
    ['encounter null position', s => { s.encounter = { location: 'K', level: 'south-tower', partyPos: null }; }],
    ['encounter missing position', s => { s.encounter = { location: 'K', level: 'spires' }; }],
    ['encounter wrong container', s => { s.encounter = []; }],
    ['explored numeric value', s => { s.seen['K/spires'] = 123; }],
    ['explored zero value', s => { s.seen['K/spires'] = 0; }],
    ['explored null value', s => { s.seen['K/spires'] = null; }],
    ['explored wrong container', s => { s.seen = []; }],
    ['brush null point', s => { s.reveals[0].pts = [null]; }],
    ['brush short point', s => { s.reveals[0].pts = [[190]]; }],
    ['brush extra coordinate', s => { s.reveals[0].pts = [[190, 260, 0]]; }],
    ['brush string coordinate', s => { s.reveals[0].pts = [['190', 260]]; }],
    ['brush missing points', s => { delete s.reveals[0].pts; }],
    ['brush wrong points container', s => { s.reveals[0].pts = {}; }],
    ['brush infinite radius serialized to null', s => { s.reveals[0].r = Infinity; }],
    ['brush invalid mode', s => { s.reveals[0].mode = 'explored'; }],
    ['reveal null record', s => { s.reveals.push(null); }],
    ['reveals wrong container', s => { s.reveals = {}; }],
    ['doors wrong container', s => { s.doorsOpen = null; }],
    ['door invalid value', s => { s.doorsOpen['K/K51-door'] = 'open'; }],
    ['revision wrong container', s => { s.mapRevisions = []; }],
    ['revision invalid value', s => { s.mapRevisions = { K: '1' }; }],
  ];
  it.each(malformed)('returns serialized malformed $0 atomically without a revision', (_, corrupt) => {
    const fixture = legacy();
    fixture.reveals = [{ type: 'brush', location: 'K', level: 'spires', r: 1, pts: [[190, 260]], mode: 'reveal' }];
    corrupt(fixture);
    const state: CampaignState = JSON.parse(JSON.stringify(fixture)), original = structuredClone(state);
    const result = migrateMapState(state, scene, grid);
    expect(result.applied).toBe(false); expect(result.issues.length).toBeGreaterThan(0);
    expect(result.state).toBe(state); expect(state).toEqual(original);
    expect(state.mapRevisions?.K).not.toBe(CASTLE_MAP_REVISION);
  });

  it('rejects nonserialized nonfinite coordinates before ownership lookup', () => {
    const state = legacy(); state.tokens[0].pos = [NaN, Infinity];
    const original = structuredClone(state), result = migrateMapState(state, scene, grid);
    expect(result.applied).toBe(false); expect(result.issues.length).toBeGreaterThan(0);
    expect(result.state).toBe(state); expect(state).toEqual(original); expect(state.mapRevisions).toBeUndefined();
  });

  it('refuses to guess another landing if the semantic destination is blocked', () => {
    const state = legacy(), blocked = structuredClone(scene);
    blocked.levels.find(l => l.id === 'spires')!.walls.push({ id: 'fixture-closed-wall', a: [210, 252.5], b: [210, 262.5], flags: ['normal'] });
    const result = migrateMapState(state, blocked, grid);
    expect(result.applied).toBe(false); expect(result.issues.some(s => s.includes('party'))).toBe(true);
    expect(result.state).toBe(state);
  });

  it('leaves other maps and future revisions untouched', () => {
    const state = legacy();
    expect(migrateMapState(state, { ...scene, location: 'N1' }, grid)).toEqual({ state, applied: false, issues: [] });
    state.mapRevisions = { K: 99 };
    expect(migrateMapState(state, scene, grid)).toEqual({ state, applied: false, issues: [] });
  });
});
