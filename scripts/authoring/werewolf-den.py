#!/usr/bin/env python3
"""The Werewolf Den (chapter 15, area Z; map p.202, 10-ft squares) -> locations/ch15/Z/{scene,grid}.json

Traced from the printed map at 300 dpi (a 10-ft square is 65.3 x 65.85 px there; lattice origin found by fitting the
grid lines): plan coordinates are the page's own 5-ft cells, north up. The den is natural cave in a mountain spur
west of Lake Baratok: the wolf's-maw cave mouth (Z1, its jaws a rock canopy on natural pillars), the guards' ledge
at the split (Z2), the wolf den with its fire (Z3) under its 5-ft ledge, the underground spring (Z4, a 40-ft pool
under a fissure, ledges north and east), the bone-strewn maze of the deep caves (Z5) and its two side caves, Kiril's
cave (Z6) with the skin curtain over the stair tunnel up to the ring of stone (Z8, 100 ft above the mouth, drawn in
the map's inset), and the shrine of Mother Night with the prisoners' cages (Z7), down rough stairs.
Rooms share their cut lines exactly; the solid rock round and between the caves is one slab cut to the caves'
outline (edge cancellation of the rooms' shared edges, no geometry library), walls a little proud of it, so the plan
reads like the book's map from above and the cutaway like a carved diorama. Only keys, names, pages and dimensions
come from the book; descriptions are our own words."""
import json, math, os, sys
from collections import OrderedDict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from authorlib import ROOT, Level, seg_key  # noqa: F401

_M = json.load(open(os.path.join(ROOT, 'manifests', 'locations.json')))
PAGE = {a['key']: a['page'] for l in _M['locations'] if l['id'] == 'Z' for a in l['areas']}
pg = lambda k: PAGE.get(k.split('-')[0]) or {'Z1': 203}.get(k)    # Z1's description has no page in the manifest; it is on p.203
AMB = 'barovian-overcast'
WALL_H = 6          # cave walls stand a little proud of the rock slab (5.6 ft): the cutaway of a carved diorama
ROCK_H = 5.6


def exact(lv, a, b, **kw):
    k = seg_key(a, b); lv.overrides[k] = dict(lv.overrides.get(k, {}), **kw)

def open_edges(lv, poly, a, b):
    """Open (no wall) every edge of `poly` from vertex a to vertex b, walking forward."""
    i, j = poly.index(a), poly.index(b)
    k = i
    while k != j:
        p, q = poly[k], poly[(k + 1) % len(poly)]
        for u, v in unit_split(p, q): exact(lv, u, v, open_wall=True)
        k = (k + 1) % len(poly)

def unit_split(p, q):
    """The pieces authorlib makes of one polygon edge (axis-aligned edges split per cell, diagonals whole)."""
    (x0, z0), (x1, z1) = p, q
    if x0 == x1 or z0 == z1:
        n = max(1, int(round(abs(x1 - x0) + abs(z1 - z0))))
        return [((x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n), (x0 + (x1 - x0) * (k + 1) / n, z0 + (z1 - z0) * (k + 1) / n)) for k in range(n)]
    return [(p, q)]

def centroid(poly):
    return (sum(p[0] for p in poly) / len(poly), sum(p[1] for p in poly) / len(poly))

def inside(pt, poly):
    x, z = pt; c = False
    for i in range(len(poly)):
        (x0, z0), (x1, z1) = poly[i], poly[(i + 1) % len(poly)]
        if (z0 > z) != (z1 > z) and x < (x1 - x0) * (z - z0) / (z1 - z0) + x0: c = not c
    return c

def loops_of(polys):
    """The outline of a set of rooms that share their cut lines exactly: every edge used once, chained into loops."""
    cnt = {}
    for poly in polys:
        for i in range(len(poly)):
            a, b = poly[i], poly[(i + 1) % len(poly)]
            k = (a, b) if a <= b else (b, a)
            cnt[k] = cnt.get(k, 0) + 1
    edges = [k for k, c in cnt.items() if c == 1]
    nxt = {}
    for a, b in edges: nxt.setdefault(a, []).append(b); nxt.setdefault(b, []).append(a)
    bad = [p for p, v in nxt.items() if len(v) != 2]
    assert not bad, f'outline does not close at {bad[:4]}'
    loops, seen = [], set()
    for start in nxt:
        if start in seen: continue
        loop, prev, cur = [start], None, start
        seen.add(start)
        while True:
            n = [v for v in nxt[cur] if v != prev]
            if not n or n[0] == start: break
            prev, cur = cur, n[0]
            if cur in seen: break
            loop.append(cur); seen.add(cur)
        loops.append(loop)
    return loops

def area(poly):
    return sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1] for i in range(len(poly))) / 2


# ================================================================== the rooms (page cells: x across, z down; 1 cell = 5 ft)
# shared vertices on the cut lines between rooms
CUR_A, CUR_B = (29.4, 31.3), (30.8, 32.4)                     # the skin curtain: Kiril's cave | the stair tunnel
Z6W, Z6E = (26.0, 38.3), (30.0, 38.3)                         # Kiril's cave opens south into the deep caves
BLOB = (24.5, 38.4)                                           # foot of the rock between the north cave and Kiril's cave
SPUR = (23.9, 43.0)                                           # tip of the spur between the north and south caves
Z5A_S = (23.5, 48.7)
S1, S2 = (31.9, 37.6), (33.9, 38.6)                           # head of the north-west stairs down to the shrine
SW1, SW2 = (36.0, 39.9), (36.0, 43.8)                         # head of the south-west stairs down to the shrine
POOL_W = (34.3, 50.3)                                         # where the maze meets the spring's west shore
KNOB = (33.8, 52.1)                                           # the rock knob on the shore
A1, B1 = (25.9, 54.0), (32.1, 54.2)                           # the deep caves | the wolf den's ledge
L0, L1, L2 = (20.4, 56.3), (31.4, 56.3), (32.2, 56.3)         # the ledge's lip over the wolf den; the steps up at its east end
T0 = (32.1, 57.9)                                             # the rock tongue between the den's two ways south
C3W, C3E = (27.3, 62.1), (34.2, 62.1)                         # the wolf den | the guard post
TIP, C4W, C4E = (35.1, 64.1), (35.85, 62.1), (38.3, 62.1)     # the tongue's foot over the guards' ledge; the spring | the guard post
C4S = (40.8, 65.7)
C1W, C1E = (33.8, 70.3), (40.8, 70.7)                         # the guard post | the cave mouth
M1, M2 = (35.65, 76.4), (42.1, 74.9)                          # the mouth on the cliff line
LG_N, LG_S = (43.0, 46.0), (44.3, 56.0)                       # the spring's east ledge (the map's Z4a)

