# Somata complete visual migration roadmap — Branding 8A

2026-10-19 · `profile-redesign` · **Awaiting audit approval. No implementation begins in this checkpoint.**

Use the [screen registry](SOMATA_SCREEN_REGISTRY.md) as the coverage ledger and the [component plan](SOMATA_COMPONENT_PLAN.md) as the visual contract. Current controllers/services remain the functional source of truth. Preserve the five approved tabs, routes, behavior, stored data, account scoping, FitAdapt ownership and approved S3/F3 artwork.

## Priority and feature-family assessment

Frequency below is an estimate from navigation prominence, not usage analytics. Risk is the consequence of accidental behavior changes, not an assertion that existing code fails.

| Family | Exposure / importance | Current visual gap / reuse | Complexity / regression risk | Sequence rationale |
|---|---|---|---|---|
| Foundation and Home-linked recording/calendar | Frequent; all tab transitions | TaskUI/FlowUI inherit old palette; highest shared leverage | Medium/high; shared defaults and date records | Pilot opt-in before touching many surfaces |
| Nutrition entry/scanning/building | Daily, central logging | Flat TaskUI mixed with older scanner/form styling; many shared sheets | High/high; paid provider calls, units, handoff, selected date and duplicates | First high-visibility family; divide into five bounded checkpoints |
| Workouts sessions/templates/history | Frequent, core tracking | TaskUI + dense inline editors, legacy chart/control colors | High/high; saved/resumed session ownership, unit and set history | Active session first, related libraries/records next |
| Profile/goals/FitAdapt setup | Periodic but target-critical | Legacy form/picker treatment contrasts with approved Profile | High/high; target precedence and accepted-plan preservation | Goal form before dependent setup/measurement presentation |
| Measured progress/Insights/Advanced Metrics | Recurring, multiple source types | FlowUI/TaskUI and inline charts; high reuse but differing provenance | High/high; missing data, dates, aggregates and scenario interpretation | Measured views before advanced desks and plan history |
| Alerts/social/badges | Recurring, sensitive cross-account access | Alerts already approved; Friends/summary/privacy/badges not aligned | Medium–high/high; redaction, privacy and destructive interactions | Two linked social checkpoints plus collection review |
| Settings/connections/theme | Occasional, app-wide consequences | TaskUI plus legacy palette adapters; native dependencies | Medium/high; draft vs immediate saves, permissions and sync | Shared primitives proven before preferences; theme separately |
| Account/auth/legal/deletion/commerce | Entry/recovery and infrequent critical operations | Auth already branded; account/release states lag | Medium/high; auth, cleanup, unsupported providers/backends | Account display/release states separate from destructive flow |
| Global and compatibility paths | Every launch/deep link | Loading palette and alias continuity; no extra old app | Low/high | Final app-wide capture and routing gate, not a navigation rewrite |

## Ordered checkpoint index

IDs are proposed sequence labels, not completed work. Dependencies prevent a shared component from changing multiple unreviewed screens. Within 11E/11F, use the listed sub-gates and keep the checkpoint open until all are reviewed; do not hide incomplete desks behind a “done” label.

| Checkpoint | Bounded goal | Registry assignments | Dependency |
|---|---|---|---|
| 8B | Opt-in foundation and sync-history pilot | T03 | Audit approval |
| 8C | Home recording and calendar | T01, O01, O18 | 8B |
| 9A | Food entry and logged-food editor | N01, N02, O04, O05, O06, O07 | 8B |
| 9B | Both scanner experiences and review sheets | N03, N04, O09, O10, O11 | 9A |
| 9C | Meal Builder workspace | N05, O08 | 9A + 9B |
| 9D | Diet preference editor | N07 | 8B |
| 9E | Nutrition suggestions and quick water | N06, N08, N09 | 9A + 9D |
| 10A | Active workout logging | W01, O37, O38 | 8B |
| 10B | Exercise and template library/editors | W02, W03, W04, W10, O15, O17 | 10A |
| 10C | Workout history and records | W07, W08, W09, O35, O36 | 10A |
| 10D | Quick training and activity entry | W05, O02, O03 | 10A |
| 10E | Coach Spark planning | W06, O16 | 10A + 10B |
| 10F | Deep-link quick session forms | W11, W12, W13 | 10A |
| 11A | Saved goals and advanced calculator | P01, P02, O29 | 8B |
| 11B | Account setup / missing-input completion | P03 | 11A |
| 11C | Measurements and metric pickers | P04, O12, O13, O14 | 11A |
| 11D | Photo journal and weekly reflection | P05, P06, O20, O21, O22, O23 | 8B |
| 11E | Recorded progress family | P07, P08, P09, O19, O26, O27, O28 | 11C |
| 11F | Advanced metrics desks | P10 | 11E |
| 11G | FitAdapt Insights & History | P11 | 11E |
| 12A | Friends and interaction sheets | S01, O30, O31, O32, O33 | 8B |
| 12B | Redacted summary modes and sharing controls | S02, S03, S04, S05, S06 | 12A |
| 12C | Badge collection | S07, O25 | 8B |
| 13A | Settings and native connections | T02, T04, O24, O34 | 8B |
| 13B | Theme picker | T05 | 13A |
| 13C | Account, legal and commercial availability | T06, T08, T09 | 8B |
| 13D | Account deletion | T07 | 13C |
| 14A | Whole-app consistency, authentication and route QA | H01, W00, N00, L00, P00, A01, A02, A03, T10, G01, G02, 24 routing-only entries, 6 layouts | All preceding approved checkpoints |

