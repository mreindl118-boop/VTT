#!/usr/bin/env python3
"""M. Mount Baratok (p.39): the granite shelf on Baratok's south-east flank where the climb from Lake Zarovich
comes up out of the valley fog. The book prints no map; this is the easternmost M marker of the regional map (p.35),
above the lake's north-east corner, laid out from the site brief: the arrival terrace, the Elk's Spur, the stepped
snowmelt cascade and its plunge pool, the headwall and the upper ledge with the Mad Mage's invisible door, the scree
fan, and the fog sea below.

Four levels, all drawn at once (stacked 'open'): the fog band (-40 ft) is the land the map stands in; the shelf (0)
is a raised bench on it; the spur top (25) and the upper ledge (120) sit on rock built as props. Plan feet throughout
(x east, z south, north = -z); Site takes 5-ft cells, so every position goes through c()."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wildlib import *  # noqa: F401,F403

W, H = 600, 520                      # feet
AMBIENT = 'barovian-overcast'


def c(p):
    """Feet to cells."""
    return (p[0] / 5, p[1] / 5)


def cells(poly):
    return [(rnd(x / 5, 3), rnd(z / 5, 3)) for x, z in poly]


def circle(cx, cz, r, n=20, seed=None):
    rr = __import__('random').Random(seed) if seed is not None else None
    return [(rnd(cx + math.cos(2 * math.pi * i / n) * r * (1 if rr is None else 0.92 + 0.12 * rr.random())), rnd(cz + math.sin(2 * math.pi * i / n) * r * (1 if rr is None else 0.92 + 0.12 * rr.random()))) for i in range(n)]


def dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def unit(dx, dz):
    L = math.hypot(dx, dz) or 1
    return (dx / L, dz / L)


# ------------------------------------------------------------------ the headwall's frame
# The cliff foot runs from (0,150) to (380,30): u along it (east-north-east), n out of its face (south-south-east).
F0 = (0.0, 150.0)
U = unit(380, -120)
N = (-U[1], U[0])
WALL_ROT = heading(*U)


def F(a, off=0.0):
    """A point `a` ft along the cliff foot from (0,150), `off` ft out from the face (negative: back on the ledge)."""
    return (F0[0] + U[0] * a + N[0] * off, F0[1] + U[1] * a + N[1] * off)


def along(p):
    return (p[0] - F0[0]) * U[0] + (p[1] - F0[1]) * U[1]


def off(p):
    return (p[0] - F0[0]) * N[0] + (p[1] - F0[1]) * N[1]


LEDGE_W = 40                          # the ledge from the cliff edge back to the upper wall
CLEFT = (121, 151)                    # the cascade's cleft through the headwall (ft along the foot)
GAP = (95, 152)                       # the stream's notch through the upper wall
WALL_END = 400                        # the headwall breaks down east of here

# ------------------------------------------------------------------ the step down into the fog
# The bench edge: where the shelf drops 40 ft into the fog band (west to east), and the talus foot 26 ft beyond it.
EDGE = [(0, 440), (100, 432), (200, 420), (260, 412), (300, 408), (350, 402), (400, 395), (450, 386), (500, 376), (550, 369), (600, 362)]
SPREAD = 26


def edge_z(x):
    for (x0, z0), (x1, z1) in zip(EDGE, EDGE[1:]):
        if x0 <= x <= x1: return z0 + (z1 - z0) * (x - x0) / (x1 - x0)
    return EDGE[0][1] if x < 0 else EDGE[-1][1]


# ------------------------------------------------------------------ set pieces (feet)
ARRIVAL = (400, 330)
SPUR_BASE, SPUR_TIP = (410, 230), (445, 290)
US = unit(SPUR_TIP[0] - SPUR_BASE[0], SPUR_TIP[1] - SPUR_BASE[1])
SPUR_ROT = heading(*US)
SPUR_L, SPUR_HW, SPUR_H = 70, 19, 25


def spur_pt(lx, lz):
    dx, dz = turn(lx, lz, SPUR_ROT)
    return (SPUR_BASE[0] + dx, SPUR_BASE[1] + dz)


POOL, POOL_R = (220, 285), 17.5
EYE, EYE_R = (243.5, 291), 5
D1 = F(136, -24)                      # the first drop's lip, in the cleft behind the face
D2 = (150, 150)                       # the second drop's lip, at the end of the stepped rock
D3 = (210, 266)                       # the last drop's lip, at the end of the chute's rib
LEDGE_STREAM = [(68, 0), (74, 26), (95, 54), (112, 74)]
U2 = unit(D3[0] - D2[0], D3[1] - D2[1])
BRIDGE_T = 0.41
BRIDGE = (D2[0] + (D3[0] - D2[0]) * BRIDGE_T, D2[1] + (D3[1] - D2[1]) * BRIDGE_T)
OUTFLOW = [(214, 302), (209, 330), (205, 362), (202, 396), (200, 421)]
WINDOW_A, WINDOW_B = (480, 330), (600, 440)
UW = unit(WINDOW_B[0] - WINDOW_A[0], WINDOW_B[1] - WINDOW_A[1])
TERRACE = [(272, 262), (300, 246), (345, 243), (380, 251), (400, 272), (408, 300), (407, 332), (391, 350), (350, 358), (305, 357), (278, 349), (266, 318), (264, 288)]
SCREE_APEX, SCREE_FOOT = (300, 58), (335, 240)
SCREE_ROT = facing(SCREE_FOOT[0] - SCREE_APEX[0], SCREE_FOOT[1] - SCREE_APEX[1])
SCREE_L, SCREE_W = dist(SCREE_APEX, SCREE_FOOT), 170
PAIR = (330, 160)
BOLT_PINE = (360, 240)
MIDDEN = (430, 180)
SIGIL = (176, 119)
WARDS = [(410, 150), (392, 112), (378, 74)]
STAIR_A = 380                         # the crack-stair's foot, ft along the cliff
STAIR_RUN = 34
DOOR = F(271.5, -LEDGE_W + 1.5)
TRAIL_FOG = [(300, 520), (297, 492), (301, 465), (312, 449), (330, 440), (345, 434)]
TRAIL_SHELF = [(362, 400), (376, 377), (391, 353), ARRIVAL]
TRAP = (306, 455)


# ------------------------------------------------------------------ the ground under the cliff (m-apron)
# West of the scree the slope rises from the terrace to the cliff's foot (the brief's 30 ft) and heaps into a debris
# ridge along the cascade's chute, the chute running in a gully cut into its crest; the ridge ends in a rock step
# under the last fall. Heights in the headwall's frame (a along the foot, o out from it); mirrors apronHeight() in
# app/src/kit/sites/wild-m.ts, which draws it.
CHUTE_W2, CHUTE_W3, BANK = 45.0, 30.0, 12.0
APRON = {'foot': 30, 'toe': 105, 'toeK': 0.3, 'wa': -90, 'ea0': 150, 'ea1': 230, 'bank': BANK, 'crest': 17, 'flank': 0.75, 'steep': 5, 'gw0': 5, 'gw1': 9.5,
         'w2': CHUTE_W2, 'w3': CHUTE_W3, 'a0': -100, 'a1': 268, 'o1': 212, 'step': 3, 'n': 120}


def apron_dims():
    d = dict(APRON)
    for k, p in (('c0', D2), ('c1', D3)): d[k + 'a'] = rnd(along(p), 2); d[k + 'o'] = rnd(off(p), 2)
    d['pa'], d['po'], d['pr'] = rnd(along(POOL), 2), rnd(off(POOL), 2), POOL_R
    d['bsl'] = rnd(BRIDGE_T * math.hypot(d['c1a'] - d['c0a'], d['c1o'] - d['c0o']), 2)
    return d


def smooth01(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def apron_h(p, d=None):
    """The apron's height at plan point p (feet above the shelf), 0 off it."""
    d = d or apron_dims()
    a, o = along(p), off(p)
    if o < -3: return 0.0
    foot = d['foot'] * (1 + 0.15 * math.sin(a * 0.06 + 0.3))
    toe = d['toe'] + d['toeK'] * max(0.0, a) + 16 * math.sin(a * 0.047 + 0.8) + 9 * math.sin(a * 0.121 + 2.1)
    S = foot * max(0.0, 1 - max(0.0, o) / toe) * max(0.0, min(1.0, (d['ea1'] - a) / (d['ea1'] - d['ea0']))) * max(0.0, min(1.0, (a - d['wa']) / 50))
    ax, ao = d['c1a'] - d['c0a'], d['c1o'] - d['c0o']; L = math.hypot(ax, ao); ux, uo = ax / L, ao / L
    sl = (a - d['c0a']) * ux + (o - d['c0o']) * uo; cr = -(a - d['c0a']) * uo + (o - d['c0o']) * ux; lat = abs(cr); sd = 1 if cr > 0 else -1
    tc = max(0.0, min(1.0, sl / L)); water = d['w2'] - (d['w2'] - d['w3']) * tc; bank = water + d['bank']; beyond = max(0.0, sl - L)
    crest = max(d['crest'] + 6 * math.sin(sl * 0.085 + sd * 1.3) + 3 * math.sin(sl * 0.21 + sd), 21 * math.exp(-((sl - d['bsl']) / 12) ** 2))
    flank = d['flank'] * (1 + 0.25 * math.sin(sl * 0.05 + sd * 2.1))
    h = max(S, bank - flank * max(0.0, lat - crest) - d['steep'] * beyond)
    if sl > -1 and lat < d['gw1']: h = min(h, water - 1 + (bank - water + 1) * smooth01(d['gw0'], d['gw1'], lat) - d['steep'] * beyond)
    if math.hypot(a - d['pa'], o - d['po']) < d['pr'] + 1.5: h = min(h, -1)
    return max(0.0, h)


