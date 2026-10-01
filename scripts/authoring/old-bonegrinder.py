#!/usr/bin/env python3
"""Old Bonegrinder (chapter 6, area O; map p.127): the leaning brick windmill on its hill above the Vallaki road, home of
Morgantha's coven. Four storeys read off the map's panels (5-ft squares): the ground-floor kitchen (O1, about 30 ft
across, 8-ft ceiling), the bone mill (O2, 8 ft) with the rotten platform that rings the mill above the door, the
bedroom (O3, 9 ft) and the domed attic (O4) under the onion dome with the dead sails. Ceilings from the text.
The hill, the path up from the road and the four megaliths at the forest's edge are drawn round it.
-> locations/ch06/O/{scene,grid}.json; adds the scene to the world pin O."""
import json, math, os, sys
from collections import OrderedDict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from authorlib import ROOT, Level, rect, unit_edges, seg_key  # noqa: F401

_M = json.load(open(os.path.join(ROOT, 'manifests', 'locations.json')))
PAGE = {a['key']: a['page'] for l in _M['locations'] if l['id'] == 'O' for a in l['areas']}
pg = lambda k: PAGE.get(k)
CX, CY = 24, 24                      # the mill's centre, in cells, on a 48 × 48 cell (240 ft) hilltop
def octo(r, c):
    """The mill's round plan as an octagon on whole cells: flat sides 2c long, so doors and windows sit on the lattice."""
    return [(CX - c, CY - r), (CX + c, CY - r), (CX + r, CY - c), (CX + r, CY + c), (CX + c, CY + r), (CX - c, CY + r), (CX - r, CY + c), (CX - r, CY - c)]
AMB = 'barovian-overcast'
STAIR = (CX - 1.5, CY + 0.9)         # the crumbling stair curls up the wall across from the oven

# ---------------------------------------------------------------- O1 ground floor, and the hill round it
g = Level('O1L', 'Ground floor (O1)', 0, 8, ambient='interior-dim', interior='brick', exterior='brick', north='-z')
g.terrain.append((rect(0, 0, 48, 48), 'grass'))
g.terrain.append(([(CX - 1, CY + 3), (CX + 1, CY + 3), (CX + 2, 48), (CX - 2, 48)], 'dirt'))      # the path down to the road
g.room('O1', 'Ground Floor', octo(3, 1), 'flagstone', page=pg('O1'), ceilingFt=8)
g.door((CX, CY + 3), (CX + 1, CY + 3), id='O1-door')
g.window((CX + 3, CY), (CX + 3, CY + 1))
g.prop('O1-oven', 'oven', (CX + 2.2, CY - 1.4), 'O1', rotY=-90); g.light('O1-oven', (CX + 2.2, CY - 1.4), 'candle', 5, 10, y=3)
g.prop('O1-stair', 'spiral-stair', STAIR, 'O1', dims={'r': 4, 'rise': 10})
g.prop('O1-barrel', 'wine-cask', (CX + 0.2, CY + 0.2), 'O1')
g.prop('O1-cabinet', 'cabinet', (CX + 2.4, CY + 1.2), 'O1', rotY=-90); g.prop('O1-trunk', 'trunk', (CX - 2.2, CY - 1.4), 'O1', rotY=90)
g.prop('O1-coop', 'crate-chest', (CX - 0.6, CY - 2.3), 'O1'); g.prop('O1-cart', 'wagon', (CX - 4.8, CY + 3.6), 'O1', rotY=70)
g.prop('O1-bones', 'bones', (CX - 0.8, CY + 1.6), 'O1'); g.prop('O1-baskets', 'refuse', (CX + 1.2, CY + 2.2), 'O1')
g.hidden('O1-pastries', 'niche', (CX + 2.2, CY - 1.4), 'O1', 'A dozen dream pastries baking in the oven; Morgantha checks them every 10 minutes')
g.hidden('O1-ichor', 'niche', (CX + 0.2, CY + 0.2), 'O1', 'Demon ichor: a scrying font; three knocks summon a dretch (nine in all)')
g.hidden('O1-elixirs', 'niche', (CX + 2.4, CY + 1.2), 'O1', 'Three labelled elixirs in the painted cabinet: Youth, Laughter (cackle fever), Mother\'s Milk (pale tincture); locks of hair on the doors')
g.hidden('O1-toads', 'niche', (CX - 2.2, CY - 1.4), 'O1', 'A hundred toads in the trunk, holes bored in its lid')
# the hill: the megaliths at the forest's edge, the raven on its beam, the forest
for i, (x, z) in enumerate([(6, 6), (10, 3), (4, 11), (9, 9)]): g.prop(f'megalith{i}', 'standing-stone', (x, z), None, rotY=i * 40 + 15, dims={'h': 6 + i % 2})
g.note('megaliths', (7, 7), None, 'The Megaliths (p.128): four squat stones carved with the Four Cities; ravens circle; a dream pastry and a pile of children\'s teeth in the ring.')
for i in range(26):
    a = i / 26 * 2 * math.pi; r = 19 + (i * 7) % 4
    x, z = CX + math.cos(a) * r, CY + math.sin(a) * r
    if abs(x - CX) < 4 and z > CY: continue                      # the path stays open
    if 3 < x < 12 and 2 < z < 12: continue                        # the stone ring stands in a clearing
    g.prop(f'pine{i}', 'pine', (x, z), None, dims={'scale': 1.1 + (i % 3) * 0.2})
