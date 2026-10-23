// The clock's pace note follows the Rules edition (core/travel.ts); miles and hours never change with it
// (tests/travel.test.ts holds those, unchanged). The 2024 notes are read from the 2024 book at run time.
import { afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PACES, paceNote, paceNotesFrom, travel } from '../app/src/core/travel';
import { setBookFetcher } from '../app/src/books/store';
import { paceNotes2024 } from '../app/src/ui/terms';
import { EDITION_EVENT } from '../app/src/books/lookup';

afterAll(() => setBookFetcher(null));

describe('the pace note by edition', () => {
  it('2014 is the table\'s effect column in our short form (PACES.note)', () => {
    for (const p of ['fast', 'normal', 'slow'] as const) expect(paceNote(p, '2014')).toBe(PACES[p].note);
  });
  it('2024 shortens each pace paragraph to what it imposes or grants (a made-up fixture, no rules text)', () => {
    const html = '<p><em><strong>Fast.</strong></em> Moving at a Fast pace imposes Clumsiness on a traveler\'s juggling.</p><p><em><strong>Slow.</strong></em> Going slowly grants Calm on whistling.</p>';
    expect(paceNotesFrom(html)).toEqual({ fast: 'Clumsiness on juggling', slow: 'Calm on whistling' });
    expect(paceNote('fast', '2024', paceNotesFrom(html))).toBe('Clumsiness on juggling');
    expect(paceNote('normal', '2024', paceNotesFrom(html))).toBe('');
  });
  it('2024 reads all three paces from the 2024 book, and they differ from 2014', async () => {
    setBookFetcher(async (p) => JSON.parse(readFileSync(join('app/public/books', p), 'utf8')));
    const n = await paceNotes2024();
    expect(Object.keys(n).sort()).toEqual(['fast', 'normal', 'slow']);
    for (const p of ['fast', 'normal', 'slow'] as const) { expect(n[p]!.length).toBeGreaterThan(8); expect(n[p]).not.toBe(PACES[p].note); }
  });
  it('miles and hours do not depend on the edition (one function, no edition argument)', () => {
    expect(travel.length).toBe(2);
    expect(travel([[0, 0], [5280 * 6, 0]], 'fast')).toEqual({ miles: 6, hours: 1.5, days: 0.2 });
  });
  it('the clock listens for the books\' own edition event', () => {
    expect(EDITION_EVENT).toBe('mistlab:rules-edition');
  });
});
