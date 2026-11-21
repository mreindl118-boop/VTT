// An engraved harness over a laced corset (armor.knotwork, armor.corset, armor.emblem), a halo of light and spectral
// wings (kit/heroes.ts), on generic stand-in figures: each part is built, plate that sets none of the options is cut as
// it was, the harness stays as clean as plain plate in every frame it is shown in (each stance, each named pose, each
// at-ease variant, at rest), a fist rested on the hip lies on the girdle and not in it, and the light is see-through,
// stands clear of the body and of a weapon slung on the back, and is gone on a fallen body.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AT_EASE, heroFigure, POSES, type HeroFigure } from '../app/src/kit/heroes';
import { describeClips, findClips } from '../app/src/kit/clipcheck';
import { describePokes, findPokes } from '../app/src/kit/clothcheck';

const PLAIN: HeroFigure = { frame: 'feminine', build: 'broad', armor: { kind: 'plate', color: '#3a3f46', trim: '#9a9ea6' }, gauntlets: '#3a3b42', buckle: '#a9adb6' };
const HARNESS: HeroFigure = { ...PLAIN, armor: { ...PLAIN.armor!, knotwork: '#aab0b8', corset: { color: '#2a211d', belts: '#5c3f2a' }, emblem: 'helm' } };
const meshes = (g: THREE.Object3D) => { const out: THREE.Mesh[] = []; g.updateMatrixWorld(true); g.traverse((o) => { if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh); }); return out; };
const garments = (g: THREE.Object3D) => meshes(g).map((m) => m.userData.garment as string | undefined).filter(Boolean).sort();
const lights = (g: THREE.Object3D) => meshes(g).filter((m) => (m.material as THREE.Material).blending === THREE.AdditiveBlending && !!m.geometry.getAttribute('color'));
const joint = (g: THREE.Object3D, name: string) => g.getObjectByName(name)!;
const colours = (g: THREE.Object3D) => new Set(meshes(g).map((m) => '#' + (m.material as THREE.MeshLambertMaterial).color?.getHexString()));
/** Each vertex of some meshes, in a joint's frame. */
function points(ms: THREE.Mesh[], frame: THREE.Object3D): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (const m of ms) { const pos = m.geometry.getAttribute('position'); for (let i = 0; i < pos.count; i++) out.push(frame.worldToLocal(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld))); }
  return out;
}

