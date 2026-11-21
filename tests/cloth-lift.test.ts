// Cloth found inside a part it covers is lifted out past the part's surface along the line from the part's bone
// (kit/cloth.ts liftOut). Gear put away in several pieces (a blade at each hip) is one part in pieces: each piece's
// surface is lifted from that piece's own bone. Read from one bone, the lines from the first piece out to the far one's
// surface ran across the body and dragged any cloth they crossed toward the far piece. Cloth caught between a piece and
// the body goes out over all of the piece: a cloak that swung in under the tip of a dagger at the hip was left there,
// as the lines in to the dagger's inner side point back toward the body and were never followed.
// Cloth caught in a part that lies outside it (a forearm laid across a gown, a hand at the side of a skirt) is laid under
// the part instead (layUnder): in toward the garment's axis, never out over the part, and only where it lies deeper in
// the part than its clearance, or than the cloth check lets skin lie past cloth where that is less (cloth that only
// grazes a fingertip is left where it hangs). Left alone down to its whole clearance, cloth could lie as deep in a hand
// at the side of a skirt as the skirt's 0.04, past the 0.03 the cloth check allows. A closed garment's seam, its first
// and last columns, stays closed in both: moved a column at a time, the two columns of a seam beside a limb went their
// own ways.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { layUnder, liftOut, type DrapeWorld } from '../app/src/kit/cloth';

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

/** How many of a piece's lines, from its bone out to each point of its surface, the cloth crosses. */
function crossings(P: Float64Array, index: number[], piece: { bone: THREE.Vector3[]; surface: THREE.Vector3[] }): number {
  const tri = (t: number) => [0, 1, 2].map((k) => new THREE.Vector3(P[index[t * 3 + k] * 3], P[index[t * 3 + k] * 3 + 1], P[index[t * 3 + k] * 3 + 2]));
  const line = new THREE.Line3(), bone = new THREE.Line3(piece.bone[0], piece.bone[1]), hit = new THREE.Vector3(); let n = 0;
  for (const p of piece.surface) {
    line.set(bone.closestPointToPoint(p, true, new THREE.Vector3()), p);
    for (let t = 0; t < index.length / 3; t++) { const [a, b, c] = tri(t); if (new THREE.Ray(line.start, line.delta(new THREE.Vector3()).normalize()).intersectTriangle(a, b, c, false, hit) && hit.distanceTo(line.start) < line.distance()) { n++; break; } }
  }
  return n;
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

  it('cloth caught between a piece and the body goes out over all of it, not left through its inner side', () => {
    const w = world({ pieces: new Map([['stowed', [A, B]]]) });
    for (const at of [-0.48, 0.48]) {
      const { index } = patch(at), P = lift(w, at), still = patch(at).P, piece = at < 0 ? B : A;
      expect(crossings(still, index, piece), `cloth at x ${at}, as it hung`).toBeGreaterThan(0);
      expect(crossings(P, index, piece), `cloth at x ${at}`).toBe(0);
      // (out past the piece, never in toward the body under it)
      for (let k = 0; k < P.length; k += 3) expect(Math.hypot(P[k], P[k + 2]), `cloth at x ${at}`).toBeGreaterThan(0.5 + R);
    }
  });

  it('an empty list of pieces falls back to the part read from its bone', () => {
    const none = world({ bones: new Map([['stowed', B.bone]]), surface: new Map([['stowed', B.surface]]), pieces: new Map([['stowed', []]]) });
    const bone = world({ bones: new Map([['stowed', B.bone]]), surface: new Map([['stowed', B.surface]]) });
    expect(moved(lift(none, -0.52), patch(-0.52).P)).toBeGreaterThan(0.04);
    expect(Array.from(lift(none, -0.52))).toEqual(Array.from(lift(bone, -0.52)));
  });

  it('one piece lifts exactly as the part read from its bone', () => {
    const one = world({ pieces: new Map([['stowed', [B]]]) }), bone = world({ bones: new Map([['stowed', B.bone]]), surface: new Map([['stowed', B.surface]]) });
    for (const at of [-0.52, -0.48, -0.25]) expect(Array.from(lift(one, at))).toEqual(Array.from(lift(bone, at)));
  });
});

