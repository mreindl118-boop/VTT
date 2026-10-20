#!/usr/bin/env python3
"""Castle Ravenloft (chapter 4, maps 2–13) -> locations/ch04/K/{scene,grid}.json

A reconstruction from the book's isometric plates, rectified into plan view (scripts in the session scratch:
measure the two grid directions, warp so the 10-ft squares become axis-aligned, read room corners off the
grid). Each plate has its own frame; `m3()` etc. place a plate's 10-ft cells into one castle frame of 5-ft
cells (x east, z south, origin at the north-west corner of the curtain wall). Only keys, names, page refs,
dimensions and placements live here; descriptions are our own wording.

Playable pass (2026-10-18, owner request): decorative statues stand in their alcoves along the walls, never in the
walkway; the great tower stairs climb round open wells; the straight stairs run in feet. The same scene feeds the
3D-print set (print/castle-ravenloft/build.py), so the printed castle and the one in the app are one plan.

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
# Where a room meets a tower's side, a curtain wall or a partition, no room edge runs cell by cell along the gap, so
# Level.opening() and Level.door() (which lift or flag a room edge they match cell by cell) cannot open it. An arch cuts
# every wall that lies along it once the walls are built (room edges, octagon sides, the curtain's own walls); an inner
# door is a door set in such a line: the walls under it are cut the same way (free_openings below).
ARCH = {}       # level id -> [(a, b)] in 5-ft cells
DOOR_OPEN = {}  # inner doors' ids -> open
def arch(lv, a, b): ARCH.setdefault(lv.id, []).append((a, b))
def inner_door(lv, a, b, id, locked=False, open=False):
    lv.extra.append((a, b, dict(flags=['door'] + (['locked'] if locked else []), id=id)))
    DOOR_OPEN[id] = open

# ================================================================== GROUND: courtyard (map 2) + main floor (map 3)
g = Level('ground', 'Courtyard and main floor', 0, 50, ambient='storm', interior='ashlar', exterior='ashlar', north='-z')
WALL_H = 90  # the curtain walls (p.53)

# --- the courtyard, 340 × 300 ft inside a 20-ft curtain wall; the keep stands in the middle
# K1 front courtyard wraps the keep's west, north-west and south-west; K2's two gated walls run from the keep to
# the curtain wall north and south of it; K3 the servants' courtyard takes the east.
# the front courtyard wraps the keep's west, north-west and south-west, and runs in between the two west turrets up to
# the keep's open doors (K7), flanked by the archers' posts (K22 north, K11 south: map 3)
g.room('K1', 'Front Courtyard', [(4, 4), (50, 4), (50, 18), (16, 18), (16, 29), (24, 29), (24, 39), (22, 39), (22, 40), (19, 40), (19, 44), (16, 44), (16, 50),
                                 (48, 50), (48, 64), (4, 64)], 'cobble', page=pg('K1'))
# the servants' courtyard takes in the corner north of the chapel, where the servants' entrance (K23) opens
g.room('K3', "Servants' Courtyard", [(50, 4), (62, 4), (62, 10), (72, 10), (72, 30), (60, 30), (60, 28), (58, 26), (52, 26), (50, 28), (48, 28), (48, 18), (50, 18)],
       'cobble', page=pg('K3'))
g.room('K3-s', "Servants' Courtyard (south)", [(48, 50), (60, 50), (60, 36), (72, 36), (72, 64), (48, 64)], 'cobble', page=pg('K3'))
g.room('K4', 'Carriage House', rect(62, 4, 72, 10), 'flagstone', page=pg('K4'), ceilingFt=15)
g.room('K5', 'Chapel Garden', rect(60, 30, 72, 36), 'grass', page=pg('K5'))
# the postern and the gate passage are tunnels through the solid curtain wall, as wide as their openings (10 ft), so
# the wall stands whole either side of them (walls with a body, below)
g.room('K5-p', 'Postern', rect(72, 32, 76, 34), 'flagstone', page=pg('K5'))
g.room('K6', 'Overlook', [(76, 30), (84, 30), (86, 32), (86, 34), (84, 36), (76, 36)], 'flagstone', page=pg('K6'))
g.room('K1-g', 'Gatehouse Passage', rect(0, 33, 4, 35), 'flagstone', page=pg('K1'))
# gates in K2's walls and the passages
g.door((50, 10), (50, 12), id='K2-north-gate', double=True)
g.door((48, 56), (48, 58), id='K2-south-gate', double=True)
g.door((62, 6), (62, 8), id='K4-doors', double=True)
g.opening((72, 32), (72, 34)); g.opening((76, 32), (76, 34))
g.opening((60, 30), (72, 30)); g.opening((60, 36), (72, 36))   # the garden lies open to both servants' courtyards
g.opening((4, 33), (4, 35)); g.opening((0, 33), (0, 35))  # the gate stands open
# curtain wall: the courtyard's outer faces are 90 ft high; the outer edge of the wall is 20 ft further out
for a, b in [((4, 4), (72, 4)), ((72, 4), (72, 64)), ((72, 64), (4, 64)), ((4, 64), (4, 4))]:
    g._stamp(a, b, flags=['normal'], heightFt=WALL_H, material='ashlar', wall=True)
for a, b in [((0, 0), (76, 0)), ((76, 0), (76, 68)), ((76, 68), (0, 68)), ((0, 68), (0, 0))]:
    g.wall(a, b, heightFt=WALL_H, material='ashlar')
arch(g, (0, 33), (0, 35)); arch(g, (76, 32), (76, 34))   # the gate and the postern through the curtain's outer face
# The approach from the Gates of Ravenloft (J): the road along the ridge, the fifty-foot chasm, the drawbridge of
# old shored-up beams across it, the two gate towers either side of the entry tunnel (p.37-38)
g.terrain.append(([(-62, 30), (-11, 30), (-11, 38), (-62, 38)], 'cobble'))                  # the road on the ridge
g.terrain.append(([(-62, 22), (-11, 22), (-11, 46), (-62, 46)], 'grass'))                   # the ridge's crown either side
g.room('K1-bridge', 'Drawbridge', [(-11, 32), (0, 32), (0, 36), (-11, 36)], 'plank', ceilingFt=None)
g.prop('J-chasm', 'chasm', (-5.5, 34), 'K1-bridge', dims={'w': 50, 'len': 340, 'depth': 1000})
g.prop('J-drawbridge', 'drawbridge', (-5.5, 34), 'K1-bridge', dims={'len': 56, 'w': 18})
for s_ in (-1, 1): g.prop(f'J-tower{s_}', 'gate-tower', (-1.6, 34 + s_ * 4.6), None, dims={'r': 7, 'h': 100})
g.prop('J-portcullis', 'portcullis', (0.3, 34), 'K1-g', rotY=90)
g.note('J-bridge-note', (-6, 31), 'K1-bridge', 'The drawbridge: 5% chance a board breaks under any crosser but Strahd and his horses; DC 10 Dexterity save or fall 1,000 ft (advantage if a companion within 5 ft grabs you).')
g.terrain.append(([(0, 0), (76, 0), (76, 68), (0, 68)], 'flagstone'))        # wall tops / foundations under everything
# the party arrives over the drawbridge and through the gate passage: it starts just inside the gate, in the front
# courtyard, with the keep's open doors ahead
g.obj('spawn', 'spawn', (7.5, 34.5), 'dm-note', 'K1', 'Party arrives: over the drawbridge and through the gate')
g.prop('carriage', 'wagon', (67, 7), 'K4', rotY=90)
g.note('K6-note', (81, 33), 'K6', 'Balcony over the cliff: the village lies a thousand feet below; a window-set stone box juts from the cliff 100 ft down (K63).')
g.light('K7-torch-a', (14.5, 25), 'torch', 20, 40, y=8); g.light('K7-torch-b', (14.5, 27), 'torch', 20, 40, y=8)

# --- the keep's main floor (map 3), 10-ft cells read off the rectified plate
g.room('K12-n', 'Turret Post (north-west)', oct3(10.5, 15, 1.5), 'flagstone', page=pg('K12'), ceilingFt=30)
g.room('K12-s', 'Turret Post (south-west)', oct3(10.5, 26.5, 1.5), 'flagstone', page=pg('K12'), ceilingFt=30)
g.room('K13-n', 'Turret Post Access Hall (north)', rect3(12, 14.5, 15.5, 15.5), 'flagstone', page=pg('K13'), ceilingFt=15)   # meets the grand staircase
g.room('K13-s', 'Turret Post Access Hall (south)', rect3(12, 26, 16.5, 27), 'flagstone', page=pg('K13'), ceilingFt=15)
# the archers' posts flank the courtyard's way in to the keep's doors, clear of the turrets (the plate's posts overlap them)
g.room('K22', "North Archers' Post", rect3(12, 15.5, 13, 17.5), 'flagstone', page=pg('K22'), ceilingFt=15)
g.room('K11', "South Archers' Post", rect3(10.5, 23, 12, 25), 'flagstone', page=pg('K11'), ceilingFt=15)
g.room('K83', 'Spiral Stair', oct3(14.5, 18.5, 1), 'flagstone', page=pg('K83'), ceilingFt=50)
g.room('K8-s', 'Grand Staircase', rect3(15.5, 12.5, 17, 19.5), 'flagstone', page=pg('K8'), ceilingFt=40)
g.room('K7', 'Entry', rect3(13, 20, 15, 22), 'flagstone', page=pg('K7'), ceilingFt=20)
g.room('K8', 'Great Entry', rect3(15, 19.5, 19, 22.5), 'flagstone', page=pg('K8'), ceilingFt=40)
g.room('K14', 'Turret Access Hall', rect3(19, 20, 26, 22), 'flagstone', page=pg('K14'), ceilingFt=15)
g.room('K16', 'North Chapel Access', rect3(24.5, 18, 26, 20), 'flagstone', page=pg('K16'), ceilingFt=15)
g.room('K17', 'South Chapel Access', rect3(24, 22, 26, 24), 'flagstone', page=pg('K17'), ceilingFt=15)   # its west end is the high tower stair's landing
g.room('K15', 'Chapel', poly3([(27, 16), (30, 16), (31, 17), (31, 26), (30, 27), (27, 27), (26, 26), (26, 17)]), 'flagstone', page=pg('K15'), ceilingFt=90)
g.room('K9', "Guests' Hall", rect3(15, 22.5, 18, 25.5), 'flagstone', page=pg('K9'), ceilingFt=20)
g.room('K9-h', 'Arched Hallway', rect3(18, 23.5, 20.5, 24.5), 'flagstone', page=pg('K9'), ceilingFt=15)   # runs on to the south tower stair
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
O((18, 23.5), (18, 24.5)); arch(g, m3(19, 24.5), m3(20, 24.5))            # guests' hall → hallway → the south tower stair
D((26, 20.5), (26, 21.5), id='K15-west', double=True)                   # hall → chapel
O((26, 18.5), (26, 19.5)); O((26, 22.5), (26, 23.5))                    # chapel accesses → chapel
O((24.5, 18.5), (24.5, 19.5)); arch(g, m3(24, 22.5), m3(24, 23.5))          # north access → creaky stair; south access → the high tower stair (K18)
O((25, 20), (25.5, 20)); O((25, 22), (25.5, 22))                        # accesses open on the hall
O((24.5, 19), (24.5, 20))                                               # north access → creaky landing
# K22 meets the north access hall along its north edge (map 3); ported from ChatGPT's item 2e branch: the earlier door
# crossed the middle of K22 and matched no wall
D((12, 15.5), (13, 15.5), id='K22-door')
# K11's one door is the secret door behind the organ in K10 (p.57); the turret post (K12) opens into it from the south
g.secret(m3(12, 23.5), m3(12, 24), 'K11-organ', 'A secret door behind the pipe organ: it opens once the organ slides out', 'K11')
arch(g, m3(10.5, 25), m3(11.12, 25))
arch(g, m3(12, 14.5), m3(12, 15.5)); O((15.5, 14.5), (15.5, 15.5))         # north hall to the turret and the grand staircase
arch(g, m3(12, 26), m3(12, 27)); O((16.5, 26.5), (16.5, 27.5))           # south hall to the turret and the guards' stair
D((25, 16), (25, 17), id='K23-courtyard', locked=False)                 # the servants' entrance: east to the courtyard
D((23, 15), (24, 15), id='K23-north', open=True)

# fixtures
for i, x in enumerate((15.5, 16.5, 17.5, 18.5)):
    g.prop(f'col-k8-{i}n', 'column', m3(x, 20), 'K8'); g.prop(f'col-k8-{i}s', 'column', m3(x, 22), 'K8')
g.creature('dragons', 'statue', m3(14, 21), 'K7', 'Four stone dragons on the vaulted ceiling (red dragon wyrmlings when roused)', size='medium')
g.note('K8-gargoyles', m3(17, 21), 'K8', 'Eight gargoyles squat on the rim of the dome; they attack anyone who returns after leaving.')
g.prop('grand-stair', 'stairs-straight', m3(16.25, 16), 'K8', dims={'w': 15, 'rise': 30, 'fromZ': 2 * 19.5 - 6, 'toZ': 2 * 12.5 - 6})
g.prop('k83-stair', 'spiral-stair', m3(14.5, 18.5), 'K83', dims={'r': 8, 'rise': 50})
# the three great tower stairs climb round an open well (r0: the treads' inner edge), not a solid fan from the axis;
# the Heart of Sorrow (K20) hangs in its well, and K18's well is the shaft K18a
g.prop('k21-stair', 'spiral-stair', m3(20, 26), 'K21', dims={'r': 13, 'r0': 8, 'rise': 50})
g.prop('k18-stair', 'spiral-stair', m3(22.5, 23), 'K18', dims={'r': 13, 'r0': 8, 'rise': 50})
g.prop('k20-stair', 'spiral-stair', m3(19, 17.5), 'K20', dims={'r': 16, 'r0': 11, 'rise': 50})
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
for i, (x, y) in enumerate([(24.8, 18.25), (24.8, 19.75), (24.8, 22.25), (24.8, 23.75)]):   # in their alcoves on the west wall, out of the walkway
    g.prop(f'knight-{i}', 'armor-suit', m3(x, y), 'K16' if y < 21 else 'K17')
for i, y in enumerate((20.25, 21.75)):   # the knights stand against the walls; the hall's middle 15 ft stay clear
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
WELL = ('K18', 'K20', 'K21')  # tower stairs with an open well: the treads run from r0 = r - 5 ft out to r
def spiral(r, rise, k): return {'r': r, 'r0': r - 5, 'rise': rise} if k in WELL and r > 6 else {'r': r, 'rise': rise}
def towers(lv, which, ceil, page_of='K18', shell=()):
    """The stair towers that pass through a level, as rooms with their spiral stairs. A tower in `shell` stands inside
    another room on this level (a turret in a hall): its walls only, no keyed room of its own (no label pile-up)."""
    for k in which:
        (cx, cy), r = TOWER[k]
        if k in shell:
            o = oct3(cx, cy, r)
            for i in range(len(o)): lv.wall(o[i], o[(i + 1) % len(o)], material=lv.interior)
        else:
            lv.room(k, {'K20': 'Heart of Sorrow', 'K18': 'High Tower Staircase', 'K21': 'South Tower Stair', 'K83': 'Spiral Stair'}[k], oct3(cx, cy, r), 'flagstone', page=pg(k), ceilingFt=ceil)
        lv.prop(f'{k}-stair', 'spiral-stair', m3(cx, cy), k if k not in shell else None, dims=spiral(r * 8, ceil if k != 'K18' else 40, k))
def turrets(lv, ceil):
    """The west wing repeats on the floor above the main floor: two turrets with their access halls, the archers' posts
    clear of the turrets, the guards' stair. The halls open into the turrets through the octagons' sides (arches)."""
    lv.room('K12-n', 'Turret Post (north-west)', oct3(10.5, 15, 1.5), 'flagstone', page=pg('K12'), ceilingFt=ceil)
    lv.room('K12-s', 'Turret Post (south-west)', oct3(10.5, 26.5, 1.5), 'flagstone', page=pg('K12'), ceilingFt=ceil)
    lv.room('K13-n', 'Turret Post Access Hall (north)', rect3(12, 14.5, 16, 15.5), 'flagstone', page=pg('K13'), ceilingFt=ceil)
    lv.room('K13-s', 'Turret Post Access Hall (south)', rect3(12, 26, 16.5, 27), 'flagstone', page=pg('K13'), ceilingFt=ceil)
    lv.room('K22', "North Archers' Post", rect3(12, 15.5, 13, 17.5), 'flagstone', page=pg('K22'), ceilingFt=ceil)
    lv.room('K11', "South Archers' Post", rect3(10.5, 23, 12, 25), 'flagstone', page=pg('K11'), ceilingFt=ceil)
    lv.room('K64', "Guards' Stair", rect3(16.5, 26, 18, 27.5), 'flagstone', page=pg('K64'), ceilingFt=ceil)
    Dr(lv, m3, (12, 15.5), (13, 15.5), id=f'{lv.id}-K22-door')   # on K22's north edge (ported from ChatGPT's item 2e branch)
    arch(lv, m3(12, 14.5), m3(12, 15.5)); arch(lv, m3(12, 26), m3(12, 27)); arch(lv, m3(10.5, 25), m3(11.12, 25)); Op(lv, m3, (16.5, 26.5), (16.5, 27.5))
    lv.prop('k64-stair', 'stairs-straight', m3(17.25, 26.75), 'K64', dims={'w': 5, 'rise': 10, 'fromX': 2 * 16.5 - 2, 'toX': 2 * 18 - 2})
    lv.light('K12n-slits', m3(10.5, 15), 'daylight', 5, 10, y=8); lv.light('K12s-slits', m3(10.5, 26.5), 'daylight', 5, 10, y=8)

# ================================================================== LANDING (+30): the grand landing K19
L = Level('landing', 'Grand landing (+30 ft)', 30, 20, ambient='interior-dim', interior='ashlar', exterior='ashlar', north='-z')
L.room('K19', 'Grand Landing', rect3(15, 12, 19, 14), 'flagstone', page=pg('K19'), ceilingFt=20)
L.room('K8-s', 'Grand Staircase (head)', rect3(15.5, 14, 17, 15.5), 'flagstone', page=pg('K8'), ceilingFt=20)
Op(L, m3, (15.5, 14), (17, 14))
L.prop('armor-k19-w', 'armor-suit', m3(15.4, 13.6), 'K19'); L.prop('armor-k19-e', 'armor-suit', m3(18.6, 13.6), 'K19')
L.hidden('plate-w', 'pressure-plate', m3(15.6, 13.3), 'K19', 'Pressure plate: the west suit of armour animates'); L.hidden('plate-e', 'pressure-plate', m3(18.4, 13.3), 'K19', 'Pressure plate: the east suit of armour animates')
L.prop('k19-stair-w', 'stairs-straight', m3(15.5, 14), 'K19', dims={'w': 5, 'rise': 20, 'fromZ': 2 * 14 - 6, 'toZ': 2 * 12.25 - 6})  # climbs north inside the landing
L.prop('k19-stair-e', 'stairs-straight', m3(18.5, 14), 'K19', dims={'w': 5, 'rise': 20, 'fromZ': 2 * 14 - 6, 'toZ': 2 * 12.25 - 6})  # climbs north inside the landing
L.light('K19-torches', m3(17, 13), 'torch', 10, 20, y=8)

# ================================================================== COURT OF THE COUNT (+50, map 4)
# The plate's rooms are registered on the towers (they pass through every floor): the audience hall lies between the
# K83 turret (north) and the south access hall (K13), whose wall carries its secret door; the guards' post (K26) is the
# ten-foot passage between the hall's east doors and the King's hall (K27), with the apartment stair (K33) behind a
# secret door in its north wall and the maid's room (K32) west of that; the accountant (K30) opens west on the hall and
# east on the south tower stair (K21); the trapworks (K31) lies behind a secret door in K27's south wall (pp.62-65).
c = Level('court', 'Court of the Count (+50 ft)', 50, 40, ambient='interior-dim', interior='ashlar', exterior='ashlar', north='-z')
turrets(c, 40); towers(c, ['K20', 'K18', 'K21', 'K83'], 40)
c.room('K25', 'Audience Hall', rect3(12, 19.5, 16, 26), 'flagstone', page=pg('K25'), ceilingFt=40)
c.room('K26', "Guards' Post", rect3(16, 17.5, 17, 21.5), 'flagstone', page=pg('K26'), ceilingFt=15)
c.room('K27', "King's Hall", rect3(17, 19.5, 24.5, 21.5), 'flagstone', page=pg('K27'), ceilingFt=20)
c.room('K28', "King's Balcony", [m3(24.5, 18.5), m3(26, 18.5), m3(26, 17), m3(27.5, 17), m3(27.5, 26), m3(26, 26), m3(26, 20.5), m3(24.5, 20.5)], 'flagstone', page=pg('K28'), ceilingFt=40)
# the accountant's room meets the south tower's north-west side, where its east door opens onto the stair
c.room('K30', "King's Accountant", [m3(16, 23), m3(19, 23), m3(19, 24.6716), m3(18.1716, 25.5), m3(16, 25.5)], 'plank', page=pg('K30'), ceilingFt=15)
c.room('K31', 'Trapworks', rect3(19.5, 21.5, 21.5, 22.5), 'flagstone', page=pg('K31'), ceilingFt=15)
c.room('K31a', 'Elevator Shaft', rect3(19.5, 22.5, 21.5, 23.5), 'flagstone', page=pg('K31a'), ceilingFt=80)
c.room('K32', 'Maid in Hell', rect3(13, 15.5, 16, 17.5), 'plank', page=pg('K32'), ceilingFt=15)
c.room('K33', "King's Apartment Stair", rect3(16, 13.5, 17, 17.5), 'plank', page=pg('K33'), ceilingFt=40)
c.room('K34', "Servants' Upper Floor", rect3(22.5, 13, 25, 15.5), 'plank', page=pg('K34'), ceilingFt=15)
c.room('K34-closet', 'Mirror Closet', rect3(22.5, 15.5, 23.5, 16.5), 'plank', page=pg('K34'), ceilingFt=20)
Dr(c, m3, (16, 20), (16, 21), id='K25-east', double=True); Dr(c, m3, (17, 20), (17, 21), id='K26-east', double=True)
c.secret(m3(14, 26), m3(15, 26), 'K25-K13', 'A secret door in the south wall of the audience hall, under dust and cobwebs', 'K25')
c.secret(m3(16, 17.5), m3(17, 17.5), 'K26-north', 'Behind the skeleton on the north wall: a secret door into the apartment stair', 'K26')
c.secret(m3(16, 14.5), m3(16, 15.5), 'K33-west', 'A secret door at the east end of the north access hall: the apartment stair', 'K33')
Dr(c, m3, (16, 16), (16, 17), id='K32-door')   # the maid's room: the plain wooden door in the stair's west wall
Dr(c, m3, (12, 23.5), (12, 24.5), id='court-K11-door')   # the archers' post opens on the audience hall
Op(c, m3, (24.5, 19.5), (24.5, 20.5))
# the balcony's entry bay holds the creaky stair's head; a partition with the double doors parts it from the balcony
# (ported from ChatGPT's item 2e branch: the doors were stamped on no wall and never appeared)
c.wall(m3(26, 18.5), m3(26, 19.5)); inner_door(c, m3(26, 19.5), m3(26, 20.5), 'K28-doors')
Dr(c, m3, (16, 24), (16, 25), id='K30-west'); inner_door(c, (35.735, 43.608), (34.608, 44.735), 'K30-east')
c.secret(m3(20, 21.5), m3(20.5, 21.5), 'K31-door', 'Halfway down the King\'s hall, a narrow secret door in the south wall: the trapworks', 'K27')
Op(c, m3, (20, 22.5), (21, 22.5))
c.secret(m3(22.5, 15.5), m3(23, 15.5), 'K34-closet', 'Behind the west mirror: a closet with a ladder up 20 ft to a secret door in the tower stair (K20)', 'K34')
c.prop('throne-k25', 'chair', m3(14, 25.2), 'K25', rotY=180); c.prop('dais-k25', 'dais', m3(14, 25.2), 'K25', dims={'w': 10, 'h': 2, 'steps': 2})
c.note('K25-window', m3(12.2, 22.75), 'K25', 'A tall west window of broken glass and iron lattice looks over the courtyard; cobwebs hide the ceiling.')
c.prop('cobweb-k25', 'cobweb', m3(14, 21.5), 'K25', dims={'s': 6, 'y': 20})
c.prop('throne-k28-a', 'chair', m3(26.7, 21), 'K28', rotY=90); c.prop('throne-k28-b', 'chair', m3(26.7, 22), 'K28', rotY=90)
c.creature('zombies-k28', 'skeleton', m3(26.7, 21.5), 'K28', 'Two Strahd zombies slumped on the thrones', size='medium')
c.railing(m3(27.5, 17), m3(27.5, 26))
c.prop('desk-k30', 'desk', m3(17.25, 24.25), 'K30'); c.creature('lief', 'adventurer', m3(17.25, 24.6), 'K30', 'Lief Lipsiege, the chained accountant (commoner)')
c.hidden('ledger', 'bookshelf', m3(16.3, 23.3), 'K30', 'A bloodstained ledger (DC 15 Investigation, 10 minutes)')
c.prop('lever-k31', 'wheel', m3(19.7, 22), 'K31', rotY=90); c.note('K31-note', m3(20.5, 22), 'K31', 'The elevator trap lever: up raises the car from K61 to K47; a counterweight drops in the shaft\'s east half.')
c.prop('wardrobe-k34', 'wardrobe', m3(23.75, 15.2), 'K34'); c.hidden('mirror-k34', 'niche', m3(22.8, 15.2), 'K34', 'A full-length mirror; the secret door is behind it')
c.prop('k34-stair', 'stairs-straight', m3(23.75, 13.25), 'K34', dims={'w': 5, 'rise': 0.1, 'fromX': 2 * 25 - 2, 'toX': 2 * 22.5 - 2})
c.prop('k34-ladder', 'stairs-straight', m3(23, 16), 'K34-closet', dims={'w': 3, 'rise': 20, 'fromZ': 2 * 16.4 - 6, 'toZ': 2 * 15.6 - 6})
c.prop('k33-stair', 'stairs-straight', m3(16.5, 14.5), 'K33', dims={'w': 5, 'rise': 40, 'fromZ': 2 * 16.5 - 6, 'toZ': 2 * 13.5 - 6})
c.prop('k29-top', 'stairs-straight', m3(25.25, 19.5), 'K28', dims={'w': 5, 'rise': 0.1, 'fromX': 2 * 24.5 - 2, 'toX': 2 * 26 - 2})
c.creature('k32-maid', 'adventurer', m3(14.75, 16.5), 'K32', "Helga Ruvak, the 'maid' (vampire spawn)")
c.prop('bed-k32', 'bed', m3(13.6, 16.5), 'K32'); c.light('K25-glow', m3(13, 22.75), 'daylight', 10, 20, y=12); c.light('K27-torch', m3(20.5, 20.5), 'torch', 10, 20, y=8)
cobwebs(c, rect3(17, 19.5, 24.5, 21.5), 'K27', y=14, n=4)

# ================================================================== ROOMS OF WEEPING (+90, map 5)
w = Level('weeping', 'Rooms of Weeping (+90 ft)', 90, 40, ambient='interior-dim', interior='paneling', exterior='ashlar', north='-z')
towers(w, ['K20', 'K18', 'K21', 'K83'], 40)
# The plate's rooms stand apart with the halls between them unbuilt; the halls are laid in where the module puts the
# doors (pp.65-70): the study (K37) has double doors west onto a hall facing the bedchamber's east doors, a door at each
# end of its north wall onto a hall that runs from the hall of heroes into the K20 tower's landing, and a door south
# onto a hall to the dining hall (K36) and the steel door of K35, whose far end is the K21 stair's landing; the K83
# spiral comes up beside the study's west doors; the hall of webs' narrow secret door leads down to the shaft access.
w.room('K45', 'Hall of Heroes', [m5(14, 16), m5(18.75, 16), m5(18.75, 18.5), m5(14, 18.5)], 'flagstone', page=pg('K45'), ceilingFt=20)
w.room('K37', 'Study', [m5(17, 20), m5(19.5, 20), m5(20, 20.5), m5(20, 22), m5(17, 22)], 'plank', page=pg('K37'), ceilingFt=15)
w.room('K37-hw', 'Hall west of the Study', R(m5, 15.5, 20.5, 17, 22), 'flagstone', page=pg('K37'), ceilingFt=15)
w.room('K37-hn', 'Hall north of the Study', [m5(17, 18.5), m5(18.75, 18.5), m5(18.75, 19.225), m5(19.525, 20), m5(19.5, 20), m5(17, 20)], 'flagstone', page=pg('K37'), ceilingFt=15)
w.room('K37-hs', 'Hall south of the Study', [m5(17, 22), m5(18, 22), m5(18, 24.5), m5(20.5, 24.5), m5(20.5, 25.5), m5(18, 25.5), m5(18, 25), m5(17, 25)], 'flagstone', page=pg('K37'), ceilingFt=15)
w.room('K38', 'False Treasury', R(m5, 20, 20.5, 22, 22.5), 'flagstone', page=pg('K38'), ceilingFt=15)
w.room('K39', 'Hall of Webs', R(m5, 22, 21, 26, 22), 'flagstone', page=pg('K39'), ceilingFt=20)
w.room('K40', 'Belfry', R(m5, 26, 21, 28, 23), 'flagstone', page=pg('K40'), ceilingFt=50)
w.room('K41', 'Treasury', R(m5, 24.5, 18.5, 27, 21), 'flagstone', page=pg('K41'), ceilingFt=40)
w.room('K42', "King's Bedchamber", R(m5, 11, 20, 15.5, 23), 'plank', page=pg('K42'), ceilingFt=15)
w.room('K42-hd', 'Dusty Hall', R(m5, 12, 18, 14, 20), 'flagstone', page=pg('K42'), ceilingFt=10)
w.room('K43', 'Bath Chamber', R(m5, 12, 23, 15, 26), 'flagstone', page=pg('K43'), ceilingFt=15)
w.room('K44', 'Closet', R(m5, 12, 26, 15.5, 28), 'plank', page=pg('K44'), ceilingFt=15)
w.room('K36', 'Dining Hall of the Count', R(m5, 15.5, 25, 18, 28), 'plank', page=pg('K36'), ceilingFt=15)
w.room('K35', 'Guardian Vermin', R(m5, 20.5, 24.5, 22.5, 25.5), 'flagstone', page=pg('K35'), ceilingFt=15)
w.room('K31b', 'Shaft Access', rect3(19.5, 22.5, 21.5, 23.5), 'flagstone', page=pg('K31a'), ceilingFt=40)
w.room('K31b-h', 'Passage to the Shaft', R(m5, 22, 22, 22.5, 23.5), 'flagstone', page=pg('K31a'), ceilingFt=10)
w.room('K46-w', 'Parapets (west)', R(m5, 9.5, 14.5, 11, 29.5), 'flagstone', page=pg('K46'), ceilingFt=10)
w.room('K46-n', 'Parapets (north)', R(m5, 11, 14.5, 29, 16), 'flagstone', page=pg('K46'), ceilingFt=10)
w.room('K46-s', 'Parapets (south)', R(m5, 11, 28.5, 19.5, 29.5), 'flagstone', page=pg('K46'), ceilingFt=10)
w.room('K46-e', 'Parapets (east)', R(m5, 28, 16, 29.5, 23), 'flagstone', page=pg('K46'), ceilingFt=10)
w.room('K46-a', 'Archway to the Parapets', R(m5, 20, 16, 21, 16.75), 'flagstone', page=pg('K46'), ceilingFt=10)
w.room('K64', "Guards' Stair (head)", rect3(16.5, 26, 18, 27.5), 'flagstone', page=pg('K64'), ceilingFt=10)
Dr(w, m5, (15.5, 21), (15.5, 22), id='K42-east', double=True); Dr(w, m5, (17, 21), (17, 22), id='K37-west', double=True)
Dr(w, m5, (17.5, 20), (18.5, 20), id='K37-north-a'); Dr(w, m5, (19, 20), (19.5, 20), id='K37-north-b'); Dr(w, m5, (17, 22), (18, 22), id='K37-south')
w.secret(m5(20, 21), m5(20, 22), 'fireplace', 'The back wall of the fireplace swings open when the poker is lifted', 'K37')
w.prop('fireplace-k37', 'fireplace', m5(19.7, 21.5), 'K37', rotY=-90); w.prop('desk-k37', 'desk', m5(18, 21), 'K37'); w.prop('books-k37', 'bookshelf', m5(17.3, 20.3), 'K37')
w.secret(m5(22, 21.5), m5(22, 22), 'webs-west', 'Secret door in the hall\'s west wall; it opens only from the false treasury side', 'K39')
w.secret(m5(22, 22), m5(22.5, 22), 'webs-south', 'Behind the webs by the south wall\'s west corner: a narrow secret door down to the shaft access (K31b)', 'K39')
Op(w, m5, (22, 23.5), (22.5, 23.5))
Dr(w, m5, (26, 21), (26, 22), id='K40-doors', double=True); w.secret(m5(26, 21), m5(27, 21), 'belfry-north', 'Behind thick webs: a secret door into the treasury', 'K40')
arch(w, m5(18.75, 17.8), m5(18.75, 19.225)); arch(w, m5(18.75, 19.225), m5(19.525, 20))   # the hall of heroes and the north hall open on the K20 landing
arch(w, m5(17, 18.5), m5(18.75, 18.5))
inner_door(w, m5(15.625, 20.5), m5(16.375, 20.5), 'K83-door')   # the K83 spiral's door, beside the study's west doors
arch(w, m5(20, 16), m5(21, 16)); arch(w, m5(20, 16.75), m5(21, 16.75))   # the K20 landing's archway to the parapets
Op(w, m5, (11, 14.5), (11, 16)); Op(w, m5, (11, 28.5), (11, 29.5)); Op(w, m5, (28, 16), (29, 16)); Op(w, m5, (18, 28.5), (19.5, 28.5))   # the parapets' corners; the guards' stair comes up on them
w.prop('chest-k38', 'chest', m5(21.25, 21.5), 'K38'); w.note('K38-gas', m5(21.25, 22), 'K38', 'Opening the chest releases sleeping gas; the witches drag sleepers to K50.')
w.prop('bell-rope', 'chains', m5(27, 22), 'K40', dims={'y': 50, 'len': 48}); w.note('K40-bell', m5(27, 22.5), 'K40', 'Ringing the bell wakes the castle.')
w.prop('vault-tower', 'temple', m5(25.75, 19.5), 'K41', dims={'w': 20, 'd': 20, 'h': 30}); w.note('K41-note', m5(25.75, 20.2), 'K41', 'A square tower 20 ft on a side inside a pitch-coated dome of painted stars; adamantine door north, trapdoor on its roof. Only Strahd opens them.')
Dr(w, m5, (13, 23), (14, 23), id='K42-south', double=True)
w.secret(m5(12, 20), m5(13, 20), 'bed-north', 'A secret door beside the bed opens on a dusty hall', 'K42'); Op(w, m5, (14, 18), (14, 18.5))
w.prop('bed-k42', 'bed', m5(13, 20.6), 'K42', dims={'w': 8, 'd': 8}); w.prop('window-k42', 'bricked-window', m5(11.1, 21.5), 'K42', rotY=90)
Op(w, m5, (12.5, 26), (13, 26)); Op(w, m5, (14, 26), (14.5, 26))
w.prop('tub', 'trough', m5(13.5, 24.75), 'K43'); w.creature('tub-thing', 'skeleton', m5(13.5, 24.75), 'K43', 'A blood-drenched creature in the tub (Strahd zombie? see text)')
Dr(w, m5, (15.5, 26.5), (15.5, 27.5), id='K36-west'); Dr(w, m5, (17, 25), (18, 25), id='K36-north'); Dr(w, m5, (20.5, 24.5), (20.5, 25.5), id='K35-door', locked=True)
arch(w, m5(20.75, 25.5), m5(22.25, 25.5))   # K35's east end is the K21 stair's landing
w.prop('table-k36', 'table', m5(17.25, 26.5), 'K36', dims={'w': 12, 'd': 5}); w.prop('cake', 'dais', m5(17.25, 26.5), 'K36', dims={'w': 3, 'h': 2, 'steps': 1}); w.prop('harp-k36', 'harp', m5(15.8, 27.7), 'K36')
w.note('K36-note', m5(17.25, 27.3), 'K36', 'The wedding cake: the groom figurine (DC 10 Perception on the floor). The harp summons Pidlwick\'s ghost (DC 15 Performance).')
w.creature('rats-k35-n', 'swarm', m5(21.25, 24.75), 'K35', 'Two swarms of rats stacked into a man-shape'); w.creature('rats-k35-s', 'swarm', m5(21.75, 24.75), 'K35', 'Two swarms of rats stacked into a man-shape')
for i in range(6):
    w.prop(f'hero-n-{i}', 'statue', m5(14.5 + i * 0.6, 16.2), 'K45'); w.prop(f'hero-s-{i}', 'statue', m5(14.5 + i * 0.6, 18.3), 'K45')   # along the walls
w.prop('rubble-k45', 'rubble', m5(16, 17.5), 'K45'); w.note('K45-roof', m5(16, 17.5), 'K45', 'The ceiling has fallen in: lightning lights the statues. Stairs west down 40 ft to K33; archway east to the tower landing (K20).')
w.prop('k33-top', 'stairs-straight', m5(14, 17.5), 'K45', dims={'w': 5, 'rise': 0.1, 'fromX': 2 * 12.5 - 2 - 2 * 1.5, 'toX': 2 * 14 - 2 - 2 * 1.5})
w.prop('trap-k31b', 'trapdoor', m3(20.5, 23), 'K31b'); w.note('K31b-note', m3(20.5, 23.3), 'K31b', 'Elevator landing: the car stops here; a stone trapdoor 40 ft above opens into K47.')
for key, pos in (('K46-w', (10.25, 21)), ('K46-n', (20, 15.25)), ('K46-s', (16, 29)), ('K46-e', (28.75, 19.5))):
    w.light(f'{key}-sky', m5(*pos), 'daylight', 10, 20, y=4)
w.note('K46-note', m5(10.25, 20), 'K46', 'Battlemented walkways round the keep; every window into it is locked, though the glass breaks easily. Walkways lead off north, south and east to the curtain walls.')

# ================================================================== SPIRES (+130, map 6) and the south tower (+150, map 7)
sp = Level('spires', 'Spires of Ravenloft (+130 ft)', 130, 20, ambient='storm', interior='paneling', exterior='ashlar', north='-z')
towers(sp, ['K20', 'K18'], 20)
# Maps 6 and 7 registered on their explicit connections (pp.70-73), in whole 5-ft cells (ported by intent from
# ChatGPT's item 2e branch, which drew them on half cells): the lounge (K49) has two doors in its east wall, to the
# offstair (K48) north and the guest room (K50) south; K50's banded door is west and its small door east, into the
# closet (K51), whose ceiling hatch opens in the north-east corner of the element room (K55) above. On map 7 the familiar
# room (K54) lies west of the cauldron (K56), the offstair climbs on behind (north of) them with a passage west to K54,
# and the element room runs along the south of both. The plan stands just past the south tower's round as the plates do.
K51_HATCH = (42, 50)   # the closet's north-east corner, under the element room's
sp.room('K47', 'Portrait of Strahd', rect3(17.5, 22.5, 19.5, 24.5), 'plank', page=pg('K47'), ceilingFt=10)
sp.room('K31a', 'Elevator Shaft (top)', rect3(19.5, 22.5, 21.5, 23.5), 'flagstone', page=pg('K31a'), ceilingFt=10)
sp.room('K48', 'Offstair', rect(37, 43, 42, 46), 'flagstone', page=pg('K48'), ceilingFt=60)
sp.room('K49', 'Lounge', [(33, 43), (37, 43), (37, 52), (35, 52), (33, 50)], 'plank', page=pg('K49'), ceilingFt=15)
sp.room('K50', 'Guest Room', rect(37, 46, 41, 52), 'plank', page=pg('K50'), ceilingFt=15)
sp.room('K51', 'Closet', rect(41, 50, 43, 52), 'plank', page=pg('K51'), ceilingFt=10)
sp.room('K53-w', 'Rooftop (west wing)', rect3(9, 13.5, 13, 28), 'flagstone', page=pg('K53'), ceilingFt=10)
sp.room('K53-n', 'Rooftop (north)', rect3(13, 13.5, 26, 15.5), 'flagstone', page=pg('K53'), ceilingFt=10)
sp.room('K53-s', 'Rooftop (south)', rect3(13, 22.5, 17.5, 28), 'flagstone', page=pg('K53'), ceilingFt=10)
Dr(sp, m3, (17.5, 23), (17.5, 24), id='K47-west-door'); Op(sp, m3, (19.5, 23), (19.5, 23.5)); Op(sp, m3, (18, 24.5), (19.5, 24.5))
sp.opening((24, 39), (24, 50)); sp.opening((24, 21), (24, 25))   # the keep's roof is one: its pitches meet over the west wing
sp.door((37, 44), (37, 45), id='K49-K48'); sp.door((37, 49), (37, 51), id='K49-K50'); sp.door((41, 50), (41, 51), id='K51-door')
sp.prop('trap-k47', 'trapdoor', (34, 41), 'K47'); sp.hidden('portrait', 'niche', m3(18.5, 22.6), 'K47', 'A framed portrait of a handsome, serene man: Strahd')
sp.prop('rug-k47', 'rug', m3(18.5, 24), 'K47'); sp.note('K47-note', m3(18.5, 24.3), 'K47', 'Landing 10 × 20 ft; the spiral stair (K21) continues up from the north end of the east wall; the elevator trapdoor is before the west door.')
sp.prop('k48-foot', 'spiral-stair', m3(21.25, 25.5), 'K48', dims={'r': 6, 'rise': 20})
sp.prop('books-k49', 'bookshelf', (36.7, 47), 'K49', rotY=-90); sp.creature('escher', 'adventurer', (35, 47), 'K49', 'Escher, Strahd\'s consort (vampire spawn)')
sp.prop('bed-k50', 'bed', (39, 49), 'K50'); sp.note('K50-note', (39, 50.8), 'K50', 'Resting here at night brings 1d4 witches from K56.')
sp.hidden('hook-k51', 'niche', (42, 51.8), 'K51', 'A black cloak hangs on one hook; pull that hook and the hidden trapdoor overhead drops open (DC 13 Perception to find)')
sp.prop('chimney-k52', 'chimney', m3(17, 19.5), 'K52', dims={'h': 30})
sp.note('K52-note', m3(17, 20), 'K52', 'Smokestack 5 ft across, 30 ft above the roof peak; leads 60 ft down to the study fireplace (3d6 fire).')
sp.prop('roof-w', 'roof-gable', m3(11, 20.75), 'K53-w', dims={'w': 40, 'd': 145, 'h': 18}); sp.prop('roof-n', 'roof-gable', m3(19.5, 14.5), 'K53-n', rotY=90, dims={'w': 20, 'd': 130, 'h': 12}); sp.prop('roof-s', 'roof-gable', m3(15.25, 25.25), 'K53-s', rotY=90, dims={'w': 55, 'd': 45, 'h': 16})
sp.note('K53-note', m3(11, 15), 'K53', 'Sloping tiles 130 ft above the courtyard: DC 15 Acrobatics to cross; a fall by 5+ drops 40 ft to the parapets.')
sp.prop('gargoyle-a', 'statue', m3(9.3, 13.8), 'K53-w'); sp.prop('gargoyle-b', 'statue', m3(9.3, 27.7), 'K53-w'); sp.prop('gargoyle-c', 'statue', m3(25.7, 13.8), 'K53-n')
sp.light('K49-lightning', m3(18.5, 26.5), 'daylight', 10, 20, y=6)

st = Level('south-tower', 'South tower, witches\' floor (+150 ft)', 150, 40, ambient='interior-dim', interior='paneling', exterior='ashlar', north='-z')
towers(st, ['K20', 'K18'], 40)
st.room('K48-t', 'Offstair (upper)', [(37, 43), (42, 43), (42, 46), (33, 46), (33, 45), (37, 45)], 'flagstone', page=pg('K48'), ceilingFt=40)
st.room('K54', 'Familiar Room', rect(33, 46, 37, 50), 'plank', page=pg('K54'), ceilingFt=8)
st.room('K56', 'Cauldron', rect(37, 46, 43, 50), 'plank', page=pg('K56'), ceilingFt=15)
st.room('K55', 'Element Room', [(33, 50), (43, 50), (43, 52), (41, 54), (35, 54), (33, 52)], 'plank', page=pg('K55'), ceilingFt=15)
st.opening((34, 46), (35, 46))   # the offstair passes the familiar room
st.door((34, 50), (36, 50), id='K54-door'); st.door((39, 50), (41, 50), id='K56-door')
st.prop('k48-stair', 'spiral-stair', m3(21.25, 25.5), 'K48-t', dims={'r': 6, 'rise': 40})
st.creature('cats', 'wolf', (35, 48), 'K54', 'Three cats, the witches\' familiars', size='tiny')
st.prop('cauldron', 'brazier', (40, 48), 'K56'); st.creature('witches', 'adventurer', (39.5, 47.5), 'K56', 'Seven Barovian witches around the cauldron (fewer if some were met in K50)')
st.note('K55-note', (38, 52.5), 'K55', 'Boot prints in the dust lead from the north-east corner to the easternmost door; windows open on the tower wall (vampire spawn may notice).')
st.hidden('trap-k51-top', 'trapdoor', K51_HATCH, 'K55', 'The secret trapdoor from the closet (K51) below')

# ================================================================== TOWER TOPS (maps 8–10)
tr = Level('tower-roofs', 'Tower roofs and the bridge (+190 ft)', 190, 50, ambient='storm', interior='ashlar', exterior='ashlar', north='-z')
towers(tr, ['K20', 'K18'], 50)
tr.room('K57', 'Tower Roof', oct3(20, 26.5, 2), 'flagstone', page=pg('K57'), ceilingFt=0.1)
# the slender bridge runs from the south tower's roof to the landing under the heart, where the two towers' sides face
tr.room('K58', 'Bridge', [(36.4, 32.5), (37.4, 32.5), (37.4, 43), (36.4, 43)], 'flagstone', page=pg('K58'), ceilingFt=0.1)
arch(tr, (36.4, 43), (37.4, 43)); arch(tr, (36.4, 32.5), (37.4, 32.5))
tr.prop('k48-top', 'spiral-stair', m3(21.25, 25.5), 'K57', dims={'r': 6, 'rise': 0.1})
tr.note('K57-note', m3(20, 26.5), 'K57', 'Open roof: the courtyard 190 ft below, the keep\'s roof 80 ft below; a railed spiral stair descends. The slender bridge north has no railing.')
tr.note('K58-note', (36.9, 38), 'K58', 'DC 10 Dexterity save when damaged on the bridge or fall 60 ft to the keep roof.')
tr.note('K20-heart', m3(19, 17.5), 'K20', 'The landing beneath the Heart of Sorrow: the crystal heart hangs above; the stair wraps around it to K60.')
tr.prop('heart', 'crystal-orb', m3(19, 17.5), 'K20', y=20, dims={'r': 5})
tr.light('heart-glow', m3(19, 17.5), 'candle', 20, 40, y=20)

np_ = Level('north-peak', 'North tower peak (+240 ft)', 240, 9, ambient='interior-dim', interior='ashlar', exterior='ashlar', north='-z')
np_.room('K60', 'North Tower Peak', oct3(19, 17.5, 1.75), 'flagstone', page=pg('K60'), ceilingFt=9)
np_.room('K18', 'High Tower Staircase', oct3(22.5, 23, 1.5), 'flagstone', page=pg('K18'), ceilingFt=60)
np_.prop('k18-stair', 'spiral-stair', m3(22.5, 23), 'K18', dims=spiral(12, 60, 'K18'))
np_.prop('ladder-k60', 'stairs-straight', m3(19, 16.5), 'K60', dims={'w': 3, 'rise': 9, 'fromZ': 2 * 17 - 6, 'toZ': 2 * 16 - 6})
np_.prop('chest-k60', 'chest', m3(18, 18.2), 'K60'); np_.hidden('chest-k60-lock', 'niche', m3(18, 18.6), 'K60', 'Iron chest, locked; the key is with Cyrus Belview (K62). Strahd\'s crest on the lid.')
np_.prop('shackles-k60', 'chains', m3(20.2, 17), 'K60', dims={'y': 6, 'len': 2}); np_.prop('puddle', 'water', m3(19, 16.9), 'K60', dims={'w': 4, 'd': 4})
np_.note('K60-note', m3(19, 18), 'K60', 'Manacles on the walls; a ladder to a rotten trapdoor (K60a). Teleport destination (orange).')
nr = Level('north-roof', 'North tower rooftop (+250 ft)', 250, 50, ambient='storm', interior='ashlar', exterior='ashlar', north='-z')
nr.room('K60a', 'North Tower Rooftop', oct3(19, 17.5, 1.75), 'flagstone', page=pg('K60a'), ceilingFt=0.1)
nr.room('K18', 'High Tower Staircase', oct3(22.5, 23, 1.5), 'flagstone', page=pg('K18'), ceilingFt=50)
nr.prop('k18-stair', 'spiral-stair', m3(22.5, 23), 'K18', dims=spiral(12, 50, 'K18'))
nr.prop('trap-k60a', 'trapdoor', m3(19, 16.5), 'K60a'); nr.note('K60a-note', m3(19, 17.5), 'K60a', 'The courtyard 260 ft below, the keep roof 130 ft below. Bats roost here at dusk.')
hp = Level('high-peak', 'High tower peak (+300 ft)', 300, 20, ambient='storm', interior='ashlar', exterior='ashlar', north='-z')
hp.room('K59', 'High Tower Peak', oct3(22.5, 23, 1.5), 'flagstone', page=pg('K59'), ceilingFt=20)
hp.prop('shaft-k59', 'pit-cover', m3(22.5, 23), 'K59', dims={'r': 7.5}); hp.note('K59-note', m3(22.5, 23.8), 'K59', 'A 5-ft walkway rings the 15-ft hole: the shaft (K18a) drops 390 ft to the catacombs. One beam and part of the cone roof have fallen.')
hp.creature('pidlwick', 'adventurer', m3(23.5, 22.2), 'K59', 'Pidlwick II, the clockwork fool, in the rafters', size='small')
hp.light('K59-sky', m3(22.5, 23), 'daylight', 10, 20, y=10)
hp.prop('k59-cone', 'roof-cone', m3(22.5, 23), 'K59', dims={'r': 17, 'h': 18, 'y': 20})   # the cone roof, part of it fallen (see the note)

# ================================================================== LARDERS OF ILL OMEN (-40, map 11)
la = Level('larders', 'Larders of Ill Omen (-40 ft)', -40, 40, ambient='darkness', interior='rubble', exterior='rubble', north='-z')
towers(la, ['K18', 'K21'], 40)   # the K83 spiral passes this floor at its landing, K83a (below), not in a tower room of its own
la.room('K72', "Chamberlain's Office", R(m11, 12.5, 6, 15, 9), 'plank', page=pg('K72'), ceilingFt=10)
la.room('K71', 'Kingsmen Quarters', R(m11, 14, 9, 16.5, 12), 'flagstone', page=pg('K71'), ceilingFt=10)
la.room('K70', 'Kingsmen Hall', R(m11, 11, 9, 14, 12), 'flagstone', page=pg('K70'), ceilingFt=10)   # thirty feet square (p.81)
la.room('K70-h', 'Passage to the Servants\' Hall', R(m11, 12, 12, 13, 14.5), 'flagstone', page=pg('K70'), ceilingFt=10)   # from the door in K70's south wall
# the western stair's upper flight climbs east from its landing to the secret door into K72 (p.85)
la.room('K79', 'Western Stair (upper flight)', R(m11, 9, 6, 12.5, 7), 'flagstone', page=pg('K79'), ceilingFt=10)
la.room('K83a', 'Spiral Stair Landing', R(m11, 9.5, 10.5, 11, 14.5), 'flagstone', page=pg('K83a'), ceilingFt=10)
la.room('K66', "Butler's Quarters", R(m11, 13.5, 12.5, 16, 14.5), 'plank', page=pg('K66'), ceilingFt=10)
la.room('K65', 'Kitchen', R(m11, 16, 12, 19, 14.5), 'flagstone', page=pg('K65'), ceilingFt=10)
la.room('K62', "Servants' Hall", R(m11, 11.5, 14.5, 19.5, 15.5), 'flagstone', page=pg('K62'), ceilingFt=10)
la.room('K63', 'Wine Cellar', R(m11, 19.5, 14.5, 23, 17), 'flagstone', page=pg('K63'), ceilingFt=8)   # clear of the servants' stair foot
la.room('K61', 'Elevator Trap', R(m11, 16, 15.5, 17, 19), 'flagstone', page=pg('K61'), ceilingFt=10)   # from the door off K62 south to the K21 stair
la.room('K67', 'Hall of Bones', R(m11, 11.5, 15.5, 14.5, 19), 'flagstone', page=pg('K67'), ceilingFt=20)
la.room('K68', "Guards' Run", R(m11, 12, 19, 13.5, 22), 'flagstone', page=pg('K68'), ceilingFt=10)
la.room('K69', "Guards' Quarters", R(m11, 6, 18.5, 12, 21), 'flagstone', page=pg('K69'), ceilingFt=10)
la.room('K64', "Guards' Stair (foot)", R(m11, 12, 22, 13.5, 23.5), 'flagstone', page=pg('K64'), ceilingFt=40)
la.room('K20a', 'Tower Hall Stair', R(m11, 16.5, 9, 18.5, 10), 'flagstone', page=pg('K20a'), ceilingFt=40)
la.room('K23-s', "Servants' Stair (foot)", R(m11, 19.5, 11, 20.5, 14.5), 'flagstone', page=pg('K23'), ceilingFt=40)
la.secret(m11(12.5, 6), m11(12.5, 7), 'K72-west', 'West wall, northern corner: a hidden door, and beyond it the western stair (K79) dropping to its landing', 'K72')
Dr(la, m11, (13, 9), (14, 9), id='K70-north'); Dr(la, m11, (12, 12), (13, 12), id='K70-south'); Op(la, m11, (12, 14.5), (13, 14.5)); Op(la, m11, (14, 10), (14, 11))
Op(la, m11, (11, 10.5), (11, 11.5)); Op(la, m11, (16.5, 9), (16.5, 10))
Dr(la, m11, (14.5, 14.5), (15.5, 14.5), id='K66-door'); Dr(la, m11, (17, 14.5), (18, 14.5), id='K65-door'); Op(la, m11, (19.5, 14.5), (19.5, 15.5))
Dr(la, m11, (19.5, 14.5), (19.5, 15), id='K63-door'); Dr(la, m11, (16, 15.5), (17, 15.5), id='K61-north-door')
Dr(la, m11, (13, 15.5), (14, 15.5), id='K67-north'); Dr(la, m11, (12.5, 19), (13.5, 19), id='K67-south'); Op(la, m11, (12, 19.5), (12, 20.5)); Op(la, m11, (12.5, 22), (13.5, 22))
Op(la, m11, (19.5, 14.5), (20.5, 14.5))   # the servants' stair comes down where the hall meets the wine cellar
arch(la, m11(16, 19), m11(17, 19))        # K61 → the south tower stair (K21)
la.prop('k79-stair', 'stairs-straight', m11(10.75, 6.5), 'K79', dims={'w': 5, 'rise': 0.1, 'fromX': 2 * (9 + 3.5) - 2, 'toX': 2 * (12.5 + 3.5) - 2})
la.prop('k83-stair', 'spiral-stair', m11(10.25, 13.75), 'K83a', dims={'r': 7, 'rise': 40})   # the K83 spiral climbs on from the landing's south end
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
for i, x in enumerate((20.8, 21.4, 22)): la.prop(f'cask-n-{i}', 'wine-cask', m11(x, 14.75), 'K63')
for i, y in enumerate((14.8, 15.2, 15.6, 16, 16.4, 16.8)): la.prop(f'cask-e-{i}', 'wine-cask', m11(22.7, y), 'K63')
for i, x in enumerate((20, 20.6, 21.2)): la.prop(f'cask-s-{i}', 'wine-cask', m11(x, 16.8), 'K63')
la.hidden('crack-k63', 'niche', m11(19.6, 16.7), 'K63', 'A thin crack low in the west wall, near its south corner, reaches the high tower stair (K18); far too narrow to pass')
la.note('K63-note', m11(21, 15.25), 'K63', 'Three casks north, six east, three south; the card reading may place a treasure here. Cyrus keeps the rats as pets.')
la.hidden('elev-plate', 'pressure-plate', m11(16.5, 17), 'K61', 'Elevator trap: 400 lb on the floor drops portcullises and lifts the car; the counterweight falls in the east half')
la.note('K61-note', m11(16.5, 18), 'K61', 'A 10 × 30 ft corridor; the spiral stair (K21) is south, a wooden door north.')
for i, (x, y) in enumerate([(7, 18.8), (8.5, 18.8), (10, 18.8), (11.5, 18.8), (7, 20.7), (8.5, 20.7), (10, 20.7), (11.5, 20.7)]):
    la.prop(f'cot-k69-{i}', 'pallet', m11(x, y), 'K69')
la.creature('skeletons-k69', 'skeleton', m11(9, 19.75), 'K69', 'Ten skeletons leap from the alcoves at the midpoint of the hall')
la.light('K62-fog', m11(15.5, 15), 'candle', 5, 10, y=2); la.light('K65-fire', m11(18.6, 12.4), 'torch', 10, 20, y=3); la.light('K67-chandelier', m11(13, 17.25), 'candle', 10, 20, y=12)
cobwebs(la, R(m11, 11.5, 14.5, 19.5, 15.5), 'K62', y=8, n=2)

# ================================================================== DUNGEON AND CATACOMBS (-80, map 12)
d = Level('dungeon', 'Dungeon and catacombs (-80 ft)', -80, 40, ambient='darkness', interior='rubble', exterior='rubble', north='-z')
d.room('K18', 'High Tower Staircase (foot)', oct3(22.5, 23, 1.5), 'flagstone', page=pg('K18'), ceilingFt=40)
d.prop('k18-stair', 'spiral-stair', m3(22.5, 23), 'K18', dims=spiral(12, 40, 'K18'))
# The plate puts the north cells (K74e-h) inside the south tower's footprint; the stair's foot is the slot of the tower
# left between the cells (x 190) and the catacombs (x 200), where it comes down into the east end of the dungeon hall
d.room('K21', 'South Tower Stair (foot)', rect(38, 43, 40, 51), 'flagstone', page=pg('K21'), ceilingFt=40)  # whole cells: its walls are the cells' and the catacombs'
d.prop('k21-stair', 'spiral-stair', (39, 47), 'K21', dims={'r': 4.5, 'rise': 40})
d.room('K83', 'Spiral Stair (foot)', OCT(m12, 14, 20, 1), 'flagstone', page=pg('K83'), ceilingFt=40)
d.prop('k83-stair', 'spiral-stair', m12(14, 20), 'K83', dims={'r': 8, 'rise': 40})
d.room('K73', 'Dungeon Hall', R(m12, 15, 29.5, 19, 30.5), 'shallow-water', page=pg('K73'), ceilingFt=8, difficult=True)   # from the K21 stair's foot west to the torture chamber
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
d.room('K82', 'Marble Slide', R(m12, 18, 17.5, 18.5, 25.5), 'flagstone', page=pg('K82'), ceilingFt=6)   # the chute from under the tunnel down to the flooded cell
# the hall north of the brazier room: the western stair's foot, the centre stair's door and the K83 spiral all open on it
d.room('K78-h', 'Hall of the Three Stairs', [m12(11, 16), m12(12, 16), m12(12, 17.5), m12(13, 17.5), m12(13, 21.5), m12(11, 21.5)], 'flagstone', page=pg('K78'), ceilingFt=10)
Op(d, m12, (15, 29.5), (15, 30.5)); Op(d, m12, (19, 29.5), (19, 30.5)); Dr(d, m12, (12, 27), (13, 27), id='K77-door'); Dr(d, m12, (12, 24.5), (13, 24.5), id='K78-south'); Dr(d, m12, (12, 21.5), (13, 21.5), id='K78-north')
Dr(d, m12, (12, 17.5), (13, 17.5), id='K80-door'); Op(d, m12, (17, 16.5), (17, 17.5)); Dr(d, m12, (29, 16.5), (29, 17.5), id='K81-stone-door')
Op(d, m12, (11, 16), (12, 16)); arch(d, m12(13, 19.625), m12(13, 20.375)); arch(d, m3(24, 22.5), m3(24, 23.5)); d.secret(m12(18, 25.5), m12(18.5, 25.5), 'slide-end', 'The chute ends in a one-way secret door into the flooded cell', 'K82', extra=True)
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
ORIG_KEYS = {lv.id: [r[0] for r in lv.rooms] for lv in levels}   # each room's key before the per-floor renaming below

# Rooms the plates register over a tower's octagon (the K18 tower over K14's strip, over the shafts K31a/K31b and the
# trapworks K31, over the wine cellar K63; the K83 turret over the bedchamber's corner): the tower stands, the room
# stops at its side, so no wall of the room runs through the tower. A room that holds a tower whole (the catacombs round
# the K18 stair's foot) keeps its outline. The hall of bones and the guards' quarters overlap by one 5-ft corner: the
# quarters give it up.
from shapely.geometry import Polygon as _SP
def carve(lv, tower_keys):
    towers_ = [_SP(poly) for key, _, poly, _, _ in lv.rooms if key in tower_keys]
    for i, (key, name, poly, floor, extra) in enumerate(lv.rooms):
        if key in tower_keys: continue
        P = _SP(poly)
        for T in towers_:
            if P.intersection(T).area > 0.01 and not P.contains(T):
                Q = P.difference(T)
                if Q.geom_type == 'Polygon' and not Q.interiors:
                    P = Q.simplify(1e-6)
        if not P.equals(_SP(poly)):
            lv.rooms[i] = (key, name, [(round(x, 4), round(z, 4)) for x, z in list(P.exterior.coords)[:-1]], floor, extra)
for lv in levels: carve(lv, {'K12-n', 'K12-s', 'K18', 'K20', 'K21', 'K83'})
_i = next(i for i, r in enumerate(la.rooms) if r[0] == 'K69')
_k = next(r for r in la.rooms if r[0] == 'K67')
la.rooms[_i] = la.rooms[_i][:2] + ([(round(x, 4), round(z, 4)) for x, z in list(_SP(la.rooms[_i][2]).difference(_SP(_k[2])).exterior.coords)[:-1]],) + la.rooms[_i][3:]
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
  'K4': ("A carriage house of stone, shut by a pair of wooden doors on hinges.", "The black carriage with glass windows and brass lanterns; the horses are elsewhere."),
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

OPENING = {'door', 'window', 'secret-door'}
def free_openings(lvj):
    """Half-cell plans (octagons, plate-registered rooms) leave room-edge walls running straight through a door, bars
    or secret door that sits on a different cell split, or is stamped as an extra wall. Cut every non-opening wall that
    lies along an opening or an arch for more than 1 ft, keeping the pieces either side, so each leaf is free in its own
    gap and each arch is open."""
    for w in lvj['walls']:
        if w['id'] in DOOR_OPEN: w['open'] = DOOR_OPEN[w['id']]
    opens = [w for w in lvj['walls'] if OPENING & set(w['flags'])]
    opens += [{'a': [a[0] * 5, a[1] * 5], 'b': [b[0] * 5, b[1] * 5]} for a, b in ARCH.get(lvj['id'], [])]
    out, cut = [], 0
    for w in lvj['walls']:
        if OPENING & set(w['flags']): out.append(w); continue
        (ax, az), (bx, bz) = w['a'], w['b']; L = math.hypot(bx - ax, bz - az)
        if L < 1e-6: out.append(w); continue
        ux, uz = (bx - ax) / L, (bz - az) / L
        keep = [(0.0, L)]
        for o in opens:
            if any(abs((px - ax) * uz - (pz - az) * ux) > 0.3 for px, pz in (o['a'], o['b'])): continue
            t0, t1 = sorted(((px - ax) * ux + (pz - az) * uz) for px, pz in (o['a'], o['b']))
            if min(L, t1) - max(0.0, t0) <= 1: continue
            keep = [q for s0, s1 in keep for q in ((s0, min(s1, t0)), (max(s0, t1), s1)) if q[1] - q[0] > 0.25]
        if keep == [(0.0, L)]: out.append(w); continue
        cut += 1
        for i, (s0, s1) in enumerate(keep):
            nw = OrderedDict(w); nw['id'] = w['id'] if i == 0 else f"{w['id']}-{'abcdefgh'[i]}"
            nw['a'] = [round(ax + ux * s0, 3), round(az + uz * s0, 3)]; nw['b'] = [round(ax + ux * s1, 3), round(az + uz * s1, 3)]
            out.append(nw)
    lvj['walls'] = out
    return cut
print('walls cut free of openings:', {lvj['id']: n for lvj in scene['levels'] if (n := free_openings(lvj))})
# The straight stairs' runs (fromX/toX, fromZ/toZ) are written above in 5-ft cells like every other coordinate here,
# but the stair mesh reads them as feet: convert, or each flight is drawn near the castle's north-west corner.
for lvj in scene['levels']:
    for o in lvj['objects']:
        if o['kind'] == 'stairs-straight':
            for k in ('fromX', 'toX', 'fromZ', 'toZ'):
                if k in o['dims']: o['dims'][k] = round(o['dims'][k] * 5, 3)

def lk(id, kind, a_level, a, b_level, b): return OrderedDict(id=id, kind=kind, **{'from': {'level': a_level, 'pos': [a[0] * 5, a[1] * 5]}, 'to': {'level': b_level, 'pos': [b[0] * 5, b[1] * 5]}})
# Where each stair, ladder and trapdoor stands on each floor, in 5-ft cells. The app takes a link when the party stands
# within 5.5 ft of its end and lands it in the cell holding the other end; it does not stop at that landing, so no
# landing may stand on another link's end, and the cell the party lands in must leave a step that takes no stair. So
# each end sits on a cell corner (the landing cell lies to its south-east, a step on leaves it 7.9 ft behind), and a
# tower stair on a floor it passes keeps its way down (where the party arrives from below) apart from its way up: west
# and east of the K20 and K21 wells, north-east and south-west of K18's (5 ft in from its wall, which takes 2 ft of the
# well: walls with a body, below); in the small K64 and K83 rooms, opposite corners.
UP20, DN20, SIDE20 = (38, 29), (34, 29), (36, 31)    # K20: the stair up, the landing from below, the K34 ladder's door
UP18, DN18 = (44, 39), (42, 41)                      # K18: 5 ft in from the tower's 4-ft wall
UP21, DN21, UP21g, DN21g = (40, 47), (36, 47), (39, 45), (36, 46)   # K21 (smaller on the main floor: its way up 5 ft in from the wall)
UP64, DN64 = (31, 48), (33, 46)                      # K64's room, 15 ft square
UP83, DN83 = (26, 32), (28, 30)                      # K83's turret
scene['links'] = [
    lk('lk-grand', 'stairs', 'ground', (30, 32), 'landing', (30, 23)),
    lk('lk-k19-w', 'stairs', 'landing', (29, 20), 'court', (23, 34)), lk('lk-k19-e', 'stairs', 'landing', (34, 20), 'court', (28, 34)),
    lk('lk-k20a', 'stairs', 'larders', m11(17.5, 9.5), 'ground', DN20),
    lk('lk-k20-court', 'spiral', 'ground', UP20, 'court', DN20), lk('lk-k20-weep', 'spiral', 'court', UP20, 'weeping', DN20),
    lk('lk-k20-spires', 'spiral', 'weeping', UP20, 'spires', DN20), lk('lk-k20-st', 'spiral', 'spires', UP20, 'south-tower', DN20),
    lk('lk-k20-roofs', 'spiral', 'south-tower', UP20, 'tower-roofs', DN20), lk('lk-k20-peak', 'spiral', 'tower-roofs', UP20, 'north-peak', DN20),
    lk('lk-k60a', 'ladder', 'north-peak', m3(19, 16.5), 'north-roof', m3(19, 16.5)),
    lk('lk-k21-dun', 'spiral', 'dungeon', (38, 47), 'larders', DN21), lk('lk-k21-gr', 'spiral', 'larders', UP21, 'ground', DN21g),
    lk('lk-k21-court', 'spiral', 'ground', UP21g, 'court', DN21), lk('lk-k21-weep', 'spiral', 'court', UP21, 'weeping', DN21),
    lk('lk-k21-top', 'spiral', 'weeping', UP21, 'spires', (36, 39)),   # it ends at the north end of K47's east wall
    lk('lk-k48-st', 'spiral', 'spires', (40, 45), 'south-tower', (38, 45)), lk('lk-k48-roof', 'spiral', 'south-tower', (41, 44), 'tower-roofs', (40, 45)),
    lk('lk-k18-court', 'spiral', 'ground', UP18, 'court', DN18), lk('lk-k18-weep', 'spiral', 'court', UP18, 'weeping', DN18),
    lk('lk-k18-spires', 'spiral', 'weeping', UP18, 'spires', DN18), lk('lk-k18-st', 'spiral', 'spires', UP18, 'south-tower', DN18),
    lk('lk-k18-roofs', 'spiral', 'south-tower', UP18, 'tower-roofs', DN18), lk('lk-k18-np', 'spiral', 'tower-roofs', UP18, 'north-peak', DN18),
    lk('lk-k18-nr', 'spiral', 'north-peak', UP18, 'north-roof', DN18), lk('lk-k18-hp', 'spiral', 'north-roof', UP18, 'high-peak', DN18),
    lk('lk-k18-larders', 'spiral', 'dungeon', UP18, 'larders', DN18),   # the new wall closes the stair above this floor (K18)
    lk('lk-k64-gr', 'stairs', 'larders', (30, 50), 'ground', DN64), lk('lk-k64-court', 'stairs', 'ground', UP64, 'court', DN64),
    lk('lk-k64-weep', 'stairs', 'court', UP64, 'weeping', (32, 47)),
    lk('lk-k83-dun', 'spiral', 'dungeon', m12(14, 20), 'larders', (25, 27)), lk('lk-k83-gr', 'spiral', 'larders', (25, 32), 'ground', DN83),
    lk('lk-k83-court', 'spiral', 'ground', UP83, 'court', DN83), lk('lk-k83-weep', 'spiral', 'court', UP83, 'weeping', (27, 31)),
    lk('lk-k23', 'stairs', 'ground', (45, 27), 'larders', m11(20, 11.5)),
    lk('lk-k24', 'stairs', 'ground', (44, 21), 'court', (45, 21)),
    lk('lk-k29', 'stairs', 'ground', (44, 32), 'court', (48, 32)),
    lk('lk-k33', 'stairs', 'court', (31, 22), 'weeping', (24, 26)),
    # the ladder behind K34's mirror climbs to the K20 stair's landing on this floor (p.65): it ends there
    lk('lk-k34-ladder', 'ladder', 'court', (43, 25), 'court', SIDE20),
    lk('lk-elevator', 'elevator', 'larders', m11(16.5, 17), 'spires', (34, 41)),
    lk('lk-k79', 'stairs', 'dungeon', (21, 17), 'larders', (24, 17)),
    # passages within the dungeon: taken from either end the party ends at `to`, the far end
    lk('lk-k80', 'stairs', 'dungeon', (25, 22), 'dungeon', (35, 22)),   # from the door at its foot up into the tunnel (K81)
    lk('lk-k82', 'slide', 'dungeon', m12(23, 17), 'dungeon', (36, 40)),   # the marble slide drops into the flooded cell, K74e
    lk('lk-k51', 'trapdoor', 'spires', K51_HATCH, 'south-tower', K51_HATCH),
    lk('lk-k85', 'stairs', 'dungeon', (54, 19), 'dungeon', (54, 15)), lk('lk-k86', 'stairs', 'dungeon', (54, 56), 'dungeon', (54, 64)),
    lk('lk-k87', 'stairs', 'dungeon', (67, 39), 'dungeon', (77, 39)),
]
scene['nonSpatialKeys'] = []

# ------------------------------------------------------------------ walls with a body (owner 2026-10-19)
# "Notice how the walls in Ravenloft as they are are like 0 mm thin. That shouldn't be the case. They should be
# proportionately sized walls where possible. Borrowing from the space around them and kind of distorting the place just
# slightly to make it logical." Every wall the castle draws gets a thickness by what it is, and takes it from the space
# that can spare it (thickwalls.py does the plan work; the app draws, joins and blocks the bodies, core/wallBody.ts):
#   the curtain wall: 20 ft, the whole band the plates draw between the courtyard's face and the outer face, solid;
#   the keep's outer walls: 5 ft from the dungeon to the court of the count, 4 ft on the rooms of weeping, 3 ft above
#     (a wall thins as it rises); the carriage house's walls 3 ft; each takes all of its thickness from the open side
#     (the void outside the keep, the courtyard, the parapet walk, the rock round the cellars), never from the room;
#   the stair towers and the turrets: 4 ft, centred on their octagons (the stairs inside keep their 5-ft treads);
#   partitions between two rooms: 2 ft of stone, 1 ft of panelling on the panelled floors, centred, except where a
#     corridor or a stair beside it would fall below one clear 5-ft cell: there the wall takes all of its thickness from
#     the room on the other side and the narrow way keeps its width;
#   the courtyard's own walls (K2's gate walls), the open roofs' and the overlook's parapets: 3 ft; railings 0.75 ft.
import thickwalls as TW
from shapely.geometry import Point as _Pt, Polygon as _Poly, LineString as _Ln

T_CURTAIN, T_TOWER, T_YARD, T_RAIL, T_FREE = 20, 4, 3, 0.75, 2
T_MIN = 1                           # the thinnest wall that stands between a room and anything (a panelled partition)
T_KEEP = {'dungeon': 5, 'larders': 5, 'ground': 5, 'landing': 5, 'court': 5, 'weeping': 4}   # 3 ft above
T_PART = {'paneling': 1, 'paneling-dusty': 1}                                                 # 2 ft for stone
OPEN_AIR = {'K1', 'K1-bridge', 'K3', 'K3-s', 'K5', 'K6', 'K46-w', 'K46-n', 'K46-s', 'K46-e', 'K53-w', 'K53-n', 'K53-s', 'K57', 'K58', 'K60a'}
TOWER_KEYS = {'K12-n', 'K12-s', 'K18', 'K20', 'K21', 'K83', 'K57', 'K59', 'K60', 'K60a'}
OUTBUILDING = {'K4'}
CURTAIN_OUT = (0, 0, 380, 340)      # the curtain's outer face (ft); its inner face is the courtyard's edge, 20 ft in
CLEAR = 5                           # one clear cell: no corridor or stair is left narrower

def _stairs(lvj):
    """Where the level's stairs stand in plan: straight flights as rectangles, spirals as discs (shapely)."""
    out = []
    for o in lvj['objects']:
        d = o.get('dims') or {}
        if o['kind'] == 'stairs-straight' and d.get('rise', 0) >= 1:
            w2 = d.get('w', 5) / 2
            if 'fromX' in d: out.append(_Poly([(d['fromX'], o['pos'][2] - w2), (d['toX'], o['pos'][2] - w2), (d['toX'], o['pos'][2] + w2), (d['fromX'], o['pos'][2] + w2)]))
            elif 'fromZ' in d: out.append(_Poly([(o['pos'][0] - w2, d['fromZ']), (o['pos'][0] + w2, d['fromZ']), (o['pos'][0] + w2, d['toZ']), (o['pos'][0] - w2, d['toZ'])]))
        elif o['kind'] == 'spiral-stair' and d.get('rise', 0) >= 1:
            out.append(_Pt(o['pos'][0], o['pos'][2]).buffer(d.get('r', 6), 16))
    return out

