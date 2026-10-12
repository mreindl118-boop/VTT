// The map's cards as HTML: the room tap menu's head, the object card, and the players' room and creature cards. Every
// value is escaped; module words go through the rules links (ui/rich.ts) for the side that reads them: the players'
// cards use the players' audience (conditions, rules, actions, senses, damage types, abilities and skills only), and
// DM notes are never built on the players' side. Pure string builders, so a unit test can hold the escaping.
import type { TapHit } from '../app';
import { ICON } from './icons';
import { rich as richDefault, type RichCtx } from './rich';
import { esc } from './text';

export interface CardOpts {
  /** The players' side reads this card (Players view, or the slider's players' end). */
  players: boolean;
  scenePath: string;
  levelId: string;
  /** The rules-link renderer (tests pass their own). */
  rich?: (text: string | undefined, ctx: RichCtx, seen?: Set<string>) => string;
}

const closeBtn = `<button class="icon close" aria-label="Close" data-tip="Close">${ICON.close}</button>`;
/** A module page reference: an ink link with a solid underline that opens the 'module page' card. */
export const pageref = (page: number | undefined, where?: string): string =>
  page ? `<button type="button" class="rl pageref" data-kind="pageref" data-page="${page}"${where ? ` data-where="${esc(where)}"` : ''} aria-expanded="false">p.${page}</button>` : '';

/** The room tap menu's head: key, name and page (DM), the description, and the DM note (DM only). */
export function roomHeadHtml(r: NonNullable<TapHit['room']>, o: CardOpts): string {
  const R = o.rich ?? richDefault, seen = new Set<string>(), entityId = `room:${o.levelId}/${r.key}`;
  const audience = o.players ? 'player' : 'dm';
  const title = o.players ? esc(r.name) : `<b>${esc(r.key)}</b> ${esc(r.name)}${r.page ? ` <i>${pageref(r.page, `${r.key} · ${r.name}`)}</i>` : ''}`;
  const desc = r.desc ? `<div class="desc">${R(r.desc, { audience, field: 'desc', scenePath: o.scenePath, entityId }, seen)}</div>` : '';
  const dm = !o.players && r.dm ? `<div class="dm"><span class="dm-tag">${ICON.eyeOff}DM only</span>${R(r.dm, { audience: 'dm', field: 'dm', scenePath: o.scenePath, entityId }, seen)}</div>` : '';
  return `<div class="roomhead"><div class="rh-title">${title}</div>${desc}${dm}</div>`;
}

/** The players' read-only room card. */
export function playersRoomCardHtml(r: NonNullable<TapHit['room']>, o: CardOpts): string {
  const R = o.rich ?? richDefault;
  return `<header><div><h2>${esc(r.name)}</h2></div>${closeBtn}</header>${r.desc ? `<div class="body"><div class="desc">${R(r.desc, { audience: 'player', field: 'desc', scenePath: o.scenePath, entityId: `room:${o.levelId}/${r.key}` })}</div></div>` : ''}`;
}

/** The players' look at a creature: its alias and what they make of it (core/identity.ts gave the name). */
export function creatureCardHtml(t: NonNullable<TapHit['token']>, o: CardOpts): string {
  const R = o.rich ?? richDefault;
  const desc = t.desc ? R(t.desc, { audience: 'player', field: 'seenAs', scenePath: 'bestiary', entityId: t.seenAsOf ? `creature:${t.seenAsOf}` : undefined }) : '';
  return `<header><div><h2>${esc(t.name)}</h2></div>${closeBtn}</header>${desc ? `<div class="body"><div class="desc">${desc}</div></div>` : ''}`;
}

export interface ObjectCardOpts extends CardOpts {
  room?: TapHit['room'];
  secretDoor?: TapHit['secretDoor'];
  /** Whether the object has words of its own (else its description is the generic one for its kind). */
  ownWords: boolean;
}

/** The object card: what it is, where, what players see, the DM note, its state and its actions. */
export function objectCardHtml(o: NonNullable<TapHit['object']>, x: ObjectCardOpts): string {
  const R = x.rich ?? richDefault, seen = new Set<string>(), players = x.players;
  const audience = players ? 'player' : 'dm';
  const at = { scenePath: x.scenePath, entityId: o.id };
  const descAt = x.ownWords ? at : { scenePath: 'kinds', entityId: `kind:${o.kind}` };
  const label = players ? (o.playerLabel ?? o.label) : o.label;
  // The DM's title carries its rules links first (a hidden-creature slot's monster, a named spell or item), so the
  // first occurrence on the card is in the title; the players' title stays plain text.
  const title = players ? esc(label) : R(label, { audience: 'dm', field: 'label', ...at }, seen) || esc(label);
  const where = x.room ? `${esc(x.room.key)} · ${esc(x.room.name)}${o.page ? ` · ${pageref(o.page, `${x.room.key} · ${x.room.name}`)}` : ''}` : '';
  const state = players ? '' : o.vis === 'player' ? 'Visible to players when in sight' : `${o.vis.replace('-', ' ')} · ${o.revealed ? 'revealed to players' : o.visibleToPlayers ? 'in players\' view' : 'hidden from players'}`;
  const c = o.container;
  // One inline run (the row is a flex box: a link must not become a line of its own).
  const contents = (t?: string) => `<span class="in-text">${R(t, { audience, field: 'contents', ...at }, seen)}</span>`;
  const inside = !c ? '' : c.open ? `<div class="inside"><b>Inside</b> ${c.contents ? contents(c.contents) : 'Nothing of note.'}</div>`
    : players ? `<div class="inside">${c.locked ? `${ICON.padlock} Locked` : 'Closed'}</div>`
    : `<div class="inside">${c.locked ? `${ICON.padlock} Locked · ` : ''}<span class="in-text">Closed${c.contents ? ` · holds: ${R(c.contents, { audience, field: 'contents', ...at }, seen)}` : ''}</span></div>`;
  const openBtn = c && (!players || !c.locked || c.open) ? `<button class="primary" data-a="open">${c.open ? 'Close' : 'Open'}</button>` : '';
  const desc = o.desc ? `<div class="desc">${R(o.desc, { audience, field: 'desc', ...descAt }, seen)}</div>` : '';
  const seenAs = !players && o.playerLabel && o.playerLabel !== o.label ? `<div class="seen-as">Players see: <b>${esc(o.playerLabel)}</b></div>` : '';
  const dm = !players && o.dm ? `<div class="dm"><span class="dm-tag">${ICON.eyeOff}DM only</span>${R(o.dm, { audience: 'dm', field: 'dm', ...at }, seen)}</div>` : '';
  const acts = players ? (openBtn ? `<div class="actions">${openBtn}</div>` : '')
    : `<div class="actions">${openBtn}${o.vis !== 'player' ? `<button class="${openBtn ? '' : 'primary'}" data-a="reveal">${o.revealed ? 'Hide from players' : 'Reveal to players'}</button>` : ''}${x.room ? `<button data-a="frame">Frame ${esc(x.room.key)}</button>` : ''}${x.secretDoor ? `<button data-a="secret">${x.secretDoor.revealed ? 'Hide secret door' : 'Reveal secret door'}</button>` : ''}</div>`;
  return `<header><div><h2>${title}</h2>${where && !players ? `<div class="where">${where}</div>` : ''}</div>${closeBtn}</header>
        <div class="body">${desc}${seenAs}${dm}${inside}${state ? `<div class="state">${esc(state)}</div>` : ''}</div>
        ${acts}`;
}
