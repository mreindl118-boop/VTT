// Tailoring on the jointed hero figures (kit/heroes.ts): a frock coat (its skirts hung by kit/cloth.ts, its fronts,
// lapels and collar made on the chest), a waistcoat with its watch chain, a shirt front with a stand collar, wide-leg
// trousers, and an insect's wings. On generic figures in each frame: the figure stays clean (kit/clipcheck.ts, and
// kit/clothcheck.ts with the plates read) at rest, in each battle stance and in each dead pose; what is made on the
// chest lies on it, never under its surface, over a bust or a chest's muscle; a hand resting on the body lies on the
// tailoring, pressing it no deeper than a hand presses the body; a fallen body rests on the floor with nothing of its clothes below it; and a recipe without
// the new fields keeps the plain coat, collar and legs.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AT_EASE, heroFigure, heroOptions, type HeroFigure } from '../app/src/kit/heroes';
import { describeClips, findClips } from '../app/src/kit/clipcheck';
import { describePokes, findPokes } from '../app/src/kit/clothcheck';

const SUIT: HeroFigure = { cloth: '#2f3a4a', sleeves: '#2f3a4a', hem: false, coat: { tails: '#2f3a4a', lapel: '#1c232e' }, coatCut: 'frock', coatEmbroidery: '#c9a64a', lapelPin: '#d8d8d8',
  waistcoat: { color: '#7a2a2a', chain: '#c9a64a', fob: '#4ad0c0' }, shirt: '#e8e2d0', shirtCollar: 'stand', trousers: '#3a3a40' };
const FRAMES: Record<string, HeroFigure> = { masculine: { frame: 'masculine' }, broad: { frame: 'masculine', build: 'broad' }, feminine: { frame: 'feminine' }, curvy: { frame: 'feminine', build: 'curvy' },
  slight: { frame: 'feminine', body: { shoulders: 0.95, chest: 0.92, waist: 0.94, hips: 0.86, bust: 0.6, arms: 0.88, legs: 0.92 } } };
const KIT: Record<string, HeroFigure> = { 'two-handed': { weapon: 'axe' }, shield: { weapon: 'mace', offhand: { kind: 'shield' } }, cast: { offhand: { kind: 'book' } }, conjure: { offhand: { kind: 'book' } } };
const DEAD = ['dead', 'dead-prone', 'dead-comic', 'dead-swoon', 'dead-curled'] as const;

type M = THREE.Mesh;
const solid = (o: THREE.Object3D): o is M => (o as M).isMesh && !((o as M).material as THREE.Material).transparent;
const meshes = (g: THREE.Object3D, keep: (m: M) => boolean = () => true) => { const out: M[] = []; g.traverse((o) => { if ((o as M).isMesh && keep(o as M)) out.push(o as M); }); return out; };
const colourOf = (m: M) => '#' + (m.material as THREE.MeshLambertMaterial).color.getHexString();
const joint = (g: THREE.Object3D, n: string) => (g.userData.joints as Record<string, THREE.Object3D>)[n];
const eachVertex = (m: M, fn: (v: THREE.Vector3) => void) => { const p = m.geometry.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) fn(v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld)); };
/** How far the deepest of `pts`' vertices lies under `over` (feet): each is looked out from along the line from the
 *  axis of `frame` through it, and what of `over` is met that way lies over it. */
function under(pts: M[], over: M[], frame: THREE.Object3D): number {
  const rc = new THREE.Raycaster(); rc.far = 0.6;
  const two = over.map((m) => { const c = m.clone(); c.material = (m.material as THREE.Material).clone(); (c.material as THREE.Material).side = THREE.DoubleSide; c.matrixWorld.copy(m.matrixWorld); c.matrixAutoUpdate = false; return c; });
  let worst = 0;
  for (const m of pts) eachVertex(m, (w) => {
    const l = frame.worldToLocal(w.clone()); l.y = 0; if (l.lengthSq() < 1e-8) return;
    rc.set(w, l.normalize().transformDirection(frame.matrixWorld));
    for (const h of rc.intersectObjects(two, false)) worst = Math.max(worst, h.distance);
  });
  return worst;
}

