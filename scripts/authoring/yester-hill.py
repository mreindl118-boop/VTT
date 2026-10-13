#!/usr/bin/env python3
"""Yester Hill (chapter 14, area Y; map p.199, one printed square = 50 ft), at true size on the 5-ft lattice: the
druids' hill on the western edge of Strahd's domain, read off the book's map in printed squares (S() turns a
square reading into cells). The land is a hill you climb (see "the land" below). A token stands at its level's floor,
so the party stands on the hill at five heights, one level each, and always on the ground under it; it climbs the
trail from one to the next by the stair markers at either end of each stretch:

* hill - the forest floor round the hill's foot: the trail through the forest from the north-east (Y1) to where the
  slope begins, and the wall of fog that closes the west (Y5). The slope itself is fenced off to players.
* slope-low, slope-high - the trail's two landings on the slope, where it holds level for some 40 ft (Y1).
* outer - the outer track round the slope under the brow, its cairns (Y2, keyed by sector as the book scatters its
  six labels; Kavan's cairn is among them) and the trail where it crosses it (Y1).
* summit - the flat top and the inner track round it: the track and its cairns (Y2, by sector), the trail's last
  stretch (Y1), the druids' ring of black boulders (Y3) with the fifty-foot effigy of Strahd and the graves, druids
  and berserkers, and the dead copse of the Gulthias tree with its blights (Y4).

Every level draws the whole hill round it: the land, the two tracks, the cairns, the forest and the fog.

Only keys, names, pages, dimensions, placements and our own wording live here. -> locations/ch14/Y/{scene,grid}.json"""
import json, math, os, sys
import numpy as np
from collections import OrderedDict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from authorlib import ROOT, Level, rect, unit_edges, seg_key  # noqa: F401

_M = json.load(open(os.path.join(ROOT, 'manifests', 'locations.json')))
PAGE = {a['key']: a['page'] for l in _M['locations'] if l['id'] == 'Y' for a in l['areas']}
pg = lambda k: PAGE.get(k)


def S(c, r):
    """A reading in printed squares (column, row on the plate's grid) -> plan cells (5 ft)."""
    return (round((c - 1.5) * 10, 2), round((r - 4.5) * 10, 2))


def H(i, k=0):
    s = math.sin(i * 127.1 + k * 311.7) * 43758.5453
    return s - math.floor(s)


def catmull(pts, n=12, closed=True):
    """A smooth curve through control points (closed loop by default), n samples per span."""
    out, m = [], len(pts)
    rng = range(m) if closed else range(m - 1)
    for i in rng:
        p0, p1, p2, p3 = pts[(i - 1) % m], pts[i], pts[(i + 1) % m], pts[(i + 2) % m]
        if not closed:
            p0 = pts[max(i - 1, 0)]; p3 = pts[min(i + 2, m - 1)]
        for k in range(n):
            t = k / n; t2, t3 = t * t, t * t * t
            out.append(tuple(round(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3), 3) for j in (0, 1)))
    if not closed: out.append(tuple(pts[-1]))
    return out


def band(points, w):
    left, right = [], []
    for i, (x, z) in enumerate(points):
        if i == 0: dx, dz = points[1][0] - x, points[1][1] - z
        elif i == len(points) - 1: dx, dz = x - points[i - 1][0], z - points[i - 1][1]
        else: dx, dz = points[i + 1][0] - points[i - 1][0], points[i + 1][1] - points[i - 1][1]
        L = math.hypot(dx, dz) or 1
        nx, nz = -dz / L * w / 2, dx / L * w / 2
        left.append((round(x + nx, 2), round(z + nz, 2))); right.append((round(x - nx, 2), round(z - nz, 2)))
    return left + right[::-1]


def along(points, step, closed=False):
    """Points every `step` cells along a polyline (or loop)."""
    pts = points + ([points[0]] if closed else [])
    out, carry = [], 0.0
    for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
        L = math.hypot(x1 - x0, z1 - z0); d = carry
        while d < L:
            t = d / L; out.append((x0 + (x1 - x0) * t, z0 + (z1 - z0) * t))
            d += step
        carry = d - L
    return out


def inside(p, poly):
    x, z = p; c = False
    for (x0, z0), (x1, z1) in zip(poly, poly[1:] + poly[:1]):
        if (z0 > z) != (z1 > z) and x < x0 + (x1 - x0) * (z - z0) / (z1 - z0): c = not c
    return c


def dist_to(p, line):
    best = 1e9
    for (x0, z0), (x1, z1) in zip(line, line[1:]):
        dx, dz = x1 - x0, z1 - z0; L2 = dx * dx + dz * dz or 1
        t = max(0, min(1, ((p[0] - x0) * dx + (p[1] - z0) * dz) / L2))
        best = min(best, math.hypot(p[0] - x0 - dx * t, p[1] - z0 - dz * t))
    return best


def ov(lv, a, b, **kw):
    """Override one edge exactly as the wall builder splits it (diagonals whole, straight runs per cell)."""
    k = seg_key(a, b); lv.overrides[k] = dict(lv.overrides.get(k, {}), **kw)


def open_all(lv, poly):
    for a, b in unit_edges(poly): ov(lv, a, b, open_wall=True)


def circle(c, r, n=48, a0=0.0):
    return [(round(c[0] + math.cos(math.radians(a0 + i * 360 / n)) * r, 3), round(c[1] + math.sin(math.radians(a0 + i * 360 / n)) * r, 3)) for i in range(n)]


# ---------------------------------------------------------------- the plate, read in printed squares
W_CELLS, H_CELLS = 345, 450                                       # 34.5 × 45 squares: 1,725 × 2,250 ft
CEN = S(19.2, 28.7)                                               # the rings' centre
OUTER = catmull([S(*p) for p in [(19.2, 16.4), (23.0, 16.9), (25.6, 18.3), (27.0, 20.8), (27.5, 24.0), (27.6, 27.5), (27.0, 31.0), (25.8, 34.4),
                                  (24.0, 37.4), (21.6, 39.8), (18.6, 41.1), (15.6, 41.0), (12.9, 39.9), (10.8, 37.8), (9.5, 35.0), (9.2, 32.0),
                                  (9.6, 29.0), (10.4, 26.2), (11.4, 23.2), (12.8, 20.5), (14.8, 18.3), (17.0, 16.9)]], 8)
INNER = catmull([S(*p) for p in [(19.2, 19.0), (22.0, 19.4), (24.0, 20.6), (25.0, 22.6), (25.2, 25.5), (25.0, 28.8), (24.3, 32.0), (23.0, 34.8),
                                  (21.1, 37.0), (18.6, 38.4), (16.0, 38.5), (13.9, 37.5), (12.5, 35.6), (12.0, 33.0), (12.2, 30.0), (12.7, 27.2),
                                  (13.4, 24.6), (14.6, 22.2), (16.4, 20.2)]], 8)
# Y1 climbs from the forest floor at the north-east corner and spirals south round the east slope, never steeper than
# 1 in 5, to cross both tracks on the south-east and run over the top to the ring's north gap (ft)
TRAIL_FT = [(1718, 25), (1679, 70), (1637, 114), (1596, 158), (1576, 213), (1577, 273), (1585, 333), (1594, 392), (1602, 451), (1608, 511),
            (1611, 571), (1612, 631), (1610, 691), (1607, 751), (1600, 810), (1591, 870), (1578, 928), (1563, 986), (1545, 1044), (1524, 1100),
            (1500, 1155), (1472, 1208), (1441, 1259), (1407, 1308), (1369, 1355), (1328, 1399), (1283, 1439), (1234, 1474), (1190, 1462),
            (1134, 1411), (1095, 1330), (1065, 1230), (1035, 1112), (985, 1052), (935, 1038)]
