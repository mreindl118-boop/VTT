import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { SceneFile } from '../app/src/core/schema';
import { heightfield } from '../app/src/kit/sites/s';

function loadKrezk(): SceneFile {
  return JSON.parse(readFileSync('locations/ch08/S/scene.json', 'utf8')) as SceneFile;
}

function decodeHeightfield(dims: Record<string, number>) {
  const nx = dims.nx | 0;
  const nz = dims.nz | 0;
  const cell = dims.cell ?? 10;
  const q = dims.q ?? 0.5;
  const W = nx + 1;
  const H: (number | null)[] = [];
  for (let k = 0; k < W * (nz + 1); k++) {
    const v = dims[`d${Math.floor(k / 4)}`];
    const c = v === undefined ? 4095 : Math.floor(v / Math.pow(4096, k % 4)) % 4096;
    H.push(c === 4095 ? null : c * q);
  }
  return { nx, nz, cell, W, H };
}

function sampleLattices(lattices: { x: number; z: number; dims: Record<string, number> }[], px: number, pz: number): number | null {
  for (let idx = lattices.length - 1; idx >= 0; idx--) {
    const { x: lx, z: lz, dims } = lattices[idx];
    const { nx, nz, cell, W, H } = decodeHeightfield(dims);
    const fx = (px - lx) / cell;
    const fz = (pz - lz) / cell;
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
    const a = j * W + i;
    const b = a + 1;
    const c = a + W + 1;
    const e = a + W;
    if (H[a] === null || H[b] === null || H[c] === null || H[e] === null) continue;
    const tx = fx - i;
    const tz = fz - j;
    if (Math.abs(H[a]! - H[c]!) < Math.abs(H[b]! - H[e]!)) {
      if (tx >= tz) return H[a]! + (H[b]! - H[a]!) * tx + (H[c]! - H[b]!) * tz;
      return H[a]! + (H[e]! - H[a]!) * tz + (H[c]! - H[e]!) * tx;
    }
    if (tx + tz <= 1) return H[a]! + (H[b]! - H[a]!) * tx + (H[e]! - H[a]!) * tz;
    return H[c]! + (H[b]! - H[c]!) * (1 - tz) + (H[e]! - H[c]!) * (1 - tx);
  }
  return null;
}

describe('item 6 Krezk review fixes', () => {
  it('blends the mountain heightfield down at the N and E frame edges with a short skirt drop', () => {
    const scene = loadKrezk();
    const village = scene.levels.find((l) => l.id === 'village')!;
    const mtn = village.objects.find((o) => o.id === 'land-mountain')!;
    expect(mtn.dims?.drop).toBe(14);
    const { nx, nz, W, H } = decodeHeightfield(mtn.dims!);
    let maxEdgeH = 0;
    for (let i = 0; i <= nx; i++) {
      for (const j of [0, nz]) {
        const h = H[j * W + i];
        if (h !== null) maxEdgeH = Math.max(maxEdgeH, h);
      }
    }
    for (let j = 0; j <= nz; j++) {
      for (const i of [0, nx]) {
        const h = H[j * W + i];
        if (h !== null) maxEdgeH = Math.max(maxEdgeH, h);
      }
    }
    expect(maxEdgeH).toBeLessThanOrEqual(60);
  });

  it('keeps the third switchback leg clear of the rim lip so rock does not pinch the road', () => {
    const scene = loadKrezk();
    const village = scene.levels.find((l) => l.id === 'village')!;
    const lattices = village.objects
      .filter((o) => o.kind === 'heightfield')
      .map((o) => ({ x: o.pos[0], z: o.pos[2], dims: o.dims! }));
    const road = village.objects.find((o) => o.id === 'S5-road')!;
    const n = road.dims!.n;
    for (let i = 0; i < n; i++) {
      const rx = road.dims![`x${i}`];
      const ry = road.dims![`y${i}`];
      const rz = road.dims![`z${i}`];
      if (ry > 130 && ry < 192) {
        const ly = sampleLattices(lattices, rx, rz) ?? 0;
        expect(ly - ry, `road point ${i} at (${rx}, ${rz}) y=${ry} vs land=${ly}`).toBeLessThanOrEqual(4);
      }
    }
  });

  it('places every S4 pool boulder on the ground surface, not buried inside the cliff', () => {
    const scene = loadKrezk();
    const village = scene.levels.find((l) => l.id === 'village')!;
    const lattices = village.objects
      .filter((o) => o.kind === 'heightfield')
      .map((o) => ({ x: o.pos[0], z: o.pos[2], dims: o.dims! }));
    const s4Rocks = village.objects.filter((o) => o.id.startsWith('S4-rock'));
    expect(s4Rocks.length).toBe(6);
    for (const r of s4Rocks) {
      const ly = sampleLattices(lattices, r.pos[0], r.pos[2]) ?? 0;
      expect(Math.abs(r.pos[1] - ly), `${r.id} at (${r.pos[0]}, ${r.pos[2]}) y=${r.pos[1]} vs land=${ly}`).toBeLessThanOrEqual(2);
    }
  });

  it('caches DoubleSide heightfield materials per colour and thins upper-mountain pines', () => {
    const scene = loadKrezk();
    const village = scene.levels.find((l) => l.id === 'village')!;
    const mtn = village.objects.find((o) => o.id === 'land-mountain')!;
    const cliff = village.objects.find((o) => o.id === 'land-cliff')!;
    const g1 = heightfield(mtn.dims!);
    const g2 = heightfield(cliff.dims!);
    const mats1 = new Set<THREE.Material>();
    g1.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) mats1.add((c as THREE.Mesh).material as THREE.Material);
    });
    let shared = 0;
    g2.traverse((c) => {
      if ((c as THREE.Mesh).isMesh && mats1.has((c as THREE.Mesh).material as THREE.Material)) shared++;
    });
    expect(shared).toBeGreaterThan(0);

    const mPines = village.objects.filter((o) => o.id.startsWith('pine-m'));
    expect(mPines.length).toBeLessThan(1100);
  });
});
