// Cloth for the hero figures (kit/heroes.ts): garments that hang from the body and give way to it. A garment is a grid
// of vertices, row 0 where it hangs from (a waist, the shoulders, a neckline) and the last row its hem; each column is a
// strip of cloth. Once the figure is posed, every strip hangs from its top: it keeps its own cut, turns to hang plumb
// (on a body laid on the floor, toward the floor), and where a limb or the body comes up under it (a thigh lifted under a
// tunic, a knee stepping through a gown, an arm raised under a cape) it swings out over it, running straight from where
// it hangs to where it rests on the limb and hanging on from there. A strip swung out draws its neighbours along, so the
// cloth tents over a knee rather than creasing to a point; a strip that would pass into the floor lies on it. Pure
// geometry: it runs once per figure, after the pose and before the figure is laid out.
import * as THREE from 'three';

/** A garment: a mesh whose geometry is a grid of `rows` rows of `cols` vertices (row-major), in its parent's frame (the
 *  mesh itself carries no transform). Its axis is a vertical line of that frame. */
export interface Garment {
  name: string;
  mesh: THREE.Mesh;
  cols: number; rows: number;
  /** The first and last columns are one seam (a closed skirt); otherwise they are free edges (a slit, an open front). */
  closed: boolean;
  /** A point on its axis, in the parent's frame. */
  axis: THREE.Vector3;
  /** What it hangs over: body parts, and garments under it, that it stays outside of. */
  covers: string[];
  /** Body parts that lie outside it (an arm beside a skirt): it stays inside them where the parts it covers let it. */
  outside?: string[];
  /** Inner garments hang first and are in the way of those over them. */
  layer: number;
  /** Room left between the cloth and what it covers (feet). */
  clear: number;
  /** How many columns to either side a strip swung out draws along. */
  spread: number;
  /** How fully it turns to hang plumb: 1 for limp cloth, less for a fitted one that keeps to the hips. */
  hang: number;
  /** Hung from round the neck or across the shoulders (a capelet, a cloak), where it stays put: how far at most (feet)
   *  where it hangs from eases out over what comes up against it there, where a waistband rides out freely over a belly
   *  bent down onto it. */
  anchored?: number;
  /** Cut off at its top where something fitted over the trunk ends (a skirt hung from a corset's foot): the trunk
   *  just above where it hangs from is none of its business, and never turns the cloth below it outward. */
  cutTop?: boolean;
  /** Limbs among those it covers that it hangs on from its top (a capelet on the tops of the arms): on a body laid out
   *  it still goes over them where they are flung up past where it hangs from, as other limbs leave it. */
  holds?: string[];
  /** A plate, not cloth: it swings out as one piece about its top edge, never bending. */
  stiff?: boolean;
  /** A plate in lames (tassets, a culet): the row each lame's rim is on, from the top. On a body laid out it bends
   *  between them, never through a lame. */
  lames?: number[];
  /** Trims made on the hung cloth (a hem band, a slit's edges, clasps), once it has hung. */
  after?: (g: Garment) => void;
}

/** What the cloth hangs in: sample points on each body part (world positions), the way down, and on a body laid on the
 *  floor how far along the way down its lowest point lies. `volumes` say how deep a point lies in a part (feet, <= 0
 *  outside) and the way out of it; cloth found inside one at the end is pushed out. */
export interface DrapeWorld {
  parts: Map<string, THREE.Vector3[]>;
  /** Parts that move with the trunk (the torso, the hips): what of them lies above a garment's top edge is not under it
   *  (a pendant's chain above a neckline), where a limb raised past the edge still is. Hung garments count as trunk. */
  trunk?: string[];
  down: THREE.Vector3;
  floor?: number;
  /** A body laid on the floor: its cloth does not hang from where it is cut but falls, keeping its cut, straight toward
   *  the floor onto whatever lies beneath it (the body, a limb, cloth already fallen) or onto the floor itself. */
  lying?: boolean;
  volumes?: Map<string, (p: THREE.Vector3, out: THREE.Vector3) => number>;
  /** Each part's bone, a line through its joints (world): cloth found between a part's bone and a point on its surface
   *  lies in the part, and is lifted out past the surface. */
  bones?: Map<string, THREE.Vector3[]>;
  /** Every point of each part's surface (world), where `parts` holds a sample of them: what the cloth is lifted out of. */
  surface?: Map<string, THREE.Vector3[]>;
  /** A part in separate pieces (gear put away at both hips and on the back): each piece's own bone and surface (world).
   *  Where a part has pieces they stand for its bone and surface when cloth is lifted out of it, so the cloth is lifted
   *  out of each piece from its own bone, never along a line from one piece to another. */
  pieces?: Map<string, { bone: THREE.Vector3[]; surface: THREE.Vector3[] }[]>;
  /** On a body laid out, the trunk's own skin and what is worn close on it (as kit/clothcheck.ts reads the torso and the
   *  pelvis), where `surface` holds all that is on it (a fauld's lames): what a plate in lames comes to rest on. */
  skin?: Map<string, THREE.Vector3[]>;
  /** On a body laid out, the faces of a part's surface (world; three corners to a face, x, y, z for each), read when
   *  asked for: cloth settled off what it covers reads it between its points too (see hangOne), as a plate's dome or
   *  rim stands through cloth between them. */
  faces?: (part: string) => ArrayLike<number> | undefined;
  /** The figure's size (feet to a unit of its build, as kit/clothcheck.ts reads it): cloth lying in a part outside it no
   *  deeper than that check lets skin lie past cloth (GRAZE of this) only grazes the part. */
  size?: number;
  /** On a body laid out, parts (with points in `parts` and a volume in `volumes`) that no cloth lies in, though it covers
   *  none of them: the head with the hair on it. Cloth falling past one stops on it, as on any part (but one in
   *  `fallPast`), and cloth found in one once it has fallen is put out of it (see keepOut). */
  apart?: string[];
  /** Of `apart`, those cloth falling toward the floor falls past rather than stops on, unless it would come to rest in
   *  one, where it stops on it as on any part: on a body laid on its back the head, beside which the cloth falls to the
   *  floor, so cloth that falls clear of it lies as it fell. */
  fallPast?: string[];
  /** How far a triangle (its corners, world) lies off the skin of the parts in `apart` (feet), as far as halfway out
   *  into the room round it for the hair and no further: cloth settling off what it covers comes no nearer that skin
   *  than that where it can, nor nearer than it lay; only where the head rests on what the cloth covers, with no room
   *  between, does the cloth lie on that part under the head (see hangOne). */
  apartNear?: (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => number;
}

/** The farthest a strip turns from its cut (radians from hanging): a strip swung out over a limb raised high stands up
 *  beside it, never folds back over the top. */
const MAX_TURN = 2.8;
/** A limb resting on the cloth from outside presses it in no further than this (radians): one that would take more lies
 *  in what the cloth covers rather than on it. */
const MAX_PRESS = 0.6;
/** A plate swings out no further than this from where it hangs (radians). */
const MAX_PLATE_TURN = 1.75;
/** On a body laid out, the most that what stands up under a plate lifts it (radians): riding on a thigh turns it further. */
const MAX_LAID_TURN = 0.6;
/** On a body laid out, the most a lame of a plate turns from the one above it (radians): lames lap over one another on
 *  their rivets and leathers, and never fold back over the one above. */
const MAX_LAME_TURN = 1.1;
/** The swings aside on its straps a plate's first lame may take on a body laid out (radians), the least first, where
 *  no turn about its edge clears a limb come up into it. */
const PLATE_SWINGS = [0, 0.25, -0.25, 0.5, -0.5];
/** How deep cloth may lie in a part outside it and only graze it, to a unit of the figure's size (`DrapeWorld.size`):
 *  the depth kit/clothcheck.ts lets skin lie past cloth. */
const GRAZE = 0.03;
/** On a body laid out, cloth put out of the head (keepOut) is eased into the cloth round it this many times over, and
 *  so many rings of points round those it moved with it; and once lifted out of what it covers after, the points lifted
 *  this many times more. */
const EASE_PASSES = 8, EASE_RINGS = 2, EASE_AFTER = 2;
/** On a body laid out, cloth so eased that still runs through what it covers between two of its points settles off it
 *  (liftOff) at most this many times over at each of its steps (see hangOne). */
const SETTLE_PASSES = 8;
/** Where the head lies on what the cloth covers, with no room between for the hair, the cloth settles off the part only
 *  just: half this much of its clearance (`Garment.clear`, the room it keeps off what it covers) past it, liftOff taking
 *  a crossing half the clearance it is given past; and it keeps this much of it off the head's skin where it can. */
const HEAD_GAP = 0.25;
/** Cloth settling off what it covers reads the part between the cloth's points (see liftOff) at points of each of its
 *  triangles this far apart, to a unit of the figure's size, finer than a plate's dome or a fold standing through a
 *  pauldron's rim between the cloth's points; but at most eight to a side, so on a large triangle further apart (an
 *  eighth of its longest side). */
const FACE_STEP = 0.012;

/** The points of the parts that lie outside a garment, in its parent's frame (flat x, y, z), but those sunk in what it
 *  covers: a hand pressed into the hip leaves no room for cloth between, so the cloth goes over it there. */
function outsideOf(g: Garment, w: DrapeWorld, toLocal: THREE.Matrix4): number[] {
  const out: number[] = [], v = new THREE.Vector3(), o = new THREE.Vector3(), vols = g.covers.map((n) => w.volumes?.get(n)).filter((f): f is NonNullable<typeof f> => !!f);
  for (const n of g.outside ?? []) for (const p of w.parts.get(n) ?? []) {
    if (vols.some((f) => f(p, o) > -g.clear)) continue;
    v.copy(p).applyMatrix4(toLocal); out.push(v.x, v.y, v.z);
  }
  return out;
}

/** Which way a plate turns about its edge (`hinge`) for a point below the edge to swing out (along `n0`): +1 or -1. */
function probeSide(hinge: THREE.Vector3, n0: THREE.Vector3): number { return new THREE.Vector3(0, -1, 0).applyAxisAngle(hinge, 0.1).dot(n0) > 0 ? 1 : -1; }

/** Hangs each garment, inner ones first. */
export function hangGarments(garments: Garment[], w: DrapeWorld): void {
  const hung = new Map<string, THREE.Vector3[]>(), top = Math.max(0, ...garments.map((g) => g.layer));
  // (inner layers first; on one layer, a plate before cloth: cloth worn beside a plate hangs over it, as a plate never
  // bends for cloth)
  for (const g of [...garments].sort((a, b) => a.layer - b.layer || Number(!!b.stiff) - Number(!!a.stiff))) {
    hangOne(g, w, hung, top);
    g.mesh.updateMatrixWorld(true);
    hung.set(g.name, pointsOf(g.mesh, 900));
    // a plate hung like cloth is, to what is worn over it, a part in one piece: read from the line of the trunk or the leg
    // it lies nearest, as kit/clothcheck.ts reads it, so that cloth over it is lifted out of it as out of a limb (a cloak
    // over the culet of a body fallen on its side)
    if (g.stiff && w.bones) {
      g.mesh.geometry.computeBoundingBox();
      const mid = g.mesh.geometry.boundingBox!.getCenter(new THREE.Vector3()).applyMatrix4(g.mesh.matrixWorld), q = new THREE.Vector3();
      let bone: THREE.Vector3[] | undefined, bd = Infinity;
      for (const n of ['torso', 'thighR', 'thighL']) { const l = w.bones.get(n); if (l) for (let i = 0; i + 1 < l.length; i++) { const d = new THREE.Line3(l[i], l[i + 1]).closestPointToPoint(mid, true, q).distanceTo(mid); if (d < bd) { bd = d; bone = l; } } }
      if (bone) (w.pieces ??= new Map()).set(g.name, [{ bone, surface: pointsOf(g.mesh, Infinity) }]);
    }
    if (g.after) {
      // what the trims add lies on the cloth: marked as the garment's (userData.cloth), not the body's
      let root: THREE.Object3D = g.mesh; while (root.parent) root = root.parent;
      const before = new Set<THREE.Object3D>(); root.traverse((o) => before.add(o));
      g.after(g);
      root.traverse((o) => { if (!before.has(o) && (o as THREE.Mesh).isMesh) o.userData.cloth = g.name; });
    }
  }
}

/** Up to `cap` of a mesh's vertices, world positions. */
export function pointsOf(m: THREE.Mesh, cap = 400): THREE.Vector3[] {
  const p = m.geometry.getAttribute('position') as THREE.BufferAttribute, out: THREE.Vector3[] = [], every = Math.max(1, Math.floor(p.count / cap));
  for (let i = 0; i < p.count; i += every) out.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld));
  return out;
}

/** A point on a hung garment: `u` 0..1 across its columns, `t` 0..1 down its rows (parent frame), pushed out along the
 *  cloth's normal by `off` feet (a trim lying on it). */
export function clothPoint(g: Garment, u: number, t: number, off = 0): THREE.Vector3 {
  const pos = g.mesh.geometry.getAttribute('position') as THREE.BufferAttribute, nor = g.mesh.geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;
  const fc = Math.max(0, Math.min(1, u)) * (g.cols - 1), fr = Math.max(0, Math.min(1, t)) * (g.rows - 1);
  const c0 = Math.min(g.cols - 2, Math.floor(fc)), r0 = Math.min(g.rows - 2, Math.floor(fr)), a = fc - c0, b = fr - r0;
  const out = new THREE.Vector3(), n = new THREE.Vector3(), v = new THREE.Vector3();
  for (const [dc, dr, k] of [[0, 0, (1 - a) * (1 - b)], [1, 0, a * (1 - b)], [0, 1, (1 - a) * b], [1, 1, a * b]] as const) {
    const i = (r0 + dr) * g.cols + c0 + dc;
    out.addScaledVector(v.fromBufferAttribute(pos, i), k);
    if (nor) n.addScaledVector(v.fromBufferAttribute(nor, i), k);
  }
  if (off && n.lengthSq() > 1e-9) {
    // the side of the cloth away from its axis
    const radial = new THREE.Vector3(out.x - g.axis.x, 0, out.z - g.axis.z);
    n.normalize(); if (n.dot(radial) < 0) n.negate();
    out.addScaledVector(n, off);
  }
  return out;
}

