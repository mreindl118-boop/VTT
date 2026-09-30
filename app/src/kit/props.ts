// Kit v1 props for Death House and the general interiors. All in feet, origin at floor centre, +Z = plan south.
import * as THREE from 'three';
import { mat } from '../render/materials';
import { PALETTE } from './palette';
import { merge, regularPolygonGeometry } from './pieces';

type Dims = Record<string, number>;
const box = (w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  return m;
};
const g = (...m: THREE.Object3D[]) => { const grp = new THREE.Group(); if (m.length) grp.add(...m); return grp; };

/** Spiral stair: `dims.rise` ft over `dims.turns` turns, radius `dims.r` (default 6). */
export function spiralStair(d: Dims): THREE.Group {
  const rise = d.rise ?? 10, r = d.r ?? 6, turns = d.turns ?? 0.9;
  const steps = Math.max(6, Math.round(rise / 0.7));
  const gs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < steps; i++) {
    const a0 = (i / steps) * turns * Math.PI * 2, a1 = ((i + 1) / steps) * turns * Math.PI * 2;
    const y = ((i + 1) / steps) * rise;
    const shape = new THREE.Shape();
    shape.moveTo(Math.cos(a0) * 1.2, Math.sin(a0) * 1.2);
    shape.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
    shape.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
    shape.lineTo(Math.cos(a1) * 1.2, Math.sin(a1) * 1.2);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: false });
    geo.rotateX(Math.PI / 2);
    geo.translate(0, y, 0);
    gs.push(geo);
  }
  const treads = new THREE.Mesh(merge(gs), mat(PALETTE.wine));
  const newel = box(1.6, rise + 3, 1.6, PALETTE.stoneDeep, 0, (rise + 3) / 2, 0);
  const grp = g(treads, newel);
  grp.userData.role = 'stairs';
  return grp;
}

export function fireplace(): THREE.Group {
  return g(box(6, 6, 1.5, PALETTE.stoneDeep, 0, 3, 0), box(6.5, 0.5, 2, PALETTE.stone, 0, 6, 0.2), box(3, 3, 0.6, '#0e0c10', 0, 1.5, 0.6));
}
export function chair(): THREE.Group {
  return g(box(1.6, 0.3, 1.6, PALETTE.wood, 0, 1.5, 0), box(1.6, 2, 0.3, PALETTE.woodDark, 0, 2.5, -0.65), box(0.25, 1.5, 0.25, PALETTE.woodDark, -0.6, 0.75, 0.6), box(0.25, 1.5, 0.25, PALETTE.woodDark, 0.6, 0.75, 0.6));
}
export function bookshelf(d: Dims): THREE.Group {
  const w = d.w ?? 5;
  const grp = g(box(w, 8, 1.2, PALETTE.woodDark, 0, 4, 0));
  for (let i = 0; i < 4; i++) grp.add(box(w - 0.4, 0.15, 1.3, PALETTE.wood, 0, 1.5 + i * 1.8, 0), box(w - 0.6, 1.2, 0.9, i % 2 ? PALETTE.wine : PALETTE.pineDeep, 0, 2.2 + i * 1.8, 0.05));
  return grp;
}
export function desk(): THREE.Group { return g(box(5, 0.3, 2.5, PALETTE.wood, 0, 2.6, 0), box(4.6, 2.4, 2.2, PALETTE.woodDark, 0, 1.2, 0)); }
export function wardrobe(): THREE.Group { return g(box(4, 7, 2, PALETTE.woodDark, 0, 3.5, 0), box(0.2, 5, 0.1, PALETTE.iron, 0, 3.5, 1.05)); }
export function stove(): THREE.Group { return g(box(2.2, 2.6, 2.2, PALETTE.iron, 0, 1.3, 0), box(0.6, 6, 0.6, PALETTE.iron, 0.6, 5, -0.6)); }
export function oven(): THREE.Group {
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(PALETTE.stoneDeep));
  dome.position.y = 1;
  return g(box(4.5, 1, 4.5, PALETTE.stone, 0, 0.5, 0), dome);
}
/** Crib under a hanging black shroud: dark drapes on four sides, open to the top-down view. */
export function crib(): THREE.Group {
  const shroud = '#121016';
  return g(box(2.4, 1.6, 3.4, PALETTE.woodDark, 0, 0.8, 0), box(2.2, 0.2, 3.2, PALETTE.bone, 0, 1.7, 0),
    box(0.1, 4.2, 3.7, shroud, -1.3, 3.1, 0), box(0.1, 4.2, 3.7, shroud, 1.3, 3.1, 0), box(2.7, 4.2, 0.1, shroud, 0, 3.1, -1.8), box(1.6, 3.4, 0.1, shroud, -0.5, 3.5, 1.8),
    box(0.12, 0.12, 3.8, PALETTE.iron, 0, 5.2, 0));
}
export function harpsichord(): THREE.Group { return g(box(6, 0.4, 3, PALETTE.woodDark, 0, 2.8, 0), box(5.5, 2.4, 2.5, PALETTE.wood, 0, 1.4, 0), box(2, 0.4, 3.2, PALETTE.bone, -2, 3, 0)); }
export function harp(): THREE.Group {
  const frame = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.2, 6, 10, Math.PI), mat(PALETTE.amberDeep));
  frame.position.y = 2.2;
  return g(frame, box(0.3, 4, 0.3, PALETTE.amberDeep, 1.8, 2, 0));
}
export function armorSuit(): THREE.Group {
  return g(box(2, 0.4, 2, PALETTE.stoneDeep, 0, 0.2, 0), box(1.6, 3, 1, PALETTE.iron, 0, 2.2, 0), box(1.1, 1.1, 1.1, PALETTE.iron, 0, 4.4, 0), box(0.25, 6.5, 0.25, PALETTE.woodDark, 1.1, 3.25, 0));
}
export function statue(): THREE.Group {
  return g(box(4, 1, 4, PALETTE.stoneDeep, 0, 0.5, 0), box(1.6, 5, 1.2, '#1a171d', 0, 3.5, 0), new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), mat(PALETTE.bone)).translateY(6.4),
    box(2.2, 1.6, 1, PALETTE.mist3, 1.8, 1.8, 0.6));
}
export function altar(): THREE.Group { return g(box(6, 3, 3, PALETTE.stoneDeep, 0, 1.5, 0), box(6.4, 0.4, 3.4, PALETTE.blood, 0, 3.2, 0)); }
export function well(): THREE.Group {
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 3, 10, 1, true), mat(PALETTE.stone));
  ring.position.y = 1.5;
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.2, 10), mat('#07070a'));
  hole.position.y = 2.95;
  return g(ring, hole, box(0.4, 7, 0.4, PALETTE.woodDark, -2.6, 3.5, 0), box(0.4, 7, 0.4, PALETTE.woodDark, 2.6, 3.5, 0), box(6, 0.4, 0.4, PALETTE.woodDark, 0, 7, 0));
}
export function portcullis(d: Dims): THREE.Group {
  const w = d.w ?? 5, h = d.h ?? 7;
  const grp = g();
  for (let i = 0; i < 5; i++) grp.add(box(0.25, h, 0.25, PALETTE.iron, -w / 2 + 0.6 + i * ((w - 1.2) / 4), h / 2, 0));
  for (let j = 0; j < 3; j++) grp.add(box(w - 0.8, 0.25, 0.25, PALETTE.iron, 0, 1.2 + j * 2.4, 0));
  return grp;
}
export function ledge(d: Dims): THREE.Group {
  const m = box(d.w ?? 5, d.h ?? 5, d.d ?? 5, '#5a606a', 0, (d.h ?? 5) / 2, 0);
  m.userData.role = 'floor'; // raised floor: the grid overlay ignores it; the mask test treats it as floor
  return g(m);
}
/** Octagonal dais of `steps` tiers up to `h` ft, flat width `w`. */
export function dais(d: Dims): THREE.Group {
  const w = d.w ?? 15, h = d.h ?? 5, steps = d.steps ?? 3;
  const grp = g();
  for (let i = 0; i < steps; i++) {
    const width = w - i * (w / (steps + 1)) * 0.6;
    const geo = regularPolygonGeometry(8, width, (h / steps) * (i + 1));
    const m = new THREE.Mesh(geo, mat(i === steps - 1 ? '#6a6f78' : '#565b64'));
    grp.add(m);
  }
  return grp;
}
export function pallet(): THREE.Group { return g(box(3, 0.6, 6, '#8a7a4a', 0, 0.3, 0)); }
export function niche(): THREE.Group { return g(box(1.6, 1.6, 1, '#141218', 0, 3.5, 0), box(1, 0.6, 0.6, PALETTE.bone, 0, 3.3, 0.2)); }
export function trunk(): THREE.Group { return g(box(3.5, 1.6, 2, PALETTE.woodDark, 0, 0.8, 0), box(3.7, 0.3, 2.2, PALETTE.iron, 0, 1.7, 0)); }
export function cabinet(): THREE.Group { return g(box(3.5, 6, 1.6, PALETTE.woodDark, 0, 3, 0)); }
export function sheetedFurniture(): THREE.Group {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 0), mat(PALETTE.mist1));
  m.scale.set(1, 1.3, 1); m.position.y = 2.2;
  return g(m);
}
export function refuse(): THREE.Group {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(4.5, 1), mat('#3a3f2c'));
  m.scale.set(1, 0.55, 1); m.position.y = 1.2;
  return g(m);
}
export function trapdoor(): THREE.Group { return g(box(4, 0.15, 4, PALETTE.woodDark, 0, 0.08, 0), box(0.6, 0.2, 0.3, PALETTE.iron, 1.4, 0.2, 0)); }
export function gate(): THREE.Group { return portcullis({ w: 5, h: 8 }); }
export function wheel(): THREE.Group {
  const m = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.25, 6, 10), mat(PALETTE.woodDark));
  m.position.y = 3.5;
  return g(m, box(0.3, 3.4, 0.3, PALETTE.woodDark, 0, 3.5, 0), box(3.4, 0.3, 0.3, PALETTE.woodDark, 0, 3.5, 0));
}
export function skeleton(): THREE.Group { return g(box(1.2, 0.5, 4, PALETTE.bone, 0, 0.25, 0), new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), mat(PALETTE.bone)).translateY(0.6).translateZ(-2)); }
export function pitCover(): THREE.Group { return g(box(4.6, 0.12, 4.6, '#4a3f33', 0, 0.06, 0)); }
export function dollhouse(): THREE.Group { return g(box(2.2, 2.6, 1.4, PALETTE.mist2, 0, 1.3, 0), box(2.4, 0.9, 1.6, PALETTE.wine, 0, 3, 0)); }
export function toyChest(): THREE.Group { return g(box(2.6, 1.4, 1.6, PALETTE.wood, 0, 0.7, 0)); }
export function lamp(): THREE.Group { return g(box(0.5, 0.5, 0.5, PALETTE.amber, 0, 6.5, 0), box(0.15, 1.5, 0.15, PALETTE.iron, 0, 7.4, 0)); }
export function dumbwaiter(): THREE.Group { return g(box(2, 6, 2, PALETTE.stoneDeep, 0, 3, 0), box(1.4, 1.2, 0.2, PALETTE.woodDark, 0, 3, 1.05)); }

