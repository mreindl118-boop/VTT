// The Mists of Barovia: shared fog materials + unified mist builder (`bank`, `wall`, `wisp`) and outdoor perimeter ring.
import * as THREE from 'three';
import { matClone, patchFog, setSurface } from '../render/materials';

export type MistMode = 'bank' | 'wall' | 'wisp';
export type D = Record<string, number> & { mode?: MistMode; c?: string };
function rng(seed = 1): () => number {
  let s = (Number(seed) || 1) | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fogMats = new Map<string, THREE.MeshLambertMaterial>();
export function fogMat(color: string, opacity = 0.95, far = true): THREE.MeshLambertMaterial {
  const o = Math.min(0.98, opacity);
  const k = color + ':' + o + ':' + far;
  let m = fogMats.get(k);
  if (!m) {
    m = matClone(color, far);
    m.transparent = true;
    m.opacity = o;
    m.depthWrite = false;
    m.side = THREE.DoubleSide;
    setSurface(m, 'none');
    (m.userData.mistDrift ??= { value: 1 }).value = 1;
    fogMats.set(k, m);
  }
  return m;
}

const veils = new Map<string, THREE.MeshLambertMaterial>();
export function veil(color: string, opacity = 0.5): THREE.MeshLambertMaterial {
  const o = Math.min(0.98, opacity);
  const k = color + ':' + o;
  let m = veils.get(k);
  if (!m) {
    m = matClone(color, true);
    m.transparent = true;
    m.opacity = o;
    m.depthWrite = false;
    m.side = THREE.DoubleSide;
    setSurface(m, 'none');
    (m.userData.mistDrift ??= { value: 1 }).value = 1;
    veils.set(k, m);
  }
  return m;
}

const vertMats = new Map<string, THREE.MeshLambertMaterial>();
export function mistVertMat(color = '#c4c2ca', opacity = 0.95): THREE.MeshLambertMaterial {
  const o = Math.min(0.98, opacity);
  const k = color + ':' + o;
  let m = vertMats.get(k);
  if (!m) {
    m = matClone(color, true);
    m.vertexColors = true;
    m.transparent = true;
    m.opacity = o;
    m.depthWrite = false;
    m.side = THREE.DoubleSide;
    setSurface(m, 'none');
    (m.userData.mistDrift ??= { value: 1 }).value = 1;
    vertMats.set(k, m);
  }
  return m;
}

function tagMistMesh(m: THREE.Mesh): THREE.Mesh {
  m.renderOrder = 2;
  m.userData.role = 'mist';
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}

/** Build a ribbon curtain of `NL` layered sheets with 4-component RGBA vertex colours that fade to 0 at foot & crest. */
function buildMistLayers(opts: {
  len: number;
  h: number;
  d: number;
  ext: number;
  layers: number;
  cols: number;
  axis: 0 | 1;
  peakAlpha: number;
  footY: number;
  color: string;
  opacity: number;
  seed: number;
}): THREE.Group {
  const { len, h, d, ext, layers, cols, axis, peakAlpha, footY, color, opacity, seed } = opts;
  const g = new THREE.Group();
  g.userData.role = 'mist';
  const R = rng(seed);
  const baseC = new THREE.Color(color);
  const darkC = baseC.clone().multiplyScalar(0.68);
  const crestC = baseC.clone().lerp(new THREE.Color('#d8d6de'), 0.35);
  const mt = mistVertMat('#ffffff', opacity);

  const spanA = -len * 0.5 - ext;
  const spanB = len * 0.5 + ext;
  const ROWS = 4;
  const rFrac = [0, 0.16, 0.44, 0.72, 1.0];
  const rAlpha = [0, 1.0, 0.82, 0.42, 0];

  for (let li = 0; li < layers; li++) {
    const lf = layers > 1 ? li / (layers - 1) : 0;
    const ph1 = R() * Math.PI * 2;
    const ph2 = R() * Math.PI * 2;
    const ph3 = R() * Math.PI * 2;
    const layerH = h * (0.58 + lf * 0.42);
    const layerPeak = peakAlpha * (li === 0 ? 0.55 : li === layers - 1 ? 0.65 : 0.9);
    const layerTint = darkC.clone().lerp(crestC, 0.25 + 0.65 * (1 - lf * 0.6));

    const verts: number[] = [];
    const cols4: number[] = [];

    const sampleAt = (ci: number, ri: number): [number, number, number, number, number, number, number] => {
      const u = ci / cols;
      const s = spanA + (spanB - spanA) * u;
      const edgeDist = Math.min(s - spanA, spanB - s);
      const endFade = ext > 0 ? Math.min(1, edgeDist / Math.max(1, ext * 0.85)) : Math.sin(u * Math.PI);
      const wave =
        Math.sin(u * Math.PI * 2.3 + ph1) * 0.5 +
        Math.sin(u * Math.PI * 5.1 + ph2) * 0.3 +
        Math.cos(u * Math.PI * 3.7 + ph3) * 0.2;
      const depthSway = wave * Math.min(35, d * 0.12) + Math.sin(ri * 1.2 + ph2) * Math.min(18, d * 0.06);
      const crestWave = 1 + 0.08 * Math.sin(u * Math.PI * 3.1 + ph1) + 0.05 * Math.cos(u * Math.PI * 6.3 + ph2);
      const y = ri === 0 ? footY : layerH * rFrac[ri] * (ri === ROWS ? crestWave : 1);
      const billow = 0.78 + 0.22 * Math.sin(u * Math.PI * 4.0 + ph3 + ri * 0.7);
      const a = ri === 0 || ri === ROWS ? 0 : Math.min(0.92, layerPeak * rAlpha[ri] * Math.max(0.18, endFade) * billow);
      const shade = 0.84 + 0.16 * (ri / ROWS) + 0.06 * wave;
      const cr = Math.min(1, layerTint.r * shade);
      const cg = Math.min(1, layerTint.g * shade);
      const cb = Math.min(1, layerTint.b * shade);

      if (axis === 1) {
        // Yester Hill fog-wall convention: span along Z, depth into -X, leaning inward near foot
        const xOff = -lf * d - (1 - rFrac[ri]) * Math.min(55, d * 0.08) + depthSway;
        return [xOff, y, s, cr, cg, cb, a];
      }
      // Standard X-span convention: span along X, depth across Z (-d/2 .. +d/2)
      const zOff = (lf - 0.5) * d + depthSway;
      return [s, y, zOff, cr, cg, cb, a];
    };

    const grid: [number, number, number, number, number, number, number][][] = [];
    for (let ri = 0; ri <= ROWS; ri++) {
      const row: [number, number, number, number, number, number, number][] = [];
      for (let ci = 0; ci <= cols; ci++) row.push(sampleAt(ci, ri));
      grid.push(row);
    }

    const emit = (p: [number, number, number, number, number, number, number]) => {
      verts.push(p[0], p[1], p[2]);
      cols4.push(p[3], p[4], p[5], p[6]);
    };

    for (let ri = 0; ri < ROWS; ri++) {
      for (let ci = 0; ci < cols; ci++) {
        const p00 = grid[ri][ci];
        const p10 = grid[ri][ci + 1];
        const p01 = grid[ri + 1][ci];
        const p11 = grid[ri + 1][ci + 1];
        emit(p00); emit(p10); emit(p11);
        emit(p00); emit(p11); emit(p01);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols4, 4));
    geo.computeVertexNormals();
    const mesh = tagMistMesh(new THREE.Mesh(geo, mt));
    g.add(mesh);
  }
  return g;
}

/** Ground-hugging mist bank (`mist-bank`, `mist` in bank mode). */
export function mistBank(d: D = {}): THREE.Group {
  const len = d.l ?? d.len ?? d.w ?? 90;
  const depth = d.d ?? (d.l !== undefined || d.len !== undefined ? (d.w ?? 28) : Math.max(24, len * 0.65));
  const h = d.h ?? 8;
  const layers = Math.min(5, Math.max(3, d.n ?? 4));
  const cols = Math.min(8, Math.max(5, Math.round(len / 90)));
  const ext = d.ext ?? Math.min(24, len * 0.12);
  const peakAlpha = Math.min(0.75, Math.max(0.28, (d.o ?? 0.36) * 1.25));
  return buildMistLayers({
    len,
    h,
    d: depth,
    ext,
    layers,
    cols,
    axis: 0,
    peakAlpha,
    footY: -0.6,
    color: typeof d.c === 'string' ? d.c : '#9a9ca4',
    opacity: d.o !== undefined ? Math.min(0.98, Math.max(0.65, d.o)) : 0.92,
    seed: d.seed ?? d.s ?? 17,
  });
}

/** Tall billowing wall of mist (`mist-wall`, `a-mist-wall`). Spans along local X (`-len/2..+len/2`). */
export function mistWall(d: D = {}): THREE.Group {
  const len = d.len ?? d.l ?? d.w ?? 180;
  const h = d.h ?? 38;
  const depth = d.d ?? Math.max(24, len * 0.15);
  const ext = d.ext ?? Math.min(60, len * 0.15);
  const span = len + ext * 2;
  const cols = Math.min(10, Math.max(6, Math.round(span / 380)));
  return buildMistLayers({
    len,
    h,
    d: depth,
    ext,
    layers: 7,
    cols,
    axis: d.axis === 1 ? 1 : 0,
    peakAlpha: Math.min(0.78, Math.max(0.38, d.o ?? 0.52)),
    footY: -1.5,
    color: typeof d.c === 'string' ? d.c : '#94909a',
    opacity: 0.95,
    seed: d.seed ?? d.s ?? 31,
  });
}

const fogWallCache = new Map<string, THREE.Group>();

/** The Yester Hill / Barovian border wall of fog (`fog-wall`). Spans along local Z (`-len/2..+len/2`), depth into -X. */
export function fogWall(d: D = {}): THREE.Group {
  const k = JSON.stringify(d);
  let proto = fogWallCache.get(k);
  if (!proto) {
    const len = d.len ?? 2600;
    const h = d.h ?? 900;
    const depth = d.d ?? 850;
    const ext = d.ext ?? Math.min(400, len * 0.25);
    const span = len + ext * 2;
    const cols = Math.min(10, Math.max(6, Math.round(span / 400)));
    proto = buildMistLayers({
      len,
      h,
      d: depth,
      ext,
      layers: 7,
      cols,
      axis: 1,
      peakAlpha: 0.52,
      footY: -1.5,
      color: typeof d.c === 'string' ? d.c : '#94909a',
      opacity: 0.95,
      seed: d.seed ?? 1,
    });
    fogWallCache.set(k, proto);
  }
  const clone = new THREE.Group();
  clone.userData.role = 'mist';
  for (const ch of proto.children) {
    const m = ch as THREE.Mesh;
    const cm = tagMistMesh(new THREE.Mesh(m.geometry, m.material));
    clone.add(cm);
  }
  return clone;
}

/** Thin drifting ribbon of ground mist (`mist` in `wisp` mode). */
export function mistWisp(d: D = {}): THREE.Group {
  const len = d.l ?? d.len ?? d.w ?? 45;
  const depth = d.d ?? 8;
  const h = d.h ?? 3.5;
  return buildMistLayers({
    len,
    h,
    d: depth,
    ext: Math.min(8, len * 0.1),
    layers: 2,
    cols: 5,
    axis: 0,
    peakAlpha: Math.min(0.6, Math.max(0.32, d.o ?? 0.42)),
    footY: -0.35,
    color: typeof d.c === 'string' ? d.c : '#b0b2ba',
    opacity: 0.9,
    seed: d.seed ?? d.s ?? 53,
  });
}

/** Unified mist prop entry (`mist`): dispatches `bank`, `wall`, or `wisp`. */
export function mist(d: D = {}): THREE.Group {
  const mode: MistMode = (d.mode as MistMode) ?? ((d.h ?? 0) >= 24 ? 'wall' : 'bank');
  if (mode === 'wall') return mistWall(d);
  if (mode === 'wisp') return mistWisp(d);
  return mistBank(d);
}

const NOOP_RAYCAST = () => {};

/** Automatic perimeter mist ring enclosing an outdoor level's playable bounds. */
export function perimeterMist(
  bounds: { x0: number; z0: number; x1: number; z1: number },
  y0 = 0,
): THREE.Group {
  const g = new THREE.Group();
  g.name = 'perimeter-mist';
  g.userData.role = 'mist';
  g.userData.perimeterMist = true;

  const wx = Math.max(80, bounds.x1 - bounds.x0);
  const wz = Math.max(80, bounds.z1 - bounds.z0);
  const cx = (bounds.x0 + bounds.x1) * 0.5;
  const cz = (bounds.z0 + bounds.z1) * 0.5;
  const span = Math.min(wx, wz);
  const pad = Math.min(60, Math.max(18, span * 0.06));
  const h = Math.min(85, Math.max(28, span * 0.12));
  const depth = Math.min(65, Math.max(20, span * 0.08));

  // Private material for this level's perimeter ring so zoom fade never mutates shared mist materials.
  const pmMat = matClone('#ffffff', true);
  pmMat.vertexColors = true;
  pmMat.transparent = true;
  pmMat.opacity = 0.85;
  pmMat.depthWrite = false;
  pmMat.side = THREE.DoubleSide;
  setSurface(pmMat, 'none');
  (pmMat.userData.mistDrift ??= { value: 1 }).value = 1;
  patchFog(pmMat, true);
  g.userData.mistMat = pmMat;
  g.userData.baseOpacity = 0.85;

  const sides: { x: number; z: number; len: number; rot: number; seed: number }[] = [
    { x: cx, z: bounds.z0 - pad, len: wx + pad * 2, rot: 0, seed: 101 },
    { x: cx, z: bounds.z1 + pad, len: wx + pad * 2, rot: Math.PI, seed: 102 },
    { x: bounds.x0 - pad, z: cz, len: wz + pad * 2, rot: Math.PI * 0.5, seed: 103 },
    { x: bounds.x1 + pad, z: cz, len: wz + pad * 2, rot: -Math.PI * 0.5, seed: 104 },
  ];

  for (const s of sides) {
    const wall = buildMistLayers({
      len: s.len,
      h,
      d: depth,
      ext: Math.min(45, s.len * 0.1),
      layers: 4,
      cols: 6,
      axis: 0,
      peakAlpha: 0.42,
      footY: -1.5,
      color: '#9c9aa4',
      opacity: 0.85,
      seed: s.seed,
    });
    wall.position.set(s.x, y0, s.z);
    wall.rotation.y = s.rot;
    wall.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.material = pmMat;
        m.raycast = NOOP_RAYCAST;
      }
    });
    g.add(wall);
  }
  return g;
}

/** Smoothly fade the outdoor perimeter mist ring as the camera zooms out into the valley, and hide when folded. */
export function updatePerimeterMist(root: THREE.Object3D, cameraDist: number, folded = false): number {
  const pm = root.getObjectByName('perimeter-mist');
  if (!pm) return 0;
  const t = Math.max(0, Math.min(1, (cameraDist - 600) / (3600 - 600)));
  const smooth = t * t * (3 - 2 * t);
  const fade = folded ? 0 : 1 - smooth;
  pm.visible = fade > 0.01;
  const mt = pm.userData.mistMat as THREE.MeshLambertMaterial | undefined;
  const base = (pm.userData.baseOpacity as number | undefined) ?? 0.85;
  if (mt && pm.visible) mt.opacity = Math.min(0.98, base * fade);
  return fade;
}
