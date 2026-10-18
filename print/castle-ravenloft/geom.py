"""Shared geometry helpers for the Castle Ravenloft print set: Manifold wrappers, polygon utilities, STL and 3MF
writers, and a small fractal noise for rock surfaces. Everything is in millimetres unless a name says ft or cells.

manifold3d is the only non-standard dependency (pip install manifold3d, or a source build on PYTHONPATH)."""
from __future__ import annotations
import math, struct, zipfile, io, os
import numpy as np
from manifold3d import Manifold, CrossSection, JoinType, OpType, Error

EPS = 1e-6

# ------------------------------------------------------------------ polygons
def poly_area(p):
    a = 0.0
    for i in range(len(p)):
        x0, y0 = p[i]; x1, y1 = p[(i + 1) % len(p)]
        a += x0 * y1 - x1 * y0
    return a / 2


def ccw(p):
    """Return the polygon with counter-clockwise winding (Manifold wants CCW outer contours)."""
    return list(p) if poly_area(p) >= 0 else list(reversed(p))


def dedupe(p):
    out = []
    for q in p:
        if not out or abs(q[0] - out[-1][0]) > EPS or abs(q[1] - out[-1][1]) > EPS:
            out.append((float(q[0]), float(q[1])))
    if len(out) > 1 and abs(out[0][0] - out[-1][0]) < EPS and abs(out[0][1] - out[-1][1]) < EPS:
        out.pop()
    return out


def cs(polys):
    """A CrossSection from a list of polygons (each a list of (x, y)); unions them (positive fill rule)."""
    good = []
    for p in polys:
        p = dedupe(p)
        if len(p) >= 3 and abs(poly_area(p)) > EPS:
            good.append(ccw(p))
    if not good:
        return CrossSection()
    acc = CrossSection([good[0]])
    for p in good[1:]:
        acc = acc + CrossSection([p])
    return acc


def rect_cs(x0, y0, x1, y1):
    return CrossSection([[(x0, y0), (x1, y0), (x1, y1), (x0, y1)]])


def box(x0, y0, z0, x1, y1, z1):
    """An axis-aligned box between two corners (any order)."""
    xa, xb = sorted((x0, x1)); ya, yb = sorted((y0, y1)); za, zb = sorted((z0, z1))
    if xb - xa < EPS or yb - ya < EPS or zb - za < EPS:
        return Manifold()
    return Manifold.cube([xb - xa, yb - ya, zb - za]).translate([xa, ya, za])


def slab(cross: CrossSection, z0, z1):
    if cross.is_empty() or z1 - z0 < EPS:
        return Manifold()
    return Manifold.extrude(cross, z1 - z0).translate([0, 0, z0])


def segment_box(a, b, thick, z0, z1, extend=0.0):
    """A wall along a->b: `thick` wide, centred on the line, from z0 to z1, lengthened by `extend` at both ends."""
    (ax, ay), (bx, by) = a, b
    L = math.hypot(bx - ax, by - ay)
    if L < EPS or z1 - z0 < EPS:
        return Manifold()
    ang = math.degrees(math.atan2(by - ay, bx - ax))
    m = Manifold.cube([L + 2 * extend, thick, z1 - z0]).translate([-extend, -thick / 2, z0])
    return m.rotate([0, 0, ang]).translate([ax, ay, 0])


def regular(cx, cy, r, n, z0, z1, rot=0.0):
    if r < EPS or z1 - z0 < EPS:
        return Manifold()
    pts = [(cx + r * math.cos(math.radians(rot + 360 * i / n)), cy + r * math.sin(math.radians(rot + 360 * i / n))) for i in range(n)]
    return slab(CrossSection([pts]), z0, z1)


def cone(cx, cy, r, z0, z1, n=24, r_top=0.0):
    if z1 - z0 < EPS:
        return Manifold()
    return Manifold.cylinder(z1 - z0, r, r_top, n).translate([cx, cy, z0])


def union(ms):
    ms = [m for m in ms if m is not None and not m.is_empty()]
    if not ms:
        return Manifold()
    if len(ms) == 1:
        return ms[0]
    return Manifold.batch_boolean(ms, OpType.Add)


def bbox(m: Manifold):
    b = m.bounding_box()
    return (b[0], b[1], b[2]), (b[3], b[4], b[5])


