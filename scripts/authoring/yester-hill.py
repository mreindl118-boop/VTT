#!/usr/bin/env python3
"""Yester Hill (chapter 14, area Y; map p.199, one printed square = 50 ft), at true size on the 5-ft lattice: the
druids' hill on the western edge of Strahd's domain, read off the book's map in printed squares (S() turns a
square reading into cells). Two levels share the ground:

* hill - the whole map, drawn as a hill: the trail winding up from the north-east through the forest (Y1), the two
  dirt tracks that circle the hillside on the contour, lined with black berserker cairns (Y2, keyed by sector as
  the book scatters its six labels), the druids' ring of black boulders on the broad top (Y3) with the fifty-foot
  effigy of Strahd inside it, the dead copse of the Gulthias tree on the south side of the top (Y4) and the wall of
  fog that closes the west (Y5); the forest on three sides. The land is a heightfield (see "the land" below).
* summit - the battle inset: the hilltop at the same place, its floor level with the top, with the graves, druids,
  berserkers and blights.

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
# the wooded slope below the outer track, easing out onto the forest floor round the hill's foot. Heights are feet above
# that forest floor (the hill level's floor). The top stands 272 ft above it, with slopes of at most about 1 in 2
# (the book gives about 400 ft from the forest: on a plate this size that would mean slopes no one could walk). The
# tracks hold their contour; the trail winds up at no more than 1 in 5. The land drawn round the map (kit/sites/w.ts,
# yesterLand) follows the same slope profile from the outer track's fitted ellipse, so the two agree past the edge.
OUT_TO_TOP = 17.0                 # the hilltop stands this far above the outer track
# the slope below the outer track: (ft out from the track, ft below it, grade there); the same knots are in w.ts
KNOTS = [(0, 0, 0.25), (200, 72, 0.42), (420, 162, 0.36), (650, 232, 0.18), (850, 254, 0.0), (5000, 254, 0.0)]
ELL = (853.37, 1211.69, 0.289, 442.97, 644.42)   # the outer track's fitted ellipse: centre x, z, turn, half-axes (ft)
LAT, MARGIN = 10.0, 120.0         # the lattice: 10-ft cells, running 120 ft past the map's edge
CX, CZ = CEN[0] * 5.0, CEN[1] * 5.0
GX0, GZ0, GNX, GNZ = -MARGIN, -MARGIN, 198, 250  # x -120..1860, z -120..2380 (even: the summit takes every other vertex)
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


def ground0(X, Z):
    """The bare hill (no tracks cut in yet), in ft above the outer track."""
    X, Z = np.asarray(X, float), np.asarray(Z, float)
    dx, dz = X - CX, Z - CZ; r = np.hypot(dx, dz); a = np.arctan2(dz, dx)
    rin, rout = np.interp(a, _ANG, _RIN), np.interp(a, _ANG, _ROUT)
    t = np.clip((r - rin) / (rout - rin), 0, 1)
    band_h = OUT_TO_TOP * (1 - t * t * (3 - 2 * t))
    dn = r - rout; de = ell_out(X, Z); w = np.clip((dn - 100) / 300, 0, 1); w = w * w * (3 - 2 * w)
    d = dn * (1 - w) + de * w            # the track itself near it, its ellipse far out (the land beyond the map uses that)
    return np.where(r <= rin, OUT_TO_TOP, np.where(r <= rout, band_h, -drop(np.maximum(d, 0))))


# the hill level's floor is a foot under the forest floor round the hill's foot (the trail's foot at the north-east
# corner), so the level's own ground and grid never show through the land
REF = -KNOTS[-1][1] - 1.0
TOP = round(OUT_TO_TOP - REF, 2)          # the summit level's floor: 272 ft up (the outer track 255)
TOP_G = TOP - 0.5                         # the turf there: a hair under the summit's floors and grid
H_OUT = TOP - OUT_TO_TOP                  # the outer track


def dome(X, Z):
    """The bare hill in ft above the hill level's floor."""
    h = ground0(X, Z) - REF
    return np.minimum(h, TOP_G)


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
    """Cut a track `w` ft wide into the land along `line`: level across, the bank above cut back at 1:1, the fill below
    falling at 1:1.25."""
    d, rh = _near_on(px, pz, line)
    bw = w / 2 + 1.5
    up = np.minimum(Hh, rh - 0.2 + (d - bw) * 1.0); dn = np.maximum(Hh, rh - 0.2 - (d - bw) * 0.8)
    return np.where(d <= bw, rh - 0.2, np.where(Hh > rh, up, dn))


