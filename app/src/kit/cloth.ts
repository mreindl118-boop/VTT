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
  /** Limbs among those it covers that it hangs on from its top (a capelet on the tops of the arms): on a body laid out
   *  it still goes over them where they are flung up past where it hangs from, as other limbs leave it. */
  holds?: string[];
  /** A plate, not cloth: it swings out as one piece about its top edge, never bending. */
  stiff?: boolean;
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
  for (const g of [...garments].sort((a, b) => a.layer - b.layer)) {
    hangOne(g, w, hung, top);
    g.mesh.updateMatrixWorld(true);
    hung.set(g.name, pointsOf(g.mesh, 900));
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
    for (let j = 0; j < L.length; j += 3) {
      const pr = L[j], py = L[j + 1];
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
          let inside = false;
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
  let plate: { pivot: THREE.Vector3; hinge: THREE.Vector3; turn: number } | undefined;
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
    plate = { pivot, hinge, turn: Math.min(MAX_PLATE_TURN, A) * probeSide(hinge, n0) };
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
  if (plate && plate.turn) { const q = new THREE.Quaternion().setFromAxisAngle(plate.hinge, plate.turn), v = new THREE.Vector3(); for (let k = 0; k < C * R; k++) { v.set(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]).sub(plate.pivot).applyQuaternion(q).add(plate.pivot); P[k * 3] = v.x; P[k * 3 + 1] = v.y; P[k * 3 + 2] = v.z; } }
  // a seam stays closed
  if (g.closed) for (let r = 0; r < R; r++) { const a = (r * C) * 3, b = (r * C + C - 1) * 3; for (let k = 0; k < 3; k++) { const m = (P[a + k] + P[b + k]) / 2; P[a + k] = m; P[b + k] = m; } }
  // cloth lies on the floor rather than passing into it (on a body laid out, what lies under it lies under the cloth
  // nearer the body: an outer garment beneath the body is nearer the floor; a plate does not fall, but keeps the turn
  // it swung by, as one piece)
  const toWorld = parent.matrixWorld, v = new THREE.Vector3(), o = new THREE.Vector3();
  const lvl = w.floor === undefined ? Infinity : w.floor - new THREE.Vector3().setFromMatrixPosition(toWorld).dot(w.down) - 0.005 - (w.lying ? 0.012 * (topLayer - g.layer) : 0);
  const onFloor = () => { for (let k = 0; k < C * R; k++) { const d = P[k * 3] * down.x + P[k * 3 + 1] * down.y + P[k * 3 + 2] * down.z - lvl; if (d > 0) { P[k * 3] -= d * down.x; P[k * 3 + 1] -= d * down.y; P[k * 3 + 2] -= d * down.z; } } };
  if (w.floor !== undefined) {
    if (w.lying && !g.stiff) {
      // (nor through a part of the body on the way down: each part's volume, tested inside its bounds)
      const vols: [THREE.Box3, (p: THREE.Vector3, out: THREE.Vector3) => number, boolean][] = [];
      for (const [n, f] of w.volumes ?? []) { const pts = w.parts.get(n); if (pts?.length) vols.push([new THREE.Box3().setFromPoints(pts).expandByScalar(clear), f, g.covers.includes(n) && !w.trunk?.includes(n)]); }
      const q = new THREE.Vector3(), tmp = new THREE.Vector3();
      const inside = (x: number, y: number, z: number, covered: boolean) => { q.set(x, y, z).applyMatrix4(toWorld); for (const [b, f, c] of vols) if ((c || !covered) && b.containsPoint(q) && f(q, tmp) > -clear * 0.5) return true; return false; };
      drop(P, C, R, g.closed, down, lvl, [under, heldOn, body, over], clear, inside);
    }
    onFloor();
  }
  // anything still inside what it covers is pushed out of it
  if (w.volumes && !g.stiff) {
    const vols = g.covers.map((n) => w.volumes!.get(n)).filter((f): f is NonNullable<typeof f> => !!f);
    if (vols.length) for (let k = 0; k < C * R; k++) {
      v.set(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]).applyMatrix4(toWorld);
      let moved = false;
      for (let pass = 0; pass < 3; pass++) {
        let any = false;
        for (const f of vols) { const d = f(v, o); if (d > -clear * 0.5) { v.addScaledVector(o, d + clear * 0.5); any = true; moved = true; } }
        if (!any) break;
      }
      if (moved) { v.applyMatrix4(toLocal); P[k * 3] = v.x; P[k * 3 + 1] = v.y; P[k * 3 + 2] = v.z; }
    }
  }
  // and where it still runs through a part it covers, between the part's bone and its surface (cloth drawn across a
  // toe, or over an elbow between two of its strips), it is lifted out past the surface there
  // (never through the floor: cloth under a limb resting on the floor stays on the floor under it)
  if (w.bones && !g.stiff && geo.index) { liftOut(P, geo.index.array, g.covers, w, toLocal, clear, ax, az, w.lying ? down.clone().negate() : undefined); onFloor(); }
  for (let k = 0; k < C * R; k++) pos.setXYZ(k, P[k * 3], P[k * 3 + 1], P[k * 3 + 2]);
  pos.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingBox(); geo.computeBoundingSphere();
}

