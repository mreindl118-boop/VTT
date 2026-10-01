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
         'N8a': 'Smithy and Armourer', 'N8b': "Jeweller's", 'N8c': "Alchemist's", 'N8d': 'General Store'}
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

wall = [ft(*p) for p in WALL]
houses_src = os.path.join(ROOT, 'reference', 'imports', 'vallaki-houses.json')
houses = json.load(open(houses_src)) if os.path.exists(houses_src) else []
marks = {k: ft(*v) for k, v in MARK.items()}
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
# The map shows the streets lined with houses almost wall to wall; the roof extraction catches only the clearest.
# Fill the gaps: a house every thirty feet along both sides of every street inside the palisade, turned to the street,
# unless one already stands there, a keyed site needs the room, or another street runs through.
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
def near_street(p, margin):
    for name, w, pts in streets_ft:
        for i in range(len(pts) - 1):
            a, b = pts[i], pts[i + 1]; dx, dz = b[0] - a[0], b[1] - a[1]; L2 = dx * dx + dz * dz or 1
            t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2))
            if math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t) < w / 2 + margin: return True
    return False
placed = [h['pos'] for h in houses if inside(h['pos'], wall)]
KEEP_CLEAR = {k: (110 if k == 'N8' else 60 if k in ('N1', 'N5') else 34) for k in MARK}
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
                if any(math.hypot(p[0] - q[0], p[1] - q[1]) < 24 for q in placed): continue
                if any(math.hypot(p[0] - marks[k][0], p[1] - marks[k][1]) < KEEP_CLEAR[k] for k in MARK): continue
                if near_street(p, hd / 2 - 1): continue
                placed.append(p); kept += 1
                objects.append(OrderedDict(id=f'vallaki-s{len(placed)}', kind='house', pos=[p[0], 0, p[1]], vis='player', rotY=round(ang, 1), dims=OrderedDict(w=round(hw, 1), d=round(hd, 1), h=11 if rng.random() < 0.7 else 13, stories=1 if rng.random() < 0.7 else 2)))
            d += 28 + rng.random() * 8
# trees: oaks in the gaps inside the wall, a belt of pines outside it
trees = 0
for _ in range(900):
    p = [rng.uniform(150, 5400), rng.uniform(-900, 2800)]
    if not inside(p, wall) or near_street(p, 10) or any(math.hypot(p[0] - q[0], p[1] - q[1]) < 26 for q in placed) or any(math.hypot(p[0] - marks[k][0], p[1] - marks[k][1]) < 40 for k in MARK): continue
    objects.append(OrderedDict(id=f'vallaki-oak{trees}', kind='oak', pos=[round(p[0], 1), 0, round(p[1], 1)], vis='player', dims=OrderedDict(r=1 + rng.random() * 0.4, h=20 + rng.random() * 10, canopy=7 + rng.random() * 4))); trees += 1
    if trees >= 70: break
pines = 0
for _ in range(9000):
    p = [rng.uniform(-600, 7300), rng.uniform(-1500, 4500)]
    if inside(p, wall) or near_street(p, 25): continue
    dw = min(math.hypot(p[0] - q[0], p[1] - q[1]) for q in wall)
    if dw < 90 or (dw > 700 and rng.random() < 0.6): continue
    objects.append(OrderedDict(id=f'vallaki-pine{pines}', kind='pine', pos=[round(p[0], 1), 0, round(p[1], 1)], vis='player', dims=OrderedDict(scale=0.9 + rng.random() * 0.7))); pines += 1
    if pines >= 1500: break
