"""Plane geometry shared by the map generators: one home for the helpers that used to be copied script to script.

Every function here is the copy that several generators carried verbatim (same name, signature and arithmetic), moved
so a change is made once. Points are (x, z) pairs in whatever unit the caller works in (feet or cells); polygons are
lists of points in order; nothing here reads or writes a scene. authorlib.py and wildlib.py keep their own copies of
`inside`, `rect`, `seg_dist` and friends for now (they are claimed by other work); this module imports `seg_key` from
authorlib and nothing from wildlib at module level, so importing it loads no manifest."""
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from authorlib import seg_key


def inside(p, poly):
    """Even-odd point-in-polygon test (ray cast along +x)."""
    x, z = p; c = False; n = len(poly)
    for i in range(n):
        (x0, z0), (x1, z1) = poly[i], poly[(i + 1) % n]
        if (z0 > z) != (z1 > z) and x < (x1 - x0) * (z - z0) / (z1 - z0) + x0: c = not c
    return c


def seg_hits(a, b, poly):
    """Does segment a-b cross the convex polygon (or lie inside it)?"""
    if inside(a, poly) or inside(b, poly): return True
    def cross(o, p, q): return (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0])
    for i in range(len(poly)):
        c, d = poly[i], poly[(i + 1) % len(poly)]
        if (cross(a, b, c) > 0) != (cross(a, b, d) > 0) and (cross(c, d, a) > 0) != (cross(c, d, b) > 0): return True
    return False


def ov(lv, a, b, **kw):
    """Override one exact wall segment of a Level (a whole diagonal or a fractional edge, which _stamp would split;
    a sub-edge made by inserted vertices)."""
    k = seg_key(a, b)
    lv.overrides[k] = dict(lv.overrides.get(k, {}), **kw)


exact = ov  # the same helper under the name the cave and pass generators use


def strip(pts, w):
    """Axis-free road strip: one quad per segment of the polyline plus an octagon at each inner vertex, `w` wide,
    coordinates rounded to 0.1."""
    out, h = [], w / 2
    for i in range(len(pts) - 1):
        (x0, z0), (x1, z1) = pts[i], pts[i + 1]
        dx, dz = x1 - x0, z1 - z0; L = math.hypot(dx, dz) or 1; nx, nz = -dz / L * h, dx / L * h
        out.append([[round(x0 + nx, 1), round(z0 + nz, 1)], [round(x1 + nx, 1), round(z1 + nz, 1)], [round(x1 - nx, 1), round(z1 - nz, 1)], [round(x0 - nx, 1), round(z0 - nz, 1)]])
    for (x, z) in pts[1:-1]:
        out.append([[round(x + math.cos(a) * h, 1), round(z + math.sin(a) * h, 1)] for a in [k * math.pi / 4 for k in range(8)]])
    return out


def band(points, w):
    """A strip `w` cells wide along a polyline, as one polygon (for paths and trails); coordinates rounded to 0.01."""
    left, right = [], []
    for i, (x, z) in enumerate(points):
        if i == 0: dx, dz = points[1][0] - x, points[1][1] - z
        elif i == len(points) - 1: dx, dz = x - points[i - 1][0], z - points[i - 1][1]
        else: dx, dz = points[i + 1][0] - points[i - 1][0], points[i + 1][1] - points[i - 1][1]
        L = math.hypot(dx, dz) or 1
        nx, nz = -dz / L * w / 2, dx / L * w / 2
        left.append((round(x + nx, 2), round(z + nz, 2))); right.append((round(x - nx, 2), round(z - nz, 2)))
    return left + right[::-1]


def H(i, k=0):
    """A deterministic 0..1 jitter."""
    s = math.sin(i * 127.1 + k * 311.7) * 43758.5453
    return s - math.floor(s)


def lerp(a, b, t): return (round(a[0] + (b[0] - a[0]) * t, 4), round(a[1] + (b[1] - a[1]) * t, 4))


def unit(dx, dz):
    """Unit vector of (dx, dz); (0, 0) stays (0, 0)."""
    L = math.hypot(dx, dz) or 1; return (dx / L, dz / L)


def bearing_dir(b):
    """Unit plan vector of a compass bearing (degrees clockwise from north = -z)."""
    r = math.radians(b); return (math.sin(r), -math.cos(r))


def line_dims(pts, origin, prefix=''):
    """Polyline as prop dims: n and x0, z0, ... relative to origin, rounded like wildlib's rnd."""
    from wildlib import rnd  # the wilderness sites' rounding; imported here so other generators load no manifest
    d = {prefix + 'n': len(pts)}
    for i, (x, z) in enumerate(pts):
        d[f'{prefix}x{i}'] = rnd(x - origin[0], 2); d[f'{prefix}z{i}'] = rnd(z - origin[1], 2)
    return d


def ribbon_dims(pts, w, origin=(0.0, 0.0, 0.0)):
    """A road ribbon through (x, z, y) points as prop dims, relative to origin."""
    d = {'n': len(pts), 'w': w}
    for i, (x, z, y) in enumerate(pts):
        d[f'x{i}'] = round(x - origin[0], 2); d[f'z{i}'] = round(z - origin[1], 2); d[f'y{i}'] = round(y - origin[2], 2)
    return d
