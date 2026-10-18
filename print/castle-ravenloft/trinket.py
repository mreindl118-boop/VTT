#!/usr/bin/env python3
"""Castle Ravenloft on the Pillarstone, with the chasm and the drawbridge, as one small solid for resin printing.

Built from the same scene as the app and the floor stack (locations/ch04/K/scene.json): every roofed room is massed
from its floor to its ceiling at true heights, the stair towers get conical caps, the wings their gable roofs, the
curtain wall its battlements, and the whole keep stands on a noise-carved rock pillar across a chasm from the ridge
that carries the approach road. Flat base, no feature thinner than about 0.8 mm at the default 90 mm height.

    python3 print/castle-ravenloft/trinket.py --out print/out/trinket [--height-mm 90]
Writes ravenloft-trinket.stl (one piece), ravenloft-trinket-castle.stl + ravenloft-trinket-rock.stl (two pieces to
paint separately) and a preview PNG."""
from __future__ import annotations
import argparse, json, math, os, sys, time
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from geom import (Manifold, CrossSection, JoinType, cs, rect_cs, box, slab, segment_box, cone, union, bbox, value_noise,
                  write_stl, check, poly_area)

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
OPEN_FLOORS = {'cobble', 'grass', 'dirt', 'plank'}          # unroofed floors: courtyards, the garden, the drawbridge
TOWER_KEYS = ('K18', 'K20', 'K21', 'K83', 'K12', 'K48', 'K57', 'K59', 'K60')


