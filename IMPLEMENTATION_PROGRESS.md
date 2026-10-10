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
Analysis complete. Next: failing tests for object selection/transform and new UI workflows, then implementation. User explicitly requested autonomous implementation without repeated design approvals.

## Release evidence
Pending. No publication claimed.
