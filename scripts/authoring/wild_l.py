#!/usr/bin/env python3
"""L. Lake Zarovich (p.38): the fishers' landing on the south shore, north of Vallaki. The book prints no map; this is
the inferred site. 650 x 750 ft, origin at the north-west corner, north -z. The lake fills the north: a pale pebble
shelf off the landing that ends in one hard line, ink-black water beyond it and straight off the Watch Knoll's bluff,
a mist lid from about 300 ft out. On the shore: the shingle with three hauled boats, the net shed, the fallen
pier-pine, the brook and its reeds, the Zarovich trail climbing south to Vallaki's north gate. Bluto's boat sits 400 ft
out; a second level is the lakebed 40 ft under it. Land is the datum (= the lake surface); the knoll is a faceted
landform up to 35 ft whose height function is shared with the prop module (knollH in kit/sites/wild-l.ts)."""
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wildlib import *  # noqa: F401,F403
from wildlib import Site, Level, AMB, catmull, ribbon, inside, rnd, heading, facing, turn, blob
from collections import OrderedDict

W_FT, H_FT = 650, 750


def knollH(x, z):
    """The Watch Knoll's height (ft) at map feet (x, z); the same numbers as knollH() in wild-l.ts."""
    zb = 506 + 12 * min(1, max(0, x / 130))
    if z < zb: return 0.0
    u = (x - 55) / (70 if x < 55 else 80); v = (z - 552) / 88 if z > 552 else 0.0; r2 = u * u + v * v
    if r2 >= 1: return 0.0
    return 35 * (1 - r2) ** 1.35 + 1.6 * math.sin(x * 0.11) * math.cos(z * 0.09) * (1 - r2)


def C(p):
    """map feet -> cells"""
    return (p[0] / 5, p[1] / 5)


def line_dims(pts, origin, prefix=''):
    d = {prefix + 'n': len(pts)}
    for i, (x, z) in enumerate(pts):
        d[f'{prefix}x{i}'] = rnd(x - origin[0], 2); d[f'{prefix}z{i}'] = rnd(z - origin[1], 2)
    return d


def zline(L, x):
    for i in range(len(L) - 1):
        if L[i][0] <= x <= L[i + 1][0]:
            t = (x - L[i][0]) / ((L[i + 1][0] - L[i][0]) or 1); return L[i][1] + (L[i + 1][1] - L[i][1]) * t
    return L[0][1] if x < L[0][0] else L[-1][1]


