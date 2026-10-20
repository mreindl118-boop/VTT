// A wall's body in plan: walls that set `thicknessFt` (schema.ts) are drawn, block movement and block sight as the
// solid they are, not as a line. A body is its wall's line a->b widened to the thickness, centred on the line or, with
// `offsetFt`, standing off it to one side (a wall that takes its thickness from one room only, so a corridor beside it
// keeps its width). Each body's two ends are cut where it meets other walls with a body, so the joints close with no
// gap and no overlap (no z-fighting):
//  - a free end (a door's jamb, an arch, a wall standing alone) is cut square at the end point;
//  - where two walls run on in one line (a door between two pieces, a wall split in cells), both are cut square;
//  - a wall that ends against another wall's side (a T) stops at that wall's face on its side;
//  - two or more walls meeting at one point with no wall running through (an L, an octagon's corner, a Y) are mitred:
//    each pair of neighbours round the point shares the line from the meeting of their faces.
// The joints are the plan's own: wall ends that meet, and wall ends on another wall's line, as the walls are authored.
// Walls without `thicknessFt` have no footprint here; they are drawn and tested as before (kit/pieces.ts WALL_T).
// Pure and cached: the renderer (render/build.ts), the blockers (light.ts) and the fog's wall rim (coverage.ts) all
// read the same footprints. scripts/authoring/thickwalls.py computes the same ones for the generators.
import type { Polygon, Segment, Vec2 } from './geometry';
import type { Wall } from './schema';

/** Wall ends closer than this (ft) meet at one joint; a wall end this close to another wall's line stands on it. */
const JOIN_EPS = 0.05;
/** Two walls whose directions differ by less than this from a straight line run on in one line (radians). */
const STRAIGHT = (10 * Math.PI) / 180;
/** A mitre point further than this many thicknesses from the joint is not used (near-parallel walls): cut square. */
const MITRE_LIMIT = 3;

/** A wall with a body: it sets a thickness and is drawn at all (invisible and ethereal walls are never drawn). */
export const hasBody = (w: Wall): boolean =>
  w.thicknessFt !== undefined && w.thicknessFt > 0 && !w.flags.includes('invisible') && !w.flags.includes('ethereal');

/** True when any wall of the list sets a thickness (the cheap test callers make before asking for footprints). */
export const anyThick = (walls: readonly Wall[]): boolean => walls.some((w) => w.thicknessFt !== undefined);

/** The line down the middle of a wall's body: a->b itself, or moved by the wall's offset. */
export function bodyLine(w: Wall): [Vec2, Vec2] {
  const off = w.offsetFt ?? 0;
  if (!off) return [w.a, w.b];
  const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) || 1, nx = -(w.b[1] - w.a[1]) / L * off, nz = (w.b[0] - w.a[0]) / L * off;
  return [[w.a[0] + nx, w.a[1] + nz], [w.b[0] + nx, w.b[1] + nz]];
}

interface End {
  wall: number;
  /** Which end of the wall: 0 = a, 1 = b; -1 for the two halves of a wall that runs on through the joint. */
  at: 0 | 1 | -1;
  /** Unit direction away from the joint, along the wall. */
  d: Vec2;
  /** How far the body reaches to the left and to the right of the line, looking along d. */
  hl: number;
  hr: number;
}

const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
const add = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];
const mul = (a: Vec2, s: number): Vec2 => [a[0] * s, a[1] * s];
const dot = (a: Vec2, b: Vec2) => a[0] * b[0] + a[1] * b[1];
const cross = (a: Vec2, b: Vec2) => a[0] * b[1] - a[1] * b[0];
/** The left normal of a direction (its angle + 90 degrees, the way atan2 counts). */
const left = (d: Vec2): Vec2 => [-d[1], d[0]];
const len = (a: Vec2) => Math.hypot(a[0], a[1]);

/** Where the line through p along d meets the line through q along e; null when they are (near) parallel. */
function meet(p: Vec2, d: Vec2, q: Vec2, e: Vec2): Vec2 | null {
  const c = cross(d, e);
  if (Math.abs(c) < 1e-9) return null;
  const s = cross(sub(q, p), e) / c;
  return add(p, mul(d, s));
}

/** Footprints of `walls` (same order): a plan polygon for every wall with a body, null for the rest. `grow` widens
 *  every body by that many feet (a coping or a frame proud of both faces), with its joints closed the same way. */
export function wallFootprints(walls: readonly Wall[], grow = 0): (Polygon | null)[] {
  if (!anyThick(walls)) return walls.map(() => null);
  const key = signature(walls, grow);
  const hit = CACHE.get(key);
  if (hit) return hit;
  const out = compute(walls, grow);
  CACHE.set(key, out);
  if (CACHE.size > 16) CACHE.delete(CACHE.keys().next().value as string);
  return out;
}

