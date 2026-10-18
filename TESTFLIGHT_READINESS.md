# Somata TestFlight readiness — 14 October 2026

> Latest offline follow-up: [OFFLINE_LAUNCH_READINESS.md](OFFLINE_LAUNCH_READINESS.md). Billing and staging resource creation are not approved. Later security/deletion/isolation fixes supersede the original code findings below, but no cloud or signed-device readiness is implied.

Current execution preflight: [STAGING_PREFLIGHT.md](STAGING_PREFLIGHT.md). Operator chose a new dedicated staging project (neither existing project), email/password and synthetic records only, pending region/cost review. Read-only project/billing inventory completed; **no cloud changes**. Local legacy lint errors were repaired (0 errors, 88 warnings); cloud/device/native-build gates remain unverified. Historical results below are not current deployed-state claims.

Staging preparation follow-up, 17 October 2026: [Staging backend rollout](STAGING_BACKEND_ROLLOUT.md) inventories local versus historically observed deployed state and adds offline deployment guards plus mandatory staging targeting for the TestFlight profile/channel. Current cloud state was not queried. No staging project, secrets, resources or remote configuration were created. Operator project/client/Run/URL inputs, retention decisions, actual cloud smoke tests and signed-device checks remain outstanding. The TestFlight profile now uses the EAS **preview** environment and **testflight-staging** channel; the older production-environment directions below are historical and must not be used for this staging package.

Release-safeguards follow-up, 17 October 2026: [In-app release blockers](IN_APP_RELEASE_BLOCKERS.md) audits remaining deletion retention/ownership gaps, adds safe hold-reason messages, disables missing-backend checkout by default, and requires operator-provided privacy-policy/support URLs for store configuration. No retention policy, production contents, provider revocation, deployment or TestFlight readiness is inferred. Historical findings below remain identified as such.

**Status: not ready for an unrestricted external TestFlight release.** The local app builds and its automated flows pass, but the production backend, privacy controls, and purchase path have concrete gaps. This audit does not certify every screen or hardware feature as tested. No commit, push, deployment, production write, or production configuration change was performed.

Branch: `profile-redesign`. The extensive changes already in the working tree were preserved. File hashes taken at audit start distinguish the changes below from earlier checkpoints. Existing debug logs were not edited. Temporary validation output is under `/private/tmp/somata-readiness/`; it is not a permanent CI artifact.

Follow-up, 14 October 2026: [Firestore sharing security gate](FIRESTORE_SHARING_SECURITY.md) hardens the local candidate rules and verifies owner/private-data boundaries. It has **not been deployed**. Raw friend fitness queries are now denied locally; safe redacted summaries still require a separate backend/query change. The original findings below remain the production readiness baseline, not a claim that production exposure was fixed.

Account-deletion follow-up, 14 October 2026: [Account deletion checkpoint](ACCOUNT_DELETION.md) adds a local authenticated, reauthentication-gated, resumable Admin cleanup operation and mobile confirmation flow. Synthetic emulator verification passed. Deployment, legacy-cache/report/Storage retention decisions, unscoped device cleanup, provider revocation and native verification remain prerequisites. The historical missing-deletion finding below is no longer the local implementation state; it remains a production release blocker until those dependencies and rollout are resolved. Legal/support inputs are still missing. No release readiness approval is implied.

Device-local isolation follow-up, 14 October 2026: [Device-local account isolation](LOCAL_ACCOUNT_ISOLATION.md) scopes new fitness history/caches by UID, resets account views on authentication changes, isolates reminders and includes owned local records/photo files in deletion cleanup. Proven UID stores remain intact; ambiguous older records are preserved without being shown to another account. Legacy recovery/retention, native device verification and the other release blockers remain. This follow-up does not certify TestFlight readiness.

## Release blockers and remaining decisions

