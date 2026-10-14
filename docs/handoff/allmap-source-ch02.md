# Chapter 2 map source audit

Baseline `785421cb45ad3b7a5467a14f6e696074efb9bd27`. Thirteen maps reviewed against narrative OCR, 47 relationship comparisons. No app edits, GPU runs, builds or commits.

**Coverage:** 13/13 area narratives compared; **0/13 full source sign-offs**. Map artwork has not been inspected in this lane; rendered continuity, movement and zoom remain the implementation ownerâ€™s lane.

| Map | Source pages | Source result |
|---|---|---|
| A: Old Svalich Road | 33 | 3 comparisons; 0 confirmed finding records; remaining qualifications in JSON |
| B: Gates of Barovia | 33, 34 | 3 comparisons; 0 confirmed finding records; remaining qualifications in JSON |
| C: Svalich Woods road | 34 | 3 comparisons; 1 confirmed finding records; remaining qualifications in JSON |
| D: River Ivlis | 35, 36, 37 | 3 comparisons; 1 confirmed finding records; remaining qualifications in JSON |
| F: River Ivlis Crossroads | 35 | 3 comparisons; 0 confirmed finding records; remaining qualifications in JSON |
| G: Tser Pool Encampment | 36, 37 | 4 comparisons; 4 confirmed finding records; remaining qualifications in JSON |
| H: Tser Falls | 37 | 4 comparisons; 1 confirmed finding records; remaining qualifications in JSON |
| I: Black Carriage | 37, 38 | 4 comparisons; 0 confirmed finding records; remaining qualifications in JSON |
| J: Gates of Ravenloft | 38, 52 | 5 comparisons; 2 confirmed finding records; remaining qualifications in JSON |
| L: Lake Zarovich | 38 | 3 comparisons; 0 confirmed finding records; remaining qualifications in JSON |
| M: Mount Baratok | 39 | 4 comparisons; 0 confirmed finding records; remaining qualifications in JSON |
| P: Luna River Crossroads | 40 | 4 comparisons; 0 confirmed finding records; remaining qualifications in JSON |
| R: Raven River Crossroads | 40 | 4 comparisons; 1 confirmed finding records; remaining qualifications in JSON |

Confirmed findings include:

- **C:** the keyed body/letter about fifteen feet from the road is absent; the available map is a generic encounter stage.
- **G:** one tent/six wagons/two horses differs from five small tents plus the large tent/four wagons/eight horses. A northbound riverside footpath is still absent in the inspected worktree snapshot; the new dirt ribbon is the southwest entry.
- **H â†’ G â†’ D:** baseline water datums rise downstream: approximately 336 â†’ 366.55 â†’ 487 ft. Local shoreline correction alone cannot establish coherent river flow.
- **J â†’ K:** the source entrance is contiguous with Ravenloft; the independent world pins are 4,598 ft apart and the bases differ by 584 ft. Stand-in suppression alone leaves this spatial gap.
- **R:** the generator stops the winery and tower routes at its skirt; the larger regional network does not provide their immediate continuations.

Supported or qualified numerical checks:

- F has a five-foot gallows platform rise and eleven grave representations; its northwest branch falls and southwest branch rises.
- H has a 960 ft bridge-to-pool separation, compatible with the approximate source height.
- J has the specified fifty-foot gap and ninety-foot courtyard walls; its shallow fog representation is not treated as proof that the true cliff depth is wrong.
- Lâ€™s fishing boat is 400.351 ft from the authored south shore, matching the four-hundred-foot requirement.
- Mâ€™s actual spawn-to-elk distance is 78.87 ft horizontally / 82.74 ft spatially, versus an approximate sixty feet. Review tolerance before changing it.
- Pâ€™s junction-to-main-arch route is about 1,050 ft, versus approximately 1,320 ft in the source. This 20% difference is recorded without inventing a strict acceptance limit.

G is actively being fixed by root. Its baseline pool offset and size are recorded for traceability, not presented as proof that the current shoreline correction failed. No major placement, hydrology, scale or encounter redesign was performed.

Every map entry includes source locators, file/field evidence, applicable criteria, explicit uncertainty, fix status and remaining validation. See `allmap-source-ch02.json`.

Root follow-up: the authorized PDF was located in Downloads; local map-image verification is now possible and remains pending.
