# Somata application health check — 2026-10-12

Follow-up: the client AI boundary defects below have since been repaired locally. See [AI_INTEGRATION.md](fitness-web/functions/AI_INTEGRATION.md) for the current endpoint, credential removal, validation results and remaining live/device checks. The original audit findings below are retained as historical evidence.

Branch: `profile-redesign`. This audit preserved the existing visual migration and unrelated working changes. No commit, push, merge, deployment, production data write, migration, or real notification was performed. Existing debug logs were compared with their starting hashes and left untouched.

## Status and evidence

“Passed” describes the stated test boundary, not an unobserved phone/browser journey.

| Critical flow | Status | Evidence and remaining boundary |
| --- | --- | --- |
| Mobile startup and five tabs | **Not verified** on device | Typecheck, 60 tests, and iOS/Android exports pass. Route/target/theme tests pass. No simulator was booted; no Expo Go interaction was observed. |
| Web application | **Not verified** in browser | 8 suites / 27 tests and production build pass. Browser navigation and real sign-in were not exercised. |
| Authentication/account data | **Passed** locally | Real client SDK registration, sign-out/sign-in, unauthenticated denial, UID isolation and ordinary profile writes against demo Auth/Firestore. Auth recovery email delivery and persistence after a phone restart need device verification. |
| Manual nutrition logging/editing | **Failed and fixed** | Actual repaired persistence module tested against Firestore: bundled meal creation, edit, total, delete, repeated delivery without duplicates or overwriting edits, cross-UID write denial. Unit tests cover failed save retention and concurrent delivery. |
| Meal photo capture and AI analysis | **Not verified** end to end | Mocked image-response boundary, validation and confirmation-to-nutrition mapping pass. Camera/gallery permissions, image manipulation and successful live analysis were not verified. Live generation encountered HTTP 429. |
| Describe-a-meal AI | **Not verified** live | Mobile and web mocked validation/error/retry tests pass. Local `describe` method/auth/missing-input checks pass. Live model generation returned 429; web's configured local `parseMeal` handler is not exported by current Functions. |
| Workout generation/session | **Failed and fixed** at persistence boundary | Malformed model results rejected before history/session creation. Actual set persistence tests cover partial-finish retry, edits, history read and deletion without duplicates. Successful live generation and on-device start/finish/recap remain unverified. |
| Alerts/notifications | **Not verified** end to end | Synthetic friend request/accept and in-app alert read/dismiss pass using actual Firestore rules. Device permission prompts, scheduling, push delivery and UI filters were not exercised; no real notifications sent. |
| FitAdapt review/accept/decline/targets | **Passed** locally | Actual local FitAdapt + Firebase callables: pending review, explicit acceptance, decline, stale proposal, insufficiency, history, concurrent evaluation, idempotence and target propagation. Queue path passed from client meal write to server queue to production handler to local engine proposal and explicit acceptance. |
| Firestore rules and Functions | **Passed** relevant runtime/build tests | Rules: 11 tests. Bridge/queue: 11 with emulator, 10 without it. Functions build passes. **Existing lint remains failing: 17 errors and 91 warnings**, with all errors in untouched `describe.ts`. |
| External integrations | **Not verified** comprehensively | USDA search returned HTTP 200 with a result. OpenAI model-access check returned 200, but generation returned 429. Real camera/barcode, HealthKit/steps permissions, Stripe and production FitAdapt/Functions were not tested. |

## Repairs

1. **Confirmed meals were deleted before Firestore acknowledgement.** `previewNutritionHandoff.ts` previously removed local payloads first, swallowed failures, then wrote batch items separately. New account-scoped handoffs retain the confirmation through failure and offer Retry from Nutrition. A stable delivery ID and transaction prevent partial batches and duplicate retry rows; retries do not overwrite subsequent edits. Optional `undefined` fields are omitted before Firestore writes, fixing meal bundles without `presetId`.
2. **Queued meal ownership was not recorded.** New final handoff keys include the Firebase UID and payloads record their owner. Old unscoped handoffs are retained but never silently imported into an account. If an older unsaved meal was queued before this repair, re-enter it explicitly; no old local data was deleted or migrated. Meal-builder intermediate additions retain their existing handoff behavior.
3. **AI boundaries could hang or accept malformed estimates.** Mobile text/image requests now have a 30-second deadline, abort, nonempty-response checks and safe credential/access/rate/service errors. Meal responses require finite nonnegative core nutrients and valid portions; missing nutrients do not become successful zero estimates. Photo confidence `medium` is mapped to the UI's `med`. Workouts require valid exercise/section structures before display/history/save. The web description boundary checks configuration, authentication, totals and timeout before offering a result for review. Analysis still never saves food automatically.
4. **Workout completion could duplicate earlier sets after a later write failed.** Existing session/set IDs now supply idempotent document IDs on that path. Retry preserves already-saved sets and their edits. Independent manual workout logs keep ordinary generated IDs. The workout data fields, calculations and session draft format are unchanged.

