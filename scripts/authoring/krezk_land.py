"""Shared ground for Krezk (chapter 8, area S) and the Abbey of Saint Markovia (S10): one topography for both maps.

Frames (all in feet, +x east, +z south):
  * Krezk frame: the 300-dpi render of the Krezk map (p.144, one square = 50 ft, 67.1 px per square); origin at
    render px (600, 800).
  * Abbey frame: the abbey ground-floor map (p.149, one square = 10 ft) turned north-up; origin on its 10-ft grid.
    5-ft cells are what the abbey script authors in. Krezk = abbey + OFF (read off both maps: the north gate, the main
    hall and the east wing agree to a few feet).
The village floor is 0; the abbey's ledge is 400 ft above it (the text). The ledge is cut into a mountainside that rises
to the north-east; to the west and south it falls in cliffs to the village, and the switchback road (S5) climbs the
west cliff in three legs. Only positions, sizes and heights live here (no book art)."""
import math

PX_PER_FT = 67.1 / 50.0
def K(px, py):
    """Krezk render px -> Krezk ft."""
    return ((px - 600) / PX_PER_FT, (py - 800) / PX_PER_FT)

OFF = (398.5, 256.5)                      # abbey ft -> Krezk ft
def a2k(x, z): return (x + OFF[0], z + OFF[1])
def k2a(x, z): return (x - OFF[0], z - OFF[1])
def cells_k(pts): return [a2k(x * 5, z * 5) for x, z in pts]

LEDGE = 400.0

# ------------------------------------------------------------------ the ledge (abbey cells): its rim, and where the
# mountain rises behind it (north of the gate road, east of the outer wall, north of the gardens)
RIM_CELLS = [(9.5, 29), (9.5, 8), (10.5, 4), (12.5, 1), (15, -2.5), (34, -2.5), (34.6, 0), (34.6, 21.5), (36, 24), (38, 25.6), (53.5, 25.6),
             (57, 23), (74, 23), (77, 25.5), (77.5, 35.5), (75.5, 38.5), (70, 40), (64, 41.8), (58, 43.4), (56, 43.6), (36, 43.6), (26, 43.6),
             (25.6, 38.4), (20, 32.6), (16, 32.6), (13, 31.6), (11, 30.5)]
UP_CELLS = [(30, -2.5), (34, -2.5), (34.6, 0), (34.6, 21.5), (36, 24), (38, 25.6), (53.5, 25.6), (57, 23), (74, 23), (77, 25.5)]
RIM = cells_k(RIM_CELLS)
UP = cells_k(UP_CELLS)
RAY_W = (UP[0], (UP[0][0] + 1100, UP[0][1] - 1800))  # the mountain's west flank runs north-east from the gate road
RAY_E = (UP[-1], (UP[-1][0] + 2000, UP[-1][1] + 300)) # and its south flank east-south-east from the gardens
MZ = [RAY_W[1]] + UP + [RAY_E[1], (RAY_E[1][0], RAY_W[1][1])]

# ------------------------------------------------------------------ the village (Krezk ft)
WALL = [(277.5, 113.75), (377.5, 113.75), (413.75, 155), (565, 536), (568.75, 547.5), (568.75, 707.5), (521.25, 755), (272.5, 755), (80, 562.5), (82.5, 312.5)]
# the walls stop where the cliff takes over: between the north-east tower and the east tower there is no wall
WALL_RUNS = [[(565, 536), (568.75, 547.5), (568.75, 707.5), (521.25, 755), (272.5, 755), (80, 562.5), (82.5, 312.5), (277.5, 113.75), (377.5, 113.75), (413.75, 155)]]
TOWER_NE, TOWER_E = (415.0, 157.5), (565.0, 536.0)
GATE = (418.0, 755.0)                     # the gatehouse in the south wall (S2)
# the village floor: the walls' ring, its north-east side following the foot of the abbey's cliff
VF = [(277.5, 113.75), (377.5, 113.75), (413.75, 155), (390, 188), (368, 230), (366, 330), (373, 405), (410, 440), (450, 452), (500, 480),
      (545, 515), (568.75, 547.5), (568.75, 707.5), (521.25, 755), (272.5, 755), (80, 562.5), (82.5, 312.5)]

