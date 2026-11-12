// Party packs: the DM opens the table's party file (core/partyPack.ts) and writes it into this campaign: the roster gets
// the characters (with their portraits and miniatures), each stands in their own token where the last session left
// them, and the party moves on the world map. The file stays on this device (localStorage) until applied; what is
// applied lives in the campaign like any roster or token.
import type { App } from '../app';
import type { Vec2 } from '../core/geometry';
import { pointInPolygon } from '../core/geometry';
import { builtPaths } from '../data';
import { applyPartyPack, validatePartyPack, type PartyContext, type PartyPack, type Problem } from '../core/partyPack';
import { ATLAS } from '../render/worldstage';
import { ICON } from './icons';
import { esc } from './text';

const PACK = 'mistlab.partyPack';
const get = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const put = (k: string, v: string | null): void => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* no storage */ } };

/** What the validator needs: the placement's map (loaded on demand) and the campaign's world pins. */
async function context(app: App, raw: unknown): Promise<PartyContext> {
  const scenes: PartyContext['scenes'] = new Map();
  const path = (raw as { placement?: { scene?: string } } | null)?.placement?.scene;
  if (path && builtPaths.has(path)) {
    try {
      const { loadLocation } = await import('../data');
      const { scene, grid } = app.cur?.path === path ? app.cur : await loadLocation(path);
      scenes.set(path, { location: scene.location, levels: scene.levels.map((l) => {
        const floor = (grid.levels[l.id]?.floorPolygons ?? []).concat(l.rooms.map((r) => r.polygon)) as Vec2[][];
        return { id: l.id, onFloor: (p: Vec2) => floor.some((poly) => pointInPolygon(p, poly)) };
      }) });
    } catch { /* not loadable */ }
  }
  const pins = new Map<string, Vec2>(ATLAS.pins.filter((p) => p.campaign === app.campaign.id).map((p) => [p.key, [p.pos[0], p.pos[1]] as Vec2]));
  return { scenes, pins };
}

