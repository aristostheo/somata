# Workouts image treatment — Checkpoint 5A

Review package only. The live Workouts tab, routes, templates, data services, five-tab navigation and approved branding are unchanged. No assets were retouched, recompressed, resized on disk, or replaced. No dependencies were added.

## Open the review

- [Interactive dark/light review gallery](review/branding-5a/index.html)
- [All nine originals](review/branding-5a/contact-sheet.png)
- [Dark candidate treatment](review/branding-5a/dark-candidates.png)
- [Light candidate treatment](review/branding-5a/light-candidates.png)
- [Dark with neutral fallbacks](review/branding-5a/dark-fallbacks.png)
- [Light with neutral fallbacks](review/branding-5a/light-fallbacks.png)
- [320-point, 1.6× text-scale review](review/branding-5a/dark-large-text.png)

From the repository root on this Mac:

```sh
open fitness-mobile/review/branding-5a/index.html
```

These are browser-rendered React Native presentation previews, not iPhone screenshots or a new app route. All labels, counts and disabled review controls are separate React Native components. The static movement counts come from the actual built-in catalog; no user data is involved. The gallery intentionally shows held candidates alongside safer alternatives so the mismatches can be reviewed.

## Asset audit and proposed mapping

Paths below are relative to `assets/branding/workouts/`. All nine files decode successfully as opaque, 8-bit RGB PNGs. None contains an embedded ICC profile, sRGB declaration, gamma or chromaticity metadata. Their display is therefore an sRGB assumption, not verified colorimetric accuracy. All originals were visually inspected, including their edges. No obvious baked-in labels or watermarks were observed; licensing/provenance is not established by this technical review.

| Original | Resolution; size | Intended component | Quality finding / disposition |
| --- | --- | --- | --- |
| `hero/hero-dark.png` | 960×720; 403.4 KiB | Existing Workouts hero in dark mode | Orange/charcoal strength scene; soft equipment and skin detail. Head and lower hand are cropped; narrow dark edge at left. Conditional candidate at bounded size. |
| `hero/hero-light.png` | 960×720; 467.3 KiB | Same hero in light mode | Warm cream lighting, soft detail and bright highlights. Similar pose to dark, but not assumed to be an exact recolor. Lower hand is cropped. Conditional candidate with Bone overlay. |
| `hero/gym-equipment.png` | 900×760; 369.7 KiB | Reserve only | Very soft dumbbell racks, clipped edge objects and orange lighting. No additional existing component requires this image. Keep unused unless separately approved. |
| `templates/push.png` | 640×420; 157.3 KiB | `auto-push` — Push (Strength), 5 movements | Generic dumbbell-room crop, visibly soft. Reasonable decorative strength association; it does not demonstrate a push exercise. Conditional. |
| `templates/pull.png` | 640×420; 183.5 KiB | `auto-pull` — Pull (Strength), 5 movements | Dark back/shoulder crop, clipped head, soft detail. Generic strength association, not a demonstrated pulling movement. Conditional. |
| `templates/legs.png` | 640×420; 207.1 KiB | `auto-legs` — Legs (Strength), 5 movements | **Hold:** shows upper body/arm and weight, not legs. Warm daylight also differs from the dark template family. Recommend neutral fallback pending suitable artwork. |
| `templates/upper.png` | 640×420; 179.7 KiB | `auto-upper` — Upper (Balanced), 5 movements | Tight dark shoulder/back/arm crop. Broad subject fits, but shares the hero/pull scene and softness. Conditional. |
| `templates/cardio.png` | 640×420; 199.0 KiB | `auto-zone2` — Zone 2 Cardio, 1 movement | **Hold:** upper-body strength portrait, no clear cardio subject. Do not infer suitability from the filename. Recommend neutral fallback. |
| `templates/mobility.png` | 640×420; 177.2 KiB | `auto-mobility` — Mobility (10–15 min), 3 movements | **Hold:** dumbbell racks, no visible mobility/stretching subject. Recommend neutral fallback. |

Repeated equipment and athlete compositions make several templates visually difficult to distinguish. Native names must remain prominent; images must never be the only means of identification. These images are decorative, not exercise-technique instruction. Warm scene lighting is compatible with the brand direction, but image pixels are not exact Orange/Coral brand swatches. There are no separate light-mode template originals; the proposal uses the same photos with mode-specific overlays and text surfaces.

## Bounded treatment proposal

