// Floor-only tactical grid. It is geometry built from grid.json floor polygons, so it cannot land on walls,
// stair risers, props or characters: those occlude it through the depth buffer.
import * as THREE from 'three';
import type { GridLevel } from '../core/schema';
import { CELL_FT } from '../core/units';
import { hexSizeFromWidth } from '../core/grid';
import { planeGeometry } from '../kit/pieces';
import { fogUniforms } from './materials';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// The renderer uses a logarithmic depth buffer: without its chunks this shader would write plain z and lose the depth
// test against every floor, so the grid would never show.
const vert = `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}`;

const frag = `
precision highp float;
#include <logdepthbuf_pars_fragment>
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
uniform float uPxPerFt;   // what a foot is worth on screen: decides which grid orders show

// A line of a given spacing (feet): 1 on the line, 0 off it; bold widens it.
float lineAt(vec2 p, float spacing, float bold) {
  vec2 g = abs(fract(p / spacing - 0.5) - 0.5) * spacing;
  float d = min(g.x, g.y);
  float w = max(fwidth(p.x), fwidth(p.y));
  return 1.0 - smoothstep(0.06 * bold, 0.06 * bold + 1.2 * w, d);
}
// How much an order of lines shows at this zoom: fading in once its spacing spans ~10 px, full by ~40 px.
float orderWeight(float spacing) { return smoothstep(10.0, 40.0, spacing * uPxPerFt); }
// Drafting-style regridding: the cell lines, then every 10, 50, 100 and 500 ft stronger, each order fading as the
// camera pulls back past it and the next order taking over.
float squareLine(vec2 p) {
  float a = lineAt(p, uCell, 1.0) * orderWeight(uCell) * 0.55;
  a = max(a, lineAt(p, 10.0, 1.3) * orderWeight(10.0) * 0.7);
  a = max(a, lineAt(p, 50.0, 1.7) * orderWeight(50.0) * 0.85);
  a = max(a, lineAt(p, 100.0, 2.1) * orderWeight(100.0) * 1.0);
  a = max(a, lineAt(p, 500.0, 2.6) * orderWeight(500.0) * 1.1);
  return min(1.0, a);
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
  return (1.0 - smoothstep(0.06, 0.06 + 1.2 * w, d)) * max(orderWeight(uHexSize * 1.5), 0.0);
}

void main() {
  #include <logdepthbuf_fragment>
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

/** Shared by every grid: what a foot is worth on screen right now (the app updates it as the camera moves). */
export const gridUniforms = { uPxPerFt: { value: 6 } };

/** Height above the floor top. No polygon offset: at grazing angles it lets the grid bleed through thin props. */
export const GRID_LIFT_FT = 0.04;

export function buildGridOverlay(g: GridLevel, elevation: number, ground = true): THREE.Mesh {
  // The ground level's grid is one plane over the level's whole extent, running well past the map: the grid is a
  // feature of the ground, not of any floor's texture. A raised level (a tower room, a roof terrace, a wall-walk) has no
  // ground beside it: its grid is drawn over its floor polygons alone, so no line hangs in the air past an octagon's side.
  const y = elevation + GRID_LIFT_FT;
  let geo: THREE.BufferGeometry;
  if (ground || !g.floorPolygons.length) {
    const xs = g.floorPolygons.flat().map((q) => q[0]), zs = g.floorPolygons.flat().map((q) => q[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const pad = Math.max(30, 0.12 * Math.max(maxX - minX, maxZ - minZ));
    geo = planeGeometry([[minX - pad, minZ - pad], [maxX + pad, minZ - pad], [maxX + pad, maxZ + pad], [minX - pad, maxZ + pad]], y);
  } else geo = floorsGeometry(g, y);
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
      uPxPerFt: gridUniforms.uPxPerFt,
    },
  });
  const mesh = new THREE.Mesh(geo, m);
  mesh.name = 'grid-overlay';
  mesh.userData.role = 'grid';
  mesh.renderOrder = 1;
  return mesh;
}

/** The grid over the level's floor polygons alone (one plane per polygon). */
function floorsGeometry(g: GridLevel, y: number): THREE.BufferGeometry {
  return mergeGeometries(g.floorPolygons.filter((p) => p.length >= 3).map((p) => planeGeometry(p, y)))!;
}

/** A ground level whose land does not stay at its own height past the map (a pass between precipices, a gorge, a
 *  mountainside) keeps its grid on its floors: the padded plane would hang in the air over the drop. */
export function fitGridToFloors(mesh: THREE.Mesh, g: GridLevel, elevation: number): void {
  if (!g.floorPolygons.some((p) => p.length >= 3)) return;
  mesh.geometry.dispose();
  mesh.geometry = floorsGeometry(g, elevation + GRID_LIFT_FT);
}

export function setGridType(mesh: THREE.Mesh, type: 'square' | 'hex'): void {
  (mesh.material as THREE.ShaderMaterial).uniforms.uHex.value = type === 'hex' ? 1 : 0;
}
