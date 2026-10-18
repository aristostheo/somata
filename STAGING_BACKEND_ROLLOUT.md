# Staging backend rollout package — 17 October 2026

> **Current authorization (17 October 2026): cloud creation, billing association and deployment are NOT approved.** Continue offline only. See [OFFLINE_LAUNCH_READINESS.md](OFFLINE_LAUNCH_READINESS.md) for current checks and blockers. The commands below describe future operator work, not authorization to run it.

Execution preflight follow-up: [STAGING_PREFLIGHT.md](STAGING_PREFLIGHT.md) records the live read-only project/billing inventory, the operator's new-project/email-only/synthetic-data decisions, Toronto compatibility/cost proposal and local lint repair. No staging resources have been created. The validation table below is the earlier preparation record; current lint is now **0 errors / 88 warnings**, and staging guard tests are **5 passing**.

**Preparation only. Not a deployment authorization or TestFlight readiness approval.** Work remains on `profile-redesign`. No cloud queries, deployments, secret writes, production/staging data operations, commits or pushes were performed. No new Firebase project, Cloud Run service, image registry or EAS environment was created. Use this document for the next explicitly authorized **staging** rollout; the older FitAdapt production runbook is background, not the targeting instructions for TestFlight.

## What is known, and what is not

The current local source is the deployment candidate, not evidence of deployed behavior. `.firebaserc` still defaults to `fitness-tracker-25254`; no staging project/alias or deployed FitAdapt host is established in repository configuration. Do not use that default for staging.

`TESTFLIGHT_READINESS.md` records an **October 14 historical inspection**: only legacy `describe` was listed in `fitness-tracker-25254/us-central1`; the published Firestore rules lacked the new FitAdapt protections and exposed broad signed-in fitness reads. This checkpoint did not refresh that inspection. Later local repairs and the user's successful local AI test do not prove production deployment. Current production Functions, rules, Storage, secrets, Scheduler, IAM and Run revisions are **unknown**. Capture a read-only inventory separately before any later production work. No production fitness records need to be read or copied for staging.

| Dependency | Current local candidate | Deployment evidence / staging gate |
|---|---|---|
| Meal/fitness AI | Exported `generateSomataAI`; staging Toronto, default `us-central1`. Verified Auth UID, strict callable-compatible JSON/media bounds and response validation, 25-second provider timeout, per-UID quota, no automatic retries or prompt/image persistence. Mobile and web use this boundary; review precedes saving meals. | Only legacy `describe` was historically listed. New endpoint/current provider configuration unverified remotely. Staging needs its own server secret, bounded spend and one controlled live synthetic smoke test. |
| FitAdapt manual review/read/accept/decline | `evaluateFitAdapt`, `getFitAdaptPlan`, `acceptFitAdaptPlan`, `declineFitAdaptPlan`; shared staging Toronto/default `us-central1` region parameter and matching mobile selection. Auth UID → account-scoped server inputs → protected bridge; Admin writes. Pending never replaces active targets. | No deployed candidate/Run URL established. Deploy the complete matching callable set, not just evaluate. |
| FitAdapt automatic evidence collection | `onFitAdaptProfileChanged`, `onFitAdaptNutritionChanged`, `onFitAdaptWeightChanged`, shared staging Toronto/default `us-central1` region. Writes server-only `fitadaptAutoJobs/{uid}`. Profile/nutrition/dated-weight paths remain account scoped. | Remote triggers/Eventarc transport unknown. Verify real trigger deliveries and rules, not Profile's `getFitAdaptPlan` logs. |
| FitAdapt scheduled processing | `processFitAdaptAutoReviews`: v2 `onSchedule`, `every 5 minutes`, staging Toronto/default `us-central1`, 540-second timeout, max instances 1, bridge secret bound. Same production queue processor used by local harness. | No cloud job verified. Local emulators do not supply the tested recurring timer; harness execution is not proof of Cloud Scheduler execution. See scheduler gate below. |
| Friend summaries/sharing | `getFriendSummary`, `setFriendSummarySharing`, staging Toronto/default `us-central1`; Auth, bilateral accepted friendship, block checks, fresh server-owned consent grant and privacy projection. No raw fitness/plan documents returned. Current mobile friend screens use these callables. | Historical edges are not newly verified consent. Do not migrate/reinterpret old grants. New synthetic friendships must explicitly opt in. Current deployed callables unknown. Web has no friend-summary screen to enable. |
| Account deletion | `deleteSomataAccount`, staging Toronto/default `us-central1`, recent-auth + explicit confirmation, Admin cleanup, lease/retry and deletion fences; Auth removed only after cleanup. | Remote endpoint/writer fences unknown. Unknown Storage, legacy global AI caches and safety reports can intentionally block deletion. Retention/provider-revocation decisions in `IN_APP_RELEASE_BLOCKERS.md` still apply. A clean synthetic deletion does not resolve those decisions. |
| Firestore rules | `fitness-web/firestore.rules`: owners retain ordinary access; raw cross-account fitness reads denied. Projection/plan/history/queue/consent/deletion state remains server-owned. Includes canonical goals and owner-only legacy-profile reads. | Historical published rules were unsafe; current rules unknown. Hardened rules must precede exposing the staging client. Do not temporarily broaden them for summary failures. |
| Storage rules | `fitness-web/storage.rules`: only known shared exercise/catalog assets publicly readable; no client writes; unknown paths denied. Current personal media flows do not require a cloud upload. | Normal `firebase.json` does not bind these rules. New **dedicated staging config** binds them. Actual bucket contents, versions, retention and rules unknown. Default bucket must match mobile and Admin deletion audit. No assets/data copied by this checkpoint. |
| Legacy/unsupported endpoints | `describe` still exported and can create unowned caches. `createCheckoutSession` does not exist. Food-history trigger remains unexported. | Do not deploy legacy `describe` into a clean staging project for this app. Do not deploy all exports blindly. If staging already has legacy writers, inventory and resolve them before deletion testing. Checkout is forcibly disabled in this staging package. |

