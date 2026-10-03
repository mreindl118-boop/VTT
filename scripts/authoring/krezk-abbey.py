#!/usr/bin/env python3
"""The Abbey of Saint Markovia (chapter 8, area S10; maps p.149 and p.153, one square = 10 ft), above Krezk.

Traced off the two plans (the ground floor is printed with north to the left; it is turned north-up here, the frame
the upper floor and cellar already use) on a 5-ft lattice: the north wing (main hall S13, 50 ft square, its loft S17
above and wine cellar S16 below), the courtyard S12 inside fifteen-foot curtain walls with its well, troughs, nine
chicken sheds and tethering posts, the entrance S10 between the two inner gatehouses S11, the east wing (foyer S14 and
the madhouse S15 with its eight cells below; barracks, office, hospital, operating room, nursery and morgue S19-S24
above) and the wall-walks S18. Heights from the text: the loft is twenty feet up the wooden stairs, the cellar twenty
feet down the stone ones, the walls fifteen feet; the ledge stands 400 ft above the village.

The ledge's grounds (the north gate S6, graveyard S7, garden gatehouse S8 and gardens S9: keyed on the Krezk map) are
drawn as unkeyed ground with their gates, walls, graves and plots; the cliffs and the mountain round the ledge and the
switchback road come from the topography the Krezk map shares (krezk_land.py). Levels use absolute heights above the
village floor: the land (and the foot of the cliff) at 0, the abbey from 380 to 432 ft.
-> locations/ch08/S10/{scene,grid}.json (a blowout of the Krezk map: `parent` ch08/S)."""
import json, math, os, sys
from collections import OrderedDict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from authorlib import ROOT, Level, rect, seg_key, unit_edges, cobwebs  # noqa: F401
import krezk_land as KL

_M = json.load(open(os.path.join(ROOT, 'manifests', 'locations.json')))
PAGE = {a['key']: a['page'] for l in _M['locations'] if l['id'] == 'S10' for a in l['areas']}
def pg(k): return PAGE.get(k.split('-')[0]) if k.split('-')[0] in PAGE else PAGE.get(k)

LEDGE = 400
G_EL, U_EL, L_EL, C_EL = LEDGE, LEDGE + 15, LEDGE + 20, LEDGE - 20

# ------------------------------------------------------------------ helpers for diagonal walls (authorlib stamps whole cells)
def ov(lv, a, b, **kw):
    k = seg_key(a, b); lv.overrides[k] = dict(lv.overrides.get(k, {}), **kw)

def is_axis(a, b): return a[0] == b[0] or a[1] == b[1]

def open_edges(lv, poly, skip=()):
    """No walls on these edges (an open area inside a bigger one, a walk's open side)."""
    n = len(poly)
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        if (a, b) in skip or (b, a) in skip: continue
        if is_axis(a, b): lv._stamp(a, b, open_wall=True)
        else: ov(lv, a, b, open_wall=True)

def low_edge(lv, a, b, h=4, material='ashlar'):
    """A parapet: a low wall on this edge."""
    if is_axis(a, b): lv._stamp(a, b, flags=['normal'], heightFt=h, material=material, wall=True)
    else: ov(lv, a, b, flags=['normal'], heightFt=h, material=material, wall=True)

def ddoor(lv, a, b, id, locked=False, double=False):
    """A door on a diagonal edge (the edge must be one whole polygon edge)."""
    ov(lv, a, b, flags=['door'] + (['locked'] if locked else []), id=f'{lv.id}-{id}', open=False, wall=True)

def angle(a, b): return round(math.degrees(math.atan2(-(b[1] - a[1]), b[0] - a[0])), 2)

def strip(pts, w):
    """A ribbon of quads along a polyline (cells), each a terrain polygon of <= 8 points; w in cells."""
    out, h = [], w / 2
    for i in range(len(pts) - 1):
        (x0, z0), (x1, z1) = pts[i], pts[i + 1]
        dx, dz = x1 - x0, z1 - z0; L = math.hypot(dx, dz) or 1; nx, nz = -dz / L * h, dx / L * h
        out.append([(x0 + nx, z0 + nz), (x1 + nx, z1 + nz), (x1 - nx, z1 - nz), (x0 - nx, z0 - nz)])
    for (x, z) in pts[1:-1]:
        out.append([(x + math.cos(a) * h, z + math.sin(a) * h) for a in [k * math.pi / 4 for k in range(8)]])
    return out

# ================================================================== ground floor (400 ft)
g = Level('ground', 'Ground floor', G_EL, 15, ambient='interior-dim', interior='ashlar', exterior='ashlar', north='-z')
HALL = [(16, 12), (26, 12), (26, 22), (22, 22), (22, 24), (20, 24), (20, 22), (16, 22)]
g.room('S13', 'Main Hall', HALL, 'flagstone', page=pg('S13'), ceilingFt=20)
# the courtyard, round the inner gatehouses, the foyer's porch and the sheds tucked under the walls
S11N = [(27.5, 23.5), (30, 26), (28.5, 27.5), (27.75, 26.75), (26.75, 25.75), (26, 25)]
S11S = [(31.5, 27.5), (34, 30), (32.5, 31.5), (31.75, 30.75), (30.75, 29.75), (30, 29)]
COURT = [(16, 22), (17, 22), (17, 23), (19, 23), (19, 22), (20, 22), (20, 24), (22, 24), (22, 23), (24, 23), (24, 22), (26, 22),
         (27.5, 23.5), (26, 25), (26.75, 25.75), (27.75, 26.75), (28.5, 27.5), (30, 26), (31.5, 27.5), (30, 29), (30.75, 29.75), (31.75, 30.75), (32.5, 31.5), (34, 30), (36, 32),
         (36, 34), (34, 34), (34, 36), (36, 36), (36, 38), (35, 38), (35, 40), (36, 40), (36, 42),
         (34, 42), (34, 41), (28, 41), (28, 42), (26, 42), (26, 38), (20, 32), (16, 32), (16, 30), (17, 30), (17, 24), (16, 24)]