# ------------------------------------------------------------------ the switchback road (S5), Krezk ft, foot to ledge
ROAD_PTS = [(452, 447), (430, 437), (405, 420), (388, 390), (378, 345), (376, 300), (380, 255), (390, 226), (401, 212), (414, 207), (424, 212), (428, 226),
            (425, 260), (421, 300), (420, 340), (422, 372), (428, 392), (436, 400), (441, 392), (440, 360), (438, 320), (438, 292), (442, 270), (453, 254),
            (468.5, 249)]
ROAD_ON_LEDGE = [(468.5, 249), (490, 248), (515, 249), (527, 254), (533.5, 266)]   # on the rock top, to the north gate
ROAD_W = 10.0
# the Krezk map's S5 box: the foot of the switchbacks, where the road leaves the village floor. The abbey's land level is
# centred on it, so Krezk drawn round the abbey (the parent map's surroundings) lands where it stands.
S5_POLY = [(425.0, 425.0), (490.0, 425.0), (490.0, 528.0), (425.0, 528.0)]
S5_CENTRE = (sum(p[0] for p in S5_POLY) / 4, sum(p[1] for p in S5_POLY) / 4)

def _chaikin(pts, passes=2):
    for _ in range(passes):
        out = [pts[0]]
        for a, b in zip(pts[:-1], pts[1:]):
            out += [(a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25), (a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75)]
        out.append(pts[-1]); pts = out
    return pts

def road_profile():
    """The road as (x, z, h) at a steady grade from the village floor to the ledge."""
    pts = _chaikin(ROAD_PTS, 2)
    L = [0.0]
    for a, b in zip(pts[:-1], pts[1:]): L.append(L[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
    tot = L[-1]
    prof = [(x, z, LEDGE * l / tot) for (x, z), l in zip(pts, L)]
    return prof + [(x, z, LEDGE) for x, z in ROAD_ON_LEDGE[1:]]
ROAD = road_profile()

# ------------------------------------------------------------------ geometry helpers
def inside(p, poly):
    x, z = p; c = False; n = len(poly)
    for i in range(n):
        (x0, z0), (x1, z1) = poly[i], poly[(i + 1) % n]
        if (z0 > z) != (z1 > z) and x < (x1 - x0) * (z - z0) / (z1 - z0) + x0: c = not c
    return c

def seg_dist(p, a, b):
    dx, dz = b[0] - a[0], b[1] - a[1]; L2 = dx * dx + dz * dz or 1e-9
    t = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2))
    return math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t), t

def poly_dist(p, poly, closed=True):
    n = len(poly); best = 1e18
    for i in range(n if closed else n - 1):
        d, _ = seg_dist(p, poly[i], poly[(i + 1) % n]); best = min(best, d)
    return best

def smooth(a, b, t):
    k = max(0.0, min(1.0, (t - a) / (b - a))); return k * k * (3 - 2 * k)

def _cliff_k(p):
    """How steep the ledge's cliff is: sheer to the west and south (the west face is built from the switchback's benches
    instead), a wooded slope falling north toward the pool."""
    return 6.0 - 2.9 * smooth(250, 200, p[1]) * smooth(430, 480, p[0])

# the switchback zone: the west face between the village floor and the rim, built as benches (the road's three legs)
# with steep rock between them, so every leg stands on its own shelf instead of in a trench
SZ = [(358, 188), (440, 188), (456, 236), (452, 300), (449, 380), (443, 418), (420, 450), (388, 444), (362, 404), (358, 330)]
LEG_APEX = [(414, 207), (437, 399)]
def _legs():
    pts = [p for p in ROAD if p[2] < LEDGE - 0.5]
    idx = [min(range(len(pts)), key=lambda i: math.hypot(pts[i][0] - ax, pts[i][1] - az)) for ax, az in LEG_APEX]
    return [pts[:idx[0] + 1], pts[idx[0]:idx[1] + 1], pts[idx[1]:]]
LEGS = _legs()
def _near_on(poly3, p):
    best = None
    for (x0, z0, h0), (x1, z1, h1) in zip(poly3[:-1], poly3[1:]):
        d, t = seg_dist(p, (x0, z0), (x1, z1))
        if best is None or d < best[0]: best = (d, x0 + (x1 - x0) * t, h0 + (h1 - h0) * t)
    return best
def _benches(p):
    west = [(poly_dist(p, VF), 0.0, 0.0)]          # (distance, height, bench half-width)
    east = [(poly_dist(p, RIM), LEDGE, 0.0)]
    for leg in LEGS:
        d, qx, rh = _near_on(leg, p)
        (west if qx <= p[0] else east).append((d, rh, ROAD_W / 2 + 0.5))
    dw, hw, bw = min(west); de, he, be = min(east)
    a, b = max(0.0, dw - bw), max(0.0, de - be)
    t = a / (a + b) if a + b > 1e-9 else 0.0
    return hw + (he - hw) * t

