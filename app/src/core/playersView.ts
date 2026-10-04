// What the players' side may receive. Every CampaignState key is classified here: 'player' keys travel to the
// Player Display, 'dm' keys never leave the DM's window. The record is typed against CampaignState, so a new key
// without a classification fails the build (tsc), and tests/player-safety.test.ts checks the source as well.
import type { CampaignState } from '../state/campaign';

export type KeyClass = 'player' | 'dm';

export const KEY_CLASS = {
  id: 'player', // which campaign the display is showing
  name: 'dm', // the DM's label for the save
  reveals: 'player', // what the players have been shown
  tokens: 'player', // markers on the map (hidden ones are not drawn on the players' side)
  seen: 'player', // explored memory, drawn as remembered rooms
  doorsOpen: 'player',
  opened: 'player',
  world: 'player', // where the party stands on the world map
  worldRevealed: 'player',
  clock: 'player', // drives the sky and light
  roster: 'player', // the current combatant's speed and reach drive the range overlay
  encounter: 'player', // turn order and movement spent this turn
  updatedAt: 'dm', // bookkeeping for saves and backups
} as const satisfies { readonly [K in keyof Required<CampaignState>]: KeyClass };

export const PLAYER_KEYS = (Object.keys(KEY_CLASS) as (keyof CampaignState)[]).filter((k) => KEY_CLASS[k] === 'player');
export const DM_KEYS = (Object.keys(KEY_CLASS) as (keyof CampaignState)[]).filter((k) => KEY_CLASS[k] === 'dm');

type PlayerKey = { [K in keyof CampaignState]-?: (typeof KEY_CLASS)[K] extends 'player' ? K : never }[keyof CampaignState];
/** The players' share of the campaign: every key classified 'player', nothing else. */
export type PlayersState = Pick<CampaignState, PlayerKey>;

/** Keys present on a state object that have no classification (a new field someone forgot to classify). */
export function unclassifiedKeys(state: object): string[] {
  return Object.keys(state).filter((k) => !(k in KEY_CLASS));
}

/** Copy only the 'player' keys. Unknown keys are dropped: a field reaches the players only once it is classified. */
export function projectState(state: CampaignState): PlayersState {
  const out: Record<string, unknown> = {};
  for (const k of PLAYER_KEYS) if (state[k] !== undefined) out[k] = state[k];
  return out as PlayersState;
}
