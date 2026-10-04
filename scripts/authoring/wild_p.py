#!/usr/bin/env python3
"""P. Luna River Crossroads (p.40): an X of roads on a wooded shoulder west of the Luna River, the snapped four-armed
signpost in its eastern elbow, and a quarter mile north-east the low two-arched stone bridge over the river. The book
prints no battle map; this is the inferred site from the design brief. 1,300 x 800 ft, origin at the north-west corner,
x east, z south, north -z.

Layout: the X at (250, 430). The Old Svalich Road (20 ft, gravel, cobble edging, ditches) runs SW to (0, 563) and NE
500 ft to (691, 195), then eases to bearing 80 across the open hay terrace onto the west causeway (x 1100) and the
bridge: a 12-ft flood arch at (1178, 110) over a dry flood gully, a 50-ft main arch centred (1233, 100) over the Luna,
70 ft of road beyond to the east edge. The NW cart-track (12 ft, sunken between root-bound banks) climbs to (0, 170);
the SE trail (6 ft) drops to the corduroy at (470-495, 560-640) and leaves the south edge at (556, 800). The granite
knoll crown rises to +18 at (120, 330). Forest everywhere west of x 900; the wet hay terrace from there to the river.

Levels (stacked, all shown together): the ground (0) holds the X, the roads, the terrace and the bridge deck; the
knoll crown (+18) is the granite top; the Luna channel (-10) is the water surface in its trench under the bridge.
The X-to-terrace fall the brief describes (about 12 ft over 900 ft, a 1-in-75 grade) is folded into the datum so the
whole play surface is one level; the trench, the arches and the river keep the brief's heights relative to the
terrace: the water 10 ft down, the main arch's soffit 8 ft over it. Only keys, names, pages, distances and
placements come from the book; every description is our own words."""
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wildlib import *  # noqa: F401,F403
from wildlib import Site, Level, catmull, ribbon, inside, rnd, heading, facing, turn, blob, along, line_dist, seg_dist
from collections import OrderedDict

W_FT, H_FT = 1300, 800
X = (250.0, 430.0)                       # the crossing
BR = (1178.0, 110.0)                     # the flood arch's centre: the bridge's anchor
AX = (math.sin(math.radians(80)), -math.cos(math.radians(80)))   # the bridge axis, bearing 80
BROT = heading(*AX)                      # its rotY
MAIN_X = 55.9                            # the main arch's centre, along the axis from the anchor
WATER = -10.0                            # the river's surface (the river level's floor)
TRENCH = dict(wx0=1210, wx1=1250, t0=1200, t1=1262)   # water edges, bank tops
GULLY = (1166, 1192, 30, 190)           # the dry flood gully under the flood arch (x0, x1, z0, z1)
GULLY_Y = -4.5
CLIP = (1160, 1266, -90, 890)         # the column cut out of the land drawn beyond the map (see p-river-trench)
CROWN = (120.0, 330.0)


def C(p):
    return (p[0] / 5, p[1] / 5)


def CP(pts):
    return [C(p) for p in pts]


def bear(b):
    """unit plan vector for a compass bearing (north -z, east +x)"""
    return (math.sin(math.radians(b)), -math.cos(math.radians(b)))


def ax(t, side=0.0):
    """a point t ft along the bridge axis from its anchor, `side` ft to the south (local +z)"""
    o = turn(t, side, BROT)
    return (BR[0] + o[0], BR[1] + o[1])


def knollH(x, z):
    """The knoll's earth mound (ft) at map feet (x, z); the granite crown stands on it. Same numbers as knollH() in
    kit/sites/wild-p.ts."""
    dx, dz = x - CROWN[0], z - CROWN[1]
    rx = 62.0 if dx > 0 else 118.0
    rz = 96.0 if dz < 0 else 90.0
    q = (dx / rx) ** 2 + (dz / rz) ** 2
    return 0.0 if q >= 1 else 7.5 * (1 - q) ** 1.4


def edge_x(z):
    """the forest's edge onto the hay terrace"""
    return 905 + 22 * math.sin(z / 95.0) + 12 * math.sin(z / 37.0 + 1.3)


def line_dims(pts, origin, prefix=''):
    d = {prefix + 'n': len(pts)}
    for i, (x, z) in enumerate(pts):
        d[f'{prefix}x{i}'] = rnd(x - origin[0], 2); d[f'{prefix}z{i}'] = rnd(z - origin[1], 2)
    return d


def thin(line, step):
    """every point at least `step` ft from the last kept one (and the last)"""
    out = [line[0]]
    for p in line[1:]:
        if math.hypot(p[0] - out[-1][0], p[1] - out[-1][1]) >= step: out.append(p)
    if out[-1] != line[-1]: out.append(line[-1])
    return out


def trim(line, d0=0.0, d1=0.0):
    """the polyline with d0 ft cut from its start and d1 from its end"""
    segs = [math.hypot(line[i + 1][0] - line[i][0], line[i + 1][1] - line[i][1]) for i in range(len(line) - 1)]
    L = sum(segs); a, b = d0, L - d1; out = []; acc = 0.0
    for i, s in enumerate(segs):
        p, q = line[i], line[i + 1]
        s0, s1 = acc, acc + s
        if s1 >= a and s0 <= b:
            t0 = max(0.0, (a - s0) / s) if s else 0.0; t1 = min(1.0, (b - s0) / s) if s else 1.0
            pa = (p[0] + (q[0] - p[0]) * t0, p[1] + (q[1] - p[1]) * t0); pb = (p[0] + (q[0] - p[0]) * t1, p[1] + (q[1] - p[1]) * t1)
            if not out: out.append(pa)
            out.append(pb)
        acc = s1
    return out


