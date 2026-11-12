// Beasts: jointed four-legged creatures (wolves, hounds, cats, horses, the nightmare) built from one recipe and posed
// through their joints. Original low-poly geometry, palette materials, smooth shading on the hide.
//
// A beast faces +z with its origin on the floor under its middle. Joints are named groups (userData.joints): hips, body,
// neck, head, jaw, tail, and each leg's three joints (legFL0..2, legFR.., legHL.., legHR..); `saddle` is the mount point on
// the back where a rider's hips sit. On every joint a negative x angle swings the part forward or up, as on the people.
import * as THREE from 'three';
import { mat } from '../render/materials';

type M = THREE.Mesh;
const soft = (c: string, emissive?: string): THREE.MeshLambertMaterial => { const m = mat(c, { emissive: emissive ?? '#030303' }); m.userData.smooth = true; return m; };
const tone = (c: string, to: string, k: number) => '#' + new THREE.Color(c).lerp(new THREE.Color(to), k).getHexString();
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const at = <T extends THREE.Object3D>(m: T, x: number, y: number, z: number): T => { m.position.set(x, y, z); return m; };
const grp = (name?: string): THREE.Group => { const g = new THREE.Group(); if (name) g.name = name; return g; };
const ball = (r: number, c: string, w = 12, h = 9): M => new THREE.Mesh(new THREE.SphereGeometry(r, w, h), soft(c));
const cone = (r: number, h: number, c: string, seg = 6): M => new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), soft(c));
/** A see-through, self-lit part (flame, a glow). */
function lit(m: M, c: string, opacity = 0.8): M {
  const n = new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.9, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
  n.userData = { keepLook: true, smooth: true }; m.material = n; m.userData.keepLook = true; return m;
}

/** A ring of a lofted body: where its centre is, and its half-width and half-height. */
interface Ring { z: number; y: number; rx: number; ry: number }
/** A hide lofted through rings along the body, closed at both ends. The underside can be flattened or tucked by `belly`. */
function loft(rings: Ring[], c: string, seg = 14): M {
  const v: number[] = [], idx: number[] = [], n = rings.length;
  for (const r of rings) for (let k = 0; k < seg; k++) { const a = (k / seg) * Math.PI * 2; v.push(Math.sin(a) * r.rx, r.y + Math.cos(a) * r.ry, r.z); }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < seg; k++) { const a = i * seg + k, b = i * seg + (k + 1) % seg; idx.push(a, a + seg, b, b, a + seg, b + seg); }
  const c0 = v.length / 3; v.push(0, rings[0].y, rings[0].z - rings[0].ry * 0.35); const c1 = c0 + 1; v.push(0, rings[n - 1].y, rings[n - 1].z + rings[n - 1].ry * 0.35);
  for (let k = 0; k < seg; k++) { idx.push(c0, k, (k + 1) % seg); idx.push(c1, (n - 1) * seg + (k + 1) % seg, (n - 1) * seg + k); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g, soft(c));
}
/** A limb segment hanging from its joint: a tapered shaft down -y with a rounded joint at the top. */
function shaft(len: number, r0: number, r1: number, c: string, flat = 0.85): THREE.Group {
  const g = grp(); const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 10, 1), soft(c)); m.position.y = -len / 2; m.scale.x = flat; g.add(m);
  const j = ball(r0 * 1.02, c, 10, 8); j.scale.x = flat; g.add(j); return g;
}

export type BeastEars = 'point' | 'round' | 'horse' | 'none';
export type BeastTail = 'brush' | 'whip' | 'horse' | 'stub' | 'flame' | 'none';
export type BeastFoot = 'paw' | 'hoof';
export type BeastMane = 'none' | 'ridge' | 'horse' | 'flame';

