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

## Release evidence
Pending. No publication claimed.
