// World map: an illustrated regional map painted from the campaign's world data (original art), with an
// interactive layer on top: lettered places, a key panel, a hex grid at the map's scale, a scale bar, a
// compass, and the party marker that mirrors campaign state. The DM drags the party to a place (enter a
// built scene there) or into the wilderness; the card gives straight-line distance and travel time.
import type { WorldData } from '../campaigns';
import { PACES, type Pace } from '../core/travel';
import { ICON } from './icons';

type P = [number, number];
interface Pin { key: string; name: string; pos: P; type: string; scenes?: string[]; blurb?: string; dm?: string }
let W: WorldData & { milesPerHex?: number } = { name: '', bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 }, pins: [], roads: [], rivers: [], lakes: [], peaks: [], woods: [], high: [] };
let STYLE: 'gothic' | 'pastoral' = 'gothic';
/** Point the world map at the active campaign's data and look. */
export function useWorld(w: WorldData, style: 'gothic' | 'pastoral' = 'gothic'): void { W = w; STYLE = style; }
/** The pin a built scene belongs to (the party marker jumps there when that scene opens). */
export const pinForScene = (path: string): Pin | undefined => W.pins.find((p) => p.scenes?.includes(path));
export const worldPins = (): Pin[] => W.pins;

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
const keyOf = (p: Pin) => p.key.replace('2', '');

// ---------------------------------------------------------------- the painted base layer
const PALETTES = {
  gothic: { ground: ['#7f8a6c', '#6d7a5f'], moor: '#8a8f78', wood: ['#3f5d3f', '#2f4a33'], woodEdge: '#28392a', hill: '#8b8672', hillShade: '#6a655a', rock: '#8e8b86', snow: '#e4e6ea', water: '#5e7d94', waterEdge: '#3f5a70', road: '#b8a06a', roadCase: '#6b5a3a', ink: '#2a2420', town: '#5a4a3a', mistEdge: 'rgba(212,214,222,.55)' },
  pastoral: { ground: ['#b9c98a', '#a7b97b'], moor: '#c7cf9c', wood: ['#5f8f4c', '#4d7a3f'], woodEdge: '#3f6633', hill: '#c2b98f', hillShade: '#9a9370', rock: '#a8a49a', snow: '#f2f3f5', water: '#7fa9c4', waterEdge: '#5a86a3', road: '#d6b980', roadCase: '#8a7248', ink: '#3a2f24', town: '#7a5e44', mistEdge: 'rgba(255,255,255,.35)' },
} as const;