| Finding | Evidence and consequence | Required next step |
|---|---|---|
| New trusted backend is not deployed | Read-only `firebase functions:list --project fitness-tracker-25254 --json` returned only `describe` in `us-central1`. `generateSomataAI`, `evaluateFitAdapt`, `getFitAdaptPlan`, `acceptFitAdaptPlan`, `declineFitAdaptPlan`, the three FitAdapt triggers and queue worker exist locally, but are absent remotely. | Separately authorize the reviewed backend rollout. Configure server-only AI/bridge secrets, protected FitAdapt hosting, and run synthetic deployed smoke tests. A phone cannot use your Mac's emulators through TestFlight. |
| Deployed rules differ from local rules | Read-only Rules API inspection found no `activeFitAdaptTargets` or `fitadaptPlans` protection in the deployed snapshot. Local rules do protect these, and all 11 rules tests pass. | Review and deploy the correct rules as part of the backend rollout, with protections in place before real accepted plans are created. No rules were deployed here. |
| Existing sharing rules are too broad for private fitness data | Both inspected rule sets allow any signed-in user to read `users/{uid}/nutritionEntries` and `workouts`. Local recursive owner subcollection access also bypasses some specialized write validators. Friend-edge and notification creation permissions deserve a dedicated abuse review. | Define and implement explicit sharing/visibility enforcement and cross-user negative tests before inviting external testers with personal health data. UI visibility settings alone do not enforce privacy. No access policy was silently changed in this audit. |
| Account deletion and legal/support destinations are missing | No complete account/data deletion operation was found. `account/legal` redirects to Account; a privacy policy URL and support destination were not found. | Supply real policy/support details and implement authenticated account deletion with a complete data inventory, reauthentication and provider revocation where necessary. Do not substitute client document deletion for account deletion. Apple requires account-creation apps to offer deletion in-app: [Apple guidance](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/). |
| Purchase path is incomplete | `app/paywall.tsx` calls `createCheckoutSession`, which is neither exported locally nor deployed. It also requires a Stripe price value. No native IAP implementation was found. | Decide the beta entitlement policy and implement/test a valid purchase or beta-access path. Review the chosen storefront/payment model before release. Do not tell testers that checkout or restore works today. |
| Some sensitive history is device-local and unscoped | Body metrics history, progress photos, weekly check-ins, hydration and Coach Spark history include legacy device keys without UID ownership. A second account on the same device may see previous local records. | Add account isolation with an explicit, safe policy for legacy records; do not infer ownership or migrate silently. Account-scoped FitAdapt inputs remain separate. |
| Social sign-in needs real configuration and native verification | Google IDs were placeholders; unconfigured Google buttons are now hidden. Apple uses the native availability check and official button, but successful Firebase/Apple native sign-in was not exercised. | Configure actual per-platform OAuth IDs/redirects and Firebase providers; verify new/existing accounts and cancellation in a signed native build. Audit Apple's token/nonce flow as part of that verification. Email/password remains available. |
| Hardware and store-signed build are unverified | Expo Go is not a substitute for the app's signed native binary. | Complete the device checklist below and produce a signed TestFlight build only after the blockers are resolved. Apple team/App Store Connect setup and signing permissions were not changed. |

Earlier `APPLICATION_HEALTH_CHECK.md` describes the state before the secure AI follow-up. Its client-key/`parseMeal` findings are historical: current clients use `generateSomataAI`, and source plus both mobile bundles and web bundle pass the provider-credential/direct-call scanner. The prior exposed credential should still be revoked if not already rotated. Your earlier successful meal-description test after funding is user-reported live verification; this audit made **zero paid provider requests**.

## Changes made in this audit

