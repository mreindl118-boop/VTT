#!/usr/bin/env python3
"""Baba Lysaga's Creeping Hut (chapter 10, area U3; map p.163, one square = 5 ft) -> locations/ch10/U3/{scene,grid}.json

The book's plan is eleven squares on a side: the hut, fifteen feet square (three squares, its walls on the grid
lines four and seven squares in from the north-west corner), sits on the stump of a giant tree whose eight roots
claw out across the mire; an open doorway in the middle of the east wall, a little landing under it, and the
hollow giant's skull floating beyond. Two levels: the mire (the roots, the stump, the skull, the raven cages under
the eaves) and the hut's floor ten feet up on the stump, an 8-ft room under a gently sloping thatch roof
(appendix D). The furniture is placed as the plan shows it. Grid and placements read off a 400-dpi render; the
art and the wording are ours. The hut is a blowout of the Berez map (`parent`)."""
import json, math, os, sys
from collections import OrderedDict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from authorlib import ROOT, Level, rect, unit_edges, seg_key  # noqa: F401

_M = json.load(open(os.path.join(ROOT, 'manifests', 'locations.json')))
PAGE = {a['key']: a['page'] for l in _M['locations'] if l['id'] == 'U3' for a in l['areas']}
N = 11                       # the plan, squares on a side
HX0, HZ0, HX1, HZ1 = 4, 4, 7, 7
HC = (5.5, 5.5)
FLOOR = 10                   # the hut's floor stands on the stump

def open_room(lv, poly):
    """An outdoor area: no walls round it."""
    for a, b in unit_edges(poly): lv.overrides[seg_key(a, b)] = dict(lv.overrides.get(seg_key(a, b), {}), open_wall=True)

def tag(lv, oid, **kw):
    for o in lv.objects:
        if o['id'] == f'{lv.id}-{oid}':
            for k, v in kw.items():
                if v is not None: o[k] = v
            return o
    raise KeyError(oid)

# ---------------------------------------------------------------- the mire round the stump
m = Level('mire', 'The mire (U3)', 0, 13, ambient='fog', interior='log', exterior='log', north='-z')
m.terrain.append((rect(0, 0, N, N), 'marsh'))
for poly in ([(0.3, 2.2), (1.6, 1.8), (2.2, 2.9), (1.4, 3.6), (0.4, 3.3)], [(8.4, 7.4), (9.8, 7.1), (10.6, 8.2), (9.9, 9.1), (8.6, 8.7)],
             [(2.6, 9.6), (3.9, 9.3), (4.5, 10.4), (3.2, 10.8), (2.4, 10.3)], [(9.2, 3.2), (10.5, 3.0), (10.8, 4.1), (9.7, 4.4)], [(6.6, 0.4), (8.0, 0.3), (8.3, 1.2), (7.0, 1.5)]):
    m.terrain.append((poly, 'shallow-water'))
m.room('U3-mire', "Baba Lysaga's Hut: the mire round the stump", rect(0, 0, N, N), 'marsh', page=PAGE.get('U3'), ceilingFt=13)
open_room(m, rect(0, 0, N, N))
m.prop('stump', 'hut-stump', HC, 'U3-mire', dims={'r': 9, 'h': FLOOR})
# the eight roots, from the stump's shoulder out to where each claws into the mire (tips read off the plan)
ROOTS = [((5.7, 4.0), (5.94, 1.08)), ((4.6, 4.0), (2.66, 1.57)), ((7.0, 4.0), (9.2, 1.67)), ((4.0, 4.9), (0.9, 4.13)),
         ((4.0, 6.0), (0.97, 6.15)), ((4.2, 7.0), (1.97, 9.15)), ((5.6, 7.0), (5.15, 9.84)), ((7.0, 7.0), (9.2, 9.55))]
for i, ((bx, bz), (tx, tz)) in enumerate(ROOTS):
    dx, dz = tx - bx, tz - bz
    # each root leaves the stump a little inside the hut's edge, high on the stump
    sx, sz = bx - (bx - HC[0]) * 0.25, bz - (bz - HC[1]) * 0.25
    L = math.hypot(tx - sx, tz - sz) * 5
    m.prop(f'root{i}', 'giant-root', (sx, sz), 'U3-mire', rotY=round(math.degrees(math.atan2(-(tz - sz), tx - sx)), 1), dims={'len': round(L, 1), 'rise': FLOOR - 1.5, 'r': 1.7 if i % 3 else 2.0, 'seed': i, 'band': 1 if i == 2 else 0})
