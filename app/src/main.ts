import './styles.css';
import { App, type GridMode, type MeasureResult } from './app';
import { builtPaths, loadLocation } from './data';
import { worldOf } from './campaigns';
import { openWorldMap, pinForScene, worldPins } from './ui/worldmap';
import { buildMinimap } from './ui/minimap';
import { dayFromHarptos, harptosParts, MONTH_NAMES, FESTIVALS } from './core/sky';
import { PACES, paceNote, type Pace } from './core/travel';
import { openBestiary } from './ui/bestiary';
import { creatureById, seenAs } from './bestiary';
import { openEncounterSheet, turnBar } from './ui/encounter';
import { ICON } from './ui/icons';
import { booksUi, openLibrary } from './ui/library';
import { ViewSlider } from './ui/viewSlider';
import { ATLAS } from './render/worldstage';
import * as frames from './core/frames';
import { mountTips, type Tips } from './ui/tooltip';
import { loadRich, termsNow } from './ui/rich';
import { creatureCardHtml, objectCardHtml, pageref, playersRoomCardHtml, roomHeadHtml } from './ui/cards';
import { esc } from './ui/text';
import { isKey } from './core/keys';

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
  // a scene point (feet, on the current level) to page pixels, through the scene's placement in the world
  screenOf: (x: number, z: number, y = 0) => { const v = app.toWorld3(x, app.level.elevationFt + y, z).project(app.world.camera); const r = app.world.renderer.domElement.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; },
  partyPos: () => app.party?.pos,
  get tips() { return tips; },
  /** The rules-link pipeline (ui/terms.ts), loaded on demand. */
  terms: () => import('./ui/terms'),
  /** Load the rules links for the map's cards now (the DM window otherwise does it shortly after the scene is ready). */
  rich: () => loadRich(sceneOf).then(() => true),
  /** A creature's one source of numbers (ui/creature.ts). */
  creature: () => import('./ui/creature'),
  /** The books' lookup and the Rules edition preference (loaded on demand). */
  lookup: (term: string, edition?: '2014' | '2024') => import('./books/lookup').then((b) => b.lookup(term, edition)),
  setEdition: (e: '2014' | '2024') => import('./books/lookup').then((b) => b.setRulesEdition(e)),
  /** Every built scene's path. */
  scenes: () => [...builtPaths],
  /** The active campaign's world-map pins. */
  pins: () => worldPins(),
  /** Open the card a tap on an object or a room of the current level opens (the players' version in Players view). */
  tapCard: (t: { object?: string; room?: string }, x = 420, y = 240) => {
    const players = app.view === 'players';
    const obj = t.object ? app.level.objects.find((o) => o.id === t.object) : undefined;
    const room = t.room ? app.level.rooms.find((r) => r.key === t.room) : !players && obj ? app.level.rooms.find((r) => r.key === obj.key) : undefined;
    app.onTap?.({ pos: [0, 0], object: obj ? app.tapObject(obj, players) : undefined, room: room && !(players && obj) ? app.tapRoom(room, players) : undefined }, x, y);
  },
  moveParty: (level: string, x: number, z: number) => { const t = app.party; if (t) { t.level = level; t.pos = [x, z]; } app.setLevel(level); app.world.renderNow(); },
  // the nested world's seam: scene → drawn placement, the floating origin, and a hook that stands the scene elsewhere
  get placement() { return app.placement.toArray(); },
  toWorld: (x: number, z: number) => app.toWorld([x, z]),
  toLocal: (x: number, z: number) => app.toLocal([x, z]),
  get anchor() { return app.world.anchor.toArray(); },
  setPlacement: (abs: [number, number, number], rotationY: number, reanchor = true) => { app.setPlacement(abs, rotationY, reanchor); app.world.renderNow(); },
  // the continuous world: the valley stage (land, proxies, forest, sky), the placement atlas, and whether it is on
  get stage() { return app.stage; },
  get atlas() { return ATLAS; },
  frames,
  get nested() { return app.nested; },
  get staged() { return app.staged; },
};

// Rules books: a #book/<id>/<section> link opens the reader (DM only; its code loads on demand).
if (mode === 'dm') {
  const bookLink = () => { if (location.hash.startsWith('#book/')) void booksUi().then((m) => m.openFromHash()); };
  addEventListener('hashchange', bookLink);
  bookLink();
}

if ('serviceWorker' in navigator && import.meta.env.PROD && !q.has('nosw')) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  // Help's attribution chunk is tiny and lazy: fetch it once the worker is in control, so it is cached for offline play.
  void navigator.serviceWorker.ready.then(() => setTimeout(() => void import('./books/attribution').catch(() => {}), 4000));
  // The DM's Books tab code likewise, so the tab works offline even if it was never opened online.
  if (mode === 'dm') void navigator.serviceWorker.ready.then(() => setTimeout(() => void booksUi().catch(() => {}), 6000));
  // The emblem sprite and the rules card likewise (DM only: the Player Display never loads either).
  if (mode === 'dm') void navigator.serviceWorker.ready.then(() => setTimeout(() => { void import('./ui/emblems').catch(() => {}); void import('./ui/rulecard').catch(() => {}); }, 7000));
  // The bundled fonts load on first use; keep them for offline play: on the first idle moment at least 3 s after the
  // scene is ready, ask the worker to store them (the same 'cache-pack' message the books use).
  if (mode === 'dm') void Promise.all([ready, navigator.serviceWorker.ready]).then(([, reg]) => setTimeout(() => {
    const post = () => reg.active?.postMessage({ type: 'cache-pack', urls: FONT_FILES.map((f) => new URL(`fonts/${f}`, document.baseURI).href) });
    if ('requestIdleCallback' in window) requestIdleCallback(post, { timeout: 4000 }); else post();
  }, 3000)).catch(() => {});
}

// Rules links in module text (ui/terms.ts): once the scene is ready, the DM window loads the term files of both
// editions (until then, text renders plain). Never on the players' side.
function sceneOf(p: string) { return app.cur?.path === p ? app.cur.scene : undefined; }
if (mode === 'dm') void ready.then(() => setTimeout(() => void loadRich(sceneOf).catch(() => {}), 2500));

let slider: ViewSlider | undefined;
let tips: Tips | undefined;
/** The bundled fonts (public/fonts), stored for offline play after the first scene is ready. */
const FONT_FILES = ['atkinson-next-400-700.woff2', 'alegreya-sc-700.woff2', 'alegreya-400-700.woff2', 'alegreya-italic-400-700.woff2', 'grenze-gotisch-600.woff2', 'fraunces-wonk-soft-700.woff2'];

