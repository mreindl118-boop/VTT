# Dispose obsolete map and range resources

Reviewed commit: 7cea5b32cddfe9ffb3c9e660dd179a815facbce4

Priority: P1 for session stability; calibrate severity from device measurements

Evidence status: Code-confirmed missing GPU-resource cleanup; memory growth magnitude and device failures unmeasured. Reproduction and acceptance tests below have not been executed.

Existing work: The repository already plans performance improvements. This document identifies concrete resource-lifetime paths rather than claiming measured frame-rate or crash results.

## Intended behavior

Switching maps and advancing encounters should keep a long-running iPad session within a stable memory budget.

## Finding and evidence

[App.open](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L164-L186) removes old level roots and token objects but disposes only coverage textures. Old backdrop and context roots are [detached at lines 231–232](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L228-L247) without resource cleanup. New geometry and materials are constructed on each scene load.

[refreshRange](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L407-L419) also detaches and replaces each old overlay. [buildRangeOverlay](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/render/rangeOverlay.ts#L22-L35) allocates fresh geometry and private materials. There is no corresponding disposal on either replacement path.

Three.js requires explicit disposal of obsolete geometries, materials and textures; removing a mesh does not release those GPU resources. See its [resource disposal guide](https://threejs.org/manual/pages/how-to-dispose-of-objects.html).

The [shared palette cache](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/render/materials.ts#L217-L237) means indiscriminately disposing every material would be the wrong fix.

## Impact

Map navigation and tactical refreshes leave obsolete allocations behind. This matters for mobile browsers and long sessions. No specific memory-growth rate, slowdown or crash threshold has been measured.

## Reproduction to run

1. Render Death House, a large outdoor map and a building interior in turn.
2. Repeat the round trip while recording renderer.info.memory and program counts after frames settle.
3. Separately refresh a combatant's overlay repeatedly without changing scenes.
4. Check for monotonic growth instead of a plateau after shared resources warm up.

## Recommended remediation

Introduce explicit ownership and cleanup for loaded scenes, token figures, overlays, backdrops and contexts. Dispose unique geometries, private materials and owned textures before dropping references. Track or reuse shared palette materials and cached textures separately. Cancel and dispose obsolete asynchronous context candidates.

## Acceptance tests

- Repeated scene round trips settle near a stable warmed baseline.
- One hundred range refreshes do not grow retained geometry indefinitely.
- Existing visual regressions remain unchanged.
- Shared resources remain usable by live objects.
- Old labels and listeners are removed.
- Measure behavior on a target iPad.

## Review boundary

This concerns resource lifetime, not whether current maps meet their triangle and draw-call budgets. The atomic-navigation finding separately prevents stale loads from mounting competing scenes.

