// Build-time constants from vite.config.ts.

/** The release number from package.json, shown in Help as 'mistLAB <version>'. */
declare const __APP_VERSION__: string;
/** The newest docs/CHANGELOG.md entry (vite.config.ts), shown once after each update. */
declare const __WHATS_NEW__: { version: string; title: string; date: string; body: string };
