# mistLAB encounters: a Baldur's Gate 3-style initiative strip, and an encounter builder and combat tracker on D&D Beyond's level

Design, research, mock-up and build plan. Branch `claude/mistlab-curse-strahd-x6jm13` at e6a1a3b, 4 October 2026. Nothing tracked in the repo was changed. Everything here lives in `scratchpad/encounter/`.

The owner asked: *"I want a Baldur's Gate 3 style initiative tracker atop the screen during an encounter. Encounter builder and tracker like D&D Beyond would be exceptionally valuable."*

## 0. Summary

**What gets built.** Five pieces share one encounter model.

| Piece | What it is | Where it sits |
|---|---|---|
| **The initiative strip** | Rendered portraits in a row across the top. The combatant whose turn it is comes first, larger and lit. The rest follow in turn order, with a round boundary between them. Sides show by colour and by frame shape. HP bars, health marks, condition pips, legendary pips, grouped foes and hidden marks. | Desktop: the top bar's centre slot when it fits, otherwise its own row. iPad: its own row. Phone: a compact row. TV: a large players' version. |
| **The action dock** | Next turn, Previous, Delay, Ready, More, and the active combatant's line (AC, HP field, movement left, legendary uses). It replaces the bottom turn bar, as BG3 keeps End Turn at the bottom. | Bottom centre, within thumb reach. |
| **The tracker panel** | The D&D Beyond layer: every combatant and group member, with editable initiative, HP, conditions, hidden toggles, add, remove, pause and end. | A movable A29 panel on the right; a bottom sheet on phones. |
| **The encounter builder** | Party with levels; a search of 330 SRD monsters plus the module's 174 people and creatures; XP and difficulty under both 2014 and 2024 rules; *creatures of this place*; plans saved per location and key; placing on the map in a formation, hidden; rolling initiative, with the players' own rolls typed in; start, pause, end and an XP award. | A page sheet: three columns on desktop and iPad, tabs on phones. |
| **Portraits** | Each creature's own low-poly figure, and each party member's, rendered once into a small cached image. They are drawn by **the main renderer into a render target**, so each window keeps one WebGL context. | Device-local cache (IndexedDB). Never sent over the channel. |

**Four decisions for the owner.**

1. **Two items come off the "Deliberately not built" list.** `docs/UPGRADES.md` lists *"Portrait initiative strip with rendered figures"*, rejected because *"a second WebGL context on iPad Safari risks context loss"*. It also lists *"Prefabs and saved encounters"*. The owner's request supersedes both lines.
   - The portrait objection is removed by design: portraits come from the single existing renderer.
   - The prototype measured it: 59 portraits rendered twice, with 1 canvas and 0 `webglcontextlost` events (§2.7).
2. **The strip replaces the bottom turn bar's order list.** That changes a shipped feature, which pitfall 15 forbids calling additive. Record it as **A32 "Initiative strip replaces the turn bar" (requested by the owner)** in `docs/APPROVALS.md`, the same way A28 and A29 were recorded. Nothing the old bar did is lost:
   - Next, Previous, End and Find move to the dock.
   - `n` still advances the turn.
3. **A30 needs one nuance.** *"Initiative skips the downed"* must skip downed **creatures**. A character at 0 HP keeps the turn, because that turn is the death saving throw.
4. **The version split.** 0.5.0 already holds seven features, the plan's limit. The recommendation re-cuts it into two versions of seven features each, keeping the order 0.3.0 → 0.4.0 → 0.5.x:
   - **0.5.0 "The initiative strip"**: the strip, portraits, dock, conditions and durations, legendary and lair, HP maths with health marks, and the players' strip.
   - **0.5.1 "Encounter builder and tracker"**: the tracker panel, XP maths, monster search, creatures of this place with saved plans, placement, initiative entry with the roller and log, and start, pause and end with XP.
   - §4 has the steps.

**Prototype.**
- A standalone mock-up in both campaign themes: `proto/index.html`, with HTML, CSS and a little JS, no framework.
- Four sample fights:
  - **Death House**: four ghouls, one still under the earth.
  - **Vallaki**: a brawl with six guards and Izek.
  - **Castle Ravenloft**: Strahd with legendary pips and a lair entry, three vampire spawn (one hidden), and wolves arriving in round 4.
  - **A Wild Sheep Chase street fight**: delayed and readied turns.
- The backdrops are real mistLAB renders of the current build, with the sample fights set up through `window.__mistlab`.
- The portraits are real renders of mistLAB's own figures, made by a harness that imports `bestiary.ts` read-only.
- Screenshots were taken at 1366×768, 1024×768, 390×844 and 1920×1080, then looked at and improved twice (v1 → v2 → v3, §3).

## 1. Research

**Method.**
- WebSearch worked.
- WebFetch reached GitHub and raw.githubusercontent.com only. These were blocked by the egress proxy:
  - dndbeyond.com and its support site
  - foundryvtt.com and foundryvtt-hub.com
  - wiki.theripper93.com
  - roll20.net (app, wiki, blog)
  - owlbear.rodeo pages other than raw store pages
  - nexusmods, fextralife, steamcommunity and forums.larian.com
  - gamerguides, screenrant, modularrealms and arcaneeye
- Claims from blocked sites come from search-engine summaries and are marked *(search summary)*.
- Owlbear store pages were cached earlier in the session from `raw.githubusercontent.com`.
- The rules numbers come from the in-progress books work: the SRD 5.1 and 5.2.1 data in `worktree-wf_646bc177-602-2/app/public/books/`, read-only.

### 1.1 Baldur's Gate 3's turn-order bar

- **Layout.** Turn order is shown as portraits at the top of the screen. *(search summary of gamerguides; eip.gg)*
- **Linked portraits.** Combatants adjacent in the order with the same initiative, or with no foe between them, have intertwined frames. You can switch between linked party members at will, interleaving their moves and actions. *(search summary; Larian forum "shared initiative")*
  - A whole team acts as one shared turn.
  - Linking applies to enemies too.
- **Already acted.** An unfilled arrow means a combatant has not acted; a filled arrow and an hourglass mean it has. *(search summary)*
- **Ally and enemy colours.**
  - Patch 8 gave allied and neutral characters a different portrait border colour in the Combat Turn Order UI. *(search summary of the Fextralife patch page)*
  - Patch 4 added a colourblind setting that covers *frame portraits in turn order*. *(search summary of patch notes)*
- **HP on portraits.**
  - Portraits show HP as a fill. The "Hide Health Bars" mod replaces *"the Turn Order portrait HPs at the top of screen"* with a gradient. *(search summary)*
  - The "Better Topbar" mod adds HP, temp HP and AC for all combatants, pushes the widget closer to the edge, and avoids overlapping other HUD elements at 16:10. Its description calls the vanilla combatant overlay *"one of the few well-designed widgets in the vanilla game"*. *(search summary of CurseForge and Nexus listings)*
- **Interaction.**
  - Clicking a portrait selects that character and its camera. The Dynamic Combat Camera pans to the next active character when a turn ends. *(search summary; pcgamesn, dotesports)*
  - A "Your Turn" notification names the character. *(search summary; Patch 2/3 notes)*
- **No delay, no ready.** BG3 has no way to delay a turn and no Ready action. Players asked for both; the workaround is swapping between linked party members. *(search summary; Larian threads "Let characters delay their turn", "How do you delay turn order?"; screenrant op-ed)*
- **Summons.** In vanilla, summons can act many turns after their caster. The *SummonInitiative Sync* mod makes them share the summoner's turn. *(search summary)*
- **Complaints.**
  - The UI is too small on a TV, with tiny tooltips. *(search summary; Larian threads "UI scaling and font size", console UI overhaul article)*
  - Big battles become *"way too cluttered"* and players asked for smaller combat portraits. *(search summary)*

### 1.2 Foundry modules that imitate it

