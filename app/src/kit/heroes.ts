// Hero figures: a player character's own miniature, built from a recipe the DM's party pack carries (core/partyPack.ts).
// Original low-poly geometry on the kit's humanoid (kit/creatures.ts), one palette material per colour, flat shading.
// The recipe is data, so no character of any one table lives in the repo: the parts are generic (pointed ears, wings,
// a halo, a thorn crown, a shield, an axe, a book ...) and the pack says which a character wears, in what colours.
import * as THREE from 'three';
import { humanoid, type HumanoidOpts } from './creatures';
import { mat, matClone } from '../render/materials';
import type { CreatureSize } from '../core/units';

export type HeroWeapon = 'none' | 'sword' | 'axe' | 'mace' | 'staff' | 'spear' | 'torch';
export type HeroOffhand = 'none' | 'shield' | 'book' | 'orb';
export type HeroHair = 'short' | 'long' | 'braids' | 'curly';

/** A character's miniature, as the party pack writes it. Colours are CSS hex strings. */
export interface HeroFigure {
  skin?: string; hair?: string; hairStyle?: HeroHair; hairStreak?: string;
  /** Tunic / coat / armour colour, and its trim (belt, hips, legs). */
  cloth?: string; trim?: string; boots?: string;
  /** Height relative to the size's default (1 = a typical member of its size). */
  height?: number;
  ears?: 'round' | 'pointed';
  /** Plate adds heavy pauldrons and a gorget; mail a darker sleeve. */
  armor?: { kind: 'plate' | 'mail'; color: string; trim?: string };
  cloak?: string; hood?: boolean;
  /** A long gown (skirt) and, under it, a longer underskirt. */
  skirt?: string; underskirt?: string;
  weapon?: HeroWeapon;
  offhand?: { kind: HeroOffhand; color?: string; rim?: string; mark?: string };
  wings?: { color: string; opacity?: number; count?: 2 | 4 };
  halo?: string;
  crown?: { color: string; flower?: string };
  /** A glowing spell wisp above the off hand. */
  wisp?: string;
  /** Feet above the floor (a flier hovering). */
  hoverFt?: number;
  /** Detail: eye colour (a glow when bright), the shirt at the collar, sleeves, forearm bracers, a pendant, the belt
   *  buckle, the cloak's hem band, a satchel on a strap, a coat's tails and lapels, vials at the belt, and sparkles
   *  drifting around the figure. */
  eyes?: string; shirt?: string; sleeves?: string; bracers?: string; pendant?: string; buckle?: string;
  cloakTrim?: string; satchel?: string; coat?: { tails: string; lapel?: string }; vials?: string[]; sparkles?: string;
  /** Drop earrings, marks on the face (veins, scars, freckles of colour), and a ragged hem on the cloak. */
  earrings?: string; markings?: string; tattered?: boolean;
}

const SIZE_SCALE: Record<CreatureSize, number> = { tiny: 0.45, small: 0.68, medium: 1, large: 1.6, huge: 2.4, gargantuan: 3.2 };

type M = THREE.Mesh;
const at = (m: M, x: number, y: number, z: number): M => { m.position.set(x, y, z); return m; };
const box = (w: number, h: number, d: number, c: string) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
const cyl = (rt: number, rb: number, h: number, c: string, seg = 8) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c));
const ball = (r: number, c: string, detail = 0) => new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), mat(c));
const cone = (r: number, h: number, c: string, seg = 6) => new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(c));
const ring = (r: number, tube: number, c: string) => new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 28), mat(c));
/** A see-through part (wings, a wisp): its own material, flagged so the token pass keeps the look. */
function glassy(m: M, c: string, opacity: number): M {
  const nm = matClone(c); nm.transparent = true; nm.opacity = opacity; nm.depthWrite = false; nm.side = THREE.DoubleSide;
  nm.userData = { ...nm.userData, keepLook: true }; // on the material too: merging by material keeps it
  m.material = nm; m.userData.keepLook = true;
  return m;
}

