// The initiative clock: a 1–30 dial of turns with reminders pinned into the order ("reinforcements in 3 rounds",
// "roll recharge", lair actions on 20), conditions that count down on the right turn, hit point maths, death saves,
// concentration checks, legendary actions and encounter difficulty under both the 2014 and the 2024 rules.
// Pure: no DOM, no storage, a seedable dice roller. The UI (ui/initClock.ts) owns drawing, storage and undo.

export type Side = 'pc' | 'ally' | 'foe' | 'neutral';
export type Rules = '2014' | '2024';

/** Where a creature's numbers came from: the SRD books, the module bestiary, the DM's own pasted stat block, a PC. */
export type Source =
  | { type: 'srd'; id: string; edition: Rules }
  | { type: 'module'; creatureId: string }
  | { type: 'custom'; id: string }
  | { type: 'pc'; partyId: string };

export interface Condition {
  id: string;
  name: string;
  /** Rounds left; undefined means until removed. */
  rounds?: number;
  /** Ticks down at the start or the end of `of`'s turn. */
  ends: 'start' | 'end';
  /** Whose turn ticks it (the caster's for "until the end of your next turn", else the creature's own). */
  of: string;
  /** A repeat save, e.g. "WIS 14", prompted at `ends` of the creature's own turn. */
  save?: string;
  note?: string;
}
export interface Recharge { name: string; min: number; ready: boolean }
export interface Counter { name: string; max: number; used: number }

export type ReminderMode = 'every' | 'countdown' | 'once' | 'interval';
export interface Reminder {
  text: string;
  mode: ReminderMode;
  /** countdown / once: the round it comes due; interval: the next round it is due. */
  atRound?: number;
  /** interval: every N rounds. */
  every?: number;
  /** Fired and finished (countdown, once). */
  done?: boolean;
  /** A preset id (core/initClock REMINDER_PRESETS), for its icon and help. */
  preset?: string;
  /** Rules link, e.g. "rule:lair-actions" or "condition:frightened". */
  term?: string;
}

export interface Entry {
  id: string;
  kind: 'combatant' | 'reminder';
  name: string;
  /** What the players call it (a creature they have not identified). */
  alias?: string;
  side: Side;
  color: string;
  /** The initiative count; TOP sits above every roll ("top of the round"); null = not rolled yet. */
  init: number | null;
  /** Initiative bonus. */
  mod: number;
  /** The DM's manual tie order (higher acts first among equal counts). */
  tie: number;
  src?: Source;
  ac?: number;
  hp?: { cur: number; max: number; temp: number };
  /** Passive Perception. */
  pp?: number;
  cr?: string;
  xp?: number;
  conditions: Condition[];
  /** What it is concentrating on. */
  conc?: string;
  legendary?: Counter;
  legres?: Counter;
  recharges: Recharge[];
  counters: Counter[];
  /** Regains hp at the start of its turn; `off` for one turn after the damage that stops it. */
  regen?: { hp: number; stop?: string; off?: boolean };
  death?: { s: number; f: number; stable?: boolean; dead?: boolean };
  /** Reaction spent since its last turn. */
  reaction?: boolean;
  hidden?: boolean;
  delayed?: boolean;
  readied?: string;
  defeated?: boolean;
  note?: string;
  /** Identical creatures rolled together share this. */
  group?: string;
  rem?: Reminder;
}

export interface LogLine { round: number; text: string; at: number }
export interface Clock {
  v: 1;
  round: number;
  /** The entry whose turn it is. */
  active: string | null;
  started: boolean;
  entries: Entry[];
  log: LogLine[];
  startedAt?: number;
  turnStartedAt?: number;
  /** Time spent on each entry's turns, ms. */
  turnMs: Record<string, number>;
  /** Entries that have had their turn this round. */
  acted: string[];
}

/** The count that sits above every roll: "top of the round". */
export const TOP = 100;
export const DIAL_MAX = 30;

export const newClock = (): Clock => ({ v: 1, round: 1, active: null, started: false, entries: [], log: [], turnMs: {}, acted: [] });

let seq = 0;
export const uid = (p = 'e'): string => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export function combatant(p: Partial<Entry> & { name: string }): Entry {
  return { id: uid(), kind: 'combatant', side: 'foe', color: '#8a2b2b', init: null, mod: 0, tie: 0, conditions: [], recharges: [], counters: [], ...p };
}
export function reminder(text: string, r: Partial<Reminder> & { mode: ReminderMode }, init: number = TOP, p: Partial<Entry> = {}): Entry {
  return { id: uid('r'), kind: 'reminder', name: text, side: 'neutral', color: '#7a6a4a', init, mod: 0, tie: -1, conditions: [], recharges: [], counters: [], rem: { text, ...r }, ...p };
}

// ------------------------------------------------------------------ dice

