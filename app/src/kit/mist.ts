// The fog materials the wilderness sites share: a cached translucent, double-sided copy of a palette material per
// colour and opacity (`far` exempts it from the coverage fog, for mist drawn beyond the map). One cache for every site
// where each used to keep its own; the materials are the same in every parameter.
import * as THREE from 'three';
import { matClone } from '../render/materials';

const fogMats = new Map<string, THREE.MeshLambertMaterial>();
export function fogMat(color: string, opacity: number, far = false): THREE.MeshLambertMaterial {
  const k = color + opacity + far;
  let m = fogMats.get(k);
  if (!m) { m = matClone(color, far); m.transparent = true; m.opacity = opacity; m.depthWrite = false; m.side = THREE.DoubleSide; fogMats.set(k, m); }
  return m;
}

// An unlit veil. This is a raw MeshBasicMaterial, as the two sites that declared it built it: it skips the kit's fog,
// grain and cutaway, and is kept exactly so in this consolidation (to be routed through the kit in its own change).
const veils = new Map<string, THREE.MeshBasicMaterial>();
export function veil(color: string, opacity: number): THREE.MeshBasicMaterial {
  const k = color + opacity;
  let m = veils.get(k);
  if (!m) { m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }); veils.set(k, m); }
  return m;
}