m.prop('skull', 'giant-skull', (8.3, 5.5), 'U3-mire', rotY=0, dims={'y': 6.2})
m.note('skull-note', (8.3, 6.4), 'U3-mire', "Hill giant's skull: hovers until Baba Lysaga, inside it, bids it fly (40 ft); holds one Medium creature, three-quarters cover; AC 15, 50 hp, immune to poison and psychic.")
m.note('climb', (7.9, 4.6), 'U3-mire', 'No stair: climb a root or the stump (Athletics) to the doorway, ten feet up, or step across from the floating skull.')
for i, (x, z, s) in enumerate([(1.0, 0.8, 1.2), (3.2, 0.5, 1), (8.8, 0.9, 1.3), (10.2, 2.2, 1.1), (0.6, 7.6, 1.2), (1.6, 10.2, 1), (6.6, 10.4, 1.3), (8.2, 10.1, 1),
                               (10.4, 6.2, 1.2), (10.1, 5.0, 0.9), (2.2, 6.9, 0.9), (2.9, 3.4, 1), (7.9, 2.6, 1.1), (3.4, 8.2, 0.8), (8.9, 8.0, 1), (0.5, 5.1, 0.9)]):
    m.prop(f'reeds{i}', 'marsh-reeds', (x, z), None, rotY=i * 53, dims={'s': s})
for i, (x, z) in enumerate([(2.0, 2.3), (9.6, 8.3), (3.6, 10.0)]): m.prop(f'bush{i}', 'thorn-thicket', (x, z), None, rotY=i * 70, dims={'s': 1.1})

# ---------------------------------------------------------------- the hut, ten feet up on the stump
h = Level('hut', "Baba Lysaga's hut (U3)", FLOOR, 8, ambient='darkness', interior='log', exterior='log', north='-z')
h.room('U3', "Baba Lysaga's Hut (interior)", rect(HX0, HZ0, HX1, HZ1), 'plank', page=PAGE.get('U3'), ceilingFt=8)
h.opening((HX1, 5), (HX1, 6))    # the open doorway in the middle of the east wall
h.prop('landing', 'plank-landing', (HX1 + 0.22, 5.5), 'U3', rotY=0, dims={'w': 6.5, 'd': 2.2})
h.prop('roof', 'hut-thatch-roof', HC, 'U3', dims={'w': 16, 'd': 16, 'y': 8, 'rise': 3.5})
for i, z in enumerate((4.62, 6.38)):
    h.prop(f'cage{i}', 'raven-cage', (HX1 + 0.42, z), 'U3', dims={'drop': 2.6, 'y': 8})
    h.creature(f'ravens{i}', 'hut-raven-swarm', (HX1 + 0.42, z), 'U3', 'Swarm of ravens in an iron cage (arcane lock: knock, DC 20 Strength or DC 20 thieves\' tools); attacks Baba Lysaga and her scarecrows if freed')
    tag(h, f'ravens{i}', playerLabel='Caged ravens', pos=[round((HX1 + 0.42) * 5, 2), 3.2, round(z * 5, 2)])
# the furniture as the plan shows it, all bolted down (the hut lurches when it walks)
h.prop('cot', 'cot', (4.45, 4.75), 'U3', rotY=90)
h.prop('table', 'table', (5.3, 4.42), 'U3', rotY=0, dims={'w': 4.4, 'd': 2.2, 'h': 2.5})
h.prop('stool', 'stool', (4.95, 4.95), 'U3', rotY=30)
h.prop('cabinet', 'cabinet', (6.55, 4.42), 'U3', rotY=-160)
h.prop('chest', 'chest', (4.42, 5.75), 'U3', rotY=90)
h.prop('crib', 'ghastly-crib', (5.45, 5.5), 'U3', rotY=0)
h.prop('tub', 'blood-tub', (4.85, 6.48), 'U3', rotY=0)
h.prop('wardrobe', 'wardrobe', (6.45, 6.42), 'U3', rotY=-148)
h.prop('stool2', 'stool', (6.05, 6.0), 'U3', rotY=10)
h.prop('candle', 'candlestick', (5.0, 4.42), 'U3', dims={'h': 0.9}, y=2.5)
h.light('candle', (5.0, 4.42), 'candle', 5, 10, y=3.6)
h.light('gem', (5.45, 5.5), 'candle', 0, 5, y=0.4)
h.hidden('gem', 'trapdoor', (5.45, 5.5), 'U3', 'Under the crib: a 3-ft cavity holding the green-glowing gem that animates the hut (floor: DC 14 Strength or 10 damage; the cavity bites, DC 20 Dexterity, 3d6). Without it the hut is incapacitated.')
h.hidden('glyph', 'niche', (4.42, 5.75), 'U3', 'Glyph of warding on the chest (DC 17 Investigation): 5d8 thunder. Inside, four crawling claws and the hag\'s plunder.')
h.creature('claws', 'crawling-claw', (4.42, 5.5), 'U3', 'Four crawling claws in the chest, released when it opens', size='tiny')
h.creature('lysaga', 'baba-lysaga', (4.85, 6.2), 'U3', 'Baba Lysaga, bathing in blood or at her work (she cannot hear over the ravens)')
h.note('child', (5.45, 5.2), 'U3', 'The child in the crib, whom she calls "Strahd", and the crib itself are a programmed illusion.')
tag(h, 'gem', playerLabel='Green light between the boards')
tag(h, 'glyph', playerLabel='A brass-bound chest', vis='trap')
tag(h, 'claws', playerLabel='Crawling hands')
tag(h, 'lysaga', playerLabel='An ancient crone')
tag(h, 'chest', container=OrderedDict(contents="1,300 gp, five 500-gp gemstones, a vial of oil of sharpness, spell scrolls of mass cure wounds and revivify, a pouch of ten +1 sling bullets, a set of pipes of haunting and a stone of good luck.", reveals=['hut-claws']),
    desc='A barrel-topped wooden chest bound in brass, bolted to the floor.', dm='Glyph of warding (5d8 thunder); four crawling claws inside. A card-reading treasure here would be in it too.')
