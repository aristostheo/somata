# Branding checkpoint validation

Branch: `profile-redesign`. Scope: only new files inside `fitness-mobile/assets/branding/`, excluding the untouched `source/` tree. Existing `fitness-web/firestore-debug.log` changes and untracked `fitness-web/firebase-debug.log` were left untouched.

## Commands and results

Run from `/Users/aristos/Documents/fitness-app`:

| Command | Result |
| --- | --- |
| `node fitness-mobile/assets/branding/tools/prepare.cjs` | PASS — 17 original files match baseline SHA-256; all 16 PNGs decoded; 30 PNG copies encoded and decoded successfully. Neutral-lettering edits preserve alpha and all unselected RGB pixels. Monochrome masks preserve alpha. Adaptive foreground stays within the conservative safe circle. |
| `node fitness-mobile/assets/branding/tools/review-index.cjs` | PASS — inventory and offline gallery cover all 30 outputs and 16 source images. |
| `swift -module-cache-path /private/tmp/somata-brand-swift-cache fitness-mobile/assets/branding/tools/contact-sheets.swift fitness-mobile/assets/branding` | PASS — four contact sheets generated with built-in macOS AppKit; no dependency installed. |
| `node fitness-mobile/assets/branding/tools/validate.cjs` | PASS — source file set and hashes; output set, hashes, sizes, PNG decode, alpha/background requirements, clear output margins, navigation/app canvas dimensions, monochrome alpha preservation, Android safe-circle bounds, contact sheet decoding, gallery coverage, exact seven color tokens. |
| Re-run `prepare.cjs` and compare all output SHA-256 values to the first run | PASS — all 30 prepared PNGs byte-identical. |
| `git diff --name-only` / `git status --short` | Only new branding files plus the two pre-existing web debug-log changes. No source asset or tracked app/configuration edit. |
| `git diff --check` | Reports an existing trailing blank line in `fitness-web/firestore-debug.log:136`; left untouched. This is outside the branding changes. |

## Image inspection

- Every source image was visually inspected; dimensions, transparency counts, bounds and PNG chunks are recorded in `asset-manifest.json`.
- All 16 source PNGs use 8-bit RGBA; none has an embedded ICC/sRGB/gamma profile. The interpretation is sRGB, not certified color matching to unavailable vector masters.
- Independent boundary scan found **zero source pixels with alpha≥128 touching a source canvas edge**. Some faint alpha residues do touch edges and are retained.
- All 30 copies were inspected through the light/dark contact sheets. Normal opaque-background composites of the Somata horizontal logo, FitAdapt Powered by lockup and scan icon confirmed that raw-image previews substantially exaggerated the apparent edge residue.
- All eight navigation PNGs are transparent **192×192**. All six app candidates are **1024×1024**. Launcher light/dark and iOS tinted are RGB PNGs without an alpha channel. Other asset PNGs are RGBA with transparent backgrounds and clear outer margins.
- Prepared artwork totals **4,016,379 bytes** (about 3.83 MiB), excluding contact sheets, source files and documentation. PNG encoding is lossless; resizing is explicitly recorded and not described as lossless artwork conversion.
- Android alpha fits the conservative safe circle, but the main S body is approximately **45.4×43.2dp**, below the recommended minimum logo size. This is a documented **remaining review limitation**, not a passed production-sizing check.
- Small tagline legibility, consistent S/F master geometry, and optical balance across navigation icons remain approval items. No SVGs, fabricated compact lettering, new shapes or vector-equivalence claims were produced.

## Not exercised

No app integration, app typecheck/test suite, Expo export, simulator build, device installation, launcher/splash runtime test or deployment was performed. App code and configuration are unchanged; asset-specific checks were run instead. A native build is required after a separately authorized integration checkpoint to assess installed icons/splash and iOS/Android appearance behavior. Contact sheets are review images, not device screenshots.

No dependency, theme import, secret, authentication setting, Firestore rule, FitAdapt behavior, stored user data, tab or screen was changed. No commit, push, merge or deployment occurred.
