#!/usr/bin/env python3
"""A Wild Sheep Chase: the tavern (01-tavern) and the town square (02-street), hand-authored in cells (5 ft).
These are "possible" locations (the module has no map for them), designed to serve the scenes: a big common
room with a party table in the middle, the bar under a mezzanine, barrels in the wall, an innkeeper's office,
three inn rooms upstairs, stables in the yard; and a square for a town of fifty: the tavern, a temple, the town
hall, the well and the stables around a cobbled square, houses behind. Runs after import-mapset.py and overwrites
those two sites; the manifest's area lists are refreshed. x east, z south, north = -z."""
import json, os, sys
from collections import OrderedDict
sys.path.insert(0, os.path.dirname(__file__))
from authorlib import ROOT, C, rect, ft, Level

CAMP = 'wsc'
N = '-z'

# ================================================================== THE TAVERN (60 × 50 ft building, yard and stables east)
L0 = Level('L0', 'Ground floor', 0, 10, ambient='interior-dim', interior='paneling', exterior='plaster', north=N)
L0.room('T1', 'Common Room', [(1, 4), (9, 4), (9, 8), (12, 8), (12, 12), (1, 12)], 'plank')
L0.room('T2', 'Bar', rect(4, 1, 9, 4), 'plank')
L0.room('T3', "Innkeeper's Office", rect(1, 1, 4, 4), 'plank')
L0.room('T4', 'Kitchen', rect(9, 1, 12, 5), 'flagstone')
L0.room('T5', 'Storeroom', rect(9, 5, 12, 8), 'flagstone')
L0.room('T6', 'Stables', rect(14, 5, 17, 11), 'dirt')
L0.room('T7', 'Yard', [(12, 0), (18, 0), (18, 13), (12, 13), (12, 12), (14, 12), (14, 11), (17, 11), (17, 5), (14, 5), (14, 4), (12, 4)], 'dirt')
# exterior: the street apron south and grass beyond
L0.terrain.append((rect(-1, 12, 18, 14), 'cobble'))
L0.terrain.append((rect(-2, -1, 19, 15), 'grass'))
# openings between rooms
L0.door((5, 12), (7, 12), id='tavern-front', double=True)          # front double door, south, onto the square
L0.door((4, 2), (4, 3), id='office-door')                           # office <-> bar
L0.door((9, 2), (9, 3), id='kitchen-door')                          # bar <-> kitchen
L0.door((12, 2), (12, 3), id='back-door')                           # kitchen -> yard (alley)
L0.door((9, 6), (9, 7), id='store-door')                            # common room <-> storeroom
L0.counter((4, 4), (8, 4)); L0.opening((8, 4), (9, 4))              # the bar counter, with a flap at its east end
L0.opening((9, 4), (9, 5))                                          # serving hatch cell between bar and kitchen... kept as opening
L0.door((14, 8), (14, 9), id='stable-door')                         # stables: wide door to the yard
L0.opening((12, 4), (12, 5)); L0.opening((12, 11), (12, 12))        # yard is open ground: no walls where it meets the apron
L0.opening((12, 0), (18, 0)); L0.opening((18, 0), (18, 13)); L0.opening((12, 13), (18, 13)); L0.opening((12, 12), (14, 12))
L0.railing((14, 7), (17, 7)); L0.railing((14, 9), (17, 9))          # stall partitions
for a, b in [((2, 12), (3, 12)), ((9, 12), (10, 12)), ((1, 6), (1, 7)), ((1, 9), (1, 10)), ((1, 2), (1, 3)), ((6, 1), (7, 1)), ((12, 6), (12, 7))]:
    L0.window(a, b)
# common room: the party table in the middle, smaller tables, hearth, stairs
L0.prop('party-table', 'table-round', (5.5, 8), 'T1', dims={'r': 3.6})
for i in range(6):
    import math
    a = i / 6 * math.tau
    L0.prop(f'party-chair{i}', 'chair', (5.5 + math.cos(a) * 1.05, 8 + math.sin(a) * 1.05), 'T1', rotY=round(-math.degrees(a) + 90))