g.note('raven', (CX + 0.5, CY + 3.6), None, 'A raven on the beam above the door squawks a warning, then flies off toward Vallaki.')

# ---------------------------------------------------------------- O2 bone mill, with the platform round the mill
m = Level('O2L', 'Bone mill (O2)', 10, 8, ambient='interior-dim', interior='brick', exterior='brick', north='-z')
m.room('O2', 'Bone Mill', octo(3, 1), 'plank', page=pg('O2'), ceilingFt=8)
m.prop('O2-platform', 'prism', (0, 0), None, dims={'h': 0.6, 'y': -0.7, 'color': 0x6b4e33})
m.objects[-1]['pos'] = [0, 0, 0]; m.objects[-1]['polygon'] = [[round((CX + math.cos(k / 12 * 2 * math.pi) * 5.2) * 5, 1), round((CY + math.sin(k / 12 * 2 * math.pi) * 5.2) * 5, 1)] for k in range(12)]
m.window((CX + 3, CY), (CX + 3, CY + 1)); m.window((CX - 3, CY - 1), (CX - 3, CY))
m.prop('O2-millstone', 'millstone', (CX + 0.6, CY - 0.4), 'O2', dims={'r': 3.2})
m.prop('O2-shaft', 'gear-shaft', (CX + 0.6, CY - 0.4), 'O2', dims={'h': 29})
m.prop('O2-stair', 'spiral-stair', STAIR, 'O2', dims={'r': 4, 'rise': 10})
m.prop('O2-bones', 'bones', (CX - 1.2, CY - 1.6), 'O2')
m.creature('O2-morgantha', 'commoner', (CX + 1.6, CY + 1.4), 'O2', 'Morgantha, a night hag in the guise of a heavyset old woman, sweeping bone dust')

# ---------------------------------------------------------------- O3 bedroom
b = Level('O3L', 'Bedroom (O3)', 20, 9, ambient='interior-dim', interior='brick', exterior='brick', north='-z')
b.room('O3', 'Bedroom', octo(3, 1), 'plank', page=pg('O3'), ceilingFt=9)
b.window((CX - 1, CY - 3), (CX, CY - 3))
b.prop('O3-shaft', 'gear-shaft', (CX + 0.6, CY - 0.4), 'O3', dims={'h': 9})
b.prop('O3-bed', 'four-poster-bed', (CX - 1.6, CY - 1.4), 'O3', rotY=90)
b.prop('O3-closet', 'wardrobe', (CX + 2.3, CY + 1.0), 'O3', rotY=-90)
for k, y in enumerate((0, 3, 6)): b.prop(f'O3-crate{k}', 'crate-chest', (CX + 1.6, CY + 2.2), 'O3', y=y)
b.prop('O3-clothes', 'refuse', (CX + 0.2, CY + 2.4), 'O3')
b.prop('O3-trapdoor', 'trapdoor', (CX - 0.5, CY + 0.6), 'O3', y=8.9)
b.creature('O3-bella', 'commoner', (CX - 0.4, CY - 0.8), 'O3', 'Bella Sunbane, a night hag dancing round the shaft')
b.creature('O3-offalia', 'commoner', (CX + 1.4, CY - 1.6), 'O3', 'Offalia Wormwiggle, a night hag dancing round the shaft')
b.hidden('O3-children', 'niche', (CX + 1.6, CY + 2.2), 'O3', 'Freek (7) and Myrtle (5) in the middle and lower crates, fattened on crumbs')
b.hidden('O3-jewelry', 'niche', (CX - 1.6, CY - 1.4), 'O3', 'Six pieces of cheap jewellery (25 gp each) in the mouldy mattress')