export type Rng = () => number;
export const d = (sides: number, rng: Rng = Math.random): number => Math.floor(rng() * sides) + 1;
/** Roll "2d8+4" (or a plain number). */
export function rollExpr(expr: string, rng: Rng = Math.random): number | null {
  const s = expr.replace(/\s+/g, '').replace(/[−–]/g, '-');
  if (/^-?\d+$/.test(s)) return Number(s);
  const m = /^(\d*)d(\d+)([+-]\d+)?$/i.exec(s); if (!m) return null;
  let t = 0; for (let i = 0; i < Number(m[1] || 1); i++) t += d(Number(m[2]), rng);
  return t + Number(m[3] ?? 0);
}
/** Average of "2d8+4", rounded down (the stat-block convention). */
export function avgExpr(expr: string): number | null {
  const s = expr.replace(/\s+/g, '').replace(/[−–]/g, '-');
  const m = /^(\d*)d(\d+)([+-]\d+)?$/i.exec(s); if (!m) return /^\d+$/.test(s) ? Number(s) : null;
  return Math.floor(Number(m[1] || 1) * (Number(m[2]) + 1) / 2) + Number(m[3] ?? 0);
}
/** A d20 initiative roll: normal, with advantage or with disadvantage (2024 surprise). */
export function rollInit(mod: number, mode: 'normal' | 'adv' | 'dis' = 'normal', rng: Rng = Math.random): number {
  const a = d(20, rng), b = mode === 'normal' ? a : d(20, rng);
  return (mode === 'adv' ? Math.max(a, b) : mode === 'dis' ? Math.min(a, b) : a) + mod;
}

// ------------------------------------------------------------------ order

const due = (e: Entry, round: number): boolean => {
  const r = e.rem; if (!r) return true;
  if (r.done) return false;
  if (r.mode === 'every') return true;
  return (r.atRound ?? 1) <= round;
};
/** The order, top first: higher count, then the DM's tie order, then combatants before reminders on the same count
 *  (lair actions lose ties), then the higher bonus. Unrolled entries come last. */
export function ordered(c: Clock): Entry[] {
  const key = (e: Entry) => e.init ?? -Infinity;
  return [...c.entries].sort((a, b) => key(b) - key(a) || b.tie - a.tie || (a.kind === b.kind ? 0 : a.kind === 'combatant' ? -1 : 1) || b.mod - a.mod || a.name.localeCompare(b.name));
}
/** Whether the clock stops on this entry this round. A downed creature is skipped; a PC at 0 keeps the turn (it is
 *  the death save). A reminder stops only when it is due. */
export function takesTurn(e: Entry, round: number): boolean {
  if (e.init === null || e.delayed) return false;
  if (e.kind === 'reminder') return due(e, round);
  if (e.side === 'pc') return !e.death?.dead;
  return !e.defeated;
}

/** Rounds until a reminder fires (0 = this round), or undefined when it does not count down. */
export function roundsLeft(e: Entry, round: number): number | undefined {
  const r = e.rem; if (!r || r.done || r.mode === 'every') return undefined;
  return Math.max(0, (r.atRound ?? round) - round);
}

// ------------------------------------------------------------------ turns

const log = (c: Clock, text: string, now: number) => { c.log.push({ round: c.round, text, at: now }); if (c.log.length > 400) c.log.splice(0, c.log.length - 400); };

/** Tick the conditions that end on this edge of `who`'s turn. */
function tick(c: Clock, who: string, edge: 'start' | 'end', now: number): void {
  for (const e of c.entries) {
    e.conditions = e.conditions.filter((k) => {
      if (k.of !== who || k.ends !== edge || k.rounds === undefined) return true;
      k.rounds -= 1;
      if (k.rounds > 0) return true;
      log(c, `${e.name}: ${k.name} ends`, now);
      return false;
    });
  }
}

/** The start of an entry's turn: reaction back, legendary uses back, regeneration, and its conditions tick. */
function enter(c: Clock, e: Entry, now: number): void {
  c.turnStartedAt = now;
  if (e.kind === 'combatant') {
    e.reaction = false;
    if (e.legendary) e.legendary.used = 0;
    if (e.readied) { log(c, `${e.name}'s readied action lapses: ${e.readied}`, now); e.readied = undefined; }
    if (e.regen && e.hp && !e.defeated) {
      if (e.regen.off) { log(c, `${e.name}: no regeneration this turn`, now); e.regen.off = false; }
      else if (e.hp.cur > 0 && e.hp.cur < e.hp.max) { const g = Math.min(e.regen.hp, e.hp.max - e.hp.cur); e.hp.cur += g; log(c, `${e.name} regenerates ${g}`, now); }
    }
  }
  tick(c, e.id, 'start', now);
}
/** The end of an entry's turn: its conditions tick, a fired reminder is done or rescheduled. */
function leave(c: Clock, e: Entry, now: number): void {
  if (c.turnStartedAt) c.turnMs[e.id] = (c.turnMs[e.id] ?? 0) + Math.max(0, now - c.turnStartedAt);
  if (!c.acted.includes(e.id)) c.acted.push(e.id);
  tick(c, e.id, 'end', now);
  const r = e.rem;
  if (r && due(e, c.round)) {
    if (r.mode === 'countdown' || r.mode === 'once') { r.done = true; log(c, `${r.text} (done)`, now); }
    if (r.mode === 'interval') r.atRound = c.round + Math.max(1, r.every ?? 1);
  }
}

/** Start the fight: round 1, the first entry that takes a turn. */
export function start(c: Clock, now = Date.now()): Clock {
  c.started = true; c.round = 1; c.acted = []; c.startedAt = now; c.turnMs = {};
  const first = ordered(c).find((e) => takesTurn(e, 1));
  c.active = first?.id ?? null;
  log(c, 'Initiative! Round 1', now);
  if (first) enter(c, first, now);
  return c;
}

