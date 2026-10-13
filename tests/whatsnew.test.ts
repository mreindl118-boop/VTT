// The "What's new" card: the newest changelog entry is found whole, and its Markdown subset renders.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { newestEntry } from '../scripts/changelog-entry';
import { renderEntry } from '../app/src/ui/whatsnew';

const SAMPLE = `# Changelog

## 0.3.0 Nested world — 2026-10-14

One zoomable world.

- Zoom from the valley into a town, a building and a room, and back out.
  - The breadcrumb shows where you are.
- The \`World map\` button opens the **inked** map.

Known limits: the topography follows.

## 0.2.1 Built and tested on the owner's laptop — 2026-10-13

Nothing changes at the table.
`;

describe('the newest changelog entry', () => {
  it('is the first "## " section, whole, with its version, title and date', () => {
    const e = newestEntry(SAMPLE)!;
    expect(e.version).toBe('0.3.0');
    expect(e.title).toBe('Nested world');
    expect(e.date).toBe('2026-10-14');
    expect(e.body.startsWith('One zoomable world.')).toBe(true);
    expect(e.body.endsWith('Known limits: the topography follows.')).toBe(true);
    expect(e.body).not.toContain('0.2.1');
  });
  it('reads the real changelog: the entry matches package.json and has a body', () => {
    const e = newestEntry(readFileSync('docs/CHANGELOG.md', 'utf8'))!;
    const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
    expect(e.version).toBe(version);
    expect(e.body.length).toBeGreaterThan(40);
  });
  it('copes with a heading that has no date and with CRLF', () => {
    expect(newestEntry('# C\r\n\r\n## 1.0.0 First\r\n\r\nHello.\r\n')).toEqual({ version: '1.0.0', title: 'First', date: '', body: 'Hello.' });
    expect(newestEntry('# C\n')).toBeNull();
  });
});

describe('rendering the entry', () => {
  it('turns paragraphs, bullets, sub-bullets, bold and code into HTML, escaped', () => {
    const html = renderEntry(newestEntry(SAMPLE)!.body);
    expect(html).toBe('<p>One zoomable world.</p><ul><li>Zoom from the valley into a town, a building and a room, and back out.<ul><li>The breadcrumb shows where you are.</li></ul></li><li>The <code>World map</code> button opens the <b>inked</b> map.</li></ul><p>Known limits: the topography follows.</p>');
    expect(renderEntry('a <b>tag</b> & "quotes"')).toBe('<p>a &lt;b&gt;tag&lt;/b&gt; &amp; &quot;quotes&quot;</p>');
  });
  it('joins a wrapped bullet line onto its bullet', () => {
    expect(renderEntry('- first line\n  continues here\n- second')).toBe('<ul><li>first line continues here</li><li>second</li></ul>');
  });
});
