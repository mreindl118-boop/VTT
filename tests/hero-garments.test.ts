// Garments on the jointed hero figures (kit/heroes.ts, hung by kit/cloth.ts) never let the body show through them:
// kit/clothcheck.ts reads every leg vertex under a gown, a skirt, a tunic's skirt, coat tails or a mail shirt, and
// every arm vertex under a capelet or a cloak, against the cloth, on generic figures in every frame they are shown in:
// each stance, each named pose (battle and dead), each at-ease variant, and at rest; on four of the bestiary's fallen,
// the neck under a capelet's collar and the feet under a tunic's skirt or a mail shirt too; and the plates hung like
// cloth (the culet over the rump, the tassets) under a cloak (over a gown too) or under coat tails, standing and
// fallen. On a fallen body the forearms and hands lying on such cloth (hands folded on the chest, a forearm across the
// body) are read against it too: the cloth lies under them, never through them; and on a plate body fallen face down
// onto its knees, the thighs against its tassets and culet. (Coat tails hung on the plates' own layer went unread and
// stood through by the culet in every frame; a gown's cloak took no notice of the plates and fell through them.)
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AT_EASE, heroFigure, POSES, type HeroPose } from '../app/src/kit/heroes';
import { describePokes, findPokes, type Poke } from '../app/src/kit/clothcheck';

const OUTFITS: Record<string, Record<string, unknown>> = {
  gown: { frame: 'feminine', build: 'curvy', skirt: '#5e1f3a', underskirt: '#efe3c8', gownTrim: '#d8b04a' },
  'gown and cloak': { frame: 'feminine', skirt: '#2e3f6e', underskirt: '#efe3c8', cloak: '#3a2a4a' },
  skirt: { frame: 'feminine', skirt: '#6a4a2a' },
  tunic: { frame: 'masculine' },
  'cloak and capelet': { frame: 'masculine', cloak: '#2a4a8a', cloakTrim: '#dddddd', clasps: '#d8c070', hood: true },
  'cloak over mail': { frame: 'masculine', build: 'broad', cloak: '#4a3a2a', armor: { kind: 'mail', color: '#8a8f96' } },
  'coat with tails': { frame: 'masculine', coat: { tails: '#3a2a4a', lapel: '#c9a64a' } },
  plate: { frame: 'feminine', armor: { kind: 'plate', color: '#3a3f46', trim: '#c9a64a' } },
};
/** The garments each outfit hangs on its figure (so that the checks below are never vacuous). */
const WORN: Record<string, string[]> = { gown: ['gown'], 'gown and cloak': ['gown', 'cloak'], skirt: ['skirt'], tunic: ['hem'], 'cloak and capelet': ['cloak', 'mantle', 'hem'], 'cloak over mail': ['cloak', 'mantle', 'mail'], 'coat with tails': ['tails'], plate: ['culet'] };
const KIT: Record<string, Record<string, unknown>> = { 'two-handed': { weapon: 'axe' }, shield: { weapon: 'mace', offhand: { kind: 'shield' } }, cast: { weapon: 'staff' }, conjure: { offhand: { kind: 'book' } } };

