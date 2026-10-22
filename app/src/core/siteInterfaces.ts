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
  /** A landmark drawn whole when it stands beside the active map as its neighbour (render/ghost.ts ghostCutFt): not cut
   *  at its ground floor's ceiling as a stacked map's ghost is, so Castle Ravenloft looms across its chasm from the
   *  Gates (owner 2026-10-22). */
  whole?: boolean;
}> = {
  'ch09/T': {
    // The bridge's two abutments remain on the z=135 and z=205 lips. The narrow
    // cross-section descends to the Luna, 500 ft below; ends blend into the valley.
    cuts: [{ bounds: { minX: -1600, maxX: 1800, minZ: 135, maxZ: 205 }, floor: -502, featherX: 500, featherZ: 12 }],
    roads: [{ road: 'Tsolenka road', x: 227.5, z: 497.5 }, { road: 'Tsolenka road', x: 225, z: 47.5 }],
  },
  'ch02/G': { lake: 'Tser Pool', roads: [{ road: 'Tser camp path', x: 0, z: 135 }] },
  'ch13/X': { excavate: true, roads: [{ road: 'Tsolenka road', x: 100.5, z: 460 }] },
  // The chasm before the castle's gate (castle-ravenloft.py, the 'chasm' prop: 50 ft across the road, from the castle's
  // north face south past its corner the length of the Gates' lip, its faces drawn 400 ft down): the land flattened round
  // the castle falls away there under the drawbridge, a sheer cut with no feather. The larders and the dungeon stand in
  // the mist, not under the land. Beside the Gates the castle is drawn whole, looming across the chasm.
  'ch04/K': { underground: true, whole: true, cuts: [{ bounds: { minX: -60, maxX: -10, minZ: 0, maxZ: 395 }, floor: -400, featherX: 0, featherZ: 0 }] },
  // The Gates of Ravenloft end on the near lip of that chasm, their sill under the drawbridge's free end (J's pin:
  // barovia-world.py TIES). The same cut in J's own feet (J's lip at x 400; the castle's frame is J's less 460 ft east
  // and 5 ft south), so J's apron is laid with the chasm's lips as its own edges and drops sheer there too, not in a
  // slope across the cut from J's edge. The valley's Road to Ravenloft meets J's own road where it leaves the map's north
  // edge (wild_j.py's dirt track, x 30-48), at this exit; the castle's only way in is the drawbridge from here (0.3.4's
  // road still runs on to the castle's pin: its last mile and climb are framework release 7's, owner 2026-10-22).
  'ch02/J': { cuts: [{ bounds: { minX: 400, maxX: 450, minZ: 5, maxZ: 400 }, floor: -400, featherX: 0, featherZ: 0 }], roads: [{ road: 'Road to Ravenloft', x: 40, z: 0 }] },
};

/** These are distant scenery substitutes, not the miniature inside the Amber Temple.
 * The continuous world already owns the real Castle Ravenloft at K, and its chasm before the gate: the Gates of
 * Ravenloft's own chasm and the chasm's walls round their ledge stand in for it only where the continuous world is off.
 * The other way round, the castle's stand-in of the Gates' sill and the road's ridge west of its chasm (the Gates' map
 * lies there in the valley). */
export const WORLD_STANDINS = new Set(['j-castle-mass', 'm-castle-glimpse', 'j-chasm-standin', 'j-chasm-shaft', 'j-ridge-standin']);
