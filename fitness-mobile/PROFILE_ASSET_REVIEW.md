# Profile + FitAdapt — decorative asset review

Approval checkpoint only, on `profile-redesign`. No existing screens, application components, themes, routes, settings, services, calculations, data or source artwork have been changed. No account was loaded and no proposal, measurement or trend was fabricated. New files are confined to this report, one review renderer and the unreferenced review folder.

## Review

- [Dark/light gallery](review/profile-assets/index.html)
- [All eight originals](review/profile-assets/contact-sheet.png)
- [Dark treatment](review/profile-assets/profile-dark.png)
- [Light treatment](review/profile-assets/profile-light.png)
- [Dark large text](review/profile-assets/profile-dark-large-text.png)
- [Light large text](review/profile-assets/profile-light-large-text.png)

```sh
open /Users/aristos/Documents/fitness-app/fitness-mobile/review/profile-assets/index.html
```

The previews show proposed background treatment for four existing areas, not a completed Profile redesign. They use native React Native Image/Text/View/Pressable and icon components rendered through React Native Web, with the existing approved brand components. Controls are explicitly inactive. Values are em dashes; the weight chart shows its existing insufficient-history message. No personal name, email, account data, measurements, accepted plan or pending proposal appears. Lower Profile sections are acknowledged rather than redesigned.

## All-file quality audit

All paths in this table are relative to `fitness-mobile/assets/branding/profile/`.

| File | Dimensions | Compressed size | Visual finding |
| --- | --- | --- | --- |
| `ambient-dark.png` | 2400×1200 | 54.7 KiB | Subtle near-black/brown ambient wash. No objects or lettering; generous quiet space for identity/header content. |
| `ambient-light.png` | 2400×1200 | 62.0 KiB | Warm ivory/peach counterpart with quiet tonal variation. Clearly light rather than a transparent dark overlay. |
| `goals-dark.png` | 2400×1200 | 143.4 KiB | Strongest warm shading of the dark set, with soft lower waves and faint angular peaks. Suitable behind current-focus framing, not as a data visualization. |
| `goals-light.png` | 2400×1200 | 203.0 KiB | More noticeable peach/brown waves and angular peaks. These can resemble an area chart; keep metric tiles opaque and do not pair the decoration with axes, dates or performance claims. |
| `fitadapt-dark.png` | 2400×1200 | 103.2 KiB | Quiet charcoal field with restrained orange/brown lower waves. No baked-in FitAdapt branding. |
| `fitadapt-light.png` | 2400×1200 | 138.2 KiB | Ivory/peach field with soft lower waves; enough quiet space for the native heading and F3 mark. |
| `progress-dark.png` | 2400×1200 | 96.3 KiB | Soft wave composition similar to FitAdapt, with different tonal balance. Keep clear of the measured chart plot. |
| `progress-light.png` | 2400×1200 | 143.1 KiB | Soft peach waves. Same restriction: decorative heading treatment only; never a weight trace or forecast. |

All eight decode successfully as **8-bit, opaque RGB PNGs**. There is no transparency, embedded ICC profile, sRGB declaration, gamma or chromaticity metadata. Interpret display as sRGB unless the source owner supplies a calibrated profile; exact colorimetric accuracy cannot be certified. These backgrounds are tonal artwork, not substitutes for the exact brand tokens used for native controls.

Visual inspection found no obvious clipping defects, text, watermarks, harsh cutout edges or compression blocks. Waves intentionally continue beyond the canvas edges. Their soft detail appears intentional for backgrounds; they are not low-resolution photographs. Fine 8-bit gradient banding and near-black visibility still require OLED/physical-device inspection. No provenance/licensing claim is made by this technical audit.

The four families are intentionally similar. Goals is somewhat stronger; ambient lacks the visible lower wave treatment. Do not rely on the image to communicate section identity, plan state, success, pending status or progress. Native headings and semantic UI must provide those distinctions. Dark/light variants have related compositions, but are not assumed to be exact recolors.

## Exact proposed mapping to the existing Profile

Source of truth: `app/(tabs)/profile.tsx`.

