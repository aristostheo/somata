# Somata — streamlined premium redesign roadmap

**Roadmap consolidation only · 2026-10-19 · `profile-redesign`. Implementation has not started.**

This is the current execution plan: **six major checkpoints**, with one family-level review at the end of each. Internal implementation order and focused tests do not create additional approval gates. Complete and refine the assigned family autonomously; do not stop for approval after individual screens.

The [screen registry](SOMATA_SCREEN_REGISTRY.md) remains the exact coverage and per-surface verification ledger. The [component plan](SOMATA_COMPONENT_PLAN.md) remains the foundation and functional-protection reference. Both are preserved byte-for-byte. Their older checkpoint labels are historical references: use the crosswalk below for execution. This roadmap supersedes the earlier 28-stage scheduling and individual-stage review cadence, not the registry's requirements.

The original plan is preserved byte-for-byte as [SOMATA_REDESIGN_ROADMAP_ARCHIVE_8A_28_STAGES.md](SOMATA_REDESIGN_ROADMAP_ARCHIVE_8A_28_STAGES.md). Do not implement from that archive's schedule.

## Six-checkpoint coverage and crosswalk

| Checkpoint | Full assigned family | Registry IDs (primary responsibility) | Surfaces | Former stages |
|---|---|---|---:|---|
| 8B | Shared Foundation + Home Utilities | T03, T01, O01, O18 | 4 | 8B, 8C |
| 9 | Nutrition Subpages | N01, N02, O04, O05, O06, O07, N03, N04, O09, O10, O11, N05, O08, N07, N06, N08, N09 | 17 | 9A, 9B, 9C, 9D, 9E |
| 10 | Workouts Subpages | W01, O37, O38, W02, W03, W04, W10, O15, O17, W07, W08, W09, O35, O36, W05, O02, O03, W06, O16, W11, W12, W13 | 22 | 10A, 10B, 10C, 10D, 10E, 10F |
| 11 | Profile, FitAdapt and Progress | P01, P02, O29, P03, P04, O12, O13, O14, P05, P06, O20, O21, O22, O23, P07, P08, P09, O19, O26, O27, O28, P10, P11 | 23 | 11A, 11B, 11C, 11D, 11E, 11F, 11G |
| 12 | Social, Settings and Account | S01, O30, O31, O32, O33, S02, S03, S04, S05, S06, S07, O25, T02, T04, O24, O34, T05, T06, T08, T09, T07 | 21 | 12A, 12B, 12C, 13A, 13B, 13C, 13D |
| 13 | Final App-Wide QA | H01, W00, N00, L00, P00, A01, A02, A03, T10, G01, G02 | 11 | 14A |

**Coverage: 98/98 surfaces, each assigned once** — 58 unique route-backed surfaces, 38 nested sheets/dialogs and two global gates. The 59 implemented route files include two wrappers grouped under S02. Another 24 routing-only entries and six navigation layouts are verified in Checkpoint 13; they do not inflate the 98-surface total.

Checkpoints 8B–12 own 87 secondary surfaces. Checkpoint 13 owns the remaining 11 verification surfaces (five approved tabs, three previously branded auth screens, unknown-route recovery and two gates) **and re-verifies all 98**, including completed families. Shared components are reused across checkpoints, not counted as extra screens.

The existing paywall/access-availability page T09 is included in Checkpoint 12, so consolidation does not omit it or imply a new commerce backend. Direct-link-only N09/W11–W13 and the S02/S03 standalone summary wrappers remain assigned. No feature is promoted, removed or hidden to reduce the inventory.

## Execution rules for every checkpoint

1. Recheck branch/worktree and inspect all assigned route bodies, nested UI and current actions before editing. Preserve unrelated changes and approved artwork; no commits, pushes, merges or deployment.
2. Use the five approved tabs as the visual authority. Reuse the existing semantic ThemeProvider and premium recipes. Keep saved user light/dark palettes and theme draft/commit behavior intact; do not introduce competing stored theme state.
3. Implement the entire family with task-appropriate layouts. Major workflows get purposeful compositions; simple forms/dialogs share premium controls. An orange border around a former layout is not completion.
4. Keep controllers, calculations, subscriptions, storage, permissions, route parameters, ownership and action callbacks unchanged. FitAdapt pending proposals remain separate; acceptance/decline stays explicit. No sample data or mock provider output enters production.
5. Work in a useful internal order and run focused regression tests when affected boundaries change. Internally review and refine layouts before returning. Do not ask the user to approve each screen, sheet or internal batch.
6. Before completing a checkpoint, run full TypeScript, the mobile test suite and **both iOS and Android Expo exports**. Run the full gates once on the final implementation; rerun only checks affected by later changes or unresolved failures. Do not repeatedly run exports after every form.
7. Produce representative dark/light previews and important state captures, plus a per-ID completion/evidence index covering every assigned surface. Retain the registry's V0 and specific verification requirements even when representative capture is shared.
8. Return one review package for the whole checkpoint. Report native/device/cloud checks separately from static/mocked checks; an unperformed check remains untested, not passed. Unavailable tooling is a reported limitation: continue independent work rather than stop the whole family for a screenshot.

