#!/usr/bin/env python3
"""The Ruins of Berez (chapter 10, area U; map p.164, one square = 100 ft) -> locations/ch10/U/{scene,grid}.json

A placement layer in true feet, like the village and Vallaki: the frame is the 300-dpi render of the book map,
whose grid was measured at 51.42 px per square across and 52 px down; the frame's top-left corner (page px
340, 230) is the origin, so X = (px - 340) / 0.5142 and Z = (py - 230) / 0.52, north up (-z). Positions and sizes
of the two cottage clusters (U1) and their low yard walls, the Ulrich mansion on its rise with its garden and the
skull-fenced goat pen (U2), the hut (U3, its own map: `enter`), the churchyard (U4), Marina's monument (U5), the
ring of standing stones across the Luna River (U6), the seven scarecrows, the surviving stretches of dirt road and
the river's banks were traced by hand on that render. Only positions, sizes and keys live here; the art and the
wording are ours. The marsh is the floor everywhere; the cellar under the mansion is a second level."""
import json, math, os, random, sys
from collections import OrderedDict

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
OUT = os.path.join(ROOT, 'locations', 'ch10', 'U')
W, H = 3520, 3600          # the frame, ft
_M = json.load(open(os.path.join(ROOT, 'manifests', 'locations.json')))
PAGE = {a['key']: a['page'] for l in _M['locations'] if l['id'] == 'U' for a in l['areas']}
rng = random.Random(10)
R1 = lambda v: round(v, 1)

# ------------------------------------------------------------------ geometry helpers
def inside(p, poly):
    x, z = p; c = False; n = len(poly)
    for i in range(n):
        (x0, z0), (x1, z1) = poly[i], poly[(i + 1) % n]
        if (z0 > z) != (z1 > z) and x < (x1 - x0) * (z - z0) / (z1 - z0) + x0: c = not c
    return c

def seg_dist(p, a, b):
    dx, dz = b[0] - a[0], b[1] - a[1]; L2 = dx * dx + dz * dz or 1
    t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2))
    return math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t)

def line_dist(p, pts): return min(seg_dist(p, pts[i], pts[i + 1]) for i in range(len(pts) - 1))
def poly_dist(p, poly): return 0 if inside(p, poly) else min(seg_dist(p, poly[i], poly[(i + 1) % len(poly)]) for i in range(len(poly)))

def chaikin(pts, passes=2, closed=False):
    for _ in range(passes):
        out = [] if closed else [pts[0]]
        rng_ = range(len(pts)) if closed else range(len(pts) - 1)
        for i in rng_:
            a, b = pts[i], pts[(i + 1) % len(pts)]
            out += [(a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25), (a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75)]
        if not closed: out.append(pts[-1])
        pts = out
    return [(R1(x), R1(z)) for x, z in pts]

def strip(pts, w):
    """A road as quads along its centreline with an octagon at each bend (the town maps' road ribbons)."""
    out, h = [], w / 2
    for i in range(len(pts) - 1):
        (x0, z0), (x1, z1) = pts[i], pts[i + 1]
        dx, dz = x1 - x0, z1 - z0; L = math.hypot(dx, dz) or 1; nx, nz = -dz / L * h, dx / L * h
        out.append([[R1(x0 + nx), R1(z0 + nz)], [R1(x1 + nx), R1(z1 + nz)], [R1(x1 - nx), R1(z1 - nz)], [R1(x0 - nx), R1(z0 - nz)]])
    for (x, z) in pts[1:-1]:
        out.append([[R1(x + math.cos(a) * h), R1(z + math.sin(a) * h)] for a in [k * math.pi / 4 for k in range(8)]])
    return out

def blob(cx, cz, rx, rz, n=12, jit=0.22, rot=0.0):
    pts = []
    for k in range(n):
        a = k / n * 2 * math.pi; r = 1 + (rng.random() - 0.5) * 2 * jit
        x, z = math.cos(a) * rx * r, math.sin(a) * rz * r
        pts.append([R1(cx + x * math.cos(rot) - z * math.sin(rot)), R1(cz + x * math.sin(rot) + z * math.cos(rot))])
    return pts

def ngon(cx, cz, r, n, a0=0.0): return [[R1(cx + math.cos(a0 + k / n * 2 * math.pi) * r), R1(cz + math.sin(a0 + k / n * 2 * math.pi) * r)] for k in range(n)]
def rect(x0, z0, x1, z1): return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
def rot_to(dx, dz): return R1(math.degrees(math.atan2(-dz, dx)))   # rotY that turns local +x toward (dx, dz)

def foot(x, z, w, d, rot):
    a = math.radians(rot); c, s = math.cos(a), math.sin(a)
    return [[x + c * dx + s * dz, z - s * dx + c * dz] for dx, dz in ((-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2))]

