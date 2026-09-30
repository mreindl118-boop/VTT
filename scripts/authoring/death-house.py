#!/usr/bin/env python3
"""Death House (Appendix B, map p.216, one square = 5 ft) -> locations/appB/death-house/{scene,grid}.json

Authored in CELLS from the book's map (1 cell = 5 ft); x = map right, z = map down. The map is printed
with north to the LEFT, so `north: "-x"`. Only keys, names, page refs, dimensions and placements live here.
Walls are derived from room polygons, then doors/windows/openings/secret doors are stamped over them.
"""
import json, os, sys
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
    def __init__(self, id, name, elevation, ceiling, ambient=None, interior='plaster', exterior='rubble'):
        self.id, self.name, self.elevation, self.ceiling, self.ambient = id, name, elevation, ceiling, ambient
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
        lv['north'] = '-x'
        lv['rooms'] = rooms
        lv['walls'] = self.build_walls()
        lv['lights'] = self.lights
        lv['objects'] = self.objects
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

# ------------------------------------------------------------------ pages (printed) from the OCR report when available
pages = {}
try:
    pj = json.load(open(os.path.join(ROOT, 'reference', 'pages.json')))
    pages = {k.split('/')[1]: v for k, v in pj.items() if k.startswith('death-house/')}
except Exception:
    pass
# Printed pages of the keyed descriptions (Appendix B), verified against the OCR.
PAGE = {**{k: 212 for k in ['1', '2']}, **{k: 213 for k in ['3', '4', '5', '6', '7', '8']}, **{k: 214 for k in ['9', '10', '11', '12']},
        **{k: 215 for k in ['13', '14', '15', '16', '17', '18', '19', '20']}, **{k: 217 for k in ['21', '22', '23']},
        **{k: 218 for k in ['24', '25', '26']}, **{k: 219 for k in ['27', '28', '29', '30', '31', '32', '33', '34', '35']},
        **{k: 220 for k in ['36', '37', '38']}}
for k, v in pages.items():
    if v: PAGE[k] = v
def pg(key):
    base = ''.join(ch for ch in key if ch.isdigit())
    return PAGE.get(key) or PAGE.get(base)

# ================================================================== FIRST FLOOR (10-ft ceilings)
f1 = Level('f1', 'Floor 1', 0, 10, ambient='interior-dim', interior='paneling', exterior='brick')
f1.room('1A', 'Entrance (portico)', rect(0, 10, 2, 11), 'flagstone', page=pg('1'))
f1.room('1B', 'Entrance (foyer)', rect(0, 7, 2, 10), page=pg('1'))
f1.room('3', 'Den of Wolves', rect(2, 7, 6, 11), page=pg('3'))
f1.room('2A', 'Main Hall', [(0, 4), (3, 4), (3, 3), (4, 3), (4, 4), (6, 4), (6, 7), (0, 7)], page=pg('2'))
f1.room('2B', 'Cloakroom', rect(2, 3, 3, 4), page=pg('2'))
f1.room('5', 'Dining Room', [(0, 0), (4, 0), (4, 3), (2, 3), (2, 4), (1, 4), (1, 3), (0, 3)], page=pg('5'))
f1.room('4A', 'Kitchen', rect(4, 1, 6, 4), 'flagstone', page=pg('4'))
f1.room('4B', 'Pantry', rect(4, 0, 6, 1), 'flagstone', page=pg('4'))
# doors
f1.door((0, 11), (1, 11), id='f1-gate')            # wrought-iron gate (portico)
f1.door((0, 10), (1, 10), id='f1-front-doors')     # oaken doors into the foyer
f1.door((0, 7), (1, 7), id='f1-foyer-hall')        # stained-glass double doors to 2A
f1.door((2, 7), (3, 7))                                # 2A -> 3
f1.door((1, 4), (2, 4))                                # 5 -> 2A
f1.door((3, 3), (4, 3))                                # 5 -> 2A corridor cell
f1.door((2, 4), (3, 4))                                # 2A -> 2B
f1.door((4, 3), (4, 4))                                # 2A -> 4A
f1.door((4, 1), (5, 1))                            # 4A -> 4B (thin door)
# windows (hinged, swing outward)
for a, b in [((0, 0), (1, 0)), ((2, 0), (3, 0)), ((5, 0), (6, 0)), ((0, 1), (0, 2)), ((0, 5), (0, 6)), ((6, 8), (6, 9)), ((3, 11), (4, 11)), ((4, 11), (5, 11))]:
    f1.window(a, b)
# props (module descriptions, area by area)
f1.prop('gate-iron', 'gate', (0.5, 11), '1A'); f1.prop('lamp1a', 'oil-lamp', (0.3, 10.5), '1A', dims={'y': 7}); f1.prop('lamp1b', 'oil-lamp', (1.7, 10.5), '1A', dims={'y': 7})
f1.prop('shield', 'shield-of-arms', (1.9, 8.5), '1B', rotY=-90); f1.prop('portrait1', 'portrait', (1.9, 7.6), '1B', rotY=-90); f1.prop('portrait2', 'portrait', (1.9, 9.4), '1B', rotY=-90)
f1.prop('fire2a', 'fireplace', (0.25, 4.7), '2A', rotY=90); f1.obj('sword', 'wall-sword', (0.35, 4.7), 'player', '2A', 'Longsword', rotY=90, dims={'y': 7.2})
f1.prop('spiral', 'spiral-stair', (5.1, 5.5), '2A', dims={'rise': 10, 'r': 6})
f1.prop('hooks2b', 'cloak-hooks', (2.5, 3.15), '2B')
f1.prop('fire3', 'fireplace', (5.75, 9.5), '3', rotY=-90); f1.prop('stag', 'stag-head', (5.6, 9.5), '3', rotY=-90)
[f1.prop(f'wolf{i}', 'stuffed-wolf', p, '3', rotY=r) for i, (p, r) in enumerate([((2.5, 7.5), 40), ((4.2, 7.4), -20), ((5.4, 10.6), 160)])]
f1.prop('fur-a', 'chair', (5, 8.8), '3', rotY=-90); f1.prop('fur-b', 'chair', (5, 10.2), '3', rotY=-90); f1.prop('oak-table', 'table', (4.7, 9.5), '3', dims={}); f1.prop('cask', 'wine-cask', (4.7, 9.5), '3'); f1.prop('candelabrum', 'candlestick', (4.3, 9.3), '3', dims={'h': 2.6})
f1.prop('chandelier3', 'chandelier', (3.3, 9.6), '3', dims={'y': 8})
f1.prop('den-table', 'table', (3.3, 9.6), '3'); [f1.prop(f'denchair{i}', 'chair', p, '3', rotY=r) for i, (p, r) in enumerate([((2.7, 8.9), 135), ((3.9, 8.9), -135), ((2.7, 10.3), 45), ((3.9, 10.3), -45)])]
f1.prop('cab-e', 'cabinet', (5.7, 8.2), '3', rotY=-90); f1.prop('cab-n', 'cabinet', (2.3, 8.3), '3', rotY=90)
f1.hidden('cab-lock', 'crossbow-rack', (5.45, 8.2), '3', 'Locked east cabinet: crossbows (DC 15)', rotY=-90)
f1.prop('den-goblets', 'tabletop', (4.7, 9.5), '3', dims={'set': 3, 'y': 3})
f1.hidden('trapdoor', 'trapdoor', (5.5, 10.5), '3', 'Hidden trapdoor to 32 (only from below)')
f1.prop('table', 'table', (2, 1.5), '5'); [f1.prop(f'chair{i}', 'chair', p, '5', rotY=r) for i, (p, r) in enumerate([((1.2, 0.7), 180), ((2, 0.7), 180), ((2.8, 0.7), 180), ((1.2, 2.3), 0), ((2, 2.3), 0), ((2.8, 2.3), 0), ((0.7, 1.5), 90), ((3.3, 1.5), -90)])]
f1.prop('chandelier5', 'chandelier', (2, 1.5), '5', dims={'y': 8, 'crystal': 1}); f1.prop('fire5', 'fireplace', (0.25, 2.5), '5', rotY=90); f1.prop('painting5', 'portrait', (0.4, 2.5), '5', rotY=90, dims={'landscape': 1, 'w': 3, 'h': 2, 'y': 7.5})
f1.prop('silver5', 'tabletop', (2, 1.5), '5', dims={'set': 0, 'y': 3}); f1.prop('tapestry5', 'tapestry', (3.85, 1.5), '5', rotY=-90); f1.prop('drapes5a', 'drapes', (0.5, 0.1), '5'); f1.prop('drapes5b', 'drapes', (2.5, 0.1), '5'); f1.prop('drapes5c', 'drapes', (0.1, 1.5), '5', rotY=90)
f1.prop('oven', 'oven', (5.2, 1.4), '4A'); f1.prop('worktable', 'table', (4.8, 2.5), '4A', rotY=90); f1.prop('shelves4a', 'shelves', (4.15, 1.8), '4A', rotY=90, dims={'w': 5})
f1.prop('dumbwaiter', 'dumbwaiter-shaft', (5.7, 3.7), '4A', rotY=180); f1.prop('bell4a', 'brass-bell', (5.2, 3.9), '4A', rotY=180, dims={'y': 5}); f1.prop('pots4a', 'hanging-pots', (4.8, 2.5), '4A', rotY=90, dims={'w': 6}); f1.prop('sacks4b', 'sacks', (4.6, 0.65), '4B'); f1.prop('shelves4b', 'shelves', (5, 0.15), '4B', dims={'w': 8, 'food': 1})
f1.hidden('shaft-f1', 'dumbwaiter', (0.5, 3.5), '21', 'Secret stair shaft (21) passes here')
f1.obj('spawn', 'spawn', (1.5, 10.5), 'dm-note', '1A', 'Party spawn: portico (Rose & Thorn wait here)')

