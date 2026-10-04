#!/usr/bin/env python3
"""A heightfield for a region's world.json, so every outdoor map stands in the same logical topography.

With a land-cover grid (Barovia, read off the printed map) the ground rises by class: valley floor and forest
low, hills in the middle, mountains high, the mists on the rim higher still (the valley is walled in), water at
the bottom; the named peaks are true summits and the castle's rock a true crag. Without one (the Sheep Chase
country) the field is raised from the map's features: hills and the fell from the high points and peaks, the
stream in its cut. The field is smoothed so slopes read as land, not as cells. When the world sets `hydrology`
(Barovia), the water then finds its level: lakes flat and below their shores, rivers falling all the way from source
to mouth in their valleys, settlements on gentle aprons, the Amber Temple on its shelf and the Tsolenka road benched
in at an even grade (see hydrology()); the abbey's mountain above Krezk is raised after the valleys are cut. The
result is written as `height` rows (feet, relative to the lowest settlement) on the cover lattice; the app samples
them bilinearly (core/terrain.ts). Usage: heightfield.py <world.json> [...]"""
import json, sys, math
from collections import OrderedDict
import numpy as np
from scipy import ndimage as ndi

CLASS_FT = {'.': 140, 'f': 160, 'h': 900, 'm': 2600, 'w': -30, 'x': 3200}
PEAK_FT = {'Ghakis': 7400, 'Baratok': 7800, 'Balinok': 4200, 'Fell': 2600, 'Tor': 1800, 'Hill': 900}

# Mount Ghakis's shoulders (x, y miles, summit feet, spread miles). The Tsolenka road climbs along their north flank
# from the pass to the Amber Temple; the pass itself lies in the Luna River's gorge west of them, so the westernmost
# shoulder stands east and south-east of the bridge (not on it) and the land west of the gorge falls to Luna Lake. The
# temple is cut into the north face of the shoulder some 0.4 mi south of it: a ledge, the ground climbing gently for a
# few hundred feet behind it and then steeply up the massif. The ridge the road follows is kept low enough that the
# road climbs no steeper than ~19% (it is benched in at an even grade, see BENCH_ROADS).
GHAKIS_SHOULDERS = [(6.25, 11.3, 6600, 0.75), (5.65, 11.6, 4800, 0.55), (5.0, 11.2, 1900, 0.4), (3.85, 10.25, 1800, 0.45)]
# the abbey's mountain north and north-east of Krezk (offsets from the village pin in miles, feet, spread in miles): the
# land 3/4 to 1 1/4 miles north and north-east of the village stands some 650-760 ft (above the lowest town), so the
# abbey's own map meets it
KREZK_RIDGE = [(0.55, -0.6, 330, 0.45), (0.1, -0.9, 260, 0.4), (0.95, -0.85, 200, 0.4), (-0.05, -1.4, 250, 0.22), (0.75, -0.75, 80, 0.25)]
# rivers and lakes (when the world asks for it): a river's bed falls at least this much per mile from its source,
# its valley floor is this wide on each side, and its banks climb no steeper than these grades
RIVER_FALL_FT_PER_MI = 20
RIVER_FLOOR_MI, RIVER_BANK_MI, RIVER_BANK_GRADE, VALLEY_GRADE = 0.14, 0.25, 0.12, 0.30
BASIN_MI = 0.5      # a lake's basin: its sides climb at the valley grade this far from the shore, then at 45 deg
VALLEY_MI = 1.0     # a valley's sides climb at the valley grade this far from its river; beyond it, at up to 45 deg
GORGE_GRADE = 0.5   # the steepest valley side the last pass allows (where a road is cut into it)
# a settlement stands on a valley floor or a bench, not under a wall: within this radius the land around it rises no
# faster than this many feet per mile (a 6% apron)
APRON_MI, APRON_FT_PER_MI = 0.6, 290
APRON_TYPES = ('settlement', 'ruin', 'camp', 'tower')
APRON_KEYS = ('O',)   # Old Bonegrinder: the windmill stands on its own low hill, not under the mountain
APRON_SKIP = ('S',)   # Krezk lies in a bowl at the foot of the abbey's mountain, which rises from its walls
APRON_WALL_FT_PER_MI, APRON_WALL_MI = 1000, 0.5   # beyond the apron the land may climb at ~19% for half a mile
# sites cut into a mountainside (pin key: shelf radius mi, its grade, the flank's grade beyond, how far the flank runs, mi)
SHELVES = {'X': (0.3, 0.25, 0.5, 1.5)}   # the Amber Temple's ledge on Mount Ghakis
# roads cut into a mountainside at an even grade between two pins (road name, from pin, to pin), on a bench this wide
# (miles: full width, then blending out)
BENCH_ROADS = [('Tsolenka road', 'T', 'X')]
BENCH_MI = (0.12, 0.3)

