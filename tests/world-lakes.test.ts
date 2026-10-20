// The valley's lakes as measured outlines (item 2f-1c). locations/ch02/barovia-region/world.json draws each lake as an
// outline traced from the regional map by scripts/authoring/barovia-world.py (`pts`, miles, clockwise on the map), with
// the outline's bounding ellipse as `center`/`r`. Every view draws one shore made from it (render/worldlakes.ts
// `lakeRing`: the corners rounded, no edge longer than 0.15 mi): the land and its water (render/worldland.ts), the
// inked map (render/worldcarto.ts), the flat sheet (ui/worldmap.ts) and the legacy backdrop (render/backdrop.ts). A
// lake without an outline keeps the ellipse it always had (the Tser Pool, tied to the camp's own water; the Sheep
// Chase country, which has no lakes).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import barovia from '../locations/ch02/barovia-region/world.json';
import wsc from '../locations/wsc/00-region/world.json';
import campaigns from '../manifests/campaigns.json';
import type { Theme, WorldData } from '../app/src/campaigns';
import { FLATTEN_IN, MI_FT, mapDist } from '../app/src/core/frames';
import { pointInPolygon, polygonArea } from '../app/src/core/geometry';
import { buildAtlas } from '../scripts/world-atlas';
import { siteOf } from '../app/src/render/worldstage';
import { BOAT_SEEN, LandField, SHORE, buildLand, lakeOutline, ringCentroid, ringSd } from '../app/src/render/worldland';
import { MAX_EDGE_MI, SIMPLIFY_MI, chaikin, lakeRing } from '../app/src/render/worldlakes';
import { CARTO_STYLES, bakeLand, cartoUniforms } from '../app/src/render/worldcarto';
import { inLake, useWorld } from '../app/src/ui/worldmap';
import { buildBackdrop } from '../app/src/render/backdrop';
import { CAMPAIGNS, worldOf } from '../app/src/campaigns';
import { bounds } from '../app/src/core/geometry';
import { inLakeShape } from '../app/src/render/worldlakes';
import type { SceneFile } from '../app/src/core/schema';
import { readFileSync } from 'node:fs';

type Vec2 = [number, number];
const data = barovia as unknown as WorldData, sheep = wsc as unknown as WorldData;
const outlined = data.lakes.filter((l) => lakeOutline(l));
const theme = campaigns.campaigns[0].theme as unknown as Theme;
/** Proper crossing of two segments (not at a shared end). */
function cross(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const s = (o: Vec2, p: Vec2, q: Vec2) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  return (s(c, d, a) > 0) !== (s(c, d, b) > 0) && (s(a, b, c) > 0) !== (s(a, b, d) > 0);
}

describe('the lakes\' outlines in the data', () => {
  it('three lakes are outlines; the Tser Pool stays the disc the camp\'s water continues into', () => {
    expect(outlined.map((l) => l.name)).toEqual(['Lake Zarovich', 'Lake Baratok', 'Luna Lake']);
    expect(data.lakes.filter((l) => !lakeOutline(l)).map((l) => l.name)).toEqual(['Tser Pool']);
    expect(sheep.lakes).toEqual([]);
  });
  it('each outline is simple, clockwise on the map, 20 to 40 points, and holds its own centre', () => {
    for (const l of outlined) {
      const p = lakeOutline(l)!, n = p.length;
      expect(n, l.name).toBeGreaterThanOrEqual(20); expect(n, l.name).toBeLessThanOrEqual(40);
      expect(polygonArea(p), `${l.name} clockwise (y down)`).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; expect(cross(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n]), `${l.name}: segments ${i} and ${j} cross`).toBe(false); }
      expect(pointInPolygon(l.center, p), `${l.name} holds its centre`).toBe(true);
    }
  });
  it('each outline\'s bounding ellipse is its center and r, within 1%', () => {
    for (const l of outlined) {
      const p = lakeOutline(l)!, xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2, rx = (Math.max(...xs) - Math.min(...xs)) / 2, ry = (Math.max(...ys) - Math.min(...ys)) / 2;
      expect(Math.abs(cx - l.center[0]), l.name).toBeLessThan(0.01 * rx); expect(Math.abs(cy - l.center[1]), l.name).toBeLessThan(0.01 * ry);
      expect(Math.abs(rx - l.r[0]), l.name).toBeLessThan(0.01 * rx); expect(Math.abs(ry - l.r[1]), l.name).toBeLessThan(0.01 * ry);
    }
  });
});

