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
  /** Every cell of class `c` with its weight, for painting. */
  cells(c: Cover): [[number, number], number][] { const f = this.field(c), out: [[number, number], number][] = []; for (let r = 0; r < this.rows; r++) for (let k = 0; k < this.cols; k++) if (f[r * this.cols + k] > 0) out.push([[this.x0 + (k + 0.5) * this.cell, this.y0 + (r + 0.5) * this.cell], f[r * this.cols + k]]); return out; }
}

const cache = new WeakMap<WorldData, Terrain>();
export function terrainOf(w: WorldData): Terrain { let t = cache.get(w); if (!t) { t = new Terrain(w); cache.set(w, t); } return t; }
