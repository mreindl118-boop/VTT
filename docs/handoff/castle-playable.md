# Item 2g: Castle Ravenloft — the playable castle, the print set, the trinket

Owner's request (2026-10-18, by voice while driving): make Castle Ravenloft more realistic and less clunky, with more
room where play needs it; then a floor-by-floor, colour-coded STL set that nests, with the mountain as a base that lets
you go into the sub-levels, at 1 in = 5 ft where possible; and a trinket-sized resin model of Ravenloft on the
mountain with the bridge. And: "I want the playable map version of Ravenloft to be the updated edition in the latest
edition of mistLAB once I approve it." The full brief as given to this session is `castle-ravenloft-occ.md` (Matt has
it); this file is what lives in the repository.

Branch: `claude/wip/castle-playable`, from main `97f3bee` plus the castle part of `claude/wip/item6-village-castle`.

## One plan, three outputs

1. **The scene** `scripts/authoring/castle-ravenloft.py` → `locations/ch04/K/{scene,grid}.json` (+ `exterior.json`
   via `ravenloft-exterior.py`). The playable pass on this branch: decorative statues stand in their alcoves along
   the walls (K14, K16, K17, K45), never in the walkway; the three great tower stairs climb round open wells
   (`r0 = r − 5 ft`, from item 6); the straight stairs' runs are in feet (item 6; on main they were in cells, so
   every flight was drawn near the castle's north-west corner); walls are cut free of the doors and secret doors they
   ran through (item 6); K83's turret stands as a shell inside K25 (item 6); the high tower's cone roof on K59.
2. **The print set** `print/castle-ravenloft/build.py` reads that scene (never a copy of it) and writes, per level,
   one STL per colour group per bed-sized tile, a `_mono.stl`, a `.3mf`, plus the hollow rock mountain, a manifest
   and a README. `preview.py` renders the pictures. Defaults: 25.4 mm per cell, 32 mm per level, 2.4-mm slab, 3-mm
   walls, 6-mm tower rings, 250-mm bed, half-lap tile joints, pegs on the tower rings, courtyard tray reaching over
   the sub-levels, sub-level trays cropped to their rooms. Flags in `--help`.
3. **The trinket** `print/castle-ravenloft/trinket.py`: one solid 90-mm piece (and a castle/rock pair) massed from the
   same rooms at true heights, caps on the towers, gables on the wings, the crenellated curtain wall, the Pillarstone,
   the ridge and the drawbridge.

`manifold3d` is the one dependency of the print scripts (`pip install manifold3d`; the cloud session built it from
source and put its build dir on `PYTHONPATH`). numpy and matplotlib for the previews.

## What is done, what is not

Done in the cloud on 2026-10-18: everything above, run end to end; a complete output set (895 STL/3MF files, previews,
README, manifest) was delivered to Matt as a zip. Every piece is a closed manifold; half-laps and pegs were checked
numerically; the plans were inspected from renders.

Not done (the cloud session had no npm): `npm run build`, `npx vitest run`, `audit-outdoor.py`, the in-app look at
the castle (desktop 1366×768 and phone 390×844, DM and Players), the Players-mode start test on every castle level.
The item 6 castle changes this branch carries were tested on their own branch in early October, not here.

## Co-working on item 2g (for whichever assistant picks this up: Claude Code or ChatGPT/Codex)

The maps are nobody's property (Matt, 2026-10-18); the rules are the ones in `AGENTS.md`, "Working on the maps
together". For this item in particular:

1. **Claim first.** The Claims table in `AGENTS.md` has a row for the castle generator, its scene files and
   `print/castle-ravenloft/`. Take it over by replacing the name and time when you start, and release it when the work
   is on main. One claim covers the generator *and* the print scripts: they read the same scene, so a change to one is
   a change to the other's input.
2. **Never hand-edit the JSON, never hand-merge it.** Change `castle-ravenloft.py`, re-run it, re-run
   `ravenloft-exterior.py`, commit the regenerated files with the script. When 0.3.3 (ChatGPT's all-map logic,
   `claude/wip/item2e-map-logic-laptop`) lands on main, merge main into this branch, resolve the *script* (both sides'
   behaviour: ChatGPT's K22 door, K28 partition, maps 6/7 re-registration and K51 hatch stay; this branch's playable
   pass stays), regenerate, and re-run `print/castle-ravenloft/build.py` so the print set follows.
3. **What to run before asking Matt to approve:** build, unit tests, `audit-outdoor.py`, the Players-mode start test
   on each castle level (at least one move allowed from the party's start; every door passable when open), and look
   at the castle in the app. Write the result in `AGENTS.md` Status with the commit hash. If the print scripts change,
   run `build.py` and `preview.py` and look at the pictures; the manifest's `manifold` flags must all be true.
4. **Matt approves.** Show him the castle in the app and the previews; he decides. Until he says yes, nothing from
   this branch goes to main, the link, the desktop tag or Visual-Aide.
5. **Release** (after approval, after 0.3.3): the next version in order, changelog entry in plain words naming the
   playable pass and the print set, tick item 2g in `docs/QUEUE.md`, update the row in `docs/HANDOFF.md`, full suite,
   push main, then Claude publishes the link, the desktop tag and the screenshots (the castle's screenshots go to
   Visual-Aide `releases/<version>-castle-ravenloft/`, print previews included; no book images ever).
6. **Questions for Matt** live in `AGENTS.md`; the open ones for this item: whether the courtyard tray should be the
   whole courtyard (`--courtyard full`) or stay keep + apron over the sub-levels (default); the level pitch (32 mm);
   the bed size (250 mm); one cell = 1 inch or roomier (28–30 mm) for 25-mm bases in single-cell corridors; the
   four-colour AMS mapping; and whether the playable castle releases as the version after 0.3.3 (recommended).
7. **Commits:** one concern per commit, the message names the maps you regenerated and looked at, and your usual
   trailer lines (`Claude-Session:` for Claude; `Co-Authored-By: ChatGPT` + `Agent: ChatGPT (continuing item 2g)`
   for ChatGPT). No model names in the repository.