ROOMS = OrderedDict()
ROOMS['Z6-tunnel'] = ("Kiril's Cave, Stair Tunnel", [CUR_A, CUR_B, (31.6, 31.3), (32.0, 30.3), (32.0, 27.0), (31.0, 25.3), (29.5, 24.0), (22.5, 24.0), (20.9, 24.6), (20.1, 26.2), (20.1, 29.4), (21.0, 30.8),
                      (22.05, 31.6), (23.0, 30.8), (23.2, 29.5), (22.05, 29.2), (22.05, 26.6), (22.6, 25.9), (28.5, 25.9), (29.4, 26.4), (30.0, 28.0), (30.0, 30.6)], 'dirt', 10)
ROOMS['Z6'] = ("Kiril's Cave", [CUR_A, CUR_B, (30.1, 33.2), (30.0, 37.8), Z6E, Z6W, (26.0, 36.5), (25.8, 35.0), (25.6, 33.4), (25.9, 32.3), (26.9, 31.6), (28.0, 31.3)], 'dirt', 20)
ROOMS['Z5b'] = ('North Cave', [BLOB, (24.35, 37.0), (23.7, 36.1), (22.4, 35.4), (20.3, 35.75), (20.0, 37.0), (20.1, 39.9), (20.6, 41.2), (21.8, 41.6), (23.0, 42.2), SPUR], 'dirt', 10)
ROOMS['Z5a'] = ('South Cave', [SPUR, (22.1, 43.75), (20.2, 43.5), (18.55, 43.75), (17.6, 44.9), (17.7, 46.8), (18.55, 48.0), (20.2, 48.1), (22.1, 48.0), Z5A_S], 'dirt', 10)
ROOMS['Z7'] = ('Shrine of Mother Night', [S1, (32.4, 35.75), (34.0, 35.75), (34.3, 34.1), (34.1, 32.5), (35.7, 31.5), (37.1, 31.3), (38.05, 29.9), (40.2, 29.6), (43.3, 30.0), (44.2, 31.05), (45.4, 31.9),
                      (46.1, 33.4), (46.35, 35.0), (46.1, 36.9), (46.35, 37.9), (45.4, 39.3), (44.2, 40.0), (44.2, 42.3), (43.5, 43.5), (42.3, 44.0), (40.4, 43.7), (38.6, 43.8), SW2, SW1,
                      (37.6, 39.7), (38.2, 39.3), (38.2, 38.4), (37.6, 37.75), (36.2, 37.6), (34.6, 37.75), S2], 'dirt', 20)
ROOMS['Z5'] = ('Deep Caves', [BLOB, Z6W, Z6E, (31.0, 37.95), S1, S2, (34.6, 39.7), SW1, SW2, (35.9, 45.5), (35.4, 46.6), (34.6, 47.2), (34.2, 48.0), (34.1, 49.5), POOL_W, KNOB, (32.25, 52.0), (32.0, 52.8),
                      B1, A1, (25.4, 52.4), (24.6, 50.8), (24.0, 50.1), Z5A_S, SPUR], 'dirt', 10)
ROOMS['Z3-ledge'] = ('Wolf Den, Ledge', [(19.8, 55.75), (21.05, 55.6), (22.3, 54.1), (23.95, 53.8), A1, B1, L2, L1, L0], 'flagstone', 20)
ROOMS['Z3'] = ('Wolf Den', [L0, L1, L2, T0, (32.3, 59.8), (33.0, 60.6), (33.8, 61.5), C3E, C3W, (26.0, 61.9), (25.6, 61.8), (23.7, 61.8), (22.3, 62.05), (21.2, 63.4), (19.5, 63.7), (17.6, 63.8),
                     (16.2, 63.4), (16.1, 61.0), (15.8, 58.2), (15.9, 55.9), (17.6, 55.6), (19.8, 55.75)], 'dirt', 20)
ROOMS['Z4'] = ('Underground Spring', [B1, (32.8, 55.15), (33.8, 54.7), (34.0, 53.3), KNOB, POOL_W, (35.4, 50.0), (36.1, 48.0), (38.0, 47.6), (40.1, 47.7), (41.3, 47.0), (42.0, 46.9), LG_N,
                     (43.3, 48.0), (43.6, 51.0), (44.0, 54.3), LG_S, (44.2, 57.8), (44.06, 60.1), (44.06, 61.4), (43.9, 63.4), (43.0, 63.9), (42.2, 65.1), C4S, C4E, C4W, (36.35, 60.0), (37.8, 57.9), T0, L2], 'dirt', 20)
ROOMS['Z4-ledge'] = ('Underground Spring, East Ledge', [LG_N, (44.6, 45.5), (45.6, 45.9), (46.6, 47.2), (47.6, 48.7), (47.9, 50.0), (47.6, 51.2), (47.1, 52.0), (46.1, 52.5), (46.0, 53.8), (45.85, 54.8),
                     (44.8, 55.5), LG_S, (44.0, 54.3), (43.6, 51.0), (43.3, 48.0)], 'flagstone', 20)
