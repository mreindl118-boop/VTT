# Hide live creatures at the Players slider endpoint

- Repository: `mreindl118-boop/VTT`
- Reviewed SHA: `7cea5b32cddfe9ffb3c9e660dd179a815facbce4`
- Priority: **P1**
- Status: **Code-confirmed / runtime-unverified**
- Review date: 2026-10-12 UTC
- Known roadmap overlap: Not explicitly described by the reviewed roadmap passages. Related to its general Players-mode sealing goal; this finding concerns the DM slider preview, a distinct surface.

## Purpose and intended behavior

Make the slider's player endpoint safe for the table, including creatures added during play. [docs/SLIDER.md:5](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/docs/SLIDER.md#L3-L7) explicitly promises that `t=0` is safe to point at players; [lines 29–31](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/docs/SLIDER.md#L25-L32) specify hidden creatures are invisible. [main.ts:480](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/main.ts#L478-L484) also says placed creatures start hidden.

## Finding and evidence

Authored hidden scene objects use slider opacity, but placed creature tokens follow a separate path that ignores the effective slider value:

- [app/src/app.ts:524–525](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L521-L525): hidden creatures are omitted only when `this.restricted` is true.
- [app/src/app.ts:533](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L531-L534): unrestricted token labels use canonical `t.name`.
- [app/src/app.ts:536–541](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L536-L541): hidden creatures receive fixed opacity `0.45`; their materials deliberately bypass coverage fog.
- [app/src/app.ts:689](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L689-L690): `setT()` only calls `applySlider()`.
- [app/src/app.ts:591–657](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L591-L657): `applySlider()` updates authored targets and `cur.labels`, but not live-token visibility/materials or their separately created labels.
- [app/src/app.ts:761](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L760-L765): `restricted` depends on display/view mode, not `t`.

Thus lowering the slider to zero while remaining in DM view leaves the hidden creature's ghost and canonical name on the shared screen. This does not affect the hidden-token omission in explicit Players mode or the separate Player Display.

## Reproduction to execute

1. Open the test room in DM view.
2. Add a Dire wolf using Creatures; leave it hidden.
3. Lower the slider to zero without selecting Players mode.
4. Inspect the creature mesh and canonical token label.
5. Switch to Players mode as a control: the hidden token should then disappear.

## Impact

A DM can disclose an unrevealed creature's existence, position, and identity while using the documented safe sharing control.

## Suggested remediation

Apply a unified player-facing projection to live-token bodies, labels, hover/card text, and selection helpers. Hidden live tokens should follow the appropriate slider curve in DM preview and disappear at zero; explicit Players mode and Player Display should remain pinned to that safe projection.

## Acceptance tests

- Hidden live creature: absent at `t=0`, partial presentation at intermediate `t` according to the chosen curve, present at DM endpoint.
- Revealed creature: permitted player alias at `t=0`, never canonical secret identity.
- Lowering and raising the slider repeatedly updates already-created tokens.
- Cover authored creature slots separately from placed live tokens.
- Existing [e2e/ui.spec.ts:123–139](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/e2e/ui.spec.ts#L123-L139) tests explicit Players mode only; add slider-endpoint coverage.

## Review coverage

Inspected token creation/rendering, slider application, mode predicates, the relevant product contract, and existing player-safety/slider/UI tests. Actual pixels, hover hit-testing, and regressions at intermediate slider values remain unverified.

## Verification boundaries

This report records code-confirmed logic at the reviewed commit. Reproduction steps and acceptance tests are proposed, not executed. No repository code, test, build, browser session, or PWA was run for this finding.

Three surfaces must be tested independently:

- Slider preview: `mode='dm'`, `view='dm'`, `t=0`.
- One-screen Players mode: `mode='dm'`, `view='players'`.
- Separate Player Display: `mode='player'`; no `buildDmUi()` or turn bar.