L0.prop('table-w', 'table', (2.4, 6), 'T1', dims={'w': 6, 'd': 3}); [L0.prop(f'chair-w{i}', 'chair', p, 'T1', rotY=r) for i, (p, r) in enumerate([((1.8, 5.35), 180), ((3, 5.35), 180), ((1.8, 6.65), 0), ((3, 6.65), 0)])]
L0.prop('table-s', 'table', (3, 10.6), 'T1', dims={'w': 6, 'd': 3}); [L0.prop(f'chair-s{i}', 'chair', p, 'T1', rotY=r) for i, (p, r) in enumerate([((2.4, 9.95), 180), ((3.6, 9.95), 180), ((2.4, 11.25), 0), ((3.6, 11.25), 0)])]
L0.prop('table-e', 'table', (8.5, 10.6), 'T1', dims={'w': 6, 'd': 3}); [L0.prop(f'chair-e{i}', 'chair', p, 'T1', rotY=r) for i, (p, r) in enumerate([((7.9, 9.95), 180), ((9.1, 9.95), 180), ((7.9, 11.25), 0), ((9.1, 11.25), 0)])]
L0.prop('bench-e', 'bench', (10.8, 9), 'T1', rotY=90, dims={'l': 8})
L0.prop('hearth', 'fireplace', (1.25, 8), 'T1', rotY=90); L0.prop('stag', 'stag-head', (1.4, 8), 'T1', rotY=90)
L0.prop('bar-top', 'bar-top', (6, 4), 'T1', dims={'w': 18, 'y': 3.5})
[L0.prop(f'stool{i}', 'chair', (4.6 + i * 0.9, 4.55), 'T1', rotY=180) for i in range(4)]
L0.prop('chandelier', 'chandelier', (5.5, 8), 'T1', dims={'y': 9, 'brass': 1})
[L0.prop(f'lamp{i}', 'oil-lamp', p, 'T1', dims={'y': 7}) for i, p in enumerate([(1.15, 5), (1.15, 11), (10.5, 8.2), (11.85, 11)])]
L0.prop('stairs', 'stairs-straight', (11.5, 0), 'T1', dims={'w': 5, 'rise': 10, 'fromZ': 60, 'toZ': 45})
# bar: barrels in the wall (a rack of big casks along the north wall), shelves of bottles, a spigot barrel
L0.prop('casks-ale', 'cask-rack', (5.2, 1.45), 'T2', dims={'n': 3}); L0.prop('casks-wine', 'cask-rack', (7.9, 1.45), 'T2', dims={'n': 2})
L0.prop('spigot', 'barrel-spigot', (8.6, 3.4), 'T2'); L0.prop('shelves-bar', 'shelves', (4.15, 2.6), 'T2', rotY=90, dims={'w': 4})
L0.prop('worktable-bar', 'table', (6.5, 2.7), 'T2', dims={'w': 5, 'd': 2})
# office
L0.prop('desk', 'desk', (2.4, 2.2), 'T3', rotY=180); L0.prop('desk-chair', 'chair', (2.4, 1.5), 'T3'); L0.prop('strongbox', 'trunk', (1.5, 3.5), 'T3', rotY=90); L0.prop('cabinet', 'cabinet', (3.6, 1.3), 'T3', rotY=180)
L0.prop('ledger-lamp', 'oil-lamp', (2, 2.2), 'T3', dims={'y': 3})
# kitchen and store
L0.prop('oven', 'oven', (10.2, 1.4), 'T4'); L0.prop('worktable', 'table', (10.6, 3.4), 'T4', rotY=90, dims={'w': 5, 'd': 2.5}); L0.prop('pots', 'hanging-pots', (10.6, 3.4), 'T4', rotY=90, dims={'w': 5}); L0.prop('shelves-k', 'shelves', (11.85, 1.6), 'T4', rotY=-90, dims={'w': 4, 'food': 1})
L0.prop('sacks', 'sacks', (9.7, 5.7), 'T5'); L0.prop('casks-store', 'cask-rack', (11, 7.5), 'T5', dims={'n': 2}); L0.prop('shelves-s', 'shelves', (11.85, 6), 'T5', rotY=-90, dims={'w': 4, 'food': 1})
# stables and yard
for i, z in enumerate([6, 8, 10]):
    L0.prop(f'trough{i}', 'trough', (16.6, z), 'T6', rotY=90); L0.prop(f'hay{i}', 'hay', (14.8, z + 0.5), 'T6')
    if i < 2: L0.obj(f'horse{i}', 'horse', (15.6, z), 'player', 'T6', 'Horse', rotY=90, size='large')
