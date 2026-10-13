// The inked world map's measures (render/worldcarto.ts): a pure function of the camera and its canvas. At the whole
// region the map is fully drawn, at a map's own scale not at all, and the same view always gives the same numbers.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import barovia from '../locations/ch02/barovia-region/world.json';
import sheep from '../locations/wsc/00-region/world.json';
import { band, cartoBands } from '../app/src/render/worldcarto';
import { glyphKind, glyphSvg } from '../app/src/render/worldglyphs';
import { discKey } from '../app/src/render/worldstage';
import { MI_FT } from '../app/src/core/frames';

const widthFt = (w: { bounds: { minX: number; maxX: number } }) => (w.bounds.maxX - w.bounds.minX) * MI_FT;
/** A camera at distance d from its target, and a canvas of the given CSS size. */
const view = (d: number, W: number, H: number) => {
  const cam = new THREE.PerspectiveCamera(40, W / H, 2, 1e6); cam.position.set(0, d, 0.001); cam.lookAt(0, 0, 0);
  return { cam, canvas: { clientWidth: W, clientHeight: H } as HTMLElement };
};
/** The distance at which the region is exactly across the view (fit = 1). */
const fitDist = (regionFt: number, W: number, H: number) => (regionFt / W) * H / (2 * Math.tan(THREE.MathUtils.degToRad(20)));

describe('the inked map\'s bands', () => {
  it('keeps measured default town frames realistic on desktop, portrait phone and TV', () => {
    for (const [d, W, H] of [[8226.427421, 1366, 768], [16964.143992, 390, 844], [8226.427421, 1920, 1080]]) {
      const { cam, canvas } = view(d, W, H);
      expect(cartoBands(cam, new THREE.Vector3(), canvas, widthFt(barovia)).k).toBe(0);
    }
  });
  it('crosses the narrow-screen transition continuously in both directions', () => {
    for (const [W, H] of [[1366, 768], [390, 844], [1920, 1080]]) {
      const at = (effective: number) => {
        const d = effective / Math.min(1, W / 1024) * H / (2 * Math.tan(THREE.MathUtils.degToRad(20))), { cam, canvas } = view(d, W, H);
        return cartoBands(cam, new THREE.Vector3(), canvas, widthFt(barovia)).k;
      };
      expect(at(8)).toBeCloseTo(0, 8); expect(at(18)).toBe(1);
      expect(at(11)).toBeGreaterThan(0.3); expect(at(11)).toBeLessThan(0.7);
      for (const f of [8, 11, 18]) expect(Math.abs(at(f + .001) - at(f - .001))).toBeLessThan(.001);
    }
  });
  it('draws the map fully at the whole region, on a television and on a phone, for both campaigns', () => {
    for (const w of [barovia, sheep]) for (const [W, H] of [[1920, 1080], [1366, 768], [1024, 768], [390, 844]]) {
      const r = widthFt(w), { cam, canvas } = view(fitDist(r, W, H), W, H), v = cartoBands(cam, new THREE.Vector3(), canvas, r);
      expect(v.fit).toBeCloseTo(1, 6);
      expect(v.k).toBe(1); // every region fit is far above 24 ft per pixel
      expect(v.ftPerPx).toBeGreaterThan(24);
    }
  });
  it('is gone at a map\'s own scale and smooth between', () => {
    const r = widthFt(barovia), at = (ftPerPx: number) => { const { cam, canvas } = view(ftPerPx * 768 / (2 * Math.tan(THREE.MathUtils.degToRad(20))), 1366, 768); return cartoBands(cam, new THREE.Vector3(), canvas, r); };
    expect(at(3).k).toBe(0);
    expect(at(5).k).toBeCloseTo(0, 9);
    expect(at(24).k).toBe(1);
    expect(at(11).k).toBeGreaterThan(0.3);
    expect(at(11).k).toBeLessThan(0.7);
    let last = 0; for (let f = 5; f <= 24; f *= 1.1) { const k = at(f).k; expect(k).toBeGreaterThanOrEqual(last); last = k; }
    expect(at(11).ftPerPx).toBeCloseTo(11, 6);
  });
  it('is a pure function of the view: zooming in and back out gives the same numbers', () => {
    const r = widthFt(barovia), a = view(80000, 1366, 768), b = view(3000, 1366, 768), c = view(80000, 1366, 768);
    const va = cartoBands(a.cam, new THREE.Vector3(), a.canvas, r);
    cartoBands(b.cam, new THREE.Vector3(), b.canvas, r);
    expect(cartoBands(c.cam, new THREE.Vector3(), c.canvas, r)).toEqual(va);
  });
  it('band() is 1 at or above hi and 0 at or below lo', () => {
    expect(band(40, 40, 14)).toBe(1); expect(band(100, 40, 14)).toBe(1);
    expect(band(14, 40, 14)).toBe(0); expect(band(2, 40, 14)).toBe(0);
  });
});

describe('the places\' symbols and discs', () => {
  it('gives towns, castles and camps a symbol of our own, and roads, rivers, lakes and peaks none', () => {
    const pins = (barovia as unknown as { pins: { key: string; type: string; name: string; heightFt?: number }[] }).pins;
    const kinds = Object.fromEntries(pins.map((p) => [p.key, glyphKind(p)]));
    expect(kinds).toMatchObject({ N: 'town', E: 'village', S: 'village', W: 'winery', K: 'crag', Q: 'castle', G: 'camp', V: 'tower', X: 'temple', U: 'ruin', O: 'mill', B: 'gate', T: 'gate', Z: 'den' });
    for (const k of ['A', 'D', 'L', 'M', 'C', 'F']) expect(kinds[k]).toBeNull();
    for (const p of pins) { const s = glyphSvg(glyphKind(p)); if (s) { expect(s.startsWith('<svg')).toBe(true); expect(s.match(/<g/g)?.length).toBe(s.match(/<\/g>/g)?.length); expect(s).not.toMatch(/NaN|undefined/); } }
  });
  it('letters the disc with the key, without a number after a letter (the Sheep Chase keys stay whole)', () => {
    expect(['A', 'B2', 'M5', 'D2', '1', '5'].map(discKey)).toEqual(['A', 'B', 'M', 'D', '1', '5']);
  });
});

describe('the ink ribbons', () => {
  it('are one mesh of roads, trails, rivers and bridges within the added-triangle budget (15k)', async () => {
    const { LandField } = await import('../app/src/render/worldland');
    const { buildInk, cartoUniforms, CARTO_STYLES } = await import('../app/src/render/worldcarto');
    for (const w of [barovia, sheep]) {
      const field = new LandField(w as never, []), mesh = buildInk(field, cartoUniforms(field, CARTO_STYLES.gothic));
      const tris = mesh.geometry.index!.count / 3, kinds = new Set(Array.from({ length: mesh.geometry.attributes.aInfo.count }, (_, i) => mesh.geometry.attributes.aInfo.getX(i)));
      expect(tris).toBeLessThanOrEqual(15000);
      expect(kinds.has(0) && kinds.has(2)).toBe(true);
      if (w === barovia) expect(kinds.has(3)).toBe(true); // Barovia's roads cross its rivers: bridges
    }
  });
});