| Files | Change |
|---|---|
| `fitness-mobile/components/somata/AuthUI.tsx`; `app/(auth)/login.tsx`, `register.tsx`, `reset.tsx`, `_layout.tsx` | Replaced the remaining old glass/gradient and MacroTrack-branded auth layouts with a Somata composition: wordmark, prominent heading, teal/lime divider, focused fields, accessible actions, scroll/keyboard handling and theme-aware surfaces. Registration keeps the existing retry-safe account runner and FitAdapt setup path. Social login also routes newly created accounts into setup. Duplicate taps are guarded and entered values survive failure. |
| `fitness-mobile/lib/socialAvailability.ts`, `lib/authSocial.ts`, `tests/socialAvailability.test.ts`, `.env.example` | Removed literal Google placeholder client IDs; require a valid ID for the actual platform and show Google only when configured. Added placeholder/platform regression tests and commented public configuration names. No OAuth secret or real ID was added. |
| `fitness-mobile/lib/authErrorMessage.ts`, `tests/authErrorMessage.test.ts`; auth screens | Added safe, actionable authentication errors. Unknown email and wrong password get the same sign-in message; password reset remains privacy-neutral. Raw provider errors are not shown. |
| `fitness-mobile/app/+not-found.tsx` | Replaced the generic old error page with themed Somata recovery and working Home/back actions. |
| `fitness-mobile/eas.json` | Added an explicit store-distribution `testflight` profile extending production, with emulator mode off and a separate TestFlight update channel. Existing production profile behavior remains. |
| `fitness-mobile/app.config.ts` | Reject store profiles with emulator mode enabled; disable the image picker's unnecessary microphone permission. No bundle ID, project ID or production endpoint changed. |
| `.easignore` at monorepo root | Exclude secrets, environment files, signing credentials, debug logs, caches, generated native folders and Functions source from the mobile upload package. Root location matters: EAS archives this monorepo, not only `fitness-mobile`. A mobile-only ignore file initially failed to exclude web debug logs and was replaced. |
| `pnpm-workspace.yaml` | Allow only Skia's reviewed native-library postinstall. pnpm 10 had skipped it, causing CocoaPods to fail with missing Skia binaries. Restored packaged frameworks with a scoped rebuild; no dependency version or lockfile change. |
| `fitness-web/functions/test/fitadapt-schedule-local.js` | Corrected an overly strict duplicate-delivery assertion. An eligible delayed delivery may drain as `unchanged`; it must not create a new proposal. The test now explicitly enqueues/drains a duplicate and verifies the whole plan, history count, legacy goals and absence of active targets remain unchanged. Production queue logic is untouched. |
| `TESTFLIGHT_READINESS.md` | This report, run commands, feature/style inventory and remaining device checklist. |

No target calculation, acceptance behavior, backend contract, permissions, user data, or recommendation logic was changed by this audit. Existing earlier checkpoint changes remain in the working tree and must be included together when preparing a complete release commit.

## Feature and subpage audit

Inspected all **88 route/layout TSX files** under `fitness-mobile/app` (82 excluding layouts), their linked presentation components and service boundaries. The five new tabs are already the default. Existing aliases redirect/re-export canonical screens. The table records source inspection; it is not a claim that each screen was opened on a device.

