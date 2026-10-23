// Stand-ins for the places of the continuous world while their maps are not loaded: massing at TRUE scale and true
// position (no foreshortening, no sight notch: one world), one vertex-coloured mesh per place (a single draw each,
// with its own material so it can fade), named `proxy:<path>`. Also the sky (moon, halo and the pale sun, following
// the camera like bodies at infinity) and the place labels.
import * as THREE from 'three';
import type { Bounds } from '../core/frames';
import { colourMerge, type LandField } from './worldland';
import { drawMoon, haloTexture, moonTexture } from './backdrop';
import { matClone, setSurface } from './materials';
import { exemptLandmarkFog } from './world';
import RAVENLOFT from '../../../locations/ch04/K/exterior.json';

export interface ProxySite {
  /** `proxy:<path>` names the group; a pin that only repeats another's map gets `<path>@<key>`. */
  id: string; key: string; name: string; type: string;
  /** Where the pin stands (W) and its ground. */
  x: number; z: number; y: number;
  /** The footprint the massing fills (W); a pin without a map gets a small square round the pin. */
  bounds: Bounds;
  /** How far the map is turned (rotation.y) and where its own plan centre is in its frame (for Ravenloft's plan). */
  rotationY: number; centre: [number, number];
}

type Part = [THREE.BufferGeometry, string];

const castleWindowMats = new Set<THREE.MeshLambertMaterial>();
let castleWindowIntensity = 0.55;

function castleGlowIntensity(night: boolean, hour = 14): number {
  const h = ((hour % 24) + 24) % 24;
  const day = night ? 0 : h < 5.5 || h > 20.5 ? 0 : h < 7.5 ? (h - 5.5) / 2 : h > 18.5 ? (20.5 - h) / 2 : 1;
  return 0.55 + (1 - day) * 1.15;
}

/** Update the warm amber window glow on Castle Ravenloft's valley landmark for the current hour and night state. */
export function setCastleWindowGlow(night: boolean, hour = 14): void {
  castleWindowIntensity = castleGlowIntensity(night, hour);
  for (const m of castleWindowMats) m.emissiveIntensity = castleWindowIntensity;
}

function proxyLambert(surf: Parameters<typeof setSurface>[1] = 'generic', landmark = false): THREE.MeshLambertMaterial {
  const m = matClone('#ffffff', true);
  m.vertexColors = true;
  setSurface(m, surf);
  return landmark ? exemptLandmarkFog(m) : m;
}

function proxyGlow(color = '#ffd36b', landmark = false): THREE.MeshLambertMaterial {
  const m = matClone(color, true);
  m.vertexColors = true;
  m.emissive.set(color);
  m.emissiveIntensity = castleWindowIntensity;
  setSurface(m, 'none');
  if (landmark) {
    exemptLandmarkFog(m);
    castleWindowMats.add(m);
    m.addEventListener('dispose', () => castleWindowMats.delete(m));
  }
  return m;
}

/** Castle Ravenloft's always-resident valley landmark proxy: the keep, spires, curtain walls, gatehouse and chasm
 *  bridge atop the thousand-foot Pillarstone rock mass, with warm amber windows that brighten at dusk and night. */
