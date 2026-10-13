// The newest entry of docs/CHANGELOG.md, for the "What's new" card (vite.config.ts bakes it into the build).
// An entry starts with "## <version> <title> — <date>" and runs to the next "## " heading or the end.

export interface ChangelogEntry { version: string; title: string; date: string; body: string }

export function newestEntry(markdown: string): ChangelogEntry | null {
  const sections = markdown.replace(/\r\n/g, '\n').split(/^## /m).slice(1);
  if (!sections.length) return null;
  const first = sections[0];
  const nl = first.indexOf('\n');
  const head = nl < 0 ? first : first.slice(0, nl);
  const body = nl < 0 ? '' : first.slice(nl + 1).trim();
  const m = /^(\S+)\s+(.*?)(?:\s+—\s+(\S.*?))?\s*$/.exec(head);
  if (!m) return null;
  return { version: m[1], title: m[2], date: m[3] ?? '', body };
}