export const PROPS_V1: Record<string, (d: Dims) => THREE.Object3D> = {
  'spiral-stair': spiralStair, fireplace, chair, bookshelf, desk, wardrobe, stove, oven, crib, harpsichord, harp,
  'armor-suit': armorSuit, statue, altar, well, portcullis, ledge, dais, pallet, niche, trunk, cabinet,
  sheeted: sheetedFurniture, refuse, trapdoor, gate, wheel, skeleton, 'pit-cover': pitCover, dollhouse, 'toy-chest': toyChest, lamp, dumbwaiter,
};

// ---------------------------------------------------------------- kit v2: characterized props
import { wolf } from './creatures';
const boxr = (w: number, h: number, d: number, color: string, x: number, y: number, z: number, ry: number) => { const m = box(w, h, d, color, x, y, z); m.rotation.y = ry; return m; };
const cyl = (rt: number, rb: number, h: number, color: string, x = 0, y = 0, z = 0, seg = 8) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color)); m.position.set(x, y, z); return m; };
const ico = (r: number, color: string, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat(color)); m.position.set(x, y, z); return m; };

export function chandelier(d: Dims): THREE.Group {
  const y = d.y ?? 8, brass = d.brass ? PALETTE.amberDeep : PALETTE.iron;
  const g = g_(cyl(0.08, 0.08, 3, brass, 0, y + 1.5, 0), cyl(1.6, 1.6, 0.18, brass, 0, y, 0, 10));
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.add(box(0.14, 0.5, 0.14, PALETTE.bone, Math.cos(a) * 1.4, y + 0.35, Math.sin(a) * 1.4), ico(0.1, PALETTE.amber, Math.cos(a) * 1.4, y + 0.7, Math.sin(a) * 1.4)); }
  if (d.crystal) for (let i = 0; i < 8; i++) { const a = (i / 8 + 0.06) * Math.PI * 2; g.add(ico(0.12, PALETTE.mist0, Math.cos(a) * 1.1, y - 0.4, Math.sin(a) * 1.1)); }
  return g;
}
/** Drapes over a window: two hanging panels, colour per room (red silk, burgundy, red velvet, gossamer). */
export function drapes(d: Dims): THREE.Group {
  const color = d.color !== undefined ? '#' + d.color.toString(16).padStart(6, '0') : PALETTE.wine;
  const w = d.w ?? 5;
  return g_(box(w + 0.6, 0.18, 0.4, PALETTE.woodDark, 0, 8.2, 0), box(w * 0.32, 7.6, 0.25, color, -w * 0.32, 4.3, 0.15), box(w * 0.32, 7.6, 0.25, color, w * 0.32, 4.3, 0.15));
}
/** Wall-mounted shield with the Durst arms (a golden windmill on red). */
export function shieldOfArms(): THREE.Group {
  const g = g_(box(2.2, 2.6, 0.3, PALETTE.wine, 0, 5.4, 0));
  for (let i = 0; i < 4; i++) { const s = box(0.25, 1.1, 0.12, PALETTE.amber, 0, 5.4, 0.2); s.rotation.z = (i * Math.PI) / 4; g.add(s); }
  return g;
}
export function portrait(d: Dims): THREE.Group {
  const w = d.w ?? 2.2, h = d.h ?? 2.8, y = d.y ?? 6;
  const g = g_(box(w, h, 0.25, PALETTE.amberDeep, 0, y, 0), box(w - 0.4, h - 0.4, 0.3, d.dusty ? '#4a4540' : '#2b2530', 0, y, 0.02));
  if (!d.landscape) g.add(ico(0.32, d.dusty ? '#7a7068' : '#c9a98a', 0, y + 0.3, 0.2), box(0.9, 0.9, 0.2, '#1a171d', 0, y - 0.45, 0.2));
  else g.add(box(w - 0.6, 0.6, 0.2, PALETTE.pine, 0, y - 0.5, 0.2), box(w - 0.8, 0.5, 0.2, PALETTE.mist1, 0, y + 0.4, 0.2));
  return g;
}
export function stagHead(): THREE.Group {
  const g = g_(box(1.4, 1.6, 0.3, PALETTE.woodDark, 0, 7, 0), box(0.9, 1.1, 1.2, '#7a5a3e', 0, 7, 0.6), box(0.5, 0.5, 0.6, '#5a4030', 0, 6.7, 1.3));
  for (const x of [-0.5, 0.5]) { g.add(box(0.12, 1.6, 0.12, PALETTE.bone, x, 8.3, 0.4), box(0.6, 0.1, 0.1, PALETTE.bone, x, 8.6, 0.4), box(0.5, 0.1, 0.1, PALETTE.bone, x * 1.4, 8.2, 0.4)); }
  return g;
}
export const stuffedWolf = () => wolf({ stuffed: 1 });
export function cloakHooks(): THREE.Group {
  const g = g_(box(4, 0.2, 0.2, PALETTE.woodDark, 0, 6.6, 0));
  for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.55, 4.6, 5), mat('#1a171d')); c.position.set(-1.5 + i, 4.2, 0.3); g.add(c); }
  g.add(box(0.5, 0.35, 0.5, '#1a171d', 1.6, 7.4, 0.1), cyl(0.4, 0.4, 0.5, '#1a171d', 1.6, 7.85, 0.1, 10));
  return g;
}
export function shelves(d: Dims): THREE.Group {
  const w = d.w ?? 5, g = g_(box(w, 7, 1, PALETTE.woodDark, 0, 3.5, 0));
  for (let i = 0; i < 4; i++) { g.add(box(w - 0.3, 0.12, 1.1, PALETTE.wood, 0, 1.4 + i * 1.7, 0)); for (let k = 0; k < 3; k++) g.add(d.linen ? box(w / 4, 0.35 + (k % 2) * 0.2, 0.8, k === 1 ? '#c9c2b0' : PALETTE.bone, -w / 3 + k * (w / 3), 1.65 + i * 1.7, 0.1) : d.food ? ico(0.28, k % 2 ? '#8a6b3a' : PALETTE.bone, -w / 3 + k * (w / 3), 1.75 + i * 1.7, 0.2) : cyl(0.25, 0.25, 0.5, k % 2 ? PALETTE.mist1 : PALETTE.amberDeep, -w / 3 + k * (w / 3), 1.7 + i * 1.7, 0.2, 8)); }
  return g;
}
export function barrelSpigot(): THREE.Group { return g_(cyl(1, 1.1, 2.6, PALETTE.wood, 0, 1.3, 0, 10), box(0.5, 0.5, 0.5, PALETTE.iron, 0, 1.8, 0.9), cyl(0.15, 0.15, 3, PALETTE.iron, 0, 4.6, 0.6)); }
export function tub(): THREE.Group {
  const g = g_(box(5, 2.2, 2.6, PALETTE.wood, 0, 1.4, 0), box(4.4, 0.3, 2, '#3e5566', 0, 2.4, 0));
  for (const [x, z] of [[-2.2, -1.1], [2.2, -1.1], [-2.2, 1.1], [2.2, 1.1]]) g.add(ico(0.3, PALETTE.iron, x, 0.25, z));
  return g;
}
export function standingMirror(d: Dims): THREE.Group {
  return g_(box(2.6, 6.6, 0.3, d.ivy ? PALETTE.pineDeep : PALETTE.woodDark, 0, 3.6, 0), box(2.1, 6.0, 0.2, '#8fa3b8', 0, 3.6, 0.1));
}
export function fourPosterBed(): THREE.Group {
  const g = g_(box(6, 1.8, 7.5, PALETTE.woodDark, 0, 0.9, 0), box(5.4, 0.8, 6.9, PALETTE.bone, 0, 2.2, 0.2), box(2, 0.4, 1.2, PALETTE.mist1, 0, 2.8, -2.6));
  for (const [x, z] of [[-2.8, -3.5], [2.8, -3.5], [-2.8, 3.5], [2.8, 3.5]]) g.add(cyl(0.18, 0.18, 8, PALETTE.woodDark, x, 4, z));
  g.add(box(6.2, 0.2, 7.7, PALETTE.woodDark, 0, 8, 0), box(0.25, 5.2, 7.2, '#5b1f2b', -2.85, 5.1, 0), box(0.25, 5.2, 7.2, '#5b1f2b', 2.85, 5.1, 0));
  return g;
}
export function nightstand(): THREE.Group { return g_(box(1.6, 2.4, 1.6, PALETTE.woodDark, 0, 1.2, 0), ico(0.2, PALETTE.amber, 0, 2.7, 0)); }
export function rockingChair(): THREE.Group { return g_(box(1.8, 0.25, 1.8, PALETTE.wood, 0, 1.4, 0), box(1.8, 2.6, 0.25, PALETTE.wood, 0, 2.6, -0.8), cyl(0.12, 0.12, 2.8, PALETTE.woodDark, -0.8, 0.35, 0), cyl(0.12, 0.12, 2.8, PALETTE.woodDark, 0.8, 0.35, 0)); }
export function candlestick(d: Dims): THREE.Group { const h = d.h ?? 3.5; return g_(cyl(0.35, 0.5, 0.2, PALETTE.iron, 0, 0.1, 0), cyl(0.08, 0.08, h, PALETTE.iron, 0, h / 2, 0), box(0.3, 0.6, 0.3, PALETTE.bone, 0, h + 0.3, 0), ico(0.12, PALETTE.amber, 0, h + 0.75, 0)); }
export function bierCoffin(): THREE.Group { return g_(box(7, 2.2, 3, PALETTE.stoneDeep, 0, 1.1, 0), box(6.2, 1.4, 2.2, PALETTE.woodDark, 0, 2.9, 0)); }
export function stoneSlab(d: Dims): THREE.Group { const s = box(4.6, 6.4, 0.5, PALETTE.stone, 0, 3.2, 0); if (d.leaning) { s.rotation.x = -0.18; s.position.z = 0.6; } return g_(s); }
/** Timber brace across a 4-ft tunnel: two posts and a lintel. */
export function timberBrace(d: Dims): THREE.Group { const w = d.w ?? 4.6, h = d.h ?? 7; return g_(box(0.5, h, 0.5, PALETTE.woodDark, -w / 2, h / 2, 0), box(0.5, h, 0.5, PALETTE.woodDark, w / 2, h / 2, 0), box(w + 0.5, 0.5, 0.6, PALETTE.woodDark, 0, h, 0)); }
export function post(d: Dims): THREE.Group { const h = d.h ?? 8; return g_(box(0.8, h, 0.8, PALETTE.woodDark, 0, h / 2, 0), box(5, 0.6, 0.8, PALETTE.woodDark, 0, h - 0.3, 0)); }
/** Corner cobweb: a translucent pale triangle. */
export function cobweb(d: Dims): THREE.Group {
  const s = d.s ?? 3, y = d.y ?? 7;
  const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(s, 0), new THREE.Vector2(0, -s)]);
  const geo = new THREE.ShapeGeometry(shape); const m = new THREE.MeshBasicMaterial({ color: '#e8e4dc', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  const mesh = new THREE.Mesh(geo, m); mesh.position.y = y; mesh.rotation.y = Math.PI / 4;
  const g = g_(mesh); g.userData.role = 'marker';
  return g;
}
export function chains(d: Dims): THREE.Group { const y = d.y ?? 16, len = d.len ?? 8; const g = g_(); for (const x of [-1.2, 1.2]) { for (let i = 0; i < len * 2; i++) g.add(box(0.32, 0.5, 0.32, PALETTE.iron, x, y - i * 0.5, 0)); g.add(cyl(0.5, 0.5, 0.35, PALETTE.iron, x, y - len, 0, 10)); } return g; }
export function tapestry(d: Dims): THREE.Group { const w = d.w ?? 6; return g_(box(w, 0.2, 0.2, PALETTE.iron, 0, 8, 0), box(w - 0.2, 5, 0.15, '#5a2a30', 0, 5.4, 0.1), box(w - 1, 0.6, 0.12, PALETTE.amberDeep, 0, 4.2, 0.2), box(1.4, 0.8, 0.12, '#6b5d4a', -w / 4, 5.8, 0.2), box(1.4, 0.8, 0.12, '#6b5d4a', w / 4, 5.8, 0.2)); }
export function glassHanging(): THREE.Group { const g = g_(box(2.4, 3.2, 0.15, PALETTE.iron, 0, 6, 0)); const cs = [PALETTE.wine, PALETTE.amber, PALETTE.pine, '#3e5566']; for (let i = 0; i < 4; i++) g.add(box(0.95, 1.35, 0.1, cs[i], (i % 2 ? 0.55 : -0.55), i < 2 ? 6.75 : 5.25, 0.06)); return g; }
export function bench(d: Dims): THREE.Group { const l = d.l ?? 8; return g_(box(l, 0.3, 1.1, PALETTE.wood, 0, 1.5, 0), box(0.3, 1.4, 1, PALETTE.woodDark, -l / 2 + 0.5, 0.7, 0), box(0.3, 1.4, 1, PALETTE.woodDark, l / 2 - 0.5, 0.7, 0)); }
export function torchCrate(): THREE.Group { const g = g_(box(3, 1.8, 2.2, PALETTE.wood, 0, 0.9, 0)); for (let i = 0; i < 8; i++) g.add(boxr(0.2, 2.6, 0.2, PALETTE.woodDark, -1.1 + (i % 4) * 0.7, 2.2, -0.5 + Math.floor(i / 4), 0)); return g; }
export function doll(): THREE.Group { const g = g_(box(0.7, 0.9, 0.5, '#e8d36a', 0, 0.45, 0), ico(0.28, '#e9cdb0', 0, 1.1, 0)); return g; }
export function bones(): THREE.Group { const g = g_(); for (let i = 0; i < 7; i++) g.add(boxr(0.15, 0.15, 1.2 + (i % 3) * 0.5, PALETTE.bone, -1.5 + (i * 0.6), 0.1, -1 + (i % 4) * 0.5, i * 0.9)); g.add(ico(0.42, PALETTE.bone, 0.6, 0.35, 0.4)); return g; }
export function shackledSkeleton(): THREE.Group { const g = g_(box(1.4, 3, 0.5, PALETTE.bone, 0, 3.6, 0), ico(0.5, PALETTE.bone, 0, 5.6, 0), box(0.3, 2.6, 0.3, PALETTE.bone, -0.9, 3.4, 0), box(0.3, 2.6, 0.3, PALETTE.bone, 0.9, 3.4, 0), box(0.3, 2.4, 0.3, PALETTE.bone, -0.4, 1.2, 0), box(0.3, 2.4, 0.3, PALETTE.bone, 0.4, 1.2, 0)); for (const x of [-1.2, 1.2]) g.add(cyl(0.3, 0.3, 0.2, PALETTE.iron, x, 5, 0, 8), box(0.15, 1.4, 0.15, PALETTE.iron, x, 5.8, 0)); return g; }
export function strahdStatue(): THREE.Group {
  const g = g_(box(6, 1, 5, PALETTE.stoneDeep, 0, 0.5, 0));
  const figure = box(1.7, 5.4, 1.1, '#141218', -1.2, 3.7, 0); g.add(figure);
  const cloak = new THREE.Mesh(new THREE.ConeGeometry(1.5, 5.6, 6), mat('#0f0d12')); cloak.position.set(-1.2, 3.8, -0.3); cloak.scale.z = 0.6; g.add(cloak);
  g.add(ico(0.55, '#d8d3d0', -1.2, 6.9, 0), box(0.4, 1.8, 0.4, '#d8d3d0', -0.2, 4.6, 0.3), ico(0.42, '#8a8f9a', 0.1, 5.7, 0.5));
  const w = wolf({ scale: 0.9, stuffed: 1 }); w.position.set(1.4, 1, 0); w.rotation.y = Math.PI / 2; g.add(w);
  return g;
}
export function ghoulAltar(): THREE.Group {
  const g = g_(box(6, 3, 3, PALETTE.stoneDeep, 0, 1.5, 0), box(6.4, 0.4, 3.4, PALETTE.blood, 0, 3.2, 0));
  for (let i = 0; i < 4; i++) g.add(box(0.5, 1.2, 0.2, '#3d4247', -2.1 + i * 1.4, 1.6, 1.55), ico(0.22, '#3d4247', -2.1 + i * 1.4, 2.4, 1.6));
  return g;
}
export function planksCeiling(d: Dims): THREE.Group { const w = d.w ?? 5, dd = d.d ?? 5, y = d.y ?? 6; const g = g_(); for (let i = 0; i < 5; i++) g.add(box(w, 0.2, dd / 5 - 0.1, PALETTE.woodDark, 0, y, -dd / 2 + dd / 10 + i * (dd / 5))); return g; }
export function pitOpen(): THREE.Group { const g = g_(box(4.6, 0.1, 4.6, '#0a0908', 0, 0.02, 0)); for (let i = 0; i < 6; i++) g.add(new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.4, 5), mat(PALETTE.woodDark)).translateX(-1.6 + i * 0.65).translateY(-0.3).translateZ((i % 2) * 1.2 - 0.6)); return g; }
export function beds(): THREE.Group { return g_(box(3.5, 1.4, 6.5, PALETTE.woodDark, 0, 0.7, 0), box(3.1, 0.5, 6, '#d9cfb5', 0, 1.6, 0.2), box(3.5, 2.6, 0.4, PALETTE.woodDark, 0, 1.3, -3.2)); }
export function childBed(): THREE.Group { return g_(box(2.6, 1.2, 4.6, PALETTE.woodDark, 0, 0.6, 0), box(2.2, 0.4, 4.2, '#8fa3b8', 0, 1.4, 0.1)); }
export function smallSkeletons(): THREE.Group { const g = g_(); for (const [x, z, r] of [[-0.8, 0, 0.3], [0.8, 0.4, -0.5]]) { const s = box(0.8, 0.4, 2.6, PALETTE.bone, x, 0.2, z); s.rotation.y = r; g.add(s, ico(0.3, PALETTE.bone, x, 0.4, z - 1.4)); } g.add(box(0.5, 0.7, 0.4, '#b89a7a', 1.3, 0.35, 1.3)); return g; }
export function wineCask(): THREE.Group { return g_(cyl(0.6, 0.7, 1.4, PALETTE.wood, 0, 0.7, 0, 10), cyl(0.25, 0.25, 0.4, PALETTE.iron, 0, 1.2, 0.6, 6)); }
export function oilLamp(d: Dims): THREE.Group { const y = d.y ?? 6.5; return g_(box(0.3, 0.9, 0.3, PALETTE.iron, 0, y - 0.6, 0), box(0.6, 0.7, 0.6, PALETTE.amber, 0, y, 0), box(0.25, 0.8, 0.25, PALETTE.iron, 0, y + 0.7, 0)); }
export function dumbwaiterShaft(): THREE.Group { return g_(box(2, 6, 2, PALETTE.stoneDeep, 0, 3, 0), box(1.4, 1.2, 0.2, PALETTE.woodDark, 0, 3, 1.05), ico(0.15, PALETTE.amberDeep, 1.3, 4.5, 1.05)); }
export function crateChest(): THREE.Group { return g_(box(3.5, 1.6, 2, PALETTE.woodDark, 0, 0.8, 0), box(3.7, 0.3, 2.2, PALETTE.iron, 0, 1.7, 0), box(0.5, 0.6, 0.2, PALETTE.iron, 0, 1, 1.05)); }
export function clawChestSkeleton(): THREE.Group { const g = crateChest(); const lid = box(3.7, 0.3, 2.2, PALETTE.iron, 0, 2.4, -0.8); lid.rotation.x = -0.9; g.add(lid); for (const [x, z] of [[-1.5, -0.8], [1.5, -0.8], [-1.5, 0.8], [1.5, 0.8]]) g.add(ico(0.22, PALETTE.iron, x, 0.15, z)); g.add(box(0.9, 2.4, 0.6, PALETTE.bone, 0.6, 1.9, 0.2), ico(0.42, PALETTE.bone, 0.6, 3.3, 0.3), box(0.25, 1.8, 0.25, PALETTE.bone, -0.4, 2.6, 0.9)); return g; }
export function toyChestWindmills(): THREE.Group { const g = g_(box(2.6, 1.4, 1.6, PALETTE.wood, 0, 0.7, 0)); for (let i = 0; i < 2; i++) { const s = box(0.1, 0.7, 0.05, PALETTE.amber, -0.6 + i * 1.2, 0.7, 0.82); s.rotation.z = 0.78; g.add(s, box(0.7, 0.1, 0.05, PALETTE.amber, -0.6 + i * 1.2, 0.7, 0.82)); } return g; }
export function dollhouseReplica(): THREE.Group { return g_(box(2.2, 2.4, 1.4, '#7a6a5a', 0, 1.2, 0), box(2.4, 1, 1.6, '#3b2f47', 0, 2.9, 0), box(0.3, 0.5, 0.05, PALETTE.woodDark, 0, 0.3, 0.72), box(0.3, 0.3, 0.05, PALETTE.amber, -0.6, 1.4, 0.72), box(0.3, 0.3, 0.05, PALETTE.amber, 0.6, 1.4, 0.72)); }