| Area and routes | Working actions/data inspected | Style and verification |
|---|---|---|
| Entry/auth: `index`, `(auth)/login`, `register`, `reset`, `fitadapt-setup`, `+not-found` | Auth gate, remember-session preference, email sign-in/reset, registration retry, profile save, optional FitAdapt review/continue | Auth and not-found redesigned in this audit. Setup already uses new UI. Simulator sign-in screen checked in light/dark; registration/reset/device keyboard and completed native OAuth remain manual checks. |
| Home and shared quick flows: `(tabs)/index`; `(modals)/quick-workout`, `quick-strength`, `quick-cardio`, `quick-mobility`, `quick-hydration`, `weekly-checkin`, `full-calendar`; `insights` | Meal/workout shortcuts, activity CRUD, steps editor/sync, check-in, date/day selection and historical navigation | Existing new Somata dashboard/Home-flow presentation retained. Target/date/recorded-data tests and client persistence tests pass. Device-local hydration/check-in limitation remains. |
| Workouts: `(tabs)/workouts`; `workouts/session`, `session-detail`, `recap`, `history`, `templates`; `(modals)/browse`, `create-template`, `save-workout-as-templates`, `coach-spark` | Search/filter/favorites, template create/edit/save/delete, start/finish, sets, history, repeat, AI workout review | New task-specific Somata presentations inspected. Core persistence/retry tests pass. Coach Spark requires deployed AI; hardware/session timing and interrupted screen flows need phone testing. |
| Nutrition: `(tabs)/nutrition`; `(modals)/add-meal`, `quick-add`, `meal-builder`, `what-should-i-eat`, `ai-meal-suggestions`; `nutrition/scan-meal`, `scan-meal-v2` and modal scan aliases | Search/manual entry, barcode/photo/description, review/edit/confirm, quantities, meal bundles, presets, edit/delete/date/history, remaining targets | New nutrition/task/scan presentations inspected. Manual CRUD, confirmed delivery, retry idempotency and target tests pass. Photo capture/barcode permissions not verified. AI suggestions/paywall blocked in production as above. |
| Alerts/social: `(tabs)/notifications`; `friends`, `friends/[id]`, `[id]/profile`, `[id]/progress`, `[id]/workouts`, `friends/preview` | Filters/read/dismiss, friend request/accept/decline, shared summaries, detail navigation | New Somata/social presentations inspected. Synthetic friend-edge/notification CRUD passes. Push delivery and full discovery/sharing UI unverified; existing broad sharing rules are a release concern. |
| Profile/plan: `(tabs)/profile`; `profile/fitadapt-insights`, `goal-setup`, `goal-advanced`, `advanced-metrics`, `insights-progress`, `steps-history`, `sync-history`, `integrations`, `friend-visibility` | Accepted plan/saved fallback, real pending review/Accept/Decline, factual history, measured trends, goals, sync/permissions/visibility | Shared target helper and recorded-data tests pass. Real local FitAdapt proposal/acceptance passes. No pending target promotion or client-owned plan writes added. Native health sync and privacy enforcement need remaining work. |
| Profile detail modals: `(modals)/body-metrics`, `long-term-progress`, `progress-photos`, `diet-preferences`, `badges`, `weekly-checkin` | Measurements/history/edit/delete, units, photos, diet save, badge collection, check-in | New TaskUI/profile/Home-flow styles present. Unscoped legacy local records remain a limitation; no generated trends or migration added. |
| Account/settings: `account/index`, `edit-profile`, `privacy`, `subscription`, `badges`, `legal`; `(modals)/settings`, `theme-editor`; `paywall` | Identity edit/sign-out, available recovery, privacy preferences, notifications, units, integration links, draft theme Save/Cancel | New Somata styles present. Account aliases are not independent implemented legal/deletion/purchase features. Theme behavior tests pass; full system appearance/large text requires phone. |
| Compatibility paths: `dashboard-preview`, `design-preview/*`, `old/*`, `profile(old)/*`, `(modals)/add-meal-old`, `account-center`, `control-center`, `bodyTwin/*`, `nutrition/scan-meal(old)` | Canonical redirects or re-exports rather than a second active obsolete flow | Route tests pass. No legacy page was revived, and no fallback navigation was changed by this audit. |

The new style is wired through canonical screens and shared sheets. This does **not** certify every bottom sheet's spacing, large-text wrapping or contrast from a source scan. No personal account was used to exercise destructive actions. Do not confuse the historical preview inventory in `DESIGN_PREVIEW_PARITY.md` with the current default navigation; `FULL_VISUAL_MIGRATION.md` records that later migration.

## Validation results

Commands ran from the indicated directory. Outputs are retained in the temporary audit directory.

