# Staging preflight and operator review — 17 October 2026

> **Superseding status:** the operator has declined billing/resource creation for now. No staging infrastructure will be created or deployed. Offline region selection and email-only staging guards are now implemented; see [OFFLINE_LAUNCH_READINESS.md](OFFLINE_LAUNCH_READINESS.md). Older observations below are historical, not current cloud verification.

## Final resource proposal awaiting billing-account selection and approval

The operator selected **`somata-staging-aristos-2026`** and authorized preparation of a **CAD$20 alerts-only budget**, not resource creation or a spending cap. On 17 October, Firebase's dedicated non-creating availability API returned HTTP 200 and **`PROJECT_ID_AVAILABLE`** for this exact ID. No project was created/reserved. This supersedes the inconclusive Resource Manager GET checks recorded below. Implementation evidence: installed Firebase CLI `management/projects.js`, `checkAndRecommendProjectId`, calls `POST /v1/projects:checkProjectId` with only a proposed ID; it is separate from project creation.

Final proposed resource list, **not deployed/configured**:

| Item | Proposal |
|---|---|
| Firebase/GCP project | `somata-staging-aristos-2026`, display name **Somata Staging**, isolated from both existing projects |
| Billing account | **Not selected.** Operator chooses **Firebase Payment** (ending `CFDC05`) or **My Billing Account** (ending `57E1C3`); both were verified open/CAD in the preceding read-only inspection. No new billing account required if the selected existing account can be linked. |
| Auth and Firebase client registration | Email/password only, synthetic accounts; register a staging web app for the Firebase JS client. Apple/Google stay disabled and their entry actions must be hidden in the staging build. |
| Firestore / Storage | One default Native Firestore database and one default regional Standard Storage bucket, both **Toronto (`northamerica-northeast2`)**; hardened rules before dependent Functions/client rollout |
| Functions | Eight trusted HTTPS/callable handlers, three FitAdapt Firestore triggers, one scheduled worker, **Toronto**, all second generation; exclude legacy `describe` and nonexistent checkout |
| Scheduling / event infrastructure | One authenticated five-minute Scheduler job; three Firestore Eventarc triggers and the managed Pub/Sub transport/service identities required by the deployment; Toronto where configurable; no duplicate cron worker |
| FitAdapt service | Cloud Run `fitadapt-staging`, Toronto; request-based billing, 1 CPU / 1 GiB, min 0 / max 1 instance, concurrency 10, timeout 15s, bridge-only mode, existing 128-KiB limit |
| Build/image storage | Artifact Registry `somata-staging` in Toronto; existing production Dockerfile/lock; image `fitadapt` pinned by actual digest after build. Exact build method subject to available local/CI tooling; cloud-build costs require the same approval. |
| Identities / secrets | Dedicated FitAdapt runtime service account plus required least-privilege Functions/build/service-agent identities. Two Secret Manager secrets: `OPENAI_API_KEY`, independent staging `FITADAPT_BRIDGE_TOKEN`; record versions only. Actual URL/digest/versions are assigned later. |
| Monitoring/budget | Standard runtime/build diagnostics without personal payload logging; prepare CAD$20 monthly alerts at 50/80/100%, scoped to staging. No optional backup/PITR/scanning/VPC/load-balancer resources selected. Retention policies remain undecided. |

