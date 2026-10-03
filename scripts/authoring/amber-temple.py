#!/usr/bin/env python3
"""The Amber Temple (chapter 13, area X; maps p.182 upper level and p.190 lower level, one square = 10 ft).
-> locations/ch13/X/{scene,grid}.json

Read off the book's two plates on one shared 10-ft grid: the lower plate registers on the upper one by the temple's
four columns and its two great stairs (lower = upper shifted 5 squares west and 19 squares north). Measurements are
written in 10-ft SQUARES (i east, j south, origin near the facade) and turned into 5-ft cells by S(); half squares are
whole cells. Only keys, names, page refs, dimensions and placements live here; descriptions are our own short words.

Three stacked levels (elevations from the text):
  facade  +40   the snowy ledge before the facade (X1) and the rubble pocket at the fissure's mouth (X1a); the icy
                steps descend ten feet to the entrance hall
  upper   +30   the balcony level: overlook (X4), galleries, shrines, the lich's rooms and the library (map p.182);
                the temple of lost secrets (X5) is open to the floor 30 ft below
  lower     0   the temple floor, the amber vaults, the catacombs, the treasuries and the amber vault (map p.190)
Stairs that span both plates (X14, X21, X5b, the library's spiral) are split where the plates split them.
"""
import json, math, os, sys
from collections import OrderedDict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from authorlib import ROOT, Level, rect, unit_edges, seg_key  # noqa: F401

OUT = os.path.join(ROOT, 'locations', 'ch13', 'X')
_M = json.load(open(os.path.join(ROOT, 'manifests', 'locations.json')))
PAGE = {a['key']: a['page'] for l in _M['locations'] if l['id'] == 'X' for a in l['areas']}
def pg(k): return PAGE.get(k.split('-')[0])

# ------------------------------------------------------------------ the frame
def S(i, j):
    """A point in 10-ft squares of the book's grid -> 5-ft cells."""
    return (round(2 * (i + 4), 4), round(2 * (j + 30), 4))
def R(i0, j0, i1, j1): return rect(*S(i0, j0), *S(i1, j1))
def poly(*pts): return [S(*p) for p in pts]
def arc(ci, cj, ri, rj, a0, a1, n, ends=True):
    """Points on an ellipse (squares -> cells); angles in degrees, 0 = east, 90 = south (map down)."""
    out = []
    for k in range(n + 1):
        if not ends and k in (0, n): continue
        a = math.radians(a0 + (a1 - a0) * k / n)
        out.append(S(ci + ri * math.cos(a), cj + rj * math.sin(a)))
    return out
def FT(i, j): c, r = S(i, j); return [c * 5, r * 5]

MATS = {}      # room key -> wall material of its inner face
CEIL = {}      # room key -> ceiling height (ft)

class XLevel(Level):
    """A Level whose walls take their material and height from the rooms they bound."""
    def __init__(self, *a, void=None, **kw):
        super().__init__(*a, **kw)
        self.void = void or []   # (a, b) cell segments whose walls rise as the temple's 60-ft walls (upper level)
    def rm(self, key, name, pts, floor='flagstone', mat='ashlar', ceil=10, **extra):
        MATS[key] = mat; CEIL[key] = ceil
        self.room(key, name, pts, floor, page=pg(key), ceilingFt=ceil, **extra)
    def stamp_seg(self, a, b, **kw):
        k = seg_key(a, b); self.overrides[k] = dict(self.overrides.get(k, {}), **kw)
    def open_seg(self, a, b): self.stamp_seg(a, b, open_wall=True)
    def mat_seg(self, a, b, m):
        """Give one polygon edge (cells) its own wall material: axis-aligned edges are stamped cell by cell."""
        if a[0] == b[0] or a[1] == b[1]: self._stamp(a, b, material=m)
        else: self.stamp_seg(a, b, material=m)
    def finish(self):
        """Per unit edge: amber wins over stone; height is the tallest ceiling either side (capped by the level)."""
        owners = {}
        for key, _n, pts, _f, _x in self.rooms:
            for a, b in unit_edges(pts): owners.setdefault(seg_key(a, b), []).append(key)
        on_void = set()
        for a, b in self.void:
            n = max(1, int(round(abs(b[0] - a[0]) + abs(b[1] - a[1]))))
            for k in range(n):
                p0 = (a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n); p1 = (a[0] + (b[0] - a[0]) * (k + 1) / n, a[1] + (b[1] - a[1]) * (k + 1) / n)
                on_void.add(seg_key(p0, p1))
        for k, keys in owners.items():
            ov = self.overrides.get(k, {})
            mats = [MATS[x] for x in keys]
            m = 'amber' if 'amber' in mats else ('cave-rock' if all(x == 'cave-rock' for x in mats) else next(x for x in mats if x != 'cave-rock'))
            h = max(CEIL[x] for x in keys)
            if k in on_void: h = max(h, 30)
            if self.id == 'lower': h = min(h, self.ceiling)
            new = {}
            if 'material' not in ov: new['material'] = m
            if 'heightFt' not in ov and h != self.ceiling: new['heightFt'] = h
            if new: self.overrides[k] = dict(ov, **new)
    def build_walls(self):
        self.finish()
        count = {}
        for _, _, poly_, _, _ in self.rooms:
            for a, b in unit_edges(poly_):
                k = seg_key(a, b); count[k] = count.get(k, 0) + 1
        segs = []
        for k, c in count.items():
            ov = self.overrides.get(k, {})
            if ov.get('open_wall'): continue
            a, b = k
            w = OrderedDict(id=ov.get('id') or f'{self.id}-w-{len(segs)}', a=[round(a[0] * 5, 3), round(a[1] * 5, 3)], b=[round(b[0] * 5, 3), round(b[1] * 5, 3)],
                            flags=ov.get('flags', ['normal']), material=ov.get('material') or (self.interior if c > 1 else self.exterior))
            if 'heightFt' in ov: w['heightFt'] = ov['heightFt']
            if 'door' in w['flags']: w['open'] = ov.get('open', False)
            segs.append((k, w))
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
        merged, used, by_start = [], set(), {}
        for k, w in segs: by_start.setdefault(tuple(w['a']), []).append((k, w))
        def plain(w): return w['flags'] == ['normal']
        for k, w in segs:
            if k in used: continue
            used.add(k); cur = OrderedDict(w)
            if plain(w):
                while True:
                    nxt = None
                    for k2, w2 in by_start.get(tuple(cur['b']), []):
                        if k2 in used or not plain(w2) or w2['material'] != cur['material'] or w2.get('heightFt') != cur.get('heightFt'): continue
                        dx1, dz1 = cur['b'][0] - cur['a'][0], cur['b'][1] - cur['a'][1]
                        dx2, dz2 = w2['b'][0] - w2['a'][0], w2['b'][1] - w2['a'][1]
                        if abs(dx1 * dz2 - dz1 * dx2) < 1e-6 and (dx1 * dx2 + dz1 * dz2) > 0: nxt = (k2, w2); break
                    if not nxt: break
                    used.add(nxt[0]); cur['b'] = nxt[1]['b']
            merged.append(cur)
        for i, w in enumerate(merged):
            if w['id'].startswith(f'{self.id}-w-'): w['id'] = f'{self.id}-w-{i}'
        for j, (a, b, kw) in enumerate(self.extra):
            w = OrderedDict(id=kw.get('id') or f'{self.id}-x-{j}', a=[round(a[0] * 5, 3), round(a[1] * 5, 3)], b=[round(b[0] * 5, 3), round(b[1] * 5, 3)], flags=kw.get('flags', ['normal']), material=kw.get('material', self.interior))
            if 'heightFt' in kw: w['heightFt'] = kw['heightFt']
            merged.append(w)
        return merged
    # placement helpers in squares
    def P(self, id, kind, i, j, key, rotY=0, dims=None, y=0, desc=None, dm=None):
        self.prop(id, kind, S(i, j), key, rotY=rotY, dims=dims, y=y); self._say(desc, dm)
    def H(self, id, kind, i, j, key, label, rotY=0, dims=None, desc=None, dm=None):
        self.hidden(id, kind, S(i, j), key, label, rotY=rotY, dims=dims); self._say(desc, dm)
    def C(self, id, kind, i, j, key, label, size='medium', dims=None, playerLabel=None):
        self.creature(id, kind, S(i, j), key, label, size=size)
        if dims: self.objects[-1]['dims'] = dims
        if playerLabel: self.objects[-1]['playerLabel'] = playerLabel
    def N(self, id, i, j, key, text): self.note(id, S(i, j), key, text)
    def L(self, id, i, j, preset, bright, dim, y=6): self.light(id, S(i, j), preset, bright, dim, y=y)
    def D(self, a, b, **kw): self.door(S(*a), S(*b), **kw)
    def O(self, a, b): self.opening(S(*a), S(*b))
    def SD(self, a, b, id, label, key): self.secret(S(*a), S(*b), id, label, key)
    def rail(self, a, b, mat='ashlar'): self._stamp(S(*a), S(*b), flags=['normal'], heightFt=3.5, material=mat, wall=True)
    def _say(self, desc, dm):
        if desc: self.objects[-1]['desc'] = desc
        if dm: self.objects[-1]['dm'] = dm
    def slit(self, id, i, j, key, rotY):
        """An arrow slit in the wall line at (i, j): a narrow slot through the stone, seen from both faces."""
        self.P(id, 'arrow-slit', i, j, key, rotY=rotY, desc='A narrow slit cut through the wall.', dm='Arrow slit: three-quarters cover; passive Perception 12 to notice from the temple side.')

def plus_vault(cx, cj):
    """The amber vaults are crosses of five 10-ft squares; (cx, cj) is the centre square's north-west corner."""
    return poly((cx, cj - 1), (cx + 1, cj - 1), (cx + 1, cj), (cx + 2, cj), (cx + 2, cj + 1), (cx + 1, cj + 1), (cx + 1, cj + 2),
                (cx, cj + 2), (cx, cj + 1), (cx - 1, cj + 1), (cx - 1, cj), (cx, cj))

# ================================================================== FACADE (+40): the snowy ledge
f = XLevel('facade', 'Facade and ledge (+40 ft)', 40, 50, ambient='barovian-overcast', interior='cave-rock', exterior='cave-rock', north='-z')
ALCOVES = (0.5, 3.5, 6.5, 10.5, 13.5, 16.5)          # the six statue alcoves, symmetric about the entrance arch (8.5)
pts = [(-3, -2), (-1.5, -2)]
for a in ALCOVES:
    pts += [(a - 0.5, -2), (a - 0.5, -2.25), (a - 0.25, -2.5), (a + 0.25, -2.5), (a + 0.5, -2.25), (a + 0.5, -2)]
    if a == 6.5: pts += [(8, -2), (9, -2)]
pts += [(18.5, -2), (19.5, -1), (21, -1), (21, 6), (-4.5, 6), (-4.5, 0), (-3, -1)]
f.rm('X1', 'Temple Facade', poly(*pts), 'snow', mat='ashlar', ceil=50)
f.rm('X1a', 'Narrow Fissure', R(-3, -4, -1.5, -2), 'dirt', mat='cave-rock', ceil=50, difficult=True)
f.O((-3, -2), (-1.5, -2))                                  # the pocket opens on the ledge
f.O((8, -2), (9, -2))                                      # the archway: icy steps down to the entrance (X2)
f.O((21, -1), (21, 6)); f.O((21, 6), (-4.5, 6)); f.O((-4.5, 6), (-4.5, 0))   # the ledge runs on south, east and west
for a, b in [((18.5, -2), (19.5, -1)), ((19.5, -1), (21, -1)), ((-4.5, 0), (-3, -1)), ((-3, -1), (-3, -2))]:   # the cliffs either side
    if a[0] == b[0] or a[1] == b[1]: f._stamp(S(*a), S(*b), material='cave-rock', wall=True)
    else: f.stamp_seg(S(*a), S(*b), material='cave-rock')
f.terrain.append((poly((-14, -1), (-4.5, -1), (-4.5, 6), (21, 6), (21, -1.5), (31, -1.5), (31, 16), (-14, 16)), 'snow'))
f.terrain.append((poly((6.75, 6), (7.15, 6), (7.35, 4.6), (7.1, 4.6)), 'dirt'))       # the gravel road, soon lost under the snow
f.terrain.append((poly((5.7, 16), (6.4, 16), (7.15, 6), (6.75, 6)), 'dirt'))
for k, a in enumerate(ALCOVES):
    f.P(f'statue{k}', 'amber-statue', a, -2.2, 'X1', dims={'h': 20}, desc='A twenty-foot statue of a faceless, hooded figure carved from one block of amber, hands pressed together in prayer.',
        dm='Impervious to damage. Staring at one for long breeds unease.')
