// Campaign backups: export, reset and import round-trip through IndexedDB (fake-indexeddb); refused files leave the
// save untouched; rolling snapshots; the schema-version fixture stays importable.
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { newCampaign, type CampaignState } from '../app/src/state/campaign';
import { addSnapshot, exportCampaign, exportName, listSnapshots, loadSaved, parseCampaignFile, replaceSaved, saveState, SCHEMA_VERSION, SNAPSHOT_EVERY, SNAPSHOT_KEEP, SnapshotSchedule, snapshotState, storeKey } from '../app/src/state/backup';
import { idbDel, idbSet } from '../app/src/state/idb';

const FIXTURE_TEXT = readFileSync('tests/fixtures/campaign-cos-v1.json', 'utf8');
/** A campaign with every key filled: reveals of each kind, doors, opened, tokens, roster, an encounter, clock and world. */
const rich = (): CampaignState => structuredClone(JSON.parse(FIXTURE_TEXT).state);
const ROUND_TRIP_KEYS = ['reveals', 'doorsOpen', 'opened', 'tokens', 'roster', 'encounter', 'clock', 'world', 'worldRevealed', 'seen'] as const;
const names: Record<string, string> = { cos: 'Curse of Strahd', wsc: 'A Wild Sheep Chase' };
const nameOf = (id: string) => names[id] ?? id;

beforeEach(async () => {
  for (const id of ['cos', 'wsc']) { await idbDel(storeKey(id)); await idbDel(`snapshots:${id}`); }
});

