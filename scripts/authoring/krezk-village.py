#!/usr/bin/env python3
"""The Village of Krezk (chapter 8, area S; map p.144, one square = 50 ft) -> locations/ch08/S/{scene,grid}.json

A placement map like the village of Barovia and Vallaki, traced on the 300-dpi render of the map (krezk_land.py has
the frame): the octagonal ring of twenty-foot buttressed stone walls with its gatehouse (S2) and towers, the cottages
along the dirt lanes between stands of pine (as many trees as a forest), the blessed pool and the Shrine of the White
Sun (S4) at the north end, the road junction on the Old Svalich Road (S1), and the switchback road (S5) up the cliff
to the abbey's ledge 400 ft above. Three levels stand together (stacked 'open'): the village floor; the wall-walk at
20 ft with the gatehouse's archer posts (the manifest's S2 inset, at battle scale, ladders down inside the walls); and
the ledge with the abbey's grounds (S6 north gate, S7 graveyard, S8 garden gatehouse, S9 gardens), whose rooms open
the abbey's map. The burgomaster's cottage (inset) is built as rooms under a thatch cap; the pool and shrine (S4
inset) stand at true size. The abbey on the ledge is copied from the abbey's own plan (locations/ch08/S10: run
krezk-abbey.py first, then this). Cottage positions and sizes are read off the map's roofs; only positions, sizes and
our own wording are recorded. Afterwards the abbey's land level is given the village's buildings that stand within
sight below its cliff."""
import json, math, os, random, sys
from collections import OrderedDict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from authorlib import ROOT  # noqa: F401
import krezk_land as KL

OUT = os.path.join(ROOT, 'locations', 'ch08', 'S')
_M = json.load(open(os.path.join(ROOT, 'manifests', 'locations.json')))
PAGE = {a['key']: a['page'] for l in _M['locations'] if l['id'] == 'S' for a in l['areas']}
C25 = lambda x, z: (round(x * 25, 1), round(z * 25, 1))
def kfull(px, py): return KL.K(150 + 2 * px, 150 + 2 * py)      # the half-scale overview render -> Krezk ft
def kvil(px, py): return KL.K(670 + px, 910 + py)              # the village crop -> Krezk ft
rng = random.Random(8)
objects = []
def obj(id, kind, x, z, y=0, key=None, label=None, rotY=None, dims=None, vis='player', size=None):
    o = OrderedDict(id=id, kind=kind, pos=[round(x, 2), round(y, 2), round(z, 2)], vis=vis)
    if rotY: o['rotY'] = round(rotY, 1)
    if key: o['key'] = key
    if label: o['label'] = label
    if size: o['size'] = size
    if dims: o['dims'] = OrderedDict(dims)
    objects.append(o); return o

def strip(pts, w):
    out, h = [], w / 2
    for i in range(len(pts) - 1):
        (x0, z0), (x1, z1) = pts[i], pts[i + 1]
        dx, dz = x1 - x0, z1 - z0; L = math.hypot(dx, dz) or 1; nx, nz = -dz / L * h, dx / L * h
        out.append([[round(x0 + nx, 1), round(z0 + nz, 1)], [round(x1 + nx, 1), round(z1 + nz, 1)], [round(x1 - nx, 1), round(z1 - nz, 1)], [round(x0 - nx, 1), round(z0 - nz, 1)]])
    for (x, z) in pts[1:-1]:
        out.append([[round(x + math.cos(a) * h, 1), round(z + math.sin(a) * h, 1)] for a in [k * math.pi / 4 for k in range(8)]])
    return out
def chaikin(pts, passes=2):
    for _ in range(passes):
        out = [pts[0]]
        for a, b in zip(pts[:-1], pts[1:]): out += [(a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25), (a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75)]
        out.append(pts[-1]); pts = out
    return pts

# ================================================================== the village floor
# lanes (from the map, in 25-ft cells), the gate road, the path down to the junction, the Old Svalich Road
LANES = {
    'pool lane': [(12.5, 8.6), (10.6, 9.2), (10.2, 10.5), (10.1, 12.5), (9.6, 14.5), (8.7, 15.8), (7.8, 17.5), (7.6, 19.5), (8.3, 21.2), (9.5, 23), (11, 24.6), (13, 25.6), (15, 25.7), (16.8, 25.3)],
    'middle lane': [(8.7, 15.8), (10.2, 17.2), (12, 18.8), (13.8, 20.8), (15.5, 22.4), (16.9, 23.6)],
    'gate road': [(16.75, 30.6), (17.0, 27), (17.0, 25), (17.0, 22), (17.3, 19.5), (17.6, 18.3), (17.95, 17.75)],
    'east loop': [(17.6, 18.3), (18.8, 18.6), (19.6, 19.4), (20.0, 20.5), (19.8, 22.3), (19.0, 23.3), (17.0, 23.8)],
}
lanes = {k: chaikin([C25(*p) for p in v], 2) for k, v in LANES.items()}
PATH = chaikin([kvil(*p) for p in [(492, 915), (492, 960), (470, 1000), (412, 1030), (402, 1060), (440, 1082), (520, 1102), (545, 1132), (528, 1162), (478, 1182), (400, 1200), (330, 1215), (262, 1222)]], 2)
SVALICH = chaikin([kfull(*p) for p in [(-30, 885), (40, 900), (100, 925), (200, 955), (300, 985), (390, 1005), (470, 1012), (560, 1022), (650, 1040), (750, 1058), (850, 1078), (900, 1112), (960, 1158), (1030, 1170), (1110, 1185)]], 2)
terrain = []
GX0, GX1, GZ0, GZ1 = -260.0, 1160.0, -430.0, 1260.0
terrain.append(OrderedDict(polygon=[[GX0, GZ0], [GX1, GZ0], [GX1, GZ1], [GX0, GZ1]], floor='grass'))
ROADS = [(lanes[k], 11) for k in lanes] + [(PATH, 8), (SVALICH, 16)]
for pts, w in ROADS:
    for poly in strip(pts, w): terrain.append(OrderedDict(polygon=poly, floor='dirt'))
# the blessed pool (S4): a kidney of still water at the north end
POOL = [C25(*p) for p in [(11.85, 6.55), (12.4, 5.85), (13.6, 5.7), (14.6, 6.0), (15.6, 6.3), (16.05, 6.8), (15.8, 7.45), (14.9, 7.6), (14.1, 7.2), (13.3, 7.35), (12.4, 7.55), (11.9, 7.2)]]
terrain.append(OrderedDict(polygon=[[x, z] for x, z in POOL], floor='shallow-water'))

