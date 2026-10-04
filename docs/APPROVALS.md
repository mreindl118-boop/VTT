# Changes to existing features that need approval

These items change how something already in mistLAB works, so none of them is built until the owner says yes. The owner decided on 2026-10-04: every recommended item is approved, A10 and A31 are declined, and A14 and A25 wait until the performance guard ships. Each lists today's behaviour, the proposal and the reason. A28 and A29 were already requested and are in progress.

## Night-one fixes: wrong or leaking behaviour today

Recommendation: yes.

| Item | Today | Proposed | Why | Decision |
|---|---|---|---|---|
| A1 Seal Players mode (bug 5, ROADMAP V1) | In Players mode Floor, Section, Whole, Library, World and Back still work, and so do '/', 'n' and '['. | None of these render in Players mode and their shortcuts are inert. Leaving Players mode needs a 1 s hold or holding ']'. The cut is disabled on the players' side. | The screen faces the table. Recommended for a patch release (0.2.1) right after sign-off, together with A2, A3 and A5. | approved 2026-10-04; built in 0.2.1 |
| A2 Players' turn bar uses aliases and omits hidden combatants (bug 4) | A hidden Wolf appears as 'Wolf 19' in the players' turn bar and on the display. | Hidden combatants are omitted and revealed ones show playerName. The projection also strips hidden tokens' real names. | The most reported leak class. Increments 8 (Roll all foes), 9 (players'-side turn cues) and 11 (Start encounter here) stay behind a flag until it ships, and the LAN relay is blocked on it. | approved 2026-10-04; built in 0.2.1 |
| A3 Unexplored walls transparent on the players' side (bug 6) | Dark massing at t=0 reveals the dungeon plan. | Shell roles of unexplored cells render transparent at fogCurve 1. | Unexplored geometry must leave no trace. This touches the shared fog shader. | approved 2026-10-04; built in 0.2.1 |
| A4 Players' world map hides symbols of unrevealed places (bug 15) | The painted base shows every town and castle symbol. | Symbols for unrevealed pins are skipped on the players' side. | The symbols hint at unrevealed places. | approved 2026-10-04; built in 0.2.1 |
| A5 Stairs hop exactly one level per move (bug 1) | Floor 1 to Floor 3 in one move. | A pure linkHop() follows at most one link per move. | Breaks the first night; changes level navigation. | approved 2026-10-04; built in 0.2.1 |
| A6 Default party spawns at scene.entry (bug 9) | The party starts in the Castle catacombs. | Spawn prefers scene.entry. | Changes where a new campaign starts. | approved 2026-10-04; built in 0.2.1 |
| A7 Picking ignores cut or fogged geometry and prefers hidden targets near the tap (bug 7) | The first hit wins, even scenery above the cut. | Cut and fogged geometry is skipped. With the Reveal tool, hidden targets within 1.5 ft win. | Fixes unreachable secret doors; changes pick behaviour. | approved 2026-10-04; built in 0.2.1 |
| A8 Overhead preset is north-up (bug 11) | The preset is square to the grid. | It rotates to level.north. | Promised in the changelog; changes the camera preset. | approved 2026-10-04; built in 0.2.1 |
| A9 Declutter token tags, reserve the top band, separate world names (bugs 10, 13) | Labels overlap and some sit under the top bar. | Token tags join declutter, the top band is reserved, and world names are offset. | Readable at arm's length; changes label behaviour. | approved 2026-10-04; built in 0.2.1 |

## Table behaviour