Files changed are limited to these boundaries and their callers/tests: mobile `services/{aiTransport,aiValidation,openai,nutritionDelivery,nutritionPersistence,queueNutritionHandoff,previewNutritionHandoff,previewNutritionProjection,nutrition,workoutPersistence,workouts,mealBuilder}.ts`, scan service, Add Meal/Quick Add/Coach Spark/Nutrition and both scan routes; web `services/aiMeal.js` and `AddFoodForm.jsx`; focused tests. No layout redesign, backend source, Firestore rules, FitAdapt calculation/acceptance change, or environment/configuration edit was made.

## Capability inventory

| Area | Implementation / data path | Verification |
| --- | --- | --- |
| Startup/auth/navigation | Mobile `lib/firebase.ts`, auth routes, root/tab layouts; web Firebase/auth/App | Guard/route tests and exports; real demo Auth; device/browser outstanding |
| Theme/settings | `content/ThemeProvider.tsx`, `services/theme`, Settings/Theme Editor | Draft/save/cancel/provider tests; system appearance and text scaling need phone |
| Home/targets/progress | `usePreviewAccount`, shared nutrition target helper, dashboard/Profile projections | Accepted/pending/fallback/unit and measured-data tests; same-UID canonical fallback rules test |
| Manual meal log/edit/delete | Add Meal, Quick Add, Meal Builder, `services/nutrition.ts`, `users/{uid}/nutritionEntries` | Repaired service transaction, synthetic client CRUD/totals and retry tests |
| Food search/barcode | FDC service/Add Meal/meal-builder inputs; Open Food Facts fallback | USDA real synthetic query passed; scanner hardware and barcode lookup not verified |
| Photo estimate | scan routes → image picker/camera → `openai.ts` image encoding/request → scan validator → review/edit → owned handoff | Mock contract/save boundary; native capture and successful model response outstanding |
| Meal description | Add Meal → OpenAI JSON → validation → confirmation; web AddFoodForm → configured parse API → review | Mock boundary and failures; live blocked as above |
| Workout creation/generation | Coach Spark / template editors / session seed | Generated-response validation; phone form/template/start flow outstanding |
| Workout finish/history/recap | `app/workouts/session.tsx`, `services/workouts.ts`, `users/{uid}/workouts`, account-scoped draft | Actual persistence, partial retry, read/edit/delete; screen recap/repeat needs phone |
| Alerts/friends | notifications service, friends service, Alerts/friends routes | Demo client friend edges and alert read/dismiss; push/permission/filter UI outstanding |
| Profile/Insights/history | Profile, FitAdapt Insights route, account-scoped dated nutrition/weight/steps and read-only plan/history | Existing recorded-data, history bounds/order and target-state tests; no fabricated history |
| FitAdapt | mobile service → authenticated callables → mapper/plan service → local engine | Real local engine/callables, rules, queue harness; production intentionally untouched |
| Account/subscription | Account screen and `app/paywall.tsx` | UI inspected; billing not tested. `createCheckoutSession` is referenced by paywall but absent from current Functions exports |

## Commands and results

Run from the indicated directory. Audit output was captured under `/private/tmp/somata-health-check/`.

```sh
# fitness-mobile — PASS: typecheck and 60 tests
npm run typecheck
npm test

# fitness-web — PASS: 8 suites / 27 tests; production build
CI=true npm test -- --watchAll=false --runInBand
npm run build

# fitness-web/functions — PASS: build, 10 offline tests
npm run build
node --test test/fitadapt.test.js test/fitadapt-automatic.test.js
# FAIL, pre-existing: 17 errors / 91 warnings; not suppressed
npm run lint
```

All emulators used **demo-somata-fitadapt**, bound to loopback: Auth 9099, Firestore 8080, Functions 5001, Pub/Sub 8085. The audit copied the compiled Functions, rules and test harness into `/private/tmp/somata-health-check/emulators`, symlinked installed dependencies, and supplied a newly generated temporary bridge token. Local FitAdapt ran on 8765 in bridge-only mode with the matching token and access logging disabled. No real AI key was copied into Functions; a deliberately invalid synthetic key allowed authentication/invalid-input tests without a model call. Repository debug logs/configuration were not used for emulator output.

```sh
# Isolated emulator workspace (local config, no production env files)
firebase emulators:start --project demo-somata-fitadapt --only auth,firestore,functions,pubsub

# fitness-web — PASS: 11 rules tests
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npm run test:rules

# fitness-web/functions — PASS: 11 tests including emulator queue scenarios
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node --test test/fitadapt.test.js test/fitadapt-automatic.test.js

# fitness-web/functions — PASS: actual local callable/engine acceptance flow
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 node test/fitadapt-e2e.js

# Copied functions workspace — PASS: real trigger + production handler + local engine
# Must run on a fresh queue; initial mixed-suite runs correctly rejected leftover jobs.
NODE_PATH=/Users/aristos/Documents/fitness-app/fitness-web/node_modules \
GCLOUD_PROJECT=demo-somata-fitadapt \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
FUNCTIONS_EMULATOR_HOST=127.0.0.1:5001 \
PUBSUB_EMULATOR_HOST=127.0.0.1:8085 node test/fitadapt-schedule-local.js

# fitness-mobile — PASS: real SDK core flows, repaired persistence, HTTP auth/input checks
GCLOUD_PROJECT=demo-somata-fitadapt \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
node --import tsx tests/coreFlows.emulator.ts

# fitness-mobile — PASS: iOS and Android Hermes bundles
# Environment loading disabled so an actual OpenAI secret is not embedded in audit artifacts.
EXPO_NO_DOTENV=1 EXPO_PUBLIC_OPENAI_API_KEY='' EXPO_PUBLIC_USE_FIREBASE_EMULATORS=false \
npx expo export --platform all --max-workers 2 --output-dir /private/tmp/somata-health-check/export-all
```

