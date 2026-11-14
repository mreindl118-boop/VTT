import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BESTIARY, searchCreatures, figureFor, aliasFor, seenAs, statsOf, speedFtOf } from '../app/src/bestiary';

describe('creature repository', () => {
  it('lists the module\'s people and monsters without the token and PC kits', () => {
    expect(BESTIARY.length).toBeGreaterThan(150);
    expect(BESTIARY.some((e) => e.id === 'pc-kit' || e.id === 'standee')).toBe(false);
  });
  it('searches by name, kind and tag, people first', () => {
    expect(searchCreatures('wolf').map((e) => e.id)).toEqual(expect.arrayContaining(['wolf', 'dire-wolf', 'werewolf']));
    expect(searchCreatures('strahd')[0].id).toBe('strahd-von-zarovich');
    expect(searchCreatures('K').some((e) => e.tags.includes('K'))).toBe(true);
    expect(searchCreatures('K84').map((e) => e.id)).toEqual(['patrina-velikovna']);
  });
  it('gives every entry a figure, a players\' name and, for open-content monsters, numbers', { timeout: 60000 }, () => {
    for (const e of BESTIARY) expect(figureFor(e).children.length).toBeGreaterThan(0);
    expect(aliasFor(BESTIARY.find((e) => e.id === 'strahd-von-zarovich')!)).not.toContain('Strahd');
    expect(aliasFor(BESTIARY.find((e) => e.id === 'wolf')!)).toBe('Wolf');
    expect(seenAs(BESTIARY.find((e) => e.id === 'ghoul')!)).toBeTruthy();
    expect(statsOf(BESTIARY.find((e) => e.id === 'dire-wolf')!)).toEqual({ ac: 14, hp: 37, speed: '50 ft', cr: '1' });
    expect(speedFtOf(BESTIARY.find((e) => e.id === 'dire-wolf')!)).toBe(50);
    expect(speedFtOf(BESTIARY.find((e) => e.id === 'rahadin')!)).toBe(30);
  });
  it('puts away what each look of a creature carries until the fight, not only what its first look carries', { timeout: 60000 }, () => {
    const e = BESTIARY.find((x) => x.id === 'skeleton')!;
    const hands = (seed: string, battle: boolean) => { const J = figureFor(e, battle, seed).userData.joints as Record<string, { children: unknown[] }>; return J.handR.children.length + J.handL.children.length; };
    for (const seed of 'abcdefgh') { expect(hands(seed, false), seed).toBe(0); expect(hands(seed, true), seed).toBeGreaterThan(0); }
  });
  it('dresses the Death House ghouls (former cultists) in the cult\'s robe when their encounter names them so, and no other ghoul', { timeout: 60000 }, () => {
    const e = BESTIARY.find((x) => x.id === 'ghoul')!;
    const robed = (seed: string, hint = '', st: boolean | 'dead' = false) => { let r = false; figureFor(e, st, seed, hint).traverse((o) => { if (o.name === 'robe') r = true; }); return r; };
    for (const st of [false, true, 'dead'] as const) expect(robed('a', 'hunched figures', st), String(st)).toBe(true);
    for (const seed of 'abcdefghijkl') expect(robed(seed), seed).toBe(false);
  });
  it('goes barefoot where it wears no boots, and only a vampire is staked when it falls', { timeout: 60000 }, () => {
    const box = new THREE.Box3();
    for (const id of ['ghoul', 'ghast', 'night-hag', 'imp']) {
      const J = figureFor(BESTIARY.find((x) => x.id === id)!, false, 'a').userData.joints as Record<string, THREE.Object3D>, s = J.neck.position.y / 2.24;
      for (const sd of ['R', 'L']) {
        // nothing of a boot left below the knee (its shaft, cuff and strap), and a foot at the ankle
        const boot = J['knee' + sd].children.filter((m) => { const g = (m as THREE.Mesh).geometry; if (!g) return false; g.computeBoundingBox(); return box.copy(g.boundingBox!).applyMatrix4(m.matrix).max.y < -0.4 * s; });
        expect(boot.length, `${id} ${sd}`).toBe(0);
        expect(J['ankle' + sd].children.some((m) => m.name === 'foot' + sd), `${id} ${sd}`).toBe(true);
      }
    }
    const staked = (id: string, seed: string) => { let st = false; figureFor(BESTIARY.find((x) => x.id === id)!, 'dead', seed).traverse((o) => { if (o.name === 'stake') st = true; }); return st; };
    const seeds = 'abcdefghijklmnop'.split('');
    expect(seeds.some((sd) => staked('vampire-spawn', sd))).toBe(true);
    for (const id of ['ghoul', 'ghast', 'night-hag', 'imp']) for (const sd of seeds) expect(staked(id, sd), id + sd).toBe(false);
  });
  it('gives named NPCs with a recipe their own miniature, standing and in a battle stance', { timeout: 60000 }, () => {
    const heroes = BESTIARY.filter((e) => e.hero);
    expect(heroes.length).toBeGreaterThan(30);
    expect(heroes.every((e) => e.kind === 'npc' && e.tier === 1)).toBe(true);
    for (const e of heroes) {
      expect(figureFor(e).children.length).toBeGreaterThan(0);
      expect(figureFor(e, true).children.length).toBeGreaterThan(0);
    }
  });
  it('every creature builds a miniature at rest, in battle and dead, and the monster registries name real creatures', { timeout: 120000 }, async () => {
    const { FOLK, MENAGERIE } = await import('../app/src/kit/menagerie');
    const { NPC_POSES, composedOk } = await import('../app/src/kit/poses');
    const { POSES } = await import('../app/src/kit/heroes');
    const ids = new Set(BESTIARY.map((e) => e.id));
    for (const id of [...Object.keys(FOLK), ...Object.keys(MENAGERIE)]) expect(ids.has(id), id).toBe(true);
    const known = (p: unknown) => typeof p !== 'string' || p in NPC_POSES || p in POSES || (/[ :]/.test(p) && composedOk(p));
    for (const e of BESTIARY) {
      if (e.hero) { expect(known(e.hero.pose), `${e.id} pose`).toBe(true); expect(known(e.hero.battlePose), `${e.id} battle pose`).toBe(true); }
      for (const battle of [false, true, 'dead'] as const) { let n = 0; figureFor(e, battle, 'token-1').traverse((o) => { if ((o as { isMesh?: boolean }).isMesh) n++; }); expect(n, `${e.id} ${battle}`).toBeGreaterThan(0); }
    }
    for (const r of Object.values(FOLK)) { expect(known(r.pose)).toBe(true); expect(known(r.battlePose)).toBe(true); }
    for (const id of ['strahd-mounted', 'strahd-mounted-charging', 'strahd-bat-form', 'strahd-wolf-form', 'strahd-mist-form', 'strahd-blade-drawn']) expect(ids.has(id), id).toBe(true);
  });
});
