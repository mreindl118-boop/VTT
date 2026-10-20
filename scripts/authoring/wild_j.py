#!/usr/bin/env python3
"""J. Gates of Ravenloft (p.38) -> locations/ch02/J/{scene,grid}.json

The book prints no battle map for J; this is the inferred design of the site brief. The Count's old road comes down
from the north-west through a cut in the crag, swings round a rock knob at the hairpin, turns due east and runs out
over old cobbles onto the Neck, a tongue of rock with fog on three sides, between two broken turrets to the lip of a
50-ft chasm, where the castle's drawbridge comes down on a worn stone sill. 540 x 400 ft, 5-ft cells, x east, z south.

The gate is the castle's (item 2g-1; owner 2026-10-19: "this looks cool but it's supposed to be attached to and part of
Ravenloft and the new improved 3D model"): the drawbridge on its chains, the west wall with its gate tunnel, the
portcullis, the gate towers with their latches and the gargoyles on the wall top are Castle Ravenloft's own front
(scripts/authoring/castle-ravenloft.py, ch04/K: K1-bridge, K1-g, K1-tn, K1-ts). J is the road gate on the approach: the
road's end, the turrets, the chasm's near lip and its sill. Across the chasm, where the continuous world is off, a
stand-in of the castle (its wall and gate, the lowered bridge, the keep beyond) closes the view; in the continuous world
the castle itself stands at its own pin and the stand-in is hidden.

Levels (stacked): the spur at road level (0) and a ledge on the mainland face of the chasm under the sill (-35). Only
keys, names, pages, distances and placements come from the book; every description is our own words. Positions below
are in feet and turned into cells by F()."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wildlib import *  # noqa: F401,F403
from wildlib import Site, Level, rect, catmull, ribbon, clamp_poly, rnd, heading, facing, along, line_dist, inside
from collections import OrderedDict

def F(x, z):
    """Feet to cells."""
    return (x / 5, z / 5)

def FP(pts):
    return [F(x, z) for x, z in pts]

AXIS = 175                       # the z of the focal axis: road, turrets, bridge, tunnel, doors
CHASM = (400, 450)               # the chasm's two lips
GATE = (165, 185)                # the gate tunnel's sides

# the mainland's walkable ground: the crag foot along the north, the North Gully's rim, the chasm lip, the Brink's cliff
CRAG_FOOT = [(0, 0), (56, 0), (64, 24), (82, 50), (106, 70), (130, 78), (160, 86), (186, 102), (208, 116), (232, 126), (262, 122), (294, 104), (320, 70), (335, 45)]
GULLY_RIM = [(335, 45), (352, 70), (372, 92), (388, 110), (400, 120)]
CLIFF = 370


def build():
    s = Site('J', 'Gates of Ravenloft', 108, 80, 707)
    s.lv.id, s.lv.name, s.lv.ceiling = 'ground', 'The Spur (road level)', 93   # (the section's height, as when the castle's wall stood here)
    L = s.lv

    def prism(poly, h, color, y=0.0, label=None, key=None):
        """A flat-topped plate of the given plan (feet): bare rock, a fog floor, a terrace."""
        cx = min(max(sum(p[0] for p in poly) / len(poly), 6), 534); cz = min(max(sum(p[1] for p in poly) / len(poly), 6), 394)
        o = s.prop('prism', F(cx, cz), dims={'h': h, 'y': y, 'color': color}, label=label, key=key)
        o['pos'] = [rnd(cx, 2), 0, rnd(cz, 2)]
        o['polygon'] = [[rnd(x, 2), rnd(z, 2)] for x, z in poly]
        return o

    def fp(kind, x, z, **kw):
        return s.prop(kind, F(x, z), **kw)

    def gone(n):
        """The castle's pieces that stood here took `n` ids: keep them taken, so every piece left keeps its own (a save
        names the hidden things it has revealed by id)."""
        s.n += n

    # ============================================================== ground: the road, the cobbles, the bare rock
    road_ft = [(38, -8), (46, 20), (64, 46), (88, 72), (116, 92), (146, 104), (172, 120), (192, 140), (203, 160), (214, 174), (236, 177), (262, 176), (296, 175)]
    road = s.road(FP(road_ft), 1.6)
    s.road(FP([(286, 175), (330, 175), (378, 175)]), 1.6, floor='dirt', per=2, terrain=False)   # keeps trees off; the cobbles are its surface
    apron = [(290, 160), (300, 152), (318, 149), (340, 148), (360, 150), (376, 152), (382, 162), (384, 175), (382, 189), (378, 199), (360, 202), (336, 201), (312, 202), (296, 197), (288, 186), (292, 175)]
    s.patch(FP(apron), 'cobble')
    s.patch(FP([(382, 166), (394, 165), (394, 185), (382, 186)]), 'cobble')                                  # the cobbles run out onto the sill
    s.keep.append((FP(apron), 1.0))

    # bare rock: the chasm rim and the Neck's lip, under the crag, the terraces of the Brink
    ROCK, ROCK2, ROCK3 = 0x66635d, 0x5a5853, 0x4e4c48
    er = __import__('random').Random(29)
    def ragged(pts, amp, step=6, hold=lambda x, z: False):
        """An inner edge broken up: each run cut into ~`step`-ft pieces, every new point pushed off the line at random."""
        out = [pts[0]]
        for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
            ln = ((x1 - x0) ** 2 + (z1 - z0) ** 2) ** 0.5; m = max(1, round(ln / step)); nx, nz = -(z1 - z0) / (ln or 1), (x1 - x0) / (ln or 1)
            for k in range(1, m + 1):
                x, z = x0 + (x1 - x0) * k / m, z0 + (z1 - z0) * k / m
                j = 0 if k == m or hold(x, z) else er.uniform(-amp, amp)
                out.append((x + nx * j, z + nz * j))
        return out
    # the bare rock along the lips: a dark, broken-edged margin, not a band (the sill and the turrets keep their own edge)
    prism([(372, 96), (388, 110), (400, 120), (400, 372), (372, 372)] + ragged([(372, 372), (380, 340), (384, 300), (389, 262), (392, 232), (394, 212), (390, 196), (396, 190), (396, 160), (390, 152), (384, 138), (376, 126), (362, 112)], 4, hold=lambda x, z: 140 < z < 214)[1:], 0.08, ROCK2)
    prism([(335, 45), (352, 70), (372, 96)] + ragged([(372, 96), (362, 112), (344, 98), (328, 84), (318, 74)], 5)[1:], 0.08, ROCK2)
    # bare rock and scree under the crag: broken, ragged patches hugging the foot of the face, never one ribbon; each a
    # dark rim blending into the turf round a paler core of rock
    sr = __import__('random').Random(23)
    foot = CRAG_FOOT[2:]
    flen = sum(((foot[i + 1][0] - foot[i][0]) ** 2 + (foot[i + 1][1] - foot[i][1]) ** 2) ** 0.5 for i in range(len(foot) - 1))
    t = 0.0
    while t < flen - 10:
        ln = sr.uniform(16, 34)
        if sr.random() < 0.72:
            out_, back = [], []
            for k in range(7):
                (px, pz), (tx, tz) = along(foot, min(1, (t + ln * k / 6) / flen))
                bulge = (1 - abs(k - 3) / 3.4) * sr.uniform(4, 13) + 1.5                          # widest in the middle, ragged
                back.append((px + tz * 3, pz - tx * 3))                                           # tucked under the face
                out_.append((px - tz * bulge, pz + tx * bulge))
            core = [(bx + (ox - bx) * 0.62 + sr.uniform(-1.2, 1.2), bz + (oz - bz) * 0.62 + sr.uniform(-1.2, 1.2)) for (bx, bz), (ox, oz) in zip(back, out_)]
            prism(back + out_[::-1], 0.06, 0x474a41)
            prism(back[1:-1] + core[1:-1][::-1], 0.07, 0x55534d)
        t += ln + sr.uniform(8, 22)
    prism([(0, 0), (30, 0), (36, 24), (40, 48), (52, 66), (40, 86), (18, 96), (0, 100)], 0.07, ROCK2)     # the lower shoulder west of the road
    brink1 = [(0, 333), (40, 329), (90, 332), (140, 328), (200, 331), (260, 327), (320, 331), (372, 328), (380, 340), (376, 352), (0, 352)]
    brink2 = [(0, 352), (376, 352), (373, 362), (372, CLIFF + 2), (300, CLIFF - 2), (220, CLIFF + 3), (140, CLIFF - 1), (60, CLIFF + 2), (0, CLIFF)]
    prism(brink1, 0.08, ROCK2)
    prism(brink2, 0.09, ROCK3)

    # ============================================================== the drops: the chasm, the North Gully, the Brink
    # the chasm runs north-south off both edges; its fog fills it a few yards down
    # the chasm and the North Gully, one cut: sheer faces dropping from every lip into the fog, the gully biting back
    # north-west from the chasm behind the north turret to the foot of the crag and running on north off the map
    cut = [(400, 720), (400, 120)] + GULLY_RIM[::-1][1:] + [(324, 18), (321, -30), (342, -92), (380, -150), (400, -200), (400, -340), (450, -340), (450, 720)]
    cx_, cz_ = 425, AXIS
    cd = {'n': len(cut), 'depth': 36, 'nx0': -140, 'nx1': 140, 'nz0': -260, 'nz1': 260}
    for i, (x, z) in enumerate(cut):
        cd[f'x{i}'] = rnd(x - cx_, 2); cd[f'z{i}'] = rnd(z - cz_, 2)
    o = fp('j-cleft', cx_, cz_, dims=cd, label='The chasm and the North Gully', desc='A fifty-foot cleft between the spur and the castle\'s rock, sheer and slick, and a side-cleft of it biting back behind the north turret; both drop into fog a few yards down.')
    o['vis'] = 'explored'   # its own pieces, drawn in order (the depths, then the lid over them): never merged into the scatter
    # the North Gully: a side-cleft biting back north-west to the crag foot, as fog-filled as the chasm
    gully = [(335, 45), (352, 70), (372, 92), (388, 110), (400, 120), (402, 0), (402, -40), (330, -40), (326, 20)]
    # the Brink: below the cliff only fog, and through it, far down, the valley
    def sea(near, far, west, seed):
        """A ragged sheet of fog below the cliff: from `near` ft past the cliff edge out to about `far`, west to about `west`."""
        r = __import__('random').Random(seed); top, bot = [], []
        for x in range(int(west), 400, 20):
            top.append((x, CLIFF + near + r.uniform(-2, 3) * (1 if near else 0)))
            bot.append((x, far + r.uniform(-30, 30) - max(0, -x) * 0.4))
        top[-1] = (400, top[-1][1]); bot[-1] = (400, bot[-1][1])
        wend = [(west - r.uniform(0, 40), (CLIFF + near + far) / 2 + r.uniform(-30, 30))]
        return top + bot[::-1] + wend
    prism(sea(0, 690, -240, 1), 0.05, 0x24252a, y=0.02, label='The Brink')                 # the cliff's shadow on the fog
    prism(sea(9, 640, -220, 2), 0.05, 0x383a41, y=0.05)
    prism(sea(26, 580, -190, 3), 0.05, 0x555962, y=0.08)
    prism(sea(58, 520, -150, 4), 0.05, 0x767b85, y=0.11)
    for i, (x, z, ln, w, h) in enumerate([(425, 60, 120, 44, 26), (425, 300, 140, 44, 30), (425, 110, 50, 36, 10)]):
        fp('j-fog-boil', x, z, rot=90, dims={'len': ln, 'w': w, 'h': h, 'seed': i * 7 + 1}, label='Fog boiling from the chasm')
    fp('j-fog-boil', 372, 44, rot=-48, dims={'len': 90, 'w': 46, 'h': 30, 'seed': 31}, label='Fog in the North Gully')
    fp('j-fog-boil', 352, 0, rot=-75, dims={'len': 70, 'w': 34, 'h': 22, 'seed': 37}, label='Fog in the North Gully')
    for i, x in enumerate((-40, 80, 200, 320)):
        fp('j-fog-boil', max(x, 2), 398, dims={'len': 130, 'w': 120, 'h': 26, 'seed': 40 + i, 'ox': min(x, 2) - 2, 'oz': 62}, label='Fog rising over the Brink')

    # the lips: broken rock edges where the ground falls away
    for i, ((x0, z0), (x1, z1)) in enumerate(zip(GULLY_RIM, GULLY_RIM[1:])):
        mx, mz = (x0 + x1) / 2, (z0 + z1) / 2; ln = ((x1 - x0) ** 2 + (z1 - z0) ** 2) ** 0.5
        fp('j-rock-terrace', mx - 1.5, mz + 1.5, rot=heading(x1 - x0, z1 - z0) + 180, dims={'len': rnd(ln + 4), 'h': 3, 'talus': 0, 'seed': 10 + i})
    for i, z in enumerate(range(128, 366, 34)):
        if abs(z + 17 - AXIS) < 24: continue
        fp('j-rock-terrace', 399, z + 17, rot=90, dims={'len': 34, 'h': 3, 'talus': 0, 'seed': 20 + i})
    for i, x in enumerate(range(0, 380, 38)):
        fp('j-rock-terrace', x + 19, 331, dims={'len': 38, 'h': 12, 'seed': 30 + i})
        fp('j-rock-terrace', x + 19, 352, dims={'len': 38, 'h': 14, 'seed': 50 + i})
        fp('j-rock-terrace', x + 19, CLIFF, dims={'len': 38, 'h': 1000, 'talus': 0, 'seed': 70 + i})

    # ============================================================== the north crag, the Cut and its ice, the knob
    walls = [(61, 9, 26, 70, 48), (88, 34, 40, 80, 50), (128, 62, 44, 92, 44), (168, 76, 40, 104, 40), (206, 98, 38, 96, 36), (246, 106, 40, 88, 38), (284, 90, 40, 110, 40), (316, 50, 46, 120, 44)]
    for i, (x, z, ln, h, dd) in enumerate(walls):
        j = min(range(len(CRAG_FOOT) - 1), key=lambda k: line_dist(F(x, z), [F(*CRAG_FOOT[k]), F(*CRAG_FOOT[k + 1])]))
        (ax, az), (bx, bz) = CRAG_FOOT[j], CRAG_FOOT[j + 1]
        rot = heading(bx - ax, bz - az)           # the face (local +z) toward the road, to the south-west
        fp('j-crag-wall', x, z, rot=rot, dims={'len': ln, 'h': h, 'd': dd, 'seed': i + 3}, label='The north crag')
    # (the road comes in at (40, 0) and runs south-south-east under the crag: every mass here keeps north-east of it)
    for i, (x, z, w, d_, h) in enumerate([(124, 22, 80, 58, 130), (190, 30, 90, 70, 150), (262, 40, 80, 64, 140), (96, 12, 40, 32, 95),
                                          (108, 1, 70, 60, 150), (170, 1, 100, 80, 185), (230, 1, 90, 100, 200), (280, 2, 90, 120, 185), (296, 1, 50, 44, 150)]):
        fp('crag', x, z, rot=s.rng.uniform(-20, 20), dims={'w': w, 'd': d_, 'h': h, 'seed': i + 41})
    for i, (x, z, w, h) in enumerate([(10, 30, 34, 26), (16, 66, 30, 18), (4, 92, 22, 12)]):        # the lower shoulder west of the road
        fp('crag', x, z, rot=s.rng.uniform(0, 360), dims={'w': w, 'd': rnd(w * 0.8), 'h': h, 'seed': i + 61})
    fp('j-scree-fan', 121, 80, rot=facing(-0.3, 1), dims={'w': 34, 'd': 18}, label='Scree under the crag')
    fp('j-scree-fan', 238, 132, rot=8, dims={'w': 30, 'd': 14})
    fp('j-scree-fan', 70, 33, rot=facing(-0.85, 0.5), dims={'w': 20, 'd': 12})
    fp('j-scree-fan', 286, 108, rot=facing(-0.6, 1), dims={'w': 26, 'd': 16})
    fp('j-scree-fan', 318, 80, rot=facing(-0.8, 0.6), dims={'w': 20, 'd': 12})
    # fallen blocks strewn along the verge under the crag, so the bare strip reads as rockfall and not as a second road
    vr = __import__('random').Random(17)
    foot = FP(CRAG_FOOT[3:])
    for k in range(34):
        (px, pz), (tx, tz) = along(foot, (k + vr.random() * 0.8) / 34)
        off = (3 + vr.random() * 16) / 5
        bx, bz = px - tz * off, pz + tx * off            # to the left of the foot line going east: south, away from the rock
        if s.blocked(bx, bz, 0.4, circles=False): continue
        s.prop('boulder', (bx, bz), rot=vr.randint(0, 359), dims={'r': rnd(0.8 + vr.random() * 2.2)})
    # the Cut: the seep across the road, frozen black, icicles on the rock side
    t_ice = min((k / 200 for k in range(201)), key=lambda t: (along(FP(road_ft), t)[0][0] * 5 - 150) ** 2 + (along(FP(road_ft), t)[0][1] * 5 - 98) ** 2)
    (ix, iz), (tx, tz) = along(FP(road_ft), t_ice)
    fp('j-verglas', ix * 5, iz * 5, rot=heading(tx, tz), dims={'len': 30, 'w': 18, 'lip': 6}, label='Black ice', desc='A sheet of black ice glazes the road where a seep from the crag crosses it, scored by hooves and wheels; icicles hang from the rock above.')
    s.clear(ix, iz, 4)
    # the knob the road bends round at the hairpin
    fp('crag', 174, 158, rot=30, dims={'w': 30, 'd': 26, 'h': 24, 'seed': 88, 'top': 1}, label='Rock knob')
    s.keep.append((rect(*F(160, 145), *F(188, 171)), 0.4))
    s.keep.append((FP([(0, -50), (56, -50), (56, 0)] + CRAG_FOOT[1:] + [(335, -50)]), 0.6))

    # the hairpin: the old cobbles show through, the ruts bite deep on the outside of the bend
    for i, (x, z, r) in enumerate([(206, 166, 5), (216, 177, 6), (232, 179, 5), (252, 176, 4), (274, 174, 4)]):
        fp('paving', x, z, rot=i * 37, dims={'r': r})
    pts = road_ft[6:]
    for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
        fp('j-ruts', (x0 + x1) / 2, (z0 + z1) / 2, rot=heading(x1 - x0, z1 - z0), dims={'len': rnd(((x1 - x0) ** 2 + (z1 - z0) ** 2) ** 0.5 + 1), 'deep': 1 if 192 <= x0 <= 214 else 0})

    # ============================================================== the carriage apron, the loop, the Neck
    fp('j-cobble-apron', 332, AXIS, dims={'w': 86, 'd': 50}, label='Carriage apron', desc='The old thoroughfare\'s cobbles come up through the dirt here, rutted by one pair of wheels.')
    fp('j-turning-loop', 330, 216, dims={'w': 72, 'd': 40}, label='Turning loop', desc='Wheel ruts swing off the cobbles through the turf in a loop and back.')
    s.keep.append((FP([(288, 196), (372, 196), (372, 240), (288, 240)]), 0.5))
    fp('j-spout', 398, 196, dims={'run': 22}, label='Gutter spout', desc='The cobbles\' carved gutter ends in a weathered beast-mouth spout that drips into the fog.')

    # the twin broken turrets: the north one taller with its doorway, fallen stair and the slit on the bridge; the
    # south one a broken tooth, ravens in its hollow top
    fp('j-turret', 378, 150, dims={'r': 8, 'h': 30, 'seed': 1, 'door': 180, 'slit': -12, 'stair': 1}, label='North turret', desc='A roofless round guard tower split by weather; a doorway on the road side, its inner stair fallen in, one arrow slit looking at the bridge.')
    fp('j-turret', 378, 200, dims={'r': 8, 'h': 22, 'seed': 4, 'door': 160, 'slit': 30, 'nest': 1}, label='South turret', desc='A broken tooth of a tower, open to the sky, its jagged top white with ravens\' droppings.')
    for x, z in ((378, 150), (378, 200)):
        s.keep.append((rect(*F(x - 11, z - 11), *F(x + 11, z + 11)), 0.3)); s.clear(*F(x, z), 3)
    fp('j-fallen-gargoyle', 392, 215, rot=-20, label='Fallen gargoyle', desc='A stone gargoyle lies face up where it fell from the wall long ago, half sunk in turf, one wing snapped off beside it.')
    s.keep.append((rect(*F(384, 208), *F(400, 224)), 0.3))
    # the Widow's Notch
    fp('j-rim-notch', 396, 250, label='Worn notch in the rim', desc='A bite worn out of the chasm\'s lip, the turf scuffed down to bare rock.')
    s.clear(*F(392, 250), 3)

    # ============================================================== the bridge and its fittings
    fp('j-bridge-sill', 394, AXIS, label='Mainland sill', desc='A squared stone abutment on the lip with an iron-shod rest worn into a trough by centuries of lowering.')
    gone(6)   # the hinge, the drawbridge, its chains and their slots: the castle's (ch04/K)
    s.keep.append((rect(*F(382, 160), *F(400, 190)), 0.3))

    # ============================================================== across the chasm: the castle, as a stand-in
    # The castle's west wall, its gate and towers, the drawbridge on its chains and the gargoyles are the castle's own
    # front (ch04/K). Here the castle is a stand-in that shows only where the continuous world is off (the world draws
    # the castle itself at its pin): its wall with the gate, the lowered bridge from the gate to the sill, the keep's lit
    # doors beyond the courtyard (kit/sites/wild-j.ts castleMass `front`).
    gone(7)   # the wall's three pieces, the portcullis, the gate towers and the lit doors: the castle's (ch04/K), or the stand-in's
    fp('j-castle-mass', 539, AXIS, dims={'ox': 1, 'ex': 70, 'z0': 0, 'z1': 0, 'r': 520, 'wn': GATE[0] - AXIS, 'ws': GATE[1] - AXIS, 'front': 1, 'sill': 394 - 540}, label='Castle Ravenloft',
       desc='Across the chasm Castle Ravenloft\'s west wall rises ninety feet sheer, the drawbridge lowered from its gate on rusty chains; beyond the courtyard the keep\'s doors stand open on warm light under its dark towers.')

    # ============================================================== the knoll's dwarf pines and its stones
    s.clear(*F(392, 250), 4); s.clear(*F(330, 215), 9)
    def dens(x, z):
        X, Z = x * 5, z * 5
        if Z > 344 or Z < 205 or X > 372 or line_dist((x, z), road) < 4: return 0.0
        base = max(0.06, 1.0 - (((X - 80) ** 2 + (Z - 300) ** 2) ** 0.5) / 170)
        return base * (1.0 if X < 300 else max(0.0, (372 - X) / 72 * 0.4))
    s.scatter('j-krummholz', 85, dens, margin=0.6, gap=2.4, rot=False, dims=lambda g: {'h': rnd(8 + g.random() * 9), 'scale': rnd(0.8 + g.random() * 0.5), 'seed': int(g.random() * 97)})
    s.scatter('j-krummholz', 10, lambda x, z: 1.0 if 0 < x * 5 < 44 and 100 < z * 5 < 200 else 0.0, margin=0.6, gap=2.4, rot=False, dims=lambda g: {'h': rnd(9 + g.random() * 7), 'scale': rnd(0.9 + g.random() * 0.4), 'seed': int(g.random() * 97)})
    def on_spur(x, z):
        X, Z = x * 5, z * 5
        return X < 392 and Z < 366 and not inside((x, z), FP(gully)) and not inside((x, z), FP([(0, -50), (56, -50), (56, 0)] + CRAG_FOOT[1:] + [(335, -50)]))
    s.scatter('boulder', 26, lambda x, z: 0.0 if not on_spur(x, z) else (1.0 if x * 5 > 300 or z * 5 > 320 or z * 5 < 140 else 0.35), margin=0.5, gap=1.6, dims=lambda g: {'r': rnd(1.2 + g.random() * 2.2)})
    s.scatter('bush', 16, lambda x, z: 0.0 if z * 5 > 344 or x * 5 > 320 or z * 5 < 190 else 1.0, margin=0.4, gap=1.4, dims=lambda g: {'scale': rnd(0.5 + g.random() * 0.5)})
    s.scatter('dead-tree', 3, lambda x, z: 1.0 if 120 < x * 5 < 300 and 230 < z * 5 < 330 else 0.0, margin=1.0, gap=3, dims=lambda g: {'scale': rnd(0.6 + g.random() * 0.25)})

    # ============================================================== rooms (keyed areas)
    neck = [(286, 146), (330, 134), (362, 122), (388, 116), (400, 122), (400, 238), (372, 244), (340, 242), (300, 236), (284, 206)]
    s.room('J', 'Gates of Ravenloft', FP(neck), 'grass',
           'The road runs out onto a tongue of rock with fog on three sides. Two broken stone turrets flank its end on the lip of a fifty-foot chasm of boiling fog; on the lip a worn stone sill waits for the castle\'s drawbridge, and across the chasm Castle Ravenloft fills the sky.',
           'The carriage from I halts on the cobbles before the turrets and its door swings open by itself; its horses cannot be turned. The drawbridge, the gate with its portcullis, the gate towers and the gargoyles on the wall are the castle\'s own front: Castle Ravenloft (ch04/K), K1-bridge, K1-g, K1-tn and K1-ts. The bridge is down when the party arrives; after the illusion at K10 it rises and the portcullis drops.')
    s.room('J-cut', 'The Cut', FP([(104, 74), (126, 64), (204, 112), (214, 138), (196, 150), (174, 134), (112, 104)]), 'grass',
           'The road squeezes through a notch between the crag and a rock knob; a seep from the crag face has frozen across it into a sheet of black ice hung with icicles.',
           'Thirty feet of ice: anyone moving faster than a walk, or a horse, makes a DC 10 Dexterity save or falls prone. Loose scree lies on the inner verge.')
    s.room('J-hairpin', 'The Hairpin', FP([(196, 150), (214, 140), (236, 160), (262, 162), (262, 192), (226, 194), (198, 184)]), 'grass',
           'The road swings hard round the rock knob and turns due east, and Castle Ravenloft suddenly fills the sky. Old cobbles show through the dirt and the wheel ruts bite deep on the outside of the bend.',
           'Vistani escorts will not go past this bend, and say so. On foot from the fork at I: about an hour; by the black carriage about 45 minutes.')
    s.room('J-notch', 'The Widow\'s Notch', FP([(384, 240), (400, 240), (400, 260), (384, 260)]), 'grass',
           'A worn bite in the chasm rim, the turf scuffed to bare rock and the lip scored with marks like fingernails.',
           'Where the ghost from the wilderness tables walks its possessed host and throws the body into the chasm (p.30). DC 10 Wisdom (Survival): several people were walked here and went over without a struggle.')
    s.room('J-brink', 'The Brink', FP(brink1[:-1] + [(376, 352), (373, 362), (372, CLIFF + 2), (300, CLIFF - 2), (220, CLIFF + 3), (140, CLIFF - 1), (60, CLIFF + 2), (0, CLIFF)]), 'grass',
           'The spur\'s south edge steps down over two broken rock terraces and ends at a sheer drop; through breaks in the fog the valley and the roofs of Barovia show far below.',
           'Each terrace drops 10 to 15 ft (1d6 bludgeoning per 10 ft fallen). Past the cliff edge the fall is 1,000 ft.')

    # ============================================================== hidden things and DM notes
    def hid(kind, x, z, label, player, **kw):
        return s.hidden(kind, F(x, z), label, player, **kw)
    gone(9)   # the green slime, the latches, the greased iron in the slots and the rotten boards: the castle's (ch04/K)
    hid('j-rim-notch', 396, 250, 'Finger-scores and a dropped boot', 'Scratches and a boot', dims={'evidence': 1}, dm='DC 10 Wisdom (Survival): several people were walked to this spot and went over without a struggle.')
    hid('j-turning-loop', 330, 216, 'Fresh ruts, one vehicle only', 'Fresh wheel ruts', dims={'w': 72, 'd': 40, 'fresh': 1}, dm='DC 10 Survival: fresh ruts, no dung, no hoofprints off the cobbles, no foot traffic; the same carriage turns here and goes back. Only one vehicle ever uses this road.')
    hid('j-brazier-bracket', 383.9, 152, 'Signal-brazier bracket', 'A rusted bracket', rot=-90, dm='DC 12 Intelligence (Investigation): a bracket for a signal fire, charcoal in the rubble, the old way of calling for the bridge before the latches answered to one voice.')
    hid('j-fallen-gargoyle', 392, 215, 'Drilled eye sockets', 'Hollow stone eyes', rot=-20, dims={'detail': 1}, dm='DC 10 Intelligence (Investigation): the eye sockets are drilled clean through and the wing is solid stone. This one was only ever a carving.')

    # the carriage, its horses, the ghost and the birds
    hid('j-carriage', 322, AXIS, "Strahd's black carriage", 'A black carriage', dims={'open': 1},
        desc='The black carriage stands on the cobbles before the turrets, its side door hanging open, its lamps lit.',
        dm='Arrives from I and halts here; the door opens by itself. If nobody gets in or out it turns on the loop and returns to the fork empty. The horses cross the bridge without any board risk.')
    for dz in (-3.2, 3.2):
        s.mob('black-horse', F(337, AXIS + dz), "Black draft horse (Strahd's)", 'A black horse', size='large', dm='Under Strahd\'s control: no teamster can turn, stop or frighten it.')
    s.mob('ghost', F(374, 262), 'Ghost leading its host to the notch', 'A pale, drifting figure', dm='Only if the wilderness ghost (p.30) possessed a character: it walks the body to the Widow\'s Notch and throws it into the chasm. The party has the walk to stop it.')
    gone(1)   # the bats over the bridge: the castle's (ch04/K)
    s.mob('swarm-of-ravens', F(372, 204), 'Swarm of ravens (Keepers of the Feather)', 'Ravens', y=22, dm='Keepers of the Feather watching the gate; they scatter when the carriage arrives and never attack. They may carry word of the party.')

    s.note(F(330, 128), 'Weather: the moment the party passes the gate the first cold drizzle starts; within the hour a torrent, lightning on the crag behind them and thunder that shakes the deck.')
    s.note(F(40, 18), 'North-west: the road back round the mountain to the fork at I, about 2 miles. There is no road up from the village: the valley floor is 1,000 ft straight down off the Brink.')
    s.note(F(398, 104), 'The North Gully\'s rim is undercut and unfenced: a shove or a fumble here is the same 1,000-ft fall as the chasm.', key='J')
    s.note(F(392, 150), 'The drawbridge is the castle\'s (ch04/K, K1-bridge). Mercy for a creature that falls from it near this side: it snags on the ledge 35 ft below the sill (ledge level).', key='J')
    # the chasm's far lip: a broken margin of bare rock like the near one (the castle stands at its own pin, ch04/K; where
    # the continuous world is off the stand-in's wall stands on it). Placed last, so no other piece's id moves.
    prism([(CHASM[1], 0), (CHASM[1], 400)] + ragged([(CHASM[1] + 12, 400), (CHASM[1] + 10, 290), (CHASM[1] + 14, 175), (CHASM[1] + 11, 60), (CHASM[1] + 12, 0)], 3), 0.08, ROCK2)
    s.spawn(F(252, 176))

    # ============================================================== the chasm ledge (-35)
    lg = Level('ledge', 'Chasm ledge', -35, 35, ambient=AMB, interior='cave-rock', exterior='cave-rock', north='-z')
    lg.room('J-ledge', 'Chasm ledge', FP([(400, 165), (412, 165), (412, 195), (400, 195)]), 'dirt', page=38)
    s.desc['J-ledge'] = ('A shelf of wet rock thirty-five feet down the chasm wall under the sill where the drawbridge comes down, fog swirling just below it. Broken boards have jammed into a drift here around old bones in rusted mail.',
                         'Reachable only by rope from the sill; the chasm walls are slick and sheer (climber\'s kit and DC 15 Athletics, or magic). A character who falls from the bridge near this side may snag here if the DM is merciful. Below, the fog fills everything and the map stops.')
    lg.prop('shaft', 'j-chasm-shaft', F(425, AXIS), 'J-ledge', dims={'w': 50, 'len': 200, 'top': 35, 'fog': 10})
    lg.objects[-1]['vis'] = 'explored'; lg.objects[-1]['label'] = 'The chasm walls'
    lg.prop('drift', 'j-board-drift', F(406, 180), 'J-ledge')
    lg.objects[-1]['label'] = 'Drift of fallen boards'
    lg.obj('skeleton', 'j-board-drift', F(406, 180), 'hidden-object', 'J-ledge', 'Skeleton in rusted mail, a purse of 23 sp, a snapped lantern', dims={'part': 1})
    lg.objects[-1]['playerLabel'] = 'Bones in rusted mail'
    lg.objects[-1]['dm'] = 'A former adventurer; his companions may be vampire spawn in the castle now. Purse: 23 sp.'

    # links: a rope from the sill down to the ledge
    lk = lambda id, kind, al, ap, bl, bp: OrderedDict(id=id, kind=kind, **{'from': OrderedDict(level=al, pos=[rnd(ap[0] * 5, 2), rnd(ap[1] * 5, 2)]), 'to': OrderedDict(level=bl, pos=[rnd(bp[0] * 5, 2), rnd(bp[1] * 5, 2)])})
    links = [lk('J-rope', 'ladder', 'ground', F(392, 180), 'ledge', F(404, 180))]

    # the walkable ground for the grid: the mainland to the cliff (the bridge and the gate are the castle's)
    s.walk = [FP(CRAG_FOOT + GULLY_RIM[1:] + [(400, CLIFF + 2), (0, CLIFF + 2)])]
    s.write('Gates of Ravenloft', {'valley': True, 'stacked': True, 'entry': 'ground'}, levels=[lg], links=links)


if __name__ == '__main__':
    build()
