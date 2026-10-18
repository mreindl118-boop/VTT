// A place's detailed proxy: its map's own massing (manifests/world-massing.json, from scripts/world-massing.ts) drawn
// as one vertex-coloured mesh in the map's frame, so that from the road a town already has its walls, houses, lanes and
// woods, and Krezk its rock, before the map itself is built. The crossfade to the real map then changes detail, not
// shape. Trees are cones, houses a body and a gable roof in the house kit's own tones, long runs (palisades, fences,
// vine rows) and walls boxes, the ground the map's floor materials on a lattice, and every other big piece (landforms,
// towers, cottages, the church) its map's own kit. Colours lean toward the mist exactly as a ghost's do (ghost.ts), so
// a proxy and the ghost that fades in over it agree.
//
// Built in small steps (a generator: the stage spreads it over frames) when a place grows past a few dozen pixels on
// screen; at valley zoom every place keeps its plain massing (worldproxies.ts), which draws in one call for all.
import * as THREE from 'three';
import type { MassingSite } from '../../../scripts/world-massing';
import { FLOOR_COLOR, PALETTE, WALL_COLOR } from '../kit/palette';
import { segmentBox } from '../kit/pieces';
import { houseLook } from '../kit/props';
import { CREATURES } from '../kit/creatures';
import type { SceneObject } from '../core/schema';
import { buildSceneObject, hasKit } from './build';
import { disposeTree } from './dispose';

const unpack = (s: string): Int16Array => { if (!s) return new Int16Array(0); const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new Int16Array(u.buffer); };

/** Vertex buffers growing as pieces are added (positions and colours; normals are worked out per face). */
class Sink {
  p: number[] = []; c: number[] = [];
  private tint: (c: THREE.Color) => THREE.Color;
  private col = new THREE.Color();
  constructor(mist: THREE.Color, k: number) { this.tint = (c) => c.lerp(mist, k); }
  /** A geometry (any index), placed by `m`, all one colour (times its vertex colours, if any). */
  add(g: THREE.BufferGeometry, m: THREE.Matrix4 | null, color: THREE.Color | string): void {
    const pos = g.attributes.position, idx = g.index, vc = g.attributes.color as THREE.BufferAttribute | undefined, v = new THREE.Vector3();
    const base = typeof color === 'string' ? new THREE.Color(color) : color, n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i++) {
      const k = idx ? idx.getX(i) : i;
      v.fromBufferAttribute(pos, k); if (m) v.applyMatrix4(m);
      this.p.push(v.x, v.y, v.z);
      this.col.copy(base); if (vc) this.col.multiply(new THREE.Color(vc.getX(k), vc.getY(k), vc.getZ(k)));
      this.tint(this.col); this.c.push(this.col.r, this.col.g, this.col.b);
    }
  }
  /** One flat quad (x0..x1 × z0..z1 at height y), facing up. */
  quad(x0: number, z0: number, x1: number, z1: number, y: number, color: string): void {
    this.col.set(color); this.tint(this.col);
    this.p.push(x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0);
    for (let i = 0; i < 6; i++) this.c.push(this.col.r, this.col.g, this.col.b);
  }
  geometry(): THREE.BufferGeometry | null {
    if (!this.p.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeVertexNormals(); g.computeBoundingSphere();
    this.p = []; this.c = [];
    return g;
  }
}

