// The rules card (tier B, docs/CLARITY.md and docs/THEME.md '.rt'): a parchment page card with a stripe in the
// family colour, an emblem and the exact kicker word, the name in Alegreya SC, a key-stats row, a ruled divider, a
// short body with 'More', and a footer with the source, the edition toggle and 'Open in Books' (DM). Monsters get the
// stat block. Loaded on demand with the books code; the tooltip manager owns placement and dismissal.
import './rulecard.css';
import { EDITION_EVENT, lookup, rulesEdition, type Edition, type RuleEntry } from '../books/lookup';
import type { ConditionSummary, ItemSummary, MonsterSummary, SpellSummary } from '../books/types';
import { emblem, ensureEmblems } from './emblems';
import { kickerOf, kindInfo, kindOf, PLAYER_KINDS, rarityOf, type RuleKind } from './kinds';
import { hasMore, moduleStatsHtml, monsterMeta, statblockHtml } from './statblock';
import { clampWords, esc } from './text';

const line = (d: string) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = { close: line('<path d="M6 6l12 12M18 6L6 18"/>'), back: line('<path d="M15 5l-7 7 7 7"/>'), pin: line('<path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 13v7"/>') };

/** Cards that are not books entries: built from the module and the table (DM only). */
export type Structural =
  | { kind: 'check'; dc: number; ability?: string; skill?: string; passive?: number }
  | { kind: 'dice'; expr: string }
  | { kind: 'area'; key: string; name: string; floor?: string; revealed?: boolean; desc?: string; page?: number }
  | { kind: 'person'; name: string; role?: string; home?: string }
  | { kind: 'pageref'; page: number; where?: string };
/** A monster the books do not have: the module's own numbers, under 'Module stats'. */
export interface ModuleMonster { kind: 'module-monster'; name: string; stats?: { ac: number; hp: number; speed: string; cr: string }; srd: boolean }
/** What a card shows: a books entry (by term or id, or already looked up), or a structural card. */
export type CardSpec = { term: string; kind?: RuleKind; entry?: RuleEntry } | Structural | ModuleMonster;

export interface CardCtx {
  /** Players' side: only PLAYER_KINDS cards exist, and nothing DM-only is built. */
  restricted: boolean;
  /** The card was opened by a tap or a click (pinned) rather than by hover. */
  pinned: boolean;
  /** The last pointer was touch: larger body text. */
  touch: boolean;
  /** A back chevron (the card replaced an earlier one). */
  canBack: boolean;
  /** The manager's actions. */
  close(): void; pin(): void; back(): void;
  /** Show another spec in this card (edition toggle: `push` false; nested link: true). */
  show(spec: CardSpec, push: boolean): void;
}

const isStructural = (s: CardSpec): s is Structural => 'kind' in s && ['check', 'dice', 'area', 'person', 'pageref'].includes(s.kind as string) && !('term' in s);
let uid = 0;

/** Build the card for a spec, or nothing when the audience may not see it. */
export async function buildCard(spec: CardSpec, ctx: CardCtx): Promise<HTMLElement | null> {
  ensureEmblems();
  if ('kind' in spec && spec.kind === 'module-monster') return ctx.restricted ? null : moduleCard(spec, ctx);
  if (isStructural(spec)) return ctx.restricted ? null : structuralCard(spec, ctx);
  const pref = rulesEdition();
  const entry = spec.entry ?? await lookup(spec.term, pref, { fallback: true, type: spec.kind && spec.kind !== 'sense' && spec.kind !== 'action' && spec.kind !== 'magic-item' && spec.kind !== 'gear' ? spec.kind as RuleEntry['type'] : undefined });
  if (!entry) return null;
  const kind = kindOf(entry);
  if (ctx.restricted && !PLAYER_KINDS.has(kind)) return null;
  return entryCard(entry, kind, pref, ctx);
}

function shell(kind: RuleKind, extraCls: string, kicker: string, title: string, ctx: CardCtx, dm: boolean): { el: HTMLElement; id: string } {
  const k = kindInfo(kind), id = `rt-h-${++uid}`;
  const el = document.createElement('div');
  el.className = `rt ${k.cls}${extraCls ? ` ${extraCls}` : ''}${ctx.touch ? ' touch' : ''}`;
  el.dataset.kind = kind;
  el.setAttribute('role', 'dialog');
  el.tabIndex = -1;
  el.setAttribute('aria-labelledby', id);
  el.innerHTML = `<span class="grab" aria-hidden="true"></span><div class="kick">${ctx.canBack ? `<button type="button" class="back" data-a="back" aria-label="Back">${I.back}</button>` : ''}${emblem(k.emblem)}<span class="w">${esc(kicker)}</span>${dm ? '<span class="seal" role="img" aria-label="DM only">DM</span>' : ''}${ctx.pinned ? `<button type="button" data-a="close" aria-label="Close">${I.close}</button>` : ''}</div><h4 id="${id}">${esc(title)}</h4>`;
  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-a]'); if (!b || !el.contains(b)) return;
    if (b.dataset.a === 'close') ctx.close();
    if (b.dataset.a === 'back') ctx.back();
    if (b.dataset.a === 'pin') ctx.pin();
  });
  return { el, id };
}

