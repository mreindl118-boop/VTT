// The nested world map: the World map button's own view in the continuous world. The valley itself, seen from
// straight above with north up, is the map (render/worldcarto.ts draws it as an inked D&D map up there and lets it
// turn into the 3-D world as the camera comes down); this module carries everything the flat sheet (ui/worldmap.ts)
// had round it, on the same data and with the same wording:
//  - the world bar under the top bar (while the view holds a good part of the region; the title and scale note are on
//    the map itself): the travel pace, the hex grid (one setting with the sheet's), Places, zoom in and out, and back to the open map;
//  - Places: the key panel, one row per place (a name used twice lists once), the DM's reveal eye per row; a row
//    flies there and shows its card;
//  - the place card (distance from the party and the time at the pace, the DM's note and reveal chip, Open per map)
//    and the hover tip (players: the name and the blurb only);
//  - the party's '&' dragged over the land to a place (it snaps within 22 px or a third of a mile) or into the
//    wilderness (its trail, the last 12 moves dashed on the land, is the stage's: both screens draw it);
//  - the minimap folds to its clock while the whole region is in view.
// Players see only the places they know: no label, symbol, proxy, tip, card or row for the others (worldstage.ts).
import * as THREE from 'three';
import type { App } from '../app';
import { worldOf } from '../campaigns';
import { milesOfWorld, worldOfMiles } from '../core/frames';
import type { Vec2 } from '../core/geometry';
import type { Pace } from '../core/travel';
import { ICON } from './icons';
import { esc } from './text';
import { SNAP_MI, dist, hexPref, hexScale, keyOf, pinTipHtml, setHexPref, worldCardHtml, worldName, worldPins } from './worldmap';

type P = [number, number];
type Pin = ReturnType<typeof worldPins>[number];

export interface NestHost {
  app: App;
  ui: HTMLElement;
  sceneName(path: string): Promise<string>;
  /** Open a scene from the world map (remembered as the scene to reopen). */
  enter(path: string): void;
}

/** The party's drag snaps to a place this close on screen (CSS px), as well as within SNAP_MI. */
const SNAP_PX = 22;

export class NestedWorldMap {
  readonly bar: HTMLElement;
  readonly key: HTMLElement;
  readonly card: HTMLElement;
  readonly tip: HTMLElement;
  pace: Pace = 'normal';
  private drag: { id: number; from: P; to: P; key?: string; dx: number; dy: number } | null = null;
  private keyCampaign = '';
  private keyAudience = '';
  private folded = false;
  private shownBar = false;
  private audience = '';
  private campaign = '';

