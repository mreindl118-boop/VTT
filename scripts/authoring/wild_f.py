#!/usr/bin/env python3
"""F. River Ivlis Crossroads (p.35): the gallows knoll between the two western forks, the three-armed signpost across
the trampled apron from it, the walled plot of eleven blank graves behind the signpost, and three roads leaving at
three different pitches: down into a tree tunnel (NW, to Tser Pool), up along a shelf cut into the slope (SW, to Tser
Falls and Ravenloft), down toward the river (E, to the bridge and the village). A steady west wind: every pine on the
knoll is flagged east and every obstacle has a drift of needles on its lee side.

Map: 600 x 500 ft (120 x 100 cells), the junction apron at the centre. Brief coordinates are feet from the junction,
x east, z south; P() turns them into cells and FT() into map feet. Levels: the ground (0 = 460 ft ASL), the knoll's
crown (+8) and the gallows deck (+13), all drawn at once ('open' stack) so the gallows reads as the focal mass.
Props of this site live in app/src/kit/sites/wild-f.ts (kinds f-*)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wildlib import *  # noqa: F401,F403
from collections import OrderedDict

W, H = 120, 100
CX, CZ = 60, 50
def P(x, z): return (CX + x / 5, CZ + z / 5)            # brief feet -> cells
def FT(x, z): return [rnd(CX * 5 + x, 1), rnd(CZ * 5 + z, 1)]   # brief feet -> map feet (prism polygons)
def bearing_dir(b):
    """Unit plan vector of a compass bearing (degrees clockwise from north = -z)."""
    r = math.radians(b); return (math.sin(r), -math.cos(r))


def build():
    s = Site('F', 'River Ivlis Crossroads', W, H, 4035)
    J = P(0, 0)
    KNOLL = (-82, -10)          # the rock shelf's centre (ft); its blunt east face at x = -52
    GALLOWS = (-78, -10)        # on the crown, stairs facing east
    GROT = facing(1, 0)         # the kit gallows has its stairs at local +z: turn that to +x (east)
    rope = turn(1.2, 0, GROT)   # the rope hangs at local (1.2, 0)
    ROPE = (GALLOWS[0] + rope[0], GALLOWS[1] + rope[1])

    # ------------------------------------------------------------------ roads: three ways out at three pitches
    east = s.road([J, P(64, -34), P(126, -75), P(186, -104), P(246, -143), P(300, -175)], 1.8)
    nw = s.road([J, P(-30, -25), P(-58, -52), P(-78, -72), P(-100, -102), P(-122, -134), P(-150, -176), P(-180, -214), P(-210, -250)], 1.5)
    sw = s.road([J, P(-24, 14), P(-70, 28), P(-130, 46), P(-190, 68), P(-250, 88), P(-300, 110)], 1.4)
    spur = s.road([P(-24, -1), P(-33, -3), P(-41, -6)], 1.0, per=3)              # the hangman's cart spur, dead-ending at the stair foot
    s.patch(blob(J[0], J[1], 5.4, 9, sx=1.1), 'dirt')                                 # the apron: about 55 ft of hoof-churned dirt
    s.patch(blob(*P(-40, -5), 1.9, 4, sx=1.1), 'dirt')                                # the churned turn-round
    s.patch(blob(*P(-75, -70), 1.5, 11, sx=1.2), 'dirt')                              # the braid where carts skirt the pool
    s.clear(J[0], J[1], 11)

    # ------------------------------------------------------------------ the rising west: terraces (prisms) between the forks
    TURF = 0x3d5241
    def prism(poly_ft, h, color=TURF, y=0, key=None):
        s.lv.prop(s.uid('terrace'), 'prism', (0, 0), key, dims={'h': h, 'color': color, 'y': y}); o = s.lv.objects[-1]
        o['pos'] = [0, 0, 0]; o['polygon'] = [FT(x, z) for x, z in poly_ft]; return o
    T1 = [(-134, -118), (-150, -150), (-172, -186), (-196, -222), (-222, -250), (-300, -250), (-300, 93), (-262, 76), (-222, 61), (-186, 49), (-150, 35), (-134, 30)]
    T2 = [(-218, -170), (-232, -214), (-246, -250), (-300, -250), (-300, 91), (-268, 74), (-240, 60), (-220, 50), (-210, -20), (-214, -90)]
    T3 = [(-270, -200), (-280, -250), (-300, -250), (-300, 90), (-284, 80), (-274, 40), (-266, -40), (-262, -120)]
    for poly, h in ((T1, 4), (T2, 8), (T3, 12)):
        prism(poly, h)
    def terrace_h(x, z):
        """Height of the ground (ft) at a brief point: the terraces to the west, else 0."""
        for poly, h in ((T3, 12), (T2, 8), (T1, 4)):
            if inside((x, z), poly): return h
        return 0
    # boulders and scrub on the stony terraces, each standing on its terrace
    rr = random.Random(77)
    for i in range(26):
        x, z = rr.uniform(-298, -136), rr.uniform(-240, 60)
        if line_dist(P(x, z), nw) < 4.5 or line_dist(P(x, z), sw) < 4.5: continue
        y = terrace_h(x, z)
        if i % 3: s.prop('boulder', P(x, z), rot=rr.uniform(0, 360), dims={'r': rnd(1.4 + rr.random() * 2.6)}, y=y)
        else: s.prop('bush', P(x, z), rot=rr.uniform(0, 360), dims={'scale': rnd(0.6 + rr.random() * 0.5)}, y=y)
    for i in range(7):
        x, z = rr.uniform(-296, -140), rr.uniform(-236, 50)
        if line_dist(P(x, z), nw) < 5 or line_dist(P(x, z), sw) < 5: continue
        s.prop('f-wind-pine', P(x, z), dims={'h': rnd(18 + rr.random() * 12), 'lean': rnd(8 + rr.random() * 6), 'r': rnd(4 + rr.random() * 2)}, y=terrace_h(x, z))
    for i in range(10):
        x, z = rr.uniform(-296, -140), rr.uniform(-230, 60)
        if line_dist(P(x, z), nw) < 4 or line_dist(P(x, z), sw) < 4: continue
        s.prop('weeds', P(x, z), rot=rr.uniform(0, 360), dims={'n': 4, 'r': 1.6}, y=terrace_h(x, z))

    # ------------------------------------------------------------------ the gallows knoll
    s.prop('f-rock-shelf', P(*KNOLL), dims={'w': 60, 'd': 44, 'h': 8, 'seed': 2}, label='Gallows knoll',
           desc='A blunt hump of grey bedrock, flat on top and eight feet above the road at its east face, with thin turf and lichen on its crown. The gallows stands on it against the sky.')
    s.keep.append(([P(KNOLL[0] - 34, KNOLL[1] - 26), P(KNOLL[0] + 34, KNOLL[1] - 26), P(KNOLL[0] + 34, KNOLL[1] + 26), P(KNOLL[0] - 34, KNOLL[1] + 26)], 1.0))
    s.prop('gallows', P(*GALLOWS), rot=GROT, dims={'h': 5}, y=8, label='The gallows',
           desc='Old wooden gallows on a rotting platform five feet high, its stairs facing the junction. The beam is worn in a groove where many ropes have run; a frayed rope swings from it and creaks in the wind. Two deck planks have rotted through, and a trapdoor with a rusted bolt sits under the rope.')
    s.prop('f-gallows-junk', P(GALLOWS[0], GALLOWS[1]), dims={'w': 8}, y=8, label='Under the platform',
           desc='Drifted needles, two planks fallen from the deck, a broken short ladder and a coil of old rope gone green.')
    s.prop('f-knoll-stair', P(-53.5, -8), rot=0, dims={'h': 8, 'run': 14, 'w': 4}, label='Stair down the rock',
           desc='A rickety timber stair descends the knoll\'s east face to the churned ground where the hangman\'s cart turned.')
    s.prop('f-wagon-ruts', P(-31, -2.5), rot=heading(-17, -5), dims={'len': 20, 'w': 5, 'puddles': 0}, label='Cart ruts',
           desc='Two cart ruts, deeper than the road\'s, leave the apron and end in a churned turn-round at the foot of the stair.')
    for x, z, L in ((-56, 0, 8), (-63, 9, 6), (-55.5, -18, 8)): s.prop('f-needle-drift', P(x, z), rot=0, dims={'len': L, 'h': 1.5})   # banked against the knoll's east foot
    s.prop('f-needle-drift', P(GALLOWS[0] + 6.2, GALLOWS[1] - 6), rot=0, dims={'len': 8, 'h': 0.9}, y=8)   # against the deck's east posts
    # the five wind-flagged pines on the knoll's flanks, the only trees that grow near it
    for (x, z), h, lean in (((-95, -55), 38, 13), ((-60, -50), 30, 11), ((-110, 30), 44, 12), ((-80, 45), 27, 14), ((-150, 70), 34, 10)):
        s.prop('f-wind-pine', P(x, z), dims={'h': h, 'lean': lean, 'r': rnd(h * 0.19)}, y=terrace_h(x, z), label='Wind-flagged pine',
               desc='A pine with boughs only on its east side, its trunk leaning away from the wind and bleached bare on the windward face.')
        s.trees.append((P(x, z)[0], P(x, z)[1], 3.0))
    # the two boulders that pinch the forks apart
    s.prop('crag', P(-120, -40), rot=20, dims={'w': 12, 'd': 10, 'h': 8, 'seed': 3}, label='The hearth stone',
           desc='A rounded grey block twelve feet across. Its east side is smeared with soot, and fish bones lie in the ashes of a small fire someone sheltered here out of the wind.')
    s.prop('f-cold-hearth', P(-110, -40), rot=15, dims={'r': 2.2})
    s.prop('f-needle-drift', P(-105.5, -40), rot=0, dims={'len': 10, 'h': 1.4})
    s.prop('crag', P(-110, 40), rot=heading(-0.94, 0.34), dims={'w': 15, 'd': 7, 'h': 5, 'seed': 5}, label='The wedge stone',
           desc='A wedge of grey rock fifteen feet long lying along the bank of the climbing road, lichen on its north face.')
    s.prop('f-needle-drift', P(-101.5, 42), rot=0, dims={'len': 7, 'h': 1.1})
    for cx, cz in ((-120, -40), (-110, 40)): s.clear(*P(cx, cz), 4)

    # ------------------------------------------------------------------ the apron and the signpost
    s.prop('f-wagon-ruts', P(14, -8), rot=heading(0.866, -0.5), dims={'len': 34, 'w': 5, 'puddles': 2})
    s.prop('f-wagon-ruts', P(70, -40), rot=heading(0.866, -0.5), dims={'len': 60, 'w': 5, 'puddles': 2})
    s.prop('f-wagon-ruts', P(170, -97), rot=heading(0.866, -0.52), dims={'len': 70, 'w': 5, 'puddles': 1})
    s.prop('fingerpost', P(45, 22), dims={'a0': 60, 'a1': 310, 'a2': 250}, label='Signpost',
           desc='A weathered fingerpost with three arms, its lettering chipped: Barovia Village east, Tser Pool north-west, Ravenloft and Vallaki south-west. Reading it means facing the noose across the road.')
    s.prop('f-needle-drift', P(47.5, 22), rot=0, dims={'len': 4, 'h': 0.8})
    s.prop('weeds', P(52, 30), dims={'n': 4, 'r': 1.6}); s.prop('weeds', P(-6, 34), dims={'n': 3, 'r': 1.3}); s.prop('weeds', P(30, -28), dims={'n': 4, 'r': 1.5})

    # ------------------------------------------------------------------ the north-west fork: ruts, the black pool, the tunnel mouth
    for f in (0.12, 0.42, 0.6, 0.78):
        (x, z), (dx, dz) = along(nw, f)
        s.prop('f-wagon-ruts', (x, z), rot=heading(dx, dz), dims={'len': 46, 'w': 5, 'puddles': 2 if f > 0.2 else 1})
    pool = blob(-75, -70, 8, 5, sx=1.5)
    prism(pool, 0.1, color=0x1f2529)
    s.prop('weeds', P(-86, -62), dims={'n': 3, 'r': 1.2}); s.prop('weeds', P(-64, -78), dims={'n': 3, 'r': 1.2})
    s.note(P(-75, -62), 'The first dip of the Tser Pool road holds a black standing pool; carts have cut a muddy braid round its east side. Within 120 ft the pines close over the road in a dark tunnel.')

    # ------------------------------------------------------------------ the south-west fork: the climbing shelf, its bank and water-bars
    swdir = (-0.94, 0.34)
    def sw_point(f): return along(sw, f)[0]
    for f0 in (0.03, 0.17, 0.31, 0.45, 0.59, 0.73, 0.87):
        (x, z), (dx, dz) = along(sw, f0 + 0.07)
        nrm = (-dz, dx)                       # the uphill (north) side of a road heading west-south-west
        hw = 1.4 + 0.9
        s.prop('f-road-bank', (x + nrm[0] * hw, z + nrm[1] * hw), rot=heading(dx, dz), dims={'len': 44, 'h': rnd(1.8 + f0 * 1.6)})
    for i, (x, z) in enumerate(((-70, 32), (-120, 50), (-170, 68), (-220, 85), (-270, 102))):
        s.prop('f-water-bar', P(x, z), rot=facing(0.94, -0.34), dims={'len': 12 + (i % 2) * 2}, label='Water-bar' if i == 0 else None,
               desc='A half-buried log set across the climbing road to shed runoff, a fan of washed gravel below it.' if i == 0 else None)
    for i in range(9):   # the lip of the downhill side: a loose kerb of stones
        (x, z), (dx, dz) = along(sw, 0.08 + i * 0.105)
        nrm = (dz, -dx)
        s.prop('boulder', (x + nrm[0] * 2.3 + (i % 3) * 0.1, z + nrm[1] * 2.3), rot=i * 40, dims={'r': rnd(0.9 + (i % 4) * 0.3)})
    s.note(P(-180, 56), 'The Ravenloft road clings to the slope: a bank on its uphill side, a 5-10 ft drop on the downhill side, half-buried logs across it every 50 ft (easy cover for a prone archer). It climbs about 25 ft across the map and nearly 600 ft to the Tser Falls bridge (H), about 6 road-miles, 2 hours on foot.')

    # ------------------------------------------------------------------ the graveyard
    PLOT = [P(-5, 80), P(85, 80), P(85, 150), P(-5, 150)]
    def wall(a, b, h, seed, t=2):
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        s.prop('field-wall', P((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), rot=heading(b[0] - a[0], b[1] - a[1]), dims={'len': rnd(L, 1), 'h': h, 't': t, 'seed': seed}, label='Low stone wall')
    wall((-5, 80), (35, 80), 3, 1); wall((45, 80), (85, 80), 3, 2)          # north run with its gap facing the road
    wall((-5, 80), (-5, 115), 3, 3); wall((-5, 115), (-5, 150), 3, 4)      # west run
    wall((85, 80), (85, 110), 1.2, 5); wall((85, 110), (85, 140), 1.0, 6)  # east run, fallen to a course or two
    wall((58, 150), (84, 150), 2.4, 7)                                     # a stub of south wall, stopping at the yew
    for i, (x, z) in enumerate(((93, 92), (97, 104), (94, 118), (99, 130), (91, 138))): s.prop('rubble', P(x, z), rot=i * 50, dims={'n': 4 + i % 3})
    s.prop('f-needle-drift', P(37, 82.5), rot=0, dims={'len': 4, 'h': 0.9})
    s.prop('f-needle-drift', P(-2.5, 100), rot=0, dims={'len': 26, 'h': 1.0})    # in the lee of the west wall
    # eleven blank stones: the old row sunk and leaning east, the newer row still upright, one apart under the yew
    for i, x in enumerate((0, 20, 40, 60, 80)):
        s.prop('f-sunken-grave', P(x, 104), rot=0, dims={'w': 3, 'd': 7, 'tilt': 15 + (i * 7) % 11, 'sink': rnd(0.3 + (i * 3 % 5) * 0.1)}, key='F-graves',
               label='Old grave' if i == 0 else None, desc='A blank headstone sunk almost to the turf and leaning with the wind over a sunken hollow.' if i == 0 else None)
    for i, x in enumerate((10, 30, 50, 70)):
        s.prop('gravestone', P(x, 125), rot=s.rng.uniform(-6, 6), key='F-graves', label='Blank gravestone' if i == 0 else None,
               desc='A plain headstone with sharp cut edges and nothing carved on it, over a low mound.' if i == 0 else None)
    yew_dir = (88 - 75, 148 - 140)
    s.prop('f-sunken-grave', P(75, 144), rot=heading(*yew_dir), dims={'w': 3, 'd': 7, 'tilt': 14, 'sink': 0.3, 'tended': 1}, key='F-graves', label='The grave apart',
           desc='The eleventh stone stands alone in the corner under the yew, tilted toward the tree. A ring of turf round it has been cleared and a dried posy of yew sprigs lies at its foot.')
    s.prop('f-open-grave', P(6, 92), rot=0, dims={'w': 3, 'd': 7, 'depth': 5}, key='F-graves', label='Open grave',
           desc='A freshly dug grave with no stone: raw earth walls, the spoil heaped on its north side with a rusted shovel standing in it. It is empty.')
    s.prop('f-yew', P(88, 148), rot=0, dims={'h': 30, 'spread': 30}, label='The yew',
           desc='An ancient yew, black-green and hollow-boled, its twisted trunk five feet thick. Its roots have heaved the corner of the wall apart and spilled a run of stones. Ravens shift in its crown.')
    s.prop('f-needle-drift', P(94, 150), rot=0, dims={'len': 10, 'h': 1.0})
    s.prop('f-lean-to', P(-10, 120), rot=0, dims={'w': 10, 'd': 6}, label='Gravedigger\'s lean-to',
           desc='A collapsed lean-to of poles and turf against the outside of the wall, its roof fallen in at one end. Under it: a mattock, a shovel with a split haft, a coil of rope and a bier of two poles with rotted cross-slats.')
    for x, z, L, D, h, sd in ((40, 116, 80, 56, 3, 1), (110, 118, 44, 56, 3, 2)):
        s.prop('mist', P(x, z), rot=sd * 7, dims={'len': L, 'h': h, 'd': D}, label='Fog over the graves' if sd == 1 else None)
    s.keep.append((PLOT, 2.0))
    s.keep.append(([P(85, 80), P(135, 80), P(135, 160), P(85, 160)], 0.6))     # the fog hollow east of the broken wall
    s.keep.append(([P(-30, 100), P(-5, 100), P(-5, 150), P(-30, 150)], 0.3))
    s.clear(*P(40, 50), 8)                                                   # the road verge in front of the plot stays open

    # ------------------------------------------------------------------ the woods: a frame, not a flood
    def dens(cx, cz):
        x, z = (cx - CX) * 5, (cz - CZ) * 5
        # the view gap north of the knoll: bearings 333-7 from the gallows stay clear of trees
        dx, dz = x - GALLOWS[0], z - GALLOWS[1]
        b = (math.degrees(math.atan2(dx, -dz)) + 360) % 360
        if z < -45 and (b >= 333 or b <= 7) and math.hypot(dx, dz) < 330: return 0.0
        if z > 170: return 1.0                                   # the Svalich Woods: the south wall
        if x > 130 and z < -40: return 1.0                       # the north-east quadrant beyond the road verge
        if x < -60 and z < -105: return 0.95                     # the tree tunnel round the Tser Pool fork
        if x < -134: return 0.0                                  # open stony scrub rising west (its own sparse pines above)
        if x > 130: return 0.55 if z < 150 else 0.9             # south-east: forest thinning toward the plot's hollow
        if z < -60: return 0.6 if x > -40 else 0.45              # north between the forks
        if z > 110 and x < -40: return 0.4                       # south band above the climbing road
        if z > 125 and x > 100: return 0.6
        return 0.0
    def giant(x, z):
        xf, zf = (x - CX) * 5, (z - CZ) * 5
        if xf < -70 and zf < -110: return (1.45, 1.75)          # the tunnel closes over the road
        if zf > 185 or (xf > 150 and zf < -60): return (1.25, 1.65)
        return None
    for k, f in enumerate((0.47, 0.55, 0.63, 0.71, 0.79, 0.87, 0.95)):      # the tunnel: big pines crowding the fork's verges beyond its mouth
        (x, z), (dx, dz) = along(nw, f)
        for side in (-1, 1):
            nx, nz = -dz * side, dx * side
            px, pz = x + nx * (2.0 + 0.2 * (k % 2)), z + nz * (2.0 + 0.2 * ((k + side) % 2))
            if not s.inmap((px, pz), 1.0): continue
            s.trees.append((px, pz, 2.2))
            s.prop('pine', (px, pz), rot=int(s.rng.random() * 360), dims={'h': 26, 'r': 6, 'scale': rnd(1.55 + 0.2 * s.rng.random())})
    s.pines(5200, density=dens, gap=2.4, margin=1.1, scale=(1.0, 1.5), giant=giant)
    s.undergrowth(bushes=34, boulders=6, dead=5, stumps=4, logs=3, density=lambda x, z: 1.0 if dens(x, z) > 0.3 else (0.25 if (x - CX) * 5 > -134 else 0.0))
    s.scatter('weeds', 10, lambda x, z: 1.0 if math.hypot(x - J[0], z - J[1]) < 10 and math.hypot(x - J[0], z - J[1]) > 5.5 else 0.0, margin=0.3, gap=1.4, dims={'n': 3, 'r': 1.3}, circles=False)

    # ------------------------------------------------------------------ rooms
    apron = [P(28 * math.cos(a), 28 * math.sin(a)) for a in (math.radians(k * 45) for k in range(8))]
    s.room('F', 'River Ivlis Crossroads', apron, 'dirt',
           'A trampled circle of bare dirt where three roads meet, hoof-churned, with two black puddles standing in the wagon ruts. A cold wind pours down from the high ground to the west. On a rock knoll above the western forks an old gallows creaks, its frayed rope swinging; across the road a three-armed signpost; behind it, downhill, a low broken wall round a plot of graves lying in fog.',
           'Roll for a random encounter on arrival unless Vistani escort the party (p.35): 18+ on a d20 on a road, then d12+d8 on the day or night table (p.28-29); a Grave result (4) plays as the open grave turned violated. Escorted parties get no roll and are led down the NW fork to the Tser Pool camp (G). The Hanged One appears the moment they leave by any road (see the gallows). East: the stone bridge about 2.4 road-miles (50 min on foot), the village 3.5 road-miles (just over an hour). NW: the Tser Pool camp, 1.7 mi, 35 min, the last half a muddy rutted track. SW: the Tser Falls bridge (H), about 6 road-miles climbing nearly 600 ft, 2 hours.')
    s.room('F-graves', 'Graveyard', PLOT, 'grass',
           'A plot of eleven blank headstones behind a low dry-stone wall that stands only on the north and west; the east side has fallen to a course or two and its stones lie tumbled downslope. The old row has sunk into the turf and leans east; the newer row stands upright. One stone stands apart under a black yew in the corner. A twelfth grave lies open and empty, a rusted shovel in its spoil. Knee-deep fog lies inside the wall and pools in the hollow beyond it.',
           'All eleven were hanged on the gallows and forgotten; each holds a rotted coffin and mouldy bones 5 ft down. Digging one takes about an hour with the lean-to\'s tools, twice that bare-handed. If the Tarokka reading put a treasure here (7 of Coins, p.14), each grave dug adds a cumulative 10% chance (p.36); default it to the grave apart. The grave apart under the yew is Marya\'s lover, hanged for a poisoning Endorovich committed (crypt 7, p.87). The fog is heavily obscured at ground level for prone or Small creatures, lightly obscured otherwise; the sunken hollows are difficult terrain while fogged. The yew\'s hollow hides one Small creature and a rotted leather bundle (Hidden Bundle, p.30).')
    s.note(P(-10, 110), 'Gravedigger\'s tools under the collapsed lean-to: mattock, shovel, rope and a bier. Digging a grave takes about an hour with them, twice that without.')
    s.note(P(75, 152), 'The grave apart: Marya\'s lover (crypt 7, p.87). Suggested resting place of the Tarokka treasure if the 7 of Coins put it here.')
    s.note(P(88, 160), 'The yew\'s hollow bole: room for a Small creature, and a rotted leather bundle wedged inside (Hidden Bundle, p.30, if it is to hold anything). A swarm of bats, one of Strahd\'s spies, roosts in it by day.')
    s.note(P(-118, -52), 'Hearth stone: soot and fish bones on its lee side. Someone camps here between the forks, out of the wind, and recently.')
    s.note(P(-45, 20), 'Terrain: the knoll gives +8 ft, the deck +13 ft. The stair is the only easy way up; the rock face is a DC 10 Athletics scramble. The cart spur and the rutted NW fork are difficult terrain for wheels and mounts.')
    s.note(P(260, -150), 'East, down to the river: the arching stone bridge over the Ivlis, then the village of Barovia (E). The river\'s hiss carries up the slope on a still day.')
    s.note(P(-190, -232), 'North-west, down through the tree tunnel: the river and the Tser Pool encampment (G), 1.7 miles.')
    s.note(P(-280, 120), 'South-west, uphill: Tser Falls (H), then the Gates of Ravenloft and Vallaki.')
    s.spawn(P(214, -124))

    # ------------------------------------------------------------------ the knoll's crown (+8) and the gallows deck (+13)
    kn = Level('knoll', 'Gallows knoll (crown)', 8, 10, ambient=AMB, interior='rubble', exterior='rubble', north='-z')
    crown = [P(KNOLL[0] - 15, KNOLL[1] - 19), P(KNOLL[0] + 27, KNOLL[1] - 19), P(KNOLL[0] + 27, KNOLL[1] + 19), P(KNOLL[0] - 15, KNOLL[1] + 19)]
    kn.room('F-knoll', 'Knoll crown', crown, 'grass', page=35)
    s.desc['F-knoll'] = ('The level crown of the knoll, eight feet above the junction: thin turf over lichened rock, open to the wind, the gallows standing on it. From here a gap in the trees to the north looks down the slope to the grey sheet of Tser Pool a mile and a half off, and to the north-north-east the castle\'s silhouette rides the treeline.',
                         'The gallows stairs are the only easy way onto the platform. Night scenery: Vistani fires through the northern gap and the castle on the NNE skyline tell the party where they stand; use them to sell the choice the signpost offers. A Vistani lookout may sit on the stairs here with a wineskin (table 7, p.32).')
    dk = Level('deck', 'Gallows platform', 13, 12, ambient=AMB, interior='rubble', exterior='rubble', north='-z')
    dk.room('F-deck', 'Gallows platform', [P(GALLOWS[0] - 5, GALLOWS[1] - 5), P(GALLOWS[0] + 5, GALLOWS[1] - 5), P(GALLOWS[0] + 5, GALLOWS[1] + 5), P(GALLOWS[0] - 5, GALLOWS[1] + 5)], 'plank', page=35)
    s.desc['F-deck'] = ('The rotting ten-foot deck of the gallows, thirteen feet above the road. Two planks are gone, the trapdoor under the rope has a rusted bolt, and the beam above is grooved where ropes have run. The rope end swings a little above head height.',
                        'Trapdoor: a Medium creature standing on it for the first time drops 5 ft onto the junk below and lands prone unless it makes a DC 10 Dexterity save. The Hanged One appears here as the party leaves (hidden figure on the rope). Ravens on the beam lift off when the stairs are climbed and settle again; one may be a wereraven of the Keepers of the Feather that shadows the party for 1d4 hours (p.32).')
    s.hidden('hanged-figure', P(*ROPE), 'The Hanged One (illusion)', 'A hanged body', rot=GROT + 25, y=13,
              desc='A grey corpse hangs from the rope that was empty a moment ago, turning slowly in the wind until its dead eyes find you.',
              dm='Reveal as the party leaves by any road: a creak behind them. One random character sees themself; the others see a Barovian they do not know. Real to sight and smell; it melts away to nothing if touched or moved (p.35-36). Hide it again afterward.', id='hanged-one')
    for i, bx in enumerate((-2.0, 1.6)):
        p = turn(bx, 0, GROT)
        s.mob('raven', P(GALLOWS[0] + p[0], GALLOWS[1] + p[1]), 'Raven on the beam', 'A raven', rot=GROT + 90 * (i and -1 or 1), y=23.1, size='tiny', id=f'raven-{i + 1}',
                  dm='Set dressing unless the day table gives result 11 (swarms of ravens or a wereraven). A wereraven keeps its distance and shadows the party 1d4 hours (p.32).')
    s.mob('f-vistani', P(GALLOWS[0] + 12, GALLOWS[1] - 3), 'Vistani lookout', 'A seated traveller with a wineskin', rot=facing(1, 0.3), dims={'v': 2}, y=8, id='vistani-lookout',
              dm='Table result 7 by day (1d4+1 Vistani bandits plundering graves, p.32): this one keeps watch from the stairs while three dig. Not hostile unless provoked; they offer to guide for 100 gp, and wolves leave a guided party alone. One of the four carries 2d4 gems worth 50 gp each.')
    links = [
        OrderedDict(id='F-knoll-stair', kind='stairs', **{'from': OrderedDict(level='day', pos=[rnd(CX * 5 - 37, 1), rnd(CZ * 5 - 8, 1)]), 'to': OrderedDict(level='knoll', pos=[rnd(CX * 5 - 54, 1), rnd(CZ * 5 - 8, 1)])}),
        OrderedDict(id='F-gallows-stair', kind='stairs', **{'from': OrderedDict(level='knoll', pos=[rnd(CX * 5 + GALLOWS[0] + 11, 1), rnd(CZ * 5 + GALLOWS[1], 1)]), 'to': OrderedDict(level='deck', pos=[rnd(CX * 5 + GALLOWS[0] + 3, 1), rnd(CZ * 5 + GALLOWS[1], 1)])}),
    ]

    # ------------------------------------------------------------------ hidden encounters on the ground
    s.mob('raven', P(90, 146), 'Raven in the yew', 'A raven', y=21, size='tiny', id='raven-3')
    s.mob('f-bats', P(86, 150), 'Swarm of bats (Strahd\'s spy)', 'A knot of bats', y=4, dims={'roost': 1, 'y': 2}, id='bats',
          dm='Once per day or night a spy checks on the party (p.29): roosting in the yew\'s hollow by day, wheeling over the knoll at dusk. Notice it with passive Perception against its Stealth; it flees, snatching a small item if confronted.')
    for i, (x, z, v) in enumerate(((2, 98, 0), (13, 90, 1), (-1, 107, 3))):
        s.mob('f-vistani', P(x, z), 'Vistani grave-robber', 'A traveller digging', rot=s.rng.uniform(0, 360), dims={'v': v}, id=f'vistani-{i + 1}',
              dm='Digging at the open grave and the nearest old stone with the lean-to\'s tools, pipe smoke and laughter in the fog (table 7, p.32). Not hostile unless provoked; guides for 100 gp.' if i == 0 else None)
    for i, (x, z, v) in enumerate(((-20, -14, 1), (-33, -27, 2), (-46, -40, 0))):
        s.mob('f-vistani', P(x, z), 'Vistani escort', 'A Vistani traveller', rot=heading(-0.75, -0.66) + 90, dims={'v': v}, id=f'escort-{i + 1}',
              dm='If the party travels with Vistani there is no encounter check; the escorts turn onto the NW fork without a glance at the gallows and lead the way down to the camp (p.35).' if i == 0 else None)
    for i in range(10):
        x = -45 + i * 17.5 + (i % 3) * 4; z = 160 + (i % 2) * 5
        s.mob('wolf', P(x, z), 'Wolf', 'A wolf', rot=facing(0.2 - (i % 4) * 0.1, -1), id=f'wolf-{i + 1}',
              dm='Table result 13 by day or 11 by night: 3d6 wolves (p.33). Howls from the southern pines first, a few minutes to prepare; the pack comes out of the treeline and circles the graveyard wall, using the fog hollow east of it. They cannot be charmed or frightened.' if i == 0 else None)
    s.keep.append(([P(-50, 156), P(125, 156), P(125, 168), P(-50, 168)], 0.6))

    s.write('River Ivlis Crossroads', extra={'stacked': 'open', 'entry': 'day'}, levels=[kn, dk], links=links)


if __name__ == '__main__':
    build()