ROOMS['Z2'] = ('Guard Post', [C3W, C3E, TIP, C4W, C4E, C4S, (40.05, 66.3), (39.9, 67.3), (40.05, 69.6), C1E, C1W, (33.0, 69.7), (31.7, 69.9), (30.9, 69.2), (30.2, 68.0), (30.1, 66.7),
                     (30.0, 65.9), (29.2, 65.0), (28.5, 64.2), (28.1, 63.2)], 'dirt', 20)
ROOMS['Z1'] = ('Cave Mouth', [C1W, C1E, (41.6, 72.3), (41.85, 73.8), M2, (43.2, 76.2), (44.2, 77.5), (44.5, 79.6), (43.7, 81.7), (41.85, 83.0), (40.0, 83.4), (38.4, 82.7), (37.1, 80.6), (36.05, 78.3), M1,
                     (35.3, 75.4), (34.2, 74.6), (34.2, 70.4)], 'dirt', 20)
# islands of rock standing in the deep caves: the big one and the round pillars
ISLANDS = [[(28.0, 40.1), (29.1, 39.9), (29.9, 40.0), (30.1, 41.4), (31.4, 42.0), (31.9, 43.05), (31.8, 44.7), (31.0, 45.6), (30.1, 45.15), (29.7, 43.9), (28.5, 43.9), (28.0, 42.4)]]
PILLARS = [(27.0, 47.0, 0.95), (31.05, 49.0, 0.95), (29.0, 52.8, 1.05)]
for cx, cz, r in PILLARS: ISLANDS.append([(round(cx + math.cos(a) * r, 3), round(cz + math.sin(a) * r * 0.95, 3)) for a in [k * math.pi / 4 + 0.2 for k in range(8)]])

# ================================================================== the den (0 ft)
d = Level('den', 'The den', 0, 20, interior='cave-rock', exterior='cave-rock', north='-z')
for key, (name, poly, floor, ceil) in ROOMS.items():
    d.room(key, name, poly, floor, page=pg(key), ceilingFt=ceil)
# the caves run into one another: no walls on the cut lines (shared edges), nor round the canopy outside the mouth
cuts = {}
for key, (_, poly, _, _) in ROOMS.items():
    for i in range(len(poly)):
        a, b = poly[i], poly[(i + 1) % len(poly)]
        cuts.setdefault((a, b) if a <= b else (b, a), []).append(key)
for (a, b), ks in cuts.items():
    if len(ks) > 1:
        for u, v in unit_split(a, b): exact(d, u, v, open_wall=True)
open_edges(d, ROOMS['Z1'][1], M2, M1)
for isl in ISLANDS:
    for a, b in zip(isl, isl[1:] + isl[:1]): d.wall(a, b, material='cave-rock')

# the mountainside below the mouth: a scree slope of grass and stones; the cliff the cave is cut into
CLIFF_W = [(8.0, 79.0), (14.0, 78.6), (20.0, 77.5), (26.0, 76.6), (30.0, 75.7), (32.6, 76.4), (34.0, 77.0), M1]
CLIFF_E = [M2, (44.2, 71.2), (45.8, 69.7), (48.4, 68.4), (50.0, 66.8), (53.5, 64.6), (58.0, 63.0), (62.0, 62.0)]
d.terrain.append(([(8.0, 79.0)] + CLIFF_W[1:] + [(36.05, 78.3), (37.1, 80.6), (38.4, 82.7), (40.0, 83.4), (41.85, 83.0), (43.7, 81.7), (44.5, 79.6), (44.2, 77.5), (43.2, 76.2)] + CLIFF_E + [(62.0, 96.0), (8.0, 96.0)], 'grass'))
d.terrain.append(([(38.6, 83.2), (41.2, 83.2), (42.6, 88), (43.6, 96), (39.6, 96), (38.8, 88)], 'dirt'))          # the beaten path up to the mouth
# the rock: one slab round the caves, cut to their outline (and the islands standing in the deep caves)
caves = loops_of([poly for _, poly, _, _ in ROOMS.values()])
caves.sort(key=lambda l: -abs(area(l)))
cave = caves[0]
ROCK_ISLANDS = caves[1:]                                     # rock enclosed by caves on all sides: the tongue, the knob, the shrine's island
# walk the cave outline from the mouth's west corner to its east corner the long way round (through the den, not round
# the jaw's rim out on the slope)
Z1P = ROOMS['Z1'][1]
canopy = set(Z1P[Z1P.index(M2) + 1:Z1P.index(M1)])
fwd = cave[cave.index(M1):] + cave[:cave.index(M1)]; j = fwd.index(M2)
inner = fwd[:j + 1] if not canopy & set(fwd[:j + 1]) else [M1] + list(reversed(fwd[j:]))
ROCK = [(8.0, 18.0), (60.0, 18.0), (62.0, 62.0)] + list(reversed(CLIFF_E[1:])) + list(reversed(inner)) + list(reversed(CLIFF_W[:-1]))
ROCK = [(round(x, 3), round(z, 3)) for x, z in ROCK]
if area(ROCK) < 0: ROCK = ROCK[::-1]
def enc(loops, h):
    dm = OrderedDict(n=len(loops), h=h)
    for i, lp in enumerate(loops):
        dm[f'{i}n'] = len(lp)
        for k, (x, z) in enumerate(lp): dm[f'{i}x{k}'] = round(x * 5, 2); dm[f'{i}z{k}'] = round(z * 5, 2)
    return dm
d.obj('rock', 'rock-mass', (0, 0), 'player', None, dims=enc([ROCK] + ISLANDS[:1] + ROCK_ISLANDS, ROCK_H))       # the round pillars are props of their own
# the cliff face over the slope, either side of the mouth (the canopy of the wolf's jaws carries on over the mouth)
def along(lv, pts, kind, tag, dims, step=26, over=1.2):
    k = 0
    for a, b in zip(pts[:-1], pts[1:]):
        dx, dz = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dz)
        n = max(1, round(L * 5 / step))
        for jj in range(n):
            p = (a[0] + dx * jj / n, a[1] + dz * jj / n); q = (a[0] + dx * (jj + 1) / n, a[1] + dz * (jj + 1) / n)
            lv.prop(f'{tag}-{k}', kind, ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2), None, rotY=round(math.degrees(math.atan2(-dz, dx)), 1), dims=dict(dims, len=round(L * 5 / n * over + 2, 1), seed=k + 3))
            k += 1
