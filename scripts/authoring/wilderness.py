#!/usr/bin/env python3
"""The Lands of Barovia, wilderness sites (chapter 2): encounter-scale outdoor maps authored from the module's text,
which prints no battle maps for them. One 5-ft cell per square; each map is a few hundred feet across, set as the
regional map (book p.35) places it: the road(s) as terrain strips, grass and forest ground, the old pines, rocks,
water, and the site's own features, creatures and DM notes.

  A  Old Svalich Road        p.33   the muddy road between giant trees, black pools, the Mists closing behind
  B  Gates of Barovia        p.33   the stone buttresses, the iron gates, the two headless guardians, the fog
  D  River Ivlis             p.35   the fifty-foot river and the arching stone bridge below the village
  F  River Ivlis Crossroads  p.35   the gallows, the signpost, the walled plot of eleven blank graves
  H  Tser Falls              p.37   the high road, the arching bridge over the chasm, the falls, the gargoyles
  I  Black Carriage          p.37   the fork in the mountain road, the cobbled east branch, Strahd's carriage
  J  Gates of Ravenloft      p.38   the broken turrets, the fifty-foot chasm, the drawbridge, the gate (as ch04/K)
  L  Lake Zarovich           p.38   the south shore, the rowboats, Bluto's boat four hundred feet out
  M  Mount Baratok           p.39   the rocky slope above the fog, the spur, the Mad Mage
  P  Luna River Crossroads   p.40   the X crossing, the snapped signpost, the Luna River
  R  Raven River Crossroads  p.40   the signpost, the branches, the arching bridge over the Raven River

Only keys, names, page refs, dimensions and placements come from the book; descriptions are our own words.
-> locations/ch02/<ID>/{scene,grid}.json. World pins are wired separately."""
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
    def write(self, scene_name, extra=None):
        lv = self.lv.to_json()
        lv['walls'] = [w for w in lv['walls'] if not w['id'].startswith(f'{self.lv.id}-w-')]   # open ground: no walls round the keyed areas
        for r in lv['rooms']:
            d = self.desc.get(r['key'])
            if d: r['desc'], r['dm'] = d
        ordered = OrderedDict((k, lv[k]) for k in ('id', 'name', 'elevationFt', 'ceilingFt', 'terrain', 'ambient', 'north', 'rooms', 'walls', 'lights', 'objects') if k in lv)
        scene = OrderedDict(schema=1, location=self.key, chapter='ch02', name=scene_name, mapPage=None, bookScaleFt=5, ambient=AMB)
        if extra: scene.update(extra)
        scene['levels'] = [ordered]; scene['links'] = []
        walk = self.walk or [rect(0, 0, self.W, self.H)]
        floor = [[[rnd(x * 5, 3), rnd(z * 5, 3)] for x, z in p] for p in walk] + [r['polygon'] for r in lv['rooms']]
        grid = OrderedDict(schema=1, levels=OrderedDict(day=OrderedDict(floorPolygons=floor, type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0.55)))
        out = os.path.join(ROOT, 'locations', 'ch02', self.key); os.makedirs(out, exist_ok=True)
        json.dump(scene, open(os.path.join(out, 'scene.json'), 'w'), indent=1, ensure_ascii=False)
        json.dump(grid, open(os.path.join(out, 'grid.json'), 'w'), indent=1, ensure_ascii=False)
        from collections import Counter
        kinds = Counter(o['kind'] for o in lv['objects'])
        print(f'{self.key}: {len(lv["rooms"])} rooms, {len(lv["walls"])} walls, {len(lv["objects"])} objects ({kinds["pine"]} pines), {self.W * 5}x{self.H * 5} ft')


def mists_note():
    return 'The Mists: a creature starting its turn in the fog makes a DC 20 Con save or gains a level of exhaustion (not removable while in the fog); the area is heavily obscured; whoever walks into it is turned around and comes out in Barovia again.'


# ================================================================== A. Old Svalich Road (p.33)
def site_A():
    s = Site('A', 'Old Svalich Road', 120, 64, 101)
    road = s.road([(0, 34), (18, 32), (38, 35), (58, 31), (78, 34), (98, 31), (120, 33)], 2.3)
    # black pools in and beside the muddy roadway
    pools = [(24, 33.6, 1.5), (46.5, 33.4, 2.0), (66, 32.4, 1.3), (86.5, 32.1, 1.7), (31, 28.3, 1.6), (55, 37.6, 1.4), (72, 28.6, 2.1), (93, 36.4, 1.5), (12, 37.2, 1.3), (104, 28.4, 1.5), (40, 30.2, 1.0), (79, 36.9, 1.1)]
    for i, (x, z, r) in enumerate(pools):
        p = blob(x, z, r, 70 + i, sx=1.6); s.patch(p, 'shallow-water'); s.keep.append((p, 0.8))
    # the Mists close the road to the east: the way the party came
    s.prop('mist', (114, 32), rot=90, dims={'len': 380, 'h': 55, 'd': 32}, label='The Mists', desc='A wall of grey fog stands across the road the way you came. A few steps in, the trees vanish.')
    s.keep.append((rect(104, 0, 120, 64), 0))
    near = lambda x, z: (1.45, 2.0) if line_dist((x, z), road) < 9 else None
    s.pines(5200, density=lambda x, z: 0.95, gap=2.25, margin=1.1, scale=(1.0, 1.55), giant=near)
    s.undergrowth(bushes=55, boulders=14, dead=5, stumps=6, logs=7, density=lambda x, z: 1.0 if line_dist((x, z), road) < 12 else 0.4)
    s.room('A', 'Old Svalich Road', clamp_poly(ribbon(catmull([(0, 34), (18, 32), (38, 35), (58, 31), (78, 34), (98, 31), (106, 32)], 4), 6.5), 120, 64), 'grass',
           'The muddy road is pitted with still, black pools. Huge old pines crowd both verges, their upper limbs lost in the fog.',
           'On foot the party reaches the Gates of Barovia (B) after 5 hours; in Vistani wagons, half that. Roll for random encounters as usual. The way back east is the Mists.')
    s.note((101, 27), mists_note())
    s.note((46.5, 39), 'Standing pools in and beside the road: difficult terrain.')
    s.note((8, 28), 'West: the road runs on to the Gates of Barovia (B).')
    s.spawn((99, 31.3))
    s.write('Old Svalich Road')