f.P('arch', 'facade-arch', 8.5, -2, 'X1', dims={'w': 10, 'h': 20, 'top': 50}, desc='A twenty-foot archway between the two inner statues; icy steps lead down into darkness.')
for k, (i, j, r) in enumerate([(-0.6, -1.4, 2.2), (2.2, -1.0, 1.6), (5.1, -1.5, 1.4), (12.0, -1.2, 1.8), (15.2, -1.5, 1.3), (17.8, -1.1, 2.4),
                               (19.8, -0.4, 3.2), (-3.6, 0.6, 3.0), (11.3, 0.4, 1.2), (4.0, 0.2, 1.1), (-2.6, -1.4, 1.8), (20.4, 2.6, 2.6)]):
    f.P(f'rock{k}', 'boulder', i, j, None, rotY=k * 47, dims={'r': r})
for k, (i, j, w, d) in enumerate([(1.5, 1.5, 22, 12), (14.5, 1.8, 26, 14), (-2.5, 3.5, 18, 16), (18.5, 4.2, 20, 16), (9.5, 4.5, 16, 10)]):
    f.P(f'drift{k}', 'snow-drift', i, j, None, rotY=k * 31, dims={'w': w, 'd': d, 'h': 1.6 + (k % 2) * 0.8})
f.P('X1a-rubble', 'rubble', -2.3, -3.2, 'X1a', dims={'n': 9}); f.P('X1a-rock', 'boulder', -2.6, -2.5, 'X1a', dims={'r': 1.6})
f.N('X1-road', 8.0, 3.0, 'X1', 'The gravel road climbs north from Tsolenka Pass and fades under the snow short of the facade.')
f.N('X1a-note', -2.2, -3.6, 'X1a', 'Fissure 2 ft wide, 10 ft tall, 15 ft deep, down into X15; light and voices beyond. Loud noise outside draws one of the mountain folk to look.')
f.obj('spawn', 'spawn', S(8.5, 2.5), 'dm-note', 'X1', 'Party arrives up the road')

# ================================================================== UPPER (+30): map p.182
VOID = [(S(4, -18), S(4, -7)), (S(13, -18), S(13, -7)), (S(4, -18), S(13, -18))]
u = XLevel('upper', 'Upper level (+30 ft)', 30, 10, ambient='darkness', interior='ashlar', exterior='ashlar', north='-z', void=VOID)
# --- entrance and guard rooms
u.rm('X2', 'Entrance', R(8, -5, 9, -2), mat='ashlar', ceil=10)
u.rm('X2a', 'Guard Room', R(6, -5, 8, -3), ceil=10)
u.rm('X2b', 'Guard Room', R(9, -5, 11, -3), ceil=10)
u.rm('X3-w', 'Empty Barracks (west)', R(4, -5, 6, -3), ceil=10)
u.rm('X3-e', 'Empty Barracks (east)', R(11, -5, 13, -3), ceil=10)
u.rm('X4', 'Overlook', R(4, -7, 13, -5), mat='amber', ceil=30)
# --- east wing
u.rm('X6', 'Southeast Annex', [S(13, -8), S(17, -8)] + arc(17, -7, 1, 1, 270, 360, 4, ends=False) + [S(18, -7), S(18, -6)] + arc(17, -6, 1, 1, 0, 90, 4, ends=False)
     + [S(17, -5), S(15, -5), S(15, -3), S(13, -3)], ceil=20)
u.rm('X7', 'Secret Scroll Repository', R(15, -5, 17, -4), ceil=10)
u.rm('X8', 'Upper East Hall', R(13, -15, 15, -8), mat='amber', ceil=20)
u.rm('X9', 'Lecture Hall', [S(15, -14), S(18, -14)] + arc(18, -11.5, 2, 2.5, 270, 450, 12, ends=False) + [S(18, -9), S(15, -9)], mat='amber', ceil=30)
X10 = poly((13, -18), (15.5, -18), (16, -17.5), (16, -17), (17, -16.5), (17.5, -15.5), (17.5, -15), (13, -15))
u.rm('X10', 'Northeast Annex', X10, ceil=20)
for a, b in zip(X10[1:6], X10[2:7]): u.mat_seg(a, b, 'cave-rock')
u.rm('X11', 'Northeast Balcony', R(10, -18, 13, -16), mat='amber', ceil=30)
u.rm('X12', 'East Shrine', [S(10, -20), S(14, -20)] + arc(14, -19, 0.5, 0.5, 270, 450, 6, ends=False) + [S(14, -18), S(10, -18)], ceil=15)
u.rm('X13', 'East Archer Post', R(9, -20, 10, -18), ceil=10)
u.rm('X14', 'North Staircase', R(12, -22, 13, -20), ceil=20)
u.O((13, -22), (13, -21))                                  # the stairwell drops away east
# --- west wing
X15ARC = arc(0.5, -6.5, 1.5, 1.5, 90, 270, 12)
u.rm('X15', 'Southwest Annex', [S(4, -8), S(4, -5)] + X15ARC, ceil=15)
# the fissure (X1a) leaves the apse to the south-west, between the arc points at 120 and 135 degrees
MA, MB = X15ARC[2], X15ARC[3]
CRACK_END = (-1.55, -4.2)
u.rm('X1a-crack', 'Narrow Fissure (the crack)', [MA, MB, S(CRACK_END[0] - 0.1, CRACK_END[1] - 0.02), S(CRACK_END[0] + 0.06, CRACK_END[1] + 0.1)], 'dirt', mat='cave-rock', ceil=10, difficult=True)
u.open_seg(MA, MB)
u.rm('X16', 'West Scroll Repository', R(1, -5, 3, -4), ceil=10)
u.rm('X17', 'Upper West Hall', R(2, -15, 4, -8), mat='amber', ceil=20)
u.rm('X18', 'Hallway', R(0, -12, 2, -11), ceil=10)
u.rm('X19', 'Potion Storage', R(-1, -11, 2, -9), ceil=15)
u.rm('X20', "Architect's Room", R(-1, -14, 2, -12), ceil=15)
u.rm('X21', 'West Staircase', R(-1, -12, 0, -11), ceil=10)
u.O((-1, -12), (-1, -11))                                  # the stairwell drops away west
u.rm('X22', 'Northwest Annex', [S(4, -18), S(4, -15), S(0.5, -15)] + arc(0.5, -16.5, 1.5, 1.5, 90, 270, 12, ends=False) + [S(0.5, -18)], ceil=20)
X23 = poly((4, -18), (7.5, -18), (7, -17.5), (5.5, -17.5), (5, -17), (5, -16), (4, -16))
u.rm('X23', 'Northwest Balcony', X23, mat='amber', ceil=30)
u.rm('X24', 'West Shrine', [S(3, -20), S(7, -20), S(7, -18), S(3, -18)] + arc(3, -19, 0.5, 0.5, 90, 270, 6, ends=False), ceil=15)
u.rm('X25', 'West Archer Post', R(7, -20, 8, -18), ceil=10)
u.rm('X26', 'Secret Alcove', R(4, -21, 5, -20), ceil=30)
u.rm('X27', "Lich's Lair", [S(2, -24), S(5, -24), S(5, -21), S(2, -21)] + arc(2, -22.5, 1.15, 1.5, 90, 270, 12, ends=False), ceil=15)
u.rm('X28', 'Hidden Phylactery', R(4, -25, 6, -24), ceil=10)
u.rm('X29', 'Secret Room', R(5, -24, 6, -22), ceil=10)
SH = (8.5, -25.6, 1.553)                                   # the library's shaft: centre and radius (squares)
SHA = math.degrees(math.atan2(-0.4, -1.5)) % 360            # where the shaft's circle crosses the library's north wall (west point)
SHB = 540 - SHA                                            # ... and the east point
SHAFT_S = arc(SH[0], SH[1], SH[2], SH[2], SHA, SHB - 360, 14)   # its south half, the library side
SHAFT_N = arc(SH[0], SH[1], SH[2], SH[2], SHA, SHB, 12)         # its north half, behind the library wall
u.rm('X30', 'Preserved Library', [S(6, -26)] + SHAFT_S + [S(11, -26), S(11, -21), S(6, -21)], ceil=30)
# --- the statue's head, hollow, standing in the void
HC = S(8.5, -16.5); hw, hc = 1.7, 0.7
HEAD = [(HC[0] - hc, HC[1] - hw), (HC[0] + hc, HC[1] - hw), (HC[0] + hw, HC[1] - hc), (HC[0] + hw, HC[1] + hc), (HC[0] + hc, HC[1] + hw), (HC[0] - hc, HC[1] + hw), (HC[0] - hw, HC[1] + hc), (HC[0] - hw, HC[1] - hc)]
u.rm('X5a', 'God of Secrets (the head)', HEAD, ceil=10)
for a, b in zip(HEAD, HEAD[1:] + HEAD[:1]): u.stamp_seg(a, b, flags=['invisible'])   # the head itself is the prop; its walls only bound the room
# --- doors, openings, secret doors (upper)
u.O((8, -5), (9, -5)); u.O((8, -2), (9, -2))              # the entrance hall runs from the facade steps into the overlook
u.D((5, -5), (5.5, -5), id='X3w-door'); u.D((13, -4.5), (13, -4), id='X3e-door')
u.D((4, -6.5), (4, -5.5), id='X15-doors', double=True)                    # gruff voices beyond
u.D((13, -6.5), (13, -5.5), id='X6-west-doors', double=True, open=True)
u.D((13.5, -8), (14.5, -8), id='X6-north-doors', double=True, open=True)
u.D((15, -12), (15, -11), id='X9-door')
u.D((13.5, -15), (14.5, -15), id='X10-south-doors', double=True, open=True)
u.D((13, -17.5), (13, -16.5), id='X10-west-doors', double=True, open=True)
u.D((10.5, -18), (11.5, -18), id='X11-doors', double=True, open=True)
u.D((10, -19.5), (10, -18.5), id='X13-doors', double=True)
u.D((2.5, -8), (3.5, -8), id='X17-south-doors', double=True)
u.D((2, -12), (2, -11), id='X18-east-door'); u.D((0, -12), (0, -11), id='X18-west-door')
u.D((2, -10), (2, -9), id='X19-door'); u.D((2, -14), (2, -13), id='X20-door')
u.D((2.5, -15), (3.5, -15), id='X22-south-doors', double=True); u.D((4, -17.5), (4, -16.5), id='X22-east-doors', double=True)
u.D((5.5, -18), (6.5, -18), id='X24-south-doors', double=True); u.D((7, -19.5), (7, -18.5), id='X25-doors', double=True)
u.SD((6, -4), (6, -3.5), 'X2a', 'Secret door: X3 (west) to the guard room X2a', 'X2a')
u.SD((11, -4), (11, -3.5), 'X2b', 'Secret door: X3 (east) to the guard room X2b', 'X2b')
u.SD((2.5, -5), (3, -5), 'X16', 'Secret door in the south wall of X15 (unknown to the mountain folk)', 'X16')
u.SD((16.5, -5), (17, -5), 'X7', 'Secret door in the south wall of X6', 'X7')
u.SD((12, -20), (12.5, -20), 'X14', 'Secret door at the back of a north alcove of the shrine', 'X12')
u.SD((-0.5, -11), (0, -11), 'X19', 'Secret door: top landing of X21 to the potion storage', 'X21')
u.SD((-0.5, -12), (0, -12), 'X20', "Secret door: top landing of X21 to the architect's room", 'X21')
u.SD((4, -20), (4.5, -20), 'X26-south', 'Secret door at the back of a north alcove; hundreds of skulls spill out', 'X24')
u.SD((4, -21), (4.5, -21), 'X26-north', "Secret door from the lich's lair; skulls spill out", 'X27')
u.SD((4, -24), (4.5, -24), 'X28', "Secret door to the phylactery (arcane lock; password 'Exethanter')", 'X27')
u.SD((5, -22.5), (5, -22), 'X29-west', "Secret door from the lich's lair", 'X27')
u.SD((6, -24), (6, -23.5), 'X29-east', 'Secret door in the centre of the west wall', 'X30')
u.SD((8, -21), (9, -21), 'X30-south', 'Secret door in the centre of the south wall: stairs down 30 ft to X5b', 'X30')
# the overlook's railing and the stair heads; the balconies' edges
u.O((4, -7), (6, -7)); u.O((11, -7), (13, -7)); u.rail((6, -7), (11, -7))
u.rail((10, -18), (10, -16)); u.rail((10, -16), (13, -16))
for a, b in zip(X23[1:], X23[2:]): u.open_seg(a, b)       # the broken edge of X23: no railing left
# the shaft in the library: a black marble railing round its south half, open where the spiral stair arrives
for k, (a, b) in enumerate(zip(SHAFT_S[:-1], SHAFT_S[1:])):
    if k in (8, 9): u.open_seg(a, b)
    else: u.stamp_seg(a, b, flags=['normal'], heightFt=3.5, material='ashlar')