There are **28 reviewable checkpoints** after this audit, including foundation and final QA. Several are small editors or verification-only work, not a proposal for 28 global redesigns. Every one of the 98 counted surfaces has one accountable checkpoint. Reused components can be touched by more than one checkpoint only with regression capture of previously approved consumers.

## Per-checkpoint work packages

**Common dependencies for every package:** ThemeProvider/semantic tokens, the approved brand components, current data/auth services, route contract and affected shared primitives. Source scopes below are allowlists for intended presentation work, not instructions to rewrite every listed file. Add targeted test/preview adapters only where required. Imported business services/controllers remain untouched unless a separately approved functional checkpoint is required.

**Common completion gate C0:** all assigned route and sheet states reviewed; existing actions present and callbacks unchanged; dark/light/narrow/large-text captures; affected behavior tests + `pnpm typecheck` + full `pnpm test`; iOS/Android export checks after implementation; device-only items explicitly passed or left pending; source diff confirms no backend/schema/permission/asset change; user visual approval before moving on. No snapshot-only test is accepted as proof of account ownership or writes.

### 8B — Opt-in foundation and sync-history pilot

**Depends on:** Audit approval. **Assignments:** T03.

Introduce the smallest opt-in TaskUI/FlowUI recipes, then give Sync history a compact status-and-event composition. Preserve all other page defaults.

**Expected source scope:** `app/profile/sync-history.tsx`; `components/somata/TaskUI.tsx`; `components/homeFlows/FlowUI.tsx`; `components/designPreview/Appearance.tsx`; `components/home/premiumTheme.ts`. Keep service imports, calculations, persistence and route signatures intact. Review shared-consumer impact before editing any primitive.

**Functional tests and manual focus:** semanticTokens, themePicker, accountLocalStorage; populated/empty/immediate clear action and an untouched control page. Registry V0 and each assigned state ledger apply.

**Visual review / completion:** C0; capture each distinct composition and every associated sheet, including invalid/busy/private/empty variants that exist. Require no-change captures of an unopted TaskUI page and all five approved tabs; no global D/F or stored-theme replacement.

### 8C — Home recording and calendar

**Depends on:** 8B. **Assignments:** T01 / O01, O18.

Align only the Home steps dialog and the calendar/day-detail family: date navigation above records, compact summaries and dated actions. Keep Home itself approved.

**Expected source scope:** `app/(modals)/full-calendar.tsx`; `app/(tabs)/index.tsx`; `components/calendar/DayDetailSheet.tsx`. Keep service imports, calculations, persistence and route signatures intact. Review shared-consumer impact before editing any primitive.

**Functional tests and manual focus:** core, accountLocalStorage, nutritionDelivery; add/set steps, all calendar scales, date/time-zone boundaries, selected-day logging. Registry V0 and each assigned state ledger apply.

**Visual review / completion:** C0; capture each distinct composition and every associated sheet, including invalid/busy/private/empty variants that exist. No approved parent tab composition changes are needed beyond the named nested surfaces.

### 9A — Food entry and logged-food editor

**Depends on:** 8B. **Assignments:** N01, N02 / O04, O05, O06, O07.

Task-focused food source/search header, selected-food review, compact portion/macros editor and clear save hierarchy. Retain every existing search/manual/AI/barcode/favorite mode.

**Expected source scope:** `app/(modals)/add-meal.tsx`; `app/(modals)/quick-add.tsx`; `components/nutrition/uiNew/EditFoodSheet.tsx`. Keep service imports, calculations, persistence and route signatures intact. Review shared-consumer impact before editing any primitive.

**Functional tests and manual focus:** nutritionDelivery, nutritionTargets, aiBoundary, previewNutritionProjection; selected date, unit scaling, manual zero/unknown, edit/delete, duplicate taps. Registry V0 and each assigned state ledger apply.

**Visual review / completion:** C0; capture each distinct composition and every associated sheet, including invalid/busy/private/empty variants that exist. No approved parent tab composition changes are needed beyond the named nested surfaces.

### 9B — Both scanner experiences and review sheets

**Depends on:** 9A. **Assignments:** N03, N04 / O09, O10, O11.

Bounded capture/photo area with native review list and stable confirm controls. Shared add/edit/explanation styling; keep both distinct scanner controllers and modal reexports.

**Expected source scope:** `app/nutrition/scan-meal.tsx`; `app/nutrition/scan-meal-v2.tsx`; `components/scanMeal/new/AddFoodSheet.tsx`; `components/scanMeal/new/EditFoodSheet.tsx`; `components/scanMeal/new/ExplainAIModal.tsx`; `components/somata/ScanItems.tsx`; `components/scanMeal/new/MealCategoryPills.tsx`. Keep service imports, calculations, persistence and route signatures intact. Review shared-consumer impact before editing any primitive.

**Functional tests and manual focus:** aiBoundary, mealBuilderHandoff, nutritionDelivery; mocked provider errors/success, both scanner entries, cancel/permissions/photo capture on device. Registry V0 and each assigned state ledger apply.

**Visual review / completion:** C0; capture each distinct composition and every associated sheet, including invalid/busy/private/empty variants that exist. Physical camera/library and provider analysis remain separate gates; mocked images/results are labeled synthetic and never saved to real accounts.

### 9C — Meal Builder workspace

**Depends on:** 9A + 9B. **Assignments:** N05 / O08.

Ingredient workspace, per-item editing and totals, deliberate method selector and review action; all four input-method states receive the same visual quality.

