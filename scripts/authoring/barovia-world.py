#!/usr/bin/env python3
"""Barovia world map data: pin positions, roads, rivers, lakes, peaks and woods, measured from the regional
map (book p.35) at 200 dpi, where one quarter-mile hex spans ~17.6 px. Output is in miles, origin top-left.
Only positions and names are recorded; no map art is copied. Yester Hill (Y) lies off the printed crop and is
placed approximately west of the Wizard of Wines.

The page is not a survey: where it fights the lie of the land, LOGIC below wins (in miles), so the region holds
together in 3D: Van Richten's island stands off Lake Baratok's south-east shore, the Luna River runs from Lake
Zarovich through Berez and under the Tsolenka bridge into Luna Lake, which lies far enough below the pass for the
bridge to stand 500 ft over the water. Run on a fresh tree it writes the base map; run again after
barovia-cover.py (which refines the base from the page and adds the land cover) it only re-applies LOGIC to the
file on disk, keeping everything else (cover, heights, traced roads and rivers, notes, scene links). Then run
heightfield.py on the result."""
import json, math
from collections import Counter, OrderedDict

PX_PER_MILE = 17.6 * 4          # 4 hexes per mile
m = lambda x, y: [round(x / PX_PER_MILE, 2), round(y / PX_PER_MILE, 2)]

HEIGHT = {'K': 1000}  # the Pillarstone of Ravenloft: the castle stands a thousand feet above the valley (p.53)
PINS = [  # key, name, px, type, scenes (built scene paths reachable from here)
  ('A', 'Old Svalich Road', (1258, 507), 'road', ['ch02/A']),
  ('B', 'Gates of Barovia (east)', (1222, 470), 'gate', ['ch02/B']),
  ('C', 'Svalich Woods', (1203, 537), 'woods', ['ch02/C']),
  ('D', 'River Ivlis', (992, 611), 'river', ['ch02/D']),
  ('E', 'Village of Barovia', (992, 537), 'settlement', ['ch03/E', 'ch03/E5', 'appB/death-house']),
  ('F', 'River Ivlis Crossroads', (850, 658), 'crossroads', ['ch02/F']),
  ('G', 'Tser Pool Encampment', (798, 546), 'camp', ['ch02/G']),
  ('H', 'Tser Falls', (742, 478), 'falls', ['ch02/H']),
  ('I', 'Black Carriage', (745, 424), 'landmark', ['ch02/I']),
  ('B2', 'Gates of Barovia (west)', (745, 380), 'gate', ['ch02/B']),
  ('J', 'Gates of Ravenloft', (853, 453), 'gate', ['ch02/J']),
  ('K', 'Castle Ravenloft', (915, 470), 'castle', ['ch04/K']),
  ('L', 'Lake Zarovich', (470, 210), 'lake', ['ch02/L']),
  ('M', 'Mount Baratok', (663, 106), 'peak', ['ch02/M']),
  ('N', 'Town of Vallaki', (447, 307), 'settlement', ['ch05/N']),
  ('O', 'Old Bonegrinder', (570, 355), 'landmark', ['ch06/O']),
  ('P', 'Luna River Crossroads', (383, 318), 'crossroads', ['ch02/P']),
  ('Q', 'Argynvostholt', (343, 440), 'castle', ['ch07/Q']),
  ('R', 'Raven River Crossroads', (185, 288), 'crossroads', ['ch02/R']),
  ('S', 'Village of Krezk', (53, 261), 'settlement', ['ch08/S', 'ch08/S10']),
  ('T', 'Tsolenka Pass', (225, 690), 'pass', ['ch09/T']),
  ('U', 'Ruins of Berez', (346, 538), 'ruin', ['ch10/U', 'ch10/U3']),
  ('V', "Van Richten's Tower", (215, 218), 'tower', ['ch11/V']),
  ('W', 'The Wizard of Wines', (36, 420), 'settlement', ['ch12/W']),
  ('X', 'The Amber Temple', (352, 762), 'temple', ['ch13/X']),
  ('Y', 'Yester Hill', (-40, 470), 'hill', ['ch14/Y']),
  ('Z', 'Werewolf Den', (126, 185), 'den', ['ch15/Z']),
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
  ('Road to the tower', [(185, 288), (201, 268), (218, 246), (225, 227), (218, 220), (215, 218)]),
  ('Road to the vineyard', [(110, 270), (60, 360), (36, 420)]),
]
RIVERS = [
  ('River Ivlis', [(855, 565), (900, 600), (960, 612), (992, 611), (1060, 622), (1148, 637), (1270, 612)]),
  ('Luna River', [(403, 234), (400, 270), (395, 360), (410, 440), (420, 480), (391, 500), (365, 514), (358, 526), (352, 537), (347, 546), (342, 554), (338, 560), (328, 598), (310, 630), (278, 648), (255, 655), (239, 665), (230, 677), (226, 688), (223, 698), (217, 708)]),
  ('Raven River', [(190, 205), (185, 288), (160, 330), (120, 360), (60, 380), (0, 400)]),
]
LAKES = [('Lake Zarovich', (500, 195), (170, 48)), ('Lake Baratok', (190, 205), (35, 25)), ('Tser Pool', (850, 562), (16, 12)), ('Luna Lake', (191, 722), (55, 22))]
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


