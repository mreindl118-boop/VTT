// Props and figures for one site's maps (kept in their own file so each site can be built on its own).
// Register with Object.assign(PROPS_V1, {...}) / Object.assign(CREATURES, {...}); use mat() for every material.
//
// Tsolenka Pass (ch. 9): the snowbound shelf road, its cliffs and the drop into the fog, the black gatehouse with its
// curtain of green flame, the bridge arches with their charging knights, the white tower's fittings, and the figures
// met there (petrified vrocks, the roc, Strahd's phantom rider, Sangzor, the snow maidens).
// The Werewolf Den (ch. 15): the wolf's-maw cave mouth, rock pillars, wall torches, the cages and the shrine of
// Mother Night with her hoard, the skin curtain, the ring of stones, and the pack in its three shapes.
import * as THREE from 'three';
import { PROPS_V1 } from '../props';
import { CREATURES, horse, humanoid } from '../creatures';
import { mat, matClone, patchFog } from '../../render/materials';
import { surfaceFor } from '../surfaces';
import { PALETTE } from '../palette';
import { merge } from '../pieces';

type Dims = Record<string, number>;

// ---------------------------------------------------------------- colours (each declared with what it is made of)
const ROCK = '#62656d', ROCK_DK = '#4d5058', SNOW = '#dfe3e8', SNOW_SH = '#c4cad3';
const GATE = '#38373c', GATE_TOP = '#3b3a3f', GATE_EDGE = '#2e2d32';     // the black stone of the gatehouse; the lintel is cut by the section plane
const ARCH = '#858c94', ARCH_DK = '#6c737b';                             // the bridge arches (cut by the section plane)
const STATUE = '#7d8288', STATUE_DK = '#62676e';                         // grey stone knights and vrocks
const GOLD = '#b8913f', GOLD_DK = '#8c6c2c';                             // the gold-plated knights on the tower
const FLAME = '#58d68d';
const CAVE = '#5b5752', CAVE_DK = '#48443f', CAVE_LT = '#6e6962', SLAB = '#53565d';
const WOOD_RAW = '#5e4a36', WOOD_GREY = '#6d6255', VINE = '#3f5a3a', BLOOM = '#c9c2d9';
const SKIN = '#b89a84', SKIN_DK = '#8e6f5c', ROT = '#7d8467';
const FUR_GREY = '#6a645c', FUR_DK = '#47423d', FUR_WHITE = '#d6d2c8', FUR_BROWN = '#6b543c';
surfaceFor([ROCK, ROCK_DK, CAVE_DK, CAVE_LT, SLAB], 'rock');
surfaceFor([SNOW, SNOW_SH], 'snow');
surfaceFor([GATE, GATE_TOP, GATE_EDGE, ARCH, ARCH_DK], 'ashlar');
surfaceFor([STATUE, STATUE_DK], 'stone');
surfaceFor([GOLD, GOLD_DK], 'metal');
surfaceFor([WOOD_RAW, WOOD_GREY], 'wood');
surfaceFor([VINE], 'foliage');
surfaceFor([BLOOM, SKIN, SKIN_DK, ROT], 'cloth');
surfaceFor([FUR_GREY, FUR_DK, FUR_WHITE, FUR_BROWN, '#5a4a3c', '#4f4636', '#5a4a52', '#4a3a2c', '#5a4030', '#5a4a40', '#6b4a3a'], 'cloth');

// ---------------------------------------------------------------- helpers
const box = (w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color)); m.position.set(x, y, z); return m; };
const cyl = (rt: number, rb: number, h: number, color: string, x = 0, y = 0, z = 0, seg = 8) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color)); m.position.set(x, y, z); return m; };
const cone = (r: number, h: number, color: string, x = 0, y = 0, z = 0, seg = 6) => { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(color)); m.position.set(x, y, z); return m; };
const ico = (r: number, color: string, x = 0, y = 0, z = 0, detail = 0) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), mat(color)); m.position.set(x, y, z); return m; };
const grp = (...m: THREE.Object3D[]) => { const g = new THREE.Group(); if (m.length) g.add(...m); return g; };
const hash = (a: number, b: number, c = 0) => { const s = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453; return s - Math.floor(s); };
/** A figure as few meshes as it has colours (one draw call each): hidden creatures are drawn mesh by mesh. */
function compact(g: THREE.Group): THREE.Group {
  g.updateMatrixWorld(true);
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  g.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; const mt = m.material as THREE.Material, a = byMat.get(mt) ?? []; a.push(m.geometry.clone().applyMatrix4(m.matrixWorld)); byMat.set(mt, a); });
  const out = new THREE.Group();
  for (const [mt, gs] of byMat) out.add(new THREE.Mesh(merge(gs), mt));
  return out;
}
/** Mark every mesh under `o` as building shell: the section plane slices it on a stacked site. */
const shell = <T extends THREE.Object3D>(o: T): T => { o.traverse((c) => { c.userData.role = 'roof'; }); return o; };
/** A roof over open ground (a canopy): it goes whenever the walls are cut down to a cutaway. */
const cap = <T extends THREE.Object3D>(o: T): T => { o.traverse((c) => { c.userData.role = 'roof'; c.userData.cap = true; }); return o; };
const color = (d: Dims, k: string, fallback: string) => (d[k] !== undefined ? '#' + d[k].toString(16).padStart(6, '0') : fallback);

/** A jagged sheet from rows of points: rows[j][i] = [x, y, z]. Faces facing up (|n.y| > snowY) take `top`, the rest `side`. */
function sheet(rows: [number, number, number][][], side: string, top: string | null, snowY = 0.62, flip = false): THREE.Group {
  const sideP: number[] = [], topP: number[] = [];
  const tri = (a: number[], b0: number[], c0: number[]) => {
    const [b, c] = flip ? [c0, b0] : [b0, c0];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
    (top && ny / l > snowY ? topP : sideP).push(...a, ...b, ...c);
  };
  for (let j = 0; j + 1 < rows.length; j++) for (let i = 0; i + 1 < rows[j].length; i++) {
    const a = rows[j][i], b = rows[j][i + 1], c = rows[j + 1][i], e = rows[j + 1][i + 1];
    tri(a, c, b); tri(b, c, e);
  }
  const g = grp();
  for (const [P, col] of [[sideP, side], [topP, top]] as const) {
    if (!P.length || !col) continue;
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, mat(col)));
  }
  return g;
}

// ================================================================ Tsolenka Pass
/** The mountain rising beside the road: a steep, broken rock face from the shelf's edge (local z = 0) climbing to `h` ft
 *  over `d` ft back (toward local -z), `len` ft along local x. Snow lies on every ledge flat enough to hold it. */
