// Rules books (DM only): the Books tab of the Library and the reader. Loaded on demand, so the first load of the
// app does not grow. The text is the SRD 5.1 and 5.2.1 under CC-BY-4.0; each book's first page carries its attribution.
import './books.css';
import { ICON } from './icons';
import { esc } from './text';
import { loadCatalog, loadIndex, loadPage, loadTerms, offlineState, removeOffline, saveOffline, type OfflineState } from '../books/store';
import { exactHit, groupHits, searchIndex, searchPage, type Hit } from '../books/search';
import { candidates, findTerms, lookup, rulesEdition, setRulesEdition, termIndex } from '../books/lookup';
import { EDITION_OF, TYPE_META, typeLabel, type BookId, type BookIndex, type Catalog, type Edition, type EntryType } from '../books/types';

const BOOK_ORDER: BookId[] = ['srd-5.2.1', 'srd-5.1'];
const size = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);
const ICON_BOOK = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/></svg>';
const ICON_PREV = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const ICON_NEXT = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

/** Books never show on the players' side: not in Players mode, not on the Player Display. */
export const booksAllowed = (): boolean => document.body.dataset.mode !== 'player' && document.body.dataset.view !== 'players';

const chip = (type: string, book: BookId) => (type ? `<span class="tchip t-${type}">${type in TYPE_META ? typeLabel(type as EntryType, EDITION_OF[book]) : type}</span>` : '');

// ------------------------------------------------------------------ Books tab (inside the Library sheet)

export async function renderBooksTab(host: HTMLElement, closeLibrary: () => void): Promise<void> {
  host.innerHTML = '<p class="bk-loading">Loading the book list…</p>';
  let cat: Catalog;
  try { cat = await loadCatalog(); } catch {
    host.innerHTML = '<p class="bk-error">The book list could not be loaded. Connect to the network once, then use Save for offline.</p>';
    return;
  }
  const states = new Map<BookId, OfflineState | 'saving'>();
  const draw = () => {
    const ed = rulesEdition();
    host.innerHTML = `<section class="books-tab">
      <div class="bk-pref"><span><b>Rules edition</b><em>Which book answers rules look-ups</em></span>
        <div class="seg" role="radiogroup" aria-label="Rules edition">${(['2024', '2014'] as Edition[]).map((e) => `<button role="radio" data-ed="${e}" aria-checked="${e === ed}" aria-selected="${e === ed}">${e} rules</button>`).join('')}</div></div>
      <h3>Rules books</h3>
      ${BOOK_ORDER.map((id) => cat.books.find((b) => b.id === id)).filter(Boolean).map((b) => {
        const st = states.get(b!.id);
        const action = st === 'saving' ? '<button class="bk-save" disabled>Saving…</button>'
          : st === 'saved' ? `<button type="button" class="chip bk-saved tt" data-tip="Every chapter is stored on this device">Saved for offline</button><button class="bk-remove" data-remove="${b!.id}" aria-label="Remove the offline copy of ${esc(b!.short)}">Remove</button>`
            : st === 'unsupported' ? '' : `<button class="bk-save" data-save="${b!.id}">${st === 'partial' ? 'Finish saving' : 'Save for offline'}</button>`;
        return `<div class="bk-row" data-book="${b!.id}">
          <button class="bk-open" data-open="${b!.id}"><span class="bk-cover e${b!.edition}">${ICON_BOOK}<b>${b!.edition}</b></span>
            <span class="bk-text"><b>${esc(b!.title)}</b><span class="meta">${esc(b!.editionLabel)} · ${size(b!.bytes)} · ${esc(b!.license)}</span></span></button>
          <span class="bk-actions">${action}</span></div>`;
      }).join('')}
      <p class="bk-note">The open rules of fifth edition, under CC-BY-4.0. Each book's first page carries its attribution. Only you see the books: never the Players view or the Player Display.</p>
    </section>`;
  };
  draw();
  await Promise.all(cat.books.map(async (b) => states.set(b.id, await offlineState(b))));
  if (host.isConnected) draw();
  host.onclick = async (e) => {
    const t = e.target as HTMLElement;
    const ed = t.closest<HTMLElement>('[data-ed]');
    if (ed) { setRulesEdition(ed.dataset.ed as Edition); draw(); return; }
    const open = t.closest<HTMLElement>('[data-open]');
    if (open) { closeLibrary(); void openBook(open.dataset.open as BookId); return; }
    const save = t.closest<HTMLElement>('[data-save]'), rm = t.closest<HTMLElement>('[data-remove]');
    const id = (save ?? rm)?.dataset.save ?? rm?.dataset.remove;
    const b = cat.books.find((x) => x.id === id);
    if (!b) return;
    if (save) {
      states.set(b.id, 'saving'); draw();
      try { await saveOffline(b); states.set(b.id, 'saved'); } catch (err) { states.set(b.id, await offlineState(b)); alert(`Could not save ${b.short} for offline: ${(err as Error).message}`); }
    } else { await removeOffline(b); states.set(b.id, await offlineState(b)); }
    if (host.isConnected) draw();
  };
}