COURTYARD = {'K1', 'K3', 'K3-s', 'K5'}   # the keep's edge on them is the keep's outer wall
G_FILL = 12                             # a slot of void this narrow between two walls is masonry: their bodies meet in it
CURTAIN_IN = (20, 20, 360, 320)         # the courtyard's face of the curtain wall (ft)

def on_curtain(w):
    x0, z0, x1, z1 = CURTAIN_IN
    (ax, az), (bx, bz) = w['a'], w['b']
    return (ax == bx and ax in (x0, x1) and z0 <= min(az, bz) and max(az, bz) <= z1) or (az == bz and az in (z0, z1) and x0 <= min(ax, bx) and max(ax, bx) <= x1)

def _plan_walls(lvj, keys):
    """Each drawn wall's thickness and side: (t, 0) centred, (t, +1) all on its left, (t, -1) all on its right."""
    rooms = [(_Poly(r['polygon']).buffer(0), keys[i], r) for i, r in enumerate(lvj['rooms'])]
    stairs = _stairs(lvj)
    ext = T_KEEP.get(lvj['id'], 3)
    def room_at(p):
        hit = [(poly.area, k, r, poly) for poly, k, r in rooms if poly.contains(_Pt(p))]
        return min(hit, key=lambda h: h[0])[1:] if hit else None
    def on_edge(w, key):
        for poly, k, r in rooms:
            if k != key: continue
            ring_ = list(poly.exterior.coords)
            for q0, q1 in zip(ring_, ring_[1:]):
                e = {'a': q0, 'b': q1}
                if TW.seg(e)[2] > 1e-6 and all(TW.on_line(p, e)[0] and -TW.EPS <= TW.on_line(p, e)[1] <= TW.seg(e)[2] + TW.EPS for p in (w['a'], w['b'])):
                    return True
        return False
    plan, notes, void_side, bounds_, ring_ids = {}, [], {}, {}, set()
    def roomy(key):
        """A stair tower with space inside for its ring: the octagon's flat sides less the ring's thickness still clear
        its spiral stair."""
        poly = next(p for p, k, r in rooms if k == key)
        c = poly.centroid
        inner = min(_Ln([q0, q1]).distance(c) for q0, q1 in zip(list(poly.exterior.coords), list(poly.exterior.coords)[1:])) - T_TOWER
        rs = [o['dims'].get('r', 6) for o in lvj['objects'] if o['kind'] == 'spiral-stair' and (o.get('dims') or {}).get('rise', 0) >= 1 and poly.contains(_Pt(o['pos'][0], o['pos'][2]))]
        return bool(rs) and all(inner >= r - 0.01 for r in rs)   # a stair tower; the turrets (no stair) stay centred
    def narrow(w, sgn, t, key, need=None):
        """The room on that side would fall below one clear cell if its walls took `need` (default t) of its depth, or
        a stair stands in the band of depth t the wall would take beside it."""
        a, b, L, u, n = TW.seg(w)
        poly = next(p for p, k, r in rooms if k == key)
        deep = min(TW.depth(poly, (a[0] + u[0] * L * f + n[0] * sgn * 0.3, a[1] + u[1] * L * f + n[1] * sgn * 0.3), (n[0] * sgn, n[1] * sgn)) + 0.3 for f in (0.25, 0.5, 0.75))
        band = _Poly([a, b, (b[0] + n[0] * sgn * (t + 0.25), b[1] + n[1] * sgn * (t + 0.25)), (a[0] + n[0] * sgn * (t + 0.25), a[1] + n[1] * sgn * (t + 0.25))])
        return deep < CLEAR + (t if need is None else need) - 0.01 or any(st.intersection(band).area > 0.25 for st in stairs)
    for w in lvj['walls']:
        if not TW.drawn(w) or TW.seg(w)[2] < 1e-6: continue
        a, b, L, u, n = TW.seg(w)
        h = w.get('heightFt')
        # what lies either side: the room under points just off the wall's middle stretch (its left, then its right)
        side = {}
        for sgn in (1, -1):
            hits = [room_at((a[0] + u[0] * L * f + n[0] * sgn * 0.3, a[1] + u[1] * L * f + n[1] * sgn * 0.3)) for f in (0.25, 0.5, 0.75)]
            hits = [x for x in hits if x]
            side[sgn] = max(hits, key=lambda x: sum(1 for y in hits if y[0] == x[0])) if len(hits) >= 2 else None
        kind = {s: ('void' if side[s] is None else 'open' if side[s][0] in OPEN_AIR else 'room') for s in (1, -1)}
        bounds_[w['id']] = {next(i for i, x in enumerate(rooms) if x[2] is side[s][1]) for s in (1, -1) if side[s]}
        if h is not None and h <= 4:
            plan[w['id']] = (T_RAIL, 0); continue
        tower = next((side[s][0] for s in (1, -1) if side[s] and side[s][0] in TOWER_KEYS and len(side[s][1]['polygon']) >= 8 and on_edge(w, side[s][0])), None)
        towards = lambda want: next(s for s in (1, -1) if kind[s] == want)
        ks = sorted(kind.values())
        if lvj['id'] == 'ground' and on_curtain(w):
            plan[w['id']] = (T_CURTAIN, towards('void') if 'void' in ks else 0); continue
        if tower:
            # the plan's octagon is a stair tower's outer face: the ring takes its thickness from the tower where the stair
            # inside keeps its treads clear (K21 above the main floor), and is centred on the octagon where it would not
            # (K18, K20, K83) and on the turrets
            s_in = next(s for s in (1, -1) if side[s] and side[s][0] == tower)
            plan[w['id']] = (T_TOWER, s_in if roomy(tower) else 0); ring_ids.add(w['id']); continue
        if ks == ['room', 'void']:
            key = next(side[s][0] for s in (1, -1) if kind[s] == 'room')
            plan[w['id']] = (T_YARD if key in OUTBUILDING else ext, towards('void'))
        elif ks == ['open', 'room']:
            # the open side (courtyard, parapet walk, roof) keeps a flat face on its plan line, as the stretches backed
            # by void do: the wall takes its thickness from the room, unless that would leave the room too narrow
            key = next(side[s][0] for s in (1, -1) if kind[s] == 'room')
            t = T_YARD if key in OUTBUILDING else ext
            plan[w['id']] = (t, towards('open') if narrow(w, towards('room'), t, key) else towards('room'))
        elif ks == ['open', 'void']:
            yard = next(side[s][0] for s in (1, -1) if kind[s] == 'open')
            plan[w['id']] = (ext if yard in COURTYARD else T_YARD, towards('void'))
        elif ks == ['open', 'open']:
            plan[w['id']] = (T_YARD, 0)
        elif ks == ['void', 'void']:
            plan[w['id']] = (T_FREE, 0)
        else:   # a partition between two rooms (or inside one)
            t = T_PART.get(w.get('material'), 2)
            nar = {sgn: narrow(w, sgn, t / 2, side[sgn][0], need=t) for sgn in (1, -1)}   # a corridor's two walls take t
            if nar[1] and not nar[-1]: plan[w['id']] = (t, -1)
            elif nar[-1] and not nar[1]: plan[w['id']] = (t, 1)
            else:
                plan[w['id']] = (t, 0)
                if nar[1]: notes.append(f"{w['id']} between {side[1][0]} and {side[-1][0]}: both sides narrow, centred")
        t_, s_ = plan[w['id']]
        if s_ and kind[s_] == 'void': void_side[w['id']] = s_
    # a narrow slot of void between two walls is solid: each wall whose body goes into it takes it up to the other's body
    # (half each when both grow into it), so the plates' thin gaps between rooms and the keep's face close up
    by_id = {w['id']: w for w in lvj['walls']}
    cells = {}
    for w in lvj['walls']:
        if w['id'] in plan:
            for c in TW._cells(w): cells.setdefault(c, []).append(w['id'])
    def gap(w, sgn):
        a, b, L, u, n = TW.seg(w)
        hits = []
        for f in (0.2, 0.5, 0.8):
            o = (a[0] + u[0] * L * f, a[1] + u[1] * L * f)
            ray = _Ln([o, (o[0] + n[0] * sgn * G_FILL, o[1] + n[1] * sgn * G_FILL)])
            near = {i for c in TW._cells({'a': ray.coords[0], 'b': ray.coords[1]}) for i in cells.get(c, ())}
            best = None
            for vid in near:
                v = by_id[vid]
                if v is w: continue
                x = ray.intersection(_Ln([tuple(v['a']), tuple(v['b'])]))
                if x.is_empty or x.geom_type != 'Point': continue
                dd = _Pt(o).distance(x)
                if dd > 0.05 and (best is None or dd < best[0]): best = (dd, vid)
            if best is None: return None
            hits.append(best)
        if max(h[0] for h in hits) - min(h[0] for h in hits) > 0.5 or len({h[1] for h in hits}) > 1 and False: return None
        v = by_id[hits[1][1]]
        if abs(TW.seg(v)[4][0] * TW.seg(w)[4][0] + TW.seg(v)[4][1] * TW.seg(w)[4][1]) < 0.98: return None
        return sum(h[0] for h in hits) / 3, v
    fill = {}
    for wid, sgn in void_side.items():
        g_ = gap(by_id[wid], sgn)
        if not g_: continue
        g, v = g_
        tv, sv = plan[v['id']]
        # how far the other wall's own body reaches into the slot
        toward_me = TW.side_of(v, TW.seg(by_id[wid])[0]) if TW.seg(v)[2] else 0
        mutual = v['id'] in void_side and void_side[v['id']] == toward_me and gap(v, toward_me) is not None
        reach = 0 if mutual else tv if sv == toward_me else tv / 2 if sv == 0 else 0
        t = g / 2 if mutual else g - reach
        if 0.5 <= t <= G_FILL: fill[wid] = round(t, 3)
    for wid, t in fill.items(): plan[wid] = (t, plan[wid][1])
    # a wall borrows only the void that is free: where a room lies closer on that side (a sliver of void between a
    # rectangle and a tower's side), the body stops short of it. On a long wall the free depth is read along its stretch
    # clear of its two joints: a room that only touches the wall's end (an octagonal tower's corner on the keep's wall,
    # where the plan splits the wall) is the joint's business, where the two bodies meet as one masonry, and must not
    # thin the whole keep wall to a sheet. A short wall (no longer than twice its thickness: a scrap between a tower and
    # a room's corner) keeps clear of every room beside it. Never below T_MIN.
    allrooms = [poly for poly, k, r in rooms]
    for wid, sgn in void_side.items():
        t, s_ = plan[wid]
        a, b, L, u, n = TW.seg(by_id[wid])
        free = t
        def depth_of(geom):
            d = t
            for g_ in getattr(geom, 'geoms', [geom]):
                if g_.is_empty: continue
                cs_ = g_.exterior.coords if g_.geom_type == 'Polygon' else g_.coords
                d = min(d, min(((q[0] - a[0]) * n[0] + (q[1] - a[1]) * n[1]) * sgn for q in cs_))
            return d
        if L <= 2 * t:
            band = _Poly([a, b, (b[0] + n[0] * sgn * t, b[1] + n[1] * sgn * t), (a[0] + n[0] * sgn * t, a[1] + n[1] * sgn * t)])
            for poly in allrooms:
                x = band.intersection(poly)
                for g_ in (getattr(x, 'geoms', [x]) if x.area > 0.01 else []):
                    if g_.geom_type == 'Polygon' and g_.area > 0.01: free = min(free, depth_of(g_))
        else:
            for k in range(9):
                s = t + (L - 2 * t) * k / 8
                o = (a[0] + u[0] * s + n[0] * sgn * 0.02, a[1] + u[1] * s + n[1] * sgn * 0.02)
                ray = _Ln([o, (o[0] + n[0] * sgn * t, o[1] + n[1] * sgn * t)])
                for poly in allrooms:
                    x = ray.intersection(poly)
                    if not x.is_empty: free = min(free, depth_of(x))
        if free < t - 0.01:
            plan[wid] = (max(round(free, 3), T_MIN), s_)
            notes.append(f"{wid}: only {free:.2f} ft of void free beside it, its body takes {max(free, T_MIN):.2f}")
    return plan, notes, bounds_, ring_ids

