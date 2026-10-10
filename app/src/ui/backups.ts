// Backups on the DM's side: Export (share sheet or download), Import, Reset and snapshot Restore in the Library's
// Campaign section, the 'Back up campaign' chip after two hours without an export, and Help's storage and
// non-goals lines. Persistent storage is requested on the first commit.
import type { App } from '../app';
import { CAMPAIGNS } from '../campaigns';
import { builtPaths } from '../data';
import { newCampaign } from '../state/campaign';
import { addSnapshot, exportCampaign, listSnapshots, parseCampaignFile, SnapshotSchedule, snapshotState, type Snapshot } from '../state/backup';
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
const nudgeKey = (id: string) => `mistlab.nudgeFrom.${id}`;
/** When this campaign was last really exported on this device, or 0 when it never was. */
export function lastExport(id: string): number {
  const v = Number(ls.get(exportedKey(id)));
  return v > 0 ? v : 0;
}
/** Where the two-hour nudge counts from: the last export, or the first visit when there was none. */
export function nudgeFrom(id: string): number {
  const exported = lastExport(id); if (exported) return exported;
  let from = Number(ls.get(nudgeKey(id)));
  if (!(from > 0)) { from = Date.now(); ls.set(nudgeKey(id), String(from)); }
  return from;
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
  /** Export the active campaign (share sheet or download). Resolves to what happened, or null when the DM cancelled the share sheet. */
  exportNow(): Promise<string | null>;
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

  // The chip sits bottom right; on a narrow screen the turn bar or the token panel can reach under it, so it moves
  // up above whichever of them it would cover (their buttons stay tappable).
  const watched = new WeakSet<Element>();
  const sizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => place());
  const overlaps = (a: DOMRect, b: DOMRect) => b.width > 0 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const place = () => {
    chip.style.bottom = ''; chip.style.right = '';
    if (chip.hidden) return;
    const c = chip.getBoundingClientRect(), host = ui.getBoundingClientRect();
    let top = Infinity;
    for (const el of ui.querySelectorAll<HTMLElement>('.turnbar, .tokpanel')) {
      if (sizes && !watched.has(el)) { watched.add(el); sizes.observe(el); }
      if (el.hidden) continue;
      const r = el.getBoundingClientRect();
      if (overlaps(c, r)) top = Math.min(top, r.top);
    }
    if (top === Infinity) return;
    chip.style.bottom = `${Math.round(host.bottom - top + 8)}px`;
    // Lifted, it may meet the view slider on the right edge: it then sits just left of it.
    const slider = ui.querySelector<HTMLElement>('.vslider')?.getBoundingClientRect();
    if (slider && overlaps(chip.getBoundingClientRect(), slider)) chip.style.right = `${Math.round(host.right - slider.left + 8)}px`;
  };
  new MutationObserver(place).observe(ui, { attributes: true, attributeFilter: ['hidden'], subtree: true });
  addEventListener('resize', place);

  const update = () => {
    const id = app.campaign.id, last = nudgeFrom(id);
    chip.hidden = !(Date.now() - last >= NUDGE_AFTER_MS && app.state.updatedAt > last);
    place();
  };

  const exportNow = async () => {
    const id = app.campaign.id;
    const { name, text } = exportCampaign(app.state, id, app.cur?.path);
    const how = await deliver(name, text); // no await before this: the share sheet needs the tap's activation
    if (how === 'cancelled') return null;
    ls.set(exportedKey(id), String(Date.now()));
    const done = how === 'shared' ? 'Backup shared' : `Backup saved as ${name}`;
    update(); redraw?.();
    app.flashStatus(done);
    return done;
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
    let msg = '', msgOk = false;
    let snapsOpen = false, shown = false;
    // The file input stays put while the rest redraws, so a redraw cannot drop a file being picked.
    const body = document.createElement('div');
    const file = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json', hidden: true });
    file.setAttribute('aria-label', 'Backup file to import');
    host.append(body, file);
    const draw = () => {
      // The Library draws the section before it attaches the sheet: only a section that was shown and is gone stops redrawing.
      if (host.isConnected) shown = true;
      else if (shown) { if (redraw === refresh) redraw = null; return; }
      const last = lastExport(id);
      body.innerHTML = `<h3>Campaign · ${esc(nameOf(id))}</h3>
        <div class="cio-row">
          <button data-io="export">${IC.export}<span>Export</span></button>
          <button data-io="import">${IC.import}<span>Import</span></button>
          <button data-io="reset">${IC.reset}<span>Reset</span></button>
        </div>
        <p class="cio-note">${last ? `Last export ${ago(Date.now() - last)}.` : 'Not exported from this device yet.'} Export saves a file you can keep or move to another device.</p>
        ${confirm ? `<div class="cio-confirm" role="alertdialog"><p>${esc(confirm.text)}</p><div><button data-io="no">Cancel</button><button class="primary" data-io="yes">${esc(confirm.yes)}</button></div></div>` : ''}
        ${msg ? `<p class="cio-msg${msgOk ? ' ok' : ''}" role="status">${esc(msg)}</p>` : ''}
        <details class="cio-snapbox"${snapsOpen ? ' open' : ''}><summary>Snapshots (${snaps.length})</summary>
        ${snaps.length ? `<ul class="cio-snaps">${snaps.map((s, i) => `<li class="cio-snap"><span><b>${when(s.at)}</b> · ${REASON[s.reason]} · ${plural(s.reveals, 'reveal')}, ${plural(s.tokens, 'token')}</span><button data-io="restore" data-i="${i}">Restore</button></li>`).join('')}</ul>` : '<p class="cio-note">None yet. mistLAB keeps the last five as you play.</p>'}</details>`;
      body.querySelector('details')!.addEventListener('toggle', (e) => { snapsOpen = (e.target as HTMLDetailsElement).open; });
    };
    const refresh = () => void listSnapshots(id).then((s) => { snaps = s; draw(); });
    redraw = refresh;
    draw(); refresh();

    // Replace the campaign with `next` after keeping a snapshot of what is there now.
    // The app rebuilds from `next` first and only then is it saved; if the rebuild fails, the campaign goes back as it was.
    const replace = async (next: typeof app.state, reason: 'before import' | 'before restore' | 'before reset', done: string, scene?: string) => {
      const prev = structuredClone(app.state), prevPath = app.cur?.path;
      await addSnapshot(id, prev, reason);
      try { await app.replaceState(next, scene); }
      catch (err) { await app.replaceState(prev, prevPath).catch(() => undefined); await app.flush(); throw err; }
      await app.flush();
      if (scene && scene !== prevPath) ls.set('mistlab.scene', scene); // the location a reload opens, as when the Library opens one
      close(); app.flashStatus(done);
    };
    host.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-io]'); if (!b) return;
      e.stopPropagation();
      msg = ''; msgOk = false;
      switch (b.dataset.io) {
        case 'export': void exportNow().then((m) => { if (m) { msg = m; msgOk = true; draw(); } }); return;
        case 'import': file.click(); return;
        case 'reset': confirm = { text: `Start ${nameOf(id)} over? Reveals, doors, tokens, the roster, the clock, the world-map trail and the encounter are cleared. A snapshot of the campaign is kept, so you can restore it.`, yes: 'Reset', run: () => replace(newCampaign(id), 'before reset', 'Campaign reset') }; break;
        case 'restore': {
          const s = snaps[Number(b.dataset.i)]; if (!s) return;
          const r = snapshotState(s, id); // validated and migrated like an imported file
          if (!r.ok) { confirm = null; msg = `Not restored. ${r.error}`; break; }
          confirm = { text: `Restore the snapshot from ${when(s.at)} (${plural(s.reveals, 'reveal')})? A snapshot of the campaign as it is now is kept.`, yes: 'Restore', run: () => replace(r.state, 'before restore', 'Snapshot restored') }; break;
        }
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
