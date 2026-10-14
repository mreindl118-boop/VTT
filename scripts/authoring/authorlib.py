#!/usr/bin/env python3
"""Cell-based scene authoring shared by the hand-authored maps (Death House, the Sheep Chase tavern).
1 cell = 5 ft; walls are derived from room polygons, then doors/windows/openings are stamped over them."""
import json, os
from collections import OrderedDict

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
C = 5  # ft per cell

# ------------------------------------------------------------------ helpers
def rect(c0, r0, c1, r1):
    return [(c0, r0), (c1, r0), (c1, r1), (c0, r1)]

def ft(poly):
    return [[round(x * C, 3), round(z * C, 3)] for x, z in poly]

def seg_key(a, b):
    a, b = tuple(a), tuple(b)
    return (a, b) if a <= b else (b, a)

def unit_edges(poly):
    """Split polygon edges into 1-cell segments where axis-aligned; keep diagonals whole."""
    out = []
    n = len(poly)
    for i in range(n):
        (x0, z0), (x1, z1) = poly[i], poly[(i + 1) % n]
        if x0 == x1 and z0 == z1:
            continue  # Repeated polygon vertices have no boundary interval.
        if x0 == x1 or z0 == z1:
            steps = int(round(abs(x1 - x0) + abs(z1 - z0)))
            steps = max(1, steps)
            for k in range(steps):
                t0, t1 = k / steps, (k + 1) / steps
                out.append(((x0 + (x1 - x0) * t0, z0 + (z1 - z0) * t0), (x0 + (x1 - x0) * t1, z0 + (z1 - z0) * t1)))
        else:
            out.append(((x0, z0), (x1, z1)))
    return out


def _wall_intervals(count, overrides, extra):
    """Node coincident edges at every boundary/aperture end before applying overrides.

    Room edges need not use the same subdivision (half cells and diagonals are
    common). Grouping by supporting line avoids quadratic comparisons between
    unrelated walls. Rounding removes arithmetic noise far below the exported
    0.001-ft coordinate precision; it is not a geometric snapping tolerance.
    """
    groups, retained = {}, []
    portals = {'door', 'secret-door', 'window'}
    required, consumed = {}, {}

    def add(a, b, kind, order, data):
        a, b = seg_key(a, b)
        dx, dz = b[0] - a[0], b[1] - a[1]
        axis = 0 if abs(dx) >= abs(dz) else 1
        delta = b[axis] - a[axis]
        if abs(delta) < 1e-10:
            raise ValueError(f'Zero-length wall or override: {a} -> {b}')
        if (kind == 'extra' and data.get('flags', ['normal']) != ['normal']
                and not portals.intersection(data.get('flags', []))):
            # Independent movement/sight layers (e.g. invisible + ethereal) must
            # not overwrite each other or inherit room-boundary openings.
            retained.append(((order, (a, b), 0), (a, b), 0, data))
            return
        slope = (b[1 - axis] - a[1 - axis]) / delta
        line = (axis, round(slope, 10), round(a[1 - axis] - slope * a[axis], 8))
        lo, hi = sorted((a[axis], b[axis]))
        group = groups.setdefault(line, {'points': {}, 'edges': []})
        for p in (a, b):
            group['points'].setdefault(round(p[axis], 9), p)
        group['edges'].append((lo, hi, kind, order, data))
        if kind == 'override' and portals.intersection(data.get('flags', [])):
            required[order] = (hi - lo, data.get('id', data['flags']), (a, b))
            consumed[order] = 0

    for i, (k, c) in enumerate(count.items()):
        add(*k, 'room', i, c)
    for i, (a, b, kw) in enumerate(extra):
        add(a, b, 'extra', len(count) + i, kw)
    for i, (k, ov) in enumerate(overrides.items()):
        add(*k, 'override', i, ov)

    atoms = list(retained)
    for group in groups.values():
        coords = sorted(group['points'])
        for lo, hi in zip(coords, coords[1:]):
            mid = (lo + hi) / 2
            active = [e for e in group['edges'] if e[0] < mid < e[1]]
            sources = [e for e in active if e[2] != 'override']
            if not sources:
                continue
            ovs = [e for e in active if e[2] == 'override']
            c = sum(e[4] for e in sources if e[2] == 'room')
            extras = [e for e in sources if e[2] == 'extra']
            room_kw = {}
            for e in ovs:
                room_kw.update(e[4])
            # A physical door/window replaces only its own interval, including a
            # coincident extra partition. An outdoor opening cannot erase it.
            apertures = [e for e in sources + ovs if e[2] != 'room'
                         and portals.intersection(e[4].get('flags', []))]
            k = seg_key(group['points'][lo], group['points'][hi])
            first = min(e[3] for e in sources)
            if apertures:
                identity = lambda e: (e[4].get('id'), tuple(e[4]['flags']), e[4].get('open', False))
                if len({identity(e) for e in apertures}) > 1:
                    raise ValueError(f'Conflicting wall apertures: {[identity(e) for e in apertures]}')
                kw = {}
                for e in extras:
                    kw.update(e[4])
                kw.update(room_kw)
                kw.update(apertures[-1][4])
                kw.pop('open_wall', None)
                atoms.append(((first, k, 0), k, c, kw))
                for e in apertures:
                    if e[2] == 'override':
                        consumed[e[3]] += hi - lo
            else:
                if c:
                    atoms.append(((first, k, 0), k, c, room_kw))
                # Explicit partitions, counters and rails are independent of
                # room outlines. Only a physical aperture above cuts them.
                for e in extras:
                    atoms.append(((e[3], k, 1), k, 0, e[4]))
    missing = [f'{name} {segment}' for i, (length, name, segment) in required.items()
               if abs(consumed[i] - length) > 1e-7]
    if missing:
        raise ValueError('Unsupported or unconsumed aperture overrides: ' + '; '.join(missing))
    return [(k, c, kw) for _, k, c, kw in sorted(atoms, key=lambda a: a[0])]