along(d, CLIFF_W[:-1] + [(33.4, 76.8)], 'rock-flank', 'cliff-w', {'h': 11, 'd': 9, 'snow': 0})
along(d, [(43.6, 72.6)] + CLIFF_E[1:], 'rock-flank', 'cliff-e', {'h': 11, 'd': 9, 'snow': 0})

# --- Z1 the cave mouth: the jaws of the wolf's head, a canopy 15 ft up on natural pillars of rock
d.prop('Z1-maw', 'wolf-maw', (40.2, 75.7), 'Z1', rotY=13, dims={'w': 42, 'd': 38, 'h': 15})
for i, (x, z) in enumerate([(42.6, 77.2), (37.2, 79.6), (43.4, 79.7), (42.6, 81.3), (38.9, 82.2), (40.4, 82.3)]):
    d.prop(f'Z1-pillar{i}', 'rock-pillar', (x, z), 'Z1', dims={'r': 1.6, 'h': 15.5, 'seed': i + 1, 'light': 1})
d.note('Z1-note', (38.4, 73.0), 'Z1', 'The guards on their ledge (Z2) see anyone in the mouth who is not hidden. A discordant flute echoes from Z3.')

# --- Z2 the guard post: a 5-ft ledge where the way splits round the tongue of rock, steps at its back
U = [(32.3, 64.0), (34.2, 64.0), TIP, (36.0, 64.0), (38.05, 64.2), (38.05, 67.6), (37.2, 68.4), (34.0, 68.3), (33.0, 67.8), (32.2, 66.7)]
d.terrain.append((U, 'flagstone'))
for i, (a, b) in enumerate([((32.25, 64.3), (32.25, 66.6)), ((32.9, 67.9), (34.0, 68.45)), ((34.0, 68.45), (37.3, 68.55)), ((37.3, 68.55), (38.15, 67.6)), ((38.15, 67.6), (38.15, 64.4))]):
    along(d, [a, b], 'ledge-lip', f'Z2-lip{i}', {}, step=12, over=1.05)
d.prop('Z2-steps-w', 'rough-steps', (33.1, 62.1), 'Z2', rotY=-90, dims={'len': 9, 'w': 7.5, 'n': 5, 'step': 0.32})
d.prop('Z2-steps-e', 'rough-steps', (37.3, 62.1), 'Z2', rotY=-90, dims={'len': 9, 'w': 6.5, 'n': 5, 'step': 0.32})
d.creature('aziana', 'werewolf-human', (34.4, 66.3), 'Z2', 'Aziana, werewolf in human form, spear; raises the alarm, fights to the death')
d.objects[-1]['dims'] = {'skirt': 1, 'hair': 2, 'cloth': 0x5a4a3c}
d.creature('davanka', 'werewolf-human', (36.6, 66.6), 'Z2', 'Davanka, werewolf in human form, spear; raises the alarm, fights to the death')
d.objects[-1]['dims'] = {'skirt': 1, 'hair': 0, 'cloth': 0x4f4636}
d.note('Z2-note', (35.2, 69.2), 'Z2', 'Loud noise here carries through the den: reinforcements from Z3 and Z5.')

# --- Z3 the wolf den: a long cave under a 5-ft ledge, a smouldering fire at the west end, the floor gnawed bones
for i, (a, b) in enumerate([(L0, (25.9, 56.3)), ((25.9, 56.3), L1)]): along(d, [a, b], 'ledge-lip', f'Z3-lip{i}', {}, step=12, over=1.05)
d.prop('Z3-steps', 'rough-steps', (31.6, 58.4), 'Z3', rotY=90, dims={'len': 10, 'w': 4.6, 'n': 5, 'step': 0.32})
d.prop('Z3-fire', 'campfire', (18.8, 58.8), 'Z3')
for i, (x, z) in enumerate([(21.5, 57.6), (24.6, 59.8), (27.8, 58.0), (20.2, 61.6), (29.6, 60.6), (17.4, 62.4)]):
    d.prop(f'Z3-bones{i}', 'bones', (x, z), 'Z3', rotY=i * 53)
d.creature('skennis', 'werewolf-human', (19.9, 58.2), 'Z3', 'Skennis, old werewolf in human form (36 hp): plays an electrum flute badly; fights to the death for the den')
d.objects[-1]['dims'] = {'old': 1, 'spear': 0, 'hair': 4}
for i in range(4):
    a = 2.4 + i * 0.75
    d.creature(f'Z3-wolf{i}', 'wolf', (round(19.9 + math.cos(a) * (1.7 + (i % 2) * 0.8), 2), round(58.2 + math.sin(a) * (1.5 + (i % 2) * 0.7), 2)), 'Z3', 'Wolves (nine in all, four placed): huddled behind Skennis, they go where he goes')
d.hidden('Z3-flute', 'pouch', (19.6, 58.4), 'Z3', 'Skennis\'s electrum flute (250 gp) and a pouch of four 50 gp gemstones')

# --- Z4 the underground spring: a 40-ft pool 10 ft deep under a fissure; ledges north and east, crates of clothes on the east
POOL = [(34.0, 52.3), (34.4, 51.2), (35.4, 50.6), (36.5, 50.3), (38.5, 50.1), (40.5, 50.0), (41.6, 50.6), (42.4, 52.0), (42.6, 53.8), (42.2, 55.5), (41.2, 56.6), (40.0, 57.4), (38.6, 58.0),
        (37.4, 57.5), (36.3, 56.2), (35.5, 54.7), (34.5, 53.7)]
