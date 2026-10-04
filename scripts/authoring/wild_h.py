#!/usr/bin/env python3
"""H. Tser Falls (chapter 2, p.37): the only map in Barovia played on two floors a thousand feet apart.

The book prints no battle map; this is our own design from the area text, the Vistana's tale at G and the Lands of
Barovia map. Three levels share one plan (600 x 520 ft, x east, z south, north -z):
  deck  (960 ft): the high road, the tarn and the sill of the falls, the mould-furred bridge over the chasm with its
                  four gargoyles, the Wizard's Precipice with its lightning scar and rockfall, crags and bent pines;
                  the chasm is drawn as a real slot whose walls fall away into cloud (see kit/sites/wild-h.ts).
  ledge (380 ft): the Vistana's shelf on the north wall, rope and pins above it, a scree gully on down.
  pool  (0 ft):   the Cauldron: the plunge pool under the falls, the spray cave, the gravel bar and the snag jam, the
                  river running out into the pines and the footpath from the Tser Pool camp (G).
Every description here is our own words. Run: python3 scripts/authoring/wild_h.py"""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wildlib import *  # noqa: F401,F403
from wildlib import Site, Level, AMB, catmull, rnd, heading, facing, turn, inside, line_dist
from collections import OrderedDict

FT = 5.0                       # feet per cell
W_FT, H_FT = 600, 520
DECK_Y, LEDGE_Y = 960, 380


def c(p):
    """Feet -> cells."""
    return (p[0] / FT, p[1] / FT)


def cpoly(poly):
    return [(rnd(x / FT, 3), rnd(z / FT, 3)) for x, z in poly]


# ================================================================== the chasm's plan (feet; mirrors kit chasmOutline)
AXIS = [(190, 253), (262, 259), (330, 266), (400, 292), (470, 330), (540, 372), (600, 418), (690, 476), (800, 540)]
HW = [36, 33.5, 35.5, 39, 45, 52, 59, 64, 70]


def densify(pts, w, step):
    out = []
    n = len(pts)
    for i in range(n - 1):
        a, b = pts[i], pts[i + 1]
        L = math.hypot(b[0] - a[0], b[1] - a[1]) or 1
        k = max(1, round(L / step))
        t = ((b[0] - a[0]) / L, (b[1] - a[1]) / L)
        for s in range(k):
            f = s / k
            out.append([(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f), t, w[i] + (w[i + 1] - w[i]) * f])
    a, b = pts[-2], pts[-1]
    L = math.hypot(b[0] - a[0], b[1] - a[1]) or 1
    out.append([tuple(b), ((b[0] - a[0]) / L, (b[1] - a[1]) / L), w[-1]])
    for i in range(1, len(out) - 1):
        ta, tb = out[i - 1][1], out[i + 1][1]
        tx, tz = ta[0] + tb[0], ta[1] + tb[1]
        L = math.hypot(tx, tz) or 1
        out[i][1] = (tx / L, tz / L)
    return out


def chasm_outline(axis, hw, step=5):
    D = densify(axis, hw, step)
    out = []
    side = lambda q, s: (q[0][0] + q[1][1] * s * q[2], q[0][1] - q[1][0] * s * q[2])
    for q in reversed(D): out.append(side(q, 1))
    q0 = D[0]; nN = (q0[1][1], -q0[1][0]); k0 = max(4, round(math.pi * q0[2] / step))
    for j in range(1, k0):
        th = j / k0 * math.pi
        vx, vz = nN[0] * math.cos(th) - q0[1][0] * math.sin(th), nN[1] * math.cos(th) - q0[1][1] * math.sin(th)
        out.append((q0[0][0] + vx * q0[2], q0[0][1] + vz * q0[2]))
    for q in D: out.append(side(q, -1))
    return out          # (the tail cap lies beyond the map's east edge)


def deck_ground():
    """The walkable deck: the map minus the chasm (a C wrapped round its head)."""
    O = chasm_outline(AXIS, HW)
    i = next(k for k, p in enumerate(O) if p[0] < W_FT)
    j = max(k for k, p in enumerate(O) if p[0] < W_FT)
    def cross(a, b):
        t = (W_FT - a[0]) / (b[0] - a[0])
        return (W_FT, a[1] + (b[1] - a[1]) * t)
    poly = [(0, 0), (W_FT, 0), cross(O[i - 1], O[i])] + O[i:j + 1] + [cross(O[j], O[j + 1]), (W_FT, H_FT), (0, H_FT)]
    return [(rnd(x, 2), rnd(z, 2)) for x, z in poly], O


def in_chasm(p, margin=0.0):
    for i in range(len(AXIS) - 1):
        a, b = AXIS[i], AXIS[i + 1]
        dx, dz = b[0] - a[0], b[1] - a[1]
        t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz)))
        if math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t) < HW[i] + (HW[i + 1] - HW[i]) * t + margin: return True
    return False


def away_from_chasm(p):
    """The plan direction from the nearest point on the chasm's axis to p (the way a bent pine leans)."""
    best = None
    for i in range(len(AXIS) - 1):
        a, b = AXIS[i], AXIS[i + 1]
        dx, dz = b[0] - a[0], b[1] - a[1]
        t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz)))
        q = (a[0] + dx * t, a[1] + dz * t); d = math.hypot(p[0] - q[0], p[1] - q[1])
        if best is None or d < best[0]: best = (d, (p[0] - q[0]) / (d or 1), (p[1] - q[1]) / (d or 1))
    return best[1], best[2]


