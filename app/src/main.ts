import * as THREE from 'three';
import './styles.css';
import { App, type GridMode } from './app';
import { builtPaths, loadLocation } from './data';
import { openWorldMap } from './ui/worldmap';
import { openBestiary } from './ui/bestiary';
import { creatureById, statsOf, seenAs } from './bestiary';
import { openEncounterSheet, turnBar } from './ui/encounter';
import { ICON } from './ui/icons';
import { openLibrary } from './ui/library';
import { ViewSlider } from './ui/viewSlider';

const q = new URLSearchParams(location.search);
const mode = q.get('display') === 'player' ? 'player' : 'dm';
const path = q.get('scene') ?? localStorage.getItem('mistlab.scene') ?? 'appB/death-house';
document.body.dataset.mode = mode;
document.title = mode === 'player' ? 'mistLAB · Player Display' : 'mistLAB';

const stage = document.getElementById('stage')!;
const app = new App(stage, mode);

if (mode === 'dm') buildDmUi();
if (q.get('hud') === '1') buildHud();

const ready = app.init(builtPaths.has(path) ? path : 'appB/death-house');

// Test/debug hook. Harmless in production: it only exposes what the DM UI can already do.
(window as unknown as { __mistlab: unknown }).__mistlab = {
  app,
  ready: ready.then(() => true),
  setT: (t: number) => { slider?.set(t); app.setT(t); app.world.renderNow(); },
  setGrid: (g: GridMode) => { app.gridMode = g; app.layoutChanged(); app.world.renderNow(); },
  setLowWalls: (on: boolean) => { app.lowWalls = on; app.layoutChanged(); app.world.renderNow(); },
  setRenderMode: (m: 'normal' | 'floorMask') => { app.setRenderMode(m); app.world.renderNow(); },
  setSecretAsWall: (on: boolean) => { app.secretAsWall = on; app.applySlider(); app.world.renderNow(); },
  setLabels: (m: 'keys' | 'all' | 'none') => { app.labelMode = m; app.applySlider(); app.world.renderNow(); },
  frame: (p: 'tabletop' | 'top') => { app.frameLevel(p); app.world.renderNow(); },
  render: () => app.world.renderNow(),
  labels: () => app.cur!.labels.filter((l) => l.level === app.levelId).map((l) => ({ id: l.spec.id, vis: l.spec.vis, opacity: Number(l.obj.element.style.opacity), visible: l.obj.visible })),
  targets: () => app.built.targets.map((t) => ({ id: t.id, vis: t.vis, visible: t.root.visible, opacity: t.materials[0]?.opacity ?? 1 })),
  flush: () => app.flush(),
  screenOf: (x: number, z: number, y = 0) => { const v = new THREE.Vector3(x, app.level.elevationFt + y, z).project(app.world.camera); const r = app.world.renderer.domElement.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; },
  partyPos: () => app.party?.pos,
    moveParty: (level: string, x: number, z: number) => { const t = app.party; if (t) { t.level = level; t.pos = [x, z]; } app.setLevel(level); app.world.renderNow(); },
};

if ('serviceWorker' in navigator && import.meta.env.PROD && !q.has('nosw')) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

let slider: ViewSlider | undefined;

