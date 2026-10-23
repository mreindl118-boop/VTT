// The inked map's place symbols: small drawings of our own (inline SVG, no image file, no texture) standing over each
// place's pin, so the whole region reads with its towns, castles and camps, not just lettered discs. Drawn in a 3/4
// elevation with the base on the anchor, lit from the north-west (the east faces in shadow), outlined in the map's
// ink. Their colours come from CSS variables (styles.css: --g-wall, --g-roof, --g-stone, --g-stone2, --g-shade,
// --g-banner, --g-ink), so one drawing serves both campaigns' palettes. They live inside the pin's own label: a place
// the players do not know has no label at all, so it has no symbol either.

/** What kind of symbol a pin gets (none for roads, rivers, lakes, peaks, woods, crossroads and the like). */
export type GlyphKind = 'town' | 'village' | 'winery' | 'castle' | 'crag' | 'tower' | 'temple' | 'ruin' | 'camp' | 'mill' | 'gate' | 'den';

export function glyphKind(pin: { type: string; name: string; heightFt?: number }): GlyphKind | null {
  switch (pin.type) {
    case 'settlement': return /wine/i.test(pin.name) ? 'winery' : /\btown\b/i.test(pin.name) ? 'town' : 'village';
    case 'castle': return (pin.heightFt ?? 0) > 0 ? 'crag' : 'castle';
    case 'tower': case 'temple': case 'ruin': case 'camp': case 'gate': case 'den': return pin.type;
    case 'pass': return 'gate';
    case 'landmark': return /grinder|mill/i.test(pin.name) ? 'mill' : null;
    default: return null;
  }
}

/** Width in CSS px of each symbol (before the phone and Player Display scales, which CSS applies). */
export const GLYPH_PX: Record<GlyphKind, number> = { town: 44, village: 34, winery: 34, castle: 40, crag: 52, tower: 30, temple: 34, ruin: 30, camp: 30, mill: 32, gate: 30, den: 28 };

const f = (n: number) => Math.round(n * 10) / 10;
const poly = (pts: number[][], fill: string) => `<path d="M${pts.map((p) => `${f(p[0])} ${f(p[1])}`).join('L')}Z" fill="var(${fill})"/>`;
/** A house standing on y (its front face from x, w wide, h tall), its east side in shadow and a pitched roof. */
const house = (x: number, y: number, w: number, h: number, roof = '--g-roof', wall = '--g-wall'): string => {
  const s = w * 0.32, r = h * 0.85;
  return poly([[x + w, y], [x + w + s, y - 2], [x + w + s, y - h - 2], [x + w, y - h]], '--g-shade')
    + poly([[x, y], [x + w, y], [x + w, y - h], [x, y - h]], wall)
    + poly([[x - 1, y - h], [x + w / 2, y - h - r], [x + w + s + 1, y - h - 2]], roof);
};
/** A round tower (front and its shaded east half) with a cone roof, or crenels when flat. */
const tower = (cx: number, y: number, w: number, h: number, cone = true, stone = '--g-stone'): string => {
  const x = cx - w / 2;
  return poly([[x, y], [x + w, y], [x + w, y - h], [x, y - h]], stone)
    + poly([[cx + w * 0.15, y], [x + w, y], [x + w, y - h], [cx + w * 0.15, y - h]], '--g-shade')
    + (cone ? poly([[x - 1.5, y - h], [cx, y - h - w * 1.25], [x + w + 1.5, y - h]], '--g-roof')
      : poly([[x - 1, y - h], [x - 1, y - h - 3], [x + w * 0.3, y - h - 3], [x + w * 0.3, y - h - 1.2], [x + w * 0.7, y - h - 1.2], [x + w * 0.7, y - h - 3], [x + w + 1, y - h - 3], [x + w + 1, y - h]], stone));
};

