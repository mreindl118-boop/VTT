// Campaign backups: the export file (with a schema version), validation on import, and rolling snapshots kept in
// IndexedDB beside the save. Pure functions plus thin IndexedDB helpers, so tests run them under fake-indexeddb.
import { newCampaign, type CampaignState } from './campaign';
import { idbGet, idbSet } from './idb';
import { KEY_CLASS } from '../core/playersView';

/** Version of the export file and of the saved state. Each bump adds a migration below and a fixture in tests/. */
export const SCHEMA_VERSION = 1;
/** Where a campaign's state is saved (Curse of Strahd keeps its original key). */
export const storeKey = (campaignId: string): string => (campaignId === 'cos' ? 'campaign:default' : `campaign:${campaignId}`);
const snapKey = (campaignId: string) => `snapshots:${campaignId}`;

export const SNAPSHOT_KEEP = 5;
/** An automatic snapshot every this many commits, */
export const SNAPSHOT_EVERY = 25;
/** or on the first commit once the newest snapshot is this old. */
export const SNAPSHOT_MAX_AGE_MS = 30 * 60_000;

export interface CampaignFile {
  app: 'mistlab';
  schemaVersion: number;
  /** The campaign the state belongs to ('cos', 'wsc'). */
  campaign: string;
  /** The location open when it was exported. */
  scene?: string;
  exportedAt: string;
  state: CampaignState;
}

const pad = (n: number) => String(n).padStart(2, '0');
/** mistlab-cos-2026-10-04-1405.json */
export function exportName(campaignId: string, at = new Date()): string {
  return `mistlab-${campaignId}-${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}.json`;
}

export function exportCampaign(state: CampaignState, campaignId: string, scene?: string, at = new Date()): { name: string; text: string; file: CampaignFile } {
  const file: CampaignFile = { app: 'mistlab', schemaVersion: SCHEMA_VERSION, campaign: campaignId, scene, exportedAt: at.toISOString(), state };
  return { name: exportName(campaignId, at), text: JSON.stringify(file), file };
}

// ------------------------------------------------------------------ validation

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isStr = (x: unknown): x is string => typeof x === 'string';
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isVec2 = (x: unknown) => Array.isArray(x) && x.length === 2 && isNum(x[0]) && isNum(x[1]);
const isRecordOf = (x: unknown, f: (v: unknown) => boolean) => isObj(x) && Object.values(x).every(f);

function revealError(r: unknown, i: number): string | null {
  if (!isObj(r) || !isStr(r.location)) return `reveal ${i + 1} is not a reveal`;
  switch (r.type) {
    case 'room': return isStr(r.key) && ['reveal', 'fog', 'explored'].includes(r.mode as string) ? null : `reveal ${i + 1} is a broken room reveal`;
    case 'object': return isStr(r.id) ? null : `reveal ${i + 1} is a broken object reveal`;
    case 'secret-door': return isStr(r.id) && isStr(r.wallId) ? null : `reveal ${i + 1} is a broken secret-door reveal`;
    case 'brush': return isStr(r.level) && ['reveal', 'fog', 'clear'].includes(r.mode as string) && isNum(r.r) && Array.isArray(r.pts) && r.pts.every(isVec2) ? null : `reveal ${i + 1} is a broken painted reveal`;
    default: return `reveal ${i + 1} has an unknown type`;
  }
}

/** Why a value is not a usable CampaignState, or null when it is. */
export function stateError(s: unknown): string | null {
  if (!isObj(s)) return 'it holds no campaign';
  if (!Array.isArray(s.reveals)) return 'the reveals are missing';
  for (let i = 0; i < s.reveals.length; i++) { const e = revealError(s.reveals[i], i); if (e) return e; }
  if (!Array.isArray(s.tokens)) return 'the tokens are missing';
  for (const t of s.tokens) if (!isObj(t) || !isStr(t.id) || !isStr(t.location) || !isStr(t.level) || !isVec2(t.pos)) return 'a token is broken';
  if (!isRecordOf(s.seen ?? {}, isStr)) return 'the explored memory is broken';
  if (!isRecordOf(s.doorsOpen ?? {}, (v) => typeof v === 'boolean')) return 'the door states are broken';
  if (!isRecordOf(s.opened ?? {}, (v) => typeof v === 'boolean')) return 'the opened containers are broken';
  if (s.roster !== undefined && (!Array.isArray(s.roster) || !s.roster.every((r) => isObj(r) && isStr(r.id) && isStr(r.name) && isNum(r.speedFt)))) return 'the roster is broken';
  if (s.world !== undefined && (!isObj(s.world) || !isVec2(s.world.pos) || !Array.isArray(s.world.trail))) return 'the world-map position is broken';
  if (s.worldRevealed !== undefined && (!Array.isArray(s.worldRevealed) || !s.worldRevealed.every(isStr))) return 'the revealed places are broken';
  if (s.clock !== undefined && (!isObj(s.clock) || !isNum(s.clock.day) || !isNum(s.clock.hour))) return 'the clock is broken';
  if (s.encounter !== undefined && (!isObj(s.encounter) || !isStr(s.encounter.location) || !Array.isArray(s.encounter.order) || !isNum(s.encounter.round))) return 'the encounter is broken';
  return null;
}

