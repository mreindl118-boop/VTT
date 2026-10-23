#!/usr/bin/env python3
"""Finish the imported Tser camp's shoreline; preserve its imported rooms/props.
The original M2 import has no retained generator. This repeatable postprocessor
owns only its floor/shore/access geometry (CoS p.36); it retains the 200x150-ft frame.
Run before site-continuity.py. No module prose or art is imported.
"""
import json
import math
from pathlib import Path
from shapely.geometry import Point, Polygon, box

ROOT = Path(__file__).resolve().parents[2]
folder = ROOT / 'locations/ch02/G'
scene = json.loads((folder/'scene.json').read_text(encoding='utf-8'))
grid = json.loads((folder/'grid.json').read_text(encoding='utf-8'))
lv = scene['levels'][0]
scene['ambient'] = 'barovian-overcast'
# The north-up source plan puts water along camp's northern edge. The exact
# circular curve is an authored continuation, not a measured source boundary.
pool = Polygon([(100+180*math.cos(i*math.tau/128),-150+180*math.sin(i*math.tau/128)) for i in range(128)])
frame = box(0,0,200,150)
def coords(p):
    pts = [[round(x,4),round(z,4)] for x,z in list(p.exterior.coords)[:-1]]
    if sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(pts,pts[1:]+pts[:1])) < 0: pts.reverse()
    first = min(range(len(pts)),key=lambda i:pts[i])
    return pts[first:]+pts[:first]
dry = frame.difference(pool)
wet = frame.intersection(pool)
trail = [[0,131],[38,106],[68,86],[73,93],[42,114],[0,140]]
lv['terrain'] = [{'polygon':coords(dry),'floor':'grass'}, {'polygon':coords(wet),'floor':'shallow-water'}, {'polygon':trail,'floor':'dirt'}]
# Retain the imported room's authored extent, not the previous rounded clipping
# result: repeatedly clipping the latter adds tiny vertices on every regeneration.
room_frames = {'G': [[40,30],[140,30],[140,110],[40,110]]}
for room in lv['rooms']:
    room['polygon'] = coords(Polygon(room_frames[room['key']]).difference(pool))
lv['objects'] = [o for o in lv['objects'] if o['id'] not in ('camp-p1','camp-p2','camp-pool-surface')]
lv['objects'].insert(0,{'id':'camp-pool-surface','kind':'water','pos':[0,0,0],'vis':'player','label':'Tser Pool','polygon':coords(wet)})
# Imported bank vegetation must stand on the new bank, not on the water.
for o in lv['objects']:
    if o['kind'] in ('pine','oak','dead-tree','boulder','bush'):
        x,_,z = o['pos']
        if o['id'] == 'camp-p18': x = o['pos'][0] = 150
        if abs(x-100)<180:
            shore = -150+math.sqrt(180**2-(x-100)**2)
            if z < shore+4: o['pos'][2] = round(shore+6,3)
        if Polygon(trail).covers(Point(o['pos'][0],o['pos'][2])):
            o['pos'][2] -= 12
    if o['id'] == 'camp-note0': o['pos'] = [120,0,130]
grid['levels']['camp']['floorPolygons'] = [coords(dry)] + [r['polygon'] for r in lv['rooms']]
grid['levels']['camp']['clipToFloors'] = True
for name,data in [('scene',scene),('grid',grid)]:
    (folder/(name+'.json')).write_text(json.dumps(data,indent=1,ensure_ascii=False)+'\n',encoding='utf-8',newline='\n')
print('Tser camp shoreline and dry access regenerated inside its original placement frame.')