// ------------------------------------------------------------------ reader

interface Reader {
  el: HTMLElement; book: BookId; index: BookIndex; page: number; anchor: string;
  scope: 'book' | 'both'; query: string; fullText: Hit[] | null; tocOpen: boolean;
}
let R: Reader | null = null;

const HASH = /^#book\/(srd-[\d.]+)(?:\/(.*))?$/;

/** Open the reader for a #book/<id>/<section> hash. Returns false when the hash is not a book link. */
export function openFromHash(hash = location.hash): boolean {
  const m = HASH.exec(hash);
  if (!m || !booksAllowed()) return false;
  const anchor = m[2] ? decodeURIComponent(m[2]) : undefined;
  if (R && R.book === m[1] && R.anchor === (anchor ?? '')) return true;
  void openBook(m[1] as BookId, anchor);
  return true;
}

export function closeReader(): void {
  if (!R) return;
  R.el.remove(); R = null;
  if (HASH.test(location.hash)) history.replaceState(history.state, '', `${location.pathname}${location.search}`);
}

export async function openBook(book: BookId, anchor?: string): Promise<void> {
  if (!booksAllowed()) return;
  if (!R) R = { el: buildShell(), book, index: undefined as unknown as BookIndex, page: -1, anchor: '', scope: 'book', query: '', fullText: null, tocOpen: false };
  await go(book, anchor);
}

function buildShell(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'book-reader dm-only';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Rules books');
  el.tabIndex = -1;
  el.innerHTML = `
    <header class="br-bar">
      <button class="br-map" data-act="map" aria-label="Back to the map" data-tip="Back to the map" data-key="escape">${ICON.map}<span>Map</span></button>
      <button class="icon br-toc-btn" data-act="toc" aria-label="Contents" aria-expanded="false">${ICON.list}</button>
      <div class="br-where"><b class="br-book"></b><span class="br-sub"></span></div>
      <label class="br-search">${ICON.search}<input type="search" placeholder="Search rules, spells, monsters…" aria-label="Search the books" autocomplete="off" enterkeyhint="search"></label>
      <div class="seg br-scope" role="radiogroup" aria-label="Search in"><button role="radio" data-scope="book" aria-checked="true" aria-selected="true">This book</button><button role="radio" data-scope="both" aria-checked="false" aria-selected="false">Both</button></div>
    </header>
    <div class="br-body">
      <nav class="br-toc" aria-label="Contents"></nav>
      <div class="br-scrim" data-act="toc"></div>
      <main class="br-main"><div class="br-results" hidden></div><div class="br-content"></div></main>
    </div>`;
  document.body.appendChild(el);
  const input = el.querySelector<HTMLInputElement>('.br-search input')!;
  let timer = 0;
  // On iPad portrait and the phone the contents are a sheet over the page: typing a search closes it, so the results
  // (and the entry Enter jumps to) are never hidden under it.
  input.addEventListener('focus', () => { if (R?.tocOpen) toggleToc(false); });
  input.addEventListener('input', () => { if (R?.tocOpen) toggleToc(false); clearTimeout(timer); timer = window.setTimeout(() => void runSearch(input.value), 120); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); void jumpToBest(input.value); }
    if (e.key === 'Escape') { e.stopPropagation(); if (input.value) { input.value = ''; void runSearch(''); } else closeReader(); }
  });
  el.addEventListener('keydown', (e) => {
    e.stopPropagation(); // the map's shortcuts (R, F, N, /) stay with the map
    if (e.key === 'Escape') { if (R?.tocOpen) toggleToc(false); else if (R?.query) { input.value = ''; void runSearch(''); } else closeReader(); }
  });
  el.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'map') return closeReader();
    if (act === 'toc') return toggleToc();
    const scope = t.closest<HTMLElement>('[data-scope]');
    if (scope && R) { R.scope = scope.dataset.scope as 'book' | 'both'; el.querySelectorAll<HTMLElement>('[data-scope]').forEach((b) => { const on = b === scope; b.setAttribute('aria-checked', String(on)); b.setAttribute('aria-selected', String(on)); }); R.fullText = null; void runSearch(input.value); return; }
    const sw = t.closest<HTMLElement>('[data-switch]');
    if (sw) { toggleToc(false); void go(sw.dataset.switch as BookId); return; }
    const g = t.closest<HTMLElement>('[data-go]');
    if (g) { e.preventDefault(); toggleToc(false); void go((g.dataset.book as BookId) ?? R!.book, g.dataset.go || undefined); return; }
    // Search what is typed now, even if the name results have not caught up with the last keystrokes.
    if (t.closest('[data-fulltext]') && R) { clearTimeout(timer); R.query = input.value.trim(); void runFullText(); }
  });
  // Remember where the reader is, so a reload comes back to the same section.
  const main = el.querySelector<HTMLElement>('.br-main')!;
  let spy = 0;
  main.addEventListener('scroll', () => { clearTimeout(spy); spy = window.setTimeout(scrollSpy, 200); }, { passive: true });
  el.focus();
  return el;
}

