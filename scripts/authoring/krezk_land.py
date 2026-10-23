"""Shared ground for Krezk (chapter 8, area S) and the Abbey of Saint Markovia (S10): one topography for both maps.

Frames (all in feet, +x east, +z south):
  * Krezk frame: the 300-dpi render of the Krezk map (p.144, one square = 50 ft, 67.1 px per square); origin at
    render px (600, 800).
  * Abbey frame: the abbey ground-floor map (p.149, one square = 10 ft) turned north-up; origin on its 10-ft grid.
    5-ft cells are what the abbey script authors in. Krezk = abbey + OFF (read off both maps: the north gate, the main
    hall and the east wing agree to a few feet).
The village floor is 0. The text puts the abbey's ledge 400 ft above it; that figure is kept as the DM's note, and the
ground is built at LEDGE (200 ft) so the switchback road (S5) can climb it at a grade a cart could take and the cliffs
read as a shelf cut into a mountainside instead of a free-standing plug. The mountain rises behind the ledge to the
north and east (its summit beyond the frame); the west and south faces fall to the village as cliffs with a scree
apron, the road cut into the west face as three benches. At the frame's edge the land goes to the region's own height
(world.json, as the backdrop draws it), so the map meets the land beyond it.
Only positions, sizes and heights live here (no book art)."""
import json, math, os

PX_PER_FT = 67.1 / 50.0
def K(px, py):
    """Krezk render px -> Krezk ft."""
    return ((px - 600) / PX_PER_FT, (py - 800) / PX_PER_FT)

OFF = (398.5, 256.5)                      # abbey ft -> Krezk ft
def a2k(x, z): return (x + OFF[0], z + OFF[1])
def k2a(x, z): return (x - OFF[0], z - OFF[1])
def cells_k(pts): return [a2k(x * 5, z * 5) for x, z in pts]

LEDGE = 200.0                             # the ledge above the village floor (the book's 400 ft stays in the DM notes)
BOOK_LEDGE_FT = 400                       # what the text says: for the notes
MOUNT_RISE = 250.0                        # how far the mountain climbs above the ledge inside the frame (the summit is beyond it)
# the abbey's own storeys above the ledge: the upper floor at 15 ft (fifteen-foot walls), the loft at the upper floor's
# ceiling (its stair is twenty feet up: the loft floor rides a little above the hall's 20-ft ceiling), the cellar 20 ft down
ABBEY_LEVELS = {'ground': 0.0, 'upper': 15.0, 'loft': 23.0, 'cellar': -20.0}
# the Krezk map's extent (the village level's ground) and the lattice the land is sampled on
FRAME = (-260.0, -430.0, 1160.0, 1260.0)
COARSE_CELL, FINE_CELL = 10.0, 5.0
FINE = (330.0, 110.0, 460.0, 480.0)       # x, z, w, d: the switchbacks, the ledge's rock and its cliffs, on a 5-ft lattice
REGION_BLEND = 360.0                      # how far inside the frame's edge the land turns toward the region's height

# ------------------------------------------------------------------ the ledge (abbey cells): its rim, and where the
# mountain rises behind it (north of the gate road, east of the outer wall, north of the gardens)
RIM_CELLS = [(9.5, 29), (9.5, 8), (10.5, 4), (12.5, 1), (15, -2.5), (34, -2.5), (34.6, 0), (34.6, 21.5), (36, 24), (38, 25.6), (53.5, 25.6),
             (57, 23), (74, 23), (77, 25.5), (77.5, 35.5), (75.5, 38.5), (70, 40), (64, 41.8), (58, 43.4), (56, 43.6), (36, 43.6), (26, 43.6),
             (25.6, 38.4), (20, 32.6), (16, 32.6), (13, 31.6), (11, 30.5)]
UP_CELLS = [(15, -2.5), (30, -2.5), (34, -2.5), (34.6, 0), (34.6, 21.5), (36, 24), (38, 25.6), (53.5, 25.6), (57, 23), (74, 23), (77, 25.5)]
RIM = cells_k(RIM_CELLS)
UP = cells_k(UP_CELLS)
# the mountain's flanks: its west flank runs north-north-west from the ledge's north-west corner (the pool and the
# village's north wall lie at its foot), its south flank east-south-east from the gardens' south-east corner; between them
# it is all mountain
RAY_W = (UP[0], (UP[0][0] - 700, UP[0][1] - 2000))
RAY_E = ((786.0, 434.0), (2786.0, 834.0))
MZ = [RAY_W[1]] + UP + [RAY_E[1], (RAY_E[1][0], RAY_W[1][1])]

