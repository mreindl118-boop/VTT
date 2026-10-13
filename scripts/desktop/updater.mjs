// Desktop updates contain static web assets only. This installed module never updates itself.
import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';

const REPOSITORY = 'mreindl118-boop/VTT';
const MAIN = 'claude/mistlab-curse-strahd-x6jm13';
const COMPATIBILITY = 'mistlab-idb1-2026-10';
const SHA = /^[0-9a-f]{40}$/;
const HASH = /^[0-9a-f]{64}$/;
const MAX_ARCHIVE = 128 * 1024 * 1024;
const MAX_TOTAL = 256 * 1024 * 1024;
const MAX_FILE = 64 * 1024 * 1024;
const MAX_METADATA = 2 * 1024 * 1024;
const MAX_FILES = 4096;
const HOSTS = new Set(['api.github.com', 'raw.githubusercontent.com', 'codeload.github.com']);
const STATIC_EXTENSIONS = new Set(['.html', '.js', '.css', '.json', '.md', '.txt', '.svg',
  '.webmanifest', '.woff', '.woff2', '.ttf', '.otf', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.ico']);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const count = (value) => Number.isSafeInteger(value) && value >= 0;

/** Strict stable versions only; prereleases never enter the desktop channel. */
export function parseVersion(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) return null;
  const parts = value.split('.').map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}

function compareVersions(a, b) {
  const left = parseVersion(a), right = parseVersion(b);
  requireThat(left && right, 'Invalid release version');
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  return 0;
}

function safePath(value) {
  requireThat(typeof value === 'string' && value.length > 0 && value.length <= 220,
    'Invalid archive path');
  requireThat(!/[\x00-\x1f\x7f-\uffff\\:<>"|?*]/.test(value), 'Unsafe archive path');
  for (const part of value.split('/')) {
    requireThat(part && part !== '.' && part !== '..' && !/[. ]$/.test(part), 'Unsafe path segment');
    requireThat(!/^(CON|PRN|AUX|NUL|CONIN\$|CONOUT\$|COM[1-9]|LPT[1-9])(?:[. ]|$)/i.test(part), 'Reserved Windows path');
  }
  return value;
}

function parseJson(raw, label) {
  const bytes = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
  requireThat(bytes.length <= MAX_METADATA, `${label} is too large`);
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new Error(`Invalid ${label}`); }
}

/** Returns fingerprint records, with paths relative to dist/. */
export function validateManifest(manifest, rawFingerprint) {
  requireThat(object(manifest) && manifest.schema === 1 && manifest.repository === REPOSITORY,
    'Unrecognized desktop release manifest');
  requireThat(parseVersion(manifest.version) && SHA.test(manifest.sourceCommit) &&
    SHA.test(manifest.testedImplementation), 'Invalid release identity');
  requireThat(manifest.storageCompatibility === COMPATIBILITY, 'Unsupported save compatibility');
  requireThat(HASH.test(manifest.fingerprintSha256) && hash(rawFingerprint) === manifest.fingerprintSha256,
    'Tested build fingerprint mismatch');
  const verification = manifest.verification;
  requireThat(object(verification) && ['buildPassed', 'unitsPassed', 'fullGpuPassed', 'finalReviewPassed']
    .every((key) => verification[key] === true), 'Release verification is incomplete');
  requireThat(verification.testedImplementation === undefined || verification.testedImplementation === manifest.testedImplementation,
    'Verification identity differs from release manifest');
  requireThat(verification.distFingerprintSha256 === undefined || verification.distFingerprintSha256 === manifest.fingerprintSha256,
    'Verification fingerprint differs from release manifest');
  requireThat(object(verification.units) && count(verification.units.passed) && verification.units.passed > 0 &&
    count(verification.units.todo) && verification.units.skipped === 0 &&
    (verification.units.failed === undefined || verification.units.failed === 0), 'Unit verification failed');
  requireThat(object(verification.gpu) && count(verification.gpu.passed) && verification.gpu.passed > 0 &&
    count(verification.gpu.skippedByDevice) && verification.gpu.failed === 0, 'GPU verification failed');
  const files = parseJson(rawFingerprint, 'tested build fingerprint');
  requireThat(Array.isArray(files) && files.length > 0 && files.length <= MAX_FILES, 'Invalid fingerprint inventory');
  const names = new Set();
  let total = 0;
  for (const file of files) {
    requireThat(object(file), 'Invalid fingerprint record');
    safePath(file.path);
    requireThat(STATIC_EXTENSIONS.has(path.posix.extname(file.path).toLowerCase()), 'Non-static release file');
    requireThat(!names.has(file.path.toLowerCase()), 'Duplicate release path');
    names.add(file.path.toLowerCase());
    requireThat(HASH.test(file.sha256) && count(file.bytes) && file.bytes <= MAX_FILE, 'Invalid file fingerprint');
    total += file.bytes;
    requireThat(total <= MAX_TOTAL, 'Release is too large');
  }
  requireThat(files.some((file) => file.path === 'index.html'), 'Release has no index.html');
  // Windows cannot represent a file and a containing directory with the same name.
  for (const name of names) {
    let parent = path.posix.dirname(name);
    while (parent !== '.') {
      requireThat(!names.has(parent), 'Release file/directory collision');
      parent = path.posix.dirname(parent);
    }
  }
  return files;
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let bit = 0; bit < 8; bit++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Validates a complete GitHub ZIP before exposing any bytes to the filesystem. */
export function extractReleaseZip(zipBytes, commit, manifestRawBytes, fingerprintRawBytes) {
  const zip = Buffer.from(zipBytes);
  requireThat(SHA.test(commit) && zip.length >= 22 && zip.length <= MAX_ARCHIVE, 'Invalid release archive');
  const manifest = parseJson(manifestRawBytes, 'release manifest');
  const inventory = validateManifest(manifest, fingerprintRawBytes);
  const expected = new Map([
    ['release-manifest.json', Buffer.from(manifestRawBytes)],
    ['tested-dist-fingerprint.json', Buffer.from(fingerprintRawBytes)],
    ...inventory.map((file) => [`dist/${file.path}`, file]),
  ]);
  const prefix = `VTT-${commit}/`;
  let end = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50 && i + 22 + zip.readUInt16LE(i + 20) === zip.length) { end = i; break; }
  }
  requireThat(end >= 0, 'ZIP end record missing');
  const entries = zip.readUInt16LE(end + 10);
  const centralSize = zip.readUInt32LE(end + 12), centralStart = zip.readUInt32LE(end + 16);
  requireThat(zip.readUInt16LE(end + 4) === 0 && zip.readUInt16LE(end + 6) === 0 &&
    zip.readUInt16LE(end + 8) === entries && entries > 0 && entries <= MAX_FILES * 2 &&
    centralStart + centralSize === end, 'Unsupported ZIP layout');
  const seen = new Set(), found = new Map(), intervals = [];
  let cursor = centralStart, total = 0;
  for (let i = 0; i < entries; i++) {
    requireThat(cursor + 46 <= end && zip.readUInt32LE(cursor) === 0x02014b50, 'Invalid ZIP directory');
    const flags = zip.readUInt16LE(cursor + 8), method = zip.readUInt16LE(cursor + 10);
    const crc = zip.readUInt32LE(cursor + 16), packed = zip.readUInt32LE(cursor + 20), size = zip.readUInt32LE(cursor + 24);
    const nameLength = zip.readUInt16LE(cursor + 28), extraLength = zip.readUInt16LE(cursor + 30), commentLength = zip.readUInt16LE(cursor + 32);
    const attributes = zip.readUInt32LE(cursor + 38), offset = zip.readUInt32LE(cursor + 42);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    requireThat(next <= end && nameLength > 0 && zip.readUInt16LE(cursor + 34) === 0 &&
      offset !== 0xffffffff && packed !== 0xffffffff && size !== 0xffffffff, 'Unsupported ZIP entry');
    requireThat((flags & ~0x808) === 0 && (method === 0 || method === 8), 'Encrypted or unsupported ZIP entry');
    const nameBytes = zip.subarray(cursor + 46, cursor + 46 + nameLength);
    let name;
    try { name = new TextDecoder('utf-8', { fatal: true }).decode(nameBytes); }
    catch { throw new Error('Invalid ZIP filename'); }
    const directory = name.endsWith('/');
    safePath(directory ? name.slice(0, -1) : name);
    requireThat(name.startsWith(prefix), 'Archive root does not match distribution commit');
    const relative = name.slice(prefix.length);
    requireThat(!seen.has(name.replace(/\/$/, '').toLowerCase()), 'Duplicate ZIP path');
    seen.add(name.replace(/\/$/, '').toLowerCase());
    const type = (attributes >>> 16) & 0xf000;
    requireThat(type === 0 || type === (directory ? 0x4000 : 0x8000), 'ZIP links or special files are forbidden');
    if (directory) {
      requireThat(size === 0 && (relative === '' || relative === 'dist/' ||
        [...expected.keys()].some((key) => key.startsWith(relative))), 'Unexpected archive directory');
    } else requireThat(expected.has(relative), 'Unexpected archive file');
    total += size;
    requireThat(size <= MAX_FILE && total <= MAX_TOTAL + 2 * MAX_METADATA && size <= packed * 250 + 524288,
      'Oversized or over-compressed ZIP entry');
    requireThat(offset + 30 <= centralStart && zip.readUInt32LE(offset) === 0x04034b50,
      'Invalid ZIP local header');
    requireThat(zip.readUInt16LE(offset + 6) === flags && zip.readUInt16LE(offset + 8) === method,
      'Conflicting ZIP headers');
    const localNameLength = zip.readUInt16LE(offset + 26), localExtraLength = zip.readUInt16LE(offset + 28);
    const dataStart = offset + 30 + localNameLength + localExtraLength, dataEnd = dataStart + packed;
    requireThat(dataEnd <= centralStart && localNameLength === nameLength &&
      zip.subarray(offset + 30, offset + 30 + localNameLength).equals(nameBytes), 'Conflicting ZIP filename or offset');
    let recordEnd = dataEnd;
    if (flags & 8) {
      requireThat(dataEnd + 12 <= centralStart, 'Missing ZIP data descriptor');
      const descriptor = zip.readUInt32LE(dataEnd) === 0x08074b50 ? dataEnd + 4 : dataEnd;
      requireThat(descriptor + 12 <= centralStart && zip.readUInt32LE(descriptor) === crc &&
        zip.readUInt32LE(descriptor + 4) === packed && zip.readUInt32LE(descriptor + 8) === size,
      'Invalid ZIP data descriptor');
      recordEnd = descriptor + 12;
      for (const [at, value] of [[14, crc], [18, packed], [22, size]]) {
        requireThat(zip.readUInt32LE(offset + at) === 0 || zip.readUInt32LE(offset + at) === value,
          'Conflicting ZIP sizes');
      }
    } else requireThat(zip.readUInt32LE(offset + 14) === crc && zip.readUInt32LE(offset + 18) === packed &&
      zip.readUInt32LE(offset + 22) === size, 'Conflicting ZIP sizes');
    intervals.push([offset, recordEnd]);
    const compressed = zip.subarray(dataStart, dataEnd);
    let data;
    if (method === 0) data = Buffer.from(compressed);
    else {
      const inflated = inflateRawSync(compressed, { maxOutputLength: Math.max(1, size), info: true });
      requireThat(inflated.engine.bytesWritten === packed, 'Trailing compressed data');
      data = inflated.buffer;
    }
    requireThat(data.length === size && crc32(data) === crc, 'Corrupt ZIP data');
    if (!directory) {
      const record = expected.get(relative);
      if (Buffer.isBuffer(record)) requireThat(data.equals(record), 'Archive metadata changed after verification');
      else requireThat(data.length === record.bytes && hash(data) === record.sha256, 'Release asset hash mismatch');
      found.set(relative, data);
    }
    cursor = next;
  }
  requireThat(cursor === end && found.size === expected.size, 'Incomplete release archive');
  let boundary = 0;
  for (const [start, finish] of intervals.sort((a, b) => a[0] - b[0])) {
    requireThat(start === boundary && finish >= start, 'Overlapping or unaccounted ZIP data');
    boundary = finish;
  }
  requireThat(boundary === centralStart, 'Unaccounted ZIP payload');
  return inventory.map((file) => ({ ...file, data: found.get(`dist/${file.path}`) }));
}

async function download(url, limit = MAX_METADATA, redirects = 0) {
  const target = new URL(url);
  requireThat(target.protocol === 'https:' && HOSTS.has(target.hostname) && !target.username &&
    !target.password && !target.port && redirects <= 3, 'Untrusted update URL');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(target, { redirect: 'manual', signal: controller.signal,
      headers: { Accept: target.hostname === 'api.github.com' ? 'application/vnd.github+json' : '*/*',
        'User-Agent': 'mistLAB-desktop-updater', 'X-GitHub-Api-Version': '2022-11-28' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get('location');
      requireThat(location, 'Update redirect has no destination');
      return await download(new URL(location, target).href, limit, redirects + 1);
    }
    requireThat(response.ok, `Update request failed (${response.status})`);
    const length = response.headers.get('content-length');
    requireThat(length === null || (/^\d+$/.test(length) && Number(length) <= limit), 'Update download is too large');
    requireThat(response.body, 'Empty update response');
    const chunks = [];
    let total = 0;
    for await (const chunk of response.body) {
      total += chunk.length;
      requireThat(total <= limit, 'Update download exceeded its size limit');
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  } finally { clearTimeout(timer); controller.abort(); }
}

const api = async (suffix) => parseJson(await download(`https://api.github.com/repos/${REPOSITORY}/${suffix}`), 'GitHub response');
const raw = (commit, name) => download(`https://raw.githubusercontent.com/${REPOSITORY}/${commit}/${name}`);

/** Only this fixed public repository and its annotated desktop tags are eligible. */
export async function discoverRelease({ afterVersion = null } = {}) {
  requireThat(afterVersion === null || parseVersion(afterVersion), 'Invalid installed version hint');
  const refs = await api('git/matching-refs/tags/desktop-v');
  requireThat(Array.isArray(refs), 'Invalid desktop tag list');
  const tags = refs.filter((ref) => typeof ref.ref === 'string' && ref.ref.startsWith('refs/tags/desktop-v') &&
    parseVersion(ref.ref.slice('refs/tags/desktop-v'.length)) && ref.object?.type === 'tag' && SHA.test(ref.object.sha));
  if (tags.length === 0) return null;
  const versionOf = (ref) => ref.ref.slice('refs/tags/desktop-v'.length);
  tags.sort((a, b) => compareVersions(versionOf(b), versionOf(a)));
  if (afterVersion !== null && compareVersions(versionOf(tags[0]), afterVersion) <= 0) return null;
  const ref = tags[0], tagName = ref.ref.slice('refs/tags/'.length);
  const tag = await api(`git/tags/${ref.object.sha}`);
  requireThat(tag.sha === ref.object.sha && tag.tag === tagName && tag.object?.type === 'commit' &&
    SHA.test(tag.object.sha), 'Desktop tag is not an annotated commit tag');
  const distributionCommit = tag.object.sha;
  const [manifestBytes, fingerprintBytes, commit] = await Promise.all([
    raw(distributionCommit, 'release-manifest.json'), raw(distributionCommit, 'tested-dist-fingerprint.json'),
    api(`git/commits/${distributionCommit}`),
  ]);
  const manifest = parseJson(manifestBytes, 'release manifest');
  validateManifest(manifest, fingerprintBytes);
  requireThat(tagName === `desktop-v${manifest.version}` && commit.sha === distributionCommit &&
    Array.isArray(commit.parents) && commit.parents.length === 1 && commit.parents[0].sha === manifest.sourceCommit,
    'Distribution does not directly reference its release source');
  const main = await api(`git/ref/heads/${MAIN}`);
  requireThat(main.object?.type === 'commit' && SHA.test(main.object.sha), 'Main branch identity unavailable');
  const [ancestry, sourcePackage, runs, implementation] = await Promise.all([
    api(`compare/${manifest.sourceCommit}...${main.object.sha}`),
    raw(manifest.sourceCommit, 'package.json').then((bytes) => parseJson(bytes, 'source package')),
    api(`actions/workflows/ci.yml/runs?head_sha=${manifest.sourceCommit}&event=push&branch=${encodeURIComponent(MAIN)}&per_page=100`),
    manifest.testedImplementation === manifest.sourceCommit ? null :
      api(`compare/${manifest.testedImplementation}...${manifest.sourceCommit}`),
  ]);
  requireThat(['ahead', 'identical'].includes(ancestry.status) && ancestry.merge_base_commit?.sha === manifest.sourceCommit,
    'Release source is not on main');
  requireThat(sourcePackage.version === manifest.version, 'Release version differs from source');
  requireThat(implementation === null || (['ahead', 'identical'].includes(implementation.status) &&
    implementation.merge_base_commit?.sha === manifest.testedImplementation), 'Tested implementation is not in the release');
  requireThat(Array.isArray(runs.workflow_runs), 'Source CI evidence unavailable');
  const matching = runs.workflow_runs.filter((run) => run.head_sha === manifest.sourceCommit && run.event === 'push' &&
    run.head_branch === MAIN && run.path === '.github/workflows/ci.yml' &&
    run.repository?.full_name === REPOSITORY);
  matching.sort((a, b) => b.run_number - a.run_number || b.run_attempt - a.run_attempt);
  requireThat(matching[0]?.status === 'completed' && matching[0]?.conclusion === 'success',
    'Exact release source CI has not completed successfully');
  const zip = await download(`https://codeload.github.com/${REPOSITORY}/zip/${distributionCommit}`, MAX_ARCHIVE);
  const files = extractReleaseZip(zip, distributionCommit, manifestBytes, fingerprintBytes);
  return { manifest, manifestBytes, fingerprintBytes, files, distributionCommit };
}

async function plainDirectory(dir) {
  const stat = await fs.lstat(dir);
  requireThat(stat.isDirectory() && !stat.isSymbolicLink(), 'Release directory must not be a link');
}

function sameInventory(expected, supplied) {
  if (!Array.isArray(supplied) || supplied.length !== expected.length ||
    !supplied.every((file) => object(file) && typeof file.path === 'string')) return false;
  const byPath = new Map(supplied.map((file) => [file.path, file]));
  if (byPath.size !== supplied.length) return false;
  return expected.every((file) => {
    const other = byPath.get(file.path);
    return other && other.sha256 === file.sha256 && other.bytes === file.bytes;
  });
}

/** Checks the exact on-disk inventory; no stale or additional files are accepted. */
export async function verifyReleaseDir(dir, manifest, files) {
  await plainDirectory(dir);
  async function metadata(name) {
    const file = path.join(dir, name), stat = await fs.lstat(file);
    requireThat(stat.isFile() && !stat.isSymbolicLink() && stat.size <= MAX_METADATA, 'Unsafe release metadata');
    return fs.readFile(file);
  }
  const manifestBytes = await metadata('release-manifest.json');
  const fingerprintBytes = await metadata('tested-dist-fingerprint.json');
  const savedManifest = parseJson(manifestBytes, 'installed release manifest');
  const inventory = validateManifest(savedManifest, fingerprintBytes);
  requireThat(isDeepStrictEqual(savedManifest, manifest), 'Installed release manifest differs');
  requireThat(sameInventory(inventory, files), 'Installed release inventory differs');
  const expected = new Map(inventory.map((file) => [`dist/${file.path}`, file]));
  expected.set('release-manifest.json', { bytes: manifestBytes.length, sha256: hash(manifestBytes) });
  expected.set('tested-dist-fingerprint.json', { bytes: fingerprintBytes.length, sha256: hash(fingerprintBytes) });
  const seen = new Set();
  async function walk(folder, prefix = '') {
    for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
      const relative = `${prefix}${entry.name}`;
      safePath(relative);
      requireThat(!entry.isSymbolicLink(), 'Installed release contains a link');
      if (entry.isDirectory()) {
        requireThat([...expected.keys()].some((name) => name.startsWith(`${relative}/`)), 'Unexpected release directory');
        await walk(path.join(folder, entry.name), `${relative}/`);
      } else {
        requireThat(entry.isFile() && expected.has(relative), 'Unexpected installed file');
        const record = expected.get(relative), fullPath = path.join(folder, entry.name);
        const stat = await fs.lstat(fullPath);
        requireThat(stat.isFile() && !stat.isSymbolicLink() && stat.size === record.bytes, 'Installed file size differs');
        requireThat(hash(await fs.readFile(fullPath)) === record.sha256, 'Installed file hash differs');
        seen.add(relative);
      }
    }
  }
  await walk(dir);
  requireThat(seen.size === expected.size, 'Installed release is incomplete');
  return true;
}

/** Returns a root-relative directory. Failed staging folders are retained for diagnosis. */
export async function stageRelease(root, release) {
  requireThat(object(release) && SHA.test(release.distributionCommit), 'Invalid distribution identity');
  const manifest = parseJson(release.manifestBytes, 'release manifest');
  const inventory = validateManifest(manifest, release.fingerprintBytes);
  requireThat(isDeepStrictEqual(manifest, release.manifest), 'Release metadata differs');
  requireThat(Array.isArray(release.files) && release.files.length === inventory.length, 'Release files are incomplete');
  const supplied = new Map(release.files.map((file) => [file.path, file]));
  requireThat(supplied.size === inventory.length, 'Duplicate release files');
  for (const record of inventory) {
    const file = supplied.get(record.path);
    requireThat(file && Buffer.isBuffer(file.data) && file.data.length === record.bytes &&
      hash(file.data) === record.sha256, 'Unverified release bytes');
  }
  await fs.mkdir(root, { recursive: true });
  await plainDirectory(root);
  const versions = path.join(root, 'versions');
  await fs.mkdir(versions, { recursive: true });
  await plainDirectory(versions);
  const relative = `versions/${manifest.version}-${release.distributionCommit.slice(0, 7)}`;
  const destination = path.join(root, relative);
  let exists = false;
  try { await fs.lstat(destination); exists = true; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (exists) {
    await verifyReleaseDir(destination, manifest, inventory);
    return relative;
  }
  const staging = path.join(versions, `.staging-${randomUUID()}`);
  await fs.mkdir(staging);
  await fs.writeFile(path.join(staging, 'release-manifest.json'), release.manifestBytes, { flag: 'wx' });
  await fs.writeFile(path.join(staging, 'tested-dist-fingerprint.json'), release.fingerprintBytes, { flag: 'wx' });
  for (const record of inventory) {
    const target = path.join(staging, 'dist', record.path);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, supplied.get(record.path).data, { flag: 'wx' });
  }
  await verifyReleaseDir(staging, manifest, inventory);
  await fs.rename(staging, destination);
  return relative;
}

function validateState(state) {
  requireThat(object(state) && (state.lastCheck === null || typeof state.lastCheck === 'string'), 'Invalid desktop state');
  for (const entry of [state.current, state.previous]) {
    if (entry === null || entry === undefined) continue;
    requireThat(object(entry) && parseVersion(entry.version) && entry.storageCompatibility === COMPATIBILITY &&
      (entry.distributionCommit === null ? SHA.test(entry.sourceCommit) : SHA.test(entry.distributionCommit)),
    'Invalid installed version');
    const commit = entry.distributionCommit ?? entry.sourceCommit;
    requireThat(entry.directory === `versions/${entry.version}-${commit.slice(0, 7)}`, 'Unsafe installed version directory');
  }
  requireThat(state.current !== undefined, 'Desktop state has no current version');
  return state;
}

export async function readState(root) {
  const file = path.join(root, 'state.json');
  try {
    const stat = await fs.lstat(file);
    requireThat(stat.isFile() && !stat.isSymbolicLink() && stat.size <= MAX_METADATA, 'Unsafe desktop state file');
    return validateState(parseJson(await fs.readFile(file), 'desktop state'));
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

/** Atomic replacement on the same volume; the prior file survives any pre-rename failure. */
export async function writeState(root, state) {
  validateState(state);
  await fs.mkdir(root, { recursive: true });
  await plainDirectory(root);
  const temporary = path.join(root, `.state-${randomUUID()}.tmp`);
  const handle = await fs.open(temporary, 'wx');
  try { await handle.writeFile(`${JSON.stringify(state, null, 2)}\n`); await handle.sync(); }
  finally { await handle.close(); }
  await fs.rename(temporary, path.join(root, 'state.json'));
}

/** An optional discovery function is an in-process test seam, never a CLI update URL. */
export async function checkForUpdate(root, { discover = discoverRelease } = {}) {
  const state = await readState(root);
  try {
    const release = await discover({ afterVersion: state?.current?.version ?? null });
    if (!release) return { state, updated: false, reason: 'No newer published desktop release' };
    if (state?.current && compareVersions(release.manifest.version, state.current.version) <= 0)
      return { state, updated: false, reason: 'Installed version is current' };
    if (state?.current && release.manifest.storageCompatibility !== state.current.storageCompatibility)
      return { state, updated: false, reason: 'Save compatibility requires a reviewed migration' };
    const directory = await stageRelease(root, release);
    const next = { current: { version: release.manifest.version, directory, distributionCommit: release.distributionCommit,
      sourceCommit: release.manifest.sourceCommit, storageCompatibility: release.manifest.storageCompatibility },
    previous: state?.current ?? null, lastCheck: new Date().toISOString() };
    await writeState(root, next);
    return { state: next, updated: true, reason: 'Verified release installed' };
  } catch (error) {
    return { state, updated: false, reason: 'Update unavailable; installed version retained', error: String(error.message ?? error) };
  }
}