Stop affected implementation early only for a required change involving new product functionality, data/schema migration, backend/security changes, unclear privacy/account isolation, FitAdapt acceptance semantics, destructive behavior, unapproved dependencies, or a material conflict with the approved design system. Identify the exact blocker and preserve completed work; continue independent in-scope work when safe. Routine visual choices and internal refinements do not require another approval.

## Common completion gate

Every checkpoint's family-specific criteria below add to these requirements:

- Every assigned ID and its existing states/actions is accounted for in the index. Retained screens are explicitly marked retained/verified, not silently omitted.
- Charcoal/graphite and warm orange/coral surfaces, refined native text, bounded lighting, coherent controls and readable light-mode equivalents match the approved tabs. Do not turn data/status colors into decorative brand colors.
- Dark/light, empty/populated, loading/error/busy/invalid/private states are checked where actually implemented; no fabricated states or values. Narrow layouts, large text, keyboard, touch targets, contrast, screen-reader semantics, reduced motion and back/dismiss are covered per registry V0.
- Focused behavior checks and full typecheck/tests/exports have recorded commands and results. Missing tooling/device evidence is named precisely and prevents a fully-verified claim, without erasing completed implementation.
- Diff review confirms no unauthorized data/service/security/configuration/artwork change, no new dependency, no routing restructuring and no loss of working actions.
- One final internal visual refinement pass is completed before requesting family-level review. Outstanding functional/release limitations are listed separately from styling.

## Intended source scopes

All paths below are relative to `fitness-mobile/`. These are presentation scopes, not permission to rewrite every file. Reuse existing controllers and services without modifying their business logic. Existing tests may be extended and new focused tests/preview adapters may be added as needed within `tests/` and `tools/`; no dependency installation is assumed.

Shared presentation files established in 8B may be extended later only when necessary for the assigned family, with regression evidence for their prior consumers. Do not repeat the foundation implementation or create a parallel component library in each checkpoint. Files named only for verification stay unchanged unless an in-scope presentation defect is demonstrated; no functional repair is authorized implicitly.

## Checkpoint 8B — Shared Foundation + Home Utilities

**Assigned IDs (4):** T03, T01, O01, O18.

**Internal execution order:** Start with opt-in surface/header/action/input/notice/sheet recipes and Sync History as the internal pilot, then complete Calendar/day detail and Home add/set-steps dialogs. The pilot and calendar are one checkpoint, not separate approval rounds.

**Reusable component work:** Extend `components/somata/TaskUI.tsx`, `components/homeFlows/FlowUI.tsx`, `components/designPreview/Appearance.tsx`, and existing `components/home/premiumTheme.ts` recipes. Use existing semantic tokens; an appearance wrapper alone does not update TaskUI while it directly consumes legacy D/F. Align `CalendarRecord`/`DayDetailSheet` and the scoped Home dialog. Preserve default styling outside the opt-in boundary until each family migrates.

**Exact intended presentation source scope:**

- `app/profile/sync-history.tsx`
- `components/somata/TaskUI.tsx`
- `components/homeFlows/FlowUI.tsx`
- `components/designPreview/Appearance.tsx`
- `components/home/premiumTheme.ts`
- `app/(modals)/full-calendar.tsx`
- `app/(tabs)/index.tsx`
- `components/calendar/DayDetailSheet.tsx`
- `components/somata/CalendarRecord.tsx`
- `components/designPreview/presentationColors.ts`
- `components/somata/theme.ts`
- `services/theme/semanticTokens.ts`

**Functional regression tests:** `tests/semanticTokens.test.ts`, `tests/themePicker.test.ts`, `tests/accountLocalStorage.test.ts`, `tests/core.test.ts`, `tests/nutritionDelivery.test.ts`, `tests/homeBrandPresentation.test.ts`. Add focused tests only for a changed behavior/navigation boundary; full completion gates still apply.

**Behavior walkthrough:** Verify ordinary/saved custom themes, no changes on an unopted control page, add versus set steps, selected-day logging, day/week/month/year navigation and date boundaries. Sync History currently clears immediately; preserve that behavior rather than adding a confirmation.

**Visual preview strategy:** Capture Sync History populated/empty, Calendar in day/month plus representative week/year views, empty/day-detail and Add/Set steps with keyboard/validation. Both themes, narrow width and large text; compare the five approved tabs and an untouched TaskUI page for spillover.

**Completion criteria:** All four IDs complete; reusable primitives work together in real utility compositions; Calendar and step dialogs retain every action; unchanged tab layouts and unopted defaults are demonstrated. Common gate and per-ID verification remain mandatory.

**High-risk boundaries:** Shared theme changes can unintentionally affect dozens of consumers. No global D/F replacement, provider reordering, persisted palette overwrite, date/step calculation change or new clear-history behavior.

## Checkpoint 9 — Nutrition Subpages

**Assigned IDs (17):** N01, N02, O04, O05, O06, O07, N03, N04, O09, O10, O11, N05, O08, N07, N06, N08, N09.

**Internal execution order:** Complete food search/entry and editing, then both scanner review experiences, Meal Builder and its handoffs, followed by diet choices, suggestions and hydration. Validate shared scanner/editor changes against both implementations before final refinement.

