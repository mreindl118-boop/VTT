#!/usr/bin/env python3
"""Argynvostholt (chapter 7, area Q; maps p.131 and p.137, one square = 10 ft) -> locations/ch07/Q/{scene,grid}.json

The silver dragon's ruined mansion on its promontory above the Svalich Woods, traced off the book's four plans and
registered into one frame (1 cell = 5 ft = half a book square; x east, z south, cell = 2 x book square on p.131's
grid). The ground-floor panel of p.131 fixes the frame; the second-floor panel shares its grid 18 squares higher; the
third floor and the rooftop on p.137 were registered on the north block (Q37-Q40 over Q6-Q10) and the towers.

Levels (elevations from the text: balconies 20 ft over the foyer, Q32 40 ft and the roof 60 ft over the ballroom,
the beacon's lower landing 60 ft and upper landing 80 ft over the chapel floor):
  ground   0 ft   Q1-Q16 and the grounds (the drive and the dragon statue, the cemetery, the burned stable, the
                  rubble of the collapsed south end)
  second  20 ft   Q17-Q29 (balconies over the foyer, the chapel balcony, the trapped hall and the knights' quarters)
  third   40 ft   Q30-Q42 (Vladimir's audience hall, the Order's council room, Argynvost's study and vault)
  roof    60 ft   Q43-Q50 and the archers' posts of Q52 (parapets, tower tops, turrets, the beacon's lower landing)
  beacon  80 ft   Q51 and the turret roofs of Q52
  peak   100 ft   Q53, the beacon of Argynvostholt under its pitched roof
The book draws the beacon's upper landing and peak beside the roof plan; here they stand in the tower over the
chapel apse, where they belong. The text says the main floor stands a storey above the north grounds (the gate
flights climb ten feet); the grounds are drawn level with it and the flights as short steps, noted for the DM.
Only keys, names, page numbers, dimensions and placements come from the book; descriptions are our own words."""
import json, math, os, sys
from collections import OrderedDict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from authorlib import ROOT, Level, rect, unit_edges, seg_key, cobwebs  # noqa: F401

_M = json.load(open(os.path.join(ROOT, 'manifests', 'locations.json')))
PAGE = {a['key']: a['page'] for l in _M['locations'] if l['id'] == 'Q' for a in l['areas']}
def pg(k): return PAGE.get(k.split('-')[0])

# ------------------------------------------------------------------ helpers
def ov(lv, a, b, **kw):
    """Override one exact wall segment (diagonals and fractional edges, which _stamp would split)."""
    k = seg_key(a, b)
    lv.overrides[k] = dict(lv.overrides.get(k, {}), **kw)

def door_edge(lv, a, b, id, locked=False, open=False):
    lv.n += 1
    ov(lv, a, b, flags=['door'] + (['locked'] if locked else []), id=id, open=open, wall=True)

def window_edge(lv, a, b):
    ov(lv, a, b, flags=['window'], wall=True)

def win(lv, a, b, id=None):
    """A window over one or more whole cells; with an id the cells fuse into one wide window."""
    if id: lv._stamp(a, b, flags=['window'], id=f'{lv.id}-win-{id}', wall=True)
    else: lv._stamp(a, b, flags=['window'], wall=True)

def low(lv, a, b, h=3.5, material='ashlar'):
    """A railing, balustrade or parapet over whole cells: blocks movement, stands h ft."""
    lv._stamp(a, b, flags=['normal'], heightFt=h, material=material, wall=True)

def edges_of(lv, poly, **kw):
    """Override every wall segment of a polygon (a mausoleum's low walls, a turret's height)."""
    for a, b in unit_edges(poly):
        ov(lv, a, b, **kw)

def prism(lv, id, poly, h, color=0x6d6860, key=None, y=0):
    """A solid block on the level's floor with a plan polygon: a turret's masonry base, a chimney breast."""
    lv.obj(id, 'prism', (0, 0), 'player', key, dims={'h': h, 'color': color, 'y': y})
    lv.objects[-1]['pos'] = [0, 0, 0]
    lv.objects[-1]['polygon'] = [[round(x * 5, 3), round(z * 5, 3)] for x, z in poly]

def finish(lv, outdoor=(), parapet=(), parapet_h=4):
    """Outdoor rooms lose their walls; roof decks get low parapets; an edge an indoor room shares with them stays a
    wall of the outside material. Edges already overridden (doors, windows, fences, railings) are left alone."""
    owners = {}
    for key, _, poly, _, _ in lv.rooms:
        for a, b in unit_edges(poly):
            owners.setdefault(seg_key(a, b), []).append(key)
    for k, keys in owners.items():
        if k in lv.overrides: continue
        kinds = ['out' if x in outdoor else 'par' if x in parapet else 'in' for x in keys]
        if 'in' in kinds:
            if len(kinds) > 1 and any(t != 'in' for t in kinds): lv.overrides[k] = dict(material=lv.exterior)
            continue
        if len(keys) > 1 or 'par' not in kinds: lv.overrides[k] = dict(open_wall=True)
        else: lv.overrides[k] = dict(flags=['normal'], heightFt=parapet_h, material='ashlar', wall=True)

def ngon(cx, cz, r, n=16, a0=0.0):
    return [(round(cx + math.cos(a0 + i * 2 * math.pi / n) * r, 3), round(cz + math.sin(a0 + i * 2 * math.pi / n) * r, 3)) for i in range(n)]

# Plans shared by several floors (cells). The round north towers merge into the building with a square inner corner.
TOWER_W = [(28, 6), (30, 6), (31.2, 6.8), (32, 8), (32, 12), (28, 12), (26.8, 11.2), (26, 10), (26, 8), (26.8, 6.8)]
TOWER_E = [(46, 6), (44, 6), (42.8, 6.8), (42, 8), (42, 12), (46, 12), (47.2, 11.2), (48, 10), (48, 8), (47.2, 6.8)]
FOYER = [(30, 18), (40, 18), (40, 28), (30, 28), (30, 26), (28, 26), (26, 24), (26, 22), (28, 20), (30, 20)]
WEST_HALL = [(28, 20), (36, 20), (36, 26), (28, 26), (26, 24), (26, 22)]          # the foyer's upper half, Q36 over it
TUR_NW = [(28.6, 18), (30, 18), (30, 20), (28, 20), (28, 18.6)]                     # west stair turrets (Q17/Q30/Q47)
TUR_SW = [(28, 26), (30, 26), (30, 28), (28.6, 28), (28, 27.4)]
TUR_NE = [(44, 18), (45.4, 18), (46, 18.6), (46, 20), (44, 20)]                     # east turrets (Q21/Q31)
TUR_SE = [(44, 26), (46, 26), (46, 27.4), (45.4, 28), (44, 28)]
CH_N = [(50, 18.6), (50.6, 18), (52, 18), (52, 20), (50, 20)]                       # chapel stair turrets (Q14/Q52)
CH_S = [(50, 26), (52, 26), (52, 28), (50.6, 28), (50, 27.4)]
CHAPEL = [(46, 20), (55, 20), (56, 21), (56, 25), (55, 26), (46, 26)]
APSE = [((52, 20), (55, 20)), ((55, 20), (56, 21)), ((56, 21), (56, 25)), ((56, 25), (55, 26)), ((55, 26), (52, 26))]
OCT = [(52, 20), (54, 20), (56, 22), (56, 24), (54, 26), (52, 26), (50, 24), (50, 22)]   # the beacon tower over the apse
LANDING = [(52, 20), (54, 20), (54, 22), (52, 22), (52, 24), (54, 24), (54, 26), (52, 26), (50, 24), (50, 22)]
CHIMNEYS = [[(29, 14), (30, 14), (30, 16), (29, 16)], [(44, 14), (45, 14), (45, 16), (44, 16)],
            [(29, 30), (30, 30), (30, 32), (29, 32)], [(44, 30), (45, 30), (45, 32), (44, 32)]]
def mirror(poly): return list(reversed([(74 - x, z) for x, z in poly]))
STONE = 0x6d6860

# ================================================================== GROUND (0 ft)
g = Level('ground', 'Ground floor (Q1-Q16)', 0, 20, interior='ashlar', exterior='ashlar', north='-z')
g.terrain.append(([(-24, -18), (96, -18), (96, 72), (-24, 72)], 'grass'))
g.terrain.append(([(-24, 20.6), (8.6, 20.6), (8.6, 25.4), (-24, 25.4)], 'dirt'))                     # the road in from the west
g.terrain.append(([(9.5, 28.5), (13.5, 28.5), (15.5, 40), (34, 40), (34, 46), (13, 46), (9.5, 41)], 'dirt'))   # the track down to the stable
g.terrain.append(([(23, 33), (30, 33), (30, 35), (44, 35), (44, 33), (51, 33), (52, 39), (41, 39.6), (33, 39.6), (24, 39)], 'dirt'))  # the fallen south end
g.terrain.append(([(51.4, 15.4), (52.6, 16.2), (57.9, 13.2), (57.1, 12.4)], 'dirt'))                 # the cemetery path

# Q1 the drive round the dragon statue; Q2 the steps and landing
g.room('Q1', 'Dragon Statue', ngon(15, 23, 7, 16, math.pi / 16), 'dirt', page=pg('Q1'))
g.room('Q2', 'Main Entrance', rect(22, 20, 26, 26), 'flagstone', page=pg('Q2'))
low(g, (22, 20), (26, 20)); low(g, (22, 26), (26, 26))
g.door((26, 22), (26, 24), id='Q2-doors')
# Q3 the foyer, its west end chamfered between the stair turrets
g.room('Q3', "Dragon's Foyer", FOYER, 'flagstone', page=pg('Q3'), ceilingFt=40)
window_edge(g, (28, 20), (26, 22)); window_edge(g, (26, 24), (28, 26))
for k, p in (('nw', TUR_NW), ('sw', TUR_SW)): prism(g, f'Q17-base-{k}', p, 20, STONE)
# the north block: den, wine store, kitchen; the gate passage and the round towers behind
g.room('Q6', "Dragon's Den", rect(30, 12, 36, 18), 'plank', page=pg('Q6'), ceilingFt=20)
g.room('Q11', 'Wine Storage', rect(36, 12, 40, 18), 'flagstone', page=pg('Q11'), ceilingFt=20)
g.room('Q10', 'Kitchen', rect(40, 12, 44, 18), 'flagstone', page=pg('Q10'), ceilingFt=20)
g.room('Q8', 'Iron Gate', rect(32, 10, 42, 12), 'flagstone', page=pg('Q8'), ceilingFt=20)
g.room('Q7', 'Parlor', TOWER_W, 'plank', page=pg('Q7'), ceilingFt=20)
g.room('Q9', "Servants' Quarters", TOWER_E, 'plank', page=pg('Q9'), ceilingFt=20)
g.room('Q12', 'Dining Hall', rect(40, 18, 46, 28), 'flagstone', page=pg('Q12'), ceilingFt=20)
g.room('Q13', 'Chapel of Morning', CHAPEL, 'flagstone', page=pg('Q13'), ceilingFt=60)
g.room('Q14', 'Chapel Staircases', CH_N, 'flagstone', page=pg('Q14'), ceilingFt=20)
g.room('Q14-south', 'Chapel Staircase (south)', CH_S, 'flagstone', page=pg('Q14'), ceilingFt=20)
g.room('Q4', "Spiders' Ballroom", rect(30, 28, 44, 35), 'flagstone', page=pg('Q4'), ceilingFt=20)
g.room('Q5', 'Ruined Stable', rect(34, 40, 40, 48), 'dirt', page=pg('Q5'))
# Q15 the cemetery behind the mansion, fenced; Q16 the mausoleum in its north-east corner
g.room('Q15', 'Cemetery', [(48, 10), (56, 10), (56, 12), (57, 12), (58, 13), (58, 14), (60, 14), (60, 20), (52, 20), (52, 16), (50, 16), (50, 17),
                           (48, 17), (48, 20), (46, 20), (46, 18), (44, 18), (44, 12), (46, 12), (47.2, 11.2)], 'grass', page=pg('Q15'))
g.room('Q15-steps', 'Cemetery Steps', [(48, 17), (50, 17), (50, 16), (52, 16), (52, 18), (50.6, 18), (50, 18.6), (50, 20), (48, 20)], 'flagstone', page=pg('Q15'))
MAUSO = [(58, 8), (60, 8), (60, 9), (61, 10), (62, 10), (62, 12), (61, 12), (60, 13), (60, 14), (58, 14), (58, 13), (57, 12), (56, 12), (56, 10), (57, 10), (58, 9)]
g.room('Q16', "Dragon's Mausoleum", MAUSO, 'flagstone', page=pg('Q16'), ceilingFt=12)
edges_of(g, MAUSO, heightFt=12, material='ashlar')
door_edge(g, (57, 12), (58, 13), 'Q16-marble-door', locked=True)

