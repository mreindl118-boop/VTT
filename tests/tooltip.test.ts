// The tooltip manager's pure parts: the hold-exclusion selector covers every pointer-capture control, cards are
// placed clear of their anchor (or docked as a bottom sheet on a phone), and DM lines never reach a players' tip.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { HOLD_EXCLUDE, placeCard, renderTip } from '../app/src/ui/tooltip';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : /\.ts$/.test(f) ? [p] : []; });
}

// Each setPointerCapture call site, by file and receiver, and the selector that matches the element it captures on.
// A new call site fails this test until it is listed here and its selector is in HOLD_EXCLUDE.
const SITES: Record<string, { selector: string; proof: [file: string, text: string] }> = {
  'app/src/ui/viewSlider.ts:this.track': { selector: '.vs-track', proof: ['app/src/ui/viewSlider.ts', 'class="vs-track"'] },
  'app/src/ui/viewSlider.ts:peek': { selector: '.vs-peek', proof: ['app/src/ui/viewSlider.ts', 'class="vs-peek"'] },
  'app/src/ui/worldmap.ts:svg': { selector: '.world-svg', proof: ['app/src/ui/worldmap.ts', "class: 'world-svg'"] },
  'app/src/app.ts:el': { selector: 'canvas.gl', proof: ['app/src/render/world.ts', "domElement.classList.add('gl')"] },
};

describe('hold exclusion', () => {
  const list = HOLD_EXCLUDE.split(',').map((s) => s.trim());
  it('every setPointerCapture call site in app/src is matched by HOLD_EXCLUDE', () => {
    const found: string[] = [];
    for (const f of walk('app/src')) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/([\w.]+)\.setPointerCapture\(/g)) found.push(`${f.replace(/\\/g, '/')}:${m[1]}`);
    }
    expect(found.length).toBeGreaterThanOrEqual(4);
    for (const site of found) {
      expect(SITES[site], `unlisted pointer-capture site ${site}: add it to HOLD_EXCLUDE and to this table`).toBeDefined();
      expect(list, site).toContain(SITES[site].selector);
      const [file, text] = SITES[site].proof;
      expect(readFileSync(file, 'utf8'), `${site}: its element carries ${SITES[site].selector}`).toContain(text);
    }
  });
  it('also covers the minimap, every range input and [data-hold]', () => {
    for (const s of ['.mm-canvas', 'input[type=range]', '[data-hold]']) expect(list).toContain(s);
    expect(readFileSync('app/src/ui/minimap.ts', 'utf8')).toContain('class="mm-canvas"');
  });
});

describe('placeCard', () => {
  const vp = { w: 1024, h: 768 };
  const rect = (l: number, t: number, w = 60, h = 20) => ({ left: l, top: t, right: l + w, bottom: t + h, width: w, height: h });
  const hit = (a: ReturnType<typeof rect>, p: { x: number; y: number }, s: { w: number; h: number }) => p.x < a.right && p.x + s.w > a.left && p.y < a.bottom && p.y + s.h > a.top;
  it('prefers below, then above, right and left, never over the anchor and inside the viewport', () => {
    const size = { w: 340, h: 300 };
    const below = placeCard(rect(100, 100), size, vp);
    expect(below.side).toBe('below');
    const above = placeCard(rect(100, 600), size, vp);
    expect(above.side).toBe('above');
    const tall = { w: 340, h: 500 };
    const right = placeCard(rect(100, 300), tall, vp);
    expect(right.side).toBe('right');
    const left = placeCard(rect(900, 300), tall, vp);
    expect(left.side).toBe('left');
    for (const [a, p, s] of [[rect(100, 100), below, size], [rect(100, 600), above, size], [rect(100, 300), right, tall], [rect(900, 300), left, tall]] as const) {
      expect(hit(a, p, s)).toBe(false);
      expect(p.x).toBeGreaterThanOrEqual(8); expect(p.y).toBeGreaterThanOrEqual(8);
      expect(p.x + s.w).toBeLessThanOrEqual(vp.w - 8); expect(p.y + Math.min(s.h, p.maxH)).toBeLessThanOrEqual(vp.h - 8);
    }
  });
  it('stays under the top bar', () => {
    const p = placeCard(rect(100, 400), { w: 340, h: 300 }, { ...vp, minTop: 130 });
    expect(p.y).toBeGreaterThanOrEqual(130);
  });
  it('docks as a bottom sheet under 480 px', () => {
    const p = placeCard(rect(100, 400), { w: 340, h: 300 }, { w: 390, h: 844 });
    expect(p.side).toBe('sheet');
    expect(p.maxH).toBeLessThanOrEqual(844 / 2);
  });
});

describe('renderTip', () => {
  it('drops DM lines on the players\' side before building any string, and escapes every line', () => {
    const src = [{ text: 'Ghoul <b>', audience: 'dm' as const }, { text: 'A hunched thing', audience: 'player' as const }];
    expect(renderTip(src, { restricted: true })).toBe('<b>A hunched thing</b>');
    expect(renderTip(src, { restricted: false })).toBe('<b>Ghoul &lt;b&gt;</b><span class="sub">A hunched thing</span>');
    expect(renderTip([{ text: 'secret', audience: 'dm' }], { restricted: true })).toBe('');
  });
});

describe('the Player Display never loads the manager', () => {
  it('main.ts mounts tips only inside the DM UI', () => {
    const main = readFileSync('app/src/main.ts', 'utf8');
    const at = main.indexOf('mountTips(');
    expect(at).toBeGreaterThan(main.indexOf('function buildDmUi'));
    expect(main).toMatch(/if \(mode === 'dm'\) buildDmUi\(\);/);
  });
});
