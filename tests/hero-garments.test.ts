// Garments on the jointed hero figures (kit/heroes.ts, hung by kit/cloth.ts) never let the body show through them:
// kit/clothcheck.ts reads every leg vertex under a gown, a skirt, a tunic's skirt, coat tails or a mail shirt, and every
// arm vertex under a capelet or a cloak, against the cloth, on generic figures in every frame they are shown in: each
// stance, each named pose (battle and dead), each at-ease variant, and at rest.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AT_EASE, heroFigure, POSES } from '../app/src/kit/heroes';
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
const LEG = /^(thigh|shin|foot)[RL]$/, ARM = /^(upperArm|forearm)[RL]$/;
const CLOTH = new Set(['gown', 'skirt', 'hem', 'tails', 'mail']), CAPES = new Set(['mantle', 'cloak']);
const report = (fs: Frame[], keep: (p: Poke) => boolean) => fs.map((f) => ({ f, p: f.pokes.filter(keep) })).filter((x) => x.p.length).map((x) => `${x.f.label}: ${describePokes(x.p)}`);

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
});
