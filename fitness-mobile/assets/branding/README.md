# Somata + FitAdapt branding — asset preparation

This package contains **30 prepared PNG candidates**, four contact sheets, an offline review gallery, exact brand colors, and source/edit manifests. Nothing is wired into the app. All 16 original images and the original `.DS_Store` are preserved byte-for-byte. The current five tabs, screens, theme, Expo configuration and business logic are unchanged.

Open the complete visual review locally:

```sh
cd /Users/aristos/Documents/fitness-app
open fitness-mobile/assets/branding/review/index.html
```

The gallery includes every prepared image and original source on Charcoal, Bone and a transparency checkerboard. It also shows navigation icons at 24 and 32 CSS pixels. File links open the full-resolution PNGs. No server, Firebase emulator, credentials or network connection is needed.

- [Complete inventory and usage mapping](INVENTORY.md)
- [Somata contact sheet](review/contact-somata.png)
- [FitAdapt contact sheet](review/contact-fitadapt.png)
- [Navigation contact sheet](review/contact-navigation.png)
- [App-asset contact sheet](review/contact-app.png)
- [Validation results](VALIDATION.md)
- [Machine-readable source/edit manifest](asset-manifest.json)

## Source inspection

All filenames match their depicted purpose. All images are 8-bit RGBA PNGs with real transparent pixels; none needs an invented background-removal pass. Most solid artwork has alpha around 252–254 rather than 255. This slight translucency is retained. Some almost-transparent residual pixels extend far beyond the main artwork, occasionally to the original canvas edge. Raw previews can exaggerate their RGB into apparent ragged halos. Normal alpha-composited checks on actual backgrounds look substantially cleaner; these are **not proven damaged or unusable wordmarks**.

No high-opacity main mark was found cut off at its source boundary. Nonzero edge alpha is recorded in the manifest rather than silently removed. Original large padding varies; generated logos trim only fully transparent outer rows/columns and receive 16px clear margins. Icon/symbol alignment uses the alpha≥128 body bounds **only for positioning**; it does not threshold, erase or reconstruct pixels.

| Original under `source/` | Dimensions | Visual findings / disposition |
| --- | --- | --- |
| `somata/horizontal.png` | 2172×724 | Horizontal S, white lowercase wordmark, orange “TRAIN SMARTER. EVOLVE DAILY.” The S has sharp swept tips and simpler folds than the standalone symbol. Dark source lettering; neutral-lettering light copy prepared. |
| `somata/stacked.png` | 1254×1254 | Stacked S/wordmark/tagline. Flatter S end caps and different folds/proportions from the horizontal and standalone marks. Preserved independently, not made to match by redrawing. |
| `somata/symbol.png` | 1254×1254 | Standalone dimensional S with pointed tips and layered gradient folds. Used unchanged in shape for app candidates; not substituted into the other logos. |
| `fitadapt/horizontal.png` | 2172×724 | Slanted FitAdapt wordmark, white “Fit”, orange “Adapt”, angular F and white tagline. Matches filename. |
| `fitadapt/powered-by.png` | 2172×724 | “Powered by” above an upright FitAdapt wordmark and tagline. F has a rounder bottom, different folds, and different typography from the primary logo. Compact copy retains all text; no new lockup typeset. |
| `fitadapt/symbol.png` | 1254×1254 | Separate three-stripe F; different proportions/gradient from both lockups. Preserved as supplied. |
| `navigation/home.png` | 1254×1254 | House outline with filled doorway; matches purpose. |
| `navigation/nutrition.png` | 1254×1254 | Fork and leaf; denser silhouette than Home. Fine low-alpha residue between fork tines retained. |
| `navigation/training.png` | 1254×1254 | Wide dumbbell, pale plate inserts; inherently shorter than the square icons. No artificial vertical stretching. |
| `navigation/progress.png` | 1254×1254 | Rising bars and arrow; independent parts preserved. |
| `navigation/recovery.png` | 1254×1254 | Crescent and sparkle; does not authorize a new tab or unsupported recovery metric. |
| `navigation/community.png` | 1254×1254 | Three people, wide proportions and pale inserts. Fine separation gaps retained. |
| `navigation/scan.png` | 1254×1254 | Four corners and a center ring. More low-alpha residue than other icons; looks clean in normal compositing. No ring reconstruction or speckle deletion. |
| `navigation/profile.png` | 1254×1254 | Person outline and pale face; taller visual mass than Training/Community. |
| `navigation/original-icon-sheet.png` | 1448×1086 | Eight labeled concepts. Individual source icons are separate renditions with differing proportions/highlights. Kept as reference; no icons extracted or text repurposed. |
| `references/colours.png` | 1448×1086 | Palette names/hex labels correspond to the supplied palette. Swatches are shaded/textured, not reliable flat color samples. Large reference-sheet padding retained. Reference only. |

