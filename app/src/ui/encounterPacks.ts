// Encounter packs: the DM loads a pack of prepared fights (a JSON file from the DM's own notes), sees each one's
// source and difficulty in both rule sets, types in any rolled counts, and stages it: the scene opens and the
// creatures stand hidden in their area, ready for the Initiative sheet. The pack stays on this device (localStorage),
// never in the campaign state, so nothing of it reaches the Player Display.
import type { App } from '../app';
import type { Token } from '../state/campaign';
import type { Vec2 } from '../core/geometry';
import { builtPaths } from '../data';
import { creatureById, statsOf, BESTIARY } from '../bestiary';
import { diceRange, difficulty, formationCells, resolveCount, validatePack, xpForCr, type Pack, type PackEncounter, type Problem } from '../core/encounterPack';
import { rulesEdition } from '../books/lookup';
import encounterTables from '../../../manifests/encounters.json';
import { ICON } from './icons';
import { esc } from './text';

const PACK = 'mistlab.encounterPack', STAGED = 'mistlab.encounterPack.staged', PARTY = 'mistlab.encounterPack.party';
const get = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const put = (k: string, v: string | null): void => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* no storage */ } };

/** What the validator needs from the app: every creature id, and each built scene's levels and keys (loaded lazily). */
async function context(app: App) {
  const { loadLocation } = await import('../data');
  const scenes = new Map<string, { levels: { id: string; keys: string[] }[]; nonSpatialKeys?: string[] }>();
  await Promise.all([...builtPaths].map(async (p) => {
    try { const { scene } = p === app.cur?.path ? app.cur : await loadLocation(p); scenes.set(p, { levels: scene.levels.map((l) => ({ id: l.id, keys: l.rooms.map((r) => r.key) })), nonSpatialKeys: (scene as { nonSpatialKeys?: string[] }).nonSpatialKeys }); } catch { /* not loadable */ }
  }));
  const creatures = new Set(BESTIARY.map((e) => e.id));
  return { creatures, scenes, terrains: new Set((encounterTables as { terrain: { id: string }[] }).terrain.map((t) => t.id)) };
}

/** Party levels, e.g. "3,3,4,4" or "4x3" (four characters of level 3). */
export function parseParty(s: string): number[] {
  const m = /^\s*(\d+)\s*[x×]\s*(\d+)\s*$/i.exec(s);
  if (m) return Array.from({ length: Math.min(12, Number(m[1])) }, () => Number(m[2]));
  return s.split(/[\s,]+/).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 20).slice(0, 12);
}

const SOURCE_LABEL: Record<string, string> = { book: 'Module', reloaded: 'Reloaded option', generative: 'Generative' };

