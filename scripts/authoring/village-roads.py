#!/usr/bin/env python3
"""Village of Barovia streets, traced from the book map (p.42) in the same measured frame as the houses
(`village-map.py`: 85 px per 40-ft square at 200 dpi), so the houses line the streets. Only centrelines and
widths are recorded here. Rewrites the cobble terrain and the grid; keeps the grass, graves, trees, houses."""
import json
from collections import OrderedDict

PX = 85 / 40.0; OX, OY = 928 % 85, 1335 % 85
S = 1.1  # the page render was read at 1545 px wide; the measured frame is the 1700-px render
CROP = (184, 164)  # the houses were measured on a crop of the page: its origin on the page (template-matched)
def ft(px, py): return [round((px * S - CROP[0] - OX) / PX, 1), round((py * S - CROP[1] - OY) / PX, 1)]
# street centrelines (px on the displayed page), width in ft
STREETS = [
    ('Main street', 20, [(185, 1012), (300, 1000), (440, 998), (560, 1000), (650, 990), (760, 998), (900, 1008), (1040, 1010), (1180, 1010), (1260, 1030)]),
    ('Church street', 16, [(455, 680), (500, 720), (560, 770), (620, 820), (680, 880), (700, 940), (700, 1000)]),
    ('North loop', 16, [(770, 998), (790, 900), (830, 810), (890, 730), (960, 680), (1050, 650), (1130, 660), (1200, 720), (1210, 800), (1180, 880), (1120, 950), (1070, 1010)]),
    ('West lane', 14, [(700, 1000), (690, 1080), (640, 1120), (600, 1200), (590, 1300), (600, 1400), (650, 1460), (690, 1500)]),
    ('Middle lane', 14, [(780, 1000), (790, 1100), (800, 1250), (790, 1380), (760, 1450), (700, 1480)]),
    ('East lane', 14, [(1050, 1010), (1060, 1120), (1050, 1240), (1000, 1330), (930, 1400), (880, 1460), (820, 1480)]),
    ('Cross lane', 12, [(600, 1250), (800, 1255), (1000, 1250)]),
    ('North road', 16, [(1200, 720), (1210, 600), (1230, 500), (1240, 440)]),
    ('Cemetery path', 10, [(455, 650), (420, 600), (380, 560), (340, 500)]),
]

def strip(pts, w):
    """A road as one polygon per segment plus a disc at each joint (terrain may overlap)."""
    out = []
    h = w / 2
    for i in range(len(pts) - 1):
        (x0, z0), (x1, z1) = pts[i], pts[i + 1]
        dx, dz = x1 - x0, z1 - z0; L = (dx * dx + dz * dz) ** 0.5 or 1
        nx, nz = -dz / L * h, dx / L * h
        out.append([[round(x0 + nx, 1), round(z0 + nz, 1)], [round(x1 + nx, 1), round(z1 + nz, 1)], [round(x1 - nx, 1), round(z1 - nz, 1)], [round(x0 - nx, 1), round(z0 - nz, 1)]])
    import math
    for (x, z) in pts[1:-1]:
        out.append([[round(x + math.cos(a) * h, 1), round(z + math.sin(a) * h, 1)] for a in [k * math.pi / 4 for k in range(8)]])
    return out

scene = json.load(open('locations/ch03/E/scene.json'), object_pairs_hook=OrderedDict)
grid = json.load(open('locations/ch03/E/grid.json'), object_pairs_hook=OrderedDict)
lv = scene['levels'][0]
grass = [t for t in lv['terrain'] if t['floor'] != 'cobble']
roads = []
for name, w, pts in STREETS:
    for poly in strip([ft(*p) for p in pts], w): roads.append(OrderedDict(polygon=poly, floor='cobble'))
lv['terrain'] = grass + roads
import os, sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from settle import settle
print('settle:', settle(lv, keyed={'E1': (32, 24, 1), 'E2': (40, 30, 2), 'E3': (30, 26, 2), 'E4': (52, 40, 2), 'E7': (40, 30, 3)}, ground_margin=80))
gl = grid['levels']['village']
gl['floorPolygons'] = [t['polygon'] for t in grass]
json.dump(scene, open('locations/ch03/E/scene.json', 'w'), indent=1)
json.dump(grid, open('locations/ch03/E/grid.json', 'w'), indent=1)
print('village streets:', len(STREETS), 'streets,', len(roads), 'pieces')