TRAIL = [(round(x / 5, 3), round(z / 5, 3)) for x, z in catmull(TRAIL_FT, 3, closed=False)]
SW_PATH = catmull([S(*p) for p in [(18.3, 29.9), (17.7, 30.8), (17.0, 31.6)]], 4, closed=False)
Y3C, Y3R = S(19.35, 27.6), 25.0                                  # the druids' ring: 250 ft across
STATUE = S(18.15, 27.45)
GULTHIAS = S(15.5, 33.2)
CLEAR = [S(*p) for p in [(5.0, 17.8), (7.5, 16.0), (10, 15.2), (13, 14.8), (17, 14.5), (21, 14.3), (24.5, 13.9), (27.0, 14.6), (28.4, 16.0), (28.8, 18.5),
                         (29.4, 21), (29.7, 25), (29.6, 29.5), (29.0, 33.3), (27.9, 36.4), (26.3, 39.0), (24.2, 41.3), (21.8, 42.9), (18.5, 43.8),
                         (15.0, 43.8), (11.6, 43.2), (8.8, 42.0), (6.6, 40.0), (5.2, 37.5), (4.6, 34), (4.6, 26), (4.8, 21)]]
FOG = [S(*p) for p in [(1.5, 13.6), (3.2, 14.2), (4.6, 15.6), (5.0, 17.8), (4.8, 21), (4.6, 26), (4.6, 34), (5.0, 37.0), (4.4, 39.2), (3.0, 40.4), (1.5, 40.8)]]


def polar(curve):
    """r(θ) of a curve that is star-shaped about CEN."""
    pts = sorted((math.atan2(z - CEN[1], x - CEN[0]), math.hypot(x - CEN[0], z - CEN[1])) for x, z in curve)
    def r(a):
        a = math.atan2(math.sin(a), math.cos(a))
        for (a0, r0), (a1, r1) in zip(pts + [(pts[0][0] + 2 * math.pi, pts[0][1])], pts[1:] + [(pts[0][0] + 2 * math.pi, pts[0][1])]):
            if a0 <= a <= a1: return r0 + (r1 - r0) * (a - a0) / ((a1 - a0) or 1)
        if a < pts[0][0]: return pts[0][1]
        return pts[-1][1]
    return r
R_OUT, R_IN = polar(OUTER), polar(INNER)
at = lambda r, a, k=0.0: (round(CEN[0] + math.cos(a) * (r(a) + k), 2), round(CEN[1] + math.sin(a) * (r(a) + k), 2))

# ================================================================== the land: the hill as a heightfield (feet, +x east, +z south)
# The hill is land you climb: a broad top inside the inner track, the band of the two cairn tracks under its brow, and
# the slope below the outer track, falling to the forest floor round the hill's foot. Heights are feet above the hill
# level's floor; the forest floor lies FLOOR above it. The top stands some 270 ft above the forest floor with slopes of
# at most about 1 in 2 (the book gives about 400 ft from the forest: on a plate this size that would mean slopes no one
# could walk). The tracks hold their contour; the trail winds up at no more than 1 in 5. The land runs out past the
# plate until the foot has reached the forest floor all round, and ends on that floor: the land drawn round the map
# (kit/sites/w.ts) carries the same floor on, so the two meet with no step.
KNOTS = [(0, 0, 0.25), (150, 50, 0.42), (400, 166, 0.44), (600, 243, 0.17), (700, 254, 0.0), (5000, 254, 0.0)]
FOOT = 700.0                       # the slope below the outer track (ft out from it, ft below it, grade) reaches the floor here
ELL = (853.37, 1211.69, 0.289, 442.97, 644.42)   # the outer track's fitted ellipse: centre x, z, turn, half-axes (ft)
LAT = 10.0                         # the lattice: 10-ft cells, from the forest floor west of the hill to the floor east of it
GX0, GZ0, GNX, GNZ = -360.0, -170.0, 244, 276    # x -360..2080, z -170..2590 (multiples of 4: the land draws in blocks of 4)
FLOOR = -0.05                      # the forest floor: the hill level's own ground (its grid lies on it), as on a flat map
TOP = 272.0                        # the summit level's floor
TOP_G = TOP - 0.55                 # the turf of the top: a little under the summit's floors and grid
H_OUT = KNOTS[-1][1] + FLOOR       # the outer track: 253.95
OUT_TO_TOP = TOP_G - H_OUT         # the top above the outer track
Q = 0.1                            # the heightfield's step (ft), counted up from the forest floor
CX, CZ = CEN[0] * 5.0, CEN[1] * 5.0
_ANG = np.linspace(-math.pi, math.pi, 3601)
_RIN = np.array([R_IN(a) * 5.0 for a in _ANG]); _ROUT = np.array([R_OUT(a) * 5.0 for a in _ANG])


def drop(d):
    """Feet below the outer track, d ft out from it (cubic Hermite through KNOTS)."""
    d = np.clip(np.asarray(d, float), 0, KNOTS[-1][0]); out = np.zeros_like(d)
    for (d0, h0, g0), (d1, h1, g1) in zip(KNOTS[:-1], KNOTS[1:]):
        m = (d >= d0) & (d <= d1); L = d1 - d0; s = (d[m] - d0) / L
        out[m] = h0 * (2 * s ** 3 - 3 * s ** 2 + 1) + g0 * L * (s ** 3 - 2 * s ** 2 + s) + h1 * (-2 * s ** 3 + 3 * s ** 2) + g1 * L * (s ** 3 - s ** 2)
    return out


def ell_out(X, Z):
    """Ft outside the outer track's ellipse, along the ray from its centre."""
    ex, ez, t, a, b = ELL
    dx, dz = X - ex, Z - ez; c, s = math.cos(t), math.sin(t)
    u, v = dx * c + dz * s, -dx * s + dz * c; r = np.hypot(u, v)
    k = np.sqrt((u / a) ** 2 + (v / b) ** 2); return r - r / np.maximum(k, 1e-9)


def ell_at(phi, D):
    """The point (ft) D ft out from the outer track's ellipse, on the ray at angle phi in the ellipse's own frame."""
    ex, ez, t, a, b = ELL
    c, s = math.cos(phi), math.sin(phi); r = 1 / math.sqrt((c / a) ** 2 + (s / b) ** 2) + D; u, v = c * r, s * r
    return (ex + u * math.cos(t) - v * math.sin(t), ez + u * math.sin(t) + v * math.cos(t))


def dome(X, Z):
    """The bare hill (no tracks cut in yet), in ft above the hill level's floor."""
    X, Z = np.asarray(X, float), np.asarray(Z, float)
    dx, dz = X - CX, Z - CZ; r = np.hypot(dx, dz); a = np.arctan2(dz, dx)
    rin, rout = np.interp(a, _ANG, _RIN), np.interp(a, _ANG, _ROUT)
    t = np.clip((r - rin) / (rout - rin), 0, 1)
    band_h = OUT_TO_TOP * (1 - t * t * (3 - 2 * t))
    dn = r - rout; de = ell_out(X, Z); w = np.clip((dn - 100) / 300, 0, 1); w = w * w * (3 - 2 * w)
    d = dn * (1 - w) + de * w            # the track itself near it, its ellipse farther out
    return np.where(r <= rin, OUT_TO_TOP, np.where(r <= rout, band_h, -drop(np.maximum(d, 0)))) + H_OUT


def _lattice():
    xs = GX0 + np.arange(GNX + 1) * LAT; zs = GZ0 + np.arange(GNZ + 1) * LAT
    return np.meshgrid(xs, zs)          # [j, i]