| Directory / command | Result |
|---|---|
| `fitness-mobile`: `npm run typecheck` | PASS after final changes |
| `fitness-mobile`: `npm test` | **63 passed, 0 failed** |
| `fitness-web`: `CI=true npm test -- --watchAll=false --runInBand` | **8 suites / 26 tests passed** |
| `fitness-web`: `npm run build` | PASS |
| `fitness-web/functions`: `npm run build` | PASS |
| Functions: `node --test test/ai.test.js test/fitadapt.test.js test/fitadapt-automatic.test.js` | **15 passed** offline; mocked provider/network failure cases |
| Functions: `npm run lint` | **FAIL: 17 errors / 91 warnings**, pre-existing in untouched `describe.ts`; no suppression. Current `firebase.json` predeploy runs install/build, not lint, so this is not its direct gate. It still needs cleanup for a clean lint policy. |
| `fitness-mobile`: `npx expo install --check` | Dependencies reported current using offline SDK metadata fallback; not a full online Expo Doctor certification |
| `fitness-mobile`: `CI=1 EXPO_PUBLIC_USE_FIREBASE_EMULATORS=false npx expo export --platform all --max-workers 2 --output-dir /private/tmp/somata-readiness/mobile-export-final` | PASS: iOS and Android Hermes bundles |
| Functions: `SOMATA_HERMESC_PATH=/Users/aristos/Documents/fitness-app/node_modules/.pnpm/hermes-compiler@250829098.0.17/node_modules/hermes-compiler/hermesc/osx-bin/hermesc SOMATA_AI_BUNDLE_DIRS=/private/tmp/somata-readiness/mobile-export-final:/Users/aristos/Documents/fitness-app/fitness-web/build node --test test/ai-client-safety.test.js` | **2 passed**: source and final built bundle provider-credential/direct-call safety scan |
| Root: `pnpm --filter fitness-mobile rebuild @shopify/react-native-skia` | PASS; copies packaged Apple/Android native libraries. Initial root-only `pnpm rebuild` did not rebuild the workspace dependency. |
| Isolated native copy: `CI=1 EXPO_NO_DOTENV=1 EXPO_PUBLIC_USE_FIREBASE_EMULATORS=false /Users/aristos/Documents/fitness-app/fitness-mobile/node_modules/.bin/expo prebuild --platform ios --no-install`, then `pod install` in its `ios/` | Prebuild PASS. Initial Pods failed missing Skia binaries; after fix **130 Pods installed successfully**. No generated native folders added to the repo. |
| Isolated `ios/`: `EXPO_NO_DOTENV=1 EXPO_PUBLIC_USE_FIREBASE_EMULATORS=false SKIP_BUNDLING=1 xcodebuild -workspace Somata.xcworkspace -scheme Somata -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath /private/tmp/somata-readiness/DerivedData CODE_SIGNING_ALLOWED=NO build` | **INCOMPLETE**, stopped after several minutes without progress in Xcode 26.0.1 `actool`/`AssetCatalogSimulatorAgent` while compiling Expo dev-menu/dev-launcher assets. No compiler success or signed archive is claimed. Recheck native build tooling before TestFlight; this is separate from the passing Pods and Hermes exports. |
| `fitness-mobile`: `CI=1 EAS_NO_VCS=1 EXPO_PUBLIC_USE_FIREBASE_EMULATORS=false eas build:inspect --platform ios --profile testflight --stage archive --output /private/tmp/somata-readiness/eas-archive-clean` | PASS local archive inspection, no cloud upload/build. No `.env`, `.secret`, credentials or debug-log files included; Functions directory is empty/excluded. `.env.example` contains placeholders only. |
| Config probe: `EXPO_NO_DOTENV=1 EAS_BUILD_PROFILE=testflight EXPO_PUBLIC_USE_FIREBASE_EMULATORS=true npx expo config --type public --json`, repeated with `false` | Enabled emulator mode rejected; disabled mode accepted |

The Mac currently runs Node 25.2.1. Root declares Node `>=18.18 <23`, web declares 18, and Functions declares 20. Commands passed as recorded, but these engine declarations are inconsistent. Validate release CI with a supported pinned toolchain (the installed React Native requires at least 20.19.4 on Node 20, or 22.13 on Node 22). Do not infer a signed EAS archive passed from a successful JS export. Stale `baseline-browser-mapping`, CocoaPods script-phase notices and existing lint warnings were not suppressed.

### Emulator verification

Used an isolated temporary workspace, **only `demo-somata-fitadapt`**, loopback Auth 9099 / Firestore 8080 / Functions 5001 / Pub/Sub 8085, and local FitAdapt on 8765 in bridge-only mode. Credentials and records were synthetic; no personal profile/history or real OpenAI secret was seeded. The AI emulator fixture injected a mock provider into a staged copy of the real handler; production source has no test bypass.

Common test environment:

```sh
export GCLOUD_PROJECT=demo-somata-fitadapt
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export FUNCTIONS_EMULATOR_HOST=127.0.0.1:5001
export PUBSUB_EMULATOR_HOST=127.0.0.1:8085
```

