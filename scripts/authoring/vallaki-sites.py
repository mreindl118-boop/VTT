#!/usr/bin/env python3
"""The keyed sites of Vallaki (chapter 5): the Blue Water Inn (N2, map p.99), the Burgomaster's Mansion (N3,
p.104), Wachterhaus (N4, p.111), the Coffin Maker's Shop (N6, p.116) and the Vistani Camp (N9, p.120), read off
the book's plans at one square = 5 ft (gridded renders in the session notes), plus St. Andral's Church (N1: the
book says use the village church's plan without its undercroft), Blinsky Toys (N7) and the Arasek Stockyard (N5),
which have no plans and are laid out from their text. Only keys, names, pages, dimensions, placements and our
own wording live here. Each site is a blowout of the town map (`parent`)."""
import json, os, sys, math
from collections import OrderedDict

sys.path.insert(0, os.path.dirname(__file__))
from authorlib import ROOT, Level, rect, cobwebs  # noqa: F401

_M = json.load(open(os.path.join(ROOT, 'manifests', 'locations.json')))
PAGE = {a['key']: a['page'] for l in _M['locations'] if l['chapter'] == 'ch05' for a in l['areas']}
def pg(k): return PAGE.get(k)

def write(loc_id, name, map_page, levels, links, desc, stacked=True, entry=None, ambient='interior-dim', valley=False):
    scene = OrderedDict(schema=1, location=loc_id, chapter='ch05', name=name, mapPage=map_page, bookScaleFt=5, ambient=ambient, parent='ch05/N')
    if stacked: scene['stacked'] = True
    if entry: scene['entry'] = entry
    scene['levels'] = [lv.to_json() for lv in levels]
    for lv in scene['levels']:
        for r in lv['rooms']:
            d = desc.get(r['key'])
            if d: r['desc'] = d[0]; r['dm'] = d[1] if len(d) > 1 and d[1] else None
            if r.get('dm') is None: r.pop('dm', None)
    scene['links'] = links
    grid = OrderedDict(schema=1, levels=OrderedDict())
    for lv in levels:
        grid['levels'][lv.id] = OrderedDict(floorPolygons=[[[x * 5, z * 5] for x, z in p] for p in lv.floor_polys] + [[[x * 5, z * 5] for x, z in p] for p, _ in lv.terrain], type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0.55)
    out = os.path.join(ROOT, 'locations', 'ch05', loc_id)
    os.makedirs(out, exist_ok=True)
    json.dump(scene, open(os.path.join(out, 'scene.json'), 'w'), indent=1)
    json.dump(grid, open(os.path.join(out, 'grid.json'), 'w'), indent=1)
    print(f"{loc_id}: {len(levels)} levels, {sum(len(l.rooms) for l in levels)} rooms, {sum(len(l.objects) for l in levels)} objects")

def lk(id, kind, a_level, a, b_level, b): return OrderedDict(id=id, kind=kind, **{'from': {'level': a_level, 'pos': [a[0] * 5, a[1] * 5]}, 'to': {'level': b_level, 'pos': [b[0] * 5, b[1] * 5]}})
def beds(lv, key, pts, kind='bed', rot=0):
    for i, p in enumerate(pts): lv.prop(f'{key}-bed{i}', kind, p, key, rotY=rot)
def stools(lv, key, pts):
    for i, p in enumerate(pts): lv.prop(f'{key}-chair{i}', 'chair', p, key)

# ================================================================== N2 Blue Water Inn
g = Level('ground', 'Ground floor', 0, 15, ambient='interior-dim', interior='paneling', exterior='half-timber', north='-z')
g.room('N2f', 'Stable', rect(1, 6.5, 12, 20), 'dirt', page=pg('N2f'), ceilingFt=15)
g.room('N2e', 'Kitchen', rect(12, 2, 21, 8.5), 'plank', page=pg('N2e'), ceilingFt=10)
g.room('N2d', 'Wine Storage', rect(15.5, 8.5, 21, 20), 'plank', page=pg('N2d'), ceilingFt=10)
g.room('N2g', 'Storage', rect(12, 12.5, 15.5, 17.5), 'plank', page=pg('N2g'), ceilingFt=7)
g.room('N2c', 'Taproom', rect(21, 2, 29.5, 20), 'plank', page=pg('N2c'), ceilingFt=15)
g.room('N2b', 'Outside Staircase', rect(29.5, 2, 32, 11), 'plank', page=pg('N2b'), ceilingFt=15)
g.room('N2c-porch', 'Porch', rect(22.5, 20, 28, 22), 'plank', page=pg('N2c'), ceilingFt=10)
g.room('N2a', 'Well', rect(30, 17, 38, 24), 'cobble', page=pg('N2a'), ceilingFt=10)
g.terrain.append(([(-2, -2), (42, -2), (42, 27), (-2, 27)], 'grass'))
g.opening((29.5, 2), (29.5, 11)); g.opening((22.5, 20), (28, 20)); g.opening((32, 17), (32, 18)); g.opening((30, 17), (32, 17))
g.door((21, 3), (21, 4), id='N2e-taproom', double=False); g.door((12, 4), (12, 5), id='N2e-west')
g.door((17, 8.5), (18, 8.5), id='N2d-kitchen'); g.door((17.5, 20), (18.5, 20), id='N2d-outside', double=True)
g.door((15.5, 14), (15.5, 15), id='N2g-door'); g.door((12, 8), (12, 9), id='N2f-small')
g.door((1, 12), (1, 14), id='N2f-sliding', locked=True, double=True); g.door((6, 6.5), (7, 6.5), id='N2f-north'); g.door((6, 20), (7, 20), id='N2f-south')
g.door((24.5, 20), (26, 20), id='N2c-front', double=True, open=True); g.door((29.5, 11), (29.5, 12), id='N2c-east')
g.secret((12, 8.5), (13, 8.5), 'kitchen-stair', 'A secret door at the west end of the kitchen\'s south wall: a wooden stair up to the hidden hall', 'N2e', extra=True)
for a, b in [((22.5, 2), (23.5, 2)), ((26.5, 2), (27.5, 2)), ((29.5, 14), (29.5, 15)), ((29.5, 18), (29.5, 19)), ((13, 2), (14, 2)), ((17, 2), (18, 2)), ((1, 8), (1, 9)), ((1, 17), (1, 18)), ((21, 12), (21, 13)), ((21, 17), (21, 18))]:
    g.window(a, b)