/** Pass the turn on; wrapping past the bottom starts the next round. Returns the reminders that came due. */
export function next(c: Clock, now = Date.now()): Clock {
  if (!c.started) return start(c, now);
  const list = ordered(c);
  const cur = list.find((e) => e.id === c.active);
  if (cur) leave(c, cur, now);
  let i = cur ? list.indexOf(cur) : -1;
  for (let n = 0; n <= list.length; n++) {
    i += 1;
    if (i >= list.length) { i = 0; c.round += 1; c.acted = []; log(c, `Round ${c.round}`, now); }
    const e = list[i];
    if (e && takesTurn(e, c.round)) { c.active = e.id; enter(c, e, now); return c; }
  }
  c.active = null; return c;
}
/** Step back one turn (a slip of the thumb). Nothing is un-ticked: that is what undo is for. */
export function prev(c: Clock): Clock {
  const list = ordered(c);
  let i = list.findIndex((e) => e.id === c.active);
  for (let n = 0; n <= list.length; n++) {
    i -= 1;
    if (i < 0) { if (c.round <= 1) { i = list.findIndex((e) => e.id === c.active); break; } i = list.length - 1; c.round -= 1; }
    const e = list[i];
    if (e && takesTurn(e, c.round)) { c.active = e.id; c.acted = c.acted.filter((x) => x !== e.id); return c; }
  }
  return c;
}
/** Jump to an entry's turn (the DM taps it on the dial). */
export function jump(c: Clock, id: string, now = Date.now()): Clock {
  const e = c.entries.find((x) => x.id === id); if (!e) return c;
  if (!c.started) { c.started = true; c.startedAt = now; }
  const cur = c.entries.find((x) => x.id === c.active);
  if (cur && cur !== e) leave(c, cur, now);
  c.active = e.id; e.delayed = false; enter(c, e, now);
  return c;
}
/** Delay: the entry steps out of the order; `resume` puts it back in right after the current turn. */
export function delay(c: Clock, id: string, now = Date.now()): Clock {
  const e = c.entries.find((x) => x.id === id); if (!e) return c;
  const wasActive = c.active === id;
  if (wasActive) next(c, now);
  e.delayed = true; log(c, `${e.name} delays`, now);
  return c;
}
export function resume(c: Clock, id: string, now = Date.now()): Clock {
  const e = c.entries.find((x) => x.id === id), cur = c.entries.find((x) => x.id === c.active); if (!e) return c;
  e.delayed = false;
  // Re-slot just after the current combatant (2014 "delay" house rule; 2024 has no delay, so the DM chooses it).
  if (cur && cur.init !== null && cur !== e) {
    e.init = cur.init;
    const same = ordered(c).filter((x) => x.init === cur.init && x !== e);
    same.splice(same.indexOf(cur) + 1, 0, e);
    same.forEach((x, k) => { x.tie = same.length - k; });
  }
  log(c, `${e.name} acts now`, now);
  return jump(c, id, now);
}

/** Set a count; ties keep their DM order. */
export function setInit(c: Clock, id: string, init: number | null): Clock {
  const e = c.entries.find((x) => x.id === id); if (!e) return c;
  e.init = init === null || Number.isNaN(init) ? null : Math.round(init);
  return c;
}
/** Move an entry up or down among the entries on its own count (the DM's tie break). */
export function nudgeTie(c: Clock, id: string, dir: 1 | -1): Clock {
  const e = c.entries.find((x) => x.id === id); if (!e || e.init === null) return c;
  const same = ordered(c).filter((x) => x.init === e.init);
  const i = same.indexOf(e), j = i - dir;
  if (j < 0 || j >= same.length) return c;
  same.splice(i, 1); same.splice(j, 0, e);
  same.forEach((x, k) => { x.tie = same.length - k; });
  return c;
}

// ------------------------------------------------------------------ hit points

