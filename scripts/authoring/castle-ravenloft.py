#!/usr/bin/env python3
"""Castle Ravenloft (chapter 4, maps 2–13) -> locations/ch04/K/{scene,grid}.json

A reconstruction from the book's isometric plates, rectified into plan view (scripts in the session scratch:
measure the two grid directions, warp so the 10-ft squares become axis-aligned, read room corners off the
grid). Each plate has its own frame; `m3()` etc. place a plate's 10-ft cells into one castle frame of 5-ft
cells (x east, z south, origin at the north-west corner of the curtain wall). Only keys, names, page refs,
dimensions and placements live here; descriptions are our own wording.

Levels (elevation from the plates' "up/down n feet" captions):
  ground    0 ft   courtyard (map 2) and the keep's main floor (map 3)
  court   +50 ft   court of the count (map 4)        [next]
  weeping +90 ft   rooms of weeping (map 5)          [next]
  spires, towers, larders (-40), dungeon (-80), catacombs (-120)  [next]
"""
import json, os, sys, math
from collections import OrderedDict

sys.path.insert(0, os.path.dirname(__file__))
from authorlib import ROOT, Level, rect, cobwebs  # noqa: F401

OUT = os.path.join(ROOT, 'locations', 'ch04', 'K')

# printed pages of the keyed text: the manifest's area list (verified against the OCR)
_M = json.load(open(os.path.join(ROOT, 'manifests', 'locations.json')))
PAGE = {a['key']: a['page'] for l in _M['locations'] if l['id'] == 'K' for a in l['areas']}
_OLD_PAGE = {'K1': 53, 'K2': 53, 'K3': 53, 'K4': 53, 'K5': 53, 'K6': 53, 'K7': 53, 'K8': 54, 'K9': 55, 'K10': 55, 'K11': 56, 'K12': 56,
        'K13': 56, 'K14': 56, 'K15': 56, 'K16': 57, 'K17': 57, 'K18': 57, 'K18a': 57, 'K19': 57, 'K20': 58, 'K20a': 58, 'K21': 58,
        'K22': 58, 'K23': 58, 'K24': 60, 'K29': 61, 'K31a': 62, 'K64': 77, 'K83': 84}
def pg(k): return PAGE.get(k.split('-')[0])

# ------------------------------------------------------------------ frames
# Map 3 (main floor) 10-ft cells -> castle 5-ft cells. The keep (cells 9..31 × 12..28) sits centred in the courtyard.
def m3(x, y): return (2 * x - 2, 2 * y - 6)
def poly3(pts): return [m3(x, y) for x, y in pts]
def rect3(x0, y0, x1, y1): return poly3([(x0, y0), (x1, y0), (x1, y1), (x0, y1)])
def oct_(cx, cy, r, k=0.4142):
    """Octagon of 'radius' r (half-width) in 5-ft cells, flat sides axis-aligned."""
    c = r * k
    return [(cx - c, cy - r), (cx + c, cy - r), (cx + r, cy - c), (cx + r, cy + c), (cx + c, cy + r), (cx - c, cy + r), (cx - r, cy + c), (cx - r, cy - c)]
def oct3(x, y, r10): cx, cy = m3(x, y); return oct_(cx, cy, r10 * 2)

# ================================================================== GROUND: courtyard (map 2) + main floor (map 3)
g = Level('ground', 'Courtyard and main floor', 0, 50, ambient='storm', interior='ashlar', exterior='ashlar', north='-z')
WALL_H = 90  # the curtain walls (p.53)

# --- the courtyard, 340 × 300 ft inside a 20-ft curtain wall; the keep stands in the middle
# K1 front courtyard wraps the keep's west, north-west and south-west; K2's two gated walls run from the keep to
# the curtain wall north and south of it; K3 the servants' courtyard takes the east.
g.room('K1', 'Front Courtyard', [(4, 4), (50, 4), (50, 18), (16, 18), (16, 50), (48, 50), (48, 64), (4, 64)], 'cobble', page=pg('K1'))
g.room('K3', "Servants' Courtyard", [(50, 4), (62, 4), (62, 10), (72, 10), (72, 30), (60, 30), (60, 18), (50, 18)], 'cobble', page=pg('K3'))
g.room('K3-s', "Servants' Courtyard (south)", [(48, 50), (60, 50), (60, 36), (72, 36), (72, 64), (48, 64)], 'cobble', page=pg('K3'))
g.room('K4', 'Carriage House', rect(62, 4, 72, 10), 'flagstone', page=pg('K4'), ceilingFt=15)
g.room('K5', 'Chapel Garden', rect(60, 30, 72, 36), 'grass', page=pg('K5'))
g.room('K5-p', 'Postern', rect(72, 31, 76, 35), 'flagstone', page=pg('K5'))
g.room('K6', 'Overlook', [(76, 30), (84, 30), (86, 32), (86, 34), (84, 36), (76, 36)], 'flagstone', page=pg('K6'))
g.room('K1-g', 'Gatehouse Passage', rect(0, 32, 4, 36), 'flagstone', page=pg('K1'))
# gates in K2's walls and the passages
g.door((50, 10), (50, 12), id='K2-north-gate', double=True)
g.door((48, 56), (48, 58), id='K2-south-gate', double=True)
g.door((62, 6), (62, 8), id='K4-doors', double=True)
g.opening((72, 32), (72, 34)); g.opening((76, 32), (76, 34))
g.opening((60, 32), (60, 34))   # garden to the servants' courtyard
g.opening((4, 33), (4, 35)); g.opening((0, 33), (0, 35))  # the gate stands open
# curtain wall: the courtyard's outer faces are 90 ft high; the outer edge of the wall is 20 ft further out
for a, b in [((4, 4), (72, 4)), ((72, 4), (72, 64)), ((72, 64), (4, 64)), ((4, 64), (4, 4))]:
    g._stamp(a, b, flags=['normal'], heightFt=WALL_H, material='ashlar', wall=True)
for a, b in [((0, 0), (76, 0)), ((76, 0), (76, 68)), ((76, 68), (0, 68)), ((0, 68), (0, 0))]:
    g.wall(a, b, heightFt=WALL_H, material='ashlar')
g.terrain.append(([(-18, 31), (0, 31), (0, 37), (-18, 37)], 'flagstone'))  # the bridge over the chasm from J
g.terrain.append(([(0, 0), (76, 0), (76, 68), (0, 68)], 'flagstone'))        # wall tops / foundations under everything
g.prop('carriage', 'wagon', (67, 7), 'K4', rotY=90)
g.note('K6-note', (81, 33), 'K6', 'Balcony over the cliff: the village lies a thousand feet below; a window-set stone box juts from the cliff 100 ft down (K63).')
g.light('K7-torch-a', (14.5, 25), 'torch', 20, 40, y=8); g.light('K7-torch-b', (14.5, 27), 'torch', 20, 40, y=8)

# --- the keep's main floor (map 3), 10-ft cells read off the rectified plate
g.room('K12-n', 'Turret Post (north-west)', oct3(10.5, 15, 1.5), 'flagstone', page=pg('K12'), ceilingFt=30)
g.room('K12-s', 'Turret Post (south-west)', oct3(10.5, 26.5, 1.5), 'flagstone', page=pg('K12'), ceilingFt=30)
g.room('K13-n', 'Turret Post Access Hall (north)', rect3(12, 14.5, 15, 15.5), 'flagstone', page=pg('K13'), ceilingFt=15)
g.room('K13-w', 'Turret Post Access Hall (west)', rect3(9.5, 16.5, 10.5, 24), 'flagstone', page=pg('K13'), ceilingFt=15)
g.room('K13-s', 'Turret Post Access Hall (south)', rect3(12, 26, 16.5, 27), 'flagstone', page=pg('K13'), ceilingFt=15)
g.room('K22', "North Archers' Post", rect3(11, 15.5, 13, 17.5), 'flagstone', page=pg('K22'), ceilingFt=15)
g.room('K11', "South Archers' Post", rect3(10.5, 24, 12, 26), 'flagstone', page=pg('K11'), ceilingFt=15)
g.room('K83', 'Spiral Stair', oct3(14.5, 18.5, 1), 'flagstone', page=pg('K83'), ceilingFt=50)
g.room('K8-s', 'Grand Staircase', rect3(15.5, 12.5, 17, 19.5), 'flagstone', page=pg('K8'), ceilingFt=40)
g.room('K7', 'Entry', rect3(13, 20, 15, 22), 'flagstone', page=pg('K7'), ceilingFt=20)
g.room('K8', 'Great Entry', rect3(15, 19.5, 19, 22.5), 'flagstone', page=pg('K8'), ceilingFt=40)
g.room('K14', 'Turret Access Hall', rect3(19, 20, 26, 22), 'flagstone', page=pg('K14'), ceilingFt=15)
g.room('K16', 'North Chapel Access', rect3(24.5, 18, 26, 20), 'flagstone', page=pg('K16'), ceilingFt=15)
g.room('K17', 'South Chapel Access', rect3(24.5, 22, 26, 24), 'flagstone', page=pg('K17'), ceilingFt=15)
g.room('K15', 'Chapel', poly3([(27, 16), (30, 16), (31, 17), (31, 26), (30, 27), (27, 27), (26, 26), (26, 17)]), 'flagstone', page=pg('K15'), ceilingFt=90)
g.room('K9', "Guests' Hall", rect3(15, 22.5, 18, 25.5), 'flagstone', page=pg('K9'), ceilingFt=20)
g.room('K9-h', 'Arched Hallway', rect3(18, 23.5, 19.5, 24.5), 'flagstone', page=pg('K9'), ceilingFt=15)
g.room('K10', 'Dining Hall', rect3(12, 22.5, 15, 25), 'flagstone', page=pg('K10'), ceilingFt=20)
g.room('K31a', 'Elevator Shaft', rect3(19.5, 22.5, 21.5, 23.5), 'flagstone', page=pg('K31a'), ceilingFt=170)
g.room('K18', 'High Tower Staircase', oct3(22.5, 23, 1.5), 'flagstone', page=pg('K18'), ceilingFt=300)
g.room('K21', 'South Tower Stair', oct3(20, 26, 1.5), 'flagstone', page=pg('K21'), ceilingFt=140)
g.room('K64', "Guards' Stair", rect3(16.5, 26, 18, 27.5), 'flagstone', page=pg('K64'), ceilingFt=90)
g.room('K20', 'Heart of Sorrow', oct3(19, 17.5, 1.75), 'flagstone', page=pg('K20'), ceilingFt=200)
g.room('K29', 'Creaky Landing', rect3(21.5, 18.5, 24.5, 20), 'plank', page=pg('K29'), ceilingFt=50)
g.room('K23', "Servants' Entrance", rect3(22.5, 15, 25, 17.5), 'flagstone', page=pg('K23'), ceilingFt=15)
g.room('K24', "Servants' Quarters", rect3(21.5, 13, 25, 15), 'flagstone', page=pg('K24'), ceilingFt=15)