# ------------------------------------------------------------------ the land
# The Luna River: the west bank down to where the western arm leaves, that arm out to the map's west edge and back,
# the spit between the arms, the main channel's east bank, and the far bank up to the north-east corner.
RIVER = [(2960, 0), (2880, 240), (2770, 470), (2640, 700), (2490, 910), (2345, 1105), (2215, 1285), (2100, 1450), (2015, 1600), (1965, 1770), (1925, 1940),
         (1860, 2090), (1780, 2215), (1680, 2315), (1570, 2400), (1400, 2475), (1200, 2500), (1000, 2435), (800, 2400), (600, 2455), (400, 2520), (200, 2600),
         (60, 2700), (0, 2740), (0, 2900), (150, 2800), (400, 2690), (600, 2640), (800, 2610), (1000, 2625), (1200, 2650), (1340, 2690), (1420, 2760),
         (1360, 2850), (1270, 2960), (1120, 3060), (1000, 3160), (930, 3300), (880, 3450), (860, 3600), (1450, 3600), (1520, 3420), (1620, 3260),
         (1760, 3110), (1860, 2950), (1960, 2760), (2060, 2560), (2150, 2360), (2230, 2140), (2290, 1960), (2330, 1880), (2420, 1860), (2520, 1720),
         (2640, 1560), (2740, 1400), (2810, 1220), (2860, 1060), (2930, 900), (3030, 750), (3170, 610), (3330, 460), (3520, 330), (3520, 0)]
RIVER = chaikin(RIVER, 2, closed=True)
# the narrow eastern channel that leaves the river below the standing stones and runs south off the map
_SW = [(2330, 1880), (2335, 2000), (2390, 2160), (2470, 2280), (2560, 2410), (2660, 2530), (2730, 2680), (2780, 2850), (2820, 3050), (2850, 3300), (2870, 3600)]
_SW = chaikin(_SW, 2)
STREAM = _SW + [(x + 52 - (12 if i < 3 else 0), z) for i, (x, z) in enumerate(reversed(_SW))]
STREAM = [(x, z) for x, z in STREAM]
WATER = [RIVER, STREAM]
def in_water(p, m=0): return any(inside(p, wp) for wp in WATER) or (m and any(poly_dist(p, wp) < m for wp in WATER))

# The surviving stretches of dirt road: from the north-east along the river to a fork; one arm curves west past the
# northern cottages and fades out short of the hut, the other follows the bank down into the eastern cottages.
ROAD_NE = chaikin([(2860, 0), (2700, 210), (2560, 400), (2430, 590), (2340, 760)], 2)
ROAD_ARC = chaikin([(2340, 760), (2200, 665), (2000, 585), (1800, 548), (1600, 552), (1450, 600), (1350, 660), (1250, 745), (1160, 845), (1090, 960), (1052, 1090), (1040, 1200)], 2)
ROAD_RIV = chaikin([(2340, 760), (2245, 900), (2165, 1050), (2105, 1200), (2050, 1300), (1960, 1415), (1830, 1488), (1700, 1528), (1550, 1568), (1400, 1600), (1310, 1615)], 2)
ROADS = [ROAD_NE, ROAD_ARC, ROAD_RIV]
ROAD_W = 18
def near_road(p, m): return any(line_dist(p, r) < ROAD_W / 2 + m for r in ROADS)

# raised, drier ground: the two cottage clusters and the mansion's rise
DRY_N = chaikin([(830, 760), (900, 640), (990, 540), (1100, 450), (1200, 370), (1300, 345), (1365, 365), (1425, 500), (1445, 600), (1400, 660), (1300, 730), (1200, 810), (1110, 905), (1050, 985), (960, 965), (880, 905), (840, 830)], 2, closed=True)
DRY_E = chaikin([(1340, 1380), (1420, 1300), (1560, 1255), (1700, 1228), (1850, 1218), (1990, 1258), (2075, 1350), (2085, 1450), (2050, 1580), (1985, 1700), (1890, 1800), (1760, 1880), (1600, 1915), (1450, 1910), (1350, 1860), (1318, 1750), (1318, 1600), (1328, 1480)], 2, closed=True)
DRY_U2 = chaikin([(790, 1660), (880, 1620), (1000, 1640), (1090, 1690), (1180, 1700), (1225, 1780), (1220, 1880), (1150, 1910), (1060, 1900), (1050, 1990), (1060, 2080), (1010, 2110), (900, 2110), (815, 2085), (790, 1960), (775, 1800)], 2, closed=True)
DRY = [DRY_N, DRY_E, DRY_U2]

# ------------------------------------------------------------------ keyed sites
MARK = {'U1': (1120, 640), 'U1e': (1700, 1580), 'U2': (930, 1770), 'U3': (1232, 1305), 'U4': (655, 1405), 'U5': (219, 1814), 'U6': (2726, 1722)}
NAMES = {'U1': 'Abandoned Cottages', 'U2': 'Ulrich Mansion', 'U3': "Baba Lysaga's Hut", 'U4': 'Churchyard', 'U5': "Marina's Monument", 'U6': 'Standing Stones'}
MANSION = [(860, 1720, 1000, 1755), (905, 1755, 955, 1830), (920, 1696, 940, 1720)]   # main range, south wing, north porch (x0, z0, x1, z1)
PEN_C, PEN_R = (1100, 1790), 80                                                     # fifty skulls on posts ten feet apart: a ring of 80 ft
GARDEN = (840, 1850, 1035, 2060)
CEMETERY = (550, 1270, 760, 1540)
CHURCH = (598, 1580, 662, 1616)
MONUMENT = (214, 1809, 224, 1819)
STONES_C, STONES_R = MARK['U6'], 50
CELLAR = (915, 1772, 945, 1802)

rooms = []
def room(key, name, poly, floor, page_key=None, **kw):
    r = OrderedDict(key=key, name=name, page=PAGE.get(page_key or key.split('-')[0]), polygon=[[R1(x), R1(z)] for x, z in poly], floor=floor)
    r.update(kw); rooms.append(r); return r