def _near_on(px, pz, line):
    """Per lattice vertex: distance (ft) to a polyline of (x, z, h) and the line's height at the nearest point."""
    best = np.full(px.shape, np.inf); bh = np.zeros(px.shape)
    for (x0, z0, h0), (x1, z1, h1) in zip(line[:-1], line[1:]):
        dx, dz = x1 - x0, z1 - z0; L2 = dx * dx + dz * dz or 1e-9
        t = np.clip(((px - x0) * dx + (pz - z0) * dz) / L2, 0, 1)
        d = np.hypot(px - x0 - dx * t, pz - z0 - dz * t)
        m = d < best; best = np.where(m, d, best); bh = np.where(m, h0 + (h1 - h0) * t, bh)
    return best, bh


def bench(Hh, px, pz, line, w):
    """Cut a track `w` ft wide into the land along `line`: level across, the bank above cut back at 2:3, the fill below
    falling at 1:2 (gentle enough to grass over)."""
    d, rh = _near_on(px, pz, line)
    bw = w / 2 + 1.5
    up = np.minimum(Hh, rh - 0.2 + (d - bw) * 0.65); dn = np.maximum(Hh, rh - 0.2 - (d - bw) * 0.5)
    return np.where(d <= bw, rh - 0.2, np.where(Hh > rh, up, dn))


LAG = 3.0                          # how far (ft) the trail may run below the hill's own surface, cut into it, past a landing


def profile(pts_ft, grade_max=0.199, landings=(), span=2):
    """A trail's heights: the hill's own height along it, smoothed, never steeper than grade_max. Where the hill first
    reaches each height in `landings`, the trail holds level for `span` samples (some 40 ft): a landing where the party
    stops on the climb. On a slope as steep as the trail a level stretch puts the trail below the land beyond it, so
    the trail comes up to each landing a little above the hill (on an embankment) and leaves it a little below (in a
    cutting), never more than LAG below, and follows the hill again as soon as its grade allows."""
    xs = np.array([p[0] for p in pts_ft]); zs = np.array([p[1] for p in pts_ft])
    T = dome(xs, zs)
    s = np.concatenate([[0], np.cumsum(np.hypot(np.diff(xs), np.diff(zs)))]); ds = np.diff(s)
    k = np.exp(-0.5 * ((s[:, None] - s[None, :]) / 25.0) ** 2); T = (k @ T) / k.sum(1)
    flat, first = set(), None                                       # flat: samples level with the one before
    for hl in sorted(landings):
        a = int(np.argmax(T >= hl)); first = a if first is None else first
        flat.update(range(a + 1, a + span + 1))
    lo = T - np.where(np.arange(len(T)) > (first if first is not None else len(T)), LAG, 0.0)
    req = lo.copy()                                                 # the least height each sample needs, looking ahead
    for i in range(len(T) - 2, -1, -1):
        req[i] = max(lo[i], req[i + 1] if i + 1 in flat else req[i + 1] - grade_max * ds[i])
    hs = T.copy(); hs[0] = max(req[0], T[0])
    for i in range(1, len(hs)):
        hs[i] = hs[i - 1] if i in flat else max(req[i], min(max(T[i], hs[i - 1]), hs[i - 1] + grade_max * ds[i - 1]))
    return [(float(x), float(z), round(float(h), 2)) for x, z, h in zip(xs, zs, hs)]


# ---------------------------------------------------------------- the props' data
def ribbon_dims(pts, w, origin=(0.0, 0.0, 0.0)):
    """A ribbon through (x, z, y) points, relative to origin."""
    d = {'n': len(pts), 'w': w}
    for i, (x, z, y) in enumerate(pts):
        d[f'x{i}'] = round(x - origin[0], 2); d[f'z{i}'] = round(z - origin[1], 2); d[f'y{i}'] = round(y - origin[2], 2)
    return d


# ---------------------------------------------------------------- the tracks cut into the hill; the land as drawn
loop_ft = lambda curve: [(x * 5.0, z * 5.0) for x, z in curve + curve[:1]]
TRACK_W = 10.0                                    # the two tracks and the trail: a cart's width
RING_IN = [(x, z, TOP_G) for x, z in loop_ft(INNER)]
RING_OUT = [(x, z, H_OUT) for x, z in loop_ft(OUTER)]
LANDINGS = (85.0, 170.0)                          # the trail's two landings on the slope (ft above the forest floor)
TRAIL3 = profile([(x * 5.0, z * 5.0) for x, z in TRAIL], landings=LANDINGS)


def meet(line, R, h, g=0.199, hold=0.0):
    """Raise the trail's approach so that it comes onto a track (ring R, height h) level with it, climbing no steeper;
    with `hold`, it runs level with the track for that many feet either side of the crossing, then climbs on from it."""
    rel = [abs(math.hypot(x / 5 - CEN[0], z / 5 - CEN[1]) - R(math.atan2(z / 5 - CEN[1], x / 5 - CEN[0]))) for x, z, _ in line]
    k = rel.index(min(rel)); s = np.concatenate([[0], np.cumsum([math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(line, line[1:])])])
    def y_at(i, y):
        d = s[i] - s[k]
        if abs(d) <= hold: return h
        if d < 0: return max(y, h - g * (-d - hold))
        return max(h, min(y, h + g * (d - hold)))
    return [(x, z, round(y_at(i, y), 2)) for i, (x, z, y) in enumerate(line)]
TRAIL3 = meet(meet(TRAIL3, R_OUT, H_OUT, hold=34.0), R_IN, TOP_G)
SW3 = [(x * 5.0, z * 5.0, TOP_G) for x, z in SW_PATH]
_X, _Z = _lattice()
LAND = np.minimum(dome(_X, _Z), TOP_G)
# where the trail holds level on the climb (its landings, then its crossing of the outer track): (first, last sample, ft)
RUNS = []
for _i in range(len(TRAIL3) - 1):
    if TRAIL3[_i + 1][2] == TRAIL3[_i][2] and 1 < TRAIL3[_i][2] < TOP_G - 1:
        if RUNS and RUNS[-1][1] == _i: RUNS[-1][1] = _i + 1
        else: RUNS.append([_i, _i + 1, TRAIL3[_i][2]])
assert len(RUNS) == len(LANDINGS) + 1 and RUNS[-1][2] == H_OUT, RUNS   # a landing at each height, then the outer track
PLATFORM = 14.0                                   # each level stretch of the trail is cut as a platform this wide
# the outer track's bench runs a little wider than the track, so the land drawn on the lattice stays flat under its floor
for _line, _w in ((RING_OUT, TRACK_W + 6), (RING_IN, TRACK_W), (TRAIL3, TRACK_W), (SW3, 8.0)): LAND = bench(LAND, _X, _Z, _line, _w)
for _a, _b, _ in RUNS: LAND = bench(LAND, _X, _Z, TRAIL3[_a:_b + 1], PLATFORM)
LAND = np.maximum(LAND, FLOOR)
LAND = FLOOR + np.round((LAND - FLOOR) / Q) * Q   # exactly what the prop draws (from the forest floor, in steps of Q)
_edge = np.concatenate([LAND[0], LAND[-1], LAND[:, 0], LAND[:, -1]])
assert np.allclose(_edge, FLOOR), 'the land must reach the forest floor before the lattice ends'


