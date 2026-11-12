// The module's monsters, one builder per creature id: which model each is, how it stands, and how it looks in a fight.
// People-shaped monsters are recipes for the shared jointed figure (kit/heroes.ts) with their own faces (kit/faces.ts),
// gear (kit/weapons.ts) and poses (kit/poses.ts), plus the parts a person lacks (wings, horns, a tail, a beast's head).
// Everything else comes from kit/beasts.ts and kit/monsters.ts. Original geometry; no book text or numbers here.
import * as THREE from 'three';
import { heroFigure, type HeroFigure, type HeroPose } from './heroes';
import { posed } from './poses';
import type { FaceSpec } from './faces';
import type { WeaponSpec } from './weapons';
import { beast, BEASTS, BEUCEPHALUS, type BeastSpec, type BeastPoseName } from './beasts';
import * as mon from './monsters';
import type { CreatureSize } from '../core/units';

const SCALE: Record<string, number> = { tiny: 0.45, small: 0.68, medium: 1, large: 1.6, huge: 2.4, gargantuan: 3.2 };   // the figure rig's size scale
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A people-shaped monster: a figure recipe (its poses may be named from kit/poses.ts) and what is added to the body. */
export interface Folk extends Omit<HeroFigure, 'pose' | 'battlePose'> {
  pose?: string | HeroPose; battlePose?: string | HeroPose; size?: CreatureSize;
  extra?: {
    wings?: { kind: mon.WingKind; span: number; color: string; membrane?: string; spread?: number };
    horns?: { len: number; color: string; curl?: number };
    tail?: { len: number; color: string; tip?: 'spade' | 'spike' };
    /** A beast's head in place of the person's (a werewolf, a jackal-headed fiend). */
    head?: BeastSpec;
    /** A bird's beak on the face. */
    beak?: string;
    /** See-through and faintly lit (a colour), and how solid it is. */
    ghost?: string; opacity?: number;
  };
}

/** Build a people-shaped monster and fit its extras to the body's mounts. */
export function folk(r: Folk, size: CreatureSize = 'medium', battle = false): THREE.Group {
  const { extra, size: own, ...recipe } = r, sz = own ?? size, s = (SCALE[sz] ?? 1) * (r.height ?? 1);
  const g = heroFigure(posed(recipe) as HeroFigure, sz, battle), j = (g.userData.joints ?? {}) as Record<string, THREE.Object3D>;
  if (extra?.head && j.head) {
    const b = beast(extra.head, battle ? 'snarl' : 'stand'), h = (b.userData.joints as Record<string, THREE.Object3D>).head;
    if (h) { j.head.clear(); const k = (0.62 * s) / extra.head.skull; h.removeFromParent(); h.position.set(0, 0.3 * s, 0.02 * s); h.rotation.set(0.25, 0, 0); h.scale.setScalar(k); j.head.add(h); }
  }
  if (extra?.beak && j.head) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.11 * s, 0.5 * s, 6), (mon.horn(0.1, 0.01, extra.beak).material as THREE.Material)); c.rotation.x = Math.PI / 2 + 0.25; c.position.set(0, 0.3 * s, 0.5 * s); j.head.add(c); }
  if (extra?.horns && j.head) for (const sx of [-1, 1]) { const h = mon.horn(extra.horns.len * s, 0.045 * s, extra.horns.color, extra.horns.curl ?? 0.6); h.position.set(sx * 0.24 * s, 0.66 * s, 0.02 * s); h.rotation.z = -sx * 0.35; j.head.add(h); }
  if (extra?.wings && j.back) { const w = mon.wings(extra.wings.kind, extra.wings.span * s, extra.wings.color, { spread: extra.wings.spread ?? (battle ? 1 : 0.45), lift: battle ? 0.5 : 0.2, membrane: extra.wings.membrane }); w.position.set(0, 0.25 * s, -0.12 * s); j.back.add(w); }
  if (extra?.tail && j.hips) { const L = extra.tail.len * s; j.hips.add(mon.tailOf([V(0, 0, -0.15 * s), V(0, -0.25 * L, -0.4 * L), V(0.1 * L, -0.5 * L, -0.75 * L), V(0.2 * L, -0.3 * L, -L)], 0.07 * s, extra.tail.color, extra.tail.tip)); }
  if (extra?.ghost) mon.spectral(g, extra.ghost, extra.opacity ?? 0.5);
  return g;
}

/** A face of its own for someone the module never drew: sliders spread from the id, so no two commoners match. */
export function seedFace(id: string, base: FaceSpec = {}): FaceSpec {
  let h = 2166136261; for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const r = () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (((h ^= h >>> 16) >>> 0) / 4294967295) * 1.2 - 0.6; };
  return { headW: r() * 0.6, headL: r() * 0.6, jaw: r(), chin: r(), cheekbones: r(), gaunt: r() * 0.6, noseLen: r(), noseW: r(), noseHook: r(), browRidge: r(), browThick: r(), browAngle: r() * 0.7, eyeSize: r() * 0.5, eyeSpace: r() * 0.5, mouthW: r(), lipFull: r(), smile: r() * 0.5, ...base };
}

