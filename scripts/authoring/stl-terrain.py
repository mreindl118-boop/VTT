#!/usr/bin/env python3
"""Import a terrain mesh (STL, binary or ASCII) as a region's heightfield: the mesh's top surface is sampled on the
world's lattice (cellMiles) and written to world.json `height` (feet, relative to the lowest settlement), replacing
the one heightfield.py derives from land cover. The land cover, pins, roads and rivers stay as they are, so the
world map, the backdrops and every map keep their tags; only the ground's shape changes.

Registration: the mesh's footprint (x, y in its own units, z up unless --zup is off) is stretched to the world's
bounds; --flip-y if the mesh's +y points south; --rotate 90|180|270 if it is turned; --relief scales the vertical so
that the mesh's highest point equals the given number of feet (default 8000, about Mount Ghakis).
Usage: stl-terrain.py <mesh.stl> [world.json] [--flip-y] [--flip-x] [--rotate N] [--relief FT] [--yup]"""
import json, struct, sys, os, math
from collections import OrderedDict
import numpy as np

def read_stl(path):
    raw = open(path, 'rb').read()
    if raw[:5].lower() == b'solid' and b'facet' in raw[:4096]:
        v = [list(map(float, l.split()[1:4])) for l in raw.decode('ascii', 'ignore').splitlines() if l.strip().startswith('vertex')]
        return np.array(v, float).reshape(-1, 3, 3)
    if len(raw) < 84: raise SystemExit(f'{path}: not an STL ({len(raw)} bytes): {raw[:120]!r}')
    n = struct.unpack('<I', raw[80:84])[0]
    if len(raw) < 84 + n * 50: raise SystemExit(f'{path}: truncated binary STL ({len(raw)} bytes for {n} triangles)')
    a = np.frombuffer(raw[84:84 + n * 50], dtype=np.dtype([('n', '<f4', 3), ('v', '<f4', (3, 3)), ('a', '<u2')]))
    return a['v'].astype(float)

def main():
    args = sys.argv[1:]
    if not args: print(__doc__); return
    mesh = args[0]; world = next((a for a in args[1:] if a.endswith('.json')), 'locations/ch02/barovia-region/world.json')
    opt = lambda k, d=None: args[args.index(k) + 1] if k in args else d
    T = read_stl(mesh)
    if '--yup' in args: T = T[:, :, [0, 2, 1]]
    P = T.reshape(-1, 3)
    W = json.load(open(world), object_pairs_hook=OrderedDict); b = W['bounds']; cell = W.get('cellMiles', 0.125)
    cols = int(math.ceil((b['maxX'] - b['minX']) / cell)); rows = int(math.ceil((b['maxY'] - b['minY']) / cell))
    # normalise the footprint to 0..1, apply the turn and flips, map onto the world's bounds
    x0, x1, y0, y1 = P[:, 0].min(), P[:, 0].max(), P[:, 1].min(), P[:, 1].max()
    u = (T[:, :, 0] - x0) / (x1 - x0); v = (T[:, :, 1] - y0) / (y1 - y0)
    for _ in range(int(opt('--rotate', 0)) // 90 % 4): u, v = v, 1 - u
    if '--flip-x' in args: u = 1 - u
    if '--flip-y' not in args: v = 1 - v            # STL +y is north by default; the world's +y is south
    z = T[:, :, 2]
    # rasterise the top surface: every triangle stamps the max of its vertices' heights into the cells it covers
    H = np.full((rows, cols), np.nan)
    gx = u * cols; gy = v * rows
    for t in range(len(T)):
        c0, c1 = int(max(0, math.floor(gx[t].min()))), int(min(cols - 1, math.ceil(gx[t].max())))
        r0, r1 = int(max(0, math.floor(gy[t].min()))), int(min(rows - 1, math.ceil(gy[t].max())))
        if c1 < c0 or r1 < r0: continue
        (ax, ay), (bx, by), (cx, cy) = zip(gx[t], gy[t]); den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(den) < 1e-12: continue
        for r in range(r0, r1 + 1):
            for c in range(c0, c1 + 1):
                px, py = c + 0.5, r + 0.5
                l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den; l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den; l3 = 1 - l1 - l2
                if min(l1, l2, l3) < -1e-6: continue
                h = l1 * z[t][0] + l2 * z[t][1] + l3 * z[t][2]
                if not (H[r, c] >= h): H[r, c] = h
    # fill holes from neighbours, then scale the relief
    from scipy import ndimage as ndi
    mask = np.isnan(H)
    if mask.all(): raise SystemExit('the mesh does not cover the world bounds')
    idx = ndi.distance_transform_edt(mask, return_distances=False, return_indices=True); H = H[tuple(idx)]
    H = (H - H.min()) / max(1e-9, H.max() - H.min()) * float(opt('--relief', 8000))
    sett = [p for p in W['pins'] if p['type'] == 'settlement']
    at = lambda p: H[min(rows - 1, max(0, int((p['pos'][1] - b['minY']) / cell))), min(cols - 1, max(0, int((p['pos'][0] - b['minX']) / cell)))]
    H -= min(at(p) for p in sett) if sett else H.min()
    W['cellMiles'] = cell; W['height'] = [[int(round(v / 10) * 10) for v in row] for row in H]
    W['heightSource'] = os.path.basename(mesh)
    json.dump(W, open(world, 'w'), indent=1)
    print(world, 'height from', os.path.basename(mesh), H.shape, 'min', int(H.min()), 'max', int(H.max()), {p['key']: int(at(p)) for p in W['pins'][:14]})

if __name__ == '__main__': main()
