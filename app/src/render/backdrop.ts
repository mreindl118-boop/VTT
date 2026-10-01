// Distant scenery for outdoor locations: the land continues past the map edge, forest rings the site, and the
// valley's mountains and Castle Ravenloft stand at their true bearings (from the world map), compressed in
// distance so they sit on the horizon. Unlit by fog on purpose: colours are pre-blended toward the mist.
import * as THREE from 'three';
import type { Theme, WorldData } from '../campaigns';
import { merge } from '../kit/pieces';
import { terrainOf } from '../core/terrain';
import RAVENLOFT from '../../../locations/ch04/K/exterior.json';

type P = [number, number];
let MIST = new THREE.Color('#2b2733');

const blend = (hex: string, t: number) => new THREE.Color(hex).lerp(MIST, Math.min(1, Math.max(0, t)));
const lambert = (c: THREE.Color) => new THREE.MeshLambertMaterial({ color: c, fog: false, flatShading: true });

export interface BackdropOpts {
  center: P; radius: number; elevation: number; pin: P; world: WorldData; theme: Theme; valley?: boolean;
  /** The map's own extent (ft) and which plan axis points north; default -z. */
  bounds?: { minX: number; minZ: number; maxX: number; maxZ: number }; north?: '-z' | '+z' | '-x' | '+x';
  /** The map's roads (cobbles, dirt, lanes): a world road leaving the site starts where one of these ends. */
  roads?: P[][];
  /** How far this site stands above the surrounding land: the land, forest and other places sit that far below. */
  crag?: number;
  /** Felled ground: no forest within this many feet of the map (a walled town keeps its approaches clear). */
  clearing?: number;
}