function toggleToc(open?: boolean): void {
  if (!R) return;
  // Wide screens: the button folds the contents column away for full-width reading. Narrow: contents are a sheet.
  if (open === undefined && !matchMedia('(max-width: 900px)').matches) {
    const folded = R.el.classList.toggle('toc-collapsed');
    R.el.querySelector('.br-toc-btn')!.setAttribute('aria-expanded', String(!folded));
    return;
  }
  R.tocOpen = open ?? !R.tocOpen;
  R.el.classList.toggle('toc-open', R.tocOpen);
  R.el.querySelector('.br-toc-btn')!.setAttribute('aria-expanded', String(R.tocOpen));
}

function setHash(book: BookId, anchor: string): void {
  history.replaceState(history.state, '', `${location.pathname}${location.search}#book/${book}${anchor ? `/${encodeURIComponent(anchor)}` : ''}`);
}

function scrollSpy(): void {
  if (!R || R.page < 0 || R.query) return;
  const main = R.el.querySelector<HTMLElement>('.br-main')!;
  const top = main.getBoundingClientRect().top + 24;
  let cur = '';
  for (const h of R.el.querySelectorAll<HTMLElement>('.br-page [id]')) { if (h.getBoundingClientRect().top <= top) cur = h.id; else break; }
  const anchor = cur || R.index.pages[R.page].id;
  if (anchor !== R.anchor) { R.anchor = anchor; setHash(R.book, anchor); renderToc(); }
}

async function go(book: BookId, anchor?: string): Promise<void> {
  if (!R) return;
  const r = R;
  const content = r.el.querySelector<HTMLElement>('.br-content')!;
  let index: BookIndex;
  try { index = await loadIndex(book); } catch {
    // Name the book, and keep the switch and header on the book still open (it is the one that works).
    const b = (await loadCatalog().catch(() => null))?.books.find((x) => x.id === book);
    const name = b ? `${b.short} (${b.editionLabel.split(' · ')[0]})` : book;
    content.innerHTML = `<div class="br-page"><p class="bk-error">${esc(name)} is not saved on this device. Connect to the network once and use Save for offline in the Library's Books tab.</p>${r.index ? `<p><button class="br-back" data-go="${esc(r.anchor || 'about')}" data-book="${r.book}">Back to ${esc(r.index.short)}</button></p>` : ''}</div>`;
    r.el.querySelector<HTMLElement>('.br-content')!.hidden = false;
    r.el.querySelector<HTMLElement>('.br-results')!.hidden = true;
    return;
  }
  if (R !== r) return;
  r.book = book; r.index = index;
  r.el.querySelector('.br-book')!.textContent = index.short;
  r.el.querySelector('.br-sub')!.textContent = index.editionLabel.split(' · ')[0];
  clearSearch();
  if (!anchor || anchor === 'about') { r.page = -1; r.anchor = ''; renderTitle(); renderToc(); setHash(book, ''); r.el.querySelector('.br-main')!.scrollTop = 0; return; }
  let page = index.sections.find((s) => s[0] === anchor)?.[3];
  if (page === undefined) page = index.pages.findIndex((p) => p.id === anchor);
  if (page === undefined || page < 0) { r.page = -1; r.anchor = ''; renderTitle(`No section “${anchor}” in ${index.short}.`); renderToc(); setHash(book, ''); return; }
  await showPage(page, anchor);
}