/** A point inside the traced outline but outside the drawn shore: just inside the traced corner the rounding cuts
 *  deepest. */
function cutCorner(l: WorldData['lakes'][number]): Vec2 {
  const o = lakeOutline(l)! as Vec2[], ring = lakeRing(l)! as Vec2[];
  let best: Vec2 | undefined, bd = 0;
  o.forEach((v, i) => {
    const a = o[(i + o.length - 1) % o.length], b = o[(i + 1) % o.length];
    const p: Vec2 = [v[0] + ((a[0] + b[0]) / 2 - v[0]) * 0.05, v[1] + ((a[1] + b[1]) / 2 - v[1]) * 0.05];
    const d = ringSd(ring, p[0], p[1]); // past the drawn shore
    if (pointInPolygon(p, o) && d > bd) { bd = d; best = p; }
  });
  expect(best, `${l.name}: a traced corner the drawn shore cuts`).toBeDefined();
  return best!;
}
/** The turn (degrees) at each vertex of a closed ring. */
const turns = (r: Vec2[]) => r.map((b, i) => { const a = r[(i + r.length - 1) % r.length], c = r[(i + 1) % r.length]; let d = Math.abs(Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0])) * 180 / Math.PI; if (d > 180) d = 360 - d; return d; });

describe('the drawn shore: one rounded ring for every view', () => {
  it('each drawn shore is the outline with its corners rounded: simple, clockwise, no edge over 0.15 mi, no hard corner, no point it does not need', () => {
    for (const l of outlined) {
      const o = lakeOutline(l)! as Vec2[], r = lakeRing(l)! as Vec2[], n = r.length;
      expect(lakeRing(l), 'worked out once').toBe(r);
      expect(n, `${l.name}: each traced corner a curve`).toBeGreaterThanOrEqual(o.length * 2);
      expect(polygonArea(r), `${l.name} clockwise (y down)`).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) expect(Math.hypot(r[(i + 1) % n][0] - r[i][0], r[(i + 1) % n][1] - r[i][1]), `${l.name} edge ${i}`).toBeLessThanOrEqual(MAX_EDGE_MI + 1e-9);
      for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; expect(cross(r[i], r[(i + 1) % n], r[j], r[(j + 1) % n]), `${l.name}: drawn segments ${i} and ${j} cross`).toBe(false); }
      // the traced outline turns up to 142 degrees at a vertex (Luna Lake's west tip); the drawn shore under 100
      expect(Math.max(...turns(r)), l.name).toBeLessThan(100);
      // and it keeps to the traced one: no drawn point farther than 0.06 mi from it
      for (const p of r) expect(Math.abs(ringSd(o, p[0], p[1])), l.name).toBeLessThan(0.06);
      // the points left out of the rounding lie within SIMPLIFY_MI of the drawn shore
      for (const p of chaikin(o)) expect(Math.abs(ringSd(r, p[0], p[1])), `${l.name} rounding`).toBeLessThan(SIMPLIFY_MI + 1e-9);
    }
    expect(Math.max(...outlined.map((l) => Math.max(...turns(lakeOutline(l)! as Vec2[]))))).toBeGreaterThan(140);
  });
});

