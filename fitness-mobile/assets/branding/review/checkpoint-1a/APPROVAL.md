# Checkpoint 1A — final asset review / approval checklist

Review only. All paths below are relative to `fitness-mobile/assets/branding/`. Original images, prepared assets, earlier documentation and generation tools remain unchanged. This checkpoint adds only this review folder; no replacement production asset is generated. No app/configuration/theme/navigation change, commit or deployment.

Open `review/checkpoint-1a/index.html` at **100% browser zoom**. It contains all six source-mark comparisons, all 48 navigation size/background combinations, launcher mask illustrations, and all 16 processed Somata/FitAdapt logo variants with filenames and source mappings. Static images are also available:

- [Somata S comparisons](somata-marks.png): three drawings at equal visible height.
- [FitAdapt F comparisons](fitadapt-marks.png): three drawings at equal visible height.
- [Navigation sizes](navigation-sizes.png): every icon at 24, 28 and 48 pixels on dark/light backgrounds.
- [Launcher sizes](launcher-sizes.png): iOS 60pt stand-ins and Android 48dp viewport stand-ins on dark/light wallpapers. Gallery additionally shows the Android monochrome candidate.

These are review graphics, not physical-device captures. Pixel sizes are exact image-box sizes at 100% viewing; screen density/browser zoom may change physical size. iOS rounded-square masks are illustrative; the grayscale tinted source is not an emulation of the OS tint appearance. Android uses an illustrative central 72dp viewport within the 108dp foreground layer, not a claim that every OEM uses the same mask/motion.

## Source artwork is not interchangeable

| ID | Exact source | Differences | Prepared derivatives |
| --- | --- | --- | --- |
| S1 | `source/somata/horizontal.png` | Swept sharp ends; simpler folds than S3. | `somata/horizontal-dark.png`, `somata/horizontal-light.png`, `somata/horizontal-mono-bone.png`, `somata/horizontal-mono-charcoal.png` |
| S2 | `source/somata/stacked.png` | Flatter terminal edges; heavier middle; different proportions. | `somata/stacked-dark.png`, `somata/stacked-light.png`, `somata/stacked-mono-bone.png`, `somata/stacked-mono-charcoal.png` |
| S3 | `source/somata/symbol.png` | Dimensional ribbon folds and sharp tips. Recommended canonical S. | `somata/symbol-color.png`, `somata/symbol-mono-bone.png`, `somata/symbol-mono-charcoal.png`, all six files in the app checklist below. |
| F1 | `source/fitadapt/horizontal.png` | Angular lower stroke; slanted wordmark. | `fitadapt/horizontal-dark.png`, `fitadapt/horizontal-light.png` |
| F2 | `source/fitadapt/powered-by.png` | Rounder lower stroke, different folds; upright wordmark. | `fitadapt/powered-by-dark.png`, `fitadapt/powered-by-light.png` |
| F3 | `source/fitadapt/symbol.png` | Swept separated ribbons, warm gradient direction; recommended canonical F. | `fitadapt/symbol-color.png` |

Source comparison crops exclude neighboring wordmarks **for display only** and scale each mark to the same visible height using its alpha≥128 body. They are embedded review images, not new extracted master PNGs. All artwork retains its proportions; faint exterior alpha is not used to determine matching optical height. Dark/light and monochrome editions within a source family change color treatment, not the underlying drawing. S1/S2/S3 and F1/F2/F3 are genuinely different artwork.

## Recommended pairing

Choose **S3 + F3**:

- Somata master: `source/somata/symbol.png`; prepared color asset `somata/symbol-color.png`.
- FitAdapt master: `source/fitadapt/symbol.png`; prepared color asset `fitadapt/symbol-color.png`.

Both have swept ribbon shapes and warm yellow/orange/red transitions. Somata's continuous dimensional S is visually primary; FitAdapt's simpler three-stripe F reads as the supporting engine mark. The pairing also uses the dedicated standalone source files, avoiding extraction from typography-heavy lockups. This is a design recommendation, not an assertion that their gradients or geometry are identical.

If this pairing is selected, **hold S1/S2 and F1/F2 lockups from integration** until you either approve them as intentional exceptions or approve future consistent lockup composition using S3/F3. Do not silently replace marks inside existing wordmarks. Nothing has been recomposed in this checkpoint.

## Corrected Android scale proposal — not applied

Files that would be affected in a later authorized checkpoint:

- `app/android-adaptive-foreground.png`
- `app/android-monochrome-foreground.png`

Continue using `source/somata/symbol.png` directly. Preserve all source pixels, colors, alpha and aspect ratio; no tracing, repainting, thresholding, stretching, or background removal.

| Measurement | Current | Proposed |
| --- | --- | --- |
| Foreground canvas | 1024×1024 / 108×108dp | Unchanged |
| Visible body (alpha≥128) | 430×410px ≈45.35×43.24dp | ≈478.8×458.1px =50.5×48.32dp before raster rounding |
| Relative body width | 1.0 | 1.11352, approximately +11.35% |
| Source-body center | Body centered | Source coordinate (643.5,632.5) mapped to canvas center (512,512) |
| Source-to-output scale | Current conservative prepared scale | 0.43097643 uniformly in x/y |
| Full source-image draw rectangle | Existing candidate | x≈234.67, y≈239.41, size≈540.44×540.44px; the rest stays transparent |

