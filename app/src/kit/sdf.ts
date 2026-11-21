// Distance fields and their surfaces: smooth unions of ovals and rods, carved by others, meshed by surface nets with each
// vertex settled onto the surface and shaded by the field's slope, so a sculpted part (a skull, a hip bone, a bare foot)
// reads as one cast piece rather than parts stuck together. Original geometry.
import * as THREE from 'three';

type Geo = THREE.BufferGeometry;

export type Sdf = (x: number, y: number, z: number) => number;
export const smin = (a: number, b: number, k: number) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
export const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);
/** Distance (near enough) to an oval at the origin with radii rx, ry, rz. */
export function ell(x: number, y: number, z: number, rx: number, ry: number, rz: number): number {
  const k0 = Math.hypot(x / rx, y / ry, z / rz), k1 = Math.hypot(x / (rx * rx), y / (ry * ry), z / (rz * rz));
  return k1 < 1e-9 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
}
/** Distance to the line from a to b (points as [x, y, z]). */
export function seg(x: number, y: number, z: number, a: number[], b: number[]): number {
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], px = x - a[0], py = y - a[1], pz = z - a[2];
  const h = Math.max(0, Math.min(1, (px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz)));
  return Math.hypot(px - bx * h, py - by * h, pz - bz * h);
}
/** Distance to a run of lines through points. */
export const run = (x: number, y: number, z: number, P: number[][]) => { let d = Infinity; for (let i = 1; i < P.length; i++) d = Math.min(d, seg(x, y, z, P[i - 1], P[i])); return d; };
/** Distance to a 2D triangle (a, b, c as [u, v]). */
export function tri(u: number, v: number, a: number[], b: number[], c: number[]): number {
  const e = [[b[0] - a[0], b[1] - a[1]], [c[0] - b[0], c[1] - b[1]], [a[0] - c[0], a[1] - c[1]]], q = [[u - a[0], v - a[1]], [u - b[0], v - b[1]], [u - c[0], v - c[1]]];
  const sg = Math.sign(e[0][0] * e[2][1] - e[0][1] * e[2][0]); let d = Infinity, s = Infinity;
  for (let i = 0; i < 3; i++) {
    const h = Math.max(0, Math.min(1, (q[i][0] * e[i][0] + q[i][1] * e[i][1]) / (e[i][0] ** 2 + e[i][1] ** 2))), px = q[i][0] - e[i][0] * h, py = q[i][1] - e[i][1] * h;
    d = Math.min(d, px * px + py * py); s = Math.min(s, sg * (q[i][0] * e[i][1] - q[i][1] * e[i][0]));
  }
  return -Math.sqrt(d) * Math.sign(s);
}
/** The surface of a field over a box: surface nets on a grid of `cell`, each vertex settled onto the surface and
 *  given the field's slope as its normal; `paint` colours a vertex (0 to 1 toward a second colour) if given. */
export function nets(f: Sdf, lo: number[], hi: number[], cell: number, paint?: Sdf): Geo {
  const n = [0, 1, 2].map((a) => Math.ceil((hi[a] - lo[a]) / cell) + 1), [nx, ny, nz] = n, val = new Float32Array(nx * ny * nz), I = (i: number, j: number, k: number) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) val[I(i, j, k)] = f(lo[0] + i * cell, lo[1] + j * cell, lo[2] + k * cell);
  const cx = nx - 1, cy = ny - 1, C = (i: number, j: number, k: number) => i + cx * (j + cy * k), at = new Int32Array(cx * cy * (nz - 1)).fill(-1), pos: number[] = [];
  const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], edge = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const v = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
    let m = 0; for (let c = 0; c < 8; c++) { v[c] = val[I(i + corner[c][0], j + corner[c][1], k + corner[c][2])]; if (v[c] < 0) m |= 1 << c; }
    if (m === 0 || m === 255) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (const [a, b] of edge) { if ((v[a] < 0) === (v[b] < 0)) continue; const t = v[a] / (v[a] - v[b]); sx += corner[a][0] + t * (corner[b][0] - corner[a][0]); sy += corner[a][1] + t * (corner[b][1] - corner[a][1]); sz += corner[a][2] + t * (corner[b][2] - corner[a][2]); cnt++; }
    at[C(i, j, k)] = pos.length / 3; pos.push(lo[0] + (i + sx / cnt) * cell, lo[1] + (j + sy / cnt) * cell, lo[2] + (k + sz / cnt) * cell);
  }
  const idx: number[] = [], quad = (a: number, b: number, c: number, d: number, flip: boolean) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d); };
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const v0 = val[I(i, j, k)] < 0;
    if (i < cx && j > 0 && k > 0 && j < cy && k < nz - 1 && v0 !== val[I(i + 1, j, k)] < 0) quad(at[C(i, j - 1, k - 1)], at[C(i, j, k - 1)], at[C(i, j, k)], at[C(i, j - 1, k)], !v0);
    if (j < cy && i > 0 && k > 0 && i < cx && k < nz - 1 && v0 !== val[I(i, j + 1, k)] < 0) quad(at[C(i - 1, j, k - 1)], at[C(i - 1, j, k)], at[C(i, j, k)], at[C(i, j, k - 1)], !v0);
    if (k < nz - 1 && i > 0 && j > 0 && i < cx && j < cy && v0 !== val[I(i, j, k + 1)] < 0) quad(at[C(i - 1, j - 1, k)], at[C(i, j - 1, k)], at[C(i, j, k)], at[C(i - 1, j, k)], !v0);
  }
  // settle each vertex onto the surface along the field's slope, and shade it by that slope
  const e = cell * 0.25, nrm: number[] = [], col: number[] = [];
  for (let q = 0; q < pos.length; q += 3) {
    let x = pos[q], y = pos[q + 1], z = pos[q + 2], gx = 0, gy = 0, gz = 0;
    for (let it = 0; it < 3; it++) {
      const d = f(x, y, z); gx = f(x + e, y, z) - f(x - e, y, z); gy = f(x, y + e, z) - f(x, y - e, z); gz = f(x, y, z + e) - f(x, y, z - e);
      const g2 = (gx * gx + gy * gy + gz * gz) / (4 * e * e); if (g2 < 1e-12) break; const k = d / g2 / (2 * e); x -= gx * k; y -= gy * k; z -= gz * k;
    }
    pos[q] = x; pos[q + 1] = y; pos[q + 2] = z; const gl = Math.hypot(gx, gy, gz) || 1; nrm.push(gx / gl, gy / gl, gz / gl);
    if (paint) col.push(paint(x, y, z));
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  if (paint) g.setAttribute('shade', new THREE.Float32BufferAttribute(col, 1));
  g.setIndex(idx); return g;
}
/** A field's mesh mirrored across x (the faces turned back the right way round). */
export function mirrorX(g: Geo): Geo {
  const m = g.clone(); m.scale(-1, 1, 1); const ix = m.index!; for (let i = 0; i < ix.count; i += 3) { const a = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, a); }
  return m;
}
