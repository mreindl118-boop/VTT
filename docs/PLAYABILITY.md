# Playability: the players operate the game

A plan for Matt, 2026-10-23. **Approved the same day:** Matt said yes to decisions 1, 2, 22 and 25 (section 6) as
recommended. The other decisions are asked when their release starts. Queue item 5a.

It builds on the design called **table first**. It also takes the best parts of the other two designs, **rules first**
and **devices first**. The appendix says how the three scored and what each one gives this plan.

**What was read**
- Code: main `claude/mistlab-curse-strahd-x6jm13` at `c7bf88c` (0.3.4). Line numbers are for that commit.
- Other branches, read only with `git show`: the castle (`f181f2c`), item 5 (`296280e`), item 4 (`c36585c`) and
  framework release 1 (`8df6e66`).
- The six reader notes and the three designs, kept in the cloud's scratch and not in the repository. The plan cites
  them by name (for example `read-encounters.md`); their numbers are quoted where they are used.
- The 1.0 plan (`roadmap-1.0.md`, also in the cloud's scratch, sent to Matt on 2026-10-23) and its research notes.
- Nothing in `/home/user/VTT` was changed.
- **Edited after a check of every code claim** against `c7bf88c` and the four branch heads. Wrong claims are corrected
  in place; the table situations the first draft missed are in 2.9 and in the sections they touch; release 1 is split
  in two (1a and 1b), and the order and sizes in 4.3 are corrected.

**Labels**
- **(verified)**: I read the code at the line cited, or a reader's browser probe measured it. Measured numbers name
  the note they come from.
- **(inferred)**: worked out, not run.

**Sizes**
- **S**: less than one lean release.
- **M**: one release (one builder, a review, one fix pass and tests; about what 0.3.4 took).
- **L**: two or three releases.
- **XL**: four or more.

**A few words used below**
- **The players' side**: Players view on the DM's own screen, the Player map, and later the players' phones.
- **A request**: what the players' side sends ("Vex to this square"). The GM screen checks it with the same rules as a
  tap and applies it, or says why not.
- **The players' copy**: what the GM screen sends to any players' screen, with the secrets taken out first.
- **Draw call**: one batch of drawing work for the graphics chip. Fewer is faster.
- **Main thread**: the part of the browser that runs the app. While it is busy, the screen freezes.

No book text appears here: only names and keys. The SRD numbers in section 2.6 carry their licence line there.

---

## 1. What you asked for

You want the players to run their own characters. Outside a fight, each player moves their own figure freely, the way
they would push a miniature, and walls and closed doors still stop it. Once you call initiative, nobody moves out of
turn; on your turn you move up to your speed and pass the turn on. The encounter builder and the initiative tracker are
the big piece: you prepare a fight for a room, launch it in a few taps, and run it from one panel. The app is a game
board, not a rules engine. It does not care about class or race. A character is a name, a model the player picks from a
gallery, a colour, a size, a speed, and light or darkvision if you set them. You get two outputs: a **GM screen** with
the controls, the tracker, the builder and everything hidden, and a **Player map** shown in the room (a TV, a second
monitor or another device) that does not slow the GM screen's graphics.

---

## 2. How it will play

### 2.1 One evening, start to finish

1. **Before play.** On the GM screen you set up four characters: name, colour, speed, size, light, darkvision and "played
   by Sam". From release 7 each player also picks a model.
2. **You open Death House.** The party stands at the door as one marker, as today. You tap **Split up**. Four figures
   stand round the marker's square, in roster order.
3. **Exploring.** On the Player map (a touch monitor, or a mouse passed round), Sam taps Vex's chip and then the hall.
   Vex walks there. Jo takes Brom up the stairs; Brom alone changes floor, one floor per stair. A chip shows "3 on the
   ground floor".
4. **Ghouls.** You tap **Roll for initiative!** Every figure on the players' side freezes, and the Player map says so.
   The players roll real dice and call out their numbers, or type them on the Player map. The ghouls roll once together.
   You tap **Start**.
5. **Turns.** "Sam: Vex's turn." Vex is already picked up. Sam taps a green square and Vex moves. Sam taps **Done**. On
   a ghoul's turn the players see "Round 2 · the DM's turn", and you move the ghoul: on your laptop with the Player map
   on the TV, or, on one shared screen, through your turn controls without leaving Players view (2.4).
6. **The end.** The last ghoul drops. You tap **End**. The party was split before the fight, so everyone stays where
   they stand and moves freely again.

### 2.2 Exploring (no fight on this map)

**Who moves what**

| Token | The players' side | The DM |
|---|---|---|
| A character, party split | Any character not marked "DM runs", by walking. Walls and closed doors stop it | Anything, anywhere, through walls |
| The party marker, party together | Walks, as today | Anywhere, as today |
| A creature | Never. A tap shows its players' card, as today (`app.ts:2173-2177`) | Anywhere |
| A character marked "DM runs" (an absent player's) | Never: "The DM is running Vex" | Anywhere |
| A foe row's token (the roster's NPC rows, "Add foe") | Never, and it never sees for the players. Today it is a character in all but name: it sees for the players (`app.ts:1458`) and the players can move it on its turn (F2, verified) | Anywhere |

Outside a fight the DM already moves anything without a walking check (`app.ts:1674`, verified), and a players' tap on
a creature only shows its card (verified). Inside a fight today even the DM is refused a combatant whose turn it is not
("Not Vex's turn", `app.ts:2040`, verified); from release 1a you are not. Moves are two taps everywhere: a drag pans,
and a swipe from a token never moves it (`e2e/move.spec.ts:30`, verified).

**Picking your character**
- Tap your figure, or tap your chip in the **party bar** along the bottom of the screen. A chip shows a colour, the
  character's name and the player's name ("Vex · Sam"). Tapping it picks the character up and glides the camera to it.
- A chip shows "↑ Floor 2" for a character on another floor. Tapping it changes floor.
- On a phone the bar folds to one "Party" chip that opens the list, so it does not cover the clock and the minimap.
- On one shared screen anyone may move any character, as with miniatures. The chip's player name is a label, not a
  lock. Seats that tie a character to a phone come with players' own devices (release 12).

**Together and apart**
- **Together** is today's one party marker, unchanged.
- **Split up** replaces the marker with one figure per character at the table tonight. The first takes the marker's
  square; the rest take the nearest free floor squares the first can walk to. That is the search today's Start already
  uses (`app.ts:1225-1230`, verified), moved into a small module of its own.
- **Gather** folds the figures back into one marker at the picked-up character. The players' side may Gather only when
  everyone on this map stands on one floor and can walk there ("Not everyone is here: the DM can gather the party"). You
  can always Gather, from the party bar or from a room's menu ("Gather the party here").
- **The campaign remembers the last choice.** A map the party arrives on opens the same way. A map that still holds an
  old marker unfolds when the party arrives, not before.
- **The default stays Together.** Every saved campaign and every test that counts one marker per map keeps working
  (decision 3).
- **Light when apart.** The party's torch (20/40 ft) goes to the first character at the table unless you set lights on
  the rows, so a dark map looks the same the moment the party splits. Today a fight's torch goes to whoever rolled
  highest, and only if that is a character (`app.ts:1236`, verified; F5).
- **Your party-wide controls when apart.** Find (F, the camera's Find button) frames the picked-up character, else the
  first at the table; the menu's "Move party here" becomes "Move Vex here" for the picked-up character, or "Gather the
  party here" when none is; the floor picker and the Rooms list mark every floor and room a character stands on. Today
  all of them read the one `party` token (`main.ts:206`, `:405`, `:477-478`, `:563`, verified), and the test hooks
  `__mistlab.partyPos` and `moveParty` (`main.ts:60`, `:82`) keep meaning the marker while the party is together.

**Moving**
- A move goes anywhere the character can walk, with no distance limit, as today (`core/movement.ts:17-59`, verified).
- Every room the walk passes through becomes explored. Today only the room it ends in does (`app.ts:1397`, verified;
  decision 5).
- A hidden creature never blocks a player's move or changes the shape of their green squares, because that would give
  it away. If a character ends on a hidden creature's square, the GM screen says so ("Vex stepped onto the hidden
  ghoul") and you decide. Today the green area routes round hidden creatures (`occupied` in `app.ts:1280` counts every
  token on the floor, verified), so its shape can show where one stands (inferred).

**Doors and containers**
- Outside a fight, as today: the players' side opens any unlocked door whose marker shows, and any unlocked container
  (`toggleDoor`, `app.ts:1678-1684`; `toggleOpen`, `app.ts:1637-1647`, verified). Locked ones say "Locked"; you open them.
- A table setting can tighten this to "only within 5 ft of a character" (decision 6).
- In a fight the rule is stricter (2.4).

**Stairs, ladders and trapdoors**
- A character who walks onto a stair end takes it, one floor per step. This is the castle branch's single-hop rule
  (`core/verticalLinks.ts` on `f181f2c`, verified), applied to every character instead of only the marker. Today a
  character's own token never takes stairs (`afterMemberMove`, `app.ts:1373-1377`, verified).
- Where an up stair and a down stair share a landing, the players' side offers both ("Up to the attic", "Down to the
  hall"). The castle's code already returns that choice (`LinkStep` with `choices`, verified). On the GM screen the
  castle's own words stay ("…: the DM picks one on the stair marker"), which its `e2e/vertical-links.spec.ts:176`
  matches (verified on `f181f2c`). This answers the castle's open question 3 (stair markers in Players view) with a
  choice instead of markers; it is your call with that question.
- Stair markers stay hidden on the players' side, as today. On the GM screen a stair marker moves the picked-up
  character, or the marker if the party is together.

**Going into a building, and travelling**
- Enter, Back and the world map stay yours (Enter is DM-only today, `app.ts:1304`, verified).
- The party arrives on the new map together or apart, as the campaign last chose, at that map's start or where it was
  left. The characters on the map it left stay there, just as today's marker does (each map keeps its own party; the
  tokens reader's probe P7, verified).
- Looking at a map with the camera moves nobody, as in 0.3.4.
- On the valley, the `&` stands on the marker, or on the first character when the party is apart.
- Splitting the party across maps (Vex waits outside the inn) is after this plan.

### 2.3 Starting initiative

- **Only you start it**: "Roll for initiative!" on the party bar, the swords button, a placed creature's "Join the
  fight", or a prepared encounter's Run (release 6).
- **Called** (release 3). The moment you tap it:
  - every figure on this map freezes on the players' side, and the Player map shows "Roll for initiative!";
  - a party that was together splits at once, so everyone stands on a square before the dice come out;
  - you may still move anyone, to set up an ambush;
  - the roll sheet opens with every character on this map ticked, and every creature on this floor listed for you to
    tick.
- **A character on another floor of this map** is ticked too. On its turn your view and the Player map change floor,
  as `nextTurn` already does for you (`app.ts:1264-1265`, verified), and the players' strip says "Brom · upstairs".
  Vision runs for the floor in view only (`app.ts:1447-1450`, verified), so that floor's explored memory catches up when
  its turn comes.
- **A character on another map** is that map's own copy (each map keeps its own party, 2.2), so it is never in this
  fight. Calling initiative on a map the party was not taken to (a map you are only looking at) asks first: "The party
  is in the Village. Start a fight here anyway?"
- **Rolling.**
  - Players roll their own dice. You type their numbers, or they type them on the Player map's keypad (release 4).
  - A character left blank rolls a plain d20 at Start, after one question ("Vex has no number: roll for her?"), plus a
    bonus only if you entered one on the row. A character's initiative bonus is an optional board number, never worked
    out from a class or ability scores (decision 29).
  - From release 5, creatures roll once per group of identical creatures, with their stat block's bonus. Today every
    creature gets +0 (`app.ts:1781`, verified).
  - Ties: the higher bonus goes first. You can drag tied chips into order.
- **Surprise** (release 5): a "Surprised" tick on each row. By the 2024 rules a surprised combatant rolls with
  Disadvantage: the app takes the lower of two d20s for a monster, and a character's row says "roll with
  Disadvantage". Decision 11 asks whether a 2014 table follows its own rule instead.
- **Start.** Characters stay where they stand; nobody is spiralled into place. Creatures stand where you placed them, or
  where the plan put them. The first turn begins.
- **Today's bugs fixed here:** Roll rolls only what is ticked, and nothing when nothing is. Today, with no character
  ticked, it rolls the first roster row only (the "nothing ticked" test is true for the first row alone, since that row
  then ticks itself), even when creatures are ticked (`ui/encounter.ts:70`, verified; G01). The roll sheet fits a phone; today its ticks and number fields sit off-screen at
  390 px (measured, `read-tests-claims.md`).

Releases 1a and 1b keep today's one-step Start. Called arrives in release 3.

- **A creature that joins mid-fight** (placed now, or "arriving in round n" from a plan) goes into the order by its
  initiative, rolled or typed. The current turn does not move, because from release 3 the fight records whose turn it
  is by token. One placed hidden joins hidden: the players' order does not change and the strip shows nothing new.
  Today a creature placed during a fight stays out of the order, moves freely for you, and its turn never comes
  (`moveTokenTo`, `app.ts:2037-2038`, verified).

### 2.4 On a turn

**Only the current combatant moves.**
- A character moves on the players' side. Its turn picks it up automatically (release 3), so the player's first tap is
  the destination. The status line names the player: "Vex's turn · Sam".
- A creature moves by your hand.
- Anyone else hears "Not your turn", the exact words the tests already pin (`e2e/surfaces.spec.ts:190`, verified).

**The movement budget.**
- The character may move onto any green square: its speed minus what it has spent, through floor, round walls and
  closed doors (`core/range.ts`, verified). Several moves per turn are fine until the speed is spent.
- A tap anywhere inside a green square counts. Today the tapped point must equal a square's centre exactly
  (`app.ts:2041`, verified), so with Snap off a player cannot move on their turn.
- On the hex grid, today the range is never built (`app.ts:1292`, verified), so every players' move in a fight is refused
  as "Out of movement range". From release 1a the budget is checked on the square cells under the hex grid, and the turn
  line reads "15 ft left". Release 5 gives the hex grid its own green cells.
- The amber ring that follows the mouse while a token is picked up checks walls only, so in a fight it shows amber on
  squares the move then refuses (`previewMove`, `app.ts:2018-2031`, verified). From release 1a it turns red off the
  green squares.
- The green squares always count diagonals at 5 ft (`diagonalRule`, `app.ts:1282`, nothing sets it), while Measure reads
  the table's 5-10-5 setting (`app.ts:1893`, verified). From release 3 both read the one setting.

**Buttons on the players' side, on a character's turn**
- **Done** ends the turn at once (release 1a). Your Previous steps back after a mistake.
- **Undo step** takes back this turn's moves one at a time, a stair included, and gives the movement back (release 3).
  A room it saw stays seen.
- **Undo across a turn.** Undo step works only inside the turn it belongs to; after Done it says "The turn has already
  passed". Your Previous goes back to the last turn with the movement it had spent and its steps, so its Undo step works
  again. Today Previous hands the previous combatant a fresh, full budget (`nextTurn` sets `movedFt` to 0 either way,
  `app.ts:1262`, verified) and nothing restores a position.
- **Dash** adds the character's speed once to this turn (release 3).
- **Delay** puts the character on a waiting shelf; between any two turns, you or that player tap **Act now** (release
  3). Delay is a common table rule rather than a 2024 rules action, and its card says so (decision 12).

**Doors and stairs in a fight**
- Only the current character may open or close a door or container, and only within 5 ft of it.
- Walking onto a stair end takes it, one floor. Getting there costs movement; the climb itself is free.
- Your view follows the current combatant's floor, as `nextTurn` already does (`app.ts:1264-1265`, verified).

**Everyone else** can look around, read the cards of what they can see, watch the order and tap their own chip.
Characters on this map who are not in the fight are frozen, and you can free one or add it with "Join the fight"
(decision 7).

**What stays your call.** Opportunity attacks, reactions, shoves and readied moves. The board never stops a move for
one. You take a step back with Undo step, or move the token yourself with two taps off its green squares ("Placed by
the DM: no movement spent", today's words, `app.ts:2044`, verified). Moving a character for an absent player onto its
green squares spends its movement, as today (`app.ts:2041-2042`, verified). Difficult ground is a toggle on the current
turn that makes every step cost double (release 8; decision 17).

**Your overrides, at any time:** move anything anywhere; Previous and Next; **Pause** (everyone on the players' side
freezes); mark a character "DM runs"; free a character; add or remove a combatant; end the fight.
- **Remove from the fight keeps a character on the map.** Today Remove deletes the token itself (`removeToken`,
  `app.ts:1766-1768`, verified), and removing the last combatant ends the fight without End's fold, so no marker comes
  back (`app.ts:1769`, verified). From release 1a, removing a character takes it out of the order only; deleting a
  creature stays its own act; an order that empties ends the fight exactly as End does.

**Your turn controls on one shared screen** (release 3, decision 28). With no Player map, a creature's turn today means
flipping to DM view in front of the table: in Players view a creature can only be looked at (`app.ts:2173-2177`,
verified), and the turn bar has no Next (`ui/encounter.ts:103`, verified). From release 3 a press and hold on the turn
bar opens your controls without leaving Players view: Move it (the current creature moves by your rules; a hidden one
moves without anything being drawn or named), Next, Pause. A player's tap cannot open it.

**Removing a combatant keeps the turn where it was.** Today the fight records the turn by its place in the list, so
removing someone earlier hands the turn and its spent movement to the next one (`removeToken`, `app.ts:1766-1772`,
verified; G02). From release 3 the fight records whose turn it is by token.

### 2.5 Ending a fight

- **End** opens a small sheet inside the app, in place of the browser's own box (`ui/encounter.ts:88`, verified). It
  offers:
  - **Stay where you stand**, the default when the party was split before the fight;
  - **Back together**, the default when it was together. That is today's behaviour, so `e2e/ui.spec.ts:76` keeps its
    meaning (verified).
- **The party is never lost.** Today End makes a marker only if no token of any kind is left on the map, so one
  creature left standing loses the party (`app.ts:1252`, verified; probe P1). From release 1a, End never deletes a
  character, and it gathers at the first character's square when asked.
- Creatures keep their names, hit points, aliases and hidden marks. **Clear the fallen** removes the defeated ones in one
  tap (release 5).
- From release 6 the sheet shows the fight's XP and each character's share for you to announce, or nothing under
  **Milestone** (decision 15). Nothing is stored on a character: the board keeps no levels or XP per character.
- The clock has moved 6 seconds a round (release 5).
- **Leaving during a fight.** Today Enter, Back, the Library and world-map travel all work mid-fight: the fight waits in
  the save, bound to its map (`encounter` getter, `app.ts:1210`, verified), and the turn bar vanishes until you come
  back. From release 3 they ask first ("End the fight, or leave it waiting?"). The players' side never reaches the world
  map (`ui/worldnest.ts:249`, verified) and, from decision 25, none of the others. The valley's `&` stays on the fight's
  map. A fight that travels with the party through Enter and Back (approval A16) is after this plan.

### 2.6 The encounter builder (release 6)

It lives on the GM screen only. Players never see a plan.

1. **Open it** from a room's menu (**Encounter here**), from the Rooms list (a key with a plan has a badge), from the
   `/` finder, or from the tracker's Plans tab.
2. **Creatures of this place** fills a plan in one tap from what the map already holds:
   - the map's own hidden creature slots in that room. There are 695 across 38 scenes, 636 on a room key (counted,
     `read-encounters.md`). Death House area 29 has four ghoul slots;
   - creatures already placed there;
   - the module's people tagged to the place;
   - the terrain sets in `manifests/encounters.json`.

   67 slot kinds are neither SRD monsters nor module people. A small table of our own maps each to an SRD stand-in,
   labelled "stand-in" everywhere. No scene is regenerated.
3. **Search** the 330 SRD 5.2.1 monsters and the module's people by name, or type your own creature (name, XP, hit
   points, armour class, speed, initiative bonus). Numbers come only from the SRD or from you.
