// Weapons: one detailed model per weapon type, varied per character by a small recipe (metal, grip, guard, pommel, length,
// wear), and a few one-of-a-kind weapons the story names. Original low-poly geometry, palette materials.
//
// Every weapon is built around its grip: the origin is where the hand closes, +y runs up the weapon (toward the point of a
// blade, the head of an axe, the top of a staff), and +z is the weapon's edge or face. The figure hangs it on a hand.
// Lengths are feet at medium size; the figure's own scale carries it to other sizes.
import * as THREE from 'three';
import { mat } from '../render/materials';

export type WeaponKind =
  | 'longsword' | 'greatsword' | 'shortsword' | 'rapier' | 'scimitar' | 'dagger' | 'sword-cane'
  | 'handaxe' | 'battleaxe' | 'greataxe' | 'mace' | 'club' | 'quarterstaff' | 'spear' | 'pitchfork' | 'shovel'
  | 'longbow' | 'shortbow' | 'crossbow' | 'torch'
  // the named ones
  | 'sunsword' | 'blood-spear' | 'gulthias-staff' | 'dragon-greatsword' | 'thighbone';

export type Guard = 'bar' | 'curved' | 'ring' | 'basket' | 'disc' | 'wings';
export type Pommel = 'ball' | 'disc' | 'wedge' | 'gem' | 'claw';

/** How one character's weapon differs from the next of its kind. Everything is optional. */
export interface WeaponSpec {
  kind: WeaponKind;
  /** Blade or head metal; the hilt's fittings; the grip's wrap; a gem or inlay. */
  metal?: string; fittings?: string; grip?: string; gem?: string;
  guard?: Guard; pommel?: Pommel;
  /** Longer or shorter than the type's standard (1). */
  length?: number;
  /** Notches and a darkened edge on an old or ill-kept weapon (0 to 1). */
  wear?: number;
  /** A glow along the blade or head (a colour). */
  glow?: string;
}

type M = THREE.Mesh;
const soft = (c: string, emissive?: string): THREE.MeshLambertMaterial => { const m = mat(c, { emissive: emissive ?? '#030303' }); m.userData.smooth = true; return m; };
const hard = (c: string): THREE.MeshLambertMaterial => mat(c);
const tone = (c: string, to: string, k: number) => '#' + new THREE.Color(c).lerp(new THREE.Color(to), k).getHexString();
const at = <T extends THREE.Object3D>(m: T, x: number, y: number, z: number): T => { m.position.set(x, y, z); return m; };
const cyl = (rt: number, rb: number, h: number, c: string, seg = 10): M => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), soft(c));
const ball = (r: number, c: string, w = 12, h = 8): M => new THREE.Mesh(new THREE.SphereGeometry(r, w, h), soft(c));
const box = (w: number, h: number, d: number, c: string): M => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hard(c));
const hash = (i: number, s = 0): number => { const x = Math.sin(i * 127.1 + s * 311.7 + 0.5) * 43758.5453; return x - Math.floor(x); };

/** One cross-section of a blade: height along the blade, half-width edge to edge (z), half-thickness (x), and how far the
 *  section is carried toward the edge (a curve). */
interface Sec { y: number; w: number; t: number; off?: number }

/** A blade lofted through diamond cross-sections: two flats meeting at a spine on each face, an edge front and back. A
 *  fuller is a darker inset strip laid on each flat. Flat-shaded so the bevels read. */
function blade(secs: Sec[], c: string): M {
  const v: number[] = [], idx: number[] = [];
  for (const s of secs) { const o = s.off ?? 0; v.push(0, s.y, o + s.w, s.t, s.y, o, 0, s.y, o - s.w, -s.t, s.y, o); }
  for (let i = 0; i < secs.length - 1; i++) for (let k = 0; k < 4; k++) {
    const a = i * 4 + k, b = i * 4 + (k + 1) % 4, c2 = a + 4, d = b + 4;
    idx.push(a, b, d, a, d, c2);
  }
  const n = (secs.length - 1) * 4; idx.push(n, n + 2, n + 1, n, n + 3, n + 2, 0, 1, 2, 0, 2, 3);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx);
  const flat = g.toNonIndexed(); flat.computeVertexNormals();
  return new THREE.Mesh(flat, hard(c));
}

