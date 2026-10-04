// DM window <-> Player Display. The DM's slider value is never sent, and a 'state' message carries only the
// players' projection of the campaign (core/playersView.ts): DM-only keys never reach the display.
import type { CampaignState } from './campaign';
import { projectState, type PlayersState } from '../core/playersView';

export type Msg =
  | { kind: 'hello' }
  | { kind: 'state'; state: PlayersState; location: string; level: string; fresh?: boolean }
  | { kind: 'camera'; pos: [number, number, number]; target: [number, number, number]; locked: boolean }
  | { kind: 'layout'; grid: 'square' | 'hex'; gridOn: boolean; lowWalls: boolean; cut?: number; fog?: boolean };

/** What a caller may hand to send(): a 'state' message may carry the full campaign; it is projected here. */
export type OutMsg = Exclude<Msg, { kind: 'state' }> | { kind: 'state'; state: CampaignState | PlayersState; location: string; level: string; fresh?: boolean };

export class Channel {
  private bc: BroadcastChannel | null;
  constructor(onMsg: (m: Msg) => void) {
    this.bc = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('mistlab');
    if (this.bc) this.bc.onmessage = (e) => onMsg(e.data as Msg);
  }
  send(m: OutMsg): void {
    if (m.kind === 'state') m = { ...m, state: projectState(m.state as CampaignState) };
    this.bc?.postMessage(m);
  }
}
