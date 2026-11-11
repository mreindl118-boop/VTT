// Encounter packs: combat encounters prepared outside the app (the DM's scenario notes) that the DM loads on the
// DM's own device and stages on the map in one tap. Pure: validation, counts, difficulty for both rule sets, and
// where the creatures stand. The pack itself never goes into the repo or the campaign state (it is DM-only prep).
import { bounds, pointInPolygon, type Polygon, type Vec2 } from './geometry.ts';

export type PackSource = 'book' | 'reloaded' | 'generative';
export interface PackCreature {
  /** A manifests/characters.json id. */
  id: string;
  /** A number, or dice such as "3d6" that the DM rolls at the table and types in. */
  count: number | string;
  note?: string;
  /** Starts hidden from the players (default true). */
  hidden?: boolean;
  /** What the players call it until revealed or renamed. */
  alias?: string;
  /** Challenge rating when the app has no numbers for the creature, e.g. "3" or "1/4". */
  cr?: string;
}
export interface PackEncounter {
  id: string;
  title: string;
  /** VTT scene path, e.g. appB/death-house or ch03/E. */
  scene: string;
  area?: string;
  level?: string;
  terrain?: string;
  trigger?: string;
  source: PackSource;
  page?: number | null;
  creatures: PackCreature[];
  difficulty?: string;
  notes?: string;
  /** "area" puts them in the area's room; "party" beside the party marker. */
  placement?: 'area' | 'party';
}
export interface Pack { schema: 1; encounters: PackEncounter[] }

/** What the validator knows about the app: creature ids, and each built scene's levels with their room keys. */
export interface PackContext {
  creatures: Set<string>;
  scenes: Map<string, { levels: { id: string; keys: string[] }[]; nonSpatialKeys?: string[] }>;
  terrains?: Set<string>;
}
export interface Problem { encounter?: string; level: 'error' | 'warning'; text: string }

const DICE = /^\s*(\d*)d(\d+)\s*(?:([+-])\s*(\d+))?\s*$/i;
/** A count as dice: its range, or null for a plain number. */
export function diceRange(count: number | string): { min: number; max: number; expr: string } | null {
  if (typeof count === 'number') return null;
  const m = DICE.exec(count); if (!m) return null;
  const n = Number(m[1] || 1), sides = Number(m[2]), mod = m[4] ? Number(m[4]) * (m[3] === '-' ? -1 : 1) : 0;
  return { min: Math.max(0, n + mod), max: Math.max(0, n * sides + mod), expr: count.replace(/\s+/g, '') };
}
/** The number of creatures to place: a fixed count, or the DM's rolled total for a dice count (never rolled here). */
export function resolveCount(count: number | string, rolled?: number): number | null {
  if (typeof count === 'number') return Number.isInteger(count) && count >= 0 ? count : null;
  if (/^\s*\d+\s*$/.test(count)) return Number(count);
  const r = diceRange(count); if (!r) return null;
  if (rolled === undefined || !Number.isInteger(rolled) || rolled < r.min || rolled > r.max) return null;
  return rolled;
}

