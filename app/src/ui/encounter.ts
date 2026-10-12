// Initiative: the roster (character-sheet essentials) and the turn bar. Ranges show only during a turn.
import type { App } from '../app';
import type { Sheet } from '../state/campaign';
import { turnView } from '../core/identity';
import { ICON } from './icons';
import { esc } from './text';

const d20 = () => Math.floor(Math.random() * 20) + 1;
/** A column header as a rules link (the units are in its card). */
const head = (term: string, word: string, icon: string, kind = 'rule') => `<button type="button" class="rl ${kind} pill" data-kind="${kind}" data-term="${term}" aria-expanded="false"><i data-e="${icon}"></i><span>${word}</span></button>`;

/** Roster editor + initiative roll. The DM edits sheets in place; Start puts one token per combatant on the map. */
export function openEncounterSheet(app: App, onStart: () => void): void {
  const back = document.createElement('div');
  back.className = 'sheet-backdrop';
  const inits = new Map<string, number>();
  const cinits = new Map<string, number>(); // placed creatures, by token
  const render = () => {
    const creatures = app.state.tokens.filter((t) => t.role === 'creature' && t.location === app.cur?.scene.location);
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
        <td><button class="icon" data-a="del" aria-label="Remove" data-tip="Remove">${ICON.close}</button></td></tr>`).join('');
    back.innerHTML = `<div class="sheet encounter page"><header><h2>Initiative</h2><button class="icon close" aria-label="Close" data-tip="Close">${ICON.close}</button></header>
      <div class="sheet-body">
        <p class="hint">Speed, reach and range come from each character sheet. Tick who is in, roll or type initiative, then start. Green squares show where a combatant can still move on its turn; red squares are what it could strike from there.</p>
        <table class="roster"><thead><tr><th></th><th>Name</th><th>Kind</th><th>${head('rule:speed', 'Speed', 'boot-prints')}</th><th>${head('rule:reach', 'Reach', 'crossed-swords')}</th><th>${head('rule:range', 'Range', 'position-marker')}</th><th>${head('rule:darkvision', 'Darkvision', 'semi-closed-eye', 'sense')}</th><th>Init mod</th><th>${head('rule:initiative', 'Initiative', 'dice-twenty-faces-twenty')}</th><th></th></tr></thead><tbody>${rows}</tbody></table>
        ${creatures.length ? `<h3>Creatures on this map</h3><table class="roster creatures"><thead><tr><th></th><th>Name</th><th>Players see</th><th>Hit points</th><th>Initiative</th></tr></thead><tbody>${creatures.map((t) => `<tr data-tok="${esc(t.id)}"><td><span class="chip" style="--tok:${esc(t.color)}"></span></td><td>${esc(t.name)}${t.hidden ? ' <i>(hidden)</i>' : ''}</td><td>${esc(t.playerName ?? t.name)}</td><td>${t.hp ? `${t.hp.cur}/${t.hp.max}` : '—'}</td>
          <td><label class="init"><input type="checkbox" data-f="cin" ${cinits.has(t.id) ? 'checked' : ''} aria-label="In this encounter"><input type="number" value="${cinits.get(t.id) ?? ''}" data-f="cinit" placeholder="—" aria-label="Initiative"></label></td></tr>`).join('')}</tbody></table>` : ''}
        <div class="row"><button data-a="add">${ICON.party} Add character</button><button data-a="npc">Add foe</button><span class="spacer"></span><button data-a="roll">Roll initiative</button><button class="primary" data-a="start">Start encounter</button></div>
      </div></div>`;
    // The headers' emblems (their own chunk, DM only).
    void import('./emblems').then((m) => { m.ensureEmblems(); back.querySelectorAll<HTMLElement>('i[data-e]').forEach((i) => { i.outerHTML = m.emblem(i.dataset.e as Parameters<typeof m.emblem>[0]); }); }).catch(() => {});
  };
  render();
  const sheetOf = (el: HTMLElement) => app.state.roster.find((s) => s.id === el.closest<HTMLElement>('tr')!.dataset.id)!;
  back.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement, f = el.dataset.f; if (!f) return;
    if (f === 'cin' || f === 'cinit') {
      const tok = el.closest<HTMLElement>('tr')!.dataset.tok!, t = app.state.tokens.find((x) => x.id === tok)!, sh = app.creatureSheet(t);
      if (f === 'cinit') { if (el.value === '') cinits.delete(tok); else { cinits.set(tok, Number(el.value)); (el.parentElement!.querySelector('[data-f="cin"]') as HTMLInputElement).checked = true; } return; }
      if (el.checked) cinits.set(tok, cinits.get(tok) ?? d20() + (sh?.initMod ?? 0)); else cinits.delete(tok);
      render(); return;
    }
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
    if (a === 'roll') { for (const s of app.state.roster) if (inits.has(s.id) || inits.size === 0) inits.set(s.id, d20() + s.initMod); for (const tok of cinits.keys()) { const t = app.state.tokens.find((x) => x.id === tok); cinits.set(tok, d20() + ((t && app.creatureSheet(t)?.initMod) ?? 0)); } render(); }
    if (a === 'start') {
      const entries: { sheetId: string; init: number; tokenId?: string }[] = [...inits].filter(([sheetId]) => !sheetId.startsWith('cr:')).map(([sheetId, init]) => ({ sheetId, init }));
      for (const [tok, init] of cinits) { const t = app.state.tokens.find((x) => x.id === tok); const sh = t && app.creatureSheet(t); if (sh) entries.push({ sheetId: sh.id, init, tokenId: tok }); }
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
    if (!e || !cur) { bar.innerHTML = ''; return; }
    // The players' side (Players view, or the slider at its players' end) reads the order through the alias and
    // visibility projection (core/identity.ts): hidden combatants are left out, the others go by their own token's
    // alias, a hidden combatant's turn shows only the round, and no chip carries a tip. The DM's chips get a tier A tip.
    const players = app.playersSide, dm = !app.restricted;
    const v = turnView(e, app.state.tokens, app.state.roster, { restricted: players });
    bar.innerHTML = `<div class="order">${v.order.map((c) => `<span class="cb${c.now ? ' now' : ''}" style="--tok:${esc(c.color)}"${players ? '' : ` data-tip="${esc(c.name)}" data-tip-sub="initiative ${c.init}${c.hp ? ` · hp ${c.hp}` : ''}"`}>${esc(c.name)}<i>${c.init}</i></span>`).join('')}</div>
      <div class="now"><b>Round ${v.round}</b>${v.current ? ` · ${esc(v.current.name)} · <span class="move">${v.current.leftFt} ft</span> of ${v.current.speedFt} ft left${v.current.rangeFt ? ` · range ${v.current.rangeFt} ft` : ''}` : ''}</div>
      <div class="acts">${dm ? `<button data-a="prev" aria-label="Previous turn" data-tip="Previous turn">${ICON.rotateL}</button>` : ''}${v.current || dm ? `<button data-a="go" aria-label="Find the combatant"${players ? '' : ' data-tip="Find the combatant"'}>${ICON.party}</button>` : ''}${dm ? `<button class="primary" data-a="next" data-tip="Next turn" data-key="nextTurn">Next turn</button><button data-a="end" data-tip="End the encounter">End</button>` : ''}</div>`;
  };
  return bar;
}
