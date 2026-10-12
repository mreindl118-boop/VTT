// The theme's colour tokens (docs/THEME.md 'Tokens'), checked the way the approved prototype's token checks did:
// the four rules families stay apart (also for protan and deutan vision) and off the page accents, family text and
// rarities read on every page surface, the seal ink reads on every seal stop, and the bundled assets are credited.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { EMBLEM_IDS } from '../app/src/ui/kinds';

// ---- colour maths: WCAG contrast, CIEDE2000, Machado 2009 colour-vision simulation (severity 1, linear RGB)
const h2rgb = (c: string) => { const h = c.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); };
const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const unlin = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const rgb2h = (r: number[]) => `#${r.map((x) => Math.max(0, Math.min(255, Math.round(x * 255))).toString(16).padStart(2, '0')).join('')}`;
const lum = (c: string) => { const [r, g, b] = h2rgb(c).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const cr = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const lab = (c: string) => {
  const [r, g, b] = h2rgb(c).map(lin);
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = [f(X), f(Y), f(Z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};
const rad = (d: number) => (d * Math.PI) / 180, deg = (r: number) => (r * 180) / Math.PI;
function de2000(c1: string, c2: string): number {
  const [L1, a1, b1] = lab(c1), [L2, a2, b2] = lab(c2);
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2, C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h1p = (deg(Math.atan2(b1, a1p)) + 360) % 360, h2p = (deg(Math.atan2(b2, a2p)) + 360) % 360;
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp / 2));
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  const hbp = C1p * C2p === 0 ? h1p + h2p : Math.abs(h1p - h2p) <= 180 ? (h1p + h2p) / 2 : h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
  const T = 1 - 0.17 * Math.cos(rad(hbp - 30)) + 0.24 * Math.cos(rad(2 * hbp)) + 0.32 * Math.cos(rad(3 * hbp + 6)) - 0.2 * Math.cos(rad(4 * hbp - 63));
  const dth = 30 * Math.exp(-(((hbp - 275) / 25) ** 2)), Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2), Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T, Rt = -Math.sin(rad(2 * dth)) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}
const MACHADO = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
};
const cvd = (c: string, k: keyof typeof MACHADO) => { const v = h2rgb(c).map(lin), m = MACHADO[k]; return rgb2h(m.map((row) => unlin(Math.max(0, Math.min(1, row[0] * v[0] + row[1] * v[1] + row[2] * v[2]))))); };

// ---- the token block in styles.css
const css = readFileSync('app/src/styles.css', 'utf8');
const tokenBlock = css.slice(css.indexOf('/* ==== THEME TOKENS'), css.indexOf('/* ==== end of the theme tokens'));
function block(sel: string, from = tokenBlock): Record<string, string> {
  const i = from.indexOf(`${sel} {`);
  if (i < 0) throw new Error(`no block ${sel}`);
  const body = from.slice(i + sel.length + 2, from.indexOf('}', i));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}
