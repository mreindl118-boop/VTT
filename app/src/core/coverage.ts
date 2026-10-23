// Per-level explored memory + current visibility, at 1-ft resolution on ordinary maps and at a coarser cell on
// huge ones (a whole town), so the map never holds more than a few hundred thousand cells.
import { bounds, pointInPolygon, type Polygon } from './geometry';
import { canSee, sightBlockers, type Viewer } from './light';
import type { Ambient, LightSource, Wall } from './schema';

export const enum Cov { Unexplored = 0, Explored = 1, Visible = 2 }

interface GridGeometry {
  readonly cell: number;
  readonly originX: number;
  readonly originZ: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Historical pre-header grid geometries from 0.3.1 and earlier builds whose map bounds or cell size
 * subsequently changed. Each entry has a distinct (cell, width * height) pair so legacy `c<cell>:<rle>`
 * and bare `<rle>` strings can be placed and conservatively resampled onto regenerated maps.
 */
const LEGACY_GEOMETRIES: readonly GridGeometry[] = [
  // ch14/Y/hill (Yester Hill)
  { cell: 4, originX: -2, originZ: -2, width: 201, height: 201 },
  { cell: 4, originX: -2, originZ: -2, width: 437, height: 564 },
  { cell: 4, originX: -2, originZ: -2, width: 433, height: 564 },
  // ch14/Y/summit
  { cell: 2, originX: 553, originZ: 853, width: 342, height: 410 },
  { cell: 1, originX: 595, originZ: 1026, width: 426, height: 502 },
  // ch10/U3/mire (Berez mire)
  { cell: 1, originX: -2, originZ: -2, width: 59, height: 59 },
  // ch02/A/day, ch02/B/day, ch02/D/river, ch02/F/day (and I/day), ch03/E/village, ch04/K/ground, ch05/N/town, ch08/R/river
  { cell: 1, originX: -2, originZ: -2, width: 604, height: 324 },
  { cell: 1, originX: -2, originZ: -2, width: 504, height: 354 },
  { cell: 1, originX: -35, originZ: 77, width: 749, height: 282 },
  { cell: 1, originX: -2, originZ: -2, width: 504, height: 404 },
  { cell: 1, originX: -2, originZ: -2, width: 360, height: 422 },
  { cell: 2, originX: -154, originZ: -107, width: 330, height: 413 },
  { cell: 2, originX: -2, originZ: -2, width: 415, height: 452 },
  { cell: 1, originX: -2, originZ: 18, width: 434, height: 304 },
  { cell: 10, originX: 56, originZ: 728, width: 712, height: 353 },
  { cell: 10, originX: 56, originZ: 428, width: 712, height: 383 },
  { cell: 10, originX: -2, originZ: -2, width: 736, height: 459 },
  { cell: 10, originX: -654, originZ: -1560, width: 807, height: 621 },
];

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
    const i0 = Math.max(0, Math.floor((b.minX - this.originX) / c)), i1 = Math.min(this.width, Math.ceil((b.maxX - this.originX) / c));
    const j0 = Math.max(0, Math.floor((b.minZ - this.originZ) / c)), j1 = Math.min(this.height, Math.ceil((b.maxZ - this.originZ) / c));
    for (let j = j0; j < j1; j++)
      for (let i = i0; i < i1; i++) {
        if (!pointInPolygon([this.originX + (i + 0.5) * c, this.originZ + (j + 0.5) * c], poly)) continue;
        yield j * this.width + i;
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
    const i0 = Math.max(0, Math.floor((cx - r - this.originX) / c)), i1 = Math.min(this.width - 1, Math.floor((cx + r - this.originX) / c));
    const j0 = Math.max(0, Math.floor((cz - r - this.originZ) / c)), j1 = Math.min(this.height - 1, Math.floor((cz + r - this.originZ) / c));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        if (Math.hypot(this.originX + (i + 0.5) * c - cx, this.originZ + (j + 0.5) * c - cz) > r + c / 2) continue;
        const k = j * this.width + i;
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
            break;
          }
        }
      }
    // Grow only what is seen now (the 1-ft wall rim), then add it to memory once. Growing the accumulated memory
    // itself crept one cell further through walls on every update, revealing whole floors with no movement.
    this.dilateInto(this.visible);
    for (let k = 0; k < this.visible.length; k++) if (this.visible[k]) this.seen[k] = 1;
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
    const tag = `c${this.cell}@${this.originX},${this.originZ}/${this.width}x${this.height}:`;
    return { seen: tag + rle(this.seen), paint: tag + rle(this.paint) };
  }

  /** Whether a serialized coverage string can be placed onto this map (directly or via legacy lookup). */
  canPlace(raw: string): boolean {
    return decodeField(raw, this).kind !== 'unplaceable';
  }

  /**
   * Load serialized `seen` and `paint` strings, conservatively resampling in world space when the saved
   * cell size, origin, or dimensions differ from this map. If a legacy `seen` record lacks geometry metadata
   * and matches neither this map nor the known legacy geometry table, it is preserved untouched under
   * `legacyOut[\`${key}@legacy\`]` and `load()` returns `false`.
   */
  load(s: { seen: string; paint: string }, legacyOut?: Record<string, string>, key?: string): boolean {
    const dSeen = decodeField(s.seen, this);
    const dPaint = decodeField(s.paint, this);
    if (dSeen.kind === 'unplaceable') {
      this.seen.fill(0);
      if (legacyOut && key && s.seen) legacyOut[`${key}@legacy`] = s.seen;
      return false;
    }
    if (dSeen.kind === 'empty') this.seen.fill(0);
    else this.applyPlaced(dSeen, this.seen, 'seen');

    if (dPaint.kind === 'placed') this.applyPlaced(dPaint, this.paint, 'paint');
    else this.paint.fill(0);
    return true;
  }

  private applyPlaced(src: PlacedField, into: Uint8Array, mode: 'seen' | 'paint'): void {
    const { cell: sc, originX: sox, originZ: soz, width: sw, height: sh, data } = src;
    if (sc === this.cell && sox === this.originX && soz === this.originZ && sw === this.width && sh === this.height) {
      into.set(data);
      return;
    }
    into.fill(0);
    const tc = this.cell;
    for (let tj = 0; tj < this.height; tj++) {
      const tz0 = this.originZ + tj * tc, tz1 = tz0 + tc;
      const sj0 = Math.floor((tz0 - soz) / sc), sj1 = Math.ceil((tz1 - soz) / sc) - 1;
      for (let ti = 0; ti < this.width; ti++) {
        const tx0 = this.originX + ti * tc, tx1 = tx0 + tc;
        const si0 = Math.floor((tx0 - sox) / sc), si1 = Math.ceil((tx1 - sox) / sc) - 1;
        const tk = tj * this.width + ti;
        if (mode === 'paint') {
          const csi0 = Math.max(0, si0), csi1 = Math.min(sw - 1, si1);
          const csj0 = Math.max(0, sj0), csj1 = Math.min(sh - 1, sj1);
          let forcedFog = false;
          for (let sj = csj0; sj <= csj1 && !forcedFog; sj++)
            for (let si = csi0; si <= csi1; si++)
              if (data[sj * sw + si] === 2) { forcedFog = true; break; }
          if (forcedFog) { into[tk] = 2; continue; }
        }
        // Conservative coverage: target cell [tx0, tx1] x [tz0, tz1] is marked covered (1) only when its
        // entire footprint lies within the source bounds and every overlapping source cell is covered (1).
        if (si0 < 0 || si1 >= sw || sj0 < 0 || sj1 >= sh) continue;
        let full = true;
        for (let sj = sj0; sj <= sj1 && full; sj++)
          for (let si = si0; si <= si1; si++)
            if (data[sj * sw + si] !== 1) { full = false; break; }
        if (full) into[tk] = 1;
      }
    }
  }
}

