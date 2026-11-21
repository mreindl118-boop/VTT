// Walking sticks at rest (kit/weapons.ts walkingStick): every NPC who carries a staff, a shovel or a cane out of a fight
// stands it on the floor in the hand, as heroes.ts plants it: a staff slides through the fist till its foot is down, a
// shovel stands so on its blade, and a cane is held by its crook with its foot set down ahead. The sticks' clips and the
// cloth over them are the NPC clip tests' business (tests/npc-clips-rest.test.ts).
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
const seen = vi.hoisted(() => ({ last: undefined as unknown }));
vi.mock('../app/src/kit/heroes', async (orig) => {
  const m = await orig<typeof import('../app/src/kit/heroes')>();
  return { ...m, heroFigure: (...a: Parameters<typeof m.heroFigure>) => { seen.last = a[0]; return m.heroFigure(...a); } };
});
import { BESTIARY, figureFor } from '../app/src/bestiary';
import type { HeroFigure } from '../app/src/kit/heroes';
import { FOLK, LOOKS } from '../app/src/kit/menagerie';
import { walkingStick } from '../app/src/kit/weapons';
import { namedTokens, TOKENS } from './npc-clips';

const STICKS = /quarterstaff|gulthias-staff|shovel|sword-cane/;
/** Every NPC token that may carry a stick at rest, built at rest: the recipe the rig was handed and the figure. */
function carriers() {
  const out: { who: string; f: HeroFigure; g: THREE.Group }[] = [];
  for (const e of BESTIARY) {
    const may = e.hero ? STICKS.test(JSON.stringify(e.hero.gear ?? {})) : STICKS.test(JSON.stringify([FOLK[e.id] ?? {}, LOOKS[e.id] ?? []]));
    if (!may) continue;
    for (const { hint, seeds } of e.hero ? [{ hint: '', seeds: [''] }] : [{ hint: '', seeds: TOKENS }, ...namedTokens(e.id)]) for (const seed of seeds) {
      seen.last = undefined;
      const g = figureFor(e, false, seed, hint), f = seen.last as HeroFigure | undefined;
      if (f && g.getObjectByName('neck')) { g.updateMatrixWorld(true); out.push({ who: `${e.id}${hint ? ` "${hint}"` : ''}${seed ? ' #' + seed : ''}`, f, g }); }
    }
  }
  return out;
}
let made: ReturnType<typeof carriers> | undefined;
const all = () => (made ??= carriers());
/** The lowest point of everything but what the hands hold (the soles). */
function floorOf(g: THREE.Group): number {
  let y = Infinity; const held = new Set<THREE.Object3D>(); for (const n of ['handR', 'handL']) g.getObjectByName(n)?.traverse((o) => held.add(o));
  const v = new THREE.Vector3();
  g.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh || held.has(m) || (m.material as THREE.Material).transparent) return; const p = m.geometry.getAttribute('position'); for (let i = 0; i < p.count; i++) y = Math.min(y, v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld).y); });
  return y;
}
/** How near a point comes to the surface of what is held (each of its triangles' nearest point). */
function nearest(o: THREE.Object3D, p: THREE.Vector3): number {
  let d = Infinity; const tri = new THREE.Triangle(), q = new THREE.Vector3();
  o.traverse((c) => {
    const m = c as THREE.Mesh; if (!m.isMesh) return;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry, pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i += 3) { tri.a.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld); tri.b.fromBufferAttribute(pos, i + 1).applyMatrix4(m.matrixWorld); tri.c.fromBufferAttribute(pos, i + 2).applyMatrix4(m.matrixWorld); d = Math.min(d, tri.closestPointToPoint(p, q).distanceTo(p)); }
  });
  return d;
}
const pointsOf = (o: THREE.Object3D) => { const out: THREE.Vector3[] = []; o.traverse((c) => { const m = c as THREE.Mesh; if (!m.isMesh) return; const p = m.geometry.getAttribute('position'); for (let i = 0; i < p.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld)); }); return out; };

describe('walking sticks at rest', () => {
  it('stands every staff, shovel and cane an NPC carries out of a fight on the floor, in the fist', { timeout: 300000 }, () => {
    const bad: string[] = []; let n = 0;
    for (const { who, f, g } of all()) for (const sd of ['R', 'L'] as const) {
      const spec = f.gear?.[sd === 'R' ? 'handR' : 'handL'], hold = g.getObjectByName('hand' + sd);
      if (!spec || !walkingStick(spec) || !hold?.children.length) continue;
      n++;
      const size = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()).y / 6;   // (about 1 for a man)
      const pts = pointsOf(hold.children[0]), low = Math.min(...pts.map((p) => p.y)), floor = floorOf(g);
      if (Math.abs(low - floor) > 0.03 * size) bad.push(`${who}: its ${spec.kind} ${low > floor ? 'floats' : 'sinks'} ${Math.abs(low - floor).toFixed(3)} ft ${low > floor ? 'above' : 'into'} the floor`);
      // (the fist closes round it: what it holds passes through where the fingers curl)
      const grip = hold.getWorldPosition(new THREE.Vector3()), near = nearest(hold.children[0], grip);
      if (near > 0.1 * size) bad.push(`${who}: its ${spec.kind} is ${near.toFixed(3)} ft from the fist`);
    }
    expect(n).toBeGreaterThan(20);
    expect(bad).toEqual([]);
  });

  it('carries van Richten\'s sword cane as a cane at rest, its foot set down ahead of him as in the module art', () => {
    const vr = all().find((c) => c.who === 'rudolph-van-richten')!;
    expect(vr.f.gear?.handR).toMatchObject({ kind: 'sword-cane', sheathed: true });
    expect(vr.f.gear?.beltR ?? vr.f.gear?.beltL).toBeUndefined();   // (no bare blade at the hip)
    const hold = vr.g.getObjectByName('handR')!, pts = pointsOf(hold.children[0]), foot = pts.reduce((a, b) => (b.y < a.y ? b : a)), fist = hold.getWorldPosition(new THREE.Vector3());
    expect(foot.z - fist.z).toBeGreaterThan(0.6);                    // planted well ahead of the fist
    expect(Math.abs(foot.x - fist.x)).toBeLessThan(foot.z - fist.z);  // more ahead than out to the side
    // its blade stays in the shaft: no bright metal lower than the crook
    let metalLow = Infinity; hold.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; const c = (m.material as THREE.MeshLambertMaterial).color; if (c.r > 0.5 && c.g > 0.5 && c.b > 0.5) metalLow = Math.min(metalLow, new THREE.Box3().setFromObject(m).min.y); });
    expect(metalLow).toBeGreaterThan(fist.y - 0.4);
  });

  it('draws the blade from van Richten\'s sword cane in a fight', () => {
    seen.last = undefined;
    figureFor(BESTIARY.find((e) => e.id === 'rudolph-van-richten')!, true, '', '');
    expect((seen.last as HeroFigure).gear?.handR).toMatchObject({ kind: 'sword-cane' });
    expect((seen.last as HeroFigure).gear?.handR?.sheathed).toBeUndefined();
  });
});
