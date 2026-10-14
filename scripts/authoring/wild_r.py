#!/usr/bin/env python3
"""R. Raven River Crossroads (p.40): the one loud place in Barovia. The Raven River comes through the Notch, a cleft in
a low granite lip at the north edge, and pours down the Raven's Throat, 150 ft of boulder-choked white water with no
pool, to the narrows where a single granite arch crosses between two knobs; below it the stubs of the old timber
bridge stand in the shallows either side of the old cart ford. On the forest bench east of the river five roads meet:
the Old Svalich Road from Vallaki, the bridge road to Krezk, the rutted winery road falling south-west, the gravel
Tsolenka road climbing south and the dirt path north to Van Richten's Tower. A bark-stripped dead beech full of
nests, the rookery, watches all of it.

Map: 620 x 540 ft (124 x 108 cells), x east, z south; brief coordinates are map feet and P() turns them into cells.
Levels, drawn together ('open' stack): the riverbed (-6, the water surface; it carries the scene's ground, so the land
round the map lies at the river's level and the bench is built up as two blocks of earth with the river cut between
them), the crossroads bench (0, where the party arrives), the bridge crown (+10) and the Notch shelves (+12).
Props of this site live in app/src/kit/sites/wild-r.ts (kinds r-*)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wildlib import *  # noqa: F401,F403
from collections import OrderedDict

W, H = 124, 108
WF, HF = W * 5, H * 5
EXT = 300                       # ft the bench is built out past the map edge, so the land beyond never shows a step
GRASS, EARTH, WATER, SHINGLE = 0x3d5241, 0x4f4335, 0x3e5566, 0x4a4b40
DIRT, GRAVEL = 0x66584a, 0x6b675f


def P(x, z): return (x / 5, z / 5)
def unit(dx, dz):
    L = math.hypot(dx, dz) or 1; return (dx / L, dz / L)
def bearing_dir(b):
    r = math.radians(b); return (math.sin(r), -math.cos(r))


def clip_rect(poly, x0, z0, x1, z1):
    """Sutherland-Hodgman: a polygon clipped to an axis-aligned rectangle."""
    def clip(pts, inside_fn, cut):
        out = []
        for i in range(len(pts)):
            a, b = pts[i - 1], pts[i]
            ia, ib = inside_fn(a), inside_fn(b)
            if ib:
                if not ia: out.append(cut(a, b))
                out.append(b)
            elif ia: out.append(cut(a, b))
        return out
    def cx(xv): return lambda a, b: (xv, a[1] + (b[1] - a[1]) * (xv - a[0]) / ((b[0] - a[0]) or 1e-9))
    def cz(zv): return lambda a, b: (a[0] + (b[0] - a[0]) * (zv - a[1]) / ((b[1] - a[1]) or 1e-9), zv)
    pts = list(poly)
    for fn, ct in ((lambda p: p[0] >= x0, cx(x0)), (lambda p: p[0] <= x1, cx(x1)), (lambda p: p[1] >= z0, cz(z0)), (lambda p: p[1] <= z1, cz(z1))):
        pts = clip(pts, fn, ct)
        if not pts: break
    return [(rnd(x), rnd(z)) for x, z in pts]


# ================================================================== the river
RIVER = [(338, -340), (336, -160), (335, -40), (335, 0), (330, 40), (321, 80), (309, 118), (297, 152), (285, 190), (271, 235),
         (255, 280), (238, 315), (208, 343), (160, 362), (100, 376), (45, 385), (0, 390),
         # beyond the west edge, on the built-out bench: the river swings south and runs into the region map's own
         # Raven River (world.json: (2.63, 4.09) to (2.27, 4.69), a straight line SSW from under the map) where it
         # leaves the skirt's south side, so the map's water and the backdrop's are one river
         (-50, 398), (-98, 425), (-126, 478), (-130, 545), (-112, 620), (-84, 682), (-60, 730), (-47, 770), (-49, 802), (-58, 830), (-82, 870), (-118, 930)]
FORD = (255, 280)


def water_hw(x, z):
    """Half-width of the water (ft): 40 ft through the Notch, 30 at the narrows, 45 at the piles."""
    if z <= 0: return 20.0
    if x < 0: return max(20.0, 24 - max(0.0, z - 400) / 100)               # off the map: narrowing to the backdrop's 40 ft
    if z <= 152 and x >= 290: return 20 - 5 * z / 152
    if z <= 280: return 15 + 7.5 * (z - 152) / 128
    return 22.5 + min(1.5, (z - 280) / 100)


def build():
    s = Site('R', 'Raven River Crossroads', W, H, 7717)
    river_lv = s.lv
    river_lv.id, river_lv.name, river_lv.elevation, river_lv.ceiling = 'river', 'Riverbed, piles and ford', -6, 6
    bench = Level('bench', 'Crossroads bench', 0, 10, ambient=AMB, interior='rubble', exterior='rubble', north='-z')
    bridge_lv = Level('bridge', 'Bridge deck', 10, 8, ambient=AMB, interior='rubble', exterior='rubble', north='-z')
    notch_lv = Level('notch', 'The Notch shelves', 12, 8, ambient=AMB, interior='rubble', exterior='rubble', north='-z')
    def on(lv): s.lv = lv
    def fog(pos, rot, dims, label, y=0):
        o = s.prop('r-fog', pos, rot=rot, dims=dims, y=y, label=label); o['vis'] = 'explored'
        return o

    # ------------------------------------------------------------------ river geometry (feet)
    line_ft = catmull(RIVER, 8)
    seg = [0.0]
    for i in range(1, len(line_ft)): seg.append(seg[-1] + math.hypot(line_ft[i][0] - line_ft[i - 1][0], line_ft[i][1] - line_ft[i - 1][1]))
    s_ford = min(range(len(line_ft)), key=lambda i: math.hypot(line_ft[i][0] - FORD[0], line_ft[i][1] - FORD[1]))
    s_ford = seg[s_ford]
    nrm = wildlib_normals(line_ft)
    def margin(i):
        x, z = line_ft[i]
        m = 0 if z < 150 else min(4.0, (z - 150) / 10)
        d = abs(seg[i] - s_ford)                                           # the ford's ramps are notched into both banks
        bump = 1.0 if d < 7 else max(0.0, 1 - (d - 7) / 5)
        return m + 21 * bump
    hw = [water_hw(*p) for p in line_ft]
    hwc = [hw[i] + margin(i) for i in range(len(line_ft))]
    def off(widths, side):
        return [(x + nx * w * side, z + nz * w * side) for (x, z), (nx, nz), w in zip(line_ft, nrm, widths)]
    edge_nw, edge_se = off(hwc, 1), off(hwc, -1)                         # +normal is the north-west bank
    water_l, water_r = off(hw, 1), off(hw, -1)
    E = EXT
    SK = (-E - 40, -E - 40, WF + E, HF + E)                                # the built-out bench (the skirt) round the map
    nw_ext = edge_nw + [(-E - 40, HF + E + 120), (-E - 40, -E - 40)]       # west of the river: the Krezk side and the south-west corner
    se_ext = edge_se + [(WF + E, HF + E + 120), (WF + E, -E - 40)]
    nw_map, se_map = clip_rect(nw_ext, 0, 0, WF, HF), clip_rect(se_ext, 0, 0, WF, HF)
    channel_ft = edge_nw + edge_se[::-1]
    water_ft = water_l + water_r[::-1]
    channel_map = clip_rect(channel_ft, 0, 0, WF, HF)
    water_map = clip_rect(water_ft, 0, 0, WF, HF)
    cells = lambda poly: [(rnd(x / 5, 3), rnd(z / 5, 3)) for x, z in poly]
    def river_at(z):
        """Centre x of the river and its local flow direction at map z (for the reach above the ford)."""
        best = min(range(len(line_ft) - 1), key=lambda i: abs(line_ft[i][1] - z) if line_ft[i][1] <= 290 else 1e9)
        a, b = line_ft[best], line_ft[best + 1]
        return a[0], unit(b[0] - a[0], b[1] - a[1])

    # ------------------------------------------------------------------ the riverbed level: water, shingle, the bench's body
    on(river_lv)
    s.walk = [cells(channel_map)]
    for side in (1, -1):                                                   # wet shingle and mud between water and bank
        band_ft = off(hw, side) + off(hwc, side)[::-1]
        s.patch(cells(clip_rect(band_ft, 0, 0, WF, HF)), 'marsh')
    s.patch(cells(water_map), 'shallow-water')
    def prism(lv, poly_ft, h, y, color, key=None, id=None):
        lv.prop(id or s.uid('bank'), 'prism', P(310, 520), key, dims={'h': h, 'y': y, 'color': color})
        o = lv.objects[-1]; o['pos'] = [0, 0, 0]; o['polygon'] = [[rnd(x, 1), rnd(z, 1)] for x, z in poly_ft]
        return o
    # the bench itself: earth from the land's level (-6.4) to just under the turf, then a turf lip; built out past the
    # edges so the river cut runs on into the haze
    for poly in (nw_ext, se_ext):
        poly = clip_rect(poly, *SK)
        prism(river_lv, poly, 5.2, -0.4, EARTH)
        prism(river_lv, poly, 0.9, 4.8, GRASS)
    # the river beyond the map: shingle on the floor of the cut and water in it as far as the bench is built out.
    # North of the map it is one reach. West of it the water is laid in six reaches, each a few inches higher and a
    # shade lighter than the last, so that where it leaves the skirt it stands just over the region map's own river
    # ribbon (whose land rises south of the map to about 3.5 ft under the bench) and matches its colour.
    for x0, z0, x1, z1 in ((SK[0], SK[1], SK[2], 0),):
        prism(river_lv, clip_rect(channel_ft, x0, z0, x1, z1), 0.5, -0.7, SHINGLE)
        prism(river_lv, clip_rect(water_ft, x0, z0, x1, z1), 0.55, -0.5, WATER)
    west = [i for i, (x, z) in enumerate(line_ft) if x < 0 and z > 0]
    i_a, i_b = west[0] - 1, west[-1]
    NSEG = 6
    cuts = [i_a + round((i_b - i_a) * k / NSEG) for k in range(NSEG + 1)]
    lerp = lambda a, b, f: sum(int(((a >> sh) & 255) + (((b >> sh) & 255) - ((a >> sh) & 255)) * f) << sh for sh in (16, 8, 0))
    for k in range(NSEG):
        a, b = cuts[k], cuts[k + 1]
        f = k / (NSEG - 1); top = 3.2 * f                                   # ft above the map's water
        ch = edge_nw[a:b + 1] + edge_se[a:b + 1][::-1]
        wa = water_l[a:b + 1] + water_r[a:b + 1][::-1]
        prism(river_lv, clip_rect(ch, SK[0], 0, 0, SK[3]), 0.5, top - 0.7, lerp(SHINGLE, 0x5a5d52, f))
        prism(river_lv, clip_rect(wa, SK[0], 0, 0, SK[3]), 0.55, top - 0.5, lerp(0x4b5c6b, 0x5c7b92, f))

    # ------------------------------------------------------------------ the bridge (on the riverbed level, standing up through the bench)
    BC = (297, 153)                                                        # the crossing: the narrows under the arch
    AX = bearing_dir(290)                                                  # the span's axis, east abutment to west
    HALF = 35
    e_end = (BC[0] - AX[0] * HALF, BC[1] - AX[1] * HALF)                   # (330, 165)
    w_end = (BC[0] + AX[0] * HALF, BC[1] + AX[1] * HALF)                   # (264, 141)
    perp = (-AX[1], AX[0])                                                 # local +z of the bridge
    brot = heading(*AX)
    lz = turn(0, 1, brot)
    moss = 1 if lz[1] < 0 else -1                                          # moss on the upstream (north) face
    s.prop('r-arch-bridge', P(*BC), rot=brot, y=6, dims={'len': 70, 'w': 15, 'crown': 9.85, 'end': 1.5, 'flat': 22, 'span': 34, 'spring': -2.5, 'base': -8, 'moss': moss},
           label='Arching stone bridge', desc='A single granite arch over the narrows, humped ten feet above the road, its parapets wet with spray and lined with ravens. A worn raven is carved on the keystone of both faces; moss hangs on the upstream side.')
    # the Throat: two runs of white water down to the arch, a 10-ft fall from the Notch with no pool anywhere
    for (a, b, ya, yb, wdt) in (((336, -60), (330, 62), 7.5, 0.0, 48), ((331, 56), (300, 147), 0.4, -6.0, 44)):
        dx, dz = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dz)
        s.prop('r-throat-rapids', P((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), rot=facing(dx, dz), y=yb + 6, dims={'len': rnd(L + 4, 1), 'w': wdt, 'drop': rnd(ya - yb, 2), 'seed': 3 if ya > 1 else 7},
               label='The Raven\'s Throat' if ya > 1 else None,
               desc='White water roaring down a staircase of car-sized granite blocks between the Notch shelves, ten feet of fall in a hundred and fifty with no pool at its foot: standing waves run on under the arch. It never goes quiet.' if ya > 1 else None)
    # the old timber bridge's stubs and the ford between them, square to the flow
    fi = min(range(len(line_ft)), key=lambda i: math.hypot(line_ft[i][0] - FORD[0], line_ft[i][1] - FORD[1]))
    fn = nrm[fi]                                                           # points north-west across the river
    s.prop('r-old-piles', P(*FORD), rot=heading(*fn), dims={'len': 48, 'gap': 15, 'n': 7},
           label='Old piles and the ford', desc='Two rows of blackened timber stubs stand out of the shallows, all that is left of the wooden bridge the stone arch replaced; between them a pale gravel bar where carts used to ford, about two feet deep.')
    whf = water_hw(*FORD)
    for side in (1, -1):                                                   # the ramps worn down both banks to the ford
        top = (FORD[0] + fn[0] * side * (whf + 24), FORD[1] + fn[1] * side * (whf + 24))
        s.prop('r-ford-ramp', P(*top), rot=heading(-fn[0] * side, -fn[1] * side), y=6, dims={'len': 25, 'w': 12, 'h': 6})
    # boulders and reeds along the water's edge below the arch, wet stones in the Throat's banks
    rr = random.Random(41)
    for i in range(34):
        k = rr.randrange(10, len(line_ft) - 10)
        x, z = line_ft[k]
        if z < 120 or not (0 < x < WF and 0 < z < HF) or abs(seg[k] - s_ford) < 16: continue
        side = rr.choice((1, -1)); w = hw[k] + rr.uniform(-1.5, 2.5)
        p = (x + nrm[k][0] * w * side, z + nrm[k][1] * w * side)
        if math.hypot(p[0] - BC[0], p[1] - BC[1]) < 30: continue
        if i % 3 == 0 and z > 220: s.prop('reeds', P(*p), dims={'r': rnd(1.4 + rr.random() * 1.2), 'n': 8})
        else: s.prop('boulder', P(*p), rot=rr.uniform(0, 360), dims={'r': rnd(1.3 + rr.random() * 2.2)})
    fog(P(296, 162), heading(*fn), {'len': 60, 'h': 4, 'd': 26, 'seed': 2}, 'Spray under the arch')
    fog(P(150, 366), heading(-1, 0.2), {'len': 150, 'h': 3, 'd': 30, 'seed': 5}, 'The river steaming')
    s.room('R-throat', 'The Raven\'s Throat', cells(clip_rect(channel_ft, 0, 0, WF, 146)), 'shallow-water',
           'A chute of white water between granite walls, boulders the size of carts breaking it into a staircase of foam; spray hangs over every ledge and the roar is everywhere.',
           'Anyone falling or swept in here takes 2d6 bludgeoning per round among the blocks and is carried 30 ft a round toward the arch; climbing out onto a block or the wall is DC 15 Athletics. No pool: the force does not slacken under the bridge.', difficult=True)
    ford_poly = cells([(FORD[0] + fn[0] * a - fn[1] * b, FORD[1] + fn[1] * a + fn[0] * b) for a, b in ((-whf, -9), (whf, -9), (whf, 9), (-whf, 9))])
    s.room('R-ford', 'The old ford', ford_poly, 'shallow-water',
           'A gravel bar under fast, cold water about two feet deep, between two rows of blackened pile stubs. Mud on both banks is churned with tracks.',
           'Wading is difficult terrain: DC 10 Strength (Athletics) per 10 ft or be swept 10 ft downstream and knocked prone. Off the bar the river is 3-6 ft deep and swimming is DC 13. A DC 12 Survival check on the west-bank mud reads wolf prints and bare human feet together, heading north-west up the old track toward the den west of Lake Baratok (p.32, p.201).', difficult=True)

    # ------------------------------------------------------------------ the crossroads bench
    on(bench)
    bench.terrain.append((cells(nw_map), 'grass'))
    bench.terrain.append((cells(se_map), 'grass'))
    s.keep.append(([P(x, z) for x, z in channel_ft], 1.2))
    J = (350, 292)                                                         # the signpost junction
    EJ = (470, 300)                                                        # the east junction
    # the roads (feet -> cells)
    def road(ctrl, hw_ft, floor='dirt', **kw): return s.road([P(*c) for c in ctrl], hw_ft / 5, floor, **kw)
    vallaki = road([J, (385, 297), (425, 299), EJ, (530, 303), (580, 306), (626, 310)], 8)
    to_bridge = road([J, (342, 262), (335, 232), (330, 205), (331, 184), (e_end[0] + 3, e_end[1] + 4)], 7)
    krezk = road([w_end, (w_end[0] + AX[0] * 25, w_end[1] + AX[1] * 25), (w_end[0] + AX[0] * 50, w_end[1] + AX[1] * 50), (186, 112), (120, 105), (60, 104), (-6, 105)], 7)
    winery = road([J, (334, 308), (312, 330), (290, 360), (268, 392), (250, 420)], 6)
    winery_trail = road([(252, 417), (228, 448), (200, 478), (170, 508), (138, 546)], 3.5)
    tsolenka = road([EJ, (476, 330), (484, 368), (492, 405), (500, 450), (508, 500), (516, 546)], 6)
    def gravel_on(line, hw_ft, start, every, rime_near=None):
        """Gravel strips laid along a road (the floor stays dirt, the gravel is its own grey bed and stones)."""
        L = sum(math.hypot(line[i + 1][0] - line[i][0], line[i + 1][1] - line[i][1]) for i in range(len(line) - 1)) * 5
        k = 0; f = start
        while f < 1:
            (x, z), (dx, dz) = along(line, f)
            if 0.5 < x < W - 0.5 and 0.5 < z < H - 0.5:
                rime = 1 if rime_near and math.hypot(x * 5 - rime_near[0], z * 5 - rime_near[1]) < 22 else 0
                s.prop('r-gravel', (x, z), rot=heading(dx, dz), dims={'len': every + 3, 'w': rnd(hw_ft * 2 - 1, 1), 'seed': k + 3, 'rime': rime})
            k += 1; f += every / L
    gravel_on(tsolenka, 6, 0.02, 18, rime_near=(489, 398))
    gravel_on(winery_trail, 3.5, 0.03, 18)
    tower = road([(455, 300), (459, 278), (463, 250), (472, 210), (487, 150), (503, 90), (515, 40), (528, -6)], 3)
    ford_e = (FORD[0] + fn[0] * -(whf + 24), FORD[1] + fn[1] * -(whf + 24))
    ford_w = (FORD[0] + fn[0] * (whf + 24), FORD[1] + fn[1] * (whf + 24))
    old_e = road([ford_e, (312, 305), (334, 308)], 2.5)                    # the old way down to the ford, grassing over
    old_w = road([ford_w, (192, 236), (172, 196), (156, 152), (142, 112)], 2.5)
    s.patch(blob(*P(*J), 5.2, 6, sx=1.15), 'dirt')
    s.patch(blob(*P(*EJ), 3.6, 9, sx=1.2), 'dirt')
    s.clear(*P(*J), 3); s.clear(*P(*EJ), 3)

    # ---- the roads carried across the skirt to the region map's own roads. The backdrop starts each world road
    # through this site at the far end of a road on the scene's first outdoor level (the riverbed here) in that road's
    # direction, so a short dirt stub under the bench marks where the Krezk, Vallaki and Tsolenka roads leave the map;
    # on the skirt each road then runs on the backdrop's line to where the backdrop's own ribbon comes out from under it.
    # The winery trail and the tower path have no road on the region map: they run out to the skirt's edge and stop.
    world = json.load(open(os.path.join(ROOT, 'locations', 'ch02', 'barovia-region', 'world.json')))
    pin = next(q['pos'] for q in world['pins'] if q['key'] == 'R')
    CX, CZ, RAD = WF / 2, HF / 2, math.hypot(WF, HF) / 2                    # the backdrop's centre and radius (the map rectangle)
    ft = lambda line: [(x * 5, z * 5) for x, z in line]
    def stub(line, hw_ft):
        pts = ft(line)
        while len(pts) > 2 and math.hypot(pts[1][0] - pts[-1][0], pts[1][1] - pts[-1][1]) > 30: pts = pts[1:]
        return clip_rect(ribbon(pts, hw_ft), 0, 0, WF, HF)
    exits = []                                                             # (line ft, hw, clip rect beyond the map edge, colour)
    for line, hw_ft, beyond, col in ((krezk, 7, (SK[0], SK[1], 0, SK[3]), DIRT), (vallaki, 8, (WF, SK[1], SK[2], SK[3]), DIRT),
                                     (tsolenka, 6, (SK[0], HF, SK[2], SK[3]), GRAVEL)):
        st = stub(line, hw_ft)
        river_lv.terrain.append((cells(st), 'dirt'))
        exits.append((ft(line), hw_ft, beyond, col, st))
    def exit_for(b):
        ux, uz = math.cos(b), math.sin(b)
        best = max(exits, key=lambda e: max((x - CX) * ux + (z - CZ) * uz for x, z in e[4]))
        mx = max((x - CX) * ux + (z - CZ) * uz for x, z in best[4])
        far = [q for q in best[4] if (q[0] - CX) * ux + (q[1] - CZ) * uz > mx - 6]
        return best, (sum(q[0] for q in far) / len(far), sum(q[1] for q in far) / len(far))
    done = set()
    for wr in world['roads']:
        ds = [math.hypot(q[0] - pin[0], q[1] - pin[1]) * 5280 for q in wr['pts']]
        near = ds.index(min(ds))
        if ds[near] > 0.5 * 5280: continue
        for half in (wr['pts'][:near + 1][::-1], wr['pts'][near:]):
            out = [(CX + (q[0] - pin[0]) * 5280, CZ + (q[1] - pin[1]) * 5280) for q in half]
            out = [q for q in out if RAD + 150 < math.hypot(q[0] - CX, q[1] - CZ) < 70000]
            if not out: continue
            (line, hw_ft, beyond, col, _), e = exit_for(math.atan2(out[0][1] - CZ, out[0][0] - CX))
            key = (rnd(e[0]), rnd(e[1]), rnd(out[0][0]), rnd(out[0][1]))
            if key in done: continue
            done.add(key)
            u = unit(out[0][0] - e[0], out[0][1] - e[1])
            k = max(i for i in range(len(line)) if math.hypot(line[i][0] - line[-1][0], line[i][1] - line[-1][1]) > 25)
            ctrl = [line[k], e] + [(e[0] + u[0] * d, e[1] + u[1] * d) for d in (60, 140, 240, 340, 440, 560)]
            sk = catmull(ctrl, 6)
            # three lengths, each a shade nearer the region map's road colour where it comes out from under the skirt
            out_i = [i for i, q in enumerate(sk) if not (0 <= q[0] <= WF and 0 <= q[1] <= HF)]
            i0 = max(0, out_i[0] - 1); n3 = (len(sk) - i0) // 3
            for m in range(3):
                sub = sk[i0 + m * n3: (i0 + (m + 1) * n3 + 1) if m < 2 else len(sk)]
                poly = clip_rect(ribbon(sub, hw_ft + (8 - hw_ft) * min(1, (m + 0.5) / 2.5)), *beyond)
                if len(poly) >= 3: prism(river_lv, poly, 0.12, 5.7, lerp(col, 0x786a58 if col == DIRT else 0x7a7468, (m + 1) / 3))
    for line, hw_ft, beyond, n_out in ((winery_trail, 3.5, (SK[0], HF, SK[2], SK[3]), [(118, 600), (98, 680), (84, 760), (76, 860)]),
                                       (tower, 3, (SK[0], SK[1], SK[2], 0), [(544, -60), (566, -140), (592, -230), (618, -360)])):
        lf = ft(line)
        sk = catmull([lf[-3], lf[-1]] + n_out, 6)
        poly = clip_rect(ribbon(sk, lambda f, h=hw_ft: h * (1 - 0.35 * f)), *beyond)
        if len(poly) >= 3: prism(river_lv, poly, 0.1, 5.7, DIRT)

    # ---- the signpost and the junction
    SP = (358, 280)
    s.prop('r-signpost', P(*SP), dims={'a0': 345, 'a1': 100, 'a2': 220, 'lean': 4}, label='Signpost',
           desc='A weatherworn grey-oak fingerpost leaning a little, its cap white with raven droppings and black feathers jammed in its cracks. Krezk points north to the bridge seen through the pines; Vallaki east, up a gentle rise; The Wizard of Wines south-west, gently downhill.')
    s.scatter('weeds', 12, lambda x, z: 1.0 if 22 < math.hypot(x * 5 - J[0] - 20, z * 5 - J[1] + 5) < 70 else 0.0, margin=0.4, gap=1.4, dims={'n': 4, 'r': 1.5}, circles=False)
    # ---- the turnout, the trough, the hitching rail and the leat that feeds it
    s.prop('r-wagon-turnout', P(382, 332), rot=4, dims={'w': 60, 'd': 40}, label='Wagon turnout',
           desc='A hard standing of crushed granite where the wine wagon turns and waits, two sets of wheel ruts arcing through it and hoof-churned mud at its trough end.')
    TR = (362, 318)
    s.prop('r-stone-trough', P(*TR), rot=180, dims={'len': 10}, label='Stone trough and hitching rail',
           desc='A long stone watering trough green with slime, fed by a stone spout from a runnel; a hitching rail of two posts and a bar stands between it and the road, the mud round it churned by hooves.')
    leat_pts = [(372, 101), (375, 140), (371, 180), (368, 215), (369, 250), (371, 278), (372, 300), (371.5, 312)]
    for i in range(len(leat_pts) - 1):
        a, b = leat_pts[i], leat_pts[i + 1]
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        s.prop('r-leat', P((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), rot=heading(b[0] - a[0], b[1] - a[1]), dims={'len': rnd(L + 1.5, 1), 'culvert': 1 if i == 5 else 0},
               label='Runnel' if i == 0 else None, desc='A stone-lined runnel two feet wide, cut from the river where it comes over the Notch, carries water down the bench to the trough; a granite slab bridges it where the road crosses.' if i == 0 else None)
    s.keep.append(([P(x, z) for x, z in ribbon(leat_pts, 4)], 0))
    # ---- the rookery, the hollow log, the raven stones and the pine screen
    RK = (385, 215)
    s.prop('r-rookery-tree', P(*RK), rot=20, dims={'h': 60, 'seed': 5}, label='The rookery',
           desc='A dead beech sixty feet tall, its bark stripped to silver-grey wood and its top snapped off, two dozen stick nests crowded in its forks and ravens watching from every limb. The ground beneath is white with droppings and crunches with small bones.')
    s.clear(*P(*RK), 6.5)
    s.prop('r-hollow-log', P(409, 238), rot=heading(1, 0.35), dims={'len': 14, 'r': 1.4}, label='Hollow log',
           desc='A fallen beech trunk, hollow and rotten, lying half under the rookery\'s limbs with its open end toward the road.')
    for i, ((x, z), r) in enumerate((((360, 240), 4.6), ((356, 228), 3.0), ((351, 217), 3.6), ((347, 206), 2.6), ((344, 194), 3.1))):
        s.prop('r-raven-stone', P(x, z), rot=i * 47, dims={'r': r, 'seed': i + 2}, label='Raven stones' if i == 0 else None,
               desc='A line of five bank boulders under the ravens\' flight from the rookery to the bridge, every top capped white; the biggest is a favourite perch.' if i == 0 else None)
        s.trees.append((P(x, z)[0], P(x, z)[1], 1.6))
    s.prop('r-raven-perch', P(360, 240), dims={'n': 4, 'spread': 1.8, 'y': 8.0, 'wing': 1, 'seed': 3})
    s.prop('r-raven-perch', P(351, 217), dims={'n': 2, 'spread': 1.2, 'y': 6.3, 'seed': 7})
    band = unit(2, 1)
    for (cx, cz), n, L in (((316, 230), 3, 18), ((356, 250), 4, 20), ((389, 268), 5, 26)):
        s.prop('r-pine-screen', P(cx, cz), rot=heading(*band), dims={'n': n, 'len': L, 'h': 56, 'seed': n * 3 + int(cx)},
               label='Pine screen' if n == 4 else None, desc='Tall pines with straight bare trunks; from the signpost the bridge\'s arch shows between them.' if n == 4 else None)
        s.keep.append(([P(cx - band[0] * (L / 2 + 6) - 6 * band[1], cz - band[1] * (L / 2 + 6) + 6 * band[0]), P(cx + band[0] * (L / 2 + 6) - 6 * band[1], cz + band[1] * (L / 2 + 6) + 6 * band[0]),
                        P(cx + band[0] * (L / 2 + 6) + 6 * band[1], cz + band[1] * (L / 2 + 6) - 6 * band[0]), P(cx - band[0] * (L / 2 + 6) + 6 * band[1], cz - band[1] * (L / 2 + 6) - 6 * band[0])], 0))

    # ---- the knobs, the bollards, the rock ramp
    WK = (w_end[0] + AX[0] * 16, w_end[1] + AX[1] * 16)                    # the west knob, sliced by the road ramp
    s.prop('r-rock-knob', P(*WK), rot=brot, dims={'r': 46, 'len': 76, 'h': 8, 'drop': 7, 'cut': 16, 'seed': 4}, label='West knob and the rock ramp',
           desc='A rounded granite outcrop carrying the bridge\'s west end, sliced through by a pick-cut road ramp eight feet deep, its walls raked with old tool marks.')
    EK = (325, 146)
    s.prop('r-rock-knob', P(*EK), dims={'r': 24, 'h': 8, 'drop': 7, 'cairn': 1, 'seed': 9}, label='East knob',
           desc='A rounded granite outcrop shouldering the bridge\'s east end and pinching the river against the arch; a small cairn of flat stones stands on its crown.')
    s.prop('r-rock-knob', P(321, 181), dims={'r': 12, 'h': 3, 'drop': 7, 'seed': 13})
    for p in (WK, EK, (321, 181)): s.keep.append(([P(p[0] - 22, p[1] - 22), P(p[0] + 22, p[1] - 22), P(p[0] + 22, p[1] + 22), P(p[0] - 22, p[1] + 22)], 0.5))
    s.keep.append(([P(*w_end), P(*e_end), P(e_end[0], e_end[1] + 1), P(w_end[0], w_end[1] + 1)], 2.5))
    for k, (end, out) in enumerate(((e_end, -1), (w_end, 1))):
        for side in (1, -1):
            off_w = 6.6 if out > 0 else 8.4
            bp = (end[0] + AX[0] * out * 3 + perp[0] * side * off_w, end[1] + AX[1] * out * 3 + perp[1] * side * off_w)
            s.prop('r-bridge-bollard', P(*bp), rot=facing(-perp[0] * side, -perp[1] * side), label='Bridge bollard' if k == 0 and side == 1 else None,
                   desc='A squat granite post with an iron ring, polished by ropes and hooves where wagons are steadied before the hump of the bridge.' if k == 0 and side == 1 else None)
            if (k + side) % 2: s.prop('r-raven-perch', P(*bp), dims={'n': 1, 'y': 3.1, 'seed': k * 2 + side + 4})
    s.prop('r-raven-perch', P(*EK), dims={'n': 2, 'spread': 1.0, 'y': 10.2, 'seed': 31})

    # ---- the Notch shelves (+12) and the lake fog pouring over them
    shelves = {}
    for name, a, b, wdt, f, sd in (('west', (323, -60), (302, 96), 72, 1, 2), ('east', (360, -60), (334, 98), 80, -1, 6)):
        dx, dz = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dz); rot = facing(dx, dz); u = unit(dx, dz)
        lx = turn(1, 0, rot)                                               # local +x in plan
        c = ((a[0] + b[0]) / 2 - lx[0] * f * wdt / 2, (a[1] + b[1]) / 2 - lx[1] * f * wdt / 2)
        shelves[name] = (c, rot, wdt, L, f, u, lx)
        s.prop('r-rock-shelf', P(*c), rot=rot, dims={'w': wdt, 'd': rnd(L, 1), 'h': 12, 'drop': 7, 'face': f, 'ledge': 1 if name == 'east' else 0, 'seed': sd},
               label='The Notch' if name == 'east' else None,
               desc='Two wet granite shelves twelve feet high flank the river where it comes through a cleft in the low lip north of the crossroads; lake fog slides over them in slow sheets. A worn ledge path runs along the top of the eastern one.' if name == 'east' else None)
        foot = [(c[0] + lx[0] * f * wdt / 2 * kx + u[0] * L / 2 * kz, c[1] + lx[1] * f * wdt / 2 * kx + u[1] * L / 2 * kz) for kx, kz in ((1.05, -1.05), (1.05, 1.05), (-1.1, 1.08), (-1.1, -1.05))]
        s.keep.append(([P(*p) for p in foot], 1.0))
    def shelf_pt(name, ax, az):
        """A point on a shelf: ax across (-1 landward .. +1 at the river face), az along (-1 north .. +1 south)."""
        c, rot, wdt, L, f, u, lx = shelves[name]
        return (c[0] + lx[0] * f * wdt / 2 * ax + u[0] * L / 2 * az, c[1] + lx[1] * f * wdt / 2 * ax + u[1] * L / 2 * az)
    def shelf_local(name, x, z):
        c, _, _, _, _, u, lx = shelves[name]
        return (c[0] + lx[0] * x + u[0] * z, c[1] + lx[1] * x + u[1] * z)
    def shelf_outline(name):
        # Match the widest physical base of r-rock-shelf in wild-r.ts.
        _, _, wdt, length, face, _, _ = shelves[name]
        length = rnd(length, 1)  # The renderer consumes the exported dimension.
        seed = 6 if name == 'east' else 2
        def hash_(i, s):
            x = math.sin(i * 127.1 + s * 311.7 + 0.5) * 43758.5453
            return x - math.floor(x)
        ring = [(face * wdt / 2 + face * (hash_(i, seed) - 0.5) * 0.6,
                 -length / 2 + i / 14 * length) for i in range(15)]
        back = [(face * wdt / 2 - face * math.sin(i / 10 * math.pi) * wdt * (0.85 + 0.2 * hash_(i, seed + 3)),
                 length / 2 * math.cos(i / 10 * math.pi) * (0.92 + 0.08 * hash_(i, seed + 5))) for i in range(1, 10)]
        return ring + back
    def shelf_crown(name):
        # The crown contracts inside the base on the landward side; a point
        # outside this crown can still be buried in the sloped rock body.
        outline = shelf_outline(name)
        face = shelves[name][4]
        cx = sum(p[0] for p in outline) / len(outline)
        cz = sum(p[1] for p in outline) / len(outline)
        return [(x - face * 0.4, z) if i < 15 else (cx + (x - cx) * 0.76, cz + (z - cz) * 0.82)
                for i, (x, z) in enumerate(outline)]

    # Register east access to the actual five cut steps, whose top is +12 ft.
    _, _, ew, el, ef, _, _ = shelves['east']
    el = rnd(el, 1)
    ex = ef * (ew / 2 - 4.5)
    east_landing = [shelf_local('east', x, z) for x, z in
                    ((ex - 2, el / 2 - 10), (ex + 2, el / 2 - 10),
                     (ex + 2, el / 2 - 0.8), (ex - 2, el / 2 - 0.8))]
    # A stone cap joins the full-height tread to the crown, not an invisible floor.
    s.prop('prism', P(0, 0), dims={'h': 12, 'color': 0x737980}, id='ledge-head')
    s.lv.objects[-1]['polygon'] = [[rnd(x, 3), rnd(z, 3)] for x, z in east_landing]
    steps_top = shelf_local('east', ex, el / 2 - 8)
    steps_foot = shelf_local('east', ex, el / 2 + 9.5)
    # The west scramble crosses the whole sloped body: the head is three feet
    # inside its crown, and the foot four feet beyond its wider physical base.
    # It rises twelve feet as an authored rock climb, not a stair flight.
    west_crown = shelf_crown('west')
    a, b = west_crown[16], west_crown[17]
    mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    centre = (sum(p[0] for p in west_crown) / len(west_crown), sum(p[1] for p in west_crown) / len(west_crown))
    inward = unit(centre[0] - mid[0], centre[1] - mid[1])
    wshelf_top = shelf_local('west', mid[0] + inward[0] * 3, mid[1] + inward[1] * 3)
    base = shelf_outline('west')
    base_mid = ((base[16][0] + base[17][0]) / 2, (base[16][1] + base[17][1]) / 2)
    wshelf_foot = shelf_local('west', base_mid[0] - inward[0] * 4, base_mid[1] - inward[1] * 4)
    for name, pts in (('east', ((0.1, -0.2), (-0.35, 0.3), (-0.5, -0.55))), ('west', ((-0.3, 0.1), (-0.45, -0.45)))):
        for i, (ax, az) in enumerate(pts):
            p = shelf_pt(name, ax, az)
            if p[1] < 3: continue
            s.prop('pine', P(*p), rot=i * 77, y=12, dims={'h': 26, 'r': 6, 'scale': rnd(0.7 + 0.12 * i)})
    rs = random.Random(5)
    for name, n_b in (('east', 9), ('west', 7)):                           # loose blocks and scrub on the shelf tops
        for i in range(n_b):
            ax, az = rs.uniform(-0.3, 0.75), rs.uniform(-0.75, 0.7)
            p = shelf_pt(name, ax, az)
            if p[1] < 3: continue
            if i % 3 == 0: s.prop('bush', P(*p), rot=rs.uniform(0, 360), y=12, dims={'scale': rnd(0.5 + rs.random() * 0.4)})
            else: s.prop('boulder', P(*p), rot=rs.uniform(0, 360), y=12, dims={'r': rnd(1.0 + rs.random() * 1.6)})
    on(river_lv); fog(P(336, 10), 0, {'len': 200, 'h': 8, 'd': 50, 'seed': 9}, 'Lake fog', y=6); on(bench)
    fog(P(288, 26), -12, {'len': 64, 'h': 3, 'd': 30, 'seed': 11}, None, y=12)
    fog(P(394, 34), 10, {'len': 76, 'h': 3, 'd': 36, 'seed': 13}, None, y=12)

    # ---- the east junction: league stone, the Tsolenka road head, the tower path, the corpse
    s.prop('r-league-stone', P(479, 313), rot=180, label='League stone',
           desc='A squat, waist-high milestone of the old roads, its numerals worn shallow and a sun sigil cut above them; lichen hides half of it. It marks the branch to the pass.')
    s.prop('r-raven-perch', P(479, 313), dims={'n': 1, 'y': 3.4, 'seed': 12})
    s.prop('crag', P(470, 386), rot=15, dims={'w': 15, 'd': 9, 'h': 6, 'seed': 3}, label='Tsolenka road boulders',
           desc='Two car-sized boulders flank the gravel road where it starts to climb toward the pass; old grey snow crusts the lee of the northern one and rime whitens the gravel even in summer.')
    s.prop('crag', P(507, 404), rot=-20, dims={'w': 13, 'd': 8, 'h': 5.5, 'seed': 6})
    s.prop('r-snow-crust', P(470, 395), rot=15, dims={'len': 11})
    s.prop('r-trail-cairn', P(500, 382), dims={'n': 6}, label='Trail cairn', desc='A knee-high cairn of stacked flat stones, the first marker of the pass road.')
    fog(P(504, 474), heading(0.15, 1), {'len': 80, 'h': 1.5, 'd': 14, 'seed': 17}, 'Cold air off the pass')
    for p, r in (((470, 386), 4.2), ((507, 404), 3.8)): s.clear(*P(*p), r)
    s.prop('r-ditch', P(475, 287), rot=heading(1, 0.03), dims={'len': 110, 'w': 4}, label='Roadside ditch')
    s.prop('r-plank-crossing', P(458.5, 287), rot=heading(0.15, -1), dims={'len': 8})
    tdir = unit(472 - 463, 210 - 250)
    s.prop('r-ditch', P(470.5, 250), rot=heading(*tdir), dims={'len': 44, 'w': 4})
    s.prop('r-torn-corpse', P(471, 252), rot=heading(*tdir), label='Torn corpse',
           desc='A man in muddy homespun lies in the ditch beside the path, torn apart by something with very big jaws; huge paw prints are pressed into the mud all round him.')

    # ---- the Krezk road: the robbed grave beyond the ramp
    s.prop('r-robbed-grave', P(212, 101), rot=heading(1, 0.15), label='Robbed grave',
           desc='Beside the road a shallow grave has been dug open and left: a mud-filled hole, the spoil and the stones that covered it thrown about, bones and a scrap of rusted mail in the dirt.')
    s.clear(*P(212, 101), 3.5)

    # ------------------------------------------------------------------ the woods: a frame for the set pieces
    def in_clearing(x, z, k=1.0):
        """The trampled open ground: round the signpost, the turnout and the rookery, and along the road to the east
        junction; the tower path plunges into pines at once."""
        return (((x - 372) / 82) ** 2 + ((z - 262) / 108) ** 2 < k or ((x - 455) / 95) ** 2 + ((z - 306) / 42) ** 2 < k
                or ((x - 330) / 40) ** 2 + ((z - 175) / 40) ** 2 < k)
    s.keep.append(([P(462, 270), P(478, 270), P(482, 228), P(468, 228)], 0.4))      # the corpse's ditch stays open
    def dens(cx, cz):
        x, z = cx * 5, cz * 5
        if in_clearing(x, z): return 0.0                                       # the bench's open ground
        if math.hypot(x - 300, z - 160) < 70: return 0.0                       # the bridge and its knobs stay in view
        if x < 250 and 85 < z < 125: return 0.0                                # the Krezk road verges
        if 120 < x < 250 and 240 < z < 300: return 0.25                        # the west bank by the ford
        if line_dist((cx, cz), [P(*p) for p in RIVER]) < 9: return 0.25        # thin along the banks
        if x > 430 and z < 260: return 0.9                                     # north-east, round the tower path
        return 0.95
    s.clear(*P(490, 222), 2.4); s.clear(*P(498, 233), 2.0); s.clear(*P(484, 236), 2.0)
    s.pines(2600, density=dens, gap=2.7, margin=1.1, scale=(1.0, 1.5), giant=lambda x, z: (1.3, 1.65) if x < 6 or x > W - 6 or z < 6 or z > H - 6 else None)
    s.undergrowth(bushes=40, boulders=14, dead=5, stumps=6, logs=5, density=lambda x, z: 0.0 if dens(x, z) < 0.3 else 1.0)
    s.scatter('weeds', 14, lambda x, z: 1.0 if in_clearing(x * 5, z * 5, 0.85) else 0.0, margin=0.4, gap=1.6, dims={'n': 3, 'r': 1.3}, circles=False)

    # ------------------------------------------------------------------ the bench room, notes, spawn
    s.room('R', 'Raven River Crossroads', cells([(318, 190), (352, 162), (410, 168), (448, 215), (515, 270), (532, 312), (500, 345), (430, 360), (360, 368), (316, 345), (298, 300), (308, 240)]), 'grass',
           'Five roads meet on a trampled forest bench beside a river that never stops roaring. A weatherworn signpost leans at the main junction; north-north-west, through a thin screen of tall pines, an arching stone bridge spans the river at a narrows, and behind it white water comes thundering down through a cleft in the rock. A dead, bark-stripped tree full of nests stands over everything, and ravens watch from it, from the signpost and from the stones. Across the road a stone trough and a turnout of crushed granite; east, a milestone where a gravel road climbs south and a dirt path slips north into the pines.',
           'Always check for a random encounter here (p.40): every 30 minutes outdoors, 18+ on a d20 on the road, 15+ in the woods, no more than two outdoor encounters per 12 hours (p.28); the stagings on this map place each likely result. The rapids impose disadvantage on Wisdom (Perception) checks that rely on hearing anywhere on the map. A Keeper of the Feather in raven form always watches from the rookery or the signpost, shadows the party 1d4 hours and flies home to report (p.32). Never harm a raven (p.26): a party that shoots at the rookery is marked and the Keepers will not trust it; a party that leaves the ravens be has the swarms\' help in any fight here. Distances from the signpost: Krezk 2 mi west over the bridge (40 min); Vallaki about 4.5 road miles east (1.5 h); Van Richten\'s Tower about 1.3 mi up the north path (30 min); the winery about 3 mi south-west (1 h; the road becomes a muddy trail after half a mile, then a meadow signpost points west, p.174); Tsolenka gatehouse 7 mi up the gravel road south (2.5-3 h, extreme cold at night, p.157).')
    s.note(P(330, 300), 'Encounter check on arrival (p.40). Day table result 11 (ravens or wereraven), 16 (werewolves posing as trappers on the bridge), 12 (dire wolves at the ford), 2 (scouts by the tower path), 19 (scarecrows up the winery trail), 8 (skeletal rider on the bridge), 7 (Vistani at the trough); see the hidden figures for each.')
    s.note(P(300, 290), 'The river: 30 ft wide at the narrows, 45 ft at the piles, 3-6 ft deep and fast. Ford: difficult terrain, DC 10 Athletics per 10 ft or swept 10 ft downstream and prone. Swimming elsewhere DC 13. Swept into the Throat: 2d6 bludgeoning per round. A fall from the deck is 16 ft into water (1d6).')
    s.note(P(372, 92), 'The east shelf: DC 12 Athletics to climb the wet rock from the bench (the cut steps at its south end are an easy scramble). Its ledge path skirts the crossroads above the bridge, unseen and unheard over the rapids; it overlooks the bridge deck.')
    s.note(P(150, 205), 'The old track up from the ford, grassing over: wolf prints and bare feet lead north-west toward the werewolf den in the caves west of Lake Baratok, about 1.7 mi (p.32, p.201). Kiril Stoyanovich\'s pack haunts these woods (p.171).')
    s.note(P(22, 92), 'West: the Old Svalich Road to Krezk (S), 2 miles; past Krezk it runs a little over a mile more into the Mists (p.143).')
    s.note(P(600, 292), 'East: the Old Svalich Road climbs gently to Vallaki (N), about 4.5 road miles.')
    s.note(P(528, 18), 'North-north-east: the dirt path to Van Richten\'s Tower on Lake Baratok (V), about 1.3 miles; its right fork is the long dirt trail that rejoins the road at the Luna River crossroads (p.40).')
    s.note(P(528, 528), 'South: the gravel Tsolenka Pass road (T), 7 miles to the gatehouse; wind, snow and bitter night cold on the climb (p.157).')
    s.note(P(150, 530), 'South-west: the winery road dips south and becomes a gravel trail; the Wizard of Wines (W) is about 3 miles on (p.174).')
    s.note(P(305, 372), 'Wine Delivery (p.180): once the winery is freed, Adrian and Elvir Martikov bring three barrels this way to Vallaki or Krezk, watering at the trough. Check for an encounter each mile; two swarms of ravens guard the wagon. Krezk depends on these deliveries (p.143).')
    s.spawn(P(604, 307))

    # ------------------------------------------------------------------ hidden: things on the bench
    s.hidden('r-bundle', P(416.5, 240.4), 'Wereraven\'s bundle', 'A leather bundle', rot=heading(1, 0.35), y=0.7,
             desc='A leather-wrapped bundle of drab clothes stuffed into the hollow end of the log.',
             dm='Left by the Keeper of the Feather on watch in the rookery, who changes back here (Hidden Bundle, p.30). Taking it strands the Keeper in raven form until it is returned; returning it unasked earns its trust.', id='bundle')
    s.hidden('r-trinket', P(SP[0] + 1.1, SP[1] - 1.0), 'Keepers\' feather mark', 'A scratched feather', rot=75, y=8.1, dims={'v': 3},
             desc='A small feather scratched into the underside of the Krezk arm.',
             dm='The mark of the Keepers of the Feather: this crossroads is watched. A Keeper warms to a party that mentions it (p.40, p.32).', id='feather-mark')
    s.hidden('r-trinket', P(213, 104), 'Corroded dagger in the spoil', 'A corroded dagger', rot=40, dims={'v': 1},
             desc='A dagger eaten by rust, half buried in the thrown earth.',
             dm='The robbers missed it: DC 10 Investigation in the spoil. The grave was a soldier\'s; the bones and mail scrap lie in the open. The book\'s intact version is a rocky cairn (p.30); this one is violated, and the Vistani at the trough have its earth on their spades.', id='grave-dagger')
    s.hidden('r-trinket', P(472.5, 253), 'Corpse\'s pockets', 'Small belongings', rot=10, y=0.6, dims={'v': 2},
             desc='A wine-chit stamped with a Krezk mark and a carved wooden holy symbol.',
             dm='The missing villager the Barovian scouts are hunting for (p.29-30). The prints round him are dire-wolf sized and lead to the ford.', id='corpse-pockets')
    s.hidden('r-feather-cache', P(EK[0] + 1, EK[1] - 1), 'Keeper\'s cache under the cairn', 'A loose stone', y=8.6,
             desc='Under the cairn\'s loose top stone: a dozen black feathers bound together and a stub of charcoal.',
             dm='DC 13 Perception notices the loose top stone. The Keepers use the charcoal to mark signposts; the feathers are tokens for allies.', id='cairn-cache')
    # hidden: creatures on the bench
    for i, (dx, dz, y) in enumerate(((0, 0, 47), (-6, -4, 53), (6, 5, 40))):
        s.mob('swarm-of-ravens', P(RK[0] + dx, RK[1] + dz), 'Swarm of ravens', 'Ravens', y=y, id=f'ravens-{i + 1}',
              dm='Day result 11 (50%), or whenever the party lingers: the swarms lift from the rookery and circle. They fly off if attacked; otherwise they watch over the party and join any fight here against hostile creatures (p.32).' if i == 0 else None)
    s.mob('raven', P(SP[0] + 0.7, SP[1]), 'Keeper of the Feather (wereraven, raven form)', 'A raven', size='tiny', y=10.0, rot=200, id='keeper',
          dm='Always present as the Keepers\' lookout: on the signpost cap, a bollard or the parapet, and back to the rookery if stared at. Stealth against passive Perception; it shadows the party 1d4 hours, then flies home to report (the winery or the Blue Water Inn). On a second meeting it invites them to the Blue Water Inn (p.32).')
    for i, (x, z, rot) in enumerate(((490, 222, 250), (498, 233, 245), (484, 236, 260))):
        s.mob('r-scout', P(x, z), 'Barovian scout', 'A hooded figure with a crossbow', rot=rot, id=f'scout-{i + 1}',
              dm='Day result 2: three scouts crouched in the pines with crossbows levelled; passive Perception 16 to spot them. They lower their weapons and ask for help finding a missing villager, then recognise the man in the ditch (p.29-30).' if i == 0 else None)
    for i, (x, z) in enumerate(((143, 530), (156, 515), (171, 502), (188, 489))):
        s.mob('scarecrow', P(x, z), 'Scarecrow (raven-killer)', 'A scarecrow', rot=facing(1, -0.9), id=f'scarecrow-{i + 1}',
              dm='Day result 19 / night 17: Baba Lysaga\'s scarecrows, dead ravens stuffed in their guts, lurching up the winery trail toward the rookery; the ravens shriek and scatter. Surprise unless passive Perception 11 (p.31).' if i == 0 else None)
    for i, (x, z, rot) in enumerate(((371, 327, 200), (385, 338, 300), (396, 323, 250), (358, 334, 120))):
        s.mob('r-vistani-bandit', P(x, z), 'Vistani bandit', 'A Vistana traveller', rot=rot, dims={'v': i}, id=f'vistani-{i + 1}',
              dm='Day result 7: four grave-robbers lounging round the trough, pipe smoke and laughter in the fog, muddy spades from the grave by the Krezk road. Not hostile unless provoked; they offer to guide for 100 gp, and one carries 2d4 gems (p.32).' if i == 0 else None)
    wg = (300, 352); wu = unit(312 - 290, 330 - 360); wp = (-wu[1], wu[0])
    s.hidden('r-wine-wagon', P(*wg), 'Martikov wine wagon', 'A wine wagon', rot=heading(*wu),
             desc='An open farm wagon with three wine barrels roped on its bed.',
             dm='The Wine Delivery after the winery is freed (p.180): coming up the winery road, watering at the trough, then east to Vallaki or over the bridge to Krezk.', id='wine-wagon')
    for i, side in enumerate((1, -1)):
        s.mob('horse', P(wg[0] + wu[0] * 14 + wp[0] * side * 2.4, wg[1] + wu[1] * 14 + wp[1] * side * 2.4), 'Draft horse', 'A draft horse', size='large', rot=heading(*wu), dims={'scale': 1.1}, id=f'draft-{i + 1}')
    s.mob('wereraven', P(wg[0] + wu[0] * 4.6, wg[1] + wu[1] * 4.6), 'Adrian Martikov (wereraven, stand-in figure)', 'A young carter', rot=facing(*wu), y=3.0, id='adrian',
          dm='Adrian drives; Elvir walks beside. Both are wereravens of the Keepers (p.180). Their two raven swarms attack anything that threatens the wagon.')
    s.mob('wereraven', P(wg[0] + wp[0] * 5, wg[1] + wp[1] * 5), 'Elvir Martikov (wereraven, stand-in figure)', 'A young carter', rot=facing(*wu), id='elvir')
    for i in range(2):
        s.mob('swarm-of-ravens', P(wg[0] - wu[0] * 4 + wp[0] * (i * 6 - 3), wg[1] - wu[1] * 4 + wp[1] * (i * 6 - 3)), 'Swarm of ravens (wagon guard)', 'Ravens', y=10, id=f'wagon-ravens-{i + 1}')

    # ------------------------------------------------------------------ hidden: the riverbed
    on(river_lv)
    s.hidden('r-prints', P(ford_w[0] - fn[0] * 8, ford_w[1] - fn[1] * 8), 'Wolf prints and bare feet', 'Tracks in the mud', rot=heading(*fn), y=6.0, dims={'len': 16},
             desc='Wolf prints and bare human footprints pressed into the mud side by side.',
             dm='DC 12 Survival: a pack that walks on two legs as often as four, heading north-west up the old track toward the den west of the lake (p.32).', id='ford-prints')
    s.hidden('r-trinket', P(FORD[0] - 3, FORD[1] + 4), 'Trinket in the mud', 'Something glinting', dims={'v': 0},
             desc='Something small glints in the mud between the piles.',
             dm='Roll on the trinket table in appendix A (p.32).', id='ford-trinket')
    for i, (a, b) in enumerate(((10, -4), (2, 5), (18, 3))):
        p = (FORD[0] + fn[0] * a - fn[1] * b, FORD[1] + fn[1] * a + fn[0] * b)
        s.mob('dire-wolf', P(*p), 'Dire wolf', 'A huge wolf', size='large', rot=facing(-fn[0], -fn[1]), id=f'dire-wolf-{i + 1}',
              dm='Day result 12 / night 10: three dire wolves splash across the ford out of the fog on the west bank. The fog lightly obscures the river; the bridge is the party\'s chokepoint (p.30).' if i == 0 else None)

    # ------------------------------------------------------------------ the bridge deck (+10)
    on(bridge_lv)
    s.room('R-bridge', 'The bridge crown', cells(oriented_rect(BC[0], BC[1], AX[0], AX[1], 11, 6.5)), 'flagstone',
           'The level crown of the arch, fifteen feet wide between waist-high parapets, sixteen feet above the white water; the stones are slick with spray and the roar drowns speech. Ravens line the parapets. Upstream the Throat pours down at you; downstream the river slides away past the black stubs of an older bridge.',
           'No cover but the parapets; nobody on the deck can hear anyone coming. A creature shoved over the parapet falls 16 ft into the water (1d6 bludgeoning) and is in the current. The bridge is the chokepoint for the dire wolves at the ford and the place the werewolf trappers choose to hail travellers.')
    for i, (a, side) in enumerate(((-8, 1), (3, -1), (9, 1))):
        p = (BC[0] + AX[0] * a + perp[0] * side * 7.0, BC[1] + AX[1] * a + perp[1] * side * 7.0)
        s.prop('r-raven-perch', P(*p), dims={'n': 2 + i % 2, 'spread': 1.4, 'y': 3.3, 'seed': 40 + i, 'wing': 1 if i == 1 else 0})
    s.mob('werewolf-human', P(BC[0] - AX[0] * 7, BC[1] - AX[1] * 7), 'Werewolf posing as a trapper', 'A trapper', rot=facing(-AX[0], -AX[1]), id='trapper-1',
          dm='Day result 16: three werewolves in human form, posing as trappers, come over the bridge from the Krezk side. This one hails the party from the crown and asks about silvered weapons; with none in sight they attack in hybrid form. Night result 15 is the pack in wolf form, howling from the Notch and following to strike at the next rest (p.32).')
    s.mob('r-skeletal-rider', P(BC[0] + AX[0] * 7, BC[1] + AX[1] * 7), 'Skeletal rider', 'A skeletal rider', size='large', rot=heading(*AX), id='skeletal-rider',
          dm='Day and night result 8: a skeleton on a skeletal warhorse crosses the deck east to west, rusted lantern raised and shedding no light. It ignores the party unless attacked (p.31). Stand-in stats: skeleton and warhorse skeleton.')

    # ------------------------------------------------------------------ the Notch shelves (+12)
    on(notch_lv)
    def shelf_room(name):
        pts = [shelf_local(name, x, z) for x, z in shelf_crown(name)]
        return cells(clip_rect(pts, 0, 1, WF, HF))
    s.room('R-ledge', 'East shelf and ledge path', shelf_room('east'), 'flagstone',
           'A flat top of wet granite twelve feet above the bench, lichen and puddles on it, the Throat roaring below its sheer western face. A worn path runs along the brink, and at its south end the shelf looks straight down onto the bridge deck. Fog from the lake slides over it.',
           'The ledge path lets anyone skirt the crossroads above the bridge unseen; nothing on it can be heard over the rapids. Wereravens and werewolves both use it. Climbing up from the bench is DC 12 Strength (Athletics) except by the rough steps at the south end. The werewolf pack howls from here at night (result 15).')
    s.room('R-shelf', 'West shelf', shelf_room('west'), 'flagstone',
           'A wet granite shelf on the far side of the Throat, its eastern face dropping sheer into the white water; stunted pines cling to its back.',
           'Reached from the Krezk road side by a DC 12 Athletics scramble. From here a watcher sees the bridge, the east bank and the rookery across the rapids.')
    notch_lv.floor_polys.append(cells(east_landing))
    s.hidden('r-prints', P(*shelf_pt('east', 0.62, 0.0)), 'Scuffs on the ledge path', 'Scuff marks', rot=heading(*shelves['east'][5]), dims={'len': 30, 'mode': 1},
             desc='Claw scrapes and boot scuffs in the green slime along the brink.',
             dm='Wereravens and werewolves both use this path to skirt the crossroads; fresh scrapes mean the pack passed within the day.', id='ledge-scuffs')
    for i, p in enumerate(((360, 30), (368, 42))):                         # on the ledge path, inside R-ledge
        s.mob('werewolf-human', P(*p), 'Werewolf posing as a trapper', 'A trapper', rot=facing(-0.7, 0.7), id=f'trapper-{i + 2}',
              dm='Within whistling distance of the one on the bridge, on the ledge path above the Throat.' if i == 0 else None)
    s.mob('r-bat-swarm', P(334, 58), 'Swarm of bats (Strahd\'s spy)', 'A knot of bats', y=2, dims={'y': 2}, id='bats',
          dm='Night result 9, or the dusk and dawn spy check (p.29): bats pour out of the Notch at dusk and over the bridge. The spy\'s goal is to escape with a report or snatch an item.')

    # ------------------------------------------------------------------ links between the levels
    def lk(id, kind, la, pa, lb, pb):
        return OrderedDict(id=id, kind=kind, **{'from': OrderedDict(level=la, pos=[rnd(pa[0], 1), rnd(pa[1], 1)]), 'to': OrderedDict(level=lb, pos=[rnd(pb[0], 1), rnd(pb[1], 1)])})
    crown_e = (BC[0] - AX[0] * 10, BC[1] - AX[1] * 10); crown_w = (BC[0] + AX[0] * 10, BC[1] + AX[1] * 10)
    links = [
        lk('R-bridge-east', 'stairs', 'bench', (e_end[0] + 2, e_end[1] + 2), 'bridge', crown_e),
        lk('R-bridge-west', 'stairs', 'bench', (w_end[0] - 4, w_end[1] - 2), 'bridge', crown_w),
        lk('R-ford-east', 'stairs', 'bench', ford_e, 'river', (FORD[0] - fn[0] * (whf - 2), FORD[1] - fn[1] * (whf - 2))),
        lk('R-ford-west', 'stairs', 'bench', ford_w, 'river', (FORD[0] + fn[0] * (whf - 2), FORD[1] + fn[1] * (whf - 2))),
        lk('R-ledge-steps', 'stairs', 'bench', steps_foot, 'notch', steps_top),
        lk('R-shelf-climb', 'ladder', 'bench', wshelf_foot, 'notch', wshelf_top),
    ]

    s.lv = river_lv
    s.write('Raven River Crossroads', extra={'stacked': 'open', 'entry': 'bench'}, levels=[bench, bridge_lv, notch_lv], links=links)
    # the grid: the bench's floor is both banks, not just its first terrain polygon
    gp = os.path.join(ROOT, 'locations', 'ch02', 'R', 'grid.json')
    grid = json.load(open(gp), object_pairs_hook=OrderedDict)
    rooms_ft = lambda lv: [[[rnd(x * 5, 3), rnd(z * 5, 3)] for x, z in r[2]] for r in lv.rooms]
    grid['levels']['bench']['floorPolygons'] = [[[rnd(x, 3), rnd(z, 3)] for x, z in nw_map], [[rnd(x, 3), rnd(z, 3)] for x, z in se_map]] + rooms_ft(bench)
    for lv in (bridge_lv, notch_lv):
        grid['levels'][lv.id]['floorPolygons'] = [[[rnd(x * 5, 3), rnd(z * 5, 3)] for x, z in p] for p in lv.floor_polys]
    json.dump(grid, open(gp, 'w'), indent=1, ensure_ascii=False)


def wildlib_normals(line):
    n = len(line); out = []
    for i in range(n):
        a, b = line[max(0, i - 1)], line[min(n - 1, i + 1)]
        tx, tz = b[0] - a[0], b[1] - a[1]; L = math.hypot(tx, tz) or 1
        out.append((-tz / L, tx / L))
    return out


if __name__ == '__main__':
    build()
