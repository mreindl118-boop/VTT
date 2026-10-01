#!/usr/bin/env python3
"""Noke's Tower (A Wild Sheep Chase, 03-compound): a round stone tower of three floors over a ground hall, with a
conical roof and a spiral stair, standing in its clearing at the head of the valley with the track climbing to it;
two huts and the outhouse (the bear) in the yard, the oaks round about. Keeps the four levels and area keys the
mapset gave the place (L0-1..L0-4, L1-1, L2-1, L3-1), so the manifest, the world pin and saved games still fit.
-> locations/wsc/03-compound/{scene,grid}.json (and the area names in manifests/wsc-locations.json)."""
import json, os, sys
from collections import OrderedDict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from authorlib import Level, rect, ft, C, unit_edges

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
OUT = os.path.join(ROOT, 'locations', 'wsc', '03-compound')

CX, CY, R = 12, 12, 4   # the tower: centre and radius in cells (40 ft across)
def octagon(cx, cy, r, c=2):
    """An octagon on whole cells: flat sides of 2c cells, so doors and windows land on the lattice."""
    return [(cx - c, cy - r), (cx + c, cy - r), (cx + r, cy - c), (cx + r, cy + c), (cx + c, cy + r), (cx - c, cy + r), (cx - r, cy + c), (cx - r, cy - c)]
TOWER = octagon(CX, CY, R)
STAIR = (CX + 1.5, CY - 1.5)   # the spiral stair, same spot on every floor
AMB = 'barovian-overcast'
NOTES = {
  'L0-1': "The ground hall: stores, firewood, Noke's tools. The spiral stair climbs the inside of the wall.",
  'L0-2': 'The shepherd hut: two cots, a cold hearth.',
  'L0-3': 'The outhouse. A brown bear has made it its den and is asleep inside.',
  'L0-4': 'The yard: the track from the valley ends at the tower door; washing on a line, a woodpile.',
  'L1-1': 'The lower floor: the pantry and the workroom, a window east over the valley.',
  'L2-1': "The main hall: Noke's table, the fire, the bookshelves; the good window looks down the valley to the town.",
  'L3-1': "The bedroom under the roof: Noke's bed, the wardrobe, the writing desk, the trapdoor to the roof walk.",
}

levels = []
# ---------------------------------------------------------------- L0: the clearing, the ground hall, the huts
L0 = Level('L0', 'Compound grounds (L0)', 0, 12, ambient=AMB, interior='plaster', exterior='rubble', north='-z')
L0.terrain.append((rect(0, 0, 24, 24), 'grass'))
# the track climbs in from the south-west and ends at the door
track = [(0, 23.5), (3, 22.5), (6, 21), (8.5, 19.5), (10.5, 17.8), (11.5, 16.6)]
for (x0, z0), (x1, z1) in zip(track[:-1], track[1:]):
    dx, dz = x1 - x0, z1 - z0; L = (dx * dx + dz * dz) ** 0.5; nx, nz = -dz / L * 0.9, dx / L * 0.9
    L0.terrain.append(([(x0 + nx, z0 + nz), (x1 + nx, z1 + nz), (x1 - nx, z1 - nz), (x0 - nx, z0 - nz)], 'dirt'))
L0.room('L0-1', 'Ground hall', TOWER, 'flagstone', ceilingFt=10)
L0.room('L0-2', 'Shepherd hut', rect(2, 3, 6, 6), 'plank', ceilingFt=8)
L0.room('L0-3', 'Outhouse', rect(19, 4, 21, 6), 'plank', ceilingFt=7)
L0.room('L0-4', 'Yard', rect(7, 17, 17, 22), 'dirt')
for a, b in unit_edges(rect(7, 17, 17, 22)): L0.opening(a, b)   # the yard is open ground, not a walled court
L0.door((CX - 1, CY + R), (CX, CY + R), id='L0-tower-door')          # south door onto the yard
L0.door((4, 6), (5, 6), id='L0-hut-door'); L0.door((20, 6), (21, 6), id='L0-outhouse-door')
L0.window((CX + R, CY - 1), (CX + R, CY)); L0.window((CX - R, CY), (CX - R, CY + 1))
L0.prop('stair', 'spiral-stair', STAIR, 'L0-1', dims={'r': 6, 'rise': 10})
L0.prop('casks', 'cask-rack', (CX - 2.5, CY + 1.5), 'L0-1'); L0.prop('woodpile', 'crate-chest', (CX - 2.8, CY - 2), 'L0-1')
L0.prop('cot-a', 'bed-plain', (3, 4), 'L0-2'); L0.prop('cot-b', 'bed-plain', (5, 4), 'L0-2'); L0.prop('hearth', 'fireplace', (4, 3.3), 'L0-2', rotY=180)
L0.creature('bear', 'bear', (20, 5), 'L0-3', 'Brown bear', size='large')
L0.prop('line', 'fence', (13, 19.5), 'L0-4', dims={'len': 15}); L0.prop('trough', 'trough', (9, 18.5), 'L0-4'); L0.prop('sign', 'signpost', (10.5, 16.8), 'L0-4')
for i, (x, z) in enumerate([(2, 10), (3, 14), (6, 1.5), (10, 2), (17, 1.5), (21, 9), (22, 14), (21, 20), (19, 23), (2, 18), (23, 2), (1, 1)]):
    L0.prop(f'oak{i}', 'oak', (x, z), None, dims={'r': 1.1 + (i % 3) * 0.2, 'h': 22 + (i % 4) * 3, 'canopy': 8 + (i % 3) * 1.5})
