// The cult's robe in tatters (kit/costume.ts tatters), as the Death House's former cultists wear it (the robed ghouls
// and the shrine's shadows, each look only its encounter's name calls up), at rest, in battle and dead. By the cloth
// check (kit/clothcheck.ts) no part of the body may show through its skirt, and no arm or leg through a sleeve, each
// sleeve read as a garment here (its side toward the body is sewn in at the shoulder, so the trunk is not read against
// it). A shadow is see-through, which the cloth check passes over, so it is read here as if solid.
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { describe, expect, it } from 'vitest';
import { BESTIARY, figureFor } from '../app/src/bestiary';
import { findPokes } from '../app/src/kit/clothcheck';
import { namedTokens } from './npc-clips';

const ROBED = ['ghoul', 'shadow'];
type State = 'rest' | 'battle' | 'dead';
function robed(id: string, state: State, seed: string, hint: string) {
  const g = figureFor(BESTIARY.find((e) => e.id === id)!, state === 'battle' ? true : state === 'dead' ? 'dead' : false, seed, hint);
  const sleeves: THREE.Mesh[] = [];
  g.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; if (m.name === 'sleeve') { m.userData.garment = 'sleeve'; sleeves.push(m); } (m.material as THREE.Material).transparent = false; });
  g.updateMatrixWorld(true);
  return { g, sleeves, at: (n: string) => g.getObjectByName(n)!.getWorldPosition(new THREE.Vector3()) };
}
const every = () => ROBED.flatMap((id) => namedTokens(id).flatMap(({ hint, seeds }) => seeds.map((seed) => ({ id, hint, seed }))));
const worldPoints = (m: THREE.Mesh) => { const p = m.geometry.getAttribute('position'), out: THREE.Vector3[] = []; for (let i = 0; i < p.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld)); return out; };
/** The sleeve of an arm: the one nearer its elbow. */
const sleeveOf = (r: ReturnType<typeof robed>, sd: 'R' | 'L') => {
  const e = r.at('elbow' + sd), near = (m: THREE.Mesh) => Math.min(...worldPoints(m).map((p) => p.distanceTo(e)));
  return r.sleeves.reduce((a, b) => (near(a) <= near(b) ? a : b));
};

describe('the cult robe in tatters', () => {
  it('lets nothing of the body through its skirt, has a sleeve on each arm, and lets no arm or leg through either, at rest, in battle and dead', { timeout: 120000 }, () => {
    const bad: string[] = []; let n = 0;
    for (const { id, hint, seed } of every()) for (const state of ['rest', 'battle', 'dead'] as State[]) {
      const r = robed(id, state, seed, hint); n++;
      if (r.sleeves.length !== 2) bad.push(`${id} #${seed} ${state}: ${r.sleeves.length} sleeves`);
      const through = findPokes(r.g).filter((p) => p.garment === 'robe' || (p.garment === 'sleeve' && !['torso', 'pelvis', 'neck'].includes(p.part)));
      if (through.length) bad.push(`${id} #${seed} ${state}: ${through.map((p) => `${p.part} through the ${p.garment} ${p.depth.toFixed(3)} (${p.points} points)`).join(', ')}`);
    }
    expect(n).toBeGreaterThan(20);
    expect(bad).toEqual([]);
  });

  it('closes each sleeve over the shoulder, so its only open end is the cuff', () => {
    for (const { id, hint, seed } of every()) {
      const r = robed(id, 'rest', seed, hint);
      for (const sd of ['R', 'L'] as const) {
        const m = sleeveOf(r, sd), g = mergeVertices(m.geometry.clone().deleteAttribute('normal'), 1e-5), idx = g.index!, pos = g.getAttribute('position'), uses = new Map<string, number>();
        for (let t = 0; t < idx.count; t += 3) for (let k = 0; k < 3; k++) { const a = idx.getX(t + k), b = idx.getX(t + ((k + 1) % 3)); if (a === b) continue; const key = a < b ? `${a}:${b}` : `${b}:${a}`; uses.set(key, (uses.get(key) ?? 0) + 1); }
        const S = r.at('shoulder' + sd), W = r.at('wrist' + sd), v = new THREE.Vector3();
        for (const [key, u] of uses) {
          if (u !== 1) continue;
          v.fromBufferAttribute(pos, Number(key.split(':')[0])).applyMatrix4(m.matrixWorld);
          expect(v.distanceTo(W), `${id} #${seed} sleeve ${sd}: an open edge away from the cuff`).toBeLessThan(v.distanceTo(S));
        }
      }
    }
  });

  it('slides a sleeve back down a forearm raised overhead, and lets it hang below an arm held out level', () => {
    // (along the forearm from the elbow, as a share of its length: how far the cuff reaches)
    const reach = (r: ReturnType<typeof robed>, sd: 'R' | 'L') => {
      const E = r.at('elbow' + sd), W = r.at('wrist' + sd), ax = W.clone().sub(E), L = ax.length(); ax.divideScalar(L);
      return Math.max(...worldPoints(sleeveOf(r, sd)).map((p) => p.clone().sub(E).dot(ax))) / L;
    };
    const up = robed('ghoul', 'battle', 'cr-x-ghoul-t-3', 'robe'), down = robed('ghoul', 'rest', 'cr-x-ghoul-t-4', 'robe');
    expect(up.at('wristR').y - up.at('elbowR').y).toBeGreaterThan(0.6);   // (the right forearm raised overhead)
    expect(down.at('elbowL').y - down.at('wristL').y).toBeGreaterThan(0.5); // (a forearm hanging)
    expect(reach(up, 'R')).toBeLessThan(0.8);
    expect(reach(down, 'L')).toBeGreaterThan(0.95);
    // held out level (a shadow at the shrine, both arms offered to the statue): the cloth hangs well below the forearm
    const out = robed('shadow', 'rest', 'cr-x-shadow-t-2', 'cult');
    for (const sd of ['R', 'L'] as const) {
      const E = out.at('elbow' + sd), W = out.at('wrist' + sd); expect(Math.abs(W.y - E.y)).toBeLessThan(0.45 * W.distanceTo(E));
      const mid = E.clone().lerp(W, 0.75), below = Math.min(...worldPoints(sleeveOf(out, sd)).filter((p) => Math.abs(p.clone().sub(mid).dot(W.clone().sub(E).normalize())) < 0.1).map((p) => p.y));
      expect(mid.y - below).toBeGreaterThan(0.4);
    }
  });
});
