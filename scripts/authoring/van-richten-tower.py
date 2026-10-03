#!/usr/bin/env python3
"""Van Richten's Tower (chapter 11, area V; map p.170, one square = 5 ft) -> locations/ch11/V/{scene,grid}.json

Khazan's stone tower on its marshy island in Lake Baratok, read off the book's four floor panels (a 400-dpi render
with its grid measured at 81.6 px a square; every panel's lift shaft falls on the same grid square, so the floors
stack on it). The first three floors are octagons twenty feet across inside (flats on the half-square lines round
the shaft's square, 10-ft flats and 7-ft diagonals), with stone buttresses at the four diagonals carrying the mossy
griffons; the fourth floor overhangs them, twenty-five feet across, with a window box in each of its four faces.
Each floor is 20 ft high (the tower stands 80 ft, under a slate roof). The tower door (V2) and its 5-ft vestibule
face south; Ezmerelda's wagon (V1) stands south-east of it; the rickety scaffolding (V3) climbs the west and
north-west faces to the gash in the third floor's north-west wall. Arrow slits on floors two to four; the lift's
shaft through floors two and three, whose rotten boards have fallen away round it as the panels show. The causeway
runs a hundred yards east-south-east to the shore (the regional map puts the island in Lake Baratok's south-east
lobe, the marker on the shore beside it). Only positions, sizes and keys live here; the wording is ours."""
import json, math, os, sys
from collections import OrderedDict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from authorlib import ROOT, Level, rect, unit_edges, seg_key  # noqa: F401
from shapely.geometry import Polygon as SPoly, LineString, box as sbox
from shapely.ops import unary_union

_M = json.load(open(os.path.join(ROOT, 'manifests', 'locations.json')))
PAGE = {a['key']: a['page'] for l in _M['locations'] if l['id'] == 'V' for a in l['areas']}
pg = lambda k: PAGE.get(k)
CX, CZ = 50.5, 44.5          # the lift shaft's square is the tower's centre
FX, FZ = 140, 124            # the frame, cells
AMB = 'barovian-overcast'

def pt(dx, dz): return (round(CX + dx, 4), round(CZ + dz, 4))
def lerp(a, b, t): return (round(a[0] + (b[0] - a[0]) * t, 4), round(a[1] + (b[1] - a[1]) * t, 4))

def octagon(r, c, splits=None):
    """The octagon's corners clockwise from the north flat's west end, with extra points on named edges
    (N, NE, E, SE, S, SW, W, NW) at fractions along them. Returns the points and each edge's pieces."""
    P = [pt(-c, -r), pt(c, -r), pt(r, -c), pt(r, c), pt(c, r), pt(-c, r), pt(-r, c), pt(-r, -c)]
    names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    pts, pieces = [], {}
    for i, nm in enumerate(names):
        a, b = P[i], P[(i + 1) % 8]
        ts = [0] + sorted((splits or {}).get(nm, [])) + [1]
        seg = [lerp(a, b, t) for t in ts]
        pieces[nm] = list(zip(seg[:-1], seg[1:]))
        pts += seg[:-1]
    return pts, pieces

def keyhole(outer, start, hole):
    """Floor with a hole: the outer ring from `start`, a bridge in to the hole, the hole the other way round, and back."""
    i = outer.index(start); o = outer[i:] + outer[:i]
    area = lambda p: sum(p[k][0] * p[(k + 1) % len(p)][1] - p[(k + 1) % len(p)][0] * p[k][1] for k in range(len(p)))
    hl = [pt(*q) for q in hole]
    if (area(o) > 0) == (area(hl) > 0): hl = hl[::-1]
    j = min(range(len(hl)), key=lambda k: (hl[k][0] - start[0]) ** 2 + (hl[k][1] - start[1]) ** 2)
    hl = hl[j:] + hl[:j]
    return o + [start] + hl + [hl[0]], (start, hl[0])

def stamp(lv, a, b, **kw):
    """Override the wall on a-b: matched against the unit edges the level's rooms actually produce (so float noise in
    a piece's end never misses it)."""
    close = lambda p, q: abs(p[0] - q[0]) < 1e-6 and abs(p[1] - q[1]) < 1e-6
    hit = False
    for _, _, poly, _, _ in lv.rooms:
        for p, q in unit_edges(poly):
            if (close(p, a) and close(q, b)) or (close(p, b) and close(q, a)):
                k = seg_key(p, q); lv.overrides[k] = dict(lv.overrides.get(k, {}), **kw); hit = True
    if not hit: raise ValueError(f'no wall at {a}-{b} on {lv.id}')
