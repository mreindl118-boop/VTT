#!/usr/bin/env python3
"""The Lands of Barovia, read off the regional map (book p.35) at 400 dpi so every feature the map shows lands
where the book puts it: the lettered sites, the roads and trails, the rivers, the lakes, and a land-cover grid
(forest, hills, mountains, water, mist) at an eighth of a mile. Only positions and classes are recorded; the
art in the app is painted from this data, nothing of the page is copied.

Run after `scripts/authoring/barovia-world.py` (the hand-measured base: names, types, scenes, heights); this
script refines positions from the page and adds what the base lacks. Needs reference/module/curse-of-strahd.pdf
(gitignored) and pdftoppm."""
import json, os, subprocess, sys
from collections import OrderedDict
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from scipy.signal import fftconvolve

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PDF = os.path.join(ROOT, 'reference/module/curse-of-strahd.pdf')
OUT = os.path.join(ROOT, 'locations/ch02/barovia-region/world.json')
TMP = os.environ.get('SCRATCH', '/tmp') + '/barovia-cover'
PAGE = 36  # pdf page holding the printed p.35 map
CELL_MI = 0.125
os.makedirs(TMP, exist_ok=True)

# ------------------------------------------------------------------ the page
if not os.path.exists(f'{TMP}/page-{PAGE:03d}.png'):
    subprocess.run(['pdftoppm', '-f', str(PAGE), '-l', str(PAGE), '-r', '400', '-png', PDF, f'{TMP}/page'], check=True)
page = Image.open(f'{TMP}/page-{PAGE:03d}.png').convert('RGB')
pw, ph = page.size
crop = page.crop((int(pw * 0.015), int(ph * 0.015), int(pw * 0.89), int(ph * 0.46)))
im = np.asarray(crop).astype(float); H, W = im.shape[:2]
r, g, b = im[..., 0], im[..., 1], im[..., 2]; lum = (r + g + b) / 3

# the frame: the thick black border; the map proper lies inside it
dark = lum < 60
rows = np.where(dark.mean(1) > 0.8)[0]; cols = np.where(dark.mean(0) > 0.8)[0]
top, bottom = rows[rows < H * 0.1].max() + 1, rows[rows > H * 0.9].min() - 1
left, right = cols[cols < W * 0.1].max() + 1, cols[cols > W * 0.9].min() - 1
print('frame', left, top, right, bottom)

# ------------------------------------------------------------------ classes
road_m = (r > 140) & (g < 115) & (b < 115) & (r - g > 55)            # the red roads (and the red of the pins)
dred = (r > 55) & (g < 70) & (b < 70) & (r > g * 1.8)                 # the dark red of the pin rings
water_m = (b > r + 18) & (b > g + 6) & (lum > 110)
forest_m = (g >= r) & (lum < 95) & ~road_m
light_m = (lum > 150) & ~water_m & ~road_m
k = 25; mean = ndi.uniform_filter(lum, k); sq = ndi.uniform_filter(lum * lum, k); std = np.sqrt(np.maximum(0, sq - mean * mean))
mist_m = light_m & (std < 14)
high_m = light_m & ~mist_m
# ridge density: the brown dotted contour bands that mark the mountains (mid-dark, not green)
ridge = (lum > 45) & (lum < 125) & (np.abs(r - g) < 28) & (g <= r + 6) & ~road_m
ridge_d = ndi.uniform_filter(ridge.astype(float), 141)

# ------------------------------------------------------------------ pins
light_f = (lum > 185).astype(float)
R = 19
yy, xx = np.mgrid[-R - 5:R + 6, -R - 5:R + 6]; d = np.hypot(xx, yy)
ring = ((d >= R - 2) & (d <= R + 2)).astype(float); ring /= ring.sum()
disk = (d <= R - 5).astype(float); disk /= disk.sum()
score = fftconvolve(dred.astype(float), ring, mode='same') * np.clip(fftconvolve(light_f, disk, mode='same') / 0.5, 0, 1)
lab, n = ndi.label(score > 0.3)
found = [(c[1], c[0]) for c in ndi.center_of_mass(score, lab, range(1, n + 1))]
print('pin discs found', len(found))

