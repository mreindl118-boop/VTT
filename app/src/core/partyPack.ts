// Party packs: the table's player characters as one file the DM keeps outside the repo (names, portraits and
// miniature recipes belong to the table, not to this public code). Loading a pack writes the characters into the
// campaign's roster, puts each one's own token on the map where the last session left them, and moves the party on
// the world map. Pure: the UI (ui/partyPacks.ts) supplies what it knows of the scenes and the atlas.
import type { CampaignState, Sheet, Token } from '../state/campaign';
import type { CreatureSize } from './units';
import type { Vec2 } from './geometry';
import type { HeroFigure } from '../kit/heroes';

export interface PartyCharacter {
  /** A stable slug, also the roster sheet's id (e.g. `pc-tb`). */
  id: string;
  name: string;
  /** The player's name: shown to the DM only (the roster and tooltips). */
  player?: string;
  /** A short tag, e.g. "TB". */
  short?: string;
  level?: number;
  color: string;
  size?: CreatureSize;
  speedFt?: number; reachFt?: number; rangeFt?: number; darkvisionFt?: number; initMod?: number;
  /** A light the character carries or casts (bright and dim radius, feet). */
  light?: { bright: number; dim: number };
  /** A data URL (PNG / JPEG / WebP) for the round token. */
  portrait?: string;
  figure?: HeroFigure;
  notes?: string;
}

export interface PartyPlacement {
  /** VTT scene path under `locations/`, e.g. `ch03/E`. */
  scene: string;
  /** The scene's own location id (tokens are filed under it); the validator fills it in. */
  location?: string;
  level?: string;
  /** Feet, scene coordinates, by character id. Characters left out stand beside the first one. */
  at: Record<string, Vec2>;
  /** World-map pins: where the party is now, and the pins it came by (oldest first). */
  world?: { pin: string; via?: string[] };
  /** Pins the players know of after the last session. */
  reveal?: string[];
  /** Why they stand here: the session and the module's reason. */
  note?: string;
}

export interface PartyPack { schema: 1; kind: 'party'; title?: string; characters: PartyCharacter[]; placement?: PartyPlacement }
export interface Problem { level: 'error' | 'warning'; text: string }

export interface PartyContext {
  /** Built scenes: their levels and each level's floor test. */
  scenes: Map<string, { location: string; levels: { id: string; onFloor: (p: Vec2) => boolean }[] }>;
  /** World-map pins by key, positions in miles. */
  pins: Map<string, Vec2>;
}

const SIZES = new Set(['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan']);
const HEX = /^#[0-9a-f]{6}$/i;
const PORTRAIT = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const num = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/** Check a pack against this build. Errors drop a character (or the placement); warnings say what will differ. */
export function validatePartyPack(raw: unknown, ctx: PartyContext): { pack: PartyPack; problems: Problem[] } {
  const problems: Problem[] = [], err = (text: string) => problems.push({ level: 'error', text }), warn = (text: string) => problems.push({ level: 'warning', text });
  const r = (raw ?? {}) as Record<string, unknown>;
  const pack: PartyPack = { schema: 1, kind: 'party', title: typeof r.title === 'string' ? r.title : undefined, characters: [] };
  if (r.schema !== 1 || r.kind !== 'party') { err('Not a party pack: it needs "schema": 1 and "kind": "party".'); return { pack, problems }; }
  const ids = new Set<string>();
  for (const c of Array.isArray(r.characters) ? r.characters as Record<string, unknown>[] : []) {
    const id = typeof c.id === 'string' ? c.id.trim() : '';
    if (!id || typeof c.name !== 'string' || !c.name.trim()) { err(`A character without an id or a name was skipped.`); continue; }
    if (ids.has(id)) { err(`Character id ${id} is used twice; the second was skipped.`); continue; }
    if (typeof c.color !== 'string' || !HEX.test(c.color)) { err(`${c.name}: colour must be #rrggbb.`); continue; }
    const ch: PartyCharacter = { ...(c as unknown as PartyCharacter), id, name: c.name.trim() };
    if (ch.size && !SIZES.has(ch.size)) { warn(`${ch.name}: size ${ch.size} is unknown; medium is used.`); ch.size = 'medium'; }
    for (const [k, lo, hi] of [['speedFt', 0, 200], ['reachFt', 0, 30], ['rangeFt', 0, 1000], ['darkvisionFt', 0, 300], ['initMod', -10, 20], ['level', 1, 20]] as const) {
      if (ch[k] !== undefined && !num(ch[k], lo, hi)) { warn(`${ch.name}: ${k} is out of range and was left at its default.`); delete ch[k]; }
    }
    if (ch.portrait !== undefined && (typeof ch.portrait !== 'string' || !PORTRAIT.test(ch.portrait))) { warn(`${ch.name}: the portrait is not a PNG, JPEG or WebP data URL; the token shows the colour only.`); delete ch.portrait; }
    if (ch.light && !(num(ch.light.bright, 0, 300) && num(ch.light.dim, 0, 600))) { warn(`${ch.name}: the light needs bright and dim radii in feet; it was left off.`); delete ch.light; }
    ids.add(id); pack.characters.push(ch);
  }
  if (!pack.characters.length) err('The pack has no characters.');
  const p = r.placement as PartyPlacement | undefined;
  if (p) {
    const sc = ctx.scenes.get(p.scene);
    if (!sc) err(`Placement: ${p.scene} is not a built map; nobody is placed.`);
    else {
      const lv = p.level ? sc.levels.find((l) => l.id === p.level) : sc.levels[0];
      if (!lv) err(`Placement: ${p.scene} has no level ${p.level}; nobody is placed.`);
      else {
        const at: Record<string, Vec2> = {};
        for (const [id, pos] of Object.entries(p.at ?? {})) {
          if (!ids.has(id)) { warn(`Placement: ${id} is not one of the pack's characters.`); continue; }
          if (!Array.isArray(pos) || pos.length !== 2 || !pos.every((v) => num(v, -1e5, 1e5))) { warn(`Placement: ${id}'s position is not [x, z] in feet.`); continue; }
          if (!lv.onFloor(pos as Vec2)) warn(`Placement: ${id} at ${pos.join(', ')} is off the floor of ${p.scene}; it stands there anyway.`);
          at[id] = pos as Vec2;
        }
        const world = p.world && ctx.pins.has(p.world.pin) ? { pin: p.world.pin, via: (p.world.via ?? []).filter((k) => ctx.pins.has(k) || (warn(`Placement: no world pin ${k}.`), false)) } : undefined;
        if (p.world && !world) warn(`Placement: no world pin ${p.world.pin}; the world map is left as it is.`);
        const reveal = (p.reveal ?? []).filter((k) => ctx.pins.has(k) || (warn(`Placement: no world pin ${k} to reveal.`), false));
        pack.placement = { scene: p.scene, location: sc.location, level: lv.id, at, world, reveal, note: typeof p.note === 'string' ? p.note : undefined };
      }
    }
  }
  return { pack, problems };
}

