#!/usr/bin/env python3
"""I. Black Carriage (chapter 2, p.37-38): the mountain fork where the dirt road up from Tser Falls splits, north-west
to the iron gates and east onto the Count's dead cobbled road, and where Strahd's black coach waits when he wants the
party brought to him. The book prints no map; this is the inferred design from the site brief, 600 x 500 ft, north -z.

The fork is a shelf cut into a mountain shoulder: a 55-ft crag rises along the north and north-east (its top is its
own level, the crest), and the ground falls away south and south-west into the pines at about 1 in 4. The map is drawn
on one ground plane, so the fall is shown the way a diorama shows it: drystone revetments along the downhill edges of
the roads with the dark of the drop below them, and the pines below the shelf standing lower the further they are
down the slope, their crowns in the fog. The falls window (about 50 ft below the fork) is a keyed area of the ground
level for that reason (a level 50 ft under the ground plane would be drawn under the land round the map).

Focal composition: the lit coach dead centre on its old turning circle at the head of the Count's road, the cold lamp
standard behind it at the apex of the Y, the toll bar ahead, and the black gap of the Cut Block as the road's
vanishing point. Only keys, names, pages and placements come from the book; every description is our own words.
-> locations/ch02/I/{scene,grid}.json"""
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wildlib import *  # noqa: F401,F403
from wildlib import Site, Level, AMB, rnd, catmull, offset, inside, seg_dist, line_dist, heading, turn, blob, rect  # noqa: F401

FT = 5.0
def c(p):
    """Feet to cells."""
    return (p[0] / FT, p[1] / FT)

def cl(pts):
    return [c(p) for p in pts]

def feet(line):
    return [(x * FT, z * FT) for x, z in line]

def pl(pts, at, extra=None):
    """A polyline in dims, relative to the object's position `at` (both in feet)."""
    d = {'n': len(pts)}
    for i, (x, z) in enumerate(pts):
        d[f'x{i}'] = rnd(x - at[0], 2); d[f'z{i}'] = rnd(z - at[1], 2)
    if extra: d.update(extra)
    return d

def thin(line, step):
    """Every point at least `step` ft from the last kept (and the last point)."""
    out = [line[0]]
    for p in line[1:-1]:
        if math.hypot(p[0] - out[-1][0], p[1] - out[-1][1]) >= step: out.append(p)
    out.append(line[-1])
    return out

def interp_z(line, x):
    """z of a west-to-east polyline at x."""
    for (x0, z0), (x1, z1) in zip(line, line[1:]):
        if x0 <= x <= x1: return z0 + (z1 - z0) * ((x - x0) / ((x1 - x0) or 1))
    return line[0][1] if x < line[0][0] else line[-1][1]

def interp_x(line, z):
    """x of a north-to-south polyline at z."""
    for (x0, z0), (x1, z1) in zip(line, line[1:]):
        if z0 <= z <= z1: return x0 + (x1 - x0) * ((z - z0) / ((z1 - z0) or 1))
    return line[0][0] if z < line[0][1] else line[-1][0]

def oriented(cx, cz, rot, hl, hw):
    """Corners (feet) of a rectangle hl x hw (half-sizes along local x, z) turned by rotY degrees."""
    return [(cx + dx, cz + dz) for dx, dz in (turn(a, b, rot) for a, b in ((-hl, -hw), (hl, -hw), (hl, hw), (-hl, hw)))]


# ------------------------------------------------------------------ the plan (feet; x east, z south)
APRON = [(214, 292), (220, 272), (236, 258), (256, 252), (276, 254), (296, 260), (312, 270), (318, 290), (312, 312), (298, 330), (278, 343),
         (258, 348), (238, 343), (222, 328), (214, 310)]
STAND, STAND_R = (325, 290), 20
NW_CTRL = [(240, 262), (222, 240), (200, 210), (176, 180), (152, 150), (139, 132), (124, 112), (98, 80), (70, 50), (48, 28), (28, 8), (16, -6)]
S_CTRL = [(256, 330), (255, 348), (251, 372), (247, 395), (243, 422), (241, 450), (244, 476), (252, 496), (256, 506)]
E_CTRL = [(322, 291), (345, 287), (370, 279), (391, 271), (430, 258), (470, 245), (515, 236), (560, 232), (606, 229)]
DIRT_HW, COBBLE_HW = 5.5, 9.5
LAMP = (272, 262)
POST = (290, 200)
TOLL, TOLL_ROT = (391, 271), heading(60, -21)
CUT, CUT_ROT = (470, 245), heading(85, -22)
CUT_LEN, CUT_W, CUT_GAP, CUT_H = 40, 64, 12, 16
CARRIAGE = (330, 288)
SPLASH = (247, 392)
WINDOW = (400, 440)
CREST_H = 55
# the crag's lip (top edge of the face) west to east, and how far out its foot lies at each point (feet)
LIP = [(190, 0), (196, 30), (214, 64), (246, 96), (280, 126), (300, 131), (322, 124), (360, 106), (410, 110), (452, 128), (498, 142), (545, 152), (575, 165), (600, 178)]
RUN = [25, 45, 58, 52, 60, 58, 55, 55, 50, 45, 40, 35, 30, 25]
CLEFT = (290, 140)
SEEP = (215, 125)