/** Step migrations: MIGRATIONS[n] turns a version-n file into a version-(n + 1) file. */
const MIGRATIONS: Record<number, (f: CampaignFile) => CampaignFile> = {};

export type ImportResult = { ok: true; file: CampaignFile; state: CampaignState } | { ok: false; error: string };

/**
 * Read a backup for the active campaign. Refuses anything that is not a mistLAB campaign file, a file from a newer
 * mistLAB, a file of another campaign, and a file whose state is broken. Keys this version does not know are dropped.
 */
export function parseCampaignFile(text: string, activeId: string, nameOf: (id: string) => string = (id) => id): ImportResult {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: 'This file is not a mistLAB backup (it is not JSON).' }; }
  if (!isObj(raw) || raw.app !== 'mistlab' || !Number.isInteger(raw.schemaVersion) || !isStr(raw.campaign)) return { ok: false, error: 'This file is not a mistLAB backup.' };
  let file = raw as unknown as CampaignFile;
  if (file.schemaVersion > SCHEMA_VERSION) return { ok: false, error: `This backup was made by a newer mistLAB (format ${file.schemaVersion}); update mistLAB first.` };
  if (file.schemaVersion < 1) return { ok: false, error: 'This backup uses a format mistLAB no longer reads.' };
  if (file.campaign !== activeId) return { ok: false, error: `This backup is for ${nameOf(file.campaign)}, but ${nameOf(activeId)} is open. Open a location of ${nameOf(file.campaign)} from the Library first.` };
  for (let v = file.schemaVersion; v < SCHEMA_VERSION; v++) file = { ...MIGRATIONS[v](file), schemaVersion: v + 1 };
  const err = stateError(file.state);
  if (err) return { ok: false, error: `This backup cannot be read: ${err}.` };
  const known = Object.fromEntries(Object.entries(file.state).filter(([k]) => k in KEY_CLASS));
  const state = { ...newCampaign(activeId), ...known, id: activeId } as CampaignState;
  return { ok: true, file, state };
}

// ------------------------------------------------------------------ saves and snapshots

export const loadSaved = (campaignId: string) => idbGet<CampaignState>(storeKey(campaignId));
export const saveState = (campaignId: string, state: CampaignState) => idbSet(storeKey(campaignId), state);

export type SnapshotReason = 'auto' | 'before import' | 'before restore' | 'before reset';
export interface Snapshot { at: number; reason: SnapshotReason; reveals: number; tokens: number; state: CampaignState }

/** Snapshots of a campaign, newest first. */
export async function listSnapshots(campaignId: string): Promise<Snapshot[]> {
  return (await idbGet<Snapshot[]>(snapKey(campaignId)).catch(() => undefined)) ?? [];
}

const sameState = (a: CampaignState, b: CampaignState) => JSON.stringify({ ...a, updatedAt: 0 }) === JSON.stringify({ ...b, updatedAt: 0 });
let queue: Promise<unknown> = Promise.resolve();

/** Keep a copy of the state; the oldest beyond SNAPSHOT_KEEP is dropped, and a copy equal to the newest is not kept twice. */
export function addSnapshot(campaignId: string, state: CampaignState, reason: SnapshotReason, at = Date.now()): Promise<Snapshot[]> {
  const copy = structuredClone(state);
  const run = queue.then(async () => {
    const list = await listSnapshots(campaignId);
    if (list[0] && sameState(list[0].state, copy)) return list;
    const next = [{ at, reason, reveals: copy.reveals.length, tokens: copy.tokens.length, state: copy }, ...list].slice(0, SNAPSHOT_KEEP);
    await idbSet(snapKey(campaignId), next);
    return next;
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Keep a snapshot of the current state, then save the replacement (import, restore, reset). */
export async function replaceSaved(campaignId: string, current: CampaignState, next: CampaignState, reason: SnapshotReason): Promise<void> {
  await addSnapshot(campaignId, current, reason);
  await saveState(campaignId, next);
}

/** Decides when a commit also takes an automatic snapshot. */
export class SnapshotSchedule {
  private commits = new Map<string, number>();
  private lastAt = new Map<string, number>();
  constructor(private every = SNAPSHOT_EVERY, private maxAgeMs = SNAPSHOT_MAX_AGE_MS) {}
  private chain: Promise<unknown> = Promise.resolve();
  /** Count one commit; resolves true when it took a snapshot. */
  note(campaignId: string, state: CampaignState, now = Date.now()): Promise<boolean> {
    const n = (this.commits.get(campaignId) ?? 0) + 1;
    this.commits.set(campaignId, n);
    const last = this.lastAt.get(campaignId);
    if (last !== undefined && n < this.every && now - last < this.maxAgeMs) return Promise.resolve(false);
    const copy = structuredClone(state);
    // Decisions run in commit order; the first one of a session reads when the newest stored snapshot was taken.
    const run = this.chain.then(async () => {
      let at = this.lastAt.get(campaignId);
      if (at === undefined) { at = (await listSnapshots(campaignId))[0]?.at ?? -Infinity; this.lastAt.set(campaignId, at); }
      if ((this.commits.get(campaignId) ?? 0) < this.every && now - at < this.maxAgeMs) return false;
      this.commits.set(campaignId, 0);
      this.lastAt.set(campaignId, now);
      await addSnapshot(campaignId, copy, 'auto', now);
      return true;
    });
    this.chain = run.catch(() => false);
    return run;
  }
}
