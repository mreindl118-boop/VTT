// Floor-only tactical grid. It is geometry built from grid.json floor polygons, so it cannot land on walls,
// stair risers, props or characters: those occlude it through the depth buffer.
import * as THREE from 'three';
import type { GridLevel } from '../core/schema';
import { CELL_FT } from '../core/units';
import { hexSizeFromWidth } from '../core/grid';
import { merge, planeGeometry } from '../kit/pieces';
import { fogUniforms } from './materials';

const vert = `
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const frag = `
precision highp float;
varying vec3 vW;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uCell;
uniform float uHex;       // 0 square, 1 hex
uniform float uPointy;    // 1 pointy-top, 0 flat-top
uniform float uHexSize;
uniform vec2 uOrigin;
uniform sampler2D uCovTex;
uniform vec2 uCovOrigin;
uniform vec2 uCovSize;
uniform float uFog;
uniform float uCovEnabled;

float squareLine(vec2 p) {
  vec2 g = abs(fract(p / uCell - 0.5) - 0.5) * uCell;  // distance to nearest line, feet
  float d = min(g.x, g.y);
  float w = max(fwidth(p.x), fwidth(p.y));
  return 1.0 - smoothstep(0.06, 0.06 + 1.2 * w, d);
}

// Distance (feet) to the nearest hex edge.
float hexLine(vec2 p) {
  if (uPointy < 0.5) p = p.yx;
  float s = uHexSize;
  vec2 r = vec2(sqrt(3.0) * s, 3.0 * s);
  vec2 h = r * 0.5;
  vec2 a = mod(p, r) - h;
  vec2 b = mod(p - h, r) - h;
  vec2 q = dot(a, a) < dot(b, b) ? a : b;
  q = abs(q);
  float inner = max(q.x, dot(q, vec2(0.5, sqrt(3.0) * 0.5)));
  float d = (sqrt(3.0) * 0.5 * s) - inner;
  float w = max(fwidth(p.x), fwidth(p.y));
  return 1.0 - smoothstep(0.06, 0.06 + 1.2 * w, d);
}

void main() {
  vec2 p = vW.xz - uOrigin;
  float line = uHex > 0.5 ? hexLine(p) : squareLine(p);
  float a = line * uOpacity;
  if (uCovEnabled > 0.5) {
    vec2 uv = (vW.xz - uCovOrigin) / uCovSize;
    float cov = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? 0.0 : texture2D(uCovTex, uv).r;
    a *= mix(1.0, step(0.25, cov), uFog);
  }
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
}`;

/** Height above the floor top. No polygon offset: at grazing angles it lets the grid bleed through thin props. */
export const GRID_LIFT_FT = 0.04;

export function buildGridOverlay(g: GridLevel, elevation: number): THREE.Mesh {
  const geo = merge(g.floorPolygons.map((p) => planeGeometry(p, elevation + GRID_LIFT_FT)));
  const m = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uColor: { value: new THREE.Color(g.color) },
      uOpacity: { value: g.opacity * 0.6 },
      uCell: { value: CELL_FT },
      uHex: { value: g.type === 'hex' ? 1 : 0 },
      uPointy: { value: g.hexOrientation === 'pointy' ? 1 : 0 },
      uHexSize: { value: hexSizeFromWidth(CELL_FT) },
      uOrigin: { value: new THREE.Vector2(...g.origin) },
      uCovTex: fogUniforms.uCovTex,
      uCovOrigin: fogUniforms.uCovOrigin,
      uCovSize: fogUniforms.uCovSize,
      uFog: fogUniforms.uFog,
      uCovEnabled: fogUniforms.uCovEnabled,
    },
  });
  const mesh = new THREE.Mesh(geo, m);
  mesh.name = 'grid-overlay';
  mesh.userData.role = 'grid';
  mesh.renderOrder = 1;
  return mesh;
}

export function setGridType(mesh: THREE.Mesh, type: 'square' | 'hex'): void {
  (mesh.material as THREE.ShaderMaterial).uniforms.uHex.value = type === 'hex' ? 1 : 0;
}