# Where the lie of the land overrides the page (miles, +y south). Each entry says why.
LOGIC = OrderedDict(
  # Khazan's tower stands on a small island a hundred yards off the shore, reached by a causeway (ch.11): the pin is
  # the island, the lake's south-east shore passes just south-east of it, the open water lies north-west
  pins=OrderedDict(V=[3.05, 3.10]),
  lakes=OrderedDict([
    ('Lake Baratok', OrderedDict(center=[2.7, 2.91], r=[0.5, 0.36])),
    # the bridge at Tsolenka Pass stands 500 ft over the Luna River, so the lake the river feeds lies below and
    # beyond the gorge, not at the bridge's foot
    ('Luna Lake', OrderedDict(center=[2.6, 10.33], r=[0.78, 0.31])),
  ]),
  # the hand-measured course of each river, from its source: the Luna leaves Lake Zarovich west of Vallaki, falls
  # gently past the Luna River crossroads to Berez ('the trail wends gently downward as it follows the river'),
  # runs down Berez's map along its drowned channel, then through the Balinok foothills into the gorge under the
  # Tsolenka bridge (north to south, between the two arms of the pass road) and out into Luna Lake
  # Below the bridge the river drops through its gorge in a run of falls (the map's precipices fall 320-420 ft under the
  # bridge), so Luna Lake lies some 500 ft under the pass: `falls` is where the drop starts, its height and its length.
  rivers=OrderedDict([('Luna River', OrderedDict(pts=[[5.72, 3.33], [5.68, 3.84], [5.61, 5.11], [5.82, 6.25], [5.97, 6.82], [5.55, 7.1], [5.19, 7.3],
    [5.09, 7.47], [5.0, 7.63], [4.93, 7.75], [4.86, 7.87], [4.8, 7.95], [4.66, 8.5], [4.4, 8.95], [3.95, 9.2], [3.62, 9.3],
    [3.4, 9.45], [3.27, 9.62], [3.21, 9.77], [3.13, 9.95], [2.98, 10.1], [2.84, 10.22]],
    falls=[OrderedDict(at=[3.19, 9.78], ft=480, over=0.34)]))]),
  # the dirt path north from the Raven River crossroads to the causeway (ch.2 area R), along the river's east bank
  roads=[OrderedDict(name='Trail to the tower', kind='trail', pts=[[2.63, 4.1], [2.86, 3.8], [3.1, 3.5], [3.2, 3.22], [3.1, 3.12], [3.05, 3.1]]),
    # the Tsolenka road from the pass climbs the north flank of Ghakis's western shoulder and comes along the contour to
    # the temple's ledge from the west (the traced line looped over the shoulder's crest and back down to the temple, and
    # a stray fragment of it ran straight up the slope beside the road)
    OrderedDict(name='Tsolenka road', replaces=[[3.48, 9.57], [4.37, 10.06]], pts=[[3.48, 9.57], [3.79, 9.6], [4.01, 9.84], [4.25, 9.99], [4.32, 10.11],
      [4.26, 10.37], [4.28, 10.57], [4.62, 10.76], [5.0, 10.8]]),
    # beyond the temple the road climbs on south-east over the massif and out of the valley
    OrderedDict(name='Tsolenka road', replaces=[], pts=[[5.0, 10.8], [5.23, 10.89], [5.55, 11.1], [5.69, 11.41], [5.98, 11.54], [6.02, 11.65], [5.97, 11.77]])],
)

