#!/usr/bin/env python3
"""The Town of Vallaki (chapter 5, area N; map p.97, scale bar 2,000 ft) -> locations/ch05/N/{scene,grid}.json

A placement layer like the village: the frame is the 400-dpi render of the map (0.341 px per ft, origin the
crop's top-left). Building footprints come from the roof blobs (scratch town-houses.json, measured by the
extraction in the session notes) kept only inside the palisade; the palisade, gates, streets and the keyed
markers N1–N9 are traced by hand on the same render. Only positions and sizes live here; the art is ours.
Keyed buildings with their own maps carry `enter` so the town map opens them."""
import json, math, os
from collections import OrderedDict

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
OUT = os.path.join(ROOT, 'locations', 'ch05', 'N')
PXFT = 0.341          # px per ft on the 400-dpi crop
CROP = (500, 300)     # the tracing was done on a crop of the render (road-overlay.png in the session notes): its origin
def ft(cx, cy): return [round((cx + CROP[0]) / PXFT, 1), round((cy + CROP[1]) / PXFT, 1)]

# the palisade (crop px, clockwise from the west gate); gates where the Old Svalich Road and the lake road cross it
WALL = [(165, 520), (300, 430), (520, 390), (740, 350), (860, 310), (910, 210), (950, 110), (1000, 10), (1100, -10), (1200, 20), (1240, 170), (1270, 280), (1340, 350),
        (1500, 380), (1660, 400), (1780, 480), (1800, 590), (1790, 670), (1730, 740), (1580, 810), (1400, 850), (1200, 870), (1060, 840), (860, 790), (660, 740), (480, 690), (330, 650), (200, 590)]
STREETS = [
    ('Old Svalich Road', 22, [(-700, 600), (-300, 585), (-80, 575), (170, 545), (300, 505), (450, 470), (600, 455), (760, 450), (900, 460), (1010, 485), (1120, 480), (1250, 520), (1400, 572), (1550, 612), (1680, 642), (1800, 640), (2000, 620), (2400, 600)]),
    ('South street', 16, [(170, 545), (330, 600), (480, 660), (620, 720), (760, 770), (900, 810), (1050, 845), (1200, 850), (1330, 820), (1450, 785), (1560, 740), (1640, 690), (1700, 650)]),
    ('Lake road', 18, [(1120, 480), (1140, 380), (1140, 280), (1110, 180), (1060, 90), (1035, 0), (1020, -150), (1000, -300)]),
    ('Square loop', 14, [(1010, 485), (1035, 580), (1045, 690), (1060, 760), (1120, 790), (1200, 760), (1230, 680), (1200, 580), (1130, 520)]),
    ('East loop', 14, [(1180, 470), (1230, 400), (1310, 365), (1400, 370), (1460, 400), (1480, 450), (1430, 490), (1330, 500)]),
    ('West lane', 14, [(560, 470), (520, 540), (600, 570), (760, 600), (920, 630), (1000, 660)]),
    ('Market street', 14, [(1250, 520), (1300, 600), (1330, 680), (1360, 740)]),
    ('Camp track', 12, [(170, 545), (60, 620), (-100, 780), (-260, 950), (-330, 1010)]),
]
MARK = {'N1': (430, 470), 'N2': (995, 435), 'N3': (920, 690), 'N4': (1200, 305), 'N5': (1690, 690), 'N6': (1420, 720), 'N7': (1080, 605), 'N8': (1215, 622), 'N9': (-337, 1006),
        'N8a': (1215, 566), 'N8b': (1262, 600), 'N8c': (1176, 618), 'N8d': (1222, 664)}  # the shops round the square: north, round the east corner, west, south
NAMES = {'N1': "St. Andral's Church", 'N2': 'Blue Water Inn', 'N3': "Burgomaster's Mansion", 'N4': 'Wachterhaus', 'N5': 'Arasek Stockyard', 'N6': "Coffin Maker's Shop", 'N7': 'Blinsky Toys', 'N8': 'Town Square', 'N9': 'Vistani Camp',
         'N8a': 'Smithy and Armourer', 'N8b': "Jeweller's", 'N8c': "Alchemist's", 'N8d': 'General Store', 'N10': 'Livery Stable'}
ENTER = {'N1': 'ch05/N1', 'N2': 'ch05/N2', 'N3': 'ch05/N3', 'N4': 'ch05/N4', 'N5': 'ch05/N5', 'N6': 'ch05/N6', 'N7': 'ch05/N7', 'N9': 'ch05/N9', 'N8': 'ch05/N8', 'N8a': 'ch05/N8', 'N8b': 'ch05/N8', 'N8c': 'ch05/N8', 'N8d': 'ch05/N8'}
_M = json.load(open(os.path.join(ROOT, 'manifests', 'locations.json')))
PAGE = {a['key']: a['page'] for l in _M['locations'] if l['id'] == 'N' for a in l['areas']}

def strip(pts, w):
    out, h = [], w / 2
    for i in range(len(pts) - 1):
        (x0, z0), (x1, z1) = pts[i], pts[i + 1]
        dx, dz = x1 - x0, z1 - z0; L = math.hypot(dx, dz) or 1; nx, nz = -dz / L * h, dx / L * h
        out.append([[round(x0 + nx, 1), round(z0 + nz, 1)], [round(x1 + nx, 1), round(z1 + nz, 1)], [round(x1 - nx, 1), round(z1 - nz, 1)], [round(x0 - nx, 1), round(z0 - nz, 1)]])
    for (x, z) in pts[1:-1]:
        out.append([[round(x + math.cos(a) * h, 1), round(z + math.sin(a) * h, 1)] for a in [k * math.pi / 4 for k in range(8)]])
    return out

