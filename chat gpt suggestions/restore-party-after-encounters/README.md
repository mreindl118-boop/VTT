# Restore the party after encounters

Ending an encounter while any placed creature remains removes the playable party and allows a creature to be mistaken for it. Make party identity explicit and restore the party independently of surviving creatures.

## Review metadata

- Repository: `mreindl118-boop/VTT`
- Reviewed commit: `7cea5b32cddfe9ffb3c9e660dd179a815facbce4`
- Priority: **P1**
- Status: **Code-confirmed; runtime-unverified**
- Review date: 2026-10-12 UTC
- Method: Read-only source and existing-test inspection. Reproduction steps and acceptance tests below are proposed, not executed.
- Roadmap context: No exact overlap was established in the reviewed queue and roadmap sections. This is a defect in the existing encounter lifecycle, not a request for a new combat feature. Other branches and historical work were not exhaustively searched.

## Finding and evidence

`endEncounter()` removes all member tokens, but restores the party only when no token of any role remains at the location. A placed creature, including a hidden creature that did not participate, prevents restoration. The `party` getter then returns that creature because it selects the first token whose role is not `member`.

- [app.ts lines 369–375](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L369-L375): member removal and unrestricted local-token existence check.
- [app.ts lines 308–328](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L308-L328): `ensureDefaultToken()` also accepts any local token; `party` includes creatures.
- [app.ts lines 555–571](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L555-L571): creatures are excluded from player vision sources.
- [app.ts lines 339–362](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L339-L362): starting an encounter captures the `party` getter and removes the returned token.

## User impact

The party marker disappears after a routine fight. When only creatures remain, no token provides current player vision. Find Party and other party operations can target a creature. Reloading does not repair the missing party because `ensureDefaultToken()` sees the remaining creature. Starting a second encounter can remove that creature because it is mistaken for the party.

The control flow is confirmed in source. Its rendered appearance and persistence behavior have not been exercised in a browser.

## Reproduction to run

1. Open the test room or Death House with a normal party marker.
2. Place a creature and leave it hidden if desired.
3. Start an encounter containing two player characters. The creature need not participate.
4. End the encounter without deleting the creature.
5. Inspect tokens: no `role: 'party'` token remains, while `app.party` returns the creature.
6. Reload, inspect player vision, and start a second encounter to check persistence and unintended creature removal.

## Recommended change

Make party identity explicit. Restore exactly one party token independently of surviving creatures. Replace generic local-token existence checks with role-aware checks. During an encounter, use a separate current-combatant or follow target rather than treating a creature or arbitrary member as the party. Preserve creature IDs and state when ending or restarting encounters.

## Acceptance tests

- Ending an encounter restores exactly one party with zero, one, or multiple creatures remaining.
- Cover hidden and revealed creatures, and participating and nonparticipating creatures.
- Surviving creature IDs, positions, visibility, and hit points remain unchanged.
- Reload retains the restored party.
- Starting a second encounter does not delete a creature.
- Player vision resumes from the restored party.
- Find Party follows the intended party or combatant, never a creature selected merely by array order.

## Existing coverage and limits

The [existing encounter test at e2e/ui.spec.ts lines 55–76](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/e2e/ui.spec.ts#L55-L76) ends an encounter containing only member tokens. It does not cover a placed creature remaining on the map. This review did not run that test or verify every combat rule.