g.wall((2.5, 6.5), (2.5, 11.5)); g.wall((5, 6.5), (5, 11.5)); g.wall((7.5, 6.5), (7.5, 11.5)); g.wall((2.5, 15), (2.5, 20)); g.wall((5, 15), (5, 20)); g.wall((7.5, 15), (7.5, 20))
g.counter((21.3, 10), (21.3, 19))
g.prop('bar', 'bar-top', (21.6, 14.5), 'N2c', rotY=90, dims={'len': 45})
stools(g, 'N2c', [(22.4, 10.5 + i) for i in range(9)])
g.prop('N2c-table1', 'table', (25.5, 5.5), 'N2c', dims={'w': 10, 'd': 4}); stools(g, 'N2c-t1', [(23.5, 5), (24.5, 4.5), (26.5, 4.5), (27.5, 5), (24.5, 6.5), (26.5, 6.5)])
g.prop('N2c-round1', 'table-round', (25.5, 9.5), 'N2c'); stools(g, 'N2c-r1', [(24.5, 8.7), (26.5, 8.7), (24.5, 10.3), (26.5, 10.3)])
g.prop('N2c-round2', 'table-round', (25, 14), 'N2c'); stools(g, 'N2c-r2', [(24, 13.2), (26, 13.2), (24, 14.8), (26, 14.8)])
g.prop('N2c-table2', 'table', (25, 18), 'N2c', rotY=90, dims={'w': 8, 'd': 4}); stools(g, 'N2c-t2', [(24, 17), (26, 17), (24, 19), (26, 19)])
for i, x in enumerate((22.5, 24.5, 26.5, 28.5)): g.prop(f'N2c-lamp{i}', 'lamp', (x, 2.4), 'N2c', y=7); g.light(f'N2c-lantern{i}', (x, 6), 'lantern', 15, 30, y=9)
g.light('N2c-bar', (22.5, 14), 'lantern', 15, 30, y=9); g.light('N2e-lamps', (16.5, 5), 'lantern', 15, 30, y=8)
g.prop('N2c-stair', 'stairs-straight', (24.5, 3), 'N2c', dims={'w': 12, 'rise': 15, 'fromX': 110, 'toX': 135})
g.prop('N2b-stair', 'stairs-straight', (30.75, 6.5), 'N2b', dims={'w': 5, 'rise': 15, 'fromZ': 55, 'toZ': 10})
g.hidden('N2c-wolfheads', 'niche', (28.8, 11), 'N2c', 'Wolf heads mounted on plaques along the walls')
g.note('N2c-note', (27, 12), 'N2c', 'Danika at the bar, Urwin in the kitchen; Rictavio holds court by the fire; the wolf hunters Szoldar and Yevgeni at the corner table. Doors and shutters bar from within.')
g.prop('N2e-worktable', 'table', (16.5, 5.5), 'N2e', dims={'w': 8, 'd': 4}); g.prop('N2e-stove', 'stove', (13, 2.8), 'N2e'); g.prop('N2e-cupboard', 'cabinet', (20.3, 6.5), 'N2e', rotY=-90)
for i in range(6): g.prop(f'N2d-cask{i}', 'wine-cask', (16.5 + (i % 3) * 1.1, 10 + (i // 3) * 1.1), 'N2d')
for i in range(6): g.prop(f'N2d-caskb{i}', 'wine-cask', (16.5 + (i % 2) * 1.1, 14 + (i // 2) * 1.3), 'N2d')
g.note('N2d-note', (18, 12), 'N2d', 'Twelve empty barrels piled two high; the double doors bar from within.')
g.prop('N2g-chest', 'chest', (13.5, 15), 'N2g'); g.hidden('N2g-contents', 'niche', (13.5, 15.6), 'N2g', 'A dozen horseshoes, a mallet and nails in an unlocked chest')
for i, (x, z) in enumerate([(1.75, 9), (3.75, 9), (6.25, 9), (1.75, 17.5), (3.75, 17.5), (6.25, 17.5)]): g.prop(f'N2f-hay{i}', 'hay', (x, z), 'N2f')
g.creature('drusilla', 'horse', (9.5, 9), 'N2f', "Drusilla, Rictavio's horse", size='large')
g.prop('N2f-ladder', 'stairs-straight', (10.5, 15), 'N2f', dims={'w': 3, 'rise': 15, 'fromZ': 85, 'toZ': 70})
g.creature('N2f-ravens', 'swarm', (5, 13), 'N2f', 'Ravens roosting in the rafters (four swarms if roused)')
g.prop('well', 'well', (35, 21), 'N2a'); g.prop('N2a-trough', 'trough', (31.5, 19), 'N2a')
g.light('N2b-sky', (30.7, 6), 'daylight', 5, 10, y=6)

u = Level('upper', 'Upper floor', 15, 10, ambient='interior-dim', interior='paneling', exterior='half-timber', north='-z')
u.room('N2h', "Ravens' Loft", [(1, 8.5), (12, 8.5), (12, 17.5), (1, 17.5)], 'plank', page=pg('N2h'), ceilingFt=10)
u.room('N2i', 'Secret Stairs and Hall', rect(12, 10, 14.5, 18), 'plank', page=pg('N2i'), ceilingFt=8)
u.room('N2p', 'Master Bedroom', rect(12, 2, 18.5, 10), 'plank', page=pg('N2p'), ceilingFt=8)
u.room('N2o', "Boys' Bedroom", rect(14.5, 10, 18.5, 17), 'plank', page=pg('N2o'), ceilingFt=8)
u.room('N2j', 'Great Balcony', [(18.5, 2), (29.5, 2), (29.5, 4.5), (21, 4.5), (21, 19.5), (18.5, 19.5)], 'plank', page=pg('N2j'), ceilingFt=10)
u.room('N2k', 'Guest Balcony', rect(29.5, 11, 31.5, 19.5), 'plank', page=pg('N2k'), ceilingFt=10)
u.room('N2b-top', 'Outside Staircase (head)', rect(29.5, 2, 32, 11), 'plank', page=pg('N2b'), ceilingFt=10)
u.room('N2l', 'Guest Rooms', rect(31.5, 11, 38, 17), 'plank', page=pg('N2l'), ceilingFt=8)
u.room('N2l-s', 'Guest Rooms (south)', rect(31.5, 17, 38, 23), 'plank', page=pg('N2l'), ceilingFt=8)
u.room('N2m', 'Guest Room', rect(21, 19.5, 29.5, 24), 'plank', page=pg('N2m'), ceilingFt=8)
u.room('N2n', 'Private Guest Room', rect(16.5, 19.5, 21, 24), 'plank', page=pg('N2n'), ceilingFt=8)
u.opening((29.5, 2), (29.5, 4.5)); u.opening((21, 2), (21, 4.5)); u.opening((29.5, 11), (29.5, 12))
u.railing((21, 4.5), (29.5, 4.5)); u.railing((21, 4.5), (21, 19.5)); u.railing((21, 19.5), (29.5, 19.5)); u.railing((29.5, 4.5), (29.5, 19.5))
u.railing((1, 11), (1, 15)); u.railing((5, 11), (5, 15)); u.railing((1, 11), (5, 11)); u.railing((1, 15), (5, 15))
u.door((18.5, 5), (18.5, 6), id='N2p-door'); u.door((18.5, 13), (18.5, 14), id='N2o-door'); u.door((20, 19.5), (21, 19.5), id='N2n-door', locked=True)
u.door((24, 19.5), (25, 19.5), id='N2m-door'); u.door((31.5, 13), (31.5, 14), id='N2l-door'); u.door((31.5, 19), (31.5, 20), id='N2l-s-door'); u.door((30, 11), (31, 11), id='N2b-top-door', locked=False)
u.secret((12, 9), (12, 10), 'loft-bedroom', 'A secret door between the loft and the master bedroom (light shows through the cracks)', 'N2h', extra=True)
u.secret((14.5, 11), (14.5, 12), 'hall-boys', 'Secret door from the hidden hall into the boys\' room', 'N2i')
u.secret((18.5, 17), (18.5, 18), 'hall-balcony', 'Secret door at the south end of the great balcony\'s west wall into the hidden hall', 'N2j', extra=True)
for a, b in [((13, 2), (14, 2)), ((17, 2), (18, 2)), ((33, 11), (34, 11)), ((36, 11), (37, 11)), ((38, 13), (38, 14)), ((38, 19), (38, 20)), ((33, 23), (34, 23)), ((36, 23), (37, 23)), ((24, 24), (25, 24)), ((27, 24), (28, 24)), ((18, 24), (19, 24)), ((1, 10), (1, 11)), ((1, 16), (1, 17))]:
    u.window(a, b)
u.prop('N2p-bed', 'bed', (13.5, 5), 'N2p', dims={'w': 6, 'd': 7}); u.prop('N2p-table-a', 'desk', (12.8, 2.8), 'N2p'); u.prop('N2p-table-b', 'desk', (12.8, 7.3), 'N2p')
u.hidden('N2p-tapestry', 'niche', (18.2, 5), 'N2p', 'A tapestry of a mountain valley hangs across from the bed'); u.hidden('N2p-trap', 'trapdoor', (15, 8.5), 'N2p', 'A hidden trapdoor in the 8-ft ceiling opens into the secret attic')
u.prop('N2o-bed-a', 'bed', (15.3, 11.5), 'N2o'); u.prop('N2o-bed-b', 'bed', (15.3, 15.5), 'N2o'); u.prop('N2o-toybox', 'toy-chest', (16.5, 13.5), 'N2o')
u.hidden('N2o-trap', 'trapdoor', (17.5, 11), 'N2o', 'A hidden trapdoor in the ceiling opens into the secret attic')
u.note('N2o-note', (16.5, 14.5), 'N2o', 'Blinsky toys in the box: a puppet theatre, a toy Vistani wagon, clown masks, a scarecrow top, a stuffed bat on strings.')
u.prop('N2i-stair', 'stairs-straight', (13.25, 11.5), 'N2i', dims={'w': 5, 'rise': 0.1, 'fromZ': 65, 'toZ': 50})
u.prop('N2j-stair', 'stairs-straight', (24.5, 3.25), 'N2j', dims={'w': 12, 'rise': 0.1, 'fromX': 110, 'toX': 135})
u.prop('N2b-top-stair', 'stairs-straight', (30.75, 6.5), 'N2b-top', dims={'w': 5, 'rise': 0.1, 'fromZ': 55, 'toZ': 10})
u.note('N2j-note', (19.5, 10), 'N2j', 'A balcony the length of the taproom, 15 ft above its floor, its railing carved with ravens.')
beds(u, 'N2m', [(22.5, 20.6), (24.5, 20.6), (26.5, 20.6), (28.5, 20.6)]); u.prop('N2m-table', 'table', (27, 23), 'N2m', dims={'w': 4, 'd': 3}); u.prop('N2m-lamp', 'lamp', (27, 23), 'N2m', y=3)
for i in range(4): u.prop(f'N2m-locker{i}', 'trunk', (22.5 + i * 2, 22), 'N2m')
u.prop('N2n-bed', 'bed', (17.5, 21), 'N2n'); u.prop('N2n-desk', 'desk', (19.8, 22.5), 'N2n', rotY=-90); u.prop('N2n-wardrobe', 'wardrobe', (17.3, 23.4), 'N2n', rotY=180); u.prop('N2n-locker', 'trunk', (19, 20.4), 'N2n')
u.hidden('N2n-journal', 'niche', (19.8, 22), 'N2n', "Rictavio's journal in the desk: his horse Drusilla, his 'oddities', nothing of Van Richten by name")
u.creature('rictavio', 'adventurer', (18.5, 22), 'N2n', 'Rictavio (Rudolph van Richten) when he is in; 40% between noon and dusk')
beds(u, 'N2l', [(32.5, 12), (36.8, 12)]); u.prop('N2l-table', 'table', (34.5, 12), 'N2l', dims={'w': 3, 'd': 3}); u.prop('N2l-wardrobe-a', 'wardrobe', (32.3, 16.3), 'N2l', rotY=180); u.prop('N2l-wardrobe-b', 'wardrobe', (34, 16.3), 'N2l', rotY=180)
beds(u, 'N2l-s', [(32.5, 18), (36.8, 18)]); u.prop('N2l-s-table', 'table', (34.5, 18), 'N2l-s', dims={'w': 3, 'd': 3}); u.prop('N2l-s-wardrobe-a', 'wardrobe', (32.3, 22.3), 'N2l-s', rotY=180); u.prop('N2l-s-wardrobe-b', 'wardrobe', (34, 22.3), 'N2l-s', rotY=180)
for i, (x, z) in enumerate([(2, 9.5), (9, 9.5), (2, 16.5), (10, 16)]): u.prop(f'N2h-hay{i}', 'hay', (x, z), 'N2h')
u.hidden('N2h-chest', 'chest', (10.5, 9.3), 'N2h', 'A locked chest under the hay: 140 ep, 70 pp, two elixirs of health, three potions of healing, a grey bag of tricks')
u.creature('N2h-ravens', 'swarm', (6, 9.5), 'N2h', 'The ravens of the loft: four swarms if the chest is touched')
u.prop('N2h-pitchfork', 'post', (9, 10), 'N2h'); u.light('N2h-windows', (3, 9), 'daylight', 5, 10, y=5)
u.light('N2m-lamp', (27, 23), 'lantern', 15, 30, y=4); u.light('N2l-lamp', (34.5, 12), 'lantern', 10, 20, y=4); u.light('N2l-s-lamp', (34.5, 18), 'lantern', 10, 20, y=4)
cobwebs(u, rect(18.5, 2, 29.5, 4.5), 'N2j', y=9, n=2)

a = Level('attic', 'Attic / roof', 23, 8, ambient='darkness', interior='paneling-dusty', exterior='half-timber', north='-z')
a.room('N2q', 'Secret Attic', rect(14.5, 4, 16.5, 19), 'plank', page=pg('N2q'), ceilingFt=8)
a.prop('N2q-roof-w', 'roof-gable', (6.5, 13), 'N2q', rotY=90, dims={'w': 45, 'd': 55, 'h': 10})
a.prop('N2q-roof-main', 'roof-gable', (25.25, 11), 'N2q', dims={'w': 42, 'd': 48, 'h': 14})
a.prop('N2q-roof-e', 'roof-gable', (34.75, 17), 'N2q', rotY=90, dims={'w': 30, 'd': 32, 'h': 10})
a.prop('N2q-roof-s', 'roof-gable', (23, 21.75), 'N2q', dims={'w': 26, 'd': 32, 'h': 8})
for i, z in enumerate((5.5, 8, 12, 15)): a.prop(f'N2q-nest{i}', 'hay', (15.5, z), 'N2q', dims={'s': 0.6})
a.hidden('N2q-strongbox', 'chest', (15.5, 4.6), 'N2q', 'A locked iron strongbox against the north wall (Urwin has the key): the Keepers\' letters and 300 gp')
a.prop('N2q-trap-a', 'trapdoor', (15, 8.5), 'N2q'); a.prop('N2q-trap-b', 'trapdoor', (15.5, 17.5), 'N2q')
a.hidden('N2q-hole', 'niche', (15.5, 18.8), 'N2q', 'A small square opening in the south wall: raven-sized')
a.note('N2q-note', (15.5, 11), 'N2q', 'Ten by thirty-five feet, the ceiling slanting from 8 ft to 5 ft westward; the Martikovs sleep here as ravens.')
a.prop('N2q-chimney', 'chimney', (15.5, 3), 'N2q', dims={'h': 8})
write('N2', 'Blue Water Inn', 99, [g, u, a], [
    lk('lk-n2-main', 'stairs', 'ground', (24.5, 3), 'upper', (24.5, 3.25)), lk('lk-n2-outside', 'stairs', 'ground', (30.75, 6.5), 'upper', (30.75, 6.5)),
    lk('lk-n2-secret', 'stairs', 'ground', (12.5, 9), 'upper', (13.25, 11.5)), lk('lk-n2-loft', 'ladder', 'ground', (10.5, 15), 'upper', (10.5, 15)),
    lk('lk-n2-attic-o', 'trapdoor', 'upper', (17.5, 11), 'attic', (15, 8.5)), lk('lk-n2-attic-p', 'trapdoor', 'upper', (15, 8.5), 'attic', (15.5, 17.5)),
], {
    'N2c': ("A packed taproom under a balcony: lanterns in dull orange, wolf heads on plaques, a bar along the west wall, shutters and crossbars on every window.", "Danika tends bar; Urwin cooks; Rictavio, the wolf hunters, Ismark's friends. Everything bars from within."),
    'N2e': ("A cluttered kitchen round a pine worktable, two lanterns above it.", "The secret door at the west end of the south wall leads up to the hidden hall."),
    'N2d': ("Empty wine barrels stacked two high by the kitchen door.", None),
    'N2g': ("A cramped space under the stair with a chest.", "Horseshoes, a mallet, nails."),
    'N2f': ("A stable: a horse, birds squawking, a ladder to a loft, sliding doors chained shut.", "Drusilla; the small east door opens to the storage room; the loft is the ravens'."),
    'N2b': ("A wooden stair up the outer wall to the guest quarters.", "The door at the top bars from inside."),
    'N2a': ("A well in the inn yard.", None), 'N2c-porch': ("The inn's porch and double doors.", None),
    'N2h': ("A loft of hay and pitchforks under dirty windows, ravens everywhere.", "A locked chest under the hay; the ravens attack as four swarms if it is touched. Secret door to the master bedroom."),
    'N2i': ("A short panelled hall with a window, a stair down at its north end.", "Secret doors at both ends; Rictavio has heard the boys use it."),
    'N2j': ("A balcony the length of the taproom, railings carved with ravens, the rafters in lantern light.", "15 ft above the taproom; secret door at the south end of the west wall."),
    'N2k': ("A twenty-foot balcony overlooking the bar.", None),
    'N2b-top': ("The head of the outside stair.", None),
    'N2l': ("Two cosy beds heaped with wolf furs, footlockers, a lamp between them, two black wardrobes.", "Locks from inside; each guest gets a key."),
    'N2l-s': ("Two cosy beds heaped with wolf furs, footlockers, a lamp between them, two black wardrobes.", "Locks from inside; each guest gets a key."),
    'N2m': ("Four plain beds with straw mattresses along the north wall, a table and chairs in the corner, a bright oil lamp.", None),
    'N2n': ("A small room: a bed heaped with furs, a footlocker, a tall wardrobe, a writing desk.", "Rictavio's room, locked; the journal names Drusilla and his oddities. The lock is picked in full view of the taproom."),
    'N2o': ("Two small beds with a painted toy box between them.", "Blinsky toys in the box; a hidden trapdoor in the 8-ft ceiling to the attic."),
    'N2p': ("A canopied bed in red silk between end tables; a tapestry of a mountain valley.", "Secret door to the loft at the west end of the south wall; hidden trapdoor to the attic."),
    'N2q': ("A low attic of straw nests, a strongbox against the north wall, a small square hole to the sky.", "The wereravens' roost. Two trapdoors down to the bedrooms. Urwin keeps the strongbox key."),
}, entry='ground')

# ================================================================== N3 Burgomaster's Mansion
g = Level('ground', 'Ground floor', 0, 18, ambient='interior-dim', interior='paneling', exterior='ashlar', north='-z')
g.room('N3h', 'Pantry', rect(3, 3, 8.5, 8.5), 'plank', page=pg('N3h'), ceilingFt=10)
g.room('N3f', "Servants' Quarters", rect(8.5, 3, 18, 10), 'plank', page=pg('N3f'), ceilingFt=10)
g.room('N3e', 'Den', rect(18, 3, 27.5, 10), 'plank', page=pg('N3e'), ceilingFt=10)
g.room('N3a', 'Entrance Hall and Vestibule', [(27.5, 3), (35, 3), (35, 16), (27.5, 16)], 'plank', page=pg('N3a'), ceilingFt=18)
g.room('N3a-hall', 'Long Hall', rect(8.5, 10, 27.5, 14), 'plank', page=pg('N3a'), ceilingFt=10)
g.room('N3g', 'Kitchen', rect(3, 8.5, 8.5, 21.5), 'flagstone', page=pg('N3g'), ceilingFt=10)
g.room('N3d', 'Preparation Room', rect(8.5, 14, 16.5, 21.5), 'plank', page=pg('N3d'), ceilingFt=10)
g.room('N3c', 'Dining Room', rect(16.5, 14, 27.5, 21.5), 'plank', page=pg('N3c'), ceilingFt=10)
g.room('N3b', 'Parlor', rect(27.5, 16, 35, 21.5), 'plank', page=pg('N3b'), ceilingFt=10)
g.room('N3a-porch', 'Porch', rect(35, 7, 37, 11), 'flagstone', page=pg('N3a'), ceilingFt=10)
g.terrain.append(([(-10, -3), (40, -3), (40, 25), (-10, 25)], 'grass'))
for x, z in [(-8, 4), (-8, 8), (-8, 12), (-8, 16), (-8, 20)]: g.prop(f'N3-garden{int(z)}', 'bush', (x + 1, z), None); g.prop(f'N3-garden{int(z)}b', 'bush', (x + 5, z), None)
g.door((35, 8.5), (35, 9.5), id='N3a-front', double=True); g.opening((35, 7), (35, 11)) if False else None
g.door((27.5, 11), (27.5, 12), id='N3a-hall-door'); g.door((27.5, 17), (27.5, 18), id='N3b-door')
g.door((18, 7), (18, 8), id='N3e-f'); g.door((22, 10), (23, 10), id='N3e-hall'); g.door((13, 10), (14, 10), id='N3f-hall'); g.door((8.5, 5), (8.5, 6), id='N3h-f')
g.door((8.5, 11), (8.5, 12), id='N3g-hall'); g.door((3, 15), (3, 16), id='N3g-garden', locked=True); g.door((12, 14), (13, 14), id='N3d-hall'); g.door((22, 14), (23, 14), id='N3c-hall'); g.door((16.5, 17), (16.5, 18), id='N3c-d')
for a, b in [((3, 4), (3, 5)), ((11, 3), (12, 3)), ((15, 3), (16, 3)), ((21, 3), (22, 3)), ((25, 3), (26, 3)), ((30, 3), (31, 3)), ((35, 13), (35, 14)), ((35, 19), (35, 20)), ((19, 21.5), (20, 21.5)), ((24, 21.5), (25, 21.5)), ((11, 21.5), (12, 21.5)), ((5, 21.5), (6, 21.5)), ((3, 11), (3, 12))]:
    g.window(a, b)
g.wall((31, 3), (31, 6.5)); g.wall((31, 6.5), (35, 6.5))
g.prop('N3a-stair', 'stairs-straight', (29.25, 5), 'N3a', dims={'w': 15, 'rise': 20, 'fromZ': 35, 'toZ': 15})
g.prop('N3a-rug', 'rug', (31, 12), 'N3a', dims={'w': 10, 'd': 14}); g.prop('N3a-hall-rug', 'rug', (18, 12), 'N3a-hall', dims={'w': 85, 'd': 6})
g.hidden('N3a-cloaks', 'niche', (33, 5), 'N3a', 'A vestibule packed with fine cloaks, coats and boots'); g.hidden('N3a-portraits', 'niche', (29, 14), 'N3a', 'Framed portraits of past burgomasters')
g.note('N3a-twigs', (30, 10), 'N3a', 'Bundles of twigs pile up here for the wicker sun of the festival. A maid answers the door and leads callers to the den.')
g.prop('N3e-couch-a', 'bench', (19.5, 9), 'N3e'); g.prop('N3e-couch-b', 'bench', (25.5, 9), 'N3e'); g.prop('N3e-chair-a', 'chair', (19.5, 5), 'N3e'); g.prop('N3e-chair-b', 'chair', (20.5, 6.5), 'N3e'); g.prop('N3e-table', 'table-round', (23, 6.5), 'N3e'); g.prop('N3e-side', 'desk', (26.5, 8), 'N3e')
g.hidden('N3e-bear', 'niche', (27.2, 6), 'N3e', "A brown bear's head mounted on the east wall (a Grygorovich gift, whatever the baron says)")
g.light('N3e-lamp', (23, 6.5), 'lantern', 15, 30, y=7)
g.prop('N3f-table', 'table-round', (13.5, 5.5), 'N3f'); beds(g, 'N3f', [(9.5, 4), (16.8, 4), (9.5, 8.8), (16.8, 8.8)]);
for i, (x, z) in enumerate([(11, 3.6), (15.3, 3.6), (11, 9.3), (15.3, 9.3)]): g.prop(f'N3f-trunk{i}', 'trunk', (x, z), 'N3f')
g.note('N3f-note', (13.5, 7), 'N3f', "Two beds are the butler's and the lady-in-waiting's: both missing (see the attic).")
g.prop('N3h-shelves', 'shelves', (3.6, 5), 'N3h', rotY=90); g.prop('N3h-cask-a', 'wine-cask', (8, 4), 'N3h'); g.prop('N3h-cask-b', 'wine-cask', (8, 5.2), 'N3h')
g.prop('N3g-table', 'table', (5.5, 13), 'N3g', dims={'w': 4, 'd': 8}); g.prop('N3g-stove', 'stove', (3.7, 10), 'N3g', rotY=90); g.prop('N3g-cabinet', 'cabinet', (7.8, 18), 'N3g', rotY=-90)
g.prop('N3g-stair', 'stairs-straight', (5.5, 20), 'N3g', dims={'w': 5, 'rise': 20, 'fromX': 15, 'toX': 40})
g.creature('cook', 'commoner', (5, 15.5), 'N3g', 'The cook (commoner); carries the garden-door key')
g.prop('N3d-table-a', 'table', (12, 16.5), 'N3d', dims={'w': 8, 'd': 3}); g.prop('N3d-table-b', 'table', (12, 19.5), 'N3d', dims={'w': 8, 'd': 3})
g.hidden('N3d-silver', 'niche', (12, 16), 'N3d', 'A complete set of polished silverware laid out under a sheet'); g.hidden('N3d-baskets', 'niche', (12, 20), 'N3d', 'Wicker baskets of turnips and beets')
g.prop('N3c-table', 'table', (22, 17.5), 'N3c', dims={'w': 14, 'd': 5}); stools(g, 'N3c', [(18.5, 16.2), (21, 16.2), (23.5, 16.2), (26, 16.2), (18.5, 18.8), (21, 18.8), (23.5, 18.8), (26, 18.8)])
g.prop('N3c-serving', 'desk', (26.8, 20.5), 'N3c', rotY=-90); g.prop('N3c-chandelier', 'lamp', (22, 17.5), 'N3c', y=8); g.light('N3c-chandelier', (22, 17.5), 'candle', 15, 30, y=8)
g.creature('lydia', 'adventurer', (22, 15.5), 'N3c', 'Baroness Lydia Petrovna and eight peasant women at tea')
g.prop('N3b-couch', 'bench', (32, 21), 'N3b', rotY=180); g.prop('N3b-chair-a', 'chair', (29, 18), 'N3b'); g.prop('N3b-chair-b', 'chair', (33.5, 18), 'N3b'); g.prop('N3b-table', 'table-round', (31.5, 18.5), 'N3b'); g.prop('N3b-books', 'bookshelf', (28.3, 20), 'N3b', rotY=90)
g.light('N3b-lamp', (31.5, 18.5), 'lantern', 15, 30, y=7); g.light('N3a-chandelier', (31, 10), 'candle', 20, 40, y=14)

u = Level('upper', 'Upper floor', 20, 10, ambient='interior-dim', interior='paneling', exterior='ashlar', north='-z')
u.room('N3o', 'Master Bedroom', rect(3, 2, 12, 9), 'plank', page=pg('N3o'), ceilingFt=10)
u.room('N3n', 'Master Bedroom Closet', rect(12, 2, 16, 5.5), 'plank', page=pg('N3n'), ceilingFt=10)
u.room('N3q', 'Bathroom', rect(16, 2, 20, 5.5), 'plank', page=pg('N3q'), ceilingFt=10)
u.room('N3l', 'Library', rect(12, 5.5, 20, 17), 'plank', page=pg('N3l'), ceilingFt=10)
u.room('N3k', "Victor's Bedroom", rect(21.5, 2, 27.5, 9.5), 'plank', page=pg('N3k'), ceilingFt=10)
u.room('N3j', "Izek's Bedroom", rect(21.5, 9.5, 27.5, 17), 'plank', page=pg('N3j'), ceilingFt=10)
u.room('N3p', 'Bridal Gown and Spirit Mirror', rect(3, 9, 10.5, 15), 'plank', page=pg('N3p'), ceilingFt=10)
u.room('N3m', 'Locked Closet', rect(3, 15, 10.5, 19), 'plank', page=pg('N3m'), ceilingFt=10)
u.room('N3i', 'Upstairs Gallery', [(10.5, 17), (27.5, 17), (27.5, 2), (35, 2), (35, 21), (3, 21), (3, 19), (10.5, 19)], 'plank', page=pg('N3i'), ceilingFt=10)
u.room('N3i-hall', 'Gallery (north passage)', rect(20, 5.5, 21.5, 17), 'plank', page=pg('N3i'), ceilingFt=10)
u.door((12, 4), (12, 5), id='N3n-door'); u.door((16, 3.5), (16, 4.5), id='N3q-door'); u.door((20, 7), (20, 8), id='N3l-door'); u.door((21.5, 5), (21.5, 6), id='N3k-door'); u.door((21.5, 12), (21.5, 13), id='N3j-door', locked=True)
u.door((7, 9), (8, 9), id='N3p-door'); u.door((10.5, 11), (10.5, 12), id='N3p-east'); u.door((7, 19), (8, 19), id='N3m-door', locked=True); u.door((15, 17), (16, 17), id='N3l-south'); u.opening((20, 17), (21.5, 17)); u.opening((20, 5.5), (21.5, 5.5)) if False else None
u.door((24, 17), (25, 17), id='N3j-south'); u.door((10.5, 7), (10.5, 8), id='N3o-door') if False else None; u.door((10.5, 17.5), (10.5, 18.5), id='N3m-hall') if False else None
u.secret((10.5, 4), (10.5, 5), 'master-east', 'The master bedroom opens east onto the gallery passage', 'N3o') if False else None
u.door((12, 7), (12, 8), id='N3o-library') if False else None
u.door((27.5, 5), (27.5, 6), id='N3k-gallery'); u.door((3, 10), (3, 11), id='N3p-garderobe') if False else None
for a, b in [((5, 2), (6, 2)), ((9, 2), (10, 2)), ((24, 2), (25, 2)), ((30, 2), (31, 2)), ((35, 7), (35, 8)), ((35, 13), (35, 14)), ((30, 21), (31, 21)), ((22, 21), (23, 21)), ((14, 21), (15, 21)), ((6, 21), (7, 21)), ((3, 5), (3, 6)), ((3, 12), (3, 13))]:
    u.window(a, b)
u.railing((27.5, 9.5), (31, 9.5)); u.railing((27.5, 9.5), (27.5, 15)); u.railing((27.5, 15), (31, 15)); u.railing((31, 9.5), (31, 15))
u.prop('N3i-stair', 'stairs-straight', (29.25, 5), 'N3i', dims={'w': 15, 'rise': 0.1, 'fromZ': 35, 'toZ': 15})
u.prop('N3i-kstair', 'stairs-straight', (5.5, 20), 'N3i', dims={'w': 5, 'rise': 0.1, 'fromX': 15, 'toX': 40})
u.hidden('N3i-paintings', 'niche', (18, 20.5), 'N3i', 'Framed landscapes along the gallery; red silk drapes over a tall arched window')
u.prop('N3o-bed', 'bed', (6.5, 3.8), 'N3o', dims={'w': 7, 'd': 7}); u.prop('N3o-chair', 'chair', (4, 7.5), 'N3o'); u.prop('N3o-desk', 'desk', (11.3, 7), 'N3o', rotY=-90)
u.hidden('N3o-trap', 'trapdoor', (9, 6.5), 'N3o', 'A pull-rope trapdoor in the ceiling: a folding ladder up to the attic room')
u.creature('baron-sleeps', 'adventurer', (6.5, 3.8), 'N3o', 'Baron Vargas and Lydia sleep here at night')
u.prop('N3q-tub', 'trough', (18, 3.5), 'N3q'); u.prop('N3q-towels', 'desk', (16.8, 2.8), 'N3q')
u.prop('N3n-wardrobe', 'wardrobe', (14, 2.6), 'N3n'); u.prop('N3n-chest', 'trunk', (12.8, 4.5), 'N3n')
u.prop('N3l-desk', 'desk', (16, 11), 'N3l'); u.prop('N3l-chair', 'chair', (15, 11), 'N3l', rotY=90)
for i, (x, z, r) in enumerate([(12.4, 8, 90), (12.4, 11, 90), (12.4, 14, 90), (19.6, 8, -90), (19.6, 14, -90), (14, 6, 0), (17.5, 6, 0), (14, 16.6, 180), (17.5, 16.6, 180)]): u.prop(f'N3l-shelf{i}', 'bookshelf', (x, z), 'N3l', rotY=r)
u.creature('baron', 'adventurer', (16, 12.5), 'N3l', 'Baron Vargas Vallakovich in breastplate and rapier, ring and three keys')
u.note('N3l-note', (16, 9), 'N3l', 'Windowless, lined floor to ceiling with books (random books table). Keys: the garden door, the closet door, the manacles.')
u.light('N3l-lamp', (16, 11), 'lantern', 15, 30, y=7)
u.prop('N3k-bed', 'bed', (23, 3.8), 'N3k', dims={'w': 6, 'd': 7}); u.prop('N3k-shelf', 'bookshelf', (26.5, 8.6), 'N3k', rotY=180); u.hidden('N3k-mirror', 'niche', (26.8, 5.5), 'N3k', 'A full-length mirror in a wooden frame across from the door')
u.prop('N3j-bed', 'bed', (23, 11.3), 'N3j', dims={'w': 6, 'd': 7}); u.prop('N3j-chest', 'chest', (26.5, 15.5), 'N3j')
u.hidden('N3j-dolls', 'niche', (24.5, 15), 'N3j', "Dolls in Ireena's likeness everywhere: 'Is No Fun, Is No Blinsky!'"); u.hidden('N3j-sword', 'niche', (26.5, 16), 'N3j', 'A shortsword under wrinkled clothes in the unlocked chest; empty bottles under the bed')
u.creature('izek', 'adventurer', (24.5, 13), 'N3j', 'Izek Strazni (when at home)')
u.hidden('N3p-mirror', 'niche', (10.2, 12), 'N3p', 'The spirit mirror: speak the rhyme within 5 ft and the Ba\'al Verzi assassin\'s ghost appears'); u.prop('N3p-gown', 'armor-suit', (4, 10), 'N3p'); u.prop('N3p-wardrobe', 'wardrobe', (4, 14.3), 'N3p', rotY=180)
u.note('N3p-note', (6.5, 12), 'N3p', "Lydia's bridal gown on a stand; a door in the corner to a garderobe.")
u.prop('N3m-chains', 'chains', (6.5, 16.5), 'N3m', dims={'y': 6, 'len': 2}); u.creature('udo', 'commoner', (6.5, 17), 'N3m', 'Udo Lukovich, the shoemaker, manacled for malicious unhappiness')
u.light('N3i-window', (33, 12), 'daylight', 10, 20, y=6)

at = Level('attic', 'Attic', 30, 20, ambient='darkness', interior='paneling-dusty', exterior='ashlar', north='-z')
at.room('N3r', 'Attic Room', rect(3, 1.5, 10.5, 7), 'plank', page=pg('N3r'), ceilingFt=20)
at.room('N3s', 'Attic Storage', [(3, 7), (10.5, 7), (10.5, 1.5), (27, 1.5), (27, 13), (3, 13)], 'plank', page=pg('N3s'), ceilingFt=20)
at.room('N3t', "Victor's Workroom", rect(27, 1.5, 35, 13), 'plank', page=pg('N3t'), ceilingFt=20)
at.door((6, 7), (7, 7), id='N3r-door'); at.door((27, 7), (27, 8), id='N3t-door', locked=False)
at.hidden('N3t-glyph', 'pressure-plate', (27.5, 7.5), 'N3t', 'Glyph of warding on the skull-carved door: 5d8 lightning for anyone but Victor'); at.note('N3t-sign', (26.3, 7.5), 'N3t', "'ALL IS NOT WELL!' hangs from the knob; a young voice practises a teleport spell beyond.")
at.prop('N3r-table', 'table', (5, 4), 'N3r', dims={'w': 4, 'd': 3}); at.prop('N3r-lamp', 'lamp', (5, 4), 'N3r', y=3); at.hidden('N3r-trap', 'trapdoor', (8.5, 5), 'N3r', 'The folding ladder down to the master bedroom')
at.light('N3r-lamp', (5, 4), 'lantern', 10, 20, y=4)
for i, (x, z, k) in enumerate([(12, 3, 'trunk'), (15, 9, 'sheeted'), (19, 4, 'chest'), (22, 10, 'trunk'), (14, 11.5, 'wardrobe'), (24, 3.5, 'sheeted'), (6, 10, 'refuse'), (18, 7, 'refuse'), (25, 7, 'cabinet')]): at.prop(f'N3s-junk{i}', k, (x, z), 'N3s', rotY=(i * 40) % 360)
at.prop('N3s-prints', 'footprints', (20, 7.5), 'N3s', dims={'n': 10, 'len': 30, 'seed': 7}); at.note('N3s-note', (15, 6), 'N3s', 'One set of footprints in the dust leads east to the workroom.')
at.prop('N3t-table-a', 'table', (30, 3.5), 'N3t', dims={'w': 6, 'd': 3}); at.prop('N3t-table-b', 'table', (32.5, 10.5), 'N3t', dims={'w': 5, 'd': 3}); at.prop('N3t-shelf', 'bookshelf', (34.6, 6), 'N3t', rotY=-90); at.prop('N3t-circle', 'rug', (30, 8), 'N3t', dims={'w': 12, 'd': 12})
at.creature('victor', 'adventurer', (30, 7), 'N3t', 'Victor Vallakovich (mage apprentice) at his flawed teleportation circle')
at.creature('N3t-children', 'skeleton', (33.5, 2.5), 'N3t', 'Three "children" with their backs turned: the dead butler and lady-in-waiting (Victor\'s mistake) and a dummy', size='small')
at.creature('N3t-cats', 'swarm', (33, 9), 'N3t', 'Six cat skeletons (cat stats, darkvision, poison immunity)', size='tiny')
at.hidden('N3t-circle-note', 'niche', (30, 8.6), 'N3t', "Victor's circle: DC 15 Arcana shows it is flawed and deadly to use"); at.hidden('N3t-spellbook', 'niche', (31, 3.5), 'N3t', "Victor's spellbook: an incomplete teleportation circle and three sigil sequences")
at.light('N3t-lamp', (30, 4), 'lantern', 15, 30, y=5)
at.prop('N3-roof', 'roof-gable', (19, 7.25), None, dims={'w': 58, 'd': 162, 'h': 18})
write('N3', "Burgomaster's Mansion (Vallaki)", 104, [g, u, at], [
    lk('lk-n3-grand', 'stairs', 'ground', (29.25, 5), 'upper', (29.25, 5)), lk('lk-n3-kitchen', 'stairs', 'ground', (5.5, 20), 'upper', (5.5, 20)),
    lk('lk-n3-attic', 'ladder', 'upper', (9, 6.5), 'attic', (8.5, 5)),
], {
    'N3a': ("A grand foyer: portraits, a wide stair with a sculpted rail, twigs heaped for the festival, a cloakroom in the corner.", "A maid answers; she brings callers to the den and fetches the baron."),
    'N3a-hall': ("A long carpeted hall with doors on both sides.", None), 'N3a-porch': ("The mansion's porch and double doors, festival banners on the posts.", None),
    'N3b': ("A parlor of couches and a low table by a bookcase.", None),
    'N3c': ("A chandelier of wrought iron over a polished table; eight women at tea and cake while a ninth talks of decorations.", "Lydia Petrovna bribing peasant women with tea. She sends them to the den and calls the baron."),
    'N3d': ("Two sheeted tables: polished silver on one, baskets of turnips and beets on the other.", None),
    'N3e': ("A den that reeks of pipe smoke; a bear's head glowers from the east wall.", "The bear was a gift from the elder Szoldar, not the baron's father's kill."),
    'N3f': ("Four simple beds and four plain trunks.", "Two beds belong to the missing butler and lady-in-waiting."),
    'N3g': ("A kitchen with a stair in the corner and a door to the garden.", "The garden door is locked; the cook and the baron have keys."),
    'N3h': ("A pantry with two wine barrels against the east wall.", None),
    'N3i': ("A gallery twenty feet above the foyer, landscapes on the walls, red drapes over a tall arched window; narrow halls lead north.", None),
    'N3i-hall': ("A narrow hall between the library and the bedrooms.", None),
    'N3j': ("A bed and a heavy chest piled with dolls, every one with the same auburn hair.", "Izek's room, locked. The dolls are Ireena. A shortsword in the chest; empty bottles under the bed."),
    'N3k': ("A handsome room: a canopied bed, a low bookshelf, a full-length mirror, an arched window to the north.", "Nothing here betrays Victor's studies."),
    'N3l': ("A windowless library, shelves floor to ceiling, more books than any house in Barovia should hold.", "The baron sits here in breastplate and rapier, paranoid. Random books as in the castle study."),
    'N3m': ("A bare closet with manacles on the wall.", "Udo Lukovich, chained for complaining; the baron holds the keys."),
    'N3n': ("A closet of fine clothes.", None),
    'N3o': ("A faded master bedroom; a pull-rope hangs from a trapdoor in the ceiling.", "The folding ladder leads to the attic room."),
    'N3p': ("A bridal gown on a stand and a tall mirror; a door in the corner to a garderobe.", "The spirit mirror: the rhyme summons the Ba'al Verzi assassin's ghost, who charms and leads to the roof."),
    'N3q': ("An iron tub with clawed feet; folded towels on a table.", None),
    'N3r': ("A dusty room under a high peaked roof: an old table with a lantern.", None),
    'N3s': ("Attic storage crammed with old furniture and crates under sheets.", "A single trail of footprints leads to the workroom."),
    'N3t': ("A study of mismatched furniture, parchment diagrams on the tables, a shelf of bones, three small children standing with their backs to the door.", "Victor practises teleportation; the children are his failures. Six cat skeletons. The circle is deadly."),
}, entry='ground')

# ================================================================== N4 Wachterhaus
g = Level('ground', 'Ground floor', 0, 15, ambient='interior-dim', interior='paneling', exterior='ashlar', north='-z')
BAY = [(1.5, 9), (3, 7), (6, 7), (6, 14), (3, 14), (1.5, 12)]
g.room('N4k', 'Den', BAY, 'plank', page=pg('N4k'), ceilingFt=12)
g.room('N4h', "Servants' Quarters", rect(6, 3, 17, 7), 'plank', page=pg('N4h'), ceilingFt=10)
g.room('N4e', 'Back Vestibule', rect(17, 3, 21, 5), 'flagstone', page=pg('N4e'), ceilingFt=10)
g.room('N4f', "Servants' Closet", rect(17, 5, 21, 7), 'plank', page=pg('N4f'), ceilingFt=10)
g.room('N4d', 'Storage Room', rect(21, 3, 28, 9.5), 'flagstone', page=pg('N4d'), ceilingFt=10)
g.room('N4i', 'Parlor', rect(6, 7, 17, 14), 'plank', page=pg('N4i'), ceilingFt=12)
g.room('N4b', 'Staircase', rect(17, 7, 21, 16), 'plank', page=pg('N4b'), ceilingFt=15)
g.room('N4c', 'Kitchen', rect(21, 9.5, 28, 15), 'flagstone', page=pg('N4c'), ceilingFt=10)
g.room('N4c-pantry', 'Pantry', rect(21, 15, 23.5, 18), 'flagstone', page=pg('N4c'), ceilingFt=10)
g.room('N4j', 'Dining Room', rect(6, 14, 17, 21), 'plank', page=pg('N4j'), ceilingFt=12)
g.room('N4a', 'Front Door and Vestibule', rect(17, 16, 21, 21), 'flagstone', page=pg('N4a'), ceilingFt=10)
g.room('N4a-west', 'West Closet', rect(15, 18, 17, 21), 'plank', page=pg('N4a'), ceilingFt=10)
g.room('N4a-east', 'East Closet', rect(21, 18, 23.5, 21), 'plank', page=pg('N4a'), ceilingFt=10)
g.room('N4k-east', 'Den (east)', rect(23.5, 15, 28, 21), 'plank', page=pg('N4k'), ceilingFt=12)
g.room('N4r', 'Cellar Entrance', rect(28, 5, 30.5, 7), 'flagstone', page=pg('N4r'), ceilingFt=6)
g.terrain.append(([(-8, -2), (34, -2), (34, 25), (-8, 25)], 'grass'))
for i in range(5): g.prop(f'N4-garden{i}', 'bush', (-6 + (i % 2) * 2, 2 + i * 4), None); g.prop(f'N4-gardenb{i}', 'bush', (-3, 3 + i * 4), None)
g.door((18.5, 21), (19.5, 21), id='N4a-front', locked=True); g.door((17, 19), (17, 20), id='N4a-closet-w-door'); g.door((21, 19), (21, 20), id='N4a-closet-e-door'); g.door((18.5, 16), (19.5, 16), id='N4a-inner')
g.door((17, 17), (17, 18), id='N4j-door'); g.door((21, 16.5), (21, 17.5), id='N4k-east-door'); g.door((17, 10), (17, 11), id='N4i-door'); g.door((21, 11.5), (21, 12.5), id='N4c-door'); g.door((22, 15), (23, 15), id='N4c-pantry-door')
g.door((18.5, 3), (19.5, 3), id='N4e-back', locked=True); g.door((17, 3.5), (17, 4.5), id='N4e-h'); g.door((21, 3.5), (21, 4.5), id='N4e-d'); g.door((18.5, 5), (19.5, 5), id='N4e-f'); g.door((18.5, 7), (19.5, 7), id='N4f-b')
g.door((6, 10), (6, 11), id='N4k-door'); g.door((11, 7), (12, 7), id='N4h-i'); g.door((11, 14), (12, 14), id='N4i-j'); g.door((23.5, 17.5), (23.5, 18.5), id='N4k-east-closet') if False else None
g.door((28, 5.5), (28, 6.5), id='N4r-door'); g.door((30.5, 5.5), (30.5, 6.5), id='N4r-outer')
g.secret((19, 7), (20, 7), 'closet-stair', 'A secret door in the south wall of the servants\' closet: a stone stair to the cellar (DC 10 Perception)', 'N4f', extra=True) if False else None
g.secret((17, 5.5), (17, 6.5), 'closet-stair', 'A secret door in the south wall of the servants\' closet: a stone stair to the cellar (DC 10 Perception)', 'N4f', extra=True)
for a, b in [((1.5, 10), (1.5, 11)), ((3, 7.5), (4, 7.5)), ((3, 13.5), (4, 13.5)), ((8, 3), (9, 3)), ((13, 3), (14, 3)), ((23, 3), (24, 3)), ((26, 3), (27, 3)), ((28, 11), (28, 12)), ((28, 17), (28, 18)), ((25, 21), (26, 21)), ((13, 21), (14, 21)), ((8, 21), (9, 21)), ((6, 16), (6, 17)), ((6, 19), (6, 20))]:
    g.window(a, b)
g.prop('N4b-stair', 'stairs-straight', (19, 11), 'N4b', dims={'w': 5, 'rise': 15, 'fromZ': 75, 'toZ': 35})
g.hidden('N4b-glass', 'niche', (19, 15.5), 'N4b', 'Three stained-glass doors in wooden frames at the foot of the stair')
g.prop('N4a-peep', 'niche', (19, 20.6), 'N4a') if False else None
g.note('N4a-note', (19, 18.5), 'N4a', 'Bronze-banded door, locked (DC 20 Strength); a servant asks your business through a small window in it.')
g.prop('N4k-couch-a', 'bench', (4.5, 8.5), 'N4k', rotY=180); g.prop('N4k-couch-b', 'bench', (4.5, 12.5), 'N4k'); g.prop('N4k-table', 'table-round', (3.5, 10.5), 'N4k'); g.prop('N4k-fire', 'fireplace', (5.7, 10.5), 'N4k', rotY=-90)
g.prop('N4i-couch-a', 'bench', (8, 8.5), 'N4i'); g.prop('N4i-couch-b', 'bench', (8, 12.5), 'N4i', rotY=180); g.prop('N4i-couch-c', 'bench', (14.5, 10.5), 'N4i', rotY=90); g.prop('N4i-table', 'table-round', (11, 10.5), 'N4i'); g.prop('N4i-fire', 'fireplace', (6.3, 10.5), 'N4i', rotY=90)
g.hidden('N4i-portraits', 'niche', (11, 7.4), 'N4i', 'Portraits of the Wachter line along the north wall'); g.light('N4i-fire', (7, 10.5), 'torch', 10, 20, y=3)
g.prop('N4j-table', 'table', (11.5, 17.5), 'N4j', dims={'w': 16, 'd': 5}); stools(g, 'N4j', [(7.5, 16.2), (10, 16.2), (12.5, 16.2), (15, 16.2), (7.5, 18.8), (10, 18.8), (12.5, 18.8), (15, 18.8)]); g.prop('N4j-chandelier', 'lamp', (11.5, 17.5), 'N4j', y=9); g.light('N4j-chandelier', (11.5, 17.5), 'candle', 15, 30, y=9)
beds(g, 'N4h', [(7, 4), (9.5, 4), (12, 4), (14.5, 4)]);
for i in range(4): g.prop(f'N4h-chest{i}', 'trunk', (7 + i * 2.5, 6.3), 'N4h')
g.creature('N4-servants', 'commoner', (10, 5.5), 'N4h', 'Three servants and the cook (commoners), loyal to the death')
for i in range(5): g.prop(f'N4d-cask{i}', 'wine-cask', (22 + (i % 3) * 1.2, 4 + (i // 3) * 1.3), 'N4d')
for i in range(4): g.prop(f'N4d-crate{i}', 'trunk', (26.5, 4 + i * 1.3), 'N4d')
g.prop('N4c-table', 'table', (24.5, 12), 'N4c', dims={'w': 8, 'd': 3}); g.prop('N4c-stove', 'stove', (27.3, 10.5), 'N4c', rotY=-90); g.prop('N4c-basin', 'trough', (27, 14), 'N4c'); g.creature('N4-cook', 'commoner', (23, 11), 'N4c', 'The house cook')
g.prop('N4k-east-desk', 'desk', (27.3, 16.5), 'N4k-east', rotY=-90); g.prop('N4k-east-chair', 'chair', (26, 16.5), 'N4k-east', rotY=90); g.prop('N4k-east-fire', 'fireplace', (23.8, 18.5), 'N4k-east', rotY=90); g.hidden('N4k-east-note', 'niche', (26, 19.5), 'N4k-east', 'Tall windows over dead gardens; the hearth is shared with the parlor')
g.prop('N4r-stair', 'stairs-straight', (29.25, 6), 'N4r', dims={'w': 5, 'rise': 12, 'fromX': 152, 'toX': 142})
g.light('N4a-lamp', (19, 18.5), 'lantern', 10, 20, y=7)

u = Level('upper', 'Upper floor', 15, 10, ambient='interior-dim', interior='paneling', exterior='ashlar', north='-z')
u.room('N4p', 'Library', [(1.5, 8), (3, 6), (6, 6), (6, 2), (17, 2), (17, 9), (10.5, 9), (10.5, 13), (6, 13), (3, 13), (1.5, 11)], 'plank', page=pg('N4p'), ceilingFt=10)
u.room('N4q', 'Storage Room', rect(10.5, 9, 17, 13), 'plank', page=pg('N4q'), ceilingFt=10)
u.room('N4n', "Stella's Room", rect(6, 13, 10.5, 17), 'plank', page=pg('N4n'), ceilingFt=10)
u.room('N4m', "Brothers' Room (south)", rect(10.5, 13, 17, 17), 'plank', page=pg('N4m'), ceilingFt=10)
u.room('N4m-n', "Brothers' Room (north)", rect(21, 2, 28, 8.5), 'plank', page=pg('N4m'), ceilingFt=10)
u.room('N4l', 'Upstairs Hall', rect(17, 2, 21, 17), 'plank', page=pg('N4l'), ceilingFt=10)
u.room('N4l-closet', 'Linen Closet', rect(17, 17, 21, 19), 'plank', page=pg('N4l'), ceilingFt=10)
u.room('N4o', 'Master Bedroom', rect(21, 8.5, 28, 17), 'plank', page=pg('N4o'), ceilingFt=10)
u.room('N4o-closet', 'Closet', rect(25, 17, 28, 19), 'plank', page=pg('N4o'), ceilingFt=10)
u.door((17, 5), (17, 6), id='N4p-door'); u.door((10.5, 14.5), (10.5, 15.5), id='N4n-door', locked=True); u.door((17, 14.5), (17, 15.5), id='N4m-door'); u.door((21, 5), (21, 6), id='N4m-n-door'); u.door((21, 12), (21, 13), id='N4o-door', locked=True)
u.door((18.5, 17), (19.5, 17), id='N4l-closet-door'); u.door((26, 17), (27, 17), id='N4o-closet-door')
u.secret((10.5, 11), (10.5, 12), 'bookcase', 'A hinged panel in the bookcase opens on the storage room', 'N4p')
u.railing((17, 9), (17, 13)) if False else None
for a, b in [((1.5, 9), (1.5, 10)), ((8, 2), (9, 2)), ((13, 2), (14, 2)), ((23, 2), (24, 2)), ((26, 2), (27, 2)), ((28, 11), (28, 12)), ((28, 14), (28, 15)), ((12, 17), (13, 17)), ((7.5, 17), (8.5, 17)), ((18.5, 2), (19.5, 2)), ((18.5, 19), (19.5, 19)), ((13, 8.5), (14, 8.5))]:
    u.window(a, b) if (a, b) != ((13, 8.5), (14, 8.5)) else None
u.prop('N4l-stair', 'stairs-straight', (19, 11), 'N4l', dims={'w': 5, 'rise': 0.1, 'fromZ': 75, 'toZ': 35}); u.railing((18.5, 7), (18.5, 15)) if False else None
u.note('N4l-note', (19, 4), 'N4l', "Scratching at Stella's locked door: 'little kitty is sad and lonely'.")
for i, (x, z, r) in enumerate([(6.4, 3.5, 90), (6.4, 6, 90), (10, 2.4, 0), (14, 2.4, 0), (16.6, 4, -90), (16.6, 7, -90), (12, 8.1, 180), (15, 8.1, 180), (3.4, 9, 90)]): u.prop(f'N4p-shelf{i}', 'bookshelf', (x, z), 'N4p', rotY=r)
u.prop('N4p-desk', 'desk', (8, 10), 'N4p'); u.prop('N4p-chair', 'chair', (8, 11.2), 'N4p', rotY=180); u.prop('N4p-table', 'table', (11, 5), 'N4p', dims={'w': 10, 'd': 3})
u.creature('fiona', 'adventurer', (8, 11.5), 'N4p', "Lady Fiona Wachter (priest, AC 10) with Majesto her imp familiar")
u.hidden('N4p-key', 'niche', (8.5, 9.5), 'N4p', 'The key to the storage room\'s iron chest, in the desk'); u.hidden('N4p-manifesto', 'niche', (11, 4.5), 'N4p', "Fiona's manifesto and the book club's reading")
u.light('N4p-lamp', (8, 10), 'lantern', 15, 30, y=6)
u.prop('N4q-chest', 'chest', (13.5, 11.8), 'N4q'); u.hidden('N4q-contents', 'niche', (13.5, 11.2), 'N4q', '180 ep with Strahd\'s profile, 110 gp, the Wachter pipe, five deeds from Strahd')
for i, (x, z, r) in enumerate([(11, 9, 90), (16.6, 10.5, -90), (13.5, 8.8, 0)]): u.prop(f'N4q-shelf{i}', 'shelves', (x, z), 'N4q', rotY=r)
u.prop('N4n-bed', 'bed', (7.5, 14.3), 'N4n'); u.creature('stella', 'commoner', (7.5, 14.3), 'N4n', 'Stella Wachter, mad, strapped to an iron bed; thinks she is a cat'); u.note('N4n-note', (8.5, 16), 'N4n', 'Locked both sides; Fiona has the only key.')
u.prop('N4m-bed', 'bed', (12, 14.3), 'N4m'); u.prop('N4m-table', 'table', (15.5, 14), 'N4m', dims={'w': 3, 'd': 3}); u.prop('N4m-lamp', 'lamp', (15.5, 14), 'N4m', y=3); u.prop('N4m-chest', 'chest', (14, 16.4), 'N4m'); u.prop('N4m-wardrobe', 'wardrobe', (16.5, 16.3), 'N4m', rotY=180)
u.prop('N4m-n-bed-a', 'bed', (26.5, 3.5), 'N4m-n'); u.prop('N4m-n-bed-b', 'bed', (26.5, 7.3), 'N4m-n'); u.prop('N4m-n-table', 'table', (22.5, 5), 'N4m-n', dims={'w': 3, 'd': 3}); u.prop('N4m-n-chest', 'chest', (22, 2.6), 'N4m-n')
u.creature('brothers', 'adventurer', (24.5, 5.5), 'N4m-n', 'Nikolai and Karl Wachter, passed out drunk most nights')
u.prop('N4o-bed', 'bed', (23, 9.6), 'N4o', dims={'w': 7, 'd': 7}); u.prop('N4o-side-a', 'desk', (21.4, 9.3), 'N4o'); u.prop('N4o-side-b', 'desk', (24.8, 9.3), 'N4o'); u.prop('N4o-fire', 'fireplace', (24.5, 16.6), 'N4o', rotY=180); u.hidden('N4o-mirror', 'niche', (27.5, 15.5), 'N4o', 'A framed mirror beside a curtained window')
u.creature('nikolai', 'skeleton', (23, 9.6), 'N4o', "Nikolai Wachter's corpse in the bed, a copper on each eye, under gentle repose")
u.hidden('N4o-portrait', 'niche', (24.5, 16), 'N4o', 'A family portrait above the hearth: father, mother, two sons, a baby girl'); u.hidden('N4o-robe', 'niche', (26.5, 18.5), 'N4o', 'In the closet: fine garments and a hooded black ceremonial robe')
u.light('N4o-fire', (24.5, 16), 'torch', 10, 20, y=3); u.light('N4l-window', (19, 3), 'daylight', 5, 10, y=6)
u.prop('N4-roof', 'roof-gable', (17, 9.5), None, dims={'w': 110, 'd': 70, 'h': 14})

c = Level('cellar', 'Cellar', -12, 10, ambient='darkness', interior='rubble', exterior='earth', north='-z')
c.room('N4t', 'Cult Headquarters', rect(2.5, 9, 13, 19), 'flagstone', page=pg('N4t'), ceilingFt=10)
c.room('N4s', 'Cellar', [(13, 2), (24, 2), (24, 19), (13, 19), (13, 11), (15.5, 11), (15.5, 6), (13, 6)], 'dirt', page=pg('N4s'), ceilingFt=8)
c.room('N4g', 'Secret Staircase', rect(13, 6, 15.5, 11), 'flagstone', page=pg('N4g'), ceilingFt=10)
c.room('N4r-foot', 'Cellar Entrance (foot)', rect(24, 4, 26.5, 6), 'flagstone', page=pg('N4r'), ceilingFt=8)
c.secret((13, 13), (13, 14), 'pivot', 'A soundproof door that pivots on a central axis in the bare west wall; the footprints give it away', 'N4s')
c.opening((15.5, 9), (15.5, 11)); c.opening((24, 4), (24, 6))
c.prop('N4g-stair', 'stairs-straight', (14.25, 8.5), 'N4g', dims={'w': 5, 'rise': 12, 'fromZ': 55, 'toZ': 30})
c.prop('N4r-foot-stair', 'stairs-straight', (23, 5), 'N4r-foot', dims={'w': 5, 'rise': 12, 'fromZ': 20, 'toZ': 30}) if False else None
c.prop('N4s-stair', 'stairs-straight', (23, 5), 'N4s', dims={'w': 4, 'rise': 12, 'fromX': 125, 'toX': 110})
c.prop('N4s-prints', 'footprints', (18, 10), 'N4s', dims={'n': 12, 'len': 40, 'seed': 11})
beds(c, 'N4s', [(15.5, 18.2), (18, 18.2), (20.5, 18.2), (23, 18.2)], kind='pallet')
c.creature('N4s-skeletons', 'skeleton', (18, 14), 'N4s', 'Eight skeletons buried under the dirt floor, stolen from the church cemetery')
c.prop('N4t-pentagram', 'rug', (7.75, 14), 'N4t', dims={'w': 40, 'd': 40}); c.note('N4t-note', (7.75, 11), 'N4t', "A black pentagram on the stone; the 'book club' waits for Lady Wachter with candles lit.")
for i, (x, z) in enumerate([(3, 9.5), (11.5, 9.5), (3, 18.5), (11.5, 18.5)]): c.prop(f'N4t-candle{i}', 'brazier', (x, z), 'N4t'); c.light(f'N4t-candle{i}', (x, z), 'candle', 5, 10, y=2)
for i, (x, z) in enumerate([(5.5, 10.5), (9, 10.5), (4.5, 15.5), (10, 15.5), (7.25, 17.5)]): c.prop(f'N4t-chair{i}', 'chair', (x, z), 'N4t', rotY=i * 72)
c.creature('N4t-cultists', 'cultist', (7.25, 13), 'N4t', 'Cult fanatics (3) and cultists (6) in black robes')
cobwebs(c, rect(13, 2, 24, 19.5), 'N4s', y=7, n=2)
write('N4', 'Wachterhaus', 111, [c, g, u], [
    lk('lk-n4-main', 'stairs', 'ground', (19, 11), 'upper', (19, 11)), lk('lk-n4-secret', 'stairs', 'ground', (17.5, 6), 'cellar', (14.25, 8.5)), lk('lk-n4-cellar', 'stairs', 'ground', (29.25, 6), 'cellar', (23, 5)),
], {
    'N4a': ("A narrow vestibule behind a bronze-banded door; three stained-glass doors lead on; closets flank the entrance.", "Locked, DC 20 Strength; a servant speaks through the eye-window."),
    'N4a-west': ("Lady Wachter's outdoor clothes.", None), 'N4a-east': ("Coats and boots of the children.", None),
    'N4b': ("A wooden stair up to a balcony; three stained-glass doors at its foot.", "Climbs 15 ft to the upstairs hall."),
    'N4c': ("A spotless kitchen; a washbasin in the corner, a slender door to a pantry.", None), 'N4c-pantry': ("A small pantry.", None),
    'N4d': ("Barrels and crates.", None), 'N4e': ("The back vestibule: a locked, banded door and three plain doors.", None),
    'N4f': ("A closet of brooms and aprons.", "Secret door in the south wall (DC 10 Perception): the stone stair to the cellar."),
    'N4g': ("A stone stair with iron sconces cutting down through the house.", "Fiona's way to her cult."),
    'N4h': ("Four austere beds and chests.", "The servants know everything and say nothing."),
    'N4i': ("Three elegant couches round a black-glass table; portraits on the north wall; a hearth shared with the den.", None),
    'N4j': ("A long table under a crystal chandelier; eight chairs with elk-horn backs; iron-and-glass windows over the fog-swept grounds.", None),
    'N4k': ("A bay den of couches by the hearth, windows over dead gardens.", None), 'N4k-east': ("A study by a hearth, tall windows over the dead gardens.", None),
    'N4r': ("A slanted cellar door with an iron ring against the foundation.", "Unlocked; stone steps to a landing, then down to the cellar."),
    'N4l': ("A hall wrapping the stair rail, a window at each end; something scratches at one of the doors.", "Stella's door. A linen closet at the south end."),
    'N4l-closet': ("Blankets and linens.", None),
    'N4m': ("A neat bed, a table with a lamp, a handsome chest, a slender wardrobe.", "25% a maid is tidying."), 'N4m-n': ("Two beds; bottles under them.", "Nikolai and Karl sleep off their drink."),
    'N4n': ("An iron-framed bed with leather straps.", "Stella, mad as a cat; locked both sides, Fiona's key only."),
    'N4o': ("A fire struggles in the hearth under a family portrait; a canopied bed between lamp-lit tables; a man in black lies on it with coins on his eyes.", "Nikolai, dead three years, under gentle repose. A hooded robe in the closet."),
    'N4p': ("A library in the bay, shelves on every wall, a desk by the window.", "Fiona works here with Majesto. Hinged bookcase panel to the storage room; the chest key in the desk."),
    'N4q': ("A dusty ten-foot room of shelves with a curtained window; an iron chest on the bottom shelf.", "180 ep, 110 gp, the Wachter pipe, five deeds from Strahd."),
    'N4r-foot': ("The foot of the cellar steps.", None),
    'N4s': ("A root cellar with a dirt floor; four cots along the south wall; tracks in the earth lead to a bare wall.", "Eight skeletons under the floor; the pivot door in the west wall."),
    'N4t': ("A ten-foot-high room with a black pentagram on the floor, candles at its corners.", "Fiona's book club: cult fanatics and cultists. They attack to keep their secret."),
}, entry='ground')

# ================================================================== N6 Coffin Maker's Shop
g = Level('ground', 'Ground level', 0, 10, ambient='interior-dim', interior='paneling-dusty', exterior='half-timber', north='-z')
g.room('N6a', 'Coffin Storage', [(1, 1.5), (19, 1.5), (19, 20), (9, 20), (9, 12), (1, 12)], 'plank', page=pg('N6a'), ceilingFt=10)
g.room('N6c', 'Workshop', rect(1, 12, 9, 30.5), 'plank', page=pg('N6c'), ceilingFt=10)
g.room('N6a-stair', 'Stair', rect(9, 20, 11.5, 30.5), 'plank', page=pg('N6a'), ceilingFt=10)
g.room('N6b', 'Junk Room', rect(11.5, 20, 19, 30.5), 'plank', page=pg('N6b'), ceilingFt=10)
g.door((4, 30.5), (5, 30.5), id='N6-front', locked=True); g.door((19, 5), (19, 6), id='N6-side', locked=True)
g.door((9, 17), (9, 18), id='N6c-a'); g.door((9.5, 20), (10.5, 20), id='N6-stair-a'); g.door((12, 20), (13, 20), id='N6b-a'); g.door((9, 28), (9, 29), id='N6c-stair')
for a, b in [((1, 5), (1, 6)), ((1, 9), (1, 10)), ((19, 11), (19, 12)), ((19, 25), (19, 26)), ((1, 20), (1, 21)), ((1, 26), (1, 27)), ((6, 1.5), (7, 1.5)), ((14, 1.5), (15, 1.5))]:
    g.window(a, b)
g.note('N6-shutters', (10, 0.5), None, 'Every shutter is closed tight; a coffin-shaped sign hangs over the door.')
COFFINS = [(3, 3, 20), (3, 6, -15), (3, 9, 10), (8, 3, 80), (9.5, 6, -70), (10, 9, 60), (15.5, 3, 15), (17.5, 6, 85), (17.5, 10, 80), (10, 13, 85), (17.5, 14, 75), (15, 17, -20), (17.5, 18, 70)]
for i, (x, z, r) in enumerate(COFFINS): g.prop(f'N6a-coffin{i}', 'coffin', (x, z), 'N6a', rotY=r)
g.note('N6a-note', (12, 8), 'N6a', 'Thirteen coffins stand about the floor, Henrik\'s stock and display.')
for i, z in enumerate((14, 20, 26)): g.prop(f'N6c-bench{i}', 'table', (2.5, z), 'N6c', rotY=90, dims={'w': 10, 'd': 3})
g.prop('N6c-tools', 'shelves', (1.4, 29), 'N6c', rotY=90); g.hidden('N6c-tools-note', 'niche', (2.5, 17), 'N6c', "Henrik's carpentry tools along the benches")
g.prop('N6-stair-run', 'stairs-straight', (10.25, 24), 'N6a-stair', dims={'w': 4, 'rise': 10, 'fromZ': 140, 'toZ': 105})
g.prop('N6b-table', 'table-round', (16, 27.5), 'N6b'); stools(g, 'N6b', [(14.5, 26.5), (17.5, 26.5), (14.5, 28.5), (17.5, 28.5)]); g.prop('N6b-lamp', 'lamp', (16, 27.5), 'N6b', y=6)
g.prop('N6b-cabinet-a', 'cabinet', (18.4, 21.5), 'N6b', rotY=-90); g.prop('N6b-cabinet-b', 'cabinet', (18.4, 24), 'N6b', rotY=-90); g.light('N6b-lamp', (16, 27.5), 'lantern', 10, 20, y=6)
g.creature('henrik', 'commoner', (5, 20), 'N6c', 'Henrik van der Voort, the coffin maker, troubled and alone')

u = Level('upper', 'Upper level', 10, 10, ambient='darkness', interior='paneling-dusty', exterior='half-timber', north='-z')
u.room('N6f', 'Vampire Nest', [(1, 1.5), (19, 1.5), (19, 30), (11.5, 30), (11.5, 20), (9, 20), (9, 12), (1, 12)], 'plank', page=pg('N6f'), ceilingFt=10)
u.room('N6e', "Henrik's Bedroom", rect(1, 12, 9, 22), 'plank', page=pg('N6e'), ceilingFt=10)
u.room('N6d', 'Kitchen', rect(1, 22, 9, 30), 'plank', page=pg('N6d'), ceilingFt=10)
u.room('N6a-top', 'Stair (head)', rect(9, 20, 11.5, 30), 'plank', page=pg('N6a'), ceilingFt=10)
u.door((3, 22), (4, 22), id='N6d-e'); u.door((9, 28.5), (9, 29.5), id='N6d-stair'); u.door((11.5, 28.5), (11.5, 29.5), id='N6-stair-f'); u.opening((9, 20), (11.5, 20)) if False else None
u.door((9, 15), (9, 16), id='N6e-f')
for a, b in [((19, 11), (19, 12)), ((19, 25), (19, 26)), ((1, 5), (1, 6)), ((1, 16), (1, 17)), ((1, 26), (1, 27)), ((14, 30), (15, 30))]:
    u.window(a, b)
u.prop('N6-stair-top-run', 'stairs-straight', (10.25, 24), 'N6a-top', dims={'w': 4, 'rise': 0.1, 'fromZ': 140, 'toZ': 105})
for i, (x, z, r) in enumerate([(4, 3, 0), (7, 3, 0), (3, 7, 0), (6, 7.5, 0), (16, 20, 90), (16, 24, 90), (15, 17, 90), (13, 13, 0)]): u.prop(f'N6f-planks{i}', 'ledge', (x, z), 'N6f', rotY=r, dims={'w': 6, 'd': 2, 'h': 1.5})
for i, (x, z) in enumerate([(11, 3), (14.5, 3.5), (17.5, 3.5), (11.5, 7), (15, 7.5), (17.5, 10)]): u.prop(f'N6f-crate{i}', 'trunk', (x, z), 'N6f', rotY=i * 25)
for i, (x, z) in enumerate([(13, 28.5), (17.5, 28.5)]): u.prop(f'N6f-junk{i}', 'trunk', (x, z), 'N6f')
u.creature('N6f-spawn', 'vampire-spawn', (14.5, 6), 'N6f', 'Six vampire spawn resting in the six northern crates (packed with earth)')
u.hidden('N6f-bones', 'chest', (16, 14), 'N6f', "A crate holding the bones of St. Andral"); u.note('N6f-note', (12, 10), 'N6f', "Six crates marked JUNK in the north are earth beds; the two southern ones are junk. The saint's bones are among the stacks.")
u.prop('N6e-cot', 'bed', (2.5, 14), 'N6e'); u.prop('N6e-table', 'table', (6, 16), 'N6e', dims={'w': 3, 'd': 3}); u.prop('N6e-chair', 'chair', (7.5, 16), 'N6e', rotY=-90); u.prop('N6e-shelf', 'bookshelf', (8.6, 13.5), 'N6e', rotY=-90); u.prop('N6e-wardrobe', 'wardrobe', (8, 21.4), 'N6e', rotY=180)
u.hidden('N6e-compartment', 'niche', (8, 20.6), 'N6e', 'A secret compartment in the wardrobe\'s base (DC 15 Perception)')
u.prop('N6d-table', 'table', (4, 25.5), 'N6d', dims={'w': 4, 'd': 4}); stools(u, 'N6d', [(2.5, 25.5), (5.5, 25.5), (4, 24), (4, 27)]); u.prop('N6d-shelves', 'shelves', (1.4, 28.5), 'N6d', rotY=90); u.prop('N6d-stove', 'stove', (7.5, 29.3), 'N6d', rotY=180)
u.prop('N6-roof', 'roof-gable', (10, 16), None, rotY=90, dims={'w': 36, 'd': 58, 'h': 12})
write('N6', "Coffin Maker's Shop", 116, [g, u], [lk('lk-n6-stair', 'stairs', 'ground', (10.25, 24), 'upper', (10.25, 24))], {
    'N6a': ("An L-shaped room, musty, thirteen coffins stood and laid about the floor.", None),
    'N6b': ("A table and four chairs under a lantern on a chain; two fine cabinets on the east wall.", None),
    'N6c': ("A carpenter's workshop: three sturdy benches along the west wall, every tool in its place.", None),
    'N6a-stair': ("A narrow stair.", None), 'N6a-top': ("The head of the stair.", None),
    'N6d': ("A square table and chairs; shelves of provisions.", None),
    'N6e': ("A modest bedchamber: a cot, a table, a padded chair, a bookshelf, a wardrobe.", "Secret compartment in the wardrobe base."),
    'N6f': ("Stacks of planks among crates marked JUNK.", "Six vampire spawn in the northern crates; the bones of St. Andral are here."),
}, entry='ground')

# ================================================================== N9 Vistani Camp (north is to the right on the plate)
v = Level('camp', 'The camp', 0, 20, ambient='night', interior='log', exterior='log', north='+x')
v.terrain.append(([(0, 0), (67, 0), (67, 70), (0, 70)], 'grass'))
v.room('N9c', 'Vistani Tent', [(29, 31), (37, 31), (41, 35), (41, 40), (37, 44), (29, 44), (25, 40), (25, 35)], 'dirt', page=pg('N9c'), ceilingFt=20)
v.room('N9c-hill', 'The Hilltop', [(33, 12), (50, 20), (56, 37), (50, 54), (33, 62), (16, 54), (10, 37), (16, 20)], 'grass', page=pg('N9'), ceilingFt=20)
v.room('N9a', "Kasimir's Hovel", rect(31, 56, 35, 63), 'plank', page=pg('N9a'), ceilingFt=8)
v.room('N9a-vestibule', 'Vestibule', rect(31, 54, 35, 56), 'plank', page=pg('N9a'), ceilingFt=8)
for i, (x, z) in enumerate([(6, 20), (6, 36), (6, 52), (60, 20), (60, 36), (60, 52)]):
    v.room(f'N9b-{"abcdef"[i]}', 'Dusk Elf Hovel', rect(x, z, x + 4, z + 5), 'plank', page=pg('N9b'), ceilingFt=8)
    v.door((x + 4 if x < 30 else x, z + 2), (x + 4 if x < 30 else x, z + 3), id=f'N9b-{"abcdef"[i]}-door')
v.door((31, 54), (31, 55), id='N9a-door'); v.opening((31, 56), (35, 56))
v.opening((25, 36), (25, 39)); v.opening((41, 36), (41, 39))
v.prop('N9c-pole', 'post-round', (33, 37.5), 'N9c', dims={'h': 20}); v.creature('N9c-arrigal', 'adventurer', (34, 38.5), 'N9c', 'Arrigal with the whip; six Vistani passed out; Luvash drunk')
v.creature('N9c-boy', 'commoner', (33, 37), 'N9c', 'A shirtless teenager bound to the tent pole, his back whipped')
for i, (x, z) in enumerate([(30, 34), (36, 34), (33, 42)]): v.prop(f'N9c-fire{i}', 'brazier', (x, z), 'N9c'); v.light(f'N9c-fire{i}', (x, z), 'torch', 15, 30, y=3)
v.note('N9c-note', (33, 33), 'N9c', 'Luvash and Arrigal; Arabelle missing seven days; the brothers each carry a key to one padlock of the treasure wagon.')
WAG = {'N9e': (33, 26, 0), 'N9f': (23, 33, 60), 'N9f2': (43, 33, -60), 'N9g': (23, 42, -60), 'N9g2': (43, 42, 60), 'N9h': (33, 49, 0), 'N9i': (26, 27, 30), 'N9d': (40, 48, -30)}
WNAME = {'N9e': "Luvash's Wagon", 'N9f': 'Wagon of Sleeping Vistani', 'N9g': 'Wagon of Gambling Vistani', 'N9h': 'Vistani Family Wagon', 'N9i': 'Vistani Treasure Wagon'}
for k, (x, z, r) in WAG.items():
    key = k.rstrip('2')
    if key != 'N9d': v.room(k if k == key else f'{key}-{"b" if k.endswith("2") else "a"}', WNAME[key], [(x - 2, z - 1.5), (x + 2, z - 1.5), (x + 2, z + 1.5), (x - 2, z + 1.5)], 'plank', page=pg(key), ceilingFt=8)
    v.prop(f'{k}-wagon', 'vardo', (x, z), key, rotY=r, dims={'v': len(k) + ord(k[-1])})
v.room('N9d', 'Horses', rect(36, 45, 43, 52), 'dirt', page=pg('N9d'), ceilingFt=20)
v.note('N9e-note', (33, 25), 'N9e', "Luvash's wagon: 'you are only alive because I let you be'."); v.note('N9f-note', (23, 32), 'N9f', 'Six Vistani asleep in each of these.'); v.note('N9g-note', (23, 43), 'N9g', 'Gambling Vistani: dice and knives.')
v.note('N9h-note', (33, 50), 'N9h', 'A family wagon: a mother, four children, the baby.'); v.note('N9i-note', (26, 26), 'N9i', 'The treasure wagon, two padlocks: 2,000 cp, 1,000 sp, 500 ep, 200 gp, 20 pp, jewellery, the winery\'s stolen gem? no, Arabelle\'s ribbon.')
for i, (x, z) in enumerate([(39, 46), (41, 50), (37, 50)]): v.creature(f'N9d-horse{i}', 'horse', (x, z), 'N9d', 'Vistani horses (riding horses, 12)', size='large')
for i, (x, z, r) in enumerate([(12, 18, 40), (54, 18, -40), (8, 37, 0), (58, 37, 0), (12, 56, -40), (54, 56, 40)]): v.prop(f'N9-ring-wagon{i}', 'vardo', (x, z), 'N9b', rotY=r, dims={'v': i})
# the camp's life: the great tent over the gathering, fires among the wagons, washing, the horses' pickets
v.prop('N9c-tent', 'big-tent', (33, 37.5), 'N9c', dims={'r': 36, 'h': 28})
# the hilltop is open ground, not a stockade
from authorlib import unit_edges as _ue, seg_key as _sk
for _a, _b in _ue([(33, 12), (50, 20), (56, 37), (50, 54), (33, 62), (16, 54), (10, 37), (16, 20)]): v.overrides[_sk(_a, _b)] = dict(v.overrides.get(_sk(_a, _b), {}), open_wall=True)
for i, (x, z) in enumerate([(28, 22), (18, 30), (48, 30), (28, 52), (44, 56)]): v.prop(f'N9-campfire{i}', 'campfire', (x, z), 'N9c-hill'); v.light(f'N9-campfire{i}', (x, z), 'torch', 15, 30, y=3)
v.prop('N9-wash-a', 'washline', (20, 47), 'N9c-hill', rotY=60, dims={'w': 16}); v.prop('N9-wash-b', 'washline', (46, 22), 'N9c-hill', rotY=-30, dims={'w': 14})
for i, x in enumerate([37, 39.5, 42]): v.prop(f'N9d-picket{i}', 'post-round', (x, 45.5), 'N9d', dims={'r': 0.3, 'h': 4})
# the dusk elves' hill homes: sod-roofed hovels dug into the foot of the hill, and Kasimir's with its painted vestibule
for i, (x, z) in enumerate([(6, 20), (6, 36), (6, 52), (60, 20), (60, 36), (60, 52)]): v.prop(f'N9b-roof{i}', 'roof-gable', (x + 2, z + 2.5), None, dims={'w': 22, 'd': 27, 'h': 7, 'y': 8, 'turf': 1})
v.prop('N9a-roof', 'roof-gable', (33, 58.5), None, dims={'w': 22, 'd': 47, 'h': 8, 'y': 8, 'turf': 1})
v.note('N9-ring', (10, 30), 'N9b', 'A ring of barrel-topped wagons round the hill; the camp is at the base of the hill, the tent above the fog on top.')
for i in range(14): v.prop(f'N9-pine{i}', 'pine', (3 + (i * 37) % 62, 2 + (i * 23) % 66 if i % 3 else 66), None)
v.prop('N9a-fire', 'fireplace', (34.6, 60), 'N9a', rotY=-90); v.prop('N9a-chair', 'chair', (32.5, 60), 'N9a'); v.prop('N9a-rug', 'rug', (33, 58), 'N9a', dims={'w': 6, 'd': 4}); v.prop('N9a-bed', 'bed', (32, 62), 'N9a')
v.creature('kasimir', 'adventurer', (33, 59), 'N9a', 'Kasimir Velikov, dusk elf wizard; dreams of Patrina and the Amber Temple'); v.creature('N9a-guards', 'adventurer', (33, 52.5), 'N9a-vestibule', 'Three grey-cloaked dusk elves before the door')
v.light('N9a-lantern', (33, 55), 'lantern', 15, 30, y=6); v.light('N9-moon', (33, 37), 'moonlight', 5, 10, y=30) if False else None
write('N9', 'Vistani Camp', 120, [v], [], {
    'N9c': ("A great tent lit from within, smoke pouring from its peak; three sputtering fires, Vistani sprawled drunk, a bound boy at the pole and a man with a whip.", "Arrigal whips the sentry who lost Arabelle; Luvash is drunk and dangerous."),
    'N9c-hill': ("A hill above the fog ringed by barrel-topped wagons.", None),
    'N9a': ("A hovel with a decorated vestibule and a snug room with a fire.", "Kasimir tells of the Amber Temple to anyone bent on destroying Strahd."),
    'N9a-vestibule': ("A painted vestibule; three cowled, angular figures stand before it.", "Dusk elf guards (scouts)."),
    'N9d': ("A dozen horses tethered below the hill.", None), 'N9e': ("Luvash's wagon.", "Luvash: 'you are only alive because I let you be'."), 'N9f': ("A wagon of sleeping Vistani.", None), 'N9f-b': ("A wagon of sleeping Vistani.", None),
    'N9g': ("Dice and knives: gambling Vistani.", None), 'N9g-b': ("Dice and knives: gambling Vistani.", None), 'N9h': ("A family wagon: a mother and children.", None), 'N9i': ("The treasure wagon, two padlocks.", "Coins, jewellery; the brothers hold the keys."),
    **{f'N9b-{"abcdef"[i]}': ("A simple house at the base of the hill; a grey-cloaked figure at its door.", "Dusk elves; they send visitors to Kasimir.") for i in range(6)},
}, stacked=False, entry='camp', ambient='night')

# ================================================================== N1 St. Andral's Church: the village church's plan, no undercroft
E5 = json.load(open(os.path.join(ROOT, 'locations', 'ch03', 'E5', 'scene.json')))['levels'][0]
ch = Level('ground', 'Church', 0, 14, ambient='interior-dim', interior='plaster', exterior='rubble', north='-z')
NAMES1 = {'E5f': ('N1f', 'Chapel'), 'E5a': ('N1a', 'Hall'), 'E5c': ('N1c', "Father Lucian's Room"), 'E5b': ('N1b', "Yeska's Room"), 'E5e': ('N1e', 'Office'), 'E5d': ('N1d', 'Vestry')}
for r in E5['rooms']:
    k, n = NAMES1[r['key']]; ch.room(k, n, [(x / 5, z / 5) for x, z in r['polygon']], r['floor'], page=pg('N1'))
for w in E5['walls']:
    a, b = (w['a'][0] / 5, w['a'][1] / 5), (w['b'][0] / 5, w['b'][1] / 5)
    if 'door' in w['flags']: ch.door(a, b, id='N1-' + w['id'], locked='locked' in w['flags'])
    elif 'window' in w['flags']: ch.window(a, b)
ch.terrain.append(([(-18, -4), (58, -4), (58, 50), (-18, 50)], 'grass'))
for o in E5['objects']:
    if o['kind'] in ('trapdoor', 'commoner'): continue
    ch.prop('N1-' + o['id'], o['kind'], (o['pos'][0] / 5, o['pos'][2] / 5), None if o['kind'] in ('pine', 'gravestone', 'fence') else next((k for k in NAMES1.values() if False), None), rotY=o.get('rotY', 0))
for l in E5['lights']: ch.light('N1-' + l['id'].split('-')[-1], (l['pos'][0] / 5, l['pos'][2] / 5), l['preset'], l['bright'], l['dim'], y=l['pos'][1])
for i, (x, z) in enumerate([(-9, 6), (-13, 10), (-7, 14), (-11, 18), (-9, 27), (-13, 33), (-7, 38), (-11, 42)]): ch.prop(f'N1-grave{i}', 'gravestone', (x, z), None, rotY=(i * 30) % 60 - 30)
for i, z in enumerate((2, 14, 26, 38)): ch.prop(f'N1-fence{i}', 'fence', (-15.5, z + 4), None, rotY=90, dims={'w': 12})
ch.hidden('N1-crypt', 'niche', (4.5, 0.7), 'N1f', 'A broken crypt under the altar: the bones of St. Andral were sealed here, and someone took them a few nights ago')
ch.note('N1-note', (4.5, 2.2), 'N1f', 'Father Lucian, Yeska and Milivoj; at night 2d6+6 frightened adults and 2d6 children. Milivoj stole the bones for the coffin maker.')
ch.creature('lucian', 'adventurer', (4.5, 3.5), 'N1f', 'Father Lucian Petrovich (priest)'); ch.creature('milivoj', 'commoner', (-10, 22), None, 'Milivoj with his shovel (commoner, Str 15, shovel 1d4+2)'); ch.creature('yeska', 'commoner', (2, 7.5), 'N1b', 'Yeska the altar boy (noncombatant)', size='small')
ch.prop('N1-steeple', 'temple', (4.5, -2), None, dims={'w': 10, 'd': 10, 'h': 30}) if False else None
write('N1', "St. Andral's Church", 97, [ch], [], {
    'N1f': ("A slouching stone chapel: cracked stained glass of saints, a bulging steeple at the back, an altar on a dais.", "The bones beneath the altar are gone. Lucian confides in a good cleric or paladin."),
    'N1a': ("A plain hall behind the chapel.", None), 'N1c': ("Father Lucian's room.", None), 'N1b': ("Yeska's room.", None), 'N1e': ("The office.", None), 'N1d': ("A vestry.", "No undercroft here, unlike the village church."),
}, stacked=False, entry='ground')

# ================================================================== N7 Blinsky Toys (no plan: a shop front with a workshop behind, a loft above)
b = Level('ground', 'Shop', 0, 10, ambient='interior-dim', interior='paneling', exterior='half-timber', north='-z')
b.room('N7a', 'Shop Floor', rect(1, 1, 9, 9), 'plank', page=pg('N7'), ceilingFt=10)
b.room('N7b', 'Workshop', rect(9, 1, 15, 9), 'plank', page=pg('N7'), ceilingFt=10)
b.room('N7c', 'Monkey\'s Corner', rect(1, 9, 5, 12), 'plank', page=pg('N7'), ceilingFt=10)
b.terrain.append(([(-3, -2), (18, -2), (18, 14), (-3, 14)], 'cobble'))
b.door((4, 1), (5, 1), id='N7-front', open=True); b.door((9, 4), (9, 5), id='N7a-b'); b.door((2, 9), (3, 9), id='N7c-door')
b.window((2, 1), (3, 1)); b.window((6, 1), (7, 1)); b.window((15, 4), (15, 5)); b.window((1, 5), (1, 6))
b.hidden('N7-sign', 'niche', (4.5, 0.4), 'N7a', "A sign over the door: 'Is No Fun, Is No Blinsky!'")
for i, (x, z, k) in enumerate([(1.5, 3, 'shelves'), (1.5, 6, 'shelves'), (8.5, 3, 'shelves'), (8.5, 7, 'shelves'), (5, 5, 'table')]): b.prop(f'N7a-{i}', k, (x, z), 'N7a', rotY=90 if x < 2 else -90 if x > 8 else 0, dims={'w': 4, 'd': 3} if k == 'table' else None)
b.prop('N7a-dollhouse', 'dollhouse', (5, 5), 'N7a', y=3); b.hidden('N7a-toys', 'niche', (5, 6), 'N7a', 'A headless doll with a sack of heads, a toy gallows, nesting dolls that end in a mummy, a bat mobile, a wolf merry-go-round, a Strahd dummy')
b.hidden('N7a-ireena', 'niche', (8, 2.5), 'N7a', "A doll remarkably like Ireena Kolyana: not for sale, made for Izek")
b.creature('blinsky', 'commoner', (6, 7.5), 'N7a', 'Gadof Blinsky, the toymaker: portly, cheerful, lonely'); b.creature('piccolo', 'wolf', (3, 10.5), 'N7c', 'Piccolo, the monkey in a tiny fez (use the cat stats)', size='tiny')
b.prop('N7b-bench', 'table', (12, 3), 'N7b', dims={'w': 8, 'd': 3}); b.prop('N7b-bench2', 'table', (12, 7), 'N7b', dims={'w': 8, 'd': 3}); b.prop('N7b-shelf', 'bookshelf', (14.6, 5), 'N7b', rotY=-90); b.prop('N7b-stove', 'stove', (9.6, 8.3), 'N7b', rotY=90)
b.note('N7b-note', (12, 5), 'N7b', "Blinsky's bench: he wants his clockwork 'myasterpiece' back from the wagon in the stockyard and will make any toy for it.")
b.light('N7a-lamp', (5, 5), 'lantern', 15, 30, y=7); b.light('N7b-lamp', (12, 5), 'lantern', 15, 30, y=7)
b.prop('N7-roof', 'roof-gable', (8, 5), None, dims={'w': 72, 'd': 42, 'h': 10})
write('N7', 'Blinsky Toys', 119, [b], [], {
    'N7a': ("A toyshop with two arched, lead-framed windows and shelves of unsettling toys; a sign promises no fun without Blinsky.", "Only Rictavio has bought anything in six months (a Vistana doll). The Ireena dolls are for Izek."),
    'N7b': ("A workbench strewn with limbs, heads and springs.", None), 'N7c': ("A corner for a small monkey in a fez.", "Piccolo, Rictavio's gift."),
}, stacked=False, entry='ground')

# ================================================================== N5 Arasek Stockyard (no plan: pens, sheds, a warehouse, the carnival wagon)
s = Level('yard', 'The stockyard', 0, 15, ambient='barovian-overcast', interior='log', exterior='log', north='-z')
s.terrain.append(([(-2, -2), (34, -2), (34, 30), (-2, 30)], 'dirt'))
s.room('N5a', 'Stockyard', rect(0, 0, 24, 24), 'dirt', page=pg('N5'), ceilingFt=15)
s.room('N5b', 'Warehouse', rect(24, 0, 32, 16), 'plank', page=pg('N5'), ceilingFt=15)
s.room('N5c', 'Sheds', rect(0, 24, 24, 28), 'plank', page=pg('N5'), ceilingFt=8)
s.room('N5d', "Rictavio's Carnival Wagon", rect(8, 17, 14, 22), 'plank', page=pg('N5'), ceilingFt=9)
s.door((11, 0), (13, 0), id='N5-gate', double=True, open=True); s.door((24, 6), (24, 8), id='N5b-doors', double=True, locked=True); s.door((24, 2), (24, 3), id='N5b-side')
for i in range(6): s.door((2 + i * 4, 24), (3 + i * 4, 24), id=f'N5c-shed{i}', locked=True); s.wall((4 + i * 4, 24), (4 + i * 4, 28))
s.door((11, 17), (11, 18), id='N5d-door', locked=True)
s.hidden('N5-sign', 'niche', (12, -0.6), 'N5a', 'A sign over the gate: Arasek Stockyard')
for i, (x, z) in enumerate([(3, 4), (3, 10), (3, 16)]): s.prop(f'N5a-pen{i}', 'fence', (6, z), 'N5a', dims={'w': 20}); s.prop(f'N5a-penb{i}', 'fence', (1, z + 3), 'N5a', rotY=90, dims={'w': 6})
for i, (x, z) in enumerate([(4, 6), (8, 12), (6, 18)]): s.creature(f'N5a-horse{i}', 'horse', (x, z), 'N5a', 'Stockyard horses', size='large')
s.prop('N5a-trough', 'trough', (14, 8), 'N5a'); s.prop('N5a-hay', 'hay', (18, 4), 'N5a'); s.prop('N5a-cart', 'wagon', (19, 14), 'N5a', rotY=20)
s.creature('gunther', 'commoner', (20, 8), 'N5a', 'Gunther and Yelena Arasek (commoners); goods at five times the price')
s.prop('N5d-wagon', 'wagon', (11, 19.5), 'N5d', dims={'s': 1.4}); s.hidden('N5d-blood', 'niche', (11, 22.4), 'N5d', "Dry blood spatters the sides; 'I bring you from Shadow into Light!' is carved over the door; a heavy padlock")
s.creature('tiger', 'bear', (11, 19.5), 'N5d', 'A saber-toothed tiger (84 hp) inside the wagon; it hates Vistani', size='large')
s.hidden('N5d-seat', 'chest', (11, 17.6), 'N5d', 'Secret compartment under the front seat (DC 15 Perception): a coffer of 50 ep and gems, a prayer book, a healer\'s kit, three silver holy symbols, a silvered shortsword, a hand crossbow and bolts, a case of stakes, garlic, salt, holy water, a mirror, a scroll tube with two spell scrolls; the torn-up Vistana doll')
s.note('N5d-note', (11, 23), 'N5d', 'The wagon lurches when approached. Rictavio feeds the tiger steaks; released, it hunts Vistani through the streets.')
for i in range(5): s.prop(f'N5b-crate{i}', 'trunk', (26 + (i % 2) * 2, 3 + i * 2.5), 'N5b');
for i in range(3): s.prop(f'N5b-cask{i}', 'wine-cask', (30, 4 + i * 1.3), 'N5b')
s.prop('N5b-sacks', 'sacks', (29, 13), 'N5b'); s.prop('N5b-roof', 'roof-gable', (28, 8), 'N5b', rotY=90, dims={'w': 40, 'd': 80, 'h': 12})
for i in range(6): s.prop(f'N5c-roof{i}', 'roof-gable', (2 + i * 4, 26), 'N5c', dims={'w': 20, 'd': 20, 'h': 5})
s.light('N5a-lantern', (12, 2), 'lantern', 15, 30, y=8)
write('N5', 'Arasek Stockyard', 115, [s], [], {
    'N5a': ("A big yard of pens and locked sheds beside a warehouse; a painted carnival wagon stands at the south end, its paint peeling.", "The Araseks watch Rictavio's wagon for gold, no questions."),
    'N5b': ("A roomy warehouse of crates and casks.", "Adventuring gear under 25 gp at five times the price."),
    'N5c': ("A row of locked sheds.", None),
    'N5d': ("A sturdy carnival wagon: 'Rictavio's Carnival of Wonders' in faded letters; something big throws itself against the inside.", "The tiger. The secret seat compartment holds Van Richten's kit."),
}, stacked=False, entry='yard', ambient='barovian-overcast')
