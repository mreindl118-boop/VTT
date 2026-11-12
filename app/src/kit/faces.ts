// Faces: a character's own head, built from a recipe of features so no two named people share a face.
// Original low-poly geometry, palette materials. The recipe is data (manifests/characters.json carries it), and the level of
// detail is data too: the more a character matters at the table, the more of the face is modelled.
//
// The group is in head-local units: origin at the centre of the skull, skull radius 1, +z out of the face, +y up. The
// caller scales it by the head's radius and hangs it on the head (or the head joint). Hair and ears are the figure's own.
import * as THREE from 'three';
import { paintFace, wearFace } from './facepaint';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mat } from '../render/materials';
import { loftGeometry } from './anatomy';

export type Beard = 'none' | 'stubble' | 'goatee' | 'full' | 'long' | 'chops';
export type Moustache = 'none' | 'thin' | 'thick' | 'handlebar' | 'droop';
export type Scar = 'cheekL' | 'cheekR' | 'browL' | 'browR' | 'lip' | 'across';
/** 1 = a face at a glance (shape, nose, eyes, brows, mouth); 2 = lids, pupils, nostrils, beard masses; 3 = lines of age,
 *  scars, lip shape, eye lights; 4 = the finest pass (lashes, crow's feet, teeth, veins, smoother surfaces). */
export type FaceDetail = 1 | 2 | 3 | 4;

/** Sliders run from -1 to 1 around a typical face (0); leave a field out for typical. */
export interface FaceSpec {
  /** The skull: wider or narrower, longer or shorter; the back of the head fuller (1) or flatter (-1); the forehead taller
   *  (1, the hairline higher) or lower; the face below the eyes longer or shorter. */
  headW?: number; headL?: number; skullDepth?: number; foreheadH?: number; faceLen?: number;
  /** The jaw from narrow to square; the chin from receding to strong; a pointed chin; jowls; the jaw's line from soft and
   *  rounded (-1) to a sharp, cut corner (1). */
  jaw?: number; chin?: number; chinPoint?: number; jowls?: number; jawAngle?: number;
  /** Cheekbones, and how hollow the cheeks under them are. */
  cheekbones?: number; gaunt?: number;
  /** The nose: length, width, the bridge from upturned (-1) to hooked (1), the size of the tip. */
  noseLen?: number; noseW?: number; noseHook?: number; noseTip?: number;
  /** The brow: the bone's weight, the hair's thickness, and its set from raised or sad (-1) to scowling (1). */
  browRidge?: number; browThick?: number; browAngle?: number; browColor?: string;
  /** The eyes: size, spacing, slant (outer corners up at 1), how deep they sit, hooded lids, bags beneath. */
  eyeSize?: number; eyeSpace?: number; eyeSlant?: number; sunken?: number; hooded?: number; bags?: number;
  /** The cut of the eye (kit/facepaint.ts EyeShape; picked from the sliders when left out), and where the eyes look: -1 to the figure's right, 1 to its left (or [across, up], up from -1 to 1). */
  eyeShape?: import('./facepaint').EyeShape; gaze?: number | [number, number];
  /** The mouth: width, fullness, and its set from a frown (-1) to a smile (1); fangs; bared teeth; and how far it hangs
   *  open (0 shut, 1 a scream), painted. */
  mouthW?: number; lipFull?: number; smile?: number; fangs?: boolean; teeth?: boolean; gape?: number;
  beard?: Beard; moustache?: Moustache; beardColor?: string;
  /** 0 = young, 1 = very old: lines on the forehead, beside the mouth and at the eyes. Up to 0.3 they are only the first
   *  faint lines, short smile lines and a crow's foot at each eye, for a face that has seen weather or laughed a lot. */
  age?: number;
  scars?: Scar[]; eyepatch?: 'L' | 'R'; warts?: boolean; mole?: 'L' | 'R';
  /** Veins: a colour paints them at the temples; a VeinMark (or several) paints a branching pattern on one side or both
   *  (a hexblood's marks, a curse spreading, an undead's veins). */
  veins?: string | VeinMark | VeinMark[];
  /** Colours: shadow on the lids, a flush on the cheeks (false for none: a weathered or a pallid face), spectacle rims.
   *  Lashes are drawn on a feminine face and not on a masculine one unless this says otherwise. */
  shadow?: string; blush?: string | false; spectacles?: string; lashes?: boolean;
  /** No hair cap on the head. */
  bald?: boolean;
  /** The ears: longer (1) or shorter (-1); and how far they stand out from the head, from lying back along it (0) to
   *  sticking straight out sideways through the hair (1), as an elf's or a fairy's often do in their art. */
  earLen?: number; earOut?: number;
}