/** A straight, tapering blade with a point: sections from the guard to the tip, with nicks along the edge when worn. */
function straightBlade(len: number, w: number, t: number, o: { taper?: number; tip?: number; wear?: number; seed?: number; leaf?: number } = {}): Sec[] {
  const secs: Sec[] = [], n = 9, tipAt = 1 - (o.tip ?? 0.14), taper = o.taper ?? 0.3;
  for (let i = 0; i <= n; i++) {
    const u = i / n, y = u * len;
    let ww = u < tipAt ? w * (1 - taper * (u / tipAt)) * (1 + (o.leaf ?? 0) * Math.sin(u / tipAt * Math.PI)) : w * (1 - taper) * (1 - (u - tipAt) / (1 - tipAt));
    if (o.wear && i > 0 && i < n) ww *= 1 - 0.22 * o.wear * hash(i, o.seed ?? 1);
    secs.push({ y, w: Math.max(0.004, ww), t: Math.max(0.003, t * (1 - 0.75 * u)) });
  }
  return secs;
}

function hilt(g: THREE.Group, s: WeaponSpec, o: { grip: number; r: number; guardW: number; guard: Guard; pommel: Pommel }): void {
  const fit = s.fittings ?? '#b08a3a', wrap = s.grip ?? '#3a2a22', guard = s.guard ?? o.guard, pommel = s.pommel ?? o.pommel, top = o.grip * 0.62, bot = -o.grip * 0.38;
  g.add(at(cyl(o.r, o.r * 0.9, o.grip, wrap, 10), 0, (top + bot) / 2, 0));
  for (let i = 0; i < 4; i++) g.add(at(cyl(o.r * 1.12, o.r * 1.12, o.grip * 0.05, tone(wrap, '#000000', 0.35), 10), 0, bot + o.grip * (0.14 + i * 0.24), 0));   // the wrap's turns
  const gw = o.guardW;
  if (guard === 'bar' || guard === 'wings') {
    const b = box(o.r * 1.5, o.r * 1.5, gw * 2, fit); g.add(at(b, 0, top + o.r * 0.6, 0));
    for (const sz of [-1, 1]) { const e = ball(o.r * 1.15, fit); g.add(at(e, 0, top + o.r * 0.6, sz * gw)); }
    if (guard === 'wings') for (const sz of [-1, 1]) { const w = blade([{ y: 0, w: gw * 0.5, t: o.r * 0.5 }, { y: gw * 0.7, w: gw * 0.3, t: o.r * 0.3, off: gw * 0.35 }, { y: gw * 1.1, w: 0.01, t: 0.01, off: gw * 0.75 }], fit); w.rotation.x = sz * 1.9; w.scale.setScalar(0.55); g.add(at(w, 0, top + o.r, sz * gw * 0.5)); }
  } else if (guard === 'curved') {
    for (const sz of [-1, 1]) { const c = new THREE.Mesh(new THREE.TorusGeometry(gw * 0.7, o.r * 0.7, 6, 10, 1.3), soft(fit)); c.rotation.set(0, Math.PI / 2, sz > 0 ? 0.25 : Math.PI - 0.25 - 1.3); g.add(at(c, 0, top + o.r * 0.6 + gw * 0.7, 0)); g.add(at(ball(o.r, fit), 0, top + o.r * 0.6 + gw * 0.35, sz * gw * 0.95)); }
    g.add(at(box(o.r * 1.6, o.r * 1.6, gw * 0.6, fit), 0, top + o.r * 0.6, 0));
  } else if (guard === 'ring' || guard === 'basket') {
    g.add(at(box(o.r * 1.4, o.r * 1.3, gw * 1.6, fit), 0, top + o.r * 0.6, 0));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(gw * 0.55, o.r * 0.45, 6, 16), soft(fit)); ring.rotation.x = Math.PI / 2; g.add(at(ring, 0, top + o.r * 1.4, 0));
    if (guard === 'basket') { const bow = new THREE.Mesh(new THREE.TorusGeometry(o.grip * 0.5, o.r * 0.4, 6, 14, Math.PI), soft(fit)); bow.rotation.set(0, Math.PI / 2, -Math.PI / 2); g.add(at(bow, 0, (top + bot) / 2 + o.r, 0)); const cup = new THREE.Mesh(new THREE.SphereGeometry(gw * 0.62, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), soft(fit)); g.add(at(cup, 0, top + o.r * 1.6, 0)); }
  } else { const dsc = cyl(gw * 0.7, gw * 0.7, o.r * 0.9, fit, 14); g.add(at(dsc, 0, top + o.r * 0.5, 0)); }
  const py = bot - o.r * 0.9;
  if (pommel === 'ball') g.add(at(ball(o.r * 1.7, fit), 0, py, 0));
  else if (pommel === 'disc') { const d = cyl(o.r * 2, o.r * 2, o.r * 1.1, fit, 14); d.rotation.x = Math.PI / 2; g.add(at(d, 0, py - o.r * 0.6, 0)); if (s.gem) { for (const sx of [-1, 1]) g.add(at(ball(o.r * 0.8, s.gem), sx * o.r * 0.5, py - o.r * 0.6, 0)); } }
  else if (pommel === 'wedge') { const w = new THREE.Mesh(new THREE.ConeGeometry(o.r * 1.8, o.r * 3, 6), soft(fit)); g.add(at(w, 0, py - o.r * 0.4, 0)); }
  else if (pommel === 'gem') { g.add(at(cyl(o.r * 1.3, o.r * 1.1, o.r * 1.2, fit, 8), 0, py + o.r * 0.3, 0)); g.add(at(new THREE.Mesh(new THREE.OctahedronGeometry(o.r * 1.6), hard(s.gem ?? '#8a1a2a')), 0, py - o.r * 1.2, 0)); }
  else { g.add(at(ball(o.r * 1.3, fit), 0, py, 0)); for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(o.r * 0.5, o.r * 2.4, 5), soft(fit)); const a = i * 2.094; c.rotation.set(Math.PI + 0.5 * Math.cos(a), 0, 0.5 * Math.sin(a)); g.add(at(c, Math.sin(a) * o.r, py - o.r * 1.4, Math.cos(a) * o.r)); } }
}

