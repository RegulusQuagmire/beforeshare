# Contributing

Use Node.js 24 LTS and npm. Clone the repository, then run:

```sh
npm ci
npm run dev
```

On Windows PowerShell use npm.cmd / npx.cmd if npm.ps1 is blocked. Keep the development console open. Do not change execution policy to run npm. The startup prompt selects Russian or English console messages; the app interface is Russian.

Before submitting a change:

```sh
npm run lint
npm run typecheck
npm run test:unit
npm run build
npx playwright install --with-deps chromium firefox
npm run test:e2e
```

CI requires Chromium; the full local command also runs the three Firefox journey tests. See README for optional executable overrides on the original Windows machine. Tests start and stop their production preview on port 4183. Browser report and traces are in ignored playwright-report/ and test-results/. Production defaults to /beforeshare/; VITE_BASE_PATH can override it consistently for build, preview and tests.

Use only synthetic data in fixtures, screenshots and logs. Never commit real personal details, credentials, customer screenshots, EXIF containing personal information, or browser profiles. Describe new fixture provenance in tests/fixtures/README.md. The existing demo email and token are intentionally fake.

Keep image processing in browser memory, without external APIs, telemetry, image logging or persistent image storage. Privacy fills and applied texture pixels must be opaque and fully replace their selection. Zoom must not change export resolution. Preserve Undo/Redo, resource cleanup and cancelled-preview behavior. Add meaningful regression tests for changes to rendering, history, loading or export, including decoded pixel checks for privacy behavior.

Use small focused changes; explain the behavior and the checks you ran. Release/deployment instructions are in RELEASE.md. Contributions are under the project's MIT license.