# doors, windows, openings
g.door((31, 18), (32, 18), id='Q3-Q6'); g.door((37, 18), (38, 18), id='Q3-Q11')
g.door((31, 28), (32, 28), id='Q3-Q4-w'); g.door((37, 28), (38, 28), id='Q3-Q4-e')
g.door((40, 18), (40, 20), id='Q3-Q12-n', open=True); g.door((40, 26), (40, 28), id='Q3-Q12-s')
g.door((42, 18), (43, 18), id='Q12-Q10'); g.door((42, 28), (43, 28), id='Q12-Q4')
g.door((46, 22), (46, 24), id='Q12-Q13-glass', open=True)
g.door((48, 20), (49, 20), id='Q13-north', locked=True)
g.door((32, 10), (32, 11), id='Q8-Q7'); g.door((42, 10), (42, 11), id='Q8-Q9')
g.door((36, 10), (38, 10), id='Q8-gate', locked=True)
g.opening((42, 12), (44, 12))                                                  # the curtained arch, servants' quarters to kitchen
win(g, (52, 18), (52, 19)); win(g, (52, 27), (52, 28))                         # slit windows up the chapel stairs
g.opening((50, 20), (51, 20)); g.opening((50, 26), (51, 26))                    # narrow arches to the chapel stairs
g.secret((36, 12), (36, 13), 'Q6-Q11', 'A secret door at the north end of the den\'s east wall, into the wine store (pushes open from the den, pulls from the store)', 'Q6')
for a, b in [((33, 10), (34, 10)), ((40, 10), (41, 10)), ((30, 13), (30, 14)), ((30, 16), (30, 17)), ((44, 13), (44, 14)), ((44, 16), (44, 17)),
             ((45, 18), (46, 18)), ((46, 18), (46, 19)), ((45, 28), (46, 28)), ((46, 27), (46, 28)), ((46, 21), (46, 22)), ((46, 24), (46, 25)),
             ((56, 22), (56, 23)), ((56, 23), (56, 24)), ((30, 33), (30, 34)), ((44, 33), (44, 34)), ((28, 6), (29, 6)), ((29, 6), (30, 6)),
             ((26, 8), (26, 9)), ((26, 9), (26, 10)), ((44, 6), (45, 6)), ((45, 6), (46, 6)), ((48, 8), (48, 9)), ((48, 9), (48, 10))]:
    win(g, a, b)
window_edge(g, (55, 20), (56, 21)); window_edge(g, (56, 25), (55, 26))
for poly in ([(26.8, 6.8), (28, 6)], [(26, 10), (26.8, 11.2)]): window_edge(g, *poly)
for poly in ([(46, 6), (47.2, 6.8)], [(48, 10), (47.2, 11.2)]): window_edge(g, *poly)
# the cemetery fence: seven feet of wrought iron (an invisible wall carries the rule; the fence is the prop)
for a, b in [((48, 10), (56, 10)), ((60, 14), (60, 20)), ((55, 20), (60, 20))]: g._stamp(a, b, flags=['invisible'], wall=True)
# the stable's burned foundation: low rubble walls, open where the track comes in
for a, b in [((34, 40), (40, 40)), ((40, 40), (40, 48)), ((40, 48), (34, 48)), ((34, 48), (34, 46)), ((34, 42), (34, 40))]: low(g, a, b, 2.5, 'rubble')
g.opening((34, 42), (34, 46))
# the ballroom's south side fell with the rooms above it: a stub of wall, then open rubble
low(g, (30, 35), (34, 35), 9, 'rubble'); g.opening((34, 35), (44, 35)); g.opening((44, 34), (44, 35))
finish(g, outdoor=('Q1', 'Q2', 'Q5', 'Q15', 'Q15-steps'))

# --- fixtures: the grounds
g.obj('spawn', 'spawn', (6, 23), 'dm-note', 'Q1', 'Party spawn: the winding road up the promontory')
g.prop('Q1-mound', 'mound', (15, 23), 'Q1', dims={'r': 15, 'h': 1.6})
g.prop('Q1-statue', 'dragon-statue', (15, 23), 'Q1')
g.note('Q1-note', (15, 19.4), 'Q1', 'The statue breathes a 60-ft cone of harmless cold air at anyone on the entrance steps, once per dawn (the trap is spent).')
g.prop('Q2-steps', 'stair-flight', (23, 23), 'Q2', dims={'len': 10, 'w': 29, 'rise': 2})
g.prop('Q2-landing', 'ledge', (25, 23), 'Q2', dims={'w': 10, 'd': 29, 'h': 2})
g.note('Q2-lintel', (25.6, 21.2), 'Q2', 'ARGYNVOSTHOLT is carved in the lintel; the knockers are small dragons.')
g.hidden('event-cart', 'wagon', (19.5, 28.6), 'Q1', 'Special Delivery: a mad Vistana, Kolya, leaves a cart here with a plain coffin bearing a character\'s name; opening it frees a swarm of bats', rotY=20)
g.hidden('event-coffin', 'coffin', (19.5, 31.2), 'Q1', 'The coffin from Vallaki (Henrik van der Voort\'s work): a swarm of bats inside attacks the named character', rotY=90)
g.note('event-arrigal', (2, 23), 'Q1', "Arrigal's Hunt: Ezmerelda arrives on a stolen horse; Arrigal (assassin) and two Vistani bandits on dire wolves follow her up this road.")
g.prop('Q5-beams', 'broken-rafters', (37, 44), 'Q5', dims={'n': 4, 'len': 22, 'h': 3, 'seed': 4})
g.prop('Q5-ash', 'wreckage', (36, 42.5), 'Q5', dims={'n': 8, 's': 1.4, 'seed': 6})
g.prop('Q5-post1', 'post-round', (34.6, 40.6), 'Q5', dims={'r': 0.7, 'h': 7}); g.prop('Q5-post2', 'post-round', (39.4, 47.4), 'Q5', dims={'r': 0.7, 'h': 4})
# the cemetery: rows of old graves, five dug up from below, the iron fence, a dead tree
for i, (x, z) in enumerate([(49.5, 12.2), (51.3, 12.2), (53.1, 12.2), (54.9, 12.2), (49.5, 14.6), (52.6, 14.6), (54.4, 14.6),
                            (54.2, 16.4), (56, 16.4), (57.8, 16.4), (53.6, 18.6), (57.4, 18.6), (59, 18.6)]):
    g.prop(f'Q15-grave{i}', 'gravestone', (x, z), 'Q15', rotY=180 + (i % 3 - 1) * 6)
for i, (x, z) in enumerate([(51.3, 14.6), (56.2, 14.6), (55.8, 18.6), (58.9, 16.4), (47, 14.2)]):
    g.hidden(f'Q15-dug{i}', 'open-grave', (x, z), 'Q15', 'A dug-up grave: the corpse clawed its way out (a revenant\'s new body)', rotY=180, dims={'seed': i + 1})
g.prop('Q15-fence-n', 'iron-fence', (52, 10), 'Q15', dims={'len': 40}); g.prop('Q15-fence-e', 'iron-fence', (60, 17), 'Q15', rotY=90, dims={'len': 30})
g.prop('Q15-fence-s', 'iron-fence', (57.5, 20), 'Q15', dims={'len': 25})
g.prop('Q15-tree', 'dead-tree', (58.8, 15.2), 'Q15', dims={'scale': 0.9})
g.note('Q15-note', (54, 11.2), 'Q15', 'Unless the beacon is lit: on first crossing, a well-dressed man with pale, wispy hair watches from Q42\'s south-east window, then draws the curtain (an apparition).')
g.prop('Q15-stair', 'stair-flight', (51, 17), 'Q15-steps', rotY=180, dims={'len': 10, 'w': 9.5, 'rise': 3})
g.prop('Q15-landing', 'ledge', (49, 18.6), 'Q15-steps', dims={'w': 9.6, 'd': 13.5, 'h': 3})
# the mausoleum: a cross of stone under a tiled roof, silver wyrmlings at the ridge ends, four raised alcoves inside
g.prop('Q16-roof', 'mausoleum-roof', (59, 11), 'Q16', dims={'y': 12, 'arm': 15, 'w': 10, 'h': 5})
for i, (x, z, r) in enumerate([(59, 8.3, 90), (61.7, 11, 0), (59, 13.7, -90), (56.3, 11, 180)]):
    g.prop(f'Q16-wyrm{i}', 'wyrmling-statue', (x, z), 'Q16', rotY=r, dims={'y': 12.4})
for i, (x, z, w, d) in enumerate([(59, 8.5, 9, 4.5), (61.5, 11, 4.5, 9), (59, 13.5, 9, 4.5), (56.5, 11, 4.5, 9)]):
    g.prop(f'Q16-alcove{i}', 'ledge', (x, z), 'Q16', dims={'w': w, 'd': d, 'h': 1.2})
g.note('Q16-verse', (60.2, 10), 'Q16', 'Draconic on the far (north-east) wall: here lie the bones and treasures of Argynvost, lord of Argynvostholt and founder of the Order of the Silver Dragon.')
# --- the mansion: foyer
g.prop('Q3-mosaic', 'floor-inlay', (33, 23), 'Q3', dims={'w': 22, 'd': 22})
g.prop('Q3-flight', 'stair-flight', (37, 23), 'Q3', dims={'len': 10, 'w': 10, 'rise': 10, 'rail': 1})
g.prop('Q3-landing', 'ledge', (39, 23), 'Q3', dims={'w': 10, 'd': 10, 'h': 10})
g.prop('Q3-flight-n', 'stair-flight', (39, 21), 'Q3', rotY=90, dims={'len': 10, 'w': 10, 'rise': 10, 'base': 10, 'rail': 1})
g.prop('Q3-flight-s', 'stair-flight', (39, 25), 'Q3', rotY=-90, dims={'len': 10, 'w': 10, 'rise': 10, 'base': 10, 'rail': 1})
g.prop('Q3-tapestry', 'tapestry', (39.85, 23), 'Q3', rotY=-90, dims={'w': 8}, y=11)
for i, (x, z) in enumerate([(32, 20), (36, 20), (32, 26), (36, 26)]): g.prop(f'Q3-pillar{i}', 'tall-column', (x, z), 'Q3', dims={'h': 20})
for i, (x, z, r) in enumerate([(34, 18.75, 0), (34, 27.25, 180), (38.6, 18.75, 0)]): g.prop(f'Q3-bust{i}', 'bust-pedestal', (x, z), 'Q3', rotY=r)
g.prop('Q3-bust-broken', 'bust-pedestal', (38.4, 27), 'Q3', dims={'broken': 1})
g.prop('Q3-chandelier-w', 'chandelier', (30, 23), 'Q3', dims={'y': 16}); g.prop('Q3-chandelier-e', 'chandelier', (34.5, 23), 'Q3', dims={'y': 16})
g.note('Q3-shadow', (29, 23), 'Q3', 'First time through: a great winged shadow sweeps across the walls with a soft hiss, and is gone (harmless).')
cobwebs(g, [(30, 18), (40, 18), (40, 28), (30, 28)], 'Q3', y=14, n=2)
# den, wine store, kitchen
g.prop('Q6-hearth', 'fireplace', (30.6, 15), 'Q6', rotY=90)
g.prop('Q6-sarcophagus', 'sarcophagus-cabinet', (33, 12.55), 'Q6')
g.prop('Q6-divan1', 'divan', (34.3, 16.4), 'Q6', rotY=200); g.prop('Q6-divan2', 'divan', (32.6, 14.6), 'Q6', rotY=70, dims={'tipped': 1})
g.prop('Q6-wreck', 'wreckage', (34.6, 13.8), 'Q6', dims={'n': 10, 'velvet': 1, 'seed': 2}); g.prop('Q6-wreck2', 'wreckage', (31.8, 17), 'Q6', dims={'n': 6, 'seed': 8})
g.note('Q6-fire', (31.4, 15), 'Q6', 'Living fire (beacon unlit): a dragon of flame erupts from the hearth on first approach (init 10, AC 15, 1 hp); it speaks once of the fallen knights and the lost light, then burns out. Destroyed, it explodes: DC 12 Dex, 22 (4d10) fire, half on a save, and the dry furniture burns.')
g.prop('Q11-casks', 'cask-rack', (38.9, 15), 'Q11', rotY=90, dims={'n': 3}); g.prop('Q11-cask', 'wine-cask', (36.8, 16.8), 'Q11')
g.creature('Q11-savid', 'dusk-elf', (38.2, 16.9), 'Q11', 'Savid, a dusk elf scout at 4 hp, hiding behind the barrels; friendly, wants healing, knows the mansion\'s story')
g.prop('Q10-hearth', 'fireplace', (43.4, 15), 'Q10', rotY=-90); g.prop('Q10-pot', 'iron-pot', (43.55, 15), 'Q10')
g.prop('Q10-table', 'table', (41.6, 13.6), 'Q10', rotY=25, dims={'w': 7, 'd': 3}); g.prop('Q10-wreck', 'wreckage', (41.6, 16.6), 'Q10', dims={'n': 9, 's': 0.8, 'seed': 12})
g.creature('Q10-bat', 'bat', (43.4, 15), 'Q10', 'An ordinary bat in the iron pot; it bursts out and flaps about the room', size='tiny')
# the round rooms by the gate
g.prop('Q7-drapes1', 'drapes', (29, 6.25), 'Q7', dims={'w': 8, 'color': 0x6a1e26}); g.prop('Q7-drapes2', 'drapes', (26.3, 9), 'Q7', rotY=90, dims={'w': 8, 'color': 0x6a1e26})
g.prop('Q7-chandelier', 'chandelier', (29, 9), 'Q7', dims={'y': 12, 'brass': 1})
g.prop('Q7-settee', 'divan', (28.8, 10.8), 'Q7', rotY=180); g.prop('Q7-sheet', 'sheeted', (30.6, 7.6), 'Q7'); g.prop('Q7-wreck', 'wreckage', (28, 8), 'Q7', dims={'n': 6, 'seed': 14})
cobwebs(g, [(27, 7), (31, 7)], 'Q7', y=12, n=2)
for i, (x, z, r) in enumerate([(44.6, 7.6, 20), (46.6, 8.4, 80), (44.2, 10.4, 140), (46.4, 10.9, 200)]): g.prop(f'Q9-bed{i}', 'bed-plain', (x, z), 'Q9', rotY=r)
g.prop('Q9-wreck', 'wreckage', (45.4, 9.4), 'Q9', dims={'n': 10, 'seed': 16}); g.prop('Q9-curtain', 'drapes', (43, 12.15), 'Q9', dims={'w': 9, 'color': 0x5a4632})
g.prop('Q9-drapes', 'drapes', (45, 6.25), 'Q9', dims={'w': 8, 'color': 0x5a4632})
g.prop('Q8-flight-w', 'stair-flight', (35, 11), 'Q8', rotY=180, dims={'len': 10, 'w': 9.5, 'rise': 3})
g.prop('Q8-landing-w', 'ledge', (33, 11), 'Q8', dims={'w': 10, 'd': 9.5, 'h': 3})
g.prop('Q8-flight-e', 'stair-flight', (39, 11), 'Q8', dims={'len': 10, 'w': 9.5, 'rise': 3})
g.prop('Q8-landing-e', 'ledge', (41, 11), 'Q8', dims={'w': 10, 'd': 9.5, 'h': 3})
g.note('Q8-note', (37, 11.2), 'Q8', 'Chained gate: DC 20 Dex with thieves\' tools to pick the padlock, or DC 15 Str with a bludgeoning or slashing weapon to smash it. In the book these flights climb 10 ft: the main floor stands a storey above the north grounds.')
# dining hall
g.prop('Q12-table', 'dragon-table', (42.6, 23), 'Q12', rotY=90, dims={'w': 20, 'd': 5})
for i, (x, z, r, f) in enumerate([(41.2, 20.4, 90, 0), (41.2, 22.2, 90, 0), (41.3, 24.2, 90, 1), (44, 20.6, -90, 0), (44, 22.4, -90, 1), (44, 24.6, -90, 0),
                                  (42.6, 19.4, 0, 0), (42.6, 26.6, 180, 0), (40.9, 26.4, 130, 1)]):
    g.prop(f'Q12-chair{i}', 'wing-chair', (x, z), 'Q12', rotY=r, dims={'fallen': f} if f else None)