describe('export, reset, import', () => {
  it('round-trips reveals, doors, opened, tokens, roster, encounter, clock and world', async () => {
    await saveState('cos', rich());
    const saved = (await loadSaved('cos'))!;
    const exp = exportCampaign(saved, 'cos', 'appB/death-house', new Date(2026, 9, 4, 14, 5));
    expect(exp.name).toMatch(/^mistlab-cos-.*\.json$/);
    expect(exp.name).toBe('mistlab-cos-2026-10-04-1405.json');
    expect(exp.file.schemaVersion).toBe(SCHEMA_VERSION);

    // Reset: a fresh campaign replaces the save (a snapshot of the old one is kept).
    await replaceSaved('cos', saved, newCampaign('cos'), 'before reset');
    const reset = (await loadSaved('cos'))!;
    expect(reset.reveals).toEqual([]);
    expect(reset.encounter).toBeUndefined();

    // Import the exported text.
    const r = parseCampaignFile(exp.text, 'cos', nameOf);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    await replaceSaved('cos', reset, r.state, 'before import');
    const after = (await loadSaved('cos'))!;
    const want = rich();
    for (const k of ROUND_TRIP_KEYS) expect(after[k], k).toEqual(want[k]);
    expect(after.id).toBe('cos');
    expect((await listSnapshots('cos')).map((s) => s.reason)).toEqual(['before import', 'before reset']);
  });

  it('refuses a malformed file and leaves the state unchanged', async () => {
    await saveState('cos', rich());
    const before = await loadSaved('cos');
    const good = JSON.parse(FIXTURE_TEXT);
    const bad = [
      'not json at all',
      '[]',
      JSON.stringify({ hello: 'world' }),
      JSON.stringify({ ...good, app: 'other' }),
      JSON.stringify({ ...good, schemaVersion: '1' }),
      JSON.stringify({ ...good, schemaVersion: SCHEMA_VERSION + 1 }),
      JSON.stringify({ ...good, state: null }),
      JSON.stringify({ ...good, state: { ...good.state, reveals: 'all of them' } }),
      JSON.stringify({ ...good, state: { ...good.state, reveals: [{ type: 'room', location: 'death-house' }] } }),
      JSON.stringify({ ...good, state: { ...good.state, tokens: [{ id: 'x', location: 'death-house', level: 'f1' }] } }),
      JSON.stringify({ ...good, state: { ...good.state, doorsOpen: { a: 'yes' } } }),
      JSON.stringify({ ...good, state: { ...good.state, clock: { day: 'monday' } } }),
      JSON.stringify({ ...good, state: { ...good.state, encounter: { round: 1 } } }),
      JSON.stringify({ ...good, state: { ...good.state, encounter: { ...good.state.encounter, order: [42, null] } } }),
      JSON.stringify({ ...good, state: { ...good.state, encounter: { ...good.state.encounter, order: [{}] } } }),
      JSON.stringify({ ...good, state: { ...good.state, tokens: [{ ...good.state.tokens[0], size: undefined, color: undefined }] } }),
      JSON.stringify({ ...good, state: { ...good.state, tokens: [{ ...good.state.tokens[0], role: 'boss' }] } }),
      JSON.stringify({ ...good, state: { ...good.state, world: { ...good.state.world, trail: [7, null] } } }),
      JSON.stringify({ ...good, state: { ...good.state, roster: [{ id: 'pc-9', name: 'Ireena', speedFt: 30, size: 'enormous' }] } }),
    ];
    for (const text of bad) {
      const r = parseCampaignFile(text, 'cos', nameOf);
      expect(r.ok, text.slice(0, 80)).toBe(false);
      if (r.ok) await replaceSaved('cos', before!, r.state, 'before import'); // what the Library would do on accept
      else expect(r.error.length).toBeGreaterThan(10);
    }
    expect(await loadSaved('cos')).toEqual(before);
    expect(await listSnapshots('cos')).toEqual([]);
  });

  it('refuses a Wild Sheep Chase file while Curse of Strahd is open, and leaves the state unchanged', async () => {
    await saveState('cos', rich());
    const before = await loadSaved('cos');
    const wsc = exportCampaign({ ...newCampaign('wsc'), clock: { day: 9, hour: 9 } }, 'wsc', 'wsc/01-tavern');
    expect(wsc.name).toMatch(/^mistlab-wsc-/);
    const r = parseCampaignFile(wsc.text, 'cos', nameOf);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('A Wild Sheep Chase');
    expect(await loadSaved('cos')).toEqual(before);
    // the same file is accepted by its own campaign
    expect(parseCampaignFile(wsc.text, 'wsc', nameOf).ok).toBe(true);
  });

  it('drops keys this version does not classify, and fills keys an older file lacks', () => {
    const f = JSON.parse(FIXTURE_TEXT);
    delete f.state.worldRevealed; delete f.state.roster;
    f.state.somethingNew = { secret: true };
    const r = parseCampaignFile(JSON.stringify(f), 'cos');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect('somethingNew' in r.state).toBe(false);
    expect(r.state.roster.length).toBeGreaterThan(0); // the default roster
    expect(r.state.worldRevealed).toBeUndefined();
  });

  it('schema fixture v1 still imports unchanged', () => {
    const r = parseCampaignFile(FIXTURE_TEXT, 'cos');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state).toEqual(rich());
  });

  it('names exports mistlab-<campaign>-<date>-<time>.json', () => {
    expect(exportName('cos', new Date(2026, 0, 2, 3, 4))).toBe('mistlab-cos-2026-01-02-0304.json');
  });

  it('N4: idbSet rejects when the IndexedDB transaction aborts instead of hanging forever', async () => {
    const proto = IDBDatabase.prototype;
    const origTx = proto.transaction;
    proto.transaction = function (...args: Parameters<typeof origTx>) {
      const tx = origTx.apply(this, args);
      queueMicrotask(() => {
        if (typeof tx.onabort === 'function') tx.onabort.call(tx, new Event('abort'));
      });
      return tx;
    };
    try {
      await expect(idbSet('abort-test', { ok: true })).rejects.toBeDefined();
    } finally {
      proto.transaction = origTx;
    }
  });
});