def peak_height(name):
    for k, v in PEAK_FT.items():
        if k.lower() in name.lower(): return v
    return 3200

def build(world):
    b = world['bounds']; cell = world.get('cellMiles', 0.125)
    cols = int(math.ceil((b['maxX'] - b['minX']) / cell)); rows = int(math.ceil((b['maxY'] - b['minY']) / cell))
    X = b['minX'] + (np.arange(cols) + 0.5) * cell; Y = b['minY'] + (np.arange(rows) + 0.5) * cell
    gx, gy = np.meshgrid(X, Y)
    cover = world.get('cover')
    if cover:
        H = np.zeros((rows, cols))
        for r in range(rows):
            line = cover[r] if r < len(cover) else ''
            for c in range(cols): H[r, c] = CLASS_FT.get(line[c] if c < len(line) else 'x', 140)
        H = ndi.gaussian_filter(H, 1.6)
        # the valley floor is not a table: the land climbs away from the rivers and lakes toward the hills,
        # so every lowland town sits in a bowl with its water at the bottom
        water = np.zeros((rows, cols), bool)
        for r in range(rows):
            line = cover[r] if r < len(cover) else ''
            for c in range(cols): water[r, c] = (line[c] if c < len(line) else 'x') == 'w'
        for rv in world.get('rivers', []):
            pts = np.array(rv['pts'], float)
            for a, c2 in zip(pts[:-1], pts[1:]):
                dx, dy = c2 - a; L2 = dx * dx + dy * dy or 1e-9
                t = np.clip(((gx - a[0]) * dx + (gy - a[1]) * dy) / L2, 0, 1); d = np.hypot(gx - a[0] - dx * t, gy - a[1] - dy * t)
                water |= d < cell * 0.75
        if water.any():
            dist = ndi.distance_transform_edt(~water) * cell   # miles to the nearest water
            H += np.clip(dist, 0, 2.5) * 150                   # 150 ft per mile, up to 375 ft
        # the mists: beyond the frame the ground keeps rising (the valley has no way out)
        edge = np.minimum.reduce([gx - b['minX'], b['maxX'] - gx, gy - b['minY'], b['maxY'] - gy])
        H += np.clip((0.6 - edge) / 0.6, 0, 1) * 1800
    else:
        H = np.full((rows, cols), 120.0)
        for p in world.get('high', []):
            d = np.hypot(gx - p[0], gy - p[1]); H += 700 * np.exp(-(d * d) / (2 * 0.55 ** 2))
        for lk in world.get('lakes', []):
            d = np.hypot((gx - lk['center'][0]) / max(lk['r'][0], 0.05), (gy - lk['center'][1]) / max(lk['r'][1], 0.05)); H -= 120 * np.clip(1.2 - d, 0, 1)
        for rv in world.get('rivers', []):
            pts = np.array(rv['pts'], float)
            for a, c in zip(pts[:-1], pts[1:]):
                dx, dy = c - a; L2 = dx * dx + dy * dy or 1e-9
                t = np.clip(((gx - a[0]) * dx + (gy - a[1]) * dy) / L2, 0, 1); d = np.hypot(gx - a[0] - dx * t, gy - a[1] - dy * t)
                H -= 70 * np.exp(-(d * d) / (2 * 0.12 ** 2))
        H = ndi.gaussian_filter(H, 1.0)
    # named peaks are true summits
    for pk in world.get('peaks', []):
        # Mount Baratok is a single monolith (the module: its presence oppressive, the slopes climbing from the lake); broad
        h = peak_height(pk['name']); d = np.hypot(gx - pk['pos'][0], gy - pk['pos'][1]); sig = pk.get('spread', 1.25 if 'Baratok' in pk['name'] else 0.7 if h > 4000 else 0.5)
        H = np.maximum(H, H * 0.3 + h * np.exp(-(d * d) / (2 * sig ** 2)))
    # Mount Ghakis is a massif, not a cone: the Tsolenka road 'hugs Mount Ghakis, climbing to great heights' (p.157) and the
    # Amber Temple is carved into its snowy slope (p.182), so its shoulders run west from the summit along the pass
    # road, falling toward the Raven River (miles, peak feet, spread in miles)
    if any(pk['name'] == 'Mount Ghakis' for pk in world.get('peaks', [])):
        for sx, sy, h, sig in GHAKIS_SHOULDERS:
            d = np.hypot(gx - sx, gy - sy); H = np.maximum(H, H * 0.3 + h * np.exp(-(d * d) / (2 * sig ** 2)))
    # the abbey's mountain: Krezk lies in a bowl on its south-west foot, the Abbey of Saint Markovia higher up the
    # same mountain to the north-east (ch.8), so the land climbs that way and falls away west and south of the village.
    # It is raised after the valleys are cut (a mountain is not held to a river valley's slopes), before the last pass
    # of the water
    ridge = np.zeros_like(H)
    krezk = next((p for p in world.get('pins', []) if p['name'] == 'Village of Krezk'), None)
    if krezk and cover:
        d_pin = np.hypot(gx - krezk['pos'][0], gy - krezk['pos'][1])
        keep = np.clip((d_pin - 0.3) / 0.35, 0, 1); keep = keep * keep * (3 - 2 * keep)   # the village bowl is left as it is
        for dx, dy, h, sig in KREZK_RIDGE:
            d = np.hypot(gx - krezk['pos'][0] - dx, gy - krezk['pos'][1] - dy); ridge += keep * h * np.exp(-(d * d) / (2 * sig ** 2))
    # a site on its crag: a pillar of rock rising out of whatever stands there
    for p in world.get('pins', []):
        if p.get('heightFt'):
            d = np.hypot(gx - p['pos'][0], gy - p['pos'][1])
            base = H[np.unravel_index(np.argmin(d), d.shape)]
            # the land carries a broad shoulder to just under half the height; the sheer pillar above it is drawn as rock
            # (a cliff is far finer than this lattice can hold)
            H = np.where(d < 0.5, np.maximum(H, base + 0.45 * p['heightFt'] * np.clip(1 - (d - 0.05) / 0.42, 0, 1) ** 0.8), H)
    if cover and world.get('hydrology'):
        H = hydrology(world, H, gx, gy, cell, late=ridge)
    else:
        H = H + ridge
    # the lowest settlement is the datum
    sett = [p for p in world.get('pins', []) if p['type'] == 'settlement'] or world.get('pins', [])[:1]
    datum = min(float(H[min(rows - 1, max(0, int((p['pos'][1] - b['minY']) / cell))), min(cols - 1, max(0, int((p['pos'][0] - b['minX']) / cell)))]) for p in sett) if sett else float(H.min())
    H -= datum
    world['cellMiles'] = cell
    world['height'] = [[int(round(v / 10) * 10) for v in row] for row in H]
    return H