def inside(p, poly):
    x, z = p; c = False; n = len(poly)
    for i in range(n):
        (x0, z0), (x1, z1) = poly[i], poly[(i + 1) % n]
        if (z0 > z) != (z1 > z) and x < (x1 - x0) * (z - z0) / (z1 - z0) + x0: c = not c
    return c

def _smooth(pts, passes=3, step=20.0):
    """The traced outline is a polygon of hand-clicked corners; the palisade itself bends in long easy curves.
    Chaikin corner cutting on the closed loop, then resampled to even pieces about `step` feet long."""
    P = [tuple(p) for p in pts]
    for _ in range(passes):
        Q = []
        for i in range(len(P)):
            (x0, z0), (x1, z1) = P[i], P[(i + 1) % len(P)]
            Q += [(0.75 * x0 + 0.25 * x1, 0.75 * z0 + 0.25 * z1), (0.25 * x0 + 0.75 * x1, 0.25 * z0 + 0.75 * z1)]
        P = Q
    seg = [math.hypot(P[(i + 1) % len(P)][0] - P[i][0], P[(i + 1) % len(P)][1] - P[i][1]) for i in range(len(P))]
    n = max(8, round(sum(seg) / step)); d = sum(seg) / n; out, i, acc = [], 0, 0.0
    for k in range(n):
        t = k * d
        while acc + seg[i] < t: acc += seg[i]; i += 1
        u = (t - acc) / (seg[i] or 1); (x0, z0), (x1, z1) = P[i], P[(i + 1) % len(P)]
        out.append([round(x0 + (x1 - x0) * u, 1), round(z0 + (z1 - z0) * u, 1)])
    return out
wall = _smooth([ft(*p) for p in WALL])
WALL_H = 16.5   # the timbers stand about sixteen feet
# The town's ground: the palisade and a belt round it (the felled approaches), nothing more. Beyond it the land is the
# region's own (the lake shore to the north, the slopes climbing south and east), so the map carries no flat plain out
# there; the roads and the camp track leave the plate as strips of dirt and the region's roads carry them on.
BELT = 420
GX0, GX1 = round(min(p[0] for p in wall) - BELT, 1), round(max(p[0] for p in wall) + BELT, 1)
GZ0, GZ1 = round(min(p[1] for p in wall) - 120, 1), round(max(p[1] for p in wall) + BELT, 1)   # north: the lake shore is close
def on_plate(p, m=0.0): return GX0 + m <= p[0] <= GX1 - m and GZ0 + m <= p[1] <= GZ1 - m
houses_src = os.path.join(ROOT, 'reference', 'imports', 'vallaki-houses.json')
houses = json.load(open(houses_src)) if os.path.exists(houses_src) else []
marks = {k: ft(*v) for k, v in MARK.items()}
marks['N10'] = [6050.0, 2470.0]   # the livery stable, north of the main road between the coffin shop and the stockyard (the DM's addition)
objects = []
kept = 0
for i, h in enumerate(houses):
    p = h['pos']
    if not inside(p, wall): continue
    near = next((k for k in MARK if k != 'N9' and math.hypot(p[0] - marks[k][0], p[1] - marks[k][1]) < 22), None)
    if near in ('N1', 'N8'): continue   # the church is its own piece; the square is open
    big = h['w'] * h['d'] > 800
    o = OrderedDict(id=f'vallaki-h{i}', kind='house', pos=[p[0], 0, p[1]], vis='player', rotY=h['rotY'], dims=OrderedDict(w=h['w'], d=h['d'], h=13 if big else 11, stories=2 if big or near else 1))
    if near: o['key'] = near; o['label'] = NAMES[near]
    objects.append(o); kept += 1
# The map shows the streets lined with houses; the roof extraction catches only the clearest. Fill the gaps with a
# house every 45-50 ft along both sides of the main streets and every 60 ft along the lanes (the plate draws a few
# hundred buildings, not a thousand), turned to the street, unless one already stands there, a keyed site needs the
# room, or another street runs through.
import random
rng = random.Random(7)
def chaikin(pts, passes=2):
    """Round a traced centreline: each pass cuts every corner at a quarter and three quarters, so the street bends instead of kinking."""
    for _ in range(passes):
        out = [pts[0]]
        for a, b in zip(pts[:-1], pts[1:]):
            out.append([round(a[0] * 0.75 + b[0] * 0.25, 1), round(a[1] * 0.75 + b[1] * 0.25, 1)]); out.append([round(a[0] * 0.25 + b[0] * 0.75, 1), round(a[1] * 0.25 + b[1] * 0.75, 1)])
        out.append(pts[-1]); pts = out
    return pts
STREETS = [(name, w, pts) for name, w, pts in STREETS]
streets_ft = [(name, w, chaikin([ft(*p) for p in pts])) for name, w, pts in STREETS]
# Only the three roads through the gates leave town; every other street stays inside the palisade, clear of the
# scaffold (a street traced too close to the wall is drawn in toward the middle of town until it is 14 ft inside)
_WC = (sum(p[0] for p in wall) / len(wall), sum(p[1] for p in wall) / len(wall))
def _wd(p):
    best = 1e9
    for i in range(len(wall)):
        a, b = wall[i], wall[(i + 1) % len(wall)]; dx, dz = b[0] - a[0], b[1] - a[1]; L2 = dx * dx + dz * dz or 1
        t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2)); best = min(best, math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t))
    return best