g.prop('Q12-chandelier', 'chandelier', (42.6, 23), 'Q12', dims={'y': 14, 'crystal': 1})
g.light('Q12-chandelier', (42.6, 23), 'lantern', 20, 40, y=14)
g.prop('Q12-knight-n', 'knight-statue', (45, 19), 'Q12', rotY=-135); g.prop('Q12-knight-s', 'knight-statue', (45, 27), 'Q12', rotY=-45)
g.prop('Q12-puddle', 'water', (40.9, 22.4), 'Q12', dims={'w': 4, 'd': 11})
g.prop('Q12-glass-n', 'glass-hanging', (45.85, 21.5), 'Q12', rotY=-90); g.prop('Q12-glass-s', 'glass-hanging', (45.85, 24.5), 'Q12', rotY=-90)
# the chapel
for i, (x, z) in enumerate([(48, 22), (50, 22), (52, 22), (48, 24), (50, 24), (52, 24)]): g.prop(f'Q13-pillar{i}', 'tall-column', (x, z), 'Q13', dims={'h': 20, 'wood': 1})
g.prop('Q13-altar', 'sun-altar', (54.6, 23), 'Q13', rotY=-90)
g.prop('Q13-candelabra-n', 'candelabra', (54.6, 21.3), 'Q13'); g.prop('Q13-candelabra-s', 'candelabra', (54.6, 24.7), 'Q13')
g.prop('Q13-glass', 'rubble', (54.8, 20.9), 'Q13', dims={'n': 5})
for i, z in enumerate((21.9, 23, 24.1)): g.creature(f'Q13-revenant{i}', 'revenant', (53.2, z), 'Q13', 'Revenant of the Order kneeling at the altar (beacon unlit): attacks on sight, two longsword attacks of 15 (2d10+4); a lifeless armoured corpse once the beacon is lit')
g.note('Q13-bar', (48.6, 20.7), 'Q13', 'A wooden beam bars the north door; it lifts easily from this side. Stone steps beyond go down to the cemetery.')
g.note('Q13-tower', (54, 23.6), 'Q13', 'Look up from the altar: the hollow beacon tower, its lower landing (Q50) 60 ft up and the upper (Q51) 80 ft.')
g.light('Q13-window', (55.4, 23), 'daylight', 5, 10, y=8)
g.prop('Q14-stair', 'spiral-stair', (51, 19), 'Q14', dims={'r': 4, 'rise': 20}); g.prop('Q14s-stair', 'spiral-stair', (51, 27), 'Q14-south', dims={'r': 4, 'rise': 20})
# the ballroom and the fallen south end
for i, (x, z) in enumerate([(32.4, 30.4), (35.2, 29.6), (38.6, 30.6), (41.8, 29.8), (33.6, 32.8), (37.4, 32.2), (40.4, 33.2), (42.6, 31.8), (36, 34.2)]):
    g.creature(f'Q4-spider{i}', 'giant-spider', (x, z), 'Q4', 'Giant spider: nine nest here and attack anyone who comes close; they climb to Q19 at the creak of its floor', size='large')
g.prop('Q4-marble', 'floor-inlay', (37, 31.4), 'Q4', dims={'w': 68, 'd': 32, 'pink': 1})
g.prop('Q4-chandelier1', 'fallen-chandelier', (34.4, 31.2), 'Q4'); g.prop('Q4-chandelier2', 'fallen-chandelier', (40, 31), 'Q4', dims={'brass': 1})
g.prop('Q4-wreck1', 'wreckage', (31.8, 29.4), 'Q4', dims={'n': 9, 'seed': 20}); g.prop('Q4-wreck2', 'wreckage', (42.6, 29.2), 'Q4', dims={'n': 9, 'seed': 22})
for i, (x, z, w, r) in enumerate([(37, 29.4, 60, 0), (33, 31.5, 34, 90), (41, 31.5, 34, 90), (37, 33.4, 60, 0)]):
    g.prop(f'Q4-web{i}', 'web-sheet', (x, z), 'Q4', rotY=r, dims={'w': w, 'h': 10, 'y': 10})
g.prop('Q4-rubble1', 'rubble-heap', (35, 34), 'Q4', dims={'r': 7, 'h': 3.5, 'seed': 3}); g.prop('Q4-rubble2', 'rubble-heap', (41.6, 33.6), 'Q4', dims={'r': 6, 'h': 3, 'seed': 7})
cobwebs(g, [(30, 28), (44, 28)], 'Q4', y=14, n=2)
for i, (x, z, r, h, s) in enumerate([(26, 36, 9, 5, 31), (32, 37.6, 8, 4, 33), (38.6, 37, 10, 5, 35), (45.4, 36.4, 8, 4, 37), (50, 37.2, 6, 3, 39), (29, 41, 5, 2.5, 41), (47, 40.4, 5, 2.5, 43)]):
    g.prop(f'Q4-fall{i}', 'rubble-heap', (x, z), 'Q4', dims={'r': r, 'h': h, 'seed': s})
g.prop('Q4-rafters', 'broken-rafters', (37, 36.6), 'Q4', dims={'n': 4, 'len': 24, 'h': 6, 'seed': 17})
# the fallen south towers: stumps of their round walls standing out of the rubble
for cx, a0, a1 in ((29, 120, 250), (45, -70, 60)):
    for i in range(6):
        a = math.radians(a0 + (a1 - a0) * i / 6); b = math.radians(a0 + (a1 - a0) * (i + 1) / 6)
        p = (round(cx + math.cos(a) * 3.2, 2), round(37.2 - math.sin(a) * 3.2, 2)); q = (round(cx + math.cos(b) * 3.2, 2), round(37.2 - math.sin(b) * 3.2, 2))
        g.wall(p, q, heightFt=[11, 7, 4, 9, 5, 3][i], material='rubble')
g.wall((30, 35), (30, 36.2), heightFt=6, material='rubble'); g.wall((44, 34), (44, 35.4), heightFt=5, material='rubble')
# masonry: chimney breasts up the outside of the house
for i, p in enumerate(CHIMNEYS): prism(g, f'chimney{i}', p, 60, STONE)
# the promontory: pines on the slopes, boulders, a few dead trees
for i in range(46):
    a = i / 46 * 2 * math.pi + 0.05; r = 42 + (i * 7) % 9
    x, z = 37 + math.cos(a) * r * 1.15, 26 + math.sin(a) * r * 0.85
    if x < 10 and 18 < z < 28: continue                      # the road in from the west
    if 8 < x < 36 and z > 38: continue                       # the track to the stable
    g.prop(f'pine{i}', 'pine', (round(x, 2), round(z, 2)), None, dims={'scale': 1.0 + (i % 4) * 0.15})
for i, (x, z) in enumerate([(4, 6), (66, 4), (72, 30), (68, 52), (4, 52), (-4, 34), (62, 46)]): g.prop(f'deadtree{i}', 'dead-tree', (x, z), None, dims={'scale': 1 + (i % 3) * 0.15})
for i, (x, z, r) in enumerate([(2, 14, 3), (6, 32, 2.4), (26, 4, 2.6), (64, 22, 3.2), (56, 40, 2.4), (20, 50, 3), (48, 52, 2.6), (-8, 18, 3.4)]): g.prop(f'boulder{i}', 'boulder', (x, z), None, dims={'r': r})
g.note('promontory', (66, 60), None, 'The promontory drops away to the Svalich Woods and the Luna River valley; wolves howl below.')

# ================================================================== SECOND (20 ft)
s = Level('second', 'Second floor (Q17-Q29)', 20, 20, ambient='interior-dim', interior='plaster', exterior='ashlar', north='-z')
s.room('Q17', 'West Staircases', TUR_NW, 'flagstone', page=pg('Q17'), ceilingFt=20)
s.room('Q17-south', 'West Staircase (south)', TUR_SW, 'flagstone', page=pg('Q17'), ceilingFt=20)
s.room('Q18', 'Balconies', rect(30, 18, 40, 20), 'flagstone', page=pg('Q18'), ceilingFt=20)
s.room('Q18-south', 'Balcony (south)', rect(30, 26, 40, 28), 'flagstone', page=pg('Q18'), ceilingFt=20)
s.room('Q18-hall', 'Upper Hall', [(40, 18), (44, 18), (44, 20), (46, 20), (46, 26), (44, 26), (44, 28), (40, 28), (40, 26), (42, 26), (44, 24), (44, 22), (42, 20), (40, 20)], 'plank', page=pg('Q18'), ceilingFt=20)
s.room('Q21', 'North Alcove', TUR_NE, 'plank', page=pg('Q21'), ceilingFt=20)
s.room('Q20', 'South Alcove', TUR_SE, 'plank', page=pg('Q20'), ceilingFt=20)
s.room('Q23', 'Storage Room', [(40, 20), (42, 20), (44, 22), (44, 23), (40, 23)], 'plank', page=pg('Q23'), ceilingFt=20)
s.room('Q22', 'Bathroom', [(40, 23), (44, 23), (44, 24), (42, 26), (40, 26)], 'plank', page=pg('Q22'), ceilingFt=20)
s.room('Q24', 'Chapel Balcony', [(46, 20), (52, 20), (52, 22), (48, 22), (48, 24), (52, 24), (52, 26), (46, 26)], 'plank', page=pg('Q24'), ceilingFt=40)
s.room('Q14-second', 'Chapel Staircase (balcony)', CH_N, 'flagstone', page=pg('Q14'), ceilingFt=20)
s.room('Q14-secondsouth', 'Chapel Staircase (balcony, south)', CH_S, 'flagstone', page=pg('Q14'), ceilingFt=20)
s.room('Q25', 'Trapped Hallway', [(32, 10), (42, 10), (42, 12), (38, 12), (38, 18), (36, 18), (36, 12), (32, 12)], 'plank', page=pg('Q25'), ceilingFt=20)
s.room('Q26', 'Northeast Guest Room', rect(38, 12, 44, 18), 'plank', page=pg('Q26'), ceilingFt=20)
s.room('Q29', 'Northwest Guest Room', rect(30, 12, 36, 18), 'plank', page=pg('Q29'), ceilingFt=20)
s.room('Q27', "Knights' Quarters", TOWER_E, 'plank', page=pg('Q27'), ceilingFt=20)
s.room('Q28', "Knights' Quarters", TOWER_W, 'plank', page=pg('Q28'), ceilingFt=20)
s.room('Q19', 'Ruined Bedchambers', [(30, 28), (36, 28), (36, 33), (34, 32), (32, 33), (30, 32)], 'plank', page=pg('Q19'), ceilingFt=20)
s.room('Q19-east', 'Ruined Bedchamber (east)', [(38, 28), (44, 28), (44, 32), (42, 33), (40, 32), (38, 33)], 'plank', page=pg('Q19'), ceilingFt=20)
s.room('Q19-hall', 'Ruined Corridor', rect(36, 28, 38, 33), 'plank', page=pg('Q19'), ceilingFt=20)
# railings over the foyer and the chapel; the stair flights arrive at the balconies' east ends
low(s, (30, 20), (38, 20), 3.5, 'ashlar'); low(s, (30, 26), (38, 26), 3.5, 'ashlar'); s.opening((38, 20), (40, 20)); s.opening((38, 26), (40, 26))
for a, b in [((52, 20), (52, 22)), ((52, 22), (48, 22)), ((48, 22), (48, 24)), ((48, 24), (52, 24)), ((52, 24), (52, 26))]: low(s, a, b, 3.5, 'paneling')
s.opening((30, 18), (30, 20)); s.opening((30, 26), (30, 28))                    # archways to the west stairs
s.opening((40, 18), (40, 20)); s.opening((40, 26), (40, 28))                    # balconies into the upper hall
s.opening((44, 18), (44, 20)); s.opening((44, 26), (44, 28))                    # curtained alcoves
s.opening((36, 18), (38, 18)); s.opening((36, 28), (38, 28))                    # hallways north and south
s.opening((50, 20), (51, 20)); s.opening((50, 26), (51, 26))                    # arches to the chapel stairs
s.door((46, 20), (46, 21), id='Q24-Q21'); s.door((46, 25), (46, 26), id='Q24-Q20')
s.door((41, 20), (42, 20), id='Q23-door'); s.door((41, 26), (42, 26), id='Q22-door')
s.door((32, 10), (32, 11), id='Q25-Q28', locked=True); s.door((42, 10), (42, 11), id='Q25-Q27', locked=True)
s.door((38, 14), (38, 15), id='Q26-door', open=True); s.door((32, 18), (34, 18), id='Q29-doors')
s.door((32, 28), (33, 28), id='Q19-door'); s.door((38, 30), (38, 31), id='Q19-east-door')
for a, b in [((35, 10), (36, 10)), ((37, 10), (38, 10)), ((39, 10), (40, 10)), ((30, 13), (30, 14)), ((30, 16), (30, 17)), ((44, 13), (44, 14)), ((44, 16), (44, 17)),
             ((28, 6), (29, 6)), ((29, 6), (30, 6)), ((26, 8), (26, 9)), ((26, 9), (26, 10)), ((44, 6), (45, 6)), ((45, 6), (46, 6)), ((48, 8), (48, 9)), ((48, 9), (48, 10)),
             ((52, 18), (52, 19))]:
    win(s, a, b)
