// Faces: a character's own head, built from a recipe of features so no two named people share a face.
// Original low-poly geometry, palette materials. The recipe is data (manifests/characters.json carries it), and the level of
// detail is data too: the more a character matters at the table, the more of the face is modelled.
//
// The group is in head-local units: origin at the centre of the skull, skull radius 1, +z out of the face, +y up. The
// caller scales it by the head's radius and hangs it on the head (or the head joint). Hair and ears are the figure's own.
import * as THREE from 'three';
import { mat } from '../render/materials';

export type Beard = 'none' | 'stubble' | 'goatee' | 'full' | 'long' | 'chops';
export type Moustache = 'none' | 'thin' | 'thick' | 'handlebar' | 'droop';
export type Scar = 'cheekL' | 'cheekR' | 'browL' | 'browR' | 'lip' | 'across';
/** 1 = a face at a glance (shape, nose, eyes, brows, mouth); 2 = lids, pupils, nostrils, beard masses; 3 = lines of age,
 *  scars, lip shape, eye lights; 4 = the finest pass (lashes, crow's feet, teeth, veins, smoother surfaces). */
export type FaceDetail = 1 | 2 | 3 | 4;

/** Sliders run from -1 to 1 around a typical face (0); leave a field out for typical. */
export interface FaceSpec {
  /** The skull: wider or narrower, longer or shorter. */
  headW?: number; headL?: number;
  /** The jaw from narrow to square; the chin from receding to strong; a pointed chin; jowls. */
  jaw?: number; chin?: number; chinPoint?: number; jowls?: number;
  /** Cheekbones, and how hollow the cheeks under them are. */
  cheekbones?: number; gaunt?: number;
  /** The nose: length, width, the bridge from upturned (-1) to hooked (1), the size of the tip. */
  noseLen?: number; noseW?: number; noseHook?: number; noseTip?: number;
  /** The brow: the bone's weight, the hair's thickness, and its set from raised or sad (-1) to scowling (1). */
  browRidge?: number; browThick?: number; browAngle?: number; browColor?: string;
  /** The eyes: size, spacing, slant (outer corners up at 1), how deep they sit, hooded lids, bags beneath. */
  eyeSize?: number; eyeSpace?: number; eyeSlant?: number; sunken?: number; hooded?: number; bags?: number;
  /** The mouth: width, fullness, and its set from a frown (-1) to a smile (1); fangs; bared teeth. */
  mouthW?: number; lipFull?: number; smile?: number; fangs?: boolean; teeth?: boolean;
  beard?: Beard; moustache?: Moustache; beardColor?: string;
  /** 0 = young, 1 = very old: lines on the forehead, beside the mouth and at the eyes. */
  age?: number;
  scars?: Scar[]; eyepatch?: 'L' | 'R'; warts?: boolean; mole?: 'L' | 'R';
  /** Colours: veins at the temples, shadow on the lids, a flush on the cheeks, spectacle rims, lashes. */
  veins?: string; shadow?: string; blush?: string; spectacles?: string; lashes?: boolean;
}

export interface FaceLook { skin: string; hair?: string; eyes?: string; lips?: string; detail?: FaceDetail }

type M = THREE.Mesh;
const soft = (c: string): THREE.MeshLambertMaterial => { const m = mat(c, { emissive: '#030303' }); m.userData.smooth = true; return m; };
const tone = (c: string, to: string, k: number) => '#' + new THREE.Color(c).lerp(new THREE.Color(to), k).getHexString();
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

/** Skull dimensions before the group is scaled to radius 1 (the figure kit's own head is 0.4 of a foot-unit). */
const R = 0.4;

