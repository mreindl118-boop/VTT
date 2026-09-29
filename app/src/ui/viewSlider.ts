// The DM/Player view slider control. Spec: docs/SLIDER.md.
import { applyDetents } from '../core/slider';
import { ICON } from './icons';

export class ViewSlider {
  readonly el: HTMLElement;
  private track: HTMLElement;
  private thumb: HTMLElement;
  private fill: HTMLElement;
  private readout: HTMLElement;
  private t = 0;
  private peekFrom: number | null = null;
  private anim = 0;

  constructor(private onChange: (t: number) => void) {
    this.el = document.createElement('div');
    this.el.className = 'vslider';
    this.el.innerHTML = `
      <div class="vs-end">DM</div>
      <div class="vs-track" role="slider" aria-label="DM / Player view" aria-valuemin="0" aria-valuemax="1" tabindex="0">
        <div class="vs-fill"></div><div class="vs-detent vs-top"></div><div class="vs-detent vs-bot"></div><div class="vs-thumb"></div>
      </div>
      <div class="vs-end">Players</div>
      <div class="vs-readout"></div>
      <button class="vs-peek" aria-label="Hold to peek">${ICON.eye}</button>`;
    this.track = this.el.querySelector('.vs-track')!;
    this.thumb = this.el.querySelector('.vs-thumb')!;
    this.fill = this.el.querySelector('.vs-fill')!;
    this.readout = this.el.querySelector('.vs-readout')!;

    const fromEvent = (e: PointerEvent) => {
      const r = this.track.getBoundingClientRect();
      return 1 - (e.clientY - r.top) / r.height;
    };
    this.track.addEventListener('pointerdown', (e) => {
      this.track.setPointerCapture(e.pointerId);
      this.set(fromEvent(e), true);
      const move = (ev: PointerEvent) => this.set(fromEvent(ev), true);
      const up = () => { this.track.removeEventListener('pointermove', move); this.track.removeEventListener('pointerup', up); this.track.removeEventListener('pointercancel', up); };
      this.track.addEventListener('pointermove', move);
      this.track.addEventListener('pointerup', up);
      this.track.addEventListener('pointercancel', up);
      e.preventDefault();
    });
    this.track.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' || e.key === ']') this.set(this.t + 0.1, true);
      if (e.key === 'ArrowDown' || e.key === '[') this.set(this.t - 0.1, true);
    });
    const peek = this.el.querySelector<HTMLButtonElement>('.vs-peek')!;
    peek.addEventListener('pointerdown', (e) => { peek.setPointerCapture(e.pointerId); this.peek(true); });
    peek.addEventListener('pointerup', () => this.peek(false));
    peek.addEventListener('pointercancel', () => this.peek(false));
    window.addEventListener('keydown', (e) => { if (e.key === '\\' && !e.repeat) this.peek(true); if (e.key === ']' && document.activeElement !== this.track) this.set(this.t + 0.1, true); if (e.key === '[' && document.activeElement !== this.track) this.set(this.t - 0.1, true); });
    window.addEventListener('keyup', (e) => { if (e.key === '\\') this.peek(false); });
    this.render();
  }

  get value(): number { return this.t; }

  set(v: number, user = false): void {
    const prev = this.t;
    this.t = user ? applyDetents(v) : Math.min(1, Math.max(0, v));
    if (user && prev !== this.t && (this.t === 0 || this.t === 1)) {
      navigator.vibrate?.(8);
      this.el.classList.remove('snap'); void this.el.offsetWidth; this.el.classList.add('snap');
    }
    this.render();
    this.onChange(this.t);
  }

  private peek(on: boolean): void {
    if (on && this.peekFrom === null) { this.peekFrom = this.t; this.animateTo(1); }
    if (!on && this.peekFrom !== null) { const back = this.peekFrom; this.peekFrom = null; this.animateTo(back); }
  }

  private animateTo(target: number): void {
    cancelAnimationFrame(this.anim);
    const from = this.t, t0 = performance.now(), dur = 180;
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      this.set(from + (target - from) * e);
      if (k < 1) this.anim = requestAnimationFrame(step);
    };
    step();
  }

  private render(): void {
    const pct = `${this.t * 100}%`;
    this.thumb.style.bottom = pct;
    this.fill.style.height = pct;
    this.track.setAttribute('aria-valuenow', this.t.toFixed(2));
    this.readout.textContent = this.t === 0 || this.t === 1 ? '' : this.t.toFixed(2);
    this.el.dataset.t = this.t.toFixed(2);
  }
}
