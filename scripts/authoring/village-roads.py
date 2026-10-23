#!/usr/bin/env python3
"""Village of Barovia streets, traced from the book map (p.42) in the same measured frame as the houses
(`village-map.py`: 85 px per 40-ft square at 200 dpi), so the houses line the streets. Only centrelines and
widths are recorded here. Each street is a mitred quad strip meeting at shared junctions and ending on another
street, at a plot, or at a road exit. Rewrites the cobble terrain and the grid; keeps the grass, graves, trees,
and settled houses."""
import json, math, os, sys
from collections import OrderedDict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from settle import rect

PX = 85 / 40.0; OX, OY = 928 % 85, 1335 % 85
S = 1.1  # the page render was read at 1545 px wide; the measured frame is the 1700-px render
CROP = (184, 164)  # the houses were measured on a crop of the page: its origin on the page (template-matched)
def ft(px, py): return [round((px * S - CROP[0] - OX) / PX, 1), round((py * S - CROP[1] - OY) / PX, 1)]

# Connected street centrelines (px on the displayed page), width in ft:
# - Church street and Cemetery path meet on E5's south edge (435, 656); Cemetery path ends on E6's south edge (455, 424).
# - Church street and West lane meet Main street at (693, 1000).
# - North loop meets Main street at (768, 998) and (1076, 1010), passing west of Death House's plot (E7).
# - Middle lane meets Main street at (780, 1000), joins West lane and East lane at (700, 1480), and reaches E4 at (700, 1560).
# - Cross lane connects West lane (594, 1260), Middle lane (800, 1260), and East lane (1048, 1265).
# - North road branches from North loop at (1130, 660) to the northern road exit at (1240, 415).
STREETS = [
    ('Main street', 20, [(185, 1012), (300, 1000), (440, 998), (560, 1000), (650, 990), (693, 1000), (768, 998), (780, 1000), (900, 1008), (1050, 1010), (1076, 1010), (1180, 1010), (1260, 1030)]),
    ('Church street', 16, [(435, 656), (500, 720), (560, 770), (620, 820), (680, 880), (693, 940), (693, 1000)]),
    ('North loop', 16, [(768, 998), (772, 965), (786, 940), (792, 870), (805, 830), (840, 810), (890, 730), (960, 672), (1020, 661), (1078, 654), (1130, 660), (1126, 835), (1142, 875), (1125, 955), (1076, 1010)]),
    ('West lane', 14, [(693, 1000), (682, 1075), (640, 1120), (600, 1200), (594, 1260), (590, 1300), (600, 1400), (650, 1460), (700, 1480)]),
    ('Middle lane', 14, [(780, 1000), (790, 1100), (800, 1260), (790, 1380), (760, 1450), (700, 1480), (700, 1560)]),
    ('East lane', 14, [(1050, 1010), (1062, 1120), (1060, 1220), (1048, 1265), (1000, 1330), (930, 1400), (880, 1460), (820, 1480), (700, 1480)]),
    ('Cross lane', 12, [(594, 1260), (800, 1260), (1048, 1265)]),
    ('North road', 16, [(1130, 660), (1200, 650), (1210, 600), (1230, 500), (1240, 415)]),
    ('Cemetery path', 10, [(435, 656), (415, 600), (380, 560), (405, 480), (455, 424)]),
]

def strip(pts, w):
    """A mitred road strip: one 4-vertex quad per segment of `pts`, sharing exact mitred cross-edges at every bend."""
    h = w / 2.0
    n = len(pts)
    norms = []
    for i in range(n - 1):
        (x0, z0), (x1, z1) = pts[i], pts[i + 1]
        dx, dz = x1 - x0, z1 - z0
        L = math.hypot(dx, dz) or 1.0
        norms.append((-dz / L, dx / L))
    left, right = [], []
    for i, (x, z) in enumerate(pts):
        if i == 0:
            nx, nz = norms[0]
            mx, mz = nx * h, nz * h
        elif i == n - 1:
            nx, nz = norms[-1]
            mx, mz = nx * h, nz * h
        else:
            n0x, n0z = norms[i - 1]
            n1x, n1z = norms[i]
            denom = max(0.35, 1.0 + n0x * n1x + n0z * n1z)
            mx, mz = (n0x + n1x) * h / denom, (n0z + n1z) * h / denom
        left.append([round(x + mx, 1), round(z + mz, 1)])
        right.append([round(x - mx, 1), round(z - mz, 1)])
    return [[left[i], left[i + 1], right[i + 1], right[i]] for i in range(n - 1)]

scene = json.load(open('locations/ch03/E/scene.json'), object_pairs_hook=OrderedDict)
grid = json.load(open('locations/ch03/E/grid.json'), object_pairs_hook=OrderedDict)
lv = scene['levels'][0]
grass = [t for t in lv['terrain'] if t['floor'] != 'cobble']
roads = []
for name, w, pts in STREETS:
    for poly in strip([ft(*p) for p in pts], w):
        roads.append(OrderedDict(polygon=poly, floor='cobble'))
lv['terrain'] = grass + roads

# Sync each built keyed site's room polygon to its primary building footprint without moving settled houses.
houses = [o for o in lv['objects'] if o['kind'] == 'house']
for rm in lv.get('rooms', []):
    k = rm.get('key')
    if k not in ('E1', 'E2', 'E3', 'E4', 'E7'):
        continue
    keyed_houses = [o for o in houses if o.get('key') == k]
    if keyed_houses:
        primary = max(keyed_houses, key=lambda o: o['dims']['w'] * o['dims']['d'])
        rm['polygon'] = [[round(p[0], 1), round(p[1], 1)] for p in rect(primary)]

gl = grid['levels']['village']
gl['floorPolygons'] = [t['polygon'] for t in grass]
json.dump(scene, open('locations/ch03/E/scene.json', 'w', newline='\n'), indent=1)
json.dump(grid, open('locations/ch03/E/grid.json', 'w', newline='\n'), indent=1)
print('village streets:', len(STREETS), 'streets,', len(roads), 'pieces')
