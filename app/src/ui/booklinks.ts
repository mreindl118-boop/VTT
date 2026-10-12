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
  let made = 0;
  for (const w of work) {
    const text = w.node.data;
    const spans = findTerms(text, t, { statBlock: w.stat });
    if (!spans.length) continue;
    const s = seen.get(w.section) ?? seen.set(w.section, new Set()).get(w.section)!;
    const frag = document.createDocumentFragment();
    let at = 0, any = false;
    for (const x of spans) {
      // Never to itself: not the entry it stands in, not the entry its section's heading names.
      if (x.start < at || x.id === w.self || normTerm(x.name) === w.head || s.has(x.id)) continue;
      s.add(x.id);
      if (x.start > at) frag.append(text.slice(at, x.start));
      const kind = termKind(x.id, x.type, edition);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `rl ${kindInfo(kind).cls}`;
      Object.assign(b.dataset, { kind, term: x.id, label: x.name, edition });
      b.setAttribute('aria-expanded', 'false');
      b.textContent = text.slice(x.start, x.end);
      frag.append(b);
      at = x.end; any = true; made++;
    }
    if (!any) continue;
    if (at < text.length) frag.append(text.slice(at));
    w.node.replaceWith(frag);
  }
  return made;
}
