#!/usr/bin/env python3
"""Barovia world map data: pin positions, roads, rivers, lakes, peaks and woods, measured from the regional
map (book p.35) at 200 dpi, where one quarter-mile hex spans ~17.6 px. Output is in miles, origin top-left.
Only positions and names are recorded; no map art is copied. Yester Hill (Y) lies off the printed crop and is
placed approximately west of the Wizard of Wines.

Two files come from here. Run alone, this writes the base world.json (schema 1) that `barovia-cover.py` starts from
(the laptop: it needs the PDF; it refines the pins from the 400-dpi page and adds the land-cover grid, then
`heightfield.py` adds the height lattice). Run on a machine where that refined file (schema 2) is already on disk,
this keeps all of it and lays in only what is measured here: the roads and rivers below, bent onto the pins as the
file places them (see `lay_roads`). So it runs anywhere, and runs last: after the cover pass too, whose own traced
road ribbons it replaces."""
import json, math, os
from collections import OrderedDict

PX_PER_MILE = 17.6 * 4          # 4 hexes per mile
m = lambda x, y: [round(x / PX_PER_MILE, 2), round(y / PX_PER_MILE, 2)]

HEIGHT = {'K': 1000}  # the Pillarstone of Ravenloft: the castle stands a thousand feet above the valley (p.53)
GROUND = {'L': 4.2}   # a pin's ground in drawn feet where the heightfield is wrong for it: Lake Zarovich's map stands on the
                      # lake's south shore at the lake's level (as Vallaki beside it), not on the survey's hump inside the lake