class Land:
    """The land as the prop draws it (kit/sites/w.ts, hillLand): the lattice in blocks of 4 x 4 cells, each drawn whole
    where the ground stays within `tol` ft of the plane through its corners (a lattice of tolerances: finer under the
    levels' floors on the slope), else as four blocks of 2 x 2, each of those whole or as four single cells. A block takes in every vertex a smaller neighbour uses on its edge, with a fan
    from its middle (at the mean of its corners), so no crack opens. Only the vertices the blocks use are stored."""

    def __init__(self, tol):
        self.bx, self.bz = GNX // 4, GNZ // 4
        act = np.zeros(LAND.shape, bool); self.codes = []; self.leaf = {}
        def smooth(i, j, s):
            a, b, c, e = LAND[j, i], LAND[j, i + s], LAND[j + s, i + s], LAND[j + s, i]
            u = np.arange(s + 1) / s; U, V = np.meshgrid(u, u)
            return np.abs(LAND[j:j + s + 1, i:i + s + 1] - (a * (1 - U) * (1 - V) + b * U * (1 - V) + c * U * V + e * (1 - U) * V)).max() <= tol[j:j + s + 1, i:i + s + 1].min()
        def add(i, j, s, out):
            out.append((i, j, s)); act[j, i] = act[j, i + s] = act[j + s, i] = act[j + s, i + s] = True
        for bj in range(self.bz):
            for bi in range(self.bx):
                i, j, code, out = bi * 4, bj * 4, 0, []
                if smooth(i, j, 4): add(i, j, 4, out)
                else:
                    code = 1
                    for c in range(4):
                        ci, cj = i + (c & 1) * 2, j + (c >> 1) * 2
                        if smooth(ci, cj, 2): add(ci, cj, 2, out)
                        else:
                            code |= 2 << c
                            for di, dj in ((0, 0), (1, 0), (0, 1), (1, 1)): add(ci + di, cj + dj, 1, out)
                self.codes.append(code); self.leaf[(bi, bj)] = out
        self.act = act

    def dims(self):
        d = {'nx': GNX, 'nz': GNZ, 'cell': LAT, 'q': Q}
        for k in range(0, len(self.codes), 9):
            d[f'c{k // 9}'] = sum(c * 32 ** m for m, c in enumerate(self.codes[k:k + 9]))
        hs = [int(round((v - FLOOR) / Q)) for v in LAND[self.act]]   # row by row: the order the prop reads them in
        assert max(hs) < 4095
        for k in range(0, len(hs), 4):
            d[f'h{k // 4}'] = sum(c * 4096 ** m for m, c in enumerate(hs[k:k + 4]))
        return d

    def ring(self, i, j, s):
        r = [(i + k, j) for k in range(s)] + [(i + s, j + k) for k in range(s)] + [(i + s - k, j + s) for k in range(s)] + [(i, j + s - k) for k in range(s)]
        return [(x, z) for x, z in r if self.act[z, x]]

    def __call__(self, x, z):
        """The drawn land's height (ft above the hill level's floor) at (x, z) ft."""
        fi = min(max((x - GX0) / LAT, 0), GNX - 1e-6); fj = min(max((z - GZ0) / LAT, 0), GNZ - 1e-6)
        for i, j, s in self.leaf[(int(fi) // 4, int(fj) // 4)]:
            if i <= fi <= i + s and j <= fj <= j + s: break
        hv = lambda a: float(LAND[a[1], a[0]])
        b = self.ring(i, j, s)
        if len(b) == 4:
            a, bb, c, e = (i, j), (i + s, j), (i + s, j + s), (i, j + s)
            tris = [(a, bb, c), (a, c, e)] if abs(hv(a) - hv(c)) < abs(hv(bb) - hv(e)) else [(a, bb, e), (bb, c, e)]
            pts = {p: hv(p) for p in (a, bb, c, e)}
        else:
            m = (i + s / 2, j + s / 2); pts = {p: hv(p) for p in b}
            pts[m] = sum(hv(p) for p in ((i, j), (i + s, j), (i + s, j + s), (i, j + s))) / 4
            tris = [(m, b[k], b[(k + 1) % len(b)]) for k in range(len(b))]
        best = None
        for A, B, C in tris:
            den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1])
            l1 = ((B[1] - C[1]) * (fi - C[0]) + (C[0] - B[0]) * (fj - C[1])) / den
            l2 = ((C[1] - A[1]) * (fi - C[0]) + (A[0] - C[0]) * (fj - C[1])) / den
            l3 = 1 - l1 - l2; worst = min(l1, l2, l3)
            if best is None or worst > best[0]: best = (worst, l1 * pts[A] + l2 * pts[B] + l3 * pts[C])
        return best[1]


# the land is drawn to within 0.3 ft, and to within 0.05 ft where a level's floor lies on the slope (the trail's
# level stretches and the outer track), so that floor stays just above the land drawn under it
_fine = np.minimum(_near_on(_X, _Z, RING_OUT)[0], np.min([_near_on(_X, _Z, TRAIL3[_a:_b + 1])[0] for _a, _b, _ in RUNS], axis=0))
LAND_HILL = Land(np.where(_fine < 25, 0.05, 0.3))


def scenery(lv, elev, thin=1, keyed=(), keep=None):
    """What every level sees of the hill: the land, the tracks and trail cut into it, the cairns, the forest and the fog
    (all of it scenery, never under the fog of war: kit/sites/w.ts). Above the forest floor the forest is thinned
    (`thin`: one tree in so many, but all of it where keep(x, z) says). A track in `keyed` is that level's own floor, so
    its ribbon is left out."""
    o = lv.obj('land', 'hill-land', (GX0 / 5, GZ0 / 5), 'explored', None, dims=LAND_HILL.dims(), y=round(FLOOR - elev, 2))
    tracks = [('track-outer', RING_OUT, TRACK_W), ('trail', TRAIL3[FOOT_I:], TRACK_W), ('path-sw', SW3, 8.0), ('track-inner', RING_IN, TRACK_W)]   # the trail's foot is Y1's own floor
    for id_, line, w in tracks:
        if id_ in keyed: continue
        lv.obj(id_, 'hill-track', (0, 0), 'player', None, dims=ribbon_dims([(x, z, y - 0.2) for x, z, y in line], w, (0, 0, elev)))
    cairns(lv)
    forest(lv, thin, keep)
    fog_wall(lv, elev)
    return o


AMB = 'barovian-overcast'
# the trail: where it leaves the forest floor (the hill level's ground) and where it reaches the inner track (the summit's)
_tr_s = np.concatenate([[0], np.cumsum([math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(TRAIL3, TRAIL3[1:])])])
FENCE_D = FOOT - 4                                                 # the forest floor's inner edge (ft out from the outer track)
FOOT_I = next(i for i, (x, z, _) in enumerate(TRAIL3) if ell_out(np.array(x), np.array(z)) < FENCE_D + 14)
TOP_I = next(i for i, (x, z, _) in enumerate(TRAIL3) if math.hypot(x / 5 - CEN[0], z / 5 - CEN[1]) < R_IN(math.atan2(z / 5 - CEN[1], x / 5 - CEN[0])))
LIFT = 0.6                         # a landing's floor stands this far over the trail it lies on (a track's, TOP - TOP_G)


def trail_at(sft):
    """The trail's centre (cells) sft ft along it."""
    k = max(0, min(len(_tr_s) - 2, int(np.searchsorted(_tr_s, sft) - 1)))
    t = (sft - _tr_s[k]) / ((_tr_s[k + 1] - _tr_s[k]) or 1)
    (x0, z0, _), (x1, z1, _) = TRAIL3[k], TRAIL3[k + 1]
    return ((x0 + (x1 - x0) * t) / 5, (z0 + (z1 - z0) * t) / 5)


def trail_band(s0, s1, w=2.0):
    """The trail's own floor between s0 and s1 ft along it, w cells wide."""
    inner = [(x / 5, z / 5) for (x, z, _), d in zip(TRAIL3, _tr_s) if s0 < d < s1]
    return band([trail_at(s0)] + inner + [trail_at(s1)], w)


def ring_off(sft, R):
    """How far (ft) the trail's centre lies outside ring R, sft ft along it."""
    x, z = trail_at(sft); return (math.hypot(x - CEN[0], z - CEN[1]) - R(math.atan2(z - CEN[1], x - CEN[0]))) * 5


def cross(R, off, s0, s1):
    """Where (ft along the trail, between s0 and s1) the trail's centre passes `off` ft outside ring R."""
    for _ in range(40):
        m = (s0 + s1) / 2
        if (ring_off(s0, R) - off) * (ring_off(m, R) - off) <= 0: s1 = m
        else: s0 = m
    return (s0 + s1) / 2


