// A reader's figure on the jointed hero rig (kit/heroes.ts), on generic recipes: the free hand laid under a book held
// open where the pose would bring it into the book; a wisp shaped as a spectral skull on its smoke; sparkles that hang
// clear of the posed body; and the finish of a frock coat (a turned-down collar, the fronts proud of the shirt, skirts
// that flare in folds to a waving hem).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AT_EASE, WRIST, heroFigure, wristTurnOf, type HeroFigure, type HeroPose } from '../app/src/kit/heroes';

type M = THREE.Mesh;
type Joints = Record<string, THREE.Object3D>;
const build = (f: HeroFigure, state: 'rest' | 'battle' | 'dead' = 'rest', size: 'small' | 'medium' = 'medium') => { const g = heroFigure(f, size, state); g.updateMatrixWorld(true); return { g, J: g.userData.joints as Joints }; };
const seeThrough = (m: M) => (m.material as THREE.Material).transparent;
const meshes = (o: THREE.Object3D, keep: (m: M) => boolean = () => true) => { const out: M[] = []; o.traverse((c) => { if ((c as M).isMesh && keep(c as M)) out.push(c as M); }); return out; };
const verts = (m: M) => { const a = m.geometry.attributes.position, out: THREE.Vector3[] = []; for (let i = 0; i < a.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld)); return out; };
const boxesOf = (book: THREE.Object3D) => meshes(book, (m) => m.geometry.type === 'BoxGeometry');
/** Whether a point in the world lies inside a box mesh, `pad` inside its faces. */
const inBox = (b: M, p: THREE.Vector3, pad = 0.004) => { const q = b.worldToLocal(p.clone()), { width, height, depth } = (b.geometry as THREE.BoxGeometry).parameters; return Math.abs(q.x) < width / 2 - pad && Math.abs(q.y) < height / 2 - pad && Math.abs(q.z) < depth / 2 - pad; };
const bookOf = (J: Joints) => J.handL.children.find((c) => (c as THREE.Group).isGroup && boxesOf(c).length >= 4)!;

describe('a book held open out of a fight', () => {
  const READ: HeroPose = { ...AT_EASE[0], book: 'open', shoulderL: [-0.75, -0.3, 0.15], elbowL: -1.2 };
  // (the book held in front and the right arm brought across to it: as posed, its fingers run into the covers)
  const ACROSS: [string, HeroFigure, HeroPose, boolean][] = [
    ['a slight reader', { frame: 'feminine' }, { ...READ, shoulderL: [-0.5, -0.6, 0.3], shoulderR: [-0.4, -0.5, 0.1], elbowR: -1.2 }, true],
    ['a reader, the book low', { frame: 'feminine' }, { ...READ, shoulderL: [-0.3, -0.5, 0.4], elbowL: -1.3, shoulderR: [-0.4, -0.5, 0.1], elbowR: -1.2 }, true],
    ['a broad reader, the book out of reach', { frame: 'masculine' }, { ...READ, shoulderL: [-0.3, -0.5, 0.4], elbowL: -1.3, shoulderR: [-0.5, -0.7, 0.1], elbowR: -1.3 }, false],
  ];
  it('takes the free hand under its cover, flat, where the pose would put that hand into it; or clear of it', () => {
    for (const [name, fr, pose, reach] of ACROSS) {
      const { J } = build({ ...fr, offhand: { kind: 'book' }, pose }), boxes = boxesOf(bookOf(J)), free = build({ ...fr, pose: { ...pose, book: undefined } }).J;
      // the arm was moved, and nothing of the hand or the forearm is in the book
      expect(J.shoulderR.quaternion.angleTo(free.shoulderR.quaternion) + Math.abs(J.elbowR.rotation.x - free.elbowR.rotation.x), name).toBeGreaterThan(0.01);
      for (const m of [...meshes(J.wristR), ...meshes(J.elbowR, (x) => x.parent === J.elbowR)]) for (const p of verts(m)) for (const b of boxes) expect(inBox(b, p, 0), `${name}: the free hand in the book`).toBe(false);
      const w = wristTurnOf(J.wristR.quaternion, -1);
      expect(w.bend, name).toBeGreaterThanOrEqual(-WRIST.flex - 1e-6); expect(w.bend, name).toBeLessThanOrEqual(WRIST.ext + 1e-6); expect(w.dev, name).toBeGreaterThanOrEqual(-WRIST.ulnar - 1e-6); expect(w.dev, name).toBeLessThanOrEqual(WRIST.radial + 1e-6);
      if (!reach) continue;
      // the palm lies under a cover, facing up to it, a wrist's thickness off
      const hand = meshes(J.wristR, (x) => x.parent === J.wristR), palm = hand[0].getWorldPosition(new THREE.Vector3()), n = new THREE.Vector3(0, 0, 1).transformDirection(J.wristR.matrixWorld);
      const hit = new THREE.Raycaster(palm, n).intersectObjects(boxes, false)[0]; expect(hit, `${name}: the palm under the book`).toBeDefined(); expect(hit.distance, name).toBeLessThan(0.2);
    }
  }, 120000);
  it('leaves a free hand that is clear of the book as the pose sets it', () => {
    const { J } = build({ offhand: { kind: 'book' }, pose: READ }), plain = build({ pose: { ...READ, book: undefined } }).J;
    expect(J.shoulderR.quaternion.angleTo(plain.shoulderR.quaternion)).toBeLessThan(1e-6); expect(J.elbowR.rotation.x).toBeCloseTo(plain.elbowR.rotation.x, 6);
  }, 60000);
});

