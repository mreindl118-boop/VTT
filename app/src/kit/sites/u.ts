// Props and figures for the Ruins of Berez (U), Baba Lysaga's creeping hut (U3) and Van Richten's tower (V).
// Registered into the shared kit with Object.assign(PROPS_V1, {...}) / Object.assign(CREATURES, {...}); every material
// comes from mat() so the world-space grain applies. All in feet, origin at the floor centre, +z = plan south.
import * as THREE from 'three';
import { PROPS_V1 } from '../props';
import { CREATURES, humanoid } from '../creatures';
import { mat } from '../../render/materials';
import { surfaceFor } from '../surfaces';
import { PALETTE } from '../palette';

type Dims = Record<string, number>;

// ---------------------------------------------------------------- colours: weathered, drawn from the palette's families
const STONE = '#7a766f', STONE_L = '#8a857c', STONE_DK = '#4d4845', RUBBLE = '#6d6860', MILDEW = '#2f312c', SLIME = '#22281f';
const THATCH = '#6b5d3a', THATCH_DK = '#55492e', MOSS = '#4d5a3f';
const BARK = '#5a4632', BARK_RED = '#6a4a34', BARK_DK = '#3b2d24', MUD = '#3a3328';
const WOOD = PALETTE.wood, WOOD_DK = PALETTE.woodDark, ROT = '#4b3a2c', ROT_L = '#5e4a36', IRON = PALETTE.iron, RUST = '#5a3a2a';
const BONE = '#cfc4a8', BONE_DK = '#a89c80', HOLLOW = '#1a1714';
const REED = '#7a6f45', REED_G = '#55603a', CATTAIL = '#4a3828';
const PURPLE = '#4f3a5c', PURPLE_DK = '#3d2c48', GOLD = '#b89a54', BRASS = '#a8853f', MUDSPLASH = '#4a3b2c', SIGN = '#a8956f';
const CLAY = '#8a6a4a', CLAY_DK = '#6b5038', SLATE = '#3d3a44', GLOW = '#7fbf6a';
const TAPESTRY = ['#5b3b46', '#3a4a62', '#4a5a3a', '#8a6e3e'];
surfaceFor([STONE, STONE_L, STONE_DK], 'stone');
surfaceFor([RUBBLE, MILDEW], 'rubble');
surfaceFor([SLIME, MUD, MUDSPLASH], 'dirt');
surfaceFor([THATCH, THATCH_DK, REED], 'thatch');
surfaceFor([MOSS], 'grass');
surfaceFor([REED_G], 'foliage');
surfaceFor([BARK, BARK_RED, BARK_DK, CATTAIL], 'bark');
surfaceFor([ROT, ROT_L, PURPLE, PURPLE_DK, GOLD, SIGN], 'wood');
surfaceFor([IRON, RUST, BRASS], 'metal');
surfaceFor([CLAY, CLAY_DK], 'dirt');
surfaceFor([SLATE], 'shingle');
surfaceFor(TAPESTRY, 'cloth');

// ---------------------------------------------------------------- helpers
const box = (w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color)); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); return m;
};
const cyl = (rt: number, rb: number, h: number, color: string, x = 0, y = 0, z = 0, seg = 8) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color)); m.position.set(x, y, z); return m;
};
const ico = (r: number, color: string, x = 0, y = 0, z = 0, detail = 0) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), mat(color)); m.position.set(x, y, z); return m; };
const cone = (r: number, h: number, color: string, x = 0, y = 0, z = 0, seg = 6) => { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(color)); m.position.set(x, y, z); return m; };
const grp = (...m: THREE.Object3D[]) => { const g = new THREE.Group(); if (m.length) g.add(...m); return g; };
/** Deterministic noise in [0, 1). */
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** A tapered round member from a to b (a root, a rail, a leg), radius r0 at a and r1 at b. */
function limb(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, color: string, seg = 6): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(b, a), L = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, L, seg), mat(color));
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
  return m;
}
/** A squared timber from a to b. */
function beam(a: THREE.Vector3, b: THREE.Vector3, t: number, color: string): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(b, a), L = dir.length();
  const m = new THREE.Mesh(new THREE.BoxGeometry(t, L, t), mat(color));
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
  return m;
}
/** Architecture: the section plane slices it like a wall instead of hiding it whole. */
function shell<T extends THREE.Object3D>(o: T): T { o.traverse((c) => { if ((c as THREE.Mesh).isMesh) c.userData.role = 'roof'; }); return o; }
/** The torso group of a kit humanoid (to hang a hood, a lantern or a belly on it). */
const upper = (g: THREE.Group) => g.children.find((c) => c.type === 'Group') as THREE.Group | undefined;

// ================================================================= BEREZ: the drowned village
/** A peasant cottage gone to ruin in the mire: rubble walls broken to uneven heights and black with mildew at the
 *  foot, one gable still standing, the roof fallen in to a broken ridge, a few rafters and a sagging patch of thatch. */
function ruinedCottage(d: Dims): THREE.Group {
  const w = d.w ?? 22, dd = d.d ?? 16, h = d.h ?? 9, v = d.v ?? 0.5, T = 1.2, seed = v * 1000;
  const g = grp(box(w + 1, 1.0, dd + 1, STONE_DK, 0, 0.5, 0));
  const runs = [[-w / 2, dd / 2, w / 2, dd / 2, 1], [w / 2, -dd / 2, -w / 2, -dd / 2, 0], [-w / 2, -dd / 2, -w / 2, dd / 2, 0], [w / 2, dd / 2, w / 2, -dd / 2, 0]];
  runs.forEach(([x0, z0, x1, z1, front], wi) => {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(3, Math.round(L / 2.6)), ry = -Math.atan2(z1 - z0, x1 - x0);
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n, r = hash(seed + wi * 17 + k * 3.3), corner = k === 0 || k === n - 1;
      if (front && k === Math.floor(n * 0.35)) continue;                                  // the doorway
      if (!corner && r < 0.12) continue;                                                   // a breach
      const hh = corner ? h * (0.78 + 0.22 * r) : h * (0.3 + 0.62 * r * r + 0.08);
      const mx = x0 + (x1 - x0) * (t0 + t1) / 2, mz = z0 + (z1 - z0) * (t0 + t1) / 2, seg = L / n + 0.05;
      const win = !front && !corner && hh > 6 && hash(seed + k * 9.1 + wi) < 0.35;
      if (win) { g.add(box(seg, 3, T, RUBBLE, mx, 1.5, mz, 0, ry), box(seg, hh - 5.5, T, RUBBLE, mx, 5.5 + (hh - 5.5) / 2, mz, 0, ry)); }
      else g.add(box(seg, hh, T, RUBBLE, mx, hh / 2, mz, 0, ry));
      g.add(box(seg + 0.02, Math.min(hh, 2.2), T + 0.14, MILDEW, mx, Math.min(hh, 2.2) / 2, mz, 0, ry));   // the black mildew at the foot
      if (r > 0.75 && hh > 4) g.add(box(seg * 0.6, 0.5, T + 0.1, MOSS, mx, hh + 0.1, mz, 0, ry));                // moss on the broken top
    }
  });
  // one gable end still stands on its side wall, the other has fallen
  const rise = dd * 0.5, side = v < 0.5 ? -1 : 1;
  const gab = new THREE.Shape([new THREE.Vector2(-dd / 2, 0), new THREE.Vector2(dd / 2, 0), new THREE.Vector2(dd * 0.08, rise * 0.85), new THREE.Vector2(-dd * 0.12, rise * 0.7)]);
  const gg = new THREE.ExtrudeGeometry(gab, { depth: T, bevelEnabled: false }); gg.translate(0, 0, -T / 2); gg.rotateY(Math.PI / 2);
  const gm = new THREE.Mesh(gg, mat(RUBBLE)); gm.position.set(side * w / 2, h * 0.92, 0); g.add(gm);
  // the broken ridge sagging into the house, rafters still pegged on the standing end, a patch of thatch hanging on
  const rx = side * w * 0.22;
  g.add(beam(V(side * w / 2, h + rise * 0.8, 0), V(-side * w * 0.12, h * 0.45, 0.6), 0.6, ROT));
  for (let i = 0; i < 4; i++) {
    const x = side * (w / 2 - 1.2 - i * 2.4), zs = i % 2 ? 1 : -1;
    if (hash(seed + i * 5) < 0.25) continue;
    g.add(beam(V(x, h, zs * dd / 2), V(x - side * (i * 0.6), h + rise * (0.8 - i * 0.12), zs * 0.4), 0.4, ROT_L));
  }
  const slope = Math.hypot(dd / 2 + 1, rise), ang = Math.atan2(rise, dd / 2 + 1);
  const patch = box(w * 0.42, 0.7, slope * 0.75, THATCH_DK, rx, h + rise * 0.42, -dd * 0.26, -ang * 0.85, 0, side * 0.08);
  g.add(patch, box(w * 0.2, 0.75, slope * 0.35, MOSS, rx + side * 1.5, h + rise * 0.5, -dd * 0.2, -ang * 0.85, 0, side * 0.08));
  // fallen stone and timber inside
  for (let i = 0; i < 6; i++) g.add(ico(0.6 + hash(seed + i) * 0.7, i % 2 ? STONE_DK : RUBBLE, (hash(seed + i * 2) - 0.5) * w * 0.6, 0.6, (hash(seed + i * 3) - 0.5) * dd * 0.5));
  g.add(beam(V(-w * 0.25, 0.4, -dd * 0.2), V(w * 0.15, 1.6, dd * 0.15), 0.5, ROT));
  return g;
}