def cairns(lv):
    """The cairns: a ring along the outer verge of each track, about one every fifty feet, each ring on its own contour."""
    n = 0
    for which, cnt, R in ((0, 64, R_OUT), (1, 48, R_IN)):
        for i in range(cnt):
            a = 2 * math.pi * i / cnt + H(i, which) * 0.04
            p = at(R, a, 2.5 + (H(i, 3 + which) - 0.5) * 0.3)
            if dist_to(p, TRAIL) < 4.5 or dist_to(p, SW_PATH) < 3: continue
            lv.prop(f'cairn{n}', 'cairn', p, None, rotY=int(H(i, 5) * 360), dims={'seed': n, 'r': round(5.5 + H(i, 6) * 1.5, 2), 'open': 1})
            n += 1
    return n


def forest(lv, thin=1, keep=None):
    """The forest on three sides of the hill and round its foot, the trail cut through it: a tree every 40 ft within
    120 ft of the trail and the forest's edge, every 55 ft deeper in (where the canopy hides the floor). `thin` keeps one
    in so many, except where keep(x, z) (cells) says. The forest drawn round the map (the backdrop's) begins where the
    land ends."""
    trees = 0
    near = lambda x, z: dist_to((x, z), TRAIL) < 24 or dist_to((x, z), CLEAR + CLEAR[:1]) < 24
    X0, Z0, X1, Z1 = GX0 / 5, GZ0 / 5, (GX0 + GNX * LAT) / 5, (GZ0 + GNZ * LAT) / 5
    for step, zone in ((8, 'near'), (11, 'far')):
        for gz in range(int(Z0) - 1, int(Z1) + 1, step):
            for gx in range(int(X0) - 1, int(X1) + 1, step):
                i = gz * 1000 + gx + step * 7
                x, z = gx + (H(i, 1) - 0.5) * step * 0.75, gz + (H(i, 2) - 0.5) * step * 0.75
                if not (X0 + 3 <= x <= X1 - 3 and Z0 + 3 <= z <= Z1 - 3) or x < (FOG_X + 60) / 5: continue   # the fog's foot stays open
                if (zone == 'near') != near(x, z): continue
                if inside((x, z), CLEAR) or dist_to((x, z), TRAIL) < 4: continue
                edge = min(dist_to((x, z), CLEAR + CLEAR[:1]), 40)
                if edge < 3 and H(i, 3) < 0.5: continue            # a ragged edge
                trees += 1
                if trees % thin and not (keep and keep(x, z)): continue
                lv.prop(f'tree{trees}', 'hill-pine', (x, z), None, dims={'scale': round(1.0 + H(i, 8) * 0.5, 2)})
    return trees


FOG_X = -345.0                                                     # the fog's front (ft), on the forest floor at the hill's west foot
def fog_wall(lv, elev):
    """Y5: the wall of fog along the whole west, standing on the forest floor at the hill's west foot and running on
    700 ft past the land's north and south ends, where it sinks away."""
    z0, z1 = GZ0, GZ0 + GNZ * LAT
    lv.obj('fog', 'fog-wall', (FOG_X / 5, (z0 + z1) / 10), 'explored', None, dims={'len': z1 - z0, 'h': 950, 'd': 900, 'ext': 700, 'seed': 3}, y=round(FLOOR - elev, 2))
    lv.objects[-1]['label'] = 'Wall of fog'


def summit_dressing(lv, full):
    """The ring of black boulders, the effigy and the dead copse: the same on both levels."""
    k3, k4 = ('Y3-summit', 'Y4-summit') if full else (None, None)
    for i, (x, z) in enumerate(along(Y3P, 1.5, closed=True)):
        a = math.degrees(math.atan2(z - Y3C[1], x - Y3C[0]))
        if any(abs(((a - g + 180) % 360) - 180) < 5.5 for g in GAPS): continue
        j = (H(i, 1) - 0.5) * 1.2
        lv.prop(f'boulder{i}', 'black-boulder', (x + math.cos(math.radians(a)) * j, z + math.sin(math.radians(a)) * j), None, rotY=int(H(i, 2) * 360), dims={'r': round(2.2 + H(i, 3) * 2.6, 2), 'open': 1})
    for i in range(10):                                            # loose rocks spilled from the ring
        a = math.radians(i * 37 + 11); r = Y3R + (2.5 + H(i, 4) * 3) * (1 if i % 2 else -1)
        lv.prop(f'rock{i}', 'black-boulder', (Y3C[0] + math.cos(a) * r, Y3C[1] + math.sin(a) * r), None, dims={'r': round(1.2 + H(i, 5), 2), 'open': 1})
    lv.prop('effigy', 'strahd-effigy', STATUE, k3, rotY=25, dims={'open': 1})
    lv.objects[-1]['desc'] = 'A fifty-foot effigy of woven sticks stuffed with black soil: a giant fanged figure in a cloak, roots coiled round its feet.'
    lv.prop('gulthias', 'gulthias-tree', GULTHIAS, k4, dims={'open': 1})
    lv.objects[-1]['desc'] = 'An enormous gnarled tree oozing dark red sap, an axe bright in its trunk and a skeleton among its roots.'
    for i, a in enumerate(range(0, 360, 26)):
        r = 7 + H(i, 6) * 11; p = (GULTHIAS[0] + math.cos(math.radians(a)) * r, GULTHIAS[1] + math.sin(math.radians(a)) * r)
        if inside(p, Y4P): lv.prop(f'deadtree{i}', 'hill-dead-tree', p, None, rotY=a * 7 % 360, dims={'scale': round(0.7 + H(i, 7) * 0.5, 2)})
    for i, a in enumerate(range(10, 360, 23)):
        r = 9 + H(i, 8) * 9; p = (GULTHIAS[0] + math.cos(math.radians(a)) * r, GULTHIAS[1] + math.sin(math.radians(a)) * r)
        if inside(p, Y4P): lv.prop(f'shrub{i}', 'dead-shrub', p, None, dims={'scale': round(0.9 + H(i, 9) * 0.6, 2), 'seed': i, 'open': 1})


Y3P = circle(Y3C, Y3R, 48)
GAPS = [-70, 122]                                                  # where the trails pass through
Y4P = [(round(GULTHIAS[0] + math.cos(math.radians(a)) * (19 + 4 * math.sin(math.radians(a * 3 + 20))), 2), round(GULTHIAS[1] + math.sin(math.radians(a)) * (21 + 3 * math.cos(math.radians(a * 2))), 2)) for a in range(0, 360, 20)]
PATCH = 0.15                                                       # the earth patches stand this far above the turf (below the summit)


def earth_patches(lv, elev):
    """The withered turf of the ring and the copse's bare earth on the hilltop, seen from below the summit (the summit
    level has them as its keyed floors)."""
    for key, poly in (('Y3', Y3P), ('Y4', Y4P)):
        d = {'n': len(poly), 'y': round(TOP_G - elev, 2)}          # its top PATCH ft above the turf
        for i, (x, z) in enumerate(poly): d[f'x{i}'] = round(x * 5, 2); d[f'z{i}'] = round(z * 5, 2)
        lv.obj(f'{key}-earth', 'hill-patch', (0, 0), 'player', None, dims=d)


def sectors(lv, R, suffix=''):
    """Y2, keyed by sector as the book scatters its six labels: the track round ring R, 10 ft wide."""
    out = []
    for name, a0 in SECT:
        angs = [math.radians(a0 + k * 3) for k in range(21)]
        poly = [at(R, a, 1.0) for a in angs] + [at(R, a, -1.0) for a in reversed(angs)]
        lv.room(f'Y2-{suffix}{name}', 'Berserker Cairns', poly, 'dirt', page=pg('Y2')); open_all(lv, poly); out.append(poly)
    return out