for a, b in zip(SHAFT_N[:-1], SHAFT_N[1:]): u.wall(a, b, material='amber', heightFt=30)   # the shaft's far wall, continuing up from the amber vault
u.wall(S(8, -18), S(9, -18), material='amber', heightFt=30)   # the temple's north wall above the X5b stairwell
u.wall(S(8, -21), S(8, -20)); u.wall(S(9, -21), S(9, -20))       # the X5b stairwell between the archer posts
# --- arrow slits
for j in (-4.5, -3.5): u.slit(f'X2a-slit{j}', 8, j, 'X2a', -90); u.slit(f'X2b-slit{j}', 9, j, 'X2b', 90)
for j in (-13, -11.5, -10): u.slit(f'X8-slit{j}', 13, j, 'X8', 90); u.slit(f'X17-slit{j}', 4, j, 'X17', -90)
u.slit('X13-slit', 9.5, -18, 'X13', 180); u.slit('X25-slit', 7.5, -18, 'X25', 180)
# --- dressing (upper)
u.P('X2-steps', 'stairs-straight', 8.5, -2.5, 'X2', dims={'w': 9, 'rise': 10, 'fromZ': S(0, -3)[1] * 5, 'toZ': S(0, -2)[1] * 5}, desc='Ice-glazed steps climbing to the facade.')
u.P('X2b-skel', 'skeleton', 10.55, -4.6, 'X2b', rotY=200, desc='A skeleton slumped in the corner, wrapped in a faded blue robe, something clutched to its chest.', dm='A wizard who froze to death; harmless.')
u.H('X2b-wand', 'niche', 10.6, -4.5, 'X2b', 'Wand of secrets in the skeleton\'s grip')
for k, (i, j) in enumerate([(4.6, -4.4), (5.4, -3.6), (11.6, -3.6), (12.4, -4.5)]):
    u.P(f'X3-bunks{k}', 'wood-debris', i, j, 'X3-w' if i < 8 else 'X3-e', rotY=k * 70, desc='Splintered wood, all that is left of the bunks.')
u.N('X4-note', 8.5, -6.2, 'X4', 'Black marble, railing shattered in places; stairs at each end descend 30 ft to X5. Passive Perception 12 spots the arrow slits of X8/X17. Light reaching 90 ft shows the great statue.')
for k, (i, j) in enumerate([(7.2, -7), (9.6, -7)]): u.P(f'X4-broken{k}', 'rubble', i, j + 0.3, 'X4', dims={'n': 3})
u.P('X6-hole', 'shaft-hole', 16.5, -6.5, 'X6', dims={'r': 5}, desc='A rough-edged hole ten feet across breaks through the floor.', dm='Shaft: 20 ft of easy handholds, then a 10-ft drop into X33a. Noise brings its three flameskulls up the shaft.')
for k, (i, j, r) in enumerate([(14, -7.9, 0), (16, -7.9, 0), (17.9, -6.5, -90), (14, -5.1, 180), (13.1, -7, 90)]):
    u.P(f'X6-sconce{k}', 'wall-sconce', i, j, 'X6', rotY=r, dims={'y': 6})
u.P('X7-holes', 'scroll-niches', 16, -4.05, 'X7', rotY=180, dims={'w': 9}); u.P('X16-holes', 'scroll-niches', 2, -4.05, 'X16', rotY=180, dims={'w': 9})
for k, (i, j, r) in enumerate([(14, -13.5, 20), (13.8, -11, -15), (14.3, -9.2, 60)]): u.P(f'X8-crack{k}', 'floor-cracks', i, j, 'X8', rotY=r, dims={'len': 14})
# the lecture hall: descending tiers, red marble benches, the obsidian lectern and the slate on its chains
for k, (i, y) in enumerate(((16.2, 1.6), (16.8, 0.8), (17.4, 0))): u.P(f'X9-bench{k}', 'marble-bench', i, -11.5, 'X9', rotY=90, y=y, dims={'l': 20, 'tier': y})
for k, j in enumerate((-13.5, -9.5)): u.P(f'X9-steps{k}', 'stone-flight', 17.9, j, 'X9', rotY=180, dims={'len': 18, 'w': 8, 'rise': 2})
u.P('X9-lectern', 'lectern', 18.9, -11.5, 'X9', rotY=90, desc='An obsidian lectern at the foot of the tiers.')
u.P('X9-slate', 'slate-board', 19.75, -11.5, 'X9', rotY=-90, desc='A slab of black slate hanging from chains, a few old chalk marks on it.')
for k, (i, j) in enumerate([(16.5, -12.8), (16.5, -10.2), (18.6, -11.5)]):
    u.P(f'X9-lanthorn{k}', 'lanthorn', i, j, 'X9', dims={'y': 14}); u.L(f'X9-{k}', i, j, 'light-cantrip', 20, 40, y=13)
u.C('X9-vilnius', 'x-mage', 19.3, -11.1, 'X9', 'Vilnius (mage), burned and blistered, hiding behind the lectern; passive Perception 17 or DC 12 search to spot. Carries the shield guardian\'s amulet (X35).', playerLabel='A burned man')
u.C('X9-quasit', 'x-quasit', 19.5, -12.1, 'X9', "Vilnius's invisible quasit familiar", size='tiny')
u.C('X10-golem', 'amber-golem', 14.8, -16.6, 'X10', 'Damaged amber golem, jackal-headed (stone golem, 145 hp); attacks anything it sees', size='large', dims={'head': 0, 'cracked': 1})
for k, (i, j) in enumerate([(16.2, -16.6), (16.8, -15.6), (15.6, -17.5), (17.1, -15.3), (15.4, -16.2)]): u.P(f'X10-rubble{k}', 'rubble', i, j, 'X10', dims={'n': 7})
for k, (i, j, r) in enumerate([(15.7, -17.4, 2.2), (16.6, -16.4, 2.6), (17.0, -15.5, 1.9), (15.3, -16.9, 1.4)]): u.P(f'X10-rock{k}', 'boulder', i, j, 'X10', rotY=k * 70, dims={'r': r})
for k, (i, j, r) in enumerate([(13.1, -17, 90), (14.5, -17.9, 0), (13.1, -15.8, 90)]): u.P(f'X10-sconce{k}', 'wall-sconce', i, j, 'X10', rotY=r, dims={'y': 6})
for k, (i, j, r) in enumerate([(10.5, -19.5, 80), (11.0, -18.6, 20), (11.5, -19.3, 140), (10.9, -19.0, 300)]):
    u.P(f'X12-candle{k}', 'candlestick-fallen', i, j, 'X12', rotY=r)
u.P('X12-shards', 'obsidian-idol', 14.1, -19, 'X12', dims={'shattered': 1}, desc='Fragments of a shattered obsidian statue in the raised alcove.')
u.P('X12-dais', 'dais', 14.1, -19, 'X12', dims={'w': 5, 'h': 1, 'steps': 1})
u.N('X14-note', 12.5, -20.6, 'X14', 'A dusty corridor north, then east down three 10-ft flights (30 ft in all) to X14a; the stench of death grows.')
# the southwest annex: Helwa's band camps here
for k, (i, j, r) in enumerate([(0.1, -7.4, 30), (1.4, -7.6, 80), (3.2, -7.4, 120), (3.4, -5.8, 70), (2.2, -5.4, 100), (-0.3, -5.9, 150)]):
    u.P(f'X15-bed{k}', 'fur-bedroll', i, j, 'X15', rotY=r)
u.C('X15-helwa', 'x-gladiator', 2.2, -6.6, 'X15', 'Helwa the gladiator, leader of the mountain folk; fights to the death', playerLabel='A scarred warrior')
for k, (i, j) in enumerate([(0.4, -7.0), (1.2, -5.8), (3.1, -6.9), (3.3, -6.0), (0.0, -6.3)]):
    u.C(f'X15-berserker{k}', 'x-berserker', i, j, 'X15', 'Berserker of the mountain folk, sharpening a weapon', playerLabel='A fur-clad warrior')
u.C('X15-wolf', 'dire-wolf', 1.6, -6.5, 'X15', "Dire wolf, Strahd's servant, asleep; flees east by X4 and X2 below half hp", size='large')
for k, (i, j) in enumerate([(1.0, -7.9), (3.9, -6.9)]): u.P(f'X15-torch{k}', 'wall-sconce', i, j, 'X15', rotY=0 if j < -7.5 else -90, dims={'y': 6, 'lit': 1}); u.L(f'X15-{k}', i, j + 0.3, 'torch', 20, 40, y=6)
u.P('X17-scorch', 'scorch', 3, -9.5, 'X17', dims={'w': 18, 'd': 30})
u.P('X17-corpse', 'charred-corpse', 3, -9.3, 'X17', rotY=30, desc='A charred corpse under a burned fur cloak.', dm='Jakarion, incinerated by the flameskulls.')
u.H('X17-staff', 'niche', 2.7, -9.0, 'X17', "Jakarion's staff of frost; first to touch it gains the flaw 'I crave power above all else'")
for k, (i, j) in enumerate([(2.6, -12.6), (3.4, -11.6), (2.8, -10.8)]): u.C(f'X17-skull{k}', 'flameskull', i, j, 'X17', 'Flameskull; will not leave the hall', size='tiny')
u.P('X19-table0', 'stone-table', 0.0, -10, 'X19'); u.P('X19-table1', 'stone-table', 1.0, -10, 'X19')
u.P('X19-niches-n', 'bottle-niches', 0.5, -10.95, 'X19', rotY=0, dims={'w': 26}); u.P('X19-niches-s', 'bottle-niches', 0.5, -9.05, 'X19', rotY=180, dims={'w': 26})
u.P('X19-niches-w', 'bottle-niches', -0.95, -10, 'X19', rotY=90, dims={'w': 16})
u.P('X19-ladder0', 'leaning-ladder', -0.5, -10.75, 'X19', rotY=0, dims={'h': 12}); u.P('X19-ladder1', 'leaning-ladder', 1.6, -9.25, 'X19', rotY=180, dims={'h': 12})
for k, (i, j) in enumerate([(-0.9, -10.9), (1.9, -10.9), (1.9, -9.1)]): u.P(f'X19-web{k}', 'cobweb', i, j, 'X19', dims={'s': 3, 'y': 12})
u.N('X19-note', 0.5, -9.6, 'X19', 'Hundreds of dusty bottles: dried potions, long useless. The ladders will not bear weight.')
u.P('X20-model', 'castle-model', 0.5, -13.1, 'X20', desc='A twelve-foot model of a dark castle with high walls and tall spires, sculpted from rock.',
    dm='Artimus\'s model of Castle Ravenloft. A card-reading treasure here is inside it: smash in to reach it.')
u.P('X20-debris', 'wood-debris', -0.6, -12.4, 'X20')
u.P('X20-chest', 'chest', 1.55, -12.4, 'X20', rotY=-90)
u.objects[-1]['container'] = OrderedDict(contents='An old, empty map case.', reveals=['upper-X20-tome'])
u.H('X20-tome', 'niche', 1.55, -12.4, 'X20', 'Tome of understanding under the false bottom (DC 10 Perception)')
u.N('X21-note', -0.5, -11.4, 'X21', 'Three 10-ft flights with 10-ft landings link X18 and X36; dust undisturbed for ages. Secret doors N (X20) and S (X19) on the top landing.')
u.P('X22-table', 'table', 1.6, -16.6, 'X22', dims={'w': 24, 'd': 5})
u.P('X22-feast', 'feast', 1.6, -16.6, 'X22', dims={'w': 22}, desc='A magnificent feast: roasts, vegetables, gravy, wine.', dm='Illusion (programmed illusion, DC 17), as are the chairs and torches. Only the table and the ewer are real.')
for k in range(5):
    for s_ in (-1, 1): u.P(f'X22-chair{k}{s_}', 'chair', -0.4 + k * 1.0 + 0.5, -16.6 + s_ * 0.55, 'X22', rotY=180 if s_ > 0 else 0)