const stats = (cells: [string, string | undefined | null][]): string => {
  const c = cells.filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '');
  return c.length ? `<dl class="stats">${c.map(([l, v]) => `<div><dt>${esc(l)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : '';
};

const pinBtn = (ctx: CardCtx) => (ctx.pinned ? '' : `<button type="button" class="pin" data-a="pin" aria-label="Pin this card">${I.pin}</button>`);

function entryCard(e: RuleEntry, kind: RuleKind, pref: Edition, ctx: CardCtx): HTMLElement {
  const rar = kind === 'magic-item' ? rarityOf(e) : '';
  const monster = kind === 'monster';
  const { el } = shell(kind, rar, kickerOf(e, e.edition), e.name, ctx, monster && !ctx.restricted);
  const s = e.summary as Record<string, unknown>;
  let meta = '', row = '', tags = '';
  if (kind === 'spell') {
    const sp = s as unknown as SpellSummary;
    row = stats([['casting time', sp.castingTime], ['range', sp.range], ['components', sp.components], ['duration', sp.duration]]);
    tags = sp.concentration || sp.ritual ? `<div class="tags">${sp.concentration ? '<span role="img" aria-label="Concentration">C</span>' : ''}${sp.ritual ? '<span role="img" aria-label="Ritual">R</span>' : ''}</div>` : '';
  } else if (kind === 'magic-item' || kind === 'gear' || kind === 'item') {
    const it = s as unknown as ItemSummary;
    meta = [it.category, it.attunement ? 'attunement' : ''].filter(Boolean).join(' · ');
    row = kind === 'magic-item'
      ? stats([['rarity', it.rarity ? String(it.rarity).toLowerCase() : undefined], ['attunement', it.attunement === true ? 'required' : typeof it.attunement === 'string' ? it.attunement : undefined], ['cost', it.cost], ['weight', it.weight]])
      : stats([['cost', it.cost], ['weight', it.weight], ['damage', it.damage], ['armor class', it.ac], ['mastery', it.mastery]]);
  } else if (monster) {
    meta = monsterMeta(s as unknown as MonsterSummary);
  }
  if (meta) el.insertAdjacentHTML('beforeend', `<p class="meta">${esc(meta.split(' ').slice(0, 6).join(' '))}</p>`);
  el.insertAdjacentHTML('beforeend', row + tags);
  const body = document.createElement('div');
  body.className = 'body';
  let more = false;
  if (monster) {
    body.innerHTML = statblockHtml(s as unknown as MonsterSummary, e.html, false);
    more = hasMore(e.html);
  } else {
    el.insertAdjacentHTML('beforeend', '<hr class="taper">');
    const effects = kind === 'condition' ? (s as unknown as ConditionSummary).effects ?? [] : [];
    if (effects.length) {
      body.innerHTML = `${e.text ? `<p>${esc(clampWords(e.text, 60).text)}</p>` : ''}<ul>${effects.slice(0, 5).map((x) => { const m = /^([^.]{1,40}\.)\s+(.*)$/s.exec(x); return `<li>${m ? `<b>${esc(m[1])}</b> ${esc(clampWords(m[2], 24).text)}` : esc(clampWords(x, 24).text)}</li>`; }).join('')}</ul>`;
      more = effects.length > 5 || effects.some((x) => x.split(/\s+/).length > 26);
    } else {
      const c = clampWords(e.text || '', 60);
      body.innerHTML = c.text ? `<p>${esc(c.text)}</p>` : '';
      more = c.cut || (!!e.html && e.html.replace(/<[^>]+>/g, '').trim().length > (e.text || '').length + 20);
    }
  }
  el.appendChild(body);
  if (more) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'more'; b.textContent = 'More'; b.setAttribute('aria-expanded', 'false');
    b.addEventListener('click', () => {
      // The full entry, from our generated books data, in place; the card scrolls inside its own box.
      body.innerHTML = monster ? statblockHtml(s as unknown as MonsterSummary, e.html, true) : e.html;
      b.remove();
    });
    el.appendChild(b);
  }
  const other: Edition = e.edition === '2024' ? '2014' : '2024';
  const only = e.edition !== pref;
  const foot = document.createElement('div');
  foot.className = 'src';
  foot.innerHTML = `<span class="who">${e.edition} · ${e.book === 'srd-5.2.1' ? 'SRD 5.2.1' : 'SRD 5.1'} · CC BY 4.0</span>${only ? `<span class="only">⚠ ${e.edition} only</span>` : ''}<span class="ed"></span><span class="gap"></span>${ctx.restricted ? '' : `<a href="${esc(e.section.href)}" data-books>Open in Books ›</a>`}${pinBtn(ctx)}`;
  el.appendChild(foot);
  foot.querySelector('[data-books]')?.addEventListener('click', () => ctx.close());
  // The other edition's wording, when it has this entry and it differs.
  if (!only) void lookup(e.id, other).then((o) => {
    if (!o || (o.text === e.text && o.html === e.html) || !el.isConnected) return;
    const slot = foot.querySelector('.ed')!;
    slot.innerHTML = `<button type="button">See ${other}</button>`;
    slot.querySelector('button')!.addEventListener('click', () => ctx.show({ term: o.id, entry: o }, false));
  });
  // A change of the Rules edition preference re-renders an open card in the new edition.
  const onEd = () => { if (!el.isConnected) return removeEventListener(EDITION_EVENT, onEd); ctx.show({ term: e.id, kind }, false); };
  addEventListener(EDITION_EVENT, onEd);
  return el;
}

