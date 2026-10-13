// Rules links in module text (app/src/ui/terms.ts): the review list covers every link, the gold set scores precision
// and recall, the gazetteer keeps names whole, ordinary words need a cue, checks match the DC count, players never get a
// DM-only kind, and the overrides file and gold set hold module words only.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setBookFetcher } from '../app/src/books/store';
import { termIndex } from '../app/src/books/lookup';
import type { Edition, TermFile } from '../app/src/books/types';
import { corpusFields, loadBooks, REVIEW_DIR, REVIEW_INDEX, reviewFiles, reviewRows, reviewTable, ROOT, type Field, type Row } from '../scripts/terms-corpus';
import { DC_COUNT_RE, diceOf, homeOf, overridesFile, renderSpans, spansFor, type Audience, type Span } from '../app/src/ui/terms';
import { PLAYER_KINDS, type RuleKind } from '../app/src/ui/kinds';

interface GoldSpan { scene: string; entity: string; field: string; audience: Audience; start: number; end: number; text: string; link: boolean; kind: string; id?: string }
interface Gold { signedOff: boolean; edition: Edition; dc: { regex: string; count: number }; spans: GoldSpan[] }
const GOLD = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/terms-gold.json'), 'utf8')) as Gold;

let fields: Field[] = [];
let rows: Row[] = [];
const byKey = new Map<string, Field>();
const at = (scene: string, entity: string, field: string) => {
  const f = byKey.get(`${scene}|${entity}|${field}`);
  if (!f) throw new Error(`no field ${scene} ${entity} ${field}`);
  return f;
};
const links = (scene: string, entity: string, field: string, audience: Audience = 'dm', edition: Edition = '2024') =>
  spansFor(at(scene, entity, field).text, { audience, edition, field, scenePath: scene, entityId: entity });

beforeAll(async () => {
  await loadBooks();
  fields = corpusFields();
  for (const f of fields) byKey.set(`${f.scene}|${f.entity}|${f.field}`, f);
  rows = reviewRows(fields);
}, 60_000);
afterAll(() => setBookFetcher(null));

describe('the review list', () => {
  it('reads all 45 scenes, both world maps and the bestiary, for both audiences and both editions', () => {
    const scenes = new Set(fields.map((f) => f.scene));
    expect([...scenes].filter((s) => s !== 'bestiary' && s !== 'kinds' && !s.endsWith('-region')).length).toBe(45);
    expect(scenes).toContain('ch02/barovia-region');
    expect(scenes).toContain('wsc/00-region');
    expect(new Set(rows.map((r) => `${r.audience} ${r.edition}`))).toEqual(new Set(['dm 2024', 'dm 2014', 'player 2024', 'player 2014']));
  });
  it('docs/TERMS_REVIEW.md and its parts are current and their rows are exactly the spans spansFor returns', () => {
    const want = reviewFiles(rows, fields);
    expect(readdirSync(join(ROOT, REVIEW_DIR)).map((f) => `${REVIEW_DIR}/${f}`).sort(), 'run npm run terms:review').toEqual([...want.keys()].filter((p) => p !== REVIEW_INDEX).sort());
    for (const [path, text] of want) expect(readFileSync(join(ROOT, path), 'utf8'), `${path}: run npm run terms:review`).toBe(text);
    const md = readFileSync(join(ROOT, REVIEW_INDEX), 'utf8');
    const parts = [...want.keys()].filter((p) => p !== REVIEW_INDEX).map((p) => readFileSync(join(ROOT, p), 'utf8')).join('\n');
    const table = reviewTable(rows, fields);
    const lines = parts.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Where '));
    expect(lines.length).toBe(table.length);
    // Each row stands for its link in each object it names (×n) for each audience and edition it lists: together, every span once.
    expect(table.reduce((n, r) => n + r.entities.length * r.who.size, 0)).toBe(rows.length);
    expect(md).toContain(`Links: ${rows.length} in ${table.length} rows`);
  });
  it('no link is unreviewed: the overrides file accepts or decides every one', () => {
    const open = rows.filter((r) => r.status === 'unreviewed').map((r) => `${r.scene} ${r.entity} ${r.field}: ${r.span.text} → ${r.span.id ?? r.span.label}`);
    expect(open).toEqual([]);
  });
  it('every accepted key still links somewhere in its scene, and every override still finds its words', () => {
    const live = new Set(rows.map((r) => `${r.scene}|${r.span.id ?? `${r.span.kind}:${r.span.label}`}`));
    const stale = Object.entries(overridesFile.accepted).flatMap(([s, ks]) => ks.filter((k) => !live.has(`${s}|${k}`)).map((k) => `${s} ${k}`));
    expect(stale).toEqual([]);
    for (const o of overridesFile.overrides) expect(at(o.scene, o.entity, o.field).text, `${o.entity} ${o.match}`).toContain(o.match);
  });
  it('hit counts per kind per scene', () => {
    const counts: Record<string, Record<string, number>> = {};
    for (const r of rows) { const c = (counts[r.scene] ??= {}); const k = `${r.audience} ${r.edition} ${r.span.kind}`; c[k] = (c[k] ?? 0) + 1; }
    expect(counts).toMatchSnapshot();
  });
});

