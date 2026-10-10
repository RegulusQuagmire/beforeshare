# BeforeShare 2.0 — implementation progress

## Current stage (2026-10-10)
Final update implemented: canonical owner changed to RegulusQuagmire; origin, documentation links, English GitHub description and homepage updated. Added Russian/English UI with local preference persistence and English documentation, plus theme transitions and hover scaling with reduced-motion support. Language tests confirm annotations/history survive switching. Read-only review approved. ESLint, TypeScript, all 130 unit tests and production build passed. Full Playwright: 90 passed, 2 Firefox mobile-emulation skips; final spacing/button-width adjustment additionally verified by 10 targeted tests across Chromium/Firefox/WebKit. Windows sandbox prevented Firefox content-process creation; all engines passed outside that sandbox. Updated synthetic screenshots and visually checked English desktop/mobile. Next: verify clean clone/install, ordinary push, then Actions and the new Pages URL.

Previous release: `5cd6974abcf86eefe098886106845f19dd8da799` and documentation `43d24d49b6527dd42861cceca77206cd3048103d` reached main; remote SHA, successful CI/Pages and public application confirmed. After the rename, the new Pages URL returned HTTP 200 with the previous bundle. This does not yet verify publication of the final language/motion update.

## Baseline and preservation
- Existing repository cloned into an empty workspace; baseline `8db48bc`. Work isolated on `beforeshare-2`.
- No uncommitted parallel work in this checkout. Existing mobile pan, touch handling, dark/light palettes, stars/constellations, gradients and reduced-motion behavior preserved. AmbientBackdrop unchanged.
- Existing React/TypeScript/Vite application extended without new runtime dependencies, server processing, accounts or external fonts.

## Completed work
1. Architecture/Git/CI analysis and incremental commits.
2. Selection, topmost hit testing, overlap list, movement, fill resizing, independent arrow endpoints, marker movement, color/deletion/deselection. Keyboard focus, arrow nudging, Shift step and Delete/Escape. Source coordinates support scrolling and 400% zoom. One finished gesture = one history action. Protection warnings are shown.
3. Multiline Russian/English text: local system fonts, color, size, position, editing/apply/cancel/delete and history. Modal keyboard input does not trigger editor Undo.
4. Smooth sampled pencil: mouse/touch, color/width, move/delete a stroke, one stroke per action; cancellation/lost capture discard drafts.
5. All nine tools in the existing toolbar; both themes and mobile viewport retained.
6. Exact PNG preview through exportPng; resolution, edit return, same-Blob download, privacy reminder, URL cleanup and stale-result protection.
7. Static WebP signature/RIFF/VP8/VP8L/VP8X preflight, dimensions before decode, native validation afterwards, animation/damage errors. PNG/JPEG behavior and limits preserved. Actual synthetic alpha-WebP fixture.
8. rAF draw coalescing, conditional backing size changes. No coupling to ambient animation.
9. Fifty-action history; owned frozen annotations shared across snapshots, external mutable input cloned. Existing texture collector retains undo/redo assets and releases unused resources.
10. Geometry separated into objects.ts, text/PNG dialogs into focused components; strict types, no new any.
11. Chromium, Firefox, WebKit desktop/new-tool scenarios; emulated mobile Chromium/WebKit, real CDP finger drawing/selection/pan, browser zoom 125%/200%, image zoom 400%, focus/reduced motion/themes.
12. Expanded Vitest/Playwright coverage including mixed text/pencil/object/crop/texture history, exact PNG bytes, opaque masks over explanatory layers, damaged replacement preservation and async cleanup.
13. Local privacy audit; PRIVACY.md updated. Independent read-only review reproduced two P2 issues (keyboard focus and zero-delta cropped-object snap), both fixed with RED→GREEN tests. Follow-up review found no material issue.
14. README/limits/screenshots and CI/Pages updated. Both workflows run Chromium, Firefox and WebKit.

## Verification evidence
- npm ci: passed; npm audit: zero vulnerabilities.
- ESLint, TypeScript, 127 unit tests, production build: passed.
- Full Playwright: 83 passed, 2 skipped (only unsupported Firefox mobile emulation); no failures. Chromium 57, Firefox desktop 12, WebKit 14 passed.
- Clean local clone of `6b67a9b`: npm ci, ESLint, TypeScript, 127 unit tests and build passed. Subsequent changes only documentation/screenshots and waiting for UI readiness in an existing keyboard test.
- Screenshots generated from synthetic-account fixture and visually inspected.
- Git push dry run authenticated successfully; remote main still `8db48bc` before release.
- Clean clone directly from GitHub at `5cd6974`: npm ci, ESLint, TypeScript, 127 unit tests and build passed; zero audit vulnerabilities.
- Ordinary `git push origin main`: succeeded via fast-forward; `git ls-remote` confirmed exact code-release SHA. No force push, deletions or history rewrite.
- CI: success, https://github.com/RegulusQuagmire/beforeshare/actions/runs/38056324105 . Pages: success, https://github.com/RegulusQuagmire/beforeshare/actions/runs/38056324115 . Both workflows ran all three browser projects.
- Public https://RegulusQuagmire.github.io/beforeshare/ returned HTTP 200 and expected `index-BKZokBc5.js` bundle. Four real published Chromium scenarios passed: original image→masks/annotations/crop→download/reopen journey; multiline text edit/pencil/preview; actual WebP and damaged replacement; same-byte preview download and opaque protection/no operation network.
- Remaining verification limit: physical Safari/iOS/Android devices unavailable. No outstanding implementation requirement identified; documented format/texture/font limits remain intentional.

## Performance measurements
Same local synthetic cases, not universal FPS claims:
- 240 pointer movements: baseline 241 draws / 482 backing-size assignments / 23.3 ms; optimized 1 draw / 0 assignments / 7.6 ms (later loaded runs 9–12 ms). Idle background: 0 editor redraws before and after.
- 50 commits with a 10,000-point stroke: baseline 369.7 ms / 51 copies; optimized 1.04 ms / 1 immutable shared stroke.

## Compatibility and limitations
- WebKit worker lacks OffscreenCanvas in the available Windows port: a temporary HTMLCanvas crop is transferred to the worker; matching and hidden-area sanitization remain in the worker. Canvas memory is released in finally. Large crop readback can briefly pause the main thread. Eyedropper uses a 1×1 HTMLCanvas.
- Initial shared browser cache could not launch full Chromium/Firefox (side-by-side dependency errors); isolated fresh browser downloads resolved this without modifying the shared cache.
- Physical Safari/iOS/Android devices were unavailable. WebKit is engine testing, not a claim of physical Safari validation.
- Animated WebP/APNG remain unsupported. Text up to 2000 characters, 8–200px; pencil width 1–80px, up to 10,000 intermediate points. Existing upload/texture budgets remain.
- Local processing is preserved; absolute privacy, automatic private-data detection and physical memory erasure are not promised. Inspect PNG after changing protective objects.