describe('rolling snapshots', () => {
  it('after 60 commits at least one snapshot is listed, and restoring it deep-equals it', async () => {
    const sched = new SnapshotSchedule();
    const s = rich();
    const took: Promise<boolean>[] = [];
    for (let i = 0; i < 60; i++) { s.reveals.push({ type: 'room', location: 'death-house', key: String(i), mode: 'reveal' }); s.updatedAt++; took.push(sched.note('cos', s)); }
    await Promise.all(took);
    await saveState('cos', s);
    const snaps = await listSnapshots('cos');
    expect(snaps.length).toBeGreaterThanOrEqual(1);
    expect(snaps.length).toBeLessThanOrEqual(SNAPSHOT_KEEP);
    for (let i = 1; i < snaps.length; i++) expect(snaps[i - 1].state.reveals.length).toBeGreaterThan(snaps[i].state.reveals.length); // newest first
    const pick = snaps[snaps.length - 1];
    expect(pick.reveals).toBe(pick.state.reveals.length);
    await replaceSaved('cos', s, pick.state, 'before restore');
    expect(await loadSaved('cos')).toEqual(pick.state);
    expect((await listSnapshots('cos'))[0].reason).toBe('before restore');
  });

  it('a burst of commits before the first read still takes one snapshot per SNAPSHOT_EVERY', async () => {
    const sched = new SnapshotSchedule();
    const s = newCampaign('cos');
    const took: Promise<boolean>[] = [];
    for (let i = 0; i < 60; i++) { s.reveals.push({ type: 'object', location: 'x', id: String(i) }); took.push(sched.note('cos', s, 1000)); }
    expect((await Promise.all(took)).filter(Boolean).length).toBe(3); // commits 1, 26 and 51
    expect((await listSnapshots('cos')).map((x) => x.reveals)).toEqual([51, 26, 1]);
  });

  it('a snapshot carries its schema version and restores through the import checks', async () => {
    await addSnapshot('cos', rich(), 'auto', 5);
    const [snap] = await listSnapshots('cos');
    expect(snap.schemaVersion).toBe(SCHEMA_VERSION);
    const r = snapshotState(snap, 'cos');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state).toEqual(rich());
    const legacy = { ...snap }; delete legacy.schemaVersion; // written before snapshots carried a version
    expect(snapshotState(legacy, 'cos').ok).toBe(true);
    expect(snapshotState({ ...snap, schemaVersion: SCHEMA_VERSION + 1 }, 'cos').ok).toBe(false);
    expect(snapshotState({ ...snap, state: { ...snap.state, tokens: [{}] } as unknown as CampaignState }, 'cos').ok).toBe(false);
  });

  it('takes one every SNAPSHOT_EVERY commits and keeps only the last five', async () => {
    const sched = new SnapshotSchedule();
    const s = newCampaign('cos');
    let n = 0;
    for (let i = 0; i < SNAPSHOT_EVERY * 8; i++) { s.reveals.push({ type: 'object', location: 'x', id: String(i) }); if (await sched.note('cos', s, 1000 + i)) n++; }
    expect(n).toBeGreaterThanOrEqual(7);
    expect((await listSnapshots('cos')).length).toBe(SNAPSHOT_KEEP);
  });

  it('does not keep the same state twice in a row', async () => {
    const s = rich();
    await addSnapshot('cos', s, 'auto', 1);
    await addSnapshot('cos', { ...s, updatedAt: s.updatedAt + 5 }, 'auto', 2);
    expect((await listSnapshots('cos')).length).toBe(1);
  });

  it('a snapshot is a copy: later changes to the live state do not reach it', async () => {
    const s = rich();
    await addSnapshot('cos', s, 'auto');
    s.reveals.length = 0;
    expect((await listSnapshots('cos'))[0].state.reveals.length).toBe(rich().reveals.length);
  });

  it('N4: idbSet rejects when the IndexedDB transaction aborts instead of hanging forever', async () => {
    const proto = IDBDatabase.prototype;
    const origTx = proto.transaction;
    proto.transaction = function (...args: Parameters<typeof origTx>) {
      const tx = origTx.apply(this, args);
      queueMicrotask(() => {
        if (typeof tx.onabort === 'function') tx.onabort.call(tx, new Event('abort'));
      });
      return tx;
    };
    try {
      await expect(idbSet('abort-test', { ok: true })).rejects.toBeDefined();
    } finally {
      proto.transaction = origTx;
    }
  });
});