base = json.load(open(OUT))
P = np.array([p['pos'] for p in base['pins']]); Q = np.array(found)
s = (right - left) / (base['bounds']['maxX'] - base['bounds']['minX']); t = np.array([left - base['bounds']['minX'] * s, top - base['bounds']['minY'] * s])
for gate in (260, 200, 140, 110, 90, 80, 80, 80):
    pred = P * s + t; dd = np.linalg.norm(pred[:, None, :] - Q[None, :, :], axis=2); j = dd.argmin(1); ok = dd[np.arange(len(P)), j] < gate
    A = np.c_[P[ok].ravel(), np.tile(np.eye(2), (ok.sum(), 1))]
    sol, *_ = np.linalg.lstsq(A, Q[j[ok]].ravel(), rcond=None); s, t = sol[0], sol[1:]
print('registration: px/mile', round(s, 2), 'origin', t.round(1), 'matched', int(ok.sum()), 'of', len(P))
mi = lambda x, y: [round((x - t[0]) / s, 2), round((y - t[1]) / s, 2)]
px = lambda p: np.array(p) * s + t

def refine(p):
    """Snap a measured pin to the pin disc the detector found nearest it, if one lies close."""
    q = px(p); dd = np.linalg.norm(Q - q, axis=1) if len(Q) else []
    return Q[dd.argmin()] if len(Q) and dd.min() < 110 else q

# extra discs the printed map carries beyond the base list (page pixels, from the page itself)
EXTRA = [('M2', 'Mount Baratok', (1005, 381), 'peak'), ('M3', 'Mount Baratok', (1215, 300), 'peak'), ('M4', 'Mount Baratok', (1455, 336), 'peak'),
         ('M5', 'Mount Baratok', (1770, 366), 'peak'), ('D2', 'River Ivlis (east bridge)', (2604, 1386), 'river')]
FIX = {'Y': (240, 1245)}  # discs the detector misses on the page (Yester Hill stands in the mist at the west edge)
pins = []
for p in base['pins']:
    q = refine(p['pos']) if p['key'] not in FIX else np.array(FIX[p['key']], float); e = OrderedDict(p); e['pos'] = mi(*q); pins.append(e)
have = {p['key'] for p in pins}
for key, name, at, typ in EXTRA:
    if key in have: continue
    q = refine(mi(*at)); pins.append(OrderedDict(key=key, name=name, pos=mi(*q), type=typ))
pin_px = [px(p['pos']) for p in pins]

# ------------------------------------------------------------------ thinning and polylines
def thin(mask):
    """Zhang–Suen thinning, vectorised."""
    img = mask.astype(np.uint8).copy()
    def nb(a):
        p = np.pad(a, 1)
        return [p[:-2, 1:-1], p[:-2, 2:], p[1:-1, 2:], p[2:, 2:], p[2:, 1:-1], p[2:, :-2], p[1:-1, :-2], p[:-2, :-2]]  # P2..P9
    while True:
        changed = False
        for step in (0, 1):
            P2, P3, P4, P5, P6, P7, P8, P9 = nb(img)
            B = P2 + P3 + P4 + P5 + P6 + P7 + P8 + P9
            seq = [P2, P3, P4, P5, P6, P7, P8, P9, P2]
            A = sum(((seq[i] == 0) & (seq[i + 1] == 1)).astype(np.uint8) for i in range(8))
            c1 = (P2 * P4 * P6 == 0) & (P4 * P6 * P8 == 0) if step == 0 else (P2 * P4 * P8 == 0) & (P2 * P6 * P8 == 0)
            rm = (img == 1) & (B >= 2) & (B <= 6) & (A == 1) & c1
            if rm.any(): img[rm] = 0; changed = True
        if not changed: return img.astype(bool)

