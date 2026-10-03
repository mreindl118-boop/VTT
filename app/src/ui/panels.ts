// Movable panels: every floating piece of the DM UI (title, floors, tools, the view slider, the camera cluster,
// the minimap, the map frame) gets a small handle at its edge: a grip that drags the panel anywhere (pointer
// events, mouse or touch, clamped to the viewport) and a chevron that folds it to a pill showing only its icon.
// A tiny tab on the left edge (and the H key) hides every panel and brings them back. The layout (positions,
// folded panels, hidden) is kept in localStorage per viewport class (phone under 700 px wide, desktop otherwise),
// so a phone and a desktop each keep their own arrangement; Reset layout in the View menu restores the defaults.
//
// Positions are stored as an offset from the nearest viewport edge (left or right, top or bottom), so a panel
// parked in a corner stays in that corner when the window grows, and everything is re-clamped on resize.
import { ICON } from './icons';

export type ViewportClass = 'phone' | 'desktop';

export interface PanelOptions {
  /** Stable id, also the key in the saved layout and the `data-panel` attribute. */
  id: string;
  /** Spoken name for the grip's and chevron's labels. */
  name: string;
  /** The icon the folded pill shows (an ICON svg string). */
  icon: string;
  /** Default folded state, overall or per viewport class. */
  collapsed?: boolean | Partial<Record<ViewportClass, boolean>>;
}

interface PanelState { x?: number; y?: number; ax?: 'l' | 'r'; ay?: 't' | 'b'; collapsed?: boolean }
interface Layout { v: 1; hidden?: boolean; panels: Record<string, PanelState> }

interface Panel { el: HTMLElement; opts: PanelOptions; state: PanelState; fold: HTMLButtonElement; grip: HTMLButtonElement }

const KEY = 'mistlab.layout.';
const PHONE_MAX = 700;
const EDGE = 0; // panels may touch the viewport edge; nothing may leave it

export function viewportClass(): ViewportClass { return innerWidth < PHONE_MAX ? 'phone' : 'desktop'; }

export class Panels {
  private panels: Panel[] = [];
  private cls: ViewportClass = viewportClass();
  private layout: Layout = this.load();
  private toggle: HTMLButtonElement;
  private dragging = false;
  private ro = new ResizeObserver(() => { if (!this.dragging) this.placeAll(); });

  constructor(ui: HTMLElement) {
    this.toggle = document.createElement('button');
    this.toggle.className = 'pn-toggle';
    this.toggle.dataset.act = 'ui-toggle';
    this.toggle.innerHTML = ICON.panels;
    this.toggle.addEventListener('click', () => this.toggleHidden());
    ui.appendChild(this.toggle);
    this.applyHidden();
    addEventListener('resize', () => this.onResize());
  }

  get hidden(): boolean { return !!this.layout.hidden; }

