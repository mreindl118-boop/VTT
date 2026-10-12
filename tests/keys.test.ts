// One keymap: the shortcuts are the same as before, every shortcut a tip shows is bound, and the handlers read the table.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { KEYMAP } from '../app/src/core/keys';

const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []; });

describe('KEYMAP', () => {
  it('binds exactly the keys bound before', () => {
    expect(Object.values(KEYMAP).map((k) => k.key).sort()).toEqual(['/', 'r', 'R', 'f', 'n', '[', ']', '\\', 'Escape'].sort());
  });
  it('every shortcut a tip shows (data-key) is in KEYMAP', () => {
    const used = walk('app/src').flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/data-key="([A-Za-z]+)"/g)].map((m) => m[1]));
    expect(used.length).toBeGreaterThanOrEqual(6);
    for (const k of used) expect(Object.keys(KEYMAP), k).toContain(k);
  });
  it("'Whole building' shows no shortcut", () => {
    const main = readFileSync('app/src/main.ts', 'utf8');
    const tag = /<button class="icon whole"[^>]*>/.exec(main)![0];
    expect(tag).not.toContain('data-key');
  });
  it('the keydown handlers read KEYMAP instead of their own key literals', () => {
    for (const f of ['app/src/main.ts', 'app/src/ui/viewSlider.ts']) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).toContain("from '../core/keys'".replace('../', f.endsWith('main.ts') ? './' : '../'));
      expect(src, f).not.toMatch(/e\.key === '(\/|r|R|f|n|\[|\]|\\\\|Escape)'/);
    }
  });
});
