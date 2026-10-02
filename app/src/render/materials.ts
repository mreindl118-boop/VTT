// Palette materials + the coverage-fog shader patch shared by every lit material.
import * as THREE from 'three';
import { PALETTE } from '../kit/palette';
import { SURF, surfaceOf, type Surface } from '../kit/surfaces';

/** Uniforms shared by all patched materials; one level is active at a time. */
export const fogUniforms = {
  uCovTex: { value: null as THREE.Texture | null },
  uCovOrigin: { value: new THREE.Vector2() },
  uCovSize: { value: new THREE.Vector2(1, 1) },
  /** fog(t): 1 = solid fog over unexplored. */
  uFog: { value: 1 },
  /** 1 − hidden(t): how strongly explored-memory is desaturated. */
  uMemory: { value: 1 },
  uFogColor: { value: new THREE.Color(PALETTE.fog) },
  uCovEnabled: { value: 1 },
};

const VERT_DECL = 'varying vec3 vMistWorld;\nvarying vec3 vMistN;\n';
const VERT_BODY = `
  vec4 mistP = vec4(transformed, 1.0);
  vec3 mistN = MIST_NORMAL;
  #ifdef USE_INSTANCING
    mistP = instanceMatrix * mistP;
    mistN = mat3(instanceMatrix) * mistN;
  #endif
  vMistWorld = (modelMatrix * mistP).xyz;
  vMistN = mat3(modelMatrix) * mistN;
`;
const FRAG_DECL = `
varying vec3 vMistWorld;
uniform sampler2D uCovTex;
uniform vec2 uCovOrigin;
uniform vec2 uCovSize;
uniform float uFog;
uniform float uMemory;
uniform vec3 uFogColor;
uniform float uCovEnabled;
uniform float uFogExempt;

varying vec3 vMistN;
uniform float uSurfAmt;
uniform sampler2D uNoise;
float sh21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
// noise from one tiling texture (r: fbm, 4 cells a tile; g: value noise, 32 a tile; b, a: cells, 16 a tile)
float snoise(vec2 p) { return texture2D(uNoise, p * 0.03125).g; }
float sfbm(vec2 p) { return 0.62 * texture2D(uNoise, p * 0.25).r + 0.38 * texture2D(uNoise, mat2(0.8, -0.6, 0.6, 0.8) * p * 0.0931 + 0.37).r; }
// cells: x = how far into the stone (0 at the joint, 1 at the middle), y = edge distance, z = the stone's hash
vec3 scell(vec2 p) { vec4 t = texture2D(uNoise, p * 0.0625); return vec3(1.0 - t.b, t.b * 0.5, t.a); }
// running bond: x = distance to the nearest joint (in feet), y = the block's hash
vec2 sbond(vec2 p, vec2 size) { vec2 q = p / size; float row = floor(q.y); q.x += mod(row, 2.0) * 0.5;
  vec2 c = floor(q), f = fract(q), e = min(f, 1.0 - f) * size; return vec2(min(e.x, e.y), sh21(c + row * 0.37)); }
float sjoint(float e, float w, float px) { return 1.0 - smoothstep(w, w + px * 1.5, e); }
vec3 mistSurface(vec3 P, vec3 N) {
  const int k = SURF;
#if SURF == 0
  return vec3(1.0);
#else
  vec3 an = abs(N); bool top = an.y > 0.72;
  vec2 uv = top ? P.xz : (an.x > an.z ? P.zy : P.xy);
  float px = max(length(fwidth(P)), 1e-4);                         // feet per pixel
  float fine = clamp(1.0 - px / 0.25, 0.0, 1.0), mid = clamp(1.0 - px / 0.9, 0.0, 1.0), broad = clamp(1.0 - px / 4.0, 0.0, 1.0);
  float m = 1.0; vec3 tint = vec3(1.0);
  float grime = sfbm(uv * 0.35) - 0.5;
#if SURF == 2 || SURF == 12
    // dressed stone / brick: running bond
    vec2 sz = k == 2 ? (top ? vec2(3.0, 2.5) : vec2(2.6, 1.3)) : vec2(0.8, 0.32);
    vec2 b = sbond(uv, sz);
    m = mix(1.0, 0.9 + 0.16 * b.y, mid) * (1.0 - 0.32 * sjoint(b.x, 0.05, px) * mid) + grime * 0.14 * broad;
#elif SURF == 3 || SURF == 16
    // rubble and living rock: irregular stones
    vec3 c = scell(uv * (k == 3 ? 0.9 : 0.45));
    m = mix(1.0, 0.86 + 0.24 * c.z, mid) * (1.0 - 0.38 * (1.0 - smoothstep(0.02, 0.09 + px, c.y)) * mid) + grime * 0.18 * broad;
    if (k == 16) m += (snoise(vec2(uv.x * 0.2, uv.y * 2.2)) - 0.5) * 0.14 * broad;   // strata
#elif SURF == 4
    // boards: planks along x, seams and grain
    vec2 q = top ? P.xz : uv; vec2 b = sbond(q, vec2(7.0, 0.75));
    float grain = snoise(vec2(q.x * 0.9, q.y * 14.0));
    m = mix(1.0, 0.9 + 0.14 * b.y + (grain - 0.5) * 0.12, mid) * (1.0 - 0.38 * sjoint(b.x, 0.03, px) * fine);
#elif SURF == 5 || SURF == 20
    // timber and bark: grain along the piece
    vec2 q = top ? P.xz : vec2(uv.x * 7.0, uv.y * 0.6);
    float gr = snoise(q * (k == 20 ? vec2(1.4, 1.0) : vec2(1.0, 1.0)));
    m = 1.0 + (gr - 0.5) * (k == 20 ? 0.34 : 0.18) * fine + grime * 0.08 * broad;
    if (k == 20) m *= 1.0 - 0.3 * smoothstep(0.62, 0.8, gr) * fine;   // fissures
#elif SURF == 21
    // log walls: stacked round logs, chinked seams
    float f = fract(uv.y / 1.1); float r = sin(f * 3.14159);
    m = mix(1.0, 0.72 + 0.32 * r, mid) * (1.0 + (snoise(vec2(uv.x * 0.8, uv.y * 9.0)) - 0.5) * 0.14 * fine);
#elif SURF == 6
    // plaster: mottled, stained low down
    m = 1.0 + (sfbm(uv * 0.7) - 0.5) * 0.16 * broad + (snoise(uv * 9.0) - 0.5) * 0.05 * fine;
    tint = mix(vec3(1.0), vec3(1.02, 1.0, 0.95), clamp(grime + 0.5, 0.0, 1.0));
#elif SURF == 7
    // cobbles: domed setts, dark gaps
    vec3 c = scell(P.xz / 0.95);
    float gap = 1.0 - smoothstep(0.03, 0.1 + px, c.y);
    m = mix(1.0, (0.86 + 0.22 * c.z) * (1.06 - 0.3 * smoothstep(0.2, 0.62, c.x)), mid) * (1.0 - 0.45 * gap * mid) + grime * 0.16 * broad;
#elif SURF == 8
    // flagstones
    vec2 b = sbond(P.xz, vec2(3.0, 2.5));
    m = mix(1.0, 0.88 + 0.2 * b.y, mid) * (1.0 - 0.35 * sjoint(b.x, 0.06, px) * mid) + (sfbm(P.xz * 0.5) - 0.5) * 0.14 * broad;
#elif SURF == 9
    // trodden earth: patches, pebbles, wheel-worn
    vec3 c = scell(P.xz * 2.2);
    m = 1.0 + (sfbm(P.xz * 0.12) - 0.5) * 0.26 * broad + (snoise(P.xz * 3.0) - 0.5) * 0.1 * mid + (1.0 - smoothstep(0.05, 0.16, c.x)) * step(0.7, c.z) * 0.18 * fine;
#elif SURF == 10
    // grass: drifts of lighter and darker growth, tussocks
    float pa = sfbm(P.xz * 0.045), pb = snoise(P.xz * 0.6), pc = snoise(P.xz * 7.0);
    m = 1.0 + (pa - 0.5) * 0.3 + (pb - 0.5) * 0.12 * mid + (pc - 0.5) * 0.1 * fine;
    tint = mix(vec3(0.96, 1.0, 1.02), vec3(1.06, 1.04, 0.9), smoothstep(0.35, 0.7, pa));
#elif SURF == 11
    // shingle and slate: courses up the slope, staggered
    float along = an.x > an.z ? P.z : P.x;
    vec2 b = sbond(vec2(along, P.y), vec2(1.2, 0.75)); float f = fract(P.y / 0.75);
    m = mix(1.0, (0.86 + 0.18 * b.y) * (0.82 + 0.18 * smoothstep(0.0, 0.45, f)), mid) * (1.0 - 0.25 * sjoint(b.x, 0.03, px) * fine) + grime * 0.14 * broad;
#elif SURF == 13
    // thatch and straw
    float along = an.x > an.z ? P.z : P.x;
    m = 1.0 + (snoise(vec2(along * 9.0, P.y * 0.9)) - 0.5) * 0.26 * fine + grime * 0.12 * broad;
#elif SURF == 14
    // cloth: a quiet weave and folds
    m = 1.0 + (sfbm(uv * 0.9) - 0.5) * 0.14 * broad + (sin(uv.x * 40.0) * sin(uv.y * 40.0)) * 0.025 * fine;
#elif SURF == 15
    // iron: pitted, rust-dark
    m = 1.0 + (sfbm(uv * 2.5) - 0.5) * 0.22 * mid; tint = mix(vec3(1.0), vec3(1.08, 0.96, 0.9), smoothstep(0.55, 0.8, sfbm(uv * 1.3)));
#elif SURF == 17
    // still water: slow ripples
    m = 1.0 + (sin((P.x + P.z) * 0.7 + sfbm(P.xz * 0.2) * 6.0) * 0.5) * 0.08 * mid;
#elif SURF == 18
    m = 1.0 + (sfbm(P.xz * 0.3) - 0.5) * 0.08;
#elif SURF == 19
    // foliage: clumps of needles and leaves
    vec3 c = scell(uv * 1.3);
    m = mix(1.0, (0.82 + 0.26 * c.z) * (1.1 - 0.3 * smoothstep(0.15, 0.6, c.x)), mid);
#elif SURF == 22
    // worked stone (columns, steps, chimneys)
    m = 1.0 + (sfbm(uv * 1.1) - 0.5) * 0.2 * mid + grime * 0.12 * broad;
#else
    // anything else: a whisper of grain
    m = 1.0 + (sfbm(uv * 0.8) - 0.5) * 0.1 * mid;
#endif
  return mix(vec3(1.0), tint * m, uSurfAmt);
#endif
}
float mistCoverage() {
  vec2 uv = (vMistWorld.xz - uCovOrigin) / uCovSize;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
  return texture2D(uCovTex, uv).r;
}
vec3 mistApply(vec3 c) {
  if (uCovEnabled < 0.5 || uFogExempt > 0.5) return c;
  float cov = mistCoverage();
  float vis = step(0.75, cov);
  float expl = step(0.25, cov) * (1.0 - vis);
  float g = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(c, mix(c, vec3(g) * 0.55, uMemory), expl);
  return mix(c, uFogColor, (1.0 - vis - expl) * uFog);
}
`;