# ================================================================== SECOND FLOOR (12-ft ceilings)
f2 = Level('f2', 'Floor 2', 10, 12, ambient='interior-dim', interior='paneling', exterior='brick')
f2.room('8', 'Library', [(0, 0), (4, 0), (4, 3), (3, 3), (3, 4), (1, 4), (1, 3), (0, 3)], page=pg('8'))
f2.room('9', 'Secret Room', rect(4, 0, 6, 1), page=pg('9'))
f2.room('7A', "Servants' Room", rect(4, 1, 6, 4), page=pg('7'))
f2.room('7B', "Servants' Closet", rect(3, 3, 4, 4), page=pg('7'))
f2.room('6', 'Upper Hall', rect(0, 4, 6, 7), page=pg('6'))
f2.room('10', 'Conservatory', rect(0, 7, 6, 11), page=pg('10'))
f2.door((1, 4), (2, 4))                      # 6 -> 8 (east door, flanked by armor)
f2.door((3, 4), (4, 4))                      # 6 -> 7B
f2.door((4, 4), (5, 4))                      # 6 -> 7A
f2.door((4, 3), (4, 4))                      # 7B -> 7A
f2.door((1, 7), (2, 7))                      # 6 -> 10 (west door)
f2.secret((4, 0), (4, 1), 'lib', 'Secret door behind the bookshelf (DC 13)', '8')
for a, b in [((0, 0), (1, 0)), ((2, 0), (3, 0)), ((0, 1), (0, 2)), ((0, 5), (0, 6)), ((6, 8), (6, 9)), ((0, 11), (1, 11)), ((2, 11), (3, 11)), ((4, 11), (5, 11))]:
    f2.window(a, b)
f2.prop('shelves', 'bookshelf', (3.65, 1.5), '8', rotY=90, dims={'w': 14}); f2.prop('ladder', 'rolling-ladder', (3.35, 0.9), '8', rotY=90, dims={'h': 11})
f2.prop('desk', 'desk', (1.7, 1.4), '8', rotY=-30); f2.prop('deskchair', 'chair', (1.9, 2.2), '8', rotY=150); f2.prop('chairA', 'chair', (0.5, 0.5), '8', rotY=135); f2.prop('chairB', 'chair', (0.5, 2.6), '8', rotY=45)
f2.prop('fire8', 'fireplace', (2.5, 0.25), '8'); f2.prop('windmill-pic', 'portrait', (2.5, 0.4), '8', dims={'landscape': 1, 'w': 2.4, 'h': 1.8, 'y': 7.5})
f2.prop('drapes8a', 'drapes', (0.5, 0.1), '8'); f2.prop('drapes8b', 'drapes', (0.1, 1.5), '8', rotY=90)
f2.hidden('key', 'desk-key', (1.8, 1.45), '8', 'Desk drawer: iron key to area 20', dims={'y': 2.8}); f2.prop('desk-lamp', 'oil-lamp', (1.4, 1.2), '8', dims={'y': 3})
f2.hidden('chest9', 'claw-chest-skeleton', (5.5, 0.5), '9', "Chest: Strahd's letter, deeds, will (dart trap spent)", rotY=-90)
f2.prop('shelves9', 'bookshelf', (4.5, 0.15), '9', dims={'w': 5})
f2.prop('bed7a', 'bed-plain', (4.6, 1.8), '7A'); f2.prop('bed7b', 'bed-plain', (5.5, 1.8), '7A'); f2.prop('footlocker1', 'trunk', (4.6, 2.9), '7A'); f2.prop('footlocker2', 'trunk', (5.5, 2.9), '7A')
f2.prop('dumbwaiter', 'dumbwaiter-shaft', (5.7, 3.7), '7A', rotY=180); f2.prop('uniforms', 'cloak-hooks', (3.5, 3.15), '7B')
f2.prop('spiral', 'spiral-stair', (5.1, 5.5), '6', dims={'rise': 12, 'r': 6})
[f2.prop(f'armor{i}', 'armor-suit', p, '6') for i, p in enumerate([(0.6, 4.4), (2.4, 4.4), (0.6, 6.6), (2.4, 6.6)])]
f2.prop('fire6', 'fireplace', (0.25, 5.5), '6', rotY=90); f2.hidden('portrait', 'portrait', (0.4, 5.5), '6', 'Durst family portrait (the swaddled baby)', rotY=90, dims={'y': 7.5})
[f2.prop(f'lamp6{i}', 'oil-lamp', p, '6') for i, p in enumerate([(1.5, 4.1), (3.5, 4.1), (1.5, 6.9), (3.5, 6.9)])]
f2.prop('harpsichord', 'harpsichord', (0.9, 10.2), '10', rotY=20); f2.prop('hbench', 'bench', (1.3, 10.9), '10', dims={'l': 3}); f2.prop('harp', 'harp', (1.2, 8.2), '10'); f2.prop('fire10', 'fireplace', (0.25, 8.5), '10', rotY=90)
f2.prop('chandelier10', 'chandelier', (3, 9), '10', dims={'y': 10, 'brass': 1}); f2.prop('figurines', 'candlestick', (0.5, 8.5), '10', dims={'h': 1.2})
[f2.prop(f'seat{i}', 'chair', (0.6 + i * 0.9, 7.35), '10', rotY=180) for i in range(6)]; [f2.prop(f'seatb{i}', 'chair', (2.6 + i * 0.9, 10.65), '10') for i in range(4)]
[f2.prop(f'glass{i}', 'glass-hanging', p, '10', rotY=r) for i, (p, r) in enumerate([((5.85, 8.5), -90), ((5.85, 10), -90), ((2, 7.15), 0), ((4, 7.15), 0)])]
[f2.prop(f'drapes10{i}', 'drapes', p, '10', dims={'color': 0xd9d3c7}) for i, p in enumerate([(0.5, 10.9), (2.5, 10.9), (4.5, 10.9)])]
f2.hidden('shaft-f2', 'dumbwaiter', (0.5, 3.5), '21', 'Secret stair shaft (21) passes here')

# ================================================================== THIRD FLOOR (8-ft ceilings)
f3 = Level('f3', 'Floor 3', 22, 8, ambient='interior-dim', interior='paneling-dusty', exterior='brick')
f3.room('12A', 'Master Bedroom', [(0, 0), (5, 0), (5, 2), (6, 2), (6, 4), (4, 4), (4, 3), (0, 3)], page=pg('12'))
f3.room('12B', 'Closet', rect(3, 3, 4, 4), page=pg('12'))
f3.room('12C', 'Balcony (back)', rect(5, 0, 6, 2), 'flagstone', page=pg('12'))
f3.room('13', 'Bathroom', rect(0, 4, 2, 6), page=pg('13'))
f3.room('14', 'Storage Room', rect(0, 6, 2, 7), page=pg('14'))
f3.room('15B', 'Nursery', rect(0, 7, 2, 9), page=pg('15'))
f3.room('15C', 'Balcony (front)', rect(0, 9, 2, 11), 'flagstone', page=pg('15'))
f3.room('11', 'Balcony (landing)', [(2, 3), (3, 3), (3, 4), (6, 4), (6, 7), (5, 7), (5, 8), (2, 8)], page=pg('11'))
f3.room('15A', "Nursemaid's Bedroom", rect(2, 8, 6, 11), page=pg('15'))
f3.door((2, 3), (3, 3), id='f3-master-doors')   # stained-glass double doors 12A -> 11 (via the passage cell)
f3.door((3, 3), (4, 3))                          # 12A -> 12B (mirror door)
f3.door((5, 2), (6, 2))                          # parlour -> 12C
f3.door((2, 5), (2, 6))                          # 11 -> 13
f3.door((2, 6), (2, 7))                          # 11 -> 14
f3.door((2, 8), (2, 9))                          # 15A -> 15B
f3.door((2, 10), (2, 11), id='f3-balcony-doors') # 15A -> 15C
f3.opening((2, 8), (3, 8))                       # landing passage into 15A
f3.secret((3, 7), (4, 7), 'attic-a', 'Secret door to the attic stair (DC 15)', '11', extra=True)
f3.wall((4, 7), (5, 7))
f3.secret((3, 8), (4, 8), 'attic-b', 'Secret door behind the mirror (DC 15)', '15A')
for a, b in [((0, 0), (1, 0)), ((3, 0), (4, 0)), ((5, 1), (5, 2)), ((0, 1), (0, 2)), ((0, 5), (0, 6)), ((6, 8), (6, 9))]:
    f3.window(a, b)
for a, b in [((5, 0), (6, 0)), ((6, 0), (6, 2)), ((0, 11), (2, 11)), ((0, 9), (0, 11))]:
    f3.railing(a, b)