**Expected source scope:** `app/(modals)/meal-builder.tsx`. Keep service imports, calculations, persistence and route signatures intact. Review shared-consumer impact before editing any primitive.

**Functional tests and manual focus:** mealBuilderHandoff, nutritionDelivery, accountLocalStorage; scan-return once, stale/invalid payload, UID switch, preset/save/log. Registry V0 and each assigned state ledger apply.

**Visual review / completion:** C0; capture each distinct composition and every associated sheet, including invalid/busy/private/empty variants that exist. No approved parent tab composition changes are needed beyond the named nested surfaces.

### 9D — Diet preference editor

**Depends on:** 8B. **Assignments:** N07.

Organize restrictions/allergens/dislikes/custom tokens into a readable editable form; keep exact values and save convention.

**Expected source scope:** `app/(modals)/diet-preferences.tsx`. Keep service imports, calculations, persistence and route signatures intact. Review shared-consumer impact before editing any primitive.

**Functional tests and manual focus:** core and affected preference validation; save/reopen, failed save, long custom tokens, keyboard. Registry V0 and each assigned state ledger apply.

**Visual review / completion:** C0; capture each distinct composition and every associated sheet, including invalid/busy/private/empty variants that exist. No approved parent tab composition changes are needed beyond the named nested surfaces.

### 9E — Nutrition suggestions and quick water

**Depends on:** 9A + 9D. **Assignments:** N06, N08, N09.

Distinct remaining-target suggestion and quick-water entry compositions; preserve the direct-link-only AI ideas page without adding an entry point.

**Expected source scope:** `app/(modals)/what-should-i-eat.tsx`; `app/(modals)/quick-hydration.tsx`; `app/(modals)/ai-meal-suggestions.tsx`. Keep service imports, calculations, persistence and route signatures intact. Review shared-consumer impact before editing any primitive.

**Functional tests and manual focus:** nutritionTargets, aiBoundary, releaseConfig, accountLocalStorage; entitlement guard, missing targets, local water append/close; document swallowed storage error separately. Registry V0 and each assigned state ledger apply.

**Visual review / completion:** C0; capture each distinct composition and every associated sheet, including invalid/busy/private/empty variants that exist. No approved parent tab composition changes are needed beyond the named nested surfaces.

### 10A — Active workout logging

**Depends on:** 8B. **Assignments:** W01 / O37, O38.

Session workspace prioritizing active exercise and sets, stable finish control, focused title/set sheets; keep the existing state machine.

**Expected source scope:** `app/workouts/session.tsx`. Keep service imports, calculations, persistence and route signatures intact. Review shared-consumer impact before editing any primitive.

**Functional tests and manual focus:** core, accountLocalStorage, workoutsBrandPresentation; seeded/resumed draft, edits/reorder/complete/delete, leave/finish/retry, units. Registry V0 and each assigned state ledger apply.

**Visual review / completion:** C0; capture each distinct composition and every associated sheet, including invalid/busy/private/empty variants that exist. No approved parent tab composition changes are needed beyond the named nested surfaces.

### 10B — Exercise and template library/editors

**Depends on:** 10A. **Assignments:** W02, W03, W04, W10 / O15, O17.

Catalog search/filters/detail; readable template library and focused create/save-as-template forms, with no replacement workout logic.

**Expected source scope:** `app/(modals)/browse.tsx`; `app/workouts/templates.tsx`; `app/(modals)/create-template.tsx`; `app/(modals)/save-workout-as-templates.tsx`; `components/exercises/ExercisePreviewSheet.tsx`; `components/exercises/FilterBar.tsx`. Keep service imports, calculations, persistence and route signatures intact. Review shared-consumer impact before editing any primitive.

**Functional tests and manual focus:** core, workoutsBrandPresentation; catalog fallback, favorite/select, template IDs/owner, save, selected exercise return. Registry V0 and each assigned state ledger apply.

**Visual review / completion:** C0; capture each distinct composition and every associated sheet, including invalid/busy/private/empty variants that exist. No approved parent tab composition changes are needed beyond the named nested surfaces.

### 10C — Workout history and records

**Depends on:** 10A. **Assignments:** W07, W08, W09 / O35, O36.

Period-led history, structured recap and detailed recorded session, sharing/muscle map and explicit repeat/template/delete actions.

**Expected source scope:** `app/workouts/history.tsx`; `app/workouts/recap.tsx`; `app/workouts/session-detail.tsx`. Keep service imports, calculations, persistence and route signatures intact. Review shared-consumer impact before editing any primitive.

**Functional tests and manual focus:** core, workoutsBrandPresentation; range/search, session ID, unavailable record, notes, share fallback, delete and repeat. Registry V0 and each assigned state ledger apply.

**Visual review / completion:** C0; capture each distinct composition and every associated sheet, including invalid/busy/private/empty variants that exist. No approved parent tab composition changes are needed beyond the named nested surfaces.

### 10D — Quick training and activity entry

**Depends on:** 10A. **Assignments:** W05 / O02, O03.

Compact quick-workout editor, planned-session sheet and quick/manual activity sheet. Change nested tab surfaces only; do not redesign Workouts.

**Expected source scope:** `app/(modals)/quick-workout.tsx`; `app/(tabs)/workouts.tsx`; `components/activity/ActivityLogSheet.tsx`. Keep service imports, calculations, persistence and route signatures intact. Review shared-consumer impact before editing any primitive.

