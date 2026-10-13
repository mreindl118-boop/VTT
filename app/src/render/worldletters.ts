// The inked map's lettering: the names the land carries (peaks, woods, lakes, rivers) as CSS labels standing on the
// 3-D land, in the bundled display faces with paper halos, and the sheet's frame while the whole region is in view:
// the region's title with its scale note, a compass rose of our own that turns with the camera, and a vignette. Shown
// only while the land is drawn as the map (body[data-carto], --carto its strength); the place labels are restyled as
// keyed discs with their symbols by the same rule (styles.css).
import * as THREE from 'three';
import type { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { WorldData } from '../campaigns';
import type { Vec2 } from '../core/geometry';
import type { CartoStyleId } from './worldcarto';
import type { LandField } from './worldland';
import type { World } from './world';

/** An eight-point lozenge rose (our own drawing): dark and paper halves on each point, a dashed ring, N on top. */
const ROSE = `<svg viewBox="-50 -50 100 100" aria-hidden="true">
  <circle r="30" fill="none" stroke="currentColor" stroke-width="1"/><circle r="26" fill="none" stroke="currentColor" stroke-width=".5" stroke-dasharray="1.5 2.5"/>
  <g stroke="currentColor" stroke-width=".8" stroke-linejoin="round">
    <path d="M22-22 3-3 0 0 4 0Z" fill="currentColor" opacity=".7"/><path d="M-22 22-3 3 0 0-4 0Z" fill="currentColor" opacity=".7"/>
    <path d="M22 22 3 3 0 0 0 4Z" fill="currentColor" opacity=".7"/><path d="M-22-22-3-3 0 0 0-4Z" fill="currentColor" opacity=".7"/>
    <path d="M0-44 6-6 0 0Z" fill="currentColor"/><path d="M0-44-6-6 0 0Z" fill="var(--carto-paper)"/>
    <path d="M0 44-6 6 0 0Z" fill="currentColor"/><path d="M0 44 6 6 0 0Z" fill="var(--carto-paper)"/>
    <path d="M44 0 6 6 0 0Z" fill="currentColor"/><path d="M44 0 6-6 0 0Z" fill="var(--carto-paper)"/>
    <path d="M-44 0-6-6 0 0Z" fill="currentColor"/><path d="M-44 0-6 6 0 0Z" fill="var(--carto-paper)"/>
  </g><text y="-47" text-anchor="middle" font-size="13">N</text></svg>`;
/** The pastoral title's scroll (our own drawing): a ribbon with curled ends. */
const SCROLL = `<svg class="scroll" viewBox="0 0 200 50" preserveAspectRatio="none" aria-hidden="true">
  <path d="M14 10h172c-6 5-6 25 0 30H14c6-5 6-25 0-30Z" fill="var(--carto-paper)" stroke="currentColor" stroke-width="1.2"/>
  <path d="M14 10C4 10 2 22 8 24c4 1 6-2 6-6M186 40c10 0 12-12 6-14-4-1-6 2-6 6" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`;

/** '1 hex = ¼ mile, north up', as the flat sheet says it. */
export function hexNote(milesPerHex: number): string {
  const m = milesPerHex === 0.25 ? '¼ mile' : milesPerHex === 0.5 ? '½ mile' : `${milesPerHex} mile${milesPerHex > 1 ? 's' : ''}`;
  return `1 hex = ${m}, north up`;
}

export class CartoLetters {
  readonly group = new THREE.Group();
  /** The land's names (key '' marks them as the land's, not a place's; at: miles; text: the name). */
  readonly labels: { obj: CSS2DObject; key: string; pri: number; at: Vec2; text: string }[] = [];
  private frame: HTMLElement;
  private rose: HTMLElement;
  private shown = -1;
  private turn = NaN;
  private safeKey = '';

  constructor(world: World, data: WorldData & { milesPerHex?: number }, field: LandField, style: CartoStyleId) {
    this.group.name = 'carto-letters';
    const at = (pos: Vec2, lift = 30): THREE.Vector3 => { const [x, z] = field.feet(pos); return new THREE.Vector3(x, field.height(x, z) + lift, z); };
    const add = (text: string, cls: string, pos: Vec2, pri: number, angle = 0, lift = 30): void => {
      const lb = world.label('', undefined, `carto ${cls}`), span = document.createElement('span');
      span.textContent = text; if (angle) span.style.transform = `rotate(${angle}deg)`;
      lb.element.appendChild(span); lb.position.copy(at(pos, lift)); lb.userData.role = 'stage';
      this.group.add(lb); this.labels.push({ obj: lb, key: '', pri, at: pos, text });
    };
    for (const pk of data.peaks) add(pk.name, 'peak', pk.pos as Vec2, 3, 0, 60);
    // a wood named at several points is lettered once, at the middle of its points, unless it says which way it runs
    const tracts = new Map<string, Vec2[]>();
    for (const w of data.woods) { if (w.angle === undefined) tracts.set(w.name, [...(tracts.get(w.name) ?? []), w.pos as Vec2]); else add(w.name, 'wood', w.pos as Vec2, 4, w.angle); }
    for (const [name, pts] of tracts) add(name, 'wood', [pts.reduce((a, q) => a + q[0], 0) / pts.length, pts.reduce((a, q) => a + q[1], 0) / pts.length], 4);
    for (const l of data.lakes) if (l.r[0] > 0.3) add(l.name, 'lake', l.center as Vec2, 3, Math.abs(l.r[1]) > Math.abs(l.r[0]) * 1.4 ? -90 : 0, 10);
    for (const l of data.labels ?? []) add(l.name, 'river', l.pos as Vec2, 5, l.angle ?? 0, 10);
    // the sheet's frame: the title (and its scale note) straight on the map, the rose at the bottom right, a vignette
    this.frame = document.createElement('div');
    this.frame.className = `carto-frame ${style}`;
    document.body.dataset.cartoStyle = style;
    const vig = document.createElement('div'); vig.className = 'carto-vignette';
    const title = document.createElement('div'); title.className = 'carto-title';
    const h = document.createElement('div'); h.className = 'ct-name'; h.textContent = data.name;
    const note = document.createElement('div'); note.className = 'ct-note'; note.textContent = hexNote(data.milesPerHex ?? 1);
    if (style === 'pastoral') title.insertAdjacentHTML('afterbegin', SCROLL);
    title.append(h, note);
    this.rose = document.createElement('div'); this.rose.className = 'carto-rose'; this.rose.innerHTML = ROSE;
    this.frame.append(vig, title, this.rose);
    (world.labelRenderer.domElement.parentElement ?? document.body).appendChild(this.frame);
  }

  /** k: how far the map is drawn; fit: the view's ground width over the region's (1 = the whole region); the camera's
   *  heading (the rose turns with it); the page's bars (the frame keeps inside what they leave clear). */
  sync(k: number, fit: number, azimuth: number, chrome: { bars: DOMRect[] }): void {
    const o = Math.round(k * THREE.MathUtils.smoothstep(fit, 0.35, 0.75) * 100) / 100;
    if (o !== this.shown) {
      this.shown = o;
      this.frame.style.opacity = String(o);
      this.frame.style.visibility = o > 0.01 ? 'visible' : 'hidden';
      if (o > 0.3) document.body.dataset.cartoFrame = '1'; else delete document.body.dataset.cartoFrame;
    }
    if (o <= 0.01) return;
    const turn = Math.round(THREE.MathUtils.radToDeg(azimuth) * 10) / 10;
    if (turn !== this.turn) { this.turn = turn; this.rose.style.transform = `rotate(${turn}deg)`; }
    // the safe part of the view: clear of the top bar, the bottom toolbar and the side slider, 16 px from the left
    const host = (this.frame.parentElement ?? document.body).getBoundingClientRect();
    let top = 8, bottom = host.height - 8, left = 16, right = host.width - 8;
    for (const q of chrome.bars) {
      const y0 = q.top - host.top, y1 = q.bottom - host.top, x0 = q.left - host.left, x1 = q.right - host.left;
      if (x1 <= 0 || y1 <= 0 || x0 >= host.width || y0 >= host.height) continue;
      if (q.width >= q.height) { if (y0 < host.height - y1) top = Math.max(top, y1 + 8); else bottom = Math.min(bottom, y0 - 8); }
      else if (x0 > host.width - x1) right = Math.min(right, x0 - 8); else left = Math.max(left, x1 + 16);
    }
    const key = `${top}|${bottom}|${left}|${right}`;
    if (key !== this.safeKey) {
      this.safeKey = key;
      const s = this.frame.style;
      s.setProperty('--safe-top', `${Math.round(top)}px`); s.setProperty('--safe-left', `${Math.round(left)}px`);
      s.setProperty('--safe-right', `${Math.round(host.width - right)}px`); s.setProperty('--safe-bottom', `${Math.round(host.height - bottom)}px`);
    }
  }

  /** The title's and the rose's boxes on screen while they show: the names keep clear of them. */
  blockers(): DOMRect[] { return this.shown > 0.3 ? [...this.frame.querySelectorAll('.carto-title, .carto-rose')].map((e) => e.getBoundingClientRect()) : []; }

  dispose(): void {
    this.frame.remove();
    delete document.body.dataset.cartoFrame; delete document.body.dataset.cartoStyle;
    for (const l of this.labels) { l.obj.removeFromParent(); l.obj.element.remove(); }
    this.group.removeFromParent();
  }
}