/** A fragment of the mansion's front: stone wall standing with its empty arched windows, the top broken in steps. */
function ruinArches(d: Dims): THREE.Group {
  const L = d.len ?? 28, h = d.h ?? 16, n = d.n ?? 3, T = 2.2;
  const s = new THREE.Shape(); s.moveTo(-L / 2, 0); s.lineTo(L / 2, 0);
  const steps = 8;
  for (let k = 0; k <= steps; k++) {
    const x = L / 2 - (k * L) / steps, y = Math.max(12.8, h * (0.62 + 0.38 * hash(k * 3.1 + L)));
    s.lineTo(x, y); if (k < steps) s.lineTo(x - (L / steps) * 0.45, y);
  }
  s.lineTo(-L / 2, 0);
  for (let i = 0; i < n; i++) {
    const cx = -L / 2 + ((i + 0.5) * L) / n, ww = Math.min(4.2, (L / n) * 0.5);
    const hole = new THREE.Path(); hole.moveTo(cx - ww / 2, 3.6); hole.lineTo(cx + ww / 2, 3.6); hole.lineTo(cx + ww / 2, 8.8);
    hole.absarc(cx, 8.8, ww / 2, 0, Math.PI, false); hole.lineTo(cx - ww / 2, 3.6); s.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false }); geo.translate(0, 0, -T / 2);
  const g = grp(new THREE.Mesh(geo, mat(STONE)), box(L + 0.8, 1.2, T + 0.8, STONE_DK, 0, 0.6, 0), box(L + 0.1, 2.4, T + 0.12, MILDEW, 0, 1.2, 0));
  for (let i = 0; i < n; i++) { const cx = -L / 2 + ((i + 0.5) * L) / n; g.add(box(Math.min(4.2, (L / n) * 0.5) + 1, 0.4, T + 0.5, STONE_DK, cx, 3.4, 0)); }
  for (let i = 0; i < 3; i++) g.add(box(0.8 + hash(i + L) * 1.4, 2 + hash(i * 7 + L) * 5, 0.12, SLIME, -L / 2 + 2 + hash(i * 3 + L) * (L - 4), 5 + hash(i * 5) * 4, T / 2 + 0.06));
  return g;
}

/** Fallen stone and rotten timber heaped where a wall came down (a church steeple's, with its spire, if `spire`). */
function rubbleHeap(d: Dims): THREE.Group {
  const r = d.r ?? 10, h = d.h ?? 5, g = grp(), n = Math.round(10 + r * 1.3);
  for (let i = 0; i < n; i++) {
    const a = hash(i * 1.7 + r) * Math.PI * 2, q = Math.sqrt(hash(i * 2.3 + r)) * r, y = Math.max(0.3, h * (1 - q / r) * 0.85);
    const s = ico(0.7 + hash(i * 3.1) * 1.5, [STONE, STONE_DK, RUBBLE][i % 3], Math.cos(a) * q, y, Math.sin(a) * q); s.scale.y = 0.7; g.add(s);
  }
  const mound = ico(r * 0.75, RUBBLE, 0, 0, 0, 1); mound.scale.set(1, (h * 0.9) / (r * 0.75), 1); g.add(mound);
  for (let i = 0; i < 4; i++) { const a = hash(i * 9 + r) * Math.PI * 2; g.add(beam(V(Math.cos(a) * r * 0.9, 0.3, Math.sin(a) * r * 0.9), V(-Math.cos(a) * r * 0.2, h * 0.8, -Math.sin(a) * r * 0.2), 0.55, ROT)); }
  if (d.spire) {
    const sp = cone(4.2, 17, SLATE, -r * 0.2, 2.6, r * 0.35, 4); sp.rotation.set(0.15, 0.6, Math.PI / 2.15); g.add(sp);
    g.add(box(7, 6, 7, STONE, r * 0.25, 2.4, -r * 0.2, 0.2, 0.4, 0.35));
  }
  return g;
}

/** The goat pen: a ring of crude posts and rails with no gate, a human skull on top of every post. */
function skullFence(d: Dims): THREE.Group {
  const r = d.r ?? 80, n = d.n ?? 50, g = grp();
  const P: THREE.Vector3[] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r, tilt = (hash(k) - 0.5) * 0.14, ph = 6.2 + hash(k * 3) * 0.8;
    const post = box(0.6, ph, 0.6, WOOD_DK, x, ph / 2, z, 0, -a, tilt); g.add(post); P.push(V(x, ph, z));
    const sk = ico(0.55, BONE, x, ph + 0.42, z, 1); sk.scale.set(1, 0.92, 1.12); g.add(sk);
    const ox = Math.cos(a) * 0.48, oz = Math.sin(a) * 0.48, tx = -Math.sin(a) * 0.2, tz = Math.cos(a) * 0.2;
    g.add(box(0.22, 0.22, 0.22, HOLLOW, x + ox + tx, ph + 0.5, z + oz + tz), box(0.22, 0.22, 0.22, HOLLOW, x + ox - tx, ph + 0.5, z + oz - tz), box(0.3, 0.12, 0.3, BONE_DK, x + ox, ph + 0.12, z + oz));
  }
  for (let k = 0; k < n; k++) {
    const a = P[k], b = P[(k + 1) % n];
    for (const [ya, yb] of [[2.2, 2.4 + (hash(k) - 0.5) * 0.6], [4.6, 4.4 + (hash(k * 5) - 0.5) * 0.8]]) g.add(limb(V(a.x, ya, a.z), V(b.x, yb, b.z), 0.17, 0.15, k % 3 ? WOOD : ROT, 5));
  }
  return g;
}

/** Brambles run wild: a dark tangle of thorny stems. */
function thornThicket(d: Dims): THREE.Group {
  const s = d.s ?? 1.5, g = grp();
  for (let i = 0; i < 5; i++) { const b = ico((1.3 + hash(i + s) * 0.8) * s, i % 2 ? '#2f3a2a' : '#3a3d2c', (hash(i * 3 + s) - 0.5) * 2.6 * s, (0.9 + hash(i * 5) * 0.6) * s, (hash(i * 7 + s) - 0.5) * 2.6 * s, 0); b.scale.y = 0.75; g.add(b); }
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + s; g.add(beam(V(Math.cos(a) * 0.8 * s, 0.3, Math.sin(a) * 0.8 * s), V(Math.cos(a) * 2.8 * s, (1.6 + hash(i) * 1.4) * s, Math.sin(a) * 2.8 * s), 0.12, BARK_DK)); }
  return g;
}

/** A garden sculpture of a youth or a maiden in grey stone on a moulded plinth; some have toppled into the weeds. */
function gardenStatue(d: Dims): THREE.Group {
  const v = d.v ?? 0, fig = humanoid({ skin: STONE_L, cloth: STONE_L, trim: STONE_L, hair: STONE_L, skirt: v % 2 === 1, scale: 1.08 });
  const up = upper(fig); if (up) up.rotation.y = (v % 3 - 1) * 0.35;
  const g = grp(box(3.4, 0.5, 3.4, STONE_DK, 0, 0.25, 0), box(2.8, 2.2, 2.8, STONE, 0, 1.6, 0), box(3.2, 0.35, 3.2, STONE_DK, 0, 2.85, 0), box(1.2, 0.8, 0.1, MOSS, 0.4, 1.2, 1.42));
  if (v % 3 === 2) { fig.rotation.set(0, 0.4, Math.PI / 2); fig.position.set(-3.2, 0.9, 1.5); } else fig.position.y = 3;
  g.add(fig);
  return g;
}

/** A carved stone bench, moss in its joints. */
function stoneBench(): THREE.Group {
  return grp(box(1.2, 1.5, 1.6, STONE_DK, -2.3, 0.75, 0), box(1.2, 1.5, 1.6, STONE_DK, 2.3, 0.75, 0), box(6.4, 0.45, 2, STONE, 0, 1.72, 0), box(2.4, 0.1, 1.2, MOSS, -1, 1.96, 0.2));
}