PINS = [  # key, name, px, type, scenes (built scene paths reachable from here)
  ('A', 'Old Svalich Road', (1258, 507), 'road', ['ch02/A']),
  ('B', 'Gates of Barovia (east)', (1222, 470), 'gate', ['ch02/B']),
  ('C', 'Svalich Woods', (1203, 537), 'woods', ['ch02/C']),
  ('D', 'River Ivlis', (992, 611), 'river', ['ch02/D']),
  ('E', 'Village of Barovia', (992, 537), 'settlement', ['ch03/E', 'ch03/E5', 'appB/death-house']),
  ('F', 'River Ivlis Crossroads', (850, 658), 'crossroads', ['ch02/F']),
  ('G', 'Tser Pool Encampment', (798, 546), 'camp', ['ch02/G']),
  ('H', 'Tser Falls', (742, 478), 'falls', ['ch02/H']),
  ('I', 'Black Carriage', (745, 424), 'landmark', ['ch02/I']),
  ('B2', 'Gates of Barovia (west)', (745, 380), 'gate', ['ch02/B']),
  ('J', 'Gates of Ravenloft', (853, 453), 'gate', ['ch02/J']),
  ('K', 'Castle Ravenloft', (915, 470), 'castle', ['ch04/K']),
  ('L', 'Lake Zarovich', (470, 240), 'lake', ['ch02/L']),  # the landing on the south shore (the map's own spot); the book's marker sits a little out on the water
  ('M', 'Mount Baratok', (663, 106), 'peak', ['ch02/M']),
  ('N', 'Town of Vallaki', (447, 307), 'settlement', ['ch05/N']),
  ('O', 'Old Bonegrinder', (570, 355), 'landmark', ['ch06/O']),
  ('P', 'Luna River Crossroads', (383, 318), 'crossroads', ['ch02/P']),
  ('Q', 'Argynvostholt', (343, 440), 'castle', ['ch07/Q']),
  ('R', 'Raven River Crossroads', (185, 288), 'crossroads', ['ch02/R']),
  ('S', 'Village of Krezk', (53, 261), 'settlement', ['ch08/S', 'ch08/S10']),
  ('T', 'Tsolenka Pass', (225, 690), 'pass', ['ch09/T']),
  ('U', 'Ruins of Berez', (346, 538), 'ruin', ['ch10/U', 'ch10/U3']),
  ('V', "Van Richten's Tower", (230, 225), 'tower', []),
  ('W', 'The Wizard of Wines', (36, 420), 'settlement', ['ch12/W']),
  ('X', 'The Amber Temple', (352, 762), 'temple', ['ch13/X']),
  ('Y', 'Yester Hill', (-40, 470), 'hill', ['ch14/Y']),
  ('Z', 'Werewolf Den', (126, 185), 'den', ['ch15/Z']),
]
# ROADS and RIVERS were measured on 2026-10-19 from the regional map (book p.35, pdf page 36) rendered at 200 dpi, in
# this script's pixel frame (page px = script px + (183, 92)), as connected polylines routed along the page's road ink
# between the places: every end on a place, on a junction (one vertex that the roads meeting there share) or on the
# map's frame; where the page draws a place's disc a little beside its road the road is bowed smoothly through the
# place (R, P, N, S, H, B2, B, A, E, C); the dotted ways are kind 'trail'; 3-8 points per mile, none more than a third
# of a mile apart. Not ink: the River Ivlis bank path (the river map's own pin stands a third of a mile off the road)
# and the Luna's three points at x 226, which run under the Tsolenka bridge along its axis (ch09/T, z 170). The
# Yester Hill trail ends on the disc the page draws (1.4 mi south of the approximate Y pin above; the cover pass puts
# Y on that disc and `lay_roads` sets the trail's end on it). Only positions enter the data; no art.
ROADS = [  # name, kind, points (script px)
  ('Old Svalich Road', 'road', [(-117, 254), (-101, 249), (-87, 244), (-66, 244), (-48, 250), (-30, 256), (-12, 262), (5, 264), (23, 261), (42, 258), (53, 261), (69, 272), (80, 266), (93, 268), (107, 269), (121, 274), (136, 274), (151, 274), (161, 280), (171, 287), (185, 288), (201, 292), (205, 293), (217, 296), (225, 305), (233, 314), (239, 328), (246, 341), (257, 355), (278, 362), (290, 372), (304, 372), (318, 371), (333, 355), (347, 339), (365, 328), (383, 318), (395, 318), (403, 301), (415, 296), (431, 302), (447, 307), (465, 302), (482, 296), (500, 291), (519, 297), (538, 303), (551, 304), (563, 304), (572, 301), (583, 294), (593, 286), (613, 285), (627, 274), (639, 277), (652, 280), (658, 274), (671, 272), (679, 280), (679, 290), (665, 302), (652, 315), (638, 327), (624, 328), (614, 320), (601, 320), (594, 328), (592, 348), (600, 349), (607, 345), (612, 350), (613, 363), (607, 369), (607, 378), (615, 384), (626, 384), (635, 373), (645, 362), (657, 356), (670, 351), (680, 362), (690, 373), (707, 370), (725, 368), (735, 374), (745, 380), (747, 400), (750, 421), (733, 429), (724, 444), (732, 452), (753, 451), (757, 455), (750, 473), (742, 478), (737, 493), (736, 510), (739, 524), (743, 539), (737, 546), (715, 550), (701, 563), (686, 576), (684, 585), (696, 598), (711, 600), (726, 590), (741, 574), (755, 557), (769, 552), (781, 570), (782, 592), (783, 614), (778, 624), (785, 628), (776, 630), (776, 640), (783, 653), (799, 666), (811, 666), (824, 666), (834, 658), (850, 658), (856, 646), (862, 633), (876, 628), (889, 628), (900, 640), (911, 652), (924, 652), (937, 653), (949, 638), (959, 616), (963, 602), (969, 585), (978, 556), (992, 537), (1014, 538), (1039, 549), (1063, 558), (1087, 561), (1109, 561), (1134, 561), (1166, 565), (1181, 559), (1194, 552), (1202, 539), (1203, 537), (1206, 519), (1208, 495), (1210, 473), (1222, 470), (1231, 473), (1245, 490), (1258, 507), (1277, 498), (1289, 496), (1301, 494)]),
  ('Road to Ravenloft', 'road', [(750, 421), (763, 404), (775, 388), (782, 389), (791, 400), (801, 410), (816, 411), (826, 398), (832, 398), (836, 404), (834, 424), (843, 438), (853, 453), (874, 454), (895, 455), (905, 462), (915, 470)]),
  ('Tser camp path', 'trail', [(742, 478), (743, 498), (746, 510), (759, 523), (775, 533), (785, 534), (798, 546)]),
  ('Tsolenka road', 'road', [(185, 288), (196, 297), (195, 319), (194, 341), (184, 360), (174, 378), (161, 390), (147, 403), (145, 423), (153, 437), (155, 458), (142, 471), (132, 477), (122, 483), (123, 504), (132, 513), (141, 522), (152, 526), (168, 526), (185, 511), (197, 511), (208, 518), (208, 534), (208, 549), (208, 565), (193, 578), (178, 591), (174, 613), (181, 619), (193, 622), (199, 631), (209, 639), (218, 647), (216, 665), (217, 680), (220, 688), (225, 690), (231, 687), (240, 680), (250, 676), (264, 675), (276, 685), (287, 696), (299, 706), (303, 714), (303, 732), (303, 751), (315, 764), (318, 776), (330, 788), (342, 795), (363, 793), (375, 805), (386, 817), (403, 821), (419, 825), (415, 809), (404, 806), (398, 800), (395, 789), (385, 779), (375, 775), (367, 767), (352, 762)]),
  ('Road beyond the Amber Temple', 'road', [(419, 825), (417, 842), (422, 850), (419, 853), (407, 854), (395, 855), (386, 868), (377, 899)]),
  ('Road to Argynvostholt', 'road', [(257, 355), (252, 373), (266, 389), (274, 393), (286, 394), (298, 396), (319, 395), (328, 406), (328, 424), (343, 440)]),
  ('Old Bonegrinder lane', 'road', [(607, 369), (588, 369), (570, 355)]),
  ('Trail to the tower', 'trail', [(205, 293), (214, 285), (223, 277), (223, 265), (224, 253), (227, 239), (230, 225)]),
  ('Trail to the Luna crossroads', 'trail', [(224, 253), (239, 258), (253, 248), (268, 248), (283, 248), (296, 256), (311, 256), (326, 255), (336, 259), (349, 274), (362, 288), (366, 304), (383, 318)]),
  ('Trail to Berez', 'trail', [(383, 318), (392, 328), (388, 337), (390, 343), (383, 361), (382, 382), (381, 403), (386, 410), (390, 432), (390, 448), (390, 465), (383, 481), (382, 502), (376, 513), (376, 527), (363, 544), (346, 538)]),
  ('Trail to the vineyard', 'trail', [(185, 288), (170, 291), (153, 298), (136, 306), (125, 319), (124, 331), (123, 343), (111, 357), (97, 363), (91, 370), (85, 387), (79, 404), (67, 400), (55, 395), (34, 395), (30, 399), (30, 406), (36, 420)]),
  ('Trail to Yester Hill', 'trail', [(79, 404), (76, 422), (73, 440), (66, 455), (58, 470), (51, 485), (35, 498), (26, 500), (16, 507), (8, 516), (0, 525), (-13, 534), (-26, 543), (-30, 552), (-28, 568)]),
  ('Trail to the Werewolf Den', 'trail', [(107, 269), (111, 247), (119, 230), (119, 215), (119, 200), (126, 185)]),
  ('River Ivlis bank path', 'trail', [(963, 602), (978, 607), (992, 611)]),
]
RIVERS = [
  ('Luna River', [(417, 253), (415, 274), (413, 294), (411, 314), (409, 335), (407, 356), (405, 376), (407, 390), (409, 404), (414, 420), (420, 437), (425, 453), (425, 473), (421, 483), (411, 499), (400, 515), (389, 532), (379, 548), (369, 564), (358, 580), (349, 588), (340, 595), (324, 605), (308, 614), (292, 624), (277, 639), (262, 655), (246, 670), (226, 677), (226, 688), (226, 698), (216, 701), (205, 707), (193, 713), (179, 718), (165, 722), (149, 723), (135, 720), (122, 718), (104, 710), (86, 701), (69, 692), (51, 684), (33, 676), (15, 667), (-4, 660), (-23, 654), (-42, 647), (-60, 640), (-79, 633), (-98, 627), (-117, 620)]),
  ('River Ivlis (above the falls)', [(469, 496), (487, 493), (504, 490), (521, 486), (539, 483), (559, 486), (579, 489), (599, 492), (614, 490), (629, 489), (651, 490), (674, 492), (693, 496), (711, 499), (725, 506), (739, 513), (759, 519), (778, 526), (798, 532), (809, 537), (819, 542), (825, 548)]),
  ('River Ivlis', [(863, 598), (875, 606), (893, 611), (909, 608), (925, 598), (933, 597), (951, 602), (967, 611), (983, 620), (1002, 623), (1022, 626), (1041, 630), (1060, 633), (1080, 636), (1099, 639), (1120, 636), (1140, 634), (1161, 631), (1178, 622), (1195, 613), (1212, 604), (1222, 602), (1235, 601), (1249, 600), (1266, 602), (1283, 604), (1300, 606)]),
  ('Raven River', [(200, 270), (192, 282), (183, 288), (173, 295), (161, 300), (149, 302), (136, 304), (116, 305), (96, 306), (75, 307), (55, 308), (35, 309), (20, 309), (4, 308), (-11, 308), (-32, 305), (-53, 302), (-75, 298), (-96, 295), (-117, 292)]),
]
LAKES = [('Lake Zarovich', (500, 195), (170, 48)), ('Lake Baratok', (190, 205), (30, 22)), ('Tser Pool', (850, 562), (16, 12)), ('Luna Lake', (200, 712), (55, 22))]
PEAKS = [('Mount Baratok', (850, 70)), ('Mount Ghakis', (505, 780)), ('Balinok Mountains', (160, 470))]
# Unnamed high ground from the map: the castle's pillar of rock, the Ghakis foothills, the Balinok range,
# the snowy north-east and the ridges between Vallaki and the Tser valley.
HIGH = [(905, 430), (860, 380), (620, 620), (560, 690), (640, 520), (250, 560), (120, 560), (200, 430), (1050, 120), (1180, 110), (980, 200),
        (700, 200), (820, 300), (760, 250), (520, 480), (450, 600), (300, 760), (150, 820), (1250, 250)]
