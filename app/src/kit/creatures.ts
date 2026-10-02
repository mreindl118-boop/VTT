// Low-poly creature figures (kit v2). Original geometry, one palette, flat shading. Feet in world units.
// Every builder returns a group whose origin is the floor centre; the base ring is added by the caller.
import * as THREE from 'three';
import { mat, matClone } from '../render/materials';
import { PALETTE } from './palette';

type Dims = Record<string, number>;
const box = (w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0, ry = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z); m.rotation.y = ry;
  return m;
};
const sphere = (r: number, color: string, x = 0, y = 0, z = 0, detail = 0) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), mat(color)); m.position.set(x, y, z); return m; };
const cone = (r: number, h: number, color: string, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), mat(color)); m.position.set(x, y, z); return m; };
const grp = (...m: THREE.Object3D[]) => { const g = new THREE.Group(); if (m.length) g.add(...m); return g; };

export interface HumanoidOpts {
  skin?: string; cloth?: string; trim?: string; scale?: number; hunch?: number; cloak?: boolean; robe?: boolean;
  claws?: boolean; helm?: 'none' | 'wolf' | 'cap'; weapon?: 'none' | 'sword' | 'spear' | 'staff' | 'torch'; hair?: string; skirt?: boolean;
}

const cyl = (rt: number, rb: number, h: number, color: string, x = 0, y = 0, z = 0, seg = 6) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color)); m.position.set(x, y, z); return m; };

/** Modular humanoid, ~5.5 ft tall at scale 1: boots, tapered legs, a belted tunic with a hem, rounded shoulders, two-part
 *  arms with hands, a neck and a rounded head. A hunch bends the whole upper body at the hips. */