def thicken(lvj, keys):
    """Give the level's walls their bodies and its rooms their clear floors. Returns the floor pieces a wall cut off
    a room (plain walkable floor) and a short report."""
    if lvj['id'] == 'ground':   # the whole courtyard face of the curtain is 90 ft (authorlib's cell keys miss a few)
        for w in lvj['walls']:
            if on_curtain(w) and not set(w['flags']) & TW.UNCUT: w['heightFt'] = WALL_H
    # a stretch two walls share keeps the one that matters: a door's, the curtain's, a tower's side, then a room's edge
    towers_ = [_Poly(r['polygon']) for i, r in enumerate(lvj['rooms']) if keys[i] in TOWER_KEYS and len(r['polygon']) >= 8]   # the octagons
    ring_ = lambda w: any(_Ln(list(T.exterior.coords)).buffer(0.3).contains(_Ln([tuple(w['a']), tuple(w['b'])])) for T in towers_)
    rank = lambda w: 4 if set(w['flags']) & TW.UNCUT else 3 if (lvj['id'] == 'ground' and on_curtain(w)) else 2 if ring_(w) else 0
    lvj['walls'], dup = TW.dedupe(lvj['walls'], rank, tol=0.3)
    if lvj['id'] == 'ground':
        # the curtain is one 20-ft body from the courtyard's face to its outer face: the outer face's own wall goes, and so
        # do the walls the plan draws inside the band (the gate passage's and the postern's sides, the bridge's and the
        # overlook's ends against the outer face): the curtain's body is their wall
        x0, z0, x1, z1 = CURTAIN_OUT
        X0, Z0, X1, Z1 = CURTAIN_IN
        in_band = lambda p: x0 - 0.01 <= p[0] <= x1 + 0.01 and z0 - 0.01 <= p[1] <= z1 + 0.01 and not (X0 + 0.01 < p[0] < X1 - 0.01 and Z0 + 0.01 < p[1] < Z1 - 0.01)
        band = lambda w: not on_curtain(w) and not set(w['flags']) & TW.UNCUT and in_band(w['a']) and in_band(w['b']) and in_band(((w['a'][0] + w['b'][0]) / 2, (w['a'][1] + w['b'][1]) / 2))
        lvj['walls'] = [w for w in lvj['walls'] if not band(w)]
    lvj['walls'], stubs = TW.absorb_stubs(lvj['walls'])
    pts = [tuple(q) for r in lvj['rooms'] for q in r['polygon']] + [tuple(w[e]) for w in lvj['walls'] for e in ('a', 'b')]
    lvj['walls'], split = TW.split_at(lvj['walls'], pts)
    plan, notes, bounds_, ring_ids = _plan_walls(lvj, keys)
    off = TW.apply(lvj['walls'], plan)
    # where the plan's rectangles and a tower's octagon nearly meet, the joints settle onto the walls they stand in: a
    # room's corner inside a ring runs on to the ring's line, and an octagon's side left too short for its two corners
    # goes, its neighbours meeting at one mitred corner
    lvj['walls'], gone0 = TW.swallowed(lvj['walls'])   # (a scrap inside a thicker body would hold a joint apart)
    lvj['walls'], met, scraps = TW.meet_bodies(lvj['walls'])
    lvj['walls'], collapsed = TW.collapse_stubs(lvj['walls'])
    if met or collapsed: notes.append(f"{met} wall ends run on to the wall they stood in ({scraps} scraps left inside it gone), {collapsed} short corner pieces taken into their neighbours")
    # no body may stand in a room it does not bound (a corner's mitre reaching past a tower's side): reported
    fps_ = TW.footprints(lvj['walls'])
    for i, r in enumerate(lvj['rooms']):
        P = _Poly(r['polygon']).buffer(0)
        for w, f in zip(lvj['walls'], fps_):
            bd = _Poly(f).buffer(0) if f else None
            if bd is None or set(w['flags']) & set(TW.DOORISH) or i in bounds_.get(w['id'], ()): continue
            x = bd.intersection(P).area
            if x > 0.5: notes.append(f"{w['id']} ({w['thicknessFt']} ft) stands {x:.1f} sq ft into {r['key']}, which it does not bound")
    same = lambda v, w: v['flags'] == w['flags'] == ['normal'] and all(v.get(k) == w.get(k) for k in ('heightFt', 'material', 'thicknessFt', 'offsetFt'))
    lvj['walls'], fused = TW.merge_runs(lvj['walls'], same)
    lvj['walls'], gone = TW.swallowed(lvj['walls'])
    gone += gone0
    doors_take_their_walls(lvj['walls'], ring_ids)
    lvj['walls'] = [w for w in lvj['walls'] if TW.seg(w)[2] >= 0.1]   # no wall of no length
    extra = TW.inset_rooms(lvj['rooms'], lvj['walls'])
    notes += fit_stairs(lvj)
    notes += props_out_of_walls(lvj)
    return extra, f"{lvj['id']}: {len(plan)} walls with a body ({split} split where their neighbours change, {stubs} stubs taken into a door), {dup} cut free of a wall in their line, {off} standing off their line, {fused} fused, {gone} inside a thicker body dropped" + ''.join('\n  ' + x for x in notes)

