#!/usr/bin/env python3
"""Land cover for the Sheep Chase country from the mapset's region hexes (one mile flat-to-flat, pointy, odd rows
shifted right), on the same eighth-mile lattice the heightfield uses: W/F woodland and forest → f, H hills → h,
everything else (town, pasture, road, path, stream, the compound clearing) open ground. The stream stays a river
line. Adds `cover` + `cellMiles` to locations/wsc/00-region/world.json; run heightfield.py after."""
import json, math, os
from collections import OrderedDict

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
M = json.load(open(os.path.join(ROOT, 'reference/imports/wsc/mapset.json')))
maps = {m['id']: m for m in M['maps']}
R = maps['00-region']; f = 1.0; h = 2 * f / math.sqrt(3)
def hx(col, row): return [f / 2 + col * f + (f / 2 if row % 2 else 0), h / 2 + row * 0.75 * h]
cells = {(c['col'], c['row']): c['code'] for c in R['cells']}
CLASS = {'W': 'f', 'F': 'f', 'H': 'h'}

path = os.path.join(ROOT, 'locations/wsc/00-region/world.json')
w = json.load(open(path), object_pairs_hook=OrderedDict)
b = w['bounds']; cell = 0.125
cols = int(math.ceil((b['maxX'] - b['minX']) / cell)); rows = int(math.ceil((b['maxY'] - b['minY']) / cell))
centres = [(hx(*k), code) for k, code in cells.items()]
grid = []
for r in range(rows):
    line = ''
    for c in range(cols):
        x, y = b['minX'] + (c + 0.5) * cell, b['minY'] + (r + 0.5) * cell
        best = min(centres, key=lambda cc: (cc[0][0] - x) ** 2 + (cc[0][1] - y) ** 2)
        d = math.hypot(best[0][0] - x, best[0][1] - y)
        line += 'x' if d > h / 2 + 0.3 else CLASS.get(best[1], '.')
    grid.append(line)
w['cellMiles'] = cell; w['cover'] = grid
# cover goes before pins for readability
out = OrderedDict()
for k, v in w.items():
    if k in ('cover', 'cellMiles', 'height'): continue
    out[k] = v
    if k == 'bounds': out['cellMiles'] = cell; out['cover'] = grid
json.dump(out, open(path, 'w'), indent=1)
from collections import Counter
print('wsc cover', cols, 'x', rows, Counter(''.join(grid)))
