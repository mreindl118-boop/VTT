// Walls with a body (Wall.thicknessFt, opt-in; owner 2026-10-19: "proportionately sized walls where possible"): a wall
// that sets it is drawn that thick by the level builder, its joints closed with no gap and no overlap, its doors cut
// through the whole depth; the party is stopped and sight is cut by the drawn body, not by its centreline only; the fog
// remembers a seen wall's whole top. A map without the field is drawn, walked and seen exactly as before.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildLevel } from '../app/src/render/build';
import { merge, segmentBox, WALL_T } from '../app/src/kit/pieces';
import { WALL_COLOR } from '../app/src/kit/palette';
import { wallFootprints } from '../app/src/core/wallBody';
import { hasLineOfSight, moveBlockers, sightBlockers } from '../app/src/core/light';
import { canWalk } from '../app/src/core/movement';
import { CoverageMap } from '../app/src/core/coverage';
import { pointInPolygon, type Polygon, type Vec2 } from '../app/src/core/geometry';
import { validateScene, type GridLevel, type Level, type SceneFile, type Wall, type WallFlag } from '../app/src/core/schema';
import { setWallCut } from '../app/src/render/materials';

const GRID: GridLevel = { floorPolygons: [], type: 'square', hexOrientation: 'pointy', origin: [0, 0], color: '#000000', opacity: 0 };
const CEIL = 20;
const level = (walls: Wall[]): Level => ({ id: 'l', name: 'l', elevationFt: 0, ceilingFt: CEIL, rooms: [], walls, lights: [], objects: [] });
const W = (id: string, a: Vec2, b: Vec2, t?: number, flags: WallFlag[] = ['normal'], off?: number): Wall =>
  ({ id, a, b, flags, material: 'ashlar', ...(t !== undefined ? { thicknessFt: t } : {}), ...(off !== undefined ? { offsetFt: off } : {}), ...(flags.includes('door') ? { open: false } : {}) });
const ASHLAR = new THREE.Color(WALL_COLOR.ashlar).getHexString();

/** The plan extent (x, z) of the level's drawn wall meshes in one colour. */
function extent(l: Level, hex = ASHLAR): THREE.Box3 {
  const built = buildLevel(l, GRID), box = new THREE.Box3();
  built.wallsGroup.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || o.userData.role !== 'wall' || (m.material as THREE.MeshLambertMaterial).color.getHexString() !== hex) return;
    box.expandByObject(m);
  });
  return box;
}

/** How many footprints cover each sample point of a region (points within 0.01 ft of a footprint edge are skipped). */
function cover(fps: Polygon[], pts: Vec2[]): number[] {
  const near = (p: Vec2, poly: Polygon) => poly.some((a, i) => {
    const b = poly[(i + 1) % poly.length], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
    const s = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2));
    return Math.hypot(p[0] - a[0] - s * dx, p[1] - a[1] - s * dz) < 0.01;
  });
  return pts.filter((p) => !fps.some((f) => near(p, f))).map((p) => fps.filter((f) => pointInPolygon(p, f)).length);
}
/** Sample points on a 0.13-ft lattice (off any round number) inside the plan box. */
function samples(x0: number, z0: number, x1: number, z1: number, keep: (p: Vec2) => boolean): Vec2[] {
  const out: Vec2[] = [];
  for (let z = z0 + 0.0137; z < z1; z += 0.13) for (let x = x0 + 0.0071; x < x1; x += 0.13) if (keep([x, z])) out.push([x, z]);
  return out;
}
/** Distance from p to the segment a-b, and how far along it p falls (0..1 inside). */
function seg(p: Vec2, a: Vec2, b: Vec2): { d: number; s: number } {
  const dx = b[0] - a[0], dz = b[1] - a[1], s = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz);
  return { d: Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / Math.hypot(dx, dz), s };
}