function rockFlank(d: Dims): THREE.Group {
  const L = d.len ?? 30, H = d.h ?? 90, D = d.d ?? 120, s = d.seed ?? 1, nx = Math.max(3, Math.round(L / 7));
  const prof: [number, number][] = [[0, 0], [0.025, 0.22], [0.07, 0.46], [0.15, 0.64], [0.3, 0.77], [0.55, 0.88], [0.8, 0.95], [1, 1]];
  const rows: [number, number, number][][] = [];
  for (let j = 0; j < prof.length; j++) {
    const row: [number, number, number][] = [];
    for (let i = 0; i <= nx; i++) {
      const t = i / nx, edge = i === 0 || i === nx;
      const face = j <= 3, x = -L / 2 + t * L + (edge || !face ? 0 : (hash(i, j, s) - 0.5) * (L / nx) * 0.35);
      // the cliff face is broken; the snowfield above it lies smooth (so neighbouring pieces meet in one surface)
      const y = j === 0 ? -0.5 : prof[j][1] * H * (face ? 0.9 + 0.18 * hash(i, j + 9, s) : 1) * (edge && face ? 0.95 : 1);
      const z = j === 0 ? 0 : -prof[j][0] * D - (face ? (hash(i + 3, j, s) - 0.4) * 2.5 : 0);
      row.push([x, y, z]);
    }
    rows.push(row);
  }
  const g = sheet(rows, ROCK, d.snow === 0 ? null : SNOW, 0.5, true);
  // boulders fallen at the foot of the face, and drifted snow against it
  const nb = Math.max(1, Math.round(L / 14));
  for (let k = 0; k < nb; k++) {
    const r = 1.2 + hash(k, 5, s) * 1.6, x = -L / 2 + (k + 0.5) * (L / nb);
    const b = ico(r, ROCK_DK, x, r * 0.3, -1.2 - hash(k, 7, s) * 1.5, 0); b.scale.y = 0.6; g.add(b);
    if (d.snow !== 0) { const dr = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), mat(SNOW)); dr.scale.set(L / nb * 0.45, 1.2, 2.6); dr.position.set(x + L / nb * 0.3, 0.1, -1.4); g.add(dr); }
  }
  return g;
}
/** The drop beside the road: from the shelf's lip (local z = 0) the rock falls `depth` ft, stepping out `d` ft toward local +z,
 *  lost in the fog below. A rim of snow-crusted stones marks the lip. */
function precipice(d: Dims): THREE.Group {
  const L = d.len ?? 30, Dp = d.depth ?? 260, D = d.d ?? 70, s = d.seed ?? 1, nx = Math.max(3, Math.round(L / 6));
  const prof: [number, number][] = [[0, 0.02], [0.04, -0.06], [0.12, -0.22], [0.3, -0.45], [0.55, -0.7], [1, -1]];
  const rows: [number, number, number][][] = [];
  for (let j = 0; j < prof.length; j++) {
    const row: [number, number, number][] = [];
    for (let i = 0; i <= nx; i++) {
      const t = i / nx, edge = i === 0 || i === nx;
      const x = -L / 2 + t * L + (edge ? 0 : (hash(i, j, s + 4) - 0.5) * (L / nx) * 0.5);
      const y = j === 0 ? 0.05 : prof[j][1] * Dp * (0.85 + 0.3 * hash(i, j + 2, s));
      const z = j === 0 ? 0 : prof[j][0] * D + (hash(i + 1, j, s) - 0.3) * 5;
      row.push([x, y, z]);
    }
    rows.push(row);
  }
  const g = sheet(rows, ROCK_DK, SNOW_SH, 0.7);
  for (let k = 0; k < Math.round(L / 9); k++) { const r = 0.6 + hash(k, 2, s) * 0.9, b = ico(r, k % 3 ? ROCK : SNOW_SH, -L / 2 + (k + 0.5) * 9, r * 0.25, 0.6, 0); b.scale.y = 0.55; g.add(b); }
  return g;
}
/** The sea of fog the road looks out over: a wide pale sheet (two layers) far below the shelf. */
function fogSea(d: Dims): THREE.Group {
  const r = d.r ?? 1400, y = d.y ?? -70, g = grp();
  for (const [dy, op, c] of [[0, 0.62, '#c3c8d0'], [-50, 0.8, '#a2a8b3'], [-120, 0.97, '#7f8592']] as const) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = y + dy; m.renderOrder = -1; g.add(m);
  }
  return g;
}
/** A drift of snow banked against a wall or a rock: a low, long mound. */
function snowDrift(d: Dims): THREE.Group {
  const r = d.r ?? 4, h = d.h ?? 1.6, m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), mat(SNOW));
  m.scale.set(r, h, r * (d.long ?? 0.55)); m.position.y = h * 0.25; return grp(m);
}
/** The gatehouse across the road (p.157): two piers of black stone 30 ft high either side of a 10-ft passage, the lintel over
 *  it, and a 20-ft spiked wall run out to the cliffs on each side. Local x runs across the road, z along it (+z west, outside). */
function gatehouse(d: Dims): THREE.Group {
  const pw = d.pw ?? 10, pd = d.pd ?? 10, pier = d.pier ?? 10, wl = d.wl ?? 10, wt = d.wt ?? 5, H = d.h ?? 30, WH = d.wh ?? 20, ly = d.ly ?? 20;
  const g = grp();
  for (const sx of [-1, 1]) {
    const cx = sx * (pw / 2 + pier / 2);
    g.add(box(pier, H - 0.3, pd, GATE, cx, (H - 0.3) / 2, 0));
    g.add(box(pier + 0.8, 1, pd + 0.8, GATE_EDGE, cx, 0.5, 0), box(pier + 0.6, 0.8, pd + 0.6, GATE_EDGE, cx, H - 2.4, 0));       // plinth and string course
    // the wall to the cliff: 20 ft of black stone, a coping, a double row of stone spikes along its top
    const wx = sx * (pw / 2 + pier + wl / 2);
    g.add(box(wl + 0.4, WH, wt, GATE, wx, WH / 2, 0), box(wl + 0.6, 0.6, wt + 0.6, GATE_EDGE, wx, WH + 0.3, 0));
    for (let k = 0; k < wl / 2; k++) for (const z of [-wt / 4, wt / 4]) g.add(cone(0.4, 2.6, GATE_EDGE, sx * (pw / 2 + pier + 1 + k * 2), WH + 1.9, z + (k % 2 ? 0.4 : -0.4), 4));
    // spikes jutting from the outer (west) face, at head height and higher
    for (let k = 0; k < wl / 2.5; k++) for (const y of [9, 14]) { const sp = cone(0.35, 2.2, GATE_EDGE, sx * (pw / 2 + pier + 1.2 + k * 2.5), y + (k % 2), wt / 2 + 1, 4); sp.rotation.x = Math.PI / 2; g.add(sp); }
    // the jambs of the pointed arch on both faces
    for (const sz of [-1, 1]) g.add(box(1.2, ly, 0.6, GATE_EDGE, sx * (pw / 2 + 0.6), ly / 2, sz * (pd / 2 + 0.3)));
  }
  // the lintel over the passage, from the arch's spring to the top: cut away with the shell on a stacked site
  const lintel = shell(grp(box(pw + 0.2, H - ly - 0.3, pd, GATE_TOP, 0, ly + (H - ly - 0.3) / 2, 0)));
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) { const r = box(Math.hypot(pw / 2, 4), 1.1, 0.7, GATE_TOP, sx * pw / 4, ly + 2, sz * (pd / 2 + 0.3)); r.rotation.z = -sx * Math.atan2(4, pw / 2); lintel.add(r); }
  g.add(lintel);
  return g;
}
/** The curtain of green flame filling the gate's eastern arch: sheets of cold green fire, tongues licking up. */
function flameCurtain(d: Dims): THREE.Group {
  const w = d.w ?? 10, h = d.h ?? 18, g = grp();
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.4, h - i * 3), patchFog(new THREE.MeshBasicMaterial({ color: i ? '#8ef0b2' : FLAME, transparent: true, opacity: 0.5 - i * 0.12, side: THREE.DoubleSide, depthWrite: false })));
    m.position.set(0, (h - i * 3) / 2, (i - 1) * 0.6); g.add(m);
  }
  for (let k = 0; k < 7; k++) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3 + hash(k, 1) * 3, 5), patchFog(new THREE.MeshBasicMaterial({ color: '#b8f5cf', transparent: true, opacity: 0.6, depthWrite: false }))); t.position.set(-w / 2 + 0.9 + k * ((w - 1.8) / 6), h - 1 + hash(k, 3) * 1.5, 0); g.add(t); }
  const base = new THREE.Mesh(new THREE.BoxGeometry(w - 0.4, 0.3, 1.6), patchFog(new THREE.MeshBasicMaterial({ color: '#2f7a4c' }))); base.position.y = 0.15; g.add(base);
  return g;
}
/** The stone bridge's body under its deck (p.159): spandrels down to one great arch springing from the gorge walls `drop`
 *  ft below. Runs `len` ft along local z, `w` ft wide; its top lies just under the deck's floor. */
