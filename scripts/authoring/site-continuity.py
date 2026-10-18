#!/usr/bin/env python3
"""Reconcile the retained regional tracing with detailed T, G and X survey ties.

Run after barovia-world/heightfield and the site generators. Idempotent; preserves
pins, unrelated roads and the surveyed height lattice. Sources: CoS pp.36,158–159,183.
No book prose or image data is written.
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

def same(a,b): return math.dist(a,b) < 1e-6

# Regional pieces terminate inside the authored road, so the runtime can join at
# the exact edge of its 10-ft track. Keep the rest of the surveyed route intact.
west = next(r for r in w['roads'] if r['name']=='Tsolenka road' and same(r['pts'][0],[2.95,7.81]))
west['pts'] = west['pts'][:next(i for i,p in enumerate(west['pts']) if same(p,[3.22,9.53]))+1] + [point('ch09/T',227.5,490)]
east = next(r for r in w['roads'] if r['name']=='Tsolenka road' and [3.79,9.6] in r['pts'])
i = east['pts'].index([3.79,9.6]); j = east['pts'].index([5.23,10.89])
east['pts'] = [point('ch09/T',225,55), [3.48,9.57]] + east['pts'][i:j+1] + [point('ch13/X',100.5,455)]
w['roads'] = [r for r in w['roads'] if r['name'] != 'Tser camp path']
w['roads'].append({'name':'Tser camp path','kind':'trail','pts':[[11.06,7.97],point('ch02/G',0,135),point('ch02/G',40,110)]})

# Match the local north shoreline at x=100, z=30. The pool is several hundred
# feet across, while the old regional ellipse was almost half a mile wide.
pool = next(l for l in w['lakes'] if l['name']=='Tser Pool')
pool['center'] = point('ch02/G',100,-150)
pool['r'] = [180/5280, 180/5280]

# The final surveyed Luna reach meets the bridge axis, rather than stopping
# 2,189 ft beside it. Follow that axis across the narrow gorge before Lake Luna.
luna = next(r for r in w['rivers'] if r['name']=='Luna River')
last = luna['pts'].index([4.69,9.09])
luna['pts'] = luna['pts'][:last+1] + [point('ch09/T',-700,170),point('ch09/T',155,170),point('ch09/T',900,170),[2.84,10.11]]

# Connect the local pool to the existing Ivlis network. The previously duplicated
# traced tributary is retained once; unrelated river geometry is untouched.
seen = set(); rivers = []
for r in w['rivers']:
    if r['name']=='Tser Pool outlet': continue
    key = json.dumps(r,sort_keys=True)
    if key not in seen: rivers.append(r); seen.add(key)
rivers.append({'name':'Tser Pool outlet','pts':[point('ch02/G',100,-150),[11.71,7.6]]})
w['rivers'] = rivers
PATH.write_text(json.dumps(w,indent=1,ensure_ascii=False)+'\n',encoding='utf-8',newline='\n')
print('Reconciled Tsolenka, Tser Pool and Amber Temple regional ties; pins unchanged.')