def _keep_in(pts, w):
    out = []
    for x, z in pts:
        k = 0
        while (not inside((x, z), wall) or _wd((x, z)) < w / 2 + 14) and k < 200:
            dx, dz = _WC[0] - x, _WC[1] - z; L = math.hypot(dx, dz) or 1; x += dx / L * 2; z += dz / L * 2; k += 1
        out.append([round(x, 1), round(z, 1)])
    return out
streets_ft = [(n, w, pts if n in ('Old Svalich Road', 'Lake road', 'Camp track') else _keep_in(pts, w)) for n, w, pts in streets_ft]
def _clip(pts, m=2.0):
    """The longest run of a polyline that lies on the plate, ending where it crosses the plate's edge."""
    x0, x1, z0, z1 = GX0 + m, GX1 - m, GZ0 + m, GZ1 - m
    def cut(a, b):   # the point where a (on the plate) -> b (off it) leaves the plate
        t = 1.0
        for (pa, pb, lo, hi) in ((a[0], b[0], x0, x1), (a[1], b[1], z0, z1)):
            if pb < lo: t = min(t, (lo - pa) / (pb - pa))
            if pb > hi: t = min(t, (hi - pa) / (pb - pa))
        return [round(a[0] + (b[0] - a[0]) * t, 1), round(a[1] + (b[1] - a[1]) * t, 1)]
    runs, cur = [], []
    for i, p in enumerate(pts):
        if on_plate(p, m):
            if not cur and i > 0: cur.append(cut(p, pts[i - 1]))
            cur.append(p)
        elif cur:
            cur.append(cut(pts[i - 1], p)); runs.append(cur); cur = []
    if cur: runs.append(cur)
    return max(runs, key=lambda r: sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(r, r[1:]))) if runs else []
streets_ft = [(n, w, _clip(pts)) for n, w, pts in streets_ft]
# where the camp track leaves the plate: the trailhead to the Vistani camp
_ct = next(pts for n, w, pts in streets_ft if n == 'Camp track')
_e, _f = _ct[-1], _ct[-2]; _L = math.hypot(_e[0] - _f[0], _e[1] - _f[1]) or 1
marks['N9'] = [round(_e[0] - (_e[0] - _f[0]) / _L * 45, 1), round(_e[1] - (_e[1] - _f[1]) / _L * 45, 1)]
def near_street(p, margin):
    for name, w, pts in streets_ft:
        for i in range(len(pts) - 1):
            a, b = pts[i], pts[i + 1]; dx, dz = b[0] - a[0], b[1] - a[1]; L2 = dx * dx + dz * dz or 1
            t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2))
            if math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t) < w / 2 + margin: return True
    return False
placed = [h['pos'] for h in houses if inside(h['pos'], wall)]
KEEP_CLEAR = {k: (110 if k == 'N8' else 60 if k in ('N1', 'N5') else 34) for k in MARK}
MAIN_STREETS = ('Old Svalich Road', 'South street', 'Lake road', 'Market street')
for name, w, pts in streets_ft:
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]; dx, dz = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dz)
        if L < 10: continue
        ux, uz = dx / L, dz / L; nx, nz = -uz, ux; ang = math.degrees(math.atan2(-uz, ux))
        d = 15.0
        while d < L - 12:
            for side in (-1, 1):
                hw, hd = 22 + rng.random() * 10, 16 + rng.random() * 8
                off = w / 2 + hd / 2 + 3 + rng.random() * 3
                p = [round(a[0] + ux * d + nx * off * side, 1), round(a[1] + uz * d + nz * off * side, 1)]
                if not inside(p, wall): continue
                if any(math.hypot(p[0] - q[0], p[1] - q[1]) < 36 for q in placed): continue
                if any(math.hypot(p[0] - marks[k][0], p[1] - marks[k][1]) < KEEP_CLEAR[k] for k in MARK): continue
                if near_street(p, hd / 2 - 1): continue
                placed.append(p); kept += 1
                objects.append(OrderedDict(id=f'vallaki-s{len(placed)}', kind='house', pos=[p[0], 0, p[1]], vis='player', rotY=round(ang, 1), dims=OrderedDict(w=round(hw, 1), d=round(hd, 1), h=11 if rng.random() < 0.7 else 13, stories=1 if rng.random() < 0.7 else 2)))
            d += (45 + rng.random() * 5) if name in MAIN_STREETS else (60 + rng.random() * 5)
# trees: oaks in the gaps inside the wall, a belt of pines outside it
trees = 0
for _ in range(900):
    p = [rng.uniform(150, 5400), rng.uniform(-900, 2800)]
    if not inside(p, wall) or near_street(p, 10) or any(math.hypot(p[0] - q[0], p[1] - q[1]) < 26 for q in placed) or any(math.hypot(p[0] - marks[k][0], p[1] - marks[k][1]) < 40 for k in MARK): continue
    objects.append(OrderedDict(id=f'vallaki-oak{trees}', kind='oak', pos=[round(p[0], 1), 0, round(p[1], 1)], vis='player', dims=OrderedDict(r=1 + rng.random() * 0.4, h=20 + rng.random() * 10, canopy=7 + rng.random() * 4))); trees += 1
    if trees >= 70: break
