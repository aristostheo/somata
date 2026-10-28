# Device-local account isolation — 14 October 2026

Implemented locally on `profile-redesign`. **Not a TestFlight readiness approval.** No deployment, commit, push, merge, production configuration change, or production data operation was performed. Existing unrelated changes and debug logs were preserved. This audits the mobile code used by the five tabs and their subpages, including compatibility stores; it does not inspect personal devices or infer ownership of installed legacy records.

## Account boundary

New account-owned stores use `@somata:account-local:v1:${encodeURIComponent(uid)}:${encodeURIComponent(oldKey)}`. In the tables below, **S(key)** means that exact format. Existing correctly UID-keyed stores retain their existing keys and data; there is no bulk rekeying or first-login adoption.

`services/local/accountStoreCore.ts` implements the testable storage boundary. `accountStore.ts` binds it to Firebase's current UID and a session generation. Screens/hooks capture their binding once per mounted account; services receive that binding through asynchronous operations. Reads verify ownership again after native I/O; writes capture their destination before native I/O. Old callbacks are invalid after sign-out or A → B → A, rather than silently saving into whichever account happens to be signed in later.

`AuthContext` unmounts the account subtree during transitions and prepares the next account before exposing it. Settings, tab state, sheets, form drafts and subscriptions remount for the new UID. Navigation returns to Home/login before it is visible/interactive, discarding the prior account's subpage parameters from the active entry. The initial remember-me check still runs only once per app process, so a new login with remember-me off is not immediately signed out.

OS-delivered and scheduled notifications are cleared at startup/account transitions, then the active account's saved settings reschedule its reminders. Preparation is serialized and fails closed with a retry action if native cleanup or migration fails. New local notifications carry `ownerUid`; foreground display and notification navigation reject missing/wrong owners. A scheduling operation finishing after a switch cancels its own newly created request. Other accounts' saved preferences are retained. This changes delivery cleanup at account boundaries, not reminder timing or goal calculations.

## Store inventory and changes