**Toronto compatibility:** the current trusted handler imports use Firebase Functions v2, supported in Toronto. Offline source/client guards now select Toronto together for staging handlers, scheduler, callable initialization and validation/tests, preserving production/default/demo `us-central1` settings. This proposed all-Toronto regional layout supersedes the earlier mixed-region proposal below. Region code has been prepared locally; no cloud setting has changed. Firebase Auth and the external AI provider are not a guarantee of Canada-only processing. [Functions locations](https://firebase.google.com/docs/functions/locations).

**Cost review:** retain the planning estimate **US$0–10/month Google Cloud** under the small synthetic-beta assumptions below, excluding OpenAI, Apple/EAS, taxes and excess usage/build churn. The CAD$20 alert is prepared conceptually only; neither a budget resource nor a billing association exists. The estimate is not a ceiling. Account-wide free-tier eligibility is not guaranteed. No resource creation is authorized until the operator selects the billing account and approves this concrete proposal.

Privacy/support URLs remain missing, release/predeploy URL checks remain fail-closed, checkout stays disabled, and retention holds remain unchanged. No secrets are needed in chat. After project creation is approved and verified, the operator enters secret values directly in **that staging project's Secret Manager Console**, and supplies only names/version numbers. No secret metadata can yet be read from a project that does not exist.

The project-ID review initially changed documentation only. The later offline follow-up now prepares region/runtime/provider guards and records fresh checks in OFFLINE_LAUNCH_READINESS.md; no cloud change followed.

**Stopped before resource creation, per the operator's review gate.** No project, billing link, service, secret, data, rule deployment, image publication or build upload was created. No production configuration/data changed. Branch remains `profile-redesign`; unrelated work and logs remain intact. This records phase 1 and the requested project/region/cost proposal, not cloud or TestFlight readiness.

## Verified inventory and decisions

- Current `.firebaserc` and mobile production configuration identify **`fitness-tracker-25254`** (project number `553795836715`). It is excluded from staging. Historical deployed Functions/rules observations were not refreshed or assumed current.
- Read-only `firebase projects:list --json --non-interactive` succeeded outside the network-restricted sandbox. It returned that project and **`eleven11-aristos`** (`1071072560179`). The operator explicitly rejected both as staging targets. No settings/user data in either were changed.
- No `fitness-web/staging.local.json`, staging client environment, Run service/image/URL or selected staging project exists in this checkout. The blank example correctly fails validation.
- Operator decisions: a **new dedicated Firebase/GCP project**, email/password only for synthetic accounts, Toronto preferred for Firestore/Storage/Run, separate staging bridge credential, no placeholder policy/support URLs, retention decisions remain open. Resource/cost review is required before creation.
- Read-only Cloud Billing account metadata shows two **open CAD** accounts: **Firebase Payment** (ID ending `CFDC05`) and **My Billing Account** (ending `57E1C3`). No billing link or account permissions were changed. Choose which account to use; visibility/open status does not establish project-link permissions or available free-tier credits.
- `gcloud` and Docker are not on PATH. Firebase/EAS CLIs are installed. Xcode is **26.0.1 (17A400)**. Any later install/build provisioning must preserve the existing environment.

## Project ID choices

Suggested order:

1. `somata-staging-aristos`
2. `somata-staging-aristos-2026`
3. `somata-staging-aristos-01`

These satisfy project ID syntax and do not appear in the accessible project inventory. **Historical initial check only; the preferred ID was subsequently verified available as stated above.** Read-only Resource Manager GETs for all three returned `403 PERMISSION_DENIED`; this cannot distinguish unused IDs from inaccessible existing/deleted IDs. Do not interpret it as availability or create a project just to test availability. The Console can validate the chosen name during the reviewed creation workflow; stop before Create until authorized. Project IDs are globally unique, permanent and cannot reuse a deleted project's ID. [Project ID requirements](https://docs.cloud.google.com/resource-manager/docs/creating-managing-projects).

## Proposed regions and compatibility

| Resource | Proposed location / setting | Compatibility |
|---|---|---|
| Firestore default database | Native mode, `northamerica-northeast2` (Toronto) | Supported. Choose carefully before creation. [Firestore locations](https://docs.cloud.google.com/firestore/native/docs/locations). |
| Default Firebase Storage bucket | Regional Standard bucket, Toronto; actual allocated bucket recorded after creation | Supported. The app and Admin deletion audit must use this same default bucket. No personal files imported; keep hardened rules. [Storage locations](https://docs.cloud.google.com/storage/docs/locations). |
| FitAdapt Cloud Run | `northamerica-northeast2`, service `fitadapt-staging` | Supported. Same new project as Firebase. [Cloud Run locations](https://docs.cloud.google.com/run/docs/locations). |
| Artifact Registry | Toronto, repository `somata-staging`, image `fitadapt` pinned by digest | Proposed names, not created. Keep the verified deployment image and a known-good rollback revision; review cleanup before removing either. |
| Runtime service identity | `fitadapt-staging@<SELECTED_PROJECT_ID>.iam.gserviceaccount.com` | Dedicated identity; bridge-secret access only. It needs no Firebase user-data permissions. |
| Firebase Functions and scheduled worker | **Toronto** for staging, Node 22 in the dedicated config; normal defaults unchanged | Coordinated staging source/client selection is prepared offline; cloud execution remains untested. Auth/external providers are not a Canada-only guarantee. |
| Firestore Eventarc trigger transport | Toronto, matching the database | Installed Firebase CLI sets trigger region from database metadata independently from function destination region. Offline stub check confirmed Toronto trigger + `us-central1` function; no deployment was tested. |
| Cloud Scheduler job | Generated for the staging Toronto scheduled worker | Keep one generated authenticated HTTP schedule, every five minutes; no duplicate Pub/Sub cron worker. Eventarc/Pub/Sub transport requirements remain in the rollout runbook. |

Eventarc Firestore triggers must match the database location, while their Cloud Run destination can be in another supported region in the same project. [Eventarc routing](https://docs.cloud.google.com/eventarc/standard/docs/run/route-trigger-cloud-firestore), [Eventarc locations](https://docs.cloud.google.com/eventarc/docs/locations). Local evidence: installed `firebase-tools/lib/deploy/functions/services/firestore.js`, `ensureFirestoreTriggerRegion`; existing `src/fitadapt/automatic.ts` pins function execution to `us-central1`.

**Historical alternative, now selected and prepared offline:** Toronto supports second-generation Functions too. If keeping Functions processing in Canada is preferred, make a coordinated **staging-only** region configuration change across server handlers, scheduler, mobile callable client and validators/tests before deploying. Leave existing production/default/emulator behavior intact. Do not merely edit the plan's region: current guards correctly reject that unsupported configuration. The offline follow-up now implements this staging-only selection. [Functions locations](https://firebase.google.com/docs/functions/locations).

Proposed Run limits for the small synthetic beta: request-based CPU billing, min instances 0 / max 1, CPU 1, memory 1 GiB, concurrency 10, timeout 15 seconds, existing bridge-only mode and no access logs. Existing Somata adapter timeout stays 10 seconds. Verify cold-start and concurrent-request behavior before inviting testers; scale-to-zero can expose latency. Use only the existing locked container/CI build; record its actual digest and allocated service URL after approved creation. No VPC connector, load balancer, custom domain or always-on minimum instance is proposed.

## Billing and cost proposal — awaiting approval

Staging needs its **own project billing association / Firebase Blaze plan**, not necessarily a new billing account or payment method. Either selected existing CAD account can be considered, subject to permissions. Blaze is required for this Functions/Storage setup; linking a billing account upgrades the Firebase project. [Firebase billing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [Storage billing requirements](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).

**Planning estimate, not a quote or cap: US$0–10/month of Google Cloud usage** for <=10 synthetic testers, <=30,000 short backend requests/month, <=1 GiB app data, <=5 GiB retained build/container artifacts, a few build/deploy cycles, minimum instances zero, and no optional paid backup/PITR/scanning products. First-month repeated builds, longer AI waits, region transfer, logs, shared free-tier consumption or heavy polling can exceed that range. No actual credit eligibility or bill was inspected. CAD billing/taxes follow the selected account's prices; this is not a live USD→CAD conversion.

| Cost-bearing resource | Reference / estimate basis |
|---|---|
| Run + second-generation Functions | Usage-priced compute/requests; free allowances may apply across the billing account, not guaranteed for a new project. At small scale with min 0, idle app compute can scale down. [Cloud Run pricing](https://cloud.google.com/run/pricing). |
| One Scheduler job | US$0.10 per job per 31 days beyond the billing account's three free jobs. The five-minute frequency does not multiply the job subscription charge; executions still consume Functions/database resources. [Scheduler pricing](https://cloud.google.com/scheduler/pricing). |
| Artifact Registry | About US$0.10/GiB-month beyond the shared 0.5-GiB free allowance, plus applicable transfer/scanning. At 5 GiB, storage alone is roughly US$0.45–0.50/month depending on remaining allowance. [Artifact Registry pricing](https://cloud.google.com/artifact-registry/pricing). |
| Secret Manager | Two active secret versions; reference US$0.06/version-month beyond the six-version allowance, plus access operations. Replication/extra retained versions affect cost. [Secret Manager pricing](https://cloud.google.com/secret-manager/pricing). |
| Database, Storage, Eventarc/Pub/Sub, build and logging | Metered operations/storage/transfer/build minutes remain additional components in the envelope, not free-by-definition. Final project settings and actual tests determine the bill. No optional paid retention or scanning policy has been selected. |

OpenAI calls/credits, Apple Developer membership and any EAS cloud-build subscription/credits are **separate** and excluded. No paid API call, EAS build or billing-bearing resource was created here. Recommend reviewing a **CAD$20/month staging alert budget**, with 50/80/100% alerts, before linking billing. An alerts-only budget is not a spending cap; verify any service-specific spend-cap support separately rather than promise a global hard limit. [Budget behavior](https://docs.cloud.google.com/billing/docs/how-to/budgets). Approval of the estimate/resource plan is still required; no amount has been configured.

## Required values and secure entry

**Now:** choose a project-ID preference, the existing CAD billing account, mixed-region versus coordinated Toronto Functions, and the spending/resource plan. Email/password-only synthetic use is already decided. No need to supply an image digest, service URL or secret version before they exist.

**After approved project creation and identity verification:** register the Firebase web app and read its public client config into `SOMATA_STAGING_FIREBASE_CONFIG`; record project ID/number, database location and actual bucket in the ignored local plan. Newly allocated Run URL/image digest/identity/version metadata will be captured during setup. Do not use another project's public config or copy real accounts/data.

**Secrets:** the requested new staging project does not yet exist, so staging secret names/version metadata cannot be queried yet. No production/other-project secret payload was requested. Later, select the verified staging project in Google Cloud Console → **Secret Manager** → **Create secret** (or existing secret → **New version**):

1. `OPENAI_API_KEY`: enter a key intended for staging in the Console's secret-value input, with a separately reviewed provider budget. Never in chat, Expo, a committed file or a command argument.
2. `FITADAPT_BRIDGE_TOKEN`: generate a strong independent random value in a secure password manager and enter it directly into that Console input. Do not reuse a production or laptop-demo token.
3. Return only each secret's **name and version number**. We will verify metadata, bind the same bridge version to Run and the appropriate Functions, and verify runtime access without logging values. No rotation/destruction of any existing production secret.

Privacy/support pages are not published. `SOMATA_PRIVACY_POLICY_URL` and `SOMATA_SUPPORT_URL` remain unset; store configuration and the current full staging predeploy checks stay blocked. No placeholder/legal text was inserted. Publish genuine operator-approved HTTPS destinations before those gates; any later desire to separate backend provisioning from store-link gates needs an explicit reviewed change, not dummy URLs.

## Sign-in and retention review

Use email/password only for now. Google public client IDs are absent/placeholder in the inspected local environment, and no new staging Auth provider exists. Apple plugin/native UI exists, but stage provider registration/signing, device sign-in and provider revocation are unverified; current token exchange lacks an explicit nonce/rawNonce pair and needs a focused review before enabling it. The offline follow-up now disables Apple/Google actions for staging at UI and service boundaries without changing ordinary production availability. Do not describe either provider as configured just because a button exists.

Conservative options for separate operator review; **not adopted retention policy**:

- Unknown Storage objects/versions and ambiguous old local data: keep the current ownership-review hold/quarantine; no import or guessed deletion. For new synthetic staging, use only audited catalog assets.
- Legacy unowned AI caches: exclude the legacy writer from the new stage; do not copy caches. Any purge of existing data is a separate ownership/retention decision.
- Safety reports: keep existing deletion holds until access, retention duration, participant anonymization and exceptions are decided. Do not seed real reports or weaken rules.
- Backups/logs: decide actual durations, access and restoration safeguards; do not enable optional paid backups/PITR just for staging or erase current logs by assumption.
- Shared foods/recipient copies: retain existing attribution-only cleanup while reviewing residual personal text and recipient ownership; do not erase others' data.
- Provider grants: email/password avoids introducing new staging OAuth grants; existing linked production users still need a verified revocation design before release.
- Deletion tombstones: retain current write fences without a speculative TTL until safe removal/restore criteria are tested and approved.

## Local preparation completed and evidence

- `functions/src/describe.ts`: cleared the 17 existing lint errors by documenting intentional existing catch fallbacks, stripping cache metadata on copies rather than unused destructuring, removing one unreferenced private helper and its unrelated unused argument. No error suppression, provider choice, active endpoint behavior, target logic or deletion fence changed. Legacy endpoint remains excluded from planned staging deployment.
- AI client safety scanner now includes `.cjs` and `.mjs`, covering the newer configuration modules too.
- Added a Toronto plan-validation regression. It proves configuration compatibility only, not cloud availability/delivery.
- `npm run build` in Functions: **passed**; `env -u FIRESTORE_EMULATOR_HOST node --test test/*.test.js`: **20 passed** after lint cleanup.
- `npm run lint` in Functions: **passed, 0 errors / 88 existing warnings**. No warning suppression.
- `node --test fitness-web/functions/test/ai-client-safety.test.js`: **1 passed** after scanner extension, source check (not a new bundle scan).
- `node --test fitness-web/test/staging-preflight.test.cjs`: **5 passed**.
- Blank-template preflight: **expected fail-closed rejection**, including missing actual stage config and both required URLs.
- Unchanged mobile code retains previous **111 passing tests/typecheck and iOS/Android export evidence**; these were not rerun merely to repeat a successful result. No native/cloud pass is inferred. Rules/emulator suites were not repeated because rules/runtime handlers are unchanged apart from unreachable-code/lint cleanup in the excluded legacy endpoint.
- Read-only native workspace inspection (`xcodebuild -list -workspace Somata.xcworkspace -disableAutomaticPackageResolution`) failed exit 66 in this tool environment, with CoreSimulatorService connection failures and `Somata.xcworkspace is not a workspace file`. Existing generated native folders were not modified. This is a **tooling diagnostic, not a native build attempt or compiler failure**. Real staging native build remains gated by earlier phases/inputs; do not substitute the older Expo export.

Cloud verification: **all untested** — Auth/ownership; nutrition/AI text/photo/workout generation; FitAdapt review/accept/decline/schedule/projection; sharing; deletion/retry; negative rules; configured live policy/support destinations. Account-switch/local-storage and camera/navigation checks remain **device untested**. No stage deployed versions exist to report.

## iPhone handoff after cloud gates pass

Use two synthetic accounts in the exact signed staging build: email/password login/logout/restart; camera/library allow/deny/cancel; photo/description → review/edit → Meal Builder → explicit Log once; pending FitAdapt proposal versus accepted targets and Decline; bilateral friend consent/private/revoke; recent-auth deletion/retry preserving account B; A→B→A local records/photos/drafts isolation; genuine policy/support destinations and no checkout; staging update channel and cold restart without production fallback. Each remains untested until a recorded device result.

After real values, URL gates, backend tests and native tooling are ready, the documented native build path is `cd fitness-mobile && eas build --platform ios --profile testflight --local --output /private/tmp/somata-staging.ipa` with staging public build inputs supplied. It may need Apple/EAS authentication, signing, compatible tooling and network downloads. Do not run `eas submit` or silently switch to a paid remote build to bypass a local failure. This command was not run ahead of the required phases.
