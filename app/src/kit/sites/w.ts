// Props and figures for one site's maps (kept in their own file so each site can be built on its own).
// Register with Object.assign(PROPS_V1, {...}) / Object.assign(CREATURES, {...}); use mat() for every material.
//
// The Wizard of Wines (chapter 12) and Yester Hill (chapter 14): the vineyard's trellised rows and grape tubs, the
// winery's treading tubs, fermentation vats, barrels, loading winch, printing press, bottle racks and bunks, its
// slate roofs with iron cresting and the ivy on its walls; on the hill, the twig-and-earth effigy of Strahd, the
// black cairns and boulders, the Gulthias tree, the druids' sod-covered graves and the wall of fog. Figures: the
// druids, the four kinds of blight, wereravens, a swarm of ravens and the mud-daubed berserkers.
import * as THREE from 'three';
import { mat } from '../../render/materials';
import { PALETTE } from '../palette';
import { surfaceFor } from '../surfaces';
import { PROPS_V1 } from '../props';
import { CREATURES, humanoid } from '../creatures';
import { merge } from '../pieces';

type Dims = Record<string, number>;

// ---------------------------------------------------------------- colours (weathered, from the palette families)
const C = {
  oak: '#5e4330', oakDark: '#3f2c1f', stave: '#6b4b30', hoop: '#2f2f33', must: '#4e1219', wineDark: '#3a1218',
  vine: '#3c2e25', leaf: '#3c5a34', leafDark: '#2c4429', leafDead: '#5a5236', grape: '#3a2e46',
  slate: '#35333a', crest: '#26262a', ivy: '#2f4a2e', ivyDark: '#243a24', ivyLight: '#3d5a37',
  rope: '#8b7b5b', glass: '#4f6a5a', glassDark: '#33463d', sand: '#a9966f', paper: '#dad3c3', ink: '#1e1a17',
  cairn: '#26272b', cairnWet: '#323238', boulder: '#2e2f33', twig: '#4a3a2c', twigDark: '#33281f', earth: '#2b2521',
  sod: '#4a4a36', mold: '#7a5a34', moldDark: '#5a4026', fog: '#cacdd3', fogDeep: '#aeb2ba', gem: '#7fe08a',
  mud: '#6f7a80', mudDark: '#4f585e', skin: '#d9b899', hide: '#7a6650', hideDark: '#5b4b3b', antler: '#cac0a7', blood: '#6a1a1e',
  needle: '#4d5a3c', needleDark: '#36402a', sap: '#5a1218', bark: '#3b3230', barkRed: '#4a2a26', raven: '#18171c', ravenSheen: '#2a2a36',
};
surfaceFor([C.oak, C.oakDark, C.stave, C.vine, C.twig, C.twigDark, C.antler], 'wood');
surfaceFor([C.bark, C.barkRed], 'bark');
surfaceFor([C.hoop, C.crest], 'metal');
surfaceFor([C.slate], 'shingle');
surfaceFor([C.leaf, C.leafDark, C.ivy, C.ivyDark, C.ivyLight, C.needle, C.needleDark], 'foliage');
surfaceFor([C.cairn, C.cairnWet, C.boulder], 'rock');
surfaceFor([C.earth, C.sod, C.mud, C.mudDark, C.mold, C.moldDark, C.leafDead], 'dirt');
surfaceFor([C.sand], 'dirt');
surfaceFor([C.rope, C.paper, C.hide, C.hideDark], 'cloth');
surfaceFor([C.fog, C.fogDeep, C.gem, C.glass, C.glassDark, C.must, C.wineDark, C.grape, C.ink, C.blood, C.sap, C.raven, C.ravenSheen], 'none');

// ---------------------------------------------------------------- small helpers
const grp = (...m: THREE.Object3D[]) => { const g = new THREE.Group(); if (m.length) g.add(...m); return g; };
const box = (w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color)); m.position.set(x, y, z); return m; };
const cyl = (rt: number, rb: number, h: number, color: string, x = 0, y = 0, z = 0, seg = 10) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color)); m.position.set(x, y, z); return m; };
const ico = (r: number, color: string, x = 0, y = 0, z = 0, detail = 0) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), mat(color)); m.position.set(x, y, z); return m; };
const cone = (r: number, h: number, color: string, x = 0, y = 0, z = 0, seg = 6) => { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(color)); m.position.set(x, y, z); return m; };
/** A deterministic 0..1 hash, so every prop varies but rebuilds the same. */
const hash = (a: number, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
/** A box from p to q (a strut, a limb, a rope): `t` thick. */
function strut(p: THREE.Vector3, q: THREE.Vector3, t: number, color: string): THREE.Mesh {
  const d = new THREE.Vector3().subVectors(q, p), L = d.length() || 0.01;
  const m = new THREE.Mesh(new THREE.BoxGeometry(t, L, t), mat(color));
  m.position.copy(p).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** Tag every mesh under `g` with a role the renderer honours (roofs and walls are sliced by the section cut). */
function role<T extends THREE.Object3D>(g: T, r: 'roof' | 'wall', cap = false): T { g.traverse((c) => { c.userData.role = r; if (cap) c.userData.cap = true; }); return g; }

/** An upright barrel: bellied staves, iron hoops, a head. `h` tall (default 3.2 ft). */
function barrelMesh(h = 3.2, r = 1.1, color = C.stave): THREE.Group {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(new THREE.Vector2(r * (0.86 + 0.14 * Math.sin(t * Math.PI)), t * h)); }
  const g = grp(new THREE.Mesh(new THREE.LatheGeometry(pts, 12), mat(color)), cyl(r * 0.86, r * 0.86, 0.08, C.oakDark, 0, h - 0.02, 0, 12));
  for (const t of [0.12, 0.34, 0.66, 0.88]) { const rr = r * (0.86 + 0.14 * Math.sin(t * Math.PI)) + 0.03; g.add(cyl(rr, rr, 0.16, C.hoop, 0, t * h, 0, 12)); }
  return g;
}

// ================================================================ the vineyard
/** A trellised row of grapevines along local x, `len` ft long: posts every 8 ft, two wires, gnarled trunks and a
 *  hedge of leaves, dark grapes hanging under it. `dead` > 0 browns a share of the leaves (blighted rows). */
export function vineRow(d: Dims): THREE.Group {
  const L = d.len ?? 40, seed = d.seed ?? 0, dead = d.dead ?? 0, g = grp();
  const n = Math.max(1, Math.round(L / 8));
  for (let i = 0; i <= n; i++) { const x = -L / 2 + (i / n) * L; g.add(box(0.35, 5.2, 0.35, i === 0 || i === n ? C.oakDark : C.oak, x, 2.6, 0)); }
  g.add(box(L, 0.06, 0.06, C.hoop, 0, 3.0, 0), box(L, 0.06, 0.06, C.hoop, 0, 4.6, 0));
  // the vines: a twisted trunk every 4 ft, its canopy a leaf clump along the wires, dark grapes under it
  const m = Math.max(1, Math.round(L / 5));
  for (let i = 0; i < m; i++) {
    const x = -L / 2 + (i + 0.5) * (L / m), h1 = hash(i, seed), h2 = hash(seed, i + 7), brown = hash(i * 3, seed + 3) < dead;
    g.add(strut(V(x, 0, (h1 - 0.5) * 0.4), V(x + (h2 - 0.5) * 0.8, 3.0, 0), 0.3, C.vine));
    const leaf = ico(1.5 + h1 * 0.35, brown ? C.leafDead : i % 3 ? C.leaf : C.leafDark, x, 3.8 + h2 * 0.4, (h1 - 0.5) * 0.3);
    leaf.scale.set(1.9, 0.95, 0.9); g.add(leaf);
    if (hash(i, seed + 11) < 0.5) g.add(ico(0.32, C.grape, x + (h1 - 0.5), 2.9, 0.55 * (h2 > 0.5 ? 1 : -1)));
  }
  return g;
}
/** A rope-handled half-barrel for hauling grapes in from the rows. */
export function grapeTub(d: Dims): THREE.Group {
  const r = d.r ?? 1.3, g = barrelMesh(1.4, r, C.stave);
  g.add(cyl(r * 0.84, r * 0.84, 0.1, C.grape, 0, 1.15, 0, 12));
  for (let i = 0; i < 6; i++) g.add(ico(0.22, C.grape, Math.cos(i) * r * 0.45, 1.3, Math.sin(i) * r * 0.45));
  for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.07, 4, 8, Math.PI), mat(C.rope)); h.position.set(s * (r + 0.05), 1.25, 0); h.rotation.y = Math.PI / 2; g.add(h); }
  return g;
}

