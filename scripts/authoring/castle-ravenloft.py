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

# printed pages of the keyed text (from the OCR index)
PAGE = {'K1': 53, 'K2': 53, 'K3': 53, 'K4': 53, 'K5': 53, 'K6': 53, 'K7': 53, 'K8': 54, 'K9': 55, 'K10': 55, 'K11': 56, 'K12': 56,
        'K13': 56, 'K14': 56, 'K15': 56, 'K16': 57, 'K17': 57, 'K18': 57, 'K18a': 57, 'K19': 57, 'K20': 58, 'K20a': 58, 'K21': 58,
        'K22': 58, 'K23': 58, 'K24': 60, 'K29': 61, 'K31a': 62, 'K64': 77, 'K83': 84}
def pg(k): return PAGE.get(k)

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
g.room('K3s', "Servants' Courtyard (south)", [(48, 50), (60, 50), (60, 36), (72, 36), (72, 64), (48, 64)], 'cobble', page=pg('K3'))
g.room('K4', 'Carriage House', rect(62, 4, 72, 10), 'flagstone', page=pg('K4'), ceilingFt=15)
g.room('K5', 'Chapel Garden', rect(60, 30, 72, 36), 'grass', page=pg('K5'))
g.room('K5p', 'Postern', rect(72, 31, 76, 35), 'flagstone', page=pg('K5'))
g.room('K6', 'Overlook', [(76, 30), (84, 30), (86, 32), (86, 34), (84, 36), (76, 36)], 'flagstone', page=pg('K6'))
g.room('K1g', 'Gatehouse Passage', rect(0, 32, 4, 36), 'flagstone', page=pg('K1'))
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
g.room('K12n', 'Turret Post (north-west)', oct3(10.5, 15, 1.5), 'flagstone', page=pg('K12'), ceilingFt=30)
g.room('K12s', 'Turret Post (south-west)', oct3(10.5, 26.5, 1.5), 'flagstone', page=pg('K12'), ceilingFt=30)
g.room('K13n', 'Turret Post Access Hall (north)', rect3(12, 14.5, 15, 15.5), 'flagstone', page=pg('K13'), ceilingFt=15)
g.room('K13w', 'Turret Post Access Hall (west)', rect3(9.5, 16.5, 10.5, 24), 'flagstone', page=pg('K13'), ceilingFt=15)
g.room('K13s', 'Turret Post Access Hall (south)', rect3(12, 26, 16.5, 27), 'flagstone', page=pg('K13'), ceilingFt=15)
g.room('K22', "North Archers' Post", rect3(11, 15.5, 13, 17.5), 'flagstone', page=pg('K22'), ceilingFt=15)
g.room('K11', "South Archers' Post", rect3(10.5, 24, 12, 26), 'flagstone', page=pg('K11'), ceilingFt=15)
g.room('K83', 'Spiral Stair', oct3(14.5, 18.5, 1), 'flagstone', page=pg('K83'), ceilingFt=50)
g.room('K8s', 'Grand Staircase', rect3(15.5, 12.5, 17, 19.5), 'flagstone', page=pg('K8'), ceilingFt=40)
g.room('K7', 'Entry', rect3(13, 20, 15, 22), 'flagstone', page=pg('K7'), ceilingFt=20)
g.room('K8', 'Great Entry', rect3(15, 19.5, 19, 22.5), 'flagstone', page=pg('K8'), ceilingFt=40)
g.room('K14', 'Turret Access Hall', rect3(19, 20, 26, 22), 'flagstone', page=pg('K14'), ceilingFt=15)
g.room('K16', 'North Chapel Access', rect3(24.5, 18, 26, 20), 'flagstone', page=pg('K16'), ceilingFt=15)
g.room('K17', 'South Chapel Access', rect3(24.5, 22, 26, 24), 'flagstone', page=pg('K17'), ceilingFt=15)
g.room('K15', 'Chapel', poly3([(27, 16), (30, 16), (31, 17), (31, 26), (30, 27), (27, 27), (26, 26), (26, 17)]), 'flagstone', page=pg('K15'), ceilingFt=90)
g.room('K9', "Guests' Hall", rect3(15, 22.5, 18, 25.5), 'flagstone', page=pg('K9'), ceilingFt=20)
g.room('K9h', 'Arched Hallway', rect3(18, 23.5, 19.5, 24.5), 'flagstone', page=pg('K9'), ceilingFt=15)
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

