// Loading the rules books (app/public/books/**) lazily, and keeping them for offline play.
// Nothing here runs until a book, a search or a lookup asks for it.
import type { BookId, BookIndex, Catalog, EntryFile, PageFile, TermFile } from './types';

type Fetcher = (path: string) => Promise<unknown>;

/** Cache that holds books saved for offline (kept by the service worker across app updates). */
export const BOOK_CACHE = 'mistlab-books-v1';

export const bookUrl = (path: string): string => new URL(`books/${path}`, document.baseURI).href;

const defaultFetcher: Fetcher = async (path) => {
  const url = bookUrl(path);
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    // No service worker in control (first visit, ?nosw): the saved copy can still answer.
    const hit = typeof caches !== 'undefined' ? await caches.match(url) : undefined;
    if (hit) return hit.json();
    throw e;
  }
};

let fetcher: Fetcher = defaultFetcher;
const memo = new Map<string, Promise<unknown>>();

/** Tests (and tools) read the files from disk instead of over HTTP. */
export function setBookFetcher(f: Fetcher | null): void { fetcher = f ?? defaultFetcher; memo.clear(); }

export function loadJson<T>(path: string): Promise<T> {
  let p = memo.get(path);
  if (!p) { p = fetcher(path); memo.set(path, p); p.catch(() => memo.delete(path)); }
  return p as Promise<T>;
}

export const loadCatalog = () => loadJson<Catalog>('catalog.json');
export const loadIndex = (b: BookId) => loadJson<BookIndex>(`${b}/index.json`);
export const loadPage = (b: BookId, pageId: string) => loadJson<PageFile>(`${b}/p/${pageId}.json`);
export const loadEntries = (b: BookId, file: string) => loadJson<EntryFile>(`${b}/e/${file}.json`);
export const loadTerms = (b: BookId) => loadJson<TermFile>(`${b}/terms.json`);

// ---- offline

export type OfflineState = 'saved' | 'partial' | 'none' | 'unsupported';

/** The code and styles the reader needs, so the Books tab itself opens offline. */
function appUrls(): string[] {
  const own = [import.meta.url];
  const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"], link[rel="modulepreload"]')].map((l) => l.href);
  const scripts = [...document.querySelectorAll<HTMLScriptElement>('script[src]')].map((s) => s.src);
  return [...new Set([...own, ...links, ...scripts])].filter((u) => u.startsWith(location.origin));
}

export const bookFiles = (b: { id: BookId; files: string[] }): string[] => b.files.map((f) => bookUrl(`${b.id}/${f}`));

export async function offlineState(b: { id: BookId; files: string[] }): Promise<OfflineState> {
  if (typeof caches === 'undefined') return 'unsupported';
  try {
    const c = await caches.open(BOOK_CACHE);
    const urls = bookFiles(b);
    const hits = await Promise.all(urls.map((u) => c.match(u)));
    const n = hits.filter(Boolean).length;
    return n === urls.length ? 'saved' : n ? 'partial' : 'none';
  } catch { return 'unsupported'; }
}

/** Cache every file of a book through the service worker (or directly when none is in control). */
export async function saveOffline(b: { id: BookId; files: string[] }): Promise<void> {
  const urls = [...bookFiles(b), bookUrl('catalog.json'), ...appUrls()];
  const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker?.controller : null;
  if (sw) {
    await new Promise<void>((resolve, reject) => {
      const ch = new MessageChannel();
      const timer = setTimeout(() => reject(new Error('The service worker did not answer')), 120_000);
      ch.port1.onmessage = (e) => { clearTimeout(timer); if (e.data?.ok) resolve(); else reject(new Error(e.data?.error ?? 'Saving failed')); };
      sw.postMessage({ type: 'cache-pack', cache: BOOK_CACHE, urls }, [ch.port2]);
    });
  } else {
    const c = await caches.open(BOOK_CACHE);
    await c.addAll(urls);
  }
  if ((await offlineState(b)) !== 'saved') throw new Error('Some files could not be saved');
}

export async function removeOffline(b: { id: BookId; files: string[] }): Promise<void> {
  if (typeof caches === 'undefined') return;
  const c = await caches.open(BOOK_CACHE);
  await Promise.all(bookFiles(b).map((u) => c.delete(u)));
}