d.terrain.append((POOL, 'shallow-water'))
NLEDGE = [(35.4, 50.0), (36.1, 48.0), (38.0, 47.6), (40.1, 47.7), (41.3, 47.0), (42.0, 46.9), (43.0, 46.0), (43.3, 48.0), (42.0, 50.3), (40.5, 49.85), (38.5, 49.95), (36.5, 50.15)]
d.terrain.append((NLEDGE, 'flagstone'))
along(d, [(35.6, 50.2), (38.5, 50.1), (40.5, 50.0), (42.1, 50.45)], 'ledge-lip', 'Z4-lipn', {}, step=12, over=1.05)
along(d, [(43.3, 48.1), (43.6, 51.0), (44.0, 54.3)], 'ledge-lip', 'Z4-lipe', {}, step=12, over=1.05)
d.prop('Z4-steps', 'rough-steps', (43.9, 53.1), 'Z4-ledge', rotY=0, dims={'len': 8, 'w': 8, 'n': 4, 'step': 0.32})
for i, (x, z, r) in enumerate([(43.6, 46.9, 20), (45.3, 47.1, 50), (46.6, 48.6, 70), (47.0, 50.0, 95), (46.8, 51.3, 85)]):
    d.prop(f'Z4-crate{i}', 'crate-chest', (x, z), 'Z4-ledge', rotY=r)
    d.objects[-1]['container'] = OrderedDict(contents='Heaps of adult-sized clothing, stiff with old mud.')
d.note('Z4-clothes', (46.0, 49.6), 'Z4-ledge', 'The crates hold the pack\'s human clothes.')
d.note('Z4-note', (39.2, 54.0), 'Z4', 'Fresh water, 10 ft deep, about 40 ft across; the ceiling 20 ft above the pool. The fissure overhead is 3 ft wide at most (6 in. at its narrowest).')

# --- Z5 the deep caves: a maze of tunnels round pillars of rock, 10-ft ceilings, the floor strewn with bones
for i, (cx, cz, r) in enumerate(PILLARS): d.prop(f'Z5-pillar{i}', 'rock-pillar', (cx, cz), 'Z5', dims={'r': r * 5 * 1.08, 'h': ROCK_H + 1.4, 'seed': 11 + i})
for i, (x, z) in enumerate([(25.2, 40.3), (27.0, 45.2), (33.0, 41.8), (32.6, 46.8), (26.4, 49.6), (30.4, 53.4), (24.8, 44.6), (33.4, 50.6), (29.0, 47.2), (31.6, 39.0)]):
    d.prop(f'Z5-bones{i}', 'bones', (x, z), 'Z5', rotY=i * 61)
d.note('Z5-note', (27.6, 48.6), 'Z5', 'Bones crunch underfoot: disadvantage on Dexterity (Stealth) to move quietly anywhere in the deep caves.')
d.creature('bianca', 'werewolf-wolf', (19.8, 46.0), 'Z5a', 'Bianca, Kiril\'s white-haired mate, werewolf in wolf form, asleep; quick to wake at an alarm')
d.objects[-1]['dims'] = {'fur': 0xd6d2c8}
d.creature('wensencia', 'werewolf-wolf', (21.8, 38.8), 'Z5b', 'Wensencia, werewolf in wolf form, asleep with Kellen; at an alarm she cages him in Z7 and joins the fight')
d.creature('kellen', 'werewolf-wolf', (22.6, 40.0), 'Z5b', 'Kellen, ten, a werewolf in wolf form (AC 10, 2 hp, werewolf immunities, noncombatant); hugs a doll; greater restoration or remove curse cures him', size='small')
d.objects[-1]['dims'] = {'scale': 0.8, 'fur': 0x8a7a64}
d.hidden('Z5b-doll', 'doll', (22.9, 40.4), 'Z5b', 'A wooden doll painted like a zombie, eerily like one of the characters; etched with a tiny slogan')

# --- Z6 Kiril's cave: the curtain of stitched skin at the back over the stair tunnel up to the ring of stone
d.prop('Z6-curtain', 'skin-curtain', ((CUR_A[0] + CUR_B[0]) / 2, (CUR_A[1] + CUR_B[1]) / 2), 'Z6', rotY=round(math.degrees(math.atan2(-(CUR_B[1] - CUR_A[1]), CUR_B[0] - CUR_A[0])), 1), dims={'w': 8.5, 'h': 9})
d.prop('Z6-bed', 'pallet', (27.6, 35.4), 'Z6', rotY=20)
d.prop('Z6-bones', 'bones', (28.6, 37.0), 'Z6', rotY=40)
d.note('Z6-note', (28.0, 34.0), 'Z6', 'Kiril sleeps here in wolf form when he is home. Behind the curtain: a 10-ft tunnel of rough stairs and landings up to a secret door (easy to see from inside) onto the ledge Z8.')
for i, (x, z, r) in enumerate([(30.9, 29.0, 90), (25.2, 24.95, 180), (21.05, 27.0, -90), (21.2, 29.9, -90)]):
    d.prop(f'Z6-stair{i}', 'rough-steps', (x, z), 'Z6-tunnel', rotY=r, dims={'len': 9, 'w': 9, 'n': 6, 'step': 0.22})

# --- Z7 the shrine of Mother Night: six cages lidded with rocks, the wooden statue on its hoard, the hanging dead
d.prop('Z7-steps-nw', 'rough-steps', (34.4, 36.7), 'Z7', rotY=-140, dims={'len': 13, 'w': 9, 'n': 6, 'step': 0.3})
d.prop('Z7-steps-sw', 'rough-steps', (38.6, 41.9), 'Z7', rotY=180, dims={'len': 12, 'w': 17, 'n': 6, 'step': 0.3})
CAGES = [(39.05, 31.0, 0), (41.1, 31.0, 0), (37.05, 33.0, 1), (45.0, 35.0, 0), (45.0, 37.0, 0), (43.0, 39.0, 1)]
k = 0
for i, (x, z, empty) in enumerate(CAGES):
    d.prop(f'Z7-cage{i}', 'wolf-cage', (x, z), 'Z7', rotY=(i % 3) * 7, dims={'w': 7, 'h': 5, 'open': empty})
    if not empty:
        for dx in (-0.25, 0.25):
            k += 1
            d.creature(f'child{k}', 'child', (x + dx, z + 0.1), 'Z7', f'Prisoner, a child of {7 + (k * 5) % 6} (AC 10, 1 hp): in shock; freed children stay close to the characters', size='small')
            d.objects[-1]['dims'] = {'v': k}
