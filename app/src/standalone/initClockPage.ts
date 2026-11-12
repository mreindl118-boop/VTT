// The initiative clock on its own page, outside the VTT: the same clock (ui/initClock.ts) with a host that reads the
// SRD monsters and conditions embedded in the page, and a small stat-block card for monster and condition links
// (inside the VTT the app's rules cards do that). Built into one HTML file by scripts/initclock/build.mjs.
import type { MonsterSummary } from '../books/types';
import type { Rules } from '../core/initClock';
import { openClock, type ClockHost, type MonsterRecord } from '../ui/initClock';
import { ensureEmblems } from '../ui/emblems';
import { statblockHtml } from '../ui/statblock';
import { esc } from '../ui/text';

interface PageData {
  monsters: Record<Rules, MonsterRecord[]>;
  conditions: Record<Rules, { id: string; name: string; html: string }[]>;
  attribution: Record<Rules, string>;
  party?: { name: string; player?: string; level?: number; color?: string }[];
}
const data = JSON.parse(document.getElementById('srd-data')!.textContent!) as PageData;
const EDITION_KEY = 'initclock.rulesEdition', EVENT = 'initclock:edition';
const edition = (): Rules => { try { return localStorage.getItem(EDITION_KEY) === '2014' ? '2014' : '2024'; } catch { return '2024'; } };
const COLORS = ['#d9822b', '#7b5ea7', '#c9b458', '#3b8ea5', '#4f9a5b', '#c0607a'];

const host: ClockHost = {
  key: 'standalone',
  roster: () => (data.party?.length ? data.party : [1, 2, 3, 4].map((n): NonNullable<PageData['party']>[number] => ({ name: `Character ${n}` }))).map((p, i) => ({ id: `pc-${i + 1}`, name: p.name, player: p.player, level: p.level, color: p.color ?? COLORS[i % COLORS.length], initMod: 0 })),
  partyVersion: JSON.stringify(data.party ?? []),
  monsters: async (ed) => data.monsters[ed] ?? [],
  edition,
  setEdition: (ed) => { try { localStorage.setItem(EDITION_KEY, ed); } catch { /* this visit only */ } dispatchEvent(new CustomEvent(EVENT, { detail: ed })); },
  editionEvent: EVENT,
};

document.documentElement.classList.add('ic-standalone-page');
openClock(host);

// ---- the stat-block card for links in the clock

let card: HTMLElement | null = null, cardFor: Element | null = null, hoverTimer = 0;
const closeCard = () => { card?.remove(); card = null; cardFor = null; };
function show(t: HTMLElement, pinned: boolean): void {
  if (cardFor === t) { if (pinned) card?.classList.add('pinned'); return; }
  closeCard();
  const term = t.dataset.term ?? '', ed = (t.dataset.edition as Rules) || edition();
  let body = '', head = '', foot = '';
  if (term.startsWith('monster:')) {
    const m = (data.monsters[ed] ?? []).find((x) => x.id === term) ?? data.monsters[ed === '2024' ? '2014' : '2024'].find((x) => x.id === term);
    if (!m) return;
    ensureEmblems();
    head = `<small>Monster · CR ${esc((m.s as MonsterSummary).cr)}</small><b>${esc(m.name)}</b><i>${esc(`${m.s.size} ${m.s.creatureType}, ${m.s.alignment}`)}</i>`;
    body = statblockHtml(m.s, m.html, true);
    foot = `${ed === '2024' ? '2024 · SRD 5.2.1' : '2014 · SRD 5.1'} · CC BY 4.0`;
  } else if (term.startsWith('condition:')) {
    const c = (data.conditions[ed] ?? []).find((x) => x.id === term);
    if (!c) return;
    head = `<small>Condition</small><b>${esc(c.name)}</b>`;
    body = `<div class="ic-cardbody">${c.html}</div>`;
    foot = `${ed === '2024' ? '2024 · SRD 5.2.1' : '2014 · SRD 5.1'} · CC BY 4.0`;
  } else return;
  card = document.createElement('div');
  card.className = `ic-statcard page${pinned ? ' pinned' : ''}`;
  card.innerHTML = `<header>${head}<button type="button" aria-label="Close">×</button></header>${body}<footer>${esc(foot)}</footer>`;
  document.body.appendChild(card);
  cardFor = t;
  const r = t.getBoundingClientRect(), w = Math.min(360, innerWidth - 16), h = card.offsetHeight;
  card.style.width = `${w}px`;
  card.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.right + 8 + w > innerWidth ? r.left - w - 8 : r.right + 8))}px`;
  card.style.top = `${Math.max(8, Math.min(innerHeight - Math.min(h, innerHeight * 0.8) - 8, r.top - 20))}px`;
  if (r.left - w - 8 < 0 && r.right + 8 + w > innerWidth) { card.style.left = `${Math.max(8, (innerWidth - w) / 2)}px`; card.style.top = `${Math.min(innerHeight - 100, r.bottom + 6)}px`; }
  card.querySelector('button')!.addEventListener('click', closeCard);
}
document.addEventListener('click', (e) => {
  const t = (e.target as Element).closest<HTMLElement>('.rl[data-term]');
  if (t) { e.preventDefault(); show(t, true); return; }
  if (card && !card.contains(e.target as Node)) closeCard();
});
document.addEventListener('pointerover', (e) => {
  if (e.pointerType === 'touch') return;
  const t = (e.target as Element).closest<HTMLElement>('.rl[data-term]');
  clearTimeout(hoverTimer);
  if (t) hoverTimer = window.setTimeout(() => show(t, false), 450);
  else if (card && !card.classList.contains('pinned') && !card.contains(e.target as Node)) hoverTimer = window.setTimeout(() => { if (card && !card.classList.contains('pinned')) closeCard(); }, 300);
});
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCard(); });

// The credits the SRD licence asks for, in the footer.
const credit = document.createElement('p');
credit.className = 'ic-credit';
credit.textContent = `${data.attribution['2024']} ${data.attribution['2014']}`;
document.body.appendChild(credit);