function sword(s: WeaponSpec, o: { len: number; w: number; t: number; grip: number; guardW: number; guard: Guard; pommel: Pommel; taper?: number; tip?: number; fuller?: boolean; leaf?: number }): THREE.Group {
  const g = new THREE.Group(), L = o.len * (s.length ?? 1), metal = s.metal ?? '#c9ced6', top = o.grip * 0.62 + 0.05;
  const b = blade(straightBlade(L, o.w, o.t, { taper: o.taper, tip: o.tip, wear: s.wear, leaf: o.leaf, seed: L * 7 }), metal); g.add(at(b, 0, top, 0));
  if (o.fuller !== false) for (const sx of [-1, 1]) g.add(at(box(0.008, L * 0.62, o.w * 0.42, tone(metal, '#20242c', 0.35)), sx * o.t * 0.72, top + L * 0.34, 0));
  if (s.wear) g.add(at(box(o.t * 0.6, L * 0.5, 0.012, tone(metal, '#3a2a20', 0.5)), 0, top + L * 0.4, o.w * 0.78));
  if (s.glow) { const gl = blade(straightBlade(L * 1.02, o.w * 1.5, o.t * 2.2, { taper: o.taper, tip: o.tip }), s.glow); const m = (gl.material as THREE.MeshLambertMaterial).clone(); m.transparent = true; m.opacity = 0.35; m.depthWrite = false; m.emissive = new THREE.Color(s.glow); m.userData = { keepLook: true }; gl.material = m; gl.userData.keepLook = true; g.add(at(gl, 0, top - 0.01, 0)); }
  hilt(g, s, { grip: o.grip, r: 0.045, guardW: o.guardW, guard: o.guard, pommel: o.pommel });
  return g;
}