def _hash(i, j):
    x = math.sin(i * 127.1 + j * 311.7) * 43758.5453
    return x - math.floor(x)
def noise(x, z):
    """Smooth value noise in 0..1 (one cell = 1 unit)."""
    i, j = math.floor(x), math.floor(z); fx, fz = x - i, z - j
    ux, uz = fx * fx * (3 - 2 * fx), fz * fz * (3 - 2 * fz)
    a, b, c, d = _hash(i, j), _hash(i + 1, j), _hash(i, j + 1), _hash(i + 1, j + 1)
    return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz
def rugged(p):
    """-1..1: buttresses and gullies on the rock faces."""
    x, z = p
    return (noise(x / 22.0, z / 22.0) * 0.6 + noise(x / 9.0 + 7.3, z / 9.0 - 3.1) * 0.4 - 0.5) * 2

def _flank(p):
    """0..1: how fully the mountain stands here. It fades out across its two flank lines (west: north-east from the gate
    road; south: east-south-east from the gardens), the fade widening with the distance from the ledge."""
    out = 1.0
    for (a, b), side, k in ((RAY_W, 1, 0.45), (RAY_E, -1, 1.1)):
        dx, dz = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dz); ux, uz = dx / L, dz / L
        along = (p[0] - a[0]) * ux + (p[1] - a[1]) * uz
        perp = side * ((p[0] - a[0]) * (-uz) + (p[1] - a[1]) * ux)      # into the mountain
        out *= smooth(0, 40 + k * max(0.0, along), perp + 2.0 * max(0.0, -along))   # behind the ledge it is all mountain
    return out

def ground(p):
    """Height (ft above the village floor) of the land at Krezk point p, before the road is cut in."""
    if inside(p, VF): return 0.0
    if inside(p, RIM): return LEDGE
    d = poly_dist(p, RIM)
    cliff = LEDGE - _cliff_k(p) * d
    if inside(p, SZ):
        w = smooth(0, 14, poly_dist(p, SZ))
        cliff = cliff * (1 - w) + _benches(p) * w
    h = cliff
    f = 0.0
    du = poly_dist(p, UP, closed=False)
    if inside(p, MZ):       # behind the ledge's north-east edges the mountain rises; it fades out at its flanks
        f = _flank(p)
        if f > 0:
            up = LEDGE + MOUNT_RISE * (1 - math.exp(-du / 230.0)) + 30.0 * (noise(p[0] / 150.0, p[1] / 150.0) - 0.5) * 2 * smooth(0, 60, du)
            h = cliff * (1 - f) + up * f
    # the faces are broken into buttresses and gullies, never at the rim's lip or the cliff's foot
    if 0 < h < LEDGE + MOUNT_RISE:
        h += 16.0 * (1 - 0.7 * f) * rugged(p) * smooth(2, 18, d) * smooth(0, 30, h) * (1 - (smooth(0, 14, poly_dist(p, SZ)) if inside(p, SZ) else 0))
    return max(0.0, h)
MOUNT_RISE = 320.0

def height(p):
    """Height with the switchback road cut into the cliff (a 10-ft shelf, fill below it where the slope is low)."""
    h = ground(p)
    if h == 0.0 and inside(p, VF): return 0.0
    best = None
    for (x0, z0, h0), (x1, z1, h1) in zip(ROAD[:-1], ROAD[1:]):
        d, t = seg_dist(p, (x0, z0), (x1, z1))
        if d > 40: continue
        rh = h0 + (h1 - h0) * t
        if best is None or d < best[0]: best = (d, rh)
    if best:
        d, rh = best
        if d <= ROAD_W / 2 + 0.5: return rh
        if rh > h: h = max(h, rh - 6.0 * (d - ROAD_W / 2))
    return h

# ------------------------------------------------------------------ the heightfield prop's data (see kit/sites/s.ts)
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

def slope_at(p, e=5.0):
    h = height(p)
    gx = (height((p[0] + e, p[1])) - height((p[0] - e, p[1]))) / (2 * e)
    gz = (height((p[0], p[1] + e)) - height((p[0], p[1] - e))) / (2 * e)
    return h, math.hypot(gx, gz)
