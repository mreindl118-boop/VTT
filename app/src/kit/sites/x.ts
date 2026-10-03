// Props and figures for one site's maps (kept in their own file so each site can be built on its own).
// Register with Object.assign(PROPS_V1, {...}) / Object.assign(CREATURES, {...}); use mat() for every material.
//
// The Amber Temple (chapter 13, area X): amber sarcophagi and statues, the god of secrets, the lecture hall and the
// library, catacomb niches, the treasuries, and the temple's guardians (flameskulls, amber golems, the arcanaloth,
// nothics, the death slaad, the shield guardian). All in feet, origin at the floor centre, +z = the piece's front.
import * as THREE from 'three';
import { mat } from '../../render/materials';
import { PALETTE } from '../palette';
import { surfaceFor } from '../surfaces';
import { PROPS_V1 } from '../props';
import { CREATURES, humanoid } from '../creatures';

type Dims = Record<string, number>;

// ---------------------------------------------------------------- the temple's stones and metals
const AMBER = PALETTE.amberDeep, AMBER_DK = '#a3652a', AMBER_LT = '#d99a4a';
const BLACK = '#2a282c', BLACK_LT = '#3a383d', WHITE = '#d9d4c8', RED = '#7a3a3a', OBSIDIAN = '#1c1a20', GRANITE = '#6d6a66', GRANITE_DK = '#5d5a57';
const GOLD = '#b8913a', COPPER = '#8a4a32', VERDIGRIS = '#4f7a68', SLATE = '#1f1f24', SNOW = '#e4e6ea', FUR = '#6b5a48', PALEWOOD = '#a39a88', SOOT = '#1f1a18', VOID = '#09080b';
surfaceFor([AMBER_DK, AMBER_LT], 'generic');
surfaceFor([BLACK, BLACK_LT, WHITE, RED, OBSIDIAN, GRANITE_DK, SLATE], 'stone');
surfaceFor([GOLD, COPPER, VERDIGRIS], 'metal');
surfaceFor([SNOW], 'snow');
surfaceFor([FUR, '#8a7a62'], 'cloth');
surfaceFor([PALEWOOD], 'wood');
surfaceFor([SOOT, VOID], 'none');

const m_ = (geo: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat(color)); m.position.set(x, y, z); return m; };
const box = (w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0) => m_(new THREE.BoxGeometry(w, h, d), color, x, y, z);
const cyl = (rt: number, rb: number, h: number, color: string, x = 0, y = 0, z = 0, seg = 8) => m_(new THREE.CylinderGeometry(rt, rb, h, seg), color, x, y, z);
const ico = (r: number, color: string, x = 0, y = 0, z = 0, detail = 0) => m_(new THREE.IcosahedronGeometry(r, detail), color, x, y, z);
const cone = (r: number, h: number, color: string, x = 0, y = 0, z = 0, seg = 8) => m_(new THREE.ConeGeometry(r, h, seg), color, x, y, z);
const grp = (...o: THREE.Object3D[]) => { const g = new THREE.Group(); if (o.length) g.add(...o); return g; };
const rot = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T => { o.rotation.set(x, y, z); return o; };
const glow = (geo: THREE.BufferGeometry, color: string, emissive: string, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat(color, { emissive })); m.position.set(x, y, z); return m; };
/** A small deterministic hash: the same piece is roughened the same way every time it is built. */
const hash = (a: number, b = 0, c = 0) => { const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return s - Math.floor(s); };
/** Roughen a geometry's vertices (outward-ish jitter) while keeping the base flat on the floor. */
function rough(geo: THREE.BufferGeometry, amt: number, seed = 1, keepBase = true): THREE.BufferGeometry {
  const p = geo.attributes.position, seen = new Map<string, [number, number, number]>();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    let o = seen.get(k);
    if (!o) { o = [(hash(x, y + seed, z) - 0.5) * amt, (hash(y, z + seed, x) - 0.5) * amt * 0.6, (hash(z, x + seed, y) - 0.5) * amt]; seen.set(k, o); }
    p.setXYZ(i, x + o[0], keepBase && y <= 0.001 ? y : y + o[1], z + o[2]);
  }
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------- amber
/** An amber sarcophagus: a rough block 8 ft tall, 5 ft square, a sliver of utter darkness hanging inside it.
 *  dims.broken = 1: the block lies shattered round a broken stump. */
export function amberSarcophagus(d: Dims): THREE.Group {
  if (d.broken) {
    const g = grp(m_(rough(new THREE.BoxGeometry(4.4, 1.6, 4.2, 2, 1, 2).translate(0, 0.8, 0), 0.6, 7), AMBER_DK));
    for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 1.6 + hash(i) * 1.8; const s = ico(0.4 + hash(i, 3) * 0.6, i % 3 ? AMBER : AMBER_LT, Math.cos(a) * r, 0.3, Math.sin(a) * r); s.scale.y = 0.6; s.rotation.set(i, i * 2, 0); g.add(s); }
    return g;
  }
  const block = m_(rough(new THREE.BoxGeometry(5, 8, 5, 2, 3, 2).translate(0, 4, 0), 0.7, 3), AMBER);
  const cap = m_(rough(new THREE.BoxGeometry(4.2, 1.2, 4, 1, 1, 1).translate(0, 8.4, -0.1), 0.5, 5), AMBER_LT);
  // the vestige: a few inches of darkness seen through the front face
  const wisp = box(0.25, 1.4, 0.2, VOID, 0.2, 4.9, 2.62); wisp.rotation.z = 0.35;
  const wisp2 = box(0.14, 0.7, 0.18, VOID, -0.15, 5.6, 2.6); wisp2.rotation.z = -0.5;
  return grp(box(5.6, 0.4, 5.6, BLACK, 0, 0.2, 0), block, cap, wisp, wisp2);
}
/** A cloaked, faceless figure carved from one block of amber, hands pressed together in prayer (the facade's six). */
export function amberStatue(d: Dims): THREE.Group {
  const h = d.h ?? 20, s = h / 20;
  const robe = m_(rough(new THREE.CylinderGeometry(1.7 * s, 2.7 * s, 13 * s, 8, 2).translate(0, 1.5 * s + 6.5 * s, 0), 0.25 * s, 2), AMBER);
  const chest = cyl(1.9 * s, 1.7 * s, 2.6 * s, AMBER, 0, 15.6 * s, 0, 8);
  const hood = m_(new THREE.SphereGeometry(1.75 * s, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.62), AMBER_LT, 0, 17.4 * s, 0); hood.scale.set(1, 1.25, 1.05);
  const peak = cone(1.1 * s, 1.6 * s, AMBER_LT, 0, 19.6 * s, -0.25 * s, 8);
  const face = box(1.4 * s, 1.8 * s, 0.3 * s, AMBER_DK, 0, 17.3 * s, 1.55 * s);                 // the faceless hollow of the hood
  const hands = box(0.9 * s, 2.2 * s, 0.8 * s, AMBER_LT, 0, 13.6 * s, 1.75 * s); hands.rotation.x = -0.25;
  const g = grp(box(6 * s, 1.5 * s, 5 * s, GRANITE_DK, 0, 0.75 * s, 0), robe, chest, hood, peak, face, hands);
  for (const sx of [-1, 1]) { const arm = cyl(0.55 * s, 0.7 * s, 4 * s, AMBER, sx * 1.2 * s, 14.2 * s, 0.9 * s, 6); arm.rotation.set(-0.9, 0, sx * 0.45); g.add(arm); }
  return g;
}
/** Scattered pieces of broken amber. */
export function amberShards(d: Dims): THREE.Group {
  const g = grp();
  for (let i = 0; i < (d.n ?? 6); i++) { const a = i * 2.1, r = 0.5 + hash(i, 9) * 1.8; const s = ico(0.25 + hash(i, 4) * 0.35, i % 2 ? AMBER : AMBER_LT, Math.cos(a) * r, 0.15, Math.sin(a) * r); s.scale.y = 0.5; s.rotation.y = i; g.add(s); }
  return g;
}

