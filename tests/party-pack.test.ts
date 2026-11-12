// Party packs (core/partyPack.ts) and hero miniatures (kit/heroes.ts): reading the table's party file, writing it into a
// campaign (roster, standing tokens), and building each character's own miniature.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyPartyPack, isUntouchedDefault, sheetOf, validatePartyPack, type PartyContext } from '../app/src/core/partyPack';
import { newCampaign } from '../app/src/state/campaign';
import { AT_EASE, gazeOf, heroFigure, heroOptions, POSES } from '../app/src/kit/heroes';
import { Jiggle } from '../app/src/render/jiggle';
import type { Vec2 } from '../app/src/core/geometry';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const ctx: PartyContext = {
  scenes: new Map([['ch03/E', { location: 'E', levels: [{ id: 'village', onFloor: (p: Vec2) => p[0] >= 0 && p[0] <= 100 && p[1] >= 0 && p[1] <= 100 }] }]]),
  pins: new Map<string, Vec2>([['B', [17.36, 6.68]], ['E', [14.09, 7.63]]]),
};
const pack = (over: Record<string, unknown> = {}) => ({
  schema: 1, kind: 'party',
  characters: [
    { id: 'pc-a', name: 'Aster', color: '#6b3fa0', size: 'small', speedFt: 30, darkvisionFt: 0, portrait: PNG, figure: { wings: { color: '#cbb4f2' }, hoverFt: 1 } },
    { id: 'pc-b', name: 'Bram', color: '#aeb4bf', darkvisionFt: 60, light: { bright: 20, dim: 40 }, figure: { halo: '#f0c860', weapon: 'axe', armor: { kind: 'plate', color: '#26272d' } } },
  ],
  placement: { scene: 'ch03/E', level: 'village', at: { 'pc-a': [12.5, 12.5], 'pc-b': [17.5, 12.5] }, world: { pin: 'E', via: ['B'] }, reveal: ['E'] },
  ...over,
});

describe('validatePartyPack', () => {
  it('reads a good pack and fills in the scene\'s location', () => {
    const { pack: p, problems } = validatePartyPack(pack(), ctx);
    expect(problems).toEqual([]);
    expect(p.characters.map((c) => c.id)).toEqual(['pc-a', 'pc-b']);
    expect(p.placement).toMatchObject({ scene: 'ch03/E', location: 'E', level: 'village', world: { pin: 'E', via: ['B'] } });
  });
  it('refuses what is not a party pack', () => {
    expect(validatePartyPack({ schema: 1, encounters: [] }, ctx).problems[0]).toMatchObject({ level: 'error' });
  });
  it('drops bad characters, warns on bad numbers, portraits and positions', () => {
    const { pack: p, problems } = validatePartyPack(pack({
      characters: [
        { id: 'pc-a', name: 'Aster', color: 'purple' },
        { id: 'pc-c', name: 'Cass', color: '#112233', speedFt: -5, portrait: 'https://example.com/x.png', size: 'colossal' },
        { id: 'pc-c', name: 'Cass again', color: '#112233' },
      ],
      placement: { scene: 'ch03/E', at: { 'pc-c': [500, 12.5], 'pc-z': [1, 1] }, world: { pin: 'Q' } },
    }), ctx);
    expect(p.characters.map((c) => c.id)).toEqual(['pc-c']);
    expect(p.characters[0]).toMatchObject({ size: 'medium' });
    expect(p.characters[0].speedFt).toBeUndefined();
    expect(p.characters[0].portrait).toBeUndefined();
    const text = problems.map((x) => `${x.level} ${x.text}`).join('\n');
    expect(text).toMatch(/error Aster: colour/);
    expect(text).toMatch(/error Character id pc-c is used twice/);
    expect(text).toMatch(/warning Cass: speedFt/);
    expect(text).toMatch(/warning Cass: the portrait/);
    expect(text).toMatch(/warning Placement: pc-c .* off the floor/);
    expect(text).toMatch(/warning Placement: pc-z is not one/);
    expect(text).toMatch(/warning Placement: no world pin Q/);
  });
  it('drops a placement on a map that is not built', () => {
    const { pack: p, problems } = validatePartyPack(pack({ placement: { scene: 'ch99/X', at: {} } }), ctx);
    expect(p.placement).toBeUndefined();
    expect(problems[0].text).toMatch(/not a built map/);
  });
});

