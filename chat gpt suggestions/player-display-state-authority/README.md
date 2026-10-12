# Prevent the Player Display from mutating saved campaign state

- Repository: `mreindl118-boop/VTT`
- Reviewed SHA: `7cea5b32cddfe9ffb3c9e660dd179a815facbce4`
- Priority: **P1**
- Status: **Code-confirmed / runtime-unverified**
- Review date: 2026-10-12 UTC
- Known roadmap overlap: No explicit equivalent found in the reviewed roadmap passages. Its future transport/validated-intent work is related, but this is an existing same-browser CSS-label mutation path.

## Purpose and intended behavior

Keep the separate display a subscriber to the DM's authoritative campaign. [app/src/state/campaign.ts:1](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/state/campaign.ts#L1-L3) explicitly says the DM window is authoritative, and [docs/SLIDER.md:73–77](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/docs/SLIDER.md#L73-L77) describes the Player Display as receiving DM state.

## Finding and evidence

The display blocks canvas editing but leaves another mutation path active:

- [app/src/app.ts:968](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L964-L975) returns from canvas `pointerdown` in player-display mode.
- [app/src/app.ts:205–221](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L205-L221) still creates door and stair/link CSS labels; only `dm-note` labels are skipped. Door and link labels receive unconditional `toggleDoor()` and `takeLink()` click handlers.
- [app/src/styles.css:122](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/styles.css#L120-L135) makes those labels pointer-active.
- They live under `#stage .labels`, not the `#ui` hidden by [styles.css:83](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/styles.css#L81-L92).
- The link-hiding rule at `styles.css:135` targets `data-view='players'`, not `data-mode='player'`.
- [app/src/app.ts:767–772](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L767-L772) permits unlocked door toggles and commits them; [472–478](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L471-L479) moves the party through a link and commits.
- [app/src/app.ts:694–704](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L694-L704) schedules or performs IndexedDB writes without a display-mode guard, using the same campaign store key defined at [line 62](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L62).
- [app/src/app.ts:1248–1250](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L1248-L1252) prevents the display from broadcasting its mutation; [1268](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L1267-L1274) makes the DM ignore non-hello messages anyway.

This creates local display divergence and a route for the display to overwrite the shared persisted campaign snapshot, rather than an authorized player intent handled by the DM.

## Reproduction to execute

1. Open DM and Player Display windows in the same browser context.
2. Reveal an unlocked door with a visible marker.
3. Click that marker in the display.
4. Compare `doorsOpen` in the two windows after the save debounce.
5. Inspect persisted campaign state or close the display and reload the DM before a later DM commit can mask the discrepancy.
6. Repeat with a visible stair marker.

## Impact

An ostensibly passive table display can alter doors or party position independently of the DM, then persist that fork. No developer console is required. Whether a particular interaction is masked by a later DM save is timing-dependent and must be tested.

## Suggested remediation

Enforce authority at the state-mutating/save boundary as well as the input layer. Disable display mutation handlers; make Player Display persistence read-only. If player interaction is later supported, transmit validated intents to the authoritative DM instead of saving whole local snapshots.

## Acceptance tests

- Clicking every Player Display door/link marker leaves DM state, display authoritative state, and IndexedDB unchanged.
- Display initialization, campaign changes, and close/reload do not write competing saves.
- One-screen Players mode retains its intentionally permitted walking/unlocked-door behavior.
- DM actions still synchronize to the display.
- Test interrupted display updates and simultaneous DM edits.

## Review coverage

Inspected CSS-label construction/hosting, CSS pointer rules, canvas input gating, door/link mutations, commit/flush persistence, channel message types, and DM/display synchronization. Actual browser click delivery, save ordering, and reload behavior remain runtime-unverified. This document does not claim a remote exploit or an authentication bypass.

## Verification boundaries

This report records code-confirmed logic at the reviewed commit. Reproduction steps and acceptance tests are proposed, not executed. No repository code, test, build, browser session, or PWA was run for this finding.

Three surfaces must be tested independently:

- Slider preview: `mode='dm'`, `view='dm'`, `t=0`.
- One-screen Players mode: `mode='dm'`, `view='players'`.
- Separate Player Display: `mode='player'`; no `buildDmUi()` or turn bar.