room('U1', NAMES['U1'], [(860, 770), (935, 650), (1010, 560), (1105, 470), (1205, 385), (1345, 368), (1410, 590), (1250, 760), (1110, 910), (1040, 965), (905, 885)], 'dirt')
room('U1-east', NAMES['U1'] + ' (east)', [(1360, 1380), (1450, 1300), (1600, 1262), (1760, 1240), (1900, 1250), (2010, 1300), (2050, 1430), (2010, 1580), (1930, 1700), (1820, 1800), (1670, 1860), (1500, 1880), (1380, 1840), (1350, 1720), (1350, 1560)], 'dirt')
room('U2', NAMES['U2'], [(845, 1690), (1010, 1690), (1010, 1840), (845, 1840)], 'dirt')
room('U2-garden', 'Ulrich Mansion: Garden', rect(*GARDEN), 'grass')
room('U2-pen', 'Ulrich Mansion: Goat Pen', ngon(PEN_C[0], PEN_C[1], PEN_R, 20), 'dirt')
room('U3', NAMES['U3'], rect(MARK['U3'][0] - 32, MARK['U3'][1] - 32, MARK['U3'][0] + 32, MARK['U3'][1] + 32), 'marsh', enter='ch10/U3')
room('U4', NAMES['U4'], rect(*CEMETERY), 'grass')
room('U4-church', 'Churchyard: the Gutted Church', rect(CHURCH[0] - 4, CHURCH[1] - 4, CHURCH[2] + 4, CHURCH[3] + 4), 'flagstone')
room('U5', NAMES['U5'], rect(*MONUMENT), 'grass')
room('U6', NAMES['U6'], ngon(STONES_C[0], STONES_C[1], STONES_R + 8, 12, math.pi / 12), 'grass')
DESC = {
  'U1': ('Ruined cottages behind low, tumbled stone walls, their roofs fallen in and black with mildew; a short stretch of dirt road still runs past their gates.',
         'Rotted furnishings, nothing of value. The walls are 3 ft high and easily climbed. Fly swarms (1d4, wasp stats) trouble any rest taken in the marsh.'),
  'U1-east': ('More drowned cottages crowd a curve of old road above the river, every yard wall broken.',
              'As the northern cluster: empty, rotted, nothing of value. Muriel watches this bank from the stones across the river.'),
  'U2': ('Heaps of stone and rotting timber on a rise above the marsh; a few arched windows still stand, staring at nothing.',
         "Lazlo Ulrich's ghost haunts the ruin and attacks treasure-seekers; only Ireena in the flesh can lay him to rest. A rubble-choked stair leads to the cellar (4 hours to clear)."),
  'U2-garden': ('An overgrown garden behind broken walls: thorny vines and tall weeds hide pale statues and carved stone benches.',
                'Four giant poisonous snakes attack anyone who goes more than 10 ft inside.'),
  'U2-pen': ('A crude ring of wooden fence with no gate, a human skull grinning on top of every post; goats bleat inside.',
             'Nine goats; fifty skulls 10 ft apart. Damaging the fence sets the skulls howling for a minute: Baba Lysaga arrives in her flying skull in 2 rounds, and the seven scarecrows come too.'),
  'U3': ("A ramshackle hut perched on the stump of a giant tree whose roots claw out of the mire like a spider's legs; a hollow giant's skull floats under its doorway and two cages of ravens hang from its eaves.",
         "Baba Lysaga's home. Open the map for the hut and its interior. The ravens' noise drowns out anyone approaching."),
  'U4': ('A churchyard of leaning gravestones behind a rusting iron fence, half of it sunk into the mire.',
         'Rotted coffins and mouldy bones in the graves; nothing of value.'),
  'U4-church': ('The roofless shell of a stone church; its steeple lies collapsed across the west end.',
                'A rotten pulpit; the old iron bell lies half sunk in the marsh among the steeple stones.'),
  'U5': ('A little raised plot, ten feet square, inside a broken iron fence: a weathered statue of a kneeling peasant girl holding a rose.',
         'The epitaph reads "Marina, Taken by the Mists". Found only by searching the square (DC 15 Wisdom (Perception), 10 minutes) or by Ulrich\'s directions. A card-reading treasure lies in a cavity under the statue (DC 15 Strength). Disturbing it raises seven bloated corpses from the mire 60 ft west.'),
  'U6': ('Twelve mossy menhirs, 15 to 18 ft tall, stand in a ring a hundred feet across; two lean inward. A lantern flickers behind the tallest.',
         'Muriel Vinshaw, a wereraven, signals with her lantern and warns the party about Berez. The four tall stones face the compass points; the eight others bear worn glyphs of bear, elk, hawk, goat, owl, panther, raven and wolf. No divination reaches inside the circle; a druid who wild-shapes here gains maximum hit points.'),
  'U2-cellar': ('A 30-ft-square cellar of mortared stone under rotting ceiling beams, ankle-deep in stagnant water; rotted casks stand in rows.',
                'Two dozen empty, rotted Wizard of Wines casks labelled Champagne du le Stomp.'),
}
for r in rooms:
    d = DESC.get(r['key'])
    if d: r['desc'], r['dm'] = d

# ------------------------------------------------------------------ objects
objects = []
def obj(id, kind, x, z, vis='player', key=None, rot=0, y=0, dims=None, label=None, size=None, desc=None, dm=None, player=None, container=None):
    o = OrderedDict(id=f'U-{id}', kind=kind, pos=[R1(x), y, R1(z)], vis=vis)
    if rot: o['rotY'] = R1(rot)
    if key: o['key'] = key
    if label: o['label'] = label
    if player: o['playerLabel'] = player
    if size: o['size'] = size
    if dims: o['dims'] = OrderedDict((k, R1(v) if isinstance(v, float) else v) for k, v in dims.items())
    if desc: o['desc'] = desc
    if dm: o['dm'] = dm
    if container: o['container'] = container
    objects.append(o); return o
