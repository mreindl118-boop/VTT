// Frames: the maths that places every map in one valley agrees with what the renderer already does (backdrop.ts's
// toPlan basis, buildContext's rotation) and round-trips through nested, rotated frames.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import barovia from '../locations/ch02/barovia-region/world.json';
import type { WorldData } from '../app/src/campaigns';
import type { SceneFile } from '../app/src/core/schema';
import {
  MI_FT, NEST_LIFT, RELIEF, basisOf, childPlacement, compose, enterRoomOf, flattenWeight, footprintOf, groundY, invert, l0Of, matrixOf, northVec,
  placementOf, roadExit, rootPlacement, rotate, toLocal, toWorld, toWorld3, toLocal3, worldOfMiles, yawOf, type North, type Placement,
} from '../app/src/core/frames';

const W = barovia as unknown as WorldData;
const NORTHS: North[] = ['-z', '+z', '-x', '+x'];
const scene = (p: string) => JSON.parse(readFileSync(`locations/${p}/scene.json`, 'utf8')) as SceneFile;
const pin = (k: string) => W.pins.find((p) => p.key === k)!;
const close = (a: number[], b: number[], eps = 1e-9) => { expect(a.length).toBe(b.length); a.forEach((x, i) => expect(Math.abs(x - b[i]), `[${i}] ${a} vs ${b}`).toBeLessThanOrEqual(eps)); };

describe('frames: yaw and the world basis', () => {
  it('yawOf turns each north onto world north (-z)', () => {
    for (const n of NORTHS) close(rotate(yawOf(n), northVec(n)), [0, -1]);
  });
  it('rootPlacement + toLocal reproduces backdrop.ts\'s toPlan E/S basis for every north', () => {
    const p = pin('E'), fp = { elevationFt: 0, bbox: { minX: -232, minZ: -184.5, maxX: 602, maxZ: 803.2 } };
    const c = [(fp.bbox.minX + fp.bbox.maxX) / 2, (fp.bbox.minZ + fp.bbox.maxZ) / 2];
    for (const north of NORTHS) {
      const { E, S } = basisOf(north), place = rootPlacement({ ...fp, north }, p, W);
      expect(place.rotationY).toBe(yawOf(north));
      for (const w of [pin('K').pos, pin('N').pos, [0, 0] as [number, number], [18, 12] as [number, number]]) {
        const dx = (w[0] - p.pos[0]) * MI_FT, dy = (w[1] - p.pos[1]) * MI_FT; // backdrop.ts: toPlan
        const expected = [c[0] + E[0] * dx + S[0] * dy, c[1] + E[1] * dx + S[1] * dy];
        close(toLocal(place, worldOfMiles(W, w)), expected, 1e-9 * MI_FT * 20);
      }
      // the map's centre sits on its pin
      close(toWorld(place, c as [number, number]), worldOfMiles(W, p.pos), 1e-9);
    }
  });
  it('childPlacement\'s yaw and anchor agree with buildContext\'s th and tf for every pair of norths', () => {
    const nvec = (n: North): [number, number] => (n === '+z' ? [0, 1] : n === '-x' ? [-1, 0] : n === '+x' ? [1, 0] : [0, -1]);
    const room: [number, number][] = [[499.4, 342.5], [520.6, 342.5], [520.6, 353.1], [499.4, 353.1]], pc = [510, 347.8];
    const child = { elevationFt: 0, bbox: { minX: 0, minZ: 0, maxX: 30, maxZ: 55 } }, bc = [15, 27.5];
    for (const pn of NORTHS) for (const cn of NORTHS) {
      const np = nvec(pn), nb = nvec(cn), th = Math.atan2(nb[1], nb[0]) - Math.atan2(np[1], np[0]), c = Math.cos(th), sn = Math.sin(th);
      const tf = (p: number[]) => { const x = p[0] - pc[0], z = p[1] - pc[1]; return [bc[0] + x * c - z * sn, bc[1] + x * sn + z * c]; }; // app.ts buildContext
      const place = childPlacement({ ...child, north: cn }, { north: pn, elevationFt: 0 }, room);
      const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
      expect(Math.abs(wrap(place.rotationY - th))).toBeLessThan(1e-12);
      for (const p of [[600, 300], [510, 400], [0, 0]]) close(toLocal(place, p as [number, number]), tf(p), 1e-9);
    }
  });
  it('a step to x-10 in Death House is a step to z-10 in the village (dθ = -π/2)', () => {
    const E = scene('ch03/E'), DH = scene('appB/death-house');
    const hit = enterRoomOf(E, 'appB/death-house', DH.location)!;
    expect(hit.room.key).toBe('E7');
    const place = childPlacement(footprintOf(l0Of(DH)), hit.level, hit.room.polygon);
    expect(place.rotationY).toBeCloseTo(-Math.PI / 2, 12);
    const a = toWorld(place, [20, 30]), b = toWorld(place, [10, 30]);
    close([b[0] - a[0], b[1] - a[1]], [0, -10], 1e-9);
    close(toWorld(place, [15, 27.5]), [510, 342.5], 1e-9); // the house's centre on the centroid of room E7
  });
});

