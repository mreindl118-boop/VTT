// The shared tooltip manager (docs/CLARITY.md 'The shared tooltip component'). Three trigger forms:
//  1. action buttons with data-tip: name (and shortcut) only. Mouse or pen hover shows it after 500 ms, keyboard focus
//     at once; on touch a 500 ms hold shows it while held and release still fires the button.
//  2. toggletips (button.tt): a tap or click pins the tip; hover previews it.
//  3. rules links (.rl): open a rules card (ui/rulecard.ts, loaded on demand).
// Routing is by pointerType, never by media query. One persistent capture-phase pointerdown handler decides what an
// outside press closes, and an Esc stack closes the topmost card or pinned tip before Esc reaches the app.
// The Player Display never mounts this.
import { KEYMAP, keysSeen, keyText, type KeyAction } from '../core/keys';
import type { CardSpec } from './rulecard';
import { esc } from './text';
import { ICON } from './icons';

/** Press-and-hold and pointer-capture controls: never a long-press tip (tests/tooltip.test.ts checks every
 *  setPointerCapture site is covered). */
export const HOLD_EXCLUDE = '.vs-peek, .vs-track, canvas.gl, .world-svg, .mm-canvas, input[type=range], [data-hold]';
/** Trigger guard on the players' side: nothing under these opens a tip. */
const GUARD = '.dm-only, .dm-note, .lbl.key';
const TRIGGER = '[data-tip], button.tt, .rl';
const HOVER_MS = 500, RL_HOVER_MS = 400, HOLD_MS = 500, GRACE_MS = 250, BUFFER = 50, MARGIN = 8, GAP = 8;

/** One line of a tip or card, with who may read it. 'dm' lines are dropped on the players' side before any string is built. */
export interface TipSource { text: string; audience: 'player' | 'dm'; kind?: string }
export interface TipCtx { restricted: boolean }

/** A tip's HTML from its sources: the first kept line is the title, the rest are sub-lines. Every slice is escaped. */
export function renderTip(sources: TipSource[], ctx: TipCtx): string {
  const keep = sources.filter((s) => s.text && !(ctx.restricted && s.audience === 'dm'));
  if (!keep.length) return '';
  const [t, ...rest] = keep;
  return `<b>${esc(t.text)}</b>${rest.map((r) => `<span class="sub">${esc(r.text)}</span>`).join('')}`;
}

type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
export type Side = 'below' | 'above' | 'right' | 'left' | 'sheet';

/** Where a card goes: below the anchor, then above, right, left (the first that fits, else the roomiest, with a
 *  smaller height). An 8 px margin, never over the anchor, never above `minTop`. Under 480 px wide: a bottom sheet. */
export function placeCard(a: Rect, size: { w: number; h: number }, vp: { w: number; h: number; minTop?: number }): { x: number; y: number; side: Side; maxH: number } {
  if (vp.w < 480) return { x: 0, y: vp.h - Math.min(size.h, vp.h / 2), side: 'sheet', maxH: Math.floor(vp.h / 2) };
  const minTop = Math.max(MARGIN, vp.minTop ?? MARGIN), w = Math.min(size.w, vp.w - 2 * MARGIN);
  const clampX = (x: number) => Math.max(MARGIN, Math.min(vp.w - MARGIN - w, x));
  const clampY = (y: number, h: number) => Math.max(minTop, Math.min(vp.h - MARGIN - h, y));
  const room = { below: vp.h - MARGIN - (a.bottom + GAP), above: a.top - GAP - minTop, right: vp.w - MARGIN - (a.right + GAP), left: a.left - GAP - MARGIN };
  const at = (side: Exclude<Side, 'sheet'>, h: number) => {
    const cx = clampX(a.left + a.width / 2 - w / 2), cy = clampY(a.top + a.height / 2 - h / 2, h);
    if (side === 'below') return { x: cx, y: a.bottom + GAP };
    if (side === 'above') return { x: cx, y: a.top - GAP - h };
    if (side === 'right') return { x: a.right + GAP, y: cy };
    return { x: a.left - GAP - w, y: cy };
  };
  const fits = (s: Exclude<Side, 'sheet'>) => (s === 'below' || s === 'above' ? room[s] >= size.h : room[s] >= w && vp.h - minTop - MARGIN >= size.h);
  for (const s of ['below', 'above', 'right', 'left'] as const) if (fits(s)) return { ...at(s, size.h), side: s, maxH: size.h };
  const best = (['below', 'above'] as const).reduce((p, q) => (room[q] > room[p] ? q : p));
  const h = Math.max(120, Math.floor(room[best]));
  return { ...at(best, h), side: best, maxH: h };
}