export function humanoid(o: HumanoidOpts = {}): THREE.Group {
  const s = o.scale ?? 1, skin = o.skin ?? '#d9b899', cloth = o.cloth ?? PALETTE.pineDeep, trim = o.trim ?? PALETTE.woodDark, boot = o.claws ? skin : '#2b2420';
  const hunch = o.hunch ?? 0, g = grp();
  // legs and boots
  for (const x of [-0.3, 0.3]) g.add(cyl(0.24 * s, 0.19 * s, 2.4 * s, trim, x * s, 1.65 * s, 0), box(0.46 * s, 0.55 * s, 0.78 * s, boot, x * s, 0.28 * s, 0.1 * s));
  if (o.robe || o.skirt) g.add(cyl(0.72 * s, 1.08 * s, (o.robe ? 4.6 : 2.6) * s, cloth, 0, (o.robe ? 2.3 : 1.7) * s, 0, 7));
  // the upper body hangs from the hips
  const up = grp(); up.position.y = 2.85 * s; up.rotation.x = hunch * 0.6; g.add(up);
  up.add(box(1.2 * s, 0.55 * s, 0.72 * s, trim, 0, 0.05 * s, 0));                                       // hips
  const torso = cyl(0.72 * s, 0.6 * s, 2.15 * s, cloth, 0, 1.15 * s, 0, 7); torso.scale.z = 0.62; up.add(torso);
  if (!o.robe) { const hem = cyl(0.64 * s, 0.82 * s, 0.75 * s, cloth, 0, 0.0, 0, 7); hem.scale.z = 0.7; up.add(hem); }
  up.add(cyl(0.64 * s, 0.64 * s, 0.22 * s, trim, 0, 0.42 * s, 0, 7));                                   // belt
  for (const sx of [-1, 1]) {
    up.add(sphere(0.33 * s, cloth, sx * 0.76 * s, 2.05 * s, 0));                                          // shoulder
    const arm = grp(); arm.position.set(sx * 0.86 * s, 2.0 * s, 0); arm.rotation.x = hunch * 0.9 - 0.12; arm.rotation.z = sx * 0.08; up.add(arm);
    arm.add(cyl(0.2 * s, 0.17 * s, 1.15 * s, o.claws ? skin : cloth, 0, -0.6 * s, 0), cyl(0.17 * s, 0.14 * s, 1.05 * s, o.claws ? skin : cloth, 0, -1.65 * s, 0.08 * s), sphere(0.17 * s, skin, 0, -2.25 * s, 0.1 * s));
    if (o.claws) for (let i = -1; i <= 1; i++) arm.add(box(0.07 * s, 0.5 * s, 0.07 * s, PALETTE.bone, i * 0.09 * s, -2.55 * s, 0.15 * s));
  }
  // neck and head
  up.add(cyl(0.17 * s, 0.2 * s, 0.38 * s, skin, 0, 2.38 * s, 0));
  const hy = 2.82 * s, head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42 * s, 1), mat(skin)); head.position.set(0, hy, 0.02 * s); head.scale.set(0.92, 1.05, 0.95); up.add(head);
  up.add(box(0.12 * s, 0.18 * s, 0.14 * s, skin, 0, hy - 0.05 * s, 0.42 * s));                         // nose
  if (o.hair) { const h = new THREE.Mesh(new THREE.IcosahedronGeometry(0.43 * s, 1), mat(o.hair)); h.position.set(0, hy + 0.12 * s, -0.08 * s); h.scale.set(1, 0.85, 1); up.add(h); }
  if (o.helm === 'wolf') up.add(box(0.9 * s, 0.7 * s, 1.1 * s, PALETTE.iron, 0, hy + 0.15 * s, 0.1 * s), cone(0.18 * s, 0.5 * s, PALETTE.iron, -0.35 * s, hy + 0.75 * s, 0), cone(0.18 * s, 0.5 * s, PALETTE.iron, 0.35 * s, hy + 0.75 * s, 0));
  if (o.helm === 'cap') { const c = sphere(0.46 * s, trim, 0, hy + 0.15 * s, 0); c.scale.y = 0.6; up.add(c); }
  if (o.cloak) { const c = cyl(0.78 * s, 1.15 * s, 4.9 * s, o.cloth ?? '#1a171d', 0, -0.2 * s, -0.32 * s, 8); c.scale.z = 0.45; up.add(c); up.add(cyl(0.8 * s, 0.8 * s, 0.3 * s, o.cloth ?? '#1a171d', 0, 2.2 * s, -0.05 * s, 8)); }
  // a weapon in the right hand
  const hx = 0.9 * s, hyH = -0.05 * s, hz = 0.35 * s;
  if (o.weapon === 'sword') up.add(box(0.12 * s, 2.6 * s, 0.32 * s, PALETTE.mist1, hx, hyH + 1.4 * s, hz), box(0.7 * s, 0.12 * s, 0.14 * s, PALETTE.amberDeep, hx, hyH + 0.1 * s, hz), box(0.12 * s, 0.5 * s, 0.12 * s, PALETTE.woodDark, hx, hyH - 0.2 * s, hz));
  if (o.weapon === 'spear') up.add(box(0.12 * s, 7 * s, 0.12 * s, PALETTE.woodDark, hx, 0.8 * s, hz), cone(0.2 * s, 0.8 * s, PALETTE.mist1, hx, 4.7 * s, hz));
  if (o.weapon === 'staff') up.add(box(0.14 * s, 6 * s, 0.14 * s, PALETTE.woodDark, hx, 0.4 * s, hz));
  if (o.weapon === 'torch') up.add(box(0.14 * s, 1.6 * s, 0.14 * s, PALETTE.woodDark, hx, hyH + 0.5 * s, hz), sphere(0.32 * s, PALETTE.amber, hx, hyH + 1.5 * s, hz));
  return g;
}

