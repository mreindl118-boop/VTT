# Party packs

Matt, 2026-11-12: *"create player tokens and 3d models for the VTT and place them accurately in the save state based on
module information and latest session notes"*. A party pack carries the table's player characters into mistLAB: their
roster numbers, a round portrait token, their own low-poly miniature, and where they stand when the next session opens.

The pack is the table's own file and lives outside this public repo (names, players and portraits belong to the
table). The code here only knows the generic parts a miniature can wear.

## The flow

1. **The pack** is a JSON file `{"schema": 1, "kind": "party", "characters": [...], "placement": {...}}`. In this
   campaign it lives in the project's files as `vtt-party/party.json`.
2. **Open it:** Initiative (crossed swords) → *Party…* → *Open party file…*. Each character shows as a card: portrait,
   player, level, size, the numbers the range overlay uses, and the prep's notes. Problems are listed above the cards.
3. **Apply to this campaign** writes, as ticked:
   - **Roster:** each character's sheet added or updated by id (portrait and miniature included). The starting
     Fighter, Rogue, Cleric and Wizard sheets go if they were never renamed; anything the DM renamed or added stays.
   - **Place on the map:** each character stands in their own token (role `pc`) at the placement's position. Their
     old standing tokens elsewhere are taken up, and so is the plain party marker on that map. Refused while a fight
     runs on that map.
   - **World map:** the party's mark moves through the `via` pins to `pin` (a short trail), and the `reveal` pins
     become known to the players.
   The map opens on the party. Applying twice is safe: nothing doubles.
4. **Miniatures or round tokens:** the switch at the top of the Party sheet. Miniatures stand on a portrait base; round
   tokens are the portrait alone, flat on the floor. It is a per-device view choice (localStorage), not campaign state.

## Standing tokens and fights

A character's standing token is the one they fight with: *Start encounter* uses it where it stands instead of putting a
new one beside the party marker, and *End* leaves it there. Outside a fight the DM moves each character freely; on the
players' side they walk (walls and closed doors stop them). The first character placed counts as "the party" for the
camera's follow, the stairs and the minimap.

## Record fields

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Slug, also the roster sheet id (e.g. `pc-tb`). |
| `name` | yes | Shown on the token and in the roster. |
| `color` | yes | `#rrggbb`: the token's rim and name tag. |
| `player`, `short`, `level`, `notes` | | DM-side card details. |
| `size` | | `tiny` … `gargantuan` (default `medium`). |
| `speedFt`, `reachFt`, `rangeFt`, `darkvisionFt`, `initMod` | | The roster numbers (defaults 30, 5, 0, 0, 0). |
| `light` | | `{bright, dim}` in feet: a light the character carries or casts. |
| `portrait` | | A PNG, JPEG or WebP data URL; the token shows its inscribed circle. |
| `figure` | | The miniature recipe, below. |

`placement`: `scene` (path under `locations/`), `level`, `at` (`{id: [x, z]}` in scene feet; anyone left out stands
beside the first), `world` (`{pin, via?}`), `reveal` (pin keys), `note`.

### Miniature recipe (`figure`)

Built by `app/src/kit/heroes.ts` on the kit's humanoid, original geometry and flat colours:
`skin`, `hair`, `hairStyle` (`short` `long` `braids` `curly`), `hairStreak`, `cloth`, `trim`, `boots`, `height`
(relative), `ears` (`pointed`), `armor` (`{kind: plate|mail, color, trim}`), `cloak`, `hood`, `skirt`, `underskirt`,
`weapon` (`sword` `axe` `mace` `staff` `spear` `torch`), `offhand` (`{kind: shield|book|orb, color, rim, mark}`),
`wings` (`{color, opacity, count: 2|4}`, see-through), `halo`, `crown` (`{color, flower}`: a thorn crown), `wisp`
(a glowing spell wisp), `hoverFt`.

Detail: `eyes` (a bright colour reads as a glow), `shirt` (collar and placket), `sleeves`, `bracers`, `pendant`,
`buckle`, `earrings`, `markings` (marks on the face), `cloakTrim` (hem band and front edges), `tattered` (a ragged
cloak hem), `satchel` (bag on a strap), `coat` (`{tails, lapel}`), `vials` (up to four colours at the belt), `sparkles`
(motes drifting around the figure). Plate armour also gets layered pauldrons, tassets, knee guards and greaves.

Faces are smooth (cranium, jaw, cheekbones, a nose with a tip, eyes with whites, irises and pupils under a lid, brows
and lips; `lips` sets their colour) and hair is a smooth cap with its style on top. More parts: `gauntlets`, `clasps`
(cloak brooches), `bodice` (`{color, lacing}`), `puffSleeves`, `wingRim`, `gownTrim` (with `skirt` and `underskirt`,
the gown hangs open over the underskirt in folds with a pointed hem and embroidered edges), and `glow` (the spell a
battle stance holds).

### Battle stances

`stance`: `two-handed` (a great weapon raised across the body), `shield` (shield up, weapon high), `cast` (book forward,
the free hand thrust out with a spell, the flier rising), `conjure` (both hands forward round a gathering spell). A
character takes the stance while they are in the initiative order, and stands at rest again when the fight ends.

## Both rule sets

Nothing in a pack depends on the edition: speed, darkvision, size and light come from the species and are written as
numbers, so a 2014 and a 2024 character load the same way.
