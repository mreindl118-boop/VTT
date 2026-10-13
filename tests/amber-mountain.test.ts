// The Amber Temple is carved into a mountain: the rock-flank pieces round the facade ledge (scripts/authoring/amber-temple.py)
// must stand on ground the map knows (the outdoor audit's off-ground check) and must close over the temple from every
// side, so no orbit looks past an open edge onto rooms lying on bare snow (review of item 7, amber). The mountain is
// scenery players see from the ledge (never under the fog of war), reads as a mountain and not a terraced pyramid, keeps
// its drifts and boulders to where its foot shows, and the land drawn round the map never buries the temple's floors
// when the section drops to them (the upper level's X23 balcony among them).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PROPS_V1 } from '../app/src/kit/props';
import '../app/src/kit/sites';
import { landHole, underBox } from '../app/src/render/backdrop';

type Pt = [number, number];
interface Obj { id: string; kind: string; pos: [number, number, number]; rotY?: number; dims?: Record<string, number> }
interface Level { id: string; elevationFt: number; ceilingFt?: number; walls: { a: Pt; b: Pt; flags: string[]; heightFt?: number }[]; rooms: { key: string; polygon: Pt[] }[]; objects: Obj[]; terrain?: { polygon: Pt[]; floor: string }[] }

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

  it('is scenery the players see from the ledge: never under the fog of war', () => {
    expect(flank.filter((o) => o.dims?.open !== 1).map((o) => o.id)).toEqual([]);
    const g = (PROPS_V1['rock-flank'] as (d: Record<string, number>) => THREE.Object3D)(flank[0].dims!);
    let n = 0; g.traverse((c) => { const m = c as THREE.Mesh; if (!m.isMesh) return; n++; expect((m.material as THREE.Material).userData.fogExempt?.value, flank[0].id).toBe(1); });
    expect(n).toBeGreaterThan(0);
  });

  it('is no terraced pyramid: each step\'s top swells and sags along it, its faces are cliffs over the ledge and broken slopes elsewhere, and the peak rises to a crest', () => {
    const ring = (tag: string) => flank.filter((o) => new RegExp(`^facade-${tag}\\d+$`).test(o.id));
    const top = (o: Obj) => o.pos[1] + o.dims!.h;
    for (const tag of ['cliff-', 'step2-', 'step3-', 'peak-']) {
      const r = ring(tag), tops = r.map(top);
      expect(r.length, tag).toBeGreaterThan(5);
      expect(Math.max(...tops) - Math.min(...tops), tag).toBeGreaterThan(45);
      // most pieces climb or fall along their own length, so neighbours meet at one height
      expect(r.filter((o) => Math.abs(o.dims!.dh ?? 0) > 1).length, tag).toBeGreaterThan(r.length / 2);
    }
    // the cliff over the facade is sheer; away from it the mountain's faces are mostly broken slopes
    const front = [...ring('cliff-'), ...ring('cliff-f')].filter((o) => o.pos[2] > 240 && o.pos[0] > 0 && o.pos[0] < 230);
    expect(front.length).toBeGreaterThan(3);
    for (const o of front) expect(o.dims!.slope ?? 0, o.id).toBeLessThan(0.05);
    const rest = flank.filter((o) => /step|peak/.test(o.id));
    expect(rest.filter((o) => (o.dims!.slope ?? 0) >= 0.3).length).toBeGreaterThan(rest.length / 2);
    // the peak: its crest stands well above the ends of the ridge
    const peak = ring('peak-').map(top);
    expect(Math.max(...peak) - Math.min(...peak)).toBeGreaterThan(60);
  });

  it('lays its drifts and boulders only where the foot shows, and keeps the mountain to a triangle budget', () => {
    for (const o of flank.filter((x) => /step|peak/.test(x.id))) expect(o.dims!.foot, o.id).toBe(0);
    let tris = 0;
    for (const o of flank) (PROPS_V1['rock-flank'] as (d: Record<string, number>) => THREE.Object3D)(o.dims!).traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh) { const gm = m.geometry; tris += (gm.index ? gm.index.count : gm.attributes.position.count) / 3; } });
    expect(tris).toBeLessThan(40_000);   // some 28k; with a drift and a boulder at every piece's foot it came to 80k
  });

  it('never lies buried under the land drawn round the map: the land is cut open over the temple while the section shows its floors', () => {
    const ground = facade.elevationFt, below = scene.levels.filter((l) => l.id !== 'facade');
    const box = underBox(scene.levels, ground)!;
    expect(box).not.toBeNull();
    const clipped = (planes: THREE.Plane[] | null, x: number, y: number, z: number) => !!planes && planes.every((p) => p.distanceToPoint(new THREE.Vector3(x, y, z)) < 0);
    for (const lv of below) {
      const cut = lv.elevationFt + (lv.ceilingFt ?? 10) - 0.5, planes = landHole(box, cut);   // the section follows the level
      expect(cut).toBeLessThan(ground - 0.3);
      for (const l2 of below) for (const r of l2.rooms) {
        const cx = r.polygon.reduce((a, p) => a + p[0], 0) / r.polygon.length, cz = r.polygon.reduce((a, p) => a + p[1], 0) / r.polygon.length;
        for (const q of r.polygon) {
          const L = Math.hypot(cx - q[0], cz - q[1]) || 1;
          // the land drawn over the map lies 0.4 ft under the ground (render/backdrop.ts)
          expect(clipped(planes, q[0] + (cx - q[0]) / L, ground - 0.4, q[1] + (cz - q[1]) / L), `${lv.id} cut: ${l2.id}/${r.key}`).toBe(true);
        }
      }
      // the land round the temple, and anything under the cut, stays
      expect(clipped(planes, box.maxX + 200, ground - 0.4, (box.minZ + box.maxZ) / 2)).toBe(false);
      expect(clipped(planes, (box.minX + box.maxX) / 2, cut - 1, (box.minZ + box.maxZ) / 2)).toBe(false);
    }
    // the upper level's balcony over the temple of lost secrets (X23) is among the floors uncovered
    expect(scene.levels.find((l) => l.id === 'upper')!.rooms.some((r) => r.key === 'X23')).toBe(true);
    // with the section on the ledge itself, nothing is cut
    expect(landHole(box, null)).toBeNull();
  });
});
