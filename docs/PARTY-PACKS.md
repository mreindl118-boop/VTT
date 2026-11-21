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
(motes drifting around the figure), `rolled` (shirt sleeves rolled to the elbow: bare forearms below a rolled cuff).
Plate armour also gets layered pauldrons (a domed cap and two lames shaped to the upper arm, riding the shoulder joint
so they lift and swing with the arm), a gorget, tassets, knee guards and greaves; mail is a shirt with short sleeves
over the deltoid. A satchel's strap runs over the left shoulder down to the bag on the right hip; an orb is held out on
the palm; a wisp rises from the top of a book carried shut.

Faces are smooth (cranium, jaw, cheekbones, a nose with a tip, eyes with whites, irises and pupils under a lid, brows
and lips; `lips` sets their colour) and hair is a smooth cap with its style on top. More parts: `gauntlets`, `clasps`
(cloak brooches), `bodice` (`{color, lacing}`), `puffSleeves`, `wingRim`, `gownTrim` (with `skirt` and `underskirt`,
the gown hangs open over the underskirt in folds with a pointed hem and embroidered edges), and `glow` (the spell a
battle stance holds).

Plate can be an engraved harness: `armor.knotwork` (a colour, a worn silver say) makes the breastplate one sculpted
plate with a keel and no rims across its front, the pauldrons three lames (a shallow plate over the shoulder and two
on the upper arm, a strap buckled round the arm beneath), adds vambraces with a flared cuff over plated gauntlets,
cuts the tassets in three lames and the greaves as one plate over the boot's cuff, lines every edge finely in the
armour's `trim` and lays a band of knotwork in that colour on each major plate. `armor.corset`
(`{color, belts, lacing}`) cuts the breastplate's lower edge to a point under the bust over a laced leather corset:
the fauld's lames become its leather girdle with two buckled belts round it (`belts` their leather, the buckles in
`buckle`), and a coat skirt of the same leather hangs from under the girdle to above the knee in the culet's place,
round the seat and the sides of the thighs and open at the front from hip to hip, where the tassets hang. `armor.emblem` is a holy symbol borne on the breastplate in the
knotwork's colour (or the trim): `helm`, an open eye on an upright gauntlet. None of the three changes plate that
does not set it. A corset's coat skirt is not yet listed among what a cloak hangs over, so a corseted harness under a
cloak is untried.