describe('an engraved harness over a corset', () => {
  it('hangs a coat skirt in the culet\'s place, and bears its emblem, belts and knotwork', () => {
    const plain = heroFigure(PLAIN, 'medium', 'rest'), harness = heroFigure(HARNESS, 'medium', 'rest');
    expect(garments(plain)).toEqual(['culet', 'tassetL', 'tassetR']);
    expect(garments(harness)).toEqual(['coat', 'tassetL', 'tassetR']);
    const c = colours(harness);
    for (const want of ['#aab0b8', '#2a211d', '#5c3f2a', '#a9adb6']) expect(c.has(want), want).toBe(true);
    expect(colours(plain).has('#2a211d')).toBe(false);
    // the tassets are cut in three lames (a grid of twelve rows, four to a lame) where plain plate has two (five to a lame)
    const rows = (g: THREE.Object3D) => meshes(g).find((m) => m.userData.garment === 'tassetR')!.geometry.getAttribute('position').count / 13;
    expect([rows(plain), rows(harness)]).toEqual([10, 12]);
  });

  it('takes each option on its own', { timeout: 120000 }, () => {
    for (const armor of [{ knotwork: '#aab0b8' }, { corset: { color: '#2a211d' } }, { emblem: 'helm' as const }]) {
      const f: HeroFigure = { ...PLAIN, armor: { ...PLAIN.armor!, ...armor }, weapon: 'sword' };
      for (const st of ['rest', 'battle', 'dead'] as const) {
        const g = heroFigure(f, 'medium', st);
        expect(describeClips(findClips(g, f)), `${Object.keys(armor)} ${st}`).toBe(describeClips(findClips(heroFigure({ ...PLAIN, weapon: 'sword' }, 'medium', st), PLAIN)));
        expect(describePokes(findPokes(g, { plates: true })), `${Object.keys(armor)} ${st}`).toBe('');
      }
    }
  });

  it('stays as clean as plain plate in every stance, pose and at ease, on both frames', () => {
    const bad: string[] = [];
    const check = (label: string, extra: Partial<HeroFigure>, st: 'rest' | 'battle' | 'dead') => {
      for (const frame of ['feminine', 'masculine'] as const) {
        const f = { ...HARNESS, ...extra, frame }, p = { ...PLAIN, ...extra, frame };
        const g = heroFigure(f, 'medium', st), base = heroFigure(p, 'medium', st);
        const clips = describeClips(findClips(g, f)), was = describeClips(findClips(base, p));
        if (clips !== was) bad.push(`${frame} ${label}: clips ${clips || 'none'} (plain plate: ${was || 'none'})`);
        // (a pose that already drives a limb through plain plate's tassets may do so here, no deeper)
        const plain = new Map(findPokes(base, { plates: true }).map((h) => [`${h.part} through ${h.garment}`, h.depth]));
        const worse = findPokes(g, { plates: true }).filter((h) => h.depth > (plain.get(`${h.part} through ${h.garment}`) ?? 0) + 0.02);
        if (worse.length) bad.push(`${frame} ${label}: ${describePokes(worse)} (plain plate: ${[...plain].map(([k, d]) => `${k} ${d.toFixed(2)}ft`).join(', ') || 'none'})`);
      }
    };
    for (const [stance, kit] of Object.entries({ 'two-handed': { weapon: 'axe' }, shield: { weapon: 'mace', offhand: { kind: 'shield' } }, cast: { weapon: 'staff' }, conjure: { offhand: { kind: 'book' } } })) check(`stance ${stance}`, { ...kit, stance } as Partial<HeroFigure>, 'battle');
    for (const p of Object.keys(POSES)) { const dead = p.startsWith('dead'); check(`pose ${p}`, { weapon: 'sword', ...(dead ? { deadPose: p } : { battlePose: p }) } as Partial<HeroFigure>, dead ? 'dead' : 'battle'); }
    AT_EASE.forEach((a, i) => check(`at ease ${i}`, { weapon: 'axe', pose: a }, 'rest'));
    check('at rest', { weapon: 'axe' }, 'rest');
    expect(bad).toEqual([]);
  }, 600000);

  it('rests a fist on the hip on the girdle, not in it and not off it', () => {
    const f: HeroFigure = { ...HARNESS, weapon: 'axe', pose: { shoulderL: [0.87, -0.45, 0.6], elbowL: -1.46, fist: ['L'], hipHand: ['L'] } };
    const g = heroFigure(f, 'medium', 'rest'); g.updateMatrixWorld(true);
    const girdle = meshes(g).filter((m) => { for (let p: THREE.Object3D | null = m; p; p = p.parent) if (/^fauld\d$/.test(p.name)) return !m.userData.garment; return false; });
    expect(girdle.length).toBeGreaterThan(8);
    for (const m of girdle) (m.material as THREE.Material).side = THREE.DoubleSide;
    // each point of the hand, read along the way out from the hips' axis: how deep it lies inside the girdle (the
    // farthest surface outward of it), and how near the girdle lies inward of it
    const hips = joint(g, 'hips'), o = hips.getWorldPosition(new THREE.Vector3()), up = new THREE.Vector3(0, 1, 0).transformDirection(hips.matrixWorld), rc = new THREE.Raycaster();
    let deep = 0, near = Infinity;
    for (const p of points(meshes(joint(g, 'wristL')), g)) {
      const w = g.localToWorld(p.clone()), rel = w.clone().sub(o), out = rel.addScaledVector(up, -rel.dot(up)).normalize();
      rc.far = 0.5; rc.set(w, out); const hit = rc.intersectObjects(girdle, false).pop(); if (hit) deep = Math.max(deep, hit.distance);
      rc.far = 2; rc.set(w, out.clone().negate()); const inw = rc.intersectObjects(girdle, false)[0]; if (inw) near = Math.min(near, inw.distance);
    }
    expect(deep).toBeLessThan(0.012);
    expect(near).toBeLessThan(0.03);
  });
});

