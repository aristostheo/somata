# Account deletion checkpoint — 14 October 2026

Release-safeguards follow-up, 17 October 2026: [In-app release blockers](IN_APP_RELEASE_BLOCKERS.md) audits remaining deletion retention/ownership gaps, adds safe hold-reason messages, disables missing-backend checkout by default, and requires operator-provided privacy-policy/support URLs for store configuration. No retention policy, production contents, provider revocation, deployment or TestFlight readiness is inferred. Historical findings below remain identified as such.

Implemented locally on `profile-redesign`; **not deployed and not a TestFlight readiness approval**. Unrelated working changes and existing debug logs were preserved. No production data, configuration, secrets, commits or pushes were changed. This inventory describes the current code, not a new inspection of production contents.

Local-storage follow-up: [Device-local account isolation](LOCAL_ACCOUNT_ISOLATION.md) now scopes new fitness records, reminders and photo files by UID and adds them to device cleanup. Existing UID stores remain compatible. Ambiguous pre-isolation records stay hidden and preserved; the historical inventory below describes why they cannot be assigned automatically. Server deletion and production retention gates are unchanged.

## User flow and trusted contract

Mobile: **Profile → Account → Delete account** (`/account/delete`). Verify the current password, or reauthenticate with the linked Google/Apple provider where configured; type `DELETE`; then confirm the destructive dialog. Cancellation before the final confirmation makes no deletion call. Duplicate deletion taps are locked while the request runs. A partially completed deletion cannot be undone by navigating away.

`deleteSomataAccount` is an authenticated Firebase callable in `us-central1`, with a 540-second timeout. Its only request field is `{ confirmation: "DELETE_MY_ACCOUNT" }`; success is `{ status: "deleted" }`. The server derives the UID from verified Firebase authentication, rejects additional fields (including a supplied UID), rejects anonymous authentication, and requires `auth_time` within five minutes. An unusual imported UID or incompatible deletion-state version requires ownership review rather than unsafe path matching.

The client never deletes server-owned data. Admin SDK performs cleanup using the project's default Firestore, Auth and Storage configuration. No new secret or client-provided bucket/project is used. Requests and personal records are not logged by this operation. Safe error codes distinguish confirmation, reauthentication, ownership/storage/retention review, a concurrent deletion, and retryable cleanup failure.

## Audited data map

| Data / actual path | Treatment |
|---|---|
| `users/{uid}` and **all nested descendants** | Recursive deletion: profile/identity fields, saved goals and accepted target projection, nutrition/exercise/workout records, dated FitAdapt weights, activity/steps, notifications, friends/blocks, routines/templates, badges, meal presets, food history and any deeper descendants. Parent absence does not hide orphaned subcollections. |
| Legacy `profiles/{uid}` and descendants | Recursive deletion for this exact Firebase UID only. |
| `fitadaptPlans/{uid}` and descendants | Delete current recommendation, pending proposal and evaluation snapshots, proposal outcomes and adaptation history. No client write permission added. |
| `fitadaptAutoJobs/{uid}` | Delete reassessment queue state; guarded triggers/workers cannot recreate it after deletion starts. |
| `aiUsageLimits/{uid}`, `aiSuggestions/{uid}`, `aiMacroCompletion/{uid}`, `aiMealV2/{uid}` and descendants | Recursive deletion of owned limits and generated/cached results. |
| `aiQuota/{uid}_YYYY-MM-DD` with audited optional `_meals`, `_macro_completion`, `_mealv2` suffixes; `aiRate/{uid}_mealv2`, `{uid}_scanmealv1` | Delete exact audited key formats, not arbitrary UID-prefix matches. |
| `usage_scanDaily/{uid}_YYYY-MM-DD`, `overrides_scanUnlimited/{uid}` | Delete exact dated keys with matching stored UID, and the exact override root. |
| `friendSummaryGrants/{uid}` and foreign `friendSummaryGrants/{owner}/viewers/{uid}` | Delete outgoing and incoming summary consent records. |
| Other users' `friends` / `blocks` | Delete edges whose document ID or audited friend/target UID points to the deleted account. Preserve unrelated edges. |
| Other users' `notifications` | Delete app-created references with `data.fromUid` or `data.friendUid` matching the deleted UID. |
| Other users' `comments` / `reactions` | Delete records whose `createdByUid` matches. |
| Other users' `routines` | Remove only `fromFriendUid` attribution. Preserve their own saved routine content. Manually saved copies cannot be identified or recalled as the deleted user's property. |
| Shared `foodCatalog` | Remove matching `submitterUid`; retain the public food record and other users' references. `barcodeIndex` has no user ownership. Public exercise assets/catalog remain. |
| `reports` with `reporterUid` or `targetUid` | **Pause before deletion** for an explicit safety-record retention decision. Do not silently delete another person's report or retain it while claiming complete deletion. |
| Global `aiMealIdeas`, `aiExerciseEstimates` | **Pause if either contains records.** These legacy hash-keyed caches have no attributable UID and can contain personal prompt/profile-derived content (exercise cache payload includes text and demographic/body-value buckets). Cannot safely identify one user's records. Operator must decide how to retire/reconcile them; this checkpoint does not purge them or change recommendation/generation behavior. |
| Default Storage bucket | Current mobile/web code has no cloud user-upload operation. Progress photos are local files; profile photo URLs are not proof of Storage ownership. Only audited shared assets `public/exercises.seed.json` and `exercises/{id}/demo.gif`, without owner-like metadata, pass inventory. Any unknown object or owner metadata **pauses deletion**, never guesses ownership from a URL/path. Other buckets, object versions and external URLs need an operator inventory if used outside current code. |
| Current-device account-scoped AsyncStorage | After server success, remove the exact account namespaces enumerated in `services/account/deletionData.ts`: account privacy, Body Twin, meal-builder presets/drafts and handoffs, setup drafts, scan quota/override, workout seeds/recaps, hydration quick logs; remove setup-pending marker only if its value identifies this UID. Then sign out. No blanket AsyncStorage clear. |
| Legacy device-only, unscoped records | Body/history, progress-photo files, check-ins, some badges/reminders, integration caches and other global caches cannot be assigned safely to one account. They are explicitly disclosed and **not automatically erased**. A separate account-isolation/device-cleanup policy is required. Other devices cannot be remotely wiped by this operation. |
| `accountDeletions/{uid}` | Retain a server-only technical tombstone: schema version, status, phase and timestamps, with cursor/lease while running. No profile, email, password or fitness payload. Required to fence stale tokens and delayed writers; no speculative expiry added. Retention/removal requires an explicit policy. |

