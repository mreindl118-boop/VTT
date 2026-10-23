// The card shape this pass keeps (docs/CLARITY.md word budgets are queue item 15): the escape case only. Module words
// reach a card as text, never as markup, on both sides.
import { describe, expect, it } from 'vitest';
import { objectCardHtml, playersRoomCardHtml, roomHeadHtml } from '../app/src/ui/cards';

const opts = { scenePath: 'appB/death-house', levelId: 'f1', ownWords: true };
const obj = { id: 'fixture-chest', label: 'A <b>bold</b> chest & "lid"', playerLabel: 'Chest <i>x</i>', vis: 'hidden-object', revealed: false, kind: 'chest', desc: 'Inside: <script>alert(1)</script>', dm: '<img src=x onerror=alert(1)>', visibleToPlayers: true, container: { locked: false, open: true, contents: '<u>three</u> coins' } };

describe('a label containing markup renders literally', () => {
  it('on the DM\'s object card', () => {
    const html = objectCardHtml(obj, { ...opts, players: false });
    expect(html).toContain('<h2>A &lt;b&gt;bold&lt;/b&gt; chest &amp; &quot;lid&quot;</h2>');
    expect(html).not.toMatch(/<b>bold|<script|<img|<u>three|<i>x/);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
  it('on the players\' object card (their label, no DM note)', () => {
    const html = objectCardHtml(obj, { ...opts, players: true });
    expect(html).toContain('<h2>Chest &lt;i&gt;x&lt;/i&gt;</h2>');
    expect(html).not.toMatch(/onerror|bold|<script/);
  });
  it('on the room head and the players\' room card', () => {
    const r = { key: '<k>', name: 'Hall <b>x</b>', revealed: true, desc: 'a <em>b</em>', dm: 'c <s>d</s>', page: 212 };
    for (const html of [roomHeadHtml(r, { ...opts, players: false }), roomHeadHtml(r, { ...opts, players: true }), playersRoomCardHtml(r, { ...opts, players: true })]) {
      expect(html).not.toMatch(/<k>|<b>x|<em>b|<s>d/);
      expect(html).toContain('Hall &lt;b&gt;x&lt;/b&gt;');
    }
    expect(roomHeadHtml(r, { ...opts, players: true })).not.toMatch(/c &lt;s&gt;|pageref|&lt;k&gt;/);
  });
});