function axeHead(w: number, h: number, c: string, beard = 0): M {
  // a wedge that flares from the eye to a curved edge
  const sh = new THREE.Shape(); sh.moveTo(0, h * 0.22); sh.lineTo(w * 0.55, h * 0.5); sh.quadraticCurveTo(w * 1.08, 0, w * 0.6, -h * (0.5 + beard)); sh.lineTo(w * 0.35, -h * (0.3 + beard * 0.4)); sh.lineTo(0, -h * 0.22); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.022, bevelSize: 0.03, bevelSegments: 1, curveSegments: 8 }); g.translate(0, 0, -0.025);
  const m = new THREE.Mesh(g, hard(c)); m.rotation.y = -Math.PI / 2; return m;
}

function haft(len: number, r: number, c: string, below: number): THREE.Group {
  const g = new THREE.Group(); g.add(at(cyl(r * 0.92, r, len, c, 8), 0, len / 2 - below, 0));
  for (let i = 0; i < 3; i++) g.add(at(cyl(r * 1.15, r * 1.15, 0.06, tone(c, '#000000', 0.3), 8), 0, -0.22 + i * 0.22, 0));     // the grip's binding
  return g;
}

function bow(s: WeaponSpec, len: number): THREE.Group {
  const g = new THREE.Group(), wood = s.grip ?? '#5a3a22', L = len * (s.length ?? 1), pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 12; i++) { const u = i / 12 - 0.5; pts.push(new THREE.Vector3(0, u * L, 0.34 * L * (0.25 - u * u) + (Math.abs(u) > 0.42 ? 0.05 * L * (Math.abs(u) - 0.42) * 8 : 0))); }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.035, 6), soft(wood)));
  g.add(at(cyl(0.05, 0.05, 0.42, s.fittings ?? '#2a1e18', 8), 0, 0, 0.085 * L));
  const st = cyl(0.006, 0.006, L * 0.98, '#d8d0bc', 4); g.add(at(st, 0, 0, pts[0].z));
  g.children.forEach((c) => { c.position.z -= 0.085 * L; });
  return g;
}