describe('a wall that sets thicknessFt is drawn that thick', () => {
  it('a plain wall: its body is the thickness across and stops square at its free ends', () => {
    const b = extent(level([W('w', [0, 0], [20, 0], 4)]));
    expect(b.min.z).toBeCloseTo(-2, 5); expect(b.max.z).toBeCloseTo(2, 5);
    expect(b.min.x).toBeCloseTo(0, 5); expect(b.max.x).toBeCloseTo(20, 5);
  });

  it('a map without it is drawn exactly as before: the kit thickness, corners closed by the half-thickness overlap', () => {
    const l = level([W('w', [0, 0], [20, 0]), W('v', [20, 0], [20, 10])]);
    const built = buildLevel(l, GRID);
    const mesh = built.wallsGroup.children.find((o) => (o as THREE.Mesh).isMesh && (((o as THREE.Mesh).material as THREE.MeshLambertMaterial).color.getHexString() === ASHLAR)) as THREE.Mesh;
    const want = merge([segmentBox([0, 0], [20, 0], 0, CEIL - 0.1), segmentBox([20, 0], [20, 10], 0, CEIL - 0.1)]);
    expect(Array.from(mesh.geometry.attributes.position.array)).toEqual(Array.from(want.attributes.position.array));
    expect(WALL_T).toBe(0.6);
  });

  it('a door through a thick wall keeps its whole width; its frame stands proud of both faces of the wall', () => {
    const walls = [W('w1', [0, 0], [10, 0], 4), W('d', [10, 0], [15, 0], 4, ['door']), W('w2', [15, 0], [30, 0], 4)];
    const fp = wallFootprints(walls);
    // nothing of the two wall pieces stands in the opening
    const gap = samples(10, -2, 15, 2, () => true);
    expect(cover([fp[0]!, fp[2]!], gap).every((c) => c === 0)).toBe(true);
    // the lintel over the door fills the opening's whole depth and no more
    const lintel = fp[1]!;
    expect(Math.min(...lintel.map((p) => p[0]))).toBeCloseTo(10, 6); expect(Math.max(...lintel.map((p) => p[0]))).toBeCloseTo(15, 6);
    expect(Math.min(...lintel.map((p) => p[1]))).toBeCloseTo(-2, 6); expect(Math.max(...lintel.map((p) => p[1]))).toBeCloseTo(2, 6);
    const frame = extent(level(walls), new THREE.Color('#3a2c22').getHexString());
    expect(frame.max.z).toBeCloseTo(2 + 0.175, 5); expect(frame.min.z).toBeCloseTo(-2 - 0.175, 5);
  });
});

describe('a wall with a body cut by the section plane shows its cut face', () => {
  const caps = (l: Level) => { const root = new THREE.Group(); const b = buildLevel(l, GRID); root.add(b.root); root.updateMatrixWorld(true); return b.wallsGroup.children.filter((o) => o.userData.sectionCap) as THREE.Mesh[]; };
  const at = (m: THREE.Mesh, cut: number | null) => { setWallCut(cut); m.onBeforeRender(null as never, null as never, null as never, null as never, null as never, null as never); return m.position.y; };
  it('a cap the shape of the wall\'s footprint stands just under the plane while the plane cuts the wall', () => {
    const [cap] = caps(level([W('w', [0, 0], [20, 0], 4)]));
    expect(cap).toBeDefined();
    const box = new THREE.Box3().setFromBufferAttribute(cap.geometry.attributes.position as THREE.BufferAttribute);
    expect(box.min.z).toBeCloseTo(-2, 5); expect(box.max.z).toBeCloseTo(2, 5); expect(box.min.x).toBeCloseTo(0, 5); expect(box.max.x).toBeCloseTo(20, 5);
    expect(at(cap, 8)).toBeCloseTo(8 - 0.02, 5);
    expect(at(cap, 3)).toBeCloseTo(3 - 0.02, 5);
    // above the wall's top the cap waits inside the solid, below the wall's foot the plane clips it with the wall
    expect(cap.scale.y).toBe(1);
    const hidden = at(cap, 100); expect(hidden).toBeGreaterThan(0.5); expect(hidden).toBeLessThan(CEIL - 0.6); expect(cap.scale.y).toBe(0);
    at(cap, -5); expect(cap.scale.y).toBe(0);
    setWallCut(null); at(cap, null); expect(cap.scale.y).toBe(0);
    setWallCut(null);
  });
  it('a map without thicknessFt has no caps', () => {
    expect(caps(level([W('w', [0, 0], [20, 0])]))).toEqual([]);
  });
});

