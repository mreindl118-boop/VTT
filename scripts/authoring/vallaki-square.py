#!/usr/bin/env python3
"""Vallaki's town square (N8) as its own map, a blowout of the town: the cobbled plaza with the festival stage,
the pillory and stocks, the dry well and the braziers; and the shops that face it, each with its interior:
the smithy and armourer (N8a) on the north side, the jeweller (N8b) round the corner up the east lane, the
alchemist's little potion shop (N8c) on the west side, the general store (N8d) on the south. The square and the
stocks are the module's; the shops are the DM's own additions, in our own words. -> locations/ch05/N8"""
import json, os, sys
from collections import OrderedDict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from authorlib import ROOT, Level, rect, unit_edges  # noqa: F401

_M = json.load(open(os.path.join(ROOT, 'manifests', 'locations.json')))
PAGE = {a['key']: a['page'] for l in _M['locations'] if l['chapter'] == 'ch05' for a in l['areas']}
pg = lambda k: PAGE.get(k)
PLAZA = rect(8, 8, 38, 30)          # 150 × 110 ft of cobbles
g = Level('square', 'The square', 0, 12, ambient='barovian-overcast', interior='plaster', exterior='half-timber', north='-z')
g.terrain.append((rect(0, 0, 46, 38), 'grass'))
g.terrain.append((PLAZA, 'cobble'))
g.terrain.append((rect(38, 8, 46, 12), 'dirt'))      # the east lane round the corner
g.terrain.append((rect(0, 17, 8, 21), 'dirt'))        # the west street in
g.terrain.append((rect(21, 30, 25, 38), 'dirt'))      # the south street out
g.room('N8', 'Town Square', PLAZA, 'cobble', page=pg('N8'))
for a, b in unit_edges(PLAZA): g.opening(a, b)         # the plaza is open on every side
# the stage, the stocks, the well, the braziers at the corners
g.prop('stage', 'dais', (23, 13), 'N8', dims={'w': 20, 'h': 4, 'steps': 3})
g.prop('pillory', 'pillory', (29, 21), 'N8', rotY=20); g.prop('pillory-b', 'pillory', (31, 21), 'N8', rotY=-15)
g.prop('well', 'well', (22, 22), 'N8')
for i, (x, z) in enumerate([(10, 10), (36, 10), (10, 28), (36, 28)]): g.prop(f'brazier{i}', 'brazier', (x, z), 'N8'); g.light(f'brazier{i}', (x, z), 'torch', 10, 20, y=5)
g.prop('notice', 'signpost', (14, 26), 'N8'); g.prop('trough', 'trough', (34, 25), 'N8'); g.prop('cart', 'wagon', (12, 14), 'N8', rotY=70)
g.note('N8-stage', (23, 11), 'N8', 'The festival stage: the Baron harangues the town from here on festival days; the stocks beside it hold whoever grumbled.')
g.note('N8-stocks', (30, 23), 'N8', "Two sets of stocks. A malcontent locked in one, the guards nearby; freeing anyone is a crime in Vallaki.")
g.creature('guard-a', 'commoner', (28, 24), 'N8', "Town guard (Izek's man)"); g.creature('guard-b', 'commoner', (32, 24), 'N8', 'Town guard'); g.creature('stocks-man', 'commoner', (30, 20.5), 'N8', 'Udo Lukovich, locked in the stocks for a bad word about the festival')

# ---------------------------------------------------------------- the shops round the square
def shop(key, name, poly, door, windows, furnish, keeper=None, desc=None):
    g.room(key, name, poly, 'plank', page=pg(key), ceilingFt=10)
    g.door(*door, id=f'{key}-door')
    for a, b in windows: g.window(a, b)
    furnish()
    if keeper: g.creature(f'{key}-keeper', 'commoner', keeper[0], key, keeper[1])
    if desc: g.note(f'{key}-note', keeper[0] if keeper else poly[0], key, desc)
# N8a the smithy and armourer: forge, anvil, the quench trough, racks of arms and a suit on its stand
shop('N8a', 'Smithy and Armourer', rect(16, 1, 26, 7), ((20, 7), (21, 7)), [((16, 3), (16, 4)), ((26, 3), (26, 4))],
     lambda: [g.prop('N8a-forge', 'stove', (18, 2), 'N8a'), g.prop('N8a-anvil', 'anvil', (20, 3.5), 'N8a', rotY=90), g.prop('N8a-quench', 'trough', (22, 2), 'N8a'),
              g.prop('N8a-suit', 'armor-suit', (25, 2), 'N8a'), g.prop('N8a-suit-b', 'armor-suit', (25, 5), 'N8a'), g.prop('N8a-counter', 'bar-top', (22, 6), 'N8a', dims={'w': 6}), g.prop('N8a-racks', 'shelves', (17, 6), 'N8a', rotY=180),
              g.light('N8a-forge', (18, 2), 'torch', 10, 20, y=4)],
     keeper=((23, 4), 'Dimitri the smith, arms and mail to order; he will not shoe a Vistani horse'), desc='The forge glows all day. Spears and a few swords on the racks, a mail shirt on the stand, prices steep for strangers.')
