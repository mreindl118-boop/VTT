// Fire-Emblem-style range overlay: green squares the combatant can move to, red squares it could strike
// after moving, a paler red for ranged reach. Flat tinted quads just above the floor, never picked.
import * as THREE from 'three';
import type { RangeResult } from '../core/range';
import { CELL_FT } from '../core/units';

const COLORS = { move: '#3fbf6f', strike: '#d9453b', ranged: '#c96a5a' } as const;

function quads(cells: [number, number][], y: number, inset: number): THREE.BufferGeometry {
  const pos: number[] = [], idx: number[] = [];
  const h = CELL_FT / 2 - inset;
  cells.forEach(([x, z], n) => {
    pos.push(x - h, y, z - h, x + h, y, z - h, x + h, y, z + h, x - h, y, z + h);
    const b = n * 4; idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

export function buildRangeOverlay(r: RangeResult, elevationFt: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'range-overlay';
  const y = elevationFt + 0.07;
  const layer = (cells: [number, number][], color: string, opacity: number, order: number) => {
    if (!cells.length) return;
    const m = new THREE.Mesh(quads(cells, y, 0.35), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, fog: false }));
    m.renderOrder = order; m.userData.role = 'marker';
    g.add(m);
  };
  layer(r.ranged, COLORS.ranged, 0.28, 2);
  layer(r.strike, COLORS.strike, 0.42, 3);
  layer(r.move.map((m) => m.cell), COLORS.move, 0.45, 4);
  g.traverse((c) => { c.userData.role = 'marker'; });
  return g;
}