function paint(cv: HTMLCanvasElement, vb: { x: number; y: number; w: number; h: number }): void {
  const C = PALETTES[STYLE], ctx = cv.getContext('2d')!, S = cv.width / vb.w; // px per mile
  const X = (x: number) => (x - vb.x) * S, Y = (y: number) => (y - vb.y) * S;
  const hash = (x: number, y: number) => { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };
  const near = (p: P, list: P[], r: number) => list.reduce((s, q) => s + Math.exp(-((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2) / (2 * r * r)), 0);
  const span = Math.max(vb.w, vb.h), kw = Math.max(0.6, span * 0.16), kh = Math.max(0.5, span * 0.055);
  const highPts = [...W.high, ...W.peaks.map((p) => p.pos)], woodPts = W.woods.map((w) => w.pos);
  const woodDensity = (p: P) => (near(p, woodPts, kw) / Math.max(1, W.woods.length / 5)) * 0.6;
  const highDensity = (p: P) => near(p, highPts, kh) * (W.high.length > 40 ? 0.35 : 1);
  const inWater = (p: P) => W.lakes.some((l) => ((p[0] - l.center[0]) / l.r[0]) ** 2 + ((p[1] - l.center[1]) / l.r[1]) ** 2 < 1);
  // 1. ground: two-tone noise
  ctx.fillStyle = C.ground[0]; ctx.fillRect(0, 0, cv.width, cv.height);
  const cell = Math.max(4, Math.round(S * 0.08));
  for (let py = 0; py < cv.height; py += cell) for (let px = 0; px < cv.width; px += cell) {
    const n = hash(px * 0.37, py * 0.53) * 0.5 + hash(px * 0.11, py * 0.17) * 0.5;
    ctx.fillStyle = n > 0.55 ? C.ground[1] : n < 0.2 ? C.moor : C.ground[0];
    ctx.globalAlpha = 0.5; ctx.fillRect(px, py, cell, cell);
  }
  ctx.globalAlpha = 1;
  // 2. woods: soft tracts, then tree symbols
  const step = Math.max(0.12, span * 0.014);
  const treeR = S * step * 0.55;
  const trees: P[] = [];
  for (let y = vb.y; y <= vb.y + vb.h; y += step) for (let x = vb.x; x <= vb.x + vb.w; x += step) {
    const j = hash(x, y), p: P = [x + (j - 0.5) * step * 0.9, y + (hash(y, x) - 0.5) * step * 0.9];
    if (inWater(p)) continue;
    const wd = woodDensity(p) + j * 0.35, hi = highDensity(p);
    if (wd > 0.62 && hi < 0.55) { ctx.fillStyle = C.wood[j > 0.5 ? 0 : 1]; ctx.globalAlpha = 0.28; ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), treeR * 3.2, 0, Math.PI * 2); ctx.fill(); trees.push(p); }
  }
  ctx.globalAlpha = 1;
  for (const p of trees) {
    const x = X(p[0]), y = Y(p[1]), r = treeR * (0.8 + hash(p[1], p[0]) * 0.5);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.arc(x + r * 0.35, y + r * 0.45, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hash(p[0] * 3, p[1] * 7) > 0.5 ? C.wood[0] : C.wood[1]; ctx.strokeStyle = C.woodEdge; ctx.lineWidth = Math.max(0.6, r * 0.12);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, Math.PI * 2); ctx.fill();
  }
  // 3. hills and mountains: humps with a shaded side; peaks with snow
  const hills: { p: P; h: number }[] = [];
  for (let y = vb.y; y <= vb.y + vb.h; y += step * 1.6) for (let x = vb.x; x <= vb.x + vb.w; x += step * 1.6) {
    const j = hash(x * 5, y * 3), p: P = [x + (j - 0.5) * step, y + (hash(y * 5, x * 3) - 0.5) * step];
    const hi = highDensity(p); if (hi > 0.3 && !inWater(p)) hills.push({ p, h: hi });
  }
  hills.sort((a, b) => a.p[1] - b.p[1]);
  for (const { p, h } of hills) {
    const x = X(p[0]), y = Y(p[1]), s = S * step * (0.9 + Math.min(1.6, h) * 0.9), mountain = h > 0.95;
    ctx.beginPath(); ctx.moveTo(x - s, y + s * 0.55); ctx.quadraticCurveTo(x - s * 0.3, y - s * (mountain ? 1.3 : 0.6), x, y - s * (mountain ? 1.3 : 0.6)); ctx.quadraticCurveTo(x + s * 0.3, y - s * (mountain ? 1.3 : 0.6), x + s, y + s * 0.55); ctx.closePath();
    ctx.fillStyle = mountain ? C.rock : C.hill; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, y - s * (mountain ? 1.3 : 0.6)); ctx.quadraticCurveTo(x + s * 0.3, y - s * (mountain ? 1.3 : 0.6), x + s, y + s * 0.55); ctx.lineTo(x, y + s * 0.55); ctx.closePath();
    ctx.fillStyle = C.hillShade; ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(0.6, s * 0.06); ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(x - s, y + s * 0.55); ctx.quadraticCurveTo(x - s * 0.3, y - s * (mountain ? 1.3 : 0.6), x, y - s * (mountain ? 1.3 : 0.6)); ctx.stroke(); ctx.globalAlpha = 1;
    if (h > 1.7) { ctx.fillStyle = C.snow; ctx.beginPath(); ctx.moveTo(x, y - s * 1.3); ctx.lineTo(x - s * 0.28, y - s * 0.75); ctx.lineTo(x - s * 0.1, y - s * 0.85); ctx.lineTo(x + 0.05 * s, y - s * 0.7); ctx.lineTo(x + s * 0.28, y - s * 0.75); ctx.closePath(); ctx.fill(); }
  }
  // 4. water: lakes and rivers with a darker bank
  for (const l of W.lakes) {
    ctx.fillStyle = C.waterEdge; ctx.beginPath(); ctx.ellipse(X(l.center[0]) + S * 0.03, Y(l.center[1]) + S * 0.04, l.r[0] * S, l.r[1] * S, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.water; ctx.beginPath(); ctx.ellipse(X(l.center[0]), Y(l.center[1]), l.r[0] * S * 0.96, l.r[1] * S * 0.94, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = Math.max(0.8, S * 0.02);
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(X(l.center[0]), Y(l.center[1]), l.r[0] * S * (0.3 + k * 0.2), l.r[1] * S * (0.25 + k * 0.2), 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
  }
  const stroke = (pts: P[], color: string, w: number, dash?: number[]) => { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash(dash ?? []); ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); ctx.stroke(); ctx.setLineDash([]); };
  for (const r of W.rivers) { stroke(r.pts, C.waterEdge, Math.max(2, S * 0.16)); stroke(r.pts, C.water, Math.max(1.2, S * 0.1)); }
  // 5. roads: casing and fill; paths dashed
  for (const r of W.roads) { const p = /path|trail/i.test(r.name); stroke(r.pts, C.roadCase, Math.max(2.4, S * 0.13)); stroke(r.pts, C.road, Math.max(1.4, S * 0.08), p ? [S * 0.2, S * 0.12] : undefined); }
  // 6. settlements and landmarks as symbols under the pins
  for (const p of W.pins) {
    const x = X(p.pos[0]), y = Y(p.pos[1]), u = Math.max(3, S * 0.09);
    if (p.type === 'settlement') {
      const n = p.name.match(/Town|Village/i) ? 7 : 4;
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, rx = x + Math.cos(a) * u * 2.2, ry = y + Math.sin(a) * u * 1.4;
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(rx - u * 0.7 + 1.5, ry - u * 0.5 + 1.5, u * 1.4, u); ctx.fillStyle = C.town; ctx.fillRect(rx - u * 0.7, ry - u * 0.5, u * 1.4, u);
        ctx.fillStyle = '#b03a30'; ctx.beginPath(); ctx.moveTo(rx - u * 0.8, ry - u * 0.5); ctx.lineTo(rx, ry - u * 1.15); ctx.lineTo(rx + u * 0.8, ry - u * 0.5); ctx.closePath(); ctx.fill(); }
    } else if (p.type === 'castle' || p.type === 'tower' || p.type === 'temple') {
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x - u * 1.3 + 2, y - u * 0.4 + 2, u * 2.6, u * 1.6);
      ctx.fillStyle = C.ink; ctx.fillRect(x - u * 1.3, y - u * 0.4, u * 2.6, u * 1.6);
      for (let i = -1; i <= 1; i++) ctx.fillRect(x + i * u * 0.9 - u * 0.3, y - u * 1.4, u * 0.6, u * 1.2);
    } else if (p.type === 'camp') {
      for (let i = -1; i <= 1; i++) { ctx.fillStyle = i ? '#d9d2c2' : '#c94a3a'; ctx.beginPath(); ctx.moveTo(x + i * u * 1.6 - u * 0.7, y + u * 0.5); ctx.lineTo(x + i * u * 1.6, y - u * 0.7); ctx.lineTo(x + i * u * 1.6 + u * 0.7, y + u * 0.5); ctx.closePath(); ctx.fill(); }
    } else if (p.type === 'ruin') {
      ctx.fillStyle = C.rock; for (let i = -1; i <= 1; i++) ctx.fillRect(x + i * u * 0.9 - u * 0.25, y - u * (0.4 + (i ? 0.3 : 0.8)), u * 0.5, u * (0.8 + (i ? 0.3 : 0.8)));
    }
  }
  // 7. mist / vignette at the edges
  const g = ctx.createRadialGradient(cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * 0.42, cv.width / 2, cv.height / 2, Math.max(cv.width, cv.height) * 0.72);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, C.mistEdge); ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
}