export function openPartyPacks(app: App, onDone: () => void): void {
  const back = document.createElement('div');
  back.className = 'sheet-backdrop';
  let pack: PartyPack = { schema: 1, kind: 'party', characters: [] }, problems: Problem[] = [];
  const opt = { roster: true, place: true, world: true };

  const load = async (text: string | null) => {
    if (!text) { pack = { schema: 1, kind: 'party', characters: [] }; problems = []; return render(); }
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { problems = [{ level: 'error', text: 'The file is not JSON.' }]; return render(); }
    ({ pack, problems } = validatePartyPack(raw, await context(app, raw)));
    render();
  };

  const stat = (k: string, v: number | undefined, unit = ' ft') => v === undefined ? '' : `<span><b>${k}</b> ${v}${unit}</span>`;
  const card = (c: PartyPack['characters'][number]) => {
    const inRoster = app.state.roster.some((s) => s.id === c.id), standing = app.state.tokens.find((t) => t.role === 'pc' && t.sheetId === c.id);
    return `<article class="pp-card" style="--tok:${esc(c.color)}">
      ${c.portrait ? `<img class="pp-face" src="${esc(c.portrait)}" alt="">` : '<span class="pp-face none"></span>'}
      <div><h3>${esc(c.name)}${c.short ? ` <small>${esc(c.short)}</small>` : ''}</h3>
        <p class="pp-sub">${c.player ? `${esc(c.player)} · ` : ''}${c.level ? `level ${c.level} · ` : ''}${esc(c.size ?? 'medium')}${c.figure ? ' · own miniature' : ''}</p>
        <p class="pp-stats">${stat('Speed', c.speedFt ?? 30)}${stat('Darkvision', c.darkvisionFt ?? 0)}${stat('Reach', c.reachFt ?? 5)}${c.rangeFt ? stat('Range', c.rangeFt) : ''}${stat('Init', c.initMod ?? 0, '')}${c.light ? `<span><b>Light</b> ${c.light.bright}/${c.light.dim} ft</span>` : ''}</p>
        ${c.notes ? `<p class="pp-note">${esc(c.notes)}</p>` : ''}
        <p class="pp-state">${inRoster ? 'In the roster' : 'Not in the roster yet'}${standing ? ` · standing on ${esc(standing.location)}` : ''}</p></div>
    </article>`;
  };

  function render() {
    const errs = problems.filter((p) => p.level === 'error'), warns = problems.filter((p) => p.level === 'warning'), p = pack.placement;
    back.querySelector('.pp-body')!.innerHTML = `
      ${problems.length ? `<details class="pp-problems"${errs.length ? ' open' : ''}><summary>${errs.length} errors · ${warns.length} warnings</summary><ul>${problems.map((x) => `<li class="${x.level}">${esc(x.text)}</li>`).join('')}</ul></details>` : ''}
      ${pack.characters.length ? pack.characters.map(card).join('') : '<p class="hint">No party loaded. Open the party file from your notes (party.json): the characters, their portraits and miniatures, and where they stand.</p>'}
      ${p ? `<div class="pp-place"><b>Where they stand:</b> ${esc(p.scene)}${p.level ? ` · ${esc(p.level)}` : ''}${p.world ? ` · world map at ${esc(p.world.pin)}` : ''}${p.note ? `<p class="hint">${esc(p.note)}</p>` : ''}</div>` : ''}
      ${pack.characters.length ? `<div class="row"><label><input type="checkbox" data-o="roster"${opt.roster ? ' checked' : ''}> Roster</label>${p ? `<label><input type="checkbox" data-o="place"${opt.place ? ' checked' : ''}> Place on the map</label>${p.world ? `<label><input type="checkbox" data-o="world"${opt.world ? ' checked' : ''}> World map</label>` : ''}` : ''}<span class="spacer"></span><button class="primary" data-a="apply">${ICON.party} Apply to this campaign</button></div>` : ''}`;
  }

  back.innerHTML = `<div class="sheet encounter party-packs page"><header><h2>Party</h2><button class="icon close" aria-label="Close" data-tip="Close">${ICON.close}</button></header>
    <div class="sheet-body">
      <div class="row pp-tools"><label class="button"><input type="file" accept=".json,application/json" hidden data-f="file">Open party file…</label><button data-a="clear">Forget file</button><span class="spacer"></span>
        <span class="seg" role="group" aria-label="How characters stand"><button data-a="style" data-v="mini" aria-pressed="${app.pieceStyle === 'mini'}">Miniatures</button><button data-a="style" data-v="token" aria-pressed="${app.pieceStyle === 'token'}">Round tokens</button></span></div>
      <p class="hint">Applying adds each character to the roster (the starting Fighter, Rogue, Cleric and Wizard go if you never renamed them), puts their own token where the file says, and moves the party's mark on the world map. Characters keep their tokens through fights.</p>
      <div class="pp-body"></div></div></div>`;

  back.addEventListener('change', (ev) => {
    const el = ev.target as HTMLInputElement;
    if (el.dataset.o) { opt[el.dataset.o as keyof typeof opt] = el.checked; return; }
    if (el.dataset.f === 'file' && el.files?.[0]) void el.files[0].text().then((text) => { put(PACK, text); return load(text); });
  });
  back.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    if (t === back || t.closest('.close')) return back.remove();
    const btn = t.closest<HTMLElement>('[data-a]'), a = btn?.dataset.a; if (!a) return;
    if (a === 'clear') { put(PACK, null); void load(null); return; }
    if (a === 'style') { app.setPieceStyle(btn!.dataset.v === 'token' ? 'token' : 'mini'); back.querySelectorAll<HTMLElement>('[data-a="style"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === app.pieceStyle))); return; }
    if (a === 'apply') void applyPack(app, pack, opt).then((ok) => { if (ok) { back.remove(); onDone(); } else render(); });
  });
  document.body.appendChild(back);
  void load(get(PACK));
}

/** Write the pack into the campaign, then open the map where the party stands. */
export async function applyPack(app: App, pack: PartyPack, opt: { roster: boolean; place: boolean; world: boolean }): Promise<boolean> {
  const p = pack.placement;
  const res = applyPartyPack(app.state, pack, { roster: opt.roster, place: opt.place && !!p });
  if (res.refused) { app.flashStatus(res.refused); return false; }
  if (opt.world && p?.world) {
    const pins = new Map(ATLAS.pins.filter((x) => x.campaign === app.campaign.id).map((x) => [x.key, x.pos as unknown as Vec2]));
    let prev: Vec2 | undefined = app.state.world?.pos;
    for (const key of [...(p.world.via ?? []), p.world.pin]) {
      const pos = pins.get(key); if (!pos) continue;
      if (app.state.world?.key !== key) app.moveWorld([pos[0], pos[1]], key, prev ? Math.hypot(prev[0] - pos[0], prev[1] - pos[1]) : 0, false);
      prev = pos;
    }
    for (const key of p.reveal ?? []) app.revealPin(key, true, false);
  }
  app.commit();
  if (opt.place && p && builtPaths.has(p.scene)) {
    if (app.cur?.path !== p.scene) { try { localStorage.setItem('mistlab.scene', p.scene); } catch { /* no storage */ } await app.open(p.scene, p.level); }
    else app.refreshTokens();
    app.layoutChanged();
    app.findParty(true);
  } else app.refreshTokens();
  app.setStatus(`Party: ${res.added} added, ${res.updated} updated${res.removedDefaults ? `, ${res.removedDefaults} starting sheets removed` : ''}${res.placed ? ` · ${res.placed} standing on ${p!.scene}` : ''}`);
  return true;
}
