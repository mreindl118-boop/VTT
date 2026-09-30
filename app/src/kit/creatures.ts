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

/** Modular humanoid: head, torso, arms, legs; ~5.5 ft tall at scale 1. */
export function humanoid(o: HumanoidOpts = {}): THREE.Group {
  const s = o.scale ?? 1, skin = o.skin ?? '#d9b899', cloth = o.cloth ?? PALETTE.pineDeep, trim = o.trim ?? PALETTE.woodDark;
  const g = grp();
  const hunch = o.hunch ?? 0;
  // legs
  g.add(box(0.42 * s, 2.8 * s, 0.48 * s, trim, -0.3 * s, 1.4 * s, 0), box(0.42 * s, 2.8 * s, 0.48 * s, trim, 0.3 * s, 1.4 * s, 0));
  if (o.robe || o.skirt) g.add(cone(0.95 * s, 3.0 * s, cloth, 0, 1.5 * s, 0));
  // torso
  const torso = box(1.35 * s, 2.3 * s, 0.75 * s, cloth, 0, 3.95 * s, hunch * 0.5 * s);
  torso.rotation.x = hunch * 0.6;
  g.add(torso);
  // arms
  const armL = box(0.34 * s, 2.3 * s, 0.34 * s, o.claws ? skin : cloth, -0.88 * s, 3.8 * s, hunch * 0.9 * s);
  const armR = box(0.34 * s, 2.3 * s, 0.34 * s, o.claws ? skin : cloth, 0.88 * s, 3.8 * s, hunch * 0.9 * s);
  armL.rotation.x = hunch * 1.4 - 0.2; armR.rotation.x = hunch * 1.4 - 0.2;
  g.add(armL, armR);
  if (o.claws) for (const x of [-0.88, 0.88]) for (let i = -1; i <= 1; i++) g.add(box(0.08 * s, 0.5 * s, 0.08 * s, PALETTE.bone, x * s + i * 0.1 * s, 2.5 * s, (hunch * 1.4 + 0.5) * s));
  // head
  const headY = (5.55 - hunch * 0.9) * s, headZ = hunch * 1.2 * s;
  g.add(sphere(0.42 * s, skin, 0, headY, headZ));
  if (o.hair) g.add(sphere(0.39 * s, o.hair, 0, headY + 0.18 * s, headZ - 0.08 * s));
  if (o.helm === 'wolf') { g.add(box(0.9 * s, 0.7 * s, 1.1 * s, PALETTE.iron, 0, headY + 0.15 * s, headZ + 0.1 * s), cone(0.18 * s, 0.5 * s, PALETTE.iron, -0.35 * s, headY + 0.75 * s, headZ), cone(0.18 * s, 0.5 * s, PALETTE.iron, 0.35 * s, headY + 0.75 * s, headZ)); }
  if (o.helm === 'cap') g.add(sphere(0.46 * s, trim, 0, headY + 0.15 * s, headZ));
  if (o.cloak) { const c = cone(1.05 * s, 5.0 * s, o.cloth ?? '#1a171d', 0, 2.6 * s, -0.3 * s); c.scale.z = 0.5; g.add(c); }
  // weapon in the right hand
  const hx = 0.88 * s, hy = 2.7 * s;
  if (o.weapon === 'sword') g.add(box(0.12 * s, 2.6 * s, 0.35 * s, PALETTE.mist1, hx + 0.3 * s, hy + 1.2 * s, 0.4 * s), box(0.7 * s, 0.12 * s, 0.12 * s, PALETTE.amberDeep, hx + 0.3 * s, hy, 0.4 * s));
  if (o.weapon === 'spear') g.add(box(0.12 * s, 7 * s, 0.12 * s, PALETTE.woodDark, hx + 0.3 * s, 3.5 * s, 0.4 * s), cone(0.2 * s, 0.8 * s, PALETTE.mist1, hx + 0.3 * s, 7.3 * s, 0.4 * s));
  if (o.weapon === 'staff') g.add(box(0.14 * s, 6 * s, 0.14 * s, PALETTE.woodDark, hx + 0.3 * s, 3 * s, 0.4 * s));
  if (o.weapon === 'torch') g.add(box(0.14 * s, 1.6 * s, 0.14 * s, PALETTE.woodDark, hx + 0.3 * s, hy + 0.5 * s, 0.4 * s), sphere(0.32 * s, PALETTE.amber, hx + 0.3 * s, hy + 1.5 * s, 0.4 * s));
  return g;
}