def open_poly(lv, poly):
    for a, b in unit_edges(poly): stamp(lv, a, b, open_wall=True)
def open_seg(lv, a, b): stamp(lv, a, b, open_wall=True)
def window_seg(lv, a, b): stamp(lv, a, b, flags=['window'], wall=True)

def tag(lv, oid, **kw):
    for o in lv.objects:
        if o['id'] == f'{lv.id}-{oid}':
            for k, v in kw.items(): o[k] = v
            return o
    raise KeyError(oid)

SLITS = [0.2, 0.3, 0.7, 0.8]          # two arrow slits on a 10-ft flat
DSLITS = [0.3, 0.4, 0.6, 0.7]         # two on a diagonal

# ---------------------------------------------------------------- the grounds: the island, the causeway, the shore
U = (0.898, 0.441)                     # east-south-east, toward the shore
ISLAND_C = (51.5, 47.6)
island = SPoly([(ISLAND_C[0] + math.cos(a) * 15.5 * (1 + 0.1 * math.sin(3 * a + 1) + 0.06 * math.cos(5 * a)), ISLAND_C[1] + math.sin(a) * 12.5 * (1 + 0.1 * math.cos(2 * a + 0.5) + 0.05 * math.sin(7 * a)))
                for a in [k / 28 * 2 * math.pi for k in range(28)]])
SHORE = [(130, 0), (128, 15), (126, 32), (124, 50), (121.5, 66), (119, 79), (113, 91), (101, 100.5), (83, 106), (58, 110), (30, 113), (0, 116)]
shore = SPoly(SHORE + [(0, FZ), (FX, FZ), (FX, 0)])
cw_a = (ISLAND_C[0] + U[0] * 11, ISLAND_C[1] + U[1] * 11)
cw_b = (cw_a[0] + U[0] * 66, cw_a[1] + U[1] * 66)
causeway = LineString([cw_a, cw_b]).buffer(1.6, cap_style=2)
frame = sbox(0, 0, FX, FZ)
lake = frame.difference(unary_union([shore, island, causeway]))
assert lake.geom_type == 'Polygon' and not lake.interiors, 'the island must join the shore by the causeway'
causeway_only = causeway.difference(island).difference(shore)
def ring(poly):
    geom = max(poly.geoms, key=lambda g: g.area) if poly.geom_type == 'MultiPolygon' else poly
    return [(round(x, 2), round(y, 2)) for x, y in list(geom.exterior.coords)[:-1]]

g = Level('grounds', 'Grounds and first floor (V1-V4)', 0, 20, ambient='interior-dim', interior='ashlar', exterior='ashlar', north='-z')
g.terrain.append((ring(shore), 'grass'))
g.terrain.append((ring(island), 'marsh'))
g.terrain.append((ring(causeway_only), 'grass'))
g.terrain.append((ring(lake), 'shallow-water'))
# the trail: from the door steps south round the wagon, out along the causeway's crown and into the woods
TRAIL = [(CX, CZ + 3.6), (CX - 0.2, CZ + 6), (CX + 1.2, CZ + 8.6), (CX + 4.5, CZ + 9.8), (cw_a[0] + 1, cw_a[1] + 0.4), cw_b, (cw_b[0] + 6, cw_b[1] + 1.2), (FX, cw_b[1] + 3)]
TRAIL_W = [1.0, 1.0, 1.1, 1.1, 0.9, 0.9, 0.9, 0.9]
trail = unary_union([LineString(TRAIL[i:i + 2]).buffer(TRAIL_W[i], cap_style=1) for i in range(len(TRAIL) - 1)])
for poly in (trail.geoms if trail.geom_type == 'MultiPolygon' else [trail]):
    g.terrain.append(([(round(x, 2), round(y, 2)) for x, y in list(poly.simplify(0.05).exterior.coords)[:-1]], 'dirt'))