describe('link quality against the gold set', () => {
  const cat = (k: string) => (k === 'monster' || k === 'creature-type' ? 'monster' : k === 'item' || k === 'gear' || k === 'magic-item' ? 'item' : ['spell', 'condition', 'check'].includes(k) ? k : 'other');
  const score = (edition: Edition) => {
    const tally: Record<string, { tp: number; fp: number; fn: number }> = {};
    const t = (c: string) => (tally[c] ??= { tp: 0, fp: 0, fn: 0 });
    const groups = new Map<string, GoldSpan[]>();
    for (const g of GOLD.spans) { const k = `${g.scene}|${g.entity}|${g.field}|${g.audience}`; groups.set(k, [...(groups.get(k) ?? []), g]); }
    for (const gs of groups.values()) {
      const g0 = gs[0];
      const pred = spansFor(at(g0.scene, g0.entity, g0.field).text, { audience: g0.audience, edition, field: g0.field, scenePath: g0.scene, entityId: g0.entity });
      const used = new Set<Span>();
      for (const g of gs) {
        const hit = pred.find((p) => p.start < g.end && p.end > g.start);
        if (hit) used.add(hit);
        if (g.link) {
          if (hit && cat(hit.kind) === cat(g.kind)) { t(cat(g.kind)).tp++; t('all').tp++; }
          else { t(cat(g.kind)).fn++; t('all').fn++; if (hit) { t(cat(hit.kind)).fp++; t('all').fp++; } }
        } else if (hit) { t(cat(hit.kind)).fp++; t('all').fp++; }
      }
      // A link in a gold field that no gold span covers is a false link too.
      for (const p of pred) if (!used.has(p)) { t(cat(p.kind)).fp++; t('all').fp++; }
    }
    return tally;
  };
  it('the fixture matches the corpus text and is not yet signed off', () => {
    for (const g of GOLD.spans) expect(at(g.scene, g.entity, g.field).text.slice(g.start, g.end), `${g.entity} ${g.text}`).toBe(g.text);
    expect(GOLD.spans.length).toBeGreaterThanOrEqual(280);
    expect(GOLD.signedOff).toBe(false);
    for (const c of ['monster', 'spell', 'item', 'condition', 'check']) expect(GOLD.spans.filter((g) => g.link && cat(g.kind) === c).length, c).toBeGreaterThanOrEqual(10);
  });
  // The gold set is labelled for its edition (2024): the 2014 books lack some names ('spiked pit') and have others ('mess kit').
  for (const edition of [GOLD.edition]) {
    it(`precision at least 98% and recall at least 90%, overall and per kind (${edition} rules)`, () => {
      const s = score(edition);
      for (const c of ['all', 'monster', 'spell', 'item', 'condition', 'check']) {
        const { tp, fp, fn } = s[c] ?? { tp: 0, fp: 0, fn: 0 };
        expect(tp / (tp + fp), `${c} precision (tp ${tp}, fp ${fp})`).toBeGreaterThanOrEqual(0.98);
        expect(tp / (tp + fn), `${c} recall (tp ${tp}, fn ${fn})`).toBeGreaterThanOrEqual(0.9);
      }
    });
  }
});