/** A hero's miniature: origin at the floor centre, feet in world units, facing +z. */
export function heroFigure(f: HeroFigure, size: CreatureSize = 'medium'): THREE.Group {
  const s = (SIZE_SCALE[size] ?? 1) * (f.height ?? 1);
  const base: HumanoidOpts = {
    skin: f.skin, cloth: f.armor?.color ?? f.cloth, trim: f.trim, hair: f.hair, scale: s,
    weapon: f.weapon === 'sword' || f.weapon === 'staff' || f.weapon === 'spear' || f.weapon === 'torch' ? f.weapon : 'none',
    skirt: !!f.skirt && !f.underskirt, robe: !!f.underskirt,
  };
  const body = humanoid(base);
  const up = body.userData.upper as THREE.Group;
  const hy = 2.82 * s; // the head's centre, in the upper body's frame
  const hand = (side: 1 | -1) => new THREE.Vector3(side * 0.9 * s, -0.12 * s, 0.38 * s);

  // sleeves and bracers: the arms' upper and lower parts recoloured
  const arms = up.children.filter((c) => (c as THREE.Group).isGroup && Math.abs(Math.abs(c.position.x) - 0.86 * s) < 0.01 * s) as THREE.Group[];
  for (const a of arms) {
    const parts = a.children.filter((c) => (c as M).isMesh && (c as M).geometry.type === 'CylinderGeometry') as M[];
    if (f.sleeves && parts[0]) parts[0].material = mat(f.sleeves);
    if (f.sleeves && parts[1] && !f.bracers) parts[1].material = mat(f.sleeves);
    if (f.bracers && parts[1]) { parts[1].material = mat(f.bracers); const cuff = cyl(0.2 * s, 0.2 * s, 0.14 * s, f.bracers); cuff.position.copy(parts[1].position); cuff.position.y -= 0.42 * s; a.add(cuff); }
  }

  // the face: eyes (a bright colour reads as a glow), and a brow line
  if (f.eyes) for (const sx of [-1, 1]) { up.add(at(box(0.11 * s, 0.07 * s, 0.05 * s, f.eyes), sx * 0.15 * s, hy + 0.06 * s, 0.39 * s)); up.add(at(box(0.16 * s, 0.04 * s, 0.05 * s, f.hair ?? '#3a2a1a'), sx * 0.15 * s, hy + 0.15 * s, 0.38 * s)); }

  if (f.earrings) for (const sx of [-1, 1]) { const e = ball(0.06 * s, f.earrings, 0); e.scale.y = 1.8; up.add(at(e, sx * 0.43 * s, hy - 0.2 * s, 0.02 * s)); }
  if (f.markings) for (const [x, y, rz] of [[0.24, -0.08, 0.6], [0.3, 0.06, -0.3], [-0.26, -0.12, -0.5]]) { const m = box(0.03 * s, 0.2 * s, 0.03 * s, f.markings); m.rotation.z = rz; up.add(at(m, x * s, hy + y * s, 0.36 * s)); }

  // collar, pendant, buckle
  if (f.shirt) { const c = cyl(0.24 * s, 0.32 * s, 0.32 * s, f.shirt, 7); up.add(at(c, 0, 2.2 * s, 0.08 * s)); up.add(at(box(0.3 * s, 0.5 * s, 0.06 * s, f.shirt), 0, 1.85 * s, 0.4 * s)); }
  if (f.pendant) { up.add(at(box(0.03 * s, 0.4 * s, 0.03 * s, '#b8bec8'), 0, 1.95 * s, 0.43 * s)); const g = ball(0.09 * s, f.pendant, 0); g.scale.y = 1.6; up.add(at(g, 0, 1.68 * s, 0.45 * s)); }
  if (f.buckle) up.add(at(box(0.24 * s, 0.2 * s, 0.06 * s, f.buckle), 0, 0.42 * s, 0.63 * s));

  // a coat: tails behind, lapels in front
  if (f.coat) {
    const tails = box(1.1 * s, 1.5 * s, 0.12 * s, f.coat.tails); tails.rotation.x = 0.12; up.add(at(tails, 0, -0.45 * s, -0.42 * s));
    for (const sx of [-1, 1]) { const lp = box(0.16 * s, 0.9 * s, 0.05 * s, f.coat.lapel ?? f.coat.tails); lp.rotation.z = sx * 0.25; up.add(at(lp, sx * 0.24 * s, 1.75 * s, 0.42 * s)); }
  }

  // a satchel on a strap across the chest, and vials at the belt
  if (f.satchel) {
    const strap = box(0.1 * s, 2.5 * s, 0.05 * s, f.satchel); strap.rotation.z = -0.62; up.add(at(strap, 0.05 * s, 1.15 * s, 0.43 * s));
    up.add(at(box(0.62 * s, 0.5 * s, 0.24 * s, f.satchel), 0.72 * s, -0.12 * s, 0.38 * s));
    up.add(at(box(0.64 * s, 0.16 * s, 0.26 * s, f.buckle ?? f.satchel), 0.72 * s, 0.08 * s, 0.4 * s));
  }
  (f.vials ?? []).slice(0, 4).forEach((c, i) => { up.add(at(cyl(0.06 * s, 0.07 * s, 0.26 * s, c, 6), -0.5 * s + i * 0.15 * s, 0.25 * s, 0.6 * s)); up.add(at(box(0.07 * s, 0.07 * s, 0.07 * s, '#8a6a4a'), -0.5 * s + i * 0.15 * s, 0.42 * s, 0.6 * s)); });

  // boots in their own colour
  if (f.boots) body.children.forEach((c) => { const m = c as M; if (m.isMesh && m.geometry.type === 'BoxGeometry' && m.position.y < 0.5 * s) m.material = mat(f.boots!); });

  // gown and underskirt: the kit's long robe (or knee skirt) recoloured, and the gown over the underskirt
  const isSkirt = (c: THREE.Object3D) => { const m = c as M; return m.isMesh && m.geometry.type === 'CylinderGeometry' && (m.geometry as THREE.CylinderGeometry).parameters.radiusBottom > 1.0 * s; };
  const skirtColor = f.underskirt ?? f.skirt;
  if (skirtColor) body.children.filter(isSkirt).forEach((c) => { (c as M).material = mat(skirtColor); });
  if (f.skirt && f.underskirt) body.add(at(cyl(0.86 * s, 1.2 * s, 2.9 * s, f.skirt, 8), 0, 1.95 * s, 0));

  // ears
  if (f.ears === 'pointed') for (const sx of [-1, 1]) { const e = cone(0.1 * s, 0.55 * s, f.skin ?? '#d9b899', 4); e.position.set(sx * 0.42 * s, hy + 0.08 * s, -0.02 * s); e.rotation.z = -sx * 1.05; e.rotation.x = -0.35; up.add(e); }

  // hair
  if (f.hair) {
    if (f.hairStyle === 'long' || f.hairStyle === 'braids') { const back = box(0.78 * s, 1.5 * s, 0.22 * s, f.hair); up.add(at(back, 0, hy - 0.65 * s, -0.36 * s)); }
    if (f.hairStyle === 'long') for (const sx of [-1, 1]) { const lock = box(0.2 * s, 1.1 * s, 0.2 * s, f.hair); lock.rotation.z = sx * 0.1; up.add(at(lock, sx * 0.4 * s, hy - 0.55 * s, 0.08 * s)); }
    if (f.hairStyle === 'braids') for (const sx of [-1, 1]) {
      const b = cyl(0.09 * s, 0.07 * s, 1.6 * s, f.hair, 5); b.rotation.x = 0.12; up.add(at(b, sx * 0.4 * s, hy - 1.0 * s, 0.18 * s));
      for (const dy of [-0.55, -1.25]) { const bead = cyl(0.1 * s, 0.1 * s, 0.1 * s, '#b8bec8', 6); up.add(at(bead, sx * 0.4 * s, hy + dy * s, 0.18 * s - dy * 0.1 * s)); }
    }
    if (f.hairStyle === 'curly') for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; up.add(at(ball(0.17 * s, f.hair), Math.cos(a) * 0.36 * s, hy + 0.25 * s + (i % 2) * 0.08 * s, Math.sin(a) * 0.33 * s - 0.04 * s)); }
    if (f.hairStreak) up.add(at(box(0.1 * s, 1.2 * s, 0.12 * s, f.hairStreak), 0.3 * s, hy - 0.35 * s, 0.22 * s));
  }

  // armour
  if (f.armor?.kind === 'plate') {
    const t = f.armor.trim ?? '#a9adb6';
    for (const sx of [-1, 1]) { const p = ball(0.5 * s, f.armor.color, 1); p.scale.set(1.05, 0.62, 1); up.add(at(p, sx * 0.78 * s, 2.12 * s, 0)); up.add(at(box(0.62 * s, 0.08 * s, 0.7 * s, t), sx * 0.8 * s, 1.95 * s, 0)); }
    up.add(at(cyl(0.34 * s, 0.42 * s, 0.3 * s, t), 0, 2.28 * s, 0));                          // gorget
    up.add(at(box(0.9 * s, 0.08 * s, 0.08 * s, t), 0, 1.5 * s, 0.42 * s));                       // breastplate edge
    for (const sx of [-1, 1]) { const p2 = ball(0.42 * s, f.armor.color, 1); p2.scale.set(1, 0.5, 0.95); up.add(at(p2, sx * 0.86 * s, 1.78 * s, 0)); up.add(at(box(0.5 * s, 0.06 * s, 0.62 * s, t), sx * 0.88 * s, 1.62 * s, 0)); }
    up.add(at(box(0.5 * s, 0.06 * s, 0.06 * s, t), 0, 0.95 * s, 0.4 * s));                         // a second band
    for (const sx of [-1, 1]) {                                                                         // knees and greaves
      body.add(at(ball(0.22 * s, f.armor.color, 0), sx * 0.3 * s, 1.55 * s, 0.14 * s));
      body.add(at(cyl(0.22 * s, 0.2 * s, 0.9 * s, f.armor.color, 7), sx * 0.3 * s, 0.95 * s, 0.02 * s));
      body.add(at(box(0.3 * s, 0.05 * s, 0.05 * s, t), sx * 0.3 * s, 1.35 * s, 0.2 * s));
    }
    for (const [x, z] of [[-0.42, 0.3], [0.42, 0.3], [-0.5, -0.1], [0.5, -0.1]]) { const ts = box(0.42 * s, 0.75 * s, 0.08 * s, f.armor.color); ts.rotation.x = z > 0 ? -0.15 : 0.15; ts.rotation.y = x * 0.6; up.add(at(ts, x * s, -0.45 * s, z * s)); up.add(at(box(0.42 * s, 0.06 * s, 0.09 * s, t), x * s, -0.78 * s, z * s + 0.02 * s)); } // tassets
  }
  if (f.armor?.kind === 'mail') { const m = cyl(0.7 * s, 0.75 * s, 1.0 * s, f.armor.trim ?? f.armor.color, 7); m.scale.z = 0.66; up.add(at(m, 0, 0.55 * s, 0)); }

  // cloak (with a hood folded on the shoulders)
  if (f.cloak) {
    const c = cyl(0.8 * s, 1.2 * s, 4.7 * s, f.cloak, 8); c.scale.z = 0.42; up.add(at(c, 0, -0.1 * s, -0.36 * s));
    up.add(at(cyl(0.82 * s, 0.82 * s, 0.3 * s, f.cloak, 8), 0, 2.2 * s, -0.06 * s));
    if (f.cloakTrim) { const hem = cyl(0.81 * s, 1.215 * s, 0.22 * s, f.cloakTrim, 8); hem.scale.z = 0.43; up.add(at(hem, 0, -2.3 * s, -0.36 * s)); for (const sx of [-1, 1]) up.add(at(box(0.08 * s, 3.8 * s, 0.06 * s, f.cloakTrim), sx * 0.78 * s, 0.0 * s, -0.05 * s)); }
    if (f.tattered) for (let i = 0; i < 9; i++) { const a = Math.PI * (0.2 + 0.6 * (i / 8)) + Math.PI, x = Math.cos(a) * 1.15 * s, z = -0.36 * s + Math.sin(a) * 1.15 * 0.42 * s; const t = cone(0.12 * s, (0.35 + (i % 3) * 0.15) * s, f.cloak, 3); t.rotation.x = Math.PI; up.add(at(t, x, -2.6 * s, z)); }
    if (f.hood) { const h = ball(0.5 * s, f.cloak, 1); h.scale.set(1, 0.55, 0.8); up.add(at(h, 0, 2.38 * s, -0.42 * s)); }
  }

  // weapons in the right hand
  const r = hand(1);
  if (f.weapon === 'axe') {
    const haft = box(0.13 * s, 5.2 * s, 0.13 * s, '#4a3626'); up.add(at(haft, r.x, r.y + 1.6 * s, r.z));
    // a double-bitted head: two flared bits either side of the haft
    for (const dx of [1, -1]) { const bit = cyl(0.62 * s, 0.62 * s, 0.08 * s, '#9aa0aa', 3); bit.rotation.x = Math.PI / 2; bit.rotation.y = dx > 0 ? 0 : Math.PI; up.add(at(bit, r.x + dx * 0.45 * s, r.y + 3.75 * s, r.z)); }
    up.add(at(box(0.2 * s, 0.5 * s, 0.24 * s, '#5c626c'), r.x, r.y + 3.75 * s, r.z));
  }
  if (f.weapon === 'mace') {
    up.add(at(box(0.13 * s, 2.0 * s, 0.13 * s, '#3b2a20'), r.x, r.y + 0.6 * s, r.z));
    up.add(at(ball(0.3 * s, '#8e939b', 0), r.x, r.y + 1.75 * s, r.z));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, k = cone(0.08 * s, 0.3 * s, '#8e939b', 4); k.position.set(r.x + Math.cos(a) * 0.3 * s, r.y + 1.75 * s, r.z + Math.sin(a) * 0.3 * s); k.rotation.z = -Math.cos(a) * Math.PI / 2; k.rotation.x = Math.sin(a) * Math.PI / 2; up.add(k); }
  }

  // the off hand
  const l = hand(-1), o = f.offhand;
  if (o?.kind === 'shield') {
    const face = cyl(1.0 * s, 1.0 * s, 0.14 * s, o.color ?? '#2a3f7a', 20); face.rotation.x = Math.PI / 2; face.rotation.y = -0.35;
    up.add(at(face, l.x - 0.15 * s, l.y + 0.95 * s, l.z + 0.25 * s));
    const rim = ring(1.0 * s, 0.07 * s, o.rim ?? '#a9adb6'); rim.rotation.y = -0.35; up.add(at(rim, l.x - 0.15 * s, l.y + 0.95 * s, l.z + 0.27 * s));
    if (o.mark) for (const dx of [-0.17, 0.17]) { const m = ring(0.24 * s, 0.035 * s, o.mark); m.rotation.y = -0.35; up.add(at(m, l.x - 0.15 * s + dx * s * 0.94, l.y + 0.95 * s, l.z + 0.36 * s + dx * s * 0.3)); }
  }
  if (o?.kind === 'book') {
    const b = box(0.85 * s, 0.12 * s, 0.62 * s, o.color ?? '#4a3020'); b.rotation.x = -0.5; up.add(at(b, l.x * 0.75, l.y + 1.0 * s, l.z + 0.75 * s));
    const pages = box(0.78 * s, 0.13 * s, 0.56 * s, o.rim ?? '#e8dfc8'); pages.rotation.x = -0.5; up.add(at(pages, l.x * 0.75, l.y + 1.07 * s, l.z + 0.73 * s));
  }
  if (o?.kind === 'orb') up.add(at(ball(0.3 * s, o.color ?? '#9b7bd0', 1), l.x, l.y + 0.35 * s, l.z + 0.1 * s));
  if (f.wisp) {
    const w = glassy(ball(0.32 * s, f.wisp, 1), f.wisp, 0.7); up.add(at(w, l.x * 0.7, l.y + 1.75 * s, l.z + 0.35 * s));
    up.add(at(glassy(cone(0.2 * s, 0.7 * s, f.wisp, 5), f.wisp, 0.45), l.x * 0.7, l.y + 1.3 * s, l.z + 0.35 * s));
  }

  // wings, halo, crown
  if (f.wings) {
    const n = f.wings.count ?? 4, op = f.wings.opacity ?? 0.42;
    const pairs = n === 4 ? [{ w: 2.3, h: 2.6, y: 2.1, tilt: 0.5 }, { w: 1.7, h: 1.8, y: 0.8, tilt: -0.35 }] : [{ w: 2.6, h: 3.0, y: 1.8, tilt: 0.35 }];
    for (const p of pairs) for (const sx of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(sx * 0.18 * s, p.y * s, -0.42 * s); g.rotation.y = sx * 0.45; g.rotation.z = -sx * p.tilt;
      const wing = glassy(new THREE.Mesh(new THREE.CircleGeometry(1, 14), mat(f.wings.color)), f.wings.color, op);
      wing.scale.set(p.w * s / 2, p.h * s / 2, 1); wing.position.x = sx * p.w * s / 2; g.add(wing);
      for (const ang of [-0.45, 0, 0.45]) { const vein = box(p.w * s * 0.95, 0.04 * s, 0.03 * s, f.wings.color); vein.geometry.translate(sx * p.w * s * 0.475, 0, 0); vein.rotation.z = ang * (p.h / p.w); g.add(vein); }
      const edge = glassy(new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 20), mat(f.wings.color)), f.wings.color, Math.min(1, op + 0.35)); edge.scale.copy(wing.scale); edge.position.copy(wing.position); g.add(edge);
      up.add(g);
    }
  }
  if (f.halo) { const h = ring(0.62 * s, 0.045 * s, f.halo); h.position.set(0, hy + 0.3 * s, -0.42 * s); up.add(h); }
  if (f.crown) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, t = cone(0.05 * s, 0.32 * s, f.crown.color, 4);
      t.position.set(Math.cos(a) * 0.42 * s, hy + 0.32 * s, Math.sin(a) * 0.4 * s); t.rotation.z = -Math.cos(a) * 0.6; t.rotation.x = Math.sin(a) * 0.6; up.add(t);
      if (f.crown.flower && i % 3 === 0) up.add(at(ball(0.11 * s, f.crown.flower), Math.cos(a) * 0.44 * s, hy + 0.27 * s, Math.sin(a) * 0.42 * s));
    }
    const band = ring(0.42 * s, 0.04 * s, f.crown.color); band.rotation.x = Math.PI / 2; up.add(at(band, 0, hy + 0.24 * s, 0));
  }

  const out = new THREE.Group(); out.add(body);
  if (f.sparkles) for (let i = 0; i < 12; i++) { const a = i * 2.39996, r = (1.1 + (i % 3) * 0.35) * s, y = (0.8 + ((i * 7) % 11) * 0.42) * s + (f.hoverFt ?? 0); out.add(at(glassy(ball(0.07 * s, f.sparkles, 0), f.sparkles, 0.85), Math.cos(a) * r, y, Math.sin(a) * r)); }
  if (f.hoverFt) body.position.y = f.hoverFt;
  return out;
}

/** A flat portrait token: the picture on a disc with a coloured rim, lying on the floor (radius in feet). The picture
 *  loads in the background; `onLoad` asks for a redraw. The texture is the token's own (freed with it). */
export function portraitDisc(url: string, color: string, radiusFt: number, onLoad?: () => void, thickFt = 0.12): THREE.Group {
  const g = new THREE.Group();
  const tex = new THREE.TextureLoader().load(url, () => onLoad?.());
  tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.CircleGeometry(radiusFt * 0.9, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex }));
  (face.material as THREE.Material).userData.keepLook = true;
  face.position.y = thickFt + 0.02; face.userData.keepLook = true; face.renderOrder = 4;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radiusFt, radiusFt, thickFt, 40), mat(color));
  rim.position.y = thickFt / 2;
  g.add(rim, face);
  return g;
}
