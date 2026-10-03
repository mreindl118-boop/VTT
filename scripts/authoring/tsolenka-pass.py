#!/usr/bin/env python3
"""Tsolenka Pass (chapter 9, area T; map p.158, 10-ft squares) -> locations/ch09/T/{scene,grid}.json

Traced from the printed map at 300 dpi (a 10-ft square is 60 px there): plan coordinates are the page's own 5-ft cells,
x across the page and z down it, so the scene reads like the book with north to the left (the map's compass: east up,
south right). The road comes up from the west (the foot of the page) along a shelf of snow between the mountain's
icy flank (north, page left) and the drop into the sea of fog (south, page right); it passes the black gatehouse
(T1-T3: 10-ft passage between 10-ft piers, 20-ft walls run out to the cliffs), the white octagonal guard tower on its
promontory (T4-T6: 30 ft across inside, floors at 0, +20 and the roof at +40), then climbs to the gorge of the Luna
River, crossed by the 10 x 90-ft stone bridge between its two 30 x 10-ft arches (T7-T9) 500 ft above the water.
Levels: the pass (0), the tower's upper floor (+20), the gatehouse top with its two demon statues (+30) and the tower
rooftop (+40); stacked, so the section cut slices the tower and the arches. Only keys, names, pages and dimensions
come from the book; descriptions are our own words."""
import json, math, os, sys
from collections import OrderedDict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from authorlib import ROOT, Level, rect, seg_key  # noqa: F401

_M = json.load(open(os.path.join(ROOT, 'manifests', 'locations.json')))
PAGE = {a['key']: a['page'] for l in _M['locations'] if l['id'] == 'T' for a in l['areas']}
pg = lambda k: PAGE.get(k.split('-')[0])
AMB = 'barovian-overcast'


# ------------------------------------------------------------------ helpers
def exact(lv, a, b, **kw):
    """Override one exact polygon edge (a whole diagonal, or a sub-edge made by inserted vertices)."""
    k = seg_key(a, b)
    lv.overrides[k] = dict(lv.overrides.get(k, {}), **kw)

def insert(poly, *pts):
    """Insert points that lie on a polygon's edges (to make a door or window its own edge)."""
    out = list(poly)
    for p in pts:
        for i in range(len(out)):
            a, b = out[i], out[(i + 1) % len(out)]
            cr = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
            if abs(cr) < 1e-9 and min(a[0], b[0]) - 1e-9 <= p[0] <= max(a[0], b[0]) + 1e-9 and min(a[1], b[1]) - 1e-9 <= p[1] <= max(a[1], b[1]) + 1e-9 and p != a and p != b:
                out.insert(i + 1, p); break
        else:
            raise ValueError(f'{p} is on no edge')
    return out

def lerp(a, b, t): return (round(a[0] + (b[0] - a[0]) * t, 4), round(a[1] + (b[1] - a[1]) * t, 4))

def octagon(cx, cz, r=3, c=1.25):
    """A regular-ish octagon on the lattice: flat faces 2c long at distance r (cells), clockwise from the north-west corner."""
    return [(cx - c, cz - r), (cx + c, cz - r), (cx + r, cz - c), (cx + r, cz + c), (cx + c, cz + r), (cx - c, cz + r), (cx - r, cz + c), (cx - r, cz - c)]

def ribbon(pts, half):
    """A band `half` cells either side of a polyline (mitred), as a polygon."""
    L, R = [], []
    n = len(pts)
    for i, p in enumerate(pts):
        a = pts[max(0, i - 1)]; b = pts[min(n - 1, i + 1)]
        dx, dz = b[0] - a[0], b[1] - a[1]; l = math.hypot(dx, dz) or 1
        nx, nz = -dz / l, dx / l
        L.append((round(p[0] + nx * half, 3), round(p[1] + nz * half, 3))); R.append((round(p[0] - nx * half, 3), round(p[1] - nz * half, 3)))
    return L + R[::-1]

def along(lv, pts, kind, key, tag, dims, step=None, over=1.25):
    """Pieces of a run-along prop (cliff, drop) laid end to end on a polyline; local +z is the polyline's left normal
    (-dz, dx), so for a cliff walk the line with the shelf on that side, for a drop with the void on it."""
    k = 0
    for a, b in zip(pts[:-1], pts[1:]):
        dx, dz = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dz)
        n = max(1, round(L * 5 / (step or 30)))
        for j in range(n):
            p, q = lerp(a, b, j / n), lerp(a, b, (j + 1) / n)
            m = ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
            rot = round(math.degrees(math.atan2(-dz, dx)), 1)
            lv.prop(f'{tag}-{k}', kind, m, key, rotY=rot, dims=dict(dims, len=round(L * 5 / n * over + 2, 1), seed=k + 1))
            k += 1