# ------------------------------------------------------------------ the village (Krezk ft)
WALL = [(277.5, 113.75), (377.5, 113.75), (413.75, 155), (565, 536), (568.75, 547.5), (568.75, 707.5), (521.25, 755), (272.5, 755), (80, 562.5), (82.5, 312.5)]
# the walls stop where the cliff takes over: between the north-east tower and the east tower there is no wall
WALL_RUNS = [[(565, 536), (568.75, 547.5), (568.75, 707.5), (521.25, 755), (272.5, 755), (80, 562.5), (82.5, 312.5), (277.5, 113.75), (377.5, 113.75), (413.75, 155)]]
TOWER_NE, TOWER_E = (415.0, 157.5), (565.0, 536.0)
GATE = (418.0, 755.0)                     # the gatehouse in the south wall (S2)
# the village floor: the walls' ring, its north-east side following the foot of the abbey's cliff (a scree apron stands
# between the pines and the rock, so the lowest bench of the road has room)
VF = [(277.5, 113.75), (377.5, 113.75), (413.75, 155), (390, 188), (352, 222), (334, 300), (334, 395), (360, 428), (410, 445), (450, 452),
      (500, 480), (545, 515), (568.75, 547.5), (568.75, 707.5), (521.25, 755), (272.5, 755), (80, 562.5), (82.5, 312.5)]
# the floor the mountain's faces fall to: the village floor, and east of the walls the forest at the foot of the
# mountain's south shoulder
FLOOR = VF[:13] + [(615, 585), (800, 625), (1300, 660), (1300, 1400), (-300, 1400), (-300, 113.75)]

# ------------------------------------------------------------------ the switchback road (S5), Krezk ft, foot to ledge
# three benches cut into the west face, one above the other: the first climbs north from the foot by the S3 lane past
# the north-east tower, doubles back south to above the foot, and doubles back north again to the ledge's north-west
# corner; the gate road runs on along the rim to the north gate (S6)
ROAD_PTS = [(452, 447), (430, 441), (406, 431), (386, 412), (373, 384), (368, 346), (368, 300), (371, 254), (378, 213), (394, 192), (418, 183), (440, 170),
            (460, 154), (478, 156), (481, 180), (467, 204), (451, 228), (436, 252), (423, 284), (415, 318), (411, 355), (411, 392), (417, 418), (430, 432),
            (444, 430), (443, 412), (440, 392), (441, 360), (439, 320), (439, 290), (443, 270), (449, 258), (458, 251), (468.5, 249), (482, 247)]
LEG_APEX = [(480, 168), (440, 432)]       # where the road doubles back (the ends of the first and second legs)
ROAD_ON_LEDGE = [(482, 247), (500, 248), (515, 249), (527, 254), (533.5, 266)]   # on the rock top, to the north gate
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
ROAD_CLIMB = [p for p in ROAD if p[2] < LEDGE - 0.5]      # the climbing part (the ribbon)

def road_stats():
    """(length ft, max grade, legs' lengths) of the climb, for the authoring scripts to print."""
    pts = ROAD_CLIMB + [ROAD[len(ROAD_CLIMB)]]
    L = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(pts[:-1], pts[1:]))
    g = max(abs(b[2] - a[2]) / (math.hypot(b[0] - a[0], b[1] - a[1]) or 1e-9) for a, b in zip(pts[:-1], pts[1:]))
    return L, g, [sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(leg[:-1], leg[1:])) for leg in LEGS]

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

def _legs():
    pts = ROAD_CLIMB
    idx = []
    for ax, az in LEG_APEX:     # each apex is looked for beyond the one before (the second lies over the road's foot)
        lo = idx[-1] + 1 if idx else 0
        idx.append(min(range(lo, len(pts)), key=lambda i: math.hypot(pts[i][0] - ax, pts[i][1] - az)))
    return [pts[:idx[0] + 1], pts[idx[0]:idx[1] + 1], pts[idx[1]:]]
LEGS = _legs()
def _bbox(pts, pad):
    xs = [p[0] for p in pts]; zs = [p[1] for p in pts]
    return (min(xs) - pad, min(zs) - pad, max(xs) + pad, max(zs) + pad)
