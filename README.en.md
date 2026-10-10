# BeforeShare

**Hide the private. Share the rest.**

A private screenshot editor that runs locally in your browser. Hide sensitive details, add annotations, crop the image and preview the exact PNG before sharing.

**[Open BeforeShare](https://regulusquagmire.github.io/beforeshare/)** · [Source code](https://github.com/RegulusQuagmire/beforeshare) · [Русская документация](README.md)

The account is now **RegulusQuagmire**. Use the current Pages address above; the former owner's Pages address may not redirect.

## Features

- Select objects, move them, resize redactions and adjust arrow endpoints. Change colors, delete objects or choose overlapping objects from the list.
- Pan the zoomed image with a mouse or finger, independently of object selection.
- Hide sensitive details with fully opaque rectangular fills; choose a color or sample one from the image.
- Add arrows, numbered markers, multiline text and smooth freehand pencil strokes. Text uses local system fonts and supports Russian and English.
- Crop, zoom from 25% to 400%, and restore simple backgrounds using a nearby texture patch with an apply/cancel preview.
- Undo and redo up to 50 actions. One completed drag or pencil stroke creates one history action.
- Preview the final PNG, check its resolution and download the same generated file. The preview and export share the pixel renderer.
- Import static PNG, JPEG and WebP. Input contents and dimensions are checked before decoding where possible.
- Switch between Russian and English without changing the image, annotations or history. Only your language preference is saved locally.
- Dark and light themes, stars and constellations, soft moving gradients, gentle theme transitions and button hover effects. System reduced-motion settings disable these effects.

## Privacy and limits

Images stay in your browser: no uploads, accounts, analytics, external fonts or cloud image APIs. Export flattens edits into a fresh PNG without copying the original filename or EXIF/text metadata. See [PRIVACY.md](PRIVACY.md).

Check confidential details yourself before sharing, especially after moving, resizing or removing redactions. The app does not automatically detect every private detail or guarantee absolute privacy. Texture restoration copies nearby pixels and may show seams or repeats on complex backgrounds.

Input limits: 20 MiB, 20 megapixels and 6000 pixels per side. Animated files are unsupported. A texture operation covers at most 1 million pixels. Images and editing sessions are not persisted: download your PNG before closing or reloading the page. Opening another image asks before discarding current edits.

## Development

Node.js 24 and npm are required.

```sh
npm ci
npm run dev
```

Run validation with:

```sh
npm run lint
npm run typecheck
npm run test:unit
npm run build
npx playwright install --with-deps chromium firefox webkit
npm run test:e2e
```

Playwright covers Chromium, Firefox and WebKit, including English/Russian, mobile layouts, both themes, reduced motion, PNG privacy and existing editing tools. Engine tests and emulation do not replace physical iOS/Android device testing.

GitHub Actions checks the application and deploys the production bundle to GitHub Pages from `main`. The repository name determines the `/beforeshare/` base path; the account name determines the Pages hostname. See [RELEASE.md](RELEASE.md) and [IMPLEMENTATION_PROGRESS.md](IMPLEMENTATION_PROGRESS.md) for verified release results and testing limitations.

MIT licensed. Use synthetic images in tests and preserve local processing and opaque redactions.