export function buildBackdrop(o: BackdropOpts): THREE.Group {
  const W = o.world, T = o.theme, V = o.valley ? 2.2 : 1;
  MIST = new THREE.Color(T.mist);
  const g = new THREE.Group();
  g.name = 'backdrop';
  g.userData.role = 'backdrop';
  const [cx, cz] = o.center, R = Math.max(60, o.radius), yTop = o.elevation, crag = o.crag ?? 0, y0 = yTop - crag; // y0: the valley floor
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // 1. The land: a heightfield read from the region's terrain (see core/terrain.ts), flattened to the map's own
  //    ground near the map and rising and falling at true scale beyond it. Without a heightfield, a flat apron.
  const terrain = terrainOf(W), HF = terrain.hasHeight;
  // World-map positions at TRUE scale: miles → feet, x east, z south. Distant things are hazed by distance
  // (pre-blended toward the mist), never fogged by the map's own fog.
  const FT = 5280;
  // The map's north axis: world east/south (map x/y) turn into plan x/z accordingly.
  const N: P = o.north === '+z' ? [0, 1] : o.north === '-x' ? [-1, 0] : o.north === '+x' ? [1, 0] : [0, -1];
  const E: P = [-N[1], N[0]], S: P = [-N[0], -N[1]];
  const toPlan = (w: P) => { const dx = (w[0] - o.pin[0]) * FT, dy = (w[1] - o.pin[1]) * FT; return [E[0] * dx + S[0] * dy, E[1] * dx + S[1] * dy] as P; };
  const toWorld = (w: P) => { const [dx, dz] = toPlan(w); return { x: cx + dx, z: cz + dz, d: Math.hypot(dx, dz) }; };
  const haze = (d: number) => Math.min(0.85, 1 - Math.exp(-d / 32000));
  const hazed = (hex: string, d: number) => lambert(blend(hex, haze(d)));
  // plan feet → world miles (the inverse of toPlan) and the ground's height there, flattened to the map near it
  const toMiles = (x: number, z: number): P => { const dx = x - cx, dz = z - cz; return [o.pin[0] + (E[0] * dx + E[1] * dz) / FT, o.pin[1] + (S[0] * dx + S[1] * dz) / FT]; };
  const hPin = HF ? terrain.heightAt(o.pin[0], o.pin[1]) : 0;
  const bbm = o.bounds ?? { minX: cx - R, maxX: cx + R, minZ: cz - R, maxZ: cz + R };
  const mapDist = (x: number, z: number) => Math.max(0, bbm.minX - x, x - bbm.maxX, bbm.minZ - z, z - bbm.maxZ);
  const smooth = (a: number, b: number, t: number) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
  // Distant landmarks are drawn nearer than surveyed (a painter's foreshortening): true distance up to 3,000 ft, then
  // under half of the rest, so the castle and the towns impose on the skyline at their true size.
  const pull = (d: number) => (d <= 3000 ? 1 : (3000 + (d - 3000) * 0.42) / d);
  const kPin = W.pins.find((q) => q.key === 'K' && q.type === 'castle' && Math.hypot(q.pos[0] - o.pin[0], q.pos[1] - o.pin[1]) > 0.3);
  // a sheltered place (the Tser Pool camp, in the gorge at the foot of the falls) is spared the castle's gaze
  const here = W.pins.find((q) => Math.hypot(q.pos[0] - o.pin[0], q.pos[1] - o.pin[1]) < 0.05) as { sheltered?: boolean } | undefined;
  const sight = HF && kPin && !here?.sheltered ? (() => { const [dx0, dz0] = toPlan(kPin.pos), f = pull(Math.hypot(dx0, dz0)), dx = dx0 * f, dz = dz0 * f; return { x: cx + dx, z: cz + dz, top: yTop + (terrain.heightAt(kPin.pos[0], kPin.pos[1]) - hPin) * 1.25 + (kPin.heightFt ?? 0) * 0.55 + 120 }; })() : null;
  const yAt = (x: number, z: number): number => {
    if (!HF) return y0;
    const [mx, my] = toMiles(x, z);
    // relief beyond the map is drawn a quarter steeper than surveyed, as a mapmaker would, so the valley walls close in
    let h = yTop + (terrain.heightAt(mx, my) - hPin) * 1.25; const d = mapDist(x, z);
    // Ravenloft watches every place in the valley: a notch is cut through whatever ridge stands between this map and the
    // castle, deep enough that the line of sight from the map to the castle's brow clears it, widening with distance.
    if (sight) {
      const vx = sight.x - cx, vz = sight.z - cz, L2 = vx * vx + vz * vz, tt = ((x - cx) * vx + (z - cz) * vz) / L2;
      if (tt > 0.02 && tt < 0.94) {
        const lat = Math.abs((x - cx) * vz - (z - cz) * vx) / Math.sqrt(L2), wdt = 350 + tt * 2600;
        if (lat < wdt * 1.6) { const los = yTop + 40 + (sight.top - yTop - 40) * tt - 60, k = smooth(wdt * 1.6, wdt * 0.7, lat); if (h > los) h = h + (los - h) * k; }
      }
    }
    if (crag > 0) { const cliff = yTop - crag * smooth(40, 320, d); return cliff + (h - (yTop - crag)) * smooth(320, 1400, d); }
    return yTop + (h - yTop) * smooth(120, 900, d);
  };
  if (HF) {
    // a polar mesh: fine near the site, coarse toward the horizon
    const radii: number[] = [0]; for (let r = 90; r <= 3000; r += 130) radii.push(r); for (let r = 3400; r <= 16000; r += 450) radii.push(r); for (let r = 18500; r <= 90000; r += 2500) radii.push(r);
    const SEG = 96, P3: number[] = [], C: number[] = [], idx: number[] = [];
    const snowLine = 4200, rock = new THREE.Color('#6a6d74'), hillC = new THREE.Color('#66705f'), forestC = new THREE.Color(T.forest[0]), waterC = new THREE.Color('#5e7d94'), snowC = new THREE.Color('#e4e6ea'), apronC = new THREE.Color(T.forest[1]).lerp(new THREE.Color(T.apron), 0.35);
    const colAt = (x: number, z: number, y: number, d: number) => {
      const [mx, my] = toMiles(x, z), f = terrain.cover('f', mx, my), m = terrain.cover('m', mx, my), hl = terrain.cover('h', mx, my), w = terrain.cover('w', mx, my), mist = terrain.cover('x', mx, my);
      const c = apronC.clone(); if (terrain.hasCover) { c.lerp(forestC, Math.min(1, f * 1.2)); c.lerp(hillC, hl); c.lerp(rock, Math.min(1, m * 1.1 + mist * 0.8)); c.lerp(waterC, Math.min(1, w * 1.5)); }
      for (const q of W.pins) if (q.heightFt) { const [qx, qz] = toPlan(q.pos); const dd = Math.hypot(x - cx - qx, z - cz - qz) / FT; if (dd < 0.3) c.lerp(rock, 1 - dd / 0.3); }
      const above = y - yTop + hPin; if (above > snowLine) c.lerp(snowC, Math.min(1, (above - snowLine) / 1200));
      return c.lerp(MIST, haze(d));
    };
    for (let ri = 0; ri < radii.length; ri++) for (let k = 0; k < SEG; k++) {
      const a = (k / SEG) * Math.PI * 2, r = radii[ri], x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      let y = yAt(x, z) - (mapDist(x, z) < 150 ? 0.4 : 3); // flush where the land meets the map
      for (const l of W.lakes) { const [mx, my] = toMiles(x, z); if (((mx - l.center[0]) / l.r[0]) ** 2 + ((my - l.center[1]) / l.r[1]) ** 2 < 1) y = Math.min(y, yTop + (terrain.heightAt(l.center[0], l.center[1]) - hPin) - 6); }
      P3.push(x, y, z); const c = colAt(x, z, y, r); C.push(c.r, c.g, c.b);
    }
    for (let ri = 0; ri + 1 < radii.length; ri++) for (let k = 0; k < SEG; k++) { const k1 = (k + 1) % SEG, a0 = ri * SEG + k, a1 = ri * SEG + k1, b0 = (ri + 1) * SEG + k, b1 = (ri + 1) * SEG + k1; idx.push(a0, b1, b0, a0, a1, b1); }
    const land = new THREE.BufferGeometry(); land.setAttribute('position', new THREE.Float32BufferAttribute(P3, 3)); land.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); land.setIndex(idx);
    // light baked into the colours (one sun low in the south-west), so the land reads the same under every sky
    const flat = land.toNonIndexed(); flat.computeVertexNormals();
    const fp = flat.attributes.position, fn = flat.attributes.normal, fc = flat.attributes.color, L = new THREE.Vector3(-0.5, 0.75, 0.45).normalize(), nv = new THREE.Vector3();
    for (let i = 0; i < fp.count; i += 3) {
      nv.set(fn.getX(i), fn.getY(i), fn.getZ(i)); const k = 0.55 + 0.6 * Math.max(0, nv.dot(L));
      for (let j = i; j < i + 3; j++) fc.setXYZ(j, Math.min(1, fc.getX(j) * k), Math.min(1, fc.getY(j) * k), Math.min(1, fc.getZ(j) * k));
    }
    const landMesh = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })); landMesh.name = 'land'; g.add(landMesh);
  } else {
    const apron = new THREE.RingGeometry(0.5, 90000, 96, 16); // a full disc: the map's own floors sit above it
    const pos = apron.attributes.position, cols: number[] = [];
    for (let i = 0; i < pos.count; i++) { const d = Math.hypot(pos.getX(i), pos.getY(i)); const c = blend(T.apron, Math.min(0.9, (d - R) / 26000)); cols.push(c.r, c.g, c.b); }
    apron.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const apronMesh = new THREE.Mesh(apron, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
    apronMesh.rotation.x = -Math.PI / 2; apronMesh.position.set(cx, y0 - 3, cz); // well under the map's own ground: big maps have little depth precision to spare
    g.add(apronMesh);
  }
  // Roads and rivers from the world map, in plan feet. A road through this site leaves from the far end of the
  // map's own road in that direction (else the map's edge); the forest and the ridges make way for it.
  type Path = { pts: { x: number; z: number }[]; w: number; hex: string };
  const roadPaths: Path[] = [], riverPaths: Path[] = [], roadBearings: number[] = [];
  // Where a road leaving the site in a direction starts: the far end of the map's own road that reaches
  // farthest that way, else the map's edge.
  const bb = o.bounds ?? { minX: cx - R, maxX: cx + R, minZ: cz - R, maxZ: cz + R };
  const exitFor = (bearing: number) => {
    const ux = Math.cos(bearing), uz = Math.sin(bearing);
    let best: { proj: number; pts: P[] } | undefined;
    for (const poly of o.roads ?? []) {
      let mx = -Infinity; for (const [x, z] of poly) mx = Math.max(mx, (x - cx) * ux + (z - cz) * uz);
      if (!best || mx > best.proj) best = { proj: mx, pts: poly.filter(([x, z]) => (x - cx) * ux + (z - cz) * uz > mx - 6) };
    }
    if (best && best.proj > R * 0.25) { const n = best.pts.length; return { x: best.pts.reduce((a, p) => a + p[0], 0) / n, z: best.pts.reduce((a, p) => a + p[1], 0) / n }; }
    const ts = [ux > 0 ? (bb.maxX - cx) / ux : ux < 0 ? (bb.minX - cx) / ux : Infinity, uz > 0 ? (bb.maxZ - cz) / uz : uz < 0 ? (bb.minZ - cz) / uz : Infinity];
    const t = Math.min(...ts); return { x: cx + ux * t, z: cz + uz * t };
  };
  for (const road of W.roads) {
    const path = /path|trail|track/i.test(road.name), w = path ? 9 : 16, hex = path ? '#6d6150' : '#7a6c5a';
    const ds = road.pts.map((p) => toWorld(p).d);
    const near = ds.indexOf(Math.min(...ds));
    if (ds[near] > 0.5 * FT) { // passes elsewhere: draw it whole
      const pts = road.pts.map(toWorld).filter((t) => t.d < 70000); if (pts.length > 1) roadPaths.push({ pts, w, hex });
      continue;
    }
    // Through this site: each half leaves from the map's own road in that direction.
    for (const half of [road.pts.slice(0, near + 1).reverse(), road.pts.slice(near)]) {
      const out = half.map(toWorld).filter((t) => t.d > R + 150 && t.d < 70000);
      if (!out.length) continue;
      const bearing = Math.atan2(out[0].z - cz, out[0].x - cx);
      roadBearings.push(bearing);
      roadPaths.push({ pts: [exitFor(bearing), ...out], w, hex });
    }
  }
  for (const river of W.rivers) {
    const pts = river.pts.map(toWorld).filter((t) => t.d < 70000); if (pts.length > 1) riverPaths.push({ pts, w: 40, hex: '#5e7d94' });
  }
  const nearRoad = (x: number, z: number, within: number) => roadPaths.some((r) => { for (let i = 0; i + 1 < r.pts.length; i++) { const a = r.pts[i], b = r.pts[i + 1]; const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2)); if (Math.hypot(x - a.x - dx * t, z - a.z - dz * t) < within + r.w / 2) return true; } return false; });

  // 1b. A site on a crag stands on its pillar of rock; the land below is the valley floor.
  if (crag > 0 && !HF) {
    const vil = W.pins.find((p) => p.key === 'E');
    if (vil) { const [vx, vz] = toPlan(vil.pos); cradle(g, { x: cx, z: cz }, cx + vx, cz + vz, Math.hypot(vx, vz), y0, (hex) => lambert(blend(hex, 0.15)), 0); }
    // the Pillarstone: wider at its brow than its foot, so the castle hangs over the black water below
    const pillar = new THREE.CylinderGeometry(R * 1.25, R * 0.5, crag, 12, 3, true); pillar.translate(0, crag / 2, 0);
    const pp = pillar.attributes.position; for (let i = 0; i < pp.count; i++) { const j = ((i * 7919) % 11) / 11 - 0.5; pp.setX(i, pp.getX(i) * (1 + 0.1 * j)); pp.setZ(i, pp.getZ(i) * (1 + 0.1 * j)); }
    pillar.computeVertexNormals();
    const pm = new THREE.Mesh(pillar, lambert(blend('#4a4a52', 0.1))); pm.position.set(cx, y0, cz); g.add(pm);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, b = new THREE.Mesh(new THREE.IcosahedronGeometry(R * 0.18, 0), lambert(blend('#44444c', 0.15))); b.position.set(cx + Math.cos(a) * R * (0.9 + (i % 3) * 0.15), y0 + crag * (0.2 + (i % 4) * 0.18), cz + Math.sin(a) * R * (0.9 + (i % 3) * 0.15)); g.add(b); }
    const lake = new THREE.Mesh(new THREE.CircleGeometry(R * 4, 48), new THREE.MeshBasicMaterial({ color: blend('#1e2a33', 0.1), fog: false })); lake.rotation.x = -Math.PI / 2; lake.position.set(cx, y0 + 0.4, cz); g.add(lake);
  }
  // 2. Forest ring: instanced pines from just past the edge out to the tree line.
  const tree = new THREE.ConeGeometry(6, 28, 6); tree.translate(0, 14, 0);
  // A thick wood presses up to the map's edge (most trees in the first third of a mile), thinning toward the horizon;
  // still one instanced draw for all of them.
  const n = terrain.hasCover ? 7000 : o.valley ? 3000 : 2200, trees = new THREE.InstancedMesh(tree, new THREE.MeshLambertMaterial({ fog: false, flatShading: true }), n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const near = rnd() < 0.62, a = rnd() * Math.PI * 2;
    // trees are placed out from the map's own edge (a rectangle), not its centre, so a long map is hemmed in all round
    const off = near ? Math.max(0, o.clearing ?? 0) + 15 + Math.pow(rnd(), 1.6) * 1800 : 1500 + Math.sqrt(rnd()) * (terrain.hasCover ? 9000 : 2500);
    const ex = (bbm.maxX - bbm.minX) / 2, ez = (bbm.maxZ - bbm.minZ) / 2, ca = Math.cos(a), sa = Math.sin(a);
    const edge = Math.min(Math.abs(ca) > 1e-6 ? ex / Math.abs(ca) : Infinity, Math.abs(sa) > 1e-6 ? ez / Math.abs(sa) : Infinity);
    const d = edge + off, k = (0.75 + rnd() * 0.7) * (1 + off / 6000);
    const tx = (bbm.minX + bbm.maxX) / 2 + ca * d, tz = (bbm.minZ + bbm.maxZ) / 2 + sa * d;
    let drop = nearRoad(tx, tz, 14) || mapDist(tx, tz) < Math.max(30, o.clearing ?? 0); // a ride through the wood for the road; nothing on the map or its felled approaches
    if (terrain.hasCover && !drop) { const [mx, my] = toMiles(tx, tz); const f = terrain.cover('f', mx, my), w = terrain.cover('w', mx, my), m = terrain.cover('m', mx, my); drop = w > 0.3 || m > 0.6 || f + (near ? 0.35 : 0) < 0.4 + rnd() * 0.3; }
    if (drop) { s.set(0, 0, 0); p.set(tx, y0 - 50, tz); m4.compose(p, q, s); trees.setMatrixAt(i, m4); continue; }
    p.set(tx, yAt(tx, tz) - 1, tz); s.set(k, k * (0.9 + rnd() * 0.4), k); m4.compose(p, q, s);
    trees.setMatrixAt(i, m4); trees.setColorAt(i, blend(i % 3 ? T.forest[0] : T.forest[1], haze(off) * 0.9));
  }
  g.add(trees);


  // 3. Valley walls: two rings of ridges near the site, higher where the world map has high ground in that direction.
  const highAll = [...W.high, ...W.peaks.map((x) => x.pos)];
  // Bearings toward mapped places within a few miles stay open, so those places show in the distance.
  const openB = W.pins.filter((p) => p.scenes?.length && Math.hypot(p.pos[0] - o.pin[0], p.pos[1] - o.pin[1]) > 0.05 && Math.hypot(p.pos[0] - o.pin[0], p.pos[1] - o.pin[1]) < 6).map((p) => { const [dx, dz] = toPlan(p.pos); return Math.atan2(dz, dx); });
  openB.push(...roadBearings);
  const loomK = W.pins.find((p) => p.key === 'K' && p.type === 'castle' && Math.hypot(p.pos[0] - o.pin[0], p.pos[1] - o.pin[1]) > 0.05);
  const loomB = loomK ? (() => { const [dx, dz] = toPlan(loomK.pos); return Math.atan2(dz, dx); })() : undefined;
  const openness = (bearing: number) => openB.reduce((k, b) => { const db = Math.abs(Math.atan2(Math.sin(b - bearing), Math.cos(b - bearing))); return Math.min(k, 0.25 + 0.75 * Math.min(1, db / 0.35)); }, 1);
  const heightAt = (bearing: number) => openness(bearing) * highAll.reduce((h, w) => {
    const [dx, dz] = toPlan(w), b = Math.atan2(dz, dx), mi = Math.hypot(dx, dz) / FT;
    const db = Math.abs(Math.atan2(Math.sin(b - bearing), Math.cos(b - bearing)));
    return h + Math.exp(-(db * db) / 0.12) * Math.exp(-mi / 7) * 260;
  }, 120 * V);
  for (const [ring, dist, col] of (crag > 0 || HF ? [] : [[0, 1400, '#39413d'], [1, 2600, '#4a4f56']]) as readonly (readonly [number, number, string])[]) { // a crag site stands clear of the near ridges
    const count = ring ? 70 : 90;
    for (let i = 0; i < count; i++) {
      const b = (i / count) * Math.PI * 2 + rnd() * 0.08, h = heightAt(b) * (ring ? 1.6 : 1) * (0.75 + rnd() * 0.5), d = dist + R + rnd() * 250;
      const rx = cx + Math.cos(b) * d, rz = cz + Math.sin(b) * d, base = h * (0.8 + rnd() * 0.4);
      if (nearRoad(rx, rz, base * 0.6)) continue; // the road passes through a gap in the ridge
      if (loomB !== undefined && Math.abs(Math.atan2(Math.sin(b - loomB), Math.cos(b - loomB))) < 0.55) continue; // nothing stands between the valley and Ravenloft's cliff
      const geo = new THREE.ConeGeometry(base, h, 5); geo.translate(0, h / 2, 0);
      const m = new THREE.Mesh(geo, lambert(blend(col, ring ? 0.45 : 0.25)));
      m.position.set(rx, y0 - 10, rz); m.rotation.y = rnd() * Math.PI;
      g.add(m);
    }
  }
  // High ground from the world map, at true distance: broad hills (one per high point).
  for (const hp of HF ? [] : W.high) {
    const t = toWorld(hp); if (t.d < 1500 || t.d > 60000) continue;
    const h = 900 + rnd() * 700, geo = new THREE.ConeGeometry(h * 2.2, h, 7); geo.translate(0, h / 2, 0);
    const m = new THREE.Mesh(geo, hazed('#4a4f56', t.d)); m.position.set(t.x, y0 - 40, t.z); m.rotation.y = rnd() * Math.PI; g.add(m);
  }
  // Named peaks, snow-capped, at their true bearings and distances, at mountain heights.
  for (const pk of HF ? [] : W.peaks) {
    const t = toWorld(pk.pos); if (t.d > 80000) continue;
    const h = /Ghakis/.test(pk.name) ? 5200 : /Baratok/.test(pk.name) ? 4500 : /fell|tor\b/i.test(pk.name) ? 2600 : /hill/i.test(pk.name) ? 1200 : 3800;
    const rock = new THREE.ConeGeometry(h * 1.1, h, 6); rock.translate(0, h / 2, 0);
    const snow = new THREE.ConeGeometry(h * 0.3, h * 0.28, 6); snow.translate(0, h * 0.86, 0);
    const m = new THREE.Mesh(rock, hazed('#5a5f67', t.d)), c = new THREE.Mesh(snow, hazed('#d9dde3', t.d));
    m.position.set(t.x, y0 - 40, t.z); c.position.copy(m.position);
    if (h < 2000) c.visible = false;
    g.add(m, c);
  }
  // Lakes at true size and position.
  for (const l of W.lakes) {
    const t = toWorld(l.center); if (t.d > 80000) continue;
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: blend('#5e7d94', haze(t.d)), fog: false }));
    m.rotation.x = -Math.PI / 2; m.scale.set(l.r[0] * FT, l.r[1] * FT, 1); m.position.set(t.x, HF ? yTop + (terrain.heightAt(l.center[0], l.center[1]) - hPin) - 5 : y0 - 2.6, t.z); g.add(m);
  }

  // 4. The other places on the world map, at true scale and distance: visual only, nothing to click.
  const site = (p: { key: string; name: string; type: string; pos: P; heightFt?: number }) => {
    const t0 = toWorld(p.pos); if (t0.d < 400 || t0.d > 60000) return;
    const f = pull(t0.d), t = { x: cx + (t0.x - cx) * f, z: cz + (t0.z - cz) * f, d: t0.d * f };
    const dropY = HF ? Math.max(0, yAt(t0.x, t0.z) - yAt(t.x, t.z)) : 0; // the ground at the drawn spot may lie lower than at the true one
    const looming = p.key === 'K' && p.type === 'castle';
    // Ravenloft is drawn for dread, not for the surveyor: pulled in to a few hundred yards and made half again
    // as big, on a cliff that overhangs the water below as if about to let go.
    // Ravenloft keeps its true map position: a thousand feet up on the Pillarstone, the valley at its feet.
    const lift = p.heightFt ?? 0;
    const S = 1; // the looming castle is drawn larger; its cliff still stands on the valley floor
    // on a heightfield the land carries the crag's shoulder; the sheer rock above it (ROCK) is drawn here
    const ROCK = HF && lift > 0 ? lift * 0.55 : 0;
    const s = new THREE.Group(); s.position.set(t.x, HF ? Math.max(yAt(t.x, t.z), yAt(t0.x, t0.z)) + ROCK : y0 + lift * S, t.z); s.name = `site-${p.key}`; s.rotation.y = -Math.atan2(E[1], E[0]);
    if (looming && !HF) {
      const toward = Math.atan2(cz - t.z, cx - t.x); // the cliff leans out toward the viewer's side
      s.rotation.z = 0.06 * Math.cos(toward - s.rotation.y); s.rotation.x = -0.06 * Math.sin(toward - s.rotation.y);
      s.scale.setScalar(S);
      // an overhanging face: wider at the top than the foot, split by ledges, with boulders breaking from it
      const face = new THREE.CylinderGeometry(420, 150, lift, 10, 3, true); face.translate(0, -lift / 2, 0);
      const pos = face.attributes.position; for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); const j = ((i * 7919) % 13) / 13 - 0.5; pos.setX(i, pos.getX(i) * (1 + 0.12 * j)); pos.setZ(i, pos.getZ(i) * (1 + 0.12 * j)); if (y > -lift * 0.95 && y < -5) pos.setY(i, y + 40 * j); }
      face.computeVertexNormals();
      s.add(new THREE.Mesh(face, hazed('#3a3a42', t.d)));
      for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2 + 0.3, r = 300 + (i % 3) * 60, h = -lift * (0.15 + (i % 5) * 0.16); const b = new THREE.Mesh(new THREE.IcosahedronGeometry(45 + (i % 4) * 25, 0), hazed('#44444c', t.d)); b.position.set(Math.cos(a) * r, h, Math.sin(a) * r); s.add(b); }
      // black water at the foot of the cliff, and the river that feeds it
      const lake = new THREE.Mesh(new THREE.CircleGeometry(900, 40), new THREE.MeshBasicMaterial({ color: blend('#1e2a33', haze(t.d) * 0.5), fog: false })); lake.rotation.x = -Math.PI / 2; lake.position.y = -lift + 0.4; s.add(lake);
      const spray = new THREE.Mesh(new THREE.TorusGeometry(260, 60, 6, 24), new THREE.MeshBasicMaterial({ color: '#c9d2d8', transparent: true, opacity: 0.35, fog: false })); spray.rotation.x = -Math.PI / 2; spray.position.y = -lift + 30; s.add(spray);
    } else if (lift > 0) { // its own crag: the Pillarstone, sheer where the land's own hump is too soft to carry a castle
      // The Pillarstone: not a drum but a cluster of tall faceted rock shards, the central one carrying the castle's
      // floor, the others leaning off it and falling away down the slope, every vertex roughened.
      const pr = p.type === 'castle' ? 250 : 90, ph = HF ? ROCK : lift, embed = HF ? lift * 0.4 + dropY : 0;
      let sd = 97; const r1 = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
      // a column of rock: near-vertical sides fluted into ribs (the same jitter all the way down a rib, so the face
      // reads as jointed stone, not lumps), a little irregular ledge every so often
      const column = (x: number, z: number, rBase: number, rTop: number, h: number, y: number, lean: number, hex: string, segs = 9) => {
        const g2 = new THREE.CylinderGeometry(rTop, rBase, h, segs, 7); g2.translate(0, -h / 2, 0);
        const rib = Array.from({ length: segs + 1 }, () => 1 + (r1() - 0.5) * 0.5); rib[segs] = rib[0];
        const ledge = Array.from({ length: 8 }, () => 1 + (r1() - 0.5) * 0.12);
        const pv = g2.attributes.position;
        for (let i = 0; i < pv.count; i++) {
          const ang = Math.atan2(pv.getZ(i), pv.getX(i)), si = Math.round(((ang + Math.PI) / (Math.PI * 2)) * segs) % (segs + 1), ri = Math.min(7, Math.round((-pv.getY(i) / h) * 7));
          const k = rib[si] * ledge[ri]; pv.setX(i, pv.getX(i) * k); pv.setZ(i, pv.getZ(i) * k);
        }
        g2.computeVertexNormals();
        const m = new THREE.Mesh(g2, hazed(hex, t.d)); m.position.set(x, y, z); m.rotation.set(lean * (r1() - 0.5), r1() * Math.PI, lean * (r1() - 0.5)); s.add(m);
      };
      // the Pillarstone itself: sheer, a shade wider at the foot, its top the castle's floor
      // the core, in two stacked drums offset a little (a jointed column, not a cylinder), flaring toward its foot
      column(0, 0, pr * 1.5, pr * 1.18, ph * 0.55 + embed, -ph * 0.45, 0, '#3f3f47', 13);
      column(pr * 0.05, -pr * 0.04, pr * 1.16, pr * 1.0, ph * 0.47, 0.5, 0, '#43434b', 13);
      // spurs and buttresses crowding the core almost to its brow, so the outline is ragged from every side
      for (let i = 0; i < 13; i++) {
        const a = (i / 13) * Math.PI * 2 + r1() * 0.4, d = pr * (0.85 + r1() * 0.35), h = ph * (0.55 + r1() * 0.43);
        column(Math.cos(a) * d, Math.sin(a) * d, pr * (0.32 + r1() * 0.22), pr * (0.06 + r1() * 0.12), h + embed, -ph + h + 0.5, 0.14, i % 3 === 0 ? '#3a3a42' : i % 3 === 1 ? '#4a4a52' : '#45454d', 7);
      }
      for (let i = 0; i < 4; i++) { const a = r1() * Math.PI * 2, d = pr * (1.5 + r1() * 0.6), h = ph * (0.25 + r1() * 0.3); column(Math.cos(a) * d, Math.sin(a) * d, pr * 0.16, pr * 0.05, h + embed, -ph + h, 0.2, '#47474f', 6); }
      // talus at the foot
      for (let i = 0; i < 18; i++) { const a = r1() * Math.PI * 2, r = pr * (1.15 + r1() * 1.1); const bd = new THREE.Mesh(new THREE.IcosahedronGeometry(pr * (0.05 + r1() * 0.09), 0), hazed('#44444c', t.d)); bd.position.set(Math.cos(a) * r, -ph + r1() * 12, Math.sin(a) * r); s.add(bd); }
      // mist pooled round the foot of the rock: soft-edged layers (a radial fade, no rim to catch the eye)
      if (HF) for (const [k, op, rr] of [[0.92, 0.5, 3.8], [0.72, 0.32, 3.0], [0.5, 0.18, 2.4]] as const) {
        const ring = new THREE.Mesh(new THREE.CircleGeometry(pr * rr, 40), new THREE.MeshBasicMaterial({ color: '#c6ccd6', map: mistTexture(), transparent: true, opacity: op, fog: false, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = -ph * k; s.add(ring);
      }

      if (!HF) { const foot = new THREE.Mesh(new THREE.ConeGeometry(pr * 2.4, lift * 0.35, 12), hazed('#3f3f47', t.d)); foot.position.y = -lift + lift * 0.175; s.add(foot); }
    }
    const mat = (hex: string) => hazed(hex, t.d * 0.6); // landmarks keep their shape through the haze
    const box = (w: number, h: number, d: number, x: number, z: number, y: number, hex: string, ry = 0) => { const b = new THREE.BoxGeometry(w, h, d); b.translate(0, h / 2, 0); const m = new THREE.Mesh(b, mat(hex)); m.position.set(x, y, z); m.rotation.y = ry; s.add(m); };
    const cone = (r: number, h: number, x: number, z: number, y: number, hex: string, seg = 6) => { const c = new THREE.ConeGeometry(r, h, seg); c.translate(0, h / 2, 0); const m = new THREE.Mesh(c, mat(hex)); m.position.set(x, y, z); s.add(m); };
    const cyl = (r: number, h: number, x: number, z: number, y: number, hex: string) => { const c = new THREE.CylinderGeometry(r * 0.9, r, h, 8); c.translate(0, h / 2, 0); const m = new THREE.Mesh(c, mat(hex)); m.position.set(x, y, z); s.add(m); };
    const type = p.type, town = /Town/i.test(p.name);
    if (type === 'settlement') {
      const n = town ? 18 : 9, spread = town ? 700 : 420;
      for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * spread, x = Math.cos(a) * d, z = Math.sin(a) * d, w = 22 + rnd() * 14, dd = 20 + rnd() * 12, h = 10 + rnd() * 4;
        box(w, h, dd, x, z, 0, '#8f8676', rnd() * Math.PI); cone(Math.max(w, dd) * 0.75, 9, x, z, h, '#3d3a3e', 4); }
      box(14, 30, 14, 0, 0, 0, '#9a948a'); cone(11, 18, 0, 0, 30, '#4a4550', 4);
      if (town) for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; box(120, 18, 6, Math.cos(a) * 760, Math.sin(a) * 760, 0, '#6d6a66', -a); }
    } else if (type === 'camp') {
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; cone(9, 11, Math.cos(a) * 30, Math.sin(a) * 30, 0, i === 2 ? '#a83a30' : '#c9bfa6', 5); }
      for (let i = 0; i < 3; i++) box(12, 7, 6, -60 + i * 25, 55, 0, '#5a4632', 0.4);
    } else if (type === 'castle' && p.key === 'K') {
      ravenloft(s, mat);
      // the valley always opens toward the Village of Barovia, whichever map we look from
      const vil = W.pins.find((q) => q.key === 'E'), vp = vil ? toPlan(vil.pos) : [cx - t.x, cz - t.z];
      const cr = new THREE.Group(); cr.position.set(t.x, 0, t.z); if (!HF) g.add(cr);
      cradle(cr, { x: 0, z: 0 }, (vil ? cx + vp[0] : cx) - t.x, (vil ? cz + vp[1] : cz) - t.z, Math.hypot((vil ? cx + vp[0] : cx) - t.x, (vil ? cz + vp[1] : cz) - t.z), y0 - lift, (hex, d) => hazed(hex, d), t.d);
    } else if (type === 'castle') {
      // Argynvostholt: a ruined manor of grey stone on its ridge, roofs fallen in, one wing standing taller, and the
      // slender beacon tower at its west end (dark until the beacon is relit).
      box(120, 34, 60, 0, 0, 0, '#5d5c62'); box(60, 46, 50, 50, -10, 0, '#57565c'); box(40, 26, 40, -70, 18, 0, '#5d5c62');
      for (const [x, z, w] of [[-20, 0, 50], [45, -10, 40]] as const) { const r2 = new THREE.ConeGeometry(w * 0.72, 18, 4); r2.rotateY(Math.PI / 4); r2.translate(0, 9, 0); const m2 = new THREE.Mesh(r2, mat('#3a3740')); m2.position.set(x, x < 0 ? 34 : 46, z); m2.scale.set(1.3, 1, 0.75); s.add(m2); }
      for (let i = 0; i < 7; i++) box(5 + (i % 3) * 3, 6 + (i % 4) * 4, 3, -55 + i * 16, -32, 34 - (i % 3) * 4, '#4c4b51');   // broken parapet
      cyl(9, 120, -95, 10, 0, '#64636a'); box(16, 10, 16, -95, 10, 120, '#4c4b51'); cone(11, 14, -95, 10, 130, '#3a3740', 8);  // the beacon tower
      for (let i = 0; i < 3; i++) box(12 + i * 6, 5, 3, -20 + i * 30, 34, 0, '#4c4b51');
        } else if (type === 'tower') {
      cyl(14, 60, 0, 0, 0, '#8a8075'); cone(17, 20, 0, 0, 60, '#4a4550', 8);
    } else if (type === 'temple') {
      box(30, 14, 45, 0, 0, 0, '#9a948a'); cone(24, 16, 0, 0, 14, '#4a4550', 4); box(9, 26, 9, 0, -18, 0, '#8f8980'); cone(8, 8, 0, -18, 26, '#4a4550', 4);
    } else if (type === 'ruin') {
      for (let i = 0; i < 5; i++) box(20 + rnd() * 20, 12 + rnd() * 25, 6, -40 + i * 20, rnd() * 30 - 15, 0, '#7a766f', rnd());
    } else if (type === 'falls') {
      // A canyon head: white water down the face, a stone arch bridge across the top, mist at the foot. On a heightfield
      // the land itself is the cliff (the river's cut), so only the fall, the bridge and the mist are added, sized to
      // the drop the land actually makes there; without one, a cliff a thousand feet high stands in for it.
      let cliffH = 1000;
      if (HF) { let low = yAt(t.x, t.z); for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; low = Math.min(low, yAt(t.x + Math.cos(a) * 900, t.z + Math.sin(a) * 900)); } cliffH = Math.max(140, Math.min(420, yAt(t.x, t.z) - low)); s.position.y -= cliffH; }
      else { box(700, cliffH, 300, 0, -150, -40, '#4a4a52'); box(520, cliffH * 0.9, 200, -30, -300, -40, '#3f3f47'); }
      box(70, cliffH - 60, 12, 0, 6, 0, '#e6ecf0'); box(40, cliffH - 60, 8, 10, 8, 0, '#f4f7f9');
      // gap in the cliff for the bridge, spanned by an arch
      box(60, 70, 300, -190, -150, cliffH, '#5c5c64'); box(60, 70, 300, 190, -150, cliffH, '#5c5c64');
      const arch = new THREE.Mesh(new THREE.TorusGeometry(160, 22, 8, 24, Math.PI), mat('#6b6660')); arch.position.set(0, cliffH + 10, -60); s.add(arch);
      box(380, 14, 24, 0, -60, cliffH + 168, '#6b6660'); box(380, 8, 3, 0, -48, cliffH + 182, '#7a756e'); box(380, 8, 3, 0, -72, cliffH + 182, '#7a756e');
      for (const m of [[-90, 40, 90], [60, 60, 70], [0, 110, 40]]) { const mist = new THREE.Mesh(new THREE.IcosahedronGeometry(m[1], 1), new THREE.MeshBasicMaterial({ color: '#dfe6ea', transparent: true, opacity: 0.55, fog: false })); mist.position.set(m[0], m[2] * 0.6, 40 + m[0] * 0.2); s.add(mist); }
      // the river below the falls, running toward the viewer's side of the canyon
      box(60, 0.6, 1400, 0, 750, 0.1, '#5e7d94');
    } else return;
    // a settlement's or landmark's shadow disc to seat it on the land
    const disc = new THREE.Mesh(new THREE.CircleGeometry(type === 'settlement' ? 900 : type === 'falls' ? 900 : 120, 24), new THREE.MeshBasicMaterial({ color: blend(type === 'falls' ? '#3b3f44' : T.apron, haze(t.d) * 0.6 + 0.2), fog: false })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.05; s.add(disc);
    g.add(s);
  };
  for (const p of W.pins) { if (Math.hypot(p.pos[0] - o.pin[0], p.pos[1] - o.pin[1]) < 0.05) continue; site(p); }
  const rl = g.getObjectByName('site-K'); if (rl) rl.name = 'castle-ravenloft';
  // 4b. The moon: a great disc low over the mountains in its true phase (set from the clock), behind Ravenloft where the
  //     castle is in view, lighting it from behind and above.
  {
    const mb = loomB ?? -Math.PI * 0.35, MD = 42000;
    const mx = cx + Math.cos(mb) * MD, mz = cz + Math.sin(mb) * MD, my = y0 + 9000;
    const tex = moonTexture(0.5), mm = new THREE.SpriteMaterial({ map: tex, fog: false, transparent: true, depthWrite: false });
    const moon = new THREE.Sprite(mm); moon.scale.set(9500, 9500, 1); moon.position.set(mx, my, mz); moon.name = 'moon'; moon.renderOrder = -1; g.add(moon);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: '#cfd6ea', fog: false, transparent: true, opacity: 0.55, depthWrite: false })); halo.scale.set(26000, 26000, 1); halo.position.copy(moon.position); halo.renderOrder = -2; g.add(halo);
    g.userData.setMoon = (phase: number, night: boolean) => {
      drawMoon(tex.image as HTMLCanvasElement, phase); tex.needsUpdate = true;
      const lit = 1 - Math.abs(phase - 0.5) * 2; (halo.material as THREE.SpriteMaterial).opacity = (night ? 0.55 : 0.2) * (0.25 + lit * 0.75); mm.opacity = night ? 1 : 0.55;
    };
    if (rl) { const light = new THREE.DirectionalLight('#c3cbe6', 0.85); light.position.set(mx - rl.position.x, my - rl.position.y, mz - rl.position.z).normalize().multiplyScalar(5000).add(rl.position); light.target = rl; g.add(light, rl); }
  }


  // 5. Roads and rivers from the world map at true scale, as flat ribbons on the land. They run under the
  //    map itself (its floors sit above the apron), so only the stretches outside the map show.
  const ribbon = (pts0: { x: number; z: number }[], w: number, hex: string, y: number) => {
    const P3: number[] = [], C: number[] = [], h = w / 2;
    const col = (x: number, z: number) => { const c = blend(hex, haze(Math.hypot(x - cx, z - cz))); C.push(c.r, c.g, c.b); };
    const tri = (a: [number, number], b: [number, number], c: [number, number]) => { for (const [x, z] of [a, b, c]) { P3.push(x, HF ? yAt(x, z) + (y - y0) + 3 : y, z); col(x, z); } };
    // on a heightfield the ribbon follows the ground: segments are split every 200 ft
    const pts: { x: number; z: number }[] = [];
    for (let i = 0; i < pts0.length; i++) { if (i && HF) { const a = pts0[i - 1], b = pts0[i], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 200)); for (let k = 1; k < n; k++) pts.push({ x: a.x + (b.x - a.x) * k / n, z: a.z + (b.z - a.z) * k / n }); } pts.push(pts0[i]); }
    for (let i = 0; i + 1 < pts.length; i++) {
      const p = pts[i], q = pts[i + 1], dx = q.x - p.x, dz = q.z - p.z, L = Math.hypot(dx, dz) || 1, nx = (-dz / L) * h, nz = (dx / L) * h;
      tri([p.x + nx, p.z + nz], [p.x - nx, p.z - nz], [q.x + nx, q.z + nz]); tri([p.x - nx, p.z - nz], [q.x - nx, q.z - nz], [q.x + nx, q.z + nz]);
      if (i) for (let k = 0; k < 8; k++) { const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2; tri([p.x, p.z], [p.x + Math.cos(a0) * h, p.z + Math.sin(a0) * h], [p.x + Math.cos(a1) * h, p.z + Math.sin(a1) * h]); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P3, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide })));
  };
  for (const r of roadPaths) ribbon(r.pts, r.w, r.hex, y0 - 2.2);
  for (const r of riverPaths) ribbon(r.pts, r.w, r.hex, y0 - 2.4);
  collapse(g);
  g.traverse((c) => { c.userData.role = 'backdrop'; });
  return g;
}