function bridgeSpan(d: Dims): THREE.Group {
  const L = d.len ?? 70, w = d.w ?? 10, S = d.drop ?? 70, c = d.crown ?? 5, pts: THREE.Vector2[] = [new THREE.Vector2(-L / 2, -1), new THREE.Vector2(L / 2, -1), new THREE.Vector2(L / 2, -S)];
  for (let i = 1; i < 16; i++) { const t = i / 16, z = L / 2 - t * L, k = 1 - (2 * z / L) ** 2; pts.push(new THREE.Vector2(z, -S + (S - c) * Math.sqrt(Math.max(0, k)))); }
  pts.push(new THREE.Vector2(-L / 2, -S));
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: w, bevelEnabled: false }); geo.translate(0, 0, -w / 2); geo.rotateY(Math.PI / 2);
  const g = grp(new THREE.Mesh(geo, mat(ARCH_DK)));
  for (const sx of [-1, 1]) g.add(box(0.8, 1.2, L, ARCH, sx * (w / 2 + 0.2), -1.6, 0));        // the string course under the parapets
  return g;
}
/** The masonry over a bridge arch (p.159): 30 ft wide, 10 ft deep, from `y0` to `y1`, with a cornice and two round plinths
 *  over the guard posts. Cut away with the shell on a stacked site, so the guard posts below stay in view. */
function archCrown(d: Dims): THREE.Group {
  const w = d.w ?? 30, dp = d.d ?? 10, y0 = d.y0 ?? 20, y1 = d.y1 ?? 30, g = grp();
  g.add(box(w, y1 - y0, dp, ARCH, 0, (y0 + y1) / 2, 0), box(w + 1, 0.8, dp + 1, ARCH_DK, 0, y1 - 0.4, 0), box(w + 0.6, 0.6, dp + 0.6, ARCH_DK, 0, y0 + 0.3, 0));
  // the pointed arch over the road on both faces
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) { const r = box(6.4, 1.2, 0.6, ARCH_DK, sx * 2.6, y0 + 2.2, sz * (dp / 2 + 0.3)); r.rotation.z = -sx * 0.55; g.add(r); }
  for (const sx of [-1, 1]) { const p = cyl(4.2, 4.4, 1.2, ARCH_DK, sx * (w / 2 - 5), y1 + 0.6, 0, 12); g.add(p); }
  return shell(g);
}
/** A mounted knight with a couched lance, charging along local +x, on the arch's plinth (`y` up). Grey stone; `broken` leaves
 *  only the horse's hindquarters and a scatter of fallen pieces. Cut with the arch on a stacked site. */
