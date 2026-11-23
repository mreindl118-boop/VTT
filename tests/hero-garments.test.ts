// Garments on the jointed hero figures (kit/heroes.ts, hung by kit/cloth.ts) never let the body show through them:
// kit/clothcheck.ts reads every leg vertex under a gown, a skirt, a tunic's skirt, coat tails or a mail shirt, and
// every arm vertex under a capelet or a cloak, against the cloth, on generic figures in every frame they are shown in:
// each stance, each named pose (battle and dead), each at-ease variant, and at rest; on four of the bestiary's fallen,
// the neck under a capelet's collar and the feet under a tunic's skirt or a mail shirt too; and the plates hung like
// cloth (the culet over the rump, the tassets) under a cloak (over a gown too) or under coat tails, standing and
// fallen. On a fallen body the forearms and hands lying on such cloth (hands folded on the chest, a forearm across the
// body) are read against it too: the cloth lies under them, never through them; and on a plate body fallen face down
// onto its knees, the thighs against its tassets and culet. (Coat tails hung on the plates' own layer went unread and
// stood through by the culet in every frame; a gown's cloak took no notice of the plates and fell through them.) On a
// body fallen face down or on its side a capelet, with its hood and its clasps, keeps off the head with room for the
// hair laid on it after (it lay in the skull, cut where the head came to lie, or fallen through it), but for where what
// it covers lies in that room itself, an upper arm the head has come to rest on, where it lies on the arm, nearer the
// head, or comes off it, its points no nearer the head than 0.04 and its faces between them no nearer than 0.03: never
// in the arm, not even as shallowly as the cloth check lets skin lie past cloth (put out of the head, it was pushed into
// the arm beside it, and once it no longer was, the arm still stood shallowly through it, between its points); and
// where the head has come to rest on a shoulder plate (a pauldron's plates, nested under the shoulder, out of the cloth
// check's reach), it lies on the plate, the plate never through it but under the arm on the floor, read along lines
// from the arm's bone running down as well as up (kept off the head, the capelet was left with the plate standing
// through it beside the neck, where the lines ran down to it well over the floor); where the head rests on no plate,
// the capelet keeps off it there too. Its collar comes down over the neckband, never through it, on any body, standing,
// fighting or fallen, and its hood bends round the head, never folded over sharply (put out of the head point by point,
// its side in the head folded over on itself). A face of cloth drawn to a line or a point is read off the head by its
// edges and corners (read as a triangle it came out as no number, and the cloth round it could not move). On any body
// laid out the hood, pressed flat on the floor (never into it) or kept off the head, is lit as each face of it faces
// (faces pressed over onto the flat of it shared their corners with it and showed dark notches along its rim). The
// room for the hair on a head with long locks lying on it reaches as far as the farthest of them, all round the head.
// On a body fallen on its back the capelet keeps off the head too, though an arm raised over the head draws its
// neckline up beside it (its points came as near as 0.01 to the skin there, its faces as near as 0.001), its hood lying
// flat on the floor under the head; there it falls past the head to the floor, held up beside it by the room for the
// hair only where it would come to rest in it (stopped by that room everywhere, it stood up beside the head).
// On a body standing or fighting the capelet's folded hood rests out of the head with the hair on it, which came down
// into it where it was built to rest: as little way further down the capelet's back as that asks, or, with the head
// bowed far back, giving way to it there, lying on the capelet as it was built to (never hidden under it), never through the
// cloak, never squashed flatter than a third of itself (nor laid out on a body fallen with its head thrown back), and
// no further down than what is worn on the back lets it (a weapon stowed there, spirit wings), never through that.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ConvexHull, type HalfEdge } from 'three/examples/jsm/math/ConvexHull.js';
import { AT_EASE, headRoom, heroFigure, POSES, tuckUnder, type HeroPose } from '../app/src/kit/heroes';
import { frameOf, loftGeometry, ringAt, torsoRings } from '../app/src/kit/anatomy';
import { describePokes, findPokes, type Poke } from '../app/src/kit/clothcheck';

const OUTFITS: Record<string, Record<string, unknown>> = {
  gown: { frame: 'feminine', build: 'curvy', skirt: '#5e1f3a', underskirt: '#efe3c8', gownTrim: '#d8b04a' },
  'gown and cloak': { frame: 'feminine', skirt: '#2e3f6e', underskirt: '#efe3c8', cloak: '#3a2a4a' },
  skirt: { frame: 'feminine', skirt: '#6a4a2a' },
  tunic: { frame: 'masculine' },
  'cloak and capelet': { frame: 'masculine', cloak: '#2a4a8a', cloakTrim: '#dddddd', clasps: '#d8c070', hood: true },
  'cloak over mail': { frame: 'masculine', build: 'broad', cloak: '#4a3a2a', armor: { kind: 'mail', color: '#8a8f96' } },
  'coat with tails': { frame: 'masculine', coat: { tails: '#3a2a4a', lapel: '#c9a64a' } },
  plate: { frame: 'feminine', armor: { kind: 'plate', color: '#3a3f46', trim: '#c9a64a' } },
};
/** The garments each outfit hangs on its figure (so that the checks below are never vacuous). */
const WORN: Record<string, string[]> = { gown: ['gown'], 'gown and cloak': ['gown', 'cloak'], skirt: ['skirt'], tunic: ['hem'], 'cloak and capelet': ['cloak', 'mantle', 'hem'], 'cloak over mail': ['cloak', 'mantle', 'mail'], 'coat with tails': ['tails'], plate: ['culet'] };
const KIT: Record<string, Record<string, unknown>> = { 'two-handed': { weapon: 'axe' }, shield: { weapon: 'mace', offhand: { kind: 'shield' } }, cast: { weapon: 'staff' }, conjure: { offhand: { kind: 'book' } } };

type Frame = { outfit: string; label: string; dead: boolean; fig: THREE.Object3D; pokes: Poke[] };
let frames: Frame[] | undefined;
/** Every outfit in every frame, built and checked once. */
function all(): Frame[] {
  if (frames) return frames;
  frames = [];
  let outfit = '';
  const add = (label: string, rec: Record<string, unknown>, st: 'rest' | 'battle' | 'dead') => {
    const fig = heroFigure(rec as never, 'medium', st);
    frames!.push({ outfit, label, dead: st === 'dead', fig, pokes: findPokes(fig) });
  };
  for (const [name, wear] of Object.entries(OUTFITS)) {
    outfit = name;
    for (const [stance, kit] of Object.entries(KIT)) add(`${name}, stance ${stance}`, { ...wear, ...kit, stance }, 'battle');
    for (const p of Object.keys(POSES)) {
      const dead = p.startsWith('dead');
      add(`${name}, pose ${p}`, { ...wear, weapon: 'sword', ...(dead ? { deadPose: p } : { battlePose: p }) }, dead ? 'dead' : 'battle');
    }
    AT_EASE.forEach((a, i) => add(`${name}, at ease ${i}`, { ...wear, weapon: 'mace', pose: a }, 'rest'));
    add(`${name}, at rest`, { ...wear, weapon: 'mace' }, 'rest');
  }
  return frames;
}
const LEG = /^(thigh|shin|foot)[RL]$/, ARM = /^(upperArm|forearm)[RL]$/, LOWER_ARM = /^(forearm|hand)[RL]$/;
const CLOTH = new Set(['gown', 'skirt', 'hem', 'tails', 'mail']), CAPES = new Set(['mantle', 'cloak']);
const report = (fs: Frame[], keep: (p: Poke) => boolean) => fs.map((f) => ({ f, p: f.pokes.filter(keep) })).filter((x) => x.p.length).map((x) => `${x.f.label}: ${describePokes(x.p)}`);
// Four of the bestiary's fallen, as joint angles (the rig's own dead poses have none of them): on the back with the
// right arm flung out from the shoulder, the cloak spread on the floor round it; laid out on the back with the hands
// folded on the chest; crumpled on the left side, the head bowed and turned toward the shoulder, the right forearm
// across the body; and fallen forward onto the knees, face down and rump up, the feet drawn up under the skirts, the
// knees splayed
const SPRAWL: HeroPose = { lie: 'back', neck: [0.1, 0.7, 0.2], shoulderR: [-0.3, 0, 1.25], elbowR: -0.5, shoulderL: [0.1, 0, 0.7], elbowL: -1.2, hipR: [0.05, 0.3, 0.35], kneeR: 0.5, hipL: [0, 0.2, 0.15], kneeL: 0.1 };
const FOLDED: HeroPose = { lie: 'back', shoulderR: [-0.15, -0.99, 0.12], elbowR: -1.75, wristR: [0, 0.01, 0], shoulderL: [-0.33, -1.1, 0.12], elbowL: -1.85, wristL: [0, 0.01, 0], hipR: [0, 0, 0.03], hipL: [0, 0, 0.03] };
const CRUMPLED: HeroPose = { lie: 'side', spine: [0.35, 0.3, 0.15], neck: [0.3, 0.7, 0.2], shoulderR: [-0.5, 0, 0.2], elbowR: -1.9, wristR: [0.6, 0, 0], shoulderL: [-1.5, 0, 0.6], elbowL: -0.5, wristL: [0.8, 0, 0], hipR: [-0.9, 0, 0.1], kneeR: 1.5, hipL: [-0.45, 0, 0.25], kneeL: 1.0, ankleL: [0.5, 0, 0] };
const KNELT: HeroPose = { lie: 'front', spine: [0.4, 0, 0], neck: [-0.5, 0.6, 0], shoulderR: [0.9, 0, 0.5], elbowR: -0.2, shoulderL: [0.8, 0, 0.6], elbowL: -0.3, hipR: [-1.9, 0, 0.6], kneeR: 1.57, hipL: [-1.77, 0, 0.55], kneeL: 1.57 };
/** The falls on the side and face down, where cloth keeps off the head with the hair on it. */
const FALLS: [string, HeroPose | string][] = [['crumpled on its side', CRUMPLED], ['curled on its side', 'dead-curled'], ['face down', 'dead-prone'], ['fallen forward onto its knees', KNELT]];
/** A body fallen on its back with an arm raised over its head, the hand behind it and the elbow up: on a woman's frame
 *  the capelet's neckline is drawn up beside the head on that side. And the back falls of the presets. */
const RAISED: HeroPose = { lie: 'back', neck: [-0.15, -0.3, 0], shoulderR: [-2.6, 0, 0.5], elbowR: -2.0, shoulderL: [0, 0, 0.4], elbowL: -0.3, hipR: [0, 0, 0.06], hipL: [-0.4, 0, 0.1], kneeL: 0.8 };
const BACK: [string, HeroPose | string][] = [['on its back', 'dead'], ['sprawled on its back', 'dead-comic'], ['swooned on its back', 'dead-swoon'], ['on its back, an arm raised over its head', RAISED]];
/** An outfit on a body laid out in a pose of its own, every garment it wears hung. */
function laid(outfit: string, label: string, deadPose: HeroPose): Frame {
  const fig = heroFigure({ ...OUTFITS[outfit], weapon: 'sword', deadPose } as never, 'medium', 'dead'), names = new Set<string>();
  fig.traverse((o) => { if (o.userData.garment) names.add(String(o.userData.garment)); });
  expect(WORN[outfit].filter((n) => !names.has(n)), `${outfit}, ${label}: not hung`).toEqual([]);
  return { outfit, label: `${outfit}, ${label}`, dead: true, fig, pokes: findPokes(fig) };
}

