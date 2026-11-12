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

### Body, joints and poses

Every figure is sculpted like a miniature (`kit/anatomy.ts`): the torso, pelvis and limbs are lofted through rings, so
a chest is deep in front, a calf full behind and a shoulder line flat. `frame` picks the feminine or masculine frame
(default: feminine for a curvy build or a gown, otherwise masculine) and `build` its weight: `lean` (the default),
`broad`, or `curvy`. The feminine frame has narrower shoulders, a defined waist, wider hips, a bust and slimmer limbs;
the masculine one a deeper chest, a square jaw and a heavier brow. Hands have fingers; boots have a heel and a sole.

The head is one sculpted skull (temples, cheekbones over hollow cheeks, a brow over deep-set eyes, the jaw and chin)
with a wedge nose, small shadowed eyes under lids, brows and lips; nothing is stuck on as a ball. Hair is laid in
tapering locks from a parting over a close under-layer cut at the hairline: `short` (tousled), `long` (past the
shoulders, locks framing the face), `braids` (swept back to two roped braids), `curly` (a mass of coils). `hairStreak`
colours a few locks at the right temple.

The bust is part of the body: two mounds sculpted into the chest itself, so a gown's neckline shows skin above it
and cloth lies over it below; `body.bust` sizes it.

Jiggle (the Party sheet's switch, on by default): the bust bounces on a damped spring when a miniature is picked up
or moved. It costs nothing while nothing is moving; switched off, figures are built without the weights.

`body` fits the frame to the character's art with multipliers (1 = the frame's own): `shoulders`, `chest`, `waist`,
`hips`, `bust`, `arms`, `legs` (girth) and `neck`. A brawny fighter might take `{ "shoulders": 1.12, "waist": 1.2,
"arms": 1.3 }`; a slight one `{ "shoulders": 0.95, "waist": 0.9, "arms": 0.88 }`.

A figure takes `pose` out of initiative (default `rest`), `battlePose` in it (default its `stance`) and `deadPose` when
it is down (default `dead`). Each is a name or joint angles:

- Names: `rest` (standing at ease: weight on one leg, hips and shoulders tilted against each other, the head
  turned; one of three variants picked by the recipe, or a gown's own with the knee in the slit), `two-handed` (a deep
  lunge, a great weapon raised across the body), `shield` (the shield side leading in a lunge, the shield across the
  body, the weapon arm cocked back at the shoulder),
  `cast` (book raised, the free hand thrust out with a spell, the flier rising), `conjure` (the casting hand forward
  round a gathering spell, the book in the other), `ride` (seated astride, hands on the reins), `lunge`, `menace`
  (arms spread, hands clawed), `cower`, `kneel`, `staff-raised`, and the dead: `dead` (sprawled on the back),
  `dead-prone` (face down, an arm folded behind the back, a leg hitched out), `dead-comic` (face-planted, rump in
  the air), `dead-swoon`, `dead-curled` (on its side, knees drawn up). The dead have crossed-out eyes.
- Angles (radians): `spine`, `neck`, `pelvis`, `shoulderR/L`, `wristR/L`, `hipR/L`, `ankleR/L` as `[x, y, z]`;
  `elbowR/L`, `kneeR/L` and `collarR/L` (the shoulder's lift; automatic when an arm goes up) as numbers; `holdR/L`
  (`upright`, `tilt`); `lift` (feet); `seated`; `lie` (`back`, `front` or `side`: the posed figure laid on the floor);
  `spell` (`right` or `between`). On x a negative angle swings forward; a negative elbow bends the forearm up, a
  positive knee bends the shin back. On the limbs y and z are mirrored, so positive turns outward on either side.
  Ankles add to an automatic flat-foot correction. The figure is set down with its lowest sole on the floor; a seated
  pose puts the hips at the origin.

`heroFigure(recipe, size, state)`: `state` is `'rest'`, `'battle'` or `'dead'` (`true` still means battle). A dead
figure loses its halo, wisp, sparkles, hover and spell. In the app a character is down when its token is marked Down
(Initiative, Party…, the Down button on its card) or its hit points are 0.

The built group names its joints (`getObjectByName`, or `userData.joints`): `hips` (the pelvis: it carries the legs
and the chest), `chest`, `neck`, `head`, `collarR/L`, `shoulderR/L`, `elbowR/L`, `wristR/L`, `handR/L` (what a hand
holds: +y up the grip, +z forward), `hipR/L`, `kneeR/L`, `ankleR/L`, `footR/L`, and empty mounts for gear: `beltR/L`
and `back`. Nothing is built for an empty hand.

A gown (`skirt` with `underskirt`) is fitted: it hugs the hips and thighs, is tight at the knee and flares to a
mermaid hem with a short train, slit up the left leg; above a sweetheart line the shoulders are bare, and puffed
sleeves become an off-the-shoulder band with a ruffle. A cloak on a gown hangs from the elbows as a wrap.

Other parts: `beard` (a colour), `fangs`, `collar` (a tall standing collar, its colour).

## Both rule sets

Nothing in a pack depends on the edition: speed, darkvision, size and light come from the species and are written as
numbers, so a 2014 and a 2024 character load the same way.