def polylines(skel, min_len=40):
    """Walk a skeleton into polylines, breaking at junctions."""
    sk = skel.copy(); pts = set(zip(*np.nonzero(sk)))
    N8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    deg = {p: sum((p[0] + dy, p[1] + dx) in pts for dy, dx in N8) for p in pts}
    ends = [p for p in pts if deg[p] != 2]
    seen = set(); lines = []
    def walk(start, nxt):
        line = [start, nxt]; seen.add((start, nxt)); seen.add((nxt, start)); cur, prev = nxt, start
        while deg[cur] == 2:
            nn = [(cur[0] + dy, cur[1] + dx) for dy, dx in N8 if (cur[0] + dy, cur[1] + dx) in pts and (cur[0] + dy, cur[1] + dx) != prev]
            if not nn: break
            prev, cur = cur, nn[0]; line.append(cur)
            if (prev, cur) in seen: break
            seen.add((prev, cur)); seen.add((cur, prev))
        return line
    for e in ends:
        for dy, dx in N8:
            q = (e[0] + dy, e[1] + dx)
            if q in pts and (e, q) not in seen: lines.append(walk(e, q))
    # closed loops without ends
    for p in pts:
        for dy, dx in N8:
            q = (p[0] + dy, p[1] + dx)
            if q in pts and (p, q) not in seen: lines.append(walk(p, q))
    out = []
    for l in lines:
        length = sum(np.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]) for i in range(1, len(l)))
        if length >= min_len: out.append([(x, y) for y, x in l])
    return out

def simplify(pts, tol):
    if len(pts) < 3: return pts
    a, b = np.array(pts[0]), np.array(pts[-1]); ab = b - a; L = np.hypot(*ab) or 1
    dmax, idx = 0, 0
    for i in range(1, len(pts) - 1):
        v = np.array(pts[i]) - a; dd = abs(ab[0] * v[1] - ab[1] * v[0]) / L
        if dd > dmax: dmax, idx = dd, i
    if dmax > tol: return simplify(pts[:idx + 1], tol)[:-1] + simplify(pts[idx:], tol)
    return [pts[0], pts[-1]]

def plen(l): return sum(np.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]) for i in range(1, len(l)))

def chains(skel, min_len, gap):
    """Skeleton → fragments between junctions → joined at touching ends → the ones long enough."""
    ls = join_ends(polylines(skel, 0), 4)
    ls = join_ends([l for l in ls if plen(l) >= 12], gap)
    return [l for l in ls if plen(l) >= min_len]

def join_ends(lines, gap):
    """Join polylines whose ends lie within `gap` px of each other (dotted trails, broken rivers), nearest pairs first."""
    from scipy.spatial import cKDTree
    lines = [list(l) for l in lines]
    while True:
        ends = []  # (x, y, line index, which end)
        for i, l in enumerate(lines): ends.append((*l[0], i, 0)); ends.append((*l[-1], i, 1))
        if not ends: return lines
        tree = cKDTree([(e[0], e[1]) for e in ends]); pairs = tree.query_pairs(gap, output_type='ndarray')
        if len(pairs) == 0: return lines
        pairs = sorted(pairs.tolist(), key=lambda pr: np.hypot(ends[pr[0]][0] - ends[pr[1]][0], ends[pr[0]][1] - ends[pr[1]][1]))
        used, merged, drop = set(), [], set()
        for ia, ib in pairs:
            ea, eb = ends[ia], ends[ib]
            if ea[2] == eb[2] or ea[2] in used or eb[2] in used: continue
            used.add(ea[2]); used.add(eb[2])
            A = lines[ea[2]] if ea[3] == 1 else lines[ea[2]][::-1]   # A ends at the joint
            B = lines[eb[2]] if eb[3] == 0 else lines[eb[2]][::-1]   # B starts at the joint
            merged.append(A + B); drop.add(ea[2]); drop.add(eb[2])
        if not merged: return lines
        lines = [l for i, l in enumerate(lines) if i not in drop] + merged

def densify(pts, step):
    """Points along a polyline every `step` miles, so distances measure to the line and not just its vertices."""
    out = [pts[0]]
    for a, b in zip(pts[:-1], pts[1:]):
        n = max(1, int(np.hypot(*(b - a)) / step))
        for i in range(1, n + 1): out.append(a + (b - a) * i / n)
    return np.array(out)

def name_by(lines, refs, default, gate=0.6):
    """Name each derived line after the base line that lies nearest it."""
    out = []
    for l in lines:
        pts = np.array([mi(*p) for p in l], float); best, bd = default, 1e9
        for ref in refs:
            rp = densify(np.array(ref['pts'], float), 0.08)
            dd = np.linalg.norm(pts[:, None, :] - rp[None, :, :], axis=2).min(1).mean()
            if dd < bd: bd, best = dd, ref['name']
        out.append((best if bd < gate else default, l))
    return out