_LEG_BOX = [_bbox(leg, 160) for leg in LEGS]
def _near_on(poly3, p):
    best = None
    for (x0, z0, h0), (x1, z1, h1) in zip(poly3[:-1], poly3[1:]):
        d, t = seg_dist(p, (x0, z0), (x1, z1))
        if best is None or d < best[0]: best = (d, h0 + (h1 - h0) * t)
    return best

IDW_K = 2.2
def _face(p):
    """The west and south faces: the ground between the ledge's rim (LEDGE), the road's benches (each at its own height)
    and the floor (0), by inverse-distance weighting, so every bench stands on its own shelf with steep rock between,
    the lip of the cliff is a brow and its foot an apron."""
    cands = [(poly_dist(p, FLOOR), 0.0), (poly_dist(p, RIM), LEDGE)]
    for leg, (x0, z0, x1, z1) in zip(LEGS, _LEG_BOX):
        if x0 <= p[0] <= x1 and z0 <= p[1] <= z1:
            d, h = _near_on(leg, p); cands.append((max(0.0, d - ROAD_W / 2 - 0.5), h))
    num = den = 0.0
    for d, h in cands:
        if d < 1e-6: return h
        w = d ** -IDW_K; num += w * h; den += w
    return num / den * (1 - smooth(FACE_RUN, FACE_RUN + 140, cands[1][0]))   # the faces reach the floor within FACE_RUN of the rim
FACE_RUN = 220.0

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
    """-1..1: buttresses and gullies on the rock faces, about sixty feet apart."""
    x, z = p
    return (noise(x / 30.0, z / 30.0) * 0.65 + noise(x / 12.0 + 7.3, z / 12.0 - 3.1) * 0.35 - 0.5) * 2
RUGGED_FT = 30.0

def _flank(p):
    """0..1: how fully the mountain stands here. It fades out across its two flank lines (west: north-north-west from the
    ledge's north-west corner; south: east-south-east from the gardens), the fade widening with the distance from the ledge."""
    out = 1.0
    for (a, b), side, k in ((RAY_W, 1, 0.6), (RAY_E, -1, 0.4)):
        dx, dz = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dz); ux, uz = dx / L, dz / L
        along = (p[0] - a[0]) * ux + (p[1] - a[1]) * uz
        perp = side * ((p[0] - a[0]) * (-uz) + (p[1] - a[1]) * ux)      # into the mountain
        out *= smooth(0, 60 + k * max(0.0, along), perp + 2.0 * max(0.0, -along))   # behind the ledge it is all mountain
    return out

def ground(p):
    """(height ft above the village floor, how much mountain, distance to the rim) of the land at Krezk point p, before the
    faces are roughened and the road is cut in."""
    if inside(p, VF): return 0.0, 0.0, 1e9
    if inside(p, RIM): return LEDGE, 0.0, 0.0
    d = poly_dist(p, RIM)
    h = _face(p)
    f = 0.0
    if inside(p, MZ):       # behind the ledge's north and east edges the mountain rises; it fades out at its flanks
        f = _flank(p)
        if f > 0:
            du = poly_dist(p, UP, closed=False)
            # the mass climbs toward its summit north-north-east of the ledge (beyond the frame); east of the gardens it is
            # a lower shoulder
            dx, dz = p[0] - 620.0, p[1] - 340.0; L = math.hypot(dx, dz) or 1.0
            toward = 0.35 + 0.65 * smooth(0.3, 0.95, (dx * 0.6 - dz * 0.8) / L)
            up = LEDGE + MOUNT_RISE * toward * (1 - math.exp(-du / 300.0)) + 30.0 * (noise(p[0] / 150.0, p[1] / 150.0) - 0.5) * 2 * smooth(0, 60, du)
            h = h * (1 - f) + up * f
    return max(0.0, h), f, d

def _road_near(p):
    """(distance, road height) of the nearest point of the road, or None beyond 40 ft of it."""
    best = None
    for (x0, z0, h0), (x1, z1, h1) in zip(ROAD[:-1], ROAD[1:]):
        if abs(p[0] - x0) > 60 and abs(p[0] - x1) > 60: continue
        d, t = seg_dist(p, (x0, z0), (x1, z1))
        if d > 40: continue
        rh = h0 + (h1 - h0) * t
        if best is None or d < best[0]: best = (d, rh)
    return best

