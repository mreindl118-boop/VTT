#!/usr/bin/env python3
"""Walls with a body (scene Wall.thicknessFt), the authoring side. The app draws a wall that sets thicknessFt as a solid
centred on a->b, closes its joints and blocks along its faces (app/src/core/wallBody.ts). A generator that gives its
walls thickness uses this module to take that thickness out of the plan's space the way a builder would:

  (the generator's plan) for each wall, a thickness and a side: the body centred on the plan line (0), or borrowed
                  wholly from one side of it (+1 the wall's left, -1 its right), so a corridor or a stair keeps its width;
  apply(...)      writes thicknessFt and offsetFt (the body standing off its line to that side); every wall keeps its
                  plan line, so the joints are the plan's own and the app closes them;
  footprints(...) the bodies exactly as the app draws them (a port of app/src/core/wallBody.ts);
  inset_rooms(...) cuts each room's floor back to the faces of the walls round it (a door's opening stays floor, so
                  the party can stand in a doorway and pass), so the party never stands inside a wall.

Every coordinate is in feet, x east and z south, as in the scene. Needs shapely (as van-richten-tower.py does)."""
import math
from collections import OrderedDict
from shapely.geometry import LineString, Point, Polygon as SPoly
from shapely.ops import unary_union

EPS = 0.05          # ft: ends this close meet; a point this close to a line lies on it
DOORISH = ('door', 'secret-door')


def seg(w):
    (ax, az), (bx, bz) = w['a'], w['b']
    L = math.hypot(bx - ax, bz - az)
    if L < 1e-9:
        return (ax, az), (bx, bz), 0.0, (1.0, 0.0), (0.0, 1.0)
    u = ((bx - ax) / L, (bz - az) / L)
    return (ax, az), (bx, bz), L, u, (-u[1], u[0])   # n: the wall's left (u turned +90 degrees, as atan2 counts)


def drawn(w):
    return 'invisible' not in w['flags'] and 'ethereal' not in w['flags']


def on_line(p, w, tol=EPS):
    a, _, L, u, n = seg(w)
    rx, rz = p[0] - a[0], p[1] - a[1]
    return abs(rx * n[0] + rz * n[1]) <= tol, rx * u[0] + rz * u[1], L


def collinear(w1, w2, tol=EPS):
    return all(on_line(p, w1, tol)[0] for p in (w2['a'], w2['b'])) and seg(w1)[2] > 1e-9 and seg(w2)[2] > 1e-9


def cut_interval(w, s0, s1, min_len=0.25):
    """The pieces of w left when its stretch s0..s1 (ft along it from a) is taken out."""
    a, _, L, u, _n = seg(w)
    keep = [(0.0, min(L, s0)), (max(0.0, s1), L)]
    out = []
    for i, (k0, k1) in enumerate(q for q in keep if q[1] - q[0] > min_len):
        nw = OrderedDict(w)
        if i:
            nw['id'] = f"{w['id']}-{'pqrstuvw'[i]}"
        nw['a'] = [round(a[0] + u[0] * k0, 3), round(a[1] + u[1] * k0, 3)]
        nw['b'] = [round(a[0] + u[0] * k1, 3), round(a[1] + u[1] * k1, 3)]
        out.append(nw)
    return out


UNCUT = {'door', 'secret-door', 'window'}


def _cells(w, size=10.0):
    (ax, az), (bx, bz) = w['a'], w['b']
    for cx in range(math.floor((min(ax, bx) - EPS) / size), math.floor((max(ax, bx) + EPS) / size) + 1):
        for cz in range(math.floor((min(az, bz) - EPS) / size), math.floor((max(az, bz) + EPS) / size) + 1):
            yield cx, cz


