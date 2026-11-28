// A token's piece (render/tokenpiece.ts) and the jiggle spring (render/jiggle.ts) as the app's pass over the tokens uses
// them: a miniature is kept from one pass to the next while what it is built from is unchanged, given the token's look
// once, and its spring carries on through the pass.
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { heroFigure, heroLook, heroOptions, type HeroFigure } from '../app/src/kit/heroes';
import { mergeByMaterial } from '../app/src/render/build';
import { Jiggle } from '../app/src/render/jiggle';
import { figureKey, tokenLook } from '../app/src/render/tokenpiece';

const tok = { id: 't1', size: 'medium' as const, role: 'pc' as const, color: '#6b3fa0', playerName: undefined as string | undefined };
const hero = (figure: HeroFigure, over: Partial<Parameters<typeof figureKey>[1]> = {}, t: Parameters<typeof figureKey>[0] = tok) => figureKey(t, { figure, state: false, jiggle: false, ghostly: false, ...over });
const meshes = (g: THREE.Object3D) => { const out: THREE.Mesh[] = []; g.traverse((c) => { if ((c as THREE.Mesh).isMesh) out.push(c as THREE.Mesh); }); return out; };

describe('figureKey', () => {
  it('keeps the key of a character whose figure, size, state and jiggle switch are unchanged, however the figure was read', () => {
    const f: HeroFigure = { frame: 'feminine', weapon: 'mace', cloak: '#3a2a4a' };
    expect(hero(f)).toBe(hero(JSON.parse(JSON.stringify(f)) as HeroFigure));
  });
  it('changes a character\'s key with each thing its miniature is built from', () => {
    const f: HeroFigure = { frame: 'feminine', weapon: 'mace' }, k = hero(f);
    const other = [hero({ ...f, weapon: 'axe' }), hero(f, {}, { ...tok, size: 'small' }), hero(f, { state: true }), hero(f, { state: 'dead' }), hero(f, { jiggle: true })];
    for (const o of other) expect(o).not.toBe(k);
    expect(new Set(other).size).toBe(other.length);
  });
  it('changes a character\'s key when its transformation is switched, and only when its figure has one', () => {
    const plain: HeroFigure = { frame: 'feminine', weapon: 'mace' }, f: HeroFigure = { ...plain, transform: { halo: '#ffffff' } };
    const key = (fig: HeroFigure, transformed?: boolean) => hero(heroLook(fig, transformed));
    expect(key(f, true)).not.toBe(key(f, false));
    expect(key(f, false)).toBe(key(f));
    expect(key(f, true)).toBe(hero({ ...plain, halo: '#ffffff' }));
    expect(key(plain, true)).toBe(key(plain, false));
  });
  it('changes a creature\'s key with its kind, state, token, the name the players know it by, the jiggle switch and the faint look', () => {
    const c = { ...tok, role: 'creature' as const }, key = (over: Partial<Parameters<typeof figureKey>[1]> = {}, t = c) => figureKey(t, { entry: 'zombie', state: false, jiggle: false, ghostly: false, ...over });
    const k = key();
    // (a creature whose figure is built as a hero's carries the bust's jiggle weights only when built with the switch on)
    const other = [key({ entry: 'ghoul' }), key({ state: true }), key({ state: 'dead' }), key({}, { ...c, id: 't2' }), key({}, { ...c, playerName: 'the cook' }), key({ jiggle: true }), key({ ghostly: true })];
    for (const o of other) expect(o).not.toBe(k);
    expect(new Set(other).size).toBe(other.length);
  });
  it('changes a member\'s key with the colour of its cloth, and no one else\'s', () => {
    const key = (role: 'member' | 'party', color: string) => figureKey({ ...tok, role, color }, { state: false, jiggle: false, ghostly: false });
    expect(key('member', '#112233')).not.toBe(key('member', '#445566'));
    expect(key('party', '#112233')).toBe(key('party', '#445566'));
  });
});

describe('heroLook', () => {
  const f: HeroFigure = { frame: 'feminine', weapon: 'mace', halo: '#f0c860', transform: { halo: '#ffffff', wings: { color: '#ffffff', count: 2 } } };
  it('is the recipe itself while the transformation is off, or when the figure has none', () => {
    expect(heroLook(f)).toBe(f);
    expect(heroLook(f, false)).toBe(f);
    const plain: HeroFigure = { frame: 'feminine' };
    expect(heroLook(plain, true)).toBe(plain);
  });
  it('lays the transformation over the recipe while it is on, without the transformation itself, and leaves the recipe as it was', () => {
    const before = JSON.stringify(f);
    expect(heroLook(f, true)).toEqual({ frame: 'feminine', weapon: 'mace', halo: '#ffffff', wings: { color: '#ffffff', count: 2 } });
    expect('transform' in heroLook(f, true)).toBe(false);
    expect(JSON.stringify(f)).toBe(before);
  });
  it('builds the transformed miniature with what the transformation adds', () => {
    const count = (g: THREE.Object3D) => meshes(g).length;
    const g: HeroFigure = { frame: 'feminine', transform: { wings: { color: '#ffffff', count: 2 } } };
    expect(count(heroFigure(heroLook(g, true)))).toBeGreaterThan(count(heroFigure(heroLook(g, false))));
    expect(count(heroFigure(g))).toBe(count(heroFigure({ frame: 'feminine' })));
  });
});

