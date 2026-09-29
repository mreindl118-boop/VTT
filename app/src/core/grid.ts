// Tactical grid math: squares and hexes, 5-ft cells. See docs/UNITS.md.
import { CELL_FT } from './units';
import type { Vec2 } from './geometry';

export type GridType = 'square' | 'hex';
export type HexOrientation = 'pointy' | 'flat';
export type DiagonalRule = 'five' | 'five-ten-five';

export interface Cell { i: number; j: number }

/** Square cell containing a world point (feet), relative to origin. */
export function squareCellAt(p: Vec2, origin: Vec2 = [0, 0], cell = CELL_FT): Cell {
  return { i: Math.floor((p[0] - origin[0]) / cell), j: Math.floor((p[1] - origin[1]) / cell) };
}
export function squareCellCenter(c: Cell, origin: Vec2 = [0, 0], cell = CELL_FT): Vec2 {
  return [origin[0] + (c.i + 0.5) * cell, origin[1] + (c.j + 0.5) * cell];
}

/** Movement cost in feet between two square cells. */
export function squareDistanceFt(a: Cell, b: Cell, rule: DiagonalRule = 'five', cell = CELL_FT): number {
  const dx = Math.abs(a.i - b.i), dz = Math.abs(a.j - b.j);
  const diag = Math.min(dx, dz), straight = Math.max(dx, dz) - diag;
  if (rule === 'five') return (diag + straight) * cell;
  // 5-10-5: every second diagonal costs 10 ft.
  return (straight + diag + Math.floor(diag / 2)) * cell;
}

// ---- Hexes (axial q,r). `size` = centre-to-corner. For 5-ft hexes, flat-to-flat = CELL_FT.
export interface Hex { q: number; r: number }

export const hexSizeFromWidth = (flatToFlat: number) => flatToFlat / Math.sqrt(3);

export function hexToWorld(h: Hex, size: number, orient: HexOrientation = 'pointy', origin: Vec2 = [0, 0]): Vec2 {
  if (orient === 'pointy') {
    return [origin[0] + size * Math.sqrt(3) * (h.q + h.r / 2), origin[1] + size * 1.5 * h.r];
  }
  return [origin[0] + size * 1.5 * h.q, origin[1] + size * Math.sqrt(3) * (h.r + h.q / 2)];
}

export function worldToHex(p: Vec2, size: number, orient: HexOrientation = 'pointy', origin: Vec2 = [0, 0]): Hex {
  const x = p[0] - origin[0], z = p[1] - origin[1];
  let q: number, r: number;
  if (orient === 'pointy') {
    q = ((Math.sqrt(3) / 3) * x - (1 / 3) * z) / size;
    r = ((2 / 3) * z) / size;
  } else {
    q = ((2 / 3) * x) / size;
    r = ((-1 / 3) * x + (Math.sqrt(3) / 3) * z) / size;
  }
  return hexRound(q, r);
}

export function hexRound(qf: number, rf: number): Hex {
  const sf = -qf - rf;
  let q = Math.round(qf), r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { q: q + 0, r: r + 0 };
}

export const hexSteps = (a: Hex, b: Hex) => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
export const hexDistanceFt = (a: Hex, b: Hex, cell = CELL_FT) => hexSteps(a, b) * cell;