# ================================================================== the pass (ground, 0 ft)
g = Level('pass', 'The pass', 0, 20, interior='ashlar', exterior='ashlar', north='-x')

# --- the snow shelf the road clings to: west of the gorge (gate, tower, the climb to the bridge) and east of it
WEST_L = [(42, 99.5), (42.5, 95), (43, 90), (43.5, 86), (43.5, 82), (42, 79.5), (42, 76.5), (43, 74), (43.5, 70), (43.5, 66), (42.5, 63), (41, 60.5),
          (39, 58), (37, 55.5), (35, 53), (32.5, 50.5), (29, 49.5), (25, 49.5), (20.5, 48.5), (18, 46), (18.5, 41)]
WEST_R = [(36, 41), (36.5, 43.5), (38, 46), (39.5, 49), (41.5, 52.5), (43.5, 56), (45.5, 59.5), (47.5, 62.5), (49.5, 65.5), (50.5, 67.5),
          (49.6, 70), (49.6, 72.5), (51, 74.6), (52.5, 76.5), (52, 79.5), (49.5, 81.5), (48.5, 84), (48, 88), (47.5, 92), (46.5, 96), (46, 99.5)]
EAST_L = [(26.5, 27), (26.5, 24.5), (29, 23), (31.5, 21.5), (35, 19.5), (37.5, 17), (40, 14.5), (42.5, 12), (43.5, 9.5)]
EAST_R = [(46.5, 9.5), (45.5, 12.5), (44, 15), (42, 17.5), (40, 20), (38, 22.5), (36, 24.5), (35.5, 27)]
g.terrain.append((WEST_L + WEST_R, 'snow'))
g.terrain.append((EAST_L + EAST_R, 'snow'))
TOWER = (53, 71)
g.terrain.append(([(TOWER[0] + math.cos(a) * 4.1, TOWER[1] + math.sin(a) * 4.1) for a in [i * math.pi / 8 for i in range(16)]], 'snow'))   # the tower's footing
# the road: a 10-ft track of trodden gravel and slush through the snow
ROAD_W = [(45.5, 99.5), (45, 95), (45, 90), (45.5, 86), (46.5, 82), (47, 79)]
ROAD_M = [(47, 77), (47, 74), (46.6, 70), (46, 66), (44.6, 62.5), (42.6, 59.5), (40.2, 56), (37.6, 53), (35.2, 50), (33.2, 47.4), (31.7, 45), (31, 43)]
ROAD_E = [(31, 25), (31.6, 23.4), (33.6, 21.8), (36.4, 19.8), (39, 17.4), (41.5, 15), (43.5, 12.5), (45, 9.5)]
for pts in (ROAD_W, ROAD_M, ROAD_E): g.terrain.append((ribbon(pts, 1), 'dirt'))
g.terrain.append(([(49.6, 70.6), (49.6, 71.4), (47.4, 71.4), (47.4, 70.6)], 'dirt'))   # the trodden way to the tower door

