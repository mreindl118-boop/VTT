// Backups on the DM's side: Export (share sheet or download), Import, Reset and snapshot Restore in the Library's
// Campaign section, the 'Back up campaign' chip after two hours without an export, and Help's storage and
// non-goals lines. Persistent storage is requested on the first commit.
import type { App } from '../app';
import { CAMPAIGNS } from '../campaigns';
import { builtPaths } from '../data';
import { newCampaign } from '../state/campaign';
import { exportCampaign, listSnapshots, parseCampaignFile, replaceSaved, SnapshotSchedule, type Snapshot } from '../state/backup';
import { requestPersist, storagePersistent, storageText } from '../state/persist';
import './backups.css';

const svg = (body: string) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const IC = {
  export: svg('<path d="M12 15V3M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v7.5h14V12"/>'),
  import: svg('<path d="M12 3v12M7.5 10.5L12 15l4.5-4.5"/><path d="M5 12v7.5h14V12"/>'),
  reset: svg('<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4h4"/>'),
  shield: svg('<path d="M12 3l7 3v5.5c0 4.2-2.9 7.9-7 9.5-4.1-1.6-7-5.3-7-9.5V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>'),
};

/** Two hours without an export brings up the chip. */
export const NUDGE_AFTER_MS = 2 * 3600_000;