# doors and openings (whole 5-ft cells)
D = lambda a, b, **kw: g.door(m3(*a), m3(*b), **kw)
O = lambda a, b: g.opening(m3(*a), m3(*b))
D((13, 20.5), (13, 21.5), id='K7-outer', double=True, open=True)        # courtyard → entry
D((15, 20.5), (15, 21.5), id='K7-inner', double=True)                   # entry → great entry
O((15.5, 19.5), (17, 19.5))                                             # great entry → grand stair
D((19, 20.5), (19, 21.5), id='K8-east', double=True)                    # great entry → turret access hall (bronze)
D((16.5, 22.5), (17.5, 22.5), id='K8-south', double=True)               # great entry → guests' hall (bronze)
D((15, 23.5), (15, 24.5), id='K10-doors', double=True, open=True)       # guests' hall → dining hall
O((18, 23.5), (18, 24.5)); O((19.5, 23.5), (19.5, 24.5))                # hallway to the south tower stair
D((26, 20.5), (26, 21.5), id='K15-west', double=True)                   # hall → chapel
O((26, 18.5), (26, 19.5)); O((26, 22.5), (26, 23.5))                    # chapel accesses → chapel
O((24.5, 18.5), (24.5, 19.5)); O((24.5, 22.5), (24.5, 23.5))            # accesses → hall side
O((25, 20), (25.5, 20)); O((25, 22), (25.5, 22))                        # accesses open on the hall
O((24.5, 19), (24.5, 20))                                               # north access → creaky landing
D((12, 16), (12, 17), id='K22-door'); D((12, 24.5), (12, 25.5), id='K11-door')
O((12, 15), (12, 15.5)); O((15, 15), (15, 15.5))                        # north hall to the turret and the stair head
O((10.5, 17), (10.5, 18)); O((10.5, 23), (10.5, 24))
O((12, 26), (12, 27)); O((16.5, 26.5), (16.5, 27.5))                    # south hall to the turret and the guards' stair
D((22.5, 16), (22.5, 17), id='K23-west'); D((25, 16), (25, 17), id='K23-courtyard', locked=False)
D((23, 15), (24, 15), id='K23-north', open=True)
O((21.5, 19), (21.5, 20))                                               # landing stair → tower hall

# fixtures
for i, x in enumerate((15.5, 16.5, 17.5, 18.5)):
    g.prop(f'col-k8-{i}n', 'column', m3(x, 20), 'K8'); g.prop(f'col-k8-{i}s', 'column', m3(x, 22), 'K8')
g.creature('dragons', 'statue', m3(14, 21), 'K7', 'Four stone dragons on the vaulted ceiling (red dragon wyrmlings when roused)', size='medium')
g.note('K8-gargoyles', m3(17, 21), 'K8', 'Eight gargoyles squat on the rim of the dome; they attack anyone who returns after leaving.')
g.prop('grand-stair', 'stairs-straight', m3(16.25, 16), 'K8', dims={'w': 15, 'rise': 30, 'fromZ': 2 * 19.5 - 6, 'toZ': 2 * 12.5 - 6})
g.prop('k83-stair', 'spiral-stair', m3(14.5, 18.5), 'K83', dims={'r': 8, 'rise': 50})
g.prop('k21-stair', 'spiral-stair', m3(20, 26), 'K21', dims={'r': 13, 'rise': 50})
g.prop('k18-stair', 'spiral-stair', m3(22.5, 23), 'K18', dims={'r': 13, 'rise': 50})
g.prop('k20-stair', 'spiral-stair', m3(19, 17.5), 'K20', dims={'r': 16, 'rise': 50})
g.prop('k20a-stair', 'stairs-straight', m3(19, 17.5), 'K20a', dims={'w': 5, 'rise': 0.1, 'fromZ': 2 * 18 - 6, 'toZ': 2 * 17 - 6})
g.prop('k64-stair', 'stairs-straight', m3(17.25, 26.75), 'K64', dims={'w': 5, 'rise': 10, 'fromX': 2 * 16.5 - 2, 'toX': 2 * 18 - 2})
g.prop('k29-stair', 'stairs-straight', m3(23, 19.25), 'K29', dims={'w': 10, 'rise': 50, 'fromX': 2 * 24.5 - 2, 'toX': 2 * 21.5 - 2})
g.prop('k23-stair', 'stairs-straight', m3(23.75, 17), 'K23', dims={'w': 5, 'rise': 0.1, 'fromX': 2 * 23 - 2, 'toX': 2 * 24.5 - 2})
g.prop('k24-stair', 'stairs-straight', m3(23, 13.25), 'K24', dims={'w': 5, 'rise': 15, 'fromX': 2 * 21.5 - 2, 'toX': 2 * 25 - 2})
g.prop('table-k10', 'table', m3(13.5, 23.75), 'K10', dims={'w': 20, 'd': 6})
g.prop('organ', 'harpsichord', m3(12.3, 23.75), 'K10', rotY=90)
g.note('K10-note', m3(13.5, 24.5), 'K10', 'The feast is an illusion; the organ plays itself. Strahd may greet the party here.')
g.prop('armor-k9', 'armor-suit', m3(18.2, 25.2), 'K9')
g.prop('altar', 'altar', m3(30, 21.5), 'K15'); g.prop('dais-k15', 'dais', m3(30, 21.5), 'K15', dims={'w': 15, 'h': 2, 'steps': 2})
g.hidden('mace', 'niche', m3(29.5, 22), 'K15', 'A black mace on the floor by the altar; a cloaked figure draped over the altar')
g.note('K15-balcony', m3(26.5, 21.5), 'K15', 'Balcony along the west wall 50 ft up (K28), two thrones at its centre.')
for i, (x, y) in enumerate([(25, 18.25), (25, 19.75), (25, 22.25), (25, 23.75)]):
    g.prop(f'knight-{i}', 'armor-suit', m3(x, y), 'K16' if y < 21 else 'K17')
for i, y in enumerate((20.4, 21.6)):
    for j, x in enumerate((20, 21, 22, 23, 24, 25)):
        g.prop(f'knight-hall-{i}-{j}', 'statue', m3(x, y), 'K14')
g.prop('skel-a', 'skeleton', m3(23.2, 17.2), 'K23'); g.prop('skel-b', 'skeleton', m3(24.3, 17.2), 'K23')
g.prop('elev-note', 'trapdoor', m3(20, 23), 'K31a')
g.note('K31a-note', m3(20.5, 23), 'K31a', 'Elevator shaft, 170 ft: from K61 (-40 ft) past K31 (+50) and K31b (+90) to K47 (+130).')
g.note('K18-note', m3(22.5, 24.5), 'K18', 'Stair wraps the shaft (K18a) 300 ft from the catacombs (K84) to the peak (K59). A new wall blocks it 10 ft below the landing west of K17.')
for i, (x, y) in enumerate([(14.5, 20.3), (14.5, 21.7)]): g.prop(f'sconce-{i}', 'brazier', m3(x, y), 'K7')
g.light('K8-torches', m3(17, 21), 'torch', 20, 40, y=10); g.light('K10-glow', m3(13.5, 23.75), 'candle', 10, 20, y=4)
g.light('K14-webs', m3(22.5, 21), 'torch', 20, 40, y=8); g.light('K15-shaft', m3(30, 21.5), 'daylight', 10, 20, y=20)
g.light('K12n-slits', m3(10.5, 15), 'daylight', 5, 10, y=8); g.light('K12s-slits', m3(10.5, 26.5), 'daylight', 5, 10, y=8)
g.light('K23-window', m3(24.5, 16), 'daylight', 5, 10, y=6); g.light('K24-window', m3(24.5, 13.5), 'daylight', 5, 10, y=6)
cobwebs(g, rect3(19, 20, 26, 22), 'K14', y=10, n=4); cobwebs(g, rect3(15, 19.5, 19, 22.5), 'K8', y=14, n=4)

# ================================================================== frames for the other plates (registered on the towers)
def m4(x, y): return m3(x, y + 2)          # court of the count (map 4)
def m5(x, y): return m3(x - 1.5, y - 1)    # rooms of weeping (map 5)
def m11(x, y): return m3(x + 3.5, y + 5.5) # larders (map 11)
def m12(x, y): return m3(x + 1, y - 2.5)   # dungeon and catacombs (map 12)
def R(f, x0, y0, x1, y1): return [f(x0, y0), f(x1, y0), f(x1, y1), f(x0, y1)]
def OCT(f, x, y, r10): cx, cy = f(x, y); return oct_(cx, cy, r10 * 2)
def Dr(lv, f, a, b, **kw): lv.door(f(*a), f(*b), **kw)
def Op(lv, f, a, b): lv.opening(f(*a), f(*b))
TOWER = {  # the towers rise through every level: (map-3 cell centre, radius in 10-ft cells)
  'K20': ((19, 17.5), 1.75), 'K18': ((22.5, 23), 1.5), 'K21': ((20, 26.5), 2), 'K83': ((14.5, 18.5), 1), 'K64': None,
}
def towers(lv, which, ceil, page_of='K18'):
    """The stair towers that pass through a level, as rooms with their spiral stairs."""
    for k in which:
        (cx, cy), r = TOWER[k]
        lv.room(k, {'K20': 'Heart of Sorrow', 'K18': 'High Tower Staircase', 'K21': 'South Tower Stair', 'K83': 'Spiral Stair'}[k], oct3(cx, cy, r), 'flagstone', page=pg(k), ceilingFt=ceil)
        lv.prop(f'{k}-stair', 'spiral-stair', m3(cx, cy), k, dims={'r': r * 8, 'rise': ceil if k != 'K18' else 40})
def turrets(lv, ceil):
    """The west wing repeats on every floor of the keep: two turrets, the halls between them, the archers' posts."""
    lv.room('K12-n', 'Turret Post (north-west)', oct3(10.5, 15, 1.5), 'flagstone', page=pg('K12'), ceilingFt=ceil)
    lv.room('K12-s', 'Turret Post (south-west)', oct3(10.5, 26.5, 1.5), 'flagstone', page=pg('K12'), ceilingFt=ceil)
    lv.room('K13-n', 'Turret Post Access Hall (north)', rect3(12, 14.5, 15, 15.5), 'flagstone', page=pg('K13'), ceilingFt=ceil)
    lv.room('K13-w', 'Turret Post Access Hall (west)', rect3(9.5, 16.5, 10.5, 24), 'flagstone', page=pg('K13'), ceilingFt=ceil)
    lv.room('K13-s', 'Turret Post Access Hall (south)', rect3(12, 26, 16.5, 27), 'flagstone', page=pg('K13'), ceilingFt=ceil)
    lv.room('K22', "North Archers' Post", rect3(11, 15.5, 13, 17.5), 'flagstone', page=pg('K22'), ceilingFt=ceil)
    lv.room('K11', "South Archers' Post", rect3(10.5, 24, 12, 26), 'flagstone', page=pg('K11'), ceilingFt=ceil)
    lv.room('K64', "Guards' Stair", rect3(16.5, 26, 18, 27.5), 'flagstone', page=pg('K64'), ceilingFt=ceil)
    Dr(lv, m3, (12, 16), (12, 17), id=f'{lv.id}-K22-door'); Dr(lv, m3, (12, 24.5), (12, 25.5), id=f'{lv.id}-K11-door')
    Op(lv, m3, (12, 15), (12, 15.5)); Op(lv, m3, (10.5, 17), (10.5, 18)); Op(lv, m3, (10.5, 23), (10.5, 24)); Op(lv, m3, (12, 26), (12, 27)); Op(lv, m3, (16.5, 26.5), (16.5, 27.5))
    lv.prop('k64-stair', 'stairs-straight', m3(17.25, 26.75), 'K64', dims={'w': 5, 'rise': 10, 'fromX': 2 * 16.5 - 2, 'toX': 2 * 18 - 2})
    lv.light('K12n-slits', m3(10.5, 15), 'daylight', 5, 10, y=8); lv.light('K12s-slits', m3(10.5, 26.5), 'daylight', 5, 10, y=8)