def doors_take_their_walls(walls, ring_ids):
    """A door, window or secret door is an opening in the wall it stands in: it takes that wall's body and its stone (the
    thickest wall left running on from it in its line), so it cuts through the whole depth and the masonry over it is
    the wall's own. A tower's door is its ring's: the ring's thickness, of the ring's stone."""
    touching = lambda w, v: any(math.hypot(p[0] - q[0], p[1] - q[1]) <= TW.EPS for p in (w['a'], w['b']) for q in (v['a'], v['b']))
    plain = [v for v in walls if not set(v['flags']) & TW.UNCUT and TW.drawn(v) and v.get('thicknessFt')]
    for w in walls:
        if not set(w['flags']) & TW.UNCUT or not w.get('thicknessFt'): continue
        if w['id'] in ring_ids:
            ring = [v for v in plain if v['id'] in ring_ids and touching(w, v)]
            if ring: w['material'] = ring[0].get('material', w.get('material'))
            continue
        on = [v for v in plain if TW.collinear(w, v) and touching(w, v)]
        if not on: continue
        v = max(on, key=lambda v: v['thicknessFt'])
        u, uv = TW.seg(w)[3], TW.seg(v)[3]
        side = (1 if uv[0] * u[0] + uv[1] * u[1] > 0 else -1)
        w['thicknessFt'] = v['thicknessFt']
        w.pop('offsetFt', None)
        if v.get('offsetFt'): w['offsetFt'] = round(v['offsetFt'] * side, 3)
        if v.get('material'): w['material'] = v['material']

