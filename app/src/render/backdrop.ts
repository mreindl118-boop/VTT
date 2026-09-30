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
  const apron = new THREE.RingGeometry(0.5, 7000, 96, 12); // a full disc: the map's own floors sit above it
  const pos = apron.attributes.position, cols: number[] = [];
  for (let i = 0; i < pos.count; i++) { const d = Math.hypot(pos.getX(i), pos.getY(i)); const c = blend(T.apron, (d - R) / 2600); cols.push(c.r, c.g, c.b); }
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

  // Bearing and compressed distance from this site to a world point (miles → feet on the horizon).
  const toScene = (w: P, near: number, far: number) => {
    const dx = w[0] - o.pin[0], dy = w[1] - o.pin[1], mi = Math.hypot(dx, dy) || 0.01;
    const d = near + (far - near) * Math.min(1, mi / 9);
    return { x: cx + (dx / mi) * d, z: cz + (dy / mi) * d, mi, d };
  };

  // 3. Valley walls: two rings of ridges, higher where the world map has high ground in that direction.
  const highAll = [...W.high, ...W.peaks.map((x) => x.pos)];
  const heightAt = (bearing: number) => highAll.reduce((h, w) => {
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
  // Named peaks, snow-capped, at their bearings.
  for (const pk of W.peaks) {
    const t = toScene(pk.pos, 2400, 3600), h = 1100;
    const rock = new THREE.ConeGeometry(h * 0.9, h, 6); rock.translate(0, h / 2, 0);
    const snow = new THREE.ConeGeometry(h * 0.27, h * 0.3, 6); snow.translate(0, h * 0.85, 0);
    const m = new THREE.Mesh(rock, lambert(blend('#5a5f67', 0.3))), c = new THREE.Mesh(snow, lambert(blend('#d9dde3', 0.2)));
    m.position.set(t.x, y0 - 10, t.z); c.position.copy(m.position);
    g.add(m, c);
  }

  // 4. Castle Ravenloft on its pillar of rock, where the world map puts it.
  const k = W.pins.find((x) => x.key === 'K' && x.name.includes('Ravenloft'));
  if (k) {
    const t = toScene(k.pos, 1900, 3200), dark = lambert(blend('#1e1c24', 0.15)), rockM = lambert(blend('#34333a', 0.2));
    const castle = new THREE.Group();
    const pillar = new THREE.CylinderGeometry(80, 150, 560, 7); pillar.translate(0, 280, 0);
    castle.add(new THREE.Mesh(pillar, rockM));
    const box = (w: number, h: number, d: number, x: number, z: number, y = 560) => { const b = new THREE.BoxGeometry(w, h, d); b.translate(x, y + h / 2, z); castle.add(new THREE.Mesh(b, dark)); };
    const spire = (r: number, h: number, x: number, z: number, y: number) => { const c = new THREE.ConeGeometry(r, h, 6); c.translate(x, y + h / 2, z); castle.add(new THREE.Mesh(c, dark)); };
    box(130, 60, 100, 0, 0); box(32, 150, 32, -48, -32); box(28, 125, 28, 48, -28); box(26, 105, 26, -44, 36); box(22, 190, 22, 12, 8);
    spire(24, 60, -48, -32, 710); spire(21, 55, 48, -28, 685); spire(18, 80, 12, 8, 750); spire(20, 50, -44, 36, 665);
    castle.position.set(t.x, y0 - 10, t.z);
    castle.scale.setScalar(0.62); // compressed with distance, so it crowns the skyline instead of leaving the frame
    castle.userData.bearingMiles = t.mi;
    castle.name = 'castle-ravenloft';
    g.add(castle);
  }
  g.traverse((c) => { c.userData.role = 'backdrop'; });
  return g;
}