function hangOne(g: Garment, w: DrapeWorld, hung: Map<string, THREE.Vector3[]>, topLayer: number): void {
  const geo = g.mesh.geometry, pos = geo.getAttribute('position') as THREE.BufferAttribute, C = g.cols, R = g.rows;
  if (pos.count !== C * R || R < 2) return;
  const parent = g.mesh.parent; if (!parent) return;
  parent.updateWorldMatrix(true, false);
  const toLocal = parent.matrixWorld.clone().invert(), turn = new THREE.Matrix3().setFromMatrix4(toLocal);
  const down = w.down.clone().applyMatrix3(turn).normalize(), ax = g.axis.x, az = g.axis.z, clear = g.clear;
  // what it covers and what lies outside it, in the parent's frame (x, y, z flattened)
  const gather = (names: string[] | undefined, trunk: boolean) => { const out: number[] = [], v = new THREE.Vector3(); for (const n of names ?? []) { const own = w.parts.get(n), isTrunk = !own || !!w.trunk?.includes(n); if (isTrunk !== trunk) continue; for (const p of own ?? hung.get(n) ?? []) { v.copy(p).applyMatrix4(toLocal); out.push(v.x, v.y, v.z); } } return out; };
  const held = new Set(g.holds ?? []), under = gather(g.covers.filter((n) => !held.has(n)), false), heldOn = gather(g.covers.filter((n) => held.has(n)), false), body = gather(g.covers, true), over = w.lying ? [] : outsideOf(g, w, toLocal);
  // each column's own plane: the axis and the way the column faces (horizontal), and the rest of it
  const rest = Float32Array.from(pos.array as ArrayLike<number>);
  const ux = new Float64Array(C), uz = new Float64Array(C), th = new Float64Array(C);
  for (let c = 0; c < C; c++) {
    let sx = 0, sz = 0; for (let r = 0; r < R; r++) { const i = (r * C + c) * 3; sx += rest[i] - ax; sz += rest[i + 2] - az; }
    const l = Math.hypot(sx, sz) || 1; ux[c] = sx / l; uz[c] = sz / l; th[c] = Math.atan2(ux[c], uz[c]);
  }
  // each vertex in its column's plane: out from the axis (rho), up (y), and across (tau, kept as cut)
  const rho = new Float64Array(C * R), ys = new Float64Array(C * R), tau = new Float64Array(C * R);
  for (let c = 0; c < C; c++) for (let r = 0; r < R; r++) { const k = r * C + c, i = k * 3, dx = rest[i] - ax, dz = rest[i + 2] - az; rho[k] = dx * ux[c] + dz * uz[c]; tau[k] = dx * uz[c] - dz * ux[c]; ys[k] = rest[i + 1]; }
  // the angle between columns, to share each obstacle point with the columns either side of it
  const order = Array.from({ length: C }, (_, c) => c).sort((a, b) => th[a] - th[b]), sorted = order.map((c) => th[c]);
  let span = 0; for (let k = 1; k < C; k++) span = Math.max(span, sorted[k] - sorted[k - 1]);
  const step = Math.min(span, (g.closed ? 2 * Math.PI : Math.max(1e-3, sorted[C - 1] - sorted[0])) / Math.max(1, C - 1) * 2.5);
  const lists: number[][] = Array.from({ length: C }, () => []); // per column: rho, y, kind (1 a limb under it, 3 one it hangs on, 2 the trunk under it, -1 outside it)
  const bin = (pts: number[], kind: number) => {
    for (let j = 0; j < pts.length; j += 3) {
      const dx = pts[j] - ax, dz = pts[j + 2] - az, rr = Math.hypot(dx, dz); if (rr < 1e-6) continue;
      const a = Math.atan2(dx, dz), win = step + Math.min(0.6, (clear * 1.5) / rr);
      // columns whose angle is within the window (the sorted angles, with wrap-around)
      let lo = 0, hi = C; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < a) lo = m + 1; else hi = m; }
      for (const dir of [-1, 1]) for (let n = dir < 0 ? 1 : 0; n < C; n++) {
        let k = lo + dir * n; k = ((k % C) + C) % C;
        let d = a - sorted[k]; d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
        if (Math.abs(d) > win) break;
        const c = order[k], pr = rr * Math.cos(d); if (pr <= 0) continue;
        lists[c].push(pr, pts[j + 1], kind);
      }
    }
  };
  bin(under, 1); bin(heldOn, 3); bin(body, 2); bin(over, -1);
  // the way down in each column's plane: out (rho) and up (y); and across it
  const hang = g.hang, alphaG = new Float64Array(C), betaG = new Float64Array(C);
  if (!w.lying) for (let c = 0; c < C; c++) {
    const gr = down.x * ux[c] + down.z * uz[c], gy = down.y, gt = down.x * uz[c] - down.z * ux[c], m = Math.hypot(gr, gy);
    alphaG[c] = m > 1e-6 ? Math.atan2(gr, -gy) * hang * Math.min(1, m / 0.7) : 0;
    betaG[c] = Math.atan2(gt, Math.max(m, 1e-6)) * hang;
  }
  // hang each column: from its top, turn the rest of the strip (as cut) as far toward plumb as the obstacles let it
  const alpha: Float64Array[] = [], limit: Float64Array[] = [];
  const Q = new Float64Array(R * 2), PX = new Float64Array(R), PY = new Float64Array(R), cellBest = new Map<number, number>();
  for (let c = 0; c < C; c++) {
    const a = new Float64Array(R - 1).fill(alphaG[c]), hiA = new Float64Array(R - 1).fill(Infinity); alpha.push(a); limit.push(hiA);
    for (let r = 0; r < R; r++) { Q[r * 2] = rho[r * C + c]; Q[r * 2 + 1] = ys[r * C + c]; }
    const L = lists[c]; if (!L.length) continue;
    // where it hangs from rides out over what pushes up against it there (a waistband over a belly bent down onto it)
    // (one hung from round the neck or across the shoulders stays put, but for easing over the shoulders: it swings out
    // over an arm raised there)
    let ride = 0;
    for (let j = 0; j < L.length; j += 3) if (L[j + 2] > 0 && Math.abs(L[j + 1] - Q[1]) <= clear * 2) ride = Math.max(ride, L[j] + clear - Q[0]);
    if (g.anchored !== undefined) ride = Math.min(ride, g.anchored);
    if (ride > 0) for (let r = 0; r < R; r++) { Q[r * 2] += ride; rho[r * C + c] += ride; }
    // keep only the points that can stop the strip: those out past its cut (or near it), unless it is turning in
    const inward = alphaG[c] < -0.05, yTop = Q[1], yHem = Q[(R - 1) * 2 + 1], keep: number[] = [], best = cellBest;
    let falls = true; for (let r = 1; r < R; r++) if (Q[r * 2 + 1] > Q[(r - 1) * 2 + 1]) { falls = false; break; }
    // the cut's distance out at a height (from the top down)
    const cutAt = (y: number) => {
      if (y >= yTop) return Q[0];
      if (falls) { if (y <= yHem) return Q[(R - 1) * 2]; let lo = 0, hi = R - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (Q[m * 2 + 1] > y) lo = m; else hi = m; } const y0 = Q[lo * 2 + 1], y1 = Q[hi * 2 + 1], t = y0 - y1 > 1e-9 ? (y0 - y) / (y0 - y1) : 0; return Q[lo * 2] + (Q[hi * 2] - Q[lo * 2]) * t; }
      for (let r = 1; r < R; r++) { const y0 = Q[(r - 1) * 2 + 1], y1 = Q[r * 2 + 1]; if ((y <= y0 && y >= y1) || (y >= y0 && y <= y1)) { const t = Math.abs(y1 - y0) > 1e-9 ? (y - y0) / (y1 - y0) : 0; return Q[(r - 1) * 2] + (Q[r * 2] - Q[(r - 1) * 2]) * t; } }
      return Q[(R - 1) * 2];
    };
    const cellH = Math.max(clear, 0.02) * 1.2;
    // (a point further from where it hangs than the whole strip is long can never stop it: a cloak spread on the floor
    // round a body laid out, far past a capelet's hem, is no business of the capelet's, and must not stand in for the arm
    // beneath it as the outermost point at that height)
    let far = clear; for (let r = 1; r < R; r++) far += Math.hypot(Q[r * 2] - Q[(r - 1) * 2], Q[r * 2 + 1] - Q[(r - 1) * 2 + 1]);
    for (let j = 0; j < L.length; j += 3) {
      const pr = L[j], py = L[j + 1];
      if ((pr - Q[0]) ** 2 + (py - Q[1]) ** 2 > far * far) continue;
      if (L[j + 2] === 2 && py > yTop + clear) continue;
      if (w.lying && L[j + 2] === 1 && py > yTop + clear) continue; // (on a body laid out, a limb flung up past where it hangs from is not under it)
      if (!inward && L[j + 2] > 0) {
        if (py < Math.min(yTop, yHem) - clear * 2 && py < yHem - 0.05) continue;
        if (pr < cutAt(py) - clear * 3) continue;
      }
      // at each height only the outermost point of what it covers (and the innermost of what lies outside it) can
      // stop the strip first: keep those; and above where it hangs from (an arm raised beside the neck) the innermost
      // of what it covers too, which the strip must rise most steeply to clear
      const cell = Math.floor(py / cellH) * 3 + (L[j + 2] > 0 ? 0 : 1), at = best.get(cell);
      if (at === undefined) { best.set(cell, keep.length); keep.push(pr, py, L[j + 2]); }
      else if (L[j + 2] > 0 ? pr > keep[at] : pr < keep[at]) { keep[at] = pr; keep[at + 1] = py; }
      if (L[j + 2] > 0 && py > yTop) {
        const at2 = best.get(cell + 2);
        if (at2 === undefined) { best.set(cell + 2, keep.length); keep.push(pr, py, L[j + 2]); }
        else if (pr < keep[at2]) { keep[at2] = pr; keep[at2 + 1] = py; }
      }
    }
    best.clear();
    if (!keep.length && Math.abs(alphaG[c]) < 1e-4) continue;
    // chords of the cut from each vertex to those below it: lengths and angles from hanging
    const n = R; const len = new Float64Array(n * n), ang = new Float64Array(n * n);
    for (let i = 0; i < n; i++) for (let k = i + 1; k < n; k++) { const dr = Q[k * 2] - Q[i * 2], dy = Q[k * 2 + 1] - Q[i * 2 + 1]; len[i * n + k] = Math.hypot(dr, dy); ang[i * n + k] = Math.atan2(dr, -dy); }
    let px = Q[0], py = Q[1];
    PX[0] = px; PY[0] = py;
    const needs: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      let lo = -Infinity, hi = Infinity, hiD = Infinity, caLo = 0, caHi = 0; const reach = len[i * n + n - 1];
      needs.length = 0;
      for (let j = 0; j < keep.length; j += 3) {
        const dr = keep[j] - px, dy = keep[j + 1] - py, d = Math.sqrt(dr * dr + dy * dy); if (d < 1e-6 || d > reach + clear) continue;
        // a point above this vertex is the cloth above's business: what it covers already lies inside it (a hip the
        // skirt has passed over), and what lies outside it is out of the way of the cloth below
        if (dy > clear * 0.25) {
          if (keep[j + 2] < 0) continue;
          // (and under a garment cut off at its top, the trunk just above where the strip hangs from, no further out
          // than its top, is under no cloth of this strip's at all: it never turns the cloth far below it out)
          let inside = !!g.cutTop && keep[j + 2] === 2 && keep[j + 1] > PY[0] && keep[j] < PX[0] + clear * 0.5;
          for (let m = i; m >= 1; m--) { const y0 = PY[m - 1], y1 = PY[m]; if ((keep[j + 1] - y0) * (keep[j + 1] - y1) <= 0) { const t = Math.abs(y1 - y0) > 1e-9 ? (keep[j + 1] - y0) / (y1 - y0) : 0; inside = keep[j] < PX[m - 1] + (PX[m] - PX[m - 1]) * t + clear * 0.5; break; } }
          if (inside) continue;
        }
        // the cut's chord at that distance from this vertex
        let k = i + 1, kh = n - 1; while (k < kh) { const m = (k + kh) >> 1; if (len[i * n + m] < d) k = m + 1; else kh = m; }
        const l0 = k - 1 === i ? 0 : len[i * n + k - 1], l1 = len[i * n + k], a0 = k - 1 === i ? ang[i * n + k] : ang[i * n + k - 1];
        const t = l1 > l0 ? Math.max(0, Math.min(1, (d - l0) / (l1 - l0))) : 1, phi = a0 + (ang[i * n + k] - a0) * t;
        // (the room it keeps closes up near where it hangs from: a neckline or a waistband lies on the body)
        const near = Math.min(1, d / (3 * clear)), q = clear * near * near * (3 - 2 * near) / Math.max(d, 1e-6), psi = Math.atan2(dr, -dy), ca = q < 0.5 ? q * (1 + q * q * (1 / 6 + q * q * 0.075)) : Math.asin(Math.min(1, q));
        if (keep[j + 2] > 0) { const need = psi + ca - phi; if (need > MAX_TURN) continue; if (need > lo) { lo = need; caLo = ca; } needs.push(need, d); }
        else { const h = psi - ca - phi; if (h < hi && h > -MAX_PRESS) { hi = h; hiD = d; caHi = ca; } }
      }
      // pressed between the two with less room than it keeps: it lies between them, touching both
      if (lo > hi && lo - hi <= caLo + caHi) { const m = caLo + caHi > 1e-9 ? (lo * caHi + hi * caLo) / (caLo + caHi) : lo; lo = hi = m; }
      // a limb resting on the cloth from outside (a hand on the hip) presses it in: what it covers further down than the
      // limb is left to the cloth below it, which turns out again past the limb
      if (lo > hi) { let near = -Infinity; for (let m = 0; m < needs.length; m += 2) if (needs[m + 1] <= hiD + clear) near = Math.max(near, needs[m]); lo = near; }
      let al = alphaG[c];
      if (al > hi) al = hi;
      if (al < lo) al = lo;                   // what it covers wins over what lies outside it
      al = Math.max(-MAX_TURN, Math.min(MAX_TURN, al));
      a[i] = al; hiA[i] = hi;
      if (g.stiff) { a.fill(al); break; }
      const vr = Q[(i + 1) * 2] - Q[i * 2], vy = Q[(i + 1) * 2 + 1] - Q[i * 2 + 1], cs = Math.cos(al), sn = Math.sin(al);
      px += vr * cs - vy * sn; py += vr * sn + vy * cs; PX[i + 1] = px; PY[i + 1] = py;
    }
  }
  // a plate turns as one, about the line of its top edge, as far as its most lifted strip needs (a strip off to the side
  // of the plate is lifted less by that turn, so it needs more of it)
  let plate: { pivot: THREE.Vector3; hinge: THREE.Vector3; n0: THREE.Vector3; turn: number } | undefined;
  if (g.stiff) {
    const p0 = new THREE.Vector3(rest[0], rest[1], rest[2]), p1 = new THREE.Vector3(rest[(C - 1) * 3], rest[(C - 1) * 3 + 1], rest[(C - 1) * 3 + 2]), mid = Math.floor(C / 2);
    const pivot = new THREE.Vector3(rest[mid * 3], rest[mid * 3 + 1], rest[mid * 3 + 2]), hinge = p1.clone().sub(p0).setY(0).normalize();
    const n0 = new THREE.Vector3().crossVectors(hinge, new THREE.Vector3(0, 1, 0)); if (n0.x * (pivot.x - ax) + n0.z * (pivot.z - az) < 0) n0.negate();
    let A = 0;
    for (let c = 0; c < C; c++) { const need = alpha[c][0] - alphaG[c]; if (need <= 0) continue; const k = Math.max(0.3, ux[c] * n0.x + uz[c] * n0.z); A = Math.max(A, Math.asin(Math.min(1, Math.sin(Math.min(need, Math.PI / 2)) / k))); }
    if (w.lying && w.bones) {
      // (on a body laid out it does not hang toward the floor: it rides on what it covers, swung out as far as a thigh
      // under it has turned out from hanging straight down, about the line of the plate's edge; a thigh turned the other
      // way, away from it, leaves it lying where it was; and what still stands up under it lifts it only a little, as a
      // plate lying on a body is not stood up on its edge; the trunk it hangs over turns with it, and swings it no further)
      A = Math.min(A, MAX_LAID_TURN);
      const down0 = new THREE.Vector3(0, -1, 0), d = new THREE.Vector3(), out = probeSide(hinge, n0);
      for (const n of g.covers) {
        const b = w.trunk?.includes(n) ? undefined : w.bones.get(n); if (!b || b.length < 2) continue;
        d.copy(b[1]).sub(b[0]).applyMatrix3(turn); d.addScaledVector(hinge, -d.dot(hinge)); if (d.lengthSq() < 1e-10) continue; d.normalize();
        A = Math.max(A, out * Math.atan2(new THREE.Vector3().crossVectors(down0, d).dot(hinge), down0.dot(d)));
      }
    }
    // (turned so a point below the edge swings out)
    plate = { pivot, hinge, n0, turn: Math.min(MAX_PLATE_TURN, A) * probeSide(hinge, n0) };
    for (const a of alpha) a.fill(0);
  }
  // a strip swung out draws its neighbours along
  const W = g.stiff ? 0 : Math.max(0, Math.round(g.spread)), out: Float64Array[] = alpha.map((a) => Float64Array.from(a));
  if (W > 0) for (let i = 0; i < R - 1; i++) for (let c = 0; c < C; c++) {
    let best = 0;
    for (let n = -W; n <= W; n++) {
      let k = c + n; if (g.closed) k = ((k % (C - 1)) + (C - 1)) % (C - 1); else if (k < 0 || k >= C) continue;
      const e = alpha[k][i] - alphaG[k]; if (e <= 0) continue;
      const kk = 0.5 + 0.5 * Math.cos(Math.PI * Math.abs(n) / (W + 1)); best = Math.max(best, e * kk);
    }
    const want = Math.min(alphaG[c] + best, limit[c][i]);
    if (want > out[c][i]) out[c][i] = Math.min(MAX_TURN, want);
  }
  // build each strip again from its top, and turn it across toward plumb
  const P = new Float64Array(C * R * 3);
  for (let c = 0; c < C; c++) {
    let pr = rho[c], py = ys[c];
    const bx = ux[c], bz = uz[c];
    const put = (r: number, rr: number, yy: number) => { const k = r * C + c, t = tau[k]; P[k * 3] = ax + rr * bx + t * bz; P[k * 3 + 1] = yy; P[k * 3 + 2] = az + rr * bz - t * bx; };
    put(0, pr, py);
    for (let r = 0; r < R - 1; r++) {
      const k0 = r * C + c, k1 = (r + 1) * C + c, vr = rho[k1] - rho[k0], vy = ys[k1] - ys[k0], al = out[c][r], cs = Math.cos(al), sn = Math.sin(al);
      pr += vr * cs - vy * sn; py += vr * sn + vy * cs; put(r + 1, pr, py);
    }
    // across: about the line out from the top of the strip, toward the way down
    const be = g.stiff ? 0 : betaG[c]; if (Math.abs(be) > 1e-4) {
      const top = new THREE.Vector3(P[c * 3], P[c * 3 + 1], P[c * 3 + 2]), axis = new THREE.Vector3(bx, 0, bz), q = new THREE.Quaternion().setFromAxisAngle(axis, be), v = new THREE.Vector3();
      for (let r = 1; r < R; r++) { const k = (r * C + c) * 3; v.set(P[k] - top.x, P[k + 1] - top.y, P[k + 2] - top.z).applyQuaternion(q); P[k] = top.x + v.x; P[k + 1] = top.y + v.y; P[k + 2] = top.z + v.z; }
    }
  }
  const inLames = !!(plate && w.lying && w.bones && g.lames?.length);
  if (plate && plate.turn && !inLames) { const q = new THREE.Quaternion().setFromAxisAngle(plate.hinge, plate.turn), v = new THREE.Vector3(); for (let k = 0; k < C * R; k++) { v.set(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]).sub(plate.pivot).applyQuaternion(q).add(plate.pivot); P[k * 3] = v.x; P[k * 3 + 1] = v.y; P[k * 3 + 2] = v.z; } }
  // a seam stays closed
  if (g.closed) for (let r = 0; r < R; r++) { const a = (r * C) * 3, b = (r * C + C - 1) * 3; for (let k = 0; k < 3; k++) { const m = (P[a + k] + P[b + k]) / 2; P[a + k] = m; P[b + k] = m; } }
  // cloth lies on the floor rather than passing into it (on a body laid out, what lies under it lies under the cloth
  // nearer the body: an outer garment beneath the body is nearer the floor; a plate does not fall, but keeps the turn
  // it swung by, as one piece)
  const toWorld = parent.matrixWorld, v = new THREE.Vector3(), o = new THREE.Vector3();
  const lvl = w.floor === undefined ? Infinity : w.floor - new THREE.Vector3().setFromMatrixPosition(toWorld).dot(w.down) - 0.005 - (w.lying ? 0.012 * (topLayer - g.layer) : 0);
  const onFloor = () => { for (let k = 0; k < C * R; k++) { const d = P[k * 3] * down.x + P[k * 3 + 1] * down.y + P[k * 3 + 2] * down.z - lvl; if (d > 0) { P[k * 3] -= d * down.x; P[k * 3 + 1] -= d * down.y; P[k * 3 + 2] -= d * down.z; } } };
  // on a body laid out a plate in lames turns from its cut as one piece only so far, and falls on from there, a lame at a
  // time, onto what lies under it
  if (plate && inLames) {
    // (what it comes to rest on, read as the cloth check reads the body: the lines from each part's bone out to its
    // surface, those that pass near enough to the plate to cross it)
    const top = (k: number) => new THREE.Vector3(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]), pivot = plate.pivot, piv = pivot.clone().applyMatrix4(toWorld);
    const { at, trunk: tr, balls } = linesOf(w), e = toLocal.elements;
    if (lineBuf.length < at.length) { lineBuf = new Float64Array(at.length); trunkBuf = new Uint8Array(tr.length); }
    // (as far as any lame of it can come from the point the first turns about, where its top was cut to hang before it
    // rode out over what pushes against it: each lame turns about where it hangs from the one above, carried by those
    // above)
    const starts = [0, ...g.lames!.slice(0, -1).map((r) => r + 1)];
    let reach = 0, path = 0, n = 0, from = pivot;
    for (let i = 0; i < starts.length; i++) {
      const oi = i ? lameHinge(P, C, starts[i]).o : pivot; path += oi.distanceTo(from); from = oi;
      for (let k = starts[i] * C; k < C * R; k++) reach = Math.max(reach, path + top(k).distanceTo(oi));
    }
    reach += clear;
    for (let q = 0; q * RUN < tr.length; q++) {
      const bx = balls[q * 4] - piv.x, by = balls[q * 4 + 1] - piv.y, bz = balls[q * 4 + 2] - piv.z, br = balls[q * 4 + 3] + reach;
      if (bx * bx + by * by + bz * bz > br * br) continue;
      for (let j = q * RUN; j < Math.min(tr.length, (q + 1) * RUN); j++) {
        const k = j * 6, ax = at[k], ay = at[k + 1], az = at[k + 2], dx = at[k + 3] - ax, dy = at[k + 4] - ay, dz = at[k + 5] - az, l2 = dx * dx + dy * dy + dz * dz;
        if (l2 < 1e-12) continue;
        const u = Math.max(0, Math.min(1, ((piv.x - ax) * dx + (piv.y - ay) * dy + (piv.z - az) * dz) / l2)), cx = ax + dx * u - piv.x, cy = ay + dy * u - piv.y, cz = az + dz * u - piv.z;
        if (cx * cx + cy * cy + cz * cz > reach * reach) continue;
        // (in the plate's frame, and on out past the surface by the room it keeps)
        const x = 1 + clear / Math.sqrt(l2), bx2 = ax + dx * x, by2 = ay + dy * x, bz2 = az + dz * x, o6 = n * 6;
        lineBuf[o6] = e[0] * ax + e[4] * ay + e[8] * az + e[12]; lineBuf[o6 + 1] = e[1] * ax + e[5] * ay + e[9] * az + e[13]; lineBuf[o6 + 2] = e[2] * ax + e[6] * ay + e[10] * az + e[14];
        lineBuf[o6 + 3] = e[0] * bx2 + e[4] * by2 + e[8] * bz2 + e[12]; lineBuf[o6 + 4] = e[1] * bx2 + e[5] * by2 + e[9] * bz2 + e[13]; lineBuf[o6 + 5] = e[2] * bx2 + e[6] * by2 + e[10] * bz2 + e[14];
        trunkBuf[n++] = tr[j];
      }
    }
    settlePlate(P, C, starts, plate.pivot, plate.hinge, plate.n0, plate.turn, down, lvl, lineBuf.subarray(0, n * 6), trunkBuf.subarray(0, n), clear);
  }
  if (w.floor !== undefined) {
    if (w.lying && !g.stiff) {
      // (nor through a part of the body on the way down: each part's volume, tested inside its bounds)
      // (but those it falls past, unless it would come to rest in one)
      const vols: [THREE.Box3, (p: THREE.Vector3, out: THREE.Vector3) => number, boolean][] = [], past: typeof vols = [];
      for (const [n, f] of w.volumes ?? []) { const pts = w.parts.get(n); if (pts?.length) (w.fallPast?.includes(n) ? past : vols).push([new THREE.Box3().setFromPoints(pts).expandByScalar(clear), f, g.covers.includes(n) && !w.trunk?.includes(n)]); }
      const q = new THREE.Vector3(), tmp = new THREE.Vector3();
      const inside = (x: number, y: number, z: number, covered: boolean) => { q.set(x, y, z).applyMatrix4(toWorld); for (const [b, f, c] of vols) if ((c || !covered) && b.containsPoint(q) && f(q, tmp) > -clear * 0.5) return true; return false; };
      const inPast = (x: number, y: number, z: number) => { q.set(x, y, z).applyMatrix4(toWorld); for (const [b, f] of past) if (b.containsPoint(q) && f(q, tmp) > -clear * 0.5) return true; return false; };
      drop(P, C, R, g.closed, down, lvl, [under, heldOn, body, over], clear, inside, past.length ? inPast : undefined);
    }
    onFloor();
  }
  // what lies outside it (a forearm laid across it, a hand hanging at its side) lies on it, never in it: cloth caught in
  // such a part is laid under it, pressed in toward the body, and what it covers pushes it back out of the body below
  // (squeezed thin between the two where the part leaves little room)
  if (g.outside?.length && w.bones && !g.stiff && geo.index) layUnder(P, geo.index.array, g.outside, w, toLocal, clear, ax, az, g.closed ? C : undefined);
  // anything still inside what it covers is pushed out of it (all of it, or the points `ks`)
  const coverVols = w.volumes && !g.stiff ? g.covers.map((n) => w.volumes!.get(n)).filter((f): f is NonNullable<typeof f> => !!f) : [];
  const pushOut = (ks?: number[]) => {
    for (let i = 0, n = ks ? ks.length : C * R; i < n; i++) {
      const k = ks ? ks[i] : i;
      v.set(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]).applyMatrix4(toWorld);
      let moved = false;
      for (let pass = 0; pass < 3; pass++) {
        let any = false;
        for (const f of coverVols) { const d = f(v, o); if (d > -clear * 0.5) { v.addScaledVector(o, d + clear * 0.5); any = true; moved = true; } }
        if (!any) break;
      }
      if (moved) { v.applyMatrix4(toLocal); P[k * 3] = v.x; P[k * 3 + 1] = v.y; P[k * 3 + 2] = v.z; }
    }
  };
  if (coverVols.length) pushOut();
  // and where it still runs through a part it covers, between the part's bone and its surface (cloth drawn across a
  // toe, or over an elbow between two of its strips), it is lifted out past the surface there
  // (never through the floor: cloth under a limb resting on the floor stays on the floor under it)
  // (on a body standing, above where it hangs from there is no body under the cloth for it to be pressed in onto: a
  // capelet drawn up the inside of an arm raised past the shoulders comes out of the arm on that side, toward the neck)
  let rise = -Infinity; for (let c = 0; c < C; c++) rise = Math.max(rise, P[c * 3 + 1] + clear);
  if ((w.bones || w.pieces) && !g.stiff && geo.index) { liftOut(P, geo.index.array, g.covers, w, toLocal, clear, ax, az, w.lying ? down.clone().negate() : undefined, w.lying ? undefined : rise, g.closed ? C : undefined); onFloor(); }
  // (on a body laid out, what no cloth lies in, the head with the hair on it: cloth cut where the head has come to lie,
  // or lifted into it out of what it covers, is put out of it; never into what it covers, though, which wins where it
  // lies in that room itself, as an upper arm the head has come to rest on does: there the cloth lies on the arm, nearer
  // the head)
  if (w.lying && w.apart?.length && w.volumes && !g.stiff && Number.isFinite(lvl)) {
    const fs = w.apart.map((n) => w.volumes!.get(n)).filter((f): f is NonNullable<typeof f> => !!f);
    const floorW = lvl + new THREE.Vector3().setFromMatrixPosition(toWorld).dot(w.down), was = P.slice();
    keepOut(P, fs, toWorld, toLocal, w.down, floorW, clear, coverVols);
    // (each point is put out on its own, so the cloth it moved is eased into the cloth round it, that it neither folds
    // back on itself nor runs through itself where a point was moved and the next was not: the points moved and two
    // rings round them, never the top it hangs from, each drawn halfway to the middle of its neighbours, a few times
    // over, and each time put back out of what it covers, out of the head, and onto the floor; a closed garment's seam
    // is one point)
    const one = (k: number) => (g.closed && k % C === C - 1 ? k - C + 1 : k), eased = new Uint8Array(C * R);
    let ring: number[] = [];
    for (let k = 0; k < C * R; k++) if ((P[k * 3] !== was[k * 3] || P[k * 3 + 1] !== was[k * 3 + 1] || P[k * 3 + 2] !== was[k * 3 + 2]) && !eased[one(k)]) { eased[one(k)] = 1; ring.push(one(k)); }
    if (ring.length && geo.index) {
      const ix = geo.index.array, nb: number[][] = Array.from({ length: C * R }, () => []);
      for (let t = 0; t + 2 < ix.length; t += 3) for (let e = 0; e < 3; e++) { const a = one(ix[t + e]), b = one(ix[t + ((e + 1) % 3)]); if (a !== b && !nb[a].includes(b)) { nb[a].push(b); nb[b].push(a); } }
      for (let q = 0; q < EASE_RINGS; q++) { const next: number[] = []; for (const k of ring) for (const m of nb[k]) if (!eased[m]) { eased[m] = 1; next.push(m); } ring = next; }
      const ks: number[] = []; for (let k = C; k < C * R; k++) if (eased[k]) ks.push(k);
      const snap = new Float64Array(P.length);
      const ease = (L: number[], passes: number) => {
        for (let pass = 0; pass < passes; pass++) {
          snap.set(P);
          for (const k of L) {
            const n = nb[k]; if (!n.length) continue;
            let x = 0, y = 0, z = 0; for (const m of n) { x += snap[m * 3]; y += snap[m * 3 + 1]; z += snap[m * 3 + 2]; }
            P[k * 3] = (snap[k * 3] + x / n.length) / 2; P[k * 3 + 1] = (snap[k * 3 + 1] + y / n.length) / 2; P[k * 3 + 2] = (snap[k * 3 + 2] + z / n.length) / 2;
          }
          if (coverVols.length) pushOut(L);
          keepOut(P, fs, toWorld, toLocal, w.down, floorW, clear, coverVols);
          onFloor();
          if (g.closed) for (let r = 0; r < R; r++) for (let i = 0; i < 3; i++) P[(r * C + C - 1) * 3 + i] = P[r * C * 3 + i];
        }
      };
      ease(ks, EASE_PASSES);
      // (and where, eased so, it runs through what it covers between two of its points, over a shoulder, it is lifted
      // out as before, put out of the head once more, and what was lifted eased into the cloth round it again)
      if (w.bones || w.pieces) {
        const sub: number[] = []; for (let t = 0; t + 2 < ix.length; t += 3) if (eased[one(ix[t])] || eased[one(ix[t + 1])] || eased[one(ix[t + 2])]) sub.push(ix[t], ix[t + 1], ix[t + 2]);
        const before = P.slice();
        liftOut(P, sub, g.covers, w, toLocal, clear, ax, az, down.clone().negate(), undefined, g.closed ? C : undefined); onFloor();
        keepOut(P, fs, toWorld, toLocal, w.down, floorW, clear, coverVols);
        const lifted = new Uint8Array(C * R); for (const k of ks) if (P[k * 3] !== before[k * 3] || P[k * 3 + 1] !== before[k * 3 + 1] || P[k * 3 + 2] !== before[k * 3 + 2]) lifted[k] = 1;
        const L = ks.filter((k) => lifted[k] || nb[k].some((m) => lifted[m]));
        if (L.length) ease(L, EASE_AFTER);
        // (and where it still runs through what it covers between two of its points, an arm come up through it beside the
        // head, it settles off the part the least way that takes it out, no nearer the head's skin than halfway out into
        // the room round it for the hair, nor nearer than it already lay, each face of it round a corner moved; where that
        // leaves it in the part, the head lying on it with no such room between, what it covers wins, as it does where
        // the cloth is put out of the head: there the cloth settles off the part only just, keeping as much off the head's
        // skin where it can, and where it cannot, the head resting on the part right through the cloth, it lies on the
        // part under the head; a crossing taken only partway, a corner of it held, is not taken again. It is read along the
        // lines from the part's bone out to its points, and between the cloth's points along the rays from the bone out
        // through them, where the part's faces are read: a fold of it standing through a pauldron's rim; and down toward
        // the floor only where there is room for the cloth under the part)
        const near = w.apartNear, fa = new THREE.Vector3(), fb = new THREE.Vector3(), fc = new THREE.Vector3();
        const around: number[][] = Array.from({ length: C * R }, () => []); for (let t = 0; t + 2 < ix.length; t += 3) for (let e = 0; e < 3; e++) around[ix[t + e]].push(t);
        const corner = (i: number, k: number, to: THREE.Vector3 | undefined, out: THREE.Vector3) => (i === k && to ? out.copy(to) : out.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2])).applyMatrix4(toWorld);
        const face = (f: (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => number, t: number, k: number, to?: THREE.Vector3) => f(corner(ix[t], k, to, fa), corner(ix[t + 1], k, to, fb), corner(ix[t + 2], k, to, fc));
        const offHead = (m: number) => near && ((k: number, to: THREE.Vector3) => around[k].every((t) => face(near, t, k, to) >= Math.min(m, face(near, t, k))));
        const heldFaces = new Uint8Array(sub.length / 3), inside = facesNear(P, sub, g.covers, w, toWorld, toLocal);
        const settle = (c: number, may: ((k: number, to: THREE.Vector3) => boolean) | undefined) => { for (let pass = 0; pass < SETTLE_PASSES && liftOff(P, sub, g.covers, w, toLocal, c, (k) => k < C, down, g.closed ? C : undefined, may, heldFaces, { floor: lvl, room: clear, inside }); pass++) onFloor(); };
        settle(clear, offHead(Infinity));
        for (const may of [offHead(clear * HEAD_GAP), undefined]) {
          let left = false; for (let t = 0; t < heldFaces.length; t++) if (heldFaces[t] === 2) { heldFaces[t] = 0; left = true; }
          if (!left) break;
          settle(clear * HEAD_GAP, may);
        }
      }
    }
  }
  for (let k = 0; k < C * R; k++) pos.setXYZ(k, P[k * 3], P[k * 3 + 1], P[k * 3 + 2]);
  pos.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingBox(); geo.computeBoundingSphere();
}