describe('a wisp', () => {
  const CASTER: HeroFigure = { frame: 'feminine', offhand: { kind: 'book' }, wisp: '#8ff0b8', stance: 'cast' };
  const wispOf = (J: Joints) => J.handL.children.filter((c) => (c as THREE.Group).isGroup).pop()!;
  it('shaped as a skull is a see-through skull with dark sockets, nose and teeth on its face, on smoke that rises from the book', () => {
    for (const state of ['rest', 'battle'] as const) {
      const pose = state === 'rest' ? { ...AT_EASE[0], book: 'open' as const, shoulderL: [-0.75, -0.3, 0.15] as [number, number, number], elbowL: -1.2 } : undefined;
      const { g, J } = build({ ...CASTER, wispShape: 'skull', pose }, state), none = build({ ...CASTER, wisp: undefined, pose }, state).g;
      const wisp = wispOf(J), parts = meshes(wisp);
      expect(parts.length, state).toBe(4); for (const m of parts) { expect(seeThrough(m), state).toBe(true); expect((m.material as THREE.Material).userData.keepLook).toBe(true); }
      expect(meshes(g, (m) => !seeThrough(m)).length, state).toBe(meshes(none, (m) => !seeThrough(m)).length);   // nothing solid added
      const [skull, marks, smoke] = parts, box = (m: M) => new THREE.Box3().setFromBufferAttribute(m.geometry.attributes.position as THREE.BufferAttribute);
      // the skull: a round cranium over a narrower jaw (its width low down against its width above the middle)
      const p = skull.geometry.attributes.position, sb = box(skull), width = (lo: number, hi: number) => { let w = 0; for (let i = 0; i < p.count; i++) { const t = (p.getY(i) - sb.min.y) / (sb.max.y - sb.min.y); if (t >= lo && t <= hi) w = Math.max(w, Math.abs(p.getX(i))); } return w; };
      expect(width(0.1, 0.25), state).toBeLessThan(0.85 * width(0.55, 0.8)); expect(sb.max.y - sb.min.y, state).toBeGreaterThan(1.05 * (sb.max.x - sb.min.x));
      // the marks: darker than the skull, on the front of it, two sockets apart above a nose and teeth
      const hsl = (m: M) => (m.material as THREE.MeshLambertMaterial).color.getHSL({ h: 0, s: 0, l: 0 }).l; expect(hsl(marks), state).toBeLessThan(0.6 * hsl(skull));
      const mb = box(marks); expect(mb.min.z, state).toBeGreaterThan(0); expect(mb.max.x - mb.min.x, state).toBeGreaterThan(0.5 * (sb.max.x - sb.min.x)); expect(mb.max.y - mb.min.y, state).toBeGreaterThan(0.4 * (sb.max.y - sb.min.y));
      // the smoke: thin where it leaves the book, down below the skull, and none of the wisp in the book itself
      const smb = box(smoke); expect(smb.min.y, state).toBeLessThan(sb.min.y - (sb.max.y - sb.min.y));
      const boxes = boxesOf(bookOf(J)); for (const m of parts) for (const q of verts(m)) for (const b of boxes) expect(inBox(b, q, 0), `${state}: the wisp in the book`).toBe(false);
      // (its foot stands on the open pages: within a hand's breadth of the book)
      const foot = verts(smoke).reduce((a, b) => (smoke.worldToLocal(a.clone()).y < smoke.worldToLocal(b.clone()).y ? a : b)), near = Math.min(...boxes.map((b) => new THREE.Box3().setFromObject(b).distanceToPoint(foot)));
      expect(near, state).toBeLessThan(0.15);
    }
  }, 120000);
  it('is the plain round ghost without the shape, and gone from a fallen body either way', () => {
    const { J } = build(CASTER, 'battle'), parts = meshes(wispOf(J));
    expect(parts.length).toBe(5); expect(parts.filter(seeThrough).length).toBe(3); expect(parts.filter((m) => m.geometry.type === 'SphereGeometry').length).toBe(3);
    const fallen = build({ ...CASTER, wispShape: 'skull' }, 'dead').g, bare = build({ ...CASTER, wisp: undefined }, 'dead').g;
    expect(meshes(fallen).length).toBe(meshes(bare).length);
  }, 120000);
});

