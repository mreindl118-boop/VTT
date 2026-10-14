# Castle geometry migration: consolidated correction complete

Updated 2026-10-14 after both independent reviews (`review-batch032-first.md` and `review-batch032-second.md` in the task workspace). The single authorized correction pass is used. Worker changes are limited to `app/src/state/mapMigrations.ts`, `tests/map-migrations.test.ts`, and this report. No activation hook, campaign initialization, authoring or generated geometry was changed by this pass.

## Preserved behavior

The pure helper preserves valid positions in their original semantic room and recovers displaced tokens of every role and `encounter.partyPos`. Old K51 centroid `[190,260]` and raw/snapped hatch arrivals recover to `[210,257.5]`. Eight changed room polygons are guarded against the exact final layout. Unaffected rooms/maps, IDs, sheets, HP, visibility, initiative, doors and containers remain unchanged.

Explored memory uses the original coverage frame. Affected brush cells are remapped while retaining event order. Missing revision means legacy; successful migration records `mapRevisions.K = 1`. Unexpected geometry, invalid consumed save data or blocked destinations return issues and the exact original state without mutation or a new revision.

## Corrections

- **P1, quantized source ownership:** the shared explored/brush lookup now checks the semantic owner of the actual legacy cell center after quantization, as well as the continuous inverse point. K54 knowledge cannot populate K48-t and vice versa. The forward preservation path for fog/clear also requires the destination cell's owner to match the source owner, including unowned cells.
- **P2, malformed persisted input:** validation precedes blocker derivation and output construction. It checks the revision record/value; token, encounter and reveal routing records; finite exact two-coordinate tuples on affected Castle levels; explored record/value/encoding/frame; affected brush point arrays, radius and mode; and Castle door states and semantic reveal shapes consumed by this helper. It reports malformed containers, null entries, missing values and JSON-round-tripped nonfinite coordinates instead of throwing or stamping success. This is bounded migration validation, not a replacement for whole-campaign import/schema validation.

## Failing-first and green evidence

The initial implementation had 10 focused passes (its earlier no-helper baseline was 9 failures / 1 pass). All 10 tests are retained.

Before changing the implementation, the expanded migration file produced **39 failures / 18 passes, 57 total**. Failures included both reviewed one-cell explored reproductions; reveal, fog and clear brushes in both directions; both overlapping-room sweeps; malformed coordinate/array/record/value cases that threw or incorrectly succeeded; and an invalid revision value that silently bypassed migration.

After the correction:

```text
node node_modules/vitest/vitest.mjs run tests/map-migrations.test.ts tests/coverage.test.ts --reporter=dot
2 files passed; 63 tests passed (57 migration, 6 coverage)
```

The new coverage includes all eight changed rooms, asserting that every resulting explored cell and brush point stays in its original semantic room. Each sweep replays reveal, fog, clear and reveal events in order and verifies that the intended overrides survive. One-cell tests retain nonzero same-room results, so confidentiality does not pass merely by dropping all data. Thirty malformed serialized fixtures plus a direct nonfinite-coordinate fixture verify original-state identity, no mutation, issues and no new revision stamp.

Worker typecheck (`node node_modules/typescript/bin/tsc --noEmit`) initially failed only at the existing `tests/e5-geometry.test.ts:83` with TS18048 (`lower.ceilingFt` possibly undefined). The coordinator subsequently reported its separate E5 assertion correction and owns the final integrated typecheck/build. No migration-file diagnostics appeared in that worker typecheck; it is not recorded as a clean typecheck run.

## Resampling comparison

A read-only in-memory comparison ran the current production helper against the same helper with only the new source-cell ownership guard removed. For each legacy room-only explored mask it counted every resulting target cell by semantic owner. No source files were changed by this comparison.

| Level / room | Legacy owned cells | Correct-room target cells before / after | Wrong-room target cells before / after |
| --- | ---: | ---: | ---: |
| spires / K48 | 193 | 510 / 510 | 0 / 0 |
| spires / K49 | 955 | 1095 / 1095 | 0 / 0 |
| spires / K50 | 500 | 800 / 800 | 0 / 0 |
| spires / K51 | 200 | 100 / 100 | 0 / 0 |
| south-tower / K55 | 1155 | 910 / 910 | 0 / 0 |
| south-tower / K54 | 356 | 352 / 352 | 68 / 0 |
| south-tower / K56 | 400 | 600 / 600 | 0 / 0 |
| south-tower / K48-t | 44 | 542 / 542 | 3 / 0 |

The guard removes the 71 cross-room assignments without reducing any valid same-room target coverage in these exhaustive room-mask sweeps. Counts differ between old and new frames because rooms change size. Resampling remains conservative: inverse sampling may omit a small isolated explored/reveal source cell during contraction, and ambiguous boundary cells remain unknown. It does not expand revealed/explored knowledge to compensate; the existing fog/clear forward path preserves suppression without crossing semantic ownership. This is not a promise of lossless sub-cell resampling.

The comparison harness first encountered Vite root and virtual-TypeScript loading setup errors; after using an explicit repository root and stripping types in the virtual comparison module, it completed with the counts above. These setup errors did not change implementation or test results.

## Activation and save/reload integration

Root separately integrated DM load preparation before coverage/token construction. Fresh and reset Castle campaigns start at revision 1; existing unmarked saves migrate once. Migration is persisted only after atomic navigation accepts the prepared state. Player Display never migrates or persists its local save.

Two independent activation reviews completed (`migration-activation-review-one.md` and `migration-activation-review-two.md` in the task workspace). The single consolidated activation correction rejects malformed raw saved roots before merging defaults and distinguishes a failed IndexedDB read from a successfully absent record. The swallowed-read replacement behavior predated activation; it did not trigger the new migration autosave, but a later campaign switch could overwrite the unread record. DM navigation now aborts. The Display retains its read-only fallback.

Failing-first evidence: seven malformed-root unit cases failed, and the actual browser storage-read fixture incorrectly opened an empty Castle campaign. After correction, 78 focused migration/load/coverage checks pass. The frozen export at `evidence/migration-032-checkpoint` passes build and 747 units (two existing TODOs, no skips). The initial full-unit run had 746 passes and one PDF-vocabulary failure because `pdftotext` was missing from that process's PATH; supplying the already installed Poppler binary makes unchanged assertions pass. All 16 focused laptop GPU checks pass: legacy positions/encounters/coverage, one-time persistence and reload, fresh/reset state, failed navigation, unreadable storage, read-only Display behavior, and transition reload regressions. Browser writes used isolated synthetic test contexts, never the installed application's user saves.

## Remaining integration gates

The pure helper and its activation each completed their own two-review/one-correction step. The forthcoming source-backed roof/body correction changes the migration target contract; update it explicitly with old-to-final geometry and fresh regression fixtures before 0.3.2 release. The current revision-1 candidate has not been distributed as a compiled application. Whole-suite GPU, all-map source/runtime/visual verification and final release reviews remain open. These focused checks are not release approval.
