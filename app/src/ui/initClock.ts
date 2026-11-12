// The initiative clock (DM only): a 1–30 dial where each combatant sits on its count, the active turn lit and a
// hand pointing at it; reminders pinned into the order ("reinforcements in 3 rounds", "roll recharge", lair actions
// on 20); the party always in the tray to drag onto the dial or type a number; an order list with hit points,
// conditions, concentration, legendary actions, recharges and death saves; and an encounter builder over the SRD
// monsters, the module's creatures and the DM's own pasted stat blocks, with difficulty under both rule sets.
// Everything is kept on the DM's device (localStorage), per campaign; nothing goes into the repo or to the players.
import './initClock.css';
import type { MonsterSummary } from '../books/types';
import {
  abilityMod, addCondition, angleOf, applyHp, avgExpr, combatant, d, deathSave, delay, difficulty, DIAL_MAX, gameTime, initAt, jump, newClock,
  next, nudgeTie, numbered, ordered, parseBlock, prev, prompts, REMINDER_PRESETS, reminder, resume, rollExpr, rollInit, roundsLeft, setInit,
  start, takesTurn, TOP, uid, xpForCr, type Clock, type Entry, type ParsedBlock, type Preset, type ReminderMode, type Rules, type Side,
} from '../core/initClock';
import { esc } from './text';

// ------------------------------------------------------------------ the host: the VTT (ui/initClockVtt.ts) or the standalone page

/** One SRD monster as the books store it. */
export interface MonsterRecord { id: string; name: string; s: MonsterSummary; html: string }
/** A creature placed on the open map, to copy into the clock. */
export interface MapCreature { id: string; name: string; alias?: string; color?: string; hidden?: boolean; hp?: { cur: number; max: number }; creatureId?: string }
/** What the clock needs from wherever it runs. */
export interface ClockHost {
  /** The storage namespace (the VTT's campaign id). */
  key: string;
  /** Characters to seed the party with. */
  roster(): { id: string; name: string; color: string; initMod: number; player?: string; level?: number }[];
  /** Changes when the host's party seed changes; a different stored version re-seeds the party (names, players, levels). */
  partyVersion?: string;
  /** The SRD monsters for a rules edition. */
  monsters(ed: Rules): Promise<MonsterRecord[]>;
  edition(): Rules;
  setEdition(ed: Rules): void;
  /** Fired on window when the edition changes. */
  editionEvent: string;
  /** The module's own creatures (the VTT only). */
  modules?(): CatItem[];
  /** The SRD entry a module creature maps to, if any. */
  resolveModule?(id: string, ed: Rules): Promise<{ id: string; edition: Rules } | undefined>;
  /** Creatures on the open map (the VTT only). */
  mapCreatures?(): MapCreature[];
  /** Where "copy names" reads the roster from, e.g. "the VTT roster". */
  rosterLabel?: string;
}

// ------------------------------------------------------------------ device-local stores

interface PartyMember { id: string; name: string; player: string; level: number; ac: number; pp: number; mod: number; maxHp: number; color: string }
interface CustomBlock { id: string; name: string; text: string; p: ParsedBlock }
type Ref = { type: 'srd'; id: string; edition: Rules } | { type: 'module'; id: string } | { type: 'custom'; id: string };
interface StageItem { key: string; ref: Ref; name: string; count: number; cr?: string; side: Side }
interface Saved { id: string; name: string; items: StageItem[]; notes?: string }
interface Prefs { mode: 'full' | 'mini'; tab: Tab; hp: 'avg' | 'roll'; group: boolean; adv: 'normal' | 'adv' | 'dis'; hidden: boolean; pos?: { x: number; y: number } }
type Tab = 'order' | 'build' | 'remind' | 'party' | 'log';

const K = (host: ClockHost, k: string) => `mistlab.initClock.${host.key}.${k}`;
const get = <T>(key: string, dflt: T): T => { try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : dflt; } catch { return dflt; } };
const put = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode: this session only */ } };

const PARTY_COLORS = ['#d9822b', '#7b5ea7', '#c9b458', '#3b8ea5', '#4f9a5b', '#c0607a'];
const FOE_COLORS = ['#8a2b2b', '#9a4a1f', '#6b2f5a', '#7a3a2a', '#5a3a6b', '#8a5a2b'];
const CONDITIONS = ['Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious'];
const EXTRA_CONDITIONS = ['Blessed', 'Baned', 'Hasted', 'Slowed', 'Hexed', "Hunter's Mark", 'Dodging', 'Hidden', 'Raging', 'Burning', 'Bleeding', 'Marked', 'Cover (half)', 'Cover (three-quarters)'];

function seedParty(host: ClockHost): PartyMember[] {
  const pcs = host.roster();
  const base = pcs.length ? pcs : [{ id: 'pc-1', name: 'Character 1', color: PARTY_COLORS[0], initMod: 0 }];
  return base.map((s, i) => ({ id: s.id, name: s.name, player: ('player' in s && s.player) || '', level: ('level' in s && s.level) || 1, ac: 12, pp: 10, mod: s.initMod ?? 0, maxHp: 10, color: s.color ?? PARTY_COLORS[i % PARTY_COLORS.length] }));
}

// ------------------------------------------------------------------ the monster catalog

export interface CatItem { key: string; ref: Ref; name: string; cr?: string; xp?: number; ac?: number; hp?: number; hpDice?: string; mod: number; pp?: number; html?: string; p?: ParsedBlock; tag: string; size?: string; type?: string }
const srdCache = new Map<string, Promise<CatItem[]>>();
function srdCatalog(host: ClockHost, ed: Rules): Promise<CatItem[]> {
  const ck = `${host.key}|${ed}`;
  let p = srdCache.get(ck);
  if (!p) srdCache.set(ck, (p = host.monsters(ed).then((list) => list.map((e) => {
    const s = e.s as MonsterSummary;
    const im = /^([+-]?\d+)/.exec(s.initiative ?? '');
    const pp = /passive Perception (\d+)/i.exec(s.senses ?? '');
    return { key: `srd:${ed}:${e.id}`, ref: { type: 'srd', id: e.id, edition: ed }, name: e.name, cr: String(s.cr), xp: s.xp ?? xpForCr(String(s.cr)), ac: s.ac, hp: s.hp, hpDice: s.hpDice?.replace(/\s+/g, ''), mod: im ? Number(im[1]) : abilityMod(s.abilities?.dex ?? 10), pp: pp ? Number(pp[1]) : undefined, html: e.html, tag: ed === '2024' ? 'SRD 5.2.1' : 'SRD 5.1', size: s.size, type: s.creatureType } satisfies CatItem;
  })).catch(() => [] as CatItem[])));
  return p;
}
const customItem = (b: CustomBlock): CatItem => ({ key: `custom:${b.id}`, ref: { type: 'custom', id: b.id }, name: b.name, cr: b.p.cr, xp: b.p.xp ?? xpForCr(b.p.cr), ac: b.p.ac, hp: b.p.hp, hpDice: b.p.hpDice, mod: b.p.initMod ?? (b.p.dex ? abilityMod(b.p.dex) : 0), pp: b.p.pp, p: b.p, tag: 'My stat block' });

// ------------------------------------------------------------------ the dock

let open: { el: HTMLElement; close: () => void } | null = null;

