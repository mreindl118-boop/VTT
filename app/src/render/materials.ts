// Palette materials + the coverage-fog shader patch shared by every lit material.
import * as THREE from 'three';
import { PALETTE } from '../kit/palette';

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

const VERT_DECL = 'varying vec3 vMistWorld;\n';
const VERT_BODY = `
  vec4 mistP = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    mistP = instanceMatrix * mistP;
  #endif
  vMistWorld = (modelMatrix * mistP).xyz;
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

/** Patch a built-in material so it samples the coverage map. Idempotent. */
export function patchFog<T extends THREE.Material>(m: T, exempt = false): T {
  if (m.userData.mist) return m;
  m.userData.mist = true;
  const exemptU = { value: exempt ? 1 : 0 };
  m.userData.fogExempt = exemptU;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, fogUniforms, { uFogExempt: exemptU });
    sh.vertexShader = VERT_DECL + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n' + VERT_BODY);
    sh.fragmentShader = FRAG_DECL + sh.fragmentShader.replace('#include <opaque_fragment>', '#include <opaque_fragment>\n gl_FragColor.rgb = mistApply(gl_FragColor.rgb);');
  };
  m.customProgramCacheKey = () => 'mist';
  return m;
}

const cache = new Map<string, THREE.MeshLambertMaterial>();
/** Shared flat-shaded palette material. Never mutate the returned instance; clone it. */
export function mat(color: string, opts: { emissive?: string } = {}): THREE.MeshLambertMaterial {
  const k = color + (opts.emissive ?? '');
  let m = cache.get(k);
  if (!m) {
    m = patchFog(new THREE.MeshLambertMaterial({ color, flatShading: true, emissive: opts.emissive ?? '#000000' }));
    cache.set(k, m);
  }
  return m;
}

/** A private copy of a palette material (e.g. for per-object slider opacity). Same shader program. */
export function matClone(color: string, exempt = false): THREE.MeshLambertMaterial {
  const base = mat(color);
  const m = new THREE.MeshLambertMaterial({ color: base.color, flatShading: true, emissive: base.emissive });
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
