# Checkpoint 1B — approved master identity and reconciled candidates

Master selection approved by the user on **2026-10-18**. This document records the new decision without changing earlier reports or assets. Earlier S1/S2/F1/F2 comparisons remain historical references; they are not alternate approved master drawings.

## Approved masters

Paths are relative to `fitness-mobile/assets/branding/` unless a section says otherwise.

| Brand | Approved master PNG | SHA-256 |
| --- | --- | --- |
| Somata S3 | `somata/symbol-color.png` | `3be74bd514c7450fc59adb1fa004ac42940d060103c39acb02b08dbfd6f4afb8` |
| FitAdapt F3 | `fitadapt/symbol-color.png` | `b7e792f6c40810f695f24d5b03eebb5381299ff2605b9c0780f247ead5955a56` |

Both approved PNGs are 768×768. Their actual file hashes are also verified and recorded in `manifest.json`. Every new mark is copied from, or uniformly downsampled from, these **prepared master files**, not regenerated from another source logo. No S1/S2/F1/F2 mark is used in a reconciled candidate.

All **71 pre-existing branding files** are preserved byte-for-byte, including all original source images, processed PNGs, review files and earlier tools. Outputs are confined to the new `reconciled-1b/` folder. No screens, tabs, theme, configuration, dependencies, stored data, backend logic or production resources changed. No commit, push, merge or deployment.

## Review the candidates

```sh
cd /Users/aristos/Documents/fitness-app
open fitness-mobile/assets/branding/reconciled-1b/review/index.html
```

- [Before/after — all four lockups](review/before-after.png)
- [Somata candidates — dark/light surfaces](review/contact-somata.png)
- [FitAdapt candidates — dark/light surfaces](review/contact-fitadapt.png)
- [Small-size previews](review/small-sizes.png)
- [Android circular/rounded masks and tip-clipping stress test](review/android-masks.png)
- [Updated inventory — 24 new PNGs and 30 preserved prepared PNGs](INVENTORY.md)

The HTML gallery displays small previews at explicit CSS widths. Use 100% browser zoom. Static sheets may be scaled by your viewer and are not device screenshots. Click image names to inspect full-resolution PNGs.

## Recommended new lockup files

The following paths are relative to **`fitness-mobile/assets/branding/reconciled-1b/`**. Recommendations await composition approval; approved master selection does not automatically approve new spacing or typography choices.

| Use | Dark background | Light background |
| --- | --- | --- |
| Primary Somata | `somata/horizontal-s3-dark.png` | `somata/horizontal-s3-light.png` |
| Stacked Somata | `somata/stacked-s3-dark.png` | `somata/stacked-s3-light.png` |
| Primary FitAdapt | `fitadapt/horizontal-f3-dark.png` | `fitadapt/horizontal-f3-light.png` |
| Compact attribution | `fitadapt/powered-by-f3-compact-dark.png` | `fitadapt/powered-by-f3-compact-light.png` |

Each layout also has explicitly named `-mono-bone.png` and `-mono-charcoal.png` candidates in the same directory. Exact filenames, dimensions and hashes are in the inventory and manifest. These silhouettes retain alpha and intentionally remove gradient fold shading.

## Lettering extraction and composition decisions

### Somata

The wordmark and tagline are extracted together from `source/somata/horizontal.png`, using the rectangle **x660, y170, width1440, height430**, into `reconciled-1b/extracted/somata-wordmark-tagline.png`. Included RGBA pixels are copied exactly. No fonts are identified, substituted or retyped. Both visible S1 components were checked: neither contributes alpha≥128 pixels inside the lettering crop.

The horizontal composition copies S3 at native 768×768 and the extracted lettering at native resolution. The stacked composition uses the same native S3 plus the same lettering reduced uniformly to 75%. This gives both layouts the same wordmark family. It intentionally does **not** retain the slightly different lettering/layout from the old stacked source; that choice needs review.

