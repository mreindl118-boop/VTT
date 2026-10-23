// How old saves keep working (docs/PLAYABILITY.md 5.2). app.ts loads a save as a merge over a fresh campaign
// ({ ...newCampaign(id), ...saved }); upgradeCampaign runs right after it. It never deletes or renames anything, keeps
// keys it does not know, and running it twice changes nothing. In release 1a it adds nothing: the table settings are
// read through tableSettings, which gives each one the DM has not set its default, so no default is ever written into
// a save (a default changed later reaches every campaign, and "the DM chose it" never looks like "it was filled in").
// The readers below give the fields later releases add their 0.3.x meaning when a save does not have them.
import type { FightPhase } from '../core/encounter';
import type { CampaignState, Encounter, Sheet } from './campaign';

/** The table settings (plan 5.1, the campaign's `table`; class "player"): only what the DM has set is saved. It grows
 *  with the releases that use it: each later setting (5 ft for doors, pause, the Player map's input, surprise, XP or
 *  milestone, difficult ground) arrives with its release and the answer to its decision. */
export interface TableSettings {
  /** The party's way on a map it arrives on: one marker (false) or one figure per character (true). The campaign
   *  remembers the last choice; the default stays together, today's game (decision 3; release 1b). */
  apart: boolean;
  /** The players' Done ends their turn at once; false: the DM confirms it (release 1a's Done). The default is the plan's
   *  recommended answer to decision 9, which Matt has not answered yet: it is read, never saved, so his answer reaches
   *  every campaign. */
  playersEndTurns: boolean;
}

/** Each setting's default: today's game, or the plan's recommended answer where the setting is new. Never written into
 *  a save. */
export const TABLE_DEFAULTS: Readonly<TableSettings> = Object.freeze({ apart: false, playersEndTurns: true });

/** The values a setting may hold (anything else reads as its default). */
const CHOICES: { readonly [K in keyof TableSettings]: readonly TableSettings[K][] } = {
  apart: [false, true], playersEndTurns: [true, false],
};
const KEYS = Object.keys(TABLE_DEFAULTS) as (keyof TableSettings)[];

const isPlain = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/**
 * Bring a loaded save up to this build. Release 1a adds nothing to it: a save without `table` keeps none (its settings
 * read as their defaults), and a `table` it holds is kept exactly as it stands, values another build wrote and keys
 * this build does not know included (read the settings through tableSettings). Nothing is deleted, renamed or
 * overwritten, keys it does not know are kept, and upgrading an upgraded save changes nothing. A new object; the save
 * itself is not changed. Later releases fill their own fields here, never a default.
 */
export function upgradeCampaign<T extends CampaignState>(saved: T): T {
  return { ...saved };
}

/** The table settings as this build reads them from a campaign (any object with an optional `table`): each one the save
 *  holds when it is a value this build knows, else its default. Never writes. */
export function tableSettings(s: object): TableSettings {
  const held = (s as { table?: unknown }).table, t = isPlain(held) ? held : {};
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
