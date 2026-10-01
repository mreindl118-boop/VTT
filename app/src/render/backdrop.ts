// Distant scenery for outdoor locations: the land continues past the map edge, forest rings the site, and the
// valley's mountains and Castle Ravenloft stand at their true bearings (from the world map), compressed in
// distance so they sit on the horizon. Unlit by fog on purpose: colours are pre-blended toward the mist.
import * as THREE from 'three';
import type { Theme, WorldData } from '../campaigns';

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

  // 1. Ground apron: the land keeps going, fading into mist.
  const apron = new THREE.RingGeometry(0.5, 90000, 96, 16); // a full disc: the map's own floors sit above it
  const pos = apron.attributes.position, cols: number[] = [];
  for (let i = 0; i < pos.count; i++) { const d = Math.hypot(pos.getX(i), pos.getY(i)); const c = blend(T.apron, Math.min(0.9, (d - R) / 26000)); cols.push(c.r, c.g, c.b); }
  apron.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const apronMesh = new THREE.Mesh(apron, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
  apronMesh.rotation.x = -Math.PI / 2; apronMesh.position.set(cx, y0 - 0.35, cz);
  g.add(apronMesh);

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
  if (crag > 0) {
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
  const n = o.valley ? 1500 : 900, trees = new THREE.InstancedMesh(tree, new THREE.MeshLambertMaterial({ fog: false, flatShading: true }), n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, d = R + 45 + Math.pow(rnd(), 1.3) * 1000, k = 0.6 + rnd() * 0.6;
    const tx = cx + Math.cos(a) * d, tz = cz + Math.sin(a) * d;
    if (nearRoad(tx, tz, 14)) { s.set(0, 0, 0); p.set(tx, y0 - 50, tz); m4.compose(p, q, s); trees.setMatrixAt(i, m4); continue; } // a ride through the wood for the road
    p.set(tx, y0, tz); s.set(k, k * (0.9 + rnd() * 0.4), k); m4.compose(p, q, s);
    trees.setMatrixAt(i, m4); trees.setColorAt(i, blend(i % 3 ? T.forest[0] : T.forest[1], (d - R) / 1100));
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
  for (const [ring, dist, col] of (crag > 0 ? [] : [[0, 1400, '#39413d'], [1, 2600, '#4a4f56']]) as readonly (readonly [number, number, string])[]) { // a crag site stands clear of the near ridges
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
  for (const hp of W.high) {
    const t = toWorld(hp); if (t.d < 1500 || t.d > 60000) continue;
    const h = 900 + rnd() * 700, geo = new THREE.ConeGeometry(h * 2.2, h, 7); geo.translate(0, h / 2, 0);
    const m = new THREE.Mesh(geo, hazed('#4a4f56', t.d)); m.position.set(t.x, y0 - 40, t.z); m.rotation.y = rnd() * Math.PI; g.add(m);
  }
  // Named peaks, snow-capped, at their true bearings and distances, at mountain heights.
  for (const pk of W.peaks) {
    const t = toWorld(pk.pos); if (t.d > 80000) continue;
    const h = /Ghakis/.test(pk.name) ? 5200 : /Baratok/.test(pk.name) ? 4500 : /hill/i.test(pk.name) ? 1200 : 3800;
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
    m.rotation.x = -Math.PI / 2; m.scale.set(l.r[0] * FT, l.r[1] * FT, 1); m.position.set(t.x, y0 - 0.2, t.z); g.add(m);
  }

  // 4. The other places on the world map, at true scale and distance: visual only, nothing to click.
  const site = (p: { key: string; name: string; type: string; pos: P; heightFt?: number }) => {
    let t = toWorld(p.pos); if (t.d < 400 || t.d > 60000) return;
    const looming = p.key === 'K' && p.type === 'castle';
    // Ravenloft is drawn for dread, not for the surveyor: pulled in to a few hundred yards and made half again
    // as big, on a cliff that overhangs the water below as if about to let go.
    if (looming) { const k = Math.min(1, 1500 / t.d); t = { x: cx + (t.x - cx) * k, z: cz + (t.z - cz) * k, d: t.d * k }; }
    const lift = looming ? Math.max(p.heightFt ?? 0, 1100) : (p.heightFt ?? 0);
    const S = looming ? 1.25 : 1; // the looming castle is drawn larger; its cliff still stands on the valley floor
    const s = new THREE.Group(); s.position.set(t.x, y0 + lift * S, t.z); s.name = `site-${p.key}`; s.rotation.y = -Math.atan2(E[1], E[0]);
    if (looming) {
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
    } else if (lift > 0) { // its own crag
      const pr = p.type === 'castle' ? 330 : 120;
      const pillar = new THREE.CylinderGeometry(pr, pr * 1.6, lift, 12, 1, true); pillar.translate(0, -lift / 2, 0);
      const pm = new THREE.Mesh(pillar, hazed('#4a4a52', t.d)); s.add(pm);
      const foot = new THREE.Mesh(new THREE.ConeGeometry(pr * 2.4, lift * 0.35, 12), hazed('#3f3f47', t.d)); foot.position.y = -lift + lift * 0.175; s.add(foot);
    }
    const mat = (hex: string) => hazed(hex, t.d);
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
    } else if (type === 'castle') {
      cyl(150, 600, 0, 0, 0, '#34333a');
      box(130, 60, 100, 0, 0, 600, '#1e1c24'); box(32, 150, 32, -48, -32, 600, '#1e1c24'); box(28, 125, 28, 48, -28, 600, '#1e1c24'); box(26, 105, 26, -44, 36, 600, '#1e1c24'); box(22, 190, 22, 12, 8, 600, '#1e1c24');
      cone(24, 60, -48, -32, 750, '#1e1c24'); cone(21, 55, 48, -28, 725, '#1e1c24'); cone(18, 80, 12, 8, 790, '#1e1c24'); cone(20, 50, -44, 36, 705, '#1e1c24');
    } else if (type === 'tower') {
      cyl(14, 60, 0, 0, 0, '#8a8075'); cone(17, 20, 0, 0, 60, '#4a4550', 8);
    } else if (type === 'temple') {
      box(30, 14, 45, 0, 0, 0, '#9a948a'); cone(24, 16, 0, 0, 14, '#4a4550', 4); box(9, 26, 9, 0, -18, 0, '#8f8980'); cone(8, 8, 0, -18, 26, '#4a4550', 4);
    } else if (type === 'ruin') {
      for (let i = 0; i < 5; i++) box(20 + rnd() * 20, 12 + rnd() * 25, 6, -40 + i * 20, rnd() * 30 - 15, 0, '#7a766f', rnd());
    } else if (type === 'falls') {
      // A canyon head: a cliff a thousand feet high, white water down its face, a stone arch bridge across the top, mist at the foot.
      const cliffH = 1000;
      box(700, cliffH, 300, 0, -150, -40, '#4a4a52'); box(520, cliffH * 0.9, 200, -30, -300, -40, '#3f3f47');
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

  // 5. Roads and rivers from the world map at true scale, as flat ribbons on the land. They run under the
  //    map itself (its floors sit above the apron), so only the stretches outside the map show.
  const ribbon = (pts: { x: number; z: number }[], w: number, hex: string, y: number) => {
    const P3: number[] = [], C: number[] = [], h = w / 2;
    const col = (x: number, z: number) => { const c = blend(hex, haze(Math.hypot(x - cx, z - cz))); C.push(c.r, c.g, c.b); };
    const tri = (a: [number, number], b: [number, number], c: [number, number]) => { for (const [x, z] of [a, b, c]) { P3.push(x, y, z); col(x, z); } };
    for (let i = 0; i + 1 < pts.length; i++) {
      const p = pts[i], q = pts[i + 1], dx = q.x - p.x, dz = q.z - p.z, L = Math.hypot(dx, dz) || 1, nx = (-dz / L) * h, nz = (dx / L) * h;
      tri([p.x + nx, p.z + nz], [p.x - nx, p.z - nz], [q.x + nx, q.z + nz]); tri([p.x - nx, p.z - nz], [q.x - nx, q.z - nz], [q.x + nx, q.z + nz]);
      if (i) for (let k = 0; k < 8; k++) { const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2; tri([p.x, p.z], [p.x + Math.cos(a0) * h, p.z + Math.sin(a0) * h], [p.x + Math.cos(a1) * h, p.z + Math.sin(a1) * h]); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P3, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide })));
  };
  for (const r of roadPaths) ribbon(r.pts, r.w, r.hex, y0 - 0.16);
  for (const r of riverPaths) ribbon(r.pts, r.w, r.hex, y0 - 0.18);
  g.traverse((c) => { c.userData.role = 'backdrop'; });
  return g;
}

/** Castle Ravenloft as it stands on the Pillarstone: the plan of `scripts/authoring/castle-ravenloft.py` (x east,
 *  z south, centred on the courtyard) raised to the heights of its levels. Lit windows pick it out at night. */
function ravenloft(s: THREE.Group, mat: (hex: string) => THREE.Material): void {
  const add = (geo: THREE.BufferGeometry, hex: string, x: number, y: number, z: number, ry = 0) => { const m = new THREE.Mesh(geo, mat(hex)); m.position.set(x, y, z); m.rotation.y = ry; s.add(m); return m; };
  const box = (w: number, h: number, d: number, x: number, z: number, y: number, hex: string, ry = 0) => { const b = new THREE.BoxGeometry(w, h, d); b.translate(0, h / 2, 0); return add(b, hex, x, y, z, ry); };
  const cyl = (r: number, h: number, x: number, z: number, y: number, hex: string) => { const c = new THREE.CylinderGeometry(r * 0.92, r, h, 12); c.translate(0, h / 2, 0); return add(c, hex, x, y, z); };
  const cone = (r: number, h: number, x: number, z: number, y: number, hex: string, seg = 12) => { const c = new THREE.ConeGeometry(r, h, seg); c.translate(0, h / 2, 0); return add(c, hex, x, y, z); };
  const gable = (w: number, len: number, h: number, x: number, z: number, y: number, hex: string, alongX: boolean) => {
    const g = new THREE.CylinderGeometry(0, w / Math.SQRT2, len, 4, 1); g.rotateY(Math.PI / 4); g.scale(1, 1, h / (w / 2)); // a square pyramid stretched: a prism roof
    const geo = new THREE.BoxGeometry(w, h, len); // simpler: a ridge box as the roof mass
    geo.translate(0, h / 2, 0); const m = add(geo, hex, x, y, z, alongX ? 0 : Math.PI / 2); m.scale.y = 1; return m;
  };
  const STONE = '#7c858e', DARK = '#4b4f58', ROOF = '#3c3341', GLOW = '#ffd36b';
  const X = (ft: number) => ft - 190, Z = (ft: number) => ft - 170; // castle frame → centred
  // curtain wall, 20 ft thick, 90 ft high, with square corner towers and a battlemented top
  box(380, 90, 20, X(190), Z(10), 0, STONE); box(380, 90, 20, X(190), Z(330), 0, STONE); box(20, 90, 340, X(10), Z(170), 0, STONE); box(20, 90, 340, X(370), Z(170), 0, STONE);
  for (const [x, z] of [[10, 10], [370, 10], [10, 330], [370, 330]]) { box(44, 110, 44, X(x), Z(z), 0, DARK); cone(26, 30, X(x), Z(z), 110, ROOF, 4); }
  // the gatehouse on the west wall and the bridge over the chasm to the gates
  cyl(14, 100, X(0), Z(150), 0, DARK); cyl(14, 100, X(0), Z(190), 0, DARK); cone(16, 26, X(0), Z(150), 100, ROOF); cone(16, 26, X(0), Z(190), 100, ROOF);
  box(90, 8, 22, X(-45), Z(170), -6, '#6d6a66');
  // the keep: the west wing, the main block, the servants' side and the chapel with its dome
  box(60, 130, 160, X(110), Z(170), 0, STONE); gable(50, 150, 20, X(110), Z(170), 130, ROOF, false);
  box(140, 130, 90, X(210), Z(140), 0, STONE); gable(90, 130, 26, X(210), Z(140), 130, ROOF, true);
  box(90, 60, 70, X(215), Z(225), 0, STONE); gable(60, 80, 18, X(215), Z(225), 60, ROOF, true);
  box(50, 50, 50, X(320), Z(75), 0, STONE); // servants' entrance block
  cyl(52, 90, X(275), Z(185), 0, STONE); add(new THREE.SphereGeometry(52, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#4f7a6e', X(275), 90, Z(185));
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; box(6, 14, 2, X(275) + Math.cos(a) * 52, Z(185) + Math.sin(a) * 52, 40, GLOW, -a); }
  // the towers: the turrets, the spiral stair, the heart of sorrow, the south tower, the high tower
  for (const [x, z] of [[95, 120], [95, 235]]) { cyl(16, 140, X(x), Z(z), 0, DARK); cone(18, 30, X(x), Z(z), 140, ROOF, 8); }
  cyl(10, 135, X(145), Z(185), 0, DARK); cone(12, 20, X(145), Z(185), 135, ROOF, 8);
  cyl(18, 250, X(180), Z(145), 0, DARK); cone(20, 36, X(180), Z(145), 250, ROOF, 10);
  cyl(21, 190, X(190), Z(235), 0, DARK); cone(23, 40, X(190), Z(235), 190, ROOF, 10);
  cyl(16, 300, X(215), Z(200), 0, STONE); cone(19, 50, X(215), Z(200), 300, ROOF, 10);
  box(4, 46, 30, X(201), Z(190), 190, '#6d6a66'); // the bridge between the towers
  box(10, 30, 10, X(170), Z(120), 150, DARK);     // the smokestack
  // lit windows on the keep and the towers, seen for a mile across the valley
  const win = (x: number, z: number, y: number, ry: number, w = 8, h = 12) => { const m = box(w, h, 1.5, x, z, y, GLOW, ry); (m.material as THREE.Material).dispose(); m.material = new THREE.MeshBasicMaterial({ color: GLOW, fog: false }); };
  for (const y of [40, 70, 100]) for (const z of [120, 150, 180, 210]) win(X(79), Z(z), y, 0);
  for (const y of [45, 80, 110]) for (const x of [160, 200, 240, 270]) win(X(x), Z(94), y, Math.PI / 2);
  for (const y of [60, 120, 180, 230]) win(X(180) - 18, Z(145), y, 0, 6, 10);
  for (const y of [60, 110, 160]) win(X(190) - 21, Z(235), y, 0, 6, 10);
  for (const y of [120, 200, 270]) win(X(215) - 16, Z(200), y, 0, 6, 10);
  // the overlook on the east and its stone box in the cliff a hundred feet down (the wine cellar)
  box(40, 6, 30, X(390), Z(170), 0, STONE); box(30, 20, 24, X(380), Z(170), -110, DARK);
}