/** Build one weapon. */
export function weapon(s: WeaponSpec): THREE.Group {
  const metal = s.metal ?? '#c9ced6', wood = s.grip ?? '#4a3424', fit = s.fittings ?? '#b08a3a', L = s.length ?? 1;
  const g = new THREE.Group();
  switch (s.kind) {
    case 'longsword': return sword(s, { len: 2.9, w: 0.13, t: 0.03, grip: 0.62, guardW: 0.36, guard: 'bar', pommel: 'disc' });
    case 'greatsword': return sword(s, { len: 4.1, w: 0.17, t: 0.036, grip: 1.15, guardW: 0.52, guard: 'bar', pommel: 'wedge', taper: 0.2 });
    case 'shortsword': return sword(s, { len: 1.9, w: 0.14, t: 0.03, grip: 0.46, guardW: 0.24, guard: 'bar', pommel: 'ball', leaf: 0.12 });
    case 'dagger': return sword(s, { len: 0.95, w: 0.085, t: 0.022, grip: 0.36, guardW: 0.16, guard: 'bar', pommel: 'ball', taper: 0.5, tip: 0.3, fuller: false });
    case 'rapier': return sword(s, { len: 3.2, w: 0.05, t: 0.022, grip: 0.5, guardW: 0.24, guard: 'basket', pommel: 'ball', taper: 0.6, tip: 0.2, fuller: false });
    case 'sword-cane': { const sw = sword({ ...s, guard: 'disc', pommel: s.pommel ?? 'ball' }, { len: 2.7, w: 0.045, t: 0.02, grip: 0.5, guardW: 0.1, guard: 'disc', pommel: 'ball', taper: 0.5, fuller: false }); return sw; }
    case 'sunsword': { const sw = sword({ fittings: '#dcdce4', grip: '#e8e2d0', gem: '#f6d86a', pommel: 'gem', guard: 'wings', ...s, metal: '#fff4c2', glow: s.glow ?? '#ffd866' }, { len: 3.0, w: 0.12, t: 0.035, grip: 0.62, guardW: 0.34, guard: 'wings', pommel: 'gem', taper: 0.15, fuller: false }); return sw; }
    case 'dragon-greatsword': {
      const sw = sword({ fittings: '#c8ccd4', grip: '#2a2c34', guard: 'wings', pommel: 'claw', ...s }, { len: 4.2, w: 0.18, t: 0.038, grip: 1.15, guardW: 0.56, guard: 'wings', pommel: 'claw', taper: 0.18 });
      const head = ball(0.1, s.fittings ?? '#c8ccd4'); head.scale.set(0.8, 1.2, 1.5); sw.add(at(head, 0, 0.84, 0));                                       // a dragon's head where the blade leaves the hilt
      for (const sz of [-1, 1]) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.2, 5), soft(s.fittings ?? '#c8ccd4')); h.rotation.x = sz * 0.9; sw.add(at(h, 0, 0.95, sz * 0.1)); }
      return sw;
    }
    case 'scimitar': {
      const len = 2.5 * L, secs: Sec[] = [], top = 0.42;
      for (let i = 0; i <= 10; i++) { const u = i / 10; secs.push({ y: u * len, w: Math.max(0.004, (0.1 + 0.07 * Math.sin(u * 2.6)) * (u > 0.86 ? (1 - u) / 0.14 : 1) * (s.wear && i % 3 === 1 ? 1 - 0.15 * s.wear : 1)), t: 0.028 * (1 - 0.7 * u), off: -0.42 * u * u * len * 0.3 }); }
      g.add(at(blade(secs, metal), 0, top, 0)); hilt(g, s, { grip: 0.56, r: 0.045, guardW: 0.2, guard: 'curved', pommel: 'ball' });
      const hook = ball(0.06, fit); g.add(at(hook, 0, -0.3, 0.06)); return g;
    }
    case 'handaxe': case 'battleaxe': case 'greataxe': {
      const big = s.kind === 'greataxe', mid = s.kind === 'battleaxe', len = (big ? 4.6 : mid ? 3.1 : 1.6) * L, below = big ? 1.5 : mid ? 0.9 : 0.35, hw = big ? 0.85 : mid ? 0.62 : 0.4, hh = big ? 1.1 : mid ? 0.8 : 0.5;
      g.add(haft(len, big ? 0.06 : 0.05, wood, below));
      const hy = len - below - hh * 0.45; g.add(at(axeHead(hw, hh, metal, mid ? 0.15 : 0), 0, hy, 0.03));
      if (big) { const back = axeHead(hw, hh, metal); back.rotation.y = Math.PI / 2; g.add(at(back, 0, hy, -0.03)); } else g.add(at(box(0.07, hh * 0.3, 0.16, metal), 0, hy, -0.1));
      g.add(at(cyl(0.085, 0.085, hh * 0.5, fit, 8), 0, hy, 0)); g.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 6), soft(metal)), 0, len - below + 0.1, 0));
      if (s.wear) g.add(at(box(0.03, hh * 0.7, 0.02, tone(metal, '#3a2a20', 0.5)), 0, hy - hh * 0.05, hw * 0.92));
      return g;
    }
    case 'mace': case 'thighbone': {
      if (s.kind === 'thighbone') {
        const bone = s.metal ?? '#e8e0cc'; g.add(at(cyl(0.05, 0.06, 1.7 * L, bone, 8), 0, 0.55, 0));
        for (const sx of [-1, 1]) { g.add(at(ball(0.1, bone), sx * 0.07, 1.42, 0), at(ball(0.085, bone), sx * 0.06, -0.3, 0)); }
        if (s.glow) { const h = ball(0.3, s.glow); const m = (h.material as THREE.MeshLambertMaterial).clone(); m.transparent = true; m.opacity = 0.28; m.depthWrite = false; m.emissive = new THREE.Color(s.glow); m.userData = { keepLook: true }; h.material = m; h.userData.keepLook = true; g.add(at(h, 0, 1.4, 0)); }
        return g;
      }
      const len = 2.1 * L; g.add(haft(len, 0.045, wood, 0.4)); const hy = len - 0.4;
      g.add(at(ball(0.17, metal, 12, 10), 0, hy, 0));
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3, f = blade([{ y: -0.2, w: 0.02, t: 0.02 }, { y: -0.05, w: 0.1, t: 0.025 }, { y: 0.12, w: 0.1, t: 0.025 }, { y: 0.26, w: 0.01, t: 0.012 }], metal); f.rotation.y = a; f.position.set(Math.sin(a) * 0.14, hy, Math.cos(a) * 0.14); g.add(f); }
      g.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 6), soft(fit)), 0, hy + 0.27, 0), at(cyl(0.07, 0.07, 0.1, fit, 8), 0, hy - 0.24, 0), at(ball(0.07, fit), 0, -0.44, 0));
      return g;
    }
    case 'club': {
      const pts = [[0.04, -0.35], [0.045, 0], [0.06, 0.6], [0.1, 1.3], [0.12, 1.6], [0.09, 1.78], [0.0, 1.82]].map(([r, y]) => new THREE.Vector2(r, y * L));
      g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 8), hard(wood)));
      for (let i = 0; i < 4; i++) g.add(at(ball(0.035, tone(wood, '#000000', 0.3), 6, 4), Math.sin(i * 1.7) * 0.1, (1.2 + i * 0.13) * L, Math.cos(i * 1.7) * 0.1));
      g.add(at(cyl(0.055, 0.055, 0.5, s.fittings ?? '#2a1e18', 8), 0, -0.05, 0)); return g;
    }
    case 'quarterstaff': case 'gulthias-staff': {
      const len = 6.2 * L, below = 2.6, gul = s.kind === 'gulthias-staff', c = gul ? (s.grip ?? '#1c1a18') : wood, pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 10; i++) { const u = i / 10; pts.push(new THREE.Vector3((gul ? 0.06 : 0.02) * Math.sin(u * 9), u * len - below, (gul ? 0.05 : 0.015) * Math.cos(u * 7))); }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.055, 7), soft(c)));
      if (gul) {
        // a black, thorned branch that splits into a claw of twigs
        for (let i = 0; i < 5; i++) { const a = i * 1.26, t = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.9 + 0.3 * hash(i), 5), soft(c)); t.rotation.set(0.55 * Math.cos(a), 0, -0.55 * Math.sin(a)); g.add(at(t, Math.sin(a) * 0.16, len - below + 0.3, Math.cos(a) * 0.16)); }
        for (let i = 0; i < 7; i++) { const th = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.16, 4), soft(c)); th.rotation.z = (i % 2 ? 1 : -1) * 1.2; g.add(at(th, (i % 2 ? -1 : 1) * 0.08, -1.6 + i * 0.75, 0)); }
        g.add(at(ball(0.07, s.gem ?? '#7a1420'), 0, len - below + 0.25, 0));
      } else {
        for (const y of [-below + 0.1, len - below - 0.1]) g.add(at(cyl(0.07, 0.07, 0.3, fit, 8), 0, y, 0));
        g.add(at(cyl(0.065, 0.065, 0.7, tone(c, '#000000', 0.3), 8), 0, 0, 0));
        if (s.gem) { g.add(at(ball(0.13, s.gem), 0, len - below + 0.2, 0)); for (let i = 0; i < 3; i++) { const cl = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.34, 5), soft(c)); const a = i * 2.094; cl.rotation.set(-0.35 * Math.cos(a), 0, 0.35 * Math.sin(a)); g.add(at(cl, Math.sin(a) * 0.11, len - below + 0.18, Math.cos(a) * 0.11)); } }
      }
      return g;
    }
    case 'spear': case 'blood-spear': {
      const len = 6.6 * L, below = 2.6, bl = s.kind === 'blood-spear';
      g.add(haft(len, 0.045, bl ? (s.grip ?? '#3a1a16') : wood, below));
      const head = blade(straightBlade(bl ? 1.25 : 0.95, bl ? 0.17 : 0.13, 0.035, { taper: 0.1, tip: 0.7, leaf: 0.35 }), bl ? (s.metal ?? '#8a2a22') : metal); g.add(at(head, 0, len - below - 0.05, 0));
      g.add(at(cyl(0.065, 0.055, 0.3, fit, 8), 0, len - below - 0.15, 0), at(new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.25, 6), soft(fit)), 0, -below - 0.1, 0).rotateX(Math.PI));
      if (bl) { for (let i = 0; i < 3; i++) { const f = box(0.02, 0.5, 0.09, i % 2 ? '#2a2420' : '#8a1a1a'); f.rotation.x = 0.5 + i * 0.3; g.add(at(f, 0.03 * (i - 1), len - below - 0.45, 0.12)); } const gl = ball(0.3, '#c8202a'); const m = (gl.material as THREE.MeshLambertMaterial).clone(); m.transparent = true; m.opacity = 0.22; m.depthWrite = false; m.emissive = new THREE.Color('#a01420'); m.userData = { keepLook: true }; gl.material = m; gl.userData.keepLook = true; gl.scale.set(0.6, 2.4, 0.8); g.add(at(gl, 0, len - below + 0.5, 0)); }
      return g;
    }
    case 'pitchfork': {
      const len = 5.4 * L, below = 2.2; g.add(haft(len, 0.045, wood, below)); const y = len - below;
      g.add(at(box(0.05, 0.06, 0.62, metal), 0, y, 0));
      for (const z of [-0.28, 0, 0.28]) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.03, 1.0, 5), soft(metal)); g.add(at(t, 0, y + 0.5, z)); }
      return g;
    }
    case 'shovel': {
      const len = 4.2 * L, below = 1.8; g.add(haft(len, 0.045, wood, below)); const y = len - below;
      const sh = new THREE.Shape(); sh.moveTo(-0.26, 0); sh.lineTo(0.26, 0); sh.lineTo(0.24, 0.5); sh.quadraticCurveTo(0, 0.86, -0.24, 0.5); sh.closePath();
      const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: false }), hard(metal)); m.rotation.y = Math.PI / 2; g.add(at(m, -0.015, y - 0.05, 0));
      g.add(at(box(0.07, 0.07, 0.4, wood), 0, -below, 0)); return g;
    }
    case 'longbow': return bow(s, 5.6);
    case 'shortbow': return bow(s, 3.6);
    case 'crossbow': {
      g.add(at(box(0.11, 0.13, 2.0 * L, wood), 0, 0.02, 0.45)); g.add(at(box(0.09, 0.4, 0.12, wood), 0, -0.2, -0.3));
      const pts: THREE.Vector3[] = []; for (let i = 0; i <= 8; i++) { const u = i / 8 - 0.5; pts.push(new THREE.Vector3(u * 2.0, 0.08, 1.35 - 1.6 * u * u)); }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.035, 6), soft(metal)));
      const st = cyl(0.006, 0.006, 2.0, '#d8d0bc', 4); st.rotation.z = Math.PI / 2; g.add(at(st, 0, 0.09, 0.95));
      g.add(at(cyl(0.012, 0.012, 1.1, '#6a5a44', 5), 0, 0.1, 0.95).rotateX(Math.PI / 2), at(new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 4), hard(metal)), 0, 0.1, 1.55).rotateX(Math.PI / 2));
      g.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 4, 10), soft(fit)), 0, 0.02, 1.5)); return g;
    }
    case 'torch': {
      g.add(at(cyl(0.055, 0.04, 1.7 * L, wood, 8), 0, 0.5, 0), at(cyl(0.09, 0.07, 0.4, '#2a2420', 8), 0, 1.35, 0));
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.6, 7), soft('#ffb040', '#c86a10')); g.add(at(fl, 0, 1.8, 0), at(ball(0.13, '#ffd070'), 0, 1.6, 0)); return g;
    }
  }
  return g;
}

/** A sheath for a sword at the hip or on the back: origin at its mouth, hanging down -y. */
export function scabbard(len: number, c = '#2a2420', fit = '#b08a3a'): THREE.Group {
  const g = new THREE.Group(); const b = box(0.07, len, 0.17, c); g.add(at(b, 0, -len / 2, 0));
  g.add(at(box(0.085, 0.14, 0.19, fit), 0, -0.07, 0), at(box(0.085, 0.2, 0.15, fit), 0, -len + 0.08, 0)); return g;
}