g.room('S12', 'Courtyard', COURT, 'dirt', page=pg('S12'), ceilingFt=15)
g.room('S11', 'Inner Gatehouse (north)', S11N, 'flagstone', page=pg('S11'), ceilingFt=15)
g.room('S11-s', 'Inner Gatehouse (south)', S11S, 'flagstone', page=pg('S11'), ceilingFt=15)
S10P = [(30, 26), (31.5, 24.5), (33, 26), (31.5, 27.5)]
g.room('S10', 'Abbey Entrance', S10P, 'dirt', page=pg('S10'))
open_edges(g, S10P, skip=[((30, 26), (31.5, 27.5))])
ddoor(g, (30, 26), (31.5, 27.5), 'S10-doors', double=True)
ddoor(g, (26.75, 25.75), (27.75, 26.75), 'S11-door'); ddoor(g, (30.75, 29.75), (31.75, 30.75), 'S11s-door')
# the courtyard's sub-areas: the well, the trough alcoves, the tethering posts (open ground inside it)
S12A = rect(26.3, 30, 28.3, 32); S12B = [(20.6, 31.6), (22.0, 30.6), (27.0, 35.6), (26.0, 37.0)]; S12D = rect(29, 37, 33, 39)
g.room('S12a', 'Well', S12A, 'dirt', page=pg('S12a')); open_edges(g, S12A)
g.room('S12b', 'Old Troughs', S12B, 'dirt', page=pg('S12b')); open_edges(g, S12B)
g.room('S12d', 'Tethering Posts', S12D, 'dirt', page=pg('S12d')); open_edges(g, S12D)
SHEDS = [('S12c', rect(16, 24, 17, 26), ((17, 24), (17, 25))), ('S12c-b', rect(16, 26, 17, 28), ((17, 26), (17, 27))), ('S12c-c', rect(16, 28, 17, 30), ((17, 28), (17, 29))),
         ('S12c-d', rect(17, 22, 19, 23), ((17, 23), (18, 23))), ('S12c-e', rect(22, 22, 24, 23), ((23, 23), (24, 23))),
         ('S12c-f', rect(28, 41, 30, 42), ((28, 41), (29, 41))), ('S12c-g', rect(30, 41, 32, 42), ((30, 41), (31, 41))), ('S12c-h', rect(32, 41, 34, 42), ((32, 41), (33, 41))),
         ('S12c-i', rect(35, 38, 36, 40), ((35, 38), (35, 39)))]
for k, poly, (a, b) in SHEDS:
    g.room(k, 'Chicken Shed', poly, 'dirt', page=pg('S12c'), ceilingFt=8)
    g.door(a, b, id=f'{k}-door', locked=True)
# the east wing: foyer and the madhouse
S14P = [(34, 34), (36, 34), (36, 32), (40, 32), (40, 42), (36, 42), (36, 36), (34, 36)]
g.room('S14', 'Foyer', S14P, 'plank', page=pg('S14'), ceilingFt=15)
g.room('S15', 'Madhouse', rect(40, 36, 56, 38), 'plank', page=pg('S15'), ceilingFt=15)
CELLS = {'S15a': (rect(40, 32, 44, 36), 'Fearful Mongrelfolk'), 'S15b': (rect(44, 32, 48, 36), 'Quarreling Mongrelfolk'), 'S15c': (rect(48, 32, 52, 36), 'Incanting Mongrelfolk'),
         'S15d': (rect(52, 32, 56, 36), 'Hungry Mongrelfolk'), 'S15e': (rect(40, 38, 44, 42), 'Mongrelfolk Horde'), 'S15f': (rect(44, 38, 48, 42), 'Singing and Dancing Mongrelfolk'),
         'S15g': (rect(48, 38, 52, 42), 'Mongrelfolk Babies'), 'S15h': (rect(52, 38, 56, 42), 'Mongrelfolk Fort')}
for k, (poly, name) in CELLS.items(): g.room(k, name, poly, 'plank', page=pg(k), ceilingFt=15)
g.opening((40, 36), (40, 38))                                   # the foyer's hall runs on into the madhouse
g.wall((36, 36), (38, 36)); g.wall((38, 36), (38, 40))        # the stair to the upper floor, boxed in
g.door((34, 34), (34, 35), id='S14-door')
g.door((56, 36), (56, 38), id='S15-garden-door', double=True)
for x in (41, 45, 49, 53): g.door((x, 36), (x + 1, 36), id=f'S15-cell-n{x}'); g.door((x, 38), (x + 1, 38), id=f'S15-cell-s{x}')
for x in (42, 46, 50, 54): g.window((x, 32), (x + 1, 32)); g.window((x, 42), (x + 1, 42))
g.window((56, 33), (56, 34)); g.window((56, 40), (56, 41)); g.window((37, 32), (38, 32))
# the main hall: leaded windows, the door to the courtyard
g.door((20, 24), (22, 24), id='S13-door', double=True)
for a, b in [((17, 12), (18, 12)), ((23, 12), (24, 12)), ((16, 13), (16, 14)), ((16, 15), (16, 16)), ((26, 13), (26, 14)), ((26, 15), (26, 16))]: g.window(a, b)
# the grounds: the ledge's rock top, the gate road and the road on to the gardens
# The ledge's ground is laid as raised slabs, not terrain: a level's terrain makes the app spread its battle grid well past
# the map, and on a ledge 400 ft up that grid would hang in the air over the cliffs.
GRASS, DIRT = 0x3d5241, 0x66584a
def slab(id, poly, color, h=1.0, y=-1.05, key=None):
    g.prop(id, 'prism', (0, 0), key, dims={'h': h, 'y': y, 'color': color})
    o = g.objects[-1]; xs = [p[0] for p in poly]; zs = [p[1] for p in poly]
    o['pos'] = [round((min(xs) + max(xs)) / 2 * 5, 2), 0, round((min(zs) + max(zs)) / 2 * 5, 2)]
    o['polygon'] = [[round(x * 5, 2), round(z * 5, 2)] for x, z in poly]
slab('ledge', KL.RIM_CELLS, GRASS)
GRID_EXTRA = [[(56, 26), (58, 24), (74, 24), (76, 26), (76, 35), (74.5, 38), (70, 39.5), (64, 41), (58, 42), (56, 42)]]   # the gardens
ROAD_N = [(12.5, -1.3), (19, -1.4), (26, -1.2), (27, 1), (27.6, 5), (27.6, 12), (28, 19), (29.5, 23), (31.2, 25.6)]
ROAD_E = [(32.5, 26.5), (36, 28.4), (42, 29.1), (50, 29.1), (55, 29.3), (58.5, 30.5)]
for i, poly in enumerate(strip(ROAD_N, 2.2) + strip(ROAD_E, 2.4)): slab(f'road{i}', poly, DIRT, h=0.12, y=-0.05)
# the five-foot walls of mortared stone round the grounds, the gate posts (S6), the garden gatehouse (S8)
def wall_run(lv, pts, h=5, material='rubble'):
    for a, b in zip(pts[:-1], pts[1:]): lv.wall(a, b, heightFt=h, material=material)
wall_run(g, [(24, 0), (16, 0), (13, 1.5), (11, 4), (10, 7), (10, 27), (11, 29), (13, 31), (16, 32)])
wall_run(g, [(30, 0), (33, 0), (34, 1.5), (34, 21), (35.5, 23.5), (38, 25), (54, 25), (54, 26)])
wall_run(g, [(56, 26), (58, 24), (74, 24), (76, 26), (76, 35), (74.5, 38), (70, 39.5), (64, 41), (58, 42), (56, 42)])
def hut(lv, x0, z0, x1, z1, gap_side, key, h=9):
    xm = (x0 + x1) / 2
    for a, b in [((x0, z0), (x1, z0)), ((x1, z0), (x1, z1)), ((x0, z0), (x0, z1))]: lv.wall(a, b, heightFt=h, material='rubble')
    if gap_side == 's': lv.wall((x0, z1), (xm - 0.4, z1), heightFt=h, material='rubble'); lv.wall((xm + 0.4, z1), (x1, z1), heightFt=h, material='rubble')
    lv.prop(f'{key}-roof', 'roof-gable', (xm, (z0 + z1) / 2), None, dims={'w': (x1 - x0) * 5 + 2, 'd': (z1 - z0) * 5 + 2, 'h': 5, 'y': h})