def dedupe(walls, rank, tol=EPS):
    """Where two walls lie in one line over the same stretch (a tower's side on a room's edge), the one `rank` puts
    lower loses that stretch, so no two bodies stand in each other (no z-fighting). Doors, windows and secret doors are
    never cut. A wall within `tol` of another's line and parallel to it within a degree counts as in that line (a
    room's corner drawn a hair off a tower's side). Walls are taken in rank order (ties: the earlier first); the list
    keeps its order. Returns the new list and how many walls were cut."""
    order = sorted(range(len(walls)), key=lambda i: (-rank(walls[i]), i))
    kept, grid, result, cut = [], {}, {}, 0
    for i in order:
        w = walls[i]
        pieces = [w]
        if drawn(w) and not set(w['flags']) & UNCUT and seg(w)[2] > 1e-6:
            near = {k for c in _cells(w) for k in grid.get(c, ())}
            for k in sorted(near):
                hi = kept[k]
                nxt = []
                for p in pieces:
                    if not collinear(hi, p, tol) or abs(seg(hi)[3][0] * seg(p)[3][1] - seg(hi)[3][1] * seg(p)[3][0]) > math.sin(math.radians(1)):
                        nxt.append(p)
                        continue
                    ha, _, HL, hu, _ = seg(hi)
                    sa, sb = on_line(p['a'], hi)[1], on_line(p['b'], hi)[1]
                    o0, o1 = max(0.0, min(sa, sb)), min(HL, max(sa, sb))
                    if o1 - o0 <= 0.1:
                        nxt.append(p)
                        continue
                    pa, _, _, pu, _ = seg(p)
                    q = [(ha[0] + hu[0] * t - pa[0]) * pu[0] + (ha[1] + hu[1] * t - pa[1]) * pu[1] for t in (o0, o1)]
                    nxt += cut_interval(p, min(q), max(q))
                pieces = nxt
            if pieces != [w]:
                cut += 1
        result[i] = pieces
        for p in pieces:
            kept.append(p)
            for c in _cells(p):
                grid.setdefault(c, []).append(len(kept) - 1)
    return [p for i in range(len(walls)) for p in result[i]], cut


def split_at(walls, points):
    """Split every plain wall at the given points that lie on it (room corners, other walls' ends), so each piece has
    one room or void on each side along its whole length. Doors, windows and secret doors are left whole."""
    grid = {}
    for p in points:
        grid.setdefault((math.floor(p[0] / 10), math.floor(p[1] / 10)), []).append(p)
    out, n = [], 0
    for w in walls:
        a, _, L, u, _n = seg(w)
        if L < 1e-6 or set(w['flags']) & UNCUT:
            out.append(w)
            continue
        cuts = set()
        for c in _cells(w):
            for p in grid.get(c, ()):
                on, s, _ = on_line(p, w, 0.02)
                if on and 0.2 < s < L - 0.2:
                    cuts.add(round(s, 4))
        if not cuts:
            out.append(w)
            continue
        ks = [0.0] + sorted(cuts) + [L]
        for i in range(len(ks) - 1):
            nw = OrderedDict(w)
            if i:
                nw['id'] = f"{w['id']}-s{i}"
            nw['a'] = [round(a[0] + u[0] * ks[i], 3), round(a[1] + u[1] * ks[i], 3)]
            nw['b'] = [round(a[0] + u[0] * ks[i + 1], 3), round(a[1] + u[1] * ks[i + 1], 3)]
            out.append(nw)
        n += 1
    return out, n


def merge_runs(walls, same):
    """Fuse walls that continue one another in one line when `same(w1, w2)` (identical in every other way): fewer,
    longer bodies, the same solid."""
    out = list(walls)
    merged = 0
    changed = True
    while changed:
        changed = False
        ends = {}
        for i, w in enumerate(out):
            for e in ('a', 'b'):
                ends.setdefault((round(w[e][0], 2), round(w[e][1], 2)), []).append((i, e))
        for k, lst in ends.items():
            if len(lst) != 2:
                continue
            (i, ei), (j, ej) = lst
            if i == j or not same(out[i], out[j]) or not collinear(out[i], out[j]):
                continue
            wi, wj = out[i], out[j]
            far_i = wi['b'] if ei == 'a' else wi['a']
            far_j = wj['b'] if ej == 'a' else wj['a']
            # they must run on from each other, not double back
            if (far_i[0] - k[0]) * (far_j[0] - k[0]) + (far_i[1] - k[1]) * (far_j[1] - k[1]) >= 0:
                continue
            nw = OrderedDict(wi)
            nw['a'], nw['b'] = list(far_i), list(far_j)
            if seg(nw)[3][0] * seg(wi)[3][0] + seg(nw)[3][1] * seg(wi)[3][1] < 0:
                nw['a'], nw['b'] = nw['b'], nw['a']
            out = [w for m, w in enumerate(out) if m not in (i, j)] + [nw]
            merged += 1
            changed = True
            break
    return out, merged


