"""Relief for an outdoor map: the ground's gentle shape, written into scene.json as `level['relief']` (read by app/src/core/relief.ts).

The landform is read from the region's heightfield (world.json `height`, the same lattice and the same 1.25 relief the
land beyond the map is drawn with), at the map's pin and turned to the map's north, then tamed for a place people
built on: the region's slope is kept (so the low side is the one the region says, toward the water) but scaled down
by `gain` inside the settlement and less so round it (a town on a gentle bench, the land steeper beyond its walls), a
long, low undulation is added, local features are shaped (a knoll, a hollow, a vale), squares are levelled and
streets graded along their run. The result is a height grid every `cell` feet over the map's whole extent (its roads
out to their ends), in tenths of a foot above the level's elevation, anchored so the ground at the map's centre (its
pin) is 0; the app joins the samples with flat triangles, and the land beyond the map carries on from its edge heights.

Pure python, no numpy: run by the map's own script after its layout is settled. `report()` prints what a reviewer
checks (range and slopes inside the settlement, the square's flatness, the streets' grades, the low side)."""
import json, math, os
from collections import OrderedDict

FT_PER_MILE = 5280
RELIEF = 1.25   # the region is drawn a quarter steeper than surveyed (render/backdrop.ts, core/frames.ts RELIEF)


# ------------------------------------------------------------------ sampling (the same maths as app/src/core/relief.ts)
def _cr(a, b, c, d, t):
    return b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)))

def bicubic(grid, cols, rows, gx, gz):
    """Catmull-Rom through a row-major grid at fractional sample coordinates, clamped to the grid."""
    gx = min(cols - 1, max(0.0, gx)); gz = min(rows - 1, max(0.0, gz))
    c1 = min(cols - 2, int(math.floor(gx))); r1 = min(rows - 2, int(math.floor(gz))); tx = gx - c1; tz = gz - r1
    cs = [max(0, c1 - 1), c1, c1 + 1, min(cols - 1, c1 + 2)]
    v = []
    for k in range(4):
        r = min(rows - 1, max(0, r1 - 1 + k)); b = r * cols
        v.append(_cr(grid[b + cs[0]], grid[b + cs[1]], grid[b + cs[2]], grid[b + cs[3]], tx))
    return _cr(v[0], v[1], v[2], v[3], tz)

def linear(grid, cols, rows, gx, gz):
    """The samples joined by flat triangles, every cell split from its north-west to its south-east corner: the ground
    exactly as the app draws it (core/relief.ts `natural`)."""
    gx = min(cols - 1, max(0.0, gx)); gz = min(rows - 1, max(0.0, gz))
    c = min(cols - 2, int(math.floor(gx))); r = min(rows - 2, int(math.floor(gz))); u = gx - c; v = gz - r
    b = r * cols + c; h00, h10, h01, h11 = grid[b], grid[b + 1], grid[b + cols], grid[b + cols + 1]
    return h00 + (h10 - h00) * u + (h11 - h10) * v if u >= v else h00 + (h11 - h01) * u + (h01 - h00) * v

class Sampler:
    """A written relief block read back exactly as the app reads it."""
    def __init__(self, rel):
        self.r = rel; self.ox, self.oz = rel['origin']; self.cell = rel['cell']; self.cols = rel['cols']; self.rows = rel['rows']
        self.g = [int(v) / 10 for row in rel['h'] for v in row.split()]
    def __call__(self, x, z):
        return linear(self.g, self.cols, self.rows, (x - self.ox) / self.cell, (z - self.oz) / self.cell)
    def slope(self, x, z, e=5.0):
        return math.hypot(self(x + e, z) - self(x - e, z), self(x, z + e) - self(x, z - e)) / (2 * e)


