// Scale acceptance (prompt §3/§13). Checks use dimensions stated in manifests or built scenes.
import { describe, expect, it } from 'vitest';
import manifest from '../manifests/locations.json';
import testRoom from '../locations/dev/m0-test-room/scene.json';
import { extentX, extentZ, regularPolygon } from '../app/src/core/geometry';
import { bookSquaresToCells, feetToCells } from '../app/src/core/units';

type Area = { key: string; dims?: Record<string, unknown> };
const area = (loc: string, key: string) => (manifest.locations.find((l) => l.id === loc)!.areas as Area[]).find((a) => a.key === key)!;

describe('scale acceptance', () => {
  it('K12 Turret Post: 30-ft octagon, 3 squares on the 10-ft Map 3 -> exactly 6 cells', () => {
    const d = area('K', 'K12').dims as { widthFt: number; bookSquares: number };
    expect(bookSquaresToCells(d.bookSquares, 10)).toBe(6);
    const oct = regularPolygon([0, 0], 8, d.widthFt);
    expect(extentX(oct)).toBeCloseTo(30, 9);
    expect(feetToCells(extentX(oct))).toBeCloseTo(6, 9);
  });
  it('a 20-ft-square room is 4 x 4 cells (built scene)', () => {
    const t2 = testRoom.levels[0].rooms.find((r) => r.key === 'T2')!;
    const poly = t2.polygon as [number, number][];
    expect([feetToCells(extentX(poly)), feetToCells(extentZ(poly))]).toEqual([4, 4]);
  });
  it('Blood of the Vine (E2) 60-ft footprint is 12 x 12 cells', () => {
    const d = area('E', 'E2').dims as { footprintFt: [number, number] };
    expect(d.footprintFt.map(feetToCells)).toEqual([12, 12]);
  });
  it('River Ivlis (D) is 50 ft wide = 10 cells', () => {
    expect(feetToCells((area('D', 'D').dims as { widthFt: number }).widthFt)).toBe(10);
  });
  it.todo('Church nave (E5) measures to the book once OCR supplies its dimensions');
});
