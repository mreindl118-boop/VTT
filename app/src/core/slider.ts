// DM/Player view slider math. Spec: docs/SLIDER.md.
import type { VisClass } from './schema';

export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export const hiddenCurve = (t: number) => smoothstep(0.15, 0.85, t);
export const fogCurve = (t: number) => 1 - smoothstep(0.1, 0.9, t);
export const labelCurve = (t: number) => smoothstep(0.6, 1.0, t);

export const DETENT = 0.04;
export function applyDetents(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  if (c < DETENT) return 0;
  if (c > 1 - DETENT) return 1;
  return c;
}

/**
 * Opacity of an object of class `vis` at slider `t`.
 * `revealed` = DM revealed it to players, which pins it to fully visible.
 * `player`/`explored`/`unexplored` return 1: their visibility is the fog/coverage map, not object opacity.
 */
export function classOpacity(vis: VisClass, t: number, revealed = false): number {
  if (revealed) return 1;
  switch (vis) {
    case 'player':
    case 'explored':
    case 'unexplored':
      return 1;
    case 'secret-door':
    case 'trap':
    case 'hidden-creature':
    case 'hidden-object':
      return hiddenCurve(t);
    case 'dm-note':
      return labelCurve(t);
  }
}