Recommendation: yes, except A10 and A31 (keep the tap menu's text; keep the separate reveal undo until the new history has proven itself).

| Item | Today | Proposed | Why | Decision |
|---|---|---|---|---|
| A10 Room tap menu shrinks to actions | The menu carries descriptions and notes. | Descriptions live in the area panel. | Avoids a fourth surface for descriptions. | declined 2026-10-04 |
| A11 Automatic bloodied and down on the players' side | Tokens look the same at any HP. | A bloodied marker at half HP, a down state at 0, and health words on cards. | Players look for it; changes token rendering. | approved 2026-10-04; built in 0.5.0 |
| A13 DM free moves reveal only the destination | Auto-reveal follows every DM move. | A DM free move counts as a teleport. | Changes fog behaviour. | approved 2026-10-04; built in 0.4.0 |
| A16 Initiative survives Enter/Back | Changing location ends combat. | The encounter persists across the change. | Chases into buildings. | approved 2026-10-04; built in 0.5.0 |
| A17 Clock advances 6 s per round | Combat does not touch the clock. | +6 s per round. | Changes the clock. | approved 2026-10-04; built in 0.5.0 |
| A20 Service worker defers updates | skipWaiting and clients.claim. | An update chip; the update applies on next launch. | Prevents mid-session breakage. | approved 2026-10-04; built in 0.3.0 |
| A21 Display camera bounded to revealed extents | The display mirrors anywhere the DM looks. | Clamped to revealed extents plus a margin. | No map edges for players. | approved 2026-10-04; built in 0.4.0 |
| A23 '/' Enter and key-label taps open the area panel | Enter jumps, switching level and framing; key labels keep their current behaviour. | Both open the panel as well as framing. | Increment 7 adds the panel with separate buttons only. | approved 2026-10-04; built in 0.6.0 |
| A24 Two-tap measure gains waypoints | The second tap ends the measurement. | Taps add waypoints until a double-tap or Esc. | Increment 10 ships waypoints as a separate Path measure tool. | approved 2026-10-04; built in 0.7.0 |
| A30 Downed combatants skipped and defeated foes hidden by default | Next includes 0 HP creatures. | The increment 9 options become the defaults. | Changes initiative behaviour. | approved 2026-10-04; built in 0.5.0 Downed creatures are skipped; a character at 0 HP keeps the turn for death saving throws. |
| A31 One undo stack replacing the reveal-log button | Undo reveal pops a persisted, campaign-wide log; increment 4 adds a separate session history. | A single persisted history. | Simpler, but changes shipped undo semantics. | declined 2026-10-04 |

## Vision and fog

Recommendation: yes to A12 and A26; A14, A15 and A25 after the performance baseline exists.

| Item | Today | Proposed | Why | Decision |
|---|---|---|---|---|
| A12 Darkvision greyscale on the players' side | Computed but never rendered. | Darkvision-only cells are desaturated. | A clear 5e cue; a shader change. | approved 2026-10-04; built in 0.4.0 |
| A14 Authored scene lights feed players' vision, as secondary sources | Only the party torch is dynamic. | Lit and doused state; lights are secondary unless marked primary. | Changes fog and vision. | not now (2026-10-04); revisit after the performance guard ships |
| A15 Window wall role | Walls block sight and movement. | Windows pass sight and block movement. | Changes rules and scene data. | not needed: windows already pass sight and block movement (335 authored; checked 2026-10-04) |
| A25 Outdoor vision limit in the mists | Outdoor daylight sees across the map. | A per-scene limit that caps outdoor coverage. | Barovian atmosphere; changes fog. | not now (2026-10-04); revisit after the performance guard ships |
| A26 Soft fog edges on the players' side | Hard cell edges. | Feathered edges in the shared fog shader. | Reads better on a TV; a shader change. | approved 2026-10-04; built in 0.4.0 |

## Calendar and travel

Recommendation: yes.

| Item | Today | Proposed | Why | Decision |
|---|---|---|---|---|
| A18 Barovian calendar as the Curse of Strahd default | Harptos. | Barovian (shipped as an option in increment 14). | Matches how events are dated in the module. | approved 2026-10-04; built in 0.8.0 |
| A19 World travel advances the clock by road time | Crow-flies time. | Road time (shown alongside in increment 14). | Changes world-map travel and the clock. | approved 2026-10-04; built in 0.8.0 |

## Content

Recommendation: yes.

| Item | Today | Proposed | Why | Decision |
|---|---|---|---|---|
| A22 Wake authored creature slots (ROADMAP V2) | 458 slots are scenery that can be revealed per object. | SceneObject.creature and count are written into the 44 regenerated scene.json files. Wake creates tokens, and CampaignState.woken stops the slot drawing. A migration rewrites existing state.reveals that point at woken slot ids, with a test. | One tap from module creature to token. Changes scene content and fog targets; gated by the golden diff. | approved 2026-10-04; built in 0.6.0 |
| A27 Castle Ravenloft complete and legible (ROADMAP V4) | Partial: a grey slab. | Authored levels finished, behind the golden diff. | Changes an existing scene. | approved 2026-10-04; built in its own version after the smoothing pass merges |

## Requested by you on 2026-10-04

| Item | Today | Proposed | Why | Decision |
|---|---|---|---|---|
| A32 Initiative strip replaces the turn bar (requested by the owner) | The turn order is a bar at the bottom of the screen. | A Baldur's Gate 3-style portrait strip across the top; Next, Previous, End and Find move to a bottom action dock; `n` still advances the turn. | The owner asked for it on 2026-10-04. | approved 2026-10-04 (requested); built in 0.5.0 |

## Already requested by you

Recommendation: already in progress.

| Item | Today | Proposed | Why | Decision |
|---|---|---|---|---|
| A28 Wilderness fidelity and the mist wall (ROADMAP V5) | Crude mist columns. | New mist-wall and outdoor fidelity pass. | Changes existing visuals. | approved (requested) |
| A29 Movable and collapsible panels with saved layout (task #69) | Fixed panel positions. | Drag, collapse and remember the layout. | Changes the existing UI layout. | approved (requested) |

