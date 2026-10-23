// Run only after the source release, full GPU checks and exact-source main CI pass.
// This creates a static distribution commit and an immutable annotated tag; it never moves main.
import { readFile, readdir, lstat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { validateManifest } from './updater.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const [manifestPath, fingerprintPath, push] = process.argv.slice(2);
if (!manifestPath || !fingerprintPath || (push && push !== '--push')) throw new Error('Usage: node scripts/desktop/publish.mjs <release-manifest.json> <tested-dist-fingerprint.json> [--push]');
const manifestBytes = await readFile(resolve(manifestPath));
const fingerprintBytes = await readFile(resolve(fingerprintPath));
const manifest = JSON.parse(manifestBytes);
const files = validateManifest(manifest, fingerprintBytes);
const git = (args, input) => {
  const result = spawnSync('git', args, { cwd: repo, input, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args[0]} failed`);
  return result.stdout.trim();
};
const source = manifest.sourceCommit, tag = `desktop-v${manifest.version}`;
git(['fetch', 'origin']);
git(['merge-base', '--is-ancestor', source, 'origin/claude/mistlab-curse-strahd-x6jm13']);
if (JSON.parse(git(['show', `${source}:package.json`])).version !== manifest.version) throw new Error('Source release version does not match');
if (git(['tag', '--list', tag])) throw new Error('Desktop tag already exists; immutable release tags are never replaced');
if (git(['ls-remote', '--tags', 'origin', `refs/tags/${tag}`])) throw new Error('Desktop tag is already published');

const ciUrl = `https://api.github.com/repos/mreindl118-boop/VTT/actions/workflows/ci.yml/runs?head_sha=${source}&event=push&branch=${encodeURIComponent('claude/mistlab-curse-strahd-x6jm13')}&per_page=100`;
const response = await fetch(ciUrl, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'mistLAB-desktop-publisher', Accept: 'application/vnd.github+json' } });
if (!response.ok) throw new Error(`Cannot verify release CI (${response.status})`);
const runs = (await response.json()).workflow_runs.filter(r => r.head_sha === source && r.head_branch === 'claude/mistlab-curse-strahd-x6jm13' && r.event === 'push' && r.path === '.github/workflows/ci.yml' && r.repository?.full_name === 'mreindl118-boop/VTT');
runs.sort((a,b) => b.run_number-a.run_number || b.run_attempt-a.run_attempt);
if (runs[0]?.status !== 'completed' || runs[0]?.conclusion !== 'success') throw new Error('Exact-source main CI is not successful yet');

const expected = new Set(files.map(f => f.path));
async function walk(dir, prefix = '') {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const name = prefix + item.name;
    if (item.isSymbolicLink()) throw new Error('No links in a desktop release');
    if (item.isDirectory()) await walk(resolve(dir,item.name), name+'/');
    else if (!item.isFile() || !expected.has(name)) throw new Error('Unexpected build file: '+name);
  }
}
await walk(resolve(repo,'dist'));
const content = new Map([['release-manifest.json',manifestBytes],['tested-dist-fingerprint.json',fingerprintBytes]]);
for (const file of files) {
  const path = resolve(repo,'dist',file.path), info = await lstat(path), bytes = await readFile(path);
  if (!info.isFile() || info.isSymbolicLink() || bytes.length!==file.bytes || createHash('sha256').update(bytes).digest('hex')!==file.sha256) throw new Error('Tested build differs: '+file.path);
  content.set('dist/'+file.path,bytes);
}
const tree = new Map();
for (const [path,bytes] of content) {
  const parts=path.split('/'); let level=tree;
  for (const part of parts.slice(0,-1)) { if (!level.has(part)) level.set(part,new Map()); level=level.get(part); }
  level.set(parts.at(-1),git(['hash-object','-w','--stdin'],bytes));
}
function writeTree(map) {
  const entries=[...map.entries()].map(([name,value])=>value instanceof Map ? `040000 tree ${writeTree(value)}\t${name}\0` : `100644 blob ${value}\t${name}\0`).join('');
  return git(['mktree','-z'],entries);
}
const message=`Package tested mistLAB ${manifest.version} for desktop updates\n\nStatic files exactly match the frozen full-GPU-tested fingerprint.\nSource: ${source}\nMain CI: ${runs[0].html_url}\n\nCo-Authored-By: ChatGPT <noreply@openai.com>\nAgent: ChatGPT (continuing item 2)\n`;
const commit=git(['commit-tree',writeTree(tree),'-p',source],message);
git(['tag','-a',tag,commit,'-F','-'],message);
if (push==='--push') git(['push','origin',`refs/tags/${tag}`]);
console.log(JSON.stringify({tag,distributionCommit:commit,sourceCommit:source,ci:runs[0].html_url,fileCount:files.length,pushed:push==='--push'},null,2));