// ================================================================ the winery
/** A five-foot treading tub stained with juice: a short ladder bolted to its side and a catch basin under its spout. */
export function treadingTub(): THREE.Group {
  const g = barrelMesh(3.4, 2.5, C.stave);
  g.add(cyl(2.15, 2.15, 0.1, C.must, 0, 2.9, 0, 14));
  // the spout and the low catch basin it drips into
  g.add(box(0.3, 0.3, 0.9, C.oakDark, 0, 0.6, 2.7), cyl(0.9, 0.8, 0.6, C.oakDark, 0, 0.3, 3.5, 10), cyl(0.78, 0.78, 0.05, C.wineDark, 0, 0.58, 3.5, 10));
  // the ladder up its side
  for (const x of [-0.55, 0.55]) g.add(strut(V(x, 0, -3.6), V(x, 3.6, -2.55), 0.18, C.oakDark));
  for (let i = 1; i <= 4; i++) { const t = i / 5; g.add(box(1.2, 0.12, 0.2, C.oak, 0, t * 3.6, -3.6 + t * 1.05)); }
  return g;
}
/** A fermentation vat: an upright cask eight feet wide and twelve tall on a timber cradle, hooped, with a hatch on
 *  its head and a tap near the floor. `split` > 0 opens a narrow crack down its back (the twig blights' den). */
export function fermentationVat(d: Dims): THREE.Group {
  const h = 12, r = 4, g = grp(box(8.6, 0.6, 1, C.oakDark, 0, 0.3, -2.4), box(8.6, 0.6, 1, C.oakDark, 0, 0.3, 2.4));
  const body = barrelMesh(h - 0.6, r, d.dry ? '#6e5038' : C.stave); body.position.y = 0.6; g.add(body);
  g.add(box(2, 0.25, 2, C.oakDark, 0, h + 0.1, 0.8), box(0.5, 0.5, 0.9, C.oakDark, 0, 1.6, r + 0.2), box(0.25, 0.25, 0.4, C.hoop, 0, 1.4, r + 0.75));
  if (d.split) { g.add(box(0.5, 6, 0.4, '#141218', 0, 3.8, -r + 0.05)); for (let i = 0; i < 4; i++) g.add(strut(V(-0.3, 1.2 + i * 1.4, -r - 0.2), V(0.4, 1.8 + i * 1.4, -r - 0.4), 0.08, C.twigDark)); }
  return g;
}
/** An ordinary wine barrel standing on end (`lying` > 0 lays it on its side along local x). */
export function barrel(d: Dims): THREE.Group {
  const b = barrelMesh(3.2, 1.1, d.burnt ? '#5a4030' : C.stave);
  if (!d.lying) return b;
  b.rotation.z = Math.PI / 2; b.position.set(1.6, 1.1, 0);
  return grp(b, box(0.4, 0.3, 2.2, C.oakDark, -0.9, 0.15, 0), box(0.4, 0.3, 2.2, C.oakDark, 0.9, 0.15, 0));
}
/** A barrel of fine sand beside the glassblower's hearth. */
export function sandBarrel(): THREE.Group { const g = barrelMesh(3, 1.1, C.stave); g.add(ico(0.9, C.sand, 0, 2.75, 0, 1)); g.children[g.children.length - 1].scale.y = 0.35; return g; }
/** The glassblower's hearth: a brick furnace in the corner, a glory hole glowing, a flue up the wall, a marver stone. */
export function glassHearth(): THREE.Group {
  const B = '#7a5648', g = grp(box(5, 4, 4, B, 0, 2, 0), box(5.4, 0.5, 4.4, PALETTE.stoneDeep, 0, 4.25, 0), box(2.6, 6, 2.4, B, 0, 7.5, -0.6));
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.7, 10), new THREE.MeshBasicMaterial({ color: '#c9632e' })); hole.position.set(0, 2.4, 2.02); g.add(hole);
  g.add(box(2.2, 2.6, 1.6, PALETTE.stoneDeep, 2.6, 1.3, 2.2), box(0.12, 4.5, 0.12, C.hoop, -1.8, 4, 2.3));
  return g;
}
/** A wooden rack of bottles: `len` long, `h` tall (an 8-ft partition in the cellar, a low rack in the workshop);
 *  `fill` 0..1 how full it is; `two` > 0 shows bottles on both faces. */
export function bottleRack(d: Dims): THREE.Group {
  const L = d.len ?? 10, H = d.h ?? 4, fill = d.fill ?? 1, g = grp();
  const shelves = Math.max(2, Math.round(H / 1.1));
  for (let i = 0; i <= Math.ceil(L / 3); i++) g.add(box(0.3, H, 1.4, C.oakDark, -L / 2 + (i / Math.ceil(L / 3)) * L, H / 2, 0));
  for (let s = 0; s < shelves; s++) {
    const y = 0.35 + s * ((H - 0.4) / shelves);
    g.add(box(L, 0.1, 1.4, C.oak, 0, y, 0));
    const n = Math.floor(L / 0.55);
    for (let i = 0; i < n; i++) {
      if (hash(i, s + L) > fill) continue;
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.1, 6), mat(i % 5 ? C.glass : C.glassDark));
      b.rotation.x = Math.PI / 2; b.position.set(-L / 2 + 0.3 + i * 0.55, y + 0.25, d.two ? 0 : 0.15); g.add(b);
    }
  }
  return g;
}
/** The loading dock's wagon: a flatbed on four wheels, three barrels set in braces on its bed, the shafts out front. */
export function barrelWagon(): THREE.Group {
  const g = grp(box(11, 0.5, 5.4, C.oak, 0, 2.6, 0), box(11, 0.9, 0.3, C.oakDark, 0, 3.2, 2.6), box(11, 0.9, 0.3, C.oakDark, 0, 3.2, -2.6));
  for (const [x, z] of [[-3.6, -2.9], [3.6, -2.9], [-3.6, 2.9], [3.6, 2.9]]) { const w = cyl(1.4, 1.4, 0.35, C.oakDark, x, 1.4, z, 12); w.rotation.x = Math.PI / 2; g.add(w); g.add(cyl(0.3, 0.3, 0.5, C.hoop, x, 1.4, z, 6).rotateX(Math.PI / 2)); }
  for (const s of [-1, 1]) g.add(strut(V(5.5, 2.6, s * 1.6), V(11, 2.2, s * 1.2), 0.3, C.oakDark));
  for (let i = 0; i < 3; i++) { const b = barrel({ lying: 1 }); b.rotation.y = Math.PI / 2; b.position.set(-3.6 + i * 3.6, 2.85, 0); g.add(b); }
  return g;
}
/** The loading winch: a timber gantry over the hole in the floor, a drum with a crank, an arm reaching over the drop,
 *  ropes and iron hooks hanging from it. Built along local x: the arm reaches toward +z. */