/** How deep a point (world) lies in a part, feet (<= 0 outside), and the way out of it, as `DrapeWorld.volumes` reads. */
type Volume = (p: THREE.Vector3, out: THREE.Vector3) => number;

/** Puts points (`P`, flat x, y, z in a frame `toWorld` takes to the world and `toLocal` back) out of volumes (`fs`, each
 *  how deep a point in the world lies in it, and the way out, as `DrapeWorld.volumes` reads): `clear` / 2 past one,
 *  straight out of it; or, where that way would take a point into the floor (`floor` along `down`, both world), onto the
 *  floor and on along it, out from under the volume. Never into one of `keep` (the parts the cloth covers, volumes read
 *  the same way), which win: a point goes that way only so far as it can without coming deeper into one of them than
 *  `clear` / 2 short of it, or than it already lay, and rests there, nearer the volume. A point left where it was is
 *  left to the last digit. Exported for the cloth laid on with a garment (a folded hood), and for tests. */
export function keepOut(P: Float64Array, fs: Volume[], toWorld: THREE.Matrix4, toLocal: THREE.Matrix4, down: THREE.Vector3, floor: number, clear: number, keep: Volume[] = []): void {
  if (!fs.length) return;
  const v = new THREE.Vector3(), o = new THREE.Vector3(), a = new THREE.Vector3(), t = new THREE.Vector3(), u = new THREE.Vector3(), from = new THREE.Vector3(), start = new THREE.Vector3(), step = Math.max(clear * 0.25, 0.004);
  const most = new Float64Array(keep.length), ok = (p: THREE.Vector3) => { for (let i = 0; i < keep.length; i++) if (keep[i](p, u) > most[i]) return false; return true; };
  // (how far from `from` along `o` it can go, up to `l`: never into what it covers, nor into the floor)
  const reach = (l: number) => { let lo = 0, hi = l; for (let it = 0; it < 20; it++) { const m = (lo + hi) / 2; t.copy(from).addScaledVector(o, m); if (ok(t) && t.dot(down) <= floor) lo = m; else hi = m; } return lo; };
  for (let k = 0; k < P.length / 3; k++) {
    v.set(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]).applyMatrix4(toWorld); start.copy(v);
    for (let i = 0; i < keep.length; i++) most[i] = Math.max(-clear * 0.5, keep[i](v, u));
    for (let pass = 0; pass < 3; pass++) {
      let any = false;
      for (const f of fs) {
        const d = f(v, o); if (d <= -clear * 0.5) continue;
        from.copy(v); v.addScaledVector(o, d + clear * 0.5);
        // (that way runs into what it covers: as far as it can go, and no further)
        if (keep.length && !ok(v)) { v.copy(from).addScaledVector(o, reach(d + clear * 0.5)); continue; }
        any = true;
        const under = v.dot(down) - floor; if (under <= 0) continue;
        // (no room that way, the floor being there: along the floor instead)
        v.addScaledVector(down, -under);
        if (keep.length && !ok(v)) { v.copy(from).addScaledVector(o, reach(d + clear * 0.5)); continue; }
        a.copy(o).addScaledVector(down, -o.dot(down));
        if (a.lengthSq() < 1e-8) continue;
        a.normalize();
        for (let s = step; s < 3; s += step) { t.copy(v).addScaledVector(a, s); if (keep.length && !ok(t)) break; if (f(t, o) <= -clear * 0.5) { v.copy(t); break; } }
      }
      if (!any) break;
    }
    if (v.x !== start.x || v.y !== start.y || v.z !== start.z) { v.applyMatrix4(toLocal); P[k * 3] = v.x; P[k * 3 + 1] = v.y; P[k * 3 + 2] = v.z; }
  }
}