**Reusable component work:** Reuse the 8B TaskPage/TaskSheet/Field/Button/Choice/notice recipes. Align the logged-food editor, `ScanItems`, shared scan add/edit/explanation sheets and meal-category controls. Compose a distinct food source/review layout and ingredient workspace; keep scan cameras/results native.

**Exact intended presentation source scope:**

- `app/(modals)/add-meal.tsx`
- `app/(modals)/quick-add.tsx`
- `components/nutrition/uiNew/EditFoodSheet.tsx`
- `app/nutrition/scan-meal.tsx`
- `app/nutrition/scan-meal-v2.tsx`
- `components/scanMeal/new/AddFoodSheet.tsx`
- `components/scanMeal/new/EditFoodSheet.tsx`
- `components/scanMeal/new/ExplainAIModal.tsx`
- `components/somata/ScanItems.tsx`
- `components/scanMeal/new/MealCategoryPills.tsx`
- `app/(modals)/meal-builder.tsx`
- `app/(modals)/diet-preferences.tsx`
- `app/(modals)/what-should-i-eat.tsx`
- `app/(modals)/quick-hydration.tsx`
- `app/(modals)/ai-meal-suggestions.tsx`

**Functional regression tests:** `tests/nutritionDelivery.test.ts`, `tests/nutritionTargets.test.ts`, `tests/previewNutritionProjection.test.ts`, `tests/aiBoundary.test.ts`, `tests/mealBuilderHandoff.test.ts`, `tests/accountLocalStorage.test.ts`, `tests/releaseConfig.test.ts`, `tests/nutritionBrandPresentation.test.ts`. Add focused tests only for a changed behavior/navigation boundary; full completion gates still apply.

**Behavior walkthrough:** Exercise all existing food modes, quantities/units, selected dates/meals, manual unknown versus zero, review before logging, edit/delete and duplicate taps. Cover stale/malformed/consumed handoffs and account switching; mocked provider success, 429, timeout/error; diets persist/reopen, Pro gate remains enforced and both hydration stores retain their separate meanings.

**Visual preview strategy:** Dark/light food search/results/empty, review and logged-food editor; both scanners at capture/review/error with shared sheets; builder items and four input-method states; diet selections/long custom tokens; suggestion unavailable/available and signed-out/busy water entry. Use clearly synthetic fixtures; camera/permission behavior needs a phone.

**Completion criteria:** All 17 IDs complete; both scanner routes and reexports still work, the builder consumes the correct account payload once, all existing food actions remain, and remaining calories/macros use unchanged target logic. Common gate and per-ID verification remain mandatory.

**High-risk boundaries:** Do not alter paid-provider behavior, confirmation, nutrient scaling, handoff ownership or retention. N09 remains direct-link-only. N08 swallows storage failures today: record the existing functional limitation, do not invent successful writes or broaden this visual scope to repair it silently.

## Checkpoint 10 — Workouts Subpages

**Assigned IDs (22):** W01, O37, O38, W02, W03, W04, W10, O15, O17, W07, W08, W09, O35, O36, W05, O02, O03, W06, O16, W11, W12, W13.

**Internal execution order:** Build the active session composition and title/set editors, then catalog/templates, recorded history/recap/detail, quick workouts/activity/session configuration, Coach Spark and all three direct-link quick-session forms. Complete the family before returning.

**Reusable component work:** Reuse the foundation for controls/sheets and task-specific workout rows. Align exercise filters/preview, template editors and ActivityLogSheet. New composition must retain the current session controller/draft helper and action logic. Only the nested configuration/activity surfaces of the approved Workouts tab are in scope.

**Exact intended presentation source scope:**

- `app/workouts/session.tsx`
- `app/(modals)/browse.tsx`
- `app/workouts/templates.tsx`
- `app/(modals)/create-template.tsx`
- `app/(modals)/save-workout-as-templates.tsx`
- `components/exercises/ExercisePreviewSheet.tsx`
- `components/exercises/FilterBar.tsx`
- `app/workouts/history.tsx`
- `app/workouts/recap.tsx`
- `app/workouts/session-detail.tsx`
- `app/(modals)/quick-workout.tsx`
- `app/(tabs)/workouts.tsx`
- `components/activity/ActivityLogSheet.tsx`
- `app/(modals)/coach-spark.tsx`
- `app/(modals)/quick-cardio.tsx`
- `app/(modals)/quick-strength.tsx`
- `app/(modals)/quick-mobility.tsx`

**Functional regression tests:** `tests/core.test.ts`, `tests/accountLocalStorage.test.ts`, `tests/workoutsBrandPresentation.test.ts`, `tests/aiBoundary.test.ts`, `tests/accountRouteAccess.test.ts`. Add focused tests only for a changed behavior/navigation boundary; full completion gates still apply.

**Behavior walkthrough:** Seed/resume/rename a synthetic session; add/edit/reorder/complete/delete sets and exercises; validate units, unfinished leave/discard/finish/retry and duplicate submission. Test search/favorites/catalog fallback, template IDs/use/save, history filters/ranges, notes, recap sharing, repeat/delete, activity quick/manual/edit and Coach Spark swap/start/save/error/history.

**Visual preview strategy:** Both modes for a populated/empty active session, keyboard-open set editor, exercise search/detail, templates/create/save, history/recap/detail, activity variants and generated-session review/error. Long exercise/template names and narrow layout; all three direct-link forms remain represented in the index.

