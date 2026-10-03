// Props and figures for one site's maps (kept in their own file so each site can be built on its own).
// Register with Object.assign(PROPS_V1, {...}) / Object.assign(CREATURES, {...}); use mat() for every material.
//
// Argynvostholt (chapter 7, area Q): the silver dragon's ruined mansion. Original low-poly pieces in the kit's grammar
// (plinths, frames, ridge beams; weathered colours): the dragon statue on its granite block, the knights' furniture,
// the cemetery's wrought-iron fence and dug-up graves, the mausoleum's cross roof and silver wyrmlings, ballistae and
// battlements on the roof, the beacon tower's rickety stairs, and the order's revenants and phantom warriors.
import * as THREE from 'three';
import { PROPS_V1 } from '../props';
import { CREATURES, humanoid } from '../creatures';
import { mat, matClone, patchFog } from '../../render/materials';
import { surfaceFor } from '../surfaces';
import { PALETTE } from '../palette';

type Dims = Record<string, number>;
const Q = {
  granite: '#67635f', graniteDeep: '#4f4c49', silver: '#9ba4ab', silverDeep: '#737c84', tarnish: '#868e93', alabaster: '#d6d0c4', marble: '#c2bdb3',
  ebony: '#241e20', ironDark: '#2a2b30', velvet: '#6a1e26', banner: '#56606c', bannerGold: '#8a7448', chain: '#5d6066', corpse: '#8c8674', corpseDeep: '#6d6858',
  phantom: '#aebbd0', phantomDeep: '#8796ae', spider: '#2f2724', spiderDeep: '#1f1a18', spiderRed: '#5e2622', soot: '#2d2a2c', tile: '#514b55', char: '#2a2422',
  earth: '#4a3f33', smoke: '#5c595c', glass: '#5a6e7a',
};
surfaceFor([Q.granite, Q.graniteDeep, Q.silver, Q.silverDeep, Q.alabaster, Q.marble], 'stone');
surfaceFor([Q.tarnish, Q.ironDark, Q.chain], 'metal');
surfaceFor([Q.ebony, Q.char], 'wood');
surfaceFor([Q.velvet, Q.banner, Q.bannerGold], 'cloth');
surfaceFor([Q.tile], 'shingle');
surfaceFor([Q.earth], 'dirt');
surfaceFor(['#857170', '#94807d'], 'flag');
surfaceFor(['#666b73', '#57535c', '#5e3a3c', '#6e6248', '#6f7680', '#5f646d', '#6a6f78', '#a8a49c', '#5f5d5a'], 'stone');
surfaceFor(['#5a3a28', '#b8a888'], 'cloth');
surfaceFor([Q.corpse, Q.corpseDeep, Q.phantom, Q.phantomDeep, Q.spider, Q.spiderDeep, Q.spiderRed, Q.soot, Q.smoke, Q.glass], 'generic');

const box = (w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color)); m.position.set(x, y, z); return m; };
const cyl = (rt: number, rb: number, h: number, color: string, x = 0, y = 0, z = 0, seg = 8) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color)); m.position.set(x, y, z); return m; };
const cone = (r: number, h: number, color: string, x = 0, y = 0, z = 0, seg = 6) => { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(color)); m.position.set(x, y, z); return m; };
const ico = (r: number, color: string, x = 0, y = 0, z = 0, detail = 0) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), mat(color)); m.position.set(x, y, z); return m; };
const g = (...m: THREE.Object3D[]) => { const grp = new THREE.Group(); if (m.length) grp.add(...m); return grp; };
const rot = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T => { o.rotation.set(x, y, z); return o; };
/** A deterministic 0..1 sequence, so a heap of wreckage looks the same every time it is built. */
const seq = (seed: number) => { let s = (Math.abs(seed) * 9301 + 49297) % 233280; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
/** A sloped box between two points (a stair string, a raking rail, a fallen beam). */
function beam(a: [number, number, number], b: [number, number, number], t: number, color: string): THREE.Mesh {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), len = va.distanceTo(vb);
  const m = new THREE.Mesh(new THREE.BoxGeometry(t, t, len), mat(color));
  m.position.copy(va.clone().add(vb).multiplyScalar(0.5)); m.lookAt(vb); return m;
}

// ---------------------------------------------------------------- the grounds
/** Q1: a moss-grown silver dragon, wings folded, on a ten-foot cube of granite; it looks along local +x. */
export function dragonStatue(): THREE.Group {
  const S = Q.silver, D = Q.silverDeep, top = 10;
  const grp = g(box(11.2, 0.8, 11.2, Q.graniteDeep, 0, 0.4, 0), box(10, top - 1.4, 10, Q.granite, 0, 0.8 + (top - 1.4) / 2, 0), box(10.8, 0.6, 10.8, Q.graniteDeep, 0, top - 0.3, 0));
  for (const [x, z, s] of [[-4.2, 3.6, 1.4], [3.9, -4.1, 1.1], [-3.6, -4.3, 0.9], [4.6, 2.2, 0.8]] as const) { const m = ico(s, '#4d5a3f', x, 0.9 + s * 0.4, z); m.scale.set(1.4, 0.5, 1.1); grp.add(m); }   // moss on the block's foot
  const y = top;
  const body = ico(2.2, S, -0.4, y + 3.2, 0, 1); body.scale.set(1.5, 0.95, 0.85); grp.add(body);
  const chest = ico(1.7, S, 1.6, y + 4.2, 0, 1); chest.scale.set(1, 1.15, 0.9); grp.add(chest);
  for (const z of [-1.1, 1.1]) { grp.add(rot(box(0.9, 3.4, 0.9, D, 2.4, y + 1.7, z), 0, 0, 0.12), box(1.4, 0.5, 1.1, D, 2.8, y + 0.25, z));   // forelegs and claws
    const h = ico(1.4, S, -2.2, y + 1.6, z * 1.05, 1); h.scale.set(1.3, 1.1, 0.7); grp.add(h, box(1.8, 0.5, 1, D, -1.4, y + 0.25, z * 1.2)); }   // haunches and hind feet
  const neck = rot(cyl(0.75, 1.05, 3.6, S, 2.6, y + 6.4, 0, 7), 0, 0, -0.55); grp.add(neck);
  const head = g(box(2.2, 1.2, 1.3, S, 0.4, 0, 0), box(1.5, 0.6, 0.95, D, 1.7, -0.25, 0), box(0.25, 0.2, 0.25, '#2b2829', 1.1, 0.35, 0.5), box(0.25, 0.2, 0.25, '#2b2829', 1.1, 0.35, -0.5));
  for (const z of [-0.45, 0.45]) head.add(rot(cone(0.22, 1.6, D, -0.9, 0.7, z), 0, 0, 1.0));   // swept-back horns
  head.position.set(3.9, y + 8.5, 0); head.rotation.z = -0.15; grp.add(head);
  // the spiny frill down the neck and back, cracked and broken in places
  for (let i = 0; i < 9; i++) { if (i === 3 || i === 6) continue; const t = i / 8; grp.add(rot(cone(0.28, 1.1 - t * 0.4, D, 3.2 - t * 6.4, y + 7.6 - t * 3.4 + (t > 0.4 ? 0 : -t * 2), 0), 0, 0, 0.4)); }
  // wings tucked close: two folded sails along the flanks, the leading bone along the top
  for (const sz of [-1, 1]) {
    const shape = new THREE.Shape([new THREE.Vector2(-3.4, 0), new THREE.Vector2(2.2, 0), new THREE.Vector2(1.2, 2.6), new THREE.Vector2(-1.2, 3.4)]);
    const wgeo = new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: false }); const w = new THREE.Mesh(wgeo, mat(D));
    w.position.set(-0.6, y + 3.4, sz * 1.65 - (sz > 0 ? 0 : 0.25)); w.rotation.x = sz * -0.35; grp.add(w);
    grp.add(beam([1.6, y + 4.4, sz * 1.55], [-1.6, y + 6.9, sz * 1.95], 0.35, S));
  }
  // the tail curls round the block's top edge
  let px = -2.8, pz = 0;
  for (let i = 0; i < 6; i++) { const a = i * 0.5, nx = px - Math.cos(a) * 1.3, nz = pz + Math.sin(a) * 1.3; grp.add(beam([px, y + 1.4 - i * 0.16, pz], [nx, y + 1.2 - i * 0.16, nz], 0.9 - i * 0.12, i % 2 ? D : S)); px = nx; pz = nz; }
  return grp;
}

