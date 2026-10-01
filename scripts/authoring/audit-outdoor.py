#!/usr/bin/env python3
"""Realism audit for outdoor maps: nothing stands where it could not.

Checks every level that carries terrain: house footprints (oriented rectangles from pos/rotY/dims) against
the street ribbons (cobble/dirt terrain polygons), the walls, each other, and the keyed site boxes; trees on
streets or inside houses; keyed site boxes with no building on them; objects off the ground polygon.
Usage: audit-outdoor.py [scene.json ...]   (default: every scene with terrain under locations/)"""
import json, math, os, sys, glob

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
BUILDING = {'house', 'church-building', 'temple', 'tower', 'inn', 'barn', 'hall'}
TREE = {'pine', 'oak', 'tree', 'willow'}
DEFAULT_DIMS = {'house': (24, 18), 'church-building': (60, 30), 'temple': (40, 30), 'well': (6, 6), 'wagon': (14, 8)}

def rect(o):
    """Corners of an object's footprint (world ft), turned by rotY (degrees about +y, as the kit builds it)."""
    d = o.get('dims', {}); w, dd = d.get('w'), d.get('d')
    if w is None or dd is None: w, dd = DEFAULT_DIMS.get(o['kind'], (6, 6))
    a = math.radians(o.get('rotY', 0)); c, s = math.cos(a), math.sin(a)
    x, z = o['pos'][0], o['pos'][2]
    return [[x + c * dx + s * dz, z - s * dx + c * dz] for dx, dz in ((-w / 2, -dd / 2), (w / 2, -dd / 2), (w / 2, dd / 2), (-w / 2, dd / 2))]

def inside(p, poly):
    x, z = p; c = False; n = len(poly)
    for i in range(n):
        (x0, z0), (x1, z1) = poly[i], poly[(i + 1) % n]
        if (z0 > z) != (z1 > z) and x < (x1 - x0) * (z - z0) / (z1 - z0) + x0: c = not c
    return c

def axes(poly):
    for i in range(len(poly)):
        (x0, z0), (x1, z1) = poly[i], poly[(i + 1) % len(poly)]
        L = math.hypot(x1 - x0, z1 - z0) or 1
        yield (-(z1 - z0) / L, (x1 - x0) / L)

def overlap(a, b, slack=0.0):
    """Separating-axis test for two convex polygons; `slack` lets them touch by that much."""
    for ax in list(axes(a)) + list(axes(b)):
        pa = [p[0] * ax[0] + p[1] * ax[1] for p in a]; pb = [p[0] * ax[0] + p[1] * ax[1] for p in b]
        if max(pa) - slack < min(pb) or max(pb) - slack < min(pa): return False
    return True

def seg_hits(a, b, poly):
    """Does segment a-b cross the convex polygon (or lie inside it)?"""
    if inside(a, poly) or inside(b, poly): return True
    def cross(o, p, q): return (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0])
    for i in range(len(poly)):
        c, d = poly[i], poly[(i + 1) % len(poly)]
        if (cross(a, b, c) > 0) != (cross(a, b, d) > 0) and (cross(c, d, a) > 0) != (cross(c, d, b) > 0): return True
    return False

def area(poly):
    return abs(sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1] for i in range(len(poly))) / 2)

def audit(path):
    s = json.load(open(path)); problems = []
    outdoor = s.get('kind') == 'placement'
    for lv in s['levels']:
        terrain = lv.get('terrain') or []
        if not terrain: continue
        ground = [t['polygon'] for t in terrain if t.get('floor') in ('grass', 'ground', 'moor', 'snow', 'sand', 'rock')]
        streets = [t['polygon'] for t in terrain if t.get('floor') in ('cobble', 'dirt', 'road', 'gravel', 'flagstone') and len(t['polygon']) <= 8]
        rooms = lv.get('rooms') or []; walls = lv.get('walls') or []
        objs = lv.get('objects') or []
        buildings = [(o, rect(o)) for o in objs if o['kind'] in BUILDING]
        # a patch of earth with a house standing in it is that house's yard, not a street
        streets = [st for st in streets if not any(inside([o['pos'][0], o['pos'][2]], st) for o, _ in buildings)]
        # 1. buildings on streets
        for o, r in buildings:
            for st in streets:
                if overlap(r, st, slack=1.0): problems.append(('building-on-street', o['id'], o['kind'], [round(v) for v in o['pos']])); break
        # 2. buildings through each other
        for i in range(len(buildings)):
            for j in range(i + 1, len(buildings)):
                if overlap(buildings[i][1], buildings[j][1], slack=0.5): problems.append(('building-overlap', buildings[i][0]['id'], buildings[j][0]['id'], [round(v) for v in buildings[i][0]['pos']]))
        # 3. walls through buildings
        for w in walls:
            for o, r in buildings:
                if seg_hits(w['a'], w['b'], r): problems.append(('wall-through-building', w['id'], o['id'], [round(v) for v in o['pos']]))
        # 4. buildings across a keyed site that is not theirs
        for o, r in buildings:
            for rm in rooms:
                if o.get('key') == rm['key']: continue
                if overlap(r, rm['polygon'], slack=0.5) and area(rm['polygon']) < 5000: problems.append(('building-in-keyed-site', o['id'], rm['key'], [round(v) for v in o['pos']]))
        # 5. keyed site boxes with nothing standing on them (a bare square of paving)
        for rm in rooms if outdoor else []:
            if rm.get('floor') in (None, 'dirt', 'grass'): continue
            if area(rm['polygon']) > 5000: continue  # a plaza or a camp is meant to be open
            if not any(o.get('key') == rm['key'] or overlap(r, rm['polygon']) for o, r in buildings) and not any(o.get('key') == rm['key'] for o in objs): problems.append(('empty-keyed-site', rm['key'], rm.get('name'), [round(v) for v in rm['polygon'][0]]))
        # 6. trees on streets or in buildings
        for o in objs:
            if o['kind'] not in TREE: continue
            p = [o['pos'][0], o['pos'][2]]
            if any(inside(p, st) for st in streets): problems.append(('tree-on-street', o['id'], o['kind'], [round(v) for v in o['pos']]))
            elif any(inside(p, r) for _, r in buildings): problems.append(('tree-in-building', o['id'], o['kind'], [round(v) for v in o['pos']]))
        # 7. anything off the ground
        if ground:
            for o in objs:
                p = [o['pos'][0], o['pos'][2]]
                if not any(inside(p, g) for g in ground) and o['kind'] not in ('pine',): problems.append(('off-ground', o['id'], o['kind'], [round(v) for v in o['pos']]))
    return problems

if __name__ == '__main__':
    paths = sys.argv[1:] or sorted(glob.glob(os.path.join(ROOT, 'locations', '*', '*', 'scene.json')))
    total = 0
    for p in paths:
        probs = audit(p)
        if not probs:
            if sys.argv[1:]: print(os.path.relpath(p, ROOT), 'clean')
            continue
        total += len(probs)
        from collections import Counter
        print(os.path.relpath(p, ROOT), dict(Counter(k for k, *_ in probs)))
        for pr in probs[:12]: print('   ', *pr)
        if len(probs) > 12: print('    …', len(probs) - 12, 'more')
    sys.exit(1 if total else 0)