describe('the gazetteer keeps names whole', () => {
  const NAMES = ['Order of the Silver Dragon', 'Werewolf Den', 'Gates of Ravenloft', 'Gates of Barovia', 'Raven River', 'Keepers of the Feather', 'Ravenloft', 'Wizard of Wines', 'Shadowfell', 'Death House'];
  const RULES = (k: RuleKind) => k !== 'area' && k !== 'person' && k !== 'pageref';
  for (const n of [...NAMES, 'the stairs rose']) {
    it(`'${n}' gives no rules link`, () => {
      for (const audience of ['dm', 'player'] as const) for (const edition of ['2024', '2014'] as const) {
        const text = `They spoke of the ${n} at dusk.`;
        expect(spansFor(text, { audience, edition, field: 'dm', scenePath: 'ch05/N2' }).filter((x) => RULES(x.kind))).toEqual([]);
      }
    });
  }
  for (const n of NAMES) {
    it(`'${n}' is one area or person link on the DM side, and nothing for players`, () => {
      const text = `They spoke of the ${n} at dusk.`, s = text.indexOf(n);
      const dm = spansFor(text, { audience: 'dm', edition: '2024', field: 'dm', scenePath: 'ch05/N2' });
      expect(dm.map((x) => [x.start, x.end, x.kind === 'area' || x.kind === 'person'])).toEqual([[s, s + n.length, true]]);
      expect(spansFor(text, { audience: 'player', edition: '2024', field: 'desc', scenePath: 'ch05/N2' })).toEqual([]);
    });
  }
  it("'the stairs rose' is not Rose; 'Rose' and 'Thorn' as names are people, only on the DM side", () => {
    expect(spansFor('A cold draft spilled down as the stairs rose into the dark.', { audience: 'dm', edition: '2024', field: 'desc', scenePath: 'appB/death-house' })).toEqual([]);
    expect(spansFor('Rose wakes when the toy chest is touched.', { audience: 'dm', edition: '2024', field: 'dm', scenePath: 'appB/death-house' })).toEqual([]);
    const s = spansFor('Disturbing the chest calls Rose and Thorn. Rose and Thorn wait here.', { audience: 'dm', edition: '2024', field: 'dm', scenePath: 'appB/death-house' });
    expect(s.map((x) => [x.text, x.kind, x.id])).toEqual([['Rose', 'person', 'person:rose-durst'], ['Thorn', 'person', 'person:thorn-durst'], ['Rose', 'person', 'person:rose-durst'], ['Thorn', 'person', 'person:thorn-durst']]);
    expect(spansFor('Rose and Thorn wait here.', { audience: 'player', edition: '2024', field: 'desc', scenePath: 'appB/death-house' })).toEqual([]);
  });
  it('person names match case-sensitively and never inside a word', () => {
    const o = { audience: 'dm' as const, edition: '2024' as const, field: 'dm', scenePath: 'ch03/E' };
    expect(spansFor('a thorny rosebush by the strahdish gate', o)).toEqual([]);
    expect(spansFor('Strahd watches.', o).map((x) => x.id)).toEqual(['person:strahd-von-zarovich']);
  });
});