d.prop('Z7-statue', 'mother-night', (42.9, 32.9), 'Z7', rotY=-135, dims={'h': 9})
d.prop('Z7-hoard', 'hoard', (42.9, 32.9), 'Z7', dims={'r': 4.5})
for i, (x, z) in enumerate([(44.3, 31.45), (45.35, 32.4)]):
    d.prop(f'Z7-corpse{i}', 'hanging-corpse', (x, z), 'Z7', rotY=-130, dims={'v': i})
d.hidden('Z7-treasure', 'pouch', (42.2, 33.6), 'Z7', 'Hoard (cursed: whoever takes from it gets no rest at night): 4,500 cp, 900 sp, 250 gp in foreign coin; thirty 50 gp and seven 100 gp gems; twelve gold jewellery pieces (25 gp), a jet-inlaid gold cloak pin (250 gp); an ivory drinking horn (250 gp); an electrum censer with platinum filigree (750 gp)')
d.creature('zuleika', 'werewolf-human', (41.6, 34.2), 'Z7', 'Zuleika Toranescu, werewolf in human form, kneeling in prayer; guards the prisoners; frees them if Emil comes back to her, may if the characters help her against Kiril')
d.objects[-1]['dims'] = {'spear': 0, 'hair': 0, 'cloth': 0x5a4a52, 'skirt': 1}
d.note('Z7-note', (40.0, 36.8), 'Z7', 'Ceiling 20 ft. Two cages empty (Wensencia locks Kellen in one at an alarm); the rocks on the lids can be knocked or lifted off.')

# --- the hunting party (Leader of the Pack): back each hour on an 18+, dragging a dead mountain goat
d.creature('kiril', 'werewolf-wolf', (40.0, 89.0), None, 'Kiril Stoyanovich (werewolf, 90 hp) leading the hunt home: with him six werewolves and nine wolves (two of each placed)')
d.objects[-1]['dims'] = {'fur': 0x3d3a38, 'scale': 1.4}
for i, (x, z) in enumerate([(38.2, 90.6), (41.8, 90.8)]):
    d.creature(f'pack{i}', 'werewolf-wolf', (x, z), None, 'Werewolf of the hunting party, wolf form; hybrid form if the den was attacked')
for i, (x, z) in enumerate([(37.0, 92.4), (43.0, 92.6)]):
    d.creature(f'packwolf{i}', 'wolf', (x, z), None, 'Wolf of the hunting party')
d.note('pack-note', (40.0, 86.4), None, 'Leader of the Pack: roll each hour in the den, 18+ the hunters return. Seeing signs of an assault they take hybrid form; Kiril sends three up the slope to Z8 to come in from above.')
for i, (x, z, r) in enumerate([(30.0, 82.0, 2.6), (47.0, 80.0, 2.2), (25.0, 84.5, 1.8), (50.5, 74.0, 2.4), (33.5, 90.0, 2.0), (46.5, 90.5, 2.8), (20.0, 80.5, 2.0)]):
    d.prop(f'boulder{i}', 'boulder', (x, z), None, dims={'r': r})
for i, (x, z) in enumerate([(27.5, 86.5), (52.0, 84.0), (45.0, 86.0), (31.5, 79.5)]):
    d.prop(f'scree{i}', 'rubble', (x, z), None, dims={'n': 7})
d.obj('spawn', 'spawn', (40.4, 91.5), 'dm-note', None, 'The approach up the mountainside')
# loose stones lying on the rock over the caves, so the slab reads as broken mountainside from above
allrooms = [poly for _, poly, _, _ in ROOMS.values()]
def clear(pt, m):
    return not any(inside((pt[0] + dx, pt[1] + dz), poly) for poly in allrooms for dx, dz in ((0, 0), (m, 0), (-m, 0), (0, m), (0, -m), (m, m), (-m, -m), (m, -m), (-m, m)))
k = 0
for j in range(160):
    x, z = 10 + (j * 37.31) % 49, 20 + (j * 23.77 + (j * j) % 7) % 54
    if not inside((x, z), ROCK) or not clear((x, z), 1.6): continue
    d.prop(f'scree-top{k}', 'boulder' if j % 3 else 'rubble', (round(x, 2), round(z, 2)), None, dims={'r': 0.9 + (j % 4) * 0.45} if j % 3 else {'n': 5}, y=ROCK_H)
    k += 1

# --- torches in iron brackets along the walls; the den is brightly lit throughout
TORCHES = [(23.4, 24.3), (28.2, 24.3), (31.85, 28.1), (20.25, 28.8), (28.2, 31.5), (37.6, 31.6), (34.4, 33.9), (43.4, 41.0), (40.4, 43.55), (22.75, 41.45), (22.9, 43.9), (30.5, 41.6),
           (34.35, 47.3), (33.6, 55.4), (25.3, 54.15), (24.8, 61.75), (28.35, 62.9), (46.1, 51.75), (44.0, 56.0), (43.95, 60.4), (41.0, 65.8), (30.25, 65.8), (31.8, 69.5), (34.35, 72.5),
           (35.7, 75.3), (40.6, 70.85), (41.75, 74.1)]
