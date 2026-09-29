// Library sheet: the book's organization, chapter -> location -> area keys.
import manifest from '../../../manifests/locations.json';
import { ICON } from './icons';

interface ManifestLoc { id: string; name: string; chapter: string; status: string; mapPages: number[]; areas: { key: string; name: string }[]; path: string }

export function openLibrary(built: Set<string>, onOpen: (path: string) => void): void {
  const sheet = document.createElement('div');
  sheet.className = 'sheet-backdrop';
  const chapters = (manifest as { chapters: { id: string; number: number | null; title: string }[] }).chapters;
  const locs = (manifest as { locations: ManifestLoc[] }).locations;
  const devBuilt = [...built].filter((p) => p.startsWith('dev/'));
  const html = [
    `<div class="sheet"><header><h2>Library</h2><button class="icon close" aria-label="Close">${ICON.close}</button></header><div class="sheet-body">`,
    devBuilt.length ? `<section><h3>Development</h3>${devBuilt.map((p) => `<button class="row built" data-path="${p}"><span class="k">dev</span><span class="n">${p.split('/')[1]}</span><span class="chip">open</span></button>`).join('')}</section>` : '',
    ...chapters.map((c) => {
      const inCh = locs.filter((l) => l.chapter === c.id && l.status !== 'kit');
      return `<section><h3>${c.number ? `Chapter ${c.number} · ` : ''}${c.title}</h3>${inCh.map((l) => {
        const p = l.path.replace(/^locations\//, '');
        const ok = built.has(p);
        return `<button class="row${ok ? ' built' : ''}" ${ok ? `data-path="${p}"` : 'disabled'}><span class="k">${l.id}</span><span class="n">${l.name}</span><span class="meta">${l.areas.length} ${l.areas.length === 1 ? "key" : "keys"}${l.mapPages.length ? ` · p.${l.mapPages[0]}` : ''}</span><span class="chip ${l.status}">${ok ? 'open' : l.status}</span></button>`;
      }).join('')}</section>`;
    }),
    '</div></div>',
  ].join('');
  sheet.innerHTML = html;
  const close = () => sheet.remove();
  sheet.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === sheet || t.closest('.close')) return close();
    const row = t.closest<HTMLElement>('[data-path]');
    if (row) { close(); onOpen(row.dataset.path!); }
  });
  document.body.appendChild(sheet);
}