**Functional tests and manual focus:** core, accountLocalStorage, workoutsBrandPresentation; group sets, units, activity optional fields, create/edit and UID isolation. Registry V0 and each assigned state ledger apply.

**Visual review / completion:** C0; capture each distinct composition and every associated sheet, including invalid/busy/private/empty variants that exist. No approved parent tab composition changes are needed beyond the named nested surfaces.

### 10E — Coach Spark planning

**Depends on:** 10A + 10B. **Assignments:** W06 / O16.

Prompt → generated review → session action composition, exercise swap sheet and existing local history; show honest provider states.

**Expected source scope:** `app/(modals)/coach-spark.tsx`. Keep service imports, calculations, persistence and route signatures intact. Review shared-consumer impact before editing any primitive.

**Functional tests and manual focus:** aiBoundary, accountLocalStorage; controlled mocked generation, malformed/429/error, swap, start/save, history delete. Registry V0 and each assigned state ledger apply.

**Visual review / completion:** C0; capture each distinct composition and every associated sheet, including invalid/busy/private/empty variants that exist. No approved parent tab composition changes are needed beyond the named nested surfaces.

### 10F — Deep-link quick session forms

**Depends on:** 10A. **Assignments:** W11, W12, W13.

Align cardio/strength/mobility setup forms while preserving their current direct-link status. No new shortcuts or removal decisions.

**Expected source scope:** `app/(modals)/quick-cardio.tsx`; `app/(modals)/quick-strength.tsx`; `app/(modals)/quick-mobility.tsx`. Keep service imports, calculations, persistence and route signatures intact. Review shared-consumer impact before editing any primitive.

**Functional tests and manual focus:** accountLocalStorage, accountRouteAccess; each direct link, input validation, UID session seed and back recovery. Registry V0 and each assigned state ledger apply.

**Visual review / completion:** C0; capture each distinct composition and every associated sheet, including invalid/busy/private/empty variants that exist. No approved parent tab composition changes are needed beyond the named nested surfaces.

### 11A — Saved goals and advanced calculator

**Depends on:** 8B. **Assignments:** P01, P02 / O29.

Clear saved-profile/goal form, reviewable calculator settings and existing weight-change decision; distinguish saved goals from accepted plan authority.

**Expected source scope:** `app/profile/goal-setup.tsx`; `app/profile/goal-advanced.tsx`. Keep service imports, calculations, persistence and route signatures intact. Review shared-consumer impact before editing any primitive.

**Functional tests and manual focus:** fitadaptSetup, nutritionTargets, profilePlanPresentation; draft sharing, units/pace, manual edits with accepted targets unchanged. Registry V0 and each assigned state ledger apply.

**Visual review / completion:** C0; capture each distinct composition and every associated sheet, including invalid/busy/private/empty variants that exist. No approved parent tab composition changes are needed beyond the named nested surfaces.

### 11B — Account setup / missing-input completion

**Depends on:** 11A. **Assignments:** P03.

Focused onboarding/completion form, sensitive-data explanation, review step and honest insufficient-data/retry/continue result.

**Expected source scope:** `app/fitadapt-setup.tsx`. Keep service imports, calculations, persistence and route signatures intact. Review shared-consumer impact before editing any primitive.

**Functional tests and manual focus:** fitadaptSetup, accountRouteAccess, accountLocalStorage; duplicate submit, no lost account/inputs, accepted/pending guard and restarts. Registry V0 and each assigned state ledger apply.

**Visual review / completion:** C0; capture each distinct composition and every associated sheet, including invalid/busy/private/empty variants that exist. No approved parent tab composition changes are needed beyond the named nested surfaces.

### 11C — Measurements and metric pickers

**Depends on:** 11A. **Assignments:** P04 / O12, O13, O14.

Recorded-measurement desk with clear editing and history separation, all eight picker states and existing save/discard/recalc decisions.

**Expected source scope:** `app/(modals)/body-metrics.tsx`; `components/profile/premium/bodyMetrics/MetricPickerSheet.tsx`. Keep service imports, calculations, persistence and route signatures intact. Review shared-consumer impact before editing any primitive.

**Functional tests and manual focus:** profileOverviewData, nutritionTargets, trendGeometry, accountLocalStorage; units, connected vitals, absent records, save/history deletion. Registry V0 and each assigned state ledger apply.

**Visual review / completion:** C0; capture each distinct composition and every associated sheet, including invalid/busy/private/empty variants that exist. No approved parent tab composition changes are needed beyond the named nested surfaces.

### 11D — Photo journal and weekly reflection

**Depends on:** 8B. **Assignments:** P05, P06 / O20, O21, O22, O23.

Private photo journal/review/comparison with distinct source/privacy sheets; compact stepped check-in and existing journal view.

**Expected source scope:** `app/(modals)/progress-photos.tsx`; `app/(modals)/weekly-checkin.tsx`. Keep service imports, calculations, persistence and route signatures intact. Review shared-consumer impact before editing any primitive.

**Functional tests and manual focus:** accountLocalStorage, accountDeletion; picker denied/cancel, baseline/view/delete, draft/check-in resume; physical camera/library. Registry V0 and each assigned state ledger apply.

**Visual review / completion:** C0; capture each distinct composition and every associated sheet, including invalid/busy/private/empty variants that exist. No approved parent tab composition changes are needed beyond the named nested surfaces.

### 11E — Recorded progress family

**Depends on:** 11C. **Assignments:** P07, P08, P09 / O19, O26, O27, O28.

