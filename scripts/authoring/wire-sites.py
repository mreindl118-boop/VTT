#!/usr/bin/env python3
"""Wire every built Curse of Strahd map into the campaign: each world-map pin opens the scenes built for it (in
world.json and in barovia-world.py's pin table, so a regenerated world keeps them), and every location the book
has no map for ('possible') whose scene.json now exists is marked 'built' in manifests/locations.json. Safe to re-run."""
import json, os, re
from collections import OrderedDict
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
built = lambda p: os.path.exists(os.path.join(ROOT, 'locations', p, 'scene.json'))
# pin key -> the scenes reachable from it (first is the one the pin opens)
SCENES = {
  'A': ['ch02/A'], 'B': ['ch02/B'], 'B2': ['ch02/B'], 'D': ['ch02/D'], 'D2': ['ch02/D'], 'F': ['ch02/F'], 'H': ['ch02/H'], 'I': ['ch02/I'],
  'J': ['ch02/J'],  # (Castle Ravenloft stays on its own pin: the app places a scene by the first pin that lists it) 'L': ['ch02/L'], 'M': ['ch02/M'], 'P': ['ch02/P'], 'R': ['ch02/R'],
  'Q': ['ch07/Q'], 'S': ['ch08/S', 'ch08/S10'], 'T': ['ch09/T'], 'U': ['ch10/U', 'ch10/U3'], 'V': ['ch11/V'], 'W': ['ch12/W'],
  'X': ['ch13/X'], 'Y': ['ch14/Y'], 'Z': ['ch15/Z'],
}
wp = os.path.join(ROOT, 'locations', 'ch02', 'barovia-region', 'world.json'); W = json.load(open(wp), object_pairs_hook=OrderedDict)
wired = {}
for p in W['pins']:
    want = [s for s in SCENES.get(p['key'], []) if built(s)]
    if not want: continue
    have = p.get('scenes') or []
    p['scenes'] = list(dict.fromkeys(want + [s for s in have if s not in want])); wired[p['key']] = p['scenes']
json.dump(W, open(wp, 'w'), indent=1)
# the generator's table, so a rebuilt world keeps the links
gp = os.path.join(ROOT, 'scripts', 'authoring', 'barovia-world.py'); g = open(gp).read()
for k, sc in wired.items():
    g = re.sub(r"(\('%s', '[^']*', \(-?\d+, -?\d+\), '\w+', )\[[^\]]*\]\)" % re.escape(k), lambda m: m.group(1) + repr(sc) + ')', g)
open(gp, 'w').write(g)
mp = os.path.join(ROOT, 'manifests', 'locations.json'); M = json.load(open(mp), object_pairs_hook=OrderedDict)
marked = []
for l in M['locations']:
    if l.get('status') == 'possible' and built(l['path'].replace('locations/', '')):
        l['status'] = 'built'; marked.append(l['id'])
json.dump(M, open(mp, 'w'), indent=1)
print('pins wired:', wired); print('marked built:', marked)
