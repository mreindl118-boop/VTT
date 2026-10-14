#!/usr/bin/env python3
"""Reproducible E5-only recipe, replacing the unavailable imported ML seed.

The compact authored measurements/props below preserve the existing a8af979
layout and semantic IDs. Source relationships: CoS pp45-47, plan p46. The hall
opens into the chapel; a stair reaches the earth undercroft 15 ft below. The
southern lower projection follows the existing upper-room envelope. This is
not a new full source-plan trace: the inherited hall/chapel sizes remain.

Runtime inputs: this file and authorlib.py only. Outputs: ch03/E5 scene/grid.
No existing output, private seed, reference file, or Git history is read.
"""
import json
from pathlib import Path

from authorlib import Level, ft, seg_key, unit_edges

ROOT = Path(__file__).resolve().parents[2]


def cells(points):
    return [(x / 5, z / 5) for x, z in points]


def rectangle(x, z, w, d):
    return cells([(x, z), (x + w, z), (x + w, z + d), (x, z + d)])


def retain_wall_ids(level, outlines):
    """Keep old ordinary-wall IDs where their boundary intervals survive.

    Shared authorlib cuts intervals around apertures and assigns part suffixes;
    saved door/window identities below are explicitly retained in full.
    """
    seen = set()
    for poly in outlines:
        for a, b in unit_edges(poly):
            key = seg_key(a, b)
            if key not in seen:
                seen.add(key)
                level.overrides[key] = {'id': f'{level.id}-w-{len(seen)}'}


def add_object(level, number, kind, x, z, *, dims=None, rot=0, label=None,
               visibility='player', size=None, dm=None):
    suffix = f'p{number}' if isinstance(number, int) else number
    level.obj(suffix, kind, (x / 5, z / 5), visibility, label=label,
              rotY=rot, dims=dims, size=size)
    if dm:
        level.objects[-1]['dm'] = dm


