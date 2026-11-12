# The initiative clock

Matt asked (2026-11-11): a stylized initiative tracker and encounter builder; a 1–30 dial, marked every 5 with
every number in between, the active turn lit, working like a clock; the party always there to drag in or type a
number; things pinned at the top of the order such as "reinforcements in 3 turns" or "recharging ability check",
and other checks like them; a look at the initiative tools other people use; and every quality-of-life feature a
DM could want. The table mixes the 2014 and 2024 rules, so both are supported throughout.

It opens from the clock button beside Initiative in the DM's top bar. It is DM only and kept on the DM's device
(localStorage, per campaign). Nothing in it goes to the players or into the repo.

## What is in it

| Piece | What it does |
|---|---|
| The dial | 1–30 clockwise from the top, in six blocks of five with heavy ticks and large numerals on 5, 10 … 30 and every count between. The very top is "the top of the round". Each combatant is a chip on its count, ties stacked outwards, a group rolled together is one chip with a count. The active count is lit, a hand points at it, an arc shows how far through the round you are, and chips that have acted fade. A ring around each chip is its hit points. Tap the middle for the next turn. |
| The tray | The party under the dial, always: drag a name onto its number (the middle shows the count under your finger), or type it. Delayed combatants wait here with an "act now" button. |
| The turn card | Who is up and what to check: roll a recharge (with a d6 button), regeneration, legendary actions back, a death save, concentration, repeat saves, conditions ending, uses left, the turn note. After the turn: who may take a legendary action, with "use one". |
| The order | Every entry with its count, AC, hit points (type 7 for damage, +7 to heal, t7 for temporary, =7 to set), passive Perception, legendary action and resistance pips, recharge and once-a-day buttons, concentration, conditions with rounds left and whose turn ends them, death saves, and tie-break arrows. "More" opens name, what the players call it, side, colour, numbers, concentration, a readied action, a turn note, conditions, hide, reaction, delay, its turn now, reroll, duplicate, down, remove. |
| Reminders | 22 presets in five groups (below) plus your own text: in N rounds, on round N, every round or every N rounds; at the top of the round, on a count, or right after a combatant. They stop the clock only when due and count down by themselves. |
| Build | Search the SRD monsters for the chosen rules (330 in 5.2.1, 317 in 5.1), the module's creatures and your own stat blocks; add as foe or ally with counts; difficulty under 2014 (adjusted XP, easy to deadly) and 2024 (low, moderate, high budgets) for your party's levels; average or rolled hit points; one roll per kind or each; roll with advantage or disadvantage; start hidden; save and reload named fights; "from this map" brings in the creatures placed on the open map. |
| Prepared fights | At the top of Build: the fights from the DM's encounter pack (the scenario notes' `encounters.json`), listed by dungeon with the creatures counted out (Death House: 12 fights, 21 creatures). "Add to the clock" brings one in with the books' stat block where one fits (by id, or the one named at the head of the creature's note, e.g. "ghast"; a note's "35 HP" is used); dice counts wait for the DM's typed roll; "Load" puts it in the builder to check the difficulty first. In the VTT the list is the pack opened under Initiative → Encounter packs; on the standalone page the pack is built in. |
| Your own stat blocks | Paste a stat block from a book you own (the Monster Manual, the module, D&D Beyond). The clock reads AC, hit points and dice, initiative, CR and XP, passive Perception, legendary actions, Legendary Resistance, recharges, once-a-day abilities and regeneration; you check the numbers and save it to this device. It never goes into the repo. |
| Party | Character, player, level, AC, passive Perception, initiative bonus, hit points and colour. Levels feed the difficulty. |
| Log | Every change, the round, game time (six seconds a round), time at the table, time spent on each combatant's turns, export and import. |
| Everywhere | Undo and redo for everything (Ctrl+Z, Ctrl+Y); N or Space for the next turn, P for the previous, M for the mini clock; the dock moves by its header and resizes from its corner; a mini clock (just the dial and the tray); full screen on phones; both campaign themes and dark mode; monster names open the app's stat-block card; End gives the XP of the foes defeated and keeps the party. |

The rules worked in: monsters at 0 are skipped but a player character at 0 keeps the turn for death saves; damage
at 0 is a failed death save, and massive damage kills; temporary hit points soak first; the concentration DC is 10
or half the damage (capped at 30 under the 2024 rules); reactions and legendary actions come back at the start of
the creature's turn; lair actions sit on 20 and lose ties; surprise is noted per edition (2014: no turn in round 1;
2024: disadvantage on initiative, a roll option in Build).