# ================================================================== LANDING (+30): the grand landing K19
L = Level('landing', 'Grand landing (+30 ft)', 30, 20, ambient='interior-dim', interior='ashlar', exterior='ashlar', north='-z')
L.room('K19', 'Grand Landing', rect3(15, 12, 19, 14), 'flagstone', page=pg('K19'), ceilingFt=20)
L.room('K8-s', 'Grand Staircase (head)', rect3(15.5, 14, 17, 15.5), 'flagstone', page=pg('K8'), ceilingFt=20)
Op(L, m3, (15.5, 14), (17, 14))
L.prop('armor-k19-w', 'armor-suit', m3(15.4, 13.6), 'K19'); L.prop('armor-k19-e', 'armor-suit', m3(18.6, 13.6), 'K19')
L.hidden('plate-w', 'pressure-plate', m3(15.6, 13.3), 'K19', 'Pressure plate: the west suit of armour animates'); L.hidden('plate-e', 'pressure-plate', m3(18.4, 13.3), 'K19', 'Pressure plate: the east suit of armour animates')
L.prop('k19-stair-w', 'stairs-straight', m3(15.5, 14), 'K19', dims={'w': 5, 'rise': 20, 'fromZ': 2 * 14 - 6, 'toZ': 2 * 15.5 - 6})
L.prop('k19-stair-e', 'stairs-straight', m3(18.5, 14), 'K19', dims={'w': 5, 'rise': 20, 'fromZ': 2 * 14 - 6, 'toZ': 2 * 15.5 - 6})
L.light('K19-torches', m3(17, 13), 'torch', 10, 20, y=8)

# ================================================================== COURT OF THE COUNT (+50, map 4)
c = Level('court', 'Court of the Count (+50 ft)', 50, 40, ambient='interior-dim', interior='ashlar', exterior='ashlar', north='-z')
turrets(c, 40); towers(c, ['K20', 'K18', 'K21', 'K83'], 40)
c.room('K25', 'Audience Hall', rect3(12, 15.5, 17, 22.5), 'flagstone', page=pg('K25'), ceilingFt=40)
c.room('K26', "Guards' Post", rect3(17, 17.5, 18.5, 19.5), 'flagstone', page=pg('K26'), ceilingFt=15)
c.room('K27', "King's Hall", rect3(17, 19.5, 24.5, 21.5), 'flagstone', page=pg('K27'), ceilingFt=20)
c.room('K28', "King's Balcony", [m3(24.5, 18.5), m3(26, 18.5), m3(26, 17), m3(27.5, 17), m3(27.5, 26), m3(26, 26), m3(26, 20.5), m3(24.5, 20.5)], 'flagstone', page=pg('K28'), ceilingFt=40)
c.room('K30', "King's Accountant", rect3(16, 23, 18.5, 25.5), 'plank', page=pg('K30'), ceilingFt=15)
c.room('K31', 'Trapworks', rect3(19.5, 21, 21.5, 22.5), 'flagstone', page=pg('K31'), ceilingFt=15)
c.room('K31a', 'Elevator Shaft', rect3(19.5, 22.5, 21.5, 23.5), 'flagstone', page=pg('K31a'), ceilingFt=80)
c.room('K32', 'Maid in Hell', rect3(13, 13, 16, 15.5), 'plank', page=pg('K32'), ceilingFt=15)
c.room('K33', "King's Apartment Stair", rect3(16, 13, 17.5, 15.5), 'plank', page=pg('K33'), ceilingFt=40)
c.room('K34', "Servants' Upper Floor", rect3(22.5, 13, 25, 15.5), 'plank', page=pg('K34'), ceilingFt=15)
Dr(c, m3, (17, 18.5), (17, 19.5), id='K25-east', double=True); Dr(c, m3, (17, 21), (17, 22), id='K25-south-door')
c.secret(m3(14, 22.5), m3(15, 22.5), 'K25-K13', 'A secret door in the south wall of the audience hall', 'K25')
c.secret(m3(16, 14), m3(16, 15), 'K33-west', 'A secret door into the apartment stair', 'K33'); c.secret(m3(17, 15.5), m3(17, 16.5), 'K33-south', 'A secret door at the foot of the apartment stair', 'K33', extra=True)
Op(c, m3, (18.5, 18.5), (18.5, 19.5)); Op(c, m3, (24.5, 19.5), (24.5, 20.5)); Dr(c, m3, (26, 19.5), (26, 20.5), id='K28-doors', double=True)
Dr(c, m3, (16, 24), (16, 25), id='K30-west'); Dr(c, m3, (18.5, 24), (18.5, 25), id='K30-east')
Dr(c, m3, (20, 21), (21, 21), id='K31-door'); Op(c, m3, (20, 22.5), (21, 22.5))
Dr(c, m3, (23, 15.5), (24, 15.5), id='K34-south'); c.secret(m3(22.5, 15.5), m3(23, 15.5), 'K34-closet', 'Behind the west mirror: a closet with a ladder up 20 ft to a secret door in the tower stair (K20)', 'K34', extra=True)
Op(c, m3, (15, 15), (15, 15.5)); Op(c, m3, (21, 18.5), (21, 19.5))
c.prop('throne-k25', 'chair', m3(14.5, 22), 'K25', rotY=180); c.prop('dais-k25', 'dais', m3(14.5, 22), 'K25', dims={'w': 10, 'h': 2, 'steps': 2})
c.note('K25-window', m3(12.2, 19), 'K25', 'A tall west window of broken glass and iron lattice looks over the courtyard; cobwebs hide the ceiling.')
c.prop('cobweb-k25', 'cobweb', m3(14.5, 17), 'K25', dims={'s': 6, 'y': 20})
c.prop('throne-k28-a', 'chair', m3(26.7, 21), 'K28', rotY=90); c.prop('throne-k28-b', 'chair', m3(26.7, 22), 'K28', rotY=90)
c.creature('zombies-k28', 'skeleton', m3(26.7, 21.5), 'K28', 'Two Strahd zombies slumped on the thrones', size='medium')
c.railing(m3(27.5, 17), m3(27.5, 26))
c.prop('desk-k30', 'desk', m3(17.25, 24.25), 'K30'); c.creature('lief', 'adventurer', m3(17.25, 24.6), 'K30', 'Lief Lipsiege, the chained accountant (commoner)')
c.hidden('ledger', 'bookshelf', m3(16.3, 23.3), 'K30', 'A bloodstained ledger (DC 15 Investigation, 10 minutes)')
c.prop('lever-k31', 'wheel', m3(19.7, 21.75), 'K31', rotY=90); c.note('K31-note', m3(20.5, 21.75), 'K31', 'The elevator trap lever: up raises the car from K61 to K47; a counterweight drops in the shaft\'s east half.')
c.prop('wardrobe-k34', 'wardrobe', m3(23.75, 15.2), 'K34'); c.hidden('mirror-k34', 'niche', m3(22.8, 15.2), 'K34', 'A full-length mirror; the secret door is behind it')
c.prop('k34-stair', 'stairs-straight', m3(23.75, 13.25), 'K34', dims={'w': 5, 'rise': 0.1, 'fromX': 2 * 25 - 2, 'toX': 2 * 22.5 - 2})
c.prop('k33-stair', 'stairs-straight', m3(16.75, 13.5), 'K33', dims={'w': 5, 'rise': 40, 'fromZ': 2 * 15.5 - 6, 'toZ': 2 * 13 - 6})
c.prop('k29-top', 'stairs-straight', m3(25.25, 19.5), 'K28', dims={'w': 5, 'rise': 0.1, 'fromX': 2 * 24.5 - 2, 'toX': 2 * 26 - 2})
c.creature('k32-maid', 'adventurer', m3(14.5, 14.25), 'K32', "Helga Ruvak, the 'maid' (vampire spawn)")
c.prop('bed-k32', 'bed', m3(13.6, 13.6), 'K32'); c.light('K25-glow', m3(13, 19), 'daylight', 10, 20, y=12); c.light('K27-torch', m3(20.5, 20.5), 'torch', 10, 20, y=8)
cobwebs(c, rect3(17, 19.5, 24.5, 21.5), 'K27', y=14, n=4)