/** Plate armour under a cloak (or, `over` 'tails', under coat tails and no cloak), in a frame of its own, read for a
 *  plate standing up through what is worn over it. */
const PLATED = { frame: 'masculine', build: 'broad', armor: { kind: 'plate', color: '#3a3f46', trim: '#c9a64a' }, cloak: '#5a1a1a', weapon: 'sword' };
const COATED = { cloak: undefined, coat: { tails: '#3e1846', lapel: '#c9a64a' } };
function plated(label: string, rec: Record<string, unknown>, st: 'rest' | 'battle' | 'dead', over: 'cloak' | 'tails' = 'cloak'): Frame {
  const fig = heroFigure({ ...PLATED, ...(over === 'tails' ? COATED : {}), ...rec } as never, 'medium', st), names = new Set<string>(), outfit = `plate under ${over === 'tails' ? 'coat tails' : 'a cloak'}`;
  fig.traverse((o) => { if (o.userData.garment) names.add(String(o.userData.garment)); });
  expect(['culet', over].filter((n) => !names.has(n)), `${outfit}, ${label}: not hung`).toEqual([]);
  return { outfit, label: `${outfit}, ${label}`, dead: st === 'dead', fig, pokes: findPokes(fig, { plates: true }) };
}

const points = (ms: THREE.Object3D[]) => { const out: THREE.Vector3[] = []; for (const m of ms) { const p = (m as THREE.Mesh).geometry.getAttribute('position'); for (let i = 0; i < p.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld)); } return out; };
const nearest = (q: THREE.Vector3, ps: THREE.Vector3[]) => { let d = Infinity; for (const p of ps) d = Math.min(d, p.distanceTo(q)); return d; };
const trianglesOf = (ms: THREE.Object3D[]) => { const out: THREE.Triangle[] = []; for (const m of ms) { const g = (m as THREE.Mesh).geometry, p = g.getAttribute('position'), ix = g.index, n = ix ? ix.count : p.count, at = (i: number) => new THREE.Vector3().fromBufferAttribute(p, ix ? ix.getX(i) : i).applyMatrix4(m.matrixWorld); for (let t = 0; t + 2 < n; t += 3) out.push(new THREE.Triangle(at(t), at(t + 1), at(t + 2))); } return out; };
/** The widest angle, in degrees, at which two faces of the meshes `ms` meet along an edge (their corners one where they
 *  lie at one place; faces with no area aside). */
function worstFold(ms: THREE.Object3D[]): number {
  const tris = trianglesOf(ms), key = (v: THREE.Vector3) => `${v.x.toFixed(5)},${v.y.toFixed(5)},${v.z.toFixed(5)}`, edges = new Map<string, number[]>(), na = new THREE.Vector3(), nb = new THREE.Vector3();
  tris.forEach((t, i) => { if (t.getArea() < 1e-12) return; const ks = [key(t.a), key(t.b), key(t.c)]; for (let e = 0; e < 3; e++) { const [u, v] = [ks[e], ks[(e + 1) % 3]], k = u < v ? `${u}|${v}` : `${v}|${u}`; edges.set(k, [...(edges.get(k) ?? []), i]); } });
  let worst = 0; for (const [, f] of edges) if (f.length === 2) { tris[f[0]].getNormal(na); tris[f[1]].getNormal(nb); worst = Math.max(worst, Math.acos(Math.max(-1, Math.min(1, na.dot(nb)))) * 180 / Math.PI); }
  return worst;
}
/** The least distance from the points `H` to any face of the meshes `ms` (but faces with no area). */
function facesOff(ms: THREE.Object3D[], H: THREE.Vector3[]): number {
  const box = new THREE.Box3().setFromPoints(H), tb = new THREE.Box3(), cp = new THREE.Vector3(); let least = Infinity;
  for (const t of trianglesOf(ms)) {
    if (t.getArea() < 1e-12) continue;
    tb.setFromPoints([t.a, t.b, t.c]).expandByScalar(0.06); if (!tb.intersectsBox(box)) continue;
    for (const q of H) if (tb.containsPoint(q)) { t.closestPointToPoint(q, cp); least = Math.min(least, cp.distanceTo(q)); }
  }
  return least;
}
/** Where and how deep the meshes `a` and `b` run through each other: for each edge of a face of one through a face of
 *  the other, where it crosses, and the nearer of its two ends to the plane of the face it runs through (faces with no
 *  area aside). */
function throughDepths(a: THREE.Object3D[], b: THREE.Object3D[]): { d: number; p: THREE.Vector3 }[] {
  const A = trianglesOf(a).filter((t) => t.getArea() > 1e-12), B = trianglesOf(b).filter((t) => t.getArea() > 1e-12), out: { d: number; p: THREE.Vector3 }[] = [];
  const ray = new THREE.Ray(), hit = new THREE.Vector3(), pl = new THREE.Plane(), dir = new THREE.Vector3(), CELL = 0.05;
  const cells = (lo: THREE.Vector3, hi: THREE.Vector3) => { const ks: string[] = []; for (let x = Math.floor(lo.x / CELL); x <= Math.floor(hi.x / CELL); x++) for (let y = Math.floor(lo.y / CELL); y <= Math.floor(hi.y / CELL); y++) for (let z = Math.floor(lo.z / CELL); z <= Math.floor(hi.z / CELL); z++) ks.push(`${x},${y},${z}`); return ks; };
  const pierce = (E: THREE.Triangle[], F: THREE.Triangle[]) => {
    const grid = new Map<string, number[]>(), box = new THREE.Box3();
    F.forEach((t, i) => { box.setFromPoints([t.a, t.b, t.c]); for (const k of cells(box.min, box.max)) grid.set(k, [...(grid.get(k) ?? []), i]); });
    for (const e of E) for (const [u, v] of [[e.a, e.b], [e.b, e.c], [e.c, e.a]]) {
      const len = u.distanceTo(v); if (len < 1e-9) continue;
      box.setFromPoints([u, v]); ray.set(u, dir.subVectors(v, u).normalize());
      const seen = new Set<number>();
      for (const k of cells(box.min, box.max)) for (const i of grid.get(k) ?? []) {
        if (seen.has(i)) continue; seen.add(i);
        if (ray.intersectTriangle(F[i].a, F[i].b, F[i].c, false, hit) && hit.distanceTo(u) < len) { F[i].getPlane(pl); out.push({ d: Math.min(Math.abs(pl.distanceToPoint(u)), Math.abs(pl.distanceToPoint(v))), p: hit.clone() }); }
      }
    }
  };
  pierce(A, B); pierce(B, A);
  return out;
}
/** A figure in a capelet fallen as given (its skin a colour of its own): the points of its head's own skin (the skull, the
 *  ears and the nose: what under the head is the skin's colour), the capelet (with its hood and its clasps), the points
 *  of what it covers (the upper arms, all that hangs from the shoulders down to the elbows, and the chest's skin), and
 *  for each upper arm its bone and what hangs from its shoulder (`all`) and of that what is nested deeper than the
 *  shoulder's own children (`pieces`, a pauldron's plates). */
function fallenCape(rec: Record<string, unknown>) {
  const skin = '#c8a07a', col = new THREE.Color(skin), fig = heroFigure({ ...rec, skin } as never, 'medium', 'dead');
  fig.updateMatrixWorld(true);
  const flesh = (o: THREE.Object3D) => (o as THREE.Mesh).isMesh && !o.userData.garment && !o.userData.cloth;
  const head: THREE.Object3D[] = [], cape: THREE.Object3D[] = [];
  fig.getObjectByName('head')!.traverse((o) => { if ((o as THREE.Mesh).isMesh && ((o as THREE.Mesh).material as THREE.MeshStandardMaterial).color?.equals(col)) head.push(o); });
  fig.traverse((o) => { if ((o as THREE.Mesh).isMesh && (o.userData.garment === 'mantle' || o.userData.cloth === 'mantle')) cape.push(o); });
  const gear = (['R', 'L'] as const).map((sd) => {
    const all: THREE.Object3D[] = [], pieces: THREE.Object3D[] = [], top = fig.getObjectByName('shoulder' + sd)!;
    const go = (o: THREE.Object3D) => { if (o.name === 'elbow' + sd) return; if (flesh(o)) { all.push(o); if (o.parent !== top) pieces.push(o); } for (const c of o.children) go(c); };
    go(top);
    return { bone: ['shoulder', 'elbow', 'wrist'].map((n) => fig.getObjectByName(n + sd)!.getWorldPosition(new THREE.Vector3())), all, pieces };
  });
  const H = points(head), covered = points([...gear.flatMap((g) => g.all), ...fig.getObjectByName('chest')!.children.filter((o) => flesh(o) && o.userData.skin)]);
  expect(H.length).toBeGreaterThan(500); expect(cape.length).toBeGreaterThan(2); expect(covered.length).toBeGreaterThan(500); // (the skull found; the capelet, the hood and the rest of it hung)
  return { fig, H, cape, covered, gear };
}
/** How thin the points `ps` lie: the least of their widths along any way through them, read exactly from their hull, as
 *  that least width lies square to one of the hull's faces or square to two of its edges at once. (Read along 400
 *  directions round a ball alone, a hood thinnest along a way between them was read up to some 16% thicker than it is.) */
const leastWidth = (ps: THREE.Vector3[]) => {
  const hull = new ConvexHull().setFromPoints(ps), on = new Set<THREE.Vector3>(), vs: THREE.Vector3[] = [], seen = new Set<HalfEdge>(), edges: THREE.Vector3[] = [];
  for (const f of hull.faces) {
    let e = f.edge;
    do {
      const p = e.head().point; if (!on.has(p)) { on.add(p); vs.push(p); }
      if (!seen.has(e.twin)) { seen.add(e); edges.push(new THREE.Vector3().subVectors(p, e.tail().point)); }
      e = e.next;
    } while (e !== f.edge);
  }
  // (the width along the way `d`, kept where it is the least yet: read no further once it is no less)
  let least = Infinity;
  const along = (d: THREE.Vector3) => { let lo = Infinity, hi = -Infinity; for (const q of vs) { const v = q.dot(d); if (v < lo) lo = v; if (v > hi) hi = v; if (hi - lo >= least) return; } least = hi - lo; };
  for (const f of hull.faces) if (f.normal.lengthSq() > 0.5) along(f.normal);
  const d = new THREE.Vector3();
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    const l = d.crossVectors(edges[i], edges[j]).length(); if (l > 1e-9 * edges[i].length() * edges[j].length()) along(d.divideScalar(l));
  }
  expect(least, 'how thin the points lie, read from their hull').toBeLessThan(Infinity);
  return least;
};
/** How much of the hood `hoods` shows on the figure `fig`: of the area of its faces, the share whose middles can be seen,
 *  facing that way, along rays run out from them past every other opaque mesh of the figure but its hair where that is
 *  marked as hair (it may hang over the hood; hair not marked so is counted as hiding it), from some way round the back
 *  of the trunk it hangs from (`frame`), from a third of the way up to straight above it: as a miniature on the table is
 *  seen. */
