// Builds the initiative clock as one self-contained HTML page (app/src/standalone/initClockPage.ts): the clock's code
// and styles, the theme tokens and fonts, and the SRD 5.1 and 5.2.1 monsters and conditions (CC-BY-4.0, with their
// attribution). Usage: node scripts/initclock/build.mjs <out.html> ["Character|Player|level,…"]
// The output is for the DM's own use and is not committed (party names in particular stay out of the repo).
import { build } from 'vite';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const out = process.argv[2];
if (!out) { console.error('usage: node scripts/initclock/build.mjs <out.html> [names]'); process.exit(1); }
// Each party member: "Character|Player|level" (player and level optional), comma separated.
const party = (process.argv[3] ?? '').split(',').map((s) => s.trim()).filter(Boolean).map((x) => { const [name, player, level] = x.split('|').map((v) => v.trim()); return { name, ...(player ? { player } : {}), ...(level ? { level: Number(level) } : {}) }; });

const tmp = mkdtempSync(join(tmpdir(), 'initclock-'));
await build({
  configFile: false, root, logLevel: 'warn',
  build: {
    outDir: tmp, emptyOutDir: true, target: 'es2022', cssCodeSplit: false, minify: true,
    lib: { entry: resolve(root, 'app/src/standalone/initClockPage.ts'), formats: ['iife'], name: 'InitClock', fileName: () => 'clock.js' },
  },
});
const files = readdirSync(tmp);
const js = readFileSync(join(tmp, 'clock.js'), 'utf8');
const cssFile = files.find((f) => f.endsWith('.css'));
const css = cssFile ? readFileSync(join(tmp, cssFile), 'utf8') : '';

// The theme tokens from the app, fonts inlined.
const styles = readFileSync(resolve(root, 'app/src/styles.css'), 'utf8');
let tokens = styles.slice(0, styles.indexOf('/* ==== end of the theme tokens'));
tokens = tokens.replace(/url\(\/fonts\/([\w.-]+)\)/g, (_, f) => `url(data:font/woff2;base64,${readFileSync(resolve(root, 'app/public/fonts', f)).toString('base64')})`);

const book = (b) => JSON.parse(readFileSync(resolve(root, `app/public/books/${b}/e/monsters.json`), 'utf8'));
const rules = (b) => JSON.parse(readFileSync(resolve(root, `app/public/books/${b}/e/rules.json`), 'utf8'));
const attribution = (b) => /## Attribution\s+([\s\S]*?)\n\n/.exec(readFileSync(resolve(root, `app/public/books/${b}/ATTRIBUTION.md`), 'utf8'))[1].trim();
const mons = (b) => Object.values(book(b).entries).map((e) => ({ id: e.id, name: e.name, s: e.s, html: e.html }));
const conds = (b) => Object.values(rules(b).entries).filter((e) => e.type === 'condition').map((e) => ({ id: e.id, name: e.name, html: e.html }));
const data = {
  monsters: { 2014: mons('srd-5.1'), 2024: mons('srd-5.2.1') },
  conditions: { 2014: conds('srd-5.1'), 2024: conds('srd-5.2.1') },
  attribution: { 2014: attribution('srd-5.1'), 2024: attribution('srd-5.2.1') },
  party,
};

const page = `<title>Initiative Clock</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
${tokens}
/* the standalone page: the clock fills the window */
:root { color-scheme: light; }
@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { color-scheme: dark; } }
:root[data-theme='dark'] { color-scheme: dark; }
html, body { height: 100%; }
body { background: var(--p-sunk); color: var(--p-ink); font-family: var(--font-ui); }
${css}
.ic-standalone-page .ic-dock { position: fixed; inset: env(safe-area-inset-top, 0px) max(8px, env(safe-area-inset-right, 0px)) calc(28px + env(safe-area-inset-bottom, 0px)) max(8px, env(safe-area-inset-left, 0px)) !important; width: auto !important; height: auto !important; resize: none; }
.ic-standalone-page .ic-dock[data-mode='mini'] { inset: 8px auto auto 50% !important; transform: translateX(-50%); width: 340px !important; }
.ic-standalone-page .ic-head { cursor: default; }
.ic-standalone-page .ic-tools [data-a='close'], .ic-standalone-page [data-a='export'] { display: none; }
.ic-credit { position: fixed; left: 0; right: 0; bottom: env(safe-area-inset-bottom, 0px); margin: 0; padding: 4px max(16px, env(safe-area-inset-left, 0px)); font-size: 10px; line-height: 1.3; color: var(--p-ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ic-statcard { position: fixed; z-index: 95; max-height: 80vh; overflow: auto; background: var(--p-bg); color: var(--p-ink); border: 1px solid var(--p-edge); border-top: 4px solid var(--k-monster); border-radius: var(--r-2); box-shadow: var(--p-shadow); padding: 10px 12px; font: 14px/1.4 var(--font-ui); }
.ic-statcard header { display: grid; grid-template-columns: 1fr auto; gap: 0 8px; align-items: start; margin-bottom: 6px; }
.ic-statcard header small { grid-column: 1; text-transform: uppercase; letter-spacing: .08em; font-size: 11px; color: var(--k-monster); font-weight: 700; }
.ic-statcard header b { grid-column: 1; font: 700 20px var(--font-head); }
.ic-statcard header i { grid-column: 1; color: var(--p-ink-2); font-size: 13px; }
.ic-statcard header button { grid-column: 2; grid-row: 1 / span 3; background: none; border: 0; font-size: 22px; color: var(--p-ink-2); cursor: pointer; }
.ic-statcard footer { margin-top: 8px; padding-top: 6px; border-top: 1px solid var(--p-hair); font-size: 11px; color: var(--p-ink-2); }
.ic-statcard p { margin: 4px 0; }
.ic-dock .rl { background: none; border: 0; padding: 0; font: inherit; color: var(--k-monster); text-decoration: underline wavy color-mix(in srgb, var(--k-monster) 55%, transparent); text-underline-offset: 3px; cursor: pointer; }
.ic-dock .rl.condition { color: var(--k-condition); text-decoration-style: dashed; }
.ic-dock .rl.rule { color: var(--k-rules); text-decoration-style: dotted; }
</style>
<script type="application/json" id="srd-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
<script>(function(){var run=function(){${js.replace(/<\/script/gi, '<\\/script')}};document.readyState==='loading'?addEventListener('DOMContentLoaded',run):run();})();</script>
`;
writeFileSync(out, page);
console.log(`${out}: ${(page.length / 1024 / 1024).toFixed(2)} MB`);
