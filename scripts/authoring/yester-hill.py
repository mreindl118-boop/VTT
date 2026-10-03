#!/usr/bin/env python3
"""Yester Hill (chapter 14, area Y; map p.199, one printed square = 50 ft), at true size on the 5-ft lattice: the
druids' hill on the western edge of Strahd's domain, read off the book's map in printed squares (S() turns a
square reading into cells). Two levels share the ground:

* hill - the whole map: the trail up from the north-east through the forest (Y1), the two dirt-trail rings that
  circle the hillside lined with black berserker cairns (Y2, keyed by sector as the book scatters its six labels),
  the druids' ring of black boulders on the top (Y3) with the fifty-foot effigy of Strahd inside it, the dead
  copse of the Gulthias tree on the south side of the top (Y4) and the wall of fog that closes the west (Y5);
  the forest on three sides. The hill climbs some 400 ft (contours on the plate); the map is drawn flat.
* summit - the battle inset: the hilltop at the same place, with the graves, druids, berserkers and blights.

Only keys, names, pages, dimensions, placements and our own wording live here. -> locations/ch14/Y/{scene,grid}.json"""
import json, math, os, sys
from collections import OrderedDict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from authorlib import ROOT, Level, rect, unit_edges, seg_key  # noqa: F401

_M = json.load(open(os.path.join(ROOT, 'manifests', 'locations.json')))
PAGE = {a['key']: a['page'] for l in _M['locations'] if l['id'] == 'Y' for a in l['areas']}
pg = lambda k: PAGE.get(k)


def S(c, r):
    """A reading in printed squares (column, row on the plate's grid) -> plan cells (5 ft)."""
    return (round((c - 1.5) * 10, 2), round((r - 4.5) * 10, 2))


def H(i, k=0):
    s = math.sin(i * 127.1 + k * 311.7) * 43758.5453
    return s - math.floor(s)


def catmull(pts, n=12, closed=True):
    """A smooth curve through control points (closed loop by default), n samples per span."""
    out, m = [], len(pts)
    rng = range(m) if closed else range(m - 1)
    for i in rng:
        p0, p1, p2, p3 = pts[(i - 1) % m], pts[i], pts[(i + 1) % m], pts[(i + 2) % m]
        if not closed:
            p0 = pts[max(i - 1, 0)]; p3 = pts[min(i + 2, m - 1)]
        for k in range(n):
            t = k / n; t2, t3 = t * t, t * t * t
            out.append(tuple(round(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3), 3) for j in (0, 1)))
    if not closed: out.append(tuple(pts[-1]))
    return out


def band(points, w):
    left, right = [], []
    for i, (x, z) in enumerate(points):
        if i == 0: dx, dz = points[1][0] - x, points[1][1] - z
        elif i == len(points) - 1: dx, dz = x - points[i - 1][0], z - points[i - 1][1]
        else: dx, dz = points[i + 1][0] - points[i - 1][0], points[i + 1][1] - points[i - 1][1]
        L = math.hypot(dx, dz) or 1
        nx, nz = -dz / L * w / 2, dx / L * w / 2
        left.append((round(x + nx, 2), round(z + nz, 2))); right.append((round(x - nx, 2), round(z - nz, 2)))
    return left + right[::-1]


def along(points, step, closed=False):
    """Points every `step` cells along a polyline (or loop)."""
    pts = points + ([points[0]] if closed else [])
    out, carry = [], 0.0
    for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
        L = math.hypot(x1 - x0, z1 - z0); d = carry
        while d < L:
            t = d / L; out.append((x0 + (x1 - x0) * t, z0 + (z1 - z0) * t))
            d += step
        carry = d - L
    return out


def inside(p, poly):
    x, z = p; c = False
    for (x0, z0), (x1, z1) in zip(poly, poly[1:] + poly[:1]):
        if (z0 > z) != (z1 > z) and x < x0 + (x1 - x0) * (z - z0) / (z1 - z0): c = not c
    return c


def dist_to(p, line):
    best = 1e9
    for (x0, z0), (x1, z1) in zip(line, line[1:]):
        dx, dz = x1 - x0, z1 - z0; L2 = dx * dx + dz * dz or 1
        t = max(0, min(1, ((p[0] - x0) * dx + (p[1] - z0) * dz) / L2))
        best = min(best, math.hypot(p[0] - x0 - dx * t, p[1] - z0 - dz * t))
    return best


