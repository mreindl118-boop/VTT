// Surfaces: what each palette colour is made of, so the shared shader can draw its grain in world space (stone
// courses, timber, cobbles, shingles, earth, grass). No textures, no UVs: merged meshes keep their surface, and a
// wall reads the same in every map. Patterns stay quiet and in the palette's own tones (see docs/STYLE.md).
import { FLOOR_COLOR, PALETTE, WALL_COLOR } from './palette';

export const SURF = {
  generic: 1, ashlar: 2, rubble: 3, plank: 4, wood: 5, plaster: 6, cobble: 7, flag: 8, dirt: 9, grass: 10, shingle: 11, brick: 12,
  thatch: 13, cloth: 14, metal: 15, rock: 16, water: 17, snow: 18, foliage: 19, bark: 20, log: 21, stone: 22, none: 0,
} as const;
export type Surface = keyof typeof SURF;

const BY_COLOR = new Map<string, Surface>();
const norm = (c: string) => c.toLowerCase();
/** Declare what a colour is made of (later declarations win). */
export function surfaceFor(colors: string | string[], s: Surface): void { for (const c of Array.isArray(colors) ? colors : [colors]) BY_COLOR.set(norm(c), s); }
/** The surface a colour is made of; anything undeclared gets a quiet generic grain. */
export function surfaceOf(color: string): Surface { return BY_COLOR.get(norm(color)) ?? 'generic'; }

const FLOOR_SURF: Record<keyof typeof FLOOR_COLOR, Surface> = {
  flagstone: 'flag', plank: 'plank', dirt: 'dirt', cobble: 'cobble', grass: 'grass', snow: 'snow', ice: 'water', 'shallow-water': 'water', marsh: 'grass',
};
const WALL_SURF: Record<keyof typeof WALL_COLOR, Surface> = {
  ashlar: 'ashlar', rubble: 'rubble', 'half-timber': 'plaster', log: 'log', 'cave-rock': 'rock', amber: 'generic', plaster: 'plaster',
  paneling: 'plank', 'paneling-dusty': 'plank', earth: 'dirt', brick: 'brick',
};
for (const [k, s] of Object.entries(WALL_SURF)) surfaceFor(WALL_COLOR[k as keyof typeof WALL_COLOR], s);
for (const [k, s] of Object.entries(FLOOR_SURF)) surfaceFor(FLOOR_COLOR[k as keyof typeof FLOOR_COLOR], s);
surfaceFor([PALETTE.wood, PALETTE.woodDark, '#3a2c22', '#3b2a1e', '#4b3a2c', '#6b4b30', '#3b2d22', '#8a5a3a', '#9a6a3a'], 'wood');
surfaceFor([PALETTE.stone, PALETTE.stoneDeep, PALETTE.mist3, PALETTE.mist2, '#6d6a66', '#7a766f', '#8a857c', '#4d4845'], 'stone');
surfaceFor([PALETTE.iron, '#2b2420'], 'metal');
surfaceFor([PALETTE.pine, PALETTE.pineDeep, '#2f5a35', '#3a6b3d'], 'foliage');
surfaceFor(['#4a3524', '#3b3230', '#4a3828', '#5a4632', '#3b2d24'], 'bark');
surfaceFor(['#a8956f', '#c9b893'], 'wood');
surfaceFor(['#34603a'], 'foliage');
// house walls (plaster over timber), roofs (shingle and slate), turf and the church's slate
surfaceFor(['#8f8676', '#7d7466', '#9a917f', '#6f675b'], 'plaster');
surfaceFor(['#3d3a44', '#3d3a3e', '#4a3a33', '#35393a', '#51463c', '#4a4550', PALETTE.violetDeep, '#2b292d'], 'shingle');
surfaceFor(['#4d5a3f'], 'grass');
surfaceFor(['#9a948a', '#8f8980'], 'ashlar');
surfaceFor([PALETTE.wine, PALETTE.blood, '#5a2a30', '#7a3a40', '#c9bfa6', '#a83a30', '#d9a63a', '#d9d2c2', PALETTE.bone, '#d9cfb5', '#8fa3b8'], 'cloth');
surfaceFor(['#c9b25a', '#8a7a4a', '#b89b52'], 'thatch');
surfaceFor(['#3e5566', '#1e2a33'], 'water');
// the backdrop: the Pillarstone and the mountains, Castle Ravenloft's stone and slate, snow on the high peaks
surfaceFor(['#45454d', '#47474f', '#4a4a52', '#44444c', '#3f3f47', '#4f5560'], 'rock');
surfaceFor(['#7a828b', '#6c737c', '#4b4f58'], 'ashlar');
surfaceFor(['#3a3340'], 'shingle');
surfaceFor(['#d9dde3'], 'snow');
surfaceFor(['#c9632e'], 'none');
surfaceFor(['#7a3030', '#2f4d3c', '#34405f', '#5a3352', '#b08a44', '#a04a3e', '#b89a54'], 'wood');   // the vardos' painted boards
surfaceFor(['#8a3a32', '#c9c2b2'], 'cloth');
surfaceFor(['#7a756c'], 'ashlar');

/** The campaign's grass: Barovia's damp, dark turf or the Sheep Chase's bright pasture. Map floors and the land beyond
 *  the map both read FLOOR_COLOR.grass, so they always agree. Call before a level is built. */
export const BAROVIAN_GRASS = FLOOR_COLOR.grass;
export function setGrass(color: string): void { FLOOR_COLOR.grass = color; surfaceFor(color, 'grass'); }