/** Global surface strength (0 = the old flat colours). */
export const surfaceUniforms = { uSurfAmt: { value: 1 }, uNoise: { value: noiseTexture() } };

/** One 256² tiling texture holds every noise the surfaces need (cheap to sample, mipmapped against shimmer):
 *  r = fbm over 4 cells, g = value noise over 32 cells, b = distance to the nearest stone edge (16 cells), a = stone id. */
function noiseTexture(): THREE.DataTexture {
  const N = 256, data = new Uint8Array(N * N * 4);
  const hash = (x: number, y: number, s: number) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const vnoise = (x: number, y: number, P: number, s: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const h = (a: number, b: number) => hash(((a % P) + P) % P, ((b % P) + P) % P, s);
    return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
  };
  const C = 16, pts: [number, number][] = [];
  for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) pts.push([i + 0.12 + hash(i, j, 7) * 0.76, j + 0.12 + hash(i, j, 9) * 0.76]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const o = (y * N + x) * 4;
    let f = 0, a = 0.5, P = 4;
    for (let k = 0; k < 5; k++) { f += a * vnoise((x / N) * P, (y / N) * P, P, k + 1); a *= 0.5; P *= 2; }
    data[o] = Math.round(Math.min(1, f / 0.97) * 255);
    data[o + 1] = Math.round(vnoise((x / N) * 32, (y / N) * 32, 32, 11) * 255);
    const cx = (x / N) * C, cy = (y / N) * C, ix = Math.floor(cx), iy = Math.floor(cy);
    let d1 = 9, d2 = 9, id = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const gi = ix + di, gj = iy + dj, q = pts[(((gj % C) + C) % C) * C + (((gi % C) + C) % C)];
      const px = q[0] - (((gi % C) + C) % C) + gi, py = q[1] - (((gj % C) + C) % C) + gj, d = Math.hypot(px - cx, py - cy);
      if (d < d1) { d2 = d1; d1 = d; id = hash(gi & (C - 1), gj & (C - 1), 3); } else if (d < d2) d2 = d;
    }
    data[o + 2] = Math.round(Math.min(1, (d2 - d1) * 1.4) * 255); data[o + 3] = Math.round(id * 255);
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}
/** Set what a material is made of (by default, what its colour is declared as in kit/surfaces). */
export function setSurface(m: THREE.Material, s: Surface): void { const u = (m.userData.surf ??= { value: 0 }); if (u.value !== SURF[s]) { u.value = SURF[s]; m.needsUpdate = true; } }