Three review gates: steps first, Insights second, long-term records third. Give each period/metric navigation and measured-data hierarchy; preserve aggregation and scenarios.

**Expected source scope:** `app/profile/steps-history.tsx`; `app/profile/insights-progress.tsx`; `app/(modals)/long-term-progress.tsx`; `components/somata/Trend.tsx`. Keep service imports, calculations, persistence and route signatures intact. Review shared-consumer impact before editing any primitive.

**Functional tests and manual focus:** trendGeometry, fitadaptInsightData, profileOverviewData, nutritionTargets; sparse/zero/missing, range, expansion, badge detail and native share. Registry V0 and each assigned state ledger apply.

**Visual review / completion:** C0; capture each distinct composition and every associated sheet, including invalid/busy/private/empty variants that exist. Approve steps, Insights and long-term views separately; preserve labels that distinguish local history from account records. Do not change aggregate denominators under a visual diff.

### 11F — Advanced metrics desks

**Depends on:** 11E. **Assignments:** P10.

Work desk by desk within P10: energy/protein/macros, body/performance, then hydration/activity/scenarios. No calculator or denominator changes. Review all desks before completion.

**Expected source scope:** `app/profile/advanced-metrics.tsx`. Keep service imports, calculations, persistence and route signatures intact. Review shared-consumer impact before editing any primitive.

**Functional tests and manual focus:** trendGeometry, core, nutritionTargets, accountLocalStorage; each actual desk/range and missing-data state, local versus account labels, scenario disclosure. Registry V0 and each assigned state ledger apply.

**Visual review / completion:** C0; capture each distinct composition and every associated sheet, including invalid/busy/private/empty variants that exist. Review all actual desk controls and scenario labels. If a chart depends on an unreliable source, document the limitation without fabricating or silently changing its calculation.

### 11G — FitAdapt Insights & History

**Depends on:** 11E. **Assignments:** P11.

Pair measured trends with a factual, bounded event timeline in the Profile visual family; retain separate pending, declined and accepted semantics.

**Expected source scope:** `app/profile/fitadapt-insights.tsx`; `components/homeFlows/FitAdaptInsightsView.tsx`; `components/homeFlows/FlowUI.tsx`. Keep service imports, calculations, persistence and route signatures intact. Review shared-consumer impact before editing any primitive.

**Functional tests and manual focus:** fitadaptHistoryData, fitadaptInsightData, profilePlanPresentation, nutritionTargets; partial records, owner access, order/bounds/load-more, error/retry. Registry V0 and each assigned state ledger apply.

**Visual review / completion:** C0; capture each distinct composition and every associated sheet, including invalid/busy/private/empty variants that exist. No approved parent tab composition changes are needed beyond the named nested surfaces.

### 12A — Friends and interaction sheets

**Depends on:** 8B. **Assignments:** S01 / O30, O31, O32, O33.

Relationship/request inbox with focused friend detail, add/QR, ping and nickname sheets; existing safe summary component stays the data boundary.

**Expected source scope:** `app/friends.tsx`; `components/friends/premium/FriendsAddSheet.tsx`; `components/friends/SharedSummary.tsx`; `components/friends/premium/PremiumSegmented.tsx`. Keep service imports, calculations, persistence and route signatures intact. Review shared-consumer impact before editing any primitive.

**Functional tests and manual focus:** friendSummary, friendVisibility, socialAvailability; accept/decline/cancel, block/remove/report, ping, empty/private/error; synthetic accounts only. Registry V0 and each assigned state ledger apply.

**Visual review / completion:** C0; capture each distinct composition and every associated sheet, including invalid/busy/private/empty variants that exist. No approved parent tab composition changes are needed beyond the named nested surfaces.

### 12B — Redacted summary modes and sharing controls

**Depends on:** 12A. **Assignments:** S02, S03, S04, S05, S06.

Align standalone progress/profile, dated meal/workout summaries, owner preview and immediate privacy controls; reuse shared composition, preserve per-field private states.

**Expected source scope:** `app/friends/[id]/progress.tsx`; `app/friends/[id]/profile.tsx`; `app/friends/[id].tsx`; `app/friends/[id]/workouts.tsx`; `app/friends/preview.tsx`; `app/profile/friend-visibility.tsx`; `components/friends/SharedSummary.tsx`. Keep service imports, calculations, persistence and route signatures intact. Review shared-consumer impact before editing any primitive.

**Functional tests and manual focus:** friendSummary, friendVisibility, accountRouteAccess; owner/friend/nonfriend, permission revocation, redaction and confirmed template copy. Registry V0 and each assigned state ledger apply.

**Visual review / completion:** C0; capture each distinct composition and every associated sheet, including invalid/busy/private/empty variants that exist. Verify the shared component in every wrapper and the Friends detail sheet; private data cannot reappear through a fallback query.

### 12C — Badge collection

**Depends on:** 8B. **Assignments:** S07 / O25.

Collection categories and earned/locked hierarchy with accessible detail. Reconcile visuals with Insights badge detail, not new award behavior.

**Expected source scope:** `app/(modals)/badges.tsx`; `components/homeFlows/BadgeCollection.tsx`. Keep service imports, calculations, persistence and route signatures intact. Review shared-consumer impact before editing any primitive.

**Functional tests and manual focus:** core, profileOverviewData; locked/earned/empty, actual recorded progress, reduced motion, detail focus. Registry V0 and each assigned state ledger apply.