# the church, the stockyard's pens, the camp's wagons
objects.append(OrderedDict(id='vallaki-church', kind='church-building', pos=[marks['N1'][0], 0, marks['N1'][1]], vis='player', key='N1', label=NAMES['N1'], rotY=90))
# the Vistani camp: the hill with the great tent on top, a ring of painted vardos round its foot, fires, the hovels
N9x, N9z = marks['N9']
objects.append(OrderedDict(id='vallaki-n9-hill', kind='mound', pos=[N9x, 0, N9z], vis='player', key='N9', dims=OrderedDict(r=130, h=16)))
objects.append(OrderedDict(id='vallaki-n9-tent', kind='big-tent', pos=[N9x, 16, N9z], vis='player', key='N9', dims=OrderedDict(r=40, h=30)))
for j in range(10):
    a = j / 10 * 2 * math.pi + 0.2; objects.append(OrderedDict(id=f'vallaki-wagon-{j}', kind='vardo', pos=[round(N9x + math.cos(a) * 150, 1), 0, round(N9z + math.sin(a) * 150, 1)], vis='player', key='N9', rotY=round(-math.degrees(a)), dims=OrderedDict(v=j)))
for j in range(4):
    a = j / 4 * 2 * math.pi + 0.6; objects.append(OrderedDict(id=f'vallaki-n9-fire{j}', kind='campfire', pos=[round(N9x + math.cos(a) * 112, 1), 0, round(N9z + math.sin(a) * 112, 1)], vis='player', key='N9'))
for j in range(5):
    a = j / 5 * 2 * math.pi + 1.0; objects.append(OrderedDict(id=f'vallaki-n9-hovel{j}', kind='roof-gable', pos=[round(N9x + math.cos(a) * 185, 1), 0, round(N9z + math.sin(a) * 185, 1)], vis='player', key='N9', rotY=round(-math.degrees(a)), dims=OrderedDict(w=20, d=26, h=8, y=0.5, turf=1)))
for j, (dx, dz) in enumerate([(-12, 0), (12, 0)]):
    objects.append(OrderedDict(id=f'vallaki-pen-{j}', kind='fence', pos=[marks['N5'][0] + dx, 0, marks['N5'][1] + 14], vis='player', key='N5', dims=OrderedDict(len=20)))
objects.append(OrderedDict(id='vallaki-well', kind='well', pos=[marks['N8'][0] - 5, 0, marks['N8'][1] + 10], vis='player', key='N8'))
objects.append(OrderedDict(id='vallaki-stage', kind='dais', pos=[marks['N8'][0], 0, marks['N8'][1] - 32], vis='player', key='N8', dims=OrderedDict(w=20, h=4, steps=3)))
objects.append(OrderedDict(id='vallaki-stocks', kind='pillory', pos=[marks['N8'][0] + 32, 0, marks['N8'][1] + 8], vis='player', key='N8', rotY=20))
objects.append(OrderedDict(id='vallaki-stocks-b', kind='pillory', pos=[marks['N8'][0] + 42, 0, marks['N8'][1] + 8], vis='player', key='N8', rotY=-15))
for j, (dx, dz) in enumerate([(-65, -45), (65, -45), (-65, 45), (65, 45)]): objects.append(OrderedDict(id=f'vallaki-brazier-{j}', kind='brazier', pos=[marks['N8'][0] + dx, 0, marks['N8'][1] + dz], vis='player', key='N8'))
# the palisade: 15-ft timber walls with a gate where the road crosses east and west
walls = []
def gate_cross(a, b, road_pts):
    """Does wall segment a-b cross the main road? (then it is a gate)"""
    for i in range(len(road_pts) - 1):
        p, q = road_pts[i], road_pts[i + 1]
        def ccw(A, B, C): return (C[1] - A[1]) * (B[0] - A[0]) > (B[1] - A[1]) * (C[0] - A[0])
        if ccw(a, p, q) != ccw(b, p, q) and ccw(a, b, p) != ccw(a, b, q): return True
    return False
road_main = streets_ft[0][2]; road_lake = streets_ft[1][2]; road_camp = streets_ft[6][2]
for i in range(len(wall)):
    a, b = wall[i], wall[(i + 1) % len(wall)]
    gate = gate_cross(a, b, road_main) or gate_cross(a, b, road_lake)
    if gate:
        # split the segment: wall - gate (20 ft) - wall
        L = math.hypot(b[0] - a[0], b[1] - a[1]); ux, uz = (b[0] - a[0]) / L, (b[1] - a[1]) / L; m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
        g0 = [round(m[0] - ux * 10, 1), round(m[1] - uz * 10, 1)]; g1 = [round(m[0] + ux * 10, 1), round(m[1] + uz * 10, 1)]
        walls.append(OrderedDict(id=f'pal-{i}a', a=a, b=g0, flags=['normal'], material='log', heightFt=15))
        walls.append(OrderedDict(id=f'gate-{i}', a=g0, b=g1, flags=['door'], material='log', heightFt=15, open=True))
        walls.append(OrderedDict(id=f'pal-{i}b', a=g1, b=b, flags=['normal'], material='log', heightFt=15))
    else:
        walls.append(OrderedDict(id=f'pal-{i}', a=a, b=b, flags=['normal'], material='log', heightFt=15))
