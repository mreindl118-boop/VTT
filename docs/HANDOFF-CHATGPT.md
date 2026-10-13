# When Claude Code is out: how ChatGPT continues the work

Owner (Matt), 2026-10-13: "ChatGPT will continue work that you start." This file is for ChatGPT. Read it in full and follow it when Matt says Claude Code is out of credits or inactive.

Claude Code and ChatGPT share this repository. Claude Code is the primary coding assistant; ChatGPT reviews, and continues Claude Code's work when Claude Code is out. Matt decides everything. Nothing here lets either assistant build something Matt has not approved.

## 1. When this applies

Take over only when one of these is true:
- Matt tells you Claude Code is out of credits or inactive.
- `docs/handoff/STATUS.md` lists an item as in flight, and the branch it names has had no push for more than six hours.

Take over only the items `docs/handoff/STATUS.md` lists as in flight or next. Matt's approval of the queue covers them. Anything else still needs Matt's request or approval.

## 2. Read first, in this order

1. `docs/handoff/STATUS.md`: who holds which item right now, each item's branch, and its next step.
2. `docs/QUEUE.md`: the checklist, the lean review setting, the release procedure, and Matt's decisions.
3. `docs/COLLABORATION.md`: the approval rule, the ten design choices, and the ledger of outside changes.
4. `docs/HANDOFF.md`: how a machine is set up, and what is left on each item.
5. The open findings: `docs/handoff/item7-open.md` and `docs/handoff/item6-map-groups.json`.
6. `docs/CHANGELOG.md`: what has shipped.

## 3. Rules you follow

These are the same rules Claude Code works under.

1. **Matt approves every change.** Work only on approved queue items. Do not build a suggestion, yours or anyone's, until Matt approves it. For a problem nobody asked you to fix: record it in `STATUS.md`, propose a fix, and ask Matt.
2. **Never commit book content.** No book text, art or map images. Descriptions are in our own words. Keys, names and page numbers are fine. `reference/` is gitignored and stays that way. Before every commit, check that no eight words in a row match the module text.
3. **Never commit** screenshots, scratch scripts, `test-results`, `node_modules` or secrets.
4. **Scenes are generated.** Change `scripts/authoring/*.py` and regenerate. Never hand-edit `locations/**/scene.json` or `grid.json`.
5. **Materials go through the kit** (`mat()` and `matClone()` in `app/src/render/materials.ts`). A raw three.js material skips the fog, the grain and the cutaway.
6. **Tests are never skipped, loosened or deleted.** Fix the cause. Before a release: `npm run build`, `npx vitest run` and the full `npm run test:e2e` all pass.
7. **Every release is versioned.** Follow steps 2–7 under "For each item" in `docs/QUEUE.md`: merge onto the main branch, bump `package.json` to the next minor version in release order, add a dated `docs/CHANGELOG.md` entry in plain words, make sure Help shows the version, pass the full test suite, push, and tick the item.
8. **Never rewrite history.** No rebase, amend or force-push on the main branch or on any `claude/wip/` branch. Merge commits only. Never delete a branch.
9. **The lean review setting** (`docs/QUEUE.md`): the builder works at full effort, two reviewers check each step, at most one fix pass per step, then a final check. When you are one assistant doing all of it, make the review three separate passes and write each one down in `STATUS.md`:
   - look: screenshots at desktop and phone size, as DM and as Players, that you look at;
   - play: in Players mode, the party walks from its start through every door and opening the module expects;
   - cost: build, unit tests, the browser suite, and draw calls and triangles against the main branch.
10. **Mark your commits.** End every commit message with the line `Continued-By: ChatGPT`, and never add a `Claude-Session:` line. Claude Code logs your commits in the ledger when it returns.

## 4. How to pick up an item

1. Get current:
   ```sh
   git fetch origin
   git checkout claude/mistlab-curse-strahd-x6jm13
   git pull
   ```
2. Branch from the item's `claude/wip/` branch. Never commit straight onto a `claude/wip/` branch: Claude Code may still push there.
   ```sh
   git checkout -b item<N>-chatgpt origin/claude/wip/<branch from STATUS.md>
   git merge claude/mistlab-curse-strahd-x6jm13
   ```
   Resolve any conflict keeping both sides' behaviour.
3. Read the item's open findings. Fix every block and fix issue at its root. Regenerate what you changed. Run the checks in rule 6.
4. Do the three review passes from rule 9. Fix what they find, once.
5. Release (rule 7). Then merge your branch onto the main branch with a merge commit and push.
6. Two steps you cannot do: publishing to the mistLAB link, and the Visual-Aide screenshots if you have no git access to that repository. Write "publish: waiting for Claude Code" in `STATUS.md`. Claude Code does both when it returns.
7. Update `docs/handoff/STATUS.md` (section 5) and commit it.

## 5. Keep STATUS.md current

`docs/handoff/STATUS.md` is the one place both assistants and Matt look to see where the work is. Update it:
- when you take an item: who, which branch, the date;
- after each review pass and each release;
- when you stop, even mid-item: what is done, the last commit, what is open, and anything you are unsure of.

Keep it short and in plain words.

## 6. Decisions only Matt makes

Ask Matt. Do not guess, and do not build either way until he answers.
- The 23 small defects left on the chapter 2 maps (0.2.0): a second fix round, or leave them as known limits.
- The rules-tooltip test list, `tests/fixtures/terms-gold.json`: it waits for his sign-off.
- Yester Hill's summit costs more to draw than before: accept it, or thin the forest.
- The Amber Temple's mountain shows as a flat black mass in Players view: fix it, or accept it.
- Anything that would change what a player can see.

## 7. What you must not do

- Start a feature or build a suggestion without Matt's approval.
- Take an item that `STATUS.md` says the laptop session holds.
- Hand-edit a generated scene.
- Skip, loosen or delete a test.
- Rebase, amend, force-push or delete a branch.
- Change `playwright.config.ts`'s rendering flags except through `PW_GPU`.

## 8. Handing back

When Claude Code returns, it reads `STATUS.md` and the ledger, publishes any release that waits for it, logs your commits, and carries on from your last entry. Leave every `claude/wip/` branch as it is.