u.P('X22-ewer', 'ewer', 2.2, -16.5, 'X22', dims={'y': 2.5}, desc='A green copper ewer embossed with dancing bears, elks and wolves.',
    dm='Transmutation aura. Lifting it ends the illusions and seven specters attack its holder. Turns poison to wine; fills with a gallon of wine once a day.')
for k, (i, j) in enumerate([(-0.4, -16.6), (3.9, -17.6)]): u.L(f'X22-{k}', i, j, 'torch', 20, 40, y=6)
for k in range(7): u.C(f'X22-specter{k}', 'specter', -0.3 + k * 0.55, -15.5 if k % 2 else -17.6, 'X22', 'Specter (appears when the ewer is lifted)')
u.N('X23-note', 4.5, -17.2, 'X23', 'Unsafe: more than 250 lb collapses it; a 30-ft fall to the temple floor. The arrow slit of X25 is east of the northern doors.')
for k, (i, j) in enumerate([(3.15, -19.8), (6.85, -19.8), (3.15, -18.2), (6.85, -18.2)]):
    u.P(f'X24-candle{k}', 'candlestick', i + (0.15 if i < 5 else -0.15), j, 'X24', dims={'h': 5}); u.P(f'X24-web{k}', 'cobweb', i, j, 'X24', dims={'s': 2.5, 'y': 9})
u.P('X24-idol', 'obsidian-idol', 2.75, -19, 'X24', rotY=90, desc='A faceless obsidian statue, four feet tall, in a raised alcove.',
    dm='DC 16 Wisdom save on entering or be drawn to it (sympathy). Covering or removing it ends the effect. 250 lb.')
u.P('X24-dais', 'dais', 2.75, -19, 'X24', dims={'w': 5, 'h': 1, 'steps': 1})
u.P('X24-corpse0', 'skeleton', 3.5, -19.3, 'X24', rotY=80, desc='A desiccated corpse in tattered clothes, slumped before the statue.'); u.P('X24-corpse1', 'skeleton', 3.6, -18.6, 'X24', rotY=110)
for x in (4, 5):
    u.wall(S(x, -20), S(x, -19.8), material='ashlar', heightFt=15); u.wall(S(x, -18), S(x, -18.2), material='ashlar', heightFt=15)
    u.wall(S(x + 8, -20), S(x + 8, -19.8), material='ashlar', heightFt=15); u.wall(S(x + 8, -18), S(x + 8, -18.2), material='ashlar', heightFt=15)
u.P('X26-skulls', 'skull-pile', 4.5, -20.5, 'X26', dims={'w': 9.5, 'd': 9.5, 'h': 9}, desc='Human skulls, packed floor to ceiling.', dm='5 minutes for one character to clear a path.')
u.H('X26-chest', 'ceiling-chest', 4.5, -20.5, 'X26', 'Iron chest glued upside down to the 30-ft ceiling (sovereign glue, arcane lock, DC 25 Strength); opening it disintegrates the floor: 30-ft fall into X39', dims={'y': 29})
u.P('X27-rug0', 'rug', 2.4, -22.5, 'X27', dims={'w': 12, 'd': 8}); u.P('X27-rug1', 'rug', 4.2, -22.5, 'X27', rotY=90, dims={'w': 10, 'd': 6})
u.P('X27-tap0', 'tapestry', 3.5, -23.93, 'X27', dims={'w': 8}); u.P('X27-tap1', 'tapestry', 2.6, -21.07, 'X27', rotY=180, dims={'w': 8})
u.P('X27-divan', 'divan', 3.5, -21.4, 'X27', rotY=180, desc='A rotted divan; a bronze-covered book lies on it in plain view.', dm="The Incants of Exethanter (the lich's spellbook). The lich attacks anyone who takes it.")
u.P('X27-cabinet', 'cabinet', 4.6, -23.6, 'X27', rotY=-90)
u.P('X27-statue', 'statue', 1.3, -23.2, 'X27', dims={})
for k, (i, j) in enumerate([(1.4, -22.0), (2.8, -23.6), (4.6, -22.8), (4.6, -21.5)]):
    u.P(f'X27-tbl{k}', 'table', i, j, 'X27', dims={'w': 2, 'd': 2}); u.P(f'X27-cand{k}', 'candlestick', i, j, 'X27', y=2.5, dims={'h': 1.6}); u.L(f'X27-{k}', i, j, 'candle', 5, 10, y=4.5)
for k, (i, j) in enumerate([(1.2, -23.7), (4.8, -21.2)]): u.P(f'X27-web{k}', 'cobweb', i, j, 'X27', dims={'s': 3, 'y': 13})
u.C('X27-lich', 'x-lich', 3.3, -22.6, 'X27', "Exethanter the lich (99 hp, memory lost, cantrips only, CR 10). 'Do I know you?' Greater restoration restores him.", playerLabel='A robed skeleton')
u.P('X28-arm', 'claw-pedestal', 5.5, -24.5, 'X28', rotY=-90, desc='A carved scaly arm rises from the floor, its claw clutching a small bone box.')
u.H('X28-box', 'niche', 5.5, -24.5, 'X28', "Exethanter's phylactery (the bone box): 20 radiant damage from one source destroys it")
for k, (i, j) in enumerate([(5.1, -23.9), (5.9, -22.1)]): u.P(f'X29-web{k}', 'cobweb', i, j, 'X29', dims={'s': 3, 'y': 8})
for k, (i, j, r) in enumerate([(6.15, -24.8, 90), (6.15, -22.3, 90), (10.85, -24.8, -90), (10.85, -22.3, -90), (7.3, -21.15, 180), (9.7, -21.15, 180)]):
    u.P(f'X30-case{k}', 'marble-bookcase', i, j, 'X30', rotY=r, dims={'w': 9}, desc='A ten-foot bookcase of black marble, its shelves full of tomes with blank covers.' if k == 0 else None)
u.N('X30-books', 7.0, -23.5, 'X30', 'Every book looks blank: each needs its command word (only the restored lich knows them) or true seeing. Every PHB wizard spell is here somewhere. Taken out, a book crumbles.')
for k, (i, j, w, d) in enumerate([(7.4, -22.4, 10, 7), (9.9, -22.4, 9, 7)]): u.P(f'X30-rug{k}', 'rug', i, j, 'X30', dims={'w': w, 'd': d})
for k, (i, j, r) in enumerate([(6.9, -22.9, 120), (7.9, -22.0, 200), (9.4, -22.9, 30), (10.4, -21.9, 250), (7.0, -21.7, 160)]): u.P(f'X30-chair{k}', 'chair', i, j, 'X30', rotY=r)
for k, (i, j) in enumerate([(7.3, -23.6), (9.9, -23.6), (8.6, -21.5)]): u.P(f'X30-cand{k}', 'candlestick', i, j, 'X30', dims={'h': 5}); u.L(f'X30-{k}', i, j, 'candle', 5, 10, y=5.5)
u.N('X30-fresco', 8.5, -22.6, 'X30', 'Vaulted ceiling 30 ft up: a fresco of angels set ablaze in a hell.')
u.P('X5a-head', 'statue-head', 8.5, -16.5, 'X5a', dims={'r': 8.5, 'h': 10}, desc='The great statue\'s cowled head, its face a void of utter blackness pierced by two eyeholes.')
u.P('X5a-trap', 'trapdoor', 8.5, -16.3, 'X5a', desc='A stone trapdoor in the floor of the head.')
u.C('X5a-neferon', 'arcanaloth', 8.5, -16.8, 'X5a', "Neferon the arcanaloth in magical darkness (DC 17); truesight. Disguises as 'Heinrich Stolt'. Flees invisibly below half hp; never leaves the temple.", playerLabel='Something in the dark')
u.H('X5a-loot', 'niche', 8.2, -17.0, 'X5a', "Neferon's spellbook, gold spectacles with pink lenses (250 gp), robe of useful items (8 patches). A card-reading treasure lies on this floor.")
u.N('X5a-dark', 8.5, -15.5, 'X5a', 'Eyeholes 2 ft wide see the temple floor south of the statue and the balcony X4, nothing behind or above; three-quarters cover.')
for k, (i, j) in enumerate([(6, -15), (11, -15), (6, -10), (11, -10)]):
    u.P(f'X5-col-top{k}', 'black-column', i, j, 'X5', dims={'h': 10, 'base': 0})
u.P('X1a-crack-rocks', 'rubble', -1.1, -4.7, 'X1a-crack', dims={'n': 3})

# ================================================================== LOWER (0): map p.190
lo = XLevel('lower', 'Lower level (temple floor)', 0, 30, ambient='darkness', interior='ashlar', exterior='ashlar', north='-z')
X5 = poly((4, -18), (13, -18), (13, -17), (14, -17), (14, -16), (13, -16), (13, -12), (14, -12), (14, -11), (13, -11), (13, -7), (9, -7), (8, -7),
          (4, -7), (4, -11), (3, -11), (3, -12), (4, -12), (4, -16), (3, -16), (3, -17), (4, -17))
lo.rm('X5', 'Temple of Lost Secrets', X5, mat='amber', ceil=60)
lo.rm('X5b', 'Secret Door (stair to the library)', R(8, -21, 9, -18), ceil=30)
lo.rm('X5c', 'Locked Doors', R(8, -7, 9, -6), mat='amber', ceil=20)
lo.rm('X5d-w', 'Amber Reflections (west hall)', R(2, -15, 4, -13), mat='amber', ceil=20)
lo.rm('X5d-e', 'Amber Reflections (east hall)', R(13, -15, 15, -13), mat='amber', ceil=20)
lo.rm('X39', 'Plundered Treasury', [S(4, -21), S(5, -21)] + arc(6, -21, 1, 1, 180, 360, 8, ends=False) + [S(7, -21), S(8, -21), S(8, -18), S(4, -18)], ceil=30)
lo.rm('X40', 'Sealed Treasury', [S(9, -21), S(10, -21), S(10.134, -21.5), S(10.5, -22), S(11.5, -22), S(11.866, -21.5), S(12, -21), S(13, -21), S(13, -18), S(9, -18)], ceil=30)
lo.rm('X41', 'Fissure', R(10.5, -23, 11.5, -22), 'dirt', mat='cave-rock', ceil=8, difficult=True)
X42N = SHAFT_N
lo.rm('X42', 'Amber Vault', [S(6, -26)] + X42N + [S(11, -26), S(11, -25), S(12, -25), S(12, -24), S(11, -24), S(11, -23), S(9, -23), S(9, -22), S(8, -22), S(8, -23),
       S(6, -23), S(6, -24), S(5, -24), S(5, -25), S(6, -25)], mat='amber', ceil=30)
lo.rm('X36', 'Lower West Hall', R(-1, -20, 2, -8), mat='amber', ceil=25)
lo.rm('X37', "Wizard's Bedchamber", R(-4, -14, -1, -12), ceil=10)
lo.rm('X38', 'Haunted Room', R(-4, -16, -1, -14), ceil=10)
lo.rm('X21-lower', 'West Staircase (flights and landings)', poly((-3, -12), (-1, -12), (-1, -11), (-2, -11), (-2, -10), (-1, -10), (-1, -9), (-3, -9)), ceil=30)
lo.rm('X32', 'Lower East Hall', poly((15, -8), (18, -8), (18, -16.5), (17.5, -17), (16.5, -17), (16, -16.5), (15.5, -16), (15, -15.5)), mat='amber', ceil=25)
lo.rm('X34', "Wizard's Bedchamber", R(18, -14, 21, -12), ceil=10)
lo.rm('X35', 'Sleeping Guardian', R(18, -16, 21, -14), ceil=10)
lo.rm('X14a', 'Collapsed Lower Hall', poly((15.5, -20), (16, -20), (17, -20), (18, -20), (18, -18), (17.5, -17.5), (16.5, -17.5), (15.5, -18.5)), mat='amber', ceil=25, difficult=True)
lo.rm('X14-lower', 'North Staircase (flights and landings)', poly((13, -22), (17, -22), (17, -20), (16, -20), (16, -21), (13, -21)), ceil=30)
VAULTS = {'X33a': ('Vault of Shalx', 16, -7), 'X33b': ('Vault of Maverus', 19, -10), 'X33c': ('Ghastly Vault', 19, -19), 'X33d': ('Breached Vault', 0, -22),
          'X33e': ('Vault of Harkotha', -3, -19), 'X33f': ('Vault of Thangob', 0, -7)}