rooms = []
for k in ['N1', 'N2', 'N4', 'N7', 'N8', 'N3', 'N6', 'N5', 'N9', 'N8a', 'N8b', 'N8c', 'N8d']:
    x, z = marks[k]; s = 30 if k in ('N7', 'N6', 'N8b', 'N8c') else 40 if k not in ('N8', 'N9', 'N5') else 60
    if k == 'N9': s = 340  # the whole camp, the hill and its ring of wagons (grass: the box is a key, not paving)
    r = OrderedDict(key=k, name=NAMES[k], page=PAGE.get(k), polygon=[[round(x - s / 2, 1), round(z - s / 2, 1)], [round(x + s / 2, 1), round(z - s / 2, 1)], [round(x + s / 2, 1), round(z + s / 2, 1)], [round(x - s / 2, 1), round(z + s / 2, 1)]], floor='cobble' if k != 'N9' else 'dirt')
    if k == 'N8': r['polygon'] = [[round(x - 75, 1), round(z - 55, 1)], [round(x + 75, 1), round(z - 55, 1)], [round(x + 75, 1), round(z + 55, 1)], [round(x - 75, 1), round(z + 55, 1)]]
    if k == 'N9': r['floor'] = 'grass'
    if k in ENTER: r['enter'] = ENTER[k]
    rooms.append(r)
DESC = {
  'N1': ("A slouching stone church with a bulging steeple, stained glass of saints cracked in every window, an iron-fenced garden of graves beside it.", "Father Lucian, Yeska and Milivoj. The bones of St. Andral are gone from the crypt: Milivoj took them to the coffin maker. Same plan as the village church, no undercroft."),
  'N2': ("A two-storey inn on the main street with a well in its yard and an outside stair.", "The Martikovs' inn: Urwin and Danika, the boys, Rictavio's wagon in the stable yard. Open the map for the floors."),
  'N3': ("The burgomaster's mansion behind its gate, banners of the festival on the posts.", "Baron Vargas, Lydia, Victor in the attic, Izek. The cells in the basement hold the town's complainers."),
  'N4': ("A grand old house of three storeys with its own small grounds.", "Lady Fiona Wachter, her sons and daughter, the cult meeting in the cellar."),
  'N5': ("Pens and a warehouse by the east gate where the stockyard's beasts are kept.", "Ernst Larnak's territory; Rictavio's tiger is penned here."),
  'N6': ("A narrow two-storey shop with coffins stacked in its window.", "Henrik van der Voort; the stolen bones and six vampire spawn in the nest above."),
  'N7': ("A toymaker's shop with a cheerful, slightly wrong sign.", "Gadof Blinsky and his toys; the doll that looks like Ireena."),
  'N8': ("The town square: the stocks, the festival stage, a dry well.", "Festival of the Blazing Sun; Izek's guards; the stocks for malcontents."),
  'N9': ("A Vistani camp in a hollow outside the west wall: wagons, horses, fires.", "Luvash and Arrigal; Arabelle missing; Kasimir's hovel among the dusk elves."),
}
for r in rooms:
    d = DESC.get(r['key'])
    if d: r['desc'] = d[0]; r['dm'] = d[1]