def P(x_ft, z_ft):
    return (x_ft, -z_ft)      # castle feet, Y north


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--scene', default=os.path.join(ROOT, 'locations', 'ch04', 'K', 'scene.json'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'print', 'out', 'trinket'))
    ap.add_argument('--height-mm', type=float, default=90.0)
    ap.add_argument('--rock-ft', type=float, default=330.0, help='height of the rock pillar under the courtyard, in castle feet')
    ap.add_argument('--seed', type=int, default=7)
    a = ap.parse_args()
    t0 = time.time()
    scene = json.load(open(a.scene))
    levels = {lv['id']: lv for lv in scene['levels']}
    os.makedirs(a.out, exist_ok=True)

    # ---------------------------------------------------------------- the keep: rooms massed floor to ceiling
    masses = []
    tower_tops = {}      # key -> (centre, radius, top ft)
    for lv in scene['levels']:
        e = lv['elevationFt']
        if e < 0:
            continue
        for r in lv['rooms']:
            if r['floor'] in OPEN_FLOORS and not r['key'].startswith('K46'):
                continue
            if r['key'].startswith('K46'):           # the parapet walks: a low crenellated wall, not a room mass
                continue
            top = e + (r.get('ceilingFt') or lv['ceilingFt'])
            if top - e < 1:
                top = e + 8
            poly = [P(x, z) for x, z in r['polygon']]
            if abs(poly_area(poly)) < 1:
                continue
            masses.append(slab(cs([poly]), e, top))
            if len(poly) == 8 and r['key'].split('-')[0][:3] in TOWER_KEYS:
                cx = sum(p[0] for p in poly) / 8; cy = sum(p[1] for p in poly) / 8
                rad = sum(math.hypot(p[0] - cx, p[1] - cy) for p in poly) / 8
                k = r['key'].split('-')[0]
                if k not in tower_tops or top > tower_tops[k][2]:
                    tower_tops[k] = ((cx, cy), rad, top)
    keep = union(masses)
    # tower caps
    caps = []
    for k, (c, rad, top) in tower_tops.items():
        rr = rad + 2.5
        caps.append(union([cone(c[0], c[1], rr, top - 2, top + 1, 16), cone(c[0], c[1], rr, top + 1, top + 1 + 1.25 * rr, 16, 0.0)]))
    # gable roofs over the wings (the spires level's roof props)
    sp = levels['spires']
    for o in sp['objects']:
        if o['kind'] == 'roof-gable':
            d = o['dims']; w, dd, h = d.get('w', 20), d.get('d', 20), d.get('h', 12)
            x, y = P(o['pos'][0], o['pos'][2])
            tri = cs([[(-w / 2, 0), (w / 2, 0), (0, h)]])
            m = Manifold.extrude(tri, dd).rotate([90, 0, 0]).translate([0, dd / 2, sp['elevationFt'] + 1])
            caps.append(m.rotate([0, 0, -o.get('rotY', 0)]).translate([x, y, 0]))
        if o['kind'] == 'chimney':
            x, y = P(o['pos'][0], o['pos'][2]); caps.append(box(x - 2.5, y - 2.5, sp['elevationFt'], x + 2.5, y + 2.5, sp['elevationFt'] + 30))
    # the parapets K46 at +90: a 3-ft wall with merlons along the keep's outer edge
    parapets = []
    we = levels['weeping']
    for r in we['rooms']:
        if r['key'].startswith('K46'):
            poly = [P(x, z) for x, z in r['polygon']]
            parapets.append(slab(cs([poly]), we['elevationFt'] - 2, we['elevationFt'] + 6))
    keep = union([keep] + caps + parapets)

    # ---------------------------------------------------------------- the curtain wall with battlements, gate towers, gate
    g = levels['ground']
    outer = rect_cs(0, -340, 380, 0); inner = rect_cs(20, -320, 360, -20)
    H = 90.0
    curtain = slab(outer - inner, 0, H)
    merlons = []
    for x in np.arange(2.5, 380, 10):
        merlons.append(box(x, -5, H, x + 5, 0, H + 6)); merlons.append(box(x, -340, H, x + 5, -335, H + 6))
    for y in np.arange(-337.5, 0, 10):
        merlons.append(box(0, y, H, 5, y + 5, H + 6)); merlons.append(box(375, y, H, 380, y + 5, H + 6))
    curtain = union([curtain] + merlons)
    # the gate: a 15-ft arch through the west wall at the drawbridge, and the two gate towers
    gate_cut = box(-2, -177.5, 0, 22, -162.5, 22)
    curtain = curtain - gate_cut
    towers = []
    for o in g['objects']:
        if o['kind'] == 'gate-tower':
            x, y = P(o['pos'][0], o['pos'][2]); r = o['dims'].get('r', 7); h = o['dims'].get('h', 100)
            towers.append(cone(x, y, r + 1, 0, h, 16)); towers.append(cone(x, y, r + 3, h - 2, h + 1, 16)); towers.append(cone(x, y, r + 3, h + 1, h + 1 + 1.3 * (r + 3), 16, 0.0))
    castle = union([keep, curtain] + towers)

    # ---------------------------------------------------------------- the drawbridge and the approach
    deck = box(-58, -181, -3, 2, -159, 0)                  # the bridge deck: planks 22 ft wide from the ridge to the gate
    rails = union([box(-58, -181, 0, 2, -179, 3), box(-58, -161, 0, 2, -159, 3)])
    piers = union([box(-40, -179, -60, -32, -161, -2), box(-18, -179, -60, -10, -161, -2)])
    arches = union([slab(cs([[(-40, 0), (-32, 0), (-36, 14)]]), 0, 1), ])   # unused shape kept simple: solid piers
    bridge = union([deck, rails])

    # ---------------------------------------------------------------- the rock: the Pillarstone and the ridge across the chasm
    RH = a.rock_ft
    def rock_mass(footprint_top: CrossSection, grow_bottom: float, top_z: float, base_z: float, seed_shift: float, amp: float):
        bottom = footprint_top.offset(grow_bottom, JoinType.Round, 2.0, 24)
        h = top_z - base_z
        tb = footprint_top.bounds(); bb = bottom.bounds()
        sx = (tb[2] - tb[0]) / (bb[2] - bb[0]); sy = (tb[3] - tb[1]) / (bb[3] - bb[1])
        cx, cy = (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2
        m = Manifold.extrude(bottom.translate([-cx, -cy]), h, 12, 0, (sx, sy)).translate([cx, cy, base_z])
        m = m.refine_to_length(9.0)
        def warp(v):
            v = np.array(v, dtype=float)
            t = (v[:, 2] - base_z) / max(h, 1e-6)
            top = t > 1 - 1e-4; base = t < 1e-4
            dx, dy = v[:, 0] - cx, v[:, 1] - cy
            rr = np.hypot(dx, dy); nx, ny = dx / np.maximum(rr, 1e-6), dy / np.maximum(rr, 1e-6)
            n = value_noise(v + seed_shift, 60.0) * amp + value_noise(v * 1.7 + seed_shift, 22.0) * amp * 0.35
            # ledges: a slow vertical banding so the cliff reads as strata
            band = np.sin(v[:, 2] * 0.11 + value_noise(v + 31, 90.0) * 2.0) * amp * 0.25
            k = np.where(top | base, 0.0, 1.0) * np.clip(1.2 - np.abs(t - 0.5) * 1.6, 0.25, 1.0)
            v[:, 0] += nx * (n + band) * k; v[:, 1] += ny * (n + band) * k
            return v
        return m.warp_batch(warp)
    court_fp = (outer.offset(14, JoinType.Round, 2.0, 24))
    pillar = rock_mass(court_fp, 55, 0.0, -RH, 0.0, 18.0)
    ridge_fp = cs([[(-150, -205), (-62, -195), (-62, -145), (-150, -135), (-175, -150), (-175, -190)]])
    ridge = rock_mass(ridge_fp, 45, 0.0, -RH, 500.0, 12.0)
    road = slab(cs([[(-150, -180), (-60, -180), (-60, -160), (-150, -160)]]), 0, 1.5)
    piers = piers ^ (pillar + ridge + box(-60, -200, -RH, 5, -140, 0))        # keep the piers inside the chasm walls' envelope
    plinth = slab((court_fp.offset(70, JoinType.Round, 2.0, 24) + ridge_fp.offset(60, JoinType.Round, 2.0, 24)).hull().offset(-20, JoinType.Round, 2.0, 24), -RH - 10, -RH)
    rock = union([pillar, ridge, plinth, piers, road])

    # ---------------------------------------------------------------- scale to the requested height and write
    whole = union([castle, bridge, rock])
    (x0, y0, z0), (x1, y1, z1) = bbox(whole)
    s = a.height_mm / (z1 - z0)
    def fin(m):
        return m.translate([-(x0 + x1) / 2, -(y0 + y1) / 2, -z0]).scale([s, s, s])
    whole_s, castle_s, rock_s = fin(whole), fin(union([castle, bridge])), fin(rock)
    for name, m in (('ravenloft-trinket', whole_s), ('ravenloft-trinket-castle', castle_s), ('ravenloft-trinket-rock', rock_s)):
        tris = write_stl(os.path.join(a.out, name + '.stl'), m)
        ok, vol, genus = check(m)
        (bx0, by0, bz0), (bx1, by1, bz1) = bbox(m)
        print(f'{name}: {bx1 - bx0:.1f} × {by1 - by0:.1f} × {bz1 - bz0:.1f} mm, {vol / 1000:.1f} cm³, {tris} triangles, manifold={ok}, genus={genus}')
    print(f'scale: 1 ft = {s:.3f} mm, 1 cell = {5 * s:.2f} mm; done in {time.time() - t0:.0f}s')
    json.dump(dict(height_mm=a.height_mm, mm_per_ft=s, rock_ft=a.rock_ft, files=['ravenloft-trinket.stl', 'ravenloft-trinket-castle.stl', 'ravenloft-trinket-rock.stl']),
              open(os.path.join(a.out, 'trinket.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