# ------------------------------------------------------------------ the region
class Region:
    """The region's ground at plan points of a map: world.json's height lattice (Catmull-Rom, as the land beyond the
    map reads it), relative to the map's pin, steepened by RELIEF. The map's centre stands on its pin; `north` is the
    plan axis that points to map north."""
    def __init__(self, world_path, pin_key, centre, north='-z'):
        w = json.load(open(world_path))
        self.b = w['bounds']; self.cell = w.get('cellMiles', 0.125); self.H = w['height']; self.rows = len(self.H); self.cols = len(self.H[0])
        self.flat = [v for row in self.H for v in row]
        self.pin = next(p for p in w['pins'] if p['key'] == pin_key)['pos']
        self.lakes = w.get('lakes', [])
        self.cx, self.cz = centre
        N = {'+z': (0, 1), '-x': (-1, 0), '+x': (1, 0)}.get(north, (0, -1))
        self.E = (-N[1], N[0]); self.S = (-N[0], -N[1])
        self.h0 = self.miles_h(*self.pin)
    def miles_h(self, mx, my):
        return bicubic(self.flat, self.cols, self.rows, (mx - self.b['minX']) / self.cell - 0.5, (my - self.b['minY']) / self.cell - 0.5)
    def to_miles(self, x, z):
        dx, dz = x - self.cx, z - self.cz
        return (self.pin[0] + (self.E[0] * dx + self.E[1] * dz) / FT_PER_MILE, self.pin[1] + (self.S[0] * dx + self.S[1] * dz) / FT_PER_MILE)
    def to_plan(self, mx, my):
        dx, dy = (mx - self.pin[0]) * FT_PER_MILE, (my - self.pin[1]) * FT_PER_MILE
        return (self.cx + self.E[0] * dx + self.S[0] * dy, self.cz + self.E[1] * dx + self.S[1] * dy)
    def __call__(self, x, z):
        return (self.miles_h(*self.to_miles(x, z)) - self.h0) * RELIEF
    def nearest_lake(self, x, z):
        """The nearest lake shore to a plan point: (name, distance in ft, plan point on the shore)."""
        best = None
        for l in self.lakes:
            for k in range(256):
                a = k / 256 * 2 * math.pi
                px, pz = self.to_plan(l['center'][0] + math.cos(a) * l['r'][0], l['center'][1] + math.sin(a) * l['r'][1])
                d = math.hypot(px - x, pz - z)
                if best is None or d < best[1]: best = (l['name'], d, (px, pz))
        return best


# ------------------------------------------------------------------ shaping helpers
def smoothstep(a, b, t):
    k = min(1.0, max(0.0, (t - a) / (b - a))); return k * k * (3 - 2 * k)

def _hash(i, j, seed):
    h = (i * 374761393 + j * 668265263 + seed * 2147483647) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFFFFFF) / 4294967296.0

def value_noise(x, z, seed):
    """Smooth value noise in [-0.5, 0.5], one feature per unit."""
    xi, zi = math.floor(x), math.floor(z); fx, fz = x - xi, z - zi
    u = fx * fx * fx * (fx * (fx * 6 - 15) + 10); v = fz * fz * fz * (fz * (fz * 6 - 15) + 10)
    a = _hash(xi, zi, seed); b = _hash(xi + 1, zi, seed); c = _hash(xi, zi + 1, seed); d = _hash(xi + 1, zi + 1, seed)
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v - 0.5

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

def poly_dist(p, poly):
    return min(seg_dist(p, poly[i], poly[(i + 1) % len(poly)])[0] for i in range(len(poly)))

def bounds_of(polys):
    xs = [p[0] for poly in polys for p in poly]; zs = [p[1] for poly in polys for p in poly]
    return min(xs), min(zs), max(xs), max(zs)

def resample(pts, step):
    out = [tuple(pts[0])]
    for a, b in zip(pts[:-1], pts[1:]):
        L = math.hypot(b[0] - a[0], b[1] - a[1]); n = max(1, int(math.ceil(L / step)))
        for k in range(1, n + 1): out.append((a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n))
    return out