def fit_stairs(lvj):
    """A stair a body still reaches into (a flight running along a tower's side, a spiral wider than its tower's clear
    well) is fitted to the clear space: a flight narrows from the side or shortens from the end the wall stands on, a
    spiral's treads end at the wall's face and its well shrinks to keep 5-ft treads. Never below one clear cell."""
    from shapely.ops import unary_union as _uu
    fps = TW.footprints(lvj['walls'])
    solid = _uu([_Poly(f).buffer(0) for w, f in zip(lvj['walls'], fps) if f and not set(w['flags']) & set(TW.DOORISH)])
    notes = []
    for o in lvj['objects']:
        d = o.get('dims') or {}
        if o['kind'] == 'spiral-stair' and d.get('rise', 0) >= 1:
            c = _Pt(o['pos'][0], o['pos'][2]); r = d.get('r', 6)
            if solid.intersection(c.buffer(r, 32)).area < 0.25: continue
            clear = math.floor(solid.boundary.distance(c) * 4) / 4 if not solid.contains(c) else 0
            if clear < CLEAR / 2: notes.append(f"{o['id']}: a wall stands within {clear} ft of the spiral's axis"); continue
            d['r'] = clear
            if d.get('r0', 0) > clear - CLEAR: d['r0'] = max(0, clear - CLEAR)
            notes.append(f"{o['id']}: spiral fitted to its clear well, r {r} -> {clear}" + (f", well {d['r0']}" if 'r0' in d else ''))
        elif o['kind'] == 'stairs-straight' and d.get('rise', 0) >= 1:
            ax = 'X' if 'fromX' in d else 'Z'
            lo, hi = sorted((d['from' + ax], d['to' + ax])); c = o['pos'][2] if ax == 'X' else o['pos'][0]; w2 = d.get('w', 5) / 2
            rect = lambda lo, hi, c0, c1: _Poly([(lo, c0), (hi, c0), (hi, c1), (lo, c1)]) if ax == 'X' else _Poly([(c0, lo), (c1, lo), (c1, hi), (c0, hi)])
            box = [lo, hi, c - w2, c + w2]
            if solid.intersection(rect(*box)).area < 0.25: continue
            for _ in range(4):
                x = solid.intersection(rect(*box))
                if x.area < 0.25: break
                parts = [g_ for g_ in getattr(x, 'geoms', [x]) if g_.area > 0.01]     # not the slivers a wall only touches
                bx = (min(g_.bounds[0] for g_ in parts), min(g_.bounds[1] for g_ in parts), max(g_.bounds[2] for g_ in parts), max(g_.bounds[3] for g_ in parts))
                along = (bx[0], bx[2]) if ax == 'X' else (bx[1], bx[3]); across = (bx[1], bx[3]) if ax == 'X' else (bx[0], bx[2])
                # cut back the side the wall stands on, whichever loses least
                opts = [(along[1] - box[0], 0), (box[1] - along[0], 1), (across[1] - box[2], 2), (box[3] - across[0], 3)]
                cost = lambda k, a: a * ((box[3] - box[2]) if k < 2 else (box[1] - box[0]))
                k, a = min(((k, a) for a, k in opts), key=lambda t: cost(*t))
                box[k] += a + 0.01 if k in (0, 2) else -(a + 0.01)
            if box[1] - box[0] < CLEAR or box[3] - box[2] < CLEAR or solid.intersection(rect(*box)).area >= 0.25:
                notes.append(f"{o['id']}: could not be fitted clear of the walls"); continue
            if box != [lo, hi, c - w2, c + w2]:
                fwd = d['to' + ax] >= d['from' + ax]
                d['from' + ax], d['to' + ax] = (round(box[0], 3), round(box[1], 3)) if fwd else (round(box[1], 3), round(box[0], 3))
                d['w'] = round(box[3] - box[2], 3); mid = round((box[2] + box[3]) / 2, 3)
                if ax == 'X': o['pos'][2] = mid
                else: o['pos'][0] = mid
                notes.append(f"{o['id']}: flight fitted clear of the walls, {hi - lo:.1f} x {2 * w2:.1f} -> {box[1] - box[0]:.1f} x {box[3] - box[2]:.1f} ft")
    return notes