class Level:
    def __init__(self, id, name, elevation, ceiling, ambient=None, interior='plaster', exterior='rubble', north='-x'):
        self.id, self.name, self.elevation, self.ceiling, self.ambient = id, name, elevation, ceiling, ambient
        self.north = north
        self.terrain = []   # (poly, floor) drawn under/around the rooms, no grid
        self.interior, self.exterior = interior, exterior
        self.rooms = []      # (key, name, poly, floor, extra)
        self.overrides = {}  # seg_key -> dict(flags=[...], open=bool, material, heightFt, id)
        self.objects = []
        self.lights = []
        self.floor_polys = []
        self.extra = []
        self.n = 0

    def room(self, key, name, poly, floor='plank', **extra):
        self.rooms.append((key, name, poly, floor, extra))
        self.floor_polys.append(poly)

    def _stamp(self, a, b, **kw):
        """Stamp an override on every 1-cell segment along a->b (coordinates must be whole cells)."""
        (x0, z0), (x1, z1) = a, b
        steps = max(1, int(round(abs(x1 - x0) + abs(z1 - z0))))
        for k in range(steps):
            t0, t1 = k / steps, (k + 1) / steps
            key = seg_key((x0 + (x1 - x0) * t0, z0 + (z1 - z0) * t0), (x0 + (x1 - x0) * t1, z0 + (z1 - z0) * t1))
            self.overrides[key] = dict(self.overrides.get(key, {}), **kw)

    def wall(self, a, b, **kw):
        """Explicit extra wall (not derived from room polygons), e.g. a partition inside one keyed room."""
        self.extra.append((a, b, kw))

    def door(self, a, b, id=None, locked=False, open=False, double=False):
        self.n += 1
        flags = ['door'] + (['locked'] if locked else [])
        self._stamp(a, b, flags=flags, id=id or f'{self.id}-door-{self.n}', open=open, wall=True)

    def window(self, a, b):
        self._stamp(a, b, flags=['window'], wall=True)

    def opening(self, a, b):
        self._stamp(a, b, open_wall=True)

    def secret(self, a, b, id, label, key, kind='secret-panel', extra=False):
        self.n += 1
        wid = f'{self.id}-sd-{id}'
        if extra: self.extra.append((a, b, dict(flags=['secret-door'], id=wid)))
        else: self._stamp(a, b, flags=['secret-door'], id=wid, wall=True)
        (x0, z0), (x1, z1) = a, b
        self.obj(f'sdo-{id}', kind, ((x0 + x1) / 2, (z0 + z1) / 2), 'secret-door', key, label, wall=wid)

    def counter(self, a, b):
        """A bar counter or half wall: 3.5 ft high, blocks movement, not sight."""
        self._stamp(a, b, flags=['normal'], heightFt=3.5, wall=True, material='paneling')

    def railing(self, a, b):
        self._stamp(a, b, flags=['normal'], heightFt=3.5, wall=True, material='plaster')

    def obj(self, id, kind, pos, vis='player', key=None, label=None, rotY=0, size=None, dims=None, wall=None, y=0):
        o = OrderedDict(id=f'{self.id}-{id}', kind=kind, pos=[round(pos[0] * C, 3), y, round(pos[1] * C, 3)], vis=vis)
        if rotY: o['rotY'] = rotY
        if key: o['key'] = key
        if label: o['label'] = label
        if size: o['size'] = size
        if wall: o['wall'] = wall
        if dims: o['dims'] = dims
        self.objects.append(o)

    def creature(self, id, kind, pos, key, label, size='medium'):
        self.obj(id, kind, pos, 'hidden-creature', key, label, size=size)

    def hidden(self, id, kind, pos, key, label, rotY=0, dims=None):
        self.obj(id, kind, pos, 'hidden-object', key, label, rotY=rotY, dims=dims)

    def prop(self, id, kind, pos, key, rotY=0, dims=None, y=0):
        self.obj(id, kind, pos, 'player', key, rotY=rotY, dims=dims, y=y)

    def note(self, id, pos, key, text):
        self.obj(id, 'note', pos, 'dm-note', key, text)

    def light(self, id, pos, preset, bright, dim, y=6):
        self.lights.append(OrderedDict(id=f'{self.id}-l-{id}', pos=[pos[0] * C, y, pos[1] * C], preset=preset, bright=bright, dim=dim))

    def build_walls(self):
        # Every unit edge of every room; edges shared by two rooms are interior.
        count = {}
        for _, _, poly, _, _ in self.rooms:
            for a, b in unit_edges(poly):
                k = seg_key(a, b)
                count[k] = count.get(k, 0) + 1
        extra = [(a, b, dict(kw, id=kw.get('id') or f'{self.id}-x-{i}',
                            material=kw.get('material', self.interior)))
                 for i, (a, b, kw) in enumerate(self.extra)]
        segs, explicit = [], set()
        for k, (segment, c, ov) in enumerate(_wall_intervals(count, self.overrides, extra)):
            if ov.get('open_wall'):
                continue
            a, b = segment
            w = OrderedDict(id=ov.get('id') or f'{self.id}-w-{len(segs)}', a=[a[0] * C, a[1] * C], b=[b[0] * C, b[1] * C],
                            flags=ov.get('flags', ['normal']), material=ov.get('material') or (self.interior if c > 1 else self.exterior))
            if 'heightFt' in ov: w['heightFt'] = ov['heightFt']
            if 'door' in w['flags']: w['open'] = ov.get('open', False)
            segs.append((k, w))
            if 'id' in ov: explicit.add(k)
        # a door or window stamped over several cells is one wall: fuse segments that share an override id
        by_id = {}
        for k, w in segs:
            if k in explicit and any(f in w['flags'] for f in ('door', 'secret-door', 'window')):
                by_id.setdefault(w['id'], []).append((k, w))
        for wid, group in by_id.items():
            if len(group) < 2: continue
            ordered = sorted((tuple(w['a']), tuple(w['b'])) for _, w in group)
            start, end = ordered[0]
            dx, dz = end[0] - start[0], end[1] - start[1]
            for a, b in ordered[1:]:
                if (a != end or abs(dx * (b[1] - start[1]) - dz * (b[0] - start[0])) > 1e-7):
                    raise ValueError(f'Aperture {wid} must be contiguous and collinear; disjoint segments found')
                end = b
            if len({(tuple(w['flags']), w.get('open', False), w.get('heightFt')) for _, w in group}) > 1:
                raise ValueError(f'Conflicting states for aperture {wid}')
            pts = [tuple(w['a']) for _, w in group] + [tuple(w['b']) for _, w in group]
            lo, hi = min(pts), max(pts)
            keep = group[0][1]; keep['a'], keep['b'] = list(lo), list(hi)
            drop = set(k for k, _ in group[1:])
            segs = [(k, w) for k, w in segs if k not in drop]
        # merge collinear plain walls to keep the wall count down
        merged, anonymous = [], []
        used = set()
        by_start = {}
        for k, w in segs:
            by_start.setdefault(tuple(w['a']), []).append((k, w))
        def plain(w): return w['flags'] == ['normal'] and 'heightFt' not in w
        for k, w in segs:
            if k in used:
                continue
            used.add(k)
            cur = OrderedDict(w)
            if plain(w):
                while True:
                    nxt = None
                    for k2, w2 in by_start.get(tuple(cur['b']), []):
                        if (k2 in used or not plain(w2) or w2['material'] != cur['material']
                                or ((k in explicit or k2 in explicit) and w2['id'] != cur['id'])):
                            continue
                        dx1, dz1 = cur['b'][0] - cur['a'][0], cur['b'][1] - cur['a'][1]
                        dx2, dz2 = w2['b'][0] - w2['a'][0], w2['b'][1] - w2['a'][1]
                        if abs(dx1 * dz2 - dz1 * dx2) < 1e-9 and (dx1 * dx2 + dz1 * dz2) > 0:
                            nxt = (k2, w2); break
                    if not nxt:
                        break
                    used.add(nxt[0]); cur['b'] = nxt[1]['b']
            merged.append(cur)
            anonymous.append(k not in explicit)
        authored = {ov['id'] for ov in self.overrides.values() if 'id' in ov}
        authored.update(kw['id'] for _, _, kw in extra)
        reserved = authored | {w['id'] for w, anon in zip(merged, anonymous) if not anon}

        def available(base):
            candidate, part = base, 2
            while candidate in reserved:
                candidate = f'{base}-part-{part}'; part += 1
            reserved.add(candidate)
            return candidate

        for i, (w, anon) in enumerate(zip(merged, anonymous)):
            if anon:
                w['id'] = available(f'{self.id}-w-{i}')
        # A named ordinary partition may have been cut into disconnected pieces.
        # Keep its first identity and give the remaining pieces deterministic IDs;
        # never fuse them across the aperture or produce duplicate saved-state keys.
        reserved.update(w['id'] for w in merged)
        seen = set()
        for w in merged:
            wid = w['id']
            if wid in seen: w['id'] = available(wid)
            seen.add(w['id'])
        return merged

    def to_json(self):
        rooms = []
        for key, name, poly, floor, extra in self.rooms:
            r = OrderedDict(key=key, name=name, page=extra.get('page'), polygon=ft(poly), floor=floor)
            if extra.get('difficult'): r['difficult'] = True
            if extra.get('ceilingFt'): r['ceilingFt'] = extra['ceilingFt']
            rooms.append(r)
        lv = OrderedDict(id=self.id, name=self.name, elevationFt=self.elevation, ceilingFt=self.ceiling)
        if self.ambient: lv['ambient'] = self.ambient
        lv['north'] = self.north
        lv['rooms'] = rooms
        lv['walls'] = self.build_walls()
        lv['lights'] = self.lights
        lv['objects'] = self.objects
        if self.terrain: lv['terrain'] = [OrderedDict(polygon=ft(poly), floor=floor) for poly, floor in self.terrain]
        return lv


def cobwebs(lv, poly, key, y=7, n=2):
    """Cobwebs in the first `n` corners of a room polygon (dusty floors, dungeon)."""
    for i, (x, z) in enumerate(poly[:n]):
        cx = x + (0.35 if x <= min(q[0] for q in poly) else -0.35); cz = z + (0.35 if z <= min(q[1] for q in poly) else -0.35)
        lv.prop(f'web-{key}-{i}', 'cobweb', (cx, cz), key, dims={'s': 2.5, 'y': y})

def braces(lv, key, cells, axis):
    """Timber braces every 5 ft along a 1-cell tunnel: cells = list of (col,row); axis 'x' or 'z' = tunnel direction."""
    for i, (c, r) in enumerate(cells):
        lv.prop(f'brace-{key}-{c}-{r}', 'timber-brace', (c + 0.5, r + 0.5), key, rotY=0 if axis == 'z' else 90, dims={'w': 4.4, 'h': 7})

