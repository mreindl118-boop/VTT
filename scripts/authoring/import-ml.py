#!/usr/bin/env python3
"""Convert the uploaded `window.ML` seed locations (reference/imports/*.js, dumped to JSON by scripts/authoring/ml-dump.mjs)
into mistLAB scene.json/grid.json. Rect rooms -> polygons (cells * 5 ft), doors -> wall overrides, props -> kit kinds,
spawns -> hidden-creature slots. Only keys, names, pages, dimensions and placements are carried over."""
import json, os, sys, math
from collections import OrderedDict

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
sys.path.insert(0, os.path.dirname(__file__))
ML = json.load(open(sys.argv[1] if len(sys.argv) > 1 else '/tmp/claude-0/-home-user-VTT/3e57a1ac-07da-5111-aa9e-cccc471b7481/scratchpad/ml.json'))
C = 5

PROP_KIND = {  # ML prop type -> mistLAB kit kind (+ default dims)
    'statue': ('statue', {}), 'pillar': ('column', {}), 'torch': ('oil-lamp', {'y': 6}), 'stairs': ('stairs-straight', {}), 'table': ('table', {}), 'chair': ('chair', {}),
    'chandelier': ('chandelier', {'y': 9}), 'fireplace': ('fireplace', {}), 'printingPress': ('cabinet', {}), 'spiralStair': ('spiral-stair', {'rise': 10, 'r': 6}), 'altar': ('altar', {}),
    'pew': ('bench', {'l': 8}), 'candelabra': ('candlestick', {'h': 4}), 'bones': ('bones', {}), 'brazier': ('brazier', {}), 'bed': ('bed-plain', {}), 'rubble': ('rubble', {}), 'crate': ('trunk', {}),
    'rug': ('rug', {}), 'candle': ('candlestick', {'h': 1.5}), 'desk': ('desk', {}), 'bookshelf': ('bookshelf', {'w': 5}), 'trapdoor': ('trapdoor', {}), 'pine': ('pine', {}), 'gravestone': ('gravestone', {}),
    'fence': ('fence', {}), 'water': ('water', {}), 'tent': ('tent', {}), 'wagon': ('wagon', {}), 'barrel': ('wine-cask', {}), 'roundTable': ('table', {}), 'boulder': ('boulder', {}), 'signpost': ('signpost', {}),
    'deadTree': ('dead-tree', {}), 'house': ('house', {}), 'churchBuilding': ('church-building', {}), 'gateArch': ('gate-arch', {}), 'bush': ('bush', {}),
}
FLOOR = {'stone': 'flagstone', 'tile': 'flagstone', 'carpet': 'plank', 'crypt': 'flagstone', 'grass': 'grass', 'dirt': 'dirt', 'road': 'cobble', 'wood': 'plank'}
WALL = {'stone': 'ashlar', 'log': 'log'}
AMB = {'interior-night': 'darkness', 'exterior-dusk': 'interior-dim', 'exterior-overcast': 'barovian-overcast', 'exterior-night': 'night'}
SPAWN_KIND = {'donavich': ('commoner', 'Donavich', 'player'), 'doru': ('vampire-spawn', 'Doru (vampire spawn)', 'hidden-creature'), 'madam-eva': ('commoner', 'Madam Eva', 'player'), 'vistani': ('commoner', 'Vistana', 'player'),
              'vistani-bandit': ('cultist', 'Vistani bandit', 'player'), 'child': ('commoner', 'Vistani child', 'player'), 'horse': ('horse', 'Horse', 'player'), 'wolf': ('wolf', 'Wolf', 'hidden-creature'), 'dire-wolf': ('dire-wolf', 'Dire wolf', 'hidden-creature'),
              'scarecrow': ('scarecrow', 'Scarecrow', 'hidden-creature'), 'gargoyle': ('gargoyle', 'Gargoyle', 'hidden-creature'), 'red-wyrmling': ('red-dragon-wyrmling', 'Red dragon wyrmling', 'hidden-creature'), 'rahadin': ('cultist', 'Rahadin', 'hidden-creature'),
              'strahd': ('cultist', 'Strahd (illusion)', 'hidden-creature'), 'cyrus': ('commoner', 'Cyrus Belview', 'hidden-creature')}
SIZE = {'horse': 'large', 'dire-wolf': 'large', 'child': 'small'}