**Visual review / completion:** C0; capture each distinct composition and every associated sheet, including invalid/busy/private/empty variants that exist. No approved parent tab composition changes are needed beyond the named nested surfaces.

### 13A — Settings and native connections

**Depends on:** 8B. **Assignments:** T02, T04 / O24, O34.

Clear preference groups, notification timing sheet, capability-aware health provider list/details. Preserve immediate saves versus time drafts.

**Expected source scope:** `app/profile/integrations.tsx`; `app/(modals)/settings.tsx`; `components/somata/ConnectionsDesk.tsx`. Keep service imports, calculations, persistence and route signatures intact. Review shared-consumer impact before editing any primitive.

**Functional tests and manual focus:** themePicker, accountLocalStorage, alertsSubscription; permission denied/native unavailable, notification switches/time, unit changes, provider sync/history. Registry V0 and each assigned state ledger apply.

**Visual review / completion:** C0; capture each distinct composition and every associated sheet, including invalid/busy/private/empty variants that exist. No approved parent tab composition changes are needed beyond the named nested surfaces.

### 13B — Theme picker

**Depends on:** 13A. **Assignments:** T05.

Readable mode and dual-palette draft editor, contrast information and persistent Save/Cancel. Preserve custom swatches; do not force brand colors into saved preferences.

**Expected source scope:** `app/(modals)/theme-editor.tsx`. Keep service imports, calculations, persistence and route signatures intact. Review shared-consumer impact before editing any primitive.

**Functional tests and manual focus:** themePicker, semanticTokens; dirty cancel/back, invalid hex/contrast, failed commit, System/Light/Dark, separate palettes and restart. Registry V0 and each assigned state ledger apply.

**Visual review / completion:** C0; capture each distinct composition and every associated sheet, including invalid/busy/private/empty variants that exist. Review a pre-existing custom palette before/after Save, Cancel and restart. Resolve personalization scope before declaring global theme consistency.

### 13C — Account, legal and commercial availability

**Depends on:** 8B. **Assignments:** T06, T08, T09.

Compact identity/security readout and real actions; honest legal/support and checkout-availability presentation. No identity editor or backend invented.

**Expected source scope:** `app/account/index.tsx`; `app/account/legal.tsx`; `app/paywall.tsx`. Keep service imports, calculations, persistence and route signatures intact. Review shared-consumer impact before editing any primitive.

**Functional tests and manual focus:** releaseConfig, accountRouteAccess, authErrorMessage; email actions, sign-out, missing URLs, disabled checkout, provider readout. Registry V0 and each assigned state ledger apply.

**Visual review / completion:** C0; capture each distinct composition and every associated sheet, including invalid/busy/private/empty variants that exist. No approved parent tab composition changes are needed beyond the named nested surfaces.

### 13D — Account deletion

**Depends on:** 13C. **Assignments:** T07.

Focused confirmation/reauthentication and cleanup-status/retry presentation with visible current retention blockers.

**Expected source scope:** `app/account/delete.tsx`. Keep service imports, calculations, persistence and route signatures intact. Review shared-consumer impact before editing any primitive.

**Functional tests and manual focus:** accountDeletion, accountLocalStorage, accountRouteAccess; recent auth, confirmation, partial failure, retry and correct-account cleanup; synthetic only. Registry V0 and each assigned state ledger apply.

**Visual review / completion:** C0; capture each distinct composition and every associated sheet, including invalid/busy/private/empty variants that exist. Only synthetic account deletion; retention holds remain visible. Visual approval never authorizes a real deletion or a retention-policy change.

### 14A — Whole-app consistency, authentication and route QA

**Depends on:** All preceding approved checkpoints. **Assignments:** H01, W00, N00, L00, P00, A01, A02, A03, T10 / G01/G02 and routing/layout appendix.

Retain five approved tabs and branded auth; align only any approved final G01/G02/T10 visual gaps. Audit 24 redirects/reexports, six layouts, all back paths, accessibility and cross-feature continuity.

**Expected source scope:** `app/(tabs)/index.tsx`; `app/(tabs)/workouts.tsx`; `app/(tabs)/nutrition.tsx`; `app/(tabs)/notifications.tsx`; `app/(tabs)/profile.tsx`; `app/(auth)/login.tsx`; `app/(auth)/register.tsx`; `app/(auth)/reset.tsx`; `app/+not-found.tsx`; `app/_layout.tsx`; `content/AuthContext.tsx`. The five tab/auth files are regression references, not a rewrite allowance. AuthContext permits only its isolated loading/error presentation in G02, never preparation logic or provider order. Layout and alias files otherwise require verification only; fix behavior only under separate scope.

**Functional tests and manual focus:** Full mobile suite, both exports, native/device matrix; approved-tab comparison, auth/keyboard, notification deep links, rotation/text scaling, account switching. Registry V0 and each assigned state ledger apply.

**Visual review / completion:** C0; capture each distinct composition and every associated sheet, including invalid/busy/private/empty variants that exist. No visual, functional, native or release gate is marked passed without evidence; list unresolved device/cloud/operator checks explicitly.

## Testing strategy and exact commands

Current package scripts are `typecheck` (`tsc --noEmit`) and `test` (`TZ=America/Toronto node --import tsx --test tests/*.test.ts`). No standalone lint script is defined. Do not invent a successful lint result or add dependencies for this audit.

From the repository:

```sh
cd /Users/aristos/Documents/fitness-app/fitness-mobile
pnpm typecheck
pnpm test
```

Focused tests, when a checkpoint touches their contract, can use the same installed runner. Examples:

