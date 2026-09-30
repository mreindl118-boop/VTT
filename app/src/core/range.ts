// Tactical ranges on the 5-ft square grid: where a combatant can move this turn (green) and what it could
// strike from anywhere it can reach (red). Movement follows the 5e grid: 5 ft per square, diagonals by the
// chosen rule, no cutting corners past walls, no passing through closed doors or other creatures.
import type { Blocker } from './light';
import { pointInPolygon, type Polygon, type Segment, type Vec2 } from './geometry';
import { squareCellCenter, type Cell, type DiagonalRule } from './grid';
import { CELL_FT } from './units';

export interface RangeInput {
  start: Vec2;
  /** Movement left this turn, in feet. */
  speedFt: number;
  /** Melee reach (5 for most, 10 for polearms); 0 for none. */
  reachFt: number;
  /** Normal range of a ranged weapon or spell, if the combatant has one. */
  rangeFt?: number;
  floor: Polygon[];
  moveBlockers: Segment[];
  sightBlockers: Blocker[];
  /** Cells other creatures stand on (cannot end there; allies may be passed, enemies not: we block both). */
  occupied: Vec2[];
  origin?: Vec2;
  rule?: DiagonalRule;
}

export interface RangeResult {
  /** Reachable cell centres with the movement spent to get there (start included at 0). */
  move: { cell: Vec2; costFt: number }[];
  /** Cells that could be hit in melee after moving. */
  strike: Vec2[];
  /** Cells that could be hit at range (line of sight from some reachable cell). */
  ranged: Vec2[];
}

const key = (c: Cell) => `${c.i},${c.j}`;

function crossesInterior(p: Vec2, q: Vec2, a: Vec2, b: Vec2): boolean {
  const d = (q[0] - p[0]) * (b[1] - a[1]) - (q[1] - p[1]) * (b[0] - a[0]);
  if (d === 0) return false;
  const u = ((a[0] - p[0]) * (b[1] - a[1]) - (a[1] - p[1]) * (b[0] - a[0])) / d;
  const v = ((a[0] - p[0]) * (q[1] - p[1]) - (a[1] - p[1]) * (q[0] - p[0])) / d;
  const e = 1e-6;
  return u > e && u < 1 - e && v > e && v < 1 - e;
}

export function tacticalRange(inp: RangeInput): RangeResult {
  const origin = inp.origin ?? [0, 0], rule = inp.rule ?? 'five';
  const centre = (c: Cell) => squareCellCenter(c, origin);
  const at = (p: Vec2): Cell => ({ i: Math.floor((p[0] - origin[0]) / CELL_FT), j: Math.floor((p[1] - origin[1]) / CELL_FT) });
  const onFloor = (p: Vec2) => inp.floor.some((poly) => pointInPolygon(p, poly));
  // A step is blocked when it crosses a wall's interior; grazing a wall's end point (a doorway edge that
  // happens to sit on a cell centre line) is not a crossing.
  const blocked = (a: Vec2, b: Vec2) => inp.moveBlockers.some((w) => crossesInterior(a, b, w.a, w.b));
  const occ = new Set(inp.occupied.map((p) => key(at(p))));
  const start = at(inp.start), startK = key(start);
  occ.delete(startK);

  // Dijkstra over cells with the 5e diagonal rule (5-10-5 alternates, so the cost depends on diagonals taken so far).
  const best = new Map<string, { cell: Cell; cost: number; diag: number }>();
  best.set(startK, { cell: start, cost: 0, diag: 0 });
  const queue = [startK];
  while (queue.length) {
    queue.sort((a, b) => best.get(a)!.cost - best.get(b)!.cost);
    const k = queue.shift()!, cur = best.get(k)!;
    const pc = centre(cur.cell);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const n: Cell = { i: cur.cell.i + di, j: cur.cell.j + dj }, nk = key(n), pn = centre(n);
      if (!onFloor(pn) || occ.has(nk)) continue;
      const isDiag = !!(di && dj);
      // A diagonal step also needs both orthogonal neighbours free of walls (no squeezing past a corner).
      if (isDiag) {
        const a = centre({ i: cur.cell.i + di, j: cur.cell.j }), b = centre({ i: cur.cell.i, j: cur.cell.j + dj });
        if (!onFloor(a) || !onFloor(b) || blocked(pc, a) || blocked(pc, b) || blocked(a, pn) || blocked(b, pn)) continue;
      }
      if (blocked(pc, pn)) continue;
      const diag = cur.diag + (isDiag ? 1 : 0);
      const step = isDiag && rule === 'five-ten-five' && diag % 2 === 0 ? CELL_FT * 2 : CELL_FT;
      const cost = cur.cost + step;
      if (cost > inp.speedFt) continue;
      const prev = best.get(nk);
      if (prev && prev.cost <= cost) continue;
      best.set(nk, { cell: n, cost, diag });
      if (!queue.includes(nk)) queue.push(nk);
    }
  }
  const move = [...best.values()].map((b) => ({ cell: centre(b.cell), costFt: b.cost }));
  const moveKeys = new Set(best.keys());

  // Strike: every floor cell within reach of some reachable cell, not itself reachable, with a clear line.
  const strike: Vec2[] = [], strikeK = new Set<string>();
  const reachCells = Math.round(inp.reachFt / CELL_FT);
  if (reachCells > 0) for (const b of best.values()) for (let dj = -reachCells; dj <= reachCells; dj++) for (let di = -reachCells; di <= reachCells; di++) {
    const n: Cell = { i: b.cell.i + di, j: b.cell.j + dj }, nk = key(n);
    if ((!di && !dj) || moveKeys.has(nk) || strikeK.has(nk)) continue;
    const pn = centre(n);
    if (!onFloor(pn) || blocked(centre(b.cell), pn)) continue;
    strikeK.add(nk); strike.push(pn);
  }

  // Ranged: cells within range of the nearest reachable cell, with line of sight from it.
  const ranged: Vec2[] = [];
  if (inp.rangeFt && inp.rangeFt > 0) {
    const r = Math.ceil(inp.rangeFt / CELL_FT), seen = new Set<string>();
    const cells = [...best.values()].map((b) => b.cell);
    let minI = Infinity, maxI = -Infinity, minJ = Infinity, maxJ = -Infinity;
    for (const c of cells) { minI = Math.min(minI, c.i); maxI = Math.max(maxI, c.i); minJ = Math.min(minJ, c.j); maxJ = Math.max(maxJ, c.j); }
    for (let j = minJ - r; j <= maxJ + r; j++) for (let i = minI - r; i <= maxI + r; i++) {
      const n = { i, j }, nk = key(n);
      if (moveKeys.has(nk) || strikeK.has(nk) || seen.has(nk)) continue;
      const pn = centre(n);
      if (!onFloor(pn)) continue;
      // nearest reachable cell by grid distance, then a line-of-sight check from it
      let nearest: Cell | undefined, nd = Infinity;
      for (const c of cells) { const d = Math.max(Math.abs(c.i - i), Math.abs(c.j - j)); if (d < nd) { nd = d; nearest = c; } }
      if (!nearest || nd > r) continue;
      const from = centre(nearest);
      if (inp.sightBlockers.some((w) => crossesInterior(from, pn, w.a, w.b))) continue;
      seen.add(nk); ranged.push(pn);
    }
  }
  return { move, strike, ranged };
}
