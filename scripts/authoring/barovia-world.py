#!/usr/bin/env python3
"""Barovia world map data: pin positions, roads, rivers, lakes, peaks and woods, measured from the regional
map (book p.35) at 200 dpi, where one quarter-mile hex spans ~17.6 px. Output is in miles, origin top-left.
Only positions and names are recorded; no map art is copied. Yester Hill (Y) lies off the printed crop and is
placed approximately west of the Wizard of Wines."""
import json
from collections import OrderedDict

PX_PER_MILE = 17.6 * 4          # 4 hexes per mile
m = lambda x, y: [round(x / PX_PER_MILE, 2), round(y / PX_PER_MILE, 2)]

HEIGHT = {'K': 1000}  # the Pillarstone of Ravenloft: the castle stands a thousand feet above the valley (p.53)
PINS = [  # key, name, px, type, scenes (built scene paths reachable from here)
  ('A', 'Old Svalich Road', (1258, 507), 'road', []),
  ('B', 'Gates of Barovia (east)', (1222, 470), 'gate', []),
  ('C', 'Svalich Woods', (1203, 537), 'woods', ['ch02/C']),
  ('D', 'River Ivlis', (992, 611), 'river', []),
  ('E', 'Village of Barovia', (992, 537), 'settlement', ['ch03/E', 'ch03/E5', 'appB/death-house']),
  ('F', 'River Ivlis Crossroads', (850, 658), 'crossroads', []),
  ('G', 'Tser Pool Encampment', (798, 546), 'camp', ['ch02/G']),
  ('H', 'Tser Falls', (742, 478), 'falls', []),
  ('I', 'Black Carriage', (745, 424), 'landmark', []),
  ('B2', 'Gates of Barovia (west)', (745, 380), 'gate', []),
  ('J', 'Gates of Ravenloft', (853, 453), 'gate', []),
  ('K', 'Castle Ravenloft', (915, 470), 'castle', ['ch04/K']),
  ('L', 'Lake Zarovich', (470, 210), 'lake', []),
  ('M', 'Mount Baratok', (663, 106), 'peak', []),
  ('N', 'Town of Vallaki', (447, 307), 'settlement', ['ch05/N']),
  ('O', 'Old Bonegrinder', (570, 355), 'landmark', ['ch06/O']),
  ('P', 'Luna River Crossroads', (383, 318), 'crossroads', []),
  ('Q', 'Argynvostholt', (343, 440), 'castle', []),
  ('R', 'Raven River Crossroads', (185, 288), 'crossroads', []),
  ('S', 'Village of Krezk', (53, 261), 'settlement', []),
  ('T', 'Tsolenka Pass', (225, 690), 'pass', []),
  ('U', 'Ruins of Berez', (346, 538), 'ruin', []),
  ('V', "Van Richten's Tower", (230, 225), 'tower', []),
  ('W', 'The Wizard of Wines', (36, 420), 'settlement', []),
  ('X', 'The Amber Temple', (352, 762), 'temple', []),
  ('Y', 'Yester Hill', (-40, 470), 'hill', []),
  ('Z', 'Werewolf Den', (126, 185), 'den', []),
]
ROADS = [
  ('Old Svalich Road', [(1290, 507), (1258, 507), (1222, 490), (1185, 535), (1100, 558), (1000, 563), (975, 598), (935, 640), (880, 655), (850, 658)]),
  ('Old Svalich Road', [(850, 658), (815, 640), (792, 590), (798, 546), (765, 515), (742, 478), (745, 424), (745, 380), (700, 360), (660, 330), (640, 300), (560, 296), (447, 300), (383, 318)]),
  ('Road to Ravenloft', [(745, 424), (790, 405), (830, 430), (853, 453), (905, 462)]),
  ('Ravenloft/Vallaki road', [(850, 658), (790, 650), (760, 600), (700, 575), (690, 590), (740, 620), (780, 640)]),
  ('Old Svalich Road', [(383, 318), (340, 300), (250, 292), (185, 288), (110, 270), (53, 261), (0, 262)]),
  ('Tsolenka road', [(185, 288), (150, 350), (125, 420), (100, 515), (170, 560), (205, 640), (225, 690), (300, 700), (330, 740), (352, 762), (420, 830)]),
  ('Trail to Berez', [(383, 318), (378, 420), (360, 480), (346, 538)]),
  ('Road to Argynvostholt', [(185, 288), (250, 350), (300, 400), (343, 440)]),
  ('Road to the tower', [(185, 288), (215, 250), (230, 225)]),
  ('Road to the vineyard', [(110, 270), (60, 360), (36, 420)]),
]
RIVERS = [
  ('River Ivlis', [(855, 565), (900, 600), (960, 612), (992, 611), (1060, 622), (1148, 637), (1270, 612)]),
  ('Luna River', [(400, 270), (395, 360), (410, 440), (420, 480), (380, 560), (330, 640), (250, 705)]),
  ('Raven River', [(190, 205), (185, 288), (160, 330), (120, 360), (60, 380), (0, 400)]),
]
LAKES = [('Lake Zarovich', (500, 195), (170, 48)), ('Lake Baratok', (190, 205), (30, 22)), ('Tser Pool', (850, 562), (16, 12)), ('Luna Lake', (200, 712), (55, 22))]
PEAKS = [('Mount Baratok', (850, 70)), ('Mount Ghakis', (505, 780)), ('Balinok Mountains', (160, 470))]
# Unnamed high ground from the map: the castle's pillar of rock, the Ghakis foothills, the Balinok range,
# the snowy north-east and the ridges between Vallaki and the Tser valley.
HIGH = [(905, 430), (860, 380), (620, 620), (560, 690), (640, 520), (250, 560), (120, 560), (200, 430), (1050, 120), (1180, 110), (980, 200),
        (700, 200), (820, 300), (760, 250), (520, 480), (450, 600), (300, 760), (150, 820), (1250, 250)]