export function openEncounterPacks(app: App, onStaged: () => void): void {
  const back = document.createElement('div');
  back.className = 'sheet-backdrop';
  let pack: Pack = { schema: 1, encounters: [] }, problems: Problem[] = [], q = '', hereOnly = true;
  const rolls = new Map<string, number>(); // `${encounter}#${index}` → the DM's rolled total
  const staged = (): Record<string, string[]> => { try { return JSON.parse(get(STAGED) ?? '{}') as Record<string, string[]>; } catch { return {}; } };
  const partyText = () => get(PARTY) ?? `${Math.max(1, app.state.roster.filter((s) => s.kind === 'pc').length)}x1`;

  const load = async (text: string | null) => {
    if (!text) { pack = { schema: 1, encounters: [] }; problems = []; return render(); }
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { problems = [{ level: 'error', text: 'The file is not JSON.' }]; return render(); }
    ({ pack, problems } = validatePack(raw, await context(app)));
    render();
  };

  const counts = (e: PackEncounter) => e.creatures.map((c, i) => resolveCount(c.count, rolls.get(`${e.id}#${i}`)));
  const diffLine = (e: PackEncounter) => {
    const n = counts(e); if (n.some((x) => x === null)) return '<span class="ep-diff">Difficulty once the rolled counts are in</span>';
    const party = parseParty(partyText()); if (!party.length) return '';
    const xp: (number | undefined)[] = [];
    e.creatures.forEach((c, i) => { const ent = creatureById(c.id); const x = xpForCr(c.cr ?? (ent && statsOf(ent)?.cr)); for (let k = 0; k < n[i]!; k++) xp.push(x); });
    const d = difficulty(xp, party);
    const l14 = `<b>2014</b> ${d.e2014.label} <i>(${d.e2014.adjusted.toLocaleString()} adjusted XP; ${d.e2014.thresholds.map((t) => t.toLocaleString()).join(' / ')})</i>`;
    const l24 = `<b>2024</b> ${d.e2024.label} <i>(${d.xp.toLocaleString()} XP; budgets ${d.e2024.budgets.map((t) => t.toLocaleString()).join(' / ')})</i>`;
    const both = rulesEdition() === '2014' ? `${l14} · ${l24}` : `${l24} · ${l14}`;
    return `<span class="ep-diff">${both}${d.unknown ? ` · <em>${d.unknown} without a CR, left out</em>` : ''}</span>`;
  };

  const card = (e: PackEncounter) => {
    const st = staged()[e.id]?.filter((id) => app.state.tokens.some((t) => t.id === id)) ?? [];
    const where = [e.scene, e.area && `area ${e.area}`, e.level && `level ${e.level}`, e.terrain && `terrain ${e.terrain}`].filter(Boolean).join(' · ');
    const src = `<span class="ep-src ${esc(e.source)}">${SOURCE_LABEL[e.source]}${e.source === 'book' && e.page ? ` p. ${esc(e.page)}` : ''}</span>`;
    const cr = e.creatures.map((c, i) => {
      const ent = creatureById(c.id)!, dice = diceRange(c.count), r = rolls.get(`${e.id}#${i}`);
      const count = dice ? `<label class="ep-roll">${esc(dice.expr)} <input type="number" inputmode="numeric" min="${dice.min}" max="${dice.max}" value="${r ?? ''}" placeholder="roll" data-roll="${esc(e.id)}#${i}" aria-label="Your ${esc(dice.expr)} total for ${esc(ent.name)}"></label>` : `${resolveCount(c.count)}×`;
      return `<li>${count} ${esc(ent.name)}${c.hidden === false ? ' <i>(visible)</i>' : ''}${c.alias ? ` <i>players see “${esc(c.alias)}”</i>` : ''}${c.note ? ` <span class="ep-note">${esc(c.note)}</span>` : ''}</li>`;
    }).join('');
    const ready = counts(e).every((x) => x !== null);
    return `<article class="ep-card${st.length ? ' staged' : ''}" data-enc="${esc(e.id)}">
      <header><h3>${esc(e.title)}</h3>${src}</header>
      <p class="ep-where">${esc(where)}${e.placement === 'party' ? ' · beside the party' : ''}</p>
      ${e.trigger ? `<p class="ep-trigger"><b>When</b> ${esc(e.trigger)}</p>` : ''}
      <ul class="ep-foes">${cr}</ul>
      ${diffLine(e)}${e.difficulty ? `<span class="ep-diff"><b>Prep note</b> ${esc(e.difficulty)}</span>` : ''}
      ${e.notes ? `<details><summary>Notes</summary><p>${esc(e.notes)}</p></details>` : ''}
      <div class="row">${st.length ? `<span class="ep-staged">${st.length} staged</span><button data-a="unstage">Remove staged</button>` : ''}<span class="spacer"></span>
        <button class="primary" data-a="stage"${ready ? '' : ' disabled title="Type in the rolled counts first"'}>${ICON.swords} Stage</button></div>
    </article>`;
  };

  function render() {
    const cur = app.cur?.path, t = q.trim().toLowerCase();
    const anyHere = pack.encounters.some((e) => e.scene === cur);
    const list = pack.encounters.filter((e) => (!hereOnly || !anyHere || e.scene === cur) && (!t || `${e.title} ${e.id} ${e.area ?? ''} ${e.trigger ?? ''} ${e.scene}`.toLowerCase().includes(t)));
    const errs = problems.filter((p) => p.level === 'error'), warns = problems.filter((p) => p.level === 'warning');
    back.querySelector('.ep-body')!.innerHTML = `
      ${problems.length ? `<details class="ep-problems"${errs.length ? ' open' : ''}><summary>${errs.length} skipped · ${warns.length} warnings</summary><ul>${problems.map((p) => `<li class="${p.level}">${p.encounter ? `<b>${esc(p.encounter)}</b> ` : ''}${esc(p.text)}</li>`).join('')}</ul></details>` : ''}
      ${pack.encounters.length ? (list.map(card).join('') || '<p class="hint">Nothing matches.</p>') : '<p class="hint">No pack loaded. Open the encounters file from your prep notes (encounters.json). It stays on this device and is never shown to the players.</p>'}`;
    const h = back.querySelector<HTMLInputElement>('[data-f="here"]'); if (h) { h.checked = hereOnly; h.disabled = !anyHere; }
  }

  back.innerHTML = `<div class="sheet encounter-packs page"><header><h2>Encounter packs</h2><input class="csearch" type="search" placeholder="Search encounters…" aria-label="Search encounters"><button class="icon close" aria-label="Close" data-tip="Close">${ICON.close}</button></header>
    <div class="sheet-body">
      <div class="row ep-tools"><label class="button"><input type="file" accept=".json,application/json" hidden data-f="file">Open pack…</label><button data-a="clear">Forget pack</button>
        <label><input type="checkbox" data-f="here"> This map only</label>
        <label>Party levels <input data-f="party" size="9" value="${esc(partyText())}" aria-label="Party levels, e.g. 3,3,4,4 or 4x3"></label></div>
      <p class="hint">Sources: Module first, Reloaded options labelled, anything invented labelled Generative. Dice counts are yours to roll: type in the total. Staged creatures start hidden; tick them in Initiative to start the fight.</p>
      <div class="ep-body"></div></div></div>`;

  back.addEventListener('input', (ev) => {
    const el = ev.target as HTMLInputElement;
    if (el.dataset.roll) { const v = el.value === '' ? NaN : Number(el.value); if (Number.isInteger(v)) rolls.set(el.dataset.roll, v); else rolls.delete(el.dataset.roll); const id = el.dataset.roll.split('#')[0]; const e = pack.encounters.find((x) => x.id === id); const art = el.closest('article'); if (e && art) { const ready = counts(e).every((x) => x !== null); art.querySelector<HTMLButtonElement>('[data-a="stage"]')!.disabled = !ready; const d = art.querySelector('.ep-diff'); if (d) d.outerHTML = diffLine(e); } return; }
    if (el.dataset.f === 'party') { put(PARTY, el.value); return; }
    if (el.dataset.f === 'here') { hereOnly = el.checked; render(); return; }
    if (el.classList.contains('csearch')) { q = el.value; render(); }
  });
  back.addEventListener('change', (ev) => {
    const el = ev.target as HTMLInputElement;
    if (el.dataset.f === 'party') render();
    if (el.dataset.f === 'file' && el.files?.[0]) void el.files[0].text().then((text) => { put(PACK, text); return load(text); });
  });
  back.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    if (t === back || t.closest('.close')) return back.remove();
    const a = t.closest<HTMLElement>('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'clear') { put(PACK, null); void load(null); return; }
    const e = pack.encounters.find((x) => x.id === t.closest<HTMLElement>('[data-enc]')?.dataset.enc); if (!e) return;
    if (a === 'unstage') { const s = staged(); for (const id of s[e.id] ?? []) app.removeToken(id); delete s[e.id]; put(STAGED, JSON.stringify(s)); render(); return; }
    if (a === 'stage') {
      const n = counts(e); if (n.some((x) => x === null)) return;
      void stageEncounter(app, e, n as number[]).then((ids) => {
        if (!ids) return;
        const s = staged(); s[e.id] = [...(s[e.id] ?? []), ...ids]; put(STAGED, JSON.stringify(s));
        back.remove(); onStaged();
      });
    }
  });
  document.body.appendChild(back);
  void load(get(PACK));
}