Sources: `fitness-web/functions/src/index.ts`, `src/ai`, `src/fitadapt`, `src/friends`, `src/account`, both rules files, and the reports linked above. The separate FitAdapt repository was inspected read-only; no recommendation logic or service files were changed.

## Exact operator inputs still needed

Copy `fitness-web/staging.example.json` to ignored `fitness-web/staging.local.json` only when actual reviewed values are available. Its blank fields deliberately fail validation. Keep credentials out of both files.

| Input | Required value / constraint |
|---|---|
| `firebaseProjectId`, `firebaseProjectNumber` | A separately provisioned, billing-enabled staging Firebase project; neither the configured production project nor `demo-*`. No project has been chosen by this code. Confirm operator ownership and intended data residency. |
| `firestoreLocation` | Actual location of the staging **default** Firestore database. Confirm Eventarc trigger compatibility before provisioning/deploying; cannot be inferred from callable region. |
| `storageBucket` | Actual staging default bucket: project `.appspot.com` or `.firebasestorage.app`. Initialize Storage and confirm location, access and retention. Admin uses the default bucket; additional buckets need a separate audit. |
| `functionsRegion` | `northamerica-northeast2` for this staging package; all twelve handlers and the mobile client select Toronto. Normal production/demo defaults stay `us-central1`. |
| `runProjectId`, `runRegion`, `runService`, `runServiceAccount` | This package requires Run in the **same isolated staging project**. Choose region, service name and a dedicated service account with access to the bridge secret only. No runtime/project identities are inferred. |
| `imageDigest` | Reviewed FitAdapt image in that project's Artifact Registry, pinned by `@sha256:` digest. Registry repository/location and build identity still need setup. No image was published here. |
| `bridgeSecretVersion` | Numeric Secret Manager version identifier for Run; never the secret value or `latest`. Functions bind the same secret name; verify the effective version in each deployed revision, including the scheduled worker. |
| `serviceUrl` | Actual verified staging Cloud Run HTTPS root. May be blank for preliminary validation; required for deployment hooks. Operator must verify the URL's project/service/revision in cloud metadata: syntax alone cannot prove ownership. |
| `SOMATA_STAGING_FIREBASE_CONFIG` | JSON from a **registered web app in that staging Firebase project**, containing exactly `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`. These are public Firebase client identifiers, not Admin credentials. No service-account JSON/provider key belongs here. |
| `EXPO_PUBLIC_SOMATA_STAGING_PROJECT_ID` | Same staging project ID as the plan and Firebase client JSON. |
| `SOMATA_PRIVACY_POLICY_URL`, `SOMATA_SUPPORT_URL` | Real operator-approved publicly reachable HTTPS pages. No placeholders/legal text supplied. Validator checks syntax; operator/device must verify content, uptime and contact method. |
| Auth and native app setup | Enable intended staging Auth providers and authorized domains; supply correct public Google IDs and Apple configuration if those providers are supported. Confirm the existing iOS app identity/signing/App Store Connect app and EAS project. Do not reuse production provider credentials blindly or change app identity here. Email/password synthetic accounts suffice for initial smoke tests, not provider release approval. |
| Operator permissions/billing | Firebase/Google Cloud account, billing/budget alerts, Artifact Registry/build permissions, deploy/service-account permissions, Secret Manager and Scheduler permissions. EAS/Apple access for a later authorized build/distribution. No resources/accounts/payment changes were made here. |