const root = block(':root');
const cos = block(":root, [data-campaign='cos']"), wsc = block("[data-campaign='wsc']");
const cosd = { ...cos, ...block(":root[data-theme='dark'], :root[data-theme='dark'] [data-campaign='cos']") };
const wscd = { ...wsc, ...block(":root[data-theme='dark'] [data-campaign='wsc']") };
const THEMES = { cos, 'cos-dark': cosd, wsc, 'wsc-dark': wscd } as Record<string, Record<string, string>>;
const hexes = (s: string) => s.match(/#[0-9a-fA-F]{6}/g) ?? [];
const FAM = ['condition', 'magic', 'monster', 'rules'] as const;
const L = Object.fromEntries(FAM.map((f) => [f, root[`--k-${f}-l`]])) as Record<string, string>;
const D = Object.fromEntries(FAM.map((f) => [f, root[`--k-${f}-d`]])) as Record<string, string>;
const famOf = (t: string) => (t.endsWith('dark') ? D : L);
const surfaces = (th: Record<string, string>) => [th['--p-bg'], th['--p-raise'], ...hexes(th['--p-grad'])];
const CANDLE = '#f2b35b';
const pairs = <T,>(xs: readonly T[]) => xs.flatMap((a, i) => xs.slice(i + 1).map((b) => [a, b] as const));

describe('theme tokens', () => {
  it('the colour maths matches the prototype checks (reference values)', () => {
    expect(de2000('#b1a8ee', '#ed85b3')).toBeCloseTo(22.29, 1);
    expect(de2000(cvd('#b1a8ee', 'protan'), cvd('#ed85b3', 'protan'))).toBeCloseTo(11.48, 1);
    expect(cr('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });
  it('the dark gates repeat the same values (prefers-color-scheme and data-theme)', () => {
    const media = tokenBlock.slice(tokenBlock.indexOf('@media (prefers-color-scheme: dark)'));
    expect(block(":root:not([data-theme='light']), :root:not([data-theme='light']) [data-campaign='cos']", media)).toEqual(block(":root[data-theme='dark'], :root[data-theme='dark'] [data-campaign='cos']"));
    expect(block(":root:not([data-theme='light']) [data-campaign='wsc']", media)).toEqual(block(":root[data-theme='dark'] [data-campaign='wsc']"));
    for (const t of Object.values(THEMES)) for (const k of ['--p-bg', '--p-raise', '--p-ink', '--p-ink-2', '--p-accent', '--p-grad', '--seal', '--seal-ink']) expect(t[k], k).toBeTruthy();
  });
  for (const [name, fam] of [['light', L], ['dark', D]] as const) {
    it(`${name} families are at least 15 dE2000 apart, and at least 8 under protan and deutan`, () => {
      for (const [a, b] of pairs(FAM)) {
        expect(de2000(fam[a], fam[b]), `${a}-${b}`).toBeGreaterThanOrEqual(15);
        for (const k of ['protan', 'deutan'] as const) expect(de2000(cvd(fam[a], k), cvd(fam[b], k)), `${a}-${b} ${k}`).toBeGreaterThanOrEqual(8);
      }
    });
  }
  it('every family is at least 15 from the page accents and candle amber, and at least 10 from ink-2, in all four themes', () => {
    for (const [t, th] of Object.entries(THEMES)) for (const f of FAM) {
      const c = famOf(t)[f];
      expect(de2000(c, th['--p-accent']), `${t} ${f} vs accent`).toBeGreaterThanOrEqual(15);
      expect(de2000(c, CANDLE), `${t} ${f} vs candle`).toBeGreaterThanOrEqual(15);
      expect(de2000(c, th['--p-ink-2']), `${t} ${f} vs ink-2`).toBeGreaterThanOrEqual(10);
    }
  });
  it('family text is at least 4.5:1 on the page, its raise and both gradient stops, in all four themes', () => {
    for (const [t, th] of Object.entries(THEMES)) {
      expect(surfaces(th)).toHaveLength(4);
      for (const f of FAM) for (const s of surfaces(th)) expect(cr(famOf(t)[f], s), `${t} ${f} on ${s}`).toBeGreaterThanOrEqual(4.5);
      // The sunk well too, so a rules link stays readable in any inset panel.
      for (const f of FAM) expect(cr(famOf(t)[f], th['--p-sunk']), `${t} ${f} on sunk`).toBeGreaterThanOrEqual(4.5);
      for (const s of surfaces(th)) expect(cr(th['--p-ink'], s), `${t} ink`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('every rarity is at least 4.5:1 on its page', () => {
    for (const [t, th] of Object.entries(THEMES)) for (const r of ['common', 'uncommon', 'rare', 'veryrare', 'legendary', 'artifact']) {
      const c = root[`--r-${r}-${t.endsWith('dark') ? 'd' : 'l'}`];
      for (const s of surfaces(th)) expect(cr(c, s), `${t} ${r} on ${s}`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('the seal ink is at least 4.5:1 on every seal stop', () => {
    for (const [t, th] of Object.entries(THEMES)) {
      expect(hexes(th['--seal'])).toHaveLength(3);
      for (const s of hexes(th['--seal'])) expect(cr(th['--seal-ink'], s), `${t} seal on ${s}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('bundled fonts and emblems', () => {
  const dir = 'app/public/fonts';
  const files = readdirSync(dir);
  const credits = readFileSync(`${dir}/CREDITS.txt`, 'utf8');
  it('CREDITS.txt names every font file, every licence file and every emblem', () => {
    for (const f of files.filter((f) => f.endsWith('.woff2') || (f.endsWith('.txt') && f !== 'CREDITS.txt'))) expect(credits, f).toContain(f);
    for (const id of EMBLEM_IDS) expect(credits, id).toContain(id);
    expect(files.filter((f) => f.endsWith('.woff2'))).toHaveLength(6);
    expect(files.filter((f) => /^OFL-.*\.txt$/.test(f))).toHaveLength(5);
    expect(files).toContain('game-icons-license.txt');
  });
  it('all bundled woff2 files total 162,000 B or less', () => {
    const total = files.filter((f) => f.endsWith('.woff2')).reduce((n, f) => n + statSync(`${dir}/${f}`).size, 0);
    expect(total).toBeLessThanOrEqual(162_000);
  });
  it('the sprite holds exactly the 20 emblems the kinds use', () => {
    const svg = readFileSync('app/src/ui/emblems.svg', 'utf8');
    const ids = [...svg.matchAll(/id="gi-([a-z0-9-]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(20);
    expect([...ids].sort()).toEqual([...EMBLEM_IDS].sort());
  });
  it('the font faces swap and are not preloaded', () => {
    const faces = css.match(/@font-face \{[^}]*\}/g) ?? [];
    expect(faces).toHaveLength(6);
    for (const f of faces) expect(f).toContain('font-display: swap');
    expect(readFileSync('app/index.html', 'utf8')).not.toMatch(/preload/);
  });
});
