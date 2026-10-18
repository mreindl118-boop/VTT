import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { startDesktop } from './launcher.mjs';

const hash = b => createHash('sha256').update(b).digest('hex');
const writeJson = (p, data) => writeFile(p, JSON.stringify(data));
async function release(root, version, text) {
  const directory = `versions/${version}-aaaaaaa`, dir = join(root, directory);
  await mkdir(join(dir, 'dist'), { recursive: true });
  const file = Buffer.from(text), fingerprint = Buffer.from(JSON.stringify([{ path: 'index.html', sha256: hash(file), bytes: file.length }]));
  await writeFile(join(dir, 'dist/index.html'), file);
  await writeFile(join(dir, 'tested-dist-fingerprint.json'), fingerprint);
  await writeJson(join(dir, 'release-manifest.json'), { version, fingerprintSha256: hash(fingerprint) });
  return { version, directory, distributionCommit: 'a'.repeat(40), storageCompatibility: 'same-schema' };
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'mistlab-desktop-test-'));
  await writeJson(join(root, 'install.json'), { installId: randomUUID(), edge: 'not-launched-in-test' });
  const current = await release(root, '0.3.0', '<title>mistLAB 0.3.0</title>');
  await writeJson(join(root, 'state.json'), { current, previous: null });
  await mkdir(join(root, 'profile'));
  await writeFile(join(root, 'profile/do-not-touch'), 'campaign-data');
  const listener = http.createServer();
  await new Promise(ok => listener.listen(0, '127.0.0.1', ok));
  const port = listener.address().port;
  await new Promise(ok => listener.close(ok));
  return { root, current, port, origin: `http://127.0.0.1:${port}` };
}
const launch = f => startDesktop(f.root, { open: false, update: false, port: f.port });
const request = (f, path, options = {}) => new Promise((ok, fail) => {
  const req = http.request(`${f.origin}${path}`, options, res => { let body = ''; res.on('data', b => body += b); res.on('end', () => ok({ status: res.statusCode, body, headers: res.headers })); });
  req.on('error', fail); req.end();
});

test('desktop serves the verified inventory over loopback and preserves the profile', async () => {
  const f = await fixture(), app = await launch(f);
  try {
    assert.equal(app.server.address().address, '127.0.0.1');
    const response = await request(f, '/?nosw');
    assert.equal(response.status, 200); assert.match(response.body, /0\.3\.0/);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(await readFile(join(f.root, 'profile/do-not-touch'), 'utf8'), 'campaign-data');
  } finally { await app.close(); }
});
test('desktop rejects foreign Host, writes, traversal and private installation files', async () => {
  const f = await fixture(), app = await launch(f);
  try {
    assert.equal((await request(f, '/', { headers: { Host: 'attacker.example' } })).status, 403);
    assert.equal((await request(f, '/', { method: 'POST' })).status, 403);
    assert.equal((await request(f, '/sw.js')).status, 404);
    for (const path of ['/state.json', '/profile/do-not-touch', '/launcher.mjs', '/%2e%2e%2fstate.json', '/%5c..%5cstate.json']) assert.equal((await request(f, path)).status, 404);
  } finally { await app.close(); }
});
test('corrupt current assets are rejected before any app is served', async () => {
  const f = await fixture();
  await writeFile(join(f.root, f.current.directory, 'dist/index.html'), 'corrupt');
  await assert.rejects(launch(f), /integrity check/);
});
test('a retained compatible release can recover before opening a corrupt update', async () => {
  const f = await fixture(), previous = await release(f.root, '0.2.1', '<title>retained</title>');
  await writeJson(join(f.root, 'state.json'), { current: f.current, previous });
  await writeFile(join(f.root, f.current.directory, 'dist/index.html'), 'corrupt');
  const app = await launch(f);
  try { assert.equal(app.release.manifest.version, '0.2.1'); assert.match((await request(f, '/')).body, /retained/); }
  finally { await app.close(); }
});
test('rollback never crosses a declared storage-compatibility boundary', async () => {
  const f = await fixture(), previous = await release(f.root, '0.2.1', '<title>old</title>');
  previous.storageCompatibility = 'incompatible';
  await writeJson(join(f.root, 'state.json'), { current: f.current, previous });
  await writeFile(join(f.root, f.current.directory, 'dist/index.html'), 'corrupt');
  await assert.rejects(launch(f), /integrity check/);
});
test('the current app stays pinned for the session; restart selects the next release', async () => {
  const f = await fixture(), next = await release(f.root, '0.4.0', '<title>next test release</title>');
  let app = await launch(f);
  try {
    await writeJson(join(f.root, 'state.json'), { current: next, previous: f.current });
    assert.match((await request(f, '/')).body, /0\.3\.0/);
  } finally { await app.close(); }
  app = await launch(f);
  try { assert.match((await request(f, '/')).body, /next test release/); }
  finally { await app.close(); }
});
test('concurrent launch reuses this installation without another server or update', async () => {
  const f = await fixture(), first = launch(f), second = launch(f);
  const apps = await Promise.all([first, second]);
  try { assert.equal(apps.filter(a => a.existing).length, 1); assert.equal(apps.find(a => a.existing).status.version, '0.3.0'); }
  finally { await apps.find(a => !a.existing).close(); }
});
test('an occupied port belonging to another program is preserved and reported', async () => {
  const f = await fixture(), other = http.createServer((req, res) => res.end('{}'));
  await new Promise(ok => other.listen(f.port, '127.0.0.1', ok));
  try { await assert.rejects(launch(f), /occupied by another application/); assert.equal(other.listening, true); }
  finally { await new Promise(ok => other.close(ok)); }
});