L0.prop('cart', 'wagon', (15.5, 2.2), 'T7', rotY=20); L0.prop('yard-well', 'well', (13.2, 9.6), 'T7'); L0.prop('woodpile', 'rubble', (12.6, 1.2), 'T7')
L0.light('hearth', (1.6, 8), 'hearth', 20, 40, y=3); L0.light('chandelier', (5.5, 8), 'lamp', 15, 30, y=9); L0.light('bar', (6, 2.5), 'lamp', 15, 30, y=7); L0.light('kitchen', (10.5, 2.5), 'lamp', 15, 30, y=7)
L0.obj('spawn', 'spawn', (5.5, 9.3), 'dm-note', 'T1', 'Party spawn: the party table')

L1 = Level('L1', 'Upper floor', 10, 8, ambient='interior-dim', interior='paneling', exterior='plaster', north=N)
L1.room('U1', 'Mezzanine', rect(4, 1, 9, 4), 'plank')
L1.room('U2', 'Gallery', rect(9, 1, 12, 8), 'plank')
L1.room('U3', 'Landing', [(4, 4), (5, 4), (5, 10), (4, 10)], 'plank')
L1.room('U4', 'Inn Room 1', rect(1, 1, 4, 4), 'plank')
L1.room('U5', 'Inn Room 2', rect(1, 4, 4, 7), 'plank')
L1.room('U6', 'Inn Room 3', rect(1, 7, 4, 10), 'plank')
L1.room('U7', 'Stair head', rect(11, 8, 12, 12), 'plank')
L1.opening((9, 1), (9, 4)); L1.opening((4, 4), (5, 4)); L1.opening((11, 8), (12, 8))
L1.railing((5, 4), (9, 4)); L1.railing((5, 4), (5, 10)); L1.railing((4, 10), (5, 10))       # the mezzanine and landing look down into the common room
L1.railing((9, 8), (11, 8)); L1.railing((11, 8), (11, 12))
L1.door((4, 2), (4, 3), id='inn1'); L1.door((4, 5), (4, 6), id='inn2'); L1.door((4, 8), (4, 9), id='inn3')
for a, b in [((1, 2), (1, 3)), ((1, 5), (1, 6)), ((1, 8), (1, 9)), ((6, 1), (7, 1)), ((12, 2), (12, 3)), ((12, 6), (12, 7))]:
    L1.window(a, b)
for i, (key, z) in enumerate([('U4', 1), ('U5', 4), ('U6', 7)]):
    L1.prop(f'bed{i}', 'bed-plain', (2, z + 1.4), key, rotY=90); L1.prop(f'night{i}', 'nightstand', (1.4, z + 2.4), key); L1.prop(f'chest{i}', 'trunk', (3.4, z + 2.6), key); L1.prop(f'chair{i}', 'chair', (3.4, z + 0.6), key, rotY=180)
    L1.prop(f'lamp-u{i}', 'oil-lamp', (3.85, z + 1.5), key, dims={'y': 5.5})