describe('a frock coat, a waistcoat, a stand collar and wide-leg trousers', () => {
  it('stay clean in every frame: at rest and at ease, in each stance, and fallen in each dead pose', () => {
    const bad: string[] = [];
    for (const [name, fr] of Object.entries(FRAMES)) {
      const check = (label: string, rec: HeroFigure, st: 'rest' | 'battle' | 'dead') => {
        const g = heroFigure(rec, 'medium', st); g.updateMatrixWorld(true);
        const clips = findClips(g, rec), pokes = findPokes(g, { plates: true });
        if (clips.length || pokes.length) bad.push(`${name}, ${label}: ${describeClips(clips)} ${describePokes(pokes)}`);
        expect(meshes(g, (m) => m.userData.garment === 'tails')).toHaveLength(1);
      };
      check('at rest', { ...SUIT, ...fr, weapon: 'sword' }, 'rest');
      AT_EASE.forEach((a, i) => check(`at ease ${i}`, { ...SUIT, ...fr, pose: a }, 'rest'));
      for (const [stance, kit] of Object.entries(KIT)) check(`stance ${stance}`, { ...SUIT, ...fr, ...kit, stance: stance as HeroFigure['stance'] }, 'battle');
      for (const p of DEAD) check(p, { ...SUIT, ...fr, deadPose: p }, 'dead');
    }
    expect(bad).toEqual([]);
  }, 600000);

  it('are made on the chest, never under its surface: over a bust, over a chest\'s muscle, and on a small figure', () => {
    for (const [name, fr, size] of [['masculine', FRAMES.broad, 'medium'], ['curvy', FRAMES.curvy, 'medium'], ['slight', FRAMES.slight, 'small']] as const) {
      const g = heroFigure({ ...SUIT, ...fr }, size); g.updateMatrixWorld(true);
      const chest = joint(g, 'chest'), skin = chest.children.filter((c): c is M => solid(c) && !!c.userData.skin);
      const torso = skin.reduce((a, b) => (b.geometry.attributes.position.count > a.geometry.attributes.position.count ? b : a));
      const made = skin.filter((m) => m !== torso && [SUIT.shirt, SUIT.waistcoat!.color, SUIT.coat!.tails, SUIT.coat!.lapel].includes(colourOf(m)));
      expect(made.length, name).toBe(7); // the shirt, two waistcoat fronts, two coat fronts, two lapels
      expect(made.map((m) => [under([m], [torso], chest), colourOf(m), m.geometry.attributes.position.count] as const).filter((x) => x[0] >= 0.005), name).toEqual([]);
    }
  }, 300000);

  it('lie under a hand set on the body, and clear of the hands at ease and of what they hold', () => {
    for (const [name, fr] of Object.entries(FRAMES)) for (const [label, rec, st] of [['fist on the hip', { pose: AT_EASE[1] }, 'rest'], ['hand on the belt', { pose: AT_EASE[2] }, 'rest'], ['book before the chest', { offhand: { kind: 'book' }, stance: 'conjure' }, 'battle'], ['book read at rest', { offhand: { kind: 'book' }, pose: { book: 'open', shoulderL: [-0.15, -0.35, 0.45], elbowL: -1.35, shoulderR: [-0.35, -0.6, 0.1], elbowR: -1.2 } }, 'rest']] as const) {
      const g = heroFigure({ ...SUIT, ...fr, ...rec } as HeroFigure, 'medium', st); g.updateMatrixWorld(true);
      const chest = joint(g, 'chest'), all = chest.children.filter((c): c is M => solid(c) && !c.userData.garment);
      const torso = all.filter((m) => m.userData.skin).reduce((x, y) => (y.geometry.attributes.position.count > x.geometry.attributes.position.count ? y : x)), made = all.filter((m) => m !== torso);
      for (const sd of ['R', 'L']) {
        const hand = meshes(joint(g, 'wrist' + sd), solid), fore = joint(g, 'elbow' + sd).children.filter(solid);
        // (a hand set on the body presses it a little, as flesh does: the tailoring over it is pressed no more than that again)
        const press = under([...hand, ...fore], [torso], chest), deep = under([...hand, ...fore], made, chest) < press + 0.02 ? [] : made.map((m) => [under([...hand, ...fore], [m], chest), colourOf(m) + ' ' + m.geometry.type + (m.userData.cloth ?? '')] as const).filter((x) => x[0] >= press + 0.02);
        expect(deep, `${name}, ${label}, ${sd} hand and forearm under the tailoring (pressing the body ${press.toFixed(3)})`).toEqual([]);
        const other = joint(g, 'elbow' + (sd === 'R' ? 'L' : 'R'));
        expect(under([...hand, ...fore], other.children.filter(solid), other), `${name}, ${label}, ${sd} hand in the other cuff`).toBeLessThan(0.02);
      }
    }
  }, 300000);

  it('rest on the floor on a fallen body: nothing of the suit below it', () => {
    for (const [name, fr] of Object.entries(FRAMES)) for (const p of DEAD) {
      const rec = { ...SUIT, ...fr, deadPose: p }, g = heroFigure(rec, 'medium', 'dead'); g.updateMatrixWorld(true);
      const head = joint(g, 'head');
      let low = Infinity, what = '';
      for (const m of meshes(g, solid)) { let a: THREE.Object3D | null = m, onHead = false; while (a) { if (a === head) onHead = true; a = a.parent; } if (onHead) continue; eachVertex(m, (v) => { if (v.y < low) { low = v.y; what = colourOf(m); } }); }
      expect(low, `${name}, ${p}: ${what}`).toBeGreaterThan(-0.02); // (a trim on the cloth the body lies on is pressed into the floor by its own thickness at most)
    }
  }, 300000);

  it('bend the trouser legs with the knee, in one piece, and hide the leg and the boot\'s cuff', () => {
    const rec: HeroFigure = { ...SUIT, frame: 'feminine', boots: '#ff0000', trim: '#00ff00' }, g = heroFigure({ ...rec, pose: 'kneel' }); g.updateMatrixWorld(true);
    expect(describeClips(findClips(g, rec))).toBe('');
    for (const sd of ['R', 'L']) {
      const knee = joint(g, 'knee' + sd), hip = joint(g, 'hip' + sd), leg = (o: THREE.Object3D) => o.children.filter((c): c is M => solid(c) && colourOf(c) === '#3a3a40' && c.geometry.attributes.position.count > 500);
      const thigh = leg(hip).pop()!, shin = leg(knee).pop()!; expect(thigh && shin).toBeTruthy();
      // the two halves meet at the knee: each rim point of the shin's top has one of the thigh's end close by
      const rim = (m: M, from: number) => { const out: THREE.Vector3[] = []; const p = m.geometry.attributes.position; for (let i = from; i < from + 28; i++) out.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld)); return out; };
      const a = rim(thigh, 0), b = rim(shin, 22 * 28);
      for (const q of b) expect(Math.min(...a.map((v) => v.distanceTo(q)))).toBeLessThan(0.06);
      // nothing of the leg in the body's own colour, nor of the boot above the ankle, shows outside the cloth
      expect(meshes(g, (m) => solid(m) && colourOf(m) === '#00ff00' && (m.parent === hip || m.parent === knee))).toHaveLength(0);
      const cuffs = knee.children.filter((c): c is M => solid(c) && colourOf(c) !== '#3a3a40');
      expect(under(cuffs, [shin], knee)).toBeGreaterThan(0.01); // the boot's shaft, cuff and strap lie under the trouser leg
      let out = 0; const rc = new THREE.Raycaster(); rc.far = 1;
      const two = shin.clone(); two.material = (shin.material as THREE.Material).clone(); (two.material as THREE.Material).side = THREE.DoubleSide; two.matrixWorld.copy(shin.matrixWorld); two.matrixAutoUpdate = false;
      for (const m of cuffs) eachVertex(m, (w) => { const l = knee.worldToLocal(w.clone()); if (l.y < -1.2) return; l.y = 0; if (l.lengthSq() < 1e-8) return; rc.set(w, l.normalize().transformDirection(knee.matrixWorld)); if (!rc.intersectObject(two, false).length) out++; });
      expect(out).toBe(0);
    }
  }, 300000);

  it('swing with the bust where the figure jiggles', () => {
    heroOptions.jiggle = true;
    try {
      const g = heroFigure({ ...SUIT, ...FRAMES.curvy }), chest = joint(g, 'chest');
      const swung = chest.children.filter((c): c is M => solid(c) && !!c.userData.skin && !!c.geometry.attributes.jig);
      expect(swung.length).toBeGreaterThanOrEqual(8); // the chest itself, the shirt, the waistcoat's and the coat's fronts, the lapels
    } finally { heroOptions.jiggle = false; }
  }, 300000);

  it('are behind their own fields: a plain coat keeps its tails and box lapels, a plain shirt its collar, plain legs their colour', () => {
    const plain: HeroFigure = { frame: 'masculine', coat: { tails: '#3a2a4a', lapel: '#c9a64a' }, shirt: '#e8e2d0', trim: '#00ff00' }, g = heroFigure(plain); g.updateMatrixWorld(true);
    const chest = joint(g, 'chest');
    expect(chest.children.filter((c) => solid(c) && c.geometry.type === 'BoxGeometry' && colourOf(c) === '#c9a64a')).toHaveLength(2);     // the box lapels
    expect(chest.children.filter((c) => solid(c) && c.geometry.type === 'CylinderGeometry' && colourOf(c) === '#e8e2d0')).toHaveLength(1); // the plain collar
    expect(chest.children.filter((c) => solid(c) && !!c.userData.skin)).toHaveLength(4);                                                  // the chest, the belt and its tail only
    const tails = meshes(g, (m) => m.userData.garment === 'tails')[0]; expect(tails.geometry.attributes.position.count).toBe(57 * 17);
    for (const sd of ['R', 'L']) { expect(joint(g, 'hip' + sd).children.filter(solid)).toHaveLength(1); expect(colourOf(joint(g, 'hip' + sd).children.filter(solid)[0])).toBe('#00ff00'); }
  }, 300000);
});