def near_road(p, margin):
    for pts, w in ROADS:
        for a, b in zip(pts[:-1], pts[1:]):
            if KL.seg_dist(p, a, b)[0] < w / 2 + margin: return True
    return False
def road_dir(p):
    best = None
    for pts, w in ROADS:
        for a, b in zip(pts[:-1], pts[1:]):
            d, t = KL.seg_dist(p, a, b)
            if best is None or d < best[0]: best = (d, a, b, t)
    return best

# ================================================================== the wall, its towers and the gatehouse (S2)
walls = []
GATE_X0, GATE_X1 = 409.0, 427.0
segs = []
run = KL.WALL_RUNS[0]
for a, b in zip(run[:-1], run[1:]):
    if a[1] == b[1] == 755.0 and min(a[0], b[0]) < GATE_X0 < max(a[0], b[0]):   # the south wall: split round the gate
        segs += [((a[0], 755.0), (GATE_X1, 755.0)), ((GATE_X0, 755.0), (b[0], 755.0))]
    else: segs.append((a, b))
def inside_ring(p): return KL.inside(p, KL.WALL)
for i, (a, b) in enumerate(segs):
    walls.append(OrderedDict(id=f'kw-{i}', a=[round(a[0], 2), round(a[1], 2)], b=[round(b[0], 2), round(b[1], 2)], flags=['normal'], material='rubble', heightFt=20))
    dx, dz = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dz); th = math.atan2(-dz, dx)
    mx, mz = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
    flip = 0 if inside_ring((mx + math.sin(th) * 8, mz + math.cos(th) * 8)) else 1     # local +z is the village side
    obj(f'kwall-{i}', 'krezk-wall', mx, mz, rotY=math.degrees(th), dims={'len': round(L, 1), 'h': 20, 't': 6, 'walk': 1, 'flip': flip, 'ladder': 1 if L > 120 else 0}, key='S2' if a[1] == 755.0 and abs(mx - 418) < 80 else None)
walls.append(OrderedDict(id='S2-gate', a=[GATE_X0, 755.0], b=[GATE_X1, 755.0], flags=['door'], material='rubble', heightFt=20, open=True))
obj('S2-gatehouse', 'krezk-gatehouse', 418, 755, key='S2', label='The gatehouse: two towers, twelve-foot ironbound doors barred from inside (DC 15 Str to lift the bar; a siege engine to break them)', rotY=0, dims={'gap': 18, 'tw': 14, 'h': 34, 'wh': 20, 'base': 1})
obj('tower-ne', 'square-tower', *KL.TOWER_NE, dims={'w': 14, 'h': 30, 'walk': 20})
obj('tower-e', 'square-tower', *KL.TOWER_E, dims={'w': 14, 'h': 30, 'walk': 20})
for i, p in enumerate([(568.75, 707.5), (521.25, 755), (272.5, 755), (80, 562.5), (82.5, 312.5), (277.5, 113.75), (377.5, 113.75)]):
    obj(f'turret-{i}', 'square-tower', *p, dims={'w': 9, 'h': 25, 'walk': 0})

# ================================================================== the cottages (read off the map's roofs, 25-ft cells)
COTTAGES = [(8.75, 11.5, 22, 13), (10.95, 13.35, 22, 13), (8.6, 14.2, 19, 12), (7.85, 15.5, 16, 11), (6.55, 16.3, 21, 13),
            (8.0, 19.35, 19, 12), (6.55, 21.9, 21, 12), (10.3, 22.7, 21, 12), (11.9, 21.25, 21, 12), (14.1, 20.0, 22, 13), (10.7, 23.9, 12, 10),
            (8.4, 24.2, 19, 12), (9.6, 25.0, 10, 9), (10.3, 26.2, 19, 12), (12.95, 25.35, 18, 11), (14.2, 25.35, 18, 11), (14.3, 23.2, 19, 12),
            (15.95, 24.4, 21, 12), (16.6, 22.2, 19, 11), (15.9, 23.4, 12, 10), (17.45, 22.4, 14, 10), (19.0, 24.5, 19, 12), (18.5, 25.6, 21, 12),
            (18.1, 26.6, 19, 12), (18.0, 27.65, 18, 11)]
BURGO = (18.55, 28.9, 34, 20)
def rect_of(x, z, w, d, rot):
    a = math.radians(rot); c, s = math.cos(a), math.sin(a)
    return [(x + c * dx + s * dz, z - s * dx + c * dz) for dx, dz in ((-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2))]
