# Remaining CoS source audit

Baseline: `785421cb45ad3b7a5467a14f6e696074efb9bd27`. Saved 2026-10-14T01:47:25.713624+00:00.

**21 maps / 48 levels compared against applicable source narrative and all 18 primary map pages.** The ledger inventories 291 room polygons, 51 links and 48 source relationships. All 48 CPU level diagrams were inspected. This completes the declared static source comparison, with open findings; it is not runtime or release sign-off.

## Main findings

- **E5 / N1:** the copied church plan simplifies the chapel and changes the stated 10-by-20-ft hall to 15 by 17.5 ft. E5 descends 14 rather than 15 ft, and its undercroft endpoint is 8 ft outside the floor. N1 centers its large yard extent, displacing the building center 121.64 ft from its parent marker; that is a qualified registration candidate.
- **N2:** guest rooms are 32.5 by 30 rather than 15 ft square; attic is 10 by 75 rather than 10 by 35 ft. Two vertical hatch routes shift 17.68 and 45.07 ft sideways. The stable-loft void needs floor-mesh confirmation.
- **N3 / N4:** northern closet and southwestern bathroom identities are displaced in N3; N4 similarly displaces Stella's room and the hidden store. N3's first attic chamber is 37.5 by 27.5 instead of 20 ft square; N4's hidden store is 32.5 by 20 instead of 10 ft square.
- **N6:** the source outline is approximately 35 by 55 ft on its grid, while the scene spans 90 by 145. Its roof is only 36 by 58. Room adjacency and the registered stair are otherwise recognizable.
- **N8 / N9:** N8 substitutes a well for the central fountain/statue and puts the stocks in the southern half. N9 flattens a 30-ft hill and authors 14 wagons against the source twelve; its north/atlas rotation and flanking homes are supported.
- **O / V / W:** O moves the eastern stair arc to the southwest. V and W use invalid self-touching floor polygons around otherwise source-supported openings. V's four 20-ft storeys and W's 10-ft balcony plus five-foot climb agree with the source.
- **Y / Z:** Y explicitly documents flattening its 400-ft rise. Z flattens five-foot ledges; step props rise only 1.6 or 1.28 ft. Z's +100 ring is supported, while the ascending tunnel/inset remains a discontinuous representation.

## Supported structure and qualifications

Krezk and the abbey preserve the 20-ft defenses, 400-ft shelf, 20-ft loft/cellar differences and 15-ft wall walks. S13's extra entrance projection makes its bounding box 50 by 60 ft without contradicting its 50-ft-square hall core. S10's approach endpoint still needs the owner movement/terrain result because custom ground extends beyond room polygons.

Berez retains its west-bank ruin groups and east-bank 100-ft stone ring with twelve 15-18-ft menhirs. Its cellar size and ceiling match; its exact excavation datum and shallow water plane are separately qualified. U3's 15-ft-square floor and parent center agree, while its exact ten-foot elevation and eight-foot ceiling are inferred.

N5/N7 interiors and N8's four named surrounding shops are documented authored additions without dedicated book plans. Y's repeated summit is an intentional battle inset. V's scaffold has conflicting source fall-height and landing-height indications. Large-map bookScaleFt=5 is schema-normalized metadata and is not used to invent a global trace error.

## Coverage

| Scene | Levels | Source map pages | Result |
|---|---:|---|---|
| ch03/E — Village of Barovia | 1 | 42 | Compared; findings/constraints in ledger |
| ch03/E5 — Church | 2 | 46 | Compared; findings/constraints in ledger |
| ch05/N — The Town of Vallaki | 1 | 97 | Compared; findings/constraints in ledger |
| ch05/N1 — St. Andral's Church | 1 | 46, 97 | Compared; findings/constraints in ledger |
| ch05/N2 — Blue Water Inn | 3 | 99 | Compared; findings/constraints in ledger |
| ch05/N3 — Burgomaster's Mansion (Vallaki) | 3 | 104 | Compared; findings/constraints in ledger |
| ch05/N4 — Wachterhaus | 3 | 111 | Compared; findings/constraints in ledger |
| ch05/N5 — Arasek Stockyard | 1 | 97 | Compared; findings/constraints in ledger |
| ch05/N6 — Coffin Maker's Shop | 2 | 116 | Compared; findings/constraints in ledger |
| ch05/N7 — Blinsky Toys | 1 | 97 | Compared; findings/constraints in ledger |
| ch05/N8 — Town Square | 1 | 97 | Compared; findings/constraints in ledger |
| ch05/N9 — Vistani Camp | 1 | 120 | Compared; findings/constraints in ledger |
| ch06/O — Old Bonegrinder | 4 | 127 | Compared; findings/constraints in ledger |
| ch08/S — The Village of Krezk | 3 | 144 | Compared; findings/constraints in ledger |
| ch08/S10 — Abbey of Saint Markovia | 5 | 149, 153 | Compared; findings/constraints in ledger |
| ch10/U — The Ruins of Berez | 2 | 164 | Compared; findings/constraints in ledger |
| ch10/U3 — Baba Lysaga's Creeping Hut | 2 | 163 | Compared; findings/constraints in ledger |
| ch11/V — Van Richten's Tower | 4 | 170 | Compared; findings/constraints in ledger |
| ch12/W — The Wizard of Wines | 4 | 175 | Compared; findings/constraints in ledger |
| ch14/Y — Yester Hill | 2 | 199 | Compared; findings/constraints in ledger |
| ch15/Z — Werewolf Den | 2 | 202 | Compared; findings/constraints in ledger |

## Limits and current owner work

Every level has its own coverage record, source locator, CPU diagram, room bounds/validity and relationship IDs. Full-plan checks are qualitative; exact measurements are enumerated. All seven requested criteria are covered for source/static intent, but physical movement, material seams, rendered water flow and proxy/LOD visibility remain owner runtime work. Source completion means reviewed, not passed.

The observed checkout head is `3da4420767adf76b8e73c0330fef4c077cfcb749`. Later `080fed5`/`f18f087` work is recorded separately; the baseline remains `785421c`. The parent reports 266 GPU passes, 55 existing skips and one Amber mesh-height failure. This audit grants no additional fix, merge or publication authority.

The owner door probe reports 290 passing, 28 blocked and 47 inapplicable apertures. Its geometry follow-up finds collinear normal-wall overlap at 25 blocked doors, including E5 and several Vallaki interiors. These current-head runtime results are attributed separately from this source audit and do not imply every route or door state was tested.

The newer owner link probe at `3da4420` covers 173 links / 346 endpoints: 335 nearby moves pass, 10 block and one huge U grid is excluded. E5 and S10 have blocked arrivals; V's lift arrival is also blocked but lies at an intentional shaft opening. E5's raw endpoint is 8 ft outside its floor, while the grid-snapped endpoint is 7.5 ft outside; these are distinct measurements. W13/W16 nearby movement succeeds despite outside-edge measurements. See `evidence/allmap-movement-031/links-snapped.json`.

Deliverables: `allmap-source-remaining.json` and this report; local source page images and CPU diagrams are under `evidence/source-maps/`. The authorized PDF is `C:\Users\mrein\Downloads\Curse of Strahd.pdf`; its 258 pages use PDF page = printed page + 1.

No application files modified, builds, GPU runs, commits or publication performed by this lane. Book images and source text must remain outside Git/public artifacts.