/** A branching pattern of veins painted on the face: its colour; the side it spreads over, the figure's own ('L', 'R',
 *  or 'both', the default); where it spreads from (cheek: from the cheekbone down to the jaw, the default; jaw: along
 *  the jaw toward the chin; temple: from the temple down past the eye; brow: over the brow; eye: out from the eye's
 *  corner); and how far it spreads, 0 to 1 (0.7 when left out). Each side branches differently. */
export interface VeinMark { color: string; side?: 'L' | 'R' | 'both'; region?: 'cheek' | 'jaw' | 'temple' | 'brow' | 'eye'; size?: number }

export interface FaceLook { skin: string; hair?: string; eyes?: string; lips?: string; detail?: FaceDetail; /** Sculpted on the feminine frame (a softer jaw and brow, fuller lips, larger eyes). */ fem?: boolean; /** Crossed-out eyes. */ dead?: boolean }

type M = THREE.Mesh;
const soft = (c: string): THREE.MeshLambertMaterial => { const m = mat(c, { emissive: '#030303' }); m.userData.smooth = true; return m; };
const tone = (c: string, to: string, k: number) => '#' + new THREE.Color(c).lerp(new THREE.Color(to), k).getHexString();
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

/** Skull dimensions before the group is scaled to radius 1 (the figure kit's own head is 0.4 of a foot-unit). */
const R = 0.4;
const smooth = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/** The cranium's shape, shared by the head and the hair laid over it (kit/hair.ts, heroes.ts buildHair) so hair always
 *  fits the skull it sits on. Takes and returns a point in skull units (the radius 0.4 head divided by 0.4: the crown at
 *  y 1.14, the face at z 0.94, the sides at x 0.84). The back of the skull is fuller or flatter (skullDepth); a taller
 *  forehead lifts the crown (foreheadH); and below the skull's base, behind the jaw's back edge, the head draws in to
 *  the top of the neck, so the corner of the jaw shows from the side and the head never hangs round like a ball. */
export function craniumShape(spec: Pick<FaceSpec, 'skullDepth' | 'foreheadH' | 'jawAngle'> = {}): (x: number, y: number, z: number) => [number, number, number] {
  const n = (v: number | undefined) => Math.max(-1, Math.min(1, v ?? 0));
  const back = 0.1 * n(spec.skullDepth), brow = n(spec.foreheadH), jawA = n(spec.jawAngle);
  return (x, y, z) => {
    if (z < 0) z *= 1 + back * smooth(-0.75, -0.25, y);
    if (y > 0.3) y += 0.07 * brow * (y - 0.3);
    const k = smooth(-0.38, -0.82, y) * smooth(0.22, -0.32, z) * (0.24 + 0.06 * jawA), zc = -0.1;
    return [x * (1 - k), y, zc + (z - zc) * (1 - k)];
  };
}
/** The cranium as the hair sees it (kit/hair.ts, heroes.ts buildHair): the face's own proportions first, as the head is
 *  built (wider or narrower, longer, longer below the eyes), then craniumShape. Takes and returns skull units like
 *  craniumShape, so hair laid over any head fits it however far its sliders go. */