// ---------------------------------------------------------------- the temple of lost secrets
/** The god of secrets: a granite colossus in flowing robes, cowled, hands thrown out as if casting a spell. Built to
 *  `h` ft (the shoulders): its hollow head stands on the floor above. */
export function godOfSecrets(d: Dims): THREE.Group {
  const h = d.h ?? 30, s = h / 30;
  const plinth = m_(new THREE.CylinderGeometry(7.4 * s, 7.8 * s, 2 * s, 8), GRANITE_DK, 0, 1 * s, 0);
  const robe = m_(rough(new THREE.CylinderGeometry(3.6 * s, 6.6 * s, 22 * s, 9, 3).translate(0, 2 * s + 11 * s, 0), 0.9 * s, 4), GRANITE);
  const folds = grp(); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; const f = box(0.9 * s, 18 * s, 0.9 * s, GRANITE_DK, Math.cos(a) * 5.0 * s, 11 * s, Math.sin(a) * 5.0 * s); f.rotation.set(Math.sin(a) * 0.16, 0, -Math.cos(a) * 0.16); folds.add(f); }
  const chest = cyl(3.9 * s, 3.6 * s, 6 * s, GRANITE, 0, 27 * s, 0, 9);
  const mantle = cyl(2.6 * s, 4.4 * s, 2.6 * s, GRANITE_DK, 0, 29.3 * s, -0.3 * s, 9);
  const g = grp(plinth, robe, folds, chest, mantle);
  for (const sx of [-1, 1]) {
    // shoulder, upper arm out and forward, forearm raised, an open hand
    const arm = grp(); arm.position.set(sx * 3.8 * s, 27.5 * s, 0.4 * s); arm.rotation.set(0, sx * -0.45, 0);
    const upper = cyl(1.1 * s, 1.3 * s, 7 * s, GRANITE, sx * 3.3 * s, 0.4 * s, 0, 7); upper.rotation.z = sx * -1.25; arm.add(upper);
    const sleeve = cone(2.1 * s, 4.5 * s, GRANITE_DK, sx * 4.2 * s, -1.4 * s, 0, 7); sleeve.rotation.z = sx * -0.5; arm.add(sleeve);
    const fore = cyl(0.8 * s, 1.0 * s, 5.5 * s, GRANITE, sx * 7.6 * s, 2.2 * s, 1.2 * s, 7); fore.rotation.set(0.5, 0, sx * -0.35); arm.add(fore);
    const hand = box(1.9 * s, 0.6 * s, 1.5 * s, GRANITE, sx * 8.6 * s, 4.6 * s, 2.4 * s); hand.rotation.set(-0.4, 0, sx * 0.3); arm.add(hand);
    g.add(arm);
  }
  return g;
}
/** The colossus's hollow head under its cowl, open on top so the chamber inside stays in view: a hood of thick granite
 *  panels round the back and sides, and in front a face of utter blackness pierced by two eyeholes. */
export function statueHead(d: Dims): THREE.Group {
  const r = d.r ?? 8.5, h = d.h ?? 10, g = grp(cyl(r + 0.6, r + 1.6, 1.0, GRANITE_DK, 0, 0.5, 0, 10));
  const gap = 0.3;   // half-width of the open front, in turns of pi
  for (let i = 0; i < 10; i++) {
    const a = Math.PI * (gap + (i + 0.5) * ((2 - 2 * gap) / 10)), rr = r + 0.7, seg = (rr * Math.PI * (2 - 2 * gap)) / 10 + 0.5;
    const p = box(seg, h + 2.5, 1.3, i % 2 ? GRANITE : GRANITE_DK, Math.sin(a) * rr, (h + 2.5) / 2, Math.cos(a) * rr); p.rotation.y = a; p.rotation.x = -0.18; g.add(p);
  }
  g.add(rot(cone(2.4, 4.5, GRANITE, 0, h + 3.4, -r * 0.55, 6), -0.5, 0, 0));          // the cowl's peak, falling back
  // the face: a plate of darkness with two 2-ft eyeholes at eye height
  const fz = r * 0.8, fw = 2 * r * Math.sin(Math.PI * gap) + 1.2, ey = h * 0.6;
  g.add(box(fw, ey - 0.8, 0.6, VOID, 0, (ey - 0.8) / 2 + 0.6, fz), box(fw, h - ey - 0.6, 0.6, VOID, 0, ey + 0.6 + (h - ey - 0.6) / 2 + 0.6, fz));
  g.add(box(fw / 2 - 2.6, 1.6, 0.6, VOID, -(fw / 4 + 1.3), ey + 0.4, fz), box(fw / 2 - 2.6, 1.6, 0.6, VOID, fw / 4 + 1.3, ey + 0.4, fz), box(1.6, 1.6, 0.6, VOID, 0, ey + 0.4, fz));
  g.add(box(fw + 1, 0.9, 1.4, GRANITE_DK, 0, h + 1.2, fz + 0.3));                          // the hood's brow
  return g;
}
/** An eight-foot wizard in white marble: robes, a pointed hat, a nine-foot staff of peeling gold. dims.fallen: toppled and broken. */
export function wizardStatue(d: Dims): THREE.Group {
  const fig = grp(cyl(1.0, 1.5, 5, WHITE, 0, 3.3, 0, 8), cyl(0.85, 1.0, 1.6, WHITE, 0, 6.5, 0, 8), ico(0.55, WHITE, 0, 7.6, 0.05, 1), cone(0.75, 0.25, WHITE, 0, 7.95, 0, 10), cone(0.55, 1.9, WHITE, 0, 8.95, -0.1, 8),
    box(0.6, 0.6, 0.5, WHITE, 0, 5.4, 0.9));
  const staff = grp(cyl(0.1, 0.1, 9, GOLD, 1.3, 4.9, 0.35, 6), ico(0.25, GOLD, 1.3, 9.5, 0.35));
  fig.add(staff, cyl(0.25, 0.3, 2.2, WHITE, 1.05, 5.9, 0.35, 6));
  if (!d.fallen) return grp(box(2.8, 0.8, 2.8, BLACK, 0, 0.4, 0), fig);
  // toppled out of its alcove: the figure on its side in three pieces, the staff thrown down, chips of marble
  const a = grp(fig); a.rotation.set(0, 0.3, Math.PI / 2 - 0.05); a.position.set(4.2, 1.2, 0);
  const g = grp(a, rot(box(2.8, 0.8, 2.8, BLACK, -4.5, 0.6, 0.6), 0.2, 0.4, 0.5));
  for (let i = 0; i < 7; i++) { const s = ico(0.25 + hash(i, 1) * 0.3, WHITE, -2 + i * 0.9, 0.15, (hash(i, 5) - 0.5) * 3); s.scale.y = 0.5; g.add(s); }
  return g;
}
/** A column of black marble, `h` ft: plinth, shaft and capital. base = 0 omits the plinth (the column continuing up
 *  from the floor below); cap = 0 omits the capital (it continues on the floor above). */
