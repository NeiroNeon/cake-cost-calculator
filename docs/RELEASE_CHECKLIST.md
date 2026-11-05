# Release checklist

## Automated
1. `npm run check` — syntax and 12 unit tests.
2. Install Playwright and Chromium.
3. `npm run audit:responsive` — viewport smoke tests and screenshots.
4. GitHub Actions CI must be green; inspect `responsive-browser-audit`.

## Deployment
1. GitHub Pages → Build and deployment → GitHub Actions.
2. Confirm Pages workflow succeeds.
3. Verify `/` and `/app/`, assets and refresh on the published URL.
4. Test offline only after service worker installation and activation.

## Physical devices
- [ ] Android Chrome: keyboard, rotation, import/export, PWA.
- [ ] iOS Safari: safe areas, Home Screen, standalone.
- [ ] Desktop Safari and Firefox.

Do not claim device/production readiness before relevant checks pass. Exclude caches, screenshots, secrets and temporary files from ZIP.