# ---------------------------------------------------------------- O4 domed attic, the dome and the dead sails
a = Level('O4L', 'Domed attic (O4)', 30, 10, ambient='darkness', interior='plank', exterior='brick', north='-z')
a.room('O4', 'Domed Attic', octo(2, 1), 'plank', page=pg('O4'), ceilingFt=10)
a.prop('O4-gear', 'gear-shaft', (CX + 0.6, CY - 0.4), 'O4', dims={'h': 4})
a.prop('O4-nests', 'refuse', (CX - 1, CY + 1), 'O4')
a.hidden('O4-nest', 'niche', (CX - 1, CY + 1), 'O4', 'Old bird\'s nests; a card-reading treasure would be here, in a nest or under dirt in a corner')
a.prop('O4-dome', 'onion-dome', (CX, CY), None, dims={'r': 12, 'y': 9})
a.prop('O4-sails', 'mill-sails', (CX, CY - 2.6), None, rotY=0, dims={'len': 30, 'a': 22}, y=5)

DESC = {
  'O1': ('A filthy makeshift kitchen: baskets and dishes everywhere, a peddler\'s cart, a chicken coop, a heavy trunk, a cabinet painted with flowers, a warm brick oven, an open barrel reeking of something foul. Small bones on the flagstones.', 'Dream pastries in the oven; the barrel is demon ichor (scrying font, dretches); the cabinet holds three elixirs; the trunk holds a hundred toads.'),
  'O2': ('A dusty chamber taken up by a great millstone on a gear shaft that rises through the ceiling. Dirt-caked windows.', 'Morgantha sweeps here; she sells dream pastries at 1 gp and calls her daughters if attacked.'),
  'O3': ('A cramped round room: a thick gear shaft, a rotting closet with three stacked crates, a heap of children\'s clothes, a ladder to a trapdoor, a mouldy canopied bed.', 'Bella and Offalia; Freek and Myrtle in the crates; jewellery in the mattress.'),
  'O4': ('The domed peak, full of old machinery; light through small holes in the walls.', 'Old bird\'s nests.'),
}
levels = [g, m, b, a]
lk = lambda id, kind, al, ap, bl, bp: OrderedDict(id=id, kind=kind, **{'from': OrderedDict(level=al, pos=[ap[0] * 5, ap[1] * 5]), 'to': OrderedDict(level=bl, pos=[bp[0] * 5, bp[1] * 5])})
links = [lk('O-stair-1', 'stairs', 'O1L', STAIR, 'O2L', STAIR), lk('O-stair-2', 'stairs', 'O2L', STAIR, 'O3L', STAIR), lk('O-ladder', 'trapdoor', 'O3L', (CX - 0.5, CY + 0.6), 'O4L', (CX - 0.5, CY + 0.6))]
scene = OrderedDict(schema=1, location='O', chapter='ch06', name='Old Bonegrinder', mapPage=127, bookScaleFt=5, ambient=AMB, stacked=True, entry='O1L', levels=[lv.to_json() for lv in levels], links=links)
for lv in scene['levels']:
    for r in lv['rooms']:
        d = DESC.get(r['key'])
        if d: r['desc'] = d[0]; r['dm'] = d[1]
grid = OrderedDict(schema=1, levels=OrderedDict((lv.id, OrderedDict(floorPolygons=[[[x * 5, z * 5] for x, z in p] for p in lv.floor_polys] + [[[x * 5, z * 5] for x, z in p] for p, _ in lv.terrain[:1]], type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0.55)) for lv in levels))
out = os.path.join(ROOT, 'locations', 'ch06', 'O'); os.makedirs(out, exist_ok=True)
json.dump(scene, open(os.path.join(out, 'scene.json'), 'w'), indent=1)
json.dump(grid, open(os.path.join(out, 'grid.json'), 'w'), indent=1)
# the world pin opens it
wp = os.path.join(ROOT, 'locations', 'ch02', 'barovia-region', 'world.json'); W = json.load(open(wp), object_pairs_hook=OrderedDict)
for p in W['pins']:
    if p['key'] == 'O': p['scenes'] = ['ch06/O']
json.dump(W, open(wp, 'w'), indent=1)
print('old bonegrinder:', [(lv.id, len(lv.rooms), len(lv.objects)) for lv in levels])
