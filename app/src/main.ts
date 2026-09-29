import './styles.css';
import { App, type GridMode } from './app';
import { builtPaths } from './data';
import { ICON } from './ui/icons';
import { openLibrary } from './ui/library';
import { ViewSlider } from './ui/viewSlider';

const q = new URLSearchParams(location.search);
const mode = q.get('display') === 'player' ? 'player' : 'dm';
const path = q.get('scene') ?? localStorage.getItem('mistlab.scene') ?? 'dev/m0-test-room';
document.body.dataset.mode = mode;
document.title = mode === 'player' ? 'mistLAB · Player Display' : 'mistLAB';

const stage = document.getElementById('stage')!;
const app = new App(stage, mode);

if (mode === 'dm') buildDmUi();
if (q.get('hud') === '1') buildHud();

const ready = app.init(builtPaths.has(path) ? path : 'dev/m0-test-room');

// Test/debug hook. Harmless in production: it only exposes what the DM UI can already do.
(window as unknown as { __mistlab: unknown }).__mistlab = {
  app,
  ready: ready.then(() => true),
  setT: (t: number) => { slider?.set(t); app.setT(t); app.world.renderNow(); },
  setGrid: (g: GridMode) => { app.gridMode = g; app.layoutChanged(); app.world.renderNow(); },
  setLowWalls: (on: boolean) => { app.lowWalls = on; app.layoutChanged(); app.world.renderNow(); },
  setRenderMode: (m: 'normal' | 'floorMask') => { app.setRenderMode(m); app.world.renderNow(); },
  setSecretAsWall: (on: boolean) => { app.secretAsWall = on; app.applySlider(); app.world.renderNow(); },
  frame: (p: 'tabletop' | 'top') => { app.frameLevel(p); app.world.renderNow(); },
  render: () => app.world.renderNow(),
  labels: () => app.cur!.labels.filter((l) => l.level === app.levelId).map((l) => ({ id: l.spec.id, vis: l.spec.vis, opacity: Number(l.obj.element.style.opacity), visible: l.obj.visible })),
  targets: () => app.built.targets.map((t) => ({ id: t.id, vis: t.vis, visible: t.root.visible, opacity: t.materials[0]?.opacity ?? 1 })),
  flush: () => app.flush(),
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
      <div class="title"><span class="loc"></span><span class="sub"></span></div>
      <div class="seg levels" role="tablist"></div>
    </div>
    <div class="group right">
      <div class="seg tools" role="toolbar" aria-label="Reveal tools">
        <button class="icon" data-tool="reveal" aria-label="Reveal / hide (tap a room, object or secret door)">${ICON.reveal}</button>
        <button class="icon" data-tool="brush-reveal" aria-label="Paint reveal">${ICON.brush}</button>
        <button class="icon" data-tool="brush-fog" aria-label="Paint fog">${ICON.fog}</button>
        <button class="icon" data-act="undo" aria-label="Undo reveal">${ICON.undo}</button>
      </div>
      <span class="divider"></span>
      <button class="icon" data-act="grid" aria-label="Grid: square / hex / off"></button>
      <button class="icon" data-act="walls" aria-label="Walls: low / full">${ICON.walls}</button>
      <button class="icon" data-act="camera" aria-label="Camera: tabletop / top-down"></button>
      <span class="divider"></span>
      <button class="icon" data-act="lock" aria-label="Player camera follows DM"></button>
      <button class="icon" data-act="display" aria-label="Open Player Display">${ICON.display}</button>
    </div>`;
  ui.appendChild(top);
  const status = document.createElement('div');
  status.className = 'status';
  ui.appendChild(status);
  app.onStatus = (s) => { status.textContent = s; status.classList.toggle('on', !!s); };

  const refresh = () => {
    if (!app.cur) return;
    top.querySelector('.loc')!.textContent = app.cur.scene.name;
    top.querySelector('.sub')!.textContent = `${app.cur.scene.chapter} · ${app.cur.scene.mapPage ? `map p.${app.cur.scene.mapPage}` : 'dev'} · ${app.cur.scene.bookScaleFt}-ft map`;
    const lv = top.querySelector('.levels')!;
    lv.innerHTML = app.cur.scene.levels.map((l) => `<button role="tab" data-level="${l.id}" aria-selected="${l.id === app.levelId}">${l.name}</button>`).join('');
    (lv as HTMLElement).style.display = app.cur.scene.levels.length > 1 ? '' : 'none';
    top.querySelectorAll<HTMLElement>('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === app.tool)));
    top.querySelector('[data-act="grid"]')!.innerHTML = app.gridMode === 'hex' ? ICON.hex : app.gridMode === 'square' ? ICON.grid : ICON.gridOff;
    top.querySelector('[data-act="camera"]')!.innerHTML = app.camPreset === 'top' ? ICON.top : ICON.camera;
    top.querySelector('[data-act="walls"]')!.setAttribute('aria-pressed', String(!app.lowWalls));
    top.querySelector('[data-act="lock"]')!.innerHTML = app.lockPlayerCamera ? ICON.lock : ICON.unlock;
  };
  app.onChange = refresh;

  top.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!b) return;
    if (b.dataset.level) app.setLevel(b.dataset.level, true);
    if (b.dataset.tool) { app.tool = app.tool === b.dataset.tool ? 'none' : (b.dataset.tool as typeof app.tool); app.setStatus(app.tool === 'none' ? '' : b.getAttribute('aria-label')!); }
    switch (b.dataset.act) {
      case 'library': openLibrary(builtPaths, (p) => { localStorage.setItem('mistlab.scene', p); void app.open(p).then(() => app.layoutChanged()); }); break;
      case 'undo': app.undo(); break;
      case 'grid': app.gridMode = app.gridMode === 'square' ? 'hex' : app.gridMode === 'hex' ? 'off' : 'square'; app.layoutChanged(); break;
      case 'walls': app.lowWalls = !app.lowWalls; app.layoutChanged(); break;
      case 'camera': app.frameLevel(app.camPreset === 'top' ? 'tabletop' : 'top'); break;
      case 'lock': app.lockPlayerCamera = !app.lockPlayerCamera; app.layoutChanged(); break;
      case 'display': window.open(`${location.pathname}?display=player&scene=${encodeURIComponent(app.cur?.path ?? '')}`, 'mistlab-player', 'popup,width=1280,height=800'); break;
    }
    refresh();
  });
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