// ---------------------------------------------------------------------------------------------------- shared looks
const DEAD: FaceSpec = { gaunt: 0.9, sunken: 0.9, cheekbones: 0.7, bags: 0.7, lipFull: -0.8, smile: -0.4, teeth: true, browAngle: -0.3 };
const SKULL: FaceSpec = { gaunt: 1, sunken: 1, cheekbones: 1, jaw: 0.3, noseLen: -1, noseW: -0.6, lipFull: -1, teeth: true, bald: true, browRidge: 0.6, shadow: '#141014' };
const FERAL: FaceSpec = { gaunt: 0.7, sunken: 0.6, cheekbones: 0.8, browAngle: 0.9, browRidge: 0.5, eyeSize: 0.2, mouthW: 0.5, fangs: true, teeth: true, smile: -0.6, veins: '#6a6a8a' };
const HAG: FaceSpec = { jaw: -0.2, chin: 0.7, chinPoint: 0.9, cheekbones: 0.6, gaunt: 0.8, noseLen: 1, noseHook: 1, noseTip: 0.6, browRidge: 0.7, browAngle: 0.6, sunken: 0.8, bags: 0.8, mouthW: 0.6, lipFull: -0.8, teeth: true, age: 1, warts: true };
const STERN: FaceSpec = { jaw: 0.6, chin: 0.4, browRidge: 0.5, browAngle: 0.6, lipFull: -0.3, smile: -0.4 };
const w = (kind: WeaponSpec['kind'], o: Partial<WeaponSpec> = {}): WeaponSpec => ({ kind, ...o });
const RUSTY = { metal: '#6a5a4a', fittings: '#4a3a2a', wear: 0.9 };
const GHOSTLY = '#b8d0e8';