describe('the land draws the outlines', () => {
  const atlas = buildAtlas(), sites = Object.values(atlas.scenes).filter((e) => e.campaign === 'cos' && e.worldBounds).map(siteOf);
  const field = new LandField(data, sites);
  it('rho is 0 at a drawn shore\'s centroid, 1 on that shore and grows outside; lakeAt follows the drawn shore', () => {
    data.lakes.forEach((l, i) => {
      const ring = lakeRing(l); if (!ring) return;
      const feet = ring.map((p) => field.feet(p)), [cx, cz] = ringCentroid(feet);
      expect(field.lakeNear(cx, cz, SHORE)).toEqual({ i, rho: 0 });
      expect(field.lakeAt(cx, cz)).toBe(i);
      for (const [x, z] of feet) {
        expect(Math.abs(field.lakeNear(x, z, SHORE).rho - 1), `${l.name} shore`).toBeLessThan(1e-6);
        // a tenth of a shore point's own radius past it, away from the centroid: outside, and no farther out than a
        // tenth of the local radius (the ellipse's meaning of rho 1.1)
        const d = Math.hypot(x - cx, z - cz) || 1, ox = x + ((x - cx) / d) * 0.1 * d, oz = z + ((z - cz) / d) * 0.1 * d;
        if (ringSd(feet, ox, oz) <= 0) continue; // (an inlet's far shore may lie that way)
        const { rho } = field.lakeNear(ox, oz, SHORE_UP_FOR_TEST);
        expect(rho, `${l.name} just off its shore`).toBeGreaterThan(1); expect(rho).toBeLessThanOrEqual(1.1 + 1e-9);
        expect(field.lakeAt(ox, oz)).toBe(-1);
      }
      const far = field.feet([l.center[0], l.center[1] - l.r[1] - 2]); // two miles north of the lake (east of Baratok lies Zarovich)
      expect(field.lakeAt(far[0], far[1])).toBe(-1);
      expect(field.lakeNear(far[0], far[1], SHORE).i).toBe(-1);
    });
  });
  it('no drawn shore runs into the flush band of a map without water of its own (the landing and the tower have theirs)', () => {
    // within FLATTEN_IN of a map's edge the land is not cut to a lake (a map there carries its own water): a shore drawn
    // into a dry map shows the water sheet through the land as pale wedges (Lake Zarovich's inlets in Vallaki did)
    const wet = (path: string) => (JSON.parse(readFileSync(`locations/${path}/scene.json`, 'utf8')) as SceneFile).levels.some((lv) => [...lv.rooms, ...(lv.terrain ?? [])].some((r) => /water/.test(r.floor ?? '')));
    expect(sites.filter((s) => wet(s.path)).map((s) => s.path).sort()).toEqual(expect.arrayContaining(['ch02/L', 'ch11/V']));
    const bad: string[] = [];
    for (const l of outlined) {
      const ring = lakeRing(l)!.map((p) => field.feet(p));
      for (const s of sites) {
        if (s.shoreLake === l.name || wet(s.path)) continue;
        let worst = Infinity;
        for (let i = 0; i < ring.length; i++) for (let k = 0; k < 8; k++) { const a = ring[i], b = ring[(i + 1) % ring.length], t = k / 8; worst = Math.min(worst, mapDist(s.bounds, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)); }
        if (worst < FLATTEN_IN) bad.push(`${l.name} ${Math.round(worst)} ft from ${s.path}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it('a lake without an outline keeps the ellipse\'s rho (the Tser Pool), and a region without lakes has none', () => {
    const i = data.lakes.findIndex((l) => l.name === 'Tser Pool'), l = data.lakes[i], [cx, cz] = field.feet(l.center);
    expect(field.lakeNear(cx + l.r[0] * MI_FT, cz, SHORE).rho).toBeCloseTo(1, 9);
    expect(field.lakeNear(cx, cz + l.r[1] * MI_FT * 0.5, SHORE)).toEqual({ i, rho: 0.5 });
    const empty = new LandField(sheep, []);
    expect(empty.lakeNear(0, 0, SHORE).i).toBe(-1);
  });
  it('Lake Zarovich lies at the level of the landing and the town on its shore, and its water is one sheet in the outline', () => {
    const zi = data.lakes.findIndex((l) => /Zarovich/.test(l.name)), L = sites.find((s) => s.path === 'ch02/L')!, N = sites.find((s) => s.path === 'ch05/N')!;
    // 2.5 ft under the shore maps' bases (the landing's and the town's agree within a tenth of a foot)
    expect(Math.abs(field.lakeLevel(zi) - (L.base - 2.5))).toBeLessThan(0.1); expect(Math.abs(field.lakeLevel(zi) - (N.base - 2.5))).toBeLessThan(0.1);
    const land = buildLand(data, sites.map((s) => ({ ...s, crag: false })), theme);
    land.group.updateMatrixWorld(true);
    try {
      const lakes = land.group.children.find((o) => o.name === 'lakes') as THREE.Mesh;
      expect(lakes).toBeDefined();
      const hit = (x: number, z: number) => new THREE.Raycaster(new THREE.Vector3(x, 5000, z), new THREE.Vector3(0, -1, 0)).intersectObject(lakes);
      const ring = lakeRing(data.lakes[zi])!.map((p) => field.feet(p)), [cx, cz] = ringCentroid(ring);
      expect(hit(cx, cz)[0]?.point.y).toBeCloseTo(field.lakeLevel(zi), 6);
      // the landing's south corners stand on dry ground, its north corners on the water
      const b = L.bounds;
      expect(hit(b.minX, b.maxZ)).toHaveLength(0); expect(hit(b.maxX, b.maxZ)).toHaveLength(0);
      expect(hit(b.minX, b.minZ).length).toBeGreaterThan(0); expect(hit(b.maxX, b.minZ).length).toBeGreaterThan(0);
      // the water sheet spans the outline, not the bounding ellipse
      lakes.geometry.computeBoundingBox();
      const bb = lakes.geometry.boundingBox!, box = field.lakeBox(zi);
      expect(bb.min.x).toBeLessThanOrEqual(box.minX + 1); expect(bb.max.x).toBeGreaterThanOrEqual(box.maxX - 1);
      const tip = field.feet([data.lakes[zi].center[0] - data.lakes[zi].r[0] * 0.98, data.lakes[zi].center[1] - data.lakes[zi].r[1] * 0.9]);
      expect(hit(tip[0], tip[1]), 'the bounding ellipse\'s north-west corner is land').toHaveLength(0);
      // the sheet is the drawn shore, not the traced outline: a traced corner the rounding cuts off is dry
      const cut = field.feet(cutCorner(data.lakes[zi]));
      expect(hit(cut[0], cut[1]), 'a cut corner').toHaveLength(0); expect(field.lakeAt(cut[0], cut[1])).toBe(-1);
    } finally {
      land.group.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose(); } });
    }
  });
});
const SHORE_UP_FOR_TEST = 1.8;

describe('the water in 3-D: rivers end at the shore, the boat only near', () => {
  const atlas = buildAtlas(), sites = Object.values(atlas.scenes).filter((e) => e.campaign === 'cos' && e.worldBounds).map(siteOf).map((s) => ({ ...s, crag: false }));
  it('a river\'s ribbon reaches one step past a lake\'s shore and no farther (the Luna through Luna Lake comes out again)', () => {
    const land = buildLand(data, sites, theme), field = new LandField(data, sites);
    try {
      const rib = land.group.children.find((o) => o.name === 'ribbons') as THREE.Mesh, pos = rib.geometry.attributes.position, col = rib.geometry.attributes.color;
      const blue = new THREE.Color('#5e7d94');
      let wet = 0, deep: string[] = [];
      for (let k = 0; k < pos.count; k++) {
        if (Math.abs(col.getX(k) - blue.r) > 1e-3 || Math.abs(col.getY(k) - blue.g) > 1e-3 || Math.abs(col.getZ(k) - blue.b) > 1e-3) continue; // a road's
        const x = pos.getX(k), z = pos.getZ(k), i = field.lakeAt(x, z); if (i < 0) continue;
        wet++;
        // densified every 160 ft, 40 ft wide: a ribbon point past the shore is within one step and a half-width of it
        const d = -field.lakeSd(i, x, z); if (d > 160 + 20 + 1) deep.push(`${data.lakes[i].name} ${Math.round(d)} ft in at ${Math.round(x)},${Math.round(z)}`);
      }
      expect(wet).toBeGreaterThan(0); // the mouths reach under the water
      expect(deep.slice(0, 5), `${deep.length} river points deep in a lake`).toEqual([]);
    } finally { land.group.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose(); } }); }
  });
  it('Bluto\'s boat is drawn near the eye only: within BOAT_SEEN, not from the whole valley', () => {
    const land = buildLand(data, sites, theme);
    try {
      const lod = land.group.getObjectByName('blutos-boat-lod') as THREE.LOD, boat = land.group.getObjectByName('blutos-boat')!;
      expect(lod).toBeInstanceOf(THREE.LOD); expect(lod.levels.map((l) => l.distance)).toEqual([0, BOAT_SEEN]);
      land.group.updateMatrixWorld(true);
      const cam = new THREE.PerspectiveCamera(), at = lod.getWorldPosition(new THREE.Vector3());
      cam.position.copy(at).add(new THREE.Vector3(0, 2000, 2000)); cam.updateMatrixWorld(); lod.update(cam); expect(boat.visible).toBe(true);
      cam.position.copy(at).add(new THREE.Vector3(0, 60000, 0)); cam.updateMatrixWorld(); lod.update(cam); expect(boat.visible).toBe(false);
    } finally { land.group.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose(); } }); }
  });
});

describe('the inked map bakes the shore', () => {
  it('bakes a signed-distance texture of the outlines (negative in the water, zero on the shore) and reads it instead of the ellipses', () => {
    const field = new LandField(data, []), u = cartoUniforms(field, CARTO_STYLES.gothic);
    expect(u.uLakeTex.value).toBe(0);
    const g = bakeLand(field, u); let r = g.next(); while (!r.done) r = g.next();
    try {
      expect(u.uLakeTex.value).toBe(1);
      const t = u.tLake.value as THREE.DataTexture, land = r.value.land;
      expect(t.image.width).toBe(land.image.width * 2); expect(t.image.height).toBe(land.image.height * 2);
      const o = u.uOrigin.value, s = u.uSize.value, px = t.image.data as Uint16Array;
      const sd = (x: number, z: number) => { const k = Math.min(t.image.width - 1, Math.floor(((x - o.x) / s.x) * t.image.width)), rr = Math.min(t.image.height - 1, Math.floor(((z - o.y) / s.y) * t.image.height)); return THREE.DataUtils.fromHalfFloat(px[rr * t.image.width + k]); };
      const texel = s.x / t.image.width;
      for (const l of data.lakes) {
        const ring = lakeRing(l); if (!ring) continue;
        const feet = ring.map((p) => field.feet(p)), [cx, cz] = ringCentroid(feet);
        expect(sd(cx, cz), `${l.name} centre`).toBeLessThan(-texel);
        for (const [x, z] of feet) expect(Math.abs(sd(x, z)), `${l.name} shore`).toBeLessThan(texel);
      }
      const N = data.pins.find((p) => p.key === 'N')!, [nx, nz] = field.feet(N.pos);
      expect(sd(nx, nz)).toBeGreaterThan(0);
      for (const l of outlined) { const [x, z] = field.feet(cutCorner(l)); expect(field.lakeSd(data.lakes.indexOf(l), x, z), `${l.name}: a cut corner is past the shore`).toBeGreaterThan(0); }
      const K = data.pins.find((p) => p.key === 'K')!, [kx, kz] = field.feet(K.pos);
      expect(sd(kx, kz)).toBe(2000); // far from any lake: the texture's far value
      // the Tser Pool, an ellipse, is in the same texture
      const ti = data.lakes.findIndex((l) => l.name === 'Tser Pool'), [tx, tz] = field.feet(data.lakes[ti].center);
      expect(sd(tx, tz)).toBeLessThan(0);
    } finally { for (const tx of [r.value.land, r.value.cover]) tx.dispose(); }
  });
  it('a region whose lakes are ellipses only keeps the analytic path', () => {
    const field = new LandField(sheep, []), u = cartoUniforms(field, CARTO_STYLES.pastoral);
    const g = bakeLand(field, u); let r = g.next(); while (!r.done) r = g.next();
    try { expect(u.uLakeTex.value).toBe(0); expect(u.tLake.value).toBeNull(); } finally { for (const tx of [r.value.land, r.value.cover]) tx.dispose(); }
  });
});

describe('the flat sheet reads the outlines', () => {
  it('inLake follows the drawn shore, and the ellipse where there is none', () => {
    useWorld(data, 'gothic', 'ch02/barovia-region');
    const z = data.lakes.find((l) => /Zarovich/.test(l.name))!, ring = lakeRing(z)!;
    expect(inLake(ringCentroid(ring))).toBe(true);
    // a traced corner the drawn shore cuts off is land on the sheet too
    const cut = cutCorner(z); expect(pointInPolygon(cut, lakeOutline(z)!)).toBe(true); expect(inLake(cut)).toBe(false);
    expect(inLake(data.pins.find((p) => p.key === 'N')!.pos)).toBe(false);
    expect(inLake([z.center[0] - z.r[0] * 0.98, z.center[1] - z.r[1] * 0.9]), 'the bounding ellipse\'s corner is land').toBe(false);
    const t = data.lakes.find((l) => l.name === 'Tser Pool')!;
    expect(inLake(t.center)).toBe(true); expect(inLake([t.center[0] + t.r[0] * 1.01, t.center[1]])).toBe(false);
  });
});

/** The page canvas the backdrop's textures paint on, stubbed for node. */
function stubCanvas(): void {
  const g = globalThis as unknown as { document?: unknown };
  if (g.document) return;
  const ctx: unknown = new Proxy({}, { get: (_t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
  g.document = { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx }) };
}

describe('the legacy backdrop (the continuous world off) draws the same shore', () => {
  it('Tsolenka Pass stands on its snow beside Luna Lake, not in the lake its bounding ellipse would draw', () => {
    stubCanvas();
    const camp = CAMPAIGNS.find((c) => c.prefixes.includes('ch09'))!, world = worldOf(camp);
    const scene = JSON.parse(readFileSync('locations/ch09/T/scene.json', 'utf8')) as SceneFile, pass = scene.levels.find((l) => l.id === 'pass')!;
    const pin = world.pins.find((p) => p.scenes?.includes('ch09/T'))!, luna = world.lakes.find((l) => l.name === 'Luna Lake')!;
    // the trap: the pass lies inside the lake's bounding ellipse, outside the lake as it is drawn
    expect(((pin.pos[0] - luna.center[0]) / luna.r[0]) ** 2 + ((pin.pos[1] - luna.center[1]) / luna.r[1]) ** 2).toBeLessThan(1);
    expect(inLakeShape(luna, pin.pos as Vec2)).toBe(false);
    const bb = bounds([...pass.rooms.map((r) => r.polygon), ...(pass.terrain ?? []).map((t) => t.polygon)]);
    const bd = buildBackdrop({ ground: 'snow', center: [(bb.minX + bb.maxX) / 2, (bb.minZ + bb.maxZ) / 2], radius: Math.hypot(bb.maxX - bb.minX, bb.maxZ - bb.minZ) / 2, elevation: pass.elevationFt, pin: pin.pos as Vec2, world, theme: camp.theme, bounds: bb, north: pass.north, roads: [], crag: pin.heightFt ?? 0 });
    try {
      bd.updateMatrixWorld(true);
      // the lakes' water (merged by colour with nothing else): unlit, the lake blue hazed toward the mist
      const blue = new THREE.Color('#5e7d94'), mist = new THREE.Color(camp.theme.mist);
      const water = (m: THREE.Mesh) => {
        const mat = m.material as THREE.MeshBasicMaterial; if (!(mat instanceof THREE.MeshBasicMaterial) || mat.vertexColors) return false;
        const d = [mist.r - blue.r, mist.g - blue.g, mist.b - blue.b], c = [mat.color.r - blue.r, mat.color.g - blue.g, mat.color.b - blue.b];
        const t = Math.max(0, Math.min(1, (c[0] * d[0] + c[1] * d[1] + c[2] * d[2]) / (d[0] ** 2 + d[1] ** 2 + d[2] ** 2)));
        return Math.hypot(c[0] - d[0] * t, c[1] - d[1] * t, c[2] - d[2] * t) < 0.01;
      };
      const lakes: THREE.Mesh[] = []; bd.traverse((o) => { if (o instanceof THREE.Mesh && water(o)) lakes.push(o); });
      const land = bd.getObjectByName('land')!, ray = new THREE.Raycaster();
      expect(lakes.length).toBeGreaterThan(0);
      const down = (x: number, z: number, o: THREE.Object3D | THREE.Object3D[]) => { ray.set(new THREE.Vector3(x, 1e5, z), new THREE.Vector3(0, -1, 0)); return Array.isArray(o) ? ray.intersectObjects(o) : ray.intersectObject(o); };
      // round the pass, 300 ft out from each side: snow, no water, and the land not cut down to a lake
      const cx = (bb.minX + bb.maxX) / 2, cz = (bb.minZ + bb.maxZ) / 2;
      for (const [x, z] of [[cx, cz], [bb.minX - 300, cz], [bb.maxX + 300, cz], [cx, bb.minZ - 300], [cx, bb.maxZ + 300]]) {
        expect(down(x, z, lakes), `water at ${x},${z}`).toHaveLength(0);
        if (x !== cx || z !== cz) expect(Math.abs(down(x, z, land)[0].point.y - pass.elevationFt), `land at ${x},${z}`).toBeLessThan(60);
      }
    } finally {
      bd.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose(); } });
    }
  });
});