# --- T1-T3 the gatehouse: a 10-ft passage between two 10 x 10-ft piers, the portcullis on the west face, the curtain of
#     green flame in the eastern arch; the 20-ft spiked walls run 10 ft on each side to the cliffs (p.157)
GX, GZ = 47, 78
g.room('T1', 'Gatehouse Portcullis', rect(46, 78, 48, 79), 'flagstone', page=pg('T1'), ceilingFt=20)
g.room('T3', 'Curtain of Green Flame', rect(46, 77, 48, 78), 'flagstone', page=pg('T3'), ceilingFt=20)
g.opening((46, 79), (48, 79)); g.opening((46, 78), (48, 78)); g.opening((46, 77), (48, 77))
for x in (46, 48): g._stamp((x, 77), (x, 79), flags=['invisible'], wall=True)          # the piers are the gatehouse prop; these only stop feet
for a, b in (((42, 78), (46, 78)), ((48, 78), (52, 78))): g.wall(a, b, heightFt=0.2, material='ashlar')   # the spiked walls, hidden in their masonry
g.prop('gatehouse', 'gatehouse', (GX, GZ), 'T1', dims={'pw': 10, 'pd': 10, 'pier': 10, 'wl': 10, 'wt': 5, 'h': 30, 'wh': 20, 'ly': 20})
g.prop('portcullis', 'portcullis', (GX, 79.15), 'T1', dims={'w': 10, 'h': 19})
g.prop('flame', 'flame-curtain', (GX, 77.15), 'T3', dims={'w': 10, 'h': 19})
g.note('T1-note', (GX, 80.2), 'T1', 'The portcullis shrieks up on its own when anyone comes within 10 ft, stays up 1 minute, then drops. Flying or climbing over the gate wakes the vrocks on the roof (T2).')
g.note('T3-note', (GX, 76.4), 'T3', 'Curtain of green flame: entering it or starting a turn in it deals 33 (6d10) fire. Dispel magic (DC 16) suppresses it for 1 minute; an antimagic field suppresses it too.')
for i, (x, z, r) in enumerate([(42.6, 79.2, 3), (51.4, 79.4, 3.4), (44.2, 76.4, 2.6), (49.9, 76.2, 2.4), (43.8, 88, 3), (47.8, 85, 2.5)]):
    g.prop(f'drift{i}', 'snow-drift', (x, z), None, rotY=i * 37, dims={'r': r, 'h': 1.3})

# --- T4 the guard tower's ground floor: octagonal, 30 ft across inside; the ironbound door on the side facing the road,
#     the cold hearth across from it, three windows on the fog side, the stone stair up the wall to T5 (p.157)
OCT = octagon(*TOWER)
DOOR = ((50, 70.5), (50, 71.5))
WIN_E = ((52.5, 68), (53.5, 68))                                   # page top: east
NE, SE = (OCT[1], OCT[2]), (OCT[3], OCT[4])                        # the two fog-side diagonals
WIN_NE = (lerp(*NE, 0.3), lerp(*NE, 0.7)); WIN_SE = (lerp(*SE, 0.3), lerp(*SE, 0.7))
T4P = insert(OCT, DOOR[0], DOOR[1], WIN_E[0], WIN_E[1], *WIN_NE, *WIN_SE)
g.room('T4', 'Guard Tower, Ground Floor', T4P, 'flagstone', page=pg('T4'), ceilingFt=20)
exact(g, *DOOR, flags=['door', 'locked'], id='T4-door', open=False, wall=True)
for w in (WIN_E, WIN_NE, WIN_SE): exact(g, *w, flags=['window'], wall=True)
g.prop('T4-hearth', 'fireplace', (55.55, 71), 'T4', rotY=-90)
g.prop('T4-ribs', 'tower-ribs', TOWER, None, dims={'r': 15.4, 'h': 40})
# the stair: along the west wall from the fog-side corner, then up the north-west diagonal on a stone base (9 ft, then 11)
STAIR_FOOT, STAIR_TURN, STAIR_HEAD = (54.1, 73.5), (52.1, 73.5), (50.6, 72.0)
g.prop('T4-stair-a', 'stairs-run', STAIR_FOOT, 'T4', rotY=180, dims={'len': 10, 'w': 3.6, 'rise': 9})
BASE = [(52.355, 73.245), (50.855, 71.745), (50.345, 72.255), (51.845, 73.755)]
g.objects.append(OrderedDict(id='pass-T4-stair-base', kind='prism', pos=[0, 0, 0], vis='player', key='T4', polygon=[[round(x * 5, 3), round(z * 5, 3)] for x, z in BASE], dims={'h': 9, 'color': 0x6c737b}))
g.prop('T4-stair-b', 'stairs-run', STAIR_TURN, 'T4', rotY=135, dims={'len': 10.6, 'w': 3.6, 'rise': 11}, y=9)
g.note('T4-X', (53, 68.9), 'T4', 'X: where characters teleporting from K78 in Castle Ravenloft arrive.')
g.note('T4-door-note', (49.2, 71), 'T4', 'Ironbound door, barred from within: DC 22 Strength (Athletics) to force.')