/** Patch a built-in material so it samples the coverage map. Idempotent. */
export function patchFog<T extends THREE.Material>(m: T, exempt = false): T {
  if (m.userData.mist) return m;
  m.userData.mist = true;
  const exemptU = { value: exempt ? 1 : 0 };
  m.userData.fogExempt = exemptU;
  const lit = m.type === 'MeshLambertMaterial';
  const surfU = (m.userData.surf ??= { value: lit ? SURF.generic : 0 }) as { value: number };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, fogUniforms, { uFogExempt: exemptU, uSurfAmt: surfaceUniforms.uSurfAmt, uNoise: surfaceUniforms.uNoise });
    if (sh.fragmentShader.includes('#include <color_fragment>')) sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mistSurface(vMistWorld, normalize(vMistN));');
    sh.vertexShader = VERT_DECL + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n' + VERT_BODY.replace('MIST_NORMAL', lit ? 'objectNormal' : 'vec3(0.0, 1.0, 0.0)'));
    sh.fragmentShader = `#define SURF ${surfU.value}\n` + FRAG_DECL + sh.fragmentShader.replace('#include <opaque_fragment>', '#include <opaque_fragment>\n gl_FragColor.rgb = mistApply(gl_FragColor.rgb);');
  };
  m.customProgramCacheKey = () => 'mist' + surfU.value;
  return m;
}