/** Quadruped: wolf / dog / dire wolf (scale). */
export function wolf(d: Dims = {}): THREE.Group {
  const s = d.scale ?? 1, color = d.stuffed ? '#6b5d4a' : '#5b5a5e', dark = d.stuffed ? '#4f4436' : '#3f3e44';
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8 * s, 1), mat(color)); body.scale.set(2.1, 0.9, 0.75); body.position.set(0, 2 * s, 0);
  const g = grp(body);
  const ruff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75 * s, 1), mat(dark)); ruff.position.set(1.1 * s, 2.25 * s, 0); ruff.scale.set(0.9, 1.05, 0.95); g.add(ruff);
  for (const [x, z] of [[-1.15, -0.32], [1.05, -0.32], [-1.15, 0.32], [1.05, 0.32]]) g.add(cyl(0.17 * s, 0.11 * s, 1.75 * s, color, x * s, 0.9 * s, z * s), box(0.26 * s, 0.14 * s, 0.32 * s, dark, x * s + 0.06 * s, 0.07 * s, z * s));
  const head = box(0.9 * s, 0.75 * s, 0.75 * s, color, 1.95 * s, 2.55 * s, 0); head.rotation.z = -0.15;
  const snout = box(0.75 * s, 0.38 * s, 0.42 * s, color, 2.65 * s, 2.38 * s, 0); snout.rotation.z = -0.1;
  g.add(head, snout, box(0.14 * s, 0.14 * s, 0.16 * s, '#141218', 3.03 * s, 2.45 * s, 0), cone(0.15 * s, 0.42 * s, color, 1.8 * s, 3.1 * s, -0.22 * s), cone(0.15 * s, 0.42 * s, color, 1.8 * s, 3.1 * s, 0.22 * s));
  const tail = cone(0.24 * s, 1.5 * s, dark, -2.15 * s, 1.75 * s, 0); tail.rotation.z = 2.3; g.add(tail);
  if (!d.stuffed) g.add(sphere(0.08 * s, PALETTE.amber, 2.35 * s, 2.7 * s, -0.24 * s), sphere(0.08 * s, PALETTE.amber, 2.35 * s, 2.7 * s, 0.24 * s));
  return g;
}

function translucent(g: THREE.Group, opacity: number, color?: string): THREE.Group {
  g.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    const src = m.material as THREE.MeshLambertMaterial;
    const nm = matClone(color ?? '#' + src.color.getHexString());
    nm.transparent = true; nm.opacity = opacity; nm.depthWrite = false;
    m.material = nm;
  });
  return g;
}

export function ghost(d: Dims = {}): THREE.Group {
  const s = d.scale ?? 1;
  const g = grp();
  const body = cone(0.9 * s, 3.2 * s, '#cfd6e8', 0, 3.2 * s, 0); body.rotation.x = Math.PI; g.add(body);
  g.add(sphere(0.5 * s, '#e3e8f5', 0, 5.1 * s, 0), box(0.4 * s, 1.4 * s, 0.4 * s, '#cfd6e8', -0.9 * s, 3.6 * s, 0.2 * s), box(0.4 * s, 1.4 * s, 0.4 * s, '#cfd6e8', 0.9 * s, 3.6 * s, 0.2 * s));
  return translucent(g, 0.45);
}
export function specter(): THREE.Group {
  const g = humanoid({ skin: '#c8ccd8', cloth: '#9aa2b8', scale: 0.95, hunch: 0.15 });
  g.position.y = 1.2;
  const out = grp(g);
  return translucent(out, 0.5);
}
export function shadow(): THREE.Group {
  const g = humanoid({ skin: '#0d0b12', cloth: '#0d0b12', trim: '#0d0b12', scale: 1, hunch: 0.1 });
  g.scale.z = 0.35;
  return translucent(grp(g), 0.7);
}
export const ghoul = () => humanoid({ skin: '#8a9a7c', cloth: '#4a4238', trim: '#3b352c', hunch: 0.6, claws: true });
export const ghast = () => humanoid({ skin: '#6f7f68', cloth: '#1a171d', trim: '#1a171d', hunch: 0.5, claws: true, robe: true });
export const cultist = () => humanoid({ skin: '#d9b899', cloth: '#1a171d', trim: '#1a171d', robe: true, cloak: true, weapon: 'torch' });
export const adventurer = (o: { cloth?: string } = {}) => humanoid({ skin: '#d9b899', cloth: o.cloth ?? PALETTE.pine, trim: PALETTE.woodDark, hair: '#3a2a1a', weapon: 'sword' });
export const animatedArmor = () => humanoid({ skin: PALETTE.iron, cloth: '#2b2c31', trim: '#2b2c31', helm: 'wolf', weapon: 'spear' });