| Command (after starting the isolated emulators) | Result |
|---|---|
| `fitness-web`: `npm run test:rules` | **11 passed**: owner reads, cross-UID denial, protected targets/plans/history denied, ordinary profile writes and Admin acceptance permitted |
| Functions: `node --test test/fitadapt.test.js test/fitadapt-automatic.test.js` | **11 passed** with emulator queue cases |
| Functions: `node test/fitadapt-e2e.js` | PASS: real local engine and authenticated proposal/accept/decline flow |
| Staged Functions, fresh queue: `NODE_PATH=/Users/aristos/Documents/fitness-app/fitness-web/node_modules node test/fitadapt-schedule-local.js` | PASS after duplicate-assertion correction: client meal → trigger → server queue → production processor → real local engine → pending proposal → explicit acceptance |
| `fitness-mobile`: `node --import tsx tests/coreFlows.emulator.ts` | PASS: synthetic Auth/client meal and workout CRUD, delivery/retry, friend edges, alerts and legacy endpoint input/auth checks |
| Functions: `node --test test/ai.emulator.cjs` | **6 passed**: real callable protocol with mocked provider; auth/ownership, size/media/input validation, success shapes, malformed responses, timeout, 429, concurrent cost limits, no automatic meal/plan saves |

The queue harness invokes the **same production processor with a controlled clock**. It does not claim local cron automatically fired. Debounce/coalescing, duplicate delivery and failure/insufficient-evidence cases are covered by harness/unit tests; success uses the real local FitAdapt engine. See `FITADAPT_AUTOMATIC_LOCAL.md`, `FITADAPT_EXPO_GO_LOCAL.md` and `AI_INTEGRATION.md` in `fitness-web/functions` for the existing reproducible isolated setup. Running the AI fixture is mock verification, not live provider verification.

Cleanup: audit-owned emulator/FitAdapt processes were stopped and their temporary Functions secrets/environment files removed. No synthetic data was exported into production. The audit's Metro process was stopped so the personal-account command below can start cleanly. Existing local environment and secret files were not changed. A final hash comparison found no changes to existing debug logs; only the 18 audit files listed/grouped above differ from the starting snapshot.

## Run with your personal account

Stop any existing Expo terminal with Ctrl+C, fully close Expo Go when switching from emulator mode, then:

```sh
cd /Users/aristos/Documents/fitness-app/fitness-mobile
EXPO_PUBLIC_USE_FIREBASE_EMULATORS=false npx expo start --go --lan --clear
```

Scan the QR code with your iPhone and sign in using your ordinary Somata account. Phone and Mac must share Wi-Fi. Allow the macOS incoming-network and iOS Local Network prompts if shown. If LAN access is blocked, use the existing tunnel script with the flag explicitly off:

```sh
EXPO_PUBLIC_USE_FIREBASE_EMULATORS=false npm run start:tunnel
```

**No Firebase emulator or local FitAdapt process is needed for personal-account browsing.** This mode connects to the real Firebase project; saves/deletes change real account data. New AI/FitAdapt calls will fail until the trusted production backend is deployed. Do not enable demo emulator mode expecting it to use your personal account. `.secret.local` is for local Functions, not a way to configure TestFlight. Expo Go does not fully exercise HealthKit or signed Apple/Google auth, remote push, purchases, or release signing.

## Phone acceptance checklist

Use synthetic emulator accounts for destructive/failure tests; use your personal account only for the changes you intend to keep.