/** A run of wrought-iron fence `len` ft along local x, `h` ft tall (the cemetery's is seven): spear-headed bars, two rails, posts every 10 ft. */
export function ironFence(d: Dims): THREE.Group {
  const L = d.len ?? 10, h = d.h ?? 7, grp = g(box(L, 0.18, 0.18, Q.ironDark, 0, 0.9, 0), box(L, 0.18, 0.18, Q.ironDark, 0, h - 0.9, 0));
  const n = Math.max(2, Math.round(L / 0.75));
  for (let i = 0; i <= n; i++) { const x = -L / 2 + (i / n) * L; grp.add(box(0.1, h - 0.4, 0.1, Q.ironDark, x, (h - 0.4) / 2, 0), cone(0.13, 0.5, Q.ironDark, x, h - 0.15, 0, 4)); }
  for (let x = -L / 2; x <= L / 2 + 0.01; x += 10) grp.add(box(0.4, h + 0.4, 0.4, Q.ironDark, x, (h + 0.4) / 2, 0), ico(0.3, Q.ironDark, x, h + 0.6, 0));
  return grp;
}
/** A dug-up grave: the open pit, the spoil heaped beside it, the headstone tipped over the hole. Local z is the grave's length. */
export function openGrave(d: Dims): THREE.Group {
  const r = seq(d.seed ?? 1), grp = g(box(2.6, 0.06, 6, '#0f0d0e', 0, 0.03, 0), box(3.2, 0.25, 6.6, Q.earth, 0, 0.12, 0).translateY(-0.2));
  const heap = ico(1.6, Q.earth, 2.4, 0.4, 0.4 + r() * 0.6, 1); heap.scale.set(0.8, 0.45, 1.6); grp.add(heap);
  const stone = g(box(1.6, 2.2, 0.4, PALETTE.mist3, 0, 1.1, 0), rot(cyl(0.8, 0.8, 0.4, PALETTE.mist3, 0, 2.2, 0, 10), Math.PI / 2, 0, 0));
  stone.position.set(-0.2, 0, -3.4); stone.rotation.x = 0.35 + r() * 0.2; stone.rotation.z = (r() - 0.5) * 0.3; grp.add(stone);
  for (let i = 0; i < 4; i++) grp.add(ico(0.3, Q.earth, (r() - 0.5) * 2.4, 0.15, (r() - 0.5) * 6));
  return grp;
}
/** The dragon's mausoleum roof: a stone-tiled pyramid over the crossing and a gable over each arm, ridge beams, at `y`. Arms run ±`arm` ft. */
export function mausoleumRoof(d: Dims): THREE.Group {
  const y = d.y ?? 12, arm = d.arm ?? 15, w = d.w ?? 10, h = d.h ?? 6, grp = g();
  const pyr = cone(9.5, h + 3, Q.tile, 0, y + (h + 3) / 2, 0, 4); pyr.rotation.y = Math.PI / 4; grp.add(pyr, cyl(0.25, 0.25, 2.5, Q.tarnish, 0, y + h + 4, 0, 6), ico(0.45, Q.tarnish, 0, y + h + 5.3, 0));
  for (let i = 0; i < 4; i++) {
    const shape = new THREE.Shape([new THREE.Vector2(-w / 2 - 0.8, 0), new THREE.Vector2(w / 2 + 0.8, 0), new THREE.Vector2(0, h)]);
    const pr = new THREE.ExtrudeGeometry(shape, { depth: arm - 3, bevelEnabled: false }); pr.translate(0, 0, 3);
    const m = new THREE.Mesh(pr, mat(Q.tile)); m.position.y = y; m.rotation.y = (i * Math.PI) / 2; grp.add(m);
    const ridge = box(0.6, 0.5, arm - 3, Q.graniteDeep, 0, y + h + 0.1, 3 + (arm - 3) / 2); const rg = g(ridge); rg.rotation.y = (i * Math.PI) / 2; grp.add(rg);
    const cop = box(w + 2, 0.6, 0.8, Q.graniteDeep, 0, y + 0.3, arm + 0.2); const cg = g(cop); cg.rotation.y = (i * Math.PI) / 2; grp.add(cg);
  }
  grp.traverse((c) => { c.userData.role = 'roof'; });
  return grp;
}
/** A silver-plated gargoyle shaped like a crouching dragon wyrmling, tarnished; raised `y` ft (on a roof). Faces local +x. */
export function wyrmlingStatue(d: Dims): THREE.Group {
  const y = d.y ?? 0, s = d.s ?? 1, T = Q.tarnish, D = Q.silverDeep;
  const grp = g(box(2.6 * s, 0.5 * s, 2 * s, Q.graniteDeep, 0, y + 0.25 * s, 0));
  const body = ico(1.1 * s, T, -0.2 * s, y + 1.5 * s, 0, 1); body.scale.set(1.4, 0.9, 0.8); grp.add(body);
  grp.add(rot(cyl(0.35 * s, 0.5 * s, 1.6 * s, T, 0.9 * s, y + 2.3 * s, 0, 6), 0, 0, -0.6), box(1.1 * s, 0.6 * s, 0.6 * s, T, 1.7 * s, y + 3 * s, 0), box(0.6 * s, 0.35 * s, 0.45 * s, D, 2.3 * s, y + 2.85 * s, 0));
  for (const z of [-0.5, 0.5]) grp.add(box(0.35 * s, 1.1 * s, 0.35 * s, D, 0.8 * s, y + 0.9 * s, z * s), box(0.4 * s, 0.9 * s, 0.4 * s, D, -1 * s, y + 0.9 * s, z * s), rot(cone(0.12 * s, 0.7 * s, D, 1.4 * s, y + 3.5 * s, z * 0.5 * s), 0, 0, 0.9));
  for (const sz of [-1, 1]) { const w = box(1.8 * s, 0.1 * s, 1.4 * s, D, -0.3 * s, y + 2.4 * s, sz * 1.1 * s); w.rotation.x = sz * -0.7; grp.add(w); }
  grp.add(beam([-1.3 * s, y + 1.3 * s, 0], [-2.4 * s, y + 0.6 * s, 0.6 * s], 0.3 * s, T));
  return grp;
}