def hash2(a, b):
    x = math.sin(a * 12.9898 + b * 78.233) * 43758.5453
    return x - math.floor(x)

def convert(mlid, out_chapter, out_id, manifest_location, page_by_key=None, opts=None):
    opts = opts or {}
    src = ML['locations'][mlid]
    scene = OrderedDict(schema=1, location=manifest_location, chapter=out_chapter, name=src['title'].split(' (')[0] if opts.get('shortName') else src['title'], mapPage=src.get('page'),
                        bookScaleFt=src['bookScale'] if src['bookScale'] in (5, 10) else 5, ambient=AMB.get(src.get('env', ''), 'interior-dim'))
    if src['bookScale'] not in (5, 10): scene['placementFt'] = src['bookScale']
    if opts.get('kind'): scene['kind'] = opts['kind']
    levels, grid = [], OrderedDict()
    elev = 0
    src_levels = [l for l in src['levels'] if not opts.get('levels') or l['id'] in opts['levels']]
    keymap = opts.get('keymap', {})
    for li, lv in enumerate(src_levels):
        rooms, walls, objects, lights, floor_polys = [], [], [], [], []
        wid = 0
        edge_count = {}
        def poly_of(r):
            if 'poly' in r: return [(p[0], p[1]) for p in r['poly']]
            x, y, w, h = r['rect']; return [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
        for r in lv['rooms']:
            poly = poly_of(r)
            key = keymap.get(r.get('key'), r.get('key'))
            floor_polys.append(poly)
            if not key: continue  # unkeyed strips (village streets) are floor only
            rooms.append(OrderedDict(key=key, name=r['name'], page=(page_by_key or {}).get(key, src.get('page')), polygon=[[a * C, b * C] for a, b in poly], floor=FLOOR.get(r.get('floor') or lv.get('floor', 'stone'), 'flagstone')))
            if not r.get('noWalls'):
                for i in range(len(poly)):
                    a, b = poly[i], poly[(i + 1) % len(poly)]
                    steps = max(1, int(round(abs(b[0] - a[0]) + abs(b[1] - a[1]))))
                    for k in range(steps):
                        t0, t1 = k / steps, (k + 1) / steps
                        seg = ((a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0), (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1))
                        kk = tuple(sorted(seg)); edge_count[kk] = edge_count.get(kk, 0) + 1
        # doors: ML 'at' is the segment centre; side 'h' = horizontal segment, 'v' = vertical; w = length in cells (default 1)
        overrides = {}
        for d in lv.get('doors', []):
            x, y = d['at']; w = d.get('w', 1)
            if d['side'] == 'h': a, b = (x - w / 2, y), (x + w / 2, y)
            else: a, b = (x, y - w / 2), (x, y + w / 2)
            t = d.get('type', 'door')
            flags = {'door': ['door'], 'locked': ['door', 'locked'], 'arch': None, 'window': ['window'], 'secret': ['secret-door']}[t]
            kk = tuple(sorted((a, b)))
            overrides[kk] = (flags, d.get('label'))
        for kk, cnt in edge_count.items():
            a, b = kk
            ov = overrides.pop(kk, None)
            if ov and ov[0] is None: continue  # arch: opening
            wid += 1
            w = OrderedDict(id=f'{lv["id"]}-w-{wid}', a=[a[0] * C, a[1] * C], b=[b[0] * C, b[1] * C], flags=ov[0] if ov else ['normal'], material=WALL.get(lv.get('wallType', src.get('wallType')), 'ashlar'))
            if ov and 'door' in w['flags']: w['open'] = False
            if ov and 'secret-door' in w['flags']:
                objects.append(OrderedDict(id=f'{lv["id"]}-sdo-{wid}', kind='secret-panel', pos=[(a[0] + b[0]) / 2 * C, 0, (a[1] + b[1]) / 2 * C], vis='secret-door', label=ov[1] or 'Secret door', wall=w['id']))
            walls.append(w)
        for kk, ov in overrides.items():  # doors not on a room edge (e.g. church front doors on the open side): add as standalone walls
            if ov[0] is None: continue
            a, b = kk; wid += 1
            w = OrderedDict(id=f'{lv["id"]}-w-{wid}', a=[a[0] * C, a[1] * C], b=[b[0] * C, b[1] * C], flags=ov[0], material='ashlar')
            if 'door' in ov[0]: w['open'] = False
            walls.append(w)
        # ground
        if lv.get('ground'):
            x, y, w, h = lv['ground']['rect']
            floor_polys.insert(0, [(x, y), (x + w, y), (x + w, y + h), (x, y + h)])
            terrain = [OrderedDict(polygon=[[x * C, y * C], [(x + w) * C, y * C], [(x + w) * C, (y + h) * C], [x * C, (y + h) * C]], floor=FLOOR.get(lv['ground'].get('type', 'grass'), 'grass'))]
        else:
            terrain = []
        for r in lv['rooms']:
            if not r.get('key'): terrain.append(OrderedDict(polygon=[[a * C, b * C] for a, b in poly_of(r)], floor=FLOOR.get(r.get('floor', 'dirt'), 'dirt')))
        # props
        n = 0
        def add_prop(p, tag=''):
            nonlocal n
            n += 1
            kind, dd = PROP_KIND.get(p['type'], (p['type'], {}))
            dims = dict(dd); dims.update({k: v for k, v in (p.get('opts') or {}).items() if isinstance(v, (int, float))})
            if p.get('scale'): dims['scale'] = p['scale']
            if 'stairs' == p['type']:
                run = dims.pop('run', 10); rise = dims.pop('rise', 10); dims['rise'] = abs(rise)
                ry = p.get('ry', 0) % 360
                x, y = p['at']
                if ry in (0, 180): dims['fromZ'] = (y - (run / 2) / C) * C if ry == 0 else (y + (run / 2) / C) * C; dims['toZ'] = (y + (run / 2) / C) * C if ry == 0 else (y - (run / 2) / C) * C
                else: dims['fromX'] = (x - (run / 2) / C) * C if ry == 90 else (x + (run / 2) / C) * C; dims['toX'] = (x + (run / 2) / C) * C if ry == 90 else (x - (run / 2) / C) * C
                dims.pop('steps', None)
            vis = 'hidden-object' if p.get('cls') == 'hidden-object' else 'player'
            o = OrderedDict(id=f'{lv["id"]}-p{n}{tag}', kind=kind, pos=[p['at'][0] * C, 0, p['at'][1] * C], vis=vis)
            if p.get('ry'): o['rotY'] = p['ry']
            if p.get('key') and not p.get('name'): o['key'] = p['key']
            if p.get('name'): o['label'] = p['name']
            if dims: o['dims'] = dims
            objects.append(o)
            if p.get('light'):
                l = p['light']; lights.append(OrderedDict(id=f'{lv["id"]}-l{n}', pos=[p['at'][0] * C, l.get('y', 5), p['at'][1] * C], preset=l.get('color', 'candle'), bright=l['bright'], dim=l['dim']))
        for p in lv.get('props', []): add_prop(p)
        for sc in lv.get('scatter', []):
            x0, y0, w, h = sc['rect']; avoid = sc.get('avoid', [])
            for i in range(sc['count']):
                x, y = x0 + hash2(i, sc.get('seed', 1)) * w, y0 + hash2(i + 100, sc.get('seed', 1) + 7) * h
                if any(ax <= x <= ax + aw and ay <= y <= ay + ah for ax, ay, aw, ah in avoid): continue
                add_prop({'type': sc['type'], 'at': [x, y], 'opts': sc.get('opts'), 'scale': sc.get('scaleMin', 1) + hash2(i, 3) * (sc.get('scaleMax', 1) - sc.get('scaleMin', 1)), 'ry': hash2(i, 5) * 360}, 's')
        for i, sp in enumerate(lv.get('spawns', [])):
            kind, label, vis = SPAWN_KIND.get(sp['id'], ('commoner', sp['id'], 'hidden-creature'))
            if sp.get('hidden') is False: vis = 'player'
            o = OrderedDict(id=f'{lv["id"]}-spawn{i}', kind=kind, pos=[sp['at'][0] * C, 0, sp['at'][1] * C], vis=vis, label=label, size=SIZE.get(sp['id'], 'medium'))
            if sp.get('note'): o['dm'] = sp['note']
            objects.append(o)
        for i, nt in enumerate(lv.get('notes', [])):
            objects.append(OrderedDict(id=f'{lv["id"]}-note{i}', kind='note', pos=[nt['at'][0] * C, 0, nt['at'][1] * C], vis='dm-note', label=nt['text']))
        level = OrderedDict(id=lv['id'], name=lv['name'], elevationFt=elev, ceilingFt=lv.get('height', 10))
        if terrain: level['terrain'] = terrain
        if lv.get('env') and AMB.get(lv['env']): level['ambient'] = AMB[lv['env']]
        level.update(rooms=rooms, walls=walls, lights=lights, objects=objects)
        levels.append(level)
        grid[lv['id']] = OrderedDict(floorPolygons=[[[a * C, b * C] for a, b in p] for p in floor_polys], type='hex' if src.get('gridDefault') == 'hex' else 'square', hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0.55 if src.get('gridDefault') != 'none' else 0)
        elev -= lv.get('height', 10) if li == 0 and len(src_levels) > 1 else 0
    scene['levels'] = levels
    scene['links'] = []
    for lv in src_levels:
        for lk in lv.get('links', []):
            if lk.get('to') and any(x['id'] == lk['to'] for x in src_levels):
                scene['links'].append(OrderedDict(id=f'lk-{lv["id"]}-{lk["to"]}', kind='stairs', **{'from': {'level': lv['id'], 'pos': [lk['at'][0] * C, lk['at'][1] * C]}, 'to': {'level': lk['to'], 'pos': [lk['at'][0] * C, lk['at'][1] * C]}}))
    seen = set(); scene['links'] = [l for l in scene['links'] if not (tuple(sorted([l['from']['level'], l['to']['level']])) in seen or seen.add(tuple(sorted([l['from']['level'], l['to']['level']]))))]
    if opts.get('nonSpatial'): scene['nonSpatialKeys'] = opts['nonSpatial']
    out = os.path.join(ROOT, 'locations', out_chapter, out_id)
    os.makedirs(out, exist_ok=True)
    json.dump(scene, open(os.path.join(out, 'scene.json'), 'w'), indent=1, ensure_ascii=False)
    json.dump(OrderedDict(schema=1, levels=grid), open(os.path.join(out, 'grid.json'), 'w'), indent=1, ensure_ascii=False)
    print(out_id, ':', sum(len(l['rooms']) for l in levels), 'rooms', sum(len(l['walls']) for l in levels), 'walls', sum(len(l['objects']) for l in levels), 'objects')

pages = {}
try:
    pj = json.load(open(os.path.join(ROOT, 'reference', 'pages.json')))
    pages = {k.split('/', 1)[1]: v for k, v in pj.items()}
except Exception: pass

convert('church', 'ch03', 'E5', 'E5', page_by_key=pages, opts={'shortName': True})
convert('tser-pool', 'ch02', 'G', 'G', page_by_key=pages)
convert('forest-road', 'ch02', 'C', 'C', page_by_key=pages, opts={'levels': ['day'], 'keymap': {'Road': 'C'}})
convert('village-barovia', 'ch03', 'E', 'E', page_by_key=pages, opts={'kind': 'placement'})


# ------------------------------------------------------------------ character figure recipes -> manifests/characters.json
SKIN = ['#d9b899', '#c99a72', '#a67c5b', '#8a9a7c', '#cfcfd6']
HAIR = ['#1a1a1a', '#3a2a1a', '#8a5a2a', '#7a7a7a', '#d9d9d9', '#a04a2a']
def recipes():
    mpath = os.path.join(ROOT, 'manifests', 'characters.json')
    m = json.load(open(mpath))
    by_name = {c['name'].lower(): c for c in m['characters']}
    alias = {'strahd von zarovich': 'strahd-von-zarovich'}
    added = 0
    for c in ML['characters']:
        f = dict(c['figure'])
        name = c['name'].lower().split(' (')[0]
        target = by_name.get(name) or by_name.get(c['name'].lower())
        if not target:
            # try id match
            target = next((x for x in m['characters'] if x['id'] == c['id'] or x['id'].replace('-', ' ') == name), None)
        if not target: continue
        target['figure'] = f
        target.setdefault('role', c.get('role'))
        added += 1
    json.dump(m, open(mpath, 'w'), indent=1, ensure_ascii=False); open(mpath, 'a').write('\n')
    print('figure recipes attached:', added, 'of', len(ML['characters']))
recipes()
