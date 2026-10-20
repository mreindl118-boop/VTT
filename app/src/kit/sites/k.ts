// Props for Castle Ravenloft's own front (chapter 4, area K1), kept in their own file like every site's.
// Register with Object.assign(PROPS_V1, {...}); use mat() for every material. Every kind registered here starts with 'k-'.
//
// The gate is the castle's own (owner 2026-10-19, of the Gates of Ravenloft map: "this looks cool but it's supposed to be
// attached to and part of Ravenloft and the new improved 3D model"). The castle's walls and the gate towers are walls of
// the map (scripts/authoring/castle-ravenloft.py); these are the pieces they do not draw: the masonry over the gate
// tunnel, the gatehouse's battlements, and the gate's fittings carried over from the Gates of Ravenloft (wild-j.ts) that
// hang on the wall's face or stand on its top: the drawbridge's chains and the slots they run into, and the gargoyles.
// All of them are the castle's shell, so the section plane slices them with the walls (role 'roof', as the site shells
// of q.ts, t.ts and w.ts are): none stands floating over a wall the plane has cut down to the floor's height.
// Feet; the origin at the floor; +z is plan south for an unturned piece.
import * as THREE from 'three';
import { PROPS_V1 } from '../props';
import { WALL_COLOR } from '../palette';
import { surfaceFor } from '../surfaces';
import { box, grp } from '../shapes';
import { chain, chainSlot, wallGargoyle } from './wild-j';

type Dims = Record<string, number>;

const STONE = WALL_COLOR.ashlar;          // the castle's walls' own stone (build.ts draws its walls in it)
const DRESSED = '#6c737c';                // the arch's voussoirs and the copings, a shade darker (ashlar, surfaces.ts)
const SHADOW = '#1b1a1f';                 // the portcullis's slot
surfaceFor([SHADOW], 'none');

/** Mark a piece as the castle's shell, so the section plane slices it with the walls. */
const shell = <T extends THREE.Object3D>(o: T): T => { o.traverse((c) => { c.userData.role = 'roof'; }); return o; };

/** A run of merlons `len` ft long (local x) on a wall top at `y`, standing on the wall's outer edge at local z `z`
 *  (`t` the merlon's depth), with the gaps between them about a merlon wide. */
function merlons(len: number, y: number, z: number, t = 1.4): THREE.Mesh[] {
  const n = Math.max(2, Math.round(len / 5)), step = len / n, out: THREE.Mesh[] = [];
  for (let i = 0; i < n; i++) out.push(box(step * 0.55, 4, t, STONE, -len / 2 + (i + 0.5) * step, y + 2, z));
  return out;
}

/** The masonry over the gate tunnel: `w` (20) ft across the tunnel (local x) and `t` (20) ft through the wall (local z,
 *  its outer face toward −z), from the tunnel's crown `y0` (18) up to the wall top `h` (90). The tunnel is vaulted: a
 *  round arch springing `w`/2 below the crown, its spandrels filled through the whole depth; a ring of dressed voussoirs
 *  round each mouth; the portcullis's slot across the vault `slot` ft in from the outer face; merlons along both faces
 *  of the walk over the gate. */
export function gateArch(d: Dims): THREE.Group {
  const W = d.w ?? 20, T = d.t ?? 20, Y0 = d.y0 ?? 18, H = d.h ?? 90, R = W / 2, ys = Y0 - R, slot = d.slot ?? 2, g = grp();
  g.add(box(W, H - Y0, T, STONE, 0, Y0 + (H - Y0) / 2, 0));
  // the spandrels: the stone between the arch and the square corners of the opening, in slices, the whole depth
  const N = 6;
  for (let i = 0; i < N; i++) {
    const y1 = ys + (R * i) / N, y2 = ys + (R * (i + 1)) / N, half = Math.sqrt(Math.max(0, R * R - (y2 - ys) ** 2)), fill = R - half;
    if (fill < 0.05) continue;
    for (const s of [-1, 1]) g.add(box(fill, y2 - y1, T, STONE, s * (R - fill / 2), (y1 + y2) / 2, 0));
  }
  // the voussoirs round both mouths, standing a hand proud of the faces
  const V = 9;
  for (const s of [-1, 1]) for (let i = 0; i < V; i++) {
    const a = Math.PI * ((i + 0.5) / V), r = R + 0.9;
    const v = box(2.2, 1.8, 0.5, DRESSED, -Math.cos(a) * r, ys + Math.sin(a) * r, s * (T / 2 + 0.2));
    v.rotation.z = a - Math.PI / 2; g.add(v);
  }
  g.add(box(W, 0.6, 1.4, SHADOW, 0, Y0 - 0.25, -T / 2 + slot));                        // the slot the portcullis rises into
  g.add(box(W + 0.6, 0.6, T + 0.6, DRESSED, 0, H - 0.3, 0));                           // the walk's coping
  for (const s of [-1, 1]) g.add(...merlons(W, H, s * (T / 2 - 0.7)));
  return g;
}

/** A gate tower's battlemented head: merlons round a `w` (local x) by `d` (local z) ft plan on walls `t` ft thick, their
 *  tops at `y`, a dressed coping course under them, proud of both faces. */
export function towerHead(d: Dims): THREE.Group {
  const W = d.w ?? 30, D = d.d ?? 20, Y = d.y ?? 100, T = d.t ?? 5, g = grp();
  for (const s of [-1, 1]) {
    // the two long sides (along local x), corner to corner
    g.add(box(W + 0.6, 0.6, T + 0.6, DRESSED, 0, Y - 0.3, s * (D / 2 - T / 2)), ...merlons(W, Y, s * (D / 2 - 0.7)));
    // the two short sides between them (along local z): a run turned a quarter, on the outer edge
    const end = grp(box(D - 2 * T, 0.6, T + 0.6, DRESSED, 0, Y - 0.3, 0), ...merlons(D - 2 * T, Y, 0));
    end.rotation.y = Math.PI / 2; end.position.x = s * (W / 2 - 0.7); g.add(end);
  }
  return g;
}

Object.assign(PROPS_V1, {
  'k-gate-arch': (d: Dims) => shell(gateArch(d)),
  'k-tower-head': (d: Dims) => shell(towerHead(d)),
  // the Gates of Ravenloft's fittings, the castle's own now: on the wall face and the wall top, sliced with it
  'k-chain': (d: Dims) => shell(chain(d)),
  'k-chain-slot': (d: Dims) => shell(chainSlot(d)),
  'k-wall-gargoyle': () => shell(wallGargoyle()),
} as Record<string, (d: Dims) => THREE.Object3D>);