pines = stumps = 0
for _ in range(20000):
    p = [rng.uniform(GX0 + 8, GX1 - 8), rng.uniform(GZ0 + 8, GZ1 - 8)]
    if inside(p, wall) or near_street(p, 25): continue
    dw = min(math.hypot(p[0] - q[0], p[1] - q[1]) for q in wall)
    if dw < 90: continue
    sc = 0.9 + rng.random() * 0.7
    if dw < 300:   # the felled ring: the town burns a lot of wood
        if stumps >= 150 or rng.random() < 0.5: continue
        objects.append(OrderedDict(id=f'vallaki-stump{stumps}', kind='stump', pos=[round(p[0], 1), 0, round(p[1], 1)], vis='player', dims=OrderedDict(r=round(0.9 + (sc - 0.9) * 0.8, 2), h=round(1.6 + (sc - 0.9) * 1.5, 2)))); stumps += 1
    else:          # the wood's edge at the plate's rim, thickening outward into the region's forest
        if pines >= 300 or rng.random() > (dw - 300) / 250: continue
        objects.append(OrderedDict(id=f'vallaki-pine{pines}', kind='pine', pos=[round(p[0], 1), 0, round(p[1], 1)], vis='player', dims=OrderedDict(scale=round(sc, 2)))); pines += 1
    if stumps >= 150 and pines >= 300: break
# the church, the stockyard's pens, the camp's wagons
objects.append(OrderedDict(id='vallaki-church', kind='church-building', pos=[marks['N1'][0], 0, marks['N1'][1]], vis='player', key='N1', label=NAMES['N1'], rotY=180))   # the apse and altar to the north, as in the church's own map
# the Vistani camp keeps its own map, in the woods south-west of town: here the camp track leaves the plate, and a
# signpost at the trailhead is the way in
N9x, N9z = marks['N9']
objects.append(OrderedDict(id='vallaki-n9-sign', kind='signpost', pos=[N9x, 0, N9z], vis='player', key='N9', rotY=45))
objects.append(OrderedDict(id='vallaki-well', kind='well', pos=[marks['N8'][0] - 5, 0, marks['N8'][1] + 10], vis='player', key='N8'))
objects.append(OrderedDict(id='vallaki-stage', kind='dais', pos=[marks['N8'][0], 0, marks['N8'][1] - 32], vis='player', key='N8', dims=OrderedDict(w=20, h=4, steps=3)))
objects.append(OrderedDict(id='vallaki-stocks', kind='pillory', pos=[marks['N8'][0] + 32, 0, marks['N8'][1] + 8], vis='player', key='N8', rotY=20))
objects.append(OrderedDict(id='vallaki-stocks-b', kind='pillory', pos=[marks['N8'][0] + 42, 0, marks['N8'][1] + 8], vis='player', key='N8', rotY=-15))
for j, (dx, dz) in enumerate([(-65, -45), (65, -45), (-65, 45), (65, 45)]): objects.append(OrderedDict(id=f'vallaki-brazier-{j}', kind='brazier', pos=[marks['N8'][0] + dx, 0, marks['N8'][1] + dz], vis='player', key='N8'))
# the palisade: 16-ft timber walls with a gate where the road crosses east and west
walls = []
def gate_cross(a, b, road_pts):
    """Does wall segment a-b cross the main road? (then it is a gate)"""
    for i in range(len(road_pts) - 1):
        p, q = road_pts[i], road_pts[i + 1]
        def ccw(A, B, C): return (C[1] - A[1]) * (B[0] - A[0]) > (B[1] - A[1]) * (C[0] - A[0])
        if ccw(a, p, q) != ccw(b, p, q) and ccw(a, b, p) != ccw(a, b, q): return True
    return False
road_main = streets_ft[0][2]; road_lake = streets_ft[2][2]; road_camp = streets_ft[7][2]   # Old Svalich Road, Lake road, Camp track
# the outline runs in even twenty-foot pieces; where a road crosses one, that piece is the gate (one per crossing:
# a road that wanders back over the line within a few pieces still has a single gate)
_gates = []
for i in range(len(wall)):
    a, b = wall[i], wall[(i + 1) % len(wall)]
    if (gate_cross(a, b, road_main) or gate_cross(a, b, road_lake)) and not any(min(abs(i - g), len(wall) - abs(i - g)) < 6 for g in _gates): _gates.append(i)
for i in range(len(wall)):
    a, b = wall[i], wall[(i + 1) % len(wall)]
    if i in _gates: walls.append(OrderedDict(id=f'gate-{i}', a=a, b=b, flags=['door'], material='log', heightFt=WALL_H, open=True))
    else: walls.append(OrderedDict(id=f'pal-{i}', a=a, b=b, flags=['normal'], material='log', heightFt=WALL_H))
