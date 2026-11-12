# Encounter packs

Matt, 2026-11-11: *"I need a pipeline to push combat encounters to vtt from that when they may occur"*, "that" being
the DM's if-then scenario prep. An encounter pack is the bridge: the prep writes each possible fight as a record, the
DM opens the pack in mistLAB on the DM's own device, and one tap stages a fight on its map.

## The flow

1. **Prep writes the pack** outside the repo (it is spoiler-heavy DM prep): a JSON file
   `{"schema": 1, "encounters": [...]}`. In this campaign it lives in the project's notes as
   `cos-notes/scenarios/encounters.json`.
2. **Check it** against this build: `npm run encounters:check -- path/to/encounters.json`. Errors are records the app
   will skip (unknown creature id, a count that is neither a number nor dice); warnings are records that will stage
   differently than written (an area not on the map stages beside the party).
3. **Open it in the app:** Initiative (crossed swords) → *Encounter packs…* → *Open pack…*. The pack is kept in this
   device's localStorage only. It is never written to the campaign state, so nothing of it reaches the Player Display.
4. **Stage:** each card shows its source (Module with page, Reloaded option, or Generative), where it happens, the
   trigger, the creatures, and its difficulty in **both rule sets** for the party levels typed at the top. A dice
   count (`3d6`, `1d4+2`) is never rolled by the app: the DM types the table's total, which must fall inside the
   dice's range. *Stage* opens the scene and level, and places the creatures in the area's room (spiralling out from
   its middle, then onto the rest of the floor), or beside the party marker. They start hidden, with their alias as
   what the players see.
5. **Fight:** the Initiative sheet reopens with the staged creatures under *Creatures on this map*; tick them and
   start. *Remove staged* on the card takes back the tokens that one staging placed.

## Record fields

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Unique slug. |
| `title` | | Shown on the card (defaults to the id). |
| `scene` | yes | VTT scene path as under `locations/`, e.g. `appB/death-house`, `ch03/E`. A path that is not a built map (such as `ch02/barovia-region`) stages beside the party on whatever map is open. |
| `area` | | The book's area key on that scene, e.g. `29`, `E4`. |
| `level` | | Scene level id, when the key alone is ambiguous or for a party placement. |
| `placement` | | `area` (default when `area` is set) or `party`. |
| `terrain` | | An id from `manifests/encounters.json` terrain, for wilderness fights. |
| `trigger` | | One line: when this fight happens. |
| `source` | | `book`, `reloaded` or `generative` (anything else reads as generative). |
| `page` | | Printed page, for `book` records. |
| `creatures` | yes | `{id, count, note?, hidden?, alias?, cr?}`: `id` from `manifests/characters.json`; `count` a number or dice; `hidden` defaults to true; `alias` is what players see; `cr` when the app has no numbers for the creature (named NPCs, stand-ins). |
| `difficulty` | | The prep's own note, shown beside the computed difficulty. |
| `notes` | | DM notes, folded on the card. |

## Difficulty, 2014 and 2024

The table mixes 5e and 5.5e (Matt, 2026-11-11), so each card shows both, the selected Rules edition first:

- **2014 (SRD 5.1):** total XP × the group multiplier (shifted one step for parties under three or of six and more)
  against the party's Easy / Medium / Hard / Deadly thresholds.
- **2024 (SRD 5.2.1):** total XP against the party's Low / Moderate / High budgets.

XP comes from each creature's CR: the pack's `cr`, else the module numbers in `app/src/bestiary.ts`. A creature
without either still counts as a foe for the 2014 multiplier but adds no XP; the card says how many were left out.

## Not yet

- Large and Huge creatures take one cell each when staged; spread them by hand.
- The pack is per device. Opening it on the Player Display window is possible but pointless (that window is the
  players' view).
- When the encounter builder (queue item 13, `docs/ENCOUNTERS.md` 2.8) lands, a pack record maps onto its
  `EncounterPlan` (`foes[].ref.creature`, `count`, `hidden`, `alias`, `at: 'slots' | 'cluster'`), so packs can
  become saved plans.