function g_(...m: THREE.Object3D[]): THREE.Group { const grp = new THREE.Group(); if (m.length) grp.add(...m); return grp; }

Object.assign(PROPS_V1, {
  chandelier, drapes, 'shield-of-arms': shieldOfArms, portrait, 'stag-head': stagHead, 'stuffed-wolf': stuffedWolf, 'cloak-hooks': cloakHooks, shelves, 'barrel-spigot': barrelSpigot,
  tub, 'standing-mirror': standingMirror, 'four-poster-bed': fourPosterBed, nightstand, 'rocking-chair': rockingChair, candlestick, 'bier-coffin': bierCoffin, 'stone-slab': stoneSlab,
  'timber-brace': timberBrace, post, cobweb, chains, tapestry, 'glass-hanging': glassHanging, bench, 'torch-crate': torchCrate, doll, bones, 'shackled-skeleton': shackledSkeleton,
  'strahd-statue': strahdStatue, 'ghoul-altar': ghoulAltar, 'planks-ceiling': planksCeiling, 'pit-open': pitOpen, 'bed-plain': beds, 'child-bed': childBed, 'small-skeletons': smallSkeletons,
  'wine-cask': wineCask, 'oil-lamp': oilLamp, 'dumbwaiter-shaft': dumbwaiterShaft, 'crate-chest': crateChest, 'claw-chest-skeleton': clawChestSkeleton, 'toy-chest-windmills': toyChestWindmills,
  'dollhouse-replica': dollhouseReplica,
} as Record<string, (d: Dims) => THREE.Object3D>);