4. **Groups.** For each: how many, which side, hidden at start (on by default) and the players' name for it, average or
   rolled hit points, one initiative roll for the group or one each, arriving in round n, and where they stand.
5. **The difficulty meter** (the 2024 table, as you decided on 2026-10-05, `docs/QUEUE.md:128`, verified):
   - The party level gives Low, Moderate and High budgets per character; the party's budgets are their sum.
   - Each enemy spends its stat block's XP. Allies spend nothing.
   - The label is the first budget the total does not exceed, or "over High".
   - Cautions in our own words: many creatures for few characters; a creature above the party's level.

   | Fight | Party | Low / Moderate / High | Total XP | Label |
   |---|---|---|---|---|
   | Four ghouls | 4 at level 3 | 600 / 900 / 1,600 | 800 | Moderate |
   | Two ghasts | 4 at level 3 | 600 / 900 / 1,600 | 900 | Moderate, at the edge |
   | Six wolves | 4 at level 1 | 200 / 300 / 400 | 300 | Moderate, with the crowd caution |

   The table is read from `app/public/books/srd-5.2.1/p/gameplay-toolbox.json` and the XP from
   `srd-5.2.1/e/monsters.json` (verified, by the encounters reader and the rules-first design). *This work includes
   material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at
   https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International
   License.*
