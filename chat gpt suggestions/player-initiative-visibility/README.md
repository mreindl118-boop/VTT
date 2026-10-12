# Honor hidden creatures and aliases throughout initiative

- Repository: `mreindl118-boop/VTT`
- Reviewed SHA: `7cea5b32cddfe9ffb3c9e660dd179a815facbce4`
- Priority: **P1**
- Status: **Code-confirmed / runtime-unverified**
- Review date: 2026-10-12 UTC
- Known roadmap overlap: Known overlap: docs/ROADMAP.md proposes filtering hidden combatants and using aliases in the turn bar. This review independently verifies that issue and additionally traces hidden-current-combatant range overlays on both player surfaces.

## Purpose and intended behavior

Maintain the established hidden/alias contract across every encounter surface. This is not a proposal to hide ordinary initiative results: `Token.hidden` explicitly means players cannot see a placed creature yet, and `playerName` is their intended identity. See [app/src/state/campaign.ts:22–28](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/state/campaign.ts#L22-L28) and [main.ts:480](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/main.ts#L478-L484).

## Finding and evidence

Two encounter paths bypass that contract.

### One-screen Players turn bar

- [app/src/ui/encounter.ts:91–94](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/ui/encounter.ts#L87-L95) uses `restricted` only to hide DM action buttons.
- Line 92 renders every encounter entry and resolves its label through `state.roster[].name`, without checking its token's `hidden` flag or `playerName`.
- Line 93 displays `cur.sheet.name`, speed, and range.
- [app/src/app.ts:862–866](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L861-L867) creates a creature sheet using canonical bestiary `e.name`.
- Conversely, [app/src/app.ts:525,533](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L521-L534) correctly suppresses hidden token models and aliases visible token tags in restricted views.

### Hidden-current-combatant overlays

- [app/src/app.ts:408–418](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L407-L419) chooses the current token and builds its range overlay regardless of `restricted` or `tok.hidden`.
- [app/src/app.ts:555–578](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L554-L579) invokes this during recomputation, including Player Display state synchronization.
- [app/src/render/rangeOverlay.ts:22–35](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/render/rangeOverlay.ts#L22-L35) draws movement/strike quads with unpatched `MeshBasicMaterial` and `fog:false`.

The turn-bar disclosure applies to one-screen Players mode, not the separate Player Display, where the bar is never constructed. Hidden-combatant range geometry applies to both surfaces.

## Reproduction to execute

1. Place a hidden creature and give it an alias distinct from its canonical name.
2. Add it and a PC to initiative.
3. Enter Players mode: inspect the order bar before revealing the creature.
4. Make the hidden creature current; inspect its movement/strike area in Players mode and a separate Player Display.
5. Reveal it: verify whether its alias replaces its canonical sheet name.

## Impact

An ambush or disguised identity leaks despite the model being hidden. Range geometry can reveal location, reachable terrain, and tactical capabilities.

## Suggested remediation

Resolve encounter presentation through each entry's token. Exclude genuinely hidden entries or use an explicitly approved non-identifying placeholder policy; use `playerName` for permitted creature identities. Gate range helpers before building geometry for hidden current combatants on player-facing surfaces. Do not change initiative ordering/state merely to filter presentation.

## Acceptance tests

- Hidden creature absent from player order text, title attributes, current-combatant text, and overlays.
- Revealed creature uses its per-token alias, including multiple copies sharing one creature sheet.
- PC turn presentation and movement budgets remain unchanged.
- DM retains full identities and tactical overlays.
- Switching views and changing turns cannot leave stale secret text or geometry.
- [tests/player-safety.test.ts:5–20](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/tests/player-safety.test.ts#L5-L20) currently checks authored Death House object labels only; add live-token/encounter projection coverage.

## Review coverage

Inspected encounter rendering, live token/sheet identity, range construction/materials, recomputation, Player Display synchronization, and relevant UI/slider/player-safety tests. No encounter was run; screen appearance and tactical-overlay screenshots remain unverified. The creature/party lifecycle defect is a separate state finding, not part of this document.

## Verification boundaries

This report records code-confirmed logic at the reviewed commit. Reproduction steps and acceptance tests are proposed, not executed. No repository code, test, build, browser session, or PWA was run for this finding.

Three surfaces must be tested independently:

- Slider preview: `mode='dm'`, `view='dm'`, `t=0`.
- One-screen Players mode: `mode='dm'`, `view='players'`.
- Separate Player Display: `mode='player'`; no `buildDmUi()` or turn bar.