function knightRider(d: Dims): THREE.Group {
  const y = d.y ?? 0, s = d.scale ?? 1.25, g = grp();
  if (d.broken) {
    g.add(box(3.4 * s, 3.2 * s, 2.6 * s, STATUE, -1.6 * s, y + 3.6 * s, 0));
    for (const z of [-0.8, 0.8]) g.add(cyl(0.45 * s, 0.35 * s, 3 * s, STATUE, -2.6 * s, y + 1.5 * s, z * s, 6));
    for (let k = 0; k < 7; k++) g.add(ico(0.6 + hash(k, 2) * 0.8, STATUE_DK, (hash(k, 4) - 0.2) * 6, y + 0.4, (hash(k, 6) - 0.5) * 6));
    return shell(g);
  }
  const body = box(6.4 * s, 3 * s, 2.6 * s, STATUE, 0, y + 4.6 * s, 0);
  g.add(body);
  for (const [x, z] of [[-2.4, -0.8], [2.4, -0.8], [-2.4, 0.8], [2.4, 0.8]]) { const l = cyl(0.45 * s, 0.35 * s, 3.4 * s, STATUE, x * s, y + 1.7 * s, z * s, 6); l.rotation.z = x > 0 ? 0.35 : -0.3; g.add(l); }   // legs at the gallop
  const neck = box(1.6 * s, 3.6 * s, 1.6 * s, STATUE, 3.5 * s, y + 6.4 * s, 0); neck.rotation.z = -0.5; g.add(neck);
  const head = box(3 * s, 1.3 * s, 1.3 * s, STATUE, 4.8 * s, y + 7.8 * s, 0); head.rotation.z = -0.3; g.add(head);
  const tail = cone(0.6 * s, 3 * s, STATUE_DK, -3.6 * s, y + 4.4 * s, 0); tail.rotation.z = 2.2; g.add(tail);
  // the rider: armoured torso leaning into the charge, a great helm, a shield, the lance couched forward
  const torso = box(1.8 * s, 3.2 * s, 2 * s, STATUE_DK, 0.6 * s, y + 7.6 * s, 0); torso.rotation.z = -0.25; g.add(torso);
  g.add(box(1.3 * s, 1.4 * s, 1.3 * s, STATUE_DK, 1.2 * s, y + 9.8 * s, 0), box(0.3 * s, 2.4 * s, 2 * s, STATUE, 0.8 * s, y + 7.6 * s, 1.3 * s));
  const lance = cyl(0.18 * s, 0.32 * s, 13 * s, STATUE_DK, 5 * s, y + 7.7 * s, -0.9 * s, 6); lance.rotation.z = -Math.PI / 2 + 0.06; g.add(lance);
  for (const z of [-1.2, 1.2]) g.add(box(0.4 * s, 2.4 * s, 0.4 * s, STATUE_DK, 0.4 * s, y + 5.6 * s, z * s));
  return shell(g);
}
/** One of the tower's crowning statues (p.159): a 10-ft gold-plated knight, a woman in plate holding a lance upright. */
function goldKnight(d: Dims): THREE.Group {
  const s = (d.h ?? 10) / 10, g = grp(box(2.6 * s, 0.8 * s, 2.6 * s, GOLD_DK, 0, 0.4 * s, 0));
  for (const x of [-0.45, 0.45]) g.add(cyl(0.38 * s, 0.32 * s, 3.8 * s, GOLD, x * s, 2.7 * s, 0, 6));
  const skirt = cyl(0.9 * s, 1.25 * s, 1.8 * s, GOLD_DK, 0, 4.2 * s, 0, 7); g.add(skirt);
  const torso = cyl(1.05 * s, 0.85 * s, 2.6 * s, GOLD, 0, 6.2 * s, 0, 7); torso.scale.z = 0.7; g.add(torso);
  for (const x of [-1.15, 1.15]) g.add(ico(0.45 * s, GOLD, x * s, 7.4 * s, 0), cyl(0.28 * s, 0.24 * s, 2.6 * s, GOLD, x * 1.1 * s, 6.1 * s, 0.2 * s, 6));
  g.add(cyl(0.55 * s, 0.6 * s, 1.1 * s, GOLD, 0, 8.3 * s, 0, 8), cone(0.62 * s, 0.6 * s, GOLD_DK, 0, 9.1 * s, 0, 8));
  g.add(cyl(0.12 * s, 0.12 * s, 10.5 * s, GOLD_DK, 1.25 * s, 5.4 * s, 0.35 * s, 6), cone(0.25 * s, 1.1 * s, GOLD, 1.25 * s, 11.1 * s, 0.35 * s, 5));
  g.add(box(0.25 * s, 2.6 * s, 1.8 * s, GOLD_DK, -1.25 * s, 6 * s, 0.4 * s));
  return g;
}
/** A petrified vrock on its plinth (p.157): a hunched vulture-demon with a horned head and half-spread wings, in grey stone. */
function vrockStatue(d: Dims): THREE.Group {
  const g = vrockBody(STATUE, STATUE_DK, d.scale ?? 1);
  const out = grp(box(7, 1, 7, GATE_EDGE, 0, 0.5, 0)); g.position.y = 1; out.add(g); return out;
}
function vrockBody(c: string, dk: string, s: number): THREE.Group {
  const g = grp();
  for (const x of [-0.9, 0.9]) { const l = cyl(0.5 * s, 0.3 * s, 3.4 * s, dk, x * s, 1.7 * s, 0, 6); g.add(l); for (let k = -1; k <= 1; k++) g.add(box(0.15 * s, 0.15 * s, 1.1 * s, dk, x * s + k * 0.3 * s, 0.1 * s, 0.5 * s)); }
  const body = ico(2.1 * s, c, 0, 5 * s, 0.2 * s, 1); body.scale.set(1, 1.25, 0.85); g.add(body);
  const neck = cyl(0.6 * s, 0.9 * s, 1.6 * s, dk, 0, 7.4 * s, 1 * s, 6); neck.rotation.x = 0.7; g.add(neck);
  g.add(ico(0.95 * s, c, 0, 8.1 * s, 1.9 * s, 1));
  const beak = cone(0.42 * s, 1.6 * s, dk, 0, 7.8 * s, 3 * s, 5); beak.rotation.x = Math.PI / 2 + 0.5; g.add(beak);
  for (const x of [-0.55, 0.55]) { const h = cone(0.22 * s, 1.5 * s, dk, x * s, 9.1 * s, 1.6 * s, 5); h.rotation.z = -x * 0.8; g.add(h); }
  for (const sx of [-1, 1]) {   // half-spread wings, ragged
    const w = grp(); w.position.set(sx * 1.6 * s, 6.4 * s, -0.6 * s); w.rotation.set(0.3, sx * 0.5, sx * -0.6);
    w.add(box(5 * s, 0.35 * s, 2.6 * s, dk, sx * 2.5 * s, 0, 0));
    for (let k = 0; k < 4; k++) w.add(box(1 * s, 0.25 * s, 1.6 * s, c, sx * (1.2 + k * 1.1) * s, -0.15 * s, -1.6 * s));
    g.add(w);
  }
  for (const sx of [-1, 1]) { const a = cyl(0.3 * s, 0.25 * s, 3 * s, dk, sx * 1.9 * s, 4.6 * s, 1 * s, 6); a.rotation.x = -0.6; g.add(a); }
  return g;
}
/** A dire wolf's head mounted on a board above the hearth (`y` up). */
function direWolfHead(d: Dims): THREE.Group {
  const y = d.y ?? 8.5, g = grp(box(2.4, 2, 0.35, PALETTE.woodDark, 0, y, 0));
  const head = box(1.6, 1.4, 1.8, FUR_DK, 0, y, 1); g.add(head, box(0.9, 0.7, 1.4, FUR_DK, 0, y - 0.3, 2.3), box(0.3, 0.25, 0.3, '#141218', 0, y - 0.2, 3));
  for (const x of [-0.55, 0.55]) g.add(cone(0.3, 0.8, FUR_DK, x, y + 1, 0.8, 4), ico(0.09, PALETTE.amber, x * 0.6, y + 0.25, 1.9));
  for (const x of [-0.3, 0.3]) g.add(cone(0.08, 0.35, PALETTE.bone, x, y - 0.75, 2.7, 4));
  return g;
}
/** A rusted iron ladder bolted to floor and ceiling, `h` ft. */
function ironLadder(d: Dims): THREE.Group {
  const h = d.h ?? 20, g = grp(box(0.25, h, 0.25, '#5a3f30', -0.8, h / 2, 0), box(0.25, h, 0.25, '#5a3f30', 0.8, h / 2, 0));
  for (let y = 1; y < h; y += 1.1) g.add(box(1.6, 0.14, 0.14, '#5a3f30', 0, y, 0));
  return g;
}
/** Merlons round the parapet of an octagonal roof: `r` ft to the flat faces, standing on the wall top at `y`. */
function octaMerlons(d: Dims): THREE.Group {
  const r = d.r ?? 15, y = d.y ?? 3.5, side = 2 * r * Math.tan(Math.PI / 8), g = grp();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4, cx = Math.cos(a) * r, cz = Math.sin(a) * r;
    for (const t of [-0.3, 0.3]) { const m = box(1.8, 2.2, 1, ARCH, cx - Math.sin(a) * t * side, y + 1.1, cz + Math.cos(a) * t * side); m.rotation.y = -a + Math.PI / 2; g.add(m); }
  }
  return shell(g);
}
/** The stone ribs at the corners of an octagonal tower (radius `r` to the flat faces, `h` high). */
function towerRibs(d: Dims): THREE.Group {
  const r = d.r ?? 16, h = d.h ?? 40, g = grp();
  for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + (i * Math.PI) / 4, R = r / Math.cos(Math.PI / 8) + 0.5; const b = box(1.6, h, 1.6, ARCH_DK, Math.cos(a) * R, h / 2, Math.sin(a) * R); b.rotation.y = -a; g.add(b); }
  return shell(g);
}