f3.prop('bed', 'four-poster-bed', (3.5, 1.0), '12A'); f3.prop('wardrobe1', 'wardrobe', (4.6, 0.3), '12A'); f3.prop('wardrobe2', 'wardrobe', (0.4, 2.6), '12A', rotY=90)
f3.prop('vanity', 'desk', (1.5, 2.6), '12A'); f3.prop('vanity-mirror', 'standing-mirror', (1.5, 2.85), '12A'); f3.hidden('jewelry', 'jewelry-box', (1.3, 2.55), '12A', 'Jewelry box: rings, topaz necklace', dims={'y': 2.75})
f3.prop('padded-chair', 'chair', (2.3, 2.3), '12A', rotY=-40)
f3.prop('rug', 'tiger-rug', (1.6, 1.5), '12A', rotY=180); f3.prop('fire12', 'fireplace', (0.25, 1.5), '12A', rotY=90); f3.prop('portrait12', 'portrait', (0.4, 1.5), '12A', rotY=90, dims={'dusty': 1, 'y': 7})
[f3.prop(f'drapes12{i}', 'drapes', p, '12A', rotY=r, dims={'color': 0x5b1f2b}) for i, (p, r) in enumerate([((0.5, 0.1), 0), ((0.1, 1.5), 90), ((3.5, 0.1), 0)])]
f3.prop('parlor-table', 'table', (5, 3), '12A'); f3.prop('pchair1', 'chair', (4.5, 2.5), '12A', rotY=135); f3.prop('pchair2', 'chair', (5.5, 3.5), '12A', rotY=-45); f3.prop('bowl', 'tabletop', (5, 3), '12A', dims={'set': 2, 'y': 3})
f3.prop('dumbwaiter', 'dumbwaiter-shaft', (5.7, 3.7), '12A', rotY=180)
cobwebs(f3, [(0, 0), (5, 0), (6, 4), (0, 3)], '12A', y=6.5, n=3)
f3.prop('tub', 'tub', (1.2, 5.2), '13'); f3.prop('stove13', 'stove', (0.4, 4.4), '13'); f3.prop('barrel', 'barrel-spigot', (1.7, 4.4), '13')
f3.prop('shelves14', 'shelves', (1, 6.15), '14', dims={'w': 8, 'linen': 1}); f3.prop('shelves14b', 'shelves', (0.15, 6.5), '14', rotY=90, dims={'w': 4, 'linen': 1})
f3.creature('broom', 'broom-of-animated-attack', (0.5, 6.6), '14', 'Broom of animated attack', size='small')
f3.prop('crib', 'crib', (1, 8), '15B'); f3.hidden('bundle', 'swaddled-bundle', (1, 8), '15B', 'Shrouded crib: empty bundle', dims={'y': 1.8}); cobwebs(f3, [(0, 7), (2, 7), (2, 9), (0, 9)], '15B', y=6.5)
f3.creature('armor', 'animated-armor', (2.5, 4.5), '11', 'Animated armor (attacks within 5 ft)')
[f3.prop(f'lamp11{i}', 'oil-lamp', p, '11') for i, p in enumerate([(3.5, 4.1), (2.1, 6.5)])]
f3.prop('spiral', 'spiral-stair', (5.1, 5.5), '11', dims={'rise': 8, 'r': 6})
f3.prop('attic-stair', 'stairs-straight', (3, 7.5), '11', dims={'w': 5, 'rise': 8, 'fromX': 15, 'toX': 25})
cobwebs(f3, [(2, 3), (6, 4), (6, 7), (2, 8)], '11', y=6.5, n=4)
f3.prop('bed15', 'four-poster-bed', (4, 10), '15A'); f3.prop('end1', 'nightstand', (3.1, 10.6), '15A'); f3.prop('end2', 'nightstand', (4.9, 10.6), '15A'); f3.prop('wardrobe15', 'wardrobe', (5.6, 9), '15A', rotY=-90)
f3.hidden('mirror', 'standing-mirror', (3.5, 8.2), '15A', 'Full-length mirror, ivy frame (eyeballs in the berries)', dims={'ivy': 1})
f3.creature('specter', 'specter', (3.5, 9.2), '15A', 'Specter (nursemaid) — when the nursery door opens')
cobwebs(f3, [(2, 8), (6, 8), (6, 11), (2, 11)], '15A', y=6.5, n=4)
f3.hidden('shaft-f3', 'dumbwaiter', (0.5, 3.5), '21', 'Secret stair shaft (21) passes here')

# ================================================================== ATTIC (13-ft ceilings)
at = Level('attic', 'Attic', 30, 13, ambient='interior-dim', interior='paneling-dusty', exterior='brick')
at.room('19', 'Spare Bedroom', rect(0, 0, 2, 3), page=pg('19'))
at.room('20', "Children's Room", rect(2, 0, 5, 3), page=pg('20'))
at.room('21', 'Secret Stairs', rect(0, 3, 1, 4), 'flagstone', page=pg('21'))
at.room('16', 'Attic Hall', [(1, 3), (5, 3), (5, 5), (6, 5), (6, 8), (3, 8), (3, 4), (1, 4)], page=pg('16'))
at.room('18', 'Storage Room', rect(0, 4, 3, 9), page=pg('18'))
at.room('17', 'Spare Bedroom', [(3, 8), (5, 8), (5, 11), (2, 11), (2, 9), (3, 9)], page=pg('17'))
at.door((1, 3), (2, 3))                                  # 16 -> 19
at.door((3, 3), (4, 3), id='attic-locked', locked=True)  # 16 -> 20 (padlocked)
at.door((1, 4), (2, 4))                                  # 16 -> 18
at.door((3, 8), (4, 8))                                  # 16 -> 17
at.secret((0, 4), (1, 4), 'shaft', 'Secret door to the spiral stair (appears after 9 or 20)', '18')
for a, b in [((0, 0), (1, 0)), ((0, 1), (0, 2)), ((2, 10), (2, 11)), ((3, 11), (4, 11))]:
    at.window(a, b)
at.prop('bed19', 'bed-plain', (1.5, 1), '19'); at.prop('night19', 'nightstand', (0.6, 0.5), '19'); at.prop('stove19', 'stove', (0.4, 2.5), '19'); at.prop('wardrobe19', 'wardrobe', (1.5, 2.7), '19', rotY=180); at.prop('rocker19', 'rocking-chair', (0.7, 1.8), '19', rotY=90)
cobwebs(at, [(0, 0), (2, 0), (2, 3), (0, 3)], '19', y=6, n=4)
at.prop('bricked20', 'bricked-window', (3.5, 0.08), '20'); at.prop('bed20a', 'child-bed', (2.6, 0.8), '20'); at.prop('bed20b', 'child-bed', (4.4, 0.8), '20')
at.hidden('remains', 'small-skeletons', (3.5, 1.7), '20', 'Rose & Thorn: skeletal remains + doll')
at.hidden('toychest', 'toy-chest-windmills', (2.7, 2.6), '20', 'Toy chest'); at.hidden('dollhouse', 'dollhouse-replica', (4.3, 2.6), '20', 'Dollhouse: reveals all secret doors (DC 15)')
at.creature('rose', 'ghost', (3.2, 1.4), '20', 'Rose (ghost)', size='small'); at.creature('thorn', 'ghost', (3.8, 1.9), '20', "Thorn (ghost)", size='small')
cobwebs(at, [(2, 0), (5, 0), (5, 3), (2, 3)], '20', y=6, n=4)
at.prop('spiral21', 'spiral-stair', (0.5, 3.5), '21', dims={'rise': 0.1, 'r': 2.2, 'turns': 1}); cobwebs(at, [(0, 3), (1, 3), (1, 4), (0, 4)], '21', y=5, n=2)
[at.prop(f'sheet{i}', 'sheeted-shape', p, '18', dims={'shape': sh}) for i, (p, sh) in enumerate([((1, 5.3), 0), ((2.3, 4.8), 1), ((1.5, 6.6), 3), ((2.5, 6.2), 2), ((1, 7.6), 0), ((2.4, 7.8), 3), ((0.6, 8.4), 1), ((2, 8.6), 0)])]
at.prop('mannequin', 'sheeted-shape', (2.6, 7.1), '18', dims={'shape': 2}); at.prop('stove18', 'stove', (0.5, 6), '18'); at.hidden('trunk', 'trunk', (0.7, 6.6), '18', "Trunk: nursemaid's remains (specter if disturbed)")
cobwebs(at, [(0, 4), (3, 4), (3, 9), (0, 9)], '18', y=6, n=4)
at.prop('bed17', 'bed-plain', (4.2, 8.9), '17'); at.prop('night17', 'nightstand', (3.4, 8.4), '17'); at.prop('stove17', 'stove', (4.6, 10.5), '17'); at.prop('desk17', 'desk', (3.3, 10.3), '17', rotY=90); at.prop('stool17', 'bench', (2.9, 10.3), '17', dims={'l': 1.4})
at.prop('wardrobe17', 'wardrobe', (4.6, 9.8), '17', rotY=-90); at.prop('rocker', 'rocking-chair', (2.5, 9.7), '17', rotY=90); at.prop('doll', 'doll', (2.15, 10.5), '17')
cobwebs(at, [(3, 8), (5, 8), (5, 11), (2, 11)], '17', y=6, n=4)
cobwebs(at, [(1, 3), (5, 3), (6, 8), (3, 8)], '16', y=7, n=4)
at.prop('stair-head', 'stairs-straight', (5.5, 6.5), '16', dims={'w': 5, 'rise': 0.1, 'fromZ': 40, 'toZ': 25})
at.note('milestone', (3, 3.5), '16', 'Milestone: access to 21 = 2nd level')

# ================================================================== DUNGEON (upper) — earth & timber, 8-ft rooms
du = Level('dungeon', 'Dungeon', -20, 8, ambient='darkness', interior='earth', exterior='earth')
D = 'dirt'
du.room('24', "Cult Initiates' Quarters", [(8, 0), (11, 0), (11, 9), (7, 9), (7, 4), (8, 4)], D, page=pg('24'))
du.room('25', 'Well and Cultist Quarters', rect(2, 5, 7, 10), D, page=pg('25'))
du.room('25A', 'Cultist Quarters A', rect(3, 3, 5, 5), D, page=pg('25'))
du.room('25B', 'Cultist Quarters B', rect(1, 3, 3, 5), D, page=pg('25'))
du.room('25C', 'Cultist Quarters C', rect(0, 6, 2, 8), D, page=pg('25'))
du.room('25D', 'Cultist Quarters D', rect(2, 10, 4, 12), D, page=pg('25'))
du.room('25E', 'Cultist Quarters E', rect(4, 10, 6, 12), D, page=pg('25'))
du.room('22', 'Dungeon Level Access', [(11, 1), (14, 1), (14, 2), (13, 2), (13, 5), (11, 5)], D, page=pg('22'))
du.room('23', 'Family Crypts', [(13, 2), (15, 2), (15, 1), (16, 1), (16, 5), (15, 5), (15, 3), (14, 3), (14, 7), (15, 7), (15, 6), (16, 6), (16, 10), (15, 10), (15, 8), (14, 8), (14, 9), (12, 9), (12, 6), (13, 6)], D, page=pg('23'))
du.room('23A', "Empty Crypt", rect(16, 1, 18, 2), D, page=pg('23'))
du.room('23B', "Walter's Crypt", rect(16, 4, 18, 5), D, page=pg('23'))
du.room('23C', "Gustav's Crypt", rect(16, 6, 18, 7), D, page=pg('23'))
du.room('23D', "Elisabeth's Crypt", rect(16, 8, 18, 9), D, page=pg('23'))
du.room('23E', "Rose's Crypt", rect(10, 6, 12, 7), D, page=pg('23'))
du.room('23F', "Thorn's Crypt", rect(10, 8, 12, 9), D, page=pg('23'))
du.room('27', 'Dining Hall', rect(12, 9, 17, 12), D, page=pg('27'))
du.room('28', 'Larder', rect(17, 10, 18, 11), D, page=pg('28'))
du.room('26', 'Hidden Spiked Pit', [(7, 9), (12, 9), (12, 10), (10, 10), (10, 13), (12, 13), (12, 14), (9, 14), (9, 10), (7, 10)], D, page=pg('26'))
du.room('30', 'Stairs Down', rect(8, 14, 10, 16), D, page=pg('30'))
du.room('29', 'Ghoulish Encounter', [(13, 12), (14, 12), (14, 13), (16, 13), (16, 15), (15, 15), (15, 14), (14, 14), (14, 17), (13, 17), (13, 14), (12, 14), (12, 13), (13, 13)], D, page=pg('29'))
du.room('32', 'Hidden Trapdoor (stair)', rect(17, 11, 18, 14), 'flagstone', page=pg('32'))
du.room('31', "Darklord's Shrine", [(16, 14), (19, 14), (19, 15), (20, 15.5), (20, 17.5), (19, 18), (19, 20), (16, 20)], D, page=pg('31'))
du.room('33', "Cult Leaders' Den", [(12, 17), (16, 17), (16, 20), (12, 20), (12, 19), (11, 19), (11, 18), (12, 18)], D, page=pg('33'))
du.room('34', "Cult Leaders' Quarters", rect(8, 18, 11, 21), D, page=pg('34'))
# openings between tunnel pieces (no wall)
for a, b in [((11, 1), (11, 2)), ((13, 2), (14, 2)), ((13, 4), (13, 5)), ((7, 5), (7, 6)), ((7, 9), (7, 10)), ((7, 9), (8, 9)),
             ((12, 9), (13, 9)), ((13, 9), (14, 9)), ((12, 9), (12, 10)), ((13, 12), (14, 12)), ((13, 17), (14, 17)), ((16, 14), (16, 15)),
             ((11, 18), (11, 19)), ((17, 10), (17, 11)), ((3, 5), (4, 5)), ((2, 5), (3, 5)), ((2, 6), (2, 7)), ((3, 10), (4, 10)), ((4, 10), (5, 10)),
             ((12, 13), (12, 14)), ((9, 14), (10, 14))]:
    du.opening(a, b)