const cache = new Map<string, THREE.MeshLambertMaterial>();
/** Shared flat-shaded palette material. Never mutate the returned instance; clone it. */
export function mat(color: string, opts: { emissive?: string; surface?: Surface } = {}): THREE.MeshLambertMaterial {
  const surf = opts.surface ?? surfaceOf(color);
  const k = color + (opts.emissive ?? '') + ':' + surf;
  let m = cache.get(k);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, flatShading: true, emissive: opts.emissive ?? '#000000' });
    setSurface(m, opts.emissive && opts.emissive !== '#000000' ? 'none' : surf);
    patchFog(m);
    cache.set(k, m);
  }
  return m;
}

/** A private copy of a palette material (e.g. for per-object slider opacity). Same shader program. */
export function matClone(color: string, exempt = false): THREE.MeshLambertMaterial {
  const base = mat(color);
  const m = new THREE.MeshLambertMaterial({ color: base.color, flatShading: true, emissive: base.emissive });
  setSurface(m, surfaceOf(color));
  return patchFog(m, exempt);
}

/** Set slider opacity on a private material without changing pixels when fully opaque. */
export function setOpacity(m: THREE.Material, o: number): void {
  const transparent = o < 0.999;
  if (m.transparent !== transparent) { m.transparent = transparent; m.needsUpdate = true; }
  m.opacity = transparent ? o : 1;
  m.depthWrite = !transparent;
}

/** Cutaway plane for walls and doors: everything above `y` is clipped while low walls are on. Real proportions stay. */
export const WALL_CLIP = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6);
export function setWallCut(y: number | null): void { WALL_CLIP.constant = y === null ? 1e6 : y; }
/** Private wall material that honours the cutaway plane. */
export function wallMat(color: string, opts: { emissive?: string } = {}): THREE.MeshLambertMaterial {
  const m = matClone(color);
  if (opts.emissive) m.emissive.set(opts.emissive);
  m.clippingPlanes = [WALL_CLIP];
  return m;
}

/** Clip every material under a root by the section plane (floors, props and walls alike), once. */
/** Only the building's shell is sliced by the section plane: floors, walls, doors and roofs. Furniture, people and
 *  things are never cut through; they vanish whole once the cut drops below their floor (see App.applySlider). */
export const SHELL_ROLES = new Set(['floor', 'wall', 'door', 'roof']);
export function sectionClip(root: THREE.Object3D, on: boolean): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    if (on && !SHELL_ROLES.has(o.userData.role)) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) { if (on) { if (!mat.clippingPlanes?.length) mat.clippingPlanes = [WALL_CLIP]; } else if (mat.clippingPlanes?.[0] === WALL_CLIP && o.userData.role !== 'wall' && o.userData.role !== 'door') mat.clippingPlanes = null; }
  });
}