/** The roster sheet a character becomes. */
export function sheetOf(c: PartyCharacter): Sheet {
  return { id: c.id, name: c.name, color: c.color, speedFt: c.speedFt ?? 30, reachFt: c.reachFt ?? 5, rangeFt: c.rangeFt ?? 0, initMod: c.initMod ?? 0,
    size: c.size ?? 'medium', darkvisionFt: c.darkvisionFt ?? 0, kind: 'pc', player: c.player, level: c.level, portrait: c.portrait, figure: c.figure };
}

/** The starting sheets newCampaign() gives (pc-1 to pc-4), while the DM has not renamed them. */
const DEFAULT_NAMES: Record<string, string> = { 'pc-1': 'Fighter', 'pc-2': 'Rogue', 'pc-3': 'Cleric', 'pc-4': 'Wizard' };
export const isUntouchedDefault = (s: Sheet) => DEFAULT_NAMES[s.id] === s.name;

export interface ApplyOptions { roster?: boolean; place?: boolean; world?: boolean }
export interface ApplyResult { added: number; updated: number; removedDefaults: number; placed: number; refused?: string }

/** Write the pack into the campaign. Roster: each character's sheet added or updated by id, the untouched starting
 *  sheets dropped. Place: the pack's characters' old standing tokens anywhere are taken up, the plain party marker on
 *  the placement's map too, and one standing token per character goes down. Not during a fight on that map. */
export function applyPartyPack(state: CampaignState, pack: PartyPack, opt: ApplyOptions = { roster: true, place: true, world: true }): ApplyResult {
  const res: ApplyResult = { added: 0, updated: 0, removedDefaults: 0, placed: 0 };
  const p = pack.placement;
  const loc = p?.location ?? p?.scene;
  if (opt.place && p && state.encounter?.location === loc) return { ...res, refused: 'A fight is running on that map: end it first.' };
  if (opt.roster || opt.place) {
    const before = state.roster.length;
    state.roster = state.roster.filter((s) => !isUntouchedDefault(s) || pack.characters.some((c) => c.id === s.id));
    res.removedDefaults = before - state.roster.length;
    for (const c of pack.characters) {
      const i = state.roster.findIndex((s) => s.id === c.id), sh = sheetOf(c);
      if (i >= 0) { state.roster[i] = sh; res.updated++; } else { state.roster.push(sh); res.added++; }
    }
  }
  if (opt.place && p?.level) {
    const ids = new Set(pack.characters.map((c) => c.id));
    state.tokens = state.tokens.filter((t) => !(t.role === 'pc' && t.sheetId && ids.has(t.sheetId)) && !(t.location === loc && (t.role === 'party' || !t.role)));
    const first = pack.characters.find((c) => p.at[c.id]);
    const lead = first ? p.at[first.id] : undefined;
    pack.characters.forEach((c, i) => {
      const pos = p.at[c.id] ?? (lead ? [lead[0] + 5 * ((i % 2) + 1), lead[1] + 5 * Math.floor(i / 2)] as Vec2 : undefined);
      if (!pos) return;
      const t: Token = { id: `pc-${loc}-${c.id}`, name: c.name, location: loc!, level: p.level!, pos: [pos[0], pos[1]], size: c.size ?? 'medium', darkvisionFt: c.darkvisionFt ?? 0, color: c.color, role: 'pc', sheetId: c.id };
      if (c.light) t.light = { ...c.light };
      state.tokens.push(t); res.placed++;
    });
  }
  return res;
}