export interface HpResult { text: string; concentrationDc?: number; down?: boolean; dead?: boolean }
/** Apply "7" or "-7" (damage), "+7" (healing), "t7" (temporary hp), "=7" (set). Temporary hp soak first. */
export function applyHp(e: Entry, input: string, rules: Rules): HpResult | null {
  const s = input.trim().replace(/[−–]/g, '-'); if (!s || !e.hp) return null;
  const hp = e.hp;
  const m = /^([+\-=t]?)\s*(\d+)$/i.exec(s); if (!m) return null;
  const n = Number(m[2]), op = m[1].toLowerCase();
  if (op === 't') { hp.temp = Math.max(hp.temp, n); return { text: `${e.name} has ${hp.temp} temporary hp` }; }
  if (op === '=') { hp.cur = Math.min(hp.max, n); if (hp.cur > 0) revive(e); return { text: `${e.name} set to ${hp.cur} hp` }; }
  if (op === '+') {
    const was = hp.cur; hp.cur = Math.min(hp.max, hp.cur + n);
    if (was === 0 && hp.cur > 0) revive(e);
    return { text: `${e.name} heals ${hp.cur - was}` };
  }
  // damage
  const soak = Math.min(hp.temp, n); hp.temp -= soak;
  const rest = n - soak, was = hp.cur;
  const out: HpResult = { text: `${e.name} takes ${n}${soak ? ` (${soak} temporary)` : ''}` };
  if (e.conc && n > 0) out.concentrationDc = concentrationDc(n, rules);
  if (was === 0 && e.side === 'pc' && rest > 0) {
    // At 0 hp: a failed death save (a critical hit is two; the DM taps the second).
    if (rest >= hp.max) { e.death = { s: 0, f: 3, dead: true }; out.dead = true; out.text += ': massive damage, dead'; return out; }
    e.death = { s: e.death?.s ?? 0, f: Math.min(3, (e.death?.f ?? 0) + 1), stable: false };
    if (e.death.f >= 3) { e.death.dead = true; out.dead = true; out.text += ': third failed death save'; }
    else out.text += `: a failed death save (${e.death.f}/3)`;
    return out;
  }
  hp.cur = Math.max(0, was - rest);
  if (hp.cur === 0 && was > 0) {
    out.down = true;
    if (e.side === 'pc') {
      // Massive damage: what is left over after reaching 0 equals or beats the hp maximum.
      if (rest - was >= hp.max) { e.death = { s: 0, f: 3, dead: true }; out.dead = true; out.text += ': massive damage, dead'; }
      else { e.death = { s: 0, f: 0 }; addCondition(e, { name: 'Unconscious', of: e.id, ends: 'end' }); out.text += ': down, making death saves'; }
    } else { e.defeated = true; out.text += ': down'; }
    if (e.conc) { out.text += `; concentration on ${e.conc} ends`; e.conc = undefined; out.concentrationDc = undefined; }
  }
  return out;
}
function revive(e: Entry): void {
  e.defeated = false; e.death = undefined;
  e.conditions = e.conditions.filter((k) => k.name !== 'Unconscious');
}
/** The Constitution save to keep concentrating: DC 10 or half the damage, whichever is higher (2024: at most 30). */
export function concentrationDc(damage: number, rules: Rules): number {
  const dc = Math.max(10, Math.floor(damage / 2));
  return rules === '2024' ? Math.min(30, dc) : dc;
}
/** A death save result: d20 roll as typed by the player. 20 = 1 hp back; 1 = two failures. */
export function deathSave(e: Entry, roll: number): string {
  const ds = e.death ?? (e.death = { s: 0, f: 0 });
  if (roll >= 20) { if (e.hp) e.hp.cur = 1; revive(e); return `${e.name} rolls a 20 and is back up with 1 hp`; }
  if (roll <= 1) ds.f += 2; else if (roll >= 10) ds.s += 1; else ds.f += 1;
  if (ds.f >= 3) { ds.f = 3; ds.dead = true; return `${e.name} dies`; }
  if (ds.s >= 3) { ds.s = 3; ds.stable = true; return `${e.name} is stable`; }
  return `${e.name}: ${ds.s} successes, ${ds.f} failures`;
}

export function addCondition(e: Entry, k: Omit<Condition, 'id'>): Condition {
  const prev = e.conditions.find((x) => x.name === k.name && x.of === k.of);
  if (prev) { Object.assign(prev, k); return prev; }
  const c = { id: uid('c'), ...k }; e.conditions.push(c); return c;
}

// ------------------------------------------------------------------ prompts: what to check on this turn

export interface Prompt { kind: 'recharge' | 'regen' | 'death' | 'save' | 'legendary' | 'conc' | 'reminder' | 'lair' | 'counter' | 'note'; text: string; ref?: string }
/** What the DM checks at the start of an entry's turn, and after it (other creatures' legendary actions). */
export function prompts(c: Clock, e: Entry | undefined): { start: Prompt[]; after: Prompt[] } {
  const start: Prompt[] = [], after: Prompt[] = [];
  if (!e) return { start, after };
  if (e.kind === 'reminder' && e.rem) start.push({ kind: e.rem.preset === 'lair' ? 'lair' : 'reminder', text: e.rem.text });
  for (const r of e.recharges) if (!r.ready) start.push({ kind: 'recharge', text: `Roll recharge for ${r.name} (${r.min === 6 ? '6' : `${r.min}–6`})`, ref: r.name });
  if (e.regen && e.hp && !e.defeated) start.push({ kind: 'regen', text: e.regen.off ? `No regeneration this turn (${e.regen.stop ?? 'it took the damage that stops it'})` : `Regenerates ${e.regen.hp}${e.regen.stop ? ` unless ${e.regen.stop}` : ''}` });
  if (e.side === 'pc' && e.hp && e.hp.cur === 0 && !e.death?.stable && !e.death?.dead) start.push({ kind: 'death', text: 'Death saving throw' });
  if (e.legendary && e.legendary.max) start.push({ kind: 'legendary', text: `Legendary actions back to ${e.legendary.max}` });
  if (e.conc) start.push({ kind: 'conc', text: `Concentrating on ${e.conc}` });
  for (const k of e.conditions) {
    if (k.save) (k.ends === 'start' ? start : after).push({ kind: 'save', text: `${k.name}: repeat the ${k.save} save at the ${k.ends} of the turn`, ref: k.id });
    if (k.rounds === 1 && k.of === e.id) (k.ends === 'start' ? start : after).push({ kind: 'note', text: `${k.name} ends at the ${k.ends} of this turn` });
  }
  for (const k of e.counters) if (k.used < k.max) start.push({ kind: 'counter', text: `${k.name}: ${k.max - k.used} of ${k.max} left` });
  if (e.note) start.push({ kind: 'note', text: e.note });
  // After this turn: anyone else with legendary actions left may act.
  for (const o of c.entries) if (o !== e && o.legendary && o.legendary.used < o.legendary.max && !o.defeated) after.push({ kind: 'legendary', text: `${o.name} may take a legendary action (${o.legendary.max - o.legendary.used} left)`, ref: o.id });
  return { start, after };
}