# ================================================================== B. Gates of Barovia (p.33)
def site_B():
    s = Site('B', 'Gates of Barovia', 100, 70, 202)
    s.road([(0, 36), (20, 35), (40, 35.6), (50, 35.5), (62, 35.2), (80, 36), (100, 35)], 2.1)
    gx, gz = 50, 35.5
    s.prop('barovia-gate', (gx, gz), rot=90, dims={'w': 22, 'h': 34, 'wing': 32, 'open': 0}, label='Gates of Barovia',
           desc='Massive grey piers of stone stand out of the forest either side of the road, a pair of tall, rusted iron gates hung between them.')
    s.keep.append((rect(gx - 3, gz - 11, gx + 3, gz + 11), 0.8))
    for i, (pz, v) in enumerate(((gz - 5.2, 0), (gz + 5.2, 1))):
        s.prop('headless-statue', (gx + 3.4, pz), rot=90, dims={'v': v}, label='Headless guardian',
               desc='A stone guardian, armed and armoured, larger than life. Its head is gone, broken off at the neck.')
        hz = pz + (-1.4 if i == 0 else 1.6)
        s.prop('statue-head', (gx + 5.6, hz), rot=30 + i * 170, label='Fallen stone head', desc="A guardian's helmeted head lies in the weeds, staring at nothing.")
        s.keep.append((rect(gx + 2, pz - 1.6, gx + 7, pz + 1.6), 0.4))
    s.prop('paving', (gx, gz), dims={'r': 14, 'seed': 3}); s.prop('paving', (gx - 6, gz - 0.4), dims={'r': 6, 'seed': 5}); s.prop('paving', (gx + 7, gz + 0.3), dims={'r': 7, 'seed': 8})
    s.prop('weeds', (gx + 4.6, gz - 3.4), dims={'n': 5, 'r': 2}); s.prop('weeds', (gx + 4.8, gz + 3.6), dims={'n': 5, 'r': 2})
    # the fog spilling out of the forest behind the party
    s.prop('mist', (94, 35), rot=90, dims={'len': 420, 'h': 50, 'd': 26}, label='The Mists', desc='Fog rolls out of the trees and closes over the road behind you.')
    s.prop('mist', (76, 35.5), rot=90, dims={'len': 150, 'h': 5, 'd': 30})
    s.keep.append((rect(86, 0, 100, 70), 0))
    s.pines(4200, density=lambda x, z: 1.0, gap=2.2, margin=0.9, scale=(1.0, 1.6), giant=lambda x, z: (1.3, 1.8) if abs(z - gz) < 10 else None)
    s.undergrowth(bushes=45, boulders=10, dead=3, stumps=3, logs=5, density=lambda x, z: 1.0 if abs(z - 35) < 14 else 0.35)
    s.room('B', 'Gates of Barovia', [(40, 27), (68, 27), (68, 44), (40, 44)], 'grass',
           'Behind you the fog has closed over the road. Ahead, grey stone piers rise out of the forest on either side with tall rusted iron gates hung between them, and two stone guardians flank the way, both headless, their heads lying in the grass at their feet.',
           'On foot, the gates screech open as the party approaches and shut behind it; Vistani wagons: they open before the lead wagon and close after the last. This (eastern) gate will not open for anyone leaving unless Vistani are with them. If Strahd is destroyed the gates swing open and the road east clears of fog.')
    s.note((gx + 1, gz - 12.5), 'Skirting the closed gates through the woods means walking into the Mists: the fog chokes any non-Vistani who tries.')
    s.note((90, 28), mists_note())
    s.note((6, 30), 'West: the road runs on through the Svalich Woods (C) to the village of Barovia (E).')
    s.spawn((84, 35.6))
    s.write('Gates of Barovia')


# ================================================================== D. River Ivlis (p.35)
def site_D():
    s = Site('D', 'River Ivlis', 90, 80, 303)
    river = catmull([(-2, 47.5), (14, 44.5), (30, 41.2), (46, 40.4), (62, 42.2), (76, 44.2), (92, 41)], 7)
    wpoly = clamp_poly([(rnd(x), rnd(z)) for x, z in ribbon(river, 5)], 90, 80)
    for side in (1, -1):
        s.patch(clamp_poly([(rnd(x), rnd(z)) for x, z in band(river, side * 5, side * 5.4)], 90, 80), 'dirt')
    s.keep.append((ribbon(river, 6.4), 0))
    # the Old Svalich Road: from the village (north) across the bridge and on toward the crossroads (south-west)
    bc = (46.2, 40.5); bdx, bdz = -0.2, 1.0; L = math.hypot(bdx, bdz); bdx, bdz = bdx / L, bdz / L
    half = 8.2
    n_end = (bc[0] - bdx * half, bc[1] - bdz * half); s_end = (bc[0] + bdx * half, bc[1] + bdz * half)
    s.road([(57, 0), (54, 12), (50, 24), (n_end[0] + bdx * -0.6, n_end[1] - 0.6), n_end], 2.0)
    s.road([s_end, (s_end[0] - 0.4, s_end[1] + 2), (43, 58), (40, 68), (36, 80)], 2.0)
    s.prop('stone-bridge', bc, rot=heading(bdx, bdz), dims={'len': 84, 'w': 16, 'rise': 1.6, 'par': 3},
           label='Arching stone bridge', desc='An old stone bridge carries the road over the river on one low arch, its parapets dark with moss.')
    s.room('D', 'River Ivlis', wpoly, 'shallow-water',
           'A wide, cold river, so clear that its stony bed shows through; fifty feet from bank to bank.',
           'About 50 ft wide and 5 to 10 ft deep: swimming (difficult). Two arching stone bridges cross it, this one near the village of Barovia and another near Tser Falls.')
    s.room('D-bridge', 'Arching stone bridge', oriented_rect(bc[0], bc[1], bdx, bdz, half, 1.6), 'flagstone', 'A single stone span over the river, wide enough for a wagon.', 'Safe to cross.')
    s.keep.append((oriented_rect(bc[0], bc[1], bdx, bdz, half + 1.5, 3.2), 0.6))
    for i in range(16):
        p, t = along(river, 0.04 + i * 0.06); nx, nz = -t[1], t[0]
        for side in (1, -1):
            if s.rng.random() < 0.55:
                x, z = p[0] + nx * side * (4.9 + s.rng.random() * 0.6), p[1] + nz * side * (4.9 + s.rng.random() * 0.6)
                if math.hypot(x - bc[0], z - bc[1]) > 7 and s.inmap((x, z)): s.prop('reeds', (x, z), dims={'r': rnd(1.5 + s.rng.random() * 1.5), 'n': 9})
            if s.rng.random() < 0.3:
                x, z = p[0] + nx * side * (6.2 + s.rng.random() * 1.2), p[1] + nz * side * (6.2 + s.rng.random() * 1.2)
                if math.hypot(x - bc[0], z - bc[1]) > 7 and s.inmap((x, z)): s.prop('boulder', (x, z), dims={'r': rnd(1.2 + s.rng.random() * 1.6)})
    # open meadow below the village, the forest closing in at the corners
    dens = lambda x, z: min(1.0, 0.04 + max(0, (math.hypot(x - 46, z - 38) - 26) / 14) ** 2)
    s.pines(3000, density=dens, gap=2.3, margin=1.4, scale=(1.0, 1.55))
    s.undergrowth(bushes=40, boulders=6, dead=2, stumps=5, logs=2, density=lambda x, z: 0.5 + 0.5 * (math.hypot(x - 46, z - 40) > 18))
    s.note((52, 30), 'North along the road: the village of Barovia (E).')
    s.note((33, 74), 'South-west: the road climbs to the River Ivlis crossroads (F).')
    s.spawn((56.5, 4))
    s.write('River Ivlis')