def clip(m: Manifold, x0, y0, x1, y1, z0=-1e4, z1=1e4):
    return m ^ box(x0, y0, z0, x1, y1, z1)


# ------------------------------------------------------------------ noise
_rng = np.random.default_rng(1983)
_LATTICE = _rng.random((64, 64, 64)).astype(np.float32)


def value_noise(p, scale):
    """Fractal value noise in [-1, 1] sampled at points p (N×3, mm), lattice spacing `scale` mm."""
    out = np.zeros(len(p), dtype=np.float64)
    amp, s = 1.0, scale
    for _ in range(4):
        q = p / s
        i = np.floor(q).astype(np.int64); f = q - i
        f = f * f * (3 - 2 * f)
        def lat(dx, dy, dz):
            return _LATTICE[(i[:, 0] + dx) % 64, (i[:, 1] + dy) % 64, (i[:, 2] + dz) % 64]
        c00 = lat(0, 0, 0) * (1 - f[:, 0]) + lat(1, 0, 0) * f[:, 0]
        c10 = lat(0, 1, 0) * (1 - f[:, 0]) + lat(1, 1, 0) * f[:, 0]
        c01 = lat(0, 0, 1) * (1 - f[:, 0]) + lat(1, 0, 1) * f[:, 0]
        c11 = lat(0, 1, 1) * (1 - f[:, 0]) + lat(1, 1, 1) * f[:, 0]
        c0 = c00 * (1 - f[:, 1]) + c10 * f[:, 1]; c1 = c01 * (1 - f[:, 1]) + c11 * f[:, 1]
        out += amp * (c0 * (1 - f[:, 2]) + c1 * f[:, 2])
        amp *= 0.5; s *= 0.5
    return (out / 1.875) * 2 - 1


# ------------------------------------------------------------------ mesh export
def mesh_arrays(m: Manifold):
    mesh = m.to_mesh()
    v = np.asarray(mesh.vert_properties, dtype=np.float64)[:, :3]
    t = np.asarray(mesh.tri_verts, dtype=np.int64)
    return v, t


def write_stl(path, m: Manifold, name=b'mistlab'):
    v, t = mesh_arrays(m)
    tri = v[t]                                   # N×3×3
    n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    ln = np.linalg.norm(n, axis=1); ln[ln == 0] = 1; n = n / ln[:, None]
    data = np.zeros(len(t), dtype=np.dtype([('n', '<f4', 3), ('v', '<f4', (3, 3)), ('a', '<u2')]))
    data['n'] = n; data['v'] = tri
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    with open(path, 'wb') as f:
        f.write((name[:80]).ljust(80, b' ')); f.write(struct.pack('<I', len(t))); f.write(data.tobytes())
    return len(t)


def write_3mf(path, parts, unit='millimeter'):
    """A minimal 3MF: one object per part with a base-material colour, all built at the origin. parts = list of
    (name, Manifold, '#rrggbb')."""
    mats = []
    objs = []
    for idx, (name, m, color) in enumerate(parts):
        if m.is_empty():
            continue
        v, t = mesh_arrays(m)
        mats.append(f'<base name="{name}" displaycolor="{color}FF"/>')
        verts = ''.join(f'<vertex x="{x:.4f}" y="{y:.4f}" z="{z:.4f}"/>' for x, y, z in v)
        tris = ''.join(f'<triangle v1="{a}" v2="{b}" v3="{c}"/>' for a, b, c in t)
        objs.append((idx + 2, f'<object id="{idx + 2}" name="{name}" type="model" pid="1" pindex="{len(mats) - 1}">'
                              f'<mesh><vertices>{verts}</vertices><triangles>{tris}</triangles></mesh></object>'))
    model = ('<?xml version="1.0" encoding="UTF-8"?>'
             f'<model unit="{unit}" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">'
             '<resources>' f'<basematerials id="1">{"".join(mats)}</basematerials>' + ''.join(o for _, o in objs) +
             '</resources><build>' + ''.join(f'<item objectid="{i}"/>' for i, _ in objs) + '</build></model>')
    rels = ('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>')
    ctypes = ('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
              '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
              '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>')
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', ctypes); z.writestr('_rels/.rels', rels); z.writestr('3D/3dmodel.model', model)


def check(m: Manifold):
    """(ok, volume, genus) for a quick manifold sanity report."""
    if m.is_empty():
        return False, 0.0, 0
    return m.status() == Error.NoError, float(m.volume()), int(m.genus())