```sh
TZ=America/Toronto node --import tsx --test tests/themePicker.test.ts tests/semanticTokens.test.ts
TZ=America/Toronto node --import tsx --test tests/mealBuilderHandoff.test.ts tests/nutritionDelivery.test.ts tests/nutritionTargets.test.ts
TZ=America/Toronto node --import tsx --test tests/fitadaptSetup.test.ts tests/profilePlanPresentation.test.ts tests/fitadaptHistoryData.test.ts
TZ=America/Toronto node --import tsx --test tests/friendSummary.test.ts tests/friendVisibility.test.ts tests/accountLocalStorage.test.ts
```

After future screen/component implementation, use distinct temporary export directories (shown for the first checkpoint; change the checkpoint suffix for subsequent runs):

```sh
pnpm exec expo export --platform ios --output-dir /private/tmp/somata-8b-ios
pnpm exec expo export --platform android --output-dir /private/tmp/somata-8b-android
```

Exports validate bundling/assets, not a native build, health module, camera permission, focus or native animation. This documentation checkpoint did not regenerate exports or overwrite existing visual-review artifacts. Tests involving Firestore/callables must follow the existing synthetic emulator setup (`tests/coreFlows.emulator.ts` and repository runbooks), not point at a personal/production account. Functions/rules are unchanged by visual work; their tests become mandatory if a future proposed change actually crosses that boundary, at which point stop and separate the functional scope.

### Functional regression matrix

| Contract | Existing evidence to rerun / supplement |
|---|---|
| Nutrition active target precedence and remaining values | `nutritionTargets`, `previewNutritionProjection`, `profilePlanPresentation`; accept/decline emulator flow when relevant |
| Scan → Meal Builder / food delivery | `mealBuilderHandoff`, `nutritionDelivery`, `aiBoundary`; manual both scanner paths and final confirmation |
| UID isolation and auth navigation | `accountLocalStorage`, `accountRouteAccess`, `firebaseEmulatorMode`, `authErrorMessage`; two synthetic accounts, sign-out/switch while sheet open |
| FitAdapt setup/history | `fitadaptSetup`, `fitadaptHistoryData`, `fitadaptInsightData`, `profileOverviewData`; accepted/pending/declined/stale/missing/error |
| Workouts | `core`, `workoutsBrandPresentation`; dedicated synthetic session walkthrough because these tests do not prove every native editor |
| Social/privacy | `friendSummary`, `friendVisibility`, `socialAvailability`; synthetic owner/friend/nonfriend, disabled fields and no raw-document fallback |
| Notifications | `alertsSubscription`, `alertsBrandPresentation`; read/mark-all/dismiss/filter/route behavior and native permission |
| Theme/release/deletion | `themePicker`, `semanticTokens`, `releaseConfig`, `stagingBackend`, `accountDeletion`; reauth and retention holds need server/device evidence |
| Chart truthfulness | `trendGeometry`, `fitadaptInsightData`, `dashboardPreviewData`; verify sparse gaps, actual units and date/provenance labels |
| Routing compatibility | `canonicalDestination`, `previewNavigation`, `accountRouteAccess`; direct entry and query-param preservation in all aliases/reexports |

These are existing tests, not comprehensive UI automation. Add focused behavioral tests only where presentation refactoring changes a navigation/state boundary; do not create assertions that simply duplicate static styling or a giant snapshot baseline.

## Visual capture workflow

### What works now

The existing `tools/home-preview-runtime.cjs` transpiles actual TSX to an offline React Native Web renderer with whitelisted imports and synthetic controller fixtures. Current entry points:

| Tool | Coverage / limitations |
|---|---|
| `tools/render-premium-home-preview.cjs` | Approved Home states; older `render-home-preview.cjs` remains a historical alternative, not the primary reference |
| `tools/render-nutrition-preview.cjs` | Nutrition states with synthetic logged/empty/unknown/target inputs |
| `tools/render-workouts-preview.cjs` | Workouts built-ins/saved/recorded/empty and long-text states |
| `tools/render-profile-preview.cjs` | Profile plan/review/error/empty states, synthetic targets clearly labeled |
| `tools/render-alerts-preview.cjs` | Six inbox filters and error/empty/long-text variants; virtualized rows rendered statically, no live notifications |
| `tools/render-auth-preview.cjs` | Actual compact login/brand layout and enabled/disabled button comparisons; not all provider flows |

These tools write checkpoint review folders and were **not rerun in this audit**. Existing `review/branding-6b/` and `review/branding-7/` artifacts remain unchanged. They render browser HTML; existing PNGs are reference captures, not fresh native evidence. The current runtime does not generically render every route or every TaskSheet state; it needs small, explicit new fixtures per future checkpoint. Do not run an arbitrary screen with real Firebase hooks to get a screenshot.

### Proposed capture process per checkpoint

