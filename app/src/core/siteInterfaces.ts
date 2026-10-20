import type { Bounds } from './frames';

/** Survey ties in authored map feet. Pins and map placements do not move. These repair
 * the coarse regional tracing where it must meet a detailed map (CoS pp.36,158–159,183).
 * They are intentionally limited to the owner's continuity request. */
export interface GroundCut { bounds: Bounds; floor: number; featherX: number; featherZ: number }
export const SITE_INTERFACES: Record<string, {
  cuts?: GroundCut[];
  roads?: { road: string; x: number; z: number }[];
  lake?: string;
  excavate?: boolean;
  /** A root map with floors below its ground and no ground cut over them (Castle Ravenloft's larders and dungeon under
   *  the courtyard): while one of those floors is shown, the valley is left out of the frame and the mist floor lies
   *  under it, as a nested map's floor below its town does (app.ts syncUnderground). */
  underground?: boolean;
}> = {
  'ch09/T': {
    // The bridge's two abutments remain on the z=135 and z=205 lips. The narrow
    // cross-section descends to the Luna, 500 ft below; ends blend into the valley.
    cuts: [{ bounds: { minX: -1600, maxX: 1800, minZ: 135, maxZ: 205 }, floor: -502, featherX: 500, featherZ: 12 }],
    roads: [{ road: 'Tsolenka road', x: 227.5, z: 497.5 }, { road: 'Tsolenka road', x: 225, z: 47.5 }],
  },
  'ch02/G': { lake: 'Tser Pool', roads: [{ road: 'Tser camp path', x: 0, z: 135 }] },
  'ch13/X': { excavate: true, roads: [{ road: 'Tsolenka road', x: 100.5, z: 460 }] },
  // Castle Ravenloft: the larders and the dungeon stand in the mist, not under the land.
  'ch04/K': { underground: true },
};

/** These are distant scenery substitutes, not the miniature inside the Amber Temple.
 * The continuous world already owns the real Castle Ravenloft at K. */
export const WORLD_STANDINS = new Set(['j-castle-mass', 'm-castle-glimpse']);