def line_dims(pts, widths=None, prefix='', origin=(0, 0)):
    d = {prefix + 'n': len(pts)}
    for i, (x, z) in enumerate(pts):
        d[f'{prefix}x{i}'] = rnd(x - origin[0], 2); d[f'{prefix}z{i}'] = rnd(z - origin[1], 2)
        if widths: d[f'{prefix}w{i}'] = rnd(widths[i], 2)
    return d


# ================================================================== the pool level's plan (feet)
CAVE_MOUTH, CAVE_ROT, CAVE_W, CAVE_D = (150, 190), 45.0, 16, 40
CAVE_LOCAL = [(-CAVE_W / 2, 0), (-CAVE_W / 2 - 4, -CAVE_D * 0.4), (-CAVE_W / 2 - 2, -CAVE_D * 0.8), (-3, -CAVE_D), (CAVE_W / 2, -CAVE_D * 0.85), (CAVE_W / 2 + 3, -CAVE_D * 0.45), (CAVE_W / 2, 0)]


def cave_world():
    return [(rnd(CAVE_MOUTH[0] + dx, 2), rnd(CAVE_MOUTH[1] + dz, 2)) for dx, dz in (turn(x, z, CAVE_ROT) for x, z in CAVE_LOCAL)]


# the canyon's wall foot: the north wall east -> west, round the Cauldron, the south wall west -> east
N_WALL = [(1000, 520), (860, 452), (760, 410), (680, 384), (600, 354), (520, 318), (450, 288), (390, 262), (330, 236), (290, 222), (255, 205), (215, 193), (180, 187)]
CAULDRON = [(120, 193), (92, 199), (66, 214), (46, 240), (38, 268), (45, 300), (62, 330), (92, 355), (128, 372), (168, 380), (208, 375), (240, 360), (262, 342)]
S_WALL = [(292, 338), (340, 352), (395, 384), (440, 422), (475, 470), (505, 520), (545, 590), (610, 650), (720, 700), (860, 760), (1000, 820)]
BOX = (-400, 1000, -400, 900)  # the rock section's extent (ft): x0, x1, z0, z1
RIVER = [(262, 272), (300, 276), (340, 282), (400, 305), (470, 340), (540, 380), (600, 416), (700, 470), (850, 560), (1000, 650)]
PATH = [(600, 472), (540, 444), (480, 410), (430, 382), (380, 354), (330, 330), (285, 316), (242, 305)]


def canyon_floor(clip=True, notch=False):
    """The canyon floor as a polygon (clipped to the map's east edge, or out to the section's edge)."""
    cave = cave_world()
    north = list(N_WALL)
    pts = north + ([cave[-1 - k] for k in range(len(cave))] if notch else []) + CAULDRON + S_WALL
    if not clip: return pts
    # clipped to the map (Sutherland-Hodgman against x <= W and z <= H)
    def clip_half(poly, k, lim):
        out = []
        for i, p in enumerate(poly):
            q = poly[(i + 1) % len(poly)]
            pin, qin = p[k] <= lim, q[k] <= lim
            if pin: out.append(p)
            if pin != qin:
                t = (lim - p[k]) / (q[k] - p[k]); r = (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)
                out.append((rnd(r[0], 2), rnd(r[1], 2)))
        return out
    return clip_half(clip_half(pts, 0, W_FT), 1, H_FT)