for k, (n, ci, cj) in VAULTS.items(): lo.rm(k, n, plus_vault(ci, cj), mat='amber', ceil=10)
lo.rm('X31', 'Central Catacombs', poly((7, -6), (11, -6), (11, -1), (6, -1), (6, -6), (7, -6), (7, -5), (7, -2), (10, -2), (10, -5), (7, -5)), ceil=15)
lo.rm('X31a', 'West Catacombs', poly((3, -5), (5, -5), (5, -4), (6, -4), (6, -3), (5, -3), (5, -2), (2, -2), (2, -5), (3, -5), (3, -4), (3, -3), (4, -3), (4, -4), (3, -4)), ceil=15)
lo.rm('X31b', 'East Catacombs', poly((13, -5), (15, -5), (15, -2), (12, -2), (12, -3), (11, -3), (11, -4), (12, -4), (12, -5), (13, -5), (13, -4), (13, -3), (14, -3), (14, -4), (13, -4)), ceil=15)
for (a, b) in [((7, -6), (7, -5)), ((3, -5), (3, -4)), ((13, -5), (13, -4))]: lo.O(a, b)      # the ring corridors' seams
# --- doors and openings (lower)
lo.O((5.5, -18), (6.5, -18))                               # the treasury's smashed doors
lo.D((10.5, -18), (11.5, -18), id='X40-doors', double=True, locked=True)
lo.D((8, -7), (9, -7), id='X5c-doors', double=True, locked=True)
lo.O((8, -6), (9, -6))
lo.O((4, -15), (4, -13)); lo.O((2, -15), (2, -13)); lo.O((13, -15), (13, -13)); lo.O((15, -15), (15, -13))
lo.SD((8, -18), (9, -18), 'X5b', 'Secret door mid north wall (DC 20; arcane lock: knock three times, it opens for 1 minute)', 'X5b')
lo.D((0, -20), (1, -20), id='X33d-door', open=True)
lo.D((-1, -19), (-1, -18), id='X33e-door', locked=True)
lo.D((-1, -15.5), (-1, -15), id='X38-door'); lo.D((-1, -13), (-1, -12.5), id='X37-door')
lo.O((-1, -10), (-1, -9))
lo.D((0, -8), (1, -8), id='X33f-door', locked=True)
lo.D((16, -8), (17, -8), id='X33a-door', locked=True)
lo.D((18, -10), (18, -9), id='X33b-door', locked=True)
lo.D((18, -13), (18, -12.5), id='X34-door'); lo.D((18, -16), (18, -15.5), id='X35-door')
lo.D((18, -19), (18, -18), id='X33c-door', open=True)
lo.O((16, -20), (17, -20))
lo.O((6, -4), (6, -3)); lo.O((11, -4), (11, -3))
lo.O((10.5, -22), (11.5, -22)); lo.O((10.5, -23), (11, -23))
# the statue's base: a secret door at the back opens on the spiral stair inside it
SB = S(8.5, -16.4)
lo.extra.append(((SB[0] - 0.55, SB[1] - 1.45), (SB[0] + 0.55, SB[1] - 1.45), dict(flags=['secret-door'], id='lower-sd-X5a', material='ashlar', heightFt=8)))
lo.obj('sdo-X5a', 'secret-panel', (SB[0], SB[1] - 1.45), 'secret-door', 'X5a', 'Secret door at the back of the statue\'s base (DC 20): a spiral stair climbs to a trapdoor in the head', wall='lower-sd-X5a')
# --- dressing (lower)
lo.P('X5-statue', 'god-of-secrets', 8.5, -16.4, 'X5a', dims={'h': 30}, desc='A forty-foot granite statue of a cowled figure in flowing robes, hands outstretched as if casting a spell; its face is utter blackness.')
for k, (i, j) in enumerate([(6, -15), (11, -15), (6, -10), (11, -10)]): lo.P(f'X5-col{k}', 'black-column', i, j, 'X5', dims={'h': 30, 'cap': 0}, desc='A column of black marble.' if k == 0 else None)
lo.P('X5-stair-w', 'stairs-straight', 5, -8.5, 'X5', dims={'w': 18, 'rise': 30, 'fromZ': S(0, -10)[1] * 5, 'toZ': S(0, -7)[1] * 5}, desc='A wide black marble staircase climbing 30 ft to the southern balcony.')
lo.P('X5-stair-e', 'stairs-straight', 12, -8.5, 'X5', dims={'w': 18, 'rise': 30, 'fromZ': S(0, -10)[1] * 5, 'toZ': S(0, -7)[1] * 5})
for k, (i, j, r, fallen) in enumerate([(3.5, -16.5, 90, 0), (3.5, -11.5, 90, 0), (13.5, -11.5, -90, 0), (12.6, -16.2, 60, 1)]):
    lo.P(f'X5-wizard{k}', 'wizard-statue', i, j, 'X5', rotY=r, dims={'fallen': fallen}, desc='An eight-foot statue of a robed wizard in white marble, pointed hat, golden staff.' if not fallen else 'A white marble wizard statue toppled and shattered on the floor.',
         dm='The staffs are wrought iron under peeling gold paint.' if not fallen else 'An earth tremor brought down the wall of its alcove.')