Exact placement coordinates and dimensions are recorded in `manifest.json`. Native master regions in the horizontal/stacked output are verified pixel-identical to the approved S3. Colored variants retain the original gradient; light versions recolor only neutral lettering to Charcoal.

### FitAdapt

The existing sources have inconsistent typography: `source/fitadapt/horizontal.png` uses italic lettering; `source/fitadapt/powered-by.png` uses upright lettering. **The recommended candidate uses the existing upright lettering for both lockups.** This is a visible design choice, not a newly invented font or a silent claim that the old wordmarks match.

All lettering comes from `source/fitadapt/powered-by.png`, well to the right of the old F2 mark:

| Extraction | Source pixels | Treatment |
| --- | --- | --- |
| `extracted/fitadapt-wordmark-tagline.png` | x765, y280, width1235, height320 | Exact crop of wordmark and tagline, including the p descender. |
| `extracted/powered-by.png` | x765, y150, width610, height125 | Exact crop of the existing phrase. |
| `extracted/fitadapt-wordmark-no-tagline.png` | Same wordmark crop, excluding source x<1698 AND y≥540 | Separates the tagline for the compact candidate. The p descender at x1706–1757 is retained. No glyphs are retyped or repaired. |

The primary horizontal uses the full native F3 and native wordmark/tagline crop. The compact layout downsamples F3, the original phrase, and the no-tagline lettering by the **same 0.5 factor** and repositions them. It does not use the old rounded F2 drawing.

The compact version **intentionally omits the tagline** to improve small-size use. Approve that omission separately. The original tagline remains in the primary horizontal candidate and in every preserved source/processed asset.

### Faithfulness and limitations

Extracted rectangles retain source antialiasing and faint residual alpha. No pixel thresholding, automatic background removal, sharpening, contour tracing, font reconstruction, saturation adjustment or AI artwork generation is used. Ordinary uniform downsampling is documented; it is not described as pixel-identical at a different resolution. No SVGs are supplied or claimed exact.

Sources are interpreted as sRGB as in Checkpoint 1; the original PNGs lack an embedded profile. We can verify pixel/color preservation against the approved rasters, not colorimetric equivalence to an unavailable vector/design master.

## Monochrome validation

Existing files `somata/symbol-mono-bone.png` and `somata/symbol-mono-charcoal.png` were checked against the approved S3:

- Every alpha byte matches S3 exactly.
- Every RGB value matches the documented uniform Bone or Charcoal conversion.
- No file was regenerated or overwritten.

New standalone FitAdapt candidates:

- `reconciled-1b/fitadapt/symbol-f3-mono-bone.png`
- `reconciled-1b/fitadapt/symbol-f3-mono-charcoal.png`

Each preserves **every F3 alpha byte**. New monochrome lockups preserve their corresponding reconciled color lockup's alpha. Old horizontal/stacked Somata monochromes remain preserved but contain S1/S2; they should not serve as the reconciled identity.

## App assets and Android enlargement

Existing files remain untouched:

- **Preferred launcher:** `app/launcher-dark-1024.png`.
- Preserved alternates: `app/launcher-light-1024.png`, `app/ios-tinted-candidate-1024.png`.
- Unchanged splash: `app/splash-symbol.png`.
- Original Android foregrounds remain available for comparison.

New, separate Android candidates:

- `reconciled-1b/app/android-adaptive-foreground-s3-plus11_35.png`
- `reconciled-1b/app/android-monochrome-foreground-s3-plus11_35.png`

Both are transparent 1024×1024 PNGs. The color candidate uses **the approved 768px S3**, uniformly resampled at scale **0.7798127035830618**, with source origin mapped to **(212.55192182410428, 212.55192182410428)** on the new canvas. The approved body center stays at the canvas center. Nominal body width is old width 430px ×1.1135 =478.805px. Raster sampling yields **479×458px**, approximately **50.52×48.30dp** in a 108dp layer. Rounded bounds are measurements, not a stretched target rectangle. The monochrome candidate uses precisely the same alpha mask.