/** A run of rusted iron railing: two rails, pickets with spear finials, gaps where they have rusted away, leaning. */
function ironFence(d: Dims): THREE.Group {
  const L = d.len ?? 20, inner = grp();
  inner.add(box(L, 0.18, 0.18, RUST, 0, 0.9, 0), box(L, 0.18, 0.18, IRON, 0, 3.6, 0));
  const n = Math.max(2, Math.round(L / 1.1));
  for (let i = 0; i <= n; i++) {
    if (hash(i * 3.7 + L) < 0.18 && i % n) continue;
    const x = -L / 2 + (i * L) / n, hh = 4.2 + (i % 5 === 0 ? 0.6 : 0);
    inner.add(box(0.14, hh, 0.14, i % 3 ? IRON : RUST, x, hh / 2, 0), cone(0.18, 0.5, IRON, x, hh + 0.25, 0, 4));
  }
  inner.rotation.x = ((d.lean ?? 0) * Math.PI) / 180;
  return grp(inner);
}

/** The church's old bell, fallen with the steeple and lying half sunk in the marsh. */
function sunkenBell(): THREE.Group {
  const pts = [V(0.2, 0, 0), V(2.1, 0, 0), V(2.0, 0.4, 0), V(1.6, 1.4, 0), V(1.3, 2.8, 0), V(1.2, 3.4, 0), V(0.5, 3.8, 0), V(0.05, 3.85, 0)].map((p) => new THREE.Vector2(p.x, p.y));
  const bell = new THREE.Mesh(new THREE.LatheGeometry(pts, 10), mat(IRON)); bell.rotation.set(0, 0, 1.15); bell.position.set(1.2, 0.9, 0);
  return grp(bell, box(5, 0.8, 0.8, ROT, -1.6, 0.6, 0.8, 0, 0.5, 0.2), box(0.8, 0.5, 0.8, RUST, -0.2, 1.9, 0));
}

/** The rotted pulpit: a little eight-sided drum with a tilted lectern, its boards split. */
function rottenPulpit(): THREE.Group {
  const g = grp(cyl(1.6, 1.9, 3.6, ROT, 0, 1.8, 0, 8), cyl(1.8, 1.8, 0.3, ROT_L, 0, 3.7, 0, 8), box(2.2, 0.2, 1.6, ROT_L, 0.6, 4.3, 0, 0, 0, -0.5));
  g.add(box(0.6, 3, 0.2, ROT_L, -1.7, 1.5, 0.6, 0.3, 0, 0.4), box(2, 0.2, 0.6, ROT, 2.4, 0.15, -0.8, 0, 0.6, 0));
  return g;
}

/** Marina's monument: a life-sized stone girl kneeling on a weathered base, a carved rose held to her breast. */
function marinaStatue(): THREE.Group {
  const S = STONE_L, g = grp(box(3.6, 0.6, 3.6, STONE_DK, 0, 0.3, 0), box(3, 1.2, 3, STONE, 0, 1.2, 0), box(2.2, 0.5, 0.1, MILDEW, 0, 1.2, 1.52));
  const fig = grp();
  const skirt = cyl(0.9, 1.35, 1.5, S, 0, 0.75, 0.1, 9); skirt.scale.z = 1.25; fig.add(skirt);
  for (const x of [-0.45, 0.45]) fig.add(box(0.5, 0.4, 1.6, S, x, 0.2, -0.9));                // the shins folded under her
  const torso = cyl(0.55, 0.72, 1.9, S, 0, 2.35, 0.05, 8); torso.rotation.x = 0.12; fig.add(torso);
  fig.add(cyl(0.18, 0.2, 0.35, S, 0, 3.45, 0.2), ico(0.42, S, 0, 3.85, 0.25, 1));
  const kerchief = ico(0.47, S, 0, 3.95, 0.15, 1); kerchief.scale.set(1, 0.85, 1.1); fig.add(kerchief);
  for (const sx of [-1, 1]) { fig.add(limb(V(sx * 0.62, 3.05, 0.1), V(sx * 0.5, 2.5, 0.55), 0.18, 0.15, S), limb(V(sx * 0.5, 2.5, 0.55), V(sx * 0.12, 2.75, 0.75), 0.15, 0.13, S)); }
  fig.add(ico(0.26, STONE, 0, 2.85, 0.85, 1), box(0.08, 0.9, 0.08, STONE, 0, 2.35, 0.82));
  fig.position.y = 1.8; g.add(fig);
  g.add(box(0.9, 0.06, 0.6, MOSS, -0.6, 1.83, 0.9), box(0.5, 0.6, 0.06, MOSS, 1.2, 1.0, 1.53));
  return g;
}

/** A menhir of the old folk: a rough, tapering slab 15 to 18 ft tall, mossy at the foot, perhaps leaning,
 *  with a worn animal glyph on the face turned to the circle's middle (local +x). */
function menhir(d: Dims): THREE.Group {
  const h = d.h ?? 16, geo = new THREE.BoxGeometry(2.6, h, 3.6, 1, 5, 1); geo.translate(0, h / 2, 0);
  const pv = geo.attributes.position;
  for (let i = 0; i < pv.count; i++) {
    const y = pv.getY(i), t = y / h, k = 1 - t * 0.32, j = (hash(i * 1.3 + h) - 0.5) * 0.5;
    pv.setXYZ(i, pv.getX(i) * k + j, y - (t > 0.99 ? hash(i + h) * 1.4 : 0), pv.getZ(i) * k + j * 0.6);
  }
  geo.computeVertexNormals();
  const stone = new THREE.Mesh(geo, mat('#6f6e66'));
  const inner = grp(stone, box(2.9, 1.6, 3.9, MOSS, 0, 0.8, 0), box(0.12, 3, 1.6, MOSS, 1.25, 4, 0.6));
  if (d.glyph) inner.add(box(0.14, 2.2, 1.6, '#4f4e48', 1.28, h * 0.48, 0), box(0.16, 0.5, 0.9, '#3d3c37', 1.32, h * 0.52, 0.1));
  inner.rotation.z = -((d.lean ?? 0) * Math.PI) / 180;
  return grp(inner, box(4.5, 0.6, 5, MUD, 0, 0.1, 0));
}

/** A clump of reeds and bulrushes standing in the wet. */
function reeds(d: Dims): THREE.Group {
  const s = d.s ?? 1, seed = s * 97, g = grp();
  const tuft = ico(1.0 * s, REED_G, 0, 0.2, 0); tuft.scale.set(1.3, 0.35, 1.3); g.add(tuft);
  const n = 9 + Math.round(hash(seed) * 5);
  for (let i = 0; i < n; i++) {
    const a = hash(seed + i * 1.9) * Math.PI * 2, r = hash(seed + i * 2.7) * 1.2 * s, h = (3 + hash(seed + i * 3.3) * 3.4) * s;
    const st = box(0.12, h, 0.12, i % 3 ? REED : REED_G, Math.cos(a) * r, h / 2, Math.sin(a) * r, (hash(i + seed) - 0.5) * 0.35, 0, (hash(i * 5 + seed) - 0.5) * 0.35);
    g.add(st);
    if (i % 3 === 0) { const head = cyl(0.17, 0.17, 0.8 * s, CATTAIL, 0, 0, 0, 5); head.position.copy(st.position).add(V(0, h / 2 - 0.3 * s, 0)); head.rotation.copy(st.rotation); g.add(head); }
  }
  return g;
}

// ================================================================= U3: Baba Lysaga's hut, its stump, roots and skull
/** The stump of the giant tree under the hut: a flared trunk with bark ridges, the hut's floor on its cut top. */
function hutStump(d: Dims): THREE.Group {
  const r = d.r ?? 9, h = d.h ?? 10, g = grp(cyl(r * 0.92, r * 1.18, h, BARK, 0, h / 2, 0, 11));
  for (let i = 0; i < 11; i++) { const a = (i / 11) * Math.PI * 2 + 0.2; g.add(box(0.7, h * (0.7 + hash(i) * 0.3), 1.6, BARK_DK, Math.cos(a) * r * 1.02, h * 0.4, Math.sin(a) * r * 1.02, 0, -a, 0)); }
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + 0.7; g.add(box(3.5, 1.2, 1.8, MOSS, Math.cos(a) * r * 1.05, 1.0 + hash(i * 3) * 4, Math.sin(a) * r * 1.05, 0, -a + Math.PI / 2, 0)); }
  const mud = ico(r * 1.35, MUD, 0, -0.2, 0, 1); mud.scale.set(1, 0.08, 1); g.add(mud);
  return g;
}

/** One of the giant roots: it leaves the stump high (local origin, `rise` up), heaves up to a knee and claws down into
 *  the mire `len` ft out along local +x, tapering, knotted at its joints; `band` puts an iron shackle on it. */