- [ ] Auth: login, sign-out, failed password, reset, register once, cancel/retry setup, restart with keep-signed-in on/off; social new/existing account flows in a signed build.
- [ ] All five tabs and every route group above: open, back, swipe/dismiss sheet, empty/loading/error states; dark/light/system appearance, largest practical system text, VoiceOver labels, keyboard and small-screen overflow.
- [ ] Home: steps edit/sync, activity add/edit/delete, quick workouts/hydration, check-in, Calendar day/range selection and entry navigation, Insights missing-history states.
- [ ] Nutrition: search and manual entry, barcode, description, camera and photo library; deny/regrant permissions, cancel, review/edit, explicitly confirm. Edit quantity, change date, delete, compare Home/Nutrition/Profile target values. Network-off confirmation and retry must create exactly one entry. Meal Builder presets/bundles and Quick Add work.
- [ ] Workouts: search/filter/favorite exercise, create/edit/delete template, start/pause/finish, sets/weights, recap/history/repeat; interrupted save/retry does not duplicate sets. Coach Spark generation needs deployed AI.
- [ ] FitAdapt: incomplete saved data stays accessible; pending review does not change current or remaining targets; Accept updates matching Profile/Home/Nutrition values; Decline leaves them unchanged. Inspect bounded factual history and measured trends, including no-history states.
- [ ] Profile: goal/body/diet edits, measurements/history/delete, progress photo add/delete, badges, integrations, steps/sync history; verify no cross-account leakage before shared-device beta testing.
- [ ] Alerts/friends: request/accept/decline, filters/read/dismiss, profile/progress/workout links; verify visibility against server rules, not only UI.
- [ ] Account/settings: identity edit, recovery, sign-out, units, notification permission/time settings; theme edits stay draft, Cancel discards, Save survives restart. Legal, deletion and purchases remain blockers above.
- [ ] Signed iPhone build: camera/barcode, Apple Health grants/revocation, notifications, Apple/Google sign-in, background/relaunch/offline behavior and crash logs. No hardware capture/permission or remote push pass is claimed by this audit.

## GitHub commands — for you to run after reviewing the diff

These commands are **not executed by this audit**. This checkout contains multiple earlier checkpoints, so review the full working tree; committing only a few auth files would omit required earlier services/components. Stage the intended application areas while excluding logs and local configuration. Never force-add a secret file.

```sh
cd /Users/aristos/Documents/fitness-app
git branch --show-current
# Confirm the output is profile-redesign before continuing.
git status --short
git diff --stat

git add -- .easignore pnpm-workspace.yaml TESTFLIGHT_READINESS.md \
  APPLICATION_HEALTH_CHECK.md .github/workflows/fitadapt-bridge.yml \
  fitness-mobile fitness-web \
  ':!**/*.log' ':!**/.env' ':!**/.env.*' ':!**/.secret*' \
  ':!**/*firebase*.local.json' ':!**/credentials.json' \
  ':!**/*.pem' ':!**/*.p8' ':!**/*.p12' ':!**/*.key' \
  ':!**/*.mobileprovision' ':!**/*.jks' ':!**/*.keystore'
git add -- fitness-mobile/.env.example
git diff --cached --stat
git diff --cached --check
git diff --cached
# Review before committing; do not paste credentials into chat.
git commit -m "Prepare Somata mobile experience and readiness checks"
git push -u origin profile-redesign
```

If files were already staged before this sequence, exclusions do not unstage them; inspect `git diff --cached --name-only` first. Remove any accidentally staged local log/config using `git restore --staged -- <path>` (this preserves its working file). These commands create no merge and do not make the app production-ready. The readiness report deliberately records unresolved blockers.

## TestFlight commands — only after blockers and device checks are resolved

Apple Developer membership, access to the correct App Store Connect app, signing credentials and a functioning production backend are still required. Existing app identity is `com.aristos.fitnessmobile`, version `1.0.0`; do not replace it casually. Prepare the EAS production environment's public build inputs (`FDC_API_KEY` for food lookup and actual Google public client IDs if enabled). The USDA key is currently exposed through app config, so treat it as a client-visible quota credential; OpenAI and FitAdapt secrets must never go there. Root ignore rules intentionally exclude local `.env` files from builds.

```sh
cd /Users/aristos/Documents/fitness-app/fitness-mobile
eas build --platform ios --profile testflight
# Once the exact build succeeds and is reviewed, substitute its build ID:
eas submit --platform ios --profile production --id YOUR_BUILD_ID
```

These upload/build/submission commands were **not run**. EAS Submit sends a build to App Store Connect/TestFlight; external testing then needs the appropriate beta setup/review. It is separate from publishing an App Store release. See [Expo iOS submission](https://docs.expo.dev/submit/ios/). Do not use `--latest` accidentally against an unrelated build, and do not deploy Functions/rules merely by following these mobile commands.