def build():
    s = Site('I', 'Black Carriage', 120, 100, 919)
    lv = s.lv

    # -------------------------------------------------------------- the crag: its face, the rock under the crest, its foot
    foot = [(x + nx * r, z + nz * r) for (x, z), (nx, nz), r in zip(LIP, [_n for _n in _normals_ft(LIP)], RUN)]
    crest_poly = [(190, 0), (600, 0)] + LIP[::-1][:-1]
    face_poly = LIP + foot[::-1]
    lv.objects.append(OrderedDict(id='day-crag-mass', kind='prism', pos=[400.0, 0, 60.0], vis='player', polygon=[[rnd(x, 2), rnd(z, 2)] for x, z in crest_poly], dims={'h': CREST_H - 1.1, 'color': 0x4f4d49}))
    # the face's lip from the cleft's place: the fraction along the lip polyline where the cleft opens
    tot = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(LIP, LIP[1:]))
    acc, best = 0.0, (1e9, 0.0)
    for a, b in zip(LIP, LIP[1:]):
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        for k in range(21):
            t = k / 20; p = (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t); dd = abs(p[0] - CLEFT[0])
            if dd < best[0] and p[1] < CLEFT[1]: best = (dd, (acc + L * t) / tot)
        acc += L
    s.prop('i-crag-wall', c(LIP[0]), dims=pl(LIP, LIP[0], dict({f'r{i}': r for i, r in enumerate(RUN)}, h=CREST_H, cf=rnd(best[1], 4), seed=2)),
           label='The crag', desc='Grey crag streaked with lichen and seepage climbs fifty-odd feet above the shelf; a narrow black split opens high in it above the old guard-post.')
    s.keep.append((cl(crest_poly), 0)); s.keep.append((cl(face_poly), 0.6))
    # the crag's west end tails off in lower rocks toward the gate road; the two buttresses the road threads
    for i, (x, z, w, h) in enumerate([(176, 18, 34, 40), (168, 52, 30, 30), (186, 92, 26, 22), (150, 8, 24, 26)]):
        s.prop('crag', c((x, z)), rot=s.rng.uniform(0, 360), dims={'w': w, 'd': rnd(w * 0.75), 'h': h, 'seed': 30 + i}); s.keep.append((cl(oriented(x, z, 0, w * 0.45, w * 0.4)), 0.3))
    for i, (x, z, w, h) in enumerate([(116, 112, 26, 30), (168, 152, 28, 34)]):
        s.prop('crag', c((x, z)), rot=40 + i * 70, dims={'w': w, 'd': rnd(w * 0.7), 'h': h, 'seed': 41 + i, 'top': 1}, label='Rock buttress',
               desc='A buttress of bare rock shoulders up beside the gate road, the narrow track squeezing past it.')
        s.keep.append((cl(oriented(x, z, 0, w * 0.48, w * 0.42)), 0.4))

    # -------------------------------------------------------------- the roads and the apron
    s.patch(cl(APRON), 'dirt'); s.keep.append((cl(APRON), 1.0))
    nw = feet(s.road(cl(NW_CTRL), DIRT_HW / FT, floor='dirt'))
    south = feet(s.road(cl(S_CTRL), DIRT_HW / FT, floor='dirt'))
    east = feet(s.road(cl(E_CTRL), COBBLE_HW / FT, floor='cobble', per=8))
    # the Count's crown from the coach stand's rim, narrowing to the quarried gap, and the old setts showing through the
    # mud on the apron's east side
    crown = [p for p in east if p[0] >= STAND[0] + STAND_R - 1.5]
    crown = thin(crown, 7)
    cut_dir = (math.cos(math.radians(CUT_ROT)), -math.sin(math.radians(CUT_ROT)))
    def width_at(p):
        a = (p[0] - CUT[0]) * cut_dir[0] + (p[1] - CUT[1]) * cut_dir[1]
        return rnd(CUT_GAP - 0.4 if abs(a) < CUT_LEN / 2 + 1 else (19 if abs(a) > CUT_LEN / 2 + 9 else CUT_GAP + (abs(a) - CUT_LEN / 2 - 1) * (7 / 8)), 2)
    cd = pl(crown, crown[0], {'w': 19, 'gs': -1, 'mud': 0.55})
    for i, p in enumerate(crown): cd[f'w{i}'] = width_at(p)
    s.prop('i-cobble-crown', c(crown[0]), dims=cd, label="The Count's road",
           desc='The eastern branch is twice as wide as the dirt tracks: a cambered run of worn cobbles breaking through the mud, broken kerbs on both sides and a stone gutter along the uphill one.')
    for i, (x, z, r) in enumerate([(300, 296, 7), (306, 278, 5), (292, 318, 6), (284, 270, 4), (298, 306, 4)]):
        s.prop('paving', c((x, z)), rot=s.rng.uniform(0, 180), dims={'r': r, 'seed': i * 5 + 2})
    # frozen puddles and rime: on the apron, the dirt arms, and along the cobbles in the crag's shadow
    for i, (x, z, r) in enumerate([(246, 290, 9), (262, 318, 7), (236, 312, 6), (250, 368, 5), (244, 440, 6), (248, 480, 5), (206, 214, 5), (150, 146, 5), (96, 78, 5), (410, 262, 6), (520, 232, 7)]):
        s.prop('i-rime', c((x, z)), rot=s.rng.uniform(0, 180), dims={'r': r, 'seed': 11 + i * 7})

    # -------------------------------------------------------------- the coach stand, the coach and its team
    s.prop('i-coach-stand', c(STAND), dims={'r': STAND_R}, label='The coach stand',
           desc='A cobbled turning circle at the head of the eastern road, its outer ring of big setts still crisp; a squat stone post with a rusted iron ring stands on its north rim.')
    s.keep.append((cl(oriented(STAND[0], STAND[1], 0, STAND_R + 4, STAND_R + 4)), 0))
    ruts = thin([(318, 290.5)] + [p for p in east if p[0] > 330], 6)
    s.prop('i-wheel-ruts', c(ruts[0]), dims=pl(ruts, ruts[0], {'gauge': 6.1, 'y': 0.52}), label='Wheel ruts',
           desc='Deep paired ruts and the hoofprints of a two-horse team, frozen into the mud between the cobbles, all running east.')
    o = s.hidden('black-carriage', c(CARRIAGE), "Strahd's black carriage (door open)", 'A black carriage', dims={'open': 1},
                 desc='A large, sleek black coach with glass windows and brass lanterns burning, its side door hanging open. The box is empty; the reins lie looped on it.',
                 dm='Here only if Strahd has invited the party or wants to steer them to the castle (p.38). Room inside for eight; whoever boards is drawn east to the Gates of Ravenloft (J) and the team cannot be turned. Under the near cushion: a black evening glove and a blank sealed card (Investigation DC 10).')
    for k, dz in enumerate((-3.2, 3.2)):
        s.mob('black-horse', c((CARRIAGE[0] + 15.5, CARRIAGE[1] + dz)), "Black draft horse (Strahd's team)", 'A black horse', size='large',
              dm="Draft horse under Strahd's control. It waits, breath steaming, for the party to board, then draws the coach to J; it cannot be discouraged, even by a skilled teamster, and does not fight back. Never blinks, never shifts its weight (Insight or Animal Handling DC 15; detect magic shows an enchantment).")
        o = s.hidden('i-breath-puff', c((CARRIAGE[0] + 15.5 + 6.6, CARRIAGE[1] + dz)), 'Horse breath (steam)', 'Breath steaming', y=8.6, dims={'len': 7})
        o.pop('label', None)
    for k, dz in enumerate((-2.7, 2.7)):
        o = s.hidden('i-lamp-halo', c((CARRIAGE[0] + 3.3, CARRIAGE[1] + dz)), 'Coach lamp glow', 'Lamp glow', y=8.5, dims={'r': 3.2})
        o.pop('label', None)
    s.hidden('i-keepsake', c((CARRIAGE[0] - 1.2, CARRIAGE[1] + 1.4)), 'Glove and sealed card under the cushion', 'A glove and a card', y=4.4, dims={'v': 0},
             dm="Investigation DC 10 inside the coach: a lady's black evening glove and a stiff card with the castle's seal, its writing run to nothing. An earlier guest was fetched this way. Flavour only.")
    s.keep.append((cl(oriented(CARRIAGE[0] + 6, CARRIAGE[1], 0, 16, 6)), 0))

    # -------------------------------------------------------------- the street furniture of a dead road
    s.prop('i-lamp-standard', c(LAMP), label='The dead lamp standard',
           desc='A twelve-foot wrought-iron lamp post at the apex of the fork, its lantern cage empty of glass, rust bleeding down a squared stone base carved with a device worn to a lump. It has not burned in living memory.')
    s.keep.append((cl(oriented(LAMP[0], LAMP[1], 0, 4, 4)), 0.4))
    s.prop('i-guard-shell', c(POST), dims={'w': 20, 'd': 15, 'door': -2, 'hx': -6}, label='Guard-post shell',
           desc='A roofless stone shell backed against the crag, its walls broken down to head height or less: a doorway toward the fork, a slot of a window toward the cobbles, a fallen hearth and chimney stump, rubble and pine needles inside.')
    s.keep.append((cl(oriented(POST[0], POST[1], 0, 12, 9.5)), 0.6))
    gx0, gx1, gz0, gz1 = POST[0] - 9.25, POST[0] + 9.25, POST[1] - 6.75, POST[1] + 6.75
    for a, b in [((gx0, gz0), (gx1, gz0)), ((gx1, gz0), (gx1, gz1)), ((gx0, gz1), (gx0, gz0)), ((gx0, gz1), (POST[0] - 4.5, gz1)), ((POST[0] + 0.5, gz1), (gx1, gz1))]:
        lv.wall(c(a), c(b), flags=['invisible'], material='rubble')
    s.prop('i-toll-bar', c(TOLL), rot=TOLL_ROT, dims={'w': 26}, label='The toll bar',
           desc='A stone pivot socket with a rusted pin on the north kerb and a knee-high notched stop-stone on the south: a barrier once closed the road here. The pole is long gone.')
    for p in (turn(0, -13, TOLL_ROT), turn(0, 13, TOLL_ROT)): s.keep.append((cl(oriented(TOLL[0] + p[0], TOLL[1] + p[1], 0, 3, 3)), 0.3))
    s.prop('i-cut-block', c(CUT), rot=CUT_ROT, dims={'len': CUT_LEN, 'w': CUT_W, 'gap': CUT_GAP, 'h': CUT_H}, label='The Cut Block',
           desc='A house-sized block of grey crag fallen across the road, which the builders cut a passage through rather than move: a twelve-foot gap between sheer, tool-marked walls fifteen feet high. One coach wide.')
    for side in (-1, 1):
        hw = (CUT_W / 2 - CUT_GAP / 2) / 2; cz = side * (CUT_GAP / 2 + hw)
        oc = turn(0, cz, CUT_ROT); corners = oriented(CUT[0] + oc[0], CUT[1] + oc[1], CUT_ROT, CUT_LEN / 2 - 1, hw - 0.5)
        s.keep.append((cl(corners), 0.8))
        for i in range(4):
            a, b = corners[i], corners[(i + 1) % 4]
            # movement only: a 16-ft block must not black out the 55-ft crag behind it in the players' fog of war
            lv.wall(c(a), c(b), flags=['invisible'], material='cave-rock')
    # scree: the scramble up behind the guard-post (DC 10), and the Cut Block's scree up to the crest (DC 12)
    for (fx, fz), (tx, tz), w, h, seed in [((272, 188), (266, 120), 15, CREST_H - 2, 3), ((470, 224), (474, 136), 24, CREST_H - 2, 9)]:
        L = math.hypot(tx - fx, tz - fz)
        s.prop('i-scree', c((fx, fz)), rot=heading(tx - fx, tz - fz), dims={'len': rnd(L, 1), 'h': h, 'w': w, 'seed': seed}, label='Scree',
               desc='A chute of loose broken stone up the crag face: a scramble, not a path.')
        s.keep.append((cl(oriented((fx + tx) / 2, (fz + tz) / 2, heading(tx - fx, tz - fz), L / 2, w / 2)), 0.5))

    # -------------------------------------------------------------- the shelf's downhill edge: revetments, the rill, the splash
    def side_line(line, off, x_from=None, x_to=None, z_from=None, z_to=None):
        pts = offset(line, off)
        if x_from is not None: pts = [p for p in pts if x_from <= p[0] <= x_to]
        if z_from is not None: pts = [p for p in pts if z_from <= p[1] <= z_to]
        return thin(pts, 6)
    # south arm: under its west edge (the left normal of a road heading south points west)
    rs = side_line(south, DIRT_HW + 0.6, z_from=338, z_to=503)
    tot_s = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(rs, rs[1:]))
    cf = next((sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(rs[:i], rs[1:i + 1])) / tot_s for i, p in enumerate(rs) if p[1] >= 365), 0.2)
    s.prop('i-revetment', c(rs[0]), dims=pl(rs, rs[0], {'s': 1, 'h': 7, 'cf': rnd(cf, 3), 'cw': 14}), label='Drystone revetment',
           desc='A battered drystone wall holds the road up on its downhill side, six to eight feet above the trees; in one place it has given way and its stones lie spilled down the slope.')
    # east arm: under its south side, from the coach stand to the Cut Block, and on past it (the left normal of a road
    # heading east points south)
    for x0, x1, bf in [(352, 446, 0.78), (494, 586, -1)]:
        re = side_line(east, COBBLE_HW + 2.6, x_from=x0, x_to=x1)
        gf = rnd((382 - re[0][0]) / (re[-1][0] - re[0][0]), 3) if x0 < 382 < x1 else -1
        s.prop('i-revetment', c(re[0]), dims=pl(re, re[0], {'s': 1, 'h': 7, 'bf': bf, 'gf': gf, 'gw': 6}), label='Drystone revetment',
               desc='The cobbled road rides on a drystone wall along its downhill side; one stretch bulges outward.')
    # the rill: the seep at the crag foot, the stone gutter down past the guard-post to the apron, a dished cross-drain
    # over the apron, the gutter down the south arm's uphill side, the splash, and away south-west into the pines
    g1 = [SEEP, (224, 160), (236, 200), (248, 232), (256, 252)]
    s.prop('i-gutter', c(g1[0]), dims=pl(g1, g1[0], {'lined': 1, 'ice': 0.45}), label='Stone gutter',
           desc='A rill seeps out at the foot of the crag and runs down a stone-lined gutter, ticking over the stones.')
    g2 = [(256, 252), (259, 280), (263, 312), (266, 340), (265.5, 362), (262, 380)]
    s.prop('i-gutter', c(g2[0]), dims=pl(g2, g2[0], {'lined': 1, 'ice': 0.25, 'w': 1.4}), label='Cross-drain and gutter',
           desc='The rill crosses the apron in a shallow dished channel of setts, then runs down the uphill side of the south road.')
    s.prop('i-water-splash', c(SPLASH), rot=heading(-1, 0.32), dims={'len': 24, 'w': 9}, label='The water-splash',
           desc='The rill crosses the south road in a shallow paved splash, its setts green and slick with a fringe of ice, a single flagstone slab laid across it for walkers.')
    s.keep.append((cl(oriented(SPLASH[0], SPLASH[1], heading(-1, 0.32), 14, 7)), 0.3))
    g3 = [(234, 401), (214, 410), (190, 428), (168, 446), (142, 462), (118, 480), (100, 498)]
    s.prop('i-gutter', c(g3[0]), dims=pl(g3, g3[0], {'lined': 0, 'ice': 0.35}), label='The rill', desc='The rill runs off south-west under the pines.')

    # keep the trees off the revetments' faces and the drop below them
    from wildlib import band
    s.keep.append((band([c(p) for p in east if p[0] > 340], (COBBLE_HW + 1) / FT, (COBBLE_HW + 12) / FT), 0))
    s.keep.append((band([c(p) for p in south if p[1] > 336], (DIRT_HW + 0.5) / FT, (DIRT_HW + 10) / FT), 0))

    # -------------------------------------------------------------- the falls window and the scramble down to it
    trail = [(382, 302), (378, 330), (386, 360), (380, 388), (392, 412), (398, 428)]
    for a, b in zip(trail, trail[1:]):
        s.roads.append(([c(a), c(b)], 1.0))
    tl = catmull(cl(trail), 4)
    from wildlib import ribbon, clamp_poly
    s.patch(clamp_poly([(rnd(x), rnd(z)) for x, z in ribbon(tl, 0.42)], s.W, s.H), 'dirt')
    for i, (x, z) in enumerate([(381, 306), (377, 318), (380, 334), (387, 352), (384, 371), (379, 386), (388, 404), (395, 420)]):
        s.prop('boulder', c((x + (3 if i % 2 else -3), z)), dims={'r': rnd(1.2 + (i % 3) * 0.5)})
    s.prop('i-rock-shelf', c(WINDOW), rot=-8, dims={'r': 16}, label='The falls window',
           desc='A flat shelf of grey rock on the lip of the slope, where the trees fall away: on a clear gust the pale arch of the Tser Falls bridge shows far below to the south-west, with the mist of the falls rising past it.')
    s.clear(WINDOW[0] / FT, WINDOW[1] / FT, 32 / FT)

    # -------------------------------------------------------------- keyed areas
    s.room('I', 'Black Carriage', cl([(208, 252), (300, 244), (412, 250), (414, 292), (338, 318), (300, 340), (262, 350), (230, 340), (212, 330)]), 'grass',
           'High in the mountains the forest and the fog still press close. The dirt road from the south splits here: one narrow arm north-west between two rock buttresses, the other east, where the flat widens and old cobbles break through the mud: a road built for something grander. A dead iron lamp post stands at the fork; a cobbled turning circle waits at the head of the eastern road.',
           "When Strahd has invited the party or wants them steered to him, his black carriage stands on the coach stand pointed east, lamps lit and door swung open (reveal the coach, the horses, their breath and the lamp glow). No driver; reins looped on the box; ruts and hoofprints run only east (Survival or Perception DC 12 finds no bootprint). It seats eight and goes only to J. Otherwise the choices: north-west 0.7 mi through the western Gates of Barovia (they open as the party nears and close behind it), south 0.8 mi down to the bridge at Tser Falls (H), east 2.1 mi to the Gates of Ravenloft (J). Fog lies knee-deep on the apron (light obscurement for prone or Small creatures).")
    s.room('I-post', 'Guard-post shell', cl([(281, 194), (299, 194), (299, 206), (281, 206)]), 'dirt',
           'A roofless stone guard-post backed against the crag, walls broken down to four to eight feet, a doorway toward the fork and a window slot toward the cobbles. Rubble, a fallen hearth and drifted pine needles inside.',
           'Three-quarters cover behind its walls; the doorway is a choke point. Investigation DC 12 at the hearth: a cracked iron coin chest bolted to the hearthstone, forced long ago, empty but for one old electrum coin stamped with Strahd\'s profile: the toll was paid to the castle. A scramble up the scree behind it reaches the crest (Athletics DC 10).')
    cut_room = oriented(CUT[0], CUT[1], CUT_ROT, CUT_LEN / 2, CUT_GAP / 2 - 0.2)
    s.room('I-cut', 'The Cut Block', cl(cut_room), 'cobble',
           'The road threads a twelve-foot passage quarried straight through a fallen block of crag, its walls sheer and tool-marked fifteen feet high, lichen on the north face. One coach wide.',
           'A choke point: the walls block sight and movement; the top of the block (about 16 ft) is reached from the scree on its north side, which is difficult terrain and climbs on to the crest (Athletics DC 12). The skeletal rider comes out of this gap at night.')
    s.room('I-window', 'The falls window', cl([(380, 428), (402, 424), (420, 430), (422, 448), (404, 456), (382, 450)]), 'grass',
           'A shelf of grey rock on the south lip, some fifty feet below the fork, where the canopy breaks. When the fog thins the land opens: the forest falling away, the pale bridge at Tser Falls far below to the south-west, the mist of the falls rising beyond it, and the roar of the water coming and going on the wind.',
           'Reached by a short scramble down from the east road. Perception DC 10 on a gust: the arch of the Tser Falls bridge about 350 ft below to the south-west and the mist column past it; the party can see exactly where the south road goes. The castle\'s crag stays hidden behind the ridge to the east.')

    # -------------------------------------------------------------- hidden things on the ground
    s.hidden('i-keepsake', c((232, 371)), 'Hidden bundle: a wereraven\'s spare clothes', 'A leather bundle', dims={'v': 3},
             desc='A bundle wrapped in leather and tied with twine, stuffed in among the fallen stones.',
             dm='Random-encounter entry (p.30): one set of drab Barovian common clothes sized for an adult, belonging to the wereraven watching from the crest. Perception DC 13 to notice the leather among the stones below the collapse.')
    s.hidden('i-keepsake', c((POST[0] - 4.6, POST[1] - 4.8)), 'Electrum coin in the coin chest', 'An old coin', y=1.45, dims={'v': 1},
             dm="Investigation DC 12: one old electrum coin stamped with Strahd's profile, left in the forced coin chest on the hearthstone. The toll on the Count's road was paid to the castle.")
    s.hidden('i-keepsake', c((SPLASH[0] - 11, SPLASH[1] + 3)), 'Trinket half under the ice (roll on the Trinkets table)', 'Something under the ice', dims={'v': 2},
             dm='Random-encounter entry (p.31): a lost trinket (roll on the appendix A table) half under the ice at the splash\'s downhill lip. Wolf scent and gnawed bones in the gutter here give advantage on Survival to predict the pack\'s approach.')

    # -------------------------------------------------------------- creatures (DM only until revealed)
    s.mob('raven', c((290, 193)), 'A single raven (Strahd\'s spy; it follows at a distance)', 'A raven', size='tiny', y=7.4, rot=-140,
          dm="Strahd's spies (p.29/31): one raven keeps a respectful distance, silent. Left alone, more gather on the crest snags and the Cut Block until the crest is black with them (2 swarms of ravens). A spy's aim is to escape and report.")
    for i, (x, z, y) in enumerate([(286, 150, 34), (276, 172, 22), (300, 176, 18)]):
        s.mob('swarm-of-bats', c((x, z)), 'Swarm of bats (from the cleft)', 'Bats', y=y,
              dm='Night entry 9 (1d8 swarms, p.29/31), or when the party climbs onto the crest: they pour out of the cleft above the guard-post and sweep the apron. Strahd\'s servants; they attack without provocation.')
    for i, (x, z, r) in enumerate([(150, 330, 80), (168, 314, 60), (225, 384, 30), (206, 396, 50)]):
        s.mob('dire-wolf', c((x, z)), 'Dire wolf (Strahd\'s servant)', 'A huge wolf', size='large', rot=r,
              dm='Day entry 12 or night entry 10 (1d6 dire wolves, p.29/30): out of the fog from the pines to the west and from below the collapsed revetment; they circle the apron. The fog lightly obscures them. Cannot be charmed or frightened. Keep them off the horses; the open coach door is the obvious refuge.')
    s.mob('i-skeletal-rider', c((500, 238)), 'Skeletal rider with a dark lantern (encounter 8)', 'A skeletal rider', size='large', rot=180,
          dm='Entry 8 on either table (p.29/31), best at night: a skeleton in ruined chain mail on a skeletal warhorse, holding up a rusted lantern that sheds no light. It comes up the cobbles out of the Cut Block at a walk, passes the coach stand without a glance and goes on down the south arm into the fog. Ignores the party unless attacked; once both are destroyed it never returns.')

    # -------------------------------------------------------------- notes
    s.note(c((40, 30)), 'North-west, 0.7 mi and 360 ft down: the western Gates of Barovia (B), which open as the party approaches and close behind it. About 15 minutes on foot.')
    s.note(c((585, 214)), "East, 2.1 mi of cobbled road through forest and crags to the Gates of Ravenloft (J): 40-45 minutes on foot, 15-20 by carriage. Use J's arrival text for the sudden turn east.")
    s.note(c((262, 488)), 'South, 0.8 mi of winding descent to the bridge at Tser Falls (H), 15-20 minutes on foot.')
    s.note(c((246, 330)), 'Random encounters (p.28-29): check every 30 minutes on the road, an encounter on 18+, at most two outdoor encounters in 12 hours.')
    s.note(c((224, 356)), 'Terrain: the revetments are a 6-8 ft drop into the trees; the wooded slope below the shelf (darker ground) is difficult; the water-splash is slick (Acrobatics DC 10 to cross at speed); the toll stop-stone is half cover for a prone creature; cobbles and the coach stand are not difficult.')
    s.note(c((360, 304)), 'If the party refuses the coach, it waits while they are in sight; the fog takes it once nobody is looking (inferred). Harming the horses is an insult Strahd learns of within the hour (inferred).')
    s.note(c((272, 252)), 'History DC 12 or Investigation DC 15 on the lamp base: the castle\'s arms. The lamp marked the start of the Count\'s own road; the toll bar beyond kept peasants off it.')
    s.spawn(c((248, 470)))
    s.note(c((90, 70)), 'Alternative arrival: the party coming from the western gates enters here, out of the fog.')

    # -------------------------------------------------------------- the woods: pines own the west and the slope below the shelf
    east_z = lambda x: interp_z(east, x)
    south_x = lambda z: interp_x(south, z)
    def below(x, z):
        """How far below the road beside it the ground under (x, z) lies (feet): the drop the pines stand in."""
        if x > 268:
            ze = east_z(x) + COBBLE_HW + 3 if x > 320 else 336
            return 0 if z < ze else 7 + (z - ze) * 0.34
        xs = south_x(min(max(z, 330), 506))
        if z > 334 and x < xs - DIRT_HW - 1:
            return 7 + (xs - DIRT_HW - x) * 0.3 + max(0, z - 340) * 0.12
        if z > 350 and x > xs + DIRT_HW:
            return min(10, (z - 350) * 0.1)
        if x < 205 and z > 320: return (z - 320) * 0.25
        return 0
    def density(xc, zc):
        x, z = xc * FT, zc * FT
        if inside((x, z), crest_poly) or inside((x, z), face_poly): return 0
        if x < 180: return 0.9 if z > 40 or x < 140 else 0.4
        if z > 360: return 0.85
        if x > 268 and z > east_z(x) + 14: return 0.6
        if 180 <= x < 228 and z > 250: return 0.55
        return 0.05
    s.pines(5200, density=density, gap=2.3, margin=1.0, scale=(0.95, 1.45))
    for o in lv.objects:
        if o['kind'] != 'pine': continue
        d = min(24.0, 0.5 * 26 * o['dims']['scale'], below(o['pos'][0], o['pos'][2]))
        if d > 0.5: o['pos'][1] = -rnd(d, 1)
    # the darker ground of the wooded slope below the shelf (steep: difficult)
    wave = lambda i, a: a * math.sin(i * 1.7) + a * 0.6 * math.sin(i * 0.63 + 1)
    west_edge = [(x, 352 + wave(i, 7) + (0 if x < 150 else (x - 150) * -0.05)) for i, x in enumerate(range(0, 221, 20))]
    s.patch(cl([(0, 500)] + west_edge + [(228, 347), (236, 354), (237, 500)]), 'marsh')
    sx = [p for p in offset(east, COBBLE_HW + 7) if 358 <= p[0] <= 600]
    s.patch(cl([(268, 500)] + [(268 + wave(i, 4), z) for i, z in enumerate(range(480, 350, -20))] + [(300, 338), (340, 316)] + [p for p in thin(sx, 10)] + [(600, 500)]), 'marsh')
    # the north wedge and the crest foot: rock, scree and a few stunted pines
    s.scatter('boulder', 26, lambda xc, zc: 1.0 if (zc * FT < interp_z(east, xc * FT) - 18 and xc * FT > 200 and not inside((xc * FT, zc * FT), face_poly)) else 0.0, margin=0.8, gap=2.0, dims=lambda g: {'r': rnd(1.2 + g.random() * 2.6)})
    s.scatter('i-krummholz', 9, lambda xc, zc: 1.0 if (zc * FT < interp_z(east, xc * FT) - 22 and xc * FT > 320 and not inside((xc * FT, zc * FT), face_poly)) else 0.0, margin=1.0, gap=3.0, dims=lambda g: {'scale': rnd(0.8 + g.random() * 0.5)}, rot=False)
    s.undergrowth(bushes=60, boulders=18, dead=6, stumps=8, logs=7, density=lambda xc, zc: 1.0 if (xc * FT < 190 or zc * FT > 360) else 0.15)
    for o in lv.objects:
        if o['kind'] in ('bush', 'stump', 'log', 'dead-tree', 'boulder'):
            d = below(o['pos'][0], o['pos'][2])
            if d > 0.5 and o['kind'] in ('dead-tree',): o['pos'][1] = -rnd(min(10.0, d * 0.4), 1)

    # -------------------------------------------------------------- the fog: knee-deep in the hollow of the fork, a sea of it
    # in the trees below the shelf (the crowns standing out of it), threads of it among the western pines, and the bank
    # the gate road vanishes into at the corner
    for i, (x, z, L, d, h, layers, op, r) in enumerate([
            (262, 302, 150, 112, 2.8, 4, 0.12, 12), (236, 362, 80, 46, 3, 3, 0.14, 70),
            (120, 432, 260, 160, 7, 4, 0.18, 8), (300, 418, 110, 120, 6, 4, 0.17, 0), (500, 392, 220, 130, 7, 4, 0.18, 4), (420, 486, 200, 50, 5, 3, 0.18, 0),
            (92, 236, 150, 120, 5, 3, 0.09, 50), (52, 44, 110, 80, 9, 4, 0.17, 38), (560, 470, 90, 60, 6, 3, 0.18, 0)]):
        o = s.prop('i-fog', c((x, z)), rot=r, dims={'len': L, 'd': d, 'h': h, 'layers': layers, 'op': op, 'seed': i + 1})
        o['vis'] = 'explored'

    # -------------------------------------------------------------- the crest: its own level, 55 ft up
    crest = Level('crest', 'Crag crest', CREST_H, 12, ambient=AMB, interior='rubble', exterior='rubble', north='-z')
    # (no terrain on the crest: an upper level with terrain draws its grid well past its own edge, over the face)
    crest.room('I-crest', 'Crag crest', cl(crest_poly), 'grass', page=37)
    s.desc['I-crest'] = ('A broken band of bare grey rock, scree heads and wind-bent dwarf pines along the top of the crag, with a few dead snags; the whole fork lies open below. A narrow black cleft in the face drops away just under the lip above the guard-post.',
                         "A firing position over the whole fork. Reached by the scramble behind the guard-post (Athletics DC 10) or up the Cut Block's scree (DC 12). Bats nest in the cleft (night entry 9). Ravens gather on the snags; the wereraven perches above the guard-post.")
    cn = [0]
    def cprop(kind, pos, rot=0, dims=None, y=0, label=None, desc=None):
        cn[0] += 1
        crest.prop(f'{kind}{cn[0]}', kind, c(pos), None, rotY=rnd(rot, 1), dims=dims, y=y)
        o = crest.objects[-1]
        if label: o['label'] = label
        if desc: o['desc'] = desc
        return o
    def cmob(kind, pos, label, player, size='medium', rot=0, y=0, dm=None, dims=None):
        cn[0] += 1
        crest.obj(f'{kind}{cn[0]}', kind, c(pos), 'hidden-creature', 'I', label, rotY=rot, size=size, dims=dims, y=y)
        o = crest.objects[-1]; o['playerLabel'] = player
        if dm: o['dm'] = dm
    rng = s.rng
    placed = []
    def free(p, gap):
        return all(math.hypot(p[0] - q[0], p[1] - q[1]) >= gap for q in placed)
    def inner(p, m):
        """Inside the crest polygon by at least m ft."""
        if not inside(p, crest_poly): return False
        return min(seg_dist(p, crest_poly[i], crest_poly[(i + 1) % len(crest_poly)]) for i in range(len(crest_poly))) >= m
    # rock outcrops and the scree heads at the top of the two scrambles
    for i, (x, z, w, h) in enumerate([(240, 40, 30, 18), (330, 60, 36, 24), (420, 50, 30, 14), (520, 70, 40, 22), (575, 120, 26, 16), (470, 100, 22, 9), (285, 95, 18, 7), (380, 85, 20, 9)]):
        cprop('crag', (x, z), rot=rng.uniform(0, 360), dims={'w': w, 'd': rnd(w * 0.7), 'h': h, 'seed': 60 + i}); placed.append((x, z))
    for (x, z) in [(266, 114), (474, 130)]:
        for k in range(5): cprop('boulder', (x + rng.uniform(-8, 8), z - rng.uniform(2, 12)), dims={'r': rnd(1 + rng.random() * 1.5)})
    # krummholz and dead snags; the snags the ravens gather on
    snags = [(220, 60), (360, 50)]
    for p in snags:
        cprop('i-krummholz', p, dims={'dead': 1, 'scale': 1.3}, label='Dead snag', desc='A dead pine, silver and bare, its stubs pointing east.'); placed.append(p)
    for p in [(300, 30), (455, 35), (540, 110)]:
        cprop('i-krummholz', p, dims={'dead': 1, 'scale': rnd(0.9 + rng.random() * 0.4)}); placed.append(p)
    n = 0
    for _ in range(900):
        if n >= 34: break
        p = (rng.uniform(195, 598), rng.uniform(3, 175))
        if not inner(p, 6) or not free(p, 13): continue
        cprop('i-krummholz', p, rot=rng.uniform(-12, 12), dims={'scale': rnd(0.75 + rng.random() * 0.6)}); placed.append(p); n += 1
    for _ in range(30):
        p = (rng.uniform(200, 595), rng.uniform(5, 170))
        if inner(p, 4) and free(p, 6): cprop('bush', p, dims={'scale': rnd(0.5 + rng.random() * 0.4)}); placed.append(p)
    # the crest's watchers
    for p in snags:
        cmob('swarm-of-ravens', p, "Swarm of ravens (Strahd's spies)", 'Ravens', y=10,
             dm="Day entry 11 (1d4 swarms, 50%) or Strahd's spies (p.29/31): they gather on the snags and the Cut Block once the single raven has followed a while. They watch and report; they fight only if cornered.")
    cmob('raven', (300, 121), 'Wereraven in raven form (use wereraven stats)', 'A raven', size='tiny', rot=200,
         dm='Day entry 11 (50% instead of the swarms, p.29/31): it watches from the crest, flies off when it feels eyes on it and comes back; it shadows the party for 1d4 hours, then flies home to report. A second meeting: it presents itself as an ally and asks them to the Blue Water Inn in Vallaki. Its spare clothes are the hidden bundle below the collapsed revetment.')
    crest.note('note-crest', c((300, 112)), 'I', 'The bat cleft opens in the face just below here, above the guard-post.')

    lk = lambda id, a, b: OrderedDict(id=id, kind='ladder', **{'from': OrderedDict(level='day', pos=[a[0], a[1]]), 'to': OrderedDict(level='crest', pos=[b[0], b[1]])})
    links = [lk('I-scramble-post', (272, 186), (264, 112)), lk('I-scramble-cut', (466, 205), (474, 126))]
    s.write('Black Carriage', {'valley': True, 'stacked': 'open', 'entry': 'day'}, levels=[crest], links=links)


def _normals_ft(line):
    """Unit left normals (-tz, tx) of a polyline (feet), averaged at the vertices."""
    out = []
    for i in range(len(line)):
        a, b = line[max(0, i - 1)], line[min(len(line) - 1, i + 1)]
        tx, tz = b[0] - a[0], b[1] - a[1]; L = math.hypot(tx, tz) or 1
        out.append((-tz / L, tx / L))
    return out


from collections import OrderedDict  # noqa: E402

if __name__ == '__main__':
    build()