# --- T7 western arch, T8 the stone bridge, T9 eastern arch (p.159): 30-ft arches 10 ft deep with a 10-ft guard post
#     either side of the road, the bridge 10 ft wide between them, 90 ft from end to end, 500 ft above the Luna River
def arch(key, name, z0, statues):
    z1 = z0 + 2; m0, m1 = z0 + 0.5, z0 + 1.5
    g.room(key, name, insert(rect(30, z0, 32, z1), (30, m0), (30, m1), (32, m0), (32, m1)), 'flagstone', page=pg(key), ceilingFt=20)
    g.room(f'{key}-north', f'{name}, North Guard Post', insert(rect(28, z0, 30, z1), (30, m0), (30, m1)), 'flagstone', page=pg(key), ceilingFt=20)
    g.room(f'{key}-south', f'{name}, South Guard Post', insert(rect(32, z0, 34, z1), (32, m0), (32, m1)), 'flagstone', page=pg(key), ceilingFt=20)
    exact(g, (30, m0), (30, m1), open_wall=True); exact(g, (32, m0), (32, m1), open_wall=True)
    g.opening((30, z0), (32, z0)); g.opening((30, z1), (32, z1))
    g.prop(f'{key}-crown', 'arch-crown', (31, z0 + 1), key, dims={'w': 30, 'd': 10, 'y0': 20, 'y1': 30})
    for i, (x, rot, broken) in enumerate(statues):
        g.prop(f'{key}-knight{i}', 'knight-rider', (x, z0 + 1), key, rotY=rot, dims={'y': 31.2, 'broken': broken})
arch('T9', 'Eastern Arch', 25, [(29, 0, 1), (33, 180, 0)])
arch('T7', 'Western Arch', 41, [(29, 0, 0), (33, 180, 0)])
g.room('T8', 'Stone Bridge', rect(30, 27, 32, 41), 'flagstone', page=pg('T8'), ceilingFt=None)
for x, gaps in ((30, range(28, 31)), (32, range(33, 35))):
    for z in range(27, 41):
        if z in gaps: g.opening((x, z), (x, z + 1))
        else: g._stamp((x, z), (x, z + 1), flags=['normal'], heightFt=3.5, material='ashlar', wall=True)
g.prop('T8-rubble-n', 'rubble', (30.1, 29.5), 'T8', dims={'n': 4}); g.prop('T8-rubble-s', 'rubble', (31.9, 34), 'T8', dims={'n': 3})
g.prop('T9-fallen', 'rubble', (28.6, 24), 'T9', dims={'n': 7})
g.note('T8-note', (31, 37.5), 'T8', 'Slippery in a few places but safe. 500 ft down to the Luna River, barely seen through the fog. Bloodhorn\'s Charge and the Roc of Mount Ghakis can strike here.')
g.note('T7-note', (31, 44), 'T7', 'Empty guard posts; anyone in them is out of the roc\'s reach.')

# --- the land: the mountain's flank to the north, the drop into the fog to the south, the gorge under the bridge
along(g, WEST_L, 'rock-flank', None, 'flank-w', {'h': 110, 'd': 160}, step=28)
along(g, [(18.5, 41), (6, 41)], 'rock-flank', None, 'flank-rim', {'h': 100, 'd': 120}, step=30)
along(g, EAST_L, 'rock-flank', None, 'flank-e', {'h': 120, 'd': 160}, step=28)
along(g, [(12, 27), (26.5, 27)], 'rock-flank', None, 'flank-er', {'h': 100, 'd': 120}, step=30)
drop_w = [p for p in WEST_R[::-1] if p[1] > 76.4] + [(53.5, 76.3), (55.8, 75.4), (57.4, 73.4), (57.6, 70.5), (56.6, 67.9), (54.5, 66.6), (51.6, 66.6)] + [p for p in WEST_R[::-1] if p[1] < 66]
along(g, drop_w, 'precipice', None, 'drop-w', {'depth': 320, 'd': 60}, step=24)
along(g, EAST_R, 'precipice', None, 'drop-e', {'depth': 320, 'd': 60}, step=24)
along(g, [(36, 41), (18.5, 41)], 'precipice', None, 'gorge-w', {'depth': 420, 'd': 14}, step=20)
along(g, [(18.5, 41), (6, 41)], 'precipice', None, 'gorge-w2', {'depth': 420, 'd': 14}, step=25)
along(g, [(12, 27), (26.5, 27)], 'precipice', None, 'gorge-e2', {'depth': 420, 'd': 14}, step=25)
along(g, [(26.5, 27), (34, 27), (35.5, 27)], 'precipice', None, 'gorge-e', {'depth': 420, 'd': 14}, step=20)
g.prop('fog', 'fog-sea', (31, 50), None, dims={'r': 1500, 'y': -70})
g.prop('T8-span', 'bridge-span', (31, 34), 'T8', dims={'len': 70, 'w': 10, 'drop': 80})
for i, (x, z, s) in enumerate([(24, 46.5, 1.0), (21.5, 44.2, 0.85), (27.5, 47.6, 0.7)]):
    g.prop(f'spruce{i}', 'pine', (x, z), None, dims={'scale': s, 'h': 26})
