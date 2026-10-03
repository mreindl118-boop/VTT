#!/usr/bin/env python3
"""The Wizard of Wines (chapter 12, area W; map p.175, one square = 5 ft): the Martikovs' old two-storey stone winery
in the middle of its vineyard, read off the book's three panels (upper floor, ground floor, cellar) on one lattice.
Four levels stack: the cellar (W13-W15, -10 ft), the ground floor (W1-W12, a 15-ft storey), the vat balcony that clings
to the fermentation hall's walls 10 ft up (W9) and the upper floor at 15 ft (W16-W20, the hall, the turret heads),
capped by slate roofs with iron cresting along their ridges. The turrets W11 (spiral stair) and W12 (barrel ramp) climb all three
storeys. Round the building: the well (W6) and outhouse (W7), the yard paths, the muddy trail from the east between
its fences, the stand of trees north of the trail where the wereravens hide, and the vineyard rows on every side
(the vineyard inset), with the needle blights waiting among them 120 ft out.
Only keys, names, pages, dimensions, placements and our own wording live here.
-> locations/ch12/W/{scene,grid}.json"""
import json, math, os, sys
from collections import OrderedDict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from authorlib import ROOT, Level, rect, unit_edges, seg_key  # noqa: F401

_M = json.load(open(os.path.join(ROOT, 'manifests', 'locations.json')))
PAGE = {a['key']: a['page'] for l in _M['locations'] if l['id'] == 'W' for a in l['areas']}
for k in ('W10', 'W11'): PAGE[k] = PAGE.get(k) or 177   # the manifest has no page for these two; they follow W9 on p.177
pg = lambda k: PAGE.get(k)


def arc(cx, cz, r, a0, a1, step=30):
    """Points on a circle from a0 to a1 degrees (0 = east, 90 = south: clockwise on the plan), ends included."""
    out, a = [], a0
    while a <= a1 + 1e-9:
        t = math.radians(a)
        out.append((round(cx + math.cos(t) * r, 3), round(cz + math.sin(t) * r, 3)))
        a += step
    return out


def ov(lv, a, b, **kw):
    """Override one edge exactly as the wall builder splits it (diagonals whole, straight runs per cell)."""
    k = seg_key(a, b); lv.overrides[k] = dict(lv.overrides.get(k, {}), **kw)


def stamp_edges(lv, poly, **kw):
    """Override every unit edge of a polygon (open it, give it a material or a height)."""
    for a, b in unit_edges(poly):
        ov(lv, a, b, **kw)


def seg(lv, a, b, **kw):
    lv._stamp(a, b, **kw)


def band(points, w):
    """A strip `w` cells wide along a polyline (for paths and trails)."""
    left, right = [], []
    for i, (x, z) in enumerate(points):
        if i == 0: dx, dz = points[1][0] - x, points[1][1] - z
        elif i == len(points) - 1: dx, dz = x - points[i - 1][0], z - points[i - 1][1]
        else: dx, dz = points[i + 1][0] - points[i - 1][0], points[i + 1][1] - points[i - 1][1]
        L = math.hypot(dx, dz) or 1
        nx, nz = -dz / L * w / 2, dx / L * w / 2
        left.append((round(x + nx, 2), round(z + nz, 2))); right.append((round(x - nx, 2), round(z - nz, 2)))
    return left + right[::-1]


def along(points, step):
    """(x, z, heading-degrees) every `step` cells along a polyline."""
    out, carry = [], 0.0
    for (x0, z0), (x1, z1) in zip(points, points[1:]):
        L = math.hypot(x1 - x0, z1 - z0); d = carry
        while d < L:
            t = d / L; out.append((x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, math.degrees(math.atan2(z1 - z0, x1 - x0))))
            d += step
        carry = d - L
    return out


def H(i, k=0):
    """A deterministic 0..1 jitter."""
    s = math.sin(i * 127.1 + k * 311.7) * 43758.5453
    return s - math.floor(s)


AMB = 'barovian-overcast'

# ================================================================== ground floor (W1-W12) and the grounds
g = Level('ground', 'Ground floor', 0, 15, ambient=AMB, interior='ashlar', exterior='rubble', north='-z')
# --- the grounds: one sweep of turf (slit open over the stairwell in W10, so the stair down shows through); the yard
#     paths; the trail in from the east between its fences
g.terrain.append(([(-46, -32), (82, -32), (82, 66), (11, 66), (11, 24), (12, 24), (12, 23), (10, 23), (10, 24), (11, 24), (11, 66), (-46, 66)], 'grass'))
TRAIL = [(82, -13), (66, -12.5), (50, -11), (38, -9.5), (29, -7.5), (22.5, -3.5), (19.2, 2), (17.6, 8), (17, 12.6)]
g.terrain.append((band(TRAIL, 3.0), 'dirt'))
g.terrain.append(([(14.5, 11.5), (20.5, 11.5), (20.5, 15), (14.5, 15)], 'dirt'))                          # the apron before the loading dock
YARD = [(15, 13.6), (9, 13.3), (3, 13.5), (0.2, 14.3), (-1.4, 16.5), (-1.6, 21), (-1.2, 25.5), (0.8, 27.6), (5, 27.8), (9, 27)]
g.terrain.append((band(YARD, 1.6), 'dirt'))
g.terrain.append((band([(13.3, 25.0), (14.0, 26.4), (15.0, 28.2), (15.6, 31.6)], 1.4), 'dirt'))                # down from the glassblower's door
g.terrain.append((band([(-1.5, 18), (-8, 17.5)], 1.4), 'dirt'))
g.obj('spawn', 'spawn', (18.4, 8.5), 'dm-note', None, 'The party comes down the trail from the east')

# --- W5 veranda (open to the north and west under an arcade), W4, W3, W2, W1
g.room('W5', 'Veranda', rect(3, 15, 10, 19), 'flagstone', page=pg('W5'), ceilingFt=15)
g.room('W4', 'Barrel Storage', rect(10, 15, 13, 19), 'flagstone', page=pg('W4'), ceilingFt=15)
g.room('W3', "Barrel Maker's Workshop", rect(13, 15, 15, 19), 'plank', page=pg('W3'), ceilingFt=15)
g.room('W2', 'Loading Dock', rect(15, 15, 19, 20), 'cobble', page=pg('W2'), ceilingFt=15)
g.room('W1', 'Stables', rect(19, 15, 23, 18), 'dirt', page=pg('W1'), ceilingFt=15)
g.room('W8', 'Storage', rect(3, 19, 4, 21), 'flagstone', page=pg('W8'), ceilingFt=15)
g.room('W9', 'Fermentation Vats', rect(4, 19, 15, 23), 'flagstone', page=pg('W9'), ceilingFt=25)
W10P = [(7, 23), (10, 23), (10, 24), (12, 24), (12, 25), (7, 25)]                                       # the stairwell down (W13) is open
g.room('W10', "Glassblower's Workshop", W10P, 'flagstone', page=pg('W10'), ceilingFt=15)
T11 = (3, 23); T12 = (16, 23)                                                                          # the turrets' centres (10-ft bore)
A11 = arc(*T11, 1, 0, 270); A12 = arc(*T12, 1, 270, 540)                                                 # their outer walls, the stair side open
g.room('W11', 'Spiral Staircase', [(3, 21), (4, 21)] + A11, 'flagstone', page=pg('W11'), ceilingFt=15)
g.room('W12', 'Ramp', [(15, 20), (16, 20)] + A12, 'plank', page=pg('W12'), ceilingFt=15)
g.room('W6', 'Well', [(round(0.6 + math.cos(math.radians(a)) * 1.3, 3), round(16.6 + math.sin(math.radians(a)) * 1.3, 3)) for a in range(0, 360, 45)], 'cobble', page=pg('W6'), ceilingFt=15)
g.room('W7', 'Outhouse', rect(0, 19, 1, 20), 'plank', page=pg('W7'), ceilingFt=8)

