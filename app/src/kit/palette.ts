// The one palette. See docs/STYLE.md. Exported GLBs bake these into a 256x256 atlas.
export const PALETTE = {
  mist0: '#d9dadc', mist1: '#b4b6ba', mist2: '#8a8d93', mist3: '#5a5d63',
  violet: '#5b4a6b', violetDeep: '#3b2f47',
  pine: '#2f4a3a', pineDeep: '#1e3128',
  stone: '#6f7b86', stoneDeep: '#4b5560',
  amber: '#f2b35b', amberDeep: '#c9822e',
  wine: '#7a1f2b', blood: '#4d1119',
  bone: '#e8dfc8',
  wood: '#6b4a33', woodDark: '#4a3224', iron: '#3a3b40', dirt: '#5e4d3c',
  fog: '#16151a',
} as const;
export type PaletteKey = keyof typeof PALETTE;

import type { FloorMaterial, WallMaterial } from '../core/schema';

export const FLOOR_COLOR: Record<FloorMaterial, string> = {
  flagstone: '#595f66', plank: '#5a4332', dirt: '#4d4034', cobble: '#5f6167', grass: '#3d5241',
  snow: '#c9ccd2', ice: '#9fb3c2', 'shallow-water': '#3e5566', marsh: '#3f4636',
};
export const WALL_COLOR: Record<WallMaterial, string> = {
  ashlar: '#7c858e', rubble: '#6d6860', 'half-timber': '#8a7f6e', log: '#5d4636', 'cave-rock': '#5b5752', amber: '#c9822e', plaster: '#8f8a84',
};
