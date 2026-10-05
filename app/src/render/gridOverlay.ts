// Floor-only tactical grid. It is geometry built from grid.json floor polygons, so it cannot land on walls,
// stair risers, props or characters: those occlude it through the depth buffer.
// On a level with relief (core/relief.ts) the grid is drawn by the floors' own shader instead (`drapeGrid`): the same
// lines from the same plan feet, so it lies on the ground wherever the ground goes, with no extra geometry or draw.
import * as THREE from 'three';
import type { GridLevel } from '../core/schema';
import { CELL_FT } from '../core/units';
import { hexSizeFromWidth } from '../core/grid';
import { planeGeometry } from '../kit/pieces';
import { fogUniforms } from './materials';
import { GRID_FN } from './gridGlsl';

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
uniform vec2 uOrigin;
uniform sampler2D uCovTex;
uniform vec2 uCovOrigin;
uniform vec2 uCovSize;
uniform float uFog;
uniform float uCovEnabled;
${GRID_FN}
void main() {
  #include <logdepthbuf_fragment>
  vec2 p = vW.xz - uOrigin;
  float line = gridLine(p);
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

function gridMaterial(g: GridLevel): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
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
}

/** Where the grid runs (plan feet): the level's floors, and on the ground level well past the map; an upper floor's
 *  stays within its own walls. */
function gridExtent(g: GridLevel, ground: boolean): { minX: number; minZ: number; maxX: number; maxZ: number } {
  const xs = g.floorPolygons.flat().map((q) => q[0]), zs = g.floorPolygons.flat().map((q) => q[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const pad = ground ? Math.max(30, 0.12 * Math.max(maxX - minX, maxZ - minZ)) : 1.5;
  return { minX: minX - pad, minZ: minZ - pad, maxX: maxX + pad, maxZ: maxZ + pad };
}

export function buildGridOverlay(g: GridLevel, elevation: number, ground = true): THREE.Mesh {
  // One plane over the level's whole extent: the grid is a feature of the ground, not of any floor's texture.
  const { minX, minZ, maxX, maxZ } = gridExtent(g, ground), y = elevation + GRID_LIFT_FT;
  const geo = planeGeometry([[minX, minZ], [maxX, minZ], [maxX, maxZ], [minX, maxZ]], y);
  const mesh = new THREE.Mesh(geo, gridMaterial(g));
  mesh.name = 'grid-overlay';
  mesh.userData.role = 'grid';
  mesh.renderOrder = 1;
  return mesh;
}

/** A level with relief: the grid lives in its floors' shader. This stands in for the overlay (the app shows, hides,
 *  retypes and fades `BuiltLevel.grid` exactly as before): it draws nothing, holds the grid's uniforms, and its
 *  `visible` switches the floors' grid on and off. Hand `drapeGrid(proxy)` to each floor material, and to the land
 *  beyond the map (backdrop.ts), so the grid runs out over it as far as the flat overlay would. */
export function buildDrapedGrid(g: GridLevel): THREE.Mesh {
  const m = gridMaterial(g);
  const on = { value: 1 };
  const e = g.floorPolygons.length ? gridExtent(g, true) : undefined;
  const bounds = e ? new THREE.Vector4(e.minX, e.minZ, e.maxX, e.maxZ) : new THREE.Vector4(-1e9, -1e9, 1e9, 1e9);
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), m);
  mesh.name = 'grid-draped';
  mesh.userData.role = 'grid';
  mesh.userData.draped = { uGridColor: m.uniforms.uColor, uGridOpacity: m.uniforms.uOpacity, uGridOrigin: m.uniforms.uOrigin, uGridOn: on, uGridBounds: { value: bounds }, uGridHole: { value: new THREE.Vector4(0, 0, 0, 0) },
    uCell: m.uniforms.uCell, uHex: m.uniforms.uHex, uPointy: m.uniforms.uPointy, uHexSize: m.uniforms.uHexSize, uPxPerFt: gridUniforms.uPxPerFt };
  mesh.frustumCulled = false;
  let vis = true;
  Object.defineProperty(mesh, 'visible', { get: () => vis, set: (v: boolean) => { vis = v; on.value = v ? 1 : 0; }, configurable: true });
  return mesh;
}
/** The uniforms a floor material needs to draw the draped grid (see materials.ts patchFog). */
export function drapeGrid(proxy: THREE.Mesh): Record<string, { value: unknown }> { return proxy.userData.draped as Record<string, { value: unknown }>; }

export function setGridType(mesh: THREE.Mesh, type: 'square' | 'hex'): void {
  (mesh.material as THREE.ShaderMaterial).uniforms.uHex.value = type === 'hex' ? 1 : 0;
}