const BODY: Record<GlyphKind, () => string> = {
  // a church tower among five houses
  town: () => house(2, 44, 9, 7) + house(30, 45, 9, 7) + tower(22, 40, 7, 20) + house(8, 46, 10, 8) + house(26, 46, 10, 8) + house(16, 47, 9, 7)
    + '<path d="M22 8v-5M20 5h4" fill="none"/>',
  village: () => house(4, 44, 11, 9) + house(28, 44, 11, 9) + house(15, 46, 12, 10),
  // vine rows on a slope and the winery's two houses
  winery: () => '<g fill="none" stroke-width="1.6"><path d="M3 46 15 40M8 47 20 41M13 48 25 42" stroke-dasharray="2 1.6"/></g>' + house(22, 42, 11, 9) + house(30, 47, 10, 8),
  // a curtain wall and three towers, a banner on the keep
  castle: () => poly([[6, 46], [40, 46], [40, 32], [6, 32]], '--g-stone') + poly([[40, 46], [44, 44], [44, 30], [40, 32]], '--g-shade')
    + tower(8, 46, 8, 22, false) + tower(38, 46, 8, 20, false) + tower(23, 38, 10, 28, false, '--g-stone')
    + '<path d="M23 7V1" fill="none"/>' + poly([[23, 1], [30, 2.5], [23, 4.5]], '--g-banner'),
  // Castle Ravenloft: a castle on its rock pillar (the hero symbol)
  crag: () => poly([[8, 50], [14, 30], [12, 22], [38, 22], [37, 31], [44, 50]], '--g-stone2') + poly([[30, 22], [38, 22], [37, 31], [44, 50], [34, 50]], '--g-shade')
    + '<path d="M17 34 20 44M28 30 30 42M23 26 22 32" fill="none" stroke-width="0.9"/>'
    + poly([[14, 22], [38, 22], [38, 14], [14, 14]], '--g-stone') + tower(14, 22, 6, 14) + tower(37, 22, 6, 12) + tower(26, 16, 8, 14)
    + '<path d="M26 -1V-5" fill="none"/>' + poly([[26, -5], [32, -3.6], [26, -2]], '--g-banner'),
  tower: () => tower(15, 46, 11, 30) + poly([[12, 30], [15, 30], [15, 34], [12, 34]], '--g-ink'),
  // a pediment on five columns over a step
  temple: () => poly([[4, 47], [44, 47], [44, 43], [4, 43]], '--g-stone') + [8, 15, 22, 29, 36].map((x) => poly([[x, 43], [x + 4, 43], [x + 4, 27], [x, 27]], x > 30 ? '--g-shade' : '--g-wall')).join('')
    + poly([[4, 27], [44, 27], [44, 24], [4, 24]], '--g-stone') + poly([[4, 24], [24, 13], [44, 24]], '--g-stone2'),
  // broken walls
  ruin: () => poly([[3, 46], [3, 30], [6, 27], [8, 32], [11, 29], [11, 46]], '--g-stone') + poly([[14, 46], [14, 36], [17, 33], [20, 37], [20, 46]], '--g-stone2')
    + poly([[22, 46], [22, 24], [25, 20], [27, 26], [29, 22], [29, 46]], '--g-stone') + poly([[29, 46], [32, 44], [32, 26], [29, 22]], '--g-shade'),
  // three tents and a fire
  camp: () => poly([[2, 44], [9, 31], [16, 44]], '--g-wall') + poly([[9, 31], [16, 44], [12, 44]], '--g-shade') + poly([[18, 46], [26, 30], [34, 46]], '--g-banner')
    + poly([[26, 30], [34, 46], [29, 46]], '--g-shade') + poly([[32, 42], [38, 32], [44, 42]], '--g-wall')
    + '<path d="M22 46h8" fill="none" stroke-width="1"/>' + poly([[24, 46], [26, 41], [28, 46]], '--g-fire'),
  // a windmill: a tapering body and four sails
  mill: () => poly([[11, 46], [25, 46], [22, 22], [14, 22]], '--g-wall') + poly([[19, 46], [25, 46], [22, 22], [18, 22]], '--g-shade') + poly([[12, 22], [18, 14], [24, 22]], '--g-roof')
    + '<g fill="var(--g-stone)"><path d="M18 18 4 6l2-2 14 12Z"/><path d="M18 18 32 6l2 2-14 12Z"/><path d="M18 18 6 30l-2-2 12-12Z"/><path d="M18 18 30 30l2-2-12-12Z"/></g>',
  // twin towers over an arch
  gate: () => tower(7, 46, 9, 26, false) + tower(29, 46, 9, 26, false) + poly([[11, 30], [25, 30], [25, 46], [22, 46], [22, 38], [18, 35], [14, 38], [14, 46], [11, 46]], '--g-stone'),
  // a cave mouth in a rocky mound
  den: () => poly([[2, 46], [8, 30], [16, 24], [26, 26], [34, 34], [40, 46]], '--g-stone2') + poly([[26, 26], [34, 34], [40, 46], [30, 46]], '--g-shade')
    + '<path d="M13 46v-6a7 7 0 0 1 14 0v6Z" fill="var(--g-ink)"/>',
};

/** The symbol's markup (an `svg` element string, `glyph` class), or '' for a pin with no symbol. */
export function glyphSvg(kind: GlyphKind | null): string {
  if (!kind) return '';
  const w = GLYPH_PX[kind], top = kind === 'crag' ? -8 : kind === 'castle' || kind === 'town' ? 0 : 4;
  return `<svg class="glyph g-${kind}" viewBox="0 ${top} 48 ${50 - top}" style="--gw:${w}px" aria-hidden="true"><g stroke="var(--g-ink)" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">${BODY[kind]()}</g></svg>`;
}
