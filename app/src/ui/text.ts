// Small text helpers shared by the UI: escaping for HTML built from strings, and the short forms tips and cards use.

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape a string for HTML text or a quoted attribute value. */
export const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** The first sentence of a text (up to the first full stop, question or exclamation mark followed by a space). */
export function firstSentence(s: string): string {
  const t = s.trim();
  const m = /^(.+?[.!?])(?:\s|$)/s.exec(t);
  return m ? m[1] : t;
}

/** At most `n` words; a cut text ends with an ellipsis. `cut` says whether anything was left out. */
export function clampWords(s: string, n: number): { text: string; cut: boolean } {
  const words = s.trim().split(/\s+/).filter(Boolean);
  if (words.length <= n) return { text: words.join(' '), cut: false };
  return { text: `${words.slice(0, n).join(' ').replace(/[,;:]$/, '')}…`, cut: true };
}