# walls: the veranda's open sides, the vat hall's south wall stops at the balcony (its upper wall stands on that level)
for a, b in [((3, 15), (10, 15)), ((3, 15), (3, 19))]: seg(g, a, b, open_wall=True)
seg(g, (16, 15), (18, 15), open_wall=True)                                                               # the dock's open front
for i in range(4, 15): seg(g, (i, 23), (i + 1, 23), heightFt=10)
stamp_edges(g, g.rooms[-2][2], open_wall=True)                                                           # the well stands in the open
stamp_edges(g, rect(0, 19, 1, 20), material='paneling', heightFt=7.5)
for a, b in [((19, 15), (23, 15)), ((23, 15), (23, 18)), ((19, 18), (23, 18))]: seg(g, a, b, material='paneling')
# doors and windows
g.door((20, 15), (22, 15), id='W1-sliding', double=True)
g.door((15, 20), (16, 20), id='W2-south', open=True)
g.door((19, 18), (19, 19), id='W2-east')
g.door((15, 19), (15, 20), id='W9-W2', locked=True)
g.door((13, 15), (14, 15), id='W3-north', locked=True)
g.door((13, 17), (13, 18), id='W3-W4')
g.door((12, 19), (13, 19), id='W4-W9')
g.door((6, 19), (8, 19), id='W5-sliding', locked=True, double=True)
g.door((9, 19), (10, 19), id='W5-door', locked=True)
g.door((3, 19), (3, 20), id='W8-west', open=True)
g.door((4, 19), (4, 20), id='W8-W9', open=True)
g.door((4, 21), (4, 22), id='W9-W11', open=True)
g.door((15, 21), (15, 22), id='W9-W12', open=True)
g.door((9, 23), (10, 23), id='W9-W10')
g.door((12, 24), (12, 25), id='W10-east', locked=True)
g.door((1, 19), (1, 20), id='W7-door')
g.window((8, 25), (9, 25))
g.window(A11[1], A11[2]); g.window(A11[7], A11[8])
g.window(A12[4], A12[5]); g.window(A12[7], A12[8])
# the stairwell down to the cellar: a wall closes its east end, a timber rail its south side
g.wall((12, 23), (12, 24), material='ashlar')
seg(g, (10, 24), (12, 24), flags=['normal'], heightFt=3.5, wall=True, material='paneling')
seg(g, (10, 23), (10, 24), open_wall=True)
# the stable's stalls: board partitions with gaps for the stall gates
for a, b in [((19, 16), (19.6, 16)), ((20.4, 16), (21.6, 16)), ((22.4, 16), (23, 16)), ((21, 16), (21, 18))]: g.wall(a, b, material='paneling', heightFt=4.5)

# --- props: W1 stables
for i, (x, z) in enumerate([(20, 17.1), (22, 17.1)]):
    g.creature(f'W1-horse{i}', 'horse', (x, z), 'W1', 'A Martikov draft horse (pulls the wine wagon)', size='large')
    g.objects[-1]['dims'] = {'scale': 1.1}; g.objects[-1]['rotY'] = 90
    g.prop(f'W1-trough{i}', 'trough', (x, 17.75), 'W1'); g.prop(f'W1-hay{i}', 'hay', (x - 0.6 + i * 1.2, 16.5), 'W1')
g.prop('W1-roof', 'winery-roof', (21, 16.5), None, dims={'w': 20, 'd': 15, 'h': 7, 'y': 15})
g.prop('W1-tack', 'cloak-hooks', (19.4, 15.2), 'W1')
# W2 loading dock: the wagon with its three barrels; the raised walkway on three sides
g.prop('W2-wagon', 'barrel-wagon', (17, 17.4), 'W2', rotY=90)
g.obj('W2-walk', 'prism', (0, 0), 'player', 'W2', dims={'h': 1.5, 'color': 0x6b4a33})
g.objects[-1]['polygon'] = [[x * 5, z * 5] for x, z in [(15, 15.4), (16, 15.4), (16, 19), (18, 19), (18, 15.4), (19, 15.4), (19, 20), (15, 20)]]
g.objects[-1]['pos'] = [0, 0, 0]
for i, (x, z) in enumerate([(16, 16), (16, 17), (16, 18), (16, 19), (18, 16), (18, 17), (18, 18), (18, 19)]): g.prop(f'W2-post{i}', 'post-round', (x, z), 'W2', dims={'r': 0.35, 'h': 15})
g.note('W2-note', (17, 18.6), 'W2', 'Three barrels of Purple Grapemash No. 3 sit in braces on the wagon. The crane in W16 lowers barrels through the 10-ft hole overhead. The south door was forced and hangs ajar (barricade only).')
# W3 barrel maker's workshop
g.prop('W3-bench1', 'table', (14.55, 16.1), 'W3', rotY=90, dims={'w': 6, 'd': 3})
g.prop('W3-bench2', 'table', (14.55, 17.9), 'W3', rotY=90, dims={'w': 6, 'd': 3})
g.prop('W3-staves', 'stave-pile', (13.6, 16.6), 'W3', rotY=90)
g.prop('W3-tools', 'tool-rack', (14.5, 15.1), 'W3', dims={'w': 4})
g.prop('W3-tools3', 'tool-rack', (13.1, 16.1), 'W3', rotY=90, dims={'w': 4})
g.prop('W3-tools2', 'tool-rack', (13.1, 18.5), 'W3', rotY=90, dims={'w': 4})
g.prop('W3-hoops', 'stave-pile', (13.6, 18.4), 'W3')
# W4 barrel storage: thirteen new barrels in rows; the narrow spiral stair in the SW corner
for i, (x, z) in enumerate([(10.5, 15.5 + k * 0.6) for k in range(5)] + [(11.5, 15.5 + k * 0.6) for k in range(5)] + [(12.5, 15.5 + k * 0.6) for k in range(3)]):
    g.prop(f'W4-barrel{i}', 'barrel', (x, z), 'W4', rotY=(i * 37) % 90)