## The "top of the order" checks

Timing: reinforcements (count down), any countdown, every N rounds, a top-of-round check, surprise (round 1).
Creatures: lair actions on 20, recharge roll, legendary actions, regeneration, morale, the fallen rise, summons and
companions. Spells and effects: a one-minute spell ending (10 rounds), zone damage (Spirit Guardians, Moonbeam,
a burning floor), ongoing damage, repeat saves. Battlefield: a hazard on count 10, light changing (torches,
dawn: it matters for vampires), the place itself acting on 20. Table: a readied trigger, inspiration, check in
with the table.

Combatants get their own recharge, legendary, Legendary Resistance, once-a-day and regeneration reminders from
their stat block automatically, so these presets are for things that are not in the clock as creatures.

## What other trackers do, and what we took

| Tool | Strengths | Gaps | Taken |
|---|---|---|---|
| Improved Initiative (web, free) | The most refined free tracker: player view, editable creatures, prepared encounters, damage maths, dice | Learning curve; data tied to one browser unless exported; sync is paid | Prepared fights, HP maths, export |
| D&D Beyond Encounters and Combat Tracker | Clean, searchable, official monsters and characters | Needs a subscription; changing the order mid-fight was missing; PC hit points do not carry | Party levels to difficulty, monster search |
| Shieldmaiden, Kobold Plus Fight Club | Encounter building by XP budget, a players' screen | Separate from the map | Both rule sets' budgets side by side |
| dnd-battle-tracker (open source) | Offline, conditions with how long they have run, new conditions highlighted, killed and unconscious shown clearly, add creatures mid-fight, save and load | No stat blocks | Rounds left on conditions, down and dead marks, add any time |
| Obsidian Initiative Tracker | Group identical creatures, dice counts, XP by CR, SRD and custom bestiary | Notes app only | Groups with one roll, custom stat blocks |
| Foundry: Monk's Combat Details, Combat Carousel | Placeholder entries for lair actions, effects and reminders; turn alerts; rounds announced; estimates difficulty; portrait strip | Foundry only | Reminder entries, turn toasts, the round in the dial's middle |
| Baldur's Gate 3's turn bar (mistLAB's own research, docs/ENCOUNTERS.md) | Portraits, linked turns, acted marks, HP on portraits | No delay or ready; clutter in big fights | HP rings, acted fade, grouped chips, delay and ready |
| Paper and magnetic boards | Fast, visible, no learning curve | Nothing automatic | The dial itself: it reads like a board |

Sources: [arcaneeye's tracker comparison](https://arcaneeye.com/dm-tools-5e/best-dnd-5e-initiative-tracker/),
[dnd-battle-tracker](https://github.com/Paul-Ladyman/dnd-battle-tracker),
[Improved Initiative](https://github.com/danlite/improved-initiative),
[Obsidian Initiative Tracker](https://gh.hhj520.top/valentine195/obsidian-initiative-tracker),
[Monk's Combat Details](https://foundryvtt.com/packages/monks-combat-details),
[a D&D Beyond thread on combat tracker features](https://www.dndbeyond.com/forums/dungeons-dragons-discussion/dungeon-masters-only/239448-features-for-a-d-d-combat-tracker-app),
[Owlbear Rodeo's initiative extension](https://extensions.owlbear.rodeo/initiative-tracker).

## Not built yet (follow-ups)

- A players' view of the dial on the Player Display (hidden creatures left out, aliases shown).
- Linking clock entries to map tokens both ways (today "from this map" copies them in once; the map's own
  Initiative and turn bar still run separately).

## On its own page

The same clock also runs outside the VTT, as one HTML file with the SRD 5.1 and 5.2.1 monsters and conditions
inside it (and their CC-BY attribution in the footer): `npm run initclock:page -- <out.html> "Character|Player|level,…" [encounters.json]`. The
optional encounter pack becomes the page's prepared fights. The
names seed the party and are only in the output file, which is never committed. On that page monster and condition
names open a stat-block card of its own; there is no map, so "from this map" is not offered.

## Files

`app/src/core/initClock.ts` (pure rules engine), `app/src/ui/initClock.ts` and `initClock.css` (the clock, given a
host), `app/src/ui/initClockVtt.ts` (the VTT's host), `app/src/standalone/initClockPage.ts` and
`scripts/initclock/build.mjs` (the standalone page), `tests/init-clock.test.ts`; one button and one line in
`app/src/main.ts`, one script in `package.json`.
