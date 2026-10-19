# Ease-of-use audit, 2026-10-18 (version 0.3.1)

**What was audited.** mistLAB 0.3.1 on the main branch at `90cfa32`, served from a build of main. Desktop 1366x768 with mouse and keyboard; phone 390x844 with touch. As the DM and as the Players. Both campaigns at their entry scenes (Death House, the Village of Barovia, the Sheep Chase tavern and Town Square), plus the nested-world journey (valley, Vallaki, the Blue Water Inn, a room, and back).

**How.** A first-time user's walkthrough of every feature in the inventory (one pass per role and screen size), a heuristic review of the interface and its code, then a second pass that re-ran every blocker and major finding once and re-graded or refuted what did not hold.

**Limits.** Software rendering on a shared machine, so load and flight times were noted but not scored. An emulated phone, not a real iPad or Android. One pass by one reviewer, not a usability study with real DMs. Findings only: nothing here is built or decided.

Pending items are named by their number in `docs/QUEUE.md`. A finding a pending item already covers is still listed, with the item.

## 1. What a new DM meets

Ease is 1 (lost) to 5 (obvious), desktop / phone. "Found" means found from the screen alone, without Help.

| Feature | Works | Found without help | Ease desktop / phone | Note |
|---|---|---|---|---|
| Help sheet with the version | yes | yes (opens by itself on first run) | 4 / 4 | Long: ten dense entries, keyboard wording on the phone; says "amber token" for a red `&` (findings 19, 21). |
| What's new card | yes | yes (opens by itself after an update) | 4 / 5 | Shows the whole changelog entry, technical limits included (finding 20). |
| Library | yes | yes | 4 / 4 | Death House, the start scene, is the last row (finding 42). Campaign switch changes theme and world map. |
| DM / Players switch | partial | yes | 4 / 4 | Instant, no toast. Players: Library, World map, Floor picker, Whole building, Section and the DM tab stay live on the table (finding 3). |
| DM/Players slider with peek | yes | yes | 3 / 3 | Nothing says what 0.37 means; on the phone its top hides under the floor row (findings 4, 38). |
| Player Display window | yes | with Help / not found | 3 / 2 | Last item of the View menu; on the phone that menu is off-screen (finding 1). No message when a pop-up blocker stops it (finding 24). |
| Move the party (tap, then tap) | yes | yes | 4 / 4 | Clear prompt and cancel. Players: the refusal "No way through..." is clear. Phone: the two-line toast covers the camera buttons (finding 9). |
| Snap to grid | yes | yes / not found | 4 / 1 | Phone: inside the off-screen View panel (finding 1). No toast (finding 25). |
| Fog of war and reveal tools | yes / partial | yes / not found | 3 / 1 | Phone: the Tools panel opens off the left edge, so no tool can be chosen (finding 1). Rooms-sheet eye and room menu still reveal. No touch way to leave a tool (finding 22). |
| Tap menus, cards and tips | partial | yes | 4 / 4 | Rooms, doors, stairs and the party answer. Wall objects (lamp, portrait, shield, fireplace) never give their card (finding 13). Players: door tap gives nothing (finding 12). |
| Doors | yes / partial | yes | 4 / 4 | DM: tap marker, "Open door". Players: the tip tells them to tap, the tap does nothing (finding 12). Markers 26 px (finding 28). |
| Stairs | partial | yes | 3 / 3 | The Death House spiral stair carries the party from Floor 1 to Floor 3 in one step (finding 2). Phone: the pill shows no destination (finding 29). |
| Floor picker, Whole building, Section | yes / partial | yes | 4 / 2 | Phone: the row runs off the right edge under the slider; Follow the floor is unreachable (finding 4). No toast on any change (finding 25). |
| Compass and scale bar | yes | yes | 5 / 4 | Keeps place and zoom, as 0.3.1 promised. Phone world map: the rose sits on the scale frame (finding 43). |
| Camera buttons and gestures | yes | yes | 4 / 4 | Tilt, zoom, find, follow, double-tap to frame all work. Hidden gestures are not taught (finding 19). |
| Zoom-out chip | partial | yes | 3 / 2 | Offers "the whole valley" when the valley already fills the screen; never offers the town from a building; none on the Sheep Chase maps (finding 15). |
| World map (continuous world) | yes | yes | 4 / 3 | Flight, pace, Places, drag-the-party travel card all work. Discs overlap near Vallaki, badly on the phone (finding 16). Title still names the last map (finding 39). Players: only revealed places. |
| Flat world map sheet | yes / partial | with Help / not found | 4 / 1 | Only reachable through the View menu. Phone: Close and Zoom out are off-screen (finding 11). |
| Nested journey (valley to room and back) | yes / partial | yes | 4 / 2 | Desktop: works end to end with sensible crumbs. Phone: Vallaki opens from 17,000 ft with nothing tappable (finding 7); the inn hands over at 12 ft on floorboards (finding 8). |
| Enter a building, Back | yes | yes | 5 / 3 | Tip says "Enter Blue Water Inn"; Back lands framed on the building. Sheep Chase square: no building enters (finding 17). Back shares its glyph with Rotate left (finding 18). |
| Go to area (finder) | yes | yes | 4 / 4 | Fast and clear. A stray "0 ft" status after a jump. |
| Rooms sheet | yes | yes | 4 / 4 | Phone: sits under the stacked bar (finding 37). Eye gives no toast. |
| View menu | yes / partial | yes / with Help | 3 / 1 | Icon-only summary that changes with the grid mode (finding 18). Phone: only Grid and Opacity are on-screen (finding 1). |
| Measure | yes / partial | yes / not found | 4 / 1 | Clear three-step status with a rules chip. A tap on the party's cell picks the party up instead (finding 26). Phone: in the off-screen Tools panel. |
| Creatures | partial | yes | 3 / 3 | Place by tap confirms; Place here says nothing and leaves the sheet open (finding 14). Phone: the close X hangs off the edge (finding 10). |
| Token panel | yes | yes | 4 / 4 | Full and clear. Hit points move by one per tap (finding 31); Remove has no confirm or undo (finding 30). |
| Initiative sheet and turn bar | yes / partial | yes | 4 / 2 | Desktop works; End uses a native confirm. Phone: ticks and Initiative inputs off-screen, Roll looks dead (finding 5); the turn bar covers the clock and compass (finding 6). |
| Rules links, cards, tips | yes | yes | 4 / 4 | Among the best parts: styled cards, five underline styles, bottom sheets on the phone. |
| Books | yes | yes | 4 / 4 | The best-behaved phone screen in the app. Uses a native alert on error (finding 49). |
| Clock, calendar, travel | yes | yes | 3 / 4 | Travel maths and the moon line are good. The hour buttons wrap across two rows (finding 41). Travel: advance has no undo (finding 30). |
| Minimap | yes / partial | yes | 4 / 3 | Nothing says it is tappable. Phone: the clock covers most of it (finding 35). |
| Saving and loading | yes | not found (nothing to find) | 3 / 5 | Everything comes back after a reload. No saved cue, no export (finding 51; item 5). |
| Offline (PWA) | not reached | with Help | 3 / 3 | The walks ran with the service worker off to spare the machine. Only "Save for offline" in Books was seen. Item 22. |
| Status toasts | yes | yes | 4 / 3 | Good wording. Fade in 2.2 s; refusals in 2.6 s (finding 23). Loading notes for neighbours appear unprompted (finding 40). |
| Keyboard shortcuts | yes | with Help | 4 / 2 | Nine keys exist, Help lists three; chips show only after a key press (finding 21). Phone text says "press Esc" (finding 22). |
| URL parameters | yes | not found | 3 / 3 | For tests and links; behaved as documented. |
| Phone layout | partial | yes | - / 2 | Bar stacks well, cards dock well; the menus, floor row, roster, turn bar and sheet headers break at 390 px (findings 1, 4, 5, 6, 10, 11). |
| Dollhouse view | not on main | - | - | Pending item 3. |
| Backups | not on main | - | - | Pending item 5. |
| Movable panels | not on main | - | - | Pending item 4. On the phone the fixed panels collide. |