export function loadingWinch(d: Dims): THREE.Group {
  const reach = d.reach ?? 6, g = grp();
  for (const x of [-2.6, 2.6]) g.add(box(0.6, 7, 0.6, C.oakDark, x, 3.5, 0), strut(V(x, 0, -2.2), V(x, 5.5, 0), 0.4, C.oak));
  g.add(box(6, 0.6, 0.6, C.oakDark, 0, 7, 0));
  const drum = cyl(0.9, 0.9, 4.4, C.oak, 0, 3.2, 0, 10); drum.rotation.z = Math.PI / 2; g.add(drum);
  g.add(box(0.2, 1.6, 0.2, C.hoop, 2.9, 2.6, 0), box(0.9, 0.2, 0.2, C.hoop, 3.2, 1.9, 0));
  g.add(box(0.7, 0.7, reach + 1.5, C.oakDark, 0, 7.6, reach / 2 - 0.5), strut(V(0, 7, 0.4), V(0, 5, -1.8), 0.4, C.oak));
  for (const x of [-0.6, 0.6]) { g.add(box(0.08, 5.5, 0.08, C.rope, x, 4.9, reach - 0.3), box(0.5, 0.15, 0.15, C.hoop, x, 2.2, reach - 0.3)); }
  return g;
}
/** A screw printing press for wine labels: two cheeks, a head, the platen on its screw, a bed and a long bar. */
export function printingPress(): THREE.Group {
  const g = grp(box(6, 0.6, 3, C.oakDark, 0, 0.3, 0));
  for (const x of [-2.2, 2.2]) g.add(box(0.7, 7, 1, C.oakDark, x, 3.8, 0));
  g.add(box(5.2, 0.9, 1.4, C.oak, 0, 6.6, 0), cyl(0.25, 0.25, 2.4, C.hoop, 0, 5, 0, 8), box(2.2, 0.4, 1.8, C.oak, 0, 3.7, 0), box(5, 0.35, 2.6, C.oak, 0, 2.9, 0.4));
  g.add(box(0.15, 0.15, 3.4, C.hoop, 0.9, 4.6, 1.4), box(1.8, 0.05, 1.3, C.paper, -1.2, 3.1, 0.7), box(0.9, 0.06, 0.9, C.ink, 1.4, 3.1, 0.5));
  return g;
}
/** A bunk bed: two plank berths on four posts, a short ladder at the foot. */
export function bunkBed(): THREE.Group {
  const g = grp();
  for (const [x, z] of [[-1.7, -3.3], [1.7, -3.3], [-1.7, 3.3], [1.7, 3.3]]) g.add(box(0.35, 6, 0.35, C.oakDark, x, 3, z));
  for (const y of [1.2, 4.2]) g.add(box(3.6, 0.35, 6.9, C.oak, 0, y, 0), box(3.1, 0.45, 6.2, '#c9bfa6', 0, y + 0.4, 0.1), box(2.4, 0.35, 1, '#d9cfb5', 0, y + 0.75, -2.6));
  for (let i = 0; i < 4; i++) g.add(box(0.15, 0.15, 1.2, C.oak, 1.85, 1.4 + i * 0.9, 3.5));
  return g;
}
/** A child's rocking horse carved as a black nightmare with orange flames for a mane, tail and hooves. */
export function rockingHorse(): THREE.Group {
  const k = '#1d1a20', f = '#c9632e', g = grp();
  for (const z of [-0.5, 0.5]) { const r = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.1, 4, 16, Math.PI * 0.55), mat(C.oakDark)); r.rotation.z = Math.PI + Math.PI * 0.225; r.position.set(0, 2.25, z); g.add(r); }
  g.add(box(2.2, 0.8, 0.8, k, 0, 1.4, 0), box(0.5, 1.1, 0.5, k, 1.1, 2.0, 0), box(1, 0.5, 0.45, k, 1.45, 2.5, 0));
  for (const x of [-0.8, 0.8]) for (const z of [-0.3, 0.3]) g.add(box(0.2, 0.7, 0.2, k, x, 0.75, z), box(0.24, 0.2, 0.24, f, x, 0.4, z));
  g.add(box(0.15, 0.9, 0.2, f, 0.95, 2.4, 0), box(0.6, 0.15, 0.15, f, -1.35, 1.6, 0), ico(0.07, f, 1.7, 2.6, 0.24), ico(0.07, f, 1.7, 2.6, -0.24));
  return g;
}
/** A carved rocking cradle on curved runners. */
export function cradle(): THREE.Group {
  const g = grp(box(1.8, 1.1, 3.2, C.oak, 0, 1.15, 0), box(1.5, 0.3, 2.9, '#d9cfb5', 0, 1.6, 0), box(1.9, 1.2, 0.2, C.oakDark, 0, 1.9, -1.6));
  for (const z of [-1.2, 1.2]) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.1, 4, 12, Math.PI * 0.5), mat(C.oakDark)); r.rotation.z = Math.PI + Math.PI * 0.25; r.position.set(0, 1.55, z); g.add(r); }
  return g;
}
/** A cooper's work: neat piles of oak staves and iron hoops, a shaving horse beside them. */
export function stavePile(): THREE.Group {
  const g = grp();
  for (let i = 0; i < 9; i++) g.add(box(0.5, 0.18, 3.6, i % 3 ? C.oak : '#7a5a3e', -1.2 + (i % 3) * 0.55, 0.1 + Math.floor(i / 3) * 0.2, 0));
  for (let i = 0; i < 4; i++) { const h = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.06, 4, 14), mat(C.hoop)); h.rotation.x = Math.PI / 2; h.position.set(1.4, 0.06 + i * 0.12, 0); g.add(h); }
  return g;
}
/** Tools on a wall board: saws, adzes, mallets and drawknives on pegs (local +z faces the room). */
export function toolRack(d: Dims): THREE.Group {
  const w = d.w ?? 6, g = grp(box(w, 3, 0.2, C.oakDark, 0, 5, 0));
  for (let i = 0; i < Math.floor(w / 0.9); i++) { const x = -w / 2 + 0.5 + i * 0.9; g.add(box(0.12, 1.2 + (i % 3) * 0.4, 0.12, C.oak, x, 5, 0.2), box(0.5, 0.3 + (i % 2) * 0.2, 0.1, C.hoop, x, 5.6 + (i % 3) * 0.2, 0.22)); }
  return g;
}
/** A stone arcade: an arch springing between two pillars `w` apart (local x), carrying the floor above. */
export function arcade(d: Dims): THREE.Group {
  const w = d.w ?? 15, y0 = d.y ?? 9, top = d.top ?? 15, S = '#7c858e', g = grp();
  // one outline: the spandrels and the arch cut up into them from the springing line
  const r = w / 2 - 1.2, rise = Math.min(r, top - y0 - 1.2), shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0); shape.lineTo(-r, 0);
  for (let i = 1; i < 12; i++) { const a = Math.PI - (i / 12) * Math.PI; shape.lineTo(Math.cos(a) * r, Math.sin(a) * rise); }
  shape.lineTo(r, 0); shape.lineTo(w / 2, 0); shape.lineTo(w / 2, top - y0); shape.lineTo(-w / 2, top - y0); shape.lineTo(-w / 2, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.2, bevelEnabled: false }); geo.translate(0, y0, -0.6);
  g.add(new THREE.Mesh(geo, mat(S)), box(w + 0.6, 0.4, 1.6, PALETTE.stoneDeep, 0, top - 0.2, 0));
  return role(g, 'wall');
}
/** A square stone pier for the veranda's arcade. */
export function pier(d: Dims): THREE.Group { const h = d.h ?? 15; return role(grp(box(2, 0.6, 2, PALETTE.stoneDeep, 0, 0.3, 0), box(1.5, h - 1.2, 1.5, '#7c858e', 0, h / 2, 0), box(2.1, 0.6, 2.1, PALETTE.stoneDeep, 0, h - 0.3, 0)), 'wall'); }
/** A steep slate roof over a w × d footprint (ridge along the long side), its ridge crested with iron fencing,
 *  sitting at `y`. Sliced by the section cut like every roof. */