# V4: the first floor, its vestibule (V2) with the iron door south and the torn curtain north
f1_pts, f1_pc = octagon(2, 1, {'S': [0.25, 0.75]})
g.room('V4', 'Tower, First Floor', f1_pts, 'flagstone', page=pg('V4'), ceilingFt=20)
VEST = rect(CX - 0.5, CZ + 2, CX + 0.5, CZ + 3)
g.room('V2', 'Tower Door', VEST, 'flagstone', page=pg('V2'), ceilingFt=10)
g.opening((CX + 0.5, CZ + 2), (CX - 0.5, CZ + 2))
g.door((CX - 0.5, CZ + 3), (CX + 0.5, CZ + 3), id='V2-door', locked=True)
# V1 and V3: open ground round the wagon and at the foot of the scaffolding
WAG = (CX + 2.7, CZ + 5.0)
V1R = rect(CX + 0.9, CZ + 3.8, CX + 4.6, CZ + 6.3)
g.room('V1', "Ezmerelda's Magic Wagon", V1R, 'marsh', page=pg('V1'))
open_poly(g, V1R)
V3R = [(CX - 4.1, CZ + 1.9), (CX - 4.1, CZ - 2.4), (CX - 3.1, CZ - 3.4), (CX - 2.5, CZ - 2.6), (CX - 2.55, CZ + 1.9)]
g.room('V3', 'Rickety Scaffolding', V3R, 'marsh', page=pg('V3'))
open_poly(g, V3R)
# the tower's own stone: a plinth course round the base, the four buttresses with their griffons
g.prop('plinth', 'tower-plinth', (CX, CZ), 'V4', dims={'r': 12.6, 'h': 1.6})
for i, (dx, dz) in enumerate([(1, -1), (-1, -1), (-1, 1), (1, 1)]):
    base = 2.55 / math.sqrt(2)
    g.prop(f'buttress{i}', 'tower-buttress', (CX + dx * base, CZ + dz * base), 'V4', rotY=round(math.degrees(math.atan2(-dz, dx)), 1), dims={'h': 36, 'len': 5.5, 'w': 3.2, 'v': i})
g.prop('steps', 'stone-step', (CX, CZ + 3.35), 'V2', dims={'w': 6.5, 'd': 3})
g.prop('curtain', 'drapes', (CX, CZ + 2.05), 'V2', dims={'w': 4.6, 'color': 0x5a4a44})
g.prop('lintel', 'khazan-lintel', (CX, CZ + 3.05), 'V2', dims={'w': 6.4, 'y': 7.2})
g.note('door-trap', (CX + 1.1, CZ + 3.6), 'V2', 'Iron door, no handle or hinges; KHAZAN on the lintel; the eight-figure symbol (show the players). Touching it before the dance: lightning sheath, 10 ft round the tower, DC 15 Dex (disadv. in metal armour), 4d10, lasts 10 min; third time, the tower collapses (24d10 inside, 8d10 within 20 ft). Wrong dance: a young blue dragon appears.')
g.note('door-dance', (CX - 1.2, CZ + 3.6), 'V2', 'Open it by miming the eight figures\' arm positions in order along the lines, from either end, within 5 ft: it swings open for 10 minutes. From inside it opens safely and shuts itself after a minute.')
# V4 inside: the lift's square pit with its pulleys and chains, the four clay golems by them, crates by the east wall, debris
g.prop('lift', 'lift-chains', (CX, CZ), 'V4', dims={'h': 20, 'pit': 1})
for i, (dx, dz) in enumerate([(-0.75, -0.78), (0.72, -0.75), (-0.72, 0.74), (0.74, 0.72)]):
    g.prop(f'golem{i}', 'clay-golem', (CX + dx, CZ + dz), 'V4', rotY=round(math.degrees(math.atan2(dz, -dx)), 1))
    tag(g, f'golem{i}', label='Clay golem', playerLabel='A tall clay statue',
        dm='Clay golem (one of four). Raises and lowers the lift on request, 5 ft a round, jerky; if one is destroyed the others stop until attacked.')
for i, (dx, dz, r) in enumerate([(1.55, -0.75, 5), (1.61, -0.22, 32), (1.44, 0.38, 48), (1.12, 1.15, 10)]):
    g.prop(f'crate{i}', 'crate-chest', (CX + dx, CZ + dz), 'V4', rotY=r)
    tag(g, f'crate{i}', container=OrderedDict(contents='Empty.'))
for i, (dx, dz, r) in enumerate([(-1.3, -0.4, 20), (-1.0, 0.7, 75), (-1.5, 0.9, 140), (-0.6, 1.4, 30), (-1.2, -1.1, 110)]):
    g.prop(f'debris{i}', 'vr-debris', (CX + dx, CZ + dz), 'V4', rotY=r, dims={'s': 1 + (i % 2) * 0.3})