# ================================================================== F. River Ivlis Crossroads (p.35)
def site_F():
    s = Site('F', 'River Ivlis Crossroads', 100, 80, 404)
    J = (50, 40)
    s.road([J, (62, 39.4), (76, 41), (88, 40), (100, 41)], 2.0)
    s.road([J, (43, 34), (35, 27), (26, 20), (16, 12), (6, 4), (0, 0)], 2.0)
    s.road([J, (45, 47), (38, 55), (30, 63), (22, 71), (14, 80)], 2.0)
    s.patch(blob(J[0] + 0.5, J[1], 3.4, 9, sx=1.2), 'dirt')
    # the gallows, north of the road; the signpost opposite; the graves behind their broken wall across from the gallows
    gp = (57, 33.2)
    s.prop('gallows', gp, dims={'h': 5}, label='Gallows', desc='A rotting wooden platform five feet high with steps up its front; above it an upright and a beam, a frayed rope swinging from the end.')
    s.hidden('hanged-figure', (gp[0] + 1.2 / 5, gp[1]), 'The Hanged One (illusion)', 'A hanged body', rot=40, y=5,
             desc='A grey corpse hangs from the rope that was empty a moment ago, turning slowly in the wind until it faces you.',
             dm='Appears as the party leaves: one random character sees themself hanging; the rest see an unknown Barovian. It looks and smells real and melts away to nothing if touched or moved.')
    s.keep.append((rect(gp[0] - 1.6, gp[1] - 1.6, gp[0] + 1.6, gp[1] + 3), 0.6))
    s.prop('fingerpost', (55.5, 44.6), dims={'a0': 90, 'a1': 315, 'a2': 225}, label='Signpost',
           desc='A signpost opposite the gallows points three ways: Barovia Village east, Tser Pool north-west, Ravenloft and Vallaki south-west.')
    plot = [(60, 44), (73, 44), (73, 55), (60, 55)]
    walls = [((60, 44), (66.5, 44), 1), ((68.6, 44), (73, 44), 2), ((73, 44), (73, 49.8), 3), ((73, 51.8), (73, 55), 4), ((73, 55), (65.5, 55), 5), ((62.6, 55), (60, 55), 6), ((60, 55), (60, 49), 7)]
    for a, b, sd in walls:
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        s.prop('field-wall', ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), rot=heading(b[0] - a[0], b[1] - a[1]), dims={'len': rnd(L * 5, 1), 'h': 3, 't': 2, 'seed': sd}, label='Low stone wall')
    for i in range(3): s.prop('rubble', (60.4 + i * 0.5, 45.5 + i * 1.3), dims={'n': 5})
    for row, z in enumerate((45.6, 48.6, 51.6)):
        for col in range(4 if row < 2 else 3):
            s.prop('gravestone', (62.4 + col * 2.7 + (row % 2) * 0.6, z), rot=s.rng.uniform(-8, 8), label='Blank gravestone', desc='A weathered headstone with nothing carved on it.', key='F-graves')
    s.prop('mist', (66.5, 49.5), dims={'len': 70, 'h': 4, 'd': 55}, label='Fog over the graves')
    s.keep.append((plot, 1.0))
    # the high ground to the west: rock and wind-bent trees above the south-west fork
    for i, (x, z, w, h) in enumerate([(30, 44, 36, 14), (22, 52, 40, 18), (8, 50, 30, 12), (14, 62, 44, 22), (12, 40, 34, 16), (6, 74, 40, 14)]):
        s.prop('crag', (x, z), rot=s.rng.uniform(0, 360), dims={'w': w, 'd': rnd(w * 0.7), 'h': h, 'seed': i + 1}); s.keep.append((rect(x - w / 12, z - w / 14, x + w / 12, z + w / 14), 0.5))
    s.clear(J[0] + 4, J[1] + 2, 11)
    dens = lambda x, z: 0.95 if (x > 30 or z < 36) else 0.3
    s.pines(4200, density=dens, gap=2.3, margin=1.1, scale=(1.0, 1.55))
    s.undergrowth(bushes=40, boulders=16, dead=6, stumps=3, logs=4, density=lambda x, z: 1.0)
    s.scatter('weeds', 14, lambda x, z: 1.0 if math.hypot(x - J[0] - 2, z - J[1] - 1) < 10 else 0.0, margin=0.3, gap=1.2, dims={'n': 4, 'r': 1.5}, circles=False)
    s.room('F', 'River Ivlis Crossroads', [(40, 36.4), (59.5, 36.4), (59.5, 47), (40, 47)], 'grass',
           'Three roads meet. On one side of the junction stands an old wooden gallows, a frayed rope swinging from its beam in the cold wind off the western heights; across from it, a signpost. One fork drops away north-west into the trees, another climbs the slope to the south-west.',
           'Check for a random encounter on arrival unless Vistani accompany the party. North-west leads down to the river and the Tser Pool camp (G); south-west climbs to Tser Falls (H); east runs to an arching stone bridge and on to the village (E). Vistani escorts take the north-west road.')
    s.room('F-gallows', 'Gallows', rect(55.4, 31.6, 58.6, 36.2), 'dirt', 'The gallows: a rotting platform with steps, the beam and its rope above.', 'The Hanged One: see the hidden figure on the rope.')
    s.room('F-graves', 'Graves', plot, 'grass', 'Behind a tumbledown stone wall lies a small graveyard, mist lying low over its plain, unmarked headstones.',
           'Eleven graves of people hanged on the gallows and forgotten. Dug up: rotted coffins and mouldy bones. If the card reading puts a treasure here it is in one of the graves: 10% per grave dug, cumulative.')
    s.note((gp[0] - 4, gp[1] - 3), 'The Hanged One: as the party leaves, a creak from the gallows and a grey body hangs there. One random character sees themself; the others see an unfamiliar Barovian.', key='F-gallows')
    s.note((94, 35), 'East: an arching stone bridge over the Ivlis, then the village of Barovia (E).')
    s.note((6, 10), 'North-west, down through the trees: the river and the Tser Pool encampment (G).')
    s.note((12, 76), 'South-west, uphill: Tser Falls (H), then Ravenloft and Vallaki.')
    s.spawn((95, 40.8))
    s.write('River Ivlis Crossroads')