| Existing region | Dark / light background | Boundary and preserved content |
| --- | --- | --- |
| `Page` header (`Your space / plan`, Profile) and adjoining identity card | `ambient-dark.png` / `ambient-light.png` | Bounded header-area backdrop, not a full-page image. Keep name, email, actual avatar/fallback initial, Hide/Show values and Open Account. S3 may identify Somata in the header; it must not replace a user's avatar. |
| Current `GlowPanel`: `account.plan.title`, “Your current focus” | `goals-dark.png` / `goals-light.png` | Decorative top layer only. Energy/protein/carbs/fat remain native, opaque metric tiles. Preserve the resolved title, detail, masking, saved-goal editor and conditional attribution. |
| `Card` headed “FitAdapt review” | `fitadapt-dark.png` / `fitadapt-light.png` | Quiet top decoration under the heading and existing F3 mark. Keep notes, errors, required-input guidance, request/retry behavior, busy/UID guards and syncing message. |
| “Measured progress” heading and steps/latest-weight area | `progress-dark.png` / `progress-light.png` | Decoration restricted to the heading/container top; opaque native metric tiles. The separate Weight trace plot and its empty/hidden states have an **opaque surface**, so decorative waves cannot be mistaken for measurements. |
| Conditional “Pending review” card | **No additional background in this proposal** | Preserve a distinct neutral/accented card between current targets and the review action. Only real `review.pending.targets` supplies the comparison. Keep explicit Accept/Decline and busy/disabled states. Do not merge it with current goals. |
| Records & reflection; Your settings; Collection & connections | **None** | Existing lower destinations retain neutral surfaces and all their actions. No decoration is needed on every card. |

The preview groups heading and identity to demonstrate the ambient layer; this does not authorize a live screen structure change. It also shows an explanatory no-proposal note for this review only, not proposed release copy or an extra runtime state.

## Native rendering and scale

- Reuse the original files by reference. No crop, recolor, sharpening, compression, raster editing or vector tracing was performed.
- Use an absolutely positioned, clipped image layer with `cover`, no touch interception and no accessibility exposure. Foreground content stays native and determines card height independently.
- Review layer height is capped at **200 points**, or half the available width on narrower phones. At 430 points, the approximately 398×199 image region matches the 2:1 source. At 320 points it is approximately 288×144. The layer does not stretch as large text makes the card taller.
- A 2400×1200 original supports up to 800×400 points at 3× without upscaling. This is more than sufficient for the proposed phone windows. Keep later tablet use bounded rather than scaling these indefinitely.
- Add a vertical native scrim: Charcoal `#0B0E12` at about 16% at the top, fading to opaque Charcoal below in dark mode; Bone `#F4F3EE` at 20% fading to opaque Bone in light mode. This joins the image to the native card fill and avoids a hard bottom seam.
- Primary/secondary text contrast over every source pixel with the weakest proposed scrim passes 4.5:1; measured minimum is **7.00:1** (secondary text on goals-light). Primary text minima range **13.39–15.46:1**, secondary **7.00–9.45:1**. The preview uses opaque native metric/chart/action surfaces as well. These calculations do not certify native rasterization or the full app's accessibility.
- No background animation, blur, generated chart or image-based control. Large text wraps; value tiles stack. Image tone must not control or overwrite theme mode/palette persistence.
- Each original decodes to 11,520,000 RGBA bytes (about 11 MiB); four same-mode backgrounds could occupy about 44 MiB before native downsampling/caching. Compressed sizes are modest, but that does not prove runtime memory cost. Verify native decode size, scroll performance and memory during the later integration; do not mount both theme sets unnecessarily. No asset optimization or dependency installation was needed for this review.

## Approved identity only

The previews reuse `components/brand/Brand.tsx` without changing it:

- S3: `assets/branding/somata/symbol-color.png`, 42-point header box.
- F3: `assets/branding/fitadapt/symbol-color.png`, 36-point review heading box.

Both hashes match `assets/branding/reconciled-1b/MASTER_IDENTITY.md`. Existing components preserve aspect ratio with `contain`; neither mark is cropped, stretched, redrawn, recolored or substituted with a font/icon.

For eventual accepted-plan attribution, retain the existing `PoweredByFitAdapt` component and its existing active-plan guard. Its exact files are `assets/branding/reconciled-1b/fitadapt/powered-by-f3-compact-dark.png` and `powered-by-f3-compact-light.png`. The preview omits this attribution because no accepted/live result is loaded. The FitAdapt heading symbol identifies the existing review feature; it does not imply a live recommendation.

