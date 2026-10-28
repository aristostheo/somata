# Branding Checkpoint 2 — initial integration

Checkpoint 1B compositions were approved in the Checkpoint 2 request. The earlier asset reports remain unchanged historical records; their “awaiting approval” wording has not been rewritten. This integration uses S3/F3 and the reconciled files specified in `assets/branding/reconciled-1b/MASTER_IDENTITY.md`.

## Exact change inventory

Modified:

- `app.config.ts` — launcher, splash, Android adaptive and monochrome references only, plus Charcoal backgrounds for splash/adaptive icons.
- `components/brand/SomataIcon.tsx` — retains the existing loading component name/API and delegates to the approved S3 image instead of the old purple SVG.
- `components/somata/AuthUI.tsx` — replaces the pulse icon and typed SOMATA header with the approved horizontal lockup on login, registration and password reset. Inputs, actions, authentication and layout order remain unchanged.
- `components/homeFlows/FlowUI.tsx` — replaces the typed SOMATA header with the 32px S3 symbol on Steps History, Badges and FitAdapt Insights & History. Back/action controls remain unchanged.
- `app/(tabs)/index.tsx` — replaces existing accepted-plan attribution text with the compact lockup, under the identical condition.
- `app/(tabs)/profile.tsx` — same accepted-plan attribution replacement; adds F3 to the existing FitAdapt review heading. Target resolution, pending comparison, Accept/Decline and all routes are unchanged.
- `components/profile/FitAdaptReview.tsx` — replaces generic identity glyphs with F3 and existing conditional attribution with the compact lockup. This reusable component currently has no route caller; the active Profile review remains its existing inline implementation, not a new instance of this component.

Created:

- `components/brand/Brand.tsx` — `SomataLogo`, `SomataSymbol`, `FitAdaptLogo`, `FitAdaptSymbol`, `PoweredByFitAdapt`.
- `BRANDING_PREVIEW.html` — static, application-sized asset placement review on dark/light surfaces; not application screenshots.
- `BRANDING_INTEGRATION.md` — this report and device checklist.

No artwork, dependency, theme, service, backend, authentication flow, permission, rule, navigation structure or business calculation changed. The existing web debug logs were left alone. No commit, push, merge or deployment.

## Approved sources and component behavior

Paths below are relative to `assets/branding/`:

| Component | Exact asset(s) | Size API |
| --- | --- | --- |
| SomataSymbol | `somata/symbol-color.png` | small 28, medium 48, large 120; numeric width supported |
| FitAdaptSymbol | `fitadapt/symbol-color.png` | small 28, medium 48, large 120; numeric width supported |
| SomataLogo | `reconciled-1b/somata/horizontal-s3-dark.png`, `horizontal-s3-light.png`; stacked uses `stacked-s3-dark.png`, `stacked-s3-light.png` in the same directory | small 280, medium 320, large 400; `layout="stacked"` available |
| FitAdaptLogo | `reconciled-1b/fitadapt/horizontal-f3-dark.png`, `horizontal-f3-light.png` | small 280, medium 320, large 400 |
| PoweredByFitAdapt | `reconciled-1b/fitadapt/powered-by-f3-compact-dark.png`, `powered-by-f3-compact-light.png` | small 240, medium 280, large 320 |

Size means canvas width in logical pixels, capped at the available width. Intrinsic image dimensions determine aspect ratio. Images use `contain`; no tint, crop, redraw, alpha adjustment or font recreation. The master symbols retain their approved gradient on either surface. Lettered lockups follow the existing theme's light/dark mode unless a caller explicitly specifies `background="light"` or `"dark"` for its surface. Accessible image labels identify each brand/attribution. Images do not replace dynamic-text controls or metric labels.

Full primary lockups contain taglines and should not be squeezed into compact header slots; those slots use the symbol. Stacked Somata and full FitAdapt are available as reusable components but are not inserted into new screen locations. Attribution uses the approved no-tagline composition, starting at 240px. The sign-in identity row and attribution rows are taller to preserve lettering readability; surrounding screen hierarchy remains intact. Physical-device readability at small display widths still requires review.

## Expo identity

- Common, iOS and Android launcher: `app/launcher-dark-1024.png`.
- Splash plugin image: `app/splash-symbol.png`; `contain` is preserved; background becomes `#0B0E12`. The installed plugin's default image width remains 100.
- Android adaptive foreground: `app/android-adaptive-foreground.png`, **not** the enlarged 1B candidate; background `#0B0E12`.
- Android themed foreground: `app/android-monochrome-foreground.png`. `monochromeImage` is supported by the installed Expo 57 configuration types.
- Light/tinted iOS candidates and enlarged Android candidates remain untouched and unused.
- Identifiers, schemes, versions, updates/runtime policy, plugins, permissions, release/staging guards and all other resolved configuration are unchanged. Existing ignored native project files were not regenerated.

