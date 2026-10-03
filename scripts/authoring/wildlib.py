#!/usr/bin/env python3
"""Shared pieces for the Lands of Barovia wilderness maps (chapter 2), which the book prints no battle maps for:
geometry on the 5-ft lattice (smooth roads, ribbons, blobs), and `Site`, which holds one map's level, keeps the trees
off roads and features, scatters old pines and undergrowth, and writes locations/ch02/<ID>/{scene,grid}.json.
Each site has its own script, wild_<id>.py, built on this; wilderness.py runs them all."""
import json, math, os, random, sys
from collections import OrderedDict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from authorlib import ROOT, Level, rect  # noqa: F401

_M = json.load(open(os.path.join(ROOT, 'manifests', 'locations.json')))
MAN = {l['id']: l for l in _M['locations']}
AMB = 'barovian-overcast'
# printed pages where the manifest has none (the OCR page minus one)
PAGE_FIX = {'D': 35, 'M': 39}


# ================================================================== geometry (cells: 1 = 5 ft; x east, z south)
def catmull(ctrl, per=6):
    """A smooth polyline through the control points (uniform Catmull-Rom), `per` points per span."""
    P = [ctrl[0]] + list(ctrl) + [ctrl[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(per):
            t = k / per; t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    out.append(tuple(ctrl[-1]))
    return out

def _normals(line):
    n = len(line); out = []
    for i in range(n):
        a, b = line[max(0, i - 1)], line[min(n - 1, i + 1)]
        tx, tz = b[0] - a[0], b[1] - a[1]; L = math.hypot(tx, tz) or 1
        out.append((-tz / L, tx / L))
    return out

def offset(line, w):
    """The polyline moved `w` cells to its left (w may be a function of the fraction along)."""
    nrm = _normals(line); n = len(line)
    return [(x + nx * (w(i / (n - 1)) if callable(w) else w), z + nz * (w(i / (n - 1)) if callable(w) else w)) for i, ((x, z), (nx, nz)) in enumerate(zip(line, nrm))]

def ribbon(line, hw):
    """Polygon of a ribbon `hw` cells either side of the polyline (hw may vary along it)."""
    return offset(line, hw) + offset(line, (lambda f: -hw(f)) if callable(hw) else -hw)[::-1]

def band(line, w0, w1):
    """Polygon of the strip between offsets w0 and w1 (a river bank)."""
    return offset(line, w0) + offset(line, w1)[::-1]

def clamp_poly(poly, W, H):
    return [(min(W, max(0, x)), min(H, max(0, z))) for x, z in poly]

def rnd(v, k=2):
    return round(v, k)

def seg_dist(p, a, b):
    dx, dz = b[0] - a[0], b[1] - a[1]; L2 = dx * dx + dz * dz or 1e-9
    t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2))
    return math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t)

def line_dist(p, line):
    return min(seg_dist(p, line[i], line[i + 1]) for i in range(len(line) - 1))

def inside(p, poly):
    x, z = p; c = False; n = len(poly)
    for i in range(n):
        (x0, z0), (x1, z1) = poly[i], poly[(i + 1) % n]
        if (z0 > z) != (z1 > z) and x < (x1 - x0) * (z - z0) / (z1 - z0) + x0: c = not c
    return c

def blob(cx, cz, r, seed, sx=1.4, n=9):
    """An irregular blob polygon (a pool, a patch) of radius about r, stretched sx along x."""
    rr = random.Random(seed)
    return [(rnd(cx + math.cos(2 * math.pi * i / n) * r * sx * (0.75 + 0.35 * rr.random())), rnd(cz + math.sin(2 * math.pi * i / n) * r * (0.75 + 0.35 * rr.random()))) for i in range(n)]

