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
// On a body laid out, cloth found in what it may not lie in though it covers none of it (the head with the hair on it)
// is put out of it (keepOut): straight out of it, or, where that would take it into the floor, onto the floor and along
// it, out from under the head; but never into what it covers, which wins: it stops short of that. Left in the head, a
// capelet cut where the head came to lie on a body fallen on its side ran through the skull, and the hair laid on the
// head after the cloth had nowhere to go; put out of it straight, it went into the upper arm the head lay on.
// Cloth so put out of the head that still runs through what it covers between two of its points (an arm come up
// through it beside the head) settles off it the least way (liftOff): the corners of a triangle the line from the
// part's bone out to its surface crosses go out along the line, each by its share of the crossing, the corner nearest
// the furthest, together just far enough to take the crossing half the clearance past the surface; never down into the
// floor, and never further than a limit given allows. Lifted out whole (liftOut), every corner of the triangle went the
// whole way, and pushed cloth back into the head; left in, the arm stood shallowly through the capelet. The corners go
// in turn, each as far as the limit lets it with those before it where they went (a limit on the faces round a corner,
// the room off the head, reads them all), a closed garment's seam as one; and a crossing taken only partway, a corner of
// it fixed or its move cut short, is held and passed over after: settled over and over, its free corners were thrown
// out a share more each time; and a seam's two columns move and are cut as one from whichever side the part lies. Down
// toward the floor too, where the part stands its clearance or more over it: there is room under it for the cloth (a
// pauldron above the floor stood through a capelet where the lines out to it ran down). And between the cloth's
// points, where the part's faces are read (facesNear): a face standing through the cloth between them (a pauldron's rim
// through a fold, missed by every line out to the part's points) takes the cloth out past it, along the way out from
// the bone through the cloth, under the same floor.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { facesNear, keepOut, layUnder, liftOff, liftOut, type DrapeWorld } from '../app/src/kit/cloth';

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
  const rodAt = (out: number, fr: number, th = TH) => {
    const x = out * Math.sin(th), z = out * Math.cos(th), surface: THREE.Vector3[] = [];
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

  it('settled off a part it covers on one side of the seam, both its columns go out together', () => {
    const thigh = rodAt(0.27, 0.06), w = world({ bones: new Map([['thighR', thigh.bone]]), surface: new Map([['thighR', thigh.surface]]) }), down = new THREE.Vector3(0, -1, 0);
    // (a few times over, as a garment settles)
    const settle = (P: Float64Array, index: number[], seam?: number) => { for (let i = 0; i < 8 && liftOff(P, index, ['thighR'], w, new THREE.Matrix4(), CLEAR, () => false, down, seam); i++); };
    const open = ring(); settle(open.P, open.index);
    expect(seamOf(open.P).gap).toBeGreaterThan(0.01); // (each column on its own: the seam opens)
    const shut = ring(); settle(shut.P, shut.index, C);
    expect(seamOf(shut.P).went).toBeGreaterThan(0.01);
    expect(seamOf(shut.P).gap).toBeLessThan(1e-9);
    expect(crossings(shut.P, shut.index, thigh)).toBe(0);
    // (settled once, from either side of the seam, its two columns go as far as the further of the two goes on its own,
    // once: no further, as they would moved once for each)
    for (const th of [TH, -TH]) {
      const rod = rodAt(0.27, 0.06, th), w2 = world({ bones: new Map([['thighR', rod.bone]]), surface: new Map([['thighR', rod.surface]]) }), P0 = ring().P;
      const one = ring(), two = ring(); liftOff(one.P, one.index, ['thighR'], w2, new THREE.Matrix4(), CLEAR, () => false, down); liftOff(two.P, two.index, ['thighR'], w2, new THREE.Matrix4(), CLEAR, () => false, down, C);
      const off = (P: Float64Array, k: number) => Math.hypot(P[k * 3] - P0[k * 3], P[k * 3 + 1] - P0[k * 3 + 1], P[k * 3 + 2] - P0[k * 3 + 2]);
      for (let r = 0; r < 2; r++) { const a = r * C, b = r * C + C - 1, most = Math.max(off(one.P, a), off(one.P, b)); expect(most, `${th}, row ${r}`).toBeGreaterThan(0.001); for (const k of [a, b]) expect(off(two.P, k), `${th}, row ${r}`).toBeCloseTo(most, 12); }
    }
  });

  it('settled off a part on one side of the seam only as far as a limit lets it, both its columns go out together, cut alike', () => {
    const thigh = rodAt(0.27, 0.06), w = world({ bones: new Map([['thighR', thigh.bone]]), surface: new Map([['thighR', thigh.surface]]) }), down = new THREE.Vector3(0, -1, 0);
    // (the seam's last column no further than 0.005 from where it hung: the first, beside the part, goes no further either)
    const P0 = ring().P, may = (k: number, to: THREE.Vector3) => k % C !== C - 1 || Math.hypot(to.x - P0[k * 3], to.y - P0[k * 3 + 1], to.z - P0[k * 3 + 2]) <= 0.005;
    const shut = ring(); for (let i = 0; i < 8 && liftOff(shut.P, shut.index, ['thighR'], w, new THREE.Matrix4(), CLEAR, () => false, down, C, may); i++);
    expect(seamOf(shut.P).gap).toBeLessThan(1e-9);
    expect(seamOf(shut.P).went).toBeGreaterThan(0.001); expect(seamOf(shut.P).went).toBeLessThanOrEqual(0.005 + 1e-9);
  });

  it('settled off a part on the seam\'s other side as far as a limit on its first column lets it, both columns go out together, cut alike, and held so', () => {
    // (the rod 22.5 degrees round the other way, beside the last column; the first column no further than 0.005 from
    // where it hung: the last, beside the part, goes no further either, and the crossings so cut are passed over after)
    const thigh = rodAt(0.27, 0.06, -TH), w = world({ bones: new Map([['thighR', thigh.bone]]), surface: new Map([['thighR', thigh.surface]]) }), down = new THREE.Vector3(0, -1, 0);
    const P0 = ring().P, may = (k: number, to: THREE.Vector3) => k % C !== 0 || Math.hypot(to.x - P0[k * 3], to.y - P0[k * 3 + 1], to.z - P0[k * 3 + 2]) <= 0.005;
    const shut = ring(), held = new Uint8Array(shut.index.length / 3), last = (P: Float64Array) => { let m = 0; for (let r = 0; r < 2; r++) { const b = (r * C + C - 1) * 3; m = Math.max(m, Math.hypot(P[b] - P0[b], P[b + 1] - P0[b + 1], P[b + 2] - P0[b + 2])); } return m; };
    expect(liftOff(shut.P, shut.index, ['thighR'], w, new THREE.Matrix4(), CLEAR, () => false, down, C, may, held)).toBe(true);
    expect(held.some((h) => h === 2)).toBe(true);
    for (let i = 0; i < 7; i++) liftOff(shut.P, shut.index, ['thighR'], w, new THREE.Matrix4(), CLEAR, () => false, down, C, may, held);
    expect(seamOf(shut.P).gap).toBeLessThan(1e-9);
    expect(last(shut.P)).toBeGreaterThan(0.001); expect(last(shut.P)).toBeLessThanOrEqual(0.005 + 1e-9);
    // (with no limit, the same crossings go the whole way out, the seam closed)
    const free = ring(); for (let i = 0; i < 8 && liftOff(free.P, free.index, ['thighR'], w, new THREE.Matrix4(), CLEAR, () => false, down, C); i++);
    expect(seamOf(free.P).gap).toBeLessThan(1e-9); expect(last(free.P)).toBeGreaterThan(0.01); expect(crossings(free.P, free.index, thigh)).toBe(0);
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

describe('cloth put out of what no cloth lies in, on a body laid out', () => {
  // a ball 0.3 across standing on the floor (y 0, the way down -y) a little sunk in it, as a head on the floor is with
  // the room for its hair round it: its middle at y 0.2
  const C0 = new THREE.Vector3(0, 0.2, 0), RB = 0.3, DOWN = new THREE.Vector3(0, -1, 0);
  const ball = (p: THREE.Vector3, out: THREE.Vector3) => { out.copy(p).sub(C0); const r = out.length(); out.normalize(); return RB - r; };
  const put = (pts: number[], toWorld = new THREE.Matrix4()) => { const P = new Float64Array(pts); keepOut(P, [ball], toWorld, toWorld.clone().invert(), DOWN, 0, CLEAR); return P; };

  it('cloth in it goes straight out of it, half its clearance past it', () => {
    const P = put([0.1, 0.35, 0.05]), q = new THREE.Vector3(P[0], P[1], P[2]);
    expect(q.distanceTo(C0)).toBeCloseTo(RB + CLEAR / 2, 6);
    expect(q.clone().sub(C0).normalize().dot(new THREE.Vector3(0.1, 0.15, 0.05).normalize())).toBeCloseTo(1, 6); // (straight out from the middle)
  });

  it('cloth that way would go into the floor lies on the floor, out from under it', () => {
    const P = put([0.1, 0.05, 0]);
    expect(P[1]).toBeCloseTo(0, 9); // (on the floor, not in it)
    expect(Math.hypot(P[0], P[1] - 0.2, P[2])).toBeGreaterThanOrEqual(RB + CLEAR / 2 - 1e-9); // (and out of the ball)
    expect(P[0]).toBeGreaterThan(0.1); // (out along the floor the way it was going)
    expect(Math.abs(P[2])).toBeLessThan(1e-9);
  });

  it('cloth clear of it is left where it is, to the last digit, in whatever frame it is read', () => {
    // (the cloth's own frame turned and moved off the world's: a point sent to the world and back would not come back
    // to the last digit)
    const toWorld = new THREE.Matrix4().makeRotationY(0.7).setPosition(1, 0, -2), back = toWorld.clone().invert(), pts: number[] = [];
    for (const [x, y, z] of [[0.6, 0.1, 0], [0, 0.55, 0.12], [-0.2, 0, 0.3]]) { const v = new THREE.Vector3(x, y, z).applyMatrix4(back); pts.push(v.x, v.y, v.z); }
    expect(Array.from(put(pts, toWorld))).toEqual(pts);
  });

  // what the cloth covers, a ball beside it (an upper arm the head has come to rest on)
  const arm = (c: THREE.Vector3, r: number) => (p: THREE.Vector3, out: THREE.Vector3) => { out.copy(p).sub(c); const d = out.length(); out.normalize(); return r - d; };
  const keep = (pts: number[], f: (p: THREE.Vector3, out: THREE.Vector3) => number) => { const P = new Float64Array(pts), m = new THREE.Matrix4(); keepOut(P, [ball], m, m, DOWN, 0, CLEAR, [f]); return P; };

  it('never puts cloth into what it covers: where the way out runs into it, the cloth stops half its clearance short of it', () => {
    // (straight out of the ball would be x 0.32, in the arm, which reaches in to x 0.30)
    const A = arm(new THREE.Vector3(0.45, 0.2, 0), 0.15), P = keep([0.25, 0.2, 0], A), q = new THREE.Vector3(P[0], P[1], P[2]), o = new THREE.Vector3();
    expect(q.distanceTo(new THREE.Vector3(0.28, 0.2, 0))).toBeLessThan(1e-6);
    expect(A(q, o)).toBeLessThanOrEqual(-CLEAR / 2 + 1e-9);
    // (clear of the arm, it goes the whole way out, as with nothing covered)
    const free = keep([0, 0.35, 0.05], A), direct = put([0, 0.35, 0.05]);
    expect(Array.from(free)).toEqual(Array.from(direct));
  });

  it('never takes cloth deeper into what it covers than it lay, and along the floor stops short of what it covers lying there', () => {
    // (already in the arm: no way out of the ball takes it anywhere but deeper, so it stays)
    const A = arm(new THREE.Vector3(0.42, 0.2, 0), 0.15), pts = [0.3, 0.2, 0];
    expect(Array.from(keep(pts, A))).toEqual(pts);
    // (onto the floor and along it, as above, until it would come within half its clearance of an arm on the floor)
    const B = arm(new THREE.Vector3(0.3, 0.05, 0), 0.08), P = keep([0.1, 0.05, 0], B), q = new THREE.Vector3(P[0], P[1], P[2]), o = new THREE.Vector3();
    expect(P[1]).toBeCloseTo(0, 9);
    expect(B(q, o)).toBeLessThanOrEqual(-CLEAR / 2);
    expect(P[0]).toBeGreaterThan(0.15); expect(P[0]).toBeLessThan(0.2175);
  });

  it('reads the cloth in its own frame: a garment hung on a chest turned and moved goes out the same', () => {
    const toWorld = new THREE.Matrix4().makeRotationY(0.7).setPosition(1, 0, -2), back = toWorld.clone().invert();
    const w = new THREE.Vector3(0.1, 0.35, 0.05), local = w.clone().applyMatrix4(back), P = put([local.x, local.y, local.z], toWorld);
    const q = new THREE.Vector3(P[0], P[1], P[2]).applyMatrix4(toWorld), direct = put([w.x, w.y, w.z]);
    expect(q.distanceTo(new THREE.Vector3(direct[0], direct[1], direct[2]))).toBeLessThan(1e-9);
  });
});

describe('cloth settled off what it covers, the least way', () => {
  // a part's bone up the y axis and one point of its surface 0.1 out along x; a triangle of cloth standing across the
  // line between them halfway out, at x 0.05, the line through it a quarter of the way along each of its first two
  // sides (so its first corner has half of the crossing, the others a quarter each)
  const bone = [new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 1, 0)], at = new THREE.Vector3(0.1, 0, 0), DOWN = new THREE.Vector3(0, -1, 0);
  const w = world({ bones: new Map([['upperArmL', bone]]), surface: new Map([['upperArmL', [at]]]) });
  const tri = (x = 0.05) => new Float64Array([x, -0.05, -0.05, x, 0.15, -0.05, x, -0.05, 0.15]);
  const settle = (P: Float64Array, o: { fixed?: (k: number) => boolean; may?: (k: number, to: THREE.Vector3) => boolean; down?: THREE.Vector3; toLocal?: THREE.Matrix4; held?: Uint8Array; more?: Parameters<typeof liftOff>[11] } = {}) =>
    liftOff(P, [0, 1, 2], ['upperArmL'], w, o.toLocal ?? new THREE.Matrix4(), CLEAR, o.fixed ?? (() => false), o.down ?? DOWN, undefined, o.may, o.held, o.more);
  /** Where the line crossed the triangle, as it lies now. */
  const crossed = (P: Float64Array) => [0, 1, 2].map((i) => P[i] * 0.5 + P[3 + i] * 0.25 + P[6 + i] * 0.25);

  it('takes the crossing half the clearance past the surface, each corner by its share, the nearest the furthest', () => {
    const P = tri(), still = tri();
    expect(settle(P)).toBe(true);
    // (the least move that does: each corner by its share of the crossing over the sum of the shares squared)
    const need = 0.05 + CLEAR / 2, sum = 0.5 ** 2 + 2 * 0.25 ** 2;
    expect(P[0] - still[0]).toBeCloseTo((need * 0.5) / sum, 9);
    for (const k of [3, 6]) expect(P[k] - still[k]).toBeCloseTo((need * 0.25) / sum, 9);
    for (const k of [1, 2, 4, 5, 7, 8]) expect(P[k]).toBe(still[k]); // (straight out along the line)
    expect(crossed(P)[0]).toBeCloseTo(0.1 + CLEAR / 2, 9);
    // (lifted out whole, each corner went the whole way: more than the least, in all)
    const whole = tri(); liftOut(whole, [0, 1, 2], ['upperArmL'], w, new THREE.Matrix4(), CLEAR, 0, 0);
    let a = 0, b = 0; for (let k = 0; k < 9; k++) { a += (P[k] - still[k]) ** 2; b += (whole[k] - still[k]) ** 2; }
    expect(b).toBeGreaterThan(a * 1.1);
  });

  it('a corner fixed stays, the others going only their own shares: a crossing it bears most of never throws them out', () => {
    const need = 0.05 + CLEAR / 2, P = tri(), still = tri();
    expect(settle(P, { fixed: (k) => k === 0 })).toBe(true);
    expect(Array.from(P.subarray(0, 3))).toEqual(Array.from(still.subarray(0, 3)));
    for (const k of [3, 6]) expect(P[k] - still[k]).toBeCloseTo((need * 0.25) / (0.5 ** 2 + 2 * 0.25 ** 2), 9);
    // (the line through the triangle a twentieth of the way along each of its first two sides: its first corner has nine
    // tenths of the crossing; taking all of it on the others would throw them out ten times as far as it needs)
    const near = new Float64Array([0.05, -0.01, -0.01, 0.05, 0.19, -0.01, 0.05, -0.01, 0.19]), was = near.slice();
    expect(settle(near, { fixed: (k) => k === 0 })).toBe(true);
    for (const k of [3, 6]) { expect(near[k] - was[k]).toBeCloseTo((need * 0.05) / (0.9 ** 2 + 2 * 0.05 ** 2), 9); expect(near[k] - was[k]).toBeLessThan(need); }
  });

  it('never down into the floor: cloth between a limb resting on the floor and the floor under it stays', () => {
    // (the floor the way the line runs, +x: the cloth lies under the part, on the floor)
    const P = tri();
    expect(settle(P, { down: new THREE.Vector3(1, 0, 0) })).toBe(false);
    expect(Array.from(P)).toEqual(Array.from(tri()));
    // (the floor the other way: the line runs up off it, and the cloth goes)
    expect(settle(tri(), { down: new THREE.Vector3(-1, 0, 0) })).toBe(true);
  });

  it('down toward the floor too where the part stands its clearance or more over the floor: there is room under it for the cloth', () => {
    // (the floor the way the line runs, +x, a little more than the clearance past the surface: the cloth goes as it goes
    // off a floor the other way)
    const DX = new THREE.Vector3(1, 0, 0), free = tri(), off = tri();
    expect(settle(free, { down: DX, more: { floor: 0.1 + CLEAR * 1.01 } })).toBe(true);
    expect(settle(off, { down: new THREE.Vector3(-1, 0, 0) })).toBe(true);
    for (let k = 0; k < 9; k++) expect(free[k]).toBeCloseTo(off[k], 12);
    // (the floor nearer the part than that, or none given: the cloth stays where it lies, under the part)
    for (const more of [{ floor: 0.1 + CLEAR * 0.99 }, {}]) { const P = tri(); expect(settle(P, { down: DX, more }), JSON.stringify(more)).toBe(false); expect(Array.from(P)).toEqual(Array.from(tri())); }
    // (the room asked for, where it is given, in place of the clearance)
    expect(settle(tri(), { down: DX, more: { floor: 0.1 + CLEAR * 0.51, room: CLEAR * 0.5 } })).toBe(true);
    expect(settle(tri(), { down: DX, more: { floor: 0.1 + CLEAR * 0.49, room: CLEAR * 0.5 } })).toBe(false);
  });

  it('a move the limit refuses is cut to as much of it as the limit allows', () => {
    const P = tri(), still = tri();
    expect(settle(P, { may: (_k, to) => to.x <= 0.1 })).toBe(true);
    expect(P[0]).toBeLessThanOrEqual(0.1); expect(P[0]).toBeCloseTo(0.1, 5); // (the first corner stopped at the limit)
    for (const k of [3, 6]) expect(P[k] - still[k]).toBeCloseTo(((0.05 + CLEAR / 2) * 0.25) / (0.5 ** 2 + 2 * 0.25 ** 2), 9); // (the others go their whole share)
    // (a limit that allows nothing: nothing moves)
    const Q = tri();
    expect(settle(Q, { may: () => false })).toBe(false);
    expect(Array.from(Q)).toEqual(Array.from(tri()));
  });

  it('moves the corners in turn, the limit reading those moved before where they went: a limit on the whole face cuts the last', () => {
    // (the face's middle no further out than x 0.1: the first two corners go their whole shares, which leave the third
    // only as far as brings the middle there; read with the first two where they lay, it would go its whole share too)
    const need = 0.05 + CLEAR / 2, sum = 0.5 ** 2 + 2 * 0.25 ** 2, P = tri(), still = tri(), asked: number[] = [];
    const may = (k: number, to: THREE.Vector3) => { asked.push(k); let x = 0; for (let i = 0; i < 3; i++) x += i === k ? to.x : P[i * 3]; return x / 3 <= 0.1; };
    expect(settle(P, { may })).toBe(true);
    expect(P[0] - still[0]).toBeCloseTo((need * 0.5) / sum, 9);
    expect(P[3] - still[3]).toBeCloseTo((need * 0.25) / sum, 9);
    expect(P[0] + P[3] + P[6]).toBeLessThanOrEqual(0.3 + 1e-12); expect(P[6]).toBeCloseTo(0.3 - P[0] - P[3], 5);
    expect(P[6] - still[6]).toBeGreaterThan(0); expect(P[6] - still[6]).toBeLessThan((need * 0.25) / sum - 0.01);
    expect(asked[0]).toBe(0); expect(asked.includes(1) && asked.includes(2)).toBe(true); expect(asked.indexOf(2)).toBeGreaterThan(asked.lastIndexOf(1));
  });

  it('holds a crossing taken only partway and passes it over after: settled over and over, its free corners go out their one share', () => {
    const need = 0.05 + CLEAR / 2, share = (need * 0.25) / (0.5 ** 2 + 2 * 0.25 ** 2), still = tri();
    // (a corner fixed: held as such, and passed over the times after)
    const P = tri(), held = new Uint8Array(1);
    expect(settle(P, { fixed: (k) => k === 0, held })).toBe(true);
    expect(held[0]).toBe(1);
    const once = P.slice();
    for (let i = 0; i < 7; i++) expect(settle(P, { fixed: (k) => k === 0, held })).toBe(false);
    expect(Array.from(P)).toEqual(Array.from(once));
    for (const k of [3, 6]) expect(P[k] - still[k]).toBeCloseTo(share, 9);
    // (not held, each time over threw them out a share more)
    const Q = tri(); for (let i = 0; i < 8; i++) settle(Q, { fixed: (k) => k === 0 });
    expect(Q[3] - still[3]).toBeGreaterThan(share * 1.5);
    // (a move the limit cut: held as such, and passed over after)
    const L = tri(), cut = new Uint8Array(1), may = (_k: number, to: THREE.Vector3) => to.x <= 0.1;
    expect(settle(L, { may, held: cut })).toBe(true);
    expect(cut[0]).toBe(2);
    const first = L.slice();
    expect(settle(L, { may, held: cut })).toBe(false);
    expect(Array.from(L)).toEqual(Array.from(first));
    // (a crossing taken the whole way out is not held)
    const F = tri(), free = new Uint8Array(1);
    expect(settle(F, { held: free })).toBe(true);
    expect(free[0]).toBe(0);
  });

  it('cloth past the surface, or behind the bone, is left where it is', () => {
    for (const x of [0.15, -0.05]) { const P = tri(x); expect(settle(P), `cloth at x ${x}`).toBe(false); expect(Array.from(P)).toEqual(Array.from(tri(x))); }
  });

  it('reads the cloth in its own frame: cloth on a body turned and moved settles the same', () => {
    const toWorld = new THREE.Matrix4().makeRotationY(0.7).setPosition(1, 0, -2), back = toWorld.clone().invert(), direct = tri();
    settle(direct);
    const P = tri(), v = new THREE.Vector3();
    // (the part where the cloth's own frame puts it in the world)
    const moved = world({ bones: new Map([['upperArmL', bone.map((p) => p.clone().applyMatrix4(toWorld))]]), surface: new Map([['upperArmL', [at.clone().applyMatrix4(toWorld)]]]) });
    expect(liftOff(P, [0, 1, 2], ['upperArmL'], moved, back, CLEAR, () => false, DOWN, undefined)).toBe(true);
    for (let k = 0; k < 9; k += 3) expect(v.set(P[k], P[k + 1], P[k + 2]).distanceTo(new THREE.Vector3(direct[k], direct[k + 1], direct[k + 2]))).toBeLessThan(1e-9);
  });
});

describe('cloth settled off what it covers between its points, where the part\'s faces are read', () => {
  // a part's bone up the y axis, its one point far up it (the line out to it crosses no cloth), and its faces a box
  // standing out from the bone along x to 0.1, 0.06 high and deep round y 0, z 0 (a rim standing out between the part's
  // points); a triangle of cloth standing across it at x 0.05, so that the box stands through it round its middle
  const bone = [new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 1, 0)], DOWN = new THREE.Vector3(0, -1, 0), I = new THREE.Matrix4();
  const boxAt = (x0: number, x1: number, h: number, d = h, at = new THREE.Vector3()) => {
    const g = new THREE.BoxGeometry(x1 - x0, 2 * h, 2 * d).toNonIndexed(); g.translate((x0 + x1) / 2 + at.x, at.y, at.z);
    return Float32Array.from(g.getAttribute('position').array as ArrayLike<number>);
  };
  const BOX = boxAt(0, 0.1, 0.03);
  const part = (F: Float32Array | undefined) => world({ bones: new Map([['upperArmL', bone]]), surface: new Map([['upperArmL', [new THREE.Vector3(0.1, 0.8, 0)]]]), faces: (n) => (n === 'upperArmL' ? F : undefined), size: 1 });
  const tri = (x = 0.05) => new Float64Array([x, -0.05, -0.05, x, 0.15, -0.05, x, -0.05, 0.15]);
  const settled = (P: Float64Array, F: Float32Array | undefined, o: { down?: THREE.Vector3; floor?: number } = {}) => {
    const w = part(F), inside = facesNear(P, [0, 1, 2], ['upperArmL'], w, I, I); let n = 0;
    while (n < 8 && liftOff(P, [0, 1, 2], ['upperArmL'], w, I, CLEAR, () => false, o.down ?? DOWN, undefined, undefined, undefined, { inside, floor: o.floor })) n++;
    return n;
  };
  /** How many of the cloth's points, read finely across it, lie in the box. */
  const inBox = (P: Float64Array, x0 = 0, x1 = 0.1, h = 0.03, d = h) => {
    let n = 0;
    for (let i = 0; i <= 60; i++) for (let j = 0; i + j <= 60; j++) {
      const b1 = i / 60, b2 = j / 60, b0 = 1 - b1 - b2, q = [0, 1, 2].map((k) => P[k] * b0 + P[3 + k] * b1 + P[6 + k] * b2);
      if (q[0] > x0 && q[0] < x1 && Math.abs(q[1]) < h && Math.abs(q[2]) < d) n++;
    }
    return n;
  };

  it('takes cloth the part stands through between its points out past the face it stands through, half the clearance past it', () => {
    const P = tri();
    expect(inBox(P)).toBeGreaterThan(10);
    expect(settled(P, BOX)).toBeGreaterThan(0);
    expect(inBox(P)).toBe(0);
    // (out along the way from the bone, past the box's outer face: each corner by its share of the move that takes the
    // crossing out, so the first, nearest where the box stood through, goes out furthest, more than 0.02 further than one
    // of the others at the least, where moved the whole way all three would lie alike; and none further than the most a
    // corner bears of such a move, (1 + √3) / 2 of it, where it bears 1 / √3 of the crossing and the others the rest
    // alike, to within half the spacing it reads the cloth at)
    let most = 0; for (let k = 0; k < 9; k += 3) most = Math.max(most, P[k]);
    expect(most).toBeGreaterThan(0.1); expect(most).toBeLessThan(0.05 + ((1 + Math.sqrt(3)) / 2) * (0.1 + CLEAR / 2 - 0.05) + 0.006);
    expect(P[0]).toBe(most); expect(P[0] - Math.min(P[3], P[6])).toBeGreaterThan(0.02);
    // (and over the box, where it stood through it, the cloth lies half the clearance past its outer face, to within half
    // the spacing it reads the cloth at: its nearest point there to the bone, read finely across it)
    let least = Infinity;
    for (let i = 0; i <= 60; i++) for (let j = 0; i + j <= 60; j++) {
      const b1 = i / 60, b2 = j / 60, b0 = 1 - b1 - b2, q = [0, 1, 2].map((k) => P[k] * b0 + P[3 + k] * b1 + P[6 + k] * b2);
      if (Math.abs(q[1]) < 0.03 && Math.abs(q[2]) < 0.03) least = Math.min(least, q[0]);
    }
    expect(least).toBeGreaterThan(0.1 + CLEAR / 2 - 0.006); expect(least).toBeLessThan(0.1 + CLEAR / 2 + 0.006);
  });

  it('holds a crossing between its points taken only partway and passes it over after: settled over and over, its free corners go out their one share', () => {
    // (the first corner no further than 0.01 from where it hung: the crossing's move is cut there, the triangle held as
    // such, and passed over the times after, as hanging the cloth settles it over and over; not held, each time over took
    // the crossing out a share more, its free corners creeping out with it)
    const first = new THREE.Vector3(...tri().subarray(0, 3)), may = (k: number, to: THREE.Vector3) => k !== 0 || to.distanceTo(first) <= 0.01;
    const over = (held?: Uint8Array) => {
      const P = tri(), w = part(BOX), inside = facesNear(P, [0, 1, 2], ['upperArmL'], w, I, I), moved: boolean[] = [], after: number[][] = [];
      for (let i = 0; i < 8; i++) { moved.push(liftOff(P, [0, 1, 2], ['upperArmL'], w, I, CLEAR, () => false, DOWN, undefined, may, held, { inside })); after.push(Array.from(P)); }
      return { moved, after };
    };
    const held = new Uint8Array(1), h = over(held), share = h.after[0][3] - tri()[3];
    expect(held[0]).toBe(2);
    expect(h.moved).toEqual([true, false, false, false, false, false, false, false]);
    expect(h.after[7]).toEqual(h.after[0]);
    expect(h.after[0][0]).toBeCloseTo(tri()[0] + 0.01, 5); // (the first corner stopped at its limit)
    expect(share).toBeGreaterThan(0.02); // (the free corners went their share)
    const loose = over();
    expect(loose.after[7][3] - tri()[3]).toBeGreaterThan(share * 1.5);
  });

  it('read from its points alone, the part leaves such cloth where it is: what its faces are read for', () => {
    const P = tri(), Q = tri();
    expect(settled(P, undefined)).toBe(0);
    expect(Array.from(P)).toEqual(Array.from(tri()));
    // (faces far from the cloth are not read at all)
    const far = boxAt(0, 0.1, 0.03, 0.03, new THREE.Vector3(0, 5, 0));
    expect(facesNear(Q, [0, 1, 2], ['upperArmL'], part(far), I, I).size).toBe(0);
    expect(settled(Q, far)).toBe(0);
    expect(Array.from(Q)).toEqual(Array.from(tri()));
  });

  it('cloth clear of the part, past its faces, short of them or behind its bone, is left where it is', () => {
    for (const x of [0.15, -0.05]) { const P = tri(x); expect(settled(P, BOX), `cloth at x ${x}`).toBe(0); expect(Array.from(P)).toEqual(Array.from(tri(x))); }
    // (and cloth between the bone and a plate standing off it, within the part's reach: the first face the way out from
    // the bone through it meets is the plate's inner face, a way into the part, so the cloth is not in it)
    const P = tri(0.03); expect(settled(P, boxAt(0.06, 0.1, 0.03))).toBe(0); expect(Array.from(P)).toEqual(Array.from(tri(0.03)));
  });

  it('never down into the floor, unless the face it stands through stands its clearance or more over the floor', () => {
    // (a slab as deep as the cloth is wide, so that every way out from the bone through the cloth leaves it by its outer
    // face, at x 0.1; the floor the way out, +x)
    const SLAB = boxAt(0, 0.1, 0.03, 0.3), DX = new THREE.Vector3(1, 0, 0);
    for (const floor of [undefined, 0.1 + CLEAR * 0.99]) { const P = tri(); expect(settled(P, SLAB, { down: DX, floor }), `floor ${floor}`).toBe(0); expect(Array.from(P)).toEqual(Array.from(tri())); }
    const P = tri(); expect(settled(P, SLAB, { down: DX, floor: 0.1 + CLEAR * 1.01 })).toBeGreaterThan(0); expect(inBox(P, 0, 0.1, 0.03, 0.3)).toBe(0);
    // (where it stands through the box's side, high over a floor beyond the outer face, it goes out of the side)
    const Q = tri(); expect(settled(Q, BOX, { down: DX, floor: 0.1 + CLEAR * 0.99 })).toBeGreaterThan(0); expect(inBox(Q)).toBeLessThan(inBox(tri()));
  });
});