describe('ordinary words need a cue', () => {
  const tf = new Map<Edition, TermFile>();
  beforeAll(async () => { for (const e of ['2024', '2014'] as const) tf.set(e, await termIndex(e)); });
  it('no ordinary word links on its own: every link of a common form came from a cue, an override or a structural source', () => {
    const bad = rows.filter((r) => (r.span.via === 'name' || r.span.via === 'tag') && tf.get(r.edition)!.common.includes(r.span.text.toLowerCase()) && !overridesFile.notOrdinary.includes(r.span.text.toLowerCase()));
    expect(bad.map((r) => `${r.scene} ${r.entity}: ${r.span.text}`)).toEqual([]);
  });
  it("no 'gate' anywhere is the Gate spell (the architecture stays plain)", () => {
    const gates = fields.reduce((n, f) => n + [...f.text.matchAll(/\bgates?\b/gi)].length, 0);
    expect(gates).toBeGreaterThanOrEqual(60);
    expect(rows.filter((r) => r.span.id === 'spell:gate')).toEqual([]);
  });
  it("players' descriptions: every 'darkness', 'light' and 'shield' is plain text", () => {
    let n = 0;
    for (const f of fields) {
      if (f.field !== 'desc' || !f.audiences.includes('player')) continue;
      const words = [...f.text.matchAll(/\b(darkness|light|shield)\b/gi)];
      if (!words.length) continue;
      n += words.length;
      for (const edition of ['2024', '2014'] as const) {
        const html = renderSpans(f.text, spansFor(f.text, { audience: 'player', edition, field: 'desc', scenePath: f.scene, entityId: f.entity }));
        for (const w of words) expect(html, `${f.scene} ${f.entity}`).not.toMatch(new RegExp(`<button[^>]*>${w[0]}</button>`));
      }
    }
    expect(n).toBeGreaterThanOrEqual(40);
  });
  it('the cue words: scroll of, cast, damage, a count, a stat parenthesis, an encounter, a spell list', () => {
    const o = { audience: 'dm' as const, edition: '2024' as const, field: 'dm' };
    const ids = (s: string) => spansFor(s, o).map((x) => x.id);
    expect(ids('A scroll of bless lies here.')).toEqual(['spell:bless']);
    expect(ids('Bless the bread.')).toEqual([]);
    expect(ids('She casts command on the guard.')).toEqual(['spell:command']);
    expect(ids('20 radiant damage destroys it.')).toEqual(['damage:radiant']);
    expect(ids('Four ghouls rise.')).toEqual(['monster:ghoul']);
    expect(ids('A ghoul statue.')).toEqual([]);
    expect(ids('The gravedigger (commoner) digs.')).toEqual(['monster:commoner']);
    expect(ids('A grick lurks here.')).toEqual(['monster:grick']);
    expect(ids('A stuffed brown bear and a dire wolf\'s head.')).toEqual([]);
  });
});

