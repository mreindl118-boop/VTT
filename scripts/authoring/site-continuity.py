#!/usr/bin/env python3
"""Reconcile the regional data with the detailed survey ties of the local maps.

Run after barovia-world/heightfield and the site generators, then run barovia-world.py once more: it lays the
measured roads and rivers (item 2f-1a) and keeps what this writes. Idempotent; preserves pins, roads, rivers and the
surveyed height lattice. Sources: CoS pp.36,158–159,183. No book prose or image data is written.

What is tied here: the Tser Pool. The camp's own water (ch02/G) continues into a pool at its north edge (the owner's
0.3.1 request), so the regional pool is the camp's 180-ft disc there; barovia-world.py keeps it (its TIED) and gives
it its outlet to the River Ivlis.

Retired by the measured net (barovia-world.py since item 2f-1a), which runs after this and lays its own: the Tsolenka
road's two pieces cut to Tsolenka's authored road (the measured road runs through the pass, and the world's roads meet a
map's roads at its edge), the Tser camp path, the Luna's last reach along the Tsolenka bridge's axis, and the Tser
Pool's outlet with the duplicated tributary (each river is one polyline there, and `outlets` joins the pool).
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PATH = ROOT / 'locations/ch02/barovia-region/world.json'
w = json.loads(PATH.read_text(encoding='utf-8'))

def point(path, x, z):
    scene = json.loads((ROOT / 'locations' / path / 'scene.json').read_text(encoding='utf-8'))
    level = next(l for l in scene['levels'] if l.get('terrain'))
    pts = [p for r in level['rooms'] + level['terrain'] for p in r['polygon']]
    cx = (min(p[0] for p in pts) + max(p[0] for p in pts)) / 2
    cz = (min(p[1] for p in pts) + max(p[1] for p in pts)) / 2
    pin = next(p for p in w['pins'] if path in p.get('scenes', []))
    angle = {'-z': 0, '-x': -math.pi/2, '+z': math.pi, '+x': math.pi/2}[level.get('north', '-z')]
    dx, dz = x-cx, z-cz
    return [round(pin['pos'][0] + (math.cos(angle)*dx + math.sin(angle)*dz)/5280, 8),
            round(pin['pos'][1] + (-math.sin(angle)*dx + math.cos(angle)*dz)/5280, 8)]

# Match the local north shoreline at x=100, z=30. The pool is several hundred
# feet across, while the old regional ellipse was almost half a mile wide.
pool = next(l for l in w['lakes'] if l['name']=='Tser Pool')
pool['center'] = point('ch02/G',100,-150)
pool['r'] = [180/5280, 180/5280]

PATH.write_text(json.dumps(w,indent=1,ensure_ascii=False)+'\n',encoding='utf-8',newline='\n')
print('Tied the Tser Pool to the camp; roads, rivers and pins unchanged (barovia-world.py lays the measured net next).')