describe('cloth laid under a part that lies outside it', () => {
  // a forearm lying level across the front of the cloth, along x, its bone 0.3 out from the axis (the y axis)
  const F = 0.1, AT = 0.3, bone = [new THREE.Vector3(-0.4, -0.5, AT), new THREE.Vector3(0.4, -0.5, AT)], surface: THREE.Vector3[] = [];
  for (let x = -0.35; x <= 0.35 + 1e-9; x += 0.05) for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; surface.push(new THREE.Vector3(x, -0.5 + F * Math.cos(a), AT + F * Math.sin(a))); }
  const w = world({ bones: new Map([['forearmR', bone]]), surface: new Map([['forearmR', surface]]) });
  /** A strip of cloth facing out along z at z (two triangles, as narrow as a garment's), from x -0.025 to 0.025 and
   *  y -0.6 to -0.4 (the forearm's height). */
  const sheet = (z: number) => new Float64Array([-0.025, -0.6, z, 0.025, -0.6, z, 0.025, -0.4, z, -0.025, -0.4, z]);
  const lay = (z: number) => { const P = sheet(z); layUnder(P, [0, 1, 2, 0, 2, 3], ['forearmR'], w, new THREE.Matrix4(), CLEAR, 0, 0); return P; };

  it('cloth caught in the forearm, over its bone or under it, ends under the forearm (between it and the axis)', () => {
    for (const z of [AT + 0.05, AT + 0.02, AT - 0.03]) {
      const P = lay(z);
      for (let k = 0; k < P.length; k += 3) {
        expect(Math.hypot(P[k], P[k + 2]), `cloth at z ${z}`).toBeLessThan(Math.hypot(P[k], AT - F)); // (inside the underside)
        expect(Math.hypot(P[k], P[k + 2]), `cloth at z ${z}`).toBeGreaterThan(Math.hypot(P[k], AT - F - CLEAR)); // (squeezed close under it, not thrown in)
        expect(P[k + 1], `cloth at z ${z}`).toBe(sheet(z)[k + 1]); // (straight in: never up or down)
      }
    }
  });

  it('cloth only grazing the forearm, or clear of it, is left where it hangs (never pulled out over it)', () => {
    for (const z of [AT + F - CLEAR / 2, AT + F + 0.05, AT - F - 0.05, AT + 0.3]) expect(moved(lay(z), sheet(z)), `cloth at z ${z}`).toBe(0);
  });

  it('on a figure of a given size, cloth deeper in the forearm than the cloth check lets skin lie past cloth, though within its clearance, is laid under it', () => {
    // (size 1: the check lets skin lie 0.03 past cloth, short of the clearance, 0.04)
    const sized = world({ bones: w.bones, surface: w.surface, size: 1 }), laySized = (z: number) => { const P = sheet(z); layUnder(P, [0, 1, 2, 0, 2, 3], ['forearmR'], sized, new THREE.Matrix4(), CLEAR, 0, 0); return P; };
    const deep = AT + F - 0.035, P = laySized(deep);
    expect(moved(lay(deep), sheet(deep))).toBe(0); // (no size given: within the clearance, so only grazing)
    for (let k = 0; k < P.length; k += 3) expect(Math.hypot(P[k], P[k + 2])).toBeLessThan(Math.hypot(P[k], AT - F));
    expect(moved(laySized(AT + F - 0.025), sheet(AT + F - 0.025))).toBe(0); // (within what the check allows: grazing)
  });

  it('a part not named outside the cloth is left alone', () => {
    const P = sheet(AT + 0.02); layUnder(P, [0, 1, 2, 0, 2, 3], ['handR'], w, new THREE.Matrix4(), CLEAR, 0, 0);
    expect(moved(P, sheet(AT + 0.02))).toBe(0);
  });
});