def side_of(w, p):
    """+1 when p lies on the wall's left (its n side), -1 on its right."""
    a, _, _, _, n = seg(w)
    return 1 if (p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1] > 0 else -1


def depth(poly, p, d, limit=200.0):
    """How far from p (just inside poly) along d the polygon runs before its edge (ft)."""
    ray = LineString([p, (p[0] + d[0] * limit, p[1] + d[1] * limit)])
    inter = poly.intersection(ray)
    if inter.is_empty:
        return 0.0
    geoms = getattr(inter, 'geoms', [inter])
    best = 0.0
    for g in geoms:
        coords = list(g.coords)
        if not coords:
            continue
        if Point(coords[0]).distance(Point(p)) < 0.2 or Point(coords[-1]).distance(Point(p)) < 0.2:
            best = max(best, max(Point(c).distance(Point(p)) for c in coords))
    return best


def apply(walls, plan):
    """plan: wall id -> (thickness ft, side 0/+1/-1). Writes thicknessFt and, for a body borrowed wholly from one side,
    offsetFt (half the thickness, to that side): every wall keeps its line, so the joints stay the plan's own and the
    app closes them (app/src/core/wallBody.ts). Returns how many walls stand off their line."""
    off = 0
    for w in walls:
        if w['id'] not in plan:
            continue
        t, side = plan[w['id']]
        w['thicknessFt'] = round(t, 3)
        w.pop('offsetFt', None)
        if side:
            w['offsetFt'] = round(side * t / 2, 3)
            off += 1
    return off


def absorb_stubs(walls, most=1.0):
    """A plain piece shorter than `most` ft left between a door's (window's, secret door's) end and the corner of the
    wall it stands in (a door drawn a hair short of its tower side's corners) becomes part of the opening: the door runs
    to the corner, where its body meets the next wall's cleanly. Returns the walls and how many pieces went."""
    out, gone = list(walls), 0
    for d in [w for w in out if set(w['flags']) & UNCUT]:
        for e in ('a', 'b'):
            for s_ in [w for w in out if w is not d and not set(w['flags']) & UNCUT and drawn(w) and seg(w)[2] < most and collinear(d, w)]:
                near = [q for q in ('a', 'b') if math.hypot(s_[q][0] - d[e][0], s_[q][1] - d[e][1]) <= EPS]
                if not near:
                    continue
                far = 'b' if near[0] == 'a' else 'a'
                d[e] = list(s_[far]); out.remove(s_); gone += 1
                break
    return out, gone


def _meet_lines(p, u, q, v):
    """Where the line through p along u meets the line through q along v (None when near parallel)."""
    c = u[0] * v[1] - u[1] * v[0]
    if abs(c) < 0.17:   # within 10 degrees of parallel
        return None
    t = ((q[0] - p[0]) * v[1] - (q[1] - p[1]) * v[0]) / c
    return (p[0] + u[0] * t, p[1] + u[1] * t)


def _nodes(walls):
    """Wall ends that meet (within EPS): a list of (point, [(wall index, 'a' or 'b')])."""
    nodes = []
    for i, w in enumerate(walls):
        for e in ('a', 'b'):
            p = tuple(w[e])
            for q, ends in nodes:
                if math.hypot(q[0] - p[0], q[1] - p[1]) <= EPS:
                    ends.append((i, e)); break
            else:
                nodes.append((p, [(i, e)]))
    return nodes


