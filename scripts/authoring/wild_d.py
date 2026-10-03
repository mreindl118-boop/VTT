#!/usr/bin/env python3
"""D. River Ivlis (printed p.35): the village bridge on the elbow of the river, a mile south of Barovia.

The book prints no map for D; this is the inferred design. The river runs in a trench 7 ft below the banks: it comes
down out of the north-western pines, slows into the Mirror Pool, pinches between two bedrock sills under a single tall
stone arch carrying the Old Svalich Road (bearing 029), turns east below the bridge, and widens round a bone-white
shingle bar before leaving the east edge. Three levels stand together (stacked 'open'): the river (-7 ft: water, bar,
sills, wrecks, washing slabs, the willow's roots, the undercut), the banks and road (0: the south terrace, the north
meadow behind its low bluff, bridgeheads, gibbet, flood stone, drinking slope, bank path, trappers' hide), and the
bridge deck (+8). Every description is our own wording; only keys, names, pages and distances follow the book."""
import json, math, os, sys
from collections import OrderedDict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wildlib import *  # noqa: F401,F403

W, H = 140, 100          # cells (700 x 500 ft), x east, z south
PER = 6                  # catmull points per span
GRASS, EARTH, ROCK, SHINGLE, MUD, DIRT = 0x3d5241, 0x4f4538, 0x5d6168, 0xb0a998, 0x4a3f33, 0x66584a