rooms = []
for k in ['N1', 'N2', 'N4', 'N7', 'N8', 'N3', 'N6', 'N5', 'N9', 'N8a', 'N8b', 'N8c', 'N8d', 'N10']:
    x, z = marks[k]; s = 30 if k in ('N7', 'N6', 'N8b', 'N8c') else 40 if k not in ('N8', 'N9', 'N5') else 60
    if k == 'N9': s = 50   # the trailhead: the camp itself is in the woods, on its own map
    r = OrderedDict(key=k, name=NAMES[k], page=PAGE.get(k), polygon=[[round(x - s / 2, 1), round(z - s / 2, 1)], [round(x + s / 2, 1), round(z - s / 2, 1)], [round(x + s / 2, 1), round(z + s / 2, 1)], [round(x - s / 2, 1), round(z + s / 2, 1)]], floor='cobble' if k != 'N9' else 'dirt')
    if k == 'N8': r['polygon'] = [[round(x - 75, 1), round(z - 55, 1)], [round(x + 75, 1), round(z - 55, 1)], [round(x + 75, 1), round(z + 55, 1)], [round(x - 75, 1), round(z + 55, 1)]]
    if k == 'N9': r['floor'] = 'dirt'
    if k == 'N10': r['floor'] = 'dirt'; r['polygon'] = [[x - 45, z - 20], [x + 45, z - 20], [x + 45, z + 55], [x - 45, z + 55]]
    if k in ENTER: r['enter'] = ENTER[k]
    rooms.append(r)
DESC = {
  'N10': ('A long timber barn and a fenced paddock: the livery where travellers stable their horses.', "The DM's addition: stabling 5 cp a night; the hostler gossips with the Vistani horse-traders."),
  'N1': ("A slouching stone church with a bulging steeple, stained glass of saints cracked in every window, an iron-fenced garden of graves beside it.", "Father Lucian, Yeska and Milivoj. The bones of St. Andral are gone from the crypt: Milivoj took them to the coffin maker. Same plan as the village church, no undercroft."),
  'N2': ("A two-storey inn on the main street with a well in its yard and an outside stair.", "The Martikovs' inn: Urwin and Danika, the boys, Rictavio's wagon in the stable yard. Open the map for the floors."),
  'N3': ("The burgomaster's mansion behind its gate, banners of the festival on the posts.", "Baron Vargas, Lydia, Victor in the attic, Izek. The cells in the basement hold the town's complainers."),
  'N4': ("A grand old house of three storeys with its own small grounds.", "Lady Fiona Wachter, her sons and daughter, the cult meeting in the cellar."),
  'N5': ("Pens and a warehouse by the east gate where the stockyard's beasts are kept.", "Ernst Larnak's territory; Rictavio's tiger is penned here."),
  'N6': ("A narrow two-storey shop with coffins stacked in its window.", "Henrik van der Voort; the stolen bones and six vampire spawn in the nest above."),
  'N7': ("A toymaker's shop with a cheerful, slightly wrong sign.", "Gadof Blinsky and his toys; the doll that looks like Ireena."),
  'N8': ("The town square: the stocks, the festival stage, a dry well.", "Festival of the Blazing Sun; Izek's guards; the stocks for malcontents."),
  'N9': ("The camp track runs on into the woods south-west of town, footpaths and horse trails beside it: the way to the Vistani camp.", "Luvash and Arrigal; Arabelle missing; Kasimir's hovel among the dusk elves. Open the map for the camp."),
}
for r in rooms:
    d = DESC.get(r['key'])
    if d: r['desc'] = d[0]; r['dm'] = d[1]
terrain = [OrderedDict(polygon=[[GX0, GZ0], [GX1, GZ0], [GX1, GZ1], [GX0, GZ1]], floor='grass')]
for name, w, pts in streets_ft:
    for poly in strip(pts, w): terrain.append(OrderedDict(polygon=poly, floor='cobble' if name == 'Old Svalich Road' else 'dirt'))
# The palisade itself: trunk runs along every wall piece (not the gates), the fighting walk on the town side; a guard
# station every 300 ft or so, and a pair at each gate.
_since = 0.0
for wl in walls:
    a, b = wl['a'], wl['b']; dx, dz = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dz)
    if L < 1: continue
    mx, mz = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2; th = math.atan2(-dz, dx)
    nx, nz = math.sin(th), math.cos(th)   # local +z in plan
    flip = 0 if inside((mx + nx * 6, mz + nz * 6), wall) else 1
    if 'door' in wl['flags']:
        for s_ in (-1, 1):
            objects.append(OrderedDict(id=f"{wl['id']}-gt{s_}", kind='watchtower', pos=[round(mx + dx / L * (L / 2 + 7) * s_, 1), 0, round(mz + dz / L * (L / 2 + 7) * s_, 1)], vis='player', rotY=round(math.degrees(th), 1), dims=OrderedDict(h=24, w=10)))
        continue
    objects.append(OrderedDict(id=f"{wl['id']}-pal", kind='palisade', pos=[round(mx, 1), 0, round(mz, 1)], vis='player', rotY=round(math.degrees(th), 1), dims=OrderedDict(len=round(L + 1.6, 1), h=WALL_H, flip=flip)))
    _since += L
    if _since > 300:
        _since = 0
        sx = (1 if not flip else -1)
        objects.append(OrderedDict(id=f"{wl['id']}-tower", kind='watchtower', pos=[round(mx + nx * 6 * sx, 1), 0, round(mz + nz * 6 * sx, 1)], vis='player', rotY=round(math.degrees(th), 1), dims=OrderedDict(h=22.5, w=10)))