// ---------------------------------------------------------------- Tsolenka figures
function vrock(): THREE.Group { return vrockBody('#5d6b55', '#3f4a3a', 1); }
/** The Roc of Mount Ghakis: a vast raptor gliding on swept wings (about 80 ft across), well above its base. */
function roc(d: Dims): THREE.Group {
  const s = d.scale ?? 1, c = '#5e4c3a', dk = '#3d3128', lt = '#8a7458', lift = d.lift ?? 30, g = grp();
  const body = ico(4.2 * s, c, 0, lift, 0, 1); body.scale.set(2.3, 0.85, 1); g.add(body);
  const breast = ico(3 * s, lt, 4 * s, lift - 1.2 * s, 0, 1); breast.scale.set(1.4, 0.8, 0.9); g.add(breast);
  g.add(ico(2.2 * s, dk, 10.5 * s, lift + 1.4 * s, 0, 1));
  const beak = cone(0.9 * s, 3.4 * s, '#c9a34a', 13 * s, lift + 0.6 * s, 0, 5); beak.rotation.z = -Math.PI / 2 - 0.55; g.add(beak);
  for (const z of [-0.8, 0.8]) g.add(ico(0.3 * s, PALETTE.amber, 11.6 * s, lift + 2 * s, z * s));
  // swept wings: a leading edge out to the tip, the trailing edge ragged with primaries
  for (const sz of [-1, 1]) {
    const P = [[3, 0], [4, 10], [2, 22], [-3, 38], [-6, 36], [-7, 32], [-9, 30], [-10, 24], [-11, 18], [-10, 10], [-8, 0]].map(([x, z]) => new THREE.Vector2(x * s, z * s * sz));
    const geo = new THREE.ExtrudeGeometry(new THREE.Shape(sz > 0 ? P : P.reverse()), { depth: 0.9 * s, bevelEnabled: false }); geo.rotateX(Math.PI / 2);
    const w = new THREE.Mesh(geo, mat(c)); w.position.set(0, lift + 1.4 * s, 0); w.rotation.x = sz * 0.12; g.add(w);
    for (let k = 0; k < 5; k++) { const f = box(4 * s, 0.6 * s, 1.6 * s, dk, -9 * s - k * 0.4 * s, lift + 0.9 * s, sz * (14 + k * 5) * s); f.rotation.y = sz * 0.25; g.add(f); }
  }
  const tail = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape([[-6, -2.5], [-15, -6], [-16, 0], [-15, 6], [-6, 2.5]].map(([x, z]) => new THREE.Vector2(x * s, z * s))), { depth: 0.7 * s, bevelEnabled: false }).rotateX(Math.PI / 2), mat(dk));
  tail.position.y = lift + 0.5 * s; g.add(tail);
  for (const z of [-1.6, 1.6]) { const t = cyl(0.5 * s, 0.3 * s, 6 * s, '#c9a34a', 1 * s, lift - 5 * s, z * s, 5); t.rotation.z = 0.4; g.add(t); for (let k = -1; k <= 1; k++) g.add(cone(0.25 * s, 1.4 * s, dk, 2.6 * s + k * 0.6 * s, lift - 8.2 * s, z * s, 4)); }
  g.add(cyl(0.12, 0.12, lift - 6, PALETTE.mist2, 0, (lift - 6) / 2, 0, 4));   // a flight stem down to the base, so the token reads
  return g;
}
/** Strahd's grim warning on the bridge (p.159): a black-cloaked rider on a charcoal horse. */
function phantomRider(): THREE.Group {
  const h = horse({}); h.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.material = mat('#2c2b30'); });
  const rider = humanoid({ skin: '#cfcfd6', cloth: '#141218', trim: '#141218', cloak: true, scale: 0.95, hair: '#141218' });
  rider.position.set(-0.4, 4.6, 0); rider.rotation.y = Math.PI / 2;
  return grp(h, rider);
}
/** Sangzor, the Bloodhorn (p.160): a nine-foot goat, grey as the mountain, with great ridged horns. */
function giantGoat(): THREE.Group {
  const c = '#7b7770', dk = '#57534d', g = grp();
  const body = ico(2.2, c, 0, 5.2, 0, 1); body.scale.set(1.9, 1, 1); g.add(body);
  for (const [x, z] of [[-2.6, -0.9], [2.6, -0.9], [-2.6, 0.9], [2.6, 0.9]]) g.add(cyl(0.38, 0.28, 4.4, c, x, 2.2, z, 6), box(0.6, 0.4, 0.6, '#2b2420', x, 0.2, z));
  const neck = cyl(0.9, 1.2, 3, c, 3.6, 7, 0, 6); neck.rotation.z = -0.6; g.add(neck);
  const head = box(2.4, 1.3, 1.2, c, 5.2, 8.2, 0); head.rotation.z = -0.35; g.add(head);
  g.add(box(0.5, 1.3, 0.4, dk, 5.6, 7.1, 0));                                                     // beard
  for (const z of [-0.5, 0.5]) { const hr = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.32, 5, 10, Math.PI * 1.3), mat('#3d3833')); hr.position.set(4.4, 9.4, z); hr.rotation.set(0, z > 0 ? 0.25 : -0.25, Math.PI * 0.6); g.add(hr); }
  for (const z of [-0.35, 0.35]) g.add(ico(0.12, '#c9632e', 5.9, 8.7, z));
  return g;
}
const GHOSTLY = new Map<string, THREE.MeshLambertMaterial>();
/** A snow maiden: the swirling snow in the shape of a thin young woman (specter statistics). */
function snowMaiden(): THREE.Group {
  const f = humanoid({ skin: '#eef2f7', cloth: '#dfe6ef', trim: '#cfd8e3', robe: true, hair: '#f4f7fb', scale: 0.95 });
  f.position.y = 0.8;
  const g = grp(f);
  g.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; const hex = '#' + (m.material as THREE.MeshLambertMaterial).color.getHexString(); let nm = GHOSTLY.get(hex); if (!nm) { nm = matClone(hex); nm.transparent = true; nm.opacity = 0.45; nm.depthWrite = false; GHOSTLY.set(hex, nm); } m.material = nm; });
  return g;
}

// ================================================================ Werewolf Den
/** The cave mouth carved like a great wolf's head (p.202): the upper jaw a canopy of rock 15 ft up over the mouth, its
 *  fangs the natural pillars that hold it, the brow and ears above. Local +z runs out of the cave. The canopy is a
 *  roof over open ground: it goes when the walls are cut down. `w` wide, `d` deep. */