def build():
    s = Site('D', 'River Ivlis', W, H, 303)
    g = s.lv; g.id, g.name, g.ceiling = 'ground', 'Banks and road', 8
    river = Level('river', 'River and bar', -7, 7, ambient=AMB, interior='rubble', exterior='rubble', north='-z')
    deck = Level('bridge', 'Bridge deck', 8, 8, ambient=AMB, interior='rubble', exterior='rubble', north='-z')
    ft = lambda p: (p[0] / 5, p[1] / 5)
    rng = s.rng

    # ------------------------------------------------------------ the river: centreline and half-widths (cells)
    CTRL = [(-3, 20.5), (12, 30), (24, 37), (32, 43), (40, 48.4), (46, 53.5), (54, 55.5), (68, 56.5), (82, 56.5), (96, 57), (112, 58.5), (128, 62), (143, 64)]
    HWS = [5.5, 6.5, 7.5, 6, 5, 5, 5.5, 5.5, 7, 9, 8.5, 7, 6.5]
    NC = len(CTRL)
    line = catmull(CTRL, PER)
    def hw(f):
        t = f * (NC - 1); i = min(NC - 2, int(t)); u = t - i
        return HWS[i] + (HWS[i + 1] - HWS[i]) * u
    def lip(f):   # the north bank's rock lip, 6 ft wide downstream of the bridge, growing in across the abutment
        t = f * (NC - 1)
        return 1.25 * max(0.0, min(1.0, t - 4.0))
    def normals(pts):
        out = []
        for i in range(len(pts)):
            a, b = pts[max(0, i - 1)], pts[min(len(pts) - 1, i + 1)]
            tx, tz = b[0] - a[0], b[1] - a[1]; L = math.hypot(tx, tz) or 1
            out.append((-tz / L, tx / L))
        return out
    NRM = normals(line); N = len(line)
    def edge(i, w):   # point i of the centreline moved w cells to the south (+) or north (-)
        (x, z), (nx, nz) = line[i], NRM[i]
        return (x + nx * w, z + nz * w)
    def fr(i): return i / (N - 1)
    def idx(t): return max(0, min(N - 1, int(round(t * PER))))   # control index -> line index
    def strip(i0, i1, w0, w1):
        """Polygon between the offsets w0 and w1 (callables of the fraction) over line indices i0..i1."""
        a = [edge(i, w0(fr(i))) for i in range(i0, i1 + 1)]; b = [edge(i, w1(fr(i))) for i in range(i0, i1 + 1)]
        return [(rnd(x), rnd(z)) for x, z in a + b[::-1]]
    S_EDGE = [edge(i, hw(fr(i))) for i in range(N)]                       # the water's south edge
    S_FOOT = [edge(i, hw(fr(i)) + 0.8) for i in range(N)]                 # the south bank's foot (a 4-ft shingle margin)
    N_EDGE = [edge(i, -hw(fr(i))) for i in range(N)]
    N_LIP = [edge(i, -(hw(fr(i)) + lip(fr(i)))) for i in range(N)]        # the bluff lip
    water = clamp_poly([(rnd(x), rnd(z)) for x, z in ribbon(line, hw)], W, H)
    Spoly = clamp_poly([(rnd(x), rnd(z)) for x, z in S_FOOT] + [(W, H), (0, H)], W, H)
    Npoly = clamp_poly([(0, 0), (W, 0)] + [(rnd(x), rnd(z)) for x, z in N_LIP[::-1]], W, H)
    g.terrain[0] = (Spoly, 'grass'); g.terrain.append((Npoly, 'grass'))
    s.walk = [Spoly, Npoly]
    s.keep.append((ribbon(line, lambda f: hw(f) + 1.3), 0))

    # ------------------------------------------------------------ the road (bearing 029) and the bridge geometry
    RD = (math.sin(math.radians(29)), -math.cos(math.radians(29)))        # along the road, toward the village
    RE = (-RD[1], RD[0])                                                  # across it, to the east
    DC = (200.0, 242.0)                                                   # deck centre (ft), on the elbow
    SPAN, RAMP, WID = 60, 50, 16
    def road_pt(t):   # ft along the road from the deck centre -> cells
        return ((DC[0] + RD[0] * t) / 5, (DC[1] + RD[1] * t) / 5)
    def beside(t, e):   # t ft along the road, e ft east of its axis -> cells
        return ((DC[0] + RD[0] * t + RE[0] * e) / 5, (DC[1] + RD[1] * t + RE[1] * e) / 5)
    S_FOOT_T, N_FOOT_T = -(SPAN / 2 + RAMP), SPAN / 2 + RAMP
    s_foot, n_foot = road_pt(S_FOOT_T), road_pt(N_FOOT_T)
    T_S, T_N = -(H * 5 - DC[1]) / -RD[1] - 4, DC[1] / -RD[1] + 4                                   # the road's ends, just off the map edges
    s.road([road_pt(T_S), road_pt((S_FOOT_T + T_S) / 2), s_foot], 1.6)                               # south: from the edge up to the ramp foot
    s.road([n_foot, road_pt((N_FOOT_T + T_N) / 2), road_pt(T_N)], 1.6)                               # north: from the ramp foot to the edge
    s.keep.append((oriented_rect(DC[0] / 5, DC[1] / 5, RD[0], RD[1], (SPAN / 2 + RAMP + 4) / 5, 2.8), 0.6))
    # the bank path toward Tser Pool, and the trodden slope where the animals drink
    s.road([(33.4, 60.8), (28.5, 55.5), (24, 50.2), (16.5, 43), (8, 37.5), (-1, 31)], 0.7)
    slope = [p for p in S_FOOT if 21.5 <= p[0] <= 30.5] + [(30.8, 48.6), (26, 49.8), (21.2, 48.2)]
    s.patch([(rnd(x), rnd(z)) for x, z in slope], 'dirt')
    s.keep.append((slope, 0.4))
    # the washing-stones path up the bluff, and the ford exit trodden to mud
    s.road([(60, 48.4), (60.6, 44), (62.4, 38)], 0.5)
    ford = [p for p in S_FOOT if 100.5 <= p[0] <= 106.5] + [(106.5, 69.2), (103, 69.8), (100.2, 69)]
    s.patch([(rnd(x), rnd(z)) for x, z in ford], 'dirt')

    # ------------------------------------------------------------ rooms
    s.room('D', 'River Ivlis: the south terrace', Spoly, 'grass',
           'A low grass terrace runs along the south side of a clear, cold river, pines closing in behind it. Ahead the road climbs a long ramp onto a single tall stone arch; the water hisses white over rock under the bridge.',
           'Check for a random encounter every 30 minutes: 18+ on d20 on the road and bridge, 15+ on the bar, bank path or in the water; skip it after two outdoor encounters in 12 hours. The village (E) is a mile north by the road; the crossroads (F) two miles south-west; the Tser Pool camp (G) two miles up the bank path. Vistani escorts take the path, not the bridge.')
    s.room('D-north', 'The north meadow', Npoly, 'grass',
           'North of the river the bank stands up as a grey rock lip over the water, and open meadow climbs away toward the village. A scored standing stone marks the bridgehead; a cluster of rounded boulders sits on a knoll above the bar.',
           'The north bluff is 7 ft of layered rock over the water. From the Sheep Rocks a watcher sees the whole road from edge to edge and the ford; anyone there is hidden from the bridge with cover. Scouts stage here.')
    # the river is the level that meets the open air, so it carries a sliver of terrain (the wading margin along the south
    # shore, under its shingle); the water itself is the keyed room, so the grid shows over it
    river.terrain.append((strip(0, N - 1, lambda f: hw(f) - 0.3, lambda f: hw(f) + 0.9), 'shallow-water'))
    river.room('D-river', 'The River Ivlis', water, 'shallow-water', page=35, difficult=True)
    s.desc['D-river'] = ('Fifty feet of fast, glass-clear winter-blue water, every stone on the bed showing ten feet down; two ribs of rock foam white under the bridge, and a long slow pool lies still above them.',
                         '50 ft wide, 5-10 ft deep, very cold. Swimming: DC 10 Athletics in the Mirror Pool; DC 15 in the narrows, the elbow and the north channel, and a failure sweeps the swimmer 20 ft downstream per round toward the bar. The south channel at the bar is a 2-3 ft wade (difficult terrain, no check). Heavy armour: disadvantage. Every 10 minutes in the water: DC 10 Con save or a level of exhaustion from the cold. Fog lies on the water at dawn and dusk (lightly obscured).')
    bar_c, bar_dir = (97.8, 57.4), (1.0, 0.07)
    def lens(l, w, n=12):   # the bar's outline as the prop draws it (feet, local): bulging toward the deep north channel
        pts = [(-l / 2 + i / n * l, -(w * 0.62) * math.sin(i / n * math.pi) * 0.92) for i in range(n + 1)]
        pts += [(-l / 2 + i / n * l, (w * 0.38) * math.sin(i / n * math.pi) * 0.92) for i in range(n - 1, 0, -1)]
        L = math.hypot(*bar_dir); ux, uz = bar_dir[0] / L, bar_dir[1] / L; nx, nz = -uz, ux
        return [(rnd(bar_c[0] + (ux * x + nx * z) / 5), rnd(bar_c[1] + (uz * x + nz * z) / 5)) for x, z in pts]
    bar_poly = lens(140, 48)
    river.room('D-bar', 'The Shingle Bar', bar_poly, 'dirt', page=35)
    s.desc['D-bar'] = ('A crescent of bone-white shingle, 140 ft long, with a spine of bleached stones and three rounded boulders. Everything the river brings down from the falls fetches up on its head; a wrecked farm wain lies in the gravel at its tail.',
                       'The deep north channel against the bluff is fast (DC 15); the south channel is a wade the wolves use as their ford, never the bridge. The strand line, the wain and the undercut opposite hold the hidden finds. 15+ on d20 for encounters here.')
    deck_poly = oriented_rect(DC[0] / 5, DC[1] / 5, RD[0], RD[1], SPAN / 10, WID / 10)
    deck.room('D-bridge', 'The Village Bridge', deck_poly, 'flagstone', page=35)
    s.desc['D-bridge'] = ('A single tall arch of grey stone carries the road sixteen feet over the narrows, its waist-high parapets furred with moss on every north face; a drain spout dribbles green below. From the deck you look straight up one reach of the river and straight down the other.',
                          'Safe to cross and wide enough for a wagon. A fall from the deck is 16 ft into 10 ft of water: DC 12 Dex save to miss the sill, 1d6 bludgeoning on a failure, and the swimmer is in the narrows (DC 15). Anything said here is heard plainly at the washing stones below; Perception to hear anything else over the sills is at disadvantage within 60 ft. Looking up the pool (bearing 331) the castle stands over the right-hand pines and hangs upside down in the water; after dusk one window shows a light, in the water first.')

    # ------------------------------------------------------------ the banks: faces from the water up to the turf (prisms on the river level)
    def prism(lv, pid, poly, h, y, color):
        lv.prop(pid, 'prism', (0, 0), None, dims={'h': rnd(h, 2), 'y': rnd(y, 2), 'color': color})
        o = lv.objects[-1]; o['pos'] = [0, 0, 0]; o['polygon'] = [[rnd(x * 5, 2), rnd(z * 5, 2)] for x, z in poly]
        return o
    prism(river, 'bank-s', Spoly, 6.6, 0, EARTH)
    prism(river, 'bank-n', Npoly, 6.6, 0, EARTH)
    prism(river, 'bluff', strip(idx(4.0), N - 1, lambda f: -hw(f) + 0.15, lambda f: -(hw(f) + lip(f) + 0.3)), 6.9, 0, ROCK)
    prism(river, 'margin-s', strip(0, N - 1, lambda f: hw(f) - 0.35, lambda f: hw(f) + 0.95), 0.5, 0, SHINGLE)
    prism(river, 'mud-slope', strip(idx(2.1), idx(3.2), lambda f: hw(f) - 1.9, lambda f: hw(f) + 0.3), 3.4, 0, MUD)
    prism(river, 'beach', strip(idx(3.3), idx(4.7), lambda f: hw(f) - 2.6, lambda f: hw(f) + 0.3), 1.6, 0, SHINGLE)
    prism(river, 'ford-mud', strip(idx(9.3), idx(10.4), lambda f: hw(f) - 1.4, lambda f: hw(f) + 0.3), 1.0, 0, MUD)
    prism(g, 'knoll', blob(73, 42, 5, 17, sx=1.5), 3.0, 0, GRASS)

    # ------------------------------------------------------------ the water's set pieces (river level, y = water surface)
    def flow(t):   # unit flow direction at control index t
        i = idx(t); a, b = line[max(0, i - 1)], line[min(N - 1, i + 1)]
        L = math.hypot(b[0] - a[0], b[1] - a[1]) or 1
        return ((b[0] - a[0]) / L, (b[1] - a[1]) / L)
    for k, t in enumerate((3.55, 5.0)):
        fx, fz = flow(t); p = line[idx(t)]
        # local +x across the channel, local +z downstream
        river.prop(f'sill-{k + 1}', 'd-river-sill', (rnd(p[0]), rnd(p[1])), None, rotY=heading(-fz, fx), dims={'len': 55})
    river.objects[-2]['label'] = 'The Narrows: upper sill'; river.objects[-1]['label'] = 'The Narrows: lower sill'
    river.objects[-2]['desc'] = 'A rib of bedrock just under the surface, a standing wave and a strip of white foam below it: the loudest water on the river.'
    for i in range(5):   # boulders in the narrows and the elbow
        t = 3.3 + i * 0.5; fx, fz = flow(t); p = line[idx(t)]; side = 1 if i % 2 else -1
        river.prop(f'rock-{i}', 'boulder', (rnd(p[0] - fz * side * (hw(t / (NC - 1)) - 1.6 - i * 0.3)), rnd(p[1] + fx * side * (hw(t / (NC - 1)) - 1.6 - i * 0.3))), None, dims={'r': rnd(1.6 + rng.random() * 1.4)}, y=-0.6)
    river.prop('bar', 'd-gravel-bar', bar_c, 'D-bar', rotY=heading(*bar_dir), dims={'len': 140, 'w': 48, 'seed': 3})
    river.objects[-1]['label'] = 'The Shingle Bar'
    river.prop('strand', 'd-strand-line', (87.4, 57.6), 'D-bar', rotY=20, dims={'r': 15}, y=0.8)
    river.objects[-1]['label'] = 'The Strand Line'; river.objects[-1]['desc'] = 'Splintered timbers, a wagon wheel, bleached bones, rags and a torn boot, combed into one heap by the current on the head of the bar.'
    river.prop('wain', 'd-drowned-wain', (109, 60), 'D-bar', rotY=-20, y=0.6)
    river.objects[-1]['label'] = 'The Drowned Wain'; river.objects[-1]['desc'] = 'A farm wain that went off the ford in a flood, half buried in gravel, one shaft pointing at the sky, a wheel still turning in the current.'
    river.prop('weir', 'd-fish-weir', (104, 65.2), None, rotY=heading(1, 0.05), dims={'len': 20})
    river.objects[-1]['label'] = 'Fish weir'; river.objects[-1]['desc'] = 'Driven stakes and wicker panels angled across the shallow channel, a basket trap at the point; a cord runs up to a bell on the bank. A villager checks it at dawn.'
    river.prop('wash', 'd-washing-slabs', (56, 50.6), None, rotY=heading(1, 0.1), dims={'len': 60})
    river.objects[-1]['label'] = 'The Washing Stones'; river.objects[-1]['desc'] = 'Flat slabs at the waterline with hollows worn into them by generations of beaten laundry; a drying pole with a forgotten rag, a basket. Every word spoken on the bridge is heard here.'
    river.prop('willow', 'd-hollow-willow', (64.4, 51.4), None, rotY=35, dims={'h': 35})
    river.objects[-1]['label'] = 'The Hollow Willow'; river.objects[-1]['desc'] = 'An ancient pollarded willow, roots in the river, trunk split and hollow, its crown a fist of thick stubs where ravens sit in all weathers and watch the bridge.'
    ux, uz = flow(9.0); p = edge(idx(8.95), -hw(8.95 / (NC - 1)) + 0.1)
    river.prop('undercut', 'd-undercut-bank', (rnd(p[0]), rnd(p[1])), None, rotY=heading(ux, uz), dims={'len': 30, 'h': 7})
    river.objects[-1]['label'] = 'The Undercut'; river.objects[-1]['desc'] = 'Where the fast channel runs hard against the bluff the current has eaten a hollow under it, roots hanging into black water. A sweetish rot drifts out when the wind backs east.'
    river.prop('mirror', 'd-castle-reflection', (23.6, 37.4), None, rotY=heading(math.sin(math.radians(151)), -math.cos(math.radians(151))), dims={'len': 54, 'w': 34})
    river.objects[-1]['label'] = 'The Mirror Pool'; river.objects[-1]['desc'] = 'Above the sills the river backs up into a slow, glass-clear reach holding the only blue in the valley; the pillar of Castle Ravenloft stands over the pines to the north-west and hangs upside down in the water.'
    for i, t in enumerate((0.6, 1.3, 1.9, 2.5, 6.4, 7.2, 7.9, 8.6, 10.8, 11.5, 12.1)):   # reeds in the shallow margins
        side = -1 if t < 3 and i % 2 == 0 else 1
        p = edge(idx(t), side * (hw(t / (NC - 1)) + (0.5 if side > 0 else -0.1)))
        if s.inmap(p): river.prop(f'reeds-{i}', 'reeds', (rnd(p[0]), rnd(p[1])), None, rotY=int(rng.random() * 360), dims={'r': rnd(1.6 + rng.random() * 1.4), 'n': 9}, y=0.3 if side > 0 else 0)
    for i, (t, L, D) in enumerate(((1.9, 80, 24), (4.6, 56, 22))):   # dawn mist in ribbons on the water
        fx, fz = flow(t); p = line[idx(t)]
        river.prop(f'mist-{i}', 'mist', (rnd(p[0]), rnd(p[1])), None, rotY=heading(fx, fz), dims={'len': L, 'h': 5, 'd': D}); river.objects[-1]['vis'] = 'explored'; river.objects[-1]['label'] = 'Mist on the water'

    # ------------------------------------------------------------ the bridge (deck level)
    deck.prop('arch', 'd-arch-bridge', (DC[0] / 5, DC[1] / 5), 'D-bridge', rotY=heading(*RD), dims={'w': WID, 'span': SPAN, 'ramp': RAMP, 'drop': 8, 'wy': 15, 'par': 3})
    deck.objects[-1]['label'] = 'The Village Bridge'
    deck.hidden('tally', 'd-tally-marks', beside(2, 7.2), 'D-bridge', 'Tally marks', rotY=heading(*RD) + 90)
    deck.objects[-1]['playerLabel'] = 'Scratches on the parapet'
    deck.objects[-1]['desc'] = 'Low on the downstream parapet, where a child could reach: eleven short strokes and one word in Barovian.'
    deck.objects[-1]['dm'] = 'The word is "hanged". Someone counted the eleven unmarked graves at the crossroads two miles back (F). Flavour.'

    # ------------------------------------------------------------ the bridgeheads and the banks (ground level)
    s.prop('d-wolf-gibbet', beside(-57, 26), rot=heading(-RE[0], -RE[1]) + 90, dims={'h': 14}, label='The Wolf Gibbet',
           desc='A 14-ft pole with a crossbar at the foot of the ramp, hung with a dozen wolf skulls, dried pelts and rusted trap chains: the trappers\' tally, knocking together in the wind.')
    s.keep.append((rect(beside(-57, 26)[0] - 1.4, beside(-57, 26)[1] - 1.4, beside(-57, 26)[0] + 1.4, beside(-57, 26)[1] + 1.4), 0.5))
    fs = beside(60, 17)
    s.prop('d-flood-stone', fs, rot=facing(-0.7, 0.7), label='The Flood Stone',
           desc='A man-high squared stone on the bluff lip, its river face scored with eight horizontal lines and old numerals, the top one above your head; the name IVLIS cut in worn capitals and a half-effaced device above.')
    s.keep.append((rect(fs[0] - 1.2, fs[1] - 1.2, fs[0] + 1.2, fs[1] + 1.2), 0.5))
    s.note(fs, 'Flood Stone: each line is a past flood; the name is the old family of the castle crypts (Ivliskova, Ivliskovich, p.89-90).')
    s.prop('d-sheep-rocks', (73, 42), rot=15, dims={'scale': 1.0}, y=3.0, label='The Sheep Rocks',
           desc='Five rounded lichen-grey boulders, the largest eight feet high, on a knoll above the bluff: cover for anyone watching the road and the ford.')
    s.clear(73, 42, 9)
    s.prop('footprints', (25.8, 48.4), rot=40, dims={'n': 12, 'len': 14, 'seed': 3}, label='Tracks in the mud',
           desc='Hoof prints of draft horses pressed into the mud slope and, over them, the broad pads of very large wolves.')
    s.prop('footprints', (28.2, 48.9), rot=-25, dims={'n': 8, 'len': 10, 'seed': 7})
    s.note((24, 49.4), 'The Drinking Slope: animals come down to drink here, 50 ft off the road. The hooves are the Vistani camp\'s draft horses (G); the pads over them are dire wolves.')
    s.prop('d-trappers-hide', (100, 72.4), rot=facing(0, -1), label='The Trappers\' Hide',
           desc='A low blind of brush and wicker hurdles facing the ford, a floor of trodden pine needles, a cold fire ring, two crossbow bolts stuck in the sod.')
    s.clear(100, 72.4, 4.5)
    s.prop('d-bell-stake', (106, 69.2), rot=heading(-10, -25), dims={'cord': 27, 'drop': 10}, label='Weir bell',
           desc='A small bronze bell on a stake; its cord runs down into the river to the fish weir. It creaks when the current pulls.')
    s.clear(106, 69.2, 3)
    s.hidden('d-wolf-trap', (103, 67.2), 'Hunting trap (set)', 'A steel trap', rot=20, dims={'sprung': 0},
             desc='A rusted steel-jaw trap set in the ford exit under a skin of pine needles.',
             dm='Front rank DC 15 Survival to spot; otherwise one random character steps in it: 1d4 piercing and the leg is held (DC 13 Str to pull free, 1d4 more). The trappers set them to thin the wolves; the castle\'s wolves are too clever for them.')
    s.clear(103, 67.2, 2.5)
    s.spawn((11.6, 97))
    s.note((13.5, 90), 'South-west along the road: the gallows crossroads (F), 2 miles, 40 minutes. Tser Falls (H) 4 miles by road through F.')
    s.note((64, 4), 'North along the road: the village of Barovia (E), 1 mile, about 20 minutes on foot.')
    s.note((5, 36.5), 'The bank path runs north-west along the pool through the pines to the Tser Pool camp (G): 2 miles, 45-60 minutes of rough going.')
    deck.note('sight', (40.5, 47.6), 'D-bridge', 'Sight line up the pool (bearing 331): the castle over the right-hand pines, 2.3 miles off and a thousand feet up, mirrored in the water.')

    # ------------------------------------------------------------ hidden things
    river.hidden('clasp', 'd-clasp-rag', (85.6, 57.0), 'D-bar', 'Blue cloth and silver clasp', rotY=30)
    o = river.objects[-1]; o['pos'][1] = 1.3; o['playerLabel'] = 'A scrap of blue cloth'
    o['desc'] = 'A strip of scorched blue cloth snagged in the timbers, a tarnished silver clasp of fine make still on it.'
    o['dm'] = 'The wizard who was thrown from Tser Falls (p.37): the Vistani found no body because the Ivlis carried him off, and he is alive: the Mad Mage of Mount Baratok (area M, p.39).'
    river.hidden('strongbox', 'chest', (108.6, 59.6), 'D-bar', 'Strongbox under the wain bed', rotY=-20)
    o = river.objects[-1]; o['pos'][1] = 0.4; o['playerLabel'] = 'A small box'
    o['desc'] = 'A small iron-bound box wedged under the wain\'s bed, buried in gravel.'
    o['dm'] = 'DC 13 Perception from the bar, 10 minutes of digging: a few coins and one roll on the Trinkets table (the "trinket" encounter, p.32).'
    o['container'] = OrderedDict(locked=False, contents='A handful of worn coins, 2d10 cp and 1d6 sp, and one small odd keepsake (roll a trinket).')
    river.hidden('villager', 'd-drowned-villager', (rnd(p[0] + ux * -1.2 + uz * 0.9), rnd(p[1] + uz * -1.2 - ux * 0.9)), None, 'The missing villager', rotY=heading(ux, uz) + 20)
    o = river.objects[-1]; o['playerLabel'] = 'A pale shape under the roots'
    o['desc'] = 'A man\'s body wedged under the roots below the waterline, torn about the throat and belly.'
    o['dm'] = 'The villager the scouts are searching for (the "corpse" encounter, p.30), killed by dire wolves. DC 12 Perception from the bar to see him as a pale shape under the roots. The scouts recognise him.'
    river.hidden('bundle', 'd-bundle', (64.0, 51.0), None, 'Wereraven\'s bundle', rotY=10)
    o = river.objects[-1]; o['pos'][1] = 12; o['playerLabel'] = 'A bundle in the hollow'
    o['desc'] = 'A leather-wrapped roll of drab Barovian common clothes stuffed into the hollow of the crown, twelve feet up.'
    o['dm'] = 'A wereraven\'s clothes (the raven in the tree; p.31-32). Finding it and leaving it alone earns the Keepers\' goodwill; on a second meeting the wereraven invites the party to the Blue Water Inn.'
    river.hidden('doll', 'doll', (52.4, 51.8), None, 'Child\'s doll', rotY=60)
    o = river.objects[-1]; o['pos'][1] = 0.5; o['playerLabel'] = 'A waterlogged doll'
    o['desc'] = 'Wedged in the hollow of the lowest washing slab: a child\'s wooden doll, waterlogged, one eye a nail head.'
    o['dm'] = 'Flavour. A villager in E will claim it if asked.'

    # ------------------------------------------------------------ encounters (DM-only until revealed)
    def mob(lv, oid, kind, pos, label, player, size='medium', rot=0, y=0, dm=None, key=None):
        lv.obj(oid, kind, (rnd(pos[0]), rnd(pos[1])), 'hidden-creature', key or 'D', label, rotY=rnd(rot, 1), size=size, y=y)
        o = lv.objects[-1]; o['playerLabel'] = player
        if dm: o['dm'] = dm
        return o
    SC = 'Barovian scouts (1d6): hunters and trappers searching for a missing villager; daytime road encounter, 18+ on d20. Passive Perception 16+ spots one figure. Once they see the party is no threat they lower their crossbows and ask for help. The man they want is in the Undercut.'
    mob(g, 'scout-1', 'd-scout', (100.6, 71.6), 'Barovian scout (in the hide)', 'A crouched hunter', rot=facing(0, -1), dm=SC)
    mob(g, 'scout-2', 'd-scout', (69.5, 41.2), 'Barovian scout (Sheep Rocks)', 'A hooded figure with a crossbow', rot=facing(-0.6, 0.8), y=3.0, dm=SC)
    mob(g, 'scout-3', 'd-scout', (77.8, 44.6), 'Barovian scout (Sheep Rocks)', 'A hooded figure with a crossbow', rot=facing(0.3, 1), y=3.0, dm=SC)
    DW = 'Dire wolves (1d6), day or night: the first steps out of the fog, the rest are dark shapes behind. They cannot be charmed or frightened and use the ford, never the bridge. (p.30)'
    for i, (x, z, r) in enumerate(((96, 80, -20), (100.4, 76.4, -10), (104.8, 79, 10))):
        mob(g, f'direwolf-{i + 1}', 'dire-wolf', (x, z), 'Dire wolf', 'A huge dark wolf', size='large', rot=r, dm=DW)
    WO = 'Wolves (3d6), night: the howling starts far off in the south forest and closes over several rounds; they ford at the bar and spread along the terrace.'
    for i, (x, z) in enumerate(((108, 86), (112, 83), (116, 88), (120, 84), (124, 89), (128, 86), (132, 90), (118, 93), (111, 91), (126, 94))):
        mob(g, f'wolf-{i + 1}', 'wolf', (x, z), 'Wolf', 'A grey wolf', rot=int(rng.random() * 90) - 135, dm=WO)
    BA = 'Swarms of bats (1d8), night: they attack without provocation when a light is carried under the bridge or along the north bank below the bluff. One swarm is the castle\'s spy and tries to leave with a report (p.32, spies sidebar).'
    mob(river, 'bats-1', 'd-bat-swarm', (41.2, 48.6), 'Swarm of bats (under the arch)', 'A flutter of wings under the arch', y=5, dm=BA)
    mob(river, 'bats-2', 'd-bat-swarm', (38.8, 47.0), 'Swarm of bats (under the arch)', 'A flutter of wings under the arch', y=6, dm=BA)
    mob(river, 'bats-3', 'd-bat-swarm', (rnd(p[0] + 1.0), rnd(p[1] + 1.2)), 'Swarm of bats (the Undercut)', 'Bats in the hollow', y=3, dm=BA)
    mob(river, 'bats-4', 'd-bat-swarm', (rnd(p[0] - 1.6), rnd(p[1] + 0.8)), 'Swarm of bats (the Undercut)', 'Bats in the hollow', y=3.5, dm=BA)
    mob(river, 'raven', 'd-raven', (64.0, 50.2), 'Raven in the willow (spy or wereraven)', 'A raven', size='tiny', rot=facing(-0.9, -0.3), y=14,
        dm='Always present by day. 50%: an ordinary spy of the castle (flees when noticed, tries to snatch a small item). 50%: a wereraven in raven form who keeps its distance, flies off when stared at and comes back; its bundle is in the hollow of the crown. Ravens carry lost souls, the Vistani say; killing one is bad luck (p.28).')
    mob(g, 'rider', 'd-skeletal-warhorse', road_pt(T_N - 18), 'Skeletal rider on a skeletal warhorse', 'A rider in the fog', size='large', rot=heading(-RD[0], -RD[1]),
        dm='Night or day road encounter: comes down the north road out of the fog, crosses the bridge at a walk and rides on south-west toward the crossroads, holding up a rusted lantern that sheds no light. Ignores the party unless attacked (p.31). Skeleton statistics for the rider; warhorse skeleton for the mount.')
    mob(river, 'wisp', 'd-will-o-wisp', (22, 36), 'Will-o\'-wisp over the pool', 'A lantern light on the far bank', size='tiny', y=3,
        dm='Night: it looks like a lantern on the far bank and leads anyone who follows onto the slick sills or into the deep water at the elbow.')
    ZO = 'Zombies (3d6), night wilderness encounter: they wade upstream in the south shallows from the east edge and climb out over the bar; the water hides their smell until they reach it.'
    for i, (x, z) in enumerate(((138.5, 66.5), (136, 68.4), (133.6, 66.2), (131.2, 68.6), (128.4, 67), (125.6, 68.8), (122.8, 66.6), (120, 68.2), (117.4, 66.8), (114.8, 68.4))):
        mob(river, f'zombie-{i + 1}', 'd-zombie', (x, z), 'Zombie (wading)', 'A shambling shape in the water', rot=-80 + int(rng.random() * 30), y=-1.5, dm=ZO)
    VB = 'Vistani bandits (1d4+1), daytime: laughter and pipe smoke reach the bridge first. They are picking over the strand line for valuables and offer themselves as guides for 100 gp (p.32).'
    for i, (x, z, r) in enumerate(((9.2, 38.8, 120), (7.0, 40.2, -40), (11.2, 40.6, 200))):
        mob(g, f'bandit-{i + 1}', 'd-vistani-bandit', (x, z), 'Vistani bandit', 'A Vistani by a small fire', rot=r, dm=VB)
    s.prop('campfire', (9.0, 40.4), rot=30, label='A small fire', desc='A small fire of driftwood by the bank path, a clay pipe left on a stone beside it; the smoke drifts out over the pool.')
    s.lv.light('camp', (9.0, 40.4), 'torch', 10, 20, y=2)
    s.clear(9.2, 39.8, 4)

    # ------------------------------------------------------------ the woods: pines are the frame, the set pieces the picture
    def road_x(z): return (DC[0] + RD[0] * (DC[1] - z * 5) / -RD[1]) / 5
    def dens(x, z):
        north = inside((x, z), Npoly)
        if x < 11: return 0.95
        if z > 79: return 0.9
        if north:
            if x < road_x(z) - 3.5: return 0.9 if z > 8 or x < 40 else 0.5
            if x > 120: return 0.25
            if z < 20: return 0.08
            return 0.012
        if x > 119 and z > 62: return 0.72
        if z > 72: return 0.3
        return 0.03
    s.pines(5200, density=dens, gap=2.3, margin=1.3, scale=(1.0, 1.55))
    s.undergrowth(bushes=48, boulders=14, dead=5, stumps=7, logs=5, density=lambda x, z: 1.0 if dens(x, z) > 0.4 else 0.12)
    s.scatter('boulder', 7, lambda x, z: 1.0 if inside((x, z), Npoly) and z < 46 and x > 50 else 0.0, margin=0.8, gap=2.5, dims=lambda r: {'r': rnd(1.6 + r.random() * 2.2)})
    s.scatter('weeds', 16, lambda x, z: 1.0 if (inside((x, z), Spoly) and z < 72) or inside((x, z), Npoly) else 0.0, margin=0.3, gap=1.5, dims={'n': 4, 'r': 1.5}, circles=False)

    # ------------------------------------------------------------ links between the levels, and out
    lk = lambda id, kind, al, ap, bl, bp: OrderedDict(id=id, kind=kind, **{'from': OrderedDict(level=al, pos=[rnd(ap[0] * 5, 1), rnd(ap[1] * 5, 1)]), 'to': OrderedDict(level=bl, pos=[rnd(bp[0] * 5, 1), rnd(bp[1] * 5, 1)])})
    links = [lk('D-ramp-s', 'stairs', 'ground', s_foot, 'bridge', road_pt(-SPAN / 2)),
             lk('D-ramp-n', 'stairs', 'bridge', road_pt(SPAN / 2), 'ground', n_foot),
             lk('D-slope', 'slide', 'ground', (26, 48.6), 'river', (26, 45.4)),
             lk('D-beach', 'stairs', 'ground', (35.2, 55.6), 'river', (36.4, 53.0)),
             lk('D-wash', 'stairs', 'ground', (60, 48.6), 'river', (59.2, 50.8)),
             lk('D-ford', 'stairs', 'ground', (103, 68.6), 'river', (103, 65.6))]
    s.write('River Ivlis', {'stacked': 'open', 'entry': 'ground'}, levels=[river, deck], links=links)
    # the river is the level that meets the land beyond the map (the lowest ground), so it goes first
    out = os.path.join(ROOT, 'locations', 'ch02', 'D', 'scene.json')
    scene = json.load(open(out), object_pairs_hook=OrderedDict)
    scene['levels'].sort(key=lambda l: 0 if l['id'] == 'river' else 1)
    json.dump(scene, open(out, 'w'), indent=1, ensure_ascii=False)


if __name__ == '__main__':
    build()