allp = [poly for _, poly, _, _ in ROOMS.values()]
def facing(pt):
    """Turn a wall torch to face away from its nearest wall."""
    best = None
    for poly in allp:
        for i in range(len(poly)):
            a, b = poly[i], poly[(i + 1) % len(poly)]
            dx, dz = b[0] - a[0], b[1] - a[1]; L2 = dx * dx + dz * dz or 1
            t = max(0, min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dz) / L2)); q = (a[0] + dx * t, a[1] + dz * t)
            dd = math.hypot(pt[0] - q[0], pt[1] - q[1])
            if best is None or dd < best[0]: best = (dd, q)
    q = best[1]; ox, oz = pt[0] - q[0], pt[1] - q[1]
    if math.hypot(ox, oz) < 1e-6: return 0, pt
    room = next((r for r in allp if inside(pt, r)), None)
    if room is None: ox, oz = -ox, -oz
    L = math.hypot(ox, oz); ux, uz = ox / L, oz / L
    return round(math.degrees(math.atan2(ux, uz)), 1), (round(q[0] + ux * 0.12, 3), round(q[1] + uz * 0.12, 3))
for i, p in enumerate(TORCHES):
    rot, at = facing(p)
    d.prop(f'torch{i}', 'wall-torch', at, None, rotY=rot, dims={'y': 6.5})
for i in (1, 4, 6, 9, 12, 14, 16, 18, 20, 22, 24, 26, 8, 2):
    x, z = TORCHES[i]
    d.light(f't{i}', (x, z), 'torch', 20, 40, y=7)
d.light('fire', (18.8, 58.8), 'candle', 5, 10, y=2)

# ================================================================== Z8 the ring of stone (+100 ft), the map's inset
r8 = Level('ring', 'Ring of stone (Z8), +100 ft', 100, 10, interior='cave-rock', exterior='cave-rock', north='-z')
DOOR = ((45.6, 9.2), (46.8, 9.2))
Z8 = [(44.0, 11.8), (44.6, 10.0), DOOR[0], DOOR[1], (47.6, 9.4), (50.1, 9.05), (52.2, 9.4), (54.4, 10.8), (55.8, 10.3), (58.6, 9.05), (61.5, 7.5), (63.3, 6.6), (65.8, 5.3), (66.6, 9.4),
      (54.0, 15.4), (40.7, 21.4), (40.1, 18.1), (40.8, 15.6), (42.2, 13.9)]
HEAD = [DOOR[0], (44.9, 8.4), (45.0, 7.2), (45.8, 6.6), (46.9, 6.7), (47.4, 7.6), (47.2, 8.6), DOOR[1]]
r8.room('Z8', 'Ring of Stone', Z8, 'dirt', page=pg('Z8'))
r8.room('Z6-head', "Kiril's Cave, Stair Tunnel Head", HEAD, 'dirt', page=pg('Z6'), ceilingFt=10)
r8.secret(DOOR[0], DOOR[1], 'z8', 'Secret door into the mountainside: pushes open onto the stair tunnel down to Z6 (easy to spot from inside)', 'Z8')
r8.objects[-1]['playerLabel'] = 'Rock face'
# the ledge is open air: no walls on its rim, only the mountain behind it and the scarp below
z8open = [(Z8[i], Z8[(i + 1) % len(Z8)]) for i in range(len(Z8))]
for a, b in z8open:
    if (a, b) == DOOR: continue
    for u, v in unit_split(a, b): exact(r8, u, v, open_wall=True)

along(r8, [(40.1, 18.1), (40.8, 15.6), (42.2, 13.9), (44.0, 11.8), (44.6, 10.0)], 'rock-flank', 'mtn-w', {'h': 70, 'd': 50, 'snow': 0})
along(r8, [(44.2, 6.4), (45.8, 5.8), (47.4, 6.4)], 'rock-flank', 'mtn-head', {'h': 60, 'd': 40, 'snow': 0}, step=20)
along(r8, [(47.6, 9.4), (50.1, 9.05), (52.2, 9.4), (54.4, 10.8), (55.8, 10.3), (58.6, 9.05), (61.5, 7.5), (63.3, 6.6), (65.8, 5.3)], 'rock-flank', 'mtn-n', {'h': 80, 'd': 60, 'snow': 0})
along(r8, [(40.7, 21.4), (54.0, 15.4), (66.6, 9.4)], 'precipice', 'scarp', {'depth': 70, 'd': 120}, step=26)
r8.prop('Z8-ring', 'stone-ring', (52.0, 13.7), 'Z8', dims={'r': 10, 'n': 24})
for i, (x, z, r) in enumerate([(48.7, 12.8, 80), (49.2, 15.6, 120), (54.8, 11.6, -10), (55.6, 13.0, 60), (51.0, 11.0, 170)]):
    r8.prop(f'Z8-spears{i}', 'spears', (x, z), 'Z8', rotY=r, dims={'n': 2 + i % 2})
r8.prop('Z8-bones', 'bones', (52.2, 13.9), 'Z8', rotY=30)
for i, (x, z) in enumerate([(46.0, 18.6), (48.2, 18.0), (50.4, 17.2)]):
    r8.creature(f'Z8-flank{i}', 'werewolf', (x, z), 'Z8', 'Leader of the Pack: one of the three hybrid werewolves Kiril sends up here to come into the den from above')
r8.note('Z8-note', (52.0, 17.0), 'Z8', 'The pack watches its young prisoners fight here with spears; the last child standing is bitten and turned, the dead eaten. Scaling the slope from the mouth needs no kit or check.')