# ================================================================== H. Tser Falls (p.37)
def site_H():
    s = Site('H', 'Tser Falls', 90, 84, 505)
    gz, gw = 40.5, 12                 # the chasm's centre line and width (60 ft)
    lipN, lipS = gz - gw / 2, gz + gw / 2
    s.prop('gorge', (50, gz), rot=90, dims={'w': 60, 'len': 420, 'bz': (36 - 50) * 5, 'bw': 11}, label='The chasm', desc='Sheer, wet rock walls drop away into mist. Somewhere far below, the falls thunder into their pool.')
    s.keep.append((rect(0, lipN - 0.6, 90, lipS + 0.6), 0))
    s.walk = [rect(0, 0, 90, lipN), rect(0, lipS, 90, 84)]
    # the mountain to the west: the cliff the river leaps from, and the falls
    cliffs = [(5, 40.5, 52, 72, 92), (7, 26, 46, 40, 70), (6, 55, 46, 40, 74), (4, 11, 40, 46, 60), (4, 71, 40, 46, 62), (11, 33, 22, 18, 48), (11, 48, 22, 18, 50)]
    for i, (x, z, w, d, h) in enumerate(cliffs):
        s.prop('crag', (x, z), rot=s.rng.uniform(-10, 10), dims={'w': w, 'd': d, 'h': h, 'seed': i + 3}); s.keep.append((rect(x - w / 10, z - d / 10, x + w / 10, z + d / 10), 0.4))
    s.prop('waterfall', (12.6, gz), rot=90, dims={'w': 26, 'h': 62}, label='Tser Falls', desc='The river leaps from the mountainside in a white sheet and falls past you into the misty chasm, sending up cold clouds of spray.')
    # the high road: up the mountainside from the south, over the bridge, on north through the mountains
    bx = 36
    s.road([(42, 84), (38, 74), (35.5, 64), (35.4, 55), (bx, lipS + 2.4)], 1.9)
    s.road([(bx, lipN - 2.4), (36.6, 27), (39.5, 18), (44, 9), (49, 0)], 1.9)
    s.prop('stone-bridge', (bx, gz), rot=90, dims={'len': 86, 'w': 15, 'rise': 1.6, 'par': 3}, label='Bridge over Tser Falls',
           desc='A single stone arch leaps the chasm, its stones slick with spray and furred with mould.')
    for sx in (-1, 1):
        for sz in (-1, 1):
            ox, oz = turn(sx * (43 - 0.85) / 5, sz * (15 / 2 - 0.42) / 5, 90)
            s.prop('gargoyle-statue', (bx + ox, gz + oz), rot=90 if oz < 0 else -90, dims={'ped': 0}, y=3.75, label='Moss-cloaked gargoyle',
                   desc='A weathered stone gargoyle crouches on the corner post, shaggy with black moss.')
    s.keep.append((rect(bx - 2.5, lipN - 4, bx + 2.5, lipS + 4), 0.5))
    # the road's outer edge: a lip of rock where the mountainside drops away east
    for i in range(14):
        z = 50 + i * 2.4 if i < 7 else 32 - (i - 7) * 2.6
        line = (38.2 + (z - 50) * -0.05) if i < 7 else 39.5 + (32 - z) * 0.18
        s.prop('boulder', (line + s.rng.uniform(0.2, 1.0), z), dims={'r': rnd(1.2 + s.rng.random() * 1.4)})
    # rocks and scree on the slope west of the road
    slope = lambda x, z: 1.0 if 14 < x < 32 else 0.0
    s.scatter('boulder', 26, slope, margin=0.8, gap=1.6, dims=lambda g: {'r': rnd(1.6 + g.random() * 3)})
    s.scatter('rubble', 14, slope, margin=0.5, gap=1.4, dims={'n': 7})
    for i, (x, z) in enumerate([(22, 18), (24, 62), (18, 76), (26, 8), (20, 52), (25, 30)]):
        s.prop('crag', (x, z), rot=s.rng.uniform(0, 360), dims={'w': 14 + i * 2, 'd': 11, 'h': 9 + i, 'seed': 30 + i})
        s.keep.append((rect(x - 1.5, z - 1.2, x + 1.5, z + 1.2), 0.3))
    dens = lambda x, z: 0.95 if x > 41 else (0.18 if x > 14 else 0.0)
    s.pines(4200, density=dens, gap=2.3, margin=1.0, scale=(1.0, 1.5))
    s.scatter('dead-tree', 5, lambda x, z: 1.0 if 14 < x < 32 else 0.0, margin=1, gap=2.5, dims=lambda g: {'scale': rnd(0.8 + g.random() * 0.4)})
    s.undergrowth(bushes=26, boulders=6, dead=0, stumps=2, logs=3, density=lambda x, z: 1.0 if x > 41 else 0.2)
    H = [(26, 22), (48, 22), (48, lipN), (37.7, lipN), (37.7, lipS), (48, lipS), (48, 60), (26, 60), (26, lipS), (34.3, lipS), (34.3, lipN), (26, lipN)]
    s.room('H', 'Tser Falls', H, 'grass',
           'The road hugs the mountainside to a high stone bridge, green-black with mould, that leaps a sheer chasm; gargoyles squat on its four corners. Upstream the river pours off the mountain in a white fall and drops out of sight into the mist, a thousand feet to the pool below.',
           'The chasm walls are slippery and sheer: no climbing without magic or a climber\'s kit. The bridge is slick but safe. The gargoyles are harmless sculptures. South, the road runs down the mountainside to the crossroads (F); north it cuts through the mountains to the fork (I). The pool below feeds the river past the Tser Pool camp (G).')
    s.room('H-falls', 'Falls overlook', [(14, lipS), (24, lipS), (25, 53), (14, 54)], 'grass', 'A rocky shelf at the cliff foot, drenched in spray, looking up at the falls.',
           'This is where Strahd hurled the Mad Mage over the falls, as the Vistani storyteller at G recalls.', difficult=True)
    s.note((bx + 4, gz - 8), 'From the canyon floor below (the footpath from G): the bridge spans the canyon nearly a thousand feet overhead.')
    s.note((47, 4), 'North: through the mountains to the fork where the black carriage waits (I).')
    s.note((43, 80), 'South: down the mountainside to the River Ivlis crossroads (F).')
    s.spawn((40.6, 79))
    s.write('Tser Falls', {'valley': True})


# ================================================================== I. Black Carriage (p.37)
def site_I():
    s = Site('I', 'Black Carriage', 100, 80, 606)
    F = (46, 44)
    s.road([(40, 80), (41, 70), (43, 60), (45, 51), F], 2.0)
    s.road([F, (40, 38), (32, 30), (24, 22), (15, 13), (6, 4), (2, 0)], 2.0)
    east = s.road([F, (58, 42), (70, 40.6), (84, 40), (100, 39)], lambda f: 2.1 + 1.6 * f)
    for i, (f, r) in enumerate([(0.22, 7), (0.33, 9), (0.45, 6), (0.55, 10), (0.66, 8), (0.76, 11), (0.88, 9), (0.95, 7)]):
        p, t = along(east, f); off = s.rng.uniform(-0.8, 0.8)
        s.prop('paving', (p[0] - t[1] * off, p[1] + t[0] * off), rot=heading(*t), dims={'r': r, 'seed': i * 3 + 1})
    s.patch(blob(F[0], F[1], 3.2, 3, sx=1.1), 'dirt')
    # the carriage, parked at the fork and pointed east, its team before it
    cp = (54.5, 42.6); rot = heading(1, -0.17)
    s.hidden('black-carriage', cp, "Strahd's black carriage", 'A black carriage', rot=rot, dims={'open': 1},
             desc='A big black coach stands at the fork facing east, its lamps lit and its door hanging open, waiting.',
             dm='Here only if Strahd has invited the party or wants them at the castle. Room inside for eight; the horses then draw it down the east road to the Gates of Ravenloft (J) and cannot be turned from their course, not even by a skilled teamster.')
    for sz in (-1, 1):
        ox, oz = turn(15 / 5, sz * 3.2 / 5, rot)
        s.mob('black-horse', (cp[0] + ox, cp[1] + oz), 'Black draft horse (under Strahd\'s control)', 'A black horse', size='large', rot=rot,
              dm='Draft horse. It waits for the party to board, then takes the carriage to J.')
    s.keep.append((oriented_rect(cp[0] + 1.2, cp[1], 1, -0.17, 4.5, 2.2), 0.4))
    # the mountains: crags, fog lying in the hollows
    for i, (x, z, w, h) in enumerate([(70, 14, 60, 34), (86, 24, 44, 26), (14, 46, 50, 30), (8, 62, 40, 22), (78, 64, 46, 28), (60, 6, 40, 22), (28, 6, 30, 18), (92, 56, 30, 22), (24, 58, 24, 14), (66, 54, 22, 12)]):
        s.prop('crag', (x, z), rot=s.rng.uniform(0, 360), dims={'w': w, 'd': rnd(w * 0.7), 'h': h, 'seed': i + 11}); s.keep.append((rect(x - w / 11, z - w / 15, x + w / 11, z + w / 15), 0.3))
    for (x, z, L, d) in [(22, 68, 140, 60), (84, 70, 120, 40), (82, 12, 110, 50)]:
        s.prop('mist', (x, z), rot=s.rng.uniform(0, 40), dims={'len': L, 'h': 6, 'd': d})
    s.clear(F[0] + 4, F[1] - 1, 9)
    s.pines(3800, density=lambda x, z: 0.8, gap=2.4, margin=1.1, scale=(0.95, 1.45))
    s.undergrowth(bushes=26, boulders=22, dead=4, stumps=2, logs=3, density=lambda x, z: 1.0)
    s.room('I', 'Black Carriage', [(36, 33), (66, 33), (66, 53), (36, 53)], 'grass',
           'High in the mountains, the pines and the fog still press close. The track forks here; the eastern branch broadens, old cobbles showing through its mud, once a road of some importance.',
           'If Strahd has invited the party or wants to steer them to him, his black carriage waits here (see the hidden carriage and horses). Otherwise: north-west through a set of iron gates (the western Gates of Barovia) that open as the party approaches and close behind it; south down the winding road to the bridge at Tser Falls (H); east to the Gates of Ravenloft (J).')
    s.note((8, 8), 'North-west: the western Gates of Barovia, which open as the party approaches and close behind it.')
    s.note((94, 33), 'East: the old cobbled road to the Gates of Ravenloft (J).')
    s.note((44, 76), 'South: the winding road down to the bridge at Tser Falls (H).')
    s.spawn((41, 76))
    s.write('Black Carriage', {'valley': True})