def ov(lv, a, b, **kw):
    """Override one edge exactly as the wall builder splits it (diagonals whole, straight runs per cell)."""
    k = seg_key(a, b); lv.overrides[k] = dict(lv.overrides.get(k, {}), **kw)


def open_all(lv, poly):
    for a, b in unit_edges(poly): ov(lv, a, b, open_wall=True)


def circle(c, r, n=48, a0=0.0):
    return [(round(c[0] + math.cos(math.radians(a0 + i * 360 / n)) * r, 3), round(c[1] + math.sin(math.radians(a0 + i * 360 / n)) * r, 3)) for i in range(n)]


# ---------------------------------------------------------------- the plate, read in printed squares
W_CELLS, H_CELLS = 345, 450                                       # 34.5 × 45 squares: 1,725 × 2,250 ft
CEN = S(19.2, 28.7)                                               # the rings' centre
OUTER = catmull([S(*p) for p in [(19.2, 16.4), (23.0, 16.9), (25.6, 18.3), (27.0, 20.8), (27.5, 24.0), (27.6, 27.5), (27.0, 31.0), (25.8, 34.4),
                                  (24.0, 37.4), (21.6, 39.8), (18.6, 41.1), (15.6, 41.0), (12.9, 39.9), (10.8, 37.8), (9.5, 35.0), (9.2, 32.0),
                                  (9.6, 29.0), (10.4, 26.2), (11.4, 23.2), (12.8, 20.5), (14.8, 18.3), (17.0, 16.9)]], 8)
INNER = catmull([S(*p) for p in [(19.2, 19.0), (22.0, 19.4), (24.0, 20.6), (25.0, 22.6), (25.2, 25.5), (25.0, 28.8), (24.3, 32.0), (23.0, 34.8),
                                  (21.1, 37.0), (18.6, 38.4), (16.0, 38.5), (13.9, 37.5), (12.5, 35.6), (12.0, 33.0), (12.2, 30.0), (12.7, 27.2),
                                  (13.4, 24.6), (14.6, 22.2), (16.4, 20.2)]], 8)
TRAIL = catmull([S(*p) for p in [(36.2, 10.4), (33.0, 12.2), (30.0, 13.5), (27.5, 14.6), (25.6, 15.6), (24.6, 16.8), (24.0, 18.2), (23.4, 19.7),
                                 (22.4, 21.3), (21.4, 22.9), (20.8, 24.4), (20.45, 25.3)]], 4, closed=False)
SW_PATH = catmull([S(*p) for p in [(18.3, 29.9), (17.7, 30.8), (17.0, 31.6)]], 4, closed=False)
Y3C, Y3R = S(19.35, 27.6), 25.0                                  # the druids' ring: 250 ft across
STATUE = S(18.15, 27.45)
GULTHIAS = S(15.5, 33.2)
CLEAR = [S(*p) for p in [(5.0, 17.8), (7.5, 16.0), (10, 15.2), (13, 14.8), (17, 14.5), (21, 14.3), (24.5, 13.9), (27.0, 14.6), (28.4, 16.0), (28.8, 18.5),
                         (29.4, 21), (29.7, 25), (29.6, 29.5), (29.0, 33.3), (27.9, 36.4), (26.3, 39.0), (24.2, 41.3), (21.8, 42.9), (18.5, 43.8),
                         (15.0, 43.8), (11.6, 43.2), (8.8, 42.0), (6.6, 40.0), (5.2, 37.5), (4.6, 34), (4.6, 26), (4.8, 21)]]
FOG = [S(*p) for p in [(1.5, 13.6), (3.2, 14.2), (4.6, 15.6), (5.0, 17.8), (4.8, 21), (4.6, 26), (4.6, 34), (5.0, 37.0), (4.4, 39.2), (3.0, 40.4), (1.5, 40.8)]]


def polar(curve):
    """r(θ) of a curve that is star-shaped about CEN."""
    pts = sorted((math.atan2(z - CEN[1], x - CEN[0]), math.hypot(x - CEN[0], z - CEN[1])) for x, z in curve)
    def r(a):
        a = math.atan2(math.sin(a), math.cos(a))
        for (a0, r0), (a1, r1) in zip(pts + [(pts[0][0] + 2 * math.pi, pts[0][1])], pts[1:] + [(pts[0][0] + 2 * math.pi, pts[0][1])]):
            if a0 <= a <= a1: return r0 + (r1 - r0) * (a - a0) / ((a1 - a0) or 1)
        if a < pts[0][0]: return pts[0][1]
        return pts[-1][1]
    return r
