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
        if x0 == x1 or z0 == z1:
            steps = int(round(abs(x1 - x0) + abs(z1 - z0)))
            steps = max(1, steps)
            for k in range(steps):
                t0, t1 = k / steps, (k + 1) / steps
                out.append(((x0 + (x1 - x0) * t0, z0 + (z1 - z0) * t0), (x0 + (x1 - x0) * t1, z0 + (z1 - z0) * t1)))
        else:
            out.append(((x0, z0), (x1, z1)))
    return out

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
        segs = []
        for k, c in count.items():
            ov = self.overrides.get(k, {})
            if ov.get('open_wall'):
                continue
            a, b = k
            w = OrderedDict(id=ov.get('id') or f'{self.id}-w-{len(segs)}', a=[a[0] * C, a[1] * C], b=[b[0] * C, b[1] * C],
                            flags=ov.get('flags', ['normal']), material=ov.get('material') or (self.interior if c > 1 else self.exterior))
            if 'heightFt' in ov: w['heightFt'] = ov['heightFt']
            if 'door' in w['flags']: w['open'] = ov.get('open', False)
            segs.append((k, w))
        # a door or window stamped over several cells is one wall: fuse segments that share an override id
        by_id = {}
        for k, w in segs:
            if 'id' in self.overrides.get(k, {}): by_id.setdefault(w['id'], []).append((k, w))
        for wid, group in by_id.items():
            if len(group) < 2: continue
            pts = [tuple(w['a']) for _, w in group] + [tuple(w['b']) for _, w in group]
            lo, hi = min(pts), max(pts)
            keep = group[0][1]; keep['a'], keep['b'] = list(lo), list(hi)
            drop = set(k for k, _ in group[1:])
            segs = [(k, w) for k, w in segs if k not in drop]
        # merge collinear plain walls to keep the wall count down
        merged = []
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
                        if k2 in used or not plain(w2) or w2['material'] != cur['material']:
                            continue
                        dx1, dz1 = cur['b'][0] - cur['a'][0], cur['b'][1] - cur['a'][1]
                        dx2, dz2 = w2['b'][0] - w2['a'][0], w2['b'][1] - w2['a'][1]
                        if abs(dx1 * dz2 - dz1 * dx2) < 1e-9 and (dx1 * dx2 + dz1 * dz2) > 0:
                            nxt = (k2, w2); break
                    if not nxt:
                        break
                    used.add(nxt[0]); cur['b'] = nxt[1]['b']
            merged.append(cur)
        for i, w in enumerate(merged):
            if w['id'].startswith(f'{self.id}-w-'): w['id'] = f'{self.id}-w-{i}'
        for j, (a, b, kw) in enumerate(self.extra):
            w = OrderedDict(id=kw.get('id') or f'{self.id}-x-{j}', a=[a[0] * C, a[1] * C], b=[b[0] * C, b[1] * C], flags=kw.get('flags', ['normal']), material=kw.get('material', self.interior))
            if 'heightFt' in kw: w['heightFt'] = kw['heightFt']
            merged.append(w)
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

