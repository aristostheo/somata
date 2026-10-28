# Somata branding — Checkpoint 3B

Home-only visual integration, 2026-10-18, on `profile-redesign`. No commit, push, merge or deployment. Existing unrelated working changes were preserved.

## Changes

The existing Home section order, content and actions remain in place. Home now explicitly opts into Checkpoint 3A's mode-aware semantic tokens. The presentation context carries no persisted settings and does not replace ThemeProvider. Saved palette selections remain stored unchanged; Home uses the approved brand roles, while other screens retain their existing presentation.

| Area | Presentation change | Preserved behavior |
| --- | --- | --- |
| Header | Orange identity label, readable greeting, 48-point bell | Personalization and Alerts destination |
| Today, in motion | Neutral raised surface, orange top edge and energy segments, prominent percentage | Existing calorie target, logged energy, clamping, accepted-plan attribution and pending-review link |
| At a glance | Matching neutral steps/weight cards; wrapping at larger text sizes | Account records, unit conversion, goal caption, missing values and existing dated-measurement caption |
| Nutrition pulse | Inset macro cards; blue protein, yellow/ochre carbohydrate, coral/red fat | Exact values, labels, explanatory text and Nutrition link |
| Useful next step | Warm selected surface and clear secondary CTA | Existing recommendation decision tree, text and destination |
| Quick actions | Orange primary Log food; bordered secondary actions with wrapping and 48-point minimum height | All eight actions in their original order |
| Explore | Neutral surface, clear dividers and readable rows | All four destinations |
| Add/Set steps sheet | Matching surface, visible input focus, scrollable content and bottom safe-area padding | Validation, add/set operations, cancellation, save guard and errors |

The five-tab navigator and its icons were not changed. No new header controls, assets or features were added.

## Exact files for this checkpoint

Modified:
- `app/(tabs)/index.tsx`
- `components/designPreview/UI.tsx`

Created:
- `components/designPreview/Appearance.tsx` — Home-only presentation scope.
- `components/designPreview/presentationColors.ts` — role-based adapter for existing shared color names.
- `tests/homeBrandPresentation.test.ts` — five focused presentation/navigation tests.
- `tools/home-preview-runtime.cjs` — offline React Native Web renderer; account/network writes prohibited.
- `tools/render-home-preview.cjs` — synthetic visual fixture generator.
- `HOME_BRAND_INTEGRATION.md` — this report.
- `review/branding-3b/index.html`
- `review/branding-3b/home-dark-goals.html`
- `review/branding-3b/home-light-goals.html`
- `review/branding-3b/home-dark-pending.html`
- `review/branding-3b/home-light-pending.html`
- `review/branding-3b/home-dark-empty.html`
- `review/branding-3b/home-light-empty.html`
- `review/branding-3b/home-dark-large-text.html`
- `review/branding-3b/home-light-large-text.html`
- `review/branding-3b/home-dark-goals.png`
- `review/branding-3b/home-light-goals.png`
- `review/branding-3b/home-dark-large-text.png`

No dependencies, Expo configuration, theme token definitions, services, backend files or approved artwork were changed in this checkpoint.

## Behavior and data checks

The Home calculation, recommendation, validation and save-handler block was compared with a copy taken before this checkpoint and is byte-identical. Account sources remain `usePreviewAccount`, existing target resolution, account-scoped nutrition/steps/weight records, and the existing FitAdapt plan read.

- Pending proposals leave current targets unchanged. Accepted attribution requires the existing valid matching recommendation/projection guard.
- Missing energy renders a dash and "Progress unavailable"; actual zero can render 0%.
- Macro zero never means complete logging. The existing "Logged amounts are not a full-day estimate" text remains. Upstream missing-to-zero normalization was not altered.
- No synthetic data is used in the application. Synthetic fixtures exist only in offline tests and preview tooling.
- SHA-256 comparison of pre-checkpoint app/component/provider/service/asset files and existing web debug logs found changes only to the two existing files listed above. Branding sources and processed assets remain byte-identical; authentication and other tabs remain untouched.

Actions preserved:

| Action | Destination / operation |
| --- | --- |
| Open alerts | `/(tabs)/notifications` |
| Pending FitAdapt review | `/(tabs)/profile` |
| Nutrition Open | `/(tabs)/nutrition` |
| Log food | `/(modals)/add-meal?date=<today>` |
| Scan food | `/(modals)/scan-meal?date=<today>` |
| Add steps / Set steps | Existing account-scoped step sheet and service calls |
| Start workout | `/workouts/session?freshStart=1` |
| Log activity | `/(tabs)/workouts?activity=1` |
| Quick workout | `/(modals)/quick-workout` |
| Water log | `/(modals)/quick-hydration` |
| Calendar | `/(modals)/full-calendar` |
| Insights & history | `/profile/fitadapt-insights` |
| Connections | `/profile/integrations` |
| Badges | `/(modals)/badges` |

Useful next step retains its existing conditional routes: proposal review, food logging, steps history, or FitAdapt insights.

## Validation

Commands from `fitness-mobile/`:

```sh
pnpm typecheck
pnpm test
node tools/render-home-preview.cjs
CI=1 EXPO_NO_DOTENV=1 pnpm exec expo export --platform all --max-workers 2 --output-dir /private/tmp/somata-3b-export
```

- TypeScript: passed.
- Mobile tests: 122 passed, zero failed. Five new tests cover Home-only opt-in isolation, palette nonmutation, missing versus zero, pending/accepted target presentation and action order/routes. Existing semantic contrast tests also pass.
- iOS and Android bundle exports: passed. These are JavaScript/assets exports, not native builds or device verification. Existing terminal color-environment and stale `baseline-browser-mapping` warnings are non-blocking; no dependencies were changed.
- Eight phone-width HTML previews generated: dark/light saved goals, pending proposal, empty data and 320-point simulated 1.8x text. Standard previews use 390-point width.
- Dark/light and narrow large-text browser screenshots visually inspected. Large text moves cards and secondary section controls onto separate rows instead of squeezing labels.
- `git diff --check -- fitness-mobile`: passed.

## Review and physical-device checks

Open `review/branding-3b/index.html` for all preview states. These render the actual Home presentation with synthetic fixtures through React Native Web. They are not native screenshots: icons are stand-ins, tab bar and modal are omitted, safe insets are zero, and font scaling is simulated. Static preview actions are inert.

To run the existing app using its current backend configuration:

```sh
cd /Users/aristos/Documents/fitness-app/fitness-mobile
pnpm exec expo start --go --clear
```

Open the QR code in compatible Expo Go, sign in using the intended existing environment, and open Home. This checkpoint does not require a new backend or emulator configuration. Keep any emulator opt-in aligned with the test account you intend to use.

On iPhone, still verify:
1. Light and dark appearance, long greeting, small screen, and larger Accessibility text sizes.
2. Safe-area placement and scrolling above the unchanged tab bar.
3. All eight quick actions, four Explore links, Alerts, Nutrition Open and conditional next-step destination.
4. Add/Set steps with the numeric keyboard open: focus, scrolling, Cancel, valid save, validation and failure state. Use a synthetic account when testing writes.
5. VoiceOver labels, reading order, visible focus and control usability.
6. Empty data, saved goals, pending review and accepted plan using existing valid account states. Do not fabricate production proposals for visual testing.

Physical-device checks were not performed in this checkpoint. No claim of full native or release readiness is made.

## Next checkpoint proposal

Review Home on-device first. After approval, apply these semantic presentation roles to the existing Workouts tab in a separate scoped checkpoint, preserving its composition and behavior. Keep navigation icon replacement as a separate visual trial; it was not started here.
