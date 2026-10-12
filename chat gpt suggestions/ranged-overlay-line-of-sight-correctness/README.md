# Evaluate ranged attacks from every reachable firing position

Reviewed commit: 7cea5b32cddfe9ffb3c9e660dd179a815facbce4

Priority: P2

Evidence status: Code-confirmed algorithm and contract mismatch; proposed fixture not executed. Reproduction and acceptance tests below have not been executed.

Existing work: The reviewed code promises shots from any reachable position. No claim is made about complete D&D rules conformance or unreviewed WIP implementations.

## Intended behavior

The ranged overlay promises cells attackable from some reachable position, as stated by the [RangeResult contract](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/core/range.ts#L26-L32).

## Finding and evidence

The [ranged-cell loop](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/core/range.ts#L101-L120) chooses one nearest reachable cell by Chebyshev distance and rejects the target if that ray is blocked. It never considers another reachable origin, including an equally near one with a clear ray.

The same ray check treats all sight blockers as opaque. It ignores the terrain flag, although the [central sight policy](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/core/light.ts#L50-L57) permits sight across one terrain wall and blocks two.

## Impact

The overlay can exclude a legal move-and-shoot target and disagree with the main vision system.

## Reproduction fixture to run

Use floor rect(0, 0, 40, 20), start [2.5, 2.5], speed 5, reach 0, range 20, no occupied cells and a normal wall from [10, 0] to [10, 5].

The target [22.5, 2.5] has a blocked ray from reachable [7.5, 2.5], but a clear in-range ray from reachable [7.5, 7.5]. Current nearest-tie selection keeps the former and excludes the target.

Also compare the ranged overlay against hasLineOfSight with one terrain wall, then two.

## Recommended remediation

Test candidate firing positions within range until one has valid sight. Use spatial and distance pruning to protect performance. Reuse or explicitly align with the central line-of-sight policy, including terrain-wall and endpoint semantics.

## Acceptance tests

- The described corner fixture includes the target.
- Targets blocked from every reachable origin remain absent.
- Terrain-wall behavior matches the agreed vision policy.
- Reordering equally near candidates does not change the result.
- Large movement and range combinations remain responsive.
- Existing closed-door and occupied-cell tests still pass.

## Review boundary

This does not certify range distance rules, diagonal-history state, difficult terrain, size footprints or every combat rule. Those need separate focused review.