# V1: the wagon, its secrets
g.prop('wagon', 'ezmerelda-wagon', WAG, 'V1', rotY=0)
tag(g, 'wagon', desc='A mud-spattered, barrel-topped wagon in fresh purple paint with gold-trimmed wheels; brass lanterns at its corners, red drapes in tombstone-shaped windows, a padlocked back door with a cheap wooden "Keep out!" sign.',
    dm='Conjuration aura. Sit in the driver\'s seat and say "Drovash" for two quasi-real draft horses (speed 30), "Arvesh" to dismiss. Treasure: claw-marked trunk of weapons (battleaxe, flail, morningstar, light crossbow, 10 silvered bolts); wardrobe of clothes, mask and wigs; climber\'s, disguise, healer\'s and poisoner\'s kits; a golden-stringed lyre (50 gp); a caged chicken and a silver ewer (100 gp) of eggs; a tarokka deck in silk; copper pots (50 gp); three manacles; a shovel; a chest with a gold Morninglord symbol (100 gp), holy water, perfume, antitoxin, rope, tinderbox, mirror, stake and spyglass; scrolls of major image and remove curse; a map of Barovia; a charred page of van Richten\'s journal.')
g.hidden('wagon-hatch', 'trapdoor', (WAG[0] - 0.3, WAG[1] + 0.25), 'V1', 'Hidden trapdoor in the underbelly (DC 13 Wisdom (Perception) from underneath): the only safe way in')
tag(g, 'wagon-hatch', playerLabel='A hatch under the wagon', pos=[round((WAG[0] - 0.3) * 5, 2), 0.05, round((WAG[1] + 0.25) * 5, 2)])
g.hidden('wagon-trap', 'niche', (WAG[0] - 0.9, WAG[1]), 'V1', 'Booby trap: the back door\'s wire drops a flask of alchemist\'s fire into a hundred more; 10d10 fire within 30 ft (DC 12 Con, half; disadvantage inside or within 5 ft); wagon and contents destroyed. Seen at once from inside; DC 10 Dex to disarm.')
tag(g, 'wagon-trap', vis='trap', playerLabel='A wire on the door handle')
# the island's reeds and scrub, the shore's pines, rocks and bluffs
import random
rng = random.Random(11)
def on_island(p, m=0): return island.buffer(-m).contains(SPoly([(p[0] - 0.1, p[1] - 0.1), (p[0] + 0.1, p[1] - 0.1), (p[0] + 0.1, p[1] + 0.1), (p[0] - 0.1, p[1] + 0.1)]))
from shapely.geometry import Point
keep_out = unary_union([SPoly(f1_pts).buffer(3.6), SPoly(V1R).buffer(0.6), SPoly(V3R).buffer(0.4), trail.buffer(0.6), causeway.buffer(0.2)])
n = 0
for k in range(4000):
    p = (rng.uniform(34, 70), rng.uniform(33, 63))
    q = Point(p)
    edge = island.exterior.distance(q)
    if not island.contains(q) or keep_out.contains(q): continue
    if edge > 2.5 and rng.random() < 0.8: continue
    g.prop(f'reeds{n}', 'marsh-reeds', p, None, rotY=rng.random() * 360, dims={'s': 0.8 + rng.random() * 0.7}); n += 1
    if n >= 70: break
for k in range(60):   # reeds standing in the shallows off the island and along the causeway
    a = rng.random() * 2 * math.pi; p = (ISLAND_C[0] + math.cos(a) * (16.5 + rng.random() * 3), ISLAND_C[1] + math.sin(a) * (13.5 + rng.random() * 3))
    if lake.contains(Point(p)) and causeway.distance(Point(p)) > 1: g.prop(f'reedw{k}', 'marsh-reeds', p, None, rotY=rng.random() * 360, dims={'s': 0.7 + rng.random() * 0.6})
for i, (x, z, s) in enumerate([(41, 41, 0.9), (60, 39, 1.1), (39.5, 52, 1.0), (59, 59.5, 0.8)]):
    if not keep_out.contains(Point(x, z)) and island.contains(Point(x, z)): g.prop(f'deadtree{i}', 'dead-tree', (x, z), None, rotY=i * 80, dims={'scale': s})
for i, (x, z) in enumerate([(44, 38.5), (58, 41.5), (42.5, 56), (56, 57.5), (62.5, 47.5), (37.5, 46)]):
    if not keep_out.contains(Point(x, z)) and island.contains(Point(x, z)): g.prop(f'bush{i}', 'bush', (x, z), None, rotY=i * 50, dims={'scale': 0.9 + (i % 3) * 0.2})
n = 0
for k in range(6000):
    p = (rng.uniform(100, FX - 1), rng.uniform(1, FZ - 1)); q = Point(p)
    if not shore.buffer(-2.5).contains(q) or trail.buffer(2.2).contains(q) or causeway.buffer(2).contains(q): continue
    g.prop(f'pine{n}', 'pine', p, None, dims={'scale': 0.9 + rng.random() * 0.8}); n += 1
    if n >= 160: break