# crypt slabs: C, D, E, F sealed (locked); A and B stand open
du.door((16, 1), (16, 2), id='crypt-A', open=True); du.door((16, 4), (16, 5), id='crypt-B', open=True)
du.door((16, 6), (16, 7), id='crypt-C', locked=True); du.door((16, 8), (16, 9), id='crypt-D', locked=True)
du.door((12, 6), (12, 7), id='crypt-E', locked=True); du.door((12, 8), (12, 9), id='crypt-F', locked=True)
du.secret((17, 14), (18, 14), 'concealed', 'Concealed door under clay (DC 10) to the stair (32)', '31')
du.door((16, 19), (16, 20), id='mimic-door')   # the "door" in 33's southwest corner is a mimic
# props & creatures
du.prop('table24', 'table', (9.5, 1.5), '24', rotY=90); [du.prop(f'ch24{i}', 'chair', p, '24', rotY=r) for i, (p, r) in enumerate([((8.7, 1.5), 90), ((10.3, 1.5), -90), ((9.5, 0.7), 180), ((9.5, 2.3), 0)])]
[du.prop(f'pallet{i}', 'pallet', p, '24', rotY=r) for i, (p, r) in enumerate([((7.5, 5), 0), ((10.5, 4.5), 0), ((7.5, 7.5), 0), ((9, 7.7), 90)])]
[du.prop(f'post24{i}', 'post', p, '24') for i, p in enumerate([(9, 4), (10, 6), (8, 8)])]
du.prop('well', 'well', (5.3, 7.5), '25'); [du.prop(f'post25{i}', 'post', p, '25') for i, p in enumerate([(3, 6), (6, 6), (3, 9), (6, 9)])]
for k, pos, r in [('A', (4, 4), 90), ('B', (2, 4), 0), ('C', (1, 7), 0), ('D', (3, 11), 90), ('E', (5, 11), 90)]:
    du.prop(f'bed25{k}', 'bed-plain', pos, f'25{k}', rotY=r); du.hidden(f'chest25{k}', 'crate-chest', (pos[0] + (0.6 if r else 0), pos[1] + (0 if r else 0.8)), f'25{k}', f'Padlocked chest {k} (DC 15)')
du.prop('spiral22', 'spiral-stair', (11.9, 4.1), '22', dims={'rise': 0.1, 'r': 2.2, 'turns': 1})
du.prop('steps22', 'stairs-straight', (12, 1.5), '22', dims={'w': 5, 'rise': 2, 'fromZ': 10, 'toZ': 5})
for k, pos in [('A', (17.2, 1.5)), ('B', (17.2, 4.5)), ('C', (17.2, 6.5)), ('D', (17.2, 8.5)), ('E', (10.8, 6.5)), ('F', (10.8, 8.5))]:
    if k in 'CDEF': du.prop(f'coffin{k}', 'bier-coffin', pos, f'23{k}', rotY=90)
du.prop('slabA', 'stone-slab', (16.4, 1.2), '23A', rotY=90, dims={'leaning': 1}); du.prop('slabB', 'stone-slab', (16.4, 4.8), '23B', rotY=90, dims={'leaning': 1})
du.creature('centipedes', 'swarm-of-insects', (17.5, 8.5), '23D', 'Swarm of insects (if the coffin is disturbed)')
du.prop('table27', 'table', (14.6, 10.5), '27', rotY=90); du.prop('bench1', 'bench', (13.9, 10.5), '27', rotY=90); du.prop('bench2', 'bench', (15.3, 10.5), '27', rotY=90)
[du.prop(f'bones{i}', 'bones', p, '27') for i, p in enumerate([(12.6, 9.6), (16.2, 11.4), (13.3, 11.6), (15.8, 9.5)])]
[du.prop(f'post27{i}', 'post', p, '27') for i, p in enumerate([(13, 10), (16, 10), (13, 12), (16, 12)])]
du.creature('grick', 'grick', (17.5, 10.5), '28', 'Grick (attacks within 5 ft of the alcove)')
du.obj('pit', 'pit-cover', (9.5, 11.5), 'trap', '26', 'Hidden spiked pit: 5 ft long, 10 ft deep (DC 15 to notice)', dims={'w': 5, 'd': 5})
du.prop('stairs30', 'stairs-straight', (9, 15), '30', dims={'w': 10, 'rise': 0.1, 'fromZ': 70, 'toZ': 80})
du.note('down35', (9, 14.3), '30', '20-ft stair down to 35')
for i, p in enumerate([(14.5, 13.5), (13.5, 14.5), (15.5, 14.5), (13.5, 16.5)]):
    du.creature(f'ghoul{i}', 'ghoul', p, '29', f'Ghoul {i + 1} (rises from the ground at the midpoint)')
du.prop('stairs32', 'stairs-straight', (17.5, 12.5), '32', dims={'w': 5, 'rise': 10, 'fromZ': 70, 'toZ': 55})
du.prop('planks32', 'planks-ceiling', (17.5, 11.5), '32', dims={'w': 5, 'd': 5, 'y': 16}); du.hidden('trapdoor32', 'trapdoor', (17.5, 11.3), '32', 'Trapdoor (bolted this side) up to the den (3)')
du.prop('statue', 'strahd-statue', (19.3, 16.5), '31', rotY=-90); du.hidden('orb', 'crystal-orb', (19.0, 16.9), '31', 'Crystal orb (25 gp, arcane focus)', dims={'y': 4.6})
for i in range(5): du.creature(f'shadow{i}', 'shadow', (18.4 + 0.5 * (i % 2), 15.3 + i * 0.6), '31', f'Shadow {i + 1} (if the statue is touched)')
[du.prop(f'shackles{i}', 'shackled-skeleton', p, '31', rotY=r) for i, (p, r) in enumerate([((16.15, 15), 90), ((16.15, 17.5), 90), ((17.5, 14.15), 0), ((18.6, 19.85), 180), ((16.15, 19), 90)])]
du.creature('mimic', 'mimic', (16, 19.5), '33', 'Mimic disguised as the door', size='medium')
du.prop('chandelier33', 'chandelier', (14, 18.6), '33', dims={'y': 7}); du.prop('table33', 'table', (14, 18.6), '33', rotY=40); du.prop('ch33a', 'chair', (13.2, 18), '33', rotY=130); du.prop('ch33b', 'chair', (14.8, 19.2), '33', rotY=-50)
du.prop('jug33', 'tabletop', (14, 18.6), '33', dims={'set': 1, 'y': 3}); du.prop('candle33a', 'candlestick', (12.3, 17.3), '33', dims={'h': 4}); du.prop('candle33b', 'candlestick', (15.7, 17.3), '33', dims={'h': 4})
du.prop('bed34', 'bed-plain', (9.5, 19.8), '34', rotY=0); du.prop('wardrobe34', 'wardrobe', (8.5, 18.3), '34', rotY=90); du.prop('crate34', 'torch-crate', (10.5, 18.4), '34')
du.prop('candle34a', 'candlestick', (8.3, 20.7), '34', dims={'h': 4}); du.prop('candle34b', 'candlestick', (10.7, 20.7), '34', dims={'h': 4})
du.hidden('footlocker', 'trunk', (9.5, 18.6), '34', 'Footlocker: cloak of protection, potions, spellbook')
du.creature('ghast-g', 'ghast', (9.5, 17.5), '34', 'Ghast (Gustav Durst) — behind the wall'); du.creature('ghast-e', 'ghast', (7.5, 19.5), '34', 'Ghast (Elisabeth Durst) — behind the wall')
du.note('chant', (12.5, 13.5), '29', 'Chanting is louder toward 30/35')
# centuries-old footprints lead every which way — except over the hidden pit in 26
for i, (pos, r, n) in enumerate([((12, 3), 0, 10), ((13.5, 5), 0, 12), ((15.5, 3), 0, 8), ((15.5, 8), 0, 8), ((12.5, 7.5), 0, 6), ((9.5, 3), 20, 10), ((8, 6.5), 0, 8),
                                 ((4.5, 7.5), 70, 10), ((14.5, 11), 90, 10), ((13.5, 15), 0, 10), ((14.5, 13.5), 90, 6), ((17.5, 16.5), 0, 8), ((13.5, 18.5), 90, 8), ((9.5, 19.5), 40, 6), ((11.5, 9.5), 90, 5)]):
    du.prop(f'footprints{i}', 'footprints', pos, None, rotY=r, dims={'n': n, 'len': n * 1.1, 'seed': i + 1})
