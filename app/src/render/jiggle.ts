// Jiggle: a spring on the soft parts of a miniature. A figure's bust carries a per-vertex weight (the `jig` attribute,
// written by kit/heroes.ts when heroOptions.jiggle is on); when its token is picked up, moved or set down the weighted
// points bounce on a damped spring for a second and settle. Nothing runs while nothing is bouncing.
import * as THREE from 'three';

interface Soft { mesh: THREE.Mesh; base: Float32Array }
interface Body { parts: Soft[]; y: number; v: number; x: number; vx: number }

const K = 130, DAMP = 5, REST = 0.002;

export class Jiggle {
  private bodies = new Map<string, Body>();
  private raf = 0; private last = 0;
  constructor(private redraw: () => void) {}

  /** Follow a token's figure: every mesh in it that carries jiggle weights. */
  track(id: string, root: THREE.Object3D): void {
    const parts: Soft[] = [];
    root.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh && m.geometry.attributes.jig) parts.push({ mesh: m, base: Float32Array.from(m.geometry.attributes.position.array as Float32Array) }); });
    if (parts.length) this.bodies.set(id, { parts, y: 0, v: 0, x: 0, vx: 0 }); else this.bodies.delete(id);
  }
  clear(): void { this.bodies.clear(); }
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
