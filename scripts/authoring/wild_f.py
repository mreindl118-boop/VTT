#!/usr/bin/env python3
"""F. River Ivlis Crossroads (p.35): the gallows knoll between the two western forks, the three-armed signpost across
the trampled apron from it, the walled plot of eleven blank graves behind the signpost, and three roads leaving at
three different pitches: down into a tree tunnel (NW, to Tser Pool), up along a shelf cut into the slope (SW, to Tser
Falls and Ravenloft), down toward the river (E, to the bridge and the village). A steady west wind: every pine on the
knoll is flagged east and every obstacle has a drift of needles on its lee side.

Map: 600 x 500 ft (120 x 100 cells), the junction apron at the centre. Brief coordinates are feet from the junction,
x east, z south; P() turns them into cells and FT() into map feet. The land is one lattice (kind f-land, 5-ft cells):
the junction sits on the nose of a spur, so the ground climbs ~25 ft to the stony west edge, falls ~25 ft to the east
edge and ~20 ft down the north flank, and the three roads are laid on it as beds (kind f-road) at three pitches.
Levels: the low ground (-25, the datum the land beyond the map meets, listed first), the junction's ground (0 = 460 ft
ASL), the knoll's crown (+8) and the gallows deck (+13), all drawn at once ('open' stack).
Props of this site live in app/src/kit/sites/wild-f.ts (kinds f-*)."""
import sys, os, json
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
    east = s.road([J, P(64, -34), P(126, -75), P(186, -104), P(246, -143), P(300, -175)], 1.8, terrain=False)
    nw = s.road([J, P(-30, -25), P(-58, -52), P(-78, -72), P(-100, -102), P(-122, -134), P(-150, -176), P(-180, -214), P(-210, -250)], 1.5, terrain=False)
    sw = s.road([J, P(-24, 14), P(-70, 28), P(-130, 46), P(-190, 68), P(-250, 88), P(-300, 110)], 1.4, terrain=False)
    spur = s.road([P(-24, -1), P(-33, -3), P(-41, -6)], 1.0, per=3)              # the hangman's cart spur, dead-ending at the stair foot
    s.lv.terrain.pop(0)                                                               # no flat base: the land below is the ground
    s.patch(blob(J[0], J[1], 5.4, 9, sx=1.1), 'dirt')                                 # the apron: about 55 ft of hoof-churned dirt
    s.patch(blob(*P(-40, -5), 1.9, 4, sx=1.1), 'dirt')                                # the churned turn-round
    s.clear(J[0], J[1], 11)

    # ------------------------------------------------------------------ the woods' density (cells), used by the ground and the pines
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

    # ------------------------------------------------------------------ the land: the nose of a spur falling east
    DATUM = -25.0                                   # the low ground's level: the east edge and the land beyond the map
    def ft_line(line): return [((x - CX) * 5, (z - CZ) * 5) for x, z in line]
    EL, NL, SL = ft_line(east), ft_line(nw), ft_line(sw)
    def sm(a, b, t):
        k = min(1.0, max(0.0, (t - a) / (b - a))); return k * k * (3 - 2 * k)
    def sw_z(x):                                     # the SW road's centre z at x (it runs steadily west)
        for (x0, z0), (x1, z1) in zip(SL, SL[1:]):
            if x1 <= x <= x0 or x0 <= x <= x1: return z0 + (z1 - z0) * ((x - x0) / ((x1 - x0) or 1))
        return SL[-1][1] if x < SL[-1][0] else SL[0][1]
    LEDGES = [(-158, 9, 37, 0.0), (-212, 12, 29, 1.0), (-266, 8, 41, 2.0)]   # bedded rock steps across the windward slope
    def ledge_x(L, z): return L[0] + L[1] * math.sin(z / L[2] + L[3])
    def crest(x):                                    # the spur's height along its axis, the rock steps left out
        if x >= 55: return -23.5 * min(1.0, (x - 55) / 235)
        if x >= -60: return 0.0
        if x >= -112: return 7.4 * (-60 - x) / 52
        return 7.4 + 10.4 * min(1.0, (-112 - x) / 188)
    def natural(x, z):
        h = crest(x) + sum(2.4 * sm(ledge_x(L, z) + 1.5, ledge_x(L, z) - 1.5, x) for L in LEDGES)
        kn = 0.19 if x <= 0 else 0.19 - 0.16 * min(1.0, x / 120)
        h -= kn * max(0.0, -32 - z)                                       # the north flank, down toward the Ivlis valley
        if x < -20:                                                        # the south flank under the climbing road
            zr = sw_z(x); edge = zr + 7.5
            h += 0.05 * max(0.0, min(edge - z, edge + 12)) * sm(-100, -170, x)          # rising from the road's bank to the crest
            dz = z - edge
            if dz > 0: h -= 8 * sm(-35, -110, x) * min(1.0, dz / 4) + 0.10 * sm(-35, -100, x) * max(0.0, dz - 4)
        h -= 0.12 * max(0.0, z - 160)                                      # south, down into the Svalich Woods
        h -= 3.5 * math.exp(-((x - 112) / 22) ** 2 - ((z - 120) / 38) ** 2)  # the fog hollow east of the plot
        a = 1.4 * sm(-60, -130, x) + 0.35                                  # the windward slope is lumpier
        h += a * (math.sin(0.09 * x + 0.05 * z) + math.cos(0.11 * z - 0.03 * x) + 0.5 * math.sin(0.23 * x - 0.19 * z)) / 2.5
        return h
    PLOT_R = (-8, 76, 92, 156)
    def forced(x, z, h):
        r = math.hypot(x, z)                                               # the apron: the only level ground on the roads
        if r < 50: h = -0.08 + (h + 0.08) * sm(34, 50, r)
        ox = max(PLOT_R[0] - x, 0, x - PLOT_R[2]); oz = max(PLOT_R[1] - z, 0, z - PLOT_R[3])
        do = min(math.hypot(ox, oz), max(0.0, math.hypot(x - 88, z - 148) - 9))          # the burial plot is dug level
        if do < 4: h = -0.08 + (h + 0.08) * sm(0, 4, do)
        e = math.hypot((x + 82) / 31, (z + 10) / 23)                       # the knoll: its west end grades into the hillside
        if x < -78 and e < 1.9: h = h + (max(h, 7.7 - 4 * max(0.0, e - 1.02)) - h) * sm(-78, -100, x)
        if e < 1.02: h = min(h, 7.7)                                       # under the knoll: below its crown
        return h
    NX, NZ = W, H
    HG = [[forced(i * 5 - 300.0, j * 5 - 250.0, natural(i * 5 - 300.0, j * 5 - 250.0)) for i in range(NX + 1)] for j in range(NZ + 1)]
    def lat(x, z):
        """Height (ft) at a brief point on the lattice, split into triangles the way the f-land prop splits them."""
        u, v = (x + 300) / 5, (z + 250) / 5
        i, j = max(0, min(NX - 1, int(math.floor(u)))), max(0, min(NZ - 1, int(math.floor(v))))
        fu, fv = min(1, max(0, u - i)), min(1, max(0, v - j))
        a, b, c, e = HG[j][i], HG[j][i + 1], HG[j + 1][i + 1], HG[j + 1][i]
        if abs(a - c) < abs(b - e):              # diagonal a-c
            return a + (b - a) * fu + (c - b) * fv if fu >= fv else a + (c - e) * fu + (e - a) * fv
        return a + (b - a) * fu + (e - a) * fv if fu + fv <= 1 else c + (e - c) * (1 - fu) + (b - c) * (1 - fv)
    # the road beds: each road's profile smoothed and made to fall (or, the SW fork, climb) steadily away from the
    # junction; the ground across a bed is cut and filled to it, with a sharp lip on the SW fork's downhill side
    POOL = (-75, -70)
    def profile(L, climb):
        hs = [lat(x, z) for x, z in L]; hs[0] = 0.0
        sm_h = [sum(hs[max(0, k - 4):k + 5]) / len(hs[max(0, k - 4):k + 5]) for k in range(len(hs))]
        out, m = [], 0.0
        for k, h in enumerate(sm_h):
            m = max(m, h) if climb else min(m, h); out.append(m)
        return out
    EP, NP, SP = profile(EL, False), profile(NL, False), profile(SL, True)
    kp = min(range(len(NL)), key=lambda k: math.hypot(NL[k][0] - POOL[0], NL[k][1] - POOL[1]))
    for k in range(len(NL)):                                              # the first dip: the road levels out where the pool lies
        if math.hypot(NL[k][0] - POOL[0], NL[k][1] - POOL[1]) < 16: NP[k] = NP[kp]
    for k in range(1, len(NP)): NP[k] = min(NP[k], NP[k - 1])
    ROADS = [(EL, EP, 9.0, False), (NL, NP, 7.5, False), (SL, SP, 7.0, True)]
    def near(L, HP, x, z):
        best = (1e9, 0.0, 0.0)
        for k in range(len(L) - 1):
            (ax, az), (bx, bz) = L[k], L[k + 1]; dx, dz = bx - ax, bz - az; L2 = dx * dx + dz * dz or 1e-9
            t = max(0.0, min(1.0, ((x - ax) * dx + (z - az) * dz) / L2)); d = math.hypot(x - ax - dx * t, z - az - dz * t)
            if d < best[0]: best = (d, HP[k] + (HP[k + 1] - HP[k]) * t, (x - ax) * -dz + (z - az) * dx)
        return best
    for j in range(NZ + 1):
        for i in range(NX + 1):
            x, z = i * 5 - 300.0, j * 5 - 250.0
            for L, HP, hw, lip in ROADS:
                d, y, side = near(L, HP, x, z)
                if d > hw + 8: continue
                w = 1 - sm(hw + 0.5, hw + 2.5, d) if lip and side < 0 and x < -35 else 1 - sm(hw + 1.5, hw + 7, d)
                HG[j][i] = HG[j][i] + (y - HG[j][i]) * w
            HG[j][i] = max(DATUM + 0.2, HG[j][i])
    ground = lat
    def gclass(x, z):
        if PLOT_R[0] <= x <= PLOT_R[2] and PLOT_R[1] <= z <= PLOT_R[3]: return 5
        if 3.5 * math.exp(-((x - 112) / 22) ** 2 - ((z - 120) / 38) ** 2) > 1.3: return 3
        if math.hypot(x, z) < 36 or math.hypot(x + 40, z + 5) < 12: return 4
        if dens(CX + x / 5, CZ + z / 5) >= 0.5: return 2
        if x < -100 + 12 * math.sin(z * 0.045) or (x < -60 and abs(z + 8) < 26 + 0.4 * (-60 - x)): return 1
        return 0
    hv = [max(1, min(4094, int(round((HG[j][i] - DATUM) / 0.1)))) for j in range(NZ + 1) for i in range(NX + 1)]
    cv = [gclass(i * 5 - 300.0, j * 5 - 250.0) for j in range(NZ + 1) for i in range(NX + 1)]
    ld = {'nx': NX, 'nz': NZ, 'cell': 5, 'q': 0.1}
    for k in range(0, len(hv), 4): ld[f'd{k // 4}'] = sum(c * 4096 ** n for n, c in enumerate((hv[k:k + 4] + [0] * 4)[:4]))
    for k in range(0, len(cv), 13): ld[f'c{k // 13}'] = sum(c * 16 ** n for n, c in enumerate(cv[k:k + 13]))
    skip = set()
    skip.add(s.prop('f-land', (0, 0), dims=ld, y=DATUM)['id'])
    def bed(L, HP, w, c=0):
        """The road bed as a ribbon of points every ~5 ft, at the cut ground's height."""
        pts = [L[0]]
        for (ax, az), (bx, bz) in zip(L, L[1:]):
            n = max(1, int(math.hypot(bx - ax, bz - az) // 5))
            pts += [(ax + (bx - ax) * k / n, az + (bz - az) * k / n) for k in range(1, n + 1)]
        d = {'n': len(pts), 'w': w, 'c': c}
        for k, (x, z) in enumerate(pts):
            d[f'x{k}'], d[f'y{k}'], d[f'z{k}'] = rnd(x + 300, 1), rnd(ground(x, z), 2), rnd(z + 250, 1)
        skip.add(s.prop('f-road', (0, 0), dims=d)['id'])
    bed(EL, EP, 17); bed(NL, NP, 14); bed(SL, SP, 13)
    # the muddy braid where carts skirt the pool on its east side
    (_, _), (pdx, pdz) = along(nw, 0.24)
    braid = [(POOL[0] + pdx * u - pdz * 9 * math.sin(math.pi * (u + 22) / 44), POOL[1] + pdz * u + pdx * 9 * math.sin(math.pi * (u + 22) / 44)) for u in range(-22, 23, 4)]
    bed(braid, None, 5, 1)
    def pitch(pos, rot, L):
        """Degrees a strip `L` long at `pos` (cells), its local +x along rotY `rot`, must tilt to lie on the ground."""
        x, z = (pos[0] - CX) * 5, (pos[1] - CZ) * 5; r = math.radians(rot); ux, uz = math.cos(r), -math.sin(r)
        return rnd(math.degrees(math.atan2(ground(x + ux * L / 2, z + uz * L / 2) - ground(x - ux * L / 2, z - uz * L / 2), L)), 1)

    # ------------------------------------------------------------------ the windward slope: stony scrub, rock steps, boulders
    rr = random.Random(77)
    def off_road(x, z, m): return line_dist(P(x, z), nw) > m and line_dist(P(x, z), sw) > m
    for L in LEDGES:                     # each bedded step faced with broken rock, a few fallen blocks below it
        for k, z in enumerate(range(-236, 166, 22)):
            z = z + rr.uniform(-5, 5); x = ledge_x(L, z) - 0.5
            if not off_road(x, z, 3.2) or dens(*P(x, z)) > 0.3 or (z > 120 and x > -150): continue
            w = rr.uniform(6, 11)
            s.prop('crag', P(x, z), rot=rnd(90 + rr.uniform(-25, 25), 1), dims={'w': rnd(w, 1), 'd': rnd(rr.uniform(3, 5), 1), 'h': rnd(rr.uniform(2.6, 3.8), 1), 'seed': 20 + k})
            for m in range(rr.randint(1, 2)):
                bx, bz = x + rr.uniform(3, 9), z + rr.uniform(-6, 6)
                if off_road(bx, bz, 2.4): s.prop('boulder', P(bx, bz), rot=rr.uniform(0, 360), dims={'r': rnd(0.8 + rr.random() * 1.2)})
    for i in range(34):
        x, z = rr.uniform(-298, -100), rr.uniform(-240, 60)
        if not off_road(x, z, 4.5) or ((x + 82) / 34) ** 2 + ((z + 10) / 26) ** 2 < 1: continue
        if i % 3: s.prop('boulder', P(x, z), rot=rr.uniform(0, 360), dims={'r': rnd(1.4 + rr.random() * 2.6)})
        else: s.prop('bush', P(x, z), rot=rr.uniform(0, 360), dims={'scale': rnd(0.6 + rr.random() * 0.5)})
    for i in range(7):
        x, z = rr.uniform(-296, -140), rr.uniform(-236, 50)
        if not off_road(x, z, 5): continue
        s.prop('f-wind-pine', P(x, z), dims={'h': rnd(18 + rr.random() * 12), 'lean': rnd(8 + rr.random() * 6), 'r': rnd(4 + rr.random() * 2)})
    for i in range(14):
        x, z = rr.uniform(-296, -110), rr.uniform(-230, 60)
        if not off_road(x, z, 4): continue
        s.prop('weeds', P(x, z), rot=rr.uniform(0, 360), dims={'n': 4, 'r': 1.6})

    # ------------------------------------------------------------------ the gallows knoll
    skip.add(s.prop('f-rock-shelf', P(*KNOLL), dims={'w': 60, 'd': 44, 'h': 8, 'seed': 2, 'base': 1}, label='Gallows knoll',
           desc='A blunt hump of grey bedrock, flat on top and eight feet above the road at its east face, with thin turf and lichen on its crown. Westward the hillside rises to meet it. The gallows stands on it against the sky.')['id'])
    s.keep.append(([P(KNOLL[0] - 34, KNOLL[1] - 26), P(KNOLL[0] + 34, KNOLL[1] - 26), P(KNOLL[0] + 34, KNOLL[1] + 26), P(KNOLL[0] - 34, KNOLL[1] + 26)], 1.0))
    skip.add(s.prop('gallows', P(*GALLOWS), rot=GROT, dims={'h': 5}, y=8, label='The gallows',
           desc='Old wooden gallows on a rotting platform five feet high, its stairs facing the junction. The beam is worn in a groove where many ropes have run; a frayed rope swings from it and creaks in the wind. Two deck planks have rotted through, and a trapdoor with a rusted bolt sits under the rope.')['id'])
    skip.add(s.prop('f-gallows-junk', P(GALLOWS[0], GALLOWS[1]), dims={'w': 8}, y=8, label='Under the platform',
           desc='Drifted needles, two planks fallen from the deck, a broken short ladder and a coil of old rope gone green.')['id'])
    s.prop('f-knoll-stair', P(-53.5, -8), rot=0, dims={'h': 8, 'run': 14, 'w': 4}, label='Stair down the rock',
           desc='A rickety timber stair descends the knoll\'s east face to the churned ground where the hangman\'s cart turned.')
    s.prop('f-wagon-ruts', P(-31, -2.5), rot=heading(-17, -5), dims={'len': 20, 'w': 5, 'puddles': 0}, y=0.12, label='Cart ruts',
           desc='Two cart ruts, deeper than the road\'s, leave the apron and end in a churned turn-round at the foot of the stair.')
    for x, z, L in ((-56, 0, 8), (-63, 9, 6), (-55.5, -18, 8)): s.prop('f-needle-drift', P(x, z), rot=0, dims={'len': L, 'h': 1.5})   # banked against the knoll's east foot
    skip.add(s.prop('f-needle-drift', P(GALLOWS[0] + 6.2, GALLOWS[1] - 6), rot=0, dims={'len': 8, 'h': 0.9}, y=8)['id'])   # against the deck's east posts
    # the five wind-flagged pines on the knoll's flanks, the only trees that grow near it
    for (x, z), h, lean in (((-95, -55), 38, 13), ((-74, -44), 30, 11), ((-110, 30), 44, 12), ((-80, 45), 27, 14), ((-150, 70), 34, 10)):
        s.prop('f-wind-pine', P(x, z), dims={'h': h, 'lean': lean, 'r': rnd(h * 0.19)}, label='Wind-flagged pine',
               desc='A pine with boughs only on its east side, its trunk leaning away from the wind and bleached bare on the windward face.')
        s.trees.append((P(x, z)[0], P(x, z)[1], 3.0))
    # the two boulders that pinch the forks apart
    s.prop('crag', P(-120, -40), rot=20, dims={'w': 12, 'd': 10, 'h': 8, 'seed': 3}, label='The hearth stone',
           desc='A rounded grey block twelve feet across. Its east side is smeared with soot, and fish bones lie in the ashes of a small fire someone sheltered here out of the wind.')
    s.prop('f-cold-hearth', P(-110, -40), rot=15, dims={'r': 2.2})
    s.prop('f-needle-drift', P(-105.5, -40), rot=0, dims={'len': 10, 'h': 1.4})
    s.prop('crag', P(-100, 22), rot=-160, dims={'w': 15, 'd': 7, 'h': 5, 'seed': 5}, label='The wedge stone',
           desc='A wedge of grey rock fifteen feet long lying along the uphill bank of the climbing road, lichen on its north face.')
    s.prop('f-needle-drift', P(-91.5, 21), rot=0, dims={'len': 7, 'h': 1.1})
    for cx, cz in ((-120, -40), (-100, 22)): s.clear(*P(cx, cz), 4)

    # ------------------------------------------------------------------ the apron and the signpost
    for (x, z), (dx, dz), L, pu in (((14, -8), (0.866, -0.5), 34, 2), ((64, -36), (0.866, -0.5), 40, 2), ((110, -64), (0.85, -0.53), 40, 1),
                                    ((158, -91), (0.88, -0.48), 40, 1), ((205, -116), (0.85, -0.53), 40, 1)):
        s.prop('f-wagon-ruts', P(x, z), rot=heading(dx, dz), dims={'len': L, 'w': 5, 'puddles': pu, 'pitch': pitch(P(x, z), heading(dx, dz), L)}, y=0.12)
    s.prop('fingerpost', P(45, 22), dims={'a0': 60, 'a1': 310, 'a2': 250}, label='Signpost',
           desc='A weathered fingerpost with three arms, its lettering chipped: Barovia Village east, Tser Pool north-west, Ravenloft and Vallaki south-west. Reading it means facing the noose across the road.')
    s.prop('f-needle-drift', P(47.5, 22), rot=0, dims={'len': 4, 'h': 0.8})
    s.prop('weeds', P(52, 30), dims={'n': 4, 'r': 1.6}); s.prop('weeds', P(-6, 34), dims={'n': 3, 'r': 1.3}); s.prop('weeds', P(30, -28), dims={'n': 4, 'r': 1.5})

    # ------------------------------------------------------------------ the north-west fork: ruts, the black pool, the tunnel mouth
    for f in (0.1, 0.36, 0.48, 0.6, 0.72, 0.84):
        (x, z), (dx, dz) = along(nw, f)
        s.prop('f-wagon-ruts', (x, z), rot=heading(dx, dz), dims={'len': 34, 'w': 5, 'puddles': 2 if f > 0.2 else 1, 'pitch': pitch((x, z), heading(dx, dz), 34)}, y=0.12)
    pool = blob(-75, -70, 8, 5, sx=1.5)
    po = s.prop('prism', (0, 0), dims={'h': 0.1, 'color': 0x1f2529, 'y': rnd(ground(*POOL) + 0.24, 2)}); po['pos'] = [0, 0, 0]; po['polygon'] = [FT(x, z) for x, z in pool]; skip.add(po['id'])
    s.prop('weeds', P(-86, -62), dims={'n': 3, 'r': 1.2}); s.prop('weeds', P(-64, -78), dims={'n': 3, 'r': 1.2})
    s.note(P(-75, -62), 'The first dip of the Tser Pool road holds a black standing pool; carts have cut a muddy braid round its east side. Within 120 ft the pines close over the road in a dark tunnel.')

    # ------------------------------------------------------------------ the south-west fork: the climbing shelf, its bank and water-bars
    swdir = (-0.94, 0.34)
    def sw_point(f): return along(sw, f)[0]
    for f0 in (0.15, 0.29, 0.43, 0.57, 0.71, 0.85):
        (x, z), (dx, dz) = along(sw, f0 + 0.07)
        nrm = (-dz, dx)                       # the uphill (north) side of a road heading west-south-west
        hw = 1.4 + 0.9
        bp = (x + nrm[0] * hw, z + nrm[1] * hw)
        s.prop('f-road-bank', bp, rot=heading(dx, dz), dims={'len': 44, 'h': rnd(1.8 + f0 * 1.6), 'pitch': pitch(bp, heading(dx, dz), 44)})
    for i, (x, z) in enumerate(((-70, 32), (-120, 50), (-170, 68), (-220, 85), (-270, 102))):
        s.prop('f-water-bar', P(x, z), rot=facing(0.94, -0.34), dims={'len': 12 + (i % 2) * 2}, label='Water-bar' if i == 0 else None,
               desc='A half-buried log set across the climbing road to shed runoff, a fan of washed gravel below it.' if i == 0 else None)
    for i in range(14):   # the lip of the downhill side: a loose kerb of stones, more of them tumbled down the drop
        (x, z), (dx, dz) = along(sw, 0.1 + i * 0.064)
        nrm = (dz, -dx)
        s.prop('boulder', (x + nrm[0] * 1.6, z + nrm[1] * 1.6), rot=i * 40, dims={'r': rnd(0.9 + (i % 4) * 0.3)})
        if i % 2 and i > 2: s.prop('boulder', (x + nrm[0] * 2.6 + 0.3, z + nrm[1] * 2.6), rot=i * 70, dims={'r': rnd(1.2 + (i % 3) * 0.4)})
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
           'A trampled circle of bare dirt where three roads meet, hoof-churned, with two black puddles standing in the wagon ruts. A cold wind spills off the rising ground on the west side. On a rock knoll above the western forks an old gallows creaks, its frayed rope swinging; across the road a three-armed signpost; behind it, downhill, a low broken wall round a plot of graves lying in fog.',
           'Roll for a random encounter on arrival unless Vistani escort the party (p.35): 18+ on a d20 on a road, then d12+d8 on the day or night table (p.28-29); a Grave result (5 by day, 4 by night) plays as the open grave turned violated. Escorted parties get no roll and are led down the NW fork to the Tser Pool camp (G). The Hanged One appears the moment they leave by any road (see the gallows). East: the stone bridge about 2.4 road-miles (50 min on foot), the village 3.5 road-miles (just over an hour). NW: the Tser Pool camp, 1.7 mi, 35 min, the last half a muddy rutted track. SW: the Tser Falls bridge (H), about 6 road-miles climbing nearly 600 ft, 2 hours.')
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
    s.spawn(P(52, -30))                                                     # where the east road meets the apron, on the level

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
    hang = s.hidden('hanged-figure', P(*ROPE), 'The Hanged One (illusion)', 'A hanged body', rot=GROT + 25, y=13,
              desc='A grey corpse hangs from the rope that was empty a moment ago, turning slowly in the wind until its dead eyes find you.',
              dm='Reveal as the party leaves by any road: a creak behind them. One random character sees themself; the others see a Barovian they do not know. Real to sight and smell; it melts away to nothing if touched or moved (p.35-36). Hide it again afterward.', id='hanged-one')
    skip.add(hang['id'])
    for i, bx in enumerate((-2.0, 1.6)):
        p = turn(bx, 0, GROT)
        skip.add(s.mob('raven', P(GALLOWS[0] + p[0], GALLOWS[1] + p[1]), 'Raven on the beam', 'A raven', rot=GROT + 90 * (i and -1 or 1), y=23.1, size='tiny', id=f'raven-{i + 1}',
                  dm='Set dressing unless the day table gives result 11 (swarms of ravens or a wereraven). A wereraven keeps its distance and shadows the party 1d4 hours (p.32).')['id'])
    look = s.mob('f-vistani', P(GALLOWS[0] + 12, GALLOWS[1] - 3), 'Vistani lookout', 'A seated traveller with a wineskin', rot=facing(1, 0.3), dims={'v': 2}, y=8, id='vistani-lookout',
              dm='Table result 7 by day (1d4+1 Vistani bandits plundering graves, p.32): this one keeps watch from the stairs while three dig. Not hostile unless provoked; they offer to guide for 100 gp, and wolves leave a guided party alone. One of the four carries 2d4 gems worth 50 gp each.')
    skip.add(look['id'])
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

    # ------------------------------------------------------------------ the low ground (-25): the datum the land beyond the map meets
    low = Level('low', 'Low ground (river side)', int(DATUM), 10, ambient=AMB, interior='rubble', exterior='rubble', north='-z')
    low.terrain.append((rect(0, 0, W, H), 'grass'))                      # under everything: the backdrop meets the map at this level
    for L, hw in ((east, 1.8), (nw, 1.5), (sw, 1.4)): low.terrain.append((clamp_poly([(rnd(x), rnd(z)) for x, z in ribbon(L, hw)], W, H), 'dirt'))
    low.room('F-east', 'Lower east road', [P(262, -178), P(300, -194), P(300, -150), P(262, -134)], 'dirt', page=35)
    s.desc['F-east'] = ('The east road where it leaves the map under the pines, twenty-five feet below the junction and still falling toward the river.',
                        'Tokens on the lower east road stand on this level; the ground between here and the junction falls steadily (the junction level is 0 ft, this is -25 ft).')
    links.append(OrderedDict(id='F-east-slope', kind='slide', **{'from': OrderedDict(level='day', pos=[rnd(CX * 5 + 238, 1), rnd(CZ * 5 - 138, 1)]), 'to': OrderedDict(level='low', pos=[rnd(CX * 5 + 270, 1), rnd(CZ * 5 - 158, 1)])}))

    # ------------------------------------------------------------------ everything stands on the land
    for o in s.lv.objects:
        if o['id'] in skip or o['kind'] in ('note', 'spawn'): continue
        o['pos'][1] = rnd(o['pos'][1] + ground(o['pos'][0] - CX * 5, o['pos'][2] - CZ * 5), 2)

    s.write('River Ivlis Crossroads', extra={'stacked': 'open', 'entry': 'day'}, levels=[low, kn, dk], links=links)
    # the low ground is the level that meets the land beyond the map, so it goes first (the backdrop reads the first)
    out = os.path.join(ROOT, 'locations', 'ch02', 'F', 'scene.json')
    scene = json.load(open(out), object_pairs_hook=OrderedDict)
    scene['levels'].sort(key=lambda l: 0 if l['id'] == 'low' else 1)
    json.dump(scene, open(out, 'w'), indent=1, ensure_ascii=False)

if __name__ == '__main__':
    build()