describe('frames: nesting round-trips', () => {
  const root: Placement = { position: [29435.8, 410.325, 6660.25], rotationY: -Math.PI / 2 };
  const child: Placement = { position: [537.5, NEST_LIFT, 327.5], rotationY: Math.PI };
  it('toLocal(toWorld(p)) == p for a rotated child inside a rotated root', () => {
    const both = compose(root, child);
    for (const p of [[0, 0], [12.5, 27.5], [-3, 100]] as [number, number][]) {
      close(toLocal(both, toWorld(both, p)), p, 1e-9);
      close(toLocal(child, toLocal(root, toWorld(both, p))), p, 1e-9);
      close(toLocal3(both, toWorld3(both, [p[0], 7, p[1]])), [p[0], 7, p[1]], 1e-9);
    }
    const inv = invert(both);
    close(toWorld(inv, toWorld(both, [5, 6])), [5, 6], 1e-9);
  });
  it('compose matches three.js matrix multiplication and placementOf reads a matrix back', () => {
    const m = matrixOf(root).multiply(matrixOf(child)), n = matrixOf(compose(root, child));
    close([...m.elements], [...n.elements], 1e-9);
    const q = placementOf(m), r = compose(root, child);
    close(q.position, r.position, 1e-9);
    expect(Math.atan2(Math.sin(q.rotationY - r.rotationY), Math.cos(q.rotationY - r.rotationY))).toBeCloseTo(0, 12);
    // a three.js Object3D with rotation.y and position produces the same local → world mapping as toWorld
    const o = new THREE.Object3D(); o.rotation.y = child.rotationY; o.position.set(...child.position); o.updateMatrix();
    const v = new THREE.Vector3(10, 0, 20).applyMatrix4(o.matrix), w = toWorld(child, [10, 20]);
    close([v.x, v.z], w, 1e-9);
  });
});

describe('frames: the data in place', () => {
  it('childPlacement puts the Blue Water Inn\'s centre on the centroid of Vallaki room N2', () => {
    const N = scene('ch05/N'), N2 = scene('ch05/N2'), hit = enterRoomOf(N, 'ch05/N2', N2.location)!;
    expect(hit.room.key).toBe('N2');
    const fp = footprintOf(l0Of(N2));
    close([(fp.bbox.minX + fp.bbox.maxX) / 2, (fp.bbox.minZ + fp.bbox.maxZ) / 2], [100, 62.5]);
    const place = childPlacement(fp, hit.level, hit.room.polygon);
    expect(place.rotationY).toBe(0);
    expect(place.position[1]).toBe(NEST_LIFT);
    close(toWorld(place, [100, 62.5]), [4385, 2155], 1e-9);
  });
  it('pin K\'s root stands a thousand feet above the land', () => {
    const K = scene('ch04/K'), fp = footprintOf(l0Of(K)), place = rootPlacement(fp, pin('K'), W);
    expect(fp.elevationFt).toBe(0);
    expect(place.position[1]).toBeCloseTo(groundY(W, pin('K').pos) + 1000, 9);
    expect(groundY(W, pin('K').pos)).toBeGreaterThan(0);
    expect(RELIEF).toBe(1.25);
  });
  it('pin E to pin K is 1.44 miles in W', () => {
    const e = worldOfMiles(W, pin('E').pos), k = worldOfMiles(W, pin('K').pos), d = Math.hypot(e[0] - k[0], e[1] - k[1]);
    expect(Math.abs(d / (1.44 * MI_FT) - 1)).toBeLessThan(0.01);
    // W is centred on the region: the bounds' centre maps to the origin and east is +x, south is +z
    close(worldOfMiles(W, [(W.bounds.minX + W.bounds.maxX) / 2, (W.bounds.minY + W.bounds.maxY) / 2]), [0, 0]);
    expect(worldOfMiles(W, [W.bounds.maxX, W.bounds.maxY])[0]).toBeGreaterThan(0);
    expect(worldOfMiles(W, [W.bounds.maxX, W.bounds.maxY])[1]).toBeGreaterThan(0);
  });
  it('flattenWeight is 1 on and just past the map, 0 beyond 900 ft, and falls smoothly between', () => {
    const b = { minX: 0, minZ: 0, maxX: 100, maxZ: 50 };
    expect(flattenWeight(b, 50, 25)).toBe(1);
    expect(flattenWeight(b, 100 + 120, 25)).toBe(1);
    expect(flattenWeight(b, 100 + 900, 25)).toBe(0);
    expect(flattenWeight(b, -2000, 25)).toBe(0);
    let last = 1; for (let d = 120; d <= 900; d += 10) { const w = flattenWeight(b, 100 + d, 25); expect(w).toBeLessThanOrEqual(last); last = w; }
    expect(flattenWeight(b, 100 + 510, 25)).toBeCloseTo(0.5, 9);
    expect(flattenWeight(b, 100 + 1000, 25, true)).toBeGreaterThan(0); // a crag falls away farther out
    expect(flattenWeight(b, 100 + 1400, 25, true)).toBe(0);
  });
  it('roadExit leaves from the far end of the map\'s own road, else the map\'s edge', () => {
    const b = { minX: 0, minZ: 0, maxX: 400, maxZ: 200 };
    close(roadExit(b, [], 0), [400, 100]); // east edge
    close(roadExit(b, [], Math.PI / 2), [200, 200]); // south edge
    close(roadExit(b, [[[180, 90], [400, 90], [400, 110], [180, 110]]], 0), [400, 100]); // the road's east end
    close(roadExit(b, [[[190, 90], [210, 90], [210, 110], [190, 110]]], 0), [400, 100]); // too short to count: the edge
  });
});