**Completion criteria:** All 22 IDs complete; existing logging/history/template operations retained; saved-only surprise and existing Workouts tab layout unchanged; no draft/session or unit changes hidden in presentation. Common gate and per-ID verification remain mandatory.

**High-risk boundaries:** Drafts, completed sets and templates have different ownership/lifetimes. Do not change their seeds, session timing, deletion/finish semantics, activity calculations or AI contracts; no new shortcuts for dormant entry routes.

## Checkpoint 11 — Profile, FitAdapt and Progress

**Assigned IDs (23):** P01, P02, O29, P03, P04, O12, O13, O14, P05, P06, O20, O21, O22, O23, P07, P08, P09, O19, O26, O27, O28, P10, P11.

**Internal execution order:** Complete saved goals/calculator and FitAdapt completion first, then measurements, photos/check-in, measured steps/Insights/long-term records, each Advanced Metrics desk and FitAdapt event history. Desk-by-desk internal review is quality control, not extra user checkpoints.

**Reusable component work:** Reuse fields/pickers/dialogs, FlowUI, Trend and existing measured-data presentation. Align `MetricPickerSheet`, read-only `FitAdaptInsightsView`, expanded chart/share/badge sheets and photo journal dialogs. Keep domain chart geometry and plan view models unchanged; do not force editors and timelines into one card layout.

**Exact intended presentation source scope:**

- `app/profile/goal-setup.tsx`
- `app/profile/goal-advanced.tsx`
- `app/fitadapt-setup.tsx`
- `app/(modals)/body-metrics.tsx`
- `components/profile/premium/bodyMetrics/MetricPickerSheet.tsx`
- `app/(modals)/progress-photos.tsx`
- `app/(modals)/weekly-checkin.tsx`
- `app/profile/steps-history.tsx`
- `app/profile/insights-progress.tsx`
- `app/(modals)/long-term-progress.tsx`
- `components/somata/Trend.tsx`
- `app/profile/advanced-metrics.tsx`
- `app/profile/fitadapt-insights.tsx`
- `components/homeFlows/FitAdaptInsightsView.tsx`
- `components/homeFlows/FlowUI.tsx`
- `components/accountSettings/useProfileFlowTheme.ts`

**Functional regression tests:** `tests/fitadaptSetup.test.ts`, `tests/nutritionTargets.test.ts`, `tests/profilePlanPresentation.test.ts`, `tests/profileOverviewData.test.ts`, `tests/fitadaptHistoryData.test.ts`, `tests/fitadaptInsightData.test.ts`, `tests/trendGeometry.test.ts`, `tests/accountLocalStorage.test.ts`, `tests/accountDeletion.test.ts`, `tests/profileBrandPresentation.test.ts`. Add focused tests only for a changed behavior/navigation boundary; full completion gates still apply.

**Behavior walkthrough:** Test goal/pace/units and shared advanced draft; save-review sequencing and retry/insufficient-data continuation; accepted and pending guards; all eight measurement contexts, history deletion, photo ownership/baseline/permission, check-in resume, sparse trends and history ordering/bounds/load-more. Accepted targets stay authoritative; pending/declined do not change them.

**Visual preview strategy:** Both modes for goals/calculator/setup review/error, measurement pickers/recalc decisions, empty/populated photo journal and check-in, sparse/recorded step and trend views, every Advanced Metrics desk, FitAdapt timeline partial/empty/error. Compare approved Profile accepted/saved/pending states as a regression control. No sample record appears in real UI.

**Completion criteria:** All 23 IDs complete, including every existing Advanced Metrics desk and associated sheet. Recorded data, local records, estimates and scenarios remain honestly distinguished; explicit FitAdapt actions and current targets are unchanged. Common gate and per-ID verification remain mandatory.

**High-risk boundaries:** Do not recalculate accepted plans, infer historic targets, migrate local history, fill unknowns with zero, generate trends or change history formats. Existing aggregate/denominator assumptions require a separate behavioral decision. Keep photographed records private and account-scoped.

## Checkpoint 12 — Social, Settings and Account

**Assigned IDs (21):** S01, O30, O31, O32, O33, S02, S03, S04, S05, S06, S07, O25, T02, T04, O24, O34, T05, T06, T08, T09, T07.

**Internal execution order:** Complete Friends and relationship sheets, all redacted summary/privacy modes and badges; then Connections/Settings, Theme Picker, Account/legal/access-availability and the existing deletion interface. Review the whole related family once.

**Reusable component work:** Reuse TaskUI/FlowUI and existing safe `SharedSummary`, FriendsAddSheet/PremiumSegmented, BadgeCollection and ConnectionsDesk. Give privacy controls, theme drafts and destructive confirmation distinct, appropriate compositions. Consolidate visual use of legacy account palette adapters only where consumers are scoped; no provider or persistence replacement.

**Exact intended presentation source scope:**

