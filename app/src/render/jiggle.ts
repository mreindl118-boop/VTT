// Jiggle: a spring on the soft parts of a miniature. A figure's bust carries a per-vertex weight (the `jig` attribute,
// written by kit/heroes.ts when heroOptions.jiggle is on); when its token is picked up, moved or set down the weighted
// points bounce on a damped spring for a second and settle. Nothing runs while nothing is bouncing.
import * as THREE from 'three';

interface Soft { mesh: THREE.Mesh; base: Float32Array }
interface Body { root: THREE.Object3D; parts: Soft[]; y: number; v: number; x: number; vx: number }

const K = 130, DAMP = 5, REST = 0.002;
/** Each weighted mesh's shape at rest, read the first time its figure is followed (a figure is followed as soon as it is
 *  built, at rest), so one followed again in the middle of a bounce never takes the bounce for its rest. */
const rests = new WeakMap<THREE.Mesh, Float32Array>();

export class Jiggle {
  private bodies = new Map<string, Body>();
  private raf = 0; private last = 0;
  constructor(private redraw: () => void) {}

  /** Follow a token's figure: every mesh in it that carries jiggle weights. The figure it already follows for that token
   *  (kept from one pass over the tokens to the next) keeps its spring, bouncing on. */
  track(id: string, root: THREE.Object3D): void {
    if (this.bodies.get(id)?.root === root) return;
    const parts: Soft[] = [];
    root.traverse((c) => {
      const m = c as THREE.Mesh; if (!m.isMesh || !m.geometry.attributes.jig) return;
      let base = rests.get(m); if (!base) rests.set(m, (base = Float32Array.from(m.geometry.attributes.position.array as Float32Array)));
      parts.push({ mesh: m, base });
    });
    if (parts.length) this.bodies.set(id, { root, parts, y: 0, v: 0, x: 0, vx: 0 }); else this.bodies.delete(id);
  }
  /** Stop following every token but these. */
  keepOnly(ids: ReadonlySet<string>): void { for (const id of [...this.bodies.keys()]) if (!ids.has(id)) this.bodies.delete(id); }
  /** Whether a token's figure is bouncing (exposed for tests). */
  bouncing(id: string): boolean { const b = this.bodies.get(id); return !!b && !!(b.y || b.v || b.x || b.vx); }
  /** Set a token bouncing: `up` and `side` are the kick's speeds. */
  kick(id: string, up = 3.2, side = 0): void {
    const b = this.bodies.get(id); if (!b) return;
    b.v += up; b.vx += side;
    if (!this.raf && typeof requestAnimationFrame === 'function') { this.last = performance.now(); this.raf = requestAnimationFrame(this.step); }
  }
  /** One spring step for a body (exposed for tests); true while it is still moving. */
  static advance(b: { y: number; v: number; x: number; vx: number }, dt: number): boolean {
    for (let n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n; n > 0; n--) {
      b.v += (-K * b.y - DAMP * b.v) * h; b.y += b.v * h;
      b.vx += (-K * 0.7 * b.x - DAMP * b.vx) * h; b.x += b.vx * h;
    }
    return Math.abs(b.y) + Math.abs(b.x) > REST || Math.abs(b.v) + Math.abs(b.vx) > 0.05;
  }
  private step = (now: number): void => {
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.raf = 0;
    let live = false;
    for (const b of this.bodies.values()) {
      if (!b.y && !b.v && !b.x && !b.vx) continue;
      const moving = Jiggle.advance(b, dt);
      if (!moving) { b.y = b.v = b.x = b.vx = 0; }
      for (const { mesh, base } of b.parts) {
        const p = mesh.geometry.attributes.position as THREE.BufferAttribute, w = mesh.geometry.attributes.jig as THREE.BufferAttribute, a = p.array as Float32Array;
        for (let i = 0; i < w.count; i++) { const k = w.getX(i); if (!k) continue; a[i * 3] = base[i * 3] + k * b.x; a[i * 3 + 1] = base[i * 3 + 1] + k * b.y; a[i * 3 + 2] = base[i * 3 + 2] - k * b.y * 0.3; }
        p.needsUpdate = true;
      }
      live ||= moving;
    }
    this.redraw();
    if (live) this.raf = requestAnimationFrame(this.step);
  };
}