def profile(pts_ft, grade_max=0.2):
    """A trail's heights: the hill's own height along it, smoothed, then never steeper than grade_max."""
    xs = np.array([p[0] for p in pts_ft]); zs = np.array([p[1] for p in pts_ft])
    hs = dome(xs, zs)
    s = np.concatenate([[0], np.cumsum(np.hypot(np.diff(xs), np.diff(zs)))])
    k = np.exp(-0.5 * ((s[:, None] - s[None, :]) / 25.0) ** 2); hs = (k @ hs) / k.sum(1)
    for i in range(1, len(hs)): hs[i] = min(max(hs[i], hs[i - 1]), hs[i - 1] + grade_max * (s[i] - s[i - 1]))
    return [(float(x), float(z), round(float(h), 2)) for x, z, h in zip(xs, zs, hs)]


# ---------------------------------------------------------------- the props' data (the format of kit/sites/s.ts; the encoders are
# copied from krezk_land.py so this script stands on its own)
HOLE = 4095
def heightfield_dims(x0, z0, nx, nz, cell, fn, hole=None, q=0.5, origin_y=0.0, taper=None):
    """Sample fn(x, z) on an (nx+1) x (nz+1) vertex lattice from (x0, z0); pack four 12-bit heights per number.
    hole(x, z) -> True leaves the vertex out (no cell that touches it is drawn). Heights are relative to origin_y."""
    vals = []
    for j in range(nz + 1):
        for i in range(nx + 1):
            x, z = x0 + i * cell, z0 + j * cell
            if hole and hole(x, z): vals.append(HOLE); continue
            h = fn(x, z) - origin_y
            if taper: h = taper(x, z, h)
            vals.append(max(0, min(HOLE - 1, int(round(h / q)))))
    dims = {'nx': nx, 'nz': nz, 'cell': cell, 'q': q}
    for k in range(0, len(vals), 4):
        chunk = vals[k:k + 4] + [HOLE] * (4 - len(vals[k:k + 4]))
        v = 0
        for j, c in enumerate(chunk): v += c * (4096 ** j)
        dims[f'd{k // 4}'] = v
    return dims


def ribbon_dims(pts, w, origin=(0.0, 0.0, 0.0)):
    """A road ribbon through (x, z, y) points, relative to origin."""
    d = {'n': len(pts), 'w': w}
    for i, (x, z, y) in enumerate(pts):
        d[f'x{i}'] = round(x - origin[0], 2); d[f'z{i}'] = round(z - origin[1], 2); d[f'y{i}'] = round(y - origin[2], 2)
    return d


# ---------------------------------------------------------------- the tracks cut into the hill; the land as drawn
loop_ft = lambda curve: [(x * 5.0, z * 5.0) for x, z in curve + curve[:1]]
TRACK_W = 10.0                                    # the two tracks and the trail: a cart's width
RING_IN = [(x, z, TOP_G) for x, z in loop_ft(INNER)]
RING_OUT = [(x, z, H_OUT) for x, z in loop_ft(OUTER)]
TRAIL3 = profile([(x * 5.0, z * 5.0) for x, z in TRAIL])
SW3 = [(x * 5.0, z * 5.0, TOP_G) for x, z in SW_PATH]
TRACKS = (('track-outer', RING_OUT, TRACK_W), ('track-inner', RING_IN, TRACK_W), ('trail', TRAIL3, TRACK_W), ('path-sw', SW3, 8.0))
Q = 0.25                                          # the heightfield's step (ft)
_X, _Z = _lattice()
LAND = dome(_X, _Z)
for _id, _line, _w in TRACKS: LAND = bench(LAND, _X, _Z, _line, _w)
LAND = np.maximum(LAND, 1.0)                      # the forest floor stays a foot above the level's own ground
LAND_Y0 = -1.0
LAND = LAND_Y0 + np.round((LAND - LAND_Y0) / Q) * Q   # exactly what the prop draws


