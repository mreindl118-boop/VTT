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
    this.controls.enableDamping = false;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.screenSpacePanning = false;
    this.controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
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

  /** Frame a plan-space box from a preset angle (bounding-sphere fit, leaving room for the chrome). */
  frame(box: { minX: number; minZ: number; maxX: number; maxZ: number }, y: number, preset: CameraPreset): void {
    const cx = (box.minX + box.maxX) / 2, cz = (box.minZ + box.maxZ) / 2;
    const r = Math.hypot(box.maxX - box.minX, box.maxZ - box.minZ) / 2 + 4;
    const vHalf = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * this.camera.aspect);
    const d = (r / Math.sin(Math.min(vHalf, hHalf))) * 0.82;
    this.controls.target.set(cx, y, cz);
    if (preset === 'top') this.camera.position.set(cx, y + d, cz + 0.01);
    else this.camera.position.set(cx, y + d * Math.SQRT1_2, cz + d * Math.SQRT1_2);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
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