export function hairSkull(spec: Pick<FaceSpec, 'headW' | 'headL' | 'faceLen' | 'skullDepth' | 'foreheadH' | 'jawAngle'> = {}): (x: number, y: number, z: number) => [number, number, number] {
  const n = (v: number | undefined) => Math.max(-1, Math.min(1, v ?? 0)), cr = craniumShape(spec);
  const w = 1 + 0.07 * n(spec.headW), l = 1 + 0.05 * n(spec.headL), f = 1 + 0.08 * n(spec.faceLen);
  return (x, y, z) => cr(x * w, y * l * (y < 0 ? f : 1), z);
}
/** How far a recipe's forehead lifts the hairline at the brow (radians of elevation on the scalp). */
export const browLift = (spec?: Pick<FaceSpec, 'foreheadH'>): number => 0.12 * Math.max(-1, Math.min(1, spec?.foreheadH ?? 0));
/** A shaped sphere's geometry with its repeated vertices (the seam, the poles) made one and its normals recomputed, so a
 *  smooth-shaded surface shows no line where the sphere was joined. Drops the sphere's own uv, which no shaped part uses. */
export function weld(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  geo.deleteAttribute('normal'); geo.deleteAttribute('uv');
  const w = mergeVertices(geo); w.computeVertexNormals(); return w;
}