6. **Placing.**
   - **At the slots** (the default for a keyed plan): each slot becomes a live, hidden creature at its own spot, under
     the slot's players' name. The slot stops drawing while its creature lives.
   - **In a cluster or a line** from a tapped square: on floor, reachable, free, never on a door or a stair, with 2x2
     squares for Large and 3x3 for Huge.
   - Hit points come from the same stat block the card shows. Today a token takes SRD 5.1 numbers while its card can
     show 5.2.1; 33 kinds differ, a dire wolf 37 against 22 (`app.ts:1743-1748`; counted in `read-encounters.md`; F4).
   - SRD monsters the module does not name can be placed. Today only module entries can (`app.ts:1744`, verified).
7. **Run** places the creatures hidden, rolls for them, and calls initiative. After the players' numbers, **Start**.
   That is three taps from the room to the first turn.
8. **Save** a plan by name. **Save these creatures as a plan** turns what stands in a room into a plan.

### 2.7 The initiative tracker (releases 5 and 8; docked in release 9)

- **Today's turn bar** stays as the small view (`ui/encounter.ts:82-106`, verified). The tracker is the full one: a panel
  with one row per combatant, in order.
- **A row holds:** colour, name (with the players' name in brackets), initiative, a creature's hit points with a bar,
  a creature's armour class (yours only), condition chips, legendary diamonds, and marks for hidden, delayed, ready,
  surprised, arriving, down and defeated.
- **Groups.** "Ghouls ×4" is one row that folds open. Next steps through each ghoul, and each gets its own movement.
- **Hit points.** Type "-7", "+5" or "15", plus temporary hit points. Today there are only one-point buttons.
  - A creature at 0 is defeated. Next skips it, and it leaves the players' order at once (approval A30). It stays greyed
    on your side so a wrong number can be fixed.
  - Characters have **no hit points**: it is only a game board (decision 13). You, or the player, tap **Down** on a
    character's row. The figure lies down, both screens say "Down", and its turn still comes (approval A30), so the
    player rolls and says what happens, on paper. The board keeps no death-save count; the 1.0 plan also moves
    characters' hit points and death saves after 1.0 (`roadmap-1.0.md`, section 3, "After 1.0": "Matt said the board
    does not need them"). Up again is one tap.
- **Conditions** (release 8): the 15 SRD conditions plus Exhaustion levels, and a Concentrating marker. Durations are
  "until the start or end of X's next turn" or "for n rounds", and they end by themselves on every screen. At most three
  pips on a revealed token, then "+n". Grappled and Restrained show "speed 0" in the turn's budget, which you can
  override. Nothing else is automated. A character's conditions live on its roster row, so they follow it from map to
  map.
- **Legendary and lair** (release 8): legendary uses as diamonds, back at the start of the creature's own turn, with a
  reminder after other turns; a lair entry at 20 that loses ties, hidden from players unless ticked; free-text reminders
  in the order.
- **Dice** (release 5): a seeded roller for monster initiative and rolled hit points, and a log only you see.
- **Time:** +6 seconds a round (approval A17). The round chip shows "Round 3 · 12 s in".

### 2.8 What players see, and what you see

| Thing | Players (Players view, Player map, later phones) | You (GM screen) |
|---|---|---|
| Characters | All, by name, model and colour | The same, plus light, darkvision, "DM runs" |
| A hidden creature | Not drawn, and from release 2 not even sent | Drawn faint, at 45% (`app.ts:1426-1431`, verified) |
| A revealed creature | Its players' name; a health word (Bloodied, Down), never a number (approval A11) | Real name, hit points, armour class |
| Turn order | Visible combatants by their players' name; a hidden creature's turn shows only "the DM's turn" | Everything, with initiative, hit points and conditions |
| Green and red squares | Only on a turn they can see. Today a hidden creature's squares show to players (`app.ts:1286-1298`, verified; probe P2) | Every turn |
| Called | "Roll for initiative!" and the keypad | The roll sheet |
| Conditions | Pips on revealed tokens and characters, without your notes | All, with notes and durations |
| Plans, budget, rolls, XP, notes, keys, unrevealed secret doors | Never | Yes |

### 2.9 Situations at the table

Each row says what happens and which release brings it. The ones that change a section are written there too.

| Situation | What happens | Release |
|---|---|---|
| A character is on another floor when you call initiative | Ticked; on its turn the view and the Player map change floor; the strip says "upstairs" (2.3) | 3 |
| A character's copy stands on another map | Not in this fight; calling initiative on a map the party was not taken to asks first (2.3) | 3 |
| A creature joins mid-fight | Into the order by its initiative; the current turn stays; a hidden one changes nothing the players see (2.3) | 3 (placing), 6 (arriving in round n) |
| Two players share one device | On one screen anyone moves any character already (decision 4). On a phone a seat may hold two characters; the turn hand-off names the character, and the phone picks it up | 13 |
| One player runs two characters | Both chips read "· Sam"; each turn hands off by character | 1b |
| A player's device drops on their turn | Their turn stays. The GM screen shows "Sam's phone is away" on the row; you move the character, tap Done for them, or mark it "DM runs". Nothing ends the turn by itself. A request sent before the drop and heard late is refused as "The turn has already passed" | 4 (the Player map window), 12-13 (phones) |
| The Player map window closes or reloads mid-fight | Play goes on on the GM screen; the live chip turns grey; the window, reopened, says hello and gets the whole players' copy (today's `hello` reply, `app.ts:2278`, verified) | 2 |
| You move a player's character | Anywhere, through walls; onto its green squares it spends movement, elsewhere it is "Placed by the DM" (2.4) | 1a |
| Players view on the one screen during a turn | A character's turn: Done, Undo step, Dash, Delay on the turn bar. A creature's turn: your press-and-hold turn controls, so you never flip to DM view in front of the table (2.4; decision 28). Flipping the view keeps the current combatant picked up (today `setView` drops the selection, `app.ts:1596`, verified) | 3 |
| You open the world map, Enter or Back mid-fight | Asked first; the fight waits on its map (2.5) | 3 |
| Undo across a turn | Undo step only within its turn; Previous restores the last turn's spent movement and steps (2.4) | 3 |
| The phone layout | The party bar folds to one chip; on a phone the party chip, the turn bar and Done overlap nothing and every control is at least 44 px (item 4 folds the minimap and compass on phones); the roster opens as one card per character instead of the 795-px table | 1b (chips, roster cards), 3 (roll sheet), 9 (tracker sheet) |
| The Player map on a TV while the GM screen runs on the laptop's graphics | The TV is still drawn by the laptop; release 2 makes that drawing cheap (3.4). Your window must not be covered or minimised: a browser stops drawing a hidden window (inferred), so requests are applied as they arrive, never on your next drawn frame | 2, 4 |
| A player picks or changes a model mid-session | A pick is a request like any other, applied at once; in a fight it costs no movement and does not end the turn; it never changes speed, size or light. Only that figure is rebuilt. Your lock refuses picks once play starts | 7 |
| A second DM window on the same computer | Offered to become the Player map instead of a second writer of the save | 9 |

---

## 3. Players and their devices

### 3.1 Who is who

- **The roster row is the character**: name, colour, model, size, speed, light, darkvision, "played by" and "at the
  table tonight". Reach, range (for the red squares) and an initiative bonus stay as optional board numbers under the
  row's More, with neutral defaults (5, 0 and 0): they are today's `Sheet` fields (`state/campaign.ts:33-46`, verified),
  kept so saves load, never worked out from a class (decision 29). No class, race, level, hit points, armour class or
  ability scores.
- **The starting roster is class-coded today:** Fighter, Rogue, Cleric and Wizard, with a class's initiative bonus,
  the Rogue's 60 ft of darkvision and an 80- and a 120-ft range (`defaultRoster`, `state/campaign.ts:105-108`,
  verified). From release 1b a new campaign starts with Character 1 to 4, speed 30, Medium, no darkvision and the
  neutral numbers (decision 22). Saved campaigns keep their rows.
- **On one shared screen there is no login.** The players' side is one actor, "the table". You are Vex because you
  touch Vex. Three things help: the party bar, the turn hand-off ("Sam: Vex's turn"), and "DM runs this
  character" for someone who is away.
- **On the Player map** (release 4), taps are the table's taps too. They become requests to the GM screen, checked by
  the same rules.
- **On a player's own phone** (release 12), the player claims a free character. You allow the first claim; after that
  the phone gets its seat back by itself. The rules change in one place: the actor becomes "the seat that holds Vex"
  (a seat may hold two characters, for a player who runs two or two players on one phone), and "That's not your
  character" joins the refusals.

All of this goes through one function, `may(actor, act, state)` in a new `core/permissions.ts`. That is the module
`docs/ROADMAP.md:430` already planned for this (verified). Today the same rules are spread over `moveTokenTo`, `tap`,
`toggleDoor`, `toggleOpen` and `takeLink` (`app.ts:2033-2053`, `2158-2186`, `1678-1684`, `1637-1647`, `1354-1361`,
verified), plus the menu's "Move party here", which checks nothing (`main.ts:563`, verified). They read the DM's own
screen mode: `canWalkTo` lets any move through when the DM's window is in DM view (`app.ts:1673-1674`, verified), and it
checks the floor in view, not the token's (`app.ts:1675`, verified). That would let a Player map tap walk through walls.
The new rules take the actor and the token's own floor.

### 3.2 How messages travel, in order

| Order | Carrier | Reaches | Why this order |
|---|---|---|---|
| 1st (releases 1-4) | Inside the page, and the same-browser channel that exists today (`state/channel.ts:11-19`, verified), extended both ways | The GM screen's own Players view, and a Player map window on the same computer | No network, no accounts, works offline in the desktop app, and it is tested today. You said the Player map is "shown locally" |
| 2nd (releases 12-13) | The room's wifi, through the desktop app (an opt-in listener) | Phones, tablets and a TV's own browser in the room | Offline, no accounts, players can send freely. A device that draws the Player map itself is the only thing that takes the load off your laptop entirely. It needs your yes on a firewall prompt and one reinstall, because the launcher only listens on the laptop itself today (`scripts/desktop/launcher.mjs:48`, `:82`, verified: host `127.0.0.1`, GET and HEAD only) |
| 3rd (after this plan) | The mistLAB link's own room | Remote players | No server, and the platform stamps who sent each message. But every player needs a Claude account and an email invitation; invited players can only send through a 4 KiB slot; publishing a new version empties the room; and the link cannot open the Player map popup reliably (`roadmap-1.0.md` section 4) |

- **One interface for all three**, in a new `state/link.ts`. The GM screen's own Players view goes through it too, so
  one code path handles every players' tap (taken from devices first). Adding wifi later changes no game rule.
- **Requests state the end result**: "Vex to (35, 40)", "end round 3's turn of Vex", never "move Vex 5 ft". A request
  that arrives twice or late changes nothing, and a turn that has passed refuses it ("The turn has already passed").