L1.prop('mezz-table', 'table', (6.5, 2.5), 'U1', dims={'w': 5, 'd': 3}); [L1.prop(f'mezz-chair{i}', 'chair', p, 'U1', rotY=r) for i, (p, r) in enumerate([((5.9, 1.9), 180), ((7.1, 1.9), 180), ((5.9, 3.1), 0), ((7.1, 3.1), 0)])]
L1.prop('gallery-bench', 'bench', (11.6, 5), 'U2', rotY=90, dims={'l': 8}); L1.prop('linen', 'shelves', (9.15, 6.5), 'U2', rotY=90, dims={'w': 3, 'linen': 1})
L1.prop('stair-top', 'stairs-straight', (11.5, 0), 'U7', dims={'w': 5, 'rise': 0.1, 'fromZ': 60, 'toZ': 45})
L1.light('mezz', (6.5, 2.5), 'lamp', 15, 30, y=6)
L1.prop('roof', 'roof-gable', (6.5, 6.5), None, dims={'w': 57, 'd': 57, 'h': 14, 'y': 8.2}); L1.prop('chimney', 'chimney', (1.6, 8), None, dims={'h': 9, 'y': 8})
L0.prop('sign', 'signpost', (5.4, 12.7), None)

tavern = OrderedDict(schema=1, location='01-tavern', chapter=CAMP, name='The Tavern', bookScaleFt=5, ambient='barovian-overcast', stacked=True)
tavern['levels'] = [L0.to_json(), L1.to_json()]
tavern['links'] = [OrderedDict(id='lk-stairs', kind='stairs', **{'from': {'level': 'L0', 'pos': [57.5, 57.5]}, 'to': {'level': 'L1', 'pos': [57.5, 42.5]}})]
for lv, notes in [(tavern['levels'][0], {
        'T1': ("A big common room: a round table for six under the chandelier, smaller tables by the walls, a hearth at the west end and the bar along the north side under the mezzanine.", "Baaaa-d News: the sheep bursts in through the front door with a scroll; the 'shepherds' follow. The stairs by the east wall go up to the gallery."),
        'T2': ("Behind the counter: big casks of ale and wine racked in the wall, a spigot barrel, shelves of bottles.", "The flap is at the east end of the counter. A door leads to the innkeeper's office, another to the kitchen."),
        'T3': ("The innkeeper's office: a desk and ledger, a cabinet, a strongbox.", "The strongbox holds the week's takings."),
        'T4': ("A kitchen with a domed oven, a worktable under hanging pots, and a back door to the yard.", None),
        'T5': ("A storeroom of sacks and casks.", None),
        'T6': ("Stables with three stalls, hay and troughs; two horses.", "A place to hide the sheep, or for the wolves to sniff it out."),
        'T7': ("The yard: a cart, a well, a woodpile.", None)}),
    (tavern['levels'][1], {
        'U1': ("A mezzanine over the bar with a table, railed above the common room.", "Line of sight down onto the whole common room."),
        'U2': ("A gallery along the east side, a bench and a linen press.", None),
        'U3': ("A railed landing above the common room, doors to the inn rooms.", None),
        'U4': ("An inn room: bed, nightstand, chest, chair.", None), 'U5': ("An inn room: bed, nightstand, chest, chair.", None), 'U6': ("An inn room: bed, nightstand, chest, chair.", None),
        'U7': ("The head of the stairs.", None)})]:
    for r in lv['rooms']:
        d = notes.get(r['key'])
        if d: r['desc'] = d[0]; r['dm'] = d[1] or ''
        if not r['dm']: del r['dm']
os.makedirs(os.path.join(ROOT, 'locations', CAMP, '01-tavern'), exist_ok=True)
json.dump(tavern, open(os.path.join(ROOT, 'locations', CAMP, '01-tavern', 'scene.json'), 'w'), indent=1)
json.dump(OrderedDict(schema=1, levels=OrderedDict((lv.id, OrderedDict(floorPolygons=[ft(p) for p in lv.floor_polys], type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0.55)) for lv in (L0, L1))), open(os.path.join(ROOT, 'locations', CAMP, '01-tavern', 'grid.json'), 'w'), indent=1)