SECT = [('north', -120), ('east', -60), ('southeast', 0), ('south', 60), ('southwest', 120), ('northwest', 180)]


# ================================================================== the hill: the forest floor round its foot (where tokens stand)
h = Level('hill', 'Yester Hill: the forest floor', 0, 12, ambient=AMB, interior='cave-rock', exterior='cave-rock', north='-z')
# The ground is the land; the level's own floor lies a hair under it over the whole lattice, so it never shows and the
# backdrop's land takes the map's bounds from it.
LX0, LZ0, LX1, LZ1 = (GX0 - 1) / 5, (GZ0 - 1) / 5, (GX0 + GNX * LAT + 1) / 5, (GZ0 + GNZ * LAT + 1) / 5
h.terrain.append((rect(LX0, LZ0, LX1, LZ1), 'grass'))
# Players walk the forest floor only: a fence they cannot see or cross runs round the hill's foot, where the slope
# begins (the trail up is the level's stair to its first landing). The DM places anything anywhere.
FENCE = [tuple(c / 5 for c in ell_at(2 * math.pi * k / 120, FENCE_D)) for k in range(120)]
for k, (a, b) in enumerate(zip(FENCE, FENCE[1:] + FENCE[:1])): h.wall(a, b, flags=['invisible'], id=f'hill-foot-{k}')
# Y1: the trail from the north-east corner of the plate through the forest to the foot of the slope
y1 = band([(x / 5, z / 5) for x, z, _ in TRAIL3[:FOOT_I + 1]], 2.0)
h.room('Y1', 'Trail', y1, 'dirt', page=pg('Y1')); open_all(h, y1)
# Y5: the strip of forest floor at the foot of the wall of fog, west of the hill
_fx = min(x for x, _ in FENCE)
Y5P = rect((FOG_X + 6) / 5, 100 / 5, min(_fx - 3, (FOG_X + 46) / 5), 2150 / 5)
h.room('Y5', 'Wall of Fog', Y5P, 'grass', page=pg('Y5')); open_all(h, Y5P)
scenery(h, 0.0)
summit_dressing(h, False)
earth_patches(h, 0.0)
# notes for the table: the places on the hill, at the height of the land they name
h.note('Y1-note', S(33.0, 13.0), 'Y1', 'Up through dense forest to a bare hill of black cairns under massing storm clouds, lightning on the top; westward the world ends in fog. The book has the hill rise about 400 ft from the forest; the map draws its top 271 ft above the forest floor, the trail climbing at 1 in 5 or less.')
h.note('Y5-note', ((FOG_X + 30) / 5, 1100 / 5), 'Y5', 'Looking west from the summit or the west slope: a pale castle above a far-off city seems to float in the fog, and a bell tolls faintly. It is an illusion. Entering the fog: Mists of Ravenloft (ch.2).')
h.note('climb', tuple(c / 5 for c in TRAIL3[FOOT_I][:2]), 'Y1', f'Tokens on this level stand on the forest floor round the hill. The trail climbs from here to the top (half an hour), and each stair marker takes the party on up it: two landings on the slope ({RUNS[0][2]:.0f} and {RUNS[1][2]:.0f} ft), the outer track ({H_OUT:.0f} ft), then the summit, where the inner track, the druids\' circle and the Gulthias tree are.')
h.note('heights', S(24.6, 44.2), None, f'Heights: the hilltop and the inner track {TOP_G:.0f} ft above the forest floor, the outer track {H_OUT:.0f} ft; the slopes below it are as steep as 1 in 2.')
for key, p, name in (('Y2', at(R_OUT, math.radians(-110), 6), 'Y2: the cairn tracks (Outer track and Summit levels)'), ('Y3', (Y3C[0], Y3C[1] - Y3R - 6), "Y3: the druids' circle (Summit level)"), ('Y4', (GULTHIAS[0], GULTHIAS[1] + 26), 'Y4: the Gulthias tree (Summit level)')):
    h.note(f'{key}-here', p, None, name)
h.obj('spawn', 'spawn', (TRAIL_FT[1][0] / 5, TRAIL_FT[1][1] / 5), 'dm-note', None, 'The party comes up the trail from the north-east')

# ================================================================== the climb: the trail's landings on the slope, then the outer track
# Each is a level whose floor is that stretch of trail (or the track), standing on the land, so a token there stands on
# the ground; the stair markers at either end take the party on up or back down the trail.
ENDS = 5.0                                                         # a stair marker stands this far in from the end of its stretch
LANDING_LV = []
for n, (i0, i1, hl) in enumerate(RUNS[:-1]):
    lid, key = ('slope-low', 'Y1-low') if n == 0 else ('slope-high', 'Y1-high')
    lv = Level(lid, f'The trail: {"lower" if n == 0 else "upper"} landing ({hl:.0f} ft)', round(hl + LIFT, 2), 12, ambient=AMB, interior='cave-rock', exterior='cave-rock', north='-z')
    poly = trail_band(_tr_s[i0], _tr_s[i1], 1.6)                   # 8 ft of the trail's 10: the land drawn under it stays below it
    lv.room(key, 'Trail', poly, 'dirt', page=pg('Y1')); open_all(lv, poly)
    _m = trail_at((_tr_s[i0] + _tr_s[i1]) / 2)                    # the whole forest round the landing, a thin one farther off
    scenery(lv, lv.elevation, thin=10, keep=lambda x, z, m=_m: math.hypot(x - m[0], z - m[1]) < 70)
    summit_dressing(lv, False)
    earth_patches(lv, lv.elevation)
    lv.note(f'{key}-note', trail_at((_tr_s[i0] + _tr_s[i1]) / 2), key, f'A level stretch of the trail on the {"east" if n == 0 else "south-east"} slope, {hl:.0f} ft above the forest floor: the forest drops away below, the black cairns of the tracks line the brow above. The stair markers take the trail on up or back down.')
    lv.ends = (_tr_s[i0] + ENDS, _tr_s[i1] - ENDS)
    LANDING_LV.append(lv)

o = Level('outer', f'The outer track ({H_OUT:.0f} ft)', round(H_OUT + TOP - TOP_G, 2), 12, ambient=AMB, interior='cave-rock', exterior='cave-rock', north='-z')
OUTER_SECT = sectors(o, R_OUT, 'outer')
# the trail where it crosses the track, level with it: the stretch below the track and the stretch above it
_c0, _c1 = _tr_s[RUNS[-1][0]], _tr_s[RUNS[-1][1]]
Y1O = trail_band(_c0, _c1, 1.6)
o.room('Y1-outer', 'Trail', Y1O, 'dirt', page=pg('Y1')); open_all(o, Y1O)
# the grid lies once on every floor: the track's sectors, and the trail where it runs off the track either side
_in, _out = cross(R_OUT, -5.0, _c0, _c1), cross(R_OUT, 5.0, _c0, _c1)
OUTER_GRID = OUTER_SECT + [trail_band(_c0, min(_in, _out), 1.6), trail_band(max(_in, _out), _c1, 1.6)]
scenery(o, o.elevation, thin=5, keyed=('track-outer',))
summit_dressing(o, False)
earth_patches(o, o.elevation)
_k = at(R_OUT, math.radians(150), 2.5)                            # one of the cairns on the track's outer verge
KAVAN = min(((ob['pos'][0] / 5, ob['pos'][2] / 5) for ob in o.objects if ob['kind'] == 'cairn'), key=lambda p: math.hypot(p[0] - _k[0], p[1] - _k[1]))
o.hidden('kavan', 'skeleton', KAVAN, 'Y2-outersouthwest', 'Kavan\'s cairn: under the heavy rocks lie his moldy bones and the blood spear (appendix C); the chosen character gets +2 to hit and damage with it (Blood Spear of Kavan event).')
o.objects[-1]['playerLabel'] = 'Old bones under the rocks'
o.note('Y2-outer-note', at(R_OUT, math.radians(-120), 6), 'Y2-outernorth', f'The outer of the two cairn tracks, {H_OUT:.0f} ft above the forest floor, holding its contour round the hill under the brow; the inner track and the summit lie {TOP_G - H_OUT:.0f} ft higher (the Summit level). The trail crosses it on the south-east.')

