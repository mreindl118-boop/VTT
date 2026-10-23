// Old saves keep working (docs/PLAYABILITY.md 5.2 and 5.4): app/src/state/upgrade.ts over three invented 0.3.4 saves in
// tests/fixtures/ (never taken from a real profile): markers on three maps and no fight; a fight with two characters
// and a hidden ghoul in the order and a wolf outside it; a map that lost its party (only creatures stand there).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fightPhase, isDmRun, isPresent, startedAs, TABLE_DEFAULTS, tableSettings, upgradeCampaign } from '../app/src/state/upgrade';
import { newCampaign, type CampaignState, type Encounter, type Sheet, type Token } from '../app/src/state/campaign';
import { currentCombatant, foldAtEnd, isMarker, needsPartyMarker, partyMarker, partyOf, tokenKind } from '../app/src/core/encounter';
import { canMove, WORDS } from '../app/src/core/permissions';

const fixture = (name: string): CampaignState => JSON.parse(readFileSync(`tests/fixtures/${name}.json`, 'utf8')) as CampaignState;
const FIXTURES = ['save-0.3.4-markers', 'save-0.3.4-mid-fight', 'save-0.3.4-lost-party'];
/** What app.ts does on load (app.ts:209-210), then the upgrade. */
const load = (saved: CampaignState) => upgradeCampaign({ ...newCampaign(saved.id), ...saved });
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// ---- copies of today's code (app.ts at 6ff4121): the current getter and End's token fold
const todayCurrent = (e: Encounter, tokens: Token[], roster: Sheet[]) => {
  if (!e || !e.order.length) return undefined;
  const c = e.order[e.turn % e.order.length], s = roster.find((x) => x.id === c.sheetId), t = tokens.find((x) => x.id === c.tokenId);
  return s && t ? { c, sheet: s, token: t } : undefined;
};
const todayEnd = (tokensIn: Token[], e: Encounter): Token[] => {
  const loc = e.location, members = tokensIn.filter((t) => t.role === 'member' && t.location === loc), lead = members[0];
  const tokens = tokensIn.filter((t) => !(t.role === 'member' && t.location === loc));
  if (!tokens.some((t) => t.location === loc)) tokens.push({ id: `pc-${loc}`, name: 'Party', location: loc, level: lead?.level ?? e.level, pos: lead?.pos ?? e.partyPos, size: 'medium', darkvisionFt: 0, color: '#c0392b', light: { bright: 20, dim: 40 }, role: 'party' });
  return tokens;
};

describe('the fixtures', () => {
  it('are 0.3.4 saves: only the roles party, member and creature, and a fight keeps its partyPos (item 5\'s save checker requires both)', () => {
    for (const name of FIXTURES) {
      const s = fixture(name);
      for (const t of s.tokens) expect(['party', 'member', 'creature'], `${name} ${t.id}`).toContain(t.role);
      if (s.encounter) expect(s.encounter.partyPos, name).toHaveLength(2);
      expect((s as { table?: unknown }).table, name).toBeUndefined();
    }
    expect(fixture('save-0.3.4-mid-fight').encounter).toBeDefined();
  });
});