Server-side names only:

- **`OPENAI_API_KEY`** — staging Secret Manager; bound to `generateSomataAI`. Use an appropriate staging provider project/budget. Previously client-exposed credentials still need operator revocation/rotation confirmation.
- **`FITADAPT_BRIDGE_TOKEN`** — staging Secret Manager; exact matching credential for FitAdapt Run, `evaluateFitAdapt`, `acceptFitAdaptPlan`, and **`processFitAdaptAutoReviews`**. No client value.
- **`SOMATA_STAGING_PROJECT_ID`** — non-secret server project pin, must match the CLI/Admin runtime project; rejects production, the unrelated project, demo and mixed contexts.
- **`SOMATA_FUNCTIONS_REGION=northamerica-northeast2`** — non-secret Firebase parameter for all twelve trusted handlers. Parameter expressions preserve the selected region during source discovery; default production/demo deployments stay `us-central1`.
- **`FITADAPT_SERVICE_URL`** — non-secret server parameter containing the verified staging Run root, never an Expo variable.
- **`FITADAPT_SOMATA_ONLY=1`** — Run bridge-only mode; `PORT` provided by the platform (container default 8080). No demo/docs mode.

Do not reuse laptop `.secret.local`, `.env.local` or demo-project files as deployment inputs. Future authorized secret setup must use an interactive/secure Secret Manager input mechanism, never values in command arguments, shell history, committed files, CI logs or this plan. Runtime secret identities need only the relevant secret-access role. Pin Run versions and record bindings without values. [Cloud Run secret configuration](https://docs.cloud.google.com/run/docs/configuring/services/secrets).

## Guardrails and safe offline commands

The dedicated `firebase.staging.json` selects `nodejs22`; normal `firebase.json` and the existing package engine are unchanged. CI checks use Node 22. Google lists Node 20 decommissioning on 2026-10-30, so it is unsuitable for the new staging rollout ([runtime schedule](https://docs.cloud.google.com/functions/docs/runtime-support)).

Staging uses Toronto for Functions, including callables, Firestore triggers and the scheduled worker. Staging Apple/Google actions are disabled in both UI and service paths, including deletion reauthentication; email/password remains available.

`fitness-mobile/config/backend.cjs` validates a staging manifest and selects **all** Firebase clients from it. `testflight` requires staging; missing/production/mixed project config throws before Firebase initialization. The bundled staging project and manifest must agree. A native `testflight-staging` (or old `testflight`) update channel rejects a production-targeted JS update. Hot reload cannot silently retain a different Firebase app. Ordinary development/production initialization and explicitly opted-in demo emulator behavior remain available outside staging.

`eas.json` now uses the EAS **preview** environment and **testflight-staging** channel for the `testflight` profile, explicitly sets staging, disables emulators and checkout, and enables required-link validation. This local selection does **not** create or populate the remote EAS environment. Operator must supply the public inputs above to that environment and any local config/export/update invocation; keep the production environment/channel separate. Firebase configuration is public and intentionally bundled; provider/bridge secrets must never enter EAS/Expo config. A generic production profile is still production: do not submit an arbitrary build as this staging test.

`fitness-web/scripts/validate-staging.cjs` is offline: it validates project/region/bucket/client agreement, pinned artifact/secret-version syntax, HTTPS root, required links, disabled checkout and disabled emulators. It does not authenticate to Google, fetch URLs, verify actual resources or read secrets. `staging-deploy-guard.cjs` additionally requires the Firebase CLI's `GCLOUD_PROJECT` to match the reviewed plan, rejects conflicting project/URL settings, refuses local secret/unrelated env files, and requires a project parameter file containing exactly the reviewed URL, staging project pin and Toronto region. All three deploy targets in `firebase.staging.json` have this hook. Normal `.firebaserc`, `firebase.json` and production EAS profile are unchanged.

After supplying **public** staging and policy/support variables to the current shell, these commands only validate/build locally:

```sh
cd /Users/aristos/Documents/fitness-app
node --test fitness-web/test/staging-preflight.test.cjs
npm run build --prefix fitness-web/functions
env -u FIRESTORE_EMULATOR_HOST node --test fitness-web/functions/test/*.test.js
npm run typecheck --prefix fitness-mobile
npm test --prefix fitness-mobile

export EXPO_PUBLIC_SOMATA_BACKEND_ENV=staging
export EXPO_PUBLIC_USE_FIREBASE_EMULATORS=false
export SOMATA_CHECKOUT_ENABLED=false
export SOMATA_RELEASE_BUILD=true
# Supply EXPO_PUBLIC_SOMATA_STAGING_PROJECT_ID, SOMATA_STAGING_FIREBASE_CONFIG,
# SOMATA_PRIVACY_POLICY_URL and SOMATA_SUPPORT_URL through your public build inputs.
node fitness-web/scripts/validate-staging.cjs fitness-web/staging.local.json
# Once Run has an allocated, independently verified staging URL:
node fitness-web/scripts/validate-staging.cjs fitness-web/staging.local.json --require-service-url

cd fitness-mobile
EAS_BUILD_PROFILE=testflight EXPO_NO_DOTENV=1 npx expo config --type public
EAS_BUILD_PROFILE=testflight EXPO_NO_DOTENV=1 CI=1 npx expo export --platform all --max-workers 2 --output-dir /private/tmp/somata-staging-export
```

Config output contains public app identifiers; keep it out of public tickets unnecessarily. Never populate a real secret to make config validation pass. Existing web application initialization remains unchanged and is **not** a staging test client; do not sign a personal account into it to test this package.

## Deployment order — future authorized operator work only

1. **Record the starting state.** Choose/confirm the isolated project and collect rules versions, existing Functions/revisions, Scheduler jobs, Run revisions, service identities, secret version IDs (no values), database/bucket locations, IAM and Auth providers. If it is not empty, audit its existing writers and retention blockers. Use only synthetic accounts; do not import production records. Set budget alerts, quotas and restricted operator access. Review missing deletion/retention decisions before inviting testers.
2. **Prepare a clean reviewed artifact.** The current working tree includes unrelated work and laptop config; do not deploy this directory indiscriminately. Assemble the reviewed source including these guards and hardened rules, dependencies/locks, all writer fences and mobile/backend contract versions. No `.env`, `.env.local`, `.env.demo-*`, `.secret*` or debug files in deployment inputs. Keep laptop files intact. Normal Functions predeploy runs frozen pnpm install and TypeScript build; lint is not a hook. Run lint separately and do not suppress an existing failure.
3. **Prepare FitAdapt.** Cloud Run remains the recommended path because the existing locked Python container can run alongside Firebase with Secret Manager and scale to zero; no host was previously configured. Require the existing separate-repository CI production Docker build/filesystem/bridge smoke tests to pass for the exact digest before any later publishing. Python 3.12/uv lock, non-root runtime, one uvicorn worker, no access logs, 128-KiB request cap, safe `/health`, protected `/v1/profile-intelligence` and bridge alias are already in the production artifact. No recommendation changes are needed. Suggested existing runbook bounds: CPU 1, memory 1 GiB, min 0/max 1 instance, concurrency 10, request timeout 15 seconds; Somata adapter timeout is 10 seconds. Confirm costs/load before adopting them.
4. **Configure staging secrets and deploy Run only after authorization.** Use matching secret bindings and bridge-only mode. Current adapter sends an application bridge credential, not a Google IAM identity token: HTTPS transport must be reachable by Functions, while intelligence routes enforce that credential. Requiring IAM-only Run invocation needs a separate adapter change; do not silently configure incompatible IAM. Health must disclose only service/version metadata. Record the resulting root URL and verify service/project/digest/secret version. Test health, correct/missing/wrong bridge credential, 128-KiB rejection, disabled demo/docs and response schema with synthetic input, no payload/token logging. Store results, not credentials.
5. **Complete parameters and validate.** Fill plan `serviceUrl`. In the clean artifact only, create `fitness-web/functions/.env.<STAGING_PROJECT_ID>` with exactly three non-secret assignments (blank/comment lines allowed): `FITADAPT_SERVICE_URL=<VERIFIED_ROOT_URL>`, `SOMATA_STAGING_PROJECT_ID=<VERIFIED_STAGING_PROJECT_ID>`, and `SOMATA_FUNCTIONS_REGION=northamerica-northeast2`; no secrets or other project files. Set `SOMATA_STAGING_PLAN` to the absolute reviewed plan path. Supply the same public mobile/release environment used for preflight. Run `--require-service-url`. Stage-specific secret bindings come from Secret Manager, not this file. Hooks reject missing/mismatched inputs; passing them is not deployment approval.
6. **Deploy hardened rules first**, using `--config firebase.staging.json --project "$EXPO_PUBLIC_SOMATA_STAGING_PROJECT_ID" --only firestore:rules,storage`. Verify owner access and denied raw cross-account/plan writes before letting clients in. Candidate Storage rules intentionally deny uploads and unknown files; publish only audited shared catalog assets separately if required, never open an upload wildcard to restore a failing feature.
7. **Deploy the current trusted callable group**, explicitly selecting `generateSomataAI`, `evaluateFitAdapt`, `getFitAdaptPlan`, `acceptFitAdaptPlan`, `declineFitAdaptPlan`, `getFriendSummary`, `setFriendSummarySharing`, `deleteSomataAccount`. Use the same dedicated config, explicit project and hooks. Do not include `describe` or nonexistent checkout/food-history exports. Verify Auth/recent-auth/error behavior and basic synthetic review/acceptance before timers run. If legacy writers already exist in staging, they require an explicit retirement/fencing decision; omission from this list is not proof they disappeared.
8. **Deploy automatic triggers and worker last:** `onFitAdaptProfileChanged`, `onFitAdaptNutritionChanged`, `onFitAdaptWeightChanged`, `processFitAdaptAutoReviews`, same config/project. Verify the actual Eventarc and Scheduler resources, invoker identity and secret bindings. Complete the scheduled-path test below. Do not add a second cron job or a public worker test endpoint.
9. **Build/distribute only the reviewed staging client after the backend gates pass.** Separately authorize EAS build/upload; `eas build --platform ios --profile testflight` is the intended profile, but was not run here. Review that exact build's backend/channel/config and submit its exact build ID, never an unreviewed `--latest`. This does not resolve signing, privacy declarations, entitlement policy, provider revocation, device checks or other readiness blockers.

The deployment command shape for steps 6–8, **not executed here**, is:

```sh
# In the clean artifact's fitness-web directory, with reviewed public env and
# SOMATA_STAGING_PLAN already supplied. Replace the target list per steps 6–8.
firebase deploy --config firebase.staging.json \
  --project "$EXPO_PUBLIC_SOMATA_STAGING_PROJECT_ID" --only <EXPLICIT_TARGET_LIST>
```

Use `functions:<name>` for each callable/trigger in the list. An empty/unset project is refused by the hook. This guard cannot protect commands deliberately using another config or manually bypassing source checks; operator target review is still required.

## Scheduler / Eventarc / Pub/Sub gate

The actual installed Functions v2 scheduler creates an **HTTP-scheduled function**. Firebase deploy creates a Cloud Scheduler job invoking it with a service identity; it is not this application's custom Pub/Sub subscriber. Require billing and Cloud Scheduler API, then inspect the generated job's actual schedule, region, target URI, enabled state, service account/OIDC and invoker permission. Timezone/retry settings are not explicitly specified in this source: record effective deployed values instead of assuming them. Do not manually duplicate/delete generated jobs. Scheduled deliveries may overlap or repeat. [Firebase scheduled Functions](https://firebase.google.com/docs/functions/schedule-functions).

The installed Firebase CLI's v2 preparation also requires Cloud Run, Eventarc, Pub/Sub and Storage APIs/service identities. Firestore change triggers need Eventarc transport and the generated service agents/permissions. Confirm those resources and successful deliveries in the chosen project; do not invent a worker topic name. Database location/trigger compatibility and service-agent setup are deployment gates. [Firestore Eventarc triggers](https://docs.cloud.google.com/eventarc/standard/docs/run/route-trigger-cloud-firestore).

Queue semantics remain unchanged: 2-minute quiet debounce, 10-minute maximum coalescing wait, 2-minute lease, query up to 50/process up to 10 jobs per invocation; source-hash/pending deduplication and up to 3 attempts per source for retryable errors. The scheduler's next tick and backlog add time beyond queue eligibility. The worker can propose, not accept or alter active targets. Verify the production handler and deployed timer together; a `getFitAdaptPlan` log only proves a client read. `FITADAPT_AUTOMATIC_LOCAL.md` distinguishes the actual local emulator trigger from the shared-handler harness used because recurring scheduling was not observed locally. Never retarget its demo-only test scripts at a cloud project or remove their safety checks.

## Synthetic verification and device checklist

Use two newly created **fictional staging accounts** and an unauthenticated caller; never personal nutrition/photos/history. Create them through the staging app's normal Auth/onboarding, or separately approved, UID-scoped staging fixture tooling. Current local E2E/seed scripts intentionally refuse cloud targets. No staging fixture execution is included in this preparation.

- **Targeting:** inspect build metadata/project/channel; sign in only to staging. Missing configuration and a production-targeted OTA must fail before Firebase use. Cold restart and account switching must not reveal another account's local records.
- **AI:** verified caller gets a genuine generated estimate with one small controlled request; log status only and stop on 429. Verify review/edit/confirm before nutrition save. Unauthorized, malformed media, timeout/rate-limit and quota paths remain safe. Mocked tests are not live provider validation.
- **FitAdapt manual:** incomplete input returns honest insufficient data without losing profile; sufficient synthetic input produces pending review, with unchanged active targets. Accept explicitly updates the accepted projection/history; repeat safely. Use a fresh proposal/account for Decline, which must leave active targets unchanged. Check Home/Nutrition/Profile agree.
- **Automatic:** establish sufficient dated evidence/accepted baseline through an authorized synthetic fixture or real synthetic logging. Write an account-scoped meal via the app; verify the trigger-created server-only queue, coalescing due time/generation, then an actual successful **scheduled worker** execution after eligibility. Confirm pending proposal and unchanged active projection until Accept. Repeat delivery/edits must not duplicate proposals. Insufficient evidence and a controlled failed bridge request must be safe/bounded; use a dedicated synthetic test revision or local harness for fault injection, not disruption of a shared service.
- **Friends/rules:** create accepted friendship and explicit owner sharing grant; enable only intended switches. Verify allowlisted summaries; disable privacy and block/remove friendship to get private/unavailable. Stranger and signed-out reads fail. Client raw nutrition/weight/account/plan/history reads across UIDs fail; protected target/plan/queue/grant/tombstone writes fail, ordinary owner edits succeed. Record rule version and statuses, not personal documents.
- **Deletion/Storage:** fresh reauthentication + confirmation deletes only account A's audited data/references, retains B, and removes Auth last. Retry a synthetic partial failure. Owner/client cannot bypass deletion fences or write server-owned state. Unknown Storage/global caches/reports yield the documented hold, not guessed deletion. Do not remove real/ambiguous records to get a green test. Known shared assets load and unknown paths/uploads fail. Inventory retention/provider blockers separately.
- **Device:** signed iOS build launch/auth/session persistence; staging Google/Apple provider flows if enabled; camera/photo permission deny/grant, capture/resize, describe/scan → Meal Builder → explicit meal confirmation; account switching; live manual and scheduled review; friend consent states; deletion reauth/retry; policy/support pages load while signed out/in; checkout absent even on direct paywall navigation. Verify no local HTTP/emulator dependence. Android export is not a device test. Notification delivery and other release-report feature checks remain separate.

## Rollback without reopening data access

Record the reviewed artifact, prior safe Functions revisions/source, rule revisions, Run digest/revision and secret version identifiers before rollout. Do not record secret values or payloads.

1. Halt distribution/new staging test writes. If automatic processing is faulty, an authorized operator can temporarily pause the **staging** scheduled job while repairing/redeploying; do not delete generated topology or create competing jobs. Retain queue/lease/deletion fences and pending/accepted data.
2. Restore the previous verified staging Run revision/digest and matching bridge binding, then the prior **compatible guarded** Functions revision using explicit staging targeting. Coordinate secret-version rollout across Run, evaluation, acceptance and worker; restoring just one side can break authentication. Never reactivate the leaked provider credential. Verify reads, accepted targets and Auth before resuming the schedule.
3. Keep hardened Firestore/Storage rules. A prior broad sharing rule set is **not** a rollback option. Fix a narrow denied legitimate path under emulator tests or restore a previously tested hardened rules revision. Never open client plan/history/target writes or a Storage upload wildcard.
4. If this is the first staging deployment, there is no known safe older backend: keep clients/timer paused and fix forward or deliberately withdraw the affected staging capability. Do not point TestFlight at production as fallback. Restore a matching staging mobile build/update only on its staging channel after config checks.
5. Do not roll back accepted plans, delete history/tombstones, restore old data over current records, or purge ambiguous objects as deployment cleanup. Use the audited deletion flow for synthetic accounts; any retention hold needs the operator decision described in the deletion report. Re-run negative access, synthetic acceptance and actual scheduled-job checks before resuming.

## Validation performed for this package

Changed files are limited to:

- This runbook and follow-up pointers/corrections in `TESTFLIGHT_READINESS.md`, `IN_APP_RELEASE_BLOCKERS.md` and `fitness-web/functions/FITADAPT_ROLLOUT.md`.
- Mobile config guards/types in `config/backend.*`, the unchanged public production client identifiers moved into `config/firebaseProduction.*`, selection in `lib/firebase.ts`/`app.config.ts`, `eas.json`, `.env.example`, and `tests/stagingBackend.test.ts`.
- `fitness-web/firebase.staging.json`, the blank `staging.example.json`, `.gitignore` for an operator's local plan, `scripts/validate-staging.cjs`, `scripts/staging-deploy-guard.cjs`, and `test/staging-preflight.test.cjs`.
- The existing CI workflow's offline staging test step/path filters. No dependency or lockfile changes.

Unrelated working changes were preserved. Existing debug logs were not edited or truncated; the running local Functions watcher appended to `fitness-web/firebase-debug.log` during validation, and that output was left intact.

All positive staging values used in tests/export were **synthetic configuration only**; no such cloud project was contacted or claimed to exist.

| Command/check | Result |
|---|---|
| `node --test fitness-web/test/staging-preflight.test.cjs` | 4 passing tests: plan/project/URL/config consistency, unsafe/default targeting, secret-file contamination, hook coverage and TestFlight settings. |
| `npm run typecheck --prefix fitness-mobile` | Passed. |
| `npm test --prefix fitness-mobile` | 111 passing tests, including 4 new backend/config/runtime-channel tests. |
| `npm run build --prefix fitness-web/functions` | Passed. |
| `npm run lint --prefix fitness-web/functions` | Fails: 17 existing errors in untouched `src/describe.ts`, 91 warnings overall. Not suppressed or fixed in this scope. Both normal and dedicated staging predeploy hooks install/build, not lint, so these do not mechanically block those hooks; they remain a separate quality gate requiring an explicit narrow fix/review. |
| `env -u FIRESTORE_EMULATOR_HOST node --test fitness-web/functions/test/*.test.js` | 20 passing tests, including AI, FitAdapt, queue, friend boundary and deletion unit coverage. Mocks/in-memory coverage, not deployed service checks. |
| Actual Expo public config with `EAS_BUILD_PROFILE=testflight`, dotenv disabled | Synthetic staging passed; missing JSON and production-mode TestFlight were rejected. |
| `expo export --platform all --max-workers 2 --output-dir /private/tmp/somata-staging-export` with synthetic staging/release inputs | iOS and Android bundles exported successfully. No EAS build/upload. |
| `node fitness-web/scripts/validate-staging.cjs fitness-web/staging.example.json` | Expected refusal: real operator fields/links/client config are absent. |

The existing `.github/workflows/fitadapt-bridge.yml` now also runs the offline staging preflight tests and triggers for these configuration/script changes. CI was not dispatched; local execution passed.

No Firestore/Storage rules or backend business code changed. Existing emulator processes/data were left alone; cloud smoke tests, Docker/CI verification for an actual image digest, signed native-channel/OTA checks and physical-device tests were **not** performed here. Previous local emulator results in the security/AI/FitAdapt/deletion reports are historical evidence, not fresh staging validation. The existing web app is unchanged; the new Node preflight tests cover its added tooling. Remaining readiness blockers and retention decisions are not waived.