- **Carousel Combat Tracker** (theripper93, package `combat-tracker-dock`, v5.0.2 for Foundry 14). [repo](https://github.com/theripper93/combat-tracker-dock), [settings strings](https://raw.githubusercontent.com/theripper93/combat-tracker-dock/master/languages/en.json)
  - **Lineage and docking.** It is *"Inspired by games such as Solasta and Baldurs Gate 3"*. It opens automatically while a combat runs, collapses Scene Navigation, and docks to the top. It succeeded Combat Carousel, abandoned at V11.
  - **Layout settings.** Carousel Style (centred, left, none). Position (horizontal, vertical, floating). Alignment. Overflow Style (hidden, scroll, shrink portraits). Carousel Size (tiny to XXX-large). Roundness.
  - **Portrait settings.** Portrait Aspect Ratio (square, portrait, long). Actor or token image. Portrait Background. Player Border.
  - **What each portrait shows.** Show Initiative on Portrait. Show Disposition Color (ally or enemy border). Hide Defeated. Bars Placement and attribute bars. Display Name (always, by token, or by ownership).
  - **Hiding information.** Tooltip Attributes. Show Descriptions (none, owner, everyone). **Hide Enemy Initiative**. **Hide Until First Turn**. Hide Conflicting UIs.
  - **What players see.** Hovering shows GMs and owners full information; other players see only *name, initiative and status effects*. *(search summary of the wiki)*
  - **Complaints.**
    - Very high-resolution actor images *"can cause noticeable lag"*.
    - Rapid Next clicks make the complex animation *"glitch out"*. *(search summary of the wiki)*
    - [#74](https://github.com/theripper93/combat-tracker-dock/issues/74): *Carousel visible to players before combat starts*.
    - [#89](https://github.com/theripper93/combat-tracker-dock/issues?q=is%3Aissue+hidden): *"Hide until first turn" no longer works with V14 Levels*.
    - #77: overlaps the dnd5e 5.2 calendar.
    - #85: landscape portraits crop strangely.
    - #45: the next-turn animation looks wrong.
  - **In-person play.** [#70](https://github.com/theripper93/combat-tracker-dock/issues/70) asks for in-person play: on a player-facing monitor *"there is never any mouse movement over the Display browser window"*, so tooltips never appear. The reporter wants names and health estimates shown under the portraits all the time.
- **Combat Carousel** (archived Sept 2024). [wiki](https://github.com/death-save/combat-carousel/wiki)
  - Cards show the portrait, initiative and health bar.
  - Hover adds the name, value, badges and property overlays.
  - Controls step turns and rounds; an overlay shows the encounter and round.
- **Simple Combat Bar** ("a Baldur's Gate 3 style turn-order bar"). [repo](https://github.com/IainFielding/Simple-Combat-Bar)
  - **Order and size.** *"the combatant acting now comes first, then everyone still to act this round, a divider for the next round, then those who have already acted"*. Portrait cards or medallions *"shrink to fit a crowded fight, and the bar scrolls sideways"*.
  - **Health.** *"Portraits fill with blood as hit points are lost"*. Players see exact HP for their own characters; for enemies, *"just how wounded they are (healthy, bloodied, down)"*.
  - **Turn controls.** Action, bonus action and reaction pips. An End Turn button below the bar for the owner and the GM.
  - **Late arrivals.** A late-arriving creature is hidden, *"its turns are skipped, and players don't see it. You see it greyed out, with the round it arrives in"*.
  - **Hover.** HP, AC, speed, spell DC, passive Perception, and effects with time left.
- **darsh-dnd-ui** (French, Foundry 14). [repo](https://github.com/Darshyne/darsh-dnd-ui) A BG3 HUD: action bar, party column and an *initiative frieze* at the top. It reads turn budget and movement from the `dnd5e-combat` engine instead of computing them, and *"replaces BG3 Inspired HUD, Party HUD and Carousel Combat Tracker"*.
- **Side Initiative's combat dock.** [repo](https://github.com/WesselvanGils/side-initiative) A top-of-screen dock for the 2014 DMG side-initiative variant. Each side's commander portrait sits *"facing each other inside a fantasy frame, with the current round between them"*, with a glow sweep when the turn passes to the other side.
- **Monk's Combat Details.** [repo](https://github.com/ironmonk108/monks-combat-details)
  - Enemies are *"not revealed in the combat tracker until they've had their first turn"*; defeated enemies hide.
  - Turn and next-up alerts with sounds.
  - The screen pans to the controlled token at turn start; the current combatant is auto-selected for the GM.
  - A combat round message; a combat CR display.
- **Hidden Initiative.** [repo](https://github.com/sfuqua/fvtt-hidden-initiative) Shows *"?"* instead of monster initiative values and keeps *"the final initiative order ambiguous until a full round has completed"*.
- **Foundry core leak.** [#8265](https://github.com/foundryvtt/foundryvtt/issues/8265): players could **ping any combatant in the tracker** and learn the position of tokens they could not see. `_onPingCombatant` had *"no check for whether the player could actually see that token"*. Fixed in V10.

### 1.3 D&D Beyond: Encounter Builder, combat tracker and Maps initiative

- **Party setup.** *(search summary of the DDB tutorial post 1135)*
  - The default is 4 characters of 5th level.
  - *Manage Characters* offers presets of 4 characters at levels 1, 5, 11 or 17, or pulls the characters of one of your campaigns, whose levels set the average party level.
  - *+ Add Character* and a level dropdown per character.
  - The encounter has a name field.
- **Monster search.** Filters for Monster Type, Environment, Source Book, Alignment, Homebrew, Challenge Rating and Size. Further filters cover AC, average HP, condition and damage immunities, **Lair Status**, **Legendary Status**, subtype, movement type, resistance, save and skill proficiency, sense and vulnerability. Sorting is by name, type, size, CR or difficulty. *(search summary of the Encounter Builder beta pages)*
- **Difficulty (2014 rules).**
  - Total XP sums the monsters; adjusted XP applies the DMG multiplier, x1 to x4.
  - The label is Trivial, Easy, Medium, Hard or Deadly: the highest party threshold the adjusted XP reaches.
  - Party size shifts the multiplier: fewer than three characters use the next higher, six or more the next lower.
  - *(search summary; [Basic Rules 2014, Building Combat Encounters](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/building-combat-encounters))*
- **2024 rules.** *"There isn't a 2024 Encounter Builder on D&D Beyond; the Encounter Builder still uses the 2014 rules."* The 2024 rating lives in the Maps VTT: *"an encounter difficulty rating based on the updated 2024 Dungeon Master's Guide"*. DMs fill the gap with Kobold+ Fight Club, Shieldmaiden and AideDD. *(search summary; [DDB forum "Encounter Builder 2024"](https://www.dndbeyond.com/forums/d-d-beyond-general/d-d-beyond-feedback/215302-encounter-builder-2024?page=3); [char-gen 2026 roundup](https://char-gen.com/blogs/best-dnd-encounter-generators-2026))*
- **Group initiative.** Adding the same monster several times gives each its own initiative. Raising a monster's count with +/- makes *"all monsters of that sort use the same initiative roll"*. *(search summary)*
- **Combat tracker.**
  - Initiative is auto-rolled from the sheet or stat block, or entered by hand.
  - The order shows names, art, AC and speed.
  - Clicking a monster shows its abilities, and clicks roll checks and saves into the Game Log.
  - HP, damage and healing are managed from the tracker.
  - A reviewer's verdict: *"more like an initiative tracker with some easy-to-reach rolls … the DM still has to track all of the combat"*. *(search summary)*
- **Maps initiative.** *(search summaries of the DDB posts "Roll for Initiative! Combat Tracking Comes to the Maps VTT" and "Monster Stat Blocks and Hit Point Tracking Come to Maps", and the support article "Combat Encounters on Maps")*
  - *Add All Tokens*; Auto Initiative per side; Start Combat; *Remove From Combat* keeps the token on the map.
  - **The order shows to players *"as image flags along the top of the screen"*.**
  - A hidden token *"won't be visible from the player-facing Initiative order"*. **Advancing to a hidden creature *"will leave the player-facing Initiative Order on the monster immediately prior, to not reveal the hidden creature"*.**
  - *"Hidden monsters will not be considered for renaming multiples of the same monster"*, so player-side numbering never betrays hidden ones.
  - 2026 changelog: bloodied and dead effects at 50% and 0% HP, hideable for players; AC on monster tokens during combat; condition icons on tokens (ITERATIONS N2).
- **Complaints** *(search summaries of DDB forum feedback threads)*.
  - "Half-baked": no End or Archive Encounter, no renaming, no folders per campaign.
  - Allied or neutral NPCs cannot be added without affecting the challenge.
  - Searching and building take two windows in Maps.
  - Saves sometimes fail.
  - Mid-combat adds need search.
  - From FEATURES.md: the stat block covers the initiative tracker; no condition durations.

### 1.4 Roll20 Turn Tracker

- **Turn order.** Tokens are added to the turn order. Custom items can carry a *round calculation*, the usual way to fake a round counter. *(search summary; Roll20 wiki "Turn Tracker", forum "Round counter in the turn order")*
- **Hidden tokens.**
  - A token on the GM layer does not appear in the players' tracker, and its name is greyed for the GM.
  - GMs ask for **hidden custom items**, such as a dragon's breath recharge, and resort to hidden tokens. *(search summary; forum "Hidden (GM-Only) Custom Turn Order items")*
- **Known leak.** The turn outline showed for players on GM-layer hidden tokens (PITFALLS 9, [forum](https://app.roll20.net/forum/post/12253465/turn-order-yellow-outline-showing-for-players-on-gm-layer-hidden-tokens)).

### 1.5 Owlbear Rodeo and other trackers

- **Owlbear Rodeo extensions** (store pages via raw.githubusercontent).
  - **Initiative Tracker** (official): *"a basic initiative tracker with a shared view for you and your players"*. You add a selected character, click the number to reorder, and use an arrow to advance.
  - **Pretty Sordid**: token images in the list, a sort button, a round counter, removal from the list, and "checkbox" initiative. Open requests include current-turn label highlighting (#20), mass add (#18) and "token in turn order is too big" (#17).
  - **Stat Bubbles for D&D**: HP, max, temp HP and AC bubbles; a per-token setting to hide stats from players; name tags *"that will never overlap with health bars"*; segmented enemy health bars for players; inline maths where *"type +6 … -6 and press Enter"*.
  - **Game Master's Grimoire**:
    - Groups, including a **reserve group "not yet part of the initiative order"** activated later.
    - Roll initiative for a whole group.
    - A **"Player Preview"** of what players will see.
    - **HP Bar Segments**: *"when set to "2" the HP Bar differentiates between 3 states: Full HP, less than half HP, and 0 HP"*.
- **Improved Initiative** ([GitHub](https://github.com/cynicaloptimist/improved-initiative); search summary): Player View in another window. Holding Alt adds a combatant **without revealing it**. Enemy HP shows as a rough estimate. Several combatants can be selected for the same damage or tag. Keyboard shortcuts.
- **Shieldmaiden** ([GitHub](https://github.com/HarmlessKey/Shieldmaiden); search summary): live initiative for players. *"A hidden entity is part of the initiative rotation, but it will not show up on the screen the players can see"*. Issue #21: *"show XP at encounter end"*.
- **Initiative Master** (itch.io; search summary): controller window plus TV tracker windows. *"whichever character's turn it is being highlighted by their character tile being larger"*.
- **Encounter+** (iPad; search summary): mirrors a player-facing view with the initiative order to a TV, *"without your notes"*. It fixed *"a bug where images for hidden combatants were still shown on the external screen"*.
- **dnd-battle-tracker** ([GitHub](https://github.com/Paul-Ladyman/dnd-battle-tracker)): offline DM core. Conditions with how long they have been applied. It makes *"it obvious when conditions … have been applied"*. Battles save and load.

### 1.6 Encounter maths, both rule sets

- **2014.**
  - **Thresholds.** Per-character Easy, Medium, Hard and Deadly thresholds by level (Basic Rules 2014, *Building Combat Encounters*): level 1 is 25/50/75/100 … level 20 is 2,800/5,700/8,500/12,700. The full table is in `proto/data.js`.
  - **Multiplier.** x1 for 1 monster, x1.5 for 2, x2 for 3–6, x2.5 for 7–10, x3 for 11–14, x4 for 15 or more.
  - **Party size.** A party of fewer than three uses the next higher multiplier; six or more use the next lower, down to x0.5 and up to x5.
  - **Difficulty.** The highest threshold that the adjusted XP reaches.
  - **Licence.** These thresholds and multipliers are *not* in SRD 5.1. SRD 5.1 has only "Experience Points by Challenge Rating". mistLAB would ship them as a numbers-only table in code, as open tools do. **Owner to confirm** (§4, risk).
- **2024.**
  - The XP budget per character is low/moderate/high by level: level 1 is 50/75/100 … level 20 is 6,400/13,200/22,000. You multiply by the number of characters, sum across mixed levels, and spend monster XP up to the budget. There is no multiplier.
  - The *Troubleshooting* guidance: *"If your encounter includes more than two creatures per character, include fragile creatures that can be defeated quickly"*.
  - **Source:** **SRD 5.2.1, Gameplay Toolbox, "Combat Encounter Difficulty"** (CC BY 4.0). The table is in the books data already (`srd-5.2.1/p/gameplay-toolbox.json`).
  - 2024 stat blocks give *"XP 10,000, or 11,500 in lair"*; 27 SRD 5.2.1 monsters have a lair XP.
- **The two rule sets can disagree sharply.**

| Fight | Foes | Raw XP | 2014 adjusted | 2014 label | 2024 budget (low/moderate/high) | 2024 label |
|---|---|---|---|---|---|---|
| Death House, 29 Ghoulish Encounter | 4 ghouls | 800 | 1,600 (x2) | **Deadly** | 600 / 900 / 1,600 (4 × L3) | **Moderate** |
| Vallaki square | 6 guards, Izek as SRD Veteran | 850 | 2,125 (x2.5) | **Deadly** | 1,000 / 1,500 / 2,000 (4 × L4) | **Low** |
| Castle Ravenloft K8 | Strahd as SRD Vampire, 3 vampire spawn | 15,400 (16,900 with lair XP) | 30,800 (x2) | **Deadly** | 6,500 / 10,000 / 13,000 (5 × L9) | **Beyond high** |
| WSC square | 4 bandits, 1 tough | 200 | 400 (x2) | **Trivial** | 1,000 / 1,500 / 2,000 (4 × L4) | **Low** |

  This disagreement is why the builder shows the chosen edition prominently and the other in one line. EN World threads question whether the 2014 multiplier overstates difficulty.

- **Summons.**
  - SRD 5.1 summoning spells say *"Roll initiative for the summoned creatures as a group, which has its own turns"*.
  - SRD 5.2.1 summons *"share your Initiative count, but … take [their] turn immediately after yours"*: Giant Insect, Summon Dragon, Animate Objects.
  - The tracker follows the fight's edition.
- **Legendary actions and lair.**
  - The uses come from the stat block: *"can take 3 legendary actions"* (5.1) and *"Legendary Action Uses: 3 (4 in Lair)"* (5.2.1). They are regained at the start of the creature's turn in both editions.
  - Curse of Strahd's lair actions act on initiative count 20, losing ties.

### 1.7 What players and DMs praise and complain about

| Theme | Praise | Complaints | What mistLAB does |
|---|---|---|---|
| **Glanceable order** | BG3's bar is *"one of the few well-designed widgets"*. Carousel gives *"clear visual cues for the current turn, upcoming turns, and past turns"*. Larger tile for the current turn (Initiative Master). | Big battles *"way too cluttered"*; UI too small on a TV. | Grouped foes with a count. Overflow chip. A TV size class. Slim mode when a token is underneath. |
| **Portraits** | Videogame feel. | Lag from high-resolution actor images (Carousel). | Small cached renders, about 10 KB each (measured), drawn once. |
| **Hidden information** | Shieldmaiden's hidden entities; Improved Initiative's add-without-reveal. | Carousel visible before combat (#74). Hide-until-first-turn broke (#89). Foundry ping leak (#8265). Roll20 turn outline on GM-layer tokens. mistLAB bug 4. Encounter+ showed hidden combatants' images on the external screen. | One projection function. Hidden entries never leave the DM window. The players' *now* holds on hidden turns (DDB). Numbering ignores hidden foes (DDB). No foe initiative numbers (Hidden Initiative). Players' portrait taps frame only visible tokens (#8265). |
| **In-person** | TV trackers (Initiative Master, Shieldmaiden, Encounter+). | Tooltips never appear on a TV (Carousel #70). | The TV shows names and health words on every tile, and condition words on the active one. |
| **Health** | Health Estimate and HP Bar Segments: full / below half / 0. | Exact HP leaks to players (PITFALLS 26). | DM: bars and numbers. Players: a blood fill plus *Bloodied* and *Down* only (A11). |
| **Setup speed** | DDB's one place to build and run. | DDB builder *"half-baked"*: no rename, no folders, two windows, no allies without changing difficulty, saves fail. FGU and Foundry setup sprawl (PITFALLS 24). | Creatures of this place. Plans saved per location and key. Allies that do not change the maths. Run a plan from its key in ≤ 3 taps. |
| **Taps during play** | Stat Bubbles' inline `+6`/`-6`. GMG's group roll. | DDB's tracker leaves the DM *"to track all of the combat"*. | Next is 1 tap or `n`. The HP field takes `-7`. Group rolls. A keypad for players' rolls. Everything ≤ 2 taps mid-fight. |
| **Rules gaps** | — | DDB builder stuck on 2014. No condition durations (DDB Maps). BG3 has no delay or ready. Summons act far from their caster (BG3). | Both editions. Durations (0.5.0). A Delay shelf and a Ready badge. Summons follow the edition (2024: right after the caster, linked). |
| **Motion** | — | Carousel's complex animation glitches on rapid Next. | State-driven render. Each change uses a 150 ms CSS transform, and repeated Next presses never queue animations. |
| **Panels over panels** | — | DDB's stat block covers the tracker. Carousel overlaps the calendar (#77). | The card opens below the strip and never covers it. The strip and tracker are A29 panels with saved positions. |

### Sources

- **Fetched.**
  - [Simple Combat Bar](https://github.com/IainFielding/Simple-Combat-Bar)
  - [Carousel Combat Tracker repo](https://github.com/theripper93/combat-tracker-dock)
  - [Carousel settings strings](https://raw.githubusercontent.com/theripper93/combat-tracker-dock/master/languages/en.json)
  - [Carousel issues](https://github.com/theripper93/combat-tracker-dock/issues?q=is%3Aissue): [#70](https://github.com/theripper93/combat-tracker-dock/issues/70), [#74](https://github.com/theripper93/combat-tracker-dock/issues/74)
  - [Combat Carousel wiki](https://github.com/death-save/combat-carousel/wiki)
  - [darsh-dnd-ui](https://github.com/Darshyne/darsh-dnd-ui)
  - [side-initiative](https://github.com/WesselvanGils/side-initiative)
  - [Monk's Combat Details](https://github.com/ironmonk108/monks-combat-details)
  - [fvtt-hidden-initiative](https://github.com/sfuqua/fvtt-hidden-initiative)
  - [Foundry #8265](https://github.com/foundryvtt/foundryvtt/issues/8265)
  - [Pretty Sordid issues](https://github.com/SeamusFinlayson/initiative-tracker/issues?q=is%3Aissue)
  - [dnd-battle-tracker](https://github.com/Paul-Ladyman/dnd-battle-tracker)
  - [Improved Initiative](https://github.com/cynicaloptimist/improved-initiative)
  - [Shieldmaiden](https://github.com/HarmlessKey/Shieldmaiden)
  - Owlbear store pages: [Initiative Tracker](https://raw.githubusercontent.com/owlbear-rodeo/initiative-tracker/main/docs/store.md), [Pretty Sordid](https://raw.githubusercontent.com/SeamusFinlayson/initiative-tracker/main/docs/store.md), [Stat Bubbles](https://raw.githubusercontent.com/SeamusFinlayson/Bubbles-for-Owlbear-Rodeo/master/docs/store.md), [Game Master's Grimoire](https://raw.githubusercontent.com/kamejosh/owlbear-hp-tracker/master/docs/store.md)
  - Condition emblems from [game-icons](https://github.com/game-icons/icons), CC BY 3.0
- **Search summaries only** (the proxy blocked the pages).
  - Baldur's Gate 3: eip.gg tips; gamerguides on surprise, rounds and initiative; Larian forums on shared initiative, delaying, and UI scaling and font size; Fextralife Patch 8; patch 4 notes; *Better Topbar* on [CurseForge](https://www.curseforge.com/baldurs-gate-3/mods/better-topbar) and Nexus; *Hide Health Bars*; *SummonInitiative*; screenrant on the missing Ready action.
  - D&D Beyond:
    - tutorial 1135
    - Encounter Builder beta and feedback threads
    - *Encounter Builder 2024*
    - *Roll for Initiative! Combat Tracking Comes to the Maps VTT*
    - *Monster Stat Blocks and Hit Point Tracking Come to Maps*
    - support article *Combat Encounters on Maps*
    - *Mid-Year Update: 2026 Development Roadmap*
  - Roll20: wiki *Turn Tracker*; forum threads on round counters and hidden custom items.
  - Others: Initiative Master on itch.io; Encounter+ on the App Store; [char-gen 2026 encounter-builder roundup](https://char-gen.com/blogs/best-dnd-encounter-generators-2026); EN World *Encounter Building: Multiplier or No Multiplier*; [Basic Rules 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/building-combat-encounters).
- **Rules data.**
  - SRD 5.1 and SRD 5.2.1 as converted by the books work (CC BY 4.0).
  - Gameplay Toolbox, *Combat Encounter Difficulty*.
  - Monster stat blocks for every number in the mock-up.

## 2. Design

### 2.1 Principles for a physical table

1. **The table looks at the strip; the DM's hands use the dock.** The strip is read at arm's length and across the room. The dock is where the thumb is. BG3 splits them the same way: turn order at the top, End Turn at the bottom.
2. **Glance, then touch.**
   - Everything needed to run the current turn is on screen without opening anything: who acts, who is next, their AC, HP and movement left, conditions, and legendary uses left.
   - Everything else is one tap away in the tracker panel or the stat-block card.
3. **Two taps or fewer mid-fight** (PITFALLS 24). Next is 1 tap or `n`. HP is 2 taps plus typing. A condition is 2. Delay is 1. Reveal is 1.
4. **Nothing DM-only reaches the players' side.** Every players'-side surface is built from one projection (§2.5). This covers Players mode, the Player Display, and later the LAN display.
5. **Bookkeeping only** (PITFALLS 25).
   - Players roll their own dice and the DM types the result in.
   - mistLAB rolls only for monsters, privately.
   - Nothing is applied automatically except durations, legendary resets and the clock.
6. **One camera authority** (PITFALLS 30). The strip never moves the camera on its own. It only adds an inset that the existing frame and follow moves respect.

### 2.2 The strip: anatomy

Left to right (`shots/v3/desktop-*-dm.png`):

| Element | DM | Players (Players mode, TV) |
|---|---|---|
| **Grip** | A29 panel handle: drag it anywhere, double-tap to fold, saved per device class. | — |
| **Round chip** | *Round 3* and the seconds since combat began, *12 s in* (A17: six seconds per round). Tap: pause, end. | *Round 3* and the place name. |
| **Now tile** | First and 1.45× larger: 78×98 on desktop against 54×68. Candle glow (`--glow`). Name under it. | *NOW* tag. Name in 26 px on TV. Health word. |
| **Ahead** | Everyone still to act this round, in order. | Same, minus hidden combatants. |
| **Round boundary** | A vertical *Round 4* tab where the order wraps. | Same. |
| **Already acted** | Those who acted this round; they act again next round. | Same. |
| **Waiting shelf** | Delayed combatants behind a dashed rule, under a *Waiting* label. | Delayed party members only. |
| **Tools** | Tracker panel (☰), fold (⌃). | — |

**On each tile.**

| Element | DM | Players |
|---|---|---|
| Portrait | Rendered figure on a side-tinted ground. | Same. |
| Side cue | Colour **and shape**: allies square, enemies a shield point, neutrals clipped corners (§2.2.1). | Same. |
| Initiative | Number badge, top left. | Not shown (Hidden Initiative): order is enough. |
| Health | A 5 px HP bar: green, amber when hurt, red when bloodied (at or below half), grey when down. | A **blood fill** rising from the bottom (BG3 and Simple Combat Bar), plus a bloodied drop or down skull and the word *Bloodied* or *Down* (A11). Never a number. |
| Conditions | Up to 3 pips (20 px; 16 px on phones) plus *+n*, with concentration in violet (§2.2.2). | Same pips on revealed tokens. Words on the now tile. |
| Legendary | Gold diamonds above the tile; hollow when spent. | — |
| Group | Stacked card, *×4* count, one mini bar per member (hollow = hidden). | *×2*: visible, standing members only. |
| Hidden | 50% opacity, dashed outline, a wax seal with the invisible emblem (the theme's one DM-only motif). | Absent. |
| Lair action | A castle tile at 20 with a seal. | Absent unless ticked *Show players*. |
| Late arrival | Greyed, with *Round 4* on it, skipped until then. | Absent until it arrives and is revealed. |
| Delayed | Hourglass badge, on the shelf. | Party members only. |
| Readied | Crossbow badge with the trigger in the card. | Party members only. A readied foe is a secret. |
| Death saves | ✓✓✓ / ✗✗✗ pips in the card and dock. | Pips under the name: the players' own dice. |
| Summoned (2024) | Docked right after the summoner, chain-linked. | Same once revealed. |

#### 2.2.1 Side cue without colour

Shape carries the side, so colour-blind readers and the coming colour-blind palette option (0.7.0) never depend on hue.

| Side | Frame | Campaign of Strahd colour | Sheep Chase colour |
|---|---|---|---|
| Ally | square corners | steel blue `#7fb2e5` | `#2f6fa8` |
| Enemy | shield point at the bottom | blood rose `#e0606e` | `#b0303e` |
| Neutral | clipped corners | stone `#b9b2a3` | `#8a7f6a` |

- The *now* glow is candle amber (CoS) or brass amber (WSC). The neutral colour is deliberately not amber, so it never reads as "now".
- Party members keep their sheet colour on their figure's clothes, where it is already used on the map.

#### 2.2.2 Pips and legibility

PITFALLS 19 and 20 set the limits:
- At most three condition pips plus *+n*.
- At least 10×10 px on a phone. The mock-up uses 16 px, and 20 px on desktop.
- 32 px icons on the TV.
- Every players'-side text node at least 18 px at 1280×720, with contrast 4.5:1 or better.

The emblems are game-icons (CC BY 3.0), the theme's icon family:

| Condition | Icon |
|---|---|
| Blinded | blindfold |
| Charmed | chained-heart |
| Deafened | silenced |
| Exhaustion | tired-eye |
| Frightened | terror |
| Grappled | grab |
| Incapacitated | half-dead |
| Invisible | invisible |
| Paralyzed | frozen-body |
| Petrified | stone-bust |
| Poisoned | poison-bottle |
| Prone | heavy-fall |
| Restrained | manacles |
| Stunned | star-swirl |
| Unconscious | sleepy |
| Concentrating | meditation |

The rules text in the card comes from the books lookup in the chosen edition, in the shared tooltip with the condition colour family (dashed ochre underline).

#### 2.2.3 Sizes and placement per platform

| Platform | Tile | Now tile | Names | Placement |
|---|---|---|---|---|
| Desktop 1366×768 | 54×68 | 78×98 | under every tile, 12 px | The top bar's centre slot when the strip fits between the title and tools groups (Death House: 5 entries, 519 px). Otherwise its own row 10 px under the top bar, with the Floors panel folded to its pill (Ravenloft: 10 entries). |
| iPad 1024×768 | 50×64 | 72×92 | under every tile | Its own row under the top bar; the Floors panel is folded during combat. |
| Phone 390×844 | 40×52 | 56×72 | none on tiles: the dock names the active one | A full-width row under the tool row. The tiles scroll inside it, never the page. |
| TV 1920×1080 | 104×128 | 150×186 | under every tile, 20 px, now 26 px | Centred at the top, in place of the theme's location ribbon, which becomes the round chip's place name. |

**Overflow.**
- Beyond what fits, the tail folds into a *+n* chip that opens the tracker panel.
- Groups keep crowds short: Vallaki's 13 combatants make 7 entries.
- On a phone the strip scrolls sideways inside itself, and the now tile stays pinned at the left.

#### 2.2.4 Interactions

| Gesture | DM | Players' side |
|---|---|---|
| Tap a tile | Select its token, and frame it with the strip-aware inset (§2.6). On a group, the member whose turn it is, or the first standing one. | Frame the token **only if the players can see it**: revealed, and in a revealed or explored cell (Foundry #8265). Otherwise nothing happens. |
| Tap a member sub-tile (open group) | Make that member the one moving: the range overlay and `movedFt` follow it. The turn does not change. | — |
| Hover (mouse) or long-press 400 ms (touch) | The stat-block card, below the strip (never over it): name, CR and XP, source, AC/HP/speed tiles, attack lines with *Roll* (0.5.0 click-to-roll), conditions with rules text, legendary uses, DM note. | Touch in Players mode: the players' card (alias, what they see, `seenAs`). The TV takes no input. |
| Drag a tile sideways (mouse), or long-press then drag (touch) | Reorder. The new initiative lies between the neighbours; ties keep a `tie` number. | — |
| Double-tap the grip | Fold to a pill: *R3 · Vesna*. | — |
| Tracker panel ☰ | Opens the D&D Beyond layer (§2.4). | — |

**Keyboard** (one KEYMAP in 0.3.0's `ui/keys.ts`; ignored while typing).

| Key | Action |
|---|---|
| `n` | Next turn (unchanged) |
| `Shift+N` | Previous turn |
| `i` | Open or close the tracker panel |
| `e` | Focus the strip, then `←` `→` `Home` `End` move between tiles |
| `Enter` | Frame the focused tile |
| `Space` | Open the card |
| `D` | Delay |
| `Y` | Ready |
| `Delete` | Remove from the fight, after a confirmation |
| `Esc` | Leave the strip |

None of these collide with `r`/`R`, `f`, `/`, `[`, `]`, `\`, `h` (A29) or Ctrl-Z.

**Accessibility.**
- The strip is a list (`role="list"`) of buttons with labels such as *"Ghoul ×4, enemy, initiative 13, one hidden, one bloodied, one down"*.
- Focus rings use the theme's `--focus`.
- The display is `aria-hidden`: nobody operates it.

**Motion.**
- Next moves the leaving tile to the tail with a 150 ms transform and grows the new now tile.
- A Next that arrives during the transition snaps to the final state; nothing queues (Carousel's glitch).
- `prefers-reduced-motion` turns transitions off.

### 2.3 The action dock

The bottom centre, where today's turn bar sits:

- **Who.** Mini portrait, name, class and level or CR; AC.
- **HP field.** Tap it and type `-7`, `+5` or `15`; 0.5.0 feature 4; undoable through 0.3.0's history.
- **Movement left.** *30 ft of 30 ft*, as today. For a creature with legendary actions: *legendary 2/3*.
- **Previous** (`Shift+N`).
- **Delay.** Hourglass: the combatant moves to the waiting shelf.
- **Ready.** Crossbow: pick or type a trigger. The badge lasts until the start of its next turn, or until *Used* is tapped.
- **Next turn** (`N`), the primary button.
- **⋯ More.**
  - Add combatant or summon
  - Reveal or hide
  - Remove
  - Roll for…
  - Pause
  - End encounter…
  - Large controls (the 0.5.0 option)

**Turn-start prompts.**
- When a **hidden** combatant's turn comes, the dock offers **Reveal now** (Monk's *hide until first turn*, one tap).
- When a **down party member's** turn comes, it offers **Death save ✓ / ✗**.
- When **someone is waiting** at the round boundary, it asks: *act now · keep waiting*.

**Phone.** The dock is the full width at the bottom: name, a single line of AC · HP · movement, a ⋯ menu, and a large **Next ▸**. It keeps the 44 px targets.

### 2.4 The tracker panel: the D&D Beyond layer

A movable A29 panel, id `combat`. On desktop and iPad it docks right at 372 px wide, its top 8 px under the strip, so it never covers the order it lists. Under 820 px it becomes a bottom sheet. It is the same right-hand drawer slot as 0.6.0's area panel: one drawer, two tabs, so the panels never stack.

**One row per entry, in turn order, starting with *now*.**
- Initiative, which is editable.
- Portrait and name, with the source line (*Vampire Spawn · SRD 5.2.1*, or *stand-in: Veteran · SRD 5.1*).
- AC, then the HP field and bar.
- Condition chips; tap one for its card, or tap **+** to add.
- Death saves.
- Legendary uses and resistances left.
- Hidden and DM-only chips.

**Groups** expand to member rows with their own HP and conditions. A group that has not arrived stays folded, with a *3 hidden · not yet arrived* chip.

**Footer.**
- **Add**: search the same monster index as the builder; adding mid-fight keeps the turn.
- **Roll…**: roll for selected entries or groups.
- **Pause**: the strip folds to a pill. The fight stays in state, so A16's chases into buildings keep it.
- **End…**: the XP award.

**Every number on the strip is editable here, and only here or in the dock.** The strip itself never shows inputs, so it stays legible.

### 2.5 The players' side: Players mode and the Player Display

- **One builder.** Both surfaces come from `projectEncounter(state)` in `core/playersView.ts`, which extends 0.2.0's key-level projection with value-level filtering. A2 requires this filtering anyway.
- **What reaches the players** (the mock-up's `project()` in `proto/app.js` is a working sketch):
  - Revealed combatants under their `playerName`.
  - Groups counted by visible, standing members.
  - Conditions on revealed tokens.
  - Health words.
  - Round, order and *now*.
  - Party members' delay, ready and death saves.
- **What never reaches them:**
  - hidden tokens and hidden members
  - creature HP numbers, and AC
  - initiative numbers of non-party entries
  - lair and reminder entries, unless ticked
  - late arrivals before they arrive
  - readied or delayed foes
  - legendary and legendary-resistance counts
  - source stat blocks, attack lines and notes
  - plan ids, and the real names of unrevealed creatures
- **Hold on hidden turns.** When the turn is on a hidden combatant, the players' *now* stays on the previous visible one, as D&D Beyond Maps does. The round counter does not tick early either. In the TV mock-ups, `wolves` arriving in round 4 and the hidden spawn produce no gap.
- **Numbering ignores hidden members** (D&D Beyond). Players see *Vampire spawn ×2*, never *×3* with one missing.
- **Defeated foes leave the players' strip** when they drop to 0 (A30: *hides defeated foes*). The DM strip keeps them greyed in their group until the fight ends, so a mistaken HP edit can be undone in place.
- **TV legibility.**
  - Names and health words are always visible (Carousel #70: no hover on a TV).
  - Minimum 18 px at 1280×720. The TV strip uses `clamp()` so 1280×720 and 1920×1080 both pass.
  - No buttons.
  - The location ribbon gives way to the strip during combat.
- **Before combat starts** nothing renders on the players' side (Carousel #74). The projection sends no encounter until *Start*. **Pause** removes the players' strip.
- **Portraits on the players' side** are rendered by the display window's own renderer from the same figure code. Only the creature id of a **revealed** token crosses the channel, and the token already shows that figure on the map. A portrait never shows more than the token does.

### 2.6 Coexisting with the movable panels and the map

- **The strip is an A29 panel** (`makePanel(strip, { id: 'initiative', name: 'initiative', icon: ICON.swords })`).
  - Its default place is computed: the top bar's centre slot when it fits, otherwise a row under the top bar.
  - If the DM drags it elsewhere, for example to the bottom on a wide monitor, the place is saved per device class like every panel.
  - Folding turns it into a pill showing the round and the now portrait.
  - `H` hides it with the others.
- **During combat the Floors panel starts folded** on iPad and phone. It is a one-tap pill, so the floor picker is still reachable.
- **Strip-aware camera (the nudge).**
  - `World` gets `setInsets({ top, bottom, right })`, measured by a ResizeObserver: the strip's bottom edge plus 12 px, the dock's top edge, and the docked tracker's left edge.
  - `frame()`, `moveTo()`, find-party, follow-on-Next and framing from a tile all aim at the centre of the free area between the insets, not the screen centre.
  - The mock-up's backdrops were captured that way (`enc-backdrops.tmp.mjs`):
    - DM views: the fight's centre at 52–62% of the height.
    - The Player Display: the fight's top edge at 34% of the height, under the TV strip.
    - The tracker view: the captured frame is scaled and shifted to the free area left of the panel, as the right inset would frame it.
  - There is no separate camera controller: the inset is a parameter of the existing moves (PITFALLS 30).
- **Slim mode (the fold).**
  - The DM's own pans are never fought.
  - After a camera change (throttled to 10 per second), the screen anchors of combatant tokens and their name tags are tested against the strip's rectangle plus 8 px.
  - If one lies under it, the strip turns **slim**: 30 px chips showing initiative and side colour, and the now chip with its name.
  - Slim chips use three-letter names, the round boundary shortens to *R3*, and only the tracker tool stays. At 1366×768 the slim strip is 48 px tall instead of 135.
    - Death House's five entries fit the top bar's centre slot (558 of 586 px), so the slim strip leaves the map entirely.
    - Longer orders (Vallaki 697 px, Ravenloft 895 px) stay in the row under the top bar.
  - It returns to full size 600 ms after the area is clear (hysteresis, no flicker).
  - Slim chips keep 44 px hit areas by extending below the visible chip.
- **Dock and map.** The dock's top edge is the bottom inset. Tokens are framed above it; a combatant near the bottom gets the same slim behaviour, with the dock collapsing to its Next button.

### 2.7 Portraits

**Pipeline** (`render/portraits.ts`, prototyped in `portraits/main.ts`):
1. Build the figure with the same function the map uses: `figureFor(entry)`, or `humanoid()` for members. When the bestiary work lands, its SRD model mapping too.
2. Swap materials exactly as `syncTokens` does: flat-shaded Lambert, never fogged.
3. Frame it automatically:
   - **head and shoulders** for upright figures: height above 1.25 × width, with headroom
   - **whole body from the front quarter** for beasts: kit quadrupeds face +x, everything else faces +z
   - **from above** for flat swarms
   - **whole body** for things such as the mimic, mound, broom and will-o'-wisp (an override list)
4. Light it with the campaign's hemisphere and key light from `campaigns.json`, plus a cool (CoS) or warm (WSC) rim light so the silhouette reads on a dark tile.
5. Render into a reused `WebGLRenderTarget` (192×240 at 2×) on **`app.world.renderer`**. Save and restore the render target, clear colour and alpha around each portrait.
6. `readRenderTargetPixels`, flip, downscale 2× in a 2D canvas for anti-aliasing, then encode. The prototype used PNG; production uses `convertToBlob({ type: 'image/webp' })`.
7. Cache in memory and in an IndexedDB store, `portraits`. Keys are `v{PORTRAIT_VERSION}|{figure hash}|{campaign theme}`. Bumping `PORTRAIT_VERSION` invalidates the cache when figure code changes.
8. Render **lazily at idle**: one portrait per `requestIdleCallback` slot, never while the camera moves, starting with the combatants of a fight just started.

**Measured** in the prototype (SwiftShader software GL in Playwright, so a pessimistic CPU path):

| Measure | Result |
|---|---|
| Portraits | 59 per theme × 2 themes |
| Canvases in the window | **1** |
| `webglcontextlost` events | **0** |
| Median size | 9.6 KB PNG (192×240) |
| Total for 59 portraits | 0.55 MB |
| Median time per portrait (SwiftShader) | 324–390 ms CoS, 366–567 ms WSC |

- The plan sets the iPad budget at **≤ 12 ms per portrait**, recorded manually under PITFALLS 2. GPU rasterising a few hundred triangles at 384×480 takes a fraction of that; the cost is shader warm-up, paid once.
- **The display window** renders its own portraits with its own single renderer. No image crosses BroadcastChannel.
- **Fallback.** If the context is lost or WebGL fails, the tile shows a monogram on the side colour, and the next idle slot retries.
- **Party members.**
  - Today every member token is `adventurer({ cloth: colour })`.
  - The plan adds an optional `Sheet.figure`: a small subset of `HumanoidOpts` (robe, cloak, weapon, hair, skin). The DM picks a look in the roster, so the Wizard holds a staff and the Rogue wears a cloak, as in the mock-up.
  - It is harmless on the players' side, and the map token uses it too.

### 2.8 The encounter builder

The swords button opens the **builder** when no fight is running and the **tracker panel** when one is. The tap menu on a room and the Rooms row, and from 0.6.0 the area panel, gain **Encounter here**, which opens the builder pre-filled with that key.

The builder is a page sheet with three columns on desktop and iPad. On a phone it has three tabs (*Party · Monsters · Fight*), with a sticky difficulty bar and the primary button at the bottom.

**Party** (left).
- **The roster's party members** with portrait, class and a level stepper.
  - `Sheet.level` is new. It is set once and remembered.
  - A tick sets who is in this fight; the absent are unticked, as D&D Beyond's *active characters*.
- **Allies.** Named NPCs with `role: "ally"` in `characters.json` (Ireena, Ismark), and placed allied tokens. They fight on the party's side and **do not change the difficulty**, the D&D Beyond complaint above. They take no XP share.
- **Summary.** *4 characters · level 3* (mixed levels shown as *3, 3, 4, 4*).
- **Plans here.** Saved encounter plans for this location, by key, with their difficulty. Tap to load; *Run* to place, roll and start.

**Monsters** (centre).
- **One search field** across:
  - **the SRD monster index** of the chosen edition: 317 in SRD 5.1 and 330 in SRD 5.2.1, built once from the books' `monsters.json` into a compact index of id, name, type, size, CR, XP, AC, HP, initiative bonus or score, legendary uses and lair XP, cached per book version;
  - **the module's people and creatures** (174 in `characters.json`). Named NPCs without SRD numbers carry a **stand-in**: the DM picks an SRD stat block once, for example *Izek → Veteran*. It is labelled *stand-in* everywhere, and no book stat block is ever shipped.
- **Filter chips.**
  - **This place** (on by default)
  - **CR** range
  - **Type**
  - **Size**
  - **Environment**: dungeon, town, forest road, castle… The module's own terrain sets in `manifests/encounters.json` (18 spawn sets) and the location's kind supply these. SRD 5.2.1 has habitat lines on only 9 monsters, so the SRD itself cannot drive this filter.
  - **SRD 5.1 / 5.2.1**, following the 2014 / 2024 switch in the header
  - *module only*
- **Rows.** Portrait (cached), name, *here* or *module* tags, type · size · AC · HP, CR and XP, and a **− n +** stepper. The count is the group (D&D Beyond's +/− semantics: one initiative roll per group by default).
- **Creatures of this place.** Cards above the results, one per source:
  1. **Keyed slots** of this location from A22 (0.6.0), grouped by key. Death House shows *29 · Ghoul ×4 "rise from the ground at the midpoint"*, *31 · Shadow ×5*, *34 · Ghast ×2* and *38 · Lorghoth*, using the DM labels already authored in `scene.json`.
  2. **Tokens already placed here**, for example *Wolf ×2 (hidden)*.
  3. **NPCs tagged to the location** in `characters.json`, for example Strahd and Rahadin for `K`.
  4. In the wilderness, **the terrain spawn set** (`forest-road-night`…).
  - Tapping a card adds the whole set, with *Place at the slots* as the default placement.

**Fight** (right).
- **The plan's name** and its key, for example *Ghouls of the dark hall · 29*.
- **One row per creature group.** Count stepper, then chips:
  - **Enemy / Neutral / Ally**: defaults from `characters.json` `role`; neutral and ally give no XP and do not count.
  - **Hidden at start**: the default, the eye-off icon.
  - **One roll / Each / Score**: *Score* is the 2024 static initiative, such as *+2 (12)*.
  - **Average / Rolled HP**: rolled uses `hpDice` and `core/dice.ts`.
  - **Arrives in round n**.
- **Difficulty meter for the selected edition.**
  - **2014:** *800 XP × 2 for 4 foes = 1,600*, the label (**Deadly**), and a four-band bar with Easy, Medium, Hard and Deadly thresholds for this party.
  - **2024:** *800 of the budget*, the label (**Moderate**), and a three-band bar with Low, Moderate and High budgets.
  - **The other edition in one line**, so a DM moving between rules sees both.
  - **Warnings, in our own words:**
    - more than two foes per character (2024 troubleshooting)
    - parties of 1–2 or 6+ (2014 multiplier shift shown)
    - level 1–2 parties against many foes
  - *Award at the end: 200 XP each.*
- **Footer.** **Save plan** · **Place on the map…** · **Roll initiative** (primary).

**Placing on the map.**
1. *Place on the map…* folds the sheet into a bar: *Tap where they come from · Cluster ▾ · Esc*. With a keyed plan, *At the slots* is pre-selected and no tap is needed.
2. `core/formation.ts` (pure) fills cells:
   - **Cluster**: a ring spiral from the chosen cell, the existing `addCreatureNearParty` walk made general.
   - **Line**: perpendicular to the direction of the party.
3. Cells must:
   - be inside the level's floor polygons
   - be reachable from the point without crossing walls or closed doors (`canWalk`)
   - not be occupied
   - not be a stair, trapdoor or door cell
   - hold a whole Large or Huge creature (2×2 or 3×3 cells, from `sizeOverride` or the record)
4. Groups stay contiguous.
5. All placed tokens start **hidden** (`hidden: true`, alias as `playerName`), numbered without counting hidden ones on the players' side.
6. One history entry covers the whole placement, so Ctrl-Z removes them all (0.3.0).

**Rolling initiative** (the *Roll for initiative* sheet, `shots/v3/ipad-vallaki-roll.png`).
- **Party rows wait for the players' own rolls.**
  - Tap a row, or Enter, and type the number on a large keypad. *+mod* adds the sheet's bonus if a player calls out the raw die.
  - *Next player ▸* moves on.
  - Blank rows roll privately when the DM starts.
- **Monsters roll privately** with `core/dice.ts` (seeded in tests), one roll per group unless *Each* is set. The result is logged in 0.5.0's DM log.
- **Ties** go to the higher bonus. Then, between party and monsters, the DM decides with one tap. The players decide among themselves, as both editions' rules say.
- **Start · round 1.** This calls the reworked `startEncounter` (§2.10):
  - member tokens are placed around the party marker (today's behaviour)
  - the strip opens
  - the clock starts at the campaign time

**Start, pause, end.**
- **Pause** (tracker footer or More) keeps the fight in state, folds the strip to a pill and removes it from the players' side.
- **End encounter…** opens the **XP award**.
  - **Defeated foes**: down, fled or spared, with a tick each. The default is down and fled.
  - The total XP, using in-lair XP for 2024 lair creatures, ÷ the party members present. *Award* adds it to each `Sheet.xp`. *Milestone* skips XP, for Curse of Strahd tables that level by milestone.
  - It logs a line to `xpLog` (DM-only) for the coming session recap.
  - Members fold back into the party marker as today. A16 keeps them where they stand if the fight crossed a building.

### 2.9 Rules details the model must get right

| Rule | Behaviour |
|---|---|
| Group turns | A group acts on one initiative. Next steps through its **standing** members (*Ghoul 2 of 4*), then moves on. The DM can tap any member to move it out of order within the group turn. |
| A30, skipping the downed | Creatures at 0 HP are skipped. **Party members at 0 HP are not**: their turn prompts a death save (✓/✗, the player's own die). Three ✓ make them stable; three ✗ mean *dead* (DM confirms); any healing resets the saves. |
| A30, defeated foes | Hidden on the players' side at once. Greyed on the DM's until the end. |
| Delay | The combatant moves to the waiting shelf. *Act now* (a tile button, or the dock prompt) ends the current turn and starts theirs; their initiative becomes the slot they took. At the round boundary the DM chooses *act now* or *keep waiting* (the turn is lost). Delay is a common table rule rather than RAW 5e, so the button stays visible but explains itself in its card. |
| Ready | Ends the turn with a readied badge and an optional trigger. The badge clears at the start of that combatant's next turn or when *Used* is tapped, which spends its reaction. |
| Summons | **2024**: *shares your Initiative count, takes its turn immediately after yours*. Docked after the summoner (SRD 5.2.1). **2014**: *roll initiative … as a group, which has its own turns* (SRD 5.1). |
| Late arrivals | Skipped until their round. They arrive hidden unless *reveal on arrival* is ticked. |
| Lair action | A DM entry at 20 that loses ties (Curse of Strahd). Offered automatically for creatures whose stat block has lair actions (2014) or *in lair* uses (2024). |
| Legendary actions | Uses come from the stat block (2014: *can take N*; 2024: *Uses: N (M in Lair)*), with an *in lair* toggle for 2024. A tap spends one. They reset at the start of the creature's turn. Legendary resistance is tracked per day (DM card only). |
| Durations (0.5.0) | *Until the start or end of X's next turn* or *N rounds*. They expire inside `nextTurn` on both screens. |
| Clock (A17) | Each new round adds 6 s to the campaign clock. The round chip shows the elapsed seconds. |
| Across locations (A16) | The encounter no longer belongs to one location. Each combatant has its token's location and level. A combatant elsewhere shows *↗ Wachterhaus* on its tile; tapping it goes there. |

### 2.10 Data model additions

`state/campaign.ts` (sketch). Every new key is classified for the players' projection; keys marked *filtered* use a value projector in `core/playersView.ts`.

```ts
export type Side = 'ally' | 'enemy' | 'neutral';
export type ConditionId = 'blinded' | 'charmed' | 'deafened' | 'exhaustion' | 'frightened' | 'grappled' | 'incapacitated' | 'invisible'
  | 'paralyzed' | 'petrified' | 'poisoned' | 'prone' | 'restrained' | 'stunned' | 'unconscious' | 'concentrating';
export interface Condition { id: ConditionId; level?: number /* exhaustion */; until?: { turnOf: string; at: 'start' | 'end'; round: number } | { rounds: number; from: number }; note?: string }

export interface Token {            // existing fields unchanged
  side?: Side;                      // player (filtered): only on revealed tokens
  conditions?: Condition[];         // player (filtered): revealed tokens only; note dropped (0.5.0)
  sizeOverride?: CreatureSize;      // player: drives the base ring (0.5.0)
  ac?: number;                      // dm
  srdId?: string;                   // dm: which SRD block backs it ('srd-5.1:ghoul'), stand-ins included
  legendary?: { max: number; used: number; inLair?: boolean; resist?: { max: number; used: number } }; // dm
  deathSaves?: { ok: number; fail: number }; // player for party members, dropped for creatures
}
export interface Sheet {            // the roster; existing fields unchanged
  level?: number; xp?: number;      // player (filtered): dropped (not needed on the display)
  hp?: { cur: number; max: number; temp?: number }; // player (filtered): health word only, never the numbers (PITFALLS 26)
  figure?: Pick<HumanoidOpts, 'skin' | 'hair' | 'robe' | 'cloak' | 'weapon' | 'helm'>; // player: their own look
}
export interface Entry {
  id: string; kind: 'one' | 'group' | 'lair' | 'reminder';
  tokens: string[];                 // members in order; one for 'one', none for lair/reminder
  init: number; tie: number;        // tie breaks equal init (drag); bonus first by default
  side: Side; label?: string;       // reminders, lair
  summonOf?: string;                // 2024: docked right after this entry
  arrives?: number;                 // late arrival round
  showPlayers?: boolean;            // lair/reminder ticked visible
}
export interface Encounter {        // v2; replaces { location, level, round, order, turn, movedFt, partyPos }
  v: 2; id: string; rules: '2014' | '2024'; planId?: string;
  round: number; entries: Entry[];
  turn: { entry: string; member: number };
  waiting: string[];                // delayed entry ids
  ready: Record<string, { trigger?: string; round: number }>;
  movedFt: number; party: { location: string; level: string; pos: Vec2 };
  started: { day: number; hour: number }; paused?: boolean;
}
export interface EncounterPlan {
  id: string; name: string; location: string; key?: string; level?: string; rules: '2014' | '2024';
  foes: { ref: { srd?: string; creature?: string; standIn?: string }; count: number; side: Side; hidden: boolean;
          hp: 'average' | 'roll'; init: 'group' | 'each' | 'score'; alias?: string; arrives?: number; at?: 'slots' | 'cluster' | 'line' }[];
  allies?: string[]; notes?: string; createdAt: number; usedAt?: number;
}
export interface CampaignState {    // new keys
  encounterPlans?: Record<string, EncounterPlan>;   // dm
  xpLog?: { at: { day: number; hour: number }; plan?: string; xp: number; each: Record<string, number> }[]; // dm
}
```

| Key or field | Class | Projection rule |
|---|---|---|
| `encounter` | player, **filtered** | `projectEncounter`: drop hidden tokens and members; lair and reminders unless `showPlayers`; arrivals before their round; `ready` and `waiting` of non-party entries; `init` and `tie` of non-party entries; `planId`. Replace `turn` by `now`, holding the last visible. |
| `tokens` | player, **filtered** (A2) | Drop hidden tokens. For revealed creatures: `name` → `playerName`, `hp` → health word, drop `ac`, `srdId` and `legendary`. Keep `side`, `conditions` (without `note`) and `sizeOverride`. |
| `roster` | player, **filtered** | Party sheets only. Today `creatureSheet()` also pushes `cr:<id>` sheets named *Strahd von Zarovich* into the roster: a second leak path besides bug 4. Drop `hp` numbers, `xp` and `level`. Keep speed, reach and range for the range overlay, and `figure`. |
| `encounterPlans` | dm | Never sent. |
| `xpLog` | dm | Never sent. |
| Portrait cache | not campaign state | Device-local IndexedDB store; not exported. Each window renders its own. |

- **Migration** (PITFALLS 28): a `campaign-io` fixture with a 0.4.0 save and a running v1 encounter. It converts to v2 with one `'one'` entry per combatant, `turn.entry` set to the old index, and `party` from `partyPos` and `location`. A v1 save without an encounter loads unchanged.
- **The `cr:` roster sheets** stop being created. Speed, reach and darkvision for a creature come from its token and SRD index. Old ones are dropped by the migration, which leaves them in the DM's export.

### 2.11 How it hooks into 0.5.0 and the approved changes

| Item | Where it shows in this design |
|---|---|
| 0.5.0 #1 conditions with rules text | Strip pips, tracker chips, token pips (0.5.0's own), stat card. Rules text from `lookup('<name> condition', rulesEdition())` in the shared tooltip. |
| 0.5.0 #2 durations | Set from the condition picker. Expire in `nextTurn`. The round count shows in the card. |
| 0.5.0 #3 lair, reminders, legendary | Lair and reminder entries in the order. Legendary diamonds on the tile, uses in the dock, reset at the creature's turn. |
| 0.5.0 #4 HP field, size | The dock's HP field and the tracker's. Size override drives formation and the ring. |
| 0.5.0 #5 DM combat line, health marks | The dock *is* the combat line. Health marks on tokens stay 0.5.0's option; the strip's bars are always on for the DM. |
| 0.5.0 #6 roller and log | Monster initiative, rolled HP, click-to-roll in the card. All log to the DM log; *Show result* only via 0.4.0. |
| 0.5.0 #7 Large controls | Dock and keypad buttons at 56 px when on. |
| A2 hidden combatants off the players' side | `projectEncounter` and `projectTokens`. The players' strip is behind the A2 build flag until A2 ships. |
| A11 bloodied and down for players | The blood fill, the bloodied drop, the down skull and the words. |
| A16 combat survives Enter and Back | Encounter v2 is not tied to a location. *↗ elsewhere* tiles. |
| A17 six seconds a round | The round chip's seconds; the clock advances per round. |
| A30 skip downed, hide defeated | Creatures skipped, party members get death saves (nuance above), defeated foes off the players' side. |
| A29 panels | Strip `initiative`, tracker `combat`, both movable and foldable, layout per device class. |
| 0.4.0 display layer | The players' strip renders in the display's overlay layer. Curtain and Freeze suppress it like other overlays. |
| 0.3.0 history and KEYMAP | HP, conditions, placement, reorder and Next are undoable. Keys registered in one table. |
| A22 slots (0.6.0) | Keyed *creatures of this place*. Before 0.6.0 the builder uses placed tokens, NPC tags and terrain sets. |
| 0.6.0 area panel | *Encounter here* and the plan list per key. The tracker shares its drawer. |

### 2.12 Pitfalls guarded

| PITFALLS # | How this design meets it | Checked by |
|---|---|---|
| 1 performance | The strip is DOM. Portraits render once at idle and are cached. No WebGL work per Next except the existing range overlay. | perf.spec within band. Next under 4 ms of script (performance.measure). |
| 2 Chromium-only testing | The WebKit project runs strip.spec. The iPad row records the portrait time. | release checklist |
| 3 iPad WebGL context loss | Portraits through the main renderer only. Canvas count stays 1 per window. Monogram fallback. | e2e: canvas count, `webglcontextlost` listener during 60 portraits |
| 4 / 9 / 10 / 11 leaks | One projection with value filters. Players' tile taps frame only visible tokens. Hold *now* on hidden turns. Numbering ignores the hidden. | player-safety fuzz; display listener e2e |
| 12 overlays that cannot be dismissed | The strip folds, hides with `H`, and pauses off the players' side. | e2e |
| 15 replacing shipped behaviour | A32 recorded. `n`, End and Find kept in the dock. ui.spec updated deliberately. | ui.spec diff reviewed |
| 17 hotkeys | KEYMAP entries; strip keys only while the strip has focus. | keys.test (no duplicates) |
| 19 / 20 icons and TV text | 3 pips + *n*, ≥ 16 px on phone. TV text ≥ 18 px at 1280×720, contrast ≥ 4.5. | e2e computed style + WCAG maths |
| 24 setup and tap sprawl | Plans per key. Creatures of this place. Run in ≤ 3 taps. Mid-fight actions ≤ 2 taps. | tap-count e2e |
| 25 over-automation | Players roll their own. Only bookkeeping is automatic. | review |
| 26 exact HP to players | Health words only; `hp` filtered from tokens and roster. | grep the players' DOM and messages for `\d+\s*/\s*\d+` |
| 27 creature sizes | Formation reads `sizeOverride` or the record. | formation.test |
| 28 schema | v1 → v2 migration fixture. | campaign-io.test |
| 30 / 31 camera | Insets only; no new controller; manual pans never overridden; slim mode instead. | e2e: after Next the token is in the free band; after a manual pan the camera target is unchanged |
| 39 touch | Every strip, dock, panel and keypad control is ≥ 44 px and passes elementFromPoint at 390×844 and 844×390. | phone sweep |
| 49 offline | The monster index is built from the precached books; portraits are generated locally. | offline e2e: start a planned fight with the network off |

## 3. The mock-up and the screenshots

### 3.1 What it is

`scratchpad/encounter/proto/` is a standalone page: plain HTML, CSS and a little JavaScript, no framework, served by `python3 -m http.server`.

| File | What it holds |
|---|---|
| `index.html` | The shell |
| `encounter.css` | The strip, dock, card, tracker, builder, initiative sheet, end-of-fight sheet, slim mode and the TV, in both campaign themes. The tokens are copied from the in-progress theme (`theme/proto/theme.css` r5). |
| `data.js` | The four fights, the party, conditions, and the 2014 and 2024 XP tables with a `difficulty()` function |
| `app.js` | Renders each view from the data. `project()` is a working sketch of `projectEncounter`. `rotated()` gives the BG3 order. `placeStrip()` holds the docking rule. |
| `img/portraits/{cos,wsc}/*.png` | 59 portraits per theme |
| `img/bg/*.jpg` | Real map renders |
| `icons/` | The theme's emblem sprites plus 29 game-icons for conditions and markers, with credits in `icons/CREDITS.txt` |
| `fonts/` | The theme's OFL fonts, with licences |

URL parameters:

| Parameter | Values |
|---|---|
| `f` | `deathhouse`, `vallaki`, `ravenloft`, `wsc` |
| `v` | `dm`, `tracker`, `builder`, `roll`, `end`, `tv` |
| `vp` | `desktop`, `ipad`, `phone`, `tv` |
| `hover` | an entry id (the DM card) |
| `slim` | `1` |
| `scroll` | an entry id (the tracker list scrolled to it) |
| `bg` | a backdrop name in `img/bg/` |
| `rules` | `2014`, `2024` |
| `theme` | `cos`, `wsc` (defaults to the fight's campaign) |

**What is real in it.**
- **Backdrops.** Rendered by the current mistLAB build (`dist/`, identical to HEAD's app code), copied to `appdist/` and driven through `window.__mistlab` by `enc-backdrops.tmp.mjs`:
  - the sample fight's creatures placed with `app.addCreature`, some kept hidden
  - the party started with `app.startEncounter`, so the members' tokens, the move and strike overlay and the labels are the app's own
  - DM chrome hidden
  - the camera framed with the strip-aware inset this design proposes: the fight's centre at 52–62% of the height
- **TV backdrops.** A real Player Display page (`?display=player`) in the same browser, fed by BroadcastChannel. It shows exactly what the players' window shows today: fog, aliases (*A stranger* for Izek), hidden creatures absent.
  - Death House and Ravenloft: the display frames the fight itself, with its top edge at 34% of the height, under the TV strip.
  - Vallaki and the Sheep Chase follow the DM's camera, which already clears the strip.
- **The tracker view** scales and shifts the captured frame so the fight sits left of the docked panel, as the right inset would frame it.
- **Portraits.** Rendered by `portraits/main.ts`, which imports `app/src/bestiary.ts` and `kit/creatures.ts` read-only through a Vite server rooted in the scratchpad. It uses one `WebGLRenderer` and a `WebGLRenderTarget`, the production design (§2.7). `portraits/report.json` has the timings and sizes.
- **Numbers.** SRD 5.1 and 5.2.1 values for every creature. Named people use labelled SRD stand-ins.
- **Not real.** Nothing is interactive beyond what the URL selects: the views are states, not a working tracker. The 2014 encounter tables are numbers from the 2014 DMG, not SRD text (§4.6).

### 3.2 Two rounds of looking and fixing

Each round:
1. Shoot every view with `enc-shots.tmp.mjs` (Playwright, Chromium).
2. Look at every image and list what is wrong.
3. Fix it in `proto/` and freeze the code that was shot (`proto-v1/`, `proto-v2/`).

`shots/<round>/report.json` holds the measurements for each shot: strip and dock boxes, controls under 36 px, the smallest strip text, hidden things on the players' strip, strip-dock overlap and overflow.

**Round 1: v1 to v2**

| Seen in the v1 shots | Changed for v2 |
|---|---|
| The ghoul group's stacked card painted over the names to its right. The ×4 count sat on the name line (`desktop-deathhouse-dm`). | The stack is drawn behind its own tile. The count sits on the portrait's lower edge. One 5 px bar per member hangs under the portrait. |
| Aldric's paralyzed pip and Mateo's concentration pip sat on the names. | Pips form a column on the portrait's right edge. |
| On the TV the tiles were top-aligned, so the names sat at three heights. The ghoul group's name and *Bloodied* faded with the tile, under the count badge (`tv-deathhouse-players`). | Tiles are bottom-aligned with names on one baseline. Health words never fade. The bloodied and down badges got a white ring and moved to the portrait's top left. |
| The phone dock wrapped onto three lines, 103 px tall, with one element off-screen (`phone-deathhouse-dm`). | One line: AC, HP, speed left. The dock is 62 px. The strip scrolls inside itself, with a fade at the right edge. |
| The builder's difficulty bar placed thresholds proportionally, so at level 3 the labels crowded each other. | One equal band per difficulty word, with the marker placed inside its band. Both rule sets are shown, the chosen one first. |
| The phone builder squeezed three columns, and its footer ran off-screen (`phone-deathhouse-builder`). | Party and encounter fold into a summary bar above the footer. The footer buttons become icons. |
| The now tile repeated AC and HP under its name, which the dock already showed. | Removed. The dock is the one place for the active creature's numbers. |

**Round 2: v2 to v3**

| Seen in the v2 shots, or in a first v3 pass | Changed for v3 |
|---|---|
| Long names were cut: *Strahd von Z…*, *Izek Stra…*. | Captions use a short label: the DM's `short` (*Strahd*, *Izek*, *Folk*) and the players' `aliasShort`. Full names stay in the card and the tracker. |
| On the guards' turn the group stayed a closed stack, so nobody could see which guard was moving (`desktop-vallaki-dm`). | During its turn a group **opens**. Its members stand side by side on a tinted shelf, the current one enlarged with the glow, under one caption: *Guard ×6 · Guard 3 moving*. The TV shows a NOW tag over that member and no numbers. |
| Legendary diamonds sat above the tile, where the strip's edge cut them. | They sit on the portrait's bottom edge. |
| Caption heights varied, so tiles jumped when a health word appeared. | Captions have a fixed height: 16 px, or 66 px on the TV. |
| The Sheep Chase TV drew *Bloodied* in pale pink on parchment. | A CSS selector bug, now fixed. Sheep Chase uses a dark red. |
| The card's note about the hidden ghoul was written in by hand. | It is generated: each hidden member, plus the count the players see. |
| There was no picture of slim mode or of the fight's end. | Added `slim=1` (chips in the top bar's row) and `v=end` (the XP award). |
| *Creatures of this place* existed only for Death House. | Vallaki and the Sheep Chase list the creatures on the map and the NPCs tagged to the location. Each fight has its saved plans. |
| The phone dock cut *30 ft* off. | The name line reads *Guard 3 of 6*, and the numbers line is 12.5 px. It fits in 390 px. |
| A probe found *Now* and *Round 3* at 16 px on the TV, and *Waiting* at 10 px everywhere. | 18 px on the TV, 11 px minimum for the DM. The probe now finds nothing under 18 px on the players' strip. |
| On the Death House TV the strip covered Lise's token. The Player Display frames the fight today without knowing about the strip. | The display backdrops were captured again with the inset this design proposes: the fight's top edge at 34% of the height, under the strip. |
| The tracker panel covered half the strip on the iPad, and the foes it lists on the map (`ipad-ravenloft-tracker`). | It docks under the strip. The map re-centres in the free area left of it: the right inset (§2.6). |
| The tracker listed three hidden wolf rows that had not arrived yet. | A group that has not arrived is one folded row with a *3 hidden · not yet arrived* chip. A second shot scrolls to the foes. |
| Vesna's readied badge sat under Mateo's initiative badge (`desktop-wsc-dm`). Mateo's skull had the same problem in Ravenloft. | Readied, down and bloodied badges sit top centre on the DM strip. |
| On the wolves, *Round 4* covered the ×3 count. | It sits high on the portrait. |
| The slim strip was 649 px, too wide for the top bar's 586 px slot. It fell to the second row, where it still covered the map. | The round boundary shortens to *R3* and only the tracker tool stays. Slim mode now sits in the top row. |
| A probe found phone controls under 44 px: the top bar's book (38), the strip tools (36), the dock's ••• (40), a sheet's close (28–32). | All 44 px. The probe finds none under 44 px at 390×844. |

### 3.3 Screenshots

All paths are under `scratchpad/encounter/`. The **v3** set is current. `shots/v1/` and `shots/v2/` hold the main views under the same names, shot from the frozen `proto-v1/` and `proto-v2/` code, for comparison.

**Desktop, 1366×768.**

| File | What it shows |
|---|---|
| `shots/v3/desktop-deathhouse-dm.png` | Death House, 2014 rules, round 2, Mateo's turn. Five entries fit the top bar's centre slot. The ghoul group (×4: one down, one hidden *under the earth*) with the DM card open: stat card, two rolls, Prone's rules text, the hidden-member note. The dock is at the bottom. |
| `shots/v3/desktop-vallaki-dm.png` | Vallaki brawl: 13 combatants in 7 entries, on their own row. The guards' turn: the group open, Guard 3 moving, Guard 5 down. Izek is grappling Aldric. The neutral folk have clipped corners. |
| `shots/v3/desktop-ravenloft-dm.png` | Castle Ravenloft, 2024 rules, round 3, Vesna's turn, ten entries. The lair action at 20 (sealed: DM only). Strahd with legendary diamonds and his card. Wolves arriving in round 4. Mateo down. Dorian charmed, Lise concentrating. Spawn ×3 with one hidden. |
| `shots/v3/desktop-wsc-dm.png` | The Sheep Chase theme, the thug's turn. Vesna readied, Lise delayed on the *Waiting* shelf, bandits ×4 with one hidden in the alley. |
| `shots/v3/desktop-deathhouse-slim.png` | Slim mode. The camera is framed high, so the full strip (the dashed outline, an annotation) would cover Lise and Vesna. The strip folds to 48 px chips in the top bar's centre slot instead. |
| `shots/v3/desktop-deathhouse-builder.png` | The builder at Death House: the party with levels; *creatures of this place* from map keys 29, 31, 34 and 38; SRD search with filters; the encounter list with its toggles; both difficulty meters (2014: 1,600 adjusted, Deadly; 2024: 800 of 900, Moderate). |
| `shots/v3/desktop-deathhouse-end.png` | End of the fight: the foes that count, 800 XP ÷ 4 = 200 XP each, and *Milestone*, *Keep fighting*, *Award and end*. |

**iPad, 1024×768 at 2×.**

| File | What it shows |
|---|---|
| `shots/v3/ipad-ravenloft-tracker.png` | The tracker panel docked right, under the strip. Rows start with *now*: editable initiative, the source line, HP field and bar, condition chips (Lise *Concentrating*), death saves (Mateo). The map re-centres left of the panel. |
| `shots/v3/ipad-ravenloft-tracker-foes.png` | The same panel scrolled to the foes: Strahd with *legendary 2/3 · resist 2/3*, the wolves folded until they arrive, the spawn group expanded into members with their own HP and *Restrained*. |
| `shots/v3/ipad-ravenloft-dm.png` | Ravenloft on the iPad with the Spawn card. |
| `shots/v3/ipad-deathhouse-builder.png` | The builder in three columns at iPad width. |
| `shots/v3/ipad-vallaki-roll.png` | *Roll for initiative*: party rows filled from the keypad (Lise typing), and the foes rolled privately: Izek alone, the guards as one group, the folk. |
| `shots/v3/ipad-wsc-builder.png` | The builder in the Sheep Chase theme under 2024 rules. |

**Phone, 390×844 at 2×.**

| File | What it shows |
|---|---|
| `shots/v3/phone-deathhouse-dm.png` | A full-width strip under the tool row; the tiles scroll inside it. The dock carries the name, AC, HP and movement, plus Next. |
| `shots/v3/phone-vallaki-dm.png` | The guards' turn on a phone: *Guard 3 of 6* in the dock. |
| `shots/v3/phone-ravenloft-dm.png` | Ten entries scrolling inside the strip. |
| `shots/v3/phone-deathhouse-builder.png` | The builder as tabs (*Party*, *Monsters*, *Fight*), with a summary bar and *Roll initiative*. |

**Players' TV, 1920×1080.** Each one sits over a real Player Display render of the same moment: fog, aliases, hidden creatures absent.

| File | What it shows |
|---|---|
| `shots/v3/tv-deathhouse-players.png` | No hidden ghoul and no down ghoul: *Ghoul ×2*. No initiative numbers. Health words, the NOW tag, the round boundary. |
| `shots/v3/tv-vallaki-players.png` | Izek appears as *A stranger*. The guards' group is open with NOW over the moving guard: *Guard ×5*, with the down guard gone. |
| `shots/v3/tv-ravenloft-players.png` | No lair tile, no wolves, *Spawn ×2*, no legendary pips. Mateo shows *Down* with his death-save pips; Aldric shows *Bloodied*. The display frames the fight under the strip. |
| `shots/v3/tv-wsc-players.png` | *Big crook* and *Crook ×3*. Vesna's readied badge shows, since she is a party member. Lise is on the *Waiting* shelf. |

**Portraits.** `portraits/contact-cos.png` and `portraits/contact-wsc.png` are contact sheets of the 59 portraits in each theme. `portraits/report.json` has their timings and sizes.

**Measured on the v3 set** (`shots/v3/report.json`, 21 shots):
- No page errors or failed requests. No strip, dock, card, tracker or top-bar group runs off-screen. The strip never overlaps the dock.
- The players' strips carry no hidden markers: 0 hidden tiles, lair tiles or seals on all four TV shots. The DM strips show up to 5 (Ravenloft).
- The smallest strip text is 18 px on the TV, 11 px on desktop and iPad, and 10.5 px on the phone.
- Strip heights:
  - desktop and iPad: 129–143 px
  - slim: 48 px
  - phone: 96–102 px, within the 110 px criterion
  - TV: 286–294 px
- No visible control is under 36 px in any shot. A separate probe at 390×844 finds none under 44 px.

## 4. Build plan

### 4.1 What must merge first

| # | Work in progress | Why this plan needs it | Needed by |
|---|---|---|---|
| P1 | **0.2.0**: backups and the players' projection (`core/playersView.ts`, `campaign-io` fixtures; worktree `wf_e3f86663`, a732b0f) | Every new key is classified there; the migration fixture pattern. | 0.5.0 S0 |
| P2 | **0.2.1** night-one fixes, above all **A2**: value-level projection of tokens and the encounter, aliases. Also A1 (Players mode sealed). | The players' strip is behind the A2 build flag (PITFALLS 9). The strip's projection extends A2's. | 0.5.0 S7 |
| P3 | **A29 movable panels** (`ui/panels.ts`; `wf_cb633e01`, fix round 2) | The strip (`initiative`) and the tracker (`combat`) are panels; the Floors panel folds in combat. | 0.5.0 S2; 0.5.1 B1 |
| P4 | **Books**: SRD 5.1 and 5.2.1 with the typed lookup and the Rules edition preference (`books/lookup.ts`, `store.ts`; `wf_646bc177`, uncommitted WIP) | Condition rules text. Monster summaries (CR, XP, AC, HP, initiative). Legendary-use parsing. The 2024 budget table. Offline precache. | 0.5.0 S4, S5; 0.5.1 B2, B3 |
| P5 | **Bestiary of SRD monsters** as 3D models with the DM stat-block tooltip (scratchpad `bestiary/`: 346 monsters with `dm_line`, family, per-edition stats; model packs) | The stat card on long-press and hover. Figures, and so portraits, for SRD monsters the module does not name. `srdId` stand-ins. | 0.5.0 S1, S2 |
| P6 | **Clarity**: the shared tooltip component with rules colours | The card and condition text in one component; no fourth tooltip style. | 0.5.0 S2, S4 |
| P7 | **D&D-inspired theme** (scratchpad `theme/proto/theme.css` r5: chrome and page tokens, fonts, emblems, `--glow`, seal) | The strip's look in both campaigns; the TV sizes. | 0.5.0 S2, S7 |
| P8 | **0.3.0**: `ui/keys.ts` KEYMAP, the session history, phone projects, relative perf compare | Keys, undo for HP, placement and reorder, the phone sweep, perf gates. | 0.5.0 all |
| P9 | **0.4.0**: the display overlay layer, heartbeat and sequence numbers, Curtain and Freeze | The players' strip draws in the display's overlay layer and obeys Curtain and Freeze. | 0.5.0 S7 |
| P10 | **A22**: placed creatures wake into tokens (0.6.0) | Keyed *creatures of this place*. Before it, the builder uses placed tokens, NPC tags and terrain sets. | 0.5.1 B4, upgraded in 0.6.0 |

### 4.2 The version split

`docs/ITERATIONS.md` allows **at most seven features per version**, and 0.5.0 already holds seven. The recommendation:

- **0.5.0 "The initiative strip"** takes 0.5.0's features #1–#5 and adds the strip, portraits, the dock and the players' strip. The approved changes **A11, A16, A17 and A30** ship here, as `docs/APPROVALS.md` already schedules them.
- **0.5.1 "Encounter builder and tracker"** takes 0.5.0's **#6 (DM roller and log)** and **#7 (Large controls)**, which the initiative sheet needs anyway, and adds the builder, the tracker panel, XP and plans.
- The order **0.3.0 → 0.4.0 → 0.5.0 → 0.5.1 → 0.6.0** is unchanged. 0.6.0's area panel then gains *Encounter here* and the plan list per key, and A22 upgrades *creatures of this place* to keyed slots.

### 4.3 0.5.0 · The initiative strip

**S0 (infrastructure, not a feature): the encounter model v2 and the approved changes.**
- **What.**
  - `core/encounter.ts`, pure:
    - entries, groups and the turn pointer
    - sort with ties
    - BG3 rotation (ahead / after)
    - next and previous through groups and rounds
    - skip rules (A30: downed creatures skipped, downed party members get death saves)
    - delay, ready, late arrivals and summons (2014 or 2024 by the fight's `rules`)
    - legendary reset at turn start
    - the duration-expiry hook
    - the clock (A17: +6 s a round)
  - `App.startEncounter`, `nextTurn`, `endEncounter` and `current` rebuilt on it.
  - The encounter is no longer tied to one location (A16).
  - Migration v1 → v2.
  - `creatureSheet()` stops writing `cr:` sheets into the roster.
- **Files.**
  - `app/src/core/encounter.ts` (new)
  - `app/src/state/campaign.ts`
  - `app/src/app.ts`
  - `app/src/core/playersView.ts` (classify)
  - `tests/encounter.test.ts` (new)
  - `tests/campaign-io.test.ts` (fixture `campaign-cos-encounter-v1.json`)
- **Acceptance.**
  - Unit tests:
    - ties: bonus first, then the DM's `tie`
    - rotation of a 6-entry order at each turn
    - Next across a group of 4 with one down: 3 member turns
    - a downed wolf is skipped; a downed party member is **not**, and gets a death-save turn
    - Delay then *act now* takes the slot and keeps it next round
    - Ready clears at the start of the readier's next turn
    - a round-4 arrival is skipped in rounds 1–3
    - a 2024 summon sits right after its summoner with the same initiative; a 2014 summon group has its own roll
    - legendary 3/3 after the creature's turn starts
    - the clock is +18 s after 3 rounds
  - Migration: a running v1 encounter loads as v2 with the same order, turn and round.
  - e2e: start a fight in Vallaki, Enter N2 and Back. The strip shows the same round and order (A16).

**S1: Portraits** (`render/portraits.ts`, kv keys `portrait:*` in the existing `idb.ts` store, so no IndexedDB version bump).
- **Acceptance.**
  - On the DM page and the display page, `document.querySelectorAll('canvas').length === 1` before and after rendering 60 portraits.
  - A `webglcontextlost` listener counts 0.
  - Rendering happens only at idle: no portrait render while `controls` are changing (a counter hook).
  - After a reload, **0** portraits are re-rendered: a cache hit for every combatant (`__mistlab.portraitRenders`).
  - Median encoded size ≤ 16 KB.
  - WebKit project passes.
  - A manual iPad row records ms per portrait. Budget ≤ 12 ms; the release is blocked above 30 ms.
  - Forcing a context loss shows monograms, and portraits return after restore.

**S2: The strip (DM)** (`ui/strip.ts`, styles in the theme files, an A29 panel `initiative`, the card via the shared tooltip and P5's stat block).
- **Acceptance (Playwright).**
  - **Placement.** At 1366×768 a 5-entry fight docks in the top bar's centre slot: the intersection area with the title and tools groups is 0. A 10-entry fight takes the row under the top bar and the Floors panel is folded. At 1024×768 the strip is always in its own row.
  - **Now tile.** Its area is ≥ 1.4× the others'; it is first in DOM order; it carries the glow class.
  - **Taps.** One tap on a tile selects its token and frames it. Afterwards the camera target is within one cell of the token, and the token's screen point lies in the free band (≥ 24 px below the strip, ≥ 24 px above the dock).
  - **Card.** A 400 ms long-press opens the card below the strip. The card's rect does not intersect the strip.
  - **Reorder.** Dragging Ghoul ×4 before Vesna sets its initiative between theirs (and survives a reload). Mouse drag and long-press-drag both work.
  - **Keys.** `n`, `Shift+N`, `i`, `e`, `←`/`→`, `Enter`, `Space`, `D` and `Y` act as listed. Typing them into a textarea does nothing (`keys.test`: no duplicates).
  - **Overflow.** At 390×844 the page has no horizontal scroll; the strip's tiles scroll inside it; the now tile stays visible.
  - **Slim mode.** A combatant token panned under the strip turns it slim within 100 ms. `elementFromPoint` at the token's tag returns the tag, and the strip returns to full size 600 ms after the area is clear. A manual pan never changes the camera target by itself.
- **Pitfalls:** 1, 3, 15, 17, 19, 24, 30, 31, 39.

**S3: The dock** (`ui/dock.ts` replaces `turnBar`; **approval A32**).
- **Acceptance.**
  - The existing turn tests in `ui.spec` pass **re-pointed to the dock**, with the same behaviour for Next, Previous, End and Find.
  - `n` advances exactly as before.
  - The HP field: `-7` on 22 gives 15; `+30` gives max; `15` gives 15; Ctrl-Z restores.
  - Tap counts:
    - Next 1
    - Delay 1, Act now 1
    - Ready 2 (Ready, then a trigger chip or *Skip*)
    - Reveal now 1
    - Death save 1
  - At 390×844 Next is ≥ 44×44 and lies in the bottom 25% of the viewport. Every dock control passes `elementFromPoint` at 390×844 and 844×390.

**S4: Conditions and durations** (0.5.0 #1 and #2, unchanged acceptance) **plus** strip pips and tracker chips.
- Five conditions show 3 pips plus *+2*.
- Pips are ≥ 16 px at 390×844 and 20 px on desktop.
- The picker is 2 taps from a strip tile: tap the tile, which picks up the token, then pick the condition.
- The Prone card shows the SRD 5.2.1 text offline, or SRD 5.1 when the edition is 2014.

**S5: Legendary, lair, reminders, late arrivals** (0.5.0 #3 plus arrivals).
- A Strahd token with the SRD 5.1 Vampire as its stand-in gets 3 pips without typing; 5.2.1 gives *3 (4 in Lair)*.
- Spend 2, Next round to Strahd: 3.
- A lair entry at 20 sorts before a party member who rolled 20, and Next stops on it.
- Players see it only when ticked.
- Wolves *arriving round 4* are skipped in rounds 1–3 and appear greyed with *Round 4* on the DM strip only.

**S6: HP maths and health marks** (0.5.0 #4 and #5, plus **A11**).
- A wolf at 5/11 shows a red bar on the DM strip, and *Bloodied* with the blood fill on the players' strip.
- At 0 it shows the skull and *Down*, then leaves the players' strip (A30). The DM strip greys it.
- The players' DOM and every display message are free of `\d+\s*/\s*\d+` hit-point strings and of `hp` keys on creatures.
- The size override changes the base ring and the formation footprint.

**S7: The players' strip** (Players mode and the display overlay layer, behind the A2 flag; `projectEncounter`, `projectTokens`, `projectRoster` in `core/playersView.ts`; `ui/playersStrip.ts`).
- **Acceptance (display listener plus fuzz).**
  - With hidden tokens, a hidden group member, a lair entry, a late arrival, a readied foe and a delayed foe in state, no message to the display contains:
    - their ids, or the real names of unrevealed tokens
    - `legendary`, `ready` or `waiting` for foes
    - initiative numbers for non-party entries
    - creature `hp` or `ac`
  - While the DM's turn is on a hidden combatant, the display's now id equals the previous visible combatant's. The round does not change.
  - Player-side numbering skips hidden members.
  - At 1280×720 every players'-side strip text node is ≥ 18 px with contrast ≥ 4.5:1 (computed style plus WCAG maths, as in `display.spec`). Every tile has a visible name.
  - In Players mode, tapping a revealed ghoul's tile frames it. A revealed token standing in an unexplored cell does not move the camera (Foundry #8265). No tile exists for a hidden one.
  - Before *Start*, after *Pause* and while curtained or frozen, no players' strip renders and no encounter is in the display state.

### 4.4 0.5.1 · Encounter builder and tracker

**B1: The tracker panel** (`ui/tracker.ts`, an A29 panel `combat` sharing the right-hand drawer with 0.6.0's area panel).
- Every number on the strip is editable here: initiative, HP, conditions, hidden, legendary, death saves.
- *Add* searches the monster index mid-fight without changing whose turn it is.
- At 1024×768 the docked panel's rect does not intersect the strip's or the dock's. With the panel open, framing a token puts it ≥ 24 px left of the panel (the right inset).
- A group that has not arrived is one folded row.
- At 768×1024 the panel is ≤ 50% of the width; at 390×844 it is a bottom sheet ≤ 70% of the height.
- Phone sweep passes.

**B2: XP maths** (`core/xp.ts`).
- 2014 thresholds, the multiplier with the party-size shift, and the label.
- 2024 budgets per character summed for mixed levels, *Beyond high*, and the many-foes warning.
- `tests/xp.test.ts` asserts the four sample fights in §1.6 exactly:
  - Death House: 1,600 Deadly / 800 Moderate
  - Vallaki: 2,125 Deadly / 850 Low
  - Ravenloft: 30,800 Deadly / 16,900 Beyond high
  - WSC: 400 Trivial / 200 Low
- Edge cases:
  - parties of 1, 2 and 6
  - 15+ monsters (x4, x5)
  - in-lair XP
- The 2024 table is checked against `srd-5.2.1/p/gameplay-toolbox.json` in a test, so the code and the SRD cannot drift.

**B3: Monster index and search** (`books/monsterIndex.ts` and the builder's centre column).
- *ghoul* lists Ghoul first.
- *This place* is on by default.
- CR 1/8–5 plus Undead returns the count computed from the book data.
- Switching 2014/2024 swaps the source (Vampire Spawn 82 ↔ 90 HP).
- The index builds in < 150 ms on desktop and is cached per book version.
- Search works offline with books saved.
- Module NPCs show *stand-in* and never a book stat block (`no-book-content` passes).

**B4: Creatures of this place and saved plans** (`CampaignState.encounterPlans`, dm).
- Death House dungeon suggests the placed tokens, the NPC tags and (with A22) the keyed sets 29/31/34/38.
- Saving a plan on key 29 survives a reload and an export/import.
- The Rooms row for 29 shows the plan badge.
- **Run → Start is ≤ 3 taps** plus the players' numbers.
- `encounterPlans` never appears in a display message.

**B5: Placement and formation** (`core/formation.ts`).
- `tests/formation.test.ts` on the Death House dungeon grid: four ghouls dropped at a cell get four distinct, reachable, free cells within two rings.
- None is on a door, stair or trapdoor cell, and none is across a closed door.
- A Large creature takes 2×2 free cells.
- *At the slots* uses the authored positions.
- Every placed token starts hidden.
- One Ctrl-Z removes the whole placement.

**B6: Initiative entry and the DM roller and log** (`ui/rollSheet.ts`, `core/dice.ts`; 0.5.0 #6 moved).
- Four players' numbers take one tap per digit plus one Next each.
- Blank party rows roll privately at Start.
- Group rolls are one per group unless *Each*.
- The 2024 *Score* option uses the static initiative.
- Ties go to the bonus, then a one-tap DM choice.
- `tests/dice.test.ts` is seeded.
- No roll reaches the display except through *Show result* (0.4.0).

**B7: Start, pause, end and XP** (0.5.0 #7, Large controls, moved here).
- Pause removes the players' strip and keeps the fight.
- End shows the XP award: Death House's four ghouls give **200 XP each** to four characters. In-lair XP is used for lair creatures.
- *Milestone* awards none.
- `Sheet.xp` updates.
- `xpLog` is DM-only.
- With Large controls on, the dock, keypad and HP field are ≥ 56 px.

### 4.5 Measurements every step runs

| Measure | Threshold | Tool |
|---|---|---|
| Players'-side leak | 0 hidden ids, 0 HP strings, 0 dm keys in any display message or the Players-mode DOM | `player-safety` fuzz plus a display listener e2e |
| Tap counts | Next 1 · frame 1 · condition 2 · HP 2 + typing · delay 1 · ready 2 · reveal 1 · run a plan ≤ 3 · build from *this place* ≤ 4 | e2e counting `page.tap` calls per scenario |
| Phone layout | No horizontal page scroll at 390×844 and 844×390. Strip height ≤ 110 px. Every control ≥ 44 px and hit by `elementFromPoint`. | phone and phone-landscape projects |
| TV legibility | ≥ 18 px at 1280×720, contrast ≥ 4.5:1, a name on every tile | `display.spec` |
| WebGL | 1 canvas per window; 0 context losses | e2e |
| Camera | Framed combatant inside the free band; manual pans untouched | e2e |
| Performance | perf.spec within band. Next ≤ 4 ms of script. Strip render ≤ 2 ms for 15 entries. | `performance.measure` in e2e |

### 4.6 Risks

- **The model refactor (S0)** touches turns, ranges, member tokens and the projection at once. Mitigation: a pure core with unit tests first, and a migration fixture from a real save.
- **2014 encounter numbers are not SRD.** The thresholds and multiplier are numbers from the 2014 Basic Rules and DMG, not CC-BY text. The plan ships a numbers-only table like the open tools do. **The owner should confirm**; otherwise ship 2024 (SRD) maths only and show 2014 as *not available*.
- **iPad GPU time for portraits** is not measured yet. The pipeline is idle-only, cached and capped at one per idle slot, so the worst case is portraits arriving a little later, never a dropped frame.
- **Screen space on iPad portrait.** Strip, dock and tracker panel are three layers. The tracker shares the area panel's drawer, and the strip slims instead of covering tokens.
- **Scope.** Fourteen features over two versions. Anything that slips goes to 0.5.2, never into 0.6.0's list.