describe('sparkles', () => {
  it('hang clear of the body however it is posed: none in a limb or against one', () => {
    let moved = 0;
    for (const fr of [{ frame: 'feminine' }, { frame: 'masculine', build: 'broad' }] as HeroFigure[]) for (const [state, size, extra] of [['rest', 'medium', {}], ['battle', 'small', { stance: 'cast', hoverFt: 1 }], ['battle', 'medium', { stance: 'two-handed', weapon: 'axe' }], ['battle', 'small', { stance: 'conjure', offhand: { kind: 'book' }, hoverFt: 1 }]] as const) {
      const { g } = build({ ...fr, ...extra, sparkles: '#d9b8ff' } as HeroFigure, state, size), s = size === 'small' ? 0.85 : 1, name = `${fr.frame} ${state} ${size}`;
      const sparks = g.children.filter((c) => (c as M).isMesh && seeThrough(c as M)) as M[]; expect(sparks, name).toHaveLength(16);
      const solid = meshes(g, (m) => !seeThrough(m)).map((m) => ({ box: new THREE.Box3().setFromObject(m), pts: verts(m) }));
      sparks.forEach((sp, i) => {
        const c = sp.position, r = (sp.geometry as THREE.SphereGeometry).parameters.radius;
        for (const m of solid) if (m.box.distanceToPoint(c) < r + 0.02) for (const p of m.pts) expect(p.distanceTo(c), `${name}: sparkle ${i} against the body`).toBeGreaterThan(r + 0.01);
        if (Math.hypot(c.x, c.z) > (1.1 + (i % 3) * 0.35) * s * 0.7 + 0.05) moved++;
      });
    }
    expect(moved).toBeGreaterThan(0); // (some pose here puts a limb where a sparkle would hang)
  }, 300000);
});