1. Extend the existing local runtime only for the assigned presentation components. Stub hooks/services and filesystem/network side effects before importing controllers; use clearly labeled synthetic fixtures. No paid AI call, external image fetch or personal profile data.
2. Render actual JSX in dark/light for normal iPhone width and 320-point narrow width. Include a 1.8 font-scale approximation, very long names and wrapping action labels. Use measured fixtures only as explicit test data, never inserted into app persistence.
3. Cover populated, empty, loading, error/retry, invalid form, disabled/busy, permission unavailable, private data and sheet-open states where the controller supports them. FitAdapt adds accepted, saved-goals, pending, declined/stale and insufficient data. Each fixture names the registry ID and state.
4. Write to a **new** `review/branding-<checkpoint>/` directory after implementation approval; preserve prior review evidence. Create an index and before/after pairs at the same viewport/mode/state. Capture full scroll content plus a first viewport so CTA hierarchy and scroll reachability are both visible.
5. Use an already available browser screenshot facility or manual browser capture. No Playwright/Maestro/Detox pipeline is configured by current package scripts; do not promise automated native navigation or install tools without a separate need. If a renderer cannot safely load a screen, mark it device-only rather than writing a fake HTML replica.
6. Run native screenshots against synthetic emulator/dev accounts on a working simulator or iPhone. Capture keyboard-open forms, focused fields, modal/back transitions, permission dialogs and real safe areas. Label files `browser-static`, `simulator-native` or `device-native`; never merge those evidence classes.
7. Log result per ID/state/mode/viewport and unresolved limitations. User approval applies to the exact screenshots and diff, not a narrative claim that all screens are modern.

### Native access and manual route checks

This audit attempted `xcrun simctl list devices booted`; it failed with CoreSimulatorService connection invalid/refused and unavailable device set. A usable Xcode/runtime session or physical device is required. No simulator/device checks passed here. Expo Go cannot prove custom HealthKit/Health Connect integrations or native release icon/splash behavior; use the established development/native build process for those.

Once the already documented local synthetic backend configuration is running and verified, start Expo with the existing project start command and current opt-in emulator settings. Do not invent a LAN address or silently disable the emulator flag for a destructive test. Open a synthetic account and follow these paths:

- Home → Add/Set steps, Calendar → chosen day → Add food; back must preserve the parent/date.
- Nutrition → Add food (each source mode), Quick add, Scan, Meal builder → scan-return, Diet choices, suggestions and both water entry paths; edit/delete a synthetic meal.
- Workouts → Start/resume, Add exercise, templates/create/save-as-template, Quick workout, Coach Spark, activity, history → recap → detail/repeat. Verify an unfinished session survives intended navigation.
- Profile → saved goals/advanced, missing-input completion, measurements, photos, check-in, steps, Insights, Advanced Metrics, long-term and FitAdapt history. Verify pending/declined never alter active values.
- Alerts → every filter including Coach, mark/read/dismiss/ping and actual destinations; Friends → requests/detail/privacy/owner preview and shared-template copy using synthetic friends.
- Profile → Account/Settings (separate), Theme picker Save/Cancel, Connections/history; auth reset, sign-out/account switch; synthetic deletion with confirmation/reauthentication/blocked and retry states.
- Direct-link-only N09/W11–W13 and compatibility paths need explicit router testing; do not add production buttons just to capture them.

## Blockers, decisions and scope protection

| Item | Why it matters / disposition |
|---|---|
| Custom palette role versus official brand | Current semantic brand and stored user palettes intentionally coexist. Preserve storage now; approve a clear personalization policy before making every screen ignore custom accents |
| Data-series color mapping | Foundation, Home and Nutrition differ. Review one cross-screen legend mapping; do not classify meaningful purple/blue as branding residue or change all five approved tabs without approval |
| Deep-link-only implementations | N09/W11–W13 have no observed live action; standalone S03 and the S02 profile wrapper also lack a button entry although their summary bodies are shared with Friends. Keep compatibility and review them. Removing or promoting them is a separate product decision |
| Legacy local history and aggregates | Ambiguous local data must remain isolated; do not migrate or fabricate it for charts. Existing hydration swallowed-error and step-average assumptions deserve separate behavior decisions |
| Native health/camera/notification/auth/share | Need actual device/native capability and permission tests. Browser captures are limited evidence |
| AI/FitAdapt/friend/deletion backend availability | Local code does not prove cloud deployment. Use existing synthetic emulator contracts; no deployment is part of visual checkpoints |
| Privacy/support, checkout, deletion retention | Existing release blockers remain; do not invent URLs, enable missing checkout, broaden cleanup or silently resolve policy choices |
| Unrelated dirty tree and assets | Baseline current changes before each checkpoint. Keep sources/master assets and existing logs byte-for-byte; no commits/deployment in this plan |

## Final app-wide completion criteria

- [ ] All 98 registry surfaces have reviewed states or an explicit retained/verification-only disposition; aliases and layouts verified separately.
- [ ] Five approved tab compositions and all existing working actions remain; no unexpected default/route change.
- [ ] Task/flow/picker/dialog/header/input/list/progress presentation is coherent in both modes; no accidental legacy decorative accents, clipped logos, invisible disabled actions or unreadable text.
- [ ] Large text, VoiceOver order/labels, reduced motion, contrast, touch targets, keyboard and safe areas checked on device for representative flows and every high-risk editor.
- [ ] No private friend data, cross-account local data, client-owned FitAdapt writes, automatic acceptance, fake trends or provider output introduced.
- [ ] Date/unit/unknown-value behavior and existing theme persistence are unchanged; destructive confirmations and retry guards remain.
- [ ] Full mobile tests/typecheck and both exports pass; native/device/cloud checks are reported separately, including untested items.
- [ ] Remaining functional and release blockers are listed; visual completion is not a TestFlight-readiness claim.

## Evidence from this audit

`pnpm typecheck` passed. `pnpm test` passed **156/156**, zero skipped. Native simulator discovery failed as above. No export, native build, cloud test or new screenshot is claimed. Only the three requested Markdown documents were created; application and existing artifacts were not changed. Stop here for review of 8A before authorizing 8B.