def along(line, f):
    """Point and heading (unit vector) a fraction f along a polyline."""
    segs = [math.hypot(line[i + 1][0] - line[i][0], line[i + 1][1] - line[i][1]) for i in range(len(line) - 1)]
    goal = f * sum(segs)
    for i, s in enumerate(segs):
        if goal <= s or i == len(segs) - 1:
            t = goal / s if s else 0
            a, b = line[i], line[i + 1]
            return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), ((b[0] - a[0]) / (s or 1), (b[1] - a[1]) / (s or 1))
        goal -= s

def heading(dx, dz):
    """rotY (degrees) that turns a piece's local +x to point along (dx, dz) in plan."""
    return round(math.degrees(math.atan2(-dz, dx)), 1)

def facing(dx, dz):
    """rotY that turns a piece's local +z (its front) toward (dx, dz) in plan."""
    return round(math.degrees(math.atan2(dx, dz)), 1)

def turn(dx, dz, rot):
    """A local offset (feet or cells) turned by rotY degrees, as the kit turns its pieces."""
    a = math.radians(rot); c, s = math.cos(a), math.sin(a)
    return (dx * c + dz * s, -dx * s + dz * c)

def oriented_rect(cx, cz, along_dx, along_dz, half_len, half_w):
    L = math.hypot(along_dx, along_dz) or 1; ux, uz = along_dx / L, along_dz / L; nx, nz = -uz, ux
    return [(rnd(cx + ux * a + nx * b), rnd(cz + uz * a + nz * b)) for a, b in ((-half_len, -half_w), (half_len, -half_w), (half_len, half_w), (-half_len, half_w))]