tag(h, 'cabinet', container=OrderedDict(contents='Jars and pouches of spell components: dried things, powders, bones and herbs.'), desc='A wicker cabinet, bolted down.')
tag(h, 'wardrobe', container=OrderedDict(contents='Soiled robes, stiff with old blood.'), desc='A slender wardrobe, leaning, bolted to the floor.')
tag(h, 'tub', desc='An iron tub crusted dark with blood.', dm='Where Baba Lysaga bathes in beasts\' blood to stave off old age (new moon).')
tag(h, 'crib', desc='A ghastly wooden crib; an angelic little child sits in it, quite still.', dm='Programmed illusion. The gem\'s green light seeps up between the boards beneath it.')

DESC = {
  'U3-mire': ("Spongy mire round the rotting stump of a giant tree; the hut squats on top, its roots thrust out of the mud like a spider's legs. A hollowed giant's skull floats upside down under the doorway, and two cages of squawking ravens hang from the eaves.",
              "The ravens' racket hides any approach; only the howling skulls (U2) or nearby combat carry over it. If the party overstays, Baba Lysaga wakes the hut: the roots tear free and it walks (creeping hut, CR 11)."),
  'U3': ('A cramped, reeking room fifteen feet square, crammed with old furniture: a cot, a wicker cabinet, a slender wardrobe, a table and stool, a brass-bound chest, an iron tub stained with blood, and in the middle a ghastly crib with a small angelic child sitting in it. Green light seeps up through the floorboards.',
         'All bolted down except the crib. Crib and child are an illusion; the gem lies in a cavity under the boards. Robes in the wardrobe, spell components in the cabinet, treasure in the trapped chest.'),
}
levels = [m, h]
lk = lambda id, kind, al, ap, bl, bp: OrderedDict(id=id, kind=kind, **{'from': OrderedDict(level=al, pos=[ap[0] * 5, ap[1] * 5]), 'to': OrderedDict(level=bl, pos=[bp[0] * 5, bp[1] * 5])})
links = [lk('U3-climb', 'ladder', 'mire', (7.6, 5.5), 'hut', (6.5, 5.5))]
scene = OrderedDict(schema=1, location='U3', chapter='ch10', name="Baba Lysaga's Creeping Hut", mapPage=163, bookScaleFt=5, ambient='fog', parent='ch10/U', stacked=True, entry='mire',
                    levels=[lv.to_json() for lv in levels], links=links)
for lv in scene['levels']:
    for r in lv['rooms']:
        d = DESC.get(r['key'])
        if d: r['desc'], r['dm'] = d
grid = OrderedDict(schema=1, levels=OrderedDict((lv.id, OrderedDict(floorPolygons=[[[x * 5, z * 5] for x, z in p] for p in lv.floor_polys], type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0.55)) for lv in levels))
out = os.path.join(ROOT, 'locations', 'ch10', 'U3'); os.makedirs(out, exist_ok=True)
json.dump(scene, open(os.path.join(out, 'scene.json'), 'w'), indent=1)
json.dump(grid, open(os.path.join(out, 'grid.json'), 'w'), indent=1)
print('creeping hut:', [(lv.id, len(lv.rooms), len(lv.objects)) for lv in levels])