def meet_bodies(walls):
    """A joint standing inside another wall's body, short of its line (a room's corner a foot inside a tower's ring,
    where the plan's rectangle and octagon nearly meet): every wall ending there runs on (or back) along its own line to
    that wall's line, where the app joins each to it as a T, instead of two bodies standing in one another. A joint on
    any other wall's line, or with a door's end in it, stays; a scrap of wall left wholly inside the host goes. Returns the
    walls, how many ends moved and how many scraps went."""
    fps = footprints(walls)
    polys = [SPoly(f).buffer(0) if f else None for f in fps]
    moved, scrap = 0, set()
    for P, ends in _nodes(walls):
        mine = {i for i, _ in ends}
        if any(set(walls[i]['flags']) & UNCUT or not _has_body(walls[i]) for i in mine):
            continue
        if any(j not in mine and on_line(P, v)[0] and -EPS <= on_line(P, v)[1] <= on_line(P, v)[2] + EPS for j, v in enumerate(walls)):
            continue
        host = next((j for j, v in enumerate(walls) if j not in mine and polys[j] is not None and not set(v['flags']) & UNCUT
                     and polys[j].buffer(-0.02).contains(Point(P))), None)
        if host is None:
            continue
        v = walls[host]
        va, _, Lv, vu, _vn = seg(v)
        to = {}
        for i, e in ends:
            w = walls[i]
            a, b, Lw, u, _n = seg(w)
            X = _meet_lines(a, u, va, vu)
            if X is None:
                break
            sv = (X[0] - va[0]) * vu[0] + (X[1] - va[1]) * vu[1]
            other = w['b'] if e == 'a' else w['a']
            if math.hypot(X[0] - other[0], X[1] - other[1]) < 1 and polys[host].buffer(0.05).contains(LineString([a, b])):
                to[(i, None)] = None   # a scrap of wall whose line lies wholly in the host's body: it goes
                continue
            if not (-EPS <= sv <= Lv + EPS) or math.hypot(X[0] - P[0], X[1] - P[1]) > v['thicknessFt'] or math.hypot(X[0] - other[0], X[1] - other[1]) < 1:
                break
            if sv <= EPS: X = tuple(v['a'])
            elif sv >= Lv - EPS: X = tuple(v['b'])
            to[(i, e)] = [round(X[0], 3), round(X[1], 3)]
        else:
            # a wall that runs on through the joint to the host's line carries it: the others stay, standing on its line
            through = [(i, e) for (i, e), X in to.items() if e is not None and
                       (X[0] - P[0]) * (P[0] - walls[i]['b' if e == 'a' else 'a'][0]) + (X[1] - P[1]) * (P[1] - walls[i]['b' if e == 'a' else 'a'][1]) > 1e-6]
            # (the one that lands on the host's corner first, then one of the host's stone, then the thickest)
            through.sort(key=lambda ie: (-(to[ie] in (list(v['a']), list(v['b']))), -(walls[ie[0]].get('material') == v.get('material')), -walls[ie[0]]['thicknessFt']))
            for (i, e), X in to.items():
                if e is None: scrap.add(i)
                elif not through or (i, e) == through[0]: walls[i][e] = X; moved += 1
    return [w for i, w in enumerate(walls) if i not in scrap], moved, len(scrap)


def collapse_stubs(walls, most=3.0):
    """A plain wall too short for its two corners (an octagon's side left a foot or two long between its diagonal and a
    room's wall, whose mitres would cross): it goes, and its two neighbours run on along their own lines to where they
    meet, so the corner is one mitred joint. Only where each end has just the one neighbour, at a real corner. Returns
    the walls and how many went."""
    short = []
    footprints(walls, short=short)
    gone = set()
    nodes = _nodes(walls)
    at = {}
    for P, ends in nodes:
        for i, e in ends: at[(i, e)] = ends
    for i in short:
        s_ = walls[i]
        if i in gone or set(s_['flags']) & UNCUT or seg(s_)[2] >= most:
            continue
        nb = []
        for e in ('a', 'b'):
            others = [(j, f) for j, f in at[(i, e)] if j != i]
            if len(others) != 1 or others[0][0] in gone or set(walls[others[0][0]]['flags']) & UNCUT:
                break
            nb.append(others[0])
        if len(nb) != 2 or nb[0][0] == nb[1][0]:
            continue
        (j, fj), (k, fk) = nb
        wj, wk = walls[j], walls[k]
        X = _meet_lines(seg(wj)[0], seg(wj)[3], seg(wk)[0], seg(wk)[3])
        if X is None or math.hypot(X[0] - (s_['a'][0] + s_['b'][0]) / 2, X[1] - (s_['a'][1] + s_['b'][1]) / 2) > most:
            continue
        oj, ok_ = wj['b' if fj == 'a' else 'a'], wk['b' if fk == 'a' else 'a']
        if math.hypot(X[0] - oj[0], X[1] - oj[1]) < 1 or math.hypot(X[0] - ok_[0], X[1] - ok_[1]) < 1:
            continue
        if any((X[0] - o[0]) * (w_[f][0] - o[0]) + (X[1] - o[1]) * (w_[f][1] - o[1]) <= 0 for w_, f, o in ((wj, fj, oj), (wk, fk, ok_))):
            continue   # the meeting lies behind a neighbour's far end
        # each neighbour keeps its direction (X lies on both lines), so only its length changes
        wj[fj] = [round(X[0], 3), round(X[1], 3)]; wk[fk] = [round(X[0], 3), round(X[1], 3)]
        gone.add(i)
    return [w for i, w in enumerate(walls) if i not in gone], len(gone)