- `app/friends.tsx`
- `components/friends/premium/FriendsAddSheet.tsx`
- `components/friends/SharedSummary.tsx`
- `components/friends/premium/PremiumSegmented.tsx`
- `app/friends/[id]/progress.tsx`
- `app/friends/[id]/profile.tsx`
- `app/friends/[id].tsx`
- `app/friends/[id]/workouts.tsx`
- `app/friends/preview.tsx`
- `app/profile/friend-visibility.tsx`
- `app/(modals)/badges.tsx`
- `components/homeFlows/BadgeCollection.tsx`
- `app/profile/integrations.tsx`
- `app/(modals)/settings.tsx`
- `components/somata/ConnectionsDesk.tsx`
- `app/(modals)/theme-editor.tsx`
- `app/account/index.tsx`
- `app/account/legal.tsx`
- `app/paywall.tsx`
- `app/account/delete.tsx`
- `components/accountSettings/Primitives.tsx`
- `components/accountSettings/useProfileFlowTheme.ts`
- `components/accountSettings/visualTokens.ts`

**Functional regression tests:** `tests/friendSummary.test.ts`, `tests/friendVisibility.test.ts`, `tests/socialAvailability.test.ts`, `tests/accountRouteAccess.test.ts`, `tests/accountLocalStorage.test.ts`, `tests/core.test.ts`, `tests/profileOverviewData.test.ts`, `tests/themePicker.test.ts`, `tests/semanticTokens.test.ts`, `tests/alertsSubscription.test.ts`, `tests/releaseConfig.test.ts`, `tests/stagingBackend.test.ts`, `tests/accountDeletion.test.ts`, `tests/authErrorMessage.test.ts`. Add focused tests only for a changed behavior/navigation boundary; full completion gates still apply.

**Behavior walkthrough:** Use synthetic owner/friend/nonfriend states for requests, consent, redaction, removal/block/report, nickname/ping and validated template copy. Test badge earned/locked, connection unavailable/permission/sync, notification switches/time, units, theme Save/Cancel/restart and existing palettes. Preserve account email actions/sign-out, missing legal URLs and disabled checkout; deletion requires confirmation/recent auth and partial-failure retry.

**Visual preview strategy:** Both modes for requests/private/shared/owner preview and relationship sheets, badges/detail, provider-unavailable/settings/reminder time, theme mode/light-dark palette drafts and invalid input, Account/legal unavailable/paywall disabled, deletion confirmation/reauth/retention hold/retry. Show account switching and native permissions separately as device evidence.

**Completion criteria:** All 21 IDs complete, including T09 access-availability. Friends use only existing allowed fields; Account and Settings stay distinct; theme changes commit only on Save; checkout remains disabled without a backend; all deletion safeguards retained. Common gate and per-ID verification remain mandatory.

**High-risk boundaries:** No raw friend-document fallback, broader sharing, changed provider authorization, new legal/support URL, purchase backend or retention policy. Account currently has an identity readout, not a new identity editor. Destructive tests use synthetic accounts only; do not broaden server cleanup.

## Checkpoint 13 — Final App-Wide QA

**Assigned IDs (11):** H01, W00, N00, L00, P00, A01, A02, A03, T10, G01, G02. Also re-verifies all 98 IDs, 24 routing-only entries and six layouts.

**Internal execution order:** Reconcile the final 98-row evidence index across all completed families, then walk the five approved tabs, auth, both global gates, unknown-route recovery, every compatibility/direct link and cross-feature back flow. Run full consistency/accessibility/theme/native checks; refine only in-scope presentation defects found, with affected regressions.

**Reusable component work:** Verify the shared foundation and all adopted recipes rather than starting another redesign. Retain approved tab layouts and compact S3 auth. G02 sits outside ThemeProvider: review its preparation/retry appearance without changing provider order or mounting private children early. If a correction would require those changes, report the blocker instead.

**Exact verification source scope:**

- `app/(tabs)/index.tsx`
- `app/(tabs)/workouts.tsx`
- `app/(tabs)/nutrition.tsx`
- `app/(tabs)/notifications.tsx`
- `app/(tabs)/profile.tsx`
- `app/(auth)/login.tsx`
- `app/(auth)/register.tsx`
- `app/(auth)/reset.tsx`
- `app/+not-found.tsx`
- `app/_layout.tsx`
- `content/AuthContext.tsx`
- `app/(modals)/account-center.tsx`
- `app/(modals)/add-meal-old.tsx`
- `app/(modals)/bodyTwin/index.tsx`
- `app/(modals)/bodyTwin/settings.tsx`
- `app/(modals)/control-center.tsx`
- `app/(modals)/scan-meal-v2.tsx`
- `app/(modals)/scan-meal.tsx`
- `app/account/badges.tsx`
- `app/account/edit-profile.tsx`
- `app/account/privacy.tsx`
- `app/account/subscription.tsx`
- `app/dashboard-preview.tsx`
- `app/design-preview/index.tsx`
- `app/design-preview/notifications.tsx`
- `app/design-preview/nutrition.tsx`
- `app/design-preview/profile.tsx`
- `app/design-preview/workouts.tsx`
- `app/index.tsx`
- `app/insights.tsx`
- `app/nutrition/scan-meal(old).tsx`
- `app/old/add-meal(old).tsx`
- `app/old/friends(old).tsx`
- `app/old/session-old.tsx`
- `app/profile(old)/profile(old).tsx`
- `app/(auth)/_layout.tsx`
- `app/(modals)/_layout.tsx`
- `app/(tabs)/_layout.tsx`
- `app/design-preview/_layout.tsx`
- `app/workouts/_layout.tsx`
- `components/somata/AuthUI.tsx`
- `components/somata/AuthControls.tsx`
- `components/somata/authPalette.ts`