The exact future recipe is a single proportional resample from the source at that transform, with the same transform for the monochrome alpha mask. The review gallery enlarges the existing candidate by the relative width factor for visual comparison; it is not a new production export and can differ slightly due to resampling/rounding.

Why this proposal: it reaches at least 48dp on both visible dimensions without the larger tip clipping that a 54–56dp-wide mark would cause in the tested circular illustration. It also fits every nonzero source pixel inside the centered **66×66dp square** described in [Android's adaptive-icon guidance](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive).

Do not confuse that square with the stricter 66dp-diameter circle used by the earlier preparation. At the proposed scale:

- Zero nonzero-alpha source pixels fall outside the centered 66×66dp square.
- All source pixels with alpha≥128 fit the illustrated centered 72dp-diameter circle.
- Two source pixels outside that 72dp circle have alpha **1/255**. The review mask hides them; no asset pixels have been deleted.
- 1,273 high-opacity source pixels extend outside the stricter 66dp-diameter circle, principally the tips. Thus this proposal is **not** a guarantee for every mask, motion, or inset policy.

The initial 66dp-circle fit was deliberately conservative. The proposed scale corrects the undersized visible body using the existing artwork, but needs explicit visual approval and native launcher/motion checks. If protection inside that strict circle is mandatory, retain the existing scale; don't claim both strict-circle safety and the proposed larger body simultaneously.

## Approval checklist

All checkboxes are intentionally unchecked. Existing file approvals, if any, are not revoked; these checks authorize the specific master selection, treatment, placement, or proposed change. None authorizes app integration by itself.

### Master geometry

- [ ] **Approve S3 + F3 as the canonical pair:** `source/somata/symbol.png` → `somata/symbol-color.png`; `source/fitadapt/symbol.png` → `fitadapt/symbol-color.png`.
- [ ] **Hold the differing lockups for reconciliation:** all S1/S2/F1/F2 derivative filenames in the source table. Alternatively, explicitly approve those different drawings as intentional lockup exceptions.

### Somata alternate colors and silhouettes

- [ ] Confirm `somata/symbol-mono-bone.png` for dark backgrounds and `somata/symbol-mono-charcoal.png` for light backgrounds. They intentionally remove internal fold shading.
- [ ] If S1/S2 are retained, explicitly approve Charcoal-lettering versions `somata/horizontal-light.png` and `somata/stacked-light.png`; dark originals are `somata/horizontal-dark.png` and `somata/stacked-dark.png`.
- [ ] If S1/S2 are retained, explicitly approve monochrome lockups `somata/horizontal-mono-bone.png`, `somata/horizontal-mono-charcoal.png`, `somata/stacked-mono-bone.png`, and `somata/stacked-mono-charcoal.png`.

### FitAdapt lockups

- [ ] If F1 is retained, approve `fitadapt/horizontal-dark.png` and `fitadapt/horizontal-light.png` with its italic wordmark.
- [ ] If F2 is retained, approve `fitadapt/powered-by-dark.png` and `fitadapt/powered-by-light.png` with its upright wordmark. **Hold tiny inline use:** the original slogan is too small at compact widths. A simplified lockup requires separate composition approval; it was not invented here.

### Navigation — review all six previews per file

- [ ] `navigation/home.png`
- [ ] `navigation/nutrition.png`
- [ ] `navigation/training.png`
- [ ] `navigation/progress.png`
- [ ] `navigation/recovery.png`
- [ ] `navigation/community.png`
- [ ] `navigation/scan.png`
- [ ] `navigation/profile.png`

Recommendation: begin later UI trials with **28px image boxes**, retaining a separately sized accessible touch target. The 24px boxes visibly reduce Training/Community detail and Scan's central ring; 48px suits larger shortcuts. No tab changes are proposed. Recovery remains an asset, not authorization for a new metric or destination. Fixed raster color variants do not establish active/inactive navigation states.

### App candidates

- [ ] Recommend `app/launcher-dark-1024.png` as the default/iOS dark candidate (Charcoal background).
- [ ] Confirm `app/launcher-light-1024.png` as the optional iOS light candidate (Bone background).
- [ ] Confirm `app/ios-tinted-candidate-1024.png` as an optional grayscale input, **subject to native tinted-mode verification**, not a prediction of its final OS appearance.
- [ ] Confirm `app/splash-symbol.png` from the same S3 master; background remains a later configuration decision.
- [ ] Approve the **proposed scale only** for `app/android-adaptive-foreground.png` and `app/android-monochrome-foreground.png`. No files have been replaced. Their light/dark backgrounds are later configuration choices, not additional recolored foregrounds.

## Verification and remaining manual checks

- Existing source/processed-file validation remains passing.
- SHA-256 comparison against a pre-review snapshot verifies **every pre-existing branding file** is unchanged, including earlier contact sheets, documentation and tools.
- All 16 logo variants, eight navigation files, and six app candidates are accounted for in the exact-filename checklist.
- No Expo configuration, screens, navigation, theme or application logic changed. No dependencies installed. Existing debug logs left untouched.
- The review generator uses native macOS AppKit and existing PNG tooling, with temporary scripts outside the repository; only new review artifacts are retained.
- Remaining: physical-size perception on your phone; native iOS dark/light/tinted launchers; Android OEM masks and motion; final splash rendering. These have not been claimed passed.
