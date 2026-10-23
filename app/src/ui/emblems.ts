// game-icons.net emblems (CC BY 3.0; credits in public/fonts/CREDITS.txt). Content only: rules kickers, stat tiles.
// Never a toolbar button and never drawn below 20 px. This module is its own chunk: the sprite is injected once, on
// first use, as one hidden inline <svg> that every emblem points into.
import SPRITE from './emblems.svg?raw';
import type { EmblemId } from './kinds';

/** Put the sprite in the page once (a hidden inline svg; <use href="#gi-…"> points into it). */
export function ensureEmblems(doc: Document = document): void {
  if (doc.getElementById('gi-sprite')) return;
  const host = doc.createElement('div');
  host.id = 'gi-sprite';
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  host.innerHTML = SPRITE.replace('style="display:none"', 'width="0" height="0" focusable="false"');
  doc.body.appendChild(host);
}

/** An emblem: decorative (aria-hidden); the word beside it carries the meaning. */
export function emblem(id: EmblemId, cls = ''): string {
  return `<svg class="e${cls ? ` ${cls}` : ''}" aria-hidden="true" focusable="false"><use href="#gi-${id}"/></svg>`;
}