Read-only verification is the default for the above. Any limited presentation correction must be listed in the diff/evidence index, keep existing behavior, and rerun affected checks.

**Functional regression tests:** `tests/canonicalDestination.test.ts`, `tests/previewNavigation.test.ts`, `tests/accountRouteAccess.test.ts`, `tests/authBranding.test.ts`, `tests/authErrorMessage.test.ts`, `tests/accountLocalStorage.test.ts`, `tests/firebaseEmulatorMode.test.ts`, `tests/releaseConfig.test.ts`, `tests/stagingBackend.test.ts`, `tests/semanticTokens.test.ts`, `tests/themePicker.test.ts`, `tests/homeBrandPresentation.test.ts`, `tests/nutritionBrandPresentation.test.ts`, `tests/workoutsBrandPresentation.test.ts`, `tests/profileBrandPresentation.test.ts`, `tests/alertsBrandPresentation.test.ts`, `tests/alertsSubscription.test.ts`. Add focused tests only for a changed behavior/navigation boundary; full completion gates still apply.

**Behavior walkthrough:** Full suite plus whole-app synthetic-account walkthrough: cold start/remembered session/sign-out/switch, gate failure/retry, notification routing/read/dismiss, date/handoff/session back paths, all aliases/query parameters and both scanner presentations. VoiceOver, Dynamic Type, reduced motion, keyboard/safe-area and supported native provider flows require real native evidence.

**Visual preview strategy:** Refresh representative cross-family dark/light comparison, all five approved tabs, auth narrow/keyboard layouts, G01 and G02 loading/error/retry, not-found recovery. Capture native/modal transitions, privacy states and long text. Review chart legends across screens without automatically recoloring approved series.

**Completion criteria:** All 98 surfaces have a verified, retained or explicitly limited disposition with evidence; all 24 compatibility entries and six layouts are checked. No previously approved flow regresses. Untested physical-device/cloud gates remain explicit and prevent a fully verified or TestFlight-ready claim. Common gate and per-ID verification remain mandatory.

**High-risk boundaries:** This is a verification checkpoint, not a renewed tab/global theme redesign. In particular, do not change secure account-preparation logic, route guards, permissions, notification semantics or saved preferences for visual consistency. Resolve material brand/personalization conflicts explicitly rather than silently overriding them.

## Verification and capture cadence

After approval to implement a checkpoint, run focused tests as its shared components change. Before family completion, run from `fitness-mobile/`:

```sh
pnpm typecheck
pnpm test
```

Use the installed runner for targeted files, for example:

```sh
TZ=America/Toronto node --import tsx --test tests/themePicker.test.ts tests/semanticTokens.test.ts
```

Run both Expo exports once the checkpoint's implementation and internal refinement are complete. Substitute the active checkpoint in the temporary directory name:

```sh
pnpm exec expo export --platform ios --output-dir /private/tmp/somata-8b-ios
pnpm exec expo export --platform android --output-dir /private/tmp/somata-8b-android
```

An export validates bundling/assets; it is not a native build, permission test or cloud verification. There is no standalone lint script in the inspected mobile package. Do not add one or new dependencies simply to consolidate this roadmap. Use existing synthetic emulator setup for service-bearing behavior tests; no real user data, production changes or paid AI calls for screenshot generation.

Reuse `tools/home-preview-runtime.cjs` and existing `tools/render-*-preview.cjs` approaches, extending them for assigned JSX/states with isolated synthetic fixtures. New per-family entry points may be named `tools/render-branding-8b-preview.cjs`, `tools/render-branding-9-preview.cjs`, `tools/render-branding-10-preview.cjs`, `tools/render-branding-11-preview.cjs`, `tools/render-branding-12-preview.cjs`, and `tools/render-branding-13-preview.cjs` **only if needed**; these are planned filenames, not tools that exist now. Avoid duplicate renderer infrastructure. Keep provider/network/storage effects stubbed and fail visibly when a screen cannot be rendered safely.

Capture representative actual compositions in dark/light, normal/narrow width, large text, relevant empty/loading/error/busy/invalid/private states, and important sheets. The index must still account for every assigned ID; a shared primitive capture may support multiple simple dialogs only when its applicability and each dialog's specific checks are recorded. Major workflows need their own capture. No fake HTML replica or production placeholder data.

Write new evidence to `review/branding-8b/`, then `review/branding-9/` through `review/branding-13/`, preserving previous evidence. Include before/after comparisons for unchanged fixtures, full-scroll and initial-viewport captures where appropriate. Label evidence **browser-static**, **simulator-native**, **device-native**, **unit/mock**, **emulator** or **cloud**. Existing browser previews cannot prove native text layout, safe areas, camera, permissions, navigation or writes.

CoreSimulator was unavailable during 8A (connection invalid/refused). That is historical evidence, not a newly performed check here: retry discovery during implementation. If still unavailable, finish independent work and provide precise device instructions and pending checklist; do not claim a native pass. No automated Maestro/Detox/native-navigation pipeline is assumed. Use an available browser capture mechanism or manual capture without installing new dependencies.

## Per-checkpoint completion/evidence index