export function mimic(): THREE.Group {
  // A door slab that has grown a maw: dark planks, rows of ivory teeth, a lolling tongue.
  const g = grp(box(5, 7, 0.6, PALETTE.woodDark, 0, 3.5, 0));
  for (let i = 0; i < 6; i++) g.add(cone(0.22, 0.6, PALETTE.bone, -2 + i * 0.8, 4.4, 0.45), cone(0.22, 0.6, PALETTE.bone, -1.6 + i * 0.8, 2.6, 0.45));
  g.children.slice(7).forEach((c) => (c.rotation.x = Math.PI));
  g.add(box(1.2, 0.3, 1.6, PALETTE.wine, 0, 2.5, 0.9), sphere(0.3, PALETTE.amber, -1.5, 5.6, 0.4), sphere(0.3, PALETTE.amber, 1.5, 5.6, 0.4));
  return g;
}

export function shamblingMound(): THREE.Group {
  const g = grp();
  const body = sphere(4.2, '#3d4a2c', 0, 2.6, 0, 1); body.scale.y = 0.65; g.add(body);
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; g.add(sphere(0.7 + (i % 3) * 0.25, i % 2 ? '#55603a' : '#2f3a22', Math.cos(a) * 3.4, 1.2 + (i % 3) * 0.9, Math.sin(a) * 3.4)); }
  const armL = box(1.4, 1.4, 3.2, '#4a5533', -3.6, 3.2, 1.6); armL.rotation.y = 0.5;
  const armR = box(1.4, 1.4, 3.2, '#4a5533', 3.6, 3.2, 1.6); armR.rotation.y = -0.5;
  g.add(armL, armR);
  return g;
}

export function grick(): THREE.Group {
  const g = grp();
  for (let i = 0; i < 6; i++) g.add(sphere(0.9 - i * 0.08, '#6e6a5a', 0, 1 + i * 0.15, -i * 1.4 + 2.5));
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; const t = box(0.25, 0.25, 2.2, '#7d7563', Math.cos(a) * 0.7, 1.6 + Math.sin(a) * 0.5, 3.8); t.rotation.y = Math.cos(a) * 0.5; g.add(t); }
  g.add(cone(0.5, 0.9, '#3b352c', 0, 1.5, 3.0));
  return g;
}

export function swarm(d: Dims = {}): THREE.Group {
  const g = grp(); const n = d.n ?? 22, color = d.color ? '#' + d.color.toString(16) : '#4a3f2b';
  for (let i = 0; i < n; i++) { const a = i * 2.4, r = 0.4 + (i % 7) * 0.25; g.add(box(0.35, 0.12, 0.6, color, Math.cos(a) * r, 0.1 + (i % 4) * 0.12, Math.sin(a) * r, a)); }
  return g;
}

export function broom(): THREE.Group {
  const g = grp(box(0.18, 5, 0.18, PALETTE.woodDark, 0, 2.5, 0));
  const head = cone(0.7, 1.6, '#b7a16a', 0, 0.8, 0); head.rotation.x = Math.PI; g.add(head);
  g.rotation.z = 0.2;
  return g;
}

export function skeletonStanding(): THREE.Group { return humanoid({ skin: PALETTE.bone, cloth: '#1a171d', trim: PALETTE.bone, robe: true, scale: 0.95 }); }