/** Open the encounter's map and level, then put its creatures there, hidden unless the pack says otherwise. */
export async function stageEncounter(app: App, e: PackEncounter, counts: number[]): Promise<string[] | null> {
  if (builtPaths.has(e.scene) && app.cur?.path !== e.scene && !(await app.open(e.scene, e.level))) return null;
  if (!app.cur) return null;
  const scene = app.cur.scene, onMap = app.cur.path === e.scene;
  const room = onMap && e.placement !== 'party' && e.area ? scene.levels.filter((l) => !e.level || l.id === e.level).flatMap((l) => l.rooms.filter((r) => r.key === e.area).map((r) => ({ level: l.id, room: r })))[0] : undefined;
  const level = room?.level ?? (onMap && e.level && scene.levels.some((l) => l.id === e.level) ? e.level : app.levelId);
  if (level !== app.levelId) app.setLevel(level, true);
  const party = app.party, lv = scene.levels.find((l) => l.id === level)!;
  const from: Vec2 = party && party.level === level ? party.pos : [lv.rooms[0].polygon[0][0] + 2.5, lv.rooms[0].polygon[0][1] + 2.5];
  const floor = app.cur.grid.levels[level].floorPolygons.concat(lv.rooms.map((r) => r.polygon));
  const taken = app.state.tokens.filter((t) => t.location === scene.location && t.level === level).map((t) => t.pos);
  const total = counts.reduce((a, b) => a + b, 0);
  const cells = formationCells(total, { area: room?.room.polygon, floor, from, taken, snap: (p) => app.snap(p) });
  const ids: string[] = [];
  let k = 0;
  e.creatures.forEach((c, i) => {
    for (let j = 0; j < counts[i]; j++) {
      const tok: Token | undefined = app.addCreature(c.id, cells[k++], level); if (!tok) continue;
      ids.push(tok.id);
      if (c.alias) app.setPlayerName(tok.id, c.alias);
      if (c.hidden === false) app.setTokenHidden(tok.id, false);
    }
  });
  app.layoutChanged();
  app.setStatus(`${e.title}: ${ids.length} staged${room ? ` in ${e.area}` : ' beside the party'} · tick them in Initiative to start`);
  return ids;
}
