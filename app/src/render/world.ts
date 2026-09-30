// Renderer, camera, controls, CSS labels. Renders on demand (battery on iPad).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { PALETTE } from '../kit/palette';

export type CameraPreset = 'tabletop' | 'top';

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly labelRenderer: CSS2DRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly hemi: THREE.HemisphereLight;
  readonly key: THREE.DirectionalLight;
  private dirty = true;
  private frames = 0;
  private fpsT = performance.now();
  fps = 0;
  private tween: { t0: number; dur: number; from: THREE.Vector3; to: THREE.Vector3; camFrom: THREE.Vector3; camTo: THREE.Vector3 } | null = null;
  /** Yaw in quarter turns (0..3); the camera sits south-east of the target at yaw 0. */
  yaw = 0;
  /** Tilt: 0 = tabletop (~52°), 1 = top-down. */
  tilt = 0;
  onFrame: (() => void) | null = null;
  onCamera: (() => void) | null = null;

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.classList.add('gl');

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.classList.add('labels');
    host.appendChild(this.labelRenderer.domElement);

    this.scene.background = new THREE.Color(PALETTE.fog);
    this.camera = new THREE.PerspectiveCamera(35, 1, 2, 4000);
    this.camera.position.set(30, 70, 90);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.18;
    // Tabletop rig: the tilt stays in a comfortable band; yaw turns in 90° steps from the buttons, not by gesture.
    this.controls.minPolarAngle = Math.PI * 0.05;
    this.controls.maxPolarAngle = Math.PI * 0.4;
    this.controls.enableRotate = false;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 400;
    this.controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    this.controls.addEventListener('change', () => { this.invalidate(); this.onCamera?.(); });

    this.hemi = new THREE.HemisphereLight('#b9c3d6', '#2a2530', 1.4);
    this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight('#c9d2e6', 0.9);
    this.key.position.set(-40, 80, 30);
    this.scene.add(this.key);

    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    const loop = () => {
      requestAnimationFrame(loop);
      this.onFrame?.();
      if (this.tween) { this.stepTween(); }
      if (this.controls.enableDamping && this.controls.update()) this.dirty = true;
      if (!this.dirty) return;
      this.dirty = false;
      this.renderNow();
    };
    requestAnimationFrame(loop);
  }

  invalidate(): void { this.dirty = true; }

  renderNow(): void {
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
    this.frames++;
    const now = performance.now();
    if (now - this.fpsT > 1000) { this.fps = (this.frames * 1000) / (now - this.fpsT); this.frames = 0; this.fpsT = now; }
  }

  resize(): void {
    const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.labelRenderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.invalidate();
  }

  private rigOffset(dist: number): THREE.Vector3 {
    const pitch = this.tilt ? Math.PI * 0.06 : Math.PI * 0.25; // angle from vertical: 45° tabletop, near-vertical top-down
    const a = (this.yaw * Math.PI) / 2 + Math.PI / 4;
    return new THREE.Vector3(Math.sin(pitch) * Math.cos(a) * dist, Math.cos(pitch) * dist, Math.sin(pitch) * Math.sin(a) * dist);
  }

  /** Frame a plan-space box (bounding-sphere fit, leaving room for the chrome). */
  frame(box: { minX: number; minZ: number; maxX: number; maxZ: number }, y: number, preset: CameraPreset, animate = false): void {
    this.tilt = preset === 'top' ? 1 : 0;
    const cx = (box.minX + box.maxX) / 2, cz = (box.minZ + box.maxZ) / 2;
    const r = Math.hypot(box.maxX - box.minX, box.maxZ - box.minZ) / 2 + 4;
    const vHalf = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * this.camera.aspect);
    const d = Math.min(this.controls.maxDistance, Math.max(this.controls.minDistance, (r / Math.sin(Math.min(vHalf, hHalf))) * 0.82));
    this.moveTo(new THREE.Vector3(cx, y, cz), d, animate);
  }

  /** Point the rig at a plan position, keeping (or setting) the distance. */
  moveTo(target: THREE.Vector3, dist = this.camera.position.distanceTo(this.controls.target), animate = true): void {
    const camTo = target.clone().add(this.rigOffset(dist));
    if (!animate) {
      this.controls.target.copy(target); this.camera.position.copy(camTo); this.camera.lookAt(target); this.controls.update(); this.invalidate();
      return;
    }
    this.tween = { t0: performance.now(), dur: 420, from: this.controls.target.clone(), to: target, camFrom: this.camera.position.clone(), camTo };
    this.invalidate();
  }

  private stepTween(): void {
    const tw = this.tween!;
    const k = Math.min(1, (performance.now() - tw.t0) / tw.dur), e = 1 - Math.pow(1 - k, 3);
    this.controls.target.lerpVectors(tw.from, tw.to, e);
    this.camera.position.lerpVectors(tw.camFrom, tw.camTo, e);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
    this.dirty = true;
    if (k >= 1) { this.tween = null; this.onCamera?.(); }
  }

  rotate(steps: number): void {
    this.yaw = ((this.yaw + steps) % 4 + 4) % 4;
    this.moveTo(this.controls.target.clone());
  }
  setTilt(top: boolean): void { this.tilt = top ? 1 : 0; this.moveTo(this.controls.target.clone()); }
  zoomBy(factor: number): void { this.moveTo(this.controls.target.clone(), THREE.MathUtils.clamp(this.camera.position.distanceTo(this.controls.target) * factor, this.controls.minDistance, this.controls.maxDistance)); }

  /** DM work light: lifts the scene so the DM can read unlit rooms; players keep the true darkness. */
  setWorkLight(k: number): void {
    this.hemi.intensity = 1.4 + 2.2 * k;
    this.key.intensity = 0.9 + 0.8 * k;
    this.invalidate();
  }

  label(text: string, sub: string | undefined, cls: string): CSS2DObject {
    const el = document.createElement('div');
    el.className = `lbl ${cls}`;
    el.textContent = text;
    if (sub) { const s = document.createElement('span'); s.textContent = sub; el.appendChild(s); }
    const o = new CSS2DObject(el);
    return o;
  }
}