WOODS = [('Svalich Woods', (1150, 380)), ('Svalich Woods', (990, 760)), ('Svalich Woods', (460, 130)), ('Svalich Woods', (90, 450)), ('Svalich Woods', (30, 760))]


# ------------------------------------------------------------------ laying the measured roads against the file's pins
def _dist(a, b): return math.hypot(a[0] - b[0], a[1] - b[1])

def _bow(pts, k, delta, stops):
    """Move pts[k] by delta and its neighbours along the arc by a raised cosine of their distance, fading to nothing by
    R = max(40, 3|delta|) px or at the next stop (another pin's vertex), whichever comes first."""
    R = max(40.0, 3 * math.hypot(*delta))
    for d in (-1, 1):
        reach, s, i = R, 0.0, k
        while 0 <= i + d < len(pts) and s < reach:
            s += _dist(pts[i], pts[i + d]); i += d
            if i in stops: reach = min(reach, s); break
        s, i = 0.0, k
        while 0 <= i + d < len(pts):
            s += _dist(pts[i], pts[i + d]); i += d
            if s >= reach: break
            w = 0.5 * (1 + math.cos(math.pi * s / reach)); pts[i][0] += delta[0] * w; pts[i][1] += delta[1] * w
    pts[k][0] += delta[0]; pts[k][1] += delta[1]