describe('the harness\'s finer cut', () => {
  const under = (g: THREE.Object3D, name: string, colour: string) => meshes(joint(g, name)).filter((m) => (m.material as THREE.MeshLambertMaterial).color.getHexString() === colour.slice(1));

  it('laps the girdle\'s three lames with room between, in every state', { timeout: 120000 }, () => {
    for (const st of ['rest', 'battle', 'dead'] as const) {
      const g = heroFigure({ ...HARNESS, weapon: 'axe', pose: { spine: [-0.05, -0.3, 0.18] } }, 'medium', st), foot = joint(g, 'fauld3'), rc = new THREE.Raycaster();
      // (the lames are the girdle's big sheets of leather; read in the frame they are cut in, top one first)
      const lames = under(g, 'fauld3', '#2a211d').filter((m) => !m.userData.garment && m.geometry.getAttribute('position').count > 200 && m.geometry.getAttribute('position').count < 400);
      const top = (m: THREE.Mesh) => Math.max(...points([m], foot).map((p) => p.y));
      lames.sort((a, b) => top(b) - top(a));
      expect(lames.length, st).toBe(3);
      const axis = new THREE.Vector3(0, 1, 0).transformDirection(foot.matrixWorld), o = foot.getWorldPosition(new THREE.Vector3());
      for (let k = 1; k < 3; k++) {
        let tucked = 0;
        for (const p of points([lames[k]], g)) {
          const w = g.localToWorld(p.clone()), rel = w.clone().sub(o), out = rel.addScaledVector(axis, -rel.dot(axis)).normalize();
          rc.far = 0.5; rc.set(w, out); const over = rc.intersectObject(lames[k - 1], false)[0];
          if (over) { tucked++; expect(over.distance, `${st} lame ${k}`).toBeGreaterThan(0.008); }
          rc.set(w, out.clone().negate()); expect(rc.intersectObject(lames[k - 1], false).length, `${st} lame ${k} outside the one above`).toBe(0);
        }
        expect(tucked, `${st} lame ${k}`).toBeGreaterThan(40); // (its top runs up under the rim above, all the way round)
      }
    }
  });

  it('stands a thin plate off the back of each hand, and runs the vambrace up to the elbow', { timeout: 120000 }, () => {
    for (const st of ['rest', 'battle', 'dead'] as const) for (const side of ['L', 'R']) {
      const g = heroFigure({ ...HARNESS, weapon: 'axe' }, 'medium', st), wrist = joint(g, 'wrist' + side), elbow = joint(g, 'elbow' + side);
      const plates = meshes(wrist).filter((m) => (m.parent as THREE.Mesh).isMesh);
      expect(plates.length).toBe(1);
      // (in the palm's own measure the palm is a ball: every point of the plate lies outside it, and near it)
      const palm = plates[0].parent as THREE.Mesh, r = (palm.geometry as THREE.SphereGeometry).parameters.radius, pos = plates[0].geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) { const d = new THREE.Vector3().fromBufferAttribute(pos, i).length() / r; expect(d).toBeGreaterThan(1.02); expect(d).toBeLessThan(1.5); expect(pos.getZ(i)).toBeLessThan(0); }
      const plate = points(under(g, 'elbow' + side, '#3a3f46').filter((m) => !wrist.getObjectById(m.id)), elbow), ys = plate.map((p) => p.y);
      expect(Math.max(...ys)).toBeGreaterThan(0.1 * wrist.position.y); // (to within a tenth of the forearm of the elbow)
      expect(Math.min(...ys)).toBeLessThan(wrist.position.y);            // (and its cuff on past the wrist)
    }
  });

  it('bears its emblem as a thin relief lying on the breastplate', () => {
    const g = heroFigure(HARNESS, 'medium', 'rest'), chest = joint(g, 'chest'), rc = new THREE.Raycaster();
    const relief = meshes(g).filter((m) => m.geometry.type === 'ExtrudeGeometry'), plate = meshes(chest).filter((m) => m.userData.skin);
    expect(relief.length).toBe(3); // the gauntlet, the eye and its pupil
    const back = new THREE.Vector3(0, 0, -1).transformDirection(chest.matrixWorld); rc.far = 0.3;
    for (const p of points(relief, g)) { rc.set(g.localToWorld(p.clone()), back); const hit = rc.intersectObjects(plate, false)[0]; expect(hit && hit.distance).toBeLessThan(0.02); }
  });

  it('plates the boots with sabatons, on an engraved harness only', () => {
    for (const side of ['L', 'R']) {
      expect(under(heroFigure(HARNESS, 'medium', 'rest'), 'ankle' + side, '#3a3f46').length).toBe(2);
      expect(under(heroFigure(PLAIN, 'medium', 'rest'), 'ankle' + side, '#3a3f46').length).toBe(0);
    }
  });

  it('keeps the coat skirt off a weapon slung on the back, and the fallen harness on the floor', { timeout: 120000 }, () => {
    const g = heroFigure({ ...HARNESS, weapon: 'axe' }, 'medium', 'rest'), coat = meshes(g).filter((m) => m.userData.garment === 'coat');
    for (const m of meshes(g.getObjectByName('stowed')!)) {
      m.geometry.computeBoundingBox(); const box = m.geometry.boundingBox!.clone().expandByScalar(0.01);
      for (const p of points(coat, m)) expect(box.containsPoint(p)).toBe(false);
    }
    for (const pose of Object.keys(POSES).filter((p) => p.startsWith('dead'))) {
      const d = heroFigure({ ...HARNESS, weapon: 'axe', deadPose: pose } as HeroFigure, 'medium', 'dead');
      const worn = meshes(d).filter((m) => !m.userData.garment && ['3a3f46', '2a211d', '9a9ea6', 'aab0b8', '5c3f2a'].includes((m.material as THREE.MeshLambertMaterial).color.getHexString()));
      expect(worn.length).toBeGreaterThan(40);
      for (const m of worn) expect(Math.min(...points([m], d).map((p) => p.y)), `${pose} ${m.parent?.name} ${(m.material as THREE.MeshLambertMaterial).color.getHexString()} ${m.geometry.getAttribute('position').count}`).toBeGreaterThan(-0.001);
    }
  });
});

