// Library sheet: campaigns, then each module's own organization (chapter or section → location → area keys).
import { CAMPAIGNS, manifestOf, type Campaign, type ManifestLoc } from '../campaigns';
import { ICON } from './icons';

export function openLibrary(built: Set<string>, active: Campaign, onOpen: (path: string) => void): void {
  const sheet = document.createElement('div');
  sheet.className = 'sheet-backdrop';
  let camp = active;
  const render = () => {
    const m = manifestOf(camp);
    const locs = m.locations as ManifestLoc[];
    const row = (l: ManifestLoc) => {
      const p = l.path.replace(/^locations\//, ''), ok = built.has(p);
      return `<button class="row${ok ? ' built' : ''}" ${ok ? `data-path="${p}"` : 'disabled'}><span class="k">${l.id}</span><span class="n">${l.name}</span><span class="meta">${l.areas.length} ${l.areas.length === 1 ? 'key' : 'keys'}${l.mapPages.length ? ` · p.${l.mapPages[0]}` : ''}</span><span class="chip ${l.status}">${ok ? 'open' : l.status}</span></button>`;
    };
    const groups = m.sections
      ? m.sections.map((sec) => { const inS = locs.filter((l) => l.section === sec.id); const ptr = (m.pointers ?? []).filter((p) => p.id.startsWith(sec.id)); return inS.length || ptr.length ? `<section><h3>${sec.id} · ${sec.title}</h3>${inS.map(row).join('')}${ptr.map((p) => `<div class="pointer"><span class="k">${p.id.slice(0, 2)}</span><span class="n">${p.title.split('—')[0].trim()}</span><span class="meta">uses ${[...new Set(p.pointsTo.map((x) => x.split('/').pop()))].join(', ')}</span></div>`).join('')}</section>` : ''; })
      : m.chapters.map((c) => { const inCh = locs.filter((l) => l.chapter === c.id && l.status !== 'kit'); return `<section><h3>${c.number ? `Chapter ${c.number} · ` : ''}${c.title}</h3>${inCh.map(row).join('')}</section>`; });
    sheet.innerHTML = [
      `<div class="sheet library"><header><h2>Library</h2><button class="icon close" aria-label="Close">${ICON.close}</button></header>`,
      `<div class="campaigns" role="tablist" aria-label="Campaign">${CAMPAIGNS.map((c) => `<button role="tab" data-camp="${c.id}" aria-selected="${c.id === camp.id}"><b>${c.name}</b><span>${c.subtitle}</span></button>`).join('')}</div>`,
      '<div class="sheet-body">',
      ...groups,
      '</div></div>',
    ].join('');
  };
  render();
  const close = () => sheet.remove();
  sheet.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === sheet || t.closest('.close')) return close();
    const c = t.closest<HTMLElement>('[data-camp]');
    if (c) { camp = CAMPAIGNS.find((x) => x.id === c.dataset.camp)!; render(); return; }
    const row = t.closest<HTMLElement>('[data-path]');
    if (row) { close(); onOpen(row.dataset.path!); }
  });
  document.body.appendChild(sheet);
}