/** A part's faces near the cloth, as liftOff reads them (`more.inside`): the faces (three corners to a face, x, y, z for
 *  each, in the cloth's frame), a grid of them `h` wide, the part's bone in that frame, and how far its surface reaches
 *  from the bone. */
export type PartFaces = { F: Float64Array; grid: Map<number, number[]>; h: number; bone: number[]; reach: number };

const cellKey = (x: number, y: number, z: number) => ((x + 512) * 1024 + y + 512) * 1024 + z + 512;

/** The faces of the parts `covers` with a bone of their own (`w.faces`; a part in pieces has none) that can stand
 *  through the cloth (`P`, flat x, y, z in the frame `toLocal` takes the world to, triangles `index`; `toWorld` back):
 *  those no further from it than the part reaches from its bone, in that frame, for liftOff. Exported for tests. */
export function facesNear(P: Float64Array, index: ArrayLike<number>, covers: string[], w: DrapeWorld, toWorld: THREE.Matrix4, toLocal: THREE.Matrix4): Map<string, PartFaces> {
  const out = new Map<string, PartFaces>();
  if (!w.faces || !w.bones || !index.length) return out;
  const box = new THREE.Box3(), a = new THREE.Vector3(), q = new THREE.Vector3(), seg = new THREE.Line3(), tb = new THREE.Box3(), c3 = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (let i = 0; i < index.length; i++) { const k = index[i]; box.expandByPoint(a.set(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]).applyMatrix4(toWorld)); }
  for (const n of covers) {
    const bone = w.bones.get(n), F = w.pieces?.get(n)?.length || !bone || bone.length < 2 ? undefined : w.faces(n);
    if (!F || !bone) continue;
    // (as far as the part reaches from its bone: a face further than that from the cloth cannot stand through it)
    let reach = 0;
    for (let o = 0; o + 2 < F.length; o += 3) { a.set(F[o], F[o + 1], F[o + 2]); let d = Infinity; for (let i = 0; i + 1 < bone.length; i++) d = Math.min(d, seg.set(bone[i], bone[i + 1]).closestPointToPoint(a, true, q).distanceTo(a)); reach = Math.max(reach, d); }
    const near = box.clone().expandByScalar(reach), L: number[] = [];
    let edge = 0;
    for (let o = 0; o + 8 < F.length; o += 9) {
      for (let c = 0; c < 3; c++) c3[c].set(F[o + c * 3], F[o + c * 3 + 1], F[o + c * 3 + 2]);
      if (!near.intersectsBox(tb.setFromPoints(c3))) continue;
      edge += Math.max(c3[0].distanceTo(c3[1]), c3[1].distanceTo(c3[2]), c3[2].distanceTo(c3[0]));
      for (const c of c3) { c.applyMatrix4(toLocal); L.push(c.x, c.y, c.z); }
    }
    const nf = L.length / 9; if (!nf) continue;
    const h = Math.max(0.02 * (w.size ?? 1), 2 * edge / nf), grid = new Map<number, number[]>();
    for (let f = 0; f < nf; f++) {
      const o = f * 9, lo = [0, 1, 2].map((k) => Math.floor(Math.min(L[o + k], L[o + 3 + k], L[o + 6 + k]) / h)), hi = [0, 1, 2].map((k) => Math.floor(Math.max(L[o + k], L[o + 3 + k], L[o + 6 + k]) / h));
      for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) { const k = cellKey(x, y, z); let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(f); }
    }
    out.set(n, { F: Float64Array.from(L), grid, h, bone: bone.flatMap((p) => q.copy(p).applyMatrix4(toLocal).toArray()), reach });
  }
  return out;
}

/** Settles cloth (`P`, flat x, y, z in its parent's frame, `toLocal` from the world) off the parts it covers (`covers`)
 *  where the line from a part's bone out to a point of its surface crosses one of the triangles `index`: the corners of
 *  such a triangle go out along that line, each its share of the least move of the three that takes the crossing
 *  `clear` / 2 past the surface (the corner nearest the crossing the furthest), whichever way the line runs but down
 *  onto the floor (`down`, in the parent's frame: cloth under a limb resting on the floor stays on the floor under it);
 *  with `more.floor` (how far the floor lies that way, in the parent's frame), a line down to a point that stands
 *  `more.room` (or `clear`) or more above the floor is taken too, as there is room for the cloth under the part there.
 *  With `more.inside` (a part's faces near the cloth, see facesNear), the cloth is read between its points as well:
 *  where a point over one of its triangles lies in such a part, the ray from the part's bone out through it meeting one
 *  of its faces beyond it on its way out (a fold of the cloth standing through a pauldron's rim, a dome standing up
 *  through it between the part's points), the corners go out along that ray, each its share of what takes the point
 *  `clear` / 2 past the face (as the line, under the same floor). A point `fixed` stays, so a
 *  crossing it has a share of is taken only partway out (its share left to the others, they were thrown out the
 *  further the more of the crossing it had). The corners move in turn, each cut to as much of its move as `may` (the
 *  corner, and where it would go, in the parent's frame, `P` holding the corners moved before it) allows. A closed
 *  garment's seam (its first and last columns; `seam`, its number of columns) moves as one. With `held` (one for each
 *  triangle of `index`), a triangle held is passed over, and one whose crossing is taken only partway is held: 1 for a
 *  corner fixed, 2 for a move `may` cut, so a crossing is never taken over and over, its free corners thrown out a share
 *  at a time. Whether any point moved. Exported for tests. */