## 2. Findings, worst first

Numbered through all four groups. Each ends with the smallest fix as a proposal, and the queue item that already covers it or "Queue: none". Refuted findings are left out (see the verify notes for what was dropped and why).

### Blocker

1. **On the phone both DM menus open off the left edge of the screen.**
   What a new DM sees: tapping the Tools (sun) icon shows a blank sliver; tapping the View (grid) icon shows Grid Square/Hex/Off and Opacity, and the tails of seven other labels. Reveal / hide, Paint reveal, Paint fog, Measure and Undo reveal cannot be seen or tapped; Snap, Walls, Mist, Continuous world, Labels, Players follow my camera and Player display sit at x -64..-30.
   Where: phone, DM row of the top bar, `details[data-menu=tools]` and `details[data-menu=view]`; `app/src/styles.css:527` (`.menu-panel { position:absolute; right:0 }`). Measured: Tools panel spans x -150..70, items at x -143..-109; View panel x -71..184, items at x -64..-30.
   Why it matters: on a phone the DM has no fog tools, no measure, no walls or mist toggle and no Player Display at all. Half the DM's kit is gone on the device the Players mode is written for.
   Smallest fix: under 820 px anchor the panel to the left (`left:0; right:auto`) or make it `position:fixed; left:10px; right:10px`.
   Queue: item 15 (chrome clarity); the phone pass of item 2's second release (step 7).

