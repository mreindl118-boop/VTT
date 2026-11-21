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
With `rolled`, `rolledLow: true` brings the sleeve down over the elbow and seats one soft roll on the forearm just
below the bend, so the roll follows a bent arm.
Plate armour also gets layered pauldrons (a domed cap and two lames shaped to the upper arm, riding the shoulder joint
so they lift and swing with the arm), a gorget, tassets, knee guards and greaves; mail is a shirt with short sleeves
over the deltoid. A satchel's strap runs over the left shoulder down to the bag on the right hip; an orb is held out on
the palm; a wisp rises from the top of a book carried shut.

Tailoring: `coatCut` (`frock`: with `coat`, a tailored frock coat in place of the plain tails and lapels: fronts made on
the chest and fastened by one button at the waist, skirts hung from the waist to mid-thigh with flap pockets and a back
vent, peaked lapels and a collar in the coat's `lapel` colour, turned-back cuffs with buttons), `coatEmbroidery` (a
thread colour: a border and a vine on each lapel of a frock coat, a line round each cuff), `lapelPin` (a crescent-moon
pin on a frock coat's left lapel), `waistcoat` (`{color, buttons, chain, fob}`: buttoned to two points below the waist;
`chain` a watch chain in two swags, `fob` a crystal hanging from it), `shirtCollar` (`stand`: with `shirt`, a shirt
front fitted on the chest and a high stand collar open at the throat, in place of the plain collar and placket),
`trousers` (a colour: wide-leg trousers with a pressed crease, their hems over the boots). These lie on the chest of any
frame, over a bust or a chest's muscle, and move with the bust. Wings are an insect's: narrow at the root, drawn to a
point, with a net of veins and a glowing rim (`wingRim`); `wingSheen` (a list of colours) shifts the membrane through
those colours across each wing.

`wispShape` (`skull`) makes the wisp a small spectral skull, see-through and glowing in the wisp's colour: a round
cranium, two slanted eye sockets, a nose notch and a narrower jaw with tooth nicks, on a curl of smoke rising from the
open book (or from the top of one carried shut); without it the wisp is a plain round ghost.
A frock coat's collar is turned down over the shoulders, its skirts flare in soft folds to a waving hem with rounded
front corners, and its fronts stay proud of a stand-collared shirt worn under them.
A pose that holds the book open out of a fight (`book: 'open'`) takes the free hand under the book's cover, palm up,
where the pose would otherwise put that hand into the book; out of reach of the cover, the arm is only moved clear.
Sparkles hang clear of the posed body: one that would sit in a limb drifts further out.
On a fallen body, wings that lie flat lie on the floor itself, under an arm flung out over them.

Faces are smooth (cranium, jaw, cheekbones, a nose with a tip, eyes with whites, irises and pupils under a lid, brows
and lips; `lips` sets their colour) and hair is a smooth cap with its style on top. More parts: `gauntlets`, `clasps`
(cloak brooches), `bodice` (`{color, lacing}`), `puffSleeves`, `wingRim`, `gownTrim` (with `skirt` and `underskirt`,
the gown hangs open over the underskirt in folds with a pointed hem and embroidered edges), and `glow` (the spell a
battle stance holds).

Plate can be an engraved harness: `armor.knotwork` (a colour, a worn silver say) makes the breastplate one sculpted
plate with a keel and no rims across its front, the pauldrons three lames (a shallow plate over the shoulder and two
on the upper arm over an arming sleeve, a strap buckled round the arm beneath), adds vambraces from the wrist to the
elbow with a flared cuff over the gauntlets (a thin plate on the back of each hand), cuts the tassets in three lames
and the greaves as one plate over the boot's cuff, lays sabatons of two lames over each boot's instep (give the
recipe dark `boots` to go with them), lines every edge finely in the armour's `trim` and lays a band of knotwork in
that colour on each major plate. `armor.corset`
(`{color, belts, lacing}`) cuts the breastplate's lower edge to a point under the bust over a laced leather corset:
in the fauld's place it wears a leather girdle of three lapped lames, each with a fine rolled rim, with two buckled
belts round it (`belts` their leather, the buckles in `buckle`), and a coat skirt of the same leather hangs from
inside the girdle's last lame to above the knee in the culet's place, round the seat and the sides of the thighs,
open at the front from hip to hip, where the tassets hang, and vented up the back. `armor.emblem` is a holy symbol
borne on the breastplate in the knotwork's colour (or the trim): `helm`, an open eye on an upright gauntlet, a thin
flat relief. None of the three changes plate that
does not set it. A corset's coat skirt is not yet listed among what a cloak hangs over, so a corseted harness under a
cloak is untried.

