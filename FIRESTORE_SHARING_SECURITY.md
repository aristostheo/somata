# Firestore sharing security gate — 14 October 2026

**Follow-up implemented locally:** see [Safe friend-summary path](#safe-friend-summary-path) below for the new callable, explicit sharing approval, client changes and verification. The original audit below records the preceding checkpoint; its statement that no summary backend exists is now historical. Nothing has been deployed.

Implemented locally on `profile-redesign`; **nothing deployed**. No production documents were read or changed. The deployed rules were fetched read-only to verify the readiness finding. Existing working changes and debug logs were preserved.

This closes raw fitness-data exposure in the candidate rules. It does **not** implement a new friend fitness-summary backend or make Somata TestFlight-ready. Backend deployment, deletion/legal, billing, device-local account isolation and native-device checks remain separate blockers in `TESTFLIGHT_READINESS.md`.

## Findings and exact access changes

The default Firestore release in `fitness-tracker-25254` still points to ruleset `8d47f606-7605-4fd4-bc2f-de898602820e`, last updated `2026-01-14T06:43:18.826695Z`. The fetched source matches the previous readiness audit snapshot. It has the broad sharing grants and lacks the local FitAdapt guards. This is rules inspection, not a claim that production was patched or that we inspected users' records.

| Document path | Before: effective local access (also deployed unless noted) | Candidate access after this checkpoint |
|---|---|---|
| `users/{uid}` | Owner reads/writes; no friend profile read. Local rules protect four FitAdapt fields; deployed rules do not. | Owner read and ordinary profile edits retained. `activeFitAdaptTargets`, `pending`, `currentRecommendation`, `adaptationHistory` cannot be added, changed, removed, merged or deleted by clients. |
| `users/{uid}/nutritionEntries/{id}` | **Any signed-in user** could get/query complete documents, regardless of friendship, block or sharing flags. Includes macros, quantities, nested meal items and any extra stored fields, not just the names/calories promised by the UI. | Owner-only get/list/write. Accepted friends, pending/declined/blocked relationships, strangers and signed-out users cannot read raw documents, even when sharing switches are on. |
| `users/{uid}/workouts/{id}` | **Any signed-in user** could get/query full workout records: exercises, sets/reps/load, notes, session fields and extra fields. | Owner-only get/list/write. A `workoutsLogged` switch cannot grant whole-document access. |
| `users/{uid}/comments/{id}`, `reactions/{id}` | Any signed-in user could read/create; creator UID was not bound to Auth. A caller could impersonate an author. Claimed authors or owners could update/delete. No active screen was found using these services as a separately consented shared feed. | Owner-only read/write. No cross-account author or friend exception; records can refer to private meals/workouts. Existing records are retained. A shared, authorized item/feed contract is needed before enabling cross-account social content. |
| `users/{uid}/friends/{peer}` | Both participants could read/write either edge freely. Either could forge accepted state, change another participant's nickname, and overwrite relationship state. | Owner reads their own edge/list; private mirror nicknames are not readable by the peer. Paired requests, sender retry, decline/re-request, recipient-only paired acceptance/decline, own nickname/ping metadata, own block and ordinary pair removal/cancellation are supported. No self-acceptance, one-sided acceptance, accepted-to-pending reset or deletion of the other person's blocked edge. |
| `users/{uid}/notifications/{id}` | Owner reads/updates/deletes; any signed-in user could create any valid notification type with arbitrary sender data. | Owner access retained. Cross-account creation only for `friend:request`, `friend:accepted` or `ping`, with matching relationship state, authenticated sender UID, no block, allowed payload keys, server creation timestamp and unread state. Peers cannot read or edit the recipient's inbox. |
| Other `users/{uid}` subcollections | Owner-only via the existing recursive fallback, including exercise entries, weight history, health/activity, badges, blocks, templates/presets, meals/foodEntries, settings and future private data. | Same owner-only policy. The fallback explicitly excludes friends, notifications, comments and reactions so it cannot bypass their specialized rules. Unknown nested social paths are denied. |
| `profiles/{uid}` | Local: owner get only; no list/client writes. Deployed: no matching allow, so denied. | Local owner-get-only compatibility rule preserved. No cross-UID access or copying. |
| `fitadaptPlans/{uid}`, `/history/{id}` | Local: owner reads, all client writes denied. Deployed: no matching allow. | Same local server-write-only protection; accepted friends have no access. |
| `fitadaptAutoJobs/{uid}`, `aiUsageLimits/{uid}` | Server-only (explicit deny or no matching allow). | Unchanged. Admin SDK bypasses client rules; no client queue/usage bypass added. |
| `exercises`, `foodCatalog` | Intentionally public catalog reads, including signed-out clients. Exercise writes require the admin claim; valid shared food additions/updates are authenticated. | Unchanged; these are public catalogs, not a route to private user records. Do not publish personal notes/history into them. |
| `usage_scanDaily`, `overrides_scanUnlimited` | Own usage/override read; constrained owner usage writes; override writes require admin claim. | Unchanged. These legacy scan counters are distinct from the server-owned AI usage limit. |
| Unmatched top-level collections (including reports) | Denied without a matching allow. | Unchanged. No broad recursive public/friend grant added. |

The existing owner fallback still allows owner writes to their own ordinary non-social subcollections without enforcing every specialized validator. This checkpoint deliberately does not migrate schemas or break existing log formats. It cannot cross UID boundaries and does not match the root user document or top-level FitAdapt/AI collections. The four excluded social namespaces now require their dedicated rules.

## Sharing controls versus actual queries

`app/profile/friend-visibility.tsx` saves `users/{uid}.friendVisibility` via the owner profile service. Account → Friend visibility and `account/privacy` lead there. Settings' health/device permissions are separate from Firestore friend consent.

The visibility model exposes a master switch plus recent meal names/calories, daily calorie totals, macro totals, streaks, workout dates/details/PRs/volume, badges/report card, directional weight trend, steps and cardio switches. Most sensitive switches default off; several activity switches and the master default on for a loaded profile. These were **presentation preferences, not rule-enforced redaction**. Rules cannot return selected fields from a private document: [Firebase field-access documentation](https://firebase.google.com/docs/firestore/security/rules-fields).

| Query/caller audited | Source and linkage | Consequence / safe next step |
|---|---|---|
| `app/friends.tsx` profile subscriptions | Each accepted edge's `friendUid` → `subscribeProfile` → `users/{friendUid}` | Already denied by owner-only profile rules. Do not open the full document to supply sharing preferences, steps, weight or targets. |
| `app/friends.tsx` `loadMealsRange` | Reads another UID's `nutritionEntries`, then legacy `foodEntries`/`meals`, including an unbounded collection fallback after query failure | Canonical raw meal exposure is now closed; legacy paths were already owner-only. Needs a bounded redacted summary response. Query limits/date filters are not field privacy. |
| `app/friends.tsx` `loadFriendIntel` | Another UID's recent workouts and badges; calculates totals, streaks, PRs, report card and last-active information using those records and full profile | Workouts now denied; badges/profile were already denied. Do not turn permission errors into successful zero summaries. Requires a safe server summary with only enabled fields. |
| `app/friends/[id].tsx` | Route ID → full profile + `subscribeFoodsByDate(friendUid, selectedDate)` | The screen checked recent-meals visibility but displayed all macros/quantities. Raw query denied; needs a meal summary DTO without ingredients/extra fields, and independent switches enforced before returning values. |
| `app/friends/[id]/workouts.tsx` | Route ID → full profile + `subscribeWorkouts(friendUid, …)` | `workoutsLogged` previously exposed details, load, notes and template-copy inputs even with workout-details off. Needs separate consent for summary versus shareable workout details; copying a template must use only intentionally shared fields. |
| `app/friends/[id]/profile.tsx`, `progress.tsx` | Full private profile by route ID | Already denied. Weight-direction helper compares current weight with target weight, not a dated trend; a future trend must use reliable measurements and must not return raw weight/targets under a direction-only switch. |
| `friends/preview`, Profile badges/history/Calendar/Insights and shared data hooks | AuthContext/current user's UID | Owner paths stay allowed. Previewing your own profile is not evidence that friends have safe access to it. Calendar and other generic UID helpers were traced to owner callers. |
| `services/friends/friends.ts` | Caller-owned edge lists and own-edge reads; paired writes to both participants | Existing UID request/accept/decline/cancel/remove/nickname/ping actions match the tightened state transitions. A request to an email is currently used as a document UID, not safely resolved to a Firebase account; real email discovery needs a separate authenticated backend. Do not allow listing private user profiles to implement it. |
| `services/notifications.ts` `hasRecentSimilar` | Attempts another user's notification query before sending a ping/request | Was already denied; its catch continues to notification creation. No inbox read access was opened. Effective notification deduplication/rate limits need a backend, not cross-account inbox reads. |
| `services/social.ts` | Parameterized target UID comments/reactions; no active UI caller found | Previously broad access is closed. Do not re-enable until a target-level sharing authorization contract exists. |
| Web `services/profile.js`, `nutrition.js`, `workouts.js`, `presets.js` and callers | Dashboard, Home, Nutrition, Insights, Profile, Settings and `useNutritionStreams` pass authenticated `user.uid` | No current web friend-data query or sharing UI found. Same-UID canonical goals, legacy owner-reviewed import and normal data access remain. Parameterized helpers cannot bypass rules using a different UID. |

**What friends can safely see now:** their own connection row (peer UID, provided name/email, relationship status/direction/timestamps) and the intentionally sent request/accept/ping notification in their own inbox. The peer cannot read private nicknames on the mirror edge. **No positive fitness-summary read was added**, because there is no existing field-separated summary path. The tests prove that the current raw summary queries are denied; they do not pretend that a nonexistent summary endpoint works.

For a future summary service, verify caller Auth UID, both accepted edges, both blocks and the owner's saved master/individual switches on every read. Return an allowlisted, bounded response with no raw account, nutrition, weight, health or FitAdapt documents. Stop/clear subscriptions on consent changes and account changes. Existing accepted edges were writable under the old rules, so do not treat historical edges as newly verified bilateral consent without a reviewed reconfirmation strategy. No edges were migrated or deleted here. Previously downloaded data cannot be recalled by new Firestore rules.

## Changes and verification

Changed only:

- `fitness-web/firestore.rules`: owner-only raw fitness/social records, paired relationship transitions, scoped notification creation and fallback exclusions. Existing FitAdapt guards preserved.
- `fitness-web/test/firestore-sharing.emulator.cjs`: synthetic owner/friend/stranger/signed-out tests plus legitimate social actions and attack cases.
- `fitness-web/package.json`: `test:rules` now includes both `firestore-*.emulator.cjs` suites, including the existing FitAdapt rules suite.
- `fitness-mobile/services/friends/visibility.ts`: missing/loading/denied profiles return all sharing disabled. Loaded owner defaults and saved preferences are unchanged. No persisted settings changed.
- `fitness-mobile/tests/friendVisibility.test.ts`: fail-closed and loaded-owner preference tests.
- This report and a dated pointer in `TESTFLIGHT_READINESS.md`.

Validation used fresh synthetic accounts and loopback emulators for **demo-somata-fitadapt** only. The new suite refuses other host/project settings. No production credential or user data is required. Audit logs and temporary emulator config are under `/private/tmp/somata-sharing-audit`, not in the repo.

| Command | Result |
|---|---|
| `fitness-web`: `GCLOUD_PROJECT=demo-somata-fitadapt FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npm run test:rules` | **20 tests passed**, 0 failed. Includes the original 11 FitAdapt tests and 9 sharing tests (parent tests included in totals). |
| `fitness-mobile`: `npm run typecheck` | PASS |
| `fitness-mobile`: `npm test` | **65 passed**, 0 failed |
| `fitness-web`: `CI=true npm test -- --watchAll=false --runInBand` | **8 suites / 26 tests passed** |
| `fitness-web`: `npm run build` | PASS |
| `fitness-web/functions`: `npm run build` | PASS |
| Functions: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node --test test/fitadapt.test.js test/fitadapt-automatic.test.js` | **11 passed**, including emulator queue tests |
| `git diff --check` for touched tracked code | PASS |

Rules tests verify owner CRUD/normal profile edits; own connection-summary access; accepted/pending/declined/blocked/removed/nonfriend and signed-out denial of private reads; bounded and unbounded queries; author spoofing/cross-writes; sender self-accept and one-sided state changes; recipient acceptance; retry/decline/re-request/cancel/remove/block; notification author/type/payload boundaries; unchanged server-owned FitAdapt protections; and successful Admin plan/target/history writes.

During development, a new test syntax error was corrected. Adding retry support then revealed that a pending request could permit a one-sided metadata edit; requiring the paired retry's server timestamps closed it. The final suite passes. Expected permission-denied emulator diagnostics are negative-test evidence, not suppressed application errors. Existing unrelated Functions lint failures were not changed or relabeled. No Expo export or physical-device verification was needed/performed for this rules/helper change. The local live FitAdapt acceptance HTTP E2E was not rerun in this checkpoint; the rules suite exercised the trusted Admin acceptance transaction and the bridge/queue tests passed.

To reproduce without writing existing repository debug logs:

```sh
cd /Users/aristos/Documents/fitness-app
SHARING_AUDIT_DIR=$(mktemp -d /private/tmp/somata-sharing-rules.XXXXXX)
cp fitness-web/firestore.rules "$SHARING_AUDIT_DIR/firestore.rules"
cat > "$SHARING_AUDIT_DIR/firebase.json" <<'JSON'
{
  "firestore": { "rules": "firestore.rules" },
  "emulators": {
    "auth": { "host": "127.0.0.1", "port": 9099 },
    "firestore": { "host": "127.0.0.1", "port": 8080 },
    "ui": { "enabled": false }
  }
}
JSON
cd "$SHARING_AUDIT_DIR"
firebase emulators:start --project demo-somata-fitadapt --only auth,firestore
# A second terminal runs the rules command from the table above in fitness-web.
# Stop with Ctrl+C. Do not use --import/--export-on-exit with personal data.
```

## Deployment order and rollback — instructions only

1. Review this diff together with the already-uncommitted FitAdapt/root-profile guards. Before an authorized release, re-fetch and save the exact deployed ruleset/release reference and save a reviewed copy/hash of the **hardened candidate**. Do not accidentally deploy only the nutrition/workout edits while omitting existing FitAdapt protections. Verify the explicit project is `fitness-tracker-25254` and the default Firestore database is intended.
2. Rerun both emulator rules suites and app checks. Inform testers that raw friend fitness summaries/details will be unavailable until a safe read path exists. No data migration is required.
3. **Deploy hardened Firestore rules first**, only after separate authorization: from `fitness-web`, `firebase deploy --only firestore:rules --project fitness-tracker-25254`. This command was not run. There is no new Function to deploy for this checkpoint. Do not wait for a mobile update to enforce privacy.
4. With dedicated synthetic deployed test accounts, verify owner log/profile CRUD and request/accept/remove, verify accepted friends/strangers cannot fetch raw meals/workouts/private profiles/FitAdapt state, verify forged plan writes fail, and verify trusted backend writes still succeed when that backend is separately deployed. Do not test against real users' records. Monitor permission-denied errors for owner regressions.
5. Release the mobile fail-closed helper with the next reviewed app build. Old clients remain blocked by rules; a client rollback must not reopen data access. No web behavior change is required for owner queries. Deploy the AI/FitAdapt production services only under their separate rollout gate, with these protections already in place.
6. A future friend-summary release requires its own tested, authenticated backend/projection and consent strategy, then compatible clients. Never expose `users/{uid}` or raw nutrition/workout documents as a shortcut. If using a projection, deploy its narrow read/write rules before publishing records or enabling the client.

Rollback policy:

- **Do not restore the formerly deployed ruleset** listed above: it reopens signed-in nutrition/workout/social exposure and lacks FitAdapt write protection.
- If the mobile helper has a regression, roll back the client build while retaining the tightened rules. If a future summary service fails, disable/roll back that service and its UI, retain raw-record denial, and do not delete user records.
- If these rules reveal an owner-access regression, pause distribution; make the smallest owner-path correction against the saved hardened candidate, rerun both rules suites including all cross-account and FitAdapt denials, and deploy only that corrected rules file with the explicit rules-only command. Leave unsafe friend summaries unavailable during recovery. This is a fail-closed fix-forward, not a rollback to known exposure.
- After any later hardened rule revision, its rollback target is the last tested hardened candidate, with its recorded hash/release ID. Run synthetic smoke tests again after changing a release. No production rollback, mutation or migration was performed here.


## Safe friend-summary path

Implemented on `profile-redesign` without committing, publishing, deploying or accessing production user data. Existing unrelated working changes and both existing debug logs were preserved. This is a sharing-security checkpoint, **not TestFlight release approval**.

### Authorization and historical friendship consent

The former rules let either participant forge both accepted edges. Consequently, even two old accepted edges plus globally enabled settings are insufficient evidence for fitness sharing. There is no automatic migration or grandfathering of those records.

A person now explicitly opens Friends → a connection → Overview → **Allow my selected fields for this friend**, verifies the displayed UID, and confirms. This only grants the other person access to the caller's selected fields; it does not grant reciprocal access. Each person controls their own outgoing grant. Friendship request/accept/decline, nickname, remove, block and nudge actions retain their existing services.

The new server stores only `{ enabled, revision, updatedAt }` at `friendSummaryGrants/{ownerUid}/viewers/{viewerUid}`. The revision hashes both edge document creation times, request/acceptance timestamps and directions. Removing/recreating or re-requesting a relationship invalidates the old approval; changing a nickname or ping timestamp does not. Both current edges must still be accepted with matching peer UIDs, and neither user's block record may be enabled. Revocation can run even after the relationship is removed. No client can read/write these grants. No fitness records are duplicated into them.

Every summary runs in a read-only Firestore transaction that checks the current relationship, both blocks, the owner's approval, the owner profile's master switch, and each specific switch. Only literal saved `true` values count. Missing flags do not inherit the former presentation defaults. The privacy screen now shows these actual saved choices, including disabled choices for an unconfigured profile. Resetting to suggested defaults remains an explicit owner action. Owner preview bypasses the friendship/approval requirement but uses the same privacy redactor and DTO.

### Callable contract and exact returned fields

Both exports are Firebase v2 callable functions in **us-central1**, with a 30-second server/client timeout and five maximum instances. Firebase verifies the Auth token; caller identity always comes from `request.auth.uid`. No URL, provider key or new secret is needed. Unknown input keys, invalid target IDs, missing Auth and malformed dates/choices are rejected. The client cannot specify the caller/owner of an approval. Backend errors are sanitized; identifiers, payloads and source documents are not logged.

- `getFriendSummary({ friendUid, endDate? })` is read-only. `friendUid` identifies the requested subject, not the caller. Omitted date means UTC today. The mobile client sends its current local `YYYY-MM-DD`; only UTC today ± one date is allowed to accommodate timezones. The response covers that date and the preceding nine dates, newest first. It cannot request arbitrary historical windows.
- `setFriendSummarySharing({ friendUid, enabled })` grants/revokes **the authenticated caller's** outgoing approval to that friend. Returns `{ enabled }`. It changes only the server-owned consent document, never profile, goals, logs, plan state or history.

`getFriendSummary` returns exactly:

- `version: 1`, `status: "shared" | "private"`, `window: { from, to }`;
- `sharingWithFriend`: the caller's own outgoing approval state for this relationship (false for owner preview); it does not reveal the subject's private settings;
- `days`: at most ten objects with `date`, `meals`, `calories`, `macros`, `workoutCount`, `workouts`, `steps`;
- `progress`: `nutritionStreak`, `consistencyStreak`, `badgeCount`, `weightTrend`, `weeklyVolume`, `personalRecords`, `weeklyReportCard`, `cardio`.

Every metric is a discriminated section: `{ status: "shared", data }`, `{ status: "private" }`, or `{ status: "unavailable" }`. Private/unavailable sections carry **no data**. A master-disabled/unapproved response has `status: "private"`, no days, and private progress sections. Non-friends, missing/blocked/mismatched edges get `permission-denied` rather than a subject profile. Missing Auth gets `unauthenticated`; bad input gets `invalid-argument`; unexpected backend failures get `unavailable`.

| Section data | Required saved choice | Canonical account-scoped source / meaning |
|---|---|---|
| `meals: [{ name, calories }]` | `nutrition.mealsLoggedToday` | `users/{uid}/nutritionEntries`; bounded meal-name strings and each entry's calories only. No document IDs, ingredients, portions, units, notes or entry-level macros. Names/calories already imply some daily calorie information; this matches the existing Recent meals disclosure. |
| `calories: number | null` | `nutrition.dailyCaloriesTotal` | Sum of stored entry calorie totals for that date. |
| `macros: { protein, carbs, fat }`, each number or null | `nutrition.macroBreakdown` | Daily gram totals from canonical nutrition entries; no goal or target comparison. |
| `workoutCount: number` | `workouts.workoutsLogged` | Groups of recorded workouts by session ID, with the existing date-group fallback for legacy rows without session IDs. No exercise details under this switch alone. |
| `workouts: [{ title, exercises: [{ exercise, sets, reps, weightKg }] }]` | `workouts.workoutDetails` | Explicit projection of workout titles and exercise prescriptions from `users/{uid}/workouts`. Numbers may be null. Weight is the existing stored kg load. No raw document/IDs, notes, muscle metadata, timestamps, account IDs or other fields. |
| `steps: number | null` | `activity.stepCount` | `users/{uid}.steps[date]`; actual recorded zero retained, absent value null. |
| `nutritionStreak: { days, capped }` | `nutrition.streakStatus` | Consecutive dates containing nutrition logs, anchored today or yesterday, bounded to the ten-date window. `capped` means the streak reaches the start of the available window, not an invented all-time streak. |
| `consistencyStreak: { days, capped }` | `progress.consistencyStreak` | Same bounded calculation from nutrition/workout dates and positive recorded step dates. This shares only the explicitly permitted aggregate, not its private contributing records. |
| `badgeCount: number` | `progress.badgeCollection` | Count of account-scoped badge documents with numeric `earnedAt`; no badge metadata or device-local badge store. |
| `weightTrend: "up" | "down" | "steady" | null` | `progress.weightTrend` | First/last valid dated `fitadaptWeightEntries` measurements in the ten-day window. Requires two distinct dates; conflicting same-day measurements return null. Never compares current weight with a goal and never returns raw weights or weight history. |
| `weeklyVolume: number | null` | `workouts.weeklyVolume` | Recorded kg × reps × sets from Monday through the end date; no guessed duration, PR or forecast. |
| `personalRecords`, `weeklyReportCard`, `cardio` | Corresponding PR/report/cardio flag | `unavailable` when enabled, `private` otherwise. No invented payload. See limitations below. |

Nutrition, workout and weight reads each fetch at most 501 records; over 500 makes the affected section unavailable rather than returning partial totals. Badge reads cap at 101; over 100 is unavailable. No unbounded fallback queries, legacy meal collection scans, Firestore field spreads, or device-local history reads exist in this path. Missing or invalid nutrient fields propagate null for the corresponding total, rather than becoming zero. Empty log lists/counts describe the absence of records, not a claim that nothing was eaten or exercised. Titles/names are limited to 120 characters. No identity/account/health values or FitAdapt targets, recommendations, proposals, rationale or history are returned.

### Client behavior and feature coverage

- Friends list reads only the caller's own relationship edges. Opening a friend fetches the redacted summary; there are no automatic per-friend private profile subscriptions or collection scans.
- Overview, meals, workouts, shared profile and progress use one presentation component and the same callable contract. Ten-day date selection, safely shared totals/details, measured direction and steps work when approved and enabled.
- `friends/[id]`, `friends/[id]/workouts`, `/profile`, `/progress`, and `friends/preview` all use this boundary. Existing routes remain. The retired friends route already redirects to `/friends`.
- Saving a shared workout as an own template remains available only with complete explicitly shared exercise fields. It re-fetches consent/data after confirmation, aborts if the projection changed or became private, and writes only the current user's template through the existing service. Private notes and missing values are never copied/defaulted to zero.
- Owner preview now shows the actual redacted response rather than declaring flags visible without displaying their data.
- Choose shared fields closes the friend sheet before navigating to Friend visibility. Stop sharing and the master switch revoke future reads. Summaries are memory-only, cleared on blur/background/account or target changes; visible screens revalidate every 30 seconds and expose Refresh. Errors clear previously loaded summary data. Previously viewed/copied data cannot be recalled; a foreground view may retain it until its next refresh, at most 30 seconds under normal connectivity.
- No web friend UI/query exists in the current app. Web owner profile/nutrition/workout services remain unchanged and UID-scoped; all web tests/build were rerun. Do not add raw private reads if a future web friend screen is built—reuse these callables.

Remaining limitations are explicit, not synthetic successes:

- No authoritative persisted PR/report-card contract exists; the old UI's best recent workout was not proof of a new PR. These remain unavailable.
- Cardio records are timestamp-based and there is no verified account timezone/daily sharing projection. The old friend screens did not actually render a reliable cardio feed. A bounded, explicitly dated cardio summary is a follow-up.
- Badge **count** is supported from cloud records; badge showcase names/device-local collections are not reconciled into this response. No local data is uploaded.
- No member-since, last-active, current/target weight, weight-to-go, protein-goal achievement, or plan-derived score is shared: the existing controls do not authorize those exact fields or a reliable source is absent.
- UID-based requests work; safe email discovery remains a separate backend task. The pre-existing report submission path still lacks an authorized backend/rules contract. Neither private user-directory access nor broad report writes were opened here.
- Account deletion remains a release blocker; its future backend should also remove server-owned outgoing/incoming sharing grants. No deletion or migration was performed.

### Changes and local validation

New backend: `functions/src/friends/{contract,service,function}.ts`, exports in `src/index.ts`, `test/friends.test.js`, `test/friends.emulator.cjs`, `test/prepare-friends-emulators.cjs`.

New mobile: `services/friends/{summary,summaryData}.ts`, `hooks/useFriendSummary.ts`, `components/friends/SharedSummary.tsx`, `tests/friendSummary.test.ts`. The mobile service imports the backend's wire-only contract **as a type**, without bundling Admin SDK/backend implementation. Updated friend routes, privacy screen, saved-choice helper/tests. Existing social action services, FitAdapt, nutrition/workout persistence and web services were not changed.

Rules: only an explicit deny for `friendSummaryGrants/{ownerId}/viewers/{viewerId}` was added to the already hardened candidate. All raw-data denial, ordinary owner access and FitAdapt write protections remain. `firestore-sharing.emulator.cjs` additionally tests grant read/write/delete denial for owner, peer, stranger and signed-out clients.

| Command / directory | Result |
|---|---|
| Functions: `npm run build` | PASS |
| Functions: `./node_modules/.bin/eslint src/friends/*.ts` | PASS, no warnings/errors |
| Functions: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node --test test/fitadapt.test.js test/fitadapt-automatic.test.js test/ai.test.js test/ai-client-safety.test.js test/friends.test.js` | 18 passed, 0 failed |
| Functions: demo-emulator env below + `node --test test/friends.test.js test/friends.emulator.cjs` | 11 passed, 0 failed; real Auth + Functions callable HTTP + Firestore, no provider mocks required |
| Web: demo-emulator env below + `npm run test:rules` | 21 passed, 0 failed, including existing FitAdapt protections and trusted Admin writes |
| Mobile: `npm run typecheck` | PASS |
| Mobile: `npm test` | 68 passed, 0 failed |
| Web: `CI=true npm test -- --watchAll=false --runInBand` | 8 suites / 26 tests passed |
| Web: `npm run build` | PASS |
| Touched tracked code: `git diff --check` | PASS |
| Functions: `npm run lint` | Still fails: 17 existing errors in untouched `describe.ts`, 91 warnings across existing files. No new friend-file lint errors. Current predeploy hooks run install/build, not lint; this remains a reported quality issue, not a suppressed result. |

The tests verify owner preview versus approved friend, non-friend and invalid-token denial, caller-UID spoof rejection, old-edge fail-closed behavior, independent flag redaction, master/missing privacy, grant revocation, both directions of blocking, pending/removal/recreated friendship, nickname stability, field allowlists, missing versus zero, query bounds, private raw reads and protected writes denied, unchanged profile/plan state, and safe template projection. An initial badge-count test caught numeric timestamp validation using a nutrient-sized upper bound; timestamp validation was corrected and the final complete suite passes.

Everything ran against synthetic local `demo-somata-fitadapt` accounts. The fixture test refuses any other project/hosts. Emulator logs live in a temporary directory, not existing repo logs. The local emulator used host Node 25 (CLI warning: production package requests Node 20). Native-device rendering, navigation, background clearing and template-confirmation interactions still need Expo Go verification; no physical-device or production behavior is claimed. No Expo export was required/performed in this checkpoint.

Reproduce without secrets, FitAdapt or AI services:

```sh
cd /Users/aristos/Documents/fitness-app
npm run build --prefix fitness-web/functions
FRIEND_TEST_DIR="$(node fitness-web/functions/test/prepare-friends-emulators.cjs)"
cd "$FRIEND_TEST_DIR"
firebase emulators:start --project demo-somata-fitadapt --only auth,firestore,functions
```

In a second terminal:

```sh
cd /Users/aristos/Documents/fitness-app/fitness-web/functions
export GCLOUD_PROJECT=demo-somata-fitadapt
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export FUNCTIONS_EMULATOR_HOST=127.0.0.1:5001
node --test test/friends.test.js test/friends.emulator.cjs
cd ..
npm run test:rules
```

Stop the emulator with Ctrl+C to discard its synthetic in-memory data. The temporary package is explicitly test-only; never deploy it. No production secrets/configuration are copied into it. Existing local Expo Go LAN configuration can be used for manual testing; do not use personal accounts with this synthetic demo project. Manually check two synthetic accepted accounts: first private, then saved field selection + per-friend approval, individual toggles/master off, template confirmation, blocking/removal, and account switching. Verify both directions independently.

### Safe deployment order and rollback (not executed)

1. Review the complete hardened candidate plus this summary change; retain a known-good hardened rules copy/hash. Resolve remaining release gates separately. Rerun tests and verify the intended Firebase project/default database. Do not deploy from the synthetic temporary package.
2. Deploy **hardened rules first**, including existing FitAdapt protections and server-only sharing grants. This closes raw reads even for old clients. The new explicit deny adds no read grants and requires no index, migration or secret.
3. Deploy only `getFriendSummary` and `setFriendSummarySharing` from the real Functions package in `us-central1`. Existing accepted edges will remain private until owners explicitly approve sharing; do not bulk-enable grants.
4. With dedicated synthetic deployed accounts, verify callable Auth, same-owner preview, two-edge acceptance, explicit consent, individual flags, master off, revoke/block/remove/re-request and raw-record/plan denial. Confirm other existing callables still use Admin writes.
5. Release the reviewed mobile build; web requires no change for current owner-only features. Verify friend-summary routes and consent on devices before broader testing. This does not resolve unrelated TestFlight blockers.

Only after separate deployment authorization, the scoped commands from `fitness-web` would be:

```sh
firebase deploy --only firestore:rules --project fitness-tracker-25254
firebase deploy --only functions:getFriendSummary,functions:setFriendSummarySharing --project fitness-tracker-25254
```

Rollback: retain hardened rules. Roll back the new client and/or disable the summary callables if necessary; unavailable summaries are safer than restoring raw reads. Restore only a tested previous hardened rules version if a rule correction is needed. Never restore the originally exposed ruleset. Keep consent records and user fitness records intact; do not bulk-enable or delete grants as a rollback. Re-run synthetic negative-access tests after any later authorized change. **No deployment, production configuration/data change, migration, commit, push or merge occurred.**
