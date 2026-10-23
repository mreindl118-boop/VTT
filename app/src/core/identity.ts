// Who a token is to the players: the one alias and visibility projection every players'-side string that names a
// token goes through (map labels, the hover tip, the players' creature card, the turn bar and toasts). The DM side
// keeps full names. A hidden creature does not exist for the players; a revealed one goes by its own token's alias
// (so two copies of one sheet keep their own names), never by its real or sheet name.
import { aliasFor, creatureById } from '../bestiary';
import type { Encounter, Sheet, Token } from '../state/campaign';

export interface FacingCtx {
  /** The players' side: Players view, the Player Display, or the slider's players' end (t = 0). */
  restricted: boolean;
}
export interface Facing { visible: boolean; name?: string }

/** What a token is called on this side, and whether it is there at all. */
export function playerFacing(t: Token | undefined, ctx: FacingCtx): Facing {
  if (!t) return { visible: !ctx.restricted };
  if (!ctx.restricted || t.role !== 'creature') return { visible: true, name: t.name };
  if (t.hidden) return { visible: false };
  const e = t.creatureId ? creatureById(t.creatureId) : undefined;
  return { visible: true, name: t.playerName?.trim() || (e ? aliasFor(e) : '') || 'Creature' };
}

/** One chip of the turn bar's order. */
export interface TurnChip { name: string; init: number; now: boolean; color: string; tokenId: string; hp?: string }
/** The turn bar as one side reads it. */
export interface TurnView {
  order: TurnChip[];
  round: number;
  /** The current combatant's line, or nothing past 'Round N' (a hidden combatant's turn on the players' side). */
  current?: { name: string; leftFt: number; speedFt: number; rangeFt: number };
}

/**
 * The turn bar's content for one side. Order and state are untouched: on the players' side hidden combatants are
 * left out of the order, the others go by their own token's alias, and a hidden combatant's turn shows only the round.
 */
export function turnView(e: Encounter, tokens: Token[], roster: Sheet[], ctx: FacingCtx): TurnView {
  const now = e.order.length ? e.turn % e.order.length : -1;
  const order: TurnChip[] = [];
  e.order.forEach((c, i) => {
    const s = roster.find((x) => x.id === c.sheetId), t = tokens.find((x) => x.id === c.tokenId);
    const f = ctx.restricted && (!t || t.role === 'creature') ? playerFacing(t, ctx) : { visible: true, name: s?.name };
    if (!f.visible) return;
    order.push({ name: f.name ?? s?.name ?? '?', init: c.init, now: i === now, color: s?.color ?? '#999', tokenId: c.tokenId, hp: !ctx.restricted && t?.hp ? `${t.hp.cur}/${t.hp.max}` : undefined });
  });
  const cur = now >= 0 ? e.order[now] : undefined;
  const sheet = cur && roster.find((x) => x.id === cur.sheetId), tok = cur && tokens.find((x) => x.id === cur.tokenId);
  let current: TurnView['current'];
  if (cur && sheet && tok) {
    const f = ctx.restricted && tok.role === 'creature' ? playerFacing(tok, ctx) : { visible: true, name: sheet.name };
    if (f.visible) current = { name: f.name ?? sheet.name, leftFt: Math.max(0, sheet.speedFt - e.movedFt), speedFt: sheet.speedFt, rangeFt: sheet.rangeFt };
  }
  return { order, round: e.round, current };
}
