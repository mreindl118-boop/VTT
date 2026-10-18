#!/usr/bin/env python3
"""Quick previews of the print set: an isometric view per level (all tiles, coloured by group) and the exploded stack.

    python3 print/castle-ravenloft/preview.py --out print/out [--levels court,weeping] [--view iso|top]
"""
from __future__ import annotations
import argparse, json, os, sys, struct
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build import GROUPS


def read_stl(path):
    with open(path, 'rb') as f:
        f.seek(80); n = struct.unpack('<I', f.read(4))[0]
        data = np.frombuffer(f.read(n * 50), dtype=np.dtype([('n', '<f4', 3), ('v', '<f4', (3, 3)), ('a', '<u2')]))
    return data['v'].astype(np.float64)


def shade(tri, base):
    n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]); ln = np.linalg.norm(n, axis=1); ln[ln == 0] = 1; n /= ln[:, None]
    light = np.array([-0.35, -0.25, 0.9]); light /= np.linalg.norm(light)
    lam = np.clip(n @ light, 0, 1) * 0.65 + 0.35
    c = np.array(matplotlib.colors.to_rgb(base))
    return np.clip(c[None, :] * lam[:, None], 0, 1)


def iso(tri, explode_z=0.0):
    """Isometric projection: X right, Y back, Z up → screen (u, v) and depth."""
    x, y, z = tri[..., 0], tri[..., 1], tri[..., 2] + explode_z
    u = (x - y) * np.cos(np.radians(30)); v = (x + y) * np.sin(np.radians(30)) + z
    d = x + y + z * 0.2
    return np.stack([u, v], axis=-1), d


def render(files, out_png, title, view='iso', explode=None, dpi=110):
    polys, cols, depth = [], [], []
    for grp, path, zoff in files:
        tri = read_stl(path)
        if len(tri) == 0:
            continue
        tri = tri + np.array([0, 0, zoff])
        if view == 'top':
            keep = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])[:, 2] > 0
            tri = tri[keep]
            uv = tri[..., :2]; d = -tri[..., 2].mean(axis=1)   # high faces last
        else:
            nrm = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
            keep = (nrm @ np.array([-1.0, -1.0, 1.2])) > 0           # back-face cull: the iso camera sits to the south-west, above
            tri = tri[keep]
            uv, d = iso(tri); d = d.mean(axis=1)
        if len(tri) == 0:
            continue
        polys.append(uv); cols.append(shade(tri, GROUPS[grp][0])); depth.append(d)
    if not polys:
        return
    P = np.concatenate(polys); C = np.concatenate(cols); D = np.concatenate(depth)
    order = np.argsort(-D, kind='stable')   # far first, near last; ties keep file order (grid after floors)
    fig = plt.figure(figsize=(16, 11), facecolor='#15131a')
    ax = fig.add_axes([0, 0, 1, 1]); ax.set_facecolor('#15131a')
    ax.add_collection(PolyCollection(P[order], facecolors=C[order], edgecolors='none', antialiased=False))
    ax.set_xlim(P[..., 0].min() - 10, P[..., 0].max() + 10); ax.set_ylim(P[..., 1].min() - 10, P[..., 1].max() + 10)
    ax.set_aspect('equal'); ax.axis('off')
    ax.text(0.01, 0.98, title, transform=ax.transAxes, color='#e8e2d6', fontsize=14, va='top', family='DejaVu Sans')
    fig.savefig(out_png, dpi=dpi); plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='print/out'); ap.add_argument('--levels', default=None); ap.add_argument('--view', default='iso')
    ap.add_argument('--stack', action='store_true', help='also render the exploded stack')
    a = ap.parse_args()
    man = json.load(open(os.path.join(a.out, 'manifest.json')))
    pdir = os.path.join(a.out, 'preview'); os.makedirs(pdir, exist_ok=True)
    by_level = {}
    for f in man['files']:
        by_level.setdefault(f['level'], []).append(f)
    want = a.levels.split(',') if a.levels else list(by_level.keys())
    for lid in want:
        files = [(f['group'], os.path.join(a.out, f['file']), 0.0) for f in by_level.get(lid, [])]
        info = man['levels'].get(lid, {})
        title = f"{lid}  {info.get('name', '')}  ({info.get('tiles', '')} tiles)"
        render(files, os.path.join(pdir, f'{lid}_{a.view}.png'), title, a.view)
        print('preview', lid)
    if a.stack:
        files = []
        for lid, fl in by_level.items():
            z = man['levels'].get(lid, {}).get('stack_z_mm', 0) * 2.2 if lid != 'base' else -30
            files += [(f['group'], os.path.join(a.out, f['file']), z) for f in fl]
        render(files, os.path.join(pdir, 'stack_exploded.png'), 'Castle Ravenloft — exploded stack', 'iso', dpi=90)
        print('preview stack')


if __name__ == '__main__':
    main()