R_OUT, R_IN = polar(OUTER), polar(INNER)
at = lambda r, a, k=0.0: (round(CEN[0] + math.cos(a) * (r(a) + k), 2), round(CEN[1] + math.sin(a) * (r(a) + k), 2))

AMB = 'barovian-overcast'
# ================================================================== the hill (the whole plate)
h = Level('hill', 'Yester Hill', 0, 12, ambient=AMB, interior='cave-rock', exterior='cave-rock', north='-z')
h.terrain.append((rect(0, 0, W_CELLS, H_CELLS), 'grass'))
for curve in (OUTER, INNER): h.terrain.append((band(curve + curve[:1], 2.4), 'dirt'))
h.terrain.append((band(TRAIL, 2.6), 'dirt'))
h.terrain.append((band(SW_PATH, 2.0), 'dirt'))

# Y2: the band of the two cairn rings, in six sectors (the plate scatters six Y2 labels round it)
SECT = [('north', -120), ('east', -60), ('southeast', 0), ('south', 60), ('southwest', 120), ('northwest', 180)]
for name, a0 in SECT:
    angs = [math.radians(a0 + k * 3) for k in range(21)]
    poly = [at(R_OUT, a, 12) for a in angs] + [at(R_IN, a, -4) for a in reversed(angs)]
    h.room(f'Y2-{name}', 'Berserker Cairns', poly, 'grass', page=pg('Y2'))
    open_all(h, poly)
# Y1: the trail from the map's edge down to the outer ring
y1 = band([p for p in TRAIL if math.hypot(p[0] - CEN[0], p[1] - CEN[1]) > R_OUT(math.atan2(p[1] - CEN[1], p[0] - CEN[0])) + 14], 4.4)
h.room('Y1', 'Trail', y1, 'dirt', page=pg('Y1')); open_all(h, y1)
# Y3: the druids' ring; the boulders make a low wall you can climb over (it blocks sight like rough ground)
Y3P = circle(Y3C, Y3R, 48)
GAPS = [-70, 122]                                                  # where the trails pass through
def ring_walls(lv, poly):
    for i, (a, b) in enumerate(zip(poly, poly[1:] + poly[:1])):
        mid = math.degrees(math.atan2((a[1] + b[1]) / 2 - Y3C[1], (a[0] + b[0]) / 2 - Y3C[0]))
        if any(abs(((mid - g + 180) % 360) - 180) < 8 for g in GAPS): ov(lv, a, b, open_wall=True)
        else: ov(lv, a, b, flags=['terrain', 'ethereal'], heightFt=7)
Y4P = [(round(GULTHIAS[0] + math.cos(math.radians(a)) * (19 + 4 * math.sin(math.radians(a * 3 + 20))), 2), round(GULTHIAS[1] + math.sin(math.radians(a)) * (21 + 3 * math.cos(math.radians(a * 2))), 2)) for a in range(0, 360, 20)]
h.room('Y3', "Druids' Circle", Y3P, 'dirt', page=pg('Y3')); ring_walls(h, Y3P)
h.room('Y4', 'Gulthias Tree', Y4P, 'dirt', page=pg('Y4')); open_all(h, Y4P)
Y5P = FOG
h.room('Y5', 'Wall of Fog', Y5P, 'grass', page=pg('Y5')); open_all(h, Y5P)