for i, (x, z, r) in enumerate([(125, 30, 4), (129, 58, 5), (116, 96, 3.5), (92, 108, 4), (134, 12, 5), (70, 114, 3)]):
    if shore.buffer(-1).contains(Point(x, z)): g.prop(f'boulder{i}', 'boulder', (x, z), None, rotY=i * 40, dims={'r': r})
g.prop('reeds-shore0', 'marsh-reeds', (117.5, 76.5), None, dims={'s': 1.2}); g.prop('reeds-shore1', 'marsh-reeds', (120.4, 84.0), None, dims={'s': 1.1})

# ---------------------------------------------------------------- V5, the second floor: rotted boards fallen in round the shaft
f2_pts, f2_pc = octagon(2, 1, {'N': SLITS, 'E': SLITS, 'S': sorted(SLITS + [0.5]), 'W': SLITS})
HOLE2 = [(-0.5, -0.5), (0.5, -0.5), (0.62, -0.62), (0.95, -0.55), (1.2, -0.62), (1.45, -0.35), (1.3, -0.05), (1.42, 0.3), (1.15, 0.55), (0.8, 0.72), (0.47, 0.74),
         (0.2, 0.62), (0.0, 0.7), (-0.2, 0.74), (-0.45, 0.6), (-0.5, 0.5), (-0.62, 0.38), (-1.0, 0.32), (-1.45, 0.25), (-1.3, -0.1), (-1.49, -0.45), (-1.1, -0.6), (-0.7, -0.55)]
s2 = Level('f2', 'Second floor (V5)', 20, 20, ambient='interior-dim', interior='ashlar', exterior='ashlar', north='-z')
v5, bridge2 = keyhole(f2_pts, pt(0, 2), HOLE2)
s2.room('V5', 'Tower, Second Floor', v5, 'plank', page=pg('V5'), ceilingFt=20)
open_poly(s2, [pt(*q) for q in HOLE2])
for a, b in unit_edges(list(bridge2)): open_seg(s2, a, b)
for nm in ('N', 'E', 'S', 'W'):
    for a, b in f2_pc[nm]:
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        if abs(L - 0.2) < 1e-6: window_seg(s2, a, b)
V3M = rect(CX - 3.3, CZ - 1.9, CX - 2.3, CZ + 1.5)
s2.room('V3-mid', 'Rickety Scaffolding (second-floor platform)', V3M, 'plank', page=pg('V3'), ceilingFt=20)
open_poly(s2, V3M)
s2.prop('scaffold', 'scaffold', (CX - 2.8, CZ - 0.2), 'V3-mid', rotY=90, dims={'len': 17, 'w': 4.6, 'down': 20, 'up': 3.6, 'ladder': 1, 'ladderUp': 20})
s2.prop('lift', 'lift-chains', (CX, CZ), 'V5', dims={'h': 20})
for i, (dx, dz) in enumerate([(-1.6, -1.6), (1.6, -1.6), (1.6, 1.6), (-1.6, 1.6)]):
    s2.prop(f'web{i}', 'cobweb', (CX + dx, CZ + dz), 'V5', rotY=[315, 45, 135, 225][i], dims={'s': 3.5, 'y': 15})
s2.prop('dust', 'vr-debris', (CX - 1.2, CZ + 1.3), 'V5', rotY=40, dims={'s': 0.8})
s2.note('weak', (CX + 1.2, CZ + 1.4), 'V5', 'The eight 5-ft squares round the shaft hold 150 lb each; more and the section gives way: a 20-ft fall to the first floor.')

# ---------------------------------------------------------------- V6, the third floor: the gash in the north-west wall, the floor falling away
GASH = [0.12, 0.88]
f3_pts, f3_pc = octagon(2, 1, {'NE': DSLITS, 'SE': DSLITS, 'SW': DSLITS, 'S': [0.5], 'NW': GASH})
HOLE3 = [(-0.5, -0.5), (0.5, -0.5), (0.5, -0.34), (0.85, -0.3), (1.26, -0.2), (1.1, 0.05), (1.2, 0.28), (0.8, 0.22), (0.5, 0.25), (0.5, 0.5), (0.0, 0.5), (-0.5, 0.5),
         (-0.5, -0.06), (-0.9, -0.06), (-1.35, -0.15), (-1.2, -0.4), (-1.43, -0.6), (-1.25, -0.85), (-0.9, -0.95), (-0.6, -0.75)]