levels = [g]

# ------------------------------------------------------------------ descriptions (own wording)
DESC = {
  'K1': ("A wide courtyard of broken flagstones before the keep, its walls rising ninety feet on every side. The doors of the keep stand open under torches.", "Lightning and rain; the gate behind the party swings shut on its own if Strahd wills it."),
  'K2': ("A gate in a wall that runs from the keep to the curtain wall.", "North and south gates: unlocked, heavy."),
  'K3': ("A narrow courtyard between the keep and the eastern wall; a carriage house stands in the corner.", "The door into the keep (K23) is swollen shut: DC 10 Strength."),
  'K3s': ("The courtyard continues round the south-east of the keep.", None),
  'K4': ("A stone carriage house with hinged wooden doors.", "The black carriage with glass windows and brass lanterns; the horses are elsewhere."),
  'K5': ("A struggling garden behind the keep under boarded stained-glass windows.", None),
  'K6': ("A stone balcony beyond the east wall, open to the storm.", "The village lies a thousand feet below. Perception 15: a stone box with three dirty windows juts from the cliff a hundred feet down (K63, the wine cellar)."),
  'K7': ("An entry hall twenty feet deep between two sets of doors, torches guttering in iron sconces. Four stone dragons glare down from the vaulted ceiling.", "The dragons are red dragon wyrmlings: they attack anyone entering from K8 who is not Strahd, never anyone coming in from the courtyard."),
  'K8': ("A great dusty hall under a dome ringed with eight stone gargoyles, columns strung with cobwebs, torches guttering. Bronze doors east and south; a wide staircase climbs north into the dark.", "Gargoyles (8) attack anyone who leaves and returns. Rahadin descends the stair to greet invited guests and leads them to K10."),
  'K9': ("A hall with a suit of armour in a shallow alcove; double doors to the west stand ajar, organ music and bright light spilling through them. An arched hallway runs east.", "The armour is only armour. The east hallway ends at the south tower stair (K21)."),
  'K10': ("A dining hall laid for a feast under a crystal chandelier; a pipe organ thunders at the far wall.", "The food is real but the gracious host is Strahd; the organ plays itself. The scene is a trap of hospitality."),
  'K11': ("A post with arrow slits looking out over the courtyard.", None), 'K22': ("A post with arrow slits looking out over the courtyard.", None),
  'K12n': ("An octagonal turret room thirty feet across under a domed ceiling with faded frescoes; arrow slits in every wall.", None),
  'K12s': ("An octagonal turret room thirty feet across under a domed ceiling with faded frescoes; arrow slits in every wall.", None),
  'K13n': ("A plain hall linking the turrets.", None), 'K13w': ("A plain hall linking the turrets.", None), 'K13s': ("A plain hall linking the turrets.", None),
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
  'K8s': ("A broad staircase of worn stone climbing into darkness.", "Up 30 ft to K19, the grand landing."),
  'K9h': ("An arched hallway twenty feet long.", None),
}

def apply_desc(lvls):
    for lv in lvls:
        for r in lv['rooms']:
            d = DESC.get(r['key'])
            if d:
                r['desc'] = d[0]
                if d[1]: r['dm'] = d[1]

scene = OrderedDict(schema=1, location='K', chapter='ch04', name='Castle Ravenloft', mapPage=53, bookScaleFt=5, ambient='storm', stacked=True)
scene['levels'] = [lv.to_json() for lv in levels]
apply_desc(scene['levels'])
scene['links'] = []
scene['nonSpatialKeys'] = []

grid = OrderedDict(schema=1, levels=OrderedDict())
for lv in levels:
    grid['levels'][lv.id] = OrderedDict(floorPolygons=[[[x * 5, z * 5] for x, z in p] for p in lv.floor_polys], type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0.55)

os.makedirs(OUT, exist_ok=True)
json.dump(scene, open(os.path.join(OUT, 'scene.json'), 'w'), indent=1)
json.dump(grid, open(os.path.join(OUT, 'grid.json'), 'w'), indent=1)
nw = sum(len(l['walls']) for l in scene['levels']); no = sum(len(l['objects']) for l in scene['levels']); nr = sum(len(l['rooms']) for l in scene['levels'])
print(f'castle: {len(levels)} levels, {nr} rooms, {nw} walls, {no} objects -> {OUT}')
