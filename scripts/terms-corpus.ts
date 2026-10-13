// The rules-link corpus: every module string the rules links run over (room desc and DM note; object label, players'
// label, players' description, DM note and container contents; pin blurb and DM note; what players are told about a
// creature), in all 45 scenes, both world maps and the bestiary, for each audience that reads it. Shared by
// scripts/terms-review.mjs (docs/TERMS_REVIEW.md and docs/terms-review/) and tests/terms.test.ts, so the review list and the test count the
// same spans.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { setBookFetcher } from '../app/src/books/store';
import type { Edition } from '../app/src/books/types';
import { BESTIARY, seenAs } from '../app/src/bestiary';
import type { SceneFile } from '../app/src/core/schema';
import { KIND_DESC, playerDesc, playerLabel } from '../app/src/core/objectText';
import { overridesFile, ready, readyKinds, spanKey, spansFor, useScene, type Audience, type Span } from '../app/src/ui/terms';

export const ROOT = join(import.meta.dirname, '..');
export const EDITIONS: Edition[] = ['2024', '2014'];

export interface Field { scene: string; entity: string; field: string; text: string; audiences: Audience[] }
export interface Row { scene: string; entity: string; field: string; audience: Audience; edition: Edition; span: Span; status: 'override' | 'accepted' | 'unreviewed' }

const BOTH: Audience[] = ['dm', 'player'];
const DM: Audience[] = ['dm'];

function walk(dir: string, name: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir).sort()) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, name, out);
    else if (f === name) out.push(p);
  }
  return out;
}

/** Scene paths ('appB/death-house') and their files. */
export const sceneFiles = (): { path: string; scene: SceneFile }[] =>
  walk(join(ROOT, 'locations'), 'scene.json').map((f) => ({ path: relative(join(ROOT, 'locations'), f).replace(/\/scene\.json$/, ''), scene: JSON.parse(readFileSync(f, 'utf8')) as SceneFile }));
export const worldFiles = (): { path: string; world: { pins: { key: string; name: string; blurb?: string; dm?: string }[] } }[] =>
  walk(join(ROOT, 'locations'), 'world.json').map((f) => ({ path: relative(join(ROOT, 'locations'), f).replace(/\/world\.json$/, ''), world: JSON.parse(readFileSync(f, 'utf8')) }));

/** Every field of the corpus, registering each scene with the matcher. */
export function corpusFields(): Field[] {
  const out: Field[] = [];
  const push = (scene: string, entity: string, field: string, text: string | undefined, audiences: Audience[]) => { if (text && text !== 'None') out.push({ scene, entity, field, text, audiences }); };
  for (const { path, scene } of sceneFiles()) {
    useScene(path, scene);
    for (const l of scene.levels) {
      for (const r of l.rooms) {
        const e = `room:${l.id}/${r.key}`;
        push(path, e, 'desc', r.desc, BOTH);
        push(path, e, 'dm', r.dm, DM);
      }
      for (const o of l.objects) {
        // Objects with words of their own (generic kind names and descriptions are listed once, under 'kinds').
        if (!o.label && !o.playerLabel && !o.desc && !o.dm && !o.container?.contents) continue;
        push(path, o.id, 'label', o.label, DM);
        if (o.playerLabel || o.label) push(path, o.id, 'playerLabel', playerLabel(o), ['player']);
        push(path, o.id, 'desc', playerDesc(o), BOTH);
        push(path, o.id, 'dm', o.dm, DM);
        push(path, o.id, 'contents', o.container?.contents, BOTH);
      }
    }
  }
  for (const { path, world } of worldFiles()) for (const p of world.pins) {
    push(path, `pin:${p.key}`, 'blurb', p.blurb, BOTH);
    push(path, `pin:${p.key}`, 'dm', p.dm, DM);
  }
  for (const [k, text] of Object.entries(KIND_DESC)) push('kinds', `kind:${k}`, 'desc', text, BOTH);
  for (const e of BESTIARY) push('bestiary', `creature:${e.id}`, 'seenAs', seenAs(e), BOTH);
  return out;
}

/** Read the books from disk and load what the matcher needs for both editions. */
export async function loadBooks(): Promise<void> {
  setBookFetcher(async (p) => JSON.parse(readFileSync(join(ROOT, 'app/public/books', p), 'utf8')));
  for (const ed of EDITIONS) { await ready(ed); await readyKinds(ed); }
}

/** Every span over the corpus: one row per span, audience and edition, with its review status. */
export function reviewRows(fields: Field[]): Row[] {
  const rows: Row[] = [];
  for (const f of fields) for (const audience of f.audiences) for (const edition of EDITIONS) {
    for (const span of spansFor(f.text, { audience, edition, field: f.field, scenePath: f.scene, entityId: f.entity })) {
      const status = span.via === 'override' ? 'override' : (overridesFile.accepted[f.scene] ?? []).includes(spanKey(span)) ? 'accepted' : 'unreviewed';
      rows.push({ scene: f.scene, entity: f.entity, field: f.field, audience, edition, span, status });
    }
  }
  return rows;
}

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

/** One review row: one link in one string. The same string in several objects of a scene is one row (×n), and the
 *  row says for which audiences and editions it links. */
export interface ReviewRow {
  scene: string; field: string; text: string; start: number; end: number; kind: string; id?: string; label: string; why: string;
  entities: string[]; who: Set<string>; status: Row['status'];
}
const WHO = (a: Audience, e: Edition) => `${a === 'dm' ? 'DM' : 'players'} ${e}`;