function wolfMaw(d: Dims): THREE.Group {
  const w = d.w ?? 36, dp = d.d ?? 30, h = d.h ?? 15, g = grp();
  // the muzzle: broad where it leaves the mountain, narrowing to the nose
  const half: [number, number][] = [[0.5, 0], [0.49, 0.18], [0.44, 0.4], [0.36, 0.62], [0.27, 0.8], [0.18, 0.93], [0.07, 1]];
  const rim = [...half.map(([x, z]) => [x * w, z * dp] as [number, number]), ...half.slice().reverse().map(([x, z]) => [-x * w, z * dp] as [number, number])];
  const slab = new THREE.ExtrudeGeometry(new THREE.Shape(rim.map(([x, z]) => new THREE.Vector2(x, z))), { depth: 4, bevelEnabled: false }); slab.rotateX(Math.PI / 2); slab.translate(0, h + 4, 0);
  const muzzle = grp(new THREE.Mesh(slab, mat(CAVE_DK)));
  muzzle.add(box(w * 0.3, 2.4, dp * 0.55, CAVE_DK, 0, h + 5, dp * 0.42));                                        // the ridge of the nose
  muzzle.add(box(6, 3.4, 4.5, '#2b2826', 0, h + 3.6, dp - 1.6), ico(1.2, '#1d1b1a', -1.4, h + 4.2, dp + 0.4, 0), ico(1.2, '#1d1b1a', 1.4, h + 4.2, dp + 0.4, 0));
  // the brow, the glaring eyes and the ears, rising off the mountain behind the jaw
  muzzle.add(box(w * 0.8, 7, 6, CAVE_DK, 0, h + 6.5, 1.5));
  for (const sx of [-1, 1]) {
    const ear = cone(3.6, 10, CAVE_DK, sx * w * 0.32, h + 14, -1, 4); ear.rotation.z = -sx * 0.18; muzzle.add(ear);
    const eye = ico(1.3, PALETTE.amber, sx * w * 0.18, h + 7.5, 4.6, 0); eye.scale.set(1.4, 0.7, 0.6); muzzle.add(eye);
  }
  g.add(cap(muzzle));
  // the upper fangs hanging from the jaw's rim
  const fangs = grp();
  for (let i = 1; i < rim.length - 1; i++) { if (i === half.length - 1 || i === half.length) continue; const [x, z] = rim[i]; const f = cone(0.9, 3.4, '#d8d2c2', x * 0.94, h - 1.3, z * 0.94, 5); f.rotation.x = Math.PI; fangs.add(f); }
  g.add(cap(fangs));
  return g;
}
/** A natural pillar of rock floor to ceiling (`h` ft, about `r` ft through), knobbly and leaning a little. */
function rockPillar(d: Dims): THREE.Group {
  const r = d.r ?? 3, h = d.h ?? 20, s = d.seed ?? 1, geo = new THREE.CylinderGeometry(r * 0.8, r * 1.15, h, 7, 4);
  const pv = geo.attributes.position;
  for (let i = 0; i < pv.count; i++) { const k = 0.82 + 0.36 * hash(Math.round(pv.getY(i) * 3), Math.round(Math.atan2(pv.getZ(i), pv.getX(i)) * 3), s); pv.setX(i, pv.getX(i) * k); pv.setZ(i, pv.getZ(i) * k); }
  geo.translate(0, h / 2, 0); geo.computeVertexNormals();
  return grp(new THREE.Mesh(geo, mat(d.light ? CAVE_LT : CAVE)));
}
/** An iron wall bracket holding a burning torch, at `y` up on the wall (local -z is the wall). */
function wallTorch(d: Dims): THREE.Group {
  const y = d.y ?? 6.5, g = grp(box(0.3, 0.9, 0.25, PALETTE.iron, 0, y - 0.6, -0.2), box(0.2, 0.2, 0.8, PALETTE.iron, 0, y - 0.6, 0.15));
  const t = cyl(0.12, 0.09, 1.6, PALETTE.woodDark, 0, y, 0.45, 5); t.rotation.x = 0.35; g.add(t);
  const fl = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 5), patchFog(new THREE.MeshBasicMaterial({ color: '#f2a03a' }))); fl.position.set(0, y + 1, 0.75); g.add(fl);
  return g;
}
/** A wooden cage of lashed poles about 7 ft square, its lid weighed down with a heavy rock (p.204). `open` leaves the lid off. */
function wolfCage(d: Dims): THREE.Group {
  const w = d.w ?? 7, h = d.h ?? 5, g = grp(box(w, 0.3, w, WOOD_RAW, 0, 0.15, 0));
  for (let i = 0; i <= 5; i++) { const t = -w / 2 + 0.2 + i * ((w - 0.4) / 5); for (const [x, z] of [[t, -w / 2 + 0.2], [t, w / 2 - 0.2], [-w / 2 + 0.2, t], [w / 2 - 0.2, t]] as const) g.add(cyl(0.12, 0.14, h, i % 2 ? WOOD_RAW : WOOD_GREY, x, h / 2, z, 5)); }
  for (const y of [1.2, h - 0.3]) for (const [x, z, ry] of [[0, -w / 2 + 0.2, 0], [0, w / 2 - 0.2, 0], [-w / 2 + 0.2, 0, Math.PI / 2], [w / 2 - 0.2, 0, Math.PI / 2]] as const) { const r = box(w, 0.25, 0.25, WOOD_RAW, x, y, z); r.rotation.y = ry; g.add(r); }
  if (!d.open) { for (let i = 0; i < 5; i++) g.add(box(w - 0.2, 0.22, 0.4, WOOD_GREY, 0, h + 0.1, -w / 2 + 0.7 + i * ((w - 1.4) / 4))); const rock = ico(1.3, CAVE_LT, 0.4, h + 1.1, -0.3, 0); rock.scale.y = 0.7; g.add(rock); }
  else { const lid = grp(); for (let i = 0; i < 5; i++) lid.add(box(w - 0.2, 0.22, 0.4, WOOD_GREY, 0, 0, -w / 2 + 0.7 + i * ((w - 1.4) / 4))); lid.position.set(w * 0.35, 0.4, 0.6); lid.rotation.set(0, 0.4, 0.05); g.add(lid); g.add(ico(1.3, CAVE_LT, w * 0.75, 0.8, -1.2, 0)); }
  return g;
}
/** Mother Night (p.204): a crude wooden statue of a wolf-headed woman, garlanded in vines and pale night flowers. */
function motherNight(d: Dims): THREE.Group {
  const s = (d.h ?? 9) / 9, g = grp(box(3.4 * s, 0.6 * s, 3.4 * s, WOOD_RAW, 0, 0.3 * s, 0));
  const body = cyl(0.9 * s, 1.6 * s, 5.4 * s, WOOD_RAW, 0, 3.3 * s, 0, 7); g.add(body);
  g.add(cyl(0.75 * s, 0.9 * s, 1.4 * s, WOOD_RAW, 0, 6.6 * s, 0, 7));
  for (const sx of [-1, 1]) { const a = cyl(0.28 * s, 0.32 * s, 3.4 * s, WOOD_RAW, sx * 1.2 * s, 5.2 * s, 0.4 * s, 5); a.rotation.set(-0.5, 0, sx * 0.2); g.add(a); }
  // the wolf's head: a block with a long snout and tall ears, roughly adzed
  g.add(box(1.5 * s, 1.5 * s, 1.6 * s, WOOD_GREY, 0, 7.9 * s, 0), box(0.9 * s, 0.8 * s, 1.6 * s, WOOD_GREY, 0, 7.6 * s, 1.4 * s));
  for (const x of [-0.5, 0.5]) g.add(cone(0.3 * s, 1.1 * s, WOOD_GREY, x * s, 9.1 * s, -0.1 * s, 4), ico(0.1 * s, '#e8dfc8', x * 0.5 * s, 8.1 * s, 0.8 * s));
  // garlands: vines spiralling the body, white night-blooms in them
  for (let k = 0; k < 14; k++) { const a = k * 1.1, y = 1.4 + k * 0.42; g.add(ico(0.32 * s, k % 3 ? VINE : BLOOM, Math.cos(a) * (1.55 - y * 0.08) * s, y * s, Math.sin(a) * (1.55 - y * 0.08) * s)); }
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; g.add(ico(0.26 * s, k % 2 ? BLOOM : VINE, Math.cos(a) * 0.95 * s, 7.1 * s, Math.sin(a) * 0.95 * s)); }
  return g;
}
/** The hoard piled at the statue's base: drifts of coin, gems, jewellery, a drinking horn and a censer. */
function hoard(d: Dims): THREE.Group {
  const r = d.r ?? 4, g = grp();
  for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2 + 0.3, rr = r * (0.55 + 0.35 * hash(k, 1)); const m = ico(0.9 + hash(k, 2) * 0.6, k % 3 === 0 ? '#9a6b3c' : k % 3 === 1 ? '#b9bec6' : '#c9a34a', Math.cos(a) * rr, 0.2, Math.sin(a) * rr, 0); m.scale.y = 0.35; g.add(m); }
  for (let k = 0; k < 10; k++) { const a = k * 2.3, rr = r * (0.4 + 0.5 * hash(k, 5)); g.add(ico(0.18, ['#7a1f2b', '#2f5a6b', '#5b4a6b', '#e8dfc8'][k % 4], Math.cos(a) * rr, 0.55, Math.sin(a) * rr)); }
  const horn = cone(0.35, 2, PALETTE.bone, r * 0.7, 0.5, -r * 0.3, 6); horn.rotation.z = Math.PI / 2 + 0.3; g.add(horn);
  g.add(cyl(0.45, 0.3, 0.8, '#c9c4b0', -r * 0.6, 0.6, r * 0.45, 8), cyl(0.15, 0.15, 0.5, '#c9c4b0', -r * 0.6, 1.2, r * 0.45, 6));
  return g;
}
/** A corpse hanging in iron shackles bolted to the wall (local -z), maggot-ridden. */
function hangingCorpse(d: Dims): THREE.Group {
  const f = humanoid({ skin: ROT, cloth: d.v ? '#4a4238' : '#5a4a52', trim: '#3b352c', hunch: 0.15, scale: 0.95 });
  f.position.set(0, 1.4, 0.2); f.rotation.x = 0.06;
  const g = grp(f);
  for (const x of [-1.1, 1.1]) g.add(box(0.15, 1.2, 0.15, PALETTE.iron, x, 7.6, -0.1), cyl(0.25, 0.25, 0.25, PALETTE.iron, x, 6.9, 0, 6));
  for (let k = 0; k < 8; k++) g.add(ico(0.07, '#e8e0c8', (hash(k, 1) - 0.5) * 1.2, 2.5 + hash(k, 2) * 3, 0.55));
  return g;
}
/** The curtain of stitched human skin across the back of Kiril's cave (p.205): pale hides hung from a pole, `w` wide. */
function skinCurtain(d: Dims): THREE.Group {
  const w = d.w ?? 10, h = d.h ?? 9, g = grp(cyl(0.15, 0.15, w + 1, PALETTE.woodDark, 0, h, 0, 5).rotateZ(Math.PI / 2));
  const n = Math.max(3, Math.round(w / 2));
  for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * (w / n), hh = h - 0.3 - hash(i, 4) * 0.8; g.add(box(w / n + 0.15, hh, 0.12, i % 2 ? SKIN : SKIN_DK, x, h - hh / 2, (i % 2) * 0.12)); }
  for (let i = 1; i < n; i++) g.add(box(0.08, h - 1, 0.18, '#5a3a30', -w / 2 + i * (w / n), h / 2 + 0.3, 0.1));   // the stitching
  return g;
}
/** A 20-ft ring of standing stones (p.205) with blood spattered inside it. */
function stoneRing(d: Dims): THREE.Group {
  const r = d.r ?? 10, n = d.n ?? 22, g = grp();
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, s = 0.9 + hash(i, 3) * 0.6; const st = ico(s, i % 4 ? CAVE_LT : CAVE, Math.cos(a) * r, s * 0.55, Math.sin(a) * r, 0); st.scale.y = 1.1; g.add(st); }
  for (let k = 0; k < 7; k++) { const a = k * 2.1, rr = r * 0.6 * hash(k, 9); const sp = new THREE.Mesh(new THREE.CircleGeometry(0.5 + hash(k, 8) * 0.9, 7), mat(PALETTE.blood)); sp.rotation.x = -Math.PI / 2; sp.position.set(Math.cos(a) * rr, 0.04, Math.sin(a) * rr); g.add(sp); }
  return g;
}
/** Spears dropped on the ground, shafts stained dark. */
function spears(d: Dims): THREE.Group {
  const n = d.n ?? 3, g = grp();
  for (let i = 0; i < n; i++) { const sp = grp(cyl(0.08, 0.08, 6.5, i % 2 ? PALETTE.woodDark : '#4d1119', 0, 0, 0, 5), cone(0.16, 0.7, PALETTE.mist1, 0, 3.6, 0, 4)); sp.rotation.set(Math.PI / 2, 0, (i - (n - 1) / 2) * 0.35 + hash(i, 2) * 0.3); sp.position.set((i - (n - 1) / 2) * 0.6, 0.12, 0); g.add(sp); }
  return g;
}
/** Rough-hewn steps cut in the rock: `n` treads along local +x over `len` ft, each `step` ft up, `w` wide. */
function roughSteps(d: Dims): THREE.Group {
  const len = d.len ?? 10, w = d.w ?? 8, n = d.n ?? 5, st = d.step ?? 0.8, g = grp();
  for (let i = 0; i < n; i++) { const t = box(len / n + 0.1, st * (i + 1), w - hash(i, 7) * 0.8, i % 2 ? CAVE_LT : CAVE, -len / 2 + (i + 0.5) * (len / n), (st * (i + 1)) / 2, (hash(i, 3) - 0.5) * 0.4); g.add(t); }
  g.traverse((c) => { c.userData.role = 'stairs'; });
  return g;
}