export function blackColumn(d: Dims): THREE.Group {
  const h = d.h ?? 30, b0 = d.base === 0 ? 0 : 1.2, g = grp(cyl(1.5, 1.6, h - b0, BLACK, 0, b0 + (h - b0) / 2, 0, 10));
  if (d.base !== 0) g.add(box(4.2, 1.2, 4.2, BLACK_LT, 0, 0.6, 0), cyl(1.9, 2.0, 0.6, BLACK_LT, 0, 1.5, 0, 10));
  if (d.cap !== 0) g.add(box(4.0, 1.0, 4.0, BLACK_LT, 0, h - 0.5, 0), cyl(2.2, 1.6, 1.0, BLACK_LT, 0, h - 1.5, 0, 10));
  return g;
}
/** Broken slabs of a black marble balcony, its railing snapped, on the temple floor. */
export function balconyDebris(): THREE.Group {
  const g = grp();
  for (let i = 0; i < 6; i++) { const s = box(5 + hash(i) * 4, 0.9, 3 + hash(i, 2) * 3, BLACK, (hash(i, 3) - 0.5) * 9, 0.5 + i * 0.15, (hash(i, 4) - 0.5) * 7); s.rotation.set((hash(i, 5) - 0.5) * 0.7, hash(i, 6) * 3, (hash(i, 7) - 0.5) * 0.7); g.add(s); }
  for (let i = 0; i < 4; i++) { const p = box(0.4, 3.2, 0.4, BLACK_LT, -3 + i * 2.2, 0.4, 2.5 - i); p.rotation.set(1.3, i, 0.2); g.add(p); }
  return g;
}
/** An arrow slit: a narrow dark slot through the wall with a stone sill and head, visible from both faces. */
export function arrowSlit(): THREE.Group {
  return grp(box(0.4, 3.4, 0.95, VOID, 0, 4.8, 0), box(1.3, 0.35, 0.9, GRANITE_DK, 0, 3.0, 0), box(1.3, 0.35, 0.9, GRANITE_DK, 0, 6.6, 0));
}

// ---------------------------------------------------------------- the facade and the ledge
/** The entrance arch in the facade: jambs, a round head at `h` ft and the carved face above it up to `top`. */
export function facadeArch(d: Dims): THREE.Group {
  const w = d.w ?? 10, h = d.h ?? 20, top = d.top ?? 50, ST = '#7c858e', DK = PALETTE.stoneDeep;
  const g = grp(box(1.8, h, 3.2, DK, -w / 2 - 0.3, h / 2, 0), box(1.8, h, 3.2, DK, w / 2 + 0.3, h / 2, 0));
  const arch = m_(new THREE.TorusGeometry(w / 2 + 0.3, 0.9, 6, 12, Math.PI), DK, 0, h - w / 2, 0); g.add(arch);
  // the infill above the opening, and spandrels filling the arch's shoulders
  g.add(box(w + 2.4, top - h, 1.0, ST, 0, h + (top - h) / 2, -0.3), box(w * 0.32, w / 2, 1.0, ST, -w * 0.36, h - w / 4 + 0.3, -0.3), box(w * 0.32, w / 2, 1.0, ST, w * 0.36, h - w / 4 + 0.3, -0.3));
  g.add(box(w + 4, 1.2, 3.6, DK, 0, h + 1.2, 0.2), box(3, 3, 1.4, AMBER_DK, 0, h + 4.5, 0.4));    // a lintel band and an amber keystone sigil
  return g;
}
/** A drift of wind-packed snow. */
export function snowDrift(d: Dims): THREE.Group {
  const m = m_(rough(new THREE.IcosahedronGeometry(1, 1), 0.25, 3, false), SNOW); m.scale.set((d.w ?? 16) / 2, d.h ?? 2, (d.d ?? 10) / 2); m.position.y = 0;
  return grp(m);
}

// ---------------------------------------------------------------- fittings
/** A rough hole through the floor, `r` ft across the radius: dark depth, a ragged lip of broken stone. */
export function shaftHole(d: Dims): THREE.Group {
  const r = d.r ?? 5, g = grp(cyl(r, r, 0.12, VOID, 0, 0.06, 0, 14));
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const s = ico(0.5 + hash(i, 2) * 0.4, PALETTE.stoneDeep, Math.cos(a) * (r + 0.2), 0.2, Math.sin(a) * (r + 0.2)); s.scale.y = 0.45; g.add(s); }
  return g;
}
/** The mouth of a shaft in a ceiling `y` ft up: a ragged ring of rock (the cutaway leaves the opening clear). */
export function ceilingHole(d: Dims): THREE.Group {
  const r = d.r ?? 5, y = d.y ?? 10, ring = m_(new THREE.TorusGeometry(r, 0.35, 4, 16), PALETTE.stoneDeep, 0, y - 0.3, 0), g = grp(ring);
  ring.rotation.x = Math.PI / 2;
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; const s = ico(0.5, PALETTE.stoneDeep, Math.cos(a) * r, y - 0.5, Math.sin(a) * r); s.scale.y = 0.6; g.add(s); }
  return g;
}
/** Round holes bored into a wall for scrolls or maps, in rows. */
export function scrollNiches(d: Dims): THREE.Group {
  const w = d.w ?? 9, g = grp(box(w, 6, 0.5, GRANITE_DK, 0, 3, 0));
  const n = Math.max(2, Math.floor(w / 1.1));
  for (let r = 0; r < 4; r++) for (let i = 0; i < n; i++) { const c = cyl(0.36, 0.36, 0.2, VOID, -w / 2 + 0.6 + i * ((w - 1.2) / (n - 1)), 1.2 + r * 1.3, 0.2, 8); c.rotation.x = Math.PI / 2; g.add(c); }
  return g;
}
/** Wall niches holding hundreds of dusty bottles. */
export function bottleNiches(d: Dims): THREE.Group {
  const w = d.w ?? 12, g = grp(box(w, 12, 0.8, GRANITE_DK, 0, 6, 0)), cols = Math.max(1, Math.floor(w / 3));
  const B = ['#4f5a48', '#5a4a3a', '#6a6a5a', '#4a4550', '#7a6a4a'];
  for (let r = 0; r < 4; r++) for (let c = 0; c < cols; c++) {
    const x = -w / 2 + 1.5 + c * ((w - 3) / Math.max(1, cols - 1)), y = 1.6 + r * 2.7;
    g.add(box(2.4, 1.9, 0.5, VOID, x, y, 0.2));
    for (let k = 0; k < 4; k++) g.add(cyl(0.16, 0.2, 0.75, B[(r * 3 + c + k) % B.length], x - 0.8 + k * 0.53, y - 0.55, 0.3, 6));
  }
  return g;
}
/** A stone block like a table. */
export function stoneTable(): THREE.Group { return grp(box(3.6, 2.6, 6.4, GRANITE_DK, 0, 1.3, 0), box(4, 0.4, 6.8, GRANITE, 0, 2.8, 0)); }
/** A wooden ladder leaning on a wall, `h` ft (rotted: it will not bear weight). */
export function leaningLadder(d: Dims): THREE.Group {
  const h = d.h ?? 12, g = grp();
  for (const x of [-0.8, 0.8]) { const r = box(0.18, h, 0.18, PALETTE.woodDark, x, h / 2 - 0.1, 0.9); r.rotation.x = -0.16; g.add(r); }
  for (let i = 1; i < h / 1.2; i++) g.add(box(1.6, 0.12, 0.14, PALETTE.wood, 0, i * 1.18, 0.9 - i * 1.18 * 0.16));
  return g;
}
/** An iron torch sconce on the wall at `y`; dims.lit adds a burning torch. */
export function wallSconce(d: Dims): THREE.Group {
  const y = d.y ?? 6, g = grp(box(0.5, 0.9, 0.2, PALETTE.iron, 0, y - 0.4, 0.05), box(0.15, 0.15, 0.7, PALETTE.iron, 0, y - 0.6, 0.4), cyl(0.3, 0.18, 0.4, PALETTE.iron, 0, y - 0.35, 0.75, 6));
  if (d.lit) g.add(box(0.18, 1.4, 0.18, PALETTE.woodDark, 0, y + 0.1, 0.75), glow(new THREE.IcosahedronGeometry(0.32, 0), PALETTE.amber, '#c9632e', 0, y + 0.95, 0.75));
  return g;
}
/** A candlestick lying where it fell. */
export function candlestickFallen(): THREE.Group {
  const c = grp(cyl(0.35, 0.5, 0.2, PALETTE.iron, 0, 0.1, 0, 8), cyl(0.08, 0.08, 3.5, PALETTE.iron, 0, 1.75, 0, 6), box(0.3, 0.6, 0.3, PALETTE.bone, 0, 3.8, 0));
  c.rotation.set(Math.PI / 2 - 0.08, 0, 0); c.position.set(0, 0.45, -1.6);
  return grp(c);
}
/** A heap of broken furniture: boards, legs and a split panel or two. */
export function woodDebris(d: Dims): THREE.Group {
  const g = grp(), pale = !!d.pale;
  for (let i = 0; i < 9; i++) { const b = box(0.3 + hash(i, 1) * 0.5, 0.25, 2 + hash(i, 2) * 3, pale || i % 4 === 0 ? PALEWOOD : i % 2 ? PALETTE.wood : PALETTE.woodDark, (hash(i, 3) - 0.5) * 3.4, 0.2 + i * 0.12, (hash(i, 4) - 0.5) * 3.4); b.rotation.set((hash(i, 5) - 0.5) * 0.6, hash(i, 6) * Math.PI, (hash(i, 7) - 0.5) * 0.5); g.add(b); }
  g.add(rot(box(2.6, 0.3, 2.0, PALETTE.woodDark, 0.4, 0.5, -0.3), 0.3, 0.6, 0.15));
  return g;
}
/** A fur bedroll stitched from hides: a shaggy pelt, its head end rolled up as a pillow. */
export function furBedroll(): THREE.Group {
  const pelt = m_(rough(new THREE.BoxGeometry(3.2, 0.4, 5.6, 3, 1, 4).translate(0, 0.2, 0), 0.35, 6), FUR, 0, 0, 0.2);
  const roll = cyl(0.6, 0.6, 3.1, '#8a7a62', 0, 0.6, -2.6, 8); roll.rotation.z = Math.PI / 2;
  return grp(pelt, roll, box(1.4, 0.12, 2.2, '#8a7a62', 0.6, 0.4, 1.0));
}
/** Fire-blackened stone underfoot: irregular soot patches (a flat decal). */
export function scorch(d: Dims): THREE.Group {
  const w = d.w ?? 16, dd = d.d ?? 24, g = grp();
  for (let i = 0; i < 9; i++) { const m = ico(1, SOOT, (hash(i, 1) - 0.5) * w * 0.7, 0.02, (hash(i, 2) - 0.5) * dd * 0.75); m.scale.set(w * (0.18 + hash(i, 3) * 0.15), 0.02, dd * (0.12 + hash(i, 4) * 0.12)); m.userData.role = 'floor'; g.add(m); }
  return g;
}
/** Cracks running along a marble floor (a flat decal). */
export function floorCracks(d: Dims): THREE.Group {
  const len = d.len ?? 12, g = grp(); let x = 0, z = -len / 2;
  for (let i = 0; i < 7; i++) { const l = len / 7, a = (hash(i, 9) - 0.5) * 0.9, b = box(0.12, 0.03, l * 1.05, SOOT, x + Math.sin(a) * l / 2, 0.03, z + l / 2); b.rotation.y = a; b.userData.role = 'floor'; g.add(b); x += Math.sin(a) * l; z += Math.cos(a) * l; }
  return g;
}
/** A charred corpse under a burned fur cloak. */
export function charredCorpse(): THREE.Group {
  const g = grp(box(1.3, 0.6, 3.6, SOOT, 0, 0.3, 0), ico(0.5, '#2b2420', 0, 0.45, -2.1), box(0.35, 0.35, 2.2, SOOT, 0.7, 0.25, 1.2), box(0.35, 0.35, 2.4, SOOT, -0.5, 0.25, 1.4));
  const cloak = m_(rough(new THREE.BoxGeometry(2.6, 0.3, 3.2, 2, 1, 2), 0.3, 4), '#3a2e26', 0.1, 0.65, -0.2); g.add(cloak);
  return g;
}