describe('a halo and spectral wings of light', () => {
  const ANGEL: HeroFigure = { ...HARNESS, weapon: 'axe', halo: '#f3d98a', spiritWings: { color: '#ffe7a6' } };

  it('are see-through light with no hard edge, kept as they are on a token, and gone on a fallen body', () => {
    for (const st of ['rest', 'battle'] as const) {
      const ls = lights(heroFigure(ANGEL, 'medium', st));
      expect(ls.length, st).toBe(3); // the halo and a wing to either side
      for (const m of ls) {
        const mt = m.material as THREE.Material;
        expect([mt.transparent, mt.depthWrite, m.userData.keepLook, mt.userData.keepLook]).toEqual([true, false, true, true]);
        // every strip's two edges are dark: its light fades out to them
        const col = m.geometry.getAttribute('color');
        for (let i = 0; i < col.count; i += 3) expect(col.getX(i) + col.getX(i + 2)).toBe(0);
      }
    }
    expect(lights(heroFigure(ANGEL, 'medium', 'dead'))).toEqual([]);
    expect(lights(heroFigure({ ...ANGEL, spiritWings: undefined }, 'medium', 'rest')).length).toBe(1);
    expect(lights(heroFigure({ ...ANGEL, halo: undefined, spiritWings: undefined }, 'medium', 'rest'))).toEqual([]);
  });

  it('spread wider in a fight, and stand clear behind the back and a weapon slung on it', () => {
    const span = (st: 'rest' | 'battle') => {
      const g = heroFigure(ANGEL, 'medium', st), chest = joint(g, 'chest'), wings = lights(g).slice(1);
      const pts = points(wings, chest), slung = g.getObjectByName('stowed');
      const back = Math.min(...points(meshes(chest).filter((m) => m.userData.skin), chest).map((p) => p.z));
      const rear = slung ? Math.min(...points(meshes(slung), chest).map((p) => p.z)) : back;
      return { width: Math.max(...pts.map((p) => Math.abs(p.x))), front: Math.max(...pts.map((p) => p.z)), back, rear, inner: Math.min(...pts.map((p) => Math.abs(p.x))) };
    };
    const rest = span('rest'), battle = span('battle');
    expect(battle.width).toBeGreaterThan(rest.width + 0.3);
    // (the axe is slung across the back at rest: the wings rise between the back and it)
    expect(rest.rear).toBeLessThan(rest.back - 0.2);
    for (const w of [rest, battle]) { expect(w.front).toBeLessThan(w.back - 0.05); expect(w.inner).toBeGreaterThan(0.2); } // (behind the back, either side of the spine)
    // (every lit point of the wings near the axe, seen from behind, lies in front of it)
    const g = heroFigure(ANGEL, 'medium', 'rest'), chest = joint(g, 'chest'), axe = points(meshes(g.getObjectByName('stowed')!), chest);
    for (const m of lights(g).slice(1)) {
      const col = m.geometry.getAttribute('color'), pts = points([m], chest).filter((_, i) => col.getX(i) + col.getY(i) + col.getZ(i) > 0.05);
      expect(pts.length).toBeGreaterThan(100);
      for (const p of pts) for (const q of axe) if (Math.hypot(p.x - q.x, p.y - q.y) < 0.3) expect(p.z - q.z).toBeGreaterThan(0.02);
    }
  });

  it('keep the figure as clean as it is without them', () => {
    for (const st of ['rest', 'battle', 'dead'] as const) {
      const g = heroFigure(ANGEL, 'medium', st);
      expect(describeClips(findClips(g, ANGEL)), st).toBe(describeClips(findClips(heroFigure({ ...HARNESS, weapon: 'axe' }, 'medium', st), HARNESS)));
      expect(describePokes(findPokes(g, { plates: true })), st).toBe('');
    }
  });
});