export function liftOff(P: Float64Array, index: ArrayLike<number>, covers: string[], w: DrapeWorld, toLocal: THREE.Matrix4, clear: number, fixed: (k: number) => boolean, down: THREE.Vector3, seam?: number, may?: (k: number, to: THREE.Vector3) => boolean, held?: Uint8Array, more?: { floor?: number; room?: number; inside?: Map<string, PartFaces> }): boolean {
  const pts: number[] = [], lines: number[][] = [], owner: number[] = [], v = new THREE.Vector3();
  for (const n of covers) {
    const b = w.bones?.get(n), ps = w.surface?.get(n) ?? w.parts.get(n), set = w.pieces?.get(n);
    for (const { bone, surface } of set?.length ? set : b && ps ? [{ bone: b, surface: ps }] : []) {
      if (bone.length < 2) continue;
      lines.push(bone.flatMap((p) => v.copy(p).applyMatrix4(toLocal).toArray()));
      for (const p of surface) { v.copy(p).applyMatrix4(toLocal); pts.push(v.x, v.y, v.z); owner.push(lines.length - 1); }
    }
  }
  // (a move down toward the floor only where what it ends past stands far enough above the floor for the cloth)
  const room = more?.room ?? clear, floorOk = (x: number, y: number, z: number, dx: number, dy: number, dz: number) => dx * down.x + dy * down.y + dz * down.z <= 0 || (more?.floor !== undefined && more.floor - (x * down.x + y * down.y + z * down.z) >= room);
  const T = Math.floor(index.length / 3), N = P.length / 3;
  if (!pts.length || !T) return false;
  let edge = 0; for (let t = 0; t < T; t++) { const a = index[t * 3] * 3, b = index[t * 3 + 1] * 3; edge += Math.hypot(P[a] - P[b], P[a + 1] - P[b + 1], P[a + 2] - P[b + 2]); }
  const h = Math.max(0.05, 2 * edge / T), key = (x: number, y: number, z: number) => ((x + 512) * 1024 + y + 512) * 1024 + z + 512, grid = new Map<number, number[]>();
  for (let t = 0; t < T; t++) {
    const i0 = index[t * 3] * 3, i1 = index[t * 3 + 1] * 3, i2 = index[t * 3 + 2] * 3;
    const lo = [0, 1, 2].map((k) => Math.floor(Math.min(P[i0 + k], P[i1 + k], P[i2 + k]) / h)), hi = [0, 1, 2].map((k) => Math.floor(Math.max(P[i0 + k], P[i1 + k], P[i2 + k]) / h));
    for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) { const k = key(x, y, z); let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(t); }
  }
  const want = new Float64Array(N), dirs = new Float64Array(N * 3), stamp = new Int32Array(T).fill(-1), crossed = new Uint8Array(T), hit: number[] = [];
  const A = new THREE.Vector3(), D = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), pv = new THREE.Vector3(), tv = new THREE.Vector3(), qv = new THREE.Vector3();
  let seq = 0;
  for (let i = 0; i < owner.length; i++) {
    const px = pts[i * 3], py = pts[i * 3 + 1], pz = pts[i * 3 + 2], L = lines[owner[i]];
    let best = Infinity;
    for (let k = 0; k + 5 < L.length; k += 3) {
      const qx = L[k], qy = L[k + 1], qz = L[k + 2], bx = L[k + 3] - qx, by = L[k + 4] - qy, bz = L[k + 5] - qz, l2 = bx * bx + by * by + bz * bz;
      const u = l2 > 1e-12 ? Math.max(0, Math.min(1, ((px - qx) * bx + (py - qy) * by + (pz - qz) * bz) / l2)) : 0, cx = qx + bx * u, cy = qy + by * u, cz = qz + bz * u, dd = (px - cx) ** 2 + (py - cy) ** 2 + (pz - cz) ** 2;
      if (dd < best) { best = dd; A.set(cx, cy, cz); }
    }
    D.set(px - A.x, py - A.y, pz - A.z); const len = D.length(); if (len < 1e-6) continue;
    if (!floorOk(px, py, pz, D.x, D.y, D.z)) continue;
    seq++;
    const x0 = Math.floor(Math.min(A.x, px) / h), x1 = Math.floor(Math.max(A.x, px) / h), y0 = Math.floor(Math.min(A.y, py) / h), y1 = Math.floor(Math.max(A.y, py) / h), z0 = Math.floor(Math.min(A.z, pz) / h), z1 = Math.floor(Math.max(A.z, pz) / h);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      const l = grid.get(key(x, y, z)); if (!l) continue;
      for (const t of l) {
        if (stamp[t] === seq || held?.[t]) continue; stamp[t] = seq;
        const c0 = index[t * 3], c1 = index[t * 3 + 1], c2 = index[t * 3 + 2], i0 = c0 * 3, i1 = c1 * 3, i2 = c2 * 3;
        e1.set(P[i1] - P[i0], P[i1 + 1] - P[i0 + 1], P[i1 + 2] - P[i0 + 2]); e2.set(P[i2] - P[i0], P[i2 + 1] - P[i0 + 1], P[i2 + 2] - P[i0 + 2]);
        pv.crossVectors(D, e2); const det = e1.dot(pv); if (Math.abs(det) < 1e-12) continue;
        const inv = 1 / det; tv.set(A.x - P[i0], A.y - P[i0 + 1], A.z - P[i0 + 2]); const uu = tv.dot(pv) * inv; if (uu < 0 || uu > 1) continue;
        qv.crossVectors(tv, e1); const vv = D.dot(qv) * inv; if (vv < 0 || uu + vv > 1) continue;
        const tt = e2.dot(qv) * inv; if (tt <= 0 || tt >= 1) continue;
        // (the least move of the three corners that takes the crossing out: each by its share of it, a corner fixed
        // keeping still)
        const need = (1 - tt) * len + clear * 0.5, bs = [1 - uu - vv, uu, vv], cs = [c0, c1, c2], s2 = bs[0] * bs[0] + bs[1] * bs[1] + bs[2] * bs[2];
        for (let q = 0; q < 3; q++) { const k = cs[q]; if (fixed(k)) continue; const d = need * bs[q] / s2; if (d > want[k]) { want[k] = d; dirs[k * 3] = D.x / len; dirs[k * 3 + 1] = D.y / len; dirs[k * 3 + 2] = D.z / len; } }
        if (!crossed[t]) { crossed[t] = 1; hit.push(t); }
      }
    }
  }
  // (and between its points, where a point over a triangle lies in a part with its faces read: the first face of the part
  // the ray from the bone out through the point meets, as far as the part reaches, faces out along the ray)
  if (more?.inside?.size) {
    const step = FACE_STEP * (w.size ?? 1), q = new THREE.Vector3(), R = new THREE.Vector3(), B = new THREE.Vector3();
    for (const n of covers) {
      const X = more.inside.get(n); if (!X) continue;
      const { F, grid: G, h: H, bone: Lb, reach } = X, fst = new Int32Array(F.length / 9).fill(-1);
      let ray = 0;
      for (let t = 0; t < T; t++) {
        if (held?.[t]) continue;
        const c0 = index[t * 3], c1 = index[t * 3 + 1], c2 = index[t * 3 + 2], i0 = c0 * 3, i1 = c1 * 3, i2 = c2 * 3;
        // (only a triangle with faces of the part about it)
        const lo = [0, 1, 2].map((k) => Math.floor(Math.min(P[i0 + k], P[i1 + k], P[i2 + k]) / H)), hi = [0, 1, 2].map((k) => Math.floor(Math.max(P[i0 + k], P[i1 + k], P[i2 + k]) / H));
        let about = false;
        for (let x = lo[0]; x <= hi[0] && !about; x++) for (let y = lo[1]; y <= hi[1] && !about; y++) for (let z = lo[2]; z <= hi[2] && !about; z++) if (G.has(cellKey(x, y, z))) about = true;
        if (!about) continue;
        const e = Math.max(Math.hypot(P[i1] - P[i0], P[i1 + 1] - P[i0 + 1], P[i1 + 2] - P[i0 + 2]), Math.hypot(P[i2] - P[i1], P[i2 + 1] - P[i1 + 1], P[i2 + 2] - P[i1 + 2]), Math.hypot(P[i0] - P[i2], P[i0 + 1] - P[i2 + 1], P[i0 + 2] - P[i2 + 2]));
        const m = Math.max(2, Math.min(8, Math.ceil(e / step)));
        for (let i = 0; i <= m; i++) for (let j = 0; i + j <= m; j++) {
          const b1 = i / m, b2 = j / m, b0 = 1 - b1 - b2;
          q.set(P[i0] * b0 + P[i1] * b1 + P[i2] * b2, P[i0 + 1] * b0 + P[i1 + 1] * b1 + P[i2 + 1] * b2, P[i0 + 2] * b0 + P[i1 + 2] * b1 + P[i2 + 2] * b2);
          // (the nearest point of the bone, and the way out from it through the point)
          let best = Infinity;
          for (let k = 0; k + 5 < Lb.length; k += 3) {
            const qx = Lb[k], qy = Lb[k + 1], qz = Lb[k + 2], bx = Lb[k + 3] - qx, by = Lb[k + 4] - qy, bz = Lb[k + 5] - qz, l2 = bx * bx + by * by + bz * bz;
            const u = l2 > 1e-12 ? Math.max(0, Math.min(1, ((q.x - qx) * bx + (q.y - qy) * by + (q.z - qz) * bz) / l2)) : 0, cx = qx + bx * u, cy = qy + by * u, cz = qz + bz * u, dd = (q.x - cx) ** 2 + (q.y - cy) ** 2 + (q.z - cz) ** 2;
            if (dd < best) { best = dd; B.set(cx, cy, cz); }
          }
          R.subVectors(q, B); const len = R.length(); if (len < 1e-6 || len >= reach) continue; R.divideScalar(len);
          // (the first face it meets beyond the point, cell by cell along the ray, and whether the ray leaves the part there)
          ray++;
          let tmin = Infinity, out = false, ix = Math.floor(q.x / H), iy = Math.floor(q.y / H), iz = Math.floor(q.z / H), at = 0;
          const sx = R.x > 0 ? 1 : -1, sy = R.y > 0 ? 1 : -1, sz = R.z > 0 ? 1 : -1, dx = R.x !== 0 ? H / Math.abs(R.x) : Infinity, dy = R.y !== 0 ? H / Math.abs(R.y) : Infinity, dz = R.z !== 0 ? H / Math.abs(R.z) : Infinity;
          let tx = R.x !== 0 ? ((ix + (R.x > 0 ? 1 : 0)) * H - q.x) / R.x : Infinity, ty = R.y !== 0 ? ((iy + (R.y > 0 ? 1 : 0)) * H - q.y) / R.y : Infinity, tz = R.z !== 0 ? ((iz + (R.z > 0 ? 1 : 0)) * H - q.z) / R.z : Infinity;
          while (at <= reach && at < tmin) {
            for (const f of G.get(cellKey(ix, iy, iz)) ?? []) {
              if (fst[f] === ray) continue; fst[f] = ray;
              const o = f * 9;
              e1.set(F[o + 3] - F[o], F[o + 4] - F[o + 1], F[o + 5] - F[o + 2]); e2.set(F[o + 6] - F[o], F[o + 7] - F[o + 1], F[o + 8] - F[o + 2]);
              pv.crossVectors(R, e2); const det = e1.dot(pv); if (Math.abs(det) < 1e-12) continue;
              const inv = 1 / det; tv.set(q.x - F[o], q.y - F[o + 1], q.z - F[o + 2]); const uu = tv.dot(pv) * inv; if (uu < 0 || uu > 1) continue;
              qv.crossVectors(tv, e1); const vv = R.dot(qv) * inv; if (vv < 0 || uu + vv > 1) continue;
              const tt = e2.dot(qv) * inv; if (tt <= 1e-9 || tt >= tmin) continue;
              tmin = tt; out = pv.crossVectors(e1, e2).dot(R) > 0;
            }
            if (tx < ty && tx < tz) { at = tx; tx += dx; ix += sx; } else if (ty < tz) { at = ty; ty += dy; iy += sy; } else { at = tz; tz += dz; iz += sz; }
          }
          if (!out || !floorOk(q.x + R.x * tmin, q.y + R.y * tmin, q.z + R.z * tmin, R.x, R.y, R.z)) continue;
          const need = tmin + clear * 0.5, bs = [b0, b1, b2], cs = [c0, c1, c2], s2 = b0 * b0 + b1 * b1 + b2 * b2;
          for (let k = 0; k < 3; k++) { const c = cs[k]; if (fixed(c) || bs[k] <= 0) continue; const d = need * bs[k] / s2; if (d > want[c]) { want[c] = d; dirs[c * 3] = R.x; dirs[c * 3 + 1] = R.y; dirs[c * 3 + 2] = R.z; } }
          if (!crossed[t]) { crossed[t] = 1; hit.push(t); }
        }
      }
    }
  }
  if (seam) for (let a = 0; a + seam - 1 < N; a += seam) { const b = a + seam - 1, f = want[a] >= want[b] ? a : b, t = f === a ? b : a; want[t] = want[f]; for (let x = 0; x < 3; x++) dirs[t * 3 + x] = dirs[f * 3 + x]; }
  // (each corner in turn, as far as `may` lets it go, and a seam's two corners together, as far as it lets both)
  const twin = (k: number) => (!seam ? -1 : k % seam === 0 ? k + seam - 1 : k % seam === seam - 1 ? k - seam + 1 : -1);
  const to = new THREE.Vector3(), to2 = new THREE.Vector3(), cut = new Uint8Array(N);
  let any = false;
  for (let k = 0; k < N; k++) {
    if (!(want[k] > 0)) continue;
    const k2 = twin(k); if (k2 >= 0 && k2 < k) continue;
    const at = (m: number, i: number, out: THREE.Vector3) => out.set(P[i * 3] + dirs[k * 3] * want[k] * m, P[i * 3 + 1] + dirs[k * 3 + 1] * want[k] * m, P[i * 3 + 2] + dirs[k * 3 + 2] * want[k] * m);
    const ok = (m: number) => !may || (may(k, at(m, k, to)) && (k2 < 0 || k2 >= N || may(k2, at(m, k2, to2))));
    let lo = 1;
    if (!ok(1)) { lo = 0; let hi = 1; for (let it = 0; it < 16; it++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; } cut[k] = 1; if (k2 >= 0 && k2 < N) cut[k2] = 1; }
    if (lo <= 0) continue;
    any = true;
    for (const i of k2 >= 0 && k2 < N ? [k, k2] : [k]) { at(lo, i, to); P[i * 3] = to.x; P[i * 3 + 1] = to.y; P[i * 3 + 2] = to.z; }
  }
  if (held) for (const t of hit) { const cs = [index[t * 3], index[t * 3 + 1], index[t * 3 + 2]]; if (cs.some(fixed)) held[t] = 1; else if (cs.some((k) => cut[k])) held[t] = 2; }
  return any;
}