lo.P('X5-ne-rubble', 'rubble', 13.6, -16.6, 'X5', dims={'n': 8})
lo.P('X5-balcony-fall', 'balcony-debris', 5.6, -16.9, 'X5', rotY=15, desc='Broken slabs of black marble, fallen from the balcony above, before an open doorway.')
lo.P('X5-fall2', 'rubble', 6.8, -17.3, 'X5', dims={'n': 6}); lo.P('X5-fall3', 'rubble', 4.8, -16.0, 'X5', dims={'n': 5})
lo.P('X5b-stairs', 'stairs-straight', 8.5, -19.5, 'X5b', dims={'w': 9, 'rise': 30, 'fromZ': S(0, -18)[1] * 5, 'toZ': S(0, -21)[1] * 5}, desc='A dusty stone staircase climbing north.')
lo.N('X5b-note', 8.5, -18.4, 'X5b', 'Stairs climb 30 ft to a secret door that swings open by itself for anyone within 5 ft: the library, X30.')
lo.N('X5c-note', 8.5, -6.5, 'X5c', "Arcane lock, password 'Etherna'; DC 25 Strength; AC 15, 60 hp. Smashed: 4d10 necrotic in the 30-ft cube north of the doors (dust at 0 hp).")
lo.N('X5-note', 8.5, -12.5, 'X5', 'Ceiling 60 ft. Arrow slits of X8, X17, X13 and X25 look down (passive Perception 12). Neferon fires from the head; then the X17 flameskulls join in.')
lo.N('X5-rahadin', 8.5, -14.6, 'X5', "Rahadin's Prayer (event): Strahd's chamberlain may ride in to kneel before the statue, swallow a live toad and pray; while he is here the arcanaloth and flameskulls leave other visitors alone.")
for k, (i, j) in enumerate([(3.0, -14.0), (14.0, -14.0)]): lo.N(f'X5d-note{k}', i, j, 'X5d-w' if k == 0 else 'X5d-e', 'Your reflections in the amber do not follow you: they wave and scream silent warnings (illusion, DC 15).')
# treasuries
lo.N('X39-hole', 4.5, -20.5, 'X39', 'Ceiling 30 ft. A 10-ft hole forms here if the iron chest in X26 is opened; those above fall in.')
for k, (i, j, r) in enumerate([(5.2, -19.2, 20), (6.6, -18.6, 110), (7.3, -20.1, 200), (4.6, -18.6, 290)]): lo.P(f'X39-bones{k}', 'bones', i, j, 'X39', rotY=r)
for k, (i, j) in enumerate([(5.9, -18.3), (6.3, -18.5)]): lo.P(f'X39-door-shard{k}', 'amber-shards', i, j, 'X39', rotY=k * 60)
lo.P('X39-arms', 'wood-debris', 7.2, -18.6, 'X39', rotY=40)
for k in range(4): lo.C(f'X39-polter{k}', 'specter', 4.8 + (k % 2) * 2.2, -19.9 + (k // 2) * 1.1, 'X39', 'Poltergeist (specter stats, invisible); bound to the room')
for k, (i, j) in enumerate([(9.6, -18.6), (9.6, -19.5), (9.6, -20.5), (12.4, -18.6), (12.4, -19.5), (12.4, -20.5)]):
    lo.P(f'X40-pile{k + 1}', 'treasure-pile', i, j, 'X40', dims={'n': k}, desc=f'A heap of treasure (pile {k + 1} on the map).')
lo.objects[-6]['dm'] = 'Pile 1: 17,500 cp, thirty 50-gp gems, rusted plate and shields, a child-sized black sarcophagus inlaid with gold (250 gp).'
lo.objects[-5]['dm'] = 'Pile 2: 12,000 sp, rusted mail, a silvered rapier with a pink glass hilt, a gilded chariot (750 gp).'
lo.objects[-4]['dm'] = 'Pile 3: 6,600 ep stamped with Strahd, empty bottles, a trunk of six gowns, ten jewels (250 gp each) and 500 gp in a rotted chest, eight saint statuettes (250 gp).'
lo.objects[-3]['dm'] = 'Pile 4: iron ingots (250 gp, 2,500 lb), thirty holy symbols, twelve copper chalices (25 gp), a gilded skull with garnet eyes (250 gp), hammers and picks.'
lo.objects[-2]['dm'] = 'Pile 5: 9,000 sp, six crystal balls (20 gp), a bronze crown with dragon spires (750 gp), a wooden pony, six marble vases (100 gp).'
lo.objects[-1]['dm'] = 'Pile 6: 7,000 painted wooden coins, 15,000 cp in iron pots, an obsidian scepter (2,500 gp), rusted helms, fifteen signed storybooks.'
lo.C('X40-golem', 'amber-golem', 11, -21.3, 'X40', "Amber golem, hawk-headed (stone golem); attacks anyone who disturbs the treasure. Greater invisibility if the doors are smashed. Password 'Dhaviton'.", size='large', dims={'head': 1})
lo.N('X40-note', 11, -18.6, 'X40', 'Ceiling 30 ft. A card-reading treasure is buried in a random pile (d6).')
lo.P('X41-rubble', 'rubble', 11, -22.4, 'X41', dims={'n': 4})
lo.N('X41-note', 11.2, -22.6, 'X41', 'Two natural cracks side by side, each 3 ft wide, 8 ft high, 10 ft deep.')
# the amber vault: the gold spiral, six crates, the alcoves of rough amber, the cracks to the south-east
lo.P('X42-spiral', 'gold-spiral', SH[0], SH[1], 'X42', dims={'r': SH[2] * 10 - 0.6, 'w': 5, 'rise': 30, 'a0': 195, 'a1': 410}, desc='A golden marble staircase with a black railing hugs the north wall and spirals gently up the shaft.')
for k, (i, j, r) in enumerate([(6.9, -24.6, 20), (7.0, -23.5, 70), (8.0, -23.8, 40), (9.3, -24.3, 10), (10.2, -23.6, 80), (10.3, -24.9, 30)]):
    lo.P(f'X42-crate{k}', 'crate-chest', i, j, 'X42', rotY=r, desc='A rotting wooden crate.' if k == 0 else None)
    lo.objects[-1]['container'] = OrderedDict(contents='Earth, and a pale shape buried in it.', reveals=[f'lower-X42-spawn{k}'])
    lo.C(f'X42-spawn{k}', 'vampire-spawn', i, j, 'X42', 'Vampire spawn buried in the crate (one of a dead adventuring party); bursts out at intruders')
lo.P('X42-cracks', 'rubble', 10.5, -23.4, 'X42', dims={'n': 7}); lo.P('X42-shards', 'amber-shards', 10.2, -23.3, 'X42')
lo.N('X42-reliefs', 8.5, -25.0, 'X42', 'Amber walls sculpted into tentacles wrapping marble reliefs of kings, queens, pharaohs and sultans. Teleport point T (from K78) is here.')
lo.obj('X42-T', 'note', S(8.5, -25.3), 'dm-note', 'X42', 'T: arrival point from K78')
for k, (i, j, r, n, dm) in enumerate([
        (5.35, -24.5, 90, 'West sarcophagus', 'The Vampyr: to an evil humanoid; immortality of undeath once it slays one who loves it, drinks the blood, and dies violently at hateful hands. Flaw: hidden enemies everywhere.'),
        (8.5, -22.35, 0, 'South sarcophagus', 'Tenebrous: to an evil caster of 9th-level wizard spells; the secret of lichdom (phylactery 10 days, potion 3 days). Flaw: only magic matters.'),
        (11.65, -24.5, -90, 'East sarcophagus', 'Zhudun, the Corpse Star: one resurrection regardless of time dead; the bearer looks like a corpse. Kasimir seeks this gift.')]):
    lo.P(f'X42-sarc{k}', 'amber-sarcophagus', i, j, 'X42', rotY=r, desc='A tall, rough block of amber with a sliver of utter darkness trapped inside.', dm=n + ': ' + dm)
# the amber vaults: three sarcophagi each in the arms of the cross
SARC = {
  'X33a': [('W', "Fekre, Queen of Poxes: cast contagion 3 times; reeks of filth."), ('S', 'Zrin-Hala, the Howling Storm: lightning bolt 3 times; half the face sags.'),
           ('E', 'Sykane, the Soul Hungerer: raise dead 3 times; sickly yellow eyes; flaw: help must be paid for.')],
  'X33b': [('N', 'Savnok the Inscrutable: mind blank for a year; the eyes melt away but still see.'), ('E', 'Tarakamedes, the Grave Wyrm: skeletal wings, fly 50 ft; must eat bones or grave dirt daily or die.'),
           ('S', 'Shami-Amourae, the Lady of Delights: suggestion 3 times at disadvantage; an extra finger on each hand; flaw: craves pleasure.')],
  'X33c': [('N', 'Drizlash, the Nine-Eyed Spider: spider climb; an extra blind, ever-open eye.'), ('E', 'Dahlver-Nar, He of the Many Teeth: reincarnate on death 3 times; loses all teeth.'),
           ('S', "Zantras, the Kingmaker: +4 Charisma (max 22); flaw: won't take no for an answer.")],
  'X33d': [('W', 'Delban, the Star of Ice and Hate: cone of cold 7 times and a ring of warmth; flaw: fire terrifies.'), ('N', 'Shattered: the vestige somehow broke free.'),
           ('E', 'Khirad, the Star of Secrets: scrying 3 times; a whisper voice and a cruel smile.')],
  'X33e': [('N', 'Yrrga, the Eye of Shadows: truesight 60 ft for 30 days; starry-void eyes; flaw: life is pointless.'), ('W', 'Great Taar Haak, the Five-Headed Destroyer: fire giant strength for 10 days; flaw: a bully.'),
           ('S', 'Yog the Invincible: +30 hp maximum for 10 days; oily black fur.')],
  'X33f': [('W', 'Norganas, the Finger of Oblivion: finger of death 3 times, then DC 15 Con or drop to 0; tar-black blood.'), ('S', 'Vaund the Evasive: proof against detection and evasion for 10 days; twitchy; flaw: no straight answers.'),
           ('E', 'Seriach, the Hell Hound Whisperer: summon two hell hounds once; Infernal; sulphur smoke when speaking it.')],
}
ARM = {'N': (0.5, -0.65, 0), 'S': (0.5, 1.65, 180), 'W': (-0.65, 0.5, 90), 'E': (1.65, 0.5, -90)}
FLOORTINT = {'X33a': 0x7a3a3a, 'X33b': 0x3e5566, 'X33c': 0x2f4a3a, 'X33d': 0x3b2f47, 'X33e': 0x2a2224, 'X33f': 0x77757a}
for k, (n, ci, cj) in VAULTS.items():
    for side, dm in SARC[k]:
        dx, dz, r = ARM[side]
        broken = 'Shattered' in dm
        lo.P(f'{k}-sarc-{side}', 'amber-sarcophagus', ci + dx, cj + dz, k, rotY=r, dims={'broken': 1} if broken else None,
             desc='A rough block of amber eight feet tall; a sliver of utter darkness hangs inside.' if not broken else 'The shattered remains of an amber block.',
             dm=('Touch: the vestige offers a dark gift. ' if not broken else '') + dm)
    lo.prop(f'{k}-floor', 'prism', (0, 0), k, dims={'h': 0.03, 'color': FLOORTINT[k]})
    lo.objects[-1]['pos'] = [0, 0, 0]; lo.objects[-1]['polygon'] = [[round(x * 5, 3), round(z * 5, 3)] for x, z in plus_vault(ci, cj)]
lo.N('X33-sidebar', 16.5, -6.0, 'X33a', 'Amber sarcophagi: AC 16, 80 hp, immune poison/psychic. Touch links to the vestige; a gift must be accepted freely, once; non-evil takers DC 12 Cha or turn evil.')
lo.P('X33a-shaft', 'ceiling-hole', 16.5, -6.5, 'X33a', dims={'r': 5, 'y': 10})
for k, side in enumerate('WSE'): lo.C(f'X33a-skull{k}', 'flameskull', 16 + ARM[side][0], -7 + ARM[side][1], 'X33a', 'Flameskull floating above a sarcophagus; rises up the shaft at noise', size='tiny', dims={'y': 9.5})
lo.N('X33a-door', 16.5, -7.6, 'X33a', "Arcane lock, password 'Shalx'; DC 25 Strength; AC 15, 30 hp. Smashed: 4d10 necrotic in the 30-ft cube before it.")
lo.N('X33b-door', 18.6, -9.5, 'X33b', "Arcane lock, password 'Maverus' (as X33a).")
lo.N('X33e-door', -1.6, -18.5, 'X33e', "Arcane lock, password 'Harkotha' (as X33a).")
lo.N('X33f-door', 0.5, -7.6, 'X33f', "Arcane lock, password 'Thangob' (as X33a).")
for k, (i, j) in enumerate([(19.3, -18.7), (19.8, -18.3)]): lo.C(f'X33c-ghast{k}', 'ghast', i, j, 'X33c', 'Ghast with a third, cataract eye; spider climb; fights to the death')
for k, (i, j) in enumerate([(19.1, -19.8), (20.6, -18.6), (19.5, -17.3), (18.4, -18.7), (20.0, -19.5)]):
    lo.C(f'X33c-ghast-wall{k}', 'ghast', i, j, 'X33c', 'Ghast clinging to the wall or ceiling (spider climb)')
for k, (i, j) in enumerate([(0.3, -21.7), (0.75, -21.7), (0.3, -21.25), (0.75, -21.25)]): lo.C(f'X33d-nothic{k}', 'nothic', i, j, 'X33d', 'Nothic (a ruined wizard); Weird Insight; fights only if attacked or the sarcophagi are threatened')
lo.P('X33d-shards', 'amber-shards', 0.5, -22.6, 'X33d', dims={'n': 9})
lo.C('X33e-slaad', 'death-slaad', -2.5, -18.5, 'X33e', 'Death slaad, invisible, greatsword ready; attacks on entry; cannot leave the temple', size='medium')
# catacombs: niches round every outer wall, iron candlesticks in the core's alcoves
def niches(lv, key, x0, j0, x1, j1, empty=0, skip=()):
    """Burial niches along the outer walls of a ring catacomb (squares); skip = wall cells left open (passages)."""
    cells = [('n', x0 + 0.5 + k, j0 + 0.06, 0) for k in range(int(x1 - x0))] + [('s', x0 + 0.5 + k, j1 - 0.06, 180) for k in range(int(x1 - x0))]
    cells += [('w', x0 + 0.06, j0 + 0.5 + k, 90) for k in range(int(j1 - j0))] + [('e', x1 - 0.06, j0 + 0.5 + k, -90) for k in range(int(j1 - j0))]
    for side, i, j, r in cells:
        if (side, i if side in 'ns' else j) in skip: continue
        lv.P(f'{key}-niche-{side}{i}_{j}', 'catacomb-niches', i, j, key, rotY=r, dims={'w': 7, 'empty': empty})
niches(lo, 'X31', 6, -6, 11, -1, skip={('n', 8.5), ('w', -3.5), ('e', -3.5)})
niches(lo, 'X31a', 2, -5, 5, -2, empty=1, skip={('e', -3.5)})
niches(lo, 'X31b', 12, -5, 15, -2, empty=2, skip={('w', -3.5)})
for k, (i, j, r) in enumerate([(8.5, -5.18, 0), (6.82, -3.5, -90), (10.18, -3.5, 90), (8.5, -1.82, 180)]):
    lo.P(f'X31-candle{k}', 'candlestick', i, j, 'X31', dims={'h': 6}, desc='A tall iron candlestick in an alcove.' if k == 0 else None, dm='The candles light themselves when a living creature enters; they melt if taken away.' if k == 0 else None)
    lo.L(f'X31-{k}', i, j, 'candle', 5, 10, y=7)
lo.P('X31a-candle', 'candlestick', 4.15, -3.5, 'X31a', dims={'h': 6}); lo.P('X31b-candle', 'candlestick', 12.85, -3.5, 'X31b', dims={'h': 6})
lo.N('X31-note', 8.5, -3.5, 'X31', 'The smell of the ancient dead. Amber husks smashed, the wizards\' bodies robbed and left to rot.')
# the east hall: the witches at the vault door, the rubble wall to the north
for k, (i, j) in enumerate([(16.0, -9.0), (16.6, -8.8), (17.2, -9.1)]): lo.C(f'X32-witch{k}', 'x-witch', i, j, 'X32', 'Barovian witch, trying passwords on the door of X33a; looses her broom, flees on it if two fall', playerLabel='An ugly woman in a pointed hat')
for k, (i, j) in enumerate([(15.6, -9.6), (16.6, -9.8), (17.5, -9.6)]): lo.C(f'X32-broom{k}', 'broom-of-animated-attack', i, j, 'X32', 'Broom of animated attack', size='small')
for k, (i, j) in enumerate([(15.6, -15.9), (16.4, -16.4), (17.3, -16.4), (17.6, -15.6), (16.8, -15.6)]): lo.P(f'X32-rubble{k}', 'rubble', i, j, 'X32', dims={'n': 9})
for k, (i, j, r) in enumerate([(15.8, -16.0, 2.6), (16.7, -16.6, 3.0), (17.5, -16.2, 2.4), (16.4, -15.5, 1.6)]): lo.P(f'X32-rock{k}', 'boulder', i, j, 'X32', rotY=k * 65, dims={'r': r})
X32N = poly((18, -16.5), (17.5, -17), (16.5, -17), (16, -16.5), (15.5, -16), (15, -15.5))
for a, b in zip(X32N[:-1], X32N[1:]): lo.mat_seg(a, b, 'cave-rock')
lo.N('X32-note', 16.5, -12, 'X32', 'Amber glistening like fresh honey; dust on black marble. The north end has fallen in.')
for k, (i, j) in enumerate([(16.4, -19.4), (17.2, -18.6), (15.9, -18.8), (17.4, -19.6), (16.6, -18.0)]): lo.P(f'X14a-rubble{k}', 'rubble', i, j, 'X14a', dims={'n': 8})
for k, (i, j, r) in enumerate([(15.9, -19.6, 2.4), (17.5, -19.2, 2.0), (16.3, -18.3, 1.8), (17.6, -17.9, 1.5)]): lo.P(f'X14a-rock{k}', 'boulder', i, j, 'X14a', rotY=k * 55, dims={'r': r})
lo.N('X14a-note', 16.8, -19.0, 'X14a', 'Ceiling 25 ft. A path through the rubble to the open doorway of X33c; unless quiet and dark, the ghasts hear the party coming.')
# the stairs that drop from the upper plate: solid flights rising from landing to landing (pos = the low end)
def landing(lv, id, key, i0, j0, i1, j1, h):
    lv.prop(id, 'prism', (0, 0), key, dims={'h': h, 'color': 0x5a5a5e}); lv.objects[-1]['pos'] = [0, 0, 0]; lv.objects[-1]['polygon'] = [FT(i0, j0), FT(i1, j0), FT(i1, j1), FT(i0, j1)]
landing(lo, 'X14-landing1', 'X14-lower', 14, -22, 15, -21, 20); landing(lo, 'X14-landing2', 'X14-lower', 16, -22, 17, -21, 10)
lo.P('X14-flight1', 'stone-flight', 14, -21.5, 'X14-lower', rotY=180, dims={'len': 10, 'w': 9, 'rise': 10, 'y': 20})
lo.P('X14-flight2', 'stone-flight', 16, -21.5, 'X14-lower', rotY=180, dims={'len': 10, 'w': 9, 'rise': 10, 'y': 10})
lo.P('X14-flight3', 'stone-flight', 16.5, -20, 'X14-lower', rotY=90, dims={'len': 10, 'w': 9, 'rise': 10})
landing(lo, 'X21-landing2', 'X21-lower', -3, -12, -2, -11, 20); landing(lo, 'X21-landing3', 'X21-lower', -3, -10, -2, -9, 10)
lo.P('X21-flight1', 'stone-flight', -2, -11.5, 'X21-lower', dims={'len': 10, 'w': 9, 'rise': 10, 'y': 20})
lo.P('X21-flight2', 'stone-flight', -2.5, -10, 'X21-lower', rotY=90, dims={'len': 10, 'w': 9, 'rise': 10, 'y': 10})
lo.P('X21-flight3', 'stone-flight', -1, -9.5, 'X21-lower', rotY=180, dims={'len': 10, 'w': 9, 'rise': 10})
# the lower west hall: ledges of familiar statues; the bedchambers
for k, (side, i, r, j, w) in enumerate([('w', -0.95, 90, -16.75, 20), ('w', -0.95, 90, -14.0, 16), ('w', -0.95, 90, -11.25, 20), ('e', 1.95, -90, -17.5, 40), ('e', 1.95, -90, -10.5, 40)]):
    lo.P(f'X36-ledge-{side}{k}', 'animal-ledge', i, j, 'X36', rotY=r, dims={'w': w, 'y': 5, 'seed': k})   # ledges between the doors
for k, (i, j, r) in enumerate([(0.3, -17.2, 30), (1.4, -11.7, 140), (-0.2, -9.6, 250)]): lo.P(f'X36-broken{k}', 'animal-shards', i, j, 'X36', rotY=r)
lo.N('X36-note', 0.5, -14.0, 'X36', 'Vaulted ceiling 25 ft. Ledges 5 ft up hold alabaster cats, frogs, hawks, owls, rats, ravens, snakes, toads and weasels: familiars, harmless.')
lo.P('X37-heap0', 'wood-debris', -3.3, -13.4, 'X37', rotY=20, dims={'pale': 1}, desc='Furnishings of ancient, colorless wood collapsed under their own weight.'); lo.P('X37-heap1', 'wood-debris', -1.8, -12.6, 'X37', rotY=110, dims={'pale': 1})
for k, (i, j) in enumerate([(-3.8, -13.8), (-1.2, -12.2)]): lo.P(f'X37-web{k}', 'cobweb', i, j, 'X37', dims={'s': 3, 'y': 8})
lo.P('X38-bed', 'wood-debris', -3.2, -15.2, 'X38', rotY=0, desc='The wreck of a bedchamber: bed, wardrobe, trunks, candlesticks, desk, bookshelf, chairs; torn books, quills and rags strewn about.')
lo.P('X38-trunk', 'trunk', -1.8, -15.6, 'X38', rotY=170); lo.P('X38-candle', 'candlestick-fallen', -2.5, -14.5, 'X38', rotY=60); lo.P('X38-shelf', 'wood-debris', -1.5, -14.4, 'X38', rotY=80)
lo.C('X38-polter', 'specter', -2.5, -15.0, 'X38', 'Poltergeist (specter stats, invisible): hurls broken furniture to hide where it is')
lo.H('X38-scroll', 'niche', -3.6, -14.4, 'X38', 'A wooden scroll tube: spell scroll of wall of fire (found by searching)')
lo.P('X34-bed', 'marble-bed', 19.5, -13, 'X34', rotY=90, desc='A white marble bed, its mattress long rotted, a golden hawk on each corner post.', dm='The four golden hawks: 250 gp each.')
for k, (i, j) in enumerate([(18.5, -13.6), (20.5, -12.4)]): lo.P(f'X34-heap{k}', 'wood-debris', i, j, 'X34', rotY=k * 90)
lo.N('X34-sigils', 19.5, -13.8, 'X34', 'Cobwebbed arcane sigils on the walls: old wards, drained of their magic.')
lo.C('X35-guardian', 'shield-guardian', 19.5, -15, 'X35', 'Shield guardian, incapacitated; head scraping the 10-ft ceiling. Its amulet is on Vilnius (X9).', size='large')
for k, (i, j) in enumerate([(18.6, -15.6), (20.4, -14.4), (20.5, -15.6)]): lo.P(f'X35-heap{k}', 'wood-debris', i, j, 'X35', rotY=k * 70)
lo.P('X35-web', 'cobweb', 20.8, -15.8, 'X35', dims={'s': 3, 'y': 8})
for k, (i, j) in enumerate([(-0.7, -19.6), (1.7, -8.4)]): lo.P(f'X36-web{k}', 'cobweb', i, j, 'X36', dims={'s': 4, 'y': 20})
# colored marble floors under the temple, the vaults, and the halls
for key, pts_, col in [('X5', X5, 0x2a282c), ('X36', R(-1, -20, 2, -8), 0x2c2a2e), ('X32', poly((15, -8), (18, -8), (18, -16.5), (17.5, -17), (16.5, -17), (16, -16.5), (15.5, -16), (15, -15.5)), 0x2c2a2e)]:
    lo.prop(f'{key}-floor', 'prism', (0, 0), key, dims={'h': 0.03, 'color': col}); lo.objects[-1]['pos'] = [0, 0, 0]; lo.objects[-1]['polygon'] = [[round(x * 5, 3), round(z * 5, 3)] for x, z in pts_]
for key, pts_, col in [('X4', R(4, -7, 13, -5), 0x2a282c), ('X23', X23, 0x2a282c), ('X11', R(10, -18, 13, -16), 0x2a282c), ('X8', R(13, -15, 15, -8), 0x2c2a2e), ('X17', R(2, -15, 4, -8), 0x2c2a2e)]:
    u.prop(f'{key}-floor', 'prism', (0, 0), key, dims={'h': 0.03, 'color': col}); u.objects[-1]['pos'] = [0, 0, 0]; u.objects[-1]['polygon'] = [[round(x * 5, 3), round(z * 5, 3)] for x, z in pts_]

# ================================================================== descriptions (our own words)
DESC = {
  'X1': ('A snowy ledge at the end of a gravel road, before a temple face carved fifty feet up the sheer mountainside. Six alcoves hold twenty-foot amber statues of hooded, faceless figures at prayer; between the middle two an archway opens on steps going down.',
         'The statues cannot be damaged; looking at one for long breeds unease.'),
  'X1a': ('A narrow crack in the rock west of the facade; lamplight and voices come from somewhere beyond.', 'The fissure (2 ft wide, 10 ft tall, 15 ft deep) leads to X15. Loud noise outside brings one of the creatures there to look.'),
  'X1a-crack': ('A tight squeeze through split rock.', 'Two feet wide: Small creatures pass freely, Medium ones squeeze.'),
  'X2': ('Icy steps drop ten feet into an old, battered hall; arrow slits in its walls; a vast darkness beyond.', 'No guards behind the slits (X2a, X2b).'),
  'X2a': ('A bare, empty guard room behind a secret door, two arrow slits in its east wall.', 'Ceiling 10 ft.'),
  'X2b': ('A guard room behind a secret door, arrow slits in the west wall. A skeleton in a blue robe sits slumped in the north-east corner, clutching something.', 'A wizard who froze to death; harmless. Treasure: wand of secrets.'),
  'X3': ('A frigid room littered with splintered wood.', 'Ceiling 10 ft. The wood was bunks. A secret door in one wall opens into X2a or X2b.'),
  'X3-w': ('A frigid room littered with splintered wood.', 'Ceiling 10 ft. The wood was bunks. A secret door in the east wall opens into X2a.'),
  'X3-e': ('A frigid room littered with splintered wood.', 'Ceiling 10 ft. The wood was bunks. A secret door in the west wall opens into X2b.'),
  'X4': ('A broad black marble balcony with a broken railing, looking out over a vast temple. Stairs at each end go down; the walls and vault glow faintly gold with amber. Doors stand shut to the west and open to the east.',
         'Vault 30 ft above. Passive Perception 12 notices the arrow slits (X8, X17). Voices behind the west doors (X15). Light reaching 90 ft shows the faceless statue (X5a).'),
  'X5': ('A vast temple of black marble under amber-sheathed walls: four black columns, a towering cowled statue at the north end, arched halls leading west and east past white marble wizards in alcoves, one fallen. A broken balcony lies in pieces before an open doorway.',
         'Ceiling 60 ft; stairs and the balconies X4, X11, X23 are 30 ft up. Neferon attacks from the statue\'s head; the three flameskulls of X17 join in from the slits (three-quarters cover). Rahadin\'s Prayer happens here.'),
  'X5a': ('Inside the statue\'s hollow head: a darkness so deep the light dies in it. Two eyeholes look south over the temple.',
          'Neferon the arcanaloth lairs here in magical darkness (DC 17). The 40-ft granite statue hides a secret door at the back of its base (DC 20) and a spiral stair up to a trapdoor in this floor.'),
  'X5b': ('A dusty stone staircase behind the temple\'s north wall, climbing toward the library.', 'The secret door (DC 20) is arcane locked: knocking three times opens it for a minute. 30 ft up a second secret door opens itself for anyone within 5 ft (X30).'),
  'X5c': ('A pair of amber doors in the temple\'s south wall, sealed tight.', "Arcane lock; password 'Etherna'. DC 25 Strength or AC 15, 60 hp. Smashing them fills the 30-ft cube to the north with necrotic energy (4d10). The catacombs (X31) lie beyond."),
  'X5d': ('An arched hall twenty feet high. Your reflections in the amber do not mirror you: they wave and scream without a sound.', 'Illusions to warn intruders off (DC 15). East hall to X32, west hall to X36.'),
  'X5d-w': ('An arched hall twenty feet high. Your reflections in the amber do not mirror you: they wave and scream without a sound.', 'Illusions (DC 15). Leads to X36.'),
  'X5d-e': ('An arched hall twenty feet high. Your reflections in the amber do not mirror you: they wave and scream without a sound.', 'Illusions (DC 15). Leads to X32.'),
  'X6': ('A bare annex with a ragged ten-foot hole in the east of its floor and empty sconces on the walls. Double doors of amber stand open north and west; a single door lies just south of them.',
         'Ceiling 20 ft. The hole: a rough shaft 20 ft down with good handholds, then a 10-ft drop into X33a; its flameskulls come up if they hear noise. Secret door south to X7.'),
  'X7': ('A dusty niche-room whose south wall is bored with round holes for scrolls.', 'The emergency scrolls kept here are dust.'),
  'X8': ('A twenty-foot-wide arched corridor seventy feet long, glazed in amber, doors open at both ends. A shut door midway along the east wall faces three arrow slits; cracks run the length of the black marble floor.', 'The golem (X10) cracked the floor. The slits (5 in by 2 ft) look down on X5.'),
  'X9': ('A lecture hall lit by red copper lanthorns. Amber bas-reliefs of wizards with spellbooks; stairs north and south descend twenty feet past rows of red marble benches to an obsidian lectern, a slate slab hanging on chains behind it.',
         'Continual light in the lanthorns. Vilnius (mage) and his invisible quasit hide behind the lectern (passive Perception 17, DC 12 search). He eats vermin and will not leave until the golem is gone.'),
  'X10': ('A bare annex whose eastern part has fallen in. Doors stand open west and south. In the middle a ten-foot statue of a jackal-headed warrior in cracked amber turns toward you and clenches its fists.',
          'Ceiling 20 ft, empty sconces. Damaged amber golem (stone golem, 145 hp); fights while it can see anyone.'),
  'X11': ('A black marble balcony thirty feet above the north-east corner of the temple; its two amber doors stand open.', 'The arrow slit of X13 is west of the north doors.'),
  'X12': ('A bare shrine: a foyer of fallen candlesticks to the west, alcoves north and south, and in a raised alcove to the east the shattered pieces of an obsidian statue.', 'The golem wrecked it (it showed the same nameless god). A secret door at the back of a north alcove leads to X14.'),
  'X13': ('A narrow post with one arrow slit in the middle of its south wall.', 'Ceiling 10 ft; the slit looks down under the statue\'s raised left arm.'),
  'X14': ('A dusty corridor heads north and turns east down a dark stair. The air is thin and smells of death.', 'Three 10-ft flights with landings drop 30 ft to X14a.'),
  'X14-lower': ('The last flights of a dark stair, the stench of death rising.', 'Down to X14a.'),
  'X14a': ('A high, amber-glazed hall half buried in fallen stone; a path through the rubble leads to an open doorway that breathes a deathly stench.', 'Ceiling 25 ft; once joined X32. Unless the party is dark and quiet, the ghasts in X33c hear them coming.'),
  'X15': ('A torchlit stone annex, its floor covered in fur bedrolls. Cold air blows through a crack in the south-west wall.',
          'Helwa (gladiator) and five berserkers sharpening weapons; a dire wolf of Strahd\'s asleep in the middle. They fight to the death; the wolf flees east below half hp. They keep the doors to X17 shut. Secret door south to X16 (unknown to them).'),
  'X16': ('A dusty space whose south wall is bored with round holes for scrolls.', 'As X7: the scrolls are dust.'),
  'X17': ('An arched, amber-sheathed corridor seventy feet long. The south half is scorched; a charred corpse lies under a burned fur cloak. Three skulls wreathed in green fire float in the middle of the hall.',
          'Three flameskulls; they never leave the hall. The corpse is Jakarion; his staff of frost survived (touching it brings a flaw). The arrow slits look down on X5.'),
  'X18': ('A short bare stone hallway with an amber door at each end.', 'X17 east, X21 west.'),
  'X19': ('Dusty stone blocks like tables; the walls are carved with niches holding hundreds of dusty bottles; cobwebbed ladders lean against them.', 'Ceiling 15 ft. Dried potions, useless. The ladders will not bear weight. Secret door north to X21.'),
  'X20': ('A twelve-foot model of a dark castle of high walls and tall spires fills the room; behind it, in a corner, broken furniture and a wooden chest.',
          "Ceiling 15 ft. Artimus, the architect of Castle Ravenloft, lived here. The chest's map case is empty; a false bottom (DC 10) hides a tome of understanding. Secret door south to X21."),
  'X21': ('Thick, undisturbed dust on three ten-foot flights of stairs joined by landings.', 'Links X18 and X36. Secret doors N (X20) and S (X19) on the top landing.'),
  'X21-lower': ('Thick, undisturbed dust on the lower flights of the west stair.', 'Down to X36.'),
  'X22': ('Torches light a dining table heaped with a magnificent feast: roast meat, sweet vegetables, hot gravy and wine.',
          'Ceiling 20 ft. Only the table is real; feast, chairs and torches are a programmed illusion (DC 17). A green copper ewer in the feast: lift it and the illusions end and seven specters attack its holder.'),
  'X23': ('A black marble balcony over the north-west corner of the temple, thirty feet up; nearly half of it has fallen away and cracks run near its ragged edge.', 'Over 250 lb collapses it (30-ft fall). The X25 arrow slit is east of the north doors.'),
  'X24': ('A bare shrine: candlesticks hung with cobwebs in the corners of the foyer, paired alcoves along the walls, and in a raised alcove a faceless obsidian statue. Two desiccated corpses lie before it.',
          'DC 16 Wisdom save on entering or be drawn to the statue (sympathy); the two dead wizards starved here. Covering or removing it ends the pull. A secret door in a north alcove releases a flood of skulls (X26).'),
  'X25': ('A narrow post with one arrow slit in the middle of its south wall.', 'Ceiling 10 ft; the slit looks down under the statue\'s raised right arm.'),
  'X26': ('Hundreds of skulls tumble out as the door opens; the space behind is packed with them, floor to ceiling.',
          'Ceiling 30 ft. Clearing a path takes 5 minutes. An iron chest is glued upside down to the ceiling (arcane lock, DC 25); opening it vanishes the floor: a 30-ft fall into X39. The chest is empty.'),
  'X27': ('A room of faded royal trappings: ornate furniture, fine rugs and tapestries, statuary, lit candelabras on little tables, all under dust and cobwebs. A decrepit skeleton in tattered robes stands in the middle, red lights burning in its eyes.',
          "Exethanter the lich (99 hp, no memory, cantrips only, CR 10): 'Do I know you?' Greater restoration restores memory (he then shares passwords, lore, command words); a second casting his hit points. Three secret doors; X28's is arcane locked ('Exethanter')."),
  'X28': ('A small dusty room. A scaly arm and claw rise from the floor, holding up a little box of bone.', "The arm is carved. The box is Exethanter's phylactery: 20 radiant damage from one source destroys it."),
  'X29': ('Dust and cobwebs; nothing else.', 'Ceiling 10 ft.'),
  'X30': ('A stone library under a vaulted ceiling painted with angels burning in a hell. Six black marble bookcases ten feet tall hold hundreds of well-kept tomes; rugs, chairs and lit candelabras fill the south. A black railing rings a golden stair spiralling down a broad shaft to the north.',
          'Walls 20 ft, vault 30 ft; no ladders (the wizards used mage hand). Books need command words (the lich) or true seeing; they and the furnishings decay if removed. Secret doors W (X29) and S (stairs to X5b).'),
  'X31': ('The reek of the ancient dead. Stone niches hold human-shaped husks of amber, bones and rotten shrouds; tall iron candlesticks stand in alcoves, and their candles flare to life as you enter.', 'Later, corrupted wizards smashed the amber and robbed the dead. The candles light for living creatures and melt if taken.'),
  'X31a': ('More niches of bones and smashed amber husks.', None), 'X31b': ('Empty niches under a thick coat of dust.', 'No one was ever laid here.'),
  'X32': ('A great hall of amber that glistens like honey, dust on the black marble floor; its north end is a wall of rubble. Three ugly women in tattered black gowns and pointed hats stand before the south door with brooms.',
          'Three Barovian witches trying passwords on X33a (they never thought of the shaft from X6); they loose three brooms of animated attack. With two down, the third flies off on her broom.'),
  'X33a': ('Amber walls, a red marble floor, a rough shaft in the middle of the ceiling. Three amber blocks stand in alcoves, each with a skull wreathed in green flame floating above it.', 'Three flameskulls. Door arcane locked (Shalx). Shaft 10 ft wide, easy climb, to X6.'),
  'X33b': ('Amber walls, a blue marble floor, three amber blocks in alcoves.', 'Ceiling 10 ft. Door arcane locked (Maverus).'),
  'X33c': ('The door hangs open and the room stinks of death. Dark green marble; three amber blocks in alcoves. Two gray, three-eyed feral things stare at you hungrily; more cling to the walls and ceiling.', 'Seven ghasts with spider climb; they fight to the death.'),
  'X33d': ('The door hangs open. Purplish-black marble; two amber blocks in the west and east alcoves, the third lies shattered. Four hunched one-eyed creatures cluster in the middle.', 'Four nothics: they pry with Weird Insight and fight only if one is attacked or a sarcophagus is threatened.'),
  'X33e': ('Amber walls, black marble veined with red, three amber blocks in alcoves.', 'A death slaad stands invisible in the middle, greatsword ready; it attacks on entry. Door arcane locked (Harkotha).'),
  'X33f': ('Amber walls, gray marble veined with black, three amber blocks in alcoves.', 'Door arcane locked (Thangob).'),
  'X34': ('A white marble bed in a bare stone room, golden hawks on its posts; the rest of the furniture is dusty heaps. Cobwebs hang over sigils cut into the walls.', 'Ceiling 10 ft. The sigils were wards, now spent. Four golden hawks, 250 gp each.'),
  'X35': ('Decayed furniture around a man-shaped construct of dark wood and riveted iron, its helmed head scraping the ceiling, cobwebs running from it to the wreckage.', 'An incapacitated shield guardian; its control amulet is on Vilnius (X9).'),
  'X36': ('An enormous hall coated in amber like sculpted honey, dust on black marble, a vault twenty-five feet up. Ledges five feet up hold life-size alabaster animals; many have fallen and shattered.', 'The animals are familiars, harmless. The north door stands open; four others are shut.'),
  'X37': ('Furnishings of ancient, colourless wood have collapsed under their own weight, deep in dust and cobwebs.', 'Ceiling 10 ft.'),
  'X38': ('A wrecked bedchamber: the remains of a bed, wardrobe, trunks, tall candlesticks, a desk, a bookshelf and chairs, with torn books, quills and old clothes everywhere.', 'Ceiling 10 ft. A poltergeist throws the wreckage. A search finds a scroll tube: spell scroll of wall of fire.'),
  'X39': ('A great stone room whose amber doors lie smashed among crushed bones, armour and weapons.', 'Ceiling 30 ft. The golem that guarded it went upstairs (X10). Four poltergeists of dead thieves cannot leave and fight until destroyed.'),
  'X40': ('Heaps of treasure against the west and east walls; a ten-foot amber statue of a hawk-headed warrior stands in a wide alcove to the north, a crack in the wall behind it.', "Ceiling 30 ft. Doors arcane locked ('Dhaviton'); smashing them makes the golem invisible for a minute. The golem attacks anyone who disturbs the treasure."),
  'X41': ('Two natural cracks, side by side, split the rock.', 'Each 3 ft wide, 8 ft high, 10 ft long, between X40 and X42.'),
  'X42': ('A golden marble stair with a black railing spirals up a broad shaft along the north wall. Six rotting crates lie in the middle; the amber walls are sculpted as tentacles gripping reliefs of kings and queens. Tall rough blocks of amber stand in the alcoves; cracks in the south wall have spilled rubble.',
          'Six vampire spawn burst from the crates at intruders. West: the Vampyr; south: Tenebrous; east: Zhudun (Kasimir\'s goal). The spiral climbs 30 ft to X30.'),
}

levels = [f, u, lo]
links = []
def lk(id, kind, al, ap, bl, bp): links.append(OrderedDict(id=id, kind=kind, **{'from': OrderedDict(level=al, pos=FT(*ap)), 'to': OrderedDict(level=bl, pos=FT(*bp))}))
lk('X-steps', 'stairs', 'facade', (8.5, -1.6), 'upper', (8.5, -3.6))
lk('X-fissure', 'stairs', 'facade', (-2.0, -3.4), 'upper', (CRACK_END[0], CRACK_END[1]))
lk('X-stair-w', 'stairs', 'upper', (5, -6.3), 'lower', (5, -10.5))
lk('X-stair-e', 'stairs', 'upper', (12, -6.3), 'lower', (12, -10.5))
lk('X-shaft', 'shaft', 'upper', (16.5, -6.5), 'lower', (16.5, -6.5))
lk('X-statue', 'spiral', 'lower', (8.5, -17.9), 'upper', (8.5, -16.3))
lk('X-library-stair', 'stairs', 'lower', (8.5, -18.5), 'upper', (8.5, -21.5))
lk('X-spiral', 'spiral', 'lower', (7.25, -25.9), 'upper', (9.9, -23.9))
lk('X-north-stair', 'stairs', 'upper', (12.5, -21.6), 'lower', (16.5, -19.7))
lk('X-west-stair', 'stairs', 'upper', (-0.5, -11.5), 'lower', (-1.4, -9.5))

scene = OrderedDict(schema=1, location='X', chapter='ch13', name='The Amber Temple', mapPage=182, bookScaleFt=10, ambient='barovian-overcast', stacked=True, entry='facade',
                    levels=[lv.to_json() for lv in levels], links=links, nonSpatialKeys=['X33'])
for lv in scene['levels']:
    for r in lv['rooms']:
        d = DESC.get(r['key'])
        if d:
            r['desc'] = d[0]
            if d[1]: r['dm'] = d[1]
grid = OrderedDict(schema=1, levels=OrderedDict())
for lv in levels:
    polys = [[[round(x * 5, 3), round(z * 5, 3)] for x, z in p] for p in lv.floor_polys]
    if lv.terrain: polys += [[[round(x * 5, 3), round(z * 5, 3)] for x, z in lv.terrain[0][0]]]
    grid['levels'][lv.id] = OrderedDict(floorPolygons=polys, type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0.55)
os.makedirs(OUT, exist_ok=True)
json.dump(scene, open(os.path.join(OUT, 'scene.json'), 'w'), indent=1)
json.dump(grid, open(os.path.join(OUT, 'grid.json'), 'w'), indent=1)
keys = sorted({r['key'].split('-')[0] if r['key'].count('-') and r['key'].split('-')[-1].isalpha() else r['key'] for l in scene['levels'] for r in l['rooms']} | set(scene['nonSpatialKeys']))
want = sorted(PAGE)
missing = [k for k in want if k not in keys]; extra = [k for k in keys if k not in want]
print('amber temple:', [(l['id'], len(l['rooms']), len(l['walls']), len(l['objects'])) for l in scene['levels']], 'links', len(links), 'missing', missing, 'extra', extra)
