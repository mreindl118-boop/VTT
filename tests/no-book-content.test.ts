// Guard: the repo is public. The book, its scans, OCR text and page images must never be committed.
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('no book content in git', () => {
  it('nothing under reference/ is tracked except READMEs, and no PDFs or scans anywhere', () => {
    let files: string[] = [];
    try { files = execSync('git ls-files --cached', { encoding: 'utf8' }).split('\n').filter(Boolean); } catch { return; }
    const bad = files.filter((f) => (f.startsWith('reference/') && !f.endsWith('README.md')) || /\.(pdf|tiff?|djvu|cbz)$/i.test(f));
    expect(bad).toEqual([]);
  });
});