| Previous/current logical key | Data | Screens/readers/writers | Current handling |
|---|---|---|---|
| `@body_metrics:v1` | Latest body measurements and target weight | Body Metrics, Goal Setup, Trends, Long-term Progress, Apple Health sync via `services/profile/bodyMetrics.ts` | S(key); ambiguous old value never loaded |
| `@body_metrics_history:v1` | Dated weight/waist/body-fat points | Body Metrics, Home-linked Calendar/Insights/Advanced Metrics/Long-term Progress, progress-photo weight metadata | S(key); all consumers share the scoped service |
| `@body_metrics:unit:v2` | Body editor's unit selection | Body Metrics modal | S(key) |
| `bodyTwin:v1` | Legacy Body Twin consent, avatar, measurements, achievements | `hooks/useBodyTwins.ts`, Body Twin consumers | S(key); no old consent/measurements carried to another account |
| `progress_photos` | Image URIs, dates, weight, notes | Progress Photos, latest/first-photo service consumers | S(key); new files copied to an app-owned UID directory |
| `progress_photos_privacy_seen` | Privacy notice acknowledgment | Progress Photos | S(key) |
| `weekly_checkins_v1` | Energy, mood, body notes and weekly observations | Weekly Check-in, Long-term Progress/check-in service consumers | S(key) |
| `weekly_checkin_reminders_v1` | Legacy reminder preference flags | Weekly Check-in helper | S(key); helper itself does not schedule native reminders |
| `@water:${date}` | Dated hydration total | Nutrition, Calendar, weekly consistency, Advanced Metrics, Insights & Progress; excluded legacy Nutrition component also updated | S(key); one shared key format for writers/readers |
| `spark_history` | Generated workout plans with their context/history | Coach Spark | S(key); generated results retain their originating screen's binding |
| `integrations:v2` | Connection choices, sync settings/history, cached health values and token hints | Integrations, Sync History, Settings, Coach Spark, Calendar/progress readers; integration auto-sync | S(key); listeners and async sync use the captured owner; new accounts start with no inherited connection state |
| `badges.unlocks.v1`, `badges.progress.v1`, `badges.featured.v1` | Badge progress, unlocks and featured selection | Badges/Profile, workout badge engine/reconciliation, badge hooks | S(key) |
| `@badges_dirty` | Badge refresh marker | Meal confirmation/scan flows | S(key) |
| `exercises:favorites:v1`, `exercises:recents:v1` | Saved and recently used exercise IDs | Browse, workout flows via exercise store | S(key) |
| `exercise_search_recent_v1` | Recent exercise searches | Workout Exercise Search sheet | S(key) |
| `session:browsePick` | Selected exercise handoff | Browse → Workout Session | S(key), same bound owner on both sides |
| `@barcode_cache_v1` | Resolved food/product lookups, which can reveal scan history | Add Meal barcode flow | S(key); old cache not adopted |
| `notification_settings` | Enabled reminders, times and alert preferences | Settings, Alerts/notification triggers, app entry | S(key) |
| `scheduled_notification_ids_v1` | Logical reminder → native request IDs | Notification service | S(key); old OS delivery is cancelled without deleting legacy preferences |
| `notif:friend_ping:${name}`, `notif:goal:${type}:${date}`, `notif:pr:${exercise}:${weight}:${date}`, `notif:badge:${name}`, `notif:weekly_checkin:${week}` | Account-sensitive cooldown/history markers | Notification trigger service, Alerts, workout completion | S(key) |
| `settings:v1` | Legacy settings context including workout preferences/unit override | `SettingsContext`, workout/settings consumers | S(key); provider remounts per account, debounce cancelled on unmount |
| Keys passed to `useSettingBool` / `useSettingString` | Compatibility settings hooks | `services/settings/settingsStore.ts`; no current active call sites found | S(key); no anonymous writes |
| `nutrition:day:${date}` | Old local day/meal/goal record | Excluded `components/nutrition/new(ALL NOT USED)/nutritionStore.ts` | Scoped compatibility API; not enabled as a new target source or route |
| `workout:draft:${uid}` | In-progress workout | Workout Session / `sessionDraft.ts` | Existing UID key retained; absent UID no longer reads/writes `workout:draft:anon`; deletion now includes it |
| `workout:templateSeed:${uid}`, `workout:referenceSeed:${uid}`, `workout:recap:${uid}:${session}` | Session/template handoffs, reference sets, recap answers | Workouts, Quick Strength/Cardio/Mobility, Coach Spark, Templates, Session Detail/Session/Recap | Existing UID keys retained; deletion includes reference seed and recap prefix |
| `@body_twin_v1:${uid}` | Newer Body Twin state containing UID | New Body Twin store / consumers | Already scoped, retained in place |
| `hydration:quickLogs:${uid}` | Timestamped quick hydration records | Quick Hydration, Insights & Progress, Advanced Metrics | Already scoped, retained; no change to existing hydration reconciliation/calculation |
| `@meal_builder_presets:${uid}` | Saved meal presets | Meal Builder | Already scoped, retained |
| `@scan_quota_v2:${uid}:${date}`, `@scan_unlimited_v2:${uid}` | Scan counters/entitlement cache | Meal Scan quota service | Already scoped, retained |
| `@acct_center_privacy_v1:${uid}` | Legacy account privacy choices | Account center settings service | Existing UID key retained; missing UID cannot read/write a shared `guest` fallback |
| `@somata:fitadapt-setup-draft:v1:${uid}` | Onboarding/completion form | FitAdapt Setup | Already scoped, retained |
| `@pending_add_meal:${uid}`, `@pending_add_meal_batch_v1:${uid}`, `@pending_meal_builder_log_v1:${uid}` | Confirmed meal deliveries with `ownerUid` and `deliveryId` | Add/Quick Add/Scan/Meal Builder → Nutrition | Existing scoped queue retained; producer now requires captured account binding, consumer lock is per UID |
| Previously global `@pending_meal_builder_additions_v1` | Compatibility scan-to-builder additions | Scan/Add/Quick Add compatibility return path | Now `${key}:${uid}`, explicit owner envelope retained. Unknown queue keys rejected. The follow-up [scan-to-builder repair](MEAL_BUILDER_HANDOFF.md) adds a focus-time reader bound to the current account and mounted builder session. Expired/invalid owned transfers are cleared; unknown ownership stays isolated. |