// ---------------------------------------------------------------- the lecture hall
/** An obsidian lectern. */
export function lectern(): THREE.Group {
  const top = box(2.4, 0.3, 1.8, OBSIDIAN, 0, 3.9, 0); top.rotation.x = 0.35;
  return grp(box(2.2, 0.4, 1.8, OBSIDIAN, 0, 0.2, 0), cyl(0.45, 0.6, 3.4, OBSIDIAN, 0, 2.1, 0, 6), top);
}
/** A slab of black slate hanging from two chains (an old chalkboard with a few marks). */
export function slateBoard(): THREE.Group {
  const g = grp(box(9, 5.5, 0.35, SLATE, 0, 7, 0), box(9.4, 0.35, 0.5, PALETTE.iron, 0, 9.8, 0));
  for (const x of [-3.8, 3.8]) for (let i = 0; i < 9; i++) g.add(box(0.2, 0.45, 0.2, PALETTE.iron, x, 10.2 + i * 0.5, 0));
  for (let i = 0; i < 4; i++) { const c = box(1 + hash(i) * 2, 0.08, 0.05, '#cfcfc8', -2.5 + i * 1.6, 6 + hash(i, 2) * 2, 0.2); c.rotation.z = (hash(i, 3) - 0.5) * 0.6; g.add(c); }
  return g;
}
/** A long bench of red marble; dims.tier raises it on a black step (descending rows). */
export function marbleBench(d: Dims): THREE.Group {
  const l = d.l ?? 16, t = d.tier ?? 0, g = grp(box(l, 0.5, 1.6, RED, 0, 1.75, 0), box(l, 1.5, 0.8, '#5e2c2c', 0, 0.75, -0.2));
  if (t > 0) g.add(box(l + 2, t, 4.4, BLACK, 0, -t / 2, 0));
  return g;
}
/** A red copper lanthorn hanging on a chain, burning with a steady magical light. */
export function lanthorn(d: Dims): THREE.Group {
  const y = d.y ?? 12, g = grp(cyl(0.65, 0.5, 1.4, COPPER, 0, y, 0, 6), cone(0.7, 0.7, COPPER, 0, y + 1.05, 0, 6), glow(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 6), PALETTE.amber, '#c9632e', 0, y, 0));
  for (let i = 0; i < 6; i++) g.add(box(0.12, 0.45, 0.12, PALETTE.iron, 0, y + 1.6 + i * 0.45, 0));
  return g;
}

// ---------------------------------------------------------------- the library and the lich's rooms
/** A ten-foot bookcase of black marble, its shelves full of well-kept tomes. */
export function marbleBookcase(d: Dims): THREE.Group {
  const w = d.w ?? 8, BIND = [PALETTE.wine, PALETTE.pineDeep, '#5a4632', PALETTE.violetDeep, '#6b5d4a', PALETTE.blood, '#2c3a4a'];
  const g = grp(box(w, 10, 0.3, BLACK, 0, 5, -0.7), box(0.4, 10, 1.6, BLACK, -w / 2 + 0.2, 5, 0), box(0.4, 10, 1.6, BLACK, w / 2 - 0.2, 5, 0), box(w + 0.4, 0.5, 1.8, BLACK_LT, 0, 10.1, 0), box(w, 0.5, 1.6, BLACK_LT, 0, 0.25, 0));
  for (let i = 0; i < 5; i++) {
    const y = 0.5 + i * 1.9; g.add(box(w - 0.6, 0.18, 1.4, BLACK_LT, 0, y, 0));
    let x = -w / 2 + 0.5, k = i * 5;
    while (x < w / 2 - 0.7) { const bw = 0.24 + ((k * 37) % 5) * 0.05, bh = 1.1 + ((k * 53) % 4) * 0.14; g.add(box(bw, bh, 1.0, BIND[k % BIND.length], x + bw / 2, y + 0.09 + bh / 2, 0.05)); x += bw + 0.02; k++; }
  }
  return g;
}
/** The library's golden marble stair: a gentle spiral hugging the wall of a round shaft, a black marble railing on its
 *  open side. Centred on the shaft; outer radius `r`, treads `w` wide, from angle a0 to a1 (degrees, 0 = east, 90 = south)
 *  rising `rise` ft. */
