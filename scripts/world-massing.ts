// The massing digest: what each place of the continuous world looks like from afar, read from its own map, so its
// proxy (render/proxydetail.ts) has the map's shape before the map is built and the crossfade to the real map changes
// detail, not shape. Written to manifests/world-massing.json; tests/massing.test.ts checks the committed file is fresh.
// Usage: node --experimental-transform-types scripts/world-massing.ts (npm run massing; also part of npm run build)
//
// For every pin root of the atlas (Castle Ravenloft keeps its own proxy, built from its exterior plans) it keeps what
// a ghost of the map shows (app.ts ghostLook): the ground level and the floors standing on it, cut as the ghost cuts
// (low walls on a flat site, the section at the ground floor's ceiling on a stacked one, nothing on an open one):
//  - floors: the ground's floor materials on a coarse lattice, one run-length string per row;
//  - trees, houses and long runs (palisades, fences, vine rows): packed numbers, drawn as simple shapes;
//  - walls: packed segments, drawn as boxes up to the cut;
//  - kits: every other big thing (landforms, towers, cottages, the church), built at run time with the map's own kit.
// Small things (furniture, bushes, stones, notes, creatures) are left out: from afar they are a pixel or less.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Level, SceneFile, SceneObject } from '../app/src/core/schema';
import type { Atlas } from './world-atlas.ts';
import { WORLD_STANDINS } from '../app/src/core/siteInterfaces.ts';

const here = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(here, '..');
const readJson = <T,>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;

/** The ghost's wall cut on a flat site (app.ts WALL_CUT_FT, low walls on). */
export const WALL_CUT_FT = 5;
/** Kinds drawn as trees, houses and long runs (simple shapes), and kinds built with their kit whatever their size. */
export const TREES = ['pine', 'oak', 'dead-tree'] as const;
export const LINES = ['palisade', 'fence', 'vine-row', 'field-wall', 'berez-iron-fence', 'iron-fence', 'skull-fence'] as const;
const BIG_KINDS = new Set(['heightfield', 'road-ribbon', 'church-building', 'gate-arch', 'tent', 'big-tent', 'belfry', 'gazebo', 'creeping-hut', 'iron-gates', 'gulthias-tree', 'water', 'well', 'temple']);
/** Never in a proxy: what is not seen from afar or is not scenery (notes, spawns, effects of light and mist). */
const SKIP = new Set(['note', 'spawn', 'secret-panel', 'mist', 'mist-bank', 'fog-wall', 'fog-sea', 'flame-curtain', 'cobweb', 'web-sheet', 'scorch', 'floor-cracks', 'floor-inlay', 'rug', 'shimmer-door', 'drapes', 'tapestry', 'banner']);
/** Roof caps a flat site's ghost hides with its low walls (build.ts CAP). */
const CAP_KINDS = new Set(['roof-gable', 'roof-cone', 'onion-dome', 'mill-sails', 'chimney']);
const SEEN = new Set(['player', 'explored', 'unexplored']);

export interface MassingFloors { y: number; x0: number; z0: number; cell: number; nx: number; nz: number; rows: string[] }
export interface MassingSite {
  /** Floor classes used by `floors` rows (a letter each: 'a' the first). */
  cls: string[];
  floors: MassingFloors[];
  /** base64 Int16 records: trees [type, x2, z2, y2, h10, r10]; houses [x2, z2, y2, w2, d2, sh2, stories, rotDeg];
   *  lines [kind, x2, z2, y2, len2, h2, rotDeg]; walls [ax2, az2, bx2, bz2, y02, y12, material]. */
  trees: string; houses: string; lines: string; walls: string;
  /** Kit pieces: [kind, x, y, z, rotYdeg, dims, polygon] (y in scene feet: the level's floor plus the object's lift). */
  kits: [string, number, number, number, number, Record<string, number> | null, [number, number][] | null][];
}
export interface Massing { schema: 1; lines: readonly string[]; wallMaterials: string[]; sites: Record<string, MassingSite> }

const groundOf = (s: SceneFile): Level => s.levels.find((l) => l.terrain?.length) ?? s.levels[0];
/** The floors that stand on one another around a level (app.ts stackOf). */
function stackOf(id: string, s: SceneFile): Set<string> {
  const ls = s.levels, out = new Set<string>([id]);
  if (s.stacked === 'open') { for (const l of ls) out.add(l.id); return out; }
  const top = (l: Level) => l.elevationFt + (l.ceilingFt ?? 10);
  const meets = (a: Level, b: Level) => Math.abs(top(a) - b.elevationFt) <= 3 || Math.abs(top(b) - a.elevationFt) <= 3;
  for (let grew = true; grew;) { grew = false; for (const l of ls) if (!out.has(l.id) && ls.some((o) => out.has(o.id) && meets(o, l))) { out.add(l.id); grew = true; } }
  return out;
}