for i, (x, z) in enumerate([(44.6, 94), (43.9, 83), (44.2, 64), (38.6, 55.6), (34, 48.8), (36.6, 21.3), (42.4, 13.6)]):
    g.prop(f'boulder{i}', 'boulder', (x, z), None, dims={'r': 1.6 + (i % 3) * 0.5})
g.obj('spawn', 'spawn', (45.5, 93.5), 'dm-note', None, 'The road from the Raven River crossroads')
g.note('contours', (36.5, 62.5), None, 'The map\'s contours (+100 to +1,000 ft) measure the mountain from the river; the road runs about level at +500, the tower roof 540 ft above the valley. The road is snowbound: extreme cold at night without cold-weather gear.')

# --- figures and events
g.creature('rider', 'phantom-rider', (31, 34), 'T8', 'Strahd\'s phantom rider: a grim warning; touched or spoken to, horse and rider scatter like ash', size='large')
g.creature('roc', 'roc', (22, 34), 'T8', 'Roc of Mount Ghakis (event): dives on parties crossing east to west, snatches a horse or mule if it can, can\'t reach the guard posts', size='gargantuan')
g.creature('sangzor', 'giant-goat', (41.2, 58.4), None, 'Sangzor, the Bloodhorn (event): giant goat, 33 hp, resists nonmagical weapons; charges down the slope, a failed save sends the target 100 ft down onto a ledge; flees at 10 damage', size='large')

# ================================================================== T2 the gatehouse top (+30)
t2 = Level('gate-top', 'Gatehouse top (T2)', 30, 10, interior='ashlar', exterior='ashlar', north='-x')
t2.room('T2', 'Demon Statues', rect(44, 77, 50, 79), 'flagstone', page=pg('T2'))
t2._stamp((44, 77), (50, 77), flags=['normal'], heightFt=2.5, wall=True); t2._stamp((44, 79), (50, 79), flags=['normal'], heightFt=2.5, wall=True)
t2._stamp((44, 77), (44, 79), flags=['normal'], heightFt=2.5, wall=True); t2._stamp((50, 77), (50, 79), flags=['normal'], heightFt=2.5, wall=True)
for i, x in enumerate((45, 49)):
    t2.prop(f'vrock-statue{i}', 'vrock-statue', (x, 78), 'T2')
t2.note('T2-note', (47, 76.2), 'T2', 'The two statues are petrified vrocks: they turn to flesh (vrock statistics) if attacked or if anyone flies or climbs past the gate, pursue fleeing prey and fight to the death.')

# ================================================================== T5 the tower's upper floor (+20)
u = Level('tower-upper', 'Guard tower, upper floor (T5)', 20, 20, interior='ashlar', exterior='ashlar', north='-x')
WIN_NW = (lerp(OCT[7], OCT[0], 0.3), lerp(OCT[7], OCT[0], 0.7))
# the stairwell: the stair from below arrives up the north-west diagonal; the floor stops short of it behind a rail
RAIL = ((53.093, 74), (50, 70.907))
T5P = [OCT[0], WIN_E[0], WIN_E[1], OCT[1], *WIN_NE, OCT[2], OCT[3], *WIN_SE, OCT[4], RAIL[0], RAIL[1], OCT[7], *WIN_NW]
u.room('T5', 'Guard Tower, Upper Floor', T5P, 'flagstone', page=pg('T5'), ceilingFt=20)
for w in (WIN_E, WIN_NE, WIN_SE, WIN_NW): exact(u, *w, flags=['window'], wall=True)
exact(u, *RAIL, flags=['normal'], heightFt=3.5, material='ashlar', wall=True)
for a_, b_ in ((RAIL[0], OCT[5]), (OCT[5], OCT[6]), (OCT[6], RAIL[1])): u.wall(a_, b_, material='ashlar')   # the tower's own wall round the stairwell
u.prop('T5-hearth', 'fireplace', (55.55, 71), 'T5', rotY=-90)
u.prop('T5-wolfhead', 'dire-wolf-head', (55.85, 71), 'T5', rotY=-90, dims={'y': 9.5})
u.prop('T5-ladder', 'iron-ladder', (53, 71.9), 'T5', dims={'h': 20})
u.note('T5-note', (53, 69.5), 'T5', 'An icebox: wind howls down the chimney. The trapdoor overhead squeals as it opens onto the roof (T6).')

