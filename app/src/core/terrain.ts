// The region's land as fields you can sample at any point in miles: land cover (forest, hills, mountains, water,
// mist) as smooth 0..1 weights, and the ground's height in feet. Both come from the world data's grids, laid on
// the same lattice from the bounds' top-left; the world map paints from them and the 3D backdrops stand on them.
import type { WorldData } from '../campaigns';

export type Cover = '.' | 'h' | 'm' | 'f' | 'w' | 'x';

export class Terrain {
  readonly cell: number; readonly rows: number; readonly cols: number; readonly x0: number; readonly y0: number;
  private fields = new Map<string, Float32Array>();
  private height: Float32Array | null = null;
  constructor(private w: WorldData) {
    this.cell = w.cellMiles ?? 0.125; this.x0 = w.bounds.minX; this.y0 = w.bounds.minY;
    this.rows = w.height?.length ?? w.cover?.length ?? 0; this.cols = this.rows ? (w.height?.[0]?.length ?? w.cover?.[0]?.length ?? 0) : 0;
    if (w.height) { this.height = new Float32Array(this.rows * this.cols); for (let r = 0; r < this.rows; r++) for (let k = 0; k < this.cols; k++) this.height[r * this.cols + k] = w.height[r][k] ?? 0; }
  }
  get hasCover(): boolean { return !!this.w.cover?.length; }
  get hasHeight(): boolean { return !!this.height; }