// ------------------------------------------------------------------ stat blocks: the numbers the clock needs

export interface ParsedBlock {
  name?: string; ac?: number; hp?: number; hpDice?: string; initMod?: number; dex?: number; cr?: string; xp?: number; pp?: number; speed?: string;
  legendary?: number; legres?: number; recharges: Recharge[]; perDay: Counter[]; regen?: { hp: number; stop?: string }; lair?: boolean;
}
const strip = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, ' ');
/** Read the clock's numbers from a stat block: the SRD's HTML, or plain text the DM pasted from a book they own. */
export function parseBlock(text: string): ParsedBlock {
  const t = strip(text).replace(/[−–—]/g, '-');
  const num = (re: RegExp) => { const m = re.exec(t); return m ? Number(m[1]) : undefined; };
  const out: ParsedBlock = { recharges: [], perDay: [] };
  const first = text.trim().split(/\n/)[0]?.trim();
  if (first && first.length < 60 && !/[<:]/.test(first) && !/^(armor|ac|hit|tiny|small|medium|large|huge|gargantuan)\b/i.test(first)) out.name = first;
  out.ac = num(/\b(?:Armor Class|AC)\s+(\d+)/i);
  const hp = /\b(?:Hit Points|HP)\s+(\d+)(?:\s*\(([\dd\s+\-]+)\))?/i.exec(t);
  if (hp) { out.hp = Number(hp[1]); if (hp[2]) out.hpDice = hp[2].replace(/\s+/g, ''); }
  const init = /\bInitiative\s+([+-]\d+)/i.exec(t); if (init) out.initMod = Number(init[1]);
  const abil = /\bSTR\b[^A-Za-z]*?(\d+)\s*\(([+-]?\d+)\)\s*DEX\b[^A-Za-z]*?(\d+)/i.exec(t);
  if (abil) out.dex = Number(abil[3]);
  const cr = /\b(?:Challenge|CR)\s+(\d+\/\d+|\d+)\s*\((?:XP\s*)?([\d,]+)/i.exec(t) ?? /\b(?:Challenge|CR)\s+(\d+\/\d+|\d+)/i.exec(t);
  if (cr) { out.cr = cr[1]; if (cr[2]) out.xp = Number(cr[2].replace(/,/g, '')); }
  out.pp = num(/passive Perception\s+(\d+)/i);
  const sp = /\bSpeed\s+(\d+\s*ft\.?[^A-Z]*)/i.exec(t); if (sp) out.speed = sp[1].trim().replace(/[.;,]$/, '');
  out.legendary = num(/can take (\d+) legendary actions/i) ?? num(/Legendary Action Uses:?\s*(\d+)/i);
  out.legres = num(/Legendary Resistance \((\d+)\/Day/i);
  // Named abilities start a paragraph (the SRD's HTML) or a line (pasted text).
  const lines = text.replace(/<\/?(?:p|li|h\d|br|div|tr)[^>]*>/gi, '\n').split(/\n/).map((l) => strip(l).replace(/[−–—]/g, '-').trim()).filter(Boolean);
  const seen = new Set<string>();
  for (const l of lines) {
    const r = /^([A-Z][^.()]{0,40}?)\s*\(Recharge (\d)(?:\s*-\s*6)?\)/.exec(l);
    if (r && !seen.has(r[1])) { seen.add(r[1]); out.recharges.push({ name: r[1].trim(), min: Number(r[2]), ready: true }); continue; }
    const p = /^([A-Z][^.()]{0,40}?)\s*\((\d)\/Day(?: each)?[^)]*\)/.exec(l);
    if (p && !/^Legendary Resistance$/i.test(p[1].trim()) && !seen.has(p[1])) { seen.add(p[1]); out.perDay.push({ name: p[1].trim(), max: Number(p[2]), used: 0 }); }
  }
  const rg = /regains (\d+) hit points at the start of (?:its|each of its) turns?\.?(?:\s*If [^.]*?takes ([\w\s,]+?) damage)?/i.exec(t);
  if (rg) out.regen = { hp: Number(rg[1]), stop: rg[2] ? `it took ${rg[2].trim().toLowerCase()} damage` : undefined };
  out.lair = /\bin (?:its )?lair\b/i.test(t) || /\bLair Actions\b/i.test(t);
  return out;
}
export const abilityMod = (score: number): number => Math.floor((score - 10) / 2);

// ------------------------------------------------------------------ encounter difficulty, both rule sets (SRD numbers)

const CR_XP: Record<string, number> = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800, '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
  '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000, '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
  '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000, '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000,
};
export const xpForCr = (cr: string | undefined): number | undefined => (cr === undefined ? undefined : CR_XP[String(cr).trim()]);
/** 2014 per-character thresholds: easy, medium, hard, deadly. */
const T2014: [number, number, number, number][] = [
  [25, 50, 75, 100], [50, 100, 150, 200], [75, 150, 225, 400], [125, 250, 375, 500], [250, 500, 750, 1100], [300, 600, 900, 1400], [350, 750, 1100, 1700],
  [450, 900, 1400, 2100], [550, 1100, 1600, 2400], [600, 1200, 1900, 2800], [800, 1600, 2400, 3600], [1000, 2000, 3000, 4500], [1100, 2200, 3400, 5100],
  [1250, 2500, 3800, 5700], [1400, 2800, 4300, 6400], [1600, 3200, 4800, 7200], [2000, 3900, 5900, 8800], [2100, 4200, 6300, 9500], [2400, 4900, 7300, 10900], [2800, 5700, 8500, 12700],
];
/** 2024 per-character budgets: low, moderate, high. */
const B2024: [number, number, number][] = [
  [50, 75, 100], [100, 150, 200], [150, 225, 400], [250, 375, 500], [500, 750, 1100], [600, 1000, 1400], [750, 1300, 1700], [1000, 1700, 2100], [1300, 2000, 2600], [1600, 2300, 3100],
  [1900, 2900, 4100], [2200, 3700, 4700], [2600, 4200, 5400], [2900, 4900, 6200], [3300, 5400, 7800], [3800, 6100, 9800], [4500, 7200, 11700], [5000, 8700, 14200], [5500, 10700, 17200], [6400, 13200, 22000],
];
const MULTS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];
/** The 2014 multiplier for a number of monsters, shifted a step for parties under three or over five. */
export function multiplier2014(monsters: number, party: number): number {
  let i = monsters <= 0 ? 1 : monsters === 1 ? 1 : monsters === 2 ? 2 : monsters <= 6 ? 3 : monsters <= 10 ? 4 : monsters <= 14 ? 5 : 6;
  if (party < 3) i += 1; else if (party > 5) i -= 1;
  return MULTS[Math.max(0, Math.min(MULTS.length - 1, i))];
}
export interface Difficulty {
  xp: number;
  y2014: { adjusted: number; multiplier: number; label: string; thresholds: [number, number, number, number] };
  y2024: { label: string; budgets: [number, number, number] };
}
const lvl = (n: number) => Math.max(1, Math.min(20, Math.round(n || 1))) - 1;
/** Difficulty of a set of monsters (their CRs) against a party (their levels), in both rule sets. */
export function difficulty(crs: (string | undefined)[], levels: number[]): Difficulty {
  const xps = crs.map(xpForCr).filter((x): x is number => x !== undefined);
  const xp = xps.reduce((a, b) => a + b, 0);
  const t = [0, 1, 2, 3].map((i) => levels.reduce((a, l) => a + T2014[lvl(l)][i], 0)) as [number, number, number, number];
  const mult = multiplier2014(xps.length, levels.length), adj = Math.round(xp * mult);
  const l14 = !xp ? 'none' : adj >= t[3] ? 'deadly' : adj >= t[2] ? 'hard' : adj >= t[1] ? 'medium' : adj >= t[0] ? 'easy' : 'trivial';
  const b = [0, 1, 2].map((i) => levels.reduce((a, l) => a + B2024[lvl(l)][i], 0)) as [number, number, number];
  const l24 = !xp ? 'none' : xp > b[2] ? 'beyond high' : xp > b[1] ? 'high' : xp > b[0] ? 'moderate' : 'low';
  return { xp, y2014: { adjusted: adj, multiplier: mult, label: l14, thresholds: t }, y2024: { label: l24, budgets: b } };
}