def _bilinear(H, gx0, gy0, cell, mx, my):
    rows, cols = H.shape
    fx = np.clip((np.asarray(mx) - gx0) / cell - 0.5, 0, cols - 1); fy = np.clip((np.asarray(my) - gy0) / cell - 0.5, 0, rows - 1)
    k0 = np.minimum(np.floor(fx).astype(int), cols - 2); r0 = np.minimum(np.floor(fy).astype(int), rows - 2); tx = fx - k0; ty = fy - r0
    return (H[r0, k0] * (1 - tx) + H[r0, k0 + 1] * tx) * (1 - ty) + (H[r0 + 1, k0] * (1 - tx) + H[r0 + 1, k0 + 1] * tx) * ty

def _resample(pts, step=0.03):
    """A polyline as evenly spaced samples: (points, arclength of each)."""
    out, s = [np.array(pts[0], float)], [0.0]
    for a, b in zip(pts[:-1], pts[1:]):
        a, b = np.array(a, float), np.array(b, float); L = float(np.hypot(*(b - a))); n = max(1, int(math.ceil(L / step)))
        for i in range(1, n + 1): out.append(a + (b - a) * i / n); s.append(s[-1] + L / n)
    return np.array(out), np.array(s)

def _nearest(gx, gy, P):
    """For every lattice cell: distance (miles) to the polyline through samples P, and the index of the nearest sample."""
    d = np.full(gx.shape, np.inf); idx = np.zeros(gx.shape, int)
    for i, (x, y) in enumerate(P):
        e = np.hypot(gx - x, gy - y); m = e < d; d[m] = e[m]; idx[m] = i
    return d, idx

