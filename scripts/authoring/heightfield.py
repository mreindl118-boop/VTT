#!/usr/bin/env python3
"""A heightfield for a region's world.json, so every outdoor map stands in the same logical topography.

With a land-cover grid (Barovia, read off the printed map) the ground rises by class: valley floor and forest
low, hills in the middle, mountains high, the mists on the rim higher still (the valley is walled in), water at
the bottom; the named peaks are true summits and the castle's rock a true crag. Without one (the Sheep Chase
country) the field is raised from the map's features: hills and the fell from the high points and peaks, the
stream in its cut. The field is smoothed so slopes read as land, not as cells, and written as `height` rows
(feet, relative to the lowest settlement) on the cover lattice. Usage: heightfield.py <world.json> [...]"""
import json, sys, math
from collections import OrderedDict
import numpy as np
from scipy import ndimage as ndi

CLASS_FT = {'.': 140, 'f': 160, 'h': 900, 'm': 2600, 'w': -30, 'x': 3200}
PEAK_FT = {'Ghakis': 7400, 'Baratok': 7800, 'Balinok': 4200, 'Fell': 2600, 'Tor': 1800, 'Hill': 900}

def peak_height(name):
    for k, v in PEAK_FT.items():
        if k.lower() in name.lower(): return v
    return 3200

def build(world):
    b = world['bounds']; cell = world.get('cellMiles', 0.125)
    cols = int(math.ceil((b['maxX'] - b['minX']) / cell)); rows = int(math.ceil((b['maxY'] - b['minY']) / cell))
    X = b['minX'] + (np.arange(cols) + 0.5) * cell; Y = b['minY'] + (np.arange(rows) + 0.5) * cell
    gx, gy = np.meshgrid(X, Y)
    cover = world.get('cover')
    if cover:
        H = np.zeros((rows, cols))
        for r in range(rows):
            line = cover[r] if r < len(cover) else ''
            for c in range(cols): H[r, c] = CLASS_FT.get(line[c] if c < len(line) else 'x', 140)
        H = ndi.gaussian_filter(H, 1.6)
        # the valley floor is not a table: the land climbs away from the rivers and lakes toward the hills,
        # so every lowland town sits in a bowl with its water at the bottom
        water = np.zeros((rows, cols), bool)
        for r in range(rows):
            line = cover[r] if r < len(cover) else ''
            for c in range(cols): water[r, c] = (line[c] if c < len(line) else 'x') == 'w'
        for rv in world.get('rivers', []):
            pts = np.array(rv['pts'], float)
            for a, c2 in zip(pts[:-1], pts[1:]):
                dx, dy = c2 - a; L2 = dx * dx + dy * dy or 1e-9
                t = np.clip(((gx - a[0]) * dx + (gy - a[1]) * dy) / L2, 0, 1); d = np.hypot(gx - a[0] - dx * t, gy - a[1] - dy * t)
                water |= d < cell * 0.75
        if water.any():
            dist = ndi.distance_transform_edt(~water) * cell   # miles to the nearest water
            H += np.clip(dist, 0, 2.5) * 150                   # 150 ft per mile, up to 375 ft
        # the mists: beyond the frame the ground keeps rising (the valley has no way out)
        edge = np.minimum.reduce([gx - b['minX'], b['maxX'] - gx, gy - b['minY'], b['maxY'] - gy])
        H += np.clip((0.6 - edge) / 0.6, 0, 1) * 1800
    else:
        H = np.full((rows, cols), 120.0)
        for p in world.get('high', []):
            d = np.hypot(gx - p[0], gy - p[1]); H += 700 * np.exp(-(d * d) / (2 * 0.55 ** 2))
        for lk in world.get('lakes', []):
            d = np.hypot((gx - lk['center'][0]) / max(lk['r'][0], 0.05), (gy - lk['center'][1]) / max(lk['r'][1], 0.05)); H -= 120 * np.clip(1.2 - d, 0, 1)
        for rv in world.get('rivers', []):
            pts = np.array(rv['pts'], float)
            for a, c in zip(pts[:-1], pts[1:]):
                dx, dy = c - a; L2 = dx * dx + dy * dy or 1e-9
                t = np.clip(((gx - a[0]) * dx + (gy - a[1]) * dy) / L2, 0, 1); d = np.hypot(gx - a[0] - dx * t, gy - a[1] - dy * t)
                H -= 70 * np.exp(-(d * d) / (2 * 0.12 ** 2))
        H = ndi.gaussian_filter(H, 1.0)
    # named peaks are true summits
    for pk in world.get('peaks', []):
        # Mount Baratok is a single monolith (the module: its presence oppressive, the slopes climbing from the lake); broad
        h = peak_height(pk['name']); d = np.hypot(gx - pk['pos'][0], gy - pk['pos'][1]); sig = pk.get('spread', 1.25 if 'Baratok' in pk['name'] else 0.7 if h > 4000 else 0.5)
        H = np.maximum(H, H * 0.3 + h * np.exp(-(d * d) / (2 * sig ** 2)))
    # Mount Ghakis is a massif, not a cone: the Tsolenka road 'hugs Mount Ghakis, climbing to great heights' (p.157) and the
    # Amber Temple is carved into its snowy slope (p.182), so its shoulders run west from the summit along the pass
    # road, falling toward the Raven River (miles, peak feet, spread in miles)
    if any(pk['name'] == 'Mount Ghakis' for pk in world.get('peaks', [])):
        for sx, sy, h, sig in [(6.2, 11.2, 6600, 0.9), (5.2, 11.2, 5800, 0.8), (4.2, 10.6, 4300, 0.65), (3.3, 10.0, 3400, 0.5)]:
            d = np.hypot(gx - sx, gy - sy); H = np.maximum(H, H * 0.3 + h * np.exp(-(d * d) / (2 * sig ** 2)))
    # a site on its crag: a pillar of rock rising out of whatever stands there
    for p in world.get('pins', []):
        if p.get('heightFt'):
            d = np.hypot(gx - p['pos'][0], gy - p['pos'][1])
            base = H[np.unravel_index(np.argmin(d), d.shape)]
            # the land carries a broad shoulder to just under half the height; the sheer pillar above it is drawn as rock
            # (a cliff is far finer than this lattice can hold)
            H = np.where(d < 0.5, np.maximum(H, base + 0.45 * p['heightFt'] * np.clip(1 - (d - 0.05) / 0.42, 0, 1) ** 0.8), H)
    # the lowest settlement is the datum
    sett = [p for p in world.get('pins', []) if p['type'] == 'settlement'] or world.get('pins', [])[:1]
    datum = min(float(H[min(rows - 1, max(0, int((p['pos'][1] - b['minY']) / cell))), min(cols - 1, max(0, int((p['pos'][0] - b['minX']) / cell)))]) for p in sett) if sett else float(H.min())
    H -= datum
    world['cellMiles'] = cell
    world['height'] = [[int(round(v / 10) * 10) for v in row] for row in H]
    return H

if __name__ == '__main__':
    for path in sys.argv[1:]:
        w = json.load(open(path), object_pairs_hook=OrderedDict)
        H = build(w)
        json.dump(w, open(path, 'w'), indent=1)
        print(path, 'height', H.shape, 'min', int(H.min()), 'max', int(H.max()), 'at pins:', {p['key']: int(H[min(H.shape[0]-1, max(0, int((p['pos'][1]-w['bounds']['minY'])/w['cellMiles']))), min(H.shape[1]-1, max(0, int((p['pos'][0]-w['bounds']['minX'])/w['cellMiles'])))]) for p in w['pins'][:12]})