export interface BeastSpec {
  /** Feet: shoulder to hip, the height at the shoulder, the chest's and the loin's half-depth, the body's half-width. */
  len: number; height: number; chest: number; loin: number; width: number;
  neck: number; neckThick: number;
  /** The skull's length and half-width, and the muzzle's length and half-depth. */
  skull: number; skullW: number; muzzle: number; muzzleD: number;
  leg: number;                       // the upper leg's radius
  ears: BeastEars; tail: BeastTail; tailLen: number; foot: BeastFoot; mane: BeastMane;
  coat: string; under?: string; maneColor?: string; eyes?: string; nose?: string;
  /** Long upper canines; the eyes burn; flame at the hooves; ribs and bone showing through. */
  sabers?: boolean; glow?: boolean; fireFeet?: string; gaunt?: number;
  /** Tack: a saddle and a bridle (colours). */
  saddle?: { seat: string; trim?: string; cloth?: string }; bridle?: string;
}

/** Angles in radians. Legs: [upper, middle, lower]; negative swings forward. */
export interface BeastPose {
  /** The forequarters pitched up about the hips (rearing is about -0.9). */
  rear?: number;
  neck?: [number, number]; head?: [number, number]; jaw?: number;
  legFL?: [number, number, number]; legFR?: [number, number, number]; legHL?: [number, number, number]; legHR?: [number, number, number];
  tail?: [number, number];
}

const FRONT: [number, number, number] = [0.3, -0.42, 0.14], HIND: [number, number, number] = [-0.42, 0.95, -0.62];
export const BEAST_POSES = {
  stand: {},
  /** Head low, hackles up, jaws open, one forepaw reaching: a wolf about to spring. */
  snarl: { neck: [0.45, 0.2], head: [-0.2, 0.15], jaw: 0.5, legFL: [0.0, -0.3, 0.2], legFR: [0.55, -0.75, 0.3], legHL: [-0.6, 1.25, -0.7], legHR: [-0.3, 0.8, -0.55], tail: [-0.5, 0.1] },
  /** Mid-leap: forelegs flung forward, hind legs driving. */
  pounce: { rear: -0.38, neck: [0.1, 0], head: [0.25, 0], jaw: 0.65, legFL: [-0.9, -0.3, 0.3], legFR: [-0.65, -0.55, 0.4], legHL: [0.35, 0.45, -0.3], legHR: [0.1, 0.7, -0.5], tail: [-0.2, 0] },
  /** Rearing on the hind legs, forelegs striking at the air. */
  rear: { rear: -0.95, neck: [-0.25, 0.1], head: [0.35, 0], jaw: 0.3, legFL: [-0.55, -1.2, 0.9], legFR: [-0.95, -0.9, 0.7], legHL: [0.15, 0.55, -0.45], legHR: [-0.15, 0.75, -0.55], tail: [-0.6, 0.3] },
  /** A full gallop, legs gathered under. */
  gallop: { rear: -0.08, neck: [0.3, 0], head: [-0.25, 0], legFL: [-0.75, -0.2, 0.3], legFR: [-0.4, -0.95, 0.9], legHL: [0.75, 0.35, -0.2], legHR: [0.45, 0.85, -0.6], tail: [-0.9, 0] },
  /** A walk, for a mount carrying its rider at ease. */
  walk: { neck: [-0.05, 0], legFL: [-0.05, -0.3, 0.2], legFR: [0.5, -0.9, 0.5], legHL: [-0.2, 0.75, -0.55], legHR: [-0.6, 1.05, -0.5], tail: [-0.15, 0] },
  /** Dead on its side: legs stiff and splayed, the neck slack, the jaw hanging. */
  dead: { neck: [0.5, 0.3], head: [0.4, 0.2], jaw: 0.7, legFL: [-0.5, -0.1, 0.1], legFR: [0.35, -0.2, 0.1], legHL: [0.3, 0.3, -0.2], legHR: [-0.45, 0.5, -0.3], tail: [-1.0, 0] },
} satisfies Record<string, BeastPose>;
export type BeastPoseName = keyof typeof BEAST_POSES;

