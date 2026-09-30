#!/usr/bin/env python3
"""Import a `tabletop-mapset 1.0` export (reference/imports/<campaign>/mapset.json) into mistLAB scenes.

Frame: the mapset's x east, y south (feet from the canvas top-left) maps straight onto our plan [x, z].
Battle maps of one site become one scene with several levels (tavern L0/L1, the compound L0–L3); assembly
and pointer maps become notes in the campaign manifest. Geometry only: floors → rooms/terrain, walls (clipped
by their openings) → walls with door/window flags, stairs → runs + vertical links, posts → trunks and posts,
raised patches → prisms, recessed → water, decals → terrain. DM notes are carried as room notes (they are the
export's own structural summaries, not module text).

Usage: import-mapset.py <campaign-id>   (reads reference/imports/<id>/mapset.json)
"""
import json, math, sys
from collections import OrderedDict

CAMP = sys.argv[1] if len(sys.argv) > 1 else 'wsc'
M = json.load(open(f'reference/imports/{CAMP}/mapset.json'))
maps = {x['id']: x for x in M['maps']}

FLOOR = {'cobble': 'cobble', 'wood': 'plank', 'deck': 'plank', 'plaster': 'flagstone', 'dirt': 'dirt', 'path': 'dirt', 'road': 'dirt',
         'grass': 'grass', 'pasture': 'grass', 'woodland': 'grass', 'moor': 'grass', 'water': 'shallow-water', 'stone': 'flagstone', 'rock': 'flagstone'}
FLOOR_NAME = {'cobble': 'Cobbles', 'wood': 'Plank floor', 'deck': 'Deck', 'plaster': 'Interior', 'grass': 'Grass', 'pasture': 'Pasture', 'woodland': 'Woodland floor', 'dirt': 'Dirt', 'moor': 'Open ground'}
r3 = lambda v: round(float(v), 3)
pt = lambda p: [r3(p[0]), r3(p[1])]


def poly_of(shape):
    return [pt(p) for p in shape['polygon']]


def segs_of_wall(w):
    """Centreline segments of a wall: one for a box, many short ones for an arc/ring."""
    sh = w['shape']
    if sh['type'] == 'box':
        cx, cy = sh['center']; L = sh['length'] / 2; a = sh['angle_rad']
        dx, dy = math.cos(a) * L, math.sin(a) * L
        return [([cx - dx, cy - dy], [cx + dx, cy + dy])], sh['width']
    cx, cy = sh['center']; r = (sh['r_in'] + sh['r_out']) / 2
    if sh['type'] == 'ring': a0, a1 = 0.0, math.pi * 2
    else: a0, a1 = sh['a0_rad'], sh['a1_rad']
    if a1 < a0: a1 += math.pi * 2
    n = max(6, int((a1 - a0) * r / 2.5))
    pts = [[cx + math.cos(a0 + (a1 - a0) * i / n) * r, cy + math.sin(a0 + (a1 - a0) * i / n) * r] for i in range(n + 1)]
    return [(pts[i], pts[i + 1]) for i in range(n)], sh['r_out'] - sh['r_in']


def clip_segment(a, b, openings):
    """Remove the parts of segment a-b that fall inside an opening's span; return the remaining pieces."""
    pieces = [(a, b)]
    for o in openings:
        out = []
        for (p, q) in pieces:
            ux, uy = q[0] - p[0], q[1] - p[1]; L = math.hypot(ux, uy)
            if L < 1e-6: continue
            ux, uy = ux / L, uy / L
            # opening centre projected onto the segment; the wall must pass within a foot of it
            t = ((o['center'][0] - p[0]) * ux + (o['center'][1] - p[1]) * uy)
            perp = abs((o['center'][0] - p[0]) * -uy + (o['center'][1] - p[1]) * ux)
            half = o['width_ft'] / 2
            if perp > 1.2 or t < -half or t > L + half: out.append((p, q)); continue
            t0, t1 = max(0, t - half), min(L, t + half)
            if t0 > 0.05: out.append((p, [p[0] + ux * t0, p[1] + uy * t0]))
            if t1 < L - 0.05: out.append(([p[0] + ux * t1, p[1] + uy * t1], q))
        pieces = out
    return pieces


def opening_segment(o):
    a = o['normal_rad'] + math.pi / 2; h = o['width_ft'] / 2
    return [o['center'][0] - math.cos(a) * h, o['center'][1] - math.sin(a) * h], [o['center'][0] + math.cos(a) * h, o['center'][1] + math.sin(a) * h]


