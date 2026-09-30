#!/usr/bin/env python3
"""Village of Barovia (area E) placement layer from the book map (p.42, one square = 40 ft).
Building footprints come from reference/imports/village-extract.json (roof blobs measured at 200 dpi:
85 px per 40-ft square). Only positions and sizes are recorded; the art is original. Marker positions for
E1–E7 were read off the same render. Roads and terrain stay as authored in the existing scene."""
import json, math
from collections import OrderedDict

PX = 85 / 40.0; OX, OY = 928 % 85, 1335 % 85
ft = lambda px, py: [round((px - OX) / PX, 1), round((py - OY) / PX, 1)]
MARK = {'E6': (330, 260), 'E5': (310, 514), 'E2': (624, 850), 'E7': (1104, 780), 'E1': (614, 1056), 'E3': (550, 1150), 'E4': (540, 1540)}
NAMES = {'E1': "Bildrath's Mercantile", 'E2': 'Blood of the Vine Tavern', 'E3': "Mad Mary's Townhouse", 'E4': "Burgomaster's Mansion", 'E5': 'Church', 'E6': 'Cemetery', 'E7': 'Death House'}
PAGES = {'E1': 43, 'E2': 43, 'E3': 44, 'E4': 44, 'E5': 45, 'E6': 42, 'E7': 43}

ex = json.load(open('reference/imports/village-extract.json'))
import numpy as np
# The seed scene (roads, graves, trees, fences) was authored in its own frame: fit the affine map that carries its
# E1–E7 room centres onto the measured markers, and bring everything it keeps into the measured frame.
SEED_ROOMS = {'E6': (225, 180), 'E5': (220, 315), 'E2': (390, 500), 'E7': (645, 460), 'E1': (385, 660), 'E3': (345, 710), 'E4': (335, 880)}
scene = json.load(open('locations/ch03/E/scene.json'), object_pairs_hook=OrderedDict)
lv = scene['levels'][0]
marks = {k: ft(*v) for k, v in MARK.items()}
A = np.array([[*SEED_ROOMS[k], 1] for k in SEED_ROOMS]); B = np.array([marks[k] for k in SEED_ROOMS])
M, *_ = np.linalg.lstsq(A, B, rcond=None)   # 3×2: [x, z, 1] @ M = [x', z']
warp = lambda x, z: [round(float(v), 1) for v in np.array([x, z, 1]) @ M]
grid = json.load(open('locations/ch03/E/grid.json'), object_pairs_hook=OrderedDict)
# rooms: a 40-ft square on each marker (the map's own squares), north-most first
rooms = []
for k in ['E6', 'E5', 'E2', 'E7', 'E1', 'E3', 'E4']:
    x, z = marks[k]; x0, z0 = round(x - 20), round(z - 20)
    rooms.append(OrderedDict(key=k, name=NAMES[k], polygon=[[x0, z0], [x0 + 40, z0], [x0 + 40, z0 + 40], [x0, z0 + 40]], floor='cobble' if k not in ('E6',) else 'grass', page=PAGES[k]))
lv['rooms'] = rooms
keep = [o for o in lv['objects'] if o['kind'] != 'house']
if scene.get('frame') == 'measured-p42': warp = lambda x, z: [x, z]   # already in the measured frame: never warp twice
scene['frame'] = 'measured-p42'
for o in keep: x, z = warp(o['pos'][0], o['pos'][2]); o['pos'] = [x, o['pos'][1], z]
for t in lv.get('terrain', []): t['polygon'] = [warp(*p) for p in t['polygon']]
gl = grid['levels']['village']; gl['floorPolygons'] = [[warp(*p) for p in poly] for poly in gl['floorPolygons']]
json.dump(grid, open('locations/ch03/E/grid.json', 'w'), indent=1)
houses = []
for i, h in enumerate(ex['houses']):
    x, z = h['pos']
    if math.hypot(x - marks['E5'][0], z - marks['E5'][1]) < 45: continue     # the church is its own piece
    if math.hypot(x - marks['E6'][0], z - marks['E6'][1]) < 70: continue     # cemetery: graves, not houses
    key = next((k for k in ('E1', 'E2', 'E3', 'E4', 'E7') if math.hypot(x - marks[k][0], z - marks[k][1]) < 26), None)
    big = h['w'] * h['d'] > 700
    o = OrderedDict(id=f'village-h{i}', kind='house', pos=[x, 0, z], vis='player', rotY=h['rotY'], dims=OrderedDict(w=h['w'], d=h['d'], h=11 if not big else 13, stories=2 if big or key else 1))
    if key: o['key'] = key; o['label'] = NAMES[key]
    houses.append(o)
lv['objects'] = keep + houses
# the church piece sits on E5; move it if the seed had it elsewhere
for o in keep:
    if o['kind'] == 'church-building': o['pos'] = [marks['E5'][0], 0, marks['E5'][1] + 4]; o['key'] = 'E5'
scene['levels'][0] = lv
json.dump(scene, open('locations/ch03/E/scene.json', 'w'), indent=1)
print('village:', len(houses), 'houses,', len(rooms), 'rooms; markers', marks)
