"""Settle the buildings of an outdoor map so nothing stands where it could not: a house that straddles a street
is pushed back to its side of it, one that runs into another is nudged apart or dropped, one the palisade cuts
through is dropped, a roof blob the extraction merged into a terrace is split into houses, every keyed site
gets a building on it, and the ground covers everything. Used by the town and village generators; the
companion audit (`audit-outdoor.py`) checks the result."""
import math
from collections import OrderedDict

TERRACE_MAX = 46   # a footprint longer than this is several houses the roof extraction ran together
GAP = 4

def rect(o):
    d = o['dims']; w, dd = d['w'], d['d']
    a = math.radians(o.get('rotY', 0)); c, s = math.cos(a), math.sin(a)
    x, z = o['pos'][0], o['pos'][2]
    return [[x + c * dx + s * dz, z - s * dx + c * dz] for dx, dz in ((-w / 2, -dd / 2), (w / 2, -dd / 2), (w / 2, dd / 2), (-w / 2, dd / 2))]

def inside(p, poly):
    x, z = p; c = False; n = len(poly)
    for i in range(n):
        (x0, z0), (x1, z1) = poly[i], poly[(i + 1) % n]
        if (z0 > z) != (z1 > z) and x < (x1 - x0) * (z - z0) / (z1 - z0) + x0: c = not c
    return c

def _axes(poly):
    for i in range(len(poly)):
        (x0, z0), (x1, z1) = poly[i], poly[(i + 1) % len(poly)]
        L = math.hypot(x1 - x0, z1 - z0) or 1
        yield (-(z1 - z0) / L, (x1 - x0) / L)

def overlap(a, b, slack=0.0):
    for ax in list(_axes(a)) + list(_axes(b)):
        pa = [p[0] * ax[0] + p[1] * ax[1] for p in a]; pb = [p[0] * ax[0] + p[1] * ax[1] for p in b]
        if max(pa) - slack < min(pb) or max(pb) - slack < min(pa): return False
    return True

def seg_hits(a, b, poly):
    if inside(a, poly) or inside(b, poly): return True
    def cross(o, p, q): return (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0])
    for i in range(len(poly)):
        c, d = poly[i], poly[(i + 1) % len(poly)]
        if (cross(a, b, c) > 0) != (cross(a, b, d) > 0) and (cross(c, d, a) > 0) != (cross(c, d, b) > 0): return True
    return False

def centroid(poly): return [sum(p[0] for p in poly) / len(poly), sum(p[1] for p in poly) / len(poly)]

def split_terraces(houses):
    """A footprint longer than TERRACE_MAX becomes a row of houses along its length."""
    out = []
    for o in houses:
        w, d = o['dims']['w'], o['dims']['d']
        if o['kind'] != 'house': out.append(o); continue
        long_w = w >= d
        L = max(w, d)
        if L <= TERRACE_MAX: out.append(o); continue
        n = int(math.ceil(L / 34)); piece = (L - GAP * (n - 1)) / n
        a = math.radians(o.get('rotY', 0)); c, s = math.cos(a), math.sin(a)
        for k in range(n):
            t = -L / 2 + piece / 2 + k * (piece + GAP)
            dx, dz = (t, 0) if long_w else (0, t)
            q = OrderedDict(o); q['id'] = f"{o['id']}{'abcdefgh'[k]}"
            q['pos'] = [round(o['pos'][0] + c * dx + s * dz, 1), 0, round(o['pos'][2] - s * dx + c * dz, 1)]
            q['dims'] = OrderedDict(o['dims']); q['dims']['w' if long_w else 'd'] = round(piece, 1)
            out.append(q)
    return out

