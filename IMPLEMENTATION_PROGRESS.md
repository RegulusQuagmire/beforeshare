# BeforeShare 2.0 — progress

## Baseline (2026-10-10)
- Existing repository cloned into an empty workspace; baseline `8db48bc`, branch `beforeshare-2`.
- Main already includes mobile pan, dark/light themes, stars/constellations, gradients and reduced motion. No parallel uncommitted files in this checkout. Preserve these implementations.
- React + TypeScript + Vite, no runtime dependencies beyond React. Documents contain source-space annotations and crop; viewport rendering and PNG share renderScene. History retains 50 actions; texture bitmaps owned separately and collected across history.
- Missing: select/edit, text, pencil, final PNG preview, WebP. Canvas currently resets dimensions and draws synchronously on every pointer move. appendAnnotation clones the entire document before history clones it again.
- Existing Vitest, Chromium e2e, Firefox journey, CI and Pages workflows. `npm ci`: passed, zero audit vulnerabilities.

## Implementation plan
1. Extend immutable annotations and geometry; selection handles and one commit per gesture, object properties/deletion, keyboard support.
2. Text form with explicit apply/cancel, multiline system fonts; sampled pencil strokes; shared rendering.
3. Exact PNG preview using exportPng; URL ownership and edit lock.
4. Validate WebP RIFF/VP8/VP8L/VP8X dimensions and reject animation before decoding.
5. Measure canvas/history baseline and improved behavior; coalesce frames, avoid backing resets; preserve history ownership and texture GC.
6. Regression/unit/e2e, privacy and limits docs, clean install, commit/push and verify remote/Actions/Pages where available.

## Current stage
Object geometry/model, selection handles, movement/resizing/endpoints, property color/deletion, keyboard nudging, overlap list, multiline text dialog, sampled smooth pencil and exact PNG preview implemented. Existing pan/theme/backdrop code preserved. 113 unit tests passed; new Chromium object/text/pencil/preview workflows: 2 passed. Typecheck and ESLint passed. Selection properties retain stable layout during gestures.

Next: WebP validation, performance measurements/optimization and expanded cross-browser/mobile/privacy tests. User explicitly requested autonomous implementation without repeated design approvals.

WebP: RIFF chunk bounds/padding, VP8X/VP8/VP8L dimensions (before native decoding), static-only policy, native decoder errors, input accept list implemented. 123 unit tests passed including 10 WebP cases. Container reference: https://developers.google.com/speed/webp/docs/riff_container .

Performance baseline measured in new regression tests: synchronous burst of 240 pointer moves caused 241 draws and 482 backing-size assignments, 23.3 ms; idle background caused 0 editor draws. Fifty history commits with one 10,000-point stroke: 369.7 ms, 51 duplicate stroke objects. Next: rAF batching/conditional sizing and owned immutable snapshot sharing; these performance regression tests currently fail by design.

Performance changes verified: same burst now 1 draw, 0 backing assignments, 7.6 ms; idle background still 0 draws. History benchmark now 1.04 ms, 1 shared frozen stroke across 51 snapshots. Timings are local synthetic measurements, not universal FPS claims. All 124 unit tests and 3 focused Chromium tests passed. Ownership isolates external mutable inputs; internal frozen annotations share safely, texture lifetime collector remains unchanged.

## Release evidence
Pending. No publication claimed.

## Review and compatibility
- Independent read-only review found two P2 bugs: keyboard focus remained on toolbar; zero-delta selection snapped cropped objects. Both reproduced with failing tests, fixed, and reviewer confirmed fixes; no further material issue found.
- New tools/PNG/WebP/mobile theme scenarios passed Chromium and WebKit (16 tests). Fresh isolated browser downloads fixed missing `mozglue`/Chrome side-by-side cache errors without touching shared cache. Native Chromium 125%/200% zoom now passes. Firefox desktop new-tool workflows pass; fixed test-only assumptions about pointerId and DPR before the final rerun.
- ESLint, typecheck, 125 unit tests, production build and production dependency audit passed; audit 0 vulnerabilities.
- Real touch pencil/selection, mixed text/pencil/crop/texture history and preview URL lifecycle checks added. Next: final browser run, clean clone/install, documentation/screenshots, commit and ordinary push, inspect Actions/Pages.
- Real Chromium touch pencil/selection passed without page scrolling and with exactly two actions. Mixed history and pending-preview/URL cleanup: 6 passed across Chromium/Firefox/WebKit.
- WebKit worker lacks OffscreenCanvas: added a bounded temporary HTMLCanvas crop transfer fallback, preserving worker matching/mask sanitization, generation checks and release. Eyedropper uses 1×1 HTMLCanvas. Independent reviewer confirmed privacy/resource correctness; fallback can briefly block the main thread while reading a large crop.
- Added actual synthetic WebP fixture (including alpha) so cross-browser load tests do not accidentally test a PNG fallback from unsupported WebP encoders. Both CI/Pages now install and run all three browser projects. Physical Safari/iOS and Android devices remain outside available testing.