describe("a closed garment's seam stays closed", () => {
  // a ring of cloth round the y axis, 0.3 out, from y -0.6 to -0.4: nine columns, the first at the front (+z) and the
  // last on it again (the seam), two rows; and a rod standing at 22.5 degrees round from the seam, so that of the two
  // cells beside the seam it runs through only the first
  const C = 9, RT = 0.3, TH = Math.PI / 8;
  const ring = () => {
    const P = new Float64Array(C * 2 * 3), index: number[] = [];
    for (let r = 0; r < 2; r++) for (let c = 0; c < C; c++) { const a = (c % (C - 1)) * (2 * Math.PI) / (C - 1), k = (r * C + c) * 3; P[k] = RT * Math.sin(a); P[k + 1] = -0.6 + 0.2 * r; P[k + 2] = RT * Math.cos(a); }
    for (let c = 0; c + 1 < C; c++) index.push(c, c + 1, C + c + 1, c, C + c + 1, C + c);
    return { P, index };
  };
  const rodAt = (out: number, fr: number) => {
    const x = out * Math.sin(TH), z = out * Math.cos(TH), surface: THREE.Vector3[] = [];
    for (let y = -0.9; y <= -0.1 + 1e-9; y += 0.05) for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; surface.push(new THREE.Vector3(x + fr * Math.cos(a), y, z + fr * Math.sin(a))); }
    return { bone: [new THREE.Vector3(x, -1, z), new THREE.Vector3(x, 0, z)], surface };
  };
  /** How far apart the seam's two columns lie, at most, and how far its first column moved. */
  const seamOf = (P: Float64Array) => { let gap = 0, went = 0; const P0 = ring().P; for (let r = 0; r < 2; r++) { const a = r * C * 3, b = (r * C + C - 1) * 3; gap = Math.max(gap, Math.hypot(P[a] - P[b], P[a + 1] - P[b + 1], P[a + 2] - P[b + 2])); went = Math.max(went, Math.hypot(P[a] - P0[a], P[a + 1] - P0[a + 1], P[a + 2] - P0[a + 2])); } return { gap, went }; };

  it('lifted out of a part it covers on one side of the seam, both its columns go out together', () => {
    const thigh = rodAt(0.27, 0.06), w = world({ bones: new Map([['thighR', thigh.bone]]), surface: new Map([['thighR', thigh.surface]]) });
    const open = ring(); liftOut(open.P, open.index, ['thighR'], w, new THREE.Matrix4(), CLEAR, 0, 0);
    expect(seamOf(open.P).gap).toBeGreaterThan(0.01); // (each column on its own: the seam opens)
    const shut = ring(); liftOut(shut.P, shut.index, ['thighR'], w, new THREE.Matrix4(), CLEAR, 0, 0, undefined, undefined, C);
    expect(seamOf(shut.P).went).toBeGreaterThan(0.01);
    expect(seamOf(shut.P).gap).toBeLessThan(1e-9);
    expect(crossings(shut.P, shut.index, thigh)).toBe(0);
  });

  it('laid under a part outside it on one side of the seam, both its columns go in together', () => {
    const arm = rodAt(0.3, 0.08), w = world({ bones: new Map([['forearmR', arm.bone]]), surface: new Map([['forearmR', arm.surface]]) });
    const open = ring(); layUnder(open.P, open.index, ['forearmR'], w, new THREE.Matrix4(), CLEAR, 0, 0);
    expect(seamOf(open.P).gap).toBeGreaterThan(0.01); // (each column on its own: the seam opens)
    const shut = ring(); layUnder(shut.P, shut.index, ['forearmR'], w, new THREE.Matrix4(), CLEAR, 0, 0, C);
    expect(seamOf(shut.P).went).toBeGreaterThan(0.01);
    expect(seamOf(shut.P).gap).toBeLessThan(1e-9);
    expect(crossings(shut.P, shut.index, arm)).toBe(0);
  });
});