def summit_dressing(lv, full):
    """The ring of black boulders, the effigy and the dead copse: the same on both levels."""
    for i, (x, z) in enumerate(along(Y3P, 1.5, closed=True)):
        a = math.degrees(math.atan2(z - Y3C[1], x - Y3C[0]))
        if any(abs(((a - g + 180) % 360) - 180) < 5.5 for g in GAPS): continue
        j = (H(i, 1) - 0.5) * 1.2
        lv.prop(f'boulder{i}', 'black-boulder', (x + math.cos(math.radians(a)) * j, z + math.sin(math.radians(a)) * j), None, rotY=int(H(i, 2) * 360), dims={'r': round(2.2 + H(i, 3) * 2.6, 2)})
    for i in range(10):                                            # loose rocks spilled from the ring
        a = math.radians(i * 37 + 11); r = Y3R + (2.5 + H(i, 4) * 3) * (1 if i % 2 else -1)
        lv.prop(f'rock{i}', 'black-boulder', (Y3C[0] + math.cos(a) * r, Y3C[1] + math.sin(a) * r), None, dims={'r': round(1.2 + H(i, 5), 2)})
    lv.prop('effigy', 'strahd-effigy', STATUE, 'Y3' if not full else 'Y3-summit', rotY=25)
    lv.objects[-1]['desc'] = 'A fifty-foot effigy of woven sticks stuffed with black soil: a giant fanged figure in a cloak, roots coiled round its feet.'
    lv.prop('gulthias', 'gulthias-tree', GULTHIAS, 'Y4' if not full else 'Y4-summit')
    lv.objects[-1]['desc'] = 'An enormous gnarled tree oozing dark red sap, an axe bright in its trunk and a skeleton among its roots.'
    for i, a in enumerate(range(0, 360, 26)):
        r = 7 + H(i, 6) * 11; p = (GULTHIAS[0] + math.cos(math.radians(a)) * r, GULTHIAS[1] + math.sin(math.radians(a)) * r)
        if inside(p, Y4P): lv.prop(f'deadtree{i}', 'dead-tree', p, None, rotY=a * 7 % 360, dims={'scale': round(0.7 + H(i, 7) * 0.5, 2)})
    for i, a in enumerate(range(10, 360, 23)):
        r = 9 + H(i, 8) * 9; p = (GULTHIAS[0] + math.cos(math.radians(a)) * r, GULTHIAS[1] + math.sin(math.radians(a)) * r)
        if inside(p, Y4P): lv.prop(f'shrub{i}', 'dead-shrub', p, None, dims={'scale': round(0.9 + H(i, 9) * 0.6, 2), 'seed': i})


summit_dressing(h, False)
# the cairns: a ring just outside each trail, about one every fifty feet, and a few strays
n = 0
for which, (r, k, cnt) in enumerate(((R_OUT, 6.5, 64), (R_IN, 6.0, 48))):
    for i in range(cnt):
        a = 2 * math.pi * i / cnt + H(i, which) * 0.04
        p = at(r, a, k + (H(i, 3 + which) - 0.5) * 2)
        if dist_to(p, TRAIL) < 4: continue
        h.prop(f'cairn{n}', 'cairn', p, f'Y2-{SECT[int(((math.degrees(a) + 120) % 360) // 60)][0]}', rotY=int(H(i, 5) * 360), dims={'seed': n, 'r': round(5.5 + H(i, 6) * 1.5, 2)})
        n += 1
KAVAN = at(R_OUT, math.radians(150), 6.5)
h.hidden('kavan', 'skeleton', KAVAN, 'Y2-southwest', 'Kavan\'s cairn: under the heavy rocks lie his moldy bones and the blood spear (appendix C); the chosen character gets +2 to hit and damage with it (Blood Spear of Kavan event).')
h.objects[-1]['playerLabel'] = 'Old bones under the rocks'
# the forest on three sides, the trail cut through it; the fog closes the west
trees = 0
for gz in range(0, H_CELLS + 1, 8):
    for gx in range(0, W_CELLS + 1, 8):
        i = gz * 1000 + gx
        x, z = gx + (H(i, 1) - 0.5) * 6, gz + (H(i, 2) - 0.5) * 6
        if not (0 <= x <= W_CELLS and 0 <= z <= H_CELLS): continue
        if inside((x, z), CLEAR) or inside((x, z), FOG) or dist_to((x, z), TRAIL) < 6: continue
        edge = min(dist_to((x, z), CLEAR + CLEAR[:1]), 40)
        if edge < 3 and H(i, 3) < 0.5: continue                    # a ragged edge
        if H(i, 4) < 0.22: h.prop(f'tree{trees}', 'oak', (x, z), None, dims={'r': round(1.1 + H(i, 5) * 0.6, 2), 'h': round(20 + H(i, 6) * 10, 1), 'canopy': round(13 + H(i, 7) * 6, 1)})
        else: h.prop(f'tree{trees}', 'pine', (x, z), None, dims={'scale': round(1.0 + H(i, 8) * 0.5, 2)})
        trees += 1