/** People-shaped monsters and the stock townsfolk, by creature id. */
export const FOLK: Record<string, Folk> = {
  // ---- the walking dead
  zombie: { skin: '#8a9a7c', cloth: '#4a4238', trim: '#3b352c', boots: '#2a2620', hair: '#5a5a50', tattered: true, markings: '#4a5a44', eyes: '#d8d8c0', face: { ...DEAD, bags: 1 }, pose: 'shamble', battlePose: 'shamble' },
  'strahd-zombie': { skin: '#7f8f84', cloth: '#3a2e2a', trim: '#5a1a22', boots: '#1e1a18', armor: { kind: 'mail', color: '#4a4a50' }, tattered: true, markings: '#3a4a44', eyes: '#c8e0d0', face: { ...DEAD, bald: true, scars: ['across'] }, pose: 'shamble', battlePose: 'menace' },
  ghoul: { skin: '#8a9a7c', cloth: '#4a4238', trim: '#3b352c', boots: '#8a9a7c', eyes: '#e8e070', build: 'lean', face: { ...FERAL, bald: true, veins: '#4a5a44' }, pose: 'hunched', battlePose: 'feral' },
  ghast: { skin: '#6f7f68', cloth: '#2a2420', trim: '#1a171d', boots: '#6f7f68', eyes: '#f0a040', tattered: true, cloak: '#1e1a1e', face: { ...FERAL, bald: true, noseLen: -0.6, veins: '#3a4a34' }, pose: 'hunched', battlePose: 'feral' },
  skeleton: { skin: '#d9d2c0', cloth: '#d9d2c0', trim: '#c8c0ac', boots: '#d9d2c0', eyes: '#17120e', build: 'lean', height: 0.97, face: SKULL, gear: { handR: w('shortsword', RUSTY), back: w('shortbow', { grip: '#4a3a2a' }) }, pose: 'rest', battlePose: 'slash' },
  wight: { skin: '#c8ccd2', cloth: '#3a3a4a', trim: '#2a2a34', boots: '#1e1e24', hair: '#9a9aa0', hairStyle: 'long', armor: { kind: 'mail', color: '#5a5a66', trim: '#8a8a94' }, cloak: '#2a2630', tattered: true, eyes: '#9ae0ff', face: { ...DEAD, browAngle: 0.8, age: 0.6 }, gear: { handR: w('longsword', { metal: '#8a9098', fittings: '#4a4a52', wear: 0.6 }), back: w('longbow') }, pose: 'behind-back', battlePose: 'overhead' },
  'vampire-spawn': { skin: '#d8d3d0', cloth: '#2a1a22', trim: '#1a171d', boots: '#141216', hair: '#1a1a1a', hairStyle: 'long', shirt: '#b8b0a8', tattered: true, eyes: '#e02a2a', fangs: true, face: { ...FERAL, age: 0.1 }, pose: 'hunched', battlePose: 'feral' },
  revenant: { skin: '#8a9a8c', cloth: '#3a3b40', trim: '#4d1119', boots: '#1e1e22', hair: '#6a6a6a', armor: { kind: 'plate', color: '#55585e', trim: '#8a2a2a' }, cloak: '#3a1218', tattered: true, eyes: '#ff5a2a', face: { ...DEAD, ...STERN, scars: ['cheekL', 'browR'] }, gear: { handR: w('longsword', { metal: '#9aa0a8', fittings: '#6a2a2a', wear: 0.5 }) }, pose: 'behind-back', battlePose: 'overhead' },
  // ---- spirits
  ghost: { skin: '#cfd6e0', cloth: '#cfd6e8', trim: '#b8c4d8', hair: '#e0e4ec', hairStyle: 'long', skirt: '#cfd6e8', eyes: '#ffffff', face: { ...DEAD, browAngle: -0.8, teeth: false }, pose: 'wringing', battlePose: 'haunt', extra: { ghost: GHOSTLY, opacity: 0.45 } },
  specter: { skin: '#aab4c4', cloth: '#8a94a8', trim: '#6a7488', cloak: '#7a8498', hood: true, tattered: true, skirt: '#8a94a8', eyes: '#ffffff', face: { ...SKULL }, pose: 'haunt', battlePose: 'haunt', extra: { ghost: '#a8b8d0', opacity: 0.4 } },
  poltergeist: { skin: '#c8d0dc', cloth: '#b8c4d8', trim: '#9aa8c0', eyes: '#ffffff', face: { ...DEAD, smile: 0.8, browAngle: 0.8 }, pose: 'haunt', battlePose: 'menace', extra: { ghost: '#c8d8f0', opacity: 0.16 } },
  wraith: { skin: '#141018', cloth: '#141018', trim: '#1e1826', cloak: '#17121c', hood: true, tattered: true, skirt: '#141018', eyes: '#b070ff', face: SKULL, pose: 'haunt', battlePose: 'menace', hoverFt: 0.8, extra: { ghost: '#2a1e3a', opacity: 0.78 } },
  shadow: { skin: '#0c0a10', cloth: '#0c0a10', trim: '#0c0a10', boots: '#0c0a10', eyes: '#e8e8ff', build: 'lean', face: { gaunt: 0.6, bald: true, lipFull: -1 }, pose: 'hunched', battlePose: 'feral', extra: { ghost: '#0c0a10', opacity: 0.82 } },
  banshee: { skin: '#c8d8d8', cloth: '#b8d0cc', trim: '#9ab8b4', hair: '#e8f0f0', hairStyle: 'long', ears: 'pointed', skirt: '#b8d0cc', tattered: true, eyes: '#ffffff', build: 'curvy', face: { ...DEAD, mouthW: 0.9, browAngle: -0.9, cheekbones: 0.9 }, pose: 'wringing', battlePose: 'haunt', extra: { ghost: '#b8e8dc', opacity: 0.5 } },
  'phantom-warrior': { skin: '#cfd6e0', cloth: '#b8c4d8', trim: '#9aa8c0', armor: { kind: 'plate', color: '#c0cce0', trim: '#e0e8f4' }, eyes: '#ffffff', face: { ...STERN, gaunt: 0.5 }, gear: { handR: w('longsword', { metal: '#d8e4f4' }) }, offhand: { kind: 'shield', color: '#b8c4d8', rim: '#e0e8f4' }, pose: 'rest', battlePose: 'shield', extra: { ghost: GHOSTLY, opacity: 0.5 } },
  'invisible-stalker': { skin: '#d8e8f4', cloth: '#d8e8f4', trim: '#d8e8f4', boots: '#d8e8f4', build: 'broad', height: 1.15, face: { bald: true, browAngle: 0.8 }, pose: 'haunt', battlePose: 'menace', extra: { ghost: '#e0f0ff', opacity: 0.12 } },
  // ---- hags, witches, the cursed
  'night-hag': { skin: '#4a3a5a', cloth: '#2a2420', trim: '#1e1a18', boots: '#4a3a5a', hair: '#1a1620', hairStyle: 'long', tattered: true, skirt: '#2a2420', eyes: '#ffb030', markings: '#2a1e3a', face: { ...HAG, fangs: true }, pose: 'hunched', battlePose: 'curse', glow: '#8a40c0', extra: { horns: { len: 0.55, color: '#2a2030', curl: 0.8 } } },
  'barovian-witch': { skin: '#d0b89c', cloth: '#221e24', trim: '#5b4a6b', boots: '#17141a', hair: '#1a1a1a', hairStyle: 'long', skirt: '#221e24', cloak: '#1e1a20', hood: true, tattered: true, eyes: '#7ad060', face: seedFace('barovian-witch', { noseHook: 0.7, noseLen: 0.6, browAngle: 0.6, chinPoint: 0.6, age: 0.5, warts: true }), gear: { handR: w('quarterstaff', { grip: '#3a2e22' }), beltL: w('dagger') }, pose: 'leaning', battlePose: 'curse', glow: '#7ad060' },
  mongrelfolk: { skin: '#a67c5b', cloth: '#5a4a3a', trim: '#55603a', boots: '#a67c5b', hair: '#3a2a1a', hairStyle: 'curly', tattered: true, eyes: '#d8c040', markings: '#6a8a4a', face: { headW: 0.5, jaw: 0.8, noseW: 0.9, noseLen: -0.5, eyeSpace: 0.9, eyeSize: 0.5, browRidge: 0.9, mouthW: 0.9, teeth: true, fangs: true, warts: true }, gear: { beltR: w('club') }, pose: 'hunched', battlePose: 'brawl', extra: { tail: { len: 2.2, color: '#8a6a4a' } } },
  werewolf: { skin: '#6a5a48', cloth: '#4a3e30', trim: '#3a3026', boots: '#6a5a48', build: 'broad', height: 1.12, tattered: true, eyes: '#f0c030', pose: 'hunched', battlePose: 'feral', extra: { head: { ...BEASTS['dire-wolf'], coat: '#6a5a48', under: '#8a7a64' }, tail: { len: 2.4, color: '#6a5a48' } } },
  wereraven: { skin: '#1e1c24', cloth: '#1a1a22', trim: '#3a3b40', boots: '#2a2a30', hair: '#141218', cloak: '#17161c', eyes: '#e8e0c0', face: { noseLen: 1, noseHook: 0.6, eyeSize: 0.3, browAngle: 0.2 }, gear: { beltL: w('shortsword'), back: w('shortbow') }, pose: 'behind-back', battlePose: 'menace', extra: { beak: '#2a2a30', wings: { kind: 'feather', span: 3.4, color: '#17161c' } } },
  druid: { skin: '#c8a888', cloth: '#4a5a3a', trim: '#2f4a3a', boots: '#3a2e22', hair: '#8a5a2a', hairStyle: 'long', beard: '#8a5a2a', cloak: '#3a4a2e', tattered: true, markings: '#2a4a8a', eyes: '#6ac060', face: seedFace('druid', { beard: 'long', browThick: 0.8, browAngle: 0.5, gaunt: 0.4 }), gear: { handR: w('quarterstaff', { grip: '#4a3a26' }) }, pose: 'leaning', battlePose: 'staff-raised', glow: '#6ac060' },
  berserker: { skin: '#c99a72', cloth: '#7a6a55', trim: '#5a4632', boots: '#4a3a2a', hair: '#3a2a1a', hairStyle: 'braids', beard: '#3a2a1a', build: 'broad', height: 1.08, bracers: '#4a3a2a', markings: '#2a4a8a', cloak: '#6a5a48', face: seedFace('berserker', { jaw: 0.9, browRidge: 0.8, browAngle: 0.9, beard: 'full', teeth: true, scars: ['cheekR'] }), gear: { handR: w('greataxe', { wear: 0.4 }) }, pose: 'hands-on-hips', battlePose: 'overhead' },
  // ---- made things
  scarecrow: { skin: '#a08a5a', cloth: '#6a5a3a', trim: '#5a4a3a', boots: '#8a7a4a', hair: '#c8a850', hairStyle: 'short', tattered: true, eyes: '#ff9a20', build: 'lean', height: 1.05, face: { noseLen: -0.8, eyeSize: 0.6, mouthW: 1, smile: 0.9, teeth: true, scars: ['across'], bald: true }, pose: 'shamble', battlePose: 'menace' },
  gargoyle: { skin: '#5a6068', cloth: '#5a6068', trim: '#4b5560', boots: '#5a6068', eyes: '#d8c040', build: 'broad', face: { jaw: 0.9, chin: 0.8, browRidge: 1, browAngle: 1, noseW: 0.8, noseHook: 0.6, mouthW: 0.9, fangs: true, teeth: true, bald: true }, pose: 'hunched', battlePose: 'feral', extra: { wings: { kind: 'bat', span: 3.6, color: '#4b5560', membrane: '#5a6068' }, horns: { len: 0.6, color: '#3a424a' }, tail: { len: 2.4, color: '#4b5560', tip: 'spike' } } },
  'animated-armor': { skin: '#2b2c31', cloth: '#3a3b42', trim: '#2b2c31', boots: '#55585e', armor: { kind: 'plate', color: '#6a6e76', trim: '#9aa0a8' }, gauntlets: '#6a6e76', eyes: '#17141a', face: { bald: true, lipFull: -1, noseLen: -1, shadow: '#0a0a0c' }, gear: { handR: w('longsword', { metal: '#9aa0a8' }) }, pose: 'rest', battlePose: 'overhead' },
  'shield-guardian': { size: 'large', skin: '#6a5a48', cloth: '#5a4a3a', trim: '#8a6a3a', boots: '#6a6e76', armor: { kind: 'plate', color: '#7a7260', trim: '#b89a4a' }, gauntlets: '#7a7260', pendant: '#c8a040', eyes: '#ffb030', build: 'broad', face: { bald: true, jaw: 1, browRidge: 1, lipFull: -1, noseLen: -0.6 }, pose: 'rest', battlePose: 'brawl' },
  'amber-golem': { size: 'large', skin: '#c9822e', cloth: '#c9822e', trim: '#a8681e', boots: '#c9822e', eyes: '#fff0a0', build: 'broad', face: { bald: true, jaw: 1, browRidge: 1, noseW: 0.8, noseLen: -0.4, mouthW: 0.8, fangs: true }, pose: 'hands-on-hips', battlePose: 'brawl', glow: '#ffb030' },
  'flesh-golem-the-abbots': { skin: '#a8a890', cloth: '#5a4a3a', trim: '#3a3026', boots: '#a8a890', hair: '#2a2420', build: 'broad', height: 1.2, tattered: true, markings: '#6a3a3a', eyes: '#d8d8a0', face: { jaw: 1, browRidge: 1, sunken: 0.7, scars: ['across', 'cheekL', 'browR'], lipFull: -0.6, headL: 0.4 }, pose: 'shamble', battlePose: 'brawl' },
  'clay-golem-van-richtens-tower': { size: 'large', skin: '#9a6a4a', cloth: '#9a6a4a', trim: '#7a5238', boots: '#9a6a4a', build: 'broad', eyes: '#e8d090', face: { bald: true, jaw: 0.8, headW: 0.6, noseLen: -0.8, eyeSize: 0.4, lipFull: -1, browRidge: 0.8 }, pose: 'shamble', battlePose: 'brawl' },
  // ---- the mighty
  lich: { skin: '#c8c0a8', cloth: '#2a2440', trim: '#c9822e', boots: '#1a1626', cloak: '#1e1a30', cloakTrim: '#c9a227', hood: true, tattered: true, skirt: '#2a2440', eyes: '#40e0c0', pendant: '#c9a227', crown: { color: '#c9a227' }, face: { ...SKULL }, gear: { handR: w('quarterstaff', { grip: '#1a1626', fittings: '#c9a227', gem: '#40e0c0', glow: '#40e0c0' }) }, pose: 'leaning', battlePose: 'staff-raised', glow: '#40e0c0' },
  arcanaloth: { skin: '#a8885a', cloth: '#5a1e2a', trim: '#c9a227', boots: '#2a1a1a', skirt: '#5a1e2a', cloak: '#3a1420', cloakTrim: '#c9a227', eyes: '#ffb030', pendant: '#c9a227', offhand: { kind: 'book', color: '#2a1a3a' }, pose: 'regal', battlePose: 'spellcast', glow: '#c040e0', extra: { head: { ...BEASTS.wolf, coat: '#a8885a', under: '#d8c090', mane: 'none', skull: 0.6, muzzle: 0.7, muzzleD: 0.13 } } },
  deva: { skin: '#e8d8c0', cloth: '#f0ece0', trim: '#c9a227', boots: '#c9a227', hair: '#f0e8c8', hairStyle: 'long', skirt: '#f0ece0', halo: '#ffe8a0', eyes: '#ffe8a0', build: 'broad', height: 1.1, bracers: '#c9a227', face: { jaw: 0.4, chin: 0.4, cheekbones: 0.6, noseLen: 0.2, lipFull: 0.3, browAngle: 0.1, lashes: true }, gear: { handR: w('mace', { metal: '#e8d890', fittings: '#c9a227', glow: '#ffe8a0' }) }, pose: 'regal', battlePose: 'rebuke', glow: '#ffe8a0', extra: { wings: { kind: 'feather', span: 5.2, color: '#f4f0e4' } } },
  vrock: { size: 'large', skin: '#5a5a52', cloth: '#4a4a44', trim: '#3a3a36', boots: '#8a7a4a', build: 'broad', eyes: '#e02a2a', face: { bald: true, noseLen: 1, browRidge: 0.9, browAngle: 1, gaunt: 0.6 }, pose: 'hunched', battlePose: 'feral', extra: { beak: '#c8a040', wings: { kind: 'feather', span: 4.6, color: '#3a3a36' } } },
  quasit: { size: 'tiny', skin: '#4a7a4a', cloth: '#4a7a4a', trim: '#3a6a3a', boots: '#4a7a4a', eyes: '#ffe040', ears: 'pointed', face: { headW: 0.5, noseHook: 0.8, noseLen: 0.6, mouthW: 1, smile: 0.8, fangs: true, teeth: true, bald: true, browAngle: 1 }, pose: 'hunched', battlePose: 'feral', extra: { horns: { len: 0.5, color: '#2a4a2a', curl: 0.9 }, tail: { len: 2.6, color: '#4a7a4a', tip: 'spike' } } },
  imp: { size: 'tiny', skin: '#a02a22', cloth: '#a02a22', trim: '#7a1e1a', boots: '#a02a22', eyes: '#ffe040', ears: 'pointed', face: { chinPoint: 1, noseHook: 0.6, mouthW: 0.9, smile: 0.9, fangs: true, bald: true, browAngle: 1 }, pose: 'hands-on-hips', battlePose: 'menace', hoverFt: 1.5, extra: { horns: { len: 0.45, color: '#3a1010' }, wings: { kind: 'bat', span: 3.4, color: '#7a1e1a', spread: 1 }, tail: { len: 2.8, color: '#a02a22', tip: 'spade' } } },
  // ---- stock townsfolk and soldiers
  commoner: { skin: '#d9b899', cloth: '#5a5246', trim: '#4a4034', boots: '#3a2e24', hair: '#3a2a1a', shirt: '#b8ac94', face: seedFace('commoner', { bags: 0.5, browAngle: -0.4 }), pose: 'wringing', battlePose: 'cower' },
  'noncombatant-child': { size: 'small', skin: '#e0c0a4', cloth: '#6a5a4a', trim: '#4a4034', boots: '#3a2e24', hair: '#5a4632', hairStyle: 'curly', face: { eyeSize: 0.8, noseLen: -0.8, jaw: -0.7, chin: -0.5, lipFull: 0.3, headW: 0.3 }, pose: 'wringing', battlePose: 'cower' },
  scout: { skin: '#d0ac8a', cloth: '#5a4632', trim: '#2f4a3a', boots: '#3a2e22', hair: '#3a2a1a', cloak: '#2f4a3a', hood: true, bracers: '#3a2e22', face: seedFace('scout'), gear: { handR: w('shortsword'), back: w('longbow') }, pose: 'arms-folded', battlePose: 'duelist' },
  guard: { skin: '#d9b899', cloth: '#3a3b40', trim: '#7a1f2b', boots: '#2a2420', hair: '#3a2a1a', armor: { kind: 'mail', color: '#6a6e76', trim: '#7a1f2b' }, face: seedFace('guard', STERN), gear: { handR: w('spear') }, offhand: { kind: 'shield', color: '#7a1f2b', rim: '#8a8a8a' }, pose: 'rest', battlePose: 'shield' },
  priest: { skin: '#d9b899', cloth: '#e2dccc', trim: '#c9a227', boots: '#4a3a2a', hair: '#7a7a7a', skirt: '#e2dccc', pendant: '#c9a227', face: seedFace('priest', { age: 0.6, browAngle: -0.3 }), gear: { beltR: w('mace') }, pose: 'wringing', battlePose: 'rebuke', glow: '#ffe8a0' },
  acolyte: { skin: '#d9b899', cloth: '#cfc8b8', trim: '#b08d3a', boots: '#4a3a2a', hair: '#3a2a1a', skirt: '#cfc8b8', pendant: '#b08d3a', face: seedFace('acolyte', { age: 0.1 }), gear: { beltR: w('club') }, pose: 'wringing', battlePose: 'rebuke' },
  mage: { skin: '#d9b899', cloth: '#3a3a5a', trim: '#5b4a6b', boots: '#2a2a3a', hair: '#7a7a7a', hairStyle: 'long', beard: '#7a7a7a', skirt: '#3a3a5a', cloak: '#2e2e4a', face: seedFace('mage', { beard: 'goatee', age: 0.6, browAngle: 0.4 }), gear: { handR: w('quarterstaff', { gem: '#7a9aff' }), beltL: w('dagger') }, pose: 'leaning', battlePose: 'spellcast', glow: '#7a9aff' },
  noble: { skin: '#d9b899', cloth: '#5a2a3a', trim: '#c9a227', boots: '#2a1e1a', hair: '#3a2a1a', shirt: '#e8e0d0', coat: { tails: '#5a2a3a', lapel: '#c9a227' }, buckle: '#c9a227', face: seedFace('noble', { browAngle: 0.3, smile: -0.2 }), gear: { beltL: w('rapier', { guard: 'basket', fittings: '#c9a227' }) }, pose: 'hands-on-hips', battlePose: 'duelist' },
  knight: { skin: '#d9b899', cloth: '#3a3b40', trim: '#b8c4d6', boots: '#55585e', hair: '#5a4632', armor: { kind: 'plate', color: '#8a909a', trim: '#b8c4d6' }, gauntlets: '#8a909a', cloak: '#2a3a5a', face: seedFace('knight', STERN), gear: { handR: w('greatsword'), back: w('crossbow') }, pose: 'rest', battlePose: 'overhead' },
  bandit: { skin: '#c99a72', cloth: '#5a4632', trim: '#3a3b40', boots: '#2a2420', hair: '#1a1a1a', bracers: '#3a2e22', face: seedFace('bandit', { scars: ['cheekL'], beard: 'stubble', browAngle: 0.6 }), gear: { handR: w('scimitar', { wear: 0.4 }), back: w('crossbow') }, pose: 'arms-folded', battlePose: 'slash' },
  'bandit-captain': { skin: '#c99a72', cloth: '#6a2a2a', trim: '#2a2420', boots: '#1e1a18', hair: '#1a1a1a', hairStyle: 'long', beard: '#1a1a1a', coat: { tails: '#6a2a2a', lapel: '#2a2420' }, bracers: '#2a2420', earrings: '#c9a227', face: seedFace('bandit-captain', { scars: ['browR'], moustache: 'handlebar', beard: 'goatee', smile: 0.4, eyepatch: 'L' }), gear: { handR: w('scimitar', { guard: 'basket', fittings: '#c9a227' }), beltR: w('dagger') }, pose: 'hands-on-hips', battlePose: 'duelist' },
  cultist: { skin: '#d9b899', cloth: '#1a171d', trim: '#4d1119', boots: '#141216', skirt: '#1a171d', cloak: '#1a171d', hood: true, face: seedFace('cultist', { shadow: '#2a1a22', bags: 0.6 }), gear: { handR: w('scimitar', { wear: 0.3 }) }, pose: 'wringing', battlePose: 'slash' },
  'cult-fanatic': { skin: '#d9b899', cloth: '#2a1a1a', trim: '#4d1119', boots: '#141216', skirt: '#2a1a1a', cloak: '#2a1418', cloakTrim: '#8a1a22', hood: true, pendant: '#8a1a22', markings: '#8a1a22', face: seedFace('cult-fanatic', { browAngle: 0.9, eyeSize: 0.5, gaunt: 0.6, smile: 0.5, teeth: true }), gear: { handR: w('dagger', { glow: '#8a1a22' }) }, pose: 'wringing', battlePose: 'curse', glow: '#c02030' },
  assassin: { skin: '#c99a72', cloth: '#1a1a22', trim: '#3a3b40', boots: '#141216', hair: '#1a1a1a', cloak: '#17161c', hood: true, bracers: '#2a2a30', vials: ['#6ac060', '#8a40c0'], face: seedFace('assassin', { browAngle: 0.5, lipFull: -0.5, scars: ['lip'] }), gear: { handR: w('shortsword', { metal: '#7a9a7a' }), beltR: w('dagger'), back: w('crossbow') }, pose: 'arms-folded', battlePose: 'duelist' },
  spy: { skin: '#d9b899', cloth: '#3a3a3a', trim: '#3a3b40', boots: '#1e1a18', hair: '#3a2a1a', cloak: '#2a2a2e', hood: true, face: seedFace('spy', { smile: 0.2 }), gear: { beltL: w('shortsword'), beltR: w('dagger') }, pose: 'behind-back', battlePose: 'duelist' },
  thug: { skin: '#c99a72', cloth: '#5a4632', trim: '#3a3b40', boots: '#2a2420', hair: '#1a1a1a', build: 'broad', bracers: '#3a2e22', face: seedFace('thug', { jaw: 0.9, noseW: 0.8, noseHook: -0.4, browRidge: 0.8, beard: 'stubble', scars: ['browL'] }), gear: { handR: w('mace', { wear: 0.5 }), back: w('crossbow') }, pose: 'arms-folded', battlePose: 'brawl' },
  veteran: { skin: '#d9b899', cloth: '#3a3b40', trim: '#5a4632', boots: '#2a2420', hair: '#7a7a7a', beard: '#7a7a7a', armor: { kind: 'mail', color: '#6a6e76', trim: '#5a4632' }, cloak: '#4a3a2a', face: seedFace('veteran', { ...STERN, age: 0.6, scars: ['cheekR', 'browL'], beard: 'full' }), gear: { handR: w('longsword', { wear: 0.3 }), beltL: w('shortsword'), back: w('crossbow') }, pose: 'behind-back', battlePose: 'two-handed' },
  // ---- the module's own stock figures
  'vistani-bandit': { skin: '#c99a72', cloth: '#6a2a3a', trim: '#c9a227', boots: '#2a1e1a', hair: '#1a1a1a', hairStyle: 'long', shirt: '#e0d4b8', earrings: '#c9a227', bracers: '#3a2420', face: seedFace('vistani-bandit', { moustache: 'thick', browAngle: 0.5 }), gear: { handR: w('shortsword', { guard: 'curved' }), back: w('crossbow') }, pose: 'arms-folded', battlePose: 'slash' },
  'vistani-thug': { skin: '#c99a72', cloth: '#3a4a5a', trim: '#c9a227', boots: '#2a1e1a', hair: '#1a1a1a', hairStyle: 'curly', build: 'broad', shirt: '#e0d4b8', earrings: '#c9a227', face: seedFace('vistani-thug', { jaw: 0.8, beard: 'chops', browRidge: 0.6 }), gear: { handR: w('mace'), back: w('crossbow') }, pose: 'hands-on-hips', battlePose: 'brawl' },
  'dusk-elf': { skin: '#a67c5b', cloth: '#2a2a3a', trim: '#5b4a6b', boots: '#1e1a22', hair: '#1a1a1a', hairStyle: 'long', ears: 'pointed', cloak: '#3a3a4a', hood: true, build: 'lean', face: { cheekbones: 0.8, jaw: -0.4, chinPoint: 0.5, eyeSlant: 0.7, noseW: -0.5, browAngle: -0.4, lipFull: -0.2, gaunt: 0.3 }, gear: { beltL: w('longsword'), back: w('longbow') }, pose: 'arms-folded', battlePose: 'duelist' },
  'barovian-generic': { skin: '#d9b899', cloth: '#4a4a44', trim: '#5a4632', boots: '#2a2420', hair: '#3a2a1a', shirt: '#a89c84', face: seedFace('barovian-generic', { bags: 0.6, browAngle: -0.5, smile: -0.5 }), pose: 'wringing', battlePose: 'cower' },
  'vistana-generic': { skin: '#c99a72', cloth: '#6a3a5a', trim: '#c9a227', boots: '#2a1e1a', hair: '#1a1a1a', hairStyle: 'long', shirt: '#e0d4b8', earrings: '#c9a227', skirt: '#7a2a3a', face: seedFace('vistana-generic', { smile: 0.4 }), pose: 'hands-on-hips', battlePose: 'cower' },
};