def settle(level, *, keyed=None, ground_margin=60, report=None):
    """Settle `level['objects']` in place. `keyed` maps a site key -> (w, d) of the building it must have."""
    rep = report if report is not None else {}
    objs = level['objects']; terrain = level.get('terrain') or []; walls = level.get('walls') or []; rooms = level.get('rooms') or []
    streets = [t['polygon'] for t in terrain if t.get('floor') in ('cobble', 'dirt', 'road', 'gravel', 'flagstone') and len(t['polygon']) <= 8]
    FOOT = {'church-building': (60, 30), 'temple': (40, 30)}
    for o in objs:
        if o['kind'] in FOOT and 'dims' not in o: o['dims'] = OrderedDict(w=FOOT[o['kind']][0], d=FOOT[o['kind']][1], _foot=True)
    houses = [o for o in objs if o['kind'] == 'house' or o['kind'] in FOOT]
    others = [o for o in objs if o['kind'] != 'house' and o['kind'] not in FOOT]
    houses = split_terraces(houses); rep['split'] = len(houses) - sum(1 for o in objs if o['kind'] == 'house')
    # 0. everything sits on the grid: footprints to the 5-ft lattice (half-cells for centres), walls turned in 45° steps
    for o in houses + others:
        if o['kind'] in ('pine', 'oak', 'tree', 'willow'): continue
        o['pos'][0] = round(o['pos'][0] / 2.5) * 2.5; o['pos'][2] = round(o['pos'][2] / 2.5) * 2.5
        if 'rotY' in o: o['rotY'] = round(o['rotY'] / 45) * 45
        d = o.get('dims')
        if d and 'w' in d and 'd' in d and o['kind'] == 'house': d['w'] = max(10, round(d['w'] / 5) * 5); d['d'] = max(10, round(d['d'] / 5) * 5)
    fixed = [o for o in others if o['kind'] in ('tower',)]
    fixed_rects = [rect(o) if 'dims' in o else None for o in fixed]
    # 1. off the street: push a house back along the street's normal, up to 30 ft, else drop it
    kept = []; rep['pushed'] = rep['dropped-street'] = 0
    for o in houses:
        r = rect(o); moved = 0.0
        for _ in range(30 if o.get('key') else 14):
            hit = next((st for st in streets if overlap(r, st, slack=0.5)), None)
            if hit is None: break
            # the street polygon's long axis gives the push direction (away from its centre)
            c = centroid(hit); e = max(((hit[i], hit[(i + 1) % len(hit)]) for i in range(len(hit))), key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][1] - ab[0][1]))
            ex, ez = e[1][0] - e[0][0], e[1][1] - e[0][1]; L = math.hypot(ex, ez) or 1; nx, nz = -ez / L, ex / L
            if (o['pos'][0] - c[0]) * nx + (o['pos'][2] - c[1]) * nz < 0: nx, nz = -nx, -nz
            sx, sz = (2.5 * (1 if nx > 0 else -1), 0) if abs(nx) >= abs(nz) else (0, 2.5 * (1 if nz > 0 else -1))
            o['pos'][0] = round(o['pos'][0] + sx, 1); o['pos'][2] = round(o['pos'][2] + sz, 1); moved += 2.5; r = rect(o)
        if (any(overlap(r, st, slack=0.5) for st in streets) or moved > (72 if o.get('key') else 30)) and not o.get('key'): rep['dropped-street'] += 1; continue
        if moved: rep['pushed'] += 1
        kept.append(o)
    houses = kept
    # 2. the palisade and the fixed buildings win
    kept = []; rep['dropped-wall'] = rep['dropped-fixed'] = 0
    for o in houses:
        r = rect(o)
        if any(seg_hits(w['a'], w['b'], r) for w in walls) and not o.get('key'): rep['dropped-wall'] += 1; continue
        if any(fr and overlap(r, fr, slack=0.5) for fr in fixed_rects) and not o.get('key'): rep['dropped-fixed'] += 1; continue
        kept.append(o)
    houses = kept
    # 3. houses through each other: nudge the later one away, else drop it (bigger and keyed houses first)
    houses.sort(key=lambda o: (0 if o.get('key') else 1, -o['dims']['w'] * o['dims']['d']))
    placed = []; rep['nudged'] = rep['dropped-overlap'] = 0
    for o in houses:
        r = rect(o); ok = True
        for _ in range(8):
            hit = next((p for p in placed if overlap(r, p[1], slack=0.5)), None)
            if hit is None: break
            dx, dz = o['pos'][0] - hit[0]['pos'][0], o['pos'][2] - hit[0]['pos'][2]; L = math.hypot(dx, dz) or 1
            sx, sz = (2.5 * (1 if dx > 0 else -1), 0) if abs(dx) >= abs(dz) else (0, 2.5 * (1 if dz > 0 else -1))
            o['pos'][0] = round(o['pos'][0] + sx, 1); o['pos'][2] = round(o['pos'][2] + sz, 1); r = rect(o); rep['nudged'] += 1
            if any(overlap(r, st, slack=0.5) for st in streets): ok = False; break
        if (not ok or any(overlap(r, p[1], slack=0.5) for p in placed)) and not o.get('key'): rep['dropped-overlap'] += 1; continue
        placed.append((o, r))
    houses = [p[0] for p in placed]
    # 3b. a last sweep: anything still touching a street after the nudging goes (keyed buildings stay)
    before = len(houses); houses = [o for o in houses if o.get('key') or not any(overlap(rect(o), st, slack=0.5) for st in streets)]; rep['dropped-street'] += before - len(houses)
    # 4. every keyed site has its building: a house on the box, turned with the nearest street, the box its footprint
    rep['added'] = 0
    for rm in rooms:
        k = rm.get('key'); spec = (keyed or {}).get(k)
        if not spec: continue
        poly = rm['polygon']; c = centroid(poly)
        has = next((o for o in houses + fixed if o.get('key') == k), None)
        if has is None:  # a house already standing on the box is the site's building
            on = [o for o in houses if overlap(rect(o), poly, slack=0.5)]
            if on:
                has = max(on, key=lambda o: o['dims']['w'] * o['dims']['d']); has['key'] = k; has['label'] = rm.get('name')
                for o in on:
                    if o is not has: houses.remove(o); rep['dropped-overlap'] += 1
        if has is None:
            # face the nearest street
            best, ang = None, 0.0
            for st in streets:
                e = max(((st[i], st[(i + 1) % len(st)]) for i in range(len(st))), key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][1] - ab[0][1]))
                sc = centroid(st); d = math.hypot(sc[0] - c[0], sc[1] - c[1])
                if best is None or d < best: best, ang = d, math.degrees(math.atan2(-(e[1][1] - e[0][1]), e[1][0] - e[0][0]))
            w, d, stories = spec
            has = OrderedDict(id=f'site-{k}', kind='house', pos=[round(c[0] / 2.5) * 2.5, 0, round(c[1] / 2.5) * 2.5], vis='player', key=k, label=rm.get('name'), rotY=round(ang / 45) * 45, dims=OrderedDict(w=w, d=d, h=13, stories=stories))
            # clear the ground: houses the site box or the new footprint touches move out of the way or go
            r = rect(has); before = len(houses)
            houses = [o for o in houses if not overlap(rect(o), r, slack=0.5)]
            rep['added'] += 1; rep['dropped-overlap'] += before - len(houses)
            houses.append(has)
        if 'dims' in has:
            rm['polygon'] = [[round(p[0], 1), round(p[1], 1)] for p in rect(has)]
            before = len(houses); houses = [o for o in houses if o is has or o.get('key') or not overlap(rect(o), rect(has), slack=0.5)]; rep['dropped-overlap'] += before - len(houses)
    # 5. trees never stand on a street or in a house
    rects = [rect(o) for o in houses] + [fr for fr in fixed_rects if fr]
    kept_others = []; rep['dropped-trees'] = 0
    for o in others:
        if o['kind'] in ('pine', 'oak', 'tree', 'willow'):
            p = [o['pos'][0], o['pos'][2]]
            if any(inside(p, st) for st in streets) or any(inside(p, r) for r in rects): rep['dropped-trees'] += 1; continue
        kept_others.append(o)
    for o in houses:
        if o.get('dims', {}).get('_foot'): del o['dims']
    level['objects'] = kept_others + houses
    # 6. the ground covers everything, with room to spare
    base = next((t for t in terrain if t.get('floor') in ('grass', 'ground', 'moor', 'snow', 'sand', 'rock')), None)
    if base is not None:
        xs = [p[0] for p in base['polygon']] + [o['pos'][0] for o in level['objects']]; zs = [p[1] for p in base['polygon']] + [o['pos'][2] for o in level['objects']]
        if min(xs) < min(p[0] for p in base['polygon']) or max(xs) > max(p[0] for p in base['polygon']) or min(zs) < min(p[1] for p in base['polygon']) or max(zs) > max(p[1] for p in base['polygon']):
            x0, x1, z0, z1 = min(xs) - ground_margin, max(xs) + ground_margin, min(zs) - ground_margin, max(zs) + ground_margin
            base['polygon'] = [[round(x0, 1), round(z0, 1)], [round(x1, 1), round(z0, 1)], [round(x1, 1), round(z1, 1)], [round(x0, 1), round(z1, 1)]]
            rep['ground-grown'] = True
    return rep