walls = []
def wall(id, a, b, h, material='rubble', flags=('normal',)):
    walls.append(OrderedDict(id=f'U-w-{id}', a=[R1(a[0]), R1(a[1])], b=[R1(b[0]), R1(b[1])], flags=list(flags), material=material, heightFt=h))
def wall_line(id, pts, h, material='rubble', flags=('terrain',), gaps=()):
    for i in range(len(pts) - 1):
        if i in gaps: continue
        wall(f'{id}-{i}', pts[i], pts[i + 1], h, material, flags)

FOOTS = []   # every footprint we place, for the self-audit
def cottage(id, x, z, w, d, rot, key):
    o = obj(id, 'ruined-cottage', x, z, key=key, rot=rot, dims=OrderedDict(w=w, d=d, h=9, v=round(rng.random(), 2)), y=-0.6)
    FOOTS.append((o['id'], foot(x, z, w + 2, d + 2, rot)))

# U1 north: three yards along the curve of the road, their walls running back from it (3 ft, tumbled)
wall_line('u1n-a', [(1010, 540), (1200, 385)], 3)
wall_line('u1n-b', [(1272, 372), (1340, 376), (1400, 590)], 3)
wall_line('u1n-c', [(1100, 480), (1245, 700)], 3)
wall_line('u1n-d', [(860, 750), (950, 620), (1135, 790)], 3)
wall_line('u1n-e', [(880, 845), (915, 875), (1035, 950)], 3)
for i, (x, z, w, d) in enumerate([(1290, 560, 24, 18), (1170, 680, 22, 16), (1050, 830, 24, 16)]):
    cottage(f'u1n-c{i}', x, z, w, d, rot_to(-0.71, 0.70) + (8 if i % 2 else -6), 'U1')
# U1 east: the yards either side of the old road above the river
wall_line('u1e-a', [(1443, 1386), (1443, 1552), (1494, 1556)], 3)
wall_line('u1e-b', [(1604, 1362), (1628, 1434)], 3)
wall_line('u1e-c', [(1719, 1314), (1806, 1456)], 3)
wall_line('u1e-d', [(1823, 1266), (1956, 1360)], 3)
wall_line('u1e-e', [(1421, 1643), (1385, 1645), (1385, 1800)], 3)
wall_line('u1e-f', [(1549, 1675), (1561, 1867)], 3)
wall_line('u1e-g', [(1665, 1615), (1713, 1825), (1841, 1777)], 3)
wall_line('u1e-h', [(1810, 1573), (1835, 1705)], 3)
wall_line('u1e-i', [(1908, 1506), (2011, 1597), (1935, 1705)], 3)
wall_line('u1e-j', [(1370, 1868), (1520, 1900), (1700, 1872), (1850, 1810)], 2.5, gaps=(1,))
for i, (x, z, w, d, r) in enumerate([(1520, 1492, 22, 16, 10), (1652, 1490, 18, 14, 18), (1745, 1435, 22, 16, 30), (1872, 1360, 22, 16, 38),
                                     (1448, 1716, 22, 16, -2), (1628, 1716, 22, 16, 6), (1762, 1662, 22, 16, 16), (1902, 1568, 20, 16, 40)]):
    cottage(f'u1e-c{i}', x, z, w, d, r, 'U1-east')
# a few lone cottages sunk in the marsh away from the clusters (the approach describes them scattered throughout)
for i, (x, z, r) in enumerate([(640, 820, 25), (1700, 960, -15), (420, 1240, 70), (1480, 2120, 10), (2240, 520, 35)]):
    cottage(f'lone{i}', x, z, 20, 15, r, None)

# U2: the mansion's broken walls (stone, standing 3 to 16 ft), the arched windows still standing on the north front,
# the heaps of fallen stone and timber, the garden's broken walls, the skull fence round the goat pen
(mx0, mz0, mx1, mz1), (wx0, wz0, wx1, wz1), (px0, pz0, px1, pz1) = MANSION
MW = [((mx0, mz0), (mx0 + 22, mz0), 9), ((mx0 + 52, mz0), (px0, mz0), 6), ((px1, mz0), (mx1 - 30, mz0), 7), ((mx1 - 12, mz0), (mx1, mz0), 12),
      ((mx1, mz0), (mx1, mz1), 14), ((mx1, mz1), (wx1 + 18, mz1), 5), ((wx1, mz1), (wx1, wz1 - 30), 11), ((wx1, wz1 - 12), (wx1, wz1), 4),
      ((wx1, wz1), (wx0 + 20, wz1), 3), ((wx0, wz1), (wx0, wz1 - 40), 8), ((wx0, mz1), (mx0 + 25, mz1), 6), ((mx0, mz1), (mx0, mz0 + 10), 10),
      ((px0, pz0), (px1, pz0), 13), ((px0, pz0), (px0, mz0), 13), ((px1, pz0), (px1, mz0), 10), ((mx0 + 40, mz0), (mx0 + 40, mz1), 4)]
