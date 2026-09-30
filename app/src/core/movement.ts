// Player-side movement: a token may only go where a walking creature could — across floor, around walls,
// through open doors. Pure and unit-tested; the DM side is never restricted.
import { bounds, pointInPolygon, segmentsIntersect, type Polygon, type Segment, type Vec2 } from './geometry';

const STEP = 2.5; // lattice spacing (ft); node centres sit at 1.25 + 2.5k, never on a 5-ft wall line

const crosses = (p: Vec2, q: Vec2, blockers: Segment[]) => {
  const minX = Math.min(p[0], q[0]), maxX = Math.max(p[0], q[0]), minZ = Math.min(p[1], q[1]), maxZ = Math.max(p[1], q[1]);
  for (const w of blockers) {
    if (Math.max(w.a[0], w.b[0]) < minX || Math.min(w.a[0], w.b[0]) > maxX || Math.max(w.a[1], w.b[1]) < minZ || Math.min(w.a[1], w.b[1]) > maxZ) continue;
    if (segmentsIntersect(p, q, w.a, w.b)) return true;
  }
  return false;
};

/** True when a creature can walk from `from` to `to` over `floor` without crossing any blocker. */
export function canWalk(from: Vec2, to: Vec2, blockers: Segment[], floor: Polygon[]): boolean {
  const onFloor = (p: Vec2) => floor.some((poly) => pointInPolygon(p, poly));
  if (!onFloor(to)) return false;
  if (Math.hypot(from[0] - to[0], from[1] - to[1]) < 1e-6) return true;
  const b = bounds(floor);
  const x0 = Math.floor(b.minX / STEP) * STEP, z0 = Math.floor(b.minZ / STEP) * STEP;
  const nx = Math.ceil((b.maxX - x0) / STEP), nz = Math.ceil((b.maxZ - z0) / STEP);
  const at = (i: number, j: number): Vec2 => [x0 + (i + 0.5) * STEP, z0 + (j + 0.5) * STEP];
  const ok = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) ok[j * nx + i] = onFloor(at(i, j)) ? 1 : 0;
  // Attach an arbitrary point to the lattice nodes around it that it can reach in a straight step.
  const attach = (p: Vec2): number[] => {
    const ci = Math.floor((p[0] - x0) / STEP - 0.5), cj = Math.floor((p[1] - z0) / STEP - 0.5), out: number[] = [];
    for (let j = cj - 1; j <= cj + 2; j++) for (let i = ci - 1; i <= ci + 2; i++) {
      if (i < 0 || j < 0 || i >= nx || j >= nz || !ok[j * nx + i]) continue;
      if (!crosses(p, at(i, j), blockers)) out.push(j * nx + i);
    }
    return out;
  };
  const start = attach(from), goal = new Set(attach(to));
  if (!start.length || !goal.size) return false;
  const seen = new Uint8Array(nx * nz), queue: number[] = [];
  for (const s of start) { seen[s] = 1; queue.push(s); }
  for (let h = 0; h < queue.length; h++) {
    const n = queue[h];
    if (goal.has(n)) return true;
    const i = n % nx, j = (n - i) / nx, p = at(i, j);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const a = i + di, c = j + dj;
      if (a < 0 || c < 0 || a >= nx || c >= nz) continue;
      const m = c * nx + a;
      if (seen[m] || !ok[m]) continue;
      // No corner cutting: a diagonal step needs both orthogonal neighbours to be floor.
      if (di && dj && (!ok[j * nx + a] || !ok[c * nx + i])) continue;
      if (crosses(p, at(a, c), blockers)) continue;
      seen[m] = 1; queue.push(m);
    }
  }
  return false;
}