- **The GM screen applies every request heard together**, with one save and one vision pass (taken from devices
  first). Five players moving at once cost one pass, not five. The batch is gathered by a zero-delay timer when a
  request arrives, not by the next drawn frame: a browser stops drawing a covered or minimised window (inferred), and a
  GM screen behind the Player map would then never apply anything.
- **A device that drops on its turn** keeps the turn; you see "away" on its row and act for it (2.9). Every request
  carries the round and the turn it was meant for, so one heard after a reconnect is refused, never replayed.
- **A player's move never moves your camera or your floor.** Today the party's move does both (`afterPartyMove`,
  `app.ts:1389-1398`, verified).
- The players' side shows refusals in today's words: "No way through", "Out of movement range", "Locked", "Not your
  turn", "The DM has paused play".
- This order matches the 1.0 plan, which also puts the room's wifi first and the link's room after 1.0
  (`roadmap-1.0.md` section 4).

### 3.3 What the players' side receives: filtered on your side

One function runs on the GM screen before anything leaves it, for the Player map on the same computer as much as for a
phone: item 5's **`projectState`** in `core/playersView.ts`, extended in place, not a second function beside it. Item 5
sorts every saved key into "player" or "dm" and fails the build when a new key has no class, and its `Channel.send`
already projects every `state` message (verified on `296280e`). Item 5's version still forwards each hidden creature's
token with its position, alias and bestiary id, the `cr:` roster rows with blank names, and the whole turn order
(verified). Release 2 filters the values too:

| What | What players receive |
|---|---|
| Creatures | Hidden ones are dropped. A revealed one goes with its players' name, a health word instead of hit points, and a figure key instead of its bestiary id, so the network data does not name the monster (decision 21) |
| Characters and the marker | As they are |
| The roster | Character rows only. Foe rows and `cr:` rows are dropped |
| The fight | The players' turn view (`turnView`, `core/identity.ts:37-54`, verified): hidden entries out, the current combatant and its movement only when visible, the round, the phase. Never the raw order |
| Explored memory, reveals, open doors, opened containers, the world map, the clock | As they are |
| Plans, the roll log, the XP, the campaign's name, your camera (unless you mirror it) | Never |

**What the filter cannot protect.** Your notes in the map files ship in the app every device downloads, and the
repository is public. On one computer, a player holding the mouse can open your window. Help will say so plainly; the
honour system covers it.

### 3.4 The GM screen and the Player map, without strain on your graphics

**What each shows**

| | GM screen (your window, the only place secrets live) | Player map (the room's window) |
|---|---|---|
| The map | Full 3-D with your camera; hidden creatures faint; keys and notes | The party's map alone in the mist, with its own camera |
| Tokens | Everything | Characters, the marker, revealed creatures by their players' names |
| Initiative | The tracker, docked left (release 9) | The players' strip: whose turn, the visible order, movement left; banners for "Roll for initiative!", "Paused" and "the DM's turn" |
| Encounters | The builder, docked right (release 9) | Never |
| Table controls | The Player map strip: live or not, open on the TV, camera mode, Send my view, Players may move, Pause, Curtain. A second wedge on the minimap shows where the Player map is looking (drawn flat, so no graphics cost) | The party bar; on a turn, Done, Undo step, Dash and Delay; the initiative keypad; "Choose your model" |
| Which floor | Yours | In a fight, the current combatant's floor. Outside one, the floor of the character who moved last, with a chip for anyone elsewhere ("Brom · upstairs"). Today the display shows your floor, and a floor change alone is not even sent (`setLevel` has no broadcast, `app.ts:1079-1102`, verified; folded into item 5) |

**Why today's Player Display strains the GM screen** (measured, `read-player-map-gpu.md`):
- It is a second full copy of the app in the same browser process (`main.ts:465`, verified), with every map built again
  and its own vision pass on the same main thread.
- It follows your camera by default (`app.ts:145`, verified), up to 25 messages a second (`app.ts:2256-2266`, verified),
  so every drag of yours is drawn twice. In Vallaki's valley a frame takes 21.6 ms for the GM screen alone and about
  twice that for the pair.
- A 400 ms busy spell in the display froze your window for 403 to 3,603 ms.

**What release 2 changes, all in the Player map's own mode, so the GM screen's code path is untouched:**
1. **Its own process.** Opened as a separate browser process (`noopener`), the freeze fell to 9 to 57 ms in the probe,
   and the channel still worked (measured).
2. **Its own camera.** It follows the current turn in a fight and the party otherwise; it can hold still, show once what
   you send, or mirror you as today. Your drags send it nothing, so nothing is drawn twice.
3. **Draws only when something changes**, with its own glides capped at 30 frames a second.
4. **Cheaper pixels**: no edge smoothing (12% faster on Death House, 24% on the Sheep Chase square, 56% on Vallaki,
   measured on a software renderer), a fixed size of at most 1920x1080 that the TV scales up, and the expensive depth
   setting only over the valley.
5. **Less scene**: the map alone in the mist; no neighbouring maps streamed in. That also cuts what the second window
   holds (inferred): each window keeps its own copy of the map, in memory and on the graphics chip (169 MB of script memory per
   window on Vallaki, measured in `read-player-map-gpu.md` 2.4).
6. **Its own vision pass, in its own process**, using the explored memory you send.
7. **It never writes the save.** Item 5 already stops the display saving (`commit` saves only in DM mode on
   `296280e`, verified); release 2 keeps that and makes its door and stair markers inert, so it cannot change the
   campaign it shows either (today it can, probe P9).

**Where it goes after that**
- Release 10 batches the figures, so a full party costs a handful of draw calls.
- Release 11 adds a flat top-down board, about 2 to 22 ms of work per redraw (measured), for a weak machine or a TV's own
  browser, and as the base for phones.
- Releases 12-13: another device in the room draws the Player map itself. Only that takes the load off your laptop
  completely. A TV plugged into the laptop is still drawn by the laptop; release 2 just makes that drawing cheap.

**Not built:** one renderer drawing both views (it saves memory, not drawing time, and one missed switch would show
secrets), and screen casting (it shows the GM screen, or still draws on the laptop and adds video encoding).

### 3.5 The character models gallery (release 7)

- **Built from the kit's own figure** (one shared humanoid with optional parts, `kit/creatures.ts:17-59`, verified), in
  our own style. Every existing figure keeps its shape; the colours gain the kit's grain (below).
- **Sixteen looks, named for what you see, never for a class or race, with no rules attached:** shield and sword;
  greatsword; plate and hammer; furs and axe; spear and buckler; hood and longbow; wide hat and crossbow; twin daggers;
  robe and staff; book and lantern; mace and plain sun disc; lute and feathered cap; high collar and wand; wraps and
  quarterstaff; antler crown and sickle; traveller.
- **Options on every look:** one of 8 player colours (the cloth, the ring, the name tag and the chip; a warning when two
  characters share one), 6 skin tones, 6 hair colours, broad or slight, and size. The figure grows with its size, which
  today it does not.
- **Budgets:** at most 6 colours, 500 to 900 triangles and 5 to 7 ft tall at Medium; every look must read from straight
  down as well as at an angle.
- **How a player picks:** with you on the GM screen (the roster's colour square becomes a model chip); on the Player map
  when you put up **Choose your model**, by the table's taps; and from release 13 on their own phone. You can lock models
  once play starts.
- **Changing mid-session** is allowed until you lock: the pick is applied at once, rebuilds only that figure, costs no
  movement in a fight and never changes speed, size or light. A look carries no rules, so nothing else follows from it.
- **Tokens move onto the kit's materials** (`matClone(colour, true)`, fog-exempt, the same shader program,
  `render/materials.ts:257-262`, verified). That adds the kit's surface grain and the inked-map wash to every figure
  (`patchFog`, `render/materials.ts:223-238`, verified), so today's figures do not stay pixel-identical (inferred). The
  gate is a before-and-after pair for your look, and the shapes and draw calls unchanged.
- **Thumbnails** are drawn on each device from the kit's figures, with the window's existing renderer, never a second
  graphics context (pitfall 3). They are never committed.
- **Out:** book art, likenesses of official miniatures, anything made by AI (`docs/STYLE.md:4`), models from games,
  non-commercial or no-derivatives licences, and players' own uploads. Quaternius now uses its own licence, which is not
  on the allowed list (`read-models.md` 3.2).

---

## 4. The release plan

### 4.1 What must merge first

Release 1 (1a and 1b) changes functions that four lanes hold today. Their order:

| Order | What | Why release 1 waits for it | State today (verified, branch heads) |
|---|---|---|---|
| 1 | Item 4, movable panels | `main.ts` and `styles.css`; the tracker and builder dock in its panels later | Built and verified, ready to merge in queue order (`c36585c`; its claim row) |
| 2 | Item 5, backups | The players' copy, the key classes, the save checker, `coverage.ts` | Work in progress, `296280e` |
| 3 | The castle | Single-hop stairs, party start, `ensureDefaultToken`, `campaign.ts`, `main.ts`, `styles.css`, `light.ts` | Ready for your look, `f181f2c` |
| 4 | Framework release 1 | `ensureDefaultToken`, `canWalkTo`, the refusal words | Work in progress, `8df6e66` |

- **While they land**, release 1's builder writes its new pure modules and their tests on its own branch, touching no
  claimed file: `core/permissions.ts`, `core/party.ts` (split, gather, free squares), `core/encounter.ts` (the turn
  helpers), `core/sightIndex.ts` and `state/upgrade.ts`.
- **Two more lanes touch the same files, without blocking:** item 3 (the dollhouse) claims `app.ts`'s dollhouse toggle
  and orbit and `render/build.ts`'s tagging, which release 1 does not change; item 6's render group claims
  `render/materials.ts` and `build.ts`, which releases 7 and 10 wait for (AGENTS.md Claims, verified). The sight
  index's hook sits in `core/coverage.ts`'s `updateVision`, a file item 5 and the castle both claim: a few lines, after
  both land, and nothing in its saving or loading.
- **Release 2 does not wait on release 1** (4.3): its code is the broadcast, the display's `onMsg`, the camera messages
  and the display's renderer, none of which release 1 changes. It waits on item 5, and on 2f-3's claim on
  `render/world.ts` for its renderer settings. Both touch `syncTokens`; whoever merges second resolves it.
- **Before release 2**, a two-minute test settles whether the Player map popup and the channel work on the mistLAB link.
  If they do not, the Player map belongs to the desktop app and the link plays on one screen.
- Two collisions between those lanes are not this plan's to settle: the castle and item 5 both rewrite how explored
  memory loads (castle question 10 orders them), and the castle and framework release 1 both add
  `tests/party-start.test.ts` (`roadmap-1.0.md`, "Collisions"). This plan touches neither the saving nor the loading of
  explored memory.

Every release below claims its files in `AGENTS.md` first, merges main in, is checked on Death House, Vallaki and the
Sheep Chase square at 1366x768 and 390x844 as DM and as players, gets a review and one fix pass, runs the full suite,
and takes the next version in order. Every new test fails first on the release's base, except a new module's own unit
test.

### 4.2 The releases

Release 1 is two lean releases, not one. The first draft packed about eighteen changes into one builder (the party
model, every `party` consumer, `ensureDefaultToken`, Start and End, the move, tap and stair paths, vision, the sight
index, the valley fold, the party bar, the roster, the upgrade function, four unit files and two browser specs); the
encounters reader sized the same ground, together with release 3's turn phases, at three releases (one of fixes, then
two for free movement and turns; `read-encounters.md` section 0). 1a fixes the fight on today's model; 1b adds the
characters.