function structuralCard(s: Structural, ctx: CardCtx): HTMLElement {
  let kicker: string = kindInfo(s.kind).word, title = '', row = '', body = '';
  switch (s.kind) {
    case 'check': {
      kicker = `check · DC ${s.dc}`;
      title = [`DC ${s.dc}`, s.ability, s.skill ? `(${s.skill})` : ''].filter(Boolean).join(' ');
      row = stats([['dc', String(s.dc)], ['ability', s.ability], ['skill', s.skill], ['passive', s.passive !== undefined ? String(s.passive) : undefined]]);
      body = 'Roll a d20 and add the modifier; meeting or beating the DC succeeds.';
      break;
    }
    case 'dice': {
      const d = diceStats(s.expr);
      title = s.expr;
      row = stats([['dice', s.expr], ['average', d ? String(d.avg) : undefined], ['max', d ? String(d.max) : undefined]]);
      break;
    }
    case 'area':
      kicker = `area · ${s.key}`; title = s.name;
      row = stats([['key', s.key], ['floor', s.floor], ['players', s.revealed === undefined ? undefined : s.revealed ? 'revealed' : 'hidden'], ['page', s.page ? `p.${s.page}` : undefined]]);
      body = s.desc ?? '';
      break;
    case 'person':
      title = s.name; row = stats([['role', s.role], ['home', s.home]]);
      break;
    case 'pageref':
      title = `Page ${s.page}`; row = stats([['page', `p.${s.page}`], ['where', s.where]]);
      body = 'In the module book.';
      break;
  }
  const { el } = shell(s.kind, '', kicker, title, ctx, true);
  el.insertAdjacentHTML('beforeend', `${row}<hr class="taper">${body ? `<div class="body"><p>${esc(clampWords(body, 60).text)}</p></div>` : ''}<div class="src"><span class="who">${s.kind === 'dice' || s.kind === 'check' ? 'Table' : 'Module'}</span><span class="gap"></span>${pinBtn(ctx)}</div>`);
  return el;
}

function moduleCard(m: ModuleMonster, ctx: CardCtx): HTMLElement {
  const { el } = shell('monster', '', m.stats ? `monster · CR ${m.stats.cr}` : 'monster', m.name, ctx, true);
  el.insertAdjacentHTML('beforeend', `<div class="body">${moduleStatsHtml(m.stats, m.srd ? 'Module stats' : 'Curse of Strahd creature: no open stat block')}</div><div class="src"><span class="who">Module stats</span><span class="gap"></span>${pinBtn(ctx)}</div>`);
  return el;
}

/** Average and maximum of a dice expression ('2d8 + 2'). */
export function diceStats(expr: string): { avg: number; max: number } | undefined {
  const m = /^\s*(\d+)\s*d\s*(\d+)\s*(?:([+−-])\s*(\d+))?\s*$/i.exec(expr);
  if (!m) return undefined;
  const n = Number(m[1]), d = Number(m[2]), k = m[3] ? (m[3] === '+' ? 1 : -1) * Number(m[4]) : 0;
  return { avg: Math.floor((n * (d + 1)) / 2 + k), max: n * d + k };
}

