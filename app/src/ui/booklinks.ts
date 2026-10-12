// Cross-links inside the books' own text (the Books reader, and a stat block's full traits and actions): each term
// the books' matcher recognises becomes a rules link to its sibling entry in the same edition, once per section,
// never to the entry it stands in. The DOM's text nodes are linked one by one; nothing is matched inside HTML.
import { findTerms, normTerm, termIndex, type Edition } from '../books/lookup';
import { kindInfo } from './kinds';
import { readyKinds, termKind } from './terms';

/** Never linked inside these: headings, links and buttons, code, table heads and captions, summaries, and a stat
 *  block's own tiles, ability grid and source line (labels, not prose). */
const SKIP = 'h1, h2, h3, h4, h5, h6, a, button, code, caption, th, summary, script, style, .rl, .tiles, .abil, .csrc, .src';
const HEADING = /^H[1-6]$/;

export interface LinkOpts {
  /** The text is a stat block's traits and actions (the matcher's statBlock rule). Inside a monster entry it always is. */
  statBlock?: boolean;
  /** The entry the text belongs to (never linked to itself). */
  self?: string;
}

/**
 * Link the sibling terms under `root`, in `edition`. A section is an entry (section.entry) or, outside entries, the
 * text under one heading: each term links at most once in it. Returns the number of links made.
 */
export async function linkBooksText(root: HTMLElement, edition: Edition, opts: LinkOpts = {}): Promise<number> {
  const t = await termIndex(edition);
  await readyKinds(edition).catch(() => {});
  // Collect first, then change the DOM.
  const work: { node: Text; section: string; self: string | undefined; head: string; stat: boolean }[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let head = '', headId = '';
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n as HTMLElement;
      if (HEADING.test(el.tagName)) { head = normTerm(el.textContent ?? ''); headId = el.id || head; }
      continue;
    }
    const node = n as Text, parent = node.parentElement;
    if (!parent || !node.data.trim() || parent.closest(SKIP)) continue;
    const entry = parent.closest<HTMLElement>('.entry');
    const self = entry?.dataset.id ?? opts.self;
    work.push({ node, section: entry?.dataset.id ? `e:${entry.dataset.id}` : `h:${headId}`, self, head, stat: !!opts.statBlock || !!entry?.classList.contains('t-monster') });
  }
  const seen = new Map<string, Set<string>>();
  let made = 0, last: HTMLElement | null = null;
  for (const w of work) {
    const text = w.node.data;
    const spans = findTerms(text, t, { statBlock: w.stat });
    if (!spans.length) continue;
    const s = seen.get(w.section) ?? seen.set(w.section, new Set()).get(w.section)!;
    const frag = document.createDocumentFragment();
    let at = 0, any = false, linkEnd = 0;
    for (const x of spans) {
      // Never to itself: not the entry it stands in, not the entry its section's heading names.
      if (x.start < at || x.id === w.self || normTerm(x.name) === w.head || s.has(x.id)) continue;
      // A stat block's 'Dex +8, Con +13' are labels of numbers, not prose: the line's own label ('Saving Throws') links.
      if (w.stat && x.type === 'ability' && /^[A-Z][a-z]{2}$/.test(x.text)) continue;
      // Two links with only a space between read as one ('Saving Throws Dex +9'): the first, the line's label, links.
      if (touches(last, w.node, text.slice(any ? linkEnd : at, x.start), any)) continue;
      s.add(x.id);
      // 'DC 10' is one link, never 'DC' alone with its number wrapped onto the next line.
      const dc = /^DC$/.test(x.text) ? /^\s\d+/.exec(text.slice(x.end)) : null;
      if (dc) x.end += dc[0].length;
      if (x.start > at) frag.append(text.slice(at, x.start));
      const kind = termKind(x.id, x.type, edition);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `rl ${kindInfo(kind).cls}`;
      Object.assign(b.dataset, { kind, term: x.id, label: x.name, edition });
      b.setAttribute('aria-expanded', 'false');
      // (a no-break space holds 'DC 10' together)
      b.textContent = dc ? text.slice(x.start, x.end).replace(/\s+/, '\u00a0') : text.slice(x.start, x.end);
      // A link is an atomic box: the stop or comma right after it would wrap alone ('DC 10' / '.'), so they go together.
      linkEnd = x.end;
      const stop = /^[.,;:!?)]+/.exec(text.slice(x.end));
      if (stop) {
        const keep = document.createElement('span');
        keep.className = 'rl-keep';
        keep.append(b, stop[0]);
        frag.append(keep);
        x.end += stop[0].length;
      } else frag.append(b);
      at = x.end; any = true; made++; last = b;
    }
    if (!any) continue;
    if (at < text.length) frag.append(text.slice(at));
    w.node.replaceWith(frag);
  }
  return made;
}

const BLOCK = 'p, li, dd, dt, td, div, blockquote, section, article';
/** Would a link at this point touch the previous one? `gap` is the text before it in its own node; `inNode`: the
 *  previous link was made in this same node (so `gap` is all there is between them). Across nodes, the text between
 *  the last link and this node counts too, within one block. */
function touches(last: HTMLElement | null, node: Text, gap: string, inNode: boolean): boolean {
  if (!last || gap.trim()) return false;
  if (inNode) return true;
  if (!last.isConnected || last.closest(BLOCK) !== node.parentElement?.closest(BLOCK)) return false;
  const r = document.createRange();
  r.setStartAfter(last); r.setEndBefore(node);
  return !r.toString().trim();
}
