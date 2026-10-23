import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { World } from '../app/src/render/world';

// Exercise the real camera and OrbitControls without constructing a WebGL renderer.
function rig(azimuth = 2.7, pitch = 0.72, distance = 173): World {
  const camera = new THREE.PerspectiveCamera(40, 1, 2, 120000);
  const controls = new OrbitControls(camera);
  controls.target.set(47, 13, -81);
  camera.position.copy(controls.target).add(new THREE.Vector3().setFromSphericalCoords(distance, pitch, azimuth));
  controls.update(); controls.enableDamping = true;
  return Object.assign(Object.create(World.prototype), { camera, controls, scene: new THREE.Scene(), anchor: new THREE.Vector3(), root: new THREE.Group(), mistFloor: new THREE.Object3D(), tween: null });
}
function finish(w: World, at: number): void {
  vi.spyOn(performance, 'now').mockReturnValue(at);
  (w as unknown as { stepTween(): void }).stepTween();
}
function invariant(w: World, target: THREE.Vector3, distance: number, pitch: number): void {
  expect(w.controls.target.distanceTo(target)).toBeLessThan(1e-9);
  expect(w.camera.position.distanceTo(target)).toBeCloseTo(distance, 9);
  expect(w.controls.getPolarAngle()).toBeCloseTo(pitch, 9);
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('compass north alignment', () => {
  it('lets a zoom button take over an alignment at the current heading', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    const w=rig(); w.alignNorth(); finish(w,1100);
    const heading=w.controls.getAzimuthalAngle(), pitch=w.controls.getPolarAngle(), d=w.camera.position.distanceTo(w.controls.target);
    w.zoomBy(1.1); finish(w,1800);
    expect(w.controls.getAzimuthalAngle()).toBeCloseTo(heading,8);
    expect(w.controls.getPolarAngle()).toBeCloseTo(pitch,8);
    expect(w.camera.position.distanceTo(w.controls.target)).toBeCloseTo(d*1.1,8);
  });
  it('follows the shortest arc and preserves the target, distance and pitch at every frame', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    const w = rig(), target = w.controls.target.clone(), distance = w.camera.position.distanceTo(target), pitch = w.controls.getPolarAngle();
    w.alignNorth();
    expect(w.flying).toBe(true);
    invariant(w, target, distance, pitch);
    const angles: number[] = [];
    for (const elapsed of [42, 105, 210, 315, 420]) {
      finish(w, 1000 + elapsed); invariant(w, target, distance, pitch);
      angles.push(w.controls.getAzimuthalAngle());
    }
    expect(angles.every((a, i) => a >= -1e-9 && a < (i ? angles[i - 1] : 2.7))).toBe(true);
    expect(angles.at(-1)).toBeCloseTo(0, 9);
    expect(w.flying).toBe(false);
  });

  it.each(['-z', '+z', '-x', '+x'] as const)('aligns a %s level after its nested placement rotates it', (north) => {
    const n = north === '+z' ? [0, 1] : north === '-x' ? [-1, 0] : north === '+x' ? [1, 0] : [0, -1];
    const direction = new THREE.Vector3(n[0], 0, n[1]).transformDirection(new THREE.Matrix4().makeRotationY(0.63));
    const w = rig(-2.8, 0.41), target = w.controls.target.clone(), distance = w.camera.position.distanceTo(target), pitch = w.controls.getPolarAngle();
    w.alignNorth(direction, false);
    const up = w.controls.target.clone().sub(w.camera.position).setY(0).normalize();
    expect(up.distanceTo(direction)).toBeLessThan(1e-9);
    invariant(w, target, distance, pitch);
    expect(w.flying).toBe(false);
  });

  it('honors reduced motion and cancels a prior glide at the current view', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    const w = rig(), target = w.controls.target.clone(), distance = w.camera.position.distanceTo(target), pitch = w.controls.getPolarAngle();
    w.flyTo(new THREE.Vector3(400, 0, 600), 900);
    w.alignNorth();
    expect(w.flying).toBe(false);
    expect(w.controls.getAzimuthalAngle()).toBeCloseTo(0, 9);
    invariant(w, target, distance, pitch);
  });

  it('keeps an in-flight alignment unchanged by a floating-origin reanchor', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    const w = rig(), absoluteTarget = w.toAbsolute(w.controls.target), distance = w.camera.position.distanceTo(w.controls.target), pitch = w.controls.getPolarAngle();
    w.alignNorth(); finish(w, 1120);
    w.reanchor(new THREE.Vector3(14000, 250, -9000));
    finish(w, 1420);
    expect(w.toAbsolute(w.controls.target).distanceTo(absoluteTarget)).toBeLessThan(1e-9);
    invariant(w, w.toAnchored(absoluteTarget), distance, pitch);
    expect(w.controls.getAzimuthalAngle()).toBeCloseTo(0, 9);
  });

  it('clears pending drag inertia without moving the target or changing the final heading', () => {
    const w = rig(), target = w.controls.target.clone(), distance = w.camera.position.distanceTo(target), pitch = w.controls.getPolarAngle();
    // A real OrbitControls gesture leaves these deltas to decay over later frames.
    const inertia = w.controls as unknown as { _sphericalDelta: THREE.Spherical; _panOffset: THREE.Vector3 };
    inertia._sphericalDelta.theta = 0.3; inertia._sphericalDelta.phi = 0.1; inertia._panOffset.set(3, 0, 4);
    w.alignNorth(undefined, false);
    for (let i = 0; i < 10; i++) w.controls.update();
    invariant(w, target, distance, pitch);
    expect(w.controls.getAzimuthalAngle()).toBeCloseTo(0, 9);
    expect(w.controls.enableDamping).toBe(true);
  });
});
