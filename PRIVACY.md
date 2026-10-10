# Privacy and security

## BeforeShare 2.0 update (2026-10-10)

Static WebP is now accepted alongside PNG/JPEG. RIFF chunk sizes, padding, VP8X canvas and VP8/VP8L frame dimensions are validated before native decode; oversized and animated files are rejected. The native decoder validates compressed payloads. Existing size/memory limits remain. Header checks are not a replacement for browser decoder security updates.

Final preview uses `exportPng`, exactly as export does. Download inside the modal uses the displayed PNG Blob without rendering again. Editor selection handles, history, themes and background animations are excluded. Protective layers stay above text, pencil, arrows and numbers. Moving/resizing/deleting protection can expose original pixels; the UI reminds users to inspect the result. No automatic detection of all private content is promised.

Text is rasterized locally with system fonts; no external font requests. Strokes and text stay in document memory. History holds up to 50 actions using owned frozen annotation objects; external inputs are cloned. Texture assets are collected only once no retained document/preview references them. Preview object URLs are revoked on close, asynchronous results after close are discarded, and image replacement/history edits are locked while preview is open. Graphical resources are closed on replacement, cancellation or unmount as applicable.

Review and browser tests cover output opacity, omitted source metadata, exact preview/download bytes, no operational HTTP requests, damaged replacement preservation, pointer cancellation, mixed history, themes, 400% and emulated touch. These checks do not guarantee absolute privacy, physical memory erasure, native decoder safety or correct user selection.

BeforeShare edits one local PNG/JPEG/WebP in browser memory. The application has no API key, server upload endpoint, analytics, external fonts/scripts, fetch/WebSocket/beacon code, image logging or persistent image storage. The initial page, JS, CSS and favicon are fetched from the host. Production image operations are tested without operation-generated HTTP/WebSocket requests.

## What the exported PNG contains

Export draws the applied crop into a fresh canvas. Applied color fills are opaque; applied texture patches replace the selected pixels, excluding hidden pixels from matching/donors. Missing texture assets fall back to opaque black. Original source EXIF/text metadata and filename are not copied. Zoom does not change export resolution. Browser tests decode output and check privacy pixels, edges, crop, transparency and metadata.

Share the **downloaded PNG**, after checking it visually. Do not share the original file or assume uncovered content has been made private. Texture matching is a simple neighboring-copy algorithm, not semantic object removal; examine its preview. Text/images outside selected areas remain visible.

## Limits

Undo intentionally retains the original bitmap in browser memory while editing; it is not secure erasure. Closing/reloading the page discards application state, but the application cannot guarantee physical memory wiping, erase the original disk file or remove OS/clipboard/browser download copies. A hostile extension, compromised browser/device or modified hosting code is outside this protection.

Compressed file size is capped at20 MiB, dimensions at6000px per side and20 million pixels. PNG IHDR and JPEG SOF sizes are checked before native decoding and again afterwards. Deferred-height JPEG is rejected; resave it normally. These checks reduce oversized-raster allocation risk, but are not a sandbox for native image decoders or a guarantee against every malformed image; keep the browser current.

## Publication and anonymity

Local image processing is not anonymity. GitHub Pages may record visitors' IP addresses/security information under [GitHub's privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). Public repositories/Pages URLs reveal the chosen GitHub account and project. The application's local processing does not conceal an identity that is visible in screenshot content, GitHub profile, publishing account or hosting logs.

The original local development history contained a machine-specific path. Its current text has been sanitized. Publish the separately prepared **work/public-release** checkout with fresh history, not the original development Git history. It contains the reviewed source and synthetic assets, not browser profiles, credentials, node_modules or original user screenshots. No Git history is force-rewritten by this preparation.

## Audit scope (2026-10-10)

Independent read-only source review found no Critical/High issue, one Medium oversized-raster allocation-order issue and one Low personal-path publication issue. The loader guard was fixed with five RED→GREEN tests; publication uses a sanitized snapshot. A previously misleading decoder-mock test now uses a valid fixture. Targeted history/source secret-pattern scanning found no common API/private-key credentials; this is not proof that every possible secret is absent. npm audit and browser/unit test results are recorded in PROGRESS.md. Native decoder fuzzing, secure erasure and a guarantee of anonymity are not claimed.