describe('applyPartyPack', () => {
  it('replaces the untouched starting sheets, keeps renamed ones, and stands each character on the map', () => {
    const s = newCampaign();
    s.roster[0].name = 'Our fighter'; // renamed: kept
    s.tokens.push({ id: 'pc-E', name: 'Party', location: 'E', level: 'village', pos: [50, 50], size: 'medium', darkvisionFt: 0, color: '#c00', role: 'party' });
    s.tokens.push({ id: 'pc-X', name: 'Party', location: 'X', level: 'f1', pos: [5, 5], size: 'medium', darkvisionFt: 0, color: '#c00', role: 'party' });
    const { pack: p } = validatePartyPack(pack(), ctx);
    const r = applyPartyPack(s, p);
    expect(r).toMatchObject({ added: 2, updated: 0, removedDefaults: 3, placed: 2 });
    expect(s.roster.map((x) => x.name)).toEqual(['Our fighter', 'Aster', 'Bram']);
    expect(s.roster.filter(isUntouchedDefault)).toEqual([]);
    expect(s.tokens.map((t) => [t.id, t.role, t.location])).toEqual([['pc-X', 'party', 'X'], ['pc-E-pc-a', 'pc', 'E'], ['pc-E-pc-b', 'pc', 'E']]);
    expect(s.tokens[2]).toMatchObject({ sheetId: 'pc-b', pos: [17.5, 12.5], darkvisionFt: 60, light: { bright: 20, dim: 40 } });
    expect(s.roster.find((x) => x.id === 'pc-a')).toMatchObject({ size: 'small', portrait: PNG, figure: { hoverFt: 1 } });
  });
  it('applies twice without doubling, and updates sheets by id', () => {
    const s = newCampaign(), { pack: p } = validatePartyPack(pack(), ctx);
    applyPartyPack(s, p);
    p.characters[0].speedFt = 40;
    const r = applyPartyPack(s, p);
    expect(r).toMatchObject({ added: 0, updated: 2, placed: 2 });
    expect(s.tokens.filter((t) => t.role === 'pc')).toHaveLength(2);
    expect(s.roster.find((x) => x.id === 'pc-a')!.speedFt).toBe(40);
  });
  it('will not move people during a fight on that map', () => {
    const s = newCampaign(), { pack: p } = validatePartyPack(pack(), ctx);
    s.encounter = { location: 'E', level: 'village', round: 1, order: [], turn: 0, movedFt: 0, partyPos: [0, 0] };
    expect(applyPartyPack(s, p).refused).toMatch(/fight/);
    expect(s.tokens).toEqual([]);
  });
  it('a character without a position stands beside the first', () => {
    const s = newCampaign(), { pack: p } = validatePartyPack(pack({ placement: { scene: 'ch03/E', at: { 'pc-a': [12.5, 12.5] } } }), ctx);
    applyPartyPack(s, p);
    expect(s.tokens.find((t) => t.sheetId === 'pc-b')!.pos).toEqual([22.5, 12.5]);
  });
  it('sheetOf keeps defaults for what the pack leaves out', () => {
    expect(sheetOf({ id: 'x', name: 'X', color: '#000000' })).toMatchObject({ speedFt: 30, reachFt: 5, rangeFt: 0, initMod: 0, size: 'medium', darkvisionFt: 0, kind: 'pc' });
  });
});