def lay_roads(roads, pins):
    """The measured polylines laid against the pins as the file writes them (`pins`: key -> (x, y) px). Where a written
    pin stands off the table's (the cover pass refines every pin from the page and moves Vallaki's onto the town), each
    road through that pin is bent onto it; a loose end within a quarter mile of a pin is set on it (the Yester Hill
    trail); a vertex two roads share stays shared. Returns [(name, kind, pts)] with float px."""
    table = {k: p for k, _, p, _, _ in PINS}
    orig = [[list(p) for p in pts] for _, _, pts in roads]
    out = [[list(p) for p in pts] for _, _, pts in roads]
    count = {}
    for pts in orig:
        for p in pts: count[tuple(p)] = count.get(tuple(p), 0) + 1
    shared = {p for p, n in count.items() if n > 1}
    near = lambda p: min(table.values(), key=lambda q: _dist(p, q))
    for key, (x, y) in table.items():
        if key not in pins: continue
        delta = (pins[key][0] - x, pins[key][1] - y)
        if math.hypot(*delta) < 0.05: continue
        for pts, cur in zip(orig, out):
            k = min(range(len(pts)), key=lambda i: _dist(pts[i], (x, y)))
            if _dist(pts[k], (x, y)) > 3: continue  # the road does not pass this pin
            stops = {i for i, p in enumerate(pts) if i != k and _dist(p, near(p)) < 3}
            _bow(cur, k, delta, stops)
    # a junction keeps one position: the one the bows moved farthest
    best = {}
    for pts, cur in zip(orig, out):
        for p, q in zip(pts, cur):
            if tuple(p) in shared and _dist(p, q) > best.get(tuple(p), (-1, None))[0]: best[tuple(p)] = (_dist(p, q), q)
    for pts, cur in zip(orig, out):
        for i, p in enumerate(pts):
            if tuple(p) in shared: cur[i] = list(best[tuple(p)][1])
    for pts, cur in zip(orig, out):
        for i in (0, -1):
            if tuple(pts[i]) in shared: continue
            k, q = min(pins.items(), key=lambda kv: _dist(cur[i], kv[1]))
            if _dist(cur[i], q) <= 0.25 * PX_PER_MILE: cur[i] = list(q)
    return [(n, k, cur) for (n, k, _), cur in zip(roads, out)]