function buildCastleLandmark(s: ProxySite, field: LandField, hx: number, hz: number): THREE.Group {
  const inner = new THREE.Group();
  inner.name = 'castle-ravenloft';
  const E = RAVENLOFT as {
    centre?: number[];
    blocks: number[][];
    walls: number[][];
    towers: number[][];
    windows: number[][];
    approach?: { gate: number[]; chasm: number; bridgeW: number; towers: number[][] };
  };
  const c = E.centre ?? s.centre, ox = c[0] - s.centre[0], oz = c[1] - s.centre[1];
  const cos = Math.cos(s.rotationY), sin = Math.sin(s.rotationY), px = ox * cos + oz * sin, pz = -ox * sin + oz * cos;
  const STONE = '#282a35', STONE2 = '#21232d', SLATE = '#15141d', DARK = '#1b1c25', BRIDGE = '#342922', GLOW = '#ffd36b';
  const litParts: Part[] = [], glowParts: Part[] = [];
  const planM = new THREE.Matrix4().makeRotationY(s.rotationY).setPosition(px, 0, pz);
  const placeInPlan = (g: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0): THREE.BufferGeometry => {
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    return g.applyMatrix4(planM);
  };
  const cBox = (w: number, h: number, d: number, x: number, z: number, y: number, hex: string, ry = 0) => {
    litParts.push([placeInPlan(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), x, y, z, ry), hex]);
  };
  // 1. Castle massing blocks & slate roof caps
  for (const [x, z, w, d, h] of E.blocks) {
    cBox(w, h, d, x, z, 0, h > 180 ? DARK : h > 110 ? STONE2 : STONE);
    if (w >= 15 && d >= 15) cBox(w + 0.8, 1.8, d + 0.8, x, z, h, SLATE);
  }
  // 2. Curtain walls and battlements
  for (const [x0, z0, x1, z1, h] of E.walls) {
    const L = Math.hypot(x1 - x0, z1 - z0), ry = -Math.atan2(z1 - z0, x1 - x0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    cBox(L + 10, h, 11, mx, mz, 0, STONE, ry);
    const n = Math.floor(L / 32), ux = (x1 - x0) / L, uz = (z1 - z0) / L;
    for (let i = 0; i <= n; i++) {
      const t = -L / 2 + i * 32;
      cBox(10, 5, 11, mx + ux * t, mz + uz * t, h, STONE, ry);
    }
  }
  // 3. Keep and stair towers with tall conical spires and finials
  for (const [x, z, r, top] of E.towers) {
    litParts.push([placeInPlan(new THREE.CylinderGeometry(r * 0.94, r, top, 8, 1, true).translate(0, top / 2, 0), x, 0, z), DARK]);
    litParts.push([placeInPlan(new THREE.CylinderGeometry(r + 1.8, r + 1.8, 3.5, 8, 1, true).translate(0, 1.75, 0), x, top - 3.5, z), STONE2]);
    litParts.push([placeInPlan(new THREE.ConeGeometry(r + 2.2, r * 3.8, 8, 1, true).translate(0, r * 1.9, 0), x, top, z), SLATE]);
    litParts.push([placeInPlan(new THREE.CylinderGeometry(0.5, 0.9, 12, 4, 1, true).translate(0, 6, 0), x, top + r * 3.8 - 1, z), DARK]);
  }
  // 4. Gate towers, drawbridge, viaduct arch and eastern overlook
  const A = E.approach;
  if (A) {
    for (const [x, z] of A.towers) {
      litParts.push([placeInPlan(new THREE.CylinderGeometry(7.5, 8, 104, 8, 1, true).translate(0, 52, 0), x, 0, z), DARK]);
      litParts.push([placeInPlan(new THREE.ConeGeometry(10, 32, 8, 1, true).translate(0, 16, 0), x, 104, z), SLATE]);
    }
    const bx = A.gate[0] - A.chasm / 2 - 3, bz = A.gate[1];
    cBox(A.chasm + 8, 3, A.bridgeW + 2, bx, bz, -2.5, BRIDGE);
    cBox(A.chasm + 10, 22, A.bridgeW * 0.85, bx, bz, -24.5, STONE2);
    for (const s2 of [-1, 1]) {
      const ch = new THREE.BoxGeometry(0.8, 0.8, Math.hypot(A.chasm, 24));
      ch.rotateX(-Math.atan2(24, A.chasm));
      ch.rotateY(Math.PI / 2);
      litParts.push([placeInPlan(ch, A.gate[0] - A.chasm / 2, 12, A.gate[1] + s2 * (A.bridgeW / 2)), DARK]);
    }
  }
  cBox(42, 7, 32, 200, 0, -1, STONE);
  cBox(32, 24, 24, 190, 0, -110, DARK);

  // 5. The thousand-foot Pillarstone rock mass beneath the castle (y = -1000..0)
  let sd = 97;
  const r1 = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const rockColumn = (x: number, z: number, rBase: number, rTop: number, top: number, bottom: number, lean: number, hex: string, segs = 6, inPlan = false) => {
    const h = Math.max(10, top - bottom), g = new THREE.CylinderGeometry(rTop, rBase, h, segs, 1);
    g.translate(0, h / 2, 0);
    const rib = Array.from({ length: segs + 1 }, () => 1 + (r1() - 0.5) * 0.45);
    rib[segs] = rib[0];
    const pv = g.attributes.position;
    for (let i = 0; i < pv.count; i++) {
      const ang = Math.atan2(pv.getZ(i), pv.getX(i)), si = Math.round(((ang + Math.PI) / (Math.PI * 2)) * segs) % (segs + 1);
      const k = rib[si];
      pv.setX(i, pv.getX(i) * k);
      pv.setZ(i, pv.getZ(i) * k);
    }
    g.rotateX(lean * (r1() - 0.5));
    g.rotateY(r1() * Math.PI);
    g.rotateZ(lean * (r1() - 0.5));
    if (inPlan) litParts.push([placeInPlan(g, x, bottom, z), hex]);
    else litParts.push([g.translate(x, bottom, z), hex]);
  };
  // Core fluted rock mass directly under the castle and the western chasm spur
  rockColumn(0, 0, 275, 235, 0, -480, 0.02, '#202029', 9, true);
  rockColumn(10, -8, 350, 268, -460, -1000, 0.02, '#1b1b24', 9, true);
  if (A) rockColumn(A.gate[0] - A.chasm - 45, A.gate[1], 82, 54, 0, -1000, 0.02, '#202029', 7, true);
  // Perimeter crag buttresses around the plateau brow, proud of the sloping land apron down to the valley floor
  const nSpurs = 18;
  for (let i = 0; i < nSpurs; i++) {
    const a = (i / nSpurs) * Math.PI * 2 + r1() * 0.12, ca = Math.cos(a), sa = Math.sin(a);
    const edge = Math.min(Math.abs(ca) > 1e-6 ? hx / Math.abs(ca) : Infinity, Math.abs(sa) > 1e-6 ? hz / Math.abs(sa) : Infinity);
    const d = edge + 350 + r1() * 320, x = ca * d, z = sa * d;
    const bottom = Math.min(-960, field.ground(s.x + x, s.z + z) - 40 - s.y);
    const top = -2 - r1() * 75, r = 115 + r1() * 95;
    rockColumn(x, z, r, r * (0.48 + r1() * 0.28), top, bottom, 0.07, i % 3 === 0 ? '#1b1b24' : i % 3 === 1 ? '#24242f' : '#202029', 6, false);
  }

  // 6. Warm amber windows (deduplicated exterior windows + high spire/keep lancets visible from every valley bearing)
  const keptWins: number[][] = [];
  for (const w of E.windows) {
    const [x, z, y, alongZ] = w;
    if (keptWins.some(([kx, kz, ky, ka]) => ka === alongZ && Math.abs(ky - y) < 4 && Math.hypot(kx - x, kz - z) < 18)) continue;
    keptWins.push(w);
    const g = new THREE.BoxGeometry(alongZ ? 3.4 : 6.5, 10.5, alongZ ? 6.5 : 3.4).translate(0, 5.25, 0);
    glowParts.push([placeInPlan(g, x, y, z), GLOW]);
  }
  const spireLancets: [number, number, number, number[]][] = [
    [27.5, 30.0, 17, [205, 250, 292]],
    [-7.5, -25.0, 20, [175, 220]],
    [2.5, 65.0, 20, [142, 168]],
  ];
  for (const [tx, tz, r, ys] of spireLancets) {
    for (const y of ys) {
      for (const [dx, dz, alongZ] of [[r - 0.4, 0, 1], [-(r - 0.4), 0, 1], [0, r - 0.4, 0], [0, -(r - 0.4), 0]] as const) {
        const g = new THREE.BoxGeometry(alongZ ? 3.6 : 5.5, 13, alongZ ? 5.5 : 3.6).translate(0, 6.5, 0);
        glowParts.push([placeInPlan(g, tx + dx, y, tz + dz), GLOW]);
      }
    }
  }

  const silMesh = new THREE.Mesh(colourMerge(litParts), proxyLambert('rock', true));
  silMesh.name = 'castle-silhouette';
  const winMesh = new THREE.Mesh(colourMerge(glowParts), proxyGlow(GLOW, true));
  winMesh.name = 'castle-windows';
  inner.add(silMesh, winMesh);
  return inner;
}

