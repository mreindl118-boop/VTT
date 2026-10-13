# Hide unrevealed world map landmark artwork

- Repository: `mreindl118-boop/VTT`
- Reviewed SHA: `7cea5b32cddfe9ffb3c9e660dd179a815facbce4`
- Priority: **P2**
- Status: **Code-confirmed / runtime-unverified**
- Review date: 2026-10-12 UTC
- Known roadmap overlap: Known overlap: docs/ROADMAP.md proposes suppressing unrevealed world-map symbols. This document independently traces the unconditional painted layer and the incomplete SVG-only reveal filter.

## Purpose and intended behavior

Honor the world-map reveal state consistently across labels and artwork. [worldmap.ts:239–240](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/ui/worldmap.ts#L239-L240) explicitly states players see only revealed places; [state/campaign.ts:76–77](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/state/campaign.ts#L74-L77) defines the reveal list accordingly.

## Finding and evidence

- [app/src/ui/worldmap.ts:139–156](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/ui/worldmap.ts#L139-L156) paints symbols for every settlement, castle/tower/temple, camp, and ruin in `W.pins`.
- [worldmap.ts:60](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/ui/worldmap.ts#L60-L62) accepts only canvas and view bounds, so painting has no viewer or reveal-state input.
- [worldmap.ts:197–210](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/ui/worldmap.ts#L197-L210) creates this base once and blits it to the visible canvas.
- [worldmap.ts:239–254](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/ui/worldmap.ts#L239-L254) hides unrevealed SVG pins and list entries only; it cannot remove symbols already painted beneath them.
- [main.ts:288–296](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/main.ts#L288-L297) correctly passes `dm:false` in Players mode, so this is a genuine mismatch inside the world-map implementation.

## Reproduction to execute

Reveal only the current village, switch to Players mode, and open the world map. Compare an unrevealed camp/castle/settlement's symbol area with its hidden SVG marker and list entry.

## Impact

Players learn the existence and positions of locations deliberately kept unrevealed, even though their names and interactive markers are hidden.

## Suggested remediation

Separate neutral geography from reveal-dependent landmark artwork. Feed the same allowed-pin set into both painting and SVG/list generation, and invalidate dependent painting when reveals change. Do not blindly remove all roads, peaks, or geographical labels: their intended public status needs separate product/content decisions.

## Acceptance tests

- Hidden settlement/castle/camp/ruin has no pin, list entry, or base-layer symbol.
- Reveal and hide update all layers consistently.
- DM artwork remains complete.
- Verify both campaign styles and multiple zoom levels.
- Existing [e2e/ui.spec.ts:94–109](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/e2e/ui.spec.ts#L94-L109) checks SVG visibility and absence of reveal buttons, not painted pixels.
- There is currently no normal world-map shell in the separate Player Display; do not claim its world-map UI was reproduced there.

## Review coverage

Inspected the complete world-map painting and interactive-layer code, host construction in main.ts, world reveal state, and existing world-map tests. Pixel severity, rendering at specific viewport sizes, and every authored world-map landmark remain unverified.

## Verification boundaries

This report records code-confirmed logic at the reviewed commit. Reproduction steps and acceptance tests are proposed, not executed. No repository code, test, build, browser session, or PWA was run for this finding.

Three surfaces must be tested independently:

- Slider preview: `mode='dm'`, `view='dm'`, `t=0`.
- One-screen Players mode: `mode='dm'`, `view='players'`.
- Separate Player Display: `mode='player'`; no `buildDmUi()` or turn bar.