window_edge(s, (47.2, 6.8), (48, 8)); window_edge(s, (26.8, 6.8), (26, 8))
window_edge(s, (44, 18), (45.4, 18)); window_edge(s, (45.4, 28), (44, 28))     # the alcoves' narrow windows (Q20's pane is broken)
window_edge(s, (28, 18.6), (28, 20)); window_edge(s, (28, 26), (28, 27.4))
win(s, (52, 27), (52, 28))
# the open volumes: the foyer's west end over the main doors, the chapel's apse
for a, b, f in [((28, 20), (26, 22), 'window'), ((26, 22), (26, 24), 'window'), ((26, 24), (28, 26), 'window')]: s.wall(a, b, flags=[f], material='ashlar')
for a, b in APSE: s.wall(a, b, flags=['window'] if (a, b) in (((55, 20), (56, 21)), ((56, 21), (56, 25)), ((56, 25), (55, 26))) else ['normal'], material='ashlar')
# Q19's south ends have fallen away: open to the weather, and the corridor between ends in air
for poly in ([(36, 33), (34, 32), (32, 33), (30, 32)], [(44, 32), (42, 33), (40, 32), (38, 33)]):
    for a, b in zip(poly, poly[1:]): ov(s, a, b, open_wall=True)
s.opening((36, 33), (38, 33))
finish(s)

s.prop('Q17-stair', 'spiral-stair', (29, 19), 'Q17', dims={'r': 4, 'rise': 20}); s.prop('Q17s-stair', 'spiral-stair', (29, 27), 'Q17-south', dims={'r': 4, 'rise': 20})
s.prop('Q14-stair2', 'spiral-stair', (51, 19), 'Q14-second', dims={'r': 4, 'rise': 20}); s.prop('Q14s-stair2', 'spiral-stair', (51, 27), 'Q14-secondsouth', dims={'r': 4, 'rise': 20})
for i, (x, z, r) in enumerate([(35.5, 18.6, 0), (38.5, 18.6, 0), (35.5, 27.4, 180), (38.5, 27.4, 180)]):
    s.prop(f'Q18-bust{i}', 'bust-pedestal', (x, z), 'Q18' if z < 23 else 'Q18-south', rotY=r, dims={'wood': 1})
s.prop('Q18-arms-n', 'weapons-wall', (31, 18.1), 'Q18', dims={'len': 2, 'y': 8}); s.prop('Q18-arms-n2', 'weapons-wall', (39.2, 18.1), 'Q18', dims={'len': 2, 'y': 8})
s.prop('Q18-arms-s', 'weapons-wall', (35, 27.9), 'Q18-south', rotY=180, dims={'len': 2, 'y': 8}); s.prop('Q18-arms-s2', 'weapons-wall', (30.8, 27.9), 'Q18-south', rotY=180, dims={'len': 2, 'y': 8})
s.prop('Q18-arms-n3', 'weapons-wall', (35, 18.1), 'Q18', dims={'len': 2, 'y': 8})
s.note('Q18-busts', (34, 19.2), 'Q18', 'The busts\' eyes seem to follow you along the balcony: an optical illusion.')
s.prop('Q20-curtain', 'drapes', (44.15, 27), 'Q20', rotY=90, dims={'w': 9, 'color': 0x7a1f2b}); s.prop('Q21-curtain', 'drapes', (44.15, 19), 'Q21', rotY=90, dims={'w': 9, 'color': 0x7a1f2b})
s.hidden('Q20-bust', 'bust-pedestal', (45.1, 27.1), 'Q20', 'Under the black cloth: the illusion of a random character\'s severed head (Strahd\'s doing); really an alabaster bust of Lord Argynvost. Breaking or covering the bust ends it', dims={'cloth': 1})
s.note('Q21-note', (45, 19), 'Q21', 'Part the curtain and leave: it is closed again when you return, unless taken off its rod.')
s.prop('Q22-tub', 'iron-tub', (41.6, 24.6), 'Q22')
s.prop('Q23-pool', 'water', (41.4, 21.6), 'Q23', dims={'w': 7, 'd': 7})
s.prop('Q23-shelves', 'bare-shelves', (40.3, 21.6), 'Q23', rotY=90, dims={'w': 6})
s.obj('Q23-floor', 'pressure-plate', (41.8, 21.6), 'trap', 'Q23', 'Spongy floor: more than 100 lb and it gives way, a 20-ft fall into the dining hall (Q12)', dims={'w': 18, 'd': 14})
s.prop('Q24-throne', 'dragon-throne', (46.8, 23), 'Q24', rotY=90)
s.prop('Q24-chandelier', 'chandelier', (53.6, 23), 'Q24', dims={'y': 16})
s.obj('Q25-trap-w', 'pressure-plate', (33, 11), 'trap', 'Q25', 'Trap (T): a wall of stone seals the south opening and the phantom warriors of Q28 burst out', dims={'w': 10, 'd': 10})
s.obj('Q25-trap-e', 'pressure-plate', (41, 11), 'trap', 'Q25', 'Trap (T): a wall of stone seals the south opening and the phantom warriors of Q27 burst out', dims={'w': 10, 'd': 10})
s.note('Q25-wall', (37, 12.6), 'Q25', 'Where the wall of stone appears (10 minutes, then the trap resets). Detect magic: evocation before the doors.')
s.prop('Q26-bed1', 'four-poster-bed', (40.6, 13.3), 'Q26', rotY=90); s.prop('Q26-bed2', 'four-poster-bed', (40.6, 16.7), 'Q26', rotY=90)
s.prop('Q26-rug', 'rug', (40.6, 15), 'Q26', dims={'w': 10, 'd': 5}); s.prop('Q26-hearth', 'fireplace', (43.4, 15), 'Q26', rotY=-90)
s.creature('Q26-dragonet', 'smoke-dragonet', (43.2, 15), 'Q26', 'Smoky dragonet (smoke mephit stats): bursts from the hearth when someone comes within 10 ft; fights only in self-defence, otherwise flies to Q36 and vanishes on Vladimir\'s throne', size='small')
for i, (x, z, r) in enumerate([(44.6, 7.4, 30), (46.8, 9.4, 100), (44, 10.6, 160)]): s.prop(f'Q27-bunk{i}', 'bunk-bed', (x, z), 'Q27', rotY=r, dims={'broken': 1})
for i, (x, z) in enumerate([(43.4, 6.8), (46.2, 6.6), (47.6, 7.8), (47.6, 10.4)]): s.prop(f'Q27-stand{i}', 'armor-stand', (x, z), 'Q27')
for i, (x, z) in enumerate([(44.6, 8.6), (46, 8), (45.6, 10.4), (43.4, 9.4)]): s.creature(f'Q27-phantom{i}', 'phantom-warrior', (x, z), 'Q27', 'Phantom warrior: appears when the room is entered or the hall trap fires; fights until destroyed')
for i, (x, z, r) in enumerate([(29.4, 7.4, -30), (27.2, 9.4, -100), (30, 10.6, -160)]): s.prop(f'Q28-bunk{i}', 'bunk-bed', (x, z), 'Q28', rotY=r, dims={'broken': 1})
for i, (x, z) in enumerate([(27.6, 7.2), (30.6, 8.4)]): s.prop(f'Q28-stand{i}', 'armor-stand', (x, z), 'Q28', rotY=i * 70, dims={'fallen': 1})
s.prop('Q28-drapes', 'drapes', (29, 6.25), 'Q28', dims={'w': 8, 'color': 0x5a4632})
for i, (x, z) in enumerate([(28.4, 8.4), (29.8, 9.2), (28.6, 10.4)]): s.creature(f'Q28-phantom{i}', 'phantom-warrior', (x, z), 'Q28', 'Phantom warrior: appears when the room is entered or the hall trap fires; fights until destroyed')
s.hidden('Q28-coffer', 'chest', (27.4, 10.2), 'Q28', 'A small wooden coffer buried under the wreckage: four potions of invulnerability (found on a search)')
s.prop('Q28-wreck', 'wreckage', (27.6, 10.2), 'Q28', dims={'n': 8, 'seed': 24})
s.prop('Q29-hearth', 'fireplace', (30.6, 15), 'Q29', rotY=90); s.prop('Q29-portrait', 'portrait', (30.3, 15), 'Q29', rotY=90, dims={'y': 8.6, 'w': 3, 'h': 4, 'dusty': 1})
s.prop('Q29-bed', 'four-poster-bed', (34.4, 15), 'Q29', rotY=90); s.prop('Q29-wardrobe', 'wardrobe', (32.6, 12.4), 'Q29')
s.prop('Q29-chair', 'leather-chair', (31.9, 15), 'Q29', rotY=-90)
s.prop('Q29-drapes1', 'drapes', (30.25, 13.5), 'Q29', rotY=90, dims={'w': 4, 'color': 0x5a2a30}); s.prop('Q29-drapes2', 'drapes', (30.25, 16.5), 'Q29', rotY=90, dims={'w': 4, 'color': 0x5a2a30})
cobwebs(s, [(30, 12), (36, 12), (36, 18), (30, 18)], 'Q29', y=12, n=4)
for i, (k, x, z, sd) in enumerate([('Q19', 33, 30, 26), ('Q19-east', 41, 30, 28)]):
    s.prop(f'{k}-wreck', 'wreckage', (x, z), k, dims={'n': 9, 'seed': sd}); s.prop(f'{k}-rubble', 'rubble-heap', (x + 1, z + 1.6), k, dims={'r': 4, 'h': 2, 'seed': sd + 1})
s.prop('Q19-rafters', 'broken-rafters', (41, 31), 'Q19-east', dims={'n': 2, 'len': 14, 'h': 4, 'seed': 30})

