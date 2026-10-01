#!/usr/bin/env python3
"""Castle Ravenloft's exterior, derived from the castle we authored level by level (locations/ch04/K), so the
silhouette on the valley's skyline is the module's own plan and not a sketch: every 5-ft column of the castle rises
to the top of the highest room above it (the courtyards stay open), the curtain walls stand at their own height
with battlements, every stair tower is a round tower to its top with a conical cap, and windows are lit along the
outer faces at each storey. Writes a compact massing file the backdrop reads: locations/ch04/K/exterior.json."""
import json, math, os
from collections import OrderedDict

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
S = json.load(open(os.path.join(ROOT, 'locations/ch04/K/scene.json')))
C = 5.0
OPEN = {'cobble', 'grass', 'dirt'}

def inside(x, z, poly):
    c = False; n = len(poly)
    for i in range(n):
        (x0, z0), (x1, z1) = poly[i], poly[(i + 1) % n]
        if (z0 > z) != (z1 > z) and x < (x1 - x0) * (z - z0) / (z1 - z0) + x0: c = not c
    return c

levels = [lv for lv in S['levels'] if lv['elevationFt'] >= 0]
ground = next(lv for lv in levels if lv['id'] == 'ground')
xs = [p[0] for w in ground['walls'] for p in (w['a'], w['b'])]; zs = [p[1] for w in ground['walls'] for p in (w['a'], w['b'])]
cx, cz = (min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2
X0, X1, Z0, Z1 = math.floor(min(xs) / C), math.ceil(max(xs) / C), math.floor(min(zs) / C), math.ceil(max(zs) / C)

# 1. the roofline: for every cell, the top of the highest roofed room over it
top = {}
for lv in levels:
    for r in lv['rooms']:
        if r['floor'] in OPEN: continue
        h = lv['elevationFt'] + (r.get('ceilingFt') or lv['ceilingFt'])
        poly = r['polygon']; bx = [p[0] for p in poly]; bz = [p[1] for p in poly]
        for i in range(math.floor(min(bx) / C), math.ceil(max(bx) / C)):
            for k in range(math.floor(min(bz) / C), math.ceil(max(bz) / C)):
                if inside((i + 0.5) * C, (k + 0.5) * C, poly): top[(i, k)] = max(top.get((i, k), 0), h)
# runs along x of equal height → boxes (x, z, w, d, h) in castle-centred feet
blocks = []
for k in range(Z0, Z1 + 1):
    i = X0
    while i <= X1:
        h = top.get((i, k))
        if not h: i += 1; continue
        j = i
        while top.get((j + 1, k)) == h: j += 1
        blocks.append([round((i + j + 1) / 2 * C - cx, 1), round((k + 0.5) * C - cz, 1), round((j - i + 1) * C, 1), C, h])
        i = j + 1
# merge identical runs stacked in z into taller-depth boxes
blocks.sort(key=lambda b: (b[0], b[2], b[4], b[1]))
merged = []
for b in blocks:
    m = merged[-1] if merged else None
    if m and m[0] == b[0] and m[2] == b[2] and m[4] == b[4] and abs((m[1] + m[3] / 2) - (b[1] - b[3] / 2)) < 0.01:
        m[1] = round(m[1] + b[3] / 2, 1); m[3] = round(m[3] + b[3], 1)
    else: merged.append(list(b))

# 2. the curtain walls: ground walls with their own height, collinear pieces joined
segs = [(tuple(w['a']), tuple(w['b']), w['heightFt']) for w in ground['walls'] if w.get('heightFt', 0) >= 30]
def join(segs):
    segs = [list(s) for s in segs]; changed = True
    while changed:
        changed = False
        for i in range(len(segs)):
            for j in range(len(segs)):
                if i == j: continue
                a, b, h = segs[i]; c, d, h2 = segs[j]
                if h != h2 or b != c: continue
                if abs((b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0])) > 1e-6: continue
                segs[i] = [a, d, h]; segs.pop(j); changed = True; break
            if changed: break
    return segs
walls = [[round(a[0] - cx, 1), round(a[1] - cz, 1), round(b[0] - cx, 1), round(b[1] - cz, 1), h] for a, b, h in join(segs)]

# 3. the towers: every spiral stair is a round tower from the ground to the top of the highest level it serves
towers = {}
for lv in S['levels']:
    for o in lv['objects']:
        if o['kind'] != 'spiral-stair': continue
        key = (round(o['pos'][0] / 5) * 5, round(o['pos'][2] / 5) * 5)
        r = (o.get('dims') or {}).get('r', 10)
        t = towers.setdefault(key, {'r': r, 'top': 0})
        t['r'] = max(t['r'], r); t['top'] = max(t['top'], lv['elevationFt'] + (o.get('dims') or {}).get('rise', lv['ceilingFt']))
# the tower roofs: a tower's cap sits on the highest roofed column round it
tw = []
for (x, z), t in towers.items():
    roof = max([top.get((math.floor(x / C) + di, math.floor(z / C) + dk), 0) for di in range(-2, 3) for dk in range(-2, 3)] + [t['top']])
    tw.append([round(x - cx, 1), round(z - cz, 1), round(t['r'] + 4, 1), roof])

# 4. lit windows on the outer faces: one per 20 ft of face per storey, on blocks that rise above the curtain
win = []
for b in merged:
    x, z, w, d, h = b
    for face in ((0, -1), (0, 1), (-1, 0), (1, 0)):
        nx, nz = face; fx, fz = x + nx * w / 2, z + nz * d / 2
        cell = (math.floor((fx + cx + nx * 2.5) / C), math.floor((fz + cz + nz * 2.5) / C))
        if top.get(cell, 0) >= h: continue                       # an inner face
        L = d if nx else w
        for y in range(40, int(h) - 10, 30):
            for s in range(int(L // 20)):
                off = -L / 2 + 10 + s * 20
                if (hash((round(fx), round(fz), y, s)) % 3) == 0: continue  # not every window burns
                win.append([round(fx + (0 if nx else off), 1), round(fz + (off if nx else 0), 1), y, 1 if nx else 0])

# the approach: the drawbridge west from the gate across the fifty-foot chasm, the gate towers, the road beyond
gate = (0 - cx, 170 - cz)
approach = OrderedDict(gate=[round(gate[0], 1), round(gate[1], 1)], chasm=50, bridgeW=18, towers=[[round(gate[0] - 8, 1), round(gate[1] - 23, 1)], [round(gate[0] - 8, 1), round(gate[1] + 23, 1)]])
out = OrderedDict(approach=approach, note='Derived from locations/ch04/K by scripts/authoring/ravenloft-exterior.py; castle-centred feet, x east, z south.',
                  centre=[round(cx, 1), round(cz, 1)], blocks=merged, walls=walls, towers=tw, windows=win[:400])
json.dump(out, open(os.path.join(ROOT, 'locations/ch04/K/exterior.json'), 'w'), separators=(',', ':'))
print('ravenloft exterior:', len(merged), 'blocks,', len(walls), 'wall runs,', len(tw), 'towers,', len(out['windows']), 'windows; top', max(b[4] for b in merged))