describe('wings', () => {
  const WINGS: HeroFigure = { frame: 'feminine', wings: { color: '#cbb4f2', count: 4, opacity: 0.4 }, wingRim: '#f3eaff', hoverFt: 1 };
  const wingsOf = (g: THREE.Object3D) => joint(g, 'chest').children.filter((c) => c.userData.wing);
  it('are each a membrane and a net of veins with its rim, see-through, narrow at the root and drawn to a point', () => {
    const g = heroFigure(WINGS); g.updateMatrixWorld(true);
    const ws = wingsOf(g); expect(ws).toHaveLength(4);
    for (const w of ws) {
      const parts = w.children as M[]; expect(parts).toHaveLength(2);
      for (const m of parts) { const mt = m.material as THREE.Material; expect(mt.transparent).toBe(true); expect(mt.userData.keepLook).toBe(true); }
      const [web, net] = parts, span = w.userData.span as number, sx = w.userData.wing as number;
      // how wide the wing is across at a share of its length (in its own plane)
      const width = (lo: number, hi: number) => { let a = Infinity, b = -Infinity; const p = web.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const u = p.getX(i) * sx / span; if (u >= lo && u <= hi) { a = Math.min(a, p.getY(i)); b = Math.max(b, p.getY(i)); } } return b - a; };
      expect(width(0, 0.06)).toBeLessThan(0.15 * width(0.6, 0.62)); expect(width(0.96, 0.98)).toBeLessThan(0.25 * width(0.6, 0.62));
      expect(width(0.6, 0.62)).toBeLessThan(0.6 * span);                                  // long and narrow, no disc
      expect(net.geometry.attributes.position.count).toBeGreaterThan(400);               // a net of veins, not a few spokes
      const box = new THREE.Box3().setFromBufferAttribute(web.geometry.attributes.position as THREE.BufferAttribute).expandByScalar(0.03 * span);
      const p = net.geometry.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) expect(box.containsPoint(v.fromBufferAttribute(p, i))).toBe(true);
    }
    // the upper pair is the taller, and rises above the shoulders; the lower pair sweeps down
    const top = (w: THREE.Object3D) => new THREE.Box3().setFromObject(w);
    expect(top(ws[0]).max.y).toBeGreaterThan(top(ws[2]).max.y + 1); expect(top(ws[2]).min.y).toBeLessThan(top(ws[0]).min.y - 0.5);
    expect((ws[0].userData.span as number)).toBeGreaterThan(ws[2].userData.span as number);
  }, 300000);
  it('take a sheen across the membrane only when the recipe gives one', () => {
    const web = (f: HeroFigure) => wingsOf(heroFigure(f))[0].children[0] as M;
    expect(web(WINGS).geometry.attributes.color).toBeUndefined();
    const lit = web({ ...WINGS, wingSheen: ['#f58fe0', '#7fe3ff'] }), c = lit.geometry.attributes.color;
    expect(c.count).toBe(lit.geometry.attributes.position.count); expect((lit.material as THREE.MeshLambertMaterial).vertexColors).toBe(true);
    let lo = 1, hi = 0; for (let i = 0; i < c.count; i++) { lo = Math.min(lo, c.getX(i)); hi = Math.max(hi, c.getX(i)); } expect(hi - lo).toBeGreaterThan(0.1);
  }, 300000);
  it('are no part of the body to the cloth: a coat\'s skirts hang as they do without them', () => {
    const coat: HeroFigure = { frame: 'feminine', coat: { tails: '#3a2a4a' } }, tails = (f: HeroFigure) => { const g = heroFigure(f); g.updateMatrixWorld(true); return new THREE.Box3().setFromObject(meshes(g, (m) => m.userData.garment === 'tails')[0]); };
    const a = tails(coat), b = tails({ ...coat, wings: WINGS.wings });
    expect(b.max.x - b.min.x).toBeCloseTo(a.max.x - a.min.x, 2); expect(b.min.z).toBeCloseTo(a.min.z, 2);
  }, 300000);
  it('lie flat on the floor itself under a body fallen on its back, drawn over the floor, and slope to the floor from one fallen on its front', () => {
    for (const [p, flat] of [['dead', true], ['dead-comic', true], ['dead-prone', false]] as const) {
      const g = heroFigure({ ...WINGS, deadPose: p }, 'small', 'dead'); g.updateMatrixWorld(true);
      for (const w of wingsOf(g)) {
        const b = new THREE.Box3().setFromObject(w); expect(b.min.y, p).toBeGreaterThan(-0.005); if (flat) expect(b.max.y, p).toBeLessThan(0.12); if (p === 'dead-comic') expect(b.max.y, p).toBeLessThan(0.002); // (flung out flat: under an arm lying on the floor, not through it)
        for (const m of w.children as M[]) { const mt = m.material as THREE.Material; expect(mt.polygonOffset, p).toBe(true); expect(mt.polygonOffsetUnits, p).toBeLessThan(0); }
      }
    }
    // (standing, a wing is drawn as it is)
    for (const w of wingsOf(heroFigure(WINGS))) for (const m of w.children as M[]) expect((m.material as THREE.Material).polygonOffset).toBe(false);
  }, 300000);
});