/** Lifts hung cloth (`P`, flat x, y, z in its parent's frame; triangles `index`) out of the parts it covers: where the
 *  line from a part's bone out to one of its sample points crosses a triangle, the cloth there lies inside the part, and
 *  the triangle's corners move out along that line to `clear` / 2 past the point. A few passes, as a lifted triangle
 *  can draw its neighbours in. Cloth only ever moves out from its axis, or (on a body laid out, `up` the way off the
 *  floor in the parent's frame) up off the floor: over a hand or an arm lying on the floor, never down under it; or,
 *  above `rise` (a height in the parent's frame, over where the cloth hangs from on a body standing), whichever way is
 *  out of the part. Cloth caught between gear put away and the body standing goes straight out from its axis, over the
 *  piece. A part in pieces (`w.pieces`) is lifted out of each piece from that piece's own bone. A closed garment's seam
 *  (`seam`, its number of columns: the first and last are one) stays closed. Exported for tests. */
export function liftOut(P: Float64Array, index: ArrayLike<number>, covers: string[], w: DrapeWorld, toLocal: THREE.Matrix4, clear: number, ax: number, az: number, up?: THREE.Vector3, rise?: number, seam?: number): void {
  const pts: number[] = [], lines: number[][] = [], owner: number[] = [], gear: boolean[] = [], v = new THREE.Vector3();
  for (const n of covers) {
    const b = w.bones?.get(n), ps = w.surface?.get(n) ?? w.parts.get(n);
    const set = w.pieces?.get(n);
    for (const { bone, surface } of set?.length ? set : b && ps ? [{ bone: b, surface: ps }] : []) {
      if (bone.length < 2) continue;
      lines.push(bone.flatMap((p) => v.copy(p).applyMatrix4(toLocal).toArray())); gear.push(n === 'stowed');
      for (const p of surface) { v.copy(p).applyMatrix4(toLocal); pts.push(v.x, v.y, v.z); owner.push(lines.length - 1); }
    }
  }
  if (!pts.length) return;
  const T = Math.floor(index.length / 3), N = P.length / 3;
  let edge = 0; for (let t = 0; t < T; t++) { const a = index[t * 3] * 3, b = index[t * 3 + 1] * 3; edge += Math.hypot(P[a] - P[b], P[a + 1] - P[b + 1], P[a + 2] - P[b + 2]); }
  const h = Math.max(0.05, 2 * edge / Math.max(1, T)), key = (x: number, y: number, z: number) => ((x + 512) * 1024 + y + 512) * 1024 + z + 512;
  const want = new Float64Array(N), dirs = new Float64Array(N * 3), stamp = new Int32Array(T).fill(-1);
  const A = new THREE.Vector3(), D = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), pv = new THREE.Vector3(), tv = new THREE.Vector3(), qv = new THREE.Vector3();
  let seq = 0;
  for (let pass = 0; pass < 8; pass++) {
    const grid = new Map<number, number[]>();
    for (let t = 0; t < T; t++) {
      const i0 = index[t * 3] * 3, i1 = index[t * 3 + 1] * 3, i2 = index[t * 3 + 2] * 3, lo = [0, 1, 2].map((k) => Math.floor(Math.min(P[i0 + k], P[i1 + k], P[i2 + k]) / h)), hi = [0, 1, 2].map((k) => Math.floor(Math.max(P[i0 + k], P[i1 + k], P[i2 + k]) / h));
      for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) { const k = key(x, y, z); let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(t); }
    }
    want.fill(0); let any = false;
    for (let i = 0; i < owner.length; i++) {
      const px = pts[i * 3], py = pts[i * 3 + 1], pz = pts[i * 3 + 2], L = lines[owner[i]];
      // the nearest point on the bone
      let best = Infinity;
      for (let k = 0; k + 5 < L.length; k += 3) {
        const qx = L[k], qy = L[k + 1], qz = L[k + 2], bx = L[k + 3] - qx, by = L[k + 4] - qy, bz = L[k + 5] - qz, l2 = bx * bx + by * by + bz * bz;
        const u = l2 > 1e-12 ? Math.max(0, Math.min(1, ((px - qx) * bx + (py - qy) * by + (pz - qz) * bz) / l2)) : 0, cx = qx + bx * u, cy = qy + by * u, cz = qz + bz * u, dd = (px - cx) ** 2 + (py - cy) ** 2 + (pz - cz) ** 2;
        if (dd < best) { best = dd; A.set(cx, cy, cz); }
      }
      D.set(px - A.x, py - A.y, pz - A.z); const len = D.length(); if (len < 1e-6) continue;
      seq++;
      const x0 = Math.floor(Math.min(A.x, px) / h), x1 = Math.floor(Math.max(A.x, px) / h), y0 = Math.floor(Math.min(A.y, py) / h), y1 = Math.floor(Math.max(A.y, py) / h), z0 = Math.floor(Math.min(A.z, pz) / h), z1 = Math.floor(Math.max(A.z, pz) / h);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
        const l = grid.get(key(x, y, z)); if (!l) continue;
        for (const t of l) {
          if (stamp[t] === seq) continue; stamp[t] = seq;
          const i0 = index[t * 3] * 3, i1 = index[t * 3 + 1] * 3, i2 = index[t * 3 + 2] * 3;
          e1.set(P[i1] - P[i0], P[i1 + 1] - P[i0 + 1], P[i1 + 2] - P[i0 + 2]); e2.set(P[i2] - P[i0], P[i2 + 1] - P[i0 + 1], P[i2 + 2] - P[i0 + 2]);
          pv.crossVectors(D, e2); const det = e1.dot(pv); if (Math.abs(det) < 1e-12) continue;
          const inv = 1 / det; tv.set(A.x - P[i0], A.y - P[i0 + 1], A.z - P[i0 + 2]); const uu = tv.dot(pv) * inv; if (uu < 0 || uu > 1) continue;
          qv.crossVectors(tv, e1); const vv = D.dot(qv) * inv; if (vv < 0 || uu + vv > 1) continue;
          const tt = e2.dot(qv) * inv; if (tt <= 0 || tt >= 1) continue;
          // only ever out from its axis: cloth caught between a limb and the body goes out over the limb, not in under it
          // (cloth wholly above `rise` may come out on the inner side as well, once: in again on a later pass, along the
          // next line, it would be drawn on into the limb)
          let rx = (P[i0] + P[i1] + P[i2]) / 3 - ax, rz = (P[i0 + 2] + P[i1 + 2] + P[i2 + 2]) / 3 - az; const rl = Math.hypot(rx, rz); if (rl < 1e-9) continue; rx /= rl; rz /= rl;
          let dr = (D.x * rx + D.z * rz) / len;
          if (up) dr = Math.max(dr, D.dot(up) / len);
          if (dr <= 0) {
            // (over gear put away on a body standing, a dagger or a sword at the hip, cloth caught between the piece and
            // the body goes out over all of it: straight out from its axis, to past the piece's own line there, for the
            // lines out to the piece's outer side to take it on past that)
            if (gear[owner[i]] && !up) {
              const r = Math.max(Math.hypot(px - ax, pz - az), Math.hypot(A.x - ax, A.z - az)) + clear * 0.5;
              for (const c of [i0, i1, i2]) {
                const k = c / 3, cx = P[c] - ax, cz = P[c + 2] - az, cl = Math.hypot(cx, cz), need = r - cl;
                if (cl > 1e-9 && need > want[k]) { want[k] = need; dirs[c] = cx / cl; dirs[c + 1] = 0; dirs[c + 2] = cz / cl; }
              }
              continue;
            }
            if (!(pass === 0 && rise !== undefined && P[i0 + 1] > rise && P[i1 + 1] > rise && P[i2 + 1] > rise)) continue;
          }
          const need = (1 - tt) * len + clear * 0.5;
          for (const c of [i0, i1, i2]) { const k = c / 3; if (need > want[k]) { want[k] = need; dirs[c] = D.x / len; dirs[c + 1] = D.y / len; dirs[c + 2] = D.z / len; } }
        }
      }
    }
    // (a closed garment's seam, its first and last columns, stays one: both go as far as either does, the same way)
    if (seam) for (let a = 0; a + seam - 1 < N; a += seam) { const b = a + seam - 1, f = want[a] >= want[b] ? a : b, t = f === a ? b : a; want[t] = want[f]; for (let x = 0; x < 3; x++) dirs[t * 3 + x] = dirs[f * 3 + x]; }
    for (let k = 0; k < N; k++) if (want[k] > 0) { any = true; P[k * 3] += dirs[k * 3] * want[k]; P[k * 3 + 1] += dirs[k * 3 + 1] * want[k]; P[k * 3 + 2] += dirs[k * 3 + 2] * want[k]; }
    if (!any) break;
  }
}

/** The lines from each part's bone out to the points of its surface (world, six to a line), as kit/clothcheck.ts reads
 *  the body (of the trunk its own skin), which of them are the trunk's, and the ball round each run of `RUN` of them
 *  (centre and radius: a run of points of a surface lies close together): read once for each body a plate in lames
 *  comes to rest on, and kept (for the last body read only, in buffers kept for the next) by when it was read. */
const linesIn = new WeakMap<DrapeWorld, number>(), RUN = 32;
let linesAt = new Float64Array(0), linesTrunk = new Uint8Array(0), linesBalls = new Float64Array(0), linesN = 0, linesRead = 0;
// (the lines near the plate being laid, in its frame, and those near the lame of it being laid, with how deep each
// crosses that lame as cut)
let lineBuf = new Float64Array(0), trunkBuf = new Uint8Array(0), nearBuf = new Float64Array(0), nearTrunk = new Uint8Array(0), nearBase = new Float64Array(0);
function linesOf(w: DrapeWorld) {
  if (linesIn.get(w) === linesRead) return { at: linesAt.subarray(0, linesN * 6), trunk: linesTrunk.subarray(0, linesN), balls: linesBalls };
  const each = [...(w.bones ?? [])].flatMap(([n, line]) => { const set = w.pieces?.get(n), tr = w.trunk?.includes(n) ? 1 : 0; return (set?.length ? set : [{ bone: line, surface: w.skin?.get(n) ?? w.surface?.get(n) ?? w.parts.get(n) ?? [] }]).filter((e) => e.bone.length > 1).map((e) => ({ ...e, tr })); });
  const N = each.reduce((a, e) => a + e.surface.length, 0);
  if (linesAt.length < N * 6) { linesAt = new Float64Array(N * 6); linesTrunk = new Uint8Array(N); }
  const at = linesAt, trunk = linesTrunk;
  let j = 0;
  for (const { bone, surface, tr } of each) {
    const B = bone.flatMap((b) => [b.x, b.y, b.z]);
    for (const p of surface) {
      let best = Infinity, fx = 0, fy = 0, fz = 0;
      for (let k = 0; k + 3 < B.length; k += 3) {
        const dx = B[k + 3] - B[k], dy = B[k + 4] - B[k + 1], dz = B[k + 5] - B[k + 2], l2 = dx * dx + dy * dy + dz * dz;
        const u = l2 > 1e-12 ? Math.max(0, Math.min(1, ((p.x - B[k]) * dx + (p.y - B[k + 1]) * dy + (p.z - B[k + 2]) * dz) / l2)) : 0;
        const ox = B[k] + dx * u, oy = B[k + 1] + dy * u, oz = B[k + 2] + dz * u, ex = p.x - ox, ey = p.y - oy, ez = p.z - oz, dd = ex * ex + ey * ey + ez * ez;
        if (dd < best) { best = dd; fx = ox; fy = oy; fz = oz; }
      }
      at[j * 6] = fx; at[j * 6 + 1] = fy; at[j * 6 + 2] = fz; at[j * 6 + 3] = p.x; at[j * 6 + 4] = p.y; at[j * 6 + 5] = p.z; trunk[j++] = tr;
    }
  }
  linesN = N; linesBalls = ballsRound(at.subarray(0, N * 6)); linesIn.set(w, ++linesRead);
  return linesOf(w);
}
/** The ball round each run of `RUN` lines (six to a line), as centre and radius: four to a run. */
function ballsRound(L: Float64Array) {
  const n = L.length / 6, out = new Float64Array(Math.ceil(n / RUN) * 4);
  for (let q = 0; q * RUN < n; q++) {
    const j1 = Math.min(n, (q + 1) * RUN); let x = 0, y = 0, z = 0, r = 0;
    for (let k = q * RUN * 6; k < j1 * 6; k += 3) { x += L[k]; y += L[k + 1]; z += L[k + 2]; }
    const m = (j1 - q * RUN) * 2; x /= m; y /= m; z /= m;
    for (let k = q * RUN * 6; k < j1 * 6; k += 3) { const ex = L[k] - x, ey = L[k + 1] - y, ez = L[k + 2] - z; r = Math.max(r, ex * ex + ey * ey + ez * ez); }
    out[q * 4] = x; out[q * 4 + 1] = y; out[q * 4 + 2] = z; out[q * 4 + 3] = Math.sqrt(r);
  }
  return out;
}

/** Where a lame of a plate in lames (`P`, `C` columns to a row) starting at row `r` turns from the one above it: about the
 *  line through the rivets at its two ends, where the two lap over one another (its ends stay in the lap whichever way it
 *  turns, where turned about its top edge they would cut up through the one above; its curved middle swings about it). */
function lameHinge(P: Float64Array, C: number, r: number) {
  const end = (c: number) => new THREE.Vector3(P[(r * C + c) * 3] + P[((r - 1) * C + c) * 3], P[(r * C + c) * 3 + 1] + P[((r - 1) * C + c) * 3 + 1], P[(r * C + c) * 3 + 2] + P[((r - 1) * C + c) * 3 + 2]).multiplyScalar(0.5);
  const a = end(0), b = end(C - 1);
  return { o: a.clone().add(b).multiplyScalar(0.5), h: b.sub(a).normalize() };
}

