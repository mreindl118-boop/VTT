// The creature repository sheet: search the module's people and monsters, place any number on the map.
import type { App } from '../app';
import { searchCreatures, statsOf, colorOf, type CreatureEntry } from '../bestiary';
import { ICON } from './icons';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const kindName = (e: CreatureEntry) => e.kind === 'npc' ? 'Person' : e.kind === 'monster-manual' ? 'Monster' : e.kind === 'creature' ? 'Creature' : 'Figure';

export function openBestiary(app: App, onPlace: () => void): void {
  const back = document.createElement('div');
  back.className = 'sheet-backdrop';
  let q = '';
  const render = () => {
    const list = searchCreatures(q);
    const rows = list.map((e) => {
      const st = statsOf(e);
      const here = app.state.tokens.filter((t) => t.role === 'creature' && t.creatureId === e.id && t.location === app.cur?.scene.location).length;
      return `<div class="crow" data-id="${e.id}"><span class="chip" style="--tok:${colorOf(e)}"></span><div class="cname"><b>${esc(e.name)}</b><span>${kindName(e)} · ${e.size}${st ? ` · AC ${st.ac} · ${st.hp} hp · ${esc(st.speed)} · CR ${st.cr}` : ''}${e.tags.length ? ` · ${esc(e.tags.join(', '))}` : ''}${here ? ` · <i>${here} on this map</i>` : ''}</span></div>
        <button data-a="here" title="Place one beside the party">${ICON.party}<span>Place here</span></button><button class="primary" data-a="place" title="Tap the map to place, again and again; Esc stops">${ICON.token}<span>Place by tap</span></button></div>`;
    }).join('');
    back.querySelector('.clist')!.innerHTML = rows || '<p class="hint">Nothing matches.</p>';
  };
  back.innerHTML = `<div class="sheet bestiary"><header><h2>Creatures</h2><input class="csearch" type="search" placeholder="Search people, monsters, beasts…" aria-label="Search creatures" autofocus><button class="icon close" aria-label="Close">${ICON.close}</button></header>
    <div class="sheet-body"><p class="hint">Placed creatures start hidden from the players; tap one on the map to reveal it, rename what players see, track hit points, show its reach, or put it in the initiative.</p><div class="clist"></div></div></div>`;
  render();
  const input = back.querySelector<HTMLInputElement>('.csearch')!;
  input.addEventListener('input', () => { q = input.value; render(); });
  back.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === back || t.closest('.close')) return back.remove();
    const b = t.closest<HTMLElement>('[data-a]'); if (!b) return;
    const id = b.closest<HTMLElement>('.crow')!.dataset.id!;
    if (b.dataset.a === 'here') { app.addCreatureNearParty(id); render(); onPlace(); }
    if (b.dataset.a === 'place') { app.startPlacing(id); back.remove(); onPlace(); }
  });
  document.body.appendChild(back);
  setTimeout(() => input.focus(), 0);
}