interface PlacedField extends GridGeometry {
  readonly kind: 'placed';
  readonly data: Uint8Array;
}
type DecodedField = { readonly kind: 'empty' } | { readonly kind: 'unplaceable' } | PlacedField;

function decodeField(raw: string, target: GridGeometry): DecodedField {
  if (!raw) return { kind: 'empty' };
  const full = /^c(\d+)@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\/(\d+)x(\d+):/.exec(raw);
  if (full) {
    const cell = Number(full[1]), originX = Number(full[2]), originZ = Number(full[3]);
    const width = Number(full[4]), height = Number(full[5]);
    const body = raw.slice(full[0].length);
    const n = width * height;
    if (n <= 0 || rleLength(body) !== n) return { kind: 'unplaceable' };
    const data = new Uint8Array(n);
    unrle(body, data);
    return { kind: 'placed', cell, originX, originZ, width, height, data };
  }
  const leg = /^c(\d+):/.exec(raw);
  const cell = leg ? Number(leg[1]) : 1;
  const body = leg ? raw.slice(leg[0].length) : raw;
  const total = rleLength(body);
  if (total <= 0) return { kind: 'unplaceable' };
  if (cell === target.cell && total === target.width * target.height) {
    const data = new Uint8Array(total);
    unrle(body, data);
    return { kind: 'placed', cell, originX: target.originX, originZ: target.originZ, width: target.width, height: target.height, data };
  }
  const hit = LEGACY_GEOMETRIES.find((g) => g.cell === cell && g.width * g.height === total);
  if (hit) {
    const data = new Uint8Array(total);
    unrle(body, data);
    return { kind: 'placed', ...hit, data };
  }
  return { kind: 'unplaceable' };
}

function rleLength(s: string): number {
  let total = 0;
  for (const run of s.split(',')) {
    if (!run) continue;
    const parts = run.split('x');
    if (parts.length !== 2) return -1;
    const v = Number(parts[0]), n = Number(parts[1]);
    if (!Number.isFinite(v) || !Number.isFinite(n) || n <= 0) return -1;
    total += n;
  }
  return total;
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