Every newly scoped store is covered by deletion's namespace selection. No record arrays or field formats were reinterpreted, no units changed, and no fitness/target calculations or FitAdapt behavior changed.

### Stores deliberately remaining device-wide

- `@theme:mode`, `@theme:primary`, `@theme:accent`, per-mode primary/accent/gradient keys and legacy `settings.themeMode`: device appearance, managed by the unchanged ThemeProvider/theme persistence. Existing saved palettes remain available.
- `account.reduceMotion`, `account.haptics`: device accessibility/interaction choices, not fitness records.
- `@calendar:view:v2`: calendar presentation mode only.
- `@rememberMe`: device startup-session preference only.
- `@somata:fitadapt-setup-pending:v1`: existing **pre-auth bootstrap marker**, containing `uid:…`, `email:…` or `social`; no measurements or goals. Existing matching logic remains. UID draft data is separate. This is not a reliable owner proof for unrelated legacy history and is never used as one. Deletion removes a marker only when it names the deleted UID.
- Firebase SDK authentication persistence is managed by Firebase sign-out; do not blanket-clear its keys. Firestore is initialized through the existing SDK; no new persistent client database/cache was enabled. Cloud data paths retain their UID ownership/rules.
- Public bundled exercise/catalog assets are not user history. Calendar's module cache is already keyed by UID/date/targets; access now also checks the captured UID before returning cached data. In-memory integration subscriptions and UI state cannot publish into a different mounted account. Nutrition's in-flight delivery lock is now keyed by UID.

## Migration and quarantined legacy data

There is **no “first account to log in owns all old records” rule**. An unscoped body measurement, photo, check-in, badge, integration snapshot, search history or preference has no verified Firebase owner. The old key/file stays untouched but has no account-view read fallback. “Quarantined” here means excluded from app reads, not moved, encrypted, or erased. Even a returning original owner cannot automatically recover these records without trustworthy provenance; apparent dates, email matches, similar weights and the currently signed-in user do not establish it.

Existing UID-keyed stores are preserved in place, so their established owner continues using them without a migration. The one attributable unscoped format supported by migration is a confirmed nutrition handoff with **both exact `ownerUid` and a valid existing `deliveryId`**. On account preparation, only that UID may copy it to the corresponding UID key. An existing different payload is never overwritten. The original is removed only after successful copy and a same-value check. A copy/remove interruption is idempotent and retains the delivery ID; ambiguous/malformed/conflicting data remains isolated. No meal is logged by migration itself.

The old `workout:draft:anon` and `@acct_center_privacy_v1:guest` fallbacks are not adopted. Original progress-photo/cache files without proven ownership are not deleted. The OS may independently evict cache files; this checkpoint cannot guarantee indefinite recovery of old cache URIs. A separate, explicit recovery/retention policy is needed before exposing or destroying ambiguous records.

## Deletion and files

After confirmed server deletion, the app freezes the new local storage boundary for that UID, drains its in-flight scoped writes, removes the exact owned photo directory, and deletes both the new namespace and audited existing UID keys. Another account's keys, files and preferences remain. Device theme/accessibility choices and quarantined legacy keys remain. Failed device cleanup can be retried through the existing deletion screen; no blanket `AsyncStorage.clear()` or arbitrary URI deletion was added.

New progress photos live under `documentDirectory/somata-account-photos/<hex-encoded UID>/`. Every UTF-16 code unit is encoded, so imported UID punctuation cannot become directory traversal. Only app-created photos within that exact directory can be removed. Generated image-manipulator temporary output is removed after copying. This does not delete the user's original Photos-library image or unknown image-picker/OS caches. Other installations/devices cannot be remotely wiped.

October 26 photo-path repair: new journal records store the owner-relative file path. Reads resolve both these references and older absolute paths against the current document directory, but only for the exact UID folder and a validated JPG filename. Reads never scan another account, adopt unscoped/cache records, or rewrite/delete a missing record. File existence is checked, and the journal retains captions/dates with an unavailable-image state if the file cannot be read. Explicit deletion resolves verified owned files in the current directory; ambiguous files remain untouched. This fixes a code-level failure to resolve paths after an app-container change, not proof that a particular phone's missing image still exists. Older cache-only photos can have been evicted and require reselection from the original library. This collection has no Firebase/Storage upload or cloud recovery path.

