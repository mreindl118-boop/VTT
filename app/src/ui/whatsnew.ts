// The "What's new" card: shown once after each update, with the newest changelog entry, and again from Help.
// The entry is read from docs/CHANGELOG.md at build time (vite.config.ts), so a release only has to write its
// changelog; the card follows. The version the owner last saw is kept in localStorage, so the card returns
// exactly once per release, on the DM's window only (the Player Display is read-only and never shows chrome).
import { ICON } from './icons';

export const SEEN_KEY = 'mistlab.seenVersion';

/** Has this version's card been seen? Also true for the first run ever, which shows Help instead. */
export function seenThisVersion(): boolean {
  try { return localStorage.getItem(SEEN_KEY) === __APP_VERSION__; } catch { return true; }
}
export function markSeen(): void {
  try { localStorage.setItem(SEEN_KEY, __APP_VERSION__); } catch { /* private mode: the card returns next time */ }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
/** Inline marks the changelog uses: **bold** and `code`. */
const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');

/** The changelog's Markdown subset (paragraphs, "- " bullets with one level of "  - " sub-bullets) as HTML. */
export function renderEntry(body: string): string {
  const out: string[] = [];
  let para: string[] = [], list: string[] = [], sub: string[] = [];
  const closeSub = () => { if (sub.length) { list[list.length - 1] += `<ul>${sub.map((s) => `<li>${inline(s)}</li>`).join('')}</ul>`; sub = []; } };
  const closeList = () => { closeSub(); if (list.length) { out.push(`<ul>${list.map((l) => `<li>${l}</li>`).join('')}</ul>`); list = []; } };
  const closePara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  for (const raw of body.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { closePara(); closeList(); continue; }
    const m = /^(\s*)- (.*)$/.exec(line);
    if (m) {
      closePara();
      if (m[1].length >= 2 && list.length) sub.push(m[2]);
      else { closeSub(); list.push(inline(m[2])); }
    } else if (/^\s{2,}\S/.test(line) && (sub.length || list.length)) {
      // a wrapped bullet line continues the last bullet
      if (sub.length) sub[sub.length - 1] += ' ' + line.trim(); else list[list.length - 1] += ' ' + inline(line.trim());
    } else { closeList(); para.push(line.trim()); }
  }
  closePara(); closeList();
  return out.join('');
}

/** Open the card. `onClose` runs when it is dismissed (the opener marks the version seen). */
export function showWhatsNew(onClose?: () => void): HTMLElement {
  const n = __WHATS_NEW__;
  const h = document.createElement('div');
  h.className = 'sheet-backdrop';
  h.innerHTML = `<div class="sheet whatsnew page" role="dialog" aria-labelledby="whatsnew-title">
    <header><div><span class="eyebrow">What's new</span><h2 id="whatsnew-title">mistLAB ${esc(n.version)}${n.title ? ` · ${esc(n.title)}` : ''}</h2></div><button class="icon close" aria-label="Close" data-tip="Close">${ICON.close}</button></header>
    <div class="sheet-body">${renderEntry(n.body) || '<p>A new version.</p>'}</div>
    <footer><span>${n.date ? esc(n.date) : ''}</span><button type="button" class="primary close">Let's play</button></footer></div>`;
  const close = () => { h.remove(); onClose?.(); };
  h.addEventListener('click', (e) => { const t = e.target as HTMLElement; if (t === h || t.closest('.close')) close(); });
  h.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  document.body.appendChild(h);
  h.querySelector<HTMLButtonElement>('footer .primary')?.focus();
  return h;
}