The raster files contain no ICC, sRGB or gamma chunks. They are interpreted as sRGB; exact colorimetric equivalence to an unavailable design master cannot be certified. Gradients contain intermediate colors and must not be treated as seven flat palette values. The supplied hex values below are authoritative for future UI tokens; existing art is not forcibly palette-quantized.

## Prepared assets and edits

**Somata (11 PNGs):** horizontal and stacked logos each have original-white dark-background, Charcoal-lettering light-background, Bone monochrome and Charcoal monochrome copies. The standalone S has a single color copy suitable for both backgrounds plus Bone and Charcoal monochrome copies. Separate identical light/dark symbol files would add no value.

**FitAdapt (5 PNGs):** primary and existing Powered by lockup each have dark/light copies. The standalone F is a color copy for either background. The compact lockup is 960px wide as a source-preserving raster; its small tagline still limits the useful display size. It is not an approved tiny inline badge.

**Navigation (8 PNGs):** all eight named assets have a 192×192 transparent canvas. The body is centered with a maximum 144px span; scale is reduced where necessary to keep *every* nonzero source pixel within the canvas. Source aspect ratios, stroke/fill weights and gradients remain intact. These files can supply images up to 64pt at 3x density, but require visual review at their actual UI size. No selected/unselected states, notification icon, extra tab, or new feature was invented.

**App (6 PNGs):** two opaque 1024×1024 launcher backgrounds, a transparent 1024×1024 splash S, transparent Android adaptive/monochrome foregrounds, and an opaque grayscale iOS tinted candidate. Only platform launcher assets have baked backgrounds; logos, navigation icons and splash/Android foreground images remain transparent.

Processing is deterministic:

- Crop only empty outer padding. Preserve source shapes, text, slogans, gradients and all nonzero-alpha pixels before ordinary downsampling. No generated or repaired artwork, thresholded cutouts, tracing, stroke changes, geometric stretching or upscaling.
- Resample by area integration with premultiplied alpha to avoid dark fringes from transparent RGB. Encoding uses existing `pngjs` with lossless PNG compression at level 9 and adaptive PNG filters. The resize is not claimed pixel-identical to its higher-resolution source.
- Light wordmark copies recolor only light neutral pixels (`min(R,G,B)≥128` and `max−min≤32`) to `#0B0E12`, before resize. Original alpha and every other RGB pixel are unchanged. The visible neutral lettering is distinct from the saturated red/orange marks; original dark copies are also supplied. The exact selected count is in each manifest entry. Small-size review still required.
- Monochrome copies set RGB uniformly and preserve the prepared alpha mask exactly. Internal gradient folds disappear as expected for a silhouette; no vector paths are inferred.
- Source PNGs include a `caBX` metadata chunk. Originals retain it unchanged. Derived PNGs omit source metadata; they do not claim to preserve the originals’ embedded provenance assertions.

No SVGs were created. These are textured raster references, without supplied vector paths. An automated trace would be an approximation, and embedded PNG-in-SVG files would not be vector recreation.

## Brand reference

The following are also in [brand-tokens.json](brand-tokens.json), which is **not imported into the app**.

| Token | Hex | Intended future role |
| --- | --- | --- |
| Charcoal | `#0B0E12` | Dark canvas; light-surface lettering |
| Graphite | `#1A1F26` | Dark elevated surface |
| Slate | `#38434D` | Secondary neutral/borders |
| Bone | `#F4F3EE` | Light surface; monochrome on dark |
| Somata Orange | `#FF6A00` | Primary brand accent |
| Coral Red | `#FF5A2A` | Secondary warm accent |
| Energy Yellow | `#FFC629` | Highlight accent |