# ================================================================== ROOMS OF WEEPING (+90, map 5)
w = Level('weeping', 'Rooms of Weeping (+90 ft)', 90, 40, ambient='interior-dim', interior='paneling', exterior='ashlar', north='-z')
towers(w, ['K20', 'K18', 'K21', 'K83'], 40)
w.room('K45', 'Hall of Heroes', R(m5, 14, 16, 18, 19), 'flagstone', page=pg('K45'), ceilingFt=20)
w.room('K37', 'Study', R(m5, 17, 20, 20, 22), 'plank', page=pg('K37'), ceilingFt=15)
w.room('K38', 'False Treasury', R(m5, 20.5, 20.5, 22, 22.5), 'flagstone', page=pg('K38'), ceilingFt=15)
w.room('K39', 'Hall of Webs', R(m5, 22, 21, 26, 22), 'flagstone', page=pg('K39'), ceilingFt=20)
w.room('K40', 'Belfry', R(m5, 26, 21, 28, 23), 'flagstone', page=pg('K40'), ceilingFt=50)
w.room('K41', 'Treasury', R(m5, 24.5, 18.5, 27, 20.5), 'flagstone', page=pg('K41'), ceilingFt=40)
w.room('K42', "King's Bedchamber", R(m5, 11, 20, 15.5, 23), 'plank', page=pg('K42'), ceilingFt=15)
w.room('K43', 'Bath Chamber', R(m5, 12, 23.5, 15, 26), 'flagstone', page=pg('K43'), ceilingFt=15)
w.room('K44', 'Closet', R(m5, 12, 26, 16, 28), 'plank', page=pg('K44'), ceilingFt=15)
w.room('K36', 'Dining Hall of the Count', R(m5, 15.5, 25, 19, 28), 'plank', page=pg('K36'), ceilingFt=15)
w.room('K35', 'Guardian Vermin', R(m5, 18, 24, 20.5, 25), 'flagstone', page=pg('K35'), ceilingFt=15)
w.room('K31b', 'Shaft Access', rect3(19.5, 22.5, 21.5, 23.5), 'flagstone', page=pg('K31a'), ceilingFt=40)
w.room('K46-w', 'Parapets (west)', R(m5, 9.5, 14.5, 11, 28.5), 'flagstone', page=pg('K46'), ceilingFt=10)
w.room('K46-n', 'Parapets (north)', R(m5, 11, 14.5, 29, 16), 'flagstone', page=pg('K46'), ceilingFt=10)
w.room('K46-s', 'Parapets (south)', R(m5, 11, 28.5, 22, 29.5), 'flagstone', page=pg('K46'), ceilingFt=10)
w.room('K46-e', 'Parapets (east)', R(m5, 28, 16, 29.5, 23), 'flagstone', page=pg('K46'), ceilingFt=10)
w.room('K64', "Guards' Stair (head)", rect3(16.5, 26, 18, 27.5), 'flagstone', page=pg('K64'), ceilingFt=10)
Dr(w, m5, (17, 20.5), (17, 21.5), id='K37-west', double=True); Dr(w, m5, (17.5, 20), (18.5, 20), id='K37-north-a'); Dr(w, m5, (19, 20), (20, 20), id='K37-north-b'); Dr(w, m5, (18, 22), (19, 22), id='K37-south')
w.secret(m5(20, 21), m5(20, 22), 'fireplace', 'The back wall of the fireplace swings open when the poker is lifted', 'K37')
w.prop('fireplace-k37', 'fireplace', m5(19.7, 21.5), 'K37', rotY=-90); w.prop('desk-k37', 'desk', m5(18, 21), 'K37'); w.prop('books-k37', 'bookshelf', m5(17.3, 20.3), 'K37')
w.secret(m5(22, 21.5), m5(22, 22), 'webs-west', 'A secret door at the west end of the hall of webs (one-way from the false treasury)', 'K39')
w.secret(m5(22.5, 22), m5(23, 22), 'webs-south', 'A narrow secret door behind webs at the west end of the south wall', 'K39', extra=True)
Dr(w, m5, (26, 21.5), (26, 22.5), id='K40-doors', double=True); w.secret(m5(26, 21), m5(27, 21), 'belfry-north', 'Behind thick webs: a secret door into the treasury', 'K40')
w.prop('chest-k38', 'chest', m5(21.25, 21.5), 'K38'); w.note('K38-gas', m5(21.25, 22), 'K38', 'Opening the chest releases sleeping gas; the witches drag sleepers to K50.')
w.prop('bell-rope', 'chains', m5(27, 22), 'K40', dims={'y': 50, 'len': 48}); w.note('K40-bell', m5(27, 22.5), 'K40', 'Ringing the bell wakes the castle.')
w.prop('vault-tower', 'temple', m5(25.75, 19.5), 'K41', dims={'w': 20, 'd': 20, 'h': 30}); w.note('K41-note', m5(25.75, 20.2), 'K41', 'A square tower 20 ft on a side inside a pitch-coated dome of painted stars; adamantine door north, trapdoor on its roof. Only Strahd opens them.')
Dr(w, m5, (15.5, 21), (15.5, 22), id='K42-east', double=True); Dr(w, m5, (13, 23), (14, 23), id='K42-south', double=True)
w.secret(m5(12, 20), m5(13, 20), 'bed-north', 'A secret door beside the bed opens on a dusty hall', 'K42')
w.prop('bed-k42', 'bed', m5(13, 20.6), 'K42', dims={'w': 8, 'd': 8}); w.prop('window-k42', 'bricked-window', m5(11.1, 21.5), 'K42', rotY=90)
Op(w, m5, (12.5, 26), (13, 26)); Op(w, m5, (14, 26), (14.5, 26))
w.prop('tub', 'trough', m5(13.5, 24.75), 'K43'); w.creature('tub-thing', 'skeleton', m5(13.5, 24.75), 'K43', 'A blood-drenched creature in the tub (Strahd zombie? see text)')
Dr(w, m5, (16, 26.5), (16, 27.5), id='K36-west'); Dr(w, m5, (17, 25), (18, 25), id='K36-north'); Dr(w, m5, (19, 26.5), (19, 27.5), id='K35-door', locked=True)
w.prop('table-k36', 'table', m5(17.25, 26.5), 'K36', dims={'w': 12, 'd': 5}); w.prop('cake', 'dais', m5(17.25, 26.5), 'K36', dims={'w': 3, 'h': 2, 'steps': 1}); w.prop('harp-k36', 'harp', m5(15.8, 27.7), 'K36')
w.note('K36-note', m5(17.25, 27.3), 'K36', 'The wedding cake: the groom figurine (DC 10 Perception on the floor). The harp summons Pidlwick\'s ghost (DC 15 Performance).')
w.creature('rats-k35-n', 'swarm', m5(19.2, 24.1), 'K35', 'Two swarms of rats stacked into a man-shape'); w.creature('rats-k35-s', 'swarm', m5(19.2, 24.9), 'K35', 'Two swarms of rats stacked into a man-shape')
Op(w, m5, (18, 24), (18, 25)); Op(w, m5, (20.5, 24), (20.5, 25))
Op(w, m5, (18, 17), (18, 18)); Op(w, m5, (14, 17), (14, 18))
for i in range(6):
    w.prop(f'hero-n-{i}', 'statue', m5(14.5 + i * 0.6, 16.3), 'K45'); w.prop(f'hero-s-{i}', 'statue', m5(14.5 + i * 0.6, 18.7), 'K45')
w.prop('rubble-k45', 'rubble', m5(16, 17.5), 'K45'); w.note('K45-roof', m5(16, 17.5), 'K45', 'The ceiling has fallen in: lightning lights the statues. Stairs west down 40 ft to K33; archway east to the tower landing (K20).')
w.prop('k33-top', 'stairs-straight', m5(14, 17.5), 'K45', dims={'w': 5, 'rise': 0.1, 'fromX': 2 * 12.5 - 2 - 2 * 1.5, 'toX': 2 * 14 - 2 - 2 * 1.5})
Op(w, m5, (21.5, 21.5), (21.5, 22.5)); Op(w, m5, (21.5, 23.5), (21.5, 24))
w.prop('trap-k31b', 'trapdoor', m3(20.5, 23), 'K31b'); w.note('K31b-note', m3(20.5, 23.3), 'K31b', 'Elevator landing: the car stops here; a stone trapdoor 40 ft above opens into K47.')
for key, pos in (('K46-w', (10.25, 21)), ('K46-n', (20, 15.25)), ('K46-s', (16, 29)), ('K46-e', (28.75, 19.5))):
    w.light(f'{key}-sky', m5(*pos), 'daylight', 10, 20, y=4)
w.note('K46-note', m5(10.25, 20), 'K46', 'Battlemented walkways; windows into the keep are shut and locked but easily broken. Walkways run to the outer walls north, south and east.')

# ================================================================== SPIRES (+130, map 6) and the south tower (+150, map 7)
sp = Level('spires', 'Spires of Ravenloft (+130 ft)', 130, 20, ambient='storm', interior='paneling', exterior='ashlar', north='-z')
towers(sp, ['K20', 'K18'], 20)
sp.room('K47', 'Portrait of Strahd', rect3(17.5, 22.5, 19.5, 24.5), 'plank', page=pg('K47'), ceilingFt=10)
sp.room('K31a', 'Elevator Shaft (top)', rect3(19.5, 22.5, 21.5, 23.5), 'flagstone', page=pg('K31a'), ceilingFt=10)
sp.room('K48', 'Offstair', oct_(*m3(21.25, 25.5), 1.5), 'flagstone', page=pg('K48'), ceilingFt=60)
sp.room('K49', 'Lounge', [m3(17.5, 24.5), m3(20, 24.5), m3(20, 28.5), m3(18.5, 28.5), m3(17.5, 27.5)], 'plank', page=pg('K49'), ceilingFt=15)
sp.room('K50', 'Guest Room', rect3(20, 26.5, 22.5, 28.5), 'plank', page=pg('K50'), ceilingFt=15)
sp.room('K51', 'Closet', rect3(19, 28.5, 21, 29.5), 'plank', page=pg('K51'), ceilingFt=10)
sp.room('K53-w', 'Rooftop (west wing)', rect3(9, 13.5, 13, 28), 'flagstone', page=pg('K53'), ceilingFt=10)
sp.room('K53-n', 'Rooftop (north)', rect3(13, 13.5, 26, 15.5), 'flagstone', page=pg('K53'), ceilingFt=10)
sp.room('K53-s', 'Rooftop (south)', rect3(13, 22.5, 17.5, 28), 'flagstone', page=pg('K53'), ceilingFt=10)
Dr(sp, m3, (17.5, 23), (17.5, 24), id='K47-west-door'); Op(sp, m3, (19.5, 23), (19.5, 23.5)); Op(sp, m3, (18, 24.5), (19.5, 24.5))
Dr(sp, m3, (20, 25), (20, 26), id='K49-K48'); Dr(sp, m3, (20, 27), (20, 28), id='K49-K50'); Dr(sp, m3, (20, 28.5), (21, 28.5), id='K51-door')
sp.prop('trap-k47', 'trapdoor', m3(18, 23.4), 'K47'); sp.hidden('portrait', 'niche', m3(18.5, 22.6), 'K47', 'A framed portrait of a handsome, serene man: Strahd')
sp.prop('rug-k47', 'rug', m3(18.5, 24), 'K47'); sp.note('K47-note', m3(18.5, 24.3), 'K47', 'Landing 10 × 20 ft; the spiral stair (K21) continues up from the north end of the east wall; the elevator trapdoor is before the west door.')
sp.prop('books-k49', 'bookshelf', m3(19.8, 26.5), 'K49', rotY=-90); sp.creature('escher', 'adventurer', m3(18.5, 26), 'K49', 'Escher, Strahd\'s consort (vampire spawn)')
sp.prop('bed-k50', 'bed', m3(21.5, 27), 'K50'); sp.note('K50-note', m3(21.5, 27.8), 'K50', 'Resting here at night brings 1d4 witches from K56.')
sp.hidden('hook-k51', 'niche', m3(20, 29.3), 'K51', 'A black cloak on a hook: pulling the hook opens the secret trapdoor in the ceiling (DC 13 Perception to find)')
sp.prop('chimney-k52', 'chimney', m3(17, 19.5), 'K52', dims={'h': 30})
sp.note('K52-note', m3(17, 20), 'K52', 'Smokestack 5 ft across, 30 ft above the roof peak; leads 60 ft down to the study fireplace (3d6 fire).')
sp.prop('roof-w', 'roof-gable', m3(11, 20.75), 'K53-w', dims={'w': 40, 'd': 145, 'h': 18}); sp.prop('roof-n', 'roof-gable', m3(19.5, 14.5), 'K53-n', rotY=90, dims={'w': 20, 'd': 130, 'h': 12}); sp.prop('roof-s', 'roof-gable', m3(15.25, 25.25), 'K53-s', rotY=90, dims={'w': 55, 'd': 45, 'h': 16})
sp.note('K53-note', m3(11, 15), 'K53', 'Sloping tiles 130 ft above the courtyard: DC 15 Acrobatics to cross; a fall by 5+ drops 40 ft to the parapets.')
sp.prop('gargoyle-a', 'statue', m3(9.3, 13.8), 'K53-w'); sp.prop('gargoyle-b', 'statue', m3(9.3, 27.7), 'K53-w'); sp.prop('gargoyle-c', 'statue', m3(25.7, 13.8), 'K53-n')
sp.light('K49-lightning', m3(18.5, 26.5), 'daylight', 10, 20, y=6)

