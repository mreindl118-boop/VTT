// Renderer, camera, controls, CSS labels. Renders on demand (battery on iPad).
import * as THREE from 'three';
import type { Theme } from '../campaigns';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export type CameraPreset = 'tabletop' | 'iso' | 'top';
const TILT: Record<CameraPreset, number> = { tabletop: 0, top: 1, iso: 2 };
const ISO_PITCH = Math.PI / 2 - Math.atan(Math.SQRT1_2); // 35.26° above the horizon: true isometric

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
  /** Everything placed in the world hangs from here. Its position is −anchor (a floating origin): scenes sit under it at
   *  their absolute world positions (feet), and the active scene's root comes out at the origin, so its vertices, the
   *  camera and every shader see small numbers however far across the valley the map stands. */
  readonly root = new THREE.Group();
  /** The absolute world point drawn at the origin (feet). */
  readonly anchor = new THREE.Vector3();
  /** Continuous-world camera: the whole valley in range (see setNested). Off by default. */
  nested = false;
  /** A glide in flight; `rise` lifts the eye over the middle of a long one (a cross-valley flight rises, then dives). */
  private tween: { t0: number; dur: number; from: THREE.Vector3; to: THREE.Vector3; camFrom: THREE.Vector3; camTo: THREE.Vector3; rise?: number } | null = null;
  /** Yaw in quarter turns (0..3); the camera sits south-east of the target at yaw 0. */
  yaw = 0;
  /** Tilt: 0 = tabletop (~52°), 1 = top-down. */
  tilt = 0;
  onFrame: (() => void) | null = null;
  onCamera: (() => void) | null = null;
  /** A zoom out (button, wheel or pinch) asked for at the far limit: the UI offers the map one level up. */
  onZoomPastMax: (() => void) | null = null;
  /** The page's panels over the view, in client pixels (the UI sets it): `bars` run along an edge (the top bar, the
   *  camera buttons, the side slider) and frame what the camera fits; `panels` are everything that covers the view
   *  (bars, the minimap, the scale), which place names keep clear of. */
  chrome: () => { bars: DOMRect[]; panels: DOMRect[] } = () => ({ bars: [], panels: [] });

  constructor(private host: HTMLElement) {
    // A logarithmic depth buffer: a town a mile across and mountains ten miles off share one view without the ground fighting the apron.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true, logarithmicDepthBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); // 1.5 keeps a Retina iPad sharp at half the fragments of 2
    this.renderer.localClippingEnabled = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.classList.add('gl');

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.classList.add('labels');
    host.appendChild(this.labelRenderer.domElement);
    // A wheel turned over a label that takes the pointer (a door, a stair) still zooms: it is passed on to the canvas,
    // where OrbitControls and the far-limit check listen. (The valley's place names take no pointer at all.)
    this.labelRenderer.domElement.addEventListener('wheel', (e) => {
      if (e.target === this.renderer.domElement || !e.isTrusted) return;
      e.preventDefault(); e.stopPropagation();
      this.renderer.domElement.dispatchEvent(new WheelEvent('wheel', e));
    }, { passive: false });

    // The map sits in a misty space, not a black void: transparent clear over a CSS gradient, distance fog, a wide mist floor.
    this.renderer.setClearColor(0x000000, 0);
    this.scene.fog = new THREE.FogExp2('#2b2733', 0.0032);
    const mistFloor = new THREE.Mesh(new THREE.CircleGeometry(420, 48), new THREE.MeshBasicMaterial({ color: '#2a2631', transparent: true, opacity: 0.9 }));
    mistFloor.rotation.x = -Math.PI / 2; mistFloor.position.y = -1.2; mistFloor.userData.role = 'marker'; mistFloor.name = 'mist-floor';
    this.scene.add(mistFloor);
    this.mistFloor = mistFloor;
    this.root.name = 'world-root';
    this.scene.add(this.root);
    this.camera = new THREE.PerspectiveCamera(40, 1, 2, 120000);
    this.camera.position.set(30, 70, 90);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1; // more glide, less snap
    // Tabletop rig: the tilt stays in a comfortable band; yaw turns in 90° steps from the buttons, not by gesture.
    this.controls.minPolarAngle = 0; // straight down is allowed
    this.controls.maxPolarAngle = Math.PI * 0.4;
    this.controls.enableRotate = true;   // right-drag / two-finger twist; the buttons turn in 90° steps
    this.controls.rotateSpeed = 0.6;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 400;
    this.controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    this.controls.zoomToCursor = true; // the wheel and a pinch zoom toward the pointer, not the middle of the screen
    // Ahead of OrbitControls (capture on the host): a wheel turn during a glide, and one past the far limit.
    host.addEventListener('wheel', this.wheel, { capture: true, passive: false });
    this.watchPinch();
    this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    // the user's own hand on the camera: a drag or a pinch while it moves, a wheel turn (the streamer starts no build then)
    this.controls.addEventListener('start', () => { this.dragging = true; });
    this.controls.addEventListener('end', () => { this.dragging = false; });
    this.controls.addEventListener('change', () => { this.lastChange = performance.now(); if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.density = this.fogDensity; if (this.nested) this.applyPolar(); this.invalidate(); this.onCamera?.(); });

    this.hemi = new THREE.HemisphereLight('#c8ccd8', '#3a3138', 1.6);
    this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight('#f0e2c8', 1.1);
    this.key.position.set(-40, 90, 50);
    this.scene.add(this.key);
    this.lampPad.name = 'lamp-pad';
    this.scene.add(this.lampPad);
    // every render (the corner-pixel warm-ups too) first evens out the lamp count
    this.scene.onBeforeRender = (_r, _s, cam) => this.padLamps(cam);

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
  /** Mist thins as the camera pulls back, so the map itself stays legible from any height and only the land beyond it fades. */
  get fogDensity(): number {
    const d = this.camera ? this.camera.position.distanceTo(this.controls.target) : 300;
    // the continuous world lets the mist thin much further (to 0.0008, the whole valley from 325,000 ft), so the mist
    // between the eye and the ground stays as thick as it is over a map and the far mountains haze instead of
    // vanishing (identical below ~2,170 ft)
    const pullBack = THREE.MathUtils.clamp(260 / Math.max(1, d), this.nested ? 0.0008 : 0.12, 1);
    return this.fogOn ? (this.outdoor ? this.theme.fogOut : this.theme.fogIn) * this.fogScale * pullBack : 0;
  }
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
    this.outdoor = on; this.applyPolar();
    if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.density = this.fogDensity;
    this.invalidate();
  }
  invalidate(): void { this.dirty = true; }

  /** How low the camera may drop: 0.46π outdoors, 0.4π indoors; in the continuous world the floor rises toward 0.3π
   *  as the camera climbs past 5,000 ft, so the horizon never swallows the valley. */
  private applyPolar(): void {
    const base = Math.PI * (this.outdoor ? 0.46 : 0.4);
    if (!this.nested) { this.controls.maxPolarAngle = base; return; }
    const d = this.camera.position.distanceTo(this.controls.target);
    const k = THREE.MathUtils.smoothstep(d, 5000, 20000);
    this.controls.maxPolarAngle = THREE.MathUtils.lerp(base, Math.PI * 0.3, k);
  }

  /** The continuous world's camera: far plane 300,000 ft, zoom out to 120,000 ft (the stage may allow more, to fit
   *  its whole valley), the mist thins to 0.0008 of its strength far out, the pitch floor rises with altitude. Off
   *  restores today's map camera exactly. Zoom-to-cursor is every map's (the constructor's), on or off. */
  setNested(on: boolean): void {
    this.nested = on;
    this.camera.far = on ? 300000 : 120000;
    this.camera.updateProjectionMatrix();
    this.controls.maxDistance = on ? 120000 : 400;
    this.applyPolar();
    if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.density = this.fogDensity;
    this.invalidate();
  }

  /** Move the floating origin to an absolute world point. Nothing moves on screen: the world root, the camera, its
   *  target, the mist floor and any glide in flight all shift by the same amount. */
  reanchor(abs: THREE.Vector3): void {
    const delta = this.anchor.clone().sub(abs);
    if (delta.lengthSq() === 0) return;
    this.anchor.copy(abs);
    this.root.position.copy(abs).negate();
    this.camera.position.add(delta);
    this.controls.target.add(delta);
    this.mistFloor.position.add(delta);
    const tw = this.tween;
    if (tw) { tw.from.add(delta); tw.to.add(delta); tw.camFrom.add(delta); tw.camTo.add(delta); }
    this.camera.updateMatrixWorld();
    this.root.updateMatrixWorld(true);
    this.onReanchor?.();
    this.invalidate();
  }
  /** Told after the origin moves, so whatever caches a drawn-space matrix (the app's placement, the clip plane) re-reads it. */
  onReanchor: (() => void) | null = null;
  /** An anchored (drawn) point as an absolute world point. */
  toAbsolute(v: THREE.Vector3, out = new THREE.Vector3()): THREE.Vector3 { return out.copy(v).add(this.anchor); }
  /** An absolute world point as drawn (anchored). */
  toAnchored(v: THREE.Vector3, out = new THREE.Vector3()): THREE.Vector3 { return out.copy(v).sub(this.anchor); }

  /** The user is moving the camera by hand: a drag or a pinch that moved in the last 300 ms, or a wheel turn. */
  get userMoving(): boolean { const now = performance.now(); return (this.dragging && now - this.lastChange < 300) || now - this.lastWheel < 300; }
  private dragging = false;
  private lastChange = 0;
  private lastWheel = 0;

  /** In the continuous world the shaders are always built for the same number of point lights (LAMPS): what the
   *  drawn lamps leave over is made up with dark lamps that light nothing (black, intensity 0, out of reach). A
   *  lamp-lit map becoming active (its lamps show, the last one's go) then recompiles nothing; three.js builds a
   *  program per light count, and recompiling every material of a valley at once froze the page for seconds. A map
   *  with more lamps than LAMPS in view recompiles as before. Off the valley (the legacy way) there is no pad. */
  static readonly LAMPS = 6;
  private readonly lampPad = new THREE.Group();
  padLamps(cam: THREE.Camera = this.camera): void {
    let n = 0; // the lamps this camera draws (a warm-up's camera sees only its own layer)
    if (this.nested) this.scene.traverseVisible((o) => { if ((o as THREE.PointLight).isPointLight && o.parent !== this.lampPad && o.layers.test(cam.layers)) n++; });
    const want = this.nested ? Math.max(0, World.LAMPS - n) : 0, pad = this.lampPad.children;
    while (pad.length < want) {
      const l = new THREE.PointLight(0x000000, 0, 1, 2);
      l.layers.enableAll(); // drawn for every camera (the warm-ups draw on their own layer)
      l.position.set(0, -1e6, 0);
      this.lampPad.add(l); l.updateMatrixWorld(true);
    }
    pad.forEach((l, i) => { l.visible = i < want; });
  }

  /** Run before every render (the world stage's sky follows the eye). */
  readonly beforeRender = new Set<() => void>();
  renderNow(): void {
    for (const f of this.beforeRender) f();
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
  rigOffset(dist: number, azimuthDelta = 0): THREE.Vector3 {
    // Angle from vertical: ~49° tabletop indoors, ~61° outdoors so the horizon shows; near-vertical top-down.
    const pitch = this.tilt === 1 ? Math.PI * 0.02 : this.tilt === 2 ? ISO_PITCH : this.outdoor ? Math.PI * 0.34 : Math.PI * 0.27;
    let a = this.controls.getAzimuthalAngle() + azimuthDelta;
    // The snapped rigs: overhead squares to a cardinal, isometric to a diagonal of the grid.
    if (this.tilt === 1) a = Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
    else if (this.tilt === 2) a = Math.round((a - Math.PI / 4) / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 4;
    return new THREE.Vector3(Math.sin(pitch) * Math.sin(a) * dist, Math.cos(pitch) * dist, Math.sin(pitch) * Math.cos(a) * dist);
  }

  /** Frame a plan-space box (bounding-sphere fit, leaving room for the chrome). 'fly' glides there as flyTo does;
   *  azimuthDelta turns the heading too. */
  frame(box: { minX: number; minZ: number; maxX: number; maxZ: number }, y: number, preset: CameraPreset, animate: boolean | 'fly' = false, azimuthDelta = 0): void {
    this.tilt = TILT[preset];
    const cx = (box.minX + box.maxX) / 2, cz = (box.minZ + box.maxZ) / 2;
    const r = Math.hypot(box.maxX - box.minX, box.maxZ - box.minZ) / 2 + 4;
    const vHalf = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * this.camera.aspect);
    const d = Math.min(this.controls.maxDistance, Math.max(36, (r / Math.sin(Math.min(vHalf, hHalf))) * 0.86));
    if (animate === 'fly') { this.flyTo(new THREE.Vector3(cx, y, cz), d); return; }
    this.moveTo(new THREE.Vector3(cx, y, cz), d, animate, azimuthDelta);
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

  /** Glide to a target (anchored) at a distance; the time grows with how far the zoom changes (log of the distance
   *  ratio), 420–900 ms, unless given. */
  flyTo(target: THREE.Vector3, dist = this.camera.position.distanceTo(this.controls.target), ms?: number): void {
    const from = Math.max(1, this.camera.position.distanceTo(this.controls.target));
    const d = THREE.MathUtils.clamp(dist, this.controls.minDistance, this.controls.maxDistance);
    const travel = this.controls.target.distanceTo(target) / Math.max(d, from);
    const dur = ms ?? flightMs(from, d, travel);
    this.moveTo(target, d, true);
    this.flights++;
    // across the valley the eye climbs over the middle of the flight, so the land between unrolls below and the glide
    // dives onto the new place instead of skimming the ridges
    if (this.tween) { this.tween.dur = Math.max(1, dur); this.tween.rise = Math.max(0, this.controls.target.distanceTo(target) * 0.45 - Math.max(d, from)); }
  }

  private stepTween(): void {
    const tw = this.tween!;
    const k = Math.min(1, (performance.now() - tw.t0) / tw.dur), e = 1 - Math.pow(1 - k, 3);
    this.controls.target.lerpVectors(tw.from, tw.to, e);
    this.camera.position.lerpVectors(tw.camFrom, tw.camTo, e);
    if (tw.rise) this.camera.position.y += tw.rise * 4 * e * (1 - e);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
    this.dirty = true;
    if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.density = this.fogDensity;
    if (k >= 1) { this.tween = null; this.onCamera?.(); }
  }

  rotate(steps: number): void {
    this.moveTo(this.controls.target.clone(), undefined, true, steps * (this.tilt === 2 ? Math.PI / 2 : Math.PI / 2));
  }
  setTilt(top: boolean): void { this.setPreset(top ? 'top' : 'tabletop'); }
  /** Tabletop (free turn), isometric (snapped to the grid's diagonals) or overhead (north up, square to the grid). */
  setPreset(preset: CameraPreset): void { this.tilt = TILT[preset]; this.moveTo(this.controls.target.clone()); }
  get preset(): CameraPreset { return this.tilt === 1 ? 'top' : this.tilt === 2 ? 'iso' : 'tabletop'; }
  /** Where the camera is headed: the end of the glide in flight, else where it stands. */
  private aim(): { target: THREE.Vector3; cam: THREE.Vector3 } {
    return this.tween ? { target: this.tween.to, cam: this.tween.camTo } : { target: this.controls.target, cam: this.camera.position };
  }
  /** At the far limit, or gliding to it. */
  get atMaxDistance(): boolean { const a = this.aim(); return a.cam.distanceTo(a.target) >= this.controls.maxDistance * 0.995; }
  /** Zoom by a factor of the distance the camera is headed for, so presses during a glide add up instead of being lost.
   *  A zoom out at the far limit asks for the map one level up instead. */
  zoomBy(factor: number): void {
    if (factor > 1 && this.atMaxDistance) { this.onZoomPastMax?.(); return; }
    const a = this.aim(), off = a.cam.clone().sub(a.target);
    const dist = THREE.MathUtils.clamp(off.length() * factor, this.controls.minDistance, this.controls.maxDistance);
    this.moveTo(a.target.clone(), dist, true, Math.atan2(off.x, off.z) - this.controls.getAzimuthalAngle());
  }
  /** The wheel, ahead of OrbitControls. During a glide it changes where the glide is going, scaled about the ground
   *  under the cursor as the glide's end will see it (else the glide would undo it); otherwise OrbitControls zooms
   *  toward the cursor. A turn outward at the far limit asks for the map one level up. */
  private wheel = (e: WheelEvent): void => {
    if (e.target !== this.renderer.domElement || !this.controls.enabled || !this.controls.enableZoom || !e.deltaY) return;
    this.lastWheel = performance.now();
    if (e.deltaY > 0 && this.atMaxDistance) this.onZoomPastMax?.();
    const tw = this.tween; if (!tw) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const s = Math.pow(0.95, this.controls.zoomSpeed * Math.abs(e.deltaY * 0.01)), off = tw.camTo.clone().sub(tw.to); // OrbitControls' step
    const f = THREE.MathUtils.clamp(off.length() * (e.deltaY < 0 ? s : 1 / s), this.controls.minDistance, this.controls.maxDistance) / off.length();
    const eye = this.camera.clone(); eye.position.copy(tw.camTo); eye.lookAt(tw.to); eye.updateMatrixWorld();
    const r = this.renderer.domElement.getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), eye);
    const p = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -tw.to.y), new THREE.Vector3()) ?? tw.to.clone();
    this.tween = { t0: performance.now(), dur: tw.dur, from: this.controls.target.clone(), to: p.clone().lerp(tw.to, f), camFrom: this.camera.position.clone(), camTo: p.clone().lerp(tw.camTo, f) };
    this.invalidate();
  };
  /** A pinch that keeps closing at the far limit asks for the map one level up, as the wheel and the button do. */
  private watchPinch(): void {
    const el = this.renderer.domElement, touches = new Map<number, [number, number]>();
    let spread0 = 0, asked = false;
    el.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') return; touches.set(e.pointerId, [e.clientX, e.clientY]); spread0 = 0; asked = false; });
    el.addEventListener('pointermove', (e) => {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, [e.clientX, e.clientY]);
      if (touches.size !== 2 || asked) return;
      const [a, b] = [...touches.values()], spread = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (!this.atMaxDistance) { spread0 = 0; return; }
      if (!spread0) spread0 = spread;
      else if (spread < spread0 * 0.85) { asked = true; this.onZoomPastMax?.(); }
    });
    const lift = (e: PointerEvent) => { touches.delete(e.pointerId); if (touches.size < 2) spread0 = 0; };
    el.addEventListener('pointerup', lift); el.addEventListener('pointercancel', lift);
  }

  /** DM work light: lifts the scene so the DM can read unlit rooms; players keep the true darkness. */
  setWorkLight(k: number): void {
    this.workK = k;
    this.hemi.intensity = this.baseHemi + 1.8 * k;
    this.key.intensity = this.baseKey + 0.6 * k;
    this.invalidate();
  }

  /** Get a map ready to draw without a hitch (the streamer, before it fades one in): its buffers uploaded and its
   *  shaders built a few meshes per frame by drawing them into one corner pixel of the canvas (the next frame draws
   *  over it). Lights are drawn with them (and the lamp pad evens their count) so the programs are exactly the ones the
   *  real frame uses; at most a few materials not yet drawn as they are now go in one slice (each may need a program
   *  built). compileAsync is not used: three.js's compile() does not set each material's clipping state, so for the
   *  cut walls it built programs no frame used. The root may be hidden meanwhile (it shows only for these draws).
   *  Called again with other materials on (a ghost half faded, the live ones) it builds their programs the same way.
   *  Returns the number of slices it took. Waits while `pause()` says so. */
  async upload(root: THREE.Object3D, sliceMs: number, pause: () => boolean, cancelled: () => boolean): Promise<number> {
    const PREWARM = 31, r = this.renderer, cam = this.camera.clone(), shown = root.visible;
    cam.layers.set(PREWARM);
    root.visible = true;
    const meshes: THREE.Object3D[] = [];
    root.traverseVisible((o) => { if ((o as THREE.Mesh).isMesh || (o as THREE.Line).isLine || (o as THREE.Points).isPoints) meshes.push(o); }); // (lines too: a lamp's ring)
    root.visible = shown;
    const props = r.properties as unknown as { get(m: THREE.Material): { __version?: number } };
    const fresh = (m: THREE.Object3D) => { const x = (m as THREE.Mesh).material, list = Array.isArray(x) ? x : [x]; return list.filter((k) => k && props.get(k).__version !== k.version).length; };
    const lights: THREE.Object3D[] = [];
    this.scene.traverseVisible((o) => { if ((o as THREE.Light).isLight && !o.layers.isEnabled(PREWARM)) { o.layers.enable(PREWARM); lights.push(o); } });
    let i = 0, slices = 0;
    const size = r.getSize(new THREE.Vector2()), scissor = r.getScissorTest();
    try {
      while (i < meshes.length && !cancelled()) {
        await new Promise<void>((go) => requestAnimationFrame(() => setTimeout(go, 0)));
        if (pause()) continue;
        const t0 = performance.now();
        r.setScissorTest(true); r.setScissor(0, size.y - 1, 1, 1);
        while (i < meshes.length && performance.now() - t0 < sliceMs) {
          // about a megabyte and a half of vertices a draw (one pass over the scene for many small meshes)
          const batch: THREE.Object3D[] = [];
          for (let bytes = 0, mats = 0; i < meshes.length && bytes < 1.5e6 && mats < 3;) {
            const m = meshes[i++], g = (m as THREE.Mesh).geometry;
            mats += fresh(m);
            for (const a of Object.values(g.attributes)) bytes += (a as THREE.BufferAttribute).array?.byteLength ?? 0;
            m.layers.enable(PREWARM); batch.push(m);
          }
          // drawn whole, wherever it is on screen (a mesh off the view would otherwise upload on its first frame)
          const culled = batch.map((m) => m.frustumCulled), was = root.visible;
          for (const m of batch) m.frustumCulled = false;
          root.visible = true; r.render(this.scene, cam); root.visible = was;
          batch.forEach((m, k) => { m.layers.disable(PREWARM); m.frustumCulled = culled[k]; });
        }
        r.setScissor(0, 0, size.x, size.y); r.setScissorTest(scissor);
        slices++;
        this.invalidate();
      }
    } finally {
      for (const l of lights) l.layers.disable(PREWARM);
      r.setScissor(0, 0, size.x, size.y); r.setScissorTest(scissor);
    }
    return slices;
  }

  /** The glide in flight, if any (tests and the streamer read it). */
  get flying(): boolean { return !!this.tween; }
  /** How many glides flyTo has started (tests read it: a glide may end before anyone looks). */
  flights = 0;
  /** Resolves once no glide is in flight (at once if none is), or after 4 s whatever happens (a hidden tab draws no
   *  frames, so its glide waits for the page to show again). */
  settled(): Promise<void> {
    const end = performance.now() + 4000;
    return new Promise((done) => { const f = () => (this.tween && performance.now() < end ? setTimeout(f, 16) : done()); f(); });
  }

  label(text: string, sub: string | undefined, cls: string, page?: number): CSS2DObject {
    const el = document.createElement('div');
    el.className = `lbl ${cls}`;
    el.textContent = text;
    if (sub) { const s = document.createElement('span'); s.textContent = sub; el.appendChild(s); }
    if (page) { const i = document.createElement('i'); i.textContent = `p.${page}`; el.appendChild(i); }
    const o = new CSS2DObject(el);
    return o;
  }
}

/** A flight's duration: 420 ms for a short hop, growing with the log of the zoom ratio and with the ground covered
 *  (in screen widths), capped at 900 ms. */
export function flightMs(fromDist: number, toDist: number, travelRatio = 0): number {
  const zoom = Math.abs(Math.log(Math.max(1e-6, toDist) / Math.max(1e-6, fromDist)));
  const across = Math.log1p(Math.max(0, travelRatio));
  return Math.round(THREE.MathUtils.clamp(420 + 90 * zoom + 120 * across, 420, 900));
}
