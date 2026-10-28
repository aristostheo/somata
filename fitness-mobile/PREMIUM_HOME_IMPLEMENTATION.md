# Somata branding — Checkpoint 3C

Home presentation and shared tab-bar styling, on `profile-redesign`. No commit, push, merge or deployment. Checkpoint 3C's attached premium reference supersedes the earlier 3B visual restrictions on gradients, decorative artwork and navigation styling; the functional inventory in `HOME_BRAND_SPEC.md` remains authoritative.

## Implementation and reference comparison

| Reference element | Implementation | Deliberate difference / remaining verification |
| --- | --- | --- |
| Header | Orange uppercase identity, 32-point dynamic greeting, muted supporting line, circular gradient-backed bell | Existing factual subtitle retained. Long names wrap. No fake status bar or battery indicator. |
| Hero | Layered charcoal/warm gradient, warm perimeter, flame icon, logged calories and target before a slimmer 24-segment meter; secondary percent only when known | Exact approved S3 is fully contained, not enlarged beyond the card as in the concept. Extra unavailable/pending/accepted state content can increase height. |
| S ribbon | `assets/branding/somata/symbol-color.png`, unchanged; contained image in a bounded decorative layer, maximum width 260, height 175, opacity 22% dark / 10% light | No redrawing, stretching, new raster or source edits. The concept's large cropped ribbon is intentionally not reproduced: bounded artwork keeps controls/text usable and avoids the earlier authentication defect. The decorative layer ignores touches and screen readers. |
| Steps / latest weight | Compact side-by-side cards, warm lighting, orange icon wells, neutral values and supporting details | Existing cards have no navigation handler, so no misleading chevrons were added. Existing “Dated measurement” caption retained; no date/history invented. Both cards expand or stack with text size. |
| Nutrition pulse | Heading/Open row, explanatory copy, three tinted macro tiles with distinct labels/icons | Protein orange, carbohydrate blue, fat violet are local data-series roles matching this reference, not a global palette change. Existing Ionicons stand in for the concept's custom muscle/grain drawings. Actual gram values are unchanged. |
| Useful next step | Strong orange border, warm gradient, restaurant icon, existing computed recommendation and a prominent gradient CTA | At widths below 420 or larger text, the CTA moves below the content. The icon is the existing library symbol, not newly drawn branded artwork. |
| Quick actions | Three-column grid on wider phones; orange-gradient Log food; polished secondary controls with orange icons | Two columns below 420 points; one below 350 or with large text. 48-point minimum controls take more vertical space than the conceptual screenshot's small buttons. Labels wrap instead of shrinking. Original action order retained. |
| Explore | Compact two-column tiles with orange icons and chevrons; one column for large text/narrow phones | Row-major order remains Calendar, Insights & history, Connections, Badges; the concept arranges those differently. All original destinations retained. |
| Navigation | Orange selected state, neutral inactive state, rounded graphite surface, border and shadow, consistent 24-point existing icons | Still the existing persistent Expo Router five-tab navigator. No raster icon swaps. Unread dot uses semantic coral; the existing subscription, count condition and accessibility label are unchanged. |
| Light appearance | Bone canvas, white/warm surfaces, darker accessible accent inks, subtle shadows | A corresponding light treatment, not an inverted screenshot. ThemeProvider still owns System/Light/Dark and saved palettes. |

The implementation is not an exact pixel match. It preserves the composition and warm lighting while accommodating actual data, native control sizes, unknown values and larger text. Existing Ionicons were retained as the complete consistent set: supplied raster navigation icons do not cover all requested actions and would mix stroke families at these small sizes. No artwork was approximated.

## Functional preservation

The Home block containing targets, logged energy, ratio, kg/lb formatting, recommendation priority, step-sheet state, validation and save operations is byte-identical to the pre-3C file. The existing account hook, target helper and 24-segment progress calculation are reused. The progress component gains only an optional compact presentation; other consumers retain its previous dimensions by default.

- Pending proposals never feed displayed active targets. Review still routes to Profile; accepted attribution retains its existing guard.
- Unknown energy remains unavailable. Actual zero can still display 0%. The existing upstream missing-to-zero nutrition limitation is not altered; no completeness claims were added.
- All eight quick actions retain their handlers and dates: Log food, Scan food, Add steps, Set steps, Start workout, Log activity, Quick workout, Water log.
- All Explore routes, Alerts, Nutrition Open and conditional recommendation destinations remain unchanged.
- Step-sheet keyboard avoidance, save validation, account scope, duplicate-save guard, errors and Cancel remain unchanged.
- No changes to backend services, Firestore, authentication, notifications logic, FitAdapt calculations/acceptance, logging, workout logic, stored settings or dependencies.
- Other tabs' screen content is unchanged. The shared navigation's presentation intentionally changes for all five tabs.

## Exact file inventory

Modified in 3C (separate from pre-existing working changes):