describe('tokenLook', () => {
  it('gives each mesh the token\'s look once: a miniature kept from the last pass keeps its soft shading and its materials', () => {
    const g = new THREE.Group(), fig = mergeByMaterial(heroFigure({ frame: 'feminine', cloak: '#3a2a4a', hair: '#2a1a10' }));
    g.add(fig);
    const smooth = new Set(meshes(fig).filter((m) => (m.material as THREE.Material).userData?.smooth && !(m.userData.keepLook || (m.material as THREE.Material).userData?.keepLook)));
    expect(smooth.size).toBeGreaterThan(0);
    tokenLook(g, 't1', false);
    const first = new Map(meshes(fig).map((m) => [m, m.material]));
    for (const m of smooth) expect((m.material as THREE.MeshLambertMaterial).flatShading, m.name).toBe(false);
    for (const m of meshes(fig)) { expect(m.userData.role).toBe('token'); expect(m.userData.tokenId).toBe('t1'); }
    // the next pass: the miniature stands in a new piece beside a new base, and only the new base takes the look
    const g2 = new THREE.Group(), ring = new THREE.Mesh(new THREE.RingGeometry(1, 1.2), new THREE.MeshLambertMaterial({ color: '#aa2222' }));
    g2.add(fig, ring);
    tokenLook(g2, 't1', false);
    for (const [m, mt] of first) expect(m.material, m.name).toBe(mt);
    for (const m of smooth) expect((m.material as THREE.MeshLambertMaterial).flatShading, m.name).toBe(false);
    expect((ring.material as THREE.MeshLambertMaterial).flatShading).toBe(true);
    expect(ring.userData.tokenId).toBe('t1');
  });
  it('shows a creature the players have not yet been shown faintly, and keeps a look of its own (a portrait, wings) as it is', () => {
    const g = new THREE.Group(), plain = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshLambertMaterial({ color: '#808080' }));
    const own = new THREE.MeshBasicMaterial({ color: '#ffffff' }); own.userData.keepLook = true;
    const portrait = new THREE.Mesh(new THREE.CircleGeometry(1), own);
    g.add(plain, portrait);
    tokenLook(g, 'c1', true);
    const m = plain.material as THREE.MeshLambertMaterial;
    expect(m.transparent).toBe(true); expect(m.opacity).toBeCloseTo(0.45);
    expect(portrait.material).toBe(own); expect(portrait.userData.tokenId).toBe('c1');
  });
});

describe('Jiggle as the pass over the tokens follows figures', () => {
  const raf = globalThis as unknown as { requestAnimationFrame?: (cb: (t: number) => void) => number };
  afterEach(() => { delete raf.requestAnimationFrame; heroOptions.jiggle = false; });
  /** A sprung figure: the figure, and how far its weighted mesh stands from the shape it was built with. */
  const sprung = () => {
    const fig = heroFigure({ frame: 'feminine' }), soft = meshes(fig).find((m) => m.geometry.attributes.jig)!;
    const rest = Float32Array.from(soft.geometry.attributes.position.array as Float32Array);
    const off = () => { const a = soft.geometry.attributes.position.array as Float32Array; let d = 0; for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i] - rest[i])); return d; };
    return { fig, off };
  };
  /** A sprung figure and a clock driving the spring frame by frame. */
  const setup = () => {
    heroOptions.jiggle = true;
    let next: ((t: number) => void) | undefined, now = performance.now();
    raf.requestAnimationFrame = (cb) => { next = cb; return 1; };
    const frames = (n: number) => { for (let i = 0; i < n && next; i++) { const cb = next; next = undefined; now += 16; cb(now); } };
    return { ...sprung(), frames };
  };
  it('lets a figure kept from the last pass bounce on when it is followed again', () => {
    const { fig, frames, off } = setup(), j = new Jiggle(() => {});
    j.track('a', fig); j.kick('a', 8, 3); frames(3);
    expect(off()).toBeGreaterThan(1e-4);
    j.track('a', fig); j.keepOnly(new Set(['a']));
    expect(j.bouncing('a')).toBe(true);
    frames(400);
    expect(j.bouncing('a')).toBe(false);
    expect(off()).toBeLessThan(1e-6);
  });
  it('never takes a bounce for the rest shape of a figure followed anew in the middle of one', () => {
    const { fig, frames, off } = setup(), j = new Jiggle(() => {});
    j.track('a', fig); j.kick('a', 8, 3); frames(3);
    expect(off()).toBeGreaterThan(1e-4);
    // dropped while bouncing, then followed again: it settles back to the shape it was built with
    j.keepOnly(new Set()); expect(j.bouncing('a')).toBe(false);
    j.track('a', fig); j.kick('a', 1e-6); frames(400);
    expect(off()).toBeLessThan(1e-5);
  });
  it('gives a figure built anew for a token a spring of its own, and moves the old one no more', () => {
    const { fig, frames, off } = setup(), j = new Jiggle(() => {}), anew = sprung();
    j.track('a', fig); j.kick('a', 8, 3); frames(3);
    const left = off();
    expect(left).toBeGreaterThan(1e-4);
    // the token's miniature is rebuilt (it went down, say): the new one starts at rest, and the spring follows it
    j.track('a', anew.fig);
    expect(j.bouncing('a')).toBe(false);
    frames(50);
    expect(off()).toBe(left);
    j.kick('a', 8, 3); frames(3);
    expect(anew.off()).toBeGreaterThan(1e-4);
    expect(off()).toBe(left);
  });
  it('stops following the tokens a pass did not follow', () => {
    heroOptions.jiggle = true;
    const j = new Jiggle(() => {}), a = heroFigure({ frame: 'feminine' }), b = heroFigure({ frame: 'feminine' });
    j.track('a', a); j.track('b', b); j.kick('a'); j.kick('b');
    j.keepOnly(new Set(['b']));
    expect(j.bouncing('a')).toBe(false); expect(j.bouncing('b')).toBe(true);
  });
});
