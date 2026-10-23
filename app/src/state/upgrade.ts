// How old saves keep working (docs/PLAYABILITY.md 5.2). app.ts loads a save as a merge over a fresh campaign
// ({ ...newCampaign(id), ...saved }); upgradeCampaign runs right after it. It never deletes or renames anything, keeps
// keys it does not know, and running it twice changes nothing. In release 1a it adds only the table settings; the
// readers below give the fields later releases add their 0.3.x meaning when a save does not have them.
import type { FightPhase } from '../core/encounter';
import type { CampaignState, Encounter, Sheet } from './campaign';

/** The table settings (plan 5.1, the campaign's `table`; class "player"). It grows with the releases that use it. */
export interface TableSettings {
  /** The party's way on a map it arrives on: one marker (false) or one figure per character (true). The campaign
   *  remembers the last choice; the default stays together (decision 3). */
  apart: boolean;
  /** The players' Done ends their turn at once; false: the DM confirms it (decision 9). */
  playersEndTurns: boolean;
  /** Outside a fight too, the players open doors and containers only within 5 ft of a character (decision 6). */
  doorsWithin5Ft: boolean;
  /** Play paused: everyone on the players' side frozen (release 3). */
  paused: boolean;
  /** "Players may move on the Player map" (release 4). */
  playerMapInput: boolean;
  /** Surprise: follow the app's Rules edition, or the 2024 rule (Disadvantage) always (decision 11). */
  surprise: 'edition' | '2024';
  /** What End shows: the fight's XP and each share, or nothing under milestone (decision 15). */
  award: 'milestone' | 'xp';
  /** The maps' flagged difficult ground counts double on the green squares (decision 17). */
  difficultFlags: boolean;
}

/** Each setting's default: today's behaviour, or the plan's recommended answer where the setting is new. */
export const TABLE_DEFAULTS: Readonly<TableSettings> = Object.freeze({
  apart: false, playersEndTurns: true, doorsWithin5Ft: false, paused: false, playerMapInput: false, surprise: 'edition', award: 'milestone', difficultFlags: false,
});

/** The values a setting may hold (anything else reads as its default). */
const CHOICES: { readonly [K in keyof TableSettings]: readonly TableSettings[K][] } = {
  apart: [false, true], playersEndTurns: [true, false], doorsWithin5Ft: [false, true], paused: [false, true], playerMapInput: [false, true],
  surprise: ['edition', '2024'], award: ['milestone', 'xp'], difficultFlags: [false, true],
};
const KEYS = Object.keys(TABLE_DEFAULTS) as (keyof TableSettings)[];

const isPlain = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** A loaded save after the upgrade: everything it held, plus the table settings. */
export type Upgraded<T extends CampaignState = CampaignState> = T & { table: TableSettings };

/**
 * Bring a loaded save up to this build: the table settings added with their defaults, a setting the save lacks filled
 * in. Nothing it holds is deleted, renamed or overwritten (a value another build wrote is kept as it stands, so read the
 * settings through tableSettings), keys it does not know are kept, and upgrading an upgraded save changes nothing. A new
 * object; the save itself is not changed.
 */
export function upgradeCampaign<T extends CampaignState>(saved: T): Upgraded<T> {
  const had = (saved as { table?: unknown }).table;
  let table: unknown = had;
  if (had === undefined) table = { ...TABLE_DEFAULTS };
  else if (isPlain(had) && KEYS.some((k) => had[k] === undefined)) {
    const filled: Record<string, unknown> = { ...had };
    for (const k of KEYS) if (filled[k] === undefined) filled[k] = TABLE_DEFAULTS[k];
    table = filled;
  }
  return { ...saved, table } as Upgraded<T>;
}

/** The table settings as this build reads them: each one the save holds when it is a value this build knows, else its
 *  default. Never writes. */
export function tableSettings(s: { table?: unknown }): TableSettings {
  const t = isPlain(s.table) ? s.table : {};
  const out = { ...TABLE_DEFAULTS } as Record<keyof TableSettings, unknown>;
  for (const k of KEYS) if ((CHOICES[k] as readonly unknown[]).includes(t[k])) out[k] = t[k];
  return out as TableSettings;
}

/** A fight's phase (release 3 writes `phase`): a fight saved without one, every 0.3.x fight, is running. */
export function fightPhase(e: Encounter): FightPhase {
  const p = (e as { phase?: unknown }).phase;
  return p === 'called' || p === 'paused' ? p : 'running';
}

/** How the party stood when the fight began (release 1b writes `startedAs`): every 0.3.x fight began from a marker, so
 *  one saved without it began together, and End gathers. */
export function startedAs(e: Encounter): 'together' | 'apart' {
  return (e as { startedAs?: unknown }).startedAs === 'apart' ? 'apart' : 'together';
}

/** A character at the table tonight (release 1b writes the row's `present`): a row saved without it is. */
export const isPresent = (s: Sheet): boolean => (s as { present?: unknown }).present !== false;

/** A character the DM runs for an absent player (release 1b writes the row's `dmRuns`): a row saved without it is not. */
export const isDmRun = (s: Sheet): boolean => (s as { dmRuns?: unknown }).dmRuns === true;