describe('sparkles round a winged figure', () => {
  it('hang clear of the wings too, membrane and rim', () => {
    const tri = new THREE.Triangle(), near = new THREE.Vector3(); let moved = 0;
    for (const [state, size, turn] of [['rest', 'small', -0.6], ['rest', 'small', 0.6], ['battle', 'small', 0], ['rest', 'medium', -0.3]] as const) {
      const f: HeroFigure = { frame: 'feminine', wings: { color: '#cbb4f2', count: 4 }, wingRim: '#f0e8ff', hoverFt: 1, sparkles: '#d9b8ff', pose: { pelvis: [0, turn, 0] } }, { g } = build(f, state, size), bare = build({ ...f, wings: undefined }, state, size).g;
      const wings: M[] = []; g.traverse((o) => { if (o.userData.wing) o.traverse((c) => { if ((c as M).isMesh) wings.push(c as M); }); }); expect(wings.length).toBeGreaterThan(4);
      const isSpark = (c: THREE.Object3D) => (c as M).isMesh && (c as M).geometry.type === 'SphereGeometry' && seeThrough(c as M), sparks = g.children.filter(isSpark) as M[], plain = bare.children.filter(isSpark) as M[];
      expect(sparks).toHaveLength(16);
      sparks.forEach((sp, i) => {
        const r = (sp.geometry as THREE.SphereGeometry).parameters.radius; if (sp.position.distanceTo(plain[i].position) > 0.01) moved++;
        for (const m of wings) {
          const p = m.geometry.attributes.position, idx = m.geometry.index, n = (idx ? idx.count : p.count) / 3;
          for (let t = 0; t < n; t++) {
            tri.a.fromBufferAttribute(p, idx ? idx.getX(3 * t) : 3 * t).applyMatrix4(m.matrixWorld); tri.b.fromBufferAttribute(p, idx ? idx.getX(3 * t + 1) : 3 * t + 1).applyMatrix4(m.matrixWorld); tri.c.fromBufferAttribute(p, idx ? idx.getX(3 * t + 2) : 3 * t + 2).applyMatrix4(m.matrixWorld);
            expect(tri.closestPointToPoint(sp.position, near).distanceTo(sp.position), `${state} ${size}: sparkle ${i} against a wing`).toBeGreaterThan(r + 0.01);
          }
        }
      });
    }
    expect(moved).toBeGreaterThan(0); // (some wing here is where a sparkle would hang)
  }, 300000);
});