# ================================================================== THIRD (40 ft)
t = Level('third', 'Third floor (Q30-Q42)', 40, 20, ambient='interior-dim', interior='plaster', exterior='ashlar', north='-z')
t.room('Q30', 'Curtained Staircase', TUR_NW, 'flagstone', page=pg('Q30'), ceilingFt=20)
t.room('Q30-south', 'Curtained Staircase (south)', TUR_SW, 'flagstone', page=pg('Q30'), ceilingFt=20)
t.room('Q33-hall', 'North Passage', rect(30, 18, 36, 20), 'plank', page=pg('Q33'), ceilingFt=20)
t.room('Q33', 'Collapsed Ceiling', [(36, 18), (44, 18), (44, 20), (40, 20), (40, 24), (38, 24), (38, 26), (36, 26)], 'plank', page=pg('Q33'), ceilingFt=20, difficult=True)
t.room('Q34', 'Ruined Bathroom', [(40, 20), (42, 20), (42, 26), (38, 26), (38, 24), (40, 24)], 'flagstone', page=pg('Q34'), ceilingFt=20)
t.room('Q35', 'Upstairs Gallery', rect(42, 20, 46, 26), 'plank', page=pg('Q35'), ceilingFt=20)
t.room('Q31', 'East Staircases', TUR_NE, 'flagstone', page=pg('Q31'), ceilingFt=20)
t.room('Q31-south', 'East Staircase (south)', TUR_SE, 'flagstone', page=pg('Q31'), ceilingFt=20)
t.room('Q36', "Dragon's Audience Hall", WEST_HALL, 'flagstone', page=pg('Q36'), ceilingFt=20)
t.room('Q32-hall', 'South Passage', [(30, 26), (44, 26), (44, 28), (38, 28), (38, 33), (36, 33), (36, 28), (30, 28)], 'plank', page=pg('Q32'), ceilingFt=20)
t.room('Q32', 'Ruined Bedchambers', [(30, 28), (36, 28), (36, 33), (34, 32), (32, 32.5), (30, 31.5)], 'plank', page=pg('Q32'), ceilingFt=20)
t.room('Q32-east', 'Ruined Bedchamber (east)', [(38, 28), (44, 28), (44, 31.5), (42, 32.5), (40, 32), (38, 33)], 'plank', page=pg('Q32'), ceilingFt=20)
t.room('Q37', 'Knights of the Order', [(32, 10), (36, 10), (36, 18), (30, 18), (30, 12), (32, 12)], 'plank', page=pg('Q37'), ceilingFt=20)
t.room('Q38', 'Closet', rect(36, 10, 38, 14), 'plank', page=pg('Q38'), ceilingFt=20)
t.room('Q41', "Dragon's Vault", rect(36, 14, 38, 18), 'flagstone', page=pg('Q41'), ceilingFt=20)
t.room('Q40', "Argynvost's Study", [(38, 10), (42, 10), (42, 12), (44, 12), (44, 18), (38, 18)], 'plank', page=pg('Q40'), ceilingFt=20)
t.room('Q39', "Vladimir's Bedroom", TOWER_W, 'plank', page=pg('Q39'), ceilingFt=20)
t.room('Q42', "Argynvost's Bedroom", TOWER_E, 'plank', page=pg('Q42'), ceilingFt=20)
t.room('Q14-third', 'Chapel Staircase (top room)', CH_N, 'flagstone', page=pg('Q14'), ceilingFt=20)
t.room('Q14-thirdsouth', 'Chapel Staircase (top room, south)', CH_S, 'flagstone', page=pg('Q14'), ceilingFt=20)
t.opening((30, 18), (30, 20)); t.opening((30, 26), (30, 28))                    # curtained arches from the stairs
t.secret((29, 20), (30, 20), 'Q30-Q36', 'A secret door at the head of the stair, pulled open into the audience hall', 'Q30')
t.secret((29, 26), (30, 26), 'Q30s-Q36', 'A secret door at the head of the south stair, pulled open into the audience hall', 'Q30-south')
t.opening((36, 18), (36, 20)); t.opening((36, 26), (38, 26))
t.opening((40, 20), (40, 24)); t.opening((38, 24), (40, 24))                    # the bathroom's corner fell in with the roof
t.opening((36, 20), (36, 24))                                                  # the audience hall's broken wall, heaped with rubble
t.opening((42, 22), (42, 24))                                                  # the curtained doorway, bathroom to gallery
t.door((44, 19), (44, 20), id='Q31-door'); t.door((44, 27), (44, 28), id='Q31s-door')
t.door((43, 20), (44, 20), id='Q35-door'); t.door((32, 18), (34, 18), id='Q37-doors'); t.door((40, 18), (42, 18), id='Q40-doors')
t.door((36, 12), (36, 13), id='Q38-door'); t.door((38, 16), (38, 17), id='Q41-iron-door', open=True)
t.door((32, 10), (32, 12), id='Q39-doors'); t.door((42, 10), (42, 12), id='Q42-doors')
t.door((36, 30), (36, 31), id='Q32-door'); t.door((38, 31), (38, 32), id='Q32-east-door')
win(t, (26, 22), (26, 24), 'Q36-west'); window_edge(t, (28, 20), (26, 22)); window_edge(t, (26, 24), (28, 26))
win(t, (46, 20), (46, 21)); win(t, (46, 22), (46, 24), 'Q35-morninglord'); win(t, (46, 25), (46, 26))
win(t, (50, 20), (52, 20), 'Q14-look'); win(t, (50, 26), (52, 26), 'Q14s-look')
for a, b in [((33, 10), (34, 10)), ((36, 10), (37, 10)), ((39, 10), (40, 10)), ((44, 12), (44, 13)), ((44, 17), (44, 18)),
             ((28, 6), (29, 6)), ((29, 6), (30, 6)), ((26, 8), (26, 9)), ((26, 9), (26, 10)), ((44, 6), (45, 6)), ((45, 6), (46, 6)), ((48, 8), (48, 9)), ((48, 9), (48, 10))]:
    win(t, a, b)
window_edge(t, (26.8, 6.8), (26, 8)); window_edge(t, (47.2, 6.8), (48, 8)); window_edge(t, (48, 10), (47.2, 11.2))
window_edge(t, (28, 18.6), (28, 20)); window_edge(t, (28, 26), (28, 27.4)); window_edge(t, (44, 18), (45.4, 18)); window_edge(t, (45.4, 28), (44, 28))
for a, b in [((46, 20), (50, 20)), ((50, 26), (46, 26))] + APSE: t.wall(a, b, flags=['window'] if a in ((55, 20), (56, 25)) else ['normal'], material='ashlar')
for poly in ([(36, 33), (34, 32), (32, 32.5), (30, 31.5)], [(44, 31.5), (42, 32.5), (40, 32), (38, 33)]):
    for a, b in zip(poly, poly[1:]): ov(t, a, b, open_wall=True)
t.opening((36, 33), (38, 33))
finish(t)

t.prop('Q30-curtain', 'drapes', (30.15, 19), 'Q30', rotY=90, dims={'w': 9, 'color': 0x141216}); t.prop('Q30s-curtain', 'drapes', (30.15, 27), 'Q30-south', rotY=90, dims={'w': 9, 'color': 0x141216})
t.prop('Q31-stair', 'spiral-stair', (45, 19), 'Q31', dims={'r': 4, 'rise': 20}); t.prop('Q31s-stair', 'spiral-stair', (45, 27), 'Q31-south', dims={'r': 4, 'rise': 20})
t.prop('Q33-rubble', 'rubble-heap', (38.4, 21.8), 'Q33', dims={'r': 9, 'h': 4, 'seed': 50}); t.prop('Q33-rubble2', 'rubble-heap', (36.8, 18.9), 'Q33', dims={'r': 4, 'h': 2, 'seed': 52})
t.prop('Q33-rafters', 'broken-rafters', (38, 22), 'Q33', dims={'n': 3, 'len': 22, 'h': 9, 'seed': 54}); t.prop('Q33-puddle', 'water', (41.6, 19), 'Q33', dims={'w': 8, 'd': 4})
t.note('Q33-sky', (38, 22.5), 'Q33', 'Open sky: the 20-ft hole in the roof (Q43) is directly overhead. Vladimir hears anyone crossing the rubble.')
t.prop('Q34-tub', 'iron-tub', (40.6, 25), 'Q34', dims={'debris': 1}); t.prop('Q34-curtain', 'drapes', (41.85, 23), 'Q34', rotY=-90, dims={'w': 9, 'color': 0x5a4632})
t.prop('Q35-mural', 'tapestry', (44, 20.15), 'Q35', dims={'w': 7})
t.prop('Q36-throne', 'dragon-throne', (29.2, 23), 'Q36', rotY=-90, dims={'wings': 1, 'dragon': 1})
t.creature('Q36-vladimir', 'vladimir-horngaard', (28.4, 23), 'Q36', 'Vladimir Horngaard, revenant commander of the fallen Order, slumped in the throne with a +2 greatsword (a corpse if the beacon is lit)')
for i, (x, z) in enumerate([(27.6, 21.2), (27.6, 24.8), (30.4, 21), (30.4, 25), (32.4, 22), (32.4, 24)]):
    t.creature(f'Q36-phantom{i}', 'phantom-warrior', (x, z), 'Q36', 'Phantom warrior: one of six that appear the first time Vladimir takes damage')
t.prop('Q36-rubble', 'rubble-heap', (34.6, 21.6), 'Q36', dims={'r': 6, 'h': 3, 'seed': 56})
t.prop('Q36-arms-n', 'weapons-wall', (32.6, 20.6), 'Q36', dims={'len': 14, 'fallen': 1, 'rusted': 1}); t.prop('Q36-arms-s', 'weapons-wall', (32.6, 25.2), 'Q36', rotY=180, dims={'len': 14, 'fallen': 1, 'rusted': 1})
t.prop('Q37-table', 'table', (33.2, 14.4), 'Q37', rotY=90, dims={'w': 15, 'd': 5, 'h': 2.8})
for i, (x, z, r) in enumerate([(32.2, 13, 90), (32.2, 14.4, 90), (32.2, 15.8, 90), (34.2, 13, -90), (34.2, 14.4, -90), (34.2, 15.8, -90)]):
    t.prop(f'Q37-chair{i}', 'wing-chair', (x, z), 'Q37', rotY=r, dims={'dragon': 1})
for i, (x, z) in enumerate([(32.5, 13), (32.5, 14.4), (32.5, 15.8), (33.9, 13), (33.9, 15.8)]):
    t.creature(f'Q37-revenant{i}', 'revenant', (x, z), 'Q37', 'Sir Godfrey Gwilym, revenant paladin (CR 6, spells DC 15); may aid the party' if i == 1 else 'Revenant of the Order (LE), waiting on Vladimir\'s orders; fights only in self-defence')
t.prop('Q37-chandelier', 'chandelier', (33.2, 14.4), 'Q37', dims={'y': 13})
for i, (x, z, r, c) in enumerate([(34.6, 10.2, 0, 0), (35.8, 15.6, -90, 1), (33.2, 17.8, 180, 2), (30.2, 12.8, 90, 1), (35.8, 11.6, -90, 2)]):
    t.prop(f'Q37-banner{i}', 'banner', (x, z), 'Q37', rotY=r, dims={'y': 12, 'c': c})
t.prop('Q37-hearth', 'fireplace', (30.6, 15), 'Q37', rotY=90); t.prop('Q37-patch', 'shield-patch', (30.25, 15), 'Q37', rotY=90, dims={'y': 9})
cobwebs(t, [(32, 10), (36, 10), (36, 18), (30, 18)], 'Q37', y=13, n=4)
t.prop('Q39-bed', 'four-poster-bed', (29, 9), 'Q39'); t.prop('Q39-bear', 'stuffed-bear', (30.8, 8.7), 'Q39', rotY=-90)
t.prop('Q39-wolf', 'stuffed-wolf', (30.9, 11.1), 'Q39', rotY=180, dims={}); t.prop('Q39-chest', 'chest', (28.7, 11.2), 'Q39')
t.prop('Q40-shelves1', 'bare-shelves', (40, 10.45), 'Q40', dims={'w': 8}); t.prop('Q40-shelves2', 'bare-shelves', (38.45, 13.4), 'Q40', rotY=90, dims={'w': 8})
t.prop('Q40-shelves3', 'bare-shelves', (41, 17.55), 'Q40', rotY=180, dims={'w': 6})
t.prop('Q40-hearth', 'fireplace', (43.4, 15), 'Q40', rotY=-90); t.prop('Q40-picture', 'portrait', (43.75, 15), 'Q40', rotY=-90, dims={'y': 8.8, 'w': 5, 'h': 3.4, 'landscape': 1, 'dusty': 1})
t.prop('Q40-chair', 'leather-chair', (41.8, 15.6), 'Q40', rotY=-60, dims={'tipped': 1})
t.hidden('Q40-book', 'niche', (41.4, 16.4), 'Q40', 'The Oath Celestial, burned and slashed, behind the overturned chair: a devotional for knights of the Holy Empire of Valentia')
t.note('Q40-page', (40.6, 14), 'Q40', 'Crossing the room: a flutter of wings, and the last page of Argynvost\'s journal drifts down (appendix F). Mending the slashed picture shows a silver dragon asking for its skull.')
t.prop('Q41-chest1', 'chest', (37, 15), 'Q41', rotY=90); t.prop('Q41-chest2', 'trunk', (37, 17), 'Q41', rotY=70); t.prop('Q41-shards', 'rubble', (37, 16), 'Q41', dims={'n': 5})
t.prop('Q42-drapes1', 'drapes', (45, 6.25), 'Q42', dims={'w': 8, 'color': 0x6a1e26}); t.prop('Q42-drapes2', 'drapes', (47.75, 9), 'Q42', rotY=-90, dims={'w': 8, 'color': 0x6a1e26})
t.note('Q42-window', (47, 10.8), 'Q42', 'The south-east window: where the apparition seen from the cemetery stands.')
for k, sd in (('Q32', 60), ('Q32-east', 62)):
    x = 33 if k == 'Q32' else 41
    t.prop(f'{k}-rubble', 'rubble-heap', (x, 30), k, dims={'r': 5, 'h': 2.4, 'seed': sd}); t.prop(f'{k}-rafters', 'broken-rafters', (x, 30.6), k, dims={'n': 2, 'len': 14, 'h': 6, 'seed': sd + 1})
t.prop('Q14-room', 'cobweb', (50.7, 18.7), 'Q14-third', dims={'s': 2, 'y': 8})