def _in_lake(lk, x, y, k=1.0):
    return ((x - lk['center'][0]) / lk['r'][0]) ** 2 + ((y - lk['center'][1]) / lk['r'][1]) ** 2 < k * k

def _smooth(t):
    t = np.clip(t, 0, 1); return t * t * (3 - 2 * t)

def hydrology(world, H, gx, gy, cell, late=None):
    """Water finds its level: every lake is flat and lies below its shore; every river falls from its source to its
    mouth in a valley whose floor it runs on; and the settlements stand on aprons of gentle ground. Rivers flow from
    the first point of their hand-measured course (the first river of a name); the traced bends of the same name take
    that course's bed. A lake a river leaves is its source (the river starts at the lake's level); a lake a river ends
    in lies below the river's mouth, in a basin whose sides climb away from its shore. A river's `falls` ({at, ft,
    over}) drop its bed that much more over that length below the point (a run of falls through a gorge)."""
    b = world['bounds']; x0, y0 = b['minX'], b['minY']
    lakes = world.get('lakes', [])
    level = {}
    def lake_dn(lk):
        return np.hypot((gx - lk['center'][0]) / lk['r'][0], (gy - lk['center'][1]) / lk['r'][1])
    # a lake's water: its ellipse and the page's own water joined to it (the traced shore, its bays and arms), so no
    # water read off the page is left lying up a hillside beside a lake that has found its level
    rows_, cols_ = H.shape; cov = world.get('cover', [])
    wcov = np.array([[(cov[r][c] if r < len(cov) and c < len(cov[r]) else 'x') == 'w' for c in range(cols_)] for r in range(rows_)])
    # (a river's own water on the page is its channel, not the lake's: a lake does not spread down its outlet)
    for rv in world.get('rivers', []):
        P, _ = _resample(rv['pts'], cell / 3)
        for x, y in P: wcov &= np.hypot(gx - x, gy - y) >= cell * 0.75
    masks = {}
    def lake_mask(lk):
        if lk['name'] not in masks:
            dn = lake_dn(lk); core = dn < 1
            lab, _ = ndi.label(core | (wcov & (dn < 1.6)), structure=np.ones((3, 3)))
            ids = np.unique(lab[core]); masks[lk['name']] = np.isin(lab, ids[ids > 0]) | core
        return masks[lk['name']]
    def rim_min(lk, H):
        m = lake_mask(lk); dn = lake_dn(lk); band = max(0.15, 1.6 * cell / min(lk['r']))
        rim = (ndi.binary_dilation(m, structure=np.ones((3, 3), bool)) | ((dn >= 1) & (dn < 1 + band))) & ~m
        return float(H[rim].min()), m
    def ramp(d, wall=VALLEY_GRADE):   # feet above a river's bed or a lake's water at d miles from it
        bank = RIVER_BANK_GRADE if wall == VALLEY_GRADE else wall
        return (np.clip(d - RIVER_FLOOR_MI, 0, RIVER_BANK_MI - RIVER_FLOOR_MI) * bank + np.clip(d - RIVER_BANK_MI, 0, None) * wall
                + np.clip(d - VALLEY_MI, 0, None) * (1 - wall)) * 5280   # beyond the valley the mountains are their own
    def basin(H, lk):   # a lake's shores climb away from it, gently at first, then as steep as the mountains round it
        dn = lake_dn(lk); rad = np.hypot(gx - lk['center'][0], gy - lk['center'][1])
        d = np.where(dn > 1, rad * (1 - 1 / np.maximum(dn, 1e-6)), 0)
        # measured from the nearest water, the ellipse's or the page's (a cell's near edge is half a cell nearer)
        d = np.minimum(d, np.maximum(ndi.distance_transform_edt(~lake_mask(lk)) - 0.5, 0) * cell)
        return np.minimum(H, level[lk['name']] + 5 + ramp(d + RIVER_FLOOR_MI) + np.clip(d - BASIN_MI, 0, None) * 5280 * (1 - VALLEY_GRADE))
    for lk in lakes: level[lk['name']] = rim_min(lk, H)[0] - 5
    # the water stands at its level before any river leaves it (a river leaving a lake starts at the water, not the bed)
    for lk in lakes: H[lake_mask(lk)] = level[lk['name']]
    mains, seen = [], set()
    for rv in world.get('rivers', []):
        if rv['name'] not in seen: seen.add(rv['name']); mains.append(rv)
    def carve(H, P, bed, wall=VALLEY_GRADE):
        d, idx = _nearest(gx, gy, P)
        return np.minimum(H, bed[idx] + ramp(d, wall))
    def carve_bends(H, beds, wall=VALLEY_GRADE):
        # the traced bends: each point takes the bed of the course where it lies, falling the way the course falls
        for rv in world.get('rivers', []):
            if rv in mains or rv['name'] not in beds: continue
            Pm, bm = beds[rv['name']]; P, _ = _resample(rv['pts'])
            j = np.array([int(np.argmin(np.hypot(Pm[:, 0] - x, Pm[:, 1] - y))) for x, y in P])
            bed = bm[j]
            if bed[0] < bed[-1]: P, bed = P[::-1], bed[::-1]
            H = carve(H, P, np.minimum.accumulate(bed), wall)
        return H
    for _ in range(3):
        beds = {}
        for rv in mains:
            P, s = _resample(rv['pts'])
            h = _bilinear(H, x0, y0, cell, P[:, 0], P[:, 1])
            bed = np.empty(len(P)); src = [lk for lk in lakes if _in_lake(lk, *P[0], 1.15)]
            prev = min([h[0]] + [level[lk['name']] for lk in src])
            for i in range(len(P)):
                in_src = any(_in_lake(lk, *P[i], 1.15) for lk in src)
                fall = 0 if (i == 0 or in_src) else RIVER_FALL_FT_PER_MI * (s[i] - s[i - 1])
                prev = min(prev - fall, h[i]) if not in_src else min(prev, h[i]); bed[i] = prev
            for f in rv.get('falls', []):
                i0 = int(np.argmin(np.hypot(P[:, 0] - f['at'][0], P[:, 1] - f['at'][1])))
                below = s >= s[i0]
                bed[below] = np.minimum(bed[below], bed[i0] - f['ft'] * _smooth((s[below] - s[i0]) / f['over']) - RIVER_FALL_FT_PER_MI * (s[below] - s[i0]))
            bed = np.minimum.accumulate(bed)
            beds[rv['name']] = (P, bed)
            H = carve(H, P, bed)
        H = carve_bends(H, beds)
        # a lake a river runs into lies below the river's mouth; every lake lies in its basin, levelled
        for rv in mains:
            P, bed = beds[rv['name']]
            for lk in lakes:
                inside = [i for i in range(len(P)) if _in_lake(lk, *P[i])]
                if inside and not _in_lake(lk, *P[0], 1.15) and bed[inside[0]] - 5 < level[lk['name']]:
                    level[lk['name']] = bed[inside[0]] - 5
        for lk in lakes:
            H = basin(H, lk)
            _, inside = rim_min(lk, H)
            H[inside] = level[lk['name']]
    # aprons round the settlements (the pin's own height kept): gentle ground out to APRON_MI, a bench to the lattice's
    # reach beyond it (so the drawn surface, read between cells, keeps the apron), then slopes no steeper than ~19%
    for p in world.get('pins', []):
        if (p['type'] not in APRON_TYPES and p['key'] not in APRON_KEYS) or p['key'] in APRON_SKIP: continue
        d = np.hypot(gx - p['pos'][0], gy - p['pos'][1]); reach = APRON_MI + 1.45 * cell
        for _ in range(2):   # twice: lowering the ground round the pin lowers the pin's own (interpolated) height a little
            hp = float(_bilinear(H, x0, y0, cell, p['pos'][0], p['pos'][1]))
            H = np.minimum(H, hp + APRON_FT_PER_MI * np.minimum(d, APRON_MI) + APRON_WALL_FT_PER_MI * np.clip(d - reach, 0, None)
                           + 5280 * np.clip(d - reach - APRON_WALL_MI, 0, None))   # and the mountains beyond are their own
    # a site cut into a mountainside stands on a shelf: the ground behind it climbs gently at first, then no steeper than
    # a mountain's flank for a mile or so, before the massif is its own
    for key, (mi, g1, g2, reach) in SHELVES.items():
        p = next((q for q in world.get('pins', []) if q['key'] == key), None)
        if not p: continue
        d = np.hypot(gx - p['pos'][0], gy - p['pos'][1]); hp = float(_bilinear(H, x0, y0, cell, p['pos'][0], p['pos'][1]))
        H = np.minimum(H, hp + 5280 * (g1 * np.minimum(d, mi) + g2 * np.clip(d - mi, 0, reach - mi) + np.clip(d - reach, 0, None)))
    # roads that climb a mountainside are cut into it at an even grade (a bench), so no stretch is steeper than the whole;
    # where the road runs along a river's floor it stays there, and the bench starts where it leaves the valley floor
    pins = {q['key']: q for q in world.get('pins', [])}
    Pr = np.concatenate([beds[rv['name']][0] for rv in mains]) if mains else np.zeros((0, 2))
    for name, ka, kb in BENCH_ROADS:
        if ka not in pins or kb not in pins: continue
        A, B = np.array(pins[ka]['pos']), np.array(pins[kb]['pos'])
        piece = next((r for r in world.get('roads', []) if r['name'] == name and np.hypot(*(np.array(r['pts'][-1]) - B)) < 0.05), None)
        if not piece: continue
        pts = [list(A)] + piece['pts'] if np.hypot(*(np.array(piece['pts'][0]) - A)) > 0.05 else piece['pts']
        P, s = _resample(pts, 0.02)
        near = np.array([np.hypot(Pr[:, 0] - x, Pr[:, 1] - y).min() if len(Pr) else 9 for x, y in P]) < RIVER_FLOOR_MI + 0.05
        i0 = int(np.nonzero(near)[0].max()) + 1 if near[:len(P) // 2].any() else 0
        i0 = min(i0, len(P) - 2); P, s = P[i0:], s[i0:] - s[i0]
        hA, hB = (float(_bilinear(H, x0, y0, cell, *q)) for q in (P[0], B))
        prof = hA + (hB - hA) * s / s[-1]
        d, idx = _nearest(gx, gy, P); w = 1 - _smooth((d - BENCH_MI[0]) / (BENCH_MI[1] - BENCH_MI[0]))
        H = H + w * (prof[idx] - H)
    if late is not None: H = H + late   # the mountains raised after the valleys were cut
    # then the water once more, so nothing runs uphill; a lake never stands above the lowest point of its shore
    for rv in mains:
        P, bed = beds[rv['name']]; h = _bilinear(H, x0, y0, cell, P[:, 0], P[:, 1])
        H = carve(H, P, np.minimum(bed, np.minimum.accumulate(h)), GORGE_GRADE)   # a road's bench may stand on a gorge's side
        beds[rv['name']] = (P, np.minimum(bed, np.minimum.accumulate(h)))
    H = carve_bends(H, beds, GORGE_GRADE)
    for lk in lakes:
        rm, inside = rim_min(lk, H); level[lk['name']] = min(level[lk['name']], rm); H[inside] = level[lk['name']]
    return H

if __name__ == '__main__':
    for path in sys.argv[1:]:
        w = json.load(open(path), object_pairs_hook=OrderedDict)
        H = build(w)
        json.dump(w, open(path, 'w'), indent=1)
        print(path, 'height', H.shape, 'min', int(H.min()), 'max', int(H.max()), 'at pins:', {p['key']: int(H[min(H.shape[0]-1, max(0, int((p['pos'][1]-w['bounds']['minY'])/w['cellMiles']))), min(H.shape[1]-1, max(0, int((p['pos'][0]-w['bounds']['minX'])/w['cellMiles'])))]) for p in w['pins'][:12]})
