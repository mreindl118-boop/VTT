# Protect campaign saves from storage failures

A failed IndexedDB read is treated as a missing campaign, and write failures are silent. Preserve existing saves on load failure and make durability visible before relying on autosave.

## Review metadata

- Repository: `mreindl118-boop/VTT`
- Reviewed commit: `7cea5b32cddfe9ffb3c9e660dd179a815facbce4`
- Priority: **P1**
- Status: **Code-confirmed; runtime-unverified**
- Review date: 2026-10-12 UTC
- Method: Read-only source and existing-test inspection. Storage fault injection and lifecycle checks below were not executed.
- Roadmap context: Overlaps the campaign-safety theme in [ROADMAP.md lines 122–131](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/docs/ROADMAP.md#L122-L131), which proposes persistent storage and export/import. [QUEUE.md](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/docs/QUEUE.md) also names backup work on other commits. Those implementations were not reviewed here; this finding applies only to the stated snapshot and does not claim that queued backup work lacks fixes.

## Finding and evidence

`loadCampaign()` converts every IndexedDB read failure to the same `undefined` result as a missing save, then initializes a new campaign. If a later save succeeds, it can overwrite the original campaign with that replacement.

Autosaves discard the returned write promise without handling rejection or displaying save status. They are delayed 150 ms. The production entrypoint contains no `pagehide` or `visibilitychange` flush handler. The `flush()` comment mentions pagehide, but the inspected call sites are campaign switching and the debug/test hook.

- [app.ts lines 142–159](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L142-L159): `catch(() => undefined)` followed by `newCampaign()`.
- [app.ts lines 694–704](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/app.ts#L694-L704): debounced unhandled write and explicit flush.
- [main.ts](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/main.ts): line 44 exposes flush to the debug hook; full-file lifecycle search found no pagehide, beforeunload, or visibilitychange handler.
- [state/idb.ts lines 5–26](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/state/idb.ts#L5-L26): the wrapper handles completion and error, but not transaction abort.

## User impact

A transient read failure is indistinguishable from a fresh campaign. A storage-quota or transaction failure can leave the user playing without knowing changes are not durable. Closing or navigating away before the debounce fires can discard the last action.

The failed read alone does not necessarily delete data. The destructive sequence is a failed read followed by a successful replacement save. Failure frequency, device behavior, and actual recovery outcomes remain unmeasured.

## Reproduction to run

1. Seed a known campaign and make the next get request fail.
2. Restore storage operation and make a new change.
3. Check whether the seeded campaign was overwritten by newly initialized state.
4. Inject a quota/write failure and verify whether the user gets an actionable unsaved-state warning.
5. Make a change and close or reload before the 150 ms timer, without calling the debug flush hook.
6. Abort a transaction and verify that the storage promise settles.

## Recommended change

Distinguish absent data from read failure. Do not permit destructive replacement saves after a failed load without explicit recovery. Track dirty, saving, saved, and failed states and retain retryable snapshots. Handle transaction aborts and close database connections on every settled path. Add appropriate lifecycle persistence, recognizing that asynchronous pagehide work alone cannot guarantee a durable save when a browser terminates the page.

Serialize or otherwise order writes so a retry cannot overwrite a newer snapshot. Keep each snapshot associated with the correct campaign storage key. A backup/export route is useful but does not replace correct read/write failure handling.

## Acceptance tests

- Failed reads preserve existing records and surface an error.
- Failed writes retain dirty state and can retry without losing newer changes.
- Aborted transactions reject rather than hang.
- Last-action persistence is tested without explicitly calling the debug flush hook.
- Campaign switching cannot overwrite one campaign with another's state.
- Successful save status means the write transaction completed.
- Missing-save and unavailable-storage cases produce different, recoverable outcomes.

## Existing coverage and limits

Existing checks explicitly await `flush()` before reloading or switching campaigns: [e2e/slider.spec.ts lines 69–85](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/e2e/slider.spec.ts#L69-L85) and [e2e/ui.spec.ts lines 79–91](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/e2e/ui.spec.ts#L79-L91). Those tests bypass the normal autosave/lifecycle window. They were inspected, not run. Backup/restore implementations on other commits were not assessed.