describe('a wall that takes its thickness from one side (offsetFt)', () => {
  it('stands off its line by the offset: the line stays on its face', () => {
    const b = extent(level([W('w', [0, 0], [20, 0], 4, ['normal'], 2)]));   // the left of +x is +z
    expect(b.min.z).toBeCloseTo(0, 5); expect(b.max.z).toBeCloseTo(4, 5);
    const r = extent(level([W('w', [0, 0], [20, 0], 4, ['normal'], -2)]));
    expect(r.min.z).toBeCloseTo(-4, 5); expect(r.max.z).toBeCloseTo(0, 5);
  });
  it('an L of two walls both standing outward closes its corner once, the corner square included', () => {
    // a room's corner at the origin, the room in +x +z: both walls borrow from outside (-z, -x)
    const fp = wallFootprints([W('n', [0, 0], [20, 0], 4, ['normal'], -2), W('w', [0, 20], [0, 0], 4, ['normal'], -2)]) as Polygon[];
    const c = cover(fp, samples(-4, -4, 19.9, 19.9, ([x, z]) => (z < 0 && z > -4 && x > -4) || (x < 0 && x > -4 && z > -4)));
    expect(c.length).toBeGreaterThan(200); expect(c.filter((k) => k !== 1)).toEqual([]);
    expect(cover(fp, samples(0.1, 0.1, 19.9, 19.9, () => true)).every((k) => k === 0)).toBe(true);   // the room is clear
  });
  it('a T against a wall standing off its line stops at the face on its own side', () => {
    const fp = wallFootprints([W('t', [0, 0], [30, 0], 4, ['normal'], -2), W('s', [15, 0], [15, 20], 2)]) as Polygon[];
    expect(Math.min(...fp[1].map((p) => p[1]))).toBeCloseTo(0, 6);   // the through wall's body is all on -z
    const c = cover(fp, samples(0.5, -4, 29.5, 19.5, ([x, z]) => (z < 0 && z > -4) || (Math.abs(x - 15) < 1 && z > 0)));
    expect(c.filter((k) => k !== 1)).toEqual([]);
  });
  it('a door in such a wall cuts through its whole depth, its frame round the body\'s middle', () => {
    const walls = [W('w1', [0, 0], [10, 0], 4, ['normal'], 2), W('d', [10, 0], [15, 0], 4, ['door'], 2), W('w2', [15, 0], [30, 0], 4, ['normal'], 2)];
    const fp = wallFootprints(walls);
    expect(Math.min(...fp[1]!.map((p) => p[1]))).toBeCloseTo(0, 6); expect(Math.max(...fp[1]!.map((p) => p[1]))).toBeCloseTo(4, 6);
    const frame = extent(level(walls), new THREE.Color('#3a2c22').getHexString());
    expect(frame.min.z).toBeCloseTo(-0.175, 5); expect(frame.max.z).toBeCloseTo(4.175, 5);
  });
});