### Major

2. **The Death House spiral stair carries the party two floors in one step.**
   What a new DM sees: the party walks onto the stair end on Floor 1 and the status reads "Took the stairs → Floor 3"; the Floor picker says "Floor 3 · party here". From Floor 2 the same cell goes down to Floor 1.
   Where: `locations/appB/death-house/scene.json`, links `lk-spiral-1-2` and `lk-spiral-2-3`, both on cell (25.5, 27.5); the arrival link check in `app/src/app.ts` (takeLink). Re-run on desktop, confirmed.
   Why it matters: the DM loses track of where the party is on the first map the app opens, and the second floor is skipped.
   Smallest fix: after a link fires, fire no other link from the arrival cell until the party has left it (one hop per step).
   Queue: item 11 (single-hop stairs) and item 2e (stairs and level transitions).

3. **Players view leaves the map, floor and mode controls live for the table.**
   What a new DM sees: with the screen turned to the players, anyone can open the Library (39 rows, both campaigns), change floor ("Death House › Floor 2"), press Whole building (the cut lifts to 55 ft), drag the Section slider, open the World map, press Back, or tap the DM tab, which is one tap away.
   Where: `app/src/main.ts:141-149` (the left and centre groups carry no `dm-only`), `styles.css:218` (only `.dm-only` and `.vslider` hide); `openLibrary` and `goUp` check nothing (`main.ts:447, 250`). Re-run on desktop, confirmed.
   Why it matters: the Players view is the app's promise that the table sees only what the DM allows. A curious player breaks it in one tap.
   Smallest fix: give Library, World map, Back, Floor, Whole building and Section the `dm-only` class (or a players-safe guard in their handlers) and make the DM tab need a hold.
   Queue: item 22 (table safety).

4. **On the phone the floor row runs off the right edge under the DM/Players slider.**
   What a new DM sees: the Floor select reads "Floor 1 · party…", the Section slider runs under the vertical slider, and "Follow the floor" is off-screen. The slider's own DM label and top thumb sit under the row.
   Where: `styles.css:168` (`.vslider top:50%`), `:304` (`.group.center overflow-x:auto`, scrollbar hidden), `:319` (the three-row bar under 760 px). Measured: `label.section` x 240..506, Follow x 470..498, slider overlap 58x50 px.
   Why it matters: on multi-level maps the phone DM cannot snap the cut back, and two controls fight for the same pixels.
   Smallest fix: under 760 px let the centre row wrap (Section on its own line) and start the DM/Players slider at the bar's bottom edge.
   Queue: item 15; the phone pass of item 2's second release.

5. **On the phone the roster's ticks and Initiative inputs are off-screen, so Roll initiative looks dead.**
   What a new DM sees: Name, Kind, Speed, Reach, and nothing to tick; Roll initiative changes nothing visible. The table is 795 px wide in a 366-px body with no scroll hint.
   Where: `app/src/ui/encounter.ts:34` (ten columns), `styles.css:386-389` (inputs min-width 52 px, name column 120 px). Measured: tick at x 664, Initiative at x 682.
   Why it matters: a fight cannot be started from a phone without discovering a hidden sideways scroll.
   Smallest fix: under 640 px put the "in" tick and the Initiative input in the Name cell, or stack each combatant as a card.
   Queue: item 13 (initiative strip and encounter builder).