# timber braces every 5 ft along the 4-ft tunnels
braces(du, '22', [(13, 1), (11, 1), (12, 1)], 'x'); braces(du, '22', [(12, 3), (12, 4)], 'z')
braces(du, '23', [(13, r) for r in range(2, 9)], 'z'); braces(du, '23', [(15, r) for r in range(1, 5)], 'z'); braces(du, '23', [(15, r) for r in range(6, 10)], 'z'); braces(du, '23', [(12, r) for r in range(6, 9)], 'z'); braces(du, '23', [(14, 2), (14, 7)], 'x')
braces(du, '26', [(c, 9) for c in range(7, 12)], 'x'); braces(du, '26', [(9, r) for r in range(10, 14)], 'z'); braces(du, '26', [(10, 13), (11, 13)], 'x')
braces(du, '29', [(13, r) for r in range(12, 17)], 'z'); braces(du, '29', [(12, 13), (14, 13), (15, 13)], 'x'); braces(du, '29', [(15, 14)], 'z')
braces(du, '33', [(11, 18)], 'x'); braces(du, '31', [(16, 19), (17, 19), (18, 19)], 'x'); braces(du, '28', [(17, 10)], 'x')
for key, poly in [('24', [(8, 0), (11, 0), (11, 9), (7, 9)]), ('25', [(2, 5), (7, 5), (7, 10), (2, 10)]), ('27', [(12, 9), (17, 9), (17, 12), (12, 12)]), ('31', [(16, 14), (19, 14), (19, 20), (16, 20)]), ('33', [(12, 17), (16, 17), (16, 20), (12, 20)]), ('34', [(8, 18), (11, 18), (11, 21), (8, 21)])]:
    cobwebs(du, poly, key, y=6.5, n=3)

# ================================================================== DUNGEON (lower) — 35–38
dl = Level('dungeon-lower', 'Lower dungeon', -30, 8, ambient='darkness', interior='earth', exterior='earth')
dl.room('35', 'Reliquary', [(1, 1), (8, 1), (8, 4), (3, 4), (3, 2), (2, 2), (2, 5), (1, 5)], D, page=pg('35'))
dl.room('36', 'Prison', [(4, 4), (5, 4), (5, 6), (4, 6), (4, 13), (1, 13), (1, 6), (2, 6), (2, 5), (4, 5)], D, page=pg('36'))
dl.room('37', 'Portcullis', rect(6, 4, 7, 6), 'shallow-water', page=pg('37'), difficult=True)
dl.room('38', 'Ritual Chamber', [(4, 6), (12, 6), (12, 14), (8, 14), (8, 16), (6, 16), (6, 14), (4, 14)], 'shallow-water', page=pg('38'), difficult=True, ceilingFt=16)
for a, b in [((4, 4), (5, 4)), ((6, 4), (7, 4))]:
    dl.opening(a, b)
dl.door((6, 6), (7, 6), id='portcullis', locked=True)
dl.secret((4, 9), (4, 10), 'prison', 'Secret door to the ritual chamber (DC 15)', '36')
# prison alcove partitions (short walls) — stamped as extra walls via a helper room-less trick: add thin walls directly
extra_walls = []
for r in (7, 8, 9, 10, 11, 12):
    for c0, c1 in ((1, 2), (3, 4)):
        extra_walls.append(OrderedDict(id=f'dungeon-lower-cell-{r}-{c0}', a=[c0 * C, r * C], b=[c1 * C, r * C], flags=['normal'], material='cave-rock'))
# 38: walls 16 ft; ledges, pillars, dais, altar, wheel, stairs, cave
for i, (pos, dims) in enumerate([(((8, 6.5)), {'w': 40, 'd': 5, 'h': 5}), (((8, 13.5)), {'w': 40, 'd': 5, 'h': 5}), (((4.5, 10)), {'w': 5, 'd': 30, 'h': 5}), (((11.5, 10)), {'w': 5, 'd': 30, 'h': 5})]):
    dl.prop(f'ledge{i}', 'ledge', pos, '38', dims=dims)
for i, p in enumerate([(5, 7), (7, 7), (9, 7), (11, 7), (5, 9), (11, 9), (5, 11), (11, 11), (5, 13), (7, 13), (9, 13), (11, 13)]):
    dl.prop(f'pillar{i}', 'column', p, '38', y=5)
dl.prop('dais', 'dais', (8, 10), '38', dims={'w': 15, 'h': 5, 'steps': 3})
dl.prop('altar', 'ghoul-altar', (8.4, 10), '38', y=5, rotY=90)
dl.prop('chains', 'chains', (8.4, 10), '38', dims={'y': 16, 'len': 8}); dl.note('chains-note', (8.4, 10.6), '38', 'Chains 8 ft long above the altar: prisoners were hung here and bled onto it')
dl.prop('wheel', 'wheel', (7.6, 6.2), '38', y=5)
dl.creature('lorghoth', 'shambling-mound', (7, 15.2), '38', 'Lorghoth the Decayer (shambling mound, asleep)', size='large')
dl.prop('refuse', 'refuse', (7, 15.2), '38')
[dl.prop(f'stair38{i}', 'stairs-straight', p, '38', dims={'w': 5, 'rise': 5, 'fromZ': fz, 'toZ': tz}) for i, (p, fz, tz) in enumerate([((6.5, 7.5), 40, 35), ((6.5, 12.5), 60, 65)])]
for i, p in enumerate([(3.5, 1.2), (4.5, 1.2), (5.5, 1.2), (6.5, 1.2), (7.5, 1.2), (3.5, 3.8), (4.5, 3.8), (5.5, 3.8), (6.5, 3.8), (7.5, 3.8), (7.8, 2.0), (7.8, 3.0), (3.2, 3.0)]):
    dl.hidden(f'relic{i}', 'niche', p, '35', f'Relic niche {i + 1}')
for i, p in enumerate([(4, 2), (5, 2), (6, 2), (7, 2), (4, 3), (5, 3), (6, 3), (7, 3)]):
    dl.prop(f'post{i}', 'post', p, '35')
dl.prop('stairs30', 'stairs-straight', (1.5, 4), '35', dims={'w': 5, 'rise': 0.1, 'fromZ': 25, 'toZ': 15})
dl.hidden('ring', 'shackled-skeleton', (1.15, 10.5), '36', 'Skeleton in a black robe: gold ring (25 gp)', rotY=90)
for r in (6, 8, 10, 12):
    for c, rot in ((1.15, 90), (3.85, -90)):
        if not (r == 10 and c < 2): dl.prop(f'shackle-{r}-{int(c)}', 'chains', (c, r + 0.5), '36', dims={'y': 5.5, 'len': 1.5})
cobwebs(dl, [(1, 6), (4, 6), (4, 13), (1, 13)], '36', y=6.5, n=4); cobwebs(dl, [(3, 1), (8, 1), (8, 4), (3, 4)], '35', y=6.5, n=4)
braces(dl, '35', [(1, 2), (1, 3), (1, 4)], 'z'); braces(dl, '35', [(2, 1)], 'x'); braces(dl, '36', [(4, 4), (4, 5)], 'z'); braces(dl, '36', [(2, 5), (3, 5)], 'x')
dl.note('up30', (1.5, 4.5), '35', 'Stair up to 30')
dl.prop('footprints-a', 'footprints', (1.5, 3), None, dims={'n': 8, 'len': 9, 'seed': 31}); dl.prop('footprints-b', 'footprints', (5.5, 2.5), None, rotY=90, dims={'n': 8, 'len': 9, 'seed': 32})
dl.note('cultists', (8, 7), '38', '13 apparitions on the ledges when the dais is climbed; "One must die!"')