for i, (a, b, h) in enumerate(MW): wall(f'mansion-{i}', a, b, h, 'ashlar')
for i, (x, z, L, rot, h) in enumerate([(mx0 + 37, mz0, 28, 0, 18), (mx1 - 21, mz0, 18, 0, 16), (mx0, mz0 + 22, 20, 90, 15)]):
    obj(f'arches{i}', 'ruin-arches', x, z, key='U2', rot=rot, dims=OrderedDict(len=L, h=h, n=2 if L < 24 else 3))
for i, (x, z, r, h) in enumerate([(930, 1738, 14, 7), (895, 1745, 9, 5), (975, 1742, 10, 6), (930, 1800, 12, 6), (940, 1822, 7, 4), (872, 1770, 8, 4), (985, 1785, 9, 5)]):
    obj(f'rubble{i}', 'rubble-heap', x, z, key='U2', rot=i * 47, dims=OrderedDict(r=r, h=h))
GW = [((GARDEN[0], GARDEN[1]), (GARDEN[0], GARDEN[1] + 70), 6), ((GARDEN[0], GARDEN[1] + 95), (GARDEN[0], GARDEN[3]), 5),
      ((GARDEN[0], GARDEN[3]), (GARDEN[0] + 80, GARDEN[3]), 6), ((GARDEN[0] + 110, GARDEN[3]), (GARDEN[2], GARDEN[3]), 4),
      ((GARDEN[2], GARDEN[3]), (GARDEN[2], GARDEN[3] - 60), 5), ((GARDEN[2], GARDEN[3] - 120), (GARDEN[2], GARDEN[1] + 20), 6)]
for i, (a, b, h) in enumerate(GW): wall(f'garden-{i}', a, b, h, 'rubble')
obj('pen-fence', 'skull-fence', PEN_C[0], PEN_C[1], key='U2-pen', dims=OrderedDict(r=PEN_R, n=50),
    desc='A ring of crude fence posts, a human skull on top of each.', dm='Fifty skulls, 10 ft apart; no gate. Damage the fence and they howl for a minute.')
for i in range(9):
    a = i / 9 * 2 * math.pi + 0.4; rr = 25 + (i * 37) % 40
    obj(f'goat{i}', 'goat', PEN_C[0] + math.cos(a) * rr, PEN_C[1] + math.sin(a) * rr, key='U2-pen', rot=(i * 83) % 360, size='medium', label='Goat')
# the garden: thickets and hedges run wild round pale statues and stone benches
gx0, gz0, gx1, gz1 = GARDEN
for i in range(26):
    x, z = gx0 + 12 + rng.random() * (gx1 - gx0 - 24), gz0 + 12 + rng.random() * (gz1 - gz0 - 24)
    obj(f'thicket{i}', 'thorn-thicket' if i % 3 else 'bush', x, z, key='U2-garden', rot=rng.random() * 360, dims=OrderedDict(s=1.4 + rng.random() * 1.6))
for i, (x, z, r) in enumerate([(880, 1900, 30), (990, 1905, -20), (900, 2000, 10), (1000, 2010, 160), (940, 1950, 0), (870, 2040, 80)]):
    obj(f'statue{i}', 'garden-statue', x, z, key='U2-garden', rot=r, dims=OrderedDict(v=i))
for i, (x, z, r) in enumerate([(915, 1935, 0), (965, 1980, 90), (930, 2030, 20)]):
    obj(f'bench{i}', 'stone-bench', x, z, key='U2-garden', rot=r)
obj('cellar-stair', 'trapdoor', 930, 1768, 'hidden-object', 'U2', label='Rubble-choked stair to the cellar (4 hours to clear alone)', player='A stair under the rubble')

# U3: the hut on its stump, roots spread, the giant's skull afloat by the door, the raven cages
obj('hut', 'creeping-hut', MARK['U3'][0], MARK['U3'][1], key='U3', dims=OrderedDict(s=1),
    desc="A hut on a giant stump, roots splayed like a spider's legs; a skull floats by its door.", dm="Baba Lysaga's creeping hut (CR 11 construct) when she wakes it. Open the hut's own map for the interior.")

# U4: graves in rows, the western half sunk into the water; the iron fence; the church shell south of it
cx0, cz0, cx1, cz1 = CEMETERY
for row in range(7):
    for col in range(9):
        x = cx0 + 22 + col * ((cx1 - cx0 - 44) / 8) + (rng.random() - 0.5) * 6; z = cz0 + 26 + row * ((cz1 - cz0 - 52) / 6) + (rng.random() - 0.5) * 6
        sunk = x < (cx0 + cx1) / 2 - 10
        if sunk and rng.random() < 0.45: continue
        obj(f'grave{row}-{col}', 'gravestone', x, z, key='U4', rot=180 + (rng.random() - 0.5) * (50 if sunk else 16), y=-1.1 if sunk else -0.2)