type Frame = { outfit: string; label: string; dead: boolean; fig: THREE.Object3D; pokes: Poke[] };
let frames: Frame[] | undefined;
/** Every outfit in every frame, built and checked once. */
function all(): Frame[] {
  if (frames) return frames;
  frames = [];
  let outfit = '';
  const add = (label: string, rec: Record<string, unknown>, st: 'rest' | 'battle' | 'dead') => {
    const fig = heroFigure(rec as never, 'medium', st);
    frames!.push({ outfit, label, dead: st === 'dead', fig, pokes: findPokes(fig) });
  };
  for (const [name, wear] of Object.entries(OUTFITS)) {
    outfit = name;
    for (const [stance, kit] of Object.entries(KIT)) add(`${name}, stance ${stance}`, { ...wear, ...kit, stance }, 'battle');
    for (const p of Object.keys(POSES)) {
      const dead = p.startsWith('dead');
      add(`${name}, pose ${p}`, { ...wear, weapon: 'sword', ...(dead ? { deadPose: p } : { battlePose: p }) }, dead ? 'dead' : 'battle');
    }
    AT_EASE.forEach((a, i) => add(`${name}, at ease ${i}`, { ...wear, weapon: 'mace', pose: a }, 'rest'));
    add(`${name}, at rest`, { ...wear, weapon: 'mace' }, 'rest');
  }
  return frames;
}
const LEG = /^(thigh|shin|foot)[RL]$/, ARM = /^(upperArm|forearm)[RL]$/, LOWER_ARM = /^(forearm|hand)[RL]$/;
const CLOTH = new Set(['gown', 'skirt', 'hem', 'tails', 'mail']), CAPES = new Set(['mantle', 'cloak']);
const report = (fs: Frame[], keep: (p: Poke) => boolean) => fs.map((f) => ({ f, p: f.pokes.filter(keep) })).filter((x) => x.p.length).map((x) => `${x.f.label}: ${describePokes(x.p)}`);
// Four of the bestiary's fallen, as joint angles (the rig's own dead poses have none of them): on the back with the
// right arm flung out from the shoulder, the cloak spread on the floor round it; laid out on the back with the hands
// folded on the chest; crumpled on the left side, the head bowed and turned toward the shoulder, the right forearm
// across the body; and fallen forward onto the knees, face down and rump up, the feet drawn up under the skirts, the
// knees splayed
const SPRAWL: HeroPose = { lie: 'back', neck: [0.1, 0.7, 0.2], shoulderR: [-0.3, 0, 1.25], elbowR: -0.5, shoulderL: [0.1, 0, 0.7], elbowL: -1.2, hipR: [0.05, 0.3, 0.35], kneeR: 0.5, hipL: [0, 0.2, 0.15], kneeL: 0.1 };
const FOLDED: HeroPose = { lie: 'back', shoulderR: [-0.15, -0.99, 0.12], elbowR: -1.75, wristR: [0, 0.01, 0], shoulderL: [-0.33, -1.1, 0.12], elbowL: -1.85, wristL: [0, 0.01, 0], hipR: [0, 0, 0.03], hipL: [0, 0, 0.03] };
const CRUMPLED: HeroPose = { lie: 'side', spine: [0.35, 0.3, 0.15], neck: [0.3, 0.7, 0.2], shoulderR: [-0.5, 0, 0.2], elbowR: -1.9, wristR: [0.6, 0, 0], shoulderL: [-1.5, 0, 0.6], elbowL: -0.5, wristL: [0.8, 0, 0], hipR: [-0.9, 0, 0.1], kneeR: 1.5, hipL: [-0.45, 0, 0.25], kneeL: 1.0, ankleL: [0.5, 0, 0] };
const KNELT: HeroPose = { lie: 'front', spine: [0.4, 0, 0], neck: [-0.5, 0.6, 0], shoulderR: [0.9, 0, 0.5], elbowR: -0.2, shoulderL: [0.8, 0, 0.6], elbowL: -0.3, hipR: [-1.9, 0, 0.6], kneeR: 1.57, hipL: [-1.77, 0, 0.55], kneeL: 1.57 };
/** An outfit on a body laid out in a pose of its own, every garment it wears hung. */
function laid(outfit: string, label: string, deadPose: HeroPose): Frame {
  const fig = heroFigure({ ...OUTFITS[outfit], weapon: 'sword', deadPose } as never, 'medium', 'dead'), names = new Set<string>();
  fig.traverse((o) => { if (o.userData.garment) names.add(String(o.userData.garment)); });
  expect(WORN[outfit].filter((n) => !names.has(n)), `${outfit}, ${label}: not hung`).toEqual([]);
  return { outfit, label: `${outfit}, ${label}`, dead: true, fig, pokes: findPokes(fig) };
}

/** Plate armour under a cloak (or, `over` 'tails', under coat tails and no cloak), in a frame of its own, read for a
 *  plate standing up through what is worn over it. */
const PLATED = { frame: 'masculine', build: 'broad', armor: { kind: 'plate', color: '#3a3f46', trim: '#c9a64a' }, cloak: '#5a1a1a', weapon: 'sword' };
const COATED = { cloak: undefined, coat: { tails: '#3e1846', lapel: '#c9a64a' } };
function plated(label: string, rec: Record<string, unknown>, st: 'rest' | 'battle' | 'dead', over: 'cloak' | 'tails' = 'cloak'): Frame {
  const fig = heroFigure({ ...PLATED, ...(over === 'tails' ? COATED : {}), ...rec } as never, 'medium', st), names = new Set<string>(), outfit = `plate under ${over === 'tails' ? 'coat tails' : 'a cloak'}`;
  fig.traverse((o) => { if (o.userData.garment) names.add(String(o.userData.garment)); });
  expect(['culet', over].filter((n) => !names.has(n)), `${outfit}, ${label}: not hung`).toEqual([]);
  return { outfit, label: `${outfit}, ${label}`, dead: st === 'dead', fig, pokes: findPokes(fig, { plates: true }) };
}