def ground(x, z):
    """The drawn land's height (ft above the hill level's floor) at (x, z) ft, on the prop's own triangles."""
    fx, fz = (x - GX0) / LAT, (z - GZ0) / LAT
    i = min(max(int(math.floor(fx)), 0), GNX - 1); j = min(max(int(math.floor(fz)), 0), GNZ - 1); u, v = fx - i, fz - j
    a, b, c, e = LAND[j, i], LAND[j, i + 1], LAND[j + 1, i + 1], LAND[j + 1, i]
    if abs(a - c) < abs(b - e): return float(a + (b - a) * u + (c - b) * v if u >= v else a + (c - e) * u + (e - a) * v)
    return float(a + (b - a) * u + (e - a) * v if u + v <= 1 else c + (e - c) * (1 - u) + (b - c) * (1 - v))


def land_dims(step=1, hole=None, sink=None, x0=GX0, z0=GZ0, nx=GNX, nz=GNZ):
    """The land as a heightfield prop on every `step`-th lattice vertex of the block from (x0, z0), nx x nz cells; its
    outer edge drops a short skirt (into the land drawn beyond the map, or into the coarser land round a finer patch).
    `sink(x, z)` lowers a vertex by that much (where a finer patch overlaps)."""
    look = lambda x, z: float(LAND[int(round((z - GZ0) / LAT)), int(round((x - GX0) / LAT))])
    taper = (lambda x, z, h: h - sink(x, z)) if sink else None
    d = heightfield_dims(x0, z0, nx // step, nz // step, LAT * step, look, hole=hole, q=Q, origin_y=LAND_Y0, taper=taper)
    d['drop'] = 7
    return d


def land_props(lv, elev, fine=None):
    """The land and its tracks on a level whose floor is `elev` ft up: the whole lattice, or (with `fine`, a block
    (x0, z0, x1, z1) ft on the lattice) every other vertex with that block at full grain laid into it."""
    y = round(LAND_Y0 - elev, 2)
    if not fine: lv.obj('land', 'heightfield', (GX0 / 5, GZ0 / 5), 'player', None, dims=land_dims(), y=y)
    else:
        fx0, fz0, fx1, fz1 = fine
        hole = lambda x, z: fx0 + 30 < x < fx1 - 30 and fz0 + 30 < z < fz1 - 30
        sink = lambda x, z: 0.6 if fx0 <= x <= fx1 and fz0 <= z <= fz1 else 0.0
        lv.obj('land', 'heightfield', (GX0 / 5, GZ0 / 5), 'player', None, dims=land_dims(2, hole, sink), y=y)
        lv.obj('land-top', 'heightfield', (fx0 / 5, fz0 / 5), 'player', None, dims=land_dims(1, x0=fx0, z0=fz0, nx=int((fx1 - fx0) / LAT), nz=int((fz1 - fz0) / LAT)), y=y)
    for id_, line, w in TRACKS:
        lv.obj(id_, 'road-ribbon', (0, 0), 'player', None, dims=ribbon_dims([(x, z, y - 0.2) for x, z, y in line], w, (0, 0, elev)))


AMB = 'barovian-overcast'
DIRT = 0x66584a                                                    # the kit's dirt floor colour (palette FLOOR_COLOR.dirt)
# ================================================================== the hill (the whole plate)
h = Level('hill', 'Yester Hill', 0, 12, ambient=AMB, interior='cave-rock', exterior='cave-rock', north='-z')
# The ground is the heightfield; the level's own floor lies a foot under it, over the whole lattice (the plate and the
# margin past its edge), so it never shows and everything on the land stands on the level's ground.
LX0, LZ0, LX1, LZ1 = (GX0 - 1) / 5, (GZ0 - 1) / 5, (GX0 + GNX * LAT + 1) / 5, (GZ0 + GNZ * LAT + 1) / 5
h.terrain.append((rect(LX0, LZ0, LX1, LZ1), 'grass'))
land_props(h, 0.0)

# Y2: the band of the two cairn rings, in six sectors (the plate scatters six Y2 labels round it)
SECT = [('north', -120), ('east', -60), ('southeast', 0), ('south', 60), ('southwest', 120), ('northwest', 180)]
for name, a0 in SECT:
    angs = [math.radians(a0 + k * 3) for k in range(21)]
    poly = [at(R_OUT, a, 12) for a in angs] + [at(R_IN, a, -4) for a in reversed(angs)]
    h.room(f'Y2-{name}', 'Berserker Cairns', poly, 'grass', page=pg('Y2'))
    open_all(h, poly)
# Y1: the trail from where it leaves the forest floor up to the outer ring
y1 = band([p for p, (_, _, th) in zip(TRAIL, TRAIL3) if th > 5 and math.hypot(p[0] - CEN[0], p[1] - CEN[1]) > R_OUT(math.atan2(p[1] - CEN[1], p[0] - CEN[0])) + 4], 4.4)
h.room('Y1', 'Trail', y1, 'dirt', page=pg('Y1')); open_all(h, y1)
# Y3: the druids' ring; the boulders make a low wall you can climb over (it blocks sight like rough ground)
Y3P = circle(Y3C, Y3R, 48)
GAPS = [-70, 122]                                                  # where the trails pass through
def ring_walls(lv, poly):
    for i, (a, b) in enumerate(zip(poly, poly[1:] + poly[:1])):
        mid = math.degrees(math.atan2((a[1] + b[1]) / 2 - Y3C[1], (a[0] + b[0]) / 2 - Y3C[0]))
        if any(abs(((mid - g + 180) % 360) - 180) < 8 for g in GAPS): ov(lv, a, b, open_wall=True)
        else: ov(lv, a, b, flags=['terrain', 'ethereal'], heightFt=7)
Y4P = [(round(GULTHIAS[0] + math.cos(math.radians(a)) * (19 + 4 * math.sin(math.radians(a * 3 + 20))), 2), round(GULTHIAS[1] + math.sin(math.radians(a)) * (21 + 3 * math.cos(math.radians(a * 2))), 2)) for a in range(0, 360, 20)]
h.room('Y3', "Druids' Circle", Y3P, 'dirt', page=pg('Y3')); ring_walls(h, Y3P)
h.room('Y4', 'Gulthias Tree', Y4P, 'dirt', page=pg('Y4')); open_all(h, Y4P)
Y5P = FOG
h.room('Y5', 'Wall of Fog', Y5P, 'grass', page=pg('Y5')); open_all(h, Y5P)
# on the hill level the rooms' own floors lie under the land: the withered turf of the ring and the copse's bare earth
# are drawn on the hilltop instead
for key, poly in (('Y3', Y3P), ('Y4', Y4P)):
    h.obj(f'{key}-earth', 'prism', (0, 0), 'player', key, dims={'h': 0.45, 'y': round(TOP_G - 0.3, 2), 'color': DIRT})
    h.objects[-1]['polygon'] = [[round(x * 5, 2), round(z * 5, 2)] for x, z in poly]
PATCH = 0.15                                                       # the earth patches stand this far above the turf


def summit_dressing(lv, full):
    """The ring of black boulders, the effigy and the dead copse: the same on both levels."""
    for i, (x, z) in enumerate(along(Y3P, 1.5, closed=True)):
        a = math.degrees(math.atan2(z - Y3C[1], x - Y3C[0]))
        if any(abs(((a - g + 180) % 360) - 180) < 5.5 for g in GAPS): continue
        j = (H(i, 1) - 0.5) * 1.2
        lv.prop(f'boulder{i}', 'black-boulder', (x + math.cos(math.radians(a)) * j, z + math.sin(math.radians(a)) * j), None, rotY=int(H(i, 2) * 360), dims={'r': round(2.2 + H(i, 3) * 2.6, 2)})
    for i in range(10):                                            # loose rocks spilled from the ring
        a = math.radians(i * 37 + 11); r = Y3R + (2.5 + H(i, 4) * 3) * (1 if i % 2 else -1)
        lv.prop(f'rock{i}', 'black-boulder', (Y3C[0] + math.cos(a) * r, Y3C[1] + math.sin(a) * r), None, dims={'r': round(1.2 + H(i, 5), 2)})
    lv.prop('effigy', 'strahd-effigy', STATUE, 'Y3' if not full else 'Y3-summit', rotY=25)
    lv.objects[-1]['desc'] = 'A fifty-foot effigy of woven sticks stuffed with black soil: a giant fanged figure in a cloak, roots coiled round its feet.'
    lv.prop('gulthias', 'gulthias-tree', GULTHIAS, 'Y4' if not full else 'Y4-summit')
    lv.objects[-1]['desc'] = 'An enormous gnarled tree oozing dark red sap, an axe bright in its trunk and a skeleton among its roots.'
    for i, a in enumerate(range(0, 360, 26)):
        r = 7 + H(i, 6) * 11; p = (GULTHIAS[0] + math.cos(math.radians(a)) * r, GULTHIAS[1] + math.sin(math.radians(a)) * r)
        if inside(p, Y4P): lv.prop(f'deadtree{i}', 'dead-tree', p, None, rotY=a * 7 % 360, dims={'scale': round(0.7 + H(i, 7) * 0.5, 2)})
    for i, a in enumerate(range(10, 360, 23)):
        r = 9 + H(i, 8) * 9; p = (GULTHIAS[0] + math.cos(math.radians(a)) * r, GULTHIAS[1] + math.sin(math.radians(a)) * r)
        if inside(p, Y4P): lv.prop(f'shrub{i}', 'dead-shrub', p, None, dims={'scale': round(0.9 + H(i, 9) * 0.6, 2), 'seed': i})


def cairns(lv, keyed):
    """The cairns: a ring just below each track, about one every fifty feet, each ring on its own contour (the outer
    ring 32 ft out from its track; the inner one a fifth of the way across the band)."""
    n = 0
    for which, cnt in ((0, 64), (1, 48)):
        for i in range(cnt):
            a = 2 * math.pi * i / cnt + H(i, which) * 0.04
            if which == 0: p = at(R_OUT, a, 6.4 + (H(i, 3) - 0.5) * 0.6)
            else: p = at(R_IN, a, 0.22 * (R_OUT(a) - R_IN(a)) + (H(i, 4) - 0.5) * 0.6)
            if dist_to(p, TRAIL) < 4: continue
            key = f'Y2-{SECT[int(((math.degrees(a) + 120) % 360) // 60)][0]}' if keyed else None
            lv.prop(f'cairn{n}', 'cairn', p, key, rotY=int(H(i, 5) * 360), dims={'seed': n, 'r': round(5.5 + H(i, 6) * 1.5, 2)})
            n += 1
    return n


def forest(lv, thin=1):
    """The forest on three sides of the hill, the trail cut through it: a tree every 40 ft within 120 ft of the trail and
    the forest's edge, every 50 ft deeper in (where the canopy hides the floor), and pines every 60 ft on the forest
    floor in the lattice's margin past the map's edge, where the land drawn beyond the map takes over. `thin` keeps one
    in so many."""
    trees = 0
    near = lambda x, z: dist_to((x, z), TRAIL) < 24 or dist_to((x, z), CLEAR + CLEAR[:1]) < 24
    plate = lambda x, z: 0 <= x <= W_CELLS and 0 <= z <= H_CELLS
    for step, zone in ((8, 'near'), (10, 'far'), (12, 'margin')):
        for gz in range(int(LZ0) - 1, int(LZ1) + 1, step):
            for gx in range(int(LX0) - 1, int(LX1) + 1, step):
                i = gz * 1000 + gx + step * 7
                x, z = gx + (H(i, 1) - 0.5) * step * 0.75, gz + (H(i, 2) - 0.5) * step * 0.75
                if not (LX0 + 2 <= x <= LX1 - 2 and LZ0 + 2 <= z <= LZ1 - 2): continue
                if zone == 'margin':
                    if plate(x, z) or x < 0: continue                     # the fog lies past the west edge
                else:
                    if not plate(x, z) or (zone == 'near') != near(x, z): continue
                    if inside((x, z), CLEAR) or inside((x, z), FOG) or dist_to((x, z), TRAIL) < 4: continue
                    edge = min(dist_to((x, z), CLEAR + CLEAR[:1]), 40)
                    if edge < 3 and H(i, 3) < 0.5: continue            # a ragged edge
                trees += 1
                if trees % thin: continue
                if zone != 'margin' and H(i, 4) < 0.22: lv.prop(f'tree{trees}', 'oak', (x, z), None, dims={'r': round(1.1 + H(i, 5) * 0.6, 2), 'h': round(20 + H(i, 6) * 10, 1), 'canopy': round(13 + H(i, 7) * 6, 1)})
                else: lv.prop(f'tree{trees}', 'pine', (x, z), None, dims={'scale': round(1.0 + H(i, 8) * 0.5, 2)})
    return trees


def fog_wall(lv, keyed):
    """Y5: the wall of fog along the whole western edge: pieces laid end to end on the lattice (their crests follow world
    z, so they join without a seam), each standing on the land at its front and reaching down to the forest floor beyond;
    the two end pieces run on 400 ft past the map's north and south edges, sinking away into the haze."""
    zs = list(range(-6, H_CELLS + 34, 34))[:15]                     # piece centres (cells), all on the lattice
    for i, z in enumerate(zs):
        x = 8
        end = {'end': -1, 'ext': 400} if i == 0 else {'end': 1, 'ext': 400} if i == len(zs) - 1 else {}
        lv.prop(f'fog{i}', 'fog-wall', (x, z), 'Y5' if keyed and 0 <= z <= H_CELLS else None,
                dims={'len': 170, 'h': 620, 'd': 900, 'base': round(ground(x * 5, z * 5) + 8, 1), 'z0': z * 5, 'seed': 3, **end})


summit_dressing(h, False)
n_cairns = cairns(h, True)
KAVAN = at(R_OUT, math.radians(150), 6.5)
h.hidden('kavan', 'skeleton', KAVAN, 'Y2-southwest', 'Kavan\'s cairn: under the heavy rocks lie his moldy bones and the blood spear (appendix C); the chosen character gets +2 to hit and damage with it (Blood Spear of Kavan event).')
h.objects[-1]['playerLabel'] = 'Old bones under the rocks'
trees = forest(h)
fog_wall(h, True)
# notes for the table
h.note('Y1-note', S(33.0, 13.0), 'Y1', 'Up through dense forest to a bare hill of black cairns under massing storm clouds, lightning on the top; westward the world ends in fog. The book has the hill rise about 400 ft from the forest; the map draws its top 272 ft above the forest floor, the trail climbing at 1 in 5 or less.')
h.note('Y2-note', S(16.0, 17.3), 'Y2-north', 'Two dirt tracks circle the slope, each edged with ten-foot cairns of slick black stone: graves of an old berserker tribe, untouched for centuries.')
h.note('Y3-note', S(19.35, 25.6), 'Y3', 'The battle is on the Summit level (the inset): graves, druids, berserkers; lightning strikes the ring.')
h.note('Y4-note', S(15.5, 35.3), 'Y4', 'The copse of the Gulthias tree; its blights are placed on the Summit level.')
h.note('Y5-note', S(3.2, 27.0), 'Y5', 'Looking west from the summit or the west slope: a pale castle above a far-off city seems to float in the fog, and a bell tolls faintly. It is an illusion. Entering the fog: Mists of Ravenloft (ch.2).')
h.note('heights', S(24.6, 44.2), None, f'Heights: the hilltop and the inner track {TOP:.0f} ft above the forest floor, the outer track {H_OUT:.0f} ft; the slopes below it are as steep as 1 in 2. Tokens on this level stand on the forest floor: take the party to the Summit level at the top.')
h.note('wintersplinter', S(21.5, 27.0), 'Y3', "Druids' Ritual: when Strahd comes (on Beucephalus or as a bat) the druids rise and chant for 10 rounds; Wintersplinter, a tree blight, bursts from the statue and marches north on the Wizard of Wines. Needs room for a Huge creature.")
h.obj('spawn', 'spawn', (TRAIL_FT[1][0] / 5, TRAIL_FT[1][1] / 5), 'dm-note', None, 'The party comes up the trail from the north-east')

# ================================================================== the summit (battle inset): its floor is the hilltop
s = Level('summit', 'Summit (battle inset)', TOP, 12, ambient=AMB, interior='cave-rock', exterior='cave-rock', north='-z')
# the battle ground: the ring and the copse with a little room round them, all of it on the flat top (its corners stay
# inside the inner track), so the grid lies on the turf
_b = [p for poly in (Y3P, Y4P) for p in poly]
SB = (min(x for x, _ in _b) - 0.3, min(z for _, z in _b) - 0.3, max(x for x, _ in _b) + 0.3, max(z for _, z in _b) + 0.3)
# the summit's open ground is the ring's trodden earth (its land is the heightfield, drawn round it to the forest)
s.terrain.append((Y3P, 'dirt'))
land_props(s, TOP, fine=(GX0 + 520, GZ0 + 820, GX0 + 1640, GZ0 + 1960))   # x 400..1520, z 700..1840: the top, both tracks
s.room('Y3-summit', "Druids' Circle", Y3P, 'dirt', page=pg('Y3')); ring_walls(s, Y3P)
s.room('Y4-summit', 'Gulthias Tree', Y4P, 'dirt', page=pg('Y4')); open_all(s, Y4P)
summit_dressing(s, True)
cairns(s, False)
forest(s, 2)
fog_wall(s, False)
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
s.note('Y3-statue', (STATUE[0], STATUE[1] + 6), 'Y3-summit', 'Statue: AC 10, 50 hp, immune poison and psychic; oil + fire = 2d6 fire a round. Gulthias roots hold it up. Destroyed: the gem tumbles out glowing green.')
s.note('Y3-lightning', (Y3C[0] + 22, Y3C[1] - 10), 'Y3-summit', 'Climbing over the boulders: 10% chance of a lightning strike, 44 (8d10) lightning. The two trail gaps are safe.')
s.note('Y3-graves', (Y3C[0] - 6, Y3C[1] + 20), 'Y3-summit', 'Six druids and six berserkers sleep under sod covers; they rise if anyone approaches or harms the statue, or once found and attacked. Replenished at dusk (1d4-1 of each a day, up to six).')
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

# ---------------------------------------------------------------- every object stands on the land (or on the summit's floor)
SINK = {'cairn': -0.6, 'oak': -0.4, 'pine': -0.4, 'note': 1.0}   # a cairn and a tree bed into the slope; a note floats over it
ON_LAND = lambda o: o['kind'] not in ('heightfield', 'road-ribbon', 'prism')


def settle(lv, elev, floors):
    for o in lv.objects:
        if not ON_LAND(o): continue
        x, z = o['pos'][0], o['pos'][2]; p = (x / 5, z / 5)
        g = ground(x, z)
        if any(inside(p, poly) for poly in floors): g = max(g, elev)
        elif not elev and (inside(p, Y3P) or inside(p, Y4P)): g += PATCH
        o['pos'][1] = round(g - elev + o['pos'][1] + SINK.get(o['kind'], 0.0), 2)


settle(h, 0.0, [])
settle(s, TOP, [rect(*SB), Y3P, Y4P])

DESC = {
  'Y1': ("A path winds up through dense forest toward a bare hill heaped with black stone cairns; storm clouds pile overhead and lightning lances the top.", "The path climbs round the east slope, crosses both tracks of Y2 on the south-east and runs over the top to the boulder ring's north gap."),
  'Y2-north': ("Two rings of dirt track circle the hillside, each edged with ten-foot heaps of slick black stones.", "Burial cairns of an old berserker tribe, untouched for centuries."),
  'Y2-east': ("Black stone cairns line both tracks along the eastern slope.", "Mouldering berserker bones under every cairn."),
  'Y2-southeast': ("Black stone cairns line both tracks along the south-eastern slope.", "The path from Y1 crosses both tracks here on its way up to the boulder ring."),
  'Y2-south': ("Black stone cairns line both tracks along the southern slope.", "Mouldering berserker bones under every cairn."),
  'Y2-southwest': ("Black stone cairns line both tracks along the south-western slope.", "Kavan's cairn is here (Blood Spear of Kavan)."),
  'Y2-northwest': ("Black stone cairns line both tracks on the north-western slope, the fog close beyond.", "From this slope the vision in the fog (Y5) is plain to see."),
  'Y3': ("A broad circle of black boulders round a patch of withered turf, and inside it a fanged, cloaked giant of woven sticks and black soil fifty feet tall.", "The ring is 250 ft across and 5-10 ft high. Details and creatures are on the Summit level."),
  'Y4': ("A sickly thicket of dead trees and brush on the summit's southern side, a monstrous twisted tree in its midst.", "The Gulthias tree and its blights (Summit level)."),
  'Y5': ("Westward everything simply ends: a wall of fog rises out of sight.", "Marks the boundary of Strahd's domain; the old mountain folk called it the Whispering Wall."),
  'Y3-summit': ("Withered turf inside a circle of black boulders five to ten feet tall, broken by two paths; the stick-and-soil effigy of a fanged, cloaked man looms over it.", "Twelve hidden turf-covered graves (six druids, six berserkers). The gem is in the statue's chest. Lightning may strike anyone who climbs the ring."),
  'Y4-summit': ("Dead trees and brush round an enormous gnarled tree oozing dark sap; spiny, gangly shapes prowl about it; an axe shines in the trunk above a skeleton.", "Gulthias tree; 6 needle blights in plain view, 3 vine and 12 twig blights hiding."),
}
levels = [h, s]
scene = OrderedDict(schema=1, location='Y', chapter='ch14', name='Yester Hill', mapPage=199, bookScaleFt=5, ambient=AMB, entry='hill',
                    levels=[lv.to_json() for lv in levels], links=[])
for lv in scene['levels']:
    for r in lv['rooms']:
        d = DESC.get(r['key'])
        if d:
            r['desc'] = d[0]
            if d[1]: r['dm'] = d[1]
    for o in lv['objects']:
        if o['vis'] in ('hidden-object', 'hidden-creature') and 'playerLabel' not in o:
            o['playerLabel'] = {'druid': 'A mud-caked figure', 'berserker': 'A mud-caked warrior', 'needle-blight': 'A needled shape', 'twig-blight': 'Dead twigs',
                                'vine-blight': 'Dead vines', 'tree-blight': 'Something vast'}.get(o['kind'], 'Something')
# the grid: the hill level's would lie under the land (it is a travel map: none drawn); the summit's lies on the top
FLOORS = {'hill': (rect(0, 0, W_CELLS, H_CELLS), 0), 'summit': (rect(*SB), 0.55)}
grid = OrderedDict(schema=1, levels=OrderedDict((lv.id, OrderedDict(
    floorPolygons=[[[x * 5, z * 5] for x, z in p] for p in lv.floor_polys] + [[[round(x * 5, 2), round(z * 5, 2)] for x, z in FLOORS[lv.id][0]]],
    type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=FLOORS[lv.id][1])) for lv in levels))
out = os.path.join(ROOT, 'locations', 'ch14', 'Y'); os.makedirs(out, exist_ok=True)
json.dump(scene, open(os.path.join(out, 'scene.json'), 'w'), indent=1)
json.dump(grid, open(os.path.join(out, 'grid.json'), 'w'), indent=1)
print('yester hill:', [(lv.id, len(lv.rooms), len(lv.objects)) for lv in levels], 'trees', trees, 'cairns', n_cairns, 'top', TOP, 'outer track', round(H_OUT, 1))