6. **During an encounter the turn bar covers the clock, minimap and compass on the phone.**
   What a new DM sees: Previous sits on the clock, End on the scale bar; the compass is half hidden. On desktop the zoom chip centres over the bar's top edge.
   Where: `styles.css:395` (`.turnbar bottom +14px`), `:497` (`.mapframe`), `:508` (`.zoomchip`), `:533` (`.minimap`). Measured overlaps 2,226 px² over the clock, 4,320 over the minimap, 5,252 over the compass frame.
   Why it matters: in combat the DM loses the clock and the compass, and may hit End when aiming at the scale bar.
   Smallest fix: on narrow screens set the turn bar's and the chip's bottom to the top of the minimap or map frame plus 8 px, as `placeStatus` already lifts the status toast (`main.ts:239-242`).
   Queue: item 13; item 12 names the table screen.

7. **Vallaki opens from 17,000 ft on the phone with nothing tappable.**
   What a new DM sees: after Library › Chapter 5 › Town of Vallaki the only readable thing is the "N · Town of Vallaki" pin; the party and the buildings are specks; a tap on the inn gives no menu and no card. Nine pinches before a building answers.
   Where: `app/src/app.ts` frameLevel (about line 1119) and the arrival framing of `open()` and the disc tap. Re-run on the phone: distance 16,964 ft.
   Why it matters: the town looks empty and broken on arrival.
   Smallest fix: when a town opens from the Library or a disc on a portrait screen, frame the party (or the keyed centre) at a readable distance instead of the whole map extent.
   Queue: item 2 (second release, step 7 phones).

8. **Pinching into the Blue Water Inn hands over only at 12 ft, on floorboards.**
   What a new DM sees: "Loading Blue Water Inn…" from 1,175 ft, then six more pinches; the inn becomes the active map at 12 ft with none of its eight rooms in view. Back then works.
   Where: `app/src/app.ts`, the nest hand-over distance (the active-map switch in the continuous world). Trace: 7065 → 2944 → 1175 → 446 → 162 → 56 → 18 → 12 ft.
   Why it matters: the signature zoom from the valley to a room ends in a blank floor on the phone.
   Smallest fix: hand the building over when its footprint fills about 60% of the view and land the camera framed on its ground floor.
   Queue: item 2 (second release, step 7 phones).

### Minor

