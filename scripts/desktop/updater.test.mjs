import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseVersion, validateManifest, extractReleaseZip, discoverRelease, stageRelease, readState, writeState, checkForUpdate } from './updater.mjs';

const source = 'a'.repeat(40), distribution = 'c'.repeat(40), tagSha = 'b'.repeat(40);
const main = 'claude/mistlab-curse-strahd-x6jm13', repository = 'mreindl118-boop/VTT';
const hash = data => createHash('sha256').update(data).digest('hex');
function release(version = '0.3.0', customFiles) {
  const contents = customFiles ?? { 'index.html': Buffer.from('<title>mistLAB</title>'), 'assets/app.js': Buffer.from('window.fixture=true;') };
  const files = Object.entries(contents).map(([path, data]) => ({ path, bytes: data.length, sha256: hash(data), data }));
  const fingerprintBytes = Buffer.from(JSON.stringify(files.map(({ data, ...f }) => f)));
  const manifest = { schema: 1, repository, version, sourceCommit: source, testedImplementation: source,
    fingerprintSha256: hash(fingerprintBytes), storageCompatibility: 'mistlab-idb1-2026-10',
    verification: { buildPassed: true, unitsPassed: true, fullGpuPassed: true, finalReviewPassed: true,
      units: { passed: 519, todo: 2, skipped: 0 }, gpu: { passed: 257, skippedByDevice: 55, failed: 0 } } };
  return { manifest, manifestBytes: Buffer.from(JSON.stringify(manifest)), fingerprintBytes, files, distributionCommit: distribution };
}
function crc(data) { let c = 0xffffffff; for (const b of data) { c ^= b; for (let i = 0; i < 8; i++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; } return (c ^ 0xffffffff) >>> 0; }
function zip(entries) {
  const local = [], central = []; let offset = 0;
  for (const [name, data, mode = 0o100644] of entries) {
    const n = Buffer.from(name), h = Buffer.alloc(30), d = Buffer.alloc(46), checksum = crc(data);
    h.writeUInt32LE(0x04034b50); h.writeUInt16LE(20, 4); h.writeUInt32LE(checksum, 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(n.length, 26);
    d.writeUInt32LE(0x02014b50); d.writeUInt16LE(0x0314, 4); d.writeUInt16LE(20, 6); d.writeUInt32LE(checksum, 16); d.writeUInt32LE(data.length, 20); d.writeUInt32LE(data.length, 24); d.writeUInt16LE(n.length, 28); d.writeUInt32LE((mode * 65536) >>> 0, 38); d.writeUInt32LE(offset, 42);
    local.push(h, n, data); central.push(d, n); offset += h.length + n.length + data.length;
  }
  const c = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(c.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, c, end]);
}
function entries(r) { return [[`VTT-${distribution}/release-manifest.json`, r.manifestBytes], [`VTT-${distribution}/tested-dist-fingerprint.json`, r.fingerprintBytes], ...r.files.map(f => [`VTT-${distribution}/dist/${f.path}`, f.data])]; }
const extract = (r, list = entries(r)) => extractReleaseZip(zip(list), distribution, r.manifestBytes, r.fingerprintBytes);
const rootFixture = () => mkdtemp(join(tmpdir(), 'mistlab-update-test-'));
const initial = (version = '0.2.1') => ({ current: { version, directory: `versions/${version}-${source.slice(0,7)}`, distributionCommit: null, sourceCommit: source, storageCompatibility: 'mistlab-idb1-2026-10' }, previous: null, lastCheck: null });

test('only canonical stable semantic versions are eligible', () => {
  assert.deepEqual(parseVersion('0.3.0'), [0,3,0]);
  for (const v of ['v0.3.0','0.3.0-beta','01.3.0','0.3','99999999999999999999.1.0']) assert.equal(parseVersion(v), null);
});
test('release metadata binds exact tested bytes and complete successful gates', () => {
  const r = release(); assert.equal(validateManifest(r.manifest, r.fingerprintBytes).length, 2);
  assert.throws(() => validateManifest(r.manifest, Buffer.from('[]')), /fingerprint mismatch/);
  const bad = structuredClone(r.manifest); bad.verification.fullGpuPassed = false;
  assert.throws(() => validateManifest(bad, r.fingerprintBytes), /verification is incomplete/);
});
test('duplicated verification pins must agree with the manifest identity', () => {
  for (const [key,value] of [['testedImplementation','d'.repeat(40)],['distFingerprintSha256','d'.repeat(64)]]) {
    const r=release(); r.manifest.verification[key]=value;
    assert.throws(()=>validateManifest(r.manifest,r.fingerprintBytes), /verification.*(identity|fingerprint)/i);
  }
});
test('Windows unsafe paths, native executables and case collisions are rejected', () => {
  for (const path of ['../escape.js', '/absolute.js', 'a\\b.js', 'a.js:stream', 'CON.txt', 'dir./x.js', 'native.exe']) {
    const r = release('0.3.0', { 'index.html': Buffer.from('ok'), [path]: Buffer.from('bad') });
    assert.throws(() => validateManifest(r.manifest, r.fingerprintBytes));
  }
  const duplicate = release('0.3.0', { 'index.html': Buffer.from('ok'), 'Index.html': Buffer.from('collision') });
  assert.throws(() => validateManifest(duplicate.manifest, duplicate.fingerprintBytes), /Duplicate/);
});
test('complete ZIP passes; missing, extra, modified and linked entries fail closed', () => {
  const r = release(), good = entries(r);
  assert.equal(extract(r).length, 2);
  assert.throws(() => extract(r, good.slice(0,-1)), /Incomplete/);
  assert.throws(() => extract(r, [...good, [`VTT-${distribution}/extra.exe`, Buffer.from('bad')]]), /Unexpected/);
  const altered = good.map(e => [...e]); altered[3][1] = Buffer.from('modified');
  assert.throws(() => extract(r, altered), /hash mismatch/);
  const linked = good.map(e => [...e]); linked[3][2] = 0o120777;
  assert.throws(() => extract(r, linked), /links or special/);
  assert.throws(() => extract(r, [...good, [`VTT-${distribution}/../escape.js`, Buffer.from('bad')]]), /Unsafe/);
});
test('corrupt archive offsets and unaccounted payload cannot be extracted', () => {
  const r = release(), archive = zip(entries(r));
  archive.writeUInt32LE(0xfffffff0, archive.length - 22 + 16);
  assert.throws(() => extractReleaseZip(archive, distribution, r.manifestBytes, r.fingerprintBytes));
  assert.throws(() => extractReleaseZip(Buffer.concat([Buffer.from('junk'), zip(entries(r))]), distribution, r.manifestBytes, r.fingerprintBytes));
});
test('verified update atomically keeps the old release and never touches the profile', async () => {
  const root = await rootFixture(), before = initial(), r = release();
  await writeState(root, before); await mkdir(join(root,'profile')); await writeFile(join(root,'profile/campaign'), 'preserve');
  const result = await checkForUpdate(root, { discover: async () => r });
  assert.equal(result.updated, true); assert.deepEqual(result.state.previous, before.current);
  assert.equal((await readState(root)).current.version, '0.3.0');
  assert.equal(await readFile(join(root,'profile/campaign'),'utf8'), 'preserve');
});
test('offline discovery or a corrupt update leaves the exact prior pointer intact', async () => {
  const root = await rootFixture(), before = initial(); await writeState(root, before);
  const original = await readFile(join(root,'state.json'));
  assert.equal((await checkForUpdate(root, { discover: async () => { throw new Error('offline'); } })).updated, false);
  const r = release(); r.files[0].data = Buffer.from('corrupt');
  assert.equal((await checkForUpdate(root, { discover: async () => r })).updated, false);
  assert.deepEqual(await readFile(join(root,'state.json')), original);
});
test('partial staging, same-version tags and downgrades never replace the installed release', async () => {
  const root = await rootFixture(); await writeState(root, initial('0.3.0'));
  await mkdir(join(root,'versions/.staging-interrupted'), { recursive:true }); await writeFile(join(root,'versions/.staging-interrupted/partial'), 'incomplete');
  for (const v of ['0.3.0','0.2.1']) assert.equal((await checkForUpdate(root,{ discover:async()=>release(v) })).updated, false);
  assert.equal((await readState(root)).current.version, '0.3.0');
});
test('a failed stage is never accepted just because its destination exists', async () => {
  const root = await rootFixture(), r = release();
  const directory = await stageRelease(root,r);
  await writeFile(join(root,directory,'dist/index.html'), 'corrupt');
  await assert.rejects(stageRelease(root,r), /file (size|hash) differs/);
});

async function withGitHub(t, options, fn) {
  const r = release(), calls = [], original = globalThis.fetch;
  globalThis.fetch = async url => {
    const u = new URL(url), p = u.pathname; calls.push(u.href);
    let result;
    if (p.endsWith('/git/matching-refs/tags/desktop-v')) result = [{ref:'refs/tags/desktop-v0.3.0',object:{type:'tag',sha:tagSha}}];
    else if (p.endsWith(`/git/tags/${tagSha}`)) result = {sha:tagSha,tag:'desktop-v0.3.0',object:{type:'commit',sha:distribution}};
    else if (p.endsWith(`/git/commits/${distribution}`)) result = {sha:distribution,parents:[{sha:options.parent ?? source}]};
    else if (p.includes('/git/ref/heads/')) result = {object:{type:'commit',sha:source}};
    else if (p.includes('/compare/')) result = {status:options.ancestry ?? 'identical',merge_base_commit:{sha:source}};
    else if (p.endsWith('/actions/workflows/ci.yml/runs')) result = {workflow_runs:[{head_sha:options.ciSha ?? source,event:'push',head_branch:main,path:'.github/workflows/ci.yml',repository:{full_name:repository},run_number:1,run_attempt:1,status:options.status ?? 'completed',conclusion:options.conclusion ?? 'success'}]};
    else if (u.hostname==='raw.githubusercontent.com' && p.endsWith('/release-manifest.json')) return new Response(r.manifestBytes);
    else if (u.hostname==='raw.githubusercontent.com' && p.endsWith('/tested-dist-fingerprint.json')) return new Response(r.fingerprintBytes);
    else if (p.endsWith('/package.json')) result={version:options.version ?? '0.3.0'};
    else if (u.hostname==='codeload.github.com') return new Response(zip(entries(r)));
    else throw new Error('Unexpected URL: '+u.href);
    return new Response(JSON.stringify(result));
  };
  try { await fn(calls); } finally { globalThis.fetch=original; }
}
test('production discovery accepts only the annotated release with exact-source successful main CI', async t => {
  await withGitHub(t,{},async()=>{const r=await discoverRelease();assert.equal(r.distributionCommit,distribution);assert.equal(r.files.length,2);});
});
test('pending, failed or different-source CI never downloads an update archive', async t => {
  for (const options of [{status:'in_progress'},{conclusion:'failure'},{ciSha:'d'.repeat(40)}]) {
    await withGitHub(t,options,async calls=>{await assert.rejects(discoverRelease(), /CI has not completed/);assert.equal(calls.some(u=>u.includes('codeload')),false);});
  }
});
test('off-main source, wrong parent and mismatched source version are rejected', async t => {
  for (const options of [{ancestry:'diverged'},{parent:'d'.repeat(40)},{version:'0.3.1'}]) await withGitHub(t,options,async()=>{await assert.rejects(discoverRelease());});
});