hut(g, 24, 0, 26, 2, 's', 'S6w'); hut(g, 28, 0, 30, 2, 's', 'S6e')
g.prop('S6-gates', 'iron-gates', (27, 1), None, dims={'w': 10, 'h': 7})
for a, b in [((54, 26), (56, 26)), ((54, 28), (56, 28)), ((54, 26), (54, 28)), ((56, 26), (56, 26.6)), ((56, 27.4), (56, 28))]: g.wall(a, b, heightFt=10, material='rubble')
g.prop('S8-roof', 'roof-gable', (55, 27), None, dims={'w': 12, 'd': 12, 'h': 6, 'y': 10})
for k, (x, z, t) in {'S6': (27, -2.1, 'S6 North Gate (Krezk map): two stone guard posts and squealing iron gates; Otto and Zygfrek Belview asleep under furs. A net of twigs and a shovel on each inside wall.'),
                    'S7': (12.2, 5.5, 'S7 Graveyard (Krezk map): stunted pines, the graves of priests and nuns (Brother Martek, Brother Valen, Sister Constance, Sister Lenora); beyond the low wall the ground falls away 400 ft.'),
                    'S8': (55, 27, 'S8 Garden Gatehouse (Krezk map): empty.'),
                    'S9': (66, 36.5, 'S9 Gardens (Krezk map): four plots behind a five-foot wall, white rabbits, two scarecrows on crosses. The door to S15 is not locked.')}.items():
    g.note(f'note-{k}', (x, z), None, t)

# ---------------------------------------------------------------- furnishings: the main hall
g.prop('S13-fireplace', 'fireplace', (21, 12.5), 'S13')
g.prop('S13-cauldron', 'hearth-cauldron', (21, 12.9), 'S13')
g.prop('S13-sun', 'sun-disk', (21, 12.65), 'S13', dims={'y': 7.6, 'r': 1.4})
g.prop('S13-chimney-out', 'chimney', (21, 11.5), None, dims={'h': 20, 'y': 0})
g.hidden('S13-niche', 'niche', (21, 12.7), 'S13', 'Behind the sun disk (750 gp): a niche with a potion of superior healing in a crystal and electrum flask (250 gp); a card-reading treasure would be here too')
g.prop('S13-table', 'table', (20.65, 14.85), 'S13', dims={'w': 31, 'd': 4})
for i, x in enumerate((18.0, 19.1, 20.15, 21.15, 22.2, 23.3)):
    g.prop(f'S13-chair-n{i}', 'chair', (x, 14.05), 'S13'); g.prop(f'S13-chair-s{i}', 'chair', (x, 15.65), 'S13', rotY=180)
g.prop('S13-chair-w', 'chair', (17.15, 14.85), 'S13', rotY=90); g.prop('S13-chair-e', 'chair', (24.2, 14.85), 'S13', rotY=-90)
for i, x in enumerate((18.4, 19.9, 21.4, 22.9)): g.prop(f'S13-candelabra{i}', 'candelabra', (x, 14.85), 'S13', dims={'y': 2.5})
for i, x in enumerate((17.8, 19.2, 20.7, 22.2, 23.6)): g.prop(f'S13-dishes{i}', 'tabletop', (x, 14.85), 'S13', dims={'set': 1, 'y': 2.5})
# the wooden stair up (west), the stone stair down (east), the passage between them to the door
g.prop('S13-stair-a', 'stairs-run', (20, 21), 'S13', rotY=180, dims={'len': 10, 'w': 9, 'rise': 7})
g.prop('S13-landing', 'ledge', (17, 21), 'S13', dims={'w': 10, 'd': 10, 'h': 7})
g.prop('S13-stair-b', 'stairs-run', (17, 20), 'S13', rotY=90, dims={'len': 10, 'w': 9, 'rise': 13}, y=7)
g.prop('S13-cellar-well', 'prism', (0, 0), 'S13', dims={'h': 0.05, 'y': 0.02, 'color': 0x0e0c10})
g.objects[-1]['pos'] = [120, 0, 100]; g.objects[-1]['polygon'] = [[110, 90], [130, 90], [130, 110], [110, 110]]
g.railing((22, 18), (26, 18)); g.railing((22, 18), (22, 20))
g.light('S13-hearth', (21, 13), 'torch', 20, 40, y=3)
cobwebs(g, [(26, 12), (16, 12)], 'S13', y=17, n=2)

