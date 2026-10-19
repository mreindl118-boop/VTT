// Generated maps: a boundary override (an opening, a door, a material) must land on the wall segments the generator
// actually emits. Axis-aligned room edges are split into 5-ft cells, so an override keyed on a whole edge used to
// match nothing and the wall stayed (review G11). Runs the Amber Temple generator into a temp folder.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type Pt = [number, number];
interface Wall { id: string; a: Pt; b: Pt; flags: string[] }
interface Level { id: string; walls: Wall[] }

const ROOT = resolve(__dirname, '..');
let dir = '';
let levels: Level[] = [];
let unmatched: Record<string, string[]> | null = null;

/** Length (ft) over which two segments lie on one line and overlap; 0 when they only touch or cross. */
function overlap(p: Pt, q: Pt, a: Pt, b: Pt): number {
  const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz);
  const ux = dx / L, uz = dz / L;
  const off = (r: Pt) => Math.abs((r[0] - p[0]) * uz - (r[1] - p[1]) * ux);   // distance from the line p-q
  if (off(a) > 0.05 || off(b) > 0.05) return 0;
  const t = (r: Pt) => (r[0] - p[0]) * ux + (r[1] - p[1]) * uz;
  const lo = Math.max(0, Math.min(t(a), t(b))), hi = Math.min(L, Math.max(t(a), t(b)));
  return Math.max(0, hi - lo);
}

describe('authoring overrides reach the emitted wall segments (Amber Temple)', () => {
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'mistlab-x-'));
    // the interpreter the repo's scripts run with: 'python3' on Linux and macOS, the py launcher on Windows
    const [py, pre] = process.platform === 'win32' ? ['py', ['-3']] : ['python3', []];
    const out = execFileSync(py, [...pre, join(ROOT, 'scripts/authoring/amber-temple.py')], {
      cwd: ROOT, env: { ...process.env, MISTLAB_OUT: dir }, encoding: 'utf8',
    });
    const line = out.split('\n').find((l) => l.startsWith('unmatched overrides: '));
    unmatched = line ? JSON.parse(line.slice('unmatched overrides: '.length)) : null;
    levels = JSON.parse(readFileSync(join(dir, 'scene.json'), 'utf8')).levels;
  }, 120_000);
  afterAll(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

  it('leaves the broken edge of the X23 balcony open (a drop, not a wall)', () => {
    // X23's broken edge in feet: squares (7.5,-18) (7,-17.5) (5.5,-17.5) (5,-17) (5,-16) (4,-16) on the book's grid
    const edge: Pt[] = [[115, 120], [110, 125], [95, 125], [90, 130], [90, 140], [80, 140]];
    const upper = levels.find((l) => l.id === 'upper')!;
    const hits: string[] = [];
    for (let i = 0; i + 1 < edge.length; i++) {
      for (const w of upper.walls) if (overlap(edge[i], edge[i + 1], w.a, w.b) > 0.01) hits.push(w.id);
    }
    expect(hits).toEqual([]);
  });

  it('reports no override that matched no emitted segment', () => {
    expect(unmatched).not.toBeNull();
    expect(Object.values(unmatched!).flat()).toEqual([]);
  });

  it('still lands doors on their edges', () => {
    const ids = new Set(levels.flatMap((l) => l.walls.map((w) => w.id)));
    for (const id of ['X22-east-doors', 'X24-south-doors', 'X10-west-doors', 'X15-doors']) expect(ids.has(id), id).toBe(true);
  });
});