# ================================================================== build
def build():
    s = Site('H', 'Tser Falls', W_FT // 5, H_FT // 5, 808)
    deck = s.lv
    deck.id, deck.name, deck.elevation = 'deck', 'The bridge (road level)', DECK_Y
    ground, outline = deck_ground()
    deck.terrain = [(cpoly(ground), 'grass')]
    s.walk = [cpoly(ground)]
    s.keep.append((cpoly(outline), 0.6))       # nothing scattered over the void

    # ---------------------------------------------------------- the road: up the mountainside from F, over the bridge, on to I
    BS, BN = (265, 300), (295, 215)                       # the bridge's south and north ends
    bdx, bdz = BN[0] - BS[0], BN[1] - BS[1]; BL = math.hypot(bdx, bdz); bu = (bdx / BL, bdz / BL)
    south_ctrl = [(170, 520), (186, 488), (201, 458), (222, 418), (240, 380), (252, 345), (259, 322), (BS[0] - bu[0] * 4, BS[1] - bu[1] * 4)]
    north_ctrl = [(BN[0] + bu[0] * 3, BN[1] + bu[1] * 3), (BN[0] + bu[0] * 18, BN[1] + bu[1] * 18), (302, 172), (300, 150), (292, 115), (280, 80), (266, 42), (250, 0)]
    s.road([c(p) for p in south_ctrl], 1.3)
    s.road([c(p) for p in north_ctrl], 1.3)
    road_line = catmull(south_ctrl, 6)
    s.prop('h-shelf-road', c((170, 470)), dims=dict(line_dims(road_line[::2] + [road_line[-1]], origin=(170, 470)), ox=0, oz=0, hw=7.5, wall=12, gaps=3),
           label='The shelf road', desc='The road clings to the mountainside: a cut rock wall on the uphill side, a crumbling edge and loose stone on the other, ruts full of water.')

    # ---------------------------------------------------------- the chasm and the falls
    rot_b = heading(*bu)
    s.prop('h-chasm', c((120, 330)), dims=dict(line_dims(AXIS, HW), ox=120, oz=330, y0=DECK_Y, depth=230, bx=280, bz=258, br=26),
           label='The chasm', desc='A sheer slot in the mountain, its wet walls streaming, dropping away into billowing white cloud. No bottom shows; cold air pours up over the lips and the ground trembles underfoot.')
    s.prop('h-falls-sill', c((153.5, 253)), dims={'w': 45, 'curve': 6}, label='The sill of the falls',
           desc='The tarn slides over a glossy undercut lip of rock and simply vanishes into its own cloud a few dozen feet down.')
    s.prop('h-spray-cloud', c((150, 253)), rot=heading(1, 0.08), dims={'r': 18, 'len': 190, 'h': 22, 'n': 20, 'op': 0.2}, label='Spray plume',
           desc='Cold mist boils up out of the head of the chasm and drifts east over the bridge; everything near the sill is soaked.')
    s.prop('h-tarn', c((80, 240)), dims={'rx': 66, 'rz': 45, 'sill': 74, 'sw': 45, 'sz': 13, 'inflow': 82, 'iw': 26, 'seed': 4}, label='The tarn',
           desc='The fast clear river from the west slows into a cold black pond held against the sill; pine needles drift toward the spill.')

    # ---------------------------------------------------------- the bridge and its gargoyles
    # where along the deck the void's middle falls (its lips crossed by the bridge line)
    ts = [k / 200 for k in range(201)]
    void_t = [t for t in ts if in_chasm((BS[0] + bdx * t, BS[1] + bdz * t))]
    xc = (void_t[0] + void_t[-1]) / 2 * BL; span = (void_t[-1] - void_t[0]) * BL
    s.prop('h-bridge', c(BS), rot=rot_b, dims={'len': rnd(BL, 2), 'w': 15, 'span': rnd(span + 2, 1), 'xc': rnd(xc, 2), 'deep': 42, 'rise': 0.6, 'par': 3},
           label='The bridge over Tser Falls', desc='A single arch of green-black stone leaps the chasm, furred with mould and black moss, its deck slick with spray. Fifteen feet wide, parapets waist-high.')
    newels = {}
    for end, lx in (('s', 0.95), ('n', BL - 0.95)):
        for side, lz in (('w', -(15 / 2 - 0.47)), ('e', 15 / 2 - 0.47)):
            ox, oz = turn(lx, lz, rot_b)
            newels[end + side] = (BS[0] + ox, BS[1] + oz)
    for k, p in newels.items():
        out = (-bu[0], -bu[1]) if k[0] == 's' else bu
        s.prop('gargoyle-statue', c(p), rot=heading(*out), dims={'ped': 0}, y=3.8, label='Moss-cloaked gargoyle',
               desc='A crouched stone gargoyle on the corner post, shaggy with black moss, its frown worn to a blur.')
    deck_room = [(rnd(BS[0] + ox, 2), rnd(BS[1] + oz, 2)) for ox, oz in (turn(x, z, rot_b) for x, z in ((1.5, -6.4), (BL - 1.5, -6.4), (BL - 1.5, 6.4), (1.5, 6.4)))]

    # ---------------------------------------------------------- the Wizard's Precipice, its scars and the climb
    s.prop('h-precipice-stance', c((200, 168)), dims={'h': 35, 'w': 26, 'd': 21, 'seed': 7}, label="The Wizard's Precipice",
           desc='A flat-topped spur of dark rock 35 ft above the road, overlooking the sill and the whole drop; a scramble of broken steps climbs its east shoulder.')
    s.prop('h-rockfall-scar', c((193, 188)), rot=facing(-28, 34), dims={'h': 26, 'len': 42, 'w': 30}, label='Rockfall',
           desc='A raw pale scar on the precipice\'s south face and a fan of fresh angular boulders, none of them yet lichened, spilling to the tarn shore.')
    s.hidden('h-lightning-star', c((200, 168)), 'Lightning star: fused rock and a charred stump (spell duel)', 'A star of black scorch', y=35, dims={'r': 7.5},
             desc='A star of black scorch burned into the bare rock, the stone at its heart fused to a dull crazed glass; a pine stump beside it charred a foot high.',
             dm='A year old. Detect magic: faint evocation. DC 12 Arcana reads the scorch and the rockfall scar together as a spell duel, as the Vistana at G tells it (p.37).')
    s.hidden('h-climb-rope', c((215, 199)), 'Iron pin and frayed rope: the climb route', 'A rusted iron pin and a rope', dims={'run': 27, 'len': 160, 'lean': 1},
             desc='A rusted iron pin driven into a crack, a frayed rope knotted to it, running to the edge and down the wall.',
             dm='DC 15 Perception from the road. The only line a climber\'s kit can use: pins down the wall to the ledge 580 ft below (DC 15 Athletics per 100 ft, a failure drops 25 ft for 2d6 before the anchor holds).')

    # ---------------------------------------------------------- crags: the mountain on the west, the cut to the north
    crags = [  # x, z, w, d, h, seed: the massif on the west (tiered, highest at the edge), the cut's two crags, low rock to the north
        (18, 22, 96, 76, 118, 1), (82, 14, 72, 52, 84, 2), (20, 100, 84, 74, 104, 3), (88, 82, 62, 50, 62, 4), (60, 156, 70, 36, 34, 5), (138, 126, 40, 34, 30, 6),
        (128, 52, 46, 40, 46, 19), (22, 188, 46, 30, 52, 20),
        (24, 334, 74, 60, 82, 7), (86, 352, 62, 52, 56, 8), (18, 418, 84, 74, 116, 9), (92, 432, 62, 52, 74, 10), (34, 500, 96, 62, 106, 11), (118, 500, 52, 40, 48, 12),
        (148, 398, 34, 28, 24, 13), (150, 462, 30, 26, 20, 21), (60, 290, 40, 26, 22, 22),
        (232, 58, 44, 36, 48, 14), (334, 66, 50, 40, 56, 15), (205, 20, 44, 32, 40, 16), (368, 18, 54, 30, 30, 17),
        (372, 118, 40, 30, 9, 18),
    ]
    # kept inside the map's edge (what lies past it is never explored, so it would stay under the fog of war)
    crags = [(min(max(x, w * 0.62 + 2), W_FT - w * 0.62 - 2), min(max(z, d * 0.62 + 2), H_FT - d * 0.62 - 2), w, d, h, sd) for x, z, w, d, h, sd in crags]
    for x, z, w, d, h, sd in crags:
        s.prop('crag', c((x, z)), rot=s.rng.uniform(-25, 25), dims={'w': w, 'd': d, 'h': h, 'seed': sd})
        s.keep.append(([c((x - w * 0.42, z - d * 0.42)), c((x + w * 0.42, z - d * 0.42)), c((x + w * 0.42, z + d * 0.42)), c((x - w * 0.42, z + d * 0.42))], 0.3))

    # ---------------------------------------------------------- bare rock of the saddle: slabs, boulders, the anvil, the bent pines
    roads_ft = [catmull(south_ctrl, 6), catmull(north_ctrl, 6)]
    def clear_of(p, r):
        if in_chasm(p, r + 4): return False
        if any(line_dist(p, ln) < r + 10 for ln in roads_ft): return False
        if ((p[0] - 80) / (70 + r)) ** 2 + ((p[1] - 240) / (50 + r)) ** 2 < 1: return False      # the tarn
        if math.hypot(p[0] - 200, p[1] - 168) < r + 34: return False                              # the precipice
        if any(abs(p[0] - x) < w * 0.45 + r * 0.6 and abs(p[1] - z) < d * 0.45 + r * 0.6 for x, z, w, d, h, sd in crags): return False
        return True
    def jagged(r, sx, seed):
        rr = random.Random(seed); n = 14
        k = [0.6 + 0.5 * rr.random() for _ in range(n)]
        out = []
        for i in range(n):
            a = 2 * math.pi * i / n; kk = (k[i - 1] + 2 * k[i] + k[(i + 1) % n]) / 4 * (0.85 + 0.3 * rr.random())
            out.append((math.cos(a) * r * kk * sx, math.sin(a) * r * kk))
        return out
    placed = []
    for t in range(900):
        if len(placed) >= 46: break
        p = (s.rng.uniform(10, 590), s.rng.uniform(10, 510))
        east = p[0] > 300 or (p[0] > 250 and p[1] > 300)
        if s.rng.random() > (0.9 if east else 0.35): continue
        r = s.rng.uniform(9, 26) if east else s.rng.uniform(6, 16)
        if not clear_of(p, r) or any(math.hypot(p[0] - q[0], p[1] - q[1]) < (r + qr) * 0.75 for q, qr in placed): continue
        placed.append((p, r))
        rot = s.rng.uniform(0, 180)
        pts = [(rnd(x, 2), rnd(z, 2)) for x, z in (turn(px, pz, rot) for px, pz in jagged(r, s.rng.uniform(1.1, 1.7), int(p[0] * 7 + p[1])))]
        s.prop('h-slab', c(p), dims=dict(line_dims(pts), h=rnd(0.03 + s.rng.random() * 0.03, 3), tone=s.rng.randrange(3)))
    s.prop('h-anvil-block', c((420, 230)), rot=heading(0.42, -1), dims={'scale': 1.0}, label='The anvil block',
           desc='A wagon-sized slab split cleanly in two, the halves a foot apart, standing near the lip east of the bridge: a perch to watch the bridge from, and cover.')
    for x, z, r in ((500, 62, 4.6), (532, 82, 5.2), (562, 100, 4.4)):
        for k in range(3): s.prop('boulder', c((x + (k - 1) * 3.2, z + 2 + (k % 2) * 2)), dims={'r': 1.2})
        s.prop('boulder', c((x, z)), y=1.2, dims={'r': r}, label='Perched boulder', desc='A cart-sized boulder perched on smaller stones, as if set down there.')
    pines = [(340, 120, 1.05), (365, 95, 1.25), (395, 140, 1.0), (480, 180, 1.3), (530, 250, 1.1), (225, 75, 1.15), (229, 433, 0.9)]
    for x, z, sc in pines:
        ax, az = away_from_chasm((x, z)) if (x, z) != (229, 433) else (1, 0.25)
        s.prop('h-bent-pine', c((x, z)), rot=heading(ax, az), dims={'scale': sc, 'lean': 18}, label='Wind-bent pine')
    # scree and broken rock: east of the road down toward the valley, under the crags on the west
    s.scatter('boulder', 26, lambda x, z: 1.0 if (x * FT > 280 and z * FT > 300) or (x * FT > 330 and z * FT < 300) else (0.5 if x * FT < 160 else 0.0), margin=0.8, gap=2.2, dims=lambda g: {'r': rnd(0.9 + g.random() * 2.2)})
    s.scatter('rubble', 18, lambda x, z: 1.0 if (x * FT > 260 and z * FT > 320) else (0.6 if x * FT < 170 else 0.0), margin=0.6, gap=1.8, dims={'n': 6})
    s.scatter('bush', 12, lambda x, z: 0.7 if x * FT > 300 else 0.3, margin=0.6, gap=2.5, dims=lambda g: {'scale': rnd(0.5 + g.random() * 0.4)})

    # ---------------------------------------------------------- the ravens' newel: litter, the cache, the trinket
    ne, nw = newels['ne'], newels['nw']
    s.prop('h-raven-litter', c((ne[0] + 4, ne[1] - 2)), dims={'r': 6, 'streak': 1}, label='Raven litter',
           desc='The rock under the northern gargoyles is white with droppings and strewn with fish spines, small bones, a button, a buckle and a bent spoon.')
    s.prop('h-raven-litter', c((nw[0] - 3, nw[1] - 3)), dims={'r': 3.5})
    s.hidden('h-bundle', c((301, 205)), "Wereraven's cache: a bundle of plain clothes", 'A leather-wrapped bundle',
             desc='A leather-wrapped bundle of drab Barovian clothes, sized for an adult, stuffed into a dry crack under the abutment.',
             dm='DC 13 Perception, or anyone who looks at what the ravens guard. A Keeper of the Feather leaves it here to land, change and walk the road as a traveller (p.30).')
    s.hidden('h-trinket', c((ne[0] + 6, ne[1] - 1)), 'Trinket in the litter', 'A glint in the droppings',
             desc='Something small and metal half buried in the droppings.', dm='Roll on the trinkets table (appendix A), or a pocket trinket that fell from the bridge and came back up on a raven\'s beak.')

    # ---------------------------------------------------------- who might be here (DM-only until revealed)
    for i, p in enumerate([(172, 512), (161, 499), (183, 500)]):
        s.mob('dire-wolf', c(p), "Dire wolf (Strahd's)", 'A huge wolf', size='large', rot=heading(0.35, -1),
              dm='Day 12 / night 10, 1d6 (p.29). They come up the road behind the party and reach the south end as it is mid-span. Cannot be charmed or frightened.')
    for k in ('nw', 'ne'):
        s.mob('swarm-of-ravens', c(newels[k]), 'Ravens (Keepers\' eyes) or a wereraven', 'Ravens on the gargoyle', y=3.8,
              dm='Day 11 (p.29). Lift off when someone steps on the deck and circle the chasm; left alone they shadow the party toward I. 50%: a wereraven instead.')
    for i, p in enumerate([(306, 212), (311, 202), (316, 222), (297, 207)]):
        s.mob('h-bat-swarm', c(p), 'Swarm of bats', 'Bats', rot=i * 70,
              dm='Night 9, 1d8 swarms (p.29). Roost under the arch and in the abutment\'s wet cracks; any light on the bridge after dark, or a loud noise, brings them boiling up from below the parapets.')
    s.mob('ghost', c((152, 238)), 'Ghost (in the spray at the sill)', 'A pale shape in the spray', y=2,
          dm='Night 2 (p.29-30). If it possesses someone it may walk the host to this chasm instead of J: the host lands in the Cauldron (pool level), 20d6.')
    s.mob('h-skeletal-rider', c((301, 160)), 'Skeletal rider and warhorse', 'A rider on a pale horse', size='large', rot=heading(-0.05, 1),
          dm='Day 8 / night 8 (p.29, p.31). Crosses the bridge north to south at a walk, ignoring the party unless attacked. Its rusted lantern sheds no light: at night it is only hooves on wet stone.')

    # ---------------------------------------------------------- DM notes
    s.note(c((268, 308)), 'The bridge: slick but safe, no check to cross. A shove over the 3-ft parapet drops the target to the Cauldron (pool level): 20d6 and prone in the water. A reaction grab within 5 ft or feather fall can save them.')
    s.note(c((138, 262)), 'Within 60 ft of the sill: difficult ground, lightly obscured; in a gust the far end of the bridge is heavily obscured for a round. Fliers in the spray: DC 10 Str save to hold position.')
    s.note(c((222, 160)), 'From the precipice (and the bridge when the fog thins): Castle Ravenloft on its pillar 2.4 mi east, across the valley.')
    s.note(c((180, 505)), 'South: the road loops down the mountainside to the crossroads at F (about 6 mi, 2 hours).')
    s.note(c((262, 18)), 'North: the cut through the mountains to the fork at I (about 1.5 mi, 30 min).')
    s.note(c((314, 204)), 'Ravens perch on the two northern gargoyles; bats roost under the arch. The Keepers\' cache is in the crack under the north abutment.')
    s.spawn(c((236, 392)))

    s.room('H', 'Tser Falls', cpoly(ground), 'grass',
           'The road clings to the mountainside and ends at an arching bridge of mould-encrusted stone across a sheer chasm; moss-cloaked gargoyles crouch on its corners. Upstream a black tarn slides over a lip and vanishes into cloud, and the fall is felt through the stones more than heard.',
           'The walls cannot be climbed without magic or a climber\'s kit. The bridge is slick but safe; the gargoyles are harmless sculpture. South the road runs down to F, north it cuts through the mountains to I. The pool nearly a thousand feet below feeds the river past the Vistani camp at G. Random encounters come from the wilderness tables (p.29).')
    s.room('H-bridge', 'The bridge', cpoly(deck_room), 'flagstone',
           'Fifteen feet of wet, green-black paving between waist-high parapets furred with moss; a tremor runs through it and cold spray drifts across.',
           'Ninety feet abutment to abutment, about seventy of them over the void. Room for a wagon or a shield wall of three; nobody can be flanked here. The two northern gargoyles carry the ravens.')

    # ================================================================== the Vistana's ledge (380 ft)
    ledge = Level('ledge', "The Vistana's ledge", LEDGE_Y, 10, ambient=AMB, interior='rubble', exterior='rubble', north='-z')
    s.lv = ledge
    shelf = [(172, 191), (195, 184), (225, 183), (255, 188), (263, 204), (259, 224), (230, 228), (200, 226), (178, 222), (169, 207)]
    s.room('H-ledge', "The Vistana's ledge", cpoly(shelf), 'cobble',
           'A wet shelf of rock clinging to the north wall under a drift of spray, a stunted pine in its crack. Rusted iron pins and a frayed rope come down the wall above; a gully of loose stone drops away from its east end.',
           'About 380 ft above the pool and 580 ft below the deck: where a fallen or levitating character might fetch up, and the only rest on a climber\'s-kit descent. The Vistana came this way after the duel looking for valuables. From here, the gully to the pool needs DC 12 Acrobatics or a tumble (2d6) every 100 ft.')
    wall_front = [(470, 300), (400, 268), (330, 238), (290, 228), (259, 226), (230, 229), (200, 227), (175, 224), (150, 226), (110, 228), (60, 236), (20, 250)]
    wall_back = [(470, 300), (400, 268), (330, 238), (290, 228), (266, 214), (257, 189), (225, 181), (195, 182), (170, 189), (165, 210), (150, 222), (110, 226), (60, 234), (20, 248)]
    s.prop('h-cauldron-wall', c((215, 205)), dims=dict(line_dims(wall_front, origin=(215, 205)), cut=0, below=380, h=0.5, over=0), label='The north wall')
    s.prop('h-cauldron-wall', c((215, 205)), dims=dict(line_dims(wall_back, origin=(215, 205)), cut=0, below=0, h=580, over=12))
    s.prop('h-slab', c((215, 205)), dims=dict(line_dims(shelf, origin=(215, 205)), h=0.02, tone=1))
    for i, (x, z) in enumerate(shelf[4:9]):
        s.prop('boulder', c((x, z + 1)), dims={'r': rnd(0.9 + (i % 3) * 0.5)})
    s.prop('h-bent-pine', c((238, 198)), rot=heading(0.3, 1), dims={'scale': 0.42, 'lean': 26}, label='Stunted pine', desc='A stunted pine growing out of a crack in the shelf, bent out over the drop.')
    s.prop('h-climb-rope', c((214, 186)), dims={'run': 0, 'len': 580, 'top': 580, 'lean': 0}, label='Iron pins and a frayed rope',
           desc='A line of rusted iron pins down the wall from far above, a frayed rope tied to them; its end lies coiled on the shelf.')
    s.prop('h-scree-gully', c((258, 220)), rot=heading(1, 0.3), dims={'len': 150, 'drop': 175, 'w': 14}, label='Scree gully',
           desc='A steep chute of loose grey stone between ribs of rock, dropping away east from the shelf into the cloud: the only line down that is not sheer.')
    s.prop('h-falls-column', c((160, 252)), y=-LEDGE_Y, dims={'w': 45, 'h': DECK_Y, 'drift': 8, 'focus': LEDGE_Y, 'nofoot': 1}, label='Tser Falls',
           desc='The falls thunder past a stone\'s throw west of the shelf, a white wall going up and down out of sight.')
    s.prop('h-spray-cloud', c((172, 238)), rot=heading(1, -0.3), dims={'r': 12, 'len': 110, 'h': 14, 'n': 12, 'op': 0.14})
    s.prop('h-cloud-floor', c((260, 300)), y=-150, dims={'w': 900, 'd': 640})
    s.note(c((214, 205)), 'Mordenkainen, if already restored at M, may be met here searching for his staff and spellbook (p.39). Not a fight.')

    # ================================================================== the Cauldron (canyon floor, 0 ft)
    pool = Level('pool', 'The Cauldron (canyon floor)', 0, 10, ambient=AMB, interior='rubble', exterior='rubble', north='-z')
    s.lv = pool
    s.keep, s.roads, s.trees, s.circles = [], [], [], []   # the deck's roads and keep-outs mean nothing down here
    floor_in = canyon_floor(True)
    pool.terrain = [(cpoly(floor_in), 'marsh')]
    pool.terrain.append((cpoly(canyon_floor(False)), 'marsh'))         # the canyon floor on out of the map, down the valley
    cv = cave_world(); ccx, ccz = sum(p[0] for p in cv) / len(cv), sum(p[1] for p in cv) / len(cv)
    pool.terrain.append((cpoly([(ccx + (x - ccx) * 1.12, ccz + (z - ccz) * 1.12) for x, z in cv]), 'marsh'))
    river_line = catmull([c(p) for p in RIVER], 6)
    pool.terrain.append((clamp_poly_ft(ribbon_ft(river_line, 5.0)), 'shallow-water'))
    path_line = catmull([c(p) for p in PATH], 6)
    pool.terrain.append(([(rnd(x, 2), rnd(z, 2)) for x, z in ribbon(path_line, 0.9)], 'dirt'))
    s.room('H-pool', 'The Cauldron', cpoly(floor_in), 'marsh',
           'A canyon floor walled in on three sides by black, streaming rock that climbs out of sight into the cloud. The falls hammer into a heaving pool, the roar is everywhere, and far overhead a hair-thin arch spans the sky.',
           'Speech must be shouted; nothing is heard beyond 30 ft. Within 80 ft of the fall: difficult ground, lightly obscured. Inside the standing wave: DC 15 Athletics each round or be pushed under; an hour in the water, DC 10 Con or a level of exhaustion. The walls cannot be climbed without magic or a kit. G is 1.3 mi down the footpath (40 min).')
    s.room('H-cave', 'The spray cave', cpoly(cave_world()), 'dirt',
           'A dry hollow behind the curtain of the falls: a dead fire ring, mud-caked hides, the smell of old smoke.',
           'Hidden from the path, the bar and the south-west shore; found only by wading the north wall through the spray. Mountain folk (berserkers caked in grey mud, p.30) shelter here.')
    cw_o = (300, 290)
    s.prop('h-cauldron-wall', c(cw_o), dims=dict(line_dims(canyon_floor(False, notch=True), origin=cw_o),
           **line_dims(canyon_floor(False), prefix='u', origin=cw_o), cut=30, h=DECK_Y - 30, over=46,
           mx0=BOX[0] - cw_o[0], mx1=BOX[1] - cw_o[0], mz0=BOX[2] - cw_o[1], mz1=BOX[3] - cw_o[1]),
           label='The Cauldron walls', desc='Sheer, wet, black-streaked rock going up and up into the cloud, leaning in at the top so the sky is a ragged oval.')
    s.prop('h-plunge-pool', c((160, 255)), dims={'rx': 75, 'rz': 60, 'ix': 3, 'iz': -3, 'seed': 6, 'cut': 1}, label='The plunge pool',
           desc='Grey-green water, white and heaving where the falls hit it, ringed by a standing wave; cold enough to take the breath.')
    s.prop('h-falls-column', c((162, 252)), dims={'w': 45, 'h': DECK_Y - 4, 'drift': 8, 'focus': 0}, label='Tser Falls',
           desc='A white sheet coming down out of the cloud nearly a thousand feet, ropes of foam in it, a curtain of spray at its foot.')
    s.prop('h-spray-cloud', c((165, 250)), rot=heading(1, 0.2), dims={'r': 30, 'len': 110, 'h': 30, 'n': 18, 'op': 0.15})
    s.prop('h-gravel-bar', c((262, 268)), rot=-12, dims={'rx': 20, 'rz': 30, 'sx': -30, 'sz': 33, 'sr': 17}, label='Gravel bar and mud bank',
           desc='A bar of rounded grey shingle across the pool\'s outlet, backed by a bank of fine grey silt that takes a footprint perfectly.')
    s.note(c((228, 306)), 'Bare footprints and a drag mark in the silt, from the bank across the bar toward the north wall. DC 12 Survival: two or three people, barefoot, within the day, and they went into the water on purpose.')
    jam_rot = heading(1, 0.12)
    s.prop('h-snag-jam', c((284, 277)), rot=jam_rot, dims={'w': 52}, label='The snag jam',
           desc='Whole dead pines carried over the falls and wedged across the outlet in a bleached tangle, polished bone-smooth by the river.')
    s.hidden('h-jam-scraps', c((286, 274)), rot=jam_rot, label='In the jam: strap, buckle, rotted boot, thigh bone (staff or spellbook: DM option)', player='Things caught in the jam',
             desc='Caught among the trunks: a leather satchel strap and buckle, a rotted boot, a human thigh bone.',
             dm='DC 15 Perception or an hour\'s search. The book says only that the Mad Mage lost his staff and spellbook in the fall (p.39): put them here if you want them found; otherwise the empty strap says the river had them first.')
    s.prop('h-scavenger-stake', c((255, 285)), rot=heading(28, -9), dims={'trail': 24}, label="Scavengers' stake and hook",
           desc='A pine stake driven into the bar with a coil of wet rope and a four-pronged iron hook on it, the rope\'s end lying across the jam.')
    s.note(c((250, 292)), 'The stake carries a Vistani knot (DC 10 Investigation, or any Vistana): the Tser Pool camp set it and comes back for the jam after every storm.')
    s.hidden('h-spray-cave', c(CAVE_MOUTH), 'The spray cave (berserkers\' shelter)', 'A cave behind the falls', rot=CAVE_ROT, dims={'w': CAVE_W, 'h': 12, 'depth': CAVE_D},
             desc='An undercut behind the north edge of the falling water: dry at the back, a dead fire ring, mud-caked hides, a chipped stone axe head.',
             dm='Invisible from the path, the bar and the south-west shore; found by wading the north wall waist-deep through the spray.')
    s.prop('h-scree-gully', c((268, 212)), rot=heading(-22, -2), y=40, dims={'len': 24, 'drop': 40, 'w': 18, 'fan': 24}, label='Foot of the scree gully',
           desc='A chute of loose grey stone coming down the north wall from far above, spilling a fan of scree onto the shore.')
    s.prop('h-sky-bridge', c((280, 258)), rot=rot_b, y=DECK_Y, dims={'len': rnd(BL, 1), 'w': 15}, label='The bridge, far overhead',
           desc='Looking straight up: a hair-thin dark arch across the ragged oval of sky, nearly a thousand feet overhead.')
    # the shore: wet boulders under the walls, the pines of the valley closing in from the south-east, fog lying in them
    for i, (x, z) in enumerate([(60, 290), (78, 335), (110, 357), (150, 370), (200, 366), (58, 232), (90, 207), (128, 201), (300, 332), (345, 258), (395, 281)]):
        s.prop('boulder', c((x, z)), dims={'r': rnd(1.8 + (i % 4) * 0.9)})
    for i, (x, z) in enumerate([(84, 320), (118, 340), (196, 345), (232, 336), (70, 260)]):
        s.prop('rubble', c((x, z)), dims={'n': 6})
    s.prop('log', c((365, 330)), rot=heading(1, 0.4), dims={'len': 26, 'r': 1.1})
    s.prop('log', c((500, 402)), rot=heading(1, 0.6), dims={'len': 20, 'r': 0.9})
    floor_poly = floor_in
    def forest(x, z):
        X, Z = x * FT, z * FT
        if X < 410 or not inside((X, Z), floor_poly): return 0.0
        if line_dist((x, z), river_line) < 6.2 or line_dist((x, z), path_line) < 2.4: return 0.0
        return min(1.0, (X - 410) / 70)
    s.pines(2400, density=forest, gap=2.5, margin=0.6, scale=(0.95, 1.4))
    s.prop('h-pine-stand', c((700, 600)), rot=-30, dims={'w': 300, 'd': 170, 'n': 90})
    s.prop('h-pine-stand', c((880, 650)), rot=-30, dims={'w': 220, 'd': 160, 'n': 60})
    # fog lying in the pines and over the river as the canyon opens on the valley
    for x, z, r, L, rot in ((470, 430, 26, 140, -30), (520, 360, 22, 120, -30), (600, 480, 34, 200, -28), (760, 560, 50, 260, -30), (900, 640, 60, 200, -35)):
        s.prop('h-spray-cloud', c((x, z)), rot=rot, dims={'r': r, 'len': L, 'h': 9, 'n': 12, 'op': 0.2})
    s.hidden('h-wolf-trap', c((430, 382)), 'Rusted wolf trap under the needles', 'A rusted trap', rot=30,
             desc='A rusted iron wolf trap half hidden under pine needles on the path.', dm='Hunting trap (p.31): DC 15 Survival for the front rank to spot it.')

    # who might be met below
    s.mob('berserker', c((138, 176)), 'Berserker (mountain folk, grey mud)', 'A mud-caked figure', rot=heading(1, 1),
          dm='Day 14 / night 12, 1d4 (p.29-30). Shelter in the spray cave; seen only by a passive Perception beating their Stealth. They withdraw behind the water and fight only if followed in or cornered.')
    s.mob('berserker', c((266, 262)), 'Berserker on the bar, with a drift log', 'A grey shape on the bar', rot=heading(-1, -0.4),
          dm='Crouched on the bar, the mud on him matching the stones. Withdraws into the cave if seen.')
    s.mob('elk', c((306, 311)), 'The Mad Mage (restored), in elk form', 'An elk', size='large', rot=heading(-1, -0.4),
          dm='Only if the party has already restored Mordenkainen at M: he picks through the jam for his staff and spellbook (p.39), refuses help and leaves when he has looked.')
    s.note(c((300, 250)), 'Overhead: the bridge, a thin dark line nearly a thousand feet up. By day the skeletal rider is a speck crossing it; at night its dead lantern shows nothing. A spark up there is a living traveller\'s torch.')
    s.note(c((592, 462)), 'The footpath from the Tser Pool camp (G): about 1.3 mi of muddy riverbank, 40 min. Deck to pool by road and path: H, F, G, here: about 9 mi, 3 hours.')

    s.lv = deck
    lk = lambda id, kind, al, ap, bl, bp: OrderedDict(id=id, kind=kind, **{'from': OrderedDict(level=al, pos=[rnd(ap[0], 2), rnd(ap[1], 2)]), 'to': OrderedDict(level=bl, pos=[rnd(bp[0], 2), rnd(bp[1], 2)])})
    links = [lk('H-rope', 'ladder', 'deck', (215, 203), 'ledge', (214, 192)),
             lk('H-gully', 'slide', 'ledge', (257, 216), 'pool', (246, 212)),
             lk('H-fall', 'shaft', 'deck', (279, 262), 'pool', (282, 262))]
    s.write('Tser Falls', {'valley': True, 'clearingFt': 380, 'entry': 'deck'}, levels=[ledge, pool], links=links)


def ribbon_ft(line_cells, hw_cells):
    return ribbon(line_cells, hw_cells)


def clamp_poly_ft(poly):
    return [(rnd(x, 2), rnd(z, 2)) for x, z in poly]


if __name__ == '__main__':
    build()