/** Hundreds of ridges, peaks and distant buildings each carry a material of their own; nothing out there ever moves
 *  or is picked, so every opaque solid-coloured mesh folds into one mesh per material look. Instanced forest, the
 *  vertex-coloured apron and ribbons, and the translucent mists keep their own draw. */
/** The moon's face in a phase (0 new, 0.5 full): the lit part bright and mottled with maria, the dark part a faint earthshine. */
function drawMoon(c: HTMLCanvasElement, phase: number): void {
  const x = c.getContext('2d')!, S = c.width, r = S * 0.46, o = S / 2;
  x.clearRect(0, 0, S, S);
  x.fillStyle = 'rgba(70,74,92,0.55)'; x.beginPath(); x.arc(o, o, r, 0, Math.PI * 2); x.fill();          // earthshine
  // the lit part: a half disc on the lit side plus an ellipse that adds (gibbous) or cuts (crescent)
  const waxing = phase < 0.5, k = Math.cos(phase * Math.PI * 2), side = waxing ? 1 : -1;
  const lit = document.createElement('canvas'); lit.width = lit.height = S; const l = lit.getContext('2d')!;
  l.fillStyle = '#efeadb'; l.beginPath(); l.arc(o, o, r, -Math.PI / 2, Math.PI / 2, side < 0); l.closePath(); l.fill();
  l.globalCompositeOperation = k > 0 ? 'destination-out' : 'source-over';
  l.beginPath(); l.ellipse(o, o, Math.abs(k) * r, r, 0, 0, Math.PI * 2); l.fill();
  l.globalCompositeOperation = 'source-atop';                                                          // maria on the lit face
  l.fillStyle = 'rgba(150,150,140,0.45)';
  for (const [a, b, rr] of [[-0.25, -0.2, 0.22], [0.15, -0.3, 0.16], [0.05, 0.1, 0.26], [-0.3, 0.25, 0.14], [0.3, 0.3, 0.12]]) { l.beginPath(); l.arc(o + a * r, o + b * r, rr * r, 0, Math.PI * 2); l.fill(); }
  x.drawImage(lit, 0, 0);
}
function moonTexture(phase: number): THREE.CanvasTexture { const c = document.createElement('canvas'); c.width = c.height = 256; drawMoon(c, phase); return new THREE.CanvasTexture(c); }
function haloTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!;
  const g = x.createRadialGradient(64, 64, 10, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.35, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}