# ================================================================== a site
class Site:
    def __init__(self, key, name, W, H, seed):
        self.key, self.name, self.W, self.H = key, name, W, H
        self.rng = random.Random(seed)
        self.lv = Level('day', 'Day (overcast)', 0, 8, ambient=AMB, interior='rubble', exterior='rubble', north='-z')
        self.roads = []       # (line, half-width) the trees keep off
        self.keep = []        # (poly, margin) where no tree stands
        self.circles = []     # (x, z, r) clearings
        self.trees = []       # (x, z, trunk clearance) already placed
        self.walk = None      # floor polygons for the grid (default: the whole map)
        self.desc = {}        # room key -> (desc, dm)
        self.n = 0
        self.lv.terrain.append((rect(0, 0, W, H), 'grass'))

    # ---------------------------------------------------------- pieces
    def uid(self, base):
        self.n += 1
        return f'{base}{self.n}'

    def road(self, ctrl, hw, floor='dirt', per=6, keep=True, terrain=True):
        line = catmull(ctrl, per)
        if terrain: self.lv.terrain.append((clamp_poly([(rnd(x), rnd(z)) for x, z in ribbon(line, hw)], self.W, self.H), floor))
        if keep: self.roads.append((line, hw if not callable(hw) else max(hw(0), hw(1))))
        return line

    def patch(self, poly, floor):
        self.lv.terrain.append((poly, floor))

    def room(self, key, name, poly, floor='grass', desc='', dm='', difficult=False):
        page = next((a['page'] for a in MAN[self.key]['areas'] if a['key'] == key.split('-')[0]), None) or PAGE_FIX.get(key.split('-')[0])
        self.lv.room(key, name, [(rnd(x), rnd(z)) for x, z in poly], floor, page=page, difficult=difficult)
        self.desc[key] = (desc, dm)

    def inmap(self, p, m=0.5):
        return m <= p[0] <= self.W - m and m <= p[1] <= self.H - m

    def prop(self, kind, pos, rot=0, dims=None, y=0, label=None, desc=None, key=None, id=None):
        self.lv.prop(id or self.uid(kind), kind, (rnd(pos[0]), rnd(pos[1])), key, rotY=rnd(rot, 1), dims=dims, y=y)
        o = self.lv.objects[-1]
        # Fog: seen by players like any prop, but kept out of the level's merged scatter so it draws over the grid.
        if kind == 'mist': o['vis'] = 'explored'
        if label: o['label'] = label
        if desc: o['desc'] = desc
        return o

    def hidden(self, kind, pos, label, player, rot=0, dims=None, y=0, desc=None, dm=None, key=None, id=None):
        self.lv.obj(id or self.uid(kind), kind, (rnd(pos[0]), rnd(pos[1])), 'hidden-object', key or self.key, label, rotY=rnd(rot, 1), dims=dims, y=y)
        o = self.lv.objects[-1]; o['playerLabel'] = player
        if desc: o['desc'] = desc
        if dm: o['dm'] = dm
        return o

    def mob(self, kind, pos, label, player, size='medium', rot=0, y=0, dims=None, dm=None, key=None, id=None):
        self.lv.obj(id or self.uid(kind), kind, (rnd(pos[0]), rnd(pos[1])), 'hidden-creature', key or self.key, label, rotY=rnd(rot, 1), size=size, dims=dims, y=y)
        o = self.lv.objects[-1]; o['playerLabel'] = player
        if dm: o['dm'] = dm
        return o

    def note(self, pos, text, key=None):
        self.lv.note(self.uid('note'), (rnd(pos[0]), rnd(pos[1])), key or self.key, text)

    def spawn(self, pos):
        self.lv.obj('spawn', 'spawn', (rnd(pos[0]), rnd(pos[1])), 'dm-note', None, 'Party arrives')

    # ---------------------------------------------------------- the woods
    def clear(self, x, z, r):
        self.circles.append((x, z, r))

    def blocked(self, x, z, margin=0.0, circles=True):
        for line, hw in self.roads:
            if line_dist((x, z), line) < hw + margin: return True
        for poly, m in self.keep:
            if inside((x, z), poly): return True
            if m and min(seg_dist((x, z), poly[i], poly[(i + 1) % len(poly)]) for i in range(len(poly))) < m: return True
        for cx, cz, r in (self.circles if circles else ()):
            if math.hypot(x - cx, z - cz) < r: return True
        return False

    def roomy(self, x, z, gap):
        return all(math.hypot(x - tx, z - tz) >= max(gap, tr) for tx, tz, tr in self.trees)

    def pines(self, tries, density=lambda x, z: 1.0, gap=2.3, margin=1.2, scale=(0.95, 1.5), giant=None, edge=0.4):
        """Old pines scattered by rejection: `density(x, z)` 0..1, never on a road or in a keep-out, at least `gap` cells
        apart. `giant(x, z)` may return a bigger scale range near the road."""
        rng = self.rng; placed = 0
        for _ in range(tries):
            x, z = rng.uniform(edge, self.W - edge), rng.uniform(edge, self.H - edge)
            if rng.random() > density(x, z): continue
            if self.blocked(x, z, margin) or not self.roomy(x, z, gap): continue
            lo, hi = (giant(x, z) if giant else None) or scale
            s = rnd(lo + rng.random() * (hi - lo))
            self.trees.append((x, z, gap))
            self.prop('pine', (x, z), rot=int(rng.random() * 360), dims={'h': 26, 'r': 6, 'scale': s})
            placed += 1
        return placed

    def scatter(self, kind, count, density=lambda x, z: 1.0, margin=0.6, gap=1.6, dims=None, rot=True, label=None, y=0, circles=True):
        rng = self.rng; done = 0
        for _ in range(count * 40):
            if done >= count: break
            x, z = rng.uniform(0.6, self.W - 0.6), rng.uniform(0.6, self.H - 0.6)
            if rng.random() > density(x, z) or self.blocked(x, z, margin, circles) or not self.roomy(x, z, gap): continue
            d = dims(rng) if callable(dims) else dims
            self.trees.append((x, z, gap * 0.6))
            self.prop(kind, (x, z), rot=int(rng.random() * 360) if rot else 0, dims=d, label=label, y=y)
            done += 1
        return done

    def undergrowth(self, bushes=30, boulders=10, dead=3, stumps=4, logs=4, density=lambda x, z: 1.0):
        self.scatter('bush', bushes, density, margin=0.4, gap=1.2, dims=lambda g: {'scale': rnd(0.7 + g.random() * 0.8)})
        self.scatter('boulder', boulders, density, margin=0.6, gap=1.5, dims=lambda g: {'r': rnd(1.5 + g.random() * 2.5)})
        self.scatter('dead-tree', dead, density, margin=1.0, gap=2.5, dims=lambda g: {'scale': rnd(0.9 + g.random() * 0.5)})
        self.scatter('stump', stumps, density, margin=0.6, gap=1.2, dims=lambda g: {'r': rnd(0.9 + g.random() * 0.6)})
        self.scatter('log', logs, density, margin=1.2, gap=2.5, dims=lambda g: {'len': rnd(12 + g.random() * 10), 'r': rnd(0.9 + g.random() * 0.5)})

    # ---------------------------------------------------------- output
    def write(self, scene_name, extra=None, levels=(), links=(), keep_walls=False):
        """Write the scene and grid. `levels`: further authorlib Levels (a bridge deck, a pool below the falls, a cave)
        appended after the main one, their rooms described from self.desc too; `links` as the scene's links list;
        `keep_walls` keeps the walls authorlib derives round rooms (default: open ground, no walls round keyed areas)."""
        def finish(level):
            lv = level.to_json()
            if not keep_walls: lv['walls'] = [w for w in lv['walls'] if not w['id'].startswith(f'{level.id}-w-')]
            for r in lv['rooms']:
                d = self.desc.get(r['key'])
                if d: r['desc'], r['dm'] = d
            return OrderedDict((k, lv[k]) for k in ('id', 'name', 'elevationFt', 'ceilingFt', 'terrain', 'ambient', 'north', 'rooms', 'walls', 'lights', 'objects') if k in lv)
        ordered = finish(self.lv); lv = ordered
        scene = OrderedDict(schema=1, location=self.key, chapter='ch02', name=scene_name, mapPage=None, bookScaleFt=5, ambient=AMB)
        if extra: scene.update(extra)
        scene['levels'] = [ordered] + [finish(l) for l in levels]; scene['links'] = list(links)
        walk = self.walk or [rect(0, 0, self.W, self.H)]
        floor = [[[rnd(x * 5, 3), rnd(z * 5, 3)] for x, z in p] for p in walk] + [r['polygon'] for r in lv['rooms']]
        grid = OrderedDict(schema=1, levels=OrderedDict((l['id'], OrderedDict(floorPolygons=floor if l is ordered else [r['polygon'] for r in l['rooms']] + [[[rnd(x * 5, 3), rnd(z * 5, 3)] for x, z in p] for p, _ in getattr(lv2, 'terrain', [])[:1]], type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0.55)) for l, lv2 in zip(scene['levels'], [self.lv] + list(levels))))
        out = os.path.join(ROOT, 'locations', 'ch02', self.key); os.makedirs(out, exist_ok=True)
        json.dump(scene, open(os.path.join(out, 'scene.json'), 'w'), indent=1, ensure_ascii=False)
        json.dump(grid, open(os.path.join(out, 'grid.json'), 'w'), indent=1, ensure_ascii=False)
        from collections import Counter
        kinds = Counter(o['kind'] for l in scene['levels'] for o in l['objects'])
        print(f'{self.key}: {sum(len(l["rooms"]) for l in scene["levels"])} rooms, {sum(len(l["walls"]) for l in scene["levels"])} walls, {sum(kinds.values())} objects ({kinds["pine"]} pines), {len(scene["levels"])} level(s), {self.W * 5}x{self.H * 5} ft')


def mists_note():
    return 'The Mists: a creature starting its turn in the fog makes a DC 20 Con save or gains a level of exhaustion (not removable while in the fog); the area is heavily obscured; whoever walks into it is turned around and comes out in Barovia again.'