// ---------------------------------------------------------------- the mansion's rooms
/** A flight of steps `len` ft along local +x, `w` wide, from `base` ft up `rise` ft. Stone: solid to the floor, with a raking
 *  balustrade each side when `rail`; wood (`wood`): open treads on two strings, a rickety thing that clings to its wall. */
export function stairFlight(d: Dims): THREE.Group {
  const len = d.len ?? 10, w = d.w ?? 5, rise = d.rise ?? 10, base = d.base ?? 0, wood = !!d.wood, n = Math.max(2, Math.round(rise / 0.75));
  const grp = g();
  for (let i = 0; i < n; i++) {
    const top = base + ((i + 1) / n) * rise, x0 = -len / 2 + (i / n) * len, x1 = -len / 2 + ((i + 1) / n) * len;
    if (wood) grp.add(box(x1 - x0 + 0.15, 0.22, w - 0.4, i % 2 ? PALETTE.wood : PALETTE.woodDark, (x0 + x1) / 2, top - 0.11, 0));
    else grp.add(box(x1 - x0, top, w, i % 2 ? '#6a6f78' : '#5f646d', (x0 + x1) / 2, top / 2, 0));
  }
  if (wood) for (const z of [-w / 2 + 0.2, w / 2 - 0.2]) { grp.add(beam([-len / 2, base, z], [len / 2, base + rise, z], 0.35, PALETTE.woodDark)); if (z > 0) for (let x = -len / 2 + 2; x < len / 2; x += 4) grp.add(box(0.2, 3.2, 0.2, PALETTE.woodDark, x, base + ((x + len / 2) / len) * rise + 1.6, z)); }
  if (d.rail) for (const z of [-w / 2 - 0.25, w / 2 + 0.25]) { grp.add(beam([-len / 2, base + 3, z], [len / 2, base + rise + 3, z], 0.5, '#5f646d')); for (let x = -len / 2 + 0.6; x < len / 2; x += 1.6) grp.add(box(0.35, 3, 0.35, '#6a6f78', x, base + ((x + len / 2) / len) * rise + 1.5, z)); }
  grp.traverse((c) => { c.userData.role = 'stairs'; });
  return grp;
}
/** A tall pillar `h` ft (the foyer's stone ones carry the balconies; the chapel's are timber, cracked when `wood`). */
export function tallColumn(d: Dims): THREE.Group {
  const h = d.h ?? 20, wood = !!d.wood, C = wood ? PALETTE.woodDark : PALETTE.stone, D = wood ? '#3b2a1e' : PALETTE.stoneDeep;
  const grp = g(box(2.6, 0.7, 2.6, D, 0, 0.35, 0), cyl(wood ? 0.8 : 0.95, wood ? 0.9 : 1.05, h - 1.6, C, 0, 0.7 + (h - 1.6) / 2, 0, 8), box(2.8, 0.9, 2.8, D, 0, h - 0.45, 0));
  if (wood) grp.add(box(0.12, h * 0.5, 0.3, '#1a1412', 0.82, h * 0.45, 0));
  return grp;
}
/** An alabaster bust of a handsome man on a pedestal (`wood` for a timber one); `broken` lays it shattered on the floor;
 *  `cloth` drapes it in black. */
