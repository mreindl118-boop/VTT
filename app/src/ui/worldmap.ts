// World map of Barovia: original 2D art drawn from measured positions (locations/ch02/barovia-region/world.json).
// The party marker mirrors campaign state. The DM drags it to a pin (enter a built scene there) or into the
// wilderness; the card shows straight-line distance and travel time at the chosen pace.
import world from '../../../locations/ch02/barovia-region/world.json';
import { PACES, type Pace } from '../core/travel';
import { ICON } from './icons';

type P = [number, number];
interface Pin { key: string; name: string; pos: P; type: string; scenes?: string[] }
const W = world as unknown as {
  name: string; bounds: { minX: number; minY: number; maxX: number; maxY: number };
  pins: Pin[]; roads: { name: string; pts: P[] }[]; rivers: { name: string; pts: P[] }[];
  lakes: { name: string; center: P; r: P }[]; peaks: { name: string; pos: P }[]; woods: { name: string; pos: P }[]; high: P[];
};

export const WORLD_PINS = W.pins;
/** The pin a built scene belongs to (the party marker jumps there when that scene opens). */
export const pinForScene = (path: string): Pin | undefined => W.pins.find((p) => p.scenes?.includes(path));

const SNAP_MI = 0.35;
const dist = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const NS = 'http://www.w3.org/2000/svg';
const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element): SVGElementTagNameMap[K] => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
};
const path = (pts: P[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
const fmtHours = (h: number) => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return hh ? `${hh} h${mm ? ` ${mm} min` : ''}` : `${mm} min`; };

export interface WorldHost {
  canMove: boolean;
  get(): { pos: P; key?: string } | undefined;
  move(pos: P, key: string | undefined, miles: number): void;
  enter(scene: string): void;
  sceneName(path: string): Promise<string>;
}

export function openWorldMap(host: WorldHost): void {
  const back = document.createElement('div');
  back.className = 'sheet-backdrop worldmap';
  back.innerHTML = `<div class="sheet world"><header><h2>${W.name}</h2>
      <div class="seg pace" role="tablist" aria-label="Travel pace">${(['slow', 'normal', 'fast'] as Pace[]).map((p) => `<button role="tab" data-pace="${p}" aria-selected="${p === 'normal'}">${p[0].toUpperCase() + p.slice(1)}</button>`).join('')}</div>
      <button class="icon" data-z="in" aria-label="Zoom in">${ICON.zoomIn}</button><button class="icon" data-z="out" aria-label="Zoom out">${ICON.zoomOut}</button>
      <button class="icon close" aria-label="Close">${ICON.close}</button></header>
    <div class="world-body"><div class="world-card" hidden></div></div></div>`;
  document.body.appendChild(back);
  const body = back.querySelector<HTMLElement>('.world-body')!, card = back.querySelector<HTMLElement>('.world-card')!;
  let pace: Pace = 'normal';

  // --- the map (units: miles)
  const b = W.bounds, pad = 0.6;
  const vb = { x: b.minX - pad, y: b.minY - pad, w: b.maxX - b.minX + 2 * pad, h: b.maxY - b.minY + 2 * pad };
  const svg = el('svg', { class: 'world-svg', viewBox: `${vb.x} ${vb.y} ${vb.w} ${vb.h}`, preserveAspectRatio: 'xMidYMid meet' });
  body.prepend(svg);
  const defs = el('defs', {}, svg);
  const blur = el('filter', { id: 'wm-soft', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs); el('feGaussianBlur', { stdDeviation: 0.35 }, blur);
  el('rect', { x: vb.x - 50, y: vb.y - 50, width: vb.w + 100, height: vb.h + 100, class: 'wm-ground' }, svg);
  // Mists at the edge of the land.
  el('rect', { x: vb.x, y: vb.y, width: vb.w, height: vb.h, class: 'wm-mist', rx: 0.8 }, svg);
  // Terrain fields: deterministic noise, so the map looks the same every time.
  const hash = (x: number, y: number) => { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };
  const near = (p: P, list: P[], r: number) => list.reduce((s, q) => s + Math.exp(-((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2) / (2 * r * r)), 0);
  const highPts = [...W.high, ...W.peaks.map((p) => p.pos)], woodPts = W.woods.map((w) => w.pos);
  const onWater = (p: P) => W.lakes.some((l) => ((p[0] - l.center[0]) / (l.r[0] + 0.2)) ** 2 + ((p[1] - l.center[1]) / (l.r[1] + 0.2)) ** 2 < 1);
  const nearRoad = (p: P) => W.roads.some((r) => r.pts.some((q) => dist(p, q) < 0.28));
  const hills = el('g', { class: 'wm-hills' }, svg), woods = el('g', { class: 'wm-woods' }, svg), peaks = el('g', { class: 'wm-peaks' }, svg);
  for (let y = b.minY; y <= b.maxY; y += 0.3) for (let x = b.minX; x <= b.maxX; x += 0.3) {
    const j = hash(x, y), p: P = [x + (j - 0.5) * 0.25, y + (hash(y, x) - 0.5) * 0.25];
    if (onWater(p)) continue;
    const hi = near(p, highPts, 1.1), wd = near(p, woodPts, 3.2) * 0.6 + 0.35;
    if (hi > 0.6 && j > 0.45) { const s = 0.16 + hi * 0.08 + j * 0.08; el('path', { d: `M${p[0] - s},${p[1] + s * 0.7} L${p[0]},${p[1] - s} L${p[0] + s},${p[1] + s * 0.7} Z`, class: hi > 1.45 ? 'snow' : '' }, peaks); }
    else if (hi > 0.3) el('circle', { cx: p[0], cy: p[1], r: 0.2 }, hills);
    else if (wd + j * 0.5 > 0.7 && !nearRoad(p)) el('circle', { cx: p[0], cy: p[1], r: 0.13 + j * 0.08 }, woods);
  }
  const water = el('g', { class: 'wm-water' }, svg);
  for (const l of W.lakes) el('ellipse', { cx: l.center[0], cy: l.center[1], rx: l.r[0], ry: l.r[1] }, water);
  for (const r of W.rivers) el('path', { d: path(r.pts), class: 'wm-river' }, water);
  const roads = el('g', { class: 'wm-roads' }, svg);
  for (const r of W.roads) el('path', { d: path(r.pts) }, roads);
  const names = el('g', { class: 'wm-names' }, svg);
  for (const p of W.peaks) el('text', { x: p.pos[0], y: p.pos[1] + 0.9 }, names).textContent = p.name;
  for (const l of W.lakes) if (l.r[0] > 0.5) el('text', { x: l.center[0], y: l.center[1] + 0.1 }, names).textContent = l.name;
  for (const w of W.woods) { const t = el('text', { x: w.pos[0], y: w.pos[1], class: 'wm-wood-name' }, names); t.textContent = w.name; }
  // Trail of past moves.
  const trail = el('path', { class: 'wm-trail', d: '' }, svg);
  // Pins.
  const pins = el('g', { class: 'wm-pins' }, svg);
  for (const p of W.pins) {
    const major = ['settlement', 'castle', 'camp', 'tower', 'temple', 'ruin', 'pass', 'den', 'hill'].includes(p.type);
    const g = el('g', { class: `wm-pin t-${p.type}${p.scenes ? ' has-scene' : ''}${major ? ' major' : ''}`, transform: `translate(${p.pos[0]},${p.pos[1]})` }, pins);
    el('circle', { r: 0.26 }, g);
    const t = el('text', { y: 0.09 }, g); t.textContent = p.key.replace('2', '');
    const n = el('text', { class: 'wm-pin-name', y: 0.62 }, g); n.textContent = p.name;
    el('title', {}, g).textContent = `${p.key.replace('2', '')} · ${p.name}${p.scenes ? ' · map ready' : ''}`;
  }
  // Party marker.
  const party = el('g', { class: `wm-party${host.canMove ? ' movable' : ''}` }, svg);
  el('circle', { r: 0.42, class: 'halo' }, party); el('circle', { r: 0.3 }, party);
  const icon = el('path', { d: 'M0,-0.16 a0.07,0.07 0 1 1 0.001,0 M-0.13,0.15 q0.13,-0.22 0.26,0', class: 'glyph' }, party); void icon;
  el('title', {}, party).textContent = host.canMove ? 'The party · drag to travel' : 'The party';
  const start = host.get() ?? { pos: W.pins.find((p) => p.key === 'E')!.pos };
  let at: P = [...start.pos] as P;
  const place = (p: P) => party.setAttribute('transform', `translate(${p[0]},${p[1]})`);
  place(at);

  // --- view: pan and zoom by editing the viewBox
  const view = { ...vb };
  const apply = () => svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
  const toMap = (e: PointerEvent | WheelEvent): P => { const r = svg.getBoundingClientRect(), s = Math.max(view.w / r.width, view.h / r.height); const ox = (r.width * s - view.w) / 2, oy = (r.height * s - view.h) / 2; return [view.x - ox + (e.clientX - r.left) * s, view.y - oy + (e.clientY - r.top) * s]; };
  const zoom = (k: number, c: P = [view.x + view.w / 2, view.y + view.h / 2]) => { const w = Math.min(vb.w * 1.2, Math.max(2.5, view.w * k)), h = (w / view.w) * view.h; view.x = c[0] - ((c[0] - view.x) * w) / view.w; view.y = c[1] - ((c[1] - view.y) * h) / view.h; view.w = w; view.h = h; apply(); };
  svg.addEventListener('wheel', (e) => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, toMap(e)); }, { passive: false });
  let drag: { kind: 'pan'; x: number; y: number; vx: number; vy: number } | { kind: 'party' } | null = null;
  svg.addEventListener('pointerdown', (e) => {
    if (host.canMove && (e.target as Element).closest('.wm-party')) { drag = { kind: 'party' }; card.hidden = true; }
    else drag = { kind: 'pan', x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (drag.kind === 'pan') { const r = svg.getBoundingClientRect(), s = Math.max(view.w / r.width, view.h / r.height); view.x = drag.vx - (e.clientX - drag.x) * s; view.y = drag.vy - (e.clientY - drag.y) * s; apply(); return; }
    const p = toMap(e), near = W.pins.find((x) => dist(x.pos, p) < SNAP_MI);
    place(near ? near.pos : p);
    party.classList.toggle('snap', !!near);
  });
  svg.addEventListener('pointerup', (e) => {
    const d = drag; drag = null;
    if (!d || d.kind !== 'party') return;
    const p = toMap(e), near = W.pins.find((x) => dist(x.pos, p) < SNAP_MI), to: P = near ? [...near.pos] as P : [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100];
    const miles = dist(at, to);
    if (miles < 0.05) { place(at); return; }
    host.move(to, near?.key, miles);
    at = to; place(at); drawTrail();
    void showCard(near, to, miles);
  });
  const drawTrail = () => { const t = host.get(); const pts = (t as { trail?: { pos: P }[] } | undefined)?.trail?.map((x) => x.pos) ?? []; trail.setAttribute('d', pts.length > 1 ? path(pts.slice(-12)) : ''); };
  drawTrail();

  const nearestName = (p: P) => { const all = [...W.pins.map((x) => ({ name: x.name, pos: x.pos })), ...W.woods, ...W.peaks]; const n = all.reduce((a, c) => (dist(c.pos, p) < dist(a.pos, p) ? c : a)); return { name: n.name, mi: dist(n.pos, p) }; };
  async function showCard(pin: Pin | undefined, to: P, miles: number): Promise<void> {
    const mph = PACES[pace].mph, hours = miles / mph;
    const where = pin ? `<b>${pin.key.replace('2', '')}</b> ${pin.name}` : (() => { const n = nearestName(to); return `Wilderness · ${n.mi.toFixed(1)} mi from ${n.name}`; })();
    const scenes = pin?.scenes ?? [];
    const labels = await Promise.all(scenes.map((s) => host.sceneName(s)));
    card.innerHTML = `<div class="wc-where">${where}</div><div class="wc-travel">${miles.toFixed(1)} mi as the crow flies · about ${fmtHours(hours)} at a ${pace} pace (${mph} mph)</div>
      ${scenes.length ? `<div class="wc-actions">${scenes.map((s, i) => `<button class="primary" data-scene="${s}">Open ${labels[i]}</button>`).join('')}</div>` : '<div class="wc-note">No battle map here yet; run it theatre-of-the-mind or pick a nearby pin.</div>'}`;
    card.hidden = false;
  }
  card.addEventListener('click', (e) => { const s = (e.target as HTMLElement).closest<HTMLElement>('[data-scene]')?.dataset.scene; if (s) { host.enter(s); back.remove(); } });
  back.querySelector('.pace')!.addEventListener('click', (e) => { const b2 = (e.target as HTMLElement).closest<HTMLElement>('[data-pace]'); if (!b2) return; pace = b2.dataset.pace as Pace; back.querySelectorAll('[data-pace]').forEach((x) => x.setAttribute('aria-selected', String(x === b2))); });
  back.addEventListener('click', (e) => { const t = e.target as HTMLElement; if (t === back || t.closest('.close')) back.remove(); const z = t.closest<HTMLElement>('[data-z]')?.dataset.z; if (z) zoom(z === 'in' ? 0.75 : 1.33); });
  addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { back.remove(); removeEventListener('keydown', esc); } });
}