# ------------------------------------------------------------------ roads
rm = road_m.copy()
for q in pin_px:  # blank the pin discs so the letters don't become road
    y0, y1, x0, x1 = int(q[1]) - 30, int(q[1]) + 31, int(q[0]) - 30, int(q[0]) + 31
    rm[max(0, y0):y1, max(0, x0):x1] = False
rm[:top + 4] = rm[bottom - 4:] = False; rm[:, :left + 4] = False; rm[:, right - 4:] = False
solid = ndi.binary_opening(ndi.binary_closing(rm, iterations=3), iterations=2)
dotted = ndi.binary_closing(rm, iterations=14) & ~ndi.binary_dilation(solid, iterations=6)
roads = []
for mask, kind in ((solid, 'road'), (dotted, 'trail')):
    sk = thin(ndi.binary_opening(mask, iterations=1) if kind == 'road' else mask)
    print(kind, 'mask px', int(mask.sum()), 'skeleton px', int(sk.sum()))
    ls = chains(sk, 60, 30 if kind == 'road' else 60)
    print(kind, 'polylines', len(ls))
    for name, l in name_by(ls, base['roads'], 'Old Svalich Road' if kind == 'road' else 'Trail'):
        if kind == 'trail' and 'trail' not in name.lower() and 'Trail' != name: name = name if name == 'Trail' else name
        roads.append(OrderedDict(name=name if kind == 'road' or name != 'Trail' else 'Trail', kind=kind, pts=[mi(*p) for p in simplify(l, 5)]))
print('roads', len(roads), sorted({r['name'] for r in roads}))

# ------------------------------------------------------------------ water: lakes and rivers
wm = ndi.binary_closing(water_m, iterations=2)
wm[:top + 4] = wm[bottom - 4:] = False; wm[:, :left + 4] = False; wm[:, right - 4:] = False
lab, n = ndi.label(wm); areas = ndi.sum(wm, lab, range(1, n + 1))
lakes, river_mask = [], np.zeros_like(wm)
for i, a in enumerate(areas):
    comp = lab == i + 1
    ys, xs = np.nonzero(comp); w, h = np.ptp(xs), np.ptp(ys)
    if a > 2500 and a / max(1, w * h) > 0.35:  # a body of water, not a ribbon
        lakes.append((xs.mean(), ys.mean(), w / 2, h / 2, a))
    elif a > 150: river_mask |= comp
LAKE_NAMES = {l['name']: l['center'] for l in base['lakes']}
lake_out = []
for x, y, rx, ry, a in sorted(lakes, key=lambda l: -l[4]):
    c = mi(x, y); name = min(LAKE_NAMES, key=lambda nme: np.hypot(LAKE_NAMES[nme][0] - c[0], LAKE_NAMES[nme][1] - c[1]))
    if np.hypot(LAKE_NAMES[name][0] - c[0], LAKE_NAMES[name][1] - c[1]) > 1.2: name = 'tarn'
    lake_out.append(OrderedDict(name=name, center=c, r=[round(rx / s, 2), round(ry / s, 2)]))
print('lakes', [(l['name'], l['r']) for l in lake_out])
print('river mask px', int(river_mask.sum()), 'water px', int(wm.sum()), 'bodies', len(lakes))
rsk = thin(ndi.binary_closing(river_mask, iterations=6)); print('river skeleton px', int(rsk.sum()))
# the hand-measured courses stay (they run the whole way); the traced ribbons add the bends the page shows
rivers = [OrderedDict(r) for r in base['rivers']] + [OrderedDict(name=name, pts=[mi(*p) for p in simplify(l, 6)]) for name, l in name_by(chains(rsk, 120, 90), base['rivers'], 'stream', 0.3) if name != 'stream']
lake_out = base['lakes']  # the named bodies, hand-measured; the grid below carries their shapes
# water for the grid: only what lies along a named river or lake (the pale hex-fill of the mountains reads blue too)
from PIL import ImageDraw as _ID
wmask = Image.new('L', (W, H), 0); _d = _ID.Draw(wmask)
for rv in rivers: _d.line([tuple(px(p)) for p in rv['pts']], fill=255, width=44)
for lk in lake_out:
    c = px(lk['center']); _d.ellipse((c[0] - lk['r'][0] * s * 1.15, c[1] - lk['r'][1] * s * 1.15, c[0] + lk['r'][0] * s * 1.15, c[1] + lk['r'][1] * s * 1.15), fill=255)