// Villagers differ: hair and homespun cycle through a few muted tones in the order they are built (stable per map).
let folk = 0;
export function commoner(): THREE.Group {
  const HAIR = ['#3a2a1a', '#5a4632', '#2a2420', '#7a6a5a', '#8a6a3a', '#4a3a30'], CLOTH = ['#5b4a3a', '#4a5248', '#5a4a52', '#6b5d4a', '#4f4636'], i = folk++;
  return humanoid({ cloth: CLOTH[i % CLOTH.length], trim: i % 3 ? PALETTE.woodDark : '#3b352c', hair: HAIR[(i * 7) % HAIR.length], skirt: i % 4 === 1 });
}

export const CREATURES: Record<string, (d: Dims) => THREE.Group> = {
  ghoul: () => ghoul(), ghast: () => ghast(), shadow: () => shadow(), ghost: (d) => ghost(d), specter: () => specter(),
  'animated-armor': () => animatedArmor(), mimic: () => mimic(), 'shambling-mound': () => shamblingMound(), grick: () => grick(),
  'swarm-of-insects': (d) => swarm(d), 'broom-of-animated-attack': () => broom(), wolf: (d) => wolf(d), 'dire-wolf': () => wolf({ scale: 1.6 }),
  cultist: () => cultist(), adventurer: () => adventurer(), skeleton: () => skeletonStanding(), commoner: () => commoner(),
};

// ---- outdoor / village creatures (M2)
export function horse(d: Dims = {}): THREE.Group {
  const s = (d.scale ?? 1) * 1.75, color = d.bone ? PALETTE.bone : '#4a3a2e', mane = d.bone ? '#b9b09a' : '#2a2020'; // ~8 ft long, 5 ft at the withers
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1 * s, 1), mat(color)); body.scale.set(2.25, 0.95, 0.8); body.position.set(0, 3.25 * s, 0);
  const g = grp(body);
  for (const [x, z] of [[-1.55, -0.45], [1.6, -0.45], [-1.55, 0.45], [1.6, 0.45]]) g.add(cyl(0.22 * s, 0.15 * s, 2.6 * s, color, x * s, 1.4 * s, z * s), cyl(0.2 * s, 0.22 * s, 0.3 * s, '#1d1916', x * s, 0.15 * s, z * s));
  const neck = cyl(0.42 * s, 0.6 * s, 2.3 * s, color, 2.25 * s, 4.45 * s, 0, 7); neck.rotation.z = -0.65; neck.scale.z = 0.75;
  const head = box(1.5 * s, 0.62 * s, 0.6 * s, color, 3.25 * s, 5.15 * s, 0); head.rotation.z = -0.55;
  g.add(neck, head, cone(0.12 * s, 0.4 * s, color, 2.95 * s, 5.85 * s, -0.18 * s), cone(0.12 * s, 0.4 * s, color, 2.95 * s, 5.85 * s, 0.18 * s));
  const mn = box(0.25 * s, 2.4 * s, 0.3 * s, mane, 2.0 * s, 4.75 * s, 0); mn.rotation.z = -0.65; g.add(mn);
  const tail = cone(0.32 * s, 2.2 * s, mane, -2.35 * s, 2.55 * s, 0); tail.rotation.z = -0.35; tail.rotation.x = Math.PI; g.add(tail);
  return g;
}
export const scarecrow = () => { const g = humanoid({ skin: '#a08a5a', cloth: '#6a5a3a', trim: '#5a4a3a', helm: 'cap', weapon: 'none' }); g.add(box(0.2, 7, 0.2, PALETTE.woodDark, 0, 3.5, -0.6), box(4, 0.2, 0.2, PALETTE.woodDark, 0, 3.4, -0.6)); return g; };
export const vampireSpawn = () => humanoid({ skin: '#d8d3d0', cloth: '#2a1a22', trim: '#1a171d', hair: '#1a1a1a', claws: true });
export const gargoyle = () => { const g = humanoid({ skin: PALETTE.stoneDeep, cloth: PALETTE.stoneDeep, trim: PALETTE.stoneDeep, hunch: 0.4, claws: true }); for (const x of [-1.6, 1.6]) { const w = box(2.2, 2.6, 0.15, PALETTE.stoneDeep, x, 4.2, -0.6); w.rotation.z = x > 0 ? -0.5 : 0.5; g.add(w); } return g; };
export function wyrmling(): THREE.Group {
  const c = '#7a1f2b', g = grp(box(3.2, 1.2, 1.3, c, 0, 1.4, 0), box(1.2, 0.9, 1, c, 2, 2.1, 0), cone(0.35, 1.2, c, -2.3, 1.4, 0));
  for (const [x, z] of [[-1, -0.5], [1, -0.5], [-1, 0.5], [1, 0.5]]) g.add(box(0.35, 1, 0.35, c, x, 0.5, z));
  for (const z of [-0.9, 0.9]) { const w = box(2.6, 0.12, 1.6, '#5b1f2b', 0, 2.4, z); w.rotation.x = z > 0 ? -0.6 : 0.6; g.add(w); }
  return g;
}
Object.assign(CREATURES, { horse: (d) => horse(d), scarecrow: () => scarecrow(), 'vampire-spawn': () => vampireSpawn(), gargoyle: () => gargoyle(), 'red-dragon-wyrmling': () => wyrmling() } as Record<string, (d: Dims) => THREE.Group>);