s3 = Level('f3', 'Third floor (V6)', 40, 20, ambient='interior-dim', interior='ashlar', exterior='ashlar', north='-z')
v6, bridge3 = keyhole(f3_pts, pt(0, 2), HOLE3)
s3.room('V6', 'Tower, Third Floor', v6, 'plank', page=pg('V6'), ceilingFt=20)
open_poly(s3, [pt(*q) for q in HOLE3])
for a, b in unit_edges(list(bridge3)): open_seg(s3, a, b)
for nm in ('NE', 'SE', 'SW'):
    for a, b in f3_pc[nm]:
        if abs(math.hypot(b[0] - a[0], b[1] - a[1]) - 0.1414) < 0.01: window_seg(s3, a, b)
gash = f3_pc['NW'][1]
open_seg(s3, *gash)
nrm = (-1 / math.sqrt(2), -1 / math.sqrt(2))
V3T = [gash[0], gash[1], (round(gash[1][0] + nrm[0] * 1.15, 3), round(gash[1][1] + nrm[1] * 1.15, 3)), (round(gash[0][0] + nrm[0] * 1.15, 3), round(gash[0][1] + nrm[1] * 1.15, 3))]
s3.room('V3-top', 'Rickety Scaffolding (platform at the gash)', V3T, 'plank', page=pg('V3'), ceilingFt=20)
for a, b in unit_edges(V3T):
    if seg_key(a, b) != seg_key(*gash): open_seg(s3, a, b)
TOPC = ((V3T[0][0] + V3T[2][0]) / 2, (V3T[0][1] + V3T[2][1]) / 2)
s3.prop('scaffold', 'scaffold', TOPC, 'V3-top', rotY=45, dims={'len': 8, 'w': 4.2, 'down': 20, 'up': 3.6, 'ladder': 0})
s3.prop('gash-rubble', 'vr-debris', (CX - 1.25, CZ - 1.25), 'V6', rotY=45, dims={'s': 1.2, 'stone': 1})
s3.prop('lift', 'lift-chains', (CX, CZ), 'V6', dims={'h': 20})
for i, (dx, dz, r) in enumerate([(1.9, 0.3, -90), (-1.9, 0.6, 90), (0.4, -1.95, 0), (-0.3, 1.95, 180), (1.3, 1.3, -135)]):
    s3.prop(f'mildew{i}', 'mildew', (CX + dx, CZ + dz), 'V6', rotY=r, dims={'w': 5 + i % 2 * 2, 'h': 9 + i % 3 * 3})
s3.note('weak', (CX + 1.2, CZ + 1.4), 'V6', 'The squares round the shaft hold only 50 lb each; a section that gives way drops its load 40 ft to the first floor, through the second.')

# ---------------------------------------------------------------- V7, the fourth floor: overhanging, a window box in each face
def f4_poly():
    r, c = 2.5, 1.5
    P = [pt(-c, -r), pt(c, -r), pt(r, -c), pt(r, c), pt(c, r), pt(-c, r), pt(-r, c), pt(-r, -c)]
    out, wins, slits = [], [], []
    def diag(a, b):
        for t in DSLITS: out.append(lerp(a, b, t))
        slits.extend([(lerp(a, b, DSLITS[0]), lerp(a, b, DSLITS[1])), (lerp(a, b, DSLITS[2]), lerp(a, b, DSLITS[3]))])
    out += [P[0], pt(-0.5, -r), pt(-0.5, -r - 0.5), pt(0.5, -r - 0.5), pt(0.5, -r)]; wins.append((pt(-0.5, -r - 0.5), pt(0.5, -r - 0.5)))
    out.append(P[1]); diag(P[1], P[2])
    out += [P[2], pt(r, -0.5), pt(r + 0.5, -0.5), pt(r + 0.5, 0.5), pt(r, 0.5)]; wins.append((pt(r + 0.5, -0.5), pt(r + 0.5, 0.5)))
    out.append(P[3]); diag(P[3], P[4])
    out += [P[4], pt(0.5, r), pt(0.5, r + 0.5), pt(-0.5, r + 0.5), pt(-0.5, r)]; wins.append((pt(0.5, r + 0.5), pt(-0.5, r + 0.5)))
    out.append(P[5]); diag(P[5], P[6])
    out += [P[6], pt(-r, 0.5), pt(-r - 0.5, 0.5), pt(-r - 0.5, -0.5), pt(-r, -0.5)]; wins.append((pt(-r - 0.5, 0.5), pt(-r - 0.5, -0.5)))
    out.append(P[7]); diag(P[7], P[0])
    return out, wins, slits