`halo` is light, not metal: a few thin broken arcs of its colour round the back of the head with a faint glow about
them and tiny sparkles, open below where the hair falls. `spiritWings` (`{color, rim, opacity}`) are two feathered
wings of the same kind of light rising from the shoulder blades (primaries, secondaries and two rows of coverts, each
feather fading out at its tip, the wing fading to nothing where it meets the back): wider in a battle stance, rising
between the back and a weapon slung on it, and gone on a fallen body. They are made for a `transform` (an aasimar's wings).

### Body, joints and poses

Every figure is sculpted like a miniature (`kit/anatomy.ts`): the torso, pelvis and limbs are lofted through rings, so
a chest is deep in front, a calf full behind and a shoulder line flat. The deltoid is part of the upper arm, so the
shoulder runs from the trapezius into the arm without a ball at the joint. `frame` picks the feminine or masculine frame
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

Faces are painted, storybook style, on a clean head (kit/faces.ts, kit/facepaint.ts): large eyes with lids, lashes
and a catch-light, brows, lips, blush. `face` gives a character its own (sliders from -1 to 1 such as `eyeSize`,
`jaw`, `smile`, `browAngle`, plus `scars`, `lashes`, `shadow`); `detail` 1 to 4 sets how finely it is drawn. The eyes
look somewhere: a pose's `gaze` ([across, up]), or worked out from the pose, so in a fight they stay on the foe ahead
however the head is turned, and at ease they lead the way the head is tilted and turning.

Whatever the pose, a standing figure keeps its soles flat and both feet on the ground (the higher foot comes down,
or the hips sink onto the standing leg; a foot the pose lifts well clear stays in the air) and stands over the middle
of its base. At ease it balances: the pit of the neck over the foot that takes the weight (the straighter leg), the
free foot on its ball with the heel a little raised when the feet are level. Balancing never takes a foot off the
floor, so a fighting pose used out of a fight keeps its stance. The feet turn out: a little at ease, and in a fight
the front foot points at the foe while the back foot turns out. An empty hand is relaxed, the fingers softly curled,
more toward the little finger. A hand with a weapon in it closes into a fist round the haft, the haft across the palm,
its head out above the thumb; in the two-handed guard the weapon fist is low by the hip and the free hand high on the
haft, the arm solved so the haft lies in the curl of its fingers with both forearms clear of the body. A shield rides
on the forearm on a strap with its handle in the fist, and at rest it hangs plumb, its face turned out. A book carried
shut is held by its foot, the fingers curled up over the cover; a pose's `holdL` turns the wrist, so the book stays in
the fist. An open book lies on the palm, the fingers under it and the thumb on the page. A fist set on the hip or a
hand on the belt rests on the surface rather than in it. Wrists and elbows stay inside natural limits: a wrist bends
at most 70 degrees in, 60 back, 20 toward the thumb and 30 toward the little finger, and an elbow folds only as far as
the arm's thickness allows (less on a heavily muscled arm). A fallen figure lets go of everything: weapon, shield and
book lie flat on the floor beside it, clear of the body and the head. A rest pose in a gown keeps the slit
leg behind the slit, so it shows through the opening rather than pushing through the cloth; in a fight the right leg
stays straight under the cloth and the left steps forward through the slit, never out past its edge.

Out of a fight a weapon is put away, never carried drawn: an axe, sword or spear slung across the back, a mace hung
plumb at the belt behind the hip, under the cloak's drape (a staff or torch stays in hand); in initiative it is in hand. `"stow": false` keeps it in hand always.

`body` fits the frame to the character's art with multipliers (1 = the frame's own): `shoulders`, `chest`, `waist`,
`hips`, `bust`, `arms`, `legs` (girth) and `neck`. A brawny fighter might take `{ "shoulders": 1.12, "waist": 1.2,
"arms": 1.3 }`; a slight one `{ "shoulders": 0.95, "waist": 0.9, "arms": 0.88 }`.

A figure takes `pose` out of initiative (default `rest`), `battlePose` in it (default its `stance`) and `deadPose` when
it is down (default `dead`). Each is a name or joint angles:

- Names: `rest` (standing at ease: weight on one leg, hips and shoulders tilted against each other, the chest
  turned off the hips and the head turned and tilted, no arm hanging straight; one of three variants picked by the
  recipe: one forearm forward with the hand before the hip, a fist on the right hip, or the left hand resting on the
  belt; or a gown's own with the knee in the slit), `two-handed` (a high guard across the body: a deep stance, the
  weapon fist low by the right hip, the other high before the left shoulder, the head of the weapon up past that
  shoulder), `shield` (the shield side leading in a lunge, the shield on the forearm across the chest with the eyes
  over its rim, the weapon cocked high behind the head),
  `cast` (a flying cast: pitched toward the foe, the casting palm thrust out, the book open out to the side), `conjure`
  (the casting hand forward at shoulder height round a gathering spell, the book open on the other palm), `ride`
  (seated astride, hands on the reins), `lunge`, `menace` (arms spread, hands clawed), `cower`, `kneel`,
  `staff-raised`, and the dead, comic sprawls that obey gravity: `dead` (a starfish on the back), `dead-prone` (face
  down and flopped, one arm flung past the head), `dead-comic` (the dead bug: on the back, one arm bent up by the head
  like a goal post, one knee fallen out), `dead-swoon` (legs straight, an arm curled over the crown), `dead-curled` (on
  its side, half curled). The dead have crossed-out eyes.