describe('thick walls join with no gap and no overlap', () => {
  const once = (fps: Polygon[], pts: Vec2[]) => { const c = cover(fps, pts); expect(c.length).toBeGreaterThan(200); expect(c.filter((k) => k !== 1)).toEqual([]); };

  it('an L corner, equal and unequal walls: the corner square is filled once', () => {
    for (const [t1, t2] of [[4, 4], [4, 2], [1, 6]]) {
      const fp = wallFootprints([W('n', [0, 0], [20, 0], t1), W('e', [20, 0], [20, 20], t2)]) as Polygon[];
      // the solid: every point within half a thickness of either centreline, the outer corner rectangle included
      once(fp, samples(-1, -t1 / 2, 20 + t2 / 2, 20, ([x, z]) => (Math.abs(z) < t1 / 2 && x > 0) || (Math.abs(x - 20) < t2 / 2 && z > -t1 / 2)));
    }
  });

  it('a T: the stem stops at the face of the wall it meets, which runs on whole', () => {
    const fp = wallFootprints([W('t', [0, 0], [30, 0], 4), W('s', [15, 0], [15, 20], 2)]) as Polygon[];
    once(fp, samples(0.5, -2, 29.5, 20, ([x, z]) => Math.abs(z) < 2 || (Math.abs(x - 15) < 1 && z > 0)));
    expect(Math.min(...fp[1].map((p) => p[1]))).toBeCloseTo(2, 6);
  });

  it('a T against a wall that turns away within the stem\'s width: the stem runs on to the joint where nothing stands', () => {
    // a 6-ft keep wall (its body east of its line) meets a tower's ring, whose side runs 1 ft east of the joint and turns
    const fp = wallFootprints([W('A', [-20, 0], [0, 0], 4), W('S', [0, 0], [1, 0], 4), W('D', [1, 0], [11, 10], 4), W('B', [0, -20], [0, 0], 6, ['normal'], -3)]) as Polygon[];
    // every point of the stem's own stretch is solid: no notch between the ring's turn and the stem's far face
    const c = cover(fp, samples(0.05, -19, 5.95, -0.05, () => true));
    expect(c.length).toBeGreaterThan(2000); expect(c.filter((k) => k === 0)).toEqual([]);
    // and the stem never stands in the wall that runs on whole, nor past the joint's line
    expect(cover([fp[0], fp[3]], samples(-19, -1.99, 5.99, 1.99, () => true)).filter((k) => k > 1)).toEqual([]);
    expect(Math.max(...fp[3].map((p) => p[1]))).toBeCloseTo(0, 6);
  });

  it('an outside corner of a thick wall and a thin one: the thick wall keeps its square end, the thin one closes on it', () => {
    // a 5-ft wall standing south of its line meets a 0.5-ft chamfer turning north-east at 135 degrees, both bodies on
    // the outside: their outer faces meet only behind the chamfer's start, inside the thick wall's own stretch
    const fp = wallFootprints([W('A', [-30, 0], [0, 0], 5, ['normal'], 2.5), W('B', [0, 0], [10, -10], 0.5, ['normal'], 0.25)]) as Polygon[];
    const c = cover(fp, samples(-29.9, 0.03, -0.03, 4.97, () => true));
    expect(c.length).toBeGreaterThan(2000); expect(c.filter((k) => k !== 1)).toEqual([]);
    // the corner beyond the thick wall's end, between its end and the chamfer's outer face, is the chamfer's, once
    once(fp, samples(0.03, -6, 6, 0, ([x, z]) => x + z > 0.03 && x + z < Math.SQRT2 * 0.5 - 0.03 && x - z > 0.05 && x < 5));
  });

  it('a wall split in two in one line, and a door between pieces, are cut square where the pieces meet', () => {
    const fp = wallFootprints([W('a', [0, 0], [10, 0], 3), W('b', [10, 0], [20, 0], 3)]) as Polygon[];
    once(fp, samples(0.1, -1.5, 19.9, 1.5, () => true));
    expect(Math.max(...fp[0].map((p) => p[0]))).toBeCloseTo(10, 6);
  });

  it('an octagonal tower: the ring of eight walls is mitred at every corner', () => {
    const r = 15, c = Math.tan(Math.PI / 8) * r, pts: Vec2[] = [[-c, -r], [c, -r], [r, -c], [r, c], [c, r], [-c, r], [-r, c], [-r, -c]];
    const ring = pts.map((p, i) => W(`o${i}`, p, pts[(i + 1) % 8], 4));
    const fp = wallFootprints(ring) as Polygon[];
    // the ring: inside the octagon 2 ft out and outside the one 2 ft in (an octagon's flat sides at 15 +- 2)
    const inOct = (p: Vec2, half: number) => [0, 1, 2, 3].every((k) => { const a = (k * Math.PI) / 4; return Math.abs(p[0] * Math.cos(a) + p[1] * Math.sin(a)) < half; });
    once(fp, samples(-17, -17, 17, 17, (p) => inOct(p, 17) && !inOct(p, 13)));
  });

  it('three walls meeting at a point with none running through are mitred round it', () => {
    const fp = wallFootprints([W('a', [0, 0], [20, 0], 2), W('b', [0, 0], [-10, 17.32], 2), W('c', [0, 0], [-10, -17.32], 2)]) as Polygon[];
    const ends: [Vec2, Vec2][] = [[[0, 0], [20, 0]], [[0, 0], [-10, 17.32]], [[0, 0], [-10, -17.32]]];
    once(fp, samples(-9, -15, 19, 15, (p) => ends.some(([a, b]) => { const q = seg(p, a, b); return q.d < 1 && q.s > 0 && q.s < 0.95; })));
  });
});