export function goldSpiral(d: Dims): THREE.Group {
  const r = d.r ?? 15, w = d.w ?? 5, rise = d.rise ?? 30, a0 = ((d.a0 ?? 195) * Math.PI) / 180, a1 = ((d.a1 ?? 410) * Math.PI) / 180;
  const n = Math.max(12, Math.round(rise / 0.75)), g = grp(), rm = r - w / 2, step = (a1 - a0) / n;
  for (let i = 0; i < n; i++) {
    const a = a0 + step * (i + 0.5), y = ((i + 1) / n) * rise, len = Math.abs(step) * r + 0.15;
    const t = box(w, 0.5, len, i % 2 ? GOLD : '#a8823a', Math.cos(a) * rm, y - 0.25, Math.sin(a) * rm); t.rotation.y = -a;
    const under = box(w * 0.9, 1.4, len, GRANITE_DK, Math.cos(a) * (rm + 0.2), y - 1.2, Math.sin(a) * (rm + 0.2)); under.rotation.y = -a;
    t.userData.role = 'stairs'; g.add(t, under);
    if (i % 3 === 0) g.add(box(0.25, 3.4, 0.25, BLACK, Math.cos(a) * (r - w + 0.2), y + 1.7, Math.sin(a) * (r - w + 0.2)));
    const rail = box(0.3, 0.3, len + 0.1, BLACK, Math.cos(a) * (r - w + 0.2), y + 3.4, Math.sin(a) * (r - w + 0.2)); rail.rotation.y = -a; g.add(rail);
  }
  return g;
}
/** Human skulls heaped floor to ceiling in a small room (w × d, `h` ft deep). */
export function skullPile(d: Dims): THREE.Group {
  const w = d.w ?? 9, dd = d.d ?? 9, h = d.h ?? 8, g = grp(m_(rough(new THREE.BoxGeometry(w * 0.9, h * 0.75, dd * 0.9, 2, 2, 2).translate(0, h * 0.375, 0), 0.8, 2), '#cbbfa4'));
  const geo = new THREE.IcosahedronGeometry(0.42, 1);
  for (let i = 0; i < 70; i++) {
    const x = (hash(i, 1) - 0.5) * w * 0.9, z = (hash(i, 2) - 0.5) * dd * 0.9, top = h * (0.55 + 0.45 * (1 - Math.max(Math.abs(x) / (w / 2), Math.abs(z) / (dd / 2)) * 0.6));
    const s = m_(geo, i % 5 ? PALETTE.bone : '#cbbfa4', x, Math.min(top, h * 0.75 + hash(i, 3) * h * 0.25), z); s.scale.set(1, 0.95, 1.2); s.rotation.y = i; g.add(s);
    if (i % 2 === 0) g.add(box(0.14, 0.14, 0.1, VOID, x - 0.15, s.position.y + 0.05, z + 0.45), box(0.14, 0.14, 0.1, VOID, x + 0.15, s.position.y + 0.05, z + 0.45));
  }
  return g;
}
/** An iron chest with a barrel lid, glued upside down to a ceiling `y` ft up. */
export function ceilingChest(d: Dims): THREE.Group {
  const y = d.y ?? 29, lid = cyl(1, 1, 3, PALETTE.iron, 0, y - 1.8, 0, 8); lid.rotation.z = Math.PI / 2;
  return grp(box(3, 1.8, 2, PALETTE.iron, 0, y - 0.9, 0), lid, box(3.2, 0.2, 2.2, '#2b2420', 0, y - 0.1, 0));
}
/** A carved scaly arm rising from the floor, its claw clutching a small box of bone. */
export function clawPedestal(): THREE.Group {
  const S = '#3d4a3a', g = grp(cyl(0.9, 1.2, 0.5, GRANITE_DK, 0, 0.25, 0, 8));
  const fore = cyl(0.42, 0.55, 2.4, S, 0, 1.6, 0, 6); fore.rotation.z = 0.12; g.add(fore);
  const wrist = cyl(0.36, 0.42, 1.0, S, 0.15, 3.1, 0, 6); wrist.rotation.z = -0.2; g.add(wrist);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2, c = cone(0.12, 1.1, PALETTE.bone, 0.1 + Math.cos(a) * 0.45, 4.1, Math.sin(a) * 0.45, 5); c.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6); g.add(c); }
  g.add(box(0.75, 0.6, 0.6, PALETTE.bone, 0.1, 4.05, 0), box(0.8, 0.1, 0.65, '#cbbfa4', 0.1, 4.4, 0));
  return g;
}
/** A rotted divan, a bronze-covered spellbook lying on it. */
export function divan(): THREE.Group {
  return grp(box(6, 1.2, 2.6, PALETTE.woodDark, 0, 0.6, 0), box(5.6, 0.5, 2.2, '#5a2a30', 0, 1.45, 0.1), box(6, 1.8, 0.5, '#4a2228', 0, 2.1, -1.1), box(0.6, 1.4, 2.6, PALETTE.woodDark, -2.9, 1.5, 0),
    box(1.1, 0.25, 0.8, '#8a6a3a', 0.6, 1.85, 0.2), box(1.0, 0.05, 0.7, '#c9b893', 0.6, 1.99, 0.2));
}