/** The living rock round and between the caves, as one slab: `n` outlines (plan feet, absolute; place at the origin),
 *  outline i given as `${i}n` points `${i}x${k}`, `${i}z${k}`, each extruded `h` ft. The caves are cut out of the first. */
function rockMass(d: Dims): THREE.Group {
  const n = d.n ?? 0, h = d.h ?? 6, gs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const m = d[`${i}n`] ?? 0, pts: THREE.Vector2[] = [];
    for (let k = 0; k < m; k++) pts.push(new THREE.Vector2(d[`${i}x${k}`], -d[`${i}z${k}`]));
    if (pts.length < 3) continue;
    const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: h, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
    gs.push(geo);
  }
  const g = grp();
  if (gs.length) g.add(new THREE.Mesh(merge(gs), mat(SLAB)));
  return g;
}
/** A small leather pouch or bundle on the floor: where a hidden find lies. */
function pouch(): THREE.Group {
  const b = ico(0.45, '#5a4030', 0, 0.35, 0, 1); b.scale.set(1, 0.8, 0.8);
  return grp(b, cyl(0.12, 0.2, 0.3, '#3b2a1e', 0, 0.75, 0, 6), ico(0.08, PALETTE.amber, 0.3, 0.5, 0.2));
}
/** Old soldiers' gear half under snow: a broken bow, arrows, a rusted blade in its rotten sheath, a heap of rusty mail. */
function gearPile(): THREE.Group {
  const bow = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.08, 4, 8, Math.PI * 0.7), mat(PALETTE.woodDark)); bow.rotation.x = Math.PI / 2; bow.position.set(-0.6, 0.1, 0);
  const g = grp(bow, box(2.6, 0.12, 0.25, '#6b4a3a', 0.8, 0.08, 0.6), box(1.4, 0.4, 1.1, '#5a4a40', 0.4, 0.2, -0.6));
  for (let i = 0; i < 4; i++) { const a = box(2, 0.05, 0.05, PALETTE.woodDark, -0.2 + i * 0.15, 0.06, 0.9 + i * 0.12); a.rotation.y = 0.3 + i * 0.2; g.add(a); }
  return g;
}
/** The lip of a 5-ft rock ledge seen from above: a run of rough stones along local x, `len` ft. */
function ledgeLip(d: Dims): THREE.Group {
  const L = d.len ?? 10, n = Math.max(2, Math.round(L / 1.5)), g = grp();
  for (let i = 0; i < n; i++) { const s = 0.55 + hash(i, 2, L) * 0.35, m = ico(s, i % 3 ? CAVE_DK : CAVE, -L / 2 + (i + 0.5) * (L / n), s * 0.5, (hash(i, 5, L) - 0.5) * 0.4, 0); m.scale.set(1.3, 0.9, 0.9); g.add(m); }
  return g;
}