**Release 1a. The party is never lost, and turns work on every grid (M).**
- **Your words:** "unless initiative is engaged in which case they can move on turns."
- **Acceptance:** on the three regression maps, in Players view on desktop and phone, with today's one marker:
  - End keeps the party, even with a creature left standing, and so does removing every combatant;
  - `party` is never a creature; Find and the turn bar's Find frame the current combatant;
  - after Start, only the current character moves, only onto its green squares, with Snap on, with Snap off and on the
    hex grid; the amber ring agrees with the green squares; Done passes the turn;
  - a hidden creature's turn shows no squares; a hidden creature never shapes a player's green squares;
  - a foe row never sees for the players and they cannot move it; the torch goes to the first character;
  - on the players' side a stair, a door and a container out of turn say "Not your turn"; you may move any combatant;
  - a roster keystroke runs no vision pass;
  - the three maps' frames are pixel-identical to main with equal draw calls.
- **Contents:** N1 and F1; F2 and F5; End never loses the party, and the empty-order path ends the fight the same way;
  Remove keeps a character on the map; a tap inside a green square counts; the hex budget on the squares underneath;
  the amber ring; the two leaks; Done; `core/permissions.ts` on today's paths (move, door, container, stair, "Move party
  here"), taking the actor and the token's own floor; `core/encounter.ts`'s turn helpers; the vision pass skipped when
  nothing it reads has changed; `state/upgrade.ts` with its fixtures; the `table` key, classified; and, if you say yes,
  sealing Players view (decision 25).
- **Cut line**, if it runs long: the amber ring moves to release 3. The leaks and the End fix never move.
- **New tests:**
  - `tests/permissions.test.ts`: one case per row of the tables in 2.2 and 2.4 (actor, phase, token kind, hold).
  - `tests/campaign-upgrade.test.ts`: the lost-party and mid-fight fixtures of section 5. They fail today
    (`app.ts:1252`, `:1188`).
  - A unit case: a roster edit's commit runs no vision pass.
  - `e2e/play.spec.ts`, first half: only the current character moves; "Not your turn" on doors and stairs out of turn;
    Done; End with a wolf standing; removing every combatant; Find on a hidden turn; no hidden squares; Snap off and hex.