# settle: nothing on a street, through the palisade or through another house; every keyed site has its building
import sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from settle import settle
# Each keyed site with its own map takes its footprint from that map (vallaki-sites.py writes them first): the key box
# is the map's ground-floor extent, the house on it the part under a roof, so the town and the blowout agree and the
# surroundings drawn round the blowout stand where they stand here.
OPEN_ROOMS = {'N2a', 'N2b', 'N2c-porch', 'N3a-porch', 'N4r', 'N5a', 'N5c', 'N5d'}   # yards, porches, an outside stair, the stockyard's pens and sheds
def _child(k):
    d = json.load(open(os.path.join(ROOT, 'locations', 'ch05', k, 'scene.json')))
    L = next((l for l in d['levels'] if l.get('terrain')), d['levels'][0])
    def bb(rs): xs = [p[0] for r in rs for p in r['polygon']]; zs = [p[1] for r in rs for p in r['polygon']]; return min(xs), min(zs), max(xs), max(zs)
    x0, z0, x1, z1 = bb(L['rooms']); b0, c0, b1, c1 = bb([r for r in L['rooms'] if r['key'] not in OPEN_ROOMS])
    storeys = sum(1 for l in d['levels'] if l['elevationFt'] >= 0 and l['id'] != 'attic')
    return dict(W=round(x1 - x0, 1), D=round(z1 - z0, 1), off=((b0 + b1) / 2 - (x0 + x1) / 2, (c0 + c1) / 2 - (z0 + z1) / 2), bw=round(b1 - b0, 1), bd=round(c1 - c0, 1), storeys=storeys, ox=x0, oz=z0)
CHILD = {k: _child(k) for k in ('N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7')}
SITE_SIZES = {'N8a': (50, 30, 1), 'N8b': (30, 30, 1), 'N8c': (30, 24, 1), 'N8d': (50, 30, 1), 'N10': (70, 30, 1)}
for k in ('N2', 'N3', 'N4', 'N5', 'N6', 'N7'): SITE_SIZES[k] = (CHILD[k]['bw'], CHILD[k]['bd'], max(1, CHILD[k]['storeys']))
_level = OrderedDict(terrain=terrain, rooms=rooms, walls=walls, objects=objects)
print('settle:', settle(_level, keyed=SITE_SIZES)); objects = _level['objects']
# then each blowout's box goes down square to the map (the blowouts share the town's north), clear of the streets, the
# palisade and the other keyed sites, as near its mark as it can; whatever stood on it gives way
from settle import rect as _hrect0, overlap as _ov0, seg_hits as _sh0
_streets = [t['polygon'] for t in terrain if t.get('floor') in ('cobble', 'dirt') and len(t['polygon']) <= 8]
def _box(cx, cz, W, D): return [[cx - W / 2, cz - D / 2], [cx + W / 2, cz - D / 2], [cx + W / 2, cz + D / 2], [cx - W / 2, cz + D / 2]]
_placed_boxes = {}
for k in ('N8', 'N8a', 'N8b', 'N8c', 'N8d', 'N10'):
    rm = next(r for r in rooms if r['key'] == k); _placed_boxes[k] = rm['polygon']
for k in ('N1', 'N3', 'N2', 'N4', 'N7', 'N6', 'N5'):
    c = CHILD[k]; rm = next(r for r in rooms if r['key'] == k)
    has = next(o for o in objects if o.get('key') == k and o['kind'] in ('house', 'church-building'))
    sx, sz = (has['pos'][0] - c['off'][0], has['pos'][2] - c['off'][1]) if has['kind'] == 'house' else tuple(marks[k])
    best = None
    for r_ in [0] + [2.5 * i for i in range(1, 49)]:
        for a_ in (range(0, 360, 15) if r_ else [0]):
            cx, cz = round((sx + math.cos(math.radians(a_)) * r_) / 2.5) * 2.5, round((sz + math.sin(math.radians(a_)) * r_) / 2.5) * 2.5
            R = _box(cx, cz, c['W'], c['D'])
            if any(_ov0(R, st, slack=0.5) for st in _streets): continue
            if any(_ov0(R, q, slack=0.5) for q in _placed_boxes.values()): continue
            if any(_sh0(w['a'], w['b'], R) for w in walls): continue
            best = (cx, cz); break
        if best: break
    if not best: print('  ! no clear ground for', k); best = (sx, sz)
    cx, cz = best
    rm['polygon'] = [[round(x, 1), round(z, 1)] for x, z in _box(cx, cz, c['W'], c['D'])]; _placed_boxes[k] = rm['polygon']
    if has['kind'] == 'house':
        has['pos'] = [round(cx + c['off'][0], 2), 0, round(cz + c['off'][1], 2)]; has['rotY'] = 0
        has['dims'] = OrderedDict(w=c['bw'], d=c['bd'], h=13, stories=max(1, c['storeys']))
    else: has['pos'] = [cx, 0, cz]
    marks[k] = [cx, cz]
    clear = _box(cx, cz, c['W'] + 10, c['D'] + 10)
    objects = [o for o in objects if o is has or o.get('key') or o['kind'] not in ('house', 'oak', 'pine', 'stump', 'fence') or not (_ov0(_hrect0(o), clear, slack=0.5) if o['kind'] == 'house' else _ov0([[o['pos'][0] - 1, o['pos'][2] - 1], [o['pos'][0] + 1, o['pos'][2] - 1], [o['pos'][0] + 1, o['pos'][2] + 1], [o['pos'][0] - 1, o['pos'][2] + 1]], clear))]
