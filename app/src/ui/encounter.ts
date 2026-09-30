// Initiative: the roster (character-sheet essentials) and the turn bar. Ranges show only during a turn.
import type { App } from '../app';
import type { Sheet } from '../state/campaign';
import { ICON } from './icons';

const d20 = () => Math.floor(Math.random() * 20) + 1;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Roster editor + initiative roll. The DM edits sheets in place; Start puts one token per combatant on the map. */
export function openEncounterSheet(app: App, onStart: () => void): void {
  const back = document.createElement('div');
  back.className = 'sheet-backdrop';
  const inits = new Map<string, number>();
  const render = () => {
    const rows = app.state.roster.map((s) => `<tr data-id="${s.id}">
        <td><input type="color" value="${s.color}" data-f="color" aria-label="Colour"></td>
        <td><input value="${esc(s.name)}" data-f="name" aria-label="Name"></td>
        <td><select data-f="kind"><option value="pc"${s.kind === 'pc' ? ' selected' : ''}>PC</option><option value="npc"${s.kind === 'npc' ? ' selected' : ''}>NPC</option></select></td>
        <td><input type="number" value="${s.speedFt}" step="5" min="0" data-f="speedFt" aria-label="Speed (ft)"></td>
        <td><input type="number" value="${s.reachFt}" step="5" min="0" data-f="reachFt" aria-label="Reach (ft)"></td>
        <td><input type="number" value="${s.rangeFt}" step="5" min="0" data-f="rangeFt" aria-label="Range (ft)"></td>
        <td><input type="number" value="${s.darkvisionFt}" step="30" min="0" data-f="darkvisionFt" aria-label="Darkvision (ft)"></td>
        <td><input type="number" value="${s.initMod}" data-f="initMod" aria-label="Initiative modifier"></td>
        <td><label class="init"><input type="checkbox" data-f="in" ${inits.has(s.id) ? 'checked' : ''} aria-label="In this encounter"><input type="number" value="${inits.get(s.id) ?? ''}" data-f="init" placeholder="—" aria-label="Initiative"></label></td>
        <td><button class="icon" data-a="del" aria-label="Remove">${ICON.close}</button></td></tr>`).join('');
    back.innerHTML = `<div class="sheet encounter"><header><h2>Initiative</h2><button class="icon close" aria-label="Close">${ICON.close}</button></header>
      <div class="sheet-body">
        <p class="hint">Speed, reach and range come from each character sheet. Tick who is in, roll or type initiative, then start. Green squares show where a combatant can still move on its turn; red squares are what it could strike from there.</p>
        <table class="roster"><thead><tr><th></th><th>Name</th><th>Kind</th><th>Speed</th><th>Reach</th><th>Range</th><th>Darkvision</th><th>Init mod</th><th>Initiative</th><th></th></tr></thead><tbody>${rows}</tbody></table>
        <div class="row"><button data-a="add">${ICON.party} Add character</button><button data-a="npc">Add foe</button><span class="spacer"></span><button data-a="roll">Roll initiative</button><button class="primary" data-a="start">Start encounter</button></div>
      </div></div>`;
  };
  render();
  const sheetOf = (el: HTMLElement) => app.state.roster.find((s) => s.id === el.closest<HTMLElement>('tr')!.dataset.id)!;
  back.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement, f = el.dataset.f; if (!f) return;
    const s = sheetOf(el);
    if (f === 'init') { const v = Number(el.value); if (el.value === '') inits.delete(s.id); else { inits.set(s.id, v); (el.parentElement!.querySelector('[data-f="in"]') as HTMLInputElement).checked = true; } return; }
    if (f === 'in') { if (el.checked) inits.set(s.id, inits.get(s.id) ?? d20() + s.initMod); else inits.delete(s.id); render(); return; }
    if (f === 'name' || f === 'color') (s as unknown as Record<string, string>)[f] = el.value;
    else if (f === 'kind') s.kind = el.value as Sheet['kind'];
    else (s as unknown as Record<string, number>)[f] = Number(el.value) || 0;
    app.commit();
  });
  back.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === back || t.closest('.close')) return back.remove();
    const a = t.closest<HTMLElement>('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'del') { const s = sheetOf(t); app.state.roster = app.state.roster.filter((x) => x !== s); inits.delete(s.id); app.commit(); render(); }
    if (a === 'add' || a === 'npc') {
      const n = app.state.roster.length + 1, npc = a === 'npc';
      app.state.roster.push({ id: `${npc ? 'npc' : 'pc'}-${Date.now().toString(36)}`, name: npc ? `Foe ${n}` : `Character ${n}`, color: npc ? '#8a2b2b' : '#5b8ac9', speedFt: 30, reachFt: 5, rangeFt: 0, initMod: 0, size: 'medium', darkvisionFt: npc ? 60 : 0, kind: npc ? 'npc' : 'pc' });
      app.commit(); render();
    }
    if (a === 'roll') { for (const s of app.state.roster) if (inits.has(s.id) || inits.size === 0) inits.set(s.id, d20() + s.initMod); render(); }
    if (a === 'start') {
      const entries = [...inits].map(([sheetId, init]) => ({ sheetId, init }));
      if (!entries.length) return;
      app.startEncounter(entries); back.remove(); onStart();
    }
  });
  document.body.appendChild(back);
}

/** The turn bar: order, the current combatant, movement left, next / previous / end. */
export function turnBar(app: App, refresh: () => void): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'turnbar'; bar.hidden = true;
  bar.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'next') app.nextTurn(1); if (a === 'prev') app.nextTurn(-1);
    if (a === 'end') { if (confirm('End the encounter? Combatants fold back into the party marker.')) app.endEncounter(); }
    if (a === 'go') { const t = app.current?.token; if (t) app.findParty(true); }
    refresh();
  });
  (bar as unknown as { update: () => void }).update = () => {
    const e = app.encounter, cur = app.current;
    bar.hidden = !e;
    if (!e || !cur) return;
    const dm = !app.restricted, left = Math.max(0, cur.sheet.speedFt - e.movedFt);
    bar.innerHTML = `<div class="order">${e.order.map((c, i) => { const s = app.state.roster.find((x) => x.id === c.sheetId); return `<span class="cb${i === e.turn % e.order.length ? ' now' : ''}" style="--tok:${s?.color ?? '#999'}" title="${esc(s?.name ?? '')} · initiative ${c.init}">${esc(s?.name ?? '?')}<i>${c.init}</i></span>`; }).join('')}</div>
      <div class="now"><b>Round ${e.round}</b> · ${esc(cur.sheet.name)} · <span class="move">${left} ft</span> of ${cur.sheet.speedFt} ft left${cur.sheet.rangeFt ? ` · range ${cur.sheet.rangeFt} ft` : ''}</div>
      <div class="acts">${dm ? `<button data-a="prev" aria-label="Previous turn">${ICON.rotateL}</button>` : ''}<button data-a="go" aria-label="Find the combatant">${ICON.party}</button>${dm ? `<button class="primary" data-a="next">Next turn</button><button data-a="end">End</button>` : ''}</div>`;
  };
  return bar;
}