- Preserve the existing hero content and actions: “Make room to move,” Start new, Open session and Plan a session. The first two retain their session routes; Plan a session retains the existing configuration flow when integration is approved. Preview controls are deliberately inactive and explicitly labeled as review-only.
- Hero artwork: top/right decorative layer, maximum **288×216 logical points**, `cover`, clipped within the rounded card. Its 4:3 ratio matches the originals. The card and native text can grow independently. This is not full-width artwork stretched behind a taller card.
- At 3×, that layer needs 864×648 pixels, within the 960×720 originals. A full-width 398-point hero would need 1194 pixels across: **these sources should not be promoted to sharp full-width 3× backgrounds**. Their inherent softness remains even within the resolution budget. Larger-density devices require a density-aware size cap or better source files.
- Template photo windows: at most **200×132 points**, centered `cover`, clipped inside rounded cards. At 3× the approximately 603×396 cover scale fits the 640×420 sources. Narrower two-column windows crop a little horizontally (about 5% at 191×132); no stretching. Keep important subjects within the center, acknowledging the originals already contain cuts.
- Hero overlays: Charcoal `#0B0E12` at 78% in dark mode; Bone `#F4F3EE` at 86% in light mode. The orange eyebrow has a solid canvas backing. Buttons have opaque surfaces.
- Native template labels have Charcoal 94% / Bone 96% backing. The photo itself has a restrained mode-specific gradient. Text/values/actions are never baked into artwork. Large-text previews move labels below photos and use a single column; images stay bounded.
- Decoration is excluded from accessibility and cannot intercept touches. The later integration must preserve live action labels, focus, touch targets and scaling. No change to navigation or template/session behavior is proposed here.
- Proposed mapping requires both `source === "auto"` and an explicit built-in ID allowlist. User/saved templates receive **no image**, even if their names or copied IDs resemble a built-in. Unknown IDs also receive no image. The filename `cardio.png` maps to `auto-zone2`, not an invented `auto-cardio` ID.

## Validation and reproduction

From `fitness-mobile/`:

```sh
node tools/review-workout-assets.cjs
pnpm typecheck
```

The review script passed: nine decoded originals and SHA-256 records; six real catalog mappings; exclusion of user templates and unknown/prototype IDs; five browser treatment pages. It checks primary/secondary text contrast ≥4.5:1 over worst-case black and white photo pixels under both overlays, plus eyebrow/backing contrast. These checks do not certify every native rendering detail. Rerunning asserts that original bytes and metadata still match the audit manifest.

TypeScript passed. React Native Web emits its existing `props.pointerEvents` deprecation warning during preview rendering; it does not prevent rendering. Browser PNGs were inspected in dark/light and large-text modes. The baseline hash comparison checked 651 existing files with zero changes. Repository-wide `git diff --check` reports a pre-existing trailing blank line in `fitness-web/firestore-debug.log:136`; that log was not modified. No live screen is changed, so no app bundle export or backend test is claimed for this asset-only checkpoint.

Physical iPhone review remains necessary for actual image sharpness at 3×, OLED appearance, color rendering and native Dynamic Type/VoiceOver behavior. The previews approximate these treatments; they do not prove device behavior or performance.

## New files only

- This report: `WORKOUTS_IMAGE_ASSET_REVIEW.md`
- Review renderer/audit: `tools/review-workout-assets.cjs`
- Review-only composition: `review/branding-5a/WorkoutImageReview.tsx`
- Original-file metadata/checksums: `review/branding-5a/asset-audit.json`
- Gallery: `review/branding-5a/index.html`
- Contact sheet: `review/branding-5a/contact-sheet.html` and `.png`
- Treatments in that folder, each as `.html` and `.png`: `dark-candidates`, `light-candidates`, `dark-fallbacks`, `light-fallbacks`, `dark-large-text`.

No app route imports the review composition. Existing originals, processed brand assets, application files, unrelated working changes and existing debug logs are preserved byte-for-byte against the checkpoint baseline. Nothing was committed, pushed, merged or deployed.

## Approval checklist

- [ ] Approve the bounded dark/light hero pair and its softness, or supply higher-resolution originals for a larger hero treatment.
- [ ] Approve `push.png`, `pull.png` and `upper.png` as generic decorative imagery despite repeated scenes and softness.
- [ ] Keep neutral artwork fallbacks for Legs, Zone 2 Cardio and Mobility until suitable images are provided, or explicitly approve the mismatched candidates.
- [ ] Approve the dark/light overlay and native-label treatment shown in the previews.

Recommendation: use the fallback previews as the starting point, leave `gym-equipment.png` unused, and resolve image suitability before the full Workouts redesign. The next checkpoint can wire approved mappings into the existing hero and built-in cards while retaining session, logging, saved-template and history behavior. This checkpoint stops at review.
