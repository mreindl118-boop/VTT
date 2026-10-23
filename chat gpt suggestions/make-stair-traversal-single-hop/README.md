# Make stair traversal take one hop

One stair action can skip floors or take a different link from the one requested. Resolve one transition against the original token position and apply it once.

## Review metadata

- Repository: `mreindl118-boop/VTT`
- Reviewed commit: `7cea5b32cddfe9ffb3c9e660dd179a815facbce4`
- Priority: **P1**
- Status: **Code-confirmed; runtime-unverified**
- Review date: 2026-10-12 UTC
- Method: Read-only source, actual Death House link data, and existing-test inspection. Proposed reproductions and tests were not executed.
- Roadmap context: **Known roadmap issue, independently reconfirmed at this commit.** [ROADMAP.md lines 42–53](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/docs/ROADMAP.md#L42-L53) explicitly calls for one-hop stairs. This document supplies current evidence and regression criteria; it does not claim a new discovery or supersede the existing work queue.

## Finding and evidence

`afterPartyMove()` continues checking later links after taking a stair. Its `break` exits only the inner endpoint loop. The mutated destination level and position become inputs to subsequent links.

`takeLink()` does not directly traverse its selected link. It moves the party onto that link's endpoint and invokes the same global scan, allowing an earlier neighboring link to win.

- [app.ts lines 471–517](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L471-L517): endpoint staging, global link scan, token mutation, and inner-loop-only break.
- [Death House scene.json lines 14694–14730](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/locations/appB/death-house/scene.json#L14694-L14730): the first two links share the same f2 endpoint and are ordered f1 to f2, then f2 to f3.

The authored endpoints are `[25.5, 27.5]`. Square-cell snapping yields a position within the 5.5 ft trigger radius, so the second link is eligible immediately after the first transition.

## User impact

From f1, the Floor 2 stair can land the party on f3 in a single action. Traversal depends on link array order. Explicitly requesting the f2-to-f3 link can instead traverse the earlier f2-to-f1 link because the global scan examines it first.

## Reproduction to run

1. Open Death House and place the party on f1.
2. Click the Floor 2 stair marker or move onto its endpoint.
3. Compare the destination with the expected f2. The source path continues to f3.
4. Place the party on f2 and invoke `takeLink('lk-spiral-2-3')` in a focused test. Verify whether the earlier f1/f2 link redirects it to f1.
5. Repeat after permuting the link array to expose order dependence.

## Recommended change

Resolve exactly one link against the token's original level and position, then apply one transition. An explicit link action must use its requested ID and direction rather than rescanning all links. Arrival should not immediately trigger another traversal or bounce the party back. A pure transition helper would make these invariants testable without rendering.

## Acceptance tests

- f1 to f2 and f3 to f2 each take one hop.
- Explicit f2 to f3 always uses that link.
- Permuting link array order does not change a requested traversal.
- A no-op move at the arrival endpoint does not immediately reverse the hop.
- Cover shared-endpoint stairs, dumbwaiters, trapdoors, and both directions.
- Validate destination level, snapped position, final status text, and Player Display synchronization.
- Add a UI test for clicking the Floor 2 marker and a pure test for multiple nearby links.

## Existing coverage and limits

[tests/movement.test.ts](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/tests/movement.test.ts) covers walls, doors, and floor reachability. [e2e/move.spec.ts](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/e2e/move.spec.ts) covers horizontal party movement. Neither covers vertical-link traversal at this commit. Link and spawn data for every other scene were not exhaustively inspected.