export function bustPedestal(d: Dims): THREE.Group {
  const P = d.wood ? PALETTE.woodDark : Q.marble, A = Q.alabaster;
  if (d.broken) {
    const r = seq(7), grp = g(rot(box(1.4, 3.6, 1.4, P, 0.6, 0.7, 0.2), 0, 0.4, Math.PI / 2));
    for (let i = 0; i < 7; i++) grp.add(ico(0.2 + r() * 0.35, A, (r() - 0.5) * 3, 0.15, (r() - 0.5) * 3));
    return grp;
  }
  const grp = g(box(1.8, 0.4, 1.8, P, 0, 0.2, 0), box(1.3, 3, 1.3, P, 0, 1.9, 0), box(1.7, 0.35, 1.7, P, 0, 3.55, 0));
  const shoulders = box(1.5, 0.7, 0.8, A, 0, 4.1, 0), head = ico(0.45, A, 0, 5.05, 0.05, 1); head.scale.set(0.9, 1.1, 1);
  grp.add(shoulders, cyl(0.18, 0.22, 0.4, A, 0, 4.6, 0), head, box(0.12, 0.2, 0.15, A, 0, 4.95, 0.45));
  if (d.cloth) { const c = cone(1.1, 2.2, '#141216', 0, 4.6, 0, 8); grp.add(c); }
  return grp;
}
/** The den's wine cabinet: an empty sarcophagus of black wood standing on end, a queen's effigy on its lid, which hangs ajar. Faces +z. */
export function sarcophagusCabinet(): THREE.Group {
  const E = Q.ebony, grp = g(box(3, 0.4, 2, Q.ebony, 0, 0.2, 0), box(2.8, 7.4, 0.4, E, 0, 4, -0.8), box(0.35, 7.4, 1.6, E, -1.3, 4, 0), box(0.35, 7.4, 1.6, E, 1.3, 4, 0), box(2.8, 0.4, 1.6, E, 0, 7.7, 0));
  for (let i = 0; i < 4; i++) { const y = 1.6 + i * 1.6; grp.add(box(2.3, 0.12, 1.3, PALETTE.wood, 0, y, -0.1)); for (const x of [-0.6, 0.1, 0.7]) grp.add(cyl(0.12, 0.08, 0.35, '#8fa3b0', x, y + 0.2, 0)); }
  const lid = g(box(2.7, 7.2, 0.3, E, 1.35, 0, 0), ico(0.5, Q.graniteDeep, 1.35, 2.2, 0.25), box(0.9, 0.3, 0.15, PALETTE.amberDeep, 1.35, 2.85, 0.2), box(1.2, 3.4, 0.2, '#30282a', 1.35, -0.6, 0.2));
  lid.position.set(-1.4, 3.9, 0.9); lid.rotation.y = -0.6; grp.add(lid);
  return grp;
}
/** A rotted divan; `tipped` leaves it on its back. Faces +z. */
export function divan(d: Dims): THREE.Group {
  const grp = g(box(6, 1.3, 2.6, Q.velvet, 0, 1.1, 0), box(6, 2, 0.6, Q.velvet, 0, 2.2, -1.1), box(0.6, 1.6, 2.6, PALETTE.woodDark, -3, 1.3, 0), box(0.6, 1.6, 2.6, PALETTE.woodDark, 3, 1.3, 0));
  for (const [x, z] of [[-2.7, -1.1], [2.7, -1.1], [-2.7, 1.1], [2.7, 1.1]]) grp.add(box(0.3, 0.5, 0.3, PALETTE.woodDark, x, 0.25, z));
  grp.add(box(1.2, 0.2, 0.9, '#b8a888', 1.2, 1.85, 0.4));   // the stuffing spills out
  if (d.tipped) { const o = g(grp); grp.rotation.x = -1.3; grp.position.set(0, 1.4, 0.6); return o; }
  return grp;
}
/** A heap of smashed furniture: chair legs, panels, a broken frame, sized by `s`; `n` pieces. */
export function wreckage(d: Dims): THREE.Group {
  const r = seq(d.seed ?? 3), n = d.n ?? 9, s = d.s ?? 1, grp = g();
  const C = [PALETTE.wood, PALETTE.woodDark, '#5a4632', d.velvet ? Q.velvet : '#4b3a2c'];
  for (let i = 0; i < n; i++) { const L = (0.8 + r() * 2.4) * s, m = box(L, (0.2 + r() * 0.3) * s, (0.25 + r() * (i % 3 === 0 ? 1.4 : 0.3)) * s, C[i % C.length], (r() - 0.5) * 4 * s, (0.15 + r() * 0.5) * s, (r() - 0.5) * 4 * s); m.rotation.set((r() - 0.5) * 0.8, r() * 3, (r() - 0.5) * 0.6); grp.add(m); }
  return grp;
}
/** A heap of fallen masonry: blocks, slates and dust, `r` ft across and `h` high. */
export function rubbleHeap(d: Dims): THREE.Group {
  const R = d.r ?? 6, H = d.h ?? 3, r = seq(d.seed ?? 5), grp = g();
  const core = ico(R * 0.55, '#5f5d5a', 0, 0, 0); core.scale.set(1, (H * 0.8) / (R * 0.55), 0.85); core.rotation.y = r() * 3; grp.add(core);
  for (let i = 0; i < 22; i++) {
    const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * R * 0.9, s = 0.35 + r() * 1.1, up = Math.max(0, 1 - rr / R) * H * 0.7;
    const m = i % 3 === 0 ? box(s * 2.2, s * 0.25, s * 1.5, i % 2 ? Q.tile : '#5f646d', Math.cos(a) * rr, up + 0.2, Math.sin(a) * rr)
      : i % 3 === 1 ? box(s * 1.6, s * 1.1, s * 1.2, i % 2 ? '#6d6860' : PALETTE.stone, Math.cos(a) * rr, up + s * 0.4, Math.sin(a) * rr)
      : ico(s, i % 2 ? PALETTE.stoneDeep : '#6d6860', Math.cos(a) * rr, up + s * 0.4, Math.sin(a) * rr);
    m.rotation.set(r() * 0.8, r() * 3, r() * 0.8); grp.add(m);
  }
  return grp;
}
/** Broken rafters: `n` long beams fallen askew over a heap, one end up on the debris. */
export function brokenRafters(d: Dims): THREE.Group {
  const n = d.n ?? 3, L = d.len ?? 14, r = seq(d.seed ?? 9), grp = g();
  for (let i = 0; i < n; i++) { const a = r() * Math.PI, hx = Math.cos(a) * L / 2, hz = Math.sin(a) * L / 2, y1 = 0.4 + r() * (d.h ?? 4); grp.add(beam([-hx + (r() - 0.5) * 3, 0.4, -hz + (r() - 0.5) * 3], [hx, y1, hz], 0.7, i % 2 ? PALETTE.woodDark : '#3b2a1e')); }
  return grp;
}
/** A chandelier fallen to the floor: its iron ring bent, arms snapped off. */
export function fallenChandelier(d: Dims): THREE.Group {
  const C = d.brass ? PALETTE.amberDeep : PALETTE.iron, ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.16, 5, 14), mat(C));
  ring.rotation.set(Math.PI / 2 + 0.25, 0, 0.1); ring.position.y = 0.45; ring.scale.set(1, 0.85, 1);
  const grp = g(ring); for (let i = 0; i < 6; i++) { const a = i; grp.add(beam([Math.cos(a) * 2, 0.4, Math.sin(a) * 2], [Math.cos(a) * 3.2, 0.1, Math.sin(a) * 3.4], 0.14, C)); }
  grp.add(beam([0, 0.3, 0], [3.5, 0.2, -2.5], 0.12, PALETTE.iron));
  return grp;
}
/** Webs stretched wall to wall: a translucent sheet `w` × `h` hung `y` ft up, a few heavy strands across it. */
export function webSheet(d: Dims): THREE.Group {
  const w = d.w ?? 14, h = d.h ?? 8, y = d.y ?? 8;
  const m = patchFog(new THREE.MeshBasicMaterial({ color: '#e8e4dc', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); sheet.position.y = y;
  const grp = g(sheet); const ls = patchFog(new THREE.MeshBasicMaterial({ color: '#d8d4cc', transparent: true, opacity: 0.45, depthWrite: false }));
  for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(w * 1.05, 0.06, 0.06), ls); s.position.y = y - h / 2 + (i + 0.5) * (h / 5); s.rotation.z = (i - 2) * 0.12; grp.add(s); }
  grp.userData.role = 'marker';
  return grp;
}
/** A life-sized knight in stone on a plinth: dragon-winged helm, shield on the arm. Faces +z. */
export function knightStatue(): THREE.Group {
  const S = PALETTE.mist3, fig = humanoid({ skin: S, cloth: S, trim: PALETTE.stoneDeep, helm: 'cap', weapon: 'sword', scale: 1.05 });
  fig.position.y = 1.4;
  const grp = g(box(3.4, 0.5, 3.4, PALETTE.stoneDeep, 0, 0.25, 0), box(2.9, 0.9, 2.9, PALETTE.stone, 0, 0.95, 0), fig);
  for (const sx of [-1, 1]) grp.add(rot(box(0.12, 1.4, 1.2, S, sx * 0.55, 7.8, -0.1), 0, 0, sx * -0.5));   // the helm's wings
  const sh = g(box(1.5, 2.1, 0.25, S, 0, 0, 0), cone(0.75, 0.9, S, 0, -1.45, 0, 4)); sh.position.set(-1.05, 4.2, 0.55); grp.add(sh);
  return grp;
}
/** The dining hall's table, `w` long (x) and `d` deep, standing on sculpted dragons. */
export function dragonTable(d: Dims): THREE.Group {
  const w = d.w ?? 20, dd = d.d ?? 5, h = 2.6, grp = g(box(w, 0.4, dd, PALETTE.woodDark, 0, h - 0.2, 0), box(w - 1.2, 0.35, dd - 1, '#3b2a1e', 0, h - 0.55, 0));
  for (const x of [-w / 2 + 1.4, 0, w / 2 - 1.4]) for (const z of [-dd / 2 + 0.9, dd / 2 - 0.9]) {
    if (x === 0 && z < 0) continue;
    grp.add(box(0.9, h - 0.8, 0.9, PALETTE.wood, x, (h - 0.8) / 2, z), box(0.9, 0.55, 0.6, PALETTE.wood, x, 0.6, z + Math.sign(z) * 0.55), box(1.4, 0.3, 1.2, PALETTE.woodDark, x, 0.15, z));
  }
  grp.add(box(w - 2.8, 0.35, 0.35, PALETTE.woodDark, 0, 0.7, 0));
  return grp;
}
/** A high chair whose back is carved as a pair of folded dragon wings; `fallen` tips it on its side, `dragon` tops it with a carved dragon. Faces +z. */
export function wingChair(d: Dims): THREE.Group {
  const grp = g(box(1.9, 0.3, 1.8, PALETTE.wood, 0, 1.6, 0));
  for (const [x, z] of [[-0.75, 0.7], [0.75, 0.7], [-0.75, -0.7], [0.75, -0.7]]) grp.add(box(0.25, 1.6, 0.25, PALETTE.woodDark, x, 0.8, z));
  for (const sx of [-1, 1]) { const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.95, 0), new THREE.Vector2(0.75, 3.6), new THREE.Vector2(0.1, 4.6)]); const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: false }); const m = new THREE.Mesh(geo, mat(PALETTE.woodDark)); m.position.set(0, 1.7, -0.95); m.scale.x = sx; grp.add(m); }
  if (d.dragon) grp.add(box(0.6, 0.6, 1, PALETTE.wood, 0, 6.6, -0.8), box(0.35, 0.3, 0.6, PALETTE.wood, 0, 6.6, -0.1), rot(box(1.6, 0.1, 0.8, PALETTE.wood, 0, 6.5, -0.9), 0, 0, 0.3));
  if (d.fallen) { const o = g(grp); grp.rotation.z = Math.PI / 2; grp.position.set(0.9, 0.95, 0); return o; }
  return grp;
}
/** A carved wooden throne on a step; `wings` spreads a dragon's wings from its back, `dragon` adds the head above. Faces +z. */
export function dragonThrone(d: Dims): THREE.Group {
  const W = PALETTE.woodDark, grp = g(box(5, 0.6, 4.2, '#5f646d', 0, 0.3, 0), box(3.2, 1.5, 2.6, W, 0, 1.35, 0.2), box(3.4, 0.35, 2.8, PALETTE.wood, 0, 2.25, 0.2),
    box(3.2, 6.5, 0.6, W, 0, 4.9, -1.0), box(0.5, 1.6, 2.6, W, -1.6, 3, 0.2), box(0.5, 1.6, 2.6, W, 1.6, 3, 0.2));
  if (d.dragon) grp.add(box(1.2, 1.1, 1.6, PALETTE.wood, 0, 8.6, -0.6), box(0.8, 0.5, 1.1, PALETTE.wood, 0, 8.4, 0.5), rot(cone(0.2, 1, W, -0.4, 9.4, -1), -0.7, 0, 0), rot(cone(0.2, 1, W, 0.4, 9.4, -1), -0.7, 0, 0));
  if (d.wings) for (const sx of [-1, 1]) { const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(3.6, 1.4), new THREE.Vector2(4.4, 5.2), new THREE.Vector2(2.4, 4.0), new THREE.Vector2(1.2, 5.6), new THREE.Vector2(0, 3.2)]); const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: false }), mat(PALETTE.wood)); m.position.set(sx * 1.3, 3.4, -1.1); m.scale.x = sx; m.rotation.y = sx * -0.35; grp.add(m); }
  return grp;
}
/** An old ballista on a turntable: the stock, the bow arms and a slack string; `broken` leaves only its scattered timbers. Aims +x. */
export function ballista(d: Dims): THREE.Group {
  const W = '#4f3c2c', D = '#3b2d22';
  if (d.broken) { const r = seq(11), grp = g(rot(box(9, 0.6, 0.7, W, 0, 0.35, 0), 0, 0.5, 0)); for (let i = 0; i < 7; i++) { const m = box(1.5 + r() * 4, 0.35, 0.4, i % 2 ? W : D, (r() - 0.5) * 7, 0.2, (r() - 0.5) * 6); m.rotation.y = r() * 3; grp.add(m); } grp.add(cyl(1.4, 1.4, 0.3, D, 2.4, 0.6, 1.8, 10), rot(cyl(1.1, 1.1, 0.2, D, -2.6, 0.4, -2.2, 10), 0.3, 0, Math.PI / 2 - 0.1)); return grp; }
  const grp = g(cyl(2.2, 2.4, 0.6, D, 0, 0.3, 0, 10), box(1.2, 2.2, 1.2, W, 0, 1.7, 0), box(9, 0.6, 0.8, W, 0.4, 3.0, 0), box(0.4, 0.3, 0.3, PALETTE.iron, 4.8, 3.4, 0));
  for (const sz of [-1, 1]) { grp.add(beam([3.2, 3.1, sz * 0.4], [2.0, 3.3, sz * 4.2], 0.45, W)); grp.add(beam([2.0, 3.35, sz * 4.2], [-2.2, 3.3, 0], 0.08, '#8a7a5a')); }
  grp.add(box(0.8, 1.6, 0.8, D, -3.8, 3.0, 0), cyl(0.12, 0.12, 6, PALETTE.woodDark, 1.2, 3.45, 0, 5).rotateZ(Math.PI / 2));
  return grp;
}
/** A faded war banner on a pole bracket, hung `y` ft up against a wall; colour by `c` (0 silver-blue, 1 wine, 2 gold). Faces +z. */
export function banner(d: Dims): THREE.Group {
  const y = d.y ?? 9, C = [Q.banner, Q.velvet, Q.bannerGold][(d.c ?? 0) % 3];
  const grp = g(box(4, 0.25, 0.25, PALETTE.iron, 0, y, 0.3), box(3.4, 5.5, 0.12, C, 0, y - 2.9, 0.35), box(1.6, 1.6, 0.14, PALETTE.mist1, 0, y - 2.4, 0.4));
  for (const x of [-1.15, 0, 1.15]) grp.add(rot(cone(0.6, 1.2, C, x, y - 6.2, 0.35, 3), Math.PI, 0, 0));
  return grp;
}
/** An empty armour stand: a post on a cross base with a shoulder bar; `fallen` lays it down. */
export function armorStand(d: Dims): THREE.Group {
  const grp = g(box(2, 0.3, 0.4, PALETTE.woodDark, 0, 0.15, 0), box(0.4, 0.3, 2, PALETTE.woodDark, 0, 0.15, 0), box(0.35, 5.2, 0.35, PALETTE.wood, 0, 2.9, 0), box(2.2, 0.3, 0.4, PALETTE.wood, 0, 5, 0), ico(0.35, PALETTE.wood, 0, 5.7, 0));
  if (d.fallen) { const o = g(grp); grp.rotation.x = Math.PI / 2 - 0.1; grp.position.set(0, 0.4, 2.6); return o; }
  return grp;
}
/** A two-tier bunk bed; `broken` drops its upper tier across the lower. Long side along local z. */
export function bunkBed(d: Dims): THREE.Group {
  const grp = g(box(3.2, 0.4, 6.6, PALETTE.woodDark, 0, 1.2, 0), box(2.8, 0.4, 6.2, '#8a7a5a', 0, 1.6, 0));
  for (const [x, z] of [[-1.5, -3.2], [1.5, -3.2], [-1.5, 3.2], [1.5, 3.2]]) grp.add(box(0.35, d.broken && z > 0 ? 3 : 6.4, 0.35, PALETTE.woodDark, x, (d.broken && z > 0 ? 3 : 6.4) / 2, z));
  const upper = g(box(3.2, 0.4, 6.6, PALETTE.wood, 0, 0, 0), box(2.8, 0.35, 6.2, '#7a6a4a', 0, 0.35, 0));
  if (d.broken) { upper.position.set(0.3, 3.2, 0.4); upper.rotation.x = 0.45; } else upper.position.y = 4.6;
  grp.add(upper);
  return grp;
}
/** A stuffed brown bear reared on its hind legs, claws out, on a wooden base. Faces +z. */
export function stuffedBear(): THREE.Group {
  const B = '#4a3323', D = '#2a1a10', grp = g(box(3.6, 0.5, 3.2, PALETTE.woodDark, 0, 0.25, 0));
  const body = ico(1.6, B, 0, 4.2, 0, 1); body.scale.set(1, 1.6, 0.85); grp.add(body);
  for (const x of [-0.75, 0.75]) grp.add(box(0.9, 2.4, 1, B, x, 1.6, 0.1), box(1, 0.4, 1.3, D, x, 0.7, 0.3));
  grp.add(box(1.5, 1.4, 1.4, B, 0, 7.1, 0.3), box(0.8, 0.6, 0.8, D, 0, 6.9, 1.2), cone(0.25, 0.4, B, -0.6, 7.9, 0.2), cone(0.25, 0.4, B, 0.6, 7.9, 0.2));
  for (const sx of [-1, 1]) { const arm = g(box(0.7, 2.6, 0.7, B, 0, -1.3, 0)); for (let i = -1; i <= 1; i++) arm.add(rot(cone(0.08, 0.5, PALETTE.bone, i * 0.18, -2.75, 0.2, 4), Math.PI, 0, 0)); arm.position.set(sx * 1.3, 6.4, 0.5); arm.rotation.set(-2.1, 0, sx * 0.35); grp.add(arm); }
  return grp;
}
/** Crisscrossing rafters `y` ft up across a tower `w` ft wide, with ravens roosting along them. */
export function raftersRavens(d: Dims): THREE.Group {
  const y = d.y ?? 16, w = d.w ?? 28, grp = g(), r = seq(13);
  for (const a of [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]) { const m = box(w * (a % (Math.PI / 2) ? 0.85 : 1), 0.7, 0.7, PALETTE.woodDark, 0, y + (a % (Math.PI / 2) ? 1.2 : 0), 0); m.rotation.y = a; grp.add(m); }
  for (let i = 0; i < (d.n ?? 9); i++) { const a = Math.floor(r() * 4) * Math.PI / 4, t = (r() - 0.5) * w * 0.8, x = Math.cos(a) * t, z = -Math.sin(a) * t, yy = y + 0.35 + (a % (Math.PI / 2) ? 1.2 : 0);
    const bird = g(ico(0.32, '#141216', 0, 0.35, 0), ico(0.2, '#141216', 0.3, 0.6, 0), box(0.2, 0.08, 0.1, '#3a3020', 0.5, 0.58, 0), rot(box(0.5, 0.06, 0.25, '#141216', -0.45, 0.3, 0), 0, 0, 0.3)); bird.position.set(x, yy, z); bird.rotation.y = r() * 6; grp.add(bird); }
  return grp;
}
/** Weapons and shields hung along a wall `len` ft (local x): kite shields with the order's silver device between crossed blades. Faces +z. */
export function weaponsWall(d: Dims): THREE.Group {
  const L = d.len ?? 20, y = d.y ?? 7, rusted = !!d.rusted, grp = g();
  const metal = rusted ? '#5a4a3e' : PALETTE.mist1;
  for (let x = -L / 2 + 2.5; x < L / 2 - 1; x += 5) {
    if (d.fallen) { grp.add(rot(box(1.6, 0.2, 2.2, rusted ? '#4a3a32' : Q.banner, x, 0.12, 0.8), 0, 0.4, 0), rot(box(4, 0.12, 0.25, metal, x + 1.2, 0.08, 1.6), 0, 1.1, 0)); continue; }
    const sh = g(box(1.6, 2, 0.2, Q.banner, 0, 0, 0), cone(0.8, 0.8, Q.banner, 0, -1.4, 0, 4), box(0.7, 0.9, 0.08, PALETTE.mist0, 0, 0.1, 0.12)); sh.position.set(x, y, 0.2); grp.add(sh);
    for (const s of [-1, 1]) grp.add(rot(box(0.18, 4.4, 0.1, metal, x + 2.5, y, 0.15), 0, 0, s * 0.6));
  }
  return grp;
}
/** A paler patch on the stone above a mantel, the shape of the shield that hung there. */
export function shieldPatch(d: Dims): THREE.Group { const y = d.y ?? 8; return g(box(2, 2.2, 0.06, '#a8a49c', 0, y, 0), cone(1, 1, '#a8a49c', 0, y - 1.6, 0, 4).rotateY(Math.PI / 4)); }
/** A sunrise altar: a block of stone carved with the dawn, rays fanning above the horizon. Faces +z (the congregation). */
export function sunAltar(): THREE.Group {
  const grp = g(box(7, 0.5, 4, PALETTE.stoneDeep, 0, 0.25, 0), box(6, 3, 3, PALETTE.stone, 0, 2, 0), box(6.6, 0.4, 3.4, PALETTE.stoneDeep, 0, 3.7, 0));
  const sun = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.2, 12, 1, false, -Math.PI / 2, Math.PI), mat(PALETTE.amberDeep)); sun.rotation.x = Math.PI / 2; sun.position.set(0, 1.4, 1.55); grp.add(sun);
  for (let i = 0; i < 7; i++) { const a = (i / 6) * Math.PI, r = box(0.15, 0.9, 0.1, PALETTE.amberDeep, Math.cos(a) * 1.8, 1.4 + Math.sin(a) * 1.8, 1.55); r.rotation.z = a - Math.PI / 2; grp.add(r); }
  return grp;
}
/** A tall iron candelabrum of five branches. */
export function candelabra(d: Dims): THREE.Group {
  const h = d.h ?? 6, grp = g(cyl(0.6, 0.8, 0.3, PALETTE.iron, 0, 0.15, 0), cyl(0.1, 0.12, h, PALETTE.iron, 0, h / 2, 0, 6), box(2.6, 0.15, 0.15, PALETTE.iron, 0, h - 0.6, 0), box(0.15, 0.15, 2.6, PALETTE.iron, 0, h - 0.6, 0));
  for (const [x, z] of [[0, 0], [1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2]]) grp.add(box(0.22, 0.6, 0.22, PALETTE.bone, x, h - 0.2, z));
  return grp;
}
/** Battlements: a run of merlons `len` ft along local x on top of a parapet `y` ft high. */
export function crenels(d: Dims): THREE.Group {
  const L = d.len ?? 10, y = d.y ?? 4, grp = g(), n = Math.max(1, Math.floor(L / 3));
  for (let i = 0; i < n; i++) grp.add(box(1.6, 1.8, 1.1, '#6f7680', -L / 2 + (i + 0.5) * (L / n), y + 0.9, 0));
  return grp;
}
/** Battlements round a tower top: `n` merlons on a circle of radius `r`, a parapet `y` ft high. */
export function crenelRing(d: Dims): THREE.Group {
  const r = d.r ?? 15, y = d.y ?? 4, n = d.n ?? 16, grp = g(), a0 = d.a0 ?? 0, a1 = d.a1 ?? 360;
  for (let i = 0; i < n; i++) { const a = ((a0 + (i + 0.5) * (a1 - a0) / n) * Math.PI) / 180, m = box(1.6, 1.8, 1.1, '#6f7680', Math.cos(a) * r, y + 0.9, -Math.sin(a) * r); m.rotation.y = a + Math.PI / 2; grp.add(m); }
  return grp;
}
/** An iron cooking pot on a hook inside a hearth, rattling. */
export function ironPot(d: Dims): THREE.Group { const y = d.y ?? 2.5; return g(box(0.1, 1.6, 0.1, PALETTE.iron, 0, y + 1.6, 0), cyl(0.8, 0.6, 1, PALETTE.iron, 0, y + 0.4, 0, 10), box(1.8, 0.12, 0.12, PALETTE.iron, 0, y + 1, 0)); }
/** An iron bathtub (a clawed iron one, or heaped with debris when `debris`). Long side along local x. */
export function ironTub(d: Dims): THREE.Group {
  const grp = g(box(5.2, 2.2, 2.6, Q.ironDark, 0, 1.5, 0), box(4.6, 0.25, 2, d.debris ? '#5f5d5a' : '#1a1c20', 0, 2.5, 0));
  for (const [x, z] of [[-2.3, -1.1], [2.3, -1.1], [-2.3, 1.1], [2.3, 1.1]]) grp.add(ico(0.32, Q.ironDark, x, 0.3, z));
  if (d.debris) for (let i = 0; i < 4; i++) grp.add(ico(0.45, i % 2 ? PALETTE.stoneDeep : Q.tile, -1.5 + i, 2.8, (i % 2) * 0.6 - 0.3));
  return grp;
}

