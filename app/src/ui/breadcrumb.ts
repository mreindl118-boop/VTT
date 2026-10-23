// The breadcrumb in the title (the continuous world, step 4): where the active map hangs, from the whole valley down to
// the floor shown, e.g. Barovia › Town of Vallaki › Blue Water Inn › Ground floor. Each crumb frames its scope, flying
// there: the valley whole, a map the active one hangs in (which then becomes the active map), the map itself, its floor.
// On the players' side the crumbs are plain names (the players' screen takes no DM navigation). The legacy way (one map
// alone in the mist) has a single crumb: the map's name, as the title always showed.
import type { App } from '../app';

export function renderCrumbs(el: HTMLElement, app: App, interactive: boolean): void {
  const list = app.crumbs();
  const key = JSON.stringify([list.map((c) => c.label), interactive]);
  if (el.dataset.crumbs === key) return;
  el.dataset.crumbs = key;
  el.classList.toggle('crumbs', list.length > 1);
  if (list.length <= 1) { el.textContent = list[0]?.label ?? ''; return; }
  // a narrow screen keeps the last two places (the town and the building; the floor picker already names the floor)
  const near = list.map((_, i) => i).filter((i) => list[i].kind !== 'level').slice(-2);
  el.replaceChildren(...list.map((c, i) => {
    const ck = document.createElement('span');
    ck.className = `ck ${c.kind}${near.includes(i) ? ' near' : ''}${i === near[0] ? ' near0' : ''}`;
    if (i) { const sep = document.createElement('i'); sep.textContent = '›'; sep.setAttribute('aria-hidden', 'true'); ck.append(sep); }
    const last = i === list.length - 1;
    const b = document.createElement(interactive ? 'button' : 'span');
    b.className = 'crumb'; b.textContent = c.label;
    if (interactive) {
      (b as HTMLButtonElement).type = 'button';
      b.dataset.crumb = String(i);
      b.dataset.tip = c.kind === 'valley' ? `${c.label}: the whole valley` : c.kind === 'level' ? `${c.label}: frame this floor` : last ? `${c.label}: frame the whole map` : `Back out to ${c.label}`;
      if (last) b.setAttribute('aria-current', 'page');
    }
    ck.append(b);
    return ck;
  }));
}

/** Taps on a crumb frame its scope (one listener on the title). */
export function wireCrumbs(el: HTMLElement, app: App, done: () => void): void {
  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-crumb]');
    if (!b || app.restricted) return;
    e.stopPropagation();
    void app.goCrumb(Number(b.dataset.crumb)).then(done);
  });
}