def build():
    ground = Level('ground', 'Ground Floor', 0, 14, interior='ashlar', exterior='ashlar', north='-z')
    room_specs = [
        ('E5f', 'Chapel', 46, (5, 0, 35, 25)),
        ('E5a', 'Hall', 45, (15, 25, 15, 17.5)),
        ('E5c', "Donavich's Bedroom", 45, (5, 25, 10, 8.75)),
        ('E5b', "Doru's Bedroom", 45, (5, 33.75, 10, 8.75)),
        ('E5e', 'Office', 46, (30, 25, 10, 8.75)),
        ('E5d', 'Trapdoor', 45, (30, 33.75, 10, 8.75)),
    ]
    for key, name, page, box in room_specs:
        ground.room(key, name, rectangle(*box), 'flagstone', page=page)
    retain_wall_ids(ground, [r[2] for r in ground.rooms])
    ground.terrain.append((rectangle(-20, -15, 85, 75), 'grass'))
    # These five saved door IDs, endpoints and lock states are unchanged.
    for number, a, b in [
        (52, (17.5, 42.5), (22.5, 42.5)),
        (53, (15, 25), (15, 30)),
        (54, (15, 33.75), (15, 38.75)),
        (55, (30, 25), (30, 30)),
        (56, (30, 33.75), (30, 38.75)),
    ]:
        ground.door(*cells([a, b]), id=f'ground-w-{number}', locked=number == 56)
    for number, a, b in [
        (57, (5, 2.5), (5, 7.5)), (58, (5, 12.5), (5, 17.5)),
        (59, (40, 2.5), (40, 7.5)), (60, (40, 12.5), (40, 17.5)),
        (61, (12.5, 0), (17.5, 0)), (62, (22.5, 0), (27.5, 0)),
    ]:
        ground._stamp(*cells([a, b]), flags=['window'], id=f'ground-w-{number}', wall=True)
    # The source has an open hall/chapel connection, not a sixth closable door.
    ground.opening(*cells([(15, 25), (30, 25)]))

    add_object(ground, 1, 'altar', 22.5, 3.5, label='Claw-scarred altar', dims={'w': 5})
    for number, x, z, rot in [(2, 12, 9, 0), (3, 12, 13, 0), (4, 12, 17, 0),
                              (5, 12, 21, 8), (6, 33, 9, 0), (7, 33, 13, -12),
                              (8, 33, 17, 0), (9, 33, 21, 0)]:
        add_object(ground, number, 'bench', x, z, rot=rot, dims={'l': 8})
    candles = [(10, 15, 5, 4, 5, 10, 20), (11, 30, 5, 4, 5, 10, 20),
               (12, 22.5, 23, 1.5, 1.5, 5, 10), (13, 7, 23, 1.5, 1.5, 5, 10),
               (14, 38, 23, 1.5, 1.5, 5, 10)]
    for number, x, z, height, y, bright, dim in candles:
        add_object(ground, number, 'candlestick', x, z, dims={'h': height})
        ground.lights.append(dict(id=f'ground-l{number}', pos=[x, y, z], preset='candle', bright=bright, dim=dim))
    for number, z in [(15, 29), (16, 38)]:
        add_object(ground, number, 'bed-plain', 10, z, rot=90, dims={'w': 3, 'l': 5})
    add_object(ground, 17, 'desk', 35, 29, dims={'w': 4, 'd': 2})
    add_object(ground, 18, 'chair', 35, 32.5, rot=180)
    add_object(ground, 19, 'bookshelf', 37.5, 26.5, dims={'w': 2, 'h': 5})
    add_object(ground, 20, 'trapdoor', 35, 38, label='Trapdoor to the undercroft (iron padlock)', dims={'w': 4})
    add_object(ground, 21, 'rug', 22.5, 33.5, dims={'w': 8, 'd': 12})
    for number, x, z, height, radius in [(22, -10, 0, 24, 6), (23, 55, 10, 20, 5), (24, 52.5, 45, 26, 6)]:
        add_object(ground, number, 'pine', x, z, dims={'h': height, 'r': radius})
    for number, x, z in [(25, -7.5, 30), (26, -12.5, 37.5), (27, -6, 45)]:
        add_object(ground, number, 'gravestone', x, z)
    add_object(ground, 28, 'fence', -10, 22.5, rot=90, dims={'w': 20})
    add_object(ground, 'spawn0', 'commoner', 22.5, 20, label='Donavich', size='medium', dm='Praying through the night')

    # Fifteen feet is the sourced descent. The matching ceiling and pillar rise
    # are a physical support convention reaching the existing ground datum.
    lower = Level('undercroft', 'Undercroft (E5g)', -15, 15, interior='ashlar', exterior='ashlar', north='-z')
    outline = cells([(0, 0), (45, 0), (45, 30), (40, 30), (40, 42.5),
                     (5, 42.5), (5, 30), (0, 30)])
    lower.room('E5g', 'Undercroft', outline, 'dirt', page=47)
    retain_wall_ids(lower, [rectangle(0, 0, 45, 30)])
    for number, a, b in [(1, (40, 30), (40, 42.5)), (2, (5, 42.5), (40, 42.5)), (3, (5, 30), (5, 42.5))]:
        lower._stamp(*cells([a, b]), id=f'undercroft-south-{number}')
    for number, x, z in [(1, 10, 7.5), (2, 22.5, 7.5), (3, 35, 7.5),
                          (4, 10, 22.5), (5, 22.5, 22.5), (6, 35, 22.5)]:
        add_object(lower, number, 'column', x, z, dims={'r': 0.6, 'h': 15})
    # Coordinates are absolute in the stair kit; no additional rotation. The
    # lower arrival is at the foot, twelve feet north of the preserved trapdoor.
    add_object(lower, 7, 'stairs-straight', 35, 26, dims={'w': 3, 'rise': 15, 'fromZ': 26, 'toZ': 38})
    add_object(lower, 8, 'bones', 7.5, 15)
    add_object(lower, 9, 'rubble', 15, 26)
    add_object(lower, 'spawn0', 'vampire-spawn', 15, 12.5, visibility='hidden-creature',
               label='Doru (vampire spawn)', size='medium', dm='Vampire spawn chained in the dark')

    levels = [ground.to_json(), lower.to_json()]
    for level in levels:
        level.pop('north')  # Preserve the existing implicit -z scene convention.
    scene = dict(schema=1, location='E5', chapter='ch03', name='Church', mapPage=46,
                 bookScaleFt=5, ambient='darkness', parent='ch03/E', levels=levels,
                 links=[dict(id='lk-ground-undercroft', kind='stairs',
                             **{'from': {'level': 'ground', 'pos': [35, 38]},
                                'to': {'level': 'undercroft', 'pos': [35, 26]}})])
    grid = {'schema': 1, 'levels': {}}
    for level in [ground, lower]:
        polygons = ([p for p, _ in level.terrain] if level is ground else []) + level.floor_polys
        grid['levels'][level.id] = dict(floorPolygons=[ft(p) for p in polygons], type='square',
                                       hexOrientation='pointy', origin=[0, 0], color='#1d1b22', opacity=0.55)
    return scene, grid


def main():
    scene, grid = build()
    output = ROOT / 'locations/ch03/E5'
    output.mkdir(parents=True, exist_ok=True)
    for name, data in [('scene', scene), ('grid', grid)]:
        (output / f'{name}.json').write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'E5: {len(scene["levels"])} levels; ' + ', '.join(f'{l["id"]} {len(l["walls"])} walls' for l in scene['levels']))


if __name__ == '__main__':
    main()
