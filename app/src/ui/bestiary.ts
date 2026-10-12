// The creature repository sheet: search the module's people and monsters, place any number on the map. Each
// creature's name opens its stat-block card, its meta is a row of stat pills (size, AC, HP, speed, CR) from the
// creature's one source (ui/creature.ts), its location tags open the place they name, and 'Stat block' unfolds the
// full block in the row. DM only.
import type { App } from '../app';
import { searchCreatures, colorOf, type CreatureEntry } from '../bestiary';
import { ICON } from './icons';
import { termsNow } from './rich';
import { esc } from './text';

const kindName = (e: CreatureEntry) => e.kind === 'npc' ? 'Person' : e.kind === 'monster-manual' ? 'Monster' : e.kind === 'creature' ? 'Creature' : 'Figure';

/** A location tag ('K', 'N2', 'death-house') as an area link named from the manifests, once the names are loaded. */
function tagLink(tag: string): string {
  const name = termsNow()?.homeOf([tag]);
  if (!name) return `<span class="ctag">${esc(tag)}</span>`;
  return `<button type="button" class="rl pageref" data-kind="area" data-key="${esc(tag)}" data-name="${esc(name)}" aria-expanded="false">${esc(tag)}</button>`;
}

export function openBestiary(app: App, onPlace: () => void): void {
  const back = document.createElement('div');
  back.className = 'sheet-backdrop';
  let q = '';
  let gen = 0;
  const render = () => {
    const list = searchCreatures(q), g = ++gen;
    const rows = list.map((e) => {
      const here = app.state.tokens.filter((t) => t.role === 'creature' && t.creatureId === e.id && t.location === app.cur?.scene.location).length;
      // People are the module's own (their name stays a name); every other creature opens its stat-block card.
      const name = e.kind === 'npc' ? `<b>${esc(e.name)}</b>` : `<button type="button" class="rl monster" data-kind="monster" data-creature="${esc(e.id)}" data-name="${esc(e.name)}" aria-expanded="false">${esc(e.name)}</button>`;
      return `<div class="crow" data-id="${esc(e.id)}"><span class="chip" style="--tok:${esc(colorOf(e))}" aria-hidden="true"></span><div class="cname">${name}<span class="cmeta"><span class="ckind">${kindName(e)}</span><span class="cpills"></span>${e.tags.length ? `<span class="ctags">${e.tags.map(tagLink).join(' ')}</span>` : ''}${here ? `<i>${here} on this map</i>` : ''}</span></div>
        ${e.kind === 'npc' ? '' : `<button data-a="block" aria-expanded="false" data-tip="Stat block" data-tip-sub="The full block, in the row">${ICON.list}<span>Stat block</span></button>`}<button data-a="here" data-tip="Place here" data-tip-sub="Place one beside the party">${ICON.party}<span>Place here</span></button><button class="primary" data-a="place" data-tip="Place by tap" data-tip-sub="Tap the map to place, again and again; Esc stops">${ICON.token}<span>Place by tap</span></button>
        <div class="cblock" hidden></div></div>`;
    }).join('');
    back.querySelector('.clist')!.innerHTML = rows || '<p class="hint">Nothing matches.</p>';
    // The pills, from each creature's one source (the books' entry for the Rules edition, else the module's numbers).
    void import('./creature').then((m) => Promise.all(list.map(async (e) => {
      const n = m.numbersOf(await m.creatureSource(e.id), e.size);
      const host = back.querySelector<HTMLElement>(`.crow[data-id="${CSS.escape(e.id)}"] .cpills`);
      if (g !== gen || !host) return;
      host.innerHTML = `${m.statPills(n)}${e.kind === 'npc' ? '' : `<span class="csrc">${esc([n.note, n.from].filter(Boolean).join(' · '))}</span>`}`;
    }))).catch(() => {});
  };
  back.innerHTML = `<div class="sheet bestiary page"><header><h2>Creatures</h2><input class="csearch" type="search" placeholder="Search people, monsters, beasts…" aria-label="Search creatures" autofocus><button class="icon close" aria-label="Close" data-tip="Close">${ICON.close}</button></header>
    <div class="sheet-body"><p class="hint">Placed creatures start hidden from the players; tap one on the map to reveal it, rename what players see, track hit points, show its reach, or put it in the initiative.</p><div class="clist"></div></div></div>`;
  render();
  const input = back.querySelector<HTMLInputElement>('.csearch')!;
  input.addEventListener('input', () => { q = input.value; render(); });
  const onEd = () => { if (!back.isConnected) return removeEventListener('mistlab:rules-edition', onEd); render(); };
  addEventListener('mistlab:rules-edition', onEd);
  back.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === back || t.closest('.close')) return back.remove();
    const b = t.closest<HTMLElement>('[data-a]'); if (!b) return;
    const row = b.closest<HTMLElement>('.crow')!, id = row.dataset.id!;
    if (b.dataset.a === 'here') { app.addCreatureNearParty(id); render(); onPlace(); }
    if (b.dataset.a === 'place') { app.startPlacing(id); back.remove(); onPlace(); }
    if (b.dataset.a === 'block') void toggleBlock(row, b, id);
  });
  document.body.appendChild(back);
  setTimeout(() => input.focus(), 0);
}

/** Unfold the full stat block in the row (statblock.ts, the same renderer as the card), or fold it away. */
async function toggleBlock(row: HTMLElement, btn: HTMLElement, id: string): Promise<void> {
  const host = row.querySelector<HTMLElement>('.cblock')!;
  const open = btn.getAttribute('aria-expanded') !== 'true';
  btn.setAttribute('aria-expanded', String(open));
  host.hidden = !open;
  if (!open || host.childElementCount) return;
  const [m, sb, { ensureEmblems }] = await Promise.all([import('./creature'), import('./statblock'), import('./emblems')]);
  ensureEmblems();
  const src = await m.creatureSource(id);
  if (src.kind === 'srd') {
    host.innerHTML = `${sb.statblockHtml(src.s, src.entry.html, true)}<p class="csrc">${esc(`${src.entry.edition} · ${src.entry.book === 'srd-5.2.1' ? 'SRD 5.2.1' : 'SRD 5.1'} · CC BY 4.0`)}</p>`;
    void import('./booklinks').then((b) => b.linkBooksText(host, src.entry.edition, { statBlock: true, self: src.entry.id })).catch(() => {});
  } else host.innerHTML = sb.moduleStatsHtml(src.stats, m.NO_OPEN_BLOCK) + `<p class="csrc">${m.MODULE_STATS}</p>`;
}