g.prop('W4-stair', 'stone-spiral', (10.6, 18.4), 'W4', dims={'r': 2.6, 'rise': 15, 'turns': 1.3})
# W5 veranda: three treading tubs; the arcade of piers that carries the upper floor
for i, x in enumerate((4.6, 6.6, 8.6)): g.prop(f'W5-tub{i}', 'treading-tub', (x, 16.6), 'W5')
for i, (x, z) in enumerate([(3, 15), (6, 15), (9, 15), (3, 18)]): g.prop(f'W5-pier{i}', 'pier', (x, z), 'W5', dims={'h': 15})
for i, (x, z, w, r) in enumerate([(4.5, 15, 15, 0), (7.5, 15, 15, 0), (9.5, 15, 5, 0), (3, 16.5, 15, 90), (3, 18.5, 5, 90)]): g.prop(f'W5-arch{i}', 'arcade', (x, z), 'W5', rotY=r, dims={'w': w, 'y': 9, 'top': 15})
for i, x in enumerate((5.4, 7.8)): g.prop(f'W5-gtub{i}', 'grape-tub', (x, 18.2), 'W5')
# W6 well, W7 outhouse
g.prop('W6-well', 'well', (0.6, 16.6), 'W6')
g.prop('W7-roof', 'roof-gable', (0.5, 19.5), None, dims={'w': 6.5, 'd': 6.5, 'h': 3, 'y': 7.5})
g.note('W7-note', (0.5, 19.5), 'W7', 'Bundles of sweet herbs under the eaves, a moon cut in the door. Nothing inside.')
# W8 storage
g.prop('W8-hooks', 'cloak-hooks', (3.5, 19.1), 'W8'); g.objects[-1]['desc'] = 'Bare hooks along the wall; whatever hung here is gone.'
g.prop('W8-shelves', 'shelves', (3.5, 20.85), 'W8', rotY=180, dims={'w': 4})
g.objects[-1]['desc'] = 'Shelves of juice-stained wooden clogs with wide soles, for treading grapes.'
g.prop('W8-beam', 'beam', (3.55, 19.75), 'W8', rotY=70)
g.objects[-1]['desc'] = 'A five-foot wooden beam lying on the floor; the brackets on the outer door would take it.'
# W9 fermentation vats: four vats, the stair to the balcony, old barrels under the balcony, posts
VATS = [(6.05, 21.0), (7.95, 21.0), (11.05, 21.0), (12.95, 21.0)]
for i, (x, z) in enumerate(VATS): g.prop(f'W9-vat{i}', 'fermentation-vat', (x, z), 'W9', dims={'split': 1} if i == 3 else None)
g.prop('W9-stair', 'stairs-straight', (9.5, 21), 'W9', dims={'w': 5, 'rise': 10, 'fromZ': 100, 'toZ': 110})
for i in range(12):
    x = 4.55 + i * 0.86
    if 8.9 < x < 10.1: continue
    g.prop(f'W9-oldbarrel{i}', 'barrel', (x, 22.55), 'W9', rotY=90 if i % 3 else 0, dims={'lying': 1} if i % 3 else None)