st = Level('south-tower', 'South tower, witches\' floor (+150 ft)', 150, 40, ambient='interior-dim', interior='paneling', exterior='ashlar', north='-z')
towers(st, ['K20', 'K18'], 40)
st.room('K55', 'Element Room', [m3(17.5, 24.5), m3(20.5, 24.5), m3(20.5, 28.5), m3(18.5, 28.5), m3(17.5, 27.5)], 'plank', page=pg('K55'), ceilingFt=15)
st.room('K54', 'Familiar Room', rect3(20.5, 24.5, 22.5, 26.5), 'plank', page=pg('K54'), ceilingFt=8)
st.room('K56', 'Cauldron', rect3(20.5, 26.5, 22.5, 28.5), 'plank', page=pg('K56'), ceilingFt=15)
st.room('K48', 'Offstair', oct_(*m3(21.25, 25.5), 0.75), 'flagstone', page=pg('K48'), ceilingFt=40)
Dr(st, m3, (20.5, 25), (20.5, 26), id='K54-door'); Dr(st, m3, (20.5, 27), (20.5, 28), id='K56-door'); Op(st, m3, (20.5, 24.5), (20.5, 25))
st.prop('k48-stair', 'spiral-stair', m3(21.25, 25.5), 'K48', dims={'r': 6, 'rise': 40})
st.creature('cats', 'wolf', m3(21.5, 25.5), 'K54', 'Three cats, the witches\' familiars', size='tiny')
st.prop('cauldron', 'brazier', m3(21.5, 27.5), 'K56'); st.creature('witches', 'adventurer', m3(21, 27), 'K56', 'Seven Barovian witches around the cauldron (fewer if some were met in K50)')
st.note('K55-note', m3(19, 26.5), 'K55', 'Boot prints in the dust lead from the north-east corner to the easternmost door; windows open on the tower wall (vampire spawn may notice).')
st.hidden('trap-k51-top', 'trapdoor', m3(20, 28.6), 'K55', 'The secret trapdoor from the closet (K51) below')

# ================================================================== TOWER TOPS (maps 8–10)
tr = Level('tower-roofs', 'Tower roofs and the bridge (+190 ft)', 190, 50, ambient='storm', interior='ashlar', exterior='ashlar', north='-z')
towers(tr, ['K20', 'K18'], 50)
tr.room('K57', 'Tower Roof', oct3(20, 26.5, 2), 'flagstone', page=pg('K57'), ceilingFt=0.1)
tr.room('K58', 'Bridge', rect3(19.5, 19.25, 20.5, 24.5), 'flagstone', page=pg('K58'), ceilingFt=0.1)
Op(tr, m3, (19.5, 24.5), (20.5, 24.5)); Op(tr, m3, (19.5, 19.25), (20.5, 19.25))
tr.prop('k48-top', 'spiral-stair', m3(21.25, 25.5), 'K57', dims={'r': 6, 'rise': 0.1}); tr.railing(m3(20, 24.5), m3(21.5, 25))
tr.note('K57-note', m3(20, 26.5), 'K57', 'Open roof: the courtyard 190 ft below, the keep\'s roof 80 ft below; a railed spiral stair descends. The slender bridge north has no railing.')
tr.note('K58-note', m3(20, 22), 'K58', 'DC 10 Dexterity save when damaged on the bridge or fall 60 ft to the keep roof.')
tr.note('K20-heart', m3(19, 17.5), 'K20', 'The landing beneath the Heart of Sorrow: the crystal heart hangs above; the stair wraps around it to K60.')
tr.prop('heart', 'crystal-orb', m3(19, 17.5), 'K20', y=20, dims={'r': 5})
tr.light('heart-glow', m3(19, 17.5), 'candle', 20, 40, y=20)

np_ = Level('north-peak', 'North tower peak (+240 ft)', 240, 9, ambient='interior-dim', interior='ashlar', exterior='ashlar', north='-z')
np_.room('K60', 'North Tower Peak', oct3(19, 17.5, 1.75), 'flagstone', page=pg('K60'), ceilingFt=9)
np_.room('K18', 'High Tower Staircase', oct3(22.5, 23, 1.5), 'flagstone', page=pg('K18'), ceilingFt=60)
np_.prop('k18-stair', 'spiral-stair', m3(22.5, 23), 'K18', dims={'r': 12, 'rise': 60})
np_.prop('ladder-k60', 'stairs-straight', m3(19, 16.5), 'K60', dims={'w': 3, 'rise': 9, 'fromZ': 2 * 17 - 6, 'toZ': 2 * 16 - 6})
np_.prop('chest-k60', 'chest', m3(18, 18.2), 'K60'); np_.hidden('chest-k60-lock', 'niche', m3(18, 18.6), 'K60', 'Iron chest, locked; the key is with Cyrus Belview (K62). Strahd\'s crest on the lid.')
np_.prop('shackles-k60', 'chains', m3(20.2, 17), 'K60', dims={'y': 6, 'len': 2}); np_.prop('puddle', 'water', m3(19, 16.9), 'K60', dims={'w': 4, 'd': 4})
np_.note('K60-note', m3(19, 18), 'K60', 'Manacles on the walls; a ladder to a rotten trapdoor (K60a). Teleport destination (orange).')
nr = Level('north-roof', 'North tower rooftop (+250 ft)', 250, 50, ambient='storm', interior='ashlar', exterior='ashlar', north='-z')
nr.room('K60a', 'North Tower Rooftop', oct3(19, 17.5, 1.75), 'flagstone', page=pg('K60a'), ceilingFt=0.1)
nr.room('K18', 'High Tower Staircase', oct3(22.5, 23, 1.5), 'flagstone', page=pg('K18'), ceilingFt=50)
nr.prop('k18-stair', 'spiral-stair', m3(22.5, 23), 'K18', dims={'r': 12, 'rise': 50})
nr.prop('trap-k60a', 'trapdoor', m3(19, 16.5), 'K60a'); nr.note('K60a-note', m3(19, 17.5), 'K60a', 'The courtyard 260 ft below, the keep roof 130 ft below. Bats roost here at dusk.')
hp = Level('high-peak', 'High tower peak (+300 ft)', 300, 20, ambient='storm', interior='ashlar', exterior='ashlar', north='-z')
hp.room('K59', 'High Tower Peak', oct3(22.5, 23, 1.5), 'flagstone', page=pg('K59'), ceilingFt=20)
hp.prop('shaft-k59', 'pit-cover', m3(22.5, 23), 'K59', dims={'r': 7.5}); hp.note('K59-note', m3(22.5, 23.8), 'K59', 'A 5-ft walkway rings the 15-ft hole: the shaft (K18a) drops 390 ft to the catacombs. One beam and part of the cone roof have fallen.')
hp.creature('pidlwick', 'adventurer', m3(23.5, 22.2), 'K59', 'Pidlwick II, the clockwork fool, in the rafters', size='small')
hp.light('K59-sky', m3(22.5, 23), 'daylight', 10, 20, y=10)

