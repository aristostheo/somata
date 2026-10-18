# Somata offline launch-readiness follow-up — 17 October 2026

**Status: not ready for TestFlight distribution. Cloud work is paused by the operator.** No project creation, billing association, budget creation, deployment, secret configuration, paid provider call, EAS cloud build, commit, push or merge was performed. No production/staging account data was accessed or changed. Current branch: `profile-redesign`. Branding, app identity and unrelated working changes are preserved. No user log was edited or reset; the running Functions watcher appended to the existing debug log during local builds.

This report supersedes older readiness statements only where explicitly updated below. Read alongside `STAGING_BACKEND_ROLLOUT.md`, `STAGING_PREFLIGHT.md`, `IN_APP_RELEASE_BLOCKERS.md`, `ACCOUNT_DELETION.md`, `LOCAL_ACCOUNT_ISOLATION.md`, and `MEAL_BUILDER_HANDOFF.md`. Previous production observations are historical, not evidence that production matches this checkout.

## Completed offline

- Coordinated **Toronto (`northamerica-northeast2`) staging Functions selection** across the eight trusted callable/HTTPS handlers, three Firestore triggers, scheduled worker and mobile Functions client. Production/default/demo behavior remains `us-central1`.
- Added a strict server staging project pin: rejects production `fitness-tracker-25254`, unrelated `eleven11-aristos`, demo projects, inconsistent Firebase/Admin project contexts and incorrect staging regions. Mobile also rejects the unrelated project. There is no production fallback for a staging build.
- Firebase CLI source discovery happens before project `.env` loading. The region remains a Firebase **parameter expression** through discovery, then resolves from the guarded staging parameter file. Tests cover both discovery and runtime; no deployment was needed to inspect this behavior.
- Dedicated staging config selects **Node 22**, with CI using Node 22 and the full Functions unit suite. The normal Firebase config and existing Functions package engine are unchanged. Google lists Node 20 decommissioning on **October 30, 2026**; staging must not launch on it. [Runtime schedule](https://docs.cloud.google.com/functions/docs/runtime-support).
- Staging/TestFlight permits **email/password only**. Apple and Google actions are gated in authentication UI, service calls and deletion reauthentication, even when the device supports Apple or stale OAuth IDs exist. Normal non-staging availability stays unchanged. Hiding a provider does not revoke existing external grants.
- Explicit iOS minimum **16.4**, matching the installed Expo modules, through `expo-build-properties`. No branding change. The old generated native project's 15.1 setting was incompatible; a fresh temporary prebuild verified the corrected target. Original ignored native folders were preserved; do not reuse them as a fresh release artifact.
- Added the exact-version `react-native-health@1.19.0` pnpm patch for the reproduced RN 0.86 `setBridge:` compile failure. It removes two legacy invoker overrides; inherited event delivery and payloads remain. Root lockfile changes are limited to patch metadata/references; no dependency version was upgraded. See `patches/README.md` and [upstream issue #443](https://github.com/agencyenterprise/react-native-health/issues/443). Device event delivery is not yet verified.
- Existing guards still reject missing policy/support URLs, missing/mixed staging client configuration, native TestFlight updates pointing to production, emulator/staging combinations and enabled checkout. No URL placeholders were added to app/release configuration.
- Isolated emulator fixture preparers now include the shared region module. This prevents missing-module failures when using the existing synthetic AI/friend/deletion fixtures.

Future clean staging Functions parameter file must contain exactly these **non-secret** names, with reviewed values:

```text
FITADAPT_SERVICE_URL
SOMATA_STAGING_PROJECT_ID
SOMATA_FUNCTIONS_REGION
```

The last value must be `northamerica-northeast2`; the project pin must match the actual isolated Firebase/Run project. Do not create this file with invented values or upload laptop `.secret.local` files. Secrets remain `OPENAI_API_KEY` and `FITADAPT_BRIDGE_TOKEN` in server-side Secret Manager only, after future approval. No secret values belong in chat, Expo/EAS public inputs or source.

## Checks and evidence

Commands run from `fitness-app/` unless noted. Node 25.2.1 is the Mac's actual default; even `/usr/local/opt/node@22` incorrectly points to it. An official **Node 22.23.3** archive was downloaded into `/private/tmp/somata-node22`, verified against its published SHA256 file, and used without changing system Node.

| Check | Exact command / result |
|---|---|
| Functions TypeScript | `PATH=/private/tmp/somata-node22/runtime/bin:$PATH npm run build --prefix fitness-web/functions` — passed. |
| Functions unit/security/adapter tests | `env -u FIRESTORE_EMULATOR_HOST /private/tmp/somata-node22/runtime/bin/node --test fitness-web/functions/test/*.test.js` — **23 passed, 0 failed**. Synthetic mocks include auth/ownership, deletion holds, AI failures, FitAdapt mapping/queue and region discovery. No live provider request. |
| Functions lint | `npm run lint --prefix fitness-web/functions` — **0 errors, 88 warnings**; existing warnings not suppressed. |
| Offline staging guards | `/private/tmp/somata-node22/runtime/bin/node --test fitness-web/test/staging-preflight.test.cjs` — **5 passed**, including Toronto selection, Node 22 config, project separation, required URLs, disabled checkout and file contamination. |
| Mobile typecheck | `PATH=/private/tmp/somata-node22/runtime/bin:$PATH npm run typecheck --prefix fitness-mobile` — passed. |
| Mobile tests | `PATH=/private/tmp/somata-node22/runtime/bin:$PATH npm test --prefix fitness-mobile` — **112 passed, 0 failed**, including account isolation/handoff, target precedence, release guards and email-only staging. |
| iOS/Android JavaScript/Hermes export | `node /private/tmp/somata-offline-build.cjs` runs `npx expo export --platform all --max-workers 2 --output-dir /private/tmp/somata-offline-export` in mobile, with process-only synthetic staging client/release inputs — passed both platforms. This is not a native build or working staging app. |
| Credential/provider scan | `SOMATA_AI_BUNDLE_DIRS=/private/tmp/somata-offline-export SOMATA_HERMESC_PATH=/Users/aristos/Documents/fitness-app/node_modules/.pnpm/hermes-compiler@250829098.0.17/node_modules/hermes-compiler/hermesc/osx-bin/hermesc node --test fitness-web/functions/test/ai-client-safety.test.js` — **2 passed**; decoded Hermes plus source scan, no provider credentials/direct provider URLs found. |
| Frozen lockfile | `npm_config_offline=true npm_config_ignore_scripts=true pnpm install --lockfile-only --frozen-lockfile` — passed; validates dependency/patch lock consistency without replacing installed dependencies. Existing workspace engine/override warnings remain. |
| Actual missing-input build guard | `npx expo config --type public`, invoked with `EAS_BUILD_PROFILE=testflight`, staging mode and absent real release inputs — correctly failed with the required-input error. Output values were not printed. |
| Native iOS | See native build evidence below; **not passed**. |
| Whitespace | `git diff --check -- . ':!**/*.log'` — passed; old logs deliberately excluded and not edited. |
| Existing web build/tests and emulator suites | Not rerun unnecessarily: web source, rules, persistence, FitAdapt algorithms and deletion behavior were unchanged. Prior evidence remains in the linked reports; it is not a new result from this checkpoint. Existing local Auth/Firestore/Functions ports were occupied by the user's emulators and were left running with their data untouched. |
| Cloud / real provider / signed iPhone | **Untested in this checkpoint.** No cloud resource or provider request was made. No camera/permission/signing success is inferred from mocks or exports. |

Native and export fixtures use synthetic configuration only in temporary files/processes. They are not operator-approved URLs or allocated projects and must never be uploaded/distributed. The release's missing real inputs continue to fail closed.

## Native build evidence

A temporary copy at `/private/tmp/somata-offline-native` isolates the generated app project and Pods from the working tree; dependency build scripts also use ignored caches beneath the existing `node_modules`. The initial copied Xcode workspace failed because its generated Pods referenced old relative paths. Regenerating dependencies then exposed the stale iOS 15.1 deployment target. A fresh `expo prebuild --platform ios --clean --no-install` in that temporary copy succeeded with iOS 16.4 after the config fix.

Fresh CocoaPods preparation succeeded: **130 dependencies / 130 Pods**, from the current installed dependency graph. The original stale Pods/lock and app files were not overwritten. The next native compile reproduced `RCTAppleHealthKit.m:844:29: no visible @interface for RCTCallableJSModules declares the selector setBridge:`. After the exact-version patch, that compilation passed, and the final build failed **exit 65** in `ExpoModulesJSI` with `'weak' must be a mutable variable` and `SWIFT_RETURNS_RETAINED` constructor diagnostics.

**Verified remaining cause:** installed Xcode **26.0.1 / Swift 6.2** is below Expo SDK 57's **Xcode 26.4+** minimum. [Expo SDK requirements](https://docs.expo.dev/versions/latest/). Do not patch away Expo's required language features or downgrade dependencies to hide this. This Mac runs **macOS 15.8.1**; Apple lists **macOS Tahoe 26.2+** for Xcode 26.4.1. Check hardware/OS compatibility before an upgrade, or use another compatible Mac. Install/select a compatible toolchain, then rerun the local native check. [Xcode system requirements](https://developer.apple.com/xcode/system-requirements). That toolchain change was not performed automatically.

Exact unsigned simulator command used, inside the temporary `ios/` folder and with process-only synthetic inputs supplied by `/private/tmp/somata-offline-build.cjs`:

```sh
xcodebuild -workspace Somata.xcworkspace -scheme Somata -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /private/tmp/somata-offline-native-derived \
  -disableAutomaticPackageResolution CODE_SIGNING_ALLOWED=NO build
```

After installing/selecting compatible Xcode, the **next safe local command** is `node /private/tmp/somata-offline-build.cjs native`; check `xcodebuild -version` and `xcrun swiftc --version` first. This temporary harness always supplies synthetic configuration and does not sign or deploy. Do not launch a temporary build with the normal production configuration. Logs: `/private/tmp/somata-offline-native.log`; Pods log: `/private/tmp/somata-offline-pods.log`. No native binary, signed archive or device pass is claimed. No signing or native archive upload was attempted. Xcode 26.0.1 and its iOS 26 SDK are installed; Apple's current upload requirement is Xcode 26/iOS 26 or later. This version check alone does not establish compilation, signing or store acceptance. [Apple requirements](https://developer.apple.com/news/upcoming-requirements/).

## Prioritized remaining gates

| Priority / dependency | Why it blocks the next release step | Operator action when ready |
|---|---|---|
| **P0 — live staging backend / billing authorization** | A TestFlight app outside the Mac's LAN needs deployed Auth, data, secure AI, FitAdapt, friend summaries and deletion services. Local tests cannot verify IAM, secrets, Scheduler, Eventarc or actual rules enforcement. | Keep paused now. Later approve a final resource/cost review and billing account for **`somata-staging-aristos-2026`**, never either existing project. Its name was available during the prior read-only check, not reserved. Confirm again before creation. CAD$20 alerts are not a cap. |
| **P0 — published privacy/support HTTPS URLs** | Release configuration intentionally fails before a usable TestFlight build without real destinations. Testers need an accurate privacy description and working support channel. | Publish operator-approved pages (free hosting is possible; a paid custom domain is not required). Provide `SOMATA_PRIVACY_POLICY_URL` and `SOMATA_SUPPORT_URL`. No invented wording/URLs will be supplied. |
| **P0 — deletion/retention decisions before personal-data beta** | Unknown objects, unattributable caches or safety reports can deliberately stop deletion. Backups, provider grants and other-device records are outside the current cleanup. Synthetic success cannot justify promises about personal data. | Review the decisions below; approve concrete treatment before implementation/configuration. Until then, use only synthetic accounts/data and retain the safety holds. |
| **P0 — local Xcode upgrade; then Apple signing/distribution** | Current native build fails on Xcode 26.0.1; Expo SDK 57 needs 26.4+. JavaScript exports are not an installable signed app. TestFlight then requires a successful native archive and signing/App Store Connect access. | Install/select Xcode 26.4+ on a compatible Mac (free tooling; current macOS 15.8.1 also needs a compatible upgrade), rerun the native command below, then verify Apple team, bundle registration, provisioning/entitlements and membership/access. Only after backend and required URL gates pass, run the documented local EAS build. No paid remote build or upload is authorized now. |
| **P1 — physical iPhone evidence** | Camera/photo permissions, native health integrations, lifecycle/account switching and actual signed-update behavior cannot be proven by unit tests. | Complete the checklist below first locally where possible, then in the signed staging build. Record device/iOS/build version and pass/fail for each item. |
| **P1 — controlled live staging/provider verification** | Mock AI and local FitAdapt tests do not prove deployed credentials, cold starts, network latency, quotas or scheduled execution. | After billing approval and deployment, securely configure the two staging-only secrets and run synthetic cloud tests. AI requests can consume provider credits; do not run them during the no-charge phase. Confirm revocation of the previously client-exposed key. |

Required future public metadata: staging project number and registered Firebase web-app config; actual database/bucket/location; Cloud Run runtime identity, actual URL and immutable image digest; secret version identifiers only. These are not all available before project creation. Enter future secret values directly in **Google Cloud Console → verified staging project → Secret Manager**, never chat. No need to provide any of them while cloud work is paused.

The later cloud gate must cover Auth ownership, nutrition/AI/workout generation, FitAdapt pending/accept/decline and real timer delivery, friend consent/redaction, deletion/retry, cross-account denial, server-owned write denial and target projection. Follow the hardened-rules-first deployment order and rollback runbook; never roll back to the historical broad sharing rules.

## Retention decisions to review separately

These are conservative options for review, **not adopted policies**:

1. **Unknown Storage and legacy AI caches:** keep deletion holds; inventory upload sources/provenance before any purge. For a new synthetic stage, import neither and exclude legacy `describe`. Decide whether to retire the old cache writers and authorize an independently reviewed purge later.
2. **Safety reports:** decide permitted access, retention period, exceptions and participant-specific anonymization/deletion. Keep holds rather than treating a report as solely one participant's property. A supported report-submission backend is separate work.
3. **Backups/logs/provider retention:** inventory actual enabled systems; choose expiry/access and restoration safeguards. Live-data cleanup is not a backup purge. No retention period is assumed.
4. **Shared catalog/routine contributions:** decide whether attribution removal plus retaining recipient copies is acceptable and how personal free text must be handled. Do not delete other owners' records automatically.
5. **External provider authorization:** email/password-only for the synthetic beta; leave Apple/Google disabled until configuration, nonce/token flow and required revocation/deletion behavior are verified. This does not resolve existing linked users in other environments.
6. **Deletion tombstones:** keep the minimal write fence until an approved expiry/removal design accounts for late jobs, tokens and restored backups. Do not introduce a guessed TTL.
7. **Ambiguous legacy device records:** keep quarantined; do not assign them to the next signed-in account. Decide whether to provide explicit verified-owner recovery or explicit user-confirmed removal. Remote deletion cannot erase every offline installation or OS backup.

Checkout is **not a blocker to a beta with purchases disabled**. It stays off and cannot call the nonexistent checkout backend. Apple/Google sign-in is likewise outside the email-only beta. Neither is advertised as verified. Health/native features and existing unsupported discovery/report actions retain the limitations in the original reports; this checkpoint does not claim all features work.

## Phone testing now: local, synthetic and non-billable

Keep the existing local FitAdapt service running. If your existing Firebase emulators are already the demo project and LAN-accessible, reuse them; do not start a second copy or reset their records. Otherwise follow [the local runbook](fitness-web/functions/FITADAPT_EXPO_GO_LOCAL.md) to start a disposable demo session. Do not import real account data.

Create two **fresh synthetic** accounts, running the fixture twice and retaining the printed local credentials:

```sh
cd /Users/aristos/Documents/fitness-app/fitness-web/functions
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
  node test/seed-fitadapt-mobile.js --project demo-somata-fitadapt
```

Then open Metro in another terminal. No staging flag or paid cloud service is needed for this local path:

```sh
cd /Users/aristos/Documents/fitness-app/fitness-mobile
env -u EAS_BUILD_PROFILE -u EXPO_PUBLIC_SOMATA_BACKEND_ENV \
  -u EXPO_PUBLIC_SOMATA_STAGING_PROJECT_ID -u SOMATA_STAGING_FIREBASE_CONFIG \
  SOMATA_RELEASE_BUILD=false SOMATA_CHECKOUT_ENABLED=false \
  EXPO_PUBLIC_USE_FIREBASE_EMULATORS=true \
  EXPO_PUBLIC_FIREBASE_EMULATOR_PROJECT_ID=demo-somata-fitadapt \
  EXPO_PUBLIC_FIREBASE_EMULATOR_HOST="$(ipconfig getifaddr en0)" \
  npx expo start --host lan --clear
```

Phone/Mac must share trusted Wi-Fi; `en0` must be the active Wi-Fi interface. Allow local-network access if macOS/iOS prompts. Scan the QR code with compatible Expo Go; fully restart the app when changing project/host. If local `.env` files set a staging mode, clear that local override before using this demo path. The emulator opt-in still requires a development build and exact demo project. Do not use a personal account.

**Avoid generating AI results in the ordinary emulator session while avoiding charges:** its real server secret can still call the paid provider even though Firebase is local. Use manual meals for now; existing synthetic AI fixture tests cover mocked responses. Camera permission/cancel can be tested without submitting an analysis. Local FitAdapt recommendations do not call OpenAI.

Checklist (all device items remain **untested** until confirmed):

- [ ] Email/password sign-in, invalid password, sign-out, cold restart and retry without duplicate accounts.
- [ ] Manually create/edit/log a meal once; daily totals, remaining targets and history agree across tabs. Camera/library allow/deny/cancel returns safely without paid analysis.
- [ ] Profile review: pending does not alter current targets; Accept on account A updates them, Decline on fresh B does not. Exercise stale/error states using the documented synthetic harness, not personal data.
- [ ] A → sign out → B → A: photos, body history, check-ins, drafts and builder payloads never cross accounts. Restart during handoff; duplicate consumption must not log twice.
- [ ] Friend request/accept, explicit sharing on/off and revoked sharing show only allowed summaries/private states; no raw private records.
- [ ] Delete synthetic A with recent password verification and explicit confirmation; retry interrupted cleanup; B remains usable and its records intact. Do not reset the whole emulator just to demonstrate scoped cleanup.
- [ ] All five tabs and linked screens: back navigation, keyboard, large text, VoiceOver labels, loading/empty/error states and offline recovery. Check actual hardware-native features later in a signed development/staging binary; Expo Go cannot verify every native module.
- [ ] Later signed staging build: real meal description/photo → review/edit → Builder → explicit Log; native camera/photo/health permission behavior; URL links; checkout absent; Apple/Google absent; native update channel rejects production config; cold start stays on staging.

Use the fixture's documented cleanup or end only your disposable emulator session without import/export when done. Do not erase another running session's data. Stop Metro and fully close Expo Go to end local testing. Do not restart with emulator mode disabled for this synthetic test: that normal path targets the existing real app project, not an offline staging substitute.

After all inputs/backend/device prerequisites and separate authorization, the existing signed build command is:

```sh
cd /Users/aristos/Documents/fitness-app/fitness-mobile
eas build --platform ios --profile testflight --local --output /private/tmp/somata-staging.ipa
```

It must use actual staging public configuration and published URLs, a clean reviewed artifact excluding generated native folders/local secrets, and verified Apple credentials. It may access EAS/Apple metadata even though compilation is local. **Not run or authorized for distribution here.** Never upload the synthetic compile fixtures. No `eas submit`, Git push or cloud deployment is included in this handoff.

## Files changed in this follow-up

- Mobile: `app.config.ts` (iOS minimum only), `config/backend.cjs`, `config/backend.d.cts`, `lib/authSocial.ts`, `components/somata/AuthUI.tsx`, `app/account/delete.tsx`, `tests/stagingBackend.test.ts`.
- Functions: new `src/deployment.ts` and `test/deployment.test.js`; region options in `src/ai/function.ts`, `src/account/function.ts`, `src/friends/function.ts`, `src/fitadapt/function.ts`, `src/fitadapt/automatic.ts`; dependency copy in the three existing `prepare-*-emulators.cjs` fixture scripts. No handler business logic changed.
- Native dependency patch: `patches/react-native-health@1.19.0.patch`, `patches/README.md`, root `pnpm-workspace.yaml` registration and `pnpm-lock.yaml` patch hash/references. Existing workspace comments and unrelated lock entries preserved.
- Staging tooling: `firebase.staging.json`, `staging.example.json`, `scripts/validate-staging.cjs`, `scripts/staging-deploy-guard.cjs`, `test/staging-preflight.test.cjs`, `.github/workflows/fitadapt-bridge.yml`.
- Reports: this file, `STAGING_BACKEND_ROLLOUT.md`, `STAGING_PREFLIGHT.md`, and a latest-status pointer in `TESTFLIGHT_READINESS.md`.

No Firestore/Storage rule, saved-data schema, production Firebase configuration, FitAdapt engine, acceptance behavior, payment implementation, branding asset or normal tab layout was changed.