/** A tower's pitched roof of slate: an open-bottomed cone of `n` sides, radius `r` past the walls, `h` high, sitting at
 *  `y`, an eaves ring and an iron finial; open beneath, so the room under it still shows when the section lifts it. */
export function towerRoof(d: Dims): THREE.Group {
  const r = (d.r ?? 15) + 1.2, h = d.h ?? 14, y = d.y ?? 10, n = d.n ?? 8;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, n, 1, true), mat('#3d3a3e')); cone.position.y = y + h / 2; cone.rotation.y = Math.PI / n;
  const eave = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.4, r + 0.4, 0.6, n, 1, true), mat('#2b292d')); eave.position.y = y + 0.3; eave.rotation.y = Math.PI / n;
  const grp = g(cone, eave, cyl(0.25, 0.3, 3, PALETTE.iron, 0, y + h + 1.2, 0, 6), ico(0.35, PALETTE.iron, 0, y + h + 2.9, 0));
  grp.traverse((c) => { c.userData.role = 'roof'; });   // a shell: the section plane slices it like the walls under it
  return grp;
}
/** A stone inlay laid in the floor, `w` × `d`: the ballroom's pink marble (`pink`), or the foyer's mosaic, a ring of
 *  dragon-scale tiles round a silver medallion. Flush with the floor, so it reads as floor. */