# ================================================================== LARDERS OF ILL OMEN (-40, map 11)
la = Level('larders', 'Larders of Ill Omen (-40 ft)', -40, 40, ambient='darkness', interior='rubble', exterior='rubble', north='-z')
towers(la, ['K18', 'K21', 'K83'], 40)
la.room('K72', "Chamberlain's Office", R(m11, 12.5, 6, 15, 9), 'plank', page=pg('K72'), ceilingFt=10)
la.room('K71', 'Kingsmen Quarters', R(m11, 14, 9, 16.5, 12), 'flagstone', page=pg('K71'), ceilingFt=10)
la.room('K70', 'Kingsmen Hall', R(m11, 11, 9, 14, 12.5), 'flagstone', page=pg('K70'), ceilingFt=10)
la.room('K79', 'Western Stair (head)', R(m11, 9, 8, 11, 9.5), 'flagstone', page=pg('K79'), ceilingFt=10)
la.room('K83a', 'Spiral Stair Landing', R(m11, 9.5, 10.5, 11, 14.5), 'flagstone', page=pg('K83a'), ceilingFt=10)
la.room('K66', "Butler's Quarters", R(m11, 13.5, 12.5, 16, 14.5), 'plank', page=pg('K66'), ceilingFt=10)
la.room('K65', 'Kitchen', R(m11, 16, 12, 19, 14.5), 'flagstone', page=pg('K65'), ceilingFt=10)
la.room('K62', "Servants' Hall", R(m11, 11.5, 14.5, 19.5, 15.5), 'flagstone', page=pg('K62'), ceilingFt=10)
la.room('K63', 'Wine Cellar', R(m11, 19.5, 13.5, 23, 17), 'flagstone', page=pg('K63'), ceilingFt=8)
la.room('K61', 'Elevator Trap', R(m11, 15, 15.5, 16, 18.5), 'flagstone', page=pg('K61'), ceilingFt=10)
la.room('K67', 'Hall of Bones', R(m11, 11.5, 15.5, 14.5, 19), 'flagstone', page=pg('K67'), ceilingFt=20)
la.room('K68', "Guards' Run", R(m11, 12, 19, 13.5, 22), 'flagstone', page=pg('K68'), ceilingFt=10)
la.room('K69', "Guards' Quarters", R(m11, 6, 18.5, 12, 21), 'flagstone', page=pg('K69'), ceilingFt=10)
la.room('K64', "Guards' Stair (foot)", R(m11, 12, 22, 13.5, 23.5), 'flagstone', page=pg('K64'), ceilingFt=40)
la.room('K20a', 'Tower Hall Stair', R(m11, 16.5, 9, 18.5, 10), 'flagstone', page=pg('K20a'), ceilingFt=40)
la.room('K23-s', "Servants' Stair (foot)", R(m11, 19.5, 11, 20.5, 14.5), 'flagstone', page=pg('K23'), ceilingFt=40)
Dr(la, m11, (12.5, 7.5), (12.5, 8.5), id='K72-door'); la.secret(m11(12.5, 6), m11(12.5, 7), 'K72-west', 'A secret door at the north end of the west wall: the western stair (K79) descends', 'K72')
Dr(la, m11, (13, 9), (14, 9), id='K70-north'); Dr(la, m11, (12, 12.5), (13, 12.5), id='K70-south'); Op(la, m11, (14, 10), (14, 11))
Op(la, m11, (11, 10.5), (11, 11.5)); Op(la, m11, (16.5, 9), (16.5, 10))
Dr(la, m11, (14.5, 14.5), (15.5, 14.5), id='K66-door'); Dr(la, m11, (17, 14.5), (18, 14.5), id='K65-door'); Op(la, m11, (19.5, 14.5), (19.5, 15.5))
Dr(la, m11, (19.5, 14.5), (19.5, 15), id='K63-door'); Dr(la, m11, (15, 15.5), (16, 15.5), id='K61-north-door')
Dr(la, m11, (13, 15.5), (14, 15.5), id='K67-north'); Dr(la, m11, (12.5, 19), (13.5, 19), id='K67-south'); Op(la, m11, (12, 19.5), (12, 20.5)); Op(la, m11, (12.5, 22), (13.5, 22))
Op(la, m11, (16, 16.5), (16, 17.5)); Op(la, m11, (20, 14.5), (20.5, 14.5))
la.prop('k79-stair', 'stairs-straight', m11(10, 8.75), 'K79', dims={'w': 5, 'rise': 0.1, 'fromX': 2 * (9 + 3.5) - 2, 'toX': 2 * (11 + 3.5) - 2})
la.prop('k20a-stair', 'stairs-straight', m11(17.5, 9.5), 'K20a', dims={'w': 5, 'rise': 40, 'fromX': 2 * (16.5 + 3.5) - 2, 'toX': 2 * (18.5 + 3.5) - 2})
la.prop('k23-stair', 'stairs-straight', m11(20, 12.75), 'K23-s', dims={'w': 5, 'rise': 40, 'fromZ': 2 * (14.5 + 5.5) - 6, 'toZ': 2 * (11 + 5.5) - 6})
la.prop('k64-stair', 'stairs-straight', m11(12.75, 22.75), 'K64', dims={'w': 5, 'rise': 40, 'fromZ': 2 * (22 + 5.5) - 6, 'toZ': 2 * (23.5 + 5.5) - 6})
la.prop('tapestry', 'rug', m11(10.8, 12.5), 'K83a', rotY=90, dims={'w': 10, 'd': 1}); la.note('K83a-note', m11(10.25, 12.5), 'K83a', 'A 40-ft corridor between two spiral stairs: north-west down to K78, south up (K83). The tapestry shows knights charging under a red sky.')
la.prop('desk-k72', 'desk', m11(13.75, 7.5), 'K72'); la.creature('rahadin-k72', 'adventurer', m11(13.75, 8), 'K72', 'Rahadin, the chamberlain, may be at his desk')
for i, (x, y) in enumerate([(14.3, 9.3), (14.3, 11.7), (16.2, 9.3), (16.2, 11.7)]): la.prop(f'cot-k71-{i}', 'pallet', m11(x, y), 'K71')
la.hidden('flagstone-k71', 'trapdoor', m11(16.2, 11.7), 'K71', 'A loose flagstone in the south-east alcove hides a small cache')
la.prop('table-k67', 'table', m11(13, 17.25), 'K67', dims={'w': 10, 'd': 4}); la.note('K67-note', m11(13, 18), 'K67', 'Walls, ceiling, chandelier and table all made of bones and skulls; mounds of bones in the corners.')
for i, (x, y) in enumerate([(11.8, 15.8), (14.2, 15.8), (11.8, 18.7), (14.2, 18.7)]): la.prop(f'bones-{i}', 'refuse', m11(x, y), 'K67')
la.prop('oven-k65', 'stove', m11(18.6, 12.4), 'K65'); la.prop('pot-k65', 'brazier', m11(17.5, 13.25), 'K65'); la.creature('zombies-k65', 'skeleton', m11(17.5, 13.25), 'K65', 'Zombies in the great pot (see text)')
la.prop('bed-k66', 'bed', m11(14, 12.9), 'K66'); la.creature('cyrus', 'adventurer', m11(15, 13.5), 'K66', 'Cyrus Belview, the mongrelfolk servant (key to the chest in K60)')
for i, x in enumerate((20, 20.6, 21.2)): la.prop(f'cask-n-{i}', 'wine-cask', m11(x, 13.7), 'K63')
for i, y in enumerate((14, 14.5, 15, 15.5, 16, 16.5)): la.prop(f'cask-e-{i}', 'wine-cask', m11(22.7, y), 'K63')
for i, x in enumerate((20, 20.6, 21.2)): la.prop(f'cask-s-{i}', 'wine-cask', m11(x, 16.8), 'K63')
la.hidden('crack-k63', 'niche', m11(19.6, 16.7), 'K63', 'A crack at the south end of the west wall leads to the high tower stair (K18)')
la.note('K63-note', m11(21, 15.25), 'K63', 'Three casks north, six east, three south; the card reading may place a treasure here. Cyrus keeps the rats as pets.')
la.hidden('elev-plate', 'pressure-plate', m11(15.5, 17), 'K61', 'Elevator trap: 400 lb on the floor drops portcullises and lifts the car; the counterweight falls in the east half')
la.note('K61-note', m11(15.5, 18), 'K61', 'A 10 × 30 ft corridor; the spiral stair (K21) is south, a wooden door north.')
for i, (x, y) in enumerate([(7, 18.8), (8.5, 18.8), (10, 18.8), (11.5, 18.8), (7, 20.7), (8.5, 20.7), (10, 20.7), (11.5, 20.7)]):
    la.prop(f'cot-k69-{i}', 'pallet', m11(x, y), 'K69')
la.creature('skeletons-k69', 'skeleton', m11(9, 19.75), 'K69', 'Ten skeletons leap from the alcoves at the midpoint of the hall')
la.light('K62-fog', m11(15.5, 15), 'candle', 5, 10, y=2); la.light('K65-fire', m11(18.6, 12.4), 'torch', 10, 20, y=3); la.light('K67-chandelier', m11(13, 17.25), 'candle', 10, 20, y=12)
cobwebs(la, R(m11, 11.5, 14.5, 19.5, 15.5), 'K62', y=8, n=2)

# ================================================================== DUNGEON AND CATACOMBS (-80, map 12)
d = Level('dungeon', 'Dungeon and catacombs (-80 ft)', -80, 40, ambient='darkness', interior='rubble', exterior='rubble', north='-z')
d.room('K18', 'High Tower Staircase (foot)', oct3(22.5, 23, 1.5), 'flagstone', page=pg('K18'), ceilingFt=40)
d.prop('k18-stair', 'spiral-stair', m3(22.5, 23), 'K18', dims={'r': 12, 'rise': 40})
d.room('K21', 'South Tower Stair (foot)', oct3(20, 26.5, 2), 'flagstone', page=pg('K21'), ceilingFt=40)
d.prop('k21-stair', 'spiral-stair', m3(20, 26.5), 'K21', dims={'r': 16, 'rise': 40})
d.room('K83', 'Spiral Stair (foot)', OCT(m12, 14, 20, 1), 'flagstone', page=pg('K83'), ceilingFt=40)
d.prop('k83-stair', 'spiral-stair', m12(14, 20), 'K83', dims={'r': 8, 'rise': 40})
d.room('K73', 'Dungeon Hall', R(m12, 14, 29.5, 18.5, 30.5), 'shallow-water', page=pg('K73'), ceilingFt=8, difficult=True)
d.room('K74', 'North Dungeon', R(m12, 17, 25.5, 18, 29.5), 'shallow-water', page=pg('K74'), ceilingFt=8, difficult=True)
d.room('K75', 'South Dungeon', R(m12, 17, 30.5, 18, 34.5), 'shallow-water', page=pg('K75'), ceilingFt=8, difficult=True)
CELLS_N = [('K74a', 16, 25.5, 'Forgotten Treasure'), ('K74b', 16, 26.5, 'Forgotten Treasure'), ('K74c', 16, 27.5, 'Rotting Corpse'), ('K74d', 16, 28.5, 'Empty Cell'),
           ('K74e', 18, 25.5, 'Flooded Cell (slide)'), ('K74f', 18, 26.5, 'Empty Cell'), ('K74g', 18, 27.5, 'Empty Cell'), ('K74h', 18, 28.5, 'Empty Cell')]
CELLS_S = [('K75a', 16, 30.5, 'Prisoner'), ('K75b', 16, 31.5, 'Forgotten Treasure'), ('K75c', 16, 32.5, 'Empty Cell'), ('K75d', 16, 33.5, 'Empty Cell'),
           ('K75e', 18, 30.5, 'Hanging Bard'), ('K75f', 18, 31.5, 'Empty Cell'), ('K75g', 18, 32.5, 'Empty Cell'), ('K75h', 18, 33.5, 'Empty Cell')]
for key, x, y, name in CELLS_N + CELLS_S:
    d.room(key, name, R(m12, x, y, x + 1, y + 1), 'shallow-water', page=pg(key), ceilingFt=8, difficult=True)
    side = m12(x + 1, y) if x == 16 else m12(x, y)
    d.door(side, (side[0], side[1] + 2), id=f'{key}-bars', locked=True)
