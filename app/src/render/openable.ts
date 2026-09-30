// Open/closed visuals for any kit piece, without touching its builder: a lid hinged at the back,
// a pair of doors hinged at the sides, or a drawer that slides out. Local frame: front faces +z.
import * as THREE from 'three';
import { mat } from './materials';

export interface OpenHandle { set(open: boolean): void }

const INSIDE = '#141116';

function bbox(root: THREE.Object3D): THREE.Box3 {
  const b = new THREE.Box3();
  root.updateMatrixWorld(true);
  root.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh) { m.geometry.computeBoundingBox(); b.union(m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld)); } });
  return b;
}
function colorOf(root: THREE.Object3D): string {
  let top: THREE.Mesh | undefined, y = -Infinity;
  root.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh) { const p = new THREE.Vector3(); m.getWorldPosition(p); if (p.y > y) { y = p.y; top = m; } } });
  const c = (top?.material as THREE.MeshLambertMaterial | undefined)?.color;
  return c ? '#' + c.getHexString() : '#5a4632';
}
const slab = (w: number, h: number, d: number, color: string) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));

export function makeOpenable(root: THREE.Object3D, mode: 'lid' | 'doors' | 'drawer', startOpen = false): OpenHandle {
  const b = bbox(root), w = b.max.x - b.min.x, d = b.max.z - b.min.z, h = b.max.y - b.min.y, cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
  const color = colorOf(root);
  let set: (open: boolean) => void;
  if (mode === 'lid') {
    // Dark inside shows on top when the lid is up; the lid hinges on the back edge.
    const inside = slab(w * 0.9, 0.02, d * 0.86, INSIDE); inside.position.set(cx, b.max.y + 0.01, cz); inside.visible = false;
    const hinge = new THREE.Group(); hinge.position.set(cx, b.max.y + 0.02, b.min.z);
    const lid = slab(w * 1.02, Math.max(0.08, Math.min(0.3, h * 0.12)), d * 1.02, color); lid.position.set(0, 0.06, d / 2);
    hinge.add(lid); root.add(inside, hinge); lid.visible = false; // closed: the builder's own top already reads as a lid
    set = (open) => { lid.visible = open; inside.visible = open; hinge.rotation.x = open ? -1.95 : 0; };
  } else if (mode === 'doors') {
    const inside = slab(w * 0.86, h * 0.86, 0.02, INSIDE); inside.position.set(cx, b.min.y + h / 2, b.max.z + 0.01); inside.visible = false;
    const doors = [-1, 1].map((side) => {
      const hinge = new THREE.Group(); hinge.position.set(cx + (side * w) / 2, b.min.y + h / 2, b.max.z + 0.05);
      const leaf = slab(w / 2, h * 0.92, 0.1, color); leaf.position.set((-side * w) / 4, 0, 0);
      hinge.add(leaf); hinge.visible = false; return hinge;
    });
    root.add(inside, ...doors);
    set = (open) => { inside.visible = open; doors.forEach((hg, i) => { hg.visible = open; hg.rotation.y = open ? (i ? 1 : -1) * 1.9 : 0; }); };
  } else {
    const dh = Math.min(0.6, h * 0.25);
    const drawer = new THREE.Group();
    const front = slab(w * 0.6, dh, 0.1, color); front.position.set(0, 0, d * 0.35);
    const tray = slab(w * 0.56, dh * 0.8, d * 0.7, INSIDE); tray.position.set(0, -dh * 0.05, 0);
    drawer.add(front, tray); drawer.position.set(cx, b.max.y - dh * 1.6, cz); drawer.visible = false;
    root.add(drawer);
    set = (open) => { drawer.visible = open; drawer.position.z = cz + (open ? d * 0.45 : 0); };
  }
  set(startOpen);
  return { set };
}