/** Lifts hung cloth (`P`, flat x, y, z in its parent's frame; triangles `index`) out of the parts it covers: where the
 *  line from a part's bone out to one of its sample points crosses a triangle, the cloth there lies inside the part, and
 *  the triangle's corners move out along that line to `clear` / 2 past the point. A few passes, as a lifted triangle
 *  can draw its neighbours in. Cloth only ever moves out from its axis, or (on a body laid out, `up` the way off the
 *  floor in the parent's frame) up off the floor: over a hand or an arm lying on the floor, never down under it. */
function liftOut(P: Float64Array, index: ArrayLike<number>, covers: string[], w: DrapeWorld, toLocal: THREE.Matrix4, clear: number, ax: number, az: number, up?: THREE.Vector3): void {
  const pts: number[] = [], lines: number[][] = [], owner: number[] = [], v = new THREE.Vector3();
  for (const n of covers) {
    const b = w.bones!.get(n), ps = w.surface?.get(n) ?? w.parts.get(n); if (!b || b.length < 2 || !ps) continue;
    lines.push(b.flatMap((p) => v.copy(p).applyMatrix4(toLocal).toArray()));
    for (const p of ps) { v.copy(p).applyMatrix4(toLocal); pts.push(v.x, v.y, v.z); owner.push(lines.length - 1); }
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
          let rx = (P[i0] + P[i1] + P[i2]) / 3 - ax, rz = (P[i0 + 2] + P[i1 + 2] + P[i2 + 2]) / 3 - az; const rl = Math.hypot(rx, rz); if (rl < 1e-9) continue; rx /= rl; rz /= rl;
          let dr = (D.x * rx + D.z * rz) / len;
          if (up) dr = Math.max(dr, D.dot(up) / len);
          if (dr <= 0) continue;
          const need = (1 - tt) * len + clear * 0.5;
          for (const c of [i0, i1, i2]) { const k = c / 3; if (need > want[k]) { want[k] = need; dirs[c] = D.x / len; dirs[c + 1] = D.y / len; dirs[c + 2] = D.z / len; } }
        }
      }
    }
    for (let k = 0; k < N; k++) if (want[k] > 0) { any = true; P[k * 3] += dirs[k * 3] * want[k]; P[k * 3 + 1] += dirs[k * 3 + 1] * want[k]; P[k * 3 + 2] += dirs[k * 3 + 2] * want[k]; }
    if (!any) break;
  }
}

/** On a body laid on the floor: each vertex of a hung garment but its top row falls straight along the way down (`down`,
 *  in the garment's frame) until it comes to rest, `clear` short of the first thing beneath it (sample points, as flat
 *  x, y, z lists) or on the floor (`lvl` along the way down). The points are binned on the plane across the way down.
 *  Then the cloth eases off what it rests on where it falls steeply (over the side of a leg, from a waistband): each
 *  vertex is raised toward its neighbours' height, never above where it fell from, so cloth falls from a limb to the
 *  floor in a slope rather than a wall. */
function drop(P: Float64Array, C: number, R: number, closed: boolean, down: THREE.Vector3, lvl: number, sets: number[][], clear: number, inside: (x: number, y: number, z: number, covered: boolean) => boolean): void {
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
    // never down through a part of the body; and cloth caught inside a limb it covers (under a limb laid across the
    // body) rises out of it, to lie over it (a vertex inside another part stays for it to push out)
    const step = Math.max(clear, 0.03);
    if (k >= C && inside(x, y, z, true)) {
      let up = 0; for (let t = step; t <= 0.8; t += step) if (!inside(x - down.x * t, y - down.y * t, z - down.z * t, true)) { up = t + clear * 0.5; break; }
      gap = -up;
    } else if (k >= C && gap > 0 && !inside(x, y, z, false)) {
      let ok = 0;
      for (let t = step; t < gap + step; t += step) { const u = Math.min(t, gap); if (inside(x + down.x * u, y + down.y * u, z + down.z * u, false)) break; ok = u; }
      gap = ok;
    } else if (k >= C && gap > 0) gap = 0;
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
