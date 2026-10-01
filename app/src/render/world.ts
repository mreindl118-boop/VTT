// Renderer, camera, controls, CSS labels. Renders on demand (battery on iPad).
import * as THREE from 'three';
import type { Theme } from '../campaigns';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

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
  mistFloor!: THREE.Mesh;
  private tween: { t0: number; dur: number; from: THREE.Vector3; to: THREE.Vector3; camFrom: THREE.Vector3; camTo: THREE.Vector3 } | null = null;
  /** Yaw in quarter turns (0..3); the camera sits south-east of the target at yaw 0. */
  yaw = 0;
  /** Tilt: 0 = tabletop (~52°), 1 = top-down. */
  tilt = 0;
  onFrame: (() => void) | null = null;
  onCamera: (() => void) | null = null;

  constructor(private host: HTMLElement) {
    // A logarithmic depth buffer: a town a mile across and mountains ten miles off share one view without the ground fighting the apron.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true, logarithmicDepthBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.localClippingEnabled = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.classList.add('gl');

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.classList.add('labels');
    host.appendChild(this.labelRenderer.domElement);

    // The map sits in a misty space, not a black void: transparent clear over a CSS gradient, distance fog, a wide mist floor.
    this.renderer.setClearColor(0x000000, 0);
    this.scene.fog = new THREE.FogExp2('#2b2733', 0.0032);
    const mistFloor = new THREE.Mesh(new THREE.CircleGeometry(420, 48), new THREE.MeshBasicMaterial({ color: '#2a2631', transparent: true, opacity: 0.9 }));
    mistFloor.rotation.x = -Math.PI / 2; mistFloor.position.y = -1.2; mistFloor.userData.role = 'marker'; mistFloor.name = 'mist-floor';
    this.scene.add(mistFloor);
    this.mistFloor = mistFloor;
    this.camera = new THREE.PerspectiveCamera(40, 1, 2, 120000);
    this.camera.position.set(30, 70, 90);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1; // more glide, less snap
    // Tabletop rig: the tilt stays in a comfortable band; yaw turns in 90° steps from the buttons, not by gesture.
    this.controls.minPolarAngle = Math.PI * 0.05;
    this.controls.maxPolarAngle = Math.PI * 0.4;
    this.controls.enableRotate = true;   // right-drag / two-finger twist; the buttons turn in 90° steps
    this.controls.rotateSpeed = 0.6;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 400;
    this.controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    this.controls.addEventListener('change', () => { this.invalidate(); this.onCamera?.(); });

    this.hemi = new THREE.HemisphereLight('#c8ccd8', '#3a3138', 1.6);
    this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight('#f0e2c8', 1.1);
    this.key.position.set(-40, 90, 50);
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

  outdoor = false;
  /** Outdoors the camera may drop lower toward the horizon. */
  /** Fog density: thinner outdoors, where maps are hundreds of feet across. */
  theme: Theme = { id: 'gothic', mist: '#2b2733', page0: '#3a3242', page1: '#1e1a24', skyLight: '#c8ccd8', groundLight: '#3a3138', hemi: 1.6, key: 1.1, keyColor: '#f0e2c8', fogOut: 0.0011, fogIn: 0.0032, apron: '#2e3a31', forest: ['#1d3325', '#243c2c'] };
  /** Big maps (a town a mile across) thin the fog, or the far side would vanish into mist from a framing camera. */
  fogScale = 1;
  /** The mist can be switched off for a clear view; the density stays whatever the map and theme want. */
  fogOn = true;
  get fogDensity(): number { return this.fogOn ? (this.outdoor ? this.theme.fogOut : this.theme.fogIn) * this.fogScale : 0; }
  setFog(on: boolean): void { this.fogOn = on; if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.density = this.fogDensity; this.mistFloor.visible = on && this.mistFloor.visible; this.invalidate(); }
  /** A campaign's look: mist colour, page gradient, light colours and strengths. */
  setTheme(t: Theme): void {
    this.theme = t;
    if (this.scene.fog instanceof THREE.FogExp2) { this.scene.fog.color.set(t.mist); this.scene.fog.density = this.fogDensity; }
    (this.mistFloor.material as THREE.MeshBasicMaterial).color.set(t.mist);
    this.hemi.color.set(t.skyLight); this.hemi.groundColor.set(t.groundLight); this.key.color.set(t.keyColor);
    this.baseHemi = t.hemi; this.baseKey = t.key; this.setWorkLight(this.workK);
    this.host.style.setProperty('--page0', t.page0); this.host.style.setProperty('--page1', t.page1);
    this.invalidate();
  }
  private baseHemi = 1.6; private baseKey = 1.1; private workK = 0;
  /** The hour's sky: sun or moon direction, light colours and strengths, the mist and the page behind the map. */
  setSky(s: { azimuth: number; elevation: number; key: number; keyColor: string; hemi: number; skyLight: string; groundLight: string; mist: string; page0: string; page1: string }, outdoor: boolean): void {
    if (outdoor) {
      const r = 120, e = s.elevation;
      this.key.position.set(Math.cos(s.azimuth) * Math.cos(e) * r, Math.max(12, Math.sin(e) * r), Math.sin(s.azimuth) * Math.cos(e) * r);
      this.key.color.set(s.keyColor); this.hemi.color.set(s.skyLight); this.hemi.groundColor.set(s.groundLight);
      this.baseHemi = s.hemi; this.baseKey = s.key;
    } else { this.key.position.set(-40, 90, 50); this.hemi.color.set(this.theme.skyLight); this.hemi.groundColor.set(this.theme.groundLight); this.key.color.set(this.theme.keyColor); this.baseHemi = this.theme.hemi; this.baseKey = this.theme.key; }
    this.setWorkLight(this.workK);
    if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.color.set(s.mist);
    (this.mistFloor.material as THREE.MeshBasicMaterial).color.set(s.mist);
    this.host.style.setProperty('--page0', s.page0); this.host.style.setProperty('--page1', s.page1);
    this.invalidate();
  }
  setOutdoor(on: boolean): void {
    this.outdoor = on; this.controls.maxPolarAngle = Math.PI * (on ? 0.46 : 0.4);
    if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.density = this.fogDensity;
    this.invalidate();
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

  /** Camera offset from the target for the current azimuth (free, from the gesture) and tilt band. */
  private rigOffset(dist: number, azimuthDelta = 0): THREE.Vector3 {
    // Angle from vertical: ~49° tabletop indoors, ~61° outdoors so the horizon shows; near-vertical top-down.
    const pitch = this.tilt ? Math.PI * 0.06 : this.outdoor ? Math.PI * 0.34 : Math.PI * 0.27;
    const a = this.controls.getAzimuthalAngle() + azimuthDelta;
    return new THREE.Vector3(Math.sin(pitch) * Math.sin(a) * dist, Math.cos(pitch) * dist, Math.sin(pitch) * Math.cos(a) * dist);
  }

  /** Frame a plan-space box (bounding-sphere fit, leaving room for the chrome). */
  frame(box: { minX: number; minZ: number; maxX: number; maxZ: number }, y: number, preset: CameraPreset, animate = false): void {
    this.tilt = preset === 'top' ? 1 : 0;
    const cx = (box.minX + box.maxX) / 2, cz = (box.minZ + box.maxZ) / 2;
    const r = Math.hypot(box.maxX - box.minX, box.maxZ - box.minZ) / 2 + 4;
    const vHalf = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * this.camera.aspect);
    const d = Math.min(this.controls.maxDistance, Math.max(36, (r / Math.sin(Math.min(vHalf, hHalf))) * 1.0));
    this.moveTo(new THREE.Vector3(cx, y, cz), d, animate);
  }

  /** Point the rig at a plan position, keeping (or setting) the distance. */
  moveTo(target: THREE.Vector3, dist = this.camera.position.distanceTo(this.controls.target), animate = true, azimuthDelta = 0): void {
    const camTo = target.clone().add(this.rigOffset(dist, azimuthDelta));
    if (!animate) {
      this.tween = null; // an instant move cancels any glide still in flight
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
    this.moveTo(this.controls.target.clone(), undefined, true, (steps * Math.PI) / 2);
  }
  setTilt(top: boolean): void { this.tilt = top ? 1 : 0; this.moveTo(this.controls.target.clone()); }
  zoomBy(factor: number): void { this.moveTo(this.controls.target.clone(), THREE.MathUtils.clamp(this.camera.position.distanceTo(this.controls.target) * factor, this.controls.minDistance, this.controls.maxDistance)); }

  /** DM work light: lifts the scene so the DM can read unlit rooms; players keep the true darkness. */
  setWorkLight(k: number): void {
    this.workK = k;
    this.hemi.intensity = this.baseHemi + 1.8 * k;
    this.key.intensity = this.baseKey + 0.6 * k;
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