- **Kept unchanged:** `e2e/ui.spec.ts:55-77`, `e2e/trail.spec.ts:39`, `e2e/stream.spec.ts:202` and `:317`,
  `tests/keys.test.ts:10` (no new key), `e2e/surfaces.spec.ts:190` and `:333` (the roster's five rule pills),
  `e2e/move.spec.ts`, `e2e/world.spec.ts:206`, `e2e/continuity.spec.ts:20-37`, the hooks `partyPos` and `moveParty`.
- **Waits on:** item 4, item 5, the castle (its single-hop `takeLink` and `partyStart`), framework release 1
  (`ensureDefaultToken`, `canWalkTo`, the refusal words).

**Release 1b. Each player moves their own character (M).**
- **Your words:** "each player can control their character freely unless initiative is engaged in which case they can
  move on turns."
- **Acceptance:** on the three regression maps, in Players view on desktop and phone:
  - after Split up, each character walks on its own through open doors and up stairs, one floor per step, never through
    a wall; a shared landing offers both ways;
  - Gather folds them back; the next map the party arrives on opens the campaign's way;
  - Start uses the characters already standing; End leaves them where they stand when the fight began apart;
  - each character sees by its own light and darkvision, and Split up on a dark map shows what the marker showed;
  - on Vallaki with four characters apart, a move's vision pass takes no longer than one marker's does today (671 ms in
    the reader's browser);
  - six characters apart on the village keep the valley frame at 70 calls and 300,000 triangles or fewer;
  - at 390x844 the party chip, the turn bar and Done overlap nothing, and every control is at least 44 px;
  - with the party together, the three maps' frames are pixel-identical to main with equal draw calls.
- **Contents:** together and apart (Split up, Gather, the campaign's last choice); the party bar and your party-wide
  controls when apart (2.2); every character takes stairs, through the castle's `enteredRoute`; characters see by their
  own light and darkvision (the row's `light`); every room walked through becomes explored; Start uses the characters
  already standing; the sight index (identical masks, Vallaki with six characters from 2,945 to 450 ms in the reader's
  run); characters folded into the `&` at valley zoom, so six of them cannot break the valley's 70-call limit (today 88
  calls with six, measured); the roster's new fields, as one card per character on a phone; the neutral starting roster
  (decision 22); the together marker's darkvision (decision 26; with the neutral roster it changes nothing on a new
  campaign, so the pixel gate holds).
- **Cut line**, if it runs long: the floor chips and the Size column move to release 3. The sight index, the valley
  fold and the phone gate never move.
- **New tests:**
  - `tests/party.test.ts`: split and gather round trip; free squares on floor, reachable and unoccupied; no creature
    moves.
  - `tests/sight-index.test.ts`: identical visible masks with and without the index on Death House, Vallaki, the
    castle's ground floor and the Sheep Chase square, and a count of wall tests instead of a timer.
  - `tests/campaign-upgrade.test.ts`: the apart fixtures of section 5.
  - `e2e/play.spec.ts`, second half: players move characters outside a fight; each character's own light; a character
    takes a stair; a shared landing's two ways; the phone overlap check.
  - A case in `e2e/world.spec.ts`: six characters apart on the village keep the valley frame at 70 calls and 300,000
    triangles or fewer (`e2e/world.spec.ts:310-311`, verified).
- **Change only with your yes** (decision 22): the starting names in `e2e/ui.spec.ts:70`, `:73-74` and `:85`
  (verified: Rogue, Fighter, and the Sheep Chase roster's first name).
- **Kept unchanged:** everything 1a keeps, plus `e2e/stream.spec.ts:60-75` (token figures freed when rebuilt) and the
  castle's `e2e/vertical-links.spec.ts:176` (its words on a shared landing).
- **Waits on:** release 1a.

**Release 2. The Player map, light and safe (M, upper end).** Builds beside releases 1a, 1b and 3.
- **Your words:** "a Player map that could be shown locally without interference of GPU strain."
- **Acceptance**, on your laptop's graphics, against main:
  - with the Player map open on a second screen, the GM screen's frame time during a scripted camera orbit of Vallaki and
    of the Blue Water Inn stays within 5% of the GM screen alone;
  - while the Player map follows a map change, the GM screen never freezes for more than 50 ms;
  - the Player map shows whose turn it is;
  - a listener on the channel sees no hidden token, real creature name, creature hit points, foe row or raw turn order.
- **Contents:** 3.3 and 3.4 above: the filtered players' copy; the separate process with a heartbeat and a "live" chip;
  its own camera with Mirror kept as a choice, and its own floor (3.4); drawing only on change; cheaper pixels; the map
  alone; explored memory loaded on open; only changed tokens updated; door and stair markers inert there (today a door
  click on the display opens the door, probe P9; item 5 already stops it saving); the players' strip and banners; the
  heartbeat's grey chip when the window closes, and a full players' copy when it says hello again.
- **Cut line**, if it runs long: the "hold" and "show once" camera modes and the 1920x1080 cap move to release 4. The
  filtered copy, the separate process, following the turn, drawing only on change and no edge smoothing never move.
- **New tests:** a property test that random states project with no secret (it fails on item 5's projection); a browser
  spec: opened as a separate process it still says hello and draws; in "follow the turn" mode your orbit sends no camera
  message and the Player map draws 0 frames (fails today: mirroring is the default, `app.ts:145`); a door click on it
  changes nothing (fails today; "writes nothing" already holds once item 5 lands; `e2e/display-state.spec.ts:72` holds
  it today only for a campaign switch); the strip shows names and movement left (and players' names once release 1b is in); no edge smoothing.
- **Needs your yes** on the new camera default (decision 19). Four browser tests that pin mirroring then run in Mirror
  mode, with their assertions unchanged: `e2e/stream.spec.ts:254` and `:320`, `e2e/world.spec.ts:554`,
  `e2e/slider.spec.ts:51-69` (`read-player-map-gpu.md` section 4).
- **Waits on:** item 5; its renderer settings in `render/world.ts` wait for 2f-3's claim on that file. Not on release 1
  (4.1): the Player map can be on the TV before the characters split.

**Release 3. Turns you can run (M, upper end).**
- **Your words:** "unless initiative is engaged in which case they can move on turns."
- **Acceptance:** the moment you tap Roll for initiative, nobody on the players' side can move; on Vex's turn she is
  already picked up, Sam moves her, takes a step back, dashes and taps Done; Brom's player cannot move or open a door
  until Brom's turn; removing a ghoul earlier in the order keeps Vex's turn and her spent movement; Pause
  freezes the players' side; on one shared screen in Players view you move a hidden ghoul and pass its turn without
  leaving Players view, and nothing about it is drawn; Previous gives the last turn back with its spent movement.
- **Contents:** Called, Running and Paused in `core/encounter.ts`; the turn kept by token (G02); the automatic pick-up,
  kept through a view flip; Undo step (this turn's steps); Previous restoring the last turn's movement and steps; Dash;
  Delay and Act now; doors and containers within 5 ft on a turn; characters outside the fight frozen, with your toggle;
  Join the fight (a creature placed mid-fight, a character on another floor) and Remove at any time; Roll rolls only what
  is ticked (G01); the roll sheet on a phone; the End sheet; asking before Enter, Back, the Library or travel mid-fight;
  your press-and-hold turn controls in Players view (decision 28); one diagonal rule for the green squares and Measure;
  Pause outside fights too; and, if you say yes and it did not fit in release 1a, sealing Players view (decision 25).
- **Cut line**, if it runs long: Delay and Act now, and the diagonal rule, move to release 5. The turn by token, Called
  and the turn controls never move.
- **New tests:** `tests/encounter.test.ts` (rounds, the three G02 cases, delay, join, the phases, Previous restoring
  movement); a new browser case for Called, Done, Undo step and Dash; a browser case for the turn controls in Players
  view (fails today: a creature cannot be picked there, `app.ts:2173`); a save fixture with a running fight and one with
  a Called fight read by a copy of 0.3.4's code (5.3).
- **Waits on:** release 1b.

**Release 4. The Player map takes the table's taps (M).**
- **Your words:** "the important part is the ability for players to operate the game."
- **Acceptance:** with "Players may move on the Player map" on, a player at a touch monitor, or with the passed mouse,
  walks their character, opens a door in reach on their turn, takes a stair, types their initiative while Called and
  taps Done; the GM screen applies each tap by the players' rules whatever view you are in; Pause stops all of it; you
  undo a player's last move in one tap.
- **Contents:** requests both ways on the channel; `state/link.ts` (the GM screen's own Players view uses it too); one
  save per batch of requests, gathered by a timer, not by your next drawn frame (3.2); rules that take the actor and
  the token's own floor; vision for the mover's floor; your camera and floor left alone; a players' action log with its
  own Undo, kept apart from Undo reveal (which today pops the last reveal, often a room a player walked into,
  `app.ts:1703`, verified); the initiative keypad on the Player map; the Player map's own pointer handling (today the
  display ignores every tap on the map, `app.ts:1905`, verified); a closed or reloaded Player map mid-turn leaving the
  turn as it was.
- **New tests:**
  - `tests/requests.test.ts`: a move through a wall is refused while you are in DM view (fails today, `app.ts:1673-1674`);
    a move on another floor is checked on that floor (fails today: the check reads your floor); a request heard twice
    applies once; an end of turn that has passed is refused; "DM runs" holds.
  - A browser spec: a move from the Player map moves the token on the GM screen; an out-of-turn tap shows "Not your
    turn" there; Pause shows "The DM has paused play"; a player's move undone restores position and movement while Undo
    reveal still undoes only your own reveal.
  - A move on the Player map's floor, while you are on another floor, updates that floor's explored memory in your save
    (fails today: vision runs for your floor only, `app.ts:1447-1450`).
  - A request applied while the GM screen's page is hidden (fails if the batch waits for a drawn frame).
- **Waits on:** releases 2 and 3.

**Release 5. The initiative tracker (M, upper end).**
- **Your words:** "The encounter builder and initiative tracker should be a big piece of this."
- **Acceptance:** you run a Death House fight of four ghouls without leaving the tracker: the ghouls roll once together
  at their block's +2; the players' numbers come in from the keypad; ties are settled; one ghoul takes 7 and later dies
  and leaves the players' order, and the players see "Bloodied", never a number; a surprised ghoul rolls with
  Disadvantage; Vex goes Down, her turn still comes, and both screens say "Down"; the clock moves 6 seconds a round; on
  the hex grid a turn shows its own green cells (in release 8 if the cut line is used).
- **Contents:** the tracker panel (a sheet until release 9 docks it); a small reader of SRD stat blocks (armour class,
  hit points, hit dice, initiative bonus and score, XP, legendary uses); group rolls; surprise; ties; typed hit points
  for creatures; defeated creatures skipped (approval A30); health words (A11); Down for characters; Ready; Clear the
  fallen; the dice and their log; +6 s a round (A17); creature hit points from the card's block (F4); `cr:` rows hidden
  from the roster sheet and read from the stat block instead (F3), but still written, so an older build can still run
  the turn (5.3); the hex grid's own range.
- **Cut line**, if it runs long: the hex grid's own range, Ready and Clear the fallen move to release 8. Typed hit
  points, defeated skipping, health words and the stat block reader never move.
- **New tests:** stat block reading (a ghoul is +2, armour class 12, 22 hit points); the players' turn view with groups,
  Down and defeated entries; seeded dice; the tracker at 390x844 with every control on screen and at least 44 px; a hex
  range case (fails today).
- **Change only with your yes:** a placed dire wolf's hit points, 37 today, pinned by `e2e/ui.spec.ts:131` (verified).
  With hit points from the card's block, the test sets the 2014 rules edition and keeps 37, or reads 22 under 2024.
  `tests/bestiary.test.ts:20` reads the 5.1 table itself and stays as it is.
- **Waits on:** release 3.

**Release 6. The encounter builder (M).**
- **Your words:** the same, for the builder.
- **Acceptance:** from Death House area 29, Encounter here, Run, the players' numbers and Start reach the first turn in
  three taps; four hidden ghouls stand at their slots under their players' names, with the hit points their cards show;
  the meter reads Moderate for four characters at party level 3; the plan survives a reload and never reaches the Player
  map; End shows the XP to announce, or nothing under Milestone.
- **Contents:** section 2.6 in full, plus the party level (one number on the campaign; no level on a character).
- **New tests:** the worked fights in 2.6, with the table read from `gameplay-toolbox.json` so the code cannot drift
  from the SRD; every slot kind in every scene resolves to an SRD id, a module id or a stand-in (0 unresolved);
  cluster and line placement with Large and Huge; plans never in the players' copy; hit points from the card's block in
  the browser (fails today).
- **Waits on:** release 5.

**Release 7. Choose your model (M).** Builds beside releases 5 and 6; the roster row edit is sequenced with them.
- **Your words:** "a selection of character models for players to choose but it's only a game board."
- **Acceptance:** six players pick six looks, on the GM screen or by taps on the Player map; each reads apart from the
  others from straight down and at an angle; figures grow with size; a pick mid-fight costs no movement and rebuilds one
  figure; a row with no model draws today's figure shape, with the same draw calls, and the kit's grain judged on a
  before-and-after pair (3.5: the kit's materials change token pixels, so "pixel-identical" cannot hold).
- **Contents:** section 3.5; tokens drawn through the kit's own `matClone(colour, true)` (today the token path makes raw
  materials, `app.ts:1431`, verified). The neutral starting roster already came in release 1b.
- **New tests:** each look within its colour, triangle and height caps; each look's top-down outline differs from every
  other's by a set margin; old saves draw today's figure; no raw material in the token path; a model pick refused when
  the gallery is not up or locked.
- **Kept unchanged:** `e2e/stream.spec.ts:276` (a camera activation builds no shaders: the fog-exempt flag is a uniform,
  so tokens share the kit's one program) and `:60-75` (figures freed when rebuilt).
- **Waits on:** release 1b, and release 4 for picks on the Player map.

**Release 8. Conditions, legendary and lair (M).** Builds beside release 6.
- **Your words:** the tracker as "a big piece": a fight with a vampire and its spawn runs without paper.
- **Acceptance:** Restrained "until the end of the ghoul's next turn" ends by itself on both screens; a Grappled
  character's turn shows speed 0, which you can override; a legendary creature's uses come back at its own turn; the
  lair entry acts at 20 and players never see it unless ticked; a character's conditions follow it to another map; the
  difficult-ground toggle doubles the cost of each step.
- **Contents:** section 2.7's conditions, legendary and lair; reminders in the order; the difficult-ground toggle; red
  squares for a ranged attack checked from every square the character can reach (queue item 14's suggestion).
- **New tests:** condition expiry; legendary uses; the lair entry; range cases for difficult cost and ranged sight; pips
  only on revealed tokens and no notes on the players' side.
- **Waits on:** release 5.

**Release 9. The GM screen (M).**
- **Your words:** "The DM should have a GM screen."
- **Acceptance:** on a desktop, the tracker docks left, the builder right and the token panel at the bottom; the Player
  map strip holds live or not, open on the TV, camera mode, Players may move, Pause and Curtain; the minimap shows where
  the Player map is looking; on a phone the tracker is a bottom sheet that covers neither the clock nor the minimap
  (today the turn bar overlaps them by 2,226 and 4,320 square pixels, measured); a second DM window on the same computer
  offers to become the Player map instead of a second writer of the save.
- **New tests:** the docked panels, the strip and the minimap wedge; the tracker sheet's phone overlap check (the turn
  bar's own check came in 1b).
- **Waits on:** item 4, and releases 2 and 4 (the strip's controls are theirs), 5 and 6.

**Release 10. Light tokens (M).**
- **Your words:** "without interference of GPU strain", here for a full table of figures.
- **Acceptance:** six characters and twelve creatures add at most 12 draw calls in the test room, on Death House's first
  floor and on the Sheep Chase street (today they add 111, measured, `read-models.md`); six characters apart on the
  village keep the valley frame within its limits without folding.
- **Contents:** all figures in one batched mesh; shared rings; one geometry per look; picking through the batch; a moved
  token updates one entry instead of being rebuilt; the kit shader's lines for batching (`render/materials.ts`).
- **Kept unchanged:** `e2e/stream.spec.ts:60-75` and `:276`; the tap on a base ring still picks a figure
  (`app.ts:2170`).
- **Waits on:** release 7, and the mist edge (2f-5) and item 6's render group, which hold `render/materials.ts`.

**Release 11. The flat Player map (M).**
- **Your words:** "shown locally without interference of GPU strain", for a weak machine or a TV's own browser.
- **Acceptance:** the Player map switches to a top-down flat board; it redraws in under 25 ms on Vallaki; its text is
  at least 18 px; its fog matches the 3-D map's square by square on the three regression maps.
- **Waits on:** release 2. Builds beside releases 9 and 10.

**Releases 12-13. Players' own devices in the room (L, two releases, three if the listener is not already built).**
- **Your words:** "each player can control their character", from their own phone, with no account.
- **Release 12, the room's wifi:** the desktop app's opt-in listener; a join code and QR; a join screen that says what
  failed (a Public network, a hotel network that keeps devices apart, the hotspot fallback); seats with your approval of
  the first claim, a seat holding one or two characters; a players' copy per seat; a Player map drawn by another device;
  "Waiting for the DM", "Reconnecting…", a device away on its turn (2.9) and a version check.
- **Release 13, phones that act:** your own character only, freely outside a fight and on your own turn inside one;
  your own camera; the flat board by default on phones, 3-D by choice; Done, Dash, Delay, Down and initiative on the
  phone; the model pick; your lock and override.
- **New tests:** "That's not your character"; a seat comes back after a reload; you reassign a seat; a phone that drops
  on its turn keeps the turn and its late request is refused; two browser contexts over a test relay (a late joiner's
  first view, a refused move, "DM away").
- **Size, corrected:** the listener, the join code and the join screen are the 1.0 plan's M13 (M to L, with the
  updater that migrates saves), and the launcher is native code that only a reinstall delivers (`docs/DESKTOP.md`,
  verified). Release 12 is one release only if M13 has shipped the listener; otherwise it is two.
- **Waits on:** releases 4 and 11; your yes on the listener, the firewall prompt and one reinstall of the desktop app
  (decision 23); the desktop update channel in the 1.0 plan (M13).

**After this plan, not counted:** the portrait strip and dock (approval A32, L); splitting the party across maps and
fights that survive Enter and Back (A16, M); remote players through the mistLAB link's room (L, after a test with one
invited phone); each character seeing only what it sees (L to XL).

### 4.3 Side by side

| # | Release | Size | Waits on | May build beside |
|---|---|---|---|---|
| — | Two-minute test of the Player map on the mistLAB link | — | — | anything |
| 1a | The party is never lost, and turns work on every grid | M | item 4, item 5, the castle, framework release 1 | map lanes, 2 |
| 1b | Each player moves their own character | M | 1a | map lanes, 2 |
| 2 | The Player map, light and safe | M, upper end | item 5, 2f-3 (`world.ts`) | 1a, 1b, 3 |
| 3 | Turns you can run | M, upper end | 1b | 2 |
| 4 | The Player map takes the table's taps | M | 2, 3 | 5 |
| 5 | The initiative tracker | M, upper end | 3 | 4, 7 |
| 6 | The encounter builder | M | 5 | 7, 8 |
| 7 | Choose your model | M | 1b (4 for Player map picks) | 5, 6 |
| 8 | Conditions, legendary and lair | M | 5 | 6 |
| 9 | The GM screen | M | item 4, 2, 4, 5, 6 | 10, 11 |
| 10 | Light tokens | M | 7, 2f-5, item 6 render | 9, 11 |
| 11 | The flat Player map | M | 2 | 9, 10 |
| 12-13 | Players' own devices | L (two; three without M13's listener) | 4, 11, M13, your network decision | — |

- **In all: fourteen lean releases, fifteen if release 12 must build the listener itself. XL.**
- **The first thing on the TV can be release 2**, before any character splits: it needs item 5 only, not the castle.
- **After release 1b** a table plays the way you describe, on one screen; **after release 3** it can run a whole fight
  there without you flipping to DM view in front of the table. **After release 4** it plays that way with a TV.
- **After releases 5 and 6** the tracker and the builder are the big piece. Release 8 finishes the tracker's rules.
- Against the 1.0 plan's rows (`roadmap-1.0.md` section 3): M9 is releases 1a, 1b and 7; M10 is 3, 5, 6 and 8; M11 is
  2 and 9; M12 is part of 4; M14 is 12 and 13, and release 12 carries M13's listener unless M13 has built it.

---

## 5. What changes in the saved campaign

### 5.1 The changes

Every new field is optional. There is no new token role: item 5's save checker accepts only `party`, `member` and
`creature` (`backup.ts` `stateError` on `296280e`, verified). The fight keeps all its 0.3.x fields, including
`partyPos`, which that checker requires (verified).

| Where | New fields | Release |
|---|---|---|
| A token | `role: 'member'` keeps its value and now means a character's own token in or out of a fight. Its id stays today's `tok-<map>-<character>` (`app.ts:1235`, verified), so a 0.3.x save made mid-fight names the same tokens | 1b |
| A creature token | `hp.temp`, `srdId` (the SRD block behind its numbers), `side`, `defeated` | 5 |
| | `conditions`, `legendary` | 8 |
| | `planId` | 6 |
| A roster row (a character) | `light`, `player` (a label), `present` (at the table tonight), `dmRuns` | 1b |
| | `down` (a board mark; no death-save count, no hit points) | 5 |
| | `model`, `look` (skin, hair, build) | 7 |
| | `conditions` (they travel with the character from map to map) | 8 |
| | `seat` | 12 |
| A combatant | `delayed` | 3 |
| | `group`, `tie`, `surprised`, `ready` | 5 |
| | `arrives` | 6 |
| | `kind` (lair or reminder), `label`, `showPlayers` | 8 |
| The fight | `startedAs` (together or apart) | 1b |
| | `phase` (called, running, paused), `turnOf` (whose turn, by token; `turn` kept in step for older builds), `dashFt`, `steps` (this turn's moves, for Undo step), `spent` (each combatant's movement this round, for Previous) | 3 |
| | `startedAt` (for the clock) | 5 |
| | `planId` | 6 |
| The campaign | `table`: the table settings (apart, players end turns, doors within 5 ft, pause, Player map input, surprise rule, XP or milestone, difficult ground). Class "player" | 1a, growing |
| | `rolls` (the roll log). Class "dm" | 5 |
| | `encounterPlans`, `partyLevel`. Class "dm" | 6 |
| | `seats`. Class "dm"; each phone receives only its own seat | 12 |

No row holds a class, race, level, hit points or death saves for a character: your clarification, and the 1.0 plan's
"After 1.0" list. Each new key gets its class in item 5's list in the release that adds it, so a forgotten one fails
the build (`KEY_CLASS` is checked against every `CampaignState` key, verified on `296280e`), and an import drops any key
the list does not know. The castle's `settledStarts` needs a class too, whichever of item 5 and the castle merges
second.

### 5.2 How old saves keep working

- **Loading stays a merge over a fresh campaign** (`{ ...newCampaign(id), ...saved }`, `app.ts:209-210`, verified).
  Release 1a adds one pure function, `upgradeCampaign`, that runs right there. It never deletes anything.
- **A 0.3.4 save with no fight** loads exactly as today. The campaign's way is "together", so every map shows its marker.
- **A 0.3.4 save in the middle of a fight** loads as running, because `phase` is missing. A missing `startedAs` means
  "together", since every 0.3.x fight began from a marker, so End gathers. Unlike today, it gathers even with a creature
  left on the map.
- **A save that already lost its party** (a map with only creatures) gets a marker at the map's start when the map
  opens: the new `ensureDefaultToken` counts only party and character tokens. Today it gives up on any token
  (`app.ts:1188`, verified).
- **`cr:` roster rows** stay in the save, and the new build keeps writing one per creature kind in a fight, so a
  rollback still finds them: today's `current` needs a roster row for every combatant, or it returns nothing
  (`app.ts:1213-1214`, verified). From release 5 they are not shown and their numbers come from the stat block; from
  release 2 they are not sent.
- **Explored memory is untouched.** This plan adds no explored-memory keys and does not change how it is saved or loaded,
  which keeps it clear of the castle and item 5's disagreement on that format.
- **No new save family is needed.** The desktop rule (`docs/DESKTOP.md`) lets a release that changes saves keep
  `mistlab-idb1-2026-10` when it has a reviewed migration and rollback note and fixture evidence. Release 1a brings both,
  and each later release that adds a field adds its fixture.

### 5.3 An older build reading a newer save (a desktop rollback)

- A map that is apart holds characters and no marker. The old `party` getter returns the first token that is not a
  character, so a creature if one stands there, and only otherwise the first character (`app.ts:1206`, verified); the
  old `ensureDefaultToken` adds nothing (`:1188`). A creature or one character then acts as "the party". Degraded, but
  it loads and throws nothing (inferred).
- The old End deletes every character on the fight's map, including the ones that stood apart before it, and makes a
  marker only if nothing else is left (`app.ts:1249-1252`, verified).
- **A Called fight writes its ticked combatants into `order`** (initiative 0 until rolled). With an empty order the old
  build would show the turn bar with nothing in it, so no End, and its swords button would reopen that empty bar
  instead of the roll sheet: a fight it can neither end nor replace (`ui/encounter.ts:94-95`, `main.ts:451`,
  verified).
- **A lair or reminder entry has no token.** When one is current, the old build's `current` returns nothing and its
  turn bar loses Next and End (`app.ts:1213-1214`, `ui/encounter.ts:95`, verified). The rollback note says: step past a
  lair entry, or end the fight, before rolling back.
- The old Start would add second tokens with the same ids as characters already standing (`app.ts:1235`, inferred). The
  rollback note says so: gather the party before rolling back.

### 5.4 The fixture tests (release 1a, and 1b for the apart rows; each failing first where noted)

In `tests/campaign-upgrade.test.ts`, with invented fixtures in `tests/fixtures/`, never taken from a real profile:

| Fixture | Expected |
|---|---|
| A 0.3.4 save, markers on three maps, no fight | Loads identically; each map opens together. With the campaign apart, the next arrival unfolds four characters onto distinct walkable squares and the other maps keep their markers |
| A 0.3.4 save mid-fight: two characters and a hidden ghoul in the order, and a wolf outside it | The same current turn; players refused on the ghoul's turn. End gives one marker and leaves the wolf. **Fails today** (`app.ts:1252`) |
| A lost-party save | Opening the map adds a marker at its start. **Fails today** (`app.ts:1188`) |
| A new save, apart, lights on rows | Passes item 5's `stateError`. A copy of 0.3.4's `current` and `turnView` reads it without throwing |
| A release-3 save: `turnOf`, a delayed entry | Passes the checker; removing an earlier combatant keeps `turnOf` (added in release 3) |
| A release-3 save with a Called fight | A copy of 0.3.4's turn bar shows End for it (added in release 3) |
| A release-5 save with creatures in a fight | Its `cr:` rows are there; a copy of 0.3.4's `current` returns the creature on its turn (added in release 5) |

---

## 6. Decisions for Matt

Each has a recommended answer. The ones marked **before release 1a** block it.

1. **The order of work** (before release 1a). Run this plan right after item 4, item 5, the castle and framework release
   1, ahead of queue items 6 to 12, with release 2 (the Player map) allowed to start as soon as item 5 lands? *Yes.* It
   carries fixes already approved under items 11, 13 and 14 (N1, G01, G02, the lost party, the hidden squares, the
   ranged line of sight), and it takes over queue item 13 and its design, `docs/ENCOUNTERS.md`, which still assumes the
   marker folds back at End and a two-edition meter (`read-encounters.md` section 2). Your look at the castle unblocks
   release 1a.
2. **Keep the party marker** (before release 1a), with together and apart per map and Split up and Gather, instead of
   retiring it? *Yes.* It keeps travel simple and every save exact. It reverses the "Marching order" row and part of the
   "Split the party" row in `docs/UPGRADES.md:506` and `:490`. It also keeps today's encounter shape instead of
   `docs/ENCOUNTERS.md` section 2.10's new one, which would need a new save family (`read-tests-claims.md` 4b).
3. **New campaigns open apart?** *Together until you have played release 1b once; then apart for new campaigns.* Three
   browser tests then set "together" themselves, with their assertions unchanged.
4. **On one shared screen, may anyone move any character outside a fight?** *Yes.* Seats come with phones.
5. **No distance limit outside a fight, and every room walked through becomes explored?** *Yes.*
6. **Doors and containers outside a fight:** as today (any unlocked one whose marker shows), or only within 5 ft of a
   character? *As today, with a table setting for 5 ft.* In a fight: the current character, within 5 ft.
7. **Characters on the fight's map but not in it:** frozen, with your toggle? *Frozen.*
8. **Roll for initiative freezes the players' side at once?** *Yes.*
9. **The players' Done ends the turn at once,** with your Previous to step back? *Yes,* with a setting that makes you
   confirm.
10. **Hidden creatures never block a player's move** or shape their green squares, and you are told when someone steps
    onto one? *Yes.*
11. **Surprise:** the 2024 rule only (roll with Disadvantage), or follow the app's Rules edition for this one rule?
    *Follow the edition.* The difficulty budget stays 2024 only.
12. **Delay,** labelled as a table rule? *Include it.*
13. **Characters on the board carry no hit points and no death saves,** only a Down mark whose turn still comes? *Yes.*
    That is your "only a game board", and the 1.0 plan already puts characters' numbers after 1.0. Death-save pips
    could come back later as an optional tracker aid if you want them.
14. **Monster hit points:** the block's average by default, rolled per plan? *Yes.*
15. **XP or milestone by default** for Curse of Strahd? *Milestone,* with the fight's XP and each share shown at End
    when you switch to XP. Nothing is stored per character.
16. **The builder's level:** one party level on the campaign, and no level on a character? *Yes.* The 2024 budget is
    per character at that level, times the characters at the table tonight.
17. **Difficult ground:** your toggle on the current turn only, or also the 39 rooms in 10 scenes that the maps already
    flag, and snow, ice, shallow water and marsh floors (`core/schema.ts:15-16`, counted)? *The toggle now; the flags as a
    table setting, off by default,* because they change the green squares on those maps.
18. **The hex grid:** turn moves checked on the squares underneath until release 5 gives it its own range? *Yes.*
19. **The Player map's camera** (release 2): its own by default (following the turn, or the party), with Mirror my camera
    kept as a choice? *Yes.* This is the change that removes the graphics strain.
20. **The Player map's first look:** the light 3-D map (release 2), with the flat board as a choice in release 11? The 1.0
    plan leaned to a flat top-down view first. *Light 3-D first*: it keeps the look you built and meets the 5% gate; the
    flat board follows for weak machines and phones.
21. **Send players a figure key** instead of a creature's bestiary id? *Yes,* in release 2.
22. **A neutral starting roster** (before release 1b): Character 1 to 4, speed 30, Medium, no darkvision, reach 5,
    no range and no initiative bonus, instead of Fighter, Rogue, Cleric and Wizard with their class numbers
    (`state/campaign.ts:105-108`, verified); and retire the class-named model variants (`manifests/characters.json`,
    `pc-kit`) in release 7? *Yes,* in release 1b, where the party bar first shows the names. Your clarification asks
    for it. `e2e/ui.spec.ts:70`, `:73-74` and `:85` assert the old names and change with your yes; saved campaigns keep
    their rows.
23. **Players' own devices:** the room's wifi through the desktop app first (an opt-in listener, a firewall prompt, one
    reinstall), the mistLAB link's room for remote players after this plan? *Yes.* It reverses the "Player Display and
    phones over the LAN" and "Player phones that act" rows (`docs/UPGRADES.md:492-493`).
24. **Claiming a character on a phone:** you approve the first claim, and the seat comes back by itself after that?
    *Yes.*
25. **Seal Players view** (only the sealing part of item 22) in release 1a, since players will now touch the screen?
    *Yes,* with a gesture for you to get back (the same press and hold as decision 28); it moves to release 3 if
    release 1a runs long. Today Library, World map, Back, the floor picker and the DM tab stay live in Players view
    (ease-of-use audit, finding 3).
26. **The together marker's darkvision:** the party's best instead of today's 0 (`app.ts:1202`, verified), in release
    1b? *Yes,* with before-and-after pictures for saved campaigns, since their dark maps will look different to players.
    With the neutral starting roster a new campaign does not change.
27. **Version:** release 1a as 0.4.0, since players operating the game is a new step? *Yes,* or the next number in
    order if you prefer.
28. **Your turn controls in Players view** (release 3): a press and hold on the turn bar that lets you move the current
    creature (a hidden one without drawing anything), pass its turn and pause, without flipping to DM view in front of
    the table? *Yes.* Without it, every creature turn on one shared screen shows the table your screen.
29. **Reach, range and an initiative bonus on a character** stay as optional board numbers under More, with neutral
    defaults, rather than going away? *Keep them.* They are today's fields, so saves load as they are; the red squares
    need reach and range; the bonus only matters when the app rolls for a player who gave no number. The roster's five
    rule pills (`e2e/surfaces.spec.ts:333`, verified) stay; the new fields get plain headers.

---

## 7. Risks

| Risk | Why it matters | What the plan does |
|---|---|---|
| **Vision cost on town maps** | It runs on the main thread on every save (`app.ts:1600-1602`, verified). Vallaki takes 0.67 s with one marker, 2.0 s with four characters and 2.8 s with six (measured) | Release 1a skips passes that change nothing; release 1b's sight index (identical masks; 2,945 to 450 ms with six in the reader's run), together by default, and a timing gate. A background worker (M) is next if real phones need it |
| **Draw calls** | Each figure is 8 meshes. Six figures take the valley frame from 46 to 88 calls against the test's 70 (measured) | Fold characters into the `&` at valley zoom in release 1b; batch them in release 10 |
| **Release 1a waits on four lanes** | The castle waits on your look; item 5 and framework release 1 were cut by a restart | Pure modules first; the merge order in 4.1; your look at the castle; release 2 (the Player map) does not wait for them |
| **Release 1 was one release in the first draft** | About eighteen changes for one builder | Split into 1a and 1b, each with a cut line; the leaks, the End fix, the sight index and the cost gate never move |
| **A covered or minimised GM screen** | A browser stops drawing a hidden window and slows its timers (inferred); requests applied on a drawn frame would wait, and the 150-ms save timer stretches | Requests are applied as they arrive (3.2); a browser case with the GM screen's page hidden (release 4); Help says to keep the GM screen visible |
| **Two copies of the map on one machine** | The Player map holds its own scene, in memory and on the graphics chip (169 MB of script memory per window on Vallaki, measured) | The map alone in the mist, no streamed neighbours (release 2); the flat board (release 11) |
| **Rolling back to 0.3.x mid-fight** | An older build cannot end a Called fight with an empty order, or pass a lair entry, and loses creature turns without `cr:` rows (5.3, verified in code) | The order filled while Called; `cr:` rows kept; the rollback note; fixtures in releases 3 and 5 |
| **The mistLAB link** | The popup may not open there, and the two windows may not hear each other (`roadmap-1.0.md` section 4, inferred there). An iPad DM gets no Player map window, because `main.ts:465` does not check the popup (verified) | The two-minute test; the Player map belongs to the desktop app until it passes; one screen still plays everywhere |
| **One pointer on one computer** | A tap on the Player map's screen takes keyboard focus from the GM screen (inferred) | Your buttons do not need focus; checked on the laptop in release 4 |
| **Players view is not sealed** | Players at the screen can leave the map or flip to DM view | Decision 25 |
| **Tests that pin today's defaults** | One marker per map, the mirrored camera, the class-named starting roster and a dire wolf's 37 hit points (listed under releases 1a, 1b, 2 and 5) | Defaults kept where they can be; the rest change only with your yes, and those tests then set their mode or edition with assertions unchanged |
| **Save compatibility** | A desktop rollback reads a newer save | Optional fields only; the fixtures; the rollback note (5.3) |
| **The castle and item 5 disagree on explored memory** | Whichever merges second is blocked | This plan does not touch it; castle question 10 orders them |
| **Secrets in the app files** | Your notes ship to every device; the repository is public | The honour system, said plainly in Help |
| **A stray tap on an automatic pick-up** | On a player's turn the first tap is a move | A tap off the green squares does nothing; Undo step |
| **Phones are unmeasured** | No phone has drawn Vallaki yet | The flat board before phones (release 11); a real-device check before release 13 |
| **A builder copying module text** | The repository's rule | Plans hold keys, names and your notes; numbers come from the SRD or you; the copied-text check runs on the stand-in table |

---

## Appendix: how the three designs scored

Each scored 1 to 5 (5 is best; for risk and effort, 5 means least risk or least effort).

| | Table first | Devices first | Rules first |
|---|---|---|---|
| Fidelity to your words | 5 | 3 | 4 |
| How it plays at a real table | 5 | 3 | 4 |
| Risk to maps, tests and saves | 5 | 2 | 5 |
| Effort | 3 | 2 | 4 |
| Fit with multiplayer and 1.0 | 5 | 4 | 4 |
| **Total** | **23** | **14** | **21** |

**Table first, the spine (23).**
- It answers both of your messages in its first three releases: players moving their own characters, a Player map that
  does not strain the graphics, and the table operating the game from that map. The tracker and builder follow at once.
- It plays best at a real table: the party bar, the turn hand-off, Called, Done, Undo step, Pause and players typing
  their own initiative.
- It is the safest: optional fields, the party marker kept, the fight's old fields kept, every pinned test kept.
- Its transport order (same computer, then the room's wifi, then the link) matches your word "locally" and the 1.0 plan.
- Weak spots: fifteen releases with extras; a heavy first release; it builds the fight's states twice (first in the app,
  then in a module). This plan fixes the last by starting the module in release 1a.

**Rules first (21).** The best tracker and builder detail, and the tightest first release. Taken from it:
- the pure fight module from release 1a and the turn kept by token;
- the one save upgrade function and its fixture table;
- the SRD block reader, the stand-in table with its "0 unresolved" test, and the worked difficulty table;
- "at the table tonight", the party bar on phones, Gather's rule, the campaign remembering the last choice, keeping
  today's door rule outside fights;
- conditions on the roster row so they follow a character between maps;
- the Player map running beside the rules work instead of after it.
- It lost points because the Player map arrives sixth and its taps seventh, after your clarification put them at the
  heart.

**Devices first (14).** The best message design, but the wrong first carrier for your table. Taken from it:
- `core/permissions.ts`, the name the repository's own roadmap planned (`docs/ROADMAP.md:430`);
- one interface for every carrier, with the GM screen's own Players view going through it;
- requests applied together once per frame; a player's move never moving your camera or floor;
- hidden creatures never blocking or shaping a player's green squares;
- the up or down choice on a shared landing; "Waiting for the DM" and "Reconnecting…"; a second DM window becoming the
  Player map.
- It lost points because it starts on the mistLAB link's room: every player needs a Claude account, an email invitation
  and internet; the desktop app cannot host it; publishing empties the room; and CI cannot test it. That runs against
  "shown locally" and the "Remote play, hosting, accounts" row (`docs/UPGRADES.md:508`). It also retires the party marker (rewriting four
  pinned tests), migrates every save to a new schema, and makes `partyPos` optional although item 5's checker requires
  it (verified). Its first release packs the link, the filter, the migration, seats and the phone screen into one, which
  is larger than one lean release (inferred).