# The town's ground: the palisade and a belt round it. Beyond, the land is the region's own (the lake shore to
# the north, the slopes climbing south and east), so the map must not carry a flat plain out there.
_wx = [p[0] for p in wall] + [m[0] for m in marks.values()]; _wz = [p[1] for p in wall] + [m[1] for m in marks.values()]; BELT = 420
GX0, GX1, GZ0, GZ1 = round(min(_wx) - BELT, 1), round(max(_wx) + BELT, 1), round(min(_wz) - BELT, 1), round(max(_wz) + BELT, 1)
terrain = [OrderedDict(polygon=[[GX0, GZ0], [GX1, GZ0], [GX1, GZ1], [GX0, GZ1]], floor='grass')]
objects = [o for o in objects if not (o['kind'] == 'pine' and not (GX0 < o['pos'][0] < GX1 and GZ0 < o['pos'][2] < GZ1))]
# the approaches are felled: every tree within 200 yards of the palisade is a stump (the town burns a lot of wood)
def _wall_dist(p):
    best = 1e9
    for i in range(len(wall)):
        a, b = wall[i], wall[(i + 1) % len(wall)]; dx, dz = b[0] - a[0], b[1] - a[1]; L2 = dx * dx + dz * dz or 1
        t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2)); best = min(best, math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t))
    return best
for o in objects:
    if o['kind'] == 'pine' and _wall_dist((o['pos'][0], o['pos'][2])) < 600:
        o['kind'] = 'stump'; o['dims'] = OrderedDict(r=0.9 + (o['dims'].get('scale', 1) - 0.9) * 0.8, h=1.6 + (o['dims'].get('scale', 1) - 0.9) * 1.5)
pines = sum(1 for o in objects if o['kind'] == 'pine')
for name, w, pts in streets_ft:
    for poly in strip(pts, w): terrain.append(OrderedDict(polygon=poly, floor='cobble' if name == 'Old Svalich Road' else 'dirt'))
# settle: nothing on a street, through the palisade or through another house; every keyed site has its building
import sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from settle import settle
SITE_SIZES = {'N2': (62, 40, 2), 'N3': (52, 42, 2), 'N4': (46, 36, 2), 'N6': (30, 24, 1), 'N7': (30, 24, 1), 'N5': (44, 30, 1), 'N8a': (50, 30, 1), 'N8b': (30, 30, 1), 'N8c': (30, 24, 1), 'N8d': (50, 30, 1)}
_level = OrderedDict(terrain=terrain, rooms=rooms, walls=walls, objects=objects)
print('settle:', settle(_level, keyed=SITE_SIZES)); objects = _level['objects']
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
# Trodden soil: the ground under every house and round it is bare earth, not grass, and the keyed yards too.
from settle import rect as _frect
for o in objects:
    if o['kind'] not in ('house', 'church-building'): continue
    q = OrderedDict(o); q['dims'] = OrderedDict(w=(o.get('dims') or {}).get('w', 60) + 8, d=(o.get('dims') or {}).get('d', 30) + 8)
    terrain.append(OrderedDict(polygon=[[round(x, 1), round(z, 1)] for x, z in _frect(q)], floor='dirt'))
for r in rooms:
    if r.get('floor') == 'cobble' and r['key'] != 'N8': r['floor'] = 'dirt'   # only the square keeps paving; yards are earth
level = OrderedDict(id='town', name='Vallaki', elevationFt=0, ceilingFt=15, ambient='barovian-overcast', north='-z', terrain=terrain, rooms=rooms, walls=walls, lights=[], objects=objects)
scene = OrderedDict(schema=1, location='N', chapter='ch05', name='The Town of Vallaki', mapPage=97, bookScaleFt=5, ambient='barovian-overcast', placementFt=40, kind='placement', clearingFt=900, levels=[level], links=[], frame='measured-p97-400dpi')
grid = OrderedDict(schema=1, levels=OrderedDict(town=OrderedDict(floorPolygons=[terrain[0]['polygon']], type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0)))
os.makedirs(OUT, exist_ok=True)
json.dump(scene, open(os.path.join(OUT, 'scene.json'), 'w'), indent=1)
json.dump(grid, open(os.path.join(OUT, 'grid.json'), 'w'), indent=1)
print('vallaki:', kept, 'houses (', len(houses), 'extracted ) ;', trees, 'oaks', pines, 'pines ;', len(walls), 'wall pieces;', len(rooms), 'keyed sites')