# ================================================================== J. Gates of Ravenloft (p.38)
def site_J():
    """Matches the approach drawn into ch04/K (castle-ravenloft.py): the castle frame shifted 90 cells east and 1 south, so
    the curtain wall's outer face stands at x = 90, the 20-ft gate passage at z 33–37, the 50-ft chasm centred 27.5 ft
    west of the wall, the drawbridge (56 × 18 ft) over it and the castle's two gate towers either side."""
    s = Site('J', 'Gates of Ravenloft', 94, 70, 707)
    kx = lambda x: x + 90; kz = lambda z: z + 1
    gz = kz(34)
    s.prop('gorge', (kx(-5.5), gz), dims={'w': 50, 'len': 380, 'bz': 0, 'bw': 13}, label='The chasm', desc='Fog fills the chasm from wall to wall; there is no seeing the bottom.')
    s.keep.append((rect(kx(-11) - 0.5, 0, kx(0), 70), 0))
    s.walk = [rect(0, 0, kx(-10.5), 70)]
    s.prop('drawbridge', (kx(-5.5), gz), dims={'len': 56, 'w': 18}, label='Drawbridge', desc='The drawbridge lies down across the chasm on rusty chains that creak in the wind.')
    for sz in (-1, 1): s.prop('gate-tower', (kx(-1.6), gz + sz * 4.6), dims={'r': 7, 'h': 100}, label='Gate tower')
    # the curtain wall, 20 ft thick and 90 ft high (as K), the 20-ft gate passage through it under 74 ft of masonry. The
    # masonry is drawn as pieces so it stands whole in every view; along its faces, walls that block movement (invisible)
    # and sight (ethereal) do the wall's work without being drawn a second time.
    for a, b in [((kx(0), 0), (kx(0), kz(32))), ((kx(0), kz(36)), (kx(0), 70)), ((kx(4), 0), (kx(4), kz(32))), ((kx(4), kz(36)), (kx(4), 70)),
                 ((kx(0), kz(32)), (kx(4), kz(32))), ((kx(0), kz(36)), (kx(4), kz(36)))]:
        s.lv.wall(a, b, flags=['invisible']); s.lv.wall(a, b, flags=['ethereal'])
    s.patch(rect(kx(0), 0, kx(4), 70), 'flagstone')
    for z0, z1 in ((0, kz(32)), (kz(36), 70)):
        s.prop('curtain-wall', (kx(2), (z0 + z1) / 2), rot=90, dims={'len': rnd((z1 - z0) * 5, 1), 't': 20, 'h': 90}, label='Curtain wall', desc='The castle\'s curtain wall rises ninety feet, sheer and grey.')
    s.prop('curtain-wall', (kx(2), gz), rot=90, dims={'len': 20, 't': 20, 'h': 74}, y=16, label='Gatehouse arch')
    for z in (8, 20, 48, 60):
        s.prop('gargoyle-statue', (kx(0) + 0.14, z), rot=180, dims={'ped': 0}, y=93.4, label='Stone gargoyle', desc='A stone gargoyle leers down from the battlements.')
    o = s.prop('rotten-portcullis', (kx(0) + 0.15, gz), rot=90, dims={'w': 20, 'h': 14}, y=10, label='Rotting portcullis', desc='A wooden portcullis, rotten and furred green, is drawn up into the arch overhead.')
    o['dm'] = 'A patch of green slime clings to it (DC 20 Wisdom (Perception) to spot). It does not fall on characters entering the castle; it falls on the first character who leaves this way.'
    s.hidden('green-slime', (kx(0) + 0.35, gz + 0.8), 'Green slime on the portcullis', 'Green ooze', y=13,
             dm='Green slime (DMG ch.5). Spotted with DC 20 Wisdom (Perception). Falls on the first character to leave by this tunnel.')
    s.lv.light('court', (kx(4) - 0.5, gz), 'torch', 15, 30, y=8)
    # the broken turrets before the chasm, the cobbled road on the ridge, the road coming in from the north-west
    for i, sz in enumerate((-1, 1)):
        s.prop('ruined-turret', (kx(-14.5), gz + sz * 5.8), dims={'r': 6, 'h': 24 - i * 5, 'seed': i * 2 + 1}, label='Broken turret', desc='A stone guard turret, broken and roofless after years of weather.')
        s.keep.append((rect(kx(-14.5) - 2, gz + sz * 5.8 - 2, kx(-14.5) + 2, gz + sz * 5.8 + 2), 0.5))
    s.road([(14, 0), (18, 8), (24, 17), (31, 26), (38, 32), (47, gz)], 2.2)
    s.road([(46, gz), (60, gz), (kx(-11), gz)], 4, floor='cobble', per=2)
    s.patch([(kx(-11) - 0.2, gz - 2), (kx(-11) + 0.4, gz - 2), (kx(-11) + 0.4, gz + 2), (kx(-11) - 0.2, gz + 2)], 'cobble')
    # the carriage stops before the turrets
    cp = (64, gz)
    s.hidden('black-carriage', cp, "Strahd's black carriage", 'A black carriage', dims={'open': 1},
             desc='The black carriage stands before the turrets, its horses blowing steam.', dm='If the party came by carriage from I, it stops here; it waits for Strahd\'s pleasure.')
    for sz in (-1, 1): s.mob('black-horse', (cp[0] + 3, cp[1] + sz * 0.64), 'Black draft horse (under Strahd\'s control)', 'A black horse', size='large')
    # craggy peaks either side of the ridge; pines on the slopes, the ridge itself bare
    for i, (x, z, w, h) in enumerate([(20, 52, 60, 40), (40, 60, 50, 34), (60, 58, 46, 26), (12, 30, 40, 30), (40, 10, 46, 32), (62, 12, 44, 26), (6, 64, 30, 22), (70, 64, 30, 18), (74, 8, 28, 16)]):
        s.prop('crag', (x, z), rot=s.rng.uniform(0, 360), dims={'w': w, 'd': rnd(w * 0.7), 'h': h, 'seed': i + 21}); s.keep.append((rect(x - w / 11, z - w / 15, x + w / 11, z + w / 15), 0.3))
    s.clear(kx(-20), gz, 14)
    dens = lambda x, z: 0.0 if x > kx(-26) else (0.85 if abs(z - gz) > 8 or x < 40 else 0.15)
    s.pines(3600, density=dens, gap=2.4, margin=1.2, scale=(0.95, 1.5))
    s.undergrowth(bushes=18, boulders=20, dead=4, stumps=2, logs=2, density=lambda x, z: 1.0 if x < kx(-17) else 0.0)
    s.room('J', 'Gates of Ravenloft', [(46, gz - 8), (kx(-11), gz - 8), (kx(-11), gz + 8), (46, gz + 8)], 'grass',
           'The road swings east and Castle Ravenloft fills the sky. Two broken stone turrets guard the near edge of a fog-filled chasm fifty feet across; an old drawbridge spans it to the gate, and gargoyles leer down from the walls. Through the arch the castle doors stand open on a warmly lit courtyard.',
           'Assumes arrival by the black carriage from I; adjust otherwise. Beyond the gate passage: the front courtyard, K1 (open ch04/K).')
    s.room('J-bridge', 'Drawbridge', rect(kx(-11), kz(32), kx(0), kz(36)), 'plank', 'Old beams, patched and propped, with gaps where boards have fallen through. It groans under every step.',
           'Each crossing by anyone but Strahd or his carriage horses: 5% chance a board breaks. DC 10 Dexterity save or fall 1,000 ft to the bottom of the cliffs; advantage if a companion within 5 ft reaches out to grab.')
    s.room('J-gate', 'Entry tunnel', rect(kx(0), kz(32), kx(4), kz(36)), 'flagstone', 'A tunnel through the curtain wall under the rotting portcullis, warm light at its far end.', 'Green slime on the portcullis (see the hidden object).')
    s.note((kx(-6), kz(30)), 'The drawbridge: 5% per crosser that a board gives way (not for Strahd or his horses); DC 10 Dex save or fall 1,000 ft.', key='J-bridge')
    s.note((14, 6), 'North-west: the road back through the mountains to the fork (I).')
    s.spawn((58, gz))
    s.write('Gates of Ravenloft', {'valley': True})