def build():
    s = Site('L', 'Lake Zarovich', W_FT // 5, H_FT // 5, 1238)
    lv = s.lv; lv.id, lv.name, lv.ceiling = 'shore', 'Shore and lake surface', 40

    def P(kind, x, z, rot=0, dims=None, y=0, label=None, desc=None, key=None):
        return s.prop(kind, C((x, z)), rot=rot, dims=dims, y=y, label=label, desc=desc, key=key)

    # ------------------------------------------------------------------ the shoreline and the lake
    # under the bluff the shore is the bluff line itself (z = 506 + 12x/130); east of it it wanders out to the landing
    bluff = [(x, 506 + 12 * x / 130) for x in range(0, 131, 10)]
    east = catmull([(130, 518), (150, 524), (175, 532), (200, 540), (225, 547), (250, 550), (300, 552), (350, 551), (400, 549), (440, 547),
                    (470, 545), (505, 543), (522, 544), (530, 549), (540, 545), (565, 543), (600, 540), (650, 542)], 3)
    SH = bluff + [(rnd(x), rnd(z)) for x, z in east[1:]]
    lake = [(0, 0), (W_FT, 0)] + list(reversed(SH))
    s.room('L', 'Lake Zarovich', [C(p) for p in lake], 'shallow-water',
           'Black, utterly still water under a grey sky, so calm it holds the clouds and the pines upside down. Off the landing a shelf of pale pebbles shows through the clear shallows, then ends in one sharp line where the water turns to ink. Some way out a low mist lies on the lake and hides the far shore. Far out, a single rowboat sits without moving, a hunched figure in it holding a pole.',
           'Bluto Krogarov (commoner, in a trance) sits 400 ft out with Arabelle bound in a sack at his feet, prone so nobody on shore can see or hear her. Watch him for several minutes or row toward him and he drops the sack overboard and waits. Rescue in time: DC 15 Strength (Athletics) from the shore, DC 10 from a rowboat (a rowboat makes about 13 ft a round, so the check stands for the whole dash). On a failure she drowns unless you allow the dive to the lakebed level (40 ft, murk, two more checks; she has 2 hp). Snowmelt water: a swimmer in it longer than a minute or two may need a Constitution save. Rescued, she demands to go to her father Luvash at the Vistani camp (N9).')
    s.keep.append(([C(p) for p in lake], 0.4))

    # the drop-off: the shelf runs ~60 ft out from the landing; under the bluff there is none; it bulges in under the pier-pine
    DROP = [(135, 519), (152, 509), (170, 499), (190, 493), (240, 490), (300, 489), (360, 490), (400, 491), (422, 499), (440, 507), (456, 500), (480, 491),
            (520, 492), (560, 497), (610, 500), (650, 503)]
    shelf_shore = [p for p in SH if p[0] >= 135]
    o = (380, 505)
    d = line_dims(DROP, o, 'd'); d.update(line_dims(shelf_shore, o, 's')); d['stones'] = 460
    drop = P('l-drop-off', *o, dims=d, label='The drop-off', desc='Clear shallows over pale pebbles, every stone visible, ending in a hard line where the bed falls away and the water goes black.')
    drop['vis'] = 'explored'   # the water's sheets are drawn on their own, after the lake's floor (see WATER_Y in wild-l.ts)
    o = (325, 250)
    d = line_dims([(W_FT, DROP[-1][1] - 3.8), (W_FT, 0), (0, 0), (0, 506)], o)       # east end of the drop, round the north, to the bluff
    d.update(line_dims([p for p in SH if 0 < p[0] <= 130], o, 'b'))                  # the shore under the bluff, out to the drop's west end
    d.update(line_dims(DROP, o, 'd'))
    d.update(mx0=-o[0], mx1=W_FT - o[0], mz0=-o[1], sw=506 - o[1], se=540 - o[1])  # the black steps out past the map's edges
    d.update(ux0=-o[0] + 20, ux1=W_FT - o[0] - 20, uz0=180 - o[1], uz1=470 - o[1])  # the sky's lenses (u: not b, which is the bluff line)
    d['fade'] = 480                                                                # the black thins away over this far past the edges
    P('l-lake-mirror', *o, dims=d)['vis'] = 'explored'
    m = P('l-mist-shelf', 325, 5, dims={'dz': -155, 'len': 1450, 'd': 800, 'span': 260, 'h': 3, 'edge': 300}, label='Mist on the water', desc='A flat lid of mist lies a few feet over the lake from about three hundred feet out, swallowing the far shore.')
    m['vis'] = 'explored'

    # ------------------------------------------------------------------ the Watch Knoll and its bluff
    P('l-watch-knoll', 70, 575, dims={'ox': 70, 'oz': 575, 'w': 140, 'd': 650})
    P('l-bluff-face', 65, 515, dims={'ox': 65, 'oz': 515, 'w': 132, 'px': 46}, label='The bluff', desc='A bare rock face drops thirty-odd feet straight into black water; a stunted pine leans out from its lip.')
    knoll_room = [(0, 506), (65, 512), (130, 518), (138, 552), (128, 600), (100, 632), (55, 641), (0, 636)]
    s.room('L-knoll', 'The Watch Knoll', [C(p) for p in knoll_room], 'grass',
           'A wooded knoll of broken rock rises at the west end of the shore, its north side a sheer bluff into deep water. From the lip you can see the whole landing and the boat far out on the lake.',
           'The natural place to watch Bluto: several minutes here and he drops the sack. From the knoll you see the boat and, when it happens, the sack going over and the ring it leaves; never the child. Bluto\'s line ticking against his hull carries this far. The bluff is about 35 ft (climbing down: DC 12 Athletics, or jump into deep water). Wolves gather in the pines on its south slope (see them on the map).')
    s.clear(11, 106, 3.6)        # the lip at the summit stays open: the watching place

    # ------------------------------------------------------------------ the landing
    land_poly = [(222, 546), (250, 550), (300, 552), (350, 551), (378, 550), (382, 596), (330, 601), (300, 603), (265, 600), (220, 594)]
    s.room('L-landing', 'The Landing', [C(p) for p in land_poly], 'dirt',
           'A strip of grey shingle and packed mud, the only break in the pines along this shore. Three small rowboats are dragged up bow-first, their sterns still in the water. Fish scales glint in the gravel; nothing laps at the stones.',
           'The fishers\' boats: free for the taking, each holds five safely (six or more: DC 10 Dexterity or swamp). Locals say crossing by boat is shorter and safer than walking round through wolf country: about 1.4 mi straight across, near an hour\'s rowing in the mist with nothing to steer by but the mountain. Fishing stopped because of the wolves.')
    d = line_dims([(p[0], p[1] + (1.5 if 240 < p[0] < 370 else 0.5)) for p in land_poly], (300, 575))
    d.update(line_dims([(228, 593), (260, 597), (291, 599)], (300, 575), 'b'))
    d.update(line_dims([(309, 599), (340, 597), (376, 593)], (300, 575), 'c'))
    d.update(line_dims([(285, 553), (286, 570), (288, 588)], (300, 575), 'k0'))
    d.update(line_dims([(316, 553), (315, 572), (313, 590)], (300, 575), 'k1'))
    d['sx'], d['sz'] = 0, -30
    P('l-shingle-beach', 300, 575, dims=d)
    s.keep.append(([C(p) for p in [(218, 535), (385, 535), (390, 604), (300, 608), (215, 600)]], 0.3))

    for i, (x, z, r) in enumerate([(270, 556, -84), (300, 558, -92), (330, 556, -98)]):
        P('rowboat', x, z, rot=r, dims={'hauled': 1, 'oars': 1}, label='Rowboat', desc='A small clinker rowboat dragged bow-first up the shingle, its stern still wet, oars shipped. It holds five.')
    for i, x in enumerate(range(250, 351, 20)):
        P('l-mooring-stake', x, 540 + (i % 2) * 1.2, dims={'painter': 1 if x in (270, 330) else 0, 'seed': i + 1}, label='Mooring stake' if i == 0 else None,
          desc='Six weathered stakes in the ankle-deep shallows, rope-burned at the top.' if i == 0 else None)
    # west end: Bluto's drift log, the offering stone, his trotline under the reeds
    P('l-drift-log', 232, 576, rot=heading(1, -0.18), label='Drift log', desc='A bleached drift log scored by boat keels; three empty wine jugs and a line bobbin beside it. It smells of sour wine.')
    P('l-offering-stone', 214, 545, label='Offering stone', desc='A flat stone half in the water, copper coins gone green, a fish-bone charm and a knotted ribbon pressed into the mud round it.')
    P('l-trotline', 205, 534, rot=heading(60, 4), dims={'len': 60}, label='Trotline', desc='A long line strung between two stakes, two dozen hooks hanging from it, each baited with bread, each bare.')
    # east end: the shed, the rack, the gutting slab and the midden
    P('net-shed', 355, 585, rot=180, label='Net shed', desc='A lean-to of silvered boards backed against the pines, open toward the water.')
    P('l-net-rack', 330, 593, dims={'len': 12}, label='Net rack', desc='A pole rack of tarred nets and cork floats, a coil of hempen rope at one end, bait buckets gone sour beneath.')
    P('l-scorched-fish', 360.3, 580.6, rot=180, dims={'h': 4.6}, label='Nailed fish', desc='A single dried fish nailed to the shed post, its scales blackened and split down one side.')
    P('l-gutting-slab', 386, 574, rot=12, label='Gutting slab', desc='A flat waist-high stone scored with knife marks and stained dark; a bone-handled knife is stuck in a crack.')
    P('l-offal-midden', 401, 600, dims={'r': 5}, label='Offal heap', desc='A low heap of fish bones and heads, long dried grey. Nobody has gutted anything here in a while.')
    s.keep.append(([C(p) for p in [(318, 576), (412, 566), (412, 610), (318, 610)]], 0.3))

    # the fallen pier-pine: roots on the bank, the trunk out over the shelf to the drop-off, the crown drowned beyond
    root, tip = (465, 568), (440, 512)
    P('l-pier-pine', *root, rot=heading(root[0] - tip[0], root[1] - tip[1]), dims={'len': 78, 'dry': 61}, label='The fallen pine',
      desc='A whole shore pine blown over into the lake, its root plate standing up on the bank and its crown sunk under the water; the bark along the top is worn smooth by boots.')
    s.keep.append(([C(p) for p in [(452, 555), (480, 560), (476, 582), (452, 580)]], 0.3))

    # ------------------------------------------------------------------ the brook, its reeds and the side path
    BR = [(652, 702), (625, 682), (600, 655), (578, 628), (560, 610), (546, 588), (536, 566), (531, 548)]
    bline = catmull(BR, 4)
    d = line_dims(bline, (590, 625)); d.update({f'w{i}': rnd(2.6 + 0.8 * (i / (len(bline) - 1)), 2) for i in range(len(bline))})
    P('l-brook', 590, 625, dims=d, label='Brook', desc='A cold clear brook slides down out of the trees into the lake through a bed of reeds.')
    s.road([C(p) for p in BR], 1.2, terrain=False)
    side = s.road([C(p) for p in [(408, 592), (440, 592), (480, 598), (522, 604), (560, 611), (600, 617), (650, 622)]], 0.5, floor='dirt')
    a, b = (578, 628), (546, 588)
    P('l-plank-crossing', 560, 610, rot=facing(b[0] - a[0], b[1] - a[1]), dims={'len': 11}, label='Plank crossing', desc='Two mossy planks laid on stones over the brook, one of them cracked through.')
    reeds = []
    for i in range(30):
        x = 482 + s.rng.random() * 120; zs = zline(SH, x)
        if abs(x - 531) < 5: continue
        reeds.append((x, zs - 10 + s.rng.random() * 20))
    for i in range(9): x = 132 + s.rng.random() * 48; reeds.append((x, zline(SH, x) - 3 - s.rng.random() * 6))
    for i, (x, z) in enumerate(reeds):
        P('reeds', x, z, dims={'r': rnd(2.2 + s.rng.random() * 2.4), 'n': 26}, label='Reed bed' if i == 0 else None, desc='Dense dry reeds either side of the brook mouth, the only cover at the water\'s edge.' if i == 0 else None)
        s.trees.append((x / 5, z / 5, 0.8))
    P('l-heron-bones', 574, 549, rot=30, label='Heron bones', desc='The skeleton of a heron, tangled in the reeds.')
    s.keep.append(([C(p) for p in [(476, 524), (606, 524), (606, 566), (476, 566)]], 0.2))
    s.keep.append(([C(p) for p in [(128, 512), (186, 512), (186, 534), (128, 534)]], 0.2))

    # ------------------------------------------------------------------ the Zarovich trail and the wolf-head stake
    TR = [(300, 598), (298, 625), (293, 650), (289, 675), (287, 700), (281, 722), (271, 742), (265, 752)]
    s.road([C(p) for p in TR], 0.55, floor='dirt', keep=False)
    s.road([C(p) for p in TR], 1.7, terrain=False)    # the pines stand back a little from the trail, so it shows under their crowns
    tline = catmull(TR, 4)
    s.room('L-trail', 'The Zarovich trail', [C((x, min(z, H_FT))) for x, z in ribbon(tline, 4.0)], 'dirt',
           'A single-file foot trail with handcart ruts, roots across it, climbing south through close dark pines toward Vallaki. Where it meets the shingle a wolf\'s skull stands on a pike.',
           'About 0.6 mi (12 to 15 minutes) to Vallaki\'s north gate, the gate to the lake, whose guards note who goes out. Check for a random encounter once each way. Old healed axe blazes and a faded strip of cloth on the trunks (DC 15 History or Investigation, or any Vallaki local) mark the search for Izek Strazni\'s sister, who ran into these woods the night a dire wolf took his arm on the walk home from the lake. After dark the dire wolves hunt here.')
    P('l-trail-ruts', 285, 675, dims=dict(line_dims(tline, (285, 675)), roots=11))
    P('l-wolf-head-stake', 305.5, 605, rot=-15, label='Wolf-head stake', desc='A pike with a weathered wolf skull on it, the jaw wired shut, and a painted board below with the town\'s motto half flaked away.')
    P('l-fish-crate', 301, 643, rot=35, label='Fish crate', desc='A rotted fish crate dropped at the bend, its slats sprung.')
    s.clear(305.5 / 5, 605 / 5, 1.2); s.clear(301 / 5, 643 / 5, 1.0)
    blazes = [(279, 679, 0), (296, 688, 0), (296, 696, 1), (278, 704, 0), (292, 714, 0), (272, 721, 0)]
    for i, (x, z, cloth) in enumerate(blazes):
        tx = zline([(zz, xx) for xx, zz in TR], z)   # trail x at this z
        P('l-blazed-pine', x, z, rot=facing(tx - x, 0), dims={'scale': 1.15 + 0.1 * (i % 3), 'cloth': cloth}, label='Blazed pine' if i == 0 else ('Pine with a strip of cloth' if cloth else None),
          desc='Old axe blazes on the trunks along the trail, long healed into pale scars.' if i == 0 else ('A strip of faded cloth is tied high on one branch.' if cloth else None))
        s.trees.append((x / 5, z / 5, 2.3))

    # ------------------------------------------------------------------ out on the water
    bp, brot = (360, 150), 18
    P('rowboat', *bp, rot=brot, dims={'oars': 1, 'pole': 0}, label="A rowboat far out", desc='A lone rowboat sitting dead still on the water, four hundred feet out; someone hunched in it, a pole in hand.')
    # Bluto sits slumped on the aft thwart (2.6 ft aft of the boat's middle) facing the stern, fists on his pole, which
    # rises past the transom over the water: its butt half a foot in front of his hips, 0.95 ft over the boards (0.35 ft
    # up), at 0.55 rad (BLUTO_POLE in wild-l.ts)
    hip_x = -2.45
    off = turn(hip_x - 0.5, 0, brot)
    P('l-fishing-pole', bp[0] + off[0], bp[1] + off[1], rot=brot + 180, dims={'len': 12, 'a': 0.55, 'y0': 1.3, 'held': 1})
    P('l-ripple-ring', *bp, dims={'r': 8, 'n': 4})
    P('l-black-tooth', 470, 90, rot=20, label='The Black Tooth', desc='A single dark rock breaking the surface, slick with weed, a pale band at the waterline and a rusted iron ring set in its top. Ravens sit on it.')
    bo = turn(hip_x, 0, brot)
    s.mob('l-bluto', C((bp[0] + bo[0], bp[1] + bo[1])), 'Bluto Krogarov (commoner, in a trance)', 'A hunched fisherman', rot=brot - 90, y=0.05,
          dm='A destitute Vallaki drunk who wants fish he can swap at the Blue Water Inn for wine; after a fishless week he means to give the lake a lucky Vistana child. He answers nothing and does nothing unless attacked; unarmed; neither helps nor resists. Watch him for several minutes or row out and he drops the sack. Killing him is murder of a citizen; dragged back to town he is a bargaining chip with the baron\'s guard.')
    so = turn(2.0, 0.1, brot)
    s.mob('sacked-child', C((bp[0] + so[0], bp[1] + so[1])), 'Arabelle, bound in a burlap sack (commoner, 2 hp)', 'A burlap sack', size='small', rot=brot, y=0.45,
          dm='Seven years old, Luvash\'s daughter, missing a little more than a day; bound with hempen rope, prone under the thwart, unseen and unheard from any point on shore (the knoll included). Revealed only by reaching the boat or when the sack hits the water. Rescued: alabaster skin, black hair, talks like an adult, sure a destiny awaits her; she demands to go to Luvash at the camp (N9), who lets the party choose a treasure from the wagon. If the Tempter card named her she joins gladly, but Luvash will not let her leave once home.')
    s.hidden('l-sinking-sack', C((bp[0] - 4, bp[1] - 5)), 'Where the sack goes in', 'Bubbles on the water', dims={'s': 0},
             dm='Once dropped it is under in a round, over deep water well past the drop-off; it reaches the silt 40 ft down after a failed rescue check (the lakebed level).')
    s.mob('swarm-of-ravens', C((470, 90)), 'Swarm of ravens (Keepers of the Feather watching)', 'Ravens on the rock', y=4.2, rot=200,
          dm='Optional, from the daytime table. They lift off when a boat comes within 60 ft. Not hostile; one may be a wereraven in raven form who carries word of a rescue to Vallaki by nightfall.')

    # ------------------------------------------------------------------ hidden things on the shore
    s.hidden('l-cache', C((353, 587)), 'Rope, sack and a child\'s ribbon (DC 12 Investigation)', 'Odds and ends in the shed', dims={'v': 2},
             dm='A coil of the same hempen rope that binds Arabelle and a burlap sack of the same weave; a child\'s hair ribbon snagged on a nail by the door. Proof Bluto bound her here.')
    s.hidden('l-cache', C((217, 551)), 'Coins in the mud: 11 cp, 1 sp and a silver charm (5 gp)', 'Something glinting in the mud', dims={'v': 0},
             dm='Vallakians\' small bribes to the lake for a catch; Bluto\'s idea of a sacrifice grew in this soil.')
    s.note(C((372, 578)), 'The nailed fish: blackened, split scales and a fused spine, killed by lightning (DC 13 Nature or Arcana). Fishers at the Blue Water Inn say it came off the north shore back when the Mad Mage was seen there.')
    s.note(C((432, 520)), 'The fallen pine: walking out to its end is DC 10 Dexterity (Acrobatics) on the wet bark; the end stands 60 ft closer to Bluto, over black water (advantage on the swim, not a lower DC).')
    s.note(C((372, 172)), "Bluto's boat: 400 ft from the landing's shore, about 420 ft from the knoll's lip.")
    s.note(C((300, 735)), 'South: the Zarovich trail to Vallaki\'s north gate, about 0.6 mi.')

    # ------------------------------------------------------------------ the woods: pines frame the shore, the set pieces stay clear
    def shore_z(x): return zline(SH, x)
    def density(cx, cz):
        x, z = cx * 5, cz * 5
        if z < shore_z(x) + 14: return 0.0
        if knollH(x, z) > 0: return 0.5 if knollH(x, z) < 30 else 0.25
        band = z - shore_z(x)
        if 150 < x < 470 and band < 70: return 0.18
        if 470 <= x and band < 40: return 0.3
        return 0.95
    s.pines(4200, density=density, gap=2.3, margin=0.9, scale=(1.0, 1.55))
    s.undergrowth(bushes=40, boulders=14, dead=3, stumps=8, logs=6, density=lambda cx, cz: 0.0 if cz * 5 < shore_z(cx * 5) + 18 else 1.0)
    s.scatter('boulder', 12, lambda cx, cz: 1.0 if knollH(cx * 5, cz * 5) > 4 else 0.0, margin=0.3, gap=1.6, dims=lambda g: {'r': rnd(1.6 + g.random() * 2.2)})

    # wolves in the pines on the knoll and the western shore, facing the landing
    for i, (x, z) in enumerate([(36, 612), (64, 622), (92, 633), (122, 648), (150, 664), (24, 664)]):
        s.mob('wolf', C((x, z)), 'Wolf (Strahd\'s pack)', 'A grey wolf', rot=heading(300 - x, 575 - z), y=rnd(knollH(x, z), 2),
              dm='Optional: the reason Vallaki stopped fishing. Six here, or roll the daytime table (3d6). They come at dusk, on blood in the water, or if the party lingers an hour on the shingle; they come down the knoll and cut the trail to town first.')
    for i, (x, z) in enumerate([(284, 700), (276, 726)]):
        s.mob('dire-wolf', C((x, z)), 'Dire wolf (night, on the trail)', 'A huge wolf', size='large', rot=heading(0, -1),
              dm='Only after dark, or if the party carries Arabelle back along the trail at night (1d6 if rolled). This is where a dire wolf took young Izek Strazni\'s arm.')

    # everything standing on the knoll stands on its slope
    for o in lv.objects:
        if o['kind'] in ('l-watch-knoll', 'l-bluff-face') or o.get('vis') == 'dm-note': continue
        h = knollH(o['pos'][0], o['pos'][2])
        if h > 0 and o['pos'][1] == 0: o['pos'][1] = rnd(max(0, h - (0.4 if o['kind'] in ('pine', 'dead-tree', 'stump', 'bush') else 0.2)), 2)
    s.spawn(C((268, 742)))

    # ------------------------------------------------------------------ the lakebed, forty feet down
    bed = Level('lakebed', 'Lakebed beneath the boat', -40, 36, ambient='fog', interior='rubble', exterior='rubble', north='-z')
    bed_poly = [(200, 40), (560, 40), (560, 480), (200, 480)]
    bed.room('L-lakebed', 'The lakebed', [C(p) for p in bed_poly], 'marsh', page=38)
    s.desc['L-lakebed'] = ('Forty feet down, cold grey silt in long ripples, water-logged trunks half buried, a rotted rowboat on its side. A faint green light falls from the surface; the murk closes in a few strides off.',
                           'For a dive after a failed rescue or a swimmer searching the bottom: murk limits sight to 10 ft; reaching the sack takes two more checks (your call), and Arabelle has 2 hp. At the south edge the bed climbs to the shelf, where the fallen pine\'s crown hangs over the drop-off. The sunken skiff holds a rusted anchor and a sealed clay jar.')
    def B(pid, kind, x, z, rot=0, dims=None, y=0):
        bed.prop(pid, kind, C((x, z)), None, rotY=rnd(rot, 1), dims=dims, y=y)
    B('silt', 'l-lakebed-silt', 380, 260, dims={'w': 360, 'd': 440, 'lx': bp[0] - 380, 'lz': bp[1] - 260})
    bed.objects[-1]['vis'] = 'explored'   # drawn on its own: it carries the switch that clears the scenery over the lakebed
    B('skiff', 'l-sunken-skiff', 330, 172, rot=32)
    B('crown', 'l-drowned-crown', 436, 466, rot=heading(25, 56))
    for i, (x, z, L, r, rot) in enumerate([(262, 118, 26, 1.3, 20), (424, 206, 34, 1.5, 125), (296, 332, 22, 1.1, 70), (482, 378, 30, 1.4, 160), (240, 420, 18, 1.0, 40), (520, 120, 24, 1.2, 95)]):
        B(f'trunk{i}', 'log', x, z, rot=rot, dims={'len': L, 'r': r})
    for i, (x, z) in enumerate([(300, 250), (390, 120), (470, 300), (250, 300), (410, 420)]):
        B(f'rock{i}', 'boulder', x, z, dims={'r': 2 + i * 0.4})
    bed.obj('sack', 'l-sinking-sack', C(bp), 'hidden-object', 'L', 'The sack, if nobody reached it', dims={'s': 1})
    bed.objects[-1]['playerLabel'] = 'A sack in the silt'; bed.objects[-1]['dm'] = 'Where Arabelle ends up after a failed rescue check, unless the dive reaches her.'
    bed.obj('jar', 'l-cache', C((333, 175)), 'hidden-object', 'L', 'Sealed clay jar: 23 sp', dims={'v': 1})
    bed.objects[-1]['playerLabel'] = 'A clay jar'; bed.objects[-1]['dm'] = 'An earlier drowned fisher\'s wine money, in the sunken skiff beside its rusted anchor.'
    bed.note('note1', C((230, 60)), 'L', 'Murk: sight 10 ft. Cold: a swimmer down here more than a minute may need Constitution saves.')

    def lk(id, kind, al, ap, bl, bp_):
        return OrderedDict(id=id, kind=kind, **{'from': OrderedDict(level=al, pos=[rnd(ap[0], 1), rnd(ap[1], 1)]), 'to': OrderedDict(level=bl, pos=[rnd(bp_[0], 1), rnd(bp_[1], 1)])})
    links = [lk('L-dive', 'shaft', 'shore', (bp[0] - 4, bp[1] - 5), 'lakebed', (bp[0] - 2, bp[1] + 2)),
             lk('L-dive-pine', 'shaft', 'shore', (432, 506), 'lakebed', (434, 462))]
    s.write('Lake Zarovich', {'valley': True, 'entry': 'shore'}, levels=[bed], links=links)


if __name__ == '__main__':
    build()