def height(p):
    """Height with the faces broken into buttresses and gullies (never at the rim's lip, the cliff's foot or beside the
    road; the mountain's slopes carry them more gently) and the switchback road cut in (a 10-ft shelf, fill below it)."""
    h, f, d = ground(p)
    road = _road_near(p)
    if 0 < h < LEDGE + MOUNT_RISE:
        h += RUGGED_FT * (1 - 0.5 * f) * rugged(p) * smooth(2, 18, d) * smooth(0, 30, h) * (smooth(6, 22, road[0]) if road else 1.0)
        h = max(0.0, h)
    if road:
        d, rh = road
        if d <= ROAD_W / 2 + 0.5: return rh
        if rh > h: h = max(h, rh - 6.0 * (d - ROAD_W / 2))
    return h

# ------------------------------------------------------------------ the region's own ground, as the backdrop draws it
# (locations/ch02/barovia-region/world.json: bilinear on its lattice, x1.25, relative to the pin's own cell), so the
# frame's edge can go toward the land beyond it. Sampled read-only at run time.
_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
def _load_region():
    try:
        w = json.load(open(os.path.join(_ROOT, 'locations', 'ch02', 'barovia-region', 'world.json')))
        pin = next(p for p in w['pins'] if p['key'] == 'S')
        return w, tuple(pin['pos'])
    except (OSError, StopIteration, KeyError, ValueError):
        return None, None
_REGION, _PIN = _load_region()
def _region_sample(mx, my):
    w = _REGION; H = w['height']; cell = w.get('cellMiles', 0.125); x0 = w['bounds']['minX']; y0 = w['bounds']['minY']; rows = len(H); cols = len(H[0])
    cx = min(x0 + (cols - 0.5) * cell, max(x0 + 0.5 * cell, mx)); cy = min(y0 + (rows - 0.5) * cell, max(y0 + 0.5 * cell, my))
    gx = (cx - x0) / cell - 0.5; gy = (cy - y0) / cell - 0.5; k0 = math.floor(gx); r0 = math.floor(gy); tx = gx - k0; ty = gy - r0
    def g(r, k): return 0.0 if (r < 0 or r >= rows or k < 0 or k >= cols) else (H[r][k] or 0)
    return (g(r0, k0) * (1 - tx) + g(r0, k0 + 1) * tx) * (1 - ty) + (g(r0 + 1, k0) * (1 - tx) + g(r0 + 1, k0 + 1) * tx) * ty
_HPIN = _region_sample(*_PIN) if _REGION and _REGION.get('height') else None
def region_rel(p):
    """The region's ground at Krezk point p, ft above the village floor, as the backdrop draws it (x1.25); None without data."""
    if _HPIN is None: return None
    cx, cz = (FRAME[0] + FRAME[2]) / 2, (FRAME[1] + FRAME[3]) / 2
    return (_region_sample(_PIN[0] + (p[0] - cx) / 5280.0, _PIN[1] + (p[1] - cz) / 5280.0) - _HPIN) * 1.25

def edge_dist(p):
    return min(p[0] - FRAME[0], FRAME[2] - p[0], p[1] - FRAME[1], FRAME[3] - p[1])

def land(p):
    """The land as the maps sample it: the local ground with the road cut in, turned toward the region's own height within
    REGION_BLEND ft of the frame's edge so the mountain shoulders fall to the backdrop instead of ending in a skirt wall."""
    h = height(p)
    e = edge_dist(p)
    if e < REGION_BLEND:
        r = region_rel(p)
        target = max(0.0, r) if r is not None else 0.0
        h = target + (h - target) * smooth(0, REGION_BLEND, e)
    return max(0.0, h)

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

