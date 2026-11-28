// An engraved harness over a laced corset (armor.knotwork, armor.corset, armor.emblem), a halo of light and spectral
// wings (kit/heroes.ts), on generic stand-in figures: each part is built, plate that sets none of the options is cut as
// it was, the harness stays as clean as plain plate in every frame it is shown in (each stance, each named pose, each
// at-ease variant, at rest), a fist rested on the hip lies on the girdle and not in it, and the light is see-through,
// faint, never flat to the eye, clear of the body and of a weapon slung on the back, and gone on a fallen body; the halo
// is one ring set on the head. Close up in an easy stance: the coat skirt gives way to a slung weapon in one dent and
// is vented with a clean slit, the knee cops lie on the thighs, the cuffs stand clear of the hands, and the wings stand
// squarer to the figure than the chest.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AT_EASE, giveWay, heroFigure, POSES, type HeroFigure } from '../app/src/kit/heroes';
import { describeClips, findClips } from '../app/src/kit/clipcheck';
import { describePokes, findPokes } from '../app/src/kit/clothcheck';

const PLAIN: HeroFigure = { frame: 'feminine', build: 'broad', armor: { kind: 'plate', color: '#3a3f46', trim: '#9a9ea6' }, gauntlets: '#3a3b42', buckle: '#a9adb6' };
const HARNESS: HeroFigure = { ...PLAIN, armor: { ...PLAIN.armor!, knotwork: '#aab0b8', corset: { color: '#2a211d', belts: '#5c3f2a' }, emblem: 'helm' } };
const meshes = (g: THREE.Object3D) => { const out: THREE.Mesh[] = []; g.updateMatrixWorld(true); g.traverse((o) => { if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh); }); return out; };
const garments = (g: THREE.Object3D) => meshes(g).map((m) => m.userData.garment as string | undefined).filter(Boolean).sort();
/** The meshes of light: they brighten what lies behind them and never darken it, and many of them over one another never burn out to white. */
const lights = (g: THREE.Object3D) => meshes(g).filter((m) => { const mt = m.material as THREE.Material; return mt.blending === THREE.CustomBlending && mt.blendSrc === THREE.OneFactor && mt.blendDst === THREE.OneMinusSrcColorFactor && !!m.geometry.getAttribute('color'); });
const wingsOf = (g: THREE.Object3D) => lights(g).filter((m) => m.name === 'spiritWing');
const a0 = (g: THREE.Object3D) => wingsOf(g)[0];
/** The vertices of a mesh of light that lie on a lit strip (its middle line glows), in a joint's frame. */
function litPoints(m: THREE.Mesh, frame: THREE.Object3D): THREE.Vector3[] {
  const col = m.geometry.getAttribute('color'), lit = (i: number) => { const j = 3 * Math.floor(i / 3) + 1; return col.getX(j) + col.getY(j) + col.getZ(j) > 0.02; };
  return points([m], frame).filter((_, i) => lit(i));
}
/** Whether the segment a-b passes through the triangle t. */
function crosses(a: THREE.Vector3, b: THREE.Vector3, t: THREE.Vector3[]): boolean {
  const d = b.clone().sub(a), e1 = t[1].clone().sub(t[0]), e2 = t[2].clone().sub(t[0]), pv = d.clone().cross(e2), det = e1.dot(pv);
  if (Math.abs(det) < 1e-12) return false;
  const tv = a.clone().sub(t[0]), u = tv.dot(pv) / det, qv = tv.clone().cross(e1), v = d.dot(qv) / det, w = e2.dot(qv) / det;
  return u >= 0 && v >= 0 && u + v <= 1 && w > 0 && w < 1;
}
/** The triangles of a mesh, in the world. */
function triangles(m: THREE.Mesh): THREE.Vector3[][] {
  const pos = m.geometry.getAttribute('position'), idx = m.geometry.index, n = (idx ? idx.count : pos.count) / 3, out: THREE.Vector3[][] = [];
  for (let t = 0; t < n; t++) out.push([0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(pos, idx ? idx.getX(t * 3 + k) : t * 3 + k).applyMatrix4(m.matrixWorld)));
  return out;
}
/** How many triangles of the meshes of light pass through a solid triangle of the figure, or are passed through by one. */
function lightCrossings(g: THREE.Object3D): number {
  const solid = meshes(g).filter((m) => !(m.material as THREE.Material).transparent).map((m) => { const tris = triangles(m).map((t) => ({ t, box: new THREE.Box3().setFromPoints(t) })); return { tris, box: tris.reduce((b, x) => b.union(x.box), new THREE.Box3()) }; });
  let n = 0;
  for (const l of lights(g)) for (const lt of triangles(l)) {
    const lb = new THREE.Box3().setFromPoints(lt);
    for (const sd of solid) if (sd.box.intersectsBox(lb)) for (const { t, box } of sd.tris) if (box.intersectsBox(lb) && [0, 1, 2].some((k) => crosses(lt[k], lt[(k + 1) % 3], t) || crosses(t[k], t[(k + 1) % 3], lt))) n++;
  }
  return n;
}
/** How many pairs of triangles, one of each set of meshes, pass through each other (an edge of either through the other). */
function crossings(as: THREE.Mesh[], bs: THREE.Mesh[]): number {
  const tb = bs.flatMap(triangles).map((t) => ({ t, box: new THREE.Box3().setFromPoints(t) }));
  let n = 0;
  for (const ta of as.flatMap(triangles)) { const ba = new THREE.Box3().setFromPoints(ta); for (const { t, box } of tb) if (box.intersectsBox(ba) && [0, 1, 2].some((k) => crosses(ta[k], ta[(k + 1) % 3], t) || crosses(t[k], t[(k + 1) % 3], ta))) n++; }
  return n;
}
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