// ---------------------------------------------------------------- the catacombs, the bedchambers, the treasuries
/** A stretch of wall cut with burial niches: amber husks and bones (empty 0), smashed husks (1), or bare dust (2). */
export function catacombNiches(d: Dims): THREE.Group {
  const w = d.w ?? 8, e = d.empty ?? 0, g = grp(box(w, 7, 0.7, GRANITE_DK, 0, 3.5, 0));
  for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
    const x = -w / 4 + c * (w / 2), y = 1.6 + r * 3;
    g.add(box(w / 2 - 0.8, 1.9, 0.5, VOID, x, y, 0.2));
    if (e === 0) { const h = box(w / 2 - 1.4, 0.8, 0.8, AMBER_DK, x, y - 0.4, 0.45); g.add(h, ico(0.3, PALETTE.bone, x - w / 6, y - 0.3, 0.6)); }
    if (e === 1) for (let k = 0; k < 3; k++) g.add(ico(0.2, k % 2 ? AMBER : PALETTE.bone, x - 0.8 + k * 0.8, y - 0.65, 0.5));
  }
  return g;
}
/** A white marble bed whose corner posts carry golden hawks; the mattress long rotted. */
export function marbleBed(): THREE.Group {
  const g = grp(box(5, 1.6, 7.4, WHITE, 0, 0.8, 0), box(4.4, 0.4, 6.6, '#4a4038', 0, 1.8, 0.1), box(5, 3.2, 0.5, WHITE, 0, 1.6, -3.6));
  for (const [x, z] of [[-2.3, -3.5], [2.3, -3.5], [-2.3, 3.5], [2.3, 3.5]]) {
    g.add(cyl(0.25, 0.3, 5, WHITE, x, 2.5, z, 8), ico(0.3, GOLD, x, 5.3, z), box(1.0, 0.12, 0.35, GOLD, x, 5.35, z), cone(0.12, 0.3, GOLD, x, 5.35, z + 0.35, 5));
  }
  return g;
}
/** A heap of treasure; n (0–5) varies the coin and the things in it, matching the book's six piles. */
export function treasurePile(d: Dims): THREE.Group {
  const n = d.n ?? 0, COIN = ['#8a5a3a', '#a8a8b0', '#c9b893', '#6a6a70', '#a8a8b0', '#b8913a'][n % 6];
  const g = grp(m_(rough(new THREE.SphereGeometry(3.2, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0.5, n + 1), COIN));
  g.children[0].scale.set(1, 0.42, 0.9);
  for (let i = 0; i < 5; i++) { const a = i * 1.3 + n, r = 1.2 + hash(i, n) * 1.4; g.add(ico(0.35, COIN, Math.cos(a) * r, 1.1 - r * 0.25, Math.sin(a) * r)); }
  // a few of the pile's things: rusted armour, a chest, a statuette, a vase, iron pots
  if (n === 0 || n === 1) g.add(rot(box(1.4, 1.8, 0.9, '#5a3e2e', -1.2, 1.3, 0.6), 0.3, 0.5, 0.4), rot(cyl(0.8, 0.8, 0.2, '#5a3e2e', 1.3, 1.0, -0.5, 10), 1.2, 0, 0.3));
  if (n === 0) g.add(rot(box(1.2, 0.8, 2.6, '#1a171d', 0.4, 1.4, 1.3), 0, 0.4, 0.1));
  if (n === 1) g.add(rot(box(2.6, 1.4, 1.8, GOLD, 1.4, 0.9, 1.6), 0, 0.6, 0.05));
  if (n === 2) g.add(box(2.6, 1.6, 1.6, PALETTE.woodDark, -1.4, 1.0, 1.2), cyl(0.4, 0.5, 1.6, '#d9d4c8', 1.4, 1.4, 0.4, 8), cyl(0.4, 0.5, 1.6, '#c9bfa6', 0.8, 1.2, -1.4, 8));
  if (n === 3) for (let i = 0; i < 4; i++) g.add(box(1.4, 0.4, 0.6, PALETTE.iron, -1 + (i % 2) * 1.5, 0.9 + Math.floor(i / 2) * 0.4, 1.4));
  if (n === 4) g.add(cyl(0.7, 0.5, 1.8, WHITE, -1.6, 1.0, 0.9, 10), cyl(0.7, 0.5, 1.8, WHITE, 1.6, 1.0, 1.2, 10), m_(new THREE.TorusGeometry(0.5, 0.12, 5, 10), GOLD, 0, 1.8, 0));
  if (n === 5) for (let i = 0; i < 3; i++) g.add(cyl(0.7, 0.55, 1.0, PALETTE.iron, -1.4 + i * 1.4, 0.9, 1.6, 8));
  return g;
}
/** A five-foot amber ledge along a wall, crowded with small alabaster animals (familiars). */
export function animalLedge(d: Dims): THREE.Group {
  const w = d.w ?? 14, y = d.y ?? 5, seed = d.seed ?? 0, g = grp(box(w, 0.45, 1.3, AMBER, 0, y, 0.55), box(w, 0.8, 0.4, AMBER_DK, 0, y - 0.6, 0.2));
  const A = '#e8e4dc';
  for (let i = 0; i < Math.floor(w / 1.8); i++) {
    const x = -w / 2 + 1 + i * 1.8, k = Math.floor(hash(i, seed) * 5);
    if (hash(i, seed, 3) < 0.25) continue;                                   // fallen from its perch
    if (k === 0) g.add(ico(0.35, A, x, y + 0.6, 0.6), cone(0.2, 0.5, A, x, y + 1.1, 0.6, 5));                         // owl
    else if (k === 1) g.add(box(0.9, 0.4, 0.4, A, x, y + 0.45, 0.6), ico(0.2, A, x + 0.5, y + 0.6, 0.6));             // cat or weasel
    else if (k === 2) g.add(ico(0.32, A, x, y + 0.45, 0.6));                                                       // toad or frog
    else if (k === 3) g.add(box(0.3, 0.7, 0.4, A, x, y + 0.6, 0.6), cone(0.12, 0.3, A, x, y + 1.05, 0.75, 4));        // hawk or raven
    else g.add(rot(box(1.1, 0.15, 0.2, A, x, y + 0.3, 0.6), 0, 0.3, 0));                                           // snake
  }
  return g;
}
/** Broken alabaster animals on the floor. */
export function animalShards(): THREE.Group {
  const g = grp(); for (let i = 0; i < 6; i++) { const s = ico(0.2 + hash(i, 2) * 0.2, '#e8e4dc', (hash(i, 3) - 0.5) * 2.4, 0.12, (hash(i, 4) - 0.5) * 2.4); s.scale.y = 0.5; g.add(s); } return g;
}
/** A faceless figure of obsidian, four feet tall, on a low step; dims.shattered = its fragments. */
export function obsidianIdol(d: Dims): THREE.Group {
  if (d.shattered) { const g = grp(); for (let i = 0; i < 8; i++) { const s = ico(0.25 + hash(i, 6) * 0.4, OBSIDIAN, (hash(i, 7) - 0.5) * 3, 1.1, (hash(i, 8) - 0.5) * 3); s.scale.y = 0.6; s.rotation.set(i, i, 0); g.add(s); } return g; }
  const g = grp(cyl(0.8, 1.2, 2.6, OBSIDIAN, 0, 2.3, 0, 7), cyl(0.6, 0.8, 0.8, OBSIDIAN, 0, 3.9, 0, 7), ico(0.45, OBSIDIAN, 0, 4.5, 0), cone(0.5, 0.8, OBSIDIAN, 0, 4.85, -0.05, 7));
  return grp(g, box(2.2, 1, 2.2, BLACK_LT, 0, 0.5, 0));
}
/** A green copper ewer embossed with dancing beasts (on a table at `y`). */
export function ewer(d: Dims): THREE.Group {
  const y = d.y ?? 2.5, handle = m_(new THREE.TorusGeometry(0.22, 0.05, 4, 8, Math.PI), VERDIGRIS, -0.35, y + 0.55, 0); handle.rotation.z = Math.PI / 2;
  return grp(cyl(0.22, 0.32, 0.8, VERDIGRIS, 0, y + 0.4, 0, 8), cyl(0.12, 0.2, 0.3, VERDIGRIS, 0, y + 0.95, 0, 8), cone(0.08, 0.35, VERDIGRIS, 0.3, y + 0.85, 0, 5).rotateZ(-1), handle);
}
/** The illusory feast: platters of roast, bowls, goblets and candles down a long table (`w` ft) at table height. */
export function feast(d: Dims): THREE.Group {
  const w = d.w ?? 20, y = 2.55, g = grp();
  for (let i = 0; i < Math.floor(w / 3); i++) {
    const x = -w / 2 + 1.5 + i * 3;
    g.add(cyl(0.7, 0.6, 0.12, '#c9c2b2', x, y + 0.06, 0, 10), ico(0.45, i % 2 ? '#7a4a2a' : '#8a6a3a', x, y + 0.4, 0));
    for (const z of [-1.4, 1.4]) g.add(cyl(0.12, 0.08, 0.45, GOLD, x + 0.6, y + 0.23, z * 0.85, 6), cyl(0.4, 0.4, 0.06, '#c9c2b2', x, y + 0.03, z, 8));
    if (i % 3 === 1) g.add(cyl(0.1, 0.12, 1.2, PALETTE.bone, x + 1.4, y + 0.6, 0, 6));
  }
  return g;
}

// ---------------------------------------------------------------- the castle model (X20)
/** A twelve-foot model of Castle Ravenloft sculpted from rock: crag, curtain walls, keep, towers and spires. */
export function castleModel(): THREE.Group {
  const ST = '#4a4550', DK = '#3d3a44', RF = '#2b292d';
  const g = grp(m_(rough(new THREE.CylinderGeometry(4.2, 5.2, 2.4, 8, 1), 0.5, 3).translate(0, 1.2, 0), '#5d5a57'));
  g.add(box(7, 1.8, 0.4, ST, 0, 3.3, -3), box(7, 1.8, 0.4, ST, 0, 3.3, 3), box(0.4, 1.8, 6.4, ST, -3.4, 3.3, 0), box(0.4, 1.8, 6.4, ST, 3.4, 3.3, 0));
  g.add(box(4, 4.2, 3.6, DK, -0.2, 4.5, -0.6), box(2.6, 1.6, 2.4, DK, 1.6, 3.2, 1.6));
  for (const [x, z, h, r] of [[-1.6, -1.8, 6.5, 0.7], [1.4, -2.0, 5.2, 0.6], [0.6, 0.9, 7.6, 0.55], [-3.4, 3, 3.5, 0.6], [3.4, 3, 3.5, 0.6], [-3.4, -3, 3.8, 0.6], [3.4, -3, 3.8, 0.6]]) {
    g.add(cyl(r, r, h, ST, x, 2.4 + h / 2, z, 8), cone(r * 1.25, h * 0.45 + 1, RF, x, 2.4 + h + (h * 0.45 + 1) / 2, z, 8));
  }
  return g;
}

// ---------------------------------------------------------------- stairs
/** A straight flight of stone steps from the origin along local +x: `len` ft long, `w` wide, climbing `rise` ft from a
 *  base `y` ft up (a landing's height), solid down to the floor. */
export function stoneFlight(d: Dims): THREE.Group {
  const len = d.len ?? 10, w = d.w ?? 5, rise = d.rise ?? 10, y0 = d.y ?? 0, n = Math.max(2, Math.round(rise / 0.75)), g = grp();
  for (let i = 0; i < n; i++) {
    const h = y0 + ((i + 1) / n) * rise, x0 = (i / n) * len;
    const m = box(len - x0, h, w, i % 2 ? PALETTE.stoneDeep : '#565b64', (x0 + len) / 2, h / 2, 0); m.userData.role = 'stairs'; g.add(m);
  }
  return g;
}

Object.assign(PROPS_V1, {
  'amber-sarcophagus': amberSarcophagus, 'amber-statue': amberStatue, 'amber-shards': amberShards, 'god-of-secrets': godOfSecrets, 'god-statue-head': statueHead,
  'wizard-statue': wizardStatue, 'black-column': blackColumn, 'balcony-debris': balconyDebris, 'arrow-slit': arrowSlit, 'facade-arch': facadeArch, 'snow-drift': snowDrift,
  'shaft-hole': shaftHole, 'ceiling-hole': ceilingHole, 'scroll-niches': scrollNiches, 'bottle-niches': bottleNiches, 'stone-table': stoneTable, 'leaning-ladder': leaningLadder,
  'wall-sconce': wallSconce, 'candlestick-fallen': candlestickFallen, 'wood-debris': woodDebris, 'fur-bedroll': furBedroll, scorch, 'floor-cracks': floorCracks,
  'charred-corpse': charredCorpse, lectern, 'slate-board': slateBoard, 'marble-bench': marbleBench, lanthorn, 'marble-bookcase': marbleBookcase, 'gold-spiral': goldSpiral,
  'skull-pile': skullPile, 'ceiling-chest': ceilingChest, 'claw-pedestal': clawPedestal, divan, 'catacomb-niches': catacombNiches, 'marble-bed': marbleBed,
  'treasure-pile': treasurePile, 'animal-ledge': animalLedge, 'animal-shards': animalShards, 'obsidian-idol': obsidianIdol, ewer, feast, 'castle-model': castleModel,
  'stone-flight': stoneFlight,
} as Record<string, (d: Dims) => THREE.Object3D>);

// ---------------------------------------------------------------- figures
/** Where the humanoid's head sits for a given hunch and scale (the upper body pivots at the hips). */
function headAt(s: number, hunch = 0): [number, number] { const a = hunch * 0.6; return [2.85 * s + 2.82 * s * Math.cos(a), 2.82 * s * Math.sin(a)]; }

/** A flameskull: a skull wreathed in green fire, floating `y` ft up. */
export function flameskull(d: Dims = {}): THREE.Group {
  const s = (d.scale ?? 1) * 1.6, y = d.y ?? 4, g = grp();
  const skull = ico(0.55 * s, PALETTE.bone, 0, y, 0, 1); skull.scale.set(0.9, 1, 1.05);
  g.add(skull, box(0.6 * s, 0.3 * s, 0.5 * s, PALETTE.bone, 0, y - 0.5 * s, 0.15 * s), box(0.18 * s, 0.2 * s, 0.1 * s, VOID, -0.2 * s, y + 0.05 * s, 0.5 * s), box(0.18 * s, 0.2 * s, 0.1 * s, VOID, 0.2 * s, y + 0.05 * s, 0.5 * s));
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const f = glow(new THREE.ConeGeometry(0.22 * s, (0.9 + hash(i) * 0.5) * s, 5), '#5bd97a', '#2f8a45', Math.cos(a) * 0.45 * s, y + 0.55 * s, Math.sin(a) * 0.45 * s); f.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4); g.add(f); }
  g.add(glow(new THREE.ConeGeometry(0.3 * s, 1.2 * s, 5), '#5bd97a', '#2f8a45', 0, y + 0.95 * s, 0));
  return g;
}
/** An amber golem, ten feet tall, cracked: a jackal's head (head 0) or a hawk's (head 1). */
export function amberGolem(d: Dims = {}): THREE.Group {
  const s = d.scale ?? 1, g = grp();
  for (const x of [-0.9, 0.9]) g.add(box(1.2 * s, 4 * s, 1.3 * s, AMBER, x * s, 2 * s, 0), box(1.4 * s, 0.6 * s, 1.8 * s, AMBER_DK, x * s, 0.3 * s, 0.2 * s));
  g.add(box(2.8 * s, 1.4 * s, 1.6 * s, AMBER_DK, 0, 4.4 * s, 0), box(3.2 * s, 2.8 * s, 2 * s, AMBER, 0, 6.3 * s, 0), box(4.2 * s, 0.9 * s, 2.2 * s, AMBER_LT, 0, 7.9 * s, 0));
  for (const x of [-1, 1]) {
    const arm = grp(box(1 * s, 3.2 * s, 1 * s, AMBER, 0, -1.4 * s, 0), box(1.3 * s, 1.1 * s, 1.3 * s, AMBER_DK, 0, -3.3 * s, 0.1 * s)); arm.position.set(x * 2.4 * s, 7.8 * s, 0); arm.rotation.z = x * 0.12; arm.rotation.x = -0.15; g.add(arm);
  }
  g.add(box(1 * s, 0.8 * s, 1 * s, AMBER, 0, 8.7 * s, 0));
  const hy = 9.4 * s;
  if (d.head) g.add(ico(0.75 * s, AMBER_LT, 0, hy, 0), cone(0.35 * s, 0.9 * s, AMBER_DK, 0, hy - 0.15 * s, 0.85 * s, 5).rotateX(Math.PI / 2 + 0.4));          // hawk: round head, hooked beak
  else g.add(box(1 * s, 0.9 * s, 1.1 * s, AMBER_LT, 0, hy, 0), box(0.55 * s, 0.45 * s, 1.1 * s, AMBER_LT, 0, hy - 0.15 * s, 0.95 * s),
    cone(0.22 * s, 0.9 * s, AMBER_DK, -0.3 * s, hy + 0.8 * s, -0.1 * s, 4), cone(0.22 * s, 0.9 * s, AMBER_DK, 0.3 * s, hy + 0.8 * s, -0.1 * s, 4));                // jackal: long muzzle, tall ears
  if (d.cracked) for (let i = 0; i < 5; i++) g.add(rot(box(0.1 * s, 1.4 * s, 0.1 * s, VOID, (hash(i) - 0.5) * 2.4 * s, (4.8 + hash(i, 2) * 3) * s, 1.02 * s), 0, 0, (hash(i, 3) - 0.5) * 1.4));
  return g;
}
/** The arcanaloth: a jackal-headed fiend in robes. */
export function arcanaloth(d: Dims = {}): THREE.Group {
  const s = (d.scale ?? 1) * 1.05, g = humanoid({ skin: '#5a4632', cloth: '#3a2a4a', trim: '#c9a227', robe: true, scale: s, weapon: 'staff', claws: true });
  const [hy, hz] = headAt(s);
  g.add(box(0.36 * s, 0.32 * s, 0.7 * s, '#5a4632', 0, hy - 0.08 * s, hz + 0.5 * s), cone(0.13 * s, 0.6 * s, '#5a4632', -0.2 * s, hy + 0.55 * s, hz, 4), cone(0.13 * s, 0.6 * s, '#5a4632', 0.2 * s, hy + 0.55 * s, hz, 4));
  return g;
}
/** A nothic: a hunched, gray ruin of a wizard with long claws and one great eye. */
export function nothic(d: Dims = {}): THREE.Group {
  const s = (d.scale ?? 1) * 0.95, hunch = 0.75, g = humanoid({ skin: '#6f7166', cloth: '#3e3b36', trim: '#2e2c28', hunch, claws: true, scale: s });
  const [hy, hz] = headAt(s, hunch);
  g.add(ico(0.28 * s, '#e8e0c0', 0, hy, hz + 0.35 * s), ico(0.12 * s, VOID, 0, hy, hz + 0.58 * s));
  return g;
}
/** A death slaad: a hulking, toad-headed gray brute with a greatsword. */
export function deathSlaad(d: Dims = {}): THREE.Group {
  const s = (d.scale ?? 1) * 1.3, g = humanoid({ skin: '#3d4045', cloth: '#2a2c30', trim: '#1e2024', claws: true, scale: s, weapon: 'sword', hunch: 0.15 });
  const [hy, hz] = headAt(s, 0.15);
  const jaw = box(1.0 * s, 0.4 * s, 0.9 * s, '#3d4045', 0, hy - 0.2 * s, hz + 0.25 * s); g.add(jaw, ico(0.1 * s, '#c9632e', -0.25 * s, hy + 0.15 * s, hz + 0.4 * s), ico(0.1 * s, '#c9632e', 0.25 * s, hy + 0.15 * s, hz + 0.4 * s));
  return g;
}
/** A shield guardian: a man-shaped construct of dark wood and riveted iron, helmed, its head at the ceiling. */
export function shieldGuardian(d: Dims = {}): THREE.Group {
  const s = d.scale ?? 1, W = '#4a3224', I = PALETTE.iron, g = grp();
  for (const x of [-0.9, 0.9]) g.add(box(1.2 * s, 3.8 * s, 1.2 * s, W, x * s, 1.9 * s, 0), box(1.5 * s, 0.6 * s, 1.8 * s, I, x * s, 0.3 * s, 0.2 * s));
  g.add(box(2.8 * s, 1.0 * s, 1.6 * s, I, 0, 4.2 * s, 0), box(3.2 * s, 3.0 * s, 1.9 * s, W, 0, 6.2 * s, 0), box(3.4 * s, 0.4 * s, 2.0 * s, I, 0, 5.4 * s, 0), box(3.4 * s, 0.4 * s, 2.0 * s, I, 0, 7.3 * s, 0));
  for (const x of [-1, 1]) g.add(box(1.0 * s, 3.4 * s, 1.0 * s, W, x * 2.2 * s, 5.8 * s, 0.1 * s), box(1.2 * s, 1.0 * s, 1.2 * s, I, x * 2.2 * s, 3.8 * s, 0.2 * s), box(1.3 * s, 0.9 * s, 1.3 * s, I, x * 2.2 * s, 7.5 * s, 0));
  g.add(box(1.4 * s, 1.5 * s, 1.5 * s, I, 0, 8.6 * s, 0), box(1.0 * s, 0.15 * s, 0.1 * s, VOID, 0, 8.7 * s, 0.76 * s), box(1.6 * s, 0.25 * s, 1.7 * s, I, 0, 9.4 * s, 0));
  return g;
}
/** A Barovian witch: a hag-faced woman in a tattered black gown under a tall pointed hat. */
export function witch(d: Dims = {}): THREE.Group {
  const s = d.scale ?? 1, hunch = 0.2, g = humanoid({ skin: '#c9b29a', cloth: '#1a171d', trim: '#2a2420', hair: '#2a2420', robe: true, hunch, scale: s });
  const [hy, hz] = headAt(s, hunch);
  g.add(cyl(0.9 * s, 0.9 * s, 0.08 * s, '#1a171d', 0, hy + 0.35 * s, hz, 12), cone(0.42 * s, 1.5 * s, '#1a171d', 0, hy + 1.1 * s, hz - 0.1 * s, 8));
  return g;
}
/** One of the mountain folk: a berserker in hides and furs with a heavy blade. */
export const berserker = (d: Dims = {}) => humanoid({ skin: '#c99a72', cloth: FUR, trim: '#4a3828', hair: '#3a2a1a', cloak: true, weapon: 'sword', scale: d.scale ?? 1 });
/** Helwa the gladiator: scarred, helmed, spear and harness. */
export const gladiator = (d: Dims = {}) => humanoid({ skin: '#c99a72', cloth: '#7a6a55', trim: PALETTE.iron, helm: 'cap', weapon: 'spear', scale: (d.scale ?? 1) * 1.05 });
/** Vilnius: a burned, blistered young mage in scorched robes. */
export function mage(d: Dims = {}): THREE.Group {
  const s = d.scale ?? 1, g = humanoid({ skin: '#c9a08a', cloth: '#3a4a5a', trim: '#2a2420', hair: '#3a2a1a', robe: true, weapon: 'staff', hunch: 0.3, scale: s });
  for (let i = 0; i < 4; i++) g.add(box(0.5 * s, 0.6 * s, 0.1 * s, SOOT, (hash(i) - 0.5) * 1.4 * s, (1.2 + i * 0.8) * s, 1.05 * s));
  return g;
}
/** A quasit: a tiny, horned green devil with claws. */
export function quasit(d: Dims = {}): THREE.Group {
  const s = d.scale ?? 1, hunch = 0.5, g = humanoid({ skin: '#4f6a3a', cloth: '#4f6a3a', trim: '#3a4f2a', claws: true, hunch, scale: s });
  const [hy, hz] = headAt(s, hunch);
  g.add(cone(0.1 * s, 0.5 * s, PALETTE.bone, -0.22 * s, hy + 0.5 * s, hz, 4), cone(0.1 * s, 0.5 * s, PALETTE.bone, 0.22 * s, hy + 0.5 * s, hz, 4));
  return g;
}
/** Exethanter: a decrepit lich, a skeleton in tattered robes with red points of light in its eyes. */
export function lich(d: Dims = {}): THREE.Group {
  const s = d.scale ?? 1, hunch = 0.15, g = humanoid({ skin: PALETTE.bone, cloth: '#2a2440', trim: AMBER_DK, robe: true, cloak: true, hunch, weapon: 'staff', scale: s });
  const [hy, hz] = headAt(s, hunch);
  g.add(glow(new THREE.IcosahedronGeometry(0.07 * s, 0), '#d94a3a', '#a81e1e', -0.15 * s, hy + 0.05 * s, hz + 0.4 * s), glow(new THREE.IcosahedronGeometry(0.07 * s, 0), '#d94a3a', '#a81e1e', 0.15 * s, hy + 0.05 * s, hz + 0.4 * s));
  return g;
}

Object.assign(CREATURES, {
  flameskull: (d) => flameskull(d), 'amber-golem': (d) => amberGolem(d), arcanaloth: (d) => arcanaloth(d), nothic: (d) => nothic(d), 'death-slaad': (d) => deathSlaad(d),
  'shield-guardian': (d) => shieldGuardian(d), 'x-witch': (d) => witch(d), 'x-berserker': (d) => berserker(d), 'x-gladiator': (d) => gladiator(d), 'x-mage': (d) => mage(d),
  'x-quasit': (d) => quasit(d), 'x-lich': (d) => lich(d),
} as Record<string, (d: Dims) => THREE.Group>);
