import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { SceneFile } from '../app/src/core/schema';
import { DM_KEYS, KEY_CLASS, PLAYER_KEYS, projectState, unclassifiedKeys } from '../app/src/core/playersView';
import { Channel, type Msg } from '../app/src/state/channel';
import type { CampaignState } from '../app/src/state/campaign';

// Hidden or disguised things carry a player-facing name, so a revealed card never shows the DM label.
describe('player-facing names', () => {
  const scene = JSON.parse(readFileSync('locations/appB/death-house/scene.json', 'utf8')) as SceneFile;
  it('every hidden Death House object has a playerLabel distinct from DM detail', () => {
    const missing: string[] = [];
    for (const l of scene.levels) for (const o of l.objects)
      if (o.vis && o.vis !== 'player' && o.vis !== 'dm-note' && !o.playerLabel) missing.push(o.id);
    expect(missing).toEqual([]);
  });
  it('player names never repeat DM-only notes', () => {
    for (const l of scene.levels) for (const o of l.objects) {
      if (!o.playerLabel) continue;
      expect(o.playerLabel).not.toMatch(/\(|DC \d|Strahd|Durst|mimic|disguised/i);
    }
  });
});

// The Player Display receives only the players' projection of the campaign (core/playersView.ts).
/** The keys declared in `interface CampaignState` in a copy of campaign.ts's source. */
function declaredKeys(source: string): string[] {
  const body = /export interface CampaignState \{([\s\S]*?)\n\}/.exec(source)?.[1] ?? '';
  return [...body.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]);
}
const unclassifiedIn = (source: string) => declaredKeys(source).filter((k) => !(k in KEY_CLASS));
const CAMPAIGN_SRC = readFileSync('app/src/state/campaign.ts', 'utf8');
const FULL = (): CampaignState => JSON.parse(readFileSync('tests/fixtures/campaign-cos-v1.json', 'utf8')).state;

describe('players\' state projection', () => {
  it('every CampaignState key is classified player or dm', () => {
    const keys = declaredKeys(CAMPAIGN_SRC);
    expect(keys.length).toBeGreaterThanOrEqual(13);
    expect(unclassifiedIn(CAMPAIGN_SRC)).toEqual([]);
    expect([...keys].sort()).toEqual(Object.keys(KEY_CLASS).sort()); // and no stale classifications
    for (const c of Object.values(KEY_CLASS)) expect(['player', 'dm']).toContain(c);
  });

  it('a key added to CampaignState without a classification fails', () => {
    const added = CAMPAIGN_SRC.replace('  updatedAt: number;', '  /** DM notes. */\n  notes?: Record<string, string>;\n  updatedAt: number;');
    expect(added).not.toBe(CAMPAIGN_SRC);
    expect(unclassifiedIn(added)).toEqual(['notes']);
    expect(unclassifiedKeys({ ...FULL(), notes: {} })).toEqual(['notes']);
  });

  it('projectState() output has no dm key, keeps every player key, and drops unclassified keys', () => {
    expect(DM_KEYS.length).toBeGreaterThan(0);
    const s = { ...FULL(), notes: { E4: 'secret' } } as CampaignState;
    const p = projectState(s) as Record<string, unknown>;
    for (const k of DM_KEYS) expect(k in p, k).toBe(false);
    for (const k of PLAYER_KEYS) expect(p[k], k).toEqual(s[k]);
    expect('notes' in p).toBe(false);
    expect(Object.keys(p).every((k) => KEY_CLASS[k as keyof typeof KEY_CLASS] === 'player')).toBe(true);
  });

  it('the channel\'s state message carries only the projection', async () => {
    const got: Msg[] = [];
    const listener = new BroadcastChannel('mistlab');
    const done = new Promise<void>((res) => { listener.onmessage = (e) => { got.push(e.data as Msg); res(); }; });
    const ch = new Channel(() => {});
    ch.send({ kind: 'state', state: FULL(), location: 'appB/death-house', level: 'f2' });
    await done;
    listener.close(); (ch as unknown as { bc: BroadcastChannel }).bc.close();
    const m = got[0];
    expect(m.kind).toBe('state');
    if (m.kind !== 'state') return;
    for (const k of DM_KEYS) expect(k in m.state, k).toBe(false);
    expect(m.state.reveals).toEqual(FULL().reveals);
  });
});