def body(w):
    """The wall's body in plan, cut square at both ends (a quick stand-in; the floors are cut with footprints())."""
    t = w.get('thicknessFt')
    if not t or not drawn(w) or seg(w)[2] < 1e-6:
        return None
    a, b, _, _, n = seg(w); o = w.get('offsetFt', 0)
    return LineString([(a[0] + n[0] * o, a[1] + n[1] * o), (b[0] + n[0] * o, b[1] + n[1] * o)]).buffer(t / 2, cap_style=2, join_style=2)


def swallowed(walls):
    """Plain walls whose whole body stands inside thicker bodies (a passage's side inside a solid curtain): dropped."""
    out, dropped = [], 0
    bodies = [(w, body(w)) for w in walls]
    for w, b in bodies:
        if b is None or set(w['flags']) & {'door', 'secret-door', 'window'}:
            out.append(w)
            continue
        others = [ob for v, ob in bodies if v is not w and ob is not None and v.get('thicknessFt', 0) > w.get('thicknessFt', 0)]
        if others and unary_union(others).buffer(0.02).contains(b):
            dropped += 1
            continue
        out.append(w)
    return out, dropped


def inset_rooms(rooms, walls):
    """Cut every room's floor back to the faces of the drawn walls round it. A door's or a secret door's opening is not
    cut (it stays the floor of the rooms either side), so the party can stand in a doorway and pass. A room split in
    pieces keeps its largest; the rest are returned as plain floor (the grid's floor polygons) so no reachable floor is
    lost. Holes (a body standing free inside a room) are left to the body's own blockers."""
    fps = footprints(walls)
    solid = unary_union([SPoly(f).buffer(0) for w, f in zip(walls, fps) if f and not set(w['flags']) & set(DOORISH)])
    extra = []
    for r in rooms:
        poly = SPoly(r['polygon']).buffer(0)
        clear = poly.difference(solid)
        parts = [g for g in getattr(clear, 'geoms', [clear]) if not g.is_empty and g.area > 0.5]
        if not parts:
            continue
        parts.sort(key=lambda g: -g.area)
        r['polygon'] = ring(parts[0])
        extra += [ring(g) for g in parts[1:] if g.area >= 4]
    return extra


def ring(g):
    g = g.simplify(0.01, preserve_topology=True)
    pts = list(g.exterior.coords)[:-1]
    return [[round(x, 3), round(z, 3)] for x, z in pts]


# ------------------------------------------------------------------ the app's footprints (app/src/core/wallBody.ts)
# The same joints the app draws, so a floor cut back to the bodies here meets the bodies there exactly (a tower's
# mitred outer corner reaches into the room outside it). Keep the two in step: tests/castle-walls.test.ts checks that
# no floor of the castle stands inside a body the app draws.
JOIN_EPS = 0.05
STRAIGHT = math.radians(10)
MITRE_LIMIT = 3


def _has_body(w):
    return bool(w.get('thicknessFt')) and drawn(w)