describe('structural sources (DM only)', () => {
  const dmFields = () => fields.filter((f) => f.audiences.length === 1 && f.audiences[0] === 'dm');
  it('the DC count is pinned, and the DM check links equal it, each showing its DC and ability', () => {
    expect(GOLD.dc.regex).toBe(DC_COUNT_RE.source);
    const total = dmFields().reduce((n, f) => n + [...f.text.matchAll(DC_COUNT_RE)].length, 0);
    expect(total).toBe(GOLD.dc.count);
    for (const edition of ['2024', '2014'] as const) {
      let checks = 0;
      for (const f of dmFields()) {
        const s = spansFor(f.text, { audience: 'dm', edition, field: f.field, scenePath: f.scene, entityId: f.entity }).filter((x) => x.kind === 'check');
        checks += s.length;
        for (const x of s) {
          const dc = /DC\s?(\d+)/.exec(x.text)![1];
          expect(x.label.startsWith(`DC ${dc}`), x.text).toBe(true);
          const ab = /\b(Str|Dex|Con|Int|Wis|Cha)/i.exec(x.text.replace(/^DC\s?\d+/, ''));
          if (ab) expect(x.label, x.text).toContain(ab[1].toUpperCase());
        }
        // The words on screen are the source words.
        expect(renderSpans(f.text, s).replace(/<[^>]+>/g, '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')).toBe(f.text);
      }
      expect(checks, edition).toBe(GOLD.dc.count);
    }
  });
  it('Death House: the chest scrolls, the cabinet lock and the hall paneling', () => {
    expect(links('appB/death-house', 'f2-chest9', 'dm').filter((x) => x.kind === 'spell').map((x) => x.id)).toEqual(['spell:bless', 'spell:protection-from-poison', 'spell:spiritual-weapon']);
    expect(links('appB/death-house', 'f1-cab-lock', 'dm').find((x) => x.kind === 'check')!.label).toBe("DC 15 · DEX (Thieves' Tools)");
    expect(links('appB/death-house', 'room:f1/2A', 'dm').find((x) => x.kind === 'check')!.label).toBe('DC 12 · Perception');
  });
  it('Amber Temple X24: a WIS save, sympathy as Antipathy/Sympathy, and the X26 area', () => {
    for (const edition of ['2024', '2014'] as const) {
      const s = links('ch13/X', 'room:upper/X24', 'dm', 'dm', edition);
      expect(s.find((x) => x.kind === 'check')!.label).toBe('DC 16 · WIS save');
      expect(s.find((x) => x.text === 'sympathy')).toMatchObject({ kind: 'spell', id: 'spell:antipathy-sympathy' });
      expect(s.find((x) => x.text === 'X26')).toMatchObject({ kind: 'area', id: 'area:ch13/X#X26' });
    }
  });
  it('dice: average and maximum, no rolling', () => {
    expect(diceOf('2d6 + 3')).toEqual({ expr: '2d6 + 3', avg: 10, max: 15 });
    expect(diceOf('1d4-1')).toMatchObject({ avg: 1, max: 3 });
    const s = spansFor('Fall: 1d6 bludgeoning + 2d10 piercing.', { audience: 'dm', edition: '2024', field: 'dm' });
    expect(s.filter((x) => x.kind === 'dice').map((x) => x.label)).toEqual(['1d6 · avg 3 · max 6', '2d10 · avg 11 · max 20']);
  });
  it('a hidden-creature slot links its creature: the books monster, or the module creature', () => {
    expect(links('appB/death-house', 'dungeon-ghoul0', 'label')[0]).toMatchObject({ text: 'Ghoul', kind: 'monster', id: 'monster:ghoul', via: 'structural' });
    expect(links('appB/death-house', 'f3-broom', 'label')[0]).toMatchObject({ kind: 'monster', id: 'creature:broom-of-animated-attack' });
  });
  it("a named variant with its own numbers is the person, not the books' stat block: Exethanter the lich (99 hp, CR 10)", () => {
    for (const edition of ['2024', '2014'] as const) {
      for (const [entity, field] of [['room:upper/X27', 'dm'], ['upper-X27-lich', 'label'], ['upper-X27-divan', 'dm']] as const) {
        expect(links('ch13/X', entity, field, 'dm', edition).filter((x) => x.kind === 'monster'), `${entity} ${edition}`).toEqual([]);
      }
      expect(links('ch13/X', 'room:upper/X27', 'dm', 'dm', edition)[0]).toMatchObject({ text: 'Exethanter', kind: 'person' });
      // Without its own numbers the epithet keeps the stat block.
      expect(links('ch13/X', 'upper-X15-helwa', 'label', 'dm', edition).find((x) => x.text === 'gladiator')).toMatchObject({ kind: 'monster', id: 'monster:gladiator' });
    }
  });
  it('a person card names their home from the manifests, never a raw tag', () => {
    const person = (text: string) => spansFor(text, { audience: 'dm', edition: '2024', field: 'dm', scenePath: 'ch03/E' }).find((x) => x.kind === 'person')!.person;
    expect(person('Strahd von Zarovich watches.')!.home).toBe('Castle Ravenloft');
    expect(homeOf(['K'])).toBe('Castle Ravenloft');
    expect(homeOf(['N2'])).toBe('Blue Water Inn');
    expect(homeOf(['E4'])).toBe("Burgomaster's Mansion (Village of Barovia)");
    expect(homeOf(['death-house'])).toBe('Death House');
    expect(homeOf(['K', 'K84'])).toBe('Catacombs (Castle Ravenloft)');
    expect(homeOf(['nowhere'])).toBeUndefined();
    expect(homeOf([])).toBeUndefined();
    for (const r of rows) if (r.span.person?.home) expect(r.span.person.home, r.span.label).not.toMatch(/^(?:[A-Z]{1,2}\d*[a-z]?|[a-z]+(?:-[a-z]+)+)(?:[,;]|$)/);
  });
});

