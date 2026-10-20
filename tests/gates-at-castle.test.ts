// The Gates of Ravenloft stand at the castle's own gate (item 2g-1; owner 2026-10-19, of the Gates of Ravenloft map:
// "this looks cool but it's supposed to be attached to and part of Ravenloft and the new improved 3D model"). In the
// continuous world, read off the atlas the build writes (manifests/world-atlas.json, scripts/world-atlas.ts) and the two
// scenes the generators write (scripts/authoring/wild_j.py and castle-ravenloft.py): J's sill lies under the free end of
// the castle's drawbridge, one chasm lies between them, the castle's, and J's ground is the castle's ground where the two
// maps meet, the valley's land one surface across the seam with the chasm open under the bridge.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { boundsInParent, rotate, toWorld, toWorld3, type Bounds } from '../app/src/core/frames';
import { WORLD_STANDINS } from '../app/src/core/siteInterfaces';
import { pointInPolygon, type Polygon, type Vec2 } from '../app/src/core/geometry';
import { siteOf } from '../app/src/render/worldstage';
import { buildLand } from '../app/src/render/worldland';
import type { Atlas } from '../scripts/world-atlas';
import type { Level, SceneFile, SceneObject } from '../app/src/core/schema';
import type { Theme, WorldData } from '../app/src/campaigns';
import world from '../locations/ch02/barovia-region/world.json';
import campaigns from '../manifests/campaigns.json';

const atlas = JSON.parse(readFileSync('manifests/world-atlas.json', 'utf8')) as Atlas;
const scene = (path: string) => JSON.parse(readFileSync(`locations/${path}/scene.json`, 'utf8')) as SceneFile;
const ground = (s: SceneFile) => s.levels.find((l) => l.terrain?.length) as Level;
const J = atlas.scenes['ch02/J'], K = atlas.scenes['ch04/K'];
const gj = ground(scene('ch02/J')), gk = ground(scene('ch04/K'));
const one = (l: Level, kind: string) => { const os = l.objects.filter((o) => o.kind === kind); expect(os.length, kind).toBe(1); return os[0]; };
const yaw = (e: typeof J, o: SceneObject) => e.placement.rotationY + ((o.rotY ?? 0) * Math.PI) / 180;
const dot = (a: Vec2, b: Vec2) => a[0] * b[0] + a[1] * b[1];
const unit = (a: Vec2): Vec2 => { const n = Math.hypot(a[0], a[1]); return [a[0] / n, a[1] / n]; };
const overlapArea = (a: Bounds, b: Bounds) => Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)) * Math.max(0, Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ));

// the castle's drawbridge: hinged at the gatehouse, its deck running `len` ft out along its local -x to its free end
const deck = one(gk, 'j-drawbridge');
const axis = unit(rotate(yaw(K, deck), [-1, 0]));                                   // from the hinge toward the free end, in W
const hinge = toWorld3(K.placement, [deck.pos[0], deck.pos[1], deck.pos[2]]);
const end: [number, number, number] = [hinge[0] + axis[0] * deck.dims!.len, hinge[1], hinge[2] + axis[1] * deck.dims!.len];
// J's sill: the bridge's free end lands on its middle; its local +x faces the chasm
const sillO = one(gj, 'j-bridge-sill');
const sill = toWorld3(J.placement, [sillO.pos[0], sillO.pos[1], sillO.pos[2]]);
const facing = unit(rotate(yaw(J, sillO), [1, 0]));
const mid: Vec2 = [(hinge[0] + end[0]) / 2, (hinge[2] + end[2]) / 2];

/** A drawn chasm's plan in W: the castle's 'chasm' prop (`w` across its local x, `len` along its z), a J cleft's rim. */
function chasmPlan(e: typeof J, o: SceneObject): Polygon {
  const d = o.dims ?? {};
  const local: Vec2[] = o.kind === 'chasm'
    ? [[-d.w / 2, -d.len / 2], [d.w / 2, -d.len / 2], [d.w / 2, d.len / 2], [-d.w / 2, d.len / 2]]
    : Array.from({ length: d.n }, (_, i) => [d[`x${i}`], d[`z${i}`]] as Vec2);
  return local.map((q) => { const [x, z] = rotate(((o.rotY ?? 0) * Math.PI) / 180, q); return toWorld(e.placement, [o.pos[0] + x, o.pos[2] + z]); });
}
const CHASMS = ['chasm', 'j-cleft', 'j-chasm-standin'];
/** The castle's crag pools mist round its rock on a canvas texture: a stand-in 2D canvas for node (as yester-hill.test.ts;
 *  nothing here looks at it). */