# ================================================================== L. Lake Zarovich (p.38)
def site_L():
    s = Site('L', 'Lake Zarovich', 110, 120, 808)
    shore = catmull([(0, 92), (14, 95), (28, 99), (40, 100.2), (52, 99.6), (64, 100.6), (78, 97), (94, 93), (110, 95)], 5)
    lake = [(0, 0), (110, 0)] + [(rnd(x), rnd(z)) for x, z in reversed(shore)]
    s.room('L', 'Lake Zarovich', lake, 'shallow-water',
           'A great lake lies under the mountain, ringed by misty forest. The water is black and dead calm, a mirror for the clouds.',
           'Daytime from the shore north of Vallaki: three rowboats are pulled up on the south shore and a fourth sits out on the lake with a lone figure fishing. Each rowboat safely holds five.')
    beach = [(rnd(x), rnd(z)) for x, z in shore] + [(rnd(x), rnd(z + 2.4 + (2.6 if 42 < x < 66 else 0))) for x, z in reversed(shore)]
    s.patch(beach, 'dirt'); s.keep.append((lake, 0.4)); s.keep.append((beach, 0.3))
    s.road([(56, 120), (55.2, 112), (53.6, 106), (52.6, 103)], 1.5)
    # three rowboats hauled up on the south shore, the net shed beside the landing
    for i, (x, z, r) in enumerate([(46.6, 101.9, 86), (50.2, 102.4, 96), (59.6, 102.2, 101)]):
        s.prop('rowboat', (x, z), rot=r, dims={'hauled': 1, 'oars': 1}, label='Rowboat', desc='A small rowboat pulled up on the shore, oars shipped. It holds five.')
    s.prop('net-shed', (64.5, 106.4), rot=180, label='Net shed', desc="A fisherman's lean-to of weathered boards, nets drying on a rack beside it.")
    s.keep.append((rect(61, 104, 69, 109.5), 0.4))
    # Bluto's boat, four hundred feet out
    bp = (54, 19.6)
    s.prop('rowboat', bp, rot=15, dims={'oars': 1, 'pole': 1}, label="Bluto's rowboat", desc='Far out on the water a single rowboat sits motionless, someone in it holding a fishing pole.')
    s.mob('commoner', (bp[0] - 0.3, bp[1] + 0.1), 'Bluto Krogarov (commoner)', 'A lone fisherman', rot=105,
          dm='A destitute Vallaki drunkard in a trance; he answers nothing unless attacked, is unarmed and neither helps nor hinders. If watched from shore for several minutes, or approached by boat, he tosses the sack overboard and waits for his fish.')
    s.mob('sacked-child', (bp[0] + 0.45, bp[1] - 0.05), 'Arabelle, bound in a burlap sack (commoner, 2 hp)', 'A burlap sack', size='small', rot=15,
          dm='Seven-year-old Vistana, bound with rope in the sack, lying prone so she cannot be seen or heard from shore. Once the sack goes in: DC 15 Strength (Athletics) from shore to reach her in time, DC 10 for anyone in a rowboat. Rescued, she asks to be taken to her father Luvash at the Vistani camp outside Vallaki (N9), promising a reward.')
    s.note((bp[0] + 4, bp[1] + 4), 'Bluto\'s boat lies 400 ft from the nearest shore.')
    for i in range(20):
        p, t = along(shore, 0.02 + i * 0.05)
        if 40 < p[0] < 70: continue
        s.prop('reeds', (p[0] - t[1] * 0.4, p[1] + t[0] * 0.4 - 0.6), dims={'r': rnd(1.4 + s.rng.random() * 1.6), 'n': 10})
    for i in range(10):
        p, _ = along(shore, s.rng.random())
        s.prop('boulder', (p[0], p[1] + 1.2 + s.rng.random() * 1.6), dims={'r': rnd(1 + s.rng.random() * 1.5)})
    s.clear(55, 104, 8)
    s.pines(3200, density=lambda x, z: 1.0 if z > 98 else 0.0, gap=2.3, margin=1.0, scale=(1.0, 1.55))
    s.undergrowth(bushes=24, boulders=4, dead=2, stumps=6, logs=3, density=lambda x, z: 1.0 if z > 101 else 0.0)
    s.room('L-shore', 'South shore landing', [(42, 100), (68, 100), (68, 107.5), (42, 107.5)], 'grass',
           'A strip of muddy shingle where the Vallaki fishers pull up their boats.', 'The three rowboats here are free for the taking; each holds five.')
    s.note((60, 117), 'South: the track back to Vallaki (N).')
    s.spawn((55.6, 116))
    s.write('Lake Zarovich')