def clip(pts, b):
    """A polyline cut at the frame (b: minX, minY, maxX, maxY in px): an end beyond it ends where it crosses the edge."""
    x0, y0, x1, y1 = b
    inside = lambda p: x0 <= p[0] <= x1 and y0 <= p[1] <= y1
    def enter(p, q):  # the point where the segment p (outside) -> q (inside) crosses the frame
        t = 0.0
        for lo, hi, i in ((x0, x1, 0), (y0, y1, 1)):
            if p[i] < lo: t = max(t, (lo - p[i]) / (q[i] - p[i]))
            if p[i] > hi: t = max(t, (hi - p[i]) / (q[i] - p[i]))
        return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]
    pts = [list(p) for p in pts]
    for end in (0, 1):
        if end: pts.reverse()
        while len(pts) > 1 and not inside(pts[0]):
            if inside(pts[1]): pts[0] = enter(pts[0], pts[1]); break
            pts.pop(0)
        if end: pts.reverse()
    return pts

def paths(pins, bounds):
    """roads and rivers for the file: laid against `pins` (key -> px), cut at `bounds` (px), in miles."""
    roads = [OrderedDict(name=n, kind=k, pts=[m(*p) for p in clip(pts, bounds)]) for n, k, pts in lay_roads(ROADS, pins)]
    rivers = [OrderedDict(name=n, pts=[m(*p) for p in clip(pts, bounds)]) for n, pts in RIVERS]
    return roads, rivers

PATH = 'locations/ch02/barovia-region/world.json'
BOUNDS = (-80, 0, 1300, 920)  # the base frame, px
out = OrderedDict(
  schema=1, name='The Lands of Barovia', page=35, milesPerHex=0.25,
  note='Positions measured from the regional map; art is original. Yester Hill approximate (off the printed crop).',
  bounds=m(1300, 920) and OrderedDict(minX=m(-80, 0)[0], minY=0, maxX=m(1300, 0)[0], maxY=m(0, 920)[1]),
  pins=[OrderedDict(key=k, name=n, pos=m(*p), type=t, **({'scenes': sc} if sc else {}), **({'groundFt': GROUND[k]} if k in GROUND else {}), **({'heightFt': HEIGHT[k]} if k in HEIGHT else {})) for k, n, p, t, sc in PINS],
  roads=[], rivers=[],  # laid below, against this file's own pins and frame
  lakes=[OrderedDict(name=n, center=m(*c), r=m(*r)) for n, c, r in LAKES],
  peaks=[OrderedDict(name=n, pos=m(*p)) for n, p in PEAKS],
  high=[m(*p) for p in HIGH],
  woods=[OrderedDict(name=n, pos=m(*p)) for n, p in WOODS],
)
# Keep the hand-written player blurbs and DM notes from the file already on disk.
def keep_notes(world, path):
    import os as _os, json as _json
    if not _os.path.exists(path): return
    old = {p['key']: p for p in _json.load(open(path))['pins']}
    for p in world['pins']:
        for k in ('blurb', 'dm'):
            if k in old.get(p['key'], {}) and k not in p: p[k] = old[p['key']][k]


old = json.load(open(PATH), object_pairs_hook=OrderedDict) if os.path.exists(PATH) else None
if old is not None and 'cover' in old:
    # the cover pass's refined file: everything it holds stays; the roads and rivers are this script's
    b = old['bounds']; px = lambda p: (p[0] * PX_PER_MILE, p[1] * PX_PER_MILE)
    old['roads'], old['rivers'] = paths({p['key']: px(p['pos']) for p in old['pins']}, (*px((b['minX'], b['minY'])), *px((b['maxX'], b['maxY']))))
    world, which = old, 'the refined world.json (cover kept)'
else:
    out['roads'], out['rivers'] = paths({k: p for k, _, p, _, _ in PINS}, BOUNDS)
    keep_notes(out, PATH)
    world, which = out, 'the base world.json'
with open(PATH, 'w') as f: json.dump(world, f, indent=1); f.write('\n')
print('world:', which + ';', len(world['pins']), 'pins,', len(world['roads']), 'roads,', len(world['rivers']), 'rivers')
