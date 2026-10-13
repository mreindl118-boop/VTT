// Search over the rules books: names and headings from each book's index (instant), and the full text of its
// pages (on request). Pure functions over the loaded data, so they are unit-tested without a browser.
import type { BookId, BookIndex, EntryType, PageFile } from './types';

export interface Hit {
  book: BookId; anchor: string; title: string; type: EntryType | '';
  page: number; chapter: string; score: number;
  /** For full-text hits: the matching text with the match marked by « ». */
  snippet?: string;
}

export const normQuery = (s: string): string => s.toLowerCase().replace(/[’']/g, '').replace(/\[[^\]]*\]/g, ' ').replace(/[^a-z0-9+/]+/g, ' ').trim();
const TYPE_BONUS: Partial<Record<EntryType, number>> = { condition: 9, spell: 8, monster: 8, rule: 6, item: 6, feat: 4, class: 4, species: 4, damage: 3, skill: 3, ability: 3 };

/** Rank every heading of a book against a query: exact name, then prefix, then word starts, then substring. */
export function searchIndex(index: BookIndex, query: string, limit = 60): Hit[] {
  const q = normQuery(query);
  if (!q) return [];
  const words = q.split(' ');
  const hits: Hit[] = [];
  for (const [anchor, title, level, page, type] of index.sections) {
    const t = normQuery(title);
    let score = 0;
    if (t === q) score = 100;
    else if (t.startsWith(q)) score = 80 - Math.min(20, t.length - q.length);
    else if (words.every((w) => (` ${t}`).includes(` ${w}`))) score = 60 - Math.min(20, t.length - q.length) / 2;
    else if (t.includes(q)) score = 40;
    if (!score) continue;
    score += (type ? TYPE_BONUS[type] ?? 2 : 0) - level * 0.5;
    hits.push({ book: index.id, anchor, title, type, page, chapter: index.chapters[index.pages[page]?.chapter ?? 0]?.title ?? '', score });
  }
  return hits.sort((a, b) => b.score - a.score || a.page - b.page).slice(0, limit);
}

/** The hit to jump to straight away: a name that matches the query exactly (a condition, spell, monster, rule …). */
export function exactHit(hits: Hit[], query: string): Hit | undefined {
  const q = normQuery(query);
  return hits.find((h) => normQuery(h.title) === q && h.type) ?? hits.find((h) => normQuery(h.title) === q);
}

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, k: string) => ENT[k]);
const stripTags = (s: string) => decode(s.replace(/<br>/g, ' ').replace(/<\/(p|li|tr|h\d|td|th)>/g, ' \n').replace(/<[^>]+>/g, ''));

/** Text of a page cut at its headings: [anchor, heading, text under it]. */
export function pageSections(html: string): [string, string, string][] {
  const out: [string, string, string][] = [];
  const re = /<h([1-6]) id="([^"]+)">([\s\S]*?)<\/h\1>/g;
  let m: RegExpExecArray | null, last: [string, string, number] | null = null;
  while ((m = re.exec(html))) {
    if (last) out.push([last[0], last[1], stripTags(html.slice(last[2], m.index))]);
    last = [m[2], stripTags(m[3]).trim(), re.lastIndex];
  }
  if (last) out.push([last[0], last[1], stripTags(html.slice(last[2]))]);
  return out;
}

/** Full-text matches in one page, one hit per section, with a short snippet. */
export function searchPage(index: BookIndex, pageIdx: number, page: PageFile, query: string, perPage = 20): Hit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const hits: Hit[] = [];
  const typeOf = new Map(index.sections.map((s) => [s[0], s[4]]));
  for (const [anchor, title, text] of pageSections(page.html)) {
    const flat = text.replace(/\s+/g, ' ');
    const i = flat.toLowerCase().indexOf(q);
    if (i < 0) continue;
    const a = Math.max(0, flat.lastIndexOf(' ', Math.max(0, i - 60))), b = Math.min(flat.length, i + q.length + 80);
    const snippet = `${a > 0 ? '…' : ''}${flat.slice(a, i).trimStart()}«${flat.slice(i, i + q.length)}»${flat.slice(i + q.length, b)}${b < flat.length ? '…' : ''}`;
    hits.push({ book: index.id, anchor, title, type: typeOf.get(anchor) ?? '', page: pageIdx, chapter: index.chapters[index.pages[pageIdx].chapter].title, score: 10, snippet });
    if (hits.length >= perPage) break;
  }
  return hits;
}

export interface HitGroup { book: BookId; chapters: { title: string; hits: Hit[] }[] }

/** Results grouped by book, then by chapter (the book's section), keeping the ranking inside each group. */
export function groupHits(hits: Hit[], order: BookId[]): HitGroup[] {
  const out: HitGroup[] = [];
  for (const book of order) {
    const mine = hits.filter((h) => h.book === book);
    if (!mine.length) continue;
    const chapters: { title: string; hits: Hit[] }[] = [];
    for (const h of mine) {
      let g = chapters.find((c) => c.title === h.chapter);
      if (!g) { g = { title: h.chapter, hits: [] }; chapters.push(g); }
      g.hits.push(h);
    }
    out.push({ book, chapters });
  }
  return out;
}