async function showPage(pageIdx: number, anchor: string): Promise<void> {
  const r = R!;
  const content = r.el.querySelector<HTMLElement>('.br-content')!;
  const meta = r.index.pages[pageIdx];
  const shown = content.querySelector<HTMLElement>('.br-page[data-page]');
  if (shown?.dataset.page !== meta.id || shown.dataset.book !== r.book) {
    content.innerHTML = '<div class="br-page"><p class="bk-loading">Opening…</p></div>';
    let page;
    try { page = await loadPage(r.book, meta.id); } catch {
      content.innerHTML = `<div class="br-page"><p class="bk-error">“${esc(meta.title)}” is not saved on this device. Connect to the network, or save the book for offline in the Library's Books tab.</p></div>`;
      return;
    }
    if (R !== r) return;
    const prev = r.index.pages[pageIdx - 1], next = r.index.pages[pageIdx + 1];
    content.innerHTML = `<article class="br-page" data-book="${r.book}" data-page="${esc(meta.id)}" lang="en">${page.html}</article>
      <nav class="br-pager" aria-label="Pages">
        ${pageIdx > 0 ? `<button data-go="${esc(prev.id)}" class="br-prev">${ICON_PREV}<span><em>Previous</em>${esc(prev.title)}</span></button>` : `<button data-go="about" class="br-prev">${ICON_PREV}<span><em>Previous</em>About this book</span></button>`}
        ${next ? `<button data-go="${esc(next.id)}" class="br-next"><span><em>Next</em>${esc(next.title)}</span>${ICON_NEXT}</button>` : '<span></span>'}
      </nav>
      <footer class="br-attrib-line"><p>${esc(r.index.attribution)}</p><details><summary>This copy was converted and corrected: what changed</summary><p>${esc(r.index.changes)}</p></details></footer>`;
  }
  r.page = pageIdx;
  r.anchor = anchor;
  setHash(r.book, anchor);
  renderToc();
  const main = r.el.querySelector<HTMLElement>('.br-main')!;
  const target = anchor === meta.id ? null : content.querySelector<HTMLElement>(`[id="${CSS.escape(anchor)}"]`);
  const isTop = !target || target === content.querySelector('.br-page [id]');
  if (isTop) main.scrollTop = 0;
  else {
    main.scrollTop += target!.getBoundingClientRect().top - main.getBoundingClientRect().top - 12;
    const box = target!.closest<HTMLElement>('.entry') ?? target!;
    box.classList.remove('br-flash'); void box.offsetWidth; box.classList.add('br-flash');
  }
}

function renderTitle(notice?: string): void {
  const r = R!, ix = r.index;
  const content = r.el.querySelector<HTMLElement>('.br-content')!;
  content.innerHTML = `<article class="br-page br-title" lang="en">
    ${notice ? `<p class="bk-error">${esc(notice)}</p>` : ''}
    <p class="br-kicker">${esc(ix.editionLabel)}</p>
    <h1>${esc(ix.title)}</h1>
    <section class="br-attrib" aria-label="Attribution">
      <h2>Attribution</h2>
      <p class="br-statement">${esc(ix.attribution)}</p>
      <p>${esc(ix.changes)}</p>
      <p>Licence: <a href="${esc(ix.license.url)}" target="_blank" rel="noopener">${esc(ix.license.name)}</a>.</p>
      <p>${esc(ix.disclaimer)}</p>
    </section>
    <h2>Contents</h2>
    <ol class="br-contents">${ix.chapters.map((c) => `<li><button data-go="${esc(c.id)}">${esc(c.title)}</button></li>`).join('')}</ol>
    <details class="br-sources"><summary>Sources and how this copy was made</summary><ul>${ix.sources.map((s) => `<li>${esc(s.name)}<br><code>${esc(s.url)}</code><br>SHA-256 <code>${esc(s.sha256)}</code>, retrieved ${esc(s.retrieved)}</li>`).join('')}</ul></details>
  </article>
  <nav class="br-pager" aria-label="Pages"><span></span><button data-go="${esc(ix.pages[0].id)}" class="br-next"><span><em>Next</em>${esc(ix.pages[0].title)}</span>${ICON_NEXT}</button></nav>`;
}