describe('heroFigure', () => {
  const height = (g: THREE.Object3D) => new THREE.Box3().setFromObject(g).max.y;
  it('builds every part without throwing, and the see-through parts keep their look', () => {
    const g = heroFigure({ skin: '#8a5a9e', hair: '#dccbeb', hairStyle: 'curly', hairStreak: '#fff', ears: 'pointed', wings: { color: '#cbb4f2', count: 4 }, halo: '#f0c860',
      crown: { color: '#3a2a1c', flower: '#fff' }, cloak: '#222', hood: true, skirt: '#5e1f3a', underskirt: '#efe3c8', armor: { kind: 'plate', color: '#26272d' }, weapon: 'axe',
      offhand: { kind: 'shield', mark: '#fff' }, wisp: '#8ff0b8', boots: '#6b4428', hoverFt: 1 });
    let glassy = 0; g.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh && (m.material as THREE.Material).userData.keepLook) glassy++; });
    expect(glassy).toBeGreaterThanOrEqual(6); // four wings and the wisp's two parts
  });
  it('a small character stands shorter, a hover lifts them, and height scales', () => {
    const med = height(heroFigure({}, 'medium')), small = height(heroFigure({}, 'small'));
    expect(small).toBeLessThan(med * 0.8);
    expect(height(heroFigure({ hoverFt: 1 }, 'small'))).toBeCloseTo(small + 1, 1);
    expect(height(heroFigure({ height: 1.1 }))).toBeGreaterThan(med * 1.05);
  });
  it('adds the detail parts, each one more mesh, and the sparkles see-through', () => {
    const count = (g: THREE.Object3D) => { let n = 0; g.traverse((c) => { if ((c as THREE.Mesh).isMesh) n++; }); return n; };
    const plain = count(heroFigure({ cloak: '#222', armor: { kind: 'plate', color: '#26272d' } }));
    const rich = heroFigure({ cloak: '#222', armor: { kind: 'plate', color: '#26272d' }, eyes: '#7fb4ff', shirt: '#eee', sleeves: '#111', bracers: '#bbb', pendant: '#c9a8ff', buckle: '#999',
      cloakTrim: '#ccc', satchel: '#3e2c22', coat: { tails: '#3e1846' }, vials: ['#f00', '#0f0'], sparkles: '#d9b8ff', earrings: '#c9a8ff', markings: '#5a2a5a', tattered: true });
    expect(count(rich)).toBeGreaterThan(plain + 40);
    let glassy = 0; rich.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh && (m.material as THREE.Material).userData.keepLook) glassy++; });
    expect(glassy).toBe(16);
  });
  it('takes its battle stance only in initiative: the arms rise and a spell gathers', () => {
    const f = { stance: 'conjure' as const, glow: '#b06ad0', skirt: '#5e1f3a', underskirt: '#efe3c8', gownTrim: '#b08a4a', crown: { color: '#3a2a1c', flower: '#fff' } };
    const armAngles = (g: THREE.Object3D) => { const J = g.userData.joints as Record<string, THREE.Object3D>; return [J.shoulderR, J.shoulderL].map((j) => j.rotation.x); };
    expect(armAngles(heroFigure(f)).length).toBe(2); expect(armAngles(heroFigure(f)).every((x) => x > -0.5)).toBe(true);
    // conjure: the casting hand thrust forward, the book raised in the other (its elbow bent up)
    const b = heroFigure(f, 'medium', true).userData.joints as Record<string, THREE.Object3D>;
    expect(b.shoulderR.rotation.x).toBeLessThan(-1); expect(b.elbowL.rotation.x).toBeLessThan(-0.8);
    const glows = (g: THREE.Object3D) => { let n = 0; g.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh && (m.material as THREE.Material).userData.keepLook) n++; }); return n; };
    expect(glows(heroFigure(f, 'medium', true))).toBe(glows(heroFigure(f)) + 2);
  });
  it('keeps the shield emblem on the shield face, turning with it', () => {
    const g = heroFigure({ offhand: { kind: 'shield', color: '#1f2f66', mark: '#e6e6e6' } });
    let face: THREE.Object3D | undefined; g.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh && m.geometry.type === 'CylinderGeometry' && (m.geometry as THREE.CylinderGeometry).parameters.radiusTop === 1) face = m; });
    const marks = face!.parent!.children.filter((c) => (c as THREE.Mesh).isMesh && (c as THREE.Mesh).geometry.type === 'TorusGeometry' && ((c as THREE.Mesh).geometry as THREE.TorusGeometry).parameters.radius < 0.3);
    expect(marks).toHaveLength(2);
    for (const m of marks) expect(m.position.z).toBeGreaterThan(0.07); // in front of the face (half its thickness), never inside it
  });
  it('is jointed: named joints, knees and elbows that bend, poses by name or by angle', () => {
    const g = heroFigure({ weapon: 'axe', stance: 'two-handed' }, 'medium', true), J = g.userData.joints as Record<string, THREE.Object3D>;
    for (const n of ['hips', 'chest', 'neck', 'head', 'shoulderR', 'elbowL', 'wristR', 'handR', 'handL', 'hipL', 'kneeR', 'ankleL', 'footR', 'beltL', 'back']) expect(J[n], n).toBeDefined();
    expect(J.kneeL.rotation.x).toBeGreaterThan(0.5); expect(J.elbowR.rotation.x).toBeLessThan(-1);
    g.updateMatrixWorld(true);
    let low = Infinity; g.traverse((c) => { if ((c as THREE.Mesh).isMesh) low = Math.min(low, new THREE.Box3().setFromObject(c).min.y); });
    expect(low).toBeGreaterThan(-0.05); // bent knees, feet still on the floor
    const kneel = height(heroFigure({ pose: 'kneel' })), stand = height(heroFigure({}));
    expect(kneel).toBeLessThan(stand * 0.85);
    const ride = heroFigure({ pose: 'ride' }); ride.updateMatrixWorld(true);
    expect((ride.userData.joints.hips as THREE.Object3D).getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(0, 5); // seated: the seat at the origin
    const custom = heroFigure({ pose: { elbowR: -1.5, kneeL: 0.9 } });
    expect(custom.userData.joints.elbowR.rotation.x).toBeCloseTo(-1.5); expect(custom.userData.joints.kneeL.rotation.x).toBeCloseTo(0.9);
  });
  it('lies down dead: laid on the floor in its dead pose, the halo, wisp, sparkles and spell gone', () => {
    const f = { halo: '#f0c860', wisp: '#8ff0b8', sparkles: '#d9b8ff', glow: '#b06ad0', stance: 'cast' as const, hoverFt: 1, wings: { color: '#cbb4f2', count: 2 as const } };
    const alive = heroFigure(f, 'medium', 'battle'), dead = heroFigure(f, 'medium', 'dead');
    const glassy = (g: THREE.Object3D) => { let n = 0; g.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh && (m.material as THREE.Material).userData.keepLook) n++; }); return n; };
    expect(glassy(dead)).toBe(4); expect(glassy(alive)).toBeGreaterThan(20); // only the wings' membranes and rims stay
    const flat = heroFigure({ ...f, wings: undefined }, 'medium', 'dead'); flat.updateMatrixWorld(true); // (wings would prop the body up)
    const j = flat.userData.joints as Record<string, THREE.Object3D>, y = (n: string) => j[n].getWorldPosition(new THREE.Vector3()).y;
    expect(y('head')).toBeLessThan(1.2); expect(y('hips')).toBeLessThan(1.2); expect(y('hips')).toBeGreaterThan(0);
    for (const p of ['dead-prone', 'dead-comic', 'dead-swoon', 'dead-curled'] as const) expect(height(heroFigure({ deadPose: p }, 'medium', 'dead'))).toBeLessThan(height(heroFigure({})) * 0.6);
    expect(height(heroFigure({}, 'medium', true))).toBeGreaterThan(5); // true still means battle
  });
  it('sculpts a feminine and a masculine frame: narrower shoulders and waist, wider hips', () => {
    const x = (g: THREE.Object3D, n: string) => { g.updateMatrixWorld(true); return Math.abs((g.userData.joints as Record<string, THREE.Object3D>)[n].getWorldPosition(new THREE.Vector3()).x); };
    const fem = heroFigure({ frame: 'feminine' }), masc = heroFigure({ frame: 'masculine' });
    expect(x(fem, 'shoulderR')).toBeLessThan(x(masc, 'shoulderR') - 0.1); expect(x(fem, 'hipR')).toBeGreaterThan(x(masc, 'hipR'));
    expect(x(heroFigure({ frame: 'masculine', build: 'broad' }), 'shoulderR')).toBeGreaterThan(x(masc, 'shoulderR'));
    expect(heroFigure({ skirt: '#5e1f3a', underskirt: '#efe3c8' }).userData.joints.collarR).toBeDefined(); // a gown is feminine by default, and every frame has its collar joints
  });
  it('builds nothing for an empty hand', () => {
    expect((heroFigure({}).userData.joints.handR as THREE.Object3D).children).toHaveLength(0);
  });
  it('recolours the gown and the underskirt', () => {
    const colours = new Set<string>(); heroFigure({ skirt: '#5e1f3a', underskirt: '#efe3c8' }).traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh) colours.add('#' + (m.material as THREE.MeshLambertMaterial).color.getHexString()); });
    expect(colours.has('#5e1f3a')).toBe(true); expect(colours.has('#efe3c8')).toBe(true);
  });
  it('fits the body to the character with its own measures', () => {
    const width = (g: THREE.Object3D) => { const b = new THREE.Box3().setFromObject((g.userData.joints as Record<string, THREE.Object3D>).chest); return b.max.x - b.min.x; };
    const plain = heroFigure({ pose: {} }), brawny = heroFigure({ pose: {}, body: { shoulders: 1.15, chest: 1.1, waist: 1.2, arms: 1.3 } }), slight = heroFigure({ pose: {}, body: { shoulders: 0.9, chest: 0.9, waist: 0.9, arms: 0.85 } });
    expect(width(brawny)).toBeGreaterThan(width(plain) * 1.05);
    expect(width(slight)).toBeLessThan(width(plain) * 0.97);
  });
  it('gives soft parts jiggle weights only when the switch is on, and the spring settles', () => {
    const weighted = (g: THREE.Object3D) => { let n = 0; g.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh && m.geometry.attributes.jig) n++; }); return n; };
    expect(weighted(heroFigure({ frame: 'feminine' }))).toBe(0);
    heroOptions.jiggle = true;
    try { expect(weighted(heroFigure({ frame: 'feminine' }))).toBeGreaterThan(0); expect(weighted(heroFigure({ frame: 'masculine' }))).toBe(0); } finally { heroOptions.jiggle = false; }
    const b = { y: 0, v: 4, x: 0, vx: 1 }; let peak = 0, moving = true;
    for (let i = 0; i < 400 && moving; i++) { moving = Jiggle.advance(b, 1 / 60); peak = Math.max(peak, Math.abs(b.y)); }
    expect(peak).toBeGreaterThan(0.1);
    expect(moving).toBe(false);
  });
  it('puts the weapon away out of a fight and draws it in one', () => {
    const j = (g: THREE.Object3D) => g.userData.joints as Record<string, THREE.Object3D>;
    const rest = heroFigure({ weapon: 'axe', stance: 'two-handed' }), fight = heroFigure({ weapon: 'axe', stance: 'two-handed' }, 'medium', 'battle'), kept = heroFigure({ weapon: 'axe', stow: false });
    expect(j(rest).handR.children.length).toBe(0);
    expect(j(rest).stowed.parent).toBe(j(rest).back);
    expect(j(fight).handR.children.length).toBeGreaterThan(0);
    expect(j(kept).handR.children.length).toBeGreaterThan(0);
    const m = heroFigure({ weapon: 'mace' }); expect(j(m).stowed.parent).toBe(j(m).beltR);
  });
  it('stands on both feet in a fighting stance, over the middle of its base, with both hands on a long weapon', () => {
    for (const f of [{ weapon: 'axe' as const, stance: 'two-handed' as const }, { weapon: 'mace' as const, stance: 'shield' as const, offhand: { kind: 'shield' as const } }]) {
      const g = heroFigure(f, 'medium', 'battle'), J = g.userData.joints as Record<string, THREE.Object3D>; g.updateMatrixWorld(true);
      const a = new THREE.Box3().setFromObject(J.footR), b = new THREE.Box3().setFromObject(J.footL);
      expect(Math.abs(a.min.y - b.min.y)).toBeLessThan(0.08);                                  // both soles down
      expect(Math.abs((Math.min(a.min.x, b.min.x) + Math.max(a.max.x, b.max.x)) / 2)).toBeLessThan(0.15); // centred
    }
    const g = heroFigure({ weapon: 'axe', stance: 'two-handed' }, 'medium', 'battle'), J = g.userData.joints as Record<string, THREE.Object3D>; g.updateMatrixWorld(true);
    const grip = J.handR.localToWorld(new THREE.Vector3(0, 1, 0)), other = J.handR.localToWorld(new THREE.Vector3(0, -0.75, 0)), hand = J.handL.getWorldPosition(new THREE.Vector3());
    expect(Math.min(hand.distanceTo(grip), hand.distanceTo(other))).toBeLessThan(0.25);        // the free hand is on the haft
  });
  it('looks somewhere: on the foe in a fight however the head is turned, the pose\'s own gaze when it has one', () => {
    const turned = gazeOf({ spine: [0, 0.4, 0], neck: [0, 0.1, 0] }, true);
    expect(turned[0]).toBeLessThan(-0.5);                                   // body turned one way, the eyes come back the other
    expect(gazeOf(POSES['two-handed'], true)[0]).toBeGreaterThan(0);         // the body is wound away from the foe, the eyes come back
    expect(gazeOf({ gaze: [0.3, -0.2], neck: [0, 1, 0] }, false)).toEqual([0.3, -0.2]);
    expect(gazeOf({ neck: [0, 0.2, 0] }, false)[0]).toBeGreaterThan(0.3);     // at ease the eyes lead the head's turn
    expect(gazeOf({ neck: [0.3, 0, 0] }, false)[1]).toBeGreaterThan(0.2);     // a dipped chin looks up from under the brows
  });
  it('hangs an empty hand at ease with the palm to the thigh and the thumb forward', () => {
    const g = heroFigure({}), J = g.userData.joints as Record<string, THREE.Object3D>; g.updateMatrixWorld(true);
    for (const sd of ['R', 'L']) {
      const w = J[`wrist${sd}`], parts = w.children.filter((c) => (c as THREE.Mesh).isMesh), z = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3()).z;
      const palm = new THREE.Vector3(0, 0, 1).transformDirection(w.matrixWorld), sx = Math.sign(w.getWorldPosition(new THREE.Vector3()).x);
      expect(palm.x * sx, sd).toBeLessThan(-0.6);                       // the palm turned in toward the leg, the knuckles out
      expect(z(parts[9]) - z(parts[7]), sd).toBeGreaterThan(0.05);      // the thumb ahead of the little finger
    }
  });
  it('is right-handed: R and L are the figure\'s own sides, the weapon in its right hand and the shield on its left arm', () => {
    const g = heroFigure({ weapon: 'mace', offhand: { kind: 'shield' } }, 'medium', 'battle'), J = g.userData.joints as Record<string, THREE.Object3D>; g.updateMatrixWorld(true);
    const x = (n: string) => J[n].getWorldPosition(new THREE.Vector3()).x;
    // the figure faces +z, so its own right is at -x
    expect(x('shoulderR')).toBeLessThan(0); expect(x('hipR')).toBeLessThan(0); expect(x('beltR')).toBeLessThan(0); expect(x('shoulderL')).toBeGreaterThan(0);
    expect(J.handR.children.length).toBeGreaterThan(0); expect(J.handL.children.length).toBeGreaterThan(0);
    expect(x('handR')).toBeLessThan(0); expect(x('handL')).toBeGreaterThan(0);
    let up: THREE.Object3D | null = J.handR; while (up && up !== J.shoulderR) up = up.parent; expect(up).toBe(J.shoulderR);
    const holds = (h: THREE.Object3D, test: (m: THREE.Mesh) => boolean) => { let n = 0; h.traverse((c) => { if ((c as THREE.Mesh).isMesh && test(c as THREE.Mesh)) n++; }); return n > 0; };
    expect(holds(J.handR, (m) => (m.geometry as THREE.SphereGeometry).parameters?.radius === 0.26)).toBe(true);      // the mace's head
    expect(holds(J.handL, (m) => (m.geometry as THREE.CylinderGeometry).parameters?.radiusTop === 1)).toBe(true);    // the shield's face
    // a pose's turns follow the sides: the head and the chest turned to the figure's right look toward -x
    const facing = (pose: Parameters<typeof heroFigure>[0]['pose'], n: string) => { const h = heroFigure({ pose }); h.updateMatrixWorld(true); return new THREE.Vector3(0, 0, 1).transformDirection((h.userData.joints as Record<string, THREE.Object3D>)[n].matrixWorld).x; };
    expect(facing({ neck: [0, 0.4, 0] }, 'head')).toBeLessThan(-0.2); expect(facing({ spine: [0, 0.4, 0] }, 'chest')).toBeLessThan(-0.2);
    // at ease on the right leg, the right hip is the higher and the right shoulder the lower
    const e = heroFigure({ pose: { ...AT_EASE[0] } }), K = e.userData.joints as Record<string, THREE.Object3D>; e.updateMatrixWorld(true);
    const y = (n: string) => K[n].getWorldPosition(new THREE.Vector3()).y;
    expect(y('hipR')).toBeGreaterThan(y('hipL')); expect(y('shoulderR')).toBeLessThan(y('shoulderL'));
  });
  it('stands at ease over the foot that takes the weight, the other heel raised', () => {
    const g = heroFigure({ pose: { ...AT_EASE[0] } }), J = g.userData.joints as Record<string, THREE.Object3D>; g.updateMatrixWorld(true);
    const x = (n: string) => J[n].getWorldPosition(new THREE.Vector3()).x, toe = (n: string) => new THREE.Vector3(0, 0, 1).transformDirection(J[n].matrixWorld).y;
    expect(Math.abs(x('neck') - x('ankleR'))).toBeLessThan(Math.abs(x('neck') - x('ankleL')));  // the right knee is the straight one
    expect(Math.abs(x('neck') - (0.85 * x('ankleR') + 0.15 * x('ankleL')))).toBeLessThan(0.08);
    expect(Math.abs(toe('ankleR'))).toBeLessThan(0.05);                // the standing sole flat
    expect(toe('ankleL')).toBeLessThan(-0.12);                         // the free foot on its ball
  });
  it('closes the hand round the weapon, the haft across the palm, and the second hand round a two-handed haft', () => {
    const g = heroFigure({ weapon: 'axe', stance: 'two-handed' }, 'medium', 'battle'), J = g.userData.joints as Record<string, THREE.Object3D>; g.updateMatrixWorld(true);
    const curl = (sd: string) => J[`wrist${sd}`].children.filter((c) => (c as THREE.Mesh).isMesh).slice(1, 9).filter((_, i) => i % 2 === 0).map((k) => k.rotation.x);
    for (const sd of ['R', 'L']) expect(curl(sd).every((a) => a < -1.2), sd).toBe(true);   // every finger folded at the knuckle
    const haft = new THREE.Vector3(0, 1, 0).transformDirection(J.handR.matrixWorld), arm = new THREE.Vector3(0, -1, 0).transformDirection(J.elbowR.matrixWorld);
    expect(haft.angleTo(arm)).toBeGreaterThan(0.9); expect(haft.angleTo(arm)).toBeLessThan(2.35);  // across the hand, never along the forearm
    const palm = J.wristR.children[0] as THREE.Mesh, r = (palm.geometry as THREE.SphereGeometry).parameters.radius;
    expect(J.handR.getWorldPosition(new THREE.Vector3()).distanceTo(palm.getWorldPosition(new THREE.Vector3()))).toBeLessThan(r);  // held in the fist
    // a fist the right way round: the thumb over the fingers from the index side, the weapon's head out of the fist on that side
    const P = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3()), parts = (sd: string) => J[`wrist${sd}`].children.filter((c) => (c as THREE.Mesh).isMesh);
    for (const sd of ['R', 'L']) { const m = parts(sd); expect(P(m[9]).distanceTo(P(m[1])), sd).toBeLessThan(P(m[9]).distanceTo(P(m[7]))); }
    expect(haft.dot(P(parts('R')[1]).sub(P(parts('R')[7])).normalize())).toBeGreaterThan(0.5);
  });
  it('makes a fist of a hand the pose names, and leaves the other open', () => {
    const g = heroFigure({ pose: { fist: ['L'] } }), J = g.userData.joints as Record<string, THREE.Object3D>; g.updateMatrixWorld(true);
    const parts = (sd: string) => J[`wrist${sd}`].children.filter((c) => (c as THREE.Mesh).isMesh), P = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
    expect(parts('L')[1].rotation.x).toBeLessThan(-1.2); expect(parts('R')[1].rotation.x).toBeGreaterThan(-0.8);
    const m = parts('L'); expect(P(m[9]).distanceTo(P(m[1]))).toBeLessThan(P(m[9]).distanceTo(P(m[7])));   // the thumb across from the index side
    // a shield's grip and a shut book's foot are held the same way round
    for (const f of [{ offhand: { kind: 'shield' as const } }, { offhand: { kind: 'book' as const } }]) {
      const h = heroFigure(f), K = h.userData.joints as Record<string, THREE.Object3D>; h.updateMatrixWorld(true);
      const q = K.wristL.children.filter((c) => (c as THREE.Mesh).isMesh); expect(P(q[9]).distanceTo(P(q[1])), f.offhand.kind).toBeLessThan(P(q[9]).distanceTo(P(q[7])));
    }
  });
  it('rides plate pauldrons on the shoulder joint, so they lift with the arm, and rolls a shirt sleeve to the elbow', () => {
    const plate = '#26272d', colour = (m: THREE.Mesh) => '#' + (m.material as THREE.MeshLambertMaterial).color.getHexString();
    const J = heroFigure({ armor: { kind: 'plate', color: plate }, sleeves: '#111111' }).userData.joints as Record<string, THREE.Object3D>; // (the arm itself in another colour)
    for (const sd of ['R', 'L']) {
      let n = 0; J[`shoulder${sd}`].traverse((c) => { const m = c as THREE.Mesh; let up = c.parent; while (up && up !== J[`elbow${sd}`]) up = up.parent; if (m.isMesh && !up && colour(m) === plate) n++; });
      expect(n, sd).toBeGreaterThanOrEqual(2);                          // the cap and its lames, above the elbow
    }
    const forearm = (f: Parameters<typeof heroFigure>[0]) => { const c = new Set<string>(); for (const m of (heroFigure(f).userData.joints.elbowR as THREE.Object3D).children) if ((m as THREE.Mesh).isMesh && (m as THREE.Mesh).geometry.type !== 'SphereGeometry') c.add(colour(m as THREE.Mesh)); return c; }; // (not the elbow's ball)
    const skin = '#c08a62', shirt = '#e8e2d0';
    expect(forearm({ skin, sleeves: shirt, rolled: true }).has(skin)).toBe(true);
    expect(forearm({ skin, sleeves: shirt, rolled: true }).has(shirt)).toBe(true);   // the cuff
    expect(forearm({ skin, sleeves: shirt }).has(skin)).toBe(false);
  });
  it('sets a hand on the hip or the belt for every body, the arm solved to reach it', () => {
    // the nearest body surface (sampled at its vertices) to a point, leaving out the arm on that side
    const gap = (g: THREE.Object3D, sd: string, p: THREE.Vector3) => {
      const J = g.userData.joints as Record<string, THREE.Object3D>, skip = [J[`collar${sd}`], J[`shoulder${sd}`]], v = new THREE.Vector3(); let best = Infinity;
      g.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh || (m.material as THREE.Material).transparent) return; for (let q: THREE.Object3D | null = m; q; q = q.parent) if (skip.includes(q)) return;
        const a = m.geometry.attributes.position; for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld); best = Math.min(best, v.distanceTo(p)); } });
      return best;
    };
    for (const f of [{}, { build: 'broad' as const }, { frame: 'feminine' as const }, { frame: 'feminine' as const, build: 'curvy' as const }, { armor: { kind: 'plate' as const, color: '#333333' } }]) {
      const hip = heroFigure({ ...f, pose: { ...AT_EASE[1] } }), H = hip.userData.joints as Record<string, THREE.Object3D>; hip.updateMatrixWorld(true);
      const fist = H.wristR.children.filter((c) => (c as THREE.Mesh).isMesh).slice(1, 9).filter((_, i) => i % 2 === 0);
      expect(fist.every((k) => k.rotation.x < -1.2), JSON.stringify(f)).toBe(true);                                     // a fist
      expect(Math.min(...fist.map((k) => gap(hip, 'R', k.getWorldPosition(new THREE.Vector3())))), JSON.stringify(f)).toBeLessThan(0.12); // the knuckles on the hip
      expect(H.elbowR.getWorldPosition(new THREE.Vector3()).x).toBeLessThan(H.wristR.getWorldPosition(new THREE.Vector3()).x - 0.3);  // the elbow out to the side
      const belt = heroFigure({ ...f, pose: { ...AT_EASE[2] } }), B = belt.userData.joints as Record<string, THREE.Object3D>; belt.updateMatrixWorld(true);
      const palm = B.wristL.children[0].getWorldPosition(new THREE.Vector3()), n = new THREE.Vector3(0, 0, 1).transformDirection(B.wristL.matrixWorld);
      expect(gap(belt, 'L', palm), JSON.stringify(f)).toBeLessThan(0.12);                                                 // the palm on the belt
      expect(n.dot(B.hips.getWorldPosition(new THREE.Vector3()).setY(palm.y).sub(palm).normalize()), JSON.stringify(f)).toBeGreaterThan(0.4); // turned to the body
    }
    const shield = heroFigure({ offhand: { kind: 'shield' }, pose: { ...AT_EASE[2] } }), S = shield.userData.joints as Record<string, THREE.Object3D>;
    expect(S.handL.children.length).toBeGreaterThan(0);                                                                   // a hand that holds something keeps it
  });
  it('hangs a resting shield plumb from its grip, facing out, and keeps stowed gear and a satchel where they belong', () => {
    for (const pose of AT_EASE) {
      const g = heroFigure({ weapon: 'mace', offhand: { kind: 'shield' }, pose: { ...pose, beltHand: undefined } }), J = g.userData.joints as Record<string, THREE.Object3D>; g.updateMatrixWorld(true);
      const sg = J.handL.children.find((c) => (c as THREE.Group).isGroup)!, n = new THREE.Vector3(0, 0, 1).transformDirection(sg.matrixWorld);
      expect(Math.abs(n.y)).toBeLessThan(0.3); expect(n.x).toBeGreaterThan(0.3);                                         // upright, the face to the left side
      // the stowed mace's head hangs clear of the right thigh
      let head: THREE.Mesh | undefined; J.stowed.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh && (m.geometry as THREE.SphereGeometry).parameters?.radius === 0.26) head = m; });
      const h = head!.getWorldPosition(new THREE.Vector3()), a = J.hipR.getWorldPosition(new THREE.Vector3()), b = J.kneeR.getWorldPosition(new THREE.Vector3());
      const t = Math.max(0, Math.min(1, h.clone().sub(a).dot(b.clone().sub(a)) / b.distanceToSquared(a)));
      expect(h.distanceTo(a.clone().lerp(b, t))).toBeGreaterThan(0.45);
    }
    const g = heroFigure({ satchel: '#5a3a20' }); g.updateMatrixWorld(true);
    const parts: THREE.Mesh[] = []; g.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh && '#' + (m.material as THREE.MeshLambertMaterial).color.getHexString() === '#5a3a20') parts.push(m); });
    const strap = parts.find((m) => m.geometry.type === 'BoxGeometry')!, bag = parts.find((m) => m.geometry.type === 'CapsuleGeometry')!;
    const top = strap.localToWorld(new THREE.Vector3(0, 1.25, 0)), low = strap.localToWorld(new THREE.Vector3(0, -1.25, 0)), at = bag.getWorldPosition(new THREE.Vector3());
    expect(top.x).toBeGreaterThan(0); expect(low.distanceTo(at)).toBeLessThan(0.5);                                       // over the left shoulder, down to the bag on the right hip
  });
  it('gives the second hand on a two-handed haft a real grip, low on the haft and clear of the face', () => {
    for (const f of [{ weapon: 'axe' as const }, { weapon: 'spear' as const, frame: 'feminine' as const }, { weapon: 'staff' as const, build: 'broad' as const }]) {
      const g = heroFigure({ ...f, stance: 'two-handed' }, 'medium', 'battle'), J = g.userData.joints as Record<string, THREE.Object3D>; g.updateMatrixWorld(true);
      const o = J.handR.getWorldPosition(new THREE.Vector3()), d = new THREE.Vector3(0, 1, 0).transformDirection(J.handR.matrixWorld);
      const off = (p: THREE.Vector3) => { const v = p.clone().sub(o); return v.addScaledVector(d, -v.dot(d)).length(); };
      const palm = J.wristL.children[0] as THREE.Mesh, u = (palm.geometry as THREE.SphereGeometry).parameters.radius / 0.105;
      const grip = J.wristL.localToWorld(new THREE.Vector3(0, -0.15 * u, 0.085 * u));
      expect(off(grip), f.weapon).toBeLessThan(0.05);                                                                     // the haft in the curl of the fingers
      expect(off(palm.getWorldPosition(new THREE.Vector3())), f.weapon).toBeGreaterThan(0.1);                             // not through the palm
      expect(grip.clone().sub(o).dot(d), f.weapon).toBeLessThan(0);                                                       // below the weapon hand
      expect(new THREE.Vector3(1, 0, 0).transformDirection(J.wristL.matrixWorld).dot(d), f.weapon).toBeGreaterThan(0.9);  // the thumb and index toward the head
      const chin = J.head.getWorldPosition(new THREE.Vector3()).y;
      for (const sd of ['R', 'L']) expect(J[`wrist${sd}`].getWorldPosition(new THREE.Vector3()).y, `${f.weapon} ${sd}`).toBeLessThan(chin);  // the hands below the face
    }
  });
  it('keeps the fingers outside a shut book whatever the pose does with the hand', () => {
    const g = heroFigure({ offhand: { kind: 'book' }, pose: { shoulderL: [-0.12, -0.25, 0.1], elbowL: -0.75, holdL: { upright: true, tilt: [0, 0.4, 0] } } }), J = g.userData.joints as Record<string, THREE.Object3D>; g.updateMatrixWorld(true);
    const bk = J.handL.children.find((c) => (c as THREE.Group).isGroup)!, boxes: THREE.Box3[] = [];
    for (const c of bk.children) { const m = c as THREE.Mesh; if (m.geometry.type !== 'BoxGeometry') continue; m.geometry.computeBoundingBox(); m.updateMatrix(); boxes.push(m.geometry.boundingBox!.clone().applyMatrix4(m.matrix).expandByScalar(-0.01)); }
    const fingers = J.wristL.children.filter((c) => (c as THREE.Mesh).isMesh).slice(1);
    for (const k of fingers) { const p = bk.worldToLocal(k.getWorldPosition(new THREE.Vector3())); expect(boxes.some((b) => b.containsPoint(p))).toBe(false); }
    expect(Math.abs(new THREE.Vector3(0, 1, 0).transformDirection(bk.matrixWorld).y)).toBeGreaterThan(0.9);              // and the book still stands up
  });
  it('lets a dead hand drop its weapon on the floor beside it, clear of the body', () => {
    for (const [weapon, deadPose] of [['sword', 'dead-prone'], ['mace', 'dead-prone'], ['axe', 'dead'], ['spear', 'dead-curled'], ['sword', 'dead-swoon']] as const) {
      const g = heroFigure({ weapon, deadPose }, 'medium', 'dead'), J = g.userData.joints as Record<string, THREE.Object3D>; g.updateMatrixWorld(true);
      const w = g.getObjectByName('dropped')!, box = new THREE.Box3().setFromObject(w);
      expect(J.handR.children.length, weapon).toBe(0);
      expect(Math.abs(box.min.y), weapon).toBeLessThan(0.02); expect(box.max.y, weapon).toBeLessThan(0.8);               // lying on the floor
      const head = J.head.getWorldPosition(new THREE.Vector3()), segs = ['R', 'L'].map((sd) => [J[`shoulder${sd}`], J[`elbow${sd}`]].map((o) => o.getWorldPosition(new THREE.Vector3())));
      const near = (p: THREE.Vector3, [a, b]: THREE.Vector3[]) => { const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(b.clone().sub(a)) / b.distanceToSquared(a))); return p.distanceTo(a.clone().lerp(b, t)); };
      const lb = new THREE.Box3(); for (const c of w.children) { const m = c as THREE.Mesh; m.geometry.computeBoundingBox(); m.updateMatrix(); lb.union(m.geometry.boundingBox!.clone().applyMatrix4(m.matrix)); }
      for (let y = lb.min.y; y <= lb.max.y; y += 0.25) {
        const p = w.localToWorld(new THREE.Vector3(0, y, 0));
        expect(p.distanceTo(head), `${weapon} ${deadPose}`).toBeGreaterThan(0.5);
        for (const sg of segs) expect(near(p, sg), `${weapon} ${deadPose}`).toBeGreaterThan(0.2);                          // not through an arm
      }
    }
  });
  it('holds an orb out on the palm, clear of the forearm', () => {
    const g = heroFigure({ offhand: { kind: 'orb' } }), J = g.userData.joints as Record<string, THREE.Object3D>; g.updateMatrixWorld(true);
    const orb = J.handL.children.find((c) => (c as THREE.Mesh).isMesh)!.getWorldPosition(new THREE.Vector3()), palm = J.wristL.children[0].getWorldPosition(new THREE.Vector3());
    expect(orb.clone().sub(palm).dot(new THREE.Vector3(0, 0, 1).transformDirection(J.wristL.matrixWorld))).toBeGreaterThan(0.2);
    const a = J.elbowL.getWorldPosition(new THREE.Vector3()), b = J.wristL.getWorldPosition(new THREE.Vector3()), t = Math.max(0, Math.min(1, orb.clone().sub(a).dot(b.clone().sub(a)) / b.distanceToSquared(a)));
    expect(orb.distanceTo(a.clone().lerp(b, t))).toBeGreaterThan(0.35);
  });
  it('keeps both feet on the floor: at ease, and in a fighting pose used out of a fight', () => {
    for (const pose of [...AT_EASE.map((p) => ({ ...p })), 'lunge' as const, 'two-handed' as const, 'shield' as const]) {
      const g = heroFigure({ pose }), J = g.userData.joints as Record<string, THREE.Object3D>; g.updateMatrixWorld(true);
      const y = (n: string) => new THREE.Box3().setFromObject(J[n]).min.y, name = typeof pose === 'string' ? pose : JSON.stringify(pose).slice(0, 40); // (the whole boot: sole and heel)
      expect(Math.max(y('ankleR'), y('ankleL')), name).toBeLessThan(typeof pose === 'string' ? 0.05 : 0.025);
    }
  });
  it('keeps a gown\'s legs inside it in a fight, and clenches only the hands a pose names R or L', () => {
    const g = heroFigure({ skirt: '#5a1830', underskirt: '#f0e0d0', stance: 'conjure' }, 'medium', 'battle'), J = g.userData.joints as Record<string, THREE.Object3D>;
    expect(J.kneeR.rotation.x).toBeLessThanOrEqual(0.081); expect(J.kneeL.rotation.x).toBeLessThanOrEqual(0.401);
    expect(J.hipL.rotation.x).toBeGreaterThanOrEqual(-0.301);
    const f = heroFigure({ pose: { fist: ['r' as 'R'] } }), K = f.userData.joints as Record<string, THREE.Object3D>;
    for (const sd of ['R', 'L']) expect(K[`wrist${sd}`].children.filter((c) => (c as THREE.Mesh).isMesh)[1].rotation.x, sd).toBeGreaterThan(-0.8);
  });
  it('carries a book shut out of a fight, close by the hand, and opens it in one', () => {
    const book = (battle: boolean, pose?: { book: 'open' }) => {
      const g = heroFigure({ offhand: { kind: 'book' }, pose }, 'medium', battle ? 'battle' : undefined), J = g.userData.joints as Record<string, THREE.Object3D>; g.updateMatrixWorld(true);
      const bk = J.handL.children.find((c) => (c as THREE.Group).isGroup)!, box = new THREE.Box3();
      for (const c of bk.children) { const m = c as THREE.Mesh; if (!m.isMesh) continue; m.geometry.computeBoundingBox(); m.updateMatrix(); box.union(m.geometry.boundingBox!.clone().applyMatrix4(m.matrix)); }
      const size = box.getSize(new THREE.Vector3()), at = new THREE.Box3().setFromObject(bk).getCenter(new THREE.Vector3());
      return { size, far: at.distanceTo(J.wristL.children[0].getWorldPosition(new THREE.Vector3())) };
    };
    const shut = book(false), open = book(true), read = book(false, { book: 'open' });
    expect(shut.size.y).toBeGreaterThan(shut.size.x);                 // carried by its foot, standing up
    expect(open.size.x).toBeGreaterThan(open.size.y * 2);             // spread across both hands' worth
    expect(read.size.x).toBeGreaterThan(read.size.y * 2);             // a pose that reads holds it open at rest
    expect(shut.far).toBeLessThan(0.6);
  });
});
