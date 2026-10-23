> Claude Code's independent second review of the advisory audit in `chat gpt suggestions/`, done 2026-10-12 against main (app code identical to the audited commit 7cea5b3) and the unmerged branches. The reproduction scripts lived in the session scratchpad and are not committed. Matt decides what is built; see `docs/QUEUE.md` for where each finding is handled.

# Independent second review of the advisory audit ("chat gpt suggestions/")

Reviewed against main `claude/mistlab-curse-strahd-x6jm13`. Its app code is byte-identical to the audited commit 7cea5b3 (`git diff --stat 7cea5b3 HEAD -- app tests e2e locations` is empty), so the audit's line numbers still hold. Branches checked: books `c058977`, nested world `53d3b41`, panels `5aa32c7`, backups `f89512c`, plus the map-work worktrees for Death House link data.

**How I reproduced things:**
- **Unit tests:** pure-logic tests in `scratchpad/review/zz-review-core.test.ts`. Each was copied into `tests/`, run with `npx vitest run tests/zz-review-core.test.ts --root /home/user/VTT`, then deleted.
- **Browser runs:** a production build of main (`npm run build`) served from a scratchpad copy with `vite preview --port 5801`. Chromium from `/opt/pw-browsers` (swiftshader) was driven through `window.__mistlab`. The scripts are `scratchpad/review/pw-*.mjs`.
- **Clean-up:** every server I started is stopped. No tracked file on main or in any worktree was changed: `git status` is clean, and each worktree shows 0 changes.

## Summary