describe('a frock coat\'s finish', () => {
  const SUIT: HeroFigure = { cloth: '#2f3a4a', sleeves: '#2f3a4a', hem: false, coat: { tails: '#2f3a4a', lapel: '#1c232e' }, coatCut: 'frock', waistcoat: { color: '#7a2a2a' }, shirt: '#e8e2d0', shirtCollar: 'stand', trousers: '#3a3a40', trim: '#5a4a3a' };
  const FRAMES: HeroFigure[] = [{ frame: 'masculine' }, { frame: 'feminine' }, { frame: 'feminine', build: 'curvy' }, { frame: 'feminine', body: { shoulders: 0.95, chest: 0.92, waist: 0.94, hips: 0.86, bust: 0.6 } }];
  const colourOf = (m: M) => '#' + (m.material as THREE.MeshLambertMaterial).color.getHexString();
  it('has a turned-down collar: two faces rolled over at the top, its ends rounded off down to the shoulders', () => {
    for (const fr of FRAMES) {
      const { J } = build({ ...SUIT, ...fr }), dark = meshes(J.chest, (m) => m.parent === J.chest && colourOf(m) === '#1c232e'), top = (m: M) => new THREE.Box3().setFromBufferAttribute(m.geometry.attributes.position as THREE.BufferAttribute).max.y;
      const collar = dark.reduce((a, b) => (top(a) > top(b) ? a : b)), p = collar.geometry.attributes.position, cols = 25, rows = p.count / cols;
      expect(rows).toBe(5); expect((collar.material as THREE.Material).side).toBe(THREE.DoubleSide);
      const at = (r: number, c: number) => new THREE.Vector3().fromBufferAttribute(p, r * cols + c), rad = (v: THREE.Vector3) => Math.hypot(v.x, v.z);
      // at the back: the stand rises inside, the roll is the highest line, the fall comes down outside it
      const mid = 12; expect(at(2, mid).y).toBeGreaterThan(at(1, mid).y); expect(at(1, mid).y).toBeGreaterThan(at(0, mid).y + 0.1); expect(at(4, mid).y).toBeLessThan(at(3, mid).y);
      expect(rad(at(3, mid))).toBeGreaterThan(rad(at(2, mid))); expect(rad(at(2, mid))).toBeGreaterThan(rad(at(1, mid)));
      // each end comes down to one point on the shoulder, and the height falls to it without a step
      for (const end of [0, cols - 1]) for (let r = 0; r < rows; r++) expect(at(r, end).distanceTo(at(4, end))).toBeLessThan(1e-6);
      for (let c = 0; c + 1 <= mid; c++) { expect(at(2, c + 1).y).toBeGreaterThanOrEqual(at(2, c).y - 1e-6); expect(at(2, c + 1).y - at(2, c).y).toBeLessThan(0.15); }
    }
  }, 120000);
  it('keeps its fronts over the shirt: no strip of the shirt shows through them out past the coat\'s edge', () => {
    for (const fr of FRAMES) {
      const { J } = build({ ...SUIT, ...fr }), own = (c: string) => meshes(J.chest, (m) => m.parent === J.chest && colourOf(m) === c);
      const shirt = own('#e8e2d0').reduce((a, b) => (a.geometry.attributes.position.count > b.geometry.attributes.position.count ? a : b)), cols = 17, pts = verts(shirt), rows = pts.length / cols;
      const over = [...own('#2f3a4a'), ...own('#1c232e'), ...own('#7a2a2a')].map((m) => { const c = m.clone(); c.material = (m.material as THREE.Material).clone(); (c.material as THREE.Material).side = THREE.DoubleSide; c.matrixWorld.copy(m.matrixWorld); c.matrixAutoUpdate = false; return c; });
      const rc = new THREE.Raycaster(); rc.far = 0.5;
      const shows = (w: THREE.Vector3) => { const l = J.chest.worldToLocal(w.clone()); l.y = 0; rc.set(w, l.normalize().transformDirection(J.chest.matrixWorld)); return rc.intersectObjects(over, false).length === 0; };
      for (let r = 0; r < rows; r++) for (const dir of [-1, 1]) {
        // (out from the middle of each row: once the shirt has gone under the coat it does not come out again)
        let hidden = false;
        for (let c = 8 + dir; c >= 0 && c < cols; c += dir) { const open = shows(pts[r * cols + c]); if (!open) hidden = true; else expect(hidden, `${fr.frame} ${fr.build ?? ''}: the shirt through the coat, row ${r}`).toBe(false); }
      }
    }
  }, 120000);
  it('hangs its skirts in soft folds: flaring to the hem, the hem waving, the front corners rounded', () => {
    for (const fr of FRAMES) {
      const { g } = build({ ...SUIT, ...fr }), tails = meshes(g, (m) => m.userData.garment === 'tails')[0], pts = verts(tails), cols = 57, rows = pts.length / cols;
      const axis = pts.slice(0, cols).reduce((a, b) => a.add(b), new THREE.Vector3()).divideScalar(cols), rad = (r: number, c: number) => Math.hypot(pts[r * cols + c].x - axis.x, pts[r * cols + c].z - axis.z);
      const row = (r: number) => Array.from({ length: cols - 16 }, (_, k) => rad(r, k + 8)), mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
      const hem = row(rows - 1), seat = row(Math.round(0.55 * (rows - 1)));
      expect(mean(hem)).toBeGreaterThan(1.06 * mean(seat));                                              // the flare
      expect(Math.max(...hem) - Math.min(...hem)).toBeGreaterThan(0.08 * mean(hem));                      // the folds
      const hemY = Array.from({ length: cols - 16 }, (_, k) => pts[(rows - 1) * cols + k + 8].y); expect(Math.max(...hemY) - Math.min(...hemY)).toBeGreaterThan(0.02); // the hem waves
      for (const end of [0, cols - 1]) expect(pts[(rows - 1) * cols + end].y).toBeGreaterThan(pts[(rows - 1) * cols + (end ? cols - 6 : 5)].y + 0.08); // a rounded corner
    }
  }, 120000);
});