export function wineryRoof(d: Dims): THREE.Group {
  const w = d.w ?? 30, dd = d.d ?? 20, h = d.h ?? 12, y = d.y ?? 10, long = w >= dd, L = (long ? w : dd) + 1.5, S = (long ? dd : w) + 2.4;
  const shape = new THREE.Shape([new THREE.Vector2(-S / 2, 0), new THREE.Vector2(S / 2, 0), new THREE.Vector2(0, h)]);
  const prism = new THREE.ExtrudeGeometry(shape, { depth: L, bevelEnabled: false }); prism.translate(0, 0, -L / 2);
  const roof = new THREE.Mesh(prism, mat(C.slate)); roof.position.y = y; if (long) roof.rotation.y = Math.PI / 2;
  const g = grp(roof, box(long ? L + 0.4 : 0.7, 0.6, long ? 0.7 : L + 0.4, '#3a2c22', 0, y + h + 0.05, 0));
  // the iron cresting along the ridge: a rail, close-set pickets with spear points, a finial at each end
  const n = Math.floor(L / 1.2);
  for (let i = 0; i <= n; i++) {
    const t = -L / 2 + (i / n) * L, tall = i % 4 === 0 ? 2.2 : 1.4;
    const p = box(0.12, tall, 0.12, C.crest, long ? t : 0, y + h + 0.3 + tall / 2, long ? 0 : t); g.add(p);
    if (i % 4 === 0) g.add(cone(0.22, 0.5, C.crest, long ? t : 0, y + h + 0.3 + tall + 0.2, long ? 0 : t, 4));
  }
  g.add(box(long ? L : 0.12, 0.12, long ? 0.12 : L, C.crest, 0, y + h + 1.3, 0));
  // eaves board and gutter under the slates on the long sides
  for (const s of [-1, 1]) g.add(box(long ? L : 0.4, 0.5, long ? 0.4 : L, '#3a2c22', long ? 0 : s * S / 2, y - 0.1, long ? s * S / 2 : 0));
  return role(g, 'roof', true);
}
/** A lean-to roof falling from `y1` against the wall (local -z side) to `y0` at the front edge, w × d. */
export function shedRoof(d: Dims): THREE.Group {
  const w = d.w ?? 20, dd = d.d ?? 10, y0 = d.y0 ?? 10, y1 = d.y1 ?? 13, rise = y1 - y0, run = dd + 1.5;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 1.5, 0.5, Math.hypot(run, rise)), mat(C.slate));
  slab.position.set(0, (y0 + y1) / 2 + 0.25, 0.75 - 0.75); slab.rotation.x = Math.atan2(rise, run);
  return role(grp(slab, box(w + 1.7, 0.4, 0.4, '#3a2c22', 0, y0 - 0.1, run / 2)), 'roof', true);
}
/** Ivy over a wall face: a mat of leaf clumps `w` wide and `h` high hugging the wall (local +z points out from it). */
export function ivy(d: Dims): THREE.Group {
  const w = d.w ?? 10, h = d.h ?? 12, seed = d.seed ?? 0, g = grp();
  const n = Math.round(w * h / 3.2);
  for (let i = 0; i < n; i++) {
    const a = hash(i, seed), b = hash(seed + 3, i), x = (a - 0.5) * w, y = Math.pow(b, 0.8) * h;
    if (Math.abs(x) > (w / 2) * (1 - (y / h) * 0.4)) continue;   // thins toward the top, ragged edges
    const m = ico(0.6 + hash(i, 9) * 0.5, i % 3 === 0 ? C.ivyDark : i % 3 === 1 ? C.ivy : C.ivyLight, x, y + 0.4, 0.3);
    m.scale.z = 0.4; g.add(m);
  }
  // a few woody stems, flat to the wall, climbing into the leaves
  for (let i = 0; i < 2; i++) { const x = (hash(i, seed + 5) - 0.5) * w * 0.5; g.add(strut(V(x, 0, 0.1), V(x + (hash(i, 1) - 0.5) * 2, h * 0.45, 0.1), 0.12, C.vine)); }
  return g;
}
/** A patch of brown mould on stone: a fuzzy, cold-looking crust. */
export function brownMold(d: Dims): THREE.Group {
  const r = d.r ?? 2.5, g = grp(), up = d.wall ? 1 : 0;
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4 + r, rr = r * Math.sqrt(hash(i, r)) * 0.8;
    const m = ico(0.45 + hash(r, i) * 0.5, i % 2 ? C.mold : C.moldDark, Math.cos(a) * rr, up ? 1 + Math.sin(a) * rr + r : 0.12, up ? 0.15 : Math.sin(a) * rr);
    if (up) m.scale.z = 0.35; else m.scale.y = 0.35; g.add(m);
  }
  return g;
}

/** The barrel ramp: a sloping plank floor spiralling round a stone newel, `rise` ft over `turns` turns, radius `r`,
 *  scored where barrels have been rolled up and down it. */