These are palette tokens, not automatic accessible foreground/background pairings. Do not use orange/yellow small text on Bone without contrast verification. Choose the background-specific wordmark and monochrome versions; the contact sheets intentionally expose the wrong-background cases too.

## Installed Expo compatibility — candidates only

Verified installed Expo **57.0.24**, `@expo/config-types` **57.0.2**, and `expo-splash-screen` **57.0.9**. The installed configuration types support `ios.icon.light`, `.dark`, `.tinted`, and `android.adaptiveIcon.foregroundImage` / `.monochromeImage`. Current `app.config.ts` still references its original images; it was not edited.

The launcher candidates are square opaque **RGB** PNGs, with no alpha channel or pre-rounded corners. Splash is transparent PNG; background selection belongs in a later config change. This follows the PNG path supported by the installed SDK and [Expo’s app icon/splash guidance](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/). No Icon Composer multilayer artwork was fabricated.

Android foregrounds fit all nonzero alpha within the central 66/108-diameter circle, retaining a small rounding margin. The OS supplies masking and themed-icon color. See [Android adaptive-icon requirements](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive). The conservative all-pixel fit makes the opaque S body approximately **45.4×43.2dp** in the 108dp layer, below Android’s recommended 48×48dp logo size. **This candidate needs native optical-size review or an approved cleaner/cropped master before integration**; it is not claimed to meet that recommendation. Enlarging it by silently clipping faint original pixels was avoided.

Native launcher/splash behavior, Android mask variants and iOS tinted appearance have not been tested. Expo Go does not validate installed launcher icons or a final release splash. Plan a native preview build after approval and wiring.

## Review decisions / remaining limitations

1. **Canonical geometry:** approve using the supplied S variants as distinct lockups, or provide consistent master exports. Likewise choose whether FitAdapt’s slanted primary and upright Powered by wordmarks/three F shapes are intentional. No version was silently declared the master for all placements.
2. **Alternate colors:** approve Charcoal lettering on light surfaces and the alpha-derived monochrome silhouettes. They preserve geometry but intentionally change color/shading. Confirm the Charcoal/Bone launcher candidates; neither is configured as default yet.
3. **Compact attribution:** the existing slogan becomes too small in a tiny badge. Approve a minimum display size after phone review, or supply a compact master without the slogan. This checkpoint did not remove or retype it.
4. **Android optical size:** approve a clean master/crop approach or review a subsequent mask-specific sizing adjustment; current conservative foreground is undersized relative to Android guidance.
5. **Small navigation images:** compare at 24/32pt. Training and Community have naturally wider silhouettes and differing fill/stroke weights. Equal canvas/centering cannot make them an exact stroke system without altering artwork. No such alteration was made.

None of these issues is resolved by tracing the raster into an “exact” SVG. The original icon sheet and palette remain references only. All prepared files are marked `review-required`, not approved for release.

## Proposed next checkpoint

After the above review, wire only the approved assets through a small shared brand-image component and the existing Expo icon/splash configuration. Map icons to existing features without changing the five-tab structure. Keep FitAdapt attribution in existing valid-result contexts; do not change acceptance or calculations. Then verify light/dark display, accessible labels, actual phone icon sizes, and native iOS/Android launchers/splash. A theme migration or screen redesign should require its own explicit scope; neither has begun here.

## Reproduce and validate

From the repository root, using the already-installed dependencies and macOS AppKit:

```sh
node fitness-mobile/assets/branding/tools/prepare.cjs
node fitness-mobile/assets/branding/tools/review-index.cjs
swift -module-cache-path /private/tmp/somata-brand-swift-cache fitness-mobile/assets/branding/tools/contact-sheets.swift fitness-mobile/assets/branding
node fitness-mobile/assets/branding/tools/validate.cjs
```

Preparation refuses changed source checksums. If new approved source artwork is supplied later, review and deliberately refresh the baseline; do not bypass the guard. Validation is read-only. No dependency, app import, configuration change, service call or deployment is required.