# ================================================================== M. Mount Baratok (p.39)
def site_M():
    s = Site('M', 'Mount Baratok', 90, 90, 909)
    s.road([(40, 90), (42, 79), (46, 68), (44, 58), (39, 47), (35, 35), (37, 23), (42, 13), (46, 4), (47, 0)], 0.7)
    # the mountain's flank across the north, crags and scree down the slope
    for i, x in enumerate(range(4, 90, 9)):
        s.prop('crag', (x + s.rng.uniform(-1.5, 1.5), 3.5 + s.rng.uniform(-1, 2)), rot=s.rng.uniform(-25, 25), dims={'w': rnd(s.rng.uniform(64, 86)), 'd': 48, 'h': rnd(s.rng.uniform(70, 120)), 'seed': i + 41})
    for i, x in enumerate(range(9, 90, 18)):
        s.prop('crag', (x + s.rng.uniform(-2, 2), 12 + s.rng.uniform(-1, 2)), rot=s.rng.uniform(0, 360), dims={'w': rnd(s.rng.uniform(30, 44)), 'd': 26, 'h': rnd(s.rng.uniform(16, 30)), 'seed': i + 71})
        s.keep.append((rect(x - 3.5, 9.5, x + 3.5, 14.5), 0.3))
    s.keep.append((rect(0, 0, 90, 9.5), 0))
    for i, (x, z, w, h) in enumerate([(14, 22, 40, 22), (70, 20, 46, 28), (80, 40, 30, 16), (10, 46, 34, 18), (64, 56, 26, 12), (24, 34, 22, 10), (58, 30, 20, 9), (84, 64, 24, 10)]):
        s.prop('crag', (x, z), rot=s.rng.uniform(0, 360), dims={'w': w, 'd': rnd(w * 0.7), 'h': h, 'seed': i + 51}); s.keep.append((rect(x - w / 11, z - w / 15, x + w / 11, z + w / 15), 0.3))
    # the rocky spur, sixty feet from where the party comes up
    sp = (50, 42.4)
    s.prop('crag', sp, rot=20, dims={'w': 34, 'd': 20, 'h': 12, 'seed': 7, 'top': 1}, label='Rocky spur', desc='A spur of rock juts from the slope, flat-topped, twelve feet up.')
    s.keep.append((rect(sp[0] - 3.5, sp[1] - 2.2, sp[0] + 3.5, sp[1] + 2.2), 0.4))
    s.mob('elk', sp, 'Elk (the Mad Mage, polymorphed)', 'An elk', size='large', rot=200, y=12,
          dm='The Mad Mage in elk form (polymorph). When he feels watched he resumes his own shape; swap in the hidden Mad Mage.')
    s.mob('mad-mage', (sp[0] + 0.9, sp[1] + 0.1), 'The Mad Mage of Mount Baratok (archmage; Mordenkainen)', 'A wild-eyed man in black robes', rot=200, y=12,
          dm='Archmage (spell list p.39; mage armor, polymorph, magnificent mansion and mind blank already cast). Paranoid: attacks on sight; at 50 hp or fewer he tries to escape. Mind blank (3d6 hours left) defeats greater restoration; DC 15 Persuasion gets him to explain, DC 18 Arcana deduces it.')
    s.hidden('shimmer-door', (38, 10.6), "Invisible doorway to the Mad Mage's magnificent mansion", 'Bare rock', rot=0,
             dm='Restored to his wits, he leads the party here: food and safe rest, undisturbed. Mordenkainen\'s magnificent mansion.')
    s.prop('mist', (45, 83), dims={'len': 480, 'h': 9, 'd': 70}, label='The fog below', desc='You have climbed out of the fog; it lies below you now, filling the valley.')
    rocky = lambda x, z: 1.0 if z < 70 else 0.3
    for k in range(6): s.clear(sp[0] + (47.4 - sp[0]) * k / 5, sp[1] + (54.6 - sp[1]) * k / 5, 3.2)   # the party sees the spur from where it comes up
    s.scatter('boulder', 90, rocky, margin=0.6, gap=1.5, dims=lambda g: {'r': rnd(1.3 + g.random() * 3.4)})
    s.scatter('rubble', 45, rocky, margin=0.4, gap=1.3, dims={'n': 7})
    s.pines(3200, density=lambda x, z: 0.0 if z < 14 else (0.95 if z > 68 else 0.06 + 0.5 * ((z - 14) / 54) ** 2.2), gap=2.4, margin=0.8, scale=(0.8, 1.35))
    s.scatter('dead-tree', 8, lambda x, z: 1.0 if 12 < z < 60 else 0.0, margin=0.8, gap=2.5, dims=lambda g: {'scale': rnd(0.8 + g.random() * 0.4)})
    s.undergrowth(bushes=20, boulders=0, dead=0, stumps=0, logs=4, density=lambda x, z: 1.0 if z > 50 else 0.2)
    s.room('M', 'Mount Baratok', [(4, 12), (86, 12), (86, 70), (4, 70)], 'grass',
           "The pines thin as the slope steepens toward the mountain's bare shoulders; the going is all loose rock and broken ground. Below, the valley lies drowned in fog, and storm clouds boil overhead. Some sixty feet off, an elk stands on a jutting spur of rock.",
           'Rocky slope: difficult terrain. Even the wolves avoid this neck of the woods. The encounter can happen anywhere along the mountain\'s base. If the party cures the Mad Mage he leads them up to his mansion; if the card reading names him their ally he helps against Strahd, otherwise he leaves to seek his staff and spellbook after granting each a charm of heroism.',
           difficult=True)
    s.note((sp[0] + 6, sp[1] - 3), 'Once noticed, the elk turns into a ragged, wild-haired man in black robes, his eyes sparking with magic.')
    s.spawn((47.4, 54.6))
    s.write('Mount Baratok', {'valley': True})


# ================================================================== P. Luna River Crossroads (p.40)
def site_P():
    s = Site('P', 'Luna River Crossroads', 100, 100, 1010)
    J = (48, 50)
    s.road([J, (58, 42), (70, 32), (82, 22), (92, 13), (100, 6)], 2.2)
    s.road([J, (38, 58), (27, 68), (16, 79), (6, 90), (0, 96)], 2.2)
    s.road([J, (42, 42), (36, 33), (29, 23), (20, 12), (13, 0)], 1.7)
    s.road([J, (55, 58), (61, 67), (66, 78), (70, 89), (72, 100)], 1.5)
    s.patch(blob(J[0], J[1], 3.4, 4, sx=1.1), 'dirt')
    river = catmull([(102, 38), (93, 50), (86, 61), (82, 73), (81, 86), (83, 102)], 6)
    s.patch(clamp_poly([(rnd(x), rnd(z)) for x, z in ribbon(river, 3.5)], 100, 100), 'shallow-water')
    for side in (1, -1): s.patch(clamp_poly([(rnd(x), rnd(z)) for x, z in band(river, side * 3.5, side * 3.9)], 100, 100), 'dirt')
    s.keep.append((ribbon(river, 4.8), 0))
    for i in range(14):
        p, t = along(river, 0.03 + i * 0.07)
        for side in (1, -1):
            q = (p[0] - t[1] * side * 3.6, p[1] + t[0] * side * 3.6); b = (p[0] - t[1] * side * 5.2, p[1] + t[0] * side * 5.2)
            if s.rng.random() < 0.5 and s.inmap(q): s.prop('reeds', q, dims={'r': rnd(1.2 + s.rng.random() * 1.2), 'n': 8})
            if s.rng.random() < 0.25 and s.inmap(b): s.prop('boulder', b, dims={'r': rnd(1 + s.rng.random() * 1.4)})
    # the snapped signpost at the eastern elbow, its top in the weeds
    s.prop('fingerpost', (53.4, 50.6), rot=35, dims={'broken': 1}, label='Snapped signpost', desc='A splintered post, all that still stands of a signpost, leaning askew.')
    s.prop('fingerpost', (56.2, 53.4), dims={'broken': 2, 'a0': 225, 'a1': 315, 'a2': 45, 'a3': 135}, label="Signpost's top half",
           desc='The top of the signpost lies in the weeds, its four arms pointing every which way.')
    s.scatter('weeds', 18, lambda x, z: 1.0 if math.hypot(x - J[0] - 1, z - J[1]) < 11 else 0.0, margin=0.3, gap=1.2, dims={'n': 4, 'r': 1.6}, circles=False)
    s.clear(J[0] + 2, J[1] + 1, 12)
    s.pines(4400, density=lambda x, z: 0.95, gap=2.3, margin=1.0, scale=(1.0, 1.55))
    s.undergrowth(bushes=40, boulders=10, dead=4, stumps=6, logs=5, density=lambda x, z: 1.0)
    s.room('P', 'Luna River Crossroads', [(33, 36), (64, 36), (64, 65), (33, 65)], 'grass',
           'Two roads cross here. By the eastern corner the stump of a broken signpost leans out of the ground; the rest of it, four arms and all, lies in the long grass a few paces away.',
           'Always check for a random encounter here. Rejoined, the sign reads: Krezk and Tsolenka Pass south-west, Lake Baratok north-west, Vallaki and Ravenloft north-east, Berez south-east. The Old Svalich Road (NE to SW) is level; a quarter mile north-east an arching stone bridge crosses the Luna River. The north-west branch climbs gently, a dirt trail within half a mile, rejoining the Old Svalich Road after a couple of miles with a branch to Van Richten\'s Tower on Lake Baratok (V). The south-east trail wends down along the river to Berez (U).')
    s.note((92, 6), 'North-east: Vallaki (N); the Luna River bridge a quarter mile on.')
    s.note((6, 92), 'South-west: the Old Svalich Road to Krezk (S) and the Tsolenka Pass road.')
    s.note((14, 4), 'North-west: Lake Baratok and Van Richten\'s Tower (V).')
    s.note((70, 96), 'South-east: down the river valley to the ruins of Berez (U).')
    s.spawn((92.5, 13.4))
    s.write('Luna River Crossroads')


