import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { heroFigure, type HeroFigure, type HeroPose } from '../app/src/kit/heroes';
import { describeClips, findClips, type ClipHit, type ClipOptions } from '../app/src/kit/clipcheck';

// The checker on plain figures of the shared rig (no character's recipe): what it must find and what it must let pass.
const clips = (f: HeroFigure, o?: ClipOptions) => findClips(heroFigure(f, 'medium', 'rest'), f, o);
const pairs = (h: ClipHit[]) => h.map((x) => `${x.part}>${x.into}`);
const STAND: HeroPose = { shoulderR: [0, 0, 0.18], elbowR: -0.2, shoulderL: [0, 0, 0.18], elbowL: -0.2, hipR: [0, 0, 0.08], hipL: [0, 0, 0.08] };
const CROSSED: HeroPose = { hipR: [0, 0, -0.3], hipL: [0, 0, -0.3] };
/** The figure with a 2.6 ft blade fixed to one of its mounts (a hand's holder, a belt), running from it along `dir`
 *  (world; the figure faces +z and its right side is at -x). */
function bladed(f: HeroFigure, mount: string, dir: [number, number, number]) {
  const g = heroFigure(f, 'medium', 'rest'); g.updateMatrixWorld(true);
  const m = g.getObjectByName(mount)!, d = new THREE.Vector3(...dir).normalize(), b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 0.1), new THREE.MeshBasicMaterial());
  b.position.copy(m.getWorldPosition(new THREE.Vector3()).addScaledVector(d, 1.3)); b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  g.add(b); g.updateMatrixWorld(true); m.attach(b);
  return findClips(g, f);
}

describe('clip check', () => {
  it('finds nothing on a figure standing clear, on either frame, or lying flat', () => {
    expect(clips({ pose: STAND })).toEqual([]);
    expect(clips({ build: 'curvy', pose: STAND })).toEqual([]);
    expect(clips({ pose: { lie: 'back' } })).toEqual([]);
  });

  it('finds a forearm swung into the belly', () => {
    expect(pairs(clips({ pose: { ...STAND, shoulderR: [-0.2, -0.9, -0.3], elbowR: -1.6 } }))).toContain('forearmR>torso');
  });

  it('finds legs crossed through each other', () => {
    const p = pairs(clips({ pose: CROSSED }));
    expect(p).toContain('thighR>thighL');
    expect(p).toContain('thighL>thighR');
  });

  it('lets flesh press on flesh a little, but not a joint folded through itself', () => {
    expect(pairs(clips({ pose: { ...STAND, shoulderR: [-0.4, 0, 0.3], elbowR: -2.2 } }))).not.toContain('forearmR>upperArmR');
    expect(pairs(clips({ pose: { ...STAND, shoulderR: [-0.4, 0, 0.3], elbowR: -2.95 } }))).toContain('forearmR>upperArmR');
    expect(pairs(clips({ pose: { lie: 'back', hipR: [-1.0, 0, 0.1], kneeR: 1.6 } }))).not.toContain('shinR>thighR');
    expect(pairs(clips({ pose: { lie: 'back', hipR: [-1.0, 0, 0.1], kneeR: 2.6 } }))).toContain('shinR>thighR');
  });

  it('finds a hand bent back into its own forearm', () => {
    const arm: HeroPose = { ...STAND, shoulderR: [-0.4, 0, 0.3], elbowR: -0.4 };
    expect(pairs(clips({ pose: { ...arm, wristR: [1.0, 0, 0] } }))).not.toContain('handR>forearmR');
    expect(pairs(clips({ pose: { ...arm, wristR: [-2.4, 0, 0] } }))).toContain('handR>forearmR');
  });

  it('finds a held blade run through the body, and a scabbard through a thigh', () => {
    const hang: HeroFigure = { pose: { ...STAND, shoulderR: [0, 0, 0.1], elbowR: -0.1 } };
    expect(bladed(hang, 'handR', [-1, 0, 0]).filter((h) => h.part === 'gearR')).toEqual([]);
    expect(bladed(hang, 'handR', [1, 0, 0]).some((h) => h.part === 'gearR' && /pelvis|thigh|torso/.test(h.into))).toBe(true);
    expect(bladed({ pose: STAND }, 'beltR', [-0.3, 0, -1]).filter((h) => h.part === 'stowedR')).toEqual([]);
    expect(pairs(bladed({ pose: STAND }, 'beltR', [0.3, -1, 0]))).toContain('stowedR>thighR');
  });

  it('leaves out legs pressed together inside a gown', () => {
    const legs = /^(thigh|shin)/;
    expect(clips({ skirt: '#552233', underskirt: '#331122', pose: CROSSED }).filter((h) => legs.test(h.part) && legs.test(h.into))).toEqual([]);
  });

  it('puts the deepest first, and takes a tolerance and parts to leave out', () => {
    const f: HeroFigure = { pose: CROSSED }, h = clips(f);
    for (let i = 1; i < h.length; i++) expect(h[i - 1].depth).toBeGreaterThanOrEqual(h[i].depth);
    expect(clips(f, { tolerance: 2 })).toEqual([]);
    expect(clips(f, { ignore: ['thighR', 'thighL', 'shinR', 'shinL'] })).toEqual([]);
    expect(describeClips([{ part: 'handR', into: 'torso', depth: 0.123, points: 4, at: [0, 0, 0] }])).toBe('handR→torso 0.12ft×4');
  });
});
