# Checkpoint 17 — Home progress destinations

This checkpoint completes the **progress batch** of Home-linked subpages. The Home reachability audit found nine standalone destinations (over 11,000 lines before this checkpoint), plus the steps sheet, activity sheet, and nested capture/session/connection flows. They are split into task-related batches to avoid dropping behavior during a large presentation rewrite.

The five redesigned tabs, their comparison route, and default navigation remain unchanged. The three completed destinations are shared routes: their new presentation also appears when reached from the current-version Profile. No alternate data path or replacement service was introduced.

## Reachability inventory

Source: `app/design-preview/index.tsx`; cross-tab links stay in their existing tabs. A Home link to Profile does not bring every Profile-only subpage into scope.

| Home entry / route | Purpose and working actions | Existing data and states | Disposition |
| --- | --- | --- | --- |
| Explore → Insights & history; conditional Open insights → `/profile/fitadapt-insights` | Weight, energy, steps; 30/90 days; hide/show values; resolved plan decisions, retry, older-page loading, back | Auth-scoped profile, dated weight entries, dated food subscription, owner-checked Firestore history; loading, absent/insufficient records, incomplete nutrition, invalid historical targets and read failure | **Redesigned** |
| Conditional Steps history → `/profile/steps-history` | 7/30/90 days, totals/average/best/goal hits/streak, chart, latest 20 days, back | `subscribeProfile(uid)`: dated `steps`, `stepsGoal`/`stepsPerDay`; missing profile/records, recorded zero | **Redesigned** |
| Explore → Badges → `/(modals)/badges` | All category groups, unlocked/locked badges, detail/criteria, feature/unfeature, up to three featured, dismiss/back | Existing registry, badge reconciliation, account food/exercise/profile subscriptions; local unlock/featured stores; empty collection and locked state | **Redesigned**, including its detail sheet |
| Log food / Scan food / conditional Log food → `/(modals)/add-meal?date=…&tab=scan` | Search, recents, favorites, manual/describe/scan/barcode entry, portions, confirmation, batch handoff; nested `/(modals)/scan-meal` | Existing food services, camera permissions, loading/no matches/network errors; existing dated single/batch handoffs | Deferred: food-capture batch |
| Start workout → `/workouts/session?freshStart=1` | Exercise selection, sets/reps/weight, edit/remove, notes, timers, draft/resume, finish and recap | Existing session/preset/workout services; no-session/empty/pending/error states, existing PR/badge effects | Deferred: movement/logging batch, including session-linked editors and recap |
| Quick workout → `/(modals)/quick-workout` | Presets/templates, exercise selection, set editing, remove, notes, save/back | Existing profile units, account templates, `addWorkout`; existing validation/saving states | Deferred: movement/logging batch |
| Water log → `/(modals)/quick-hydration` | Five volume presets, save, haptic/toast and close | Existing UID-keyed local hydration quick logs; distinct from Nutrition's local water counter | Deferred: movement/logging batch |
| Explore → Calendar → `/(modals)/full-calendar` | Week/month/year, date movement/today, selection/details, add meal | `getCalendarRangeData`, profile subscription, local view preference; existing loading/empty rendering | Deferred: calendar batch |
| Explore → Connections → `/profile/integrations` | Connect/disconnect, manual sync, permission details, source selection, settings, `/profile/sync-history` | Existing integration snapshot/service, local/native permissions and sync status | Deferred: connections batch including sync history |
| Add steps / Set steps → Home's own modal | Validation, add/set, save, cancel | Existing account profile write services and failure alerts | Already part of the new Home; untouched under the main-tab boundary |
| Log activity → `/design-preview/workouts?activity=1` | Existing activity sheet and its logging actions | Existing workout/activity services | Deferred with movement/logging; no Workouts-only destinations redesigned |
| Alerts header, Nutrition pulse, Pending FitAdapt review | Existing `/design-preview/notifications`, `/design-preview/nutrition`, `/design-preview/profile` | Existing tab services and explicit review flow | Main tabs untouched |

## Completed compositions and action parity

- **Insights & history:** metric selector and one large measured-trend stage, compact change/recorded-day tiles, separate vertical Plan decisions timeline. Retains 30/90 range, kg/lb display, hide/show, retry, bounded older-event loading, validated target comparisons and existing back callback. Empty/single-day/error states are explicit. Pending review remains on Profile. No new rationale, historical target overlay, or forecast.
- **Steps history:** large period total, horizontally readable dated bars, wrapping summary tiles, and a daily ledger with goal rails. Retains 7/30/90 ranges, the exact original aggregate calculations/default goal, latest-20-day limit and back action. Missing records use the already-tested `recordedStepDays` helper for display and do not become generated bars. A recorded zero gets a distinct marker/label.
- **Badges:** local-collection masthead, responsive category mosaics, featured/status indicators, and a newly composed medallion detail sheet with numbered criteria. Retains the registry/category order, reconciliation engine, subscriptions, local stores, feature eligibility and three-item cap. Feature/unfeature and close retain their existing haptics. The original global BadgeCard/BadgeDetailSheet components used elsewhere are untouched.

