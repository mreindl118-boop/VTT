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
// the capelet keeps off it there too. Its collar comes down over the neckband, never through it, and its hood bends
// round the head, never folded over sharply (put out of the head point by point, its side in the head folded over on
// itself). A face of cloth drawn to a line or a point is read off the head by its edges and corners (read as a
// triangle it came out as no number, and the cloth round it could not move). On any body laid out the hood, pressed
// flat on the floor (never into it) or kept off the head, is lit as each face of it faces (faces pressed over onto the
// flat of it shared their corners with it and showed dark notches along its rim).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
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

  it('ease a capelet kept off the head into the cloth round it, with few of its edges there folded back on themselves', () => {
    // (put out of the head point by point, the capelet folded back on itself where a point was moved and the one beside
    // it was not: within 0.3 of the head's skin, as many as 30 of its edges had faces meeting at more than 150 degrees,
    // the cloth turned back to within 30 degrees of itself; eased into the cloth round it, no more than 15 are on any of
    // these falls, and no more than 20 may be)
    const bad: string[] = [], na = new THREE.Vector3(), nb = new THREE.Vector3(), key = (v: THREE.Vector3) => `${v.x.toFixed(5)},${v.y.toFixed(5)},${v.z.toFixed(5)}`;
    for (const frame of ['masculine', 'feminine']) for (const [label, deadPose] of FALLS) {
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
      if (back > 20) bad.push(`${at}: ${back} edges near the head folded back on themselves`);
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

  it('lay the collar of a capelet kept off the head over the neckband, not through it, with half the band at the least standing as it stands', () => {
    // (kept off the head, the capelet comes down at the collar onto the neckband, which draws in under it, so no edge of
    // the capelet runs through the band; as it hung before it was kept off the head it ran up to 0.04 through it. The
    // band only draws in toward its middle, never out nor aside, and only where the capelet comes near it: on each of
    // these falls, in plate too, half of it at the least stands as it does on the body standing (drawn in all round, it
    // sank wholly into the body and was lost there, and none of it stood so; drawn in under the hood's lump as well, which
    // lies in the back of the neck on purpose, as few as 14 of its 48 points stood so), and nowhere is it drawn in as far
    // as it goes, half its reach: the capelet never lies so deep. The hood's lump apart, standing as fallen)
    const bad: string[] = [], falls: [string, HeroPose | string, boolean][] = [...FALLS.map(([l, p]): [string, HeroPose | string, boolean] => [l, p, false]), ['crumpled on its side, in plate', CRUMPLED, true]];
    for (const frame of ['masculine', 'feminine']) for (const [label, deadPose, plate] of falls) {
      const rec = { ...OUTFITS['cloak and capelet'], frame, weapon: 'sword', deadPose, ...(plate ? { armor: { kind: 'plate', color: '#aeb2ba' } } : {}) }, { fig, cape } = fallenCape(rec), at = `${frame}, ${label}`, band: THREE.Object3D[] = [];
      fig.traverse((o) => { if (o.userData.neckband) band.push(o); });
      expect(band.length, `${at}: the neckband`).toBe(1);
      const ds = throughDepths(cape.filter((m) => !(m.scale.y === 0.5 && m.scale.z === 0.75)), band).map((x) => x.d);
      if (ds.length) bad.push(`${at}: ${ds.length} edges through, ${Math.max(...ds).toFixed(4)} deep`);
      // (the band standing, in the chest's frame as the fallen one is)
      let up: THREE.Mesh | undefined; heroFigure({ ...rec, skin: '#c8a07a' } as never, 'medium', 'rest').traverse((o) => { if (o.userData.neckband) up = o as THREE.Mesh; });
      const a = up!.geometry.getAttribute('position'), b = (band[0] as THREE.Mesh).geometry.getAttribute('position'), lo = new THREE.Vector3().fromBufferAttribute(a, a.count - 2), p = new THREE.Vector3(), q = new THREE.Vector3();
      expect(b.count, at).toBe(a.count);
      let same = 0;
      for (let i = 0; i < a.count - 2; i++) {
        p.fromBufferAttribute(a, i).sub(lo); q.fromBufferAttribute(b, i).sub(lo);
        if (p.distanceTo(q) < 1e-9) { same++; continue; }
        if (Math.hypot(q.x, q.z) > Math.hypot(p.x, p.z) || Math.abs(q.y - p.y) > 1e-6 || Math.abs(p.x * q.z - p.z * q.x) > 1e-6) bad.push(`${at}: band point ${i} stands out or aside from where it stands`);
        if (Math.hypot(q.x, q.z) < Math.hypot(p.x, p.z) / 2 + 1e-6) bad.push(`${at}: band point ${i} drawn in as far as it goes`);
      }
      if (same < (a.count - 2) / 2) bad.push(`${at}: only ${same} of the band's ${a.count - 2} points stand as they do standing`);
    }
    expect(bad).toEqual([]);
  }, 120000);

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
    // each other at up to 178 degrees. On the falls above, that third is never reached)
    const bad: string[] = [], thrown: [string, HeroPose][] = [];
    for (const neck of [-1, -1.2, -1.4, -1.6]) thrown.push([`face down, the neck at ${neck}`, { lie: 'front', neck: [neck, 0, 0] }], [`on its side, the neck at ${neck}`, { lie: 'side', neck: [neck, 0, 0] }]);
    for (const frame of ['masculine', 'feminine']) for (const [label, deadPose] of thrown) {
      const { fig, H } = fallenCape({ ...OUTFITS['cloak and capelet'], frame, weapon: 'sword', deadPose }), at = `${frame}, ${label}`, hoods: THREE.Mesh[] = [];
      fig.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && o.userData.cloth === 'mantle' && m.scale.y === 0.5 && m.scale.z === 0.75) hoods.push(m); });
      expect(hoods.length, at).toBe(1);
      let least = Infinity; for (const q of points(hoods)) least = Math.min(least, nearest(q, H));
      if (least < 0.09) bad.push(`${at}: the hood ${least.toFixed(4)} off the head`);
      const worst = worstFold(hoods); if (worst > 90) bad.push(`${at}: faces of the hood meeting at ${worst.toFixed(0)} degrees`);
    }
    expect(bad).toEqual([]);
  }, 120000);

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
