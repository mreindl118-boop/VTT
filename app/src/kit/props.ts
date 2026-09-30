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
export function crib(): THREE.Group { return g(box(2.4, 2.2, 3.4, PALETTE.woodDark, 0, 1.1, 0), box(2.6, 2.6, 3.6, '#121016', 0, 3.6, 0)); }
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