Auth account removal does not delete Apple/Google accounts, revoke external provider authorization, delete Apple Health records, or erase provider logs/backups. No existing server-side Apple revocation-token management was found; provider revocation remains a separate release dependency. No implemented billing subscription cancellation operation was found to attach to deletion. Do not claim purchases are cancelled by this flow.

## Sequence, ownership and retries

1. Validate authentication, exact confirmation, UID, recent sign-in and existing Auth account. Check retention and Storage gates **before freezing a previously active account**.
2. Create/resume `accountDeletions/{uid}` with a ten-minute exclusive lease. Its existence freezes the account's Firestore client access. Clients cannot read or write this marker.
3. Recheck policy gates after the freeze. Scan foreign references in bounded 100-record pages; re-read each affected record transactionally before changing it. Persist the phase and cursor. The scans currently traverse collection groups, so total work depends on collection size.
4. Recursively delete exact owned roots using Admin SDK. Remove Auth **only after every preceding cleanup step succeeds**.
5. Mark completion, retain the tombstone, acknowledge success; the phone removes its known owned caches and signs out.

Failures preserve phase/cursor and the freeze; they do not recreate erased data. Retrying after fresh authentication repeats safe operations or resumes at the saved page. A caught failure releases the lease; a crashed invocation can be retried after its ten-minute lease expires. The handler stops between work units after a seven-minute budget; a long recursive deletion can hit the platform timeout and be retried. Concurrent calls are rejected while leased. Auth `user-not-found` is idempotent; a lost response after Auth deletion can be acknowledged from the last phase using a still-valid token without another destructive operation. Expired/revoked tokens cannot recover that acknowledgment; device cleanup may then require manual local recovery.

Firestore rules prevent other active clients from adding the audited references to a deleting account. Existing protected FitAdapt rules remain intact. AI quota/history writers, legacy `describe` cache writes, FitAdapt plan transactions, automatic queue transactions and friend-summary consent writes now check the marker transactionally before writes. The currently unexported food-history trigger is guarded too. These guards must ship with the endpoint; deploying only the deletion function leaves races with old writers.

## Validation performed

All emulator data was synthetic and confined to `demo-somata-fitadapt`. No paid provider call or production deletion was made.