function giantRoot(d: Dims): THREE.Group {
  const L = d.len ?? 24, rise = d.rise ?? 8.5, r = d.r ?? 1.7, sd = d.seed ?? 0, g = grp();
  const P0 = V(0, rise, 0), P1 = V(L * 0.18, rise + 5 + hash(sd) * 2, (hash(sd * 3) - 0.5) * 4), P2 = V(L * 0.6, rise + 1.5 + hash(sd * 5) * 2, (hash(sd * 7) - 0.5) * 6), P3 = V(L, -0.8, (hash(sd * 11) - 0.5) * 3);
  const curve = new THREE.CubicBezierCurve3(P0, P1, P2, P3), pts = curve.getPoints(10);
  for (let i = 0; i < pts.length - 1; i++) {
    const r0 = r * (1 - (i / 10) * 0.66), r1 = r * (1 - ((i + 1) / 10) * 0.66);
    g.add(limb(pts[i], pts[i + 1], r0, r1, i % 2 ? BARK : BARK_RED, 7));
    if (i % 2 === 1) g.add(ico(r1 * 1.18, BARK_DK, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z));
  }
  if (d.band) { const p = curve.getPoint(0.42), t = curve.getTangent(0.42); const ring = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.95, r * 0.95, 1.1, 10, 1, true), mat(IRON)); ring.position.copy(p); ring.quaternion.setFromUnitVectors(V(0, 1, 0), t); g.add(ring); }
  const m = ico(r * 1.6, MUD, P3.x, -0.3, P3.z); m.scale.y = 0.3; g.add(m);
  return g;
}

/** A hill giant's skull, hollowed and upside down, hovering `y` ft up: the bowl of the cranium open to the sky,
 *  the face at the +x end with its sockets, the upper teeth pointing up at the rim. */
function giantSkull(d: Dims): THREE.Group {
  const y = d.y ?? 6, r = 2.5, g = grp();
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 7, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(BONE)); bowl.scale.set(1.3, 0.95, 0.9); bowl.position.y = y; g.add(bowl);
  const hollow = new THREE.Mesh(new THREE.CircleGeometry(r * 0.94, 12), mat(HOLLOW)); hollow.rotation.x = -Math.PI / 2; hollow.scale.set(1.3, 0.9, 1); hollow.position.y = y - 0.25; g.add(hollow);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.18, 4, 14), mat(BONE_DK)); rim.rotation.x = Math.PI / 2; rim.scale.set(1.3, 0.9, 1); rim.position.y = y + 0.02; g.add(rim);
  const fx = r * 1.22;
  g.add(box(1.4, 2.3, 3.4, BONE, fx, y - 1.0, 0), box(0.4, 0.95, 1.0, HOLLOW, fx + 0.55, y - 1.45, 0.85), box(0.4, 0.95, 1.0, HOLLOW, fx + 0.55, y - 1.45, -0.85), box(0.4, 0.7, 0.5, HOLLOW, fx + 0.6, y - 0.45, 0));
  g.add(box(1.0, 0.5, 3.0, BONE_DK, fx - 0.2, y - 2.25, 0));   // the brow ridge, now underneath
  for (let i = 0; i < 6; i++) g.add(box(0.45, 0.55, 0.38, BONE, fx + 0.2, y + 0.35, -1.1 + i * 0.44));
  for (let i = 0; i < 3; i++) g.add(box(0.06, 0.9 + hash(i) * 0.8, 0.06, BONE_DK, -1 + i * 1.3, y - 1.6, 1.9));   // cracks
  return g;
}

/** The little landing under the hut's doorway: loose boards on two struts. */
function plankLanding(d: Dims): THREE.Group {
  const w = d.w ?? 6, dd = d.d ?? 2.2, g = grp();
  for (let i = 0; i < Math.round(w / 0.9); i++) g.add(box(dd, 0.25, 0.8, i % 2 ? ROT : ROT_L, dd / 2 - 0.2, -0.05 + (hash(i) - 0.5) * 0.1, -w / 2 + 0.45 + i * 0.9, 0, (hash(i * 3) - 0.5) * 0.08, 0));
  for (const z of [-w / 2 + 0.6, w / 2 - 0.6]) g.add(beam(V(dd - 0.4, -0.2, z), V(-0.2, -3.2, z), 0.4, ROT));
  return g;
}

/** A hut's gently sloping thatch roof over a w × d plan, eaves at `y`: two slopes, a bound ridge, ragged eaves,
 *  moss, and plank gables. Sliced by the section plane like a roof. */
function thatchRoof(d: Dims): THREE.Group {
  const w = d.w ?? 16, dd = d.d ?? 16, y = d.y ?? 8, rise = d.rise ?? 3.5, oh = 1.4, g = grp();
  const half = dd / 2 + oh, slope = Math.hypot(half, rise), ang = Math.atan2(rise, half);
  for (const sz of [-1, 1]) {
    const s = box(w + oh * 2, 1.2, slope, THATCH, 0, y + rise / 2 + 0.3, (sz * half) / 2, sz * ang, 0, 0); g.add(s);
    for (let i = 0; i < 9; i++) { const x = -w / 2 - oh + 0.9 + i * ((w + oh * 2 - 1.8) / 8); g.add(box(1.4 + hash(i + sz) * 1.4, 0.7 + hash(i * 3 + sz) * 0.8, 0.6, THATCH_DK, x, y - 0.1, sz * (half - 0.1))); }
    g.add(box(w * 0.3, 0.3, slope * 0.35, MOSS, (hash(sz + 4) - 0.5) * w * 0.4, y + rise * 0.55 + 0.95, sz * half * 0.45, sz * ang, 0, 0));
  }
  const ridge = cyl(0.9, 0.9, w + oh * 2 + 0.4, THATCH_DK, 0, y + rise + 0.75, 0, 6); ridge.rotation.z = Math.PI / 2; g.add(ridge);
  for (const sx of [-1, 1]) {
    const tri = new THREE.Shape([new THREE.Vector2(-dd / 2, 0), new THREE.Vector2(dd / 2, 0), new THREE.Vector2(0, rise)]);
    const tg = new THREE.ExtrudeGeometry(tri, { depth: 0.3, bevelEnabled: false }); tg.rotateY(Math.PI / 2);
    const tm = new THREE.Mesh(tg, mat(ROT)); tm.position.set(sx * (w / 2) - 0.15, y, 0); g.add(tm);
  }
  return shell(g);
}

/** An iron cage hung from the eaves by a chain, `drop` ft below `y`, packed with ravens. */
function ravenCage(d: Dims): THREE.Group {
  const y = d.y ?? 8, drop = d.drop ?? 2.5, top = y - drop, hgt = 2.6, r = 1.1, g = grp();
  for (let i = 0; i < Math.round(drop / 0.5); i++) g.add(box(0.14, 0.42, 0.14, IRON, 0, y - 0.25 - i * 0.5, 0, 0, i % 2 ? Math.PI / 2 : 0, 0));
  g.add(cone(r * 1.05, 0.7, IRON, 0, top - 0.1, 0, 10), cyl(r, r, 0.15, RUST, 0, top - hgt, 0, 10));
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.add(box(0.1, hgt, 0.1, IRON, Math.cos(a) * r, top - hgt / 2, Math.sin(a) * r)); }
  g.add(cyl(r, r, 0.12, IRON, 0, top - hgt * 0.5, 0, 10));
  for (let i = 0; i < 6; i++) {
    const a = hash(i * 2.1) * Math.PI * 2, q = 0.55, by = top - hgt + 0.4 + (i % 3) * 0.7;
    g.add(box(0.5, 0.3, 0.26, '#141218', Math.cos(a) * q, by, Math.sin(a) * q, 0, -a, 0.3), cone(0.07, 0.25, '#2b2420', Math.cos(a) * (q + 0.3), by + 0.05, Math.sin(a) * (q + 0.3), 4));
  }
  return g;
}

function cot(): THREE.Group {
  return grp(box(2.8, 1.1, 6, ROT, 0, 0.55, 0), box(2.5, 0.4, 5.6, '#8a7a4a', 0, 1.25, 0.1), box(1.6, 0.3, 1, '#6b5d4a', 0, 1.55, -2.2), box(2.6, 0.12, 2.6, '#4a4238', 0, 1.5, 1.2));
}
function stool(): THREE.Group {
  const g = grp(cyl(0.75, 0.75, 0.25, WOOD, 0, 1.7, 0, 8));
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; g.add(beam(V(Math.cos(a) * 0.45, 1.6, Math.sin(a) * 0.45), V(Math.cos(a) * 0.8, 0, Math.sin(a) * 0.8), 0.18, WOOD_DK)); }
  return g;
}
/** The ghastly crib in the middle of the hut, crooked bars round a small, very still, angelic child (an illusion),
 *  green light leaking up between the boards beneath it. */