/** Number copies of one creature: "Ghoul 1", "Ghoul 2"… continuing from those already in the clock. */
export function numbered(c: Clock, base: string, count: number): string[] {
  const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?: (\\d+))?$`);
  let n = 0; for (const e of c.entries) { const m = re.exec(e.name); if (m) n = Math.max(n, Number(m[1] ?? 1)); }
  if (count === 1 && n === 0) return [base];
  if (n === 1) { const solo = c.entries.find((e) => e.name === base); if (solo) solo.name = `${base} 1`; }
  return Array.from({ length: count }, (_, i) => `${base} ${n + i + 1}`);
}

/** Game time of a fight: six seconds a round. */
export const gameTime = (round: number): string => { const s = Math.max(0, round - 1) * 6; return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60 ? `${s % 60} s` : ''}`.trim(); };

// ------------------------------------------------------------------ the dial's geometry

/** Degrees clockwise from the top for a count: 30 just right of the top, 1 just left of it; the very top is the
 *  top of the round (TOP and counts over 30 sit there; counts under 1 sit with 1). */
export function angleOf(init: number | null): number {
  if (init === null) return 180;
  if (init > DIAL_MAX) return 0;
  const v = Math.max(1, Math.min(DIAL_MAX, init));
  return 6 + (DIAL_MAX - v) * 12;
}
/** The count under an angle (degrees clockwise from the top): the top sector is the top of the round. */
export function initAt(deg: number): number {
  const a = ((deg % 360) + 360) % 360;
  if (a < 1 || a > 359) return TOP;
  return Math.max(1, Math.min(DIAL_MAX, Math.round(DIAL_MAX - (a - 6) / 12)));
}

// ------------------------------------------------------------------ reminders: the "top of the order" checks