ON_THE_FACE = {'bricked-window': 0.15, 'niche': 0.3}   # wall-mounted: set on the face; anything else stands clear of it

def props_out_of_walls(lvj):
    """A prop the plan set against a wall's line (statues along a hall, a suit of armour in its alcove, a bricked
    window, a hatch in a room's corner) now stands inside the wall's body: it moves out to the face on its own room's
    side, so it stands in front of the wall as the plan meant."""
    from shapely.ops import nearest_points
    fps = TW.footprints(lvj['walls'])
    solid = [_Poly(f).buffer(0) for w, f in zip(lvj['walls'], fps) if f and not set(w['flags']) & set(TW.DOORISH)]
    floor = [(_Poly(r['polygon']).buffer(0), r['key']) for r in lvj['rooms']]
    notes = []
    for o in lvj['objects']:
        if o['vis'] == 'secret-door' or o['kind'] in ('note', 'spawn'): continue
        p = _Pt(o['pos'][0], o['pos'][2])
        body = next((b for b in solid if b.buffer(-0.05).contains(p)), None)
        if body is None: continue
        mine = [poly for poly, k in floor if k == o.get('key')] or [poly for poly, k in floor]
        # the nearest clear floor of its own room (else any room): just in front of the face
        best = min((nearest_points(poly, p)[0] for poly in mine), key=lambda q: q.distance(p))
        dx, dz = best.x - p.x, best.y - p.y; L = math.hypot(dx, dz) or 1
        m = ON_THE_FACE.get(o['kind'], 1.0)
        o['pos'][0] = round(best.x + dx / L * m, 3); o['pos'][2] = round(best.y + dz / L * m, 3)
        notes.append(f"{o['id']} stood in a wall; now in front of its face, {L + m:.1f} ft over")
    return notes

FLOOR_EXTRA = {}
for lvj in scene['levels']:
    FLOOR_EXTRA[lvj['id']], rep_ = thicken(lvj, ORIG_KEYS[lvj['id']])
    print(rep_)

grid = OrderedDict(schema=1, levels=OrderedDict())
for lvj in scene['levels']:
    grid['levels'][lvj['id']] = OrderedDict(floorPolygons=[r['polygon'] for r in lvj['rooms']] + FLOOR_EXTRA[lvj['id']], type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0.55)

os.makedirs(OUT, exist_ok=True)
json.dump(scene, open(os.path.join(OUT, 'scene.json'), 'w'), indent=1)
json.dump(grid, open(os.path.join(OUT, 'grid.json'), 'w'), indent=1)
nw = sum(len(l['walls']) for l in scene['levels']); no = sum(len(l['objects']) for l in scene['levels']); nr = sum(len(l['rooms']) for l in scene['levels'])
print(f'castle: {len(levels)} levels, {nr} rooms, {nw} walls, {no} objects -> {OUT}')
