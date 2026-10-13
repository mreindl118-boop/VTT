// Module text with its rules links, for every surface that shows room, object, pin or creature words. The link
// pipeline (ui/terms.ts) is its own chunk, loaded by the DM window once the scene is ready; until then, and on the
// Player Display (which never loads it), text renders plain and escaped. Every slice is escaped either way.
import type { SpanCtx } from './terms';
import { esc } from './text';

type TermsModule = typeof import('./terms');
let T: TermsModule | null = null;
let loading: Promise<TermsModule> | null = null;

/** Where rich() takes a string from: the field and the entity, exactly as the review list reads them. */
export type RichCtx = Omit<SpanCtx, 'edition'>;

/** The text with its rules links (the first occurrence of a term per card: pass one `seen` set per card). */
export function rich(text: string | undefined, ctx: RichCtx, seen?: Set<string>): string {
  if (!text) return '';
  if (!T) return esc(text);
  return T.renderSpans(text, T.spansFor(text, { ...ctx, edition: T.edition() }), seen);
}

/** The pipeline once it is loaded (the clock reads the edition and the 2024 pace notes from it). */
export const termsNow = (): TermsModule | null => T;

/** Whether links render yet (the term files are in). */
export const richReady = (): boolean => !!T;

/** Load the pipeline now (DM window only): the term files of both editions, then the kinds of the preferred one. */
export function loadRich(source: Parameters<TermsModule['preload']>[0]): Promise<TermsModule> {
  return (loading ??= import('./terms').then(async (t) => {
    await t.preload(source);
    T = t;
    // A change of the Rules edition: the kinds of the new edition (magic item or gear, action) load behind it.
    addEventListener(t.EDITION_EVENT, () => { void t.readyKinds(t.edition()).catch(() => {}); });
    return t;
  }));
}