| # | Finding | Audit | My verdict | My severity | Reproduced? | Fixed on a branch? | Queue item |
|---|---|---|---|---|---|---|---|
| 1 | Restore the party after encounters | P1 | **CONFIRMED, and broader** (a creature is "the party" *during* every encounter) | **P1** | Yes (browser) | No | 13 by the owner; the during-encounter leak needs item 11 |
| 2 | Stairs take one hop | P1 | **CONFIRMED** | **P1** | Yes (browser) | No (link data unchanged on the map branches) | 11 (A5) |
| 3 | Protect campaign saves | P1 | **CONFIRMED** (rare triggers, total loss; aborts also hang campaign switching) | **P1** | Yes (fault injection) | Partly (backups adds snapshots, export and persist(); read/write handling unchanged) | 5 |
| 4 | Hide live creatures at slider t=0 | P1 | **CONFIRMED** (breaks the documented contract) | **P1** | Yes (browser) | No | 22 |
| 5 | Hidden identities in initiative and ranges | P1 | **CONFIRMED, and broader** (the display camera also follows the hidden creature) | **P1** | Yes (both surfaces) | No (the backups projection still ships hidden tokens, names and the encounter) | 11 (A2) and 13 |
| 6 | Player Display read-only | P1 | **CONFIRMED, plus a second write path** (the display's flush on campaign switch) | **P2** | Yes (two windows) | Partly: backups stops all display saves; display clicks still change its local state | 5 |
| 7 | Players-mode scene navigation | P1 | **CONFIRMED** | **P1** | Yes (browser) | Partly (nested world limits Enter to the DM; Back and the world-card Open are still open) | 11 (A1) |
| 8 | Explored fog grows without movement | P1 | **CONFIRMED** (same as bug 16; severe) | **P1, top** | Yes (unit and pixels) | No (backups only works around it for Restore) | 5; I recommend fixing it first |
| 9 | Dispose obsolete GPU resources | P1 | **CONFIRMED, and larger** (token rebuilds leak on every DM commit on the display) | **P1** | Yes (measured) | No (nested world disposes only coverage textures) | 2, but the display/token part is independent |
| 10 | Reliable offline install and cache | P1 | **CONFIRMED, and worse**: on main the app *never* works offline | **P1** | Yes (true offline) | Partly (books' sw.js works after a 2nd online visit) | 22 (part lands with item 1) |
| 11 | Atomic location navigation | P2 | **CONFIRMED mechanism**; the realistic trigger is a failed import offline | **P2** | Yes | No (nested world restructures open() but keeps release-before-load) | 2 |
| 12 | Display floors and explored memory | P2 | **CONFIRMED** (both mechanisms) | **P2** | Yes (two windows) | Partly (backups `fresh` covers Restore/Import only) | 5 |
| 13 | Hide unrevealed world-map landmarks | P2 | **CONFIRMED** | **P2** | Yes (canvas hash) | No; nested world adds an ungated 3-D valley | 2 (A4) |
| 14 | Ranged overlay firing positions | P2 | **CONFIRMED** | **P3** (display-only helper) | Yes (unit) | No | 14 |

I found nothing in the audit that is NOT REPRODUCED or that I DISAGREE with outright. I disagree on two severities (6 and 14) and with one remediation detail (7, the world map in Players mode). New issues are listed at the end. The most important are N1 (a hidden creature becomes "the party" during encounters and reveals rooms) and N2 (the display leaks on every DM action).

---

## 1. Restore the party after encounters (`restore-party-after-encounters`)

**Verdict: CONFIRMED, and broader than described.**

**Code:**
- `app.ts:374`: `endEncounter` re-adds the party only if *no* token of any role is at the location.
- `app.ts:328`: the `party` getter returns the first token whose role is not `member`.
- `app.ts:310`: `ensureDefaultToken` treats any token as "has a party".
- `app.ts:361`: `startEncounter` deletes whatever `party` returned.

**Reproduced** (`pw-single.mjs party`, test room, one hidden dire wolf, an encounter with two PCs, then End):
- Afterwards the tokens are `[creature]` only, `app.party` is the wolf, and there are 0 player vision sources.
- Starting a second encounter **deleted the wolf** (tokens `[member]`).
- After reload (`pw-extra3.mjs partyreload`) the tokens are still `[creature]`, the party is the creature, and the minimap shows no party.

**Broader:** during *any* encounter the party token has been removed, so `party` returns the first placed creature, hidden or not, participating or not. See N1: the DM moving that creature runs `afterPartyMove` (`app.ts:1104`), which auto-reveals rooms to the players and takes stairs.

**At the table:** after a routine fight the party marker is gone and the players' view goes dark. The next encounter silently deletes a monster with its HP and alias.

**Severity:** P1. I agree with the audit.

**Branches and queue:** no branch touches this. The owner filed it under item 13. Because of N1 the identity fix is also a secrecy fix, so I'd do it with item 11.

**Fix:**
- Make identity explicit: `party` returns only `role === 'party'`. Keep a separate "current actor" for camera and follow during initiative.
- `endEncounter` and `ensureDefaultToken` check for a `party` role, not any token.
- `startEncounter` removes only the party token.
- Tradeoff: call sites that relied on the `?? here[0]` fallback, such as the camera "Find party" during combat, need an explicit "current combatant" target.

**Proving test:** e2e. Place a hidden creature, then start, end, start and end an encounter. Exactly one `role:'party'` token remains each time, the creature's id and HP are unchanged, and the same holds after reload.

## 2. Stairs take one hop (`make-stair-traversal-single-hop`)

**Verdict: CONFIRMED.**

**Code:**
- `app.ts:502-512`: the `break` exits only the inner endpoint loop, so later links see the mutated level and position.
- `app.ts:472-479`: `takeLink` moves the party onto the endpoint, then rescans every link.

**Reproduced** (`pw-single.mjs stairs`, Death House):

| Action | Expected | Got |
|---|---|---|
| On f1, `takeLink('lk-spiral-1-2')` | f2 | **f3**, "Took the stairs → Floor 3" |
| On f1, walk onto the stair cell | f2 | **f3** |
| On f2, `takeLink('lk-spiral-2-3')` | f3 | **f1** |
| On f2, `takeLink('lk-dumbwaiter-2-3')` | f3 | **f1** |
| From f3 down | f2 | f2 (correct only because of array order) |

The link data is unchanged on the map branches 252-11 and 252-17.

**At the table:** the first Death House session breaks; the party cannot reach Floor 2. This is known bug 1.

**Severity:** P1. I agree with the audit.

**Branches and queue:** none. Item 11, approval A5.

**Fix:** a pure `linkHop(links, level, pos, requestedLinkId?)` that returns at most one transition. This matches A5's own wording, so there is no conflict.
- `takeLink` uses the requested link directly.
- Add an arrival guard: a hop fires only when a move *enters* an endpoint radius from outside. Otherwise the shared f2 endpoint bounces the party straight back on the next tap.
- Tradeoff: a tower shaft that used chaining needs one tap per floor. The ROADMAP risk note says to check the Castle Ravenloft shafts.

**Proving test:** a pure unit test on the Death House links: f1→f2, f3→f2, requested 2-3 from f2 → f3, permuting the array changes nothing, and a no-op move at the arrival endpoint does not hop.

## 3. Protect campaign saves (`protect-campaign-storage`)

**Verdict: CONFIRMED.** The triggers are uncommon, but the outcome is total loss.

**Code:**
- `app.ts:149`: `idbGet(...).catch(() => undefined)` then `newCampaign`.
- `app.ts:699`: a fire-and-forget `idbSet`.
- `idb.ts:19-20`: listens for `complete` and `error` only, never `abort`.
- `grep pagehide|visibilitychange|beforeunload app/src` finds only a comment (`app.ts:703`).

**Reproduced:**
- **Unreadable record** (`pw-extra3.mjs readfail2`). I seeded two reveals, then made reads of `campaign:default` fail for one page load. The app started a fresh campaign with **no warning** (0 reveals). One ordinary commit (`setClock`) overwrote the save, and a normal reload then showed **0 reveals: the campaign was gone**.
- **One-off failures are hidden by luck.** `init()` reads the save twice: `init` calls `loadCampaign`, then `open` calls `loadCampaign` again because `cur` is still null (`app.ts:146,156,165`). My first single-failure injection was masked by that second read.
- **Commit-time abort** (`pw-extra2.mjs aborthang`; put succeeds, then the transaction aborts, which is the spec path for a quota or I/O failure): `flush()` was **still pending after 4 s**. A campaign switch, which awaits `flush` (`app.ts:147`), was **still pending after 6 s**. Saves fail silently and Library campaign switching dead-locks.
- **Close within 150 ms** (`pw-extra.mjs storage`): the last reveal was not saved.
- I could not force a real quota error: CDP `Storage.overrideQuotaForOrigin` did not make writes fail here.

**At the table:** rare, but when it happens the DM loses the whole campaign or keeps playing on unsaved state.

**Severity:** P1. I agree with the audit.

**Branches and queue:** the backups branch partly mitigates. Five rolling snapshots under another key, Export, and `navigator.storage.persist()` make recovery possible. It does not change `loadCampaign`'s catch, `idb.ts`, or lifecycle flushing. Item 5.

**Fix:**
- Separate "absent" (`undefined`) from "failed" (a throw).
- On failure, enter a visible "storage unavailable, not saving" state with Retry. Never autosave over a record that failed to read.
- Add `t.onabort` that rejects. Show a small saved/unsaved indicator.
- Flush best-effort on `visibilitychange` (hidden) and `pagehide`.
- Remove the redundant second read.
- Tradeoff: a little UI, and play must continue in memory.

**Proving test:** the `readfail2` fault-injection e2e. After the failed read, the UI shows an error, no write happens, and a normal reload still has the seeded reveals.

## 4. Hide live creatures at the slider's Players end (`player-slider-live-creatures`)

**Verdict: CONFIRMED.** It breaks `docs/SLIDER.md`: "t = 0 — safe to point at players", and "hidden-creature: invisible" at t=0.

**Code:**
- `app.ts:525`: hidden creatures are skipped only when `restricted`.
- `app.ts:533`: the tag uses `t.name` unless restricted.
- `app.ts:536-541`: a fixed 0.45 ghost opacity.
- `app.ts:689`: `setT` only runs `applySlider`, which never touches token groups.

**Reproduced** (`pw-single.mjs slider`): in DM view at `setT(0)` the hidden wolf is still mounted at 0.45 opacity, with its "Wolf" tag displayed. In Players mode it is not mounted.

**At the table:** a DM following the documented "whole session at t=0" workflow shows every placed creature (they all start hidden) by position and canonical name. Placed NPCs are hit hardest: their alias is "A stranger", but the tag shows the real name.

**Severity:** P1. I agree with the audit.

**Branches and queue:** none. Item 22.

**Fix:**
- Give token groups the same projection as authored hidden creatures: hidden opacity `0.45·hiddenCurve(T)`, invisible below ε.
- Tag text is `playerName` when `T < ε` (or restricted), and omitted for hidden creatures.
- Have `applySlider` restyle existing token groups rather than rebuild them. A rebuild also leaks (see 9).

**Proving test:** e2e. A hidden creature at `setT(0)` in DM view: group invisible, no tag. A revealed NPC at t=0 shows its alias.

## 5. Hidden identities in initiative and ranges (`player-initiative-visibility`)

**Verdict: CONFIRMED, and broader.**

**Code:**
- `encounter.ts:92-93`: the bar reads `roster[].name` and never checks `hidden` or `playerName`.
- `app.ts:866`: the creature sheet is named with the canonical `e.name`.
- `app.ts:412-418`: the range overlay is built for the current token regardless of `restricted` or `hidden`.
- `app.ts:389`: `nextTurn` moves the camera to the current token. The display copies the DM camera (`lockPlayerCamera` defaults to true, `app.ts:87`).

**Reproduced:**
- **Players mode** (`pw-single.mjs initiative`): the bar reads "Wolf 20 Fighter 5 Round 1 · Wolf · 40 ft of 40 ft left". The hidden wolf's 76-cell range overlay is drawn while its mesh is not. After reveal with an alias set, the bar still says "Wolf".
- **Player Display** (`pw-extra4.mjs`): on the hidden wolf's turn the display draws the 76-cell overlay, **centres its camera on the wolf** (target 53,18; wolf at 52.5,17.5), and its received state carries the name "Dire wolf".

**At the table:** an ambush is announced by name. A green movement diamond appears around an empty spot, and the camera points at it.

**Severity:** P1. I agree with the audit.

**Branches and queue:** not addressed. The backups projection (`playersView.ts`) classifies `tokens`, `roster` and `encounter` as `player` keys, so hidden names still reach the display. A2 says the projection "also strips hidden tokens' real names", which is not yet done in f89512c. Items 11 (A2) and 13.

**Fix:** one `playerFacing(token)` helper, used in four places:
- **Turn bar:** omit hidden entries and show `playerName`. A2 already decided "omitted", not a placeholder.
- **refreshRange:** no overlay when restricted and the current token is a hidden creature.
- **nextTurn:** no camera follow or camera broadcast for a hidden current token.
- **Projection:** strip hidden tokens (or their names) before broadcast.

**Proving test:** a two-window e2e with a hidden current creature. It is absent from the bar text and titles, there is no `range-overlay` in Players view or on the display, and the display camera does not move.

## 6. Player Display read-only (`player-display-state-authority`)

**Verdict: CONFIRMED, plus a second write path the audit's evidence does not name.**

**Code:**
- `app.ts:205-222`: door and link labels get click handlers in player mode too. Only `dm-note` labels are skipped.
- `styles.css:122`: the labels are pointer-active. `styles.css:135` hides links only for `data-view='players'`, and the display never sets `data-view`.
- `app.ts:699` and `app.ts:704`: saves are not gated by mode.

**Reproduced** (`pw-display.mjs authority`, DM and display in one context):
- **Door:** clicking the door marker on the display set the display's `doorsOpen` to true. The DM stayed null, and **IndexedDB now said true**.
- **Stair:** clicking the stair marker put the display's party on `upper` while the DM's stayed on `ground`. **IndexedDB's party is on `upper`.**
- **Campaign switch** (`displayflush`): when the DM opened a Sheep Chase map, the display's own `loadCampaign` ran `flush()` *after* the DM's. The CoS save then held the display's copy (name "written-by-display"). The display's copy carries its own derived `seen` (see 12), so this happens automatically on every campaign switch with the display open.

**At the table:** this needs someone to click the display window, or a campaign switch. The next DM commit usually masks a click fork. A display click on an unlocked door also lets the display "see" through it locally.

**Severity:** P2. The audit says P1. The display is normally a passive screen, and the persistence part is already fixed on a branch.

**Branches and queue:** the backups branch gates both `commit()`'s save and `flush()` with `mode === 'dm'`, which fully fixes persistence, including the campaign-switch path. It does not make the labels inert, so local divergence and peeking remain. This is design choice 4 in `docs/COLLABORATION.md`. Item 5.

**Fix:**
- In player mode, don't attach the label handlers, and add `body[data-mode='player'] .lbl { pointer-events: none }`.
- Early-return `toggleDoor`, `takeLink` and `toggleOpen` when `mode === 'player'`.
- Do not build an intent channel now.

**Proving test:** a two-window e2e. Click every door and link marker on the display: display state, DM state and IndexedDB are unchanged.

## 7. Players-mode scene navigation (`players-mode-scene-navigation`)

**Verdict: CONFIRMED.**

**Code:**
- `main.ts:64-73`: Library, World, Back, the mode tabs, Floor, Whole and Section sit outside `.dm-only`. Only the right-hand group at `main.ts:74` is `.dm-only`.
- `main.ts:272,285,287,295`: their handlers have no `restricted` guard.
- `worldmap.ts:306`: the direct pin tap is guarded by `canMove`, but the card's Open button (`worldmap.ts:330,334`) is not.

**Reproduced** (`pw-single.mjs playersnav, worldcard`):
- In Players view, Library, World, Floor, Whole and the mode tabs are visible.
- The Library lists 40 locations (39 openable). Opening `ch02/G` from Players mode switched the scene, revealed pin G and moved the world marker.
- On the players' world map, tapping revealed pin K and then the card's "Open" loaded `ch04/K` in Players mode.

**At the table:** the handed-over iPad lets players browse the module's location list, change maps, and mark places as visited. This is known bug 5 / approval A1.

**Severity:** P1. I agree with the audit.

**Branches:**
- Nested world: partly. `enterOf()` returns nothing when restricted, so Enter is DM-only, and the zoom-out chip is guarded. Back (`goUp`) and the world-card Open are still unguarded.
- Panels branch: neutral, but the title and floors groups become panels, so hiding must work inside the panel system.

**Queue:** item 11 (A1).

**Conflict:** the audit suggests keeping a read-only world map in Players mode. A1 (approved) says none of Floor, Section, Whole, Library, World or Back render in Players mode. Follow A1.

**Fix:**
- Don't render these controls in Players mode, and guard every handler with `app.restricted`.
- Render the card's Open only when `host.canMove`, and guard its click too.
- Add A1's deliberate exit (1 s hold or `]`).

**Proving test:** e2e in Players mode. The controls are not visible, and a programmatic click on the world-card Open leaves the path, trail and reveals unchanged.

## 8. Explored fog grows without movement (`explored-fog-expands-without-movement`)

**Verdict: CONFIRMED. It is FEATURES bug 16 on the backups branch, and the most serious secret leak here.**

**Code:** `coverage.ts:106-107` dilates the accumulated `seen` on every `updateVision`, and `coverage.ts:120-130` grows it one texel through walls. `recompute` runs on every commit (`app.ts:696`): one per party step, two per clock change.

**Reproduced:**
- **Unit test, the two-room fixture with the door closed:** `seen` went 484 → 576 → 600 → 648 → 768 → 1056 cells after updates 1, 2, 3, 5, 10 and 50. The closed room's centre (30,10) **became Explored after 10 identical updates**, and after 50 the whole map was explored.
- **Browser, Death House f1** (`fogcreep`, `fogpixels`): 700 → 1652 cells after 10 recomputes, and the whole floor (2006 cells) after 20. At t=0 top-down, 30 recomputes changed 20% of the pixels (96% of them brighter), and 11 door markers of unexplored rooms became visible to players.

**At the table:** about 20 ordinary actions on a floor reveal its whole plan as remembered rooms on the players' screen and the display. The leak is then saved in the campaign.

**Severity:** P1. I agree with the audit, and I'd rank it first.

**Branches and queue:** not fixed. Backups' `holdSeen` only stops Restore from widening memory. Item 5. I recommend pulling it ahead: it is about a 10-line change plus one unit test, and every session makes existing saves worse.

**Fix:** compute this pass's `visible`, dilate a copy of `visible` once (the wall rim), then OR it into `seen`. Never dilate `seen` itself.
- Tradeoff: saves already over-explored stay so. Offer the DM a "re-fog what was never seen" action, or accept it.

**Proving test:** my unit test. Fifty identical updates leave `serialize().seen` unchanged, and the closed room stays Unexplored.

## 9. Dispose obsolete GPU resources (`dispose-obsolete-map-and-range-resources`)

**Verdict: CONFIRMED, and larger than the audit's evidence.**

**Code:**
- `app.ts:174-175`: only coverage textures are disposed.
- `app.ts:231-232`: the backdrop and context are detached, not disposed.
- `app.ts:409,417`: a new overlay on every refresh.
- `app.ts:523,529,541`: `syncTokens` rebuilds every figure with new geometry and materials.

**Reproduced:**
- **Scene round trips** (`gpu`): `renderer.info.memory.geometries` was 133, then 355, 577, 799 and 1021 after each Death House → E → test-room round trip. That is linear growth with no plateau.
- **Vertex data per map** (`gpubytes`): Vallaki uploads **about 75 MB** of vertex data per visit, the Castle 6.5 MB and Death House 3.7 MB.
- **Retention** (`retention2`): after leaving Vallaki and forcing GC, the geometry object is collected but **its 765 KB position attribute is still alive**. three.js's binding-state cache holds it, so the GL buffers are retained too.
- **Range overlays** (`rangeleak`): 2 geometries per refresh, rendered (100 refreshes added 200).
- **Token rebuilds** (`pw-tokens.mjs`): the Player Display went from **66 to 848 geometries over 50 DM commits** with 4 tokens, because every state message rebuilds every figure. The DM side grew 65 → 548 over 20 view toggles.

**At the table:** memory grows with every map visited and, on the display, with every DM action. On an iPad this ends in a context loss or a Safari reload mid-session. Device thresholds are unmeasured.

**Severity:** P1. I agree with the audit.

**Branches and queue:**
- Nested world: not fixed. `release()` disposes only `covTex`, and nested step 3 (streaming) would make this continuous. Item 2 is the right home for scene disposal.
- The token and display leak is independent and cheap to fix, so I'd do it with items 5 or 22.

**Fix:**
- A `disposeTree(root)` that disposes geometries and non-shared materials. Mark palette-cache materials `userData.shared` (`materials.ts:217-237`).
- Dispose the backdrop, context and overlay on replace.
- In `syncTokens`, move or restyle existing groups instead of rebuilding, and cache figure geometry per creature kind.
- Tradeoff: disposing a shared material by mistake turns meshes black, so a test must cover live shared objects.

**Proving test:** e2e. Five map round trips stay within about 5% of the first-visit plateau, and 50 DM commits leave the display's geometry count flat.

## 10. Reliable offline install and cache (`reliable-offline-install-and-cache`)

**Verdict: CONFIRMED, and worse.** The audit says a first visit "is not guaranteed" to cache the bootstrap. In practice main *never* caches its JS or CSS.

**Code:**
- `sw.js:4`: install precaches only `/`, `index.html`, the manifest and the icon.
- `sw.js:10`: `res.clone()` runs after `caches.open` resolves, by which time the body has been consumed, and nothing awaits it.
- `sw.js:15`: the cache-pack handler has no `waitUntil` and no reply. No code on main sends `cache-pack`.

**Reproduced** (`pw-offline.mjs`): I killed my own server between visits, because Playwright's `setOffline` does not apply to service-worker fetches.
- After three online visits the cache held only the four precached files plus the navigation URL: **no JS, no CSS, no scene chunk**.
- A true-offline reload produced a **blank page** (no canvas, `ERR_FAILED`).

**Books branch `sw.js`** (I swapped only that file into the same build): it clones first, uses `ignoreVary`, catches revalidation, and uses `waitUntil` plus a reply port for packs.
- After the *second* online visit, the JS, CSS and the current map's chunks are cached, and an offline reload boots.
- The first visit still caches nothing usable.
- An unvisited map offline fails and blanks the screen (see 11).

**At the table:** at a venue without Wi-Fi the app does not open at all.

**Severity:** P1 for an iPad-first table app. I agree with the audit.

**Branches and queue:** the books branch partly fixes the fetch-handler mechanics and its "save for offline" covers the app bundle. There is still no install precache, no per-campaign map pack and no readiness state. Item 22, with part landing in item 1.

**Fix:**
- Emit a versioned precache list at build (the index JS and CSS, plus every scene and grid chunk or a per-campaign pack), cached in `install`.
- Add a "Ready for offline" indicator with progress.
- Delete only `mistlab-*` caches on activate.
- Document HTTPS for LAN iPad installs.
- Tradeoff: a larger first download (all scene chunks), so offer it per campaign.

**Proving test:** a dedicated suite that kills the server, not `setOffline`. First visit, wait for "ready", stop the server, reload: it boots and opens another map.

## 11. Atomic location navigation (`make-location-navigation-atomic`)

**Verdict: CONFIRMED mechanism.** Natural double-navigation windows are narrow, and the realistic trigger is a failed import offline.

**Code:**
- `app.ts:166-176`: teardown happens before `await loadLocation` at `app.ts:177`.
- `app.ts:186,227`: the roots are added and `cur` is set unconditionally.
- `main.ts:285,287,295,411`: `void app.open(...)`, so rejections are unhandled.

**Reproduced:**
- **Overlapping opens** (`overlap2`): `open('ch03/E')` and `open('dev/m0-test-room')` without awaiting left E's `level:village` root mounted and orphaned beside the test room.
- **Display, two state messages back to back** (`displayrace-direct`): 24 level groups with only 12 current, so the Castle was mounted twice.
- **Natural bursts:** a double tap on Back, and DM commit bursts to the display, did *not* overlap in my runs, because the synchronous build absorbs the second event.
- **Failed import** (`overlap`): `cur` still pointed at the old map with its roots removed.
- **Offline with the books SW** (`pw-offline2.mjs`): opening the unvisited `ch04/K` rejected with "Failed to fetch dynamically imported module". 0 level groups were left mounted and `cur` still said Death House: **a blank map with no message**.

**At the table:** mostly the offline blank screen. Ghost geometry from overlapping opens is possible but rare.

**Severity:** P2. I agree with the audit.

**Branches and queue:** not fixed. The nested world splits `open()` into `load`/`release`/`place`/`activate` (`app.ts` on 53d3b41) but still calls `release(cur)` before `await load()`, which is the natural place to fix it. Item 2.

**Fix:**
- `const seq = ++navSeq; const next = await load(path); if (seq !== navSeq) { dispose(next); return; }` then release, place and activate.
- Use try/catch to keep the current map and show "Couldn't open X (offline?)".
- Tradeoff: two maps are in memory during the swap (Vallaki is about 75 MB), so pair this with 9.

**Proving test:** e2e. Two unawaited opens mount exactly the last one, and a failing open leaves the current map rendered and `cur` unchanged.

## 12. Display floors and explored memory (`synchronize-display-navigation-and-memory`)

**Verdict: CONFIRMED (both mechanisms).**

**Code:**
- `main.ts:272`: the dropdown calls `setLevel`, which does not broadcast (`app.ts:258-277`), and camera messages carry no level.
- `app.ts:1270-1274`: the display assigns the received state but keeps its own coverage buffers, then `recompute` overwrites `state.seen` (`app.ts:571`).

**Reproduced** (`pw-display.mjs`):
- **Floor:** after the dropdown the DM is on f2 and the display on f1. The display catches up only on the next commit.
- **Memory:** an authoritative state whose `seen` covered T2 left the display's T2 Unexplored, and its `state.seen` was rewritten without T2.

**At the table:** the display shows the wrong floor while the camera follows the DM, and its explored memory drifts from the DM's. The two also dilate independently until 8 is fixed.

**Severity:** P2 for memory; the floor desync is P2/P3. I agree with the audit's P2.

**Branches and queue:** backups partly fixes this. A `fresh` flag rebuilds the display's coverage on Restore and Import only. Item 5.

**Product question first:** should the display follow the DM's browsed floor or the party's floor? PITFALLS #38 anchors players on the party's floor.

**Fix:**
- Broadcast the chosen level on every `setLevel`.
- On the display, `cov.load(m.state.seen[...])` (replace) before `recompute` whenever it differs, and never write `seen` back on the display.

**Proving test:** a two-window e2e. The dropdown syncs the level in one message, and authoritative `seen` cells appear on the display.

## 13. Hide unrevealed world-map landmarks (`world-map-hidden-landmarks`)

**Verdict: CONFIRMED.**

**Code:** `worldmap.ts:60` is `paint(cv, vb)` with no reveal input. `worldmap.ts:139-156` paints every pin's symbol, and `worldmap.ts:199` paints once. Only the SVG pins and the list are filtered (`worldmap.ts:240,253`).

**Reproduced** (`pw-extra2.mjs worldpaint`): the painted canvas hash is identical for DM and Players. The DM sees 32 pins; players see only E. This is bug 15 / A4.

**At the table:** players see castle, settlement and camp symbols for places they don't know.

**Severity:** P2. I agree with the audit.

**Branches and queue:** not fixed. The nested branch adds a 3-D valley where place labels are reveal-gated (`worldstage.ts:176-180`) but the map **proxies of every pin are shown regardless**. The A4 fix needs the same decision there: are proxies landmarks or geography? Castle Ravenloft is arguably always visible. Item 2 (owner), A4.

**Fix:** `paint(cv, vb, allowed)`, with a players' canvas painted from revealed pins and repainted on reveal changes. Keep roads and peaks neutral, as the audit says.

**Proving test:** the canvas hash differs between DM and Players, and the pixel at an unrevealed castle equals the land colour.

## 14. Ranged overlay firing positions (`ranged-overlay-line-of-sight-correctness`)

**Verdict: CONFIRMED.**

**Code:** `range.ts:113-118` checks only the first nearest reachable cell. `range.ts:118` treats terrain walls as opaque, while `light.ts:50-58` lets one terrain wall through.

**Reproduced** (unit test):
- The audit's fixture: reachable cells are (2.5,2.5), (7.5,2.5), (2.5,7.5) and (7.5,7.5). Target (22.5,2.5) is **excluded**, although `hasLineOfSight((7.5,7.5)→target)` is true.
- Terrain wall: the overlay excludes (27.5,2.5) while `hasLineOfSight` is true.

**At the table:** the pale-red "could shoot" squares sometimes omit legal targets. Nothing is enforced from them.

**Severity:** P3. The audit says P2: it is a DM-facing helper and errs only toward false negatives.

**Branches and queue:** none. Item 14.

**Fix:** for each candidate cell, test reachable origins within range in distance order and accept the first with `hasLineOfSight`, reusing the central policy. Prune by bounding box.

**Proving test:** my two unit cases pass, and the existing closed-door and occupied-cell tests still pass.

---

## What the audit did not cover that matters most

1. **The unmerged branches.** The audit says so itself, but they change several verdicts:
   - books: SW mechanics fixed;
   - backups: display persistence fixed, but its projection still ships hidden names;
   - nested world: `open()` restructured, and an ungated valley added.
2. **Encounter-time identity** (N1). The audit framed the party bug as post-encounter only.
3. **The Player Display as a long-running process.** Per-message rebuild cost and leaks (N2), and its camera following hidden turns (in 5).
4. **Real iPad Safari.** The WebGL memory ceiling, the IndexedDB "connection lost" behaviour, PWA install, and whether a second same-browser window is practical on iPadOS at all. These decide how severe 3, 9 and 10 really are.
5. **Existing saves after the bug-16 fix.** Their explored memory is already inflated, and a migration or "re-fog" decision is needed.
6. **Test method.** Playwright `setOffline` does not cover service-worker fetches, so an offline suite must stop the server. I'd add this to PITFALLS.

## New issues the audit missed

| # | Issue | Evidence | Severity | Where |
|---|---|---|---|---|
| N1 | During an encounter, any placed creature (even hidden and not in initiative) is `app.party`. The DM moving it **auto-reveals rooms to players** and takes stairs, and players' **Find party** / the turn bar's "Find the combatant" **centre the camera on the hidden creature**. | `app.ts:328,1104,497-517`; `encounter.ts:84`; `main.ts:126`. Repro `creatureparty`: T2 became `explored` for players after the DM moved the hidden wolf. `gocamera`: the target was 53,18, the wolf's cell. | P1 | Fix with finding 1, in item 11 |
| N2 | `syncTokens` rebuilds every token figure, unfreed, on each call. The display calls it on **every DM commit**. | `app.ts:521-549,1274`. Display geometries 66 → 848 over 50 commits with 4 tokens. | P1 (long sessions) | With 9; independent of the nested world |
| N3 | The display's `flush()` on a campaign switch overwrites the DM's final save of the old campaign. | `app.ts:147`; the save name became "written-by-display". | P2 | Already fixed on backups (`flush` gated) |
| N4 | An IndexedDB commit-time abort leaves `flush()` pending forever, so Library campaign switching hangs. | `idb.ts:19-20`, `app.ts:147`; the `aborthang` repro. | P1 when it occurs | With 3 |
| N5 | `init()` reads the save twice (`app.ts:156,165` with `cur` null), which masks one-off read failures by accident. | Repro `readfail` (a single failed get was hidden). | P3 | With 3 |
| N6 | In Players mode, a **double-tap on an unexplored room frames it exactly**, because `app.ts:1196` runs before the Players branch at `app.ts:1198`. | Repro: the camera target became T2's centre (50,15) while T2 was Unexplored. | P3 | Item 11 |
| N7 | Backups import validates types only. Token names reach unescaped `innerHTML` (`main.ts:437`), so a crafted backup could inject markup. | `backup.ts` `stateError` on f89512c. | P3 (threat model is the DM's own files) | Item 5: use `textContent` or `esc()` as `encounter.ts` does |
| N8 | The backups projection keeps `tokens`, `roster` and `encounter` as player keys, so hidden creatures' canonical names still reach the display. A2 says the projection strips them. | `playersView.ts` on f89512c; on main the display state held "Dire wolf". | P1 (with 5) | Items 5 and 11 |

A last observation, not a finding: in headless swiftshader the Player Display took about 7 s to open Vallaki, and DM commits on Vallaki ran about 0.7 s apart. That timing isn't representative of real hardware, but recompute cost on big maps deserves a device measurement alongside 9.