# ================================================================== T6 the rooftop (+40)
r6 = Level('tower-roof', 'Guard tower rooftop (T6)', 40, 10, interior='ashlar', exterior='ashlar', north='-x')
r6.room('T6', 'Guard Tower Rooftop', OCT, 'snow', page=pg('T6'))
for a, b in zip(OCT, OCT[1:] + OCT[:1]):
    if a[0] == b[0] or a[1] == b[1]: r6._stamp(a, b, flags=['normal'], heightFt=3.5, wall=True)
    else: exact(r6, a, b, flags=['normal'], heightFt=3.5, wall=True)
r6.prop('T6-merlons', 'octa-merlons', TOWER, 'T6', dims={'r': 15, 'y': 3.5})
r6.prop('T6-trapdoor', 'trapdoor', (53, 71.9), 'T6')
r6.prop('T6-chimney', 'chimney', (55.6, 71), 'T6', dims={'y': 0, 'h': 5})
for i, (x, z) in enumerate(OCT):
    a = math.degrees(math.atan2(x - TOWER[0], z - TOWER[1]))                    # local +z faces outward
    p = (TOWER[0] + (x - TOWER[0]) * 0.9, TOWER[1] + (z - TOWER[1]) * 0.9)
    r6.prop(f'T6-knight{i}', 'gold-knight', p, 'T6', rotY=round(a, 1), dims={'h': 10}, y=3.5)
for i, (x, z, rot) in enumerate([(51.4, 69.4, 30), (54.8, 70, 110), (52, 73, 200), (54.4, 73.2, 300)]):
    r6.prop(f'T6-skel{i}', 'skeleton', (x, z), 'T6', rotY=rot)
    r6.prop(f'T6-drift{i}', 'snow-drift', (x + 0.3, z + 0.2), 'T6', rotY=rot, dims={'r': 2.6, 'h': 0.9})
r6.hidden('T6-gear', 'gear-pile', (52, 73), 'T6', 'Under the snow, four guards\' remains: tattered cloth, broken longbows and arrows, rusted blades in ruined sheaths, rusty chain mail')
for i in range(6):
    a = i / 6 * 2 * math.pi
    r6.creature(f'maiden{i}', 'snow-maiden', (TOWER[0] + math.cos(a) * 1.9, TOWER[1] + math.sin(a) * 1.9), 'T6', 'Snow maiden (specter; cold immune, cold Life Drain): only if the card reading puts a treasure here; it appears in the snow when the last falls')
r6.note('T6-note', (53, 69.2), 'T6', 'The roof is 40 ft up and 540 ft above the misty valley. Eight 10-ft gold-plated statues of women knights with lances stand on the battlements, facing out.')