Dr(d, m12, (17, 29.5), (18, 29.5), id='K74-door', locked=True); Dr(d, m12, (17, 30.5), (18, 30.5), id='K75-door', locked=True)
d.room('K76', 'Torture Chamber', R(m12, 10, 27, 15, 32), 'shallow-water', page=pg('K76'), ceilingFt=17, difficult=True)
d.room('K77', 'Observation Balcony', R(m12, 10.5, 24.5, 14.5, 27), 'flagstone', page=pg('K77'), ceilingFt=10)
d.room('K78', 'Brazier Room', R(m12, 11, 21.5, 14, 24.5), 'flagstone', page=pg('K78'), ceilingFt=20)
d.room('K80', 'Center Stair', R(m12, 12, 16, 17, 17.5), 'flagstone', page=pg('K80'), ceilingFt=10)
d.room('K81', 'Tunnel', R(m12, 17, 16.5, 29, 17.5), 'cave-rock' if False else 'dirt', page=pg('K81'), ceilingFt=6)
d.room('K79', 'Western Stair (foot)', R(m12, 9.5, 12, 12, 16), 'flagstone', page=pg('K79'), ceilingFt=10)
d.room('K82', 'Marble Slide', R(m12, 15.5, 18, 16.5, 24.5), 'flagstone', page=pg('K82'), ceilingFt=6)
Op(d, m12, (14, 30), (14, 31)); Dr(d, m12, (12, 27), (13, 27), id='K77-door'); Dr(d, m12, (12, 24.5), (13, 24.5), id='K78-south'); Dr(d, m12, (12, 21.5), (13, 21.5), id='K78-north')
Dr(d, m12, (12, 17.5), (13, 17.5), id='K80-door'); Op(d, m12, (17, 16.5), (17, 17.5)); Dr(d, m12, (29, 16.5), (29, 17.5), id='K81-stone-door')
Op(d, m12, (11.5, 16), (12, 16)); Op(d, m12, (14.5, 24.5), (14.5, 25)); d.secret(m12(18, 25.5), m12(18.5, 25.5), 'slide-end', 'The chute ends in a one-way secret door into the flooded cell', 'K82', extra=True)
d.railing(m12(10.5, 27), m12(14.5, 27))
d.prop('throne-k77-a', 'chair', m12(12.2, 25.5), 'K77', rotY=180); d.prop('throne-k77-b', 'chair', m12(12.8, 25.5), 'K77', rotY=180); d.prop('curtain-k77', 'ledge', m12(12.5, 26.5), 'K77', dims={'w': 20, 'd': 0.5, 'h': 9})
d.prop('brazier-k78', 'brazier', m12(12.5, 23), 'K78'); d.prop('hourglass', 'crystal-orb', m12(12.5, 23), 'K78', y=10, dims={'r': 2})
d.note('K78-note', m12(12.5, 22.3), 'K78', 'Seven coloured stones around the brazier: each teleports to another place (red the study, orange the north tower peak, yellow Strahd\'s tomb, green a coffin shop in Vallaki, blue the Amber Temple, indigo the abbey, violet Tsolenka Pass).')
for i, (x, y) in enumerate([(11, 28), (13.5, 28), (11, 31), (13.5, 31)]): d.prop(f'rack-{i}', 'trough', m12(x, y), 'K76')
d.prop('chains-k76', 'chains', m12(12.5, 29.5), 'K76', dims={'y': 17, 'len': 8}); d.note('K76-note', m12(12.5, 30), 'K76', 'Brackish water 3 ft deep; the balcony is 7 ft above it.')
d.prop('k80-stair', 'stairs-straight', m12(14.5, 16.75), 'K80', dims={'w': 5, 'rise': 10, 'fromX': 2 * (12 + 1) - 2, 'toX': 2 * (17 + 1) - 2})
d.prop('k79-stair', 'stairs-straight', m12(10.75, 14), 'K79', dims={'w': 5, 'rise': 40, 'fromZ': 2 * (16 - 2.5) - 6, 'toZ': 2 * (12 - 2.5) - 6})
d.hidden('trap-k81', 'trapdoor', m12(23, 17), 'K81', 'Hidden trapdoor under the fog (DC 20 Perception): the marble slide to the flooded cell')
d.note('K81-note', m12(20, 17), 'K81', 'A slick tunnel cut in the Pillarstone, 120 ft long, ceiling barely 6 ft; a stone door at the east end.')
d.creature('prisoner', 'adventurer', m12(16.5, 31), 'K75a', 'Emil Toranescu, werewolf prisoner (gruff voice)'); d.creature('bard', 'skeleton', m12(18.5, 31), 'K75e', 'A bard hangs here')
d.hidden('treasure-74a', 'chest', m12(16.5, 26), 'K74a', 'Forgotten treasure'); d.hidden('treasure-74b', 'chest', m12(16.5, 27), 'K74b', 'Forgotten treasure'); d.hidden('treasure-75b', 'chest', m12(16.5, 32), 'K75b', 'Forgotten treasure')
d.prop('corpse-74c', 'skeleton', m12(16.5, 28), 'K74c')
# the catacombs: 10-ft walkways between 10-ft crypts that carry the 20-ft ceiling; 40 numbered crypts
d.room('K84', 'Catacombs', R(m12, 20, 15, 34, 34), 'dirt', page=pg('K84'), ceilingFt=20)
CRYPTS = {1: (23, 16), 2: (24.5, 16), 3: (26, 16), 4: (27.5, 16), 5: (29, 16), 6: (30.5, 16), 7: (22, 18.5), 8: (24, 18.5), 9: (26, 18.5), 10: (28, 18.5), 11: (30, 18.5),
          12: (21, 21), 13: (23, 21), 14: (25, 21), 15: (27, 21), 16: (29, 21), 17: (32, 21), 18: (24.5, 23.5), 19: (26.5, 23.5), 20: (28.5, 23.5),
          21: (24.5, 26), 22: (26.5, 26), 23: (28.5, 26), 24: (21, 28.5), 25: (23.5, 28.5), 26: (25.5, 28.5), 27: (27.5, 28.5), 28: (29.5, 28.5), 29: (32, 28.5),
          30: (22.5, 31), 31: (24.5, 31), 32: (26.5, 31), 33: (28.5, 31), 34: (30.5, 31), 35: (21, 33), 36: (24, 33), 37: (26, 33), 38: (28, 33), 39: (30, 33), 40: (32.5, 33)}
for n, (x, y) in CRYPTS.items():
    px, pz = m12(x, y); d.prop(f'crypt-{n}', 'column', (px, pz), 'K84', dims={'w': 10, 'h': 20})
    d.note(f'crypt-{n}-note', (px, pz + 1.2), 'K84', f'Crypt {n}')
d.note('K84-note', m12(27, 15.6), 'K84', '110 × 180 ft of guano-covered walkways between hollow crypt-pillars; the ceiling is a moving mass of bats.')
d.room('K85', "Sergei's Tomb", R(m12, 25, 10.5, 29, 14.5), 'flagstone', page=pg('K85'), ceilingFt=30)
d.room('K85-s', "Sergei's Tomb (stair)", R(m12, 26, 14.5, 28, 15), 'flagstone', page=pg('K85'), ceilingFt=30)
d.room('K86', "Strahd's Tomb", R(m12, 25, 36, 29, 40), 'flagstone', page=pg('K86'), ceilingFt=30)
d.room('K86-s', "Strahd's Tomb (stair)", R(m12, 26, 34, 28, 36), 'flagstone', page=pg('K86'), ceilingFt=30)
d.room('K87', 'Guardians', R(m12, 34, 23.5, 37, 26.5), 'flagstone', page=pg('K87'), ceilingFt=30)
d.room('K88', 'Tomb of King Barov and Queen Ravenovia', [m12(37, 22.5), m12(41, 22.5), m12(42, 23.5), m12(42, 26.5), m12(41, 27.5), m12(37, 27.5)], 'flagstone', page=pg('K88'), ceilingFt=30)
Op(d, m12, (26, 15), (28, 15)); Op(d, m12, (26, 14.5), (28, 14.5)); Op(d, m12, (26, 34), (28, 34)); Op(d, m12, (26, 36), (28, 36)); Op(d, m12, (34, 24.5), (34, 25.5)); Op(d, m12, (37, 24.5), (37, 25.5))
d.prop('portcullis-k85', 'portcullis', m12(27, 14.5), 'K85-s'); d.prop('portcullis-k86', 'portcullis', m12(27, 36), 'K86-s')
d.prop('coffin-sergei', 'coffin', m12(27, 12.5), 'K85'); d.prop('dais-sergei', 'dais', m12(27, 12.5), 'K85', dims={'w': 10, 'h': 1, 'steps': 1})
for i, x in enumerate((25.7, 27, 28.3)): d.prop(f'statue-k85-{i}', 'statue', m12(x, 10.8), 'K85')
d.prop('lever-k85', 'wheel', m12(25.3, 14.2), 'K85', rotY=90); d.note('K85-note', m12(27, 13.5), 'K85', 'White marble; the lever west of the entrance lifts the portcullis. The Sunsword may rest here (card reading).')
d.prop('coffin-strahd', 'coffin', m12(27, 38), 'K86'); d.prop('dais-strahd', 'dais', m12(27, 38), 'K86', dims={'w': 10, 'h': 1, 'steps': 1})
d.creature('brides', 'skeleton', m12(28.5, 38.5), 'K86', 'Three vampire spawn brides under the earth by the east wall')
d.prop('lever-k86', 'wheel', m12(28.7, 36.3), 'K86', rotY=90); d.note('K86-note', m12(27, 39.3), 'K86', 'Black marble; Strahd\'s coffin. Teleport destination (yellow). Three alcoves south.')
d.prop('guardian-n', 'statue', m12(35.5, 23.7), 'K87', dims={'s': 3}); d.prop('guardian-s', 'statue', m12(35.5, 26.3), 'K87', dims={'s': 3})
d.hidden('curtain-k87', 'niche', m12(35.5, 25), 'K87', 'A soft blue curtain of light between the bronze warriors: a ward (see text)')
d.prop('coffin-barov', 'coffin', m12(39, 23.2), 'K88'); d.prop('coffin-ravenovia', 'coffin', m12(39, 26.8), 'K88'); d.prop('window-k88', 'bricked-window', m12(41.9, 25), 'K88', rotY=90)
d.note('K88-note', m12(39, 25), 'K88', 'Stained glass east windows (dirty, breakable); the vaulted ceiling is a gold mosaic. The king north, the queen south.')
d.light('K78-brazier', m12(12.5, 23), 'torch', 20, 40, y=4); d.light('K85-glow', m12(27, 12.5), 'candle', 10, 20, y=6); d.light('K88-glass', m12(41, 25), 'daylight', 10, 20, y=12)
cobwebs(d, R(m12, 20, 15, 34, 34), 'K84', y=18, n=4)

levels = [d, la, g, L, c, w, sp, st, tr, np_, nr, hp]
CODE = {'ground': '', 'dungeon': 'd', 'larders': 'l', 'landing': 'g', 'court': 'c', 'weeping': 'w', 'spires': 'p', 'south-tower': 't', 'tower-roofs': 'r', 'north-peak': 'k', 'north-roof': 'o', 'high-peak': 'h'}
seen = set()
for lv in [g] + [x for x in levels if x is not g]:
    ren = {}
    for i, (key, name, poly, floor, extra) in enumerate(lv.rooms):
        if key in seen:
            nk = (key + CODE[lv.id]) if '-' in key else f'{key}-{CODE[lv.id]}'
            ren[key] = nk; lv.rooms[i] = (nk, name, poly, floor, extra)
        seen.add(ren.get(key, key))
    for o in lv.objects:
        if o.get('key') in ren: o['key'] = ren[o['key']]