9. **Toasts cover five camera buttons on the phone.** The two-line pick-up prompt and refusals sit on Tilt, Zoom in, Zoom out, Find the party and Follow for as long as the party is held. Taps pass through (`pointer-events:none`, `styles.css:182`), so it hides, it does not block. Where: `styles.css:182`, `main.ts:239-242`. Fix: on narrow screens set the status bottom to the camera row's top plus 8 px. Queue: item 15.
10. **The Creatures sheet's close X hangs off the edge on the phone.** The search box pushes the X to x 362..396 while the sheet ends at 378; a ">" sliver shows. An outside tap still closes it. Where: `app/src/ui/bestiary.ts` header; sheet header CSS. Fix: header search `flex:1; min-width:0`. Queue: item 15.
11. **The flat world sheet's Close and Zoom out are off-screen on the phone.** Hex at x 303, Zoom in 345, Zoom out 387, Close 429 on 390 px; the title wraps one word per line. The backdrop strip above still closes it, and a pin tap opens the town as designed. Where: `app/src/ui/worldmap.ts:220-224`. Fix: let the header wrap under 600 px. Queue: item 15.
12. **The players' door tip tells them to tap, and the tap does nothing.** Tip: "Door · Closed · tap the door icon to open" (`app.ts:2124`); the players' tap branch (`app.ts:2181-2190`) handles objects and revealed rooms only. On the phone there is no hover, so a door tap gives nothing at all. Fix: players' tip states the fact only ("Door · Closed", "Locked door · the DM holds the key"), and a door tap flashes "The DM opens doors". Queue: item 11 (players-mode navigation, door logic).
13. **Wall objects never give their card.** Lamps, portraits, shields and fireplaces answer with the wall's tip or the room's menu at every height tried; the first mesh the ray meets wins (`app.ts:2180-2196`, `hitObjectId`). Not settled by code alone. Fix: list the room's visible objects in the room's tap menu. Queue: none (nearest: 12, 15).
14. **"Place here" says nothing.** A hidden token appears beside the party, the sheet stays open, the status is empty (`bestiary.ts:56` never calls setStatus); "Place by tap" by contrast closes and counts. Fix: `setStatus("Wolf placed beside the party · hidden from players")`. Queue: none (nearest: 12).
15. **The zoom-out chip names the wrong step.** At the far limit it reads "Zoom out to the whole valley" when the valley already fills the screen (`main.ts:281-283`); from a building in the continuous world it never offers the town (`main.ts:281`, `up = app.staged ? undefined : app.parentPath`); on the Sheep Chase tavern no chip appeared (unverified). Fix: name the world map once the valley is the view; keep the town chip when a building is active. Queue: item 2 (second release).
16. **Place discs overlap on the world map.** N (Vallaki) and P (Luna River Crossroads) sit about 40 px apart on desktop and the party marker covers N; a drag onto Vallaki produced the P card. Phone: 35 overlapping label pairs. Where: `app/src/ui/worldnest.ts`; the declutter rule `app.ts:1578-1580`. Fix: declutter overlapping discs at the current zoom and drop the party on the nearest disc centre. Queue: item 2 (second release).
17. **No building on the Sheep Chase square enters anything.** `locations/wsc/02-street/scene.json` has no `enter` entries (Vallaki has 13); the tavern's card offers only Close and Frame S5 although `wsc/01-tavern` exists. Fix: add `enter: "wsc/01-tavern"` to the tavern's room in the street generator and regenerate. Queue: item 6 (Sheep Chase).
18. **Six unlabelled icons, and one glyph for several actions.** The curved arrow is Back (`main.ts:144`), Rotate left (177) and Previous turn (`encounter.ts:103`); the zoom-out magnifier is Whole building (149), Zoom out (181) and the chip (285); the walls icon is Follow the floor (149), Walls (166) and Open/Close door (530); the grid icon is View (160), Snap (165) and Reach (610); the View summary icon changes with the grid mode (412). Tips only on hover or a 500 ms hold that also presses the button. Fix: own glyphs for Back, Whole building, Follow the floor and Previous turn; a fixed View icon. Queue: item 15.
19. **Help is a wall of text and describes the screen wrongly.** One 2,029-px sheet of ten entries in a 655-px window (`main.ts:657-669`); the three starting actions are not set apart; keyboard wording ("press Esc", "scroll", "hover") on the phone. It says "the amber token" (the party is a red `&`, `app.ts:36`), names a Section slider "beside the floor tabs" and an arrow button that are now a dropdown and a walls icon, and never mentions Whole building, the compass tap, Measure, the clock, the minimap, the Library, Snap, Walls, Mist, Labels, Undo, the eyes, Back, or the hidden gestures (double-tap to frame, twist to rotate, drag the `&`, tap the minimap). Where: `main.ts:643-669`. Fix: a three-step first-run card (move, door, Players) with a Full guide link, touch wording under `(pointer: coarse)`, and the entries rewritten against the current bar with one line per missing control. Queue: item 15 (CLARITY.md).
20. **The What's new card shows the whole changelog entry, technical limits included.** The served 0.3.1 entry carried substitute geometry, excavation edges, a 4,598-ft figure and certification notes; the 0.3.2 entry now on main is written for the table but its Known limits paragraph still has triangle counts and "the data pass". Where: `app/src/ui/whatsnew.ts:47-53`, `docs/CHANGELOG.md`. Fix: leave the Known limits paragraph out of the card, or write it for the table. Queue: none.
21. **Nine shortcuts exist, Help lists three, and key chips appear only after a key press.** `keys.ts:4-14` (/ r R f n [ ] \ Esc); Help names /, N and Esc; chips need a prior key (`keys.ts:23-27`, `tooltip.ts:127`). Fix: a Keys entry built from KEYMAP, chips whenever the device can hover. Queue: item 15.
22. **No on-screen way to leave a tool or stop placing on touch.** The status says "Esc to stop"; a phone has no Esc; `stopPlacing` runs only from Esc and a view switch (`main.ts:640`, `app.ts:1590, 1734`); a tool clears only by Esc or reopening the menu and tapping it again (`main.ts:445`), unsaid; the status cannot be tapped except the measure chip (`styles.css:182, 185`). While placing, a tap on the party placed a third creature. Fix: a tappable Done chip in the status while a tool or placing is active. Queue: item 15 (nearest).
23. **Refusals vanish in 2.6 s and are not announced.** `.status` has no aria-live (`main.ts:235-245`); toasts hide after 2.2 s (`main.ts:245`), refusals after 2.6 s (`app.ts:2227`); the tips layer already has a live region (`tooltip.ts:92-94`). Fix: keep a refusal until the next pointerdown and mirror it into `.sr-live`. Queue: item 15.
24. **A blocked Player Display window says nothing.** `window.open` at `main.ts:465` is unchecked; with a pop-up blocker or on iPad Safari nothing happens. The control is the last View menu item (`main.ts:171`); README calls it "the monitor button". Fix: `if (!window.open(...)) setStatus("The Player Display was blocked: allow pop-ups for this site")`. Queue: item 2 (second release, step 5).
25. **Silent toggles.** Walls low/full, Labels, Snap, Mist, Continuous world, the Floor change, Whole building, Follow the floor and the Rooms eye give no toast (`main.ts:447-463`); the only sign is a pressed button, off-screen on the phone for the View items. Fix: `setStatus("Walls: low")` and the like in each handler. Queue: item 15.
26. **With Measure active, a tap on the party picks it up.** The token pick-up (`app.ts:2160-2169`) runs before the measure check (`app.ts:2193`). Fix: move the measure check above the pick-up. Queue: none (nearest: 12).
27. **On the Sheep Chase tavern a door marker sits on the party badge at the opening zoom.** The first tap hits the marker (`styles.css:267`) and nothing happens; 6 px higher picks the party. A layout coincidence, seen once on the phone. Fix: party badge above door markers in stacking order. Queue: none (nearest: 15).
28. **Door and stair markers are below the app's own 44-px hit size.** `.lbl.door` 26x26 (`styles.css:268`), stair pills about 20 px (274); `--hit` is 44 (16); the only coarse-pointer rule is for the breadcrumb (154). Both walks hit them; they slow rather than stop. Fix: a 44-px transparent `::before` hit area. Queue: item 15.
29. **Stair pills show no destination on touch.** The floor name is hover-only (`styles.css:275-276`) and in the title attribute (`app.ts:424`). Fix: show the span always under `@media (hover: none)`. Queue: item 15.
30. **Remove and Travel: advance act at once with no undo.** Token Remove (`main.ts:626`), roster Remove (`encounter.ts:64`) and Travel: advance (`main.ts:343`) have no confirm and no undo; Undo covers reveals only (`main.ts:157`). Fix: widen `app.undo` to the last removal and the last travel advance. Queue: item 12 (undo).
31. **Hit points change by one per tap.** `main.ts:624 adjustHp(id, ±1)`; fifteen damage is fifteen taps. Fix: an editable number field, step 5 on a long press. Queue: item 12.
32. **Four panels share the bottom-left corner.** Minimap with the clock on it (`styles.css:533-534`), token panel (458), clock popover (485) and the nested place card (738). Picking up a creature covers the minimap and clock. Fix: stack the token panel and place card above the minimap until item 4. Queue: item 4 (movable panels).
33. **Most chrome is under the 44-px hit size.** `button.icon` 40 (`styles.css:137`); top-right icons 34 under 820 px (317); section snap 28 (422); DM/Players tabs about 30 (163); card actions about 31 (299); turn-bar buttons about 30 (402); flat sheet Places eye 26 (434) against 40 on the nested map (737); menu rows 32-36; roster inputs 28; clock popover buttons 26; Creatures row buttons 22. Fix: one pass raising every control to `var(--hit)`. Queue: item 15.
34. **Several texts are 9.5-11 px and page zoom is off.** Key labels 10 and names 9.5 (`styles.css:189-190`), clock day 9.5 (483), slider ends 11 (169), scale bar 10 (502), Places tag 10 (736), DM-only tag 10 (294), stair pill 11 (274); `user-scalable=no` (`app/index.html:5`). Fix: a 12-px floor under `(pointer: coarse)`. Queue: item 15.
35. **On the phone the clock covers the minimap.** Minimap about 125 px wide (`min(300px, 32vw)`, `styles.css:533`) with a 120-px clock on top (478, 534); a tap on the strip did not move the camera. Fix: apply the existing `.minimap.folded` (743) under 700 px. Queue: item 15.
36. **Safe-area insets are missing on most edge panels.** Top bar, camera row, finder, token panel, map frame, minimap and place card use fixed 10-16 px sides (`styles.css:141, 221, 222, 458, 497, 533, 738`); only the slider and Rooms sheet use the right inset. With `viewport-fit=cover` the notch overlaps the camera row or compass in landscape. Fix: wrap each edge in `calc(env(safe-area-inset-*) + N)`. Queue: item 15.
37. **The Rooms sheet sits under the stacked bar on the phone.** Fixed top of +62 px (`styles.css:231`) while the bar is three rows (measured bottom y 260); the finder measures the bar instead (`main.ts:220`). Fix: set the sheet's top from the bar's bottom when it opens. Queue: item 15.
38. **The DM/Players slider readout shows a decimal.** 0.37 between the ends (`viewSlider.ts:94`). Fix: a word ("peek") or no readout. Queue: item 15.