export interface Preset {
  id: string;
  label: string;
  /** Default reminder text; {n} is the number the DM sets. */
  text: string;
  mode: ReminderMode;
  /** Where it sits: the top of the round, or an initiative count. */
  init: number;
  /** The default for the number: rounds for countdowns, the interval for intervals. */
  n?: number;
  group: 'Timing' | 'Creatures' | 'Spells and effects' | 'Battlefield' | 'Table';
  help: string;
  term?: string;
}
/** The checks DMs pin into the order, gathered from the rules (both editions), other trackers and DM practice. */
export const REMINDER_PRESETS: Preset[] = [
  { id: 'reinforce', group: 'Timing', label: 'Reinforcements', text: 'Reinforcements arrive', mode: 'countdown', init: TOP, n: 3, help: 'Counts down and stops the clock at the top of the round they arrive.' },
  { id: 'countdown', group: 'Timing', label: 'Countdown', text: 'Countdown ends', mode: 'countdown', init: TOP, n: 3, help: 'Any "in N rounds": a ritual completing, a door giving way, the ceiling coming down.' },
  { id: 'every-n', group: 'Timing', label: 'Every N rounds', text: 'Recurring event', mode: 'interval', init: TOP, n: 2, help: 'Repeats on a beat: a wave of undead every 2 rounds, a bell tolling, a pulse of necrotic energy.' },
  { id: 'top', group: 'Timing', label: 'Top of round check', text: 'Top of the round', mode: 'every', init: TOP, help: 'A stop every round before anyone acts: morale, positions, weather.' },
  { id: 'surprise', group: 'Timing', label: 'Surprise', text: 'Surprised creatures: 2014 no move or action in round 1 (no reaction until its turn ends); 2024 disadvantage on initiative', mode: 'once', init: TOP, n: 1, help: 'Round 1 only. The two editions handle surprise differently.', term: 'rule:surprise' },
  { id: 'lair', group: 'Creatures', label: 'Lair actions (20)', text: 'Lair action', mode: 'every', init: 20, help: 'On initiative count 20, losing all ties. The same action cannot repeat two rounds running.', term: 'rule:lair-actions' },
  { id: 'recharge', group: 'Creatures', label: 'Recharge roll', text: 'Roll recharge (5–6)', mode: 'every', init: TOP, help: 'For a creature not in the clock as a combatant. Combatants get their recharge prompts automatically from their stat block.' },
  { id: 'legendary', group: 'Creatures', label: 'Legendary actions', text: 'Legendary action available after each turn', mode: 'every', init: TOP, help: 'A nudge for a boss run off-clock. Combatants with legendary actions get pips and after-turn prompts automatically.' },
  { id: 'regen', group: 'Creatures', label: 'Regeneration', text: 'Regeneration (unless it took the damage that stops it)', mode: 'every', init: TOP, help: 'Vampires, spawn and trolls. Automatic for combatants whose stat block has it.' },
  { id: 'morale', group: 'Creatures', label: 'Morale check', text: 'Morale: do the foes flee? (leader down, half fallen)', mode: 'every', init: TOP, help: 'An optional rule from the 2014 DMG: a DC 10 Wisdom save, or simply judge it.' },
  { id: 'spawn', group: 'Creatures', label: 'Rising dead', text: 'The fallen rise', mode: 'countdown', init: TOP, n: 1, help: 'Something killed comes back after a delay (spawn, zombies, the hungry dead).' },
  { id: 'summon', group: 'Creatures', label: 'Summon or companion', text: 'Summoned creatures act', mode: 'every', init: TOP, help: '2024 summons and companions act right after their summoner; put this just under them.' },
  { id: 'conc', group: 'Spells and effects', label: 'Concentration ends', text: 'Spell ends (1 minute)', mode: 'countdown', init: TOP, n: 10, help: 'A one-minute spell lasts 10 rounds; ten minutes is 100.' },
  { id: 'aura', group: 'Spells and effects', label: 'Zone damage', text: 'Starts its turn in the zone: damage', mode: 'every', init: TOP, help: 'Spirit Guardians, Moonbeam, Cloud of Daggers, Wall of Fire, a burning floor.' },
  { id: 'ongoing', group: 'Spells and effects', label: 'Ongoing damage', text: 'Ongoing damage (fire, poison, bleeding)', mode: 'every', init: TOP, help: 'Damage at the start of a turn until someone puts it out or saves.' },
  { id: 'resave', group: 'Spells and effects', label: 'Repeat save', text: 'Repeat the save at the end of the turn', mode: 'every', init: TOP, help: 'Hold Person, a ghoul\'s paralysis, Frightened. For combatants, add a condition with a save instead.' },
  { id: 'hazard', group: 'Battlefield', label: 'Hazard', text: 'Hazard triggers', mode: 'every', init: 10, help: 'Rising water, fire spreading, a swinging blade, collapsing floor on count 10.' },
  { id: 'light', group: 'Battlefield', label: 'Light changes', text: 'The light changes (torches gutter, dawn breaks)', mode: 'countdown', init: TOP, n: 5, help: 'Matters in Barovia: sunlight and darkness change what vampires can do.' },
  { id: 'environment', group: 'Battlefield', label: 'The place acts', text: 'The place itself acts', mode: 'every', init: 20, help: 'A haunted house, a storm, a mist: something that is not a creature but takes a turn.' },
  { id: 'ready', group: 'Table', label: 'Readied trigger', text: 'Readied action trigger', mode: 'every', init: TOP, help: 'A note to watch for a readied trigger. Combatants also have a Ready field.' },
  { id: 'inspiration', group: 'Table', label: 'Inspiration', text: 'Hand out inspiration?', mode: 'interval', init: TOP, n: 3, help: 'A prompt to reward good play.' },
  { id: 'break', group: 'Table', label: 'Check the table', text: 'Check in with the table', mode: 'interval', init: TOP, n: 4, help: 'Pacing: time a recap, a break, or a look at the clock.' },
];