/** One place's massing as a group at its pin: a lit vertex-coloured mesh (and an unlit one for what glows). */
export function siteMassing(s: ProxySite, field: LandField): THREE.Group {
  const g = new THREE.Group(); g.name = `proxy:${s.id}`; g.position.set(s.x, s.y, s.z); g.userData.role = 'stage';
  let seed = [...s.key].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 2147483646 + 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const lit: Part[] = [], glow: Part[] = [];
  const hx = (s.bounds.maxX - s.bounds.minX) / 2, hz = (s.bounds.maxZ - s.bounds.minZ) / 2;
  const box = (w: number, h: number, d: number, x: number, z: number, y: number, hex: string, ry = 0) => { lit.push([new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0).rotateY(ry).translate(x, y, z), hex]); };
  const cone = (r: number, h: number, x: number, z: number, y: number, hex: string, seg = 6, ry = 0) => { lit.push([new THREE.ConeGeometry(r, h, seg).translate(0, h / 2, 0).rotateY(ry).translate(x, y, z), hex]); };
  const cyl = (r: number, h: number, x: number, z: number, y: number, hex: string, seg = 8) => { lit.push([new THREE.CylinderGeometry(r * 0.9, r, h, seg).translate(0, h / 2, 0).translate(x, y, z), hex]); };
  /** The ground under a point of the group (its pin is at y 0): massing off the footprint follows the land. */
  const yAt = (x: number, z: number) => field.surface(s.x + x, s.z + z) + 0.4 - s.y;
  const house = (x: number, z: number, w: number, d: number, h: number, ry: number, wall = '#8f8676', roof = '#3d3a3e') => {
    const y = Math.min(0, yAt(x, z)); box(w, h - y, d, x, z, y, wall, ry);
    lit.push([new THREE.ConeGeometry(Math.max(w, d) * 0.72, 9, 4).rotateY(Math.PI / 4).scale(w / Math.max(w, d), 1, d / Math.max(w, d)).translate(0, 4.5, 0).rotateY(ry).translate(x, h, z), roof]);
  };
  const town = /Town/i.test(s.name);
  switch (s.type) {
    case 'settlement': {
      // houses scattered over the footprint (denser in a town), a church tower at the heart, a palisade round a town
      const area = hx * hz * 4, n = Math.round(Math.max(3, Math.min(town ? 70 : 28, area / (town ? 160000 : 22000))));
      for (let i = 0; i < n; i++) {
        const x = (rnd() * 2 - 1) * hx * 0.8, z = (rnd() * 2 - 1) * hz * 0.8;
        house(x, z, 22 + rnd() * 16, 20 + rnd() * 12, 10 + rnd() * 5, Math.round(rnd() * 3) * (Math.PI / 2) + (rnd() - 0.5) * 0.3);
      }
      if (area > 60000) { box(14, 30, 14, 0, 0, 0, '#9a948a'); cone(11, 18, 0, 0, 30, '#4a4550', 4); }
      if (town) for (const [ax, az, L, ry] of [[0, -hz, hx * 2, 0], [0, hz, hx * 2, 0], [-hx, 0, hz * 2, Math.PI / 2], [hx, 0, hz * 2, Math.PI / 2]] as const) {
        const k = Math.max(4, Math.round(L / 160));
        for (let i = 0; i < k; i++) { const t = -L / 2 + (L * (i + 0.5)) / k, x = ry ? ax : ax + t, z = ry ? az + t : az; box(L / k - 6, 16, 5, x, z, Math.min(0, yAt(x, z)), '#5d554a', ry); }
      }
      break;
    }
    case 'camp':
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; cone(9, 11, Math.cos(a) * 30, Math.sin(a) * 30, 0, i === 2 ? '#8a3a32' : '#c9bfa6', 5); }
      for (let i = 0; i < 3; i++) box(12, 7, 6, -60 + i * 25, 55, 0, '#5a4632', 0.4);
      break;
    case 'castle':
      if (s.key === 'K') {
        g.add(buildCastleLandmark(s, field, hx, hz));
      } else {
        // Argynvostholt: a ruined manor of grey stone, one wing taller, and the slender beacon tower at its west end
        box(120, 34, 60, 0, 0, 0, '#5d5c62'); box(60, 46, 50, 50, -10, 0, '#57565c'); box(40, 26, 40, -70, 18, 0, '#5d5c62');
        for (const [x, z, w] of [[-20, 0, 50], [45, -10, 40]] as const) lit.push([new THREE.ConeGeometry(w * 0.72, 18, 4).rotateY(Math.PI / 4).translate(0, 9, 0).scale(1.3, 1, 0.75).translate(x, x < 0 ? 34 : 46, z), '#3a3740']);
        for (let i = 0; i < 7; i++) box(5 + (i % 3) * 3, 6 + (i % 4) * 4, 3, -55 + i * 16, -32, 34 - (i % 3) * 4, '#4c4b51');
        cyl(9, 120, -95, 10, 0, '#64636a'); box(16, 10, 16, -95, 10, 120, '#4c4b51'); cone(11, 14, -95, 10, 130, '#3a3740', 8);
      }
      break;
    case 'tower': cyl(14, 60, 0, 0, 0, '#8a8075'); cone(17, 20, 0, 0, 60, '#4a4550', 8); break;
    case 'temple': box(30, 14, 45, 0, 0, 0, '#9a948a'); cone(24, 16, 0, 0, 14, '#4a4550', 4); box(9, 26, 9, 0, -18, 0, '#8f8980'); cone(8, 8, 0, -18, 26, '#4a4550', 4); break;
    case 'ruin': for (let i = 0; i < 9; i++) { const x = (rnd() * 2 - 1) * hx * 0.6, z = (rnd() * 2 - 1) * hz * 0.6; box(20 + rnd() * 20, 8 + rnd() * 20, 6, x, z, Math.min(0, yAt(x, z)), '#7a766f', rnd() * 3); } break;
    case 'falls': {
      // A canyon head: white water down the cut the land makes, a stone arch over the top, mist at the foot, sized to the drop
      let low = 0; for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; low = Math.min(low, yAt(Math.cos(a) * 900, Math.sin(a) * 900)); }
      const h = Math.max(140, Math.min(420, -low));
      box(70, h - 20, 12, 0, 6, -h + 10, '#e6ecf0'); box(40, h - 20, 8, 10, 8, -h + 10, '#f4f7f9');
      lit.push([new THREE.TorusGeometry(160, 22, 8, 24, Math.PI).translate(0, 10, -60), '#6b6660']);
      box(380, 14, 24, 0, -60, 168, '#6b6660');
      break;
    }
    case 'gate': box(18, 34, 18, -26, 0, 0, '#5d5c62'); box(18, 34, 18, 26, 0, 0, '#5d5c62'); box(70, 8, 18, 0, 0, 34, '#4c4b51'); cone(12, 12, -26, 0, 34, '#3a3740', 4); cone(12, 12, 26, 0, 34, '#3a3740', 4); break;
    case 'crossroads': box(1.2, 14, 1.2, 0, 0, 0, '#5a4632'); box(8, 1.4, 0.6, 2.5, 0, 11, '#6b5640', 0.5); box(8, 1.4, 0.6, -2.5, 0, 9, '#6b5640', -0.7); box(10, 16, 1.2, 30, 20, 0, '#3f3a33'); break;
    case 'river': box(60, 5, 14, 0, 0, 0, '#6b6660'); for (const x of [-22, 0, 22]) box(4, 5, 16, x, 0, -4, '#5c5c64'); break;
    case 'landmark':
      if (s.key === 'O') { cyl(16, 46, 0, 0, 0, '#7a6e60'); cone(19, 18, 0, 0, 46, '#4a4550', 8); for (let i = 0; i < 4; i++) box(4, 60, 1.5, 0, -20, 26, '#d8d0c0', (i * Math.PI) / 2); }
      else { box(8, 7, 16, 0, 0, 1.5, '#1d1a20'); box(9, 1.4, 17, 0, 0, 8.5, '#2b2730'); for (const [x, z] of [[-4, -6], [4, -6], [-4, 6], [4, 6]]) cyl(2.2, 0.8, x, z, 0, '#3a3540', 10); }
      break;
    case 'den': for (let i = 0; i < 7; i++) lit.push([new THREE.IcosahedronGeometry(12 + rnd() * 14, 0).translate((rnd() - 0.5) * 80, 4, (rnd() - 0.5) * 80), '#4a4a52']); break;
    case 'hill': for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; box(4, 12 + rnd() * 6, 3, Math.cos(a) * 45, Math.sin(a) * 45, 0, '#7a766f', a); } break;
    case 'lake': box(40, 2, 8, 0, 0, 0, '#5a4632'); for (let i = 0; i < 3; i++) box(14, 3, 5, -10 + i * 12, 12, 0.5, '#4a3c2c', 0.3); break;
    case 'woods': for (let i = 0; i < 5; i++) lit.push([new THREE.IcosahedronGeometry(3 + rnd() * 3, 0).translate((rnd() - 0.5) * 40, 1.5, (rnd() - 0.5) * 40), '#6b6660']); cyl(1, 9, 0, 0, 0, '#3b2d24'); break;
    default: { // a waymark: a cairn of stones and a post (a road, a peak, a pass)
      for (let i = 0; i < 6; i++) lit.push([new THREE.IcosahedronGeometry(3.5 - i * 0.4, 0).translate((rnd() - 0.5) * 3, 1.5 + i * 2.2, (rnd() - 0.5) * 3), '#7a766f']);
      box(1.4, 18, 1.4, 6, 0, 0, '#3b2d24');
    }
  }
  if (lit.length) { const m = new THREE.Mesh(colourMerge(lit), proxyLambert()); m.name = 'massing'; g.add(m); }
  if (glow.length) { const m = new THREE.Mesh(colourMerge(glow), proxyGlow()); m.name = 'glow'; g.add(m); }
  g.traverse((o) => { o.userData.role = 'stage'; });
  return g;
}