/** On a body laid out a plate in lames (`P`, as cut, in its parent's frame: `C` columns to a row, the lames starting at
 *  the rows `starts`) does not lie as it would swing out in one piece (turned `turned` about the line it hangs from,
 *  through `pivot` along `hinge`): from there, a lame at a time from the top, it falls on toward hanging plumb
 *  (`down`), each lame turning about its own top edge (the first about that line; each next about the line through the
 *  rivets at its two ends, where it laps under the rim of the one above, carried along by those above, and only the way
 *  that drops it away from that rim) as far as what lies under it lets it, and resting there: on the body, on a limb or
 *  on the floor (`lvl` along the way down), never deeper in the floor than it lay before, and what of it is in the
 *  floor laid on it. A lame that a limb has come up into is first turned out of its way, the nearest turn that clears
 *  it and hardly lies in the floor, or (the first, on its straps) swung aside a little about `n0` where no turn about
 *  its edge does; failing that, it takes the turn that leaves the least of the limb in it. A lower lame run into the
 *  floor folds up off it so, where that lifts it well out of it. What lies under it is read as kit/clothcheck.ts reads
 *  the body: `lines` (six to a line) run from a point on a part's bone out through a point of the part's surface to
 *  `room` past it, and a lame never crosses one (one of the trunk it hangs from, marked in `trunk`, never deeper than
 *  it does as cut). `P` is moved. */
function settlePlate(P: Float64Array, C: number, starts: number[], pivot: THREE.Vector3, hinge: THREE.Vector3, n0: THREE.Vector3, turned: number, down: THREE.Vector3, lvl: number, lines: Float64Array, trunk: Uint8Array, room: number): void {
  const R = P.length / 3 / C, cut = Float64Array.from(P), at = (k: number) => new THREE.Vector3(cut[k * 3], cut[k * 3 + 1], cut[k * 3 + 2]);
  const above = new THREE.Matrix4(), M = new THREE.Matrix4(), inv = new THREE.Matrix4(), T = new THREE.Matrix4(), v = new THREE.Vector3(), c0 = new THREE.Vector3();
  // where the line from L[0..2] along L[3..5] (its whole length) crosses the triangle of these vertices, as a fraction of
  // it, or -1; and whether it passes through a box (the six bounds in `b` from `off`)
  const L = new Float64Array(6);
  const hitAt = (i0: number, i1: number, i2: number) => {
    const ox = cut[i0 * 3], oy = cut[i0 * 3 + 1], oz = cut[i0 * 3 + 2], ax = cut[i1 * 3] - ox, ay = cut[i1 * 3 + 1] - oy, az = cut[i1 * 3 + 2] - oz, bx = cut[i2 * 3] - ox, by = cut[i2 * 3 + 1] - oy, bz = cut[i2 * 3 + 2] - oz;
    const px = L[4] * bz - L[5] * by, py = L[5] * bx - L[3] * bz, pz = L[3] * by - L[4] * bx, det = ax * px + ay * py + az * pz; if (Math.abs(det) < 1e-12) return -1;
    const iv = 1 / det, tx = L[0] - ox, ty = L[1] - oy, tz = L[2] - oz, u = (tx * px + ty * py + tz * pz) * iv; if (u < 0 || u > 1) return -1;
    const qx = ty * az - tz * ay, qy = tz * ax - tx * az, qz = tx * ay - ty * ax, q = (L[3] * qx + L[4] * qy + L[5] * qz) * iv; if (q < 0 || u + q > 1) return -1;
    const t = (bx * qx + by * qy + bz * qz) * iv; return t > 0 && t < 1 ? t : -1;
  };
  const through = (b: number[], off: number) => {
    let t0 = 0, t1 = 1;
    for (let x = 0; x < 3 && t0 <= t1; x++) {
      const a0 = L[x], d0 = L[x + 3];
      if (Math.abs(d0) < 1e-12) { if (a0 < b[off + x] || a0 > b[off + x + 3]) return false; continue; }
      const u0 = (b[off + x] - a0) / d0, u1 = (b[off + x + 3] - a0) / d0; t0 = Math.max(t0, Math.min(u0, u1)); t1 = Math.min(t1, Math.max(u0, u1));
    }
    return t0 <= t1;
  };
  if (nearBuf.length < lines.length) { nearBuf = new Float64Array(lines.length); nearTrunk = new Uint8Array(trunk.length); nearBase = new Float64Array(trunk.length); }
  const ow = new THREE.Vector3(), faces: boolean[] = [];
  for (let i = 0; i < starts.length; i++) {
    // (it turns with the lames below it hanging from it as they are: they turn on from it after)
    const r0 = starts[i], r1 = (i + 1 < starts.length ? starts[i + 1] : R) - 1, end = R - 1; if (r1 <= r0) continue;
    const { o, h } = i ? lameHinge(cut, C, r0) : { o: pivot, h: hinge };
    // the lame and those below it: their middle, the ball round them, the box round them, round each band of them (two
    // rows) and round each run of `W` cells along a band
    const mid = new THREE.Vector3(), box: number[] = [], sub: number[] = [], W = 4; let ball = 0;
    for (let k = r0 * C; k <= end * C + C - 1; k++) mid.add(at(k));
    mid.divideScalar((end - r0 + 1) * C);
    for (let k = r0 * C; k <= end * C + C - 1; k++) ball = Math.max(ball, at(k).distanceTo(mid));
    const bounds = (r: number, c0: number, c1: number) => { const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; for (let rr = r; rr <= r + 1; rr++) for (let c = c0; c <= c1; c++) for (let x = 0, k = rr * C + c; x < 3; x++) { b[x] = Math.min(b[x], cut[k * 3 + x]); b[x + 3] = Math.max(b[x + 3], cut[k * 3 + x]); } return b; };
    for (let r = r0; r < end; r++) { box.push(...bounds(r, 0, C - 1)); for (let c = 0; c + 1 < C; c += W) sub.push(...bounds(r, c, Math.min(c + W, C - 1))); }
    const all = [0, 1, 2].map((x) => Math.min(...box.filter((_, k) => k % 6 === x))).concat([3, 4, 5].map((x) => Math.max(...box.filter((_, k) => k % 6 === x))));
    // (of the lines, only those that come as near the point it turns about as the furthest of it: no turn about that
    // point brings it to the rest; and the ball round each run of them)
    let rho = 0, n = 0; for (let k = r0 * C; k <= end * C + C - 1; k++) rho = Math.max(rho, at(k).distanceTo(o));
    ow.copy(o).applyMatrix4(above);
    for (let j = 0; j < trunk.length; j++) {
      const k = j * 6, ax = lines[k], ay = lines[k + 1], az = lines[k + 2], dx = lines[k + 3] - ax, dy = lines[k + 4] - ay, dz = lines[k + 5] - az, l2 = dx * dx + dy * dy + dz * dz;
      const u = l2 > 1e-12 ? Math.max(0, Math.min(1, ((ow.x - ax) * dx + (ow.y - ay) * dy + (ow.z - az) * dz) / l2)) : 0, cx = ax + dx * u - ow.x, cy = ay + dy * u - ow.y, cz = az + dz * u - ow.z;
      if (cx * cx + cy * cy + cz * cz > rho * rho + 1e-9) continue;
      for (let x = 0; x < 6; x++) nearBuf[n * 6 + x] = lines[k + x];
      nearTrunk[n++] = trunk[j];
    }
    const near = nearBuf.subarray(0, n * 6), balls = ballsRound(near);
    const place = (al: number, be: number) => { M.makeTranslation(-o.x, -o.y, -o.z); if (be) M.premultiply(T.makeRotationAxis(n0, be)); return M.premultiply(T.makeRotationAxis(h, al)).premultiply(T.makeTranslation(o.x, o.y, o.z)).premultiply(above); };
    // how deep the deepest line crosses it, placed so (each from the trunk only past how deep it does as cut): those of a
    // run whose ball is near it, against the ball round it, then the box round it, round each band and each run of cells
    const base = nearBase.fill(0, 0, n);
    const cross = (m: THREE.Matrix4 | undefined, out?: Float64Array, bound = Infinity) => {
      c0.copy(mid); if (m) { c0.applyMatrix4(m); inv.copy(m).invert(); }
      const e = inv.elements;
      let worst = 0;
      for (let q = 0; q * RUN < n; q++) {
        const bx = balls[q * 4] - c0.x, by = balls[q * 4 + 1] - c0.y, bz = balls[q * 4 + 2] - c0.z, br = balls[q * 4 + 3] + ball; if (bx * bx + by * by + bz * bz > br * br) continue;
        for (let j = q * RUN, j1 = Math.min(n, j + RUN); j < j1; j++) {
          if (out && !nearTrunk[j]) continue;
          const k = j * 6, ax = near[k], ay = near[k + 1], az = near[k + 2], dx = near[k + 3] - ax, dy = near[k + 4] - ay, dz = near[k + 5] - az, l2 = dx * dx + dy * dy + dz * dz;
          if (l2 < 1e-12) continue;
          const u = Math.max(0, Math.min(1, ((c0.x - ax) * dx + (c0.y - ay) * dy + (c0.z - az) * dz) / l2)), cx = ax + dx * u - c0.x, cy = ay + dy * u - c0.y, cz = az + dz * u - c0.z;
          if (cx * cx + cy * cy + cz * cz > ball * ball) continue;
          if (m) { L[0] = e[0] * ax + e[4] * ay + e[8] * az + e[12]; L[1] = e[1] * ax + e[5] * ay + e[9] * az + e[13]; L[2] = e[2] * ax + e[6] * ay + e[10] * az + e[14]; L[3] = e[0] * dx + e[4] * dy + e[8] * dz; L[4] = e[1] * dx + e[5] * dy + e[9] * dz; L[5] = e[2] * dx + e[6] * dy + e[10] * dz; }
          else { L[0] = ax; L[1] = ay; L[2] = az; L[3] = dx; L[4] = dy; L[5] = dz; }
          if (!through(all, 0)) continue;
          const len = Math.sqrt(l2);
          let deep = 0;
          for (let b = 0, s = 0; b < box.length; b += 6) {
            if (!through(box, b)) { s += Math.ceil((C - 1) / W) * 6; continue; }
            const r = r0 + b / 6;
            for (let w0 = 0; w0 + 1 < C; w0 += W, s += 6) if (through(sub, s)) for (let c = w0; c < Math.min(w0 + W, C - 1); c++) {
              const k = r * C + c, t = Math.max(hitAt(k, k + 1, k + C), hitAt(k + 1, k + C + 1, k + C));
              if (t > 0) deep = Math.max(deep, (1 - t) * len);
            }
          }
          if (out) out[j] = nearTrunk[j] ? Math.max(0, deep - room / 2) : 0; else if ((worst = Math.max(worst, deep - base[j])) > bound) return worst;
        }
      }
      return worst;
    };
    cross(undefined, base);
    // how far into the floor it lies, placed so (the lames below fold up on the floor from it); and how low its middle
    // hangs
    const sunk = (m: THREE.Matrix4) => { let fl = 0; for (let k = r0 * C; k <= r1 * C + C - 1; k++) fl = Math.max(fl, v.set(cut[k * 3], cut[k * 3 + 1], cut[k * 3 + 2]).applyMatrix4(m).dot(down) - lvl); return fl; };
    const low = (al: number, be: number) => v.copy(mid).applyMatrix4(place(al, be)).dot(down);
    // (the first turns no further from its cut than any strip of cloth, the rest no further from the one above than
    // their leathers let them, and only the way that drops the middle of the top edge away from it: turned the other way
    // it would come up through the one above; a lame within half the room it keeps over what is under it rests on it)
    const top = at(r0 * C + (C >> 1)), way = i ? Math.sign(v.crossVectors(h, top.clone().sub(o)).dot(at(r1 * C + (C >> 1)).sub(top))) : 0;
    const lo = i ? (way < 0 ? -MAX_LAME_TURN : 0) : -MAX_TURN, hi = i ? (way < 0 ? 0 : MAX_LAME_TURN) : MAX_TURN, a0 = i ? 0 : turned, step = 0.12, eps = room / 2;
    let al = a0, be = 0, m = place(al, 0), now = cross(m), fl = sunk(m);
    const inLimb = now > room * 2;
    if (inLimb || (i && fl > room * 2)) {
      // a limb come up into it further than the room it keeps over one: turned out of its way, the nearest turn resting
      // clear of it that lies in the floor no deeper than that room; else, of those clear of it, the nearest that lies
      // hardly deeper in the floor than the least; else the one least in it (swung aside only where no turn clears it).
      // A lower lame run into the floor folds up so, no further into what is under it, where that lifts it out
      const ok = inLimb ? eps : Math.max(now, eps), turns: number[] = [], tried: number[] = [];
      let pick = -1, least = Infinity;
      for (const b of i ? [0] : PLATE_SWINGS) for (let k = b ? 0 : 1; k * step <= Math.max(hi - a0, a0 - lo); k++) for (const sg of k ? [1, -1] : [1]) { const a = a0 + sg * k * step; if (a >= lo && a <= hi) turns.push(a, b); }
      for (let j = 0; j < turns.length; j += 2) {
        if (j && turns[j + 1] !== turns[j - 1] && tried.length) break;
        // (run into the floor, only a fold that lifts it is weighed)
        m = place(turns[j], turns[j + 1]); const f = sunk(m); if (!inLimb && f >= fl) continue;
        const c = cross(m, undefined, ok); if (c > ok) continue;
        tried.push(turns[j], turns[j + 1], c, f); if (f <= room * 2) break;
      }
      for (let j = 0; j < tried.length; j += 4) least = Math.min(least, tried[j + 3]);
      if (least < Infinity) { if (inLimb || least < fl - room) for (let j = 0; j < tried.length && pick < 0; j += 4) if (tried[j + 3] <= Math.max(least, eps) + room) pick = j; }
      // (none clear of it: each read only so far as it is less in it than the least yet)
      else if (inLimb) for (let j = 0, best = now - eps; j < turns.length; j += 2) { m = place(turns[j], turns[j + 1]); const c = cross(m, undefined, best); if (c < best) { best = c; pick = tried.push(turns[j], turns[j + 1], c, sunk(m)) - 4; } }
      if (pick >= 0) { al = tried[pick]; be = tried[pick + 1]; now = tried[pick + 2]; fl = tried[pick + 3]; }
    }
    // then it falls from there toward hanging plumb (the nearer way round), a step at a time, till the next would bring
    // it onto what lies under it (deeper into what it could not be cleared of, or into the floor), and then nearer by
    // halves
    const cb = Math.max(now, eps), fb = Math.max(fl, eps), fits = (a: number) => { const mm = place(a, be); return sunk(mm) <= fb && cross(mm, undefined, cb) <= cb; };
    const g0 = low(0, be), g1 = low(Math.PI / 2, be), g2 = low(Math.PI, be);
    let want = Math.atan2(g1 - (g0 + g2) / 2, (g0 - g2) / 2); want -= Math.round((want - al) / (2 * Math.PI)) * 2 * Math.PI; want = Math.max(lo, Math.min(hi, want));
    for (let dir = Math.sign(want - al); (want - al) * dir > 1e-3;) {
      const nx = al + dir * Math.min(step, (want - al) * dir);
      if (fits(nx)) { al = nx; continue; }
      let ok = al, bad = nx;
      for (let r = 0; r < 3; r++) { const md = (ok + bad) / 2; if (fits(md)) ok = md; else bad = md; }
      al = ok; break;
    }
    above.copy(place(al, be)); faces.push(v.copy(n0).transformDirection(above).dot(down) > 0);
    for (let k = r0 * C; k <= r1 * C + C - 1; k++) { v.set(cut[k * 3], cut[k * 3 + 1], cut[k * 3 + 2]).applyMatrix4(above); P[k * 3] = v.x; P[k * 3 + 1] = v.y; P[k * 3 + 2] = v.z; }
  }
  // what of it lies in the floor lies on it, each lame on the one it laps over or under there, a little above or below it
  // as its face is turned to the floor (pressed into one plane with it the two would show through one another)
  if (lvl === Infinity) return;
  const lev = [0]; for (let i = 1; i < starts.length; i++) lev.push(lev[i - 1] + (faces[i - 1] ? -room : room) / 4);
  const most = Math.max(...lev);
  for (let i = 0; i < starts.length; i++) for (let k = starts[i] * C, L0 = lvl + lev[i] - most; k < (i + 1 < starts.length ? starts[i + 1] : R) * C; k++) {
    const d = P[k * 3] * down.x + P[k * 3 + 1] * down.y + P[k * 3 + 2] * down.z - L0; if (d > 0) { P[k * 3] -= d * down.x; P[k * 3 + 1] -= d * down.y; P[k * 3 + 2] -= d * down.z; }
  }
}

