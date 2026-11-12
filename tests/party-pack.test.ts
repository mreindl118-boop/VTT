// Party packs (core/partyPack.ts) and hero miniatures (kit/heroes.ts): reading the table's party file, writing it into a
// campaign (roster, standing tokens), and building each character's own miniature.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyPartyPack, isUntouchedDefault, sheetOf, validatePartyPack, type PartyContext } from '../app/src/core/partyPack';
import { newCampaign } from '../app/src/state/campaign';
import { heroFigure } from '../app/src/kit/heroes';
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
    const armAngles = (g: THREE.Object3D) => { const out: number[] = []; g.traverse((c) => { if ((c as THREE.Group).isGroup && Math.abs(Math.abs(c.position.x) - 0.86) < 0.01) out.push(c.rotation.x); }); return out; };
    expect(armAngles(heroFigure(f)).every((x) => x > -0.5)).toBe(true);
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
});