export function spiralRamp(d: Dims): THREE.Group {
  const rise = d.rise ?? 15, r = d.r ?? 4.6, turns = d.turns ?? 1, n = Math.max(12, Math.round(turns * 24));
  const g = grp();
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * turns * Math.PI * 2, a1 = ((i + 1) / n) * turns * Math.PI * 2, y0 = (i / n) * rise, y1 = ((i + 1) / n) * rise;
    const geo = new THREE.BufferGeometry();
    const p = (a: number, rr: number, y: number) => [Math.cos(a) * rr, y, Math.sin(a) * rr];
    // both windings, so the plank reads from above and from below without a double-sided material
    const A = p(a0, 1.1, y0), B = p(a0, r, y0), Cc = p(a1, r, y1), D = p(a1, 1.1, y1);
    const v = [...A, ...B, ...Cc, ...A, ...Cc, ...D, ...A, ...Cc, ...B, ...A, ...D, ...Cc];
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, mat(i % 2 ? C.oak : C.stave)));
  }
  g.add(cyl(1.1, 1.1, rise, PALETTE.stoneDeep, 0, rise / 2, 0, 10));
  g.traverse((c) => { c.userData.role = 'stairs'; });
  return g;
}
/** A stone spiral stair in a turret: wedge treads round a newel, `rise` ft over `turns` turns, radius `r`. */
export function stoneSpiral(d: Dims): THREE.Group {
  const rise = d.rise ?? 15, r = d.r ?? 4.6, turns = d.turns ?? 1.1, steps = Math.max(2, Math.round(rise / 0.7)), g = grp();
  for (let i = 0; i < steps; i++) {
    const a0 = (i / steps) * turns * Math.PI * 2, a1 = ((i + 1) / steps) * turns * Math.PI * 2, y = ((i + 1) / steps) * rise;
    const s = new THREE.Shape([new THREE.Vector2(Math.cos(a0) * 0.9, Math.sin(a0) * 0.9), new THREE.Vector2(Math.cos(a0) * r, Math.sin(a0) * r), new THREE.Vector2(Math.cos(a1) * r, Math.sin(a1) * r), new THREE.Vector2(Math.cos(a1) * 0.9, Math.sin(a1) * 0.9)]);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.45, bevelEnabled: false }); geo.rotateX(Math.PI / 2); geo.translate(0, y, 0);
    g.add(new THREE.Mesh(geo, mat(i % 2 ? '#7c858e' : '#6f7b86')));
  }
  g.add(cyl(0.9, 0.9, Math.max(0.2, rise), PALETTE.stoneDeep, 0, Math.max(0.2, rise) / 2, 0, 10));
  g.traverse((c) => { c.userData.role = 'stairs'; });
  return g;
}
/** A loose timber: a five-foot bar for the door, lying on the floor along local x. */
export function beam(d: Dims): THREE.Group { const L = d.len ?? 5; return grp(box(L, 0.55, 0.55, C.oakDark, 0, 0.28, 0), box(0.4, 0.6, 0.62, C.hoop, -L / 2 + 0.6, 0.3, 0), box(0.4, 0.6, 0.62, C.hoop, L / 2 - 0.6, 0.3, 0)); }
/** A soft black fur rug, w × d. */
export function furRug(d: Dims): THREE.Group { const w = d.w ?? 6, dd = d.d ?? 4; return grp(box(w, 0.1, dd, '#1b1a1e', 0, 0.05, 0), box(w - 0.6, 0.14, dd - 0.6, '#26242a', 0, 0.07, 0)); }
/** A single wine bottle lying on the floor. */
export function wineBottle(): THREE.Group { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 1.0, 6), mat(C.glassDark)); b.rotation.z = Math.PI / 2; b.position.y = 0.17; const n = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.4, 5), mat(C.glassDark)); n.rotation.z = Math.PI / 2; n.position.set(0.68, 0.17, 0); return grp(b, n); }
Object.assign(PROPS_V1, { 'spiral-ramp': spiralRamp, 'stone-spiral': stoneSpiral, beam, 'fur-rug': furRug, 'wine-bottle': wineBottle } as Record<string, (d: Dims) => THREE.Object3D>);

// ================================================================ Yester Hill
/** The druids' effigy of Strahd: fifty feet of tightly woven twigs packed with black earth, a towering man in a
 *  long cloak with a high flared collar, arms folded, fangs bared, Gulthias roots gripping its base. Faces +z. */
export function strahdEffigy(d: Dims): THREE.Group {
  const H = d.h ?? 50, s = H / 50, g = grp();
  // the cloak: a lathe from the hem to the shoulders, its skirt broken into deep folds
  const prof: [number, number][] = [[0, 10.5], [5, 9.6], [12, 8.2], [20, 7.0], [27, 6.4], [32, 6.7], [35.5, 7.9], [37.2, 6.2], [38.2, 2.2]];
  const cloak = new THREE.LatheGeometry(prof.map(([y, r]) => new THREE.Vector2(r * s, y * s)), 16);
  const pv = cloak.attributes.position;
  for (let i = 0; i < pv.count; i++) { const x = pv.getX(i), y = pv.getY(i), z = pv.getZ(i), a = Math.atan2(z, x), k = 1 + 0.11 * Math.cos(a * 8) * Math.max(0, 1 - y / (32 * s)); pv.setX(i, x * k); pv.setZ(i, z * k); }
  cloak.computeVertexNormals(); g.add(new THREE.Mesh(cloak, mat(C.twig)));
  // woven bands round the cloak, and the packed black earth showing down its open front
  for (const [y, r] of [[3, 10.1], [11, 8.5], [19, 7.2]]) g.add(cyl(r * s * 1.02, r * s * 1.04, 0.9 * s, C.twigDark, 0, y * s, 0, 16));
  g.add(strut(V(0, 0.5 * s, 9.2 * s), V(0, 33 * s, 6.0 * s), 3.2 * s, C.earth));
  // arms folded across the chest; hands of bundled sticks
  for (const x of [-1, 1]) {
    const sh = V(x * 7.2 * s, 35.6 * s, 0.4 * s), el = V(x * 7.6 * s, 28.5 * s, 3.4 * s), hd = V(x * -2.2 * s, 31.2 * s, 7.4 * s);
    g.add(strut(sh, el, 2.6 * s, C.twig), strut(el, hd, 2.2 * s, C.twigDark));
    for (let k = 0; k < 4; k++) g.add(strut(hd, V(hd.x + x * -1.4 * s, (30.2 + k * 0.6) * s, 8.3 * s), 0.35 * s, C.twigDark));
  }
  // the high collar flaring up behind the head: a fan of woven panels
  for (let k = 0; k < 9; k++) {
    const a = Math.PI * (0.05 + (k / 8) * 0.9), p = box(2.1 * s, 8 * s, 0.5 * s, k % 2 ? C.twig : C.twigDark, 0, 0, 0);
    p.position.set(Math.cos(a) * 3.6 * s, 41.2 * s, -Math.sin(a) * 3.6 * s);
    p.rotation.set(0, a + Math.PI / 2, 0); p.rotateX(0.32); g.add(p);
  }
  // neck, a long pale head with a widow's peak, deep eyes, fangs
  g.add(cyl(1.5 * s, 1.8 * s, 3.4 * s, C.twig, 0, 39.2 * s, 0.3 * s, 8));
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(2.9 * s, 1), mat(C.twig)); head.scale.set(0.82, 1.22, 0.9); head.position.set(0, 43.2 * s, 0.6 * s); g.add(head);
  const hair = new THREE.Mesh(new THREE.IcosahedronGeometry(2.95 * s, 1), mat(C.earth)); hair.scale.set(0.86, 0.8, 0.94); hair.position.set(0, 45.0 * s, 0.1 * s); g.add(hair);
  const peak = cone(0.9 * s, 1.6 * s, C.earth, 0, 44.4 * s, 2.7 * s, 4); peak.rotation.x = Math.PI; g.add(peak);
  for (const x of [-1, 1]) g.add(ico(0.42 * s, '#14121a', x * 0.95 * s, 43.6 * s, 2.85 * s), box(1.1 * s, 0.35 * s, 0.6 * s, C.twigDark, x * 0.95 * s, 44.2 * s, 2.9 * s));
  g.add(box(0.6 * s, 1.4 * s, 0.8 * s, C.twig, 0, 42.8 * s, 3.25 * s), box(1.6 * s, 0.3 * s, 0.4 * s, '#14121a', 0, 41.4 * s, 3.1 * s));
  for (const x of [-1, 1]) { const f = cone(0.22 * s, 1.1 * s, C.antler, x * 0.5 * s, 40.9 * s, 3.2 * s, 4); f.rotation.x = Math.PI; g.add(f); }
  // loose twigs bristling from the weave
  for (let i = 0; i < 48; i++) { const a = i * 2.39, y = 2 + hash(i, 3) * 33, r = 10.5 - y * 0.12; g.add(strut(V(Math.cos(a) * r * s, y * s, Math.sin(a) * r * s), V(Math.cos(a) * (r + 1.8) * s, (y + 1.4 - hash(i, 5) * 2.8) * s, Math.sin(a) * (r + 1.8) * s), 0.22 * s, i % 2 ? C.twig : C.twigDark)); }
  // the Gulthias roots that wrap its base
  for (let i = 0; i < 10; i++) { const a = i * 0.63 + 0.3, r0 = 16 * s, r1 = 9.4 * s; g.add(strut(V(Math.cos(a) * r0, 0.3, Math.sin(a) * r0), V(Math.cos(a + 0.35) * r1, 7 * s * (0.5 + hash(i, 2) * 0.7), Math.sin(a + 0.35) * r1), 1.2 * s, C.barkRed)); }
  return g;
}
/** A berserker cairn: a ten-foot mound of slimy black rocks. */
export function cairn(d: Dims): THREE.Group {
  const h = d.h ?? 10, r = d.r ?? 6, seed = d.seed ?? 0, g = grp();
  const tiers = [[r, 0.9], [r * 0.78, 3.2], [r * 0.55, 5.6], [r * 0.32, 7.8]] as const;
  for (const [rr, y] of tiers) {
    const n = Math.max(3, Math.round(rr * 1.3));
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + hash(i, seed + y), k = 0.85 + hash(seed, i + y) * 0.3; const m = ico((1.25 + hash(i, y) * 0.6) * (rr / r * 0.4 + 0.6), i % 3 ? C.cairn : C.cairnWet, Math.cos(a) * rr * 0.62 * k, y * h / 10, Math.sin(a) * rr * 0.62 * k, 0); m.rotation.set(a, a * 2, 0); g.add(m); }
  }
  g.add(ico(1.3, C.cairnWet, 0, h - 0.9, 0, 0));
  return g;
}
/** A black boulder of the druids' ring, `r` ft across, wet and lumpy. */
export function blackBoulder(d: Dims): THREE.Group {
  const r = d.r ?? 3, geo = new THREE.IcosahedronGeometry(r, 1), pv = geo.attributes.position;
  for (let i = 0; i < pv.count; i++) { const x = pv.getX(i), y = pv.getY(i), z = pv.getZ(i), k = 0.8 + 0.35 * Math.abs(Math.sin(x * 2.1 + y * 1.3 + z * 2.9 + r * 7)); pv.setXYZ(i, x * k * 1.1, y * k * (y < 0 ? 0.4 : 0.8), z * k); }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat(r > 3.2 ? C.boulder : C.cairnWet)); m.position.y = r * 0.3; return grp(m);
}
/** The Gulthias tree: a huge misshapen trunk splitting into clawing limbs, bark weeping blood-dark sap, a shiny
 *  battleaxe sunk in the trunk and an adventurer's skeleton at its roots. */