# N8b the jeweller, round the corner up the east lane: a locked door, barred windows, cases and a strongbox
shop('N8b', "Jeweller's", rect(39, 1, 45, 7), ((39, 4), (39, 5)), [((42, 1), (43, 1))],
     lambda: [g.prop('N8b-case', 'cabinet', (41, 2), 'N8b'), g.prop('N8b-case-b', 'cabinet', (44, 2), 'N8b'), g.prop('N8b-counter', 'bar-top', (42, 4.5), 'N8b', rotY=90, dims={'w': 4}), g.prop('N8b-desk', 'desk', (43.5, 6), 'N8b', rotY=180), g.prop('N8b-chair', 'chair', (43.5, 5), 'N8b'),
              g.hidden('N8b-strongbox', 'chest', (40, 6.3), 'N8b', 'An iron strongbox under the desk: the good pieces and the week\'s coin'), g.prop('N8b-lamp', 'oil-lamp', (42, 4), 'N8b', y=6), g.light('N8b-lamp', (42, 4), 'lantern', 10, 20, y=6)],
     keeper=((41, 5), 'Mila Dragomir, jeweller, who buys gems quietly and asks nothing'), desc='Rings and brooches under glass, most of them Vallakian wedding silver; the real stones are in the strongbox.')
# N8c the alchemist's potion shop on the west side: shelves of bottles, a worktable, a cabinet of the dangerous things
shop('N8c', "Alchemist's", rect(2, 11, 8, 16), ((8, 13), (8, 14)), [((2, 13), (2, 14))],
     lambda: [g.prop('N8c-shelves', 'shelves', (3, 12), 'N8c', rotY=90), g.prop('N8c-shelves-b', 'shelves', (3, 15), 'N8c', rotY=90), g.prop('N8c-table', 'table', (5.5, 12.5), 'N8c', dims={'w': 4, 'd': 3}), g.prop('N8c-counter', 'bar-top', (6.5, 15), 'N8c', dims={'w': 3}),
              g.prop('N8c-cabinet', 'cabinet', (4, 15.5), 'N8c', rotY=180), g.hidden('N8c-poisons', 'niche', (4, 15.5), 'N8c', 'The locked cabinet: two potions of healing, a vial of basic poison, and the sleeping draught the Baron buys'), g.light('N8c-lamp', (5, 13.5), 'candle', 5, 10, y=6)],
     keeper=((6, 13.5), 'Old Varushka, who sells remedies and reads the customer as closely as the coin'), desc='A small dim shop smelling of vinegar and herbs. Healing potions at a price, if she likes the look of you.')
# N8d the general store on the south side: dry goods, rope, lanterns, sacks and barrels
shop('N8d', 'General Store', rect(26, 31, 36, 37), ((30, 31), (31, 31)), [((26, 33), (26, 34)), ((36, 33), (36, 34))],
     lambda: [g.prop('N8d-shelves', 'shelves', (27, 33), 'N8d', rotY=90), g.prop('N8d-shelves-b', 'shelves', (27, 36), 'N8d', rotY=90), g.prop('N8d-shelves-c', 'shelves', (35, 34), 'N8d', rotY=-90), g.prop('N8d-counter', 'bar-top', (31, 33), 'N8d', dims={'w': 8}),
              g.prop('N8d-crates', 'crate-chest', (29, 36), 'N8d'), g.prop('N8d-crates-b', 'crate-chest', (31, 36), 'N8d'), g.prop('N8d-casks', 'cask-rack', (34, 36), 'N8d'), g.prop('N8d-hay', 'hay', (33, 32.5), 'N8d'), g.light('N8d-lamp', (31, 34), 'lantern', 10, 20, y=6)],
     keeper=((31, 34.5), 'Nadia the storekeeper, who keeps honest prices and her opinions of the Baron to herself'), desc='Rope, lanterns, oil, rations, blankets, a few tools: the adventuring staples at honest Vallaki prices.')
# the roofs over the shops
for key, (cx, cz, w, d, rot) in {'N8a': (21, 4, 50, 30, 0), 'N8b': (42, 4, 30, 30, 0), 'N8c': (5, 13.5, 30, 25, 0), 'N8d': (31, 34, 50, 30, 0)}.items():
    g.prop(f'{key}-roof', 'roof-gable', (cx, cz), None, rotY=rot, dims={'w': w, 'd': d, 'h': 9, 'y': 10})

DESC = {
  'N8': ('The town square of Vallaki: the stage for the Festival of the Blazing Sun, the stocks, the dry well, the shops along its sides.', "Izek Strazni's guards keep an eye on the square; anyone who mutters about the festival ends in the stocks."),
  'N8a': ('Smithy and armourer on the north side of the square.', 'Dimitri. Arms and mail to order, slowly; he reports strangers who buy weapons to the Baron.'),
  'N8b': ("The jeweller's, round the corner up the east lane.", 'Mila buys gems without questions. The strongbox is her nest egg; she is no fool.'),
  'N8c': ("The alchemist's potion shop on the west side.", 'Varushka. Two potions of healing (50 gp each), basic poison, the sleeping draught the Baron buys for his own nights.'),
  'N8d': ('The general store on the south side.', 'Nadia sells the staples; the Baron taxes her hard and she likes him not at all.'),
}
scene = OrderedDict(schema=1, location='N8', chapter='ch05', name='Town Square', mapPage=119, bookScaleFt=5, ambient='barovian-overcast', parent='ch05/N', kind='placement', levels=[g.to_json()], links=[])
for r in scene['levels'][0]['rooms']:
    d = DESC.get(r['key'])
    if d: r['desc'] = d[0]; r['dm'] = d[1]
grid = OrderedDict(schema=1, levels=OrderedDict(square=OrderedDict(floorPolygons=[[[x * 5, z * 5] for x, z in p] for p in g.floor_polys] + [[[x * 5, z * 5] for x, z in p] for p, _ in g.terrain], type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0.55)))
out = os.path.join(ROOT, 'locations', 'ch05', 'N8'); os.makedirs(out, exist_ok=True)
json.dump(scene, open(os.path.join(out, 'scene.json'), 'w'), indent=1)
json.dump(grid, open(os.path.join(out, 'grid.json'), 'w'), indent=1)
print('N8 square:', len(g.rooms), 'rooms', len(g.objects), 'objects')