Photo-path validation: `node --import tsx --test tests/accountLocalStorage.test.ts tests/progressPhotoStorage.test.ts` passed 19 tests; the photo cases in `tests/profileFamilyPresentation.test.ts` passed 2 UI/action tests. These use synthetic/in-memory file data and offline rendering, not personal-device inspection.

Added `expo-file-system ~57.0.7` as an explicit mobile dependency for this owned-file lifecycle; this exact version was already present transitively. The lockfile change only adds that dependency to the mobile importer. No provider credentials or environment configuration changed.

## Verification

Commands from the repository root unless noted:

```sh
npm run typecheck --prefix fitness-mobile
npm test --prefix fitness-mobile
cd fitness-mobile
CI=1 EXPO_PUBLIC_USE_FIREBASE_EMULATORS=false npx expo export --platform all --max-workers 2 --output-dir /private/tmp/somata-local-isolation-export
```

- Mobile typecheck: PASS.
- Mobile tests: **84 passed, 0 failed** (70 previous tests plus 13 account-isolation tests and one cross-account delivery-lock regression).
- iOS and Android Expo exports: PASS. These are JavaScript/native-module bundle resolution checks, not a signed build or a physical-device test.
- `git diff --check`: PASS.
- `pnpm --filter fitness-mobile add expo-file-system@~57.0.7 --offline`: completed without downloads. Existing Node-engine/peer/deprecation warnings remain; they were not suppressed.

Tests cover A/B/return-to-A, signed-out access denial, stale callbacks, reads and writes spanning a switch, ambiguous legacy preservation, exact-owner migration, invalid ownership, destination conflicts, interrupted copy/removal retry, migration during account switch, deletion selection, photo path isolation, draining writes before cleanup, notification owner filtering, and independent account delivery locks. Core storage/native-driver effects use in-memory fakes; actual OS notification cancellation, filesystem operations and navigation on a phone are **not claimed tested**. No emulator or production account/data was needed for these local-only tests. Backend/rules files were not changed, so their suites were not rerun for this checkpoint.

### Manual device check still required

Use two synthetic accounts on the same installation (prefer the existing emulator setup):

1. Account A: add body history, hydration, a check-in, photo, exercise favorite/recent, workout draft, and a reminder preference. Open the related Home, Workouts, Nutrition, Alerts and Profile subpages.
2. Sign out from a subpage. Verify login reveals no old screen or notification. Sign into B: those local records and connection choices must be empty/default, with no A photo, notes, badge state or pending draft visible. Verify prior notifications are gone.
3. Add distinct B records. Sign out/in to A: A's scoped data returns, and B's remains separate. Start a slow scan/sync before switching and verify it cannot populate B.
4. Enable reminders separately in each account; verify only the current account's reminders are delivered. Check cold start, cancellation failures/retry and a notification tapped after a switch on both platforms.
5. Delete A **only in the synthetic emulator environment**. Confirm A's new scoped records/photo files disappear, B's data remains, and legacy quarantine/device appearance stays unchanged. Confirm returning to login works even with remember-me off.
6. Seed ambiguous old keys only on a disposable test installation: no account should see them. Explicit-owner handoffs should migrate for their owner only; conflicting destinations must remain unchanged.

Do not use a personal account to test destructive deletion. Native camera/photo permissions, Google/Apple sign-in, background delivery and large-text UI still require device verification.

## Remaining limitations

Ambiguous legacy fitness data remains physically unscoped but inaccessible through account views. There is no owner-recovery UI or guessed migration. The compatibility scan-to-Meal-Builder queue reader was subsequently restored; see [handoff verification](MEAL_BUILDER_HANDOFF.md) for session/expiry checks, tests and device limitations. The pre-auth onboarding marker and non-fitness device preferences remain global as listed. External health-provider data, Photos-library originals, OS backups/notifications delivered before this updated app first opens, and another device's storage cannot be retroactively erased by this checkpoint. Operator retention/recovery decisions and all independent blockers in `TESTFLIGHT_READINESS.md` remain.