# ------------------------------------------------------------------ descriptions (own wording, never the book's text)
DESC = {
  'f1-gate-iron': ("A wrought-iron gate with a lock on one side. Its hinges are rusted.", "Unlocked; the hinges shriek when it opens."),
  'f1-shield': ("A shield bearing a golden windmill on a red field, flanked by portraits of stern aristocrats.", "The Durst family arms. The portraits are long-dead Dursts."),
  'f1-sword': ("A longsword hangs above the black marble mantel; a windmill is worked into its hilt.", "Nonmagical longsword. The paneling hides serpents and skulls in its carvings (DC 12 Perception)."),
  'f1-spiral': ("A sweeping staircase of red marble curls up to the floor above.", "Continues to the second and third floors; the carved paneling follows it."),
  'f1-stag': ("A stag's head glowers from above the hearth.", None),
  'f1-cab-lock': ("A locked wooden cabinet.", "East cabinet: DC 15 Dexterity (thieves' tools). Heavy, light and hand crossbows with 20 bolts each. The north cabinet is unlocked: playing cards and wine glasses."),
  'f1-trapdoor': ("", "Trapdoor in the southwest corner. Cannot be found or opened from this side until the party reaches area 32 below."),
  'f1-chandelier5': ("A crystal chandelier glitters over a table set with polished silver.", "The silver tarnishes and the crystal cracks if taken from the house."),
  'f1-tapestry5': ("A tapestry of hounds and mounted nobles hunting a wolf.", "Rots if removed from the house."),
  'f1-painting5': ("A painting of an alpine valley in a mahogany frame.", "Fades if removed from the house."),
  'f1-oven': ("A stone oven shaped like a dome, its bent iron stovepipe running into the ceiling.", "Behind and left of the stove is the dumbwaiter door."),
  'f1-dumbwaiter': ("A small door opens onto a stone shaft with a wooden box on ropes.", "2-ft shaft to 7A and 12A; a Small creature can ride it (DC 10 Acrobatics). Rope holds 200 lb. A bell rings here when a button upstairs is pressed."),
  'f1-hooks2b': ("Black cloaks hang from hooks; a top hat rests on a high shelf.", None),
  'f2-shelves': ("Floor-to-ceiling shelves of books, with a rolling ladder.", "Hundreds of tomes on history, warfare, alchemy, poetry. One red-covered book with a blank spine is a switch (DC 13 Perception): it opens the secret door to 9."),
  'f2-key': ("A mahogany desk with an oil lamp, ink, quill, tinderbox and a letter kit.", "The drawer holds an iron key that unlocks the door to area 20. The wooden seal bears the windmill."),
  'f2-chest9': ("A heavy chest with clawed iron feet, lid half open. A skeleton in leather armor is slumped over it, three darts in its ribs.", "Dart trap is spent. The skeleton clutches a letter under Strahd's seal. Inside: three blank black books (25 gp each), scrolls of bless, protection from poison and spiritual weapon, the deeds to the house and to a windmill, and the Dursts' will."),
  'f2-shelves9': ("Shelves of tomes about summoning fiends and a cult's rites.", "The rituals are bogus (1 hour of study + DC 12 Arcana)."),
  'f2-portrait': ("A wood-framed family portrait above the mantel: a man, a woman and two smiling children; the father cradles a swaddled baby.", "The mother regards the baby with scorn: Walter, the nursemaid's stillborn child."),
  'f2-armor0': ("A suit of armor with a wolf's-head visor, spear in hand.", "Decorative. The doors it flanks are carved with dancers who, on inspection (DC 12), are fighting off bats."),
  'f2-harpsichord': ("A harpsichord and bench.", None), 'f2-harp': ("A tall standing harp.", None),
  'f2-figurines': ("Alabaster figurines of dancers line the mantelpiece.", "Several are carved as well-dressed skeletons."),
  'f3-bed': ("A four-poster bed hung with embroidered curtains and rotting gossamer veils.", None),
  'f3-jewelry': ("A vanity with a mirror and a silver jewelry box.", "Box worth 75 gp: three gold rings (25 gp each) and a platinum necklace with a topaz pendant (750 gp)."),
  'f3-rug': ("A rotting tiger-skin rug before the fireplace.", None), 'f3-portrait12': ("A dust-covered portrait of a man and a woman above the fireplace.", "Gustav and Elisabeth Durst."),
  'f3-tub': ("A wooden tub on clawed feet; a kettle sits on a small stove.", None), 'f3-barrel': ("A barrel under a spigot in the wall.", "The rooftop cistern's plumbing no longer works."),
  'f3-broom': ("A cobweb-covered broom leaning against the far wall.", "Broom of animated attack. Attacks anything within 5 ft."),
  'f3-crib': ("A crib covered by a hanging black shroud.", "Under the shroud: a tightly wrapped, baby-sized bundle. It is empty."),
  'f3-armor': ("A suit of black plate armor stands against the wall, draped in cobwebs.", "Animated armor. Attacks when damaged or approached within 5 ft; fights until destroyed."),
  'f3-mirror': ("A full-length mirror in a frame carved with ivy and berries.", "DC 12 Perception: eyeballs among the berries. The wall behind it holds a secret door (DC 15) to the attic stair."),
  'f3-specter': ("", "The nursemaid's specter. Manifests when the nursery door (15B) opens, unless already destroyed in 18. Cannot speak or be reasoned with."),
  'attic-remains': ("Two small skeletons in tattered clothes lie in the middle of the floor. The smaller one cradles a stuffed doll.", "Rose and Thorn. Placing their remains in crypts 23E and 23F lays the ghosts to rest."),
  'attic-toychest': ("A toy chest painted with windmills.", "Stuffed animals and toys. Disturbing it summons the ghosts."),
  'attic-dollhouse': ("A dollhouse that is a perfect replica of this house.", "DC 15 Perception reveals every secret door in the house, including the attic spiral stair (21). Disturbing it summons the ghosts."),
  'attic-rose': ("", "Ghost, Small, lawful good, 35 hp, no Horrifying Visage, CR 3. Fights only in self-defense; may possess a character who tries to leave."),
  'attic-thorn': ("", "Ghost, Small, lawful good, 35 hp, no Horrifying Visage, CR 3. Fights only in self-defense; may possess a character who tries to leave."),
  'attic-trunk': ("A wooden trunk under a dusty sheet, beside an iron stove.", "Unlocked. The nursemaid's skeleton wrapped in a bloodstained sheet (DC 14 Medicine: stabbed). Disturbing it summons her specter unless destroyed in 15."),
  'attic-doll': ("A smiling doll in a lacy yellow dress sits in the window box, cobwebs draping it like a veil.", None),
  'attic-spiral21': ("A narrow, creaking wooden spiral stair in a stone shaft, choked with cobwebs.", "5-ft shaft, 50 ft down to area 22. Visibility 5 ft. Exists only after the party reads Strahd's letter (9) or finds the dollhouse's secret door (20)."),
  'dungeon-spiral22': ("The wooden spiral stair ends here in an earthen chamber.", "Up to 21 (the attic)."),
  'dungeon-well': ("A well with a 3-ft stone lip; a bucket hangs from a rope and pulley bolted to the beams.", "4 ft across, 30 ft down to a water-filled cistern."),
  'dungeon-chest25A': ("A padlocked wooden chest.", "DC 15 Dex (thieves' tools). 11 gp and 60 sp in a pouch of human skin."),
  'dungeon-chest25B': ("A padlocked wooden chest.", "DC 15. Three moss agates (10 gp each) in black cloth."),
  'dungeon-chest25C': ("A padlocked wooden chest.", "DC 15. A leather eyepatch set with a carnelian (50 gp)."),
  'dungeon-chest25D': ("A padlocked wooden chest.", "DC 15. An ivory hairbrush with silver bristles (25 gp)."),
  'dungeon-chest25E': ("A padlocked wooden chest.", "DC 15. A silvered shortsword (110 gp)."),
  'dungeon-slabA': ("A blank stone slab leans against the wall beside an open, empty crypt.", None),
  'dungeon-slabB': ("A stone slab etched with a name leans against the wall; the crypt is empty.", "Walter Durst."),
  'dungeon-coffinC': ("An empty coffin on a stone bier.", "Gustav's crypt. Slab: DC 15 Athletics to remove (advantage with a crowbar)."),
  'dungeon-coffinD': ("An empty coffin on a stone bier.", "Elisabeth's crypt. A swarm of insects (centipedes) bursts from the back wall if the coffin is disturbed."),
  'dungeon-coffinE': ("An empty coffin on a stone bier.", "Rose's crypt. Her remains laid here put her ghost to rest."),
  'dungeon-coffinF': ("An empty coffin on a stone bier.", "Thorn's crypt. His remains laid here put his ghost to rest."),
  'dungeon-pit': ("Bare earthen floor.", "Hidden spiked pit under rotted planks and a skin of dirt: 5 ft long, 10 ft deep. DC 15 Perception notices the missing footprints. Fall: 1d6 bludgeoning + 2d10 piercing, prone."),
  'dungeon-grick': ("A dark alcove.", "A grick lurks here and attacks the first creature within 5 ft; passive Perception under 12 is surprised."),
  'dungeon-ghoul0': ("", "One of four ghouls (former cultists) that rise from the ground when the party reaches the midpoint of the crossing. They fight until destroyed."),
  'dungeon-statue': ("A painted wooden statue of a gaunt, pale-faced man in a voluminous black cloak, his left hand on the head of a wolf, a smoky crystal orb in his right.", "Strahd. Touching the statue or taking the orb summons five shadows that pursue beyond the room. The orb is worth 25 gp and works as an arcane focus."),
  'dungeon-shadow0': ("", "One of five shadows (former cultists) that form around the statue if it is touched."),
  'dungeon-shackles0': ("Moldy skeletons hang from rusty shackles along the walls.", "Harmless decor."),
  'dungeon-trapdoor32': ("A wooden trapdoor in a low plank ceiling, bolted from this side.", "Pushes open into the den (3) above. Once found it stays available as a way in and out."),
  'dungeon-mimic': ("A rotted wooden door.", "Mimic. Anything touching it adheres; it attacks when touched or damaged."),
  'dungeon-footlocker': ("An unlocked footlocker at the foot of the bed.", "Cloak of protection, coffer with four potions of healing, chain shirt, mess kit, alchemist's fire, bullseye lantern, thieves' tools, and a wizard's spellbook (1st: disguise self, identify, mage armor, magic missile, protection from evil and good; 2nd: darkvision, hold person, invisibility, magic weapon). Taking anything brings the ghasts out of the walls."),
  'dungeon-ghast-g': ("", "Gustav Durst, a ghast hidden in a cavity behind the earthen wall. Bursts out if anything is taken from the footlocker."),
  'dungeon-ghast-e': ("", "Elisabeth Durst, a ghast hidden behind the wall. Bursts out with Gustav."),
  'dungeon-crate34': ("An open crate of thirty torches and a sack of fifteen candles.", None),
  'dungeon-lower-relic0': ("A niche holding a small mummified yellow hand on a loop of rope.", "Worthless relic (goblin's hand)."),
  'dungeon-lower-ring': ("A skeleton in a tattered black robe hangs on the back wall of the cell.", "A cultist who questioned the cult. A gold ring (25 gp) on one finger."),
  'dungeon-lower-altar': ("A stone altar carved with grasping ghouls, stained with dried blood. Chains and shackles dangle above it.", "Climbing the dais summons thirteen harmless apparitions chanting for a sacrifice. A creature must die on the altar, or the cultists rouse Lorghoth."),
  'dungeon-lower-wheel': ("A wooden wheel half-embedded in the wall.", "An action turns it, raising or lowering the portcullis (37). Out of reach from the far side."),
  'dungeon-lower-lorghoth': ("A half-submerged heap of refuse fills a natural alcove.", "Lorghoth the Decayer, a shambling mound, asleep. DC 15 Nature reveals it. Wakes if attacked or if the party refuses the sacrifice; pursues but never leaves the dungeon."),
  'dungeon-lower-dais': ("Stairs rise to an octagonal stone dais above the water.", "5 ft high; the water is 2 ft deep. Ceiling 16 ft."),
}
RELIC = ["a knife carved from human bone", "a dagger with a rat's skull in the pommel", "an 8-inch varnished orb made from a nothic's eye", "a bone aspergillum", "a folded cloak of stitched ghoul skin", "a desiccated frog lashed to a stick", "a bag of bat guano", "a hag's severed finger", "a 6-inch wooden mummy figurine", "an iron pendant with a devil's face", "the shrunken head of a halfling", "a small coffer holding a dire wolf's withered tongue"]
for i, r in enumerate(RELIC): DESC[f'dungeon-lower-relic{i + 1}'] = (f"A wall niche holding {r}.", "Worthless cult relic.")
for i in range(1, 4): DESC[f'dungeon-ghoul{i}'] = DESC['dungeon-ghoul0']
for i in range(1, 5): DESC[f'dungeon-shadow{i}'] = DESC['dungeon-shadow0']
for i in range(1, 5): DESC[f'dungeon-shackles{i}'] = DESC['dungeon-shackles0']
for i in range(1, 4): DESC[f'f2-armor{i}'] = DESC['f2-armor0']