// ---------------------------------------------------------------- outdoor kit (M2)
export function pine(d: Dims): THREE.Group {
  const h = (d.h ?? 24) * (d.scale ?? 1), r = (d.r ?? 6) * (d.scale ?? 1);
  const g = g_(cyl(0.5, 0.7, h * 0.3, PALETTE.woodDark, 0, h * 0.15, 0, 6));
  for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(r * (1 - i * 0.28), h * 0.42, 7), mat(i % 2 ? PALETTE.pineDeep : PALETTE.pine)); c.position.y = h * 0.3 + i * h * 0.22 + h * 0.2; g.add(c); }
  return g;
}
export function bush(d: Dims): THREE.Group { const s = d.scale ?? 1; return g_(ico(2 * s, PALETTE.pineDeep, 0, 1.4 * s, 0), ico(1.4 * s, PALETTE.pine, 1.2 * s, 1 * s, 0.6 * s)); }
export function deadTree(d: Dims): THREE.Group {
  const s = d.scale ?? 1, g = g_(cyl(0.5 * s, 0.9 * s, 14 * s, '#3b3230', 0, 7 * s, 0, 6));
  for (let i = 0; i < 4; i++) { const b = box(0.35 * s, 6 * s, 0.35 * s, '#3b3230', 0, 12 * s, 0); b.rotation.z = (i - 1.5) * 0.7; b.rotation.y = i * 1.3; b.position.x = Math.cos(i * 1.3) * 2 * s; b.position.z = Math.sin(i * 1.3) * 2 * s; g.add(b); }
  return g;
}
export function boulder(d: Dims): THREE.Group { const r = d.r ?? 2.5; const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat(PALETTE.stoneDeep)); m.scale.y = 0.7; m.position.y = r * 0.5; return g_(m); }
export function gravestone(): THREE.Group { return g_(box(1.6, 2.6, 0.4, PALETTE.mist3, 0, 1.3, 0), box(0.6, 0.6, 0.42, PALETTE.mist3, 0, 2.8, 0)); }
export function fence(d: Dims): THREE.Group { const w = d.w ?? 10, g = g_(); for (let x = -w / 2; x <= w / 2; x += 4) g.add(box(0.4, 3.5, 0.4, PALETTE.woodDark, x, 1.75, 0)); g.add(box(w, 0.3, 0.2, PALETTE.wood, 0, 1.4, 0), box(w, 0.3, 0.2, PALETTE.wood, 0, 2.8, 0)); return g; }
export function water(d: Dims): THREE.Group { const m = box(d.w ?? 20, 0.2, d.d ?? 20, '#3e5566', 0, 0.05, 0); m.userData.role = 'floor'; return g_(m); }
export function tent(d: Dims): THREE.Group { const r = d.r ?? 5, h = d.h ?? 8; const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), mat(PALETTE.wine)); c.position.y = h / 2; return g_(c, cyl(0.15, 0.15, h + 1, PALETTE.woodDark, 0, (h + 1) / 2, 0)); }
export function wagon(d: Dims): THREE.Group {
  const g = g_(box(9, 2.5, 5, PALETTE.wood, 0, 3, 0), box(9.4, 0.4, 5.4, PALETTE.woodDark, 0, 1.8, 0));
  const top = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 8.6, 10, 1, false, 0, Math.PI), mat(d.color ? '#' + d.color.toString(16) : PALETTE.bone)); top.rotation.z = Math.PI / 2; top.position.y = 4.2; g.add(top);
  for (const [x, z] of [[-3, -2.8], [3, -2.8], [-3, 2.8], [3, 2.8]]) { const wh = cyl(1.2, 1.2, 0.4, PALETTE.woodDark, x, 1.2, z, 10); wh.rotation.x = Math.PI / 2; g.add(wh); }
  return g;
}
export function signpost(): THREE.Group { return g_(box(0.3, 8, 0.3, PALETTE.woodDark, 0, 4, 0), box(3, 0.8, 0.2, PALETTE.wood, 1.2, 6.5, 0), box(3, 0.8, 0.2, PALETTE.wood, -1.2, 5.4, 0)); }
export function brazier(): THREE.Group { return g_(cyl(1.2, 0.8, 0.5, PALETTE.iron, 0, 2.6, 0, 8), cyl(0.15, 0.15, 2.4, PALETTE.iron, 0, 1.2, 0), ico(0.6, PALETTE.amber, 0, 3.2, 0)); }
export function rubble(d: Dims): THREE.Group { const g = g_(); for (let i = 0; i < (d.n ?? 6); i++) g.add(ico(0.5 + (i % 3) * 0.3, PALETTE.stoneDeep, Math.cos(i * 2.1) * 1.6, 0.4, Math.sin(i * 2.1) * 1.6)); return g; }
export function rug(d: Dims): THREE.Group { return g_(box(d.w ?? 8, 0.08, d.d ?? 6, '#5a2a30', 0, 0.04, 0), box((d.w ?? 8) - 1, 0.09, (d.d ?? 6) - 1, '#7a3a40', 0, 0.045, 0)); }
/** Village house: plain block with a pitched roof; stories from dims. */
/** A Barovian house: timber frame over plaster, a steep gabled roof along the long side, shuttered windows,
 * a chimney. Tones vary per house (deterministically from its size) so a street never looks cloned. */