# ------------------------------------------------------------------ descriptions (own wording)
DESC = {
  'K1': ("A wide courtyard of broken flagstones before the keep, its walls rising ninety feet on every side. The doors of the keep stand open under torches.", "Lightning and rain; the gate behind the party swings shut on its own if Strahd wills it."),
  'K2': ("A gate in a wall that runs from the keep to the curtain wall.", "North and south gates: unlocked, heavy."),
  'K3': ("A narrow courtyard between the keep and the eastern wall; a carriage house stands in the corner.", "The door into the keep (K23) is swollen shut: DC 10 Strength."),
  'K3-s': ("The courtyard continues round the south-east of the keep.", None),
  'K4': ("A stone carriage house with hinged wooden doors.", "The black carriage with glass windows and brass lanterns; the horses are elsewhere."),
  'K5': ("A struggling garden behind the keep under boarded stained-glass windows.", None),
  'K6': ("A stone balcony beyond the east wall, open to the storm.", "The village lies a thousand feet below. Perception 15: a stone box with three dirty windows juts from the cliff a hundred feet down (K63, the wine cellar)."),
  'K7': ("An entry hall twenty feet deep between two sets of doors, torches guttering in iron sconces. Four stone dragons glare down from the vaulted ceiling.", "The dragons are red dragon wyrmlings: they attack anyone entering from K8 who is not Strahd, never anyone coming in from the courtyard."),
  'K8': ("A great dusty hall under a dome ringed with eight stone gargoyles, columns strung with cobwebs, torches guttering. Bronze doors east and south; a wide staircase climbs north into the dark.", "Gargoyles (8) attack anyone who leaves and returns. Rahadin descends the stair to greet invited guests and leads them to K10."),
  'K9': ("A hall with a suit of armour in a shallow alcove; double doors to the west stand ajar, organ music and bright light spilling through them. An arched hallway runs east.", "The armour is only armour. The east hallway ends at the south tower stair (K21)."),
  'K10': ("A dining hall laid for a feast under a crystal chandelier; a pipe organ thunders at the far wall.", "The food is real but the gracious host is Strahd; the organ plays itself. The scene is a trap of hospitality."),
  'K11': ("A post with arrow slits looking out over the courtyard.", None), 'K22': ("A post with arrow slits looking out over the courtyard.", None),
  'K12-n': ("An octagonal turret room thirty feet across under a domed ceiling with faded frescoes; arrow slits in every wall.", None),
  'K12-s': ("An octagonal turret room thirty feet across under a domed ceiling with faded frescoes; arrow slits in every wall.", None),
  'K13-n': ("A plain hall linking the turrets.", None), 'K13-w': ("A plain hall linking the turrets.", None), 'K13-s': ("A plain hall linking the turrets.", None),
  'K14': ("A long hall draped in cobwebs; life-sized statues of knights line both sides. Double doors stand at each end, a bronze sun above the eastern pair.", "The statues are only statues; cobwebs cut sight to a few feet."),
  'K15': ("The ancient chapel: a dome ninety feet overhead, bats among the rafters, broken stained glass boarded up, a balcony along the west wall. An altar on a platform at the east end, a cloaked figure draped across it, a black mace on the floor.", "The figure is a corpse (the mace is a holy symbol's resting place per the card reading). Strahd may be among the bats. The balcony is K28 (+50)."),
  'K16': ("An arched room with alcoves holding eight-foot statues of helmed knights; a creaking wooden stair rises to the west.", None),
  'K17': ("An arched room with alcoves holding eight-foot statues of helmed knights; a stair landing to the west, steps curling down and up.", "Down is blocked by new masonry 10 ft below; up climbs into cobwebs."),
  'K18': ("A spiral staircase of great flagstones around a twenty-foot core, choked with cobwebs.", "300 ft from K84 to K59 around the shaft K18a. A crack 30 ft below the new wall leads to the wine cellar's air."),
  'K20': ("A round tower hall; a spiral stair hugs the outer wall and another stair in the centre leads down.", "The Heart of Sorrow: the tower is alive. Stair: +50 landing (K13 arch, secret ladder to K34), +90 landing (K45/K46), +190 beneath the heart, then K60."),
  'K21': ("A spiral stair in a round tower, torches guttering in a cold draught.", "From K73 (-80) up past K61, K9, K30 and K35 to K47."),
  'K23': ("A dusty room with a dirt-caked east window; a door beside it, a broken door north, a stair plunging south. Two skeletal figures in chain mail sag at attention beside the stair.", "The skeletons are wired dummies (Cyrus Belview's work). The stair descends to K62 (-40). East door swollen: DC 10 Strength."),
  'K24': ("Dim servants' quarters; a narrow railless stair climbs along the north wall.", "The stair leads to K34 (+50)."),
  'K29': ("An old wooden staircase that groans underfoot.", "Climbs from K16 to the balcony K28 (+50); nothing up there is surprised."),
  'K31a': ("A rectangular shaft, cold and mildewed, iron chains taut up and down it.", "The elevator trap's shaft (see K61)."),
  'K64': ("A bare, windy staircase.", "From K68 (-40) past K13 to K46 (+90)."),
  'K83': ("A dark spiral stair behind a door.", "From K78 (-80) past K83a to K37 (+90)."),
  'K8-s': ("A broad staircase of worn stone climbing into darkness.", "Up 30 ft to K19, the grand landing."),
  'K9-h': ("An arched hallway twenty feet long.", None),
}

def apply_desc(lvls):
    for lv in lvls:
        for r in lv['rooms']:
            d = DESC.get(r['key'])
            if d:
                r['desc'] = d[0]
                if d[1]: r['dm'] = d[1]

scene = OrderedDict(schema=1, location='K', chapter='ch04', name='Castle Ravenloft', mapPage=53, bookScaleFt=5, ambient='storm', stacked=True, partial=True, entry='ground')
scene['levels'] = [lv.to_json() for lv in levels]
apply_desc(scene['levels'])

def lk(id, kind, a_level, a, b_level, b): return OrderedDict(id=id, kind=kind, **{'from': {'level': a_level, 'pos': [a[0] * 5, a[1] * 5]}, 'to': {'level': b_level, 'pos': [b[0] * 5, b[1] * 5]}})
scene['links'] = [
    lk('lk-grand', 'stairs', 'ground', m3(16.25, 19.25), 'landing', m3(16.25, 14.5)),
    lk('lk-k19-w', 'stairs', 'landing', m3(15.5, 13.8), 'court', m3(13, 15.8)), lk('lk-k19-e', 'stairs', 'landing', m3(18.5, 13.8), 'court', m3(16, 15.8)),
    lk('lk-k20-court', 'spiral', 'ground', m3(19, 17.5), 'court', m3(19, 17.5)), lk('lk-k20-weep', 'spiral', 'court', m3(19, 17.5), 'weeping', m3(19, 17.5)),
    lk('lk-k20-spires', 'spiral', 'weeping', m3(19, 17.5), 'spires', m3(19, 17.5)), lk('lk-k20-st', 'spiral', 'spires', m3(19, 17.5), 'south-tower', m3(19, 17.5)),
    lk('lk-k20-roofs', 'spiral', 'south-tower', m3(19, 17.5), 'tower-roofs', m3(19, 17.5)), lk('lk-k20-peak', 'spiral', 'tower-roofs', m3(19, 17.5), 'north-peak', m3(19, 17.5)),
    lk('lk-k60a', 'ladder', 'north-peak', m3(19, 16.5), 'north-roof', m3(19, 16.5)),
    lk('lk-k20a', 'stairs', 'larders', m11(17.5, 9.5), 'ground', m3(19, 17.5)),
    lk('lk-k21-dun', 'spiral', 'dungeon', m3(20, 26.5), 'larders', m3(20, 26.5)), lk('lk-k21-gr', 'spiral', 'larders', m3(20, 26.5), 'ground', m3(20, 26.5)),
    lk('lk-k21-court', 'spiral', 'ground', m3(20, 26.5), 'court', m3(20, 26.5)), lk('lk-k21-weep', 'spiral', 'court', m3(20, 26.5), 'weeping', m3(20, 26.5)),
    lk('lk-k21-top', 'spiral', 'weeping', m3(20, 26.5), 'spires', m3(18.5, 23.5)),
    lk('lk-k48-st', 'spiral', 'spires', m3(21.25, 25.5), 'south-tower', m3(21.25, 25.5)), lk('lk-k48-roof', 'spiral', 'south-tower', m3(21.25, 25.5), 'tower-roofs', m3(21.25, 25.5)),
    lk('lk-k18-court', 'spiral', 'ground', m3(22.5, 23), 'court', m3(22.5, 23)), lk('lk-k18-weep', 'spiral', 'court', m3(22.5, 23), 'weeping', m3(22.5, 23)),
    lk('lk-k18-spires', 'spiral', 'weeping', m3(22.5, 23), 'spires', m3(22.5, 23)), lk('lk-k18-st', 'spiral', 'spires', m3(22.5, 23), 'south-tower', m3(22.5, 23)),
    lk('lk-k18-roofs', 'spiral', 'south-tower', m3(22.5, 23), 'tower-roofs', m3(22.5, 23)), lk('lk-k18-np', 'spiral', 'tower-roofs', m3(22.5, 23), 'north-peak', m3(22.5, 23)),
    lk('lk-k18-nr', 'spiral', 'north-peak', m3(22.5, 23), 'north-roof', m3(22.5, 23)), lk('lk-k18-hp', 'spiral', 'north-roof', m3(22.5, 23), 'high-peak', m3(22.5, 23)),
    lk('lk-k18-larders', 'spiral', 'dungeon', m3(22.5, 23), 'larders', m3(22.5, 23)),
    lk('lk-k64-gr', 'stairs', 'larders', m11(12.75, 22.75), 'ground', m3(17.25, 26.75)), lk('lk-k64-court', 'stairs', 'ground', m3(17.25, 26.75), 'court', m3(17.25, 26.75)),
    lk('lk-k64-weep', 'stairs', 'court', m3(17.25, 26.75), 'weeping', m3(17.25, 26.75)),
    lk('lk-k83-dun', 'spiral', 'dungeon', m12(14, 20), 'larders', m11(10.25, 11)), lk('lk-k83-gr', 'spiral', 'larders', m11(10.25, 14), 'ground', m3(14.5, 18.5)),
    lk('lk-k83-court', 'spiral', 'ground', m3(14.5, 18.5), 'court', m3(14.5, 18.5)), lk('lk-k83-weep', 'spiral', 'court', m3(14.5, 18.5), 'weeping', m3(14.5, 18.5)),
    lk('lk-k23', 'stairs', 'ground', m3(23.75, 17.2), 'larders', m11(20, 11.5)),
    lk('lk-k24', 'stairs', 'ground', m3(23, 13.25), 'court', m3(23.75, 13.25)),
    lk('lk-k29', 'stairs', 'ground', m3(23, 19.25), 'court', m3(25.25, 19.5)),
    lk('lk-k33', 'stairs', 'court', m3(16.75, 13.5), 'weeping', m5(14, 17.5)),
    lk('lk-k34-ladder', 'ladder', 'court', m3(22.75, 15.3), 'ground', m3(19, 17.5)),
    lk('lk-elevator', 'elevator', 'larders', m11(15.5, 17), 'spires', m3(18, 23.4)),
    lk('lk-k79', 'stairs', 'dungeon', m12(10.75, 14), 'larders', m11(10, 8.75)),
    lk('lk-k80', 'stairs', 'dungeon', m12(12.5, 16.75), 'dungeon', m12(16.5, 16.75)),
    lk('lk-k82', 'slide', 'dungeon', m12(23, 17), 'dungeon', m12(16.5, 29)),
    lk('lk-k51', 'trapdoor', 'spires', m3(20, 29.3), 'south-tower', m3(20, 28.6)),
    lk('lk-k85', 'stairs', 'dungeon', m12(27, 15), 'dungeon', m12(27, 14.5)), lk('lk-k86', 'stairs', 'dungeon', m12(27, 34), 'dungeon', m12(27, 36)),
    lk('lk-k87', 'stairs', 'dungeon', m12(34, 25), 'dungeon', m12(37, 25)),
]
scene['nonSpatialKeys'] = []

grid = OrderedDict(schema=1, levels=OrderedDict())
for lv in levels:
    grid['levels'][lv.id] = OrderedDict(floorPolygons=[[[x * 5, z * 5] for x, z in p] for p in lv.floor_polys], type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0.55)

os.makedirs(OUT, exist_ok=True)
json.dump(scene, open(os.path.join(OUT, 'scene.json'), 'w'), indent=1)
json.dump(grid, open(os.path.join(OUT, 'grid.json'), 'w'), indent=1)
nw = sum(len(l['walls']) for l in scene['levels']); no = sum(len(l['objects']) for l in scene['levels']); nr = sum(len(l['rooms']) for l in scene['levels'])
print(f'castle: {len(levels)} levels, {nr} rooms, {nw} walls, {no} objects -> {OUT}')
