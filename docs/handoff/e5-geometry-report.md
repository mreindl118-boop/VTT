# E5 initial geometry correction

Recovered 2026-10-14 after the executor outage, from the author's completed checkpoint. Base: `37ae2ff`. This is initial implementation evidence, not release approval.

`scripts/authoring/e5-church.py` is a standalone numeric recipe using the shared authoring library; it does not read generated output as its source or require the unavailable original importer input. It regenerates only `locations/ch03/E5/{scene,grid}.json`.

Five door identities/states, six windows, 39 object IDs and the existing ground rooms/props/lights/grid are preserved. Ordinary walls no longer cover authored apertures; the missing hall passage is open. The undercroft has a southern floor projection and a 15-ft descent from `[35,26]` to the existing `[35,38]` trapdoor. Existing raw/snapped lower arrivals remain physically supported. Ceiling/pillar support is an explicit physical convention. Hall dimensions and chapel outline still require the broader source correction.

- Focused baseline: 11 failures / 2 passes; initial implementation: 13 passes.
- Related E5/movement/endpoint/vertical-link batch: 46 passes.
- Repeat generation is byte-identical; nine protected inputs/outputs unchanged.
- Scene SHA-256: `80fca6c39a3483b51103a47db3d051af956e4fc8ddbde51e6a6447c90dcc700f`.
- Grid SHA-256: `8090afc3148dc8373a3ed63f135b9097377031c687ed23940d5b35626709f0c5`.

Two independent reviews completed after recovery; neither found an additional defect within this bounded recipe/access scope. The second checked 20 door-traversal assertions. The first integrated build caught a strict TypeScript check in the new test: the schema permits an absent ceiling. The single correction pass explicitly asserts the 15-ft ceiling before using it, retaining and strengthening the original elevation assertion; no authoring geometry changed. Root's outdoor audit has the same reported findings/counts as the previous checkpoint. Full build/unit integration is recorded separately; no GPU or release approval is claimed by this lane.