function ghastlyCrib(): THREE.Group {
  const g = grp(box(2.6, 0.3, 4, ROT, 0, 1.0, 0), box(2.3, 0.3, 3.7, '#6b5d4a', 0, 1.3, 0));
  for (const [x, z] of [[-1.2, -1.9], [1.2, -1.9], [-1.2, 1.9], [1.2, 1.9]]) g.add(box(0.25, 3.2, 0.25, WOOD_DK, x, 1.6, z));
  for (let i = 0; i < 7; i++) { const z = -1.6 + i * 0.53; for (const x of [-1.2, 1.2]) g.add(box(0.1, 1.5, 0.1, WOOD_DK, x, 2.0, z, (hash(i + x) - 0.5) * 0.25, 0, 0)); }
  for (const x of [-1.2, 1.2]) g.add(box(0.18, 0.18, 4, WOOD_DK, x, 2.75, 0, 0, 0, (x > 0 ? 1 : -1) * 0.06));
  const child = grp(cyl(0.4, 0.5, 0.9, '#d9cfb5', 0, 1.9, 0.3, 7), ico(0.34, '#e9cdb0', 0, 2.65, 0.3, 1), ico(0.36, '#d9b36a', 0, 2.78, 0.22, 1));
  g.add(child);
  for (let i = 0; i < 5; i++) g.add(box(0.12, 0.05, 1.2 + hash(i) * 1.6, GLOW, -1.6 + i * 0.8, 0.04, (hash(i * 3) - 0.5) * 1.2));
  return g;
}
/** An iron tub on claw feet, its inside crusted dark with blood, stains on the boards round it. */
function bloodTub(): THREE.Group {
  const g = grp(box(3.6, 2.2, 2.4, IRON, 0, 1.45, 0));
  for (const x of [-1.8, 1.8]) g.add(cyl(1.2, 1.2, 2.2, IRON, x, 1.45, 0, 10));
  g.add(box(3.4, 0.1, 2.0, PALETTE.blood, 0, 2.5, 0), cyl(1.0, 1.0, 0.1, PALETTE.blood, -1.7, 2.5, 0, 10), cyl(1.0, 1.0, 0.1, PALETTE.blood, 1.7, 2.5, 0, 10));
  for (const [x, z] of [[-2, -0.8], [2, -0.8], [-2, 0.8], [2, 0.8]]) g.add(ico(0.3, IRON, x, 0.25, z));
  g.add(box(1.6, 0.04, 1.0, '#3a1218', 0.8, 0.03, 1.6, 0, 0.4, 0), box(0.9, 0.04, 0.7, '#3a1218', -1.6, 0.03, -1.5, 0, 1.1, 0));
  return g;
}

/** The creeping hut as the Berez map shows it: the stump, eight splayed roots, the plank hut ten feet up with its
 *  open doorway east (+x), the thatch, the raven cages and the floating skull. */
function creepingHut(): THREE.Group {
  const g = grp(hutStump({ r: 9, h: 10 }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3 + (hash(i) - 0.5) * 0.4, rt = giantRoot({ len: 16 + hash(i * 3) * 8, rise: 8.5, r: 1.8, seed: i, band: i === 1 ? 1 : 0 });
    rt.position.set(Math.cos(a) * 5, 0, Math.sin(a) * 5); rt.rotation.y = -a; g.add(rt);
  }
  const body = grp(box(16, 0.6, 16, ROT, 0, 10.3, 0));
  const walls: [number, number, number, number][] = [[-7.6, -7.6, 7.6, -7.6], [7.6, 7.6, -7.6, 7.6], [-7.6, 7.6, -7.6, -7.6], [7.6, -7.6, 7.6, 7.6]];
  walls.forEach(([x0, z0, x1, z1], wi) => {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L / 1.25), ry = -Math.atan2(z1 - z0, x1 - x0);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      if (wi === 3 && Math.abs(z) < 2.2) continue;   // the doorway
      const hh = 7.6 + hash(k + wi * 9) * 0.8; body.add(box(L / n + 0.02, hh, 0.45, k % 3 ? ROT : ROT_L, x, 10.6 + hh / 2, z, 0, ry, (hash(k * 3 + wi) - 0.5) * 0.04));
    }
  });
  for (const [x, z] of [[-7.6, -7.6], [7.6, -7.6], [-7.6, 7.6], [7.6, 7.6]]) body.add(box(0.8, 8.4, 0.8, WOOD_DK, x, 14.6, z));
  body.add(thatchRoof({ w: 16, d: 16, y: 18.4, rise: 3.6 }), plankLanding({ w: 6, d: 2.2 }).translateX(7.8).translateY(10.6));
  for (const z of [-3.2, 3.2]) body.add(ravenCage({ y: 18.4, drop: 2.6 }).translateX(8.6).translateZ(z));
  g.add(body, giantSkull({ y: 6.5 }).translateX(13.5));
  return g;
}

// ================================================================= V: Khazan's tower
/** The stone plinth course round the tower's foot: a ring of eight blocks, inradius r. */
function towerPlinth(d: Dims): THREE.Group {
  const r = d.r ?? 12.6, h = d.h ?? 1.6, side = 2 * (r + 0.7) * Math.tan(Math.PI / 8) + 0.6, g = grp();
  for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; g.add(box(side, h, 1.6, STONE_DK, Math.cos(a) * (r + 0.7), h / 2, Math.sin(a) * (r + 0.7), 0, -a + Math.PI / 2, 0), box(side, 0.4, 2, MOSS, Math.cos(a) * (r + 0.9), 0.15, Math.sin(a) * (r + 0.9), 0, -a + Math.PI / 2, 0)); }
  return shell(g);
}

/** A mossy griffon in stone, sitting up on its haunches facing +x, wings folded. */
function griffon(): THREE.Group {
  const S = STONE, g = grp();
  const body = ico(1.3, S, 0, 1.6, 0, 1); body.scale.set(1.5, 0.9, 0.8); g.add(body);
  g.add(ico(0.95, S, -1.3, 1.2, 0, 1), box(0.45, 2.2, 0.45, S, 1.0, 1.1, 0.45, 0, 0, 0.15), box(0.45, 2.2, 0.45, S, 1.0, 1.1, -0.45, 0, 0, 0.15));
  const chest = ico(0.9, S, 1.0, 2.5, 0, 1); chest.scale.set(1, 1.2, 0.85); g.add(chest);
  g.add(ico(0.6, S, 1.6, 3.6, 0, 1), cone(0.3, 0.9, STONE_DK, 2.3, 3.45, 0, 5).rotateZ(-Math.PI / 2 - 0.4));
  for (const sz of [-1, 1]) { const w = box(2.6, 1.8, 0.25, S, -0.3, 2.6, sz * 0.72, sz * 0.25, 0, 0.35); g.add(w); }
  const tail = cone(0.25, 1.8, S, -2.2, 0.6, 0, 5); tail.rotation.z = 1.9; g.add(tail);
  g.add(box(1.4, 0.15, 1.0, MOSS, 0, 2.4, 0), box(0.8, 0.12, 0.6, MOSS, 1.6, 3.95, 0));
  return g;
}

/** A buttress at one of the tower's diagonals: a stepped stone pier running out `len` ft along local +x from the wall,
 *  a sloped weathering at its setback and top, a griffon perched on the summit. */
function towerButtress(d: Dims): THREE.Group {
  const h = d.h ?? 36, L = d.len ?? 5.5, w = d.w ?? 3.2, h1 = h * 0.58, g = grp();
  g.add(box(L + 1.2, 1.6, w + 1, STONE_DK, L / 2 + 0.3, 0.8, 0), box(L, h1, w, STONE, L / 2, h1 / 2, 0), box(L * 0.7, h - h1, w * 0.92, STONE, (L * 0.7) / 2, h1 + (h - h1) / 2, 0));
  const wedge = (x0: number, x1: number, y: number, rise: number, ww: number) => {
    const s = new THREE.Shape([new THREE.Vector2(x0, 0), new THREE.Vector2(x1, 0), new THREE.Vector2(x0, rise)]);
    const geo = new THREE.ExtrudeGeometry(s, { depth: ww, bevelEnabled: false }); geo.translate(0, 0, -ww / 2);
    const m = new THREE.Mesh(geo, mat(STONE_DK)); m.position.y = y; return m;
  };
  g.add(wedge(L * 0.7, L, h1, 1.8, w), wedge(0, L * 0.7 + 0.2, h, 1.2, w * 0.92), box(L + 0.3, 0.5, w + 0.3, STONE_DK, L / 2, h1 * 0.45, 0));
  g.add(box(0.2, h1 * 0.6, w * 0.5, MOSS, L + 0.02, h1 * 0.3, 0.2), box(L * 0.5, 0.15, w * 0.6, MOSS, L * 0.35, h + 0.1, 0));
  const gr = griffon(); gr.position.set(L * 0.28, h + 0.4, 0); gr.rotation.y = 0; g.add(gr);
  return shell(g);
}