WOODS = [('Svalich Woods', (1150, 380)), ('Svalich Woods', (990, 760)), ('Svalich Woods', (460, 130)), ('Svalich Woods', (90, 450)), ('Svalich Woods', (30, 760))]

out = OrderedDict(
  schema=1, name='The Lands of Barovia', page=35, milesPerHex=0.25,
  note='Positions measured from the regional map; art is original. Yester Hill approximate (off the printed crop).',
  bounds=m(1300, 920) and OrderedDict(minX=m(-80, 0)[0], minY=0, maxX=m(1300, 0)[0], maxY=m(0, 920)[1]),
  pins=[OrderedDict(key=k, name=n, pos=m(*p), type=t, **({'scenes': sc} if sc else {}), **({'heightFt': HEIGHT[k]} if k in HEIGHT else {})) for k, n, p, t, sc in PINS],
  roads=[OrderedDict(name=n, pts=[m(*p) for p in pts]) for n, pts in ROADS],
  rivers=[OrderedDict(name=n, pts=[m(*p) for p in pts]) for n, pts in RIVERS],
  lakes=[OrderedDict(name=n, center=m(*c), r=m(*r)) for n, c, r in LAKES],
  peaks=[OrderedDict(name=n, pos=m(*p)) for n, p in PEAKS],
  high=[m(*p) for p in HIGH],
  woods=[OrderedDict(name=n, pos=m(*p)) for n, p in WOODS],
)
# Keep the hand-written player blurbs and DM notes from the file already on disk.
def keep_notes(world, path):
    import os as _os, json as _json
    if not _os.path.exists(path): return
    old = {p['key']: p for p in _json.load(open(path))['pins']}
    for p in world['pins']:
        for k in ('blurb', 'dm'):
            if k in old.get(p['key'], {}) and k not in p: p[k] = old[p['key']][k]


keep_notes(out, 'locations/ch02/barovia-region/world.json')
json.dump(out, open('locations/ch02/barovia-region/world.json', 'w'), indent=1)
print('world:', len(PINS), 'pins,', len(ROADS), 'roads')