let MIST_TEX: THREE.CanvasTexture | null = null;
/** A soft ring of mist: clear at the centre (the rock stands there), densest a third of the way out, fading to nothing at the rim. */
function mistTexture(): THREE.CanvasTexture {
  if (MIST_TEX) return MIST_TEX;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.28, 'rgba(255,255,255,0.15)'); g.addColorStop(0.45, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); MIST_TEX = new THREE.CanvasTexture(c); return MIST_TEX;
}
function collapse(g: THREE.Group): void {
  const buckets = new Map<string, { material: THREE.Material; gs: THREE.BufferGeometry[] }>();
  const drop: THREE.Object3D[] = [];
  g.updateMatrixWorld(true);
  g.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material)) return;
    const mat = m.material as THREE.MeshLambertMaterial | THREE.MeshBasicMaterial;
    if (mat.transparent || mat.vertexColors || !mat.color) return;
    if (!m.visible) { drop.push(m); return; }
    const key = [mat.type, mat.color.getHexString(), mat.fog, (mat as THREE.MeshLambertMaterial).flatShading, mat.side, mat.depthWrite].join('|');
    let b = buckets.get(key);
    if (!b) { b = { material: mat, gs: [] }; buckets.set(key, b); }
    b.gs.push(m.geometry.clone().applyMatrix4(m.matrixWorld));
    drop.push(m);
  });
  for (const o of drop) o.removeFromParent();
  for (const { material, gs } of buckets.values()) g.add(new THREE.Mesh(merge(gs), material));
}

