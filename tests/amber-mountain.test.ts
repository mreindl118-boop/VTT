// The Amber Temple is carved into a mountain: the rock-flank pieces round the facade ledge (scripts/authoring/amber-temple.py)
// must stand on ground the map knows (the outdoor audit's off-ground check) and must close over the temple from every
// side, so no orbit looks past an open edge onto rooms lying on bare snow (review of item 7, amber).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type Pt = [number, number];
interface Obj { id: string; kind: string; pos: [number, number, number]; rotY?: number; dims?: Record<string, number> }
interface Level { id: string; walls: { a: Pt; b: Pt; flags: string[]; heightFt?: number }[]; rooms: { key: string; polygon: Pt[] }[]; objects: Obj[]; terrain?: { polygon: Pt[]; floor: string }[] }

const scene = JSON.parse(readFileSync(resolve(__dirname, '..', 'locations/ch13/X/scene.json'), 'utf8')) as { levels: Level[] };
const facade = scene.levels.find((l) => l.id === 'facade')!;
const flank = facade.objects.filter((o) => o.kind === 'rock-flank');

/** The same even-odd test scripts/authoring/audit-outdoor.py uses. */
function inside(p: Pt, poly: Pt[]): boolean {
  let c = false;
  for (let i = 0, n = poly.length; i < n; i++) {
    const [x0, z0] = poly[i], [x1, z1] = poly[(i + 1) % n];
    if ((z0 > p[1]) !== (z1 > p[1]) && p[0] < ((x1 - x0) * (p[1] - z0)) / (z1 - z0) + x0) c = !c;
  }
  return c;
}
/** A rock-flank piece's foot: `len` ft along its local x (turned by rotY about +y, as the kit builds it). */
function foot(o: Obj): [Pt, Pt] {
  const a = ((o.rotY ?? 0) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), h = (o.dims?.len ?? 30) / 2;
  return [[o.pos[0] - c * h, o.pos[2] + s * h], [o.pos[0] + c * h, o.pos[2] - s * h]];
}
function hits(p: Pt, dir: Pt, [a, b]: [Pt, Pt]): boolean {
  const ex = b[0] - a[0], ez = b[1] - a[1], den = dir[0] * ez - dir[1] * ex;
  if (Math.abs(den) < 1e-9) return false;
  const t = ((a[0] - p[0]) * ez - (a[1] - p[1]) * ex) / den, u = ((a[0] - p[0]) * dir[1] - (a[1] - p[1]) * dir[0]) / den;
  return t > 0 && u >= 0 && u <= 1;
}

describe('the mountain over the Amber Temple', () => {
  it('has its rock-flank pieces', () => { expect(flank.length).toBeGreaterThan(40); });

  it('stands every piece on the map\'s ground (no off-ground finding)', () => {
    const ground = (facade.terrain ?? []).filter((t) => ['grass', 'snow', 'marsh'].includes(t.floor)).map((t) => t.polygon);
    const off = flank.filter((o) => !ground.some((g) => inside([o.pos[0], o.pos[2]], g))).map((o) => o.id);
    expect(off).toEqual([]);
  });

  it('closes round the temple: from every room corner under it, every bearing meets a rock face', () => {
    // the rock faces, and the facade itself: its full-height walls close the temple's front behind the ledge
    const feet = [...flank.map(foot), ...facade.walls.filter((w) => w.flags.includes('normal') && (w.heightFt ?? 50) >= 20).map((w): [Pt, Pt] => [w.a, w.b])];
    // the massif's ground is the snow polygon the pieces stand on; the ledge before the facade is the room X1
    const massif = (facade.terrain ?? []).filter((t) => t.floor === 'snow').map((t) => t.polygon).filter((g) => flank.some((o) => inside([o.pos[0], o.pos[2]], g)));
    const ledge = facade.rooms.filter((r) => r.key === 'X1').map((r) => r.polygon);
    const archway = new Set(['upper/X2']);   // the entrance hall at the foot of the icy steps, open up through the arch
    const open: string[] = [], loose: string[] = [];
    for (const lv of scene.levels.filter((l) => l.id !== 'facade')) {
      for (const r of lv.rooms) {
        const cx = r.polygon.reduce((a, p) => a + p[0], 0) / r.polygon.length, cz = r.polygon.reduce((a, p) => a + p[1], 0) / r.polygon.length;
        for (const q of r.polygon) {
          const L = Math.hypot(cx - q[0], cz - q[1]) || 1, p: Pt = [q[0] + (cx - q[0]) / L, q[1] + (cz - q[1]) / L];   // 1 ft inside the room
          if (!massif.some((g) => inside(p, g))) { if (!ledge.some((g) => inside(p, g)) && !archway.has(`${lv.id}/${r.key}`)) loose.push(`${lv.id}/${r.key}`); continue; }
          for (let k = 0; k < 16; k++) {
            const a = (k / 16) * Math.PI * 2, dir: Pt = [Math.cos(a), Math.sin(a)];
            if (!feet.some((f) => hits(p, dir, f))) { open.push(`${lv.id}/${r.key} bearing ${k * 22.5}`); break; }
          }
        }
      }
    }
    expect(loose, 'room corners under neither the mountain nor the ledge').toEqual([]);
    expect([...new Set(open)]).toEqual([]);
  });
});
