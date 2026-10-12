# Make offline installation and caching reliable

Reviewed commit: 7cea5b32cddfe9ffb3c9e660dd179a815facbce4

Priority: P1 for the advertised offline PWA

Evidence status: Code-confirmed cache-completeness and lifecycle gaps; exact offline failures depend on browser and HTTP-cache behavior. Reproduction and acceptance tests below have not been executed.

Existing work: Offline caching is an existing product promise. The roadmap separately recognizes HTTPS and cross-device transport needs. This is a reliability review of the current worker, not a proposal for accounts or cloud hosting.

## Intended behavior

After online preparation completes, the user should know the app and selected maps can reopen without a connection.

## Finding and evidence

The [service-worker install handler](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/public/sw.js#L3-L15) precaches the document, manifest and icon, but no built JavaScript or CSS entry assets. [Registration occurs after window load](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/app/src/main.ts#L50-L52), after initial bootstrap asset requests.

The fetch handler starts a network request even for cache hits. At line 10 its cache-write promise is neither returned nor covered by event.waitUntil. Response cloning is delayed until after caches.open resolves, while the original response may already be consumed. A cache-hit background network rejection also has no handler.

The cache-pack message handler at lines 14–15 launches untracked work without completion acknowledgment. Worker lifetime is not extended for those writes. [MDN documents waitUntil's lifetime guarantee](https://developer.mozilla.org/en-US/docs/Web/API/ExtendableEvent/waitUntil).

The existing [E2E boot helper](https://github.com/mreindl118-boop/VTT/blob/7cea5b32cddfe9ffb3c9e660dd179a815facbce4/e2e/helpers.ts#L10-L14) appends ?nosw, so passing browser CI does not verify this subsystem.

## Impact

Offline readiness is best-effort rather than verifiable. A first online visit is not guaranteed to cache the bootstrap, and caching can fail or be interrupted without user feedback. This audit did not reproduce a blank screen or a failed installation.

## Reproduction to run

1. Open a production build in a fresh browser profile over localhost or HTTPS.
2. Visit once, wait for activation and record Cache Storage entries.
3. Go offline and hard-reload.
4. Repeat after clearing the ordinary HTTP cache while preserving the service-worker cache.
5. Test prepared and unprepared lazy-loaded maps separately.
6. Interrupt a cache-pack download.
7. Delay caches.open in a controlled test to exercise response-cloning timing.

## Recommended remediation

Generate a versioned precache manifest for bootstrap JS, CSS and required data. Prepare selected lazy-loaded map packs explicitly. Clone responses before consumers can use the body; await writes or extend event lifetime; catch revalidation failures; and acknowledge pack success or failure.

Expose clear preparation progress, offline-ready and error states. Scope cache cleanup to this app. Document HTTPS for iPad LAN installation: ordinary LAN HTTP development does not exercise the complete PWA flow.

## Acceptance tests

- One completed online preparation permits offline cold reload and prepared-map navigation.
- Interrupted preparation never reports ready.
- Cache writes survive worker lifecycle interruptions.
- Offline cache hits create no unhandled network rejections.
- App updates transition caches predictably.
- Another app's same-origin caches are preserved.
- A dedicated PWA suite runs with the worker enabled.

## Review boundary

Cross-device Player Display transport is a separate planned feature. Fixing caching does not turn BroadcastChannel into a network protocol.

