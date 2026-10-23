import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { SceneFile } from '../app/src/core/schema';
import { DM_KEYS, KEY_CLASS, PLAYER_KEYS, projectState, unclassifiedKeys } from '../app/src/core/playersView';
import { Channel, type Msg } from '../app/src/state/channel';
import { playerFacing, turnView } from '../app/src/core/identity';
import type { CampaignState, Encounter, Sheet, Token } from '../app/src/state/campaign';
import { setBookFetcher } from '../app/src/books/store';
import { corpusFields, loadBooks, sceneFiles, worldFiles } from '../scripts/terms-corpus';
import { renderSpans, spansFor } from '../app/src/ui/terms';
import { objectCardHtml, playersRoomCardHtml, roomHeadHtml, creatureCardHtml } from '../app/src/ui/cards';
import { playerDesc, playerLabel } from '../app/src/core/objectText';
import { BESTIARY, seenAs, STATS } from '../app/src/bestiary';
import { PLAYER_KINDS } from '../app/src/ui/kinds';
import type { RichCtx } from '../app/src/ui/rich';

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
    for (const k of PLAYER_KEYS) {
      if (k === 'tokens' || k === 'roster') expect(k in p, k).toBe(true);
      else expect(p[k], k).toEqual(s[k]);
    }
    expect('notes' in p).toBe(false);
    expect(Object.keys(p).every((k) => KEY_CLASS[k as keyof typeof KEY_CLASS] === 'player')).toBe(true);
  });

  it('N8: projectState() strips hidden creature canonical names and hit points from tokens and roster', () => {
    const s = FULL();
    const p = projectState(s);
    const json = JSON.stringify(p);
    expect(json).not.toContain('Wolf');
    for (const t of p.tokens) {
      if (t.role === 'creature') expect(t.hp).toBeUndefined();
    }
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

// ---- the alias and visibility projection (core/identity.ts): a ghoul aliased 'Hunched thing', hidden, in initiative
// with a PC; a second ghoul with its own alias.
const tok = (x: Partial<Token>): Token => ({ id: 'x', name: 'x', location: 'appB/death-house', level: 'f1', pos: [0, 0], size: 'medium', darkvisionFt: 0, color: '#888', ...x });
const pc = tok({ id: 'tok-pc', name: 'Ireth', role: 'member', sheetId: 'pc-1' });
const ghoul = tok({ id: 'tok-g1', name: 'Ghoul', role: 'creature', creatureId: 'ghoul', hidden: true, playerName: 'Hunched thing', hp: { cur: 22, max: 22 }, sheetId: 'cr:ghoul' });
const ghoul2 = tok({ id: 'tok-g2', name: 'Ghoul', role: 'creature', creatureId: 'ghoul', hidden: false, playerName: 'Pale crawler', hp: { cur: 9, max: 22 }, sheetId: 'cr:ghoul' });
const roster: Sheet[] = [
  { id: 'pc-1', name: 'Ireth', color: '#5b8ac9', speedFt: 30, reachFt: 5, rangeFt: 60, initMod: 2, size: 'medium', darkvisionFt: 0, kind: 'pc' },
  { id: 'cr:ghoul', name: 'Ghoul', color: '#8a2b2b', speedFt: 30, reachFt: 5, rangeFt: 0, initMod: 0, size: 'medium', darkvisionFt: 60, kind: 'npc' },
];
const enc = (turn: number, order = [{ sheetId: 'cr:ghoul', tokenId: 'tok-g1', init: 17 }, { sheetId: 'pc-1', tokenId: 'tok-pc', init: 12 }]): Encounter =>
  ({ location: 'appB/death-house', level: 'f1', round: 2, order, turn, movedFt: 10, partyPos: [0, 0] });
const text = (v: ReturnType<typeof turnView>) => JSON.stringify(v);

describe('the alias and visibility projection', () => {
  it('a hidden creature does not exist for the players; revealed, it goes by its own alias; the DM keeps full names', () => {
    expect(playerFacing(ghoul, { restricted: true })).toEqual({ visible: false });
    expect(playerFacing({ ...ghoul, hidden: false }, { restricted: true })).toEqual({ visible: true, name: 'Hunched thing' });
    expect(playerFacing(ghoul2, { restricted: true })).toEqual({ visible: true, name: 'Pale crawler' });
    expect(playerFacing(ghoul, { restricted: false })).toEqual({ visible: true, name: 'Ghoul' });
    expect(playerFacing(pc, { restricted: true })).toEqual({ visible: true, name: 'Ireth' });
    // Never the real or sheet name: with no alias set, the bestiary's alias for a person is a stranger.
    expect(playerFacing(tok({ role: 'creature', name: 'Strahd von Zarovich', creatureId: 'strahd-von-zarovich' }), { restricted: true }).name).toBe('A stranger');
  });
  it('the players\' turn bar leaves the hidden ghoul out, and shows only the round on its turn', () => {
    const p = turnView(enc(0), [pc, ghoul], roster, { restricted: true });
    expect(p.order.map((c) => c.name)).toEqual(['Ireth']);
    expect(p.current).toBeUndefined();
    expect(p.round).toBe(2);
    expect(text(p)).not.toMatch(/Ghoul|Hunched thing|tok-g1|22/);
  });
  it('the PC\'s turn and movement are the same on both sides', () => {
    const p = turnView(enc(1), [pc, ghoul], roster, { restricted: true }), d = turnView(enc(1), [pc, ghoul], roster, { restricted: false });
    expect(p.current).toEqual({ name: 'Ireth', leftFt: 20, speedFt: 30, rangeFt: 60 });
    expect(d.current).toEqual(p.current);
    expect(text(p)).not.toMatch(/Ghoul|Hunched thing/);
  });
  it('revealed copies of one sheet keep their own aliases; the DM sees the sheet names and hit points', () => {
    const order = [{ sheetId: 'cr:ghoul', tokenId: 'tok-g1', init: 17 }, { sheetId: 'cr:ghoul', tokenId: 'tok-g2', init: 14 }, { sheetId: 'pc-1', tokenId: 'tok-pc', init: 12 }];
    const shown = { ...ghoul, hidden: false };
    const p = turnView(enc(0, order), [pc, shown, ghoul2], roster, { restricted: true });
    expect(p.order.map((c) => c.name)).toEqual(['Hunched thing', 'Pale crawler', 'Ireth']);
    expect(p.current?.name).toBe('Hunched thing');
    expect(p.order.every((c) => c.hp === undefined)).toBe(true);
    const d = turnView(enc(0, order), [pc, shown, ghoul2], roster, { restricted: false });
    expect(d.order.map((c) => c.name)).toEqual(['Ghoul', 'Ghoul', 'Ireth']);
    expect(d.order.map((c) => c.hp)).toEqual(['22/22', '9/22', undefined]);
  });
  it('order and state are untouched by the projection', () => {
    const e = enc(0), before = JSON.stringify(e);
    turnView(e, [pc, ghoul], roster, { restricted: true });
    expect(JSON.stringify(e)).toBe(before);
  });
});

// ---- the players' cards over the whole corpus: every room, object, creature and pin as the players read them.
describe('the players\' cards over all 45 scenes and both world maps', () => {
  const DM_ONLY = /data-kind="(monster|creature-type|person|area|pageref|check|dice|spell|magic-item|gear|item)"/;
  const rich = (t: string | undefined, ctx: RichCtx, seen?: Set<string>) => (t ? renderSpans(t, spansFor(t, { ...ctx, edition: '2024' }), seen) : '');
  beforeAll(async () => { await loadBooks(); corpusFields(); }, 60_000);
  afterAll(() => setBookFetcher(null));
  it('carry no DM-only link kind, no DM note, no hidden thing\'s DM label and no hidden creature\'s numbers', () => {
    const bad: string[] = [];
    const stats = new Set(Object.values(STATS).flatMap((s) => [`AC ${s.ac}`, `${s.hp} hp`]));
    let links = 0;
    const check = (where: string, html: string, secrets: string[]) => {
      links += (html.match(/class="rl /g) ?? []).length;
      if (DM_ONLY.test(html)) bad.push(`${where}: ${DM_ONLY.exec(html)![1]} link`);
      for (const k of html.matchAll(/data-kind="([^"]+)"/g)) if (!PLAYER_KINDS.has(k[1] as never)) bad.push(`${where}: ${k[1]}`);
      for (const s of secrets) if (s && s.length >= 12 && html.includes(s)) bad.push(`${where}: DM text "${s.slice(0, 40)}"`);
      for (const s of stats) if (html.includes(s)) bad.push(`${where}: ${s}`);
    };
    let cards = 0;
    for (const { path, scene } of sceneFiles()) for (const l of scene.levels) {
      const opts = { players: true, scenePath: path, levelId: l.id, rich };
      const roomDm = l.rooms.map((r) => r.dm ?? '');
      for (const r of l.rooms) {
        const room = { key: r.key, name: r.name, revealed: true, desc: r.desc, dm: r.dm, page: r.page };
        check(`${path} ${r.key} card`, playersRoomCardHtml(room, opts), roomDm);
        check(`${path} ${r.key} head`, roomHeadHtml(room, opts), roomDm);
        cards += 2;
      }
      for (const o of l.objects) {
        const own = !!(o.label || o.playerLabel || o.desc || o.dm || o.container?.contents);
        const hidden = !!o.vis && o.vis !== 'player';
        const hit = { id: o.id, label: playerLabel(o), playerLabel: playerLabel(o), container: o.container ? { locked: !!o.container.locked, open: true, contents: o.container.contents } : undefined, vis: o.vis ?? 'player', revealed: true, kind: o.kind, desc: playerDesc(o), dm: o.dm, visibleToPlayers: true };
        const html = objectCardHtml(hit, { ...opts, ownWords: own });
        check(`${path} ${o.id}`, html, [o.dm ?? '', ...roomDm, ...(hidden && o.label && o.label !== playerLabel(o) ? [o.label] : [])]);
        cards++;
      }
    }
    for (const e of BESTIARY) { check(`creature ${e.id}`, creatureCardHtml({ id: 't', name: 'Hunched thing', desc: seenAs(e), seenAsOf: e.id }, { players: true, scenePath: '', levelId: '', rich }), []); cards++; }
    for (const { path, world } of worldFiles()) for (const p of world.pins) {
      check(`${path} pin ${p.key}`, rich(p.blurb, { audience: 'player', field: 'blurb', scenePath: path, entityId: `pin:${p.key}` }), [p.dm ?? '']);
      cards++;
    }
    expect(cards).toBeGreaterThan(2000);
    // The players' side does get rules links (a sense, an ability), just never a DM-only one.
    expect(links).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  }, 60_000);
});