/** A sheep: woolly body, dark face and legs. `polymorphed` adds a scroll in its mouth (Finethir). */
export function sheep(d: Dims = {}): THREE.Group {
  const s = d.scale ?? 1, g = grp();
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 * s, 1), mat('#e9e4d8')); body.scale.set(1.35, 0.9, 1); body.position.set(0, 1.7 * s, 0); g.add(body);
  g.add(box(0.55 * s, 0.6 * s, 0.7 * s, '#2a2420', 1.35 * s, 1.9 * s, 0));
  for (const [x, z] of [[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]]) g.add(box(0.22 * s, 1.1 * s, 0.22 * s, '#2a2420', x * s, 0.55 * s, z * s));
  if (d.scroll) g.add(box(0.7 * s, 0.18 * s, 0.18 * s, PALETTE.bone, 1.75 * s, 1.75 * s, 0));
  return g;
}
Object.assign(CREATURES, { sheep: (d) => sheep(d) } as Record<string, (d: Dims) => THREE.Group>);

/** A brown bear: heavy quadruped, ~6 ft long, 3.5 ft at the shoulder. */
export function bear(d: Dims = {}): THREE.Group {
  const s = d.scale ?? 1, c = '#4a3323', g = grp();
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7 * s, 1), mat(c)); body.scale.set(1.8, 1, 1.1); body.position.set(0, 2.2 * s, 0); g.add(body);
  g.add(box(1.3 * s, 1.1 * s, 1.1 * s, c, 2.8 * s, 2.7 * s, 0), box(0.5 * s, 0.4 * s, 0.6 * s, '#2a1a10', 3.55 * s, 2.5 * s, 0));
  for (const [x, z] of [[-1.7, -0.5], [1.7, -0.5], [-1.7, 0.5], [1.7, 0.5]]) g.add(box(0.7 * s, 1.5 * s, 0.7 * s, c, x * s, 0.75 * s, z * s));
  return g;
}
/** An ape: hunched, long-armed, ~5 ft tall. */
export const ape = (d: Dims = {}) => { const g = humanoid({ skin: '#3a2a22', cloth: '#3a2a22', trim: '#2a1c16', hunch: 0.55, scale: (d.scale ?? 1) * 0.95, weapon: d.sword ? 'sword' : 'none' }); return g; };
Object.assign(CREATURES, { bear: (d) => bear(d), ape: (d) => ape(d) } as Record<string, (d: Dims) => THREE.Group>);
