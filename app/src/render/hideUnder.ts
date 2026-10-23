// Hiding a parent map's massing under an open child (the continuous world, step 4: nesting). A building, an area map
// or a dungeon drawn in place inside its town stands where the town's own model of it stands (its house, its yard,
// its trees), so while the child is drawn whole that model goes: buildContext's `inside` test, turned round.
//
//  - Objects that stand alone (a door that opens, a lit lamp post, a prism): left out of the frame by their layers (not
//    `visible`, which the slider, the section and the ghosts own).
//  - Merged meshes (`scatter`, `merged-roofs`: kit merge() output, NOT indexed, with `userData.ranges` naming each
//    object's run of faces): every face of an object inside collapses onto its first vertex (it draws nothing and a ray
//    misses it), the nine floats of each kept aside and put back exactly when the child goes.
//  - The parent's area-key labels inside: hidden by a class (the CSS2D renderer owns `display`).
// The parent's ground (its terrain slabs, its streets) stays: the child stands NEST_LIFT above it. A child bigger than
// its plot (the Blue Water Inn is three and a half times its plot) takes the neighbours inside its extent with it, the
// trade buildContext makes too; the atlas lists those blowouts.
import * as THREE from 'three';
import type { Bounds } from '../core/frames';
import type { Level, SceneFile } from '../core/schema';
import type { BuiltLevel, MergedRange } from './build';

/** What a parent map hid under one child, to put back. */
export interface NestMask {
  child: string;
  /** Faces collapsed: per mesh, the first face index of each run and the floats saved. */
  faces: { mesh: THREE.Mesh; runs: { start: number; saved: Float32Array }[] }[];
  objects: THREE.Object3D[];
  labels: HTMLElement[];
}

/** The plan point an object stands on (a shaped piece: the middle of its outline). */
function footing(o: Level['objects'][number]): [number, number] {
  const poly = o.polygon as [number, number][] | undefined;
  if (poly?.length) return [poly.reduce((a, p) => a + p[0], 0) / poly.length, poly.reduce((a, p) => a + p[1], 0) / poly.length];
  return [o.pos[0], o.pos[2]];
}
const within = (b: Bounds, [x, z]: [number, number]) => x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ;

/** Hide what a parent level shows inside an extent (the child's footprint in the parent's frame, already padded). */
export function hideUnder(parent: { scene: SceneFile; levels: Map<string, BuiltLevel>; labels: { obj: { element: HTMLElement }; spec: { kind: string; pos: THREE.Vector3 }; level: string }[] }, levelId: string, extent: Bounds, child: string): NestMask {
  const mask: NestMask = { child, faces: [], objects: [], labels: [] };
  const level = parent.scene.levels.find((l) => l.id === levelId), built = parent.levels.get(levelId);
  if (!level || !built) return mask;
  const inside = new Set(level.objects.filter((o) => within(extent, footing(o))).map((o) => o.id));
  built.root.traverse((o) => {
    const m = o as THREE.Mesh, ranges = m.userData.ranges as MergedRange[] | undefined;
    if (m.isMesh && ranges && !m.geometry.index) {
      const pos = m.geometry.attributes.position as THREE.BufferAttribute, a = pos.array as Float32Array, runs: NestMask['faces'][number]['runs'] = [];
      for (const r of ranges) {
        if (!inside.has(r.id)) continue;
        const s = r.start * 9, e = r.end * 9;
        runs.push({ start: r.start, saved: a.slice(s, e) });
        for (let i = s; i < e; i += 3) { a[i] = a[s]; a[i + 1] = a[s + 1]; a[i + 2] = a[s + 2]; }
      }
      if (runs.length) {
        mask.faces.push({ mesh: m, runs });
        pos.clearUpdateRanges(); pos.needsUpdate = true;
        m.geometry.computeBoundingSphere();
      }
      return;
    }
    const id = o.userData.objectId as string | undefined;
    if (id && inside.has(id) && o.parent === built.root) { veil(o, 'nest', true); mask.objects.push(o); }
  });
  for (const l of parent.labels) {
    if (l.level !== levelId || l.spec.kind !== 'key' || !within(extent, [l.spec.pos.x, l.spec.pos.z])) continue;
    l.obj.element.classList.add('nest-hidden'); mask.labels.push(l.obj.element);
  }
  return mask;
}

/** Put back exactly what hideUnder hid. */
export function restoreUnder(mask: NestMask): void {
  for (const { mesh, runs } of mask.faces) {
    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute, a = pos.array as Float32Array;
    for (const r of runs) a.set(r.saved, r.start * 9);
    pos.clearUpdateRanges(); pos.needsUpdate = true;
    mesh.geometry.computeBoundingSphere();
  }
  for (const o of mask.objects) veil(o, 'nest', false);
  for (const el of mask.labels) el.classList.remove('nest-hidden');
  mask.faces = []; mask.objects = []; mask.labels = [];
}

/** Leave a subtree out of the frame for a reason (and bring it back once no reason is left), by its layers: the
 *  camera draws layer 0, and `visible` stays the slider's, the section's and the ghosts'. Lights left out light
 *  nothing (three.js gathers only the lights the camera's layers see). */
export function veil(root: THREE.Object3D, reason: string, on: boolean, skip?: THREE.Object3D): void {
  const walk = (o: THREE.Object3D) => {
    if (o === skip) return;
    const why = (o.userData.veiled ??= new Set<string>()) as Set<string>;
    if (on) why.add(reason); else why.delete(reason);
    if (why.size) o.layers.disable(0); else o.layers.enable(0);
    for (const c of o.children) walk(c);
  };
  walk(root);
}