# ------------------------------------------------------------------ the build
def build(level, region, *, cell=50, gain=0.2, gain_out=None, out_ft=300, core=None, noise=((3.5, 820, 11), (1.2, 330, 23)),
          bumps=(), vales=(), flats=(), ways=(), way_sigma=70, way_grade=0.05, flat_slope=0.008, src=''):
    """The relief block for `level` (its rooms and terrain decide the extent).
    region: Region; gain: how much of the region's slope the settlement keeps (inside `core`); gain_out: how much the
    land outside it keeps, reached `out_ft` ft out from the core (a settlement on a gentle bench, the land steeper round
    it; default: gain everywhere); core: the settlement's outline (the undulation is full inside it, half outside);
    noise: (amplitude ft, wavelength ft, seed) octaves; bumps: (x, z, r_flat, r_out, dh) knolls (dh > 0) and hollows
    (dh < 0), flat out to r_flat; vales: (centreline, half width, depth at its start, depth at its end) shallow valleys
    a stream or a road follows; flats: (polygon, margin) squares, levelled to their own plane with its fall cut to
    `flat_slope`, blended out over the margin; ways: (width, centreline) graded along their run: the
    ground under them smoothed (gaussian `way_sigma` ft) and held to `way_grade` at most, cut into the rise or carried
    over the dip where the land is steeper (a road climbs a hillside at a road's grade, not the hill's)."""
    polys = [r['polygon'] for r in level.get('rooms', [])] + [t['polygon'] for t in level.get('terrain', [])]
    minX, minZ, maxX, maxZ = bounds_of(polys)
    ox = math.floor((minX - cell) / cell) * cell; oz = math.floor((minZ - cell) / cell) * cell
    cols = int(math.ceil((maxX + cell - ox) / cell)) + 1; rows = int(math.ceil((maxZ + cell - oz) / cell)) + 1
    vale_lines = []
    for pts, hw, d0, d1 in vales:
        segs = []; acc = 0.0
        for a, b in zip(pts[:-1], pts[1:]):
            L = math.hypot(b[0] - a[0], b[1] - a[1]); segs.append((tuple(a), tuple(b), acc, acc + L)); acc += L
        vale_lines.append((segs, hw, d0, d1))
    g_out = gain if gain_out is None else gain_out
    def gain_at(x, z):
        if core is None or g_out == gain or inside((x, z), core): return gain
        return gain + (g_out - gain) * smoothstep(0, out_ft, poly_dist((x, z), core))
    def town(x, z):
        h = gain_at(x, z) * region(x, z)
        k = 1.0 if core is None or inside((x, z), core) else 0.5
        for a, lam, seed in noise: h += 2 * a * k * value_noise(x / lam, z / lam, seed)
        for bx, bz, r0, r1, dh in bumps: h += dh * (1 - smoothstep(r0, r1, math.hypot(x - bx, z - bz)))
        for line, hw, d0, d1 in vale_lines:
            best = None
            for (a, b, s0, s1) in line:
                d, t = seg_dist((x, z), a, b)
                if best is None or d < best[0]: best = (d, s0 + (s1 - s0) * t)
            if best[0] < hw:
                L = line[-1][3] or 1.0; k = 1 - smoothstep(hw * 0.25, hw, best[0])
                h -= k * (d0 + (d1 - d0) * best[1] / L)
        return h
    g = [0.0] * (cols * rows)
    for r in range(rows):
        for c in range(cols): g[r * cols + c] = town(ox + c * cell, oz + r * cell)
    samp = lambda x, z: bicubic(g, cols, rows, (x - ox) / cell, (z - oz) / cell)
    # squares: levelled to their own gentle plane (every sample within a cell of the square, so the surface is flat right
    # to its edges), blended out over their margin; the streets are graded after, round them (they meet the square at
    # its own level, so a street running into it stays within its grade)
    def level_flats():
        for poly, margin in flats:
            # the square's own plane (least squares over it and its margin), its fall cut to `flat_slope`: near-level,
            # still shedding its rain the way the ground does
            fx0, fz0, fx1, fz1 = bounds_of([poly])
            pts = [(fx0 - margin + (fx1 - fx0 + 2 * margin) * i / 12, fz0 - margin + (fz1 - fz0 + 2 * margin) * j / 12) for i in range(13) for j in range(13)]
            mx = sum(p[0] for p in pts) / len(pts); mz = sum(p[1] for p in pts) / len(pts); hv = [samp(x, z) for x, z in pts]; mh = sum(hv) / len(hv)
            sxx = sum((p[0] - mx) ** 2 for p in pts); szz = sum((p[1] - mz) ** 2 for p in pts)
            ax = sum((p[0] - mx) * (h - mh) for p, h in zip(pts, hv)) / sxx; az = sum((p[1] - mz) * (h - mh) for p, h in zip(pts, hv)) / szz
            k0 = math.hypot(ax, az); f = min(1.0, flat_slope / k0) if k0 > 0 else 0.0; ax *= f; az *= f
            cx0 = sum(p[0] for p in poly) / len(poly); cz0 = sum(p[1] for p in poly) / len(poly)
            inner = [samp(x, z) for x, z in pts if inside((x, z), poly)] or [mh]
            base = sum(inner) / len(inner)
            for r in range(rows):
                for c in range(cols):
                    x, z = ox + c * cell, oz + r * cell
                    d = 0.0 if inside((x, z), poly) else poly_dist((x, z), poly)
                    if d < cell + margin:
                        k = 1 - smoothstep(cell, cell + margin, d); t = base + ax * (x - cx0) + az * (z - cz0)
                        g[r * cols + c] += (t - g[r * cols + c]) * k
    level_flats()
    # streets graded along their run: the ground under the centreline, smoothed with a gaussian along the way, pulled in
    # under the way and blended out over a margin either side (one pass per way, in order: crossings agree)
    for width, pts in ways:
        line = resample(pts, 10.0)
        prof = [samp(x, z) for x, z in line]
        n = len(prof); k = max(1, int(round(way_sigma / 10.0)))
        ker = [math.exp(-0.5 * (i / (way_sigma / 10.0)) ** 2) for i in range(-3 * k, 3 * k + 1)]
        sm = []
        for i in range(n):
            s = wsum = 0.0
            for j, kv in enumerate(ker):
                q = min(n - 1, max(0, i + j - 3 * k)); s += prof[q] * kv; wsum += kv
            sm.append(s / wsum)
        # hold the grade: the profile clamped to `way_grade` walking from its start (cut ahead, fill behind) and walking
        # from its end, averaged; each is within the grade everywhere, so their mean is too, and neither end is favoured
        lim = way_grade * 10.0
        fw = sm[:]; bw = sm[:]
        for i in range(1, n): fw[i] = min(fw[i - 1] + lim, max(fw[i - 1] - lim, fw[i]))
        for i in range(n - 2, -1, -1): bw[i] = min(bw[i + 1] + lim, max(bw[i + 1] - lim, bw[i]))
        sm = [(a + b) / 2 for a, b in zip(fw, bw)]
        reach = width / 2 + 45
        # the way's segments in buckets of a cell, so each sample only measures the pieces near it
        buckets = {}
        for i in range(len(line) - 1):
            mx, mz = (line[i][0] + line[i + 1][0]) / 2, (line[i][1] + line[i + 1][1]) / 2
            buckets.setdefault((int(math.floor(mx / cell)), int(math.floor(mz / cell))), []).append(i)
        R = int(math.ceil(reach / cell)) + 1
        touched = set()
        for (bi, bj) in buckets:
            for di in range(-R, R + 1):
                for dj in range(-R, R + 1):
                    c = int(math.floor(((bi + di) * cell - ox) / cell)); r = int(math.floor(((bj + dj) * cell - oz) / cell))
                    for cc in (c, c + 1):
                        for rr in (r, r + 1):
                            if 0 <= cc < cols and 0 <= rr < rows: touched.add((rr, cc))
        for r, c in touched:
            x, z = ox + c * cell, oz + r * cell
            if any(inside((x, z), poly) or poly_dist((x, z), poly) < cell for poly, _m in flats): continue  # the square stays level
            bi, bj = int(math.floor(x / cell)), int(math.floor(z / cell)); best = None
            for di in range(-R, R + 1):
                for dj in range(-R, R + 1):
                    for i in buckets.get((bi + di, bj + dj), ()):
                        d, t = seg_dist((x, z), line[i], line[i + 1])
                        if best is None or d < best[0]: best = (d, sm[i] + (sm[i + 1] - sm[i]) * t)
            if best and best[0] < reach:
                kk = 1 - smoothstep(width / 2, reach, best[0]); g[r * cols + c] += (best[1] - g[r * cols + c]) * kk
    # anchor: the ground at the map's centre (its pin) is 0
    a = samp(region.cx, region.cz)
    rel = OrderedDict(v=1, origin=[ox, oz], cell=cell, cols=cols, rows=rows,
                      h=[' '.join(str(int(round((g[r * cols + c] - a) * 10))) for c in range(cols)) for r in range(rows)], src=src)
    return rel