def convert_level(mp, lid, prefix):
    rooms, terrain, walls, objects, links = [], [], [], [], []
    elev = mp['level']['elev_ft']
    floors = sorted(mp['floors'], key=lambda f: -f.get('draw_order', 0))
    for i, f in enumerate(floors):
        poly = poly_of(f['shape'])
        if f['grid']:
            key = f"{lid}-{len(rooms) + 1}"
            rooms.append(OrderedDict(key=key, name=FLOOR_NAME.get(f['material'], f['material'].title()), polygon=poly, floor=FLOOR.get(f['material'], 'flagstone')))
        else:
            terrain.append(OrderedDict(polygon=poly, floor=FLOOR.get(f['material'], 'flagstone')))
    # the first (top-most) gridded floor carries the export's DM note for this level
    if rooms and mp.get('dm'):
        d = mp['dm']
        rooms[0]['desc'] = d.get('scene', '')
        note = d.get('notes', '')
        if d.get('creatures'): note += ' Creatures: ' + ', '.join(d['creatures']) + '.'
        if any(p['material'] == 'undergrowth' for p in mp['patches']): note += ' The raised green patches are undergrowth: difficult terrain.'
        rooms[0]['dm'] = note.strip()
    # walls: only 'full' pieces; window sills/lintels are drawn by our window flag
    doors_w = [o for o in mp['openings']]
    n = 0
    for w in mp['walls']:
        if w['kind'] != 'full': continue
        segs, thick = segs_of_wall(w)
        material = 'log' if thick <= 0.6 else 'plaster'
        for (a, b) in segs:
            for (p, q) in clip_segment(a, b, doors_w):
                n += 1
                walls.append(OrderedDict(id=f'{prefix}-{lid}-w{n}', a=pt(p), b=pt(q), flags=['normal'], material=material, heightFt=r3(w['z1_ft'] - w['z0_ft'])))
    for i, o in enumerate(mp['openings']):
        a, b = opening_segment(o)
        flags = ['window'] if o['kind'] == 'window' else ['door']
        walls.append(OrderedDict(id=f'{prefix}-{lid}-o{i + 1}', a=pt(a), b=pt(b), flags=flags, material='plaster', **({'open': False} if o['kind'] == 'door' else {})))
    # stairs: a run from the lower point toward the upper one; a vertical link at the lower end
    for s in mp['stairs']:
        if s['lower_level'] != lid: continue
        lo, up = s['lower'], s['upper']; ang = math.degrees(math.atan2(up[1] - lo[1], up[0] - lo[0]))
        run = math.hypot(up[0] - lo[0], up[1] - lo[1])
        objects.append(OrderedDict(id=f'{prefix}-{s["id"]}', kind='stairs-run', pos=[r3(lo[0]), 0, r3(lo[1])], vis='player', rotY=r3(-ang), dims=OrderedDict(len=r3(run), w=r3(s['width_ft']), rise=r3(s['rise_ft'])), label=f"Stairs to {s['upper_level']}"))
        links.append((s['id'], lid, pt(lo), s['upper_level'], pt(up)))
    for b in mp.get('bridges', []):
        poly = poly_of(b['shape'])
        objects.append(OrderedDict(id=f'{prefix}-{lid}-bridge{len(objects)}', kind='prism', pos=[0, 0, 0], vis='player', polygon=poly, dims=OrderedDict(h=r3(b['thickness_ft']), y=r3(b['deck_top_ft'] - elev - b['thickness_ft']), color=0x6b4e33)))
    for i, p in enumerate(mp['posts']):
        h = p['z1_ft'] - max(p['z0_ft'], elev)
        if h <= 0: continue
        if p['role'] == 'tree':
            objects.append(OrderedDict(id=f'{prefix}-{lid}-{p["id"]}', kind='oak', pos=[r3(p['center'][0]), 0, r3(p['center'][1])], vis='player', dims=OrderedDict(r=r3(p['radius_ft']), h=r3(h), canopy=r3(p.get('canopy_radius_ft') or 0), stub=1 if p['z0_ft'] < elev else 0)))
        else:
            objects.append(OrderedDict(id=f'{prefix}-{lid}-{p["id"]}', kind='post-round', pos=[r3(p['center'][0]), 0, r3(p['center'][1])], vis='player', dims=OrderedDict(r=r3(p['radius_ft']), h=r3(h))))
    for i, p in enumerate(mp['patches']):
        poly = poly_of(p['shape'])
        if p['dz_ft'] < 0:
            terrain.append(OrderedDict(polygon=poly, floor='shallow-water'))
        else:
            color = {'road': 0x8f7a58, 'undergrowth': 0x3f5a34, 'woodland': 0x4a5e3a, 'rock': 0x6d6a66}.get(p['material'], 0x5c6650)
            objects.append(OrderedDict(id=f'{prefix}-{lid}-patch{i + 1}', kind='prism', pos=[0, 0, 0], vis='player', polygon=poly, dims=OrderedDict(h=r3(p['dz_ft']), color=color), label=p['material'].title()))
    for i, d in enumerate(mp['decals']):
        terrain.append(OrderedDict(polygon=poly_of(d['shape']), floor=FLOOR.get(d['material'], 'dirt')))
    return rooms, terrain, walls, objects, links


