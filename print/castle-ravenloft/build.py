#!/usr/bin/env python3
"""Castle Ravenloft, floor by floor, as a colour-coded 3D-print set.

Reads the castle scene mistLAB shows (locations/ch04/K/scene.json: rooms, walls, doors, stairs, props, in feet) and
writes, per level, one STL per colour group (all sharing the level's origin so they import as parts of one object),
a one-colour `_mono.stl`, a `.3mf` carrying the parts with their colours, cut into bed-sized tiles with half-lap
joints, plus registration pegs on the tower rings so each floor locates on the one below, a rock-skinned mountain
frame around the two sub-levels, a manifest and a README.

Print axes: X east, Y north (+Y = the map's north, -z in the scene), Z up. One 5-ft cell = --cell-mm (25.4 = 1 inch).
The stack is vertically compressed: every level is --pitch-mm tall (slab + clear height), not its true height.

    python3 print/castle-ravenloft/build.py --out print/out [--cell-mm 25.4 --pitch-mm 32 --bed-mm 250 --courtyard apron]
"""
from __future__ import annotations
import argparse, json, math, os, sys, time
from collections import OrderedDict, defaultdict
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from geom import (Manifold, CrossSection, JoinType, cs, rect_cs, box, slab, segment_box, regular, cone, union, bbox,
                  clip, value_noise, write_stl, write_3mf, check, poly_area)

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
LEVEL_ORDER = ['dungeon', 'larders', 'ground', 'landing', 'court', 'weeping', 'spires', 'south-tower', 'tower-roofs',
               'north-peak', 'north-roof', 'high-peak']
SUBLEVELS = ('dungeon', 'larders')
CURTAIN_FT = (0, 0, 380, 340)   # the curtain wall's outer face, in castle feet (x0, z0, x1, z1)
COURTYARD_KEYS = {'K1', 'K3', 'K3-s', 'K4', 'K5', 'K5-p', 'K6', 'K1-g', 'K1-bridge'}
TOWER_KEYS = ('K18', 'K20', 'K21', 'K83', 'K12-n', 'K12-s', 'K48', 'K57', 'K59', 'K60', 'K60a')

GROUPS = OrderedDict([   # group -> (hex colour, what it is, four-colour AMS slot)
    ('floor', ('#8d8a82', 'floor slabs: flagstone, cobbles, earth', 'A')),
    ('stairs', ('#a7a39a', 'stairs, spiral stairs, daises', 'A')),
    ('stone', ('#cfc9b8', 'statues, altars, coffins, thrones, columns, crypts', 'A')),
    ('walls', ('#55555c', 'walls, towers, lintels, masonry, support pillars', 'B')),
    ('grid', ('#1d1b22', 'the 5-ft grid inlay', 'B')),
    ('rock', ('#44444c', 'the mountain frame, cliff lips, rock between dungeon rooms', 'B')),
    ('roof', ('#3a3340', 'slate roofs and tower caps', 'B')),
    ('doors', ('#6b4b30', 'door leaves', 'C')),
    ('wood', ('#8a5a3a', 'plank floors, tables, beds, shelves, casks, the bridge', 'C')),
    ('grass', ('#4d5a3f', 'the chapel garden', 'C')),
    ('metal', ('#3b3a3f', 'portcullises, cell bars, braziers, levers', 'D')),
    ('water', ('#3e5566', 'flooded dungeon floors', 'D')),
    ('heart', ('#a83a30', 'the Heart of Sorrow (print translucent red)', 'D')),
])


class Cfg:
    def __init__(self, a):
        self.cell = a.cell_mm; self.pitch = a.pitch_mm; self.slab = a.slab_mm; self.wall = a.wall_mm
        self.tower_wall = a.tower_wall_mm; self.grid_depth = a.grid_depth_mm; self.grid_w = a.grid_width_mm
        self.bed = a.bed_mm; self.courtyard = a.courtyard; self.tongue = 4.0; self.inlay = 0.6
        self.peg_d, self.peg_h, self.peg_clear = 3.0, 2.4, 0.5
        self.apron_ft = a.apron_ft; self.lintel = 3.0; self.supports = not a.no_supports
        self.f = self.cell / 5.0                 # mm per foot (plan)
        self.clear = self.pitch - self.slab      # clear height above the slab
        self.levels = a.levels.split(',') if a.levels else None
        self.sub_tray = a.sub_tray; self.masonry = a.masonry


# ------------------------------------------------------------------ scene access
def P(cfg, x_ft, z_ft):
    return (x_ft * cfg.f, -z_ft * cfg.f)


def poly_mm(cfg, poly):
    return [P(cfg, x, z) for x, z in poly]


def centroid(poly):
    xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
    return (sum(xs) / len(xs), sum(ys) / len(ys))


def is_tower(room):
    return len(room['polygon']) == 8 and room['key'].split('-')[0] in TOWER_KEYS or room['key'] in TOWER_KEYS


def room_cs(cfg, room):
    return cs([poly_mm(cfg, room['polygon'])])


def fill_holes(c: CrossSection):
    """Keep the outer contours only (positive area) so enclosed voids become part of the footprint."""
    outers = [list(map(tuple, p)) for p in c.to_polygons() if poly_area(p) > 0]
    return cs(outers)


def snap5(v, up):
    return (math.ceil(v / 5) if up else math.floor(v / 5)) * 5