# the stockyard: the warehouse is the keyed house; the row of sheds and the plank fence round the yard as its map has them
_c5 = CHILD['N5']; _x5, _z5 = marks['N5']; _X0, _Z0 = _x5 - _c5['W'] / 2, _z5 - _c5['D'] / 2
objects.append(OrderedDict(id='vallaki-n5-sheds', kind='house', pos=[round(_X0 + 30, 1), 0, round(_Z0 + 65, 1)], vis='player', key='N5', rotY=0, dims=OrderedDict(w=60, d=10, h=8, stories=1)))
for j, (x, z, w, rot) in enumerate([(13.75, 0, 27.5, 0), (46.25, 0, 27.5, 0), (0, 30, 60, 90), (60, 50, 20, 90)]):
    objects.append(OrderedDict(id=f'vallaki-n5-fence{j}', kind='fence', pos=[round(_X0 + x, 1), 0, round(_Z0 + z, 1)], vis='player', key='N5', rotY=rot, dims=OrderedDict(w=w)))
# Desire paths: the minor walked ways between the streets, worn across the open blocks by people cutting the corner.
# Not thoroughfares: 3 ft wide, dirt, a little crooked, only where a straight walk between two streets crosses open
# ground long enough to be worth it and no house stands in the way.
def _seg_pts(pts, every):
    out = []
    for a, b in zip(pts[:-1], pts[1:]):
        L = math.hypot(b[0] - a[0], b[1] - a[1]); n = max(1, int(L / every))
        for k in range(n): t = k / n; out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return out
street_pts = [(i, p) for i, (name, w, pts) in enumerate(streets_ft) for p in _seg_pts(pts, 60)]
_houses = [o for o in objects if o['kind'] == 'house']
from settle import rect as _hrect, overlap as _overlap
_hrects = [_hrect(o) for o in _houses]
def _blocked(a, b):
    """Does the walk a-b run through a house (its middle 70%: the ends may squeeze between the houses that line the
    street), or cross another street on the way?"""
    dx, dz = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dz) or 1; nx, nz = -dz / L * 1.5, dx / L * 1.5
    e = min(0.3, 10 / L); a2 = (a[0] + dx * e, a[1] + dz * e); b2 = (b[0] - dx * e, b[1] - dz * e)  # the first and last ten feet squeeze between the houses that line the street
    strip_poly = [(a2[0] + nx, a2[1] + nz), (b2[0] + nx, b2[1] + nz), (b2[0] - nx, b2[1] - nz), (a2[0] - nx, a2[1] - nz)]
    if any(_overlap(strip_poly, r, slack=0.5) for r in _hrects): return True  # the whole walk keeps clear of every house
    for k in range(2, 9):
        t = k / 10; q = (a[0] + dx * t, a[1] + dz * t)
        if near_street(q, 3): return True
    for k in range(0, 11):   # a footpath never runs through the palisade
        q = (a[0] + dx * k / 10, a[1] + dz * k / 10)
        if not inside(q, wall) or _wd(q) < 12: return True
    return False
trails = []; drng = random.Random(11)
for si, a in street_pts:
    if not inside(a, wall) or drng.random() < 0.35: continue
    cands = [(sj, b) for sj, b in street_pts if sj != si and inside(b, wall) and 110 < math.hypot(b[0] - a[0], b[1] - a[1]) < 420]
    drng.shuffle(cands)
    for sj, b in cands[:6]:
        if any(math.hypot(a[0] - t0[0], a[1] - t0[1]) < 70 or math.hypot(b[0] - t1[0], b[1] - t1[1]) < 70 for t0, t1 in trails): continue
        if _blocked(a, b): continue
        trails.append((a, b)); break
for a, b in trails:
    # a crooked line of three legs
    mx, mz = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2; dx, dz = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dz) or 1; nx, nz = -dz / L, dx / L
    bend = (drng.random() - 0.5) * L * 0.18
    for poly in strip([a, (mx + nx * bend, mz + nz * bend), b], 3): terrain.append(OrderedDict(polygon=poly, floor='dirt'))
_paths = [tp['polygon'] for tp in terrain[-len(trails) * 3:]] if trails else []
objects = [o for o in objects if not (o['kind'] == 'house' and not o.get('key') and any(_overlap(_hrect(o), pp, slack=0.5) for pp in _paths))]
print('desire paths:', len(trails))
# The livery stable's yard: a fenced paddock south of the barn (the barn's south wall its fourth side), a trough, hay, the horses.
_barn = next(o for o in objects if o.get('key') == 'N10' and o['kind'] == 'house')
_sx, _sz = _barn['pos'][0], _barn['pos'][2] + _barn['dims']['d'] / 2   # the barn's south wall
for j, (dx, dz, w, rot) in enumerate([(-17.5, 40, 35, 0), (17.5, 40, 35, 0), (35, 20, 40, 90), (-35, 20, 40, 90)]): objects.append(OrderedDict(id=f'vallaki-n10-fence{j}', kind='fence', pos=[_sx + dx, 0, _sz + dz], vis='player', key='N10', rotY=rot, dims=OrderedDict(w=w)))
objects.append(OrderedDict(id='vallaki-n10-trough', kind='trough', pos=[_sx + 10, 0, _sz + 15], vis='player', key='N10'))
objects.append(OrderedDict(id='vallaki-n10-hay', kind='hay', pos=[_sx - 25, 0, _sz + 12], vis='player', key='N10'))
for j, (dx, dz) in enumerate([(-12, 22), (6, 30), (24, 20)]): objects.append(OrderedDict(id=f'vallaki-n10-horse{j}', kind='horse', pos=[_sx + dx, 0, _sz + dz], vis='player', key='N10', size='large', rotY=j * 70))
_n10 = next(r for r in rooms if r['key'] == 'N10'); _bx0 = _barn['pos'][0]; _bz0 = _barn['pos'][2] - _barn['dims']['d'] / 2
_n10['polygon'] = [[round(_bx0 - 37, 1), round(_bz0 - 2, 1)], [round(_bx0 + 37, 1), round(_bz0 - 2, 1)], [round(_bx0 + 37, 1), round(_sz + 42, 1)], [round(_bx0 - 37, 1), round(_sz + 42, 1)]]
_pad = _n10['polygon']
objects = [o for o in objects if not (o['kind'] == 'house' and not o.get('key') and _overlap(_hrect(o), _pad, slack=0.5))]
# Trails to Blinsky Toys: worn footpaths from the toymaker's door to the nearest point of each street round it
_bx, _bz = marks['N7']
def _nearest_on(pts, p):
    best = None
    for a, b in zip(pts[:-1], pts[1:]):
        dx, dz = b[0] - a[0], b[1] - a[1]; L2 = dx * dx + dz * dz or 1; t_ = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2)); q = (a[0] + dx * t_, a[1] + dz * t_)
        d = math.hypot(q[0] - p[0], q[1] - p[1])
        if best is None or d < best[0]: best = (d, q)
    return best