# What players call hidden or disguised things once they can see them (never the DM label).
PLAYER_LABEL = {
    'f1-sword': 'Longsword', 'f1-cab-lock': 'Locked cabinet', 'f1-trapdoor': 'Trapdoor',
    'f2-sdo-lib': 'Hidden door', 'f2-key': 'Desk', 'f2-chest9': 'Chest and skeleton', 'f2-portrait': 'Family portrait',
    'f3-sdo-attic-a': 'Hidden door', 'f3-sdo-attic-b': 'Hidden door', 'f3-jewelry': 'Vanity', 'f3-bundle': 'Shrouded bundle',
    'f3-broom': 'Broom', 'f3-armor': 'Black plate armor', 'f3-mirror': 'Full-length mirror', 'f3-specter': 'Specter',
    'attic-sdo-shaft': 'Hidden door', 'attic-remains': 'Small skeletons', 'attic-toychest': 'Toy chest', 'attic-dollhouse': 'Dollhouse',
    'attic-rose': 'Ghostly girl', 'attic-thorn': 'Ghostly boy', 'attic-trunk': 'Trunk',
    'dungeon-sdo-concealed': 'Hidden door', 'dungeon-centipedes': 'Swarm of centipedes', 'dungeon-grick': 'Dark alcove',
    'dungeon-pit': 'Earthen floor', 'dungeon-trapdoor32': 'Trapdoor', 'dungeon-orb': 'Crystal orb',
    'dungeon-shadow0': 'Shadow', 'dungeon-shadow1': 'Shadow', 'dungeon-shadow2': 'Shadow', 'dungeon-shadow3': 'Shadow', 'dungeon-shadow4': 'Shadow',
    'dungeon-ghoul0': 'Ghoul', 'dungeon-ghoul1': 'Ghoul', 'dungeon-ghoul2': 'Ghoul', 'dungeon-ghoul3': 'Ghoul',
    'dungeon-mimic': 'Rotted door', 'dungeon-footlocker': 'Footlocker', 'dungeon-ghast-g': 'Ghast', 'dungeon-ghast-e': 'Ghast',
    'dungeon-lower-sdo-prison': 'Hidden door', 'dungeon-lower-lorghoth': 'Refuse heap',
    'dungeon-lower-ring': 'Robed skeleton', 'f1-shaft-f1': 'Stone shaft', 'f2-shaft-f2': 'Stone shaft', 'f3-shaft-f3': 'Stone shaft',
}
for _i in range(5): PLAYER_LABEL[f'dungeon-chest25{"ABCDE"[_i]}'] = 'Padlocked chest'
for _i in range(13): PLAYER_LABEL[f'dungeon-lower-relic{_i}'] = 'Wall niche'

# Rooms: what players notice on entering (desc) and what the DM should keep in mind (dm). Own wording.
ROOM_DESC = {
  '1A': ("A stone portico. A rusted iron gate shrieks on its hinges; oil lamps hang on chains either side of heavy oak doors.", "The gate is unlocked. The mists close in on anyone who lingers outside."),
  '1B': ("A grand foyer. A shield with a golden windmill on red hangs between portraits of stern nobles. Stained-glass double doors lead on.", "The portraits are long-dead Dursts."),
  '2A': ("A wide hall with a black marble fireplace at one end and a red marble staircase sweeping up at the other. Carved paneling of vines, nymphs and satyrs.", "DC 12 Perception on the paneling: serpents and skulls hidden in the carving. The paneling follows the stair upward."),
  '2B': ("A cloakroom: black cloaks on hooks, a top hat on a high shelf.", None),
  '3': ("A hunter's den paneled in oak: a stag's head over the hearth, three stuffed wolves, fur-draped chairs, a card table under a chandelier.", "East cabinet locked (DC 15): three crossbows and bolts. North cabinet: cards and wine glasses. A trapdoor in the southwest corner stays hidden until found from below (32)."),
  '4A': ("A tidy kitchen: shelves of dishes, a worktable with a rolling pin, a domed stone oven. A small door hides a dumbwaiter with a brass bell beside it.", "Dumbwaiter: 2-ft shaft to 7A and 12A; a Small creature fits (DC 10 Acrobatics); holds 200 lb."),
  '4B': ("A well-stocked pantry.", "The food looks fresh but tastes of nothing."),
  '5': ("A paneled dining room: a mahogany table for eight laid with gleaming silver and crystal, a painting of an alpine valley, red silk drapes and a hunting tapestry.", "DC 12 Perception on the paneling: twisted faces in the trees and wolves in the leaves. Silver tarnishes, crystal cracks, the painting fades and the tapestry rots if taken from the house."),
  '6': ("An elegant upper hall: a family portrait over the mantel, suits of wolf-helmed armor beside carved doors. A cold draft spills down the stairs.", "The mother in the portrait eyes the baby with scorn. DC 12 Perception on the doors: the dancing youths are fighting off bats."),
  '7A': ("A plain bedroom with two straw-mattress beds and a footlocker at each foot.", "The footlockers are empty. A button by the dumbwaiter rings the kitchen bell."),
  '7B': ("A closet of neatly hung servants' uniforms.", None),
  '8': ("A library in red velvet: a mahogany desk facing the hearth, a painting of a windmill on a crag, overstuffed chairs, shelves to the ceiling with a rolling ladder.", "Desk drawer: iron key to 20. Secret door behind a shelf: a red book with a blank spine is the switch (DC 13); it swings shut unless propped. Books rot if removed."),
  '9': ("A hidden study lined with shelves of occult books. A skeleton in leather armor sprawls over a clawed chest.", "Books on fiend summoning and the Priests of Osybus, all bogus (1 hour + DC 12 Arcana). Dart trap is spent. The letter from Strahd is the trigger that opens the stair (21). Chest: blank books, three scrolls, deeds, the will."),
  '10': ("A conservatory: gossamer drapes, a brass chandelier, chairs along the walls, stained glass of singers and players, a harpsichord and a tall harp.", "Some mantel figurines are skeletons in fine clothes."),
  '11': ("A dusty balcony at the top of the red stair. A suit of black plate armor stands against the wall under cobwebs.", "The armor animates at 5 ft or when damaged. DC 12 Perception on the paneling: tiny corpses in the trees, worms from the soil. Secret door west (DC 15) to the attic stair."),
  '12A': ("A dusty master bedroom: a curtained four-poster, two wardrobes, a vanity, a rotting tiger-skin rug before the hearth, a small parlor with a bowl and jug.", "Jewelry box: three gold rings and a topaz necklace (750 gp). Mirror door to the closet (12B). Dumbwaiter button rings the kitchen."),
  '12B': ("An empty closet thick with dust.", None),
  '12C': ("A balcony over the back of the house, lost in mist.", None),
  '13': ("A dark bathroom: a clawed wooden tub, an iron stove with a kettle, a barrel under a wall spigot.", "The rooftop cistern plumbing no longer works."),
  '14': ("A storeroom with shelves of folded linens, blankets and old soap. A broom leans against the far wall.", "The broom attacks anyone within 5 ft."),
  '15A': ("A once-elegant bedroom under dust: a large bed, end tables, a wardrobe and a tall mirror framed in carved ivy.", "The nursemaid's specter appears when the nursery door opens. DC 12 on the mirror: eyeballs among the berries. Secret door behind it (DC 15) to the attic stair."),
  '15B': ("A nursery. A crib hides beneath a hanging black shroud.", "The swaddled bundle inside is empty (the stillborn Walter)."),
  '15C': ("A balcony over the front of the house, behind stained-glass doors.", None),
  '16': ("A bare attic hall choked with dust.", "The door to 20 is padlocked: key in the library desk, or DC 15 thieves' tools."),
  '17': ("A cobwebbed spare room: a narrow bed, a writing desk and stool, a stove, a rocking chair. A smiling doll in yellow lace sits in the window.", None),
  '18': ("A storeroom packed with furniture under dusty sheets: chairs, coat racks, mirrors, dress forms.", "Trunk by the stove: the nursemaid's remains (DC 14 Medicine: stabbed many times). Disturbing them brings the specter. A secret door east appears only after 9's letter or 20's dollhouse."),
  '19': ("A web-filled spare room: bed, nightstand, rocking chair, wardrobe, stove.", None),
  '20': ("A children's room with a bricked-up window between two small beds, a toy chest painted with windmills and a dollhouse copy of this house.", "Two small skeletons in familiar clothes lie on the floor. Disturbing the chest or dollhouse calls Rose and Thorn's ghosts. DC 15 on the dollhouse reveals every secret door."),
  '21': ("A narrow wooden spiral stair in a stone shaft, thick with cobwebs.", "Cobwebs cut sight to 5 ft. The shaft exists only once the house reveals it; it descends 50 ft to 22."),
  '22': ("The spiral stair ends in an earthen chamber. A narrow tunnel runs south, then branches.", "A faint chant echoes from somewhere; its source is unclear until 26 or 29."),
  '23': ("Crypts hewn into the earth, sealed with stone slabs.", "Moving a slab: DC 15 Athletics (advantage with a crowbar). Laying Rose and Thorn's remains in 23E/23F puts them to rest."),
  '23A': ("An empty crypt; its blank slab leans nearby.", None),
  '23B': ("An empty crypt; its slab, leaning nearby, bears a name.", "Walter Durst."),
  '23C': ("An empty coffin on a stone bier.", "Gustav Durst's crypt."),
  '23D': ("An empty coffin on a stone bier.", "Elisabeth Durst's crypt. Centipedes boil out of the wall if the coffin is disturbed."),
  '23E': ("An empty coffin on a stone bier.", "Rose's crypt: her remains here lay her ghost to rest."),
  '23F': ("An empty coffin on a stone bier.", "Thorn's crypt: his remains here lay his ghost to rest."),
  '24': ("A table and four chairs at one end; moldy straw pallets in alcoves at the other.", None),
  '25': ("A stone-lipped well drops into darkness; a bucket hangs from a pulley on the beams. Small rooms open off the chamber.", "Well: 30 ft to a cistern. Each side room has a bed and a padlocked chest (DC 15)."),
  '25A': ("A moldy bed and a padlocked chest.", "Chest: 11 gp and 60 sp in a human-skin pouch."),
  '25B': ("A moldy bed and a padlocked chest.", "Chest: three moss agates (10 gp each)."),
  '25C': ("A moldy bed and a padlocked chest.", "Chest: eyepatch with a carnelian (50 gp)."),
  '25D': ("A moldy bed and a padlocked chest.", "Chest: ivory hairbrush with silver bristles (25 gp)."),
  '25E': ("A moldy bed and a padlocked chest.", "Chest: silvered shortsword (110 gp)."),
  '26': ("A tunnel west. The chanting grows louder.", "DC 15 Perception: no footprints here. Hidden spiked pit: 1d6 + 2d10 to the first to step on it."),
  '27': ("A plain table between long benches. Moldy human bones litter the floor.", "Anyone within 5 ft of the dark alcove (28) provokes the grick."),
  '28': ("A dark alcove.", "A grick lurks here; passive Perception under 12 is surprised."),
  '29': ("A four-way tunnel crossing. The chant is louder to the north.", "At the midpoint, four ghouls rise from the ground and fight to the end."),
  '30': ("A 20-ft stair leading down. The chanting clearly rises from below.", None),
  '31': ("A shrine hung with shackled skeletons. In an alcove stands a painted statue of a gaunt, pale man in a black cloak, one hand on a wolf, the other holding a grey crystal orb.", "Touching the statue or taking the orb raises five shadows. Concealed door east under clay (DC 10) to the stair (32)."),
  '32': ("A stone stair up to a landing under a low ceiling of planks with a bolted trapdoor.", "Opens into the den (3); once found it stays usable."),
  '33': ("A den with a chandelier over a table, two high-backed chairs, a clay jug and flagons, iron candlesticks.", "The door in the southwest corner is a mimic: it sticks to whoever touches it."),
  '34': ("A bedroom: a rotted feather bed, a wardrobe of old robes, candlesticks, a crate of torches and candles, a footlocker at the bed's foot.", "Removing anything from the footlocker frees two ghasts from the walls (Gustav and Elisabeth). Footlocker: cloak of protection, four healing potions, spellbook and gear."),
  '35': ("Thirteen niches of grisly curios. Here the chant resolves into words: 'He is the Ancient. He is the Land.'", "The relics are worthless. The south tunnel slopes into murky water to a portcullis (37)."),
  '36': ("Alcoves with rusty shackles, empty now.", "A robed skeleton in the marked cell wears a gold ring. Secret door south (DC 15) to 38."),
  '37': ("A rusty iron portcullis over 2 ft of murky water.", "DC 20 Athletics to lift, or turn the wheel inside 38."),
  '38': ("A forty-foot hall of smooth stone and pillars, half flooded. Stairs rise to dry ledges and to a central dais with a blood-stained altar under hanging chains. A breach opens west on a heap of refuse.", "The chant stops as they enter. Climbing the dais summons thirteen apparitions: 'One must die!' Refusing wakes Lorghoth (the refuse heap)."),
}