const pack = (a: number[]): string => Buffer.from(new Int16Array(a.map((v) => Math.max(-32768, Math.min(32767, Math.round(v))))).buffer).toString('base64');
const r1 = (v: number) => Math.round(v * 10) / 10;
const sizeOf = (o: SceneObject) => { const d = o.dims ?? {}; return Math.max(0, d.h ?? 0, d.w ?? 0, d.d ?? 0, d.len ?? 0, (d.r ?? 0) * 2, (d.canopy ?? 0) * 2); };

function inPoly(x: number, z: number, p: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, zi] = p[i], [xj, zj] = p[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** One level's floors on a lattice: grass, snow and marsh first, then the other ground, then the rooms (as the map
 *  layers them), each cell taking the last polygon over its middle. */
function rasterFloors(l: Level, cls: string[], cell: number): MassingFloors | undefined {
  const polys: { p: [number, number][]; f: string }[] = [];
  const soft = (f: string) => f === 'grass' || f === 'snow' || f === 'marsh';
  for (const t of l.terrain ?? []) if (soft(t.floor)) polys.push({ p: t.polygon as [number, number][], f: t.floor });
  for (const t of l.terrain ?? []) if (!soft(t.floor)) polys.push({ p: t.polygon as [number, number][], f: t.floor });
  for (const r of l.rooms) polys.push({ p: r.polygon as [number, number][], f: r.floor });
  if (!polys.length) return undefined;
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  const boxes = polys.map(({ p }) => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const [x, z] of p) { a = Math.min(a, x); b = Math.min(b, z); c = Math.max(c, x); d = Math.max(d, z); } minX = Math.min(minX, a); minZ = Math.min(minZ, b); maxX = Math.max(maxX, c); maxZ = Math.max(maxZ, d); return [a, b, c, d]; });
  const nx = Math.max(1, Math.ceil((maxX - minX) / cell)), nz = Math.max(1, Math.ceil((maxZ - minZ) / cell));
  const grid = new Int16Array(nx * nz).fill(-1);
  polys.forEach(({ p, f }, k) => {
    let c = cls.indexOf(f); if (c < 0) { c = cls.length; cls.push(f); }
    const [a, b, cc, d] = boxes[k];
    const i0 = Math.max(0, Math.floor((a - minX) / cell)), i1 = Math.min(nx - 1, Math.floor((cc - minX) / cell));
    const j0 = Math.max(0, Math.floor((b - minZ) / cell)), j1 = Math.min(nz - 1, Math.floor((d - minZ) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (inPoly(minX + (i + 0.5) * cell, minZ + (j + 0.5) * cell, p)) grid[j * nx + i] = c;
  });
  const rows: string[] = [];
  for (let j = 0; j < nz; j++) {
    let s = '';
    for (let i = 0; i < nx;) { const c = grid[j * nx + i]; let n = 1; while (i + n < nx && grid[j * nx + i + n] === c) n++; s += `${n > 1 ? n : ''}${c < 0 ? '.' : String.fromCharCode(97 + c)}`; i += n; }
    rows.push(s);
  }
  return { y: l.elevationFt, x0: r1(minX), z0: r1(minZ), cell, nx, nz, rows };
}

export function buildMassing(atlas: Atlas = readJson<Atlas>(join(REPO, 'manifests/world-atlas.json')), repo = REPO): Massing {
  const out: Massing = { schema: 1, lines: LINES, wallMaterials: [], sites: {} };
  const roots = Object.values(atlas.scenes).filter((e) => e.depth === 0 && !e.orphan && e.pin && e.worldBounds && e.path !== 'ch04/K').sort((a, b) => a.path.localeCompare(b.path));
  for (const e of roots) {
    const s = readJson<SceneFile>(join(repo, 'locations', e.path, 'scene.json'));
    const g = groundOf(s), shown = s.stacked ? stackOf(g.id, s) : new Set([g.id]);
    const top = Math.max(...s.levels.map((x) => x.elevationFt + (x.ceilingFt ?? 10)));
    const cut = s.stacked === 'open' ? top + 12 : s.stacked ? g.elevationFt + (g.ceilingFt ?? 10) - 0.5 : g.elevationFt + WALL_CUT_FT;
    const b = e.bbox, cell = Math.min(30, Math.max(2, Math.round(Math.hypot(b.maxX - b.minX, b.maxZ - b.minZ) / 200)));
    const site: MassingSite = { cls: [], floors: [], trees: '', houses: '', lines: '', walls: '', kits: [] };
    const trees: number[] = [], houses: number[] = [], lines: number[] = [], walls: number[] = [];
    for (const l of s.levels) {
      if (!shown.has(l.id)) continue;
      const y0 = l.elevationFt, above = cut < y0 + 1; // a floor standing above the cut: only its shell (walls) stays
      if (!above) { const f = rasterFloors(l, site.cls, cell); if (f) site.floors.push(f); }
      const ceiling = (l.ceilingFt ?? 10) - 0.1;
      for (const w of l.walls) {
        if (w.flags.includes('invisible') || w.flags.includes('ethereal')) continue;
        const h = w.heightFt ?? ceiling, door = w.flags.includes('door');
        const lo = y0 + (door ? Math.min(7, ceiling) : 0), hi = Math.min(y0 + h, cut);
        if (hi - lo < 0.5) continue;
        let m = out.wallMaterials.indexOf(w.material ?? 'ashlar'); if (m < 0) { m = out.wallMaterials.length; out.wallMaterials.push(w.material ?? 'ashlar'); }
        walls.push(w.a[0] * 2, w.a[1] * 2, w.b[0] * 2, w.b[1] * 2, lo * 2, hi * 2, m);
      }
      if (above) continue;
      for (const o of l.objects) {
        if (!SEEN.has(o.vis) || SKIP.has(o.kind) || WORLD_STANDINS.has(o.kind) || o.size) continue;
        const d = o.dims ?? {}, x = o.pos[0], y = y0 + o.pos[1], z = o.pos[2], rot = o.rotY ?? 0;
        if ((TREES as readonly string[]).includes(o.kind)) {
          if (o.kind === 'pine') { const sc = d.scale ?? 1; trees.push(0, x * 2, z * 2, y * 2, (d.h ?? 24) * sc * 10, (d.r ?? 6) * sc * 10); }
          else if (o.kind === 'oak') trees.push(1, x * 2, z * 2, y * 2, (d.h ?? 20) * 10, (d.canopy ?? 0) * 10);
          else trees.push(2, x * 2, z * 2, y * 2, (d.scale ?? 1) * 100, 0);
          continue;
        }
        if (o.kind === 'house') { houses.push(x * 2, z * 2, y * 2, (d.w ?? 20) * 2, (d.d ?? 20) * 2, (d.h ?? 10) * 2, d.stories ?? 1, rot); continue; }
        const li = (LINES as readonly string[]).indexOf(o.kind);
        if (li >= 0) { if ((d.len ?? d.w ?? 10) >= 4) lines.push(li, x * 2, z * 2, y * 2, (d.len ?? d.w ?? 10) * 2, (d.h ?? 0) * 2, rot); continue; }
        if (!s.stacked && CAP_KINDS.has(o.kind) && (d.y ?? 10) >= 6) continue;
        if (!(BIG_KINDS.has(o.kind) || o.polygon || sizeOf(o) >= 10)) continue;
        // (a prism or a straight stair is drawn from its plan at the level's floor, as build.ts places it)
        const planned = o.kind === 'stairs-straight' || (o.kind === 'prism' && !!o.polygon);
        site.kits.push([o.kind, r1(x), r1(planned ? y0 : y), r1(z), r1(rot), o.dims ?? null, o.polygon ? (o.polygon as [number, number][]).map(([a, c]) => [r1(a), r1(c)]) : null]);
      }
    }
    site.trees = pack(trees); site.houses = pack(houses); site.lines = pack(lines); site.walls = pack(walls);
    out.sites[e.path] = site;
  }
  return out;
}

export const serializeMassing = (m: Massing): string => JSON.stringify(m) + '\n';

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const m = buildMassing();
  const file = join(REPO, 'manifests/world-massing.json'), text = serializeMassing(m);
  const changed = !existsSync(file) || readFileSync(file, 'utf8') !== text;
  writeFileSync(file, text);
  const n = Object.keys(m.sites).length, kits = Object.values(m.sites).reduce((a, s) => a + s.kits.length, 0);
  console.log(`world massing: ${n} places, ${kits} kit pieces, ${Math.round(text.length / 1024)} KB → manifests/world-massing.json${changed ? '' : ' (unchanged)'}`);
}
