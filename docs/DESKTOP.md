# mistLAB on Windows

Matt requested a desktop app with automatic updates on 2026-10-13. The installation uses the existing Node runtime and Microsoft Edge, without a new app framework, service, scheduled task or security-setting change.

The installed app lives in `%LOCALAPPDATA%\mistLAB`; its desktop shortcut is `mistLAB.lnk`. It serves only `127.0.0.1:5642` and opens an Edge app window with a dedicated `profile/` directory. Campaigns and preferences stay in that profile across releases. Data belonging to another website origin or browser profile remains untouched; it is not automatically migrated. Do not copy live browser databases to import a campaign.

## Update behavior

Each new app session checks for a newer stable `desktop-vX.Y.Z` tag in `mreindl118-boop/VTT`. A second shortcut launch joins the existing session; the served build never changes under open windows. Network errors, pending/failed checks and corrupt downloads keep the installed build available. Closing the last app window stops the local host.

Only annotated tags are accepted. Each distribution commit has the exact source release commit as its sole parent and contains only `dist/`, `release-manifest.json` and `tested-dist-fingerprint.json`. The updater checks:

- the fixed repository, tag identity, source version and source ancestry on `claude/mistlab-curse-strahd-x6jm13`;
- successful CI for that exact source SHA, from the repository's `ci.yml` push workflow on main;
- the hash of the frozen tested build inventory, complete local build/unit/GPU/review evidence and every file's SHA-256 and size;
- bounded archive sizes and exact inventory, rejecting extra files, links, path traversal and unsafe Windows names;
- the declared storage-compatibility family before an automatic update.

Downloads are staged and verified on the installation volume before an atomic `state.json` replacement. The previous release stays on disk. A corrupt current release may fall back before opening only when the retained version declares the same storage compatibility. This does not promise rollback across future schema migrations. Native launcher/updater code never comes from downloaded web releases; it is maintained separately.

The launcher removes only service-worker registrations for its dedicated local origin before navigation. It never clears IndexedDB, localStorage or caches. It refuses the website's `sw.js`, including for Player Display windows: the local files already work offline, and the website cache must not conceal an update.

## Publishing a tested desktop release

Current status: the app is installed and the updater is tested, but its first distribution tag is held. The repository is already public; the parent asked for clarification before adding a new compiled public bundle. Do not publish that tag until the destination is settled. No repository visibility/access change is needed or authorized.

First follow AGENTS and the item's release procedure, including the full GPU suite, copied-text gate and exact frozen build fingerprint. Push the source release to main and wait for its own CI success. A green earlier source checkpoint is not substituted.

Prepare a manifest with schema `1`, repository `mreindl118-boop/VTT`, version, full `sourceCommit`, full `testedImplementation`, SHA-256 of the exact fingerprint file, `storageCompatibility`, and the recorded verification results. The initial compatibility family is `mistlab-idb1-2026-10`. A release that changes saves must not reuse that family without a reviewed migration/rollback policy and fixture evidence.

Run the publisher from the source checkout, with `dist/` still exactly matching that fingerprint:

```powershell
node scripts/desktop/publish.mjs <release-manifest.json> <tested-dist-fingerprint.json> --push
```

The publisher verifies the source/CI and every built file, creates a static distribution commit, then creates and pushes the annotated version tag. It never moves main or replaces an existing tag. Keep evidence outside Git; do not add source book images or screenshots to a distribution. The desktop distribution is public app code in the existing public repository; the parent's private hosted app is a separate delivery destination.

After publishing, exercise actual discovery/download/staging once and retain its identity/hash result. Never advertise a new automatic update from an untested branch or use a mutable floating tag.

## Verification for the initial installation

The desktop host/updater have 21 focused CPU tests covering trust gates, archive rejection, atomic state, offline preservation, no mid-session switch and concurrent launches. Two independent source reviewers found the startup-readiness race; it was fixed. An isolated real Edge profile retained its campaign, party, character roster and rules preference through 0.2.1 restart, update to the exact 0.3.0 bytes, compatible rollback and a second update. The 204-file compressed archive was checked during that transition. A separate two-window Edge test confirmed closing the first window retains the second and closing the last stops the host. Both browser checks used software rendering and left the owner's installed profile untouched.

Run `npm run test:desktop` for the deterministic checks. Real browser transition/lifecycle evidence lives outside Git under the task's `evidence/` directory. These checks concern installation and persistence, not physical-phone performance.