# ---------------------------------------------------------------- the courtyard
g.prop('S12a-well', 'well', (27.3, 31), 'S12a')
g.creature('S12a-mishka', 'mongrelfolk', (27.3, 31.4), 'S12a', 'Mishka Belview (CE mongrelfolk, spider climb) clinging to the shaft 20 ft down; scuttles up at anyone who shines a light down. The well is 80 ft deep.')
g.objects[-1]['dims'] = {'v': 2}
for i, (x, z) in enumerate([(21.7, 32.4), (23.6, 34.2), (25.4, 36.0)]): g.prop(f'S12b-trough{i}', 'old-trough', (x, z), 'S12b', rotY=-45)
g.prop('S12d-post-a', 'tether-post', (30, 38), 'S12d'); g.prop('S12d-post-b', 'tether-post', (32.2, 38), 'S12d')
g.creature('S12d-marzena', 'mongrelfolk', (30.6, 38.6), 'S12d', 'Marzena Belview (CN mongrelfolk, flight), chained to the post: beats her wings and shrieks gibberish at anyone near; only Clovin may come close to feed her')
g.objects[-1]['dims'] = {'v': 3}
for i, (k, poly, _) in enumerate(SHEDS):
    xs = [p[0] for p in poly]; zs = [p[1] for p in poly]; cx, cz = (min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2
    g.prop(f'{k}-coops', 'debris', (cx, cz), k, dims={'seed': i + 3, 'n': 5, 'r': 1.2})
    g.creature(f'{k}-mf', 'mongrelfolk', (cx + 0.15, cz + 0.15), k, 'A howling, mewling mongrelfolk shackled to the back wall among smashed coops (Clovin carries the padlock keys)')
    g.objects[-1]['dims'] = {'v': 5 + i % 5}
g.prop('S12-mist', 'mist-bank', (26.5, 32), 'S12', dims={'r': 24, 'h': 3, 'n': 10, 'o': 0.1})
g.prop('S10-plaque', 'plaque', (32.2, 27.2), 'S10', rotY=135, dims={'y': 6})
g.note('S10-note', (32, 25.5), 'S10', 'The "guards" on the battlements are scarecrows in corroded chain shirts (DC 10 Perception sees it). The doors are heavy but unlocked.')

# ---------------------------------------------------------------- the east wing, ground floor
g.prop('S14-desk', 'debris', (37.5, 33.2), 'S14', dims={'seed': 21, 'n': 7, 'r': 1.4})
g.prop('S14-chair', 'debris', (38.6, 34.6), 'S14', dims={'seed': 29, 'n': 4, 'r': 0.8})
g.prop('S14-stair', 'stairs-run', (37, 40), 'S14', rotY=90, dims={'len': 20, 'w': 9, 'rise': 15})
g.creature('S15-golem', 'flesh-golem', (46, 37), 'S15', 'The flesh golem paces the lightless hall; it attacks anyone not with the Abbot or Clovin, and comes to noise or light in the foyer')
g.objects[-1]['size'] = 'medium'
MF = {'S15a': [(40.8, 32.8), (41.6, 32.7), (40.7, 33.6)], 'S15b': [(45, 34), (46, 33.6), (45.6, 34.8), (46.6, 34.6), (47.2, 32.8)],
      'S15c': [(50 + 1.1 * math.cos(a), 34 + 1.1 * math.sin(a)) for a in [k * 2 * math.pi / 7 for k in range(7)]],
      'S15d': [(53 + (k % 3) * 0.95, 33.1 + (k // 3) * 0.95) for k in range(9)],
      'S15e': [(40.6 + (k % 4) * 0.95, 38.6 + (k // 4) * 0.95) for k in range(16)],
      'S15f': [(46 + 1.3 * math.cos(a), 40 + 1.2 * math.sin(a)) for a in [k * 2 * math.pi / 8 + 0.3 for k in range(8)]],
      'S15g': [(48.7, 38.7), (51.3, 38.7), (48.7, 41.3), (50, 39.6), (49.4, 40.6), (50.8, 40.4), (51.2, 41.2), (49.9, 41.4), (50.6, 38.9), (48.9, 39.9)],
      'S15h': [(54, 40.1), (54.5, 40.4)]}
TXT = {'S15a': 'Three mongrelfolk huddle in the north-west corner; one nurses a brass candlestick like a doll',
       'S15b': 'Four mongrelfolk brawl for dominance (they stop if separated); a fifth cackles behind the statue',
       'S15c': 'Seven mongrelfolk in a ring, chanting gibberish to make the dinner bell ring',
       'S15d': 'Nine starved mongrelfolk staring at the door; they try to kill and eat whoever steps in',
       'S15e': 'Sixteen filthy mongrelfolk among chewed bones, begging for food',
       'S15f': 'Eight mongrelfolk capering and singing the rhyme of the devil and his bride; the leader holds up a gold statuette',
       'S15g': 'Ten mongrelfolk; three tend screaming mongrelfolk babies (noncombatants), the rest roll about and whack each other with sticks',
       'S15h': 'Two mongrelfolk hide in the fort (three-quarters cover); they come out only for food'}
for k, pts in MF.items():
    for i, p in enumerate(pts):
        g.creature(f'{k}-mf{i}', 'mongrelfolk', p, k, TXT[k] if i == 0 else 'Mongrelfolk', size='small' if (k == 'S15g' and i >= 7) else 'medium')
        g.objects[-1]['dims'] = {'v': 5 + (i + ord(k[-1])) % 5}
for i, k in enumerate(CELLS):
    poly = CELLS[k][0]; xs = [p[0] for p in poly]; zs = [p[1] for p in poly]
    g.prop(f'{k}-wreck', 'debris', (max(xs) - 1, (min(zs) + 1) if zs[0] < 37 else max(zs) - 1), k, dims={'seed': 40 + i, 'n': 9, 'r': 1.6})
g.prop('S15b-statue', 'saint-statue', (47.2, 33.6), 'S15b', rotY=200)
g.prop('S15e-bones', 'bones', (42, 40), 'S15e'); g.prop('S15e-bones2', 'bones', (41, 41.2), 'S15e', rotY=70)
g.prop('S15h-fort', 'furniture-fort', (54, 40), 'S15h')
g.hidden('S15a-candlestick', 'candlestick', (40.9, 33.1), 'S15a', 'A polished brass candlestick cradled like a doll; trying to take it makes them attack')
g.hidden('S15f-statuette', 'niche', (46.2, 39.2), 'S15f', 'A gold statuette of Saint Markovia (250 gp; +1 to saving throws for a good-aligned bearer); they weep if it is taken')

# ================================================================== cellar (380 ft)
c = Level('cellar', 'Wine cellar', C_EL, 19.5, ambient='darkness', interior='ashlar', exterior='ashlar', north='-z')
c.room('S16', 'Wine Cellar', rect(16, 12, 26, 22), 'flagstone', page=pg('S16'), ceilingFt=10)
c.prop('S16-rack-n', 'wine-rack', (19.4, 13.2), 'S16', dims={'len': 20})
c.prop('S16-rack-w', 'wine-rack', (16.8, 16.7), 'S16', rotY=90, dims={'len': 24})
for i, (x, z) in enumerate([(19.6, 16.4), (21.0, 16.4), (20.3, 17.7)]): c.prop(f'S16-empty{i}', 'wine-barrel', (x, z), 'S16')
for i, z in enumerate((12.7, 13.7, 14.7)): c.prop(f'S16-grapemash{i}', 'wine-barrel', (25.35, z), 'S16')
for i, x in enumerate((17.2, 18.2, 19.2, 20.2)): c.prop(f'S16-dragon{i}', 'wine-barrel', (x, 21.4), 'S16', dims={'fine': 1})
c.prop('S16-stair-a', 'stairs-run', (22, 21), 'S16', dims={'len': 10, 'w': 9, 'rise': 10})
c.prop('S16-landing', 'ledge', (25, 21), 'S16', dims={'w': 10, 'd': 10, 'h': 10})
c.prop('S16-stair-b', 'stairs-run', (25, 20), 'S16', rotY=90, dims={'len': 10, 'w': 9, 'rise': 10}, y=10)
c.hidden('S16-scroll', 'niche', (17.0, 16.0), 'S16', 'On the rack: an unstoppered bottle labelled "Champagne du le Stomp" holding a rolled spell scroll of heroes\' feast')
c.note('S16-note', (21, 18.8), 'S16', 'Centre barrels empty; east wall: Purple Grapemash No. 3 (cheap); south wall: Red Dragon Crush (fine). The racks hold 33 Grapemash and 24 Red Dragon Crush.')
cobwebs(c, rect(16, 12, 26, 22), 'S16', y=8, n=4)

# ================================================================== upper floor (415 ft): the wall-walks and the east wing
u = Level('upper', 'Upper floor', U_EL, 8, ambient='interior-dim', interior='ashlar', exterior='ashlar', north='-z')
WALK = {'S18': [(18, 22), (26, 22), (26, 24), (18, 24)], 'S18-w': [(16, 22), (18, 22), (18, 28), (16, 28)],
        'S18-sw': [(16, 28), (18, 28), (30, 40), (26, 40), (26, 38), (20, 32), (16, 32)], 'S18-s': [(26, 40), (34, 40), (34, 42), (26, 42)],
        'S18-e': [(34, 32), (36, 32), (36, 42), (34, 42)], 'S18-ne': [(26, 22), (36, 32), (34, 32), (26, 24)]}
WN = {'S18': 'Curtain Wall (north walk)', 'S18-w': 'Curtain Wall (west walk)', 'S18-sw': 'Curtain Wall (south-west walk)', 'S18-s': 'Curtain Wall (south walk)', 'S18-e': 'Curtain Wall (east walk)', 'S18-ne': 'Curtain Wall (north-east walk)'}
for k, poly in WALK.items(): u.room(k, WN[k], poly, 'flagstone', page=pg('S18'), ceilingFt=8)
# the walk's inner edges drop fifteen feet into the courtyard; its outer edges are battlemented
for a, b in [((18, 24), (26, 24)), ((26, 24), (34, 32)), ((34, 32), (34, 40)), ((30, 40), (34, 40)), ((18, 28), (30, 40)), ((18, 24), (18, 28)),
             ((16, 22), (26, 22)), ((18, 22), (18, 24)), ((16, 28), (18, 28)), ((26, 40), (30, 40)), ((34, 40), (34, 42)), ((34, 32), (36, 32)), ((26, 22), (26, 24))]:
    if is_axis(a, b): u._stamp(a, b, open_wall=True)
    else: ov(u, a, b, open_wall=True)
OUTER = [((16, 22), (16, 28)), ((16, 28), (16, 32)), ((16, 32), (20, 32)), ((20, 32), (26, 38)), ((26, 38), (26, 40)), ((26, 40), (26, 42)), ((26, 42), (34, 42)), ((34, 42), (36, 42)), ((26, 22), (36, 32))]
for a, b in OUTER:
    low_edge(u, a, b, 4)
    L = math.hypot(b[0] - a[0], b[1] - a[1]) * 5
    u.prop(f'merlons-{a[0]}-{a[1]}', 'merlons', ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), 'S18', rotY=angle(a, b), dims={'len': round(L, 1), 'y': 4, 't': 1.2})
# the east wing's upper rooms
S20P = [(36, 32), (44, 32), (44, 36), (38, 36), (38, 42), (36, 42)]
u.room('S20', 'Upstairs Office', S20P, 'plank', page=pg('S20'), ceilingFt=8)
u.room('S19', 'Barracks', rect(38, 36, 44, 42), 'plank', page=pg('S19'), ceilingFt=8)
u.room('S21', 'Haunted Hospital', rect(44, 32, 56, 38), 'plank', page=pg('S21'), ceilingFt=8)
u.room('S22', 'Operating Room', rect(44, 38, 48, 42), 'plank', page=pg('S22'), ceilingFt=8)
u.room('S23', 'Nursery', rect(48, 38, 52, 42), 'plank', page=pg('S23'), ceilingFt=8)
u.room('S24', 'Morgue', rect(52, 38, 56, 42), 'plank', page=pg('S24'), ceilingFt=8)
u.door((36, 34), (36, 35), id='S20-walk-door'); u.door((36, 40), (36, 41), id='S20-walk-door-s'); u.opening((38, 40), (38, 42))
u.door((44, 34), (44, 35), id='S21-door')
for x, k in ((45, 'S22'), (49, 'S23'), (53, 'S24')): u.door((x, 38), (x + 1, 38), id=f'{k}-door')
for x in (38, 41, 46, 50, 54): u.window((x, 32), (x + 1, 32))
for x in (39, 42, 46, 50, 54): u.window((x, 42), (x + 1, 42))
u.window((56, 34), (56, 35)); u.window((56, 40), (56, 41))
u.counter((37, 34), (42, 34)); u.counter((42, 32), (42, 34))
u.prop('S20-rot', 'debris', (40.5, 33), 'S20', dims={'seed': 61, 'n': 8, 'r': 1.8}); u.prop('S20-rot2', 'debris', (43, 35.2), 'S20', dims={'seed': 67, 'n': 6, 'r': 1.2})
u.prop('S20-stairwell', 'prism', (0, 0), 'S20', dims={'h': 0.05, 'y': 0.02, 'color': 0x0e0c10})
u.objects[-1]['pos'] = [185, 0, 191]; u.objects[-1]['polygon'] = [[180, 182], [190, 182], [190, 200], [180, 200]]
u.railing((38, 36.4), (38, 40))
for i, (x, z) in enumerate([(38.9, 37.4), (43.1, 37.4), (38.9, 41), (43.1, 41)]): u.prop(f'S19-bunks{i}', 'bunk-ruin', (x, z), 'S19', rotY=0 if i % 2 == 0 else 180, dims={'seed': 70 + i})
u.creature('S19-ezmerelda', 'adventurer', (41.5, 39.5), 'S19', "Ezmerelda d'Avenir (if not met elsewhere), the Abbot's guest, waiting for Strahd to visit his bride; plans a magic circle here")
for i in range(10): u.prop(f'S21-bed-n{i}', 'iron-bed', (45.4 + i * 1.07, 33.5), 'S21', dims={'seed': i + 1})
for i in range(8): u.prop(f'S21-bed-s{i}', 'iron-bed', (47.5 + i * 1.07, 35.9), 'S21', dims={'seed': i + 20})
for i, (x, z) in enumerate([(45.5, 35.2), (50.5, 34.9), (53.2, 35), (48, 32.7), (55.2, 33.1), (46.9, 37.2)]): u.creature(f'S21-shadow{i}', 'shadow', (x, z), 'S21', 'Six shadows wait until someone is 10 ft inside, then step out of the ordinary shadows; they cannot leave the room' if i == 0 else 'Shadow')
cobwebs(u, rect(44, 32, 56, 38), 'S21', y=7, n=4)
u.prop('S22-table', 'operating-table', (46, 40.2), 'S22')
u.note('S22-note', (46.6, 41.4), 'S22', 'The first touch of the table: a scream echoing through time, then fainter screams of those who died under the knife.')
for i, (x, z) in enumerate([(48.9, 38.9), (50.9, 39.3), (49.4, 41.1)]): u.prop(f'S23-crib{i}', 'crib-wreck', (x, z), 'S23', dims={'seed': i + 3})
u.note('S23-note', (50, 40.2), 'S23', 'Searching: one character sees a nun in white reflected in the window glass, standing in the doorway; nothing is there. A card-reading treasure lies under a crib.')
u.creature('S24-raven', 'raven', (54.5, 41.75), 'S24', 'A raven on the windowsill: approached, it flies to the nearest garden scarecrow. Killing it curses the killer (disadvantage on attacks and checks until remove curse)')
u.objects[-1]['dims'] = {'y': 3}; u.objects[-1]['size'] = 'tiny'
# scarecrow guards along the walks, looking out
SC = [((17, 24.5), 90), ((17, 29.5), 90), ((28.1, 24.6), -45), ((31.1, 27.6), -45), ((33.6, 30.1), -45), ((21.6, 31.2), 135), ((24.1, 33.8), 135), ((26.6, 36.3), 135), ((28.5, 41.2), 180), ((32, 41.2), 180)]
def walk_of(p): return next((k for k, poly in WALK.items() if KL.inside(p, poly)), 'S18')
for i, ((x, z), r) in enumerate(SC): u.prop(f'S18-scarecrow{i}', 'scarecrow-stand', (x, z), walk_of((x, z)), rotY=r + 180)
u.prop('S1x-roof-east', 'roof-gable', (46, 37), None, dims={'w': 104, 'd': 54, 'h': 16, 'y': 8})

# ================================================================== the loft and belfry (420 ft)
lo = Level('loft', 'Loft and belfry', L_EL, 12, ambient='interior-dim', interior='ashlar', exterior='ashlar', north='-z')
lo.room('S17', 'Loft and Belfry', rect(16, 12, 26, 22), 'plank', page=pg('S17'), ceilingFt=12)
lo.door((20, 22), (21, 22), id='S17-door')
for a, b in [((16, 14), (16, 15)), ((26, 14), (26, 15)), ((26, 17), (26, 18))]: lo.window(a, b)
lo.prop('S17-shroud', 'shroud-table', (16.9, 14.6), 'S17')
lo.hidden('S17-thing', 'niche', (16.9, 15.2), 'S17', 'Under the shroud: the characters see a creature stitched from their own parts; touched, it is chopped-up parts of dead women from Krezk\'s graves, the leftovers of Vasilka')
lo.prop('S17-tools', 'tool-table', (17.0, 12.6), 'S17')
lo.prop('S17-cot', 'fur-cot', (24.7, 13.6), 'S17')
lo.prop('S17-bottles', 'bottles', (23.4, 14.0), 'S17', dims={'n': 7, 'seed': 9})
lo.hidden('S17-grapemash', 'niche', (24.7, 13.0), 'S17', 'Under the furs of the cot: three bottles of Purple Grapemash No. 3')
lo.prop('S17-lamp-table', 'table', (23.9, 15.6), 'S17', dims={'w': 3, 'd': 2.4})
lo.prop('S17-lamp', 'oil-lamp', (23.9, 15.6), 'S17', dims={'y': 3.1})
lo.light('S17-lamp', (23.9, 15.6), 'lamp', 15, 45, y=3.5)
lo.prop('S17-rope', 'bell-rope', (21, 14.8), 'S17', dims={'top': 30, 'y': 3})
for i, (x, z) in enumerate([(18.5, 15), (23.5, 15), (18.5, 19.5), (23.5, 19.5)]): lo.prop(f'S17-lantern{i}', 'hanging-lantern', (x, z), 'S17', dims={'y': 10})
lo.creature('S17-clovin', 'mongrelfolk', (24.2, 14.4), 'S17', 'Clovin Belview (two-headed NE mongrelfolk), drunk on the edge of his cot playing the viol beautifully; the Abbot\'s manservant, rings the dinner bell, carries the shed keys')
lo.objects[-1]['dims'] = {'v': 4}
lo.prop('S17-stair-top', 'prism', (0, 0), 'S17', dims={'h': 0.05, 'y': 0.02, 'color': 0x0e0c10})
lo.objects[-1]['pos'] = [90, 0, 97.5]; lo.objects[-1]['polygon'] = [[80, 90], [100, 90], [100, 105], [80, 105]]
lo.railing((18, 18), (20, 18)); lo.railing((20, 18), (20, 21))
lo.note('S17-T', (22.8, 19.1), 'S17', 'T: where characters teleporting from K78 in Castle Ravenloft arrive.')
lo.prop('S17-roof', 'roof-gable', (21, 17), None, dims={'w': 52, 'd': 55, 'h': 18, 'y': 12})
lo.prop('S17-belfry', 'belfry', (21, 14.8), None, dims={'w': 9, 'h': 11}, y=24)
lo.prop('S17-chimney', 'chimney', (21, 11.5), None, dims={'h': 26, 'y': 0})
lo.prop('S17-smoke', 'mist-bank', (21, 11.5), None, dims={'r': 4, 'h': 3, 'n': 3, 'o': 0.3}, y=30)
cobwebs(lo, rect(16, 12, 26, 22), 'S17', y=10, n=3)

# ---------------------------------------------------------------- the people of the hall
g.creature('S13-abbot', 'abbot', (21.4, 13.6), 'S13', 'The Abbot: a deva in a handsome young man\'s guise, teaching Vasilka etiquette. Friendly visitors get a tour and his help (raise dead up to three times) for a bridal gown; threats bring out his angelic form.')
g.creature('S13-vasilka', 'vasilka', (20.5, 13.6), 'S13', 'Vasilka, a flesh golem made to be Strahd\'s bride; within 5 ft the seams show. Obeys the Abbot, screams if harmed.')

# ================================================================== the land round the ledge (0 ft: the village floor)
v = Level('valley', 'Below the ledge', 0, 398, ambient='barovian-overcast', interior='rubble', exterior='rubble', north='-z')
# the foot of the cliff under the south-west curtain wall, where the switchback road (Krezk area S5) starts; the square
# is centred on the Krezk map's S5 box, so the village drawn round this map from Krezk's falls where it should
S5C = KL.k2a(*KL.S5_CENTRE)
FOOT = [((S5C[0] - 20) / 5, (S5C[1] - 20) / 5), ((S5C[0] + 20) / 5, (S5C[1] - 20) / 5), ((S5C[0] + 20) / 5, (S5C[1] + 20) / 5), ((S5C[0] - 20) / 5, (S5C[1] + 20) / 5)]
v.room('S18-foot', 'Foot of the cliff', FOOT, 'grass', page=pg('S18'), ceilingFt=398)
open_edges(v, FOOT)
v.terrain.append((FOOT, 'dirt'))      # rocky earth at the cliff's foot
v.note('foot-note', ((S5C[0]) / 5, (S5C[1]) / 5), 'S18-foot', 'The village floor, 400 ft below the abbey: anything that falls over the south-west wall lands on these slopes. The switchback road (S5) starts here.')
# the ground: the abbey's rock, its cliffs and the mountain behind, sampled from the shared topography (5-ft lattice)
X0, Z0, NX, NZ, CELL = -90, -200, 138, 100, 5
RIM_A = [(x * 5, z * 5) for x, z in KL.RIM_CELLS]
def _abbey_h(x, z):
    if KL.inside((x, z), RIM_A): return LEDGE - 1.0          # under the ledge's own ground
    return KL.height(KL.a2k(x, z))
def _hole(x, z):
    if KL.inside((x, z), RIM_A) and KL.poly_dist((x, z), RIM_A) > 6: return True
    return KL.height(KL.a2k(x, z)) <= 0.6
hf = KL.heightfield_dims(X0, Z0, NX, NZ, CELL, _abbey_h, hole=_hole)
hf['frost'] = 420
v.prop('land', 'heightfield', (X0 / 5, Z0 / 5), None, dims=hf)
v.prop('switchback', 'road-ribbon', (0, 0), None, dims=KL.ribbon_dims([(x - KL.OFF[0], z - KL.OFF[1], h) for x, z, h in KL.ROAD if h < LEDGE - 0.5], KL.ROAD_W))
v.objects[-1]['pos'] = [0, 0, 0]
for i, (x, z, r) in enumerate([(10, 230, 60), (90, 260, 70), (200, 270, 80), (-40, 150, 60), (300, 280, 70)]):
    v.prop(f'valley-mist{i}', 'mist-bank', (x / 5, z / 5), None, dims={'r': r, 'h': 8, 'n': 8, 'o': 0.07}, y=22)

# ================================================================== the grounds' furnishings (ground level)
# the graveyard (S7): rows of headstones north of the hall, more down its west side, the sun's grave (X)
graves = [(14 + i * 1.1, z) for z in (3.2, 4.9, 6.4) for i in range(7)] + [(11.6, 3.6), (11.3, 5.4), (11.1, 7.2), (11.0, 9.1)] + \
         [(11.2, 11.4), (12.6, 12.2), (11.4, 13.6), (12.9, 21.6), (11.3, 22.8), (12.4, 24.6), (11.2, 25.9), (12.8, 27.2), (11.6, 28.6), (14.2, 29.8)]
for i, (x, z) in enumerate(graves): g.prop(f'S7-grave{i}', 'gravestone', (x, z - 0.4), None, rotY=(i * 37) % 24 - 12)
g.prop('S7-sun-grave', 'gravestone', (12.8, 16.8), None, rotY=-90)
g.hidden('S7-X', 'niche', (12.8, 17.2), None, 'X: the sun\'s grave, carved with roses, a 3-inch sun-shaped hollow on its east side over the name PETROVNA. Tasha Petrovna\'s holy symbol (K84 crypt 11) in the hollow: a ray of sun, the stone crumbles, a ring of regeneration inside. Smashed without it: nothing.')
for i, (x, z, s) in enumerate([(15, 9.2, 0.7), (19.3, 9.2, 0.75), (23.7, 9.2, 0.7), (13.8, 14.9, 0.6), (13.8, 19.7, 0.65), (12.4, 30.4, 0.55)]):
    g.prop(f'S7-pine{i}', 'pine', (x, z), None, dims={'scale': s})
# the north gate's guard posts (S6): furs, nets and shovels; Otto and Zygfrek asleep
for side, x in (('w', 25), ('e', 29)):
    g.prop(f'S6{side}-furs', 'fur-pile', (x, 1.0), None)
    g.prop(f'S6{side}-net', 'net-and-shovel', (x, 0.3), None)
g.creature('S6-otto', 'mongrelfolk', (25, 1.1), None, 'Otto Belview (LE mongrelfolk, standing leap), asleep under furs; squats, brays when he laughs, and thinks himself the finest creature alive')
g.objects[-1]['dims'] = {'v': 0}; g.objects[-1]['size'] = 'small'
g.creature('S6-zygfrek', 'mongrelfolk', (29, 1.1), None, 'Zygfrek Belview (LE mongrelfolk, darkvision), asleep under furs; scaled on one side, furred on the other, and sure everyone is judging her')
g.objects[-1]['dims'] = {'v': 1}; g.objects[-1]['size'] = 'small'
# the gardens (S9): four plots, two scarecrows on crosses, white rabbits
for i, (x, z, w, d, rot) in enumerate([(59.8, 28, 22, 18, 0), (66, 30.3, 20, 38, 90), (72, 29.1, 20, 26, 90), (60, 34.3, 20, 31, 90)]):
    g.prop(f'S9-plot{i}', 'garden-plot', (x, z), None, rotY=rot, dims={'w': d if rot else w, 'd': w if rot else d, 'rows': 4})
g.prop('S9-scarecrow-n', 'scarecrow-stand', (64.4, 24.9), None, dims={'cross': 1})
g.prop('S9-scarecrow-s', 'scarecrow-stand', (62.9, 36.8), None, dims={'cross': 1})
g.note('S9-scarecrow-note', (62.9, 37.6), None, 'The southernmost scarecrow: a card-reading treasure in its straw gullet; taking it raises seven wights in Strahd\'s tattered livery from the beds.')
for i, (x, z) in enumerate([(63, 27.2), (68.6, 33.6), (61.6, 31.6), (74.8, 33)]):
    g.creature(f'S9-rabbit{i}', 'rabbit', (x, z), None, 'White rabbits nibbling turnips uprooted by the cold (harmless)', size='tiny')
    g.objects[-1]['vis'] = 'player'
# buttresses at the corners of the walls
for i, (x, z, r) in enumerate([(15.3, 23.2, 90), (15.3, 32.3, 135), (26, 42.8, 180), (35, 42.8, 180), (55.6, 42.8, 180), (56.7, 31.6, -90)]):
    g.prop(f'buttress{i}', 'buttress', (x, z), None, rotY=r, dims={'h': 15, 'w': 3.5, 'd': 4.5})
g.prop('spawn', 'spawn', (27, -1.5), None)

# ================================================================== descriptions (our own words)
SHED_DM = 'A shackled mongrelfolk among smashed coops; Clovin carries the padlock keys.'
DESC = {
  'S10': ('Between the two wings a fifteen-foot wall with straw "sentries" on its battlements; tall steel-banded doors and a green copper plaque beside them.', 'The plaque names the abbey with a short prayer for the healing of the sick. The doors push open on the foggy courtyard.'),
  'S11': ('A small empty stone building under the curtain wall, an unlocked wooden door into the courtyard.', 'Both gatehouses help hold up the wall; nothing inside.'),
  'S11-s': ('The second empty gatehouse under the curtain wall.', 'Nothing inside.'),
  'S12': ('A courtyard full of swirling fog inside fifteen-foot walls lined with scarecrows. A winched stone well in the middle, padlocked sheds and trough alcoves under the walls, two tethering posts; screams from the sheds.', 'Doors north to the main hall and east to the foyer. Otto and Zygfrek leave escorted guests here while they fetch the Abbot.'),
  'S12a': ('A stone well with an iron winch, a rope and a bucket.', 'Eighty feet deep; Mishka Belview clings to the shaft twenty feet down and comes up at anyone who shines a light on him.'),
  'S12b': ('Three shallow alcoves under the wall, each with a rotting wooden horse trough.', 'The troughs fall apart if handled.'),
  'S12c': ('A padlocked stone shed: smashed chicken coops and a creature shackled to the back wall.', 'Nine sheds, each holding a mongrelfolk; Clovin has the keys.'),
  'S12c-b': ('A padlocked stone shed.', SHED_DM), 'S12c-c': ('A padlocked stone shed.', SHED_DM), 'S12c-d': ('A padlocked stone shed against the hall.', SHED_DM), 'S12c-e': ('A padlocked stone shed against the hall.', SHED_DM),
  'S12c-f': ('A padlocked stone shed under the south wall.', SHED_DM), 'S12c-g': ('A padlocked stone shed under the south wall.', SHED_DM), 'S12c-h': ('A padlocked stone shed under the south wall.', SHED_DM), 'S12c-i': ('A padlocked stone shed against the east wing.', SHED_DM),
  'S12d': ('Two hitching posts ringed with iron; chained to one, a small winged thing with a spider\'s jaws.', 'Marzena Belview: skittish, flees for good if her chains are broken or unlocked.'),
  'S13': ('A fifty-foot hall with arched leaded windows: a cauldron over the hearth under a golden sun disk, a long table set with wooden dishes and gold candelabras, a wooden stair up in one corner, a stone stair down in another. Soft music drifts from above.', 'The Abbot and Vasilka. The soup (turnip and rabbit) feeds the mongrelfolk. Sun disk 750 gp, four candelabras 250 gp each; the niche behind the disk.'),
  'S14': ('Once an office: a smashed desk and chair. A hall runs south to a stair going up; a dark passage east whispers and laughs and stinks.', 'Noise or light here draws the flesh golem from S15. The stair climbs to S20.'),
  'S15': ('A black corridor lined with doors, laughter and muttered curses behind every one, and a reek that catches the throat; a door at the far end lets onto the gardens.', 'The flesh golem paces here. Sixty mongrelfolk in the cells, unrestrained but too afraid to leave; each has a dagger and a wooden soup bowl.'),
  'S15a': ('A smashed dormitory; three figures huddle shrieking in the north-west corner, one hugging something that glints.', 'Three mongrelfolk; the brass candlestick.'),
  'S15b': ('Four creatures wrestle in the wreckage while a fifth giggles from behind a painted wooden saint.', 'Five mongrelfolk; the statue of Saint Markovia is covered with bite marks.'),
  'S15c': ('Seven figures squat in a circle, droning what sounds like a spell.', 'Seven mongrelfolk speaking gibberish, trying to ring the dinner bell by magic.'),
  'S15d': ('Nine gaunt figures wait in silence, eyes fixed hungrily on the door.', 'Nine starved mongrelfolk attack anyone who enters.'),
  'S15e': ('A crush of misshapen bodies fills the room, filthy, among chewed bones.', 'Sixteen mongrelfolk; the bones are their dead.'),
  'S15f': ('Eight figures dance and chant through the wreckage behind a leader waving a gold figurine.', 'Eight mongrelfolk; the gold statuette of Saint Markovia.'),
  'S15g': ('Wailing infants are rocked in the corners while the rest roll about, hooting and beating one another with sticks.', 'Ten mongrelfolk, three tending noncombatant babies.'),
  'S15h': ('Smashed furniture and torn curtains heaped into a den; someone giggles inside it.', 'Two mongrelfolk inside (three-quarters cover); they come out only for food.'),
  'S16': ('A cold stone cellar at the foot of a twenty-foot stair: wine barrels in rows and an L of racks crammed with bottles.', 'Barrels marked with the Wizard of Wines; the scroll bottle on the rack.'),
  'S17': ('A loft under a pitched roof: unlit lanterns in the rafters, a rope from the bell thirty feet up, a shrouded shape on a table, a fur-heaped cot among empty bottles and a lamp-lit table, a viol playing. Freezing cold.', 'The Abbot\'s golem workshop and Clovin\'s room. Ringing the bell sets every mongrelfolk shrieking for food. The door in the south wall opens on the wall-walk.'),
  'S18': ('A walk behind the battlements, its garrison of straw men in rusted mail staring out over the cliffs; fog fills the yard below.', 'A fifteen-foot drop into the courtyard; over the south-west wall, four hundred feet down the cliff.'),
  'S18-w': ('The wall-walk along the west side of the courtyard.', 'Scarecrows on stands; a 15-ft drop to the courtyard.'), 'S18-sw': ('The wall-walk along the south-west wall; beyond the battlements the cliff falls away.', 'A fall over this wall is 400 ft.'),
  'S18-s': ('The wall-walk along the south wall.', 'Scarecrows on stands; the cliff below.'), 'S18-e': ('The wall-walk along the east wing\'s end, doors into the upper floor.', 'Doors into S20 and the stair hall; the madhouse below.'),
  'S18-ne': ('The wall-walk over the entrance and the two gatehouses.', 'The scarecrow "guards" seen from the road stand here, over the doors.'),
  'S18-foot': ('Rocky slopes at the foot of the abbey\'s cliff, the village of Krezk below.', 'Not an area of the abbey: the ground 400 ft below the ledge, kept so the cliffs and the switchback road read.'),
  'S19': ('The old guardroom: thirty feet square, damp, its bunks rotted into heaps.', 'The old guards\' quarters. Ezmerelda may be here.'),
  'S20': ('A big office behind an L-shaped counter; the rest of its furniture has mouldered into heaps.', 'The counter is soft and breaks easily. The madhouse can be heard below.'),
  'S21': ('A long ward of wrought-iron bed frames in two rows, cobwebs and rotten mattress on each; three doors in the south wall with plaques.', 'Six shadows. The plaques read Operating Room, Nursery and Morgue.'),
  'S22': ('Bare but for a table dark with old blood.', 'The screams on first touch.'),
  'S23': ('Broken cribs, splintered and heaped.', 'The nun in the window.'),
  'S24': ('Bare boards, and a raven watching from the sill.', 'The cursed raven.'),
}

levels = [v, g, u, lo, c]
def lk(id, kind, al, ap, bl, bp): return OrderedDict(id=id, kind=kind, **{'from': OrderedDict(level=al, pos=[round(ap[0] * 5, 2), round(ap[1] * 5, 2)]), 'to': OrderedDict(level=bl, pos=[round(bp[0] * 5, 2), round(bp[1] * 5, 2)])})
links = [lk('lk-road', 'stairs', 'valley', (S5C[0] / 5, S5C[1] / 5), 'ground', (26.5, -1.5)),
         lk('lk-hall-loft', 'stairs', 'ground', (19.5, 21), 'loft', (17, 18.6)),
         lk('lk-hall-cellar', 'stairs', 'ground', (24.5, 19.5), 'cellar', (22.5, 21)),
         lk('lk-foyer-upper', 'stairs', 'ground', (37, 40.8), 'upper', (37, 37)),
         lk('lk-loft-walk', 'stairs', 'loft', (20.5, 21.4), 'upper', (20.5, 23))]
scene = OrderedDict(schema=1, location='S10', chapter='ch08', name='Abbey of Saint Markovia', mapPage=149, bookScaleFt=10, ambient='barovian-overcast', parent='ch08/S', stacked=True, entry='ground', clearingFt=1100,
                    levels=[lv.to_json() for lv in levels], links=links)
# walls: the hall's own walls stand twenty feet, up to the loft floor; everything else keeps its level's height
HALL_SQ = rect(16, 12, 26, 22)
def on_edge(p, poly):
    for i in range(len(poly)):
        d, _ = KL.seg_dist((p[0] / 5, p[1] / 5), poly[i], poly[(i + 1) % len(poly)])
        if d < 1e-6: return True
    return False
for lv in scene['levels']:
    if lv['id'] == 'ground':
        for w in lv['walls']:
            if on_edge(w['a'], HALL_SQ) and on_edge(w['b'], HALL_SQ) and 'heightFt' not in w: w['heightFt'] = 20
    for r in lv['rooms']:
        d = DESC.get(r['key'])
        if d:
            r['desc'] = d[0]
            if d[1]: r['dm'] = d[1]
grid = OrderedDict(schema=1, levels=OrderedDict())
for lv in levels:
    extra = GRID_EXTRA if lv.id == 'ground' else []
    polys = [[[round(x * 5, 3), round(z * 5, 3)] for x, z in p] for p in lv.floor_polys + extra] + [[[round(x * 5, 3), round(z * 5, 3)] for x, z in p] for p, f in lv.terrain[:1]]
    grid['levels'][lv.id] = OrderedDict(floorPolygons=polys, type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0.55)
out = os.path.join(ROOT, 'locations', 'ch08', 'S10'); os.makedirs(out, exist_ok=True)
json.dump(scene, open(os.path.join(out, 'scene.json'), 'w'), indent=1)
json.dump(grid, open(os.path.join(out, 'grid.json'), 'w'), indent=1)
print('abbey:', [(lv.id, len(lv.rooms), len(lv.objects)) for lv in levels])
