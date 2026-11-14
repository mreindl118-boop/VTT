// Cloth found inside a part it covers is lifted out past the part's surface along the line from the part's bone
// (kit/cloth.ts liftOut). Gear put away in several pieces (a blade at each hip) is one part in pieces: each piece's
// surface is lifted from that piece's own bone. Read from one bone, the lines from the first piece out to the far one's
// surface ran across the body and dragged any cloth they crossed toward the far piece.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { liftOut, type DrapeWorld } from '../app/src/kit/cloth';

const R = 0.05, CLEAR = 0.04;

/** A rod standing at x (from y -1 to 0): its bone, and points round its surface. */
function rod(x: number): { bone: THREE.Vector3[]; surface: THREE.Vector3[] } {
  const surface: THREE.Vector3[] = [];
  for (let y = -0.9; y <= -0.1 + 1e-9; y += 0.05) for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; surface.push(new THREE.Vector3(x + R * Math.cos(a), y, R * Math.sin(a))); }
  return { bone: [new THREE.Vector3(x, -1, 0), new THREE.Vector3(x, 0, 0)], surface };
}

/** A small square of cloth standing across the x axis at x (two triangles), from y -0.6 to -0.4 and z -0.1 to 0.1. */
function patch(x: number): { P: Float64Array; index: number[] } {
  return { P: new Float64Array([x, -0.6, -0.1, x, -0.6, 0.1, x, -0.4, 0.1, x, -0.4, -0.1]), index: [0, 1, 2, 0, 2, 3] };
}

/** The farthest any corner moved. */
const moved = (a: Float64Array, b: Float64Array) => { let m = 0; for (let k = 0; k < a.length; k += 3) m = Math.max(m, Math.hypot(a[k] - b[k], a[k + 1] - b[k + 1], a[k + 2] - b[k + 2])); return m; };

function lift(w: DrapeWorld, at: number): Float64Array {
  const { P, index } = patch(at);
  liftOut(P, index, ['stowed'], w, new THREE.Matrix4(), CLEAR, 0, 0);
  return P;
}

const world = (o: Partial<DrapeWorld>): DrapeWorld => ({ parts: new Map(), down: new THREE.Vector3(0, -1, 0), ...o });

describe('cloth lifted out of gear put away in pieces', () => {
  const A = rod(0.5), B = rod(-0.5);

  it('read from one bone, the far piece drags cloth between the pieces toward it (what pieces are for)', () => {
    const w = world({ bones: new Map([['stowed', A.bone]]), surface: new Map([['stowed', [...A.surface, ...B.surface]]]) });
    const P = lift(w, -0.25), still = patch(-0.25).P;
    expect(moved(P, still)).toBeGreaterThan(0.2);
    expect(P[0]).toBeLessThan(-0.45); // (out to the far piece's surface)
  });

  it('in pieces, cloth between them is left where it hangs', () => {
    const w = world({ bones: new Map([['stowed', A.bone]]), surface: new Map([['stowed', [...A.surface, ...B.surface]]]), pieces: new Map([['stowed', [A, B]]]) });
    for (const at of [-0.25, 0, 0.25]) expect(moved(lift(w, at), patch(at).P), `cloth at x ${at}`).toBe(0);
  });

  it('in pieces, cloth inside a piece is still lifted out past that piece', () => {
    const w = world({ pieces: new Map([['stowed', [A, B]]]) });
    for (const at of [-0.52, 0.52]) {
      const P = lift(w, at), out = Math.sign(at);
      // (out along the line from its own bone, to half the room past its surface)
      for (let k = 0; k < P.length; k += 3) expect(out * P[k], `cloth at x ${at}`).toBeCloseTo(0.5 + R + CLEAR / 2, 2);
    }
  });

  it('one piece lifts exactly as the part read from its bone', () => {
    const one = world({ pieces: new Map([['stowed', [B]]]) }), bone = world({ bones: new Map([['stowed', B.bone]]), surface: new Map([['stowed', B.surface]]) });
    for (const at of [-0.52, -0.48, -0.25]) expect(Array.from(lift(one, at))).toEqual(Array.from(lift(bone, at)));
  });
});