function stubCanvas(): void {
  const g = globalThis as unknown as { document?: unknown };
  if (g.document) return;
  const ctx: unknown = new Proxy({}, { get: (_t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
  g.document = { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx }) };
}
const drawnChasms = [...[[J, gj], [K, gk]] as const].flatMap(([e, l]) => l.objects.filter((o) => CHASMS.includes(o.kind) && !WORLD_STANDINS.has(o.kind)).map((o) => ({ path: e.path, o, plan: chasmPlan(e, o) })));

describe('the Gates of Ravenloft stand at the castle\'s gate in the valley', () => {
  it('J\'s sill lies under the free end of the castle\'s drawbridge, on its axis, at the deck\'s level', () => {
    expect(Math.hypot(sill[0] - end[0], sill[2] - end[2]), `the sill (${sill.map(Math.round)}) and the deck\'s end (${end.map(Math.round)}), ft in plan`).toBeLessThanOrEqual(1);
    expect(Math.abs(sill[1] - end[1]), 'and in height').toBeLessThanOrEqual(0.5);
    // the bridge comes down square onto the sill: the sill faces the chasm back along the bridge, toward its hinge
    expect(dot(facing, [-axis[0], -axis[1]]), 'the sill faces the gate along the bridge\'s axis').toBeGreaterThan(0.999);
  });

  it('exactly one chasm lies between them, the castle\'s, from J\'s lip to the gatehouse, and the valley\'s land opens there once', () => {
    // every point of the deck's span over the gap lies over one drawn chasm (stand-ins are hidden in the continuous world)
    const over = (p: Vec2) => drawnChasms.filter((c) => pointInPolygon(p, c.plan));
    const span: Vec2[] = Array.from({ length: 9 }, (_, i) => { const t = 0.15 + (0.7 * i) / 8; return [end[0] - axis[0] * (t * deck.dims!.len), end[2] - axis[1] * (t * deck.dims!.len)]; });
    for (const p of span) expect(over(p).map((c) => `${c.path} ${c.o.id}`), `over ${p.map(Math.round)}`).toEqual(['ch04/K ground-J-chasm']);
    // that chasm opens at J's lip, where J's ground ends, and closes at the gatehouse's face, where the hinge is
    const c = over(mid)[0], xs = c.plan.map((q) => q[0]);
    const lip = Math.min(...xs), far = Math.max(...xs);
    expect(Math.abs(lip - J.worldBounds!.maxX), 'its near lip is J\'s edge').toBeLessThanOrEqual(1);
    expect(far - hinge[0], 'its far lip at the gatehouse, under the hinge').toBeGreaterThanOrEqual(0);
    expect(far - hinge[0]).toBeLessThanOrEqual(1);
    expect(lip - end[0], 'the deck\'s end rests on the sill back from the lip, the deck spanning the chasm whole').toBeGreaterThan(0);
    // J's own North Gully opens off the chasm on J's side of the lip; nothing of it lies over the gap
    for (const g of drawnChasms.filter((d) => d.path === 'ch02/J')) expect(Math.max(...g.plan.map((q) => q[0])), g.o.id).toBeLessThanOrEqual(lip + 0.01);
    // the land: every ground cut under the bridge, from either map, is that one opening
    const cuts = [J, K].flatMap((e) => (e.groundCuts ?? []).map((g) => ({ b: boundsInParent(e.placement, g.bounds), floor: e.placement.position[1] + g.floor })))
      .filter((g) => mid[0] >= g.b.minX && mid[0] <= g.b.maxX && mid[1] >= g.b.minZ && mid[1] <= g.b.maxZ);
    expect(cuts.length, 'a cut from each map, the same one').toBe(2);
    const box = (g: { b: Bounds }) => [g.b.minX, g.b.maxX, g.b.minZ, g.b.maxZ];
    const want = [lip, far, Math.min(...c.plan.map((q) => q[1])), Math.max(...c.plan.map((q) => q[1]))];
    for (const g of cuts) { box(g).forEach((v, i) => expect(Math.abs(v - want[i]), `cut ${box(g).map(Math.round)}`).toBeLessThanOrEqual(0.01)); expect(g.floor).toBeLessThanOrEqual(end[1] - 400); }
  });

  it('J\'s ground is the castle\'s where the two maps meet: one level, edge to edge, no ground drawn twice', () => {
    const baseJ = J.placement.position[1] + J.elevationFt, baseK = K.placement.position[1] + K.elevationFt;
    expect(Math.abs(baseJ - baseK), `J's ground ${baseJ} ft, the castle's ${baseK} ft`).toBeLessThanOrEqual(0.5);
    const wj = J.worldBounds!, wk = K.worldBounds!;
    expect(Math.abs(wj.maxX - wk.minX), 'J ends where the castle\'s map begins').toBeLessThanOrEqual(1);
    expect(overlapArea(wj, wk), 'the two maps\' ground does not overlap').toBeLessThanOrEqual(1);
    expect(end[2] > wj.minZ && end[2] < wj.maxZ && end[2] > wk.minZ && end[2] < wk.maxZ, 'they meet along the chasm, the bridge between them').toBe(true);
    // the flatten bands of the two maps blend one base, so the land between them is level with both
    const pair = atlas.bandOverlaps.find((o) => o.scenes.includes('ch02/J') && o.scenes.includes('ch04/K'));
    expect(Math.abs(pair!.gapFt), 'touching, not overlapping').toBe(0);
  });

  it('the land drawn round them is one surface: flush under both maps at the seam, open the whole length of the chasm', () => {
    const data = world as unknown as WorldData;
    const sites = Object.values(atlas.scenes).filter((e) => e.campaign === 'cos' && e.worldBounds).map(siteOf);
    stubCanvas();
    const land = buildLand(data, sites, campaigns.campaigns[0].theme as unknown as Theme);
    land.group.updateMatrixWorld(true);
    try {
      const meshes = land.group.children.filter((m) => ['land', 'aprons'].includes(m.name) || m.name.startsWith('crag:'));
      const base = J.placement.position[1] + J.elevationFt;
      const top = (x: number, z: number) => { const hits = new THREE.Raycaster(new THREE.Vector3(x, base + 1000, z), new THREE.Vector3(0, -1, 0)).intersectObjects(meshes); return hits.length ? hits[0].point.y : -Infinity; };
      const wj = J.worldBounds!, c = drawnChasms.find((d) => d.o.kind === 'chasm')!, z0 = Math.min(...c.plan.map((q) => q[1])), z1 = Math.max(...c.plan.map((q) => q[1]));
      const lip = Math.min(...c.plan.map((q) => q[0])), far = Math.max(...c.plan.map((q) => q[0]));
      for (let z = z0 + 2; z < z1; z += 25) {
        for (const x of [lip + 2, (lip + far) / 2, far - 2]) expect(top(x, z), `in the chasm at ${Math.round(x)}, ${Math.round(z)}`).toBeLessThanOrEqual(base - 390);
        if (z > wj.minZ + 2 && z < wj.maxZ - 2) { const y = top(lip - 2, z); expect(y, `J's side of the lip at ${Math.round(z)}`).toBeLessThanOrEqual(base); expect(y).toBeGreaterThanOrEqual(base - 0.5); }
        if (z > K.worldBounds!.minZ + 2 && z < K.worldBounds!.maxZ - 2) { const y = top(far + 2, z); expect(y, `the castle's side at ${Math.round(z)}`).toBeLessThanOrEqual(base); expect(y).toBeGreaterThanOrEqual(base - 0.5); }
      }
      // past J's road side, the valley's land runs on level with J's ground: no terrace edge round the Gates
      for (const [x, z] of [[wj.minX - 10, (wj.minZ + wj.maxZ) / 2], [(wj.minX + wj.maxX) / 2, wj.minZ - 10], [(wj.minX + wj.maxX) / 2, wj.maxZ + 10]] as Vec2[]) {
        const y = top(x, z); expect(y, `beside J at ${Math.round(x)}, ${Math.round(z)}`).toBeLessThanOrEqual(base); expect(y).toBeGreaterThanOrEqual(base - 1);
      }
    } finally {
      land.group.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose(); } });
    }
  });
});
