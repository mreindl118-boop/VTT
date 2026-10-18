# Five-map source structure audit

Baseline: `785421cb45ad3b7a5467a14f6e696074efb9bd27`. Local review completed 2026-10-14T01:20:11.654010+00:00.

**5 maps / 31 levels received the declared static source comparison.** The review used the actual floor-plan images and narrative. It found defects; it is not a complete runtime, encounter-content, or release sign-off. Castle remains explicitly partial.

Scope: floor/room-group plans, changes in height, stair and shaft relationships, entrance/foundation intent, material families and relevant water relationships. The ledger inventories 370 room polygons, 82 links and 45 source comparisons. Exact measurements are enumerated; the full-plan review is qualitative and does not assert a sub-foot match at every wall.

| Map | Levels | Printed map pages | Result |
|---|---:|---|---|
| Castle Ravenloft | 12 | 53, 55, 62, 65, 71, 73, 75 | Compared; findings/constraints recorded |
| Death House | 6 | 216 | Compared; findings/constraints recorded |
| The Amber Temple | 3 | 182, 190 | Compared; findings/constraints recorded |
| Tsolenka Pass | 4 | 158 | Compared; findings/constraints recorded |
| Argynvostholt | 6 | 131, 137 | Compared; findings/constraints recorded |

## Highest-value findings

- **Castle Ravenloft:** K34’s hidden ladder descends 50 ft in the data instead of rising 20 ft (pp.59,64); K79’s 70-ft source ascent is reduced to a 40-ft level change (pp.75,84). K77 is coplanar with K76 instead of 10 ft higher, and several other basement steps are flattened. K20/K57/K60a widths are 35/40/35 ft against explicit 60/60/20-ft source dimensions. The 40 crypts are solid props; the lower vault and crypt interiors are not spatially built. See K-02–K-15.
- **Death House:** the secret attic shaft shifts 57.08 ft sideways and the den trapdoor shifts 60.13 ft. The two panels of the lower stair shift 66.57 ft and both step props use a 0.1-ft rise. The house floor datums and main stair/service shaft match the source. See DH-01–DH-06.
- **Amber Temple:** X9’s internal stairs encode 2 ft instead of the explicit 20-ft descent (p.185). X31/X31a/X31b have self-intersecting polygons. The +40/+30/0 hierarchy and X6-to-X33a shaft are supported. The underground halls extending beyond the outdoor apron are intentional, not by themselves a terrain defect. See X-01–X-07.
- **Argynvostholt:** northern gate flights are 3 ft rather than the explicit 10 ft (p.133); the generator acknowledges flattening the external height. Q43’s fall link begins on solid roof and shifts 10 ft horizontally. The major 0/20/40/60/80-ft levels match. See Q-01–Q-06.
- **Tsolenka:** the upper stair link lands 1.743 ft outside its floor polygon. Local 0/20/30/40-ft levels and compass match. A 70-ft deck plus both 10-ft arch passages totals the stated 90-ft bridge, so deck length alone is not a confirmed error. The 500-ft river clearance needs the owner’s regional/rendered result. See T-01–T-05.

## Source conflicts and limits

Castle’s high-tower text and captions give incompatible 300/390/450/380-ft measurements. Other tower-floor and roof captions also disagree. The ledger records these conflicts instead of inventing one authoritative elevation. The approximate catacomb size difference is reported without an arbitrary tolerance. Argynvostholt’s +100-ft peak floor is an authoring inference; its roof requirement and conflicting geometry fields are separated.

All primary map panels for these levels were inspected. CPU diagrams are geometry diagnostics, not application screenshots. Door states, decorative props, encounter rules, conditional collapses, actual movement and material seams have not received exhaustive validation in this lane. Source completion means the declared structural relationships were checked, including findings; it does not mean the implementation passed.

## Owner changes kept separate

The working checkout advanced to `f18f087486f39dc4acb8de4199c43776fbef9fe5`. The report retains exact baseline `785421cb45ad3b7a5467a14f6e696074efb9bd27`. Owner commit `080fed5` adds the T gorge/road ties and X excavation/approach treatment; it does not correct the X9 descent or the authored catacomb polygons. No owner runtime result is credited by this CPU audit. X remains a mountain-enclosed temple in the source.

## Deliverables and provenance

- `allmap-source-structures.json`: per-map/per-level source coverage, locators, numeric observations, all links and room bounds, findings versus uncertainty, and owner-change annotation.
- `evidence/source-maps/`: 13 primary page images plus local CPU diagrams for all 31 levels. Source art stays outside Git.
- Source: authorized local `C:\Users\mrein\Downloads\Curse of Strahd.pdf`, 258 pages. PDF page number is printed page plus one.

No application edits, builds, GPU runs or commits were performed by this lane.