These settings require a newly generated/built native binary to verify launcher/splash behavior. Metro reload or an OTA update cannot verify native identity. Expo Go's own icon/splash and the development client's launch UI are not proof of production splash rendering.

## Navigation decision

All five current tabs and their existing Ionicons remain unchanged, including unread alerts. Proposed later trial mapping: Home → `navigation/home.png`; Workouts → `navigation/training.png`; Nutrition → `navigation/nutrition.png`; Profile → `navigation/profile.png`. There is **no approved Alerts equivalent**, so no partial substitution was made. Progress, recovery, community and scan remain assets for relevant future surfaces, not additional tabs. Start any later approved trial at 28px within existing accessible touch targets.

## Verification

Run from the repository root unless noted:

| Check | Command / method | Result |
| --- | --- | --- |
| TypeScript | `pnpm --dir fitness-mobile typecheck` | Passed after using RN 0.86's `StyleSheet.absoluteFill` API. |
| Existing tests | `pnpm --dir fitness-mobile test` | 112 passed, 0 failed. Includes accepted/pending target behavior, account isolation and release guards. No new business behavior or snapshot-only tests added. |
| Expo config resolution | In `fitness-mobile`: `EXPO_NO_DOTENV=1 pnpm exec expo config --type public --json` (captured in memory; only branding fields printed) | Passed; all configured images resolve. Avoid pasting full config output because unrelated environment-backed values may appear. |
| Unrelated config preservation | Evaluate HEAD/current config in memory, remove only icon/adaptive/splash identity fields, deep-compare remaining values | Passed. |
| PNG validation | Decode all 14 referenced image files using the already installed PNG codec; check dimensions and alpha | Passed: transparent artwork, opaque launcher. |
| Artwork preservation | SHA-256 comparison against pre-edit snapshot | All 112 pre-existing branding files byte-identical, including every source and approved asset. |
| iOS + Android bundling | `CI=1 EXPO_NO_DOTENV=1 pnpm --dir fitness-mobile exec expo export --platform all --max-workers 2 --output-dir /private/tmp/somata-branding-2-export-final` | Passed: final iOS and Android Hermes bundles and referenced brand assets exported. This is JS/assets validation, not a native build. |
| Whitespace | `git diff --check -- fitness-mobile` | Passed. |
| Lint | Inspected mobile scripts/config | No mobile lint script or ESLint configuration exists. No dependency/config was added to manufacture a lint command. |
| Simulator | `xcrun simctl list devices booted` | Unavailable in this session: CoreSimulator connection refused and runtime service unavailable. No simulator/phone rendering pass claimed. |

Existing environment warnings include Node 25.2.1 versus the root declared Node range, outdated `baseline-browser-mapping`, and color-output environment warnings. They were not suppressed or repaired in this presentation-only checkpoint. Repository-wide whitespace checking also reports the pre-existing web debug log; that file was not changed by this work.

## Visual review and phone steps

```sh
cd /Users/aristos/Documents/fitness-app
open fitness-mobile/BRANDING_PREVIEW.html

cd fitness-mobile
pnpm exec expo start --go --clear
```

Use the existing backend/environment setup; this checkpoint does not enable emulators or change account targeting. Scan the QR code using a compatible Expo Go installation on the same network. A native development client can instead use `pnpm exec expo start --dev-client --clear`. No backend calls are necessary for the static HTML review.

1. Review login, registration and password reset in light/dark mode. Confirm the S3 horizontal logo is legible and fields/buttons remain reachable with keyboard open and larger text. Do not create an account just to inspect registration.
2. Cold-open the app to inspect the transient 120px S3 loading placement; its original loading text/spinner remain.
3. Home → Steps history, Badges, and Insights & History: check the 32px S3 header, back button and existing header actions.
4. Home and Profile with an existing accepted plan: inspect the compact attribution at 240px. With saved goals only, attribution must remain absent. Do not generate or accept a plan solely for a branding check on a personal account; use existing synthetic fixtures when checking review states.
5. Profile → FitAdapt review: inspect the 28px F3; pending comparison, errors and Accept/Decline remain the existing controls. Check narrow screens, large text and VoiceOver. Privacy hiding must still hide numeric values.
6. Confirm the five tab names/order, alert badge, navigation and saved theme choices are unchanged.
7. Later native build: regenerate native icon/splash resources from this config through the project's native build process, then test iOS home-screen icon/cold launch and Android circular/rounded masks, themed monochrome icon, tip clearance and cold-launch splash. Do not rely on a stale existing `ios/` directory or Metro reload. Native/toolchain release blockers remain separate.

## Next checkpoint

Review these placements on a physical phone, approve sizing/readability, then handle native launcher/splash verification. A later navigation-icon trial needs an explicit Alerts decision and approval. Global red/orange theme integration, other decorative placements and screen redesign are outside this checkpoint. No further integration starts without approval.