export function floorInlay(d: Dims): THREE.Group {
  const w = d.w ?? 20, dd = d.d ?? 20, grp = g();
  if (d.pink) { const m = box(w, 0.06, dd, '#857170', 0, 0.03, 0); grp.add(m); for (let i = 1; i < 4; i++) grp.add(box(w, 0.07, 0.25, '#94807d', 0, 0.035, -dd / 2 + (i * dd) / 4)); }
  else {
    const r = Math.min(w, dd) / 2;
    grp.add(cyl(r, r, 0.06, '#666b73', 0, 0.03, 0, 24), cyl(r * 0.82, r * 0.82, 0.07, '#57535c', 0, 0.035, 0, 24), cyl(r * 0.36, r * 0.36, 0.08, Q.silverDeep, 0, 0.04, 0, 16));
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, t = box(r * 0.3, 0.075, r * 0.12, i % 2 ? '#5e3a3c' : '#6e6248', Math.cos(a) * r * 0.6, 0.04, Math.sin(a) * r * 0.6); t.rotation.y = -a; grp.add(t); }
  }
  grp.traverse((c) => { c.userData.role = 'floor'; });
  return grp;
}
/** Bare oak shelves `w` ft long against a wall, emptied of every book. Faces +z. */
export function bareShelves(d: Dims): THREE.Group {
  const w = d.w ?? 6, grp = g(box(w, 8, 0.25, PALETTE.wood, 0, 4, -0.6), box(0.25, 8, 1.4, PALETTE.wood, -w / 2, 4, 0), box(0.25, 8, 1.4, PALETTE.wood, w / 2, 4, 0), box(w + 0.3, 0.3, 1.5, PALETTE.woodDark, 0, 8.1, 0));
  for (let i = 0; i < 4; i++) grp.add(box(w - 0.2, 0.15, 1.3, PALETTE.wood, 0, 0.4 + i * 1.9, 0));
  return grp;
}
/** An overstuffed leather armchair; `tipped` lays it on its side with the padding torn. Faces +z. */
export function leatherChair(d: Dims): THREE.Group {
  const L = '#5a3a28', grp = g(box(2.8, 1.4, 2.6, L, 0, 1.0, 0.1), box(2.8, 2.6, 0.7, L, 0, 2.6, -1.0), box(0.6, 1.2, 2.6, L, -1.2, 2.1, 0.1), box(0.6, 1.2, 2.6, L, 1.2, 2.1, 0.1));
  for (const [x, z] of [[-1.1, -1], [1.1, -1], [-1.1, 1.1], [1.1, 1.1]]) grp.add(box(0.3, 0.3, 0.3, PALETTE.woodDark, x, 0.15, z));
  if (d.tipped) { grp.add(box(1.2, 0.3, 0.8, '#b8a888', 0.3, 1.8, 0.4)); const o = g(grp); grp.rotation.z = Math.PI / 2; grp.position.set(1.4, 1.4, 0); return o; }
  return grp;
}

