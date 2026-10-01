// Per-level explored memory + current visibility, at 1-ft resolution on ordinary maps and at a coarser cell on
// huge ones (a whole town), so the map never holds more than a few hundred thousand cells.
import { bounds, pointInPolygon, type Polygon } from './geometry';
import { canSee, sightBlockers, type Viewer } from './light';
import type { Ambient, LightSource, Wall } from './schema';

export const enum Cov { Unexplored = 0, Explored = 1, Visible = 2 }

export class CoverageMap {
  readonly seen: Uint8Array;
  readonly visible: Uint8Array;
  /** DM-painted reveal (acts as permanently visible for players). 1 = revealed, 2 = forced fog. */
  readonly paint: Uint8Array;

  /** The floor polygons the last vision pass ran over, and the cells inside them (recomputed only when they change). */
  private floorKey: Polygon[] = [];
  private floorMask: Uint8Array | null = null;

  constructor(readonly originX: number, readonly originZ: number, readonly width: number, readonly height: number, readonly cell = 1) {
    const n = width * height;
    this.seen = new Uint8Array(n);
    this.visible = new Uint8Array(n);
    this.paint = new Uint8Array(n);
  }

  static readonly MAX_CELLS = 320_000;
  static forPolygons(polys: Polygon[], pad = 2): CoverageMap {
    const b = bounds(polys);
    const wFt = Math.ceil(b.maxX) + pad - (Math.floor(b.minX) - pad), hFt = Math.ceil(b.maxZ) + pad - (Math.floor(b.minZ) - pad);
    const cell = [1, 2, 3, 4, 5, 8, 10].find((c) => (wFt / c) * (hFt / c) <= CoverageMap.MAX_CELLS) ?? 10;
    const ox = Math.floor(b.minX) - pad, oz = Math.floor(b.minZ) - pad;
    return new CoverageMap(ox, oz, Math.ceil(wFt / cell), Math.ceil(hFt / cell), cell);
  }
  /** The map's extent in feet. */
  get widthFt(): number { return this.width * this.cell; }
  get heightFt(): number { return this.height * this.cell; }

  idx(x: number, z: number): number {
    const i = Math.floor((x - this.originX) / this.cell), j = Math.floor((z - this.originZ) / this.cell);
    if (i < 0 || j < 0 || i >= this.width || j >= this.height) return -1;
    return j * this.width + i;
  }

  state(x: number, z: number): Cov {
    const k = this.idx(x, z);
    if (k < 0) return Cov.Unexplored;
    if (this.paint[k] === 2) return Cov.Unexplored;
    if (this.visible[k] || this.paint[k] === 1) return Cov.Visible;
    return this.seen[k] ? Cov.Explored : Cov.Unexplored;
  }

  *cellsIn(poly: Polygon): Generator<number> {
    const b = bounds([poly]), c = this.cell;
    for (let z = Math.floor(b.minZ / c) * c; z < Math.ceil(b.maxZ); z += c)
      for (let x = Math.floor(b.minX / c) * c; x < Math.ceil(b.maxX); x += c) {
        if (!pointInPolygon([x + c / 2, z + c / 2], poly)) continue;
        const k = this.idx(x, z);
        if (k >= 0) yield k;
      }
  }

  /** Stamp a polygon: 'reveal' | 'fog' (force hidden) | 'explored' | 'clear' (remove DM paint). */
  stamp(poly: Polygon, mode: 'reveal' | 'fog' | 'explored' | 'clear'): void {
    for (const k of this.cellsIn(poly)) {
      if (mode === 'reveal') this.paint[k] = 1;
      else if (mode === 'fog') { this.paint[k] = 2; this.seen[k] = 0; }
      else if (mode === 'explored') { this.seen[k] = 1; if (this.paint[k] === 2) this.paint[k] = 0; }
      else this.paint[k] = 0;
    }
  }

  brush(cx: number, cz: number, r: number, mode: 'reveal' | 'fog' | 'clear'): void {
    const c = this.cell;
    for (let z = Math.floor((cz - r) / c) * c; z <= cz + r; z += c)
      for (let x = Math.floor((cx - r) / c) * c; x <= cx + r; x += c) {
        if (Math.hypot(x + c / 2 - cx, z + c / 2 - cz) > r + c / 2) continue;
        const k = this.idx(x, z);
        if (k < 0) continue;
        this.paint[k] = mode === 'reveal' ? 1 : mode === 'fog' ? 2 : 0;
        if (mode === 'fog') this.seen[k] = 0;
      }
  }