// ---------------------------------------------------------------- the sheet
export interface WorldHost {
  canMove: boolean;
  /** The DM's end: every place shows, with its DM note, and each can be revealed to or hidden from the players. */
  dm: boolean;
  revealed(): Set<string>;
  reveal(key: string, on: boolean): void;
  get(): { pos: P; key?: string } | undefined;
  move(pos: P, key: string | undefined, miles: number): void;
  enter(scene: string): void;
  sceneName(path: string): Promise<string>;
}

export function openWorldMap(host: WorldHost): void {
  const back = document.createElement('div');
  back.className = 'sheet-backdrop worldmap';
  const mph = W.milesPerHex ?? 1;
  back.innerHTML = `<div class="sheet world"><header><div class="wm-title"><h2>${W.name}</h2><span>1 hex = ${mph === 0.25 ? '¼ mile' : mph === 0.5 ? '½ mile' : `${mph} mile${mph > 1 ? 's' : ''}`} · north up</span></div>
      <div class="seg pace" role="tablist" aria-label="Travel pace">${(['slow', 'normal', 'fast'] as Pace[]).map((p) => `<button role="tab" data-pace="${p}" aria-selected="${p === 'normal'}">${p[0].toUpperCase() + p.slice(1)}</button>`).join('')}</div>
      <button class="icon" data-hex aria-label="Hex grid" aria-pressed="false" title="Hex grid">${ICON.grid ?? ICON.walls}</button>
      <button class="icon" data-z="in" aria-label="Zoom in">${ICON.zoomIn}</button><button class="icon" data-z="out" aria-label="Zoom out">${ICON.zoomOut}</button>
      <button class="icon close" aria-label="Close">${ICON.close}</button></header>
    <div class="world-main"><div class="world-body"><canvas class="world-paint"></canvas><div class="world-card" hidden></div><div class="world-scale"></div><div class="world-compass">N</div></div>
    <aside class="world-key"><h3>Places</h3><ol></ol></aside></div></div>`;
  document.body.appendChild(back);
  const body = back.querySelector<HTMLElement>('.world-body')!, card = back.querySelector<HTMLElement>('.world-card')!, keyList = back.querySelector<HTMLElement>('.world-key ol')!;
  const paintCv = back.querySelector<HTMLCanvasElement>('.world-paint')!, scaleEl = back.querySelector<HTMLElement>('.world-scale')!;
  let pace: Pace = 'normal';

  // --- the map (units: miles)
  const b = W.bounds, pad = 0.6;
  const vb = { x: b.minX - pad, y: b.minY - pad, w: b.maxX - b.minX + 2 * pad, h: b.maxY - b.minY + 2 * pad };
  const svg = el('svg', { class: 'world-svg', viewBox: `${vb.x} ${vb.y} ${vb.w} ${vb.h}`, preserveAspectRatio: 'xMidYMid meet' });
  body.insertBefore(svg, card);
  // painted base: fixed resolution, blitted under the SVG with the same view transform
  const PX = 2600; paintCv.width = PX; paintCv.height = Math.round((PX * vb.h) / vb.w);
  paint(paintCv, vb);
  const view = { ...vb };
  const screen = document.createElement('canvas'); screen.className = 'world-screen'; body.insertBefore(screen, svg);
  paintCv.hidden = true;
  const blit = () => {
    const r = body.getBoundingClientRect(); screen.width = Math.round(r.width * devicePixelRatio); screen.height = Math.round(r.height * devicePixelRatio);
    const cx = screen.getContext('2d')!, s = Math.max(view.w / r.width, view.h / r.height); // miles per css px (meet)
    const ox = (r.width * s - view.w) / 2, oy = (r.height * s - view.h) / 2;
    const pxPerMile = devicePixelRatio / s;
    cx.fillStyle = STYLE === 'gothic' ? '#1d2126' : '#cfd6d2'; cx.fillRect(0, 0, screen.width, screen.height);
    cx.imageSmoothingEnabled = true;
    cx.drawImage(paintCv, ((vb.x - (view.x - ox)) * pxPerMile), ((vb.y - (view.y - oy)) * pxPerMile), vb.w * pxPerMile, vb.h * pxPerMile);
    // scale bar: a round number of miles that fits ~120 css px
    const target = 120 / (pxPerMile / devicePixelRatio), nice = [0.25, 0.5, 1, 2, 5, 10, 20].reduce((a, c) => (Math.abs(c - target) < Math.abs(a - target) ? c : a));
    scaleEl.innerHTML = `<i style="width:${(nice * pxPerMile) / devicePixelRatio}px"></i><span>${nice < 1 ? `${nice * 5280 / 1000 | 0},${String(nice * 5280 % 1000).padStart(3, '0')} ft` : `${nice} mile${nice > 1 ? 's' : ''}`}</span>`;
  };
  const apply = () => { svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`); blit(); };
  new ResizeObserver(blit).observe(body);

  // hex grid at the map's scale (pointy hexes, flat-to-flat = milesPerHex)
  const hexes = el('g', { class: 'wm-hex', visibility: 'hidden' }, svg);
  { const f = mph, hh = (2 * f) / Math.sqrt(3), d: string[] = [];
    for (let row = Math.floor(vb.y / (0.75 * hh)) - 1; row * 0.75 * hh < vb.y + vb.h + hh; row++) for (let col = Math.floor(vb.x / f) - 1; col * f < vb.x + vb.w + f; col++) {
      const cx = col * f + (row % 2 ? f / 2 : 0), cy = row * 0.75 * hh, pts: P[] = [];
      for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; pts.push([cx + Math.cos(a) * (hh / 2), cy + Math.sin(a) * (hh / 2)]); }
      d.push(path(pts) + 'Z');
    }
    el('path', { d: d.join(' ') }, hexes); }
  // names of tracts and peaks, one per name at the centroid
  const names = el('g', { class: 'wm-names' }, svg);
  const tracts = new Map<string, P[]>();
  for (const w of W.woods) tracts.set(w.name, [...(tracts.get(w.name) ?? []), w.pos]);
  for (const [name, pts] of tracts) { const c: P = [pts.reduce((a, q) => a + q[0], 0) / pts.length, pts.reduce((a, q) => a + q[1], 0) / pts.length]; el('text', { x: c[0], y: c[1], class: 'wm-tract' }, names).textContent = name; }
  for (const p of W.peaks) el('text', { x: p.pos[0], y: p.pos[1] + 0.9, class: 'wm-peak' }, names).textContent = p.name;
  for (const l of W.lakes) if (l.r[0] > 0.5) el('text', { x: l.center[0], y: l.center[1] + 0.1, class: 'wm-lake' }, names).textContent = l.name;
  const trail = el('path', { class: 'wm-trail', d: '' }, svg);
  // pins
  const pins = el('g', { class: 'wm-pins' }, svg);
  const major = (p: Pin) => ['settlement', 'castle', 'camp', 'tower', 'temple', 'ruin', 'pass', 'den', 'hill', 'landmark'].includes(p.type);
  // Players see only the places the DM has revealed (and wherever the party has been); the DM sees all.
  const known = (p: Pin) => host.dm || host.revealed().has(p.key);
  const pinEls = new Map<string, { g: SVGGElement; li: HTMLLIElement }>();
  for (const p of W.pins) {
    const g = el('g', { class: `wm-pin t-${p.type}${p.scenes ? ' has-scene' : ''}${major(p) ? ' major' : ''}`, transform: `translate(${p.pos[0]},${p.pos[1]})`, 'data-key': p.key }, pins);
    el('circle', { r: 0.26 }, g);
    const t = el('text', { y: 0.09 }, g); t.textContent = keyOf(p);
    const n = el('text', { class: 'wm-pin-name', y: 0.62 }, g); n.textContent = p.name;
    const li = document.createElement('li'); li.dataset.key = p.key;
    li.innerHTML = `<b>${keyOf(p)}</b><span>${p.name}</span>${p.scenes ? '<i>map</i>' : ''}${host.dm ? `<button class="icon eye" data-reveal="${p.key}" aria-label="Reveal to players" title="Reveal to players">${ICON.eye ?? '◉'}</button>` : ''}`;
    keyList.appendChild(li);
    pinEls.set(p.key, { g, li });
  }
  const refreshKnown = () => { const r = host.revealed(); for (const p of W.pins) { const e = pinEls.get(p.key)!, on = known(p), rev = r.has(p.key); e.g.setAttribute('visibility', on ? 'visible' : 'hidden'); e.li.hidden = !on; e.li.classList.toggle('revealed', rev); e.li.querySelector('.eye')?.setAttribute('aria-pressed', String(rev)); } };
  refreshKnown();
  keyList.addEventListener('click', (e) => {
    const t = e.target as HTMLElement, li = t.closest<HTMLElement>('li'); const p = li && W.pins.find((x) => x.key === li.dataset.key); if (!p) return;
    const eye = t.closest<HTMLElement>('[data-reveal]'); if (eye) { host.reveal(p.key, !host.revealed().has(p.key)); refreshKnown(); return; }
    view.x = p.pos[0] - view.w / 2; view.y = p.pos[1] - view.h / 2; apply(); void showCard(p, p.pos, dist(at, p.pos));
  });
  // hover: a tooltip with the place's blurb (and, for the DM, the DM note and whether players can see it)
  const tip = document.createElement('div'); tip.className = 'world-tip'; tip.hidden = true; body.appendChild(tip);
  svg.addEventListener('pointermove', (e) => {
    const g = (e.target as Element).closest<SVGGElement>('.wm-pin'); const p = g && W.pins.find((x) => x.key === g.dataset.key);
    if (!p || !known(p) || drag) { tip.hidden = true; return; }
    const r = body.getBoundingClientRect();
    tip.innerHTML = `<b>${keyOf(p)} · ${p.name}</b>${p.blurb ? `<div>${p.blurb}</div>` : ''}${host.dm && p.dm ? `<div class="dm">${p.dm}</div>` : ''}${host.dm ? `<div class="vis">${host.revealed().has(p.key) ? 'Players can see this place' : 'Hidden from players'}</div>` : ''}${p.scenes?.length ? '<div class="vis">Tap to open the map</div>' : ''}`;
    tip.style.left = `${Math.min(e.clientX - r.left + 14, r.width - 280)}px`; tip.style.top = `${e.clientY - r.top + 14}px`; tip.hidden = false;
  });
  svg.addEventListener('pointerleave', () => { tip.hidden = true; });
  // party marker
  const party = el('g', { class: `wm-party${host.canMove ? ' movable' : ''}` }, svg);
  el('circle', { r: 0.42, class: 'halo' }, party); el('circle', { r: 0.3 }, party);
  el('path', { d: 'M0,-0.16 a0.07,0.07 0 1 1 0.001,0 M-0.13,0.15 q0.13,-0.22 0.26,0', class: 'glyph' }, party);
  el('title', {}, party).textContent = host.canMove ? 'The party · drag to travel' : 'The party';
  const start = host.get() ?? { pos: (W.pins.find((p) => p.scenes?.length) ?? W.pins[0]).pos };
  let at: P = [...start.pos] as P;
  const place = (p: P) => party.setAttribute('transform', `translate(${p[0]},${p[1]})`);
  place(at);

  // --- view: pan and zoom
  const toMap = (e: PointerEvent | WheelEvent): P => { const r = svg.getBoundingClientRect(), s = Math.max(view.w / r.width, view.h / r.height); const ox = (r.width * s - view.w) / 2, oy = (r.height * s - view.h) / 2; return [view.x - ox + (e.clientX - r.left) * s, view.y - oy + (e.clientY - r.top) * s]; };
  const zoom = (k: number, c: P = [view.x + view.w / 2, view.y + view.h / 2]) => { const w = Math.min(vb.w * 1.2, Math.max(1.5, view.w * k)), h = (w / view.w) * view.h; view.x = c[0] - ((c[0] - view.x) * w) / view.w; view.y = c[1] - ((c[1] - view.y) * h) / view.h; view.w = w; view.h = h; apply(); };
  svg.addEventListener('wheel', (e) => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, toMap(e)); }, { passive: false });
  let drag: { kind: 'pan'; x: number; y: number; vx: number; vy: number } | { kind: 'party' } | null = null;
  let downOn: { key: string; x: number; y: number } | null = null;
  svg.addEventListener('pointerdown', (e) => {
    tip.hidden = true;
    const pinG = (e.target as Element).closest<SVGGElement>('.wm-pin');
    downOn = pinG ? { key: pinG.dataset.key!, x: e.clientX, y: e.clientY } : null;
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
    // a tap on a place (no pan) links there: its map opens when it has one, else its card shows
    if (downOn && Math.hypot(e.clientX - downOn.x, e.clientY - downOn.y) < 6) {
      const p = W.pins.find((x) => x.key === downOn!.key); downOn = null;
      if (p && known(p)) { if (p.scenes?.length === 1 && host.canMove) { host.enter(p.scenes[0]); back.remove(); } else void showCard(p, p.pos, dist(at, p.pos)); }
      return;
    }
    downOn = null;
    if (!d || d.kind !== 'party') return;
    const p = toMap(e), near = W.pins.find((x) => dist(x.pos, p) < SNAP_MI), to: P = near ? [...near.pos] as P : [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100];
    const miles = dist(at, to);
    if (miles < 0.05) { place(at); return; }
    host.move(to, near?.key, miles);
    at = to; place(at); drawTrail(); refreshKnown();
    void showCard(near, to, miles);
  });
  const drawTrail = () => { const t = host.get(); const pts = (t as { trail?: { pos: P }[] } | undefined)?.trail?.map((x) => x.pos) ?? []; trail.setAttribute('d', pts.length > 1 ? path(pts.slice(-12)) : ''); };
  drawTrail();
  requestAnimationFrame(blit);

  const nearestName = (p: P) => { const all = [...W.pins.map((x) => ({ name: x.name, pos: x.pos })), ...W.woods, ...W.peaks]; const n = all.reduce((a, c) => (dist(c.pos, p) < dist(a.pos, p) ? c : a)); return { name: n.name, mi: dist(n.pos, p) }; };
  async function showCard(pin: Pin | undefined, to: P, miles: number): Promise<void> {
    const speed = PACES[pace].mph, hours = miles / speed;
    const where = pin ? `<b>${keyOf(pin)}</b> ${pin.name}` : (() => { const n = nearestName(to); return `Wilderness · ${n.mi.toFixed(1)} mi from ${n.name}`; })();
    const scenes = pin?.scenes ?? [];
    const labels = await Promise.all(scenes.map((s) => host.sceneName(s)));
    const rev = pin ? host.revealed().has(pin.key) : false;
    card.innerHTML = `<div class="wc-where">${where}${pin && host.dm ? `<button class="chip-btn" data-reveal="${pin.key}" aria-pressed="${rev}">${rev ? 'Shown to players' : 'Hidden from players'}</button>` : ''}</div>${pin?.blurb ? `<div class="wc-blurb">${pin.blurb}</div>` : ''}${pin?.dm && host.dm ? `<div class="wc-dm">${pin.dm}</div>` : ''}<div class="wc-travel">${miles.toFixed(1)} mi as the crow flies · about ${fmtHours(hours)} at a ${pace} pace (${speed} mph)</div>
      ${scenes.length ? `<div class="wc-actions">${scenes.map((s, i) => `<button class="primary" data-scene="${s}">Open ${labels[i]}</button>`).join('')}</div>` : '<div class="wc-note">No battle map here yet; run it theatre-of-the-mind or pick a nearby place.</div>'}`;
    card.hidden = false;
  }
  card.addEventListener('click', (e) => {
    const t = e.target as HTMLElement, s = t.closest<HTMLElement>('[data-scene]')?.dataset.scene; if (s) { host.enter(s); back.remove(); return; }
    const rv = t.closest<HTMLElement>('[data-reveal]'); if (rv) { const p = W.pins.find((x) => x.key === rv.dataset.reveal)!; host.reveal(p.key, !host.revealed().has(p.key)); refreshKnown(); void showCard(p, p.pos, dist(at, p.pos)); }
  });
  back.querySelector('.pace')!.addEventListener('click', (e) => { const b2 = (e.target as HTMLElement).closest<HTMLElement>('[data-pace]'); if (!b2) return; pace = b2.dataset.pace as Pace; back.querySelectorAll('[data-pace]').forEach((x) => x.setAttribute('aria-selected', String(x === b2))); });
  back.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === back || t.closest('.close')) back.remove();
    const z = t.closest<HTMLElement>('[data-z]')?.dataset.z; if (z) zoom(z === 'in' ? 0.75 : 1.33);
    const hx = t.closest<HTMLElement>('[data-hex]'); if (hx) { const on = hx.getAttribute('aria-pressed') !== 'true'; hx.setAttribute('aria-pressed', String(on)); hexes.setAttribute('visibility', on ? 'visible' : 'hidden'); }
  });
  addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { back.remove(); removeEventListener('keydown', esc); } });
}
