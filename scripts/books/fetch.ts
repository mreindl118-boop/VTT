// Download the pinned sources into scripts/books/.cache (gitignored) and verify each SHA-256.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Source } from '../../app/src/books/types.ts';

export const CACHE = join(import.meta.dirname, '.cache');
export const SOURCES_FILE = join(import.meta.dirname, 'sources.json');

export function loadSources(): Source[] {
  return (JSON.parse(readFileSync(SOURCES_FILE, 'utf8')) as { sources: Source[] }).sources;
}

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

async function download(url: string): Promise<Buffer> {
  // curl honours the container's proxy and CA settings; fall back to fetch where curl is missing.
  try { return execFileSync('curl', ['-fsSL', '--retry', '3', url], { maxBuffer: 64 * 1024 * 1024 }); } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

/** Path of a verified local copy of a source, downloading it if needed. Throws on a hash mismatch. */
export async function fetchSource(s: Source, offline = false): Promise<string> {
  mkdirSync(CACHE, { recursive: true });
  const file = join(CACHE, `${s.id}${s.url.match(/\.[a-z0-9]+$/i)?.[0] ?? ''}`);
  if (existsSync(file) && sha(readFileSync(file)) === s.sha256) return file;
  if (offline) throw new Error(`${s.id}: not in ${CACHE} and --offline was given`);
  process.stdout.write(`  downloading ${s.id} … `);
  const body = await download(s.url);
  const got = sha(body);
  if (got !== s.sha256) throw new Error(`${s.id}: SHA-256 mismatch\n  expected ${s.sha256}\n  got      ${got}\n  from ${s.url}`);
  writeFileSync(file, body);
  console.log(`${(body.length / 1024).toFixed(0)} KB ok`);
  return file;
}