describe('the party and sight meet the drawn body', () => {
  const floor: Polygon[] = [[[-10, -10], [30, -10], [30, 10], [-10, 10]]];
  it('the party cannot step into a thick wall, only up to its face', () => {
    const walls = [W('w', [0, 0], [20, 0], 4)];
    expect(canWalk([5, -6], [5, -1.25], moveBlockers(walls), floor)).toBe(false);
    expect(canWalk([5, -6], [5, -3.75], moveBlockers(walls), floor)).toBe(true);
    expect(canWalk([5, -6], [5, 6], moveBlockers(walls), floor)).toBe(true);   // round its free end
  });
  it('a line of sight that grazes inside the body is cut; one past its face is not', () => {
    const walls = [W('w', [0, 0], [20, 0], 4)];
    expect(hasLineOfSight([-5, -1.9], [25, -1.9], sightBlockers(walls))).toBe(false);
    expect(hasLineOfSight([-5, -2.1], [25, -2.1], sightBlockers(walls))).toBe(true);
  });
  it('an open door in a thick wall lets the party through its reveal; shut, it does not', () => {
    const walls = (open: boolean) => [W('w1', [0, 0], [10, 0], 4), { ...W('d', [10, 0], [15, 0], 4, ['door']), open }, W('w2', [15, 0], [30, 0], 4)];
    const hall: Polygon[] = [[[1, -10], [29, -10], [29, 10], [1, 10]]];   // no way round the wall's ends
    expect(canWalk([12.5, -6], [12.5, 6], moveBlockers(walls(true)), hall)).toBe(true);
    expect(canWalk([12.5, -6], [12.5, 6], moveBlockers(walls(false)), hall)).toBe(false);
    expect(canWalk([12.5, -6], [12.5, -1.25], moveBlockers(walls(false)), hall)).toBe(true);   // up to the shut leaf, in the reveal
    expect(hasLineOfSight([12.5, -6], [12.5, 6], sightBlockers(walls(true)))).toBe(true);
  });
  it('a map without thicknessFt blocks with its centrelines only, as before', () => {
    const walls = [W('w', [0, 0], [20, 0]), W('d', [20, 0], [25, 0], undefined, ['door'])];
    expect(moveBlockers(walls)).toEqual([{ a: [0, 0], b: [20, 0] }, { a: [20, 0], b: [25, 0] }]);
    expect(sightBlockers(walls)).toEqual([{ a: [0, 0], b: [20, 0], terrain: false }, { a: [20, 0], b: [25, 0], terrain: false }]);
  });
});

describe('the fog remembers a seen wall\'s whole top', () => {
  const room: Polygon = [[0, 0], [20, 0], [20, 18], [0, 18]];      // the floor stops at the wall's face (z 18)
  const beyond: Polygon = [[0, 22], [20, 22], [20, 40], [0, 40]];  // another room past the wall
  const run = (t?: number) => {
    const cov = CoverageMap.forPolygons([room, beyond]);
    cov.updateVision([{ pos: [10, 9], darkvisionFt: 0 }], [room, beyond], [W('w', [0, 20], [20, 20], t)], [], 'barovian-overcast');
    return (x: number, z: number) => cov.visible[cov.idx(x, z)];
  };
  it('a 4-ft wall seen from one side is lit across its whole top, and the room past it stays dark', () => {
    const v = run(4);
    for (const z of [18.5, 19.5, 20.5, 21.5]) expect(v(10.5, z), `wall top at z ${z}`).toBe(1);
    expect(v(10.5, 22.5)).toBe(0); expect(v(10.5, 30.5)).toBe(0);
  });
  it('a map without thicknessFt keeps its one-foot rim', () => {
    const v = run(undefined);
    expect(v(10.5, 18.5)).toBe(1); expect(v(10.5, 19.5)).toBe(0);
  });
});

describe('the scene check reads the thickness', () => {
  it('a thickness that is not a positive number of feet is reported', () => {
    const s = (t: number): SceneFile => ({ schema: 1, location: 'x', chapter: 'c', name: 'n', bookScaleFt: 5, ambient: 'night', links: [], levels: [{ ...level([W('w', [0, 0], [5, 0], t)]) }] });
    expect(validateScene(s(2))).toEqual([]);
    for (const bad of [0, -1, Number.NaN, 90]) expect(validateScene(s(bad)).join(' '), String(bad)).toMatch(/thicknessFt/);
    const off = (o: number, t?: number): SceneFile => ({ ...s(2), levels: [level([{ ...W('w', [0, 0], [5, 0], t), offsetFt: o }])] });
    expect(validateScene(off(1, 2))).toEqual([]);
    expect(validateScene(off(1.5, 2)).join(' ')).toMatch(/offsetFt/);
    expect(validateScene(off(0.5)).join(' ')).toMatch(/offsetFt/);
  });
});