# ================================================================== ROOF (60 ft)
r = Level('roof', 'Rooftop (Q43-Q50)', 60, 20, ambient='fog', interior='ashlar', exterior='ashlar', north='-z')
r.room('Q45', 'Ancient Ballista', TOWER_W, 'flagstone', page=pg('Q45'))
r.room('Q45-east', 'Ancient Ballista (east tower)', TOWER_E, 'flagstone', page=pg('Q45'))
r.room('Q44', 'Dragon Gargoyle', [(32, 10), (42, 10), (42, 12), (44, 12), (44, 14), (30, 14), (30, 12), (32, 12)], 'flagstone', page=pg('Q44'))
r.room('Q46', 'Destroyed Ballista', [(30, 14), (34, 14), (34, 30), (30, 30), (30, 26), (28, 26), (26, 24), (26, 22), (28, 20), (30, 20)], 'flagstone', page=pg('Q46'))
r.room('Q43', 'Hole in Roof', [(34, 14), (40, 14), (40, 20), (36, 20), (36, 25), (40, 25), (40, 30), (34, 30)], 'cobble', page=pg('Q43'), difficult=True)
r.room('Q44-east', 'Roof Parapet (east)', [(40, 14), (44, 14), (44, 20), (46, 20), (46, 26), (44, 26), (44, 30), (40, 30)], 'flagstone', page=pg('Q44'))
r.room('Q48', "Roof's Edge", [(30, 30), (44, 30), (44, 31.5), (42, 32.5), (39, 31.6), (36, 33), (33, 32.2), (30, 33)], 'flagstone', page=pg('Q48'))
r.room('Q47', 'Roof Turrets', TUR_NW, 'plank', page=pg('Q47'), ceilingFt=10)
r.room('Q47-south', 'Roof Turret (south)', TUR_SW, 'plank', page=pg('Q47'), ceilingFt=10)
r.room('Q31-roof', 'East Staircase (roof)', TUR_NE, 'flagstone', page=pg('Q31'), ceilingFt=10)
r.room('Q31-roofsouth', 'East Staircase (roof, south)', TUR_SE, 'flagstone', page=pg('Q31'), ceilingFt=10)
r.room('Q49', 'Beacon Tower Door', rect(46, 22, 50, 24), 'flagstone', page=pg('Q49'))
r.room('Q50', 'Beacon, Lower Landing', LANDING, 'plank', page=pg('Q50'), ceilingFt=20)
r.room('Q52-northpost', "Beacon Turret (archers' post)", CH_N, 'flagstone', page=pg('Q52'), ceilingFt=20)
r.room('Q52-southpost', "Beacon Turret (archers' post, south)", CH_S, 'flagstone', page=pg('Q52'), ceilingFt=20)
for poly in (TUR_NW, TUR_SW, TUR_NE, TUR_SE): edges_of(r, poly, heightFt=10)
r.door((30, 18), (30, 19), id='Q47-door'); r.door((30, 27), (30, 28), id='Q47s-door')
r.door((44, 18), (44, 19), id='Q31r-door'); r.door((44, 27), (44, 28), id='Q31rs-door')
r.door((50, 22), (50, 24), id='Q49-tower-door', locked=True)
for a, b in (((30, 18), (30, 19)), ((30, 27), (30, 28)), ((44, 18), (44, 19)), ((44, 27), (44, 28))): ov(r, a, b, heightFt=10)
r.opening((32, 11), (32, 12)); r.opening((42, 11), (42, 12))                    # steps up onto the tower tops
for a, b in [((40, 20), (36, 20)), ((36, 20), (36, 25)), ((36, 25), (40, 25)), ((40, 20), (40, 25))]: r.opening(a, b)   # the hole
for a, b in [((44, 31.5), (42, 32.5)), ((42, 32.5), (39, 31.6)), ((39, 31.6), (36, 33)), ((36, 33), (33, 32.2)), ((33, 32.2), (30, 33))]: ov(r, a, b, open_wall=True)
# the beacon tower's landing: a rail round the shaft, the stair zone open, the outer walls the tower's own
for a, b in [((54, 22), (52, 22)), ((52, 22), (52, 24)), ((52, 24), (54, 24))]: low(r, a, b, 3.5, 'paneling')
r.opening((54, 20), (54, 22)); r.opening((54, 24), (54, 26))
win(r, (52, 20), (54, 20), 'Q50-n'); win(r, (52, 26), (54, 26), 'Q50-s')
for a, b in [((54, 20), (56, 22)), ((56, 22), (56, 24)), ((56, 24), (54, 26))]: r.wall(a, b, material='ashlar')
for poly, sl in ((CH_N, [((50, 18.6), (50.6, 18)), ((50.6, 18), (52, 18)), ((52, 18), (52, 20))]), (CH_S, [((50, 27.4), (50.6, 28)), ((50.6, 28), (52, 28)), ((52, 26), (52, 28))])):
    for a, b in sl: win(r, a, b) if a[0] == b[0] else window_edge(r, a, b)
for poly in (TUR_NW, TUR_SW): window_edge(r, *([(28, 18.6), (28, 20)] if poly is TUR_NW else [(28, 26), (28, 27.4)]))
window_edge(r, (28.6, 18), (30, 18)); window_edge(r, (30, 28), (28.6, 28))
finish(r, parapet=('Q44', 'Q44-east', 'Q45', 'Q45-east', 'Q46', 'Q48', 'Q49', 'Q43'))

r.prop('Q45-ballista', 'ballista', (29, 8.8), 'Q45', rotY=135); r.prop('Q45e-ballista', 'ballista', (45, 8.8), 'Q45-east', rotY=45)
r.prop('Q45-crenels', 'crenel-ring', (29, 9), 'Q45', dims={'r': 15.4, 'a0': 0, 'a1': 270, 'n': 14})
r.prop('Q45e-crenels', 'crenel-ring', (45, 9), 'Q45-east', dims={'r': 15.4, 'a0': -90, 'a1': 180, 'n': 14})
r.prop('Q44-gargoyle', 'wyrmling-statue', (37, 14.9), 'Q44', rotY=90, dims={'y': 8, 's': 1.3})
r.prop('Q44-crenels', 'crenels', (37, 10), 'Q44', dims={'len': 50})
r.prop('Q46-wreck', 'ballista', (29.4, 23), 'Q46', dims={'broken': 1})
r.prop('Q46-crenels-w', 'crenels', (26, 23), 'Q46', rotY=90, dims={'len': 10}); r.prop('Q46-crenels-nw', 'crenels', (27, 21), 'Q46', rotY=45, dims={'len': 14})
r.prop('Q46-crenels-sw', 'crenels', (27, 25), 'Q46', rotY=-45, dims={'len': 14})
r.prop('Q46-crenels-a', 'crenels', (30, 16), 'Q46', rotY=90, dims={'len': 20}); r.prop('Q46-crenels-b', 'crenels', (30, 29), 'Q46', rotY=90, dims={'len': 5})
r.prop('Q44e-crenels', 'crenels', (44, 16), 'Q44-east', rotY=90, dims={'len': 20})
for k, (x, z) in (('Q47', (29, 19)), ('Q47-south', (29, 27)), ('Q31-roof', (45, 19)), ('Q31-roofsouth', (45, 27))):
    r.prop(f'{k}-cone', 'tower-roof', (x, z), k, dims={'r': 5.4, 'h': 9, 'y': 10})
for k, z in (('Q47', 19), ('Q47-south', 27)):
    r.prop(f'{k}-bench', 'bench', (28.9, z - 0.55 if z == 19 else z + 0.55), k, dims={'l': 5}); r.prop(f'{k}-stove', 'stove', (29.4, z + 0.45 if z == 19 else z - 0.45), k)
    r.prop(f'{k}-web', 'cobweb', (29.6, z - 0.6 if z == 19 else z + 0.6), k, dims={'s': 2.4, 'y': 8})
r.prop('Q43-ridge-n', 'roof-gable', (37, 17), 'Q43', dims={'w': 30, 'd': 30, 'h': 6, 'y': 0})
r.prop('Q43-ridge-s', 'roof-gable', (37, 27.5), 'Q43', dims={'w': 30, 'd': 25, 'h': 6, 'y': 0})
r.prop('Q43-rubble', 'rubble-heap', (35, 22.5), 'Q43', dims={'r': 5, 'h': 2, 'seed': 70}); r.prop('Q43-rubble2', 'rubble-heap', (41.2, 21.6), 'Q44-east', dims={'r': 4, 'h': 1.6, 'seed': 72})
r.prop('Q43-rafters', 'broken-rafters', (38, 22.5), 'Q43', dims={'n': 2, 'len': 26, 'h': 1, 'seed': 74})
r.prop('Q48-rafters', 'broken-rafters', (37, 32.4), 'Q48', dims={'n': 3, 'len': 18, 'h': 1, 'seed': 76}); r.prop('Q48-rubble', 'rubble-heap', (33.6, 31.2), 'Q48', dims={'r': 4, 'h': 1.6, 'seed': 78})
r.note('Q48-drop', (37, 33.6), 'Q48', 'Sixty feet straight down to the rubble: 20 ft to Q32, 40 ft to Q19, 60 ft to Q4.')
r.prop('Q49-roof-n', 'roof-gable', (48, 21), 'Q49', dims={'w': 20, 'd': 10, 'h': 4, 'y': 0}); r.prop('Q49-roof-s', 'roof-gable', (48, 25), 'Q49', dims={'w': 20, 'd': 10, 'h': 4, 'y': 0})
r.note('Q49-bar', (49.4, 23), 'Q49', 'Barred from inside. Forcing it draws arrows from the phantom archers in the turrets (Q52), who have three-quarters cover.')
r.prop('Q50-stair', 'stair-flight', (55, 23), 'Q50', rotY=90, dims={'len': 20, 'w': 4, 'rise': 20, 'wood': 1})
r.note('Q50-shaft', (53, 23), 'Q50', 'The open shaft: the chapel floor is 60 ft below.')
for k, z in (('Q52-northpost', 19), ('Q52-southpost', 27)):
    r.prop(f'{k}-stair', 'spiral-stair', (51, z), k, dims={'r': 4, 'rise': 20})
    r.creature(f'{k}-archer', 'phantom-warrior', (51.2, z + (0.3 if z == 19 else -0.3)), k, 'Phantom warrior archer: spectral longbow (+2, 150/600 ft, 1d8 force), two attacks; shoots through the slits at anyone forcing the tower door', size='medium')
    r.objects[-1]['dims'] = {'bow': 1}
for i, p in enumerate(CHIMNEYS):
    prism(r, f'chimney-top{i}', p, 7, STONE)
    cx = sum(x for x, _ in p) / 4; cz = sum(z for _, z in p) / 4
    r.prop(f'chimney-pot{i}', 'chimney', (cx, cz), None, dims={'h': 2.5, 'y': 7})

# ================================================================== BEACON (80 ft)
b = Level('beacon', 'Beacon tower (Q51, Q52)', 80, 20, ambient='fog', interior='ashlar', exterior='ashlar', north='-z')
b.room('Q51', 'Beacon, Upper Landing', LANDING, 'plank', page=pg('Q51'), ceilingFt=20)
b.room('Q52', 'Beacon Turrets', [(50, 18.6), (50.6, 18), (52, 18), (52, 20), (50, 22)], 'flagstone', page=pg('Q52'))
b.room('Q52-south', 'Beacon Turret (south)', [(50, 24), (52, 26), (52, 28), (50.6, 28), (50, 27.4)], 'flagstone', page=pg('Q52'))
door_edge(b, (50, 22), (52, 20), 'Q51-door-n'); door_edge(b, (52, 26), (50, 24), 'Q51-door-s')
win(b, (50, 22), (50, 24), 'Q51-windows')
for a, b_ in [((54, 22), (52, 22)), ((52, 22), (52, 24)), ((52, 24), (54, 24))]: low(b, a, b_, 3.5, 'paneling')
b.opening((54, 20), (54, 22)); b.opening((54, 24), (54, 26))
for a, b_ in [((54, 20), (56, 22)), ((56, 22), (56, 24)), ((56, 24), (54, 26))]: b.wall(a, b_, material='ashlar')
finish(b, parapet=('Q52', 'Q52-south'))
b.prop('Q51-stair', 'stair-flight', (55, 23), 'Q51', rotY=-90, dims={'len': 20, 'w': 4, 'rise': 20, 'wood': 1})
b.obj('Q51-trap', 'pressure-plate', (53, 21), 'trap', 'Q51', 'Weak section (T): collapses under 50 lb or more; DC 15 Dex or fall 20 ft to Q50, leaving a 10-ft gap', dims={'w': 10, 'd': 10})
b.prop('Q52-crenels', 'crenel-ring', (51, 19), 'Q52', dims={'r': 5.6, 'a0': 0, 'a1': 200, 'n': 6})
b.prop('Q52s-crenels', 'crenel-ring', (51, 27), 'Q52-south', dims={'r': 5.6, 'a0': 160, 'a1': 360, 'n': 6})