FENCE = [((cx0, cz0), (cx1, cz0)), ((cx1, cz0), (cx1, cz1)), ((cx1, cz1), (cx0, cz1)), ((cx0, cz1), (cx0, cz0))]
fi = 0
for (a, b) in FENCE:
    L = math.hypot(b[0] - a[0], b[1] - a[1]); n = int(L // 24)
    for k in range(n):
        if rng.random() < 0.28: continue   # rusted through and fallen
        t = (k + 0.5) / n; x, z = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
        obj(f'fence{fi}', 'iron-fence', x, z, key='U4', rot=rot_to(b[0] - a[0], b[1] - a[1]), dims=OrderedDict(len=L / n - 1, lean=round((rng.random() - 0.5) * 16, 1)), y=-0.3); fi += 1
chx0, chz0, chx1, chz1 = CHURCH
CW = [((chx0 + 14, chz0), (chx1 - 18, chz0), 14), ((chx1 - 8, chz0), (chx1, chz0), 9), ((chx1, chz0), (chx1, chz1), 16), ((chx1, chz1), (chx1 - 22, chz1), 12),
      ((chx1 - 36, chz1), (chx0 + 12, chz1), 10), ((chx0, chz1 - 10), (chx0, chz0 + 8), 7)]
for i, (a, b, h) in enumerate(CW): wall(f'church-{i}', a, b, h, 'ashlar')
obj('steeple', 'rubble-heap', chx0 + 4, (chz0 + chz1) / 2, key='U4-church', rot=20, dims=OrderedDict(r=13, h=7, spire=1))
obj('bell', 'sunken-bell', chx0 + 16, chz1 - 7, key='U4-church', rot=35, y=-1.2, desc='An iron bell lies tilted in the black water.')
obj('pulpit', 'rotten-pulpit', chx1 - 9, (chz0 + chz1) / 2, key='U4-church', rot=90)
obj('graves-note', 'note', (cx0 + cx1) / 2, (cz0 + cz1) / 2, 'dm-note', 'U4', label='Rotted coffins and mouldy bones; nothing of value.')

# U5: the monument on its little rise, its fence, the corpses waiting west of it in the mire
mcx, mcz = (MONUMENT[0] + MONUMENT[2]) / 2, (MONUMENT[1] + MONUMENT[3]) / 2
obj('rise', 'mound', mcx, mcz, key='U5', dims=OrderedDict(r=8, h=2.5))
obj('statue', 'marina-statue', mcx, mcz, key='U5', rot=200, y=2.5,
    desc='A life-sized stone girl kneels clutching a rose; her worn face looks a great deal like Ireena.', dm='Epitaph: "Marina, Taken by the Mists". Tip it (DC 15 Strength) for the cavity beneath.')
for i, (dx, dz, r) in enumerate([(0, -6, 0), (6, 0, 90), (0, 6, 180), (-6, 0, 270)]):
    if i == 2: continue   # one side has rusted away
    obj(f'mon-fence{i}', 'iron-fence', mcx + dx, mcz + dz, key='U5', rot=r, dims=OrderedDict(len=11, lean=(i - 1) * 7), y=1.8)
obj('cavity', 'niche', mcx, mcz, 'hidden-object', 'U5', label='Cavity under the statue: the card-reading treasure, if it is here', player='A hollow under the statue')
for i in range(7):
    obj(f'corpse{i}', 'bloated-corpse', mcx - 60 - (i % 3) * 9, mcz - 27 + i * 9, 'hidden-creature', 'U5', rot=90, size='medium',
        label='Bloated corpse (commoner, speed 20 ft; bursts into a snake swarm at 0 hp)', player='A bloated corpse')

# U6: the ring of menhirs across the river; Muriel and her lantern behind the tallest
GLYPHS = ['bear', 'elk', 'hawk', 'goat', 'owl', 'panther', 'raven', 'wolf']
gi = 0
for k in range(12):
    a = -math.pi / 2 + k / 12 * 2 * math.pi
    x, z = STONES_C[0] + math.cos(a) * STONES_R, STONES_C[1] + math.sin(a) * STONES_R
    tall = k % 3 == 0
    lean = 9 if k in (4, 8) else 0
    o = obj(f'menhir{k}', 'menhir', x, z, key='U6', rot=rot_to(-math.cos(a), -math.sin(a)), dims=OrderedDict(h=18 if tall else 15 + (k % 2) * 1.5, lean=lean, glyph=0 if tall else 1))
    o['label'] = 'Tall menhir' if tall else f'Menhir carved with a {GLYPHS[gi]}'
    if not tall: gi += 1
obj('muriel', 'muriel-vinshaw', STONES_C[0] + 4, STONES_C[1] - STONES_R - 5, 'hidden-creature', 'U6', rot=-90, size='medium',
    label='Muriel Vinshaw (wereraven, human form): lantern and dagger', player='A peasant woman with a lantern')
lights = [OrderedDict(id='U-l-muriel', pos=[R1(STONES_C[0] + 5), 4, R1(STONES_C[1] - STONES_R - 5)], preset='hooded-lantern', bright=15, dim=30)]

# the seven marsh scarecrows (the map's crosses), Baba Lysaga at home, the ghost, the garden's snakes
for i, (x, z) in enumerate([(1273, 1050), (1881, 1149), (873, 1149), (1485, 1358), (975, 1448), (1189, 1653), (1380, 1946)]):
    obj(f'scarecrow{i}', 'marsh-scarecrow', x, z, rot=(i * 71) % 360, label='Scarecrow', key=None,
        desc='A scarecrow stuffed with raven feathers, leaning on its pole.', dm="One of Baba Lysaga's seven scarecrows (CR 1): still until attacked, commanded, or roused by the howling skulls.")
obj('baba-lysaga', 'baba-lysaga', MARK['U3'][0] + 3, MARK['U3'][1], 'hidden-creature', 'U3', rot=0, y=10, size='medium',
    label='Baba Lysaga (inside the hut)', player='An ancient crone')
obj('ulrich', 'ghost', 930, 1785, 'hidden-creature', 'U2', size='medium', label='Ghost of Lazlo Ulrich (neutral good; reforms in 24 hours)', player='A mutilated giant of a ghost')
for i, (x, z) in enumerate([(870, 1900), (1005, 1925), (900, 2015), (990, 2030)]):
    obj(f'snake{i}', 'giant-poisonous-snake', x, z, 'hidden-creature', 'U2-garden', rot=i * 90, size='medium', label='Giant poisonous snake', player='A snake in the weeds')

# ------------------------------------------------------------------ dressing: reeds, dead trees, brush, pools
KEEP = [r['polygon'] for r in rooms if r['key'] not in ('U1', 'U1-east', 'U2-garden', 'U6')]
def clear(p, m):
    if in_water(p) or near_road(p, m): return False
    if any(poly_dist(p, kp) < m for kp in KEEP): return False
    if any(inside(p, f) or poly_dist(p, f) < m for _, f in FOOTS): return False
    if any(seg_dist(p, w['a'], w['b']) < m * 0.6 for w in walls): return False
    if not (8 < p[0] < W - 8 and 8 < p[1] < H - 8): return False
    return True
terrain = []
for tx in range(0, W, 440):
    for tz in range(0, H, 450):
        terrain.append(OrderedDict(polygon=rect(tx, tz, min(W, tx + 440), min(H, tz + 450)), floor='marsh'))
for poly in DRY: terrain.append(OrderedDict(polygon=[[x, z] for x, z in poly], floor='dirt'))
# the sunken half of the cemetery: black water among the stones
terrain.append(OrderedDict(polygon=blob(cx0 + 52, (cz0 + cz1) / 2 + 10, 50, 120, 14, 0.12), floor='shallow-water'))
terrain.append(OrderedDict(polygon=blob(chx0 + 12, chz1 - 6, 14, 9, 10, 0.2), floor='shallow-water'))
pools = []
for _ in range(2000):
    p = (rng.uniform(40, W - 40), rng.uniform(40, H - 40))
    r = 14 + rng.random() * 46
    if not clear(p, r + 12) or any(math.hypot(p[0] - q[0], p[1] - q[1]) < r + qr + 30 for q, qr in pools): continue
    if any(inside(p, d) for d in DRY) and rng.random() < 0.85: continue
    pools.append((p, r))
    if len(pools) >= 70: break
for p, r in pools: terrain.append(OrderedDict(polygon=blob(p[0], p[1], r, r * (0.55 + rng.random() * 0.4), 11, 0.2, rng.random() * math.pi), floor='shallow-water'))
def in_pool(p, m=0): return any(math.hypot(p[0] - q[0], p[1] - q[1]) < r + m for q, r in pools)
for name, pts in (('ne', ROAD_NE), ('arc', ROAD_ARC), ('river', ROAD_RIV)):
    for poly in strip(pts, ROAD_W): terrain.append(OrderedDict(polygon=poly, floor='dirt'))
terrain.append(OrderedDict(polygon=[[x, z] for x, z in RIVER], floor='shallow-water'))
terrain.append(OrderedDict(polygon=[[x, z] for x, z in STREAM], floor='shallow-water'))

n_reed = n_tree = n_bush = 0
for i in range(30000):
    p = (rng.uniform(10, W - 10), rng.uniform(10, H - 10))
    # reeds crowd the pool edges and the river bank; elsewhere they stand in clumps
    near_water = in_pool(p, 18) or any(poly_dist(p, wp) < 30 for wp in WATER)
    if rng.random() > (0.5 if near_water else 0.07): continue
    if not clear(p, 6) or in_pool(p): continue
    if any(inside(p, d) for d in (DRY_N, DRY_E)) and rng.random() < 0.7: continue
    obj(f'reed{n_reed}', 'reeds', p[0], p[1], rot=rng.random() * 360, dims=OrderedDict(s=0.8 + rng.random() * 0.9)); n_reed += 1
    if n_reed >= 900: break
for i in range(6000):
    p = (rng.uniform(20, W - 20), rng.uniform(20, H - 20))
    if not clear(p, 14) or in_pool(p, 4): continue
    if any(inside(p, d) for d in DRY) and rng.random() < 0.6: continue
    obj(f'deadtree{n_tree}', 'dead-tree', p[0], p[1], rot=rng.random() * 360, dims=OrderedDict(scale=0.8 + rng.random() * 0.8)); n_tree += 1
    if n_tree >= 110: break
for i in range(8000):
    p = (rng.uniform(20, W - 20), rng.uniform(20, H - 20))
    if not clear(p, 8) or in_pool(p, 3): continue
    obj(f'bush{n_bush}', 'bush', p[0], p[1], rot=rng.random() * 360, dims=OrderedDict(scale=0.8 + rng.random() * 0.9)); n_bush += 1
    if n_bush >= 160: break
for i, (x, z) in enumerate([(2560, 1800), (2900, 1680), (2610, 1610), (3050, 2100), (420, 2000), (1600, 2300), (2200, 3200)]):
    if clear((x, z), 6): obj(f'boulder{i}', 'boulder', x, z, rot=i * 50, dims=OrderedDict(r=2 + (i % 3)))

# ------------------------------------------------------------------ the cellar under the mansion
CX0, CZ0, CX1, CZ1 = CELLAR
cel_objects = []
def cobj(id, kind, x, z, **kw):
    o = OrderedDict(id=f'U-cel-{id}', kind=kind, pos=[R1(x), kw.get('y', 0), R1(z)], vis=kw.get('vis', 'player'))
    for k in ('rotY', 'key', 'label', 'dims', 'desc', 'dm', 'playerLabel'):
        if k in kw: o[k] = kw[k]
    cel_objects.append(o); return o
cobj('stair', 'stairs-straight', CX0 + 15, CZ0, key='U2-cellar', dims=OrderedDict(w=5, rise=12, fromZ=CZ0 + 14, toZ=CZ0 + 1))
cobj('water', 'water', (CX0 + CX1) / 2, (CZ0 + CZ1) / 2, key='U2-cellar', dims=OrderedDict(w=29.4, d=29.4), y=0.15)
ci = 0
for row in range(4):
    for col in range(6):
        x = CX0 + 3 + col * 4.8 + (2.4 if row % 2 else 0); z = CZ0 + 17 + row * 3.2
        if x > CX1 - 2: continue
        cobj(f'cask{ci}', 'wine-cask', x, z, key='U2-cellar', rotY=(ci * 37) % 360); ci += 1
for i, x in enumerate((CX0 + 7.5, CX0 + 22.5)):
    for j, z in enumerate((CZ0 + 7.5, CZ0 + 22.5)):
        cobj(f'post{i}{j}', 'post', x, z, key='U2-cellar', dims=OrderedDict(h=10))
cobj('casks-note', 'note', CX0 + 15, CZ0 + 22, vis='dm-note', key='U2-cellar', label='24 rotted casks, Champagne du le Stomp (Wizard of Wines)')
cel_walls = [OrderedDict(id=f'U-cel-w{i}', a=a, b=b, flags=['normal'], material='ashlar') for i, (a, b) in enumerate([
    ([CX0, CZ0], [CX1, CZ0]), ([CX1, CZ0], [CX1, CZ1]), ([CX1, CZ1], [CX0, CZ1]), ([CX0, CZ1], [CX0, CZ0])])]
cel_room = OrderedDict(key='U2-cellar', name='Ulrich Mansion: Cellar', page=PAGE.get('U2'), polygon=rect(CX0, CZ0, CX1, CZ1), floor='flagstone', ceilingFt=10,
                       desc=DESC['U2-cellar'][0], dm=DESC['U2-cellar'][1])

# ------------------------------------------------------------------ self-audit: nothing stands where it could not
problems = []
road_polys = [p for p in terrain if p['floor'] == 'dirt' and len(p['polygon']) <= 8]
for oid, f in FOOTS:
    for rp in road_polys:
        if any(inside(q, rp['polygon']) for q in f) or any(inside(q, f) for q in rp['polygon']): problems.append(('cottage-on-road', oid))
    if any(in_water(q) for q in f): problems.append(('cottage-in-water', oid))
    for w in walls:
        if inside(w['a'], f) or inside(w['b'], f): problems.append(('wall-in-cottage', oid, w['id']))
for i in range(len(FOOTS)):
    for j in range(i + 1, len(FOOTS)):
        if any(inside(q, FOOTS[j][1]) for q in FOOTS[i][1]): problems.append(('cottage-overlap', FOOTS[i][0], FOOTS[j][0]))
for o in objects:
    p = (o['pos'][0], o['pos'][2])
    if o['kind'] in ('dead-tree', 'bush', 'reeds', 'boulder') and (in_water(p) or near_road(p, 0)): problems.append(('dressing-misplaced', o['id']))
    if not (0 <= p[0] <= W and 0 <= p[1] <= H): problems.append(('off-map', o['id']))
for k, (x, z) in MARK.items():
    if in_water((x, z)): problems.append(('site-in-water', k))
if problems:
    for pr in problems[:20]: print('  problem:', *pr)
    sys.exit('berez: %d placement problems' % len(problems))

# ------------------------------------------------------------------ write
level = OrderedDict(id='berez', name='Berez', elevationFt=0, ceilingFt=15, ambient='fog', north='-z', terrain=terrain, rooms=rooms, walls=walls, lights=lights, objects=objects)
cellar = OrderedDict(id='cellar', name='Ulrich Mansion: Cellar', elevationFt=-12, ceilingFt=10, ambient='darkness', north='-z', rooms=[cel_room], walls=cel_walls, lights=[], objects=cel_objects)
links = [OrderedDict(id='U-cellar-stair', kind='stairs', **{'from': OrderedDict(level='berez', pos=[CX0 + 15, CZ0 - 2]), 'to': OrderedDict(level='cellar', pos=[CX0 + 15, CZ0 + 15])})]
scene = OrderedDict(schema=1, location='U', chapter='ch10', name='The Ruins of Berez', mapPage=164, bookScaleFt=5, ambient='fog', placementFt=100, kind='placement',
                    clearingFt=500, levels=[level, cellar], links=links, frame='measured-p164-300dpi')
grid = OrderedDict(schema=1, levels=OrderedDict(
    berez=OrderedDict(floorPolygons=[rect(0, 0, W, H)], type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0),
    cellar=OrderedDict(floorPolygons=[rect(CX0, CZ0, CX1, CZ1)], type='square', hexOrientation='pointy', origin=[CX0, CZ0], color='#1d1b22', opacity=0.55)))
os.makedirs(OUT, exist_ok=True)
json.dump(scene, open(os.path.join(OUT, 'scene.json'), 'w'), indent=1)
json.dump(grid, open(os.path.join(OUT, 'grid.json'), 'w'), indent=1)
print('berez:', len(rooms) + 1, 'rooms;', len(walls), 'walls;', len(objects), 'objects (', n_reed, 'reeds', n_tree, 'dead trees', n_bush, 'bushes', len(pools), 'pools );', len(FOOTS), 'cottages')