/** The sides of every wall body, as segments (for blockers). Walls `keep` turns down are left out. A side two kept
 *  bodies share, one on each side of it (every footprint runs round the same way, so they run along it in opposite
 *  directions), is a seam inside the solid: a line between two points outside the bodies that crosses it crosses the
 *  solid's outline too, so it is left out and sight and movement test fewer segments. */
export function bodyOutlines(walls: readonly Wall[], keep: (w: Wall) => boolean): Segment[] {
  const fp = wallFootprints(walls), out: Segment[] = [];
  const pt = (p: Vec2) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`, run = new Set<string>();
  for (let i = 0; i < walls.length; i++) {
    const p = fp[i];
    if (!p || !keep(walls[i])) continue;
    for (let k = 0; k < p.length; k++) run.add(`${pt(p[k])}>${pt(p[(k + 1) % p.length])}`);
  }
  for (let i = 0; i < walls.length; i++) {
    const p = fp[i];
    if (!p || !keep(walls[i])) continue;
    for (let k = 0; k < p.length; k++) {
      const a = p[k], b = p[(k + 1) % p.length];
      if (!run.has(`${pt(b)}>${pt(a)}`)) out.push({ a, b });
    }
  }
  return out;
}

const CACHE = new Map<string, (Polygon | null)[]>();
function signature(walls: readonly Wall[], grow: number): string {
  let s = `${grow}`;
  for (const w of walls) s += hasBody(w) ? `|${w.a[0]},${w.a[1]},${w.b[0]},${w.b[1]},${w.thicknessFt},${w.offsetFt ?? 0}` : '|';
  return s;
}

function compute(walls: readonly Wall[], grow: number): (Polygon | null)[] {
  const n = walls.length;
  const U: Vec2[] = [], L: number[] = [], HL: number[] = [], HR: number[] = [], live: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const w = walls[i], d = sub(w.b as Vec2, w.a as Vec2), l = len(d);
    live[i] = hasBody(w) && l > 1e-6;
    L[i] = l; U[i] = live[i] ? mul(d, 1 / l) : [1, 0];
    const half = live[i] ? (w.thicknessFt! + grow) / 2 : 0, off = live[i] ? w.offsetFt ?? 0 : 0;
    HL[i] = half + off; HR[i] = half - off;   // to the wall's left (its n = left(u)) and to its right
  }
  const atA = (i: number): End => ({ wall: i, at: 0, d: U[i], hl: HL[i], hr: HR[i] });
  const atB = (i: number): End => ({ wall: i, at: 1, d: mul(U[i], -1), hl: HR[i], hr: HL[i] });
  // joints: the wall ends that meet, found through a coarse bucket grid
  const B = 2, nodes: { p: Vec2; ends: End[] }[] = [], bucket = new Map<string, number[]>();
  const nodeAt = (p: Vec2): number => {
    const bx = Math.floor(p[0] / B), bz = Math.floor(p[1] / B);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++)
      for (const k of bucket.get(`${bx + dx},${bz + dz}`) ?? []) if (len(sub(nodes[k].p, p)) <= JOIN_EPS) return k;
    nodes.push({ p, ends: [] });
    const k = `${bx},${bz}`;
    if (!bucket.has(k)) bucket.set(k, []);
    bucket.get(k)!.push(nodes.length - 1);
    return nodes.length - 1;
  };
  for (let i = 0; i < n; i++) {
    if (!live[i]) continue;
    nodes[nodeAt(walls[i].a as Vec2)].ends.push(atA(i));
    nodes[nodeAt(walls[i].b as Vec2)].ends.push(atB(i));
  }
  // a joint that lies on another wall's line, away from its ends: that wall runs on through the joint (a T)
  const segB = 10, segs = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    if (!live[i]) continue;
    const a = walls[i].a, b = walls[i].b;
    for (let bx = Math.floor((Math.min(a[0], b[0]) - JOIN_EPS) / segB); bx <= Math.floor((Math.max(a[0], b[0]) + JOIN_EPS) / segB); bx++)
      for (let bz = Math.floor((Math.min(a[1], b[1]) - JOIN_EPS) / segB); bz <= Math.floor((Math.max(a[1], b[1]) + JOIN_EPS) / segB); bz++) {
        const k = `${bx},${bz}`; if (!segs.has(k)) segs.set(k, []); segs.get(k)!.push(i);
      }
  }
  for (const node of nodes) {
    const p = node.p, mine = new Set(node.ends.map((e) => e.wall));
    for (const j of segs.get(`${Math.floor(p[0] / segB)},${Math.floor(p[1] / segB)}`) ?? []) {
      if (mine.has(j)) continue;
      const rel = sub(p, walls[j].a as Vec2), s = dot(rel, U[j]);
      if (s <= JOIN_EPS || s >= L[j] - JOIN_EPS || Math.abs(cross(U[j], rel)) > JOIN_EPS) continue;
      node.ends.push({ ...atA(j), at: -1 }, { ...atB(j), at: -1 });
      mine.add(j);
    }
  }
  // how far an end's body runs on from the joint p along its direction: its wall's length, or for the half of a wall
  // the joint lies on, the rest of that wall
  const reach = (e: End, p: Vec2): number => {
    if (e.at !== -1) return L[e.wall];
    const s = dot(sub(p, walls[e.wall].a as Vec2), U[e.wall]);
    return dot(e.d, U[e.wall]) > 0 ? L[e.wall] - s : s;
  };
  // each end's cut: from the point on its right face to the point on its left face (looking away from the joint)
  const cuts = new Map<string, Vec2[]>();
  const cutKey = (wall: number, at: number) => `${wall}:${at}`;
  for (const node of nodes) {
    const p = node.p, E = node.ends;
    const rightFace = (e: End) => add(p, mul(left(e.d), -e.hr)), leftFace = (e: End) => add(p, mul(left(e.d), e.hl));
    const flat = (e: End): Vec2[] => [rightFace(e), leftFace(e)];
    const real = E.filter((e) => e.at !== -1);
    if (!real.length) continue;
    if (E.length === 1) { cuts.set(cutKey(real[0].wall, real[0].at), flat(real[0])); continue; }
    // a wall that runs on through the joint: the pair of ends in one line, a wall's own two halves first, then the
    // thickest pair
    let through: [End, End] | null = null, best = -1;
    for (let x = 0; x < E.length; x++) for (let y = x + 1; y < E.length; y++) {
      const ex = E[x], ey = E[y];
      if (ex.wall === ey.wall && ex.at !== -1) continue;
      if (dot(ex.d, ey.d) > -Math.cos(STRAIGHT)) continue;
      const score = (ex.at === -1 && ey.at === -1 ? 1e6 : 0) + Math.min(ex.hl + ex.hr, ey.hl + ey.hr);
      if (score > best) { best = score; through = [ex, ey]; }
    }
    if (through) {
      const [t1, t2] = through, m = left(t1.d);
      // how far each through end runs on from the joint: a through wall that stops (or turns) within the branch's width
      // covers only that much of it, and the branch runs on to the joint's line beyond (no notch at a tower's corner)
      const hi = reach(t1, p), lo = -reach(t2, p);
      for (const e of real) {
        if (e === t1 || e === t2) { cuts.set(cutKey(e.wall, e.at), flat(e)); continue; }
        // a wall running nearly along the through line (or overlapping it): cut square
        if (Math.abs(dot(e.d, m)) < Math.sin(STRAIGHT)) { cuts.set(cutKey(e.wall, e.at), flat(e)); continue; }
        // the through wall's face on this wall's side (t1's left is t2's right), fo along m from the joint's line
        const fo = dot(e.d, m) > 0 ? Math.min(t1.hl, t2.hr) : -Math.min(t1.hr, t2.hl), face = add(p, mul(m, fo));
        const r = meet(rightFace(e), e.d, face, t1.d), l = meet(leftFace(e), e.d, face, t1.d);
        if (!r || !l) { cuts.set(cutKey(e.wall, e.at), flat(e)); continue; }
        const s = (x: Vec2) => dot(sub(x, p), t1.d), sr = s(r), sl = s(l), inside = (x: number) => x >= lo - 1e-9 && x <= hi + 1e-9;
        if (Math.abs(fo) < 1e-9 || (inside(sr) && inside(sl))) { cuts.set(cutKey(e.wall, e.at), [r, l]); continue; }
        // stepped: on the face where the through wall stands, on the joint's line where it does not
        const at = (x: number, onFace: boolean): Vec2 => add(add(p, mul(t1.d, x)), mul(m, onFace ? fo : 0));
        const cut: Vec2[] = [inside(sr) ? r : meet(rightFace(e), e.d, p, t1.d)!];
        const steps = [hi, lo].filter((b) => (b - sr) * (b - sl) < 0).sort((x, y) => (x - y) * Math.sign(sl - sr));
        for (const b of steps) {
          const into = inside(b + (sl - sr) * 1e-6);   // after the step the cut runs on the face
          cut.push(at(b, !into), at(b, into));
        }
        cut.push(inside(sl) ? l : meet(leftFace(e), e.d, p, t1.d)!);
        cuts.set(cutKey(e.wall, e.at), cut);
      }
      continue;
    }
    // no wall runs through: mitre round the joint, each pair of neighbours sharing the meeting of their faces
    const S = E.slice().sort((x, y) => Math.atan2(x.d[1], x.d[0]) - Math.atan2(y.d[1], y.d[0]));
    const k = S.length, Lp: Vec2[] = [], Rp: Vec2[] = [];
    // A pair whose faces meet behind one wall's end and inside the other's stretch (a thin wall turning off a thick
    // one's end, the thick wall's face reaching far past the thin one's) cannot be mitred without cutting into the wall
    // the meeting lies in: that wall keeps its square end and the other closes on that end's line, when it can do so
    // without losing any of its own stretch. If any such pair cannot, the joint is mitred as usual.
    const pairs: { el: Vec2; fr: Vec2; q: Vec2 | null; lim: number; sq: [Vec2, Vec2] | null; mixed: boolean }[] = [];
    let square = true;
    for (let i = 0; i < k; i++) {
      const e = S[i], f = S[(i + 1) % k];   // f is e's neighbour on e's left
      const el = leftFace(e), fr = rightFace(f);
      const q = meet(el, e.d, fr, f.d), lim = MITRE_LIMIT * Math.max(e.hl, e.hr, f.hl, f.hr) * 2;
      const se = q ? dot(sub(q, p), e.d) : 0, sf = q ? dot(sub(q, p), f.d) : 0;
      const mixed = !!q && ((se > 1e-6 && sf < -1e-6) || (se < -1e-6 && sf > 1e-6));
      let sq: [Vec2, Vec2] | null = null;
      if (mixed) {
        // e ahead: e square at el, f's face closes on e's end line; f ahead: the other way round
        const x = se > 0 ? meet(fr, f.d, p, left(e.d)) : meet(el, e.d, p, left(f.d)), behind = se > 0 ? f : e;
        if (x && len(sub(x, p)) <= lim && dot(sub(x, p), behind.d) <= 1e-6) sq = se > 0 ? [el, x] : [x, fr];
        else square = false;
      }
      pairs.push({ el, fr, q, lim, sq, mixed });
    }
    for (let i = 0; i < k; i++) {
      const { el, fr, q, lim, sq, mixed } = pairs[i];
      if (mixed && square && sq) { Lp[i] = sq[0]; Rp[(i + 1) % k] = sq[1]; }
      else if (q && len(sub(q, p)) <= lim) { Lp[i] = q; Rp[(i + 1) % k] = q; }
      else { Lp[i] = el; Rp[(i + 1) % k] = fr; }
    }
    for (let i = 0; i < k; i++) {
      const e = S[i];
      if (e.at === -1) continue;
      cuts.set(cutKey(e.wall, e.at), k >= 3 ? [Rp[i], p, Lp[i]] : [Rp[i], Lp[i]]);
    }
  }
  // each footprint: the cut at a (its right face is the wall's right, -n) reversed, then the cut at b reversed
  const out: (Polygon | null)[] = [];
  for (let i = 0; i < n; i++) {
    if (!live[i]) { out.push(null); continue; }
    const a = walls[i].a as Vec2, b = walls[i].b as Vec2, nrm = left(U[i]), hl = HL[i], hr = HR[i];
    const ca = cuts.get(cutKey(i, 0)) ?? [add(a, mul(nrm, -hr)), add(a, mul(nrm, hl))];
    const cb = cuts.get(cutKey(i, 1)) ?? [add(b, mul(nrm, hl)), add(b, mul(nrm, -hr))];
    const poly: Polygon = [...ca.slice().reverse(), ...cb.slice().reverse()];
    out.push(valid(poly) ? poly : [add(a, mul(nrm, hl)), add(a, mul(nrm, -hr)), add(b, mul(nrm, -hr)), add(b, mul(nrm, hl))]);
  }
  return out;
}

/** A footprint is kept when it is a simple polygon with an area: a wall shorter than its mitres, whose two cuts
 *  cross, is cut square at both ends instead. */
function valid(poly: Polygon): boolean {
  const m = poly.length;
  for (let i = 0; i < m; i++) for (let j = i + 2; j < m; j++) {
    if (i === 0 && j === m - 1) continue;
    if (properCross(poly[i], poly[(i + 1) % m], poly[j], poly[(j + 1) % m])) return false;
  }
  let area = 0;
  for (let i = 0; i < m; i++) area += cross(poly[i], poly[(i + 1) % m]);
  return Math.abs(area) > 1e-6;
}

function properCross(p: Vec2, q: Vec2, a: Vec2, b: Vec2): boolean {
  const d1 = cross(sub(q, p), sub(a, p)), d2 = cross(sub(q, p), sub(b, p)), d3 = cross(sub(b, a), sub(p, a)), d4 = cross(sub(b, a), sub(q, a));
  return ((d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9)) && ((d3 > 1e-9 && d4 < -1e-9) || (d3 < -1e-9 && d4 > 1e-9));
}