# ================================================================== PEAK (100 ft)
p = Level('peak', 'Beacon peak (Q53)', 100, 16, ambient='fog', interior='ashlar', exterior='ashlar', north='-z')
PEAK = [(52, 20), (54, 20), (56, 22), (56, 23), (54, 23), (54, 26), (52, 26), (50, 24), (50, 22)]
p.room('Q53', 'Beacon of Argynvostholt', PEAK, 'flagstone', page=pg('Q53'), ceilingFt=30)
edges_of(p, PEAK, heightFt=14)
for a, b_ in [((56, 23), (54, 23)), ((54, 23), (54, 26))]: low(p, a, b_, 3.5, 'paneling')
win(p, (52, 20), (54, 20), 'Q53-n'); win(p, (50, 22), (50, 24), 'Q53-w'); win(p, (52, 26), (54, 26), 'Q53-s'); win(p, (56, 22), (56, 23))
for a, b_ in (((54, 20), (56, 22)), ((50, 22), (52, 20)), ((52, 26), (50, 24))): window_edge(p, a, b_)
p.wall((56, 23), (56, 24), heightFt=14, material='ashlar'); p.wall((56, 24), (54, 26), flags=['window'], heightFt=14, material='ashlar')
finish(p)
p.prop('Q53-rafters', 'rafters-ravens', (53, 23), 'Q53', dims={'y': 13, 'w': 28, 'n': 11})
p.prop('Q53-roof', 'tower-roof', (53, 23), 'Q53', dims={'r': 16, 'h': 12.5, 'y': 14})
p.hidden('Q53-sill', 'niche', (50.5, 23), 'Q53', 'The west windowsill: where a treasure rests if the card reading places it here')
p.note('Q53-beacon', (53, 21.6), 'Q53', 'When the skull is sealed in the mausoleum (Q16), the dragon\'s spirit becomes a light that fills this room and flashes across the valley.')

# ================================================================== descriptions (our own words)
DESC = {
  'Q1': ("In the middle of the carriage circle a mossy stone dragon sits on a great granite block, wings folded, staring at the house; much of its spiked crest has cracked away.",
         "Silver dragon statue; detect magic shows a weak evocation aura (a spent cold-breath trap). Climbing the entrance steps (Q2) makes it exhale a harmless 60-ft cone of chill air, once per dawn."),
  'Q2': ("Broad steps between stone balustrades lead up to the great double doors, iron-strapped and rust-streaked, their knockers cast as little dragons. The house's name is cut into the stone above.",
         "Unlocked; they push open on the dark foyer (Q3). Treading the steps sets off the statue's breath (Q1)."),
  'Q3': ("A hushed, tomb-like hall. A grand stair rises to stone galleries on pillars and arches, under a ragged tapestry of a lord in silver armour. White busts stand on marble plinths; a fourth lies in pieces on the mosaic floor. Two black iron chandeliers hang overhead like spiders.",
         "Six sets of double doors. The tapestry is Lord Argynvost (worthless); the busts are the dragon's other human guises. First time through, a winged shadow crosses the walls with a soft hiss (harmless). The stair reaches the balconies (Q18) 20 ft up."),
  'Q4': ("A great ballroom with a pink marble floor, half buried under the rooms that fell into it. Toppled chandeliers and broken chairs lie in the rubble; webs hang in sheets across the hall, and something moves in them.",
         "Nine giant spiders nest here and attack anyone who comes too near. If anyone walks the creaking floor of Q19 above, they climb up after them."),
  'Q5': ("Only a stone footing and charred timbers remain of the stable. Above it, the mansion's fallen south end shows all three floors open to wind and rain.", "Nothing of value."),
  'Q6': ("A wood-panelled den torn apart: rotten divans, broken chairs, upturned footstools and smashed lamps. A cold hearth fills the west wall between narrow windows; a black wooden sarcophagus with a carved queen stands on end by the north wall.",
         "The sarcophagus was the dragon's wine cabinet (only broken glass remains). Secret door at the north end of the east wall to Q11. Unless the beacon is lit, a fire-dragon flares in the hearth on first approach (see note)."),
  'Q7': ("Moth-eaten velvet hangs at the narrow windows all round this parlor. Furniture lies tumbled under dust and webs; a bent brass chandelier hangs beneath a faded painted sky of gleaming dragons and bright birds.", "Nothing of value."),
  'Q8': ("A tall arch in the north front is shut by an iron gate, chained and padlocked. Inside, stone steps climb left and right to doors.",
         "Pick the lock (DC 20, thieves' tools) or smash it (DC 15 Str with a bludgeoning or slashing weapon). The flights rise 10 ft to landings with doors to Q7 and Q9."),
  'Q9': ("Six or so smashed cots and other broken furniture litter this round room; ragged brown curtains hang at the windows and across an arch to the south.", "The household staff slept here. Nothing of value; the curtain opens on the kitchen (Q10)."),
  'Q10': ("Looters have been through this kitchen: tables on their sides, rusty tools and shards of pottery underfoot. In the black hearth between two slit windows, an iron pot jiggles and clanks on its hook.",
          "An ordinary bat is trapped in the pot and bursts out when someone comes close."),
  'Q11': ("Damp and dark; old barrels rest on timber cradles against the walls.",
          "Five barrels. Savid, a dusk elf scout with 4 hp left, hides behind them; he wants healing, was searching for the missing Vistani girl Arabelle when needle blights drove him in, and tells what he knows of Argynvost and the Order. The barrels (Wizard of Wines, long dry) hide nothing. Secret door at the north end of the west wall to Q6."),
  'Q12': ("Chairs carved with folded wings stand, lie or lie broken round a long table held up by carved dragons. Soft white light falls from a crystal chandelier; two stone knights wait in window bays; rain seeps down the west wall into a pool. To the east, cracked glass doors hang open on a foggy chapel.",
          "The chandelier carries a continual flame. The statues are only stone. Five sets of doors; the pair from the foyer's north-east corner hangs open. Stained glass of flying silver dragons flanks the glass doors."),
  'Q13': ("A gallery of dark timber runs round three sides of this stone chapel on split wooden posts. Iron candle stands flank a sunrise-carved altar at the east end under tall stained windows, one of them smashed so that fog rolls in over the coloured shards. A beam holds the north door shut.",
          "Beacon unlit: three revenants (chain as leather; two longsword attacks of 15 (2d10+4)) kneel at the altar and attack on sight; lit, three armoured corpses. DC 10 Religion: a dawn god, the Morninglord. The hollow beacon tower rises over the altar (Q50 at 60 ft, Q51 at 80 ft). The bar lifts easily; steps beyond lead down to the cemetery."),
  'Q14': ("A tight spiral stair, dimly lit through slits in the wall.", "From the chapel up 20 ft to the balcony (Q24), then 20 ft more to a small empty room with a window over the chapel."),
  'Q15': ("Graves crowd the fog behind the house inside a tall wrought-iron fence; a mausoleum stands in the far corner.",
          "Beacon unlit, first crossing: a well-dressed man with a great mane of pale, wispy hair watches from a high window (Q42) and draws the curtain (an apparition). DC 10 Perception: five graves were dug open from below; the fence is unbroken. On the revenant table, a 12 rises here."),
  'Q15-steps': ("Stone steps wind up round the outside of a turret to a flagged landing before a stout door.", "Barred from the chapel side (Q13)."),
  'Q16': ("A small tomb-house under stone tiles, tarnished silver dragonets crouched on its roof. A tall door of white marble on the south-west face bears the name ARGYNVOST; inside, four empty raised niches and lines of Draconic on the far wall.",
          "Pull the door open with DC 15 Str. The writing names this as the resting place of Argynvost's bones and treasure. Seal the dragon's skull (Castle Ravenloft, K67) inside to light the beacon (Q53)."),
  'Q17': ("A narrow, dusty spiral stair, lit through slit windows.", "Joins the balconies (Q18) to Q30 and Q36 on the third floor."),
  'Q18': ("Galleries look down into the foyer over railings whose balusters are little stone knights. Old arms hang on the walls, and white busts on wooden stands guard the passages north and south.",
          "20 ft over the foyer. The arms are ordinary. The busts seem to watch you pass (an optical trick). Each balcony's west end opens on a spiral stair up (Q17)."),
  'Q18-hall': ("A hall wrapping round a bath and a store room, curtained alcoves in its corners, doors on to the chapel balcony.", None),
  'Q19': ("Half of this bedroom is gone: its south side has dropped away into fog. Splintered furniture lies under plaster and beams, and every board creaks.",
          "Safe to walk on, but the creaking brings the giant spiders up from the ballroom (Q4) 20 ft below. There are two such rooms."),
  'Q19-east': ("Half of this bedroom is gone: its south side has dropped away into fog. Splintered furniture lies under plaster and beams, and every board creaks.", "As the west room: the noise draws the spiders from Q4."),
  'Q19-hall': ("A corridor ending in splintered boards and fog.", None),
  'Q20': ("In the hall's south-east corner a red velvet curtain closes off an alcove; it sways a little.",
          "A cracked pane behind it moves the curtain. Under a black cloth on a white marble pedestal lies what looks like the severed head of a random character: an illusion from Strahd's consciousness, too strong to disbelieve, ended by breaking or covering the bust. It is an alabaster bust of Lord Argynvost."),
  'Q21': ("In the hall's north-east corner, red velvet drapes close off a small alcove.", "Nothing but narrow windows. Leave it open and it is drawn shut when you come back, until the curtain is taken off its rod."),
  'Q22': ("An iron bathtub; wood panelling to waist height, and above it a faded painting of mountains running all round the room.", "The mural is an accurate view of the Balinok Mountains."),
  'Q23': ("Empty stone shelving; water drips from the ceiling into a wide pool on the sagging boards.", "Looted. The soft floor bears 100 lb at most; any more and it collapses into the dining hall (Q12), a 20-ft fall."),
  'Q24': ("A timber gallery hangs over the chapel. At its west end an ornate wooden throne sits between two doors; slim arches open on spiral stairs, and from high above hangs an iron chandelier whose candle cups are little silver dragons.",
          "20 ft above the chapel floor. The doors behind the throne lead to Q20 and Q21."),
  'Q25': ("A lofty passage shaped like a T; three arched windows in its north wall show only fog.",
          "Ceiling 20 ft. The doors to Q27 and Q28 are locked (DC 20 Str). The squares before them (T) are trapped: a wall of stone closes the south opening and the phantom warriors of both rooms charge out. Evocation under detect magic; resets after 10 minutes."),
  'Q26': ("Through the open door: a pair of canopied beds with their hangings in shreds, a worn rug, and a sooty hearth from which comes a faint hiss.",
          "Within 10 ft of the hearth a little dragon of ash and smoke bursts out (smoke mephit; fights only in self-defence). Left alone it flies up the west stair, through the curtain of Q30, over the rubble of Q33, and vanishes on the back of Vladimir's throne (Q36)."),
  'Q27': ("Broken bunks fill this barrack room. Grime dims its five windows; empty armour stands and bare torch brackets stand between them.", "Four phantom warriors appear when the room is entered or the hall trap fires, and fight until destroyed."),
  'Q28': ("A round barrack room of faded hangings and bare torch brackets, its bunks and armour stands knocked flat.", "Three phantom warriors, as Q27. Searching the wreckage turns up a small wooden coffer with four potions of invulnerability."),
  'Q29': ("Cobwebs drape everything. A black marble fireplace stands between curtained windows beneath the portrait of a handsome gentleman with a knowing smile and a mane of pale, wispy hair. Facing it: a bed with dragon-carved posts, a wardrobe standing open and empty, and a stuffed leather armchair turned to the hearth.",
          "The portrait shows the silver dragon in his guise as Lord Argynvost."),
  'Q30': ("A ragged black curtain hangs across an arch; behind it, a spiral stair winds down.", "The stair descends to Q17. A secret door at its head pulls open into the audience hall (Q36)."),
  'Q31': ("Behind an arched wooden door, a spiral stair climbs past slit windows.", "Climbs from the third floor to the roof."),
  'Q32': ("The boards end in fog where the south side of this room has fallen away; rubble lies everywhere and the roof overhead is torn open.", "40 ft above the ballroom (Q4); the broken roof is 20 ft up. Two such rooms face each other across a ruined corridor."),
  'Q32-east': ("The boards end in fog where the south side of this room has fallen away; rubble lies everywhere and the roof overhead is torn open.", "As the west room."),
  'Q32-hall': ("A passage along the south side of the floor; its branch between the ruined rooms ends in nothing.", None),
  'Q33': ("Here the roof has fallen in. Through a great ragged gap, crossed by snapped rafters, dark clouds drift past; below it, stone, slates and timbers lie heaped on a sagging floor among rain puddles.",
          "Ceiling 20 ft; the hole is 20 ft across. The rubble is difficult terrain, and Vladimir (Q36) hears anyone crossing it: he can't be surprised by them."),
  'Q33-hall': ("A dusty passage running from the curtained stair to the rubble.", None),
  'Q34': ("Rubble from the caved-in roof fills the iron tub of this tiled bathroom; a ripped curtain hangs across the doorway east.", None),
  'Q35': ("Dark wainscot below, painted saints at worship above. A tattered curtain hangs in the west doorway; opposite, three tall, narrow windows of stained glass show robed figures haloed by rising suns.",
          "North to south the windows show Saint Andral, the Morninglord and Saint Markovia."),
  'Q36': ("A long hall, one wall broken into a slope of rubble, rusted arms scattered where they dropped from the walls. A great wooden throne, a dragon spreading its wings, looks out of three tall west windows; in it slumps a gaunt figure in armour, one hand closed on a greatsword's hilt.",
          "50 by 30 ft. Vladimir Horngaard (revenant; +2 greatsword; platinum holy symbol of the Morninglord, 250 gp, under his half plate). A lifeless corpse once the beacon is lit. Otherwise he tells you to go away, then warns that he hates Strahd above all yet will destroy anyone who tries to end Strahd's torment. He fights in self-defence or if pressed; the first time he is hurt, six phantom warriors appear. The text puts the crumbled wall on the west; the map draws the breach and rubble toward Q33."),
  'Q37': ("Old campaign banners hang limp and grey with dust. Round a massive table under an iron chandelier stand six tall chairs topped with wooden dragons, and in five of them sit dead knights in rotting mail.",
          "Beacon unlit: five revenants (LE) awaiting Vladimir's orders, fighting only in self-defence; one demands to know why the living disturb them. Sir Godfrey Gwilym (CR 6, paladin spells, DC 15) can tell the Order's history. A shield-shaped patch above the mantel: the shield is in Castle Ravenloft's treasury (K41)."),
  'Q38': ("An empty, dusty closet lit by a single narrow window to the north.", None),
  'Q39': ("A dusty bed with dragon-carved posts stands in the middle of this round room under five cracked windows. By the double doors a bear rears up, claws out, opposite a snarling giant wolf; an empty chest lies open nearby.",
          "Vladimir and Godfrey's bedchamber. The animals are stuffed; the chest was looted long ago."),
  'Q40': ("Thick dust. Three slit windows light empty oak shelving, an upholstered chair tipped over by a huge fireplace, and above the mantel a painting cut through, its lower half dangling. An iron door in the west wall's south corner sags on one hinge.",
          "Only one book was left: The Oath Celestial, burned and slashed, behind the chair. Crossing the room, the last page of Argynvost's journal drifts down (appendix F). The picture shows the mansion in winter with the chapel tower shining; mend it and a spectral silver dragon asks for its skull to be returned to its crypt."),
  'Q41': ("Lead sheets line the walls of this strongroom; its chests stand empty and its vases lie broken. The forced iron door hangs on one rusted hinge.", "Stripped of its treasure long ago."),
  'Q42': ("Faded heavy curtains cover the windows; the room is bare.", "Argynvost slept in dragon form, so there is no furniture. The apparition seen from the cemetery stands at the south-east window."),
  'Q43': ("A hole twenty feet across gapes in the sloping roof of cracked stone tiles, ringed with rubble; the floor of Q33 is twenty feet below.",
          "The rubble is difficult terrain. Climbing the tiles takes DC 10 Athletics; failing by 5 or more slides you down to the parapet, prone but unhurt."),
  'Q44': ("Up on the roof slope, a young dragon in tarnished silver plate keeps watch over the parapet.", "Ten feet above the parapet. A magic mouth: as someone passes before it, it whispers a short rhyme: when the dragon's bones rest in their proper tomb, its light will return and lift the darkness from the land."),
  'Q44-east': ("The parapet walk along the east side of the roof, narrowing toward the beacon tower.", None),
  'Q45': ("A weather-rotted siege bow, centuries old, still crouches behind the tower's battlements.", "It falls apart if disturbed."),
  'Q45-east': ("A weather-rotted siege bow, centuries old, still crouches behind the tower's battlements.", "It falls apart if disturbed."),
  'Q46': ("Broken timbers of a siege bow litter the front of the roof; a cone-capped stone turret with a narrow door stands to either side.", None),
  'Q47': ("A cramped, cobwebbed lookout with a plank bench and a cold iron stove; slits in its walls overlook the misty front grounds.", "The knights who kept the roof sheltered here from rain and cold."),
  'Q47-south': ("A cramped, cobwebbed lookout with a plank bench and a cold iron stove; slits in its walls overlook the misty front grounds.", None),
  'Q48': ("Here the roof simply stops: broken stone and splintered rafter ends hang over a sixty-foot fall.", "Sturdy; it won't collapse further. 20 ft down to Q32, 40 ft to Q19, 60 ft to Q4."),
  'Q49': ("A ten-foot walkway leads between sloping roofs to a heavy door in the base of the eastern tower.", "Barred from inside. The phantom archers of Q52 shoot at anyone forcing it, with three-quarters cover behind their slits."),
  'Q50': ("Old timber landings and steps are pegged to the tower's inner walls; through the open middle the chapel floor shows far below.", "60 ft above the chapel. It creaks and sways but holds. The stair climbs 20 ft to Q51."),
  'Q51': ("The wooden landing groans underfoot; three windows face back over the mansion's roof between two narrow doors.",
          "The 10-ft section marked T gives way under 50 lb or more: DC 15 Dex or fall 20 ft to Q50, leaving a 10-ft gap. The doors open onto the turret roofs (Q52)."),
  'Q52': ("A small crenellated turret top, the head of a spiral stair in its middle.",
          "80 ft above the ground. 20 ft below is an archers' post lined with arrow slits, a phantom warrior with a spectral longbow on guard in each (two attacks; longbow +2, range 150/600, 4 (1d8) force)."),
  'Q52-south': ("A small crenellated turret top, the head of a spiral stair in its middle.", "As the north turret."),
  'Q52-northpost': ("A cramped archers' post lined with arrow slits.", "A phantom warrior archer stands guard here."),
  'Q52-southpost': ("A cramped archers' post lined with arrow slits.", "A phantom warrior archer stands guard here."),
  'Q53': ("The stairs end in a stone-floored room at the very top of the tower. Ravens perch along the beams of the steep roof, flitting in and out through gaps in the slates, and tall arched windows glazed with small clear panes look out on every side.",
          "Roof peak 30 ft up. The ravens are harmless but watchful. The view: Vallaki and the windmill (Old Bonegrinder) north and east, a foggy marsh south, the abbey at Krezk far to the west. When the skull is laid in Q16 the dragon's spirit becomes a light here, seen across the valley: +1 AC and saves to Strahd's foes while in Barovia, and the revenants find rest."),
  'Q14-south': ("A tight spiral stair, dimly lit through slits in the wall.", None),
  'Q14-second': ("The spiral stair passes an archway onto the chapel balcony.", None),
  'Q14-secondsouth': ("The spiral stair passes an archway onto the chapel balcony.", None),
  'Q14-third': ("A small empty room at the top of the stair, its window looking down into the chapel.", None),
  'Q14-thirdsouth': ("A small empty room at the top of the stair, its window looking down into the chapel.", None),
  'Q17-south': ("A narrow, dusty spiral stair, lit through slit windows.", None),
  'Q18-south': ("The south gallery over the foyer, its railing on knightly balusters, busts flanking the passage south.", None),
  'Q30-south': ("A ragged black curtain hangs across an arch; behind it, a spiral stair winds down.", "A secret door at its head opens into Q36."),
  'Q31-south': ("Behind an arched wooden door, a spiral stair climbs past slit windows.", None),
  'Q31-roof': ("The head of the east stair, a little turret with a door onto the roof.", None),
  'Q31-roofsouth': ("The head of the east stair, a little turret with a door onto the roof.", None),
}
OBJ_DESC = {
  'Q1-statue': "A ten-foot dragon of grey stone, mossy and weathered, crouched on a cube of granite.",
  'Q3-tapestry': "A tall, faded tapestry of a nobleman in silver armour, torn in places.",
  'Q3-bust-broken': "A toppled pedestal and the shattered pieces of an alabaster bust.",
  'Q6-sarcophagus': "An upright sarcophagus of black wood with a queen carved on its lid; inside, shelves of broken glass.",
  'Q12-table': "A long table on legs carved as crouching dragons.",
  'Q12-knight-n': "A life-sized stone knight with a dragon-winged helm and a shield.", 'Q12-knight-s': "A life-sized stone knight with a dragon-winged helm and a shield.",
  'Q13-altar': "A stone altar carved with a sun rising over the horizon.",
  'Q24-throne': "A finely carved wooden throne.", 'Q36-throne': "A great wooden throne carved as a dragon unfurling its wings.",
  'Q29-portrait': "A portrait of a handsome gentleman with a knowing smile and a mane of pale, wispy hair.",
  'Q40-picture': "A slashed picture above the mantel; the lower half hangs down below the frame.",
  'Q37-patch': "A paler, shield-shaped patch on the stone above the mantel.",
  'Q39-bear': "A stuffed brown bear reared on its hind legs, claws out.", 'Q39-wolf': "A stuffed dire wolf, frozen in a snarl.",
  'Q44-gargoyle': "A tarnished silver-plated gargoyle shaped like a young dragon.", 'Q45-ballista': "An ancient ballista, rotted by weather.", 'Q45e-ballista': "An ancient ballista, rotted by weather.",
  'Q46-wreck': "The scattered timbers of a destroyed ballista.", 'Q53-rafters': "Criss-crossed rafters where ravens roost and watch.",
  'Q15-fence-n': "A seven-foot fence of wrought iron.", 'Q16-roof': "A stone-tiled roof with tarnished silver dragon gargoyles at its gables.",
}
PLAYER_LABEL = {'giant-spider': 'Giant spider', 'revenant': 'Armoured corpse', 'phantom-warrior': 'Phantom knight', 'vladimir-horngaard': 'Armoured figure on the throne',
                'smoke-dragonet': 'Something in the hearth', 'bat': 'Bat', 'dusk-elf': 'Someone behind the barrels', 'open-grave': 'Grave', 'chest': 'Wooden coffer',
                'bust-pedestal': 'Covered pedestal', 'niche': 'Something here', 'wagon': 'Cart', 'coffin': 'Coffin', 'pressure-plate': 'The floor', 'secret-panel': 'A section of wall'}
