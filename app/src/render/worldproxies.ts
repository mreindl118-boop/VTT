// Stand-ins for the places of the continuous world while their maps are not loaded: massing at TRUE scale and true
// position (no foreshortening, no sight notch: one world), one vertex-coloured mesh per place (a single draw each,
// with its own material so it can fade), named `proxy:<path>`. Also the sky (moon, halo and the pale sun, following
// the camera like bodies at infinity) and the place labels.
import * as THREE from 'three';
import type { Bounds } from '../core/frames';
import { colourMerge, vertexLambert, type LandField } from './worldland';
import { drawMoon, haloTexture, moonTexture, ravenloft } from './backdrop';
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
        // Castle Ravenloft from its own plans (locations/ch04/K/exterior.json, centred on the castle; `centre` is where
        // that is in the map's frame), its lit windows glowing through the mist
        const c = (RAVENLOFT as { centre?: number[] }).centre ?? s.centre, ox = c[0] - s.centre[0], oz = c[1] - s.centre[1];
        const cos = Math.cos(s.rotationY), sin = Math.sin(s.rotationY), px = ox * cos + oz * sin, pz = -ox * sin + oz * cos;
        const tmp = new THREE.Group(), mats = new Map<string, THREE.Material>();
        ravenloft(tmp, (hex) => { let m = mats.get(hex); if (!m) { m = new THREE.MeshLambertMaterial({ color: hex }); mats.set(hex, m); } return m; });
        tmp.rotation.y = s.rotationY; tmp.position.set(px, 0, pz); tmp.updateMatrixWorld(true);
        tmp.traverse((o) => {
          const m = o as THREE.Mesh; if (!m.isMesh) return;
          const mat = m.material as THREE.MeshBasicMaterial, part: Part = [m.geometry.clone().applyMatrix4(m.matrixWorld), `#${mat.color.getHexString()}`];
          (mat.type === 'MeshBasicMaterial' ? glow : lit).push(part);
        });
        for (const m of mats.values()) m.dispose();
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
  if (lit.length) { const m = new THREE.Mesh(colourMerge(lit), vertexLambert()); m.name = 'massing'; g.add(m); }
  if (glow.length) { const m = new THREE.Mesh(colourMerge(glow), new THREE.MeshBasicMaterial({ vertexColors: true, fog: true })); m.name = 'glow'; g.add(m); }
  if (s.key === 'K') { const inner = new THREE.Group(); inner.name = 'castle-ravenloft'; g.add(inner); }
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
    place();
  };
  const follow = (eye: THREE.Vector3, d: number) => { node.position.copy(eye); dist = d; place(); node.updateMatrixWorld(true); };
  const dispose = () => { for (const s of dir.keys()) { (s.material as THREE.SpriteMaterial).map?.dispose(); s.material.dispose(); } };
  setMoon(0.5, false, 14);
  return { node, setMoon, follow, dispose };
}
