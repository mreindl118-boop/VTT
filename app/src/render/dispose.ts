// Freeing what leaves the world. three.js keeps a mesh's buffers, a material's program and a texture's pixels on the
// GPU until they are disposed: removing an object from the scene frees nothing. Every map, backdrop, surroundings,
// range overlay and token figure that leaves goes through disposeTree.
//
// Some objects are shared by many maps (the palette materials of render/materials.ts `mat()`, the mist texture of
// the crags): markShared registers them and they are never disposed here (a registry, not a userData flag: a
// material's clone copies its userData, and a clone is the clone's own). A shared material disposed under a live map
// would be recompiled on its next use; a shared texture would be uploaded again.
import * as THREE from 'three';

const SHARED = new WeakSet<object>();
/** Mark a material, geometry or texture as shared by many maps: disposeTree leaves it alone. */
export function markShared<T extends object>(x: T): T { SHARED.add(x); return x; }
export const isShared = (x: object | null | undefined): boolean => !!x && SHARED.has(x);

/** What a disposeTree call freed (tests and the HUD read it). */
export interface Freed { geometries: number; materials: number; textures: number; labels: number }

/** Dispose one material (unless shared) and the textures it owns (unless shared). */
export function disposeMaterial(m: THREE.Material, freed?: Freed, seen = new Set<object>()): void {
  if (!m || seen.has(m) || isShared(m)) return;
  seen.add(m);
  for (const v of Object.values(m)) {
    const t = v as THREE.Texture | null;
    if (t && (t as THREE.Texture).isTexture && !seen.has(t) && !isShared(t)) { seen.add(t); t.dispose(); if (freed) freed.textures++; }
  }
  m.dispose(); if (freed) freed.materials++;
}

/** Take a subtree out of the world and free what it owns on the GPU and in the page: geometries, non-shared materials
 *  and their textures, and the page elements of its CSS labels. `extra` materials (a ghost's, the originals a ghost
 *  stands in for) are freed too. */
export function disposeTree(root: THREE.Object3D, extra: Iterable<THREE.Material> = []): Freed {
  const freed: Freed = { geometries: 0, materials: 0, textures: 0, labels: 0 }, seen = new Set<object>();
  root.removeFromParent();
  root.traverse((o) => {
    const el = (o as unknown as { element?: unknown }).element;
    if (el instanceof HTMLElement) { el.remove(); freed.labels++; }
    const m = o as THREE.Mesh;
    // a sprite's quad is three.js's own, shared by every sprite
    if (m.geometry && !(o as THREE.Sprite).isSprite && !seen.has(m.geometry) && !isShared(m.geometry)) { seen.add(m.geometry); m.geometry.dispose(); freed.geometries++; }
    if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
    const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
    for (const mt of mats) disposeMaterial(mt, freed, seen);
    const live = o.userData.liveMat as THREE.Material | THREE.Material[] | undefined; // a ghost's originals
    if (live) for (const mt of Array.isArray(live) ? live : [live]) disposeMaterial(mt, freed, seen);
  });
  for (const mt of extra) disposeMaterial(mt, freed, seen);
  return freed;
}