Separate initial iOS/Android exports were stopped and replaced by the bounded-worker export above. `git diff --check` passes for touched tracked files. Starting file hashes distinguish this audit's changes from the large pre-existing working tree.

The queue E2E uses the **same production scheduled handler with a test clock**, not a claim that local cron fired. Actual Firestore triggers and Pub/Sub registration were exercised. Duplicate delivery, debounce/wait cap, insufficient evidence and engine timeout/service failures are covered by bridge/queue tests with injected engine outcomes; successful proposal/acceptance uses the actual local engine. See `fitness-web/functions/FITADAPT_AUTOMATIC_LOCAL.md` for the schedule limitation and runbook.

## Remaining blockers / operator and device checks

- **OpenAI:** model-access request succeeded (200); generation returned 429. Check that credential's quota/rate/billing status before repeating one small estimate. The existing mobile client embeds `EXPO_PUBLIC_OPENAI_API_KEY` directly; privileged credentials belong in a trusted backend. This pre-existing architectural security gap is not solved by response validation. Do not publish an Expo bundle containing that credential; moving the mobile AI calls to an authenticated server path and rotating any distributed key requires a separate integration/configuration step.
- **Web meal AI:** the local `.env` points to `127.0.0.1:5001/.../parseMeal`; that handler is commented out in `functions/src/index.ts`. `describe` is exported but is not a drop-in verified contract replacement. The web still needs a compatible authenticated endpoint and matching client configuration. No real-project URL was called or configuration guessed/changed.
- **Billing:** `createCheckoutSession` is not exported here. A verified existing billing backend/contract and test-mode Stripe setup are required; no purchase was attempted.
- **Existing sharing policy:** current rules allow any signed-in user to read nutrition/workout subcollections; FitAdapt state remains owner-only/server-write-only. This audit did not silently change that existing sharing policy. Narrowing it requires an explicit sharing/privacy decision and friend-flow tests. The broad owner subcollection fallback also means specialized validation rules do not independently restrict owner writes.
- **Legacy local caches:** some hydration and Coach Spark history storage remains device-local rather than account-scoped. The new nutrition delivery path does not import unscoped drafts. This audit did not migrate those separate caches.
- **Functions lint:** all 17 existing errors are in untouched `describe.ts` (empty catches/unused bindings). Build passes. `firebase.json` predeploy runs install/build, not lint; CI policies may still require lint. No suppression was added.

Phone checklist using synthetic emulator accounts (see `fitness-web/functions/FITADAPT_EXPO_GO_LOCAL.md` for LAN config/fixture commands):

1. Open all five tabs, each primary action and Back navigation; test sign-out/sign-in, app restart, large text, Light/Dark/System and theme Save/Cancel.
2. Log a manual food and a bundled meal, edit quantities, switch dates, delete, and compare Home/Nutrition totals. Disable networking before confirming a meal, restore it, tap Retry, and confirm exactly one entry appears.
3. Deny and then grant camera/gallery permissions. Test capture, library selection, cancellation, barcode scan, description estimate, review/edit and explicit save. With AI currently rate-limited, confirm a useful error and no nutrition entry is created.
4. Generate a workout once AI access is restored; review, save template, start, finish, inspect recap/history, edit/repeat/delete. Interrupt a multi-set finish, retry, and check no duplicated sets.
5. With two synthetic accounts, send/accept/decline a friend request; check alert filters, read/dismiss. Check notification permission handling without sending to real users.
6. Request a FitAdapt review on a seeded account: pending must not change active targets. Accept and verify Profile/Home/Nutrition agree. Use another proposal/account to Decline and confirm targets stay unchanged; inspect Insights/history and empty states.

For read-only visual checks against your ordinary account, start Expo with emulator mode explicitly off:

```sh
cd /Users/aristos/Documents/fitness-app/fitness-mobile
EXPO_PUBLIC_USE_FIREBASE_EMULATORS=false npx expo start --clear
```

You do not need Firebase emulators for ordinary-account visual browsing. Use the guarded emulator setup for logging/deletion/acceptance audit steps, not a personal account.

Cleanup: the audit-owned Firebase emulators and local FitAdapt process were stopped. Generated temporary bridge credentials and emulator environment files were removed from the temporary workspace. In-memory synthetic emulator data was not exported. Your existing local environment files were preserved.