  constructor(private h: NestHost) {
    const { ui, app } = h;
    try { const p = localStorage.getItem('mistlab.pace'); if (p === 'slow' || p === 'normal' || p === 'fast') this.pace = p; } catch { /* no storage */ }
    this.bar = document.createElement('div');
    this.bar.className = 'nestbar page'; this.bar.hidden = true;
    this.bar.innerHTML = `<div class="seg pace" role="tablist" aria-label="Travel pace">${(['slow', 'normal', 'fast'] as Pace[]).map((p) => `<button role="tab" data-pace="${p}" aria-selected="${p === this.pace}" data-tip="${p[0].toUpperCase() + p.slice(1)} pace">${p[0].toUpperCase() + p.slice(1)}</button>`).join('')}</div>
      <button class="icon" data-hex aria-label="Hex grid" aria-pressed="${hexPref()}" data-tip="Hex grid">${ICON.hex}</button>
      <button class="icon" data-places aria-label="Places" aria-pressed="false" data-tip="Places">${ICON.list}</button>
      <button class="icon" data-z="in" aria-label="Zoom in" data-tip="Zoom in">${ICON.zoomIn}</button><button class="icon" data-z="out" aria-label="Zoom out" data-tip="Zoom out">${ICON.zoomOut}</button>
      <button class="icon" data-nest-close aria-label="Back to the map" data-tip="Back to the map">${ICON.close}</button>`;
    this.key = document.createElement('aside');
    this.key.className = 'nestkey page'; this.key.hidden = true;
    this.key.innerHTML = '<h3>Places</h3><ol></ol>';
    this.card = document.createElement('div'); this.card.className = 'nestcard page'; this.card.hidden = true;
    this.tip = document.createElement('div'); this.tip.className = 'nesttip page'; this.tip.hidden = true; this.tip.setAttribute('role', 'tooltip');
    ui.append(this.bar, this.key, this.card, this.tip);
    app.world.beforeRender.add(this.onFrame);

    this.bar.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const pc = t.closest<HTMLElement>('[data-pace]');
      if (pc) { this.pace = pc.dataset.pace as Pace; try { localStorage.setItem('mistlab.pace', this.pace); } catch { /* no storage */ } this.bar.querySelectorAll('[data-pace]').forEach((x) => x.setAttribute('aria-selected', String(x === pc))); if (this.cardFor) void this.showCard(this.cardFor.pin, this.cardFor.to, this.cardFor.miles); return; }
      if (t.closest('[data-hex]')) { this.setHex(!hexPref()); return; }
      if (t.closest('[data-places]')) { this.toggleKey(this.key.hidden === true); return; }
      const z = t.closest<HTMLElement>('[data-z]')?.dataset.z; if (z) { app.world.zoomBy(z === 'in' ? 0.78 : 1.28); return; }
      if (t.closest('[data-nest-close]')) this.leave();
    });
    this.key.addEventListener('click', (e) => {
      const t = e.target as HTMLElement, li = t.closest<HTMLElement>('li'); const p = li && this.pin(li.dataset.key!); if (!p || !this.shown(p)) return;
      if (t.closest('[data-reveal]')) { if (app.playersSide) return; app.revealPin(p.key, !app.pinsRevealed.has(p.key)); this.refresh(); return; }
      this.flyToPin(p); void this.showCard(p, p.pos as P, dist(this.at(), p.pos as P));
    });
    this.card.addEventListener('click', (e) => {
      const t = e.target as HTMLElement, s = t.closest<HTMLElement>('[data-scene]')?.dataset.scene;
      if (s) { if (app.restricted || this.card.hidden || !this.cardFor?.pin || !this.shown(this.cardFor.pin) || !this.cardFor.pin.scenes?.includes(s)) return; this.closeCard(); this.h.enter(s); return; }
      const rv = t.closest<HTMLElement>('[data-reveal]');
      if (rv) { if (app.playersSide || this.card.hidden) return; const p = this.pin(rv.dataset.reveal!); if (p && p === this.cardFor?.pin) { app.revealPin(p.key, !app.pinsRevealed.has(p.key)); this.refresh(); void this.showCard(p, p.pos as P, dist(this.at(), p.pos as P)); } }
    });
    addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || document.querySelector('.sheet-backdrop, details.menu[open]')) return;
      if (!this.card.hidden) { this.closeCard(); return; }
      if (!this.key.hidden) { this.toggleKey(false); return; }
      if (this.shownBar) this.leave();
    });
    // the canvas: hover tips and taps on places (app.ts asks), the party's drag (ahead of the camera's own gestures)
    app.onPinHover = (k, x, y) => this.hover(k, x, y);
    app.onPinTap = (k, path) => this.tapPin(k, path);
    const el = app.world.renderer.domElement;
    // A mouse takes the party at once. A finger takes it only once it moves alone (a second finger makes it a pinch,
    // which the camera keeps: the party's & often stands on the very place a pinch is aimed at).
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') { this.touches.add(e.pointerId); if (this.touches.size > 1) this.pending = null; else if (this.near(e)) this.pending = { id: e.pointerId, x: e.clientX, y: e.clientY }; return; }
      this.grab(e);
    }, { capture: true });
    el.addEventListener('pointermove', (e) => {
      const p = this.pending;
      if (p && e.pointerId === p.id && this.touches.size === 1 && Math.hypot(e.clientX - p.x, e.clientY - p.y) >= 6) { this.pending = null; this.grab(e, true); }
      if (this.drag && e.pointerId === this.drag.id) { e.stopImmediatePropagation(); this.dragTo(e); }
    }, { capture: true });
    const lift = (e: PointerEvent) => { this.touches.delete(e.pointerId); if (this.pending?.id === e.pointerId) this.pending = null; };
    el.addEventListener('pointerup', (e) => { lift(e); if (this.drag && e.pointerId === this.drag.id) this.drop(e); }, { capture: true });
    el.addEventListener('pointercancel', (e) => { lift(e); if (this.drag && e.pointerId === this.drag.id) { this.drag = null; app.world.controls.enabled = true; app.syncStage(); } }, { capture: true });
    el.addEventListener('pointerleave', () => { this.tip.hidden = true; });
  }

  // ------------------------------------------------------------------ the view

  private get stage() { const a = this.h.app; return a.staged && a.stage && a.renderMode === 'normal' ? a.stage : undefined; }
  private pin(key: string): Pin | undefined { return worldPins().find((p) => p.key === key); }
  /** Where the party stands (miles), or the first place with a map. */
  private at(): P { const w = this.h.app.state.world; return (w?.pos ?? (worldPins().find((p) => p.scenes?.length) ?? worldPins()[0]).pos) as P; }
  private shown(p: Pin): boolean { return !this.h.app.playersSide || this.h.app.pinsRevealed.has(p.key); }
  private audienceKey(): string { const a = this.h.app; return `${a.campaign.id}|${a.playersSide}|${a.restricted}|${[...a.pinsRevealed].sort().join()}`; }
  private closeCard(): void { this.card.hidden = true; this.cardFor = null; this.card.replaceChildren(); }

  /** The World map button: fly out to the whole region, straight down with north up, with the bar. False when the
   *  open map is not in the valley (a legacy map): the caller opens the flat sheet. */
  open(): boolean {
    const st = this.stage; if (!st) return false;
    this.refresh(true);
    st.setHex(hexPref());
    st.frameWorld('fly', true);
    return true;
  }
  /** Back to the open map (Escape, the bar's close). */
  leave(): void {
    const a = this.h.app;
    this.closeCard(); this.toggleKey(false); this.tip.hidden = true; this.tip.replaceChildren();
    if (a.cur) a.frameLevel(a.camPreset, true);
  }
  setHex(on: boolean): void {
    setHexPref(on);
    this.bar.querySelector('[data-hex]')!.setAttribute('aria-pressed', String(on));
    this.stage?.setHex(on);
  }
  private toggleKey(on: boolean): void {
    this.key.hidden = !on;
    this.bar.querySelector('[data-places]')!.setAttribute('aria-pressed', String(on));
    if (on) this.renderKey();
  }

  /** After every camera move and state change: the bar shows while a good part of the region is in view (the DM's
   *  screen only; the Player Display has none), the minimap folds at the whole region, the rows follow the reveals. */
  refresh(force = false): void {
    const a = this.h.app, st = this.stage, fit = st?.carto.fit ?? 0, dm = a.mode === 'dm';
    const show = !!st && dm && (force || fit >= 0.35);
    if (show !== this.shownBar) {
      this.shownBar = show; this.bar.hidden = !show;
      if (!show) this.toggleKey(false); // (a card stays: a row or a tap flies in to road zoom with it)
      document.body.classList.toggle('nest-world', show);
      if (show) {
        const top = Math.max(0, ...[...document.querySelectorAll('.topbar > .group')].map((g) => g.getBoundingClientRect().bottom));
        this.bar.style.top = `${Math.round((top || 56) + 8)}px`;
        this.bar.setAttribute('aria-label', `${worldName()}: ${hexScale()}`);
      }
    }
    // the minimap folds to its clock while the whole region is in view, and comes back nearer in
    const fold = !!st && (this.folded ? fit >= 0.6 : fit >= 0.75);
    if (fold !== this.folded) { this.folded = fold; document.querySelector('.minimap')?.classList.toggle('folded', fold); }
    const aud = this.audienceKey();
    if (aud !== this.audience) {
      const changedCampaign = this.campaign !== '' && this.campaign !== a.campaign.id;
      this.audience = aud; this.campaign = a.campaign.id;
      this.tip.hidden = true; this.tip.replaceChildren();
      const card = this.cardFor;
      if (card) {
        if (changedCampaign || !st || (card.pin && !this.shown(card.pin))) this.closeCard();
        else void this.showCard(card.pin, card.to, card.miles);
      }
      if (this.drag && (changedCampaign || !this.canDrag())) { this.drag = null; a.world.controls.enabled = true; a.syncStage(); }
    }
    if (!this.key.hidden && (aud !== this.keyAudience || this.keyCampaign !== a.campaign.id)) this.renderKey();
    if (!st && this.cardFor) this.closeCard();
    const party = st ? document.querySelector<HTMLElement>('.lbl.world-party') : null;
    if (party) { const t = a.restricted ? 'The party' : 'The party · drag to travel'; if (party.title !== t) { party.title = t; party.setAttribute('aria-label', t); } party.classList.toggle('movable', this.canDrag()); }
  }

  /** The Places list: one row per place the side knows (a name lettered twice lists once). */
  private renderKey(): void {
    const a = this.h.app, ol = this.key.querySelector('ol')!, dm = !a.playersSide, rev = a.pinsRevealed, pins = worldPins();
    this.keyCampaign = a.campaign.id; this.keyAudience = this.audienceKey();
    ol.innerHTML = pins.filter((p) => this.shown(p) && !pins.some((q) => q !== p && q.name === p.name && q.key < p.key && this.shown(q)))
      .map((p) => `<li data-key="${esc(p.key)}" class="${rev.has(p.key) ? 'revealed' : ''}"><button type="button" class="place-action" aria-label="${esc(p.name)}"><b>${esc(keyOf(p))}</b><span>${esc(p.name)}</span>${p.scenes?.length ? '<i>map</i>' : ''}</button>${dm ? `<button class="icon eye" data-reveal="${esc(p.key)}" aria-pressed="${rev.has(p.key)}" aria-label="Reveal to players" data-tip="Reveal to players">${ICON.eye}</button>` : ''}</li>`).join('');
  }

  /** Fly to frame a place at road zoom (the land still the map, its symbol and the roads round it). */
  private flyToPin(p: Pin): void {
    const st = this.stage, w = this.h.app.world; if (!st) return;
    const [x, z] = worldOfMiles(st.data, p.pos as Vec2), y = st.groundAt(x, z);
    const pxK = (2 * Math.tan(THREE.MathUtils.degToRad(w.camera.fov / 2))) / (w.renderer.domElement.clientHeight || 1);
    w.flyTo(w.toAnchored(new THREE.Vector3(x, y, z)), 14 / pxK);
  }

  // ------------------------------------------------------------------ tips and cards

  private hover(key: string | null, x: number, y: number): void {
    const p = key ? this.pin(key) : undefined;
    if (!p || this.drag || !this.shown(p)) { this.tip.hidden = true; return; }
    const a = this.h.app;
    this.tip.innerHTML = pinTipHtml(p, { dm: !a.playersSide, revealed: a.pinsRevealed.has(p.key), canOpen: !a.restricted });
    this.tip.hidden = false;
    const w = this.tip.offsetWidth, hh = this.tip.offsetHeight;
    this.tip.style.left = `${Math.max(8, Math.min(x + 14, innerWidth - w - 8))}px`; this.tip.style.top = `${Math.max(8, Math.min(y + 16, innerHeight - hh - 8))}px`;
  }
  /** A tap on a place: the players' side gets its card; the DM's flies into its map (app.ts goes on to do that), with
   *  its card too when it has more than one map (or none, the card only). */
  private tapPin(key: string, path: string | undefined): boolean {
    const p = this.pin(key); if (!p || !this.shown(p)) return false;
    this.tip.hidden = true;
    const a = this.h.app, n = p.scenes?.length ?? 0;
    if (a.restricted) { void this.showCard(p, p.pos as P, dist(this.at(), p.pos as P)); return true; }
    if (n !== 1) void this.showCard(p, p.pos as P, dist(this.at(), p.pos as P)); else this.closeCard();
    return !path; // with a map: let the app fly there and open it
  }
  private cardFor: { pin: Pin | undefined; to: P; miles: number } | null = null;
  async showCard(pin: Pin | undefined, to: P, miles: number): Promise<void> {
    const a = this.h.app;
    if (!this.stage || (pin && !this.shown(pin))) { this.closeCard(); return; }
    const request = { pin, to, miles }, campaign = a.campaign.id;
    this.cardFor = request;
    this.card.hidden = true; this.card.replaceChildren();
    const labels = await Promise.all((pin?.scenes ?? []).map((s) => this.h.sceneName(s).catch(() => s)));
    if (this.cardFor !== request || campaign !== a.campaign.id || !this.stage || (pin && !this.shown(pin))) return;
    this.card.innerHTML = worldCardHtml(pin, to, miles, { dm: !a.playersSide, revealed: pin ? a.pinsRevealed.has(pin.key) : false, pace: this.pace, canOpen: !a.restricted, labels });
    this.card.hidden = false;
  }

  // ------------------------------------------------------------------ the party's drag

  private canDrag(): boolean { const a = this.h.app; return !!this.stage && a.mode === 'dm' && !a.restricted && a.tool === 'none'; }
  private touches = new Set<number>();
  private pending: { id: number; x: number; y: number } | null = null;
  /** The pointer is on the party's & (within 22 px of it), and the DM may move it. */
  private near(e: PointerEvent): boolean {
    if (e.button > 0 || !this.canDrag()) return false;
    const pa = this.stage!.partyAt(); return !!pa && Math.hypot(e.clientX - pa.x, e.clientY - pa.y) <= SNAP_PX;
  }
  private grab(e: PointerEvent, moved = false): void {
    if (!moved && !this.near(e)) return;
    if (!moved) { e.stopImmediatePropagation(); e.preventDefault(); }
    const from = this.at(), an = this.stage!.partyAnchor();
    // (the & stands a little off its place on the inked map: the place follows the finger by the same offset)
    this.drag = { id: e.pointerId, from, to: from, dx: an ? an.x - e.clientX : 0, dy: an ? an.y - e.clientY : 0 };
    this.h.app.world.controls.enabled = false;
    const el = this.h.app.world.renderer.domElement; el.setPointerCapture(e.pointerId);
    this.tip.hidden = true; this.closeCard();
  }
  /** The place the party would snap to at a page point: within 22 px of its mark, or a third of a mile of it. */
  private snapAt(x: number, y: number, miles: P | null): Pin | undefined {
    const st = this.stage!; let best: Pin | undefined, bd = Infinity;
    for (const p of worldPins()) {
      if (!this.shown(p)) continue;
      const [wx, wz] = worldOfMiles(st.data, p.pos as Vec2), s = st.screenOfAbs(new THREE.Vector3(wx, st.groundAt(wx, wz), wz));
      // the place's mark on the page: its land point, or its disc where the label shows (the symbol stands over it)
      const disc = document.querySelector(`.lbl.place[data-key="${CSS.escape(p.key)}"] .pk`)?.getBoundingClientRect();
      const onDisc = disc && disc.width ? Math.hypot((disc.left + disc.right) / 2 - x, (disc.top + disc.bottom) / 2 - y) : Infinity;
      const px = Math.min(onDisc, s.behind ? Infinity : Math.hypot(s.x - x, s.y - y)), mi = miles ? dist(miles, p.pos as P) : Infinity;
      if ((px <= SNAP_PX || mi < SNAP_MI) && Math.min(px / SNAP_PX, mi / SNAP_MI) < bd) { bd = Math.min(px / SNAP_PX, mi / SNAP_MI); best = p; }
    }
    return best;
  }
  private dragTo(e: PointerEvent): void {
    const st = this.stage, d = this.drag; if (!st || !d) return;
    const g = st.groundOf(e.clientX + d.dx, e.clientY + d.dy); if (!g) return;
    const mi = milesOfWorld(st.data, [g.x, g.z]) as P, near = this.snapAt(e.clientX + d.dx, e.clientY + d.dy, mi) ?? this.snapAt(e.clientX, e.clientY, null);
    d.to = near ? [...near.pos] as P : [Math.round(mi[0] * 100) / 100, Math.round(mi[1] * 100) / 100]; d.key = near?.key;
    st.setParty({ at: worldOfMiles(st.data, d.to) });
    document.querySelector('.lbl.world-party')?.classList.toggle('snap', !!near);
    this.h.app.world.invalidate();
  }
  private drop(e: PointerEvent): void {
    const a = this.h.app, d = this.drag!;
    if (this.canDrag()) this.dragTo(e);
    this.drag = null;
    a.world.controls.enabled = true;
    try { a.world.renderer.domElement.releasePointerCapture(e.pointerId); } catch { /* released */ }
    document.querySelector('.lbl.world-party')?.classList.remove('snap');
    if (!this.canDrag()) { a.syncStage(); return; }
    const miles = dist(d.from, d.to);
    if (miles < 0.05) { a.syncStage(); return; }
    a.moveWorld(d.to, d.key, miles);
    this.refresh();
    void this.showCard(d.key ? this.pin(d.key) : undefined, d.to, miles);
  }

  /** Each frame: the bar and the fold follow the camera. */
  private onFrame = (): void => { this.refresh(); };
  /** The trail's points (miles) as drawn now (tests). */
  trailPoints(): P[] { return (this.h.app.stage?.trail ?? []) as P[]; }
  /** The world the overlay serves (tests). */
  get worldData() { return worldOf(this.h.app.campaign); }
}