/** Quadruped: wolf / dog / dire wolf (scale). */
export function wolf(d: Dims = {}): THREE.Group {
  const s = d.scale ?? 1, color = d.stuffed ? '#6b5d4a' : '#5b5a5e';
  const g = grp(box(3.2 * s, 1.3 * s, 1.1 * s, color, 0, 1.9 * s, 0));
  for (const [x, z] of [[-1.1, -0.35], [1.1, -0.35], [-1.1, 0.35], [1.1, 0.35]]) g.add(box(0.35 * s, 1.4 * s, 0.35 * s, color, x * s, 0.7 * s, z * s));
  const head = box(1.1 * s, 0.9 * s, 0.9 * s, color, 2.1 * s, 2.5 * s, 0); head.rotation.z = -0.25;
  g.add(head, box(0.7 * s, 0.5 * s, 0.6 * s, color, 2.75 * s, 2.3 * s, 0), cone(0.15 * s, 0.4 * s, color, 1.9 * s, 3.1 * s, -0.25 * s), cone(0.15 * s, 0.4 * s, color, 1.9 * s, 3.1 * s, 0.25 * s));
  const tail = box(1.3 * s, 0.3 * s, 0.3 * s, color, -2.1 * s, 2.2 * s, 0); tail.rotation.z = 0.5; g.add(tail);
  if (!d.stuffed) g.add(sphere(0.09 * s, PALETTE.amber, 2.6 * s, 2.7 * s, -0.22 * s), sphere(0.09 * s, PALETTE.amber, 2.6 * s, 2.7 * s, 0.22 * s));
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
export const adventurer = () => humanoid({ skin: '#d9b899', cloth: PALETTE.pine, trim: PALETTE.woodDark, hair: '#3a2a1a', weapon: 'sword' });
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

export const CREATURES: Record<string, (d: Dims) => THREE.Group> = {
  ghoul: () => ghoul(), ghast: () => ghast(), shadow: () => shadow(), ghost: (d) => ghost(d), specter: () => specter(),
  'animated-armor': () => animatedArmor(), mimic: () => mimic(), 'shambling-mound': () => shamblingMound(), grick: () => grick(),
  'swarm-of-insects': (d) => swarm(d), 'broom-of-animated-attack': () => broom(), wolf: (d) => wolf(d), 'dire-wolf': () => wolf({ scale: 1.6 }),
  cultist: () => cultist(), adventurer: () => adventurer(), skeleton: () => skeletonStanding(), commoner: () => humanoid({ cloth: '#5b4a3a' }),
};

// ---- outdoor / village creatures (M2)
export function horse(d: Dims = {}): THREE.Group {
  const s = (d.scale ?? 1) * 1.5, color = d.bone ? PALETTE.bone : '#4a3a2e';
  const g = grp(box(4.4 * s, 1.8 * s, 1.5 * s, color, 0, 3.2 * s, 0));
  for (const [x, z] of [[-1.6, -0.5], [1.6, -0.5], [-1.6, 0.5], [1.6, 0.5]]) g.add(box(0.4 * s, 2.6 * s, 0.4 * s, color, x * s, 1.3 * s, z * s));
  const neck = box(0.9 * s, 2.2 * s, 0.9 * s, color, 2.4 * s, 4.6 * s, 0); neck.rotation.z = -0.6; g.add(neck, box(1.4 * s, 0.8 * s, 0.8 * s, color, 3.4 * s, 5.4 * s, 0));
  const tail = box(0.3 * s, 2 * s, 0.3 * s, '#2a2020', -2.3 * s, 2.6 * s, 0); tail.rotation.z = 0.4; g.add(tail);
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