export interface TipHost {
  /** The players' side (Players view or Players mode). The slider preview at t=0 with view=dm is not counted yet. */
  restricted(): boolean;
  /** The open tap menu or info card, and how to close it (the outside handler's third rule). */
  menu(): HTMLElement | null;
  closeMenu(): void;
}

export interface Tips {
  readonly layer: HTMLElement;
  /** Hide the transient tips (hover and canvas). */
  clear(): void;
  /** Close everything: tips, the pinned toggletip and the card. */
  closeAll(): void;
  /** The map's hover tip (what is under the cursor), at the cursor. */
  /** `enter`: the DM's line when the room under the cursor opens a map of its own (a tap opens the card with Enter). */
  canvasTip(t: { title: string; sub?: string; enter?: string } | null, x: number, y: number): void;
  /** Open a rules card for a spec, at an anchor (or centred when there is none). */
  openCard(spec: CardSpec, opts?: { anchor?: Element | Rect; pinned?: boolean; trigger?: HTMLElement }): Promise<HTMLElement | null>;
  /** What is open (tests and the Esc stack). */
  state(): { hover: boolean; pinned: boolean; card: boolean; cardKind?: string };
  /** Called after every view flip (re-render the turn bar and anything audience-dependent). */
  onFlip(fn: () => void): void;
}

let mounted: Tips | null = null;