describe('the harness in an easy stance, close up', () => {
  // (a hip-shot stance turns the hips under a weapon slung across the back: its haft lies on the coat skirt)
  const SHOT = { pelvis: [0, 0.1, -0.15], spine: [0, -0.3, 0.2], hipR: [-0.15, 0.3, 0.3], kneeR: 0.4 } as HeroFigure['pose'];
  const C = 57, mid = (C - 1) / 2;

  it('lets the coat skirt give way to a two-handed weapon slung on the back, and vents it with a clean slit', { timeout: 240000 }, () => {
    for (const frame of ['feminine', 'masculine'] as const) for (const weapon of ['axe', 'spear', 'sword'] as const) for (const height of [1, 1.1]) {
      const g = heroFigure({ ...HARNESS, frame, weapon, pose: SHOT, height }, 'medium', 'rest'), all = meshes(g), tag = `${frame} ${weapon} ${height}`;
      const coat = all.filter((m) => m.userData.garment === 'coat'), welts = all.filter((m) => m.userData.cloth === 'coat'), slung = meshes(g.getObjectByName('stowed')!);
      expect(coat.length, tag).toBe(1); expect(welts.length, tag).toBeGreaterThan(3); expect(slung.length, tag).toBeGreaterThan(0);
      // no triangle of the weapon passes through one of the coat or of its welts, nor the other way about
      expect(crossings(slung, [...coat, ...welts]), tag).toBe(0);
      const pos = coat[0].geometry.getAttribute('position'), ix = coat[0].geometry.getIndex()!, R = pos.count / C, P = (i: number, j: number) => new THREE.Vector3().fromBufferAttribute(pos, i * C + j);
      // across the back the hem runs level from each column to the next, the vent's two edges too: no torn teeth beside it
      for (let j = mid - 14; j < mid + 14; j++) expect(Math.abs(P(R - 1, j).y - P(R - 1, j + 1).y), `${tag} hem ${j}`).toBeLessThan(0.12);
      // the vent: whole above the middle of the skirt, cut from there to the hem, its two edges close by each other
      const joined = (i: number, j: number) => { const a = i * C + j, b = i * C + j + 1; for (let k = 0; k < ix.count; k += 3) { const t = [ix.getX(k), ix.getX(k + 1), ix.getX(k + 2)]; if (t.includes(a) && t.includes(b)) return true; } return false; };
      for (const j of [mid - 1, mid]) { expect(joined(1, j), tag).toBe(true); expect(joined(R - 2, j), tag).toBe(false); expect(joined(R - 1, j), tag).toBe(false); }
      expect(joined(R - 1, mid - 2), tag).toBe(true); expect(joined(R - 1, mid + 1), tag).toBe(true);
      const slit = P(R - 1, mid - 1).distanceTo(P(R - 1, mid + 1));
      expect(slit, tag).toBeGreaterThan(0.01); expect(slit, tag).toBeLessThan(0.15); // (a slit, not a gap)
    }
  });

  it('cloth gives way to gear in one smooth dent: inward only, eased off about it, and never crossed', () => {
    // a tube of cloth about its axis, and a bar laid slantwise through its wall
    const rows = 24, tube = () => {
      const pts: number[] = [], index: number[] = [];
      for (let i = 0; i < rows; i++) for (let j = 0; j < C; j++) { const a = 2 * Math.PI * j / C; pts.push(Math.sin(a), -i * 0.06, Math.cos(a)); }
      for (let i = 0; i < rows - 1; i++) for (let j = 0; j < C - 1; j++) { const a = i * C + j; index.push(a, a + C, a + 1, a + 1, a + C, a + C + 1); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); geo.setIndex(index);
      return new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
    };
    const cloth = tube(), before = tube(), bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 8), new THREE.MeshBasicMaterial());
    bar.position.set(0.1, -0.7, 0.97); bar.rotation.set(0.12, 0, 0.5);
    for (const m of [cloth, before, bar]) m.updateMatrixWorld(true);
    expect(crossings([bar], [before])).toBeGreaterThan(10);
    const clear = 0.02, reach = 0.3;
    giveWay(cloth, C, bar, clear, reach);
    expect(crossings([bar], [cloth])).toBe(0);
    const pos = cloth.geometry.getAttribute('position'), was = before.geometry.getAttribute('position'), P = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, i: number) => new THREE.Vector3().fromBufferAttribute(a, i);
    const dent = [...Array(pos.count).keys()].map((i) => 1 - Math.hypot(pos.getX(i), pos.getZ(i))), deepest = Math.max(...dent);
    expect(deepest).toBeGreaterThan(0.03); expect(deepest).toBeLessThan(0.3);
    const bt = triangles(bar).map((t) => new THREE.Triangle(t[0], t[1], t[2])), off = (p: THREE.Vector3) => Math.min(...bt.map((t) => t.closestPointToPoint(p, new THREE.Vector3()).distanceTo(p)));
    for (let i = 0; i < pos.count; i++) {
      // straight in toward the axis, never out, never up or down
      expect(dent[i]).toBeGreaterThan(-1e-6); expect(pos.getY(i)).toBeCloseTo(was.getY(i), 6);
      expect(Math.atan2(pos.getX(i), pos.getZ(i))).toBeCloseTo(Math.atan2(was.getX(i), was.getZ(i)), 5);
      // clear of the bar, and left alone far from it
      expect(off(P(pos, i)), `vertex ${i}`).toBeGreaterThan(0.9 * clear);
      if (off(P(was, i)) > 2.5 * reach) expect(dent[i]).toBeLessThan(1e-6);
      // one dent: no vertex stands far from its neighbours along the row or down the column
      const r = Math.floor(i / C), c = i % C;
      if (c < C - 1) expect(Math.abs(dent[i] - dent[i + 1]), `row ${r} col ${c}`).toBeLessThan(0.45 * deepest);
      if (r < rows - 1) expect(Math.abs(dent[i] - dent[i + C]), `row ${r} col ${c}`).toBeLessThan(0.45 * deepest);
    }
    // cloth with no gear near it is left as it was
    const apart = tube(); bar.position.set(3, 0, 3); bar.updateMatrixWorld(true); apart.updateMatrixWorld(true);
    giveWay(apart, C, bar, clear, reach);
    expect([...apart.geometry.getAttribute('position').array]).toEqual([...was.array]);
  });

  it('sets each knee cop on the thigh and each cuff clear of the hand, on both frames, at rest and in a fight', { timeout: 120000 }, () => {
    for (const frame of ['feminine', 'masculine'] as const) for (const st of ['rest', 'battle'] as const) {
      const g = heroFigure({ ...HARNESS, frame, weapon: 'axe' }, 'medium', st), all = meshes(g);
      for (const side of ['L', 'R']) {
        const knee = joint(g, 'knee' + side), hip = joint(g, 'hip' + side), wrist = joint(g, 'wrist' + side), elbow = joint(g, 'elbow' + side), tag = `${frame} ${st} ${side}`;
        // the cop (the shell, its fan, its line and its turned-in top, in a group of their own on the knee) lies on the
        // thigh, not in it
        const cop = all.filter((m) => m.parent !== knee && m.parent?.parent === knee && !m.parent!.name), thigh = hip.children.filter((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh[];
        expect(cop.length, tag).toBe(4); expect(thigh.length, tag).toBeGreaterThan(0);
        expect(crossings(cop, thigh), tag).toBe(0);
        // the hand (not what it holds) never passes through a line of the vambrace or of its cuff
        const held = (m: THREE.Object3D) => { for (let p = m.parent; p; p = p.parent) if (p.name === 'hand' + side || p.name === 'stowed') return true; return false; };
        const hand = meshes(wrist).filter((m) => !held(m)), lines = (elbow.children.filter((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh[]).filter((m) => (m.material as THREE.MeshLambertMaterial).color.getHexString() === '9a9ea6');
        expect(hand.length, tag).toBeGreaterThan(5); expect(lines.length, tag).toBe(3);
        expect(crossings(hand, lines), tag).toBe(0);
      }
    }
  });
});

describe('the harness about the neck, the knees and the boots', () => {
  const COLS = 97, rowsOf = (m: THREE.Mesh) => m.geometry.getAttribute('position').count / COLS;
  const row = (m: THREE.Mesh, r: number, frame: THREE.Object3D) => points([m], frame).slice(r * COLS, (r + 1) * COLS);

  it('closes the gorget onto a collar of plate all round, front and back, clear of the pauldrons in every state', { timeout: 240000 }, () => {
    for (const frame of ['feminine', 'masculine'] as const) for (const st of ['rest', 'battle', 'dead'] as const) {
      const g = heroFigure({ ...HARNESS, frame, weapon: 'axe' }, 'medium', st), chest = joint(g, 'chest'), tag = `${frame} ${st}`;
      const gorget = chest.getObjectByName('gorget') as THREE.Mesh, collar = chest.getObjectByName('gorgetCollar') as THREE.Mesh;
      expect(gorget, tag).toBeTruthy(); expect(collar, tag).toBeTruthy();
      expect(Number.isInteger(rowsOf(gorget)) && Number.isInteger(rowsOf(collar)), tag).toBe(true);
      // no slit between the two anywhere round the neck: the collar starts above the gorget's foot at every angle, and
      // stands just inside it there (the gorget's foot laps over it), so nothing shows between them
      const foot = row(gorget, rowsOf(gorget) - 1, chest), top = row(collar, 0, chest);
      for (let j = 0; j < COLS; j++) { expect(top[j].y, `${tag} ${j}`).toBeGreaterThan(foot[j].y); expect(Math.hypot(top[j].x - foot[j].x, top[j].z - foot[j].z), `${tag} ${j}`).toBeLessThan(0.08); }
      // and it runs all the way round: its foot is lower than the gorget's at the front and at the back
      const low = row(collar, rowsOf(collar) - 1, chest);
      for (const j of [0, (COLS - 1) / 2]) expect(low[j].y, `${tag} ${j}`).toBeLessThan(foot[j].y - 0.05);
      // neither passes through a pauldron, a shoulder piece or an arm
      const shoulders = ['collarL', 'collarR'].flatMap((n) => meshes(joint(g, n)));
      expect(shoulders.length, tag).toBeGreaterThan(6);
      expect(crossings([gorget, collar], shoulders), tag).toBe(0);
    }
    // plain plate keeps its gorget and has no such collar
    const plain = heroFigure({ ...PLAIN, weapon: 'axe' }, 'medium', 'rest');
    expect(plain.getObjectByName('gorget')).toBeUndefined(); expect(plain.getObjectByName('gorgetCollar')).toBeUndefined();
  });

  it('tones the boot-strap buckles to the harness\'s trim on an engraved harness only', () => {
    const fixed = '#a9adb6', toned = (f: HeroFigure) => colours(heroFigure({ ...f, buckle: '#c0a060' }, 'medium', 'rest'));
    expect(toned(PLAIN).has(fixed)).toBe(true);
    expect(toned(HARNESS).has(fixed)).toBe(false);
  });

  it('lets the spectral wings die away toward their roots, behind the shoulders', () => {
    const W: HeroFigure = { ...HARNESS, weapon: 'axe', spiritWings: { color: '#ffe7a6' } };
    for (const st of ['rest', 'battle'] as const) {
      const g = heroFigure(W, 'medium', st), wings = wingsOf(g), pair = wings[0].parent!;
      // (in the frame the pair is borne in, from its root between the shoulder blades: lit only out past the shoulders
      // or above them)
      const lit = wings.flatMap((m) => litPoints(m, pair));
      expect(lit.length, st).toBeGreaterThan(200);
      for (const p of lit) expect(Math.abs(p.x) > 1.3 || p.y > 0.45, `${st} ${p.x.toFixed(2)},${p.y.toFixed(2)}`).toBe(true);
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
      const g = heroFigure(ANGEL, 'medium', st), chest = joint(g, 'chest'), wings = wingsOf(g);
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
    const g = heroFigure(ANGEL, 'medium', 'rest'), chest = joint(g, 'chest');
    g.updateMatrixWorld(true); // (every joint placed before any is read)
    const axe = points(meshes(g.getObjectByName('stowed')!), chest);
    expect(axe.length).toBeGreaterThan(100);
    for (const m of wingsOf(g)) {
      const pts = litPoints(m, chest);
      expect(pts.length).toBeGreaterThan(100);
      for (const p of pts) for (const q of axe) if (Math.hypot(p.x - q.x, p.y - q.y) < 0.3) expect(p.z - q.z).toBeGreaterThan(0.02);
    }
  });

  it('the halo is one ring of thin, faint, broken arcs wide of the head, set on the head and turning with it', () => {
    const g = heroFigure(ANGEL, 'medium', 'rest'), halo = g.getObjectByName('halo') as THREE.Mesh, head = joint(g, 'head');
    expect(halo.parent).toBe(head);
    // the lit middle of every strip, in the halo's own frame: its place and how brightly it glows
    const pos = halo.geometry.getAttribute('position'), col = halo.geometry.getAttribute('color');
    const mids = [...Array(pos.count / 3).keys()].map((i) => ({ p: new THREE.Vector3().fromBufferAttribute(pos, 3 * i + 1), glow: Math.max(col.getX(3 * i + 1), col.getY(3 * i + 1), col.getZ(3 * i + 1)) })).filter((m) => m.glow > 0.02);
    const radii = mids.map((m) => Math.hypot(m.p.x, m.p.y)), zs = mids.map((m) => m.p.z);
    expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(0.08); // (one ring)
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(0.08);    // (its arcs not in one plane: no bar seen edge-on)
    expect(Math.min(...mids.map((m) => m.p.y))).toBeGreaterThan(-0.6 * Math.min(...radii)); // (open below, where the hair falls)
    expect(Math.max(...mids.map((m) => m.glow))).toBeLessThan(0.5);     // (faint: nowhere near white)
    // (wide of the head and the hair: clear of every solid point of them, seen along the halo's axis)
    const skull = points(meshes(head).filter((m) => m !== halo), halo).filter((p) => Math.abs(p.z) < 0.45);
    expect(Math.min(...radii)).toBeGreaterThan(Math.max(...skull.map((p) => Math.hypot(p.x, p.y))) + 0.1);
    // (each arc is a thread, as wide seen across the ring as along its axis)
    const reach = (axis: (p: THREE.Vector3) => number) => { let w = 0; for (let i = 0; i < pos.count; i += 3) if (col.getX(i + 1) > 0.25) w = Math.max(w, Math.abs(axis(new THREE.Vector3().fromBufferAttribute(pos, i)) - axis(new THREE.Vector3().fromBufferAttribute(pos, i + 1)))); return w; };
    expect(reach((p) => p.z)).toBeGreaterThan(0.012); expect(reach((p) => Math.hypot(p.x, p.y))).toBeGreaterThan(0.012);
    // a turn of the head carries it round: the same place on the head, another place in the world
    const turned = heroFigure({ ...ANGEL, pose: { neck: [0, 0.6, 0] } }, 'medium', 'rest'), halo2 = turned.getObjectByName('halo')!;
    g.updateMatrixWorld(true); turned.updateMatrixWorld(true);
    expect(halo2.parent).toBe(joint(turned, 'head'));
    expect(halo2.position.distanceTo(halo.position)).toBeLessThan(1e-6);
    expect(halo2.getWorldPosition(new THREE.Vector3()).distanceTo(halo.getWorldPosition(new THREE.Vector3()))).toBeGreaterThan(0.1);
  });

  it('the wings are alike on both sides, faint, and cupped: neither is one flat plane', () => {
    for (const st of ['rest', 'battle'] as const) {
      // (in the frame they are borne in, at their root between the shoulder blades: the chest's own in a fight)
      const g = heroFigure(ANGEL, 'medium', st), root = joint(g, 'chest'), chest = a0(g).parent!, [a, b] = wingsOf(g), pa = points([a], chest), pb = points([b], chest);
      expect(chest.parent).toBe(root); expect(chest.position.x).toBe(0);
      if (st === 'battle') expect(chest.quaternion.angleTo(new THREE.Quaternion())).toBe(0);
      expect(pa.length).toBe(pb.length);
      for (const [i, p] of pa.entries()) expect(p.distanceTo(new THREE.Vector3(-pb[i].x, pb[i].y, pb[i].z)), st).toBeLessThan(1e-6);
      const col = a.geometry.getAttribute('color');
      for (let i = 0; i < col.count; i++) expect(Math.max(col.getX(i), col.getY(i), col.getZ(i))).toBeLessThan(0.3);
      // (off the plane through its lowest, highest and outermost lit points)
      const lit = litPoints(a, chest), far = (f: (p: THREE.Vector3) => number) => lit.reduce((m, p) => (f(p) > f(m) ? p : m));
      const plane = new THREE.Plane().setFromCoplanarPoints(far((p) => -p.y), far((p) => p.y), far((p) => Math.abs(p.x)));
      expect(Math.max(...lit.map((p) => Math.abs(plane.distanceToPoint(p)))), st).toBeGreaterThan(0.15);
    }
  });

  it('stand squarer to the figure than the chest out of a fight: they undo part of the trunk\'s turn, in any easy stance', () => {
    const rear = (g: THREE.Object3D) => wingsOf(g).map((m) => Math.min(...litPoints(m, g).map((p) => p.z)));
    for (const pose of [undefined, { spine: [0, 0.35, 0.12] }, { pelvis: [0, 0.1, -0.15], spine: [0, -0.3, 0.2] }] as HeroFigure['pose'][]) {
      const g = heroFigure({ ...ANGEL, pose }, 'medium', 'rest'), chest = joint(g, 'chest'), pair = a0(g).parent!, tag = JSON.stringify(pose);
      g.updateMatrixWorld(true);
      const inv = g.getWorldQuaternion(new THREE.Quaternion()).invert(), turn = (o: THREE.Object3D) => inv.clone().multiply(o.getWorldQuaternion(new THREE.Quaternion())).angleTo(new THREE.Quaternion());
      expect(turn(chest), tag).toBeGreaterThan(0.1);
      expect(turn(pair), tag).toBeLessThan(0.75 * turn(chest));
      // (so the one is swept back behind the other less than it would be borne stiffly on the chest)
      const [a, b] = rear(g); pair.quaternion.identity(); const [a1, b1] = rear(g);
      expect(Math.abs(a - b), tag).toBeLessThan(Math.abs(a1 - b1) - 0.2);
    }
    for (const pose of [undefined, { spine: [0, 0.35, 0.12] }] as HeroFigure['pose'][]) expect(lightCrossings(heroFigure({ ...ANGEL, pose }, 'medium', 'rest'))).toBe(0);
    // in a fight they are spread with the chest, as they were
    const f = heroFigure(ANGEL, 'medium', 'battle'); expect(a0(f).parent!.quaternion.angleTo(new THREE.Quaternion())).toBe(0);
  });

  it('pass through nothing solid: not the body, the armour, the hair or a weapon slung on the back', () => {
    for (const st of ['rest', 'battle'] as const) expect(lightCrossings(heroFigure(ANGEL, 'medium', st)), st).toBe(0);
  });

  it('keep the figure as clean as it is without them', () => {
    for (const st of ['rest', 'battle', 'dead'] as const) {
      const g = heroFigure(ANGEL, 'medium', st);
      expect(describeClips(findClips(g, ANGEL)), st).toBe(describeClips(findClips(heroFigure({ ...HARNESS, weapon: 'axe' }, 'medium', st), HARNESS)));
      expect(describePokes(findPokes(g, { plates: true })), st).toBe('');
    }
  });
});
