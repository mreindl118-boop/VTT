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
MARK = {'N1': (430, 470), 'N2': (995, 435), 'N3': (920, 690), 'N4': (1200, 305), 'N5': (1690, 690), 'N6': (1420, 720), 'N7': (1080, 605), 'N8': (1215, 622), 'N9': (-337, 1006)}
NAMES = {'N1': "St. Andral's Church", 'N2': 'Blue Water Inn', 'N3': "Burgomaster's Mansion", 'N4': 'Wachterhaus', 'N5': 'Arasek Stockyard', 'N6': "Coffin Maker's Shop", 'N7': 'Blinsky Toys', 'N8': 'Town Square', 'N9': 'Vistani Camp'}
ENTER = {'N1': 'ch05/N1', 'N2': 'ch05/N2', 'N3': 'ch05/N3', 'N4': 'ch05/N4', 'N5': 'ch05/N5', 'N6': 'ch05/N6', 'N7': 'ch05/N7', 'N9': 'ch05/N9'}
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
# the church, the stockyard's pens, the camp's wagons
objects.append(OrderedDict(id='vallaki-church', kind='church-building', pos=[marks['N1'][0], 0, marks['N1'][1]], vis='player', key='N1', label=NAMES['N1'], rotY=90))
for j, (dx, dz) in enumerate([(-14, -10), (14, -10), (0, 12)]):
    objects.append(OrderedDict(id=f'vallaki-wagon-{j}', kind='wagon', pos=[marks['N9'][0] + dx, 0, marks['N9'][1] + dz], vis='player', key='N9', rotY=j * 50))
for j, (dx, dz) in enumerate([(-12, 0), (12, 0)]):
    objects.append(OrderedDict(id=f'vallaki-pen-{j}', kind='fence', pos=[marks['N5'][0] + dx, 0, marks['N5'][1] + 14], vis='player', key='N5', dims=OrderedDict(len=20)))
objects.append(OrderedDict(id='vallaki-well', kind='well', pos=[marks['N8'][0], 0, marks['N8'][1]], vis='player', key='N8'))
# the palisade: 15-ft timber walls with a gate where the road crosses east and west
walls = []
def gate_cross(a, b, road_pts):
    """Does wall segment a-b cross the main road? (then it is a gate)"""
    for i in range(len(road_pts) - 1):
        p, q = road_pts[i], road_pts[i + 1]
        def ccw(A, B, C): return (C[1] - A[1]) * (B[0] - A[0]) > (B[1] - A[1]) * (C[0] - A[0])
        if ccw(a, p, q) != ccw(b, p, q) and ccw(a, b, p) != ccw(a, b, q): return True
    return False
road_main = [ft(*p) for p in STREETS[0][2]]; road_lake = [ft(*p) for p in STREETS[1][2]]; road_camp = [ft(*p) for p in STREETS[6][2]]
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
for k in ['N1', 'N2', 'N4', 'N7', 'N8', 'N3', 'N6', 'N5', 'N9']:
    x, z = marks[k]; s = 30 if k in ('N7', 'N6') else 40 if k not in ('N8', 'N9', 'N5') else 60
    r = OrderedDict(key=k, name=NAMES[k], page=PAGE.get(k), polygon=[[round(x - s / 2, 1), round(z - s / 2, 1)], [round(x + s / 2, 1), round(z - s / 2, 1)], [round(x + s / 2, 1), round(z + s / 2, 1)], [round(x - s / 2, 1), round(z + s / 2, 1)]], floor='cobble' if k != 'N9' else 'dirt')
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
terrain = [OrderedDict(polygon=[[0, 0], [7350, 0], [7350, 4580], [0, 4580]], floor='grass')]
for name, w, pts in STREETS:
    for poly in strip([ft(*p) for p in pts], w): terrain.append(OrderedDict(polygon=poly, floor='cobble'))
level = OrderedDict(id='town', name='Vallaki', elevationFt=0, ceilingFt=15, ambient='barovian-overcast', north='-z', terrain=terrain, rooms=rooms, walls=walls, lights=[], objects=objects)
scene = OrderedDict(schema=1, location='N', chapter='ch05', name='The Town of Vallaki', mapPage=97, bookScaleFt=5, ambient='barovian-overcast', placementFt=40, kind='placement', levels=[level], links=[], frame='measured-p97-400dpi')
grid = OrderedDict(schema=1, levels=OrderedDict(town=OrderedDict(floorPolygons=[terrain[0]['polygon']], type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0)))
os.makedirs(OUT, exist_ok=True)
json.dump(scene, open(os.path.join(OUT, 'scene.json'), 'w'), indent=1)
json.dump(grid, open(os.path.join(OUT, 'grid.json'), 'w'), indent=1)
print('vallaki:', kept, 'houses inside the palisade of', len(houses), ';', len(walls), 'wall pieces;', len(rooms), 'keyed sites')