# ================================================================== the summit: its floor is the hilltop
s = Level('summit', 'Summit', TOP, 12, ambient=AMB, interior='cave-rock', exterior='cave-rock', north='-z')
# The battle ground is the whole flat top and the inner track round it: the grid lies on the turf. Y2 is the inner
# track, by sector as the book scatters its six labels; the trail's last stretch over the top is Y1 too.
sectors(s, R_IN)
y1t = band([(x / 5, z / 5) for x, z, _ in TRAIL3[TOP_I:]], 2.0)
s.room('Y1-top', 'Trail', y1t, 'dirt', page=pg('Y1')); open_all(s, y1t)
# the ring of boulders (5 to 10 ft) gives cover but hides nothing of the hilltop from a party on it: no walls
s.room('Y3-summit', "Druids' Circle", Y3P, 'dirt', page=pg('Y3')); open_all(s, Y3P)
s.room('Y4-summit', 'Gulthias Tree', Y4P, 'dirt', page=pg('Y4')); open_all(s, Y4P)
TOPP = [at(R_IN, math.radians(a), 1.0) for a in range(0, 360, 5)]
scenery(s, TOP, thin=5, keyed=('track-inner',))
summit_dressing(s, True)
# the dozen hidden graves and their sleepers (six druids, six berserkers)
GR = [(-14, -9), (-8, 12), (2, -16), (9, 8), (15, -6), (-17, 4), (-3, 18), (12, 15), (18, 3), (-11, -16), (6, -6), (-4, 4)]
for i, (dx, dz) in enumerate(GR):
    p = (Y3C[0] + dx, Y3C[1] + dz)
    if math.hypot(p[0] - STATUE[0], p[1] - STATUE[1]) < 6: p = (p[0] + 6, p[1])
    s.hidden(f'grave{i}', 'sod-grave', p, 'Y3-summit', 'A grave hidden under a lid of turf (passive Perception 16 spots all twelve)', rotY=int(H(i, 2) * 180))
    s.objects[-1]['playerLabel'] = 'A patch of dead sod'
    kind = 'druid' if i % 2 == 0 else 'berserker'
    lab = 'Druid (CE human) smeared all over with blue-grey mud, asleep in a grave; waits for Strahd before starting the ritual' if kind == 'druid' else 'Berserker (CE human) of the mountain tribe, mud-smeared, asleep in a grave'
    s.creature(f'sleeper{i}', kind, p, 'Y3-summit', lab)
    if kind == 'druid': s.objects[-1]['dims'] = {'v': 4}
s.hidden('gem', 'crystal-orb', STATUE, 'Y3-summit', 'The vineyard\'s stolen magic gem (a glowing green pinecone-sized gem) planted in the effigy\'s chest: climb and dig (d20 >= 13); drops out glowing when the effigy falls.')
s.objects[-1]['pos'][1] = 33; s.objects[-1]['playerLabel'] = 'A green glow'
s.creature('wintersplinter', 'tree-blight', STATUE, 'Y3-summit', 'Wintersplinter (tree blight) - only after the Druids\' Ritual: bursts from the statue with the gem in its heart and marches on the Wizard of Wines', size='huge')
s.note('Y2-note', at(R_IN, math.radians(-120), 6), 'Y2-north', f'Two dirt tracks circle the slope, each edged with ten-foot cairns of slick black stone: graves of an old berserker tribe, untouched for centuries. The inner track is this level\'s; the outer one lies {TOP_G - H_OUT:.0f} ft lower, under the brow (the Outer track level, by the trail).')
s.note('Y3-statue', (STATUE[0], STATUE[1] + 6), 'Y3-summit', 'Statue: AC 10, 50 hp, immune poison and psychic; oil + fire = 2d6 fire a round. Gulthias roots hold it up. Destroyed: the gem tumbles out glowing green.')
s.note('Y3-lightning', (Y3C[0] + 22, Y3C[1] - 10), 'Y3-summit', 'Climbing over the boulders: 10% chance of a lightning strike, 44 (8d10) lightning. The two trail gaps are safe.')
s.note('Y3-graves', (Y3C[0] - 6, Y3C[1] + 20), 'Y3-summit', 'Six druids and six berserkers sleep under sod covers; they rise if anyone approaches or harms the statue, or once found and attacked. Replenished at dusk (1d4-1 of each a day, up to six).')
s.note('ritual', S(21.5, 27.0), 'Y3-summit', "Druids' Ritual: when Strahd comes (on Beucephalus or as a bat) the druids rise and chant for 10 rounds; Wintersplinter, a tree blight, bursts from the statue and marches north on the Wizard of Wines. Needs room for a Huge creature.")
# Y4: needle blights in plain sight; vine and twig blights hidden among the dead plants
for i in range(6):
    a = math.radians(i * 60 + 15); p = (GULTHIAS[0] + math.cos(a) * 8, GULTHIAS[1] + math.sin(a) * 8)
    s.creature(f'needle{i}', 'needle-blight', p, 'Y4-summit', 'Needle blight (6), skulking round the tree in plain sight; attacks anyone who harms it')
for i in range(3):
    a = math.radians(i * 120 + 50); p = (GULTHIAS[0] + math.cos(a) * 13, GULTHIAS[1] + math.sin(a) * 13)
    s.creature(f'vine{i}', 'vine-blight', p, 'Y4-summit', 'Vine blight (3): False Appearance among the dead shrubs')
for i in range(12):
    a = math.radians(i * 30 + 5); r = 10 + (i % 3) * 3; p = (GULTHIAS[0] + math.cos(a) * r, GULTHIAS[1] + math.sin(a) * r)
    s.creature(f'twig{i}', 'twig-blight', p, 'Y4-summit', 'Twig blight (12): False Appearance among the dead plants', size='small')
s.hidden('axe', 'wall-sword', (GULTHIAS[0] + 0.08, GULTHIAS[1] + 1.1), 'Y4-summit', 'The axe in the trunk: magic, its haft carved with foliage, half the usual weight; +1d8 slashing against plants; grows thorns that prick a non-good wielder for 1 piercing per attack.')
s.objects[-1]['dims'] = {'y': 7.6}; s.objects[-1]['rotY'] = 90; s.objects[-1]['playerLabel'] = 'An axe in the trunk'
s.note('Y4-tree', (GULTHIAS[0] - 10, GULTHIAS[1] + 14), 'Y4-summit', 'Gulthias tree: AC 15, 250 hp, immune bludgeoning, piercing, psychic; at 0 hp it only seems dead (regains 1 hp a month) unless the whole stump is uprooted (Nature DC 15 tells). Hallow kills it in 3d10 days. 1,500 XP. Card reading treasure: buried under the skeleton.')
s.obj('spawn', 'spawn', (TRAIL_FT[-1][0] / 5, TRAIL_FT[-1][1] / 5 + 0.6), 'dm-note', None, 'The trail enters the ring here')

# ---------------------------------------------------------------- every object stands on the land (or on its level's floor)
SINK = {'cairn': -0.6, 'hill-pine': -0.4, 'note': 1.0}             # a cairn and a tree bed into the slope; a note floats over it
ON_LAND = lambda o: o['kind'] not in ('hill-land', 'hill-track', 'hill-patch', 'fog-wall')