/** A long run's look, read once from its kit (built ten feet long): which way it runs, how thick and high, its tone. */
type RunLook = { alongX: boolean; t: number; h: number; cx: number; cz: number; color: THREE.Color };
const runLooks = new Map<string, RunLook>();
function runLook(kind: string): RunLook {
  let r = runLooks.get(kind);
  if (r) return r;
  const o = buildSceneObject({ id: 'look', kind, pos: [0, 0, 0], vis: 'player', dims: { len: 10, w: 10 } } as SceneObject);
  o.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(o), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
  const sum = new THREE.Color(0, 0, 0); let area = 0;
  o.traverse((x) => {
    const m = x as THREE.Mesh; if (!m.isMesh) return;
    const mt = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshLambertMaterial; if (!mt?.color) return;
    const g = m.geometry, a = g.boundingSphere ?? (g.computeBoundingSphere(), g.boundingSphere); const w = (a?.radius ?? 1) ** 2;
    sum.r += mt.color.r * w; sum.g += mt.color.g * w; sum.b += mt.color.b * w; area += w;
  });
  disposeTree(o);
  const alongX = size.x >= size.z;
  // (where the run's middle is across it, relative to its position: a palisade stands on one side of its line)
  r = { alongX, t: Math.max(0.3, Math.min(size.x, size.z)), h: size.y || 4, cx: alongX ? 0 : mid.x, cz: alongX ? mid.z : 0, color: area ? sum.multiplyScalar(1 / area) : new THREE.Color(PALETTE.wood) };
  runLooks.set(kind, r);
  return r;
}