for i, z in enumerate(range(95, 365, 34)):
    h.prop(f'fog{i}', 'fog-wall', (8 + (H(i, 1) - 0.5) * 6, z), 'Y5', dims={'len': 180, 'h': 140, 'seed': i})
# notes for the table
h.note('Y1-note', S(28.6, 13.8), 'Y1', 'Up through dense forest to a bare hill of black cairns under massing storm clouds, lightning on the top; westward the world ends in fog.')
h.note('Y2-note', S(16.0, 17.3), 'Y2-north', 'Two dirt tracks circle the slope, each edged with ten-foot cairns of slick black stone: graves of an old berserker tribe, untouched for centuries.')
h.note('Y3-note', S(19.35, 25.6), 'Y3', 'The battle is on the Summit level (the inset): graves, druids, berserkers; lightning strikes the ring.')
h.note('Y4-note', S(15.5, 35.3), 'Y4', 'The copse of the Gulthias tree; its blights are placed on the Summit level.')
h.note('Y5-note', S(3.2, 27.0), 'Y5', 'Looking west from the summit or the west slope: a pale castle above a far-off city seems to float in the fog, and a bell tolls faintly. It is an illusion. Entering the fog: Mists of Ravenloft (ch.2).')
for k, (c, r) in enumerate([((20.4, 37.1), '+400 ft'), ((21.4, 39.6), '+300 ft'), ((22.8, 41.9), '+200 ft'), ((24.6, 44.2), '+100 ft')]):
    h.note(f'contour{k}', S(*c), None, f'Contour {r}: the hill climbs about 400 ft from the forest to the top (the map is drawn flat).')
h.note('wintersplinter', S(21.5, 27.0), 'Y3', "Druids' Ritual: when Strahd comes (on Beucephalus or as a bat) the druids rise and chant for 10 rounds; Wintersplinter, a tree blight, bursts from the statue and marches north on the Wizard of Wines. Needs room for a Huge creature.")
h.obj('spawn', 'spawn', S(34.2, 11.4), 'dm-note', None, 'The party comes up the trail from the north-east')

# ================================================================== the summit (battle inset)
s = Level('summit', 'Summit (battle inset)', 0, 12, ambient=AMB, interior='cave-rock', exterior='cave-rock', north='-z')
SB = (S(12.6, 21.6), S(26.2, 37.9))                                # the inset's frame
s.terrain.append((rect(SB[0][0], SB[0][1], SB[1][0], SB[1][1]), 'grass'))
clip = lambda line: [p for p in line if SB[0][0] - 3 <= p[0] <= SB[1][0] + 3 and SB[0][1] - 3 <= p[1] <= SB[1][1] + 3]
for seg in (clip(TRAIL), clip(SW_PATH)):
    if len(seg) > 1: s.terrain.append((band(seg, 2.6), 'dirt'))
s.room('Y3-summit', "Druids' Circle", Y3P, 'dirt', page=pg('Y3')); ring_walls(s, Y3P)
s.room('Y4-summit', 'Gulthias Tree', Y4P, 'dirt', page=pg('Y4')); open_all(s, Y4P)
summit_dressing(s, True)
# the inner ring's cairns where they fall inside the inset
for i in range(48):
    a = 2 * math.pi * i / 48 + H(i, 1) * 0.04
    p = at(R_IN, a, 6.0 + (H(i, 4) - 0.5) * 2)
    if SB[0][0] + 3 < p[0] < SB[1][0] - 3 and SB[0][1] + 3 < p[1] < SB[1][1] - 3 and dist_to(p, TRAIL) >= 4:
        s.prop(f'cairn{i}', 'cairn', p, None, rotY=int(H(i, 5) * 360), dims={'seed': i, 'r': round(5.5 + H(i, 6) * 1.5, 2)})