- `app/(tabs)/index.tsx` — Home composition and new presentation components; existing handlers retained.
- `app/(tabs)/_layout.tsx` — tab-bar appearance only; removed unused legacy theme read.
- `components/designPreview/UI.tsx` — optional compact meter sizing; default unchanged.
- `tests/homeBrandPresentation.test.ts` — gradient contrast and responsive data/action regression coverage.
- `tools/home-preview-runtime.cjs` — offline gradient rendering, real installed Ionicons font, static tab-options adapter.

Created:

- `components/home/PremiumHomeUI.tsx` — Home-only presentational cards, metric tiles, macro tiles, actions, grids, bell and recommendation layout.
- `components/home/premiumTheme.ts` — pure mode-aware Home surface/lighting recipes derived from existing semantic roles.
- `tools/render-premium-home-preview.cjs` — new preview generator; prior 3B generated files are preserved.
- `PREMIUM_HOME_IMPLEMENTATION.md` — this report.
- `review/branding-3c/index.html` — gallery.
- `review/branding-3c/home-{dark,light}-{goals,pending,empty,reference,large-text}.html` — ten exact combinations.
- `review/branding-3c/home-dark-reference.png`
- `review/branding-3c/home-light-reference.png`
- `review/branding-3c/home-dark-goals.png`
- `review/branding-3c/home-dark-large-text.png`

## Validation

From `fitness-mobile/`:

```sh
pnpm typecheck
pnpm test
node tools/render-premium-home-preview.cjs
CI=1 EXPO_NO_DOTENV=1 pnpm exec expo export --platform all --max-workers 2 --output-dir /private/tmp/somata-3c-export
```

- TypeScript: passed. Mobile suite: **124 tests passed, zero failed**, including two added regression tests.
- iOS and Android Expo exports: passed (8.1 MB iOS / 8.3 MB Android bundles). Exports validate bundles and assets, not native builds or device rendering. Existing stale `baseline-browser-mapping` and terminal color-environment warnings remain; no dependencies were changed to suppress them.
- Focused coverage includes pending versus accepted targets, missing versus zero, existing routes and action order, saved palette nonmutation, legacy component isolation, text contrast over gradient endpoints, and data/action availability at widths 320/390/447 with font scales 1/1.8.
- SHA-256 audit: **581 existing files checked; only the five listed existing files changed**. The audit includes existing app/component/provider/service/asset/tool/test files and debug logs. No original or approved image was modified.
- Approved S3 was visually decoded/inspected before use; browser previews render that exact PNG, and Expo export resolves the asset. No new bitmap logo was generated.
- `git diff --check -- fitness-mobile`: passed.
- Final dark/light 447-point reference compositions and 320-point large-text browser screenshots visually reviewed; 390-point populated screenshot also generated. The hero was shortened and Nutrition header tightened after the first comparison. Gradient/overdraw and full native navigation behavior still require hardware review. React Native Web reports compatibility deprecations for native shadow/pointer-event props; these do not prevent rendering.

Preview commands:

```sh
node tools/render-premium-home-preview.cjs
open review/branding-3c/index.html
```

The previews render the actual Home JSX with **offline synthetic fixtures**, the installed Ionicons font, CSS equivalents of gradients and actual tab options through a static adapter. No account is authenticated, no Firebase initialization occurs, and write services throw if called. Buttons are inert in the generated pages. Safe insets are zero, text scaling is simulated, the step modal is omitted, and the tab bar is displayed after the page for composition review rather than testing a live navigator. These are browser screenshots, not native iPhone screenshots.

No iOS simulator was booted (`xcrun simctl list devices booted` returned no devices). A native visual/interaction pass was not performed. No new simulator, native build or deployment is claimed.

## iPhone review still required

```sh
cd /Users/aristos/Documents/fitness-app/fitness-mobile
pnpm exec expo start --go --clear
```

Use the existing intended backend/emulator configuration; this checkpoint changes neither. Open Home in compatible Expo Go and verify:

1. Dark/light/System modes, long greeting, ordinary and large Accessibility text, safe areas and persistent tab-bar clearance.
2. S3 stays inside the hero, never covers controls or blocks touches; gradients, card shadows and image decode look correct on native iOS/Android.
3. Missing/populated data, saved goals, real pending proposal and valid accepted-plan attribution; compare values with the current target helper consumers.
4. All quick actions, four Explore destinations, Nutrition Open, Alerts and conditional recommendation CTA.
5. Add/Set steps with keyboard open, scrolling, Cancel, valid save and validation/error handling. Use synthetic records for write testing.
6. Five tabs retain labels/order/routes; unread Alerts dot and accessible count still work. Verify VoiceOver and text scaling on the actual navigator.
7. Smooth scroll on an older phone; no full-screen blur or new animations were introduced, but performance has not been measured on hardware.

Stop after this checkpoint for visual approval. No next-tab redesign has started.
