// The coverage basis (nested world, step 1): the fog and grid shaders turn a world point back into scene feet before
// they read the coverage map or lay the grid. These mirror the shader expression in TS.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { covBasisOf, covUv, matrixOf, toWorld, type Placement } from '../app/src/core/frames';
import type { Vec2 } from '../app/src/core/geometry';

const origin: Vec2 = [-4, -6], size: Vec2 = [96, 64];
const local: Vec2[] = [[22.5, 17.5], [0, 0], [-3.25, 40.75], [88, 51]];

describe('coverage basis', () => {
  it('is exactly the identity for an unplaced scene (pixel-neutral)', () => {
    const b = covBasisOf(new THREE.Matrix4());
    expect(b.elements).toEqual(new THREE.Matrix3().elements);
    for (const p of local) expect(covUv(b, origin, size, p)).toEqual([(p[0] - origin[0]) / size[0], (p[1] - origin[1]) / size[1]]);
  });

  for (const [name, pl] of [
    ['turned −π/2', { position: [0, 0, 0], rotationY: -Math.PI / 2 }],
    ['50,000 ft out and turned −π/2', { position: [50000, 12, -3000], rotationY: -Math.PI / 2 }],
    ['turned π, off the origin', { position: [-1234.5, 0, 987.25], rotationY: Math.PI }],
    ['turned an odd angle', { position: [310, 0, -77], rotationY: 0.4 }],
  ] as [string, Placement][])
    it(`maps a placed point to the uv of the unplaced one: ${name}`, () => {
      const b = covBasisOf(matrixOf(pl));
      for (const p of local) {
        const w = toWorld(pl, p); // where the scene point is drawn
        const [u, v] = covUv(b, origin, size, w);
        const [u0, v0] = covUv(new THREE.Matrix3(), origin, size, p);
        expect(u).toBeCloseTo(u0, 9);
        expect(v).toBeCloseTo(v0, 9);
      }
    });

  it('agrees with three.js: the basis inverts the scene root’s matrixWorld in xz', () => {
    const root = new THREE.Group();
    root.position.set(50000, 0, 0); root.rotation.y = -Math.PI / 2; root.updateMatrixWorld();
    const b = covBasisOf(root.matrixWorld);
    const w = new THREE.Vector3(22.5, 3, 17.5).applyMatrix4(root.matrixWorld);
    const q = new THREE.Vector3(w.x, w.z, 1).applyMatrix3(b);
    expect(q.x).toBeCloseTo(22.5, 6);
    expect(q.y).toBeCloseTo(17.5, 6);
    // a step to x − 10 in the scene is a step to z − 10 in the world (Death House in the village)
    const w2 = new THREE.Vector3(12.5, 3, 17.5).applyMatrix4(root.matrixWorld);
    expect(w2.z - w.z).toBeCloseTo(-10, 6);
    expect(w2.x - w.x).toBeCloseTo(0, 6);
  });
});

describe('flight time', () => {
  it('is 420 ms for a hop, grows with the log of the zoom and the ground covered, and stops at 900 ms', async () => {
    const { flightMs } = await import('../app/src/render/world');
    expect(flightMs(100, 100)).toBe(420);
    expect(flightMs(100, 200)).toBeGreaterThan(420);
    expect(flightMs(100, 200)).toBe(flightMs(200, 100)); // in or out, the same
    expect(flightMs(100, 400)).toBeGreaterThan(flightMs(100, 200));
    expect(flightMs(100, 100, 3)).toBeGreaterThan(420);
    expect(flightMs(60, 100000, 50)).toBe(900);
  });
});