function stoneStep(d: Dims): THREE.Group { const w = d.w ?? 6, dd = d.d ?? 3; return grp(box(w, 0.5, dd, STONE_DK, 0, 0.25, 0), box(w - 0.8, 0.5, dd * 0.55, STONE, 0, 0.7, -dd * 0.2)); }
/** The lintel over the iron door, the name carved along it (a dark incised band on the outer face, +z). */
function khazanLintel(d: Dims): THREE.Group { const w = d.w ?? 6.4, y = d.y ?? 7.2; return shell(grp(box(w, 1.5, 1.4, STONE, 0, y + 0.75, 0), box(w * 0.66, 0.45, 0.1, HOLLOW, 0, y + 0.75, 0.72), box(1.6, 7.2, 1.0, STONE_DK, -w / 2 + 0.8, 3.6, 0.2), box(1.6, 7.2, 1.0, STONE_DK, w / 2 - 0.8, 3.6, 0.2))); }

/** The lift's iron chains at the corners of its 5-ft shaft, `h` ft tall; with `pit`, the square pit and its four
 *  pulleys below; with `top`, the pulleys hang from the rafters instead. */
function liftChains(d: Dims): THREE.Group {
  const h = d.h ?? 20, g = grp(), c = 2.05;
  for (const [x, z] of [[-c, -c], [c, -c], [-c, c], [c, c]]) {
    const y0 = d.pit ? 0.9 : d.top ? 1.0 : 0;
    for (let y = y0; y < h - 0.1; y += 0.55) g.add(box(0.16, 0.5, 0.32, IRON, x, y + 0.25, z, 0, Math.round(y / 0.55) % 2 ? Math.PI / 2 : 0, 0));
    if (d.pit || d.top) { const py = d.pit ? 0.6 : h - 0.4; const p = cyl(0.55, 0.55, 0.3, IRON, x, py, z, 10); p.rotation.x = Math.PI / 2; g.add(p, box(0.2, 0.2, 1.2, RUST, x, py, z)); }
  }
  if (d.pit) g.add(box(5, 0.06, 5, HOLLOW, 0, 0.03, 0), box(5.4, 0.12, 0.3, STONE_DK, 0, 0.06, -2.7), box(5.4, 0.12, 0.3, STONE_DK, 0, 0.06, 2.7), box(0.3, 0.12, 5.4, STONE_DK, -2.7, 0.06, 0), box(0.3, 0.12, 5.4, STONE_DK, 2.7, 0.06, 0));
  return g;
}
/** The lift's 5-ft wooden platform, iron rings at its corners for the chains. */
function liftPlatform(): THREE.Group {
  const g = grp(); for (let i = 0; i < 5; i++) g.add(box(0.95, 0.3, 4.8, i % 2 ? WOOD : WOOD_DK, -2 + i, 0.25, 0));
  g.add(box(4.9, 0.3, 0.4, IRON, 0, 0.45, -2.3), box(4.9, 0.3, 0.4, IRON, 0, 0.45, 2.3));
  for (const [x, z] of [[-2.05, -2.05], [2.05, -2.05], [-2.05, 2.05], [2.05, 2.05]]) g.add(cyl(0.25, 0.25, 0.5, IRON, x, 0.6, z, 6));
  return g;
}
/** Broken boards and fallen stones littering a floor. */
function debris(d: Dims): THREE.Group {
  const s = d.s ?? 1, g = grp();
  for (let i = 0; i < 6; i++) g.add(box((2 + hash(i + s) * 2.5) * s, 0.2, 0.6, i % 2 ? ROT : ROT_L, (hash(i * 3 + s) - 0.5) * 4 * s, 0.12 + i * 0.03, (hash(i * 5 + s) - 0.5) * 4 * s, 0, hash(i * 7) * Math.PI, (hash(i) - 0.5) * 0.15));
  for (let i = 0; i < (d.stone ? 8 : 4); i++) g.add(ico((0.3 + hash(i * 11) * 0.5) * s, i % 2 ? STONE_DK : STONE, (hash(i * 13 + s) - 0.5) * 4 * s, 0.25, (hash(i * 17 + s) - 0.5) * 4 * s));
  return g;
}
/** Ezmerelda's wagon: a barrel-topped caravan in fresh purple paint under a crust of mud, gold-trimmed wheels, a brass
 *  lantern at each corner, red drapes in tombstone-shaped windows, the padlocked back door (-x) with its sign. */
function ezmereldaWagon(): THREE.Group {
  const g = grp(box(11.4, 0.5, 5.8, WOOD_DK, 0, 2.1, 0), box(10.6, 3.6, 5.4, PURPLE, 0, 4.15, 0));
  const top = new THREE.Mesh(new THREE.CylinderGeometry(2.85, 2.85, 10.8, 14, 1, false, 0, Math.PI), mat(PURPLE_DK)); top.rotation.z = Math.PI / 2; top.position.y = 5.95; g.add(top);
  g.add(box(10.8, 0.25, 5.6, GOLD, 0, 2.45, 0), box(10.8, 0.25, 5.7, GOLD, 0, 5.95, 0));
  for (const [x, r] of [[-3.4, 1.65], [3.4, 1.3]] as const) for (const z of [-3.0, 3.0]) {
    const wh = cyl(r, r, 0.35, WOOD_DK, x, r, z, 12); wh.rotation.x = Math.PI / 2; g.add(wh);
    const tr = cyl(r + 0.1, r + 0.1, 0.18, GOLD, x, r, z + Math.sign(z) * 0.12, 12); tr.rotation.x = Math.PI / 2; g.add(tr);
    for (let k = 0; k < 3; k++) g.add(box(0.15, r * 1.9, 0.15, GOLD, x, r, z + Math.sign(z) * 0.22, 0, 0, (k * Math.PI) / 3));
  }
  for (const sz of [-1, 1]) {
    g.add(box(1.7, 1.6, 0.12, PALETTE.wine, 0.6, 4.1, sz * 2.74), cyl(0.85, 0.85, 0.12, PALETTE.wine, 0.6, 4.9, sz * 2.74, 10).rotateX(Math.PI / 2), box(2.1, 0.25, 0.25, GOLD, 0.6, 3.2, sz * 2.8));
    for (let i = 0; i < 6; i++) g.add(box(0.8 + hash(i + sz) * 1.6, 0.6 + hash(i * 3 + sz) * 1.2, 0.1, MUDSPLASH, -4.6 + i * 1.8, 2.8 + hash(i * 5) * 0.8, sz * 2.75));
  }
  for (const [x, z] of [[-5.5, -2.9], [5.5, -2.9], [-5.5, 2.9], [5.5, 2.9]]) g.add(box(0.12, 0.12, 0.6, IRON, x, 6.1, z * 0.92), box(0.5, 0.75, 0.5, BRASS, x, 5.55, z), box(0.6, 0.15, 0.6, IRON, x, 5.98, z));
  g.add(box(0.2, 3.2, 2.2, PURPLE_DK, -5.35, 4.0, 0), box(0.25, 0.4, 0.3, IRON, -5.5, 3.9, 0.7), box(0.1, 0.9, 1.7, SIGN, -5.52, 4.9, 0), box(1.1, 0.25, 2, WOOD_DK, -6.0, 1.6, 0));
  g.add(box(1.4, 0.3, 4.8, WOOD_DK, 5.9, 3.6, 0), box(0.3, 1.4, 4.8, WOOD_DK, 6.5, 4.3, 0), box(1.2, 0.2, 4.2, WOOD, 6.3, 2.3, 0));
  for (const z of [-1.6, 1.6]) g.add(beam(V(5.6, 2.0, z), V(12.5, 0.2, z * 1.3), 0.3, WOOD_DK));
  return g;
}
/** A bay of the rickety scaffolding: a plank deck at local y = 0 (`len` along x, `w` deep, its outer side toward -z),
 *  posts reaching `down` ft to the ground and `up` ft above, a railing and diagonal braces, boards missing; a ladder
 *  down at the -x end (`ladder`) and one up at the +x end (`ladderUp` ft). Sliced like the walls. */
