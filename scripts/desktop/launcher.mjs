// A per-user loopback host. Downloaded releases contain web assets only.
import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { readFile, stat, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, sep, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

export const PORT = 5642;
export const ORIGIN = `http://127.0.0.1:${PORT}`;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async path => JSON.parse(await readFile(path, 'utf8'));

export function installedDirectory(root, entry) {
  if (!entry || !/^versions\/[0-9]+\.[0-9]+\.[0-9]+-[a-f0-9]{7,40}$/.test(entry.directory)) throw new Error('Invalid installed release directory');
  const dir = resolve(root, entry.directory);
  if (!dir.startsWith(resolve(root) + sep)) throw new Error('Release directory escapes installation');
  return dir;
}

export async function verifyInstalled(root, entry) {
  const dir = installedDirectory(root, entry);
  const manifest = await json(resolve(dir, 'release-manifest.json'));
  const raw = await readFile(resolve(dir, 'tested-dist-fingerprint.json'));
  if (manifest.version !== entry.version || manifest.fingerprintSha256 !== digest(raw)) throw new Error('Installed manifest does not match release');
  const files = JSON.parse(raw);
  const allow = new Set();
  for (const file of files) {
    if (!file.path || file.path.includes('\\') || file.path.split('/').some(p => !p || p === '.' || p === '..' || /[:\x00-\x1f]/.test(p))) throw new Error('Invalid installed file path');
    const content = await readFile(resolve(dir, 'dist', file.path));
    if (content.length !== file.bytes || digest(content) !== file.sha256) throw new Error(`Installed file failed integrity check: ${file.path}`);
    allow.add('/' + file.path);
  }
  if (!allow.has('/index.html')) throw new Error('Missing app entry point');
  return { dir, manifest, allow };
}

export async function startDesktop(root, options = {}) {
  root = resolve(root);
  const port = options.port ?? PORT; // Test harnesses use an isolated origin; the installed entry point is fixed.
  const origin = `http://127.0.0.1:${port}`;
  const config = await json(resolve(root, 'install.json'));
  const log = async message => appendFile(resolve(root, 'desktop.log'), `${new Date().toISOString()} ${message}\n`).catch(() => {});
  let release = null;
  const server = http.createServer(async (req, res) => {
    if (req.headers.host !== `127.0.0.1:${port}` || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(403); res.end(); return; }
    const url = new URL(req.url, origin);
    if (url.pathname === '/__mistlab_desktop_status') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ app: 'mistLAB-desktop', protocol: 1, installId: config.installId, version: release?.manifest.version ?? null, pid: process.pid })); return;
    }
    if (url.pathname === '/__mistlab_desktop_start') {
      // Existing same-origin workers can control a ?nosw page. Unregister only this
      // dedicated app origin before navigating; never clear campaign storage/caches.
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(`<!doctype html><title>Starting mistLAB</title><p>Starting mistLAB...</p><script>(async()=>{try{if('serviceWorker'in navigator){for(const r of await navigator.serviceWorker.getRegistrations()){if(new URL(r.scope).origin===location.origin)await r.unregister();}}location.replace('/?nosw');}catch(e){document.querySelector('p').textContent='mistLAB could not prepare its local profile. Close this window and try again.';}})();</script>`); return;
    }
    // A Player Display URL can omit nosw. The local host already provides offline
    // assets and atomic updates, so it never installs the website cache worker.
    if (url.pathname === '/sw.js') { res.writeHead(404); res.end('Desktop releases are served locally'); return; }
    if (!release) { res.writeHead(503, { 'Retry-After': '1' }); res.end('Starting mistLAB'); return; }
    try {
      let pathname = decodeURIComponent(url.pathname);
      if (pathname === '/') pathname = '/index.html';
      // Serve the exact inventory only. The profile, updater and state are never exposed.
      if (!release.allow.has(pathname)) { res.writeHead(404); res.end('Not found'); return; }
      const path = resolve(release.dir, 'dist', '.' + pathname);
      const info = await stat(path);
      res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream', 'Content-Length': info.size, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      if (req.method === 'HEAD') res.end(); else createReadStream(path).on('error', () => res.destroy()).pipe(res);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  function openWindow() {
    const spawnBrowser = options.spawnBrowser ?? ((exe, args) => spawn(exe, args, { windowsHide: false, stdio: 'ignore' }));
    const child = spawnBrowser(config.edge, [`--app=${origin}/__mistlab_desktop_start`, `--user-data-dir=${resolve(root, 'profile')}`, '--no-first-run', '--disable-background-mode']);
    child.once('error', e => { void log(`Browser failed: ${e.message}`); server.close(); });
    return child;
  }
  try {
    await new Promise((ok, fail) => { server.once('error', fail); server.listen(port, '127.0.0.1', ok); });
  } catch (e) {
    if (e.code !== 'EADDRINUSE') throw e;
    let status;
    try { status = await (await fetch(`${origin}/__mistlab_desktop_status`, { signal: AbortSignal.timeout(2500) })).json(); } catch { /* foreign process: fail without touching it */ }
    const isOurs = value => value?.app === 'mistLAB-desktop' && value.protocol === 1 && value.installId === config.installId;
    if (!isOurs(status)) throw new Error(`Port ${port} is occupied by another application. No process was stopped.`);
    const deadline = Date.now() + 55000;
    while (!status.version) {
      if (Date.now() >= deadline) throw new Error('mistLAB is still checking its release. Try the shortcut again shortly.');
      await new Promise(ok => setTimeout(ok, 200));
      status = await (await fetch(`${origin}/__mistlab_desktop_status`, { signal: AbortSignal.timeout(2500) })).json();
      if (!isOurs(status)) throw new Error('The local app host changed while starting.');
    }
    if (options.open !== false) openWindow().unref();
    return { existing: true, status };
  }
  try {
    // The port is the single-instance lock. Updates finish before any app window opens.
    if (options.update !== false && existsSync(resolve(root, 'updater.mjs'))) {
      try {
        const updater = await import(pathToFileURL(resolve(root, 'updater.mjs')).href);
        const outcome = await updater.checkForUpdate(root);
        await log(`Update check: ${outcome.reason}${outcome.error ? '; ' + outcome.error : ''}`);
      } catch (e) { await log(`Update deferred; keeping installed release: ${e.message}`); }
    }
    let state = await json(resolve(root, 'state.json'));
    try { release = await verifyInstalled(root, state.current); }
    catch (e) {
      if (!state.previous || state.previous.storageCompatibility !== state.current.storageCompatibility) throw e;
      release = await verifyInstalled(root, state.previous);
      await log(`Current files failed verification; this session uses retained ${state.previous.version}. ${e.message}`);
    }
    await log(`Opened verified mistLAB ${release.manifest.version}`);
    if (options.open !== false) {
      const child = openWindow();
      child.once('exit', () => server.close());
    }
    return { existing: false, server, release, close: () => new Promise(ok => server.close(ok)) };
  } catch (e) { server.close(); throw e; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = dirname(fileURLToPath(import.meta.url));
  startDesktop(root).catch(async error => {
    await appendFile(resolve(root, 'desktop.log'), `${new Date().toISOString()} ERROR ${error.message}\n`).catch(() => {});
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  });
}
