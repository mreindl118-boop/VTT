// The token conditions hook (increment 9 renders it): conditionChips(conditions, audience) in ui/terms.ts, re-exported
// by ui/rulecard.ts. Proven here by a fixture only; no token carries conditions yet.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setBookFetcher } from '../app/src/books/store';
import { loadBooks } from '../scripts/terms-corpus';
import { conditionChips } from '../app/src/ui/terms';

const FIXTURE = ['Grappled', 'prone', 'Exhaustion', 'secretly a vampire <b>'];

beforeAll(async () => { await loadBooks(); }, 60_000);
afterAll(() => setBookFetcher(null));

describe('conditionChips', () => {
  for (const ed of ['2024', '2014'] as const) {
    it(`${ed}: each known condition is a condition link; the DM keeps anything else as escaped text`, () => {
      const html = conditionChips(FIXTURE, 'dm', ed);
      const links = [...html.matchAll(/<button type="button" class="rl condition" data-kind="condition" data-term="([^"]+)"[^>]*>([^<]+)<\/button>/g)].map((m) => [m[1], m[2]]);
      expect(links).toEqual([['condition:grappled', 'Grappled'], ['condition:prone', 'Prone'], ['condition:exhaustion', 'Exhaustion']]);
      expect(html).toContain('<span class="cond">secretly a vampire &lt;b&gt;</span>');
    });
    it(`${ed}: the players' side gets the condition links only, nothing else`, () => {
      const html = conditionChips(FIXTURE, 'player', ed);
      expect((html.match(/class="rl condition"/g) ?? []).length).toBe(3);
      expect(html).not.toMatch(/vampire|cond"/);
      expect(html.match(/data-kind="([^"]+)"/g)!.every((k) => k === 'data-kind="condition"')).toBe(true);
    });
  }
  it('no conditions, no row', () => {
    expect(conditionChips([], 'dm')).toBe('');
    expect(conditionChips(['made up'], 'player', '2024')).toBe('');
  });
});
