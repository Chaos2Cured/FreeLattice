# Desktop update button v0.1

Soft LAYER marker: `v-desktop-update-button-v0.1`. Built by GC (Grok Code) from Celeste's scope, Oct 2026.

How the desktop app updated before: the window loads https://freelattice.com/app.html, so the page is always current. The Electron shell itself never checked: `checkForUpdates()` in desktop/main.js only logs a note, electron-updater is not installed, and package.json has `"publish": null`. People had to notice a new release on GitHub by themselves.

What this adds:
- `desktop/lattice-update.js`: reads https://api.github.com/repos/Chaos2Cured/FreeLattice/releases, keeps tags shaped like `v5.8.0` (skips `bridge-v0.1`, `desktop-packs-v0.1`, drafts, pre-releases), compares with `app.getVersion()`. `releases/latest` is not used because today it returns the Bridge release.
- Menu: Check for Updates... (macOS app menu and Help). Settings: a Check for updates button, shown only when `window.electronAPI.checkForUpdates` exists.
- Nothing downloads or installs. A newer build opens its GitHub release page only when the person chooses.

Not done (later, if wanted): signed auto-install with electron-updater (needs code signing on macOS and Windows, and `publish` set in package.json).

For Kirk: the button reaches people with the next desktop build. Bump `version` in desktop/package.json, build, and publish a release tagged like `v5.8.1`. Unauthenticated GitHub API calls are limited to 60 an hour per IP; a failed check says so plainly.