### Nit

39. **Over the whole valley the title still reads "Barovia › Village of Barovia"** with the village's page and square scale (`main.ts:399-402`); Back is hidden, the way back is the X on the world bar. Fix: mark the valley crumb current and show the hex scale. Queue: item 2 (second release).
40. **"Loading Luna River Crossroads…" appears while standing in Vallaki.** Every streamed neighbour announces itself (`app.ts:741-742`). Fix: the note only for an explicit open or enter. Queue: item 2 (second release).
41. **The clock's hour buttons wrap across two rows.** "−1 h" ends the Day row, "+1 h" and "+8 h" drop down (`main.ts:334`, `styles.css:539`). Fix: their own row under the Hour slider. Queue: item 15.
42. **Death House is the last row in the Library** under 15 chapter groups (`library.ts:22-24`); the regional row's chip says "regional" with no hint that the World map button is the way (`library.ts:20`). Fix: a Current row at the top; chip text "World map". Queue: item 15.
43. **On the phone's valley map the compass rose sits on the scale frame and the zoom chip** (both at bottom +64 px, `styles.css:497, 508`). Fix: hide `.mapframe` while the inked rose shows. Queue: item 2 (second release).
44. **One switch, three names.** "Mode" (`main.ts:146`), "DM view"/"Players view" (147), "Players mode"/"DM mode" in Help (667); "Player display", "Open Player Display" and "mistLAB · Player Display" for the second window. Fix: "view" for the switch, "Player Display" for the window. Queue: item 15.
45. **Label and tip disagree on the camera lock** ("Players follow my camera" vs "Player camera follows DM", `main.ts:170`); the World map tip is hard-coded to Barovia until the first refresh (142, 418). Fix: one string for the three attributes; build the tip from the campaign. Queue: item 15.
46. **"10-ft placement squares"** in the subtitle (`main.ts:402`) is an authoring term. Fix: "10-ft squares". Queue: item 15.
47. **"Frame N1" / "frame this floor"** is camera jargon (`main.ts:564`, `cards.ts:79`, `breadcrumb.ts:27`). Fix: "Show N1". Queue: item 15.
48. **"Reach" means two things:** the token panel's move-and-strike helper (`main.ts:610`) and the roster's 5-ft property (`encounter.ts:34`). Fix: rename the helper "Move and strike". Queue: item 13.
49. **End the encounter and Books errors use native dialogs** (`encounter.ts:88` confirm, `books.ts:66` alert); everything else is in-app. Fix: a small in-app confirm sheet. Queue: item 15.
50. **Help lacks dialog semantics** (no role, aria-labelledby or focus move, `main.ts:643-657`), unlike What's new. Fix: copy the pattern from `whatsnew.ts`. Queue: item 15.
51. **Saving is silent** (`state/idb.ts`): no saved cue, no sign of which campaign save is live, no export. Fix: a Saved tick after a commit; export comes with item 5. Queue: item 5.
52. **The Player Display shows nothing while a map streams in** ("Loading…" is DM-only, `app.ts:742`). Fix: a small corner mark. Queue: item 2 (second release, step 5).
53. **No keys for zoom, floors, tilt, tools, the DM/Players switch or the World map** (`keys.ts:4-14`). Fix: +/−, 1-9 for floors, P for Players. Queue: item 15.
54. **The Floor dropdown needs two taps and a native picker** where tabs were one tap (`main.ts:149`). Fix: tabs when they fit, else the select. Queue: item 15.
55. **README's "Using it" is out of date:** "Tokens: drag to move" (the app is tap-then-tap), "the monitor button" (does not exist), nothing on the world map, nested world or clock (`README.md:22-27`). Fix: rewrite it or point to Help. Queue: none.