def footprints(walls, grow=0.0, short=None):
    """Each wall's plan footprint (a list of points) with its joints closed, or None for a wall without a body. A wall
    too short for its joints' cuts is drawn square at both ends; `short`, a list, collects their indices."""
    n = len(walls)
    U, L, HL, HR, live = [], [], [], [], []
    for w in walls:
        dx, dz = w['b'][0] - w['a'][0], w['b'][1] - w['a'][1]
        l = math.hypot(dx, dz); ok = _has_body(w) and l > 1e-6
        live.append(ok); L.append(l); U.append((dx / l, dz / l) if ok else (1.0, 0.0))
        half = (w['thicknessFt'] + grow) / 2 if ok else 0.0; o = w.get('offsetFt', 0) if ok else 0.0
        HL.append(half + o); HR.append(half - o)
    left = lambda d: (-d[1], d[0])
    add = lambda a, b: (a[0] + b[0], a[1] + b[1])
    mul = lambda a, s: (a[0] * s, a[1] * s)
    sub = lambda a, b: (a[0] - b[0], a[1] - b[1])
    dot = lambda a, b: a[0] * b[0] + a[1] * b[1]
    cross = lambda a, b: a[0] * b[1] - a[1] * b[0]
    def meet(p, d, q, e):
        c = cross(d, e)
        if abs(c) < 1e-9: return None
        s = cross(sub(q, p), e) / c
        return add(p, mul(d, s))
    atA = lambda i, at=0: dict(wall=i, at=at, d=U[i], hl=HL[i], hr=HR[i])
    atB = lambda i, at=1: dict(wall=i, at=at, d=mul(U[i], -1), hl=HR[i], hr=HL[i])
    nodes, bucket = [], {}
    def node_at(p):
        bx, bz = math.floor(p[0] / 2), math.floor(p[1] / 2)
        for dz in (-1, 0, 1):
            for dx in (-1, 0, 1):
                for k in bucket.get((bx + dx, bz + dz), ()):
                    if math.hypot(nodes[k][0][0] - p[0], nodes[k][0][1] - p[1]) <= JOIN_EPS: return k
        nodes.append((tuple(p), [])); bucket.setdefault((bx, bz), []).append(len(nodes) - 1)
        return len(nodes) - 1
    for i, w in enumerate(walls):
        if not live[i]: continue
        nodes[node_at(w['a'])][1].append(atA(i))
        nodes[node_at(w['b'])][1].append(atB(i))
    segs = {}
    for i, w in enumerate(walls):
        if not live[i]: continue
        for c in _cells(w): segs.setdefault(c, []).append(i)
    for p, ends in nodes:
        mine = {e['wall'] for e in ends}
        for j in segs.get((math.floor(p[0] / 10), math.floor(p[1] / 10)), ()):
            if j in mine: continue
            rel = sub(p, walls[j]['a']); s = dot(rel, U[j])
            if s <= JOIN_EPS or s >= L[j] - JOIN_EPS or abs(cross(U[j], rel)) > JOIN_EPS: continue
            ends.append(atA(j, -1)); ends.append(atB(j, -1)); mine.add(j)
    def reach(e, p):
        if e['at'] != -1: return L[e['wall']]
        s = dot(sub(p, walls[e['wall']]['a']), U[e['wall']])
        return L[e['wall']] - s if dot(e['d'], U[e['wall']]) > 0 else s
    cuts = {}
    for p, E in nodes:
        rface = lambda e: add(p, mul(left(e['d']), -e['hr']))
        lface = lambda e: add(p, mul(left(e['d']), e['hl']))
        flat = lambda e: [rface(e), lface(e)]
        real = [e for e in E if e['at'] != -1]
        if not real: continue
        if len(E) == 1:
            cuts[(real[0]['wall'], real[0]['at'])] = flat(real[0]); continue
        through, best = None, -1
        for x in range(len(E)):
            for y in range(x + 1, len(E)):
                ex, ey = E[x], E[y]
                if ex['wall'] == ey['wall'] and ex['at'] != -1: continue
                if dot(ex['d'], ey['d']) > -math.cos(STRAIGHT): continue
                score = (1e6 if ex['at'] == -1 and ey['at'] == -1 else 0) + min(ex['hl'] + ex['hr'], ey['hl'] + ey['hr'])
                if score > best: best, through = score, (ex, ey)
        if through:
            t1, t2 = through; m = left(t1['d'])
            hi, lo = reach(t1, p), -reach(t2, p)
            for e in real:
                if e is t1 or e is t2: cuts[(e['wall'], e['at'])] = flat(e); continue
                if abs(dot(e['d'], m)) < math.sin(STRAIGHT): cuts[(e['wall'], e['at'])] = flat(e); continue
                fo = min(t1['hl'], t2['hr']) if dot(e['d'], m) > 0 else -min(t1['hr'], t2['hl'])
                face = add(p, mul(m, fo))
                r = meet(rface(e), e['d'], face, t1['d']); l = meet(lface(e), e['d'], face, t1['d'])
                if not (r and l): cuts[(e['wall'], e['at'])] = flat(e); continue
                sr, sl = dot(sub(r, p), t1['d']), dot(sub(l, p), t1['d'])
                inside = lambda x: lo - 1e-9 <= x <= hi + 1e-9
                if abs(fo) < 1e-9 or (inside(sr) and inside(sl)): cuts[(e['wall'], e['at'])] = [r, l]; continue
                at_ = lambda x, on_face: add(add(p, mul(t1['d'], x)), mul(m, fo if on_face else 0))
                cut = [r if inside(sr) else meet(rface(e), e['d'], p, t1['d'])]
                sg = 1 if sl > sr else -1
                for bnd in sorted([b_ for b_ in (hi, lo) if (b_ - sr) * (b_ - sl) < 0], key=lambda b_: b_ * sg):
                    into = inside(bnd + (sl - sr) * 1e-6)
                    cut += [at_(bnd, not into), at_(bnd, into)]
                cut.append(l if inside(sl) else meet(lface(e), e['d'], p, t1['d']))
                cuts[(e['wall'], e['at'])] = cut
            continue
        S = sorted(E, key=lambda e: math.atan2(e['d'][1], e['d'][0]))
        k = len(S); Lp, Rp = [None] * k, [None] * k
        for i in range(k):
            e, f = S[i], S[(i + 1) % k]
            el, fr = lface(e), rface(f)
            q = meet(el, e['d'], fr, f['d'])
            if q and math.hypot(q[0] - p[0], q[1] - p[1]) <= MITRE_LIMIT * max(e['hl'], e['hr'], f['hl'], f['hr']) * 2: Lp[i] = q; Rp[(i + 1) % k] = q
            else: Lp[i] = el; Rp[(i + 1) % k] = fr
        for i in range(k):
            e = S[i]
            if e['at'] == -1: continue
            cuts[(e['wall'], e['at'])] = [Rp[i], p, Lp[i]] if k >= 3 else [Rp[i], Lp[i]]
    out = []
    for i, w in enumerate(walls):
        if not live[i]: out.append(None); continue
        a, b, nrm, hl, hr = tuple(w['a']), tuple(w['b']), left(U[i]), HL[i], HR[i]
        ca = cuts.get((i, 0), [add(a, mul(nrm, -hr)), add(a, mul(nrm, hl))])
        cb = cuts.get((i, 1), [add(b, mul(nrm, hl)), add(b, mul(nrm, -hr))])
        poly = list(reversed(ca)) + list(reversed(cb))
        if _valid(poly): out.append(poly); continue
        if short is not None: short.append(i)
        out.append([add(a, mul(nrm, hl)), add(a, mul(nrm, -hr)), add(b, mul(nrm, -hr)), add(b, mul(nrm, hl))])
    return out


def _valid(poly):
    m = len(poly)
    cross = lambda a, b: a[0] * b[1] - a[1] * b[0]
    sub = lambda a, b: (a[0] - b[0], a[1] - b[1])
    def proper(p, q, a, b):
        d1, d2 = cross(sub(q, p), sub(a, p)), cross(sub(q, p), sub(b, p)); d3, d4 = cross(sub(b, a), sub(p, a)), cross(sub(b, a), sub(q, a))
        return ((d1 > 1e-9 and d2 < -1e-9) or (d1 < -1e-9 and d2 > 1e-9)) and ((d3 > 1e-9 and d4 < -1e-9) or (d3 < -1e-9 and d4 > 1e-9))
    for i in range(m):
        for j in range(i + 2, m):
            if i == 0 and j == m - 1: continue
            if proper(poly[i], poly[(i + 1) % m], poly[j], poly[(j + 1) % m]): return False
    return abs(sum(cross(poly[i], poly[(i + 1) % m]) for i in range(m))) > 1e-6
