// The minimap: a north-up, zoomed-out plan of the current level in the bottom-left corner, no more than an eighth
// of the page, with the clock (time of day and calendar) riding on top of it. It shows the ground, the streets, the
// rooms, the walls, a faint grid, the party and the rectangle the camera looks at; a tap pans the camera there.
import type { App } from '../app';
import { ICON } from './icons';
import { CELL_FT } from '../core/units';

type P = [number, number];

export interface Minimap { el: HTMLElement; draw: () => void }

export function buildMinimap(app: App, ui: HTMLElement, onClock: () => void): Minimap {
  const el = document.createElement('div');
  el.className = 'minimap dm-only';
  el.innerHTML = `<button class="clock" data-act="clock" aria-label="Time of day and calendar" title="Time of day and calendar">${ICON.sun}<span><span class="ck-time">14:00</span><span class="ck-day">Day 1</span></span></button>
    <canvas class="mm-canvas" aria-label="Minimap: tap to look there"></canvas><b class="mm-north">N</b>`;
  ui.appendChild(el);
  const cv = el.querySelector<HTMLCanvasElement>('canvas')!;
  el.querySelector('[data-act="clock"]')!.addEventListener('click', onClock);

  // the plan → canvas transform: north up, the level fitted with a margin
  let fit: { s: number; ox: number; oy: number; nx: number; nz: number; cx: number; cz: number } | null = null;
  const toCanvas = (p: P): P => {
    const f = fit!;
    // rotate so that north (nx, nz) points up: screen x along east = (−nz, nx), screen up along north
    const dx = p[0] - f.cx, dz = p[1] - f.cz;
    const east = dx * -f.nz + dz * f.nx, north = dx * f.nx + dz * f.nz;
    return [f.ox + east * f.s, f.oy - north * f.s];
  };
  const fromCanvas = (x: number, y: number): P => {
    const f = fit!;
    const east = (x - f.ox) / f.s, north = (f.oy - y) / f.s;
    return [f.cx + east * -f.nz + north * f.nx, f.cz + east * f.nx + north * f.nz];
  };

  const draw = () => {
    const plan = app.plan();
    const r = el.getBoundingClientRect(); if (!r.width) return;
    const W = Math.round(r.width * devicePixelRatio), H = Math.round(r.height * devicePixelRatio);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const ctx = cv.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    if (!plan) { fit = null; return; }
    const pts: P[] = [...plan.floor.flat(), ...plan.terrain.flatMap((t) => t.poly)];
    if (!pts.length) { fit = null; return; }
    const [nx, nz] = plan.north;
    const cx = (Math.min(...pts.map((p) => p[0])) + Math.max(...pts.map((p) => p[0]))) / 2, cz = (Math.min(...pts.map((p) => p[1])) + Math.max(...pts.map((p) => p[1]))) / 2;
    const ext = pts.map((p) => { const dx = p[0] - cx, dz = p[1] - cz; return [dx * -nz + dz * nx, dx * nx + dz * nz] as P; });
    const we = Math.max(...ext.map((e) => Math.abs(e[0]))) * 2 + 20, hn = Math.max(...ext.map((e) => Math.abs(e[1]))) * 2 + 20;
    const s = Math.min((W - 8) / we, (H - 8) / hn);
    fit = { s, ox: W / 2, oy: H / 2, nx, nz, cx, cz };
    const dark = app.campaign.theme.id !== 'pastoral';
    const path = (poly: P[]) => { ctx.beginPath(); poly.forEach((p, i) => { const c = toCanvas(p); if (i) ctx.lineTo(c[0], c[1]); else ctx.moveTo(c[0], c[1]); }); ctx.closePath(); };
    // ground, then streets, then rooms
    ctx.fillStyle = dark ? '#3a4a3d' : '#9cb77e';
    for (const p of plan.floor) { path(p); ctx.fill(); }
    for (const t of plan.terrain) { if (!t.floor || t.floor === 'grass') continue; ctx.fillStyle = t.floor === 'cobble' ? '#8c8f96' : t.floor === 'dirt' ? '#8a6f4e' : t.floor === 'water' ? '#5e7d94' : '#777'; path(t.poly); ctx.fill(); }
    ctx.fillStyle = dark ? 'rgba(220,210,200,.55)' : 'rgba(255,250,240,.7)'; ctx.strokeStyle = dark ? '#d8d2c6' : '#5a4a3a'; ctx.lineWidth = Math.max(1, devicePixelRatio * 0.8);
    for (const p of plan.rooms) { path(p); ctx.fill(); ctx.stroke(); }
    // a faint grid at the map's cell size (a coarser one when the cells would be too fine to read)
    const cell = s * CELL_FT < 4 * devicePixelRatio ? CELL_FT * 8 : CELL_FT;
    ctx.strokeStyle = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)'; ctx.lineWidth = devicePixelRatio * 0.5; ctx.beginPath();
    for (let e = -we / 2; e <= we / 2; e += cell) { const a = fromCanvas(W / 2 + e * s, 0), b = fromCanvas(W / 2 + e * s, H); const ca = toCanvas(a), cb = toCanvas(b); ctx.moveTo(ca[0], ca[1]); ctx.lineTo(cb[0], cb[1]); }
    for (let n = -hn / 2; n <= hn / 2; n += cell) { const a = fromCanvas(0, H / 2 - n * s), b = fromCanvas(W, H / 2 - n * s); const ca = toCanvas(a), cb = toCanvas(b); ctx.moveTo(ca[0], ca[1]); ctx.lineTo(cb[0], cb[1]); }
    ctx.stroke();
    // walls
    ctx.strokeStyle = dark ? '#111' : '#3a2f24'; ctx.lineWidth = Math.max(1, devicePixelRatio); ctx.beginPath();
    for (const [a, b] of plan.walls) { const ca = toCanvas(a), cb = toCanvas(b); ctx.moveTo(ca[0], ca[1]); ctx.lineTo(cb[0], cb[1]); }
    ctx.stroke();
    // what the camera sees
    const g = app.cameraGround(), far = Math.max(we, hn);
    // a corner that sees the sky is placed far out along its ray instead, so the view still reads as a wedge
    for (let i = 0; i < 4; i++) if (!g[i]) { const o = g.find((p) => p) ?? [cx, cz]; const ang = [-1, 1, 1, -1][i]; g[i] = [o[0] + ang * far, o[1] - far]; }
    if (g.every((p) => p)) { ctx.strokeStyle = '#f2b35b'; ctx.lineWidth = devicePixelRatio * 1.2; ctx.fillStyle = 'rgba(242,179,91,.10)'; path(g as P[]); ctx.fill(); ctx.stroke(); }
    // the party
    if (plan.party) { const c = toCanvas(plan.party); ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(c[0], c[1], devicePixelRatio * 3.5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = devicePixelRatio; ctx.stroke(); }
  };
  cv.addEventListener('pointerdown', (e) => {
    if (!fit) return;
    const r = cv.getBoundingClientRect();
    app.lookAt(fromCanvas((e.clientX - r.left) * devicePixelRatio, (e.clientY - r.top) * devicePixelRatio));
  });
  new ResizeObserver(draw).observe(el);
  return { el, draw };
}