function renderToc(): void {
  const r = R!, ix = r.index;
  const curCh = r.page >= 0 ? ix.pages[r.page].chapter : -1;
  const curIdx = r.anchor ? ix.sections.findIndex((s) => s[0] === r.anchor) : -1;
  // The level-2 section the reader is in, to unfold its level-3 entries.
  let curH2 = -1;
  for (let i = curIdx; i >= 0; i--) { if (ix.sections[i][2] === 2) { curH2 = i; break; } if (ix.sections[i][2] < 2) break; }
  const items = ix.chapters.map((c, ci) => {
    const open = ci === curCh;
    let sub = '';
    if (open) {
      const lis: string[] = [];
      ix.sections.forEach((s, i) => {
        if (ix.pages[s[3]]?.chapter !== ci) return;
        const show = s[2] === 2 || (s[2] === 3 && curH2 >= 0 && i > curH2 && ix.sections.slice(curH2 + 1, i).every((x) => x[2] > 2));
        if (!show) return;
        lis.push(`<li class="l${s[2]}${i === curIdx ? ' cur' : ''}"><button data-go="${esc(s[0])}">${esc(s[1])}</button></li>`);
      });
      sub = lis.length ? `<ol>${lis.join('')}</ol>` : '';
    }
    return `<li class="ch${open ? ' open' : ''}"><button data-go="${esc(c.id)}"${open ? ' aria-current="true"' : ''}>${esc(c.title)}</button>${sub}</li>`;
  }).join('');
  const nav = r.el.querySelector<HTMLElement>('.br-toc')!;
  const keep = nav.scrollTop;
  nav.innerHTML = `<div class="seg br-switch" role="tablist" aria-label="Book">${BOOK_ORDER.map((b) => `<button role="tab" data-switch="${b}" aria-selected="${b === r.book}">${b === 'srd-5.2.1' ? '2024 · 5.2.1' : '2014 · 5.1'}</button>`).join('')}</div>
    <button class="br-about${r.page < 0 ? ' cur' : ''}" data-go="about">About this book</button>
    <ol class="br-chapters">${items}</ol>`;
  nav.scrollTop = keep;
  nav.querySelector('.cur')?.scrollIntoView({ block: 'nearest' });
}

// ---- search

function clearSearch(): void {
  if (!R) return;
  R.query = ''; R.fullText = null;
  const input = R.el.querySelector<HTMLInputElement>('.br-search input')!;
  if (input.value) input.value = '';
  R.el.querySelector<HTMLElement>('.br-results')!.hidden = true;
  R.el.querySelector<HTMLElement>('.br-content')!.hidden = false;
}

const scopeBooks = (): BookId[] => (R!.scope === 'both' ? BOOK_ORDER : [R!.book]);

async function nameHits(q: string): Promise<Hit[]> {
  const out: Hit[] = [];
  for (const b of scopeBooks()) {
    try {
      const ix = await loadIndex(b);
      const hits = searchIndex(ix, q, 40);
      // What the term index knows that the headings don't: other names and forms ('grapple' is Grappling, 'wolves'
      // the Wolf, 'goblin' the 2024 Goblin Warrior). Those entries rank first, just under an exact heading.
      const t = await loadTerms(b);
      for (const i of candidates(t, q).slice(0, 3)) {
        const [, name, type] = t.entries[i];
        const s = ix.sections.find((x) => x[1] === name && x[4] === type);
        if (!s || hits.some((h) => h.anchor === s[0])) continue;
        hits.push({ book: b, anchor: s[0], title: s[1], type, page: s[3], chapter: ix.chapters[ix.pages[s[3]]?.chapter ?? 0]?.title ?? '', score: 95 });
      }
      out.push(...hits);
    } catch { /* not available offline */ }
  }
  return out.sort((a, b) => b.score - a.score);
}