function shown(fig: THREE.Object3D, hoods: THREE.Object3D[], frame: THREE.Object3D, s: number) {
  const toUp = frame.matrixWorld.clone().invert(), inUp = (t: THREE.Triangle) => new THREE.Triangle(t.a.applyMatrix4(toUp), t.b.applyMatrix4(toUp), t.c.applyMatrix4(toUp));
  const H = trianglesOf(hoods).map(inUp).filter((t) => t.getArea() > 1e-12), others: THREE.Object3D[] = [];
  fig.traverse((m) => { if ((m as THREE.Mesh).isMesh && m.visible && !m.userData.hood && !m.userData.hair && !m.userData.braid && !m.userData.coil && !((m as THREE.Mesh).material as THREE.Material).transparent) others.push(m); });
  const c = new THREE.Box3().setFromPoints(H.flatMap((t) => [t.a, t.b, t.c])).getCenter(new THREE.Vector3()), reach = new THREE.Box3().setFromCenterAndSize(c, new THREE.Vector3(3 * s, 3 * s, 3 * s));
  const O = trianglesOf(others).map(inUp).filter((t) => t.getArea() > 1e-12 && reach.intersectsTriangle(t));
  // (the faces in the way binned by where they lie seen from each way, so each ray is tried only against those in its bin)
  const G = 48, half = 1.5 * s, seen = new Array(H.length).fill(false), d = new THREE.Vector3(), u = new THREE.Vector3(), v = new THREE.Vector3(), q = new THREE.Vector3(), nf = new THREE.Vector3(), m = new THREE.Vector3(), hit = new THREE.Vector3(), ray = new THREE.Ray();
  const bin = (p: THREE.Vector3) => { q.subVectors(p, c); return [Math.floor((q.dot(u) / half * 0.5 + 0.5) * G), Math.floor((q.dot(v) / half * 0.5 + 0.5) * G)]; };
  for (const el of [Math.PI / 6, Math.PI / 3, Math.PI / 2]) for (const az of el === Math.PI / 2 ? [0] : [-Math.PI / 3, -Math.PI / 6, 0, Math.PI / 6, Math.PI / 3]) {
    d.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)); u.crossVectors(Math.abs(d.y) < 0.95 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, -1), d).normalize(); v.crossVectors(d, u);
    const bins = new Map<number, number[]>();
    O.forEach((t, i) => {
      const [ax, ay] = bin(t.a), [bx, by] = bin(t.b), [cx, cy] = bin(t.c);
      for (let y = Math.max(0, Math.min(ay, by, cy)); y <= Math.min(G - 1, Math.max(ay, by, cy)); y++) for (let x = Math.max(0, Math.min(ax, bx, cx)); x <= Math.min(G - 1, Math.max(ax, bx, cx)); x++) { const k = y * G + x, l = bins.get(k); if (l) l.push(i); else bins.set(k, [i]); }
    });
    H.forEach((t, i) => {
      if (seen[i] || t.getNormal(nf).dot(d) <= 0.05) return;
      t.getMidpoint(m); const [x, y] = bin(m); ray.set(m, d);
      for (const j of bins.get(y * G + x) ?? []) if (ray.intersectTriangle(O[j].a, O[j].b, O[j].c, false, hit) && hit.distanceTo(m) > 1e-6 * s) return;
      seen[i] = true;
    });
  }
  let all = 0, some = 0; H.forEach((t, i) => { all += t.getArea(); if (seen[i]) some += t.getArea(); });
  return some / all;
}
/** A figure in a capelet with its hood folded (its skin a colour of its own), standing or fighting as given, and how the
 *  hood rests on it, in the figure's size: how deep in the head's room the deepest point of it lies (`deep`, below nought
 *  out of that room); its middle, the middle of the box round its points in the frame of the trunk it hangs from: how far
 *  to the side of the middle of the back (`side`), how far out from the capelet's face nearest it (`out`, along that
 *  face's normal turned away from the trunk); how much of it shows (`shown`, as the share `shown` gives); how near its
 *  points come to the capelet's faces (`touch`), how
 *  high its lowest point lies over the capelet's hem at the middle of the back (`hem`), how thin it lies (`width`), the
 *  widest angle its faces meet at (`fold`), and how many edges of the one cross faces of the other between it and the
 *  cloak under the capelet (`cloakX`) and between it and what is worn on the back (`wornX`: gear stowed or slung there,
 *  wings; `worn`, how many meshes of that there are). */
function standingHood(rec: Record<string, unknown>, st: 'rest' | 'battle') {
  const skin = '#c8a07a', fig = heroFigure({ ...OUTFITS['cloak and capelet'], ...rec, skin } as never, 'medium', st); fig.updateMatrixWorld(true);
  const s = fig.getObjectByName('neck')!.position.y / 2.24, room = headRoom(fig.getObjectByName('head')!, skin, s)!;
  const hoods: THREE.Object3D[] = [], cape: THREE.Object3D[] = [], cloak: THREE.Object3D[] = [], worn: THREE.Object3D[] = [];
  const within = (m: THREE.Object3D, f: (p: THREE.Object3D) => boolean) => { for (let p: THREE.Object3D | null = m; p; p = p.parent) if (f(p)) return true; return false; };
  fig.traverse((m) => {
    if (!(m as THREE.Mesh).isMesh || !m.visible) return;
    if (m.userData.hood) hoods.push(m);
    else if (within(m, (p) => p.name === 'back' || p.name === 'spiritWings' || !!p.userData.wing)) worn.push(m);
    else if (m.userData.garment === 'mantle') cape.push(m);
    else if (m.userData.garment === 'cloak') cloak.push(m);
  });
  expect(room).toBeTruthy(); expect(hoods.length).toBe(1); expect(cape.length).toBe(1); expect(cloak.length).toBeGreaterThan(0);
  const H = points(hoods), o = new THREE.Vector3(); let deep = -Infinity; for (const q of H) deep = Math.max(deep, room.depth(q, o));
  const toUp = hoods[0].parent!.matrixWorld.clone().invert(), Hu = H.map((q) => q.clone().applyMatrix4(toUp)), c = new THREE.Box3().setFromPoints(Hu).getCenter(new THREE.Vector3());
  const T = trianglesOf(cape).filter((t) => t.getArea() > 1e-12).map((t) => new THREE.Triangle(t.a.applyMatrix4(toUp), t.b.applyMatrix4(toUp), t.c.applyMatrix4(toUp)));
  const at = new THREE.Vector3(), cp = new THREE.Vector3(), n = new THREE.Vector3(); let best = Infinity;
  for (const t of T) { t.closestPointToPoint(c, cp); if (cp.distanceTo(c) < best) { best = cp.distanceTo(c); at.copy(cp); t.getNormal(n); } }
  if (n.dot(new THREE.Vector3(at.x, 0, at.z)) < 0) n.negate();
  const back = points(cape).map((q) => q.applyMatrix4(toUp)).filter((q) => Math.abs(q.x) < 0.1 * s && q.z < 0); let hem = Infinity, low = Infinity; for (const q of back) hem = Math.min(hem, q.y); for (const q of Hu) low = Math.min(low, q.y);
  return { s, worn: worn.length, deep: deep / s, side: Math.abs(c.x) / s, out: c.clone().sub(at).dot(n) / s, shown: shown(fig, hoods, hoods[0].parent!, s), touch: facesOff(cape, H) / s, hem: (low - hem) / s, width: leastWidth(H) / s, fold: worstFold(hoods),
    cloakX: throughDepths(hoods, cloak).length, wornX: worn.length ? throughDepths(hoods, worn).length : 0 };
}