# ------------------------------------------------------------------ one level
class LevelBuild:
    def __init__(self, cfg, scene, lv, region_ft):
        self.cfg, self.scene, self.lv = cfg, scene, lv
        self.id = lv['id']; self.region = region_ft        # (x0, z0, x1, z1) ft, or None for everything
        self.parts = defaultdict(list)                     # group -> [Manifold]
        self.notes = []
        self.rooms = [r for r in lv['rooms'] if self.room_in_region(r)]
        self.towers = []                                   # (centre mm, mid radius mm, key)
        self.door_cells = []                               # cut lines must avoid these (mm boxes)

    # --- region
    def room_in_region(self, r):
        if self.region is None:
            return True
        x0, z0, x1, z1 = self.region
        return any(x0 - 1 <= x <= x1 + 1 and z0 - 1 <= z <= z1 + 1 for x, z in r['polygon']) or \
            (min(p[0] for p in r['polygon']) < x0 and max(p[0] for p in r['polygon']) > x1)

    def region_cs(self):
        if self.region is None:
            return None
        x0, z0, x1, z1 = self.region
        (X0, Y1), (X1, Y0) = P(self.cfg, x0, z0), P(self.cfg, x1, z1)
        return rect_cs(X0, Y0, X1, Y1)

    # --- build
    def build(self):
        cfg = self.cfg
        rooms_cs = cs([poly_mm(cfg, r['polygon']) for r in self.rooms])
        reg = self.region_cs()
        if reg is not None:
            rooms_cs = rooms_cs ^ reg
        if self.id in SUBLEVELS:
            b = rooms_cs.bounds()                           # (x0, y0, x1, y1)
            tray = rect_cs(math.floor(b[0] / cfg.cell) * cfg.cell, math.floor(b[1] / cfg.cell) * cfg.cell,
                           math.ceil(b[2] / cfg.cell) * cfg.cell, math.ceil(b[3] / cfg.cell) * cfg.cell)
            footprint = tray if cfg.sub_tray == 'rect' else (fill_holes(rooms_cs.offset(cfg.cell, JoinType.Miter)) ^ tray)
            between = footprint - fill_holes(rooms_cs)
            self.parts['rock'].append(slab(between, cfg.slab, cfg.slab + (cfg.clear if cfg.masonry == 'full' else 2.0)))
        elif self.id == 'ground' and reg is not None:
            footprint = reg
            between = reg - rooms_cs
            # inside the curtain wall's outer face the solid is masonry; beyond it the tray is the Pillarstone's rock
            (CX0, CY1), (CX1, CY0) = P(cfg, *CURTAIN_FT[:2]), P(cfg, *CURTAIN_FT[2:])
            curtain = rect_cs(CX0, CY0, CX1, CY1)
            self.parts['walls'].append(slab(between ^ curtain, cfg.slab, cfg.slab + (cfg.clear if cfg.masonry == 'full' else 2.0)))
            self.parts['rock'].append(slab(between - curtain, cfg.slab, cfg.slab + 2.0))
        else:
            footprint = fill_holes(rooms_cs)
            if reg is not None:
                footprint = footprint ^ reg
            between = footprint - rooms_cs
            self.parts['walls'].append(slab(between, cfg.slab, cfg.slab + (cfg.clear if cfg.masonry == 'full' else 2.0)))
        self.footprint = footprint; self.rooms_cs = rooms_cs
        self.parts['floor'].append(slab(footprint, 0, cfg.slab))
        self.inlays(rooms_cs)
        self.grid(rooms_cs, footprint)
        self.walls()
        self.tower_rings()
        self.objects()
        return self

    def inlays(self, rooms_cs):
        cfg = self.cfg
        by = {'plank': 'wood', 'shallow-water': 'water', 'grass': 'grass'}
        for r in self.rooms:
            g = by.get(r.get('floor'))
            if not g:
                continue
            c = room_cs(cfg, r)
            if self.region_cs() is not None:
                c = c ^ self.region_cs()
            if c.is_empty():
                continue
            recess = slab(c, cfg.slab - cfg.inlay, cfg.slab)
            self.parts['floor'][0] = self.parts['floor'][0] - recess
            self.parts[g].append(recess)

    def grid(self, rooms_cs, footprint):
        cfg = self.cfg
        x0, y0, x1, y1 = footprint.bounds()
        lines = []
        k = math.floor(x0 / cfg.cell)
        while k * cfg.cell <= x1 + 1e-6:
            x = k * cfg.cell; lines.append(rect_cs(x - cfg.grid_w / 2, y0 - 1, x + cfg.grid_w / 2, y1 + 1)); k += 1
        k = math.floor(y0 / cfg.cell)
        while k * cfg.cell <= y1 + 1e-6:
            y = k * cfg.cell; lines.append(rect_cs(x0 - 1, y - cfg.grid_w / 2, x1 + 1, y + cfg.grid_w / 2)); k += 1
        if not lines:
            return
        g = CrossSection.batch_boolean(lines, __import__('manifold3d').OpType.Add) ^ rooms_cs
        groove = slab(g, cfg.slab - cfg.grid_depth, cfg.slab + 0.01)
        for grp in ('floor', 'wood', 'water', 'grass'):
            self.parts[grp] = [p - groove for p in self.parts[grp]]
        self.parts['grid'].append(slab(g, cfg.slab - cfg.grid_depth, cfg.slab))

    def clip_seg(self, a, b):
        """Clip a wall segment (mm) to the region; None if outside."""
        if self.region is None:
            return a, b
        x0, z0, x1, z1 = self.region
        (X0, Y1), (X1, Y0) = P(self.cfg, x0, z0), P(self.cfg, x1, z1)
        inside = lambda p: X0 - 1e-6 <= p[0] <= X1 + 1e-6 and Y0 - 1e-6 <= p[1] <= Y1 + 1e-6
        if inside(a) and inside(b):
            return a, b
        # parametric clip against the rectangle (Liang-Barsky)
        dx, dy = b[0] - a[0], b[1] - a[1]; t0, t1 = 0.0, 1.0
        for p, q in ((-dx, a[0] - X0), (dx, X1 - a[0]), (-dy, a[1] - Y0), (dy, Y1 - a[1])):
            if abs(p) < 1e-12:
                if q < 0:
                    return None
                continue
            t = q / p
            if p < 0:
                t0 = max(t0, t)
            else:
                t1 = min(t1, t)
        if t0 >= t1:
            return None
        return (a[0] + dx * t0, a[1] + dy * t0), (a[0] + dx * t1, a[1] + dy * t1)

    def walls(self):
        cfg = self.cfg
        for w in self.lv['walls']:
            a = P(cfg, *w['a']); b = P(cfg, *w['b'])
            seg = self.clip_seg(a, b)
            if seg is None:
                continue
            a, b = seg
            flags = w['flags']
            low = w.get('heightFt', 99) <= 5
            top = cfg.slab + (5.0 if low else cfg.clear)
            if 'door' in flags:
                self.door(a, b, w, top)
                continue
            self.parts['walls'].append(segment_box(a, b, cfg.wall, cfg.slab, top, extend=cfg.wall / 2))

    def door(self, a, b, w, top):
        cfg = self.cfg
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        ux, uy = (b[0] - a[0]) / L, (b[1] - a[1]) / L
        nx, ny = -uy, ux
        mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        self.door_cells.append((mid, L))
        # lintel across the gap, flush with the wall tops
        self.parts['walls'].append(segment_box(a, b, cfg.wall, top - cfg.lintel, top, extend=cfg.wall))
        locked = 'locked' in w['flags']
        if w['id'].endswith('-bars'):
            # cell bars: a frame and vertical bars, in metal
            h = top - cfg.lintel - cfg.slab
            bars = [segment_box(a, b, 1.2, cfg.slab, cfg.slab + 1.2, extend=0.6), segment_box(a, b, 1.2, cfg.slab + h - 1.2, cfg.slab + h, extend=0.6)]
            n = max(2, int(L // 3.2))
            for i in range(n + 1):
                t = i / n; x, y = a[0] + ux * L * t, a[1] + uy * L * t
                bars.append(Manifold.cylinder(h, 0.55, 0.55, 8).translate([x, y, cfg.slab]))
            self.parts['metal'].append(union(bars))
            return
        leaf_h = min(cfg.clear - cfg.lintel - 0.4, 10 * cfg.f)
        double = L > 1.5 * cfg.cell
        leaves = [(a, 1)] if not double else [(a, 1), (b, -1)]
        wdt = L if not double else L / 2
        for hinge, sgn in leaves:
            ang = 0.0 if locked else 70.0 * sgn
            leaf = Manifold.cube([wdt - 0.4, 1.2, leaf_h]).translate([0.2 if sgn > 0 else -(wdt - 0.2), -0.6, cfg.slab])
            leaf = leaf.rotate([0, 0, ang * (1 if sgn > 0 else 1)])
            base_ang = math.degrees(math.atan2(uy, ux))
            leaf = leaf.rotate([0, 0, base_ang]).translate([hinge[0], hinge[1], 0])
            self.parts['doors'].append(leaf)

    def tower_rings(self):
        cfg = self.cfg
        for r in self.rooms:
            if not is_tower(r):
                continue
            poly = poly_mm(cfg, r['polygon'])
            oc = cs([poly]); c = centroid(poly)
            rad = sum(math.hypot(p[0] - c[0], p[1] - c[1]) for p in poly) / len(poly)
            ring = oc.offset(cfg.tower_wall, JoinType.Miter) - oc
            if self.region_cs() is not None:
                ring = ring ^ self.region_cs()
            m = slab(ring, cfg.slab, cfg.slab + cfg.clear)
            # open the ring where the octagon's edges have no wall (openings) or carry a door
            n = len(poly)
            covered = []
            for i in range(n):
                a, b = poly[i], poly[(i + 1) % n]
                m_ = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
                w = self.wall_at(m_)
                if w is None or 'door' in w['flags']:
                    cut = segment_box(a, b, 2 * cfg.tower_wall + 1, cfg.slab - 1, cfg.slab + cfg.clear + 1, extend=-0.6)
                    if 'door' in (w or {}).get('flags', []):
                        cut = cut - segment_box(a, b, 2 * cfg.tower_wall + 2, cfg.slab + cfg.clear - cfg.lintel, cfg.slab + cfg.clear + 2, extend=1)
                    m = m - cut
                else:
                    covered.append(i)
            self.parts['walls'].append(m)
            self.towers.append((c, rad + cfg.tower_wall / 2, r['key'].split('-')[0], covered, poly))

    def wall_at(self, p, tol=1.5):
        for w in self.lv['walls']:
            a = P(self.cfg, *w['a']); b = P(self.cfg, *w['b'])
            L = math.hypot(b[0] - a[0], b[1] - a[1])
            if L < 1e-6:
                continue
            t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / (L * L)
            if -0.02 <= t <= 1.02:
                px, py = a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])
                if math.hypot(px - p[0], py - p[1]) < tol:
                    return w
        return None

    # --- objects
    def objects(self):
        cfg = self.cfg; f = cfg.f
        for o in self.lv['objects']:
            k = o['kind']; x, y = P(cfg, o['pos'][0], o['pos'][2]); d = o.get('dims', {}) or {}; rot = o.get('rotY', 0)
            if self.region is not None:
                x0, z0, x1, z1 = self.region
                if not (x0 <= o['pos'][0] <= x1 and z0 <= o['pos'][2] <= z1):
                    continue
            z0 = cfg.slab
            def rbox(w_ft, d_ft, h_mm, grp, dz=0.0, cap=True):
                h = min(h_mm, cfg.clear - 0.5) if cap else h_mm
                m = Manifold.cube([w_ft * f, d_ft * f, h]).translate([-w_ft * f / 2, -d_ft * f / 2, z0 + dz])
                self.parts[grp].append(m.rotate([0, 0, -rot]).translate([x, y, 0]))
            if k == 'stairs-straight':
                self.stairs_straight(o, x, y)
            elif k == 'spiral-stair':
                self.spiral(o, x, y)
            elif k == 'column':
                w = d.get('w'); h = d.get('h', 12)
                if w and w >= 8:   # a crypt or a square pier
                    rbox(w, w, cfg.clear, 'stone')
                else:
                    self.parts['stone'].append(Manifold.cylinder(min(cfg.clear - 0.3, 99), 1.4 * f, 1.4 * f, 12).translate([x, y, z0]))
            elif k == 'statue' or k == 'strahd-statue':
                s = d.get('s', 1.0)
                m = union([Manifold.cube([2 * f * s, 2 * f * s, 0.8 * f]).translate([-f * s, -f * s, z0]),
                           Manifold.cylinder(5 * f * s, 0.7 * f * s, 0.55 * f * s, 10).translate([x * 0, 0, z0 + 0.8 * f]),
                           Manifold.sphere(0.6 * f * s, 10).translate([0, 0, z0 + 5.8 * f * s])])
                self.parts['stone'].append(m.translate([x, y, 0]))
            elif k == 'armor-suit':
                m = union([Manifold.cube([1.6 * f, 1.6 * f, 0.6 * f]).translate([-0.8 * f, -0.8 * f, z0]),
                           Manifold.cylinder(4.6 * f, 0.6 * f, 0.5 * f, 8).translate([0, 0, z0 + 0.6 * f]),
                           Manifold.sphere(0.5 * f, 8).translate([0, 0, z0 + 5.3 * f])])
                self.parts['metal'].append(m.translate([x, y, 0]))
            elif k in ('table', 'desk'):
                w, dd = d.get('w', 6 if k == 'table' else 4), d.get('d', 3 if k == 'table' else 2)
                rbox(w, dd, 3 * f, 'wood')
            elif k == 'chair':
                rbox(2, 2, 1.6 * f, 'wood'); rbox(2, 0.4, 3.6 * f, 'wood')
            elif k == 'bed':
                rbox(d.get('w', 6), d.get('d', 3.5), 2 * f, 'wood')
            elif k == 'pallet':
                rbox(6, 2.5, 0.8 * f, 'wood')
            elif k in ('bookshelf', 'wardrobe'):
                rbox(3.5, 1.4, 6.5 * f, 'wood')
            elif k == 'chest':
                rbox(2.6, 1.6, 1.6 * f, 'wood')
            elif k == 'wine-cask':
                self.parts['wood'].append(Manifold.cylinder(3 * f, 1.4 * f, 1.4 * f, 10).translate([x, y, z0]))
            elif k == 'coffin':
                m = Manifold.extrude(cs([[(-3.2, -1.2), (-1.6, -1.8), (3.2, -1.1), (3.2, 1.1), (-1.6, 1.8), (-3.2, 1.2)]]).scale([f, f]), 2 * f)
                self.parts['stone'].append(m.translate([0, 0, z0]).rotate([0, 0, -rot]).translate([x, y, 0]))
            elif k == 'altar':
                rbox(6, 3, 3 * f, 'stone')
            elif k == 'dais':
                w = d.get('w', 10); h = d.get('h', 2); steps = max(1, int(d.get('steps', 1)))
                for i in range(steps):
                    sw = w - i * 2.5
                    rbox(sw, sw, (i + 1) * (h / steps) * f, 'stairs')
            elif k == 'trough':
                rbox(4, 2, 1.5 * f, 'stone')
            elif k == 'brazier':
                m = union([Manifold.cylinder(2.5 * f, 0.4 * f, 0.4 * f, 8), Manifold.cylinder(1.0 * f, 1.0 * f, 1.3 * f, 12).translate([0, 0, 2.5 * f])])
                self.parts['metal'].append(m.translate([x, y, z0]))
            elif k == 'stove' or k == 'fireplace':
                rbox(4, 2.5, 5 * f, 'stone')
            elif k == 'wagon':
                rbox(10, 5, 5 * f, 'wood')
            elif k == 'wheel':
                self.parts['metal'].append(Manifold.cylinder(3 * f, 0.5 * f, 0.5 * f, 8).translate([x, y, z0]))
            elif k == 'portcullis':
                self.portcullis(x, y, rot)
            elif k == 'crystal-orb':
                r = d.get('r', 2) * f
                grp = 'heart' if r > 3 * f else 'stone'
                zc = z0 + (r if grp == 'stone' else min(cfg.clear / 2, r + 1))
                self.parts[grp].append(Manifold.sphere(r, 20).translate([x, y, zc]))
            elif k == 'roof-gable':
                self.roof(o, x, y)
            elif k == 'chimney':
                rbox(5, 5, cfg.clear + 8, 'walls', cap=False)
            elif k == 'temple':
                rbox(d.get('w', 20), d.get('d', 20), cfg.clear - 0.5, 'walls')
            elif k == 'gate-tower':
                self.parts['walls'].append(Manifold.cylinder(cfg.clear, d.get('r', 7) * f, d.get('r', 7) * f, 16).translate([x, y, z0]))
            elif k == 'ledge':
                rbox(d.get('w', 10), 1, min(d.get('h', 6) * f, cfg.clear - 0.5), 'stone')
            elif k == 'pit-cover':
                self.parts['floor'][0] = self.parts['floor'][0] - Manifold.cylinder(cfg.slab + 2, d.get('r', 7.5) * f, d.get('r', 7.5) * f, 24).translate([x, y, -1])
            elif k == 'trapdoor':
                m = Manifold.cube([4 * f, 4 * f, 0.5]).translate([-2 * f, -2 * f, z0]); self.parts['wood'].append(m.translate([x, y, 0]))
            elif k == 'water':
                w, dd = d.get('w', 4), d.get('d', 4)
                m = Manifold.cube([w * f, dd * f, 0.5]).translate([-w * f / 2, -dd * f / 2, z0]); self.parts['water'].append(m.translate([x, y, 0]))
            elif k == 'drawbridge':
                rbox(d.get('len', 56), d.get('w', 18), 1.2, 'wood', cap=False)
            # creatures, notes, cobwebs, chains, rugs, hidden markers, niches, refuse: not printed

    def stairs_straight(self, o, x, y):
        cfg = self.cfg; f = cfg.f; d = o['dims']
        rise = d.get('rise', 10)
        if rise < 1:
            return
        w = d.get('w', 5) * f
        if 'fromX' in d:
            fr, to = d['fromX'], d['toX']; axis = 'x'
        else:
            fr, to = d['fromZ'], d['toZ']; axis = 'z'
        # the generator writes these runs in 5-ft cells; the fixed generator writes feet. Tell them apart by the position.
        pos = o['pos'][0] if axis == 'x' else o['pos'][2]
        lo, hi = min(fr, to), max(fr, to)
        if not (lo - 2 <= pos <= hi + 2):
            fr, to = fr * 5, to * 5
        run = abs(to - fr) * f
        if run < 2:
            return
        n = max(2, int(run // 6))
        h_total = cfg.clear - 0.2 if rise >= 20 else cfg.clear * min(1.0, rise / 40)
        step_h = h_total / n
        for i in range(n):
            t0, t1 = i / n, (i + 1) / n
            if axis == 'x':
                X0 = (fr + (to - fr) * t0) * f; X1 = (fr + (to - fr) * t1) * f
                m = box(X0, y - w / 2, cfg.slab, X1, y + w / 2, cfg.slab + step_h * (i + 1))
            else:
                Y0 = -(fr + (to - fr) * t0) * f; Y1 = -(fr + (to - fr) * t1) * f
                m = box(x - w / 2, Y0, cfg.slab, x + w / 2, Y1, cfg.slab + step_h * (i + 1))
            self.parts['stairs'].append(m)

    def spiral(self, o, x, y):
        cfg = self.cfg; f = cfg.f; d = o.get('dims', {})
        r_out = d.get('r', 8) * f - cfg.wall / 2 - 0.3
        r_in = d.get('r0', 0) * f
        if r_in < 2:
            r_in = max(2.5 * f, 0.3 * r_out)
            self.parts['stairs'].append(Manifold.cylinder(cfg.clear - 0.2, r_in, r_in, 16).translate([x, y, cfg.slab]))
        r_out = max(r_out, r_in + 2 * f)
        N = 14; span = 360 / N * 1.7; h = (cfg.clear - 0.2) / N
        steps = []
        for i in range(N - 1):
            a0 = i * 360 / N; a1 = a0 + span
            pts = [(r_in * math.cos(math.radians(a)), r_in * math.sin(math.radians(a))) for a in np.linspace(a0, a1, 5)]
            pts += [(r_out * math.cos(math.radians(a)), r_out * math.sin(math.radians(a))) for a in np.linspace(a1, a0, 5)]
            steps.append(slab(cs([pts]), cfg.slab + i * h, cfg.slab + (i + 2) * h))
        self.parts['stairs'].append(union(steps).translate([x, y, 0]))

    def portcullis(self, x, y, rot):
        cfg = self.cfg; f = cfg.f
        w = 2 * cfg.cell; h = cfg.clear - cfg.lintel - 0.4
        bars = [Manifold.cube([w, 1.0, 1.2]).translate([-w / 2, -0.5, cfg.slab]), Manifold.cube([w, 1.0, 1.2]).translate([-w / 2, -0.5, cfg.slab + h - 1.2])]
        n = int(w // 3.5)
        for i in range(n + 1):
            bars.append(Manifold.cylinder(h, 0.55, 0.55, 8).translate([-w / 2 + i * w / n, 0, cfg.slab]))
        self.parts['metal'].append(union(bars).rotate([0, 0, -rot]).translate([x, y, 0]))

    def roof(self, o, x, y):
        cfg = self.cfg; f = cfg.f; d = o['dims']
        w, dd, h = d.get('w', 20) * f, d.get('d', 20) * f, min(d.get('h', 12) * f, cfg.clear * 0.9)
        tri = cs([[(-w / 2, 0), (w / 2, 0), (0, h)]])
        m = Manifold.extrude(tri, dd).rotate([90, 0, 0]).translate([0, dd / 2, cfg.slab + 2.0])
        self.parts['roof'].append(m.rotate([0, 0, -o.get('rotY', 0)]).translate([x, y, 0]))

    # --- stacking features
    def add_pegs(self, above):
        """Pegs on this level's tower rings where the level above has the same tower; sockets in its slab."""
        cfg = self.cfg
        if above is None:
            return 0
        n = 0
        for (c, rmid, key, covered, poly) in self.towers:
            match = [t for t in above.towers if math.hypot(t[0][0] - c[0], t[0][1] - c[1]) < cfg.cell]
            if not match:
                continue
            for vi in (0, 3, 5):
                v = poly[vi]; ang = math.atan2(v[1] - c[1], v[0] - c[0])
                px, py = c[0] + rmid * math.cos(ang), c[1] + rmid * math.sin(ang)
                self.parts['walls'].append(Manifold.cylinder(cfg.peg_h, cfg.peg_d / 2, cfg.peg_d / 2, 12).translate([px, py, cfg.pitch - 0.01]))
                sock = Manifold.cylinder(cfg.peg_h + 0.3, cfg.peg_d / 2 + cfg.peg_clear / 2, cfg.peg_d / 2 + cfg.peg_clear / 2, 12).translate([px, py, -0.1])
                for grp in ('floor', 'walls', 'rock', 'grid'):
                    above.parts[grp] = [p - sock for p in above.parts[grp]]
                n += 1
        return n

    def add_supports(self, above):
        """Octagonal pillars in this level's rock/masonry (never inside a room) under the level above's slab."""
        cfg = self.cfg
        if above is None or not cfg.supports:
            return 0
        x0, y0, x1, y1 = above.footprint.bounds()
        mine = self.footprint; rooms = self.rooms_cs
        step = 3 * cfg.cell; n = 0
        probes = []
        for X in np.arange(x0 + step / 2, x1, step):
            for Y in np.arange(y0 + step / 2, y1, step):
                probes.append((X, Y))
        walls_m = union(self.parts['walls'])
        for X, Y in probes:
            pt = rect_cs(X - 0.1, Y - 0.1, X + 0.1, Y + 0.1)
            if (above.footprint ^ pt).is_empty() or (mine ^ pt).is_empty() or not (rooms ^ pt).is_empty():
                continue
            near = walls_m ^ box(X - 1.5 * cfg.cell, Y - 1.5 * cfg.cell, cfg.slab + 1, X + 1.5 * cfg.cell, Y + 1.5 * cfg.cell, cfg.pitch - 1)
            if near.volume() > 50:
                continue
            self.parts['walls'].append(regular(X, Y, 4.5, 8, cfg.slab, cfg.pitch, rot=22.5))
            n += 1
        return n


# ------------------------------------------------------------------ tiling
def cut_positions(cfg, lo, hi, door_cells, axis):
    """Cut lines through cell centres between lo and hi (mm), at most `max_cells` apart, avoiding door cells."""
    max_cells = int((cfg.bed - 2 * cfg.tongue - 6) // cfg.cell)
    n_cells = int(math.ceil((hi - lo) / cfg.cell - 1e-6))
    if n_cells <= max_cells:
        return []
    n_tiles = int(math.ceil(n_cells / max_cells))
    ideal = [lo + (hi - lo) * i / n_tiles for i in range(1, n_tiles)]
    first_center = (math.floor(lo / cfg.cell) + 0.5) * cfg.cell
    cuts = []
    for t in ideal:
        best, best_score = None, None
        for k in range(-3, 4):
            c = first_center + round((t - first_center) / cfg.cell + k) * cfg.cell
            if c <= lo + cfg.cell or c >= hi - cfg.cell or (cuts and c - cuts[-1] > max_cells * cfg.cell):
                continue
            score = abs(c - t) / cfg.cell
            for (mid, L) in door_cells:
                if abs(mid[axis] - c) < L / 2 + cfg.wall:
                    score += 10
            if best is None or score < best_score:
                best, best_score = c, score
        if best is not None:
            cuts.append(best)
    return cuts


def tiles_for(cfg, level: LevelBuild):
    x0, y0, x1, y1 = level.footprint.bounds()
    xs = [x0 - 1] + cut_positions(cfg, x0, x1, level.door_cells, 0) + [x1 + 1]
    ys = [y0 - 1] + cut_positions(cfg, y0, y1, level.door_cells, 1) + [y1 + 1]
    tiles = []
    for j in range(len(ys) - 1):
        for i in range(len(xs) - 1):
            tiles.append(((i, j), (xs[i], ys[j], xs[i + 1], ys[j + 1])))
    return tiles, xs, ys


def split_level(cfg, level: LevelBuild, groups):
    """Split every group into tiles; the floor gets half-laps along internal cut lines (the west/south tile carries the
    tongue, the east/north tile the notch)."""
    tiles, xs, ys = tiles_for(cfg, level)
    out = {}
    hz = cfg.slab / 2
    internal_x = xs[1:-1]; internal_y = ys[1:-1]
    for (ij, (tx0, ty0, tx1, ty1)) in tiles:
        parts = {}
        for g, m in groups.items():
            if m.is_empty():
                continue
            t = clip(m, tx0, ty0, tx1, ty1)
            if g == 'floor':
                # tongues into the east/north neighbours, notches on the west/south edges
                if tx1 - 1 in [round(c - 1) for c in []]:
                    pass
                for cx_ in internal_x:
                    if abs(cx_ - tx1) < 1e-6:         # my east edge: add a tongue from the neighbour's floor
                        t = t + clip(m, cx_, ty0, cx_ + cfg.tongue, ty1, -1, hz)
                    if abs(cx_ - tx0) < 1e-6:         # my west edge: notch
                        t = t - box(cx_ - 1, ty0 - 1, -1, cx_ + cfg.tongue + 0.2, ty1 + 1, hz + 0.15)
                for cy_ in internal_y:
                    if abs(cy_ - ty1) < 1e-6:
                        t = t + clip(m, tx0, cy_, tx1, cy_ + cfg.tongue, -1, hz)
                    if abs(cy_ - ty0) < 1e-6:
                        t = t - box(tx0 - 1, cy_ - 1, -1, tx1 + 1, cy_ + cfg.tongue + 0.2, hz + 0.15)
            if not t.is_empty() and t.volume() > 1.0:
                parts[g] = t
        if parts:
            out[ij] = ((tx0, ty0, tx1, ty1), parts)
    return out, (len(xs) - 1, len(ys) - 1)


# ------------------------------------------------------------------ the mountain
def mountain(cfg, top_rect, cavity, height, out_dir, manifest):
    """The Pillarstone's top as a hollow, rock-skinned plinth two pitches tall: its flat top carries the courtyard tray
    (top_rect, mm), its open cavity (mm, clearance included) holds the dungeon and larders trays, its outside slopes
    out towards the table under a noise-carved skin. Shelled (3-mm skin, 4-mm top) so it prints light, open at the
    bottom, cut into bed-sized pieces."""
    tx0, ty0, tx1, ty1 = top_rect; x0, y0, x1, y1 = cavity
    band_top, band_bot, skin = 12.0, 48.0, 3.0
    w, d = (tx1 - tx0) + 2 * band_top, (ty1 - ty0) + 2 * band_top
    W, D = (tx1 - tx0) + 2 * band_bot, (ty1 - ty0) + 2 * band_bot
    cx, cy = (tx0 + tx1) / 2, (ty0 + ty1) / 2
    def frustum(W_, D_, w_, d_, z0, z1):
        base = rect_cs(-W_ / 2, -D_ / 2, W_ / 2, D_ / 2).offset(6, JoinType.Round, 2.0, 12)
        return Manifold.extrude(base, z1 - z0, 6, 0, (w_ / W_, d_ / D_)).translate([cx, cy, z0])
    outer = frustum(W, D, w, d, 0, height)
    inner = frustum(W - 2 * skin, D - 2 * skin, w - 2 * skin, d - 2 * skin, -1, height - 4.0)
    cav = box(x0, y0, -1, x1, y1, height + 1)
    cav_wall = box(x0 - skin, y0 - skin, -1, x1 + skin, y1 + skin, height + 1)
    hollow = inner - cav_wall
    body = (outer - cav - hollow).refine_to_length(8.0)
    def rock(v):
        v = np.array(v, dtype=float)
        top = v[:, 2] > height - 1e-3; bot = v[:, 2] < 1e-3
        dx = np.where(v[:, 0] < tx0, v[:, 0] - tx0, np.where(v[:, 0] > tx1, v[:, 0] - tx1, 0.0))
        dy = np.where(v[:, 1] < ty0, v[:, 1] - ty0, np.where(v[:, 1] > ty1, v[:, 1] - ty1, 0.0))
        dist = np.hypot(dx, dy)
        outer_skin = dist > band_top - 2.5          # only the sloping outside face moves
        nx = dx / np.maximum(dist, 1e-6); ny = dy / np.maximum(dist, 1e-6)
        n = value_noise(v, 48.0) * 6.0 + value_noise(v + 777, 14.0) * 1.8
        strata = np.sin(v[:, 2] * 0.35 + value_noise(v + 99, 70.0) * 1.5) * 1.5
        amp = np.where(outer_skin & ~top, 1.0, 0.0)
        v[:, 0] += nx * (n + strata) * amp; v[:, 1] += ny * (n + strata) * amp
        v[:, 2] = np.where(top | bot, v[:, 2], v[:, 2] + value_noise(v + 5, 30.0) * 1.5 * amp)
        return v
    body = body.warp_batch(rock)
    files = []
    seg = cfg.bed - 10
    X0, Y0, X1, Y1 = cx - W / 2 - 14, cy - D / 2 - 14, cx + W / 2 + 14, cy + D / 2 + 14
    nx_ = int(math.ceil((X1 - X0) / seg)); ny_ = int(math.ceil((Y1 - Y0) / seg))
    xs = [X0 + (X1 - X0) * i / nx_ for i in range(nx_ + 1)]; ys = [Y0 + (Y1 - Y0) * j / ny_ for j in range(ny_ + 1)]
    k = 0
    for j in range(ny_):
        for i in range(nx_):
            piece = clip(body, xs[i], ys[j], xs[i + 1], ys[j + 1])
            if piece.is_empty() or piece.volume() < 200:
                continue
            k += 1
            name = f'mountain_{k:02d}_rock.stl'
            path = os.path.join(out_dir, name)
            tris = write_stl(path, piece)
            ok, vol, genus = check(piece)
            (bx0, by0, bz0), (bx1, by1, bz1) = bbox(piece)
            manifest.append(OrderedDict(level='base', tile=f'mountain-{k:02d}', group='rock', file=os.path.relpath(path, os.path.dirname(out_dir)),
                                        size_mm=[round(bx1 - bx0, 1), round(by1 - by0, 1), round(bz1 - bz0, 1)], volume_cm3=round(vol / 1000, 1),
                                        triangles=tris, manifold=ok, origin_offset_mm=[round(bx0, 1), round(by0, 1), 0]))
            files.append(name)
    return files, (nx_, ny_)


def write_readme(a, cfg, summary, manifest, levels):
    import collections
    vol = collections.defaultdict(float); cnt = collections.Counter()
    for f in manifest:
        vol[f['level']] += f['volume_cm3']; cnt[f['level']] += 1
    total = sum(vol.values())
    L = []
    L.append('# Castle Ravenloft, floor by floor\n')
    L.append(f'Generated {time.strftime("%Y-%m-%d")} from mistLAB\'s castle scene by `print/castle-ravenloft/build.py`. '
             f'One 5-ft cell = {cfg.cell} mm; every level is {cfg.pitch} mm tall (slab {cfg.slab} mm + {cfg.clear:.1f} mm clear), walls {cfg.wall} mm, '
             f'tower rings {cfg.tower_wall} mm, tiles cut for a {cfg.bed:.0f} mm bed with 4-mm half-laps. Axes: X east, Y north, Z up. '
             f'Ground tray: {"the whole courtyard" if cfg.courtyard == "full" else "keep + apron, reaching over the sub-levels"}; sub-level trays: {cfg.sub_tray}; masonry: {cfg.masonry}.\n')
    L.append('## How the stack goes together\n')
    L.append('1. **Mountain** (`base/mountain_*.stl`): the rock plinth, hollow, open underneath, two levels tall. Its cavity takes the two sub-level trays; its flat top carries the courtyard tray.')
    L.append('2. **Dungeon and catacombs** (−80 ft) sits on the table inside the cavity; **Larders** (−40 ft) stacks on it (tower rings carry pegs; the slab above has the sockets).')
    L.append('3. **Ground** (courtyard + main floor) rests on the mountain top and roofs the cavity: lift it off to play below. The **grand landing** (+30 ft) is a small insert that sits on the grand stair.')
    L.append('4. **Court of the Count** (+50), **Rooms of Weeping** (+90), **Spires** (+130, with the roofs), the **witches\' floor** (+150), **tower roofs and the bridge** (+190), **north peak** (+240), **north roof** (+250) and the **high peak** (+300) stack in that order, each located by the pegs on the tower rings below it.\n')
    L.append('Tiles within a level butt together on their half-laps: the west/south tile carries the 4-mm tongue under the east/north tile. Tile numbers run west→east, then south→north.\n')
    L.append('## Colour groups (one STL per group per tile, same origin: import a tile\'s STLs together as parts of one object)\n')
    L.append('| group | colour | what | 4-colour AMS slot |'); L.append('|---|---|---|---|')
    for g, (c, w, slot) in GROUPS.items():
        L.append(f'| `{g}` | `{c}` | {w} | {slot} |')
    L.append('\nA: floor + stairs + stone (light stone); B: walls + grid + rock + roof (dark stone); C: doors + wood + grass (wood/earth); D: metal + water + heart (or hand-paint). '
             'Each tile also has `_mono.stl` (everything unioned) and a `.3mf` that carries the parts with their colours.\n')
    L.append('## Levels\n')
    L.append('| level | elevation | tiles (grid) | footprint mm | solid volume cm³ |'); L.append('|---|---|---|---|---|')
    for lid, info in summary.items():
        if lid == 'base':
            L.append(f'| mountain | — | {info["pieces"]} | {info["top_mm"][2] - info["top_mm"][0]:.0f} × {info["top_mm"][3] - info["top_mm"][1]:.0f} (top), {info["height_mm"]:.0f} tall | {vol["base"]:.0f} |')
            continue
        fp = info['footprint_mm']
        L.append(f'| {lid} | {info["elevation_ft"]:+d} ft | {info["tiles"]} ({info["tile_grid"][0]}×{info["tile_grid"][1]}) | {fp[2] - fp[0]:.0f} × {fp[3] - fp[1]:.0f} | {vol[lid]:.0f} |')
    L.append(f'\nTotal solid volume {total / 1000:.1f} L ({total * 1.24 / 1000:.0f} kg if printed solid; thin slabs print nearly solid, tall parts at infill). '
             f'This is the cost of 1 in = 5 ft on a castle this size. Cheaper variants: `--cell-mm 12.7` (1 in = 10 ft, a quarter of the plastic, for display or 15-mm minis), '
             f'`--courtyard apron --sub-tray crop` (the defaults), `--slab-mm 2`, or print only the levels you play.\n')
    L.append('## Printing\n')
    L.append('- Tiles print flat as they are (Z up). Walls, pegs and spiral stairs need no supports; door leaves are 1.2 mm thick.')
    L.append('- Pegs are 3 mm × 2.4 mm with 0.5 mm socket clearance; sand them if your printer runs tight.')
    L.append('- The mountain pieces print as they are (open bottom, 3-mm skin); their top rim is where the courtyard tray lands.')
    L.append('- `heart` is the Heart of Sorrow: translucent red filament, or clear resin.')
    L.append('- Everything is manifold (checked); `manifest.json` lists every file with its size, volume and triangle count.\n')
    L.append('## Regenerate\n')
    L.append('```\npython3 scripts/authoring/castle-ravenloft.py          # the scene (never hand-edit the JSON)\n'
             'python3 print/castle-ravenloft/build.py --out print/out  # the stack\n'
             'python3 print/castle-ravenloft/trinket.py --out print/out/trinket   # the desk piece\n'
             'python3 print/castle-ravenloft/preview.py --out print/out --stack  # pictures\n```\n')
    with open(os.path.join(a.out, 'README.md'), 'w') as f:
        f.write('\n'.join(L))


# ------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--scene', default=os.path.join(ROOT, 'locations', 'ch04', 'K', 'scene.json'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'print', 'out'))
    ap.add_argument('--cell-mm', type=float, default=25.4)
    ap.add_argument('--pitch-mm', type=float, default=32.0)
    ap.add_argument('--slab-mm', type=float, default=2.4)
    ap.add_argument('--wall-mm', type=float, default=3.0)
    ap.add_argument('--tower-wall-mm', type=float, default=6.0)
    ap.add_argument('--grid-depth-mm', type=float, default=0.6)
    ap.add_argument('--grid-width-mm', type=float, default=0.5)
    ap.add_argument('--bed-mm', type=float, default=250.0)
    ap.add_argument('--courtyard', choices=['apron', 'full'], default='apron')
    ap.add_argument('--apron-ft', type=float, default=20.0)
    ap.add_argument('--levels', default=None, help='comma-separated level ids to build (default: all)')
    ap.add_argument('--sub-tray', choices=['crop', 'rect'], default='crop', help='sub-level trays follow the rooms plus one cell (crop) or fill their bounding rectangle (rect)')
    ap.add_argument('--masonry', choices=['low', 'full'], default='low', help='solid rock/masonry between rooms: a 2-mm step (low) or full wall height (full)')
    ap.add_argument('--no-supports', action='store_true')
    ap.add_argument('--no-base', action='store_true')
    ap.add_argument('--no-3mf', action='store_true')
    a = ap.parse_args()
    cfg = Cfg(a)
    scene = json.load(open(a.scene))
    levels = {lv['id']: lv for lv in scene['levels']}
    os.makedirs(a.out, exist_ok=True)
    t0 = time.time()

    # the keep's footprint in feet: every room that is not courtyard, on every level above ground
    keep_pts = [p for lid in ('ground', 'court', 'weeping', 'spires') for r in levels[lid]['rooms']
                if r['key'] not in COURTYARD_KEYS and not r['key'].startswith('K46') for p in r['polygon']]
    kx0, kx1 = snap5(min(p[0] for p in keep_pts), False), snap5(max(p[0] for p in keep_pts), True)
    kz0, kz1 = snap5(min(p[1] for p in keep_pts), False), snap5(max(p[1] for p in keep_pts), True)
    apron = (kx0 - cfg.apron_ft, kz0 - cfg.apron_ft, kx1 + cfg.apron_ft, kz1 + cfg.apron_ft)
    # the courtyard tray also roofs the mountain's cavity, so it reaches over every sub-level room (plus one cell)
    sub_pts = [p for lid in SUBLEVELS if lid in levels for r in levels[lid]['rooms'] for p in r['polygon']]
    if sub_pts:
        apron = (min(apron[0], snap5(min(p[0] for p in sub_pts), False) - 5), min(apron[1], snap5(min(p[1] for p in sub_pts), False) - 5),
                 max(apron[2], snap5(max(p[0] for p in sub_pts), True) + 5), max(apron[3], snap5(max(p[1] for p in sub_pts), True) + 5))
    print(f'keep {kx0}..{kx1} × {kz0}..{kz1} ft; ground region {"full courtyard" if cfg.courtyard == "full" else apron}')

    order = [l for l in LEVEL_ORDER if l in levels and (cfg.levels is None or l in cfg.levels)]
    builds = OrderedDict()
    for lid in order:
        region = None
        if lid == 'ground' and cfg.courtyard == 'apron':
            region = apron
        elif lid not in SUBLEVELS and lid != 'ground' and cfg.courtyard == 'apron':
            region = apron
        lb = LevelBuild(cfg, scene, levels[lid], region).build()
        builds[lid] = lb
        print(f'  {lid:12s} rooms {len(lb.rooms):3d} towers {len(lb.towers)}  ({time.time() - t0:.0f}s)')
    ids = list(builds.keys())
    for i, lid in enumerate(ids):
        above = builds[ids[i + 1]] if i + 1 < len(ids) else None
        if above is not None and ids[i + 1] == 'landing':      # the landing is an insert on the ground floor
            above = builds[ids[i + 2]] if i + 2 < len(ids) else None
        if lid == 'landing':
            continue
        pegs = builds[lid].add_pegs(above); sup = builds[lid].add_supports(above)
        print(f'  {lid:12s} pegs {pegs} supports {sup}')

    manifest = []; summary = OrderedDict()
    for idx, lid in enumerate(ids):
        lb = builds[lid]
        groups = OrderedDict((g, union(ms)) for g, ms in lb.parts.items() if ms)
        tiles, (nx, ny) = split_level(cfg, lb, groups)
        ldir = os.path.join(a.out, f'L{idx:02d}-{lid}'); os.makedirs(ldir, exist_ok=True)
        stats = []
        for (i, j), (tb, parts) in tiles.items():
            tname = f'{lid}_T{j * nx + i + 1:02d}' if len(tiles) > 1 else lid
            allm = []
            for g, m in parts.items():
                path = os.path.join(ldir, f'{tname}_{g}.stl')
                tris = write_stl(path, m)
                ok, vol, genus = check(m)
                (bx0, by0, bz0), (bx1, by1, bz1) = bbox(m)
                manifest.append(OrderedDict(level=lid, tile=tname, group=g, file=os.path.relpath(path, a.out),
                                            size_mm=[round(bx1 - bx0, 1), round(by1 - by0, 1), round(bz1 - bz0, 1)],
                                            volume_cm3=round(vol / 1000, 2), triangles=tris, manifold=ok))
                allm.append(m)
            mono = union(allm)
            write_stl(os.path.join(ldir, f'{tname}_mono.stl'), mono)
            if not a.no_3mf:
                write_3mf(os.path.join(ldir, f'{tname}.3mf'), [(g, m, GROUPS[g][0]) for g, m in parts.items()])
            (bx0, by0, _), (bx1, by1, _) = bbox(mono)
            stats.append((tname, round(bx1 - bx0, 1), round(by1 - by0, 1), round(mono.volume() / 1000, 1)))
        summary[lid] = OrderedDict(elevation_ft=levels[lid]['elevationFt'], name=levels[lid]['name'], tiles=len(tiles), tile_grid=[nx, ny],
                                   footprint_mm=[round(v, 1) for v in lb.footprint.bounds()], stack_z_mm=round(idx * cfg.pitch, 1), tile_sizes=stats)
        print(f'  wrote {lid:12s} {len(tiles)} tile(s) ({time.time() - t0:.0f}s)')

    if not a.no_base and 'dungeon' in builds and 'ground' in builds:
        bdir = os.path.join(a.out, 'base'); os.makedirs(bdir, exist_ok=True)
        pts = [builds[l].footprint.bounds() for l in SUBLEVELS if l in builds]
        cav = (min(p[0] for p in pts) - 1.5, min(p[1] for p in pts) - 1.5, max(p[2] for p in pts) + 1.5, max(p[3] for p in pts) + 1.5)
        top_rect = builds['ground'].footprint.bounds()
        files, grid_ = mountain(cfg, top_rect, cav, 2 * cfg.pitch, bdir, manifest)
        print(f'  base: {len(files)} mountain piece(s) in a {grid_[0]}×{grid_[1]} cut ({time.time() - t0:.0f}s)')
        summary['base'] = OrderedDict(cavity_mm=[round(v, 1) for v in cav], top_mm=[round(v, 1) for v in top_rect], height_mm=2 * cfg.pitch, pieces=len(files))

    write_readme(a, cfg, summary, manifest, levels)
    json.dump(OrderedDict(config=vars(a), levels=summary, groups=OrderedDict((g, OrderedDict(color=c, what=w, ams_slot=s)) for g, (c, w, s) in GROUPS.items()),
                          files=manifest), open(os.path.join(a.out, 'manifest.json'), 'w'), indent=1)
    bad = [f for f in manifest if not f['manifold']]
    print(f'done: {len(manifest)} files, {len(bad)} not manifold, {time.time() - t0:.0f}s')


if __name__ == '__main__':
    main()