/** The mountains the castle is tucked into: a horseshoe of peaks behind and beside it, open only on the bearing of
 *  the steep valley that runs down to the village, whose two walls are rows of ridges flanking that line. */
function cradle(g: THREE.Group, at: { x: number; z: number }, towardX: number, towardZ: number, dist: number, y0: number, mat: (hex: string, d: number) => THREE.Material, d0: number, S = 1): void {
  const b0 = Math.atan2(towardZ - at.z, towardX - at.x);
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const peak = (x: number, z: number, h: number, r: number) => { const c = new THREE.ConeGeometry(r, h, 7); c.translate(0, h / 2, 0); const m = new THREE.Mesh(c, mat('#4f5560', d0)); m.position.set(x, y0 - 40, z); m.rotation.y = rnd() * Math.PI; g.add(m); if (h > 1800) { const sn = new THREE.ConeGeometry(r * 0.28, h * 0.26, 7); sn.translate(0, h * 0.87, 0); const sm = new THREE.Mesh(sn, mat('#d9dde3', d0)); sm.position.copy(m.position); sm.rotation.y = m.rotation.y; g.add(sm); } };
  for (let i = 0; i < 14; i++) { // the horseshoe
    const a = b0 + Math.PI + (i / 13 - 0.5) * Math.PI * 1.45, r = (1500 + rnd() * 900) * S;
    peak(at.x + Math.cos(a) * r, at.z + Math.sin(a) * r, (2200 + rnd() * 1400) * S, (900 + rnd() * 500) * S);
  }
  const L = Math.min(dist * 0.8, 9000 * S), n = Math.max(3, Math.round(L / (900 * S)));
  for (let i = 0; i < n; i++) for (const side of [-1, 1]) { // the valley walls, stepping down toward the village
    const t = (i + 0.5) / n, cx = at.x + Math.cos(b0) * (600 * S + t * L), cz = at.z + Math.sin(b0) * (600 * S + t * L), off = (650 + rnd() * 250) * S * side;
    const h = (1600 - t * 1000 + rnd() * 300) * S;
    peak(cx + Math.cos(b0 + Math.PI / 2) * off, cz + Math.sin(b0 + Math.PI / 2) * off, h, h * 0.55);
  }
}