Each implementation checkpoint must produce `review/branding-<checkpoint>/IMPLEMENTATION_INDEX.md` (e.g. `review/branding-8b/IMPLEMENTATION_INDEX.md`) alongside its preview index. These are future deliverables; this consolidation creates none of them.

Use one row per assigned registry ID. Checkpoint 13 includes all 98 plus separate route/layout rows. Columns:

| Registry ID / source | Implementation status | Dark/light visual evidence | Important state / accessibility checks | Behavior tests and command/result | Native/device status | Limitations / follow-up |
|---|---|---|---|---|---|---|
| Exact ID and file(s) | Planned / implemented / retained-verified / blocked | Linked capture paths, fixture and viewport | Specific V0 and per-ID cases checked or pending | Test names, pass/fail, evidence class | Passed / failed / untested with device/build | Exact gap and responsible checkpoint/operator |

Do not mark a surface complete from a screenshot alone. At family review, show totals implemented, retained, blocked and requiring device verification; include the final changed-file list, test/export results, internal refinements and known boundaries. A missing device check is an explicit qualification, not a reason to omit the surface or seek approval after each screen.

## Existing decisions and limitations remain in force

- Use current approved parent-series colors and legends; semantic/Home/Nutrition data palettes differ. A final global color remapping or changing approved tabs needs a deliberate design decision, not a blanket replace.
- Preserve stored palette choices and the theme picker's Save/Cancel contract. Any proposal making personalization ineffective is a material design conflict; do not silently implement it.
- G02's account-isolation gate intentionally renders outside ThemeProvider. Never reorder providers or expose account children to get premium styling.
- Quick-water swallowed storage failures, existing step/metric denominator assumptions and legacy local-history provenance are recorded functional limitations, not authorization to change calculations or migrate data.
- Privacy/support URLs, missing checkout backend, provider configuration, deletion-retention decisions and staging/cloud readiness are separate release work. Keep existing unavailable/blocked states honest; do not invent values or expand cleanup.
- All original and approved brand assets, source artwork, five-tab navigation, security rules, notification behavior and FitAdapt contracts stay unchanged. No commit, push, merge or deployment.

## Exact coverage ledger for the consolidated schedule

This is an assignment index, not a completion claim. All implementation remains planned; already approved/branded surfaces are assigned for final regression verification. Names and IDs come directly from the unchanged screen registry. Its detailed source paths, state matrix and V0 requirements remain binding.