houses = []
def place_house(id, x, z, w, d, big=False, key=None, label=None):
    # turn the cottage's long side to the nearest lane, its door toward it; step it back off the lane if it stands on it
    dd, a, b, t = road_dir((x, z))
    ang = math.degrees(math.atan2(-(b[1] - a[1]), b[0] - a[0]))
    rot = round(ang / 15) * 15
    for _ in range(40):
        poly = rect_of(x, z, w, d, rot)
        if not any(near_road(q, 2) for q in poly + [(x, z)]): break
        q = (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t); vx, vz = x - q[0], z - q[1]; L = math.hypot(vx, vz) or 1
        x += vx / L * 1.5; z += vz / L * 1.5
    # the door faces the lane: local +z toward it (the cottage puts its door on its +z or -z side by seed; the seed picks +z here)
    q = (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
    r = math.radians(rot); fz = (math.sin(r), math.cos(r))
    if (q[0] - x) * fz[0] + (q[1] - z) * fz[1] < 0: rot = (rot + 180) % 360
    seed = len(houses) * 7 + 3
    o = obj(id, 'cottage', x, z, rotY=rot, key=key, label=label, dims={'w': w, 'd': d, 'h': 8, 'seed': seed, 'big': 1 if big else 0, 'door': 1})
    houses.append((o, rect_of(x, z, w + 4, d + 4, rot)))
    return o, rot
def burgomaster_cottage(o):
    """The burgomaster's cottage (inset): built as rooms (hall, bedchamber, pens) with log walls under a thatch cap, in
    place of the plain cottage piece. Local frame: x along the cottage, +z toward the lane. Returns the keep-clear rect
    of its family graveyard."""
    cx, cz, rot = o['pos'][0], o['pos'][2], o.get('rotY', 0)
    a = math.radians(rot); c, s_ = math.cos(a), math.sin(a)
    W = lambda lx, lz: [round(cx + c * lx + s_ * lz, 2), round(cz - s_ * lx + c * lz, 2)]
    objects.remove(o)
    def room(key, name, x0, z0, x1, z1, floor='plank'):
        cottage_rooms.append(OrderedDict(key=key, name=name, page=PAGE.get('S3'), polygon=[W(x0, z0), W(x1, z0), W(x1, z1), W(x0, z1)], floor=floor, ceilingFt=9))
    room('S3-hall', "Burgomaster's Cottage: Hall", -6, -10, 8, 10)
    room('S3-chamber', "Burgomaster's Cottage: Bedchamber", -17, -10, -6, 10)
    room('S3-pens', "Burgomaster's Cottage: Pens and Coops", 8, -10, 17, 10, 'dirt')
    k = [0]
    def wall(x0, z0, x1, z1, flags=('normal',)):
        k[0] += 1; w = OrderedDict(id=f'bc-w{k[0]}', a=W(x0, z0), b=W(x1, z1), flags=list(flags), material='log', heightFt=9)
        if 'door' in flags: w['open'] = False
        walls.append(w)
    for x0, x1, f in [(-17, -13, None), (-13, -10, 'window'), (-10, 0, None), (0, 4, 'door'), (4, 7, 'window'), (7, 17, None)]: wall(x0, 10, x1, 10, (f,) if f else ('normal',))
    for x0, x1, f in [(-17, -13, None), (-13, -10, 'window'), (-10, -2, None), (-2, 1, 'window'), (1, 11, None), (11, 15, 'door'), (15, 17, None)]: wall(x0, -10, x1, -10, (f,) if f else ('normal',))
    wall(-17, -10, -17, 10); wall(17, -10, 17, -3); wall(17, -3, 17, 0, ('window',)); wall(17, 0, 17, 10)
    wall(-6, -10, -6, -1); wall(-6, -1, -6, 2, ('door',)); wall(-6, 2, -6, 10)
    wall(8, -10, 8, -5); wall(8, -5, 8, -2, ('door',)); wall(8, -2, 8, 10)
    def P(id, kind, lx, lz, r=0, dims=None, key='S3-hall', y=0):
        return obj(f'bc-{id}', kind, *W(lx, lz), y=y, key=key, rotY=(rot + r) % 360, dims=dims)
    P('roof', 'thatch-roof', 0, 0, 0, {'w': 34, 'd': 20, 'y': 9}, key=None)
    P('chimney', 'chimney', -6, 0, 0, {'h': 25, 'y': 0}, key=None)
    P('hearth', 'fireplace', -5.4, 0.5, 90)
    P('table', 'table', 2, 1, 0, {'w': 8, 'd': 3.5}); P('bench-a', 'bench', 2, -1.2, 0, {'l': 7}); P('bench-b', 'bench', 2, 3.2, 0, {'l': 7})
    P('shelves', 'shelves', 3, -9.3, 0, {'w': 6, 'food': 1})
    P('dishes', 'tabletop', 2, 1, 0, {'set': 1, 'y': 2.5})
    P('cellar', 'trapdoor', 5.5, 6.5)
    obj('bc-cellar-note', 'niche', *W(5.5, 6.5), vis='hidden-object', key='S3-hall', label='A trapdoor to the wine cellar: empty (the wine from the Wizard of Wines is long overdue)')
    P('bed', 'bed', -13.5, -6, 0, key='S3-chamber'); P('trunk', 'trunk', -9, -8.6, 0, key='S3-chamber'); P('wardrobe', 'wardrobe', -16.2, 5, 90, key='S3-chamber')
    P('nightstand', 'nightstand', -11, -8.8, 0, key='S3-chamber')
    P('pen-fence', 'fence', 12.5, -1, 0, {'w': 9}, key='S3-pens'); P('pen-fence-b', 'fence', 10.5, -5.5, 90, {'w': 9}, key='S3-pens')
    P('trough', 'trough', 14.5, -8.5, 0, key='S3-pens'); P('hay', 'hay', 15.5, -4, 0, key='S3-pens')
    for j, lx in enumerate((10, 12.6, 15.2)): P(f'coop{j}', 'crate-chest', lx, 8.7, 180, key='S3-pens')
    obj('bc-pens-note', 'note', *W(12.5, 3), vis='dm-note', key='S3-pens', label='Pigpens and chicken coops kept indoors against the cold.')
    obj('S3-dmitri', 'krezk-noble', *W(0.5, 4.5), key='S3-hall', label='Burgomaster Dmitri Krezkov (noble): grieving his son Ilya; hospitality only for those who help Krezk (the overdue wine)', vis='hidden-creature', dims={'f': 0}, rotY=rot + 180)
    obj('S3-anna', 'krezk-noble', *W(3.5, 4.5), key='S3-hall', label='Anna Krezkova (noble), fearless', vis='hidden-creature', dims={'f': 1}, rotY=rot + 180)
    hx, hz = W(-4.6, 0.5)
    lights.append(OrderedDict(id='bc-hearth-fire', pos=[hx, 3, hz], preset='torch', bright=20, dim=40))
    for j in range(8):
        lx, lz = -9 + (j % 4) * 6, -20 - (j // 4) * 7
        P(f'grave{j}', 'gravestone', lx, lz, 180 + (j * 7) % 9 - 4, key=None)
    obj('bc-ilya', 'note', *W(9, -27), vis='dm-note', label="The Krezkov graveyard: four children; several caskets emptied by the Abbot's gravediggers. Ilya's plot (the last) is fresh, buried four days ago, undisturbed.")
    for j, (lx, lz, r, w) in enumerate([(0, -14.5, 0, 26), (0, -31, 0, 26), (-13, -22.75, 90, 16), (13, -22.75, 90, 16)]): P(f'gy-fence{j}', 'fence', lx, lz, r, {'w': w}, key=None)
    return [tuple(W(x, z)) for x, z in ((-14, -33), (14, -33), (14, -12), (-14, -12))]
cottage_rooms = []
lights = []

for i, (cx, cz, w, d) in enumerate(COTTAGES):
    x, z = C25(cx, cz)
    place_house(f'cottage-{i}', x, z, w, d)
bx, bz = C25(BURGO[0], BURGO[1])
burgo, brot = place_house('burgomaster', bx, bz, BURGO[2], BURGO[3], big=True, label="The burgomaster's cottage: Dmitri and Anna Krezkov. A wine cellar (empty), pigpens and coops; the family graveyard behind it.")
# every cottage keeps its own family graves behind it (the side away from the lane), and a stack of firewood
for i, (o, _) in enumerate(houses):
    x, z = o['pos'][0], o['pos'][2]; r = math.radians(o.get('rotY', 0)); w, d = o['dims']['w'], o['dims']['d']
    back = (-math.sin(r), -math.cos(r)); side = (math.cos(r), -math.sin(r))
    n = 0 if o['id'] == 'burgomaster' else 1 + (i * 5) % 3
    for k in range(n):
        off = (k - (n - 1) / 2) * 5.5
        gx, gz = x + back[0] * (d / 2 + 9) + side[0] * off, z + back[1] * (d / 2 + 9) + side[1] * off
        if near_road((gx, gz), 3): continue
        obj(f'{o["id"]}-grave{k}', 'gravestone', gx, gz, rotY=o.get('rotY', 0) + 180 + (k * 13 % 11 - 5))
    if i % 2 == 0 or o['id'] == 'burgomaster':
        wx, wz = x + side[0] * (w / 2 + 2.5), z + side[1] * (w / 2 + 2.5)
        if not near_road((wx, wz), 1): obj(f'{o["id"]}-wood', 'woodpile', wx, wz, rotY=o.get('rotY', 0) + 90, dims={'len': 6})
o_b = next(o for o, _ in houses if o['id'] == 'burgomaster')
BURGO_EXTRA = burgomaster_cottage(o_b)

# ================================================================== the pool and the Shrine of the White Sun (S4)
GZ = (240.0, 185.0)      # the gazebo on the pool's west shore, the statue reaching east over the water
obj('S4-gazebo', 'gazebo', *GZ, key='S4', dims={'r': 6.5})
obj('S4-statue', 'morninglord-statue', GZ[0], GZ[1], y=1.2, key='S4', rotY=0)
obj('S4-treasure', 'niche', GZ[0], GZ[1] + 2, vis='hidden-object', key='S4', label='A card-reading treasure lies under the gazebo: it must be torn down, and the villagers take it ill (disadvantage on Charisma checks with them until it is repaired)')
for i, (x, z) in enumerate([(292, 150), (318, 139), (392, 151), (404, 182), (300, 192), (262, 176)]): obj(f'S4-rock{i}', 'boulder', x, z, dims={'r': 1.6 + (i % 3) * 0.5})

# ================================================================== people
for i, (cx, cz) in enumerate([(12.6, 19.6), (9.3, 21.2), (15.4, 21.3), (11.6, 9.9), (13.2, 24.4), (7.4, 23.0)]):
    x, z = C25(cx, cz); obj(f'villager{i}', 'commoner', x, z, label='Krezkite villagers (commoners) at their chores' if i == 0 else None, vis='hidden-creature', rotY=i * 60)

# ================================================================== the junction (S1)
S1P = kfull(390, 990)
obj('S1-sign', 'signpost', S1P[0] + 14, S1P[1] - 10, key='S1', rotY=20)
for i, (dx, dz) in enumerate([(-30, -25), (40, -30), (-60, -50), (70, -60), (20, -70)]): obj(f'S1-rock{i}', 'boulder', S1P[0] + dx, S1P[1] + dz, dims={'r': 2 + (i % 3)})

# ================================================================== the cliff, the mountain and the switchback road (S5)
def hf_fn(x, z): return KL.LEDGE - 1.0 if KL.inside((x, z), KL.RIM) else KL.height((x, z))
def hf_hole(x, z):
    if KL.inside((x, z), KL.RIM) and KL.poly_dist((x, z), KL.RIM) > 12: return True
    return KL.height((x, z)) <= 0.6
FINE = (340.0, 130.0, 430.0, 440.0)     # the switchbacks, the abbey's rock and its cliffs: a 5-ft lattice laid into the 10-ft one
def coarse_hole(x, z):
    if FINE[0] < x < FINE[0] + FINE[2] and FINE[1] < z < FINE[1] + FINE[3]: return True     # the fine patch's own ground
    return hf_hole(x, z)
CX0, CZ0, CNX, CNZ, CC = 330.0, -430.0, 83, 108, 10.0
def taper(x, z, h):
    # the mountain slopes away toward the map's edge (the land beyond is the region's own) instead of ending in a wall
    e = min(x - CX0, CX0 + CNX * CC - x, z - CZ0, CZ0 + CNZ * CC - z)
    return h * (0.15 + 0.85 * KL.smooth(0, 320, e)) * KL.smooth(0, 40, e) if e < 320 else h
hfc = KL.heightfield_dims(CX0, CZ0, CNX, CNZ, CC, hf_fn, hole=coarse_hole, taper=taper); hfc['frost'] = 430
obj('land-mountain', 'heightfield', CX0, CZ0, dims=hfc)
hff = KL.heightfield_dims(FINE[0], FINE[1], int(FINE[2] / 5), int(FINE[3] / 5), 5.0, hf_fn, hole=hf_hole); hff['frost'] = 430; hff['drop'] = 14
obj('land-cliff', 'heightfield', FINE[0], FINE[1], dims=hff)
obj('S5-road', 'road-ribbon', 0, 0, key='S5', dims=KL.ribbon_dims([p for p in KL.ROAD if p[2] < KL.LEDGE - 0.5], KL.ROAD_W))
for i, (x, z, r) in enumerate([(640, 540, 90), (790, 600, 110)]):
    obj(f'low-mist{i}', 'mist-bank', x, z, y=18, dims={'r': r, 'h': 7, 'n': 8, 'o': 0.07})

# ================================================================== trees: the pines of the village, the forest outside, the mountainside
house_rects = [r for _, r in houses] + [BURGO_EXTRA]
def in_house(p): return any(KL.inside(p, r) for r in house_rects)
def wall_dist(p): return min(KL.seg_dist(p, a, b)[0] for a, b in segs)
trees = []
_cells = {}
def tree_ok(p, spacing):
    i, j = int(p[0] // 30), int(p[1] // 30)
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            for q in _cells.get((i + di, j + dj), ()):
                if math.hypot(p[0] - q[0], p[1] - q[1]) < spacing: return False
    _cells.setdefault((i, j), []).append(p)
    return True
# inside the walls: a forest of pines between the lanes and the cottages
for _ in range(14000):
    p = (rng.uniform(80, 570), rng.uniform(110, 760))
    if not KL.inside(p, KL.VF) or near_road(p, 5) or in_house(p) or KL.inside(p, POOL) or wall_dist(p) < 12: continue
    if any(math.hypot(p[0] - o['pos'][0], p[1] - o['pos'][2]) < max(o['dims']['w'], o['dims']['d']) * 0.75 + 5 for o, _ in houses): continue
    if math.hypot(p[0] - GZ[0], p[1] - GZ[1]) < 18 or KL.poly_dist(p, POOL) < 14: continue
    if not tree_ok(p, 17): continue
    trees.append(p); obj(f'pine-v{len(trees)}', 'pine', *p, dims={'scale': round(0.75 + rng.random() * 0.5, 2)})
nv = len(trees)
# outside: grass cleared round the walls, a thick forest beyond; the road rides through it
for _ in range(30000):
    p = (rng.uniform(GX0 + 10, GX1 - 10), rng.uniform(GZ0 + 10, GZ1 - 10))
    if KL.inside(p, KL.WALL) or near_road(p, 18): continue
    if KL.height(p) > 0.5: continue                          # the mountain has its own trees
    clear = 150 + 110 * KL.smooth(650, 900, p[1]) - 60 * KL.smooth(500, 700, p[0])
    if wall_dist(p) < clear and not (p[1] > 1060): continue
    if not tree_ok(p, 20 if wall_dist(p) < 400 else 26): continue
    trees.append(p); obj(f'pine-f{len(trees)}', 'pine', *p, dims={'scale': round(0.9 + rng.random() * 0.6, 2)})
nf = len(trees) - nv
# the mountainside: pines wherever the slope will hold them, standing on the ground (y = its height)
mtrees = []
for _ in range(26000):
    p = (rng.uniform(CX0, CX0 + CNX * CC), rng.uniform(CZ0, CZ0 + CNZ * CC))
    if KL.inside(p, KL.RIM) or KL.inside(p, KL.VF): continue
    h, s = KL.slope_at(p)
    if h < 2 or s > 1.3: continue
    if any(KL.seg_dist(p, (a[0], a[1]), (b[0], b[1]))[0] < 9 for a, b in zip(KL.ROAD[:-1], KL.ROAD[1:])): continue
    if not tree_ok(p, 16): continue
    h = taper(p[0], p[1], h)
    if h < 2: continue
    mtrees.append(p); obj(f'pine-m{len(mtrees)}', 'pine', p[0], p[1], y=round(h - 0.8, 1), dims={'scale': round(0.8 + rng.random() * 0.5, 2)})
# rocks at the cliff's foot and along the escarpment outside the walls
for i in range(40):
    a = rng.random() * math.pi * 2; p = (330 + math.cos(a) * rng.uniform(300, 380), 450 + math.sin(a) * rng.uniform(330, 400))
    if KL.inside(p, KL.WALL) or near_road(p, 6) or KL.height(p) > 0.5: continue
    obj(f'scarp-rock{i}', 'boulder', *p, dims={'r': round(1.5 + rng.random() * 2.5, 1)})

# ================================================================== rooms of the village floor
def box(cx, cz, w, d): return [[round(cx - w / 2, 1), round(cz - d / 2, 1)], [round(cx + w / 2, 1), round(cz - d / 2, 1)], [round(cx + w / 2, 1), round(cz + d / 2, 1)], [round(cx - w / 2, 1), round(cz + d / 2, 1)]]
S3P = C25(15.95, 25.6)
rooms = [
    OrderedDict(key='S1', name='Road Junction', page=PAGE.get('S1'), polygon=box(S1P[0], S1P[1], 50, 50), floor='dirt'),
    OrderedDict(key='S2', name='Gatehouse', page=PAGE.get('S2'), polygon=box(418, 755, 50, 30), floor='cobble'),
    OrderedDict(key='S3', name='Village of Krezk', page=PAGE.get('S3'), polygon=box(S3P[0], S3P[1] - 6, 50, 50), floor='dirt'),
    OrderedDict(key='S4', name='Pool and Shrine', page=PAGE.get('S4'), polygon=[[222, 128], [405, 128], [405, 205], [222, 205]], floor='grass'),
    OrderedDict(key='S5', name='Winding Road', page=PAGE.get('S5'), polygon=[[x, z] for x, z in KL.S5_POLY], floor='dirt', enter='ch08/S10'),
] + cottage_rooms

# ================================================================== the ledge (400 ft): the abbey and its grounds, from the abbey's own plan
AB = json.load(open(os.path.join(ROOT, 'locations', 'ch08', 'S10', 'scene.json')))
LV = {lv['id']: lv for lv in AB['levels']}
def ak(p): return [round(p[0] + KL.OFF[0], 2), round(p[1] + KL.OFF[1], 2)]
ledge_walls, ledge_objs = [], []
HALL = [(80, 60), (130, 60), (130, 110), (80, 110)]
EWING = [(180, 160), (280, 160), (280, 210), (180, 210)]
def on_box(p, b):
    (x0, z0), (x1, z1) = b[0], b[2]
    return (abs(p[0] - x0) < 0.01 or abs(p[0] - x1) < 0.01) and z0 - 0.01 <= p[1] <= z1 + 0.01 or (abs(p[1] - z0) < 0.01 or abs(p[1] - z1) < 0.01) and x0 - 0.01 <= p[0] <= x1 + 0.01
for w in LV['ground']['walls']:
    q = OrderedDict(w); q['id'] = 'ab-' + w['id']; q['a'] = ak(w['a']); q['b'] = ak(w['b'])
    h = w.get('heightFt', 15)
    def ew(p): return (p[1] in (160, 210) and 180 <= p[0] <= 280) or (p[0] in (180, 280) and 160 <= p[1] <= 210)
    if on_box(w['a'], HALL) and on_box(w['b'], HALL): h = 32           # the north wing: hall and loft
    elif ew(w['a']) and ew(w['b']) and (w['a'][0] == w['b'][0] or w['a'][1] == w['b'][1]): h = 23    # the east wing's two storeys
    elif h == 15 and 'door' not in w['flags'] and 'window' not in w['flags'] and w.get('material') == 'ashlar': h = 19     # the curtain walls with their parapets
    q['heightFt'] = h
    if 'door' in q['flags']: q['flags'] = ['normal']; q.pop('open', None); q['material'] = 'paneling'
    ledge_walls.append(q)
KEEP = {'gravestone', 'pine', 'garden-plot', 'scarecrow-stand', 'roof-gable', 'iron-gates', 'buttress', 'well', 'tether-post', 'chimney', 'fur-pile', 'old-trough', 'merlons', 'belfry', 'rabbit', 'mist-bank'}
for lid, dy in (('ground', 0), ('upper', 15), ('loft', 20)):
    for o in LV[lid]['objects']:
        if o['kind'] not in KEEP: continue
        if o['kind'] == 'mist-bank' and lid == 'ground': continue
        q = OrderedDict(o); q['id'] = 'ab-' + o['id']; x, z = ak([o['pos'][0], o['pos'][2]]); q['pos'] = [x, o['pos'][1] + dy, z]
        q.pop('key', None); q.pop('label', None)
        if q['vis'] != 'player': continue
        ledge_objs.append(q)
for o in LV['ground']['objects']:
    if o['kind'] == 'prism' and (o['id'].startswith('ground-ledge') or o['id'].startswith('ground-road')):
        q = OrderedDict(o); q['id'] = 'ab-' + o['id']; q['polygon'] = [ak(p) for p in o['polygon']]; x, z = ak([o['pos'][0], o['pos'][2]]); q['pos'] = [x, 0, z]
        ledge_objs.append(q)
# the courtyard and the buildings' floors, as one slab each (the rooms of the abbey's own map)
for r in LV['ground']['rooms']:
    if r['key'] in ('S12', 'S13', 'S14', 'S15') or r['key'].startswith('S15'):
        pts = [ak(p) for p in r['polygon']]; xs = [p[0] for p in pts]; zs = [p[1] for p in pts]
        ledge_objs.append(OrderedDict(id=f"ab-floor-{r['key']}", kind='prism', pos=[round((min(xs) + max(xs)) / 2, 2), 0, round((min(zs) + max(zs)) / 2, 2)], vis='player', dims=OrderedDict(h=0.1, y=0.02, color=0x66584a if r['key'] == 'S12' else 0x737980), polygon=pts))
cells = lambda pts: [ak((x * 5, z * 5)) for x, z in pts]
S6P = cells([(24, -2.5), (30, -2.5), (30, 2), (24, 2)])
S7P = cells([(11, 1), (24, 1), (24, 11), (16, 11), (16, 31), (13, 31), (10.5, 29), (10.2, 6)])
S8P = cells([(53.5, 25.5), (56.5, 25.5), (56.5, 28.5), (53.5, 28.5)])
S9P = cells([(56, 26), (58, 24), (74, 24), (76, 26), (76, 35), (74.5, 38), (70, 39.5), (64, 41), (58, 42), (56, 42)])
ledge_rooms = [OrderedDict(key='S6', name='North Gate', page=PAGE.get('S6'), polygon=S6P, floor='dirt', enter='ch08/S10'),
               OrderedDict(key='S7', name='Graveyard', page=PAGE.get('S7'), polygon=S7P, floor='grass', enter='ch08/S10'),
               OrderedDict(key='S8', name='Garden Gatehouse', page=PAGE.get('S8'), polygon=S8P, floor='dirt', enter='ch08/S10'),
               OrderedDict(key='S9', name='Gardens', page=PAGE.get('S9'), polygon=S9P, floor='grass', enter='ch08/S10')]
# the people of the grounds (the gate guards asleep), as on the abbey's map
for o in LV['ground']['objects']:
    if o['id'] in ('ground-S6-otto', 'ground-S6-zygfrek'):
        q = OrderedDict(o); q['id'] = 'ab-' + o['id']; x, z = ak([o['pos'][0], o['pos'][2]]); q['pos'] = [x, 0, z]; q['key'] = 'S6'; ledge_objs.append(q)
ledge_objs.append(OrderedDict(id='ab-abbey-note', kind='note', pos=[ak((130, 130))[0], 1, ak((130, 130))[1]], vis='dm-note', label='The Abbey of Saint Markovia (S10-S24): open the abbey\'s own map from S6-S9.'))

# ================================================================== the gatehouse and walls (inset): the wall-walk at 20 ft
wl_rooms, wl_walls, wl_objs, wl_links = [], [], [], []
def wobj(id, kind, x, z, y=0, key='S2', label=None, rotY=None, dims=None, vis='player', size=None):
    o = OrderedDict(id=id, kind=kind, pos=[round(x, 2), round(y, 2), round(z, 2)], vis=vis)
    if rotY: o['rotY'] = round(rotY, 1)
    if key: o['key'] = key
    if label: o['label'] = label
    if size: o['size'] = size
    if dims: o['dims'] = OrderedDict(dims)
    wl_objs.append(o); return o
TW = {'w': (395.0, 409.0), 'e': (427.0, 441.0)}
def wwall(id, a_, b_, flags=('normal',)):
    wl_walls.append(OrderedDict(id=id, a=[a_[0], a_[1]], b=[b_[0], b_[1]], flags=list(flags), material='rubble', heightFt=10))
for side, (x0, x1) in TW.items():
    wl_rooms.append(OrderedDict(key=f"S2-{'west' if side == 'w' else 'east'}", name=f"Archer's Post ({'west' if side == 'w' else 'east'} tower)", page=PAGE.get('S2'), polygon=[[x0, 748.0], [x1, 748.0], [x1, 762.0], [x0, 762.0]], floor='flagstone', ceilingFt=10))
    door_x, back_x = (x0, x1) if side == 'w' else (x1, x0)      # the open doorway to the walk on each tower's outer side
    xm = (x0 + x1) / 2
    wwall(f'S2{side}-n', (x0, 748.0), (x1, 748.0))
    wwall(f'S2{side}-back', (back_x, 748.0), (back_x, 762.0))
    wwall(f'S2{side}-door-a', (door_x, 748.0), (door_x, 752.0)); wwall(f'S2{side}-door-b', (door_x, 757.0), (door_x, 762.0))
    wwall(f'S2{side}-s-a', (x0, 762.0), (xm - 0.5, 762.0)); wwall(f'S2{side}-slit', (xm - 0.5, 762.0), (xm + 0.5, 762.0), ('window',)); wwall(f'S2{side}-s-b', (xm + 0.5, 762.0), (x1, 762.0))
    wobj(f'S2{side}-cap', 'tower-cap', xm, 755, key=None, dims={'w': 14, 'y': 10})
    wobj(f'S2{side}-archer', 'krezk-guard', xm, 759.5, key=f"S2-{'west' if side == 'w' else 'east'}", label=f"Archer (scout) at the arrow slit of the {'west' if side == 'w' else 'east'} tower (6 in wide, 4 ft tall)", vis='hidden-creature', dims={'bow': 1})
    wobj(f'S2{side}-brazier', 'brazier', xm + (4 if side == 'w' else -4), 751.5, key=None)
wl_lights = [OrderedDict(id=f'S2{s_}-fire', pos=[(TW[s_][0] + TW[s_][1]) / 2 + (4 if s_ == 'w' else -4), 3.2, 751.5], preset='torch', bright=20, dim=40) for s_ in TW]
# the walk on every run of wall: a five-foot strip inside the parapet; it stops short of the turrets at the corners and
# runs up to the gate towers' doorways
WALK_NAMES = {}
centre = (sum(p[0] for p in KL.WALL) / len(KL.WALL), sum(p[1] for p in KL.WALL) / len(KL.WALL))
letters = 'abcdefghijkl'
for i, (a_, b_) in enumerate(segs):
    dx, dz = b_[0] - a_[0], b_[1] - a_[1]; L = math.hypot(dx, dz); ux, uz = dx / L, dz / L
    nx, nz = -uz, ux
    if not inside_ring((a_[0] + dx / 2 + nx * 8, a_[1] + dz / 2 + nz * 8)): nx, nz = -nx, -nz      # n points into the village
    south = a_[1] == b_[1] == 755.0
    at_gate = lambda p_: south and min(abs(p_[0] - x) for x in (409.0, 427.0)) < 0.5
    t0 = 14.0 if at_gate(a_) else 4.5          # a gate run ends at the tower's outer face (its doorway), not the gate's edge
    t1 = L - 14.0 if at_gate(b_) else L - 4.5
    P0 = (a_[0] + ux * t0, a_[1] + uz * t0); P1 = (a_[0] + ux * t1, a_[1] + uz * t1)
    poly = [[round(P0[0] - nx * 2, 2), round(P0[1] - nz * 2, 2)], [round(P1[0] - nx * 2, 2), round(P1[1] - nz * 2, 2)], [round(P1[0] + nx * 3, 2), round(P1[1] + nz * 3, 2)], [round(P0[0] + nx * 3, 2), round(P0[1] + nz * 3, 2)]]
    mx, mz = (a_[0] + b_[0]) / 2, (a_[1] + b_[1]) / 2
    ang = math.degrees(math.atan2(mz - centre[1], mx - centre[0]))
    dirn = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'][int(((ang + 22.5) % 360) // 45)]
    if south: dirn = 'south, ' + ('west of the gate' if mx < 418 else 'east of the gate')
    key = f'S2-{letters[i]}'
    wl_rooms.append(OrderedDict(key=key, name=f'Wall-walk ({dirn})', page=PAGE.get('S2'), polygon=poly, floor='flagstone', ceilingFt=10))
    WALK_NAMES[key] = dirn
    # a ladder down inside the wall: by the gate on the gate runs, mid-run elsewhere
    lt = (t1 - 6) if (south and mx < 418) else (t0 + 6) if south else (t0 + t1) / 2
    lp = (a_[0] + ux * lt, a_[1] + uz * lt)
    wl_links.append(OrderedDict(id=f'lk-ladder-{letters[i]}', kind='ladder', **{'from': OrderedDict(level='village', pos=[round(lp[0] + nx * 6, 2), round(lp[1] + nz * 6, 2)]), 'to': OrderedDict(level='walls', pos=[round(lp[0] + nx * 0.5, 2), round(lp[1] + nz * 0.5, 2)])}))
    # one guard to every 300-ft stretch (the four by the gate are their own)
    if not south:
        n_g = max(1, round(L / 300))
        for j in range(n_g):
            gp = (a_[0] + ux * (L * (j + 0.5) / n_g), a_[1] + uz * (L * (j + 0.5) / n_g))
            wobj(f'{key}-guard{j}', 'krezk-guard', gp[0] + nx * 0.5, gp[1] + nz * 0.5, key=key, label='A lone guard crouched behind the parapet, ready to sound the alarm', vis='hidden-creature', rotY=math.degrees(math.atan2(-nx, -nz)))
    else:
        for j, x in enumerate((376.0, 388.0) if mx < 418 else (448.0, 460.0)):
            wobj(f'{key}-guard{j}', 'krezk-guard', x, 754.5, key=key, label='Guard in a fur hat with a spear, watching nervously from the parapet', vis='hidden-creature')
walls_level = OrderedDict(id='walls', name='Gatehouse and walls (20 ft)', elevationFt=20, ceilingFt=10, ambient='barovian-overcast', north='-z', rooms=wl_rooms, walls=wl_walls, lights=wl_lights, objects=wl_objs)

DESC = {
  'S1': ('A fork in the Old Svalich Road: a lane climbs north over rocky ground to a walled village, and a bell tolls from an abbey high on the mountain.', 'West, the road runs a little over a mile into the mists. North, the path climbs to the gatehouse (S2).'),
  'S2': ('A gate of two slate-capped towers and an arch carved with the village\'s name; heavy banded doors, and nervous fur-hatted spearmen on the walls.', 'Two archers (scouts) in the towers, four guards on the walls; the alarm brings 4 more guards and 40 commoners with handaxes in five rounds. One guard per 300 ft of wall elsewhere. Dmitri Krezkov comes to the gate.'),
  'S3': ('Log cottages with thatch and stone chimneys strung along dirt lanes in a near-forest of pines; grey cliffs and the abbey road loom to the north-east.', 'A commune: no inns, no trade. Chores earn a bed. The burgomaster\'s cottage is the largest, nearest the gate; every cottage has its family graves, the last decade\'s caskets emptied by the Abbot\'s gravediggers.'),
  'S4': ('A bright spring-fed pool and, on its bank, a tottering gazebo sheltering a faded wooden figure with open arms.', 'Blessed by Saint Markovia: the first drink gives the benefit of lesser restoration. The Morninglord faces east. The Shrine of the White Sun.'),
  'S5': ('A narrow road of loose scree zigzagging up the cliff face.', 'It climbs 400 ft, doubling back twice, to the north gate (S6); slow and treacherous, colder near the top.'),
  'S6': ('Two stone guard huts and a pair of rusty iron gates in a low rubble wall; beyond, the abbey with its belfry and a smoking chimney.', 'Otto and Zygfrek Belview asleep under furs (DC 12 Stealth to climb the wall without waking them; opening the gates wakes them). Open the abbey\'s map.'),
  'S7': ('Old headstones of priests and nuns among stunted pines and thin snow; past the low wall, a sheer drop to the village.', 'The sun\'s grave (X) holds a ring of regeneration for Tasha Petrovna\'s holy symbol. Open the abbey\'s map.'),
  'S8': ('A small gatehouse at the entrance to the abbey\'s gardens.', 'Empty.'),
  'S9': ('Four walled vegetable beds on a shelf of the cliff, rabbits among the turnips and two sack-headed scarecrows on crosses; the east wing\'s broken windows stare down.', 'The door into S15 is not locked. A card-reading treasure in the southernmost scarecrow wakes seven wights.'),
}
DESC['S2-west'] = ("The archer's post atop the west tower: a stone room under the peaked roof, an arrow slit six inches wide toward the road, an open doorway onto the wall-walk.", 'One archer (scout). The slit gives the archer cover; the doorway leads to the parapet.')
DESC['S2-east'] = ("The archer's post atop the east tower, the same as its twin: an arrow slit toward the road, an open doorway onto the wall-walk.", 'One archer (scout).')
for k_, dirn in WALK_NAMES.items():
    DESC[k_] = (f'The wall-walk ({dirn}): five feet of stone behind a battlemented parapet, twenty feet above the ground, a wooden ladder down inside.', 'A lone guard watches each 300 ft of wall and sounds the alarm at any sign of danger; five rounds later every able-bodied adult is at the gate.' if 'gate' not in dirn else 'Two of the four guards by the gate stand here; the alarm brings 4 more guards and 40 commoners with handaxes in five rounds.')
DESC['S3-hall'] = ("The burgomaster's hall: a stone hearth against the bedchamber wall, a long table between benches, shelves of stores, a trapdoor in the floor.", 'Dmitri and Anna Krezkov. The trapdoor opens on the wine cellar, empty. Chores earn a bed here.')
DESC['S3-chamber'] = ('A plain bedchamber behind the hearth wall: a bed, a trunk, a wardrobe.', "The Krezkovs sleep here; Ilya's things are still in the trunk.")
DESC['S3-pens'] = ('Pens of pigs and stacked coops of chickens in straw, kept indoors against the cold; a wide back door.', 'Lots of room for animals; the back door opens on the family graveyard.')
for r in rooms + ledge_rooms + wl_rooms:
    d = DESC[r['key']]; r['desc'] = d[0]; r['dm'] = d[1]

village = OrderedDict(id='village', name='Village of Krezk', elevationFt=0, ceilingFt=30, ambient='barovian-overcast', north='-z', terrain=terrain, rooms=rooms, walls=walls, lights=lights, objects=objects)
ledge = OrderedDict(id='ledge', name='Abbey ledge (400 ft up)', elevationFt=KL.LEDGE, ceilingFt=40, ambient='barovian-overcast', north='-z', rooms=ledge_rooms, walls=ledge_walls, lights=[], objects=ledge_objs)
scene = OrderedDict(schema=1, location='S', chapter='ch08', name='The Village of Krezk', mapPage=144, bookScaleFt=5, ambient='barovian-overcast', placementFt=50, kind='placement', stacked='open', entry='village', clearingFt=600,
                    levels=[village, walls_level, ledge], links=[OrderedDict(id='lk-switchback', kind='stairs', **{'from': OrderedDict(level='village', pos=[452, 447]), 'to': OrderedDict(level='ledge', pos=[533.5, 262])})] + wl_links, frame='measured-p144-300dpi')
grid = OrderedDict(schema=1, levels=OrderedDict(village=OrderedDict(floorPolygons=[terrain[0]['polygon']], type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0),
                                                walls=OrderedDict(floorPolygons=[r['polygon'] for r in wl_rooms if min(p[1] for p in r['polygon']) > 740], type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0.55),
                                                ledge=OrderedDict(floorPolygons=[r['polygon'] for r in ledge_rooms], type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0)))
os.makedirs(OUT, exist_ok=True)
json.dump(scene, open(os.path.join(OUT, 'scene.json'), 'w'), indent=1)
json.dump(grid, open(os.path.join(OUT, 'grid.json'), 'w'), indent=1)
print('krezk:', len(houses), 'cottages,', nv, 'village pines,', nf, 'forest pines,', len(mtrees), 'mountain pines,', len(walls), 'wall pieces,', len(rooms) + len(ledge_rooms), 'keyed areas')

# ================================================================== the village below the abbey's cliff, on the abbey's land level
# (the parent map's surroundings bring Krezk's pines and graves; its cottages, walls and towers are this kit's own pieces,
# so the ones within sight of the ledge are copied onto the abbey's land level)
ab_path = os.path.join(ROOT, 'locations', 'ch08', 'S10', 'scene.json')
AB = json.load(open(ab_path), object_pairs_hook=OrderedDict)
val = next(lv for lv in AB['levels'] if lv['id'] == 'valley')
val['objects'] = [o for o in val['objects'] if not o['id'].startswith('kz-')]
S5C = KL.S5_CENTRE
for o in objects:
    if o['kind'] not in ('cottage', 'woodpile', 'krezk-wall', 'square-tower', 'krezk-gatehouse', 'gazebo', 'morninglord-statue'): continue
    if math.hypot(o['pos'][0] - S5C[0], o['pos'][2] - S5C[1]) > 520: continue
    q = OrderedDict(o); q['id'] = 'kz-' + o['id']; q['pos'] = [round(o['pos'][0] - KL.OFF[0], 2), o['pos'][1], round(o['pos'][2] - KL.OFF[1], 2)]
    q.pop('key', None); q.pop('label', None); val['objects'].append(q)
# the burgomaster's cottage is built as rooms on the village map; on the abbey's land level it stands as one piece
bq = OrderedDict(id='kz-burgomaster', kind='cottage', pos=[round(o_b['pos'][0] - KL.OFF[0], 2), 0, round(o_b['pos'][2] - KL.OFF[1], 2)], vis='player', rotY=o_b.get('rotY', 0), dims=OrderedDict(o_b['dims']))
val['objects'].append(bq)
json.dump(AB, open(ab_path, 'w'), indent=1)
print('abbey land level: +', sum(1 for o in val['objects'] if o['id'].startswith('kz-')), 'village pieces')