/** Build a place's detailed proxy in steps; the geometry is in the map's own frame (scene feet). */
export function* buildDetail(site: MassingSite, lineKinds: readonly string[], wallMaterials: string[], mist: THREE.Color, tint: number): Generator<void, THREE.BufferGeometry | null> {
  const out = new Sink(mist, tint), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  const place = (x: number, y: number, z: number, rotDeg: number) => m.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(up, (rotDeg * Math.PI) / 180), one);
  // the ground: the map's floor materials, a run of cells at a time
  for (const f of site.floors) {
    for (let j = 0; j < f.rows.length; j++) {
      const row = f.rows[j]; let i = 0;
      for (const [, n, ch] of row.matchAll(/(\d*)([a-z.])/g)) {
        const k = n ? Number(n) : 1;
        if (ch !== '.') { const cls = site.cls[ch.charCodeAt(0) - 97]; out.quad(f.x0 + i * f.cell, f.z0 + j * f.cell, f.x0 + (i + k) * f.cell, f.z0 + (j + 1) * f.cell, f.y + 0.03, FLOOR_COLOR[cls as keyof typeof FLOOR_COLOR] ?? FLOOR_COLOR.dirt); }
        i += k;
      }
    }
    yield;
  }
  // trees: a pine's tiers as one cone, an oak's crown as a ball on its trunk, a dead tree its bare trunk
  const T = unpack(site.trees), pineCone = new THREE.ConeGeometry(1, 1, 6, 1, true).translate(0, 0.5, 0), ball = new THREE.IcosahedronGeometry(1, 0), stick = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const pineC = new THREE.Color(PALETTE.pine).lerp(new THREE.Color(PALETTE.pineDeep), 0.5), oakC = new THREE.Color('#34603a'), barkC = new THREE.Color('#4a3524'), deadC = new THREE.Color('#3b3230');
  for (let i = 0; i + 5 < T.length; i += 6) {
    const type = T[i], x = T[i + 1] / 2, z = T[i + 2] / 2, y = T[i + 3] / 2, a = T[i + 4] / 10, b = T[i + 5] / 10;
    if (type === 0) { m.makeScale(b * 1.05, a * 0.88, b * 1.05).setPosition(x, y + a * 0.22, z); out.add(pineCone, m, pineC); }
    else if (type === 1) {
      m.makeScale(1.6, a, 1.6).setPosition(x, y, z); out.add(stick, m, barkC);
      if (b > 0) { m.makeScale(b * 0.8, b * 0.62, b * 0.8).setPosition(x, y + a * 0.9 + b * 0.2, z); out.add(ball, m, oakC); }
    } else { const s = a / 10; m.makeScale(0.9 * s, 15 * s, 0.9 * s).setPosition(x, y, z); out.add(stick, m, deadC); }
    if (i % 1200 === 0) yield;
  }
  pineCone.dispose(); ball.dispose();
  yield;
  // houses: the body (a stone ground floor and a jettied upper one where the kit has them) and the gable roof
  const H = unpack(site.houses), body = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const roofOf = new Map<string, THREE.BufferGeometry>();
  for (let i = 0; i + 7 < H.length; i += 8) {
    const x = H[i] / 2, z = H[i + 1] / 2, y = H[i + 2] / 2, L = houseLook({ w: H[i + 3] / 2, d: H[i + 4] / 2, h: H[i + 5] / 2, stories: H[i + 6] }), rot = H[i + 7];
    const at = place(x, y, z, rot).clone(), part = new THREE.Matrix4();
    if (L.stoneBase) {
      out.add(body, part.makeScale(L.w, L.sh, L.dd).premultiply(at), L.stone);
      out.add(body, part.makeScale(L.w + L.jet * 2, L.h - L.sh, L.dd + L.jet * 2).setPosition(0, L.sh, 0).premultiply(at), L.plaster);
    } else out.add(body, part.makeScale(L.w, L.h, L.dd).premultiply(at), L.plaster);
    const key = `${L.S.toFixed(1)}:${L.L.toFixed(1)}`;
    let roof = roofOf.get(key);
    if (!roof) {
      const shape = new THREE.Shape([new THREE.Vector2(-L.S / 2, 0), new THREE.Vector2(L.S / 2, 0), new THREE.Vector2(0, L.rise)]);
      roof = new THREE.ExtrudeGeometry(shape, { depth: L.L, bevelEnabled: false }).translate(0, 0, -L.L / 2); roofOf.set(key, roof);
    }
    out.add(roof, part.makeRotationY(L.long ? Math.PI / 2 : 0).setPosition(0, L.h, 0).premultiply(at), L.roofC);
    if (i % 800 === 0) yield;
  }
  for (const r of roofOf.values()) r.dispose();
  yield;
  // long runs: a box along the run in the kit's own thickness and tone
  const R = unpack(site.lines);
  for (let i = 0; i + 6 < R.length; i += 7) {
    const kind = lineKinds[R[i]], look = runLook(kind), len = R[i + 4] / 2, h = R[i + 5] / 2 || look.h;
    const at = place(R[i + 1] / 2, R[i + 3] / 2, R[i + 2] / 2, R[i + 6]);
    out.add(body, new THREE.Matrix4().makeScale(look.alongX ? len : look.t, h, look.alongX ? look.t : len).setPosition(look.cx, 0, look.cz).premultiply(at), look.color);
    if (i % 1400 === 0) yield;
  }
  yield;
  // walls: boxes up to the ghost's cut
  const W = unpack(site.walls);
  for (let i = 0; i + 6 < W.length; i += 7) {
    const g = segmentBox([W[i] / 2, W[i + 1] / 2], [W[i + 2] / 2, W[i + 3] / 2], W[i + 4] / 2, W[i + 5] / 2);
    out.add(g, null, WALL_COLOR[wallMaterials[W[i + 6]] as keyof typeof WALL_COLOR] ?? WALL_COLOR.ashlar); g.dispose();
    if (i % 700 === 0) yield;
  }
  body.dispose(); stick.dispose();
  // every other big piece: the map's own kit (opaque surfaces only: mist and glass are left out)
  for (const [kind, x, y, z, rot, dims, polygon] of site.kits) {
    yield;
    if (CREATURES[kind] || !hasKit(kind)) continue;
    const o = buildSceneObject({ id: 'proxy', kind, pos: [x, 0, z], rotY: rot, vis: 'player', dims: dims ?? undefined, polygon: polygon ?? undefined } as SceneObject);
    const planned = kind === 'stairs-straight' || (kind === 'prism' && !!polygon);
    if (planned) o.position.set(0, y, 0); else { o.position.set(x, y, z); o.rotation.y = (rot * Math.PI) / 180; }
    o.updateMatrixWorld(true);
    o.traverse((c) => {
      const mesh = c as THREE.Mesh; if (!mesh.isMesh || !mesh.visible) return;
      for (let p = c.parent; p; p = p.parent) if (!p.visible) return;
      const mt = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshLambertMaterial | undefined;
      if (!mt || (mt.transparent && mt.opacity < 0.95) || !mt.color) return;
      out.add(mesh.geometry, mesh.matrixWorld, mt.color);
    });
    disposeTree(o);
  }
  return out.geometry();
}