_ends = sorted((_nearest_on(pts, (_bx, _bz)) + (name,) for name, _w, pts in streets_ft), key=lambda e: e[0])
_bl = []
for d, q, name in _ends[:3]:
    if d < 12 or d > 260: continue
    mx, mz = (_bx + q[0]) / 2, (_bz + q[1]) / 2; dx, dz = q[0] - _bx, q[1] - _bz; L = math.hypot(dx, dz) or 1
    _h7 = next(o for o in objects if o.get('key') == 'N7' and o['kind'] == 'house')   # the path starts at the shop's wall, not in it
    _t = min((_h7['dims']['w'] / 2 + 3) / (abs(dx) or 1e-9), (_h7['dims']['d'] / 2 + 3) / (abs(dz) or 1e-9))
    if _t >= 1: continue
    pts_ = [(_h7['pos'][0] + dx * _t, _h7['pos'][2] + dz * _t), (mx - dz / L * L * 0.08, mz + dx / L * L * 0.08), q]
    for poly in strip(pts_, 4): terrain.append(OrderedDict(polygon=poly, floor='dirt')); _bl.append(poly)
objects = [o for o in objects if not (o['kind'] == 'house' and not o.get('key') and any(_overlap(_hrect(o), pp, slack=0.5) for pp in _bl))]
print('trails to Blinsky Toys:', len(_bl) // 3)
# Nothing leans on the palisade: a house astride the wall, or inside it within the scaffold's reach, is not built
def _hits_wall(o):
    r = _hrect(o); pts = [(r[i][0] + (r[(i + 1) % 4][0] - r[i][0]) * t / 4, r[i][1] + (r[(i + 1) % 4][1] - r[i][1]) * t / 4) for i in range(4) for t in range(4)]
    ins = [inside(q, wall) for q in pts]
    return (any(ins) and not all(ins)) or min(_wd(q) for q in pts) < (9 if all(ins) else 4)
_n0 = len(objects); objects = [o for o in objects if not (o['kind'] == 'house' and not o.get('key') and _hits_wall(o))]
print('clear of the palisade:', _n0 - len(objects), 'houses dropped')
# Trodden soil: the ground under every house and round it is bare earth, not grass, and the keyed yards too.
from settle import rect as _frect
for o in objects:
    if o['kind'] not in ('house', 'church-building'): continue
    q = OrderedDict(o); q['dims'] = OrderedDict(w=(o.get('dims') or {}).get('w', 60) + 8, d=(o.get('dims') or {}).get('d', 30) + 8)
    terrain.append(OrderedDict(polygon=[[round(x, 1), round(z, 1)] for x, z in _frect(q)], floor='dirt'))
for r in rooms:
    if r.get('floor') == 'cobble' and r['key'] != 'N8': r['floor'] = 'dirt'   # only the square keeps paving; yards are earth
level = OrderedDict(id='town', name='Vallaki', elevationFt=0, ceilingFt=15, ambient='barovian-overcast', north='-z', terrain=terrain, rooms=rooms, walls=walls, lights=[], objects=objects)
scene = OrderedDict(schema=1, location='N', chapter='ch05', name='The Town of Vallaki', mapPage=97, bookScaleFt=5, ambient='barovian-overcast', placementFt=40, kind='placement', clearingFt=60, levels=[level], links=[], frame='measured-p97-400dpi')   # the region's wood begins at the plate's rim
grid = OrderedDict(schema=1, levels=OrderedDict(town=OrderedDict(floorPolygons=[terrain[0]['polygon']], type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0)))
os.makedirs(OUT, exist_ok=True)
json.dump(scene, open(os.path.join(OUT, 'scene.json'), 'w'), indent=1)
json.dump(grid, open(os.path.join(OUT, 'grid.json'), 'w'), indent=1)
print('vallaki:', kept, 'houses (', len(houses), 'extracted ) ;', trees, 'oaks', pines, 'pines ;', len(walls), 'wall pieces;', len(rooms), 'keyed sites')