/** Group the rows: one per (scene, field, string, span). */
export function reviewTable(rows: Row[], fields: Field[]): ReviewRow[] {
  const text = new Map(fields.map((f) => [`${f.scene}|${f.entity}|${f.field}`, f.text]));
  const out = new Map<string, ReviewRow>();
  for (const r of rows) {
    const t = text.get(`${r.scene}|${r.entity}|${r.field}`) ?? '';
    const k = [r.scene, r.field, t, r.span.start, r.span.end, r.span.kind, r.span.id ?? '', r.span.label, r.span.why].join('\u0001');
    let x = out.get(k);
    if (!x) out.set(k, (x = { scene: r.scene, field: r.field, text: t, start: r.span.start, end: r.span.end, kind: r.span.kind, id: r.span.id, label: r.span.label, why: r.span.why, entities: [], who: new Set(), status: r.status }));
    if (!x.entities.includes(r.entity)) x.entities.push(r.entity);
    x.who.add(WHO(r.audience, r.edition));
  }
  return [...out.values()];
}

const whoText = (w: Set<string>): string => {
  const has = (a: string) => EDITIONS.every((e) => w.has(`${a} ${e}`));
  if (has('DM') && has('players')) return 'all';
  if (has('DM') && ![...w].some((x) => x.startsWith('players'))) return 'DM';
  return [...w].sort().join(', ');
};
const linkText = (r: ReviewRow): string => (['check', 'dice', 'area', 'person'].includes(r.kind) || !r.id ? r.label : r.id.replace(/^[a-z-]+:/, ''));

/** The review list's index, and the folder that holds one part per chapter (each part stays well under the 150 KB the
 *  no-book-content guard allows a Markdown file). */
export const REVIEW_INDEX = 'docs/TERMS_REVIEW.md';
export const REVIEW_DIR = 'docs/terms-review';
/** The part a scene's rows go in: its chapter folder (ch02, appB, wsc...). */
export const reviewPart = (scene: string): string => scene.split('/')[0];

/** docs/TERMS_REVIEW.md and docs/terms-review/<chapter>.md: per scene and field, every link with its kind, the module
 *  words it covers, the rule that fired, and the audiences and editions it links for. Keyed by repository path. */
export function reviewFiles(rows: Row[], fields: Field[]): Map<string, string> {
  const table = reviewTable(rows, fields);
  const byScene = new Map<string, ReviewRow[]>();
  for (const r of table) (byScene.get(r.scene) ?? byScene.set(r.scene, []).get(r.scene)!).push(r);
  const kinds = new Map<string, number>();
  for (const r of rows) kinds.set(r.span.kind, (kinds.get(r.span.kind) ?? 0) + 1);
  const st = (s: Row['status']) => rows.filter((r) => r.status === s).length;
  const parts = new Map<string, string[]>();
  const partRows = new Map<string, number>();
  for (const [scene, rs] of [...byScene].sort((a, b) => a[0].localeCompare(b[0]))) {
    const part = reviewPart(scene);
    const lines = parts.get(part) ?? parts.set(part, [
      `# Rules links: review list, ${part}`,
      '',
      `Part of [the review list](../TERMS_REVIEW.md), generated by \`npm run terms:review\`. Do not edit by hand.`,
      '',
    ]).get(part)!;
    partRows.set(part, (partRows.get(part) ?? 0) + rs.length);
    lines.push(`## ${scene}`, '', '| Where | Field | Words | Kind | Link | Rule | For | Review |', '|---|---|---|---|---|---|---|---|');
    for (const r of rs) {
      const where = r.entities[0].replace(/^room:/, '') + (r.entities.length > 1 ? ` ×${r.entities.length}` : '');
      const rule = r.why.replace(/^gazetteer: .*/, 'gazetteer').replace(/^override: .*/, 'override');
      lines.push(`| ${cell(where)} | ${r.field} | ${cell(r.text.slice(r.start, r.end))} | ${r.kind} | ${cell(linkText(r))} | ${cell(rule)} | ${whoText(r.who)} | ${r.status === 'accepted' ? '' : r.status} |`);
    }
    lines.push('');
  }
  const index = [
    '# Rules links: review list',
    '',
    'Generated by `npm run terms:review` (scripts/terms-review.mjs) from app/src/ui/terms.ts. Do not edit by hand: change',
    'app/src/books/term-overrides.json (link, suppress or relabel one occurrence; accept a scene\'s links) and run it again.',
    '',
    'Every link `spansFor` returns over every room, object, pin and creature string in all scenes and both world maps, for',
    'each audience that reads the string (DM, players) and each rules edition (2024, 2014). A row is one link in one',
    'string; the same string in several objects of a scene is one row ("×n"), and "For" says which audiences and editions',
    'it links for ("all": DM and players, both editions; "DM": the DM, both editions). "Words" is the module text the link',
    'covers (our own wording). "Rule" is what made it a link: the books\' name, a cue word, a structural source (DC, dice,',
    'a key reference, a hidden-creature slot), the gazetteer, or an override. "Review" is blank once the scene\'s list in',
    'the overrides file accepts the link.',
    '',
    `Fields read: ${fields.length}. Links: ${rows.length} in ${table.length} rows (accepted ${st('accepted')}, by override ${st('override')}, unreviewed ${st('unreviewed')}).`,
    '',
    `By kind: ${[...kinds].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ')}.`,
    '',
    'The rows are in one file per chapter:',
    '',
    ...[...parts.keys()].map((part) => `- [${part}](terms-review/${part}.md): ${partRows.get(part)} row${partRows.get(part) === 1 ? '' : 's'}`),
    '',
  ];
  const out = new Map<string, string>([[REVIEW_INDEX, index.join('\n')]]);
  for (const [part, lines] of parts) out.set(`${REVIEW_DIR}/${part}.md`, lines.join('\n'));
  return out;
}