  /** Attach a grip and a chevron to `el`, restore its saved state and keep it in the layout. */
  makePanel(el: HTMLElement, opts: PanelOptions): void {
    el.classList.add('panel');
    el.dataset.panel = opts.id;
    const handle = document.createElement('div');
    handle.className = 'pn-handle';
    handle.innerHTML = `<button class="pn-grip" aria-label="Move the ${opts.name} panel (drag, or arrow keys)" title="Move">${ICON.grip}</button><button class="pn-fold" aria-label="Fold the ${opts.name} panel" title="Fold">${ICON.chevron}</button>`;
    const icon = document.createElement('button');
    icon.className = 'pn-icon';
    icon.setAttribute('aria-label', `Unfold the ${opts.name} panel`);
    icon.title = opts.name;
    icon.innerHTML = opts.icon;
    el.prepend(handle, icon);
    const grip = handle.querySelector<HTMLButtonElement>('.pn-grip')!, fold = handle.querySelector<HTMLButtonElement>('.pn-fold')!;
    const p: Panel = { el, opts, state: this.layout.panels[opts.id] ?? {}, fold, grip };
    this.panels.push(p);
    // handle clicks stay in the handle: the panels' own click handlers must not see them
    handle.addEventListener('click', (e) => e.stopPropagation());
    icon.addEventListener('click', (e) => { e.stopPropagation(); this.setCollapsed(p, false); });
    fold.addEventListener('click', () => this.setCollapsed(p, !this.isCollapsed(p)));
    this.wireDrag(p);
    grip.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 40 : 10;
      const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const v = d[e.key]; if (!v) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      this.moveTo(p, r.left + v[0], r.top + v[1]);
      this.commitPosition(p);
    });
    this.ro.observe(el);
    this.apply(p);
  }

  /** Hide or show every panel (the tab and the H key). */
  toggleHidden(force?: boolean): void {
    this.layout.hidden = force ?? !this.layout.hidden;
    this.applyHidden();
    this.save();
  }

  /** Forget the saved layout for this viewport class and put every panel back where CSS puts it. */
  reset(): void {
    this.layout = { v: 1, panels: {} };
    try { localStorage.removeItem(KEY + this.cls); } catch { /* storage may be unavailable */ }
    for (const p of this.panels) { p.state = {}; this.apply(p); }
    this.applyHidden();
  }

  private isCollapsed(p: Panel): boolean {
    if (p.state.collapsed !== undefined) return p.state.collapsed;
    const d = p.opts.collapsed;
    return typeof d === 'object' ? !!d[this.cls] : !!d;
  }

  private setCollapsed(p: Panel, on: boolean): void {
    p.state.collapsed = on;
    this.layout.panels[p.opts.id] = p.state;
    this.apply(p);
    this.save();
    (on ? p.fold : p.grip).focus?.();
  }

  private apply(p: Panel): void {
    const c = this.isCollapsed(p);
    if (c) p.el.dataset.collapsed = '1'; else delete p.el.dataset.collapsed;
    p.fold.setAttribute('aria-expanded', String(!c));
    p.fold.setAttribute('aria-label', `${c ? 'Unfold' : 'Fold'} the ${p.opts.name} panel`);
    p.fold.title = c ? 'Unfold' : 'Fold';
    this.place(p);
  }

  private applyHidden(): void {
    document.body.toggleAttribute('data-ui-hidden', !!this.layout.hidden);
    this.toggle.setAttribute('aria-pressed', String(!!this.layout.hidden));
    this.toggle.setAttribute('aria-label', this.layout.hidden ? 'Show the panels (H)' : 'Hide the panels (H)');
    this.toggle.title = this.layout.hidden ? 'Show the panels (H)' : 'Hide the panels (H)';
  }

  /** Put a panel where its saved offsets say, clamped into the viewport; or back to its CSS place when it has none. */
  private place(p: Panel): void {
    const s = p.state;
    if (s.x === undefined || s.y === undefined) {
      delete p.el.dataset.placed; p.el.style.left = ''; p.el.style.top = '';
      return;
    }
    p.el.dataset.placed = '1';
    const w = p.el.offsetWidth, h = p.el.offsetHeight;
    const left = s.ax === 'r' ? innerWidth - w - s.x : s.x, top = s.ay === 'b' ? innerHeight - h - s.y : s.y;
    this.moveTo(p, left, top);
  }

  private placeAll(): void { for (const p of this.panels) this.place(p); }

  private moveTo(p: Panel, left: number, top: number): void {
    const w = p.el.offsetWidth, h = p.el.offsetHeight;
    const x = Math.round(Math.max(EDGE, Math.min(innerWidth - w - EDGE, left))), y = Math.round(Math.max(EDGE, Math.min(innerHeight - h - EDGE, top)));
    p.el.dataset.placed = '1';
    p.el.style.left = `${x}px`; p.el.style.top = `${y}px`;
  }

  /** Read the panel's current place back into edge-anchored offsets and save. */
  private commitPosition(p: Panel): void {
    const r = p.el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    p.state.ax = cx < innerWidth / 2 ? 'l' : 'r'; p.state.ay = cy < innerHeight / 2 ? 't' : 'b';
    p.state.x = Math.round(p.state.ax === 'l' ? r.left : innerWidth - r.right);
    p.state.y = Math.round(p.state.ay === 't' ? r.top : innerHeight - r.bottom);
    this.layout.panels[p.opts.id] = p.state;
    this.save();
  }

  private wireDrag(p: Panel): void {
    const grip = p.grip;
    let start: { x: number; y: number; left: number; top: number; id: number; moved: boolean } | null = null;
    grip.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const r = p.el.getBoundingClientRect();
      start = { x: e.clientX, y: e.clientY, left: r.left, top: r.top, id: e.pointerId, moved: false };
      try { grip.setPointerCapture(e.pointerId); } catch { /* synthetic pointers have no capture */ }
      e.preventDefault();
    });
    grip.addEventListener('pointermove', (e) => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!start.moved && Math.hypot(dx, dy) < 4) return;
      if (!start.moved) { start.moved = true; this.dragging = true; p.el.dataset.dragging = '1'; }
      this.moveTo(p, start.left + dx, start.top + dy);
    });
    const end = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      const moved = start.moved; start = null;
      if (!moved) return;
      this.dragging = false; delete p.el.dataset.dragging;
      this.commitPosition(p);
    };
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
  }

  private onResize(): void {
    const cls = viewportClass();
    if (cls !== this.cls) {
      // the phone and the desktop each keep their own layout: a rotation across the line swaps them in
      this.cls = cls; this.layout = this.load();
      for (const p of this.panels) { p.state = this.layout.panels[p.opts.id] ?? {}; this.apply(p); }
      this.applyHidden();
    } else this.placeAll();
  }

  private load(): Layout {
    try {
      const raw = localStorage.getItem(KEY + this.cls);
      if (raw) { const l = JSON.parse(raw) as Layout; if (l && l.v === 1 && l.panels) return l; }
    } catch { /* unreadable: start afresh */ }
    return { v: 1, panels: {} };
  }

  private save(): void {
    try { localStorage.setItem(KEY + this.cls, JSON.stringify(this.layout)); } catch { /* storage full or blocked: the layout just does not persist */ }
  }
}