export function house(d: Dims): THREE.Group {
  const w = d.w ?? 20, dd = d.d ?? 20, h = (d.h ?? 10) * (d.stories ?? 1);
  const v = Math.abs(Math.sin(w * 12.9898 + dd * 78.233)) % 1;
  const plaster = ['#8f8676', '#7d7466', '#9a917f', '#6f675b'][Math.floor(v * 4)], beam = '#3a2c22';
  const roofC = ['#3d3a3e', '#4a3a33', '#35393a', '#51463c'][Math.floor(v * 7) % 4];
  const g = g_(box(w, h, dd, plaster, 0, h / 2, 0));
  // Timber frame: corner posts, sill and eave beams, a mid rail.
  for (const [x, z] of [[-w / 2, -dd / 2], [w / 2, -dd / 2], [-w / 2, dd / 2], [w / 2, dd / 2]]) g.add(box(0.8, h, 0.8, beam, x, h / 2, z));
  for (const y of [0.4, h * 0.55, h - 0.3]) { g.add(box(w + 0.2, 0.5, 0.3, beam, 0, y, dd / 2 + 0.05), box(w + 0.2, 0.5, 0.3, beam, 0, y, -dd / 2 - 0.05), box(0.3, 0.5, dd + 0.2, beam, w / 2 + 0.05, y, 0), box(0.3, 0.5, dd + 0.2, beam, -w / 2 - 0.05, y, 0)); }
  // Gabled roof along the long axis (prism), overhanging the walls.
  const long = w >= dd, L = (long ? w : dd) + 2, S = (long ? dd : w) + 2.4, rise = S * 0.62;
  const shape = new THREE.Shape([new THREE.Vector2(-S / 2, 0), new THREE.Vector2(S / 2, 0), new THREE.Vector2(0, rise)]);
  const prism = new THREE.ExtrudeGeometry(shape, { depth: L, bevelEnabled: false }); prism.translate(0, 0, -L / 2);
  const roof = new THREE.Mesh(prism, mat(roofC)); roof.position.y = h; if (long) roof.rotation.y = Math.PI / 2; g.add(roof);
  // Shuttered windows on the long faces, a door on the front.
  const faces = long ? [[0, dd / 2 + 0.2, 0], [0, -dd / 2 - 0.2, Math.PI]] : [[w / 2 + 0.2, 0, Math.PI / 2], [-w / 2 - 0.2, 0, -Math.PI / 2]];
  const span = long ? w : dd;
  for (const [fx, fz, ry] of faces) for (let i = -1; i <= 1; i += 2) {
    const win = box(2.6, 3, 0.25, '#2a2320', 0, h * 0.62, 0); const sh = box(1.2, 3.1, 0.3, '#4b3a2c', 1.35, h * 0.62, 0.05);
    const grp = g_(win, sh); grp.position.set(fx + (long ? i * span * 0.28 : 0), 0, fz + (long ? 0 : i * span * 0.28)); grp.rotation.y = ry as number; g.add(grp);
  }
  g.add(box(3, 6.5, 0.4, '#3b2a1e', 0, 3.25, dd / 2 + 0.25));
  // Chimney on the roof ridge.
  g.add(box(2.4, rise + 5, 2.4, '#4d4845', (long ? w * 0.28 : 0), h + (rise + 5) / 2, (long ? 0 : dd * 0.28)));
  return g;
}
export function churchBuilding(): THREE.Group {
  const g = g_(box(40, 16, 50, PALETTE.mist3, 0, 8, 0));
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 30, 8, 4), mat('#3b2f47')); roof.rotation.y = Math.PI / 4; roof.position.y = 20; roof.scale.set(1.2, 1, 1.5); g.add(roof);
  g.add(box(8, 30, 8, PALETTE.mist3, 0, 15, -18), box(0.6, 4, 0.6, PALETTE.iron, 0, 32, -18), box(2.4, 0.6, 0.6, PALETTE.iron, 0, 33, -18));
  return g;
}
export function gateArch(): THREE.Group { return g_(box(3, 14, 3, PALETTE.stoneDeep, -7, 7, 0), box(3, 14, 3, PALETTE.stoneDeep, 7, 7, 0), box(17, 2.5, 3, PALETTE.stoneDeep, 0, 14.5, 0)); }
Object.assign(PROPS_V1, { pine, bush, 'dead-tree': deadTree, boulder, gravestone, fence, water, tent, wagon, signpost, brazier, rubble, rug, house, 'church-building': churchBuilding, 'gate-arch': gateArch } as Record<string, (d: Dims) => THREE.Object3D>);