CONTAINERS = {
  'Q28-coffer': {'contents': 'Four potions of invulnerability.', 'locked': False},
  'Q39-chest': {'contents': 'Empty: looted long ago.', 'open': True},
  'Q41-chest1': {'contents': 'Empty.', 'open': True}, 'Q41-chest2': {'contents': 'Empty.', 'open': True},
  'Q29-wardrobe': {'contents': 'A dark, empty cavity.', 'open': True},
  'event-coffin': {'contents': 'A swarm of bats.', 'locked': False},
}

levels = [g, s, t, r, b, p]
scene = OrderedDict(schema=1, location='Q', chapter='ch07', name='Argynvostholt', mapPage=131, bookScaleFt=10, ambient='fog', stacked=True, valley=True, entry='ground')
scene['levels'] = [lv.to_json() for lv in levels]
for lv in scene['levels']:
    for rm in lv['rooms']:
        d = DESC.get(rm['key'])
        if d:
            rm['desc'] = d[0]
            if d[1]: rm['dm'] = d[1]
    for o in lv['objects']:
        short = o['id'].split('-', 1)[1]
        if short in OBJ_DESC: o['desc'] = OBJ_DESC[short]
        if o['vis'] not in ('player', 'dm-note') and 'playerLabel' not in o:
            o['playerLabel'] = PLAYER_LABEL.get(o['kind'], o['kind'].replace('-', ' ').capitalize())
        if short in CONTAINERS: o['container'] = OrderedDict(sorted(CONTAINERS[short].items()))

def lk(id, kind, a_level, a, b_level, b): return OrderedDict(id=id, kind=kind, **{'from': OrderedDict(level=a_level, pos=[a[0] * 5, a[1] * 5]), 'to': OrderedDict(level=b_level, pos=[b[0] * 5, b[1] * 5])})
scene['links'] = [
  lk('Q-grand-stair-n', 'stairs', 'ground', (36.6, 23), 'second', (39, 19.2)), lk('Q-grand-stair-s', 'stairs', 'ground', (36.6, 23.6), 'second', (39, 26.8)),
  lk('Q14-n-1', 'spiral', 'ground', (51, 19), 'second', (51, 19)), lk('Q14-n-2', 'spiral', 'second', (51, 19.2), 'third', (51, 19.2)),
  lk('Q14-s-1', 'spiral', 'ground', (51, 27), 'second', (51, 27)), lk('Q14-s-2', 'spiral', 'second', (51, 26.8), 'third', (51, 26.8)),
  lk('Q17-n', 'spiral', 'second', (29, 19), 'third', (29, 19)), lk('Q17-s', 'spiral', 'second', (29, 27), 'third', (29, 27)),
  lk('Q31-n', 'spiral', 'third', (45, 19), 'roof', (45, 19)), lk('Q31-s', 'spiral', 'third', (45, 27), 'roof', (45, 27)),
  lk('Q50-Q51', 'stairs', 'roof', (53, 25), 'beacon', (53, 21)), lk('Q51-Q53', 'stairs', 'beacon', (53, 21.4), 'peak', (53, 24.6)),
  lk('Q52-n', 'spiral', 'roof', (51, 19), 'beacon', (51, 19.4)), lk('Q52-s', 'spiral', 'roof', (51, 27), 'beacon', (51, 26.8)),
  lk('Q43-hole', 'shaft', 'roof', (35, 22.5), 'third', (37, 22.5)),
]

grid = OrderedDict(schema=1, levels=OrderedDict())
for lv in levels:
    polys = [[[x * 5, z * 5] for x, z in poly] for poly in lv.floor_polys] + [[[x * 5, z * 5] for x, z in poly] for poly, _ in lv.terrain[:1]]
    grid['levels'][lv.id] = OrderedDict(floorPolygons=polys, type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0.55)

out = os.path.join(ROOT, 'locations', 'ch07', 'Q'); os.makedirs(out, exist_ok=True)
json.dump(scene, open(os.path.join(out, 'scene.json'), 'w'), indent=1)
json.dump(grid, open(os.path.join(out, 'grid.json'), 'w'), indent=1)
keys = sorted({rm['key'].split('-')[0] for lv in scene['levels'] for rm in lv['rooms']}, key=lambda k: int(k[1:]))
want = [a['key'] for l in _M['locations'] if l['id'] == 'Q' for a in l['areas']]
print('argynvostholt:', [(lv['id'], len(lv['rooms']), len(lv['walls']), len(lv['objects'])) for lv in scene['levels']])
print('missing keys:', [k for k in want if k not in keys], 'extra:', [k for k in keys if k not in want])