# Everything that opens: lock state, what players find inside (own wording), what opening reveals.
EMPTY = 'Empty.'
CONTAINERS = {
  'f1-cab-e': dict(locked=True, contents='A heavy, a light and a hand crossbow, with twenty bolts for each.', reveals=['f1-cab-lock']),
  'f1-cab-n': dict(contents='A small box holding a deck of playing cards, and rows of wine glasses.'),
  'f2-desk': dict(contents='An iron key in the drawer. On the desk: an oil lamp, ink and quill, a tinderbox and a letter kit with a windmill seal.', reveals=['f2-key']),
  'f2-chest9': dict(open=True, contents='Three blank books bound in black leather, three spell scrolls, the deed to this house, the deed to a windmill, and a signed will.'),
  'f2-footlocker1': dict(contents=EMPTY), 'f2-footlocker2': dict(contents=EMPTY),
  'f3-wardrobe1': dict(contents=EMPTY), 'f3-wardrobe2': dict(contents=EMPTY),
  'f3-vanity': dict(contents='Dusty drawers; the jewelry box sits on top.', reveals=['f3-jewelry']),
  'f3-jewelry': dict(contents='Three gold rings and a thin platinum necklace with a topaz pendant.'),
  'f3-end1': dict(contents=EMPTY), 'f3-end2': dict(contents=EMPTY), 'f3-wardrobe15': dict(contents=EMPTY),
  'attic-night19': dict(contents=EMPTY), 'attic-wardrobe19': dict(contents=EMPTY),
  'attic-toychest': dict(contents='Stuffed animals and wooden toys.'),
  'attic-trunk': dict(contents="A woman's bones wrapped in a tattered sheet stiff with old blood."),
  'attic-night17': dict(contents=EMPTY), 'attic-desk17': dict(contents='A few sheets of yellowed paper.'), 'attic-wardrobe17': dict(contents=EMPTY),
  'dungeon-chest25A': dict(locked=True, contents='Worthless odds and ends, and a coin pouch made of an unsettling pale leather.'),
  'dungeon-chest25B': dict(locked=True, contents='Worthless odds and ends, and three mossy green stones folded in black cloth.'),
  'dungeon-chest25C': dict(locked=True, contents='Worthless odds and ends, and a black leather eyepatch with a red stone sewn into it.'),
  'dungeon-chest25D': dict(locked=True, contents='Worthless odds and ends, and an ivory hairbrush with silver bristles.'),
  'dungeon-chest25E': dict(locked=True, contents='Worthless odds and ends, and a silvered shortsword.'),
  'dungeon-coffinC': dict(contents=EMPTY), 'dungeon-coffinD': dict(contents=EMPTY), 'dungeon-coffinE': dict(contents=EMPTY), 'dungeon-coffinF': dict(contents=EMPTY),
  'dungeon-wardrobe34': dict(contents='Several old black robes.'),
  'dungeon-footlocker': dict(contents="A folded cloak, a small coffer with four potions, a chain shirt, a mess kit, a flask of alchemist's fire, a bullseye lantern, thieves' tools and a spellbook bound in yellow leather."),
}

def apply_desc(levels):
    for lv in levels:
        for o in lv['objects']:
            d = DESC.get(o['id'])
            if d:
                if d[0]: o['desc'] = d[0]
                if d[1]: o['dm'] = d[1]
            if o['id'] in PLAYER_LABEL: o['playerLabel'] = PLAYER_LABEL[o['id']]
            if o['id'] in CONTAINERS: o['container'] = OrderedDict(sorted(CONTAINERS[o['id']].items()))
        for r in lv['rooms']:
            d = ROOM_DESC.get(r['key'])
            if d:
                if d[0]: r['desc'] = d[0]
                if d[1]: r['dm'] = d[1]

# ================================================================== assemble
levels = [f1, f2, f3, at, du, dl]
scene = OrderedDict(schema=1, location='death-house', chapter='appB', name='Death House', mapPage=216, bookScaleFt=5, ambient='interior-dim')
scene['levels'] = [lv.to_json() for lv in levels]
apply_desc(scene['levels'])
scene['levels'][5]['walls'] += extra_walls
for w in scene['levels'][5]['walls']:
    if w['id'] in ('dungeon-lower-w-0',) or True:
        # 38's masonry is 16 ft
        a, b = w['a'], w['b']
        if all(20 <= v[0] <= 60 and 30 <= v[1] <= 80 for v in (a, b)): w['heightFt'] = 16; w['material'] = 'ashlar'
scene['links'] = [
    OrderedDict(id='lk-spiral-1-2', kind='spiral', **{'from': {'level': 'f1', 'pos': [25.5, 27.5]}, 'to': {'level': 'f2', 'pos': [25.5, 27.5]}}),
    OrderedDict(id='lk-spiral-2-3', kind='spiral', **{'from': {'level': 'f2', 'pos': [25.5, 27.5]}, 'to': {'level': 'f3', 'pos': [25.5, 27.5]}}),
    OrderedDict(id='lk-attic-stair', kind='stairs', **{'from': {'level': 'f3', 'pos': [20, 37.5]}, 'to': {'level': 'attic', 'pos': [27.5, 32.5]}}),
    OrderedDict(id='lk-21', kind='spiral', **{'from': {'level': 'attic', 'pos': [2.5, 17.5]}, 'to': {'level': 'dungeon', 'pos': [59.5, 20.5]}}),
    OrderedDict(id='lk-dumbwaiter-1-2', kind='dumbwaiter', **{'from': {'level': 'f1', 'pos': [28.5, 18.5]}, 'to': {'level': 'f2', 'pos': [28.5, 18.5]}}),
    OrderedDict(id='lk-dumbwaiter-2-3', kind='dumbwaiter', **{'from': {'level': 'f2', 'pos': [28.5, 18.5]}, 'to': {'level': 'f3', 'pos': [28.5, 18.5]}}),
    OrderedDict(id='lk-trapdoor', kind='trapdoor', **{'from': {'level': 'dungeon', 'pos': [87.5, 56.5]}, 'to': {'level': 'f1', 'pos': [27.5, 52.5]}}),
    OrderedDict(id='lk-30', kind='stairs', **{'from': {'level': 'dungeon', 'pos': [45, 75]}, 'to': {'level': 'dungeon-lower', 'pos': [7.5, 20]}}),
]
scene['nonSpatialKeys'] = ['1', '2', '4', '7', '12', '15']

grid = OrderedDict(schema=1, levels=OrderedDict())
for lv in levels:
    grid['levels'][lv.id] = OrderedDict(floorPolygons=[ft(p) for p in lv.floor_polys], type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0.55)

out = os.path.join(ROOT, 'locations', 'appB', 'death-house')
os.makedirs(out, exist_ok=True)
json.dump(scene, open(os.path.join(out, 'scene.json'), 'w'), indent=1, ensure_ascii=False)
json.dump(grid, open(os.path.join(out, 'grid.json'), 'w'), indent=1, ensure_ascii=False)
nw = sum(len(l['walls']) for l in scene['levels']); no = sum(len(l['objects']) for l in scene['levels']); nr = sum(len(l['rooms']) for l in scene['levels'])
print(f'death-house: {len(levels)} levels, {nr} rooms, {nw} walls, {no} objects')