// ---------------------------------------------------------------- figures
/** A giant spider: a bristling body and swollen abdomen on eight jointed legs, about eight feet across. */
export function giantSpider(): THREE.Group {
  const grp = new THREE.Group();
  const abd = ico(1.5, Q.spider, -1.3, 2.4, 0, 1); abd.scale.set(1.25, 0.95, 1.05);
  const thorax = ico(0.95, Q.spiderDeep, 0.6, 2.1, 0, 1); thorax.scale.set(1.1, 0.75, 1);
  grp.add(abd, thorax, ico(0.55, Q.spiderDeep, 1.6, 2.05, 0), box(0.5, 0.35, 0.12, Q.spiderRed, -1.3, 3.45, 0), box(0.3, 0.12, 0.6, Q.spiderRed, -1.3, 3.45, 0));
  for (const z of [-0.18, 0.18]) grp.add(rot(cone(0.1, 0.5, PALETTE.bone, 2.05, 1.75, z, 4), 0, 0, 2.6), ico(0.09, '#c9632e', 1.95, 2.3, z * 1.6));
  for (let i = 0; i < 4; i++) for (const sz of [-1, 1]) {
    const x0 = 0.95 - i * 0.45, spread = 0.7 - i * 0.35, knee: [number, number, number] = [x0 + spread * 1.4, 3.3, sz * 1.9], foot: [number, number, number] = [x0 + spread * 2.8, 0.05, sz * 3.4];
    grp.add(beam([x0, 2.1, sz * 0.5], knee, 0.26, Q.spider), beam(knee, foot, 0.18, Q.spiderDeep));
  }
  return grp;
}
/** A revenant of the Order: a gaunt corpse in torn chainmail with a longsword; `kneel` sets it on one knee before an altar. */
export function revenant(d: Dims = {}): THREE.Group {
  const fig = humanoid({ skin: Q.corpse, cloth: Q.chain, trim: Q.corpseDeep, hunch: 0.12, weapon: 'sword', scale: d.scale ?? 1 });
  fig.add(box(1.2, 1.9, 0.12, Q.banner, 0, 3.6, 0.48));   // the tabard of the Order, rotted to a strip
  if (d.kneel) { fig.scale.y = 0.78; fig.position.y = -0.2; fig.rotation.x = 0.12; }
  return g(fig);
}
/** A phantom warrior: a knight of pale light with sword and shield, or a spectral longbow when `bow`. */
export function phantomWarrior(d: Dims = {}): THREE.Group {
  const fig = humanoid({ skin: Q.phantom, cloth: Q.phantomDeep, trim: Q.phantom, helm: 'cap', weapon: d.bow ? 'none' : 'sword', scale: 1.02 });
  if (d.bow) { const bow = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.1, 4, 10, Math.PI), mat(Q.phantom)); bow.position.set(-0.95, 4, 0.5); bow.rotation.z = -Math.PI / 2; fig.add(bow); }
  else fig.add(box(0.2, 1.9, 1.4, Q.phantomDeep, -1.0, 3.6, 0.3));
  fig.traverse((c) => { const m = c as THREE.Mesh; if (!m.isMesh) return; const src = m.material as THREE.MeshLambertMaterial; const nm = matClone('#' + src.color.getHexString()); nm.transparent = true; nm.opacity = 0.6; nm.depthWrite = false; nm.emissive.set('#26303e'); m.material = nm; });
  return g(fig);
}
/** Vladimir Horngaard: a gaunt revenant in half plate under a wine-dark cloak, a greatsword grounded before him. */
export function vladimir(): THREE.Group {
  const fig = humanoid({ skin: Q.corpse, cloth: PALETTE.iron, trim: '#2b2c31', cloak: true, hunch: 0.08, weapon: 'none', scale: 1.08 });
  fig.add(box(0.2, 5, 0.45, PALETTE.mist1, 0.4, 2.7, 0.9), box(1.3, 0.2, 0.25, PALETTE.amberDeep, 0.4, 5.2, 0.9), box(0.22, 1.1, 0.22, PALETTE.woodDark, 0.4, 5.85, 0.9));
  for (const sx of [-1, 1]) fig.add(box(0.8, 0.5, 0.9, PALETTE.iron, sx * 0.85, 5.15, 0));   // pauldrons
  return g(fig);
}
/** The smoky dragonet from the hearth: a small dragon of ash and smoke with ember eyes. */
export function smokeDragonet(): THREE.Group {
  const S = Q.smoke, grp = g(ico(0.9, S, 0, 2.2, 0, 1), box(0.8, 0.6, 0.6, S, 1.1, 2.7, 0), ico(0.1, '#c9632e', 1.4, 2.9, 0.22), ico(0.1, '#c9632e', 1.4, 2.9, -0.22), rot(cone(0.35, 1.6, S, -1.2, 2.1, 0), 0, 0, Math.PI / 2));
  for (const sz of [-1, 1]) grp.add(rot(box(1.6, 0.08, 1.4, Q.soot, -0.1, 2.8, sz * 0.9), sz * -0.6, 0, 0));
  return grp;
}
/** A bat in flight, wings spread, about four feet off the floor. */
export function bat(): THREE.Group {
  const grp = g(ico(0.25, '#241e20', 0, 4, 0), cone(0.08, 0.2, '#241e20', 0.12, 4.28, 0.1, 4), cone(0.08, 0.2, '#241e20', 0.12, 4.28, -0.1, 4));
  for (const sz of [-1, 1]) grp.add(rot(box(0.6, 0.05, 0.9, '#2d2628', 0, 4.05, sz * 0.55), sz * -0.4, 0, 0));
  return grp;
}
/** A dusk elf in a grey travelling cloak, wounded, a shortbow slung. */
export function duskElf(): THREE.Group {
  const fig = humanoid({ skin: '#8f7f78', cloth: '#4a4a4e', trim: '#2b2c31', hair: '#1a1a1e', cloak: true, scale: 0.98, hunch: 0.2 });
  fig.add(box(1.1, 0.25, 0.3, PALETTE.bone, 0.1, 3.3, 0.45));   // a bloodied bandage
  return g(fig);
}