function scaffold(d: Dims): THREE.Group {
  const L = d.len ?? 16, w = d.w ?? 4.5, down = d.down ?? 20, up = d.up ?? 3.5, g = grp();
  for (let i = 0; i < Math.round(L / 0.95); i++) { if (hash(i * 3.3 + L) < 0.13) continue; g.add(box(0.85, 0.22, w, i % 3 ? ROT_L : ROT, -L / 2 + 0.5 + i * 0.95, 0, (hash(i) - 0.5) * 0.3, 0, (hash(i * 7) - 0.5) * 0.06, (hash(i * 5) - 0.5) * 0.05)); }
  g.add(box(L, 0.5, 0.5, ROT, 0, -0.4, -w / 2 + 0.2), box(L, 0.5, 0.5, ROT, 0, -0.4, w / 2 - 0.2));
  const n = Math.max(2, Math.round(L / 6)), xs = Array.from({ length: n + 1 }, (_, i) => -L / 2 + (i * L) / n);
  for (const x of xs) for (const z of [-w / 2, w / 2]) g.add(box(0.5, down + up, 0.5, i3(x) ? ROT : WOOD_DK, x, (up - down) / 2, z, (hash(x + z) - 0.5) * 0.03, 0, (hash(x * 3) - 0.5) * 0.03));
  g.add(box(L, 0.3, 0.3, ROT_L, 0, up, -w / 2), box(L, 0.25, 0.25, ROT, 0, up * 0.5, -w / 2));
  for (let i = 0; i < n; i++) for (let lv = 0; lv < Math.floor(down / 10); lv++) {
    const y0 = -down + lv * 10;
    if (hash(i * 5 + lv) < 0.25) continue;
    g.add(beam(V(xs[i], y0 + 1, -w / 2 - 0.3), V(xs[i + 1], y0 + 9, -w / 2 - 0.3), 0.32, ROT));
    g.add(box(xs[i + 1] - xs[i], 0.35, 0.35, ROT_L, (xs[i] + xs[i + 1]) / 2, y0 + 9.5, -w / 2 - 0.3));
  }
  const ladder = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => {
    for (const s of [-0.75, 0.75]) g.add(beam(V(x0, y0, z0 + s), V(x1, y1, z1 + s), 0.25, WOOD_DK));
    const n2 = Math.round(Math.abs(y1 - y0)); for (let k = 1; k < n2; k++) { const t = k / n2; if (hash(k + x0) < 0.08) continue; g.add(box(0.18, 0.18, 1.6, ROT_L, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t)); }
  };
  if (d.ladder) ladder(-L / 2 + 1.2, -down, -w / 2 - 1.6, -L / 2 + 1.2, 0.2, -w / 2 + 0.6);
  if (d.ladderUp) ladder(L / 2 - 1.2, 0.2, 0, L / 2 + 1.0, d.ladderUp + 0.4, w / 2 - 0.2);
  return shell(g);
}
const i3 = (x: number) => Math.round(x) % 3 === 0;
/** Slimy black mildew spreading over a wall face (a patch in the local x-y plane). */
function mildew(d: Dims): THREE.Group {
  const w = d.w ?? 5, h = d.h ?? 9, g = grp();
  for (let i = 0; i < 6; i++) g.add(box(w * (0.3 + hash(i + w) * 0.5), h * (0.3 + hash(i * 3 + h) * 0.6), 0.08, i % 2 ? SLIME : MILDEW, (hash(i * 5) - 0.5) * w * 0.6, h * (0.25 + hash(i * 7) * 0.45), 0.04 * i));
  return g;
}
/** The corbel course under the fourth floor's overhang: stepped stones round a regular octagon of inradius r, at y. */
function corbelRing(d: Dims): THREE.Group {
  const r = d.r ?? 13, n = d.n ?? 24, y = d.y ?? -2, g = grp(), side = 2 * (r + 0.4) * Math.tan(Math.PI / 8) + 0.6;
  for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; g.add(box(side, 1.1, 1.4, STONE_DK, Math.cos(a) * (r + 0.4), y + 1.6, Math.sin(a) * (r + 0.4), 0, -a + Math.PI / 2, 0)); }
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + Math.PI / n, rr = r / Math.cos(((a % (Math.PI / 4)) - Math.PI / 8));
    g.add(box(1.3, 0.9, 1.0, STONE, Math.cos(a) * (rr - 0.3), y + 0.7, Math.sin(a) * (rr - 0.3), 0, -a, 0), box(0.8, 0.8, 0.9, STONE_DK, Math.cos(a) * (rr - 0.6), y - 0.1, Math.sin(a) * (rr - 0.6), 0, -a, 0));
  }
  return shell(g);
}
/** Old rafters bowing under the roof: four beams crossing the room at y, sagging at the middle, a king post and the
 *  pulley block of the lift. */
function rafters(d: Dims): THREE.Group {
  const r = d.r ?? 12, y = d.y ?? 18, g = grp();
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 4, cx = Math.cos(a) * r, cz = Math.sin(a) * r;
    g.add(beam(V(-cx, y + 0.6, -cz), V(0, y - 0.6, 0), 0.8, WOOD_DK), beam(V(0, y - 0.6, 0), V(cx, y + 0.6, cz), 0.8, WOOD_DK));
  }
  g.add(box(0.9, 7, 0.9, WOOD_DK, 0, y + 3, 0), box(5.4, 0.7, 5.4, WOOD_DK, 0, y - 1.1, 0));
  return g;
}
/** A window box under one of the fourth floor's windows, dead stalks in it, the shutters hanging broken; the wall is
 *  the local x axis and outside is -z. */
function windowBox(d: Dims): THREE.Group {
  const w = d.w ?? 4.6, y = d.y ?? 2.4, g = grp(box(w, 1.1, 1.4, WOOD_DK, 0, y, -0.8), box(w - 0.4, 0.2, 1.1, MUD, 0, y + 0.55, -0.8));
  for (const sx of [-1, 1]) g.add(beam(V(sx * (w / 2 - 0.4), y - 0.5, -1.4), V(sx * (w / 2 - 0.4), y - 1.8, -0.1), 0.25, WOOD_DK));
  for (let i = 0; i < 6; i++) g.add(box(0.08, 0.8 + hash(i) * 1.0, 0.08, BARK_DK, -w / 2 + 0.6 + i * 0.7, y + 1.0, -0.8, (hash(i * 3) - 0.5) * 0.6, 0, (hash(i * 5) - 0.5) * 0.6));
  g.add(box(1.3, 3.6, 0.15, ROT_L, -w / 2 - 0.4, y + 2.8, -0.5, 0, 0.5, 0.1), box(1.3, 3.0, 0.15, ROT, w / 2 + 0.5, y + 2.4, -0.7, 0, -0.9, -0.35));
  return shell(g);
}
function woodpile(): THREE.Group {
  const g = grp();
  for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - row; i++) { const l = cyl(0.42, 0.42, 3, i % 2 ? BARK : BARK_DK, 0, 0.42 + row * 0.75, -1.3 + i * 0.86 + row * 0.43, 7); l.rotation.x = Math.PI / 2; l.rotation.z = Math.PI / 2; g.add(l); }
  return g;
}
/** A bright tapestry on an iron rod (the colours of each differ by `v`). */
function brightTapestry(d: Dims): THREE.Group {
  const w = d.w ?? 5, c = TAPESTRY[(d.v ?? 0) % TAPESTRY.length], c2 = TAPESTRY[((d.v ?? 0) + 2) % TAPESTRY.length];
  return grp(box(w + 0.4, 0.2, 0.2, IRON, 0, 8.4, 0), box(w, 5.6, 0.14, c, 0, 5.5, 0.1), box(w - 0.8, 0.6, 0.12, c2, 0, 4.0, 0.18), box(w - 0.8, 0.5, 0.12, GOLD, 0, 7.6, 0.18), box(1.4, 1.6, 0.12, c2, 0, 5.6, 0.18));
}

// ---------------------------------------------------------------- things that look like objects until they move
/** A clay golem standing stiff as a statue: a heavy, crudely modelled figure of fired clay, nine feet tall. */
function clayGolem(): THREE.Group {
  const g = humanoid({ skin: CLAY, cloth: CLAY_DK, trim: CLAY_DK, scale: 1.58, hunch: 0.08 });
  const up = upper(g); if (up) up.add(box(1.2, 0.3, 0.1, '#4a3828', 0, 2.4, 0.5), box(0.1, 1.2, 0.1, '#4a3828', 0.3, 1.6, 0.62));
  return grp(g);
}
/** A suit of plate standing on its rack (animated armour, inert until called). */
function standingArmor(): THREE.Group {
  const g = humanoid({ skin: IRON, cloth: '#55575d', trim: IRON, helm: 'cap', weapon: 'sword' });
  return grp(box(2.2, 0.35, 2.2, WOOD_DK, 0, 0.18, 0), g);
}
/** One of Baba Lysaga's scarecrows on its pole: sackcloth and straw stuffed with raven feathers, a battered hat. */
function marshScarecrow(): THREE.Group {
  const fig = humanoid({ skin: '#a08a5a', cloth: '#5a4a3a', trim: '#3b352c', hair: '#8a7a4a', helm: 'cap', hunch: 0.15 });
  const up = upper(fig); if (up) { up.add(box(5.4, 0.3, 0.3, WOOD_DK, 0, 2.0, -0.3)); for (let i = 0; i < 5; i++) up.add(box(0.35, 0.12, 0.6, '#141218', -0.5 + i * 0.25, 1.2 + (i % 2) * 0.4, 0.45, 0.4, 0, 0.3)); }
  fig.position.y = 0.6;
  return grp(box(0.3, 9, 0.3, WOOD_DK, 0, 4.5, -0.45), fig, ico(0.9, MUD, 0, 0, 0));
}