Counts: 1 blocker, 7 major, 30 minor, 17 nit (55 findings after merging and refuting; the verify notes list what was merged, re-graded or dropped).

## 3. What is already good

- Every button has a name and a styled tip, on hover, at once on keyboard focus, and on a touch hold.
- Refusals are plain and tell the DM what to do: "No way through: walls block the party. Open a door first.", "Not your turn", "Took the stairs → Cellar"; the ghost square turns red before the tap lands.
- The move gesture says what to do next and how to cancel; Measure says "Tap the other end"; placing counts and says how to stop.
- The players' side is carefully projected: DM notes, tips, key labels, stair pills, the slider and the token panel all vanish; the breadcrumb becomes plain text.
- One Escape stack closes the topmost thing first, and never two things at once.
- The zoom-out chip names where it goes and never goes by itself.
- The breadcrumb keeps two crumbs on narrow screens with finger-sized hit areas.
- Help opens on the first run; What's new opens once per update, never on the Player Display, with a focused "Let's play".
- Rules links use five underline styles so colour is never the only cue; rules cards dock as bottom sheets on the phone with a sticky footer. The Books reader is the best-behaved phone screen in the app.
- The Library shows unbuilt maps as disabled rows with a chip rather than failing.
- The nested journey on desktop works end to end: valley, town, inn, room and back, with sensible crumb tips.
- Everything the DM does comes back after a reload with no prompt.