describe('hero garments', () => {
  it('cover every frame of every outfit (each stance, pose, at-ease variant and dead pose)', () => {
    const fs = all();
    expect(fs.length).toBe(Object.keys(OUTFITS).length * (Object.keys(KIT).length + Object.keys(POSES).length + AT_EASE.length + 1));
    // every garment hung, and hung to finite points
    for (const f of fs) {
      const names = new Set<string>(), bad: string[] = [];
      f.fig.traverse((o) => {
        if (!o.userData.garment) return; names.add(String(o.userData.garment));
        const p = (o as THREE.Mesh).geometry.getAttribute('position');
        for (let i = 0; i < p.count * 3; i++) if (!Number.isFinite(p.array[i])) { bad.push(String(o.userData.garment)); break; }
      });
      expect(bad, f.label).toEqual([]);
      expect(WORN[f.outfit].filter((n) => !names.has(n)), `${f.label}: not hung`).toEqual([]);
    }
  }, 120000);

  it('never let a leg pass out through a gown, a skirt, a tunic, coat tails or a mail shirt', () => {
    expect(report(all(), (p) => LEG.test(p.part) && CLOTH.has(p.garment))).toEqual([]);
  }, 120000);

  it('never let an arm pass out through a capelet or a cloak on a figure standing (raised, swung back, held out)', () => {
    expect(report(all().filter((f) => !f.dead), (p) => ARM.test(p.part) && CAPES.has(p.garment))).toEqual([]);
  }, 120000);

  it('never let an arm pass out through a capelet or a cloak on a body laid out either (flung up past the neck, laid across the back, curled over the chest)', () => {
    expect(report(all().filter((f) => f.dead), (p) => ARM.test(p.part) && CAPES.has(p.garment))).toEqual([]);
  }, 120000);

  it('never let a forearm or a hand lying on a fallen body sink into a gown, a skirt, a tunic or a mail shirt (the cloth lies under it)', () => {
    const fs = all().filter((f) => f.dead);
    for (const o of ['gown', 'cloak over mail']) fs.push(laid(o, 'laid out, the hands folded on the chest', FOLDED), laid(o, 'crumpled, a forearm across the body', CRUMPLED));
    expect(report(fs, (p) => LOWER_ARM.test(p.part) && CLOTH.has(p.garment))).toEqual([]);
  }, 120000);

  it('never let a thigh pass out through a tasset or the culet on a plate body fallen face down, its knees drawn up and splayed', () => {
    // (the knees drawn up under the belly and spread wide, the seat in the air: each thigh comes up through where its
    // tasset hangs, so the tassets and the culet fall a lame at a time onto what lies under them)
    const fig = heroFigure({ ...OUTFITS.plate, weapon: 'sword', deadPose: KNELT } as never, 'medium', 'dead'), hung = new Set<string>();
    fig.traverse((o) => { if (o.userData.garment) hung.add(String(o.userData.garment)); });
    expect(['tassetR', 'tassetL', 'culet'].filter((n) => !hung.has(n))).toEqual([]);
    expect(describePokes(findPokes(fig).filter((p) => /^thigh[RL]$/.test(p.part) && /^(tasset[RL]|culet)$/.test(p.garment)))).toBe('');
  }, 120000);

  it('lay a capelet over an arm flung out from the shoulder of a body on its back, not torn into shards round it with the arm through them', () => {
    expect(report([laid('cloak and capelet', 'sprawled', SPRAWL)], (p) => ARM.test(p.part) && CAPES.has(p.garment))).toEqual([]);
  }, 60000);

  it('hang a tunic\'s skirt and a mail shirt over the feet of a body fallen forward onto its knees, never with a foot through them', () => {
    expect(report(['tunic', 'cloak over mail'].map((o) => laid(o, 'fallen on its knees', KNELT)), (p) => LEG.test(p.part) && CLOTH.has(p.garment))).toEqual([]);
  }, 60000);

  it('lay a cloak over the culet and the tassets, never with a plate standing up through it (fallen face down, on the knees or on the side, and standing)', () => {
    const GOWN = { frame: 'feminine', build: 'curvy', skirt: '#5e1f3a', underskirt: '#efe3c8' };
    const fs = [plated('fallen face down', { deadPose: 'dead-prone' }, 'dead'), plated('fallen on its knees', { deadPose: KNELT }, 'dead'), plated('curvy, crumpled on its side', { frame: 'feminine', build: 'curvy', deadPose: CRUMPLED }, 'dead'), plated('at rest', {}, 'rest'), ...Object.keys(KIT).map((k) => plated(`stance ${k}`, { ...KIT[k], stance: k }, 'battle')),
      plated('in a gown, fallen face down', { ...GOWN, deadPose: 'dead-prone' }, 'dead'), plated('in a gown, fallen on its knees', { ...GOWN, deadPose: KNELT }, 'dead'), plated('in a gown, curled', { ...GOWN, deadPose: 'dead-curled' }, 'dead')];
    expect(report(fs, (p) => /^(culet|tasset[RL])$/.test(p.part))).toEqual([]);
  }, 60000);

  it('hang coat tails over the culet and the tassets, never with a plate through them (standing, in battle, fallen face down, on the knees or on the side)', () => {
    const fs = [plated('at rest', {}, 'rest', 'tails'), plated('feminine, at rest', { frame: 'feminine', build: undefined }, 'rest', 'tails'), ...Object.keys(KIT).map((k) => plated(`stance ${k}`, { ...KIT[k], stance: k }, 'battle', 'tails')),
      plated('fallen face down', { deadPose: 'dead-prone' }, 'dead', 'tails'), plated('fallen on its knees', { deadPose: KNELT }, 'dead', 'tails'), plated('feminine, fallen on its knees', { frame: 'feminine', build: undefined, deadPose: KNELT }, 'dead', 'tails'), plated('crumpled on its side', { deadPose: CRUMPLED }, 'dead', 'tails'), plated('swooned', { deadPose: 'dead-swoon' }, 'dead', 'tails')];
    expect(report(fs, (p) => /^(culet|tasset[RL])$/.test(p.part))).toEqual([]);
  }, 60000);

  it('let a capelet\'s collar fall onto the back of the neck of a body crumpled on its side, never into it', () => {
    expect(report(['cloak and capelet', 'cloak over mail'].map((o) => laid(o, 'crumpled', CRUMPLED)), (p) => p.part === 'neck' && CAPES.has(p.garment))).toEqual([]);
  }, 60000);

  it('hang a gown\'s cloak against the back at its top edge, not standing off it, with its corners still behind the arms', () => {
    // (its top edge was cut round and stood almost half a foot off the back at the middle, a flat back being flatter than
    // that round; read along a level ray from the top edge in toward the trunk's axis, in the trunk's own frame)
    const C = 57, rc = new THREE.Raycaster();
    const gowns: Record<string, Record<string, unknown>> = { plain: OUTFITS['gown and cloak'], 'curvy, full sleeves': { ...OUTFITS['gown and cloak'], build: 'curvy', puffSleeves: true, fullSleeves: true, sleeves: '#efe3c8' } };
    for (const [name, rec] of Object.entries(gowns)) for (const st of ['rest', 'battle'] as const) {
      const fig = heroFigure(rec as never, 'medium', st); fig.updateMatrixWorld(true);
      const all: THREE.Mesh[] = []; fig.traverse((o) => { if ((o as THREE.Mesh).isMesh) all.push(o as THREE.Mesh); });
      const cloak = all.find((m) => m.userData.garment === 'cloak' && !m.userData.veil)!, tag = `${name} ${st}`;
      expect(cloak, tag).toBeTruthy();
      const trunk = cloak.parent!, solid = all.filter((m) => !m.userData.garment && !(m.material as THREE.Material).transparent);
      const pos = cloak.geometry.getAttribute('position') as THREE.BufferAttribute;
      const gap = (k: number) => {
        const v = new THREE.Vector3().fromBufferAttribute(pos, k).applyMatrix4(cloak.matrixWorld), q = trunk.worldToLocal(v.clone());
        const to = trunk.localToWorld(new THREE.Vector3(0, q.y, 0)).sub(v), far = to.length(); rc.set(v, to.normalize()); rc.far = far;
        return rc.intersectObjects(solid, false)[0]?.distance ?? Infinity;
      };
      // the middle of the top edge lies close on the back, and so does the edge either side of it
      for (const k of [21, 28, 35]) expect(gap(k), `${tag} column ${k}`).toBeLessThan(0.16);
      // the corners stay out where they were cut, behind the arms: the edge is not drawn in round the sides
      for (const k of [0, C - 1]) expect(gap(k), `${tag} corner ${k}`).toBeGreaterThan(0.1);
    }
  }, 120000);
});