## Features and data that must remain intact at integration

Nothing below is changed in this checkpoint:

- Plan presentation comes from `usePreviewAccount` → `dashboardPreviewPlan` and the shared nutrition target helpers. Only a matching accepted recommendation/projection gets “Active plan.” Saved targets remain “Your goals”; unavailable/sync states keep their existing meanings. Pending proposals never supply active numbers.
- Existing `useFitAdaptReviewState` handles evaluation, refresh, stale/service/insufficient-data notes, accepted-target sync, Accept and Decline. Do not add calls, timers, acceptances or writes for visual effects.
- Steps come from the signed-in profile's dated steps map; latest weight/trace come from account-scoped dated weights. Keep kg/lb display conversion, Hide/Show values, missing values, no-history message and `measuredTrendPath` logic. Never use the decorative waves as that path.
- Identity/Open Account → `/account`; goal editor → `/profile/goal-setup`.
- Conditional review guidance → `/fitadapt-setup`, `/(modals)/body-metrics`, `/(tabs)/nutrition`.
- Weight trace action → `/profile/fitadapt-insights`.
- Records & reflection: Insights → `/profile/insights-progress`; Steps history → `/profile/steps-history`; Calendar → `/(modals)/full-calendar`; Body measurements → `/(modals)/body-metrics`; Long-term progress → `/(modals)/long-term-progress`; Advanced metrics → `/profile/advanced-metrics`; Weekly check-in → `/(modals)/weekly-checkin`.
- Your settings: Account → `/account`; Settings → `/(modals)/settings`; Theme picker → `/(modals)/theme-editor`; Diet choices → `/(modals)/diet-preferences`; Training days & goals → `/profile/goal-setup`.
- Collection & connections: Progress photos → `/(modals)/progress-photos`; Badges → `/(modals)/badges`; Friends → `/friends`; Apple Health & connections → `/profile/integrations`.

This mapping concerns this Profile screen only; it does not automatically change shared FitAdapt review components or subpages elsewhere.

## Validation and created files

From `fitness-mobile/`:

```sh
node tools/review-profile-assets.cjs
pnpm typecheck
```

The asset audit passed: eight decodes, dimensions/opacity/color-metadata inspection, SHA-256 records, approved S3/F3 hash verification, pixel-based overlay contrast checks, and four native-component browser previews with no charts or account data. The manifest refuses silent source changes on rerun. Browser tooling emits the existing `pointerEvents` deprecation warning. No dependency was added.

TypeScript passed. `git diff --check -- fitness-mobile` passed. The preservation audit checked **710 existing files with zero changes**, including all original assets, screens, existing working changes and debug logs. Five browser PNG previews were generated. No commit, push, merge or deployment occurred.

Created files:

- `PROFILE_ASSET_REVIEW.md`
- `tools/review-profile-assets.cjs`
- `review/profile-assets/ProfileAssetReview.tsx` — unreferenced by any app route.
- `review/profile-assets/asset-audit.json`
- `review/profile-assets/index.html`
- `review/profile-assets/contact-sheet.html` and `contact-sheet.png`
- `review/profile-assets/profile-dark.html` and `.png`
- `review/profile-assets/profile-light.html` and `.png`
- `review/profile-assets/profile-dark-large-text.html` and `.png`
- `review/profile-assets/profile-light-large-text.html` and `.png`

The review uses browser adapters and simulated 1.6× text scaling, not a native simulator/device. Physical-device OLED banding, color rendering, image memory, text scaling, touch/VoiceOver and chart separation still need verification after approved integration. There is no app integration to export or backend change to exercise here; no native build or live-account tests are claimed.

## Approval checklist

- [ ] Approve the ambient/header, goals/current-focus and FitAdapt/review dark/light pair mappings.
- [ ] Approve progress artwork only around the heading/native metrics, with the measured chart on an opaque surface.
- [ ] Approve the subtle scrim intensity and bounded image windows shown in the dark/light previews.
- [ ] Approve the proposed S3 header placement alongside preserved identity content and the existing F3 review placement.

Recommendation: accept these as subtle decorative surfaces, keeping the pending proposal distinct and lower settings/records neutral. They supply atmosphere rather than section identity or data. The next checkpoint can integrate approved layers into Profile while preserving the audited behavior. **Stop here for approval; no screens have been integrated.**