function buildDmUi(): void {
  const ui = document.getElementById('ui')!;
  slider = new ViewSlider((t) => app.setT(t));
  ui.appendChild(slider.el);

  const top = document.createElement('div');
  top.className = 'topbar';
  top.innerHTML = `
    <div class="group left">
      <button class="icon" data-act="library" aria-label="Library">${ICON.library}</button>
      <button class="icon" data-act="world" aria-label="World map" title="World map of Barovia">${ICON.map}</button>
      <div class="title"><span class="loc"></span><span class="sub"></span></div>
      <button class="icon back" data-act="back" hidden aria-label="Back to the town" title="Back to the town map">${ICON.rotateL}</button>
      <div class="seg mode" role="tablist" aria-label="Mode">
        <button role="tab" data-view="dm">DM</button><button role="tab" data-view="players">Players</button>
      </div>
    </div>
    <div class="group center"><div class="seg levels" role="tablist"></div><label class="section" hidden title="Section: slide to cut the building at any height"><span class="sec-label">Section</span><input type="range" min="0" max="100" step="0.5" list="sec-detents" aria-label="Section height"><datalist id="sec-detents"></datalist><span class="sec-ft"></span><button class="icon" data-act="sec-follow" aria-label="Follow the floor">${ICON.walls}</button></label></div>
    <div class="group right dm-only">
      <div class="seg tools" role="toolbar" aria-label="Reveal tools">
        <button class="icon" data-tool="reveal" aria-label="Reveal / hide (tap a room, object or secret door)">${ICON.reveal}</button>
        <button class="icon" data-tool="brush-reveal" aria-label="Paint reveal">${ICON.brush}</button>
        <button class="icon" data-tool="brush-fog" aria-label="Paint fog">${ICON.fog}</button>
        <button class="icon" data-act="undo" aria-label="Undo reveal">${ICON.undo}</button>
      </div>
      <span class="divider"></span>
      <button class="icon" data-act="creatures" aria-label="Creatures" title="Creatures: people, monsters and beasts to place">${ICON.paw}</button>
      <button class="icon" data-act="encounter" aria-label="Initiative" title="Initiative (roll, ranges, turns)">${ICON.swords}</button>
      <span class="divider"></span>
      <button class="icon" data-act="search" aria-label="Go to area (/)" title="Go to area (/)">${ICON.search}</button>
      <button class="icon" data-act="rooms" aria-label="Rooms">${ICON.list}</button>
      <button class="icon" data-act="grid" aria-label="Grid: square / hex / off"></button>
      <button class="icon" data-act="walls" aria-label="Walls: low / full">${ICON.walls}</button>
      <button class="icon" data-act="mist" aria-label="Mist on / off" aria-pressed="true" title="Mist on / off">${ICON.fog}</button>
      <button class="clock" data-act="clock" aria-label="Time of day and calendar" title="Time of day and calendar">${ICON.sun}<span><span class="ck-time">14:00</span><span class="ck-day">Day 1 · 1 Mirtul</span></span></button>
      <button class="icon" data-act="labels" aria-label="Labels: keys / all / none"></button>
      <span class="divider"></span>
      <button class="icon" data-act="lock" aria-label="Player camera follows DM"></button>
      <button class="icon" data-act="display" aria-label="Open Player Display">${ICON.display}</button>
    </div>`;
  ui.appendChild(top);

  // Camera cluster: bottom-left, thumb-reachable.
  const cam = document.createElement('div');
  cam.className = 'camcluster';
  cam.innerHTML = `
    <button class="icon" data-cam="rotL" aria-label="Rotate left">${ICON.rotateL}</button>
    <button class="icon" data-cam="rotR" aria-label="Rotate right">${ICON.rotateR}</button>
    <button class="icon" data-cam="tilt" aria-label="Tabletop / top-down">${ICON.top}</button>
    <span class="divider"></span>
    <button class="icon" data-cam="zoomIn" aria-label="Zoom in">${ICON.zoomIn}</button>
    <button class="icon" data-cam="zoomOut" aria-label="Zoom out">${ICON.zoomOut}</button>
    <span class="divider"></span>
    <button class="icon" data-cam="party" aria-label="Find the party">${ICON.party}</button>
    <button class="icon" data-cam="follow" aria-label="Follow the party" aria-pressed="true">${ICON.token}</button>
    <span class="divider"></span>
    <button class="icon" data-cam="help" aria-label="Help">${ICON.help}</button>`;
  ui.appendChild(cam);
  cam.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!b) return;
    switch (b.dataset.cam) {
      case 'rotL': app.world.rotate(1); break;
      case 'rotR': app.world.rotate(-1); break;
      case 'tilt': app.camPreset = app.camPreset === 'top' ? 'tabletop' : 'top'; app.world.setTilt(app.camPreset === 'top'); break;
      case 'zoomIn': app.world.zoomBy(0.78); break;
      case 'zoomOut': app.world.zoomBy(1.28); break;
      case 'party': app.findParty(); break;
      case 'follow': app.follow = !app.follow; break;
      case 'help': showHelp(); break;
    }
    refresh();
  });

  // Room finder: search + list sheet.
  const finder = document.createElement('div');
  finder.className = 'finder dm-only';
  finder.hidden = true; // opens from the search button or "/", drops down under the top bar
  finder.innerHTML = `<label class="search">${ICON.search}<input type="search" placeholder="Go to area… (12A, ritual)" aria-label="Find an area" autocomplete="off"></label><ul class="results" hidden></ul>`;
  ui.appendChild(finder);
  const input = finder.querySelector('input')!, results = finder.querySelector<HTMLElement>('.results')!;
  const openFinder = () => { finder.style.top = `${top.getBoundingClientRect().bottom + 8}px`; finder.hidden = false; input.focus(); };
  const closeFinder = () => { input.value = ''; results.hidden = true; finder.hidden = true; input.blur(); };
  input.addEventListener('blur', () => setTimeout(() => { if (!finder.contains(document.activeElement) && !input.value) closeFinder(); }, 150));
  const renderResults = () => {
    const hits = app.findRooms(input.value).slice(0, 8);
    results.hidden = hits.length === 0;
    results.innerHTML = hits.map((h) => `<li><button data-key="${h.room.key}"><b>${h.room.key}</b> ${h.room.name}<span>${h.level.name}</span></button></li>`).join('');
  };
  input.addEventListener('input', renderResults);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const first = results.querySelector<HTMLElement>('button'); first?.click(); } if (e.key === 'Escape') closeFinder(); });
  results.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-key]'); if (!b) return; app.jumpTo(b.dataset.key!); closeFinder(); });

  const bar = turnBar(app, () => refresh()) as HTMLElement & { update: () => void };
  ui.appendChild(bar);

  const status = document.createElement('div');
  status.className = 'status';
  ui.appendChild(status);
  app.onStatus = (s) => { status.textContent = s; status.classList.toggle('on', !!s); if (s) { clearTimeout(statusTimer); statusTimer = window.setTimeout(() => { if (app.tool === 'none') { status.classList.remove('on'); } }, 2200); } };
  let statusTimer = 0;

  const section = top.querySelector<HTMLElement>('.section')!, secIn = section.querySelector<HTMLInputElement>('input')!, secFt = section.querySelector<HTMLElement>('.sec-ft')!;
  const secList = section.querySelector<HTMLDataListElement>('datalist')!;
  // The slider snaps to each floor's default view: land near a detent and that floor is picked with its own cut.
  secIn.addEventListener('input', () => {
    const v = Number(secIn.value), near = app.floorCuts.find((d) => Math.abs(d.ft - v) <= 1.5);
    if (near) { if (app.levelId !== near.level) app.setLevel(near.level); app.setCut(undefined); }
    else app.setCut(v);
    refresh();
  });
  // The clock popover: an hour dial, a day stepper, the date and the moon.
  let clockEl: HTMLElement | null = null;
  const openClock = () => {
    if (clockEl) { clockEl.remove(); clockEl = null; return; }
    const el = document.createElement('div'); el.className = 'clockpop'; clockEl = el;
    const render = () => {
      const s = app.sky, c = app.clock;
      el.innerHTML = `<div class="ck-head"><b>${s.label.split(' · ').slice(1).join(' · ')}</b><button class="icon close" aria-label="Close">${ICON.close}</button></div>
        <label>Hour <input type="range" min="0" max="23.75" step="0.25" value="${c.hour}" data-f="hour"><span class="ck-val">${s.label.split(' · ')[1]}</span></label>
        <div class="ck-row"><button data-a="day-">−1 day</button><span>Day ${c.day}</span><button data-a="day+">+1 day</button><span class="spacer"></span><button data-a="h-1">−1 h</button><button data-a="h+1">+1 h</button><button data-a="h+8">+8 h</button></div>
        <div class="ck-row ck-moon"><span class="moon" style="--lit:${s.moonLit.toFixed(2)}"></span><span>${s.moonName}${s.night ? ' · night' : s.ambient === 'fog' ? ' · dusk light' : ' · daylight'}</span></div>`;
    };
    render();
    el.addEventListener('input', (e) => { const t = e.target as HTMLInputElement; if (t.dataset.f === 'hour') { app.setClock(app.clock.day, Number(t.value)); el.querySelector('.ck-val')!.textContent = app.sky.label.split(' · ')[1]; el.querySelector('.ck-head b')!.textContent = app.sky.label.split(' · ').slice(1).join(' · '); refresh(); } });
    el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('button'); if (!b) return;
      if (b.classList.contains('close')) { el.remove(); clockEl = null; return; }
      const a = b.dataset.a; const c = app.clock;
      if (a === 'day-') app.setClock(c.day - 1, c.hour); if (a === 'day+') app.setClock(c.day + 1, c.hour);
      if (a === 'h-1') app.advance(-1); if (a === 'h+1') app.advance(1); if (a === 'h+8') app.advance(8);
      render(); refresh();
    });
    ui.appendChild(el);
  };
  const refresh = () => {
    { const c = app.clock, b = top.querySelector<HTMLElement>('[data-act="clock"]'); if (b) { b.querySelector('.ck-time')!.textContent = app.sky.label.split(' · ')[1]; b.querySelector('.ck-day')!.textContent = `Day ${c.day} · ${app.sky.label.split(' · ')[2]}`; b.querySelector('svg')?.replaceWith(Object.assign(document.createElement('i'), { innerHTML: app.sky.night ? ICON.moon : ICON.sun }).firstElementChild!); b.classList.toggle('night', app.sky.night); } }
    bar.update();
    const range = app.sectionRange;
    section.hidden = !range;
    if (range) {
      secIn.min = String(range.min); secIn.max = String(range.max); const v = app.cutFt ?? app.followCutFt; secIn.value = String(v); secFt.textContent = `${Math.round(v)} ft`; section.classList.toggle('free', app.cutFt !== undefined);
      const detents = app.floorCuts.map((d) => `<option value="${d.ft}" label="${d.name}"></option>`).join('');
      if (secList.innerHTML !== detents) secList.innerHTML = detents;
    }
    if (!app.cur) return;
    document.body.dataset.view = app.view;
    top.querySelector('.loc')!.textContent = app.cur.scene.name;
    top.querySelector<HTMLElement>('.back')!.hidden = !app.cur.scene.parent || !builtPaths.has(app.cur.scene.parent);
    top.querySelector('.sub')!.textContent = `${app.cur.scene.mapPage ? `map p.${app.cur.scene.mapPage}` : app.campaign.name} · ${app.cur.scene.placementFt ? `${app.cur.scene.placementFt}-ft placement squares` : `${app.cur.scene.bookScaleFt}-ft squares`}`;
    top.querySelectorAll<HTMLElement>('[data-view]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === app.view)));
    const lv = top.querySelector('.levels')!;
    lv.innerHTML = app.cur.scene.levels.map((l) => `<button role="tab" data-level="${l.id}" aria-selected="${l.id === app.levelId}">${l.name}${app.party?.level === l.id ? ' <i class="dot"></i>' : ''}</button>`).join('');
    (lv as HTMLElement).style.display = app.cur.scene.levels.length > 1 ? '' : 'none';
    top.querySelectorAll<HTMLElement>('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === app.tool)));
    top.querySelector('[data-act="grid"]')!.innerHTML = app.gridMode === 'hex' ? ICON.hex : app.gridMode === 'square' ? ICON.grid : ICON.gridOff;
    top.querySelector('[data-act="labels"]')!.innerHTML = app.labelMode === 'all' ? ICON.label : app.labelMode === 'keys' ? ICON.labelKeys : ICON.labelOff;
    top.querySelector('[data-act="walls"]')!.setAttribute('aria-pressed', String(!app.lowWalls));
    top.querySelector('[data-act="lock"]')!.innerHTML = app.lockPlayerCamera ? ICON.lock : ICON.unlock;
    cam.querySelector('[data-cam="follow"]')!.setAttribute('aria-pressed', String(app.follow));
    cam.querySelector('[data-cam="tilt"]')!.innerHTML = app.camPreset === 'top' ? ICON.camera : ICON.top;
    slider!.el.hidden = app.view === 'players';
    if (roomsSheet) renderRooms();
  };
  app.onChange = refresh;

  top.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!b) return;
    if (b.dataset.level) app.setLevel(b.dataset.level, true);
    if (b.dataset.view) app.setView(b.dataset.view as 'dm' | 'players');
    if (b.dataset.tool) { app.tool = app.tool === b.dataset.tool ? 'none' : (b.dataset.tool as typeof app.tool); app.setStatus(app.tool === 'none' ? '' : b.getAttribute('aria-label')!); }
    switch (b.dataset.act) {
      case 'library': openLibrary(builtPaths, app.campaign, (p) => { localStorage.setItem('mistlab.scene', p); void app.open(p).then(() => app.layoutChanged()); }); break;
      case 'clock': openClock(); break;
      case 'back': { const par = app.cur?.scene.parent; if (par) { localStorage.setItem('mistlab.scene', par); void app.open(par).then(() => app.layoutChanged()); } break; }
      case 'world': openWorldMap({
        canMove: !app.restricted,
        dm: !app.restricted,
        revealed: () => app.pinsRevealed,
        reveal: (key, on) => app.revealPin(key, on),
        get: () => app.state.world,
        move: (pos, key, miles) => app.moveWorld(pos, key, miles),
        enter: (path) => { localStorage.setItem('mistlab.scene', path); void app.open(path).then(() => app.layoutChanged()); },
        sceneName: async (path) => (await loadLocation(path)).scene.name,
      }); break;
      case 'encounter': app.encounter ? bar.update() : openEncounterSheet(app, refresh); break;
      case 'creatures': openBestiary(app, refresh); break;
      case 'undo': app.undo(); break;
      case 'sec-follow': app.setCut(undefined); break;
      case 'search': finder.hidden ? openFinder() : closeFinder(); break;
      case 'rooms': toggleRooms(); break;
      case 'grid': app.gridMode = app.gridMode === 'square' ? 'hex' : app.gridMode === 'hex' ? 'off' : 'square'; app.layoutChanged(); break;
      case 'walls': app.lowWalls = !app.lowWalls; app.layoutChanged(); break;
      case 'mist': app.world.setFog(!app.world.fogOn); top.querySelector('[data-act="mist"]')!.setAttribute('aria-pressed', String(app.world.fogOn)); app.layoutChanged(); break;
      case 'labels': app.labelMode = app.labelMode === 'keys' ? 'all' : app.labelMode === 'all' ? 'none' : 'keys'; app.applySlider(); break;
      case 'lock': app.lockPlayerCamera = !app.lockPlayerCamera; app.layoutChanged(); break;
      case 'display': window.open(`${location.pathname}?display=player&scene=${encodeURIComponent(app.cur?.path ?? '')}`, 'mistlab-player', 'popup,width=1280,height=800'); break;
      case 'help': showHelp(); break;
    }
    refresh();
  });

  // Rooms sheet (right side): every area key by level, revealed state, tap = go, eye = reveal/hide.
  let roomsSheet: HTMLElement | null = null;
  const toggleRooms = () => { if (roomsSheet) { roomsSheet.remove(); roomsSheet = null; return; } roomsSheet = document.createElement('aside'); roomsSheet.className = 'rooms dm-only'; ui.appendChild(roomsSheet); renderRooms(); };
  const renderRooms = () => {
    if (!roomsSheet || !app.cur) return;
    roomsSheet.innerHTML = `<header><h2>Rooms</h2><button class="icon close" aria-label="Close">${ICON.close}</button></header><div class="rooms-body">` +
      app.cur.scene.levels.map((l) => `<section><h3>${l.name}${app.party?.level === l.id ? ' · party' : ''}</h3>${l.rooms.map((r) => {
        const on = app.isRevealed(r.key), here = app.party?.level === l.id && app.roomAt(l, app.party.pos)?.key === r.key;
        return `<div class="room${on ? ' on' : ''}${here ? ' here' : ''}"><button class="go" data-go="${r.key}"><b>${r.key}</b><span>${r.name}</span>${r.page ? `<em>p.${r.page}</em>` : ''}</button><button class="icon eye" data-reveal="${r.key}" aria-label="${on ? 'Hide from players' : 'Reveal to players'}" aria-pressed="${on}">${ICON.eye}</button></div>`;
      }).join('')}</section>`).join('') + '</div>';
  };
  ui.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (!roomsSheet || !roomsSheet.contains(t)) return;
    if (t.closest('.close')) return toggleRooms();
    const go = t.closest<HTMLElement>('[data-go]'); if (go) return void app.jumpTo(go.dataset.go!);
    const rv = t.closest<HTMLElement>('[data-reveal]'); if (rv) { app.toggleRoom(rv.dataset.reveal!); renderRooms(); }
  });

  // Tap menu: what you can do with the thing you tapped.
  let menu: HTMLElement | null = null;
  const closeMenu = () => { menu?.remove(); menu = null; };
  // Hover tooltip (mouse): what is under the cursor.
  const tip = document.createElement('div');
  tip.className = 'tip'; tip.hidden = true;
  ui.appendChild(tip);
  app.onHover = (t, x, y) => {
    if (!t || menu) { tip.hidden = true; return; }
    tip.innerHTML = `<b></b>${t.sub ? '<span></span>' : ''}`;
    tip.querySelector('b')!.textContent = t.title;
    if (t.sub) tip.querySelector('span')!.textContent = t.sub;
    tip.hidden = false;
    tip.style.left = `${Math.min(x + 14, innerWidth - tip.offsetWidth - 8)}px`;
    tip.style.top = `${Math.min(y + 16, innerHeight - tip.offsetHeight - 8)}px`;
  };
  app.world.renderer.domElement.addEventListener('pointerleave', () => { tip.hidden = true; });
  app.onLeave = () => { closeMenu(); tip.hidden = true; };

  app.onTap = (hit, x, y) => {
    closeMenu();
    const items: { label: string; act: () => void; icon?: string }[] = [];
    if (hit.token) { // the players' look at a creature
      const card = document.createElement('div'); card.className = 'infocard';
      card.innerHTML = `<header><div><h2></h2></div><button class="icon close" aria-label="Close">${ICON.close}</button></header>${hit.token.desc ? '<div class="body"><div class="desc"></div></div>' : ''}`;
      card.querySelector('h2')!.textContent = hit.token.name; if (hit.token.desc) card.querySelector('.desc')!.textContent = hit.token.desc;
      card.style.left = `${Math.min(x, innerWidth - 360)}px`; card.style.top = `${Math.min(y, innerHeight - 200)}px`;
      card.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('.close')) closeMenu(); });
      menu = card; ui.appendChild(card);
      setTimeout(() => addEventListener('pointerdown', (e) => { if (menu && !menu.contains(e.target as Node)) closeMenu(); }, { once: true }), 0);
      return;
    }
    if (hit.object) {
      // Info card: what it is, where, what players see, DM notes, state, actions.
      const o = hit.object, players = app.restricted;
      const card = document.createElement('div');
      card.className = 'infocard';
      const where = hit.room ? `${hit.room.key} · ${hit.room.name}${o.page ? ` · p.${o.page}` : ''}` : '';
      const state = players ? '' : o.vis === 'player' ? 'Visible to players when in sight' : `${o.vis.replace('-', ' ')} · ${o.revealed ? 'revealed to players' : o.visibleToPlayers ? 'in players\' view' : 'hidden from players'}`;
      const c = o.container;
      const inside = !c ? '' : c.open ? `<div class="inside"><b>Inside</b> ${c.contents ?? 'Nothing of note.'}</div>`
        : players ? `<div class="inside">${c.locked ? `${ICON.padlock} Locked` : 'Closed'}</div>`
        : `<div class="inside">${c.locked ? `${ICON.padlock} Locked · ` : ''}Closed${c.contents ? ` · holds: ${c.contents}` : ''}</div>`;
      const openBtn = c && (!players || !c.locked || c.open) ? `<button class="primary" data-a="open">${c.open ? 'Close' : 'Open'}</button>` : '';
      card.innerHTML = `<header><div><h2>${o.label}</h2>${where && !players ? `<div class="where">${where}</div>` : ''}</div><button class="icon close" aria-label="Close">${ICON.close}</button></header>
        <div class="body">${o.desc ? `<div class="desc">${o.desc}</div>` : ''}${!players && o.playerLabel && o.playerLabel !== o.label ? `<div class="seen-as">Players see: <b>${o.playerLabel}</b></div>` : ''}${!players && o.dm ? `<div class="dm"><span class="dm-tag">${ICON.eyeOff}DM only</span>${o.dm}</div>` : ''}${inside}${state ? `<div class="state">${state}</div>` : ''}</div>
        ${players ? (openBtn ? `<div class="actions">${openBtn}</div>` : '') : `<div class="actions">${openBtn}${o.vis !== 'player' ? `<button class="${openBtn ? '' : 'primary'}" data-a="reveal">${o.revealed ? 'Hide from players' : 'Reveal to players'}</button>` : ''}${hit.room ? `<button data-a="frame">Frame ${hit.room.key}</button>` : ''}${hit.secretDoor ? `<button data-a="secret">${hit.secretDoor.revealed ? 'Hide secret door' : 'Reveal secret door'}</button>` : ''}</div>`}`;
      card.style.left = `${Math.min(x, innerWidth - 360)}px`; card.style.top = `${Math.min(y, innerHeight - 260)}px`;
      card.addEventListener('click', (e) => {
        const b = (e.target as HTMLElement).closest<HTMLElement>('button'); if (!b) return;
        if (b.classList.contains('close')) return closeMenu();
        if (b.dataset.a === 'open') app.toggleOpen(o.id);
        if (b.dataset.a === 'reveal') app.toggleObject(o.id); if (b.dataset.a === 'frame') app.jumpTo(hit.room!.key); if (b.dataset.a === 'secret') app.revealSecretDoor(hit.secretDoor!.id);
        closeMenu(); refresh();
      });
      menu = card; ui.appendChild(card);
      setTimeout(() => addEventListener('pointerdown', (e) => { if (menu && !menu.contains(e.target as Node)) closeMenu(); }, { once: true }), 0);
      return;
    }
    if (app.restricted && hit.room) {
      // Players: a read-only room card.
      const r = hit.room, card = document.createElement('div');
      card.className = 'infocard';
      card.innerHTML = `<header><div><h2></h2></div><button class="icon close" aria-label="Close">${ICON.close}</button></header>${r.desc ? '<div class="body"><div class="desc"></div></div>' : ''}`;
      card.querySelector('h2')!.textContent = r.name;
      if (r.desc) card.querySelector('.desc')!.textContent = r.desc;
      card.style.left = `${Math.min(x, innerWidth - 360)}px`; card.style.top = `${Math.min(y, innerHeight - 200)}px`;
      card.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('.close')) closeMenu(); });
      menu = card; ui.appendChild(card);
      setTimeout(() => addEventListener('pointerdown', (e) => { if (menu && !menu.contains(e.target as Node)) closeMenu(); }, { once: true }), 0);
      return;
    }
    if (hit.door) items.push({ label: hit.door.open ? 'Close door' : 'Open door', icon: ICON.walls, act: () => app.toggleDoor(hit.door!.wallId) });
    if (hit.secretDoor) items.push({ label: hit.secretDoor.revealed ? 'Hide secret door again' : 'Reveal secret door to players', icon: ICON.eye, act: () => app.revealSecretDoor(hit.secretDoor!.id) });
    if (hit.room) {
      if (hit.room.enter && builtPaths.has(hit.room.enter)) { const to = hit.room.enter; items.push({ label: `Enter ${hit.room.name}`, icon: ICON.doorOpen, act: () => { localStorage.setItem('mistlab.scene', to); void app.open(to).then(() => app.layoutChanged()); } }); }
      items.push({ label: `${hit.room.revealed ? 'Hide' : 'Reveal'} ${hit.room.key} ${hit.room.name}`, icon: ICON.reveal, act: () => app.toggleRoom(hit.room!.key) });
      items.push({ label: 'Move party here', icon: ICON.token, act: () => { const t = app.party; if (t) { t.level = app.levelId; t.pos = app.snap(hit.pos); app.afterPartyMoveFromUi(); } } });
      items.push({ label: `Frame ${hit.room.key}`, icon: ICON.party, act: () => app.jumpTo(hit.room!.key) });
    }
    if (!items.length) return;
    menu = document.createElement('div');
    menu.className = 'tapmenu';
    const r = !hit.door && !hit.secretDoor ? hit.room : undefined;
    const head = r ? `<div class="roomhead"><div class="rh-title"><b>${r.key}</b> ${r.name}${r.page ? ` <i>p.${r.page}</i>` : ''}</div>${r.desc ? `<div class="desc">${r.desc}</div>` : ''}${r.dm ? `<div class="dm"><span class="dm-tag">${ICON.eyeOff}DM only</span>${r.dm}</div>` : ''}</div>` : '';
    menu.innerHTML = head + items.map((it, i) => `<button data-i="${i}">${it.icon ?? ''}<span>${it.label}</span></button>`).join('');
    if (r) menu.classList.add('withroom');
    ui.appendChild(menu);
    menu.style.left = `${Math.max(8, Math.min(x, innerWidth - menu.offsetWidth - 8))}px`; menu.style.top = `${Math.max(8, Math.min(y, innerHeight - menu.offsetHeight - 8))}px`;
    menu.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('button'); if (!b) return; items[Number(b.dataset.i)].act(); closeMenu(); refresh(); });
    ui.appendChild(menu);
    setTimeout(() => addEventListener('pointerdown', (e) => { if (menu && !menu.contains(e.target as Node)) closeMenu(); }, { once: true }), 0);
  };

  // The picked-up token's panel (DM): what players see, hit points, reveal, reach helper, initiative, remove.
  const tokPanel = document.createElement('div'); tokPanel.className = 'tokpanel'; tokPanel.hidden = true; ui.appendChild(tokPanel);
  const renderTokPanel = () => {
    const t = app.selected ? app.state.tokens.find((x) => x.id === app.selected) : undefined;
    tokPanel.hidden = !t || app.restricted || t.role === 'party';
    if (tokPanel.hidden || !t) return;
    const en = t.creatureId ? creatureById(t.creatureId) : undefined, st = en && statsOf(en);
    tokPanel.innerHTML = `<header><b>${t.name}</b><span>${en ? `${en.size}${st ? ` · AC ${st.ac} · ${st.speed} · CR ${st.cr}` : ''}` : 'combatant'}</span><button class="icon close" aria-label="Close">${ICON.close}</button></header>
      ${t.role === 'creature' ? `<label>Players see <input data-f="pname" value="${(t.playerName ?? t.name).replace(/"/g, '&quot;')}"></label>${en && seenAs(en) ? `<div class="seen">${seenAs(en)}</div>` : ''}` : ''}
      ${t.hp ? `<div class="hp"><button data-a="hp-" aria-label="Damage">−</button><b>${t.hp.cur}</b> / ${t.hp.max} hp<button data-a="hp+" aria-label="Heal">+</button></div>` : ''}
      <div class="acts">${t.role === 'creature' ? `<button class="${t.hidden ? 'primary' : ''}" data-a="reveal">${t.hidden ? ICON.eye + '<span>Reveal to players</span>' : ICON.eyeOff + '<span>Hide from players</span>'}</button>` : ''}
        ${!app.encounter ? `<button data-a="range" aria-pressed="${app.rangeHelper}">${ICON.grid}<span>Reach</span></button>` : ''}
        ${t.role === 'creature' && !app.encounter ? `<button data-a="init">${ICON.swords}<span>Initiative</span></button>` : ''}
        ${t.role === 'creature' ? `<button data-a="remove">${ICON.close}<span>Remove</span></button>` : ''}</div>`;
  };
  tokPanel.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button'); if (!b) return;
    const id = app.selected; if (!id) return;
    if (b.classList.contains('close')) { app.select(null); return; }
    switch (b.dataset.a) {
      case 'hp-': app.adjustHp(id, -1); break; case 'hp+': app.adjustHp(id, 1); break;
      case 'reveal': { const t = app.state.tokens.find((x) => x.id === id)!; app.setTokenHidden(id, !t.hidden); break; }
      case 'range': app.setRangeHelper(!app.rangeHelper); break;
      case 'init': openEncounterSheet(app, refresh); break;
      case 'remove': app.removeToken(id); break;
    }
    renderTokPanel(); refresh();
  });
  tokPanel.addEventListener('change', (e) => { const el = e.target as HTMLInputElement; if (el.dataset.f === 'pname' && app.selected) app.setPlayerName(app.selected, el.value); });
  const prevOnSelect = app.onSelect; app.onSelect = (id) => { prevOnSelect?.(id); renderTokPanel(); };
  app.onChange = ((prev) => () => { prev?.(); renderTokPanel(); })(app.onChange);

  // Keyboard: R rotate, F find party, / search, Esc clears the tool.
  addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    if (e.key === 'r') app.world.rotate(1); if (e.key === 'R') app.world.rotate(-1);
    if (e.key === 'n' && app.encounter && !app.restricted) { app.nextTurn(1); refresh(); }
    if (e.key === 'f') app.findParty(); if (e.key === '/') { e.preventDefault(); openFinder(); }
    if (e.key === 'Escape') { document.querySelectorAll('.sheet-backdrop').forEach((s) => s.remove()); app.stopPlacing(); app.select(null); app.tool = 'none'; app.setStatus(''); refresh(); }
  });

  function showHelp(): void {
    const h = document.createElement('div');
    h.className = 'sheet-backdrop';
    h.innerHTML = `<div class="sheet help"><header><h2>Running a session</h2><button class="icon close" aria-label="Close">${ICON.close}</button></header><div class="sheet-body">
      <dl>
        <dt>Move the party</dt><dd>Tap the amber token to pick it up, then tap where it goes (tap it again or press Esc to cancel). The room it enters is revealed and remembered; step onto stairs or a trapdoor to change level; the camera follows. In Players mode the party walks: walls and closed doors stop it, and locked doors stay shut until the DM opens them.</dd>
        <dt>Look around</dt><dd>One finger / left-drag pans. Right-drag or a two-finger twist rotates; pinch or scroll zooms. The buttons bottom-left turn in 90° steps, tilt, zoom and find the party. Double-tap a room to frame it.</dd>
        <dt>World map</dt><dd>The map button beside the library opens the Lands of Barovia. Drag the party to a lettered pin or into the wilderness; the card shows the distance and travel time at your pace, and opens the battle map for that place when one is built. Opening a location moves the party marker there.</dd>
        <dt>Initiative</dt><dd>The crossed-swords button opens the roster: speed, reach, range and initiative from each character sheet. Start an encounter and each combatant gets a token. On a turn, green squares are where that combatant can still move and red squares are what it could strike from there; a paler red shows ranged reach with a clear line. Next turn (or N) advances; End folds everyone back into the party marker.</dd>
        <dt>Creatures</dt><dd>The paw button opens the repository: every person, monster and beast the module names, searchable. Place one beside the party, or place by tap and keep tapping to put down as many as you like (Esc stops). Placed creatures start hidden from the players. Tap one to pick it up: the panel shows what players will see (rename it), hit points, Reveal or Hide, the Reach helper (green squares it can move to, red ones it can strike), Initiative, Remove. The DM moves anything anywhere; players move only the party, and only where it can walk.</dd>
        <dt>Section slicer</dt><dd>Buildings with several floors show all of them at once. The Section slider beside the floor tabs cuts the building at any height: slide it up to see the roof, down through the floors, below ground into a cellar. The floor tabs follow the cut; the arrow button snaps the cut back to the current floor.</dd>
        <dt>Find an area</dt><dd>Type a key or name in the search box (or press /). The Rooms list shows every key with its revealed state.</dd>
        <dt>Doors, stairs and choices</dt><dd>Door markers open and close doors; stair and trapdoor markers move the party between levels. Tap anything for a menu of what you can do with it (reveal, hide, move the party, frame). The slider previews what players see.</dd>
        <dt>Players mode</dt><dd>Turn the iPad to the table: only revealed rooms, no DM chrome. DM mode brings everything back.</dd>
      </dl></div></div>`;
    h.addEventListener('click', (e) => { const t = e.target as HTMLElement; if (t === h || t.closest('.close')) h.remove(); });
    document.body.appendChild(h);
    localStorage.setItem('mistlab.helpSeen', '1');
  }
  if (!localStorage.getItem('mistlab.helpSeen')) queueMicrotask(() => ready.then(showHelp));
}

function buildHud(): void {
  const hud = document.createElement('pre');
  hud.className = 'hud';
  document.body.appendChild(hud);
  setInterval(() => {
    const i = app.world.renderer.info;
    hud.textContent = `tris ${i.render.triangles}\ncalls ${i.render.calls}\ngeoms ${i.memory.geometries} tex ${i.memory.textures}\nfps ${app.world.fps.toFixed(0)}`;
  }, 500);
}