describe('upgradeCampaign', () => {
  it('keeps every 0.3.4 field deep-equal, adds only the table settings with their defaults, and changes nothing it was given', () => {
    for (const name of FIXTURES) {
      const saved = fixture(name), before = clone(saved), up = load(saved);
      for (const k of Object.keys(saved) as (keyof CampaignState)[]) expect(up[k], `${name}.${k}`).toEqual(saved[k]);
      expect(Object.keys(up).filter((k) => !(k in saved) && !(k in newCampaign()))).toEqual(['table']);
      expect(up.table).toEqual(TABLE_DEFAULTS);
      expect(saved).toEqual(before);
    }
  });
  it('is idempotent', () => {
    for (const name of FIXTURES) {
      const once = load(fixture(name));
      expect(upgradeCampaign(once), name).toEqual(once);
      expect(JSON.stringify(upgradeCampaign(upgradeCampaign(once))), name).toBe(JSON.stringify(once));
    }
  });
  it('never deletes, renames or overwrites: unknown keys stay, a table it holds keeps its values and gains only what it lacks', () => {
    const saved = { ...fixture('save-0.3.4-markers'), fromLater: { a: [1, 2] }, table: { apart: true, award: 'xp', someLaterSetting: 3 } } as CampaignState;
    const up = upgradeCampaign(saved);
    expect((up as unknown as { fromLater: unknown }).fromLater).toEqual({ a: [1, 2] });
    expect(up.table).toEqual({ ...TABLE_DEFAULTS, apart: true, award: 'xp', someLaterSetting: 3 });
    expect(up.tokens).toEqual(saved.tokens);
    // a value this build does not know is kept as it stands, and read as its default
    const odd = upgradeCampaign({ ...fixture('save-0.3.4-markers'), table: { apart: 'yes', surprise: '2014' } } as unknown as CampaignState);
    expect(odd.table).toMatchObject({ apart: 'yes', surprise: '2014' });
    expect(tableSettings(odd)).toEqual(TABLE_DEFAULTS);
    expect(tableSettings({ table: { apart: true, surprise: '2024', award: 'xp', doorsWithin5Ft: true } })).toEqual({ ...TABLE_DEFAULTS, apart: true, surprise: '2024', award: 'xp', doorsWithin5Ft: true });
    expect(tableSettings({})).toEqual(TABLE_DEFAULTS);
  });
  it('the defaults keep today\'s game: together, no pause, no 5-ft rule for doors, the Player map takes no input', () => {
    expect(TABLE_DEFAULTS).toEqual({ apart: false, playersEndTurns: true, doorsWithin5Ft: false, paused: false, playerMapInput: false, surprise: 'edition', award: 'milestone', difficultFlags: false });
  });
});

describe('the readers of fields later releases add', () => {
  const e = fixture('save-0.3.4-mid-fight').encounter!;
  it('a fight saved without a phase is running; without startedAs, it began together', () => {
    expect(fightPhase(e)).toBe('running');
    expect(startedAs(e)).toBe('together');
    expect(fightPhase({ ...e, phase: 'called' } as Encounter)).toBe('called');
    expect(fightPhase({ ...e, phase: 'paused' } as Encounter)).toBe('paused');
    expect(fightPhase({ ...e, phase: 'later' } as Encounter)).toBe('running');
    expect(startedAs({ ...e, startedAs: 'apart' } as Encounter)).toBe('apart');
  });
  it('a row saved without present is at the table, and without dmRuns the players run it', () => {
    const row = fixture('save-0.3.4-markers').roster[0];
    expect([isPresent(row), isDmRun(row)]).toEqual([true, false]);
    expect([isPresent({ ...row, present: false } as Sheet), isDmRun({ ...row, dmRuns: true } as Sheet)]).toEqual([false, true]);
  });
});

describe('a 0.3.4 save with no fight: markers on three maps', () => {
  it('loads as it was: each map keeps its one marker, the party of each map is its marker, no map needs one', () => {
    const up = load(fixture('save-0.3.4-markers'));
    expect(up.encounter).toBeUndefined();
    for (const loc of ['death-house', 'E', 'N']) {
      expect(up.tokens.filter((t) => t.location === loc && isMarker(t)), loc).toHaveLength(1);
      expect(partyOf(up.tokens, up.roster, loc)?.id, loc).toBe(`pc-${loc}`);
      expect(needsPartyMarker(up.tokens, up.roster, loc, up.encounter), loc).toBe(false);
    }
    expect(partyOf(up.tokens, up.roster, 'E')?.role).toBe('party'); // not the hidden wolf standing on the same map
  });
});