# the dozen hidden graves and their sleepers (six druids, six berserkers)
GR = [(-14, -9), (-8, 12), (2, -16), (9, 8), (15, -6), (-17, 4), (-3, 18), (12, 15), (18, 3), (-11, -16), (6, -6), (-4, 4)]
for i, (dx, dz) in enumerate(GR):
    p = (Y3C[0] + dx, Y3C[1] + dz)
    if math.hypot(p[0] - STATUE[0], p[1] - STATUE[1]) < 6: p = (p[0] + 6, p[1])
    s.hidden(f'grave{i}', 'sod-grave', p, 'Y3-summit', 'A grave hidden under a lid of turf (passive Perception 16 spots all twelve)', rotY=int(H(i, 2) * 180))
    s.objects[-1]['playerLabel'] = 'A patch of dead sod'
    kind = 'druid' if i % 2 == 0 else 'berserker'
    lab = 'Druid (CE human) smeared all over with blue-grey mud, asleep in a grave; waits for Strahd before starting the ritual' if kind == 'druid' else 'Berserker (CE human) of the mountain tribe, mud-smeared, asleep in a grave'
    s.creature(f'sleeper{i}', kind, p, 'Y3-summit', lab)
    if kind == 'druid': s.objects[-1]['dims'] = {'v': 4}
s.hidden('gem', 'crystal-orb', STATUE, 'Y3-summit', 'The vineyard\'s stolen magic gem (a glowing green pinecone-sized gem) planted in the effigy\'s chest: climb and dig (d20 >= 13); drops out glowing when the effigy falls.')
s.objects[-1]['pos'][1] = 33; s.objects[-1]['playerLabel'] = 'A green glow'
s.creature('wintersplinter', 'tree-blight', STATUE, 'Y3-summit', 'Wintersplinter (tree blight) - only after the Druids\' Ritual: bursts from the statue with the gem in its heart and marches on the Wizard of Wines', size='huge')
s.note('Y3-statue', (STATUE[0], STATUE[1] + 6), 'Y3-summit', 'Statue: AC 10, 50 hp, immune poison and psychic; oil + fire = 2d6 fire a round. Gulthias roots hold it up. Destroyed: the gem tumbles out glowing green.')
s.note('Y3-lightning', (Y3C[0] + 22, Y3C[1] - 10), 'Y3-summit', 'Climbing over the boulders: 10% chance of a lightning strike, 44 (8d10) lightning. The two trail gaps are safe.')
s.note('Y3-graves', (Y3C[0] - 6, Y3C[1] + 20), 'Y3-summit', 'Six druids and six berserkers sleep under sod covers; they rise if anyone approaches or harms the statue, or once found and attacked. Replenished at dusk (1d4-1 of each a day, up to six).')
# Y4: needle blights in plain sight; vine and twig blights hidden among the dead plants
for i in range(6):
    a = math.radians(i * 60 + 15); p = (GULTHIAS[0] + math.cos(a) * 8, GULTHIAS[1] + math.sin(a) * 8)
    s.creature(f'needle{i}', 'needle-blight', p, 'Y4-summit', 'Needle blight (6), skulking round the tree in plain sight; attacks anyone who harms it')
for i in range(3):
    a = math.radians(i * 120 + 50); p = (GULTHIAS[0] + math.cos(a) * 13, GULTHIAS[1] + math.sin(a) * 13)
    s.creature(f'vine{i}', 'vine-blight', p, 'Y4-summit', 'Vine blight (3): False Appearance among the dead shrubs')
for i in range(12):
    a = math.radians(i * 30 + 5); r = 10 + (i % 3) * 3; p = (GULTHIAS[0] + math.cos(a) * r, GULTHIAS[1] + math.sin(a) * r)
    s.creature(f'twig{i}', 'twig-blight', p, 'Y4-summit', 'Twig blight (12): False Appearance among the dead plants', size='small')
s.hidden('axe', 'wall-sword', (GULTHIAS[0] + 0.08, GULTHIAS[1] + 1.1), 'Y4-summit', 'The axe in the trunk: magic, its haft carved with foliage, half the usual weight; +1d8 slashing against plants; grows thorns that prick a non-good wielder for 1 piercing per attack.')
s.objects[-1]['dims'] = {'y': 7.6}; s.objects[-1]['rotY'] = 90; s.objects[-1]['playerLabel'] = 'An axe in the trunk'
s.note('Y4-tree', (GULTHIAS[0] - 10, GULTHIAS[1] + 14), 'Y4-summit', 'Gulthias tree: AC 15, 250 hp, immune bludgeoning, piercing, psychic; at 0 hp it only seems dead (regains 1 hp a month) unless the whole stump is uprooted (Nature DC 15 tells). Hallow kills it in 3d10 days. 1,500 XP. Card reading treasure: buried under the skeleton.')
s.obj('spawn', 'spawn', S(20.6, 24.0), 'dm-note', None, 'The trail enters the ring here')