// ---------------------------------------------------------------- creatures
function goat(d: Dims = {}): THREE.Group {
  const s = d.scale ?? 1, c = hash(s * 7 + (d.v ?? 0)) < 0.5 ? '#9a8f7a' : '#6b5d4a', dk = '#3b352c', g = grp();
  const body = ico(1.1 * s, c, 0, 2.1 * s, 0, 1); body.scale.set(1.45, 0.85, 0.8); g.add(body);
  for (const [x, z] of [[-1.0, -0.38], [1.0, -0.38], [-1.0, 0.38], [1.0, 0.38]]) g.add(box(0.2 * s, 1.5 * s, 0.2 * s, dk, x * s, 0.75 * s, z * s));
  g.add(box(0.9 * s, 0.6 * s, 0.55 * s, c, 1.75 * s, 2.75 * s, 0, 0, 0, -0.5), cone(0.12 * s, 0.6 * s, dk, 1.9 * s, 2.25 * s, 0, 4).rotateZ(Math.PI));
  for (const z of [-0.18, 0.18]) { const h = cone(0.1 * s, 0.9 * s, BONE_DK, 1.5 * s, 3.4 * s, z * s, 4); h.rotation.z = 0.9; g.add(h); }
  g.add(cone(0.15 * s, 0.4 * s, c, -1.6 * s, 2.5 * s, 0, 4).rotateZ(0.8));
  return g;
}
function babaLysaga(d: Dims = {}): THREE.Group {
  const s = d.scale ?? 1, g = humanoid({ skin: '#8a9a7c', cloth: '#2f3a2a', trim: '#55603a', hair: '#7a7a7a', hunch: 0.55, robe: true, cloak: true, weapon: 'staff', scale: 0.95 * s });
  const up = upper(g);
  if (up) { const hood = cone(0.62 * s, 1.3 * s, '#2a3326', 0, 3.05 * s, -0.12 * s, 7); up.add(hood, box(0.14 * s, 0.14 * s, 0.4 * s, '#8a9a7c', 0, 2.6 * s, 0.5 * s)); }
  return g;
}
function murielVinshaw(d: Dims = {}): THREE.Group {
  const s = d.scale ?? 1, g = humanoid({ skin: '#d9b899', cloth: '#4a4238', trim: '#3b352c', hair: '#5a4632', skirt: true, scale: 0.97 * s });
  const up = upper(g);
  if (up) up.add(box(0.06 * s, 0.5 * s, 0.06 * s, IRON, -0.88 * s, -0.25 * s, 0.25 * s), box(0.42 * s, 0.6 * s, 0.42 * s, RUST, -0.88 * s, -0.75 * s, 0.25 * s), box(0.3 * s, 0.4 * s, 0.3 * s, PALETTE.amber, -0.88 * s, -0.75 * s, 0.25 * s),
    box(0.08 * s, 0.9 * s, 0.14 * s, PALETTE.mist1, 0.9 * s, 0.25 * s, 0.35 * s));
  return g;
}
function giantSnake(d: Dims = {}): THREE.Group {
  const s = d.scale ?? 1, g = grp();
  for (let i = 0; i < 16; i++) { const a = i * 0.75, r = (1.6 - i * 0.07) * s; g.add(ico((0.42 - i * 0.012) * s, i % 3 ? '#4a5232' : '#2f3a22', Math.cos(a) * r, 0.35 * s + i * 0.04 * s, Math.sin(a) * r)); }
  g.add(limb(V(0.3 * s, 0.9 * s, 0), V(0.7 * s, 2.3 * s, 0.2 * s), 0.3 * s, 0.24 * s, '#4a5232'), box(0.7 * s, 0.35 * s, 0.5 * s, '#4a5232', 0.95 * s, 2.45 * s, 0.25 * s), box(0.4 * s, 0.04 * s, 0.06 * s, PALETTE.wine, 1.4 * s, 2.4 * s, 0.25 * s));
  return g;
}
function bloatedCorpse(d: Dims = {}): THREE.Group {
  const s = d.scale ?? 1, g = humanoid({ skin: '#9aa38c', cloth: '#4a4238', trim: '#3b352c', hunch: 0.28, scale: 1.04 * s });
  const up = upper(g); if (up) { const belly = ico(0.95 * s, '#8f9a82', 0, 1.0 * s, 0.35 * s, 1); belly.scale.set(1, 1.05, 0.95); up.add(belly); }
  return g;
}
function swarmOfRavens(d: Dims = {}): THREE.Group {
  const s = d.scale ?? 1, g = grp();
  for (let i = 0; i < 14; i++) {
    const a = hash(i * 1.3) * Math.PI * 2, r = (0.4 + hash(i * 2.1) * 1.4) * s, y = (0.6 + hash(i * 3.7) * 3) * s, x = Math.cos(a) * r, z = Math.sin(a) * r;
    g.add(box(0.55 * s, 0.25 * s, 0.25 * s, '#141218', x, y, z, 0, a, 0));
    for (const sz of [-1, 1]) g.add(box(0.4 * s, 0.05 * s, 0.6 * s, '#1d1b22', x, y + 0.08 * s, z + sz * 0.3 * s, sz * (0.4 + hash(i) * 0.5), a, 0));
  }
  return g;
}
function crawlingClaw(d: Dims = {}): THREE.Group {
  const s = (d.scale ?? 1) * 2.2, g = grp(box(0.5 * s, 0.18 * s, 0.6 * s, '#b09a80', 0, 0.2 * s, 0));
  for (let i = 0; i < 4; i++) g.add(beam(V((-0.18 + i * 0.12) * s, 0.2 * s, 0.3 * s), V((-0.2 + i * 0.13) * s, 0.02 * s, 0.75 * s), 0.07 * s, '#b09a80'));
  g.add(beam(V(0.25 * s, 0.2 * s, 0.05 * s), V(0.5 * s, 0.02 * s, 0.3 * s), 0.08 * s, '#b09a80'), box(0.3 * s, 0.2 * s, 0.25 * s, PALETTE.wine, 0, 0.2 * s, -0.4 * s));
  return g;
}

Object.assign(PROPS_V1, {
  'ruined-cottage': ruinedCottage, 'ruin-arches': ruinArches, 'berez-rubble': rubbleHeap, 'skull-fence': skullFence, 'thorn-thicket': thornThicket,
  'garden-statue': gardenStatue, 'stone-bench': stoneBench, 'berez-iron-fence': ironFence, 'sunken-bell': sunkenBell, 'rotten-pulpit': rottenPulpit,
  'marina-statue': marinaStatue, menhir, 'marsh-reeds': reeds, 'creeping-hut': creepingHut, 'hut-stump': hutStump, 'giant-root': giantRoot, 'giant-skull': giantSkull,
  'plank-landing': plankLanding, 'hut-thatch-roof': thatchRoof, 'raven-cage': ravenCage, cot, stool, 'ghastly-crib': ghastlyCrib, 'blood-tub': bloodTub,
  'tower-plinth': towerPlinth, 'tower-buttress': towerButtress, griffon, 'stone-step': stoneStep, 'khazan-lintel': khazanLintel, 'lift-chains': liftChains,
  'lift-platform': liftPlatform, 'vr-debris': debris, 'ezmerelda-wagon': ezmereldaWagon, scaffold, mildew, 'corbel-ring': corbelRing, rafters, 'window-box': windowBox,
  'vr-woodpile': woodpile, 'bright-tapestry': brightTapestry, 'clay-golem': clayGolem, 'standing-armor': standingArmor, 'marsh-scarecrow': marshScarecrow,
} as Record<string, (d: Dims) => THREE.Object3D>);
Object.assign(CREATURES, {
  goat: (d) => goat(d), 'baba-lysaga': (d) => babaLysaga(d), 'muriel-vinshaw': (d) => murielVinshaw(d), 'giant-poisonous-snake': (d) => giantSnake(d),
  'bloated-corpse': (d) => bloatedCorpse(d), 'hut-raven-swarm': (d) => swarmOfRavens(d), 'crawling-claw': (d) => crawlingClaw(d),
} as Record<string, (d: Dims) => THREE.Group>);