| Directory / exact command | Result |
|---|---|
| `fitness-web/functions`: `npm run build` | PASS |
| Functions: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node --test test/*.test.js` | **20 passed, 0 failed**; includes deletion boundary/storage unit tests, AI, FitAdapt and friends. |
| Functions, emulator environment below: `node --test test/account-deletion.emulator.cjs test/friends.emulator.cjs` | **19 passed, 0 failed**; real Auth/Firestore/Storage/Functions, including the actual deletion callable and existing redacted friend callable. |
| `fitness-web`, same environment: `npm run test:rules` | **25 passed, 0 failed**; owner access, frozen-account restrictions, cross-account denial, ordinary other-owner edits, protected targets/plans/history and new-reference denial. |
| `fitness-mobile`: `npm run typecheck` | PASS |
| `fitness-mobile`: `npm test` | **70 passed, 0 failed**; account-owned local-key cleanup and actionable deletion errors included. |
| `fitness-web`: `CI=true npm test -- --watchAll=false --runInBand` | **8 suites, 26 tests passed** |
| Functions: `./node_modules/.bin/eslint src/account/*.ts` | PASS |
| Functions: `npm run lint` | **FAIL: existing 17 errors / 91 warnings.** Existing errors in `describe.ts` were not suppressed or repaired. That file is touched only for deletion fences. |
| Root: `git diff --check` | PASS |

Deletion coverage includes missing/invalid auth, stale/future/anonymous auth, client UID spoofing, missing confirmation, unknown Storage objects, legacy-cache/safety holds, full nested cleanup, another user's untouched Auth/profile/meal records, attribution-only anonymization, concurrent calls, injected interruption after partial cleanup, retry through the real callable, failed Auth deletion and lost final acknowledgment. Late queue/history writes are rejected. Storage clients cannot upload arbitrary personal files under the candidate rules. Injected failures and clock manipulation occur in dependency-injected service tests, not a public test endpoint.

No physical-device verification was performed. Password/social reauthentication UI, cancellation, final dialog, long-running request/retry, local sign-out, camera/photo remnants and large-text presentation still need a device check. Google/Apple require a correctly configured native build. This checkpoint did not rerun native exports or claim provider authorization revocation works.

### Reproduce locally

From the repository root, with the relevant ports free:

```sh
npm run build --prefix fitness-web/functions
deletion_test_dir="$(node fitness-web/functions/test/prepare-deletion-emulators.cjs)"
cd "$deletion_test_dir"
firebase emulators:start --project demo-somata-fitadapt --only auth,firestore,functions,storage
```

The preparer stages compiled real account/friend handlers and candidate rules in a temporary directory, without local secrets or production configuration. **Never deploy this temporary directory.** It binds loopback only, not phone LAN. In another terminal:

```sh
cd /Users/aristos/Documents/fitness-app
export GCLOUD_PROJECT=demo-somata-fitadapt
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export FUNCTIONS_EMULATOR_HOST=127.0.0.1:5001
export STORAGE_EMULATOR_HOST=http://127.0.0.1:9199
cd fitness-web/functions
node --test test/account-deletion.emulator.cjs test/friends.emulator.cjs
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node --test test/*.test.js
cd ..
npm run test:rules
```

Tests refuse non-demo/non-loopback emulator targets. They seed unique synthetic accounts. Stop the temporary emulators with Ctrl-C; do not export their data. Discard the printed temporary directory when finished. Existing repo emulator environment/secret files are untouched.

## Required rollout and retention decisions — instructions only

1. Operator inventories actual production legacy caches, reports, buckets/versions, logs and backups, and decides their retention/deletion policy. Resolve unattributable data before promising complete deletion. Agree public contributed-food retention, independently saved copies, local-device account isolation, tombstone retention and provider revocation. Supply actual privacy-policy/support destinations; this document is not legal wording and supplies no invented URL.
2. Review/deploy the tightened Firestore rules and the **candidate** `fitness-web/storage.rules`. Storage rules allow public exercise asset reads and deny client writes; Admin asset tools are unaffected. This file is intentionally **not bound in the current `firebase.json`**, which was not changed. Review existing deployed bucket use before adding that binding in a separately authorized rollout. Unknown deployed Storage write access must be closed before enabling deletion.
3. Deploy all guarded backend writers together, with Admin permissions for Firestore recursive deletion, Auth deletion and bucket inventory. Wait for old unguarded invocations/revisions to drain. Do not deploy only `deleteSomataAccount` ahead of these protections.
4. Enable/deploy the deletion callable; verify the complete flow with a synthetic account, including denial of post-deletion writes and preservation of a separate account. Then distribute the client with the entry point. Do not direct real users to a missing endpoint or an unreviewed retention gate.
5. If rollback is needed, disable the deletion entry point/endpoint while keeping protective rules, writer guards and deletion markers. Fix forward and resume interrupted jobs. Never delete markers to “unlock” a half-deleted account or restore broad access rules. Erased data cannot be restored by rolling back application code.

**Remaining blockers:** unknown production contents and policies, unscoped device data, provider revocation/native checks, and the independent backend, purchase, legal and signing blockers in `TESTFLIGHT_READINESS.md`. A passing synthetic cleanup does not resolve those release gates.