def window_lane(length=64, seed=5):
    """The Ravenloft window's outline: a ragged cut through the pines from the spur's foot down the slope, narrow at
    its head and opening out as it goes (charred ground; the stumps stand in it)."""
    rr = __import__('random').Random(seed)
    nx, nz = -UW[1], UW[0]
    left, right = [], []
    for k in range(9):
        t = length * k / 8
        hw = 12 + 8 * k / 8
        cx, cz = WINDOW_A[0] + UW[0] * t, WINDOW_A[1] + UW[1] * t
        left.append((cx + nx * (hw + rr.uniform(-3, 3)), cz + nz * (hw + rr.uniform(-3, 3))))
        right.append((cx - nx * (hw + rr.uniform(-3, 3)), cz - nz * (hw + rr.uniform(-3, 3))))
    head = (WINDOW_A[0] - UW[0] * 6, WINDOW_A[1] - UW[1] * 6)
    return [head] + left + right[::-1]


def oriented(a, b, hw, ext=0):
    u = unit(b[0] - a[0], b[1] - a[1]); nx, nz = -u[1], u[0]
    a = (a[0] - u[0] * ext, a[1] - u[1] * ext); b = (b[0] + u[0] * ext, b[1] + u[1] * ext)
    return [(a[0] + nx * hw, a[1] + nz * hw), (b[0] + nx * hw, b[1] + nz * hw), (b[0] - nx * hw, b[1] - nz * hw), (a[0] - nx * hw, a[1] - nz * hw)]


