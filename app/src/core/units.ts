// Single source of truth for scale. See docs/UNITS.md.

/** Engine world unit is one foot. */
export const M_PER_FT = 0.3048;
export const FT_PER_M = 1 / M_PER_FT;
/** One grid cell. */
export const CELL_FT = 5;
/** Tabletop scale: one cell is one inch of table. */
export const FT_PER_TABLE_IN = CELL_FT;
export const FT_PER_MILE = 5280;
/** Regional overlay: one hex = 1/4 mile. */
export const REGIONAL_HEX_FT = FT_PER_MILE / 4;
export const DEFAULT_CEILING_FT = 10;

export const metersToFeet = (m: number) => m * FT_PER_M;
export const feetToMeters = (ft: number) => ft * M_PER_FT;
export const feetToCells = (ft: number) => ft / CELL_FT;
export const cellsToFeet = (cells: number) => cells * CELL_FT;

export type BookScaleFt = 5 | 10;
/** A book map square (5 or 10 ft) expressed in 5-ft cells along one axis. */
export function bookSquaresToCells(squares: number, bookScaleFt: BookScaleFt): number {
  return (squares * bookScaleFt) / CELL_FT;
}

export type CreatureSize = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';

export interface Footprint {
  /** PHB space, one side, in feet. */
  spaceFt: number;
  /** Cells occupied on a square grid (Tiny = 0.25). */
  squares: number;
  /** Hexes occupied on a hex grid (DMG). */
  hexes: number;
  /** Base ring diameter in inches of table. */
  baseIn: number;
}

export const FOOTPRINTS: Record<CreatureSize, Footprint> = {
  tiny: { spaceFt: 2.5, squares: 0.25, hexes: 0.25, baseIn: 0.5 },
  small: { spaceFt: 5, squares: 1, hexes: 1, baseIn: 1 },
  medium: { spaceFt: 5, squares: 1, hexes: 1, baseIn: 1 },
  large: { spaceFt: 10, squares: 4, hexes: 3, baseIn: 2 },
  huge: { spaceFt: 15, squares: 9, hexes: 7, baseIn: 3 },
  gargantuan: { spaceFt: 20, squares: 16, hexes: 12, baseIn: 4 },
};

/** Base ring diameter in world feet. */
export const baseRingFt = (size: CreatureSize) => FOOTPRINTS[size].baseIn * FT_PER_TABLE_IN;