export function faceFeatures(spec: FaceSpec, look: FaceLook): THREE.Group {
  const d = look.detail ?? 2, g = new THREE.Group(), n = (v: number | undefined) => Math.max(-1, Math.min(1, v ?? 0));
  const [sw, sh] = ([[16, 12], [20, 14], [24, 18], [32, 24]] as const)[d - 1];
  const skin = look.skin;
  const beardC = spec.beardColor ?? look.hair ?? '#3a2a1a';
  const sph = (r: number, c: string, w: number = sw, h: number = sh): M => new THREE.Mesh(new THREE.SphereGeometry(r, w, h), soft(c));
  const add = <T extends THREE.Object3D>(m: T, x: number, y: number, z: number): T => { m.position.set(x, y, z); g.add(m); return m; };
  /** A capsule from a to b. */
  const seg = (a: THREE.Vector3, b: THREE.Vector3, r: number, c: string): M => {
    const len = a.distanceTo(b), m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, d >= 3 ? 10 : 6), soft(c));
    m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize()); g.add(m); return m;
  };

  const headW = n(spec.headW), headL = n(spec.headL), jaw = n(spec.jaw), chin = n(spec.chin), point = n(spec.chinPoint), cb = n(spec.cheekbones), gaunt = n(spec.gaunt);
  const fem = !!look.fem, jowls = Math.max(0, n(spec.jowls)), ridge = n(spec.browRidge), sunk = Math.max(0, n(spec.sunken));
  // ---- the head: the same sculpted skull the standard figures wear (so hair, ears and hoods fit it), with this face's
  // proportions pushed into it. Everything is one surface: temples, cheekbones over hollow cheeks, a brow over deep-set
  // eyes, the jaw's corner, the chin. Coordinates on the unit sphere; the eyes sit on the midline.
  const kx = 0.84 * (1 + 0.07 * headW), ky = 1.14 * (1 + 0.05 * headL);
  const bump = (x: number, y: number, cx: number, cy: number, wx: number, wy = wx) => Math.exp(-((x - cx) ** 2 / wx + (y - cy) ** 2 / wy));
  const flen = n(spec.faceLen), jawA = n(spec.jawAngle), crShape = craniumShape(spec);
  const skullAt = (ux: number, uy: number, uz: number, puff = 0): THREE.Vector3 => {
    let x = ux, z = uz; const y = uy, fz = Math.max(0, z), low = Math.max(0, -y), ax = Math.abs(ux);
    x *= kx * (fem ? 1 - (0.42 - 0.12 * jaw + 0.05 * gaunt) * low ** 1.7 : 1 - (0.38 - 0.1 * jaw + 0.05 * gaunt) * low ** 1.9);
    z *= 0.94 * (1 - 0.1 * low * low);
    if (z < 0) z *= 1 + 0.05 * smooth(-0.5, -0.15, y);
    const sx = Math.abs(x);
    z += fz * (
      (fem ? 0.07 : 0.1) * (1 + 0.6 * chin + 0.3 * point) * bump(sx, y, 0, -0.84, 0.03 * (1 - 0.55 * Math.max(0, point)), 0.02)
      + 0.05 * bump(sx, y, 0, -0.52, 0.06, 0.03)
      + (fem ? 0.05 : 0.045) * (1 + 0.9 * cb) * bump(sx, y, 0.42, -0.1, 0.02, 0.012)
      - (fem ? 0.035 : 0.06) * (1 + 1.3 * gaunt) * bump(sx, y, 0.36, -0.45, 0.02, 0.03)
      + (fem ? 0.02 : 0.045) * (1 + 0.8 * ridge) * Math.exp(-((y - 0.2) ** 2) / 0.004) * Math.max(0, z - 0.45) * (1 - 0.5 * bump(sx, y, 0, 0.2, 0.01))
      - 0.05 * (1 + 0.3 * sunk) * bump(sx, y, 0.3, 0.03, 0.02, 0.012)
      - 0.03 * bump(sx, y, 0.62, 0.3, 0.02, 0.05)
      + 0.07 * jowls * bump(sx, y, 0.3, -0.7, 0.03, 0.03));
    x += Math.sign(x) * (fem ? 0.02 + 0.025 * Math.max(0, jaw) : 0.05 * (1 + 0.8 * jaw)) * (1 + 0.6 * jawA) * bump(ax, y, 0.62, -0.52, 0.025, 0.02) * smooth(-0.35, 0.05, z);
    // the face's length below the eyes, then the cranium (shared with the hair), then the jaw's underside: a plane from
    // under the chin back to the throat, rising to the jaw's corners, with the round of the skull below it cut away
    let yy = y * ky * (y < 0 ? 1 + 0.08 * flen : 1);
    [x, yy, z] = crShape(x, yy, z);
    const yJaw = -1.05 * (ky / 1.14) * (1 + 0.08 * flen) + 0.27 * smooth(0.86, 0.3, z) + 0.24 * Math.min(1, (x / 0.6) ** 2), fr = smooth(0.06, 0.3, z);
    if (yy < yJaw && fr > 0) { const sft = 0.07 - 0.035 * jawA, dd = yJaw - yy; yy += fr * (dd - sft * (1 - Math.exp(-dd / sft))); }
    return V(x * (R + puff), yy * (R + puff), z * (R + puff));
  };
  const shaped = (sphere: THREE.BufferGeometry, c: string, puff = 0): M => {
    // one vertex wherever the sphere repeats one (its seam down the side of the head, its poles), so the shading runs on
    // across them instead of breaking in a line
    const geo = weld(sphere), p = geo.attributes.position as THREE.BufferAttribute, v = V(0, 0, 0);
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); const q = skullAt(v.x, v.y, v.z, puff); p.setXYZ(i, q.x, q.y, q.z); }
    geo.computeVertexNormals(); const m = new THREE.Mesh(geo, soft(c)); g.add(m); return m;
  };
  const headMesh = shaped(new THREE.SphereGeometry(1, d >= 3 ? 64 : 48, d >= 3 ? 48 : 36).rotateZ(Math.PI / 2), skin);
  const paint = paintFace(spec, { skin, hair: look.hair, eyes: look.eyes, lips: look.lips, fem, dead: look.dead, size: d >= 3 ? 512 : 256 });
  if (paint) { wearFace(headMesh.geometry); const pm = soft('#ffffff').clone(); pm.map = paint; pm.flatShading = false; pm.userData = { ...pm.userData, smooth: true, keepLook: true }; headMesh.material = pm; headMesh.userData.keepLook = true; }
  const hp = headMesh.geometry.attributes.position as THREE.BufferAttribute, frontPts: [number, number, number][] = [];
  for (let i = 0; i < hp.count; i += d >= 3 ? 2 : 1) if (hp.getZ(i) > 0.1) frontPts.push([hp.getX(i), hp.getY(i), hp.getZ(i)]);
  /** The face's depth at (x, y), to seat the features on it. */
  const surf = (x: number, y: number) => { let best = 0, bw = 0; for (const [vx, vy, vz] of frontPts) { const w = 1 / (1e-4 + (vx - x) ** 2 + (vy - y) ** 2) ** 2; best += vz * w; bw += w; } return best / bw; };
  const front = (y: number, x = 0) => surf(x, y);
  const chinY = -0.36 * (1 + 0.05 * headL) * (1 + 0.08 * flen), chinZ = surf(0, chinY), cby = -0.05;

  // ---- the nose: a wedge from the bridge to the tip, turned under to its base, with the nostrils' wings
  const nl = n(spec.noseLen), nwS = n(spec.noseW), hook = n(spec.noseHook), tipK = n(spec.noseTip);
  const nw = (fem ? 0.85 : 1) * (1 + 0.3 * nwS), nk = 1 + 0.22 * nl, nf = (fem ? 0.85 : 1) * (1 + 0.3 * nl), up = hook < 0 ? -0.02 * hook : 0;
  const ny = (y: number) => 0.07 - (0.07 - y) * nk, nz = surf(0, ny(-0.08));
  const nose = new THREE.Mesh(loftGeometry([
    { y: ny(-0.18) + up * 0.5, w: 0.03 * nw, f: 0.012, b: 0.02 }, { y: ny(-0.162) + up, w: 0.036 * nw, f: 0.05 * nf * (1 + 0.25 * tipK), b: 0.02 },
    { y: ny(-0.135) + up, w: 0.034 * nw * (1 + 0.2 * tipK), f: 0.07 * nf * (1 + 0.3 * tipK), b: 0.02 }, { y: ny(-0.06), w: 0.032 * nw, f: 0.042 * nf + 0.03 * Math.max(0, hook), b: 0.02 },
    { y: ny(0.03), w: 0.03 * nw, f: 0.018 + 0.012 * Math.max(0, hook), b: 0.02 }, { y: 0.07, w: 0.03, f: 0.004, b: 0.02 }], 1, { seg: 12, rows: 14 }), soft(skin));
  nose.position.set(0, 0, nz - 0.012); g.add(nose);
  const tip = V(0, ny(-0.135) + up, nz - 0.012 + 0.07 * nf * (1 + 0.3 * tipK));
  if (spec.warts) { const w = tone(skin, '#3a3020', 0.35); add(sph(0.014, w, 8, 6), 0.03, tip.y + 0.04, tip.z - 0.012); add(sph(0.012, w, 8, 6), -0.06, chinY + 0.05, surf(-0.06, chinY + 0.05)); add(sph(0.011, w, 8, 6), 0.2, cby + 0.01, surf(0.2, cby + 0.01)); }

  // ---- the eyes: small and set deep, almond-shaped; a sliver of white, the iris and pupil, a heavy upper lid, a lower
  // lid, the lash line. Then the brow: thick at the nose, tapering out along the ridge.
  const ex = 0.128 * (1 + 0.12 * n(spec.eyeSpace)), ey = 0, ez = surf(ex, 0);
  if (spec.eyepatch) { const sx = spec.eyepatch === 'L' ? 1 : -1; const t = new THREE.Mesh(new THREE.TorusGeometry(0.385, 0.009, 5, 28), soft('#17141a')); t.rotation.set(Math.PI / 2, sx * 0.35, 0); add(t, 0, 0.08, -0.01).scale.set(kx, 1, 0.98); }
  if (spec.spectacles) {
    for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 5, 18), soft(spec.spectacles)), sx * ex, ey, ez + 0.045);
    seg(V(-ex + 0.05, ey + 0.01, ez + 0.045), V(ex - 0.05, ey + 0.01, ez + 0.045), 0.005, spec.spectacles);
    for (const sx of [-1, 1]) seg(V(sx * (ex + 0.05), ey + 0.01, ez + 0.045), V(sx * 0.33, ey + 0.02, 0.02), 0.005, spec.spectacles);
  }

  // ---- the mouth: a bowed upper lip under the philtrum, a fuller lower one, the line between them
  const lw = (fem ? 1.4 : 1.34) * (1 + 0.2 * n(spec.mouthW)), my = -0.262 * (1 + 0.06 * flen), mz = surf(0, my - 0.003), half = 0.058 * lw;
  if (spec.fangs && !look.dead) for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.03, 6), soft('#f2ece0')); f.rotation.x = Math.PI; add(f, sx * 0.024, my - 0.012, mz + 0.004); }

  // ---- hair on the face
  const beard = spec.beard ?? 'none', mo = spec.moustache ?? (beard === 'goatee' || beard === 'full' || beard === 'long' ? 'thick' : 'none');
  /** A full beard: the skull's own surface lifted off the face, cut along a beard line that runs from under the lower lip
   *  out past the mouth's corners and up the cheeks to the sideburns, ragged at its edge, with body at the chin and jaw
   *  and thin over the cheeks. (Stubble is painted on the face: kit/facepaint.ts.) */
  const beardShell = (c: string, chops = false) => {
    const geo = new THREE.SphereGeometry(1, sw * 2, sh * 2, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.58), p = geo.attributes.position as THREE.BufferAttribute, v = V(0, 0, 0), keep: boolean[] = [];
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      const az = Math.abs(Math.atan2(v.x, v.z)), el = Math.asin(Math.max(-1, Math.min(1, v.y)));
      const line = az < 0.32 ? -0.74 : az < 0.62 ? -0.74 + 0.3 * smooth(0.32, 0.62, az) : az < 1.38 ? -0.44 + 0.48 * smooth(0.62, 1.38, az) : 0.04;
      // past the line the shell sinks under the skin, so the beard's edge is where the two surfaces cross: a clean ragged
      // line, not the stair-steps of cut triangles
      const inside = line + 0.03 * Math.sin(az * 29 + el * 7) + 0.02 * Math.sin(az * 11) - el - (chops ? 0.6 * smooth(0.75, 0.45, az) : 0), on = smooth(-0.025, 0.03, inside) * smooth(1.66, 1.5, az);
      keep.push(inside > -0.08 && az < 1.7);
      const body = 0.012 + 0.05 * smooth(-0.5, -0.95, v.y) * smooth(0.9, 0.2, az) + 0.025 * smooth(-0.3, -0.8, v.y);
      const q = skullAt(v.x, v.y, v.z, -0.012 + (body + 0.012 + 0.006 * Math.sin(az * 40 + el * 12)) * on); p.setXYZ(i, q.x, q.y, q.z);
    }
    const src = geo.index!, idx: number[] = []; for (let i = 0; i < src.count; i += 3) { const a = src.getX(i), b = src.getX(i + 1), cc = src.getX(i + 2); if (keep[a] || keep[b] || keep[cc]) idx.push(a, b, cc); }
    geo.setIndex(idx); const m = new THREE.Mesh(weld(geo), soft(c)); g.add(m); return m;
  };
  if (beard === 'goatee') add(sph(0.075, beardC), 0, chinY - 0.02, chinZ - 0.005).scale.set(0.85, 1.5, 0.8);
  if (beard === 'chops') beardShell(beardC, true);
  if (beard === 'full' || beard === 'long') {
    beardShell(beardC);
    add(sph(0.1, beardC), 0, chinY - 0.035, chinZ - 0.05).scale.set(1.15, 0.95, 0.8);
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