describe('hero garments', () => {
  it('cover every frame of every outfit (each stance, pose, at-ease variant and dead pose)', () => {
    const fs = all();
    expect(fs.length).toBe(Object.keys(OUTFITS).length * (Object.keys(KIT).length + Object.keys(POSES).length + AT_EASE.length + 1));
    // every garment hung, and hung to finite points
    for (const f of fs) {
      const names = new Set<string>(), bad: string[] = [];
      f.fig.traverse((o) => {
        if (!o.userData.garment) return; names.add(String(o.userData.garment));
        const p = (o as THREE.Mesh).geometry.getAttribute('position');
        for (let i = 0; i < p.count * 3; i++) if (!Number.isFinite(p.array[i])) { bad.push(String(o.userData.garment)); break; }
      });
      expect(bad, f.label).toEqual([]);
      expect(WORN[f.outfit].filter((n) => !names.has(n)), `${f.label}: not hung`).toEqual([]);
    }
  }, 120000);

  it('never let a leg pass out through a gown, a skirt, a tunic, coat tails or a mail shirt', () => {
    expect(report(all(), (p) => LEG.test(p.part) && CLOTH.has(p.garment))).toEqual([]);
  }, 120000);

  it('never let an arm pass out through a capelet or a cloak on a figure standing (raised, swung back, held out)', () => {
    expect(report(all().filter((f) => !f.dead), (p) => ARM.test(p.part) && CAPES.has(p.garment))).toEqual([]);
  }, 120000);

  it('never let an arm pass out through a capelet or a cloak on a body laid out either (flung up past the neck, laid across the back, curled over the chest)', () => {
    expect(report(all().filter((f) => f.dead), (p) => ARM.test(p.part) && CAPES.has(p.garment))).toEqual([]);
  }, 120000);

  it('never let a forearm or a hand lying on a fallen body sink into a gown, a skirt, a tunic or a mail shirt (the cloth lies under it)', () => {
    const fs = all().filter((f) => f.dead);
    for (const o of ['gown', 'cloak over mail']) fs.push(laid(o, 'laid out, the hands folded on the chest', FOLDED), laid(o, 'crumpled, a forearm across the body', CRUMPLED));
    expect(report(fs, (p) => LOWER_ARM.test(p.part) && CLOTH.has(p.garment))).toEqual([]);
  }, 120000);

  it('never let a thigh pass out through a tasset or the culet on a plate body fallen face down, its knees drawn up and splayed', () => {
    // (the knees drawn up under the belly and spread wide, the seat in the air: each thigh comes up through where its
    // tasset hangs, so the tassets and the culet fall a lame at a time onto what lies under them)
    const fig = heroFigure({ ...OUTFITS.plate, weapon: 'sword', deadPose: KNELT } as never, 'medium', 'dead'), hung = new Set<string>();
    fig.traverse((o) => { if (o.userData.garment) hung.add(String(o.userData.garment)); });
    expect(['tassetR', 'tassetL', 'culet'].filter((n) => !hung.has(n))).toEqual([]);
    expect(describePokes(findPokes(fig).filter((p) => /^thigh[RL]$/.test(p.part) && /^(tasset[RL]|culet)$/.test(p.garment)))).toBe('');
  }, 120000);

  it('keep a capelet, its hood and its clasps off the head of a body fallen face down or on its side, with room for the hair, and never in what it covers', () => {
    const bad: string[] = [];
    for (const frame of ['masculine', 'feminine']) for (const [label, deadPose] of FALLS) {
      const { fig, H, cape, covered } = fallenCape({ ...OUTFITS['cloak and capelet'], frame, weapon: 'sword', deadPose }), at = `${frame}, ${label}`;
      // (room for the hair everywhere, but where the capelet lies on what it covers or has come off it there, within
      // 0.055 of a point of it, its clearance with room for the spacing of those points; and even there its points no
      // nearer the head than 0.04, nor its faces, between its points, nearer than 0.03: settled off the arm only just,
      // it comes as near the head as the arm lets it)
      let least = Infinity;
      for (const q of points(cape)) {
        const d = nearest(q, H); least = Math.min(least, d);
        if (d < 0.09 && nearest(q, covered) > 0.055) bad.push(`${at}: ${d.toFixed(3)} off the head, on nothing it covers`);
      }
      if (least < 0.04) bad.push(`${at}: ${least.toFixed(4)} off the head`);
      const faces = facesOff(cape, H); if (faces < 0.03) bad.push(`${at}: a face ${faces.toFixed(4)} off the head`);
      // (and nowhere in what it covers, by however little)
      const pk = findPokes(fig, { tolerance: 0 }).filter((p) => CAPES.has(p.garment)); if (pk.length) bad.push(`${at}: ${describePokes(pk)}`);
    }
    expect(bad).toEqual([]);
  }, 120000);

  it('keep a capelet off the head of a body fallen on its back too, with room for the hair, though an arm raised over the head draws its neckline up beside it', () => {
    // (on its back the hair lies under the cloth lying on the floor round the head, and the hood lies flat on the floor
    // under the head, not kept out of the room for the hair; but on a woman's frame an arm raised over the head drew the
    // capelet's neckline up beside it, its points as near as 0.01 to the skin and its faces as near as 0.001, where it
    // stood in the hair. As on a body fallen face down or on its side: room for the hair everywhere, but where the
    // capelet lies on what it covers, read off the skin and against the head's own room, which on a head with long locks
    // lying on it (on the NPC branch) reaches past them; and in what it covers no deeper than a hair (with the NPC
    // branch's necks a man's neck stands through it on the back by 0.011 at the most, and on a woman in plate with an arm
    // raised over her head the upper arm through the cloak by 0.008, both older than the capelet keeping off the head on
    // a back fall). The hood apart)
    const bad: string[] = [], skin = '#c8a07a', o = new THREE.Vector3();
    for (const frame of ['masculine', 'feminine']) for (const plate of [false, true]) for (const long of frame === 'feminine' ? [false, true] : [false]) for (const [label, deadPose] of BACK) {
      const { fig, H, cape, covered } = fallenCape({ ...OUTFITS['cloak and capelet'], frame, weapon: 'sword', deadPose, ...(plate ? { armor: { kind: 'plate', color: '#aeb2ba' } } : {}), ...(long ? { hair: '#3a2a1a', hairStyle: 'long' } : {}) });
      const at = `${frame}${plate ? ', in plate' : ''}${long ? ', long-haired' : ''}, ${label}`, room = headRoom(fig.getObjectByName('head')!, skin, fig.getObjectByName('neck')!.position.y / 2.24)!;
      const cloth = cape.filter((m) => !m.userData.hood), hood = cape.filter((m) => m.userData.hood);
      let least = Infinity;
      for (const q of points(cloth)) {
        const d = nearest(q, H); least = Math.min(least, d);
        if ((d < 0.09 || room.depth(q, o) > 0.01) && nearest(q, covered) > 0.055) bad.push(`${at}: ${d.toFixed(3)} off the head, ${room.depth(q, o).toFixed(3)} in its room, on nothing it covers`);
      }
      if (least < 0.04) bad.push(`${at}: ${least.toFixed(4)} off the head`);
      const faces = facesOff(cloth, H); if (faces < 0.03) bad.push(`${at}: a face ${faces.toFixed(4)} off the head`);
      const pk = findPokes(fig, { tolerance: 0.012 }).filter((p) => CAPES.has(p.garment)); if (pk.length) bad.push(`${at}: ${describePokes(pk)}`);
      // (the body this is for: the neckline drawn up beside the head by the arm raised over it, on a woman's frame)
      if (frame === 'feminine' && !long && deadPose === RAISED && least > 0.15) bad.push(`${at}: the capelet ${least.toFixed(4)} off the head, its neckline no longer drawn up beside it`);
      // (and the hood lies under the head, in the room for the hair, as before: not kept out of it)
      let under = Infinity; for (const q of points(hood)) under = Math.min(under, nearest(q, H));
      if (hood.length && under >= 0.1) bad.push(`${at}: the hood ${under.toFixed(4)} off the head, kept out from under it`);
      if (!hood.length) bad.push(`${at}: no hood`);
    }
    expect(bad).toEqual([]);
  }, 120000);

  it('let a capelet on a body fallen on its back fall past the head to the floor, not held up beside it by the room kept for the hair', () => {
    // (stopped by that room on its way down, as by any part, the capelet stood up beside the head where it had fallen
    // clear of the room, 0.2 to 0.7 over what lay under it: it falls past the room, stopping on it only where it would
    // come to rest in it. Read where it lies just outside the room, within 0.1 of it, standing more than 0.25 over what
    // lies straight beneath it (the body, the cloth, the floor): on a body fallen on its back with no arm over its head,
    // 30 to 77 such points where the room stopped it, 22 at the most where it falls past, as many as there were before
    // the capelet kept off the head on a back fall at all)
    const bad: string[] = [], skin = '#c8a07a', down = new THREE.Vector3(0, -1, 0), ray = new THREE.Raycaster(), v = new THREE.Vector3(), o = new THREE.Vector3();
    for (const frame of ['masculine', 'feminine']) for (const plate of [false, true]) for (const [label, deadPose] of BACK.filter(([, p]) => p !== RAISED)) {
      const { fig } = fallenCape({ ...OUTFITS['cloak and capelet'], frame, weapon: 'sword', deadPose, ...(plate ? { armor: { kind: 'plate', color: '#aeb2ba' } } : {}) }), at = `${frame}${plate ? ', in plate' : ''}, ${label}`;
      const room = headRoom(fig.getObjectByName('head')!, skin, fig.getObjectByName('neck')!.position.y / 2.24)!, cape: THREE.Mesh[] = [], under: THREE.Mesh[] = [];
      fig.traverse((x) => { const m = x as THREE.Mesh; if (!m.isMesh || (m.material as THREE.Material).transparent || !m.visible) return; (x.userData.garment === 'mantle' ? cape : under).push(m); });
      let held = 0;
      for (const m of cape) {
        const p = m.geometry.getAttribute('position');
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); const d = room.depth(v, o); if (d > 0 || d <= -0.1) continue;
          ray.set(v.clone().addScaledVector(down, 1e-4), down); ray.far = 5; const hit = ray.intersectObjects(under, false)[0];
          if (Math.min(v.y, hit ? hit.distance : Infinity) > 0.25) held++;
        }
      }
      if (held > 25) bad.push(`${at}: ${held} points of the capelet just outside the head's room standing over 0.25 over what lies beneath them`);
    }
    expect(bad).toEqual([]);
  }, 120000);

  it('ease a capelet kept off the head into the cloth round it, with few of its edges there folded back on themselves', () => {
    // (put out of the head point by point, the capelet folded back on itself where a point was moved and the one beside
    // it was not: within 0.3 of the head's skin, as many as 30 of its edges had faces meeting at more than 150 degrees,
    // the cloth turned back to within 30 degrees of itself; eased into the cloth round it, no more than 15 are on any of
    // these falls, and no more than 20 may be. On a body fallen on its back, where the capelet falls past the head and is
    // kept out of it only where it would come to rest in it, no more than 25 may be: a man swooned on his back had 21
    // before the capelet kept off the head on a back fall at all)
    const bad: string[] = [], na = new THREE.Vector3(), nb = new THREE.Vector3(), key = (v: THREE.Vector3) => `${v.x.toFixed(5)},${v.y.toFixed(5)},${v.z.toFixed(5)}`;
    for (const frame of ['masculine', 'feminine']) for (const [label, deadPose, most] of [...FALLS.map(([l, p]) => [l, p, 20] as const), ...BACK.map(([l, p]) => [l, p, 25] as const)]) {
      const { fig, H, cape } = fallenCape({ ...OUTFITS['cloak and capelet'], frame, weapon: 'sword', deadPose }), at = `${frame}, ${label}`, s = fig.getObjectByName('neck')!.position.y / 2.24;
      // (the capelet itself, its hood and clasps aside: each edge between two of its faces, their corners one where they
      // lie at one place, and the middle of the edge)
      const tris = trianglesOf(cape.filter((m) => m.userData.garment === 'mantle')), edges = new Map<string, { f: number[]; m: THREE.Vector3 }>();
      expect(tris.length, at).toBeGreaterThan(500);
      tris.forEach((t, i) => {
        if (t.getArea() < 1e-12) return;
        const vs = [t.a, t.b, t.c], ks = vs.map(key);
        for (let e = 0; e < 3; e++) { const [u, v] = [ks[e], ks[(e + 1) % 3]], k = u < v ? `${u}|${v}` : `${v}|${u}`, r = edges.get(k) ?? { f: [], m: vs[e].clone().add(vs[(e + 1) % 3]).multiplyScalar(0.5) }; r.f.push(i); edges.set(k, r); }
      });
      let back = 0;
      for (const { f, m } of edges.values()) {
        if (f.length !== 2) continue;
        tris[f[0]].getNormal(na); tris[f[1]].getNormal(nb);
        if (na.dot(nb) < Math.cos((150 * Math.PI) / 180) && nearest(m, H) < 0.3 * s) back++;
      }
      if (back > most) bad.push(`${at}: ${back} edges near the head folded back on themselves`);
    }
    expect(bad).toEqual([]);
  }, 120000);

  it('lay a capelet on the shoulder plate the head of a body fallen on its side has come to rest on, never the plate through it', () => {
    // (plate armour, the pauldrons pieces nested under the shoulder: the lines from each upper arm's bone out to every
    // point of what hangs from the shoulder, the pauldron's pieces too, cross the capelet only where they run down to a
    // point of it within the capelet's clearance of the floor, the capelet lying on the floor under the arm: above the
    // floor, where the lines ran down to them, the plates stood through it beside the neck (a line running down crosses
    // it by no more than 0.002, as the capelet hung grazes a plate's edge high on the arm); and no arm through it, by
    // however little. Where the head has not come to rest on a pauldron, the capelet keeps off it there too: its faces
    // no nearer the head than 0.01, as near as the plate lets them come, where kept off it not at all they lay in it)
    const bad: string[] = [];
    let rests = 0, read = 0, down = 0;
    for (const frame of ['masculine', 'feminine']) {
      const { fig, H, cape, gear } = fallenCape({ ...OUTFITS['cloak and capelet'], frame, weapon: 'sword', armor: { kind: 'plate', color: '#aeb2ba' }, deadPose: CRUMPLED }), at = `${frame}, plate`;
      const pieces = points(gear.flatMap((g) => g.pieces));
      expect(pieces.length).toBeGreaterThan(100); // (the pauldrons found, nested under the shoulders)
      let close = Infinity; for (const q of H) close = Math.min(close, nearest(q, pieces));
      if (close < 0.02) rests++;
      else { read++; const faces = facesOff(cape, H); if (faces < 0.01) bad.push(`${at}: a face ${faces.toFixed(4)} off the head, which rests on no plate`); }
      // (the capelet's floor, 0.005 over the floor, and its clearance over that, 0.04 to the figure's size, with a
      // quarter of it again for the spacing of the plates' points)
      const s = fig.getObjectByName('neck')!.position.y / 2.24, low = 0.005 + 1.25 * 0.04 * s;
      const tris = trianglesOf(cape), ray = new THREE.Ray(), hit = new THREE.Vector3(), seg = new THREE.Line3(), A = new THREE.Vector3(), c = new THREE.Vector3();
      for (const { bone, all } of gear) for (const q of points(all)) {
        let best = Infinity; for (let k = 0; k + 1 < bone.length; k++) { seg.set(bone[k], bone[k + 1]).closestPointToPoint(q, true, c); const dd = c.distanceToSquared(q); if (dd < best) { best = dd; A.copy(c); } }
        const D = q.clone().sub(A), len = D.length(); if (len < 1e-6) continue;
        if (D.y < 0) { if (q.y < low) continue; down++; }
        const graze = D.y < 0 ? 0.002 : 0; ray.set(A, D.normalize());
        for (const t of tris) if (ray.intersectTriangle(t.a, t.b, t.c, false, hit) && hit.distanceTo(A) < len - graze) { bad.push(`${at}: through the capelet ${(len - hit.distanceTo(A)).toFixed(3)} at ${q.x.toFixed(2)},${q.y.toFixed(2)},${q.z.toFixed(2)}${D.y < 0 ? ', the line running down' : ''}`); break; }
      }
      // (nor a face of it through a face of what hangs from the shoulder over the floor, between the lines' ends, deeper
      // than 0.02: there a fold of the capelet stood through a pauldron's rim, 0.045 deep, which no line out to the
      // pauldron's points crossed; as hung, the capelet grazes the right pauldron's top lame by 0.014 high on the arm,
      // where it was never kept off the head)
      const deep = throughDepths(cape.filter((m) => !(m.scale.y === 0.5 && m.scale.z === 0.75)), gear.flatMap((g) => g.all)).filter((x) => x.p.y >= low && x.d > 0.02);
      if (deep.length) bad.push(`${at}: ${deep.length} edges through a plate, ${Math.max(...deep.map((x) => x.d)).toFixed(3)} deep, at ${deep[0].p.x.toFixed(2)},${deep[0].p.y.toFixed(2)},${deep[0].p.z.toFixed(2)}`);
      const pk = findPokes(fig, { tolerance: 0 }).filter((p) => CAPES.has(p.garment) && /^upperArm[RL]$/.test(p.part)); if (pk.length) bad.push(`${at}: ${describePokes(pk)}`);
    }
    expect(rests).toBeGreaterThan(0); // (the head has come to rest on a pauldron, in one frame at least)
    expect(read).toBeGreaterThan(0); // (and on none, in one frame at least)
    expect(down).toBeGreaterThan(100); // (lines running down to points well over the floor read too)
    expect(bad.slice(0, 8)).toEqual([]);
  }, 120000);

  it('lay the collar of a capelet over the neckband, not through it, on every body, with half the band at the least standing as built', () => {
    // (the capelet comes down at the collar onto the neckband, which draws in under it, so no edge of the capelet runs
    // through the band: as it hung before, the collar ran up to 0.04 through the band on a body standing, fighting or
    // laid on its back, and as deep on one kept off the head, fallen face down or on its side. The band only draws in
    // toward its middle, never out nor aside, and only where the capelet comes near it: on each body, in plate too, half
    // of it at the least stands as it is built, as it stands on the same body without a capelet (drawn in all round, it
    // sank wholly into the body and was lost there, and none of it stood so; drawn in under the hood's lump as well, which
    // lies in the back of the neck on purpose, as few as 14 of its 48 points stood so), and nowhere is it drawn in as far
    // as it goes, half its reach: the capelet never lies so deep. The hood's lump apart)
    const bad: string[] = [], bodies: [string, Record<string, unknown>, 'rest' | 'battle' | 'dead'][] = [
      ['standing', {}, 'rest'],
      ...Object.entries(KIT).map(([stance, kit]): [string, Record<string, unknown>, 'battle'] => [`in stance ${stance}`, { ...kit, stance }, 'battle']),
      ...(['dead', 'dead-comic', 'dead-swoon'] as const).map((deadPose): [string, Record<string, unknown>, 'dead'] => [`fallen on its back, ${deadPose}`, { deadPose }, 'dead']),
      ...FALLS.map(([l, deadPose]): [string, Record<string, unknown>, 'dead'] => [l, { deadPose }, 'dead']),
    ];
    let drawn = 0;
    for (const frame of ['masculine', 'feminine']) for (const plate of [false, true]) {
      const rec = { ...OUTFITS['cloak and capelet'], frame, weapon: 'sword', skin: '#c8a07a', ...(plate ? { armor: { kind: 'plate', color: '#aeb2ba' } } : {}) } as Record<string, unknown>;
      // (the band as built: on the same body without a capelet, in the chest's frame as the band on each body is)
      const bare = { ...rec }; for (const k of ['cloak', 'cloakTrim', 'clasps', 'hood']) delete bare[k];
      let built: THREE.Mesh | undefined; heroFigure(bare as never, 'medium', 'rest').traverse((o) => { if (o.userData.neckband) built = o as THREE.Mesh; });
      const a = built!.geometry.getAttribute('position'), lo = new THREE.Vector3().fromBufferAttribute(a, a.count - 2), p = new THREE.Vector3(), q = new THREE.Vector3();
      for (const [label, extra, st] of bodies) {
        const fig = heroFigure({ ...rec, ...extra } as never, 'medium', st), at = `${frame}${plate ? ', in plate' : ''}, ${label}`, band: THREE.Object3D[] = [], cape: THREE.Object3D[] = [];
        fig.updateMatrixWorld(true);
        fig.traverse((o) => { if (o.userData.neckband) band.push(o); else if ((o as THREE.Mesh).isMesh && (o.userData.garment === 'mantle' || o.userData.cloth === 'mantle') && !o.userData.hood) cape.push(o); });
        expect(band.length, `${at}: the neckband`).toBe(1);
        expect(cape.length, `${at}: the capelet`).toBeGreaterThan(0);
        const ds = throughDepths(cape, band).map((x) => x.d);
        if (ds.length) bad.push(`${at}: ${ds.length} edges through, ${Math.max(...ds).toFixed(4)} deep`);
        const b = (band[0] as THREE.Mesh).geometry.getAttribute('position');
        expect(b.count, at).toBe(a.count);
        let same = 0;
        for (let i = 0; i < a.count - 2; i++) {
          p.fromBufferAttribute(a, i).sub(lo); q.fromBufferAttribute(b, i).sub(lo);
          if (p.distanceTo(q) < 1e-9) { same++; continue; }
          if (Math.hypot(q.x, q.z) > Math.hypot(p.x, p.z) || Math.abs(q.y - p.y) > 1e-6 || Math.abs(p.x * q.z - p.z * q.x) > 1e-6) bad.push(`${at}: band point ${i} stands out or aside from where it is built`);
          if (Math.hypot(q.x, q.z) < Math.hypot(p.x, p.z) / 2 + 1e-6) bad.push(`${at}: band point ${i} drawn in as far as it goes`);
        }
        if (same < (a.count - 2) / 2) bad.push(`${at}: only ${same} of the band's ${a.count - 2} points stand as built`);
        if (same < a.count - 2) drawn++;
      }
    }
    expect(bad).toEqual([]);
    expect(drawn).toBeGreaterThan(bodies.length * 2); // (drawn in under the collar on most of them: it came near the band on every one)
  }, 240000);

  it('draw a band in under cloth lying over part of it at any slant, and leave its far side as it stands', () => {
    // (a band 0.07 high round an oval 0.3 by 0.25, as the neckband is lofted. Over its side where it points along z: one
    // broad face of cloth standing at a slant through it, and one lying flat across it between its ends, the way a collar
    // lies on it, which no line out from its axis at its foot, its middle or its top meets, their corners all far outside
    // it. Then narrow ones standing into it between two of the planes it is read in, three eighths of the way from its
    // first column to the next: a point standing up into it from below, a sliver standing through its foot and its top,
    // its corners all above or below it, and a spur lying flat at its middle, pointing in from outside; and a fin standing
    // in through its foot between two such planes further round, whose only corner or crossing within the band's reach
    // is where one of its edges crosses the foot (read from where it crossed, rounding put that crossing a hair under the
    // foot, it was dropped, and the fin was left standing 0.05 through the band). Drawn in under each, 0.006 short of it,
    // no edge of the cloth runs through the band, its far side stands as it was, and each of its points is drawn in
    // toward its axis or not at all; with its rings lofted top first, the same. Under a sheet lying flat across its
    // middle, its edge 0.05 from its axis, far inside it, the band is drawn in as far as it goes, half its reach, and no
    // further, though the sheet still stands through it)
    const face = (...pts: number[][]) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)); return new THREE.Mesh(g); };
    for (const flip of [false, true]) {
      const rings = [{ y: 0, w: 0.3, f: 0.25, b: 0.25 }, { y: 0.07, w: 0.3, f: 0.25, b: 0.25 }], lofted = () => new THREE.Mesh(loftGeometry(flip ? [...rings].reverse() : rings, 1, { seg: 24, k: 1.07, rows: 1 }));
      // (the way three eighths of the way round from the first column to the next, as the planes between them are turned)
      const g0 = lofted().geometry.getAttribute('position'), mid = new THREE.Vector3(g0.getX(0), 0, g0.getZ(0)).normalize().multiplyScalar(5 / 8).addScaledVector(new THREE.Vector3(g0.getX(1), 0, g0.getZ(1)).normalize(), 3 / 8), t = Math.atan2(mid.x, mid.z);
      const along = (r: number, y: number, a = 0) => [r * Math.sin(t + a), y, r * Math.cos(t + a)];
      const sheets: Record<string, THREE.Mesh> = {
        slant: face([-1, -0.5, -0.05], [1, -0.5, -0.05], [1, 0.6, 0.5], [-1, -0.5, -0.05], [1, 0.6, 0.5], [-1, 0.6, 0.5]),
        flat: face([-1, 0.04, 0.22], [1, 0.04, 0.22], [1, 0.04, 2], [-1, 0.04, 2], [-1, 0.04, 0.22], [1, 0.04, 2]),
        point: face(along(0.25, 0.01), along(0.25, -0.2, -0.004), along(0.25, -0.2, 0.004), along(0.25, 0.01), along(0.25, -0.2, 0.004), along(0.24, -0.2), along(0.25, 0.01), along(0.24, -0.2), along(0.25, -0.2, -0.004)),
        sliver: face(along(0.25, 0.3), along(0.25, -0.2, -0.003), along(0.25, -0.2, 0.003)),
        spur: face(along(0.25, 0.035), along(0.6, 0.035, -0.004), along(0.6, 0.035, 0.004)),
        fin: face([0.09947267174720764, -0.007553837262094021, 0.19693158566951752], [0.21105477213859558, 0.03630504384636879, 0.41783687472343445], [0.2859525978565216, -0.04849081486463547, 0.5661162734031677]),
      };
      for (const [lie, sheet] of Object.entries(sheets)) {
        const band = lofted(), at = `${lie}${flip ? ', top first' : ''}`;
        band.updateMatrixWorld(true); sheet.updateMatrixWorld(true);
        const was = (band.geometry.getAttribute('position').array as Float32Array).slice();
        expect(throughDepths([sheet], [band]).length, `${at}: the cloth stands through the band to begin with`).toBeGreaterThan(0);
        tuckUnder(band, [sheet], 0.006, 24);
        expect(throughDepths([sheet], [band]), at).toEqual([]);
        const p = band.geometry.getAttribute('position'); let kept = 0;
        for (let i = 0; i < 48; i++) {
          const x0 = was[i * 3], z0 = was[i * 3 + 2], x = p.getX(i), z = p.getZ(i);
          expect(p.getY(i), `${at}: point ${i}'s height`).toBeCloseTo(was[i * 3 + 1], 9);
          expect(Math.hypot(x, z), `${at}: point ${i} drawn out`).toBeLessThanOrEqual(Math.hypot(x0, z0) + 1e-9);
          expect(Math.abs(x0 * z - z0 * x), `${at}: point ${i} drawn aside`).toBeLessThan(1e-6);
          if (z0 < 0) expect(Math.hypot(x - x0, z - z0), `${at}: point ${i}, on the far side`).toBeLessThan(1e-9);
          if (Math.hypot(x - x0, z - z0) < 1e-9) kept++;
        }
        expect(kept, at).toBeGreaterThan(24);
      }
      const deep = face([-1, 0.035, 0.05], [1, 0.035, 0.05], [1, 0.035, 2], [-1, 0.035, 0.05], [1, 0.035, 2], [-1, 0.035, 2]), band = lofted();
      band.updateMatrixWorld(true); deep.updateMatrixWorld(true);
      const was = (band.geometry.getAttribute('position').array as Float32Array).slice();
      tuckUnder(band, [deep], 0.006, 24);
      const p = band.geometry.getAttribute('position'); let floored = 0;
      for (let i = 0; i < 48; i++) {
        const r0 = Math.hypot(was[i * 3], was[i * 3 + 2]), r = Math.hypot(p.getX(i), p.getZ(i));
        expect(r, `deep${flip ? ', top first' : ''}: point ${i} drawn in past half its reach`).toBeGreaterThanOrEqual(r0 / 2 - 1e-9);
        if (r < r0 / 2 + 1e-6) floored++;
      }
      expect(floored, `deep${flip ? ', top first' : ''}`).toBeGreaterThan(0);
    }
  });

  it('draw the neckband in only under cloth that comes nearer its face than the gap, no further than that, the column nearer it first', () => {
    // (the neckband round the chest's own oval, as it is lofted on a masculine frame, its columns 0.23 to 0.56 out from its
    // axis: between a narrow column and a wide one its face runs well inside the wide one's reach. A spur of cloth at the
    // band's middle height points in toward its axis between two columns, its tip as far out as the face there and a little
    // more. Clear of the face by more than the gap, 0.006, the band stands as it is (read against each column's reach
    // rather than its face, cloth 0.05 clear of it an eighth of the way from its third column to its fourth drew the fourth
    // in by 0.03, sinking the band where nothing lay on it). Clear by 0.002, the column nearer the tip is drawn in as far as
    // takes the face there 0.006 short of it, the other left as it stands (both drawn in where the tip is midway between
    // them), and nothing runs through the band. Two spurs between the same two columns,
    // three tenths and seven tenths of the way, each 0.004 inside the face: both columns are drawn in, the face lying
    // 0.006 short of one tip and no more than 0.0065 short of the other, where drawn in for each as though the other
    // stood as built it came 0.0095 short of one and 0.011 of the other)
    const r = ringAt(torsoRings(frameOf(false, 'lean')), 2.13), lofted = () => { const m = new THREE.Mesh(loftGeometry([{ ...r, y: 2.095 }, { ...r, y: 2.165 }], 1, { seg: 24, k: 1.07, rows: 1 })); m.updateMatrixWorld(true); return m; };
    const face = (...pts: number[][]) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)); const m = new THREE.Mesh(g); m.updateMatrixWorld(true); return m; };
    // (a column of the band out from its axis, and how far out the band's face lies along `d` between columns j and j + 1)
    const col = (P: THREE.BufferAttribute, j: number) => new THREE.Vector2(P.getX(j) - P.getX(48), P.getZ(j) - P.getZ(48));
    const faceAt = (P: THREE.BufferAttribute, j: number, d: THREE.Vector2) => { const a = col(P, j), e = col(P, j + 1).sub(a); return a.addScaledVector(e, (a.y * d.x - a.x * d.y) / (e.x * d.y - e.y * d.x)).length(); };
    const P0 = lofted().geometry.getAttribute('position') as THREE.BufferAttribute, mid = new THREE.Vector2(P0.getX(48), P0.getZ(48));
    expect(col(P0, 3).length() - col(P0, 2).length(), 'a narrow column beside a wide one').toBeGreaterThan(0.07);
    const turned = (d: THREE.Vector2, a: number) => new THREE.Vector2(d.x * Math.cos(a) - d.y * Math.sin(a), d.x * Math.sin(a) + d.y * Math.cos(a));
    for (const [f, clear] of [[1 / 8, 0.05], [1 / 8, 0.01], [0.3, 0.03], [0.5, 0.02], [0.5, 0.008], [7 / 8, 0.01], [1 / 8, 0.002], [7 / 8, 0.002], [0.5, 0.002]]) {
      const d = col(P0, 2).normalize().multiplyScalar(1 - f).addScaledVector(col(P0, 3).normalize(), f).normalize(), tip = faceAt(P0, 2, d) + clear, at = `${f} of the way, ${clear} clear`;
      const pt = (q: THREE.Vector2, t: number) => [mid.x + q.x * t, 2.13, mid.y + q.y * t];
      const spur = face(pt(d, tip), pt(turned(d, -0.004), tip + 0.35), pt(turned(d, 0.004), tip + 0.35)), band = lofted(), was = (band.geometry.getAttribute('position').array as Float32Array).slice();
      tuckUnder(band, [spur], 0.006, 24);
      const P = band.geometry.getAttribute('position') as THREE.BufferAttribute, movedOf = (i: number) => Math.hypot(P.getX(i) - was[i * 3], P.getY(i) - was[i * 3 + 1], P.getZ(i) - was[i * 3 + 2]);
      const moved = Array.from({ length: 50 }, (_, i) => i).filter((i) => movedOf(i) > 1e-9);
      if (clear > 0.006) { expect(moved, at).toEqual([]); continue; }
      const drawn = f < 0.5 ? [2, 26] : f > 0.5 ? [3, 27] : [2, 3, 26, 27];
      expect(moved, at).toEqual(drawn);
      expect(faceAt(P, 2, d), at).toBeCloseTo(tip - 0.006, 5);
      expect(throughDepths([spur], [band]), at).toEqual([]);
    }
    const ds = [0.3, 0.7].map((f) => col(P0, 2).normalize().multiplyScalar(1 - f).addScaledVector(col(P0, 3).normalize(), f).normalize()), tips = ds.map((d) => faceAt(P0, 2, d) - 0.004);
    const pt = (q: THREE.Vector2, t: number) => [mid.x + q.x * t, 2.13, mid.y + q.y * t], spurs = ds.map((d, k) => face(pt(d, tips[k]), pt(turned(d, -0.004), tips[k] + 0.35), pt(turned(d, 0.004), tips[k] + 0.35))), band = lofted();
    tuckUnder(band, spurs, 0.006, 24);
    const P = band.geometry.getAttribute('position') as THREE.BufferAttribute, short = ds.map((d, k) => tips[k] - faceAt(P, 2, d));
    expect(Math.min(...short), 'two spurs').toBeCloseTo(0.006, 5); expect(Math.max(...short), 'two spurs').toBeLessThan(0.0065);
    expect(throughDepths(spurs, [band]), 'two spurs').toEqual([]);
  });

  it('reads a face of cloth drawn to a line or to a point off the head by its edges and its corners, never as no number', () => {
    // (the head a ball of the skin's colour, 0.5 round, at the middle; its nearest point to the cloth here 0.5 out on x)
    const skin = '#c8a07a', head = new THREE.Group(); head.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 16), new THREE.MeshStandardMaterial({ color: skin })));
    const room = headRoom(head, skin, 1)!, a = new THREE.Vector3(0.52, 0, 0), b = new THREE.Vector3(0.53, 0, 0), c = new THREE.Vector3(0.52, 0.01, 0);
    expect(room.near(a, b, c)).toBeCloseTo(0.02, 9);
    // (its corners in every order: read as a triangle, the line with its far end given twice, before its near one, came
    // out as no number)
    for (const [u, v, w] of [[a, a, b], [a, b, a], [b, a, a], [a, b, b], [b, a, b], [b, b, a], [a, a, a]]) expect(room.near(u, v, w), `${u.x}, ${v.x}, ${w.x}`).toBeCloseTo(0.02, 9);
    expect(room.near(b, b, b)).toBeCloseTo(0.03, 9);
  });

  it('give a head with long locks lying on it room as far out as the farthest of them reaches, all round, and a head without them the room for the hair', () => {
    // (the head a ball of the skin's colour, 0.5 round, scaled by 1.2 and hung from a parent moved and turned, the
    // figure's size 2: 0.6 round in the world, the unit of the room 2.4. Bare, the room reaches 0.24 past its skin every
    // way. With long locks on it, their line on the head as the hair keeps it (`userData.long`, in the head's frame), as
    // thick as 0.1 at the root as they were built (hanging from the chest: not scaled with the head): as far as the lock
    // farthest off the skin reaches, a quarter thicker than at its root, and 0.048 more, every way; a lock framing the
    // face is read as the others are. Its points are read off the nearest point of the skin. The ball is cut 64 round by
    // 32 down so that a point of it lies on the middle of each of the room's bins of direction, which then reach exactly
    // as far as the room: cut otherwise, the bins come short of it by up to a few hundredths)
    const skin = '#c8a07a', out = new THREE.Vector3(), ways = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(-0.6, 0, 0.8), new THREE.Vector3(0.48, 0.6, -0.64)];
    const ball = (long?: unknown) => {
      const neck = new THREE.Group(), g = new THREE.Group(); neck.position.set(0.3, 1.1, -0.4); neck.rotation.set(0.4, -0.7, 0.2); g.position.set(0, 0.2, 0.1); g.scale.setScalar(1.2); neck.add(g);
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 64, 32), new THREE.MeshStandardMaterial({ color: skin }))); if (long) g.userData.long = long; return g;
    };
    const reach = (head: THREE.Group) => { const room = headRoom(head, skin, 2)!, c = head.getWorldPosition(new THREE.Vector3()); return ways.map((w) => room.depth(w.clone().normalize().multiplyScalar(0.6).add(c), out) + 0.6); };
    for (const r of reach(ball())) expect(r, 'bare').toBeCloseTo(0.6 + 0.24, 2);
    const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    for (const r of reach(ball({ locks: [{ pts: [v(0, 0.53, 0), v(0.65, 0, 0)] }, { pts: [v(0, 0, -0.55)] }], frame: [{ pts: [v(0, 0, 0.54)] }], r: [0.1, 0.03] }))) expect(r, 'a lock 0.18 off').toBeCloseTo(0.6 + 0.18 + 0.125 + 0.048, 2);
    for (const r of reach(ball({ locks: [{ pts: [v(0, 0.52, 0)] }], frame: [{ pts: [v(0, 0, 0.7)] }], r: [0.1, 0.03] }))) expect(r, 'a lock framing the face 0.24 off').toBeCloseTo(0.6 + 0.24 + 0.125 + 0.048, 2);
    // (locks lying close on the head leave it the room for the hair)
    for (const r of reach(ball({ locks: [{ pts: [v(0, 0.51, 0), v(0.51, 0, 0)] }], frame: [], r: [0.01, 0.005] }))) expect(r, 'locks close on it').toBeCloseTo(0.6 + 0.24, 2);
  });

  it('light each face of a capelet\'s hood as it faces on a body laid out, pressed flat on the floor or kept off the head', () => {
    const bad: string[] = [], A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), f = new THREE.Vector3(), v = new THREE.Vector3(); let pressed = 0;
    for (const frame of ['masculine', 'feminine']) for (const deadPose of ['dead', 'dead-swoon', 'dead-comic', 'dead-prone', 'dead-curled']) for (const size of ['medium', 'small'] as const) {
      const fig = heroFigure({ ...OUTFITS['cloak and capelet'], frame, deadPose } as never, size, 'dead'), hoods: THREE.Mesh[] = [], at = `${frame}, ${deadPose}, ${size}`;
      // (the hood: the capelet's ball squashed flat behind the neck)
      fig.updateMatrixWorld(true); fig.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && o.userData.cloth === 'mantle' && m.scale.y === 0.5 && m.scale.z === 0.75) hoods.push(m); });
      expect(hoods.length, at).toBe(1);
      const m = hoods[0], p = m.geometry.attributes.position, n = m.geometry.attributes.normal, ix = m.geometry.index, nm = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
      let away = 0, low = Infinity;
      for (let i = 0; i < p.count; i++) low = Math.min(low, v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld).y);
      for (let t = 0; t + 2 < (ix ? ix.count : p.count); t += 3) {
        const c3 = [0, 1, 2].map((k) => (ix ? ix.getX(t + k) : t + k));
        A.fromBufferAttribute(p, c3[0]).applyMatrix4(m.matrixWorld); B.fromBufferAttribute(p, c3[1]).applyMatrix4(m.matrixWorld); C.fromBufferAttribute(p, c3[2]).applyMatrix4(m.matrixWorld);
        f.crossVectors(C.sub(B), A.sub(B)); if (f.lengthSq() < 1e-14) continue; f.normalize();
        if (c3.some((i) => v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize().dot(f) <= 0)) away++;
      }
      // (never into the floor; laid on the back, the hood under the head, as high over it as the hair under it needs)
      const s = fig.getObjectByName('neck')!.position.y / 2.24;
      expect(low, `${at}: the hood under the floor`).toBeGreaterThan(-1e-6);
      if (deadPose !== 'dead-prone' && deadPose !== 'dead-curled') expect(low, `${at}: the hood on the hair under it`).toBeGreaterThanOrEqual(0.016 * s - 1e-6);
      if (low < 0.02) pressed++;
      if (away) bad.push(`${at}: ${away} faces`);
    }
    expect(bad).toEqual([]);
    expect(pressed, 'some of the hoods pressed flat on the floor').toBeGreaterThanOrEqual(8);
  }, 120000);

  it('bend a capelet\'s hood round the head of a body fallen face down or on its side, never folding it over sharply', () => {
    // (kept off the head point by point alone, the side of the hood the head lay in folded over on itself, its faces
    // meeting at up to 176 degrees; squashed away from the head first, the hood keeps its round, its faces meeting at no
    // more than 60, where on a ball of its size they meet at 34)
    const bad: string[] = [];
    const plates: [string, HeroPose | string][] = [['crumpled on its side, in plate', CRUMPLED], ['curled on its side, in plate', 'dead-curled']];
    for (const frame of ['masculine', 'feminine']) for (const [label, deadPose] of [...FALLS, ...plates]) {
      const plate = label.endsWith('in plate'), fig = heroFigure({ ...OUTFITS['cloak and capelet'], frame, weapon: 'sword', deadPose, ...(plate ? { armor: { kind: 'plate', color: '#aeb2ba' } } : {}) } as never, 'medium', 'dead'), at = `${frame}, ${label}`, hoods: THREE.Mesh[] = [];
      fig.updateMatrixWorld(true); fig.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && o.userData.cloth === 'mantle' && m.scale.y === 0.5 && m.scale.z === 0.75) hoods.push(m); });
      expect(hoods.length, at).toBe(1);
      const worst = worstFold(hoods); if (worst > 60) bad.push(`${at}: faces meeting at ${worst.toFixed(0)} degrees`);
    }
    expect(bad).toEqual([]);
  }, 120000);

  it('keep a capelet\'s hood off the head of a body fallen with its head thrown back, squashed no flatter than a third of itself', () => {
    // (thrown back so far, the head lies deeper in the hood than squashing it to a third of itself takes it out of, at
    // most of these angles: the hood is then moved out of the head's room whole, and what is left put out of it point by
    // point, so the hood lies 0.09 off the skin at the least, where squashed alone it lay as near as 0.03; squashed no
    // flatter than that third and moved whole, its faces meet at no more than a right angle, where squashed as far as the
    // head asked, past flat, it turned inside out, its faces meeting at up to 125 degrees, and where put out of the head
    // point by point for all the squash left, its side in the head came out through its other side, the two folded over
    // each other at up to 178 degrees. Squashed so and moved, it is still no thinner than a third of what it is across
    // where thinnest as built, 0.497 of the figure's size (as its faces are flat; a third of that is 0.1657, and it lies
    // 0.1659 thin at the least). On the falls above, that third is never reached)
    const bad: string[] = [], thrown: [string, HeroPose][] = [];
    for (const neck of [-1, -1.2, -1.4, -1.6]) thrown.push([`face down, the neck at ${neck}`, { lie: 'front', neck: [neck, 0, 0] }], [`on its side, the neck at ${neck}`, { lie: 'side', neck: [neck, 0, 0] }]);
    for (const frame of ['masculine', 'feminine']) for (const [label, deadPose] of thrown) {
      const { fig, H } = fallenCape({ ...OUTFITS['cloak and capelet'], frame, weapon: 'sword', deadPose }), at = `${frame}, ${label}`, hoods: THREE.Mesh[] = [];
      fig.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && o.userData.cloth === 'mantle' && m.scale.y === 0.5 && m.scale.z === 0.75) hoods.push(m); });
      expect(hoods.length, at).toBe(1);
      let least = Infinity; for (const q of points(hoods)) least = Math.min(least, nearest(q, H));
      if (least < 0.09) bad.push(`${at}: the hood ${least.toFixed(4)} off the head`);
      const thin = leastWidth(points(hoods)) / (fig.getObjectByName('neck')!.position.y / 2.24); if (thin < (0.5 / 3) * 0.99) bad.push(`${at}: the hood squashed to ${thin.toFixed(3)} thin, flatter than a third of itself`);
      const worst = worstFold(hoods); if (worst > 90) bad.push(`${at}: faces of the hood meeting at ${worst.toFixed(0)} degrees`);
    }
    expect(bad).toEqual([]);
  }, 120000);

  it('read how thin a hood lies as thin as it is, whatever way it is thinnest along, squashed or pressed in', () => {
    // (read along 400 directions round a ball alone, which leave a gap of 4 degrees round straight up and of nearly 7
    // elsewhere, a hood squashed to a third of itself was read up to some 16% thicker than it is, 8.6% on the second turn
    // tried here, so that one flattened to some 0.29 of itself could pass the bounds on it here; closed in on from the
    // least few of those directions, a hood pressed in was still read up to half a percent thicker)
    // (a ball of the hood's own faces squashed to a sixth along its height, so a third as thick as the hood: read the same
    // however it is turned, 0.1665612 thin, along a way a little off its height, along which it is 1/6; and the hood as
    // built, squashed to two thirds of itself along a way aslant, then pressed onto a floor aslant to that and out of a
    // head's ball, as a laid hood is: read 0.4496931 thin, where closed in on from those directions it was read 0.6%
    // thicker)
    const g = new THREE.SphereGeometry(0.5, 16, 10).getAttribute('position');
    const ball = (m: THREE.Matrix4) => { const ps: THREE.Vector3[] = []; for (let i = 0; i < g.count; i++) ps.push(new THREE.Vector3().fromBufferAttribute(g, i).applyMatrix4(m)); return ps; };
    for (const [axis, turn] of [[new THREE.Vector3(1, 0, 0), 0], [new THREE.Vector3(1, 0, 0), 0.03], [new THREE.Vector3(0.6, 0, 0.8), 0.07], [new THREE.Vector3(0, 0, 1), 1.2]] as const)
      expect(leastWidth(ball(new THREE.Matrix4().makeRotationAxis(axis, turn).multiply(new THREE.Matrix4().makeScale(1, 1 / 6, 0.75)))), `turned ${turn}`).toBeCloseTo(0.1665612, 6);
    const u = new THREE.Vector3(Math.sin(1.3), Math.cos(1.3), 0.3 * Math.sin(2.6)).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), u);
    const ps = ball(new THREE.Matrix4().makeRotationFromQuaternion(q).multiply(new THREE.Matrix4().makeScale(1, 0.67, 1)).multiply(new THREE.Matrix4().makeRotationFromQuaternion(q.clone().invert())).multiply(new THREE.Matrix4().makeScale(1, 0.5, 0.75)));
    const up = new THREE.Vector3(0.2, 1, -0.35).normalize(), heights = ps.map((p) => p.dot(up)), low = Math.min(...heights), floor = low + 0.1 * (Math.max(...heights) - low);
    for (const p of ps) p.addScaledVector(up, Math.max(0, floor - p.dot(up)));
    const head = new THREE.Vector3(-0.1, 0, 0.2).addScaledVector(u, -0.78);
    for (const p of ps) { const d = p.distanceTo(head); if (d < 0.8) p.sub(head).multiplyScalar(0.8 / d).add(head); }
    expect(leastWidth(ps), 'pressed in').toBeCloseTo(0.4496931, 6);
  });

  it('rest a capelet\'s folded hood out of the head with the hair on it on a body standing or fighting, as little way down the capelet\'s back as that asks, lying on the cloth there', () => {
    // (the hood rests on the capelet behind the neck, under the back of the head, which came down into it: on every one
    // of these bodies its deepest point lay in the head's room, as deep as 0.51 of the figure's size. It now rests as
    // far down the capelet's back as keeps it out of that room, a little gap (0.015) kept, and no further, but where the
    // head is bowed back so far that it gives way to the head there as on a body laid on its side; and it lies on the
    // capelet there as it does where it was built to rest: its middle at the middle of the back, out from the capelet's
    // face nearest it by 0.12 to 0.22 (it lay 0.16 out where it was built to rest, and gives way outward to a head bowed
    // far back), never hidden under the capelet (two fifths of it and more shows from behind and above), its points as
    // near the capelet as 0.02 at the most, all of it above the capelet's hem at the back, never squashed flatter than a
    // third of itself, its faces never folded over sharply, and never through the cloak under the capelet. Long hair asks
    // for more room where the head knows the locks lying out from its scalp)
    const bad: string[] = [], looks: [string, Record<string, unknown>, 'rest' | 'battle', boolean][] = [];
    for (const frame of ['masculine', 'feminine']) for (const hair of [{}, { hair: '#3a2a1a', hairStyle: 'long' }]) {
      const base = { frame, ...hair }, tag = `${frame}${'hairStyle' in hair ? ', long hair' : ''}`;
      for (const [stance, kit] of Object.entries(KIT)) looks.push([`${tag}, stance ${stance}`, { ...base, ...kit, stance }, 'battle', false]);
      for (const p of Object.keys(POSES).filter((p) => !p.startsWith('dead'))) looks.push([`${tag}, pose ${p}`, { ...base, weapon: 'sword', battlePose: p }, 'battle', false]);
      AT_EASE.forEach((a, i) => looks.push([`${tag}, at ease ${i}`, { ...base, weapon: 'mace', pose: a }, 'rest', false]));
      for (const neck of [0, -0.4, -0.8, -1, -1.2]) looks.push([`${tag}, at rest, the head back ${-neck}`, { ...base, weapon: 'mace', pose: { neck: [neck, 0, 0] } }, 'rest', neck <= -0.8]);
    }
    for (const [at, rec, st, bowed] of looks) {
      const h = standingHood(rec, st);
      if (h.deep > -0.0145) bad.push(`${at}: the hood ${h.deep > 0 ? `${h.deep.toFixed(4)} into` : `only ${(-h.deep).toFixed(4)} out of`} the head's room`);
      if (!bowed && h.deep < -0.0155) bad.push(`${at}: the hood ${(-h.deep).toFixed(4)} out of the head's room, further down the capelet than that asks`);
      if (h.side > 0.05) bad.push(`${at}: the hood's middle ${h.side.toFixed(3)} to the side of the back's`);
      if (h.out < 0.12 || h.out > 0.22) bad.push(`${at}: the hood's middle ${h.out.toFixed(3)} out from the capelet`);
      if (h.shown < 0.4) bad.push(`${at}: the hood hidden, ${(h.shown * 100).toFixed(0)}% of it showing`);
      if (h.touch > 0.02) bad.push(`${at}: the hood ${h.touch.toFixed(3)} off the capelet`);
      if (h.hem < 0.03) bad.push(`${at}: the hood ${h.hem.toFixed(3)} over the capelet's hem at the back`);
      if (h.width < (0.5 / 3) * 0.99) bad.push(`${at}: the hood squashed to ${h.width.toFixed(3)} thin, flatter than a third of itself`);
      if (h.fold > 90) bad.push(`${at}: faces of the hood meeting at ${h.fold.toFixed(0)} degrees`);
      if (h.cloakX) bad.push(`${at}: the hood through the cloak (${h.cloakX} crossings)`);
    }
    expect(bad).toEqual([]);
  }, 240000);

  it('rest a capelet\'s folded hood no further down its back than what is worn on the back lets it, never through that and never under the capelet', () => {
    // (a long weapon stowed on the back, under the capelet, raises the capelet's back over it: the hood never climbs that
    // way, and stays where it was built to rest; spirit wings rise from the shoulder blades, between the capelet's back
    // and where the hood would slide to: it rests no further down than keeps it a little off them (or no nearer them
    // than it lay where it was built to rest), never through them, and gives way to the head where it rests no nearer
    // them than that. Either way it still
    // lies on the capelet, its points as near it as 0.02 at the most, never hidden under it (drawn up out of the cloak
    // by flattening alone, with the capelet raised over the weapon and the head bowed back, it was squashed in under the
    // capelet: from behind and above none of it showed, or 3% of it, where as it was built to rest a quarter of it and
    // more shows), never squashed flatter than a third of itself, its faces never folded over sharply; and with nothing
    // stowed on the back, never through the cloak)
    const bad: string[] = [], looks: [string, Record<string, unknown>, 'rest' | 'battle', boolean][] = [];
    for (const frame of ['masculine', 'feminine']) {
      const rests: [string, Record<string, unknown>][] = [['at rest', {}], ['at ease 0', { pose: AT_EASE[0] }], ['at rest, the head back 0.6', { pose: { neck: [-0.6, 0, 0] } }]];
      for (const weapon of ['sword', 'axe', 'spear']) for (const [pk, pose] of rests) looks.push([`${frame}, ${weapon} stowed, ${pk}`, { frame, weapon, ...pose }, 'rest', true]);
      for (const [pk, pose] of rests) looks.push([`${frame}, spirit wings, ${pk}`, { frame, weapon: 'mace', spiritWings: { color: '#e8f0ff' }, ...pose }, 'rest', false]);
      for (const stance of ['two-handed', 'cast']) looks.push([`${frame}, spirit wings, stance ${stance}`, { frame, ...KIT[stance], stance, spiritWings: { color: '#e8f0ff' } }, 'battle', false]);
    }
    for (const [at, rec, st, stowed] of looks) {
      const h = standingHood(rec, st);
      if (!h.worn) bad.push(`${at}: nothing worn on the back`);
      if (h.wornX) bad.push(`${at}: the hood through what is worn on the back (${h.wornX} crossings)`);
      if (h.shown < 0.15) bad.push(`${at}: the hood hidden under the capelet, ${(h.shown * 100).toFixed(0)}% of it showing`);
      if (h.touch > 0.02) bad.push(`${at}: the hood ${h.touch.toFixed(3)} off the capelet`);
      if (h.width < (0.5 / 3) * 0.99) bad.push(`${at}: the hood squashed to ${h.width.toFixed(3)} thin, flatter than a third of itself`);
      if (h.fold > 90) bad.push(`${at}: faces of the hood meeting at ${h.fold.toFixed(0)} degrees`);
      if (!stowed && h.cloakX) bad.push(`${at}: the hood through the cloak (${h.cloakX} crossings)`);
    }
    expect(bad).toEqual([]);
  }, 180000);

  it('lay a capelet over an arm flung out from the shoulder of a body on its back, not torn into shards round it with the arm through them', () => {
    expect(report([laid('cloak and capelet', 'sprawled', SPRAWL)], (p) => ARM.test(p.part) && CAPES.has(p.garment))).toEqual([]);
  }, 60000);

  it('hang a tunic\'s skirt and a mail shirt over the feet of a body fallen forward onto its knees, never with a foot through them', () => {
    expect(report(['tunic', 'cloak over mail'].map((o) => laid(o, 'fallen on its knees', KNELT)), (p) => LEG.test(p.part) && CLOTH.has(p.garment))).toEqual([]);
  }, 60000);

  it('lay a cloak over the culet and the tassets, never with a plate standing up through it (fallen face down, on the knees or on the side, and standing)', () => {
    const GOWN = { frame: 'feminine', build: 'curvy', skirt: '#5e1f3a', underskirt: '#efe3c8' };
    const fs = [plated('fallen face down', { deadPose: 'dead-prone' }, 'dead'), plated('fallen on its knees', { deadPose: KNELT }, 'dead'), plated('curvy, crumpled on its side', { frame: 'feminine', build: 'curvy', deadPose: CRUMPLED }, 'dead'), plated('at rest', {}, 'rest'), ...Object.keys(KIT).map((k) => plated(`stance ${k}`, { ...KIT[k], stance: k }, 'battle')),
      plated('in a gown, fallen face down', { ...GOWN, deadPose: 'dead-prone' }, 'dead'), plated('in a gown, fallen on its knees', { ...GOWN, deadPose: KNELT }, 'dead'), plated('in a gown, curled', { ...GOWN, deadPose: 'dead-curled' }, 'dead')];
    expect(report(fs, (p) => /^(culet|tasset[RL])$/.test(p.part))).toEqual([]);
  }, 60000);

  it('hang coat tails over the culet and the tassets, never with a plate through them (standing, in battle, fallen face down, on the knees or on the side)', () => {
    const fs = [plated('at rest', {}, 'rest', 'tails'), plated('feminine, at rest', { frame: 'feminine', build: undefined }, 'rest', 'tails'), ...Object.keys(KIT).map((k) => plated(`stance ${k}`, { ...KIT[k], stance: k }, 'battle', 'tails')),
      plated('fallen face down', { deadPose: 'dead-prone' }, 'dead', 'tails'), plated('fallen on its knees', { deadPose: KNELT }, 'dead', 'tails'), plated('feminine, fallen on its knees', { frame: 'feminine', build: undefined, deadPose: KNELT }, 'dead', 'tails'), plated('crumpled on its side', { deadPose: CRUMPLED }, 'dead', 'tails'), plated('swooned', { deadPose: 'dead-swoon' }, 'dead', 'tails')];
    expect(report(fs, (p) => /^(culet|tasset[RL])$/.test(p.part))).toEqual([]);
  }, 60000);

  it('let a capelet\'s collar fall onto the back of the neck of a body crumpled on its side, never into it', () => {
    expect(report(['cloak and capelet', 'cloak over mail'].map((o) => laid(o, 'crumpled', CRUMPLED)), (p) => p.part === 'neck' && CAPES.has(p.garment))).toEqual([]);
  }, 60000);

  it('hang a gown\'s cloak against the back at its top edge, not standing off it, with its corners still out where they were cut', () => {
    // (its top edge was cut round and stood almost half a foot off the back at the middle, a flat back being flatter than
    // that round; read along a level ray from the top edge in toward the trunk's axis, in the trunk's own frame)
    const C = 57, rc = new THREE.Raycaster();
    const gowns: Record<string, Record<string, unknown>> = { plain: OUTFITS['gown and cloak'], 'curvy, full sleeves': { ...OUTFITS['gown and cloak'], build: 'curvy', puffSleeves: true, fullSleeves: true, sleeves: '#efe3c8' } };
    for (const [name, rec] of Object.entries(gowns)) for (const st of ['rest', 'battle'] as const) {
      // (in a fight, a caster's stance: with no stance of its own a figure fights at ease, as it rests)
      const fig = heroFigure((st === 'battle' ? { ...rec, stance: 'conjure' } : rec) as never, 'medium', st); fig.updateMatrixWorld(true);
      const all: THREE.Mesh[] = []; fig.traverse((o) => { if ((o as THREE.Mesh).isMesh) all.push(o as THREE.Mesh); });
      const cloak = all.find((m) => m.userData.garment === 'cloak' && !m.userData.veil)!, tag = `${name} ${st}`;
      expect(cloak, tag).toBeTruthy();
      const trunk = cloak.parent!, solid = all.filter((m) => !m.userData.garment && !(m.material as THREE.Material).transparent);
      const pos = cloak.geometry.getAttribute('position') as THREE.BufferAttribute;
      const gap = (k: number) => {
        const v = new THREE.Vector3().fromBufferAttribute(pos, k).applyMatrix4(cloak.matrixWorld), q = trunk.worldToLocal(v.clone());
        const to = trunk.localToWorld(new THREE.Vector3(0, q.y, 0)).sub(v), far = to.length(); rc.set(v, to.normalize()); rc.far = far;
        return rc.intersectObjects(solid, false)[0]?.distance ?? Infinity;
      };
      // the middle of the top edge lies close on the back, and so does the edge either side of it
      for (const k of [21, 28, 35]) expect(gap(k), `${tag} column ${k}`).toBeLessThan(0.16);
      // the corners stay out where they were cut (they are never brought in): the edge is not drawn in round the sides
      for (const k of [0, C - 1]) expect(gap(k), `${tag} corner ${k}`).toBeGreaterThan(0.1);
    }
  }, 120000);

  it('bring a gown\'s cloak in only as far as a long weapon slung on the back under it lets it', () => {
    // (a haft or a blade is a box with points only at its ends: the cloak's top edge, brought in toward the back, must not
    // come into one where it passes under the cloak)
    for (const weapon of ['axe', 'spear', 'sword']) {
      const fig = heroFigure({ ...OUTFITS['gown and cloak'], weapon } as never, 'medium', 'rest'); fig.updateMatrixWorld(true);
      const all: THREE.Mesh[] = []; fig.traverse((o) => { if ((o as THREE.Mesh).isMesh) all.push(o as THREE.Mesh); });
      const cloak = all.find((m) => m.userData.garment === 'cloak' && !m.userData.veil)!, boxes: THREE.Mesh[] = [];
      fig.getObjectByName('stowed')?.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry.type === 'BoxGeometry') boxes.push(m); });
      expect(cloak, weapon).toBeTruthy(); expect(boxes.length, `${weapon} slung on the back`).toBeGreaterThan(0);
      const pos = cloak.geometry.getAttribute('position') as THREE.BufferAttribute, inside: number[] = [];
      for (const b of boxes) {
        b.geometry.computeBoundingBox(); const bb = b.geometry.boundingBox!, inv = b.matrixWorld.clone().invert();
        for (let i = 0; i < pos.count; i++) if (bb.containsPoint(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(cloak.matrixWorld).applyMatrix4(inv))) inside.push(i);
      }
      expect(inside, `${weapon}: cloak vertices inside the slung weapon`).toEqual([]);
    }
  }, 120000);
});