# ================================================================== THE TOWN SQUARE (a town of fifty: ~12 houses)
S = Level('L0', 'The square', 0, 10, ambient='barovian-overcast', interior='plaster', exterior='plaster', north=N)
# The tavern's ground floor stands on the north side of the square, at the same footprint (offset +2 cells x, 0 z):
OX, OZ = 2, 0
S.room('S1', 'The Square', rect(4, 14, 26, 24), 'cobble')
S.room('S2', 'Main Street', [(0, 17), (4, 17), (4, 21), (0, 21)], 'cobble')
S.room('S3', 'East Lane', rect(26, 17, 34, 21), 'cobble')
S.room('S4', 'Temple Yard', rect(4, 24, 14, 30), 'grass')
S.room('S5', 'Tavern Yard', [(14 + OX, 0), (20 + OX, 0), (20 + OX, 13), (12 + OX, 13), (12 + OX, 12), (14 + OX, 12)], 'dirt')
S.room('S6', 'Stables', rect(14 + OX, 5, 17 + OX, 11), 'dirt')
S.terrain.append((rect(-2, -2, 36, 34), 'grass'))
for a, b in [((4, 17), (4, 21)), ((26, 17), (26, 21)), ((4, 24), (14, 24)), ((14 + OX, 12), (12 + OX, 13)), ((14 + OX, 12), (20 + OX, 12))]:
    S.opening(a, b)
S.opening((16, 0), (22, 0)); S.opening((22, 0), (22, 13)); S.opening((16, 13), (22, 13)); S.opening((14, 12), (16, 12)); S.opening((14, 4), (14, 5)); S.opening((14, 11), (14, 12))
S.railing((16, 7), (19, 7)); S.railing((16, 9), (19, 9)); S.door((16, 8), (16, 9), id='sq-stable-door')
# the tavern as a shell (its rooms are on the tavern map): walls of the ground floor footprint with the front door in the same place
S.wall((1 + OX, 1), (12 + OX, 1)); S.wall((1 + OX, 1), (1 + OX, 12)); S.wall((12 + OX, 1), (12 + OX, 12)); S.wall((1 + OX, 12), (5 + OX, 12)); S.wall((7 + OX, 12), (12 + OX, 12))
S.wall((5 + OX, 12), (7 + OX, 12), flags=['door'], id='sq-tavern-front')
S.obj('tavern-sign', 'signpost', (6 + OX, 12.6), 'player', 'S1', 'The tavern', dims={})
S.prop('tavern-facade', 'house', (6.5 + OX, 6.5), None, rotY=0, dims={'w': 55, 'd': 55, 'h': 10, 'stories': 2}); S.prop('tavern-chimney', 'chimney', (1.6 + OX, 8), None, dims={'h': 9, 'y': 20})
# well in the middle of the square; temple south; town hall east; houses around
S.prop('well', 'well', (15, 19), 'S1')
S.prop('temple', 'temple', (9, 27.2), 'S4', dims={'w': 30, 'd': 45, 'h': 14})
S.prop('hall', 'house', (30, 14), 'S3', dims={'w': 35, 'd': 25, 'h': 12, 'stories': 2}); S.obj('hall-sign', 'signpost', (30, 17.2), 'player', 'S3', 'Town hall')
S.prop('trough-sq', 'trough', (13, 20.5), 'S1'); S.prop('notice', 'signpost', (5.5, 22.5), 'S1')
[S.prop(f'bench{i}', 'bench', p, 'S1', rotY=r, dims={'l': 6}) for i, (p, r) in enumerate([((17.5, 21), 0), ((12.5, 17), 0)])]
houses = [((2, 6), 25, 20, 0), ((2, 12), 20, 20, 0), ((30, 6), 25, 25, 0), ((30, 24), 20, 25, 0), ((30, 30), 25, 20, 0), ((20, 27), 25, 20, 0), ((26, 28), 20, 20, 12), ((2, 26), 20, 20, 0), ((8, 3), 20, 20, 0), ((9, 9), 20, 22, 0), ((24, 2), 20, 20, 0), ((25, 9), 20, 20, 0)]
for i, ((cx, cz), w, d, r) in enumerate(houses):
    S.prop(f'house{i}', 'house', (cx, cz), None, rotY=r, dims={'w': w, 'd': d, 'h': 11 if i % 3 else 13, 'stories': 1 if i % 3 else 2})
