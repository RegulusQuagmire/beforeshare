# Synthetic fixtures

No personal data. `ordinary.png` / `ordinary.jpg`: 320 × 180, orange top-left and dark bottom-right quadrants. `transparent.png`: 80 × 60 with half alpha. `orientation-6.jpg`: encoded 320 × 180, EXIF orientation=6; decoded view must be 180 × 320 with orange top-right. `corrupt.png`: valid PNG framing, invalid compressed pixels. `animated.png`: valid single-frame APNG with acTL and fcTL; deliberately rejected as animation before decoding.

Large file and dimension boundary tests construct values in memory instead of storing large fixtures.

Evening 6: `synthetic-account.png` is a locally generated 480 × 300 screenshot with demo@example.invalid and DEMO_TOKEN_NOT_REAL_123456; neither identifies a real person or credential. The journey covers both fields, adds an arrow and two markers, crops, undoes/redoes, downloads and separately decodes the PNG in Chromium and Firefox.

Release documentation uses copies of synthetic-account.png and an actual flattened editor export in docs/images/before.png and after.png; editor.png is a real screenshot of that synthetic session. No personal data or real credentials.