  private field(c: Cover): Float32Array {
    let f = this.fields.get(c); if (f) return f;
    const rows = this.w.cover ?? [], nr = this.rows, nc = this.cols;
    const raw = new Float32Array(nr * nc); for (let r = 0; r < nr; r++) for (let k = 0; k < nc; k++) raw[r * nc + k] = rows[r]?.[k] === c ? 1 : 0;
    f = new Float32Array(nr * nc); // a 3×3 blur softens the cell edges
    for (let r = 0; r < nr; r++) for (let k = 0; k < nc; k++) { let s = 0, n = 0; for (let dr = -1; dr <= 1; dr++) for (let dk = -1; dk <= 1; dk++) { const rr = r + dr, kk = k + dk; if (rr >= 0 && rr < nr && kk >= 0 && kk < nc) { const wgt = dr || dk ? 0.5 : 2; s += raw[rr * nc + kk] * wgt; n += wgt; } } f[r * nc + k] = s / n; }
    this.fields.set(c, f); return f;
  }
  private sample(f: Float32Array, mx: number, my: number, outside: number): number {
    const gx = (mx - this.x0) / this.cell - 0.5, gy = (my - this.y0) / this.cell - 0.5;
    const k0 = Math.floor(gx), r0 = Math.floor(gy), tx = gx - k0, ty = gy - r0;
    const g = (r: number, k: number) => (r < 0 || r >= this.rows || k < 0 || k >= this.cols ? outside : f[r * this.cols + k]);
    return (g(r0, k0) * (1 - tx) + g(r0, k0 + 1) * tx) * (1 - ty) + (g(r0 + 1, k0) * (1 - tx) + g(r0 + 1, k0 + 1) * tx) * ty;
  }
  /** How much of class `c` lies at (mx, my) in miles, 0..1. Beyond the grid everything is mist. */
  cover(c: Cover, mx: number, my: number): number { return this.hasCover ? this.sample(this.field(c), mx, my, c === 'x' ? 1 : 0) : 0; }
  /** Ground height in feet at (mx, my); beyond the grid the land keeps the edge's height. */
  heightAt(mx: number, my: number): number {
    if (!this.height) return 0;
    const cx = Math.min(this.x0 + (this.cols - 0.5) * this.cell, Math.max(this.x0 + 0.5 * this.cell, mx)), cy = Math.min(this.y0 + (this.rows - 0.5) * this.cell, Math.max(this.y0 + 0.5 * this.cell, my));
    return this.sample(this.height, cx, cy, 0);
  }
  private mips: Float32Array[] | null = null;
  /** The heightfield box-filtered to half, quarter... resolution: a surface drawn with coarse quads samples a grid no
   *  finer than its quads, so far ridges smooth out instead of aliasing into random spikes and facets. */
  private mip(level: number): { f: Float32Array; rows: number; cols: number; cell: number } {
    if (!this.height) return { f: new Float32Array(0), rows: 0, cols: 0, cell: this.cell };
    this.mips ??= [this.height];
    while (this.mips.length <= level) {
      const prev = this.mips[this.mips.length - 1], k = this.mips.length, pr = Math.ceil(this.rows / 2 ** (k - 1)), pc = Math.ceil(this.cols / 2 ** (k - 1));
      const nr = Math.ceil(pr / 2), nc = Math.ceil(pc / 2), f = new Float32Array(nr * nc);
      for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) { let s = 0, n = 0; for (let dr = 0; dr < 2; dr++) for (let dc = 0; dc < 2; dc++) { const rr = r * 2 + dr, cc = c * 2 + dc; if (rr < pr && cc < pc) { s += prev[rr * pc + cc]; n++; } } f[r * nc + c] = n ? s / n : 0; }
      this.mips.push(f);
    }
    const k = level, rows = Math.ceil(this.rows / 2 ** k), cols = Math.ceil(this.cols / 2 ** k);
    return { f: this.mips[k], rows, cols, cell: this.cell * 2 ** k };
  }
  /** Ground height in feet at (mx, my) as a C1 surface: Catmull-Rom over the 4×4 cells round the point, so slopes have
   *  no creases at cell borders. `footprint` (miles) is how coarsely the land is drawn there: wider than a cell, it reads
   *  a filtered copy of the grid instead (see mip), blended continuously between the two nearest copies so the surface
   *  is one function of position whatever resolution samples it. Beyond the grid the land keeps the edge's height. */
  heightSmoothAt(mx: number, my: number, footprint = 0): number {
    if (!this.height) return 0;
    const lv = Math.max(0, Math.min(5, Math.log2(Math.max(1, footprint / this.cell)))), l0 = Math.floor(lv), t = lv - l0;
    const a = this.bicubic(l0, mx, my);
    return t > 1e-3 && l0 < 5 ? a + (this.bicubic(l0 + 1, mx, my) - a) * t : a;
  }
  private bicubic(level: number, mx: number, my: number): number {
    const { f, rows, cols, cell } = this.mip(level);
    const gx = Math.min(cols - 1, Math.max(0, (mx - this.x0) / cell - 0.5)), gy = Math.min(rows - 1, Math.max(0, (my - this.y0) / cell - 0.5));
    const k0 = Math.floor(gx), r0 = Math.floor(gy), tx = gx - k0, ty = gy - r0;
    const ka = Math.max(0, k0 - 1), kb = Math.max(0, Math.min(cols - 1, k0)), kc = Math.min(cols - 1, k0 + 1), kd = Math.min(cols - 1, k0 + 2);
    const rr = [r0 - 1, r0, r0 + 1, r0 + 2], v = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) { const base = Math.min(rows - 1, Math.max(0, rr[i])) * cols, a = f[base + ka], b = f[base + kb], c = f[base + kc], d = f[base + kd]; v[i] = b + 0.5 * tx * (c - a + tx * (2 * a - 5 * b + 4 * c - d + tx * (3 * (b - c) + d - a))); }
    const a = v[0], b = v[1], c = v[2], d = v[3];
    return b + 0.5 * ty * (c - a + ty * (2 * a - 5 * b + 4 * c - d + ty * (3 * (b - c) + d - a)));
  }
  /** Every cell of class `c` with its weight, for painting. */
  cells(c: Cover): [[number, number], number][] { const f = this.field(c), out: [[number, number], number][] = []; for (let r = 0; r < this.rows; r++) for (let k = 0; k < this.cols; k++) if (f[r * this.cols + k] > 0) out.push([[this.x0 + (k + 0.5) * this.cell, this.y0 + (r + 0.5) * this.cell], f[r * this.cols + k]]); return out; }
}

const cache = new WeakMap<WorldData, Terrain>();
export function terrainOf(w: WorldData): Terrain { let t = cache.get(w); if (!t) { t = new Terrain(w); cache.set(w, t); } return t; }