`halo` is light, not metal: one ring of thin, broken arcs of its colour standing wide of the head behind it, each a
thread of faint light fading out at its ends, with three small soft sparks where arcs end; it is open below where the
hair falls, tipped back a little, and set on the head, so it turns as the head turns. A darker colour gives a fainter,
more golden halo. `spiritWings` (`{color, rim, opacity}`) are two great feathered wings of the same kind of light
behind the shoulder blades (broad round-tipped primaries and secondaries, two rows of coverts and a faint glow under
them, each feather fading from its middle, the wing fading to nothing toward the back): alike on both sides, each a
cupped sheet that curves back toward its tip, wider and swept further back in a battle stance, rising between the back
and a weapon slung on it, and gone on a fallen body. Light laid over light grows brighter but never burns out to white.
They are made for a `transform` (an aasimar's wings).

Finer outfit pieces, each built only when its field is set: `chainShirt` (`{under}`, with mail armour: the mail is cut
as a chain shirt, fitted, hanging straight to the hips with an uneven hem, short sleeves and a V at the neck that shows
the shirt in `under`; its links are rows of fine zigzag in the armour's `trim`). `belt` (`{color, buckle}`: a wide belt
worn round the waist over the cloth, a square buckle in front; it takes the place of the plain `buckle`).
`satchelKit` (with `satchel`: `{hip, mark, markColor, rolls, vials, herbs, sprig}`): the bag becomes a flapped
satchel on `hip` (`'R'` or `'L'`), hung from a baldric that runs from the other shoulder across the chest to a ring
over the bag and on round the hip, with a buckle at the chest; `mark` embroiders the flap (`'leaf'` or `'moon'`, in
`markColor`), `rolls` (up to three bandage rolls), `vials` (up to three colours) and `herbs` stand out of its top, and
`sprig` ties a bundle of flowering herbs to the ring. With `strap: 'belt'` in the `satchelKit` there is no baldric:
the bag hangs from the waist belt (or a corset's lowest strap) by two short straps on small rings. The satchel's and
the baldric's metal is the belt's `buckle`, else the corset's, else the plain `buckle`, else silver. On a fallen body
the bag lies face up on the hip or the thigh. Under a cloak's capelet the baldric crosses the shoulder outside the
capelet's collar, wholly under it. The belt, the baldric and the bag are put on once the body is
posed, outside whatever cloth is worn under them (mail, a tunic, a skirt, a gown) in every state; a cloak hangs over
the bag on a standing figure, and an empty-handed arm resting where a strap runs is moved off it. `cloakLaurel` (a
colour: laurel embroidery down the cloak's front edges, along its hem and round the capelet's edge, in place of
`cloakTrim`'s bands). `claspMark` (`'tree'`: the `clasps` become round brooches with a tree in relief, one pinned on the front of each
shoulder and lying on the cloth). `shieldFace`
(`{band, rivets, wreath}`: a flat wide rim with `rivets` domed rivets, sixteen unless given, a vertical band of
`band` down the face, and with `wreath` the shield's `mark` drawn as a laurel wreath round two linked rings).
`pendantShape` (`'rings'`: the pendant is two linked rings on a finer chain).

A gown's finer dress: `wreath` (`{color, flower, leaf}`) is a low wreath of woven thorny twigs with small leaves and big
five-petal flowers, most of them on the figure's left, worn in place of a `crown`'s tall twigs. `corset`
(`{color, lacing, buckle, vials}`) is a leather corset over the gown's waist, from the top of the skirt to under the
bust: boned, laced up the front, with two buckled straps; the skirt then hangs from a buckled belt at the corset's foot
(following the lean and turn of the waist in every pose), and its `vials` (up to four colours) hang on thongs from that
belt at the left hip, lying on the cloth. `fullSleeves` (with `puffSleeves` and `sleeves`) makes the blouse's sleeves
full from below the bare shoulders to just above the elbow, gathered there with a frill. `vines` (a colour) embroiders
a winding vine with leaves and tendrils along the gown's hem and up the edges of its slit, in place of `gownTrim`'s
plain lines there, and down the front edges and above the hem of the cloak worn with the gown. `dagged` cuts the gown's
hem in uneven tatters (tongues of differing width and length, rounded at the tip) and nicks the edges of its slit, with
the underskirt's lace showing between them and along the slit, lying on the floor where it reaches it.
`brooch` (a colour) pins each top corner of the gown's cloak with a round brooch, seated on the cloth where it shows
beside the arm. `shoulderCloak` wears that cloak on both shoulders instead of from behind the arms: it hangs from the
shoulders under a short mantle that stands wide open at the front, its corners brought forward over the shoulder caps
to the collarbones, where the brooches then sit facing forward with a fine cord between them; it lies where long loose
hair falls, so it suits hair worn short, up or in a braid. `bootLaces` (a colour) makes the boots
tall, to just below the knee, and laced up the front, in place of the turned cuff and strap; `bracerLaces` (a colour)
laces the `bracers` up the inside of the forearm.

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
