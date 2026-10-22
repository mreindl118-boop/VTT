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
import { knownOnArrival, SITE_INTERFACES, WORLD_STANDINS } from '../app/src/core/siteInterfaces';
import { pointInPolygon, type Polygon, type Vec2 } from '../app/src/core/geometry';
import { siteOf } from '../app/src/render/worldstage';
import { buildLand } from '../app/src/render/worldland';
import { buildBackdrop } from '../app/src/render/backdrop';
import { bounds } from '../app/src/core/geometry';
import { CAMPAIGNS, worldOf } from '../app/src/campaigns';
import { buildLevel, buildSceneObject } from '../app/src/render/build';
import { Ghost, ghostCutFt } from '../app/src/render/ghost';
import '../app/src/kit/sites';
import type { GridFile } from '../app/src/core/schema';
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

describe('the castle seen from the Gates', () => {
  it('the castle beside the Gates is drawn whole: its ghost is not cut at its courtyard floor\'s ceiling', () => {
    // a stacked map's ghost is cut as the active map would be on its ground level (render/ghost.ts); the castle, the
    // Gates' neighbour across the chasm, looms whole instead (owner 2026-10-22), unless the DM has the walls low
    const sk = scene('ch04/K'), whole = SITE_INTERFACES['ch04/K']?.whole;
    expect(ghostCutFt(sk, gk, null), 'a stacked map\'s ghost, as before').toBe(gk.elevationFt + (gk.ceilingFt ?? 10) - 0.5);
    expect(ghostCutFt(sk, gk, null, whole), 'the castle as a neighbour').toBeNull();
    expect(ghostCutFt(sk, gk, gk.elevationFt + 5, whole), 'with the walls low').toBe(gk.elevationFt + 5);
    // and no other map is drawn whole
    expect(Object.entries(SITE_INTERFACES).filter(([, t]) => t.whole).map(([p]) => p)).toEqual(['ch04/K']);
  });
  it('reaching the Gates makes the castle known to the players: it looms across the chasm', () => {
    // a place the party reaches is known to the players (app.ts moveWorld); from the Gates the castle is in plain sight,
    // so its pin is revealed with theirs and Players view draws it (owner 2026-10-22)
    expect(knownOnArrival('J')).toEqual(['J', 'K']);
    expect(knownOnArrival('K'), 'the castle reveals nothing more').toEqual(['K']);
    expect(knownOnArrival('E'), 'any other place: itself').toEqual(['E']);
  });
});

describe('the road to the Gates of Ravenloft', () => {
  it('the valley\'s road meets J\'s own road where it leaves J\'s north edge', () => {
    // J's road (wild_j.py: the dirt track) leaves the map's north edge between x 30 and 48; the world's Road to Ravenloft
    // meets it there, at an exact exit, not wherever the road happens to pass
    const dirt = gj.terrain!.find((t) => t.floor === 'dirt')!.polygon.filter((q) => q[1] === 0).map((q) => q[0]);
    expect(J.exactRoadExits, 'J\'s road exit is fixed').toBe(true);
    expect(J.roadExits.map((r) => r.road)).toEqual(['Road to Ravenloft']);
    const [ex] = J.roadExits;
    expect(ex.z, 'on J\'s north edge').toBe(0);
    expect(ex.x).toBeGreaterThanOrEqual(Math.min(...dirt)); expect(ex.x).toBeLessThanOrEqual(Math.max(...dirt));
  });
  // The castle's only way in is the drawbridge from J, so no world road should run into the castle's map. 0.3.4's Road to
  // Ravenloft still runs on past the Gates to the castle's pin; the owner kept it so for the castle's release (2026-10-22:
  // the road as 0.3.4 has it, its last mile and its climb onto the rock with framework release 7, item 2f-6).
  it.todo('no world road runs into the castle: the Road to Ravenloft ends at the Gates (framework release 7)');
});

/** A map's backdrop as app.ts builds it where the continuous world is off: its open-air level's extent, its pin, its
 *  crag, the land beyond it, the other places on the world map. */
function backdropOf(path: string): THREE.Group {
  stubCanvas();
  const sc = scene(path), l0 = ground(sc), camp = CAMPAIGNS.find((c) => c.prefixes.some((x) => path.startsWith(x)))!, w = worldOf(camp);
  const pin = w.pins.find((p) => p.scenes?.includes(path))!;
  const bb = bounds([...l0.rooms.map((r) => r.polygon), ...(l0.terrain ?? []).map((t) => t.polygon)]);
  return buildBackdrop({ ground: 'grass', center: [(bb.minX + bb.maxX) / 2, (bb.minZ + bb.maxZ) / 2], radius: Math.hypot(bb.maxX - bb.minX, bb.maxZ - bb.minZ) / 2, elevation: l0.elevationFt, pin: pin.pos as Vec2, world: w, theme: camp.theme, bounds: bb, north: l0.north, roads: [], crag: pin.heightFt ?? 0 });
}
function dispose(g: THREE.Object3D): void { g.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose(); } }); }