/** Lays hung cloth (`P`, flat x, y, z in its parent's frame; triangles `index`) under the parts that lie outside it:
 *  where the line from such a part's bone out to one of its points crosses a triangle deeper in from the point than
 *  cloth may only graze it, the cloth there lies in the part, and the triangle's corners move straight in toward the
 *  axis (`ax`, `az`) to `clear` / 2 inside the nearer end of that line along their way in (inside the point, under the
 *  limb; or, where the line runs out from the bone, inside the bone, for the next pass to lay it under the limb from
 *  there). Cloth only grazes a part within `clear` of its surface, or within the depth kit/clothcheck.ts lets skin lie
 *  past cloth (GRAZE of `w.size`) where that is less; it is left where it hangs. A few passes, as cloth laid under one
 *  part can come into another (a hand folded over the other). Cloth only ever moves in toward its axis: under a limb
 *  lying on it, never out over it. A closed garment's seam (`seam`, its number of columns: the first and last are one)
 *  stays closed. Exported for tests. */
export function layUnder(P: Float64Array, index: ArrayLike<number>, outside: string[], w: DrapeWorld, toLocal: THREE.Matrix4, clear: number, ax: number, az: number, seam?: number): void {
  // where the cloth is and may move to (in as far as its axis), and each of the parts' points whose line in to the
  // nearest point on its bone (as kit/clothcheck.ts reads it) runs there
  const min = [ax, Infinity, az], max = [ax, -Infinity, az];
  for (let k = 0; k < P.length; k++) { min[k % 3] = Math.min(min[k % 3], P[k]); max[k % 3] = Math.max(max[k % 3], P[k]); }
  const ends: number[] = [], v = new THREE.Vector3();
  for (const n of outside) {
    const b = w.bones?.get(n), ps = w.surface?.get(n) ?? w.parts.get(n); if (!b || b.length < 2 || !ps?.length) continue;
    const L = b.flatMap((p) => v.copy(p).applyMatrix4(toLocal).toArray());
    for (const p of ps) {
      v.copy(p).applyMatrix4(toLocal);
      let best = Infinity, cx = 0, cy = 0, cz = 0;
      for (let k = 0; k + 5 < L.length; k += 3) {
        const qx = L[k], qy = L[k + 1], qz = L[k + 2], bx = L[k + 3] - qx, by = L[k + 4] - qy, bz = L[k + 5] - qz, l2 = bx * bx + by * by + bz * bz;
        const u = l2 > 1e-12 ? Math.max(0, Math.min(1, ((v.x - qx) * bx + (v.y - qy) * by + (v.z - qz) * bz) / l2)) : 0, x = qx + bx * u, y = qy + by * u, z = qz + bz * u, dd = (v.x - x) ** 2 + (v.y - y) ** 2 + (v.z - z) ** 2;
        if (dd < best) { best = dd; cx = x; cy = y; cz = z; }
      }
      if (best > 1e-12 && Math.max(cx, v.x) >= min[0] && Math.min(cx, v.x) <= max[0] && Math.max(cy, v.y) >= min[1] && Math.min(cy, v.y) <= max[1] && Math.max(cz, v.z) >= min[2] && Math.min(cz, v.z) <= max[2]) ends.push(cx, cy, cz, v.x, v.y, v.z);
    }
  }
  if (!ends.length) return;
  const T = Math.floor(index.length / 3), N = P.length / 3;
  let edge = 0; for (let t = 0; t < T; t++) { const a = index[t * 3] * 3, b = index[t * 3 + 1] * 3; edge += Math.hypot(P[a] - P[b], P[a + 1] - P[b + 1], P[a + 2] - P[b + 2]); }
  const h = Math.max(0.05, 2 * edge / Math.max(1, T)), key = (x: number, y: number, z: number) => ((x + 512) * 1024 + y + 512) * 1024 + z + 512;
  const want = new Float64Array(N), stamp = new Int32Array(T).fill(-1), graze = Math.min(clear, w.size === undefined ? clear : GRAZE * w.size);
  const D = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), pv = new THREE.Vector3(), tv = new THREE.Vector3(), qv = new THREE.Vector3();
  let seq = 0;
  for (let pass = 0; pass < 8; pass++) {
    const grid = new Map<number, number[]>();
    for (let t = 0; t < T; t++) {
      const i0 = index[t * 3] * 3, i1 = index[t * 3 + 1] * 3, i2 = index[t * 3 + 2] * 3, lo = [0, 1, 2].map((k) => Math.floor(Math.min(P[i0 + k], P[i1 + k], P[i2 + k]) / h)), hi = [0, 1, 2].map((k) => Math.floor(Math.max(P[i0 + k], P[i1 + k], P[i2 + k]) / h));
      for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) { const k = key(x, y, z); let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(t); }
    }
    want.fill(Infinity); let any = false;
    for (let i = 0; i < ends.length; i += 6) {
      const Ax = ends[i], Ay = ends[i + 1], Az = ends[i + 2], px = ends[i + 3], py = ends[i + 4], pz = ends[i + 5];
      D.set(px - Ax, py - Ay, pz - Az); const len = D.length();
      seq++;
      const x0 = Math.floor(Math.min(Ax, px) / h), x1 = Math.floor(Math.max(Ax, px) / h), y0 = Math.floor(Math.min(Ay, py) / h), y1 = Math.floor(Math.max(Ay, py) / h), z0 = Math.floor(Math.min(Az, pz) / h), z1 = Math.floor(Math.max(Az, pz) / h);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
        const l = grid.get(key(x, y, z)); if (!l) continue;
        for (const t of l) {
          if (stamp[t] === seq) continue; stamp[t] = seq;
          const i0 = index[t * 3] * 3, i1 = index[t * 3 + 1] * 3, i2 = index[t * 3 + 2] * 3;
          e1.set(P[i1] - P[i0], P[i1 + 1] - P[i0 + 1], P[i1 + 2] - P[i0 + 2]); e2.set(P[i2] - P[i0], P[i2 + 1] - P[i0 + 1], P[i2 + 2] - P[i0 + 2]);
          pv.crossVectors(D, e2); const det = e1.dot(pv); if (Math.abs(det) < 1e-12) continue;
          const inv = 1 / det; tv.set(Ax - P[i0], Ay - P[i0 + 1], Az - P[i0 + 2]); const uu = tv.dot(pv) * inv; if (uu < 0 || uu > 1) continue;
          qv.crossVectors(tv, e1); const vv = D.dot(qv) * inv; if (vv < 0 || uu + vv > 1) continue;
          const tt = e2.dot(qv) * inv; if (tt <= 0 || tt >= 1 || (1 - tt) * len <= graze) continue;
          // each corner in to inside the nearer end of the line along its own way in
          for (const c of [i0, i1, i2]) {
            const rx = P[c] - ax, rz = P[c + 2] - az, rl = Math.hypot(rx, rz); if (rl < 1e-9) continue;
            const ux = rx / rl, uz = rz / rl, to = Math.min((Ax - ax) * ux + (Az - az) * uz, (px - ax) * ux + (pz - az) * uz) - clear * 0.5;
            if (to < want[c / 3]) want[c / 3] = to;
          }
        }
      }
    }
    // (a closed garment's seam, its first and last columns, stays one: both go in as far as either does)
    if (seam) for (let a = 0; a + seam - 1 < N; a += seam) { const b = a + seam - 1, m = Math.min(want[a], want[b]); want[a] = m; want[b] = m; }
    for (let k = 0; k < N; k++) {
      const rx = P[k * 3] - ax, rz = P[k * 3 + 2] - az, rl = Math.hypot(rx, rz), to = Math.max(0, want[k]);
      if (to < rl - 1e-6) { any = true; P[k * 3] = ax + rx * to / rl; P[k * 3 + 2] = az + rz * to / rl; }
    }
    if (!any) break;
  }
}

/** On a body laid on the floor: each vertex of a hung garment but its top row falls straight along the way down (`down`,
 *  in the garment's frame) until it comes to rest, `clear` short of the first thing beneath it (sample points, as flat
 *  x, y, z lists) or on the floor (`lvl` along the way down). The points are binned on the plane across the way down.
 *  Then the cloth eases off what it rests on where it falls steeply (over the side of a leg, from a waistband): each
 *  vertex is raised toward its neighbours' height, never above where it fell from, so cloth falls from a limb to the
 *  floor in a slope rather than a wall. What `past` holds (a part none of the cloth covers) a vertex falls past, unless
 *  it would come to rest in it: then it falls as though it were any part. Exported for tests. */
export function drop(P: Float64Array, C: number, R: number, closed: boolean, down: THREE.Vector3, lvl: number, sets: number[][], clear: number, inside: (x: number, y: number, z: number, covered: boolean) => boolean, past?: (x: number, y: number, z: number) => boolean): void {
  const e1 = new THREE.Vector3(1, 0, 0); if (Math.abs(down.x) > 0.9) e1.set(0, 1, 0);
  e1.addScaledVector(down, -e1.dot(down)).normalize();
  const e2 = new THREE.Vector3().crossVectors(down, e1), rad = Math.max(0.09, 3.5 * clear), cell = new Map<number, number[]>();
  const key = (a: number, b: number) => (Math.floor(a / rad) + 4096) * 8192 + Math.floor(b / rad) + 4096;
  for (const pts of sets) for (let j = 0; j < pts.length; j += 3) {
    const x = pts[j], y = pts[j + 1], z = pts[j + 2], a = x * e1.x + y * e1.y + z * e1.z, b = x * e2.x + y * e2.y + z * e2.z, d = x * down.x + y * down.y + z * down.z;
    const k = key(a, b); let l = cell.get(k); if (!l) cell.set(k, (l = [])); l.push(a, b, d);
  }
  // how high each vertex is above the floor: as it hung, and where it comes to rest
  const N = C * R, top = new Float64Array(N), rest = new Float64Array(N);
  for (let k = 0; k < N; k++) {
    const x = P[k * 3], y = P[k * 3 + 1], z = P[k * 3 + 2], a = x * e1.x + y * e1.y + z * e1.z, b = x * e2.x + y * e2.y + z * e2.z, d = x * down.x + y * down.y + z * down.z;
    top[k] = lvl - d; let gap = lvl - d;
    if (k >= C && gap > 0) {
      const ca = Math.floor(a / rad), cb = Math.floor(b / rad);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const l = cell.get((ca + i + 4096) * 8192 + cb + j + 4096); if (!l) continue;
        for (let n = 0; n < l.length; n += 3) {
          const da = l[n] - a, db = l[n + 1] - b, dz = l[n + 2] - d; if (dz < -2 * clear || da * da + db * db > rad * rad) continue;
          gap = Math.min(gap, dz - clear);
        }
      }
    }
    // never down through a part of the body, nor up into one where it rises onto what lies beneath it (a capelet's
    // collar lifted off the back of the shoulders stops at the neck); and cloth caught inside a limb it covers (under a
    // limb laid across the body) rises out of it, to lie over it (a vertex inside another part stays for it to push out)
    const step = Math.max(clear, 0.03), g0 = gap;
    const settle = (ins: (x: number, y: number, z: number, covered: boolean) => boolean) => {
      let gap = g0;
      if (k >= C && ins(x, y, z, true)) {
        let up = 0; for (let t = step; t <= 0.8; t += step) if (!ins(x - down.x * t, y - down.y * t, z - down.z * t, true)) { up = t + clear * 0.5; break; }
        gap = -up;
      } else if (k >= C && gap !== 0 && !ins(x, y, z, false)) {
        let ok = 0; const sg = Math.sign(gap), far = Math.abs(gap);
        for (let t = step; t < far + step; t += step) { const u = Math.min(t, far) * sg; if (ins(x + down.x * u, y + down.y * u, z + down.z * u, false)) break; ok = u; }
        gap = ok;
      } else if (k >= C && gap > 0) gap = 0;
      return gap;
    };
    gap = settle(inside);
    // (what it falls past it stops on all the same where it would come to rest in it)
    if (past && k >= C) { const g = Math.max(-1, gap); if (past(x + down.x * g, y + down.y * g, z + down.z * g)) gap = settle((x, y, z, covered) => inside(x, y, z, covered) || (!covered && past(x, y, z))); }
    rest[k] = k < C ? top[k] : top[k] - Math.max(-1, gap);
  }
  const cap = Float64Array.from(top, (t, k) => Math.max(t, rest[k]));
  // eased toward the neighbours' height (across the strips and along them), between where it rests and where it hung
  let h = Float64Array.from(rest), nx = new Float64Array(N);
  for (let pass = 0; pass < 10; pass++) {
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const k = r * C + c; if (r === 0) { nx[k] = h[k]; continue; }
      let sum = 0, n = 0;
      const add = (rr: number, cc: number) => { if (rr < 0 || rr >= R) return; if (closed) cc = ((cc % (C - 1)) + (C - 1)) % (C - 1); else if (cc < 0 || cc >= C) return; sum += h[rr * C + cc]; n++; };
      add(r - 1, c); add(r + 1, c); add(r, c - 1); add(r, c + 1);
      nx[k] = Math.min(cap[k], Math.max(rest[k], n ? sum / n : h[k]));
    }
    [h, nx] = [nx, h];
  }
  for (let k = C; k < N; k++) { const g = top[k] - h[k]; if (g !== 0) { P[k * 3] += g * down.x; P[k * 3 + 1] += g * down.y; P[k * 3 + 2] += g * down.z; } }
}