`components/homeFlows/` contains the new presentation components. It shares the new tabs' color tokens, not the old subpage layouts. Route files retain data logic. The only root-layout change extends dark safe-area/status-bar treatment to these three paths; saved themes, navigation and authentication are unchanged. Controls are at least 47–48 points, text wraps, the badge mosaic becomes one column with large system text, and the badge sheet respects reduced motion.

## Existing limitations preserved

- Steps daily average divides by the entire selected period, including unlogged days. The default daily step goal remains 8,000 if neither legacy goal field exists. The UI now explains this. The movement streak counts positive-step days ending today, within the chosen period.
- Badge unlocks and featured IDs are **device-local, not UID-scoped**. Account subscriptions feed the existing award engine, but collection storage is not an account history. Store helpers swallow storage failures, so the UI cannot reliably distinguish storage failure from an empty collection. No migration, award-rule, notification, or store change is included.
- Insights reads `fitadaptPlans/{uid}/history` through the existing owner-checked service in pages of 20, newest first. It projects only accepted/declined/superseded status, resolution date, valid effective date and validated targets. Previous-target comparisons require an older accepted event actually loaded. No rationale/confidence/forecast is added.
- Quick hydration has a separate local store from Nutrition's water counter. Quick workout has existing timer/name persistence limitations. Calendar/connection error/back behavior also needs a careful audit in its own batch. These unrelated behaviors have not been repaired or hidden here.

## Validation

Run from `fitness-mobile/`:

```sh
pnpm run typecheck
pnpm run test
pnpm exec expo export --platform ios --output-dir /private/tmp/somata-cp17-ios
pnpm exec expo export --platform android --output-dir /private/tmp/somata-cp17-android
```

The existing mobile suite covers recorded data/missing-versus-zero, history projection/order/bounds, accepted-versus-pending targets, badge milestones and preview route mappings. No backend or route action changed; no styling snapshots were added. Final results: typecheck passed (exit 0); all 48 mobile tests passed; iOS export passed (2,992 modules); Android export passed (3,085 modules). Both exports wrote artifacts only under `/private/tmp`. Non-blocking warnings concerned stale `baseline-browser-mapping` data and `NO_COLOR`/`FORCE_COLOR`; dependencies were not changed. `git diff --check -- fitness-mobile` passed. Hash comparisons against the pre-edit snapshot confirm all five redesigned tabs, their layout and shared UI file are unchanged. Source-block comparisons confirm Steps aggregates and Insights data/paging are unchanged, as is badge business logic apart from a presentation loading flag.

## Expo Go review

For personal-account visual review, Firebase emulators are **not required**. Use the existing normal Firebase configuration and explicitly leave emulator mode off:

```sh
cd /Users/aristos/Documents/fitness-app/fitness-mobile
EXPO_PUBLIC_USE_FIREBASE_EMULATORS=false pnpm exec expo start --go --host lan --clear
```

Scan Metro's QR code in Expo Go on the same Wi-Fi. Allow local-network/firewall access for Expo/Node if prompted. Stop any older Metro process first. Sign in normally. Your personal account uses normal live data; badge featuring still writes only the existing local store. This checkpoint adds no FitAdapt acceptance action to these pages.

1. Current Home → **Design Preview · all five tabs** → redesigned **Home**. Keep **Current app** as the unchanged route back to the comparison version.
2. **Explore → Insights & history** (`/profile/fitadapt-insights`): switch Weight/Energy/Steps, 30/90 days, and hide/show. Verify figures against recorded history; a single day must not draw a trend. Switch to **Plan decisions**, inspect accepted/declined events, then load older decisions if available. Back should return to Home. Missing history must show an empty state, not a fabricated event. Error/retry requires a genuine read failure; cached Firestore data may remain visible offline.
3. **Steps history** (`/profile/steps-history`) is Home's conditional next-step link: it appears when there is no pending plan, today's food record is not empty, and today's recorded steps are below a saved step goal. Do not alter personal records just to expose it. The same shared route is reachable through redesigned **Profile → Steps history** when the Home condition does not apply. Check all three ranges, sideways chart scrolling, missing versus zero, recent days and back navigation.
4. **Explore → Badges** (`/(modals)/badges`): inspect locked and unlocked details, all criteria, feature/unfeature eligible badges, close via button/backdrop/Android back, and return to Home. The existing feature limit is three. No reset or sample unlock data is needed.
5. Repeat with large system text, screen reader and reduced motion. Verify chart labels, selector wrapping, detail-sheet scrolling and safe-area contrast. Check light saved theme as well: these redesigned pages keep the dark visual direction without changing that preference.
6. Reopen each page with an account/range that naturally has little history, if available. Account switches must not show the previous account's Insights or step data; badges intentionally remain device-local as described above.

Simulator visual verification was unavailable: `xcrun simctl list devices available` failed to connect to CoreSimulatorService; Android `adb` is absent. Expo exports validate bundling, not visual layout or live device interactions. The device checks above remain manual.

## Next Home batch

Recommended next: **food capture** (`add-meal`, `scan-meal`, linked selection/confirmation/camera and dated handoff flows). Then movement/logging, followed by Calendar and Connections. The deferred destinations remain available with their current presentation; no feature was removed to fit the completed progress batch.