describe('a 0.3.4 save in the middle of a fight', () => {
  const saved = fixture('save-0.3.4-mid-fight'), up = load(saved), e = up.encounter!;
  const ghoul = up.tokens.find((t) => t.creatureId === 'ghoul')!, wolf = up.tokens.find((t) => t.creatureId === 'wolf')!;
  it('loads running, with the same current turn as today (the hidden ghoul\'s, 10 ft spent)', () => {
    expect(fightPhase(e)).toBe('running');
    expect(currentCombatant(e, up.tokens, up.roster)).toEqual(todayCurrent(saved.encounter!, saved.tokens, saved.roster));
    expect(currentCombatant(e, up.tokens, up.roster)?.token).toEqual(ghoul);
    expect(e.movedFt).toBe(10);
  });
  it('the players are refused on the ghoul\'s turn: their characters wait, the ghoul is the DM\'s', () => {
    const cur = currentCombatant(e, up.tokens, up.roster)!;
    for (const t of up.tokens.filter((x) => x.location === e.location)) {
      const v = canMove({ actor: 'players', phase: fightPhase(e), kind: tokenKind(t, up.roster), name: t.name, inOrder: e.order.some((c) => c.tokenId === t.id), current: t.id === cur.token.id, moveCell: { costFt: 5 } });
      expect(v.ok, t.id).toBe(false);
      expect(v.ok ? '' : v.reason, t.id).toBe(t.role === 'creature' ? WORDS.dmMoves : WORDS.notYourTurn);
    }
  });
  it('the party is a character, never the ghoul standing first; the map needs no marker while the fight runs', () => {
    expect(partyOf(up.tokens, up.roster, 'death-house')?.id).toBe('tok-death-house-pc-2');
    expect(needsPartyMarker(up.tokens, up.roster, 'death-house', e)).toBe(false);
  });
  it('the DM removed both characters (today Remove deletes their tokens): no marker at the map\'s start mid-fight; End puts it where the party stood', () => {
    const left = up.tokens.filter((t) => t.role !== 'member'), ghoulOnly = { ...e, order: e.order.filter((c) => c.tokenId === ghoul.id), turn: 0 };
    expect(needsPartyMarker(left, up.roster, 'death-house', ghoulOnly)).toBe(false);
    expect(foldAtEnd(left, ghoulOnly, up.roster).marker).toEqual(partyMarker('death-house', 'f1', [32.5, 17.5]));
  });
  it('End (it began together) gives one marker and leaves the wolf and the ghoul as they were; today it loses the party', () => {
    expect(startedAs(e)).toBe('together');
    const out = foldAtEnd(up.tokens, e, up.roster), here = out.tokens.filter((t) => t.location === 'death-house');
    expect(here.filter(isMarker)).toEqual([partyMarker('death-house', 'f1', [27.5, 17.5])]);
    expect(here.filter((t) => !isMarker(t))).toEqual([wolf, ghoul]);
    expect(out.tokens.find((t) => t.id === 'pc-E')).toEqual(saved.tokens.find((t) => t.id === 'pc-E'));
    expect(todayEnd(clone(saved.tokens), saved.encounter!).filter((t) => t.location === 'death-house' && isMarker(t))).toEqual([]);
  });
});

describe('a 0.3.4 save whose map lost its party', () => {
  it('the map needs a marker (today ensureDefaultToken gives up on the creatures standing there); the other map does not', () => {
    const up = load(fixture('save-0.3.4-lost-party'));
    expect(up.tokens.filter((t) => t.location === 'death-house').every((t) => t.role === 'creature')).toBe(true);
    expect(needsPartyMarker(up.tokens, up.roster, 'death-house', up.encounter)).toBe(true);
    expect(partyOf(up.tokens, up.roster, 'death-house')).toBeUndefined();
    expect(up.tokens.some((t) => t.location === 'death-house')).toBe(true); // today's test: "a token stands there", so no marker
    expect(needsPartyMarker(up.tokens, up.roster, 'E', up.encounter)).toBe(false);
  });
});