/** Mount the manager once (DM window only). */
export function mountTips(host: TipHost): Tips {
  if (mounted) return mounted;
  const layer = document.createElement('div');
  layer.id = 'tips';
  document.body.appendChild(layer);
  const live = document.createElement('div');
  live.className = 'sr-live'; live.setAttribute('aria-live', 'polite');
  document.body.appendChild(live);

  let lastType = 'mouse';
  let hoverEl: HTMLElement | null = null, hoverFor: HTMLElement | null = null, hoverTimer = 0;
  let canvasEl: HTMLElement | null = null;
  let pinnedEl: HTMLElement | null = null, pinnedFor: HTMLElement | null = null;
  let card: { el: HTMLElement; spec: CardSpec; trigger: HTMLElement | null; anchor: Rect | null; pinned: boolean; history: CardSpec[] } | null = null;
  let cardSeq = 0, graceTimer = 0;
  let hold: { el: HTMLElement; x: number; y: number; timer: number; shown: boolean; id: number } | null = null;
  let swallow: { el: HTMLElement; until: number } | null = null;
  const flips: (() => void)[] = [];
  let uid = 0;

  const restricted = () => host.restricted();
  const rectOf = (x: Element | Rect): Rect => (x instanceof Element ? x.getBoundingClientRect() : x);
  const topBarBottom = () => document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0;
  /** May this element open a tip now? On the players' side, never from hidden or DM-only places. */
  const allowed = (t: HTMLElement) => {
    if (t.closest('#tips') && !t.matches('.rl')) return false;
    if (!restricted()) return true;
    if (t.closest(GUARD)) return false;
    return t.checkVisibility ? t.checkVisibility() : t.offsetParent !== null;
  };
  const triggerOf = (n: EventTarget | null): HTMLElement | null => {
    const t = n instanceof Element ? n.closest<HTMLElement>(TRIGGER) : null;
    return t && allowed(t) ? t : null;
  };
  const kindOfTrigger = (t: HTMLElement) => (t.matches('.rl') ? 'rl' : t.matches('button.tt') ? 'tt' : 'tip');

  // ---- tier A: hover tips, held tips, toggletips
  const tipHtml = (t: HTMLElement) => {
    const name = t.dataset.tip ?? '';
    const key = t.dataset.key as KeyAction | undefined;
    const kbd = key && key in KEYMAP && keysSeen() ? `<kbd>${esc(keyText(key))}</kbd>` : '';
    return `<b>${esc(name)}${kbd}</b>${t.dataset.tipSub ? `<span class="sub">${esc(t.dataset.tipSub)}</span>` : ''}`;
  };
  const placeTip = (el: HTMLElement, t: HTMLElement) => {
    const a = t.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
    // Below the anchor, else above; anchors in the bottom-docked turn bar prefer above, clear of its own buttons.
    const above = a.top - 6 - h, preferAbove = !!t.closest('.turnbar') && above >= MARGIN;
    let y = preferAbove ? above : a.bottom + 6; if (!preferAbove && y + h > innerHeight - MARGIN) y = above;
    const x = Math.max(MARGIN, Math.min(innerWidth - MARGIN - w, a.left + a.width / 2 - w / 2));
    el.style.left = `${Math.round(x)}px`; el.style.top = `${Math.round(Math.max(MARGIN, y))}px`;
  };
  const hideCanvas = () => { canvasEl?.remove(); canvasEl = null; };
  const hideHover = () => {
    clearTimeout(hoverTimer); hoverTimer = 0;
    if (hoverFor) hoverFor.removeAttribute('aria-describedby');
    hoverEl?.remove(); hoverEl = null; hoverFor = null;
  };
  const showHover = (t: HTMLElement) => {
    if (!t.isConnected || !allowed(t)) return;
    hideHover();
    if (pinnedFor === t) return;
    const el = document.createElement('div');
    el.className = 'tip hover'; el.id = `tip-${++uid}`; el.setAttribute('role', 'tooltip');
    el.innerHTML = tipHtml(t);
    layer.appendChild(el);
    placeTip(el, t);
    t.setAttribute('aria-describedby', el.id);
    hoverEl = el; hoverFor = t;
  };
  const closePinned = (focusBack = false) => {
    if (!pinnedEl) return;
    pinnedFor?.setAttribute('aria-expanded', 'false');
    if (focusBack) pinnedFor?.focus();
    pinnedEl.remove(); pinnedEl = null; pinnedFor = null;
  };
  const togglePinned = (t: HTMLElement) => {
    if (pinnedFor === t) return closePinned();
    closePinned(); hideHover();
    const el = document.createElement('div');
    el.className = 'tip pinned'; el.id = `tip-${++uid}`; el.setAttribute('role', 'status');
    el.innerHTML = `${tipHtml(t)}<button type="button" class="x" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
    el.querySelector('.x')!.addEventListener('click', () => closePinned(true));
    layer.appendChild(el);
    placeTip(el, t);
    t.setAttribute('aria-expanded', 'true'); t.setAttribute('aria-controls', el.id);
    pinnedEl = el; pinnedFor = t;
    live.textContent = t.dataset.tip ?? '';
  };

  // ---- tier B: the rules card
  const closeCard = (focusBack = false) => {
    // Always invalidate a card that is still loading, so a close or a view flip can never be undone by it.
    cardSeq++;
    if (!card) return;
    clearTimeout(graceTimer); graceTimer = 0;
    card.trigger?.setAttribute('aria-expanded', 'false');
    if (focusBack) card.trigger?.focus();
    card.el.remove(); card = null;
  };
  const mountCard = (el: HTMLElement, c: NonNullable<typeof card>) => {
    // A card that replaces the open one (the edition toggle, a nested link, Back) swaps in place, without the fade.
    if (card && card.el !== el) { el.classList.add('swap'); card.el.remove(); }
    card = { ...c, el };
    layer.appendChild(el);
    const a = c.anchor ?? { left: innerWidth / 2, right: innerWidth / 2, top: innerHeight / 3, bottom: innerHeight / 3, width: 0, height: 0 };
    const minTop = a.top >= topBarBottom() ? topBarBottom() + MARGIN : MARGIN;
    const p = placeCard(a, { w: el.offsetWidth, h: el.offsetHeight }, { w: innerWidth, h: innerHeight, minTop });
    if (p.side === 'sheet') {
      el.classList.add('docked');
      // Keep the link in view above the sheet: scroll its own surface, never the map.
      const t = c.trigger, sh = el.getBoundingClientRect();
      if (t && t.getBoundingClientRect().bottom > sh.top) {
        let s: HTMLElement | null = t.parentElement;
        while (s && !(s.scrollHeight > s.clientHeight && /auto|scroll/.test(getComputedStyle(s).overflowY))) s = s.parentElement;
        if (s) s.scrollTop += t.getBoundingClientRect().bottom - sh.top + MARGIN;
      }
    } else {
      el.style.left = `${Math.round(p.x)}px`; el.style.top = `${Math.round(p.y)}px`;
      if (p.maxH < el.offsetHeight) el.style.maxHeight = `${p.maxH}px`;
    }
    c.trigger?.setAttribute('aria-expanded', 'true');
    c.trigger?.setAttribute('aria-controls', el.id || (el.id = `rt-${++uid}`));
    const h = el.querySelector('h4')?.textContent ?? '', k = el.querySelector('.kick .w')?.textContent ?? '';
    live.textContent = `${h}, ${k}`;
    // Focus moves into a pinned card (its first rules link, or the card itself); Esc brings it back to the trigger.
    if (c.pinned) (el.querySelector<HTMLElement>('.body .rl') ?? el).focus({ preventScroll: true });
  };
  const showCard = async (spec: CardSpec, c: { trigger: HTMLElement | null; anchor: Rect | null; pinned: boolean; history: CardSpec[] }): Promise<HTMLElement | null> => {
    const seq = ++cardSeq;
    const mod = await import('./rulecard');
    if (seq !== cardSeq) return null;
    const aud = restricted();
    const el = await mod.buildCard(spec, {
      restricted: aud, pinned: c.pinned, touch: lastType === 'touch', canBack: c.history.length > 0,
      close: () => closeCard(true),
      pin: () => { if (card) { card.pinned = true; void showCard(card.spec, { ...card }); } },
      back: () => { if (card && card.history.length) { const h = [...card.history]; const prev = h.pop()!; void showCard(prev, { ...card, history: h }); } },
      show: (s, push) => { if (card) void showCard(s, { ...card, history: push ? [...card.history, card.spec].slice(-5) : card.history }); },
    });
    // Built for one audience, mounted for the same one: a flip while loading drops it.
    if (seq !== cardSeq || !el || restricted() !== aud) return null;
    if (!el.id) el.id = `rt-${++uid}`;
    mountCard(el, { el, spec, ...c });
    return el;
  };
  const specOf = (t: HTMLElement): CardSpec => {
    const d = t.dataset, k = d.kind ?? 'rule';
    if (k === 'check') return { kind: 'check', dc: Number(d.dc), ability: d.ability, skill: d.skill, passive: d.passive ? Number(d.passive) : undefined };
    if (k === 'dice') return { kind: 'dice', expr: d.expr ?? t.textContent ?? '' };
    if (k === 'area') return { kind: 'area', key: d.key ?? '', name: d.name ?? t.textContent ?? '', floor: d.floor, desc: d.desc, revealed: d.revealed ? d.revealed === 'true' : undefined };
    if (k === 'person') return { kind: 'person', name: d.name ?? t.textContent ?? '', role: d.role, home: d.home };
    if (k === 'pageref') return { kind: 'pageref', page: Number(d.page), where: d.where };
    if (k === 'measure') return { kind: 'measure', rule: d.rule === 'five-ten-five' || d.rule === 'hex' ? d.rule : 'five', ft: Number(d.ft), squares: Number(d.squares) };
    // A module creature (a token's name, a bestiary row, a creature slot the books lack): its one source decides.
    if (d.creature || d.term?.startsWith('creature:')) return { kind: 'creature', creatureId: d.creature ?? d.term!.slice(9), name: d.name };
    return { term: d.term ?? t.textContent ?? '', kind: k as never, edition: d.edition === '2014' || d.edition === '2024' ? d.edition : undefined };
  };
  const openFromLink = (t: HTMLElement, pinned: boolean) => {
    // A link inside an open card replaces its content (a back chevron returns, five deep).
    if (card && card.el.contains(t)) return void showCard(specOf(t), { ...card, pinned: true, history: [...card.history, card.spec].slice(-5) });
    if (card && card.trigger === t) { if (pinned && !card.pinned) { card.pinned = true; void showCard(card.spec, { ...card }); return; } if (pinned) return closeCard(); return; }
    closeCard(); closePinned(); hideHover();
    void showCard(specOf(t), { trigger: t, anchor: t.getBoundingClientRect(), pinned, history: [] });
  };

  // ---- events: hover by mouse and pen
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    lastType = e.pointerType || 'mouse';
    const t = triggerOf(e.target);
    if (!t || t === hoverFor || (card && card.trigger === t)) return;
    clearTimeout(hoverTimer);
    if (hoverFor && hoverFor !== t) hideHover();
    hoverTimer = window.setTimeout(() => {
      hoverTimer = 0;
      if (!t.isConnected || !t.matches(':hover')) return;
      if (kindOfTrigger(t) === 'rl') { if (!card?.pinned && !t.closest('#tips')) openFromLink(t, false); } else showHover(t);
    }, kindOfTrigger(t) === 'rl' ? RL_HOVER_MS : HOVER_MS);
  }, true);
  document.addEventListener('pointerout', (e) => {
    if (e.pointerType === 'touch') return;
    const t = triggerOf(e.target);
    if (!t || (e.relatedTarget instanceof Node && t.contains(e.relatedTarget))) return;
    clearTimeout(hoverTimer); hoverTimer = 0;
    if (hoverFor === t) hideHover();
  }, true);
  // A hover-opened card closes 250 ms after the pointer leaves it and its link (with a 50 px buffer).
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || !card || card.pinned) return;
    const r = card.el.getBoundingClientRect();
    const near = (e.clientX >= r.left - BUFFER && e.clientX <= r.right + BUFFER && e.clientY >= r.top - BUFFER && e.clientY <= r.bottom + BUFFER)
      || (!!card.trigger && card.trigger.contains(e.target as Node));
    if (near) { clearTimeout(graceTimer); graceTimer = 0; } else if (!graceTimer) graceTimer = window.setTimeout(() => { graceTimer = 0; if (card && !card.pinned) closeCard(); }, GRACE_MS);
  }, { passive: true });
  // Keyboard focus shows an action button's tip at once.
  document.addEventListener('focusin', (e) => {
    const t = triggerOf(e.target);
    if (t && kindOfTrigger(t) === 'tip' && t.matches(':focus-visible')) showHover(t);
  });
  document.addEventListener('focusout', (e) => { if (hoverFor && hoverFor === e.target) hideHover(); });

  // ---- the one outside handler (capture), then the touch hold
  addEventListener('pointerdown', (e) => {
    lastType = e.pointerType || 'mouse';
    const target = e.target as Element;
    hideHover(); clearTimeout(hoverTimer); hideCanvas();
    // 1. A press inside a card, a pinned tip, a rules link or a toggletip is theirs.
    if (!target.closest('#tips .rt, #tips .tip.pinned, .rl, button.tt')) {
      // 2. Outside an open card or pinned tip: close only that (a press on the map does nothing else).
      if (card || pinnedEl) {
        closeCard(); closePinned();
        if (target.closest('canvas.gl')) e.stopPropagation();
        return;
      }
      // 3. Otherwise the open tap menu or info card closes, as before.
      const m = host.menu();
      if (m && !m.contains(target)) host.closeMenu();
    }
    // Touch: hold an action button 500 ms to see its name; release still presses it.
    if (e.pointerType === 'touch') {
      const t = triggerOf(target);
      if (hold) clearTimeout(hold.timer);
      hold = null;
      if (t && kindOfTrigger(t) === 'tip' && !target.closest(HOLD_EXCLUDE) && !t.matches(HOLD_EXCLUDE)) {
        const h = { el: t, x: e.clientX, y: e.clientY, timer: 0, shown: false, id: e.pointerId };
        h.timer = window.setTimeout(() => { if (hold === h && t.isConnected) { h.shown = true; showHover(t); } }, HOLD_MS);
        hold = h;
      }
    }
  }, true);
  addEventListener('pointermove', (e) => {
    if (!hold || e.pointerId !== hold.id) return;
    if (Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 10 && !hold.shown) { clearTimeout(hold.timer); hold = null; }
  }, { capture: true, passive: true });
  addEventListener('pointerup', (e) => {
    if (!hold || e.pointerId !== hold.id) return;
    const h = hold; hold = null; clearTimeout(h.timer);
    if (!h.shown) return;
    hideHover();
    // The browser may treat a long press as a context press and drop the click: fire it here, once.
    const r = h.el.getBoundingClientRect();
    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
      swallow = { el: h.el, until: performance.now() + 800 };
      h.el.click();
    }
  }, true);
  addEventListener('pointercancel', () => { if (hold) { clearTimeout(hold.timer); if (hold.shown) hideHover(); hold = null; } }, true);
  addEventListener('contextmenu', (e) => { if (hold || (e.target instanceof Element && e.target.closest('.rl, button.tt, [data-tip]') && lastType === 'touch')) e.preventDefault(); }, true);

  // ---- clicks: toggletips and rules links (the manager owns them), and the swallowed native click after a hold
  addEventListener('click', (e) => {
    const target = e.target as Element;
    if (swallow && e.isTrusted && performance.now() < swallow.until && swallow.el.contains(target)) { swallow = null; e.stopImmediatePropagation(); e.preventDefault(); return; }
    const t = triggerOf(target);
    if (!t) return;
    const k = kindOfTrigger(t);
    if (k === 'tt') { e.stopPropagation(); togglePinned(t); }
    else if (k === 'rl') { e.stopPropagation(); e.preventDefault(); openFromLink(t, true); }
  }, true);

  // ---- the Esc stack: a card, then a pinned tip; with nothing open, Esc goes on to the app as before
  addEventListener('keydown', (e) => {
    if (e.key !== KEYMAP.escape.key) return;
    if (card) { closeCard(true); e.stopImmediatePropagation(); e.preventDefault(); return; }
    if (pinnedEl) { closePinned(true); e.stopImmediatePropagation(); e.preventDefault(); return; }
    hideHover();
  }, true);

  // ---- view flips and new surfaces close everything
  const closeAll = () => { hideHover(); closePinned(); closeCard(); hideCanvas(); if (hold) { clearTimeout(hold.timer); hold = null; } };
  const flip = () => { closeAll(); for (const f of flips) f(); };
  // Only a real change flips (refresh() writes the same data-view again on every redraw).
  new MutationObserver((rs) => { if (rs.some((r) => r.oldValue !== document.body.getAttribute(r.attributeName!))) flip(); })
    .observe(document.body, { attributes: true, attributeOldValue: true, attributeFilter: ['data-view', 'data-mode'] });
  addEventListener('mistlab:view', flip);
  new MutationObserver((rs) => { for (const r of rs) for (const n of r.addedNodes) if (n instanceof HTMLElement && n.matches('.sheet-backdrop')) return closeAll(); })
    .observe(document.body, { childList: true });

  mounted = {
    layer,
    clear: () => { hideHover(); hideCanvas(); },
    closeAll,
    canvasTip: (t, x, y) => {
      if (!t) return hideCanvas();
      const html = renderTip([{ text: t.title, audience: restricted() ? 'player' : 'dm' }, ...(t.sub ? [{ text: t.sub, audience: restricted() ? 'player' as const : 'dm' as const }] : [])], { restricted: restricted() });
      if (!html) return hideCanvas();
      const enter = t.enter && !restricted() ? `<em>${ICON.doorOpen}<i>${esc(t.enter)}</i></em>` : '';
      if (!canvasEl) { canvasEl = document.createElement('div'); canvasEl.className = 'tip canvas'; canvasEl.setAttribute('role', 'tooltip'); layer.appendChild(canvasEl); }
      canvasEl.innerHTML = html + enter; canvasEl.hidden = false;
      canvasEl.style.left = `${Math.min(x + 14, innerWidth - canvasEl.offsetWidth - 8)}px`;
      canvasEl.style.top = `${Math.min(y + 16, innerHeight - canvasEl.offsetHeight - 8)}px`;
    },
    openCard: (spec, o = {}) => { closeCard(); closePinned(); hideHover(); return showCard(spec, { trigger: o.trigger ?? null, anchor: o.anchor ? rectOf(o.anchor) : null, pinned: o.pinned ?? true, history: [] }); },
    state: () => ({ hover: !!hoverEl || !!canvasEl, pinned: !!pinnedEl, card: !!card, cardKind: card?.el.dataset.kind }),
    onFlip: (fn) => { flips.push(fn); },
  };
  return mounted;
}