# ================================================================== R. Raven River Crossroads (p.40)
def site_R():
    s = Site('R', 'Raven River Crossroads', 110, 100, 1111)
    S = (56, 54)
    river = catmull([(71, -2), (63, 11), (55, 20), (45, 25), (32, 27.5), (18, 30), (6, 32.5), (-2, 33.8)], 6)
    s.patch(clamp_poly([(rnd(x), rnd(z)) for x, z in ribbon(river, 3.5)], 110, 100), 'shallow-water')
    for side in (1, -1): s.patch(clamp_poly([(rnd(x), rnd(z)) for x, z in band(river, side * 3.5, side * 3.9)], 110, 100), 'dirt')
    s.keep.append((ribbon(river, 4.8), 0))
    # the bridge where the Krezk road crosses the river, square to the stream
    bc = (52.4, 22.2); nrm = (0.45, 0.893); half = 6.6
    south_end = (bc[0] + nrm[0] * half, bc[1] + nrm[1] * half); north_end = (bc[0] - nrm[0] * half, bc[1] - nrm[1] * half)
    s.prop('stone-bridge', bc, rot=heading(-nrm[0], -nrm[1]), dims={'len': 70, 'w': 15, 'rise': 1.5, 'par': 3}, label='Arching stone bridge', desc='An arching stone bridge spans the river, glimpsed through the trees from the crossroads.')
    s.room('R-bridge', 'Bridge over the Raven River', oriented_rect(bc[0], bc[1], nrm[0], nrm[1], half, 1.5), 'flagstone', 'An old stone span over the Raven River.', 'The Old Svalich Road crosses here on its way to Krezk (S).')
    # the roads
    s.road([S, (68, 53), (80, 53.5), (94, 52), (110, 51)], 2.2)
    s.road([S, (56, 46), (55.8, 37), south_end], 2.2)
    s.road([north_end, (north_end[0] - 1.2, north_end[1] - 3), (46, 9), (42, 3), (40, 0)], 2.2)
    s.road([S, (48, 61), (38, 70), (30, 77.5)], 2.0)
    s.road([(30, 77.5), (22, 85), (14, 92), (7, 100)], 1.4)
    s.road([(76, 53.4), (77, 44), (79, 34), (83, 22), (88, 10), (92, 0)], 1.1)
    s.road([(88, 52.6), (89, 64), (91, 76), (94, 88), (97, 100)], 1.8)
    s.patch(blob(S[0], S[1], 3.3, 6, sx=1.1), 'dirt')
    for i in range(16):
        x, z = 7 + i * 1.4 + s.rng.uniform(-0.5, 0.5), 100 - i * 1.4 + s.rng.uniform(-0.5, 0.5)
        if z < 98.5: s.prop('rubble', (x, z), dims={'n': 4})
    s.prop('fingerpost', (59.6, 50.4), dims={'a0': 0, 'a1': 90, 'a2': 225}, label='Signpost',
           desc='A weathered three-armed signpost: Krezk, Vallaki, The Wizard of Wines.')
    s.prop('dead-tree', (62.6, 58.6), dims={'scale': 1.5}, label='Dead tree')
    s.keep.append((rect(61, 57, 64, 60), 0.4))
    s.scatter('weeds', 14, lambda x, z: 1.0 if math.hypot(x - S[0] - 1, z - S[1]) < 10 else 0.0, margin=0.3, gap=1.2, dims={'n': 4, 'r': 1.5}, circles=False)
    for i in range(14):
        p, t = along(river, 0.03 + i * 0.07)
        if math.hypot(p[0] - bc[0], p[1] - bc[1]) < 7: continue
        for side in (1, -1):
            q = (p[0] - t[1] * side * 3.6, p[1] + t[0] * side * 3.6); b = (p[0] - t[1] * side * 5.2, p[1] + t[0] * side * 5.2)
            if s.rng.random() < 0.5 and s.inmap(q): s.prop('reeds', q, dims={'r': rnd(1.2 + s.rng.random() * 1.2), 'n': 8})
            if s.rng.random() < 0.25 and s.inmap(b): s.prop('boulder', b, dims={'r': rnd(1 + s.rng.random() * 1.4)})
    s.clear(S[0] + 2, S[1] + 1, 11)
    s.pines(4800, density=lambda x, z: 0.95, gap=2.3, margin=1.0, scale=(1.0, 1.55))
    s.undergrowth(bushes=40, boulders=12, dead=4, stumps=6, logs=5, density=lambda x, z: 1.0)
    s.room('R', 'Raven River Crossroads', [(43, 41), (70, 41), (70, 66), (43, 66)], 'grass',
           'Roads branch at a weathered signpost: Krezk to the north, toward a stone bridge glimpsed through the trees; Vallaki to the east, up a gentle rise; The Wizard of Wines to the south-west, gently downhill.',
           'Always check for a random encounter here. Along this stretch a branch also heads north, soon a dirt path to Van Richten\'s Tower on Lake Baratok (V), and another heads south to become the Tsolenka Pass road (T) along Mount Ghakis. The winery road dips south and turns from road to gravel trail.')
    s.note((40, 2), 'North, over the bridge: the village of Krezk (S).')
    s.note((104, 46), 'East: the Old Svalich Road climbs gently toward Vallaki (N).')
    s.note((92, 4), 'North: the dirt path to Van Richten\'s Tower on Lake Baratok (V).')
    s.note((95, 96), 'South: the road that becomes the Tsolenka Pass (T).')
    s.note((10, 94), 'South-west: the gravel trail down to the Wizard of Wines winery (W).')
    s.spawn((104, 51.3))
    s.write('Raven River Crossroads')


SITES = {'A': site_A, 'B': site_B, 'D': site_D, 'F': site_F, 'H': site_H, 'I': site_I, 'J': site_J, 'L': site_L, 'M': site_M, 'P': site_P, 'R': site_R}
if __name__ == '__main__':
    for k in (sys.argv[1:] or SITES):
        SITES[k]()
