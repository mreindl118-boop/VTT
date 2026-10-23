# Restrict scene navigation during one screen player handover

- Repository: `mreindl118-boop/VTT`
- Reviewed SHA: `7cea5b32cddfe9ffb3c9e660dd179a815facbce4`
- Priority: **P1**
- Status: **Code-confirmed / runtime-unverified**
- Review date: 2026-10-12 UTC
- Known roadmap overlap: Partial known overlap: docs/ROADMAP.md proposes hiding Floor/Section/Library/World/Back controls in Players mode. This review independently traces those active paths and additionally identifies the world-card Open callback bypass of the direct-pin canMove guard.

## Purpose and intended behavior

Make one-screen handover preserve DM control over campaign/location selection. [docs/SLIDER.md:69–71](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/docs/SLIDER.md#L67-L71) and [main.ts:484](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/main.ts#L480-L484) promise no DM controls in Players mode. Existing world-map tests intentionally allow a filtered player map, so retaining a read-only regional map is a valid design choice.

## Finding and evidence

- [main.ts:64–74](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/main.ts#L64-L74) puts Library, Back, Floor, Whole, and Section outside the `.dm-only` group.
- [styles.css:91](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/styles.css#L86-L92) hides only elements carrying the relevant class; [styles.css:175–176](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/styles.css#L175-L176) explicitly retains left and center topbar groups.
- [main.ts:272,282–295](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/main.ts#L272-L297) runs floor/scene navigation without checking `restricted`.
- [ui/library.ts:10–21](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/ui/library.ts#L10-L21) lists the complete campaign manifest, location keys/names, and page metadata with no reveal filter.
- [ui/library.ts:29–35](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/ui/library.ts#L29-L35) permits opening any built location.
- Opening a scene affects more than camera browsing: [app.ts:252](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L251-L255) calls `moveWorld`; [app.ts:775–778](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L774-L779) automatically reveals that pin.
- A second path exists even if Library is hidden: [worldmap.ts:306](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/ui/worldmap.ts#L301-L307) guards direct pin entry with `host.canMove`, but [worldmap.ts:329–334](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/ui/worldmap.ts#L323-L335) unconditionally renders and invokes the card's “Open” scene action. [main.ts:295](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/main.ts#L288-L297) binds it to `app.open()` even for a restricted host.

## Reproduction to execute

1. Enter Players mode and open Library.
2. Inspect unvisited locations and choose another built scene.
3. Check current scene and world reveal state.
4. Separately, reveal a world pin with a scene, open its player-facing card, and click “Open.” Compare with the guarded direct-pin path.

## Impact

Someone using the handed-over screen can discover the module's location list, change scenes/campaigns, and mark locations as visited/revealed.

## Suggested remediation

Remove or disable DM navigation affordances during handover and enforce equivalent guards in actions. Preserve an intentional, tested DM-return mechanism. If the regional map remains available, allow permitted browsing but guard scene entry consistently at every callback.

## Acceptance tests

- Players mode cannot activate Library/campaign switch, unrestricted floor/section selection, or world-card scene entry.
- Allowed world-map browsing shows only permitted information.
- Attempted restricted navigation leaves location, world trail, and reveal state unchanged.
- A documented DM-return mechanism remains usable.
- Separate Player Display is tested separately; it does not build this topbar.
- Do not treat a same-browser user deliberately changing URL or using DevTools as a newly discovered authentication vulnerability.

## Review coverage

Inspected topbar markup/CSS, navigation handlers, the complete Library and world-map implementations, scene-open/world-reveal side effects, and the relevant product contract/UI tests. Actual UI interaction, focus/keyboard variants, and persisted consequences remain runtime-unverified.

## Verification boundaries

This report records code-confirmed logic at the reviewed commit. Reproduction steps and acceptance tests are proposed, not executed. No repository code, test, build, browser session, or PWA was run for this finding.

Three surfaces must be tested independently:

- Slider preview: `mode='dm'`, `view='dm'`, `t=0`.
- One-screen Players mode: `mode='dm'`, `view='players'`.
- Separate Player Display: `mode='player'`; no `buildDmUi()` or turn bar.