/** Open the clock, or bring it forward if it is open. */
export function openClock(host: ClockHost): void {
  if (open) { open.el.classList.add('flash'); setTimeout(() => open?.el.classList.remove('flash'), 400); return; }
  const dock = document.createElement('section');
  dock.className = 'ic-dock page';
  dock.setAttribute('aria-label', 'Initiative clock');
  document.body.appendChild(dock);

  let clock: Clock = get(K(host, 'clock'), newClock());
  let party: PartyMember[] = get(K(host, 'party'), [] as PartyMember[]);
  if (!party.length) party = seedParty(host);
  if (host.partyVersion && get(K(host, 'partyVersion'), '') !== host.partyVersion) {
    // A new party from the host (new names or levels): keep each character's numbers the DM already set, by id.
    const old = new Map(party.map((m) => [m.id, m]));
    party = seedParty(host).map((m) => { const o = old.get(m.id); return o ? { ...o, name: m.name, player: m.player, level: m.level } : m; });
    put(K(host, 'partyVersion'), host.partyVersion);
  }
  let library: CustomBlock[] = get(K(host, 'library'), [] as CustomBlock[]);
  let saved: Saved[] = get(K(host, 'saved'), [] as Saved[]);
  let stage: StageItem[] = get(K(host, 'stage'), [] as StageItem[]);
  const prefs: Prefs = { mode: 'full', tab: 'order', hp: 'avg', group: false, adv: 'normal', hidden: true, ...get(K(host, 'prefs'), {}) };
  let undo: string[] = [], redo: string[] = [];
  let selected: string | null = null;
  let query = '';
  let catalog: CatItem[] = [];
  let parsedDraft: { text: string; p: ParsedBlock } | null = null;
  let remDraft: (Preset & { n?: number; at?: string }) | null = null;
  let tick = 0;
  const rules = (): Rules => host.edition();
  const moduleCatalog = (): CatItem[] => host.modules?.() ?? [];

  const save = () => { put(K(host, 'clock'), clock); put(K(host, 'party'), party); put(K(host, 'library'), library); put(K(host, 'saved'), saved); put(K(host, 'stage'), stage); put(K(host, 'prefs'), prefs); };
  /** Every change to the fight goes through here: undo snapshot, change, save, draw. */
  const act = (f: () => void) => { undo.push(JSON.stringify(clock)); if (undo.length > 80) undo.shift(); redo = []; f(); save(); render(); };
  const say = (text: string) => { clock.log.push({ round: clock.round, text, at: Date.now() }); };
  const byId = (id: string) => clock.entries.find((e) => e.id === id);

  // -------------------------------------------------------------- adding things

  const addPc = (m: PartyMember, init: number | null) => {
    const have = clock.entries.find((e) => e.src?.type === 'pc' && e.src.partyId === m.id);
    if (have) { have.init = init; have.name = m.name; return have; }
    const e = combatant({ name: m.name, side: 'pc', color: m.color, init, mod: m.mod, ac: m.ac, pp: m.pp, hp: { cur: m.maxHp, max: m.maxHp, temp: 0 }, src: { type: 'pc', partyId: m.id } });
    clock.entries.push(e); return e;
  };
  const resolveItem = async (it: StageItem | CatItem): Promise<CatItem | undefined> => {
    const ref = it.ref;
    if (ref.type === 'srd') return (await srdCatalog(host, ref.edition)).find((c) => c.ref.type === 'srd' && c.ref.id === ref.id);
    if (ref.type === 'custom') { const b = library.find((x) => x.id === ref.id); return b && customItem(b); }
    const m = moduleCatalog().find((c) => c.key === `module:${ref.id}`);
    // A module creature the books also have (a ghoul, a wolf) takes the books' numbers for the Rules edition.
    try {
      const cs = await host.resolveModule?.(ref.id, rules());
      if (cs) { const s = (await srdCatalog(host, cs.edition)).find((c) => c.ref.type === 'srd' && c.ref.id === cs.id); if (s) return { ...s, key: m?.key ?? s.key, ref, name: m?.name ?? s.name, tag: 'Module · ' + s.tag }; }
    } catch { /* books offline: the module's numbers */ }
    return m;
  };
  const addCreatures = async (items: StageItem[]) => {
    const made: Entry[] = [];
    for (const it of items) {
      const cat = await resolveItem(it); if (!cat) continue;
      const p = cat.p ?? (cat.html ? parseBlock(cat.html) : undefined);
      const names = numbered(clock, it.name, it.count);
      const group = prefs.group && it.count > 1 ? uid('g') : undefined;
      const groupInit = group ? rollInit(cat.mod, prefs.adv) : undefined;
      names.forEach((name, i) => {
        const maxHp = prefs.hp === 'roll' && cat.hpDice ? (rollExpr(cat.hpDice) ?? cat.hp ?? 10) : (cat.hp ?? (cat.hpDice ? avgExpr(cat.hpDice) : null) ?? 10);
        const e = combatant({
          name, side: it.side, color: it.side === 'ally' ? '#3f7f6a' : FOE_COLORS[(clock.entries.length + i) % FOE_COLORS.length], mod: cat.mod, init: groupInit ?? rollInit(cat.mod, prefs.adv),
          ac: cat.ac, pp: cat.pp, cr: cat.cr, xp: cat.xp, hp: { cur: Math.max(1, maxHp), max: Math.max(1, maxHp), temp: 0 }, hidden: prefs.hidden, group,
          src: it.ref.type === 'srd' ? { type: 'srd', id: it.ref.id, edition: it.ref.edition } : it.ref.type === 'module' ? { type: 'module', creatureId: it.ref.id } : { type: 'custom', id: it.ref.id },
          legendary: p?.legendary ? { name: 'Legendary actions', max: p.legendary, used: 0 } : undefined,
          legres: p?.legres ? { name: 'Legendary Resistance', max: p.legres, used: 0 } : undefined,
          recharges: p?.recharges.map((r) => ({ ...r })) ?? [], counters: p?.perDay.map((k) => ({ ...k })) ?? [], regen: p?.regen ? { ...p.regen } : undefined,
        });
        clock.entries.push(e); made.push(e);
      });
      say(`${it.count} × ${it.name} join${it.count === 1 ? 's' : ''}${group ? ` (one roll: ${groupInit})` : ''}`);
    }
    return made;
  };
  const fromMap = () => {
    const toks = host.mapCreatures?.() ?? [];
    if (!toks.length) return flash('No creatures placed on this map yet (the paw button places them).');
    act(() => {
      for (const t of toks) {
        if (clock.entries.some((e) => e.note === `token:${t.id}`)) continue;
        clock.entries.push(combatant({ name: t.name, alias: t.alias, side: 'foe', color: t.color ?? '#8a2b2b', init: rollInit(0, prefs.adv), hidden: t.hidden, hp: t.hp ? { ...t.hp, temp: 0 } : undefined, src: t.creatureId ? { type: 'module', creatureId: t.creatureId } : undefined, note: `token:${t.id}` }));
      }
      say(`${toks.length} creature${toks.length === 1 ? '' : 's'} from the map`);
    });
  };

  // -------------------------------------------------------------- the dial

  const C = 280;
  const pol = (deg: number, r: number) => { const a = (deg - 90) * Math.PI / 180; return [C + r * Math.cos(a), C + r * Math.sin(a)] as const; };
  const arc = (a0: number, a1: number, r0: number, r1: number) => {
    const [x0, y0] = pol(a0, r1), [x1, y1] = pol(a1, r1), [x2, y2] = pol(a1, r0), [x3, y3] = pol(a0, r0), big = a1 - a0 > 180 ? 1 : 0;
    return `M${x0} ${y0}A${r1} ${r1} 0 ${big} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${big} 0 ${x3} ${y3}Z`;
  };
  const initials = (n: string) => { const m = /^(.*?)\s+(\d+)$/.exec(n); const base = (m ? m[1] : n).trim(); const w = base.split(/\s+/); const a = w.length > 1 ? w[0][0] + w[1][0] : base.slice(0, 2); return (a + (m ? m[2] : '')).slice(0, 3); };
  const hpFrac = (e: Entry) => (e.hp && e.hp.max ? Math.max(0, Math.min(1, e.hp.cur / e.hp.max)) : 1);
  const hpColor = (f: number) => (f > 0.5 ? 'var(--ic-ok)' : f > 0.25 ? 'var(--ic-warn)' : 'var(--ic-bad)');

  function dialSvg(): string {
    const list = ordered(clock), active = byId(clock.active ?? '');
    let s = `<svg class="ic-dial" viewBox="0 0 560 560" role="img" aria-label="Initiative dial, round ${clock.round}">`;
    s += `<defs><filter id="ic-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
    s += `<circle class="ic-rim" cx="${C}" cy="${C}" r="276"/>`;
    // Six blocks of five, alternating, with the top of the round between 1 and 30.
    for (let b = 0; b < 6; b++) s += `<path class="ic-block b${b % 2}" d="${arc(b * 60 + 0.6, (b + 1) * 60 - 0.6, 108, 176)}"/>`;
    s += `<path class="ic-crown" d="${arc(-5.4, 5.4, 176, 270)}"/>`;
    // Round progress: from the top to the active count.
    if (active && clock.started) { const a = angleOf(active.init); if (a > 0) s += `<path class="ic-progress" d="${arc(0.2, a, 176, 182)}"/>`; }
    if (active && active.init !== null) { const a = angleOf(active.init); s += `<path class="ic-now" d="${arc(a - 6, a + 6, 108, 182)}" filter="url(#ic-glow)"/>`; }
    for (let v = 1; v <= DIAL_MAX; v++) {
      const a = angleOf(v), five = v % 5 === 0, [x1, y1] = pol(a, five ? 168 : 172), [x2, y2] = pol(a, 182), [tx, ty] = pol(a, five ? 144 : 150);
      const on = active?.init === v;
      s += `<line class="ic-tick${five ? ' five' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
      s += `<text class="ic-n${five ? ' five' : ''}${on ? ' on' : ''}" data-n="${v}" x="${tx}" y="${ty}">${v}</text>`;
      if (v < DIAL_MAX && v % 5 === 0) { const [bx1, by1] = pol(a - 6, 108), [bx2, by2] = pol(a - 6, 186); s += `<line class="ic-split" x1="${bx1}" y1="${by1}" x2="${bx2}" y2="${by2}"/>`; }
    }
    const [cx, cy] = pol(0, 128); s += `<text class="ic-n top" data-n="${TOP}" x="${cx}" y="${cy + 4}">TOP</text>`;
    // The hand.
    if (active && active.init !== null) { const [hx, hy] = pol(angleOf(active.init), 170); s += `<line class="ic-hand" x1="${C}" y1="${C}" x2="${hx}" y2="${hy}"/><circle class="ic-hand-tip" cx="${hx}" cy="${hy}" r="5"/>`; }
    // The chips, stacked outwards on a shared count (a group rolled together is one chip with a count).
    const stacks = new Map<number, number>();
    const shown = new Set<string>();
    for (const e of list) {
      if (e.init === null || e.delayed || shown.has(e.id)) continue;
      const mates = e.group ? list.filter((x) => x.group === e.group && x.init === e.init && !x.delayed) : [e];
      mates.forEach((x) => shown.add(x.id));
      const slot = e.init > DIAL_MAX ? TOP : Math.max(1, e.init);
      const k = stacks.get(slot) ?? 0; stacks.set(slot, k + 1);
      if (k > 2) { if (k === 3) { const [ox, oy] = pol(angleOf(slot), 268); s += `<text class="ic-more" x="${ox}" y="${oy}">+</text>`; } continue; }
      const r = 206 + k * 30, [x, y] = pol(angleOf(slot), r);
      const isNow = mates.some((x) => x.id === clock.active), acted = mates.every((x) => clock.acted.includes(x.id)) && !isNow;
      const off = e.kind === 'combatant' && !takesTurn(e, clock.round);
      const rad = isNow ? 17 : 14;
      const cls = ['ic-chip', e.kind, e.side, isNow && 'now', acted && 'acted', off && 'off', e.hidden && 'hidden', selected === e.id && 'sel'].filter(Boolean).join(' ');
      const tip = esc(`${mates.length > 1 ? `${mates.length} × ` : ''}${e.kind === 'reminder' ? e.rem?.text ?? e.name : e.name} · ${e.init >= TOP ? 'top of the round' : `initiative ${e.init}`}${e.hp ? ` · HP ${e.hp.cur}/${e.hp.max}` : ''}${e.ac ? ` · AC ${e.ac}` : ''}`);
      if (e.kind === 'reminder') {
        const left = roundsLeft(e, clock.round);
        s += `<g class="${cls}" data-drag="entry:${e.id}" data-tip="${tip}" transform="translate(${x} ${y})"><rect x="-13" y="-13" width="26" height="26" rx="4" transform="rotate(45)" fill="${esc(e.color)}"/><text y="5">${left === undefined ? '!' : left}</text></g>`;
      } else {
        const f = mates.reduce((a, m) => a + hpFrac(m), 0) / mates.length, circ = 2 * Math.PI * (rad + 3);
        s += `<g class="${cls}" data-drag="entry:${e.id}" data-tip="${tip}" transform="translate(${x} ${y})">${e.hp ? `<circle class="ic-hpring" r="${rad + 3}" stroke="${hpColor(f)}" stroke-dasharray="${(circ * f).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90)"/>` : ''}<circle r="${rad}" fill="${esc(e.color)}"/><text y="4">${esc(initials(e.name))}</text>${mates.length > 1 ? `<g class="ic-badge" transform="translate(${rad - 2} ${-rad + 2})"><circle r="8"/><text y="3">${mates.length}</text></g>` : ''}${e.conditions.length ? `<circle class="ic-cond-dot" cx="${-rad + 2}" cy="${-rad + 2}" r="4"/>` : ''}${e.conc ? `<circle class="ic-conc-dot" cx="${-rad + 2}" cy="${rad - 2}" r="4"/>` : ''}</g>`;
      }
    }
    // The hub: the round, game time, and Next.
    s += `<g class="ic-hub" data-a="next" role="button" aria-label="${clock.started ? 'Next turn' : 'Start the fight'}"><circle cx="${C}" cy="${C}" r="92"/><text class="ic-hub-k" x="${C}" y="${C - 38}">${clock.started ? 'ROUND' : 'READY'}</text><text class="ic-hub-r" x="${C}" y="${C + 14}">${clock.started ? clock.round : '▶'}</text><text class="ic-hub-t" x="${C}" y="${C + 40}">${clock.started ? esc(gameTime(clock.round)) : 'tap to start'}</text><text class="ic-hub-n" x="${C}" y="${C + 64}">${clock.started ? 'NEXT ▸' : ''}</text></g>`;
    return s + '</svg>';
  }

  // -------------------------------------------------------------- the side: links, rows, tabs

  const nameLink = (e: Entry) => {
    const label = esc(e.name) + (e.alias ? ` <i class="ic-alias">“${esc(e.alias)}”</i>` : '');
    const s = e.src;
    if (s?.type === 'srd') return `<button type="button" class="rl monster ic-name" data-kind="monster" data-term="${esc(s.id)}" data-edition="${s.edition}" aria-expanded="false">${label}</button>`;
    if (s?.type === 'module') return `<button type="button" class="rl monster ic-name" data-kind="monster" data-creature="${esc(s.creatureId)}" data-name="${esc(e.name)}" aria-expanded="false">${label}</button>`;
    if (s?.type === 'custom') return `<button type="button" class="ic-name ic-custom" data-a="custom-card" data-id="${esc(s.id)}" data-tip="Your stat block" data-tip-sub="From your own book; kept on this device">${label}</button>`;
    if (e.kind === 'combatant') return `<span class="ic-name" data-tip="${esc(e.name)}" data-tip-sub="${esc([e.ac && `AC ${e.ac}`, e.pp && `Passive Perception ${e.pp}`, e.hp && `HP ${e.hp.cur}/${e.hp.max}`, `init ${e.mod >= 0 ? '+' : ''}${e.mod}`].filter(Boolean).join(' · '))}">${label}</span>`;
    return `<span class="ic-name">${label}</span>`;
  };
  const condPill = (e: Entry, k: Entry['conditions'][number]) => {
    const std = CONDITIONS.includes(k.name);
    const rounds = k.rounds !== undefined ? `<b>${k.rounds}</b>` : '';
    const whose = k.of !== e.id ? ` (${esc(byId(k.of)?.name ?? '?')}'s ${k.ends})` : '';
    return `<span class="ic-cond">${std ? `<button type="button" class="rl condition" data-kind="condition" data-term="condition:${k.name.toLowerCase()}" aria-expanded="false">${esc(k.name)}</button>` : esc(k.name)}${rounds}<small>${k.save ? ` save ${esc(k.save)}` : ''}${k.rounds !== undefined ? whose : ''}</small><button class="ic-x" data-a="cond-del" data-id="${e.id}" data-c="${k.id}" aria-label="Remove ${esc(k.name)}">×</button></span>`;
  };
  const pips = (e: Entry, which: 'legendary' | 'legres', label: string) => {
    const k = e[which]; if (!k) return '';
    return `<span class="ic-pips" data-tip="${label}" data-tip-sub="Tap to spend, tap a spent one to restore">${label === 'Legendary actions' ? 'LA' : 'LR'} ${Array.from({ length: k.max }, (_, i) => `<button class="ic-pip${i < k.max - k.used ? ' on' : ''}" data-a="pip" data-w="${which}" data-id="${e.id}" data-i="${i}" aria-label="${label} ${i + 1}"></button>`).join('')}</span>`;
  };

  function row(e: Entry): string {
    const now = e.id === clock.active, acted = clock.acted.includes(e.id) && !now, sel = selected === e.id;
    const cls = ['ic-row', e.kind, e.side, now && 'now', acted && 'acted', e.defeated && 'down', e.death?.dead && 'dead', e.hidden && 'hidden', sel && 'sel', e.delayed && 'delayed'].filter(Boolean).join(' ');
    const initVal = e.init === null ? '' : e.init >= TOP ? 'TOP' : String(e.init);
    if (e.kind === 'reminder') {
      const left = roundsLeft(e, clock.round);
      const when = e.rem?.done ? 'done' : e.rem?.mode === 'every' ? 'every round' : e.rem?.mode === 'interval' ? `every ${e.rem.every} rounds, next round ${e.rem.atRound}` : left === 0 ? 'this round' : `in ${left} round${left === 1 ? '' : 's'}`;
      return `<li class="${cls}" data-id="${e.id}"><span class="ic-swatch dia" style="--c:${esc(e.color)}"></span><input class="ic-init" data-f="init" value="${initVal}" aria-label="Initiative count" inputmode="numeric">
        <div class="ic-main"><div class="ic-line">${e.rem?.term ? `<button type="button" class="rl rule ic-name" data-kind="rule" data-term="${esc(e.rem.term)}" aria-expanded="false">${esc(e.rem.text)}</button>` : `<span class="ic-name">${esc(e.rem?.text ?? e.name)}</span>`}<span class="ic-when">${esc(when)}</span></div></div>
        <div class="ic-acts">${e.rem?.mode === 'countdown' && !e.rem.done ? `<button data-a="rem-shift" data-id="${e.id}" data-d="-1" aria-label="One round sooner" data-tip="Sooner">−</button><button data-a="rem-shift" data-id="${e.id}" data-d="1" aria-label="One round later" data-tip="Later">+</button>` : ''}<button data-a="del" data-id="${e.id}" aria-label="Remove" data-tip="Remove">×</button></div></li>`;
    }
    const hp = e.hp;
    const f = hpFrac(e);
    return `<li class="${cls}" data-id="${e.id}">
      <span class="ic-swatch" style="--c:${esc(e.color)}" data-drag="entry:${e.id}" data-tip="Drag onto the dial"></span>
      <input class="ic-init" data-f="init" value="${initVal}" placeholder="—" aria-label="Initiative" inputmode="numeric">
      <div class="ic-main">
        <div class="ic-line">${nameLink(e)}${e.hidden ? '<span class="ic-tag">hidden</span>' : ''}${e.delayed ? '<span class="ic-tag">delayed</span>' : ''}${e.readied ? `<span class="ic-tag" data-tip="Readied" data-tip-sub="${esc(e.readied)}">readied</span>` : ''}${e.reaction ? '<span class="ic-tag dim" data-tip="Reaction used">R used</span>' : ''}${e.defeated ? '<span class="ic-tag bad">down</span>' : ''}${e.death?.dead ? '<span class="ic-tag bad">dead</span>' : ''}${e.death?.stable ? '<span class="ic-tag">stable</span>' : ''}</div>
        <div class="ic-line ic-stats">${e.ac ? `<span class="ic-ac" data-tip="Armor Class">${e.ac}</span>` : ''}
          ${hp ? `<span class="ic-hp"><span class="ic-bar"><i style="width:${(f * 100).toFixed(0)}%;background:${hpColor(f)}"></i></span><b>${hp.cur}</b>/${hp.max}${hp.temp ? ` <em>+${hp.temp}</em>` : ''}</span><input class="ic-dmg" data-f="hp" placeholder="−7 / +5 / t5" aria-label="Damage (7), heal (+7), temporary (t7)" inputmode="text">` : ''}
          ${e.pp ? `<span class="ic-pp" data-tip="Passive Perception">👁 ${e.pp}</span>` : ''}
          ${pips(e, 'legendary', 'Legendary actions')}${pips(e, 'legres', 'Legendary Resistance')}
          ${e.recharges.map((r, i) => `<button class="ic-rech${r.ready ? ' ready' : ''}" data-a="rech" data-id="${e.id}" data-i="${i}" data-tip="${esc(r.name)}" data-tip-sub="${r.ready ? 'Ready: tap when used' : `Spent: recharges on ${r.min}–6`}">${esc(r.name)} ${r.min}+</button>`).join('')}
          ${e.counters.map((k, i) => `<button class="ic-ctr" data-a="ctr" data-id="${e.id}" data-i="${i}" data-tip="${esc(k.name)}" data-tip-sub="Tap to use one; uses left shown">${esc(k.name)} ${k.max - k.used}/${k.max}</button>`).join('')}
          ${e.conc ? `<span class="ic-conc" data-tip="Concentration">◎ ${esc(e.conc)}<button class="ic-x" data-a="conc-del" data-id="${e.id}" aria-label="End concentration">×</button></span>` : ''}
        </div>
        ${e.conditions.length ? `<div class="ic-line ic-conds">${e.conditions.map((k) => condPill(e, k)).join('')}</div>` : ''}
        ${e.side === 'pc' && hp && hp.cur === 0 && !e.death?.dead ? `<div class="ic-line ic-death">Death saves <span class="ic-ds">${'●'.repeat(e.death?.s ?? 0)}${'○'.repeat(3 - (e.death?.s ?? 0))}</span> <span class="ic-ds bad">${'●'.repeat(e.death?.f ?? 0)}${'○'.repeat(3 - (e.death?.f ?? 0))}</span><input class="ic-dsroll" data-f="ds" placeholder="d20" aria-label="Death save roll" inputmode="numeric"><button data-a="ds-roll" data-id="${e.id}">Roll</button></div>` : ''}
        ${sel ? details(e) : ''}
      </div>
      <div class="ic-acts"><button data-a="tie" data-id="${e.id}" data-d="1" aria-label="Earlier on a tie" data-tip="Earlier on a tie">▴</button><button data-a="tie" data-id="${e.id}" data-d="-1" aria-label="Later on a tie" data-tip="Later on a tie">▾</button><button data-a="sel" data-id="${e.id}" aria-expanded="${sel}" aria-label="More" data-tip="More">⋯</button></div>
    </li>`;
  }

  function details(e: Entry): string {
    const others = ordered(clock).filter((x) => x.kind === 'combatant');
    return `<div class="ic-details">
      <div class="ic-grid">
        <label>Name<input data-f="name" value="${esc(e.name)}"></label>
        <label>Players call it<input data-f="alias" value="${esc(e.alias ?? '')}" placeholder="(its name)"></label>
        <label>Side<select data-f="side">${(['pc', 'ally', 'foe', 'neutral'] as Side[]).map((s) => `<option${s === e.side ? ' selected' : ''} value="${s}">${{ pc: 'Player character', ally: 'Ally', foe: 'Foe', neutral: 'Neutral' }[s]}</option>`).join('')}</select></label>
        <label>Colour<input type="color" data-f="color" value="${esc(e.color)}"></label>
        <label>AC<input data-f="ac" type="number" value="${e.ac ?? ''}"></label>
        <label>Max HP<input data-f="maxhp" type="number" value="${e.hp?.max ?? ''}"></label>
        <label>Init bonus<input data-f="mod" type="number" value="${e.mod}"></label>
        <label>Passive Perception<input data-f="pp" type="number" value="${e.pp ?? ''}"></label>
        <label class="wide">Concentrating on<input data-f="conc" value="${esc(e.conc ?? '')}" placeholder="Bless, Hold Person…"></label>
        <label class="wide">Readied action<input data-f="readied" value="${esc(e.readied ?? '')}" placeholder="When the door opens, I shoot"></label>
        <label class="wide">Turn note<input data-f="note" value="${esc(e.note?.startsWith('token:') ? '' : e.note ?? '')}" placeholder="Shown at the start of its turn"></label>
      </div>
      <div class="ic-addcond">
        <select data-f="cname" aria-label="Condition"><optgroup label="Conditions">${CONDITIONS.map((c) => `<option>${c}</option>`).join('')}</optgroup><optgroup label="Effects">${EXTRA_CONDITIONS.map((c) => `<option>${esc(c)}</option>`).join('')}</optgroup></select>
        <input data-f="crounds" type="number" min="1" placeholder="rounds" aria-label="Rounds (blank = until removed)" value="">
        <select data-f="cends" aria-label="Ticks at"><option value="end">end of turn</option><option value="start">start of turn</option></select>
        <select data-f="cof" aria-label="Whose turn">${others.map((o) => `<option value="${o.id}"${o.id === e.id ? ' selected' : ''}>${esc(o.name)}'s</option>`).join('')}</select>
        <input data-f="csave" placeholder="save, e.g. WIS 14" aria-label="Repeat save">
        <button data-a="cond-add" data-id="${e.id}">Add</button>
      </div>
      <div class="ic-btns">
        <button data-a="hide" data-id="${e.id}">${e.hidden ? 'Reveal' : 'Hide'}</button>
        <button data-a="react" data-id="${e.id}">${e.reaction ? 'Reaction back' : 'Reaction used'}</button>
        ${e.delayed ? `<button data-a="resume" data-id="${e.id}">Act now</button>` : `<button data-a="delay" data-id="${e.id}">Delay</button>`}
        <button data-a="jump" data-id="${e.id}">Its turn now</button>
        <button data-a="reroll" data-id="${e.id}">Reroll init</button>
        <button data-a="addla" data-id="${e.id}">+ Legendary</button>
        <button data-a="addrech" data-id="${e.id}">+ Recharge</button>
        <button data-a="dup" data-id="${e.id}">Duplicate</button>
        <button data-a="kill" data-id="${e.id}">${e.defeated ? 'Up again' : 'Down'}</button>
        <button class="danger" data-a="del" data-id="${e.id}">Remove</button>
      </div></div>`;
  }

  function turnCard(): string {
    const e = byId(clock.active ?? '');
    if (!clock.started) return `<div class="ic-turn idle"><b>Not started.</b> Drag the party onto the dial or type their numbers, add foes from <button class="ic-link" data-a="tab" data-t="build">Build</button>, then tap the middle of the dial.</div>`;
    if (!e) return '<div class="ic-turn idle">Nobody can act. Add someone or end the fight.</div>';
    const p = prompts(clock, e);
    const act = (q: ReturnType<typeof prompts>['start'][number]) => q.kind === 'recharge' ? ` <button data-a="rech-roll" data-id="${e.id}" data-r="${esc(q.ref ?? '')}">Roll d6</button><button data-a="rech-set" data-id="${e.id}" data-r="${esc(q.ref ?? '')}">Recharged</button>`
      : q.kind === 'legendary' && q.ref ? ` <button data-a="la-use" data-id="${esc(q.ref)}">Use one</button>` : q.kind === 'save' && q.ref ? ` <button data-a="save-pass" data-id="${e.id}" data-c="${esc(q.ref)}">Saved: end it</button>` : '';
    return `<div class="ic-turn ${e.kind} ${e.side}"><div class="ic-turn-h"><span class="ic-swatch${e.kind === 'reminder' ? ' dia' : ''}" style="--c:${esc(e.color)}"></span><b>${e.kind === 'reminder' ? esc(e.rem?.text ?? e.name) : nameLink(e)}</b><span class="ic-when">${e.init !== null && e.init >= TOP ? 'top of the round' : `on ${e.init}`}</span></div>
      ${p.start.length ? `<ul class="ic-prompts">${p.start.map((q) => `<li class="${q.kind}">${esc(q.text)}${act(q)}</li>`).join('')}</ul>` : ''}
      ${p.after.length ? `<div class="ic-after"><small>After this turn</small><ul class="ic-prompts">${p.after.map((q) => `<li class="${q.kind}">${esc(q.text)}${act(q)}</li>`).join('')}</ul></div>` : ''}</div>`;
  }

  function orderTab(): string {
    const list = ordered(clock);
    return `${turnCard()}<ol class="ic-order">${list.map(row).join('') || '<li class="ic-empty">Nobody in the order yet.</li>'}</ol>
      <div class="ic-btns"><button data-a="roll-foes">Roll for foes</button><button data-a="party-all">Whole party in</button>${host.mapCreatures ? '<button data-a="from-map">From this map</button>' : ''}<button data-a="quick-foe">+ Quick foe</button><button data-a="tab" data-t="remind">+ Reminder</button></div>`;
  }

  function buildTab(): string {
    const ed = rules();
    const q = query.trim().toLowerCase();
    const pool = [...library.map(customItem), ...catalog, ...moduleCatalog()];
    const rank = (c: CatItem) => { const n = c.name.toLowerCase(); return n === q ? 0 : n.startsWith(q) ? 1 : n.split(/\s+/).some((w) => w.startsWith(q)) ? 2 : 3; };
    const hits = (q ? pool.filter((c) => c.name.toLowerCase().includes(q) || c.type?.toLowerCase() === q || c.cr === q.replace(/^cr\s*/, '')).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)) : pool.filter((c) => c.tag === 'My stat block').concat(catalog.filter((c) => ['ghoul', 'wolf', 'dire-wolf', 'vampire-spawn', 'zombie', 'skeleton', 'swarm-of-bats', 'werewolf', 'scarecrow', 'shadow'].some((k) => c.ref.type === 'srd' && c.ref.id === `monster:${k}`)))).slice(0, 40);
    const levels = party.map((m) => m.level);
    const crs: (string | undefined)[] = []; for (const s of stage) if (s.side === 'foe') for (let i = 0; i < s.count; i++) crs.push(s.cr);
    const dd = difficulty(crs, levels);
    const meter = (label: string, steps: string[]) => `<span class="ic-meter">${steps.map((s) => `<i class="${s === label ? 'on' : ''} ${s.replace(/\s/g, '-')}">${s}</i>`).join('')}</span>`;
    return `<div class="ic-build">
      <div class="ic-search"><input type="search" data-f="q" value="${esc(query)}" placeholder="Search ${ed === '2024' ? 'SRD 5.2.1' : 'SRD 5.1'} monsters, the module's creatures, your stat blocks… (name, type or CR)" aria-label="Search monsters"><span class="ic-sub">Rules for stat blocks: <span class="seg"><button data-a="ed" data-e="2014" aria-pressed="${ed === '2014'}">2014</button><button data-a="ed" data-e="2024" aria-pressed="${ed === '2024'}">2024</button></span></span></div>
      <ul class="ic-results">${hits.map((c) => `<li><span class="ic-r-name">${c.ref.type === 'srd' ? `<button type="button" class="rl monster" data-kind="monster" data-term="${esc(c.ref.id)}" data-edition="${c.ref.edition}" aria-expanded="false">${esc(c.name)}</button>` : c.ref.type === 'module' ? `<button type="button" class="rl monster" data-kind="monster" data-creature="${esc(c.ref.id)}" data-name="${esc(c.name)}" aria-expanded="false">${esc(c.name)}</button>` : `<button class="ic-custom" data-a="custom-card" data-id="${esc(c.ref.id)}">${esc(c.name)}</button>`}<small>${esc(c.tag)}</small></span><span class="ic-r-num">${c.cr !== undefined ? `CR ${esc(c.cr)}` : ''}${c.ac ? ` · AC ${c.ac}` : ''}${c.hp ? ` · HP ${c.hp}` : ''}</span><button data-a="stage-add" data-k="${esc(c.key)}" data-s="foe" aria-label="Add ${esc(c.name)} as a foe">+ Foe</button><button data-a="stage-add" data-k="${esc(c.key)}" data-s="ally" aria-label="Add ${esc(c.name)} as an ally">+ Ally</button></li>`).join('') || '<li class="ic-empty">Nothing matches. Paste your own stat block below.</li>'}</ul>
      <h4>This fight</h4>
      <ul class="ic-stage">${stage.map((s, i) => `<li class="${s.side}"><b>${esc(s.name)}</b><small>${s.cr ? `CR ${esc(s.cr)} · ${xpForCr(s.cr)?.toLocaleString('en-US') ?? '?'} XP` : 'no CR'}${s.side === 'ally' ? ' · ally' : ''}</small><span class="ic-step"><button data-a="stage-n" data-i="${i}" data-d="-1" aria-label="One fewer">−</button><input data-f="stage-n" data-i="${i}" value="${s.count}" aria-label="How many" inputmode="numeric"><button data-a="stage-n" data-i="${i}" data-d="1" aria-label="One more">+</button></span><button data-a="stage-del" data-i="${i}" aria-label="Remove">×</button></li>`).join('') || '<li class="ic-empty">Add creatures from the search. Counts like 2d4: roll them and type the total.</li>'}</ul>
      <div class="ic-diff">
        <div><b>2014</b> ${meter(dd.y2014.label, ['easy', 'medium', 'hard', 'deadly'])}<small>${dd.xp.toLocaleString('en-US')} XP × ${dd.y2014.multiplier} = ${dd.y2014.adjusted.toLocaleString('en-US')} adjusted · thresholds ${dd.y2014.thresholds.map((t) => t.toLocaleString('en-US')).join(' / ')}</small></div>
        <div><b>2024</b> ${meter(dd.y2024.label, ['low', 'moderate', 'high', 'beyond high'])}<small>${dd.xp.toLocaleString('en-US')} XP · budgets ${dd.y2024.budgets.map((t) => t.toLocaleString('en-US')).join(' / ')}</small></div>
        <small class="ic-sub">Party: ${party.length} at level${new Set(levels).size > 1 ? 's' : ''} ${[...new Set(levels)].join(', ')} (set in <button class="ic-link" data-a="tab" data-t="party">Party</button>). Each player character earns ${party.length ? Math.floor(dd.xp / party.length).toLocaleString('en-US') : 0} XP.</small>
      </div>
      <div class="ic-opts">
        <label>Hit points <select data-f="opt-hp"><option value="avg"${prefs.hp === 'avg' ? ' selected' : ''}>average</option><option value="roll"${prefs.hp === 'roll' ? ' selected' : ''}>rolled</option></select></label>
        <label><input type="checkbox" data-f="opt-group"${prefs.group ? ' checked' : ''}> one initiative per kind</label>
        <label>Roll <select data-f="opt-adv"><option value="normal"${prefs.adv === 'normal' ? ' selected' : ''}>normally</option><option value="adv"${prefs.adv === 'adv' ? ' selected' : ''}>with advantage</option><option value="dis"${prefs.adv === 'dis' ? ' selected' : ''}>with disadvantage (2024 surprised)</option></select></label>
        <label><input type="checkbox" data-f="opt-hidden"${prefs.hidden ? ' checked' : ''}> start hidden</label>
      </div>
      <div class="ic-btns"><button class="primary" data-a="stage-go"${stage.length ? '' : ' disabled'}>Add to the clock</button><input data-f="save-name" placeholder="Name this fight" aria-label="Encounter name"><button data-a="stage-save"${stage.length ? '' : ' disabled'}>Save</button><button data-a="stage-clear"${stage.length ? '' : ' disabled'}>Clear</button></div>
      ${saved.length ? `<h4>Saved fights</h4><ul class="ic-saved">${saved.map((s) => `<li><b>${esc(s.name)}</b><small>${s.items.map((i) => `${i.count} ${esc(i.name)}`).join(', ')}</small><button data-a="saved-load" data-id="${s.id}">Load</button><button data-a="saved-go" data-id="${s.id}">Add to the clock</button><button data-a="saved-del" data-id="${s.id}" aria-label="Delete">×</button></li>`).join('')}</ul>` : ''}
      <details class="ic-paste"${parsedDraft ? ' open' : ''}><summary>Your own stat block (Monster Manual, the module, D&amp;D Beyond)</summary>
        <p class="ic-sub">Paste a stat block from a book you own. The clock reads its AC, hit points, initiative, CR, legendary actions, recharges and once-a-day abilities. It is kept on this device only, never in the repository.</p>
        <textarea data-f="paste" rows="6" placeholder="Strahd von Zarovich&#10;Armor Class 16&#10;Hit Points 144 (17d8 + 68)&#10;…">${esc(parsedDraft?.text ?? '')}</textarea>
        <div class="ic-btns"><button data-a="paste-read">Read it</button></div>
        ${parsedDraft ? `<div class="ic-grid">
          <label>Name<input data-f="pd-name" value="${esc(parsedDraft.p.name ?? '')}"></label><label>AC<input data-f="pd-ac" type="number" value="${parsedDraft.p.ac ?? ''}"></label>
          <label>HP<input data-f="pd-hp" type="number" value="${parsedDraft.p.hp ?? ''}"></label><label>HP dice<input data-f="pd-dice" value="${esc(parsedDraft.p.hpDice ?? '')}"></label>
          <label>Init bonus<input data-f="pd-init" type="number" value="${parsedDraft.p.initMod ?? (parsedDraft.p.dex ? abilityMod(parsedDraft.p.dex) : '')}"></label><label>CR<input data-f="pd-cr" value="${esc(parsedDraft.p.cr ?? '')}"></label>
          <p class="wide ic-sub">Found: ${[parsedDraft.p.legendary && `${parsedDraft.p.legendary} legendary actions`, parsedDraft.p.legres && `Legendary Resistance ${parsedDraft.p.legres}/day`, ...parsedDraft.p.recharges.map((r) => `${r.name} (recharge ${r.min}–6)`), ...parsedDraft.p.perDay.map((k) => `${k.name} (${k.max}/day)`), parsedDraft.p.regen && `regenerates ${parsedDraft.p.regen.hp}`, parsedDraft.p.lair && 'lair actions'].filter(Boolean).map((x) => esc(String(x))).join(' · ') || 'no special abilities'}</p></div>
          <div class="ic-btns"><button class="primary" data-a="paste-save">Save to my stat blocks</button></div>` : ''}
        ${library.length ? `<ul class="ic-saved">${library.map((b) => `<li><b>${esc(b.name)}</b><small>${b.p.cr ? `CR ${esc(b.p.cr)}` : ''}</small><button data-a="stage-add" data-k="custom:${b.id}" data-s="foe">+ Foe</button><button data-a="lib-del" data-id="${b.id}" aria-label="Delete">×</button></li>`).join('')}</ul>` : ''}
      </details></div>`;
  }

  function remindTab(): string {
    const groups = [...new Set(REMINDER_PRESETS.map((p) => p.group))];
    const list = ordered(clock).filter((e) => e.kind === 'reminder');
    const combatants = ordered(clock).filter((e) => e.kind === 'combatant');
    const f = remDraft;
    return `<div class="ic-remind">
      <p class="ic-sub">Things that are not creatures but need a turn: they sit in the order (at the top of the round, or on a count), stop the clock when they are due, and count down by themselves.</p>
      ${f ? `<div class="ic-remform"><h4>${esc(f.label)}</h4><p class="ic-sub">${esc(f.help)}</p>
        <div class="ic-grid"><label class="wide">Text<input data-f="rd-text" value="${esc(f.text)}"></label>
        <label>Happens<select data-f="rd-mode">${(['countdown', 'once', 'every', 'interval'] as ReminderMode[]).map((m) => `<option value="${m}"${m === f.mode ? ' selected' : ''}>${{ countdown: 'in N rounds', once: 'on round N', every: 'every round', interval: 'every N rounds' }[m]}</option>`).join('')}</select></label>
        <label>N<input data-f="rd-n" type="number" min="1" value="${f.n ?? 1}"></label>
        <label class="wide">Sits<select data-f="rd-at"><option value="top"${(f.at ?? (f.init === TOP ? 'top' : 'count')) === 'top' ? ' selected' : ''}>top of the round</option><option value="count"${(f.at ?? (f.init === TOP ? 'top' : 'count')) === 'count' ? ' selected' : ''}>on an initiative count</option>${combatants.map((c) => `<option value="after:${c.id}"${f.at === `after:${c.id}` ? ' selected' : ''}>right after ${esc(c.name)}</option>`).join('')}</select></label>
        <label>Count<input data-f="rd-count" type="number" min="1" max="30" value="${f.init === TOP ? 20 : f.init}"></label></div>
        <div class="ic-btns"><button class="primary" data-a="rd-add">Pin it</button><button data-a="rd-cancel">Cancel</button></div></div>` : ''}
      ${groups.map((g) => `<h4>${g}</h4><div class="ic-presets">${REMINDER_PRESETS.filter((p) => p.group === g).map((p) => `<button data-a="preset" data-p="${p.id}" data-tip="${esc(p.label)}" data-tip-sub="${esc(p.help)}">${esc(p.label)}</button>`).join('')}</div>`).join('')}
      ${list.length ? `<h4>Pinned</h4><ol class="ic-order">${list.map(row).join('')}</ol>` : ''}</div>`;
  }

  function partyTab(): string {
    return `<div class="ic-party"><p class="ic-sub">Your players' characters are always in the tray under the dial: drag one onto its number, or type it. Levels set the encounter difficulty.</p>
      <table><thead><tr><th></th><th>Character</th><th>Player</th><th>Lvl</th><th>AC</th><th>PP</th><th>Init</th><th>HP</th><th></th></tr></thead><tbody>
      ${party.map((m, i) => `<tr data-i="${i}"><td><input type="color" data-f="p-color" value="${esc(m.color)}" aria-label="Colour"></td><td><input data-f="p-name" value="${esc(m.name)}" aria-label="Character"></td><td><input data-f="p-player" value="${esc(m.player)}" aria-label="Player"></td><td><input type="number" min="1" max="20" data-f="p-level" value="${m.level}" aria-label="Level"></td><td><input type="number" data-f="p-ac" value="${m.ac}" aria-label="AC"></td><td><input type="number" data-f="p-pp" value="${m.pp}" aria-label="Passive Perception"></td><td><input type="number" data-f="p-mod" value="${m.mod}" aria-label="Initiative bonus"></td><td><input type="number" data-f="p-hp" value="${m.maxHp}" aria-label="Max HP"></td><td><button data-a="p-del" data-i="${i}" aria-label="Remove">×</button></td></tr>`).join('')}
      </tbody></table><div class="ic-btns"><button data-a="p-add">+ Character</button>${host.rosterLabel ? `<button data-a="p-roster">Copy names from ${esc(host.rosterLabel)}</button>` : ''}<button data-a="party-all">Whole party in</button></div></div>`;
  }

  function logTab(): string {
    const ms = clock.startedAt ? Date.now() - clock.startedAt : 0;
    const per = ordered(clock).filter((e) => clock.turnMs[e.id]).map((e) => ({ e, ms: clock.turnMs[e.id] }));
    const fmt = (m: number) => { const s = Math.round(m / 1000); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`; };
    return `<div class="ic-log"><p><b>Round ${clock.round}</b> · ${esc(gameTime(clock.round))} of game time · ${fmt(ms)} at the table</p>
      ${per.length ? `<p class="ic-sub">Time on turns: ${per.map((x) => `${esc(x.e.name)} ${fmt(x.ms)}`).join(' · ')}</p>` : ''}
      <ol reversed>${[...clock.log].reverse().slice(0, 150).map((l) => `<li><small>R${l.round}</small> ${esc(l.text)}</li>`).join('')}</ol>
      <div class="ic-btns"><button data-a="export">Export fight (JSON)</button><label class="ic-file">Import<input type="file" accept="application/json" data-f="import"></label></div></div>`;
  }

  // -------------------------------------------------------------- the whole dock

  function render(): void {
    const g = ++tick;
    const tabs: [Tab, string][] = [['order', 'Order'], ['build', 'Build'], ['remind', 'Reminders'], ['party', 'Party'], ['log', 'Log']];
    const delayed = clock.entries.filter((e) => e.delayed);
    const scroll = dock.querySelector('.ic-side')?.scrollTop ?? 0;
    const focus = (document.activeElement as HTMLElement | null)?.dataset?.f, focusId = document.activeElement?.closest<HTMLElement>('[data-id]')?.dataset.id;
    dock.dataset.mode = prefs.mode;
    dock.innerHTML = `<header class="ic-head" data-drag-dock>
        <h2>Initiative <span>clock</span></h2>
        <div class="ic-tools">
          <button data-a="prev" aria-label="Previous turn" data-tip="Previous turn" data-tip-sub="P">◂</button>
          <button class="primary" data-a="next" data-tip="${clock.started ? 'Next turn' : 'Start'}" data-tip-sub="N or Space">${clock.started ? 'Next ▸' : 'Start ▸'}</button>
          <button data-a="undo" aria-label="Undo" data-tip="Undo" data-tip-sub="Ctrl+Z"${undo.length ? '' : ' disabled'}>↶</button>
          <button data-a="redo" aria-label="Redo" data-tip="Redo" data-tip-sub="Ctrl+Y"${redo.length ? '' : ' disabled'}>↷</button>
          <button data-a="end" data-tip="End the fight" data-tip-sub="XP summary; the party stays">End</button>
          <button data-a="mode" aria-label="${prefs.mode === 'mini' ? 'Full clock' : 'Mini clock'}" data-tip="${prefs.mode === 'mini' ? 'Full clock' : 'Mini clock'}" data-tip-sub="M">${prefs.mode === 'mini' ? '⤢' : '⤡'}</button>
          <button data-a="close" aria-label="Close" data-tip="Close" data-tip-sub="The fight is kept">×</button>
        </div></header>
      <div class="ic-body">
        <div class="ic-wheel">${dialSvg()}
          <div class="ic-tray" aria-label="Party">${party.map((m) => { const e = clock.entries.find((x) => x.src?.type === 'pc' && x.src.partyId === m.id); return `<span class="ic-pc${e?.init != null ? ' in' : ''}${e && e.id === clock.active ? ' now' : ''}" style="--c:${esc(m.color)}"><span class="ic-pcname" data-drag="party:${m.id}" data-tip="${esc(m.name)}${m.player ? ` (${esc(m.player)})` : ''}" data-tip-sub="Drag onto the dial, or type a number">${esc(m.name)}</span><input data-f="pc-init" data-p="${m.id}" value="${e?.init ?? ''}" placeholder="#" aria-label="${esc(m.name)}'s initiative" inputmode="numeric"></span>`; }).join('')}
            ${delayed.map((e) => `<span class="ic-pc delayed" style="--c:${esc(e.color)}"><span class="ic-pcname">${esc(e.name)}</span><button data-a="resume" data-id="${e.id}" data-tip="Act now">▶</button></span>`).join('')}</div>
          ${prefs.mode === 'mini' ? `<div class="ic-mini-now">${byId(clock.active ?? '') ? esc(byId(clock.active!)!.name) : 'Ready'}</div>` : ''}
        </div>
        <div class="ic-side">
          <nav class="ic-tabs" role="tablist">${tabs.map(([t, l]) => `<button role="tab" data-a="tab" data-t="${t}" aria-selected="${prefs.tab === t}">${l}</button>`).join('')}</nav>
          <div class="ic-pane">${prefs.tab === 'order' ? orderTab() : prefs.tab === 'build' ? buildTab() : prefs.tab === 'remind' ? remindTab() : prefs.tab === 'party' ? partyTab() : logTab()}</div>
        </div></div>
      <div class="ic-toast" role="status" aria-live="polite"></div>`;
    const side = dock.querySelector<HTMLElement>('.ic-side'); if (side) side.scrollTop = scroll;
    if (focus) { const sel = `[data-f="${focus}"]`; const el = (focusId ? dock.querySelector(`[data-id="${CSS.escape(focusId)}"] ${sel}`) : null) ?? dock.querySelector<HTMLElement>(sel); if (el instanceof HTMLInputElement && focus === 'q') { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }
    if (prefs.tab === 'build' && !catalog.length) void srdCatalog(host, rules()).then((c) => { if (g === tick || prefs.tab === 'build') { catalog = c; if (c.length) render(); } });
    if (prefs.pos) { dock.style.left = `${Math.max(0, Math.min(innerWidth - 120, prefs.pos.x))}px`; dock.style.top = `${Math.max(0, Math.min(innerHeight - 60, prefs.pos.y))}px`; dock.style.right = 'auto'; }
  }

  function flash(text: string): void {
    const t = dock.querySelector<HTMLElement>('.ic-toast'); if (!t) return;
    t.textContent = text; t.classList.add('on'); clearTimeout((t as unknown as { _t?: number })._t);
    (t as unknown as { _t?: number })._t = window.setTimeout(() => t.classList.remove('on'), 3200);
  }

  // -------------------------------------------------------------- clicks

  dock.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    const b = t.closest<HTMLElement>('[data-a]'); if (!b || (b as HTMLButtonElement).disabled) return;
    const a = b.dataset.a!, id = b.dataset.id ?? '', e = byId(id);
    switch (a) {
      case 'next': if (!clock.entries.some((x) => x.init !== null)) return flash('Give someone an initiative first.'); act(() => { clock.started ? next(clock) : start(clock); announce(); }); break;
      case 'prev': act(() => prev(clock)); break;
      case 'undo': { const s = undo.pop(); if (s) { redo.push(JSON.stringify(clock)); clock = JSON.parse(s); save(); render(); } break; }
      case 'redo': { const s = redo.pop(); if (s) { undo.push(JSON.stringify(clock)); clock = JSON.parse(s); save(); render(); } break; }
      case 'end': endFight(); break;
      case 'mode': prefs.mode = prefs.mode === 'mini' ? 'full' : 'mini'; save(); render(); break;
      case 'close': close(); break;
      case 'tab': prefs.tab = b.dataset.t as Tab; save(); render(); break;
      case 'sel': selected = selected === id ? null : id; render(); break;
      case 'del': if (e) act(() => { clock.entries = clock.entries.filter((x) => x !== e); if (clock.active === id) { clock.active = null; } say(`${e.name} removed`); }); break;
      case 'tie': act(() => nudgeTie(clock, id, Number(b.dataset.d) as 1 | -1)); break;
      case 'jump': act(() => jump(clock, id)); break;
      case 'delay': act(() => delay(clock, id)); break;
      case 'resume': act(() => resume(clock, id)); break;
      case 'hide': if (e) act(() => { e.hidden = !e.hidden; }); break;
      case 'react': if (e) act(() => { e.reaction = !e.reaction; }); break;
      case 'kill': if (e) act(() => { e.defeated = !e.defeated; say(`${e.name} ${e.defeated ? 'is down' : 'is back up'}`); }); break;
      case 'reroll': if (e) act(() => { e.init = rollInit(e.mod, prefs.adv); say(`${e.name} rerolls: ${e.init}`); }); break;
      case 'dup': if (e) act(() => { const [n] = numbered(clock, e.name.replace(/\s+\d+$/, ''), 1); clock.entries.push({ ...structuredClone(e), id: uid(), name: n, init: rollInit(e.mod, prefs.adv) }); }); break;
      case 'addla': if (e) act(() => { e.legendary = { name: 'Legendary actions', max: (e.legendary?.max ?? 0) + 1, used: 0 }; }); break;
      case 'addrech': if (e) { const n = prompt('Ability that recharges (name):', 'Breath'); if (n) act(() => e.recharges.push({ name: n, min: 5, ready: true })); } break;
      case 'pip': if (e) act(() => { const k = e[b.dataset.w as 'legendary' | 'legres']!; const i = Number(b.dataset.i), left = k.max - k.used; k.used = i < left ? k.used + 1 : Math.max(0, k.used - 1); }); break;
      case 'la-use': if (e?.legendary) act(() => { e.legendary!.used = Math.min(e.legendary!.max, e.legendary!.used + 1); say(`${e.name} takes a legendary action`); }); break;
      case 'rech': if (e) act(() => { const r = e.recharges[Number(b.dataset.i)]; r.ready = !r.ready; say(`${e.name}: ${r.name} ${r.ready ? 'recharged' : 'used'}`); }); break;
      case 'rech-roll': if (e) act(() => { const r = e.recharges.find((x) => x.name === b.dataset.r); if (!r) return; const roll = d(6); r.ready = roll >= r.min; say(`${e.name}: recharge ${r.name} d6 = ${roll}, ${r.ready ? 'ready' : 'not yet'}`); flash(`${r.name}: rolled ${roll}, ${r.ready ? 'recharged!' : 'not yet'}`); }); break;
      case 'rech-set': if (e) act(() => { const r = e.recharges.find((x) => x.name === b.dataset.r); if (r) r.ready = true; }); break;
      case 'ctr': if (e) act(() => { const k = e.counters[Number(b.dataset.i)]; k.used = k.used >= k.max ? 0 : k.used + 1; }); break;
      case 'conc-del': if (e) act(() => { say(`${e.name} stops concentrating on ${e.conc}`); e.conc = undefined; }); break;
      case 'cond-del': if (e) act(() => { e.conditions = e.conditions.filter((k) => k.id !== b.dataset.c); }); break;
      case 'save-pass': if (e) act(() => { const k = e.conditions.find((x) => x.id === b.dataset.c); e.conditions = e.conditions.filter((x) => x !== k); if (k) say(`${e.name} saves: ${k.name} ends`); }); break;
      case 'cond-add': if (e) { const box = b.closest('.ic-addcond')!; const v = (f: string) => (box.querySelector(`[data-f="${f}"]`) as HTMLInputElement).value; act(() => { const rounds = v('crounds') ? Math.max(1, Number(v('crounds'))) : undefined; addCondition(e, { name: v('cname'), rounds, ends: v('cends') as 'start' | 'end', of: v('cof') || e.id, save: v('csave') || undefined }); say(`${e.name}: ${v('cname')}${rounds ? ` for ${rounds} round${rounds === 1 ? '' : 's'}` : ''}`); }); } break;
      case 'ds-roll': if (e) { const inp = b.parentElement!.querySelector<HTMLInputElement>('[data-f="ds"]')!; const roll = inp.value ? Number(inp.value) : d(20); act(() => { const r = deathSave(e, roll); say(`${r} (rolled ${roll})`); flash(`${r} (rolled ${roll})`); }); } break;
      case 'roll-foes': act(() => { let n = 0; for (const x of clock.entries) if (x.kind === 'combatant' && x.side !== 'pc' && !x.group) { x.init = rollInit(x.mod, prefs.adv); n++; } const groups = new Set(clock.entries.filter((x) => x.group).map((x) => x.group)); for (const g of groups) { const ms = clock.entries.filter((x) => x.group === g); const r = rollInit(ms[0].mod, prefs.adv); ms.forEach((m) => { m.init = r; }); n += ms.length; } say(`Rolled initiative for ${n} creature${n === 1 ? '' : 's'}`); }); break;
      case 'party-all': act(() => { for (const m of party) if (!clock.entries.some((x) => x.src?.type === 'pc' && x.src.partyId === m.id)) addPc(m, null); }); break;
      case 'from-map': fromMap(); break;
      case 'quick-foe': act(() => { const [n] = numbered(clock, 'Foe', 1); clock.entries.push(combatant({ name: n, init: rollInit(0, prefs.adv), hp: { cur: 10, max: 10, temp: 0 }, ac: 12, color: FOE_COLORS[clock.entries.length % FOE_COLORS.length] })); selected = clock.entries[clock.entries.length - 1].id; }); break;
      case 'ed': host.setEdition(b.dataset.e as Rules); catalog = []; render(); break;
      case 'stage-add': { const k = b.dataset.k!; const pool = [...library.map(customItem), ...catalog, ...moduleCatalog()]; const c = pool.find((x) => x.key === k); if (!c) return; const side = b.dataset.s as Side; const have = stage.find((s) => s.key === k && s.side === side); if (have) have.count += 1; else stage.push({ key: k, ref: c.ref, name: c.name, count: 1, cr: c.cr, side }); save(); render(); break; }
      case 'stage-n': { const s = stage[Number(b.dataset.i)]; s.count = Math.max(1, s.count + Number(b.dataset.d)); save(); render(); break; }
      case 'stage-del': stage.splice(Number(b.dataset.i), 1); save(); render(); break;
      case 'stage-clear': stage = []; save(); render(); break;
      case 'stage-go': void goStage(stage); break;
      case 'stage-save': { const name = (dock.querySelector('[data-f="save-name"]') as HTMLInputElement).value.trim() || `Fight ${saved.length + 1}`; saved.push({ id: uid('s'), name, items: structuredClone(stage) }); save(); render(); flash(`Saved "${name}"`); break; }
      case 'saved-load': { const s = saved.find((x) => x.id === id); if (s) { stage = structuredClone(s.items); save(); render(); } break; }
      case 'saved-go': { const s = saved.find((x) => x.id === id); if (s) void goStage(s.items); break; }
      case 'saved-del': if (confirm('Delete this saved fight?')) { saved = saved.filter((x) => x.id !== id); save(); render(); } break;
      case 'paste-read': { const text = (dock.querySelector('[data-f="paste"]') as HTMLTextAreaElement).value; if (!text.trim()) return flash('Paste a stat block first.'); parsedDraft = { text, p: parseBlock(text) }; render(); break; }
      case 'paste-save': if (parsedDraft) { const v = (f: string) => (dock.querySelector(`[data-f="${f}"]`) as HTMLInputElement).value; const p = { ...parsedDraft.p, name: v('pd-name') || 'My creature', ac: Number(v('pd-ac')) || undefined, hp: Number(v('pd-hp')) || undefined, hpDice: v('pd-dice') || undefined, initMod: v('pd-init') === '' ? undefined : Number(v('pd-init')), cr: v('pd-cr') || undefined }; library.push({ id: uid('b'), name: p.name!, text: parsedDraft.text, p }); parsedDraft = null; save(); render(); flash(`Saved "${p.name}" on this device`); } break;
      case 'lib-del': if (confirm('Delete this stat block from this device?')) { library = library.filter((x) => x.id !== id); save(); render(); } break;
      case 'custom-card': showCustom(id, b); break;
      case 'preset': { const p = REMINDER_PRESETS.find((x) => x.id === b.dataset.p)!; remDraft = { ...p }; render(); break; }
      case 'rd-cancel': remDraft = null; render(); break;
      case 'rd-add': addReminderFromForm(); break;
      case 'rem-shift': if (e?.rem) act(() => { e.rem!.atRound = Math.max(clock.round, (e.rem!.atRound ?? clock.round) + Number(b.dataset.d)); }); break;
      case 'p-add': party.push({ id: uid('pc'), name: `Character ${party.length + 1}`, player: '', level: party[0]?.level ?? 1, ac: 12, pp: 10, mod: 0, maxHp: 10, color: PARTY_COLORS[party.length % PARTY_COLORS.length] }); save(); render(); break;
      case 'p-del': if (confirm('Remove this character from the party?')) { party.splice(Number(b.dataset.i), 1); save(); render(); } break;
      case 'p-roster': { const pcs = host.roster(); pcs.forEach((s, i) => { const m = party.find((x) => x.id === s.id) ?? party[i]; if (m) m.name = s.name; else party.push({ id: s.id, name: s.name, player: '', level: 1, ac: 12, pp: 10, mod: s.initMod, maxHp: 10, color: s.color }); }); save(); render(); break; }
      case 'export': { const blob = new Blob([JSON.stringify({ clock, party, saved }, null, 1)], { type: 'application/json' }); const u = URL.createObjectURL(blob); const l = document.createElement('a'); l.href = u; l.download = `initiative-${new Date().toISOString().slice(0, 10)}.json`; l.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); break; }
    }
  });

  const goStage = async (items: StageItem[]) => {
    undo.push(JSON.stringify(clock)); redo = [];
    const made = await addCreatures(items);
    save(); prefs.tab = 'order'; render(); flash(`${made.length} added to the clock`);
  };
  const announce = () => {
    const e = byId(clock.active ?? ''); if (!e) return;
    if (e.kind === 'reminder') flash(`⏰ ${e.rem?.text ?? e.name}`);
  };
  const endFight = () => {
    const foes = clock.entries.filter((e) => e.kind === 'combatant' && e.side === 'foe');
    const xp = foes.filter((e) => e.defeated).reduce((a, e) => a + (e.xp ?? xpForCr(e.cr) ?? 0), 0);
    if (!confirm(`End the fight after ${clock.round} round${clock.round === 1 ? '' : 's'}?\n\nDefeated foes are worth ${xp.toLocaleString('en-US')} XP${party.length ? `, ${Math.floor(xp / party.length).toLocaleString('en-US')} each for ${party.length}` : ''}.\n\nFoes and reminders are cleared; the party stays with its hit points.`)) return;
    act(() => {
      say(`Fight ends after ${clock.round} rounds; ${xp} XP`);
      const keep = clock.entries.filter((e) => e.side === 'pc');
      keep.forEach((e) => { e.init = null; e.conditions = e.conditions.filter((k) => k.rounds === undefined); e.reaction = false; });
      const log = clock.log;
      clock = { ...newClock(), entries: keep, log };
    });
  };
  const addReminderFromForm = () => {
    if (!remDraft) return;
    const v = (f: string) => (dock.querySelector(`[data-f="${f}"]`) as HTMLInputElement | HTMLSelectElement).value;
    const mode = v('rd-mode') as ReminderMode, n = Math.max(1, Number(v('rd-n')) || 1), at = v('rd-at'), text = v('rd-text') || remDraft.text;
    act(() => {
      let init = TOP; const extra: Partial<Entry> = {};
      if (at === 'count') init = Math.max(1, Math.min(DIAL_MAX, Number(v('rd-count')) || 20));
      if (at.startsWith('after:')) { const c = byId(at.slice(6)); if (c?.init != null) { init = c.init; extra.tie = c.tie - 1; } }
      const base = clock.started ? clock.round : 1;
      const r = reminder(text.replace('{n}', String(n)), { mode, atRound: mode === 'countdown' ? base + n : mode === 'once' ? n : mode === 'interval' ? base : undefined, every: mode === 'interval' ? n : undefined, preset: remDraft!.id, term: remDraft!.term }, init, extra);
      clock.entries.push(r); say(`Pinned: ${r.rem!.text}`);
    });
    remDraft = null; render();
  };
  const showCustom = (id: string, anchor: HTMLElement) => {
    const blk = library.find((x) => x.id === id); if (!blk) return;
    document.querySelector('.ic-card')?.remove();
    const card = document.createElement('div'); card.className = 'ic-card page';
    card.innerHTML = `<header><b>${esc(blk.name)}</b><button aria-label="Close">×</button></header><pre>${esc(blk.text)}</pre><small>Your own stat block · on this device only</small>`;
    document.body.appendChild(card);
    const r = anchor.getBoundingClientRect(); card.style.left = `${Math.min(innerWidth - 340, Math.max(8, r.left))}px`; card.style.top = `${Math.min(innerHeight - 200, r.bottom + 6)}px`;
    card.querySelector('button')!.addEventListener('click', () => card.remove());
  };

  // -------------------------------------------------------------- typing

  dock.addEventListener('change', (ev) => {
    const el = ev.target as HTMLInputElement, f = el.dataset.f; if (!f) return;
    const id = el.closest<HTMLElement>('[data-id]')?.dataset.id ?? '', e = byId(id);
    const num = (s: string) => (s.trim() === '' ? null : Number(s));
    if (f === 'init' && e) { const s = el.value.trim().toUpperCase(); act(() => setInit(clock, id, s === 'TOP' ? TOP : num(s))); return; }
    if (f === 'hp' && e) { const r = applyHp(e, el.value, rules()); if (!r) return flash('Type 7 for damage, +7 to heal, t7 for temporary hit points, =7 to set.'); act(() => { applyHp(byId(id)!, el.value, rules()); say(r.text); }); if (r.concentrationDc) flash(`${e.name}: Constitution save DC ${r.concentrationDc} to keep ${e.conc}`); else flash(r.text); return; }
    if (f === 'pc-init') { const m = party.find((x) => x.id === el.dataset.p); if (m) act(() => { const v = num(el.value); if (v === null) { const ex = clock.entries.find((x) => x.src?.type === 'pc' && x.src.partyId === m.id); if (ex) ex.init = null; } else addPc(m, v); }); return; }
    if (e && ['name', 'alias', 'side', 'color', 'ac', 'maxhp', 'mod', 'pp', 'conc', 'readied', 'note'].includes(f)) {
      act(() => {
        const v = el.value;
        if (f === 'name') e.name = v || e.name; else if (f === 'alias') e.alias = v || undefined; else if (f === 'side') e.side = v as Side; else if (f === 'color') e.color = v;
        else if (f === 'ac') e.ac = num(v) ?? undefined; else if (f === 'pp') e.pp = num(v) ?? undefined; else if (f === 'mod') e.mod = num(v) ?? 0;
        else if (f === 'maxhp') { const n = num(v); if (n === null) e.hp = undefined; else e.hp = { cur: Math.min(e.hp?.cur ?? n, n), max: n, temp: e.hp?.temp ?? 0 }; }
        else if (f === 'conc') { e.conc = v || undefined; if (v) say(`${e.name} concentrates on ${v}`); } else if (f === 'readied') e.readied = v || undefined; else if (f === 'note') e.note = v || undefined;
      });
      return;
    }
    if (f.startsWith('p-')) {
      const m = party[Number(el.closest<HTMLElement>('tr')!.dataset.i)]; if (!m) return;
      const k = f.slice(2);
      if (k === 'name') m.name = el.value; else if (k === 'player') m.player = el.value; else if (k === 'color') m.color = el.value;
      else if (k === 'level') m.level = Math.max(1, Math.min(20, Number(el.value) || 1)); else if (k === 'ac') m.ac = Number(el.value) || 0; else if (k === 'pp') m.pp = Number(el.value) || 0; else if (k === 'mod') m.mod = Number(el.value) || 0; else if (k === 'hp') m.maxHp = Number(el.value) || 1;
      // Keep the PC already in the clock in step.
      const e2 = clock.entries.find((x) => x.src?.type === 'pc' && x.src.partyId === m.id);
      if (e2) { e2.name = m.name; e2.color = m.color; e2.ac = m.ac; e2.pp = m.pp; e2.mod = m.mod; if (e2.hp && k === 'hp') { e2.hp.max = m.maxHp; e2.hp.cur = Math.min(e2.hp.cur, m.maxHp); } }
      save(); render(); return;
    }
    if (f === 'stage-n') { const s = stage[Number(el.dataset.i)]; s.count = Math.max(1, Number(el.value) || 1); save(); render(); return; }
    if (f === 'opt-hp') { prefs.hp = el.value as Prefs['hp']; save(); return; }
    if (f === 'opt-group') { prefs.group = el.checked; save(); return; }
    if (f === 'opt-adv') { prefs.adv = el.value as Prefs['adv']; save(); return; }
    if (f === 'opt-hidden') { prefs.hidden = el.checked; save(); return; }
    if (f === 'rd-mode' && remDraft) { remDraft.mode = el.value as ReminderMode; return; }
    if (f === 'rd-at' && remDraft) { remDraft.at = el.value; return; }
    if (f === 'import' && el.files?.[0]) { void el.files[0].text().then((txt) => { try { const j = JSON.parse(txt); if (j.clock?.v === 1) act(() => { clock = j.clock; if (Array.isArray(j.party)) party = j.party; if (Array.isArray(j.saved)) saved = j.saved; }); else flash('Not an initiative clock export.'); } catch { flash('Could not read that file.'); } }); }
  });
  let qTimer = 0;
  dock.addEventListener('input', (ev) => {
    const el = ev.target as HTMLInputElement;
    if (el.dataset.f === 'q') { query = el.value; clearTimeout(qTimer); qTimer = window.setTimeout(render, 140); }
  });
  dock.addEventListener('keydown', (ev) => {
    const el = ev.target as HTMLInputElement;
    if (ev.key === 'Enter' && el.matches('input:not([type=search]):not([type=color])')) { el.blur(); }
  });

  // -------------------------------------------------------------- drag: party and chips onto the dial; the dock by its header

  let drag: { what: string; ghost: HTMLElement | null; x0: number; y0: number; v: number | null; pid: number } | null = null;
  let moveDock: { dx: number; dy: number } | null = null;
  const valueAt = (x: number, y: number): number | null => {
    const svg = dock.querySelector<SVGSVGElement>('.ic-dial'); if (!svg) return null;
    const r = svg.getBoundingClientRect(), s = r.width / 560;
    const dx = (x - r.left) / s - C, dy = (y - r.top) / s - C, dist = Math.hypot(dx, dy);
    if (dist < 96 || dist > 285) return null;
    return initAt(Math.atan2(dx, -dy) * 180 / Math.PI);
  };
  const markDrop = (v: number | null) => {
    dock.querySelectorAll('.ic-n.drop').forEach((n) => n.classList.remove('drop'));
    // The hub shows the count under the finger while dragging.
    const hub = dock.querySelector('.ic-hub'), k = hub?.querySelector('.ic-hub-k'), r = hub?.querySelector('.ic-hub-r'), t = hub?.querySelector('.ic-hub-t');
    if (hub && k && r && t) {
      if (!hub.classList.contains('dropping')) (hub as HTMLElement).dataset.was = JSON.stringify([k.textContent, r.textContent, t.textContent]);
      if (v === null) { const was = JSON.parse((hub as HTMLElement).dataset.was ?? '[]'); if (was.length) [k.textContent, r.textContent, t.textContent] = was; hub.classList.remove('dropping'); }
      else { hub.classList.add('dropping'); k.textContent = 'DROP ON'; r.textContent = v >= TOP ? 'TOP' : String(v); t.textContent = v >= TOP ? 'top of the round' : 'initiative'; }
    }
    if (v !== null) dock.querySelector(`.ic-n[data-n="${v}"]`)?.classList.add('drop');
  };
  dock.addEventListener('pointerdown', (ev) => {
    const t = ev.target as Element;
    const hd = t.closest('[data-drag-dock]');
    if (hd && !t.closest('button')) { const r = dock.getBoundingClientRect(); moveDock = { dx: ev.clientX - r.left, dy: ev.clientY - r.top }; (hd as HTMLElement).setPointerCapture(ev.pointerId); return; }
    const g = t.closest<HTMLElement>('[data-drag]'); if (!g) return;
    drag = { what: g.dataset.drag!, ghost: null, x0: ev.clientX, y0: ev.clientY, v: null, pid: ev.pointerId };
  });
  const onMove = (ev: PointerEvent) => {
    if (moveDock) { prefs.pos = { x: ev.clientX - moveDock.dx, y: ev.clientY - moveDock.dy }; dock.style.left = `${prefs.pos.x}px`; dock.style.top = `${prefs.pos.y}px`; dock.style.right = 'auto'; return; }
    if (!drag || ev.pointerId !== drag.pid) return;
    if (!drag.ghost && Math.hypot(ev.clientX - drag.x0, ev.clientY - drag.y0) < 6) return;
    if (!drag.ghost) {
      const [kind, id] = drag.what.split(':');
      const label = kind === 'party' ? party.find((m) => m.id === id)?.name : byId(id)?.name;
      const color = kind === 'party' ? party.find((m) => m.id === id)?.color : byId(id)?.color;
      drag.ghost = document.createElement('div'); drag.ghost.className = 'ic-ghost'; drag.ghost.textContent = label ?? '?'; drag.ghost.style.setProperty('--c', color ?? '#888');
      document.body.appendChild(drag.ghost); dock.classList.add('dragging');
    }
    ev.preventDefault();
    drag.ghost.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px)`;
    const v = valueAt(ev.clientX, ev.clientY); if (v !== drag.v) { drag.v = v; markDrop(v); }
  };
  const onUp = (ev: PointerEvent) => {
    if (moveDock) { moveDock = null; save(); return; }
    if (!drag || ev.pointerId !== drag.pid) return;
    const dd = drag; drag = null; dock.classList.remove('dragging');
    if (!dd.ghost) {
      // A tap: a chip on the dial selects its row; a party name focuses its number.
      const [kind, id] = dd.what.split(':');
      if (kind === 'entry') { selected = id; prefs.tab = 'order'; render(); dock.querySelector(`.ic-row[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' }); }
      else dock.querySelector<HTMLInputElement>(`[data-f="pc-init"][data-p="${CSS.escape(id)}"]`)?.focus();
      return;
    }
    dd.ghost.remove(); markDrop(null);
    const v = dd.v; if (v === null) return;
    const [kind, id] = dd.what.split(':');
    act(() => {
      if (kind === 'party') { const m = party.find((x) => x.id === id); if (m) { addPc(m, v); say(`${m.name} on ${v >= TOP ? 'top' : v}`); } }
      else { setInit(clock, id, v); const e = byId(id); if (e?.group) clock.entries.filter((x) => x.group === e.group).forEach((x) => { x.init = v; }); }
    });
  };
  addEventListener('pointermove', onMove, { passive: false });
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onUp);

  // -------------------------------------------------------------- keys (only while the clock is open, and not while typing)

  const onKey = (ev: KeyboardEvent) => {
    const t = ev.target as HTMLElement;
    if (t.closest('input, textarea, select, [contenteditable]')) return;
    const k = ev.key.toLowerCase(), mod = ev.ctrlKey || ev.metaKey;
    let hit = true;
    if (mod && k === 'z' && !ev.shiftKey) (dock.querySelector('[data-a="undo"]') as HTMLElement)?.click();
    else if (mod && (k === 'y' || (k === 'z' && ev.shiftKey))) (dock.querySelector('[data-a="redo"]') as HTMLElement)?.click();
    else if (mod) hit = false;
    else if (k === 'n' || (k === ' ' && dock.contains(t))) (dock.querySelector('.ic-tools [data-a="next"]') as HTMLElement)?.click();
    else if (k === 'p') (dock.querySelector('.ic-tools [data-a="prev"]') as HTMLElement)?.click();
    else if (k === 'm') (dock.querySelector('[data-a="mode"]') as HTMLElement)?.click();
    else hit = false;
    if (hit) { ev.preventDefault(); ev.stopImmediatePropagation(); }
  };
  addEventListener('keydown', onKey, true);
  const onEdition = () => { catalog = []; render(); };
  addEventListener(host.editionEvent, onEdition);
  const timer = window.setInterval(() => { if (prefs.tab === 'log' && !drag) render(); }, 5000);

  const close = () => {
    save(); dock.remove(); document.querySelector('.ic-card')?.remove();
    removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onUp);
    removeEventListener('keydown', onKey, true); removeEventListener(host.editionEvent, onEdition); clearInterval(timer);
    open = null;
  };
  open = { el: dock, close };
  render();
  // Debug and test hook.
  (window as unknown as { __initClock?: unknown }).__initClock = { get clock() { return clock; }, get party() { return party; }, render };
}

/** Close the clock if it is open (the fight is kept). */
export function closeInitClock(): void { open?.close(); }