# ================================================================== descriptions (our own words)
DESC = {
  'T1': ("A black stone wall studded with spikes closes the road, horned vulture-demons squatting along its top; green fire burns behind the shut iron portcullis in its centre.",
         "Gatehouse 30 ft high, walls 20 ft. The portcullis rises by itself when anyone comes within 10 ft and drops again after a minute."),
  'T2': ("Two horned, vulture-headed demons carved in stone squat on the gatehouse roof.",
         "Petrified vrocks: they turn to flesh if attacked or if anyone flies or climbs past the gate, pursue fleeing prey and fight to the death."),
  'T3': ("Silent green fire hangs like a curtain across the gate's inner arch.",
         "6d10 (33) fire on entering it for the first time on a turn or starting a turn in it. Dispel magic DC 16 suppresses it 1 minute; antimagic suppresses it."),
  'T4': ("An eight-sided room of pale stone. The fireplace opposite the door is dead and the wind whistles in its flue; steps climb along one wall, and three windows show nothing but fog below.",
         "The ironbound door is barred inside (DC 22 Strength to force). The stair climbs 20 ft to T5. X marks the arrival point for teleports from K78."),
  'T5': ("Bitter cold up here, and nearly every wall has a window. A rusted ladder climbs to a trapdoor in the ceiling; a dire wolf's head glares down from above the hearth.",
         "The rusted ladder is bolted to floor and ceiling; the trapdoor squeals open onto the roof."),
  'T6': ("Snow drifts across a battlemented roof under a grey sky; gilded statues of women knights with lances stand on the merlons, staring outward. Bones in rusted mail lie under the snow.",
         "40 ft up, 540 ft above the valley. Four old guards' remains: rags, broken bows and arrows, rusted swords, rusty mail. Card-reading treasure: six snow maidens rise from the snow."),
  'T7': ("A tall stone arch marks the bridge's west end; on top, two stone horsemen level their lances at each other. Wind moans through the gorge below.",
         "Empty guard posts on each side of the road give some shelter from the wind, and from the roc."),
  'T7-north': ("A cramped stone guard post inside the arch, out of the wind.", "Empty. 10 ft wide; the roc can't reach anyone sheltering here."),
  'T7-south': ("A cramped stone guard post inside the arch, out of the wind.", "Empty. 10 ft wide; the roc can't reach anyone sheltering here."),
  'T8': ("The bridge runs narrow and high over the gorge, gaps where its parapets have fallen. Halfway across, a dark rider on a dark horse sits waiting.",
         "10 ft wide, 90 ft long, 500 ft above the Luna River; slippery but safe. The rider is Strahd's manifestation: any interaction and it scatters like ash."),
  'T9': ("The east arch, twin of the west, but one horseman has fallen to pieces and only the back half of his mount remains. Beyond, the road climbs on.",
         "Two empty 10-ft guard posts. Three miles on the pass forks: north to the Amber Temple, south round Mount Ghakis to the mists."),
  'T9-north': ("An empty guard post under the broken statue, chunks of the fallen knight outside.", "Empty 10-ft-square post; shelter from the roc."),
  'T9-south': ("An empty guard post inside the arch.", "Empty 10-ft-square post; shelter from the roc."),
}

# what players call hidden things once revealed (never the DM's detail)
SEEN = {'phantom-rider': 'A black-cloaked rider on a charcoal horse', 'roc': 'A gigantic bird', 'giant-goat': 'A huge grey goat with great horns', 'snow-maiden': 'Swirling snow, shaped like a woman',
        'gear-pile': 'Old gear under the snow'}
for lv in (g, u, t2, r6):
    for o in lv.objects:
        if o['vis'] in ('hidden-creature', 'hidden-object') and 'playerLabel' not in o: o['playerLabel'] = SEEN.get(o['kind'], 'Something')
levels = [g, u, t2, r6]
lk = lambda id, kind, al, ap, bl, bp: OrderedDict(id=id, kind=kind, **{'from': OrderedDict(level=al, pos=[ap[0] * 5, ap[1] * 5]), 'to': OrderedDict(level=bl, pos=[bp[0] * 5, bp[1] * 5])})
links = [lk('T-stair', 'stairs', 'pass', STAIR_FOOT, 'tower-upper', STAIR_HEAD), lk('T-ladder', 'trapdoor', 'tower-upper', (53, 71.9), 'tower-roof', (53, 71.9))]
scene = OrderedDict(schema=1, location='T', chapter='ch09', name='Tsolenka Pass', mapPage=158, bookScaleFt=10, ambient=AMB, stacked=True, entry='pass',
                    levels=[lv.to_json() for lv in levels], links=links)
for lv in scene['levels']:
    for r in lv['rooms']:
        d = DESC.get(r['key'])
        if d:
            r['desc'] = d[0]
            if d[1]: r['dm'] = d[1]
grid = OrderedDict(schema=1, levels=OrderedDict((lv.id, OrderedDict(floorPolygons=[[[round(x * 5, 3), round(z * 5, 3)] for x, z in p] for p in lv.floor_polys] + [[[round(x * 5, 3), round(z * 5, 3)] for x, z in p] for p, _ in lv.terrain],
                                                                     type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0.55)) for lv in levels))
out = os.path.join(ROOT, 'locations', 'ch09', 'T'); os.makedirs(out, exist_ok=True)
json.dump(scene, open(os.path.join(out, 'scene.json'), 'w'), indent=1)
json.dump(grid, open(os.path.join(out, 'grid.json'), 'w'), indent=1)
print('tsolenka pass:', [(lv.id, len(lv.rooms), len(lv.objects), len(lv.lights)) for lv in levels])