def build():
    s = Site('P', 'Luna River Crossroads', W_FT // 5, H_FT // 5, 1031)
    lv = s.lv; lv.id, lv.name, lv.ceiling = 'ground', 'Crossroads shoulder and terrace', 18

    def P(kind, x, z, rot=0, dims=None, y=0, label=None, desc=None, key=None):
        return s.prop(kind, C((x, z)), rot=rot, dims=dims, y=y, label=label, desc=desc, key=key)

    def keep(poly, m=0.0):
        s.keep.append((CP(poly), m))

    # ================================================================== the ground: forest, terrace, trench, gully
    # Floors never overlap (grass and marsh draw at one height): the forest's grass runs to the terrace edge, the
    # terrace is wet meadow (marsh) to the river's bank top, and the trench and the flood gully are left open (their
    # banks, water and hollow are the p-river-trench piece). The east bank beyond the river is grass again.
    EDGE = [(rnd(edge_x(z)), z) for z in range(0, H_FT + 1, 20)]
    g0, g1, gz0, gz1 = GULLY
    lv.terrain = [(CP([(0, 0)] + EDGE + [(0, H_FT)]), 'grass')]
    s.patch(CP([(EDGE[0][0], 0), (g0, 0), (g0, H_FT)] + list(reversed(EDGE))), 'marsh')
    s.patch(CP([(g0, 0), (TRENCH['t0'], 0), (TRENCH['t0'], gz0), (g0, gz0)]), 'marsh')
    s.patch(CP([(g1, gz0), (TRENCH['t0'], gz0), (TRENCH['t0'], gz1), (g1, gz1)]), 'marsh')
    s.patch(CP([(g0, gz1), (TRENCH['t0'], gz1), (TRENCH['t0'], H_FT), (g0, H_FT)]), 'marsh')
    s.patch(CP([(TRENCH['t1'], 0), (W_FT, 0), (W_FT, H_FT), (TRENCH['t1'], H_FT)]), 'grass')
    # the bridge's footprint carries the ground across the trench and the gully (its slab lies inside the masonry)
    s.patch(CP([ax(-10, -7.3), ax(90, -7.3), ax(90, 7.3), ax(-10, 7.3)]), 'marsh')
    # trees keep off the terrace, the trench and the gully
    keep([(EDGE[0][0] - 8, -5)] + [(x - 8, z) for x, z in EDGE] + [(EDGE[-1][0] - 8, H_FT + 5), (TRENCH['t1'] + 4, H_FT + 5), (TRENCH['t1'] + 4, -5)])

    # the trench: banks, black water, the land cut away under it (vis 'explored': it carries the clip, see wild-p.ts)
    ta = (1195.0, 400.0)
    d = dict(wx0=TRENCH['wx0'] - ta[0], wx1=TRENCH['wx1'] - ta[0], t0=TRENCH['t0'] - ta[0], t1=TRENCH['t1'] - ta[0],
             z0=CLIP[2] - ta[1], z1=CLIP[3] - ta[1], mz0=-ta[1], mz1=H_FT - ta[1], wy=WATER,
             gx0=g0 - ta[0], gx1=g1 - ta[0], gz0=gz0 - ta[1], gz1=gz1 - ta[1], gy=GULLY_Y,
             cx0=CLIP[0], cx1=CLIP[1], cz0=CLIP[2], cz1=CLIP[3], ox=ta[0], oz=ta[1], bx=MAIN_X, brot=BROT, bax=BR[0], baz=BR[1])
    o = P('p-river-trench', *ta, dims=d, label='The Luna River', desc='A dark, slow river forty feet wide, sliding south in a trench below sedge banks; no rapids, no sound but a low hush.')
    o['vis'] = 'explored'

    # ================================================================== the roads
    NE = [X, (382, 360), (559, 266), (691, 195.5), (800, 175.8), (950, 149.3), (1100, 122.9), (1166, 111.3)]
    SW = [X, (125, 496.5), (0, 563)]
    NW = [X, (200, 343.4), (150, 257), (74.7, 213.5), (0, 170)]
    SE = [X, (358, 492.5), (467, 555), (511.5, 677), (556, 800)]
    EAST = [(1262, 94.3), (1300, 87.6)]
    ne_line = s.road(CP(NE), 2.0, floor='dirt', per=6)
    sw_line = s.road(CP(SW), 2.0, floor='dirt', per=4)
    s.road(CP(EAST), 2.0, floor='dirt', per=2)
    # the NW cart-track: gravel for its first hundred feet, petering out into ruts with turf between
    nw_line = s.road(CP(NW), 1.2, floor='grass', per=6, terrain=False)
    s.patch([(rnd(x), rnd(z)) for x, z in ribbon(catmull(CP(NW[:3]), 6)[:9], lambda f: 1.2 * (1 - f) + 0.55 * f)], 'dirt')
    se_line = s.road(CP(SE), 0.6, floor='dirt', per=6)
    # the trees stand back: 25 ft off the hard road's edges, nearer along the track and the trail
    s.road(CP(NE[:-1]), 7.0, terrain=False); s.road(CP(SW), 7.0, terrain=False); s.road(CP(EAST), 4.0, terrain=False)
    s.road(CP(NW[:3]), 3.4, terrain=False); s.road(CP(NW[2:]), 3.0, terrain=False)
    s.road(CP(SE), 2.6, terrain=False)
    s.patch(blob(X[0] / 5 + 0.6, X[1] / 5, 4.6, 7, sx=1.15), 'dirt')     # the X itself, scuffed to mud where the arms meet

    FT = lambda line: [(x * 5, z * 5) for x, z in line]
    ne_ft, sw_ft, nw_ft, se_ft = FT(ne_line), FT(sw_line), FT(nw_line), FT(se_line)
    # verges: cobble edging, gravel, the ditches either side holding black water and needles
    for line, d0, d1 in ((ne_ft, 24, 0), (sw_ft, 24, 0)):
        L = thin(trim(line, d0, d1), 6)
        o0 = L[len(L) // 2]
        P('p-road-verge', *o0, dims=dict(line_dims(L, o0), hw=10, seed=len(L)))
    L = thin([(1262, 94.3), (1300, 87.6)], 6); P('p-road-verge', *L[0], dims=dict(line_dims(L, L[0]), hw=10, seed=3, ditch=0))
    # the wheel ruts: straight in the hard road, swerving through the X onto the track and the trail
    for line, d0, d1, mode in ((ne_ft, 18, 0, 0), (sw_ft, 18, 0, 0)):
        L = thin(trim(line, d0, d1), 5); o0 = L[len(L) // 2]
        P('p-wheel-ruts', *o0, dims=dict(line_dims(L, o0), mode=mode, g=2.6, seed=len(L)))
    swerve = [(222, 445), (236, 437.5), (250, 431), (264, 425), (280, 417)]        # SW ruts through the X onto the NE arm, bowing round the post
    P('p-wheel-ruts', 250, 431, dims=dict(line_dims(catmull(swerve, 4), (250, 431)), mode=3, g=2.6, seed=4))
    swerve2 = [(236, 437), (244, 425), (243, 410), (236, 397)]                     # a cart turning up the track
    P('p-wheel-ruts', 244, 420, dims=dict(line_dims(catmull(swerve2, 4), (244, 420)), mode=3, g=2.4, seed=5))
    L = thin(trim(nw_ft, 26, 0), 5); o0 = L[len(L) // 2]
    P('p-wheel-ruts', *o0, dims=dict(line_dims(L, o0), mode=1, g=2.4, seed=9))
    # old hay-cart ruts across the terrace, standing water in them
    for i, pts in enumerate([[(930, 168), (975, 240), (1010, 330), (1032, 420), (1040, 520)], [(1060, 132), (1092, 230), (1110, 330), (1120, 455)]]):
        L = thin(catmull(pts, 5), 5); o0 = L[len(L) // 2]
        P('p-wheel-ruts', *o0, dims=dict(line_dims(L, o0), mode=2, g=2.5, seed=20 + i))

    # ================================================================== the X: the snapped signpost and the weeds
    nb, sb = bear(62), bear(120)
    wedge = [(X[0] + 33, X[1] + 1)]
    for t in (40, 70, 100, 130): wedge.append((X[0] + nb[0] * t - nb[1] * 14 + 0, X[1] + nb[1] * t + nb[0] * 14))
    for t in (130, 100, 70, 45): wedge.append((X[0] + sb[0] * t + sb[1] * 7.5, X[1] + sb[1] * t - sb[0] * 7.5))
    wedge = [(rnd(x, 1), rnd(z, 1)) for x, z in wedge]
    furrow = [(305, 436), (321, 451), (338, 468), (352.5, 485.5)]
    d = line_dims(wedge, (330, 440)); d.update(line_dims(furrow, (330, 440), 'f')); d['seed'] = 7
    P('p-weed-triangle', 330, 440, dims=d, label='Weeds in the eastern elbow', desc='A ragged wedge of nettle, dock and dead thistle between the two eastern roads, a flattened furrow dragged through it toward the Berez trail.')
    keep(wedge, 0.3)
    stub = (300.0, 432.0)
    P('p-signpost-stub', *stub, label='Snapped signpost', desc='The lower half of a stout oak post, splintered off about four feet up and leaning out of its packing of field stones toward the river.')
    P('p-signpost-crown', 330, 445, rot=-22, label="The signpost's top half", desc='The top of the signpost lies face-up in the weeds: a short shaft with four carved arms, their painted letters flaking white on grey. One arm is cracked and points at the sky.')
    s.hidden('p-wolf-prints', C((330, 456)), 'Oversized wolf prints in the furrow mud (Survival DC 12)', 'Big paw prints in the mud', dims=line_dims(furrow, (330, 456)),
             dm='Dire wolf prints, a cart wheel\'s gouge and a cask-hoop scrape: a dire wolf pack ran a wine cart off the road at the X; the post went with it, and the cask ended in the ditch to the west.')
    s.clear(stub[0] / 5, stub[1] / 5, 2.0)

    # the wolf-skull pine in the north elbow
    pine = (265.0, 345.0)
    P('p-wolf-skull-pine', *pine, rot=facing(X[0] - pine[0], X[1] - pine[1]), dims={'scale': 1.75}, label='The wolf-skull pine',
      desc='A big old pine with a column of wolf skulls nailed up its trunk, a dozen of them, the highest still wearing its hide. Rows of knife notches score the bark beside them.')
    s.trees.append((pine[0] / 5, pine[1] / 5, 4.0)); s.clear(pine[0] / 5, pine[1] / 5, 3.4)
    s.hidden('p-fresh-skull', C(pine), 'Fresh notches and a skull still wet (trappers within the week)', 'A fresh skull on the pine', rot=facing(X[0] - pine[0], X[1] - pine[1]), dims={'scale': 1.75},
             dm='Barovian trappers thinning Strahd\'s wolves passed here within the week. The werewolves who pose as trappers (p.33) stand under exactly this tree. If the hunting-trap result is rolled, the trap lies under the needles where travellers cut the corner from the track (DC 15 Survival, front rank).')

    # the cask wreck in the SW arm's north ditch
    cw = (120.0, 485.0)
    P('p-wine-cask-wreck', *cw, rot=heading(-bear(242)[0], -bear(242)[1]) + 180, label='Smashed cask in the ditch',
      desc='A burst wine cask and a cart\'s tailboard lie in the ditch, hoop and staves strewn up the bank, and a raw gouge shows where a wheel went off the road.')
    keep([(cw[0] - 14, cw[1] - 10), (cw[0] + 14, cw[1] - 10), (cw[0] + 14, cw[1] + 6), (cw[0] - 14, cw[1] + 6)], 0.4)
    s.hidden('p-coin-pouch', C((cw[0] + 3, cw[1] + 1)), 'Branded staves; 7 cp in a pouch under the tailboard (Investigation DC 10)', 'A pouch in the ditch',
             dm='The staves are burned with the Wizard of Wines\' mark: this is the overdue delivery Urwin Martikov is waiting on at the Blue Water Inn (p.98). The carter\'s purse holds 7 cp.')

    # ================================================================== the knoll and its granite crown
    P('p-knoll', *CROWN, dims={'h': 7.5})
    rr = __import__('random').Random(18)
    def rough(cx, cz, rx, rz, n, lo, hi):
        return [(cx + rx * math.cos(a) * rr.uniform(lo, hi), cz + rz * math.sin(a) * rr.uniform(lo, hi)) for a in [i * 2 * math.pi / n + rr.uniform(-0.12, 0.12) for i in range(n)]]
    base = rough(CROWN[0] + 1, CROWN[1] + 1, 31, 27, 14, 0.8, 1.08)
    mid = rough(CROWN[0] - 4, CROWN[1] - 1, 24, 21, 12, 0.82, 1.06)
    top = rough(CROWN[0] - 6, CROWN[1] - 5, 18, 15, 11, 0.88, 1.06)
    d = line_dims(base, CROWN, 'b'); d.update(line_dims(mid, CROWN, 'm')); d.update(line_dims(top, CROWN, 't'))
    d.update(hb=knollH(*CROWN) - 2.5, hm=9.5, ht=14.2, top=18.1)
    P('p-rock-outcrop', *CROWN, dims=d, label='The knoll crown', desc='A knob of lichen-blotched granite breaking through the needles, ringed by the oldest pines on the map. Its top is dry and flat, ankle-deep in old needles.')
    keep(base, 1.6); s.clear(CROWN[0] / 5, CROWN[1] / 5, 8.4)

    # ================================================================== the NW cart-track: a sunken lane between root-bound banks
    trk = thin(trim(nw_ft, 34, 0), 5)
    for side in (1, -1):
        L2 = []
        for i, p in enumerate(trk):
            a, b = trk[max(0, i - 1)], trk[min(len(trk) - 1, i + 1)]
            tx, tz = b[0] - a[0], b[1] - a[1]; Ln = math.hypot(tx, tz) or 1
            nx, nz = -tz / Ln, tx / Ln
            L2.append((p[0] + nx * side * 6.6, p[1] + nz * side * 6.6))
        o0 = L2[len(L2) // 2]
        P('p-hollow-lane-bank', *o0, dims=dict(line_dims(L2, o0), side=side, h=3.6, ramp=60, seed=11 + side),
          label='Root-bound bank' if side == 1 else None, desc='The track runs sunken between earth banks shoulder-high to a dwarf, pine roots looping out of their faces.' if side == 1 else None)
        s.road(CP(L2), 2.0, terrain=False)                # no tree stands on the bank's face

    # ================================================================== the SE trail: the boggy knoll foot and the corduroy
    cd = (482.0, 597.0); cdir = bear(160)
    P('p-corduroy-logs', *cd, rot=heading(*cdir), dims={'len': 84, 'w': 8, 'seed': 3}, label='Corduroy logs', desc='Eighty feet of pine logs laid side by side across a bog, half sunk and slick, mossy at their uphill ends; the mud sucks at the gaps between them.')
    keep([(cd[0] + cdir[0] * t - cdir[1] * w, cd[1] + cdir[1] * t + cdir[0] * w) for t, w in ((-55, -24), (55, -24), (55, 24), (-55, 24))], 0.2)
    for i, (x, z, r) in enumerate([(455, 585, 7), (508, 610, 6), (462, 628, 5), (503, 572, 4.5), (515, 642, 5)]):
        P('p-reed-hollow', x, z, dims={'r': r, 'n': 12, 'water': 1, 'seed': 40 + i})

    # ================================================================== the terrace: hay meadow, rick, carcass, reeds
    terr = [(edge_x(z) + 12, z) for z in range(0, H_FT + 1, 40)] + [(TRENCH['t0'] - 4, H_FT), (TRENCH['t0'] - 4, 0)]
    road_pts = thin([p for p in ne_ft if p[0] > 860] + [(1168, 111)], 8)
    d = line_dims(terr, (1050, 400)); d.update(line_dims(road_pts, (1050, 400), 'r'))
    exc = [(1050, 350, 16), (1000, 520, 12), (1178, 110, 30), (1150, 100, 8)]
    for i, (x, z, r) in enumerate(exc): d[f'cx{i}'], d[f'cz{i}'], d[f'cr{i}'] = x - 1050, z - 400, r
    d.update(cn=len(exc), count=3400, seed=5, gx0=g0 - 1050, gx1=g1 - 1050, gz0=gz0 - 400, gz1=gz1 - 400)
    P('p-hay-meadow', 1050, 400, dims=d)
    P('p-hay-rick', 1050, 350, rot=20, label='Collapsed hay rick', desc='Last season\'s hay rick, grey and slumped, its thatch cap slid off into the grass and a pitchfork still stuck in its side.')
    P('p-wolf-carcass', 1000, 520, rot=-35, label='Skinned wolf', desc='A grey wolf skinned for its pelt and left, two crossbow bolts still in its ribs, in a stain of trampled mud ringed with big paw prints. It reeks.')
    for i, (x, z, r, fl) in enumerate([(1004.5, 517.5, 150, 0), (996, 523.5, -20, 0), (1007, 526, 60, 1)]):
        P('p-raven-perched', x, z, rot=r, dims={'flap': fl}, y=0.9 if i == 0 else 0, label='Ravens' if i == 0 else None, desc='Ravens working at the carcass; they hop off a few yards when anyone comes near.' if i == 0 else None)
    hollows = [(950, 300, 9), (985, 400, 7), (1120, 300, 10), (1140, 430, 8), (965, 600, 11), (1080, 610, 9), (1150, 700, 12), (935, 720, 8), (1060, 470, 6), (1170, 560, 7), (1015, 205, 6)]
    for i, (x, z, r) in enumerate(hollows):
        P('p-reed-hollow', x, z, dims={'r': r, 'n': int(10 + r * 1.6), 'water': 1, 'seed': 60 + i}, label='Reed hollow' if i == 0 else None,
          desc='Reeds standing in a hollow of black water on the terrace.' if i == 0 else None)
    # drowned alders on the terrace, bleached and grey
    for i, (x, z, sc) in enumerate([(1118, 292, 1.0), (957, 610, 1.15), (1155, 712, 0.9), (1146, 428, 0.85)]):
        P('dead-tree', x, z, rot=i * 70 + 20, dims={'scale': sc})
        s.trees.append((x / 5, z / 5, 2.0))
    # the slogan board at the causeway's west end
    P('p-slogan-board', 1150, 102, rot=facing(0, 1) + 8, label='Painted board', desc='A weathered board on a post at the end of the causeway, painted with Vallaki\'s festival slogan; half the letters have flaked away.')

    # ================================================================== the bridge
    P('p-luna-bridge', *BR, rot=BROT, dims={'xw': -79, 'xc': 120, 'mx': MAIN_X, 'wy': WATER, 'gy': GULLY_Y, 'ravens': 3},
      label='The Luna bridge', desc='A low stone bridge of mossy ashlar on two arches, a wide one over the river and a small one over the dry gully beside it; waist-high parapets, wheel grooves full of mud, a raised gravel causeway at either end.')

    # ================================================================== rooms (ground)
    s.room('P', 'Luna River Crossroads', CP([(185, 372), (318, 372), (335, 420), (330, 500), (215, 512), (168, 470)]), 'grass',
           'Four roads meet at an X on a low wooded shoulder. The gravel of the Old Svalich Road crunches underfoot; the track to the north-west and the trail to the south-east are turf and dirt. In the eastern elbow the stump of a snapped signpost leans out of its stones; its top lies in the weeds a few paces off.',
           'Always roll a random encounter on arriving here, day or night (tables p.29); stage it with the placements on this map. The signpost is a free clue: rejoined, its arms give Krezk and Tsolenka Pass SW, Lake Baratok NW, Vallaki and Ravenloft NE, Berez SE; this is one of the signs Urwin Martikov tells wine-fetchers to follow (p.98). Travel at 3 mph: Vallaki\'s Sunset Gate about a mile NE over the bridge (20 min); Krezk about 5 miles SW (under 2 hr); the NW branch is a dirt trail within half a mile, throws off the path to Van Richten\'s Tower and rejoins the Old Svalich Road after a couple of miles; Berez about 4 miles down the SE trail (2 hr), which ends in marsh. The Argynvostholt branch leaves the road a mile or so SW.')
    s.room('P-weeds', 'The weeds and the drag furrow', CP(wedge), 'grass',
           'Nettle, dock and dead thistle crowd the wedge between the two eastern roads where the post once stood clear. A furrow of flattened stems runs from the stump to the Berez trail.',
           'Survival DC 12 reads the story: oversized wolf prints round the stump and along the furrow, a wheel gouge and a hoop scrape. A dire wolf pack ran a wine cart off the road; the post went with it. The cask lies in the ditch west of the X.')
    s.room('P-pine', 'The wolf-skull pine', CP([(pine[0] - 22, pine[1] - 20), (pine[0] + 22, pine[1] - 20), (pine[0] + 22, pine[1] + 22), (pine[0] - 22, pine[1] + 22)]), 'grass',
           'An old pine in the north elbow wears a column of wolf skulls nailed up its trunk, the topmost still in its hide. The skulls click together when the wind gets under them.',
           'A trappers\' tally, like the wolf heads on pikes outside Vallaki\'s gates (p.95). Werewolves in human form posing as trappers (p.33) fit here: one stands under the tree and hails the party, the others within whistling distance up the track; they want to know who carries silver.')
    s.room('P-ditch', 'The cask in the ditch', CP([(cw[0] - 22, cw[1] - 14), (cw[0] + 24, cw[1] - 14), (cw[0] + 24, cw[1] + 6), (cw[0] - 22, cw[1] + 6)]), 'grass',
           'A smashed wine cask and a cart\'s tailboard lie in the north ditch of the road, staves and a hoop strewn up the bank, a wheel gouge torn in the verge. The cart is gone; the mess is not.',
           'The Wizard of Wines\' overdue delivery for the Blue Water Inn (p.98): the staves carry the winery\'s burned mark (Investigation DC 10 also finds 7 cp in a pouch under the tailboard). A party sent for the shipment learns it was lost on this road; that can lead on to the winery. Needle blights lurch out of the pines south of the road here.')
    lane = [p for p in ribbon(catmull(CP(NW), 6)[3:], 1.3)]
    s.room('P-track', 'The Baratok cart-track', [(x, z) for x, z in lane], 'grass',
           'A grassed cart-track climbs north-west in a sunken lane between root-bound banks, turf between its ruts and needles in them. A hundred feet on, the gravel is gone and the trees close in as it bends west.',
           'To Lake Baratok and Van Richten\'s Tower (V). The druid with twig blights comes down this track on all fours; the blights swarm the banks (half cover on the bank tops, which are 3-4 ft high).')
    sec = [(cd[0] + cdir[0] * t - cdir[1] * w, cd[1] + cdir[1] * t + cdir[0] * w) for t, w in ((-50, -16), (50, -16), (50, 16), (-50, 16))]
    s.room('P-trail', 'The Berez trail and the corduroy', CP(sec), 'grass', 'The trail to Berez drops off the shoulder as a ribbon of dirt and crosses the boggy knoll foot on a causeway of half-sunk pine logs. Hoofprints only; boots drum hollow on the logs.',
           'The corduroy is difficult terrain (slick, uneven logs); off the logs the bog is knee-deep mud. Zombies coming up from Berez stumble here. The trail hugs the river south for about 4 miles before it turns to marsh.', difficult=True)
    tr_room = [(edge_x(z) + 14, z) for z in range(140, 701, 40)] + [(TRENCH['t0'] - 2, 700), (TRENCH['t0'] - 2, 140)]
    s.room('P-terrace', 'The hay terrace', CP(tr_room), 'marsh',
           'A wet, open flood terrace between the forest and the river: tussock grass once cut for hay, reeds in the hollows, black water standing in old cart ruts, a few drowned alders. The only open sky for a mile.',
           'Wolves own this ground at night. Scarecrows up from Berez hunting ravens stand among the reeds between the rick and the carcass (passive Perception 11 sees one lurch; otherwise surprise). The rick is dry cover from rain and nothing else.')
    cz_room = [ax(-90, -10), ax(-12, -10), ax(-12, 10), ax(-90, 10)]
    s.room('P-causeway', 'The west causeway', CP(cz_room), 'dirt',
           'The road climbs onto a raised gravel causeway across the wet terrace, black-water ditches either side, a weathered painted board leaning at its west end. Fog lies here at dawn.',
           'Vistani bandits lounge here by day (they offer to guide for 100 gp); dire wolves step out of the fog here by night. The board carries the burgomaster\'s festival slogan (p.98).')
    s.room('P-bridge', 'The Luna bridge', CP([ax(-10, -6.6), ax(90, -6.6), ax(90, 6.6), ax(-10, 6.6)]), 'flagstone',
           'A low arching bridge of mossy grey stone: a broad main arch over the river and a small flood arch over the dry gully beside it. Waist-high parapets, a deck fifteen feet wide, wheel grooves packed with mud. Ravens sit on the parapet.',
           'Sound and old. The flood arch is a dry crawl-through hide for anything Medium or smaller. Strahd zombies wait on the shoal under the main arch and climb the pier when someone steps onto the span. Bats boil out from under both arches at dusk. About 1,050 ft from the X; Vallaki\'s gate is about a mile on.')
    s.room('P-eastbank', 'The east bank', CP([(TRENCH['t1'] + 2, 180), (W_FT - 2, 180), (W_FT - 2, 560), (TRENCH['t1'] + 2, 560)]), 'grass',
           'The far bank rises steeply out of the water into unbroken forest toward Vallaki.',
           'Strahd\'s wolves watch who crosses toward Vallaki: after dark, dire wolf eye-shine among these trees (passive Perception 14). Wolves call from here first at night; the answer comes from the south down the Berez trail.')

    # ================================================================== the woods
    def density(cx, cz):
        x, z = cx * 5, cz * 5
        if x > edge_x(z) - 10 and x < TRENCH['t1'] + 6: return 0.0
        if x >= TRENCH['t1'] + 6: return 0.85
        k = 0.95
        if x > edge_x(z) - 70: k = 0.55
        return k
    def giant(cx, cz):
        x, z = cx * 5, cz * 5
        r = math.hypot(x - CROWN[0], z - CROWN[1])
        if r < 75: return (1.25, 1.55)
        if line_dist((cx, cz), ne_line) < 9 or line_dist((cx, cz), sw_line) < 9: return (1.2, 1.65)
        return None
    # the ring of oldest pines on the knoll, hand-set just off the granite
    for i in range(9):
        a = i * 2 * math.pi / 9 + 0.3; r = 44 + 5 * math.sin(i * 1.7)
        x, z = CROWN[0] + math.cos(a) * r * 1.05, CROWN[1] + math.sin(a) * r * 0.95
        if line_dist(C((x, z)), nw_line) < 4.2: continue
        P('pine', x, z, rot=i * 47, dims={'h': 26, 'r': 6, 'scale': rnd(1.55 + 0.15 * math.sin(i * 2.3))}, y=rnd(max(0, knollH(x, z) - 0.4), 2))
        s.trees.append((x / 5, z / 5, 3.2))
    s.pines(5200, density=density, gap=2.5, margin=0.9, scale=(1.0, 1.5), giant=giant)
    s.undergrowth(bushes=70, boulders=26, dead=10, stumps=14, logs=12, density=lambda cx, cz: 1.0 if cx * 5 < edge_x(cz * 5) - 20 or cx * 5 > TRENCH['t1'] + 8 else 0.0)
    s.scatter('boulder', 10, lambda cx, cz: 1.0 if 0 < knollH(cx * 5, cz * 5) and math.hypot(cx * 5 - CROWN[0], cz * 5 - CROWN[1]) > 34 else 0.0, margin=0.3, gap=1.6, dims=lambda g: {'r': rnd(1.6 + g.random() * 2.0)})
    # the verges: bracken and dead stuff in the 25-ft ride either side of the hard road
    def verge(cx, cz):
        x, z = cx * 5, cz * 5
        if x > edge_x(z) - 15: return 0.0
        dmin = min(line_dist((cx, cz), ne_line), line_dist((cx, cz), sw_line)) * 5
        return 1.0 if 13 < dmin < 34 else 0.0
    s.scatter('bush', 70, verge, margin=0.0, gap=1.4, dims=lambda g: {'scale': rnd(0.6 + g.random() * 0.6)}, circles=False)
    s.scatter('weeds', 60, verge, margin=0.0, gap=1.2, dims={'n': 4, 'r': 1.6}, circles=False)
    s.scatter('stump', 12, verge, margin=0.0, gap=1.5, dims=lambda g: {'r': rnd(0.9 + g.random() * 0.5)}, circles=False)
    # everything standing on the knoll stands on its slope
    for o in lv.objects:
        if o['kind'] in ('p-knoll', 'p-rock-outcrop') or o.get('vis') == 'dm-note': continue
        h = knollH(o['pos'][0], o['pos'][2])
        if h > 0 and o['pos'][1] == 0: o['pos'][1] = rnd(max(0, h - (0.4 if o['kind'] in ('pine', 'dead-tree', 'stump', 'bush') else 0.15)), 2)

    # roadside pines with dead grey lower boughs: the ones nearest the hard road
    for o in lv.objects:
        if o['kind'] != 'pine': continue
        cx, cz = o['pos'][0] / 5, o['pos'][2] / 5
        dmin = min(line_dist((cx, cz), ne_line), line_dist((cx, cz), sw_line), line_dist((cx, cz), nw_line), line_dist((cx, cz), se_line)) * 5
        if dmin < 46: o['kind'] = 'p-gaunt-pine'

    # mist: dawn fog lying in the river trench, and a wisp on the causeway

    # ================================================================== encounters (DM only until revealed)
    def M(kind, x, z, label, player, size='medium', rot=0, y=0, dm=None, dims=None):
        return s.mob(kind, C((x, z)), label, player, size=size, rot=rot, y=y, dm=dm, dims=dims)
    face = lambda x, z, tx, tz: facing(tx - x, tz - z)
    hd = lambda x, z, tx, tz: heading(tx - x, tz - z)          # quadrupeds and birds face local +x
    wdm = 'Wolves (3d6 by day or night): howls first from the east bank and the Berez trail, a few minutes to prepare; then they come up out of the terrace reeds and along the SE trail, fanning across the X.'
    for i, (x, z) in enumerate([(1281, 280), (1283, 410)]):
        M('wolf', x, z, 'Wolf (howling from the east bank; the pack is 3d6)', 'A grey wolf', rot=hd(x, z, 1200, z), dm=wdm)
    for i, (x, z) in enumerate([(985, 430), (1060, 560)]):
        M('wolf', x, z, 'Wolf (in the terrace reeds)', 'A grey wolf', rot=hd(x, z, X[0], X[1]), dm=wdm)
    for i, (x, z) in enumerate([(523, 712)]):
        M('wolf', x, z, 'Wolf (up the Berez trail)', 'A grey wolf', rot=hd(x, z, X[0], X[1]), dm=wdm)
    ddm = 'Dire wolves (1d6): the area is lightly obscured by fog; the first steps out of it on the west causeway, the others dark shapes behind it on the bridge. They cannot be charmed or frightened.'
    M('dire-wolf', *ax(-45, 1), 'Dire wolf (out of the fog)', 'A huge wolf', size='large', rot=heading(-AX[0], -AX[1]), y=0.45, dm=ddm)
    M('dire-wolf', *ax(30, -2), 'Dire wolf (on the bridge)', 'A huge wolf', size='large', rot=heading(-AX[0], -AX[1]) + 8, y=0.75, dm=ddm)
    M('dire-wolf', *ax(52, 2), 'Dire wolf (on the bridge)', 'A huge wolf', size='large', rot=heading(-AX[0], -AX[1]) - 6, y=1.3, dm=ddm)
    rp = (820, 172.3)
    M('p-skeletal-rider', *rp, 'Skeletal rider (human skeleton on a warhorse skeleton)', 'A skeleton on a skeletal horse', size='large', rot=heading(-bear(80)[0], -bear(80)[1]),
      dm='Rides the Old Svalich Road from the bridge through the X and away SW without slowing, lantern held up and unlit. Ignores the party unless attacked; once rider and horse are destroyed the encounter never recurs.')
    M('druid', CROWN[0] + 4, CROWN[1] - 6, 'Druid (on the knoll crown)', 'A wild-haired figure on the rock', rot=face(CROWN[0], CROWN[1], X[0], X[1]), y=18.1, dims={'v': 3},
      dm='Comes bounding down the cart-track on all fours, then stops on the crown to sniff and laugh. Flees toward Yester Hill when all its blights fall or at half hit points. (Staged on the crown level; move it there.)')
    for i, (x, z) in enumerate([(168, 296), (226, 318), (130, 236), (232, 352)]):
        h = 3.4 if i < 3 else 2.4
        M('twig-blight', x, z, 'Twig blight (on the track bank; 2d6 in all)', 'A crouched tangle of twigs', size='small', rot=face(x, z, X[0], X[1]), y=h,
          dm='2d6 twig blights with the druid, swarming the sunken track\'s banks: they look like dead brush until they move.')
    for i, (x, z) in enumerate([(98, 528), (150, 528), (122, 552)]):
        M('needle-blight', x, z, 'Needle blight (in the pines south of the road; 2d4 in all)', 'A gaunt shape among the pines', rot=face(x, z, cw[0], cw[1]),
          dm='2d4 needle blights lurch out of the pines south of the SW arm around the cask wreck. A quiet party without lights can try to hide from them.')
    for i, (x, z) in enumerate([(1038, 408), (1012, 462), (1074, 476)]):
        M('scarecrow', x, z, 'Scarecrow (standing in the reeds)', 'A scarecrow in the reeds', rot=face(x, z, 1000, 520),
          dm='1d6 scarecrows: Baba Lysaga\'s raven-hunters up from Berez. Passive Perception 11 or higher sees one lurch into view; otherwise they surprise the party. The ravens on the carcass are their bait.')
    M('raven', stub[0] + 0.9, stub[1] - 0.6, 'Wereraven in raven form (Keepers of the Feather)', 'A raven on the post', size='tiny', rot=200, y=3.6,
      dm='Its Stealth against passive Perception. Follows the party at a distance for 1d4 hours, then flies to Vallaki to report. A second wereraven meeting is the invitation to the Blue Water Inn (p.33).')
    M('swarm-of-ravens', *ax(48, -6.4), 'Swarm of ravens (gathering on the parapet)', 'Ravens, lots of them', rot=BROT, y=4.6,
      dm='Ravens gather on the parapet as the party nears and lift off together when anyone reaches the span; as a swarm they attack only if provoked.')
    M('swarm-of-ravens', 1003, 532, 'Swarm of ravens (on the carcass)', 'Ravens on the carcass', rot=40,
      dm='Ravens feeding by day; bait for the scarecrows.')
    vdm = 'Vistani bandits (1d4+1, daytime): pipes lit, wineskins out, laughing. They offer themselves as guides for 100 gp. One carries 2d4 gems worth 50 gp each.'
    for i, (t, side, r) in enumerate([(-62, -11, 160), (-55, -12.5, 220), (-48, -10.5, 120)]):
        p = ax(t, side)
        M('p-vistani-bandit', *p, 'Vistani bandit (by the painted board)', 'A Vistana by the road', rot=BROT + r, y=0, dims={'v': i}, dm=vdm)
    zdm = 'Zombies (3d6, night): shambling up the SE trail from the Berez direction, stumbling on the corduroy. The stench arrives first.'
    for i, (x, z) in enumerate([(484, 610), (494, 640), (513, 698), (531, 756)]):
        M('p-zombie', x + (i % 2) * 3 - 1.5, z, 'Zombie (up the Berez trail; 3d6 in all)', 'A shambling corpse', rot=facing(-bear(160)[0], -bear(160)[1]) + (i % 3 - 1) * 12, y=0.25 if 580 < z < 645 else 0, dims={'v': i % 3}, dm=zdm)
    sdm = 'Strahd zombies (1d8, night): waiting on the gravel shoal under the main arch, they climb the pier footing when the party steps onto the span. A quiet party without lights can try to hide.'
    M('revenant', 42, 543, 'Revenant (knight of the Silver Dragon)', 'A corpse in rusted mail, walking with purpose', rot=facing(*bear(62)),
      dm='Walks in along the SW arm from the Argynvostholt side, following the wolf tracks to the carcass. Hunts Strahd\'s wolves and minions; fights the party only if attacked; urges declared enemies of Strahd toward Argynvostholt (Q).')
    wwdm = 'Werewolves in human form posing as trappers (1d6, daytime): they befriend the party to learn whether it carries silvered weapons, and attack in hybrid form if it does not.'
    M('werewolf-human', 270, 362, 'Werewolf in human form (big trapper, grey cloak, spear, pelts)', 'A big trapper in a grey cloak', rot=face(270, 362, X[0], X[1]), dm=wwdm)
    M('werewolf-human', 122, 244, 'Werewolf in human form (up the track)', 'A trapper up the track', rot=face(122, 244, X[0], X[1]), dm=wwdm)
    M('werewolf-human', 64, 206, 'Werewolf in human form (up the track)', 'A trapper up the track', rot=face(64, 206, X[0], X[1]), dm=wwdm)
    bdm = 'Swarms of bats (1d8, night): they boil out from under the main arch and the flood arch at dusk and attack without provocation.'

    # hidden things on the ground level
    s.hidden('p-eye-shine', C((1290, 400)), 'Dire wolf eye-shine in the east-bank trees (passive Perception 14, after dark)', 'Eyes in the dark', dims={'n': 5, 'span': 200},
             dm='Strahd\'s wolves watch who crosses toward Vallaki. They do not cross unless the party camps on the terrace.')
    s.hidden('p-hunting-trap', C((180, 300)), 'Hunting trap under the needles (only if the trap result is rolled; DC 15 Survival, front rank)', 'A steel trap', rot=30,
             dm='Where travellers cut the corner from the track toward the knoll. PHB trap rules: a creature stepping in it is restrained and takes piercing damage; DC 13 Strength to pry it open.')

    # notes
    s.note(C((1288, 70)), 'North-east over the bridge: Vallaki\'s Sunset Gate about a mile on (20 minutes), wolf heads on pikes outside it.')
    s.note(C((14, 548)), 'South-west: the Old Svalich Road to Krezk (S), about 5 miles, level; the Argynvostholt branch (Q) leaves it a mile or so on.')
    s.note(C((14, 160)), 'North-west: the cart-track toward Lake Baratok and Van Richten\'s Tower (V); a dirt trail within half a mile.')
    s.note(C((560, 786)), 'South-east: the trail to the ruins of Berez (U), about 4 miles along the river, ending in marsh.')
    s.note(C((1186, 14)), 'North, up the river gap: the grey gleam of Lake Zarovich. The river is swimmable but cold and dark: Athletics DC 10, 6-10 ft deep, slow.')
    s.note(C((CROWN[0], CROWN[1] + 40)), 'From the crown: the bridge, the river gap, a gleam of Lake Zarovich to the north, and Argynvostholt\'s spur SSW across the valley (its beacon shows from here once lit, p.130). The best camp: dry, high, a defensible rock.')
    s.spawn(C((1072, 128)))

    # ================================================================== the knoll crown (+18)
    crown = Level('crown', 'Knoll crown', 18, 40, ambient=AMB, interior='rubble', exterior='rubble', north='-z')
    tcx, tcz = sum(p[0] for p in top) / len(top), sum(p[1] for p in top) / len(top)
    top_room = [(tcx + (x - tcx) * 0.74, tcz + (z - tcz) * 0.74) for x, z in top]
    crown.room('P-crown', 'The knoll crown', CP(top_room), 'flagstone', page=40)
    s.desc['P-crown'] = ('A dry, still knob of granite above the trees\' lower boughs, lichen crunching underfoot and old needles ankle-deep in its hollows. Over the canopy to the north-east the pale double arch of the bridge shows above the river gap.',
                         'Lookout and the best camp on the map: half cover at its lip, and the ledges on its south-east face are the only easy way up (a scramble). The druid stops here to sniff and laugh. Wolves will not rush the rock; they wait.')

    # ================================================================== the Luna channel (-10)
    rv = Level('river', 'Luna channel', WATER, 10, ambient=AMB, interior='cave-rock', exterior='cave-rock', north='-z')
    chan = [(TRENCH['wx0'] - 1, 0), (TRENCH['wx1'] + 1, 0), (TRENCH['wx1'] + 1, H_FT), (TRENCH['wx0'] - 1, H_FT)]
    rv.terrain.append((CP([(g0 - 6, 0), (TRENCH['wx1'] + 3, 0), (TRENCH['wx1'] + 3, H_FT), (g0 - 6, H_FT)]), 'marsh'))   # under everything: the trench, the gully
    rv.room('P-river', 'The Luna River', CP(chan), 'shallow-water', page=35)
    s.desc['P-river'] = ('Cold, dark water forty feet wide sliding south out of the lake basin, slow and steady, six to ten feet deep in the middle. Sedge banks rise ten feet either side; at dawn the fog fills the trench.',
                         'Swimming: Strength (Athletics) DC 10 and wet gear; never more than 10 ft deep, even at Berez (p.161). The banks are a scramble (DC 10 Athletics, or use the bridge). Downstream it reaches Berez in about 4 miles.')
    shoal = [(1205, 80), (1222, 84), (1227, 104), (1224, 128), (1209, 131), (1204, 108)]
    rv.room('P-shoal', 'The shoal under the arch', CP(shoal), 'dirt', page=35)
    s.desc['P-shoal'] = ('A bar of gravel under the main arch\'s west footing, knee-deep water round it, a drowned alder snag caught on its upstream end with a drift of dead leaves behind it. The arch\'s underside is close overhead.',
                         'A dry place to stand under the bridge. Strahd zombies wait here at night and climb the pier when someone steps onto the span. Bats roost in the arch. The flood mark on the pier\'s upstream face and a fisherman\'s abandoned trap are found from here.')
    def RP(id, kind, x, z, rot=0, dims=None, y=0, label=None, desc=None, vis='player'):
        rv.obj(id, kind, C((x, z)), vis, None, label, rotY=rnd(rot, 1), dims=dims, y=y)
        o = rv.objects[-1]
        if desc: o['desc'] = desc
        return o
    RP('shoal', 'p-gravel-shoal', 1215, 106, rot=0, label='Gravel shoal and snag', desc='A gravel bar under the arch with a drowned alder caught on it and a drift of leaves on its upstream side.')
    tip = ax(31, -12)
    o = RP('flood', 'p-flood-mark', *tip, rot=BROT, y=6.0, vis='hidden-object', label='Flood mark on the pier (6 ft above the water)')
    o['key'] = 'P-shoal'; o['playerLabel'] = 'A line scored on the pier'
    o['dm'] = 'A scored line and a chiselled notch on the upstream cutwater, six feet above today\'s water, dead reed jammed in the joints at that height: the river ran that high the night Strahd swelled it to drown Berez (p.161).'
    ft = ax(29.5, -4.0)
    o = RP('trap', 'p-fish-trap', ft[0], ft[1], rot=BROT + 75, y=0.55, vis='hidden-object', label='Rotted fish trap at the pier footing: line and an iron hook')
    o['key'] = 'P-shoal'; o['playerLabel'] = 'A rotted willow basket'
    o['dm'] = 'A Vallaki fisherman\'s abandoned set: a willow trap, a coil of sound line and an iron hook. Only seen from the shoal or the water.'
    for i, (x, z) in enumerate([(1213, 96), (1219, 113)]):
        rv.obj(f'sz{i}', 'p-strahd-zombie', C((x, z)), 'hidden-creature', 'P-shoal', 'Strahd zombie (on the shoal; 1d8 in all)', rotY=rnd(facing(1205 - x, 104 - z), 1), size='medium', y=0.6)
        rv.objects[-1]['playerLabel'] = 'A sutured corpse under the bridge'; rv.objects[-1]['dm'] = sdm
    for i, (x, z, y) in enumerate([(1234, 100, 5.0)]):
        rv.obj(f'bats{i}', 'p-bat-swarm', C((x, z)), 'hidden-creature', 'P-river', 'Swarm of bats (under the main arch; 1d8 in all)', rotY=i * 50, size='medium', y=y)
        rv.objects[-1]['playerLabel'] = 'Bats under the arch'; rv.objects[-1]['dm'] = bdm
    for i, (t, side, y) in enumerate([(0, 9.5, 7.2)]):
        p = ax(t, side)
        rv.obj(f'fbats{i}', 'p-bat-swarm', C(p), 'hidden-creature', 'P-bridge', 'Swarm of bats (out of the flood arch)', rotY=i * 40, size='medium', y=y)
        rv.objects[-1]['playerLabel'] = 'Bats pouring from under the bridge'; rv.objects[-1]['dm'] = bdm
    rv.note('note1', C((1230, 300)), 'P-river', 'Water surface: the floor of this level. The channel bed lies 6-10 ft below it; the banks rise 10 ft to the terrace and the east bank.')

    def lk(id, kind, al, ap, bl, bp_):
        return OrderedDict(id=id, kind=kind, **{'from': OrderedDict(level=al, pos=[rnd(ap[0], 1), rnd(ap[1], 1)]), 'to': OrderedDict(level=bl, pos=[rnd(bp_[0], 1), rnd(bp_[1], 1)])})
    links = [lk('P-scramble', 'stairs', 'ground', (CROWN[0] + 30, CROWN[1] + 16), 'crown', (tcx + 5, tcz + 4)),
             lk('P-bank-west', 'ladder', 'ground', (1198, 150), 'river', (1212, 150)),
             lk('P-pier', 'ladder', 'ground', ax(26, -7.5), 'river', ax(30, -10))]
    s.write('Luna River Crossroads', {'valley': True, 'stacked': 'open', 'entry': 'ground'}, levels=[crown, rv], links=links)


if __name__ == '__main__':
    build()