// ------------------------------------------------------------------------------------- beasts and stranger things
const b = (id: string, rest: BeastPoseName, fight: BeastPoseName) => (battle: boolean) => beast(BEASTS[id], battle ? fight : rest);
/** A rider seated on a mount's saddle. */
export function mounted(mount: BeastSpec, pose: BeastPoseName, rider: HeroFigure): THREE.Group {
  const g = beast(mount, pose), saddle = (g.userData.joints as Record<string, THREE.Object3D>).saddle;
  const r = heroFigure(rider, 'medium', false); (saddle ?? g).add(r); if (!saddle) r.position.y = mount.height;
  return g;
}
const BONE_HORSE: BeastSpec = { ...BEASTS['riding-horse'], coat: '#d8d0bc', under: '#c0b8a4', maneColor: '#8a8478', eyes: '#70e0ff', glow: true, gaunt: 1, mane: 'none', tail: 'whip', saddle: { seat: '#3a2e26', trim: '#6a6a6a' } };

/** Every creature that is not people-shaped, by id: how it stands, and how it looks in initiative. */
export const MENAGERIE: Record<string, (battle: boolean) => THREE.Group> = {
  wolf: b('wolf', 'stand', 'snarl'), 'dire-wolf': b('dire-wolf', 'stand', 'snarl'), mastiff: b('mastiff', 'stand', 'snarl'), 'hell-hound': b('hell-hound', 'snarl', 'pounce'),
  'black-cat': b('black-cat', 'stand', 'snarl'), 'saber-toothed-tiger': b('saber-toothed-tiger', 'stand', 'pounce'),
  'riding-horse': b('riding-horse', 'stand', 'rear'), 'draft-horse': b('draft-horse', 'stand', 'rear'), nightmare: b('nightmare', 'walk', 'rear'),
  beucephalus: (battle) => beast(BEUCEPHALUS, battle ? 'rear' : 'walk'),
  'skeletal-rider': (battle) => mounted(BONE_HORSE, battle ? 'gallop' : 'walk', posed({ ...FOLK.skeleton, extra: undefined, gear: { handR: w('longsword', RUSTY) }, pose: battle ? 'ride-charge' : 'ride' }) as HeroFigure),
  bat: (battle) => mon.flyer(mon.FLYERS.bat, battle ? 'dive' : 'flap', 2.5), raven: (battle) => mon.flyer(mon.FLYERS.raven, battle ? 'dive' : 'perch', battle ? 2.5 : 0),
  roc: (battle) => mon.flyer(mon.FLYERS.roc, battle ? 'dive' : 'glide', 6),
  'swarm-of-bats': () => mon.swarmOf('bats'), 'swarm-of-ravens': () => mon.swarmOf('ravens'), 'swarm-of-rats': () => mon.swarmOf('rats', 12), 'swarm-of-insects': () => mon.swarmOf('insects', 16),
  'giant-spider': (battle) => mon.spider(1.6, '#2a2420', '#8a1a1a', battle ? 0.6 : 0),
  'red-dragon-wyrmling': (battle) => mon.dragon({ coat: '#a02a22', under: '#d8a050', pose: battle ? 'snarl' : 'stand', spread: battle ? 1 : 0.4 }),
  argynvost: (battle) => mon.dragon({ scale: 3, coat: '#c8d0dc', under: '#e8ecf4', ghost: true, pose: battle ? 'rear' : 'stand', spread: 1 }),
  'twig-blight': (battle) => mon.blight('twig', { battle }), 'needle-blight': (battle) => mon.blight('needle', { battle }), 'vine-blight': (battle) => mon.blight('vine', { battle }),
  'tree-blight': (battle) => mon.blight('tree', { battle }), wintersplinter: (battle) => mon.blight('tree', { scale: 1.35, bark: '#3a3028', leaf: '#4a5a3a', eyes: '#70e060', battle }),
  'gulthias-tree': () => mon.gulthiasTree(),
  'gray-ooze': (battle) => mon.ooze('#7a7a78', 1, { reach: battle }), mimic: (battle) => mon.mimic(battle), grick: () => mon.grick(),
  'shambling-mound': () => mon.shamblingMound(), 'lorghoth-the-decayer': () => mon.shamblingMound(1.25, '#4a4a26'),
  'will-o-wisp': () => mon.wisp(), flameskull: () => mon.flameskull(), 'crawling-claw': () => mon.crawlingClaw(),
  'rug-of-smothering': (battle) => mon.rug('#6a2a2a', '#c8a040', battle ? 0.7 : 0), 'flying-sword': () => mon.flyingSword(), 'broom-of-animated-attack': (battle) => mon.broom(battle),
  'baba-lysagas-creeping-hut': (battle) => mon.creepingHut(battle), 'heart-of-sorrow': () => mon.heartOfSorrow(),
};