export function gulthiasTree(d: Dims): THREE.Group {
  const s = d.scale ?? 1.3, g = grp();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(2.6 * s, 4.2 * s, 22 * s, 9, 4), mat(C.bark));
  const pv = trunk.geometry.attributes.position; for (let i = 0; i < pv.count; i++) { const y = pv.getY(i), tw = Math.sin(y * 0.25) * 0.9 * s; pv.setX(i, pv.getX(i) + tw); pv.setZ(i, pv.getZ(i) * (1 + 0.15 * Math.sin(pv.getX(i) * 2))); }
  trunk.geometry.computeVertexNormals(); trunk.position.y = 11 * s; g.add(trunk);
  for (let i = 0; i < 7; i++) {   // roots
    const a = i * 0.9 + 0.2; g.add(strut(V(Math.cos(a) * 2.5 * s, 2.5 * s, Math.sin(a) * 2.5 * s), V(Math.cos(a) * 9 * s, 0.2, Math.sin(a) * 9 * s), 1.2 * s, C.bark));
  }
  for (let i = 0; i < 6; i++) {   // the great limbs, each forking into crooked branches
    const a = i * 1.1 + 0.5, y = (16 + (i % 3) * 3) * s, p0 = V(Math.cos(a) * 1.5 * s, y, Math.sin(a) * 1.5 * s), p1 = V(Math.cos(a) * 10 * s, y + 7 * s, Math.sin(a) * 10 * s);
    g.add(strut(p0, p1, 1.4 * s, C.bark));
    for (const k of [-0.5, 0.45]) g.add(strut(p1, V(Math.cos(a + k) * 15 * s, y + (11 + hash(i, k) * 5) * s, Math.sin(a + k) * 15 * s), 0.6 * s, C.bark));
  }
  for (let i = 0; i < 6; i++) { const a = i * 1.7, y = (4 + hash(i, 1) * 12) * s; g.add(box(0.5 * s, (3 + hash(i, 2) * 4) * s, 0.3 * s, C.sap, Math.cos(a) * 3.2 * s, y, Math.sin(a) * 3.2 * s)); }
  // the battleaxe in the trunk, the skeleton beneath it
  const z0 = 3.9 * s;
  g.add(box(0.25, 3.6, 0.25, C.oakDark, 0.4, 6.2, z0 + 0.9), box(0.15, 1.6, 1.8, '#b9bec6', 0.4, 7.6, z0 + 0.1));
  g.add(box(2, 0.5, 1, '#5a4a3a', 0.8, 0.35, z0 + 2.8), ico(0.45, PALETTE.bone, -0.6, 0.45, z0 + 3.2), box(1.8, 0.25, 0.25, PALETTE.bone, 2.2, 0.2, z0 + 2.6), box(1.6, 0.25, 0.25, PALETTE.bone, 2.0, 0.2, z0 + 3.2));
  return g;
}
/** A dead shrub: a tangle of grey-brown stems with a few clumps of withered leaves. */
export function deadShrub(d: Dims): THREE.Group {
  const s = d.scale ?? 1, seed = d.seed ?? 0, g = grp();
  for (let i = 0; i < 7; i++) { const a = i * 0.9 + seed, L = (2.2 + hash(i, seed) * 2) * s; g.add(strut(V(0, 0, 0), V(Math.cos(a) * L * 0.6, L, Math.sin(a) * L * 0.6), 0.14 * s, i % 2 ? C.twig : C.bark)); }
  for (let i = 0; i < 3; i++) { const a = i * 2.1 + seed; const m = ico((0.7 + hash(i, 4) * 0.4) * s, i % 2 ? C.leafDead : C.sod, Math.cos(a) * 1.0 * s, (1.6 + hash(i, 5)) * s, Math.sin(a) * 1.0 * s); m.scale.y = 0.6; g.add(m); }
  return g;
}
/** A sod-covered pit where a druid or berserker sleeps: a mat of dead grass over a shallow grave. */
export function sodGrave(): THREE.Group {
  const g = grp(box(3.4, 0.35, 7, C.sod, 0, 0.18, 0), box(3.8, 0.15, 7.4, C.earth, 0, 0.05, 0));
  for (let i = 0; i < 10; i++) g.add(box(0.12, 0.8, 0.12, C.leafDead, (hash(i, 1) - 0.5) * 3, 0.6, (hash(i, 2) - 0.5) * 6.6));
  return g;
}
/** The wall of fog at the edge of Strahd's domain: billows of mist towering over the land along local z, `len` long. */
export function fogWall(d: Dims): THREE.Group {
  const L = d.len ?? 200, H = d.h ?? 160, seed = d.seed ?? 0, g = grp();
  // the mist glows faintly, as if lit from within; heaped billows leaning back into the west, wisps creeping east
  const fog = (c: string) => mat(c, { emissive: c === C.fog ? '#46484f' : '#3a3c42' });
  const puff = (r: number, c: string, x: number, y: number, z: number, sy: number) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), fog(c)); m.position.set(x, y, z); m.scale.set(0.75, sy, 1.15); return m; };
  const n = Math.max(2, Math.round(L / 15));
  for (let i = 0; i < n; i++) {
    const z = -L / 2 + (i + 0.5) * (L / n), tall = 0.7 + hash(i, seed + 2) * 0.45;
    for (let k = 0; k < 6; k++) {
      const r = 11 + hash(i, k + seed) * 16, y = (k * H / 6) * tall + r * 0.4 + hash(k + seed, i) * 10, x = (hash(k, i + seed) - 0.5) * 22 - k * 5;
      if (hash(i * 7 + k, seed + 9) < 0.18) continue;               // gaps, so it billows rather than stacks
      g.add(puff(r, (i * 3 + k) % 4 ? C.fog : C.fogDeep, x, y, z + (hash(i + k, 3) - 0.5) * 14, 0.6 + hash(k, i) * 0.35));
    }
    for (let k = 0; k < 2; k++) g.add(puff(6 + hash(i, k + 20) * 8, C.fog, 10 + k * 12 + hash(k, i + 4) * 10, 1.5, z + (hash(i, k + 6) - 0.5) * 12, 0.22));
  }
  return g;
}

