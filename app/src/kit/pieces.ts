// Procedural low-poly kit, in feet. Everything returns meshes using palette materials.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Polygon, Vec2 } from '../core/geometry';
import { mat } from '../render/materials';
import { PALETTE } from './palette';

export const WALL_T = 1;

/** Horizontal slab from a plan polygon, top face at y = top. */
export function slabGeometry(poly: Polygon, top: number, thickness = 1): THREE.BufferGeometry {
  const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, top - thickness, 0);
  return g;
}

/** Flat polygon in XZ (single-sided, facing up). */
export function planeGeometry(poly: Polygon, y: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

/** Box between two plan points, from y0 to y1, extended half a thickness at both ends to close corners. */
export function segmentBox(a: Vec2, b: Vec2, y0: number, y1: number, t = WALL_T, extend = true): THREE.BufferGeometry {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const len = Math.hypot(dx, dz) + (extend ? t : 0);
  const g = new THREE.BoxGeometry(len, y1 - y0, t);
  g.rotateY(Math.atan2(-dz, dx));
  g.translate((a[0] + b[0]) / 2, (y0 + y1) / 2, (a[1] + b[1]) / 2);
  return g;
}

export function merge(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const ni = geoms.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of ni) { for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); }
  return mergeGeometries(ni)!;
}

function mesh(g: THREE.BufferGeometry, color: string): THREE.Mesh { return new THREE.Mesh(g, mat(color)); }

// ---------------------------------------------------------------- props (origin at floor centre)
function group(...m: THREE.Object3D[]): THREE.Group { const g = new THREE.Group(); g.add(...m); return g; }
function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T { o.position.set(x, y, z); return o; }

export function table(): THREE.Group {
  const top = at(mesh(new THREE.BoxGeometry(8, 0.4, 4), PALETTE.wood), 0, 2.8, 0);
  const legs = [[-3.5, -1.5], [3.5, -1.5], [-3.5, 1.5], [3.5, 1.5]].map(([x, z]) => at(mesh(new THREE.BoxGeometry(0.4, 2.6, 0.4), PALETTE.woodDark), x, 1.3, z));
  return group(top, ...legs);
}
export function column(): THREE.Group {
  return group(
    at(mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.6, 8), PALETTE.stoneDeep), 0, 0.3, 0),
    at(mesh(new THREE.CylinderGeometry(0.9, 1, 9, 8), PALETTE.stone), 0, 5, 0),
    at(mesh(new THREE.BoxGeometry(2.4, 0.6, 2.4), PALETTE.stoneDeep), 0, 9.7, 0),
  );
}
export function chest(): THREE.Group {
  return group(at(mesh(new THREE.BoxGeometry(3, 1.8, 2), PALETTE.woodDark), 0, 0.9, 0), at(mesh(new THREE.CylinderGeometry(1, 1, 3, 6, 1, false, 0, Math.PI), PALETTE.wood).rotateZ(Math.PI / 2), 0, 1.8, 0));
}
export function bed(): THREE.Group {
  return group(at(mesh(new THREE.BoxGeometry(4, 1.6, 7), PALETTE.woodDark), 0, 0.8, 0), at(mesh(new THREE.BoxGeometry(3.6, 0.6, 6.4), PALETTE.bone), 0, 1.9, 0.2), at(mesh(new THREE.BoxGeometry(4, 3.5, 0.5), PALETTE.woodDark), 0, 1.75, -3.4));
}
export function coffin(): THREE.Group {
  const shape = new THREE.Shape([new THREE.Vector2(-0.8, -3), new THREE.Vector2(0.8, -3), new THREE.Vector2(1.2, 1.4), new THREE.Vector2(0.9, 3), new THREE.Vector2(-0.9, 3), new THREE.Vector2(-1.2, 1.4)]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 1.5, bevelEnabled: false }); g.rotateX(-Math.PI / 2);
  return group(mesh(g, PALETTE.woodDark));
}
export function pressurePlate(w = 5, d = 5): THREE.Group {
  return group(at(mesh(new THREE.BoxGeometry(w - 0.6, 0.15, d - 0.6), PALETTE.wine), 0, 0.08, 0));
}
/** Straight stair: dims.w wide, climbing from z=fromZ to z=toZ (plan), rising `rise` ft, 1 step per ~0.75 ft. */
export function stairsStraight(dims: Record<string, number>, origin: Vec2): { mesh: THREE.Mesh; treadLabels: { pos: THREE.Vector3; text: string }[] } {
  const { w = 5, rise = 10, fromZ = 0, toZ = 10 } = dims;
  const run = Math.abs(toZ - fromZ), dir = Math.sign(toZ - fromZ);
  const steps = Math.max(2, Math.round(rise / 0.75));
  const gs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < steps; i++) {
    const h = ((i + 1) / steps) * rise;
    const z0 = fromZ + dir * (i / steps) * run, z1 = fromZ + dir * run;
    const g = new THREE.BoxGeometry(w, h, Math.abs(z1 - z0));
    g.translate(origin[0], h / 2, (z0 + z1) / 2);
    gs.push(g);
  }
  const labels = [];
  for (let e = 5; e < rise; e += 5) labels.push({ pos: new THREE.Vector3(origin[0], e + 0.3, fromZ + dir * (e / rise) * run), text: `+${e} ft` });
  labels.push({ pos: new THREE.Vector3(origin[0], rise + 0.3, toZ), text: `+${rise} ft` });
  return { mesh: mesh(merge(gs), PALETTE.stoneDeep), treadLabels: labels };
}

/** Low-poly pawn standing in for a character until M8 models exist. */
export function pawn(color: string, baseFt: number): THREE.Group {
  const s = baseFt / 5;
  const body = at(mesh(new THREE.CylinderGeometry(0.9 * s, 1.5 * s, 3.4 * s, 7), color), 0, 0.3 + 1.7 * s, 0);
  const head = at(mesh(new THREE.IcosahedronGeometry(0.95 * s, 0), color), 0, 0.3 + 4.1 * s, 0);
  return group(body, head);
}
export function baseRing(baseFt: number, color: string): THREE.Mesh {
  const r = baseFt / 2;
  const g = new THREE.CylinderGeometry(r * 0.95, r, 0.3, 24);
  g.translate(0, 0.15, 0);
  return mesh(g, color);
}

export const PROP_BUILDERS: Record<string, () => THREE.Object3D> = { table, column, chest, bed, coffin, 'pressure-plate': () => pressurePlate() };