const ls = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string): void { try { localStorage.setItem(k, v); } catch { /* private mode: the nudge simply starts over */ } },
};
const exportedKey = (id: string) => `mistlab.exportedAt.${id}`;
/** When this campaign was last exported on this device; the first visit counts as the start. */
export function lastExport(id: string): number {
  const v = Number(ls.get(exportedKey(id)));
  if (v > 0) return v;
  const now = Date.now(); ls.set(exportedKey(id), String(now)); return now;
}
const nameOf = (id: string) => CAMPAIGNS.find((c) => c.id === id)?.name ?? id;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Hand a file to the share sheet where the browser can share files, otherwise download it. */
export async function deliver(name: string, text: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([text], name, { type: 'application/json' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
    try { await nav.share({ files: [file], title: name }); return 'shared'; }
    catch (e) { if ((e as Error)?.name === 'AbortError') return 'cancelled'; } // any other failure falls back to a download
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'downloaded';
}

function when(at: number): string {
  const d = new Date(at), now = new Date(), t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Today ${t}`;
  return `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${t}`;
}
function ago(ms: number): string {
  const m = Math.round(ms / 60_000);
  if (m < 1) return 'just now'; if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}
const REASON: Record<Snapshot['reason'], string> = { auto: 'automatic', 'before import': 'before an import', 'before restore': 'before a restore', 'before reset': 'before a reset' };

export interface Backups {
  /** Export the active campaign (share sheet or download). Resolves false when the DM cancelled the share sheet. */
  exportNow(): Promise<boolean>;
  /** The Library's Campaign section, drawn into `host`; `close` closes the Library. */
  section(host: HTMLElement, close: () => void): void;
  /** Show or hide the chip. */
  update(): void;
}

export function installBackups(app: App, ui: HTMLElement): Backups {
  const schedule = new SnapshotSchedule();
  const chip = document.createElement('button');
  chip.className = 'backup-chip dm-only'; chip.hidden = true;
  chip.innerHTML = `${IC.shield}<span>Back up campaign</span>`;
  chip.title = 'Two hours since the last export: save a copy of the campaign';
  ui.appendChild(chip);
  let redraw: (() => void) | null = null; // the open Library section, if any

  const update = () => {
    const id = app.campaign.id, last = lastExport(id);
    chip.hidden = !(Date.now() - last >= NUDGE_AFTER_MS && app.state.updatedAt > last);
  };

  const exportNow = async () => {
    const id = app.campaign.id;
    const { name, text } = exportCampaign(app.state, id, app.cur?.path);
    const how = await deliver(name, text); // no await before this: the share sheet needs the tap's activation
    if (how === 'cancelled') return false;
    ls.set(exportedKey(id), String(Date.now()));
    update(); redraw?.();
    app.flashStatus(how === 'shared' ? 'Backup shared' : `Backup saved as ${name}`);
    return true;
  };
  chip.addEventListener('click', () => void exportNow());

  const prevCommit = app.onCommit;
  app.onCommit = (s) => {
    prevCommit?.(s);
    void requestPersist();
    void schedule.note(app.campaign.id, s).then((took) => { if (took) redraw?.(); });
    update();
  };
  const prevChange = app.onChange;
  app.onChange = () => { prevChange?.(); update(); };
  setInterval(update, 60_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });

  const section = (host: HTMLElement, close: () => void) => {
    const id = app.campaign.id;
    let snaps: Snapshot[] = [];
    let confirm: { text: string; yes: string; run: () => Promise<void> } | null = null;
    let msg = '';
    // The file input stays put while the rest redraws, so a redraw cannot drop a file being picked.
    const body = document.createElement('div');
    const file = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json', hidden: true });
    file.setAttribute('aria-label', 'Backup file to import');
    host.append(body, file);
    const draw = () => {
      if (!host.isConnected) { if (redraw === refresh) redraw = null; return; }
      const last = Number(ls.get(exportedKey(id))) || 0;
      body.innerHTML = `<h3>Campaign · ${esc(nameOf(id))}</h3>
        <div class="cio-row">
          <button data-io="export">${IC.export}<span>Export</span></button>
          <button data-io="import">${IC.import}<span>Import</span></button>
          <button data-io="reset">${IC.reset}<span>Reset</span></button>
        </div>
        <p class="cio-note">${last ? `Last export ${ago(Date.now() - last)}.` : 'Not exported from this device yet.'} Export saves a file you can keep or move to another device.</p>
        ${confirm ? `<div class="cio-confirm" role="alertdialog"><p>${esc(confirm.text)}</p><div><button data-io="no">Cancel</button><button class="primary" data-io="yes">${esc(confirm.yes)}</button></div></div>` : ''}
        ${msg ? `<p class="cio-msg" role="status">${esc(msg)}</p>` : ''}
        <h4>Snapshots</h4>
        ${snaps.length ? `<ul class="cio-snaps">${snaps.map((s, i) => `<li class="cio-snap"><span><b>${when(s.at)}</b> · ${REASON[s.reason]} · ${plural(s.reveals, 'reveal')}, ${plural(s.tokens, 'token')}</span><button data-io="restore" data-i="${i}">Restore</button></li>`).join('')}</ul>` : '<p class="cio-note">None yet. mistLAB keeps the last five as you play.</p>'}`;
    };
    const refresh = () => void listSnapshots(id).then((s) => { snaps = s; draw(); });
    redraw = refresh;
    draw(); refresh();

    // Replace the campaign with `next` after keeping a snapshot of what is there now.
    const replace = async (next: typeof app.state, reason: 'before import' | 'before restore' | 'before reset', done: string, scene?: string) => {
      await replaceSaved(id, app.state, next, reason);
      if (scene && scene !== app.cur?.path) ls.set('mistlab.scene', scene); // the location a reload opens, as when the Library opens one
      await app.replaceState(next, scene);
      close(); app.flashStatus(done);
    };
    host.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-io]'); if (!b) return;
      e.stopPropagation();
      msg = '';
      switch (b.dataset.io) {
        case 'export': void exportNow(); return;
        case 'import': file.click(); return;
        case 'reset': confirm = { text: `Start ${nameOf(id)} over? Reveals, doors, tokens, the roster, the clock, the world-map trail and the encounter are cleared. A snapshot of the campaign is kept, so you can restore it.`, yes: 'Reset', run: () => replace(newCampaign(id), 'before reset', 'Campaign reset') }; break;
        case 'restore': { const s = snaps[Number(b.dataset.i)]; if (!s) return; confirm = { text: `Restore the snapshot from ${when(s.at)} (${plural(s.reveals, 'reveal')})? A snapshot of the campaign as it is now is kept.`, yes: 'Restore', run: () => replace(s.state, 'before restore', 'Snapshot restored') }; break; }
        case 'no': confirm = null; break;
        case 'yes': { const c = confirm; confirm = null; msg = c ? 'One moment…' : ''; if (c) void c.run().catch((err) => { msg = `That did not work: ${(err as Error)?.message ?? err}`; draw(); }); break; }
      }
      draw();
    });
    file.addEventListener('change', async () => {
      const f = file.files?.[0]; if (!f) return;
      const text = await f.text();
      file.value = '';
      const r = parseCampaignFile(text, id, nameOf);
      if (!r.ok) { confirm = null; msg = `Not imported. ${r.error}`; draw(); return; }
      const at = Date.parse(r.file.exportedAt);
      const scene = r.file.scene && builtPaths.has(r.file.scene) && CAMPAIGNS.find((c) => c.id === id)?.prefixes.some((p) => r.file.scene!.startsWith(p + '/')) ? r.file.scene : undefined; // reopen where it was exported
      confirm = { text: `Replace ${nameOf(id)} with the backup${Number.isFinite(at) ? ` from ${when(at)}` : ''} (${plural(r.state.reveals.length, 'reveal')}, ${plural(r.state.tokens.length, 'token')})? A snapshot of the campaign as it is now is kept.`, yes: 'Replace', run: () => replace(r.state, 'before import', 'Campaign imported', scene) };
      draw();
    });
  };

  void Promise.resolve().then(update);
  return { exportNow, section, update };
}

// ------------------------------------------------------------------ Help

const NON_GOALS: [string, string][] = [
  ['No remote play', 'no server, accounts or hosting: the campaign lives on this device, and the Player Display is a second window on it.'],
  ['No character sheets', 'no rules automation, chat, voice or 3D dice: paper sheets and real dice stay on the table.'],
  ['No player phones', 'players do not act from their own devices, and there is no touch-table mode.'],
  ['No plugins', 'no plugin system or marketplace; each feature has at most one setting.'],
  ['No sound or effects', 'no ambient audio, weather particles, animated doors or freehand drawing.'],
  ['No book text or maps', 'bring your own copy of the module: mistLAB gives area keys, names and page numbers, and describes everything in its own words.'],
];

/** Help's extra blocks: the running version, the storage status, and what mistLAB does not do. */
export function helpExtras(): { top: string; bottom: string } {
  return {
    top: `<div class="help-meta"><span class="help-version">mistLAB ${__APP_VERSION__}</span><p class="storage-status" role="status">Storage: checking…</p></div>`,
    bottom: `<section class="nongoals"><h3>What mistLAB does not do</h3><ul>${NON_GOALS.map(([b, t]) => `<li><b>${b}:</b> ${t}</li>`).join('')}</ul></section>`,
  };
}
/** Fill in the storage status once the browser answers. */
export function wireHelpExtras(sheet: HTMLElement): void {
  void storagePersistent().then((p) => {
    const el = sheet.querySelector<HTMLElement>('.storage-status'); if (!el) return;
    el.textContent = storageText(p);
    el.classList.toggle('warn', !p);
  });
}