## 4. For Matt to decide

Findings with no queue home, as yes/no questions:

1. Should the room's tap menu list the room's visible objects, so a lamp or portrait card can be reached without aiming at the wall? (finding 13)
2. Should "Place here" confirm with a toast and stay open, or close the sheet and frame the token? (finding 14)
3. Should the What's new card leave out the changelog's "Known limits" paragraph, or should that paragraph be written for the table from now on? (finding 20)
4. Should an active tool (Measure) win over the party token while the tool is active? (finding 26)
5. Should the party badge always sit above door markers? (finding 27)
6. Should README's "Using it" be rewritten now, or replaced by a pointer to Help? (finding 55)
7. Findings 1, 4, 5, 6, 9-11 and 33-37 are phone layout and point at item 15; should a small "phone fit" release be pulled ahead of item 15's full theme pass?

The three changes that would help a new DM most, in order:

1. **Make the phone DM usable:** anchor the two menu panels inside the screen, wrap the floor row, and stack the roster on narrow screens (findings 1, 4, 5).
2. **Make the Players view safe for the table:** hide the Library, World map, Back, Floor, Whole building and Section in Players view, and make the DM tab need a hold (finding 3).
3. **Teach the first three actions:** a short first-run card (move the party, open a door, turn to Players) with touch wording and a Full guide link, and Help rewritten against the current bar (findings 19, 21, 22).

## 5. Evidence

Not in the repository. Scratchpad folders on the audit machine:

- `/tmp/claude-0/-home-user-VTT/3e57a1ac-07da-5111-aa9e-cccc471b7481/scratchpad/ux/walk-desktop/` (walk.md and screenshots)
- `/tmp/claude-0/-home-user-VTT/3e57a1ac-07da-5111-aa9e-cccc471b7481/scratchpad/ux/walk-phone/` (walk.md, scripts and screenshots)
- `/tmp/claude-0/-home-user-VTT/3e57a1ac-07da-5111-aa9e-cccc471b7481/scratchpad/ux/verify/` (verified.md, verify.log, screenshots 01-17)