This follows the 1A proposal but now renders from the expressly approved prepared master, rather than its earlier raw source. Consequently raster edge counts differ slightly from the 1A analytical preview. No original pixels are clipped by the export canvas; all new files remain unmasked. Gradients/proportions are not redesigned.

Measured review-mask results on the new exported candidate:

| Mask | Nonzero-alpha pixels outside | Pixels outside with alpha≥128 | Meaning |
| --- | --- | --- | --- |
| Centered 72dp-diameter circle | 0 | 0 | Fits this illustrated static viewport. |
| Centered 66dp-diameter circle | 393 | 231 | Stress mask cuts the sharp tips; maximum excluded alpha is 253. |

The review shows both circles, rounded masking, current/new 48dp examples, and the untouched preferred launcher. Backgrounds/masks are review-only. Native OEM mask, animation/parallax, and system tint tests remain necessary; this does not certify the larger mark against every platform mask or motion. If preserving all tips within the earlier stricter circle is mandatory, keep the old conservative candidate instead.

## Navigation

All eight existing PNGs are retained: `navigation/home.png`, `nutrition.png`, `training.png`, `progress.png`, `recovery.png`, `community.png`, `scan.png`, `profile.png` (all within the same `navigation/` directory). Recommend **28px image boxes** for initial UI testing, with separately sized touch targets and labels. Existing five-tab navigation stays unchanged; available icons do not authorize additional tabs or product features.

## Approval still required

- [ ] Somata horizontal spacing/proportions and stacked placement, including using the horizontal wordmark consistently in both layouts.
- [ ] Upright existing FitAdapt lettering for the new primary horizontal instead of the old italic lettering. If italic remains preferred, retain the old source as reference and request a separate faithful extraction/composition candidate; do not substitute F1.
- [ ] Compact Powered by composition and **explicit tagline omission**, with the p descender preserved.
- [ ] New F3 monochrome silhouettes and reconciled monochrome lockups. Geometry is verified, but gradient fold shading necessarily disappears.
- [ ] New Android +11.35% foreground and the documented strict-circle tip-clipping tradeoff, pending later native mask/motion checks.
- [ ] Minimum display sizes: primary taglines are not reliably legible at 160/240px total width. The compact phrase is also small at 160px. Start compact attribution review at **240–320px**; do not silently omit or recreate unreadable text. Stacked 80/120px samples are unsuitable when tagline reading matters.

Master selection, the preferred dark launcher, preserved splash/alternates, and retaining all eight icons are already decided; no further approval is requested for those facts. No implementation will begin until the new candidate decisions are reviewed.

## Validation / reproducibility

No dependency was installed. Node uses the existing PNG codec and the renderer uses macOS AppKit. From the repository root:

```sh
node fitness-mobile/assets/branding/reconciled-1b/tools/prepare.cjs
node fitness-mobile/assets/branding/reconciled-1b/tools/review-index.cjs
swift -module-cache-path /private/tmp/somata-brand-swift-cache fitness-mobile/assets/branding/reconciled-1b/tools/contact-sheets.swift fitness-mobile/assets/branding/reconciled-1b
swift -module-cache-path /private/tmp/somata-brand-swift-cache fitness-mobile/assets/branding/reconciled-1b/tools/render-review.swift fitness-mobile/assets/branding/reconciled-1b
node fitness-mobile/assets/branding/reconciled-1b/tools/validate.cjs
```

Preparation writes only this new checkpoint folder and refuses any pre-existing branding-file hash change. The final validation checks source/master preservation, exact native master placements, all output hashes and PNG decoding, extraction fidelity, descender preservation, monochrome alpha, transparent backgrounds and mask measurements. The earlier asset validator also remains passing. Reports are in `verification.json`.

No mobile build/typecheck/Expo export was required or run for unreferenced image assets. No device or native launcher tests are claimed. Application behavior and existing assets are unchanged.