export function beast(s: BeastSpec, pose: BeastPose | BeastPoseName = 'stand'): THREE.Group {
  const p: BeastPose = typeof pose === 'string' ? BEAST_POSES[pose] : pose;
  const root = grp(), joints: Record<string, THREE.Object3D> = {}, J = (name: string, g: THREE.Group) => { g.name = name; joints[name] = g; return g; };
  const under = s.under ?? tone(s.coat, '#ffffff', 0.12), dark = tone(s.coat, '#000000', 0.35), gaunt = s.gaunt ?? 0;
  const half = s.len / 2, backY = s.height - s.chest * 0.25;

  // hips carry the hindquarters; the body (rib cage, neck, forelegs) pitches about them when the beast rears
  const hips = J('hips', grp()); hips.position.set(0, backY, -half); root.add(hips);
  const body = J('body', grp()); body.rotation.x = p.rear ?? 0; hips.add(body);
  const rings: Ring[] = [];
  const N = 9;
  for (let i = 0; i <= N; i++) {
    const u = i / N, z = -s.loin * 0.6 + u * (s.len + s.loin * 0.6 + s.chest * 0.55);
    const k = Math.sin(Math.min(1, u * 1.15) * Math.PI) ** 0.45;                                   // rounded off at both ends
    const deep = (s.loin + (s.chest - s.loin) * Math.min(1, u * 1.5) ** 1.2) * (0.55 + 0.45 * k) * (u > 0.2 && u < 0.6 ? 1 - gaunt * 0.25 : 1);
    const tuck = (u > 0.15 && u < 0.55 ? Math.sin((u - 0.15) / 0.4 * Math.PI) : 0) * (s.chest - s.loin) * 0.35;      // the belly tucks up behind the ribs
    rings.push({ z, y: -deep * 0.72 + tuck * 0.5 + (u > 0.8 ? (u - 0.8) * s.chest * 0.9 : 0), rx: s.width * (0.6 + 0.4 * k) * (1 - 0.15 * gaunt), ry: deep - tuck * 0.5 });
  }
  body.add(loft(rings, s.coat));
  if (gaunt > 0.4) for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) { const rib = new THREE.Mesh(new THREE.TorusGeometry(s.chest * 0.82, 0.03, 4, 8, 1.5), soft(dark)); rib.rotation.set(0, Math.PI / 2, sx > 0 ? -0.75 : Math.PI + 0.75 - 1.5); body.add(at(rib, sx * s.width * 0.42, -s.chest * 0.62, s.len * (0.45 + i * 0.09))); }
  const sad = J('saddle', grp()); sad.position.set(0, s.chest * 0.2, s.len * 0.48); body.add(sad);
  if (s.saddle) {
    const sd = s.saddle, trim = sd.trim ?? '#b08a3a';
    if (sd.cloth) { const cl = new THREE.Mesh(new THREE.CylinderGeometry(s.width * 1.08, s.width * 1.08, s.len * 0.62, 14, 1, true, Math.PI * 0.5 - 1.5, 3.0), soft(sd.cloth)); cl.rotation.x = Math.PI / 2; cl.scale.y = 1; (cl.material as THREE.MeshLambertMaterial).side = THREE.DoubleSide; body.add(at(cl, 0, -s.chest * 0.75, s.len * 0.45)).scale.set(1, 1, s.chest * 1.02 / (s.width * 1.08)); }
    const seat = new THREE.Mesh(new THREE.SphereGeometry(s.width * 0.8, 12, 8), soft(sd.seat)); seat.scale.set(0.95, 0.3, 1.5); body.add(at(seat, 0, s.chest * 0.1, s.len * 0.46));
    body.add(at(ball(s.width * 0.3, sd.seat), 0, s.chest * 0.32, s.len * 0.46 + s.width * 1.05), at(ball(s.width * 0.42, sd.seat), 0, s.chest * 0.28, s.len * 0.46 - s.width * 1.0));     // pommel and cantle
    const girth = new THREE.Mesh(new THREE.TorusGeometry(s.chest * 1.01, 0.045, 5, 18), soft(tone(sd.seat, '#000000', 0.3))); girth.scale.x = s.width / s.chest; body.add(at(girth, 0, -s.chest * 0.72, s.len * 0.56));
    for (const sx of [-1, 1]) { const strap = shaft(s.chest * 1.3, 0.03, 0.03, sd.seat); body.add(at(strap, sx * s.width * 0.98, s.chest * 0.0, s.len * 0.5)); const st = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 5, 10), soft(trim)); st.rotation.y = Math.PI / 2; body.add(at(st, sx * s.width * 0.98, -s.chest * 1.3 - 0.12, s.len * 0.5)); joints[sx > 0 ? 'stirrupL' : 'stirrupR'] = st; }
  }

  // ---- the neck and head
  const neck = J('neck', grp()); neck.position.set(0, s.chest * 0.18, s.len + s.chest * 0.25); neck.rotation.set((p.neck?.[0] ?? 0), (p.neck?.[1] ?? 0), 0); body.add(neck);
  const rest = s.foot === 'hoof' ? -0.85 : -0.45, nd = V(0, -Math.sin(rest), Math.cos(rest)), nt = s.neckThick;       // the neck rises forward from the withers
  const nr: Ring[] = []; for (let i = 0; i <= 5; i++) { const u = i / 5, t = nt * (1.25 - 0.45 * u); nr.push({ z: u * s.neck, y: 0, rx: t * 0.72, ry: t }); }
  const nk = loft(nr, s.coat, 12); nk.quaternion.setFromUnitVectors(V(0, 0, 1), nd); nk.position.copy(nd).multiplyScalar(-nt * 0.6); neck.add(nk);
  const head = J('head', grp()); head.position.copy(nd).multiplyScalar(s.neck * 0.96); head.rotation.set((p.head?.[0] ?? 0) + (s.foot === 'hoof' ? 0.75 : 0.25), (p.head?.[1] ?? 0), 0); neck.add(head);
  const sk = ball(1, s.coat, 14, 10); sk.scale.set(s.skullW, s.skullW * 0.95, s.skull * 0.62); head.add(at(sk, 0, 0, s.skull * 0.25));
  const mz = s.skull * 0.55, mu = loft([{ z: 0, y: 0, rx: s.skullW * 0.7, ry: s.muzzleD * 1.15 }, { z: s.muzzle * 0.5, y: -s.muzzleD * 0.1, rx: s.skullW * 0.5, ry: s.muzzleD * 0.95 }, { z: s.muzzle, y: -s.muzzleD * 0.15, rx: s.skullW * 0.42, ry: s.muzzleD * 0.8 }], s.coat, 10);
  head.add(at(mu, 0, -s.skullW * 0.12, mz));
  head.add(at(ball(s.skullW * 0.22, s.nose ?? '#17141a', 8, 6), 0, -s.skullW * 0.12 + s.muzzleD * 0.25, mz + s.muzzle + s.muzzleD * 0.1));
  const jaw = J('jaw', grp()); jaw.position.set(0, -s.skullW * 0.3, mz * 0.6); jaw.rotation.x = p.jaw ?? 0; head.add(jaw);
  jaw.add(at(loft([{ z: 0, y: 0, rx: s.skullW * 0.55, ry: s.muzzleD * 0.5 }, { z: s.muzzle * 0.95 + mz * 0.4, y: 0, rx: s.skullW * 0.33, ry: s.muzzleD * 0.36 }], under, 8), 0, -s.muzzleD * 0.35, 0));
  if ((p.jaw ?? 0) > 0.15) { const tg = ball(s.skullW * 0.3, '#7a2a30', 8, 6); tg.scale.set(1, 0.4, 2.2); jaw.add(at(tg, 0, -s.muzzleD * 0.1, s.muzzle * 0.5)); }
  if (s.foot === 'paw') for (const sx of [-1, 1]) {
    const up = cone(s.skullW * 0.085, s.muzzleD * (s.sabers ? 2.6 : 0.95), '#f2ece0', 5); up.rotation.x = Math.PI; head.add(at(up, sx * s.skullW * 0.3, -s.skullW * 0.12 - s.muzzleD * (s.sabers ? 1.6 : 1.0), mz + s.muzzle * 0.82));
    jaw.add(at(cone(s.skullW * 0.07, s.muzzleD * 0.7, '#f2ece0', 5), sx * s.skullW * 0.22, s.muzzleD * 0.15, mz * 0.4 + s.muzzle * 0.8));
    if ((p.jaw ?? 0) > 0.15) for (let i = 0; i < 3; i++) { const t = cone(s.skullW * 0.05, s.muzzleD * 0.45, '#f2ece0', 4); t.rotation.x = Math.PI; head.add(at(t, sx * s.skullW * 0.36, -s.skullW * 0.12 - s.muzzleD * 0.85, mz + s.muzzle * (0.2 + i * 0.18))); }
  }
  const eyeC = s.eyes ?? '#1a1410';
  for (const sx of [-1, 1]) {
    const e = ball(s.skullW * 0.17, eyeC, 8, 6); if (s.glow) lit(e, eyeC, 1); head.add(at(e, sx * s.skullW * 0.62, s.skullW * 0.28, s.skull * 0.5));
    const brow = ball(s.skullW * 0.24, s.coat, 8, 6); brow.scale.set(1.2, 0.5, 1.4); head.add(at(brow, sx * s.skullW * 0.58, s.skullW * 0.46, s.skull * 0.47));
    if (s.ears === 'point' || s.ears === 'horse') { const h = s.skullW * (s.ears === 'horse' ? 1.1 : 1.0), e2 = cone(s.skullW * 0.3, h, s.coat, 5); e2.scale.z = 0.45; e2.rotation.set(-0.2, 0, -sx * 0.28); head.add(at(e2, sx * s.skullW * 0.6, s.skullW * 0.75 + h * 0.3, s.skull * 0.02)); const inn = cone(s.skullW * 0.17, h * 0.7, tone(under, '#c88a8a', 0.4), 5); inn.scale.z = 0.3; inn.rotation.copy(e2.rotation); head.add(at(inn, sx * s.skullW * 0.6, s.skullW * 0.75 + h * 0.26, s.skull * 0.02 + s.skullW * 0.1)); }
    if (s.ears === 'round') { const e2 = ball(s.skullW * 0.33, s.coat, 8, 6); e2.scale.z = 0.4; head.add(at(e2, sx * s.skullW * 0.72, s.skullW * 0.72, s.skull * 0.05)); }
  }
  if (s.bridle) {
    const br = s.bridle; const band = new THREE.Mesh(new THREE.TorusGeometry(s.skullW * 0.56, 0.025, 4, 14), soft(br)); band.scale.y = s.muzzleD * 2.3 / s.skullW; head.add(at(band, 0, -s.skullW * 0.12, mz + s.muzzle * 0.45));
    const crown = new THREE.Mesh(new THREE.TorusGeometry(s.skullW * 1.0, 0.025, 4, 14), soft(br)); crown.rotation.x = 0.25; head.add(at(crown, 0, 0, s.skull * 0.1));
    for (const sx of [-1, 1]) { const rein = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(sx * s.skullW * 0.56, -s.skullW * 0.2, mz + s.muzzle * 0.45), V(sx * s.skullW * 1.2, -s.neck * 0.25, -s.skull * 0.3), V(sx * s.width * 0.5, -s.neck * 0.5, -s.neck * 0.78)]), 10, 0.018, 4), soft(br)); head.add(rein); }
  }
  const maneC = s.maneColor ?? dark;
  if (s.mane === 'ridge') for (let i = 0; i < 7; i++) { const u = i / 6, h = cone(nt * 0.3, nt * (0.75 - 0.3 * Math.abs(u - 0.4)), maneC, 4); h.rotation.x = -0.5; neck.add(at(h, 0, nd.y * s.neck * (1 - u) * 0.9 + nt * 0.95 - (1 - u) * 0.0, nd.z * s.neck * (1 - u) * 0.9 - nt * 0.35)); if (i < 4) body.add(at(cone(nt * 0.25, nt * 0.5, maneC, 4), 0, s.chest * 0.42, s.len * (1.0 - i * 0.16))); }
  if (s.mane === 'horse' || s.mane === 'flame') for (let i = 0; i < 9; i++) {
    const u = i / 8, c = nd.clone().multiplyScalar(s.neck * (0.08 + 0.9 * u)), up = V(0, nd.z, -nd.y).multiplyScalar(nt * (1.15 - 0.4 * u));
    if (s.mane === 'horse') { const lock = ball(nt * 0.42, maneC, 8, 6); lock.scale.set(0.45, 1.5, 1); lock.rotation.x = rest; neck.add(at(lock, 0.12 * nt * (i % 2 ? 1 : -1), c.y + up.y * 0.8, c.z + up.z * 0.8)); const fall = ball(nt * 0.5, maneC, 8, 6); fall.scale.set(0.3, 1.9, 0.9); neck.add(at(fall, nt * 0.62, c.y + up.y * 0.25, c.z + up.z * 0.25)); }
    else for (const [k, col, sc] of [[0, s.maneColor ?? '#ff7a1a', 1], [1, '#ffd070', 0.55]] as const) { const f = cone(nt * 0.36 * sc, nt * (1.5 + 0.9 * Math.sin(i * 2.1)) * sc, col, 5); lit(f, col, k ? 0.95 : 0.8); f.rotation.x = -0.7 + 0.25 * Math.sin(i * 1.3); neck.add(at(f, 0.08 * nt * Math.sin(i * 2.7), c.y + up.y + nt * 0.5 * sc, c.z + up.z - nt * 0.25)); }
  }
  if (s.mane === 'horse') { const fl = ball(nt * 0.5, maneC, 8, 6); fl.scale.set(0.9, 0.5, 1.4); head.add(at(fl, 0, s.skullW * 0.8, s.skull * 0.3)); }

  // ---- the legs: three segments each, scaled so the rest stance stands exactly at the shoulder height
  const hindRest: [number, number, number] = s.foot === 'hoof' ? [-0.22, 0.55, -0.36] : HIND;
  const legs: [string, number, number, boolean, [number, number, number]][] = [['legFL', 1, s.len - s.chest * 0.05, true, p.legFL ?? FRONT], ['legFR', -1, s.len - s.chest * 0.05, true, p.legFR ?? FRONT], ['legHL', 1, s.loin * 0.1, false, p.legHL ?? hindRest], ['legHR', -1, s.loin * 0.1, false, p.legHR ?? hindRest]];
  for (const [name, sx, z, front, ang] of legs) {
    const restA = front ? FRONT : hindRest, frac = front ? [0.36, 0.38, 0.26] : [0.36, 0.36, 0.28];
    const topY = front ? -s.chest * 0.55 : -s.loin * 0.35, drop = backY + topY, footH = s.foot === 'hoof' ? 0.26 : 0.2;
    let reach = 0, cum = 0; for (let i = 0; i < 3; i++) { cum += restA[i]; reach += frac[i] * Math.cos(cum); }
    const L = (drop - footH) / reach, r = s.leg * (front ? 1 : 1.25);
    const j0 = J(name + '0', grp()); j0.position.set(sx * s.width * (front ? 0.62 : 0.68), topY, z); j0.rotation.x = ang[0]; (front ? body : hips).add(j0);
    const up = shaft(L * frac[0], r * (front ? 1.25 : 1.9), r * 0.85, s.coat, 0.75); j0.add(up);
    if (!front) { const haunch = ball(s.loin * 0.78, s.coat, 12, 9); haunch.scale.set(0.5, 1.05, 0.95); j0.add(at(haunch, -sx * s.width * 0.12, -L * frac[0] * 0.18, 0)); } else { const sh = ball(s.chest * 0.5, s.coat, 10, 8); sh.scale.set(0.5, 1.2, 0.8); j0.add(at(sh, -sx * s.width * 0.1, L * frac[0] * 0.05, 0)); }
    const j1 = J(name + '1', grp()); j1.position.y = -L * frac[0]; j1.rotation.x = ang[1]; j0.add(j1); j1.add(shaft(L * frac[1], r * 0.82, r * 0.52, s.coat, 0.8));
    const j2 = J(name + '2', grp()); j2.position.y = -L * frac[1]; j2.rotation.x = ang[2]; j1.add(j2); j2.add(shaft(L * frac[2], r * 0.5, r * 0.42, s.foot === 'hoof' ? s.coat : s.coat, 0.85));
    const foot = J(name + 'Foot', grp()); foot.position.y = -L * frac[2]; foot.rotation.x = -(ang[0] + ang[1] + ang[2]) - (front ? 0 : 0) - ((p.rear ?? 0) && front ? p.rear! : 0); j2.add(foot);
    if (s.foot === 'hoof') { const h = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.52, r * 0.72, footH, 9), soft('#17141a')); foot.add(at(h, 0, -footH / 2, r * 0.1)); if (s.fireFeet) for (let i = 0; i < 4; i++) { const f = cone(r * 0.35, r * 1.8, i % 2 ? '#ffd070' : s.fireFeet, 5); lit(f, i % 2 ? '#ffd070' : s.fireFeet, 0.8); foot.add(at(f, Math.sin(i * 1.6) * r * 0.55, -footH * 0.2 + r * 0.4, Math.cos(i * 1.6) * r * 0.55)); } }
    else { const pw = ball(r * 0.78, s.coat, 10, 8); pw.scale.set(1, 0.6, 1.45); foot.add(at(pw, 0, -footH * 0.55, r * 0.5)); for (let i = -1; i <= 1; i++) { const cl = cone(r * 0.12, r * 0.5, '#e8e0cc', 4); cl.rotation.x = 1.9; foot.add(at(cl, i * r * 0.4, -footH * 0.75, r * 1.55)); } }
  }

  // ---- the tail
  const tail = J('tail', grp()); tail.position.set(0, -s.loin * 0.05, -s.loin * 0.55); tail.rotation.set(p.tail?.[0] ?? 0, 0, p.tail?.[1] ?? 0); hips.add(tail);
  const TL = s.tailLen;
  if (s.tail === 'brush' || s.tail === 'whip') {
    const pts = [V(0, 0, 0), V(0, -TL * 0.25, -TL * 0.35), V(0, -TL * 0.62, -TL * 0.6), V(0, -TL * 0.9, -TL * 0.72)], bushy = s.tail === 'brush';
    const c = new THREE.CatmullRomCurve3(pts), n = 8;
    const tr: Ring[] = []; for (let i = 0; i <= n; i++) { const u = i / n, r = bushy ? s.leg * (0.6 + 1.5 * Math.sin(Math.min(1, u * 1.3) * Math.PI * 0.85)) * (u > 0.85 ? (1 - u) / 0.15 * 0.8 + 0.2 : 1) : s.leg * (0.55 - 0.35 * u); const q = c.getPoint(u); tr.push({ z: q.z, y: q.y, rx: r, ry: r }); }
    tail.add(loft(tr.reverse(), s.coat, 8)); if (bushy) tail.add(at(ball(s.leg * 0.7, under, 8, 6), 0, pts[3].y, pts[3].z));
  }
  if (s.tail === 'horse') for (let i = 0; i < 5; i++) { const st = ball(s.leg * 1.3, maneC, 8, 6); st.scale.set(0.5, TL / (s.leg * 2.6), 0.5); st.rotation.x = -0.35 - 0.06 * i; tail.add(at(st, (i - 2) * s.leg * 0.3, -TL * 0.45, -TL * 0.2 - 0.02 * i)); }
  if (s.tail === 'flame') for (let i = 0; i < 7; i++) { const col = i % 2 ? '#ffd070' : (s.maneColor ?? '#ff7a1a'), f = cone(s.leg * (1.5 - i * 0.12), TL * (0.5 + 0.08 * (i % 3)), col, 5); lit(f, col, 0.8); f.rotation.x = -2.0 - 0.1 * i; tail.add(at(f, Math.sin(i * 2.2) * s.leg * 0.6, -TL * 0.1 * i, -TL * (0.12 + 0.08 * i))); }
  if (s.tail === 'stub') tail.add(ball(s.leg * 1.1, s.coat, 8, 6));

  // stand it on the floor, centred
  root.updateMatrixWorld(true);
  const b = new THREE.Box3(); for (const k of ['legFL', 'legFR', 'legHL', 'legHR']) b.expandByObject(joints[k + 'Foot']);
  const out = grp(); out.add(root); root.position.y = -b.min.y;
  out.userData.joints = joints; out.userData.spec = s;
  return out;
}

