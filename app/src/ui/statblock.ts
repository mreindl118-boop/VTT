// The one monster renderer (docs/THEME.md 'Stat-block card'): our own layout in the 5e reading order. The compact
// form is the DM's quick glance (four tiles, the ability grid, senses, languages, immunities); 'More' adds the traits
// and actions. One source per block: an SRD entry from the books, or the module's own numbers, never a mix.
import type { MonsterSummary } from '../books/types';
import { emblem } from './emblems';
import { esc } from './text';

const ABIL = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
const mod = (n: number): string => { const m = Math.floor((n - 10) / 2); return m >= 0 ? `+${m}` : `−${-m}`; };

/** The italic meta line: size, type, alignment (six words at most). */
export function monsterMeta(s: Pick<MonsterSummary, 'size' | 'creatureType' | 'alignment'>): string {
  const words = `${s.size ?? ''} ${String(s.creatureType ?? '').toLowerCase()}, ${String(s.alignment ?? '').toLowerCase()}`.replace(/\s+/g, ' ').replace(/^ |, $/g, '').trim();
  return words.split(' ').slice(0, 6).join(' ');
}

const tile = (icon: Parameters<typeof emblem>[0], value: string, word: string) => `<div class="tile">${emblem(icon)}<b>${esc(value)}</b><small>${esc(word)}</small></div>`;

/** The SRD stat block. `full` also renders the traits and actions (`html` is our own generated books data). */
export function statblockHtml(s: MonsterSummary, html: string, full: boolean): string {
  const speed = String(s.speed ?? '').split(/[,;]/)[0].replace(/\.$/, '');
  const props: [string, string | undefined][] = [
    ['Senses', s.senses], ['Languages', s.languages],
    ['Immunities', [s.immunities, s.conditionImmunities].filter(Boolean).join('; ') || undefined],
  ];
  const at = html.indexOf('<h3');
  const rest = at >= 0 ? html.slice(at) : '';
  return `<div class="statblock compact">
    <div class="tiles">${tile('checked-shield', String(s.ac), 'AC')}${tile('hearts', String(s.hp), s.hpDice ? `HP · ${s.hpDice.replace(/\s+/g, '')}` : 'HP')}${tile('boot-prints', speed || '—', 'Speed')}${tile('skull-crossed-bones', String(s.cr), s.xp ? `CR · ${s.xp} XP` : 'CR')}</div>
    <hr class="taper">
    <div class="abil">${ABIL.map((a) => { const v = s.abilities?.[a]; return `<div><small>${a}</small><b>${v ?? '—'}</b><i>${v === undefined ? '' : mod(v)}</i></div>`; }).join('')}</div>
    <hr class="taper">
    ${props.filter(([, v]) => v).map(([k, v]) => `<div class="prop"><b>${k}</b> ${esc(v)}</div>`).join('')}
    ${full && rest ? `<div class="full">${rest}</div>` : ''}
  </div>`;
}

/** Whether 'More' has anything to add to the compact block. */
export const hasMore = (html: string): boolean => html.includes('<h3');

/** The module's own numbers (bestiary STATS), shown only when the books have no such monster. */
export function moduleStatsHtml(st: { ac: number; hp: number; speed: string; cr: string } | undefined, note: string): string {
  return `<div class="statblock compact">
    ${st ? `<div class="tiles">${tile('checked-shield', String(st.ac), 'AC')}${tile('hearts', String(st.hp), 'HP')}${tile('boot-prints', st.speed.split(',')[0], 'Speed')}${tile('skull-crossed-bones', st.cr, 'CR')}</div>` : ''}
    <p class="note">${esc(note)}</p>
  </div>`;
}
