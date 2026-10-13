#!/usr/bin/env python3
"""B. Gates of Barovia (chapter 2, p.33): the eastern gate on a wooded shoulder of the valley rim, where the Old
Svalich Road comes down off the mountain wall into the Svalich Woods. The book prints no battle map; this is an
inferred design, 600 x 400 ft, north at -z. The road climbs in from the south-west (bearing 30), bends at the gate
onto 65 and runs due east out through a rock cutting into the Mist bank that fills the eastern 150 ft. Two 34-ft
stepped piers carry the rusted iron leaves over a bed of worn flagstones; the headless guardians stand outside them;
dry-stone boundary walls run from their backs into the trees and fall to rubble; west of the gate the wheel ruts,
the black pools, the corduroy causeway over the ridge gully, the keeper's lodge footings and the dire-wolf tracks.
Three levels: the ground, the pier tops (+34) and the crag lips of the cutting (+14).
Props and figures: app/src/kit/sites/wild-b.ts (every kind starts with 'b-'). -> locations/ch02/B/{scene,grid}.json"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wildlib import *  # noqa: F401,F403
from collections import OrderedDict


def build():
    s = Site('B', 'Gates of Barovia', 120, 80, 202)
    W, H = s.W, s.H
    G = (64.0, 41.0)                                     # the gate centre (320, 205 ft)
    u = (0.9045, -0.4255)                                # along the road at the gate, outward (ENE, bearing 65)
    v = (0.4255, 0.9045)                                 # the gate line, north pier to south pier (bearing 155)
    P = lambda dx, dz: (G[0] + (u[0] * dx + v[0] * dz) / 5, G[1] + (u[1] * dx + v[1] * dz) / 5)   # gate-local feet -> cells
    ROT = heading(*u)                                    # local +x along the road, outward
    piers = Level('piers', 'Pier tops', 34, 8, ambient=AMB, interior='rubble', exterior='rubble', north='-z')
    crags = Level('crags', 'Crag lips of the cutting', 14, 8, ambient=AMB, interior='rubble', exterior='rubble', north='-z')

    # ---------------------------------------------------------------- the Old Svalich Road
    road = s.road([(32, 80), (35.8, 73.4), (39.5, 67), (43.4, 60.3), (46.7, 54), (50, 48), (54.5, 45.3), (59.4, 43.1), G, (68.6, 38.9), (72.5, 37.7), (76, 37.1), (84, 37), (96, 37), (108, 37), (120, 37)], 2.0)
    # the side path from the road up to the lodge ruin
    s.road([(53.6, 45.4), (53.1, 41.5), (52.2, 37.6), (51.5, 34.6)], 0.6, keep=False)
    s.keep.append((ribbon(catmull([(53.6, 45.4), (53.1, 41.5), (52.2, 37.6), (51.5, 34.6)], 4), 1.4), 0))

    # ---------------------------------------------------------------- the gate: piers, leaves, sill
    Pn, Ps = P(0, -18.8), P(0, 18.8)
    s.prop('b-gate-pier', Pn, rot=ROT, dims={'w': 12, 'h': 34, 's': 1, 'litter': 1, 'marks': 1}, label='North pier', key='B',
           desc='A stepped buttress of grey stone, twelve feet square and six times the height of a man, capped with a pyramid. Its east face is bleached chalk-white; its west face is green with moss. Shield-sized iron plates hold the hinge, rust bleeding down the stone beneath them.')
    s.prop('b-gate-pier', Ps, rot=ROT, dims={'w': 12, 'h': 34, 's': -1}, label='South pier', key='B',
           desc='The twin of the north pier: chalk-white toward the fog, mossed toward the valley, with the same iron hinge plates on its inner corner.')
    s.keep.append((oriented_rect(G[0], G[1], u[0], u[1], 7.5, 5.8), 0.8))
    hinge = {1: P(-6.35, -13.15), -1: P(-6.35, 13.15)}
    for sd in (1, -1):
        s.prop('b-gate-leaf', hinge[sd], rot=heading(sd * v[0], sd * v[1]), dims={'w': 13, 'h': 20}, label='Iron gate (closed)', key='B',
               desc='A leaf of huge rusted iron bars, twenty feet high, dew beaded on every bar and dripping. No lock, bar or chain anywhere.' if sd > 0 else 'The other leaf of the gate, as rusted and as wet, meeting the first with no lock between them.')
        s.hidden('b-gate-leaf', hinge[sd], 'Gate leaf, swung open (west)', 'The gate stands open', rot=heading(-u[0], -u[1]), dims={'w': 13, 'h': 20},
                 desc='The leaf hangs open, swung back into Barovia along the road\'s edge.', dm='Reveal this (and hide the closed leaf) while the gates stand open: as the party approaches on foot, screeching; before the lead wagon and after the last with Vistani. They shut again once the party is through.')
    s.prop('b-threshold-sill', P(-13, 0), rot=ROT, dims={'w': 26, 'd': 18, 'r': 12.5, 'hx': 6.65}, label='Threshold flagstones', key='B',
           desc='The only paving on the road: a bed of worn flagstones under the gate, the only dry footing for miles. Two quarter-circle grooves are polished into them where the bottoms of the leaves have dragged for centuries.')
    s.prop('b-pier-marks', P(-6.1, -23.0), rot=facing(-u[0], -u[1]), label='Notice spike and tally', key='B',
           desc='On the inside of the north pier a rusted iron spike at shoulder height, a tear of rust below it and pulped scraps of paper at its foot. Beside it, scratched into the stone from knee to head height, columns of short tally strokes, hundreds of them, the newest still pale. A bangle and a knot of faded ribbon are wedged in the joints.')
    s.prop('b-vistani-favours', P(-6.35, -6.5), rot=heading(*v), y=8, dims={'n': 6, 'len': 6}, label='Vistani favours', key='B',
           desc='Strips of bright cloth gone pale, a little brass bell and a horse-tassel tied to the north leaf\'s second crossbar at a rider\'s height, limp and dripping.')
    s.prop('b-raven-row', P(-6.35, 0), rot=heading(*v), y=19.1, dims={'n': 12, 'len': 25, 'face': 90}, label='Ravens on the gate', key='B',
           desc='A row of ravens sits along the top bar of the gate, every one turned the same way, every one silent.')

    # ---------------------------------------------------------------- the headless guardians and their heads
    for sd, var in ((-1, 0), (1, 1)):
        sp = P(15, sd * 20)
        s.prop('headless-statue', sp, rot=facing(*u), dims={'v': var}, label='Headless guardian', key='B',
               desc='A larger-than-life warrior in stone on a four-foot plinth, ' + ('a sword held point-down before it' if var == 0 else 'shield raised on its left arm and a spear grounded at its side') + ', facing east down the road. The neck ends in a clean break.')
        s.prop('b-fog-tideline', P(13.2, sd * 20), rot=facing(-u[0], -u[1]), dims={'w': 3.6, 'h': 11}, key='B')
        s.prop('b-raven-row', P(15, sd * 20), rot=heading(*v), y=13.3, dims={'n': 2, 'len': 3.4, 'face': 90}, key='B')
        s.prop('b-fallen-head-pit', P(22.5, sd * 22.5), rot=ROT + sd * 40, dims={'w': 8, 'v': var}, label='Fallen stone head', key='B',
               desc='The guardian\'s helmeted head lies in a bed of knee-high weeds, ' + ('face up to the sky, rain pooled in the eye sockets.' if var == 0 else 'face down in the hollow its own weight made in the mud.'))
        s.keep.append((oriented_rect(P(18, sd * 21)[0], P(18, sd * 21)[1], u[0], u[1], 2.6, 1.6), 0.5))
    s.hidden('b-trinket', P(23.2, 23.6), 'Lost trinket in the weeds', 'Something small in the weeds', dims={},
             desc='A tarnished brass ring on a scrap of faded cord, half trodden into the mud under the weeds.', dm='Whoever searches the weed bed beside the south head finds it: roll on the Trinkets table (appendix A).')
    s.note(P(15, -27), 'Both neck stumps carry chisel marks under the lichen (DC 12 Wisdom (Perception), looking closely at either statue or head): the heads were struck off on purpose. An inference, not book fact: use it or leave the gate mute.')

    # ---------------------------------------------------------------- boundary walls into the trees
    s.prop('b-boundary-wall', P(0, -24.8), rot=heading(-v[0], -v[1]), dims={'len': 40, 'h': 6, 'seed': 1}, label='Boundary wall', key='B',
           desc='A dry-stone wall runs from the back of the pier into the forest, whole at the pier and sunk within forty feet into a line of black-mossed rubble that tree trunks have grown through.')
    s.prop('b-boundary-wall', P(0, 24.8), rot=heading(*v), dims={'len': 40, 'h': 6, 'seed': 2}, label='Boundary wall', key='B',
           desc='Its twin south of the gate, falling to rubble the same way: this was once a real border, and the forest has eaten it.')
    for sd in (-1, 1):
        a, b = P(0, sd * 24), P(0, sd * 66)
        s.keep.append((ribbon([a, b], 1.2), 0.3))

    # ---------------------------------------------------------------- the road west: ruts, pools, the causeway, the tracks
    sill_x0, sill_x1 = -23, -3                           # the sill's extent along the road (gate-local feet)
    cause = (45.2, 57.0); cu = (0.5, -0.866)
    segs = [math.hypot(road[i + 1][0] - road[i][0], road[i + 1][1] - road[i][1]) for i in range(len(road) - 1)]
    total = sum(segs); d = 2.5; k = 0
    while d < total - 2.5:
        p, t = along(road, d / total)
        lx = ((p[0] - G[0]) * u[0] + (p[1] - G[1]) * u[1]) * 5
        if not (sill_x0 - 12 < lx < sill_x1 + 12) and math.hypot(p[0] - cause[0], p[1] - cause[1]) > 4.2:
            s.prop('b-wheel-ruts', p, rot=heading(*t), dims={'len': 24, 'gauge': 5, 'seed': k})
        d += 5.2; k += 1
    for (x, z, L) in ((41.2, 64, 8), (47.6, 53, 12)):
        _, t = along(road, min(range(len(road)), key=lambda i: math.hypot(road[i][0] - x, road[i][1] - z)) / (len(road) - 1))
        s.prop('b-black-pool', (x, z), rot=heading(*t), dims={'len': L, 'w': 4.5, 'seed': int(L)}, label='Black pool', key='B',
               desc='A still pool lies in the wheel hollow, mirror-dark, reflecting grey and nothing else.')
    s.prop('b-corduroy', cause, rot=heading(*cu), dims={'len': 30, 'w': 22, 'poolLen': 30}, label='Corduroy causeway', key='B',
           desc='Thirty feet of road laid on half-rotten logs set side by side across a black bog, the wheel ruts chewed into their tops. The culvert under them is silted shut: a black pool has backed up on the uphill side and a thin seep crosses the logs and runs off into the trees.')
    for (cx, cz, r, sd) in ((48.4, 59.0, 3.6, 21), (42.2, 55.2, 2.6, 22)):
        s.patch(blob(cx, cz, r, sd, sx=1.1), 'marsh')
    s.clear(cause[0], cause[1], 6.5)
    s.keep.append((oriented_rect(49.5, 60.5, 0.5, 0.866, 4, 2.4), 0.6))
    tr1 = ((53, 67), (43.6, 60)); tr2 = ((43.6, 60), (20, 78))
    for i, (a, b) in enumerate((tr1, tr2)):
        L = math.hypot(b[0] - a[0], b[1] - a[1]) * 5
        s.prop('b-paw-prints', ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), rot=heading(b[0] - a[0], b[1] - a[1]), dims={'len': rnd(L, 1), 'bend': 5 if i else 0, 'seed': i + 1},
               label='Dire-wolf tracks' if i == 0 else None, key='B',
               desc='Paw prints the size of a spread hand pressed into the road mud, several animals abreast: they come down out of the south-east trees, cross the road and go on south-west beside it.' if i == 0 else None)
        s.keep.append((ribbon([a, b], 0.9), 0.2))
    s.note((38, 64), 'The tracks are a few hours old. Followed south-west they leave the map toward C and Dalvan Olensky\'s body. Anyone who steps off the road to follow them starts the howling (area C rule, p.34).')

    # ---------------------------------------------------------------- the keeper's lodge
    lodge = (51, 33); fdir = (0.305, 0.952); lrot = facing(*fdir)
    s.prop('b-lodge-footings', lodge, rot=lrot, dims={'w': 20, 'd': 16}, label='Keeper\'s lodge footings', key='B-lodge',
           desc='Knee-high mossed footing walls of a small lodge, a door gap toward the road, the stub of a collapsed hearth stack at one end with a sapling growing out of it, a rotten door sill and a fallen lintel inside.')
    s.keep.append((oriented_rect(lodge[0], lodge[1], 0.952, -0.305, 2.8, 2.4), 0.6))
    s.prop('log', (51.7, 42), rot=heading(5.4, -2), dims={'len': 28, 'r': 1.3}, label='Fallen pine', key='B-lodge',
           desc='A big pine lies across the overgrown side path to the ruin, moss on its top, a snapped branch pointing the way.')
    s.keep.append((oriented_rect(51.7, 42, 5.4, -2, 3.2, 1.0), 0.4))

    # ---------------------------------------------------------------- the rock cutting east and the dead pines
    north_bank = [(86, 34.6), (89, 34.2), (92.5, 34.7), (96, 34.1), (100, 34.6), (104, 34.0), (108, 34.5), (112, 34.2), (112, 28), (86, 28)]
    south_bank = [(86, 39.4), (90, 39.9), (94, 39.3), (98, 39.8), (102, 39.4), (106, 40.0), (110, 39.5), (112, 39.8), (112, 46), (86, 46)]
    for i, poly in enumerate((north_bank, south_bank)):
        o = s.prop('prism', (0, 0), dims={'h': 13.2, 'color': 0x5a5853}); o['pos'] = [0, 0, 0]; o['polygon'] = [[rnd(x * 5, 2), rnd(z * 5, 2)] for x, z in poly]
        s.keep.append((poly, 1.0))
    s.prop('b-crag-bank', (99, 34.3), rot=0, dims={'len': 128, 'h': 13, 'seed': 3}, label='The rock cutting', key='B-cutting',
           desc='The road climbs east into a notch cut through a low shelf of grey rock, crags ten to sixteen feet high on either side, scree at their feet, dead pine stubs on their lips. It is the only place where the trees stand back.')
    s.prop('b-crag-bank', (99, 39.7), rot=180, dims={'len': 128, 'h': 13, 'seed': 4})
    for i, (x, z, w, h) in enumerate(((90, 31.5, 22, 7), (103, 30.8, 26, 8), (96, 43.3, 24, 6), (109, 43.6, 20, 7))):
        s.prop('crag', (x, z), rot=s.rng.uniform(0, 360), dims={'w': w, 'd': rnd(w * 0.7), 'h': h, 'seed': 40 + i}, y=13.2)
    for i, (x, z, hh, y) in enumerate(((88.5, 32.4, 30, 13.2), (95.5, 31.2, 26, 13.2), (101.5, 30.2, 32, 13.2), (108.5, 31.6, 24, 13.2), (90.5, 42.6, 28, 13.2), (98, 44.2, 24, 13.2), (105.5, 43.2, 30, 13.2), (111, 44.5, 22, 13.2), (84, 32.8, 32, 0), (84.6, 41.6, 29, 0), (82.2, 44.2, 27, 0))):
        s.prop('b-dead-pine', (x, z), rot=s.rng.uniform(0, 360), dims={'h': hh, 'seed': i + 1, 'tide': 1 if x >= 86 else 0}, y=y, label='Dead pine' if i == 8 else None,
               desc='The last trees before the fog are dead: bark peeled in strips, limbs bare and broken, grey as the stone, a pale line round each trunk where the Mists have stood too long.' if i == 8 else None)
        s.trees.append((x, z, 2.2))
    s.scatter('boulder', 10, lambda x, z: 1.0 if 85 < x < 113 and (33.5 < z < 35.2 or 39.2 < z < 41) else 0.0, margin=0.1, gap=0.8, dims=lambda g: {'r': rnd(0.9 + g.random() * 1.1)}, circles=False)

    # ---------------------------------------------------------------- the Mists
    s.prop('b-mist-bank', (106, 40), rot=90, dims={'len': 410, 'h': 50, 'd': 150}, label='The Mists', key='B',
           desc='A wall of grey fog stands across the road behind you and fills the forest to either side. It does not drift; it pours, low tongues of it sliding out between the trunks onto the road and pooling in the ruts.')['vis'] = 'explored'
    for i, (x, z, rot, L) in enumerate(((91, 36.6, 180, 55), (90.5, 32.5, 205, 42), (90.8, 43.4, 155, 46), (86.5, 30.4, 215, 28), (85.8, 46.2, 145, 30))):
        s.prop('b-mist-tongue', (x, z), rot=rot, dims={'len': L, 'w': 16 if i == 0 else 11, 'seed': i + 1})['vis'] = 'explored'
    s.note((95, 44.5), mists_note() + ' Non-Vistani who pass the bars or go round the piers through the trees while the gate is closed are choked by it. Once the party is through and the gate shuts, play the fog as pouring up the road to stand against the bars: there is no going back.')

    # ---------------------------------------------------------------- encounters (DM-only until revealed)
    for i, (x, z) in enumerate(((24.5, 73.5), (30.5, 69.5), (37, 66), (28, 62), (40.5, 56.5))):
        s.clear(x, z, 1.3)
        s.mob('dire-wolf', (x, z), 'Dire wolf', 'A huge grey wolf', size='large', rot=s.rng.uniform(0, 360), key='B',
              dm='Area C rule (p.34): if the party lingers among the trees, one far howl, then one more voice each round, closer each time; on the fifth round five dire wolves arrive and attack. They break off if the party is back on the road and heading west toward the village. Strahd\'s wolves cannot be charmed or frightened (p.33).')
    for i in range(20):
        p, t = along(road, 0.27 + i * 0.0095); off = ((i % 5) - 2) * 1.3 + (0.5 if i % 2 else -0.5)
        s.mob('wolf', (p[0] - t[1] * off, p[1] + t[0] * off), 'Wolf', 'A grey wolf', rot=heading(*t), key='B',
              dm='Twenty wolves join the dire wolves only if the party is trying to leave Barovia (p.34); they stop when it turns back toward the village.' if i == 0 else None)
    s.mob('swarm-of-ravens', P(-6.35, 0), 'Swarm of ravens', 'Ravens', y=19.6, key='B',
          dm='Random-encounter watcher (p.32): a raven follows at a distance, then more; left alone they shadow the party and harry its enemies in any hostile encounter; they fly off if attacked.')
    # on the day level (the stacked view fades hidden figures on the current level only), standing on the north cap's east edge
    s.mob('b-raven', P(3.9, -22.4), 'Wereraven (raven form)', 'A raven', size='tiny', rot=ROT, y=34, key='B',
          dm='Random-encounter watcher (p.32): Stealth against passive Perception. It circles above the cutting, perches here on the north cap, shadows the party for 1d4 hours, then flies home to the Keepers of the Feather. Free foreshadowing that pays off at Vallaki.')
    # the Vistani caravan, only if the party arrived with Stanimir's people: lead wagon at the gate line
    van = [(P(6, 0), heading(*u)), (P(50, 0.5), heading(*u)), ((84, 37.1), 0)]
    for i, (vp, vr) in enumerate(van):
        s.hidden('b-vardo', vp, ('Stanimir\'s wagon' if i == 0 else 'Vistani wagon'), 'A barrel-topped wagon', rot=vr, dims={'v': i},
                 desc='A barrel-topped wagon painted in colours the weather has nearly worn away.',
                 dm='Only if the party came in with Stanimir (pp.20-21): the gate opens before the lead wagon and closes after the last. Hidden until then.' if i == 0 else None)
        for sd in (-1, 1):
            ox, oz = turn(-10.5, sd * 2.6, vr)
            s.mob('b-vistani-horse', (vp[0] + ox / 5, vp[1] + oz / 5), 'Vistani draft horse', 'A draft horse in a bright blanket', size='large', rot=vr + 180, dims={'v': i + (sd > 0)}, key='B')
    folk = [(P(-2, 6.5), 'Stanimir'), (P(-2, -6.5), 'Ratka'), (P(14, 7), 'Vistani'), (P(26, -7), 'Vistani'), (P(38, 7.5), 'Vistani'), (P(44, -7), 'Vistani'), (P(58, 7), 'Vistani'), ((80, 34.6), 'Vistani'), ((79, 39.6), 'Vistani'), ((90, 34.8), 'Vistani'), ((91, 39.4), 'Vistani')]
    for i, (fp, name) in enumerate(folk):
        s.mob('b-vistani', fp, name, 'A Vistani traveller', rot=heading(-u[0], -u[1]) + s.rng.uniform(-25, 25), dims={'v': i}, key='B',
              dm=('Stanimir (p.20): the storyteller who brought the party in; friendly here. Use bandit statistics only if it comes to blows.' if name == 'Stanimir' else 'Ratka and nine other Vistani with the wagons; friendly (bandit statistics if needed).' if name == 'Ratka' else None))

    # ---------------------------------------------------------------- the woods
    near = lambda x, z: (1.25, 1.6) if line_dist((x, z), road) < 9 and x < 84 else None
    verge = lambda x, z: x < 86 and line_dist((x, z), road) < 5.1        # 10 ft half-road + 15.5 ft of verge, in cells
    dens = lambda x, z: 0.0 if verge(x, z) else 0.45 if x > 92 else 1.0
    s.pines(5600, density=dens, gap=2.3, margin=1.1, scale=(1.0, 1.6), giant=near)
    s.undergrowth(bushes=55, boulders=12, dead=2, stumps=4, logs=5, density=lambda x, z: (1.0 if line_dist((x, z), road) < 12 else 0.4) * (0.3 if x > 90 else 1))
    s.scatter('weeds', 10, lambda x, z: 1.0 if math.hypot(x - G[0], z - G[1]) < 9 else 0.0, margin=0.3, gap=1.2, dims={'n': 4, 'r': 1.4}, circles=False)

    # ---------------------------------------------------------------- keyed areas, notes, levels
    s.room('B', 'Gates of Barovia', oriented_rect(G[0], G[1], u[0], u[1], 15, 10), 'grass',
           'A pair of square stone piers stands across the road, taller than the pines and each topped with a squat pyramid. Their eastern sides are scoured pale as old bone; their sides toward the valley are furred green. Two leaves of rust-brown iron bars hang between them over the one stretch of paving for miles, flagstones with two curves rubbed glassy where the leaves drag. A line of ravens sits along the top bar, all turned one way, making no sound. On plinths outside the piers two stone soldiers, sword and spear, keep watch eastward with nothing above their collars. To the east the fog leans against the stone like floodwater against a dam.',
           'On foot the gates screech open as the party approaches and shut behind it; with Vistani wagons they open before the lead wagon and close after the last (pp.33-34). This is the eastern gate: it will not open for anyone leaving unless Vistani are with them, and the Mists choke non-Vistani who pass the bars or skirt the piers while it is closed. No scripted fight: the danger is the wolves (area C rule, p.34) if the party lingers in the trees. The flagstone sill, the wall stubs, the pier tops and the crag lips are the places to make a stand. If Strahd is destroyed the gates stand open and the road east clears of fog.')
    s.room('B-lodge', 'Keeper\'s lodge', oriented_rect(lodge[0], lodge[1], 0.952, -0.305, 2, 1.6), 'dirt',
           'The footings of a small lodge, knee-high and mossed, with a hearth stack at one end. Nobody has kept this gate in living memory.',
           'Nothing of value. The tally and the notice spike on the pier show that word used to be left at this gate; the letter Dalvan was meant to leave here never arrived (it is in his hand at C).')
    s.room('B-causeway', 'Corduroy causeway', oriented_rect(cause[0], cause[1], cu[0], cu[1], 3.2, 2.3), 'dirt',
           'Logs laid across a black bog carry the road; a dark pool has backed up on the uphill side.', 'Difficult terrain on the logs; the bog either side is deep mud (difficult, and a wagon that leaves the logs is stuck).', difficult=True)
    s.room('B-cutting', 'The rock cutting', [(86, 34.6), (112, 34.2), (112, 39.8), (86, 39.4)], 'dirt',
           'The road climbs between grey crags into the fog, scree at their feet, dead trees on their lips.', 'The cutting is clear road: the party arrives here and walks it to the gate unharmed, the fog at its back. The low tongues that spill onto the road are thin and harmless (lightly obscured at most). The Mists\' rules (DC 20 Constitution save each turn or a level of exhaustion, heavily obscured, always turned back into Barovia) begin only at the fog wall, about 130 ft east of the gate, and once the gate has shut behind the party the fog pours up the road to stand against the bars. The crag tops look down on anyone in the road: DC 12 Strength (Athletics) up the scree, or walk in from the forest edge.')
    for key, pc, nm in (('B-piernorth', Pn, 'North pier top'), ('B-piersouth', Ps, 'South pier top')):
        piers.room(key, nm, oriented_rect(pc[0], pc[1], u[0], u[1], 1.2, 1.2), 'flagstone', page=33)
        s.desc[key] = ('The capped top of the pier, twelve feet square, thirty-four feet above the road: a vantage over the canopy and down the cutting.' + (' Raven droppings, a litter of pellets and a black feather lie about the cap: something perches here often.' if 'north' in key else ''),
                       'Reached by a DC 15 Strength (Athletics) climb up the buttress steps or the wall stub. Useful for an archer, a lookout or a stand against wolves.' + (' The litter is the wereraven\'s watch post (p.32).' if 'north' in key else ''))
    crags.room('B-cragnorth', 'North crag lip', north_bank, 'cobble', page=33)
    crags.room('B-cragsouth', 'South crag lip', south_bank, 'cobble', page=33)
    s.desc['B-cragnorth'] = ('The walkable rock top north of the cutting, ten to sixteen feet above the road, dead pine stubs and loose scree along its edge.', 'DC 12 climb from the scree, or walk in from the forest edge. Wolves and watchers look down on the road from here.')
    s.desc['B-cragsouth'] = ('The rock top south of the cutting, the same height, the same dead stubs and scree.', 'As the north lip. The south ridge beyond feeds the gully that crosses the road at the causeway.')
    s.note(P(-10, -30), 'The gate hinges: DC 15 Intelligence (Investigation) on the pintles and leaves finds nothing that could move them and nothing that could stop them. Nothing earthly does.')
    s.note(P(-9, -14), 'Notice spike: only pulp and a nail head. The tally: DC 13 Intelligence (History) or any Vistani: someone keeps count of who comes in, and the count is never crossed out.')
    s.note((8, 70), 'South-west: the road drops through the Svalich Woods to C (0.35 mi), then D and the village of Barovia (E), about three miles.')
    s.note((112, 30), 'East: the Old Svalich Road climbs into the Mists toward A. Five hours on foot from A to this gate, half that in Vistani wagons (p.33).')
    s.spawn((87.5, 37))

    lk = lambda id, kind, al, ap, bl, bp: OrderedDict(id=id, kind=kind, **{'from': OrderedDict(level=al, pos=[rnd(ap[0] * 5, 1), rnd(ap[1] * 5, 1)]), 'to': OrderedDict(level=bl, pos=[rnd(bp[0] * 5, 1), rnd(bp[1] * 5, 1)])})
    links = [lk('B-climb-n', 'ladder', 'day', P(9.5, -18.8), 'piers', Pn), lk('B-climb-s', 'ladder', 'day', P(9.5, 18.8), 'piers', Ps),
             lk('B-scree-n', 'ladder', 'day', (92, 35.4), 'crags', (92, 33)), lk('B-scree-s', 'ladder', 'day', (104, 38.8), 'crags', (104, 41.2))]
    # The opening shot the site is composed for: up the ruts from the south-west to the piers, the fog wall behind the bars.
    # (Data only for now: the viewer frames every scene on its rooms from the current bearing; nothing reads `view` yet.)
    view = OrderedDict(pos=[150, 170, 330], target=[330, 0, 205])
    s.write('Gates of Barovia', {'valley': True, 'stacked': 'open', 'entry': 'day', 'view': view}, levels=[piers, crags], links=links)


if __name__ == '__main__':
    build()
