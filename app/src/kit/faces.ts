// Faces: a character's own head, built from a recipe of features so no two named people share a face.
// Original low-poly geometry, palette materials. The recipe is data (manifests/characters.json carries it), and the level of
// detail is data too: the more a character matters at the table, the more of the face is modelled.
//
// The group is in head-local units: origin at the centre of the skull, skull radius 1, +z out of the face, +y up. The
// caller scales it by the head's radius and hangs it on the head (or the head joint). Hair and ears are the figure's own.
import * as THREE from 'three';
import { mat } from '../render/materials';
import { loftGeometry, lockGeometry } from './anatomy';

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
  /** No hair cap on the head. */
  bald?: boolean;
}

export interface FaceLook { skin: string; hair?: string; eyes?: string; lips?: string; detail?: FaceDetail; /** Sculpted on the feminine frame (a softer jaw and brow, fuller lips, larger eyes). */ fem?: boolean }

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
  const fem = !!look.fem, jowls = Math.max(0, n(spec.jowls)), ridge = n(spec.browRidge), sunk = Math.max(0, n(spec.sunken));
  // ---- the head: the same sculpted skull the standard figures wear (so hair, ears and hoods fit it), with this face's
  // proportions pushed into it. Everything is one surface: temples, cheekbones over hollow cheeks, a brow over deep-set
  // eyes, the jaw's corner, the chin. Coordinates on the unit sphere; the eyes sit on the midline.
  const kx = 0.84 * (1 + 0.07 * headW), ky = 1.14 * (1 + 0.05 * headL);
  const bump = (x: number, y: number, cx: number, cy: number, wx: number, wy = wx) => Math.exp(-((x - cx) ** 2 / wx + (y - cy) ** 2 / wy));
  const skullAt = (ux: number, uy: number, uz: number, puff = 0): THREE.Vector3 => {
    let x = ux, z = uz; const y = uy, fz = Math.max(0, z), low = Math.max(0, -y), ax = Math.abs(ux);
    x *= kx * (fem ? 1 - (0.42 - 0.12 * jaw + 0.05 * gaunt) * low ** 1.7 : 1 - (0.31 - 0.11 * jaw + 0.05 * gaunt) * low ** 2.2);
    z *= 0.94 * (1 - 0.1 * low * low);
    if (z < 0 && y > -0.3) z *= 1.05;
    const sx = Math.abs(x);
    z += fz * (
      (fem ? 0.07 : 0.1) * (1 + 0.6 * chin + 0.3 * point) * bump(sx, y, 0, -0.84, 0.03 * (1 - 0.55 * Math.max(0, point)), 0.02)
      + 0.05 * bump(sx, y, 0, -0.52, 0.06, 0.03)
      + (fem ? 0.05 : 0.045) * (1 + 0.9 * cb) * bump(sx, y, 0.42, -0.1, 0.02, 0.012)
      - (fem ? 0.035 : 0.06) * (1 + 1.3 * gaunt) * bump(sx, y, 0.36, -0.45, 0.02, 0.03)
      + (fem ? 0.035 : 0.075) * (1 + 0.8 * ridge) * Math.exp(-((y - 0.2) ** 2) / 0.004) * Math.max(0, z - 0.45) * (1 - 0.5 * bump(sx, y, 0, 0.2, 0.01))
      - 0.11 * (1 + 0.3 * sunk) * bump(sx, y, 0.3, 0.03, 0.014, 0.008)
      - 0.03 * bump(sx, y, 0.62, 0.3, 0.02, 0.05)
      + 0.07 * jowls * bump(sx, y, 0.3, -0.7, 0.03, 0.03));
    x += Math.sign(x) * (fem ? 0.025 * Math.max(0, jaw) : 0.05 * (1 + 0.8 * jaw)) * bump(ax, y, 0.62, -0.5, 0.02, 0.02) * (z > -0.2 ? 1 : 0);
    return V(x * (R + puff), y * ky * (R + puff), z * (R + puff));
  };
  const shaped = (geo: THREE.BufferGeometry, c: string, puff = 0): M => {
    const p = geo.attributes.position as THREE.BufferAttribute, v = V(0, 0, 0);
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); const q = skullAt(v.x, v.y, v.z, puff); p.setXYZ(i, q.x, q.y, q.z); }
    geo.computeVertexNormals(); const m = new THREE.Mesh(geo, soft(c)); g.add(m); return m;
  };
  const headMesh = shaped(new THREE.SphereGeometry(1, d >= 3 ? 64 : 48, d >= 3 ? 48 : 36), skin);
  const hp = headMesh.geometry.attributes.position as THREE.BufferAttribute, frontPts: [number, number, number][] = [];
  for (let i = 0; i < hp.count; i += d >= 3 ? 2 : 1) if (hp.getZ(i) > 0.1) frontPts.push([hp.getX(i), hp.getY(i), hp.getZ(i)]);
  /** The face's depth at (x, y), to seat the features on it. */
  const surf = (x: number, y: number) => { let best = 0, bw = 0; for (const [vx, vy, vz] of frontPts) { const w = 1 / (1e-4 + (vx - x) ** 2 + (vy - y) ** 2) ** 2; best += vz * w; bw += w; } return best / bw; };
  const front = (y: number, x = 0) => surf(x, y);
  const jy = -0.2, jawW = 1 + 0.12 * jaw, chinY = -0.36 * (1 + 0.05 * headL), chinZ = surf(0, chinY), cby = -0.05;

  // ---- the nose: a wedge from the bridge to the tip, turned under to its base, with the nostrils' wings
  const nl = n(spec.noseLen), nwS = n(spec.noseW), hook = n(spec.noseHook), tipK = n(spec.noseTip);
  const nw = (fem ? 0.85 : 1) * (1 + 0.3 * nwS), nk = 1 + 0.22 * nl, nf = (fem ? 0.85 : 1) * (1 + 0.3 * nl), up = hook < 0 ? -0.02 * hook : 0;
  const ny = (y: number) => 0.07 - (0.07 - y) * nk, nz = surf(0, ny(-0.08));
  const nose = new THREE.Mesh(loftGeometry([
    { y: ny(-0.18) + up * 0.5, w: 0.03 * nw, f: 0.012, b: 0.02 }, { y: ny(-0.162) + up, w: 0.046 * nw, f: 0.055 * nf * (1 + 0.25 * tipK), b: 0.02 },
    { y: ny(-0.135) + up, w: 0.042 * nw * (1 + 0.2 * tipK), f: 0.07 * nf * (1 + 0.3 * tipK), b: 0.02 }, { y: ny(-0.06), w: 0.032 * nw, f: 0.042 * nf + 0.03 * Math.max(0, hook), b: 0.02 },
    { y: ny(0.03), w: 0.03 * nw, f: 0.018 + 0.012 * Math.max(0, hook), b: 0.02 }, { y: 0.07, w: 0.03, f: 0.004, b: 0.02 }], 1, { seg: 12, rows: 14 }), soft(skin));
  nose.position.set(0, 0, nz - 0.012); g.add(nose);
  const tip = V(0, ny(-0.135) + up, nz - 0.012 + 0.07 * nf * (1 + 0.3 * tipK)), wing = 0.046 * nw;
  for (const sx of [-1, 1]) { const al = sph(0.021 * nw, skin, 12, 8); al.scale.set(1, 0.72, 1.15); add(al, sx * 0.036 * nw, ny(-0.156) + up, nz + 0.004); if (d >= 2) add(sph(0.009, deep, 8, 6), sx * 0.02 * nw, ny(-0.172) + up, nz + 0.012).scale.set(1.2, 0.45, 1.3); }
  if (spec.warts) { const w = tone(skin, '#3a3020', 0.35); add(sph(0.014, w, 8, 6), 0.03, tip.y + 0.04, tip.z - 0.012); add(sph(0.012, w, 8, 6), -0.06, chinY + 0.05, surf(-0.06, chinY + 0.05)); add(sph(0.011, w, 8, 6), 0.2, cby + 0.01, surf(0.2, cby + 0.01)); }

  // ---- the eyes: small and set deep, almond-shaped; a sliver of white, the iris and pupil, a heavy upper lid, a lower
  // lid, the lash line. Then the brow: thick at the nose, tapering out along the ridge.
  const ew = (fem ? 1.3 : 1.16) * (1 + 0.2 * n(spec.eyeSize)), ex = 0.122 * (1 + 0.14 * n(spec.eyeSpace)), ey = 0, ez = surf(ex, 0) - 0.006 - 0.006 * sunk;
  const hooded = n(spec.hooded), slant = n(spec.eyeSlant), bags = n(spec.bags), eyeC = look.eyes ?? '#4a3a2a', lidC = spec.shadow ?? tone(skin, '#1e1216', 0.14);
  for (const sx of [-1, 1]) {
    const px = sx * ex, rz = sx * slant * 0.2;
    if (spec.eyepatch && (spec.eyepatch === 'L' ? 1 : -1) === sx) { add(sph(0.06, '#17141a'), px, ey + 0.005, ez + 0.012).scale.set(1.2, 1, 0.4); }
    else {
      const white = add(sph(0.04 * ew, '#e9e3d8', 16, 12), px, ey, ez); white.scale.set(1.3, 0.62, 0.6); white.rotation.z = rz;
      add(sph(0.021 * ew, eyeC, 14, 10), px, ey - 0.002, ez + 0.019);
      add(sph(0.0095 * ew, '#0e0b10', 8, 6), px, ey - 0.002, ez + 0.035);
      if (d >= 3) add(sph(0.0045, '#ffffff', 6, 4), px + 0.008, ey + 0.006, ez + 0.041);
      const lid = new THREE.Mesh(new THREE.SphereGeometry(0.044 * ew, 16, 8, 0, Math.PI * 2, 0, Math.PI * (0.46 + 0.1 * Math.max(0, hooded))), soft(lidC)); lid.scale.set(1.32, 0.72, 0.68); lid.rotation.set(0.3 + 0.15 * Math.max(0, hooded), 0, rz); add(lid, px, ey + 0.003, ez);
      const under = new THREE.Mesh(new THREE.SphereGeometry(0.044 * ew, 16, 6, 0, Math.PI * 2, Math.PI * 0.68, Math.PI * 0.32), soft(bags > 0 ? tone(skin, '#3a2a3a', 0.1 + 0.2 * bags) : tone(skin, '#1e1216', 0.08))); under.scale.set(1.3, 0.7, 0.66); under.rotation.set(-0.15, 0, rz); add(under, px, ey, ez);
      const lash = [-0.055, -0.02, 0.02, 0.055].map((dx, k) => V(px + dx * ew, ey + 0.012 + (k === 1 || k === 2 ? 0.012 : 0) + (k === 3 && sx > 0 || k === 0 && sx < 0 ? 0.006 + 0.012 * slant : 0), ez + 0.022 + (k === 1 || k === 2 ? 0.006 : 0)));
      line(lash, fem || spec.lashes ? 0.007 : 0.005, deep);
    }
    const bt = n(spec.browAngle), thick = (fem ? 0.017 : 0.026) * (1 + 0.5 * n(spec.browThick));
    const bp = [0.045, 0.09, 0.14, 0.195].map((ax, k) => V(sx * ax, [0.07, 0.088, 0.094, 0.078][k] + (fem ? 0.012 : 0) + 0.006 * ridge + bt * [-0.016, -0.004, 0.006, 0.012][k], surf(sx * ax, 0.085) + 0.006));
    g.add(new THREE.Mesh(lockGeometry(bp, thick, 0.005, 0.6, 6, 0.1), soft(hairC)));
    if (d >= 4 && (spec.age ?? 0) > 0.45) for (const k of [-1, 0, 1]) line([V(sx * (ex + 0.065), ey + k * 0.008, surf(ex + 0.065, ey) + 0.001), V(sx * (ex + 0.095), ey + k * 0.024, surf(ex + 0.095, ey + k * 0.024) + 0.001)], 0.003, shade);   // crow's feet
    if (spec.veins && d >= 3) line([V(sx * 0.27, 0.22, surf(0.27, 0.22)), V(sx * 0.25, 0.15, surf(0.25, 0.15) + 0.002), V(sx * 0.22, 0.1, surf(0.22, 0.1) + 0.002)], 0.004, spec.veins);
  }
  if (spec.eyepatch) { const sx = spec.eyepatch === 'L' ? 1 : -1; const t = new THREE.Mesh(new THREE.TorusGeometry(0.385, 0.009, 5, 28), soft('#17141a')); t.rotation.set(Math.PI / 2, sx * 0.35, 0); add(t, 0, 0.08, -0.01).scale.set(kx, 1, 0.98); }
  if (spec.spectacles) {
    for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 5, 18), soft(spec.spectacles)), sx * ex, ey, ez + 0.045);
    seg(V(-ex + 0.05, ey + 0.01, ez + 0.045), V(ex - 0.05, ey + 0.01, ez + 0.045), 0.005, spec.spectacles);
    for (const sx of [-1, 1]) seg(V(sx * (ex + 0.05), ey + 0.01, ez + 0.045), V(sx * 0.33, ey + 0.02, 0.02), 0.005, spec.spectacles);
  }

  // ---- the mouth: a bowed upper lip under the philtrum, a fuller lower one, the line between them
  const full = n(spec.lipFull), smile = n(spec.smile), lw = (fem ? 1.4 : 1.34) * (1 + 0.2 * n(spec.mouthW)), my = -0.262, mz = surf(0, -0.265), half = 0.058 * lw;
  for (const sx of [-1, 1]) { const u = add(sph(0.034, lip, 12, 8), sx * 0.026 * lw, my + 0.016 + 0.004 * smile, mz + 0.004); u.scale.set(1.25 * lw, (fem ? 0.46 : 0.38) * (1 + 0.45 * full), 0.55); u.rotation.z = sx * (0.16 + 0.2 * smile); }
  add(sph(0.05, tone(lip, '#ffffff', 0.08), 16, 10), 0, my - 0.014, mz + 0.001).scale.set(1.08 * lw, (fem ? 0.52 : 0.4) * (1 + 0.5 * full), 0.56);
  line([-0.058, -0.02, 0.02, 0.058].map((x) => V(x * lw, my + 0.003 - Math.abs(x) * 0.08 + Math.abs(x) * 0.55 * smile, mz + 0.014 - Math.abs(x) * 0.25)), 0.004, deep);
  if (spec.teeth) { const t = new THREE.Mesh(new THREE.BoxGeometry(half * 1.3, 0.014, 0.012), soft('#e8e0cc')); add(t, 0, my + 0.002, mz + 0.012); }
  if (spec.fangs) for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.036, 6), soft('#f2ece0')); f.rotation.x = Math.PI; add(f, sx * 0.024, my - 0.012, mz + 0.02); }
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