/** The sky's bodies: the moon (in its phase, from the clock), its halo and Barovia's pale sun. They follow the eye (given
 *  in the node's parent frame), so
 *  they stand at the same bearing and height whatever the zoom (like bodies at infinity), far enough out to sit behind
 *  the mountains; moonrise at six in the evening, zenith at midnight; the sun's arc always toward the south. */
export function buildSky(): { node: THREE.Group; setMoon: (phase: number, night: boolean, hour?: number) => void; follow: (eye: THREE.Vector3, dist: number) => void; dispose: () => void } {
  const node = new THREE.Group(); node.name = 'sky';
  const MD = 42000;
  const tex = moonTexture(0.5), mm = new THREE.SpriteMaterial({ map: tex, fog: false, transparent: true, depthWrite: false });
  const moon = new THREE.Sprite(mm); moon.scale.set(7100, 7100, 1); moon.name = 'moon'; moon.renderOrder = -1;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: '#cfd6ea', fog: false, transparent: true, opacity: 0.55, depthWrite: false })); halo.scale.set(19500, 19500, 1); halo.renderOrder = -2;
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: '#e8e4d8', fog: false, transparent: true, opacity: 0.5, depthWrite: false })); sun.scale.set(2600, 2600, 1); sun.renderOrder = -2;
  node.add(moon, halo, sun);
  const dir = new Map<THREE.Sprite, THREE.Vector3 | null>([[moon, null], [halo, null], [sun, null]]);
  const base = new Map<THREE.Sprite, number>([[moon, 7100], [halo, 19500], [sun, 2600]]);
  // a body on its arc: up in the east, highest at the middle of its span, down in the west (always toward the south)
  const arc = (h: number, rise: number, span: number, peak: number): THREE.Vector3 | null => {
    const f = ((((h - rise) % 24) + 24) % 24) / span; if (f <= 0 || f >= 1) return null;
    const a = f * Math.PI, el = Math.sin(a) * peak, dx = Math.cos(a), dz = Math.sin(a) * 0.55, L = Math.hypot(dx, dz) || 1;
    return new THREE.Vector3((dx / L) * Math.cos(el), Math.sin(el), (dz / L) * Math.cos(el));
  };
  let dist = 300;
  const place = () => {
    // far enough out to stay behind the land whatever the zoom; scaled with it so the disc keeps its size in the sky
    const D = Math.min(250000, MD + dist * 1.5), k = D / MD;
    for (const [s, d] of dir) { s.visible = !!d; if (d) { s.position.copy(d).multiplyScalar(D); const b = base.get(s)!; s.scale.set(b * k, b * k, 1); } }
  };
  const setMoon = (phase: number, night: boolean, hour = 0) => {
    drawMoon(tex.image as HTMLCanvasElement, phase); tex.needsUpdate = true;
    const lit = 1 - Math.abs(phase - 0.5) * 2, mp = arc(hour, 18, 12, 1.15), sp = arc(hour, 6.5, 13, 0.75);
    dir.set(moon, mp); dir.set(halo, mp); dir.set(sun, sp);
    (halo.material as THREE.SpriteMaterial).opacity = (night ? 0.55 : 0.2) * (0.25 + lit * 0.75); mm.opacity = night ? 1 : 0.55;
    setCastleWindowGlow(night, hour);
    place();
  };
  const follow = (eye: THREE.Vector3, d: number) => { node.position.copy(eye); dist = d; place(); node.updateMatrixWorld(true); };
  const dispose = () => { for (const s of dir.keys()) { (s.material as THREE.SpriteMaterial).map?.dispose(); s.material.dispose(); } };
  setMoon(0.5, false, 14);
  return { node, setMoon, follow, dispose };
}