function buildDmUi(): void {
  const ui = document.getElementById('ui')!;
  // Tips and rules cards (tooltip manager). A slider move into or out of the players' preview closes them all.
  let band = 1;
  slider = new ViewSlider((t) => { app.setT(t); const b = t <= 0 ? 0 : t >= 1 ? 1 : 0.5; if (b !== band) { band = b; dispatchEvent(new Event('mistlab:view')); } });
  ui.appendChild(slider.el);

  const top = document.createElement('div');
  top.className = 'topbar';
  top.innerHTML = `
    <div class="group left">
      <button class="icon" data-act="library" aria-label="Library" data-tip="Library">${ICON.library}</button>
      <button class="icon" data-act="world" aria-label="World map" data-tip="World map of Barovia">${ICON.map}</button>
      <div class="title"><span class="loc"></span><span class="sub"></span></div>
      <button class="icon back" data-act="back" hidden aria-label="Back to the town" data-tip="Back to the town map">${ICON.rotateL}</button>
      <div class="seg mode" role="tablist" aria-label="Mode">
        <button role="tab" data-view="dm" aria-label="DM" data-tip="DM view">DM</button><button role="tab" data-view="players" aria-label="Players" data-tip="Players view">Players</button>
      </div>
    </div>
    <div class="group center"><label class="levels-pick"><span class="sr">Floor</span><select class="levels" aria-label="Floor"></select></label><button class="icon whole" data-act="whole" aria-label="Whole building" data-tip="Whole building" data-tip-sub="Lift the cut and see every floor">${ICON.zoomOut}</button><label class="section" hidden data-tip="Section" data-tip-sub="Slide to cut the building at any height"><span class="sec-label">Section</span><input type="range" min="0" max="100" step="0.5" list="sec-detents" aria-label="Section height"><datalist id="sec-detents"></datalist><span class="sec-ft"></span><button class="icon" data-act="sec-follow" aria-label="Follow the floor" data-tip="Follow the floor">${ICON.walls}</button></label></div>
    <div class="group right dm-only">
      <details class="menu" data-menu="tools"><summary class="icon" aria-label="Reveal and measure tools" data-tip="Tools">${ICON.reveal}</summary><div class="menu-panel">
        <button class="icon" data-tool="reveal" aria-label="Reveal / hide (tap a room, object or secret door)" data-tip="Reveal / hide">${ICON.reveal}<span>Reveal / hide</span></button>
        <button class="icon" data-tool="brush-reveal" aria-label="Paint reveal" data-tip="Paint reveal">${ICON.brush}<span>Paint reveal</span></button>
        <button class="icon" data-tool="brush-fog" aria-label="Paint fog" data-tip="Paint fog">${ICON.fog}<span>Paint fog</span></button>
        <button class="icon" data-tool="measure" aria-label="Measure (tap two points)" data-tip="Measure" data-tip-sub="Tap two points">${ICON.ruler}<span>Measure</span></button>
        <button class="icon" data-act="undo" aria-label="Undo reveal" data-tip="Undo reveal">${ICON.undo}<span>Undo reveal</span></button>
      </div></details>
      <button class="icon" data-act="creatures" aria-label="Creatures" data-tip="Creatures" data-tip-sub="People, monsters and beasts to place">${ICON.paw}</button>
      <button class="icon" data-act="encounter" aria-label="Initiative" data-tip="Initiative" data-tip-sub="Roll, ranges, turns">${ICON.swords}</button>
      <button class="icon" data-act="search" aria-label="Go to area (/)" data-tip="Go to area" data-key="search">${ICON.search}</button>
      <button class="icon" data-act="rooms" aria-label="Rooms" data-tip="Rooms">${ICON.list}</button>
      <details class="menu" data-menu="view"><summary class="icon" aria-label="View options" data-tip="View">${ICON.grid}</summary><div class="menu-panel">
        <div class="menu-row seg-row" role="radiogroup" aria-label="Grid"><span>Grid</span><div class="seg"><button role="radio" data-grid="square">Square</button><button role="radio" data-grid="hex">Hex</button><button role="radio" data-grid="off">Off</button></div></div>
        <label class="menu-row" data-tip="Grid opacity"><span>Opacity</span><input type="range" min="0" max="100" step="5" data-opt="gridOpacity" aria-label="Grid opacity"></label>
        <button class="icon" data-act="snap" aria-label="Snap moves to the grid" aria-pressed="true" data-tip="Snap to grid">${ICON.grid}<span>Snap to grid</span></button>
        <button class="icon" data-act="walls" aria-label="Walls: low / full" data-tip="Walls">${ICON.walls}<span>Walls low / full</span></button>
        <button class="icon" data-act="mist" aria-label="Mist on / off" aria-pressed="true" data-tip="Mist on / off">${ICON.fog}<span>Mist</span></button>
        <button class="icon" data-act="nested" aria-label="Continuous world" aria-pressed="true" data-tip="Continuous world" data-tip-sub="Maps stand in the whole valley; off opens each map alone in the mist">${ICON.map}<span>Continuous world</span></button>
        <button class="icon" data-act="labels" aria-label="Labels: keys / all / none" data-tip="Labels"><i></i><span>Labels</span></button>
        <button class="icon" data-act="lock" aria-label="Player camera follows DM" data-tip="Player camera follows DM"><i></i><span>Players follow my camera</span></button>
        <button class="icon" data-act="display" aria-label="Open Player Display" data-tip="Open Player Display">${ICON.display}<span>Player display</span></button>
      </div></details>
    </div>`;
  ui.appendChild(top);

  // Camera cluster: bottom-left, thumb-reachable.
  const cam = document.createElement('div');
  cam.className = 'camcluster';
  cam.innerHTML = `
    <button class="icon" data-cam="rotL" aria-label="Rotate left" data-tip="Rotate left" data-key="rotateLeft">${ICON.rotateL}</button>
    <button class="icon" data-cam="rotR" aria-label="Rotate right" data-tip="Rotate right" data-key="rotateRight">${ICON.rotateR}</button>
    <button class="icon" data-cam="tilt" aria-label="Tabletop view" data-tip="Tilt the camera" data-tip-sub="Tabletop · isometric · overhead" data-preset="tabletop">${ICON.top}</button>
    <span class="divider"></span>
    <button class="icon" data-cam="zoomIn" aria-label="Zoom in" data-tip="Zoom in">${ICON.zoomIn}</button>
    <button class="icon" data-cam="zoomOut" aria-label="Zoom out" data-tip="Zoom out">${ICON.zoomOut}</button>
    <span class="divider"></span>
    <button class="icon" data-cam="party" aria-label="Find the party" data-tip="Find the party" data-key="findParty">${ICON.party}</button>
    <button class="icon" data-cam="follow" aria-label="Follow the party" aria-pressed="true" data-tip="Follow the party">${ICON.token}</button>
    <span class="divider"></span>
    <button class="icon" data-cam="help" aria-label="Help" data-tip="Help">${ICON.help}</button>`;
  ui.appendChild(cam);
  const minimap = buildMinimap(app, ui, () => openClock());
  ui.insertAdjacentHTML('beforeend', `<div class="mapframe" aria-hidden="true"><div class="compass"><svg viewBox="0 0 40 40"><path d="M20 4 L26 22 L20 18 L14 22 Z" fill="#c0392b"/><path d="M20 36 L14 18 L20 22 L26 18 Z" fill="#e8e3d8" opacity=".55"/></svg><b>N</b></div><div class="scalebar"><i></i><span>50 ft</span></div></div>`);
  cam.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!b) return;
    switch (b.dataset.cam) {
      case 'rotL': app.world.rotate(1); break;
      case 'rotR': app.world.rotate(-1); break;
      case 'tilt': { const next = { tabletop: 'iso', iso: 'top', top: 'tabletop' } as const; app.camPreset = next[app.camPreset]; app.world.setPreset(app.camPreset); b.setAttribute('aria-label', { tabletop: 'Tabletop view', iso: 'Isometric view', top: 'Overhead view' }[app.camPreset]); b.dataset.preset = app.camPreset; break; }
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
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const first = results.querySelector<HTMLElement>('button'); first?.click(); } if (isKey(e, 'escape')) closeFinder(); });
  results.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-key]'); if (!b) return; app.jumpTo(b.dataset.key!); closeFinder(); });

  const bar = turnBar(app, () => refresh()) as HTMLElement & { update: () => void };
  ui.appendChild(bar);

  const status = document.createElement('div');
  status.className = 'status';
  ui.appendChild(status);
  // The toast sits above the turn bar while one shows, so a blocked move's 'Not your turn' is never covered.
  const placeStatus = (): void => {
    const r = bar.hidden ? null : bar.getBoundingClientRect();
    status.style.bottom = r && r.height ? `${Math.ceil(ui.getBoundingClientRect().bottom - r.top + 8)}px` : '';
  };
  // A finished measurement shows its distance as a rules chip (DM side): its card names the diagonal rule in use.
  const measureHtml = (m: MeasureResult): string => `<button type="button" class="rl rule" data-kind="measure" data-rule="${m.rule}" data-ft="${m.ft}" data-squares="${m.squares}" aria-expanded="false">${m.ft} ft</button> · ${m.squares} squares · tap to measure again`;
  app.onStatus = (s, m) => { if (m && !app.playersSide) status.innerHTML = measureHtml(m); else status.textContent = s; status.classList.toggle('on', !!s); if (s) { placeStatus(); clearTimeout(statusTimer); statusTimer = window.setTimeout(() => { if (app.tool === 'none') { status.classList.remove('on'); } }, 2200); } };
  let statusTimer = 0;

  // Nesting: Enter a building from its room (menu or card), go up to the map it belongs to, or out to the world map.
  const enterRoom = (r: { key: string; enter?: string }) => { const to = app.enterOf(r); if (!to) return; localStorage.setItem('mistlab.scene', to); void app.enter(to, r.key).then(() => app.layoutChanged()); };
  const goUp = () => { const up = app.parentPath; if (!up) return; localStorage.setItem('mistlab.scene', up); void app.openParent().then(() => app.layoutChanged()); };
  const openWorld = (focus?: string) => openWorldMap({
    canMove: !app.restricted,
    dm: !app.playersSide,
    revealed: () => app.pinsRevealed,
    reveal: (key, on) => app.revealPin(key, on),
    get: () => app.state.world,
    move: (pos, key, miles) => app.moveWorld(pos, key, miles),
    enter: (path) => { localStorage.setItem('mistlab.scene', path); void app.open(path).then(() => app.layoutChanged()); },
    sceneName: async (path) => (await loadLocation(path)).scene.name,
    focus,
  });
  // A zoom out at the far limit (button, wheel or pinch) shows a chip for the map one level up: the town a building
  // belongs to, else the world map round this map's place. One tap goes; it fades by itself and never goes by itself.
  const chip = document.createElement('button');
  chip.className = 'zoomchip'; chip.hidden = true;
  ui.appendChild(chip);
  let chipGo: (() => void) | null = null, chipTimer = 0;
  const dropChip = () => { clearTimeout(chipTimer); chipGo = null; chip.classList.remove('on'); chipTimer = window.setTimeout(() => { chip.hidden = true; }, 250); };
  app.world.onZoomPastMax = () => {
    if (app.restricted || !app.cur) return; // the DM's: never in Players mode (the Player Display has no UI at all)
    const path = app.cur.path, up = app.parentPath;
    // in the continuous world a pin's map zooms out to the whole valley first; from there, to the world map sheet
    const valley = !up && app.staged && app.stage && !app.stage.framed;
    void (up ? loadLocation(up).then((l) => l.scene.name) : Promise.resolve(valley ? 'the whole valley' : worldOf(app.campaign).name)).then((name) => {
      if (app.cur?.path !== path || app.restricted) return;
      chipGo = up ? goUp : valley ? () => app.stage?.frameWorld('fly') : () => openWorld(pinForScene(path)?.key);
      chip.innerHTML = `${ICON.zoomOut}<span></span>`;
      chip.querySelector('span')!.textContent = `Zoom out to ${name.replace(/^The /, 'the ')}`;
      chip.hidden = false; requestAnimationFrame(() => chip.classList.add('on'));
      clearTimeout(chipTimer); chipTimer = window.setTimeout(dropChip, 5000);
    });
  };
  chip.addEventListener('click', () => { const go = chipGo; dropChip(); go?.(); });
  // A place's name over the valley (DM view): fly there and open its map.
  app.onPlacePick = (path) => { if (app.cur?.path === path) { app.frameLevel(app.camPreset, true); return; } localStorage.setItem('mistlab.scene', path); void app.open(path).then(() => app.layoutChanged()); };
  // What covers the view: the bars along its edges frame the whole valley; every panel keeps the place names clear.
  const shown = (sel: string) => [...ui.querySelectorAll<HTMLElement>(sel)].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
  app.world.chrome = () => {
    const bars = shown('.topbar > .group, .vslider, .camcluster');
    return { bars, panels: [...bars, ...shown('.minimap, .mapframe, .zoomchip:not([hidden])')] };
  };

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
  // openClock is defined below; the minimap's clock button calls it through this hook.
  function openClock(): void {
    if (clockEl) { clockEl.remove(); clockEl = null; return; }
    const el = document.createElement('div'); el.className = 'clockpop page'; clockEl = el;
    const travel = { miles: 6, pace: 'normal' as Pace, difficult: false, mounted: false };
    // The pace table; difficult terrain halves it; a mount can gallop for about an hour at twice the pace (the rules' mounted travel).
    const travelHours = () => { let mph = PACES[travel.pace].mph; if (travel.difficult) mph /= 2; let miles = travel.miles, h = 0; if (travel.mounted) { const g = Math.min(miles, mph * 2); miles -= g; h += g / (mph * 2); } return h + miles / mph; };
    const elapsed = (h: number) => Math.floor(h / 8) * 24 + (h % 8); // eight hours of travel a day; the rest is camp
    // The pace's effect follows the Rules edition (2014: our short form; 2024: read from the 2024 book). Miles,
    // minutes and the day count never change with it.
    let notes2024: Partial<Record<Pace, string>> | undefined;
    const edition = () => termsNow()?.edition() ?? '2024';
    void loadRich(sceneOf).then((t) => t.paceNotes2024()).then((n) => { notes2024 = n; if (clockEl === el) render(); }, () => {});
    const onEd = () => { if (clockEl !== el) return removeEventListener('mistlab:rules-edition', onEd); render(); };
    addEventListener('mistlab:rules-edition', onEd);
    const rl = (term: string, word: string) => `<button type="button" class="rl rule" data-kind="rule" data-term="${term}" aria-expanded="false">${word}</button>`;
    const render = () => {
      const s = app.sky, c = app.clock, hp = harptosParts(c.day), th = travelHours();
      const months = [...MONTH_NAMES.map((m, i) => `<option value="${i}"${hp.month === i ? ' selected' : ''}>${m}</option>`), ...FESTIVALS.map((f, i) => `<option value="${12 + i}"${hp.month === 12 + i ? ' selected' : ''}>${f.name}</option>`)].join('');
      el.innerHTML = `<div class="ck-head"><b>${s.label.split(' · ').slice(1).join(' · ')}</b><button class="icon close" aria-label="Close" data-tip="Close">${ICON.close}</button></div>
        <label>Hour <input type="range" min="0" max="23.75" step="0.25" value="${c.hour}" data-f="hour"><span class="ck-val">${s.label.split(' · ')[1]}</span></label>
        <div class="ck-row"><button data-a="day-">−1 day</button><label class="ck-field">Day <input type="number" min="1" value="${c.day}" data-f="day" aria-label="Day of the campaign"></label><button data-a="day+">+1 day</button><span class="spacer"></span><button data-a="h-1">−1 h</button><button data-a="h+1">+1 h</button><button data-a="h+8">+8 h</button></div>
        <div class="ck-row"><label class="ck-field">Date <select data-f="month" aria-label="Month">${months}</select><input type="number" min="1" max="30" value="${hp.dom}" data-f="dom" aria-label="Day of the month"${hp.month >= 12 ? ' disabled' : ''}></label></div>
        <div class="ck-row ck-moon"><span class="moon" style="--lit:${s.moonLit.toFixed(2)}"></span><span>${s.moonName}${s.night ? ' · night' : s.ambient === 'fog' ? ' · dusk light' : ' · daylight'}</span></div>
        <div class="ck-travel"><b>Travel</b>
          <div class="ck-row"><label class="ck-field"><input type="number" min="0" step="0.5" value="${travel.miles}" data-t="miles" aria-label="Miles"> mi</label>
            <select data-t="pace" aria-label="Pace">${(['slow', 'normal', 'fast'] as Pace[]).map((p) => `<option value="${p}"${travel.pace === p ? ' selected' : ''}>${p[0].toUpperCase() + p.slice(1)} · ${PACES[p].mph} mph · ${PACES[p].milesPerDay} mi/day</option>`).join('')}</select>
            <span class="ck-pace">${rl('rule:travel-pace', `${travel.pace[0].toUpperCase() + travel.pace.slice(1)} pace`)}</span></div>
          <div class="ck-row"><label class="ck-check"><input type="checkbox" data-t="difficult"${travel.difficult ? ' checked' : ''}> ${rl('rule:difficult-terrain', 'Difficult terrain')} (half speed)</label><label class="ck-check"><input type="checkbox" data-t="mounted"${travel.mounted ? ' checked' : ''}> ${rl('rule:mounted-combat', 'Mounted')} (gallops the first hour)</label></div>
          <div class="ck-row"><span class="ck-out">${th < 1 ? `${Math.round(th * 60)} min` : `${Math.floor(th)} h ${Math.round((th % 1) * 60)} min`}${th > 8 ? ` · ${Math.ceil(th / 8)} days of travel (8 h a day)` : ''}${(() => { const n = paceNote(travel.pace, edition(), notes2024); return n ? ` · <span class="ck-note">${esc(n)}</span>` : ''; })()}</span><button class="primary" data-a="travel">Travel: advance ${elapsed(th) >= 24 ? `${Math.floor(elapsed(th) / 24)} d ${Math.round(elapsed(th) % 24)} h` : `${Math.round(elapsed(th))} h`}</button></div>
        </div>`;
    };
    render();
    el.addEventListener('change', (e) => {
      const t = e.target as HTMLInputElement | HTMLSelectElement, c = app.clock;
      if (t.dataset.f === 'day') { app.setClock(Math.max(1, Math.round(Number(t.value)) || 1), c.hour); render(); refresh(); }
      if (t.dataset.f === 'month' || t.dataset.f === 'dom') { const m = Number(el.querySelector<HTMLSelectElement>('[data-f="month"]')!.value), d = Number(el.querySelector<HTMLInputElement>('[data-f="dom"]')!.value) || 1; app.setClock(dayFromHarptos(m, d), c.hour); render(); refresh(); }
      if (t.dataset.t === 'miles') travel.miles = Math.max(0, Number(t.value) || 0);
      if (t.dataset.t === 'pace') travel.pace = t.value as Pace;
      if (t.dataset.t === 'difficult') travel.difficult = (t as HTMLInputElement).checked;
      if (t.dataset.t === 'mounted') travel.mounted = (t as HTMLInputElement).checked;
      if (t.dataset.t) render();
    });
    el.addEventListener('input', (e) => { const t = e.target as HTMLInputElement; if (t.dataset.f === 'hour') { app.setClock(app.clock.day, Number(t.value)); el.querySelector('.ck-val')!.textContent = app.sky.label.split(' · ')[1]; el.querySelector('.ck-head b')!.textContent = app.sky.label.split(' · ').slice(1).join(' · '); refresh(); } });
    el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('button'); if (!b) return;
      if (b.classList.contains('close')) { el.remove(); clockEl = null; return; }
      const a = b.dataset.a; const c = app.clock;
      if (a === 'day-') app.setClock(c.day - 1, c.hour); if (a === 'day+') app.setClock(c.day + 1, c.hour);
      if (a === 'h-1') app.advance(-1); if (a === 'h+1') app.advance(1); if (a === 'h+8') app.advance(8);
      if (a === 'travel') app.advance(elapsed(travelHours()));
      render(); refresh();
    });
    ui.appendChild(el);
  }
  // The compass turns with the camera; the scale bar stretches to a round number of feet.
  const frameUi = () => {
    const f = app.cameraFrame(), c = document.querySelector<HTMLElement>('.mapframe .compass svg'), sb = document.querySelector<HTMLElement>('.mapframe .scalebar'); if (!c || !sb || !app.cur) return;
    c.style.transform = `rotate(${(f.north * 180 / Math.PI).toFixed(1)}deg)`;
    const steps = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5280]; let ft = steps[0];
    for (const s of steps) { ft = s; if (s * f.pxPerFt >= 70) break; }
    const px = Math.max(8, Math.min(220, ft * f.pxPerFt));
    (sb.querySelector('i') as HTMLElement).style.width = `${px.toFixed(0)}px`; sb.querySelector('span')!.textContent = ft === 5280 ? '1 mile' : `${ft} ft`;
  };
  app.onCameraUi = frameUi;
  let shownLevel = '';
  const refresh = () => {
    frameUi();
    { const c = app.clock, b = document.querySelector<HTMLElement>('[data-act="clock"]'); if (b) { b.querySelector('.ck-time')!.textContent = app.sky.label.split(' · ')[1]; b.querySelector('.ck-day')!.textContent = `Day ${c.day} · ${app.sky.label.split(' · ')[2]}`; b.querySelector('svg')?.replaceWith(Object.assign(document.createElement('i'), { innerHTML: app.sky.night ? ICON.moon : ICON.sun }).firstElementChild!); b.classList.toggle('night', app.sky.night); } }
    bar.update();
    const range = app.sectionRange;
    section.hidden = !range;
    if (range) {
      secIn.min = String(range.min); secIn.max = String(range.max); const v = app.cutFt ?? app.followCutFt; secIn.value = String(v); secFt.textContent = `${Math.round(v)} ft`; section.classList.toggle('free', app.cutFt !== undefined);
      const detents = app.floorCuts.map((d) => `<option value="${d.ft}" label="${d.name}"></option>`).join('');
      if (secList.innerHTML !== detents) secList.innerHTML = detents;
    }
    if (!app.cur) return;
    if (app.levelId !== shownLevel) { shownLevel = app.levelId; tips?.closeAll(); }
    document.body.dataset.view = app.view;
    top.querySelector('.loc')!.textContent = app.cur.scene.name;
    top.querySelector<HTMLElement>('.back')!.hidden = !app.parentPath; // a building, up to its town; hidden on a top-level map
    top.querySelector('.sub')!.textContent = `${app.cur.scene.mapPage ? `map p.${app.cur.scene.mapPage}` : app.campaign.name} · ${app.cur.scene.placementFt ? `${app.cur.scene.placementFt}-ft placement squares` : `${app.cur.scene.bookScaleFt}-ft squares`}`;
    top.querySelectorAll<HTMLElement>('[data-view]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === app.view)));
    const lv = top.querySelector<HTMLSelectElement>('select.levels')!;
    const opts = app.cur.scene.levels.map((l) => `<option value="${l.id}"${l.id === app.levelId ? ' selected' : ''}>${l.name}${app.party?.level === l.id ? '  ·  party here' : ''}</option>`).join('');
    if (lv.innerHTML !== opts) lv.innerHTML = opts;
    lv.value = app.levelId;
    const multi = app.cur.scene.levels.length > 1;
    (lv.parentElement as HTMLElement).style.display = multi ? '' : 'none';
    (top.querySelector('[data-act="whole"]') as HTMLElement).style.display = multi && app.sectionRange ? '' : 'none';
    top.querySelectorAll<HTMLElement>('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === app.tool)));
    const slot = (act: string, html: string) => { const b = top.querySelector(`[data-act="${act}"]`)!; (b.querySelector('i') ?? b).innerHTML = html; };
    top.querySelectorAll<HTMLElement>('[data-grid]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.grid === app.gridMode)));
    { const sm = top.querySelector('details[data-menu="view"] > summary')!; sm.innerHTML = app.gridMode === 'hex' ? ICON.hex : app.gridMode === 'square' ? ICON.grid : ICON.gridOff; }
    slot('labels', app.labelMode === 'all' ? ICON.label : app.labelMode === 'keys' ? ICON.labelKeys : ICON.labelOff);
    top.querySelector('[data-act="walls"]')!.setAttribute('aria-pressed', String(!app.lowWalls));
    top.querySelector('[data-act="snap"]')!.setAttribute('aria-pressed', String(app.gridSnap));
    top.querySelector('[data-act="nested"]')!.setAttribute('aria-pressed', String(app.nested));
    { const r = top.querySelector<HTMLInputElement>('[data-opt="gridOpacity"]')!; if (document.activeElement !== r) r.value = String(Math.round(app.gridOpacity * 100)); }
    slot('lock', app.lockPlayerCamera ? ICON.lock : ICON.unlock);
    top.querySelector('[data-act="lock"]')!.setAttribute('aria-pressed', String(app.lockPlayerCamera));
    top.querySelector('details[data-menu="tools"]')!.classList.toggle('active', app.tool !== 'none');
    minimap.draw();
    cam.querySelector('[data-cam="follow"]')!.setAttribute('aria-pressed', String(app.follow));
    cam.querySelector('[data-cam="tilt"]')!.innerHTML = app.camPreset === 'top' ? ICON.camera : ICON.top;
    app.onCameraUi = () => { frameUi(); minimap.draw(); };
    slider!.el.hidden = app.view === 'players';
    if (app.restricted && !chip.hidden) dropChip();
    if (roomsSheet) renderRooms();
  };
  app.onChange = refresh;

  top.querySelector<HTMLSelectElement>('select.levels')!.addEventListener('change', (e) => app.setLevel((e.target as HTMLSelectElement).value, true));
  top.addEventListener('input', (e) => { const r = e.target as HTMLInputElement; if (r.dataset.opt === 'gridOpacity') app.setGridOpacity(Number(r.value) / 100); });
  top.addEventListener('toggle', (e) => { const d = e.target as HTMLDetailsElement; if (d.open) top.querySelectorAll<HTMLDetailsElement>('details.menu[open]').forEach((o) => { if (o !== d) o.open = false; }); }, true);
  document.addEventListener('pointerdown', (e) => { if (!(e.target as Element).closest('details.menu')) top.querySelectorAll<HTMLDetailsElement>('details.menu[open]').forEach((o) => { o.open = false; }); });
  top.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!b) return;
    if (b.dataset.tool) b.closest<HTMLDetailsElement>('details.menu')?.removeAttribute('open');
    if (b.dataset.grid) { app.gridMode = b.dataset.grid as typeof app.gridMode; app.layoutChanged(); return; }
    if (b.dataset.level) app.setLevel(b.dataset.level, true);
    if (b.dataset.view) app.setView(b.dataset.view as 'dm' | 'players');
    if (b.dataset.tool) { app.tool = app.tool === b.dataset.tool ? 'none' : (b.dataset.tool as typeof app.tool); app.setStatus(app.tool === 'none' ? '' : b.getAttribute('aria-label')!); }
    switch (b.dataset.act) {
      case 'library': openLibrary(builtPaths, app.campaign, (p) => { localStorage.setItem('mistlab.scene', p); void app.open(p).then(() => app.layoutChanged()); }); break;
      case 'clock': openClock(); break;
      case 'back': goUp(); break; // framed on the building just left
      case 'world': openWorld(); break;
      case 'encounter': app.encounter ? bar.update() : openEncounterSheet(app, refresh); break;
      case 'creatures': openBestiary(app, refresh); break;
      case 'undo': app.undo(); break;
      case 'sec-follow': app.setCut(undefined); break;
      case 'whole': if (app.sectionRange) { app.setCut(app.sectionRange.max); app.frameLevel(); } break;
      case 'search': finder.hidden ? openFinder() : closeFinder(); break;
      case 'rooms': toggleRooms(); break;
      case 'grid': app.gridMode = app.gridMode === 'square' ? 'hex' : app.gridMode === 'hex' ? 'off' : 'square'; app.layoutChanged(); break;
      case 'snap': app.setGridSnap(!app.gridSnap); break;
      case 'walls': app.lowWalls = !app.lowWalls; app.layoutChanged(); break;
      case 'nested': void app.setNestedMode(!app.nested).then(refresh); break;
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
  const toggleRooms = () => { if (roomsSheet) { roomsSheet.remove(); roomsSheet = null; return; } roomsSheet = document.createElement('aside'); roomsSheet.className = 'rooms dm-only page'; ui.appendChild(roomsSheet); renderRooms(); };
  const renderRooms = () => {
    if (!roomsSheet || !app.cur) return;
    roomsSheet.innerHTML = `<header><h2>Rooms</h2><button class="icon close" aria-label="Close" data-tip="Close">${ICON.close}</button></header><div class="rooms-body">` +
      app.cur.scene.levels.map((l) => `<section><h3>${esc(l.name)}${app.party?.level === l.id ? ' · party' : ''}</h3>${l.rooms.map((r) => {
        const on = app.isRevealed(r.key), here = app.party?.level === l.id && app.roomAt(l, app.party.pos)?.key === r.key;
        // The page reference is a rules link of its own (the module page card), beside the Go button, never inside it.
        return `<div class="room${on ? ' on' : ''}${here ? ' here' : ''}"><button class="go" data-go="${esc(r.key)}" data-tip="Go to ${esc(r.key)}"><b>${esc(r.key)}</b><span>${esc(r.name)}</span></button>${r.page ? `<em>${pageref(r.page, `${r.key} · ${r.name}`)}</em>` : ''}<button class="icon eye" data-reveal="${esc(r.key)}" aria-label="${on ? 'Hide from players' : 'Reveal to players'}" data-tip="${on ? 'Hide from players' : 'Reveal to players'}" aria-pressed="${on}">${ICON.eye}</button></div>`;
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
  function closeMenu(): void { menu?.remove(); menu = null; }
  // The tooltip manager: tips, toggletips and rules cards, with the one outside handler that also closes this menu.
  tips = mountTips({ restricted: () => app.restricted, menu: () => menu, closeMenu });
  // A view flip (mode switch, Players view, the slider into or out of its players' end) re-renders everything that
  // reads differently on the players' side, so no DM text is left standing: the turn bar, the token panel, the open
  // menu or card (closed), and a status line that may name a creature (cleared).
  tips.onFlip(() => { bar.update(); closeMenu(); renderTokPanel(); if (app.playersSide && app.tool === 'none') app.setStatus(''); });
  // Hover tooltip (mouse): what is under the cursor.
  app.onHover = (t, x, y) => tips!.canvasTip(t && !menu ? t : null, x, y);
  // The DM's hover line on a creature token: its stat line from the creature's one source (filled once it is read;
  // a change of the Rules edition reads it again).
  const statLines = new Map<string, string>();
  app.statLine = (t) => {
    if (!t.creatureId) return undefined;
    const id = t.creatureId;
    if (!statLines.has(id)) { statLines.set(id, ''); void import('./ui/creature').then(async (m) => { statLines.set(id, m.statLine(await m.creatureSource(id))); }).catch(() => {}); }
    return statLines.get(id) || undefined;
  };
  addEventListener('mistlab:rules-edition', () => statLines.clear());
  app.world.renderer.domElement.addEventListener('pointerleave', () => tips!.clear());
  app.onLeave = () => { closeMenu(); tips!.closeAll(); if (!chip.hidden) dropChip(); };

  app.onTap = (hit, x, y) => {
    closeMenu(); tips!.closeAll();
    const items: { label: string; act: () => void; icon?: string }[] = [];
    // Who reads the card: the players' side (Players view, or the slider at its players' end) gets the players'
    // words and links only; module words go through the rules links (ui/cards.ts, ui/rich.ts); every value is escaped.
    const players = app.playersSide;
    const opts = { players, scenePath: app.cur?.path ?? '', levelId: app.levelId };
    const infoCard = (html: string, h: number) => {
      const card = document.createElement('div'); card.className = 'infocard page';
      card.innerHTML = html;
      card.style.left = `${Math.min(x, innerWidth - 360)}px`; card.style.top = `${Math.min(y, innerHeight - h)}px`;
      menu = card; ui.appendChild(card);
      return card;
    };
    if (hit.token) { // the players' look at a creature
      const card = infoCard(creatureCardHtml(hit.token, opts), 200);
      card.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('.close')) closeMenu(); });
      return;
    }
    if (hit.object && (!players || app.restricted || hit.object.visibleToPlayers)) {
      // Info card: what it is, where, what players see, DM notes, state, actions.
      const o = hit.object, so = app.level.objects.find((x) => x.id === o.id);
      const ownWords = !!so && !!(so.label || so.playerLabel || so.desc || so.dm || so.container?.contents);
      const card = infoCard(objectCardHtml(o, { ...opts, room: hit.room, secretDoor: hit.secretDoor, ownWords, enter: app.enterOf(hit.room) ? hit.room!.name : undefined }), 260);
      card.addEventListener('click', (e) => {
        const b = (e.target as HTMLElement).closest<HTMLElement>('button'); if (!b) return;
        if (b.classList.contains('close')) return closeMenu();
        if (b.dataset.a === 'open') app.toggleOpen(o.id);
        if (b.dataset.a === 'reveal') app.toggleObject(o.id); if (b.dataset.a === 'frame') app.jumpTo(hit.room!.key); if (b.dataset.a === 'secret') app.revealSecretDoor(hit.secretDoor!.id);
        if (b.dataset.a === 'enter') enterRoom(hit.room!);
        closeMenu(); refresh();
      });
      return;
    }
    if (app.restricted && hit.room) {
      // Players: a read-only room card.
      const card = infoCard(playersRoomCardHtml(hit.room, opts), 200);
      card.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('.close')) closeMenu(); });
      return;
    }
    if (hit.door) items.push({ label: hit.door.open ? 'Close door' : 'Open door', icon: ICON.walls, act: () => app.toggleDoor(hit.door!.wallId) });
    // At the slider's players' end the DM still acts, but a room the players have not found keeps its name and words
    // to itself, and a hidden secret door is not there at all (as in the hover tip).
    const unseen = players && !!hit.room && !hit.room.revealed;
    if (hit.secretDoor && !(players && !hit.secretDoor.revealed)) items.push({ label: hit.secretDoor.revealed ? 'Hide secret door again' : 'Reveal secret door to players', icon: ICON.eye, act: () => app.revealSecretDoor(hit.secretDoor!.id) });
    if (hit.room) {
      if (app.enterOf(hit.room)) { const r = hit.room; items.push({ label: unseen ? 'Enter this place' : `Enter ${r.name}`, icon: ICON.doorOpen, act: () => enterRoom(r) }); }
      items.push({ label: unseen ? 'Reveal this room' : `${hit.room.revealed ? 'Hide' : 'Reveal'} ${hit.room.key} ${hit.room.name}`, icon: ICON.reveal, act: () => app.toggleRoom(hit.room!.key) });
      items.push({ label: 'Move party here', icon: ICON.token, act: () => { const t = app.party; if (t) { t.level = app.levelId; t.pos = app.snap(hit.pos); app.afterPartyMoveFromUi(); } } });
      items.push({ label: unseen ? 'Frame this room' : `Frame ${hit.room.key}`, icon: ICON.party, act: () => app.jumpTo(hit.room!.key) });
    }
    if (!items.length) return;
    menu = document.createElement('div');
    menu.className = 'tapmenu page';
    const r = !hit.door && !hit.secretDoor && !unseen ? hit.room : undefined;
    const head = r ? roomHeadHtml(r, opts) : '';
    menu.innerHTML = head + items.map((it, i) => `<button data-i="${i}">${it.icon ?? ''}<span>${esc(it.label)}</span></button>`).join('');
    if (r) menu.classList.add('withroom');
    ui.appendChild(menu);
    menu.style.left = `${Math.max(8, Math.min(x, innerWidth - menu.offsetWidth - 8))}px`; menu.style.top = `${Math.max(8, Math.min(y, innerHeight - menu.offsetHeight - 8))}px`;
    menu.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('button'); if (!b) return; items[Number(b.dataset.i)].act(); closeMenu(); refresh(); });
    ui.appendChild(menu);
  };

  // The picked-up token's panel (DM): what players see, hit points, reveal, reach helper, initiative, remove.
  const tokPanel = document.createElement('div'); tokPanel.className = 'tokpanel page'; tokPanel.hidden = true; ui.appendChild(tokPanel);
  // The panel's stat pills (size, AC, HP, speed, CR) come from the creature's one source, the same one its stat-block
  // card reads (ui/creature.ts): the books' entry for the Rules edition, else the module's numbers under 'Module stats'.
  let pillsFor = '';
  const fillPills = (t: { id: string; creatureId?: string }, size?: string) => {
    const host = tokPanel.querySelector<HTMLElement>('.tp-stats'); if (!host || !t.creatureId) return;
    const key = `${t.id}|${t.creatureId}`; pillsFor = key;
    void import('./ui/creature').then(async (m) => {
      const n = m.numbersOf(await m.creatureSource(t.creatureId!), size);
      if (pillsFor !== key || !host.isConnected) return;
      host.innerHTML = `${m.statPills(n)}<span class="tp-src">${esc([n.note, n.from].filter(Boolean).join(' · '))}</span>`;
    }).catch(() => {});
  };
  const renderTokPanel = () => {
    const t = app.selected ? app.state.tokens.find((x) => x.id === app.selected) : undefined;
    // DM only: never in Players view, never at the slider's players' end.
    tokPanel.hidden = !t || app.playersSide || t.role === 'party';
    // A hidden panel keeps nothing: no name or number lingers in the page on the players' side.
    if (tokPanel.hidden || !t) { tokPanel.innerHTML = ''; pillsFor = ''; return; }
    const en = t.creatureId ? creatureById(t.creatureId) : undefined;
    // The name opens the creature's stat-block card (people are the module's own: their name stays a name).
    const name = en && en.kind !== 'npc'
      ? `<button type="button" class="rl monster" data-kind="monster" data-creature="${esc(en.id)}" data-name="${esc(t.name)}" aria-expanded="false">${esc(t.name)}</button>`
      : `<b>${esc(t.name)}</b>`;
    const seen = en && seenAs(en);
    tokPanel.innerHTML = `<header><span class="tp-name">${name}</span>${t.hidden && t.role === 'creature' ? '<span class="tag">Hidden</span>' : ''}<button class="icon close" aria-label="Close" data-tip="Close">${ICON.close}</button></header>
      <div class="tp-stats">${en ? '' : '<span class="tp-src">combatant</span>'}</div>
      ${t.role === 'creature' ? `<label>Players see <input data-f="pname" value="${esc(t.playerName ?? t.name)}"></label>${seen ? `<div class="seen">${esc(seen)} <button type="button" class="tt" data-tip="What players are told" data-tip-sub="Their card shows this until you rename it" aria-label="What players are told" aria-expanded="false">i</button></div>` : ''}` : ''}
      ${t.hp ? `<div class="hp"><button data-a="hp-" aria-label="Damage" data-tip="Damage">−</button><span class="hp-v"><b>${t.hp.cur}</b> / ${t.hp.max} hp<i style="--f:${t.hp.max ? Math.max(0, Math.min(1, t.hp.cur / t.hp.max)) : 0}"></i></span><button data-a="hp+" aria-label="Heal" data-tip="Heal">+</button></div>` : ''}
      <div class="acts">${t.role === 'creature' ? `<button class="${t.hidden ? 'primary' : ''}" data-a="reveal" data-tip="${t.hidden ? 'Reveal to players' : 'Hide from players'}">${t.hidden ? ICON.eye + '<span>Reveal to players</span>' : ICON.eyeOff + '<span>Hide from players</span>'}</button>` : ''}
        ${!app.encounter ? `<button data-a="range" aria-pressed="${app.rangeHelper}" data-tip="Reach" data-tip-sub="Where it can move and strike">${ICON.grid}<span>Reach</span></button>` : ''}
        ${t.role === 'creature' && !app.encounter ? `<button data-a="init" data-tip="Initiative">${ICON.swords}<span>Initiative</span></button>` : ''}
        ${t.role === 'creature' ? `<button class="danger" data-a="remove" data-tip="Remove from the map">${ICON.close}<span>Remove</span></button>` : ''}</div>`;
    if (en) fillPills(t, en.size);
  };
  // A change of the Rules edition re-reads the pills from the new edition's source.
  addEventListener('mistlab:rules-edition', () => { if (!tokPanel.hidden) renderTokPanel(); });
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
    if (isKey(e, 'rotateLeft')) app.world.rotate(1); if (isKey(e, 'rotateRight')) app.world.rotate(-1);
    if (isKey(e, 'nextTurn') && app.encounter && !app.restricted) { app.nextTurn(1); refresh(); }
    if (isKey(e, 'findParty')) app.findParty(); if (isKey(e, 'search')) { e.preventDefault(); openFinder(); }
    if (isKey(e, 'escape')) { document.querySelectorAll('.sheet-backdrop').forEach((s) => s.remove()); app.stopPlacing(); app.select(null); app.tool = 'none'; app.setStatus(''); refresh(); }
  });

  function showHelp(): void {
    const h = document.createElement('div');
    h.className = 'sheet-backdrop';
    // The colour key: one sample link per family, each opening its card (the underline says the family without colour).
    const rl = (kind: string, cls: string, term: string, word: string) => `<button type="button" class="rl ${cls}" data-kind="${kind}" data-term="${term}" aria-expanded="false">${word}</button>`;
    // One row per family, the words first and the sample link last: the card a sample opens sits beside it, clear of the key.
    const colours = `<ul class="key">${([
      ['Conditions', 'dashed', rl('condition', 'condition', 'condition:prone', 'prone')],
      ['Spells and magic items', 'double', rl('spell', 'spell', 'spell:bless', 'bless')],
      ['Monsters', 'wavy', rl('monster', 'monster', 'monster:wolf', 'wolf')],
      ['Rules, actions, senses, damage', 'dotted', rl('rule', 'rule', 'rule:difficult-terrain', 'difficult terrain')],
      ['Module pages, places, people', 'solid ink', pageref(app.cur?.scene.mapPage ?? 1, app.cur?.scene.name)],
    ] as const).map(([what, line, link]) => `<li><span>${what} <i>${line}</i></span>${link}</li>`).join('')}</ul><span class="hint">Hover or tap one for its card.</span>`;
    h.innerHTML = `<div class="sheet help page"><header><h2>Running a session</h2><button class="icon close" aria-label="Close" data-tip="Close">${ICON.close}</button></header><div class="sheet-body">
      <dl>
        <dt>Move the party</dt><dd>Tap the amber token to pick it up, then tap where it goes (tap it again or press Esc to cancel). The room it enters is revealed and remembered; step onto stairs or a trapdoor to change level; the camera follows. In Players mode the party walks: walls and closed doors stop it, and locked doors stay shut until the DM opens them.</dd>
        <dt>Look around</dt><dd>One finger / left-drag pans. Right-drag or a two-finger twist rotates; pinch or scroll zooms. The buttons bottom-left turn in 90° steps, tilt, zoom and find the party. Double-tap a room to frame it.</dd>
        <dt>World map</dt><dd>The map button beside the library opens the Lands of Barovia. Drag the party to a lettered pin or into the wilderness; the card shows the distance and travel time at your pace, and opens the battle map for that place when one is built. Opening a location moves the party marker there.</dd>
        <dt>The whole valley</dt><dd>Each place's map stands where it lies in the valley, on the land, turned to true north. Zoom out past a map's edge and the land, the roads, the lakes and every other place carry on; at the far limit the chip offers the whole valley, and from there the world map. Tap a place's name over the valley to fly there and open its map; where a name has no room, its key marks the place and a tap on it does the same. Players see only the names of places they know. View › Continuous world switches this off: each map then opens alone in the mist, as before.</dd>
        <dt>Initiative</dt><dd>The crossed-swords button opens the roster: speed, reach, range and initiative from each character sheet. Start an encounter and each combatant gets a token. On a turn, green squares are where that combatant can still move and red squares are what it could strike from there; a paler red shows ranged reach with a clear line. Next turn (or N) advances; End folds everyone back into the party marker.</dd>
        <dt>Creatures</dt><dd>The paw button opens the repository: every person, monster and beast the module names, searchable. Place one beside the party, or place by tap and keep tapping to put down as many as you like (Esc stops). Placed creatures start hidden from the players. Tap one to pick it up: the panel shows what players will see (rename it), hit points, Reveal or Hide, the Reach helper (green squares it can move to, red ones it can strike), Initiative, Remove. The DM moves anything anywhere; players move only the party, and only where it can walk.</dd>
        <dt>Section slicer</dt><dd>Buildings with several floors show all of them at once. The Section slider beside the floor tabs cuts the building at any height: slide it up to see the roof, down through the floors, below ground into a cellar. The floor tabs follow the cut; the arrow button snaps the cut back to the current floor.</dd>
        <dt>Find an area</dt><dd>Type a key or name in the search box (or press /). The Rooms list shows every key with its revealed state.</dd>
        <dt>Doors, stairs and choices</dt><dd>Door markers open and close doors; stair and trapdoor markers move the party between levels. Tap anything for a menu of what you can do with it (reveal, hide, move the party, frame). The slider previews what players see.</dd>
        <dt>Players mode</dt><dd>Turn the iPad to the table: only revealed rooms, no DM chrome. DM mode brings everything back.</dd>
        <dt>Colours</dt><dd class="colours">${colours}</dd>
        <dt data-attrib>Rules books</dt>
      </dl><p class="version">mistLAB ${__APP_VERSION__}</p></div></div>`;
    h.addEventListener('click', (e) => { const t = e.target as HTMLElement; if (t === h || t.closest('.close')) h.remove(); });
    // The books' exact attribution statements (CC-BY-4.0), loaded with Help rather than with the app.
    void import('./books/attribution').then((m) => m.helpInto(h), () => h.querySelector('[data-attrib]')?.insertAdjacentHTML('afterend', '<dd>SRD 5.1 and 5.2.1, CC-BY-4.0: attribution on each book’s first page.</dd>'));
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
    const w = app.world, a = w.anchor, st = app.stage?.stats(), d = w.camera.position.distanceTo(w.controls.target);
    hud.textContent = `tris ${i.render.triangles}\ncalls ${i.render.calls}\ngeoms ${i.memory.geometries} tex ${i.memory.textures}\nfps ${app.world.fps.toFixed(0)}`
      + `\nworld ${app.nested ? (app.staged ? 'in the valley' : 'legacy map') : 'off'} · ${document.body.dataset.band ?? ''} · ${d < 10000 ? `${Math.round(d)} ft` : `${(d / 5280).toFixed(1)} mi`}`
      + `\nanchor ${Math.round(a.x)}, ${Math.round(a.y)}, ${Math.round(a.z)}`
      + (st ? `\nstage ${Math.round(st.tris / 1000)}k tris · ${st.shown}/${st.proxies} proxies · forest ${st.forest} (${st.tiles} tiles) · built ${st.buildMs} ms` : '');
  }, 500);
}
