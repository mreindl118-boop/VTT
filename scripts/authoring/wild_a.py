#!/usr/bin/env python3
"""A. Old Svalich Road (p.33): the one road in Barovia that ends in a wall. The Mists stand across the east edge; two
giant trees frame the road where it comes out of the fog; the road runs west, drowned in black mirror-pools on a shelf
below a weeping bank, and closes into a dark tunnel of trunks toward the gates. 640 x 420 ft, north at -z, one level:
the forest shelf above the bank is a 7-ft prism, the fog hollow south of the road is marsh under ground fog."""
import math, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wildlib import *

FT = 5.0
def c(ft):
    """feet -> cells"""
    return ft / FT
def ftpoly(poly):
    return [[rnd(x * FT, 3), rnd(z * FT, 3)] for x, z in poly]

# the forest shelf above the weeping bank (cells): its south face is the bank, its ends chamfer down to the road's level
SHELF = [(16, 0), (18, 12), (23, 26), (30, 36.5), (112, 36.5), (114, 30), (115.5, 16), (116, 0)]
SHELF_H = 7
# the fog hollow south of the road
HOLLOW = [(24, 62), (34, 59.5), (48, 60.5), (62, 59), (78, 58.5), (94, 60), (106, 62.5), (113, 66), (114, 84), (22, 84)]


