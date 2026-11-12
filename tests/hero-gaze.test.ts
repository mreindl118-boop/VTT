import { describe, expect, it, vi } from 'vitest';

// what each hero hands the face builder for its eyes
const seen = vi.hoisted(() => [] as unknown[]);
vi.mock('../app/src/kit/faces', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../app/src/kit/faces')>();
  return { ...orig, faceFeatures: (spec: Parameters<typeof orig.faceFeatures>[0], look: Parameters<typeof orig.faceFeatures>[1]) => { seen.push(spec.gaze); return orig.faceFeatures(spec, look); } };
});
import { gazeOf, heroFigure, POSES } from '../app/src/kit/heroes';

describe('hero gaze', () => {
  it('turns the pose\'s gaze (across > 0 to the figure\'s right) into the face\'s own (across > 0 to its left)', () => {
    seen.length = 0; heroFigure({ pose: { gaze: [0.5, 0.2] } });
    expect(seen[0]).toEqual([-0.5, 0.2]);
    seen.length = 0; heroFigure({ pose: { gaze: [-0.3, -0.1] } });
    expect(seen[0]).toEqual([0.3, -0.1]);
  });
  it('lets a recipe\'s own face.gaze stand as written, in the face\'s convention', () => {
    seen.length = 0; heroFigure({ face: { gaze: [0.4, 0] }, pose: { gaze: [0.5, 0.2] } });
    expect(seen[0]).toEqual([0.4, 0]);
  });
  it('hands the face the gaze worked out from the pose, mirrored the same way, when the pose gives none', () => {
    for (const stance of ['two-handed', 'shield', 'conjure'] as const) {
      seen.length = 0; heroFigure({ weapon: 'axe', stance }, 'medium', 'battle');
      const g = gazeOf(POSES[stance], true);
      expect(seen[0], stance).toEqual([-g[0], g[1]]);
    }
  });
});