def land_lattices(off=(0.0, 0.0), frost=None):
    """The two heightfield props of the shared land for a map whose frame is Krezk ft minus `off` (the abbey: OFF): a 10-ft
    lattice over the whole Krezk frame with a 5-ft patch laid into it round the ledge and the switchbacks. Each entry is
    (id, x, z, dims) in that map's feet."""
    def on_climb(x, z):
        rn = _road_near((x, z))
        return rn is not None and rn[0] <= ROAD_W / 2 + 6.0 and rn[1] < LEDGE - 1.0
    def fn(x, z): return LEDGE - 1.0 if (inside((x, z), RIM) and not on_climb(x, z)) else land((x, z))
    def fine_hole(x, z):
        if inside((x, z), RIM) and poly_dist((x, z), RIM) > 6: return True
        return land((x, z)) <= 0.6
    def in_fine(x, z): return FINE[0] < x < FINE[0] + FINE[2] and FINE[1] < z < FINE[1] + FINE[3]
    def coarse_hole(x, z):
        if in_fine(x, z): return True                     # the fine patch's own ground
        if inside((x, z), RIM) and poly_dist((x, z), RIM) > 12: return True
        return land((x, z)) <= 0.6
    nx, nz = int((FRAME[2] - FRAME[0]) / COARSE_CELL), int((FRAME[3] - FRAME[1]) / COARSE_CELL)
    coarse = heightfield_dims(FRAME[0], FRAME[1], nx, nz, COARSE_CELL, fn, hole=coarse_hole)
    fine = heightfield_dims(FINE[0], FINE[1], int(FINE[2] / FINE_CELL), int(FINE[3] / FINE_CELL), FINE_CELL, fn, hole=fine_hole)
    coarse['drop'] = 14
    fine['drop'] = 14
    if frost is not None: coarse['frost'] = frost; fine['frost'] = frost
    return [('land-mountain', FRAME[0] - off[0], FRAME[1] - off[1], coarse), ('land-cliff', FINE[0] - off[0], FINE[1] - off[1], fine)]

def edge_report():
    """The land's height along the frame's edge against the region's (x1.25) there: (max diff, min, max, samples)."""
    out = []
    x0, z0, x1, z1 = FRAME
    for i in range(0, int((x1 - x0) / 20) + 1):
        for z in (z0, z1): out.append(((x0 + i * 20, z), land((x0 + i * 20, z)), region_rel((x0 + i * 20, z))))
    for j in range(0, int((z1 - z0) / 20) + 1):
        for x in (x0, x1): out.append(((x, z0 + j * 20), land((x, z0 + j * 20)), region_rel((x, z0 + j * 20))))
    return out

def lattice_sampler(lattices):
    """y(x, z) of the land as the heightfield props draw it (the finer patch where it lies, the same triangles as
    kit/sites/s.ts heightfield()), in the lattices' own frame; None in a hole. Things that stand on the land take their
    height from this, so they neither float nor sink."""
    fields = []
    for _, lx, lz, dims in lattices:
        nx, nz, cell, q = dims['nx'], dims['nz'], dims['cell'], dims['q']
        W = nx + 1; H = []
        for k in range(W * (nz + 1)):
            v = dims.get(f'd{k // 4}')
            c = HOLE if v is None else (v // (4096 ** (k % 4))) % 4096
            H.append(None if c == HOLE else c * q)
        fields.append((lx, lz, nx, nz, cell, W, H))
    def sample(p):
        x, z = p
        for lx, lz, nx, nz, cell, W, H in reversed(fields):      # the fine patch first
            fx, fz = (x - lx) / cell, (z - lz) / cell
            i, j = int(math.floor(fx)), int(math.floor(fz))
            if i < 0 or j < 0 or i >= nx or j >= nz: continue
            a, b, c, e = j * W + i, j * W + i + 1, (j + 1) * W + i + 1, (j + 1) * W + i
            if H[a] is None or H[b] is None or H[c] is None or H[e] is None: continue
            tx, tz = fx - i, fz - j
            if abs(H[a] - H[c]) < abs(H[b] - H[e]):
                if tx >= tz: return H[a] + (H[b] - H[a]) * tx + (H[c] - H[b]) * tz
                return H[a] + (H[e] - H[a]) * tz + (H[c] - H[e]) * tx
            if tx + tz <= 1: return H[a] + (H[b] - H[a]) * tx + (H[e] - H[a]) * tz
            return H[c] + (H[b] - H[c]) * (1 - tz) + (H[e] - H[c]) * (1 - tx)
        return None
    return sample

def ribbon_dims(pts, w, origin=(0.0, 0.0, 0.0)):
    """A road ribbon through (x, z, y) points, relative to origin."""
    d = {'n': len(pts), 'w': w}
    for i, (x, z, y) in enumerate(pts):
        d[f'x{i}'] = round(x - origin[0], 2); d[f'z{i}'] = round(z - origin[1], 2); d[f'y{i}'] = round(y - origin[2], 2)
    return d

def slope_at(p, e=5.0):
    """(height, slope) of the land as the maps draw it."""
    h = land(p)
    gx = (land((p[0] + e, p[1])) - land((p[0] - e, p[1]))) / (2 * e)
    gz = (land((p[0], p[1] + e)) - land((p[0], p[1] - e))) / (2 * e)
    return h, math.hypot(gx, gz)