def build_scene(scene_id, name, parts, chapter, ambient, page=None):
    levels, links, grid_levels = [], [], OrderedDict()
    ceilings = {'L0': 10, 'L1': 8, 'L2': 10, 'L3': 10}
    for mp in parts:
        lid = mp['level']['id']
        rooms, terrain, walls, objects, lk = convert_level(mp, lid, scene_id)
        interior_id = None
        lv = OrderedDict(id=lid, name=level_name(mp), elevationFt=r3(mp['level']['elev_ft']), ceilingFt=ceilings.get(lid, 10), rooms=rooms, walls=walls, objects=objects, lights=[])
        if terrain: lv['terrain'] = terrain
        levels.append(lv)
        for (sid, lo_l, lo, up_l, up) in lk:
            links.append(OrderedDict(id=f'lk-{sid}', kind='stairs', **{'from': {'level': lo_l, 'pos': lo}, 'to': {'level': up_l, 'pos': up}}))
        grid_levels[lid] = OrderedDict(floorPolygons=[r['polygon'] for r in rooms], type='square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0.55)
    scene = OrderedDict(schema=1, location=scene_id, chapter=chapter, name=name, bookScaleFt=5, ambient=ambient, levels=levels, links=links)
    if len(parts) > 1 and all(p['canvas'] == parts[0]['canvas'] for p in parts) and ambient != 'interior-dim': scene['stacked'] = True
    if any(p['source'] == 'mapped' for p in parts) or 'path' in scene_id: scene['valley'] = True
    if page: scene['mapPage'] = page
    return scene, OrderedDict(schema=1, levels=grid_levels)


def level_name(mp):
    t = mp['title'].split('—')[-1].strip()
    return t[0].upper() + t[1:]


import os
out_root = f'locations/{CAMP}'
os.makedirs(out_root, exist_ok=True)
# ---- sites: group battle maps sharing a canvas + levels into one scene
SITES = [
    ('01-tavern', 'The Tavern', ['01a-tavern-L0', '01b-tavern-L1'], '01', 'interior-dim'),
    ('02-street', 'The Street', ['02-town-street'], '02', 'barovian-overcast'),
    ('03a-road', 'The Main Road', ['03a-main-road-pasture'], '03', 'barovian-overcast'),
    ('03b-path', 'The Side Path', ['03b-woodland-path'], '03', 'barovian-overcast'),
    ('03-compound', "Noke's Tower", ['03c-compound-L0-ground', '03d-compound-L1-lower-platform', '03e-compound-L2-main-hall', '03f-compound-L3-bedroom'], '03', 'barovian-overcast'),
]
manifest_locs = []
for sid, name, part_ids, ch, amb in SITES:
    scene, grid = build_scene(sid, name, [maps[p] for p in part_ids], CAMP, amb)
    os.makedirs(f'{out_root}/{sid}', exist_ok=True)
    json.dump(scene, open(f'{out_root}/{sid}/scene.json', 'w'), indent=1)
    json.dump(grid, open(f'{out_root}/{sid}/grid.json', 'w'), indent=1)
    areas = [OrderedDict(key=r['key'], name=f"{lv['name']}: {r['name']}") for lv in scene['levels'] for r in lv['rooms']]
    manifest_locs.append(OrderedDict(id=sid, name=name, chapter=CAMP, section=ch, status='built', mapPages=[], areas=areas, path=f'locations/{CAMP}/{sid}', notes=' '.join(maps[p]['dm'].get('notes', '') for p in part_ids)))
    print(sid, [len(l['rooms']) for l in scene['levels']], 'rooms', sum(len(l['walls']) for l in scene['levels']), 'walls', sum(len(l['objects']) for l in scene['levels']), 'objects')

# ---- region → world.json (miles). Pointy hexes, odd rows shifted right, 1 mile flat-to-flat.
R = maps['00-region']; f = 1.0; h = 2 * f / math.sqrt(3)
def hx(col, row): return [r3(f / 2 + col * f + (f / 2 if row % 2 else 0)), r3(h / 2 + row * 0.75 * h)]
cells = {(c['col'], c['row']): c for c in R['cells']}
woods = [OrderedDict(name=cells[k]['terrain'].title(), pos=hx(*k)) for k in cells if cells[k]['code'] in ('W', 'F')]
high = [hx(*k) for k in cells if cells[k]['code'] == 'H']
route_anchor = {}
for mp in M['maps']:
    if mp.get('regional_anchor_hex'): route_anchor.setdefault(tuple(mp['regional_anchor_hex']), []).append(mp['id'])
site_of = {p: sid for sid, _, parts, _, _ in SITES for p in parts}
pins = []
for stop in M['module']['route']:
    mp = maps[stop['map']]; ah = mp.get('regional_anchor_hex')
    if not ah: continue
    scene = site_of.get(stop['map'])
    if any(p['key'] == str(stop['stop']) for p in pins): continue
    pins.append(OrderedDict(key=str(stop['stop']), name=stop['name'], pos=hx(*ah), type='settlement' if 'T' == cells[tuple(ah)]['code'] else 'landmark', **({'scenes': [f'{CAMP}/{scene}']} if scene else {})))
# merge scenes that share a pin position
merged = []
for p in pins:
    same = next((q for q in merged if q['pos'] == p['pos']), None)
    if same:
        same['name'] = same['name'] if same['name'] == p['name'] else f"{same['name']} / {p['name']}"
        same.setdefault('scenes', []); [same['scenes'].append(s) for s in p.get('scenes', []) if s not in same['scenes']]
    else: merged.append(p)
pins = merged
world = OrderedDict(schema=1, name=R['poster_title'] if R.get('poster_title') else 'The region', page=None, milesPerHex=1,
    note='Hex codes from the export: T town, G pasture, R road, P path, W/F woodland and forest, H hills, S stream, C the compound clearing.',
    bounds=OrderedDict(minX=0, minY=0, maxX=r3(R['hex']['cols'] * f + f / 2), maxY=r3(h / 2 + (R['hex']['rows'] - 1) * 0.75 * h + h / 2)),
    pins=pins,
    roads=[OrderedDict(name='Main road', pts=[hx(*c) for c in rd]) for rd in R['roads']] + [OrderedDict(name='Side path', pts=[hx(*c) for c in rd]) for rd in R['paths']],
    rivers=[OrderedDict(name='Stream', pts=[hx(*c) for c in st]) for st in R['streams']],
    lakes=[], peaks=[OrderedDict(name='The hills', pos=hx(*k)) for k in list(k for k in cells if cells[k]['code'] == 'H')[:1]], high=high, woods=woods)
os.makedirs(f'{out_root}/00-region', exist_ok=True)
json.dump(world, open(f'{out_root}/00-region/world.json', 'w'), indent=1)
manifest = OrderedDict(schema=1, source=f'tabletop-mapset 1.0 export (reference/imports/{CAMP}); geometry only, notes in the export\'s own words',
    title=M['module']['title'], publisher=M['module']['publisher'],
    chapters=[OrderedDict(id=CAMP, number=None, title=M['module']['title'])],
    sections=[OrderedDict(id=s['id'], title=s['title'], maps=s['maps']) for s in M['module']['sections']],
    locations=manifest_locs,
    pointers=[OrderedDict(id=mp['id'], title=mp['title'], pointsTo=[site_of.get(p, p) for p in mp['points_to']], note=(mp.get('dm') or {}).get('notes', mp.get('readme', ''))) for mp in M['maps'] if mp['kind'] == 'pointer'])
json.dump(manifest, open(f'manifests/{CAMP}-locations.json', 'w'), indent=1)
print('world pins', [(p['key'], p['name'], p.get('scenes')) for p in pins])