DESC = {
  'Y1': ("A path winds up through dense forest toward a bare hill heaped with black stone cairns; storm clouds pile overhead and lightning lances the top.", "The path forks into the two rings of Y2 and climbs on to the summit."),
  'Y2-north': ("Two rings of dirt track circle the hillside, each edged with ten-foot heaps of slick black stones.", "Burial cairns of an old berserker tribe, untouched for centuries."),
  'Y2-east': ("Black stone cairns line both tracks along the eastern slope.", "The path from Y1 crosses both rings here on its way up to the boulder ring."),
  'Y2-southeast': ("Black stone cairns line both tracks along the south-eastern slope.", "Mouldering berserker bones under every cairn."),
  'Y2-south': ("Black stone cairns line both tracks along the southern slope.", "Mouldering berserker bones under every cairn."),
  'Y2-southwest': ("Black stone cairns line both tracks along the south-western slope.", "Kavan's cairn is here (Blood Spear of Kavan)."),
  'Y2-northwest': ("Black stone cairns line both tracks on the north-western slope, the fog close beyond.", "From this slope the vision in the fog (Y5) is plain to see."),
  'Y3': ("A broad circle of black boulders round a patch of withered turf, and inside it a fanged, cloaked giant of woven sticks and black soil fifty feet tall.", "The ring is 250 ft across and 5-10 ft high. Details and creatures are on the Summit level."),
  'Y4': ("A sickly thicket of dead trees and brush on the summit's southern side, a monstrous twisted tree in its midst.", "The Gulthias tree and its blights (Summit level)."),
  'Y5': ("Westward everything simply ends: a wall of fog rises out of sight.", "Marks the boundary of Strahd's domain; the old mountain folk called it the Whispering Wall."),
  'Y3-summit': ("Withered turf inside a circle of black boulders five to ten feet tall, broken by two paths; the stick-and-soil effigy of a fanged, cloaked man looms over it.", "Twelve hidden turf-covered graves (six druids, six berserkers). The gem is in the statue's chest. Lightning may strike anyone who climbs the ring."),
  'Y4-summit': ("Dead trees and brush round an enormous gnarled tree oozing dark sap; spiny, gangly shapes prowl about it; an axe shines in the trunk above a skeleton.", "Gulthias tree; 6 needle blights in plain view, 3 vine and 12 twig blights hiding."),
}
levels = [h, s]
scene = OrderedDict(schema=1, location='Y', chapter='ch14', name='Yester Hill', mapPage=199, bookScaleFt=5, ambient=AMB, entry='hill',
                    levels=[lv.to_json() for lv in levels], links=[])
for lv in scene['levels']:
    for r in lv['rooms']:
        d = DESC.get(r['key'])
        if d:
            r['desc'] = d[0]
            if d[1]: r['dm'] = d[1]
    for o in lv['objects']:
        if o['vis'] in ('hidden-object', 'hidden-creature') and 'playerLabel' not in o:
            o['playerLabel'] = {'druid': 'A mud-caked figure', 'berserker': 'A mud-caked warrior', 'needle-blight': 'A needled shape', 'twig-blight': 'Dead twigs',
                                'vine-blight': 'Dead vines', 'tree-blight': 'Something vast'}.get(o['kind'], 'Something')
grid = OrderedDict(schema=1, levels=OrderedDict((lv.id, OrderedDict(
    floorPolygons=[[[x * 5, z * 5] for x, z in p] for p in lv.floor_polys] + [[[x * 5, z * 5] for x, z in p] for p, _ in lv.terrain[:1]],
    type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0.55)) for lv in levels))
out = os.path.join(ROOT, 'locations', 'ch14', 'Y'); os.makedirs(out, exist_ok=True)
json.dump(scene, open(os.path.join(out, 'scene.json'), 'w'), indent=1)
json.dump(grid, open(os.path.join(out, 'grid.json'), 'w'), indent=1)
print('yester hill:', [(lv.id, len(lv.rooms), len(lv.objects)) for lv in levels], 'trees', trees, 'cairns', n)