// ---- the kinds
const WOLF: BeastSpec = { len: 2.5, height: 2.6, chest: 0.62, loin: 0.42, width: 0.5, neck: 0.95, neckThick: 0.36, skull: 0.62, skullW: 0.33, muzzle: 0.55, muzzleD: 0.16, leg: 0.17, ears: 'point', tail: 'brush', tailLen: 1.7, foot: 'paw', mane: 'ridge', coat: '#5a5650', under: '#8a857a', eyes: '#d8b040' };
const HORSE: BeastSpec = { len: 4.3, height: 5.2, chest: 1.2, loin: 1.05, width: 0.9, neck: 2.4, neckThick: 0.6, skull: 0.95, skullW: 0.38, muzzle: 1.05, muzzleD: 0.29, leg: 0.27, ears: 'horse', tail: 'horse', tailLen: 2.9, foot: 'hoof', mane: 'horse', coat: '#5a3e2a', maneColor: '#1e1614', eyes: '#17120e' };
export const BEASTS: Record<string, BeastSpec> = {
  wolf: WOLF,
  'dire-wolf': { ...WOLF, len: 4.2, height: 4.3, chest: 1.08, loin: 0.7, width: 0.82, neck: 1.5, neckThick: 0.62, skull: 1.0, skullW: 0.55, muzzle: 0.9, muzzleD: 0.27, leg: 0.24, tailLen: 2.7, coat: '#3e3a38', under: '#6a655c', eyes: '#e0a020' },
  mastiff: { ...WOLF, len: 2.3, height: 2.4, chest: 0.66, loin: 0.5, width: 0.56, neckThick: 0.4, skullW: 0.38, muzzle: 0.38, muzzleD: 0.2, ears: 'round', tail: 'whip', tailLen: 1.4, mane: 'none', coat: '#7a5a3a', under: '#9a7a54', eyes: '#2a1a10' },
  'hell-hound': { ...WOLF, len: 2.8, height: 3.0, chest: 0.7, loin: 0.42, width: 0.55, coat: '#2a1614', under: '#5a1e14', eyes: '#ff8a1a', glow: true, gaunt: 0.7, mane: 'flame', maneColor: '#ff5a14', tail: 'flame', nose: '#ff8a1a' },
  'black-cat': { ...WOLF, len: 0.95, height: 0.85, chest: 0.2, loin: 0.17, width: 0.17, neck: 0.26, neckThick: 0.13, skull: 0.26, skullW: 0.17, muzzle: 0.1, muzzleD: 0.07, leg: 0.045, tail: 'whip', tailLen: 1.0, mane: 'none', coat: '#17141a', under: '#201c24', eyes: '#9ad84a', glow: true },
  'saber-toothed-tiger': { ...WOLF, len: 4.4, height: 3.9, chest: 1.05, loin: 0.8, width: 0.85, neck: 1.1, neckThick: 0.68, skull: 0.95, skullW: 0.6, muzzle: 0.55, muzzleD: 0.3, leg: 0.27, ears: 'round', tail: 'stub', tailLen: 0.5, mane: 'none', coat: '#b08a4e', under: '#e0cfa8', eyes: '#d8c040', sabers: true },
  'riding-horse': HORSE,
  'draft-horse': { ...HORSE, len: 4.7, height: 5.7, chest: 1.25, loin: 1.1, width: 0.95, neckThick: 0.64, leg: 0.26, coat: '#6a5a4a', maneColor: '#d8ccb0' },
  nightmare: { ...HORSE, len: 4.6, height: 5.6, coat: '#141216', under: '#1e1a20', eyes: '#ff7a1a', glow: true, mane: 'flame', maneColor: '#ff6a14', tail: 'flame', fireFeet: '#ff6a14', nose: '#ff8a1a', gaunt: 0.2 },
};
/** Strahd's own nightmare, tacked for its rider: black leather, a blood-red saddlecloth, silver fittings. */
export const BEUCEPHALUS: BeastSpec = { ...BEASTS.nightmare, len: 4.8, height: 5.8, saddle: { seat: '#1a1014', trim: '#c8ccd4', cloth: '#6e1420' }, bridle: '#1a1014', maneColor: '#ff5a10' };