Object.assign(PROPS_V1, {
  'vine-row': vineRow, 'grape-tub': grapeTub, 'treading-tub': treadingTub, 'fermentation-vat': fermentationVat, barrel, 'sand-barrel': sandBarrel,
  'glass-hearth': glassHearth, 'bottle-rack': bottleRack, 'barrel-wagon': barrelWagon, 'loading-winch': loadingWinch, 'printing-press': printingPress,
  'bunk-bed': bunkBed, 'rocking-horse': rockingHorse, cradle, 'stave-pile': stavePile, 'tool-rack': toolRack, arcade, pier, 'winery-roof': wineryRoof,
  'shed-roof': shedRoof, ivy, 'brown-mold': brownMold, 'strahd-effigy': strahdEffigy, cairn, 'black-boulder': blackBoulder, 'gulthias-tree': gulthiasTree,
  'sod-grave': sodGrave, 'fog-wall': fogWall, 'dead-shrub': deadShrub,
} as Record<string, (d: Dims) => THREE.Object3D>);

// ================================================================ figures
/** An evil druid: wild hair, animal skins, necklaces of teeth. `v` picks the look the book gives each one:
 *  0 a goat-horned headdress, 1 a rack of antlers, 2 skin painted red with blood, 3 caked in mud with a veil of
 *  moss, 4 covered head to toe in bluish-grey mud (Yester Hill). */