for i, (x, z) in enumerate([(5, 22), (9, 22), (10, 22), (14, 22)]): g.prop(f'W9-post{i}', 'post-round', (x, z), 'W9', dims={'r': 0.4, 'h': 10})
g.note('W9-poison', (6.05, 21.0), 'W9', 'The three western vats hold poisoned wine (20 barrels\' worth): drinking it = potion of poison. Antitoxin neutralises it but spoils the taste; purify food and drink saves it.')
g.note('W9-crack', (12.95, 20.1), 'W9', 'The eastern vat is split at the back: a 6-inch, 6-ft crack. The twenty-four twig blights hide inside (total cover).')
for i in range(4):
    g.creature(f'W9-twig{i}', 'twig-blight', (12.4 + (i % 2) * 1.0, 19.55 + (i // 2) * 0.35), 'W9', 'Twig blights (24 in all) hidden in the split eastern vat; they come out when the druid calls', size='small')
for i, (x, z) in enumerate([(6, 20.2), (8.5, 21.8), (11, 20.2), (13.5, 21.8)]):
    g.creature(f'W9-ravens{i}', 'swarm-of-ravens', (x, z), 'W9', 'Swarm of ravens on the rafters (4 swarms): never attack the party; they tear apart one twig blight each turn once the druid calls her blights')
    g.objects[-1]['pos'][1] = 17
g.note('W9-note', (9.5, 19.6), 'W9', 'Sliding doors to W5 chained (padlock; key in W20); the single doors to W5 and W2 barred from inside. Balcony 10 ft up along the south wall, climbing to 15 ft along the side walls to the upper-floor doors.')
# W10 glassblower's workshop
g.prop('W10-hearth', 'glass-hearth', (7.55, 24.5), 'W10', rotY=45)
g.prop('W10-sand', 'sand-barrel', (8.35, 24.55), 'W10')
g.prop('W10-rack', 'bottle-rack', (10.6, 24.78), 'W10', dims={'len': 7, 'h': 3.5, 'fill': 0.9})
g.prop('W10-bench', 'table', (8.2, 23.4), 'W10', dims={'w': 7, 'd': 2.5})
g.prop('W10-tools', 'tool-rack', (8.2, 23.08), 'W10', dims={'w': 6})
g.prop('W10-chimney', 'chimney', (6.85, 25.15), None, dims={'h': 21, 'y': 0})
g.prop('W10-roof', 'shed-roof', (9.5, 24), None, dims={'w': 25, 'd': 10, 'y0': 15, 'y1': 17.5})
g.note('W10-sand-treasure', (8.35, 24.55), 'W10', 'Fortunes of Ravenloft: a treasure read here is hidden in the sand barrel (found without a check).')
g.light('W10-hearth', (7.6, 24.4), 'candle', 5, 10, y=2.5)
# W11, W12 turrets
g.prop('W11-stair', 'stone-spiral', T11, 'W11', dims={'r': 4.6, 'rise': 15, 'turns': 1.1})
g.prop('W12-ramp', 'spiral-ramp', T12, 'W12', dims={'r': 4.6, 'rise': 15, 'turns': 1})

# --- the grounds: hedges at the walls, ivy on the stone, the vineyard all round, the grove north of the trail
for i, (x, z, s) in enumerate([(10.6, 14.2, 1.1), (11.6, 14.2, 1.2), (14.2, 14.3, 1.0), (-0.6, 22.3, 1.2), (1.5, 25.3, 1), (5.5, 26.2, 1.1), (13.7, 23.6, 0.9), (24, 19.5, 1.2), (24.2, 15.5, 1), (2, 13.9, 0.9)]):
    g.prop(f'hedge{i}', 'bush', (x, z), None, dims={'scale': s})
OUT = {'n': ((0, -0.07), 180), 's': ((0, 0.07), 0), 'e': ((0.07, 0), 90), 'w': ((-0.07, 0), -90)}   # which way the wall face looks
def ivy(lv, id, x, z, out, cells, h, seed):
    """Ivy on an outer wall face at (x, z), `cells` wide, `h` ft up the wall."""
    (dx, dz), r = OUT[out]
    lv.prop(id, 'ivy', (x + dx, z + dz), None, rotY=r, dims={'w': cells * 5, 'h': h, 'seed': seed})
for i, (x, z, o, w) in enumerate([(11.6, 15, 'n', 2.8), (14.5, 15, 'n', 0.9), (19, 19.6, 'e', 0.8), (5.4, 23, 's', 2.4), (13.6, 23, 's', 2.2),
                                    (10.4, 25, 's', 2.6), (7.5, 25, 's', 0.9), (3, 20.5, 'w', 0.9)]):
    ivy(g, f'ivy{i}', x, z, o, w, 13, i)
# the vineyard: east-west rows ten feet apart in every field round the yard and south of the trail
def trail_x(z):
    """The trail's centre line x at plan row z (it runs south from z=-8 to the dock)."""
    for (x0, z0), (x1, z1) in zip(TRAIL, TRAIL[1:]):
        if min(z0, z1) <= z <= max(z0, z1) and z1 != z0: return x0 + (x1 - x0) * (z - z0) / (z1 - z0)
    return None
rows = 0
for zi, z in enumerate([zz + 0.5 for zz in range(-24, 64, 2)]):
    spans = []
    if z < -12: spans.append((-44, 14 if z > -18 else 8))                                    # north-west field (the grove is east of it)
    elif z < 9:
        tx = trail_x(z) if z > -7 else None
        spans.append((-44, (tx - 4) if tx else 14))
        if z > -6: spans.append(((tx + 4) if tx else 26, 80))
    elif z < 31: spans += [(-44, -8), (30, 80)]
    else: spans.append((-44, 80))
    for si, (x0, x1) in enumerate(spans):
        # break long rows into runs with headland gaps (a cart path every 120 ft)
        x = x0
        while x < x1 - 3:
            x2 = min(x1, x + 22)
            L = (x2 - x) - 1
            if L > 3:
                g.prop(f'vines{zi}-{si}-{int(x)}', 'vine-row', ((x + x2 - 1) / 2, z), None, dims={'len': round(L * 5, 1), 'seed': zi * 7 + si, 'dead': 0.25 if z > 50 or x > 60 else 0.08})
                rows += 1
            x = x2 + 1
for i in range(14):
    x, z = [(-30, 6.5), (-14, 38.5), (6, 44.5), (24, 52.5), (44, 30.5), (60, 12.5), (36, 0.5), (-20, -9.5), (-36, 26.5), (52, 46.5), (-6, -15.5), (70, 34.5), (14, 58.5), (-40, 50.5)][i]
    g.prop(f'gtub{i}', 'grape-tub', (x, z + 0.5), None, rotY=i * 31)
# fences follow the trail on both sides
for side in (-1, 1):
    pts = []
    for i, (x, z) in enumerate(TRAIL[:-2]):
        nx, nz = (TRAIL[i + 1][0] - x, TRAIL[i + 1][1] - z)
        L = math.hypot(nx, nz) or 1
        pts.append((x - nz / L * 2.6 * side, z + nx / L * 2.6 * side))
    for i, (x, z, hd) in enumerate(along(pts, 2.0)):
        g.prop(f'fence{side}-{i}', 'fence', (x, z), None, rotY=-hd, dims={'w': 10})
# the stand of trees north of the trail (oak, pine) where the wereravens wait
for i in range(46):
    x = 24 + H(i, 1) * 56; z = -31 + H(i, 2) * 15
    if z > -17 - (x - 24) * 0.02: z -= 4
    if H(i, 3) < 0.45: g.prop(f'grove{i}', 'oak', (x, z), None, dims={'r': 1.2 + H(i, 4) * 0.5, 'h': 18 + H(i, 5) * 8, 'canopy': 12 + H(i, 6) * 6})
    else: g.prop(f'grove{i}', 'pine', (x, z), None, dims={'scale': 1.0 + H(i, 7) * 0.4})
g.note('grove-note', (34, -18.5), None, 'A thick grove north of the trail. A hooded figure at its edge waves the party over: nine wereravens (the Martikovs) shelter here in human form.')
RAVENS = [('W-davian', (34, -17.2), 'Davian Martikov, the old patriarch (wereraven, Keeper of the Feather): suspicious; says nothing of the gems until the winery is retaken'),
          ('W-adrian', (35.2, -18.4), 'Adrian Martikov, eldest son (wereraven); knows of the barrels in W2 and W14'),
          ('W-elvir', (33.2, -19.6), 'Elvir Martikov, youngest son (wereraven)'),
          ('W-stefania', (36.4, -19.8), 'Stefania Martikov, Davian\'s daughter (wereraven)'),
          ('W-dag', (37.4, -18.6), 'Dag Tomescu, Stefania\'s husband (wereraven)'),
          ('W-claudiu', (35.6, -21.2), 'Claudiu, teenage son (wereraven)')]
for id, p, lab in RAVENS: g.creature(id, 'wereraven', p, None, lab)
for id, p, lab in [('W-martin', (34.4, -21.6), 'Martin, a young boy (wereraven, 7 hp; noncombatant)'), ('W-viggo', (33.6, -21.0), 'Viggo, a young boy (wereraven, 7 hp; noncombatant)')]:
    g.creature(id, 'wereraven', p, None, lab, size='small')
g.creature('W-yolanda', 'commoner', (36.8, -21.0), None, 'Yolanda, the baby (effectively human, 1 hp), in Stefania\'s arms', size='tiny')
# the needle blights: six groups of five rise from the rows 120 ft out
GROUPS = [(-22, 20.5), (-10, 44.5), (11, 48.5), (34, 46.5), (46, 22.5), (44, 0.5)]
for gi, (x, z) in enumerate(GROUPS):
    for k in range(5):
        g.creature(f'needles{gi}-{k}', 'needle-blight', (x + (k % 3) * 1.1 - 1.1, z + (k // 3) * 1.4 - 0.5), None, f'Needle blights, group {gi + 1} of 6 (five each): emerge from the vines 120 ft out, speed 30 ft')
g.note('blights-note', (9.5, 31), None, 'On arrival: 30 needle blights (6 groups x 5) rise from the vines 120 ft out and close at speed 30. If the party fights outside: round 3 the W9 druid and 24 twig blights, round 4 the W14 druid and 5 needle blights, round 5 the W20 druid and 2 vine blights join in. Destroying the Gulthias staff (W16) withers every blight within 300 ft.')
g.note('event-delivery', (21.5, 10.5), None, 'Wine Delivery (after the winery is freed): Adrian loads the three cellar barrels onto the wagon, Elvir yokes the horses; they drive to the Blue Water Inn, the Vistani camp or Krezk, glad of an escort. Two swarms of ravens shadow the wagon.')
g.note('event-wintersplinter', (9.5, 38.5), None, 'Wintersplinter Attacks (if the party leaves and returns before dealing with it): vines trampled, the winery in ruins, huge tracks on the trail south; the tree blight is plodding back to Yester Hill. Later Baba Lysaga posts seven scarecrows in the vineyard.')
g.note('trail-note', (78, -14.5), None, 'Half a mile east the trail meets a fork and a signpost pointing here, off the Old Svalich Road.')
g.note('vineyard-note', (-24, 33), None, 'The vineyard: neat rows of grapevines, rope-handled half-barrels for hauling grapes. Three magic gems planted in this soil kept the vines alive; all three are gone (one at Yester Hill, one with Baba Lysaga at Berez, one lost ten years ago).')

# ================================================================== the vat balcony (W9), 10 ft up
b = Level('balcony', 'Vat balcony (+10 ft)', 10, 5, ambient='interior-dim', interior='ashlar', exterior='ashlar', north='-z')
BAL = [(4, 20), (5, 20), (5, 22), (14, 22), (14, 20), (15, 20), (15, 23), (4, 23)]
b.room('W9-balcony', 'Fermentation Vats: balcony', BAL, 'plank', page=pg('W9'), ceilingFt=15)
for a, c in [((4, 20), (5, 20)), ((14, 20), (15, 20)), ((4, 20), (4, 23)), ((15, 20), (15, 23)), ((9, 22), (10, 22))]: seg(b, a, c, open_wall=True)
for a, c in [((5, 20), (5, 22)), ((5, 22), (9, 22)), ((10, 22), (14, 22)), ((14, 22), (14, 20))]: seg(b, a, c, flags=['normal'], heightFt=3.5, wall=True, material='paneling')
for i in range(4, 15): seg(b, (i, 23), (i + 1, 23), heightFt=15, material='ashlar')
for x in (5, 6, 12, 13): b.window((x, 23), (x + 1, 23))
for i, x in enumerate((4.5, 14.5)): b.prop(f'W9-sidestair{i}', 'stairs-straight', (x, 21), 'W9-balcony', dims={'w': 5, 'rise': 5, 'fromZ': 105, 'toZ': 100})
b.creature('W9-druid', 'druid', (6.1, 22.5), 'W9-balcony', 'Druid (NE female human): goat-horn headdress, animal-skin gown, necklaces of human teeth; pouring syrup into the westernmost vat. Calls the twig blights if attacked')
b.objects[-1]['dims'] = {'v': 0}
b.hidden('W9-flask', 'wine-bottle', (6.5, 22.6), 'W9-balcony', 'Her flask of thick syrup: the poison going into the vats.')
b.note('W9-bal-note', (9.5, 22.6), 'W9-balcony', 'The balcony is 10 ft above the floor along the south wall (four windows); at each side it climbs 5 ft to doors onto the upper floor.')

# ================================================================== upper floor (W16-W20), 15 ft up
u = Level('upper', 'Upper floor', 15, 10, ambient='interior-dim', interior='plaster', exterior='rubble', north='-z')
u.room('W20', 'Printing Press', rect(3, 15, 5, 18), 'plank', page=pg('W20'), ceilingFt=10)
u.room('W19-west', 'Sleeping Quarters (west)', rect(5, 15, 7, 18), 'plank', page=pg('W19'), ceilingFt=10)
u.room('W19-east', 'Sleeping Quarters (east)', rect(7, 15, 9, 18), 'plank', page=pg('W19'), ceilingFt=10)
u.room('W18', 'Kitchen and Dining Room', rect(9, 15, 12, 18), 'plank', page=pg('W18'), ceilingFt=10)
u.room('W17', 'Master Bedroom', rect(12, 15, 15, 18), 'plank', page=pg('W17'), ceilingFt=10)
u.room('W11-hall', 'Upper Hall', rect(4, 18, 15, 19), 'plank', page=pg('W11'), ceilingFt=10)
W11U = [(3, 18), (4, 18)] + A11
u.room('W11-upper', 'Spiral Staircase (head)', W11U, 'flagstone', page=pg('W11'), ceilingFt=10)
u.room('W9-west', 'Fermentation Vats: west landing', rect(4, 19, 5, 20), 'plank', page=pg('W9'), ceilingFt=10)
u.room('W9-east', 'Fermentation Vats: east landing', rect(14, 19, 15, 20), 'plank', page=pg('W9'), ceilingFt=10)
W16P = [(15, 15), (19, 15), (19, 20), (17, 20), (17, 19), (18, 19), (18, 17), (16, 17), (16, 19), (17, 19), (17, 20), (15, 20)]
u.room('W16', 'Loading Winch', W16P, 'plank', page=pg('W16'), ceilingFt=10)
u.room('W12-upper', 'Ramp (head)', [(15, 20), (16, 20)] + A12, 'plank', page=pg('W12'), ceilingFt=10)
# openings, railings, the hole in W16's floor
seg(u, (4, 18), (4, 19), open_wall=True)
seg(u, (15, 20), (16, 20), open_wall=True)
seg(u, (17, 19), (17, 20), open_wall=True)
for a, c in [((16, 17), (18, 17)), ((18, 17), (18, 19)), ((16, 19), (18, 19)), ((16, 17), (16, 19))]: seg(u, a, c, open_wall=True)
for a, c in [((4, 20), (5, 20)), ((14, 20), (15, 20))]: seg(u, a, c, open_wall=True)
for a, c in [((5, 19), (5, 20)), ((14, 19), (14, 20))]: seg(u, a, c, flags=['normal'], heightFt=3.5, wall=True, material='paneling')
for a, c in [((5, 19), (14, 19)), ((4, 20), (4, 23)), ((15, 20), (15, 23))]: seg(u, a, c, material='ashlar')   # the vat hall's upper walls
u.door((3, 18), (4, 18), id='W20-door', open=True)
u.door((5, 18), (6, 18), id='W19w-door'); u.door((7, 18), (8, 18), id='W19e-door')
u.door((9, 18), (10, 18), id='W18-door1'); u.door((11, 18), (12, 18), id='W18-door2'); u.door((12, 16), (12, 17), id='W18-W17')
u.door((15, 18), (15, 19), id='hall-W16')
u.door((4, 19), (4, 20), id='W9w-door'); u.door((15, 19), (15, 20), id='W9e-door')
u.secret((15, 15), (15, 16), 'W17-W16', 'Hidden door at the north end of the wall between W17 (push) and W16 (pull)', 'W17')
for a, c in [((4, 15), (5, 15)), ((3, 16), (3, 17)), ((6, 15), (7, 15)), ((8, 15), (9, 15)), ((10, 15), (11, 15)), ((13, 15), (14, 15)), ((17, 15), (18, 15)), ((19, 16), (19, 17)), ((19, 18), (19, 19)), ((3, 18), (3, 19))]:
    u.window(a, c)
u.window(A11[3], A11[4]); u.window(A12[3], A12[4])
# W20 printing press
u.prop('W20-press', 'printing-press', (4.0, 15.65), 'W20')
u.prop('W20-cabinet', 'cabinet', (3.35, 16.9), 'W20', rotY=90)
u.objects[-1]['container'] = {'contents': 'Bottles of wine-dark ink, parchment, jars of glue, and a key on a loop of twine.'}
u.prop('W20-desk', 'desk', (4.35, 17.35), 'W20', rotY=-90); u.prop('W20-chair', 'chair', (3.75, 17.4), 'W20', rotY=90)
u.prop('W20-mess', 'refuse', (4.0, 16.9), 'W20'); u.objects[-1]['desc'] = 'Labels, ink bottles and papers tossed across the floor.'
u.hidden('W20-key', 'desk-key', (3.35, 16.9), 'W20', 'In the cabinet: the key (on twine) to the padlock on the W5-W9 sliding doors.')
u.creature('W20-druid', 'druid', (3.95, 16.4), 'W20', 'Druid (NE female human), caked in mud, twigs in her hair, a veil of moss: rifling the cabinet. Fights to the death')
u.objects[-1]['dims'] = {'v': 3}
for i, (x, z) in enumerate([(4.5, 16.3), (4.6, 17.0)]): u.creature(f'W20-vine{i}', 'vine-blight', (x, z), 'W20', 'Vine blight (2): a shape of dead vines behind the druid; fights to the death')
# W19 sleeping quarters (west: Davian, Adrian, Elvir; east: the boys, toys about)
for k, x0 in (('W19-west', 5), ('W19-east', 7)):
    u.prop(f'{k}-bunk1', 'bunk-bed', (x0 + 1.2, 15.42), k, rotY=90)
    u.prop(f'{k}-bunk2', 'bunk-bed', (x0 + 1.62, 16.95), k)
    for i in range(4): u.prop(f'{k}-locker{i}', 'trunk', (x0 + 0.24, 16.0 + i * 0.62), k, rotY=90)
    u.objects[-1]['container'] = {'contents': 'Clothing and personal belongings; nothing of value.'}
u.prop('W19-horse', 'rocking-horse', (7.9, 17.4), 'W19-east', rotY=30)
u.objects[-1]['desc'] = 'A child\'s rocking horse: black, wild-eyed, with painted orange flames for a mane, tail and hooves.'
u.note('W19-horse-note', (7.9, 17.4), 'W19-east', 'The toy nightmare bears the name Beucephalus and the toymaker\'s motto: a Blinsky piece (N7).')
u.prop('W19-toys', 'doll', (8.3, 16.0), 'W19-east')
# W18 kitchen and dining room
u.prop('W18-table', 'table', (10.45, 16.55), 'W18', rotY=90, dims={'w': 8, 'd': 3.5})
for i, (x, z, r) in enumerate([(9.95, 15.95, 90), (9.95, 16.55, 90), (9.95, 17.15, 90), (10.95, 15.95, -90), (10.95, 16.55, -90), (10.95, 17.15, -90), (10.45, 15.55, 0), (10.45, 17.55, 180)]):
    u.prop(f'W18-chair{i}', 'chair', (x, z), 'W18', rotY=r)
u.prop('W18-cupboard1', 'cabinet', (9.75, 15.2), 'W18'); u.prop('W18-cupboard2', 'cabinet', (9.2, 16.1), 'W18', rotY=90)
u.objects[-1]['container'] = {'contents': 'Dishware and eating utensils.'}
u.prop('W18-pantry', 'wardrobe', (11.55, 15.25), 'W18'); u.objects[-1]['desc'] = 'A tall pantry closet.'
u.objects[-1]['container'] = {'contents': 'Cooking ingredients and the winery\'s stores.'}
u.prop('W18-stove', 'stove', (11.6, 16.2), 'W18')
# W17 master bedroom
u.prop('W17-bed', 'four-poster-bed', (14.25, 16.5), 'W17', rotY=90)
u.objects[-1]['desc'] = 'A four-poster whose headboard is carved as a great raven.'
u.prop('W17-rug', 'fur-rug', (13.0, 16.5), 'W17', dims={'w': 5, 'd': 7})
u.prop('W17-ward1', 'wardrobe', (12.4, 17.6), 'W17', rotY=180); u.prop('W17-ward2', 'wardrobe', (14.6, 17.6), 'W17', rotY=180)
u.prop('W17-tapestry', 'tapestry', (13.5, 17.95), 'W17', rotY=180, dims={'w': 5})
u.objects[-1]['desc'] = 'A hanging that shows a church.'
u.prop('W17-cradle', 'cradle', (13.5, 17.45), 'W17', rotY=90)
u.prop('W17-desk', 'desk', (13.5, 15.3), 'W17'); u.prop('W17-chair', 'chair', (13.5, 15.75), 'W17', rotY=180)
u.objects[-2]['container'] = {'contents': 'Wine shipping manifests going back a century: BV, BW, K and VISTANI; the oldest also list S.'}
u.prop('W17-chest', 'crate-chest', (12.55, 15.4), 'W17')
u.objects[-1]['container'] = {'locked': True, 'contents': '50 gp, 270 ep stamped with Strahd\'s profile, 350 sp.'}
u.prop('W17-mirror', 'standing-mirror', (12.2, 16.0), 'W17', rotY=90)
u.hidden('W17-bedpost', 'desk-key', (14.8, 15.85), 'W17', 'A loose knob on one bedpost hides the key to the chest.')
u.hidden('W17-lid', 'jewelry-box', (12.55, 15.4), 'W17', 'Secret compartment in the chest lid (DC 15 Perception): gold locket (25 gp) with a portrait of Angelika, Davian\'s late wife; pouch of five 50 gp gems.')
u.note('W17-manifests', (13.5, 15.3), 'W17', 'Desk manifests: almost every shipment to BV (Blood o\' the Vine), BW (Blue Water Inn), K (Krezk) and VISTANI; the oldest to S (Strahd).')
# hall, turrets, landings
u.prop('W4-stairhead', 'stone-spiral', (10.6, 18.4), 'W11-hall', dims={'r': 2.6, 'rise': 0.6, 'turns': 0.25})
u.prop('W11-stairhead', 'stone-spiral', T11, 'W11-upper', dims={'r': 4.6, 'rise': 0.6, 'turns': 0.25})
# W16 loading winch, the hole over the dock, the druid with the Gulthias staff
u.prop('W16-winch', 'loading-winch', (17, 16.1), 'W16', dims={'reach': 7})
for i, (x, z) in enumerate([(16, 17), (18, 17), (16, 19), (18, 19)]): u.prop(f'W16-post{i}', 'post-round', (x, z), 'W16', dims={'r': 0.4, 'h': 10})
u.creature('W16-druid', 'druid', (17, 16.1), 'W16', 'Druid (NE male human): wild hair, rotted teeth, skin painted with blood, squatting on the winch and raving in Druidic that nature obeys him now he holds the vampire\'s staff. Fights only if cornered; drops through the hole onto the wagon in W2 and hides')
u.objects[-1]['dims'] = {'v': 2}; u.objects[-1]['pos'][1] = 7.9
u.note('W16-staff', (17.4, 16.3), 'W16', 'The Gulthias staff (appendix C): destroy it and every blight within 300 ft withers and dies.')
u.note('W16-hole', (17, 18), 'W16', 'A 10-ft-square drop through the floor onto the dock wagon (W2), 15 ft below.')
# roofs (over the whole upper floor), turret cones, ivy on the upper walls
u.prop('roof-main', 'winery-roof', (9, 19), None, dims={'w': 60, 'd': 40, 'h': 16, 'y': 10})
u.prop('roof-W16', 'winery-roof', (17, 17.5), None, dims={'w': 20, 'd': 25, 'h': 11, 'y': 10})
u.prop('roof-W12', 'winery-roof', (15.5, 21), None, dims={'w': 5, 'd': 10, 'h': 4, 'y': 10})
for i, (x, z) in enumerate((T11, T12)): u.prop(f'turret-cap{i}', 'roof-cone', (x, z), None, dims={'r': 6, 'h': 13, 'y': 10})
for i, (x, z, o, w) in enumerate([(5.5, 15, 'n', 0.9), (7.5, 15, 'n', 0.9), (9.5, 15, 'n', 0.9), (12, 15, 'n', 1.8), (3, 15.5, 'w', 0.9), (19, 17.5, 'e', 0.9), (3, 19.6, 'w', 1.0), (17.8, 20, 's', 1.6)]):
    ivy(u, f'ivy-up{i}', x, z, o, w, 9, 20 + i)
for i, x in enumerate((4.5, 14.5)): ivy(b, f'ivy-bal{i}', x, 23, 's', 0.9, 14, 40 + i)   # between the balcony windows, clear of W10's roof
u.prop('W9-rafter1', 'beam', (7.5, 21), None, rotY=90, dims={'len': 20}); u.objects[-1]['pos'][1] = 6
u.prop('W9-rafter2', 'beam', (11.5, 21), None, rotY=90, dims={'len': 20}); u.objects[-1]['pos'][1] = 6

# ================================================================== cellar (W13-W15), 10 ft down
c = Level('cellar', 'Cellar', -10, 10, ambient='darkness', interior='brick', exterior='rubble', north='-z')
c.room('W14-a', 'Wine Cellar (west)', [(3, 19), (9, 19), (9, 22), (10, 22), (10, 23), (3, 23)], 'flagstone', page=pg('W14'), ceilingFt=10)
c.room('W14-b', 'Wine Cellar (east)', rect(10, 19, 16, 23), 'flagstone', page=pg('W14'), ceilingFt=10)
CAVE = [(4, 19), (4.3, 18.3), (5.2, 17.7), (6.5, 17.2), (8, 17.0), (9.5, 16.9), (11, 17.0), (12.4, 17.3), (13.4, 17.8), (14, 18.5), (14, 19)]
W15P = [(9, 22), (9, 19), (4, 19)] + CAVE[1:-1] + [(14, 19), (10, 19), (10, 22)]
c.room('W15', 'Brown Mold', W15P, 'dirt', page=pg('W15'), ceilingFt=7)
c.room('W13', 'Back Staircase', rect(10, 23, 14, 24), 'flagstone', page=pg('W13'), ceilingFt=10)
c.room('W11-cellar', 'Spiral Staircase (foot)', A11 + [(3, 23)], 'flagstone', page=pg('W11'), ceilingFt=10)
c.room('W12-cellar', 'Ramp (foot)', A12 + [(16, 23)], 'plank', page=pg('W12'), ceilingFt=10)
for a, z in [((3, 22), (3, 23)), ((3, 23), (4, 23)), ((15, 23), (16, 23)), ((16, 22), (16, 23))]: seg(c, a, z, open_wall=True)
for p, q in zip(CAVE, CAVE[1:]): ov(c, p, q, material='cave-rock')
for a, z in [((9, 19), (9, 22)), ((10, 19), (10, 22))]: seg(c, a, z, material='brick')
c.secret((9, 22), (10, 22), 'W15', 'Secret door at the foot of the brick wall: pushes open (with effort) on a freezing passage north (W15)', 'W14-a')
c.door((13, 23), (14, 23), id='W13-door')
c.prop('W13-stairs', 'stairs-straight', (11.5, 23.5), 'W13', dims={'w': 5, 'rise': 10, 'fromX': 65, 'toX': 50})
for i, (x, z) in enumerate([(4, 20), (6, 20), (8, 20), (4, 22), (6, 22), (8, 22), (11, 20), (13, 20), (15, 20), (11, 22), (13, 22), (15, 22)]):
    c.prop(f'W14-pillar{i}', 'post-round', (x, z), 'W14-a' if x < 9 else 'W14-b', dims={'r': 0.5, 'h': 10})
c.prop('W14-rack-a', 'bottle-rack', (6, 21), 'W14-a', dims={'len': 20, 'h': 8, 'fill': 0, 'two': 1})
c.objects[-1]['desc'] = 'A tall timber rack dividing the room, empty of bottles.'
c.prop('W14-rack-b', 'bottle-rack', (13, 21), 'W14-b', dims={'len': 20, 'h': 8, 'fill': 0.45, 'two': 1})
c.objects[-1]['desc'] = 'A tall timber rack dividing the room, half full of bottles.'
for i, x in enumerate((10.5, 11.2, 12.4)):
    c.prop(f'W14-frost{i}', 'barrel', (x, 19.45), 'W14-b', rotY=90, dims={'lying': 1})
c.objects[-1]['desc'] = 'Frost-rimed barrels against the cold north wall, each branded "Purple Grapemash No. 3".'
c.prop('W14-bottle', 'wine-bottle', (7.3, 21.9), 'W14-a', rotY=30); c.objects[-1]['desc'] = 'One forgotten bottle lying on the flags (the cheap Purple Grapemash No. 3).'
c.note('W14-wine', (13, 21), 'W14-b', 'Forty bottles of Red Dragon Crush on the eastern rack; three barrels of Purple Grapemash No. 3 against the north wall. The druid\'s opening thunderwave shatters 1d20+10 bottles.')
c.creature('W14-druid', 'druid', (13.2, 20.2), 'W14-b', 'Druid (NE male human) crowned with antlers, behind the eastern rack: opens with thunderwave, then sends the needle blights')
c.objects[-1]['dims'] = {'v': 1}
for i, (x, z) in enumerate([(11.2, 20.4), (12.2, 19.9), (14.0, 20.1), (14.9, 20.6), (11.9, 20.7)]):
    c.creature(f'W14-needle{i}', 'needle-blight', (x, z), 'W14-b', 'Needle blight (5) lurking behind the eastern rack')
for i, (x, z, w) in enumerate([(9.5, 19.4, 0), (9.2, 18.4, 1), (9.8, 18.2, 1), (7.4, 17.8, 0), (11.6, 17.7, 0), (5.4, 18.3, 0), (13.2, 18.4, 0), (8.6, 17.4, 0), (10.4, 17.4, 0), (12.2, 18.6, 0)]):
    c.prop(f'W15-mold{i}', 'brown-mold', (x, z), 'W15', dims={'r': 2.2 + (i % 3) * 0.6, 'wall': w})
c.note('W15-mold-note', (9.5, 18.6), 'W15', 'Ten patches of brown mold (DMG ch.5) round the archway and in the cave; they keep the cellar cold. Safe at a distance; warmth makes them spread.')
c.prop('W11-foot', 'stone-spiral', T11, 'W11-cellar', dims={'r': 4.6, 'rise': 10, 'turns': 0.75})
c.prop('W12-foot', 'spiral-ramp', T12, 'W12-cellar', dims={'r': 4.6, 'rise': 10, 'turns': 0.7})
c.note('W14-note', (6.5, 22.5), 'W14-a', 'Ice-cold cellar, 10-ft ceiling on wooden pillars and beams; a thin mist on the floor. It grows colder toward the north wall.')

# ================================================================== descriptions (own words)
DESC = {
  'W1': ("A newer plank stable built onto the winery's east end: a big sliding door, an aisle, and two stalls bedded with straw.", "The family's two draft horses, which haul the wine wagon."),
  'W2': ("An open-fronted dock: a flatbed wagon carrying three braced barrels, a raised plank walk round three sides, and overhead an opening where a crane's arm and hooks hang down.", "Barrels roll up the ramp (W12) to the winch (W16) and drop onto the wagon. All three hold Purple Grapemash No. 3. The south door was forced; it no longer shuts, only barricades."),
  'W3': ("The cooper's shop: stacked oak staves and iron hoops, tools hung all over the walls, two workbenches along the east side.", "The outer (north) door is barred on the inside."),
  'W4': ("A store crowded with rows of new barrels; a tight stone stair winds up from the south-west corner.", "Thirteen barrels, all empty. The stair comes out in the upper hall."),
  'W5': ("A paved porch under stone arches: three big tubs stained purple with juice, each with a little ladder and a basin set beneath its spout.", "The grapes are trodden here. The big sliding doors are chained and the small door barred from inside; forcing either takes a DC 20 Strength check."),
  'W6': ("A deep well inside a mossy ring of close-set stones.", "40 feet deep."),
  'W7': ("A rickety plank privy with bunches of sweet herbs under its eaves and a moon cut in the door.", "Nothing of note."),
  'W8': ("Empty hooks on the walls, shelves of juice-stained wooden clogs with wide soles, a stout timber on the floor; both doors stand open.", "The wereravens took their cloaks when they fled and left the treading clogs. The timber drops into brackets to bar the outer door."),
  'W9': ("A lofty hall reeking of fermenting wine: four giant vats, a stair up to a timber gallery along the south wall, old branded barrels stacked under it, and ravens lining the rafters.", "A druid doses the western vats from the gallery; 24 twig blights lurk in the cracked eastern vat; the four raven swarms take the party's side."),
  'W9-balcony': ("A timber gallery ten feet above the floor, hugging the south wall below four windows and rising a few steps at either end.", "The druid stands over the westernmost vat."),
  'W9-west': ("The top of the gallery's west steps, and a door to the upper floor.", "15 ft up; the door opens on the spiral stair's hall (W11)."),
  'W9-east': ("The top of the gallery's east steps, and a door to the upper floor.", "15 ft up; the door opens into the winch room (W16)."),
  'W10': ("Glassblowing tools, a rack of new unlabelled bottles on the south wall, a brick hearth in the south-west corner beside a barrel of sand, and steps going down; grey light through a grimy window.", "The steps lead to W13. The outer (east) door is barred on the inside."),
  'W11': ("A round stone tower with a winding stair, lit by slit windows.", "Runs from the cellar to the upper floor."),
  'W11-upper': ("The top of the winding stair and a passage leading north to the bedrooms.", "A door off the passage opens on the gallery's west landing."),
  'W11-cellar': ("The bottom of the winding stair, chill and damp.", "Opens into the west half of the wine cellar (W14)."),
  'W11-hall': ("A plank passage past the bedroom doors, the narrow stair from the barrel store arriving halfway along.", "The narrow stair comes up from W4; the east end opens into W16."),
  'W12': ("A round tower whose plank floor winds upward like a corkscrew, gouged by rolling barrels.", "The druids use it to get between floors."),
  'W12-upper': ("The head of the barrel ramp, opening into the winch room.", "Barrels are rolled up here to the winch (W16)."),
  'W12-cellar': ("The foot of the barrel ramp.", "Opens into the east half of the wine cellar (W14)."),
  'W13': ("Moss-furred steps down to a landing and an arched door to the north.", "Joins W10 and W14."),
  'W14-a': ("A freezing cellar of timber posts and beams, mist curling over the floor; a tall rack stands empty; one bottle lies on the flags.", "A hidden door at the south end of the brick wall leads to W15."),
  'W14-b': ("The colder half of the cellar: rime-crusted barrels along the north wall and a tall rack half full of bottles.", "An antlered druid and five needle blights wait behind the rack. The bottles are Red Dragon Crush."),
  'W15': ("A bitter-cold passage through the brick wall to an arch and a low cave, every surface furred with brown mold.", "Ten patches of brown mold; stay well back."),
  'W16': ("A plank floor with a square drop to the dock below and a timber winch standing over it; a wild man squats on top, brandishing a crooked black staff.", "The druid holds the Gulthias staff. A hidden door at the north end of the west wall leads to W17."),
  'W17': ("A four-poster carved with a great raven, a black fur rug, two narrow wardrobes either side of a hanging that shows a church, a carved cradle, a plain desk under the window, a chest and a tall mirror.", "Stefania and Dag sleep here for now. The chest is locked (its key is in a bedpost); shipping records in the desk; a hidden door at the north end of the east wall leads to W16."),
  'W18': ("A long table and its eight chairs, a corner cupboard, a tall pantry closet and a small iron stove.", "Crockery in the cupboard; food and stores in the pantry."),
  'W19-west': ("Four bunks in two stacks, and four matching footlockers along the west wall.", "Where Davian and his two sons sleep."),
  'W19-east': ("Four bunks in two stacks, four footlockers and toys strewn about, a flame-maned black rocking horse among them.", "The grandsons' room. The toy horse is a Blinsky piece called Beucephalus."),
  'W20': ("A desk and chair, a tall cabinet, and a big wooden machine taking up the north end: a press for printing wine labels; the door stands open.", "A mud-caked druid and two vine blights are ransacking the cabinet, which holds the padlock key."),
}
levels = [c, g, b, u]
L5 = lambda id, kind, al, ap, bl, bp: OrderedDict(id=id, kind=kind, **{'from': OrderedDict(level=al, pos=[round(ap[0] * 5, 2), round(ap[1] * 5, 2)]), 'to': OrderedDict(level=bl, pos=[round(bp[0] * 5, 2), round(bp[1] * 5, 2)])})
links = [
    L5('W11-up', 'spiral', 'ground', (3.35, 23.3), 'upper', (3.35, 23.3)), L5('W11-down', 'spiral', 'ground', (2.6, 23.3), 'cellar', (2.6, 23.3)),
    L5('W12-up', 'stairs', 'ground', (16.35, 23.3), 'upper', (16.35, 23.3)), L5('W12-down', 'stairs', 'ground', (15.6, 23.4), 'cellar', (15.6, 23.4)),
    L5('W4-up', 'spiral', 'ground', (10.6, 18.4), 'upper', (10.6, 18.4)),
    L5('W13', 'stairs', 'ground', (10.4, 23.5), 'cellar', (13.5, 23.5)),
    L5('W9-stair', 'stairs', 'ground', (9.5, 20.3), 'balcony', (9.5, 22.5)),
    L5('W9-west', 'stairs', 'balcony', (4.5, 20.6), 'upper', (4.5, 19.5)), L5('W9-east', 'stairs', 'balcony', (14.5, 20.6), 'upper', (14.5, 19.5)),
    L5('W16-hole', 'shaft', 'upper', (17, 18), 'ground', (17, 18)),
]
scene = OrderedDict(schema=1, location='W', chapter='ch12', name='The Wizard of Wines', mapPage=175, bookScaleFt=5, ambient=AMB, stacked=True, entry='ground',
                    levels=[lv.to_json() for lv in levels], links=links)
for lv in scene['levels']:
    for r in lv['rooms']:
        d = DESC.get(r['key'])
        if d:
            r['desc'] = d[0]
            if d[1]: r['dm'] = d[1]
    for o in lv['objects']:
        if o['vis'] in ('hidden-object', 'hidden-creature') and 'playerLabel' not in o:
            o['playerLabel'] = {'niche': 'Something of note', 'druid': 'A wild figure', 'needle-blight': 'A needled shape', 'twig-blight': 'Skittering twigs',
                                'vine-blight': 'A heap of dead vines', 'swarm-of-ravens': 'Ravens', 'wereraven': 'A cloaked figure', 'horse': 'A draft horse',
                                'commoner': 'A baby'}.get(o['kind'], 'Something')
grid = OrderedDict(schema=1, levels=OrderedDict((lv.id, OrderedDict(
    floorPolygons=[[[x * 5, z * 5] for x, z in p] for p in lv.floor_polys] + [[[x * 5, z * 5] for x, z in p] for p, _ in lv.terrain[:1]],
    type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0.55)) for lv in levels))
out = os.path.join(ROOT, 'locations', 'ch12', 'W'); os.makedirs(out, exist_ok=True)
json.dump(scene, open(os.path.join(out, 'scene.json'), 'w'), indent=1)
json.dump(grid, open(os.path.join(out, 'grid.json'), 'w'), indent=1)
print('wizard of wines:', [(lv.id, len(lv.rooms), len(lv.objects)) for lv in levels], 'vine rows', rows)
