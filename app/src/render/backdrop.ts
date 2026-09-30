// Distant scenery for outdoor locations: the land continues past the map edge, forest rings the site, and the
// valley's mountains and Castle Ravenloft stand at their true bearings (from the world map), compressed in
// distance so they sit on the horizon. Unlit by fog on purpose: colours are pre-blended toward the mist.
import * as THREE from 'three';
import type { Theme, WorldData } from '../campaigns';

type P = [number, number];
let MIST = new THREE.Color('#2b2733');

const blend = (hex: string, t: number) => new THREE.Color(hex).lerp(MIST, Math.min(1, Math.max(0, t)));
const lambert = (c: THREE.Color) => new THREE.MeshLambertMaterial({ color: c, fog: false, flatShading: true });

export interface BackdropOpts { center: P; radius: number; elevation: number; pin: P; world: WorldData; theme: Theme; valley?: boolean }

export function buildBackdrop(o: BackdropOpts): THREE.Group {
  const W = o.world, T = o.theme, V = o.valley ? 2.2 : 1;
  MIST = new THREE.Color(T.mist);
  const g = new THREE.Group();
  g.name = 'backdrop';
  g.userData.role = 'backdrop';
  const [cx, cz] = o.center, R = Math.max(60, o.radius), y0 = o.elevation;
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

  // 2. Forest ring: instanced pines from just past the edge out to the tree line.
  const tree = new THREE.ConeGeometry(6, 28, 6); tree.translate(0, 14, 0);
  const n = o.valley ? 1500 : 900, trees = new THREE.InstancedMesh(tree, new THREE.MeshLambertMaterial({ fog: false, flatShading: true }), n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, d = R + 45 + Math.pow(rnd(), 1.3) * 1000, k = 0.6 + rnd() * 0.6;
    p.set(cx + Math.cos(a) * d, y0, cz + Math.sin(a) * d); s.set(k, k * (0.9 + rnd() * 0.4), k); m4.compose(p, q, s);
    trees.setMatrixAt(i, m4); trees.setColorAt(i, blend(i % 3 ? T.forest[0] : T.forest[1], (d - R) / 1100));
  }
  g.add(trees);

  // World-map positions at TRUE scale: miles → feet, x east, z south. Distant things are hazed by distance
  // (pre-blended toward the mist), never fogged by the map's own fog.
  const FT = 5280;
  const toWorld = (w: P) => { const dx = (w[0] - o.pin[0]) * FT, dz = (w[1] - o.pin[1]) * FT; return { x: cx + dx, z: cz + dz, d: Math.hypot(dx, dz) }; };
  const haze = (d: number) => Math.min(0.85, 1 - Math.exp(-d / 32000));
  const hazed = (hex: string, d: number) => lambert(blend(hex, haze(d)));

  // 3. Valley walls: two rings of ridges near the site, higher where the world map has high ground in that direction.
  const highAll = [...W.high, ...W.peaks.map((x) => x.pos)];
  // Bearings toward mapped places within a few miles stay open, so those places show in the distance.
  const openB = W.pins.filter((p) => p.scenes?.length && Math.hypot(p.pos[0] - o.pin[0], p.pos[1] - o.pin[1]) > 0.05 && Math.hypot(p.pos[0] - o.pin[0], p.pos[1] - o.pin[1]) < 6).map((p) => Math.atan2(p.pos[1] - o.pin[1], p.pos[0] - o.pin[0]));
  const openness = (bearing: number) => openB.reduce((k, b) => { const db = Math.abs(Math.atan2(Math.sin(b - bearing), Math.cos(b - bearing))); return Math.min(k, 0.25 + 0.75 * Math.min(1, db / 0.35)); }, 1);
  const heightAt = (bearing: number) => openness(bearing) * highAll.reduce((h, w) => {
    const dx = w[0] - o.pin[0], dy = w[1] - o.pin[1], b = Math.atan2(dy, dx), mi = Math.hypot(dx, dy);
    const db = Math.abs(Math.atan2(Math.sin(b - bearing), Math.cos(b - bearing)));
    return h + Math.exp(-(db * db) / 0.12) * Math.exp(-mi / 7) * 260;
  }, 120 * V);
  for (const [ring, dist, col] of [[0, 1400, '#39413d'], [1, 2600, '#4a4f56']] as const) {
    const count = ring ? 70 : 90;
    for (let i = 0; i < count; i++) {
      const b = (i / count) * Math.PI * 2 + rnd() * 0.08, h = heightAt(b) * (ring ? 1.6 : 1) * (0.75 + rnd() * 0.5), d = dist + R + rnd() * 250;
      const geo = new THREE.ConeGeometry(h * (0.8 + rnd() * 0.4), h, 5); geo.translate(0, h / 2, 0);
      const m = new THREE.Mesh(geo, lambert(blend(col, ring ? 0.45 : 0.25)));
      m.position.set(cx + Math.cos(b) * d, y0 - 10, cz + Math.sin(b) * d); m.rotation.y = rnd() * Math.PI;
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
  const site = (p: { key: string; name: string; type: string; pos: P }) => {
    const t = toWorld(p.pos); if (t.d < 400 || t.d > 60000) return;
    const s = new THREE.Group(); s.position.set(t.x, y0, t.z); s.name = `site-${p.key}`;
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
    } else if (type === 'castle') {
      cyl(150, 600, 0, 0, 0, '#34333a');
      box(130, 60, 100, 0, 0, 600, '#1e1c24'); box(32, 150, 32, -48, -32, 600, '#1e1c24'); box(28, 125, 28, 48, -28, 600, '#1e1c24'); box(26, 105, 26, -44, 36, 600, '#1e1c24'); box(22, 190, 22, 12, 8, 600, '#1e1c24');
      cone(24, 60, -48, -32, 750, '#1e1c24'); cone(21, 55, 48, -28, 725, '#1e1c24'); cone(18, 80, 12, 8, 790, '#1e1c24'); cone(20, 50, -44, 36, 705, '#1e1c24');
      if (p.key === 'K') s.name = 'castle-ravenloft';
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
  g.traverse((c) => { c.userData.role = 'backdrop'; });
  return g;
}