for i, (cx, cz) in enumerate([(1, 1), (34, 1), (34, 33), (1, 33), (18, 33), (8, 33)]):
    S.prop(f'tree{i}', 'oak', (cx, cz), None, dims={'r': 1.1, 'h': 22, 'canopy': 8})
for i, z in enumerate([6, 8, 10]):
    S.prop(f'sq-trough{i}', 'trough', (18.6, z), 'S6', rotY=90); S.prop(f'sq-hay{i}', 'hay', (16.8, z + 0.5), 'S6')
    if i < 2: S.obj(f'sq-horse{i}', 'horse', (17.6, z), 'player', 'S6', 'Horse', rotY=90, size='large')
S.prop('sq-cart', 'wagon', (17.5, 2.2), 'S5', rotY=20); S.prop('sq-yard-well', 'well', (15.2, 9.6), 'S5')
S.obj('sheep-1', 'sheep', (14.4, 18.2), 'hidden-creature', 'S1', 'Finethir Shinebright (polymorphed sheep)', size='small', dims={'scroll': 1})
S.obj('guz', 'commoner', (8, 19), 'hidden-creature', 'S2', 'Guz (half-orc mercenary)'); [S.obj(f'wolf{i}', 'wolf', p, 'hidden-creature', 'S2', f'Collared wolf {i + 1} (polymorphed henchman)') for i, p in enumerate([(6.5, 18), (6.5, 20), (5, 19)])]
S.obj('bear', 'bear', (3, 19), 'hidden-creature', 'S2', 'Brown bear (polymorphed henchman)', size='large')
S.obj('spawn', 'spawn', (8 + OX, 13.5), 'dm-note', 'S1', 'Party spawn: outside the tavern door')
S.note('pop', (15, 15), 'S1', 'A town of about fifty: the tavern, the temple, the town hall, a dozen houses. The well is the meeting place.')
square = OrderedDict(schema=1, location='02-street', chapter=CAMP, name='The Town Square', bookScaleFt=5, ambient='barovian-overcast')
square['levels'] = [S.to_json()]
square['links'] = []
for r in square['levels'][0]['rooms']:
    r['desc'], r['dm'] = {
        'S1': ("A cobbled square around a stone well: the tavern on the north side, the temple to the south, the town hall to the east, houses all round.", "Shepherds, Crooks: Guz comes up the main street from the west with three collared wolves and a brown bear. The tavern's front door is where the sheep bolted in."),
        'S2': ("The main street, leaving town to the west.", None), 'S3': ("The lane east, past the town hall.", None),
        'S4': ("The temple's grassy yard.", None), 'S5': ("The tavern's yard and stables.", None), 'S6': ("Three stalls, hay, troughs; two horses.", None)}[r['key']]
    if not r['dm']: del r['dm']
os.makedirs(os.path.join(ROOT, 'locations', CAMP, '02-street'), exist_ok=True)
json.dump(square, open(os.path.join(ROOT, 'locations', CAMP, '02-street', 'scene.json'), 'w'), indent=1)
json.dump(OrderedDict(schema=1, levels=OrderedDict(L0=OrderedDict(floorPolygons=[ft(p) for p in S.floor_polys], type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0.55))), open(os.path.join(ROOT, 'locations', CAMP, '02-street', 'grid.json'), 'w'), indent=1)

# refresh the manifest's area lists for these two sites
mp = os.path.join(ROOT, 'manifests', f'{CAMP}-locations.json')
man = json.load(open(mp), object_pairs_hook=OrderedDict)
for loc in man['locations']:
    sc = {'01-tavern': tavern, '02-street': square}.get(loc['id'])
    if sc:
        loc['name'] = sc['name']; loc['areas'] = [OrderedDict(key=r['key'], name=r['name']) for lv in sc['levels'] for r in lv['rooms']]
json.dump(man, open(mp, 'w'), indent=1)
print('tavern', [len(l['rooms']) for l in tavern['levels']], 'rooms;', 'square', len(square['levels'][0]['rooms']), 'rooms', len(square['levels'][0]['objects']), 'objects')