def build():
    s = Site('M', 'Mount Baratok', W // 5, H // 5, 909)
    fog = s.lv
    fog.id, fog.name, fog.elevation, fog.ceiling = 'fog', 'In the fog', -40, 10
    fog.terrain = [(rect(0, 0, W // 5, H // 5), 'grass')]
    shelf = Level('shelf', 'The fog-line shelf', 0, 10, ambient=AMBIENT, interior='rubble', exterior='rubble', north='-z')
    spurL = Level('spur', "The Elk's Spur top", SPUR_H, 8, ambient=AMBIENT, interior='rubble', exterior='rubble', north='-z')
    ledge = Level('ledge', 'The upper ledge', 120, 10, ambient=AMBIENT, interior='rubble', exterior='rubble', north='-z')

    def on(level):
        s.lv = level

    def P(kind, pos, rot=0, dims=None, y=0, label=None, desc=None, dm=None):
        o = s.prop(kind, c(pos), rot=rot, dims=dims, y=y, label=label, desc=desc)
        if dm: o['dm'] = dm
        return o

    def keep(poly, m=0):
        s.keep.append((cells(poly), m / 5))

    # ============================================================== the shelf (0 ft)
    on(shelf)
    # its ground: the bench top inside the map (gridded), then the bench running on past the map's edges
    top_in = [F0, F(WALL_END), (WALL_END, 10), (WALL_END, 0), (W, 0)] + EDGE[::-1]
    top_in = [(min(W, max(0, x)), min(H, max(0, z))) for x, z in top_in]
    shelf.terrain.append((cells(top_in), 'grass'))
    ext_w = [(-180, -300), (0, -300), (0, 440), (-180, 452)]
    ext_e = [(W, -300), (780, -300), (780, 350), (W, 362)]
    ext_n = [(0, -300), (W, -300), (W, 0), (WALL_END, 0), (WALL_END, 10), F(WALL_END), F0]
    for p in (ext_w, ext_e, ext_n): shelf.terrain.append((cells(p), 'grass'))
    shelf.terrain.append((cells(ribbon(catmull(TRAIL_SHELF, 6), 2.6)), 'dirt'))
    shelf.terrain.append((cells(ribbon(catmull(OUTFLOW, 6), lambda f: 4.5 - 1.5 * f)), 'shallow-water'))

    # the bench itself: rock under the shelf, its talus flank dropping into the fog (stands on the fog level)
    bench_top = [(-180, -300), (780, -300), (780, 350)] + EDGE[::-1] + [(-180, 452)]
    BO = (300, 200)
    dims = {'n': len(bench_top), 'h': 40, 's': SPREAD, 'seed': 5}
    for i, (x, z) in enumerate(bench_top): dims[f'x{i}'] = rnd(x - BO[0], 1); dims[f'z{i}'] = rnd(z - BO[1], 1)

    # ---- the headwall: two cliff bands either side of the cascade's cleft, the cleft's back wall, and the upper wall
    #      above the ledge with its overhang (split where the stream comes down from the snows)
    def wall(a0, a1, offset, y, **kw):
        L = a1 - a0; m = (a0 + a1) / 2
        d = dict(len=rnd(L, 1), a0=rnd(m, 1), **kw)
        return P('m-headwall', F(m, offset - 0.5), rot=WALL_ROT, dims=d, y=y), m
    LOWJOG = dict(jog=9, jogO=5, jogLo=-3, jogHi=14)        # buttresses stand out of the lower face, never cut under the ledge
    UPJOG = dict(jog=4, jogO=-2, jogLo=-6, jogHi=3)         # the upper face recedes here and there, never onto the ledge
    CLIMB = dict(climb=0.75, west=90)                       # and the mountain climbs on back toward the summit (north-west)
    # (east of the ledge the band breaks down to nothing by LOW_END; the mountain above ends where the ledge does)
    LOW_END, UP_END = 470, WALL_END - 8
    _, mw = wall(-160, CLEFT[0], 0, 0, h=120, d=300, seed=3, tw=60, hf=1, **LOWJOG)
    _, me = wall(CLEFT[1], LOW_END, 0, 0, h=120, d=300, seed=7, te=LOW_END - WALL_END + 10, tf=0.06, hf=1, **LOWJOG, notch=rnd(along(SCREE_APEX) - (CLEFT[1] + LOW_END) / 2, 1), notchW=34, notchD=34,
                 stair=rnd(STAIR_A - (CLEFT[1] + LOW_END) / 2, 1), stairRun=STAIR_RUN)
    hw_main = shelf.objects[-1]
    hw_main['label'] = 'The headwall'
    hw_main['desc'] = 'A cliff of layered grey rock closes the slope to the north, ninety feet of it above the scree, a shelf of ledge along its top under a jutting brow.'
    hw_main['dm'] = 'Climbing: Athletics DC 12 by the icy cascade cleft or the crack-stair at the east end; DC 15 anywhere else, with no holds for the last 20 ft.'
    wall(CLEFT[0], CLEFT[1], -25, 0, h=120, d=225, seed=11, talus=0)
    _, mu = wall(-160, GAP[0], -LEDGE_W, 120, h=70, d=260, seed=13, ovh=7, snow=1, talus=0, tw=50, te=30, tf=0.45, tv=8, **UPJOG, **CLIMB)
    wall(GAP[1], UP_END, -LEDGE_W, 120, h=70, d=260, seed=17, ovh=7, snow=1, talus=0, tw=30, tfw=0.45, te=50, tf=0.05, tv=8, clear=rnd(along(DOOR) - (GAP[1] + UP_END) / 2, 1), clearW=8, **UPJOG, **CLIMB)
    # the ravine the stream comes down from the snows, climbing on back behind the ledge's gap
    wall(GAP[0] - 2, GAP[1] + 2, -LEDGE_W - 88, 120, h=12, d=172, seed=19, snow=1, talus=0, notch=rnd(along(LEDGE_STREAM[0]) - (GAP[0] + GAP[1]) / 2, 1), notchW=18, notchD=12, climb=0.55, west=90)

    # ---- the cascade: ledge stream, three drops, the stepped cleft and the chute's rib, the plunge pool
    water_y = CHUTE_W2 - (CHUTE_W2 - CHUTE_W3) * BRIDGE_T
    bridge_y = rnd(water_y + BANK + 1.3, 2)
    cd = {'lh': 120, 'h1': 30, 'h2': 45, 'cf': 15, 'pr': POOL_R, 'wb': 30, 'bank': BANK, 'bt': BRIDGE_T, 'by': bridge_y, 'outA': rnd(math.atan2(OUTFLOW[0][1] - POOL[1], OUTFLOW[0][0] - POOL[0]), 3)}
    for k, p in [('s0', LEDGE_STREAM[0]), ('s1', LEDGE_STREAM[1]), ('s2', LEDGE_STREAM[2]), ('s3', LEDGE_STREAM[3]), ('d1', D1), ('d2', D2), ('d3', D3)]:
        cd[k + 'x'] = rnd(p[0] - POOL[0], 2); cd[k + 'z'] = rnd(p[1] - POOL[1], 2)
    P('m-cascade', POOL, dims=cd, label='The ice-cold cascade',
      desc='Snowmelt crashes down a cleft in the cliff in three white steps, the last into a black pool. Icicles hang in the cleft even now; the roar drowns out speech.',
      dm='Loud: within 30 ft of the falls or the pool, speech must be shouted. A creature that ends its turn in the pool or the torrent takes 1d4 cold damage and must pass a DC 10 Con save or be pushed 10 ft downstream. The cleft is the wet, icy way up the headwall (Athletics DC 12).')
    P('m-still-eye', EYE, dims={'r': EYE_R}, label='Walled side-pool',
      desc='Off the pool\'s east side a little basin has been walled with a neat ring of fitted stones; its water lies dead still, a dull mirror.',
      dm='The Mad Mage\'s scrying bowl. While he lives and is within a mile, a character who looks in and passes Arcana DC 15 feels the residue of a scrying spell cast here within the last day.')
    # the ground the lower cascade runs on: talus rising to the cliff's foot, the chute's ridge and its gully
    P('m-apron', F0, rot=WALL_ROT, dims=apron_dims(), label='Talus under the cliff',
      desc='Below the cliff the slope climbs in loose talus and moss, heaped into a ridge where the torrent runs down its gully.')
    # the fallen-pine bridge over the chute
    P('m-log-bridge', BRIDGE, rot=heading(-U2[1], U2[0]), dims={'len': 38, 'r': 1.5}, y=bridge_y, label='Fallen-pine bridge',
      desc='A big dead pine lies across the chute, silver and barkless, glazed with frozen spray.',
      dm='The only dry crossing between the terrace side and the west bank. Acrobatics DC 10 to cross at full speed; a fall drops about 15 ft into the torrent (cold water rules above).')

    # ---- the spur
    P('m-spur', SPUR_BASE, rot=SPUR_ROT, dims={'len': SPUR_L, 'hw': SPUR_HW, 'h': SPUR_H, 'sy': 0.4}, label="The Elk's Spur",
      desc='A prow of granite juts from the slope, flat-topped and twenty-five feet up, sheer on its downhill faces; boulders heap up its back like steps.',
      dm='Top: 25 ft. The lake-side faces are a sheer 25-ft drop; the back is a DC 10 scramble. Glassy black lightning scars and fish bones on top. Optional storm hazard: 1-in-20 each round of a strike on whoever stands on top (8d6 lightning, Dex DC 15 half).')
    keep(oriented(spur_pt(-28, 0), SPUR_TIP, SPUR_HW + 8, 6))

    # ---- the terrace and its dressing
    keep(TERRACE, 4)
    # the bench's bare granite: broad tilted plates with grass in the joints (the room's floor shows between them)
    TO = (335, 300)
    sl = {'n': len(TERRACE), 'step': 12, 'seed': 4}
    for i, (x, z) in enumerate(TERRACE): sl[f'x{i}'] = rnd(x - TO[0], 1); sl[f'z{i}'] = rnd(z - TO[1], 1)
    P('m-slabs', TO, dims=sl)
    P('m-bolt-shot-pine', BOLT_PINE, rot=heading(-0.6, 0.8), dims={'scale': 1.3}, label='Bolt-shot pine',
      desc='A big pine snapped at chest height: the trunk is blown out sideways, the splinters black, and the top lies browned on the rock. It still smells of smoke.',
      dm='Not struck from the sky: a lightning bolt fired flat across the terrace from the spur did this, only days ago. It shows the line the Mage likes to shoot along.')
    keep(circle(*BOLT_PINE, 9) , 2); keep(oriented(BOLT_PINE, (BOLT_PINE[0] - 0.6 * 36, BOLT_PINE[1] + 0.8 * 36), 7))
    fulg = [((305, 350), 4.2, 2), ((350, 352), 3.6, 5), ((470, 320), 4.8, 9)]
    for p, r, sd in fulg:
        P('m-fulgurite-boulder', p, rot=0 if p[0] < 400 else -30, dims={'r': r, 'seed': sd}, label='Glassed boulder',
          desc='A boulder whose face has been fused into a branching scar of black glass. Bare skin on it prickles.',
          dm='The Mage\'s practice targets, and his vantage for shooting fish in the lake on the rare days the fog lifts. The static prickle is harmless.')
        keep(circle(*p, r + 3))
    P('m-watcher-effigy', (290, 345), rot=facing(0.3, 1), label='Scarecrow on the lip',
      desc='A figure of lashed poles stands at the edge staring down at the fog, a ragged cloak lining on its shoulders and a cap of fish skulls on its head. Scratches cross its chest.',
      dm='A decoy for the eyes the Mage believes watch him from below; from the fog side it is a man\'s silhouette and draws a careful party\'s first arrow. The chest scratches are the same broken wards as the sigil rock (Arcana DC 13).')
    keep(circle(290, 345, 6))
    for p, sc in [((285, 274), 0.55), ((372, 262), 0.6), ((326, 302), 0.5), ((394, 318), 0.5)]:
        P('pine', p, rot=int(sum(p)) % 360, dims={'h': 26, 'r': 6, 'scale': sc})
    for i, p in enumerate([(300, 280), (342, 270), (318, 330), (366, 312), (284, 320), (380, 290)]):
        P('weeds', p, dims={'n': 3, 'r': 1.2})
    for i, p in enumerate([(331, 262), (355, 295), (296, 305)]):
        P('boulder', p, rot=i * 70, dims={'r': 1.6 + i * 0.3})

    # ---- the pool's surroundings, the outflow, the cleft foot
    keep(circle(*POOL, POOL_R + 7)); keep(circle(*EYE, EYE_R + 3))
    keep(oriented(F(136, -40), D2, 19)); keep(oriented(D2, D3, 22, 4))
    keep(ribbon(catmull([POOL] + OUTFLOW, 6), 7))
    P('m-sigil-rock', SIGIL, rot=25, label='Scratched slab',
      desc='A flat slab at the foot of the cliff is scratched all over with pale signs, circles and crossing strokes, the newest cut over the oldest.',
      dm='Wards against scrying and watching eyes, drawn over and over. Arcana DC 13: real abjuration notation, copied wrong so it does nothing; the madman is hiding from enemies only he can see.')
    keep(circle(*SIGIL, 8))

    # ---- the scree fan and its blocks, the elk bed in the dry slot
    def scree_local(p):
        lx, lz = turn(p[0] - SCREE_APEX[0], p[1] - SCREE_APEX[1], -SCREE_ROT)
        return rnd(lx, 1), rnd(lz, 1)
    pa = scree_local(PAIR); b1 = scree_local((284, 116)); b2 = scree_local((374, 196))
    P('m-scree', SCREE_APEX, rot=SCREE_ROT, dims={'len': rnd(SCREE_L, 1), 'w': SCREE_W, 'n': 300, 'bax': pa[0], 'baz': pa[1], 'bar': 20,
                                                  'bbx': b1[0], 'bbz': b1[1], 'bbs': 15, 'cbx': b2[0], 'cbz': b2[1], 'cbs': 17},
      label='Scree fan', desc='Loose grey stone spills from a notch in the cliff across the slope, fist-sized at the top, head-sized below; great blocks sit in it, two of them leaning together.',
      dm='Difficult terrain everywhere off the terrace and the ledge. Running across the scree: Dex DC 10 or fall prone. The largest block (25 ft) leans on a smaller one over a dry slot a man could sleep in.')
    keep(circle(*PAIR, 18)); keep(circle(284, 116, 10)); keep(circle(374, 196, 11))
    s.hidden('m-elk-bed', c((324, 170)), 'Elk bed (one sleeper: elk and man)', 'Flattened hollow', rot=SCREE_ROT + 20,
             desc='A hollow pressed into the dwarf pines under the leaning block, the size of a large animal; brown hair is caught in the twigs.',
             dm='Survival DC 12: one sleeper, not two; under the elk hair are black woollen threads from a robe. The party can know the elk is a man before he changes.')

    # ---- the fish midden and the ward-stone line to the crack-stair
    P('m-fish-midden', MIDDEN, rot=-20, label='Cold fire ring',
      desc='Blackened stones ring old ashes, and beside them a heap of charred fish bones and trout skulls, some spines fused into glass. A bent tin cup; a strip of black cloth caught on a rock.',
      dm='The Mage eats here: he kills his dinner with lightning. Nothing of value.')
    keep(circle(*MIDDEN, 10))
    for i, p in enumerate(WARDS + [F(STAIR_A + 6, 12)]):
        P('m-ward-stone', p, rot=i * 47, label='Scratched stone', desc='A flat stone with a single crooked sign scratched in it.',
          dm='One of a line of ward-stones every 30 ft from the midden to the crack-stair and up it (Survival DC 12 to follow): the Mage\'s way home. With detect magic or true seeing it leads to the door.')
        keep(circle(*p, 3))

    # ---- the Ravenloft window: a lane of blasted stumps on the slope below the spur
    keep(oriented(WINDOW_A, (WINDOW_A[0] + UW[0] * 70, WINDOW_A[1] + UW[1] * 70), 20, 4))
    for i, t in enumerate([8, 26, 44, 58]):
        p = (WINDOW_A[0] + UW[0] * t + (4 if i % 2 else -5) * -UW[1], WINDOW_A[1] + UW[1] * t + (4 if i % 2 else -5) * UW[0])
        P('m-blasted-stump', p, rot=heading(*UW) + (i * 13 % 20 - 10), dims={'r': 1.2 + (i % 2) * 0.3, 'len': 20 + i * 2}, label='Blasted stump',
          desc='A pine stump charred to the root, its trunk flung downhill.',
          dm='One of six cut by lightning to keep a sightline open from the spur tip at bearing 145: when the clouds tear, Castle Ravenloft\'s spires show over the fog six miles off. The Mage stares through it.')

    # ---- the slope: krummholz below the scree, scattered pines above the edge, the forest on the east
    s.clear(*c(ARRIVAL), 3.5)
    for k in range(9):   # the party sees the elk from where it comes up
        t = k / 8; s.clear(*c((ARRIVAL[0] + (SPUR_TIP[0] - ARRIVAL[0]) * t, ARRIVAL[1] + (SPUR_TIP[1] - ARRIVAL[1]) * t)), 2.6)
    keep([F0, F(WALL_END, 0), (WALL_END, 0), (0, 0)], 0)
    keep([(x, z) for x, z in [F(-10, 14), F(480, 14), F(480, -60), F(-10, -60)]])
    scree_poly = [SCREE_APEX, (SCREE_FOOT[0] - 80, SCREE_FOOT[1]), (SCREE_FOOT[0] + 80, SCREE_FOOT[1] - 6)]
    keep(scree_poly, 0)
    keep(ribbon(catmull(TRAIL_SHELF, 6), 5))
    keep([(p[0], p[1]) for p in [(395, 0), (W, 0), (W, 40), (395, 40)]])   # the broken ground east of the headwall stays open rock

    def krum_d(x, z):
        x, z = x * 5, z * 5
        if z < 135 or z > 270: return 0.0
        return 0.9 if x < 470 else 0.4
    s.scatter('m-krummholz', 60, krum_d, margin=0.4, gap=2.2, dims=lambda g: {'r': rnd(3 + g.random() * 3.5), 'seed': int(g.random() * 90)})
    for p in [(312, 186), (338, 182), (318, 156)]:
        P('m-krummholz', p, rot=int(p[0]) % 360, dims={'r': 4.2, 'seed': int(p[1]) % 50})

    def pine_d(x, z):
        x, z = x * 5, z * 5
        e = edge_z(x)
        if z > e - 4: return 0.0
        if x > 500 and z > 110: return 0.85
        if z > e - 40: return 0.55
        if z > 250: return 0.14 if x < 470 else 0.5
        return 0.0
    s.pines(2600, density=pine_d, gap=2.5, margin=0.9, scale=(0.85, 1.35))
    s.scatter('boulder', 34, lambda x, z: 0.0 if z * 5 > edge_z(x * 5) - 6 else (1.0 if z * 5 < 300 else 0.5), margin=0.6, gap=2, dims=lambda g: {'r': rnd(1.4 + g.random() * 3)})
    s.scatter('rubble', 26, lambda x, z: 1.0 if 100 < z * 5 < 280 else 0.0, margin=0.4, gap=1.6, dims={'n': 6})
    s.scatter('dead-tree', 4, lambda x, z: 1.0 if 230 < z * 5 < 330 else 0.0, margin=0.8, gap=3, dims=lambda g: {'scale': rnd(0.75 + g.random() * 0.35)})
    s.scatter('bush', 12, lambda x, z: 1.0 if 300 < z * 5 < edge_z(x * 5) - 8 else 0.0, margin=0.4, gap=1.4, dims=lambda g: {'scale': rnd(0.6 + g.random() * 0.5)})

    # ---- what stands on the apron stands on its surface
    AD = apron_dims()
    for o in shelf.objects:
        if o['kind'] in ('pine', 'boulder', 'rubble', 'dead-tree', 'bush', 'weeds', 'm-krummholz', 'm-sigil-rock', 'm-ward-stone') and not o['pos'][1]:
            h = apron_h((o['pos'][0], o['pos'][2]), AD)
            if h > 0.3: o['pos'][1] = rnd(h - (0.6 if o['kind'] in ('pine', 'dead-tree') else 0.2), 2)

    # ---- rooms on the shelf
    s.room('M', 'Mount Baratok: the arrival terrace', cells(TERRACE), 'grass',
           'You climb out of the fog onto a bench of bare grey granite, its slabs tilted toward the valley, grass and moss in the cracks. Below, the fog lies flat and white as far as you can see. Black thunderheads drag across the cliffs above. Sixty feet off, an elk stands on a jutting spur of rock.',
           'The read-aloud fires as the lead character tops the lip at the arrival point (east end). The terrace is the only easy footing; everything else on the shelf is difficult terrain. Wolves avoid this slope entirely. The elk on the spur is the Mad Mage polymorphed; seen, he drops the shape and attacks (spell list and spent slots p.39). His staff and spellbook are not here (lost at Tser Falls, area H): searching finds only the midden, the robe scrap, the tin cup and the effigy. '
           'Getting here: by rowboat from the landing at area L, about 3 mi of water to the lake\'s north-east corner (1.5-2 hours), then some 2 hours of hard scrambling up 0.85 mi and 3,200 ft, coming out of the valley fog about two-thirds of the way up; on foot round the lake\'s east end from the Old Svalich Road it is about 3 mi and 3 hours. '
           'Do not confuse this with Lake Baratok: that is another lake far to the west, by Van Richten\'s tower and the werewolf den (area Z).')
    s.room('M-pool', 'Plunge pool', cells(circle(*POOL, POOL_R, 22)), 'shallow-water',
           'A round black pool under the last fall, glass-clear and bitterly cold, ringed with iced, spray-wet boulders.',
           'Ending a turn in the water: 1d4 cold damage and Con DC 10 or be pushed 10 ft downstream toward the outflow.', difficult=True)
    s.room('M-eye', 'The still eye', cells(circle(*EYE, EYE_R, 14)), 'shallow-water',
           'A walled side-pool, mirror-still.', 'The Mage\'s scrying surface (see the pool\'s note).', difficult=True)
    # the fan's ragged edge: tongues of loose stone run further down than others
    sr = __import__('random').Random(17)
    rim = [(312, 60), (330, 96), (352, 130), (378, 168), (404, 204), (419, 236), (398, 246), (372, 250), (345, 252), (318, 249), (292, 246), (268, 241), (251, 236), (262, 200), (272, 160), (283, 118), (292, 84)]
    scree_room = [SCREE_APEX] + [(x + sr.uniform(-5, 5), z + sr.uniform(-4, 6)) for x, z in rim]
    s.room('M-scree', 'Scree fan and boulder field', cells(scree_room), 'cobble',
           'A fan of loose grey stone spills from a notch in the cliff; it ticks and slides underfoot and clatters away downhill.',
           'Difficult terrain; running across it needs Dex DC 10 or the runner falls prone. The leaning blocks give half cover and a dry slot (the elk bed).', difficult=True)
    s.room('M-window', 'The Ravenloft window', cells(window_lane()), 'dirt',
           'A lane of charred stumps cuts through the pines below the spur, the trunks flung downhill. Through it, the fog runs away to the south-east.',
           'Six pines blasted away so the spur tip has a clear line at bearing 145. When the thunderheads tear, Castle Ravenloft\'s spires stand over the fog about 6 mi off; the Mage points and raves. The window continues down into the fog band.')
    s.spawn(c((392, 346)))
    s.note(c(ARRIVAL), 'Arrival point: the trail tops the lip here. The elk on the spur tip is 60 ft away (bearing 48).')
    s.note(c((470, 120)), 'Ward-stones every 30 ft from the midden to the crack-stair (Survival DC 12 to follow).')
    s.note(c(F(STAIR_A, 18)), 'Crack-stair: chockstone steps up a diagonal crack to the ledge (Athletics DC 12).')
    s.note(c((250, 392)), 'Approach: row from the landing at area L to the lake\'s north-east corner (about 3 mi, 1.5-2 hr), then a 2-hour scramble up out of the fog; or about 3 mi and 3 hr on foot round the east end from the Old Svalich Road. This is Mount Baratok, not Lake Baratok (far to the west, area Z).')
    s.note(c((470, 225)), 'Once cured he is Mordenkainen: he takes the party up to his door for food and an undisturbed rest, and asks Forgotten Realms characters whether they know Elminster. '
           'If the card reading made him their ally (the Broken One), he will not travel with them, but he will fight Strahd beside them once they know where to find Strahd and how to destroy him, and only after they recover the Holy Symbol of Ravenkind, the Tome of Strahd and the Sunsword (p.40); curt, stubborn, not to be questioned. '
           'Otherwise he goes off alone to look for his staff and spellbook where he fell at Tser Falls (area H), refuses all company in case someone covets them, and leaves each character a charm of heroism as a parting gift.')
    s.note(c((128, 175)), 'The cascade cleft: the wet, icy scramble to the ledge (Athletics DC 12). Elsewhere the headwall is DC 15.')
    s.mob('swarm-of-ravens', c(BOLT_PINE), 'Swarm of ravens (or a wereraven)', 'Ravens', size='medium', y=13,
          dm='Optional random encounter: wolves never come here, so use the ravens instead (p.30). A wereraven of the Keepers of the Feather may be watching the wizard and will trade what it knows for the party\'s intentions.')
    shelf_n = len(shelf.objects)

    # ============================================================== the spur top (25 ft)
    on(spurL)
    top = [spur_pt(x, z) for x, z in [(-2, -SPUR_HW), (SPUR_L * 0.62, -SPUR_HW * 0.92), (SPUR_L * 0.9, -SPUR_HW * 0.42), (SPUR_L, 0), (SPUR_L * 0.9, SPUR_HW * 0.42), (SPUR_L * 0.62, SPUR_HW * 0.92), (-2, SPUR_HW)]]
    s.room('M-spur', "The Elk's Spur", cells(top), 'dirt',
           'A flat prow of rock high over the slope, streaked with glassy black scars and littered with fish bones. From its tip the fog runs away below to the edge of sight.',
           'The elk stands at the tip, 60 ft from the arrival point. The Mage fights from here or the air; cone of cold on anyone climbing the back. Lake side: a 25-ft fall. Down the Ravenloft window at bearing 145 the castle shows when the clouds tear.')
    # its top is bare granite: thin plates split by the frost, grit in the joints (the scars and bones lie over them)
    top_in = [spur_pt(x, z) for x, z in [(1, -SPUR_HW + 2), (SPUR_L * 0.62, -SPUR_HW * 0.92 + 1.5), (SPUR_L * 0.9 - 1, -SPUR_HW * 0.42 + 1), (SPUR_L - 2.5, 0), (SPUR_L * 0.9 - 1, SPUR_HW * 0.42 - 1), (SPUR_L * 0.62, SPUR_HW * 0.92 - 1.5), (1, SPUR_HW - 2)]]
    SO = spur_pt(SPUR_L * 0.5, 0)
    sl = {'n': len(top_in), 'step': 8, 'seed': 12, 'th': 0.35, 'tilt': 0.3}
    for i, (x, z) in enumerate(top_in): sl[f'x{i}'] = rnd(x - SO[0], 1); sl[f'z{i}'] = rnd(z - SO[1], 1)
    P('m-slabs', SO, dims=sl)
    elk_at = spur_pt(SPUR_L - 6, 0)
    look = facing(ARRIVAL[0] - elk_at[0], ARRIVAL[1] - elk_at[1])
    # The DM-only figures stand on the shelf level, raised to the spur top: on a stacked site the app hides unrevealed
    # figures from the players only on the level being viewed, and the party is on the shelf when they meet him.
    on(shelf)
    s.mob('elk', c(elk_at), 'Elk (the Mad Mage, polymorphed)', 'An elk', size='large', rot=heading(ARRIVAL[0] - elk_at[0], ARRIVAL[1] - elk_at[1]), y=SPUR_H,
          dm='The Mad Mage under polymorph. The moment the party sees him he drops the shape: swap in the mad-mage figure on this square.')
    s.mob('mad-mage', c(elk_at), 'The Mad Mage of Mount Baratok (archmage; Mordenkainen)', 'A wild-eyed man in tattered black robes', rot=look, y=SPUR_H,
          dm='Archmage (spell list p.39). Already spent: mage armor, mind blank, magnificent mansion, polymorph. Opens with lightning bolt flat along the terrace through the arrival point, then stoneskin and mirror image, counterspell, web on the pine bridge, cone of cold on climbers; time stop when cornered. At 50 hp or fewer he shouts his second line and flees for the ledge and his door. Greater restoration fails while his own mind blank lasts (3d6 hours): Persuasion DC 15 gets him to say why, Arcana DC 18 works it out. Persuasion DC 20 makes him pause before acting (lower if they name Strahd as their enemy or stand well away from the effigy, weapons down).')
    for i, (lx, lz) in enumerate([(SPUR_L - 12, -5), (SPUR_L - 12, 5), (SPUR_L - 17, 0)]):
        s.mob('mad-mage', c(spur_pt(lx, lz)), f'Mirror image {i + 1}', 'A wild-eyed man in tattered black robes', rot=look, y=SPUR_H,
              dm='Mirror image: place when he casts the spell, remove when struck.')
    # far off down the window: the castle over the fog, for when the thunderheads tear. Pinned in the window on the
    # shelf (where the party stands, so the players never see it until it is revealed) and drawn six miles off.
    far = 5200
    b145 = math.radians(145)
    gl = (SPUR_TIP[0] + math.sin(b145) * far, SPUR_TIP[1] - math.cos(b145) * far)
    pin = (WINDOW_A[0] + UW[0] * 40, WINDOW_A[1] + UW[1] * 40)
    s.hidden('m-castle-glimpse', c(pin), "Castle Ravenloft's spires through the cloud", 'Dark spires far off over the fog', dims={'s': 1.15, 'dx': rnd(gl[0] - pin[0], 1), 'dy': -120, 'dz': rnd(gl[1] - pin[1], 1)},
             desc='Far off to the south-east, black spires stand up out of the fog, and then the cloud closes over them.',
             dm='Reveal when the thunderheads tear (bearing 145, about 6 mi off) and hide again a moment later; the Mage points at it and raves about what he lost there.')
    on(spurL)

    # ============================================================== the upper ledge (120 ft)
    on(ledge)
    ledge_poly = [F0, F(CLEFT[0]), F(CLEFT[0], -25), F(CLEFT[1], -25), F(CLEFT[1]), F(WALL_END - 12), F(WALL_END - 12, -LEDGE_W), F(GAP[1], -LEDGE_W),
                  F(GAP[1], -LEDGE_W - 69), F(GAP[0], -LEDGE_W - 87), F(GAP[0], -LEDGE_W), (0, F0[1] - LEDGE_W / N[1])]
    LO = F(200, -20)
    sl = {'n': len(ledge_poly), 'step': 10, 'seed': 9}
    for i, (x, z) in enumerate(ledge_poly): sl[f'x{i}'] = rnd(x - LO[0], 1); sl[f'z{i}'] = rnd(z - LO[1], 1)
    bare = [(x, z, 10) for x, z in LEDGE_STREAM + [D1]] + [(*F(140, -55), 20)]
    sl['cn'] = len(bare)
    for i, (x, z, r) in enumerate(bare): sl[f'cx{i}'] = rnd(x - LO[0], 1); sl[f'cz{i}'] = rnd(z - LO[1], 1); sl[f'cr{i}'] = r
    P('m-slabs', LO, dims=sl)
    s.room('M-ledge', 'The upper ledge', cells(ledge_poly), 'dirt',
           'A shelf of bare rock thirty-odd feet wide runs along the top of the cliff under a brow of overhanging stone that keeps the rain off. In the shaded notch where the stream comes down, old snow lies grey and hard.',
           'The Mage\'s refuge and escape route: up the crack-stair or the cleft. His invisible door is against the back wall; only he opens it (food, and a short or long rest undisturbed and hidden from Strahd). Cured, he leads the party here. See the note on the shelf for what he does next.')
    P('m-snow-patch', F(140, -55), rot=heading(*N), dims={'w': 34, 'd': 16}, label='Old snow',
      desc='A dirty, hard-packed drift of last winter\'s snow in the shade of the notch. Prints cross it: a bare-footed man, and an elk.',
      dm='The prints go both ways, the man\'s and the elk\'s, never together: one creature. The snow keeps the stream ice-cold all summer.')
    on(shelf)   # the door and the hound: DM-only, so on the shelf level raised to the ledge (see the spur's figures)
    s.hidden('shimmer-door', c(DOOR), "Invisible door to the Mad Mage's magnificent mansion", 'Bare rock', rot=WALL_ROT, y=120,
             desc='Bare rock under the overhang.', dm='Visible only to detect magic, true seeing or the like: a tall shimmering doorway. Only the Mage can open it.')
    hound_at = F(285, -LEDGE_W + 9)
    s.mob('m-faithful-hound', c(hound_at), "Mordenkainen's faithful hound (invisible)", 'Nothing you can see', size='large', rot=heading(*N), y=120,
          dm='Only if the Mage posted it before fleeing: it barks at anyone who climbs onto the ledge within 30 ft and bites whoever reaches the door without him.')
    on(ledge)
    P('m-ward-stone', F(STAIR_A - STAIR_RUN - 6, -8), rot=30, label='Scratched stone', desc='A flat stone with a single crooked sign scratched in it.',
      dm='The last ward-stone at the top of the crack-stair.')
    for p in [F(60, -18), F(200, -20), F(330, -24), F(110, -70)]:
        P('boulder', p, rot=int(p[0]) % 360, dims={'r': 2.2})
    # the ledge's own dressing: rock fallen from the brow, wind-flattened pine in the corners, drifts against the back wall
    for i, p in enumerate([F(32, -30), F(176, -14), F(236, -31), F(318, -12), F(356, -28)]):
        P('rubble', p, rot=i * 61, dims={'n': 5})
    for i, p in enumerate([F(14, -26), F(202, -33), F(346, -33)]):
        P('m-krummholz', p, rot=heading(*N) + 90, dims={'r': 3.2 + i * 0.4, 'seed': 11 + i * 7})
    for p, w in [(F(70, -36), 20), (F(300, -36), 16), (F(370, -35), 12)]:
        P('m-snow-patch', p, rot=WALL_ROT, dims={'w': w, 'd': 5, 'prints': 0})
    s.note(c(F(240, -12)), 'Upper ledge: the door is against the back wall here; the faithful hound (if posted) guards it.')
    # the storm overhead, past the map to the north (hung from the ledge level, out over the mountain)
    P('m-thunderhead', (300, -520), dims={'len': 1700, 'd': 620, 'n': 46}, y=170, label='Thunderheads')

    # ============================================================== the fog band (-40 ft)
    on(fog)
    s.keep, s.circles, s.trees = [], [], []
    fog.terrain.append((cells(ribbon(catmull(TRAIL_FOG, 6), 2.6)), 'dirt'))
    fog.terrain.append((cells(ribbon(catmull([(199, 446), (197, 478), (193, 505), (190, 520)], 6), 3.5)), 'shallow-water'))
    P('m-bench', BO, dims=dims)
    P('m-rapids', (200, edge_z(200) - 1), dims={'len': SPREAD + 4, 'drop': 40, 'w': 7}, y=40, label='Outflow rapids',
      desc='The pool\'s outflow tumbles white down the rocky step into the fog.')
    foot = [(x, z + SPREAD + 2) for x, z in EDGE]
    sea = {'R': 26000, 'hx0': -300, 'hx1': 300, 'hz0': rnd(min(z for _, z in foot) - 470, 1), 'hz1': 50, 'n': 0}
    sea['en'] = len(foot)
    # Mount Ghakis's bald crown, about 10 mi off on bearing ~193, drawn nearer (22,000 ft) so it stays on the sea
    b193 = math.radians(193)
    sea.update(gx=rnd(math.sin(b193) * 22000, 0), gz=rnd(-math.cos(b193) * 22000, 0), gr=4200, gh=1100)
    for i, (x, z) in enumerate(foot): sea[f'ex{i}'] = rnd(x - 300, 1); sea[f'ez{i}'] = rnd(z - 470, 1)
    P('m-fog-sea', (300, 470), dims=sea, y=14, label='The fog below',
      desc='Below the shelf the slope simply vanishes into a flat white sea of mist that fills the whole valley; only the tops of the pines show through its edge.')
    # the trail's scramble up the step: stepping stones up the talus
    for k in range(5):
        t = (k + 0.5) / 5
        p = (345 + (362 - 345) * t, 434 + (400 - 434) * t)
        P('boulder', p, rot=k * 40, dims={'r': 1.6}, y=rnd(40 * t - 1.2, 2))
    s.hidden('m-wolf-trap', c(TRAP), 'Rusted wolf trap (never sprung)', 'Pine needles', rot=30,
             desc='Pine needles on the trail.', dm='A Barovian trapper\'s steel jaw-trap, rusted solid and never sprung. Survival DC 15 for the front rank to spot it; otherwise someone steps on it (hunting-trap rules). The trapper\'s blazes stop at the next tree. No wolf tracks, scat or kills anywhere on this slope.')
    P('m-blazed-pine', (293, 448), rot=facing(1, 0.3), dims={'h': 26, 'r': 6, 'scale': 1.35}, label='Blazed pine',
      desc='An old axe-blaze, pale and weathered, is cut into this trunk. There are no more beyond it.')
    for i, t in enumerate([100, 135]):
        p = (WINDOW_A[0] + UW[0] * t, WINDOW_A[1] + UW[1] * t)
        P('m-blasted-stump', p, rot=heading(*UW), dims={'r': 1.3, 'len': 22}, label='Blasted stump', desc='A pine stump charred to the root, its trunk flung downhill.')
        s.keep.append((cells(circle(*p, 8)), 0))
    s.keep.append((cells(oriented((540, 385), WINDOW_B, 21, 10)), 0))
    fog.terrain.append((clamp_poly(cells(oriented((536, 381), WINDOW_B, 18, 10)), W // 5, H // 5), 'dirt'))   # the window runs on down into the fog
    s.keep.append((cells(ribbon(catmull(TRAIL_FOG, 6), 6)), 0))
    s.keep.append((cells(ribbon(catmull([(199, 446), (197, 478), (193, 505), (190, 520)], 6), 7)), 0))
    s.keep.append((cells(circle(*TRAP, 7)), 0)); s.keep.append((cells(circle(293, 448, 6)), 0))
    s.trees.append((293 / 5, 448 / 5, 2.4))
    s.pines(2600, density=lambda x, z: 0.95 if z * 5 > edge_z(x * 5) + SPREAD + 3 else 0.0, gap=2.25, margin=0.8, scale=(1.15, 1.75))
    s.scatter('boulder', 10, lambda x, z: 1.0 if z * 5 > edge_z(x * 5) + SPREAD + 3 else 0.0, margin=0.6, gap=2, dims=lambda g: {'r': rnd(1.4 + g.random() * 2)})
    s.scatter('log', 5, lambda x, z: 1.0 if z * 5 > edge_z(x * 5) + SPREAD + 6 else 0.0, margin=1.0, gap=2.5, dims=lambda g: {'len': rnd(12 + g.random() * 8), 'r': rnd(0.9 + g.random() * 0.4)})
    band = [(x, z + SPREAD) for x, z in EDGE] + [(W, H), (0, H)]
    band = [(min(W, max(0, x)), min(H, max(0, z))) for x, z in band]
    s.walk = [cells(band)]
    s.room('M-fog', 'In the fog', cells(band), 'grass',
           'Grey mist on every side; the pines stand like ghosts and the trail climbs blind. Somewhere above, water roars.',
           'The last of the climb: heavily obscured. The game trail tops out at the arrival point after a scramble up the rocky step. The rusted wolf trap waits where the trail leaves the pines. The outflow leaves the map to the south.', difficult=True)
    s.note(c((420, 470)), 'Valley fog, not the Mists: heavily obscured, no saves. From the shelf the band below is a white sea with pine tops showing.')

    # ============================================================== write
    s.lv = fog
    links = [
        dict(id='M-trail', kind='stairs', **{'from': {'level': 'fog', 'pos': [345, 434]}, 'to': {'level': 'shelf', 'pos': [362, 398]}}),
        dict(id='M-spur-back', kind='stairs', **{'from': {'level': 'shelf', 'pos': [round(v, 1) for v in spur_pt(-24, 0)]}, 'to': {'level': 'spur', 'pos': [round(v, 1) for v in spur_pt(6, 0)]}}),
        dict(id='M-crack-stair', kind='ladder', **{'from': {'level': 'shelf', 'pos': [round(v, 1) for v in F(STAIR_A, 7)]}, 'to': {'level': 'ledge', 'pos': [round(v, 1) for v in F(STAIR_A - STAIR_RUN, -9)]}}),
        dict(id='M-cleft', kind='ladder', **{'from': {'level': 'shelf', 'pos': [258, 252]}, 'to': {'level': 'ledge', 'pos': [round(v, 1) for v in F(110, -14)]}}),
    ]
    s.write('Mount Baratok', {'valley': True, 'stacked': 'open', 'entry': 'shelf'}, levels=[shelf, spurL, ledge], links=links)


if __name__ == '__main__':
    build()