f4_pts, f4_wins, f4_slits = f4_poly()
s4 = Level('f4', 'Fourth floor (V7)', 60, 20, ambient='interior-dim', interior='ashlar', exterior='ashlar', north='-z')
s4.room('V7', 'Tower, Fourth Floor', f4_pts, 'plank', page=pg('V7'), ceilingFt=20)
for a, b in f4_wins + f4_slits: window_seg(s4, a, b)
s4.prop('corbels', 'corbel-ring', (CX, CZ), 'V7', dims={'r': 12.9, 'n': 28, 'y': -2.2})
s4.prop('roof', 'roof-cone', (CX, CZ), 'V7', rotY=22.5, dims={'r': 15.2, 'h': 21, 'y': 20})
s4.prop('rafters', 'rafters', (CX, CZ), 'V7', dims={'r': 13, 'y': 18})
for i, (dx, dz, r) in enumerate([(0, -3.12, 0), (3.12, 0, -90), (0, 3.12, 180), (-3.12, 0, 90)]):
    s4.prop(f'windowbox{i}', 'window-box', (CX + dx, CZ + dz), 'V7', rotY=r, dims={'w': 4.6, 'y': 2.4})
s4.prop('platform', 'lift-platform', (CX, CZ), 'V7')
s4.prop('lift', 'lift-chains', (CX, CZ), 'V7', dims={'h': 18, 'top': 1})
s4.prop('desk', 'desk', (CX - 1.43, CZ - 1.35), 'V7', rotY=-30)
s4.prop('chair', 'chair', (CX - 1.12, CZ - 0.92), 'V7', rotY=150)
s4.prop('stove', 'stove', (CX + 1.3, CZ - 0.05), 'V7', rotY=-90)
s4.prop('woodpile', 'vr-woodpile', (CX + 1.85, CZ - 0.05), 'V7', rotY=90)
s4.prop('bed', 'bed', (CX - 1.25, CZ + 1.35), 'V7', rotY=-55)
s4.prop('chest', 'chest', (CX + 1.18, CZ + 1.28), 'V7', rotY=-35)
s4.prop('rug', 'rug', (CX - 0.4, CZ + 0.9), 'V7', rotY=-20, dims={'w': 7, 'd': 5})
for i, (dx, dz, r, w) in enumerate([(0.95, -2.42, 0, 4.5), (-0.95, -2.42, 0, 4.5), (-2.42, 1.0, 90, 4.5), (-0.95, 2.42, 180, 4.5)]):
    s4.prop(f'tapestry{i}', 'bright-tapestry', (CX + dx, CZ + dz), 'V7', rotY=r, dims={'w': w, 'bright': 1, 'v': i})
s4.prop('armor', 'standing-armor', (CX + 1.62, CZ - 1.55), 'V7', rotY=-135)
tag(s4, 'armor', label='Animated armor', playerLabel='A standing suit of armour', dm='Animated armor (CR 1). Command word "Khazan"; idle 24 hours without orders and it stops. Commanded, it can pull the stones from the wall behind it.')
s4.hidden('compartment', 'niche', (CX + 1.85, CZ - 1.85), 'V7', 'Narrow compartment in the wall behind the armour: a card-reading treasure, if one is here')
tag(s4, 'compartment', playerLabel='Loose stones in the wall')
tag(s4, 'chest', container=OrderedDict(contents="A man's severed head, waxy and embalmed in lavender-scented oils."),
    desc='A wooden chest; a smell of lavender comes from it.', dm='Unlocked, safe. The head of Yan, a Vistana banished for theft; Rictavio killed him and has questioned the head twice with speak with dead. Taken out of the spell drain and asked, Yan begs the party to warn the Vistani.')
tag(s4, 'desk', container=OrderedDict(contents='Dry quills, an empty inkwell, ash.'), desc='A desk with a matching chair.', dm='Van Richten burned his notes and journals in the stove; Ezmerelda took the surviving map and journal page to her wagon.')
tag(s4, 'stove', desc='A large iron stove with plenty of wood stacked beside it; old ash in its belly.')