const SOURCES: PackSource[] = ['book', 'reloaded', 'generative'];
/** Read a pack file. Bad records are dropped with an error; questionable ones load with a warning. */
export function validatePack(raw: unknown, ctx: PackContext): { pack: Pack; problems: Problem[] } {
  const problems: Problem[] = [], out: PackEncounter[] = [];
  const obj = raw as { schema?: unknown; encounters?: unknown };
  const list = Array.isArray(raw) ? raw : Array.isArray(obj?.encounters) ? obj.encounters : null;
  if (!list) return { pack: { schema: 1, encounters: [] }, problems: [{ level: 'error', text: 'Not an encounter pack: expected {"schema": 1, "encounters": [...]}.' }] };
  if (!Array.isArray(raw) && obj.schema !== undefined && obj.schema !== 1) problems.push({ level: 'warning', text: `Schema ${String(obj.schema)} is newer than this app knows (1); reading what it can.` });
  const seen = new Set<string>();
  list.forEach((r: Partial<PackEncounter>, i: number) => {
    const id = typeof r?.id === 'string' && r.id ? r.id : `#${i + 1}`;
    const err = (text: string) => problems.push({ encounter: id, level: 'error', text });
    const warn = (text: string) => problems.push({ encounter: id, level: 'warning', text });
    if (!r || typeof r !== 'object') return err('Not an object.');
    if (typeof r.id !== 'string' || !r.id) return err('Missing id.');
    if (seen.has(r.id)) return err('Duplicate id.');
    if (typeof r.scene !== 'string' || !r.scene) return err('Missing scene.');
    if (!Array.isArray(r.creatures) || !r.creatures.length) return err('No creatures.');
    seen.add(r.id);
    const source: PackSource = SOURCES.includes(r.source as PackSource) ? (r.source as PackSource) : 'generative';
    if (source !== r.source) warn(`Source "${String(r.source)}" is not book, reloaded or generative; treated as generative.`);
    const scene = ctx.scenes.get(r.scene);
    if (!scene) warn(`Scene ${r.scene} is not a built map; it will stage beside the party on whatever map is open.`);
    let level = typeof r.level === 'string' ? r.level : undefined;
    if (scene && level && !scene.levels.some((l) => l.id === level)) { warn(`Level ${level} is not in ${r.scene}.`); level = undefined; }
    const area = typeof r.area === 'string' && r.area ? r.area : undefined;
    let placement: 'area' | 'party' = r.placement === 'party' || !area ? 'party' : 'area';
    if (scene && area) {
      const at = scene.levels.filter((l) => l.keys.includes(area) && (!level || l.id === level));
      if (!at.length) {
        if (scene.nonSpatialKeys?.includes(area)) warn(`Area ${area} has no room of its own on the map; it will stage beside the party.`);
        else warn(`Area ${area} is not in ${r.scene}; it will stage beside the party.`);
        if (placement === 'area') placement = 'party';
      } else if (!level && at.length > 1) warn(`Area ${area} is on several levels (${at.map((l) => l.id).join(', ')}); the first is used. Add a level.`);
    }
    if (r.terrain && ctx.terrains && !ctx.terrains.has(r.terrain)) warn(`Terrain ${r.terrain} is not in manifests/encounters.json.`);
    const creatures: PackCreature[] = [];
    for (const c of r.creatures as PackCreature[]) {
      if (!c || typeof c.id !== 'string') { err('A creature without an id.'); continue; }
      if (!ctx.creatures.has(c.id)) { err(`Creature ${c.id} is not in manifests/characters.json.`); continue; }
      const count = c.count ?? 1;
      if (resolveCount(count) === null && !diceRange(count)) { err(`Count "${String(count)}" for ${c.id} is neither a number nor dice.`); continue; }
      creatures.push({ ...c, count });
    }
    if (!creatures.length) return err('No usable creatures.');
    out.push({ ...(r as PackEncounter), source, level, area, placement, creatures, title: typeof r.title === 'string' && r.title ? r.title : r.id });
  });
  return { pack: { schema: 1, encounters: out }, problems };
}

// ------------------------------------------------------------------ difficulty, both rule sets (SRD numbers)

const CR_XP: Record<string, number> = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800, '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
  '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000, '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
  '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000, '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000,
};
export const xpForCr = (cr: string | undefined): number | undefined => (cr === undefined ? undefined : CR_XP[cr.trim()]);

/** 2014 (SRD 5.1) per-character thresholds: easy, medium, hard, deadly. */
const T2014: [number, number, number, number][] = [
  [25, 50, 75, 100], [50, 100, 150, 200], [75, 150, 225, 400], [125, 250, 375, 500], [250, 500, 750, 1100], [300, 600, 900, 1400], [350, 750, 1100, 1700],
  [450, 900, 1400, 2100], [550, 1100, 1600, 2400], [600, 1200, 1900, 2800], [800, 1600, 2400, 3600], [1000, 2000, 3000, 4500], [1100, 2200, 3400, 5100],
  [1250, 2500, 3800, 5700], [1400, 2800, 4300, 6400], [1600, 3200, 4800, 7200], [2000, 3900, 5900, 8800], [2100, 4200, 6300, 9500], [2400, 4900, 7300, 10900], [2800, 5700, 8500, 12700],
];
/** 2024 (SRD 5.2.1) per-character budgets: low, moderate, high. */
const B2024: [number, number, number][] = [
  [50, 75, 100], [100, 150, 200], [150, 225, 400], [250, 375, 500], [500, 750, 1100], [600, 1000, 1400], [750, 1300, 1700], [1000, 1700, 2100], [1300, 2000, 2600], [1600, 2300, 3100],
  [1900, 2900, 4100], [2200, 3700, 4700], [2600, 4200, 5400], [2900, 4900, 6200], [3300, 5400, 7800], [3800, 6100, 9800], [4500, 7200, 11700], [5000, 8700, 14200], [5500, 10700, 17200], [6400, 13200, 22000],
];
const STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];
/** The 2014 group multiplier, shifted one step for parties under three or over five. */
export function multiplier2014(foes: number, partySize: number): number {
  if (foes <= 0) return 1;
  let i = foes === 1 ? 1 : foes === 2 ? 2 : foes <= 6 ? 3 : foes <= 10 ? 4 : foes <= 14 ? 5 : 6;
  if (partySize < 3) i += 1; else if (partySize >= 6) i -= 1;
  return STEPS[Math.max(0, Math.min(STEPS.length - 1, i))];
}
const lv = (level: number) => Math.max(1, Math.min(20, Math.round(level))) - 1;