export function druid(d: Dims = {}): THREE.Group {
  const v = d.v ?? 0, mud = v === 3 ? '#5a4a36' : v === 4 ? C.mud : undefined;
  const g = humanoid({ skin: v === 2 ? '#8a3a32' : mud ?? C.skin, cloth: v === 4 ? C.mudDark : C.hide, trim: v === 4 ? C.mudDark : C.hideDark, hair: v === 3 ? '#3d5a37' : '#3a2a1a', weapon: 'staff', hunch: 0.15, skirt: true, scale: d.scale ?? 1 });
  const top = 5.75;
  // necklace of teeth, a ragged fur over the shoulders
  for (let i = 0; i < 7; i++) { const a = -0.9 + i * 0.3; g.add(box(0.1, 0.18, 0.1, PALETTE.bone, Math.sin(a) * 0.62, 4.6 - Math.cos(a) * 0.1, 0.42 + Math.cos(a) * 0.05)); }
  const fur = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, 0.7, 8), mat(C.hideDark)); fur.position.y = 4.95; fur.scale.z = 0.7; g.add(fur);
  if (v === 0) for (const x of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.1, 4, 8, Math.PI * 1.1), mat(C.antler)); h.position.set(x * 0.35, top + 0.35, -0.1); h.rotation.set(0, Math.PI / 2, x > 0 ? -0.6 : 0.6); g.add(h); }
  if (v === 1) for (const x of [-1, 1]) { g.add(strut(V(x * 0.3, top, 0), V(x * 1.3, top + 1.5, -0.2), 0.12, C.antler), strut(V(x * 0.9, top + 0.9, -0.1), V(x * 0.7, top + 1.9, 0.3), 0.1, C.antler), strut(V(x * 1.15, top + 1.3, -0.15), V(x * 1.8, top + 2.1, 0), 0.1, C.antler)); }
  if (v === 3) g.add(box(0.75, 0.9, 0.12, '#3d5a37', 0, top - 0.6, 0.42));
  if (v === 2) for (let i = 0; i < 4; i++) g.add(strut(V((hash(i) - 0.5) * 0.8, top + 0.1, 0), V((hash(i, 2) - 0.5) * 1.6, top + 0.6, -0.3), 0.14, '#2a1c14'));
  return g;
}
/** A twig blight: a knee-high bundle of dry sticks walking on root-feet, twig fingers splayed. */
export function twigBlight(d: Dims = {}): THREE.Group {
  const s = d.scale ?? 1, g = grp();
  g.add(strut(V(0, 1.2 * s, 0), V(0.1 * s, 2.6 * s, 0.1 * s), 0.35 * s, C.twig));
  for (const x of [-1, 1]) { g.add(strut(V(x * 0.15 * s, 1.3 * s, 0), V(x * 0.5 * s, 0, 0.2 * s), 0.16 * s, C.twigDark), strut(V(0, 2.2 * s, 0), V(x * 1.0 * s, 1.6 * s, 0.4 * s), 0.12 * s, C.twig)); for (const k of [-1, 0, 1]) g.add(strut(V(x * 1.0 * s, 1.6 * s, 0.4 * s), V(x * (1.3 + k * 0.1) * s, (1.5 + k * 0.25) * s, 0.7 * s), 0.06 * s, C.twigDark)); }
  for (let i = 0; i < 6; i++) { const a = i * 1.05; g.add(strut(V(0, 2.5 * s, 0), V(Math.cos(a) * 0.5 * s, 3.1 * s + hash(i) * 0.4 * s, Math.sin(a) * 0.5 * s), 0.06 * s, C.twigDark)); }
  return g;
}
/** A needle blight: a hunched, gangly thing of bark and branches bristling with needles. */
export function needleBlight(): THREE.Group {
  const g = humanoid({ skin: C.needleDark, cloth: C.needle, trim: C.bark, hunch: 0.5, claws: true, scale: 1.05 });
  for (let i = 0; i < 26; i++) { const a = i * 2.39, y = 2.6 + hash(i) * 2.8, r = 0.55; g.add(strut(V(Math.cos(a) * r * 0.6, y, Math.sin(a) * r * 0.6 - 0.2), V(Math.cos(a) * (r + 0.6), y + 0.3, Math.sin(a) * (r + 0.6) - 0.45), 0.07, i % 2 ? C.needleDark : C.needle)); }
  return g;
}
/** A vine blight: a heap of dead creepers drawn up into a hulking shape, tendrils trailing over the ground. */
export function vineBlight(): THREE.Group {
  const g = grp();
  for (let i = 0; i < 9; i++) { const m = ico(0.9 + hash(i) * 0.5, i % 2 ? C.leafDead : C.needleDark, (hash(i, 1) - 0.5) * 1.4, 1 + i * 0.45, (hash(i, 2) - 0.5) * 1.0, 1); m.scale.set(1, 0.8, 0.8); g.add(m); }
  for (let i = 0; i < 7; i++) { const a = i * 0.9; g.add(strut(V(0, 1.2, 0), V(Math.cos(a) * 2.6, 0.15, Math.sin(a) * 2.6), 0.2, C.vine)); }
  for (const x of [-1, 1]) g.add(strut(V(x * 0.7, 4, 0), V(x * 2.0, 2.4, 0.9), 0.3, C.vine));
  return g;
}
/** A tree blight (Wintersplinter): a thirty-foot dead treant, green light seeping out of its split chest. */
export function treeBlight(d: Dims = {}): THREE.Group {
  const s = (d.scale ?? 1), g = grp();
  for (const x of [-1, 1]) g.add(strut(V(x * 2.2 * s, 0, 0), V(x * 1.6 * s, 11 * s, 0), 2.2 * s, C.bark));
  const body = new THREE.Mesh(new THREE.CylinderGeometry(3.4 * s, 2.8 * s, 12 * s, 8), mat(C.bark)); body.position.y = 17 * s; g.add(body);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(1.2 * s, 5 * s, 0.4 * s), new THREE.MeshBasicMaterial({ color: C.gem })); glow.position.set(0, 18 * s, 3.1 * s); g.add(glow);
  g.add(ico(2.6 * s, C.bark, 0, 25 * s, 0.4 * s, 1));
  for (const x of [-1, 1]) { const sh = V(x * 3.2 * s, 21.5 * s, 0), el = V(x * 7.5 * s, 15 * s, 1.5 * s), hd = V(x * 7 * s, 9 * s, 3 * s); g.add(strut(sh, el, 1.5 * s, C.bark), strut(el, hd, 1.2 * s, C.bark)); for (let k = 0; k < 4; k++) g.add(strut(hd, V(x * (6.4 + k * 0.5) * s, (6.5 - k * 0.3) * s, (3.8 + k * 0.2) * s), 0.35 * s, C.bark)); }
  for (let i = 0; i < 8; i++) { const a = i * 0.8; g.add(strut(V(Math.cos(a) * 1.2 * s, 26.5 * s, Math.sin(a) * 1.2 * s), V(Math.cos(a) * 4 * s, (30 + hash(i) * 3) * s, Math.sin(a) * 4 * s), 0.4 * s, C.bark)); }
  for (const x of [-0.8, 0.8]) g.add(ico(0.35 * s, C.gem, x * s, 25.6 * s, 2.7 * s));
  return g;
}
/** A wereraven in human form: dark leather rain cloak and cowl. `hybrid` gives the raven-headed, winged form. */
export function wereraven(d: Dims = {}): THREE.Group {
  const g = humanoid({ skin: d.hybrid ? C.raven : C.skin, cloth: '#1a1a22', trim: '#2b2420', hair: '#1a1a1a', cloak: true, scale: d.scale ?? 1 });
  if (d.hybrid) { g.add(cone(0.22, 0.9, '#3a3b40', 0, 5.6, 0.75, 4).rotateX(Math.PI / 2)); for (const x of [-1, 1]) { const w = box(2.6, 2.4, 0.15, C.raven, x * 1.8, 4.2, -0.5); w.rotation.z = x * 0.45; g.add(w); } }
  else { const cowl = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.1, 7), mat('#1a1a22')); cowl.position.set(0, 6.1, -0.08); g.add(cowl); }
  return g;
}
/** A swarm of ravens: a knot of black birds wheeling at head height. */
export function ravenSwarm(d: Dims = {}): THREE.Group {
  const s = d.scale ?? 1, g = grp();
  for (let i = 0; i < 9; i++) {
    const a = i * 2.39, r = (0.6 + hash(i) * 1.6) * s, y = (3 + hash(i, 2) * 3) * s, bird = grp(box(0.7 * s, 0.35 * s, 0.35 * s, C.raven), cone(0.1 * s, 0.35 * s, '#3a3b40', 0.5 * s, 0.05 * s, 0, 4).rotateZ(-Math.PI / 2));
    for (const z of [-1, 1]) { const w = box(0.45 * s, 0.06 * s, 0.9 * s, C.ravenSheen, 0, 0.1 * s, z * 0.55 * s); w.rotation.x = z * (0.3 + hash(i, z) * 0.6); bird.add(w); }
    bird.position.set(Math.cos(a) * r, y, Math.sin(a) * r); bird.rotation.y = -a; g.add(bird);
  }
  return g;
}
/** A berserker of the mountain tribe: tangled hair, mud-daubed skin, a great axe. */
export function berserker(): THREE.Group {
  const g = humanoid({ skin: C.mud, cloth: C.mudDark, trim: '#3b352c', hair: '#2a2420', weapon: 'none', scale: 1.05 });
  g.add(box(0.15, 4.4, 0.15, C.oakDark, 0.95, 3.4, 0.4), box(0.12, 1.3, 1.1, '#8a8d93', 0.95, 5.3, 0.75));
  return g;
}
/** One mesh per material: a figure built from dozens of parts draws in a handful of calls (the base ring is the caller's). */
function compact(root: THREE.Group): THREE.Group {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), by = new Map<THREE.Material, THREE.BufferGeometry[]>();
  root.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    const mt = m.material as THREE.Material, list = by.get(mt) ?? [];
    list.push(m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))); by.set(mt, list);
  });
  const out = new THREE.Group();
  for (const [mt, gs] of by) out.add(new THREE.Mesh(merge(gs), mt));
  return out;
}
Object.assign(CREATURES, {
  druid: (d) => compact(druid(d)), 'twig-blight': (d) => compact(twigBlight(d)), 'needle-blight': () => compact(needleBlight()), 'vine-blight': () => compact(vineBlight()),
  'tree-blight': (d) => compact(treeBlight(d)), wereraven: (d) => compact(wereraven(d)), 'swarm-of-ravens': (d) => compact(ravenSwarm(d)), berserker: () => compact(berserker()),
} as Record<string, (d: Dims) => THREE.Group>);
