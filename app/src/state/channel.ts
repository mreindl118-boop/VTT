// DM window <-> Player Display. The DM's slider value is never sent.
import type { CampaignState } from './campaign';

export type Msg =
  | { kind: 'hello' }
  | { kind: 'state'; state: CampaignState; location: string; level: string }
  | { kind: 'camera'; pos: [number, number, number]; target: [number, number, number]; locked: boolean }
  | { kind: 'layout'; grid: 'square' | 'hex'; gridOn: boolean; lowWalls: boolean; cut?: number };

export class Channel {
  private bc: BroadcastChannel | null;
  constructor(onMsg: (m: Msg) => void) {
    this.bc = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('mistlab');
    if (this.bc) this.bc.onmessage = (e) => onMsg(e.data as Msg);
  }
  send(m: Msg): void { this.bc?.postMessage(m); }
}