export function faceFeatures(spec: FaceSpec, look: FaceLook): THREE.Group {
  const d = look.detail ?? 2, g = new THREE.Group(), n = (v: number | undefined) => Math.max(-1, Math.min(1, v ?? 0));
  const [sw, sh] = ([[16, 12], [20, 14], [24, 18], [32, 24]] as const)[d - 1];
  const skin = look.skin, shade = tone(skin, '#2a1a1a', 0.22), deep = tone(skin, '#1a1014', 0.42), lip = look.lips ?? tone(skin, '#a8404a', 0.38);
  const hairC = spec.browColor ?? look.hair ?? '#3a2a1a', beardC = spec.beardColor ?? look.hair ?? '#3a2a1a';
  const sph = (r: number, c: string, w: number = sw, h: number = sh): M => new THREE.Mesh(new THREE.SphereGeometry(r, w, h), soft(c));
  const add = <T extends THREE.Object3D>(m: T, x: number, y: number, z: number): T => { m.position.set(x, y, z); g.add(m); return m; };
  /** A capsule from a to b. */
  const seg = (a: THREE.Vector3, b: THREE.Vector3, r: number, c: string): M => {
    const len = a.distanceTo(b), m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, d >= 3 ? 10 : 6), soft(c));
    m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize()); g.add(m); return m;
  };
  const line = (pts: THREE.Vector3[], r: number, c: string): M => { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(6, pts.length * 3), r, 5), soft(c)); g.add(m); return m; };

  const headW = n(spec.headW), headL = n(spec.headL), jaw = n(spec.jaw), chin = n(spec.chin), point = n(spec.chinPoint), cb = n(spec.cheekbones), gaunt = n(spec.gaunt);
  const wx = 0.9 * (1 + 0.12 * headW), wz = 0.86;
  /** The skull's front surface at (x, y), for things drawn on it. */
  const surf = (x: number, y: number) => wz * Math.sqrt(Math.max(0.0004, R * R - (x / wx) ** 2 - ((y - 0.05) / (1 + 0.06 * headL)) ** 2)) + 0.006;

  // ---- the head: one surface from the crown to the chin. The upper half is the skull; the lower half narrows through
  // the jaw to the chin and leans forward, and the back of it tucks in toward the neck.
  const jw = 0.8 + 0.16 * jaw + 0.08 * headW - 0.07 * gaunt, cw = Math.max(0.2, 0.44 + 0.2 * jaw - 0.2 * point);
  const faceLen = 1.12 + 0.2 * headL + 0.07 * point, lean = 0.4 * (1 + 0.3 * chin);
  const shape = (dx: number, dy: number, dz: number, puff = 0): THREE.Vector3 => {
    if (dy >= 0) return V(dx * (R + puff) * wx, 0.05 + dy * (R + puff) * (1 + 0.06 * headL), dz * (R + puff) * wz);
    const t = -dy, f = Math.max(0, dz), k = t < 0.72 ? wx + (jw - wx) * (t / 0.72) ** 1.5 : jw + (cw - jw) * ((t - 0.72) / 0.28) ** 0.8;
    const x = dx * (R + puff) * k / Math.max(0.35, Math.sqrt(1 - t * t)) * Math.sqrt(1 - t * t * 0.55);
    const y = 0.05 - t * (R + puff * 0.6) * (0.62 + (faceLen - 0.62) * Math.min(1, f * 1.6 + t * t * 0.75));
    const z = dz * (R + puff) * wz * (dz > 0 ? 1 - 0.1 * t * t : 1 - 0.3 * t) + R * lean * t * t * t;
    return V(x, y, z);
  };
  const shaped = (geo: THREE.BufferGeometry, c: string, puff = 0): M => {
    const p = geo.attributes.position as THREE.BufferAttribute, v = V(0, 0, 0);
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); const q = shape(v.x, v.y, v.z, puff); p.setXYZ(i, q.x, q.y, q.z); }
    geo.computeVertexNormals(); const m = new THREE.Mesh(geo, soft(c)); g.add(m); return m;
  };
  shaped(new THREE.SphereGeometry(1, sw + 8, sh + 6), skin);
  /** The face's front profile: how far forward the surface is at height y on the centre line, eased back toward the sides. */
  const front = (y: number, x = 0): number => {
    let best = 0, bd = 1e9;
    for (let i = 0; i <= 60; i++) { const t = i / 60, q = shape(0, -t, Math.sqrt(1 - t * t)); const e = Math.abs(q.y - y); if (e < bd) { bd = e; best = q.z; } }
    return best - (x * x) / (2 * R * 0.8);
  };
  const jy = -0.15 - 0.05 * headL, jawW = jw / 0.8;
  const chinY = 0.05 - R * faceLen + 0.07, chinZ = front(chinY);
  const jowls = n(spec.jowls); if (jowls > 0) for (const sx of [-1, 1]) add(sph(0.07 + 0.035 * jowls, skin), sx * 0.15, chinY + 0.1 - 0.02 * jowls, front(chinY + 0.1, 0.15) - 0.04).scale.set(1, 1.2, 0.9);
  if (chin > 0.2 || point > 0.2) add(sph(0.06 + 0.025 * chin, skin), 0, chinY + 0.005, chinZ - 0.03).scale.set(1.2 - 0.5 * point, 0.8 + 0.3 * point, 0.8);
  const cby = -0.05 + 0.02 * cb;
  for (const sx of [-1, 1]) {
    if (cb > 0.15) add(sph(0.075 * (1 + 0.3 * cb), skin), sx * 0.16, cby, front(cby, 0.16) - 0.085 + 0.02 * cb).scale.set(1.3, 0.7, 1);
    if (gaunt > 0 && d >= 2) add(sph(0.07, shade), sx * 0.19, cby - 0.15, front(cby - 0.15, 0.19) - 0.035).scale.set(0.7, 1.4, 0.5);
    if (spec.blush) add(sph(0.06, tone(skin, spec.blush, 0.5)), sx * 0.2, cby - 0.06, front(cby - 0.06, 0.2) - 0.012).scale.set(1.1, 0.8, 0.3);
  }

  // ---- the brow and the nose
  const ridge = n(spec.browRidge);
  seg(V(-0.13, 0.12, 0.3 + 0.035 * ridge), V(0.13, 0.12, 0.3 + 0.035 * ridge), 0.05 * (1 + 0.45 * ridge), skin);
  const nl = n(spec.noseLen), nw = n(spec.noseW), hook = n(spec.noseHook), tipK = n(spec.noseTip);
  const top = V(0, 0.07, 0.335), tip = V(0, -0.11 - 0.05 * nl + (hook < 0 ? -0.025 * hook : 0), 0.39 + 0.045 * nl + (hook < 0 ? 0.01 * hook : 0.012 * hook));
  const mid = top.clone().lerp(tip, 0.5).add(V(0, 0, 0.012 + (hook > 0 ? 0.04 * hook : 0.012 * hook)));
  const br = 0.042 * (1 + 0.35 * nw);
  seg(top, mid, br, skin); seg(mid, tip, br * 1.05, skin);
  const tipR = 0.055 * (1 + 0.45 * tipK + 0.25 * nw);
  add(sph(tipR, skin), tip.x, tip.y - (hook > 0.4 ? 0.012 * hook : 0), tip.z);
  const wing = 0.047 * (1 + 0.55 * nw);
  for (const sx of [-1, 1]) {
    if (d >= 2) add(sph(0.03 + 0.008 * nw, deep, 8, 6), sx * wing * 0.85, tip.y - 0.022, tip.z - 0.035);                 // nostril
    if (d >= 3) add(sph(0.036 * (1 + 0.3 * nw), skin, 10, 8), sx * wing * 1.25, tip.y - 0.005, tip.z - 0.045);            // its wing
  }
  if (spec.warts) { const w = tone(skin, '#3a3020', 0.35); add(sph(0.022, w, 8, 6), 0.035, tip.y + 0.05, tip.z - 0.005); add(sph(0.018, w, 8, 6), -0.06, chinY + 0.05, chinZ + 0.0); add(sph(0.016, w, 8, 6), 0.2, cby + 0.01, 0.31); }

  // ---- the eyes
  const ek = 1 + 0.3 * n(spec.eyeSize), ex = 0.135 * (1 + 0.2 * n(spec.eyeSpace)), ey = 0.035, sunk = n(spec.sunken), ez = 0.33 - 0.028 * Math.max(0, sunk);
  const hooded = n(spec.hooded), slant = n(spec.eyeSlant), bags = n(spec.bags), eyeC = look.eyes ?? '#4a3a2a';
  for (const sx of [-1, 1]) {
    const patch = spec.eyepatch && (spec.eyepatch === 'L' ? 1 : -1) === sx;
    if (patch) { add(sph(0.085, '#17141a'), sx * ex, ey + 0.005, ez + 0.02).scale.set(1.1, 1, 0.4); continue; }
    if (sunk > 0.25 && d >= 2) add(sph(0.075, shade), sx * ex, ey + 0.005, ez - 0.02).scale.set(1.25, 0.95, 0.5);        // the socket
    const white = add(sph(0.058 * ek, '#efe8de'), sx * ex, ey, ez); white.scale.set(1.25, 0.72 * (1 - 0.3 * Math.max(0, hooded)), 0.55); white.rotation.z = sx * slant * 0.22;
    add(sph(0.036 * ek, eyeC, 12, 10), sx * ex, ey, ez + 0.025);
    if (d >= 2) add(sph(0.017 * ek, '#141014', 8, 6), sx * ex, ey, ez + 0.055);
    if (d >= 3) add(sph(0.008, '#ffffff', 6, 4), sx * ex + 0.013, ey + 0.013, ez + 0.063);                              // a light in the eye
    const ly = ey + 0.04 * ek - 0.016 * hooded, a = sx * slant * 0.22, dx = 0.058 * ek, lidC = spec.shadow ?? shade;
    const lidP = (t: number, yy: number, zz: number) => V(sx * ex + t * dx * Math.cos(a), yy + t * dx * Math.sin(a), zz);
    seg(lidP(-1, ly, ez), lidP(1, ly, ez), 0.024 * (1 + 0.5 * Math.max(0, hooded)), lidC);
    if (spec.lashes && d >= 3) seg(lidP(-1.05, ly - 0.012, ez + 0.022), lidP(1.2, ly - 0.004, ez + 0.016), 0.008, '#141014');
    if (d >= 2 && (bags > 0 || d >= 3)) seg(lidP(-0.9, ey - 0.042 * ek, ez - 0.004), lidP(0.9, ey - 0.042 * ek, ez - 0.004), 0.014 + 0.012 * Math.max(0, bags), bags > 0 ? tone(skin, '#3a2a3a', 0.2 + 0.25 * bags) : skin);
    // the brow hair: scowling drops the inner end
    const bt = 0.3 * n(spec.browAngle) - 0.1, by = 0.14 + 0.012 * ridge - 0.01 * Math.max(0, n(spec.browAngle)), bz = 0.345 + 0.035 * ridge, bl = 0.075;
    const inner = V(sx * (ex + 0.005) - sx * bl * Math.cos(bt), by - bl * Math.sin(bt), bz + 0.004), outer = V(sx * (ex + 0.005) + sx * bl * Math.cos(bt), by + bl * Math.sin(bt), bz - 0.02);
    seg(inner, outer, 0.019 * (1 + 0.7 * n(spec.browThick)), hairC);
    if (d >= 4 && (spec.age ?? 0) > 0.45) for (const k of [-1, 0, 1]) line([V(sx * (ex + 0.075), ey + k * 0.012, ez - 0.03), V(sx * (ex + 0.115), ey + k * 0.035, ez - 0.075)], 0.005, shade);   // crow's feet
    if (spec.veins && d >= 3) line([V(sx * 0.3, 0.2, surf(sx * 0.3, 0.2) - 0.02), V(sx * 0.27, 0.13, surf(sx * 0.27, 0.13)), V(sx * 0.235, 0.085, surf(sx * 0.235, 0.085) + 0.01)], 0.006, spec.veins);
  }
  if (spec.eyepatch) { const sx = spec.eyepatch === 'L' ? 1 : -1; const t = new THREE.Mesh(new THREE.TorusGeometry(0.385, 0.012, 5, 28), soft('#17141a')); t.rotation.set(Math.PI / 2, sx * 0.35, 0); add(t, 0, 0.1, -0.01).scale.set(wx, 1, wz * 1.02); }
  if (spec.spectacles) {
    for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.008, 5, 18), soft(spec.spectacles)), sx * ex, ey, ez + 0.05);
    seg(V(-ex + 0.062, ey + 0.01, ez + 0.05), V(ex - 0.062, ey + 0.01, ez + 0.05), 0.007, spec.spectacles);
    for (const sx of [-1, 1]) seg(V(sx * (ex + 0.062), ey + 0.01, ez + 0.05), V(sx * 0.37, ey + 0.03, 0.02), 0.006, spec.spectacles);
  }

  // ---- the mouth
  const mw = 1 + 0.4 * n(spec.mouthW), full = n(spec.lipFull), smile = n(spec.smile), my = -0.235 - 0.06 * headL, mz = front(my) + 0.004;
  const half = 0.092 * mw, cy = my + 0.035 * smile;
  if (d >= 3) {
    const curve = (yy: number, zz: number, k: number) => [V(-half, cy + k * 0.2, zz - 0.034), V(-half * 0.5, yy + (cy - my) * 0.3, zz - 0.008), V(0, yy, zz), V(half * 0.5, yy + (cy - my) * 0.3, zz - 0.008), V(half, cy + k * 0.2, zz - 0.034)];
    line(curve(my + 0.02, mz + 0.004, 0.01), 0.022 * (1 + 0.5 * full), lip);
    line(curve(my - 0.022, mz, -0.01), 0.027 * (1 + 0.5 * full), lip);
    line(curve(my, mz + 0.016, 0), 0.007, tone(lip, '#1a0a0c', 0.6));
  } else {
    seg(V(-half * 0.75, my + 0.02, mz + 0.004), V(half * 0.75, my + 0.02, mz + 0.004), 0.026 * (1 + 0.5 * full), lip);
    seg(V(-half * 0.6, my - 0.02, mz), V(half * 0.6, my - 0.02, mz), 0.032 * (1 + 0.5 * full), lip);
    if (d >= 2 && Math.abs(smile) > 0.2) for (const sx of [-1, 1]) add(sph(0.02, lip, 8, 6), sx * half, cy, mz - 0.02);
  }
  if (spec.teeth) { const t = new THREE.Mesh(new THREE.BoxGeometry(half * 1.5, 0.026, 0.02), soft('#e8e0cc')); add(t, 0, my, mz + 0.012); }
  if (spec.fangs) for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.06, 6), soft('#f2ece0')); f.rotation.x = Math.PI; add(f, sx * 0.032, my - 0.022, mz + 0.03); }
  const age = Math.max(0, Math.min(1, spec.age ?? 0));
  if (d >= 3 && age > 0.3) for (const sx of [-1, 1]) line([V(sx * wing * 1.5, tip.y - 0.0, tip.z - 0.06), V(sx * (half + 0.035), my + 0.05, mz - 0.03), V(sx * (half + 0.03), my - 0.03, mz - 0.045)], 0.006 + 0.005 * age, shade);
  if (d >= 3 && age > 0.5) for (let i = 0; i < (d >= 4 ? 3 : 2); i++) { const y = 0.215 + i * 0.05, w = 0.15 - i * 0.02; line([-1, -0.5, 0, 0.5, 1].map((t) => V(t * w, y + 0.006 * Math.cos(t * 3), surf(t * w, y))), 0.005 + 0.003 * age, shade); }
  if (d >= 3 && n(spec.browAngle) > 0.5) for (const sx of [-1, 1]) line([V(sx * 0.02, 0.2, surf(0.02, 0.2) + 0.002), V(sx * 0.026, 0.13, 0.36 + 0.03 * ridge)], 0.006, shade);        // the scowl's furrow

  // ---- marks
  const scarC = tone(skin, '#a04848', 0.5);
  for (const s of spec.scars ?? []) {
    if (d < 2) break;
    const sx = /L$/.test(s) ? 1 : -1;
    if (s === 'cheekL' || s === 'cheekR') line([V(sx * 0.27, 0.0, 0.25), V(sx * 0.235, -0.1, 0.3), V(sx * 0.17, -0.22, 0.295)], 0.009, scarC);
    else if (s === 'browL' || s === 'browR') line([V(sx * (ex + 0.02), 0.24, surf(ex, 0.24)), V(sx * (ex + 0.035), 0.15, 0.375 + 0.03 * ridge), V(sx * (ex + 0.05), -0.04, 0.33)], 0.008, scarC);
    else if (s === 'lip') line([V(0.03, tip.y - 0.05, mz + 0.03), V(0.045, my - 0.07, mz + 0.012)], 0.008, scarC);
    else line([V(-0.2, 0.2, surf(-0.2, 0.2)), V(-0.04, 0.03, 0.385), V(0.12, -0.1, 0.34), V(0.2, -0.2, 0.27)], 0.009, scarC);
  }
  if (spec.mole) add(sph(0.014, '#2a1a16', 6, 4), (spec.mole === 'L' ? 1 : -1) * 0.12, my + 0.035, mz + 0.006);

  // ---- hair on the face
  const beard = spec.beard ?? 'none', mo = spec.moustache ?? (beard === 'goatee' || beard === 'full' || beard === 'long' ? 'thick' : 'none');
  const shell = (from: number, puff: number, c: string, spread = 1.75) => shaped(new THREE.SphereGeometry(1, sw, sh, Math.PI / 2 - spread, spread * 2, Math.PI * from, Math.PI * (1 - from)), c, puff);
  if (beard === 'stubble') shell(0.6, 0.006, tone(skin, beardC, 0.4));
  if (beard === 'goatee') add(sph(0.075, beardC), 0, chinY - 0.02, chinZ - 0.005).scale.set(0.85, 1.5, 0.8);
  if (beard === 'chops') for (const sx of [-1, 1]) add(sph(0.1, beardC), sx * 0.245 * jawW, jy - 0.02, 0.1).scale.set(0.5, 1.6, 1.1);
  if (beard === 'full' || beard === 'long') {
    shell(0.72, 0.03, beardC);
    for (const sx of [-1, 1]) add(sph(0.09, beardC), sx * 0.25 * jawW, jy + 0.02, 0.09).scale.set(0.45, 1.7, 1.1);
    add(sph(0.12, beardC), 0, chinY - 0.03, chinZ - 0.06).scale.set(1.2, 1.0, 0.85);
    if (beard === 'long') { const c = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.6, d >= 3 ? 12 : 8), soft(beardC)); c.rotation.x = Math.PI; add(c, 0, chinY - 0.33, chinZ - 0.07).scale.set(1, 1, 0.65); }
  }
  const moY = tip.y - 0.062, moZ = front(tip.y - 0.062) + 0.018;
  if (mo === 'thin') seg(V(-half * 0.9, moY - 0.004, moZ - 0.012), V(half * 0.9, moY - 0.004, moZ - 0.012), 0.014, beardC);
  if (mo === 'thick' || mo === 'handlebar' || mo === 'droop') for (const sx of [-1, 1]) {
    const end = V(sx * (half + 0.03), moY - (mo === 'droop' ? 0.05 : 0.028), moZ - 0.04);
    seg(V(sx * 0.008, moY, moZ), end, 0.026, beardC);
    if (mo === 'handlebar') seg(end, V(sx * (half + 0.075), moY + 0.02, moZ - 0.07), 0.014, beardC);
    if (mo === 'droop') seg(end, V(sx * (half + 0.035), my - 0.11, moZ - 0.06), 0.02, beardC);
  }

  g.scale.setScalar(1 / R);
  const out = new THREE.Group(); out.add(g);
  return out;
}

/** The detail a character earns from how much they matter: an importance score (the relationship web's power and ties)
 *  mapped onto the four levels. The thresholds live here so a rising character gains detail without a code change. */
export function detailFor(importance: number): FaceDetail { return importance >= 40 ? 4 : importance >= 15 ? 3 : importance >= 9 ? 2 : 1; }