// ------------------------------------------------------------------ prepared fights (the DM's encounter pack)

/** A fight prepared ahead of time (the scenario notes' encounter pack), listed in Build under its dungeon. */
export interface FightCreature { id: string; name: string; count: number | string; cr?: string; note?: string; alias?: string }
export interface PreparedFight { id: string; title: string; group: string; area?: string; trigger?: string; notes?: string; page?: number; source?: string; creatures: FightCreature[] }

const titleCase = (id: string) => id.split('-').map((w, i) => (i === 0 || w.length > 3 ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
/** Read an encounter pack ({schema: 1, encounters: [...]}) into prepared fights, grouped by dungeon: the part of
 * the title before the colon ("Death House: …"), or failing that the group of another fight in the same scene. */
export function fightsFromPack(raw: unknown, nameOf?: (id: string) => string | undefined): PreparedFight[] {
  const list = Array.isArray(raw) ? raw : (raw as { encounters?: unknown })?.encounters;
  if (!Array.isArray(list)) return [];
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const rows: { f: PreparedFight; scene?: string; prefixed: boolean }[] = [];
  for (const r of list as Record<string, unknown>[]) {
    const id = str(r?.id), full = str(r?.title);
    if (!id || !full || !Array.isArray(r.creatures)) continue;
    const creatures: FightCreature[] = [];
    for (const c of r.creatures as Record<string, unknown>[]) {
      const cid = str(c?.id), count = typeof c?.count === 'number' ? c.count : str(c?.count);
      if (!cid || count === undefined) continue;
      creatures.push({ id: cid, name: nameOf?.(cid) ?? titleCase(cid), count, ...(str(c.cr) ? { cr: str(c.cr) } : {}), ...(str(c.note) ? { note: str(c.note) } : {}), ...(str(c.alias) ? { alias: str(c.alias) } : {}) });
    }
    if (!creatures.length) continue;
    const cut = full.indexOf(': '), prefixed = cut > 0 && cut < 40;
    const title = prefixed ? full.slice(cut + 2) : full;
    rows.push({ scene: str(r.scene), prefixed, f: { id, title: title[0].toUpperCase() + title.slice(1), group: prefixed ? full.slice(0, cut) : '', ...(str(r.area) ? { area: str(r.area) } : {}), ...(str(r.trigger) ? { trigger: str(r.trigger) } : {}), ...(str(r.notes) ? { notes: str(r.notes) } : {}), ...(typeof r.page === 'number' ? { page: r.page } : {}), ...(str(r.source) ? { source: str(r.source) } : {}), creatures } });
  }
  for (const row of rows) if (!row.prefixed) row.f.group = rows.find((o) => o.prefixed && o.scene && o.scene === row.scene)?.f.group ?? 'Other fights';
  // fights whose title names no dungeon come last, so the dungeons keep the pack's order
  return [...rows.filter((r) => r.prefixed), ...rows.filter((r) => !r.prefixed)].map((r) => r.f);
}
/** The fights by dungeon, in the pack's order of dungeons, each with its creatures counted out: fixed counts are
 * summed per creature; dice counts are listed as they are written (the DM rolls them). */
export function fightGroups(fights: PreparedFight[]): { group: string; fights: PreparedFight[]; totals: { name: string; count: number; dice: string[] }[]; creatures: number }[] {
  const groups: { group: string; fights: PreparedFight[] }[] = [];
  for (const f of fights) { let g = groups.find((x) => x.group === f.group); if (!g) groups.push(g = { group: f.group, fights: [] }); g.fights.push(f); }
  return groups.map((g) => {
    const totals: { name: string; count: number; dice: string[] }[] = [];
    for (const f of g.fights) for (const c of f.creatures) {
      let t = totals.find((x) => x.name === c.name); if (!t) totals.push(t = { name: c.name, count: 0, dice: [] });
      const n = typeof c.count === 'number' ? c.count : /^\d+$/.test(c.count) ? Number(c.count) : null;
      if (n === null) t.dice.push(String(c.count)); else t.count += n;
    }
    totals.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return { ...g, totals, creatures: totals.reduce((a, t) => a + t.count, 0) };
  });
}
/** The number to place for a count: itself, or the DM's typed roll for dice (within the dice's range). */
export function fightCount(count: number | string, rolled?: number): number | null {
  if (typeof count === 'number') return count >= 0 ? Math.round(count) : null;
  if (/^\s*\d+\s*$/.test(count)) return Number(count);
  const m = /^\s*(\d*)d(\d+)\s*(?:([+-])\s*(\d+))?\s*$/i.exec(count); if (!m) return null;
  const n = Number(m[1] || 1), mod = m[4] ? Number(m[4]) * (m[3] === '-' ? -1 : 1) : 0;
  return rolled !== undefined && Number.isInteger(rolled) && rolled >= Math.max(0, n + mod) && rolled <= n * Number(m[2]) + mod ? rolled : null;
}