describe('the Gates of Ravenloft where the continuous world is off', () => {
  it('the castle open alone: its drawbridge comes down on a stand-in of the Gates\' sill and the road\'s ridge, hidden in the valley', () => {
    // the ground west of the chasm is the Gates' map in the continuous world; alone, the castle stands in for it
    const st = gk.objects.filter((o) => WORLD_STANDINS.has(o.kind));
    expect(st.map((o) => o.kind), 'a stand-in on the castle\'s ground level').not.toEqual([]);
    stubCanvas();
    const root = new THREE.Group();
    for (const o of st) { const b = buildSceneObject(o); b.position.set(o.pos[0], o.pos[1], o.pos[2]); b.rotation.y = ((o.rotY ?? 0) * Math.PI) / 180; root.add(b); }
    root.updateMatrixWorld(true);
    const a = ((deck.rotY ?? 0) * Math.PI) / 180, endK: Vec2 = [deck.pos[0] - deck.dims!.len * Math.cos(a), deck.pos[2] + deck.dims!.len * Math.sin(a)];
    const top = (x: number, z: number) => { const h = new THREE.Raycaster(new THREE.Vector3(x, 500, z), new THREE.Vector3(0, -1, 0)).intersectObject(root, true); return h.length ? h[0].point.y : -Infinity; };
    try {
      const y = top(...endK); expect(y, `under the deck\'s free end at ${endK.map(Math.round)}`).toBeGreaterThanOrEqual(-0.5); expect(y).toBeLessThanOrEqual(1.5);
      // and the ridge's road runs on west from the lip, as the castle drew it before the Gates came to its chasm
      for (const dx of [20, 100, 200, 240]) { const r = top(endK[0] - dx, endK[1]); expect(r, `the ridge ${dx} ft west of the deck\'s end`).toBeGreaterThanOrEqual(-0.5); expect(r).toBeLessThanOrEqual(1.5); }
    } finally { dispose(root); }
  });

  it('the backdrop draws no castle on its rock over the Gates\' own map: the Gates\' stand-in closes the view', () => {
    expect(gj.objects.some((o) => o.kind === 'j-castle-mass'), 'J carries the castle\'s stand-in').toBe(true);
    const j = backdropOf('ch02/J');
    try { expect(!!j.getObjectByName('castle-ravenloft'), 'the backdrop\'s castle beside J').toBe(false); } finally { dispose(j); }
    // every other place keeps the castle on its horizon (the village 1.45 mi away, the fork at I)
    for (const path of ['ch03/E', 'ch02/I']) {
      const b = backdropOf(path);
      try { expect(!!b.getObjectByName('castle-ravenloft'), path).toBe(true); } finally { dispose(b); }
    }
  });
});

describe('the Gates of Ravenloft drawn beside the castle', () => {
  it('drawn as a ghost (the castle active beside them), no depth-only piece of their map turns into a coloured surface', () => {
    // the North Gully's lid writes depth only, opening the ground over the gully's depths; a ghost's plain copy of it
    // would draw a white plate over the gully (the sail seen from the castle on a phone)
    stubCanvas();
    for (const path of ['ch02/J', 'ch04/K']) {
      const sc = scene(path), lv = ground(sc), grid = JSON.parse(readFileSync(`locations/${path}/grid.json`, 'utf8')) as GridFile;
      const built = buildLevel(lv, grid.levels[lv.id]), root = new THREE.Group(); root.add(built.root);
      const ghost = new Ghost(new THREE.Color('#c6ccd6'));
      ghost.apply({ scene: sc, root, levels: new Map([[lv.id, built]]), labels: [], tokens: new Map() }, { level: lv.id, shown: new Set([lv.id]), cutFt: null, lowWalls: false, revealed: new Set(), restricted: false });
      const coloured: string[] = [];
      root.traverse((o) => {
        const m = o as THREE.Mesh, live = m.userData.liveMat as THREE.Material | undefined;
        if (!m.isMesh || !live) return;
        let shown = true; for (let q: THREE.Object3D | null = m; q; q = q.parent) if (!q.visible) shown = false;
        const now = (Array.isArray(m.material) ? m.material : [m.material]) as THREE.Material[], was = (Array.isArray(live) ? live : [live]) as THREE.Material[];
        if (shown && was.some((x, i) => x.colorWrite === false && now[i]?.colorWrite !== false)) { let id: string | undefined; for (let q: THREE.Object3D | null = m; q && !id; q = q.parent) id = q.userData.objectId; coloured.push(`${path} ${id ?? m.name}`); }
      });
      expect(coloured, path).toEqual([]);
      dispose(root);
    }
  });
});