// ---------------------------------------------------------------- kit v3: module details (Death House pass)
/** Longsword mounted flat above a mantel; the hilt carries a small windmill cameo. */
export function wallSword(d: Dims): THREE.Group {
  const y = d.y ?? 7.5;
  return g_(box(4.2, 0.18, 0.12, PALETTE.mist0, 0.4, y, 0.2), box(0.2, 0.9, 0.2, PALETTE.amberDeep, -1.8, y, 0.2), box(1.0, 0.22, 0.22, PALETTE.woodDark, -2.4, y, 0.2), ico(0.2, PALETTE.amber, -2.95, y, 0.2),
    box(0.14, 0.6, 0.1, PALETTE.iron, -0.6, y + 0.1, 0.05), box(0.14, 0.6, 0.1, PALETTE.iron, 1.6, y + 0.1, 0.05));
}
/** Silver jewelry box with gold filigree, sized for a vanity top. */
export function jewelryBox(d: Dims): THREE.Group {
  const y = d.y ?? 3;
  return g_(box(0.9, 0.45, 0.6, '#b9bec6', 0, y + 0.22, 0), box(0.95, 0.08, 0.65, PALETTE.amber, 0, y + 0.48, 0), box(0.12, 0.12, 0.05, PALETTE.amber, 0, y + 0.3, 0.32));
}
/** Rotting tiger-skin rug: flat pelt, stripes, and a low head. */
export function tigerRug(): THREE.Group {
  const g = g_(box(5.5, 0.06, 3.4, '#a8682c', 0, 0.03, 0), box(1.6, 0.06, 5, '#a8682c', 0, 0.03, 0));
  for (let i = 0; i < 5; i++) g.add(box(0.28, 0.07, 3.0, '#3a2718', -2 + i * 0.95, 0.04, 0));
  g.add(box(1.1, 0.55, 1.0, '#a8682c', 3.2, 0.3, 0), box(0.5, 0.3, 0.6, '#e8dcc6', 3.8, 0.2, 0), ico(0.12, PALETTE.amber, 3.55, 0.6, 0.3), ico(0.12, PALETTE.amber, 3.55, 0.6, -0.3));
  return g;
}
/** Tightly wrapped, baby-sized bundle (empty) lying in the crib. */
export function swaddledBundle(d: Dims): THREE.Group {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.8, 3, 8), mat(PALETTE.bone)); m.rotation.z = Math.PI / 2; m.position.y = (d.y ?? 2.1) + 0.35;
  return g_(m);
}
/** Smoky-grey crystal orb held at hand height. */
export function crystalOrb(d: Dims): THREE.Group { return g_(ico(0.35, '#7d8290', 0, d.y ?? 4.6, 0)); }
/** Iron key lying on a desk top (the desk drawer's contents). */
export function deskKey(d: Dims): THREE.Group { const y = d.y ?? 3.05; return g_(box(0.9, 0.06, 0.1, PALETTE.iron, 0, y, 0), box(0.3, 0.06, 0.3, PALETTE.iron, -0.5, y, 0), box(0.12, 0.06, 0.25, PALETTE.iron, 0.4, y, 0.12)); }
/** Heavy, light and hand crossbows racked with bolts, seen through an opened cabinet. */
export function crossbowRack(): THREE.Group {
  const g = g_();
  for (let i = 0; i < 3; i++) { const s = 1.2 - i * 0.3; g.add(box(0.2, 0.2, 2.2 * s, PALETTE.woodDark, -0.8 + i * 0.8, 3 + i * 1.3, 0.2), box(1.8 * s, 0.12, 0.12, PALETTE.iron, -0.8 + i * 0.8, 3 + i * 1.3, 0.2 - s)); }
  for (let k = 0; k < 6; k++) g.add(box(0.05, 1.1, 0.05, PALETTE.bone, -1 + k * 0.4, 1.5, 0.5));
  return g;
}
/** Pantry stores: grain sacks, a small barrel and a hanging ham. */
export function sacks(): THREE.Group {
  const g = g_();
  for (const [x, z, s] of [[-0.8, 0, 1], [0.4, 0.2, 0.9], [-0.2, 0.9, 0.8]] as const) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8 * s, 1), mat('#9a8460')); m.scale.set(1, 1.3, 1); m.position.set(x, 0.9 * s, z); g.add(m); }
  g.add(cyl(0.6, 0.65, 1.5, PALETTE.wood, 1.6, 0.75, -0.2, 10), box(0.08, 1.2, 0.08, PALETTE.iron, 0.6, 7.2, -0.6), ico(0.55, '#8a4a38', 0.6, 6.4, -0.6));
  return g;
}
/** Cookware on an iron rail: pots and pans hanging over a worktable. */
export function hangingPots(d: Dims): THREE.Group {
  const w = d.w ?? 5, y = d.y ?? 7.4, g = g_(box(w, 0.12, 0.12, PALETTE.iron, 0, y, 0));
  for (let i = 0; i < 5; i++) { const x = -w / 2 + 0.5 + i * ((w - 1) / 4); g.add(box(0.05, 0.6, 0.05, PALETTE.iron, x, y - 0.3, 0), cyl(0.35 - (i % 2) * 0.1, 0.3, 0.35, i % 2 ? PALETTE.iron : PALETTE.amberDeep, x, y - 0.8, 0, 8)); }
  return g;
}
/** Tiny brass bell on a wall bracket, wired to the dumbwaiter buttons upstairs. */
export function brassBell(d: Dims): THREE.Group { const y = d.y ?? 5.5; return g_(box(0.5, 0.1, 0.4, PALETTE.woodDark, 0, y + 0.4, 0.1), cyl(0.05, 0.28, 0.35, PALETTE.amber, 0, y + 0.15, 0.3, 8), box(0.04, 1.6, 0.04, PALETTE.iron, 0.2, y + 1.2, 0.05)); }
/** Things set out on a table top: place settings, a jug and cups, or a bowl and jug. */
export function tabletop(d: Dims): THREE.Group {
  // set: 0 dinner service, 1 clay jug and flagons, 2 porcelain bowl and jug, 3 den (goblets, cask, pipe rack)
  const y = d.y ?? 3, set = d.set ?? 0, g = g_();
  const shine = set === 0 ? '#d7dbe2' : set === 1 ? '#8a5a3a' : '#e8e4dc';
  if (set === 0) {
    for (let i = 0; i < 8; i++) { const x = -3 + (i % 4) * 2, z = i < 4 ? -1.2 : 1.2; g.add(cyl(0.45, 0.45, 0.05, shine, x, y + 0.03, z, 12), cyl(0.12, 0.08, 0.5, '#cfe3ee', x + 0.55, y + 0.25, z * 0.8, 8), box(0.05, 0.03, 0.7, shine, x - 0.6, y + 0.03, z)); }
    g.add(cyl(0.3, 0.4, 1.1, shine, 0, y + 0.55, 0, 10), cyl(0.3, 0.4, 1.1, shine, 2, y + 0.55, 0, 10));
  } else {
    g.add(cyl(0.3, 0.4, 0.9, shine, -0.4, y + 0.45, 0, 10), box(0.1, 0.4, 0.3, shine, -0.05, y + 0.6, 0));
    if (set === 2) g.add(cyl(0.6, 0.35, 0.35, shine, 0.6, y + 0.18, 0.1, 12));
    else for (const [x, z] of [[0.5, -0.4], [0.6, 0.5]]) g.add(cyl(0.22, 0.18, 0.5, shine, x, y + 0.25, z, 8));
    if (set === 3) g.add(box(1, 0.2, 0.3, PALETTE.woodDark, 0.2, y + 0.1, -0.9), cyl(0.18, 0.14, 0.45, PALETTE.woodDark, 1.2, y + 0.22, 0.2, 8));
  }
  return g;
}
/** Rolling library ladder leaning against the shelves. */
export function rollingLadder(d: Dims): THREE.Group {
  const h = d.h ?? 10, g = g_();
  for (const x of [-0.7, 0.7]) { const r = box(0.15, h, 0.15, PALETTE.woodDark, x, h / 2, 0); r.rotation.x = -0.18; g.add(r); }
  for (let i = 1; i < h / 1.2; i++) { const r = box(1.4, 0.1, 0.12, PALETTE.wood, 0, i * 1.2, -0.21 * i * 1.2 * 0.9 + 0.8); g.add(r); }
  g.add(cyl(0.2, 0.2, 0.2, PALETTE.iron, -0.7, 0.1, 0.9, 8), cyl(0.2, 0.2, 0.2, PALETTE.iron, 0.7, 0.1, 0.9, 8));
  return g;
}
/** A window bricked up from inside. */
export function brickedWindow(): THREE.Group {
  const g = g_(box(4.4, 5, 0.35, '#5c3a30', 0, 5.5, 0));
  for (let r = 0; r < 6; r++) g.add(box(4.4, 0.06, 0.4, '#3a2620', 0, 3.2 + r * 0.85, 0));
  return g;
}
/** Old footprints pressed into an earthen floor. Flat decal, treated as floor. */
export function footprints(d: Dims): THREE.Group {
  const n = d.n ?? 10, len = d.len ?? 10, g = g_(); let seed = (d.seed ?? 1) * 9301;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const geo = new THREE.CircleGeometry(0.28, 8).rotateX(-Math.PI / 2); geo.scale(0.7, 1, 1.5);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, mat('#3b2c20'));
    const t = (i / n - 0.5) * len;
    m.position.set((i % 2 ? 0.35 : -0.35) + (rnd() - 0.5) * 0.8, 0.012, t + (rnd() - 0.5) * 0.5);
    m.rotation.y = (rnd() - 0.5) * 0.6 + (rnd() < 0.3 ? Math.PI : 0);
    m.userData.role = 'floor';
    g.add(m);
  }
  return g;
}
/** Sheet-draped storage shapes: chair, coat rack, standing mirror or dress mannequin. */
export function sheetedShape(d: Dims): THREE.Group {
  // shape: 0 chair, 1 coat rack, 2 standing mirror, 3 dress mannequin
  const shape = d.shape ?? 0, m = mat(PALETTE.mist1);
  if (shape === 1) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.9, 6, 7), m); c.position.y = 3; return g_(c, cyl(0.1, 0.1, 0.6, PALETTE.woodDark, 0, 6.2, 0)); }
  if (shape === 2) { const b = box(2.6, 6.4, 0.9, PALETTE.mist1, 0, 3.2, 0); return g_(b); }
  if (shape === 3) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.3, 4.6, 8), m); c.position.y = 2.3; const h = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), m); h.position.y = 5.1; return g_(c, h); }
  const s = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 0), m); s.scale.set(1, 1.2, 1); s.position.y = 1.8; return g_(s);
}
Object.assign(PROPS_V1, {
  'wall-sword': wallSword, 'jewelry-box': jewelryBox, 'tiger-rug': tigerRug, 'swaddled-bundle': swaddledBundle, 'crystal-orb': crystalOrb, 'desk-key': deskKey,
  'crossbow-rack': crossbowRack, sacks, 'hanging-pots': hangingPots, 'brass-bell': brassBell, tabletop, 'rolling-ladder': rollingLadder,
  'bricked-window': brickedWindow, footprints, 'sheeted-shape': sheetedShape,
} as Record<string, (d: Dims) => THREE.Object3D>);