def apply_logic(world):
    pins = {p['key']: p for p in world['pins']}
    for k, pos in LOGIC['pins'].items():
        if k in pins: pins[k]['pos'] = pos
    for lk in world['lakes']:
        if lk['name'] in LOGIC['lakes']: lk.update(LOGIC['lakes'][lk['name']])
    for name, course in LOGIC['rivers'].items():
        rv = next((r for r in world['rivers'] if r['name'] == name), None)   # the first of a name is its whole course
        if rv: rv.update(course)
    for road in LOGIC['roads']:
        road = OrderedDict(road); drop = road.pop('replaces', None)
        if drop is None:   # a road of its own: replaces the one of its name
            world['roads'] = [r for r in world['roads'] if r['name'] != road['name']]
        else:              # a re-routed piece of a traced road: replaces the pieces of that name starting at these points
            starts = drop + [road['pts'][0]]
            world['roads'] = [r for r in world['roads'] if not (r['name'] == road['name'] and r['pts'][0] in starts)]
        world['roads'].append(road)
    # a traced bend recorded twice is drawn twice: keep one of each
    for k in ('rivers', 'roads'):
        seen, kept = set(), []
        for f in world[k]:
            key = json.dumps([f['name'], f['pts']])
            if key not in seen: seen.add(key); kept.append(f)
        world[k] = kept
    if world.get('cover'): sync_cover(world)
    world['hydrology'] = True   # heightfield.py: lakes level, rivers downhill, settlements on aprons

def sync_cover(world):
    """A lake moved or resized here is water on the cover lattice too (the region map paints its water, and the
    backdrops colour and clear the land, from the cover): every cell inside it is water, and the page's water left
    just outside it (where it was traced before it moved) becomes the land round it."""
    b, cell = world['bounds'], world['cellMiles']; old = [list(r) for r in world['cover']]; new = [list(r) for r in old]
    for lk in world['lakes']:
        if lk['name'] not in LOGIC['lakes']: continue
        for r, row in enumerate(old):
            for k, ch in enumerate(row):
                x, y = b['minX'] + (k + .5) * cell, b['minY'] + (r + .5) * cell
                dn = math.hypot((x - lk['center'][0]) / lk['r'][0], (y - lk['center'][1]) / lk['r'][1])
                if dn < 1: new[r][k] = 'w'
                elif dn < 1.6 and ch == 'w':
                    land = Counter(old[i][j] for i in range(r - 1, r + 2) for j in range(k - 1, k + 2)
                                   if 0 <= i < len(old) and 0 <= j < len(old[i]) and old[i][j] != 'w')
                    new[r][k] = land.most_common(1)[0][0] if land else '.'
    world['cover'] = [''.join(r) for r in new]

PATH = 'locations/ch02/barovia-region/world.json'
import os
if os.path.exists(PATH) and json.load(open(PATH)).get('cover'):
    # the refined map is on disk: only the logic is re-applied, everything else is kept
    world = json.load(open(PATH), object_pairs_hook=OrderedDict)
    apply_logic(world)
    json.dump(world, open(PATH, 'w'), indent=1)
    print('world: logic re-applied to', PATH, '(run heightfield.py next)')
else:
    apply_logic(out)
    keep_notes(out, PATH)
    json.dump(out, open(PATH, 'w'), indent=1)
    print('world:', len(PINS), 'pins,', len(ROADS), 'roads')