- Angles (radians): `spine`, `neck`, `pelvis`, `shoulderR/L`, `wristR/L`, `hipR/L`, `ankleR/L` as `[x, y, z]`;
  `elbowR/L`, `kneeR/L` and `collarR/L` (the shoulder's lift; automatic when an arm goes up) as numbers; `holdR/L`
  (`upright`, `tilt`); `lift` (feet); `seated`; `lie` (`back`, `front` or `side`: the posed figure laid on the floor);
  `spell` (`right` or `between`); `fist` (`["R"]`, `["L"]` or both: those hands clenched into closed fists, say on a hip;
  only `R` and `L` count); `hipHand` (`["R"]` or `["L"]`: the hand set on the hip, the arm solved to reach the side of
  the waist above the belt, elbow out; a fist there with `fist`); `beltHand` (the open hand laid flat on the front of
  the belt toward its own side, fingers down; a hand that holds something keeps it instead); `book`
  (`open` to read at rest, `shut` to keep it closed in a fight; otherwise a book is carried shut out of a fight and
  opened in one); `gaze`. On x a negative angle swings forward; a negative elbow bends the forearm up, a
  positive knee bends the shin back. On the limbs y and z are mirrored, so positive turns outward on either side. On
  the spine and neck x > 0 leans forward (a dipped chin); on the spine, pelvis and neck, y > 0 turns toward the figure's right and z > 0 raises its right side (a hip or a
  shoulder); a `gaze` across > 0 looks to its right. (A recipe's `face.gaze` overrides the pose's and keeps the face's
  own convention, across > 0 to the figure's left.)
  Ankles add to an automatic flat-foot correction. The figure is set down with its lowest sole on the floor; a seated
  pose puts the hips at the origin.

`heroFigure(recipe, size, state)`: `state` is `'rest'`, `'battle'` or `'dead'` (`true` still means battle). A dead
figure loses its halo, wisp, sparkles, hover and spell, and is laid down as a body falls: it settles onto the floor
by its own lowest surface, and each limb drops until it rests on the floor or on the body. In the app a character is down when its token is marked Down
(Initiative, Party…, the Down button on its card) or its hit points are 0.

`transform` is the look while the character's transformation is on (an aasimar's spectral wings, say): an object of
figure fields, laid over the recipe (`{"halo": "#f0c860", "transform": {"wings": {"color": "#ffffff", "count": 2}}}`
gains the wings; a field in both takes the transformed value, whole). In the app the switch is on the character's
card (Initiative, Party…): Transform, beside Down, for a standing character whose miniature has a `transform`;
Change back turns it off. It is the token's (`transformed`), is saved with the campaign, and the players' display
shows it. `heroLook(recipe, transformed)` (kit/heroes.ts) gives the look a token's miniature is built from.

R and L are always the figure's own right and left: it faces +z, so its right side is at -x (`SIDE_X` in
kit/heroes.ts). A weapon goes in the right hand, a shield or book in the left.

The built group names its joints (`getObjectByName`, or `userData.joints`): `hips` (the pelvis: it carries the legs
and the chest), `chest`, `neck`, `head`, `collarR/L`, `shoulderR/L`, `elbowR/L`, `wristR/L`, `handR/L` (what a hand
holds: +y up the grip, +z forward), `hipR/L`, `kneeR/L`, `ankleR/L`, `footR/L`, and empty mounts for gear: `beltR/L`
and `back`. Nothing is built for an empty hand.

A gown (`skirt` with `underskirt`) is fitted: it hugs the hips and thighs, is tight at the knee and flares to a
mermaid hem with a short train, slit up the left leg; above a sweetheart line the shoulders are bare, and puffed
sleeves become an off-the-shoulder band with a ruffle. A cloak on a gown hangs from the elbows as a wrap.
`hem: false` leaves out the tunic hem below the belt and the belt's tail, for a garment made over the figure that
takes their place.

Garments are hung after the pose (kit/cloth.ts): a skirt or gown, the tunic hem, coat tails, mail, a cloak or capelet
and plate lames re-hang over the posed limbs, swing out over a raised leg or arm, drape over stowed gear, and fall
along the body to the floor when it lies down. Elbows and knees bend as one continuous surface, with no joint balls.
Nothing passes through anything else: no limb, hand or piece of gear through the body, another limb or a garment.
kit/clipcheck.ts and kit/clothcheck.ts measure it, and the tests hold every stance, rest variant and dead pose to it on
several body types.

Other parts: `beard` (a colour), `fangs`, `collar` (a tall standing collar, its colour).

## Both rule sets

Nothing in a pack depends on the edition: speed, darkvision, size and light come from the species and are written as
numbers, so a 2014 and a 2024 character load the same way.