def build():
    s = Site('A', 'Old Svalich Road', 128, 84, 1301)
    lv = s.lv

    # ------------------------------------------------------------ the road, out of the fog and down to the west
    ctrl = [(128, 41), (112, 41.2), (96, 41.8), (78, 42.5), (66, 43), (50, 43), (36, 43.6), (20, 44.4), (8, 44.8), (0, 45)]
    road = s.road(ctrl, 2.0, 'dirt', per=8)
    def road_at(x):
        best = min(range(len(road)), key=lambda i: abs(road[i][0] - x)); return road[best]
    # two deep wheel ruts the width of a vardo, brimming with black water, all the way from inside the fog to the west edge
    nseg = 16
    for i in range(nseg):
        (px, pz), (dx, dz) = along(road, (i + 0.5) / nseg)
        s.prop('a-wagon-ruts', (px, pz), rot=heading(dx, dz), dims={'len': 42, 'w': 6}, key='A')
    # the turning circle, just short of the threshold giants
    s.prop('a-turning-circle', (111, 42), dims={'r': 25}, label='Turning circle',
           desc='A ring of churned ruts and hoofprints fifty feet across, ridged mud holding black water, where carts have swung round and gone back.')
    s.clear(111, 42, 7)

    # ------------------------------------------------------------ the Mists and the threshold giants
    o = s.prop('a-mist-wall', (124.5, 42), rot=90, dims={'len': 440, 'h': 60, 'd': 40}, label='The Mists',
             desc='A wall of grey fog stands across the road behind you, taller than the trees, swelling a few feet forward and drawing back like something breathing. Nothing shows inside it.')
    o['vis'] = 'explored'
    s.keep.append((rect(120, 0, 128, 84), 0))
    for i, (x, z, sd) in enumerate(((119.6, 30.4, 11), (120.8, 52.4, 12))):
        s.prop('a-giant-pine', (x, z), rot=0, dims={'r': 5.5, 'threshold': 1, 'seed': sd}, key='A-gate', label='Threshold giant',
               desc='A tree eleven feet through, its bark fissured like dry mud. Bare lower limbs forty feet long reach east into the fog as if holding it back; the crown is lost in grey.')
        s.clear(x, z, 4.6)
    s.prop('a-skull-blaze', (118.45, 30.4), rot=facing(-1, 0), dims={'h': 8}, key='A-gate', label="Hunters' skull blaze",
           desc='A wolf skull spiked to the bark eight feet up, facing down the road. Beneath it a deep-cut arrow and a column of tally scratches.')
    s.hidden('a-paw-prints', (116.5, 41), 'Fresh dire-wolf prints', 'Big paw prints', rot=0, dims={'len': 45},
             desc='Paw prints the size of a bear\'s, fresh in the mud, leading out of the fog and west along the ruts.',
             dm='DC 10 Wisdom (Survival): something very large passed within the hour, heading west ahead of the party (or behind them, if they walk in).', key='A-gate')

    # ------------------------------------------------------------ the pool shelf: the seep, the Long Mirror, the lesser pools
    mx, mz = 66, 42.4
    _, (mdx, mdz) = along(road, 0.49)
    s.prop('a-black-pool', (mx, mz), rot=heading(mdx, mdz), dims={'w': 70, 'd': 22, 'seed': 1}, key='A-mirror', label='The Long Mirror',
           desc='Still, ink-black water fills the road from bank to bank for seventy feet. It is so smooth it shows the giants\' crowns upside down, which the eye cannot find upright through the fog.')
    s.clear(mx, mz, 7.5)
    lesser = [(43, 39.6, 20, 13, 21), (52, 45.6, 16, 11, 22), (79, 39, 24, 14, 23), (84, 46.4, 15, 10, 24), (91, 41, 18, 12, 25), (97, 47.6, 22, 13, 26), (60, 38.4, 13, 9, 27)]
    for x, z, w, d, sd in lesser:
        s.prop('a-black-pool', (x, z), rot=int(s.rng.random() * 180), dims={'w': w, 'd': d, 'seed': sd}, key='A', label='Mirror-pool',
               desc='A still black pool ringed with soft mud that holds every footprint. It does not ripple.')
        s.clear(x, z, c(max(w, d)) / 2 + 1.0)
    # the spring weeps from the bank, crosses the road in a rill and drains south into the hollow
    for (ax, az), (bx, bz) in (((60, 37.0), (61.2, 40.4)), ((61.2, 44.6), (59.5, 54)), ((59.5, 54), (58, 66))):
        L = math.hypot(bx - ax, bz - az) * FT
        s.prop('a-seep-rill', ((ax + bx) / 2, (az + bz) / 2), rot=heading(bx - ax, bz - az), dims={'len': L}, key='A')
    s.prop('a-seep-rill', (60, 36.9), rot=90, dims={'len': 6}, key='A', label='The seep', desc='Cold water weeps out of the black earth of the bank, iron-tasting, and runs glinting across the road.')
    s.hidden('a-trinket', (69, 45), 'Trinket in the mud', 'Something in the mud', dm='Half sunk at the rim of the Long Mirror: roll on the Trinkets table (appendix A).', key='A-mirror')

    # ------------------------------------------------------------ the colonnade of giants and the fallen one
    north = [(18, 32.5, 4.6, 1), (36, 33.5, 5.5, 2), (58, 33.0, 6.0, 3), (80, 33.5, 5.2, 4), (104, 33.0, 4.8, 5)]
    south = [(28, 53, 5.0, 6), (50, 54, 5.8, 7), (72, 55, 4.4, 8), (94, 54.4, 5.4, 9)]
    for x, z, r, sd in north + south:
        on_shelf = inside((x, z), SHELF)
        s.prop('a-giant-pine', (x, z), rot=int(s.rng.random() * 360), dims={'r': r, 'seed': sd}, y=SHELF_H if on_shelf else 0, key='A', label='Giant tree',
               desc='A trunk eight to twelve feet across, far bigger than any pine of the valley, its roots spilling twenty feet over the verge. The lower limbs are bare and claw upward; the crown is gone in the fog sixty feet up.')
        s.clear(x, z, c(r) * 2.3 + 1.2)
    # the fifth south giant, toppled: root plate at (562, 262), hollow mouth at (455, 242), bridging the pool at (485, 238)
    rp, hm = (112.4, 52.4), (91, 48.4)
    fc = ((rp[0] + hm[0]) / 2, (rp[1] + hm[1]) / 2); fdx, fdz = hm[0] - rp[0], hm[1] - rp[1]; flen = math.hypot(fdx, fdz) * FT
    s.prop('a-fallen-giant', fc, rot=heading(fdx, fdz), dims={'len': flen, 'r': 4.5}, key='A', label='The fallen giant',
           desc='A toppled giant more than a hundred feet long. Its root plate stands torn out of the ground like a wall at the east end; the far end is hollow for its last twenty feet where it bridges a pool. Nine feet to the top.')
    s.keep.append((oriented_rect(fc[0], fc[1], fdx, fdz, c(flen) / 2 + 2.5, 2.6), 0.8))
    s.hidden('a-leather-bundle', (91.4, 48.5), 'Leather-wrapped bundle', 'A bundle', y=2.2, key='A',
             desc='A tied bundle of leather stuffed into the hollow mouth of the trunk.', dm='A set of drab Barovian common clothes: a werewolf\'s or wereraven\'s stash for after the change.')
    lv.objects[-1]['container'] = {'contents': 'One set of plain Barovian common clothes, folded and dry.'}
    s.prop('a-wolf-carcass', (96, 44.8), rot=heading(-1, 0.2), key='A', label='Wolf-kill',
           desc='A grey wolf dead on its side at the road\'s edge, two boar-spears and three crossbow bolts in it, a day old. One spear shaft carries tally cuts.')
    s.clear(96, 44.8, 2.2)
    s.hidden('a-boot-tracks', (92.5, 45.6), 'Boot tracks west', 'Tracks in the mud', rot=0, dims={'len': 34}, key='A',
             desc='Boot prints in the mud leading west along the verge.', dm='DC 10 Wisdom (Survival): two hunters, one limping, walking back toward the gates a day ago. The same boots ring the turning circle, where a cart turned.')

    # ------------------------------------------------------------ the weeping bank and the forest shelf above it
    s.prop('prism', (0, 0), dims={'h': SHELF_H, 'y': 0, 'color': 0x3d5241}, key='A-shelf'); lv.objects[-1]['pos'] = [0, 0, 0]; lv.objects[-1]['polygon'] = ftpoly(SHELF)
    # the druids' false trail: a root ladder up the bank, then a foot trail north through the trees to the pit
    trail = s.road([(70, 37.6), (70.5, 33), (72, 26), (74, 18), (75.5, 12), (76, 8.5)], 0.5, terrain=False)
    s.prop('prism', (0, 0), dims={'h': 0.15, 'y': SHELF_H, 'color': 0x5e4d3c}, key='A-shelf'); lv.objects[-1]['pos'] = [0, 0, 0]
    lv.objects[-1]['polygon'] = ftpoly([(rnd(x), rnd(z)) for x, z in ribbon(trail[2:], 0.5)])
    s.hidden('a-pit-tarp', (76, 8), 'Spiked pit under a tarp', 'Forest floor', y=SHELF_H, dims={'v': 0}, key='A-shelf',
             desc='Pine needles and twigs over level ground, like everywhere else under these trees.', dm='A 10-ft spiked pit under a twig-and-needle tarp at the end of the druids\' false trail (DMG spiked pit). Passive Perception 15+ notices the ground is too even.')
    lv.objects[-1]['vis'] = 'trap'
    s.clear(76, 8, 2.6)
    # the dug grave among the roots of the first giant, the Vistani bandits at work on it
    s.hidden('a-grave', (24, 14), "Soldier's grave, broken open", 'Broken cairn', y=SHELF_H, rot=20, dims={'v': 1}, key='A-shelf',
             desc='A cairn eight feet long has been pulled apart: a dark hole, spoil heaped beside it, a spade standing in the spoil, bones in rusted mail half hauled out.',
             dm='The Vistani bandits\' work. If they are not present, roll: 25% the cairn is intact (set dims v to 0): bones in rusted chain mail with corroded weapons, nothing of value.')
    s.clear(24, 14, 3)
    s.hidden('a-pipe-smoke', (25.2, 13.2), 'Pipe smoke', 'Smoke', y=SHELF_H, key='A-shelf', desc='A thin thread of pipe smoke rises from the shelf above the bank, and with it low laughter.')
    for i, (x, z, v) in enumerate(((22.6, 13.2, 0), (26.2, 15.6, 1), (24.6, 11.2, 2))):
        s.mob('a-vistani-digger', (x, z), f'Vistani bandit {i + 1}', 'Vistani', y=SHELF_H, rot=int(s.rng.random() * 360), dims={'v': v}, key='A-shelf',
              dm='Day table (1d4+1 Vistani bandits, p.32): plundering the soldier\'s grave. They will guide the party for 100 gp (then roll a d12 for encounters and wolves leave the party alone); one carries a pouch of 2d4 gems worth 50 gp each. Also Strahd\'s spies: they report the party at dusk.')

    # ------------------------------------------------------------ the fog hollow, the game trail and the trap
    s.patch(HOLLOW, 'marsh')
    s.room('A-hollow', 'The fog hollow', HOLLOW, 'marsh', difficult=True,
           desc='South of the road the ground falls away ten feet into a boggy hollow filled with knee-deep fog. It moves against the wind, climbing toward the road between the trunks.',
           dm='Boggy: difficult terrain. At dusk the ground fog creeps up onto the road. Wolves close from here; something dead smells from the far side.')
    gtrail = s.road([(40, 45.6), (39, 50), (37.5, 58), (36.5, 66), (35, 74), (34, 83.5)], 0.5, 'dirt', per=6)
    s.hidden('a-wolf-trap', (40, 46.6), 'Hidden wolf trap', 'Pine needles', rot=30, key='A',
             desc='A drift of pine needles where a narrow animal trail meets the road.',
             dm='A rusted steel hunting trap under the needles (PHB hunting trap: DC 13 Dex save or 1d4 piercing and restrained). The front rank spots it with DC 15 Wisdom (Survival). Set by Barovian trappers; Strahd\'s wolves step round it.')
    lv.objects[-1]['vis'] = 'trap'
    s.clear(40, 46.6, 1.8)
    for x, z, w, d, h, sd in ((60, 76, 95, 50, 3.2, 1), (40, 73, 60, 38, 2.8, 2), (84, 75, 75, 44, 3.0, 3), (104, 67, 42, 30, 2.4, 4), (56, 63.5, 50, 22, 2.2, 5), (28, 64, 34, 24, 2.2, 6)):
        o = s.prop('a-ground-fog', (x, z), dims={'w': w, 'd': d, 'h': h, 'seed': sd}, key='A-hollow'); o['vis'] = 'explored'
    for x, z, w, d, sd in ((50, 70, 18, 12, 31), (74, 72, 22, 14, 32), (92, 68, 14, 10, 33), (36, 78, 16, 11, 34)):
        s.prop('a-black-pool', (x, z), rot=int(s.rng.random() * 180), dims={'w': w, 'd': d, 'seed': sd}, key='A-hollow')
        s.clear(x, z, c(w) / 2 + 0.8)
    for x, z in ((46, 66), (66, 74), (86, 70), (100, 73), (58, 80)):
        s.prop('reeds', (x + s.rng.random(), z + s.rng.random()), rot=int(s.rng.random() * 360), dims={'r': 2.5, 'n': 11}, key='A-hollow')

    # ------------------------------------------------------------ the Grey Mast and the tunnel west
    s.prop('a-raven-snag', (12, 60), rot=35, dims={'h': 90}, key='A', label='The Grey Mast',
           desc='A dead giant stripped of bark, silver-grey and ninety feet tall, its crown snapped off. Ravens sit along its broken limbs watching the road: the only treetop on this road that is not lost in fog.')
    s.clear(12, 60, 5)
    o = s.prop('a-ground-fog', (9, 45), dims={'w': 60, 'd': 26, 'h': 4, 'seed': 7}, key='A-tunnel'); o['vis'] = 'explored'

    # ------------------------------------------------------------ the woods: the frame, not the picture
    def shelf_edge(x, z):
        return min(seg_dist((x, z), SHELF[i], SHELF[(i + 1) % len(SHELF)]) for i in range(len(SHELF)))
    def density(x, z):
        if shelf_edge(x, z) < 1.4: return 0.0
        if x < 24: return 1.0                                     # the tunnel west: trunks unnaturally close
        near = line_dist((x, z), road)
        if near < 6.5: return 0.08                                # the verges belong to the giants and the pools
        if inside((x, z), SHELF): return 0.36                     # the shelf thins out
        if z > 58: return 0.85                                    # dense south, the hollow
        if x > 108: return 0.45                                   # the threshold: room for the giants
        return 0.55 if near < 11 else 0.75
    big = lambda x, z: (1.35, 1.8) if x < 24 and line_dist((x, z), road) < 9 else None
    s.pines(5200, density=density, gap=2.3, margin=1.6, scale=(0.95, 1.4), giant=big)
    s.pines(900, density=lambda x, z: 1.0 if x < 24 and shelf_edge(x, z) > 1.4 else 0.0, gap=1.7, margin=0.7, scale=(1.2, 1.7))
    under = lambda x, z: 0.0 if shelf_edge(x, z) < 1.4 else (1.0 if line_dist((x, z), road) < 12 else 0.5)
    s.scatter('bush', 44, under, margin=0.8, gap=1.2, dims=lambda g: {'scale': rnd(0.7 + g.random() * 0.8)})
    s.scatter('boulder', 12, under, margin=1.5, gap=1.5, dims=lambda g: {'r': rnd(1.5 + g.random() * 2.5)})
    s.scatter('dead-tree', 7, under, margin=1.4, gap=2.5, dims=lambda g: {'scale': rnd(0.9 + g.random() * 0.5)})
    s.scatter('stump', 6, under, margin=1.0, gap=1.2, dims=lambda g: {'r': rnd(0.9 + g.random() * 0.6)})
    s.scatter('log', 7, under, margin=1.8, gap=2.5, dims=lambda g: {'len': rnd(12 + g.random() * 10), 'r': rnd(0.9 + g.random() * 0.5)})
    # everything that landed on the shelf stands at its height
    for o in lv.objects:
        if o['pos'][1] == 0 and o['kind'] not in ('prism', 'mist') and inside((o['pos'][0] / FT, o['pos'][2] / FT), SHELF): o['pos'][1] = SHELF_H
    # the weeping bank along every exposed face of the shelf, the root ladder where the druids' trail climbs
    def bank(a, b, ladder=0, seed=0):
        ax, az = a; bx, bz = b; dx, dz = bx - ax, bz - az; L = math.hypot(dx, dz)
        nx, nz = dz / L, -dx / L
        if inside(((ax + bx) / 2 + nx * 0.6, (az + bz) / 2 + nz * 0.6), SHELF): nx, nz = -nx, -nz
        s.prop('a-root-bank', ((ax + bx) / 2 + nx * 0.14, (az + bz) / 2 + nz * 0.14), rot=facing(nx, nz), dims={'len': L * FT + 0.8, 'h': SHELF_H, 'ladder': ladder, 'seed': seed}, key='A-shelf')
    xs = [30, 38, 46, 54, 62, 68.8, 71.2, 78, 86, 94, 102, 112]
    for i in range(len(xs) - 1): bank((xs[i], 36.5), (xs[i + 1], 36.5), ladder=1 if xs[i] == 68.8 else 0, seed=i)
    for i in range(len(SHELF) - 1):
        a, b = SHELF[i], SHELF[i + 1]
        if a[1] == 0 and b[1] == 0: continue
        if a[1] == 36.5 and b[1] == 36.5: continue
        bank(a, b, seed=20 + i)
    for o in lv.objects:
        if o['kind'] == 'a-root-bank' and o.get('dims', {}).get('ladder'):
            o['label'] = 'The weeping bank (root ladder)'
            o['desc'] = 'A cut bank of black earth seven feet high runs along the north side of the road, laced with hanging roots, moss-slick and dripping everywhere. Here roots have been lashed into a ladder, and a foot trail leads up into the trees.'

    # ------------------------------------------------------------ keyed areas
    s.room('A', 'Old Svalich Road', clamp_poly([(rnd(x), rnd(z)) for x, z in ribbon(catmull(ctrl[1:], 6), 5.5)], 128, 84), 'grass',
           'A dirt road twenty feet wide, churned to black mud, running west out of the fog and downhill between trees far too big for this world. Still black pools lie in and beside it; two deep wheel ruts run straight through everything.',
           'Pools and ruts are difficult terrain for anyone wading. On foot the gates (B) are 5 hours west; in Vistani wagons half that. Check for a random encounter every 30 minutes (18+ on d20, then d12+d8 on the day or night table, p.29). The grade is about 6%: the north side is uphill, the south falls away.')
    s.room('A-gate', 'The threshold', [(105, 25), (121.5, 25), (121.5, 58), (105, 58)], 'grass',
           'Two giant trees stand half inside the fog, one each side of the road, their bare limbs reaching back into it. Between them the mud is ringed into a wide turning circle holding black water.',
           'Where every hook delivers the party: spawn them facing west with the fog at their backs. Going east is a dead end: the fog turns walkers around (DC 20 Con save each turn inside or a level of exhaustion that will not lift there) and, for a party trying to leave, use C\'s rule: one howl, a wolf more each round, five dire wolves after five rounds joined by twenty wolves, all breaking off when the party turns west (p.34).')
    hl, hw_ = 6.6, 1.7
    s.room('A-mirror', 'The Long Mirror', oriented_rect(mx, mz, mdx, mdz, hl, hw_), 'shallow-water', difficult=True,
           desc='The largest pool fills the road bank to bank, seventy feet of black glass one to three feet deep.',
           dm='Difficult terrain; carts must take it axle-deep or lead the horses up and along the bank. At night the ghost rises here, its reflection appearing before it does.')
    s.room('A-shelf', 'The forest shelf', SHELF, 'grass',
           'Above the bank the forest floor runs on seven feet higher, needles and roots under the giants.',
           'Climb the bank: DC 10 Strength (Athletics), or the root ladder at the druids\' trail. The dug grave and the Vistani are at the west end; the false trail runs north to a spiked pit. Wolves also come from up here.')
    s.room('A-tunnel', 'The tunnel west', [(0, 36), (24, 37.5), (24, 53), (0, 54)], 'grass',
           'At the west end the trunks stand so close the road looks walled, and the giants\' crowns close over it: a dark tunnel sloping down toward the valley.',
           'The only direction that looks like a way out. Barovian scouts (hunters) crouch behind a buttress root here with crossbows aimed east (passive Perception 16+ to notice).')

    # ------------------------------------------------------------ encounters (DM-only until revealed)
    for i, (x, z) in enumerate(((122, 41), (125.2, 38.4), (125.8, 44.2))):
        s.mob('dire-wolf', (x, z), f'Dire wolf {i + 1}', 'Huge wolf', size='large', rot=180, key='A-gate',
              dm='Random table, day or night (1d6 dire wolves, p.29-30): Strahd\'s wolves come up the road out of the fog behind the party; the first steps out between the threshold giants, the rest are shadows in the fog. They cannot be charmed or frightened.')
    for i, (x, z) in enumerate(((54, 74.5), (58.5, 77.5), (63, 75), (67.5, 78.5), (60.5, 71))):
        s.mob('wolf', (x, z), f'Wolf {i + 1}', 'Wolf', rot=int(s.rng.random() * 360), key='A-hollow',
              dm='Random table (3d6 wolves, p.29, p.33): howls from the hollow and the shelf give the party a few minutes to set up around the pools; then they close from both sides. They heed Strahd and cannot be charmed or frightened.')
    for i, (x, z) in enumerate(((66, 11), (70.5, 13.5), (74, 10), (79, 14), (72, 17.5))):
        s.mob('wolf', (x, z), f'Wolf {i + 6}', 'Wolf', y=SHELF_H, rot=int(s.rng.random() * 360), key='A-shelf',
              dm='The second half of the pack, on the shelf above the bank. They skirt the trappers\' pit and the wolf trap.')
    for i, (x, z) in enumerate(((21.6, 47.3), (23.2, 48.6))):
        s.mob('a-hunter', (x, z), f'Barovian scout {i + 1}', 'Hooded figure', rot=facing(1, -0.1), key='A-tunnel',
              dm='Random table (1d6 scouts, p.29). Village hunters looking for a missing young man, Dalvan Olensky, whose body lies at C (p.34). Light crossbows aimed up the road; they lower them once they see the party is no threat, ask for help, or point west and leave.')
    for i, (x, z) in enumerate(((11, 58.6), (13.6, 61.2))):
        s.mob('a-raven-flock', (x, z), f'Swarm of ravens {i + 1}', 'Ravens', rot=int(s.rng.random() * 360), key='A',
              dm='Random table (1d4 swarms of ravens, p.29, p.32), perched in the Grey Mast. Not hostile: one bird shadows the party along the verge; the swarms stay with the party to the next settlement and harry anything that attacks it. Ravens are never to be harmed (p.26).')
    s.mob('a-wereraven', (14.4, 57.6), 'Wereraven (raven form)', 'Large raven', rot=200, key='A',
          dm='50% alternative to the swarms (p.29, p.32): circles above the Grey Mast, flies off west when noticed and returns at a distance. Stealth vs passive Perception; shadows the party 1d4 hours, then flies home to the Keepers of the Feather.')
    s.mob('a-skeletal-rider', (100, 41.2), 'Skeletal rider on a warhorse skeleton', 'A rider', size='large', rot=180, key='A',
          dm='Random table (p.29, p.31): rides west out of the fog along the ruts, through the turning circle and past the party, a rusted lantern raised that gives no light. Rider and mount died trying to leave through this very fog and ride the valley seeking another way out. It ignores the party unless attacked; once both are destroyed it never recurs.')
    s.mob('ghost', (mx, mz), 'Ghost of the Long Mirror', 'A pale figure', rot=90, key='A-mirror',
          dm='Night table (p.29, p.30): rises from the Long Mirror, its reflection first. It hisses that no one will ever know they died here, then attacks. A possessed host is led to the gates of Ravenloft (J) and thrown into the chasm.')
    for i, (x, z) in enumerate(((100, 50.1), (103.6, 50.75))):
        s.mob('a-trapper', (x, z), f'Werewolf in human form {i + 1}', 'Trapper', y=9, rot=facing(-0.3, -1), key='A',
              dm='Day table (1d6 werewolves in human form, p.29, p.32): sitting on the fallen giant, a big man in a tattered grey cloak with pelts over his shoulder, leaning on a boar spear, hailing the party as a trapper. They befriend the party to check for silvered weapons, then attack in hybrid form or part company; the pack is within whistling distance in the hollow.')
    # the Vistani-wagon arrival: two vardos on the ruts, shown only when that hook is used
    for i, x in enumerate((107.5, 101.5)):
        pz = road_at(x)[1]
        s.hidden('a-vardo', (x, pz), f'Vistani vardo {i + 1}', 'Painted wagon', rot=heading(-1, 0), dims={'v': i * 2}, key='A-gate',
                 desc='A barrel-topped Vistani wagon, its paint faded by the weather, standing in the ruts.',
                 dm='Mysterious Visitors (p.21): if the party came with the Vistani, reveal both wagons and spawn the party at (560, 205) ft beside them. The Vistani drive straight through B, E and F to Madam Eva at G without stopping.')

    # ------------------------------------------------------------ notes
    s.note((124, 35), mists_note(), key='A-gate')
    s.note((113, 47.5), 'Dead end with teeth: the eastern gates do not open for anyone leaving without Vistani, and the fog chokes anyone who skirts them (p.34). Only when Strahd is destroyed does the road east clear.', key='A-gate')
    s.note((66, 47.8), 'The Long Mirror and the lesser pools are difficult terrain (1-3 ft of water, soft mud); the ruts are ankle-deep. Make the pool shelf the arena: dire wolves from the fog behind, wolves from both flanks.', key='A-mirror')
    s.note((118, 27), 'The skull blaze: DC 12 Wisdom (Survival) reads it as a hunters\' sign: wolves own the road beyond, go back. The tally cuts match a spear shaft in the wolf-kill, so the same two hunters were here within the last day (p.96).', key='A-gate')
    s.note((105, 38.5), 'Wagon arrival: reveal the two vardos and start the party beside them at (560, 205) ft. On foot: spawn between the threshold giants facing west, fog at their backs.', key='A-gate')
    s.note((6, 40), 'West: 5 hours on foot down through the Svalich Woods (C) to the Gates of Barovia (B); half that by wagon (p.33). Check for a random encounter every 30 minutes on the road.', key='A-tunnel')
    s.note((60, 82), 'Ground fog creeps up out of the hollow toward the road at dusk, moving against the wind; something dead smells from the far side. At night, the deepest overcast: no light but the party\'s and the rider\'s lantern that gives none.', key='A-hollow')
    s.note((24, 9), 'The grave and the Vistani: pipe smoke and laughter from the shelf. Roll the 25% intact cairn only if the bandits are not present.', key='A-shelf')
    s.note((40, 48.5), 'A narrow game trail comes up from the hollow and meets the road here; the wolf trap lies where it joins (DC 15 Wisdom (Survival) from the front rank).', key='A')
    s.note((12, 56), 'The Grey Mast is the Keepers of the Feather watching the eastern road; it pays off at the Blue Water Inn (p.32). Never harm a raven.', key='A')
    s.note((64, 36), 'Lore the party may hold (p.26, p.28): spirits drift along this road toward Ravenloft at night; stick to the road, the woods belong to druids, ghosts and wolves. Barovian daylight is bright light but never sunlight (p.24).', key='A')
    s.spawn((117, 41.1))
    s.write('Old Svalich Road')


if __name__ == '__main__':
    build()