| Registry ID | Surface | New checkpoint | Disposition |
|---|---|---|---|
| T03 | Sync history | 8B | Planned full-family presentation work |
| T01 | Calendar and daily records | 8B | Planned full-family presentation work |
| O01 | Add/set steps | 8B | Planned full-family presentation work |
| O18 | Calendar day detail | 8B | Planned full-family presentation work |
| N01 | Food search and entry | 9 | Planned full-family presentation work |
| N02 | Quick food entry | 9 | Planned full-family presentation work |
| O04 | Edit logged food | 9 | Planned full-family presentation work |
| O05 | Review selected food | 9 | Planned full-family presentation work |
| O06 | Product match picker | 9 | Planned full-family presentation work |
| O07 | Quick macros | 9 | Planned full-family presentation work |
| N03 | Meal scanner | 9 | Planned full-family presentation work |
| N04 | Meal scanner / builder handoff | 9 | Planned full-family presentation work |
| O09 | Add missing scanned food | 9 | Planned full-family presentation work |
| O10 | Refine scanned food | 9 | Planned full-family presentation work |
| O11 | Scanning explained | 9 | Planned full-family presentation work |
| N05 | Meal Builder | 9 | Planned full-family presentation work |
| O08 | Builder input method | 9 | Planned full-family presentation work |
| N07 | Diet choices | 9 | Planned full-family presentation work |
| N06 | What should I eat? | 9 | Planned full-family presentation work |
| N08 | Quick water log | 9 | Planned full-family presentation work |
| N09 | AI meal ideas | 9 | Planned full-family presentation work |
| W01 | Active workout session | 10 | Planned full-family presentation work |
| O37 | Workout title editor | 10 | Planned full-family presentation work |
| O38 | Workout set editor | 10 | Planned full-family presentation work |
| W02 | Exercise browser | 10 | Planned full-family presentation work |
| W03 | Template library | 10 | Planned full-family presentation work |
| W04 | Create template | 10 | Planned full-family presentation work |
| W10 | Save session as template | 10 | Planned full-family presentation work |
| O15 | Exercise preview | 10 | Planned full-family presentation work |
| O17 | Add template exercise | 10 | Planned full-family presentation work |
| W07 | Workout history | 10 | Planned full-family presentation work |
| W08 | Workout recap | 10 | Planned full-family presentation work |
| W09 | Workout record details | 10 | Planned full-family presentation work |
| O35 | History month picker | 10 | Planned full-family presentation work |
| O36 | History custom range | 10 | Planned full-family presentation work |
| W05 | Quick workout entry | 10 | Planned full-family presentation work |
| O02 | Session configuration | 10 | Planned full-family presentation work |
| O03 | Log/edit activity | 10 | Planned full-family presentation work |
| W06 | Coach Spark session planning | 10 | Planned full-family presentation work |
| O16 | Swap generated exercise | 10 | Planned full-family presentation work |
| W11 | Quick cardio setup | 10 | Planned full-family presentation work |
| W12 | Quick strength setup | 10 | Planned full-family presentation work |
| W13 | Quick mobility setup | 10 | Planned full-family presentation work |
| P01 | Saved profile and goals | 11 | Planned full-family presentation work |
| P02 | Advanced goal calculator | 11 | Planned full-family presentation work |
| O29 | Goal weight-change decision | 11 | Planned full-family presentation work |
| P03 | FitAdapt profile completion | 11 | Planned full-family presentation work |
| P04 | Body measurements | 11 | Planned full-family presentation work |
| O12 | Measurement value picker | 11 | Planned full-family presentation work |
| O13 | Discard measurement changes | 11 | Planned full-family presentation work |
| O14 | Weight-change target decision | 11 | Planned full-family presentation work |
| P05 | Progress photo journal | 11 | Planned full-family presentation work |
| P06 | Weekly check-in and journal | 11 | Planned full-family presentation work |
| O20 | Photo source chooser | 11 | Planned full-family presentation work |
| O21 | Photo review/metadata | 11 | Planned full-family presentation work |
| O22 | Photo privacy information | 11 | Planned full-family presentation work |
| O23 | Photo viewer/comparison | 11 | Planned full-family presentation work |
| P07 | Recorded steps history | 11 | Planned full-family presentation work |
| P08 | Insights and progress | 11 | Planned full-family presentation work |
| P09 | Long-term progress | 11 | Planned full-family presentation work |
| O19 | Long-term metric detail | 11 | Planned full-family presentation work |
| O26 | Expanded insights trend | 11 | Planned full-family presentation work |
| O27 | Insights badge detail | 11 | Planned full-family presentation work |
| O28 | Weekly share summary | 11 | Planned full-family presentation work |
| P10 | Advanced metrics desks | 11 | Planned full-family presentation work |
| P11 | FitAdapt Insights & History | 11 | Planned full-family presentation work |
| S01 | Friends and requests | 12 | Planned full-family presentation work |
| O30 | Add friend / QR | 12 | Planned full-family presentation work |
| O31 | Friend detail desk | 12 | Planned full-family presentation work |
| O32 | Friend ping picker | 12 | Planned full-family presentation work |
| O33 | Private nickname editor | 12 | Planned full-family presentation work |
| S02 | Friend progress / profile summary | 12 | Planned full-family presentation work |
| S03 | Friend meal summary | 12 | Planned full-family presentation work |
| S04 | Friend workout summary | 12 | Planned full-family presentation work |
| S05 | My shared-summary preview | 12 | Planned full-family presentation work |
| S06 | Friend sharing controls | 12 | Planned full-family presentation work |
| S07 | Badge collection | 12 | Planned full-family presentation work |
| O25 | Collection badge detail | 12 | Planned full-family presentation work |
| T02 | Health and connections | 12 | Planned full-family presentation work |
| T04 | Settings | 12 | Planned full-family presentation work |
| O24 | Reminder time | 12 | Planned full-family presentation work |
| O34 | Connection detail | 12 | Planned full-family presentation work |
| T05 | Theme picker | 12 | Planned full-family presentation work |
| T06 | Account | 12 | Planned full-family presentation work |
| T08 | Privacy and support | 12 | Planned full-family presentation work |
| T09 | Upgrade/access status | 12 | Planned full-family presentation work |
| T07 | Delete account | 12 | Planned full-family presentation work |
| H01 | Home | 13 | Retain and verify; not a new redesign |
| W00 | Workouts | 13 | Retain and verify; not a new redesign |
| N00 | Nutrition | 13 | Retain and verify; not a new redesign |
| L00 | Alerts | 13 | Retain and verify; not a new redesign |
| P00 | Profile + FitAdapt | 13 | Retain and verify; not a new redesign |
| A01 | Sign in | 13 | Retain and verify; not a new redesign |
| A02 | Create account | 13 | Retain and verify; not a new redesign |
| A03 | Password recovery | 13 | Retain and verify; not a new redesign |
| T10 | Unknown destination | 13 | Retain and verify; not a new redesign |
| G01 | Global launch/session-loading surface | 13 | Retain and verify; not a new redesign |
| G02 | Secure account preparation / retry gate | 13 | Retain and verify; not a new redesign |

## Consolidation validation

- Parsed the unchanged registry and original roadmap: all **98 unique IDs** appear exactly once in the primary-assignment ledger; counts are **4 + 17 + 22 + 23 + 21 + 11 = 98**.
- All 28 former stage assignments map into exactly six checkpoints. No orphaned ID or duplicate primary assignment; final Checkpoint 13 additionally re-verifies the whole app.
- The 24 routing-only entries and six layouts remain explicitly assigned to final QA and listed in its source scope. All existing source/test references were checked locally.
- The archive is a byte-identical copy of the pre-consolidation roadmap; the registry, component plan, app code, assets, configuration and existing logs are unchanged.
- No application checks, exports, previews, emulator tests or device tests were rerun for this Markdown-only consolidation. The 8A test results are historical evidence in the archive, not claimed as new runs.

**Stop here for review of the consolidated plan. Checkpoint 8B implementation is not started by this request.**
