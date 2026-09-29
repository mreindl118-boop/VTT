// Per-level explored memory + current visibility at 1-ft resolution.
import { bounds, pointInPolygon, type Polygon } from './geometry';
import { canSee, sightBlockers, type Viewer } from './light';
import type { Ambient, LightSource, Wall } from './schema';

export const enum Cov { Unexplored = 0, Explored = 1, Visible = 2 }

export class CoverageMap {
  readonly seen: Uint8Array;
  readonly visible: Uint8Array;
  /** DM-painted reveal (acts as permanently visible for players). 1 = revealed, 2 = forced fog. */
  readonly paint: Uint8Array;

  constructor(readonly originX: number, readonly originZ: number, readonly width: number, readonly height: number) {
    const n = width * height;
    this.seen = new Uint8Array(n);
    this.visible = new Uint8Array(n);
    this.paint = new Uint8Array(n);
  }

  static forPolygons(polys: Polygon[], pad = 2): CoverageMap {
    const b = bounds(polys);
    const ox = Math.floor(b.minX) - pad, oz = Math.floor(b.minZ) - pad;
    return new CoverageMap(ox, oz, Math.ceil(b.maxX) + pad - ox, Math.ceil(b.maxZ) + pad - oz);
  }

  idx(x: number, z: number): number {
    const i = Math.floor(x - this.originX), j = Math.floor(z - this.originZ);
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
    const b = bounds([poly]);
    for (let z = Math.floor(b.minZ); z < Math.ceil(b.maxZ); z++)
      for (let x = Math.floor(b.minX); x < Math.ceil(b.maxX); x++) {
        if (!pointInPolygon([x + 0.5, z + 0.5], poly)) continue;
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
    for (let z = Math.floor(cz - r); z <= cz + r; z++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) > r) continue;
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
    for (let j = 0; j < this.height; j++)
      for (let i = 0; i < this.width; i++) {
        const x = this.originX + i + 0.5, z = this.originZ + j + 0.5;
        if (!floor.some((p) => pointInPolygon([x, z], p))) continue;
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
    return { seen: rle(this.seen), paint: rle(this.paint) };
  }
  load(s: { seen: string; paint: string }): void {
    unrle(s.seen, this.seen); unrle(s.paint, this.paint);
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