# ================================================================== descriptions (our own words)
DESC = {
  'Z1': ("The cave gapes like a wolf's head: its upper jaw juts out overhead on pillars of raw stone, and torchlight flickers within. Off-key piping echoes from somewhere deeper.",
         "Canopy 15 ft high, the ceiling 20 ft inside. Guards at Z2 see anyone in the mouth who isn't hidden. With Emil in tow, he can order the pack to let the party pass."),
  'Z2': ("The passage forks around a spur of rock. Up on a shelf where the ways part, two ragged, wild-eyed women watch with spears in hand.",
         "Aziana and Davanka, werewolves in human form, on a 5-ft ledge. They raise the alarm; noise here brings help from Z3 and Z5. They fight to the death."),
  'Z3': ("A long cave under a stone ledge, a fire smouldering at its far end, the floor littered with gnawed bones. An old man piping on a flute sits with a pack of wolves at his back.",
         "Skennis (werewolf, 36 hp, too old to hunt) and nine wolves. Treasure: electrum flute (250 gp), four 50 gp gems. Dying, he promises Kiril will skin them alive."),
  'Z3-ledge': ("A ledge of rock five feet above the wolf den, overlooking it.", "Steps at its east end lead down to the den floor."),
  'Z4': ("Cold water wells up into a broad pool, and a crack high overhead lets in a little daylight and a steady drip of rain. Rock shelves look down on the water from two sides.",
         "Fresh water 10 ft deep; ceiling 20 ft above it; the fissure is 3 ft wide at most. The 5-ft ledges: north, and east with rough stairs and crates."),
  'Z4-ledge': ("A raised shelf along the east wall, reached by rough steps; a few crates stand on it.", "The crates are full of adult-sized clothing."),
  'Z5': ("Low passages wind between columns of rock, lit by torches; old bones litter the ground everywhere.", "Ceiling 10 ft. The bones are an alarm: disadvantage on Stealth checks to move silently."),
  'Z5a': ("A side cave off the maze.", "Bianca, Kiril's white-haired mate, sleeps here in wolf form; she wakes fast at an alarm."),
  'Z5b': ("A side cave off the maze.", "Wensencia sleeps here in wolf form with Kellen (10), a werewolf child clutching a zombie-painted doll. At an alarm she cages him in Z7 and joins the fight."),
  'Z6': ("A bare cave; across its far end hangs a drape of stitched-together hides that are unmistakably human.",
         "Kiril sleeps here in wolf form when he is home. Behind the curtain a 10-ft tunnel of rough stairs and landings climbs to a secret door onto Z8."),
  'Z6-tunnel': ("A ten-foot tunnel of rough-hewn steps and landings, climbing.", "Ends at a secret door onto the ledge of Z8; the door is obvious from this side."),
  'Z6-head': ("The top of a stair tunnel, ending at a door of rock.", "The secret door opens onto Z8; from inside it is easy to find."),
  'Z7': ("Below the steps, children peer silently out of wooden cages held shut by boulders. Among the cages a rough-carved idol, a woman with a wolf's head hung with vines and pale blossoms, rises from a glittering heap; a ragged woman prays at its feet, and two dead captives hang in chains on the wall behind.",
         "Zuleika Toranescu prays to Mother Night for Emil. Eight children (AC 10, 1 hp) two to a cage, two cages empty. Taking from the hoard brings a curse of sleepless nights."),
  'Z8': ("High on the slope, a shelf of rock holds a circle of stones about twenty feet across. Inside it the ground is stained dark and scattered with small chewed bones; old spears lie dropped around the outside.",
         "The pack watches child prisoners fight here; a secret door in the rock face opens on the stairs down to Z6. Reached from the mouth by scaling the slope, no check needed."),
}

# what players call hidden things once revealed (never the DM's detail)
SEEN = {'wolf': 'A wolf', 'werewolf-wolf': 'A big shaggy wolf', 'werewolf': 'A wolf-headed brute', 'werewolf-human': 'A feral figure in rags with a spear', 'child': 'A frightened child',
        'pouch': 'A small pouch', 'doll': 'A wooden doll'}
SEEN_ID = {'den-skennis': 'An old man with a flute', 'den-zuleika': 'A woman in rags, kneeling', 'den-bianca': 'A white wolf, asleep', 'den-wensencia': 'A wolf, asleep',
           'den-kellen': 'A wolf cub, asleep', 'den-kiril': 'A great dark wolf', 'den-Z7-treasure': 'Coins, gems and gold piled at the statue\'s feet'}
for lv in (d, r8):
    for o in lv.objects:
        if o['vis'] in ('hidden-creature', 'hidden-object') and 'playerLabel' not in o:
            o['playerLabel'] = SEEN_ID.get(o['id']) or SEEN.get(o['kind'], 'Something')
levels = [d, r8]
lk = lambda id, kind, al, ap, bl, bp: OrderedDict(id=id, kind=kind, **{'from': OrderedDict(level=al, pos=[ap[0] * 5, ap[1] * 5]), 'to': OrderedDict(level=bl, pos=[bp[0] * 5, bp[1] * 5])})
links = [lk('Z-tunnel', 'stairs', 'den', (21.55, 30.4), 'ring', (46.2, 7.9))]
scene = OrderedDict(schema=1, location='Z', chapter='ch15', name='Werewolf Den', mapPage=202, bookScaleFt=10, ambient=AMB, entry='den', levels=[lv.to_json() for lv in levels], links=links)
for lv in scene['levels']:
    for w in lv['walls']:
        if lv['id'] == 'den' and 'heightFt' not in w and w['flags'] == ['normal']: w['heightFt'] = WALL_H
    for r in lv['rooms']:
        dd = DESC.get(r['key'])
        if dd:
            r['desc'] = dd[0]
            if dd[1]: r['dm'] = dd[1]
grid = OrderedDict(schema=1, levels=OrderedDict((lv.id, OrderedDict(floorPolygons=[[[round(x * 5, 3), round(z * 5, 3)] for x, z in p] for p in lv.floor_polys] + [[[round(x * 5, 3), round(z * 5, 3)] for x, z in p] for p, f in lv.terrain if f == 'grass'],
                                                                     type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0.55)) for lv in levels))
out = os.path.join(ROOT, 'locations', 'ch15', 'Z'); os.makedirs(out, exist_ok=True)
json.dump(scene, open(os.path.join(out, 'scene.json'), 'w'), indent=1)
json.dump(grid, open(os.path.join(out, 'grid.json'), 'w'), indent=1)
print('werewolf den:', [(lv.id, len(lv.rooms), len(lv.objects), len(lv.lights)) for lv in levels], 'rock outline', len(ROCK))