Object.assign(PROPS_V1, {
  'dragon-statue': dragonStatue, 'iron-fence': ironFence, 'open-grave': openGrave, 'mausoleum-roof': mausoleumRoof, 'wyrmling-statue': wyrmlingStatue,
  'stair-flight': stairFlight, 'tall-column': tallColumn, 'bust-pedestal': bustPedestal, 'sarcophagus-cabinet': sarcophagusCabinet, divan, wreckage,
  'rubble-heap': rubbleHeap, 'broken-rafters': brokenRafters, 'fallen-chandelier': fallenChandelier, 'web-sheet': webSheet, 'knight-statue': knightStatue,
  'dragon-table': dragonTable, 'wing-chair': wingChair, 'dragon-throne': dragonThrone, ballista, banner, 'armor-stand': armorStand, 'bunk-bed': bunkBed,
  'stuffed-bear': stuffedBear, 'rafters-ravens': raftersRavens, 'weapons-wall': weaponsWall, 'shield-patch': shieldPatch, 'sun-altar': sunAltar, candelabra,
  crenels, 'crenel-ring': crenelRing, 'iron-pot': ironPot, 'iron-tub': ironTub, 'bare-shelves': bareShelves, 'leather-chair': leatherChair, 'tower-roof': towerRoof, 'floor-inlay': floorInlay,
} as Record<string, (d: Dims) => THREE.Object3D>);

Object.assign(CREATURES, {
  'giant-spider': () => giantSpider(), revenant: (d) => revenant(d), 'phantom-warrior': (d) => phantomWarrior(d), 'vladimir-horngaard': () => vladimir(),
  'smoke-dragonet': () => smokeDragonet(), bat: () => bat(), 'dusk-elf': () => duskElf(),
} as Record<string, (d: Dims) => THREE.Group>);