L0.light('hall', (CX * 1.0, CY * 1.0), 'candle', 5, 10, y=7)
for k, text in NOTES.items():
    if k.startswith('L0'): L0.note(f'n-{k}', {'L0-1': (CX, CY - 2), 'L0-2': (3, 5), 'L0-3': (20, 4.5), 'L0-4': (12, 21)}[k], k, text)
levels.append(L0)

# ---------------------------------------------------------------- the floors of the tower
def floor(id, name, elev, key, roomname, furnish):
    lv = Level(id, name, elev, 10, ambient='interior-dim', interior='plaster', exterior='rubble', north='-z')
    lv.room(key, roomname, TOWER, 'plank', ceilingFt=10)
    lv.prop('stair', 'spiral-stair', STAIR, key, dims={'r': 6, 'rise': 10})
    lv.window((CX + R, CY - 1), (CX + R, CY)); lv.window((CX - R, CY), (CX - R, CY + 1)); lv.window((CX - 1, CY - R), (CX, CY - R))
    furnish(lv, key)
    lv.light('candles', (CX, CY), 'candle', 5, 10, y=7)
    lv.note(f'n-{key}', (CX, CY + 2), key, NOTES[key])
    levels.append(lv); return lv
def lower(lv, k):
    lv.prop('shelves', 'bookshelf', (CX - 3, CY - 1), k, rotY=90); lv.prop('bench', 'bench', (CX - 1, CY + 2.5), k); lv.prop('barrels', 'cask-rack', (CX + 2, CY + 2.5), k)
def hall(lv, k):
    lv.prop('table', 'table-round', (CX - 0.5, CY + 0.5), k)
    for i, (x, z) in enumerate([(CX - 2, CY + 0.5), (CX + 1, CY + 0.5), (CX - 0.5, CY - 1), (CX - 0.5, CY + 2)]): lv.prop(f'chair{i}', 'chair', (x, z), k, rotY=[90, -90, 180, 0][i])
    lv.prop('fire', 'fireplace', (CX - 3.2, CY + 1), k, rotY=90); lv.prop('books', 'bookshelf', (CX + 1, CY - 3.2), k)
def bedroom(lv, k):
    lv.prop('bed', 'bed-plain', (CX - 2, CY + 1.5), k, rotY=90); lv.prop('wardrobe', 'wardrobe', (CX + 2.5, CY + 2.5), k, rotY=-90); lv.prop('desk', 'desk', (CX - 1, CY - 2.8), k)
    lv.prop('roof', 'roof-cone', (CX, CY), None, dims={'r': R * C, 'h': 18, 'y': 10})
L1 = floor('L1', 'Lower floor (L1, 10 ft)', 10, 'L1-1', 'Lower floor', lower)
L2 = floor('L2', 'Main hall (L2, 20 ft)', 20, 'L2-1', 'Main hall', hall)
L3 = floor('L3', 'Bedroom (L3, 30 ft)', 30, 'L3-1', 'Bedroom', bedroom)

sp = [STAIR[0] * C, STAIR[1] * C]
links = [OrderedDict(id=f'lk-stair_{a}_{b}', kind='stairs', **{'from': OrderedDict(level=a, pos=sp), 'to': OrderedDict(level=b, pos=sp)}) for a, b in (('L0', 'L1'), ('L1', 'L2'), ('L2', 'L3'))]
scene = OrderedDict(schema=1, location='03-compound', chapter='wsc', name="Noke's Tower", bookScaleFt=5, ambient=AMB, stacked=True, entry='L0', levels=[lv.to_json() for lv in levels], links=links)
grid = OrderedDict(schema=1, levels=OrderedDict((lv.id, OrderedDict(floorPolygons=[ft(p) for p in lv.floor_polys], type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0.55)) for lv in levels))
os.makedirs(OUT, exist_ok=True)
json.dump(scene, open(os.path.join(OUT, 'scene.json'), 'w'), indent=1)
json.dump(grid, open(os.path.join(OUT, 'grid.json'), 'w'), indent=1)
# the manifest's area names follow
mp = os.path.join(ROOT, 'manifests', 'wsc-locations.json'); M = json.load(open(mp), object_pairs_hook=OrderedDict)
for loc in M['locations']:
    if loc['id'] == '03-compound':
        names = {k: n for lv in levels for k, n, *_ in lv.rooms}
        loc['areas'] = [OrderedDict(key=k, name=f"{next(l.name for l in levels if any(r[0] == k for r in l.rooms))}: {n}") for k, n in names.items()]
        loc['notes'] = 'A round stone tower of three floors over its ground hall, a conical roof, the spiral stair up the inside of the wall; the huts and the outhouse (a brown bear inside) in the yard; the track climbs to the door from the valley.'
json.dump(M, open(mp, 'w'), indent=1)
print('noke tower:', [(lv.id, len(lv.rooms), len(lv.objects)) for lv in levels])