  /**
   * Recompute what player tokens currently see, restricted to `floor` polygons (plus a 1-ft wall rim so walls
   * bounding a seen room are remembered too). Everything seen joins explored memory.
   */
  updateVision(viewers: Viewer[], floor: Polygon[], walls: Wall[], lights: LightSource[], ambient: Ambient, revealedDoors?: ReadonlySet<string>): void {
    this.visible.fill(0);
    if (!viewers.length) return;
    const blockers = sightBlockers(walls, revealedDoors);
    const mask = this.floorCells(floor), c = this.cell;
    for (let j = 0; j < this.height; j++)
      for (let i = 0; i < this.width; i++) {
        if (!mask[j * this.width + i]) continue;
        const x = this.originX + (i + 0.5) * c, z = this.originZ + (j + 0.5) * c;
        for (const v of viewers) {
          if (canSee(v, [x, z], lights, blockers, ambient)) {
            const k = j * this.width + i;
            this.visible[k] = 1;
            this.seen[k] = 1;
            break;
          }
        }
      }
    this.dilateInto(this.visible);
    this.dilateInto(this.seen);
  }

  /** Which cells lie on the given floor polygons; the same polygons as last time reuse the cached answer. */
  private floorCells(floor: Polygon[]): Uint8Array {
    if (this.floorMask && floor.length === this.floorKey.length && floor.every((p, i) => p === this.floorKey[i])) return this.floorMask;
    const m = new Uint8Array(this.width * this.height);
    for (const p of floor) for (const k of this.cellsIn(p)) m[k] = 1;
    this.floorKey = floor.slice(); this.floorMask = m;
    return m;
  }

  /** Grow a mask by one texel (so wall tops adjacent to seen floor show). */
  private dilateInto(m: Uint8Array): void {
    const src = m.slice();
    for (let j = 0; j < this.height; j++)
      for (let i = 0; i < this.width; i++) {
        if (src[j * this.width + i]) continue;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const a = i + di, b = j + dj;
          if (a >= 0 && b >= 0 && a < this.width && b < this.height && src[b * this.width + a]) m[j * this.width + i] = 1;
        }
      }
  }

  /** RGBA bytes for the fog texture: R = visible(255)/explored(128)/unexplored(0). */
  toTexture(out: Uint8Array<ArrayBufferLike> = new Uint8Array(this.width * this.height * 4)): Uint8Array<ArrayBufferLike> {
    for (let k = 0; k < this.width * this.height; k++) {
      const v = this.paint[k] === 2 ? 0 : this.visible[k] || this.paint[k] === 1 ? 255 : this.seen[k] ? 128 : 0;
      out[k * 4] = v; out[k * 4 + 1] = v; out[k * 4 + 2] = v; out[k * 4 + 3] = 255;
    }
    return out;
  }

  serialize(): { seen: string; paint: string } {
    const tag = this.cell === 1 ? '' : `c${this.cell}:`;
    return { seen: tag + rle(this.seen), paint: tag + rle(this.paint) };
  }
  /** A record saved at another cell size is for another map: it is left alone. */
  load(s: { seen: string; paint: string }): void {
    const take = (v: string) => { const m = /^c(\d+):/.exec(v); const c = m ? Number(m[1]) : 1; return c === this.cell ? v.slice(m ? m[0].length : 0) : ''; };
    unrle(take(s.seen), this.seen); unrle(take(s.paint), this.paint);
  }
}

function rle(a: Uint8Array): string {
  const out: string[] = [];
  let i = 0;
  while (i < a.length) { let j = i; while (j < a.length && a[j] === a[i]) j++; out.push(`${a[i]}x${j - i}`); i = j; }
  return out.join(',');
}
function unrle(s: string, into: Uint8Array): void {
  let i = 0;
  for (const run of s.split(',')) { if (!run) continue; const [v, n] = run.split('x').map(Number); into.fill(v, i, Math.min(into.length, i + n)); i += n; }
}