describe("the players' side", () => {
  it('never gets a monster, creature type, person, area, page, check or dice link, nor a structural or gazetteer one', () => {
    const bad = rows.filter((r) => r.audience === 'player' && (!PLAYER_KINDS.has(r.span.kind) || r.span.via === 'structural' || r.span.via === 'gazetteer' || r.span.via === 'cue'));
    expect(bad.map((r) => `${r.scene} ${r.entity}: ${r.span.text} (${r.span.kind})`)).toEqual([]);
  });
  it('a DM-only kind forced by an override still never reaches the players', () => {
    const o = overridesFile.overrides.find((x) => x.kind === 'monster')!;
    const f = at(o.scene, o.entity, o.field);
    expect(spansFor(f.text, { audience: 'player', edition: '2024', field: o.field, scenePath: o.scene, entityId: o.entity }).filter((x) => x.kind === 'monster')).toEqual([]);
  });
});

describe('rendering', () => {
  it('escapes every slice and links only the first occurrence of a term per card', () => {
    const text = 'Four ghouls <b>rise</b>; the ghouls & a grick lurks here. Two ghouls attack.';
    const s = spansFor(text, { audience: 'dm', edition: '2024', field: 'dm' });
    const seen = new Set<string>();
    const html = renderSpans(text, s, seen);
    expect(html).toContain('&lt;b&gt;rise&lt;/b&gt;');
    expect(html).toContain('&amp;');
    expect(html.match(/data-term="monster:ghoul"/g)).toHaveLength(1);
    // A second field of the same card shares the set: the ghoul is not linked again.
    expect(renderSpans('Ghouls attack.', spansFor('Four ghouls attack.', { audience: 'dm', edition: '2024', field: 'dm' }), seen)).not.toContain('<button');
    expect(html).toMatch(/<button type="button" class="rl monster" data-kind="monster" data-term="monster:ghoul"[^>]*>ghouls<\/button>/);
  });
  it('a check link carries its DC, ability and skill for the card', () => {
    const t = "DC 15 Dexterity (thieves' tools).";
    expect(renderSpans(t, spansFor(t, { audience: 'dm', edition: '2024', field: 'dm' }))).toMatch(/class="rl check" data-kind="check"[^>]*data-dc="15" data-ability="DEX" data-skill="Thieves&#39; Tools"/);
  });
});

describe('module words only', () => {
  it('the overrides file and the gold set hold no sentence of the SRD', () => {
    const words = (s: string) => s.toLowerCase().replace(/<[^>]+>/g, ' ').match(/[a-z']+/g) ?? [];
    const shingles = new Set<string>();
    for (const book of ['srd-5.1', 'srd-5.2.1']) {
      for (const f of readdirSync(join(ROOT, 'app/public/books', book, 'e'))) {
        const j = JSON.parse(readFileSync(join(ROOT, 'app/public/books', book, 'e', f), 'utf8')) as { entries: Record<string, { text: string; html: string }> };
        for (const e of Object.values(j.entries)) { const w = words(`${e.text} ${e.html}`); for (let i = 0; i + 8 <= w.length; i++) shingles.add(w.slice(i, i + 8).join(' ')); }
      }
    }
    const strings: string[] = [];
    const walk = (v: unknown) => { if (typeof v === 'string') strings.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
    walk(overridesFile);
    walk(GOLD);
    const hits = strings.filter((s) => { const w = words(s); for (let i = 0; i + 8 <= w.length; i++) if (shingles.has(w.slice(i, i + 8).join(' '))) return true; return false; });
    expect(hits).toEqual([]);
  }, 60_000);
});