/** Castle Ravenloft as it stands on the Pillarstone: the plan of `scripts/authoring/castle-ravenloft.py` (x east,
 *  z south, centred on the courtyard) raised to the heights of its levels. Lit windows pick it out at night. */
function ravenloft(s: THREE.Group, mat: (hex: string) => THREE.Material): void {
  // Built from the castle's own plans (scripts/authoring/ravenloft-exterior.py): every column of the castle rises to its
  // highest roofed room, the curtain walls stand at their height with battlements, every stair tower is a round tower
  // with a conical cap, and windows burn along the outer faces.
  const E = RAVENLOFT as { blocks: number[][]; walls: number[][]; towers: number[][]; windows: number[][] };
  const STONE = '#7a828b', STONE2 = '#6c737c', SLATE = '#3a3340', DARK = '#4b4f58', GLOW = '#ffd36b';
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, ry = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; s.add(o); return o; };
  const box = (w: number, h: number, d: number, x: number, z: number, y: number, hex: string, ry = 0) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return add(g, mat(hex), x, y, z, ry); };
  // the massing, with a slate cap and a parapet on every roof
  for (const [x, z, w, d, h] of E.blocks) {
    box(w, h, d, x, z, 0, h > 120 ? STONE2 : STONE);
    box(w + 0.6, 1.6, d + 0.6, x, z, h, SLATE);
  }
  // curtain walls with merlons
  for (const [x0, z0, x1, z1, h] of E.walls) {
    const L = Math.hypot(x1 - x0, z1 - z0), ry = -Math.atan2(z1 - z0, x1 - x0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    box(L + 10, h, 10, mx, mz, 0, STONE, ry);
    const n = Math.floor(L / 8), ux = (x1 - x0) / L, uz = (z1 - z0) / L;
    for (let i = 0; i <= n; i++) { const t = -L / 2 + i * 8; box(4, 4, 10, mx + ux * t, mz + uz * t, h, STONE, ry); }
  }
  // the round towers and their caps
  for (const [x, z, r, top] of E.towers) {
    const c = new THREE.CylinderGeometry(r * 0.94, r, top, 14); c.translate(0, top / 2, 0); add(c, mat(DARK), x, 0, z);
    const cap = new THREE.ConeGeometry(r + 2.5, r * 2.4, 14); cap.translate(0, r * 1.2, 0); add(cap, mat(SLATE), x, top, z);
    const ring = new THREE.CylinderGeometry(r + 1.5, r + 1.5, 3, 14); ring.translate(0, 1.5, 0); add(ring, mat(STONE2), x, top - 3, z);
  }
  // lit windows (unlit material: they glow through the night and the mist)
  const glow = new THREE.MeshBasicMaterial({ color: GLOW, fog: false });
  for (const [x, z, y, alongZ] of E.windows) { const g = new THREE.BoxGeometry(alongZ ? 1 : 5, 9, alongZ ? 5 : 1); g.translate(0, 4.5, 0); add(g, glow, x, y, z); }
  // the overlook on the east and its stone box in the cliff below (the wine cellar)
  box(40, 6, 30, 200, 0, 0, STONE); box(30, 20, 24, 190, 0, -110, DARK);
}