export interface Difficulty {
  xp: number; foes: number; unknown: number;
  e2014: { adjusted: number; multiplier: number; label: 'Trivial' | 'Easy' | 'Medium' | 'Hard' | 'Deadly'; thresholds: [number, number, number, number] };
  e2024: { label: 'Low' | 'Moderate' | 'High' | 'Over High'; budgets: [number, number, number] };
}
/** Difficulty of a set of foes (XP each, undefined when unknown) for a party of `levels`, in both rule sets. */
export function difficulty(foeXp: (number | undefined)[], levels: number[]): Difficulty {
  const known = foeXp.filter((x): x is number => x !== undefined), xp = known.reduce((a, b) => a + b, 0), foes = foeXp.length;
  const th = levels.reduce<[number, number, number, number]>((s, l) => s.map((v, i) => v + T2014[lv(l)][i]) as [number, number, number, number], [0, 0, 0, 0]);
  const bu = levels.reduce<[number, number, number]>((s, l) => s.map((v, i) => v + B2024[lv(l)][i]) as [number, number, number], [0, 0, 0]);
  const m = multiplier2014(foes, levels.length), adjusted = Math.round(xp * m);
  const l14 = adjusted >= th[3] ? 'Deadly' : adjusted >= th[2] ? 'Hard' : adjusted >= th[1] ? 'Medium' : adjusted >= th[0] ? 'Easy' : 'Trivial';
  // 2024 bands: within Low's budget reads Low, within Moderate's Moderate, within High's High, past it Over High.
  const l24 = xp <= bu[0] ? 'Low' : xp <= bu[1] ? 'Moderate' : xp <= bu[2] ? 'High' : 'Over High';
  return { xp, foes, unknown: foes - known.length, e2014: { adjusted, multiplier: m, label: l14, thresholds: th }, e2024: { label: l24, budgets: bu } };
}

// ------------------------------------------------------------------ where they stand

const key = (c: Vec2) => `${c[0]},${c[1]}`;
/** A cell centre inside the polygon near its middle, on the map's 5-ft grid. */
const gridSnap = (p: Vec2): Vec2 => [Math.floor(p[0] / 5) * 5 + 2.5, Math.floor(p[1] / 5) * 5 + 2.5];
function startCell(poly: Polygon, snap: (p: Vec2) => Vec2): Vec2 {
  const b = bounds([poly]);
  const c = snap([(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2]);
  if (pointInPolygon(c, poly)) return c;
  for (let ring = 1; ring < 40; ring++) for (let dj = -ring; dj <= ring; dj++) for (let di = -ring; di <= ring; di++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue;
    const p: Vec2 = [c[0] + di * 5, c[1] + dj * 5];
    if (pointInPolygon(p, poly)) return p;
  }
  return c;
}
/** `n` free cells: inside `area` first (spiralling from its middle, or from `from`), then on any of `floor`. */
export function formationCells(n: number, opts: { area?: Polygon; floor: Polygon[]; from?: Vec2; taken?: Iterable<Vec2>; snap?: (p: Vec2) => Vec2 }): Vec2[] {
  const snap = opts.snap ?? gridSnap, taken = new Set([...(opts.taken ?? [])].map((c) => key(snap(c)))), out: Vec2[] = [];
  const origin = opts.area ? startCell(opts.area, snap) : snap(opts.from ?? [2.5, 2.5]);
  const spiral = (inside: (c: Vec2) => boolean, maxRing: number) => {
    for (let ring = 0; ring <= maxRing && out.length < n; ring++) for (let dj = -ring; dj <= ring && out.length < n; dj++) for (let di = -ring; di <= ring && out.length < n; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue;
      const c: Vec2 = [origin[0] + di * 5, origin[1] + dj * 5];
      if (!taken.has(key(c)) && inside(c)) { taken.add(key(c)); out.push(c); }
    }
  };
  if (opts.area) spiral((c) => pointInPolygon(c, opts.area!), 40);
  spiral((c) => opts.floor.some((p) => pointInPolygon(c, p)), 40);
  while (out.length < n) out.push(origin); // nowhere left: stack on the start, the DM spreads them by hand
  return out;
}