def settle(lv, elev, floors, patches):
    for ob in lv.objects:
        if not ON_LAND(ob): continue
        x, z = ob['pos'][0], ob['pos'][2]; p = (x / 5, z / 5)
        g = LAND_HILL(x, z)
        if any(inside(p, poly) for poly in floors): g = max(g, elev)
        elif patches and (inside(p, Y3P) or inside(p, Y4P)): g += PATCH
        ob['pos'][1] = round(g - elev + ob['pos'][1] + SINK.get(ob['kind'], 0.0), 2)


levels = [h] + LANDING_LV + [o, s]
for lv in levels:
    settle(lv, lv.elevation, [r[2] for r in lv.rooms] + ([Y3P, Y4P] if lv is s else []), lv is not s)

DESC = {
  'Y1': ("A path winds up through dense forest toward a bare hill heaped with black stone cairns; storm clouds pile overhead and lightning lances the top.", "The path leaves the forest floor here and climbs round the east slope at 1 in 5, by two landings, crosses both tracks of Y2 on the south-east and runs over the top to the boulder ring's north gap (Summit level)."),
  'Y1-low': ("The path levels off for a few strides on the hillside; the forest falls away below and the cairns of the tracks line the brow above.", "The trail's lower landing: on up to the upper landing, or back down to the forest floor."),
  'Y1-high': ("Another level stretch of the path, high on the south-eastern slope; the black cairns are close above now.", "The trail's upper landing: on up to the outer track, or back down to the lower landing."),
  'Y1-outer': ("The path crosses a dirt track that circles the hillside between heaps of black stone.", "The trail crosses the outer track of Y2 here: on up over the inner track to the summit, or back down the slope."),
  'Y1-top': ("The path comes over the brow of the hill and runs across the turf to a gap in the ring of black boulders.", "The trail's last stretch, from the inner track to Y3's north gap."),
  'Y2-north': ("Two rings of dirt track circle the hillside, each edged with ten-foot heaps of slick black stones.", "Burial cairns of an old berserker tribe, untouched for centuries."),
  'Y2-east': ("Black stone cairns line both tracks along the eastern slope.", "Mouldering berserker bones under every cairn."),
  'Y2-southeast': ("Black stone cairns line both tracks along the south-eastern slope.", "The path from Y1 crosses both tracks here on its way up to the boulder ring."),
  'Y2-south': ("Black stone cairns line both tracks along the southern slope.", "Mouldering berserker bones under every cairn."),
  'Y2-southwest': ("Black stone cairns line both tracks along the south-western slope.", "Kavan's cairn is on the outer track below (Outer track level)."),
  'Y2-northwest': ("Black stone cairns line both tracks on the north-western slope, the fog close beyond.", "From this slope the vision in the fog (Y5) is plain to see."),
  'Y2-outernorth': ("The outer of two dirt tracks round the hillside, edged with ten-foot heaps of slick black stones.", "Burial cairns of an old berserker tribe, untouched for centuries."),
  'Y2-outereast': ("Black stone cairns line the outer track along the eastern slope.", "Mouldering berserker bones under every cairn."),
  'Y2-outersoutheast': ("Black stone cairns line the outer track along the south-eastern slope.", "The path from Y1 crosses the track here on its way up to the boulder ring."),
  'Y2-outersouth': ("Black stone cairns line the outer track along the southern slope.", "Mouldering berserker bones under every cairn."),
  'Y2-outersouthwest': ("Black stone cairns line the outer track along the south-western slope.", "Kavan's cairn is here (Blood Spear of Kavan)."),
  'Y2-outernorthwest': ("Black stone cairns line the outer track on the north-western slope, the fog close beyond.", "From this slope the vision in the fog (Y5) is plain to see."),
  'Y3-summit': ("Withered turf inside a circle of black boulders five to ten feet tall, broken by two paths; the stick-and-soil effigy of a fanged, cloaked man looms over it.", "Twelve hidden turf-covered graves (six druids, six berserkers). The gem is in the statue's chest. Lightning may strike anyone who climbs the ring."),
  'Y4-summit': ("Dead trees and brush round an enormous gnarled tree oozing dark sap; spiny, gangly shapes prowl about it; an axe shines in the trunk above a skeleton.", "Gulthias tree; 6 needle blights in plain view, 3 vine and 12 twig blights hiding."),
  'Y5': ("Westward everything simply ends: a wall of fog rises out of sight.", "Marks the boundary of Strahd's domain; the old mountain folk called it the Whispering Wall."),
}
L5 = lambda id, kind, al, ap, bl, bp: OrderedDict(id=id, kind=kind, **{'from': OrderedDict(level=al, pos=[round(ap[0], 2), round(ap[1], 2)]), 'to': OrderedDict(level=bl, pos=[round(bp[0], 2), round(bp[1], 2)])})
ft = lambda p: (p[0] * 5, p[1] * 5)
# the trail up, stretch by stretch: forest floor -> lower landing -> upper landing -> outer track -> summit
lo, hi = LANDING_LV
links = [L5('Y1-trail', 'stairs', 'hill', TRAIL3[FOOT_I - 2][:2], lo.id, ft(trail_at(lo.ends[0]))),
         L5('Y1-climb', 'stairs', lo.id, ft(trail_at(lo.ends[1])), hi.id, ft(trail_at(hi.ends[0]))),
         L5('Y1-climb2', 'stairs', hi.id, ft(trail_at(hi.ends[1])), o.id, ft(trail_at(_c0 + ENDS))),
         L5('Y1-brow', 'stairs', o.id, ft(trail_at(_c1 - ENDS)), s.id, TRAIL3[TOP_I + 1][:2])]
scene = OrderedDict(schema=1, location='Y', chapter='ch14', name='Yester Hill', mapPage=199, bookScaleFt=5, ambient=AMB, entry='hill',
                    levels=[lv.to_json() for lv in levels], links=links)
for lv in scene['levels']:
    for r in lv['rooms']:
        d = DESC.get(r['key'])
        if d:
            r['desc'] = d[0]
            if d[1]: r['dm'] = d[1]
    for ob in lv['objects']:
        if ob['vis'] in ('hidden-object', 'hidden-creature') and 'playerLabel' not in ob:
            ob['playerLabel'] = {'druid': 'A mud-caked figure', 'berserker': 'A mud-caked warrior', 'needle-blight': 'A needled shape', 'twig-blight': 'Dead twigs',
                                 'vine-blight': 'Dead vines', 'tree-blight': 'Something vast'}.get(ob['kind'], 'Something')
# the grid: on the hill level it covers the whole lattice (so players' sight runs over the whole hill) and lies buried
# under the land, a travel map; above it, it lies on that level's own floors only (clip), each once: the summit's flat
# top and inner track, a landing's stretch of trail, the outer track and the trail off it either side
FLOORS = {'hill': [rect(LX0, LZ0, LX1, LZ1)], 'summit': [TOPP], 'outer': OUTER_GRID}
grid = OrderedDict(schema=1, levels=OrderedDict())
for lv in levels:
    polys = FLOORS.get(lv.id, lv.floor_polys) if lv.id != 'hill' else lv.floor_polys + FLOORS['hill']
    g = OrderedDict(floorPolygons=[[[round(x * 5, 2), round(z * 5, 2)] for x, z in p] for p in polys],
                    type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0 if lv.id == 'hill' else 0.55)
    if lv.id != 'hill': g['clip'] = True
    grid['levels'][lv.id] = g
out = os.path.join(ROOT, 'locations', 'ch14', 'Y'); os.makedirs(out, exist_ok=True)
json.dump(scene, open(os.path.join(out, 'scene.json'), 'w'), indent=1)
json.dump(grid, open(os.path.join(out, 'grid.json'), 'w'), indent=1)
print('yester hill:', [(lv.id, lv.elevation, len(lv.rooms), len(lv.objects)) for lv in levels], 'top', TOP_G, 'outer track', round(H_OUT, 1), 'trail foot', FOOT_I, 'top', TOP_I, 'runs', RUNS)