wm = wm & (np.asarray(wmask) > 0)
print('rivers', len(rivers), sorted({r['name'] for r in rivers}))

# ------------------------------------------------------------------ land cover grid
x0, y0 = mi(left, top); x1, y1 = mi(right, bottom)
bounds = OrderedDict(minX=x0, minY=y0, maxX=x1, maxY=y1)
cols_n, rows_n = int(np.ceil((x1 - x0) / CELL_MI)), int(np.ceil((y1 - y0) / CELL_MI))
cls = np.zeros((H, W), np.uint8)  # 0 open, 1 hills, 2 mountains, 3 forest, 4 water, 5 mist
cls[high_m] = 1; cls[high_m & (ridge_d > 0.16)] = 2; cls[forest_m] = 3; cls[mist_m] = 5; cls[wm] = 4
grid = []
CH = '.hmfwx'
for row in range(rows_n):
    line = ''
    for col in range(cols_n):
        X0, Y0 = px((x0 + col * CELL_MI, y0 + row * CELL_MI)); X1, Y1 = px((x0 + (col + 1) * CELL_MI, y0 + (row + 1) * CELL_MI))
        cell = cls[int(Y0):int(Y1), int(X0):int(X1)]
        if cell.size == 0: line += 'x'; continue
        cnt = np.bincount(cell.ravel(), minlength=6).astype(float)
        cnt[0] *= 0.5  # the ground between symbols is background, not a class of its own
        cnt[4] *= 2.5; cnt[5] *= 1.6  # water and mist are thin on the page but decisive
        line += CH[int(cnt.argmax())]
    grid.append(line)
print('grid', cols_n, 'x', rows_n, {c: sum(l.count(c) for l in grid) for c in CH})

# ------------------------------------------------------------------ labels from the page (page px → miles)
WOODS = [('Svalich Woods', (345, 525), -38), ('Svalich Woods', (1245, 365), -8), ('Svalich Woods', (480, 1060), -62), ('Svalich Woods', (300, 1650), -20),
         ('Svalich Woods', (2620, 870), 20), ('Svalich Woods', (2280, 1620), -22)]
PEAKS = [('Mount Baratok', (1980, 250)), ('Mount Ghakis', (1320, 1690)), ('Balinok Mountains', (650, 1180))]
RIVER_LABELS = [('Raven River', (300, 730), -2), ('Luna River', (330, 1400), 50), ('Ivlis River', (2300, 1440), 12), ('Tser Falls', (1690, 1130), 0)]

out = OrderedDict(schema=2, name=base['name'], page=base['page'], milesPerHex=base['milesPerHex'],
  note='Positions and land cover read from the regional map at 400 dpi; the art is painted from this data.',
  bounds=bounds, cellMiles=CELL_MI, cover=grid, pins=pins, roads=roads, rivers=rivers, lakes=lake_out,
  peaks=[OrderedDict(name=n, pos=mi(*p)) for n, p in PEAKS], high=base.get('high', []),
  woods=[OrderedDict(name=n, pos=mi(*p), angle=a) for n, p, a in WOODS],
  labels=[OrderedDict(name=n, pos=mi(*p), angle=a) for n, p, a in RIVER_LABELS])
json.dump(out, open(OUT, 'w'), indent=1)
print('wrote', OUT)

# debug overlay
from PIL import ImageDraw
pal = np.array([[150, 160, 140], [225, 225, 205], [255, 255, 255], [20, 70, 40], [80, 120, 220], [250, 250, 250]], np.uint8)
dbg = Image.fromarray(pal[cls]); dr = ImageDraw.Draw(dbg)
for rd in roads: dr.line([tuple(px(p)) for p in rd['pts']], fill=(220, 30, 30) if rd['kind'] == 'road' else (240, 140, 40), width=7)
for rv in rivers: dr.line([tuple(px(p)) for p in rv['pts']], fill=(0, 60, 220), width=7)
for p in pins: q = px(p['pos']); dr.ellipse((q[0] - 24, q[1] - 24, q[0] + 24, q[1] + 24), outline=(0, 255, 255), width=5)
dbg.resize((W // 3, H // 3)).save(f'{TMP}/debug.png')