DESC = {
  'V1': ("A barrel-topped wagon parked within sight of the tower door, mud-caked over fresh purple paint and gold-trimmed wheels; brass lanterns hang at its corners and a padlocked back door bears a sign: \"Keep out!\"",
         "Ezmerelda's magic wagon (command words Drovash / Arvesh). Only the hidden hatch underneath is safe: the back door is wired to a hundred flasks of alchemist's fire."),
  'V2': ('An iron door without handle or hinges, a great embossed symbol of lines and eight stick figures on it, KHAZAN carved in the lintel above. Behind it a tiny vestibule and a tattered curtain.',
         "Magically locked and trapped; Khazan's spell drain (an antimagic field to 5 ft round the tower) stops magic opening it. The dance along the symbol's lines opens it; touching it unbidden calls the lightning."),
  'V3': ('Rotting scaffolding of beams, ladders and platforms clings to the west face, climbing to a hole in the north-west wall two floors up. It groans in every breeze.',
         'Holds 200 lb at most. Collapse: 20-ft fall (1d6 per 10 ft + 2d6 piercing); anyone under it DC 13 Dex or 4d6.'),
  'V3-mid': ('A sagging plank platform on the scaffolding outside the west wall, twenty feet up; a ladder climbs on toward the north-west.', 'Part of V3: 200 lb limit.'),
  'V3-top': ('A narrow platform of rotten planks against the gash in the north-west wall, forty feet above the island.', 'Part of V3: 200 lb limit. The gash opens into V6.'),
  'V4': ('A flagstone floor strewn with debris, a few old crates by the east wall, a torn curtain to the south. In the middle, a 5-ft square pit holds four pulleys whose taut iron chains rise through a hole in the rotted ceiling; four tall clay statues stand by them.',
         'The statues are clay golems that work the lift: they lower the 5-ft platform from the fourth floor and raise it wherever asked, 5 ft a round. The crates are empty.'),
  'V5': ('Dust and cobwebs; an empty room whose rotted boards have partly fallen through. A 5-ft hole in the middle of floor and ceiling, a rusty chain at each corner.', 'Weak floor round the shaft (150 lb a square).'),
  'V6': ('Slimy black mildew on the walls, a gash torn in the north-west wall, the floor rotted through and falling away round a 5-ft hole with a rusty chain at each corner.', 'Weak floor round the shaft (50 lb a square); the gash opens onto the scaffolding.'),
  'V7': ('Lived in, though it reeks of mould: a cosy bed, a desk and chair, bright tapestries, a big iron stove with wood beside it, a standing suit of armour and a wooden chest. Light comes through arrow slits and dirty windows with broken shutters; old rafters bow under the roof, chains hanging from their pulleys.',
         "Van Richten's study for months. The armour is animated (\"Khazan\"); the chest holds Yan's head; the lift platform rests here."),
}
levels = [g, s2, s3, s4]
lk = lambda id, kind, al, ap, bl, bp: OrderedDict(id=id, kind=kind, **{'from': OrderedDict(level=al, pos=[round(ap[0] * 5, 2), round(ap[1] * 5, 2)]), 'to': OrderedDict(level=bl, pos=[round(bp[0] * 5, 2), round(bp[1] * 5, 2)])})
links = [lk('V-lift-1', 'elevator', 'grounds', (CX, CZ), 'f2', (CX, CZ)), lk('V-lift-2', 'elevator', 'f2', (CX, CZ), 'f3', (CX, CZ)), lk('V-lift-3', 'elevator', 'f3', (CX, CZ), 'f4', (CX, CZ)),
         lk('V-scaffold-1', 'ladder', 'grounds', (CX - 3.2, CZ + 1.4), 'f2', (CX - 2.8, CZ + 1.1)), lk('V-scaffold-2', 'ladder', 'f2', (CX - 2.8, CZ - 1.6), 'f3', TOPC)]
scene = OrderedDict(schema=1, location='V', chapter='ch11', name="Van Richten's Tower", mapPage=170, bookScaleFt=5, ambient=AMB, stacked=True, entry='grounds',
                    levels=[lv.to_json() for lv in levels], links=links)
for lv in scene['levels']:
    for r in lv['rooms']:
        d = DESC.get(r['key'])
        if d: r['desc'], r['dm'] = d
grid = OrderedDict(schema=1, levels=OrderedDict())
for lv in levels:
    polys = [[[x * 5, z * 5] for x, z in p] for p in lv.floor_polys] + [[[round(x * 5, 2), round(z * 5, 2)] for x, z in p] for p, f in lv.terrain if f != 'shallow-water']
    grid['levels'][lv.id] = OrderedDict(floorPolygons=polys, type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0.55)
out = os.path.join(ROOT, 'locations', 'ch11', 'V'); os.makedirs(out, exist_ok=True)
json.dump(scene, open(os.path.join(out, 'scene.json'), 'w'), indent=1)
json.dump(grid, open(os.path.join(out, 'grid.json'), 'w'), indent=1)
print("van richten's tower:", [(lv.id, len(lv.rooms), len(lv.objects)) for lv in levels])
