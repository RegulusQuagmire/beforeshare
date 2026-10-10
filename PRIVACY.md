# Privacy and security

BeforeShare edits one local PNG/JPEG in browser memory. The application has no API key, server upload endpoint, analytics, external fonts/scripts, fetch/WebSocket/beacon code, image logging or persistent image storage. The initial page, JS, CSS and favicon are fetched from the host. Production image operations are tested without operation-generated HTTP/WebSocket requests.

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