// ---------------------------------------------------------------- kit v4: mapset pieces (runs, prisms, trunks)
/** A straight stair run from the origin along +x: `len` ft long, `w` wide, rising `rise` ft. Rotate with rotY. */
export function stairsRun(d: Dims): THREE.Group {
  const len = d.len ?? 10, w = d.w ?? 5, rise = d.rise ?? 10, steps = Math.max(2, Math.round(rise / 0.75));
  const g = g_();
  for (let i = 0; i < steps; i++) {
    const h = ((i + 1) / steps) * rise, x0 = (i / steps) * len, x1 = len;
    const m = box(x1 - x0, h, w, i % 2 ? PALETTE.wood : PALETTE.woodDark, (x0 + x1) / 2, h / 2, 0);
    m.userData.role = 'stairs';
    g.add(m);
  }
  return g;
}
/** A round timber post (structural) from the floor up `h` ft. */
export function postRound(d: Dims): THREE.Group { const r = d.r ?? 1, h = d.h ?? 10; return g_(cyl(r * 0.9, r, h, PALETTE.woodDark, 0, h / 2, 0, 10)); }
/** An oak: trunk of radius `r` and height `h`, a canopy when `canopy` > 0 (free-standing trees), a stub otherwise. */
export function oak(d: Dims): THREE.Group {
  const r = d.r ?? 1.25, h = d.h ?? 20, c = d.canopy ?? 0;
  const g = g_(cyl(r * 0.8, r * 1.15, h, '#4a3524', 0, h / 2, 0, 9));
  if (c > 0) {
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(c * (0.55 + (i % 2) * 0.2), 1), mat(i % 2 ? '#2f5a35' : '#3a6b3d')); m.position.set(Math.cos(i * 1.7) * c * 0.35, h * 0.92 + (i % 3) * c * 0.2, Math.sin(i * 1.7) * c * 0.35); g.add(m); }
  }
  return g;
}
Object.assign(PROPS_V1, { 'stairs-run': stairsRun, 'post-round': postRound, oak } as Record<string, (d: Dims) => THREE.Object3D>);