// ---------------------------------------------------------------- the pack
/** The upper body of a humanoid figure (to put a wolf's head on it). */
const upperOf = (f: THREE.Group): THREE.Group | undefined => f.children.find((c) => (c as THREE.Group).isGroup) as THREE.Group | undefined;
/** A werewolf in human form: feral, barefoot, in shredded clothes, a spear in hand (p.203). */
function werewolfHuman(d: Dims): THREE.Group {
  const HAIR = ['#1a1a1a', '#3a2a1a', '#5a4632', '#7a7068', '#c9c2b2'];
  return humanoid({ skin: d.old ? '#b89a84' : '#c99a72', cloth: color(d, 'cloth', '#5a4632'), trim: '#3b2d22', hair: HAIR[(d.hair ?? 0) % HAIR.length], weapon: d.spear === 0 ? 'none' : 'spear', hunch: d.old ? 0.3 : 0.08, scale: d.scale ?? 1, skirt: !!d.skirt });
}
/** A werewolf in hybrid form: a hunched, clawed humanoid with a wolf's head and fur. */
function werewolfHybrid(d: Dims): THREE.Group {
  const fur = color(d, 'fur', FUR_GREY), s = d.scale ?? 1.1;
  const f = humanoid({ skin: fur, cloth: color(d, 'cloth', '#4a3a2c'), trim: FUR_DK, claws: true, hunch: 0.35, scale: s });
  const up = upperOf(f);
  if (up) {
    const hy = 2.82 * s;
    up.add(box(0.55 * s, 0.45 * s, 0.9 * s, fur, 0, hy - 0.1 * s, 0.55 * s), box(0.2 * s, 0.15 * s, 0.2 * s, '#141218', 0, hy - 0.02 * s, 1.0 * s));
    for (const x of [-0.25, 0.25]) up.add(cone(0.14 * s, 0.5 * s, fur, x * s, hy + 0.5 * s, -0.05 * s, 4), ico(0.06 * s, PALETTE.amber, x * 0.7 * s, hy + 0.12 * s, 0.38 * s));
    const ruff = ico(0.62 * s, FUR_DK, 0, 2.2 * s, -0.1 * s); ruff.scale.set(1.2, 0.7, 1); up.add(ruff);
  }
  const tail = cone(0.22 * s, 1.6 * s, FUR_DK, 0, 2.6 * s, -0.7 * s); tail.rotation.x = -2.3; f.add(tail);
  return f;
}
/** A werewolf in wolf form: a big wolf, shaggier than its kin; `fur` sets the coat (Bianca is white). */
function werewolfWolf(d: Dims): THREE.Group {
  const s = d.scale ?? 1.25, c = color(d, 'fur', FUR_BROWN), dk = d.fur !== undefined ? c : FUR_DK, g = grp();
  const body = ico(0.8 * s, c, 0, 2 * s, 0, 1); body.scale.set(2.1, 0.95, 0.8); g.add(body);
  const ruff = ico(0.8 * s, dk, 1.1 * s, 2.3 * s, 0, 1); ruff.scale.set(0.95, 1.1, 1); g.add(ruff);
  for (const [x, z] of [[-1.15, -0.32], [1.05, -0.32], [-1.15, 0.32], [1.05, 0.32]]) g.add(cyl(0.18 * s, 0.12 * s, 1.75 * s, c, x * s, 0.9 * s, z * s, 6), box(0.28 * s, 0.14 * s, 0.34 * s, dk, x * s + 0.06 * s, 0.07 * s, z * s));
  const head = box(0.95 * s, 0.8 * s, 0.8 * s, c, 1.95 * s, 2.6 * s, 0); head.rotation.z = -0.15;
  const snout = box(0.8 * s, 0.4 * s, 0.45 * s, c, 2.7 * s, 2.42 * s, 0); snout.rotation.z = -0.1;
  g.add(head, snout, box(0.15 * s, 0.15 * s, 0.17 * s, '#141218', 3.1 * s, 2.5 * s, 0), cone(0.16 * s, 0.45 * s, c, 1.8 * s, 3.2 * s, -0.24 * s), cone(0.16 * s, 0.45 * s, c, 1.8 * s, 3.2 * s, 0.24 * s));
  g.add(ico(0.09 * s, PALETTE.amber, 2.4 * s, 2.78 * s, -0.26 * s), ico(0.09 * s, PALETTE.amber, 2.4 * s, 2.78 * s, 0.26 * s));
  const tail = cone(0.26 * s, 1.6 * s, dk, -2.2 * s, 1.75 * s, 0); tail.rotation.z = 2.3; g.add(tail);
  if (d.sleeping) { g.rotation.z = 0; g.scale.y = 0.6; }
  return g;
}
/** A child, small and ragged (the pack's prisoners; Kellen in human form). */
function child(d: Dims): THREE.Group {
  const HAIR = ['#3a2a1a', '#5a4632', '#8a6a3a', '#2a2420', '#c9a46a'];
  return humanoid({ skin: '#d9b899', cloth: ['#6b5d4a', '#5a4a52', '#4a5248'][(d.v ?? 0) % 3], trim: '#3b352c', hair: HAIR[(d.v ?? 0) % HAIR.length], scale: 0.62 * (d.scale ?? 1), hunch: 0.12 });
}

Object.assign(PROPS_V1, {
  'rock-flank': rockFlank, precipice, 'bridge-span': bridgeSpan, 'fog-sea': fogSea, 'snow-drift': snowDrift, gatehouse, 'flame-curtain': flameCurtain, 'arch-crown': archCrown,
  'knight-rider': knightRider, 'gold-knight': goldKnight, 'vrock-statue': vrockStatue, 'dire-wolf-head': direWolfHead, 'tower-ribs': towerRibs, 'iron-ladder': ironLadder, 'octa-merlons': octaMerlons,
  'wolf-maw': wolfMaw, 'rock-pillar': rockPillar, 'wall-torch': wallTorch, 'wolf-cage': wolfCage, 'mother-night': motherNight, hoard,
  'hanging-corpse': hangingCorpse, 'skin-curtain': skinCurtain, 'stone-ring': stoneRing, spears, 'rough-steps': roughSteps, 'rock-mass': rockMass, 'ledge-lip': ledgeLip, pouch, 'gear-pile': gearPile,
} as Record<string, (d: Dims) => THREE.Object3D>);
Object.assign(CREATURES, {
  vrock: () => compact(vrock()), roc: (d) => compact(roc(d)), 'phantom-rider': () => compact(phantomRider()), 'giant-goat': () => compact(giantGoat()), 'snow-maiden': () => compact(snowMaiden()),
  'werewolf-human': (d) => compact(werewolfHuman(d)), werewolf: (d) => compact(werewolfHybrid(d)), 'werewolf-hybrid': (d) => compact(werewolfHybrid(d)), 'werewolf-wolf': (d) => compact(werewolfWolf(d)),
  child: (d) => compact(child(d)),
} as Record<string, (d: Dims) => THREE.Group>);
