# mistLAB

A browser-first, iPad-first 3D tabletop PWA for running *Curse of Strahd*: original low-poly battle maps
organized exactly like the book (chapter → location → area key), one DM/Player view slider on every view,
and a Player Display window pinned to the players' view.

No book text, art or map images are stored here: only keys, names, page numbers, dimensions and the DM's
own notes. All geometry is original.

```sh
npm install
npm run dev              # http://localhost:5173 (use your LAN IP on the iPad)
npm test                 # unit tests (Vitest)
npm run test:e2e         # acceptance tests (Playwright: build + preview + Chromium)
npm run ocr              # OCR reference/module/curse-of-strahd.pdf into reference/ocr (gitignored)
node --experimental-strip-types scripts/manifest-report.ts   # flag manifest vs book mismatches
```

URL options: `?scene=appB/death-house` (or `dev/m0-test-room`), `?display=player` (Player Display), `?hud=1` (tris/calls/fps).

## Using it

- **Slider** (right edge): drag between *Players* (0) and *DM* (1). Hold the eye to peek at 1. Keys `[` `]`, hold `\`.
- **Tokens**: drag to move; the pill shows distance in feet.
- **Reveal tools** (top right): tap a room, hidden object or secret door to reveal or hide it for players;
  paint reveal/fog brushes; undo. Tap a door to open or close it.
- **Player Display**: the monitor button opens a second window for the table display.

## Layout

```
app/          PWA (src/core = pure logic, src/render = three.js, src/kit = procedural kit, src/ui, src/state)
kits/         exported GLB kit pieces (meters)
locations/    <chapter>/<location>/{scene.json,grid.json,map.glb}
manifests/    locations.json · characters.json · encounters.json
reference/    gitignored: the PDF, OCR text, notes
docs/         UNITS · SLIDER · STYLE · PIPELINE · CHANGELOG
tests/ e2e/   Vitest + Playwright
```

Release notes are in `docs/CHANGELOG.md`. Screenshots and demos of each release are in [Visual-Aide](https://github.com/mreindl118-boop/Visual-Aide).

## Working together

mistLAB is built by Matt, the owner, with two AI assistants.

- **Claude Code** is the primary coding assistant. It works through `docs/QUEUE.md` one item at a time, in order, and releases each item as its own version.
- **ChatGPT** reviews the code and may also change the repository. Its advisory reviews live in `chat gpt suggestions/`.
- **When Claude Code is out** (out of credits or inactive), ChatGPT continues its work by `docs/HANDOFF-CHATGPT.md`. The current state of every item is in `docs/handoff/STATUS.md`.

### Matt approves every change

Nothing changes on its own. Every change by either assistant must come from one of these:
- a request Matt made;
- a suggestion Matt approved;
- an item on the queue Matt approved.

A suggestion is not a change until Matt approves it. Neither assistant builds an unapproved suggestion or adds features on its own initiative.

The one standing exception: Claude Code is the primary engine and ChatGPT the afterburner. Claude Code may fix anything ChatGPT implemented poorly or that causes problems, and logs each fix in `docs/COLLABORATION.md`.

For any other problem nobody asked it to fix, an assistant does three things:
1. Records the problem.
2. Proposes a fix.
3. Asks Matt.

### Sharing the branch

- **Branch.** Both assistants work on `claude/mistlab-curse-strahd-x6jm13`.
- **Telling authors apart.** Claude Code's commits end with a `Claude-Session:` line. Any other commit counts as an outside change.
- **Checking outside changes.** Claude Code reads every outside change before each release and at every check-in. It logs each one in the ledger in `docs/COLLABORATION.md` with what it touches and what could break, and tells Matt about anything that conflicts or could cause bugs.
- **Design rules.** `docs/COLLABORATION.md` also lists the design choices every change must respect: no book content, generated scenes, a read-only Player Display, materials through the kit, and versioned releases.