async function runSearch(q: string): Promise<void> {
  if (!R) return;
  const r = R;
  r.query = q.trim(); r.fullText = null;
  if (r.query && r.tocOpen) toggleToc(false);
  const res = r.el.querySelector<HTMLElement>('.br-results')!, content = r.el.querySelector<HTMLElement>('.br-content')!;
  if (!r.query) { res.hidden = true; content.hidden = false; return; }
  const hits = await nameHits(r.query);
  if (R !== r || r.query !== q.trim()) return;
  renderResults(hits);
  res.hidden = false; content.hidden = true;
  r.el.querySelector<HTMLElement>('.br-main')!.scrollTop = 0;
}

async function jumpToBest(q: string): Promise<void> {
  if (!R || !q.trim()) return;
  if (R.tocOpen) toggleToc(false);
  const hits = await nameHits(q);
  const best = exactHit(hits, q) ?? hits[0];
  if (best) { await go(best.book, best.anchor); }
}

function hitRow(h: Hit, showBook: boolean): string {
  const sub = h.snippet ? `<span class="snip">${esc(h.snippet).replace(/«/, '<mark>').replace(/»/, '</mark>')}</span>` : '';
  return `<li><button data-go="${esc(h.anchor)}" data-book="${h.book}"><span class="t">${esc(h.title)}</span>${h.anchor.startsWith('table-') ? '<span class="tchip t-table">Table</span>' : chip(h.type, h.book)}${showBook ? `<span class="bk">${h.book === 'srd-5.1' ? '2014' : '2024'}</span>` : ''}${sub}</button></li>`;
}

function renderGroups(hits: Hit[]): string {
  return groupHits(hits, BOOK_ORDER).map((g) => `<section class="br-group" data-book="${g.book}"><h2>${g.book === 'srd-5.2.1' ? 'SRD 5.2.1 · 2024 rules' : 'SRD 5.1 · 2014 rules'}</h2>
    ${g.chapters.map((c) => `<h3>${esc(c.title)}</h3><ol>${c.hits.map((h) => hitRow(h, false)).join('')}</ol>`).join('')}</section>`).join('');
}

function renderResults(hits: Hit[]): void {
  const r = R!;
  const res = r.el.querySelector<HTMLElement>('.br-results')!;
  const books = scopeBooks().length;
  res.innerHTML = `<div class="br-page br-res">
    <p class="br-kicker">${hits.length ? `${hits.length} ${hits.length === 1 ? 'name' : 'names'} matching “${esc(r.query)}”` : `No names match “${esc(r.query)}”`}</p>
    ${renderGroups(hits)}
    ${r.fullText ? `<h2 class="br-ft">In the text</h2>${r.fullText.length ? renderGroups(r.fullText) : '<p>No matches in the text.</p>'}`
      : `<button class="br-fulltext" data-fulltext>Search the full text of ${books === 2 ? 'both books' : r.index.short}</button>`}
  </div>`;
}

async function runFullText(): Promise<void> {
  if (!R) return;
  const r = R, q = r.query;
  const btn = r.el.querySelector<HTMLButtonElement>('[data-fulltext]');
  const all: Hit[] = [];
  for (const b of scopeBooks()) {
    let ix: BookIndex;
    try { ix = await loadIndex(b); } catch { continue; }
    // A few pages at a time: the whole book arrives in a handful of round trips, results stay in page order.
    const found: Hit[][] = [];
    let done = 0, next = 0;
    const worker = async () => {
      while (next < ix.pages.length && R === r && r.query === q) {
        const i = next++;
        try { found[i] = searchPage(ix, i, await loadPage(b, ix.pages[i].id), q, 12); } catch { found[i] = []; /* page not available offline */ }
        done++;
        if (btn) { btn.disabled = true; btn.textContent = `Searching ${ix.short}: ${Math.round((done / ix.pages.length) * 100)}%`; }
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    if (R !== r || r.query !== q) return;
    all.push(...found.flat());
    if (all.length >= 300) break;
  }
  r.fullText = all.slice(0, 300);
  const names = await nameHits(q);
  if (R === r && r.query === q) renderResults(names);
}

// Test/debug hook (like window.__mistlab): the lookup API the rules tooltips will use. DM-side code only.
(window as unknown as { __mistlabBooks: unknown }).__mistlabBooks = { lookup, rulesEdition, termIndex, findTerms, openBook, closeReader, terms: () => import('./terms') };