# ------------------------------------------------------------------ the review
def report(rel, region, *, core=None, flats=(), ways=()):
    """What a reviewer checks, as a dict (the map's script prints it; tests/relief.test.ts asserts the same rules)."""
    s = Sampler(rel); out = OrderedDict()
    pts = []
    if core:
        x0, z0, x1, z1 = bounds_of([core])
        for i in range(61):
            for j in range(31):
                p = (x0 + (x1 - x0) * i / 60, z0 + (z1 - z0) * j / 30)
                if inside(p, core): pts.append(p)
        hs = [s(*p) for p in pts]; slp = [(s.slope(*p), p) for p in pts]; sl = sorted(v for v, _ in slp)
        out['core range ft'] = round(max(hs) - min(hs), 1)
        out['core slope p95 %'] = round(100 * sl[int(len(sl) * 0.95)], 1); out['core slope max %'] = round(100 * sl[-1], 1)
        out['core slope max at'] = [round(v) for v in max(slp)[1]]
        # the low side: the lowest tenth of the settlement, and which way it lies from the centre
        lo = sorted(zip(hs, pts))[: max(1, len(pts) // 10)]; cx = sum(p[0] for p in pts) / len(pts); cz = sum(p[1] for p in pts) / len(pts)
        lx = sum(p[0] for _, p in lo) / len(lo) - cx; lz = sum(p[1] for _, p in lo) / len(lo) - cz
        out['low side bearing (deg from north, clockwise)'] = round(math.degrees(math.atan2(lx * region.E[0] + lz * region.E[1], -(lx * region.S[0] + lz * region.S[1]))) % 360)
        lake = region.nearest_lake(cx, cz)
        if lake:
            ldx, ldz = lake[2][0] - cx, lake[2][1] - cz
            out['nearest water'] = f"{lake[0]}, {round(lake[1])} ft at bearing {round(math.degrees(math.atan2(ldx * region.E[0] + ldz * region.E[1], -(ldx * region.S[0] + ldz * region.S[1]))) % 360)}"
    for i, (poly, _m) in enumerate(flats):
        x0, z0, x1, z1 = bounds_of([poly]); hs = [s(x0 + (x1 - x0) * a / 10, z0 + (z1 - z0) * b / 10) for a in range(11) for b in range(11)]
        out[f'flat {i} range ft'] = round(max(hs) - min(hs), 2)
    worst = 0.0
    for width, pts in ways:
        line = resample(pts, 10.0); prof = [s(x, z) for x, z in line]
        if core: prof = [h for h, p in zip(prof, line) if inside(p, core)] or [0.0]
        worst = max([worst] + [abs(prof[i + 1] - prof[i]) / 10.0 for i in range(len(prof) - 1)])
    if ways: out['street grade max %'] = round(100 * worst, 1)
    out['grid'] = f"{rel['cols']} x {rel['rows']} every {rel['cell']} ft"
    return out
