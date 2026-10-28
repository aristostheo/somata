# Somata screen registry — Branding 8A

Audit date: 2026-10-19. Repository: `fitness-app`, branch `profile-redesign`. **Planning only; no screen, service, theme, asset or configuration changes.** Paths in this document are relative to `fitness-mobile/`. Existing dirty work, including debug logs, is outside this change.

## Scope and counting rules

The audit traversed all `app/` route files, literal and dynamic navigation calls, imports into shared UI, conditional JSX, native Modal/TaskSheet instances, provider gates and focused form behavior. The static import inventory covers 442 TS/TSX/JS modules under app/components/content/hooks/services/lib/config. This is source evidence, not proof of successful device execution or deployed service availability.

| Inventory unit | Count | Meaning |
|---|---:|---|
| App route/layout files | 89 | All current TSX route files, including historical names |
| Layouts | 6 | Navigation hosts, not six extra screens |
| Routing-only entries | 24 | 22 Redirect/auth-gate entries and 2 scanner reexports |
| Implemented route files | 59 | Includes two friend wrappers with the same Progress body |
| Unique route-backed surfaces | 58 | S02 groups friend profile/progress; scanner versions remain distinct |
| Unique nested sheets/dialogs | 38 | O01–O38, shared scanner/picker instances counted once |
| Global gate surfaces | 2 | G01 root session loading; G02 secure account preparation/retry |
| **Total identified visual surfaces** | **98** | 58 + 38 + 2; does not inflate counts with aliases or loading variants |
| **Approved primary surfaces** | **5** | H01, W00, N00, L00, P00, per user approval |
| **Remaining review/verification surfaces** | **93** | 53 secondary route surfaces + 38 nested + 2 gates; not 93 necessarily-new redesigns |

Authentication A01–A03 already received Checkpoint 2B branding; retain and verify them. Approval of a primary tab is not assumed to separately approve all editors it opens. Four standalone feature routes have no live incoming UI action found (N09, W11–W13); preserve and explicitly review their deep-link behavior. The standalone S03 meal wrapper and S02 profile wrapper also lack an observed button entry; their shared bodies remain reachable through Friends, and all wrappers remain routable. Shared component modules and conditional states are not extra screens.

## Common record contract

Every record below supplies its identity, feature, source/entry, interactions, shared components/dependencies, current styling/inconsistency, complexity/risk, checkpoint, status and verification. Complexity concerns presentation effort; risk concerns damage from an accidental behavior change. H/M/L labels are qualitative, not test results. Source paths are precise; service imports establish dependencies, not permission to alter them.

**V0 applies to every surface:** dark/light; empty/populated where meaningful; loading/error/busy states actually supported by its controller; 320-point narrow and normal iPhone width; long text/system font scaling; readable text/control contrast; VoiceOver labels/order; reduced motion; safe areas; keyboard; close/back/Android back; normal and direct-link entry. Do not invent loading, error, or sample content a controller does not expose—record any missing state handling as a separate functional gap. Per-record verification adds the critical behavior/state cases to V0. Service-bearing flows need synthetic account checks; static preview alone never proves writes, permissions or native behavior.

**Status:** the five tabs are approved/retain; auth is previously branded/verify; all other records are inventoried/awaiting visual approval. No redesign is authorized by this document.

## Unique route surfaces

### H01 — Home

- **Feature / entry:** Home — Default authenticated tab.
- **Source / route:** `app/(tabs)/index.tsx` → `/(tabs)`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Greeting, energy/steps/weight, nutrition pulse, next action, eight quick actions and Explore links.
- **Shared UI:** `components/brand/Brand.tsx`; `components/designPreview/UI.tsx`; `components/home/PremiumHomeUI.tsx`; `components/designPreview/usePreviewAccount.ts`; `components/designPreview/Appearance.tsx`.
- **Functional dependencies:** `services/profile.ts`.
- **Styling / gap:** Approved Premium*UI + SomataHomeAppearance/semantic tokens. Retain layout; regression capture only.
- **Complexity / risk:** Low/Medium. **Checkpoint:** 14A. **Status:** approved; retain.
- **Verify:** V0 + Missing versus zero, accepted target precedence, account switch, steps dialog.

### W00 — Workouts

- **Feature / entry:** Workouts — Second tab.
- **Source / route:** `app/(tabs)/workouts.tsx` → `/(tabs)/workouts`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Start/resume/plan, recorded sets, built-ins, saved template use/keep/archive/restore/delete, surprise, activity, history and integrations.
- **Shared UI:** `components/activity/ActivityLogSheet.tsx`; `components/workouts/PremiumWorkoutsUI.tsx`; `components/designPreview/Appearance.tsx`; `components/home/PremiumHomeUI.tsx`.
- **Functional dependencies:** `content/AuthContext.tsx`; `services/activity.ts`; `services/templates.ts`; `services/workoutMuscles.ts`; `services/workouts.ts`; `services/workoutTemplateCatalog.ts`.
- **Styling / gap:** Approved Premium*UI + SomataHomeAppearance/semantic tokens. Retain layout; regression capture only.
- **Complexity / risk:** Low/High. **Checkpoint:** 14A. **Status:** approved; retain.
- **Verify:** V0 + Saved-only surprise, real set history, template ownership, configuration/activity dialogs.

### N00 — Nutrition

- **Feature / entry:** Nutrition — Third tab; Home logging returns here.
- **Source / route:** `app/(tabs)/nutrition.tsx` → `/(tabs)/nutrition`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Day navigation, energy/macros, goals, local hydration, four food actions, meal timeline/edit, nutrition tools.
- **Shared UI:** `components/designPreview/UI.tsx`; `components/nutrition/PremiumNutritionUI.tsx`; `components/designPreview/Appearance.tsx`; `components/designPreview/usePreviewAccount.ts`; `components/nutrition/uiNew/EditFoodSheet.tsx`.
- **Functional dependencies:** `services/local/accountStore.ts`; `services/dashboardPreviewData.ts`; `services/nutrition.ts`; `services/previewNutritionHandoff.ts`.
- **Styling / gap:** Approved Premium*UI + SomataHomeAppearance/semantic tokens. Retain layout; regression capture only.
- **Complexity / risk:** Low/High. **Checkpoint:** 14A. **Status:** approved; retain.
- **Verify:** V0 + Selected date, food handoff once, zero versus missing, current targets, hydration store separation.

### L00 — Alerts

- **Feature / entry:** Alerts/Social — Fourth tab; header bell; notification response.
- **Source / route:** `app/(tabs)/notifications.tsx` → `/(tabs)/notifications`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Six filters including Coach, unread count, open/read, mark all, dismiss, ping back, category destinations.
- **Shared UI:** `components/alerts/PremiumAlertsUI.tsx`; `components/designPreview/Appearance.tsx`; `components/home/PremiumHomeUI.tsx`.
- **Functional dependencies:** `services/local/accountStore.ts`; `content/AuthContext.tsx`; `services/friends/friends.ts`; `services/notifications.ts`; `services/notificationTriggers.ts`.
- **Styling / gap:** Approved Premium*UI + SomataHomeAppearance/semantic tokens. Retain layout; regression capture only.
- **Complexity / risk:** Low/High. **Checkpoint:** 14A. **Status:** approved; retain.
- **Verify:** V0 + Loading/error/retry/empty, account subscription cleanup; cards route to existing features, no distinct notification-detail screen.

### P00 — Profile + FitAdapt

- **Feature / entry:** Profile/FitAdapt — Fifth tab; Home identity.
- **Source / route:** `app/(tabs)/profile.tsx` → `/(tabs)/profile`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Identity, active plan or goals, hidden values, review/request/retry/accept/decline, measured progress and all record/settings/collection links.
- **Shared UI:** `components/brand/Brand.tsx`; `components/designPreview/UI.tsx`; `components/profile/PremiumProfileUI.tsx`; `components/designPreview/Appearance.tsx`; `components/home/PremiumHomeUI.tsx`; `components/designPreview/usePreviewAccount.ts`.
- **Functional dependencies:** `hooks/useFitAdaptReviewState.ts`; `services/profile/fitadaptInsightData.ts`.
- **Styling / gap:** Approved Premium*UI + SomataHomeAppearance/semantic tokens. Retain layout; regression capture only.
- **Complexity / risk:** Low/High. **Checkpoint:** 14A. **Status:** approved; retain.
- **Verify:** V0 + Accepted projection matching, pending/stale/insufficient/error/processing, privacy toggle, no fabricated trends.

### A01 — Sign in

- **Feature / entry:** Authentication — Unauthenticated launch; registration/reset links; sign-out.
- **Source / route:** `app/(auth)/login.tsx` → `/(auth)/login`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Email/password, visibility, remember me, sign in, enabled provider buttons, recovery/register/legal.
- **Shared UI:** `components/somata/AuthUI.tsx`; `components/somata/AuthControls.tsx`.
- **Functional dependencies:** `lib/firebase.ts`; `lib/authErrorMessage.ts`; `services/fitadaptOnboarding.ts`.
- **Styling / gap:** AuthUI/AuthControls + authPalette and approved S3; Checkpoint 2B treatment already present. Verify continuity, do not repeat the redesign.
- **Complexity / risk:** Low/High. **Checkpoint:** 14A. **Status:** previously branded; verify.
- **Verify:** V0 + Validation, network/busy/retry, retained values, keyboard, provider availability.

### A02 — Create account

- **Feature / entry:** Authentication — Sign-in registration link.
- **Source / route:** `app/(auth)/register.tsx` → `/(auth)/register`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Required account fields, password controls, registration then saved-profile setup, sign-in/recovery/legal.
- **Shared UI:** `components/somata/AuthUI.tsx`; `components/somata/AuthControls.tsx`.
- **Functional dependencies:** `lib/firebase.ts`; `lib/authErrorMessage.ts`; `services/fitadaptOnboarding.ts`; `services/registerFitAdaptAccount.ts`.
- **Styling / gap:** AuthUI/AuthControls + authPalette and approved S3; Checkpoint 2B treatment already present. Verify continuity, do not repeat the redesign.
- **Complexity / risk:** Low/High. **Checkpoint:** 14A. **Status:** previously branded; verify.
- **Verify:** V0 + Duplicate submit, existing email, auth failure, setup resume; do not reset account/profile.

### A03 — Password recovery

- **Feature / entry:** Authentication — Sign-in/register recovery links.
- **Source / route:** `app/(auth)/reset.tsx` → `/(auth)/reset`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Email validation, send reset, return to sign in/register.
- **Shared UI:** `components/somata/AuthUI.tsx`; `components/somata/AuthControls.tsx`.
- **Functional dependencies:** `lib/firebase.ts`; `lib/authErrorMessage.ts`.
- **Styling / gap:** AuthUI/AuthControls + authPalette and approved S3; Checkpoint 2B treatment already present. Verify continuity, do not repeat the redesign.
- **Complexity / risk:** Low/High. **Checkpoint:** 14A. **Status:** previously branded; verify.
- **Verify:** V0 + Loading, failure, success disclosure, keyboard.

### N01 — Food search and entry

- **Feature / entry:** Nutrition — Home Log food; Nutrition Add food/meal Add; calendar; idea handoff.
- **Source / route:** `app/(modals)/add-meal.tsx` → `/(modals)/add-meal`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Recents/search/describe/barcode/manual/favorites; food selection; portion/meal/date review; add to log.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/somata/theme.ts`.
- **Functional dependencies:** `services/local/accountStore.ts`; `services/queueNutritionHandoff.ts`; `services/aiValidation.ts`; `content/AuthContext.tsx`; `content/ThemeProvider.tsx`; `services/foodCatalog.ts`; `services/nutritionRecents.ts`; `services/openai.ts`; `services/mealBuilder.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** High/High. **Checkpoint:** 9A. **Status:** inventoried; pending review.
- **Verify:** V0 + Search loading/no results, AI/provider errors, barcode matching, review before save, handoff date and UID.

### N02 — Quick food entry

- **Feature / entry:** Nutrition — Nutrition Quick add.
- **Source / route:** `app/(modals)/quick-add.tsx` → `/(modals)/quick-add`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Search/recent/frequent choices, meal selection, quick macros and logging.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/somata/theme.ts`.
- **Functional dependencies:** `services/local/accountStore.ts`; `services/queueNutritionHandoff.ts`; `content/AuthContext.tsx`; `content/ThemeProvider.tsx`; `services/foodCatalog.ts`; `services/mealBuilder.ts`; `services/nutritionRecents.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** Medium/High. **Checkpoint:** 9A. **Status:** inventoried; pending review.
- **Verify:** V0 + Empty search, manual missing versus zero, duplicate taps, delivery back to selected day.

### N03 — Meal scanner

- **Feature / entry:** Nutrition — Home/Nutrition Scan and Add meal; modal reexport.
- **Source / route:** `app/nutrition/scan-meal.tsx` → `/nutrition/scan-meal`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Camera/library, analyze/reanalyze, food review/edit/add/remove, explanation, portion/meal/date, confirm logging.
- **Shared UI:** `components/somata/ScanItems.tsx`; `components/somata/TaskUI.tsx`; `components/somata/theme.ts`; `components/scanMeal/new/types.ts`; `components/scanMeal/new/AddFoodSheet.tsx`; `components/scanMeal/new/EditFoodSheet.tsx`; `components/scanMeal/new/ExplainAIModal.tsx`; `components/scanMeal/new/MealCategoryPills.tsx`; `components/scanMeal/new/services/macroMath.ts`; `components/scanMeal/new/services/scanMealService.ts`.
- **Functional dependencies:** `services/local/accountStore.ts`; `services/queueNutritionHandoff.ts`; `services/mealBuilder.ts`; `content/ThemeProvider.tsx`; `services/openai.ts`; `services/scanMeal/scanQuota.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** High/High. **Checkpoint:** 9B. **Status:** inventoried; pending review.
- **Verify:** V0 + Permission denied, unsupported/oversized input, 429/timeout, malformed AI, processing, cancel, duplicate log.

### N04 — Meal scanner / builder handoff

- **Feature / entry:** Nutrition — Meal Builder capture via modal reexport.
- **Source / route:** `app/nutrition/scan-meal-v2.tsx` → `/nutrition/scan-meal-v2`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Capture/library, AI review/edit/add/remove, explanation, log or return scanned items to builder.
- **Shared UI:** `components/somata/ScanItems.tsx`; `components/somata/TaskUI.tsx`; `components/somata/theme.ts`; `components/scanMeal/new/AddFoodSheet.tsx`; `components/scanMeal/new/EditFoodSheet.tsx`; `components/scanMeal/new/ExplainAIModal.tsx`; `components/scanMeal/new/services/macroMath.ts`; `components/scanMeal/new/services/scanMealService.ts`; `components/scanMeal/new/types.ts`.
- **Functional dependencies:** `services/local/accountStore.ts`; `services/queueNutritionHandoff.ts`; `content/ThemeProvider.tsx`; `services/mealBuilder.ts`; `services/openai.ts`; `services/scanMeal/scanQuota.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** High/High. **Checkpoint:** 9B. **Status:** inventoried; pending review.
- **Verify:** V0 + Same scanner safeguards plus missing/stale/duplicate payload and account switch; not interchangeable with N03.

### N05 — Meal Builder

- **Feature / entry:** Nutrition — Nutrition Meal builder; scanner returns payload.
- **Source / route:** `app/(modals)/meal-builder.tsx` → `/(modals)/meal-builder`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Build items, quantity/unit/order/delete, presets, scan/describe/barcode/manual methods, review and log.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/somata/theme.ts`.
- **Functional dependencies:** `services/mealBuilderHandoff.ts`; `services/local/accountStore.ts`; `content/AuthContext.tsx`; `content/ThemeProvider.tsx`; `services/foodCatalog.ts`; `services/mealBuilder.ts`; `services/mealBuilderInputs.ts`; `services/nutritionRecents.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** High/High. **Checkpoint:** 9C. **Status:** inventoried; pending review.
- **Verify:** V0 + UID-scoped one-shot handoff, stale/malformed payload, unknown nutrients, duplicate save, cancellation.

### N06 — What should I eat?

- **Feature / entry:** Nutrition — Nutrition tools.
- **Source / route:** `app/(modals)/what-should-i-eat.tsx` → `/(modals)/what-should-i-eat`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Current remaining targets, filters and existing food ideas, open Add meal search.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/somata/theme.ts`.
- **Functional dependencies:** `content/AuthContext.tsx`; `content/ThemeProvider.tsx`; `services/profile.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** Medium/High. **Checkpoint:** 9E. **Status:** inventoried; pending review.
- **Verify:** V0 + No goals, missing intake, accepted versus pending, idea availability; no invented AI output.

### N07 — Diet choices

- **Feature / entry:** Nutrition/Profile — Nutrition tools; Profile settings.
- **Source / route:** `app/(modals)/diet-preferences.tsx` → `/(modals)/diet-preferences`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Diet restrictions, allergies/dislikes, custom tokens and save.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/accountSettings/useProfileFlowTheme.ts`; `components/profile/premium/ui.ts`.
- **Functional dependencies:** `content/AuthContext.tsx`; `services/profile.ts`; `services/profile/dietPreferences.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** Medium/Medium. **Checkpoint:** 9D. **Status:** inventoried; pending review.
- **Verify:** V0 + Loading, selected/unselected, validation, failed save, persist/reopen; keep existing vocabulary.

### N08 — Quick water log

- **Feature / entry:** Nutrition/Home — Home Water log; Nutrition tools.
- **Source / route:** `app/(modals)/quick-hydration.tsx` → `/(modals)/quick-hydration`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Preset amount tap, account-local append, brief saved notice and automatic close/back fallback to Nutrition.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/somata/theme.ts`.
- **Functional dependencies:** `content/AuthContext.tsx`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** Medium/Medium. **Checkpoint:** 9E. **Status:** inventoried; pending review.
- **Verify:** V0 + UID-scoped device store; distinct from Nutrition hydration counter; signed-out/busy; current catch swallows storage failure (functional gap, not a visual fix).

### N09 — AI meal ideas

- **Feature / entry:** Nutrition — Route exists; no live incoming navigation found.
- **Source / route:** `app/(modals)/ai-meal-suggestions.tsx` → `/(modals)/ai-meal-suggestions`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Preferences/request, generated ideas, regenerate, choose Add meal; gated upgrade.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/somata/theme.ts`.
- **Functional dependencies:** `content/ThemeProvider.tsx`; `lib/releaseConfig.ts`; `content/useEntitlements.ts`; `services/openai.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** Medium/High. **Checkpoint:** 9E. **Status:** inventoried; pending review.
- **Verify:** V0 + Unavailable entitlement/provider, 429, malformed result, checkout disabled; preserve direct link only.

### W01 — Active workout session

- **Feature / entry:** Workouts — Start/resume/template/quick sessions; freshStart or seeded params.
- **Source / route:** `app/workouts/session.tsx` → `/workouts/session`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Exercise search, sets/reps/load, complete/edit/delete/reorder, rename, presets, finish/save/discard.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/somata/theme.ts`; `components/workouts/utils/withAlpha.ts`; `components/workouts/sessionDraft.ts`.
- **Functional dependencies:** `services/local/accountStore.ts`; `content/AuthContext.tsx`; `content/ThemeProvider.tsx`; `services/workoutMuscles.ts`; `services/presets.ts`; `services/profile.ts`; `services/workouts.ts`; `services/badges/engine.ts`; `services/badges/reconcile.ts`; `services/badges/registry.ts`; `services/badges/store.ts`; `services/badges/types.ts`; `services/notificationTriggers.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** High/High. **Checkpoint:** 10A. **Status:** inventoried; pending review.
- **Verify:** V0 + Unsaved leave confirmation, resumed UID draft, invalid sets, finish busy/failure, repeat submit, restarts.

### W02 — Exercise browser

- **Feature / entry:** Workouts — Active session Add exercise.
- **Source / route:** `app/(modals)/browse.tsx` → `/(modals)/browse`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Search, catalog source and body/equipment filters, favorite/recents, preview, select.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/exercises/ExercisePreviewSheet.tsx`; `components/exercises/FilterBar.tsx`.
- **Functional dependencies:** `services/local/accountStore.ts`; `content/ThemeProvider.tsx`; `services/exercises/firestore.ts`; `services/exercises/seed.ts`; `services/exercises/store.ts`; `services/exercises/types.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** Medium/Medium. **Checkpoint:** 10B. **Status:** inventoried; pending review.
- **Verify:** V0 + Remote/local seed availability, no results, selection callback/return, image unavailable.

### W03 — Template library

- **Feature / entry:** Workouts — Workouts See all.
- **Source / route:** `app/workouts/templates.tsx` → `/workouts/templates`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Search/filter built-in and saved library, select/start session.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/somata/theme.ts`.
- **Functional dependencies:** `content/AuthContext.tsx`; `content/ThemeProvider.tsx`; `services/templates.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** Medium/High. **Checkpoint:** 10B. **Status:** inventoried; pending review.
- **Verify:** V0 + Empty/loading, long names, UID changes, correct seed/template IDs.

### W04 — Create template

- **Feature / entry:** Workouts — Workouts create-template action.
- **Source / route:** `app/(modals)/create-template.tsx` → `/(modals)/create-template`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Name/exercises, sets/reps/weight/notes, add/reorder/remove movements and save.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/somata/theme.ts`.
- **Functional dependencies:** `content/AuthContext.tsx`; `services/templates.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** Medium/High. **Checkpoint:** 10B. **Status:** inventoried; pending review.
- **Verify:** V0 + Validation, unsaved changes, duplicate save, own-account storage.

### W05 — Quick workout entry

- **Feature / entry:** Workouts/Home — Home Quick workout; Workouts tools.
- **Source / route:** `app/(modals)/quick-workout.tsx` → `/(modals)/quick-workout`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Name/units, presets, exercise groups/sets, add/edit/delete and save/discard.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/somata/theme.ts`.
- **Functional dependencies:** `content/AuthContext.tsx`; `services/presets.ts`; `services/profile.ts`; `services/templates.ts`; `services/workouts.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** High/High. **Checkpoint:** 10D. **Status:** inventoried; pending review.
- **Verify:** V0 + Unit conversion, empty/invalid inputs, duplicates, target session date and ownership.

### W06 — Coach Spark session planning

- **Feature / entry:** Workouts — Workouts coaching action.
- **Source / route:** `app/(modals)/coach-spark.tsx` → `/(modals)/coach-spark`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Quick/custom prompts, generate, swap exercise, warmup/cooldown, start/save, local history/delete.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/somata/theme.ts`.
- **Functional dependencies:** `services/local/accountStore.ts`; `services/aiValidation.ts`; `content/AuthContext.tsx`; `content/ThemeProvider.tsx`; `services/integrations.ts`; `services/openai.ts`; `services/profile.ts`; `services/templates.ts`; `services/workouts.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** High/High. **Checkpoint:** 10E. **Status:** inventoried; pending review.
- **Verify:** V0 + AI errors, retained draft, malformed output, limits, custom preferences, UID history.

### W07 — Workout history

- **Feature / entry:** Workouts — Workouts seven-day/history links.
- **Source / route:** `app/workouts/history.tsx` → `/workouts/history`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Search, period presets, grouped sessions, month/custom range, recap navigation.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/somata/theme.ts`.
- **Functional dependencies:** `content/AuthContext.tsx`; `content/ThemeProvider.tsx`; `services/workouts.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** High/High. **Checkpoint:** 10C. **Status:** inventoried; pending review.
- **Verify:** V0 + Empty/loading/filter, date boundaries, long session titles, correct session ID.

### W08 — Workout recap

- **Feature / entry:** Workouts — History session row.
- **Source / route:** `app/workouts/recap.tsx` → `/workouts/recap`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Summary, muscle map/tap, notes/fatigue, share/clipboard fallback, session-detail link.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/somata/theme.ts`.
- **Functional dependencies:** `content/AuthContext.tsx`; `content/ThemeProvider.tsx`; `services/profile.ts`; `services/workoutMuscles.ts`; `services/workouts.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** High/High. **Checkpoint:** 10C. **Status:** inventoried; pending review.
- **Verify:** V0 + Missing session, units, real muscle/set data, save error, platform sharing.

### W09 — Workout record details

- **Feature / entry:** Workouts — Recap details.
- **Source / route:** `app/workouts/session-detail.tsx` → `/workouts/session-detail`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Recorded exercises/sets, repeat, save as template, delete with confirmation.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/somata/theme.ts`.
- **Functional dependencies:** `content/AuthContext.tsx`; `content/ThemeProvider.tsx`; `services/profile.ts`; `services/workoutMuscles.ts`; `services/workouts.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** Medium/High. **Checkpoint:** 10C. **Status:** inventoried; pending review.
- **Verify:** V0 + Missing/foreign record, duplicate repeat/delete, saved template mapping, return navigation.

### W10 — Save session as template

- **Feature / entry:** Workouts — Session details save-as-template.
- **Source / route:** `app/(modals)/save-workout-as-templates.tsx` → `/(modals)/save-workout-as-templates`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Template name and session-to-template fields; review/save.
- **Shared UI:** `components/somata/TaskUI.tsx`.
- **Functional dependencies:** `content/AuthContext.tsx`; `services/templates.ts`; `services/workouts.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** Medium/High. **Checkpoint:** 10B. **Status:** inventoried; pending review.
- **Verify:** V0 + Missing source, invalid name, duplicate submit, no mutation of original session.

### W11 — Quick cardio setup

- **Feature / entry:** Workouts — Route exists; no live incoming navigation found.
- **Source / route:** `app/(modals)/quick-cardio.tsx` → `/(modals)/quick-cardio`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Existing cardio choices/form and start seeded session.
- **Shared UI:** `components/somata/TaskUI.tsx`.
- **Functional dependencies:** `content/AuthContext.tsx`; `content/ThemeProvider.tsx`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** Medium/High. **Checkpoint:** 10F. **Status:** inventoried; pending review.
- **Verify:** V0 + UID draft seed, validation and return; do not invent a new tab action.

### W12 — Quick strength setup

- **Feature / entry:** Workouts — Route exists; no live incoming navigation found.
- **Source / route:** `app/(modals)/quick-strength.tsx` → `/(modals)/quick-strength`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Existing strength choices/form and start seeded session.
- **Shared UI:** `components/somata/TaskUI.tsx`.
- **Functional dependencies:** `content/AuthContext.tsx`; `content/ThemeProvider.tsx`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** Medium/High. **Checkpoint:** 10F. **Status:** inventoried; pending review.
- **Verify:** V0 + UID draft seed, validation and return; preserve deep-link behavior.

### W13 — Quick mobility setup

- **Feature / entry:** Workouts — Route exists; no live incoming navigation found.
- **Source / route:** `app/(modals)/quick-mobility.tsx` → `/(modals)/quick-mobility`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Existing mobility choices/form and start seeded session.
- **Shared UI:** `components/somata/TaskUI.tsx`.
- **Functional dependencies:** `content/AuthContext.tsx`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** Medium/High. **Checkpoint:** 10F. **Status:** inventoried; pending review.
- **Verify:** V0 + UID draft seed, validation and return; preserve deep-link behavior.

### P01 — Saved profile and goals

- **Feature / entry:** Profile/FitAdapt — Profile Edit saved profile & goals / training goals.
- **Source / route:** `app/profile/goal-setup.tsx` → `/profile/goal-setup`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Measurements/units, goal/signed pace, activity/training, macro strategy, smart options, advanced calculator, save.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/somata/theme.ts`; `components/accountSettings/useProfileFlowTheme.ts`.
- **Functional dependencies:** `services/local/accountStore.ts`; `content/AuthContext.tsx`; `services/macroCalculator.ts`; `services/nutritionTargets.ts`; `services/profile.ts`; `services/profile/bodyMetrics.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** High/High. **Checkpoint:** 11A. **Status:** inventoried; pending review.
- **Verify:** V0 + Dirty/back/save/recalc, missing versus zero, existing accepted targets unchanged, no client plan writes.

### P02 — Advanced goal calculator

- **Feature / entry:** Profile/FitAdapt — Goal setup advanced link.
- **Source / route:** `app/profile/goal-advanced.tsx` → `/profile/goal-advanced`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Formula/maintenance, body-fat/protein/fat options, clamps/sliders, return draft.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/somata/theme.ts`; `components/accountSettings/useProfileFlowTheme.ts`.
- **Functional dependencies:** `services/macroCalculator.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** Medium/High. **Checkpoint:** 11A. **Status:** inventoried; pending review.
- **Verify:** V0 + Draft shared with parent, cancel/back, correct units, bounds; no silent accepted-target changes.

### P03 — FitAdapt profile completion

- **Feature / entry:** Authentication/Profile — New registration; resumed setup; Profile missing-input action.
- **Source / route:** `app/fitadapt-setup.tsx` → `/fitadapt-setup`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Required fields, units, staged review, authenticated save then review request, retry/continue/finish later.
- **Shared UI:** `components/accountSettings/visualTokens.ts`; `components/somata/TaskUI.tsx`; `components/somata/theme.ts`.
- **Functional dependencies:** `content/AuthContext.tsx`; `content/ThemeProvider.tsx`; `lib/firebase.ts`; `services/fitadapt.ts`; `services/fitadaptOnboarding.ts`; `services/fitadaptSetup.ts`; `services/profile.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** High/High. **Checkpoint:** 11B. **Status:** inventoried; pending review.
- **Verify:** V0 + Accepted/pending guards, missing/zero/signed pace, insufficient data, callable failure, double submit; no lost inputs.

### P04 — Body measurements

- **Feature / entry:** Profile — Profile measurements; latest weight; Insights.
- **Source / route:** `app/(modals)/body-metrics.tsx` → `/(modals)/body-metrics`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Eight metric pickers, unit/equation sex, save/keep or recalculate, connected vitals, dated local history/range/delete.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/somata/theme.ts`; `components/somata/Trend.tsx`; `components/accountSettings/useProfileFlowTheme.ts`; `components/profile/premium/bodyMetrics/MetricPickerSheet.tsx`.
- **Functional dependencies:** `services/local/accountStore.ts`; `content/AuthContext.tsx`; `services/macroCalculator.ts`; `services/nutritionTargets.ts`; `services/profile.ts`; `services/profile/bodyMetrics.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs. Legacy chart colors/legends require per-series review, not blanket replacement.
- **Complexity / risk:** High/High. **Checkpoint:** 11C. **Status:** inventoried; pending review.
- **Verify:** V0 + Missing history, existing draft defaults, unit conversion, saved versus measured distinction, dirty cancel.

### P05 — Progress photo journal

- **Feature / entry:** Profile — Profile collection.
- **Source / route:** `app/(modals)/progress-photos.tsx` → `/(modals)/progress-photos`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Camera/library, notes/review, baseline, view/compare, private information, delete.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/somata/theme.ts`; `components/accountSettings/useProfileFlowTheme.ts`.
- **Functional dependencies:** `services/local/accountStore.ts`; `services/progressPhotos.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** Medium/High. **Checkpoint:** 11D. **Status:** inventoried; pending review.
- **Verify:** V0 + Permission denial, missing local file, storage ownership, account switch, confirmation; no synthetic photographs in real UI.

### P06 — Weekly check-in and journal

- **Feature / entry:** Profile/Notifications — Profile weekly check-in; root notification route.
- **Source / route:** `app/(modals)/weekly-checkin.tsx` → `/(modals)/weekly-checkin`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Four question steps, completion summary, journal/history/trend and reset/back.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/somata/theme.ts`; `components/somata/Trend.tsx`; `components/accountSettings/useProfileFlowTheme.ts`.
- **Functional dependencies:** `services/local/accountStore.ts`; `content/AuthContext.tsx`; `services/profile.ts`; `services/weeklyCheckin.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** Medium/Medium. **Checkpoint:** 11D. **Status:** inventoried; pending review.
- **Verify:** V0 + Partially completed input, local persistence, empty journal, recorded versus inferred values.

### P07 — Recorded steps history

- **Feature / entry:** Home/Profile — Steps cards; Profile records.
- **Source / route:** `app/profile/steps-history.tsx` → `/profile/steps-history`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** 7/30/90-day range, recorded chart, period statistics, dated rows.
- **Shared UI:** `components/homeFlows/FlowUI.tsx`; `components/somata/theme.ts`.
- **Functional dependencies:** `content/AuthContext.tsx`; `services/profile.ts`; `services/profile/fitadaptInsightData.ts`.
- **Styling / gap:** FlowUI + useSomataTheme D/F; legacy cool/lime accents, chart/list hierarchy awaiting premium alignment.
- **Complexity / risk:** Medium/High. **Checkpoint:** 11E. **Status:** inventoried; pending review.
- **Verify:** V0 + No account/records, zero recorded versus missing dates, legacy aggregate denominators, swipe chart.

### P08 — Insights and progress

- **Feature / entry:** Profile/Alerts — Profile Insights; alert summary/Coach; /insights alias.
- **Source / route:** `app/profile/insights-progress.tsx` → `/profile/insights-progress`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Period views, nutrition/workout/body/activity/water trends, weekday breakdown, chart expansion, badge detail, weekly share.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/somata/theme.ts`; `components/somata/Trend.tsx`; `components/accountSettings/useProfileFlowTheme.ts`.
- **Functional dependencies:** `services/local/accountStore.ts`; `services/nutritionTargets.ts`; `content/AuthContext.tsx`; `services/activity.ts`; `services/badges/registry.ts`; `services/badges/store.ts`; `services/badges/types.ts`; `services/nutrition.ts`; `services/profile.ts`; `services/profile/bodyMetrics.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs. Legacy chart colors/legends require per-series review, not blanket replacement.
- **Complexity / risk:** High/High. **Checkpoint:** 11E. **Status:** inventoried; pending review.
- **Verify:** V0 + Sparse local/account data, denominator assumptions, current targets versus historical, native share, error/empty.

### P09 — Long-term progress

- **Feature / entry:** Profile — Profile records.
- **Source / route:** `app/(modals)/long-term-progress.tsx` → `/(modals)/long-term-progress`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Date ranges and metric trend cards, expanded recorded values.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/somata/theme.ts`; `components/somata/Trend.tsx`.
- **Functional dependencies:** `services/local/accountStore.ts`; `services/nutritionTargets.ts`; `content/AuthContext.tsx`; `content/ThemeProvider.tsx`; `services/nutrition.ts`; `services/profile.ts`; `services/profile/bodyMetrics.ts`; `services/profile/longTermProgress.ts`; `services/workouts.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs. Legacy chart colors/legends require per-series review, not blanket replacement.
- **Complexity / risk:** High/High. **Checkpoint:** 11E. **Status:** inventoried; pending review.
- **Verify:** V0 + Local history provenance, missing gaps, units, sparse record states, no generated trend.

### P10 — Advanced metrics desks

- **Feature / entry:** Profile — Profile records; Insights advanced link.
- **Source / route:** `app/profile/advanced-metrics.tsx` → `/profile/advanced-metrics`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Energy/protein/macros, weight, performance, hydration, activity and projection/scenario desks.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/somata/theme.ts`; `components/accountSettings/useProfileFlowTheme.ts`.
- **Functional dependencies:** `services/local/accountStore.ts`; `services/nutritionTargets.ts`; `content/AuthContext.tsx`; `services/activity.ts`; `services/nutrition.ts`; `services/profile.ts`; `services/profile/bodyMetrics.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs. Legacy chart colors/legends require per-series review, not blanket replacement.
- **Complexity / risk:** High/High. **Checkpoint:** 11F. **Status:** inventoried; pending review.
- **Verify:** V0 + Local/remote provenance, calculated scenarios not measured forecasts, nulls, ranges, all existing controls.

### P11 — FitAdapt Insights & History

- **Feature / entry:** Profile/Home — Profile measured progress; Home Insights & history.
- **Source / route:** `app/profile/fitadapt-insights.tsx` → `/profile/fitadapt-insights`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Recorded weight/nutrition/steps trends, trend/detail selection, persisted plan-event timeline, bounded history/load more.
- **Shared UI:** `components/homeFlows/FitAdaptInsightsView.tsx`.
- **Functional dependencies:** `content/AuthContext.tsx`; `services/profile.ts`; `services/nutrition.ts`; `services/profile/accountWeightEntries.ts`; `services/profile/accountWeightData.ts`; `services/profile/fitadaptHistory.ts`; `services/profile/fitadaptHistoryData.ts`; `services/profile/fitadaptInsightData.ts`.
- **Styling / gap:** FlowUI + useSomataTheme D/F; legacy cool/lime accents, chart/list hierarchy awaiting premium alignment.
- **Complexity / risk:** Medium/High. **Checkpoint:** 11G. **Status:** inventoried; pending review.
- **Verify:** V0 + Owner read, incomplete events, ordering, loading/error/empty, pending/declined not active; only reliable persisted dates.

### S01 — Friends and requests

- **Feature / entry:** Alerts/Social — Profile Friends; Alerts friend action/cards.
- **Source / route:** `app/friends.tsx` → `/friends`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Friends/received/sent tabs, add/search/QR, accept/decline/cancel, detail, ping/nickname, remove/block/report.
- **Shared UI:** `components/friends/SharedSummary.tsx`; `components/somata/TaskUI.tsx`; `components/somata/theme.ts`; `components/accountSettings/useProfileFlowTheme.ts`; `components/friends/premium/FriendsAddSheet.tsx`; `components/friends/premium/PremiumSegmented.tsx`.
- **Functional dependencies:** `content/AuthContext.tsx`; `services/friends/friends.ts`; `services/friends/friendsSafety.ts`; `services/notifications.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** High/High. **Checkpoint:** 12A. **Status:** inventoried; pending review.
- **Verify:** V0 + Callable private/unavailable, changing friendship, request failures, destructive dialogs, no raw cross-UID reads.

### S02 — Friend progress / profile summary

- **Feature / entry:** Alerts/Social — Friend detail progress link; profile companion route also exists.
- **Source / route:** `app/friends/[id]/progress.tsx` → `/friends/[id]/progress`; `app/friends/[id]/profile.tsx` → `/friends/[id]/profile`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Redacted progress facts; permitted sharing state.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/friends/SharedSummary.tsx`.
- **Functional dependencies:** Parent route/provider context and Expo navigation; shared component owns its data access.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** Medium/High. **Checkpoint:** 12B. **Status:** inventoried; pending review.
- **Verify:** V0 + Profile and progress wrappers render the same Progress body; owner/friend/nonfriend, private/null values.

### S03 — Friend meal summary

- **Feature / entry:** Alerts/Social — Standalone dynamic route; meal view also in friend-detail sheet.
- **Source / route:** `app/friends/[id].tsx` → `/friends/[id]`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Permitted dated aggregate summary, day selection and refresh.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/friends/SharedSummary.tsx`.
- **Functional dependencies:** Parent route/provider context and Expo navigation; shared component owns its data access.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** Medium/High. **Checkpoint:** 12B. **Status:** inventoried; pending review.
- **Verify:** V0 + No raw food entries, private field state, permission change, stale account, unavailable date.

### S04 — Friend workout summary

- **Feature / entry:** Alerts/Social — Friend detail workouts link.
- **Source / route:** `app/friends/[id]/workouts.tsx` → `/friends/[id]/workouts`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Permitted dated summary, validated shared-template copy with confirmation.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/friends/SharedSummary.tsx`.
- **Functional dependencies:** Parent route/provider context and Expo navigation; shared component owns its data access.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** Medium/High. **Checkpoint:** 12B. **Status:** inventoried; pending review.
- **Verify:** V0 + Consent disabled, nonfriend, private templates, refetch before copy, copy only into own account.

### S05 — My shared-summary preview

- **Feature / entry:** Alerts/Social — Friend visibility Preview.
- **Source / route:** `app/friends/preview.tsx` → `/friends/preview`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Owner preview of redacted summary and sharing availability.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/friends/SharedSummary.tsx`.
- **Functional dependencies:** `content/AuthContext.tsx`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** Medium/High. **Checkpoint:** 12B. **Status:** inventoried; pending review.
- **Verify:** V0 + Owner mode has no per-friend consent edits; never treat preview as access to full raw records.

### S06 — Friend sharing controls

- **Feature / entry:** Profile/Social — Account Privacy; preview link.
- **Source / route:** `app/profile/friend-visibility.tsx` → `/profile/friend-visibility`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Immediate per-field sharing toggles, weight-trend confirmation, summary preview, reset defaults.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/somata/theme.ts`; `components/accountSettings/useProfileFlowTheme.ts`.
- **Functional dependencies:** `content/AuthContext.tsx`; `services/friends/visibility.ts`; `services/profile.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** Medium/High. **Checkpoint:** 12B. **Status:** inventoried; pending review.
- **Verify:** V0 + Disabled sharing, saved error, exact field allowlist, no new sharing categories.

### S07 — Badge collection

- **Feature / entry:** Profile/Home — Home Explore; Profile collection; account/badges alias.
- **Source / route:** `app/(modals)/badges.tsx` → `/(modals)/badges`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Categories, earned/locked progress and detail.
- **Shared UI:** `components/homeFlows/BadgeCollection.tsx`.
- **Functional dependencies:** `services/local/accountStore.ts`; `services/nutritionTargets.ts`; `content/AuthContext.tsx`; `services/badges/registry.ts`; `services/badges/store.ts`; `services/badges/types.ts`; `services/badges/reconcile.ts`; `services/profile.ts`; `services/nutrition.ts`.
- **Styling / gap:** FlowUI + useSomataTheme D/F; legacy cool/lime accents, chart/list hierarchy awaiting premium alignment.
- **Complexity / risk:** Medium/Medium. **Checkpoint:** 12C. **Status:** inventoried; pending review.
- **Verify:** V0 + No invented awards/progress, reconcile versus display, empty/loading, detail accessibility.

### T01 — Calendar and daily records

- **Feature / entry:** Home/Nutrition/Profile — Home Explore; Nutrition date/tools; Profile Calendar.
- **Source / route:** `app/(modals)/full-calendar.tsx` → `/(modals)/full-calendar`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Day/week/month/year, date selection, recorded summaries and day detail, dated Add food.
- **Shared UI:** `components/somata/CalendarRecord.tsx`; `components/somata/TaskUI.tsx`; `components/somata/theme.ts`; `components/calendar/DayDetailSheet.tsx`.
- **Functional dependencies:** `services/local/accountStore.ts`; `content/AuthContext.tsx`; `content/ThemeProvider.tsx`; `services/calendarData.ts`; `services/profile.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** High/High. **Checkpoint:** 8C. **Status:** inventoried; pending review.
- **Verify:** V0 + Date boundaries/time zone, loading/empty, row navigation, account source and local sources.

### T02 — Health and connections

- **Feature / entry:** Profile/Home/Workouts/Alerts — Connections links, sync-trouble alert.
- **Source / route:** `app/profile/integrations.tsx` → `/profile/integrations`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Provider connect/disconnect/permissions/sync, source preferences, status, detail and history.
- **Shared UI:** `components/somata/ConnectionsDesk.tsx`; `components/accountSettings/useProfileFlowTheme.ts`.
- **Functional dependencies:** `services/local/accountStore.ts`; `content/AuthContext.tsx`; `services/integrations.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** Medium/High. **Checkpoint:** 13A. **Status:** inventoried; pending review.
- **Verify:** V0 + Native module unavailable in Expo Go, denial, partial sync, no data, busy/error; no new health metric support.

### T03 — Sync history

- **Feature / entry:** Connections — Connections history action.
- **Source / route:** `app/profile/sync-history.tsx` → `/profile/sync-history`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Stored events/status, immediate Clear history action (no confirmation in current source).
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/somata/theme.ts`; `components/accountSettings/useProfileFlowTheme.ts`.
- **Functional dependencies:** `services/local/accountStore.ts`; `services/integrations.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** Low/Medium. **Checkpoint:** 8B. **Status:** inventoried; pending review.
- **Verify:** V0 + UID-scoped local records, loading/empty, clear only current account; no dedicated clear-failure UI in current source.

### T04 — Settings

- **Feature / entry:** Shared — Tab settings buttons; Profile Settings; control-center alias.
- **Source / route:** `app/(modals)/settings.tsx` → `/(modals)/settings`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Appearance, notification switches/times, units, system accessibility information, health link.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/accountSettings/Primitives.tsx`.
- **Functional dependencies:** `services/local/accountStore.ts`; `content/AuthContext.tsx`; `content/ThemeProvider.tsx`; `services/integrations.ts`; `services/notificationSettings.ts`; `services/profile.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs. Also imports useScreenPalette; do not mistake unused older Primitives exports for rendered UI.
- **Complexity / risk:** Medium/High. **Checkpoint:** 13A. **Status:** inventoried; pending review.
- **Verify:** V0 + Immediate persisted settings versus time drafts, denied notification permission, busy/error; actual supported controls only.

### T05 — Theme picker

- **Feature / entry:** Settings/Profile — Settings Appearance; Profile Theme picker.
- **Source / route:** `app/(modals)/theme-editor.tsx` → `/(modals)/theme-editor`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** System/Light/Dark, separate light/dark presets and custom hex, contrast, draft reset, Save/Cancel.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/somata/theme.ts`; `components/accountSettings/visualTokens.ts`.
- **Functional dependencies:** `content/ThemeProvider.tsx`; `services/theme/themeState.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs. Palette swatches are user data, not obsolete decorative colors.
- **Complexity / risk:** Medium/High. **Checkpoint:** 13B. **Status:** inventoried; pending review.
- **Verify:** V0 + Draft persists only on Save, back-discard, invalid contrast/hex, save failure; preserve existing user palettes.

### T06 — Account

- **Feature / entry:** Profile — Profile identity/Account; legacy account-center.
- **Source / route:** `app/account/index.tsx` → `/account`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Read-only name/email/photo, verify email, password recovery, connected-provider labels, privacy/legal, sign-out and deletion.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/somata/theme.ts`; `components/accountSettings/Primitives.tsx`.
- **Functional dependencies:** `content/AuthContext.tsx`; `services/profile.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs. Also imports useScreenPalette; do not mistake unused older Primitives exports for rendered UI.
- **Complexity / risk:** Medium/High. **Checkpoint:** 13C. **Status:** inventoried; pending review.
- **Verify:** V0 + Auth provider capabilities, email-action failure, sign-out local isolation, separate Settings destination.

### T07 — Delete account

- **Feature / entry:** Account — Account Delete account.
- **Source / route:** `app/account/delete.tsx` → `/account/delete`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Explicit confirmation, recent reauthentication, trusted cleanup request, status/retry.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/somata/theme.ts`.
- **Functional dependencies:** `content/AuthContext.tsx`; `lib/firebase.ts`; `lib/authSocial.ts`; `services/account/deletion.ts`; `services/account/deletionData.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** Medium/High. **Checkpoint:** 13D. **Status:** inventoried; pending review.
- **Verify:** V0 + Retention/unknown-storage holds, partial failures, credentials, auth deleted last; synthetic test accounts only.

### T08 — Privacy and support

- **Feature / entry:** Account/Auth — Account legal; auth links; deletion page.
- **Source / route:** `app/account/legal.tsx` → `/account/legal`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Configured HTTPS privacy-policy/support destinations; unavailable release configuration state.
- **Shared UI:** `components/somata/TaskUI.tsx`.
- **Functional dependencies:** `lib/releaseConfig.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** Low/Medium. **Checkpoint:** 13C. **Status:** inventoried; pending review.
- **Verify:** V0 + No invented URLs/text, external open failure, staging/release fail-closed.

### T09 — Upgrade/access status

- **Feature / entry:** Commercial — AI ideas entitlement gate; direct link.
- **Source / route:** `app/paywall.tsx` → `/paywall`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Existing access options and refresh; checkout only when release config supports backend.
- **Shared UI:** `components/somata/TaskUI.tsx`; `components/somata/theme.ts`.
- **Functional dependencies:** `lib/releaseConfig.ts`; `services/checkout.ts`; `content/useEntitlements.ts`; `lib/firebase.ts`.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** Low/High. **Checkpoint:** 13C. **Status:** inventoried; pending review.
- **Verify:** V0 + Missing backend remains disabled; no fabricated entitlement/pricing or purchasing flow.

### T10 — Unknown destination

- **Feature / entry:** Global — Invalid route.
- **Source / route:** `app/+not-found.tsx` → `/+not-found`. Group-qualified Expo paths are shown to disambiguate modal/auth routes.
- **Content and actions:** Explanation and return Home.
- **Shared UI:** `components/somata/TaskUI.tsx`.
- **Functional dependencies:** Parent route/provider context and Expo navigation; shared component owns its data access.
- **Styling / gap:** TaskUI + useSomataTheme D/F; inherited teal/lime/custom accents and flat panel hierarchy differ from approved warm-edged tabs.
- **Complexity / risk:** Low/Low. **Checkpoint:** 14A. **Status:** inventoried; pending review.
- **Verify:** V0 + Signed-out root guard, long text, back/recovery path.

## Nested surfaces — counted once per distinct task

These are not routes. Each entry inherits its listed parent's feature, data services and UID/auth safeguards, plus V0. Shared source components are named explicitly. Unless stated otherwise, current presentation is TaskSheet/TaskUI with legacy D/F tokens; changing only a surrounding page background would leave these inconsistent. All 38 are inventoried/pending review. Source paths and trigger/action text identify the actual instance, even when several sheets share a file. Complexity is medium; risk is high for state-changing forms, medium for informational views. Custom confirmation dialogs count here; OS Alert variants are separately catalogued below.

| ID / name | Parent / source | Reach, actions and additional verification | Checkpoint / complexity / risk |
|---|---|---|---|
| O01 — Add/set steps | H01 · `app/(tabs)/index.tsx` | Home Add steps or Set steps; numeric input, mode, confirm/cancel; validate zero, duplicates and failed save | 8C · Medium · High |
| O02 — Session configuration | W00 · `app/(tabs)/workouts.tsx` | Plan a session; name/focus/duration, start/cancel; preserve seed and existing draft | 10D · Medium · High |
| O03 — Log/edit activity | W00 · `components/activity/ActivityLogSheet.tsx` | Workouts activity control or Home Log activity; Quick/manual tabs, activity/duration/intensity/details, save/edit; preserve validation and owner | 10D · Medium · High |
| O04 — Edit logged food | N00 · `components/nutrition/uiNew/EditFoodSheet.tsx` | Meal row; quantity/unit, meal and nutrition details, Save/Delete/Close; original-portion scaling and selected date | 9A · Medium · High |
| O05 — Review selected food | N01 · `app/(modals)/add-meal.tsx` | Choose food; portion/meal and logging confirmation; close/save/busy/error without losing selection | 9A · Medium · High |
| O06 — Product match picker | N01 · `app/(modals)/add-meal.tsx` | Barcode yields multiple matches; choose/cancel; missing product/photo and retry | 9A · Medium · High |
| O07 — Quick macros | N02 · `app/(modals)/quick-add.tsx` | Manual entry action; calories/protein/carbs/fat and submit/cancel; unknown versus zero | 9A · Medium · High |
| O08 — Builder input method | N05 · `app/(modals)/meal-builder.tsx` | Method action; scan/describe/barcode/manual modes, native camera/library when available, review/cancel; one shared sheet with four materially different states | 9C · Medium · High |
| O09 — Add missing scanned food | N03,N04 · `components/scanMeal/new/AddFoodSheet.tsx` | Add item during either scanner review; fields/units/meal and validation; no logging before final confirmation | 9B · Medium · High |
| O10 — Refine scanned food | N03,N04 · `components/scanMeal/new/EditFoodSheet.tsx` | Food edit in either scanner; portion/nutrition edit, save/cancel; preserve response confidence semantics | 9B · Medium · High |
| O11 — Scanning explained | N03,N04 · `components/scanMeal/new/ExplainAIModal.tsx` | Explanation action in both scanners; existing explanation content and close; no invented provider rationale | 9B · Medium · Medium |
| O12 — Measurement value picker | P04 · `components/profile/premium/bodyMetrics/MetricPickerSheet.tsx` | Weight/goal weight/height/age/body fat/waist/neck/hip; wheel/manual choices/units, apply/cancel; one reusable surface, eight field states | 11C · Medium · High |
| O13 — Discard measurement changes | P04 · `app/(modals)/body-metrics.tsx` | Back with dirty form; discard/keep editing; system back must match visible action | 11C · Medium · High |
| O14 — Weight-change target decision | P04 · `app/(modals)/body-metrics.tsx` | Save changed weight; keep goals or recalculate legacy goals; accepted projection remains authoritative | 11C · Medium · High |
| O15 — Exercise preview | W02 · `components/exercises/ExercisePreviewSheet.tsx` | Exercise row; media/instructions/favorite/select, close; missing media/catalog states | 10B · Medium · Medium |
| O16 — Swap generated exercise | W06 · `app/(modals)/coach-spark.tsx` | Swap action; alternatives/selection/cancel, loading/empty/failure; retain original until valid selection | 10E · Medium · High |
| O17 — Add template exercise | W04 · `app/(modals)/create-template.tsx` | Template Add exercise; search/select/cancel, invalid/empty results; preserve row ordering | 10B · Medium · High |
| O18 — Calendar day detail | T01 · `components/calendar/DayDetailSheet.tsx` | Select date; CalendarRecord content, dated Add food, close; no-record versus zero and cross-day navigation | 8C · Medium · Medium |
| O19 — Long-term metric detail | P09 · `app/(modals)/long-term-progress.tsx` | TrendCard selection; expanded trend/dated records, close; repeated per metric but counted once | 11E · Medium · Medium |
| O20 — Photo source chooser | P05 · `app/(modals)/progress-photos.tsx` | Add photo; camera/library/cancel; denied permission and missing native support | 11D · Medium · High |
| O21 — Photo review/metadata | P05 · `app/(modals)/progress-photos.tsx` | After image selection; notes/details, keep/cancel; do not save on dismiss | 11D · Medium · High |
| O22 — Photo privacy information | P05 · `app/(modals)/progress-photos.tsx` | Privacy control; actual device-local storage explanation and close | 11D · Medium · Medium |
| O23 — Photo viewer/comparison | P05 · `app/(modals)/progress-photos.tsx` | Tap journal/baseline; view/compare/delete, close; missing files and delete confirmation | 11D · Medium · High |
| O24 — Reminder time | T04 · `app/(modals)/settings.tsx` | Change reminder time; iOS sheet/spinner with Save/Cancel, Android native picker; same task, platform-specific commit timing | 13A · Medium · High |
| O25 — Collection badge detail | S07 · `components/homeFlows/BadgeCollection.tsx` | Tap earned/locked badge; description/progress, dismiss; reduced motion and screen reader | 12C · Medium · Medium |
| O26 — Expanded insights trend | P08 · `app/profile/insights-progress.tsx` | Expand chart; real period data, close; missing gaps/range selection preserved | 11E · Medium · Medium |
| O27 — Insights badge detail | P08 · `app/profile/insights-progress.tsx` | Tap badge in Insights; existing BadgePopover TaskSheet and close; different presentation from collection detail | 11E · Medium · Medium |
| O28 — Weekly share summary | P08 · `app/profile/insights-progress.tsx` | Share card action; preview existing weekly bullets/hits, native share/cancel; no sample achievements | 11E · Medium · Medium |
| O29 — Goal weight-change decision | P01 · `app/profile/goal-setup.tsx` | Recalculation prompt; current keep/recalculate behavior and dismissal; accepted targets unchanged | 11A · Medium · High |
| O30 — Add friend / QR | S01 · `components/friends/premium/FriendsAddSheet.tsx` | Add action; UID lookup/request, own QR toggle/copy, cancel; invalid/self/duplicate/blocked errors | 12A · Medium · High |
| O31 — Friend detail desk | S01 · `app/friends.tsx` | Friend row; overview/profile/meals/workouts views, per-friend consent and permitted summary, progress/workout links, remove/block/report; private/unavailable/error states | 12A · Medium · High |
| O32 — Friend ping picker | S01 · `app/friends.tsx` | Ping action; choose permitted message/send/cancel; pending/error/throttle behavior | 12A · Medium · High |
| O33 — Private nickname editor | S01 · `app/friends.tsx` | Nickname action; input/save/cancel; current owner only, failure retains draft | 12A · Medium · High |
| O34 — Connection detail | T02 · `components/somata/ConnectionsDesk.tsx` | Provider row; supported connect/sync/disconnect/permission/status controls; conditional per provider/native capability | 13A · Medium · High |
| O35 — History month picker | W07 · `app/workouts/history.tsx` | Month selector; previous/next/choose/cancel; date boundaries | 10C · Medium · Medium |
| O36 — History custom range | W07 · `app/workouts/history.tsx` | Custom period; start/end dates/apply/cancel, invalid range | 10C · Medium · Medium |
| O37 — Workout title editor | W01 · `app/workouts/session.tsx` | Title action; edit/save/cancel; preserve existing draft and validation | 10A · Medium · High |
| O38 — Workout set editor | W01 · `app/workouts/session.tsx` | Set edit action; repetitions/load/other existing fields, save/cancel; units, completed state and keyboard | 10A · Medium · High |

Specific visual exceptions: O01/O02 use inline native Modal controls in the approved tab source; preserve parent compositions and change only these scoped bodies later. O25 uses BadgeCollection's custom Modal/Flow styling. O24 is a sheet on iOS and native time picker on Android. O31 includes SharedSummary's task/list content and consent controls. O08 has four input-mode states, not four independent screen counts. O12 renders eight instances of the same picker with different limits/units. O09–O11 are reused by both scanner implementations; verify both owners after any change.

### G01 — Global launch/session-loading surface

- **Parent/entry/source:** root app startup and auth/session restoration; `app/_layout.tsx` before route rendering.
- **Actions/content:** approved SomataIcon, loading indicator/copy; routing gate and providers are functional dependencies, not redesign targets.
- **Current styling/gap:** hardcoded navy/pale-blue gradient and palette spinner/muted copy, instead of the premium semantic canvas. S3 mark is already used; do not replace its drawing or increase its bounded size.
- **Shared UI:** `components/brand/SomataIcon.tsx`, `ThemeProvider`, native ActivityIndicator/LinearGradient.
- **Complexity/risk/checkpoint/status:** Low/High; 14A; inventoried/pending visual approval.
- **Verify:** V0, cold start, remembered/nonremembered session, signed-out return, slow auth, account switch and no route flash. Native launch/splash is separate OS behavior; no splash configuration change proposed.

### G02 — Secure account preparation / retry gate

- **Parent/entry/source:** `content/AuthContext.tsx` mounts before SettingsProvider, ThemeProvider and SafeAreaProvider in `app/_layout.tsx`; runs during auth restoration/sign-out/account changes.
- **Content/actions:** preparing-account spinner; on preparation failure, explanatory text and **Retry secure account switch** button. This is distinct from the inner branded G01 loading view.
- **Functional dependencies:** Firebase auth subscription, `services/local/accountStore.ts`, `services/local/migrateLocalData.ts`, reminder cleanup in `services/notifications.ts`. Children intentionally unmount until cleanup succeeds.
- **Shared UI / styling gap:** raw native View/Text/Button/ActivityIndicator with no semantic surface or app header. Existing ThemeProvider is not accessible at this point; do not reorder providers or mount account screens to obtain branded colors.
- **Complexity/risk/checkpoint/status:** Medium/High; 14A; inventoried/pending visual review. Any future styling must isolate presentation from preparation/revision/retry logic and use a safe pre-provider presentation fallback without introducing stored theme state.
- **Verify:** initial loading, synthetic migration/reminder failure, retry, rapid A→B→sign-out changes, no previous-account flash, no children before successful preparation, text scaling and button visibility. Capture this gate separately from G01.

## Conditional state and confirmation ledger (not additional screens)

| Owners | Conditional/hidden state inventory and inspection requirements |
|---|---|
| H01/N00/P00 | Subscription loading, load error, no profile/record, zero logged, hidden values, accepted versus saved goals, current date versus selected date; preserve existing action availability. |
| P00 | Inline FitAdapt unavailable/retry, not requested, insufficient data with completion link, accepted, pending comparison, stale proposal, evaluation/accept/decline busy and failures. Explicit Accept/Decline remain here, not a new fake review route. `hooks/useFitAdaptReviewState.ts` is live; standalone `components/profile/FitAdaptReview.tsx` is not imported by current routes. |
| L00 | All/Friends/Workouts/Nutrition/Streaks/**Coach**, empty filter, no alerts, error/retry, signed out, unread/read, dismiss confirmation, ping failure, mark-all busy. No implemented standalone alert detail, reply composer, image carousel or streak screen should be inferred from reference images. |
| N01/N02/N05 | Mode-specific search/AI/barcode/manual states; recents/favorites, no matches, review selection, invalid input, in-flight save, provider limits/network, close with draft. Existing native Alerts for unsuccessful operations remain native. |
| N03/N04 | Camera permission/loading/capture/library, analyzing/reanalyzing/logging blocking Modal, review, failure/quota, edit/add/AI explanation. Blocking processing Modal is a state, not an extra destination. Do not show success before real provider output. |
| N06–N09 | No targets/no ideas, restrictions/custom tokens, on-device water empty/history, entitlement and backend unavailable; preserve actually supported states without connecting dormant routes. |
| W00 | Built-in versus saved templates; no history, saved active/archived, management busy; archive/delete/keep/surprise confirmations and failed actions; activity create/edit; long names. |
| W01/W04/W05/W10–W13 | Dirty/draft/seeded/resumed sessions, validation and units, unfinished sets, delete set/exercise/preset, discard/restart/finish-save confirmation; `isFinishing` blocking Modal is a state. Template name/invalid/duplicate errors. |
| W02/W03/W06 | Catalog search/filter/empty/offline fallback, favorites, generated workout loading/error/validated result/history; discard/delete generated history and start/save confirmations. |
| W07–W09 | Search/no records, invalid range, missing session, notes save error, sharing unavailable with clipboard fallback, muscle selection, repeat/delete confirmations. |
| P01–P04 | Dirty save/discard, unit-dependent form fields, goal-dependent signed pace, advanced option sections, invalid inputs, recalculation decision; P03 review/submit/result/retry/continue, accepted guard and insufficient data. P04 eight picker contexts, sex-dependent hip field, connected vitals only when present, history deletion confirmation. |
| P05/P06 | Photos empty/local-file-missing, baseline long-press and deletion confirmation, permission denial; check-in question steps 0–3, completion 4, journal/history 5. Preserve local ownership and incomplete draft. |
| P07–P11 | Sparse/no recorded data, range/metric/desk selection, expandable details, history load/error/load-more; no connected line across unknown values. Advanced calculated scenarios and legacy aggregates must not be relabeled measured data or FitAdapt predictions. |
| S01–S06 | Friends/requests/sent, empty/loading/error; lookup and self/nonfriend/blocked; accepted/pending states; remove/block/report/cancel confirmations; privacy-disabled fields, per-friend consent, owner preview, copy-template confirmation after safe refetch. `SharedSummary` owns mode-specific states. |
| S07 | Earned/locked, filtered empty, reconciling records and detail. Dormant celebration/toast components do not prove a live badge-unlock screen. |
| T01–T05 | Calendar day/week/month/year and selected date; native health unavailable/denied/error/syncing, provider detail; immediate clear-sync-history action; notification master/category disabled, time edit; system accessibility readout; theme draft/contrast/invalid hex/reset/Save/Cancel/discard. |
| T06–T09/A01–A03 | Authenticated provider availability, verification/reset/update/sign-out; deletion reauth/confirmation/loading/retention hold/partial-failure retry; missing policy/support URL, checkout disabled; auth validation/failure/success/busy and password visibility. Do not imply an unsupported provider or payment backend works. |
| G01/G02/T10 | Auth/session restoration and secure account-preparation gates, first-route readiness, unavailable/unknown-route recovery; verify direct links cannot bypass access rules. |

Native system-owned surfaces: camera/photo permissions and library/camera picker; email/password manager/autofill and keyboard; Apple/Google authorization only when enabled; HealthKit/Health Connect permissions/settings; notification permission/system settings; native DateTimePicker; OS Share sheet/clipboard fallback; Alert.alert confirmations; external browser for approved legal/support/checkout destinations. Keep OS-native UI. Exact native appearance and permission behavior requires a device/native build, not HTML preview. Confirmation titles and callbacks remain in their owner source; styling work must not replace cancel/destructive semantics or introduce new operations.

## Navigation and compatibility entries

The current default is the premium five-tab app. Historical preview routes now redirect to it; there is no separate functioning old-app comparison tree in these route files. Preserve this actual behavior rather than reintroducing old designs from earlier reports.

Dynamic cases: `friends.tsx` builds `/friends/${encodeURIComponent(uid)}/progress` and `/workouts` destinations with display-name query parameters; names never establish ownership. Calendar/Add meal and scanner handoffs preserve `date`/meal/return parameters. Workout routes carry session IDs, fresh-start flags and template seeds. `lib/useTabAwareRouter.ts`/`lib/canonicalDestination.ts` normalize legacy paths while preserving parameters. Static navigation-string search alone would miss these links.

| File (routing-only) | Existing resolution | Count policy / verification |
|---|---|---|
| `app/(modals)/account-center.tsx` | `/account` | No extra visual screen; 14A direct-link/query/back test |
| `app/(modals)/add-meal-old.tsx` | `/(modals)/add-meal` | No extra visual screen; 14A direct-link/query/back test |
| `app/(modals)/bodyTwin/index.tsx` | `/(modals)/body-metrics` | No extra visual screen; 14A direct-link/query/back test |
| `app/(modals)/bodyTwin/settings.tsx` | `/(modals)/body-metrics` | No extra visual screen; 14A direct-link/query/back test |
| `app/(modals)/control-center.tsx` | `/(modals)/settings` | No extra visual screen; 14A direct-link/query/back test |
| `app/(modals)/scan-meal-v2.tsx` | Reexports `app/nutrition/scan-meal-v2.tsx` | No extra visual screen; 14A direct-link/query/back test |
| `app/(modals)/scan-meal.tsx` | Reexports `app/nutrition/scan-meal.tsx` | No extra visual screen; 14A direct-link/query/back test |
| `app/account/badges.tsx` | `/(modals)/badges` | No extra visual screen; 14A direct-link/query/back test |
| `app/account/edit-profile.tsx` | `/account` | No extra visual screen; 14A direct-link/query/back test |
| `app/account/privacy.tsx` | `/profile/friend-visibility` | No extra visual screen; 14A direct-link/query/back test |
| `app/account/subscription.tsx` | `/account` | No extra visual screen; 14A direct-link/query/back test |
| `app/dashboard-preview.tsx` | `/(tabs)` | No extra visual screen; 14A direct-link/query/back test |
| `app/design-preview/index.tsx` | `/(tabs)` | No extra visual screen; 14A direct-link/query/back test |
| `app/design-preview/notifications.tsx` | `/(tabs)/notifications` | No extra visual screen; 14A direct-link/query/back test |
| `app/design-preview/nutrition.tsx` | `/(tabs)/nutrition` | No extra visual screen; 14A direct-link/query/back test |
| `app/design-preview/profile.tsx` | `/(tabs)/profile` | No extra visual screen; 14A direct-link/query/back test |
| `app/design-preview/workouts.tsx` | `/(tabs)/workouts` | No extra visual screen; 14A direct-link/query/back test |
| `app/index.tsx` | `/(tabs)`, `/(auth)/login` | No extra visual screen; 14A direct-link/query/back test |
| `app/insights.tsx` | `/profile/insights-progress` | No extra visual screen; 14A direct-link/query/back test |
| `app/nutrition/scan-meal(old).tsx` | `/nutrition/scan-meal` | No extra visual screen; 14A direct-link/query/back test |
| `app/old/add-meal(old).tsx` | `/(modals)/add-meal` | No extra visual screen; 14A direct-link/query/back test |
| `app/old/friends(old).tsx` | `/friends` | No extra visual screen; 14A direct-link/query/back test |
| `app/old/session-old.tsx` | `/workouts/session` | No extra visual screen; 14A direct-link/query/back test |
| `app/profile(old)/profile(old).tsx` | `/(tabs)/profile` | No extra visual screen; 14A direct-link/query/back test |

| Layout | Responsibility / verification (14A) |
|---|---|
| `app/(auth)/_layout.tsx` | Auth stack and auth appearance; no extra screen. |
| `app/(modals)/_layout.tsx` | Fullscreen modal presentation and return stack; scanner reexports need both-entry checks. |
| `app/(tabs)/_layout.tsx` | Five tabs in existing order, unread subscription, Android back, keyboard/tab safe-area behavior. |
| `app/_layout.tsx` | Auth/session gate, providers, safe area, root stack and notification routing; G01 counted separately. |
| `app/design-preview/_layout.tsx` | Legacy route host for redirect entries; not an alternate app. |
| `app/workouts/_layout.tsx` | Workout stack shell and back transitions. |

## Shared functional source map

Direct imports in each record are supplemented by these shared paths; do not mistake a view wrapper for an independent store.

| Shared controller/view | Real data/action dependency | Consumers / protected distinction |
|---|---|---|
| `components/designPreview/usePreviewAccount.ts` | `services/profile.ts`, `services/nutrition.ts`, `services/profile/accountWeightEntries.ts`, `services/fitadapt.ts`, `services/dashboardPreviewData.ts` → `services/nutritionTargets.ts` | H01/N00/P00: UID-and-date-tagged subscriptions, account weights/steps and real foods; focus refresh is get-plan, not an automatic evaluation |
| `hooks/useFitAdaptReviewState.ts` | Existing authenticated FitAdapt service and plan-presentation helpers | P00 and setup handoff: request/retry/explicit accept/decline; accepted/current targets never sourced from pending proposal |
| `components/homeFlows/FitAdaptInsightsView.tsx` | P11 controller → account weight entries, foods-between, profile dated steps, `services/profile/fitadaptHistory.ts` | Read-only bounded events and measured data; device-only body history excluded |
| `components/friends/SharedSummary.tsx` | `hooks/useFriendSummary.ts`, existing safe friend-summary service/callable, permission/consent helpers | S01–S05/O31: explicit redacted modes, private/unavailable fields and owner preview; no raw friend-document fallback |
| `components/somata/ConnectionsDesk.tsx` | Existing integration service, UID accountStore and native capabilities | T02/T03/O34: provider permissions, source preferences and local sync records, not an unconditionally available cloud integration |
| `content/AuthContext.tsx` | Firebase auth, local account store/migration, reminder cleanup | G02: unmount old account views and fail closed on preparation error before displaying the next account |

## Import-reachability appendix: component inventory

Every component-path module below was checked against the route import closure. **50 modules are transitively imported**, including nonvisual helpers/types; import presence alone does not mean every exported component renders. The component plan identifies rendered exports and consolidation choices. Modules outside this closure are retained, not deleted or scheduled as additional screens. This is static evidence; native dynamic imports or future entry points require rechecking before removal. Deep-link-only route imports are included in the closure.

### Imported component modules

- `components/accountSettings/Primitives.tsx`
- `components/accountSettings/useProfileFlowTheme.ts`
- `components/accountSettings/visualTokens.ts`
- `components/activity/ActivityLogSheet.tsx`
- `components/activity/activityTypes.ts`
- `components/activity/activityUtils.ts`
- `components/alerts/PremiumAlertsUI.tsx`
- `components/brand/Brand.tsx`
- `components/brand/SomataIcon.tsx`
- `components/calendar/DayDetailSheet.tsx`
- `components/designPreview/Appearance.tsx`
- `components/designPreview/UI.tsx`
- `components/designPreview/presentationColors.ts`
- `components/designPreview/usePreviewAccount.ts`
- `components/exercises/ExercisePreviewSheet.tsx`
- `components/exercises/FilterBar.tsx`
- `components/friends/SharedSummary.tsx`
- `components/friends/premium/FriendsAddSheet.tsx`
- `components/friends/premium/PremiumSegmented.tsx`
- `components/home/PremiumHomeUI.tsx`
- `components/home/premiumTheme.ts`
- `components/homeFlows/BadgeCollection.tsx`
- `components/homeFlows/FitAdaptInsightsView.tsx`
- `components/homeFlows/FlowUI.tsx`
- `components/nutrition/PremiumNutritionUI.tsx`
- `components/nutrition/uiNew/EditFoodSheet.tsx`
- `components/profile/PremiumProfileUI.tsx`
- `components/profile/overviewData.ts`
- `components/profile/premium/bodyMetrics/MetricPickerSheet.tsx`
- `components/profile/premium/ui.ts`
- `components/scanMeal/new/AddFoodSheet.tsx`
- `components/scanMeal/new/EditFoodSheet.tsx`
- `components/scanMeal/new/ExplainAIModal.tsx`
- `components/scanMeal/new/MealCategoryPills.tsx`
- `components/scanMeal/new/services/macroMath.ts`
- `components/scanMeal/new/services/scanMealService.ts`
- `components/scanMeal/new/types.ts`
- `components/somata/AuthControls.tsx`
- `components/somata/AuthUI.tsx`
- `components/somata/CalendarRecord.tsx`
- `components/somata/ConnectionsDesk.tsx`
- `components/somata/ScanItems.tsx`
- `components/somata/TaskUI.tsx`
- `components/somata/Trend.tsx`
- `components/somata/authPalette.ts`
- `components/somata/theme.ts`
- `components/somata/trendGeometry.ts`
- `components/workouts/PremiumWorkoutsUI.tsx`
- `components/workouts/sessionDraft.ts`
- `components/workouts/utils/withAlpha.ts`

### 175 component-path modules with no current route import path

- `components/Card.tsx`
- `components/ThemeToggle.tsx`
- `components/WaterBottleCardRealistic.tsx`
- `components/account(old)/AccountHeader.tsx`
- `components/account(old)/AccountRow.tsx`
- `components/account(old)/AccountSection.tsx`
- `components/account(old)/ThemePickerSheet.tsx`
- `components/accountCenter/AccountCenterHeader.tsx`
- `components/accountCenter/AccountCenterRow.tsx`
- `components/accountCenter/AccountCenterSection.tsx`
- `components/accountSettings/FlowAtmosphere.tsx`
- `components/activity/ActivityCard.tsx`
- `components/alerts/AlertRow.tsx`
- `components/alerts/AlertsEmptyState.tsx`
- `components/alerts/AlertsSectionHeader.tsx`
- `components/alerts/adapter.ts`
- `components/alerts/logic.ts`
- `components/alerts/types.ts`
- `components/badges/BadgeCelebrate.tsx`
- `components/badges/BadgeGrid.tsx`
- `components/badges/new/BadgeCard.tsx`
- `components/badges/new/BadgeDetailSheet.tsx`
- `components/badges/new/BadgeMedalion.tsx`
- `components/badges/new/BadgeUnlockToast.tsx`
- `components/calendar/CalendarLegendPills.tsx`
- `components/calendar/CalendarMonthGrid.tsx`
- `components/calendar/DayCell.tsx`
- `components/calendar/FullCalendarScreen.tsx`
- `components/calendar/StreakHeader.tsx`
- `components/calendar/utils/calendarData.ts`
- `components/charts/MacrosStackedBars.tsx`
- `components/charts/NetAreaChart.tsx`
- `components/dashboardPreview/ReferenceDashboard.tsx`
- `components/exercises/ExerciseCard.tsx`
- `components/friends/ActionSheet.tsx`
- `components/friends/AddFriendSheet.tsx`
- `components/friends/EmptyState.tsx`
- `components/friends/FriendDetailHeader.tsx`
- `components/friends/FriendRow.tsx`
- `components/friends/GlassPill.tsx`
- `components/friends/GlassStat.tsx`
- `components/friends/RequestRow.tsx`
- `components/friends/SegmentedControl.tsx`
- `components/friends/TimeFramePills.tsx`
- `components/friends/premium/FriendRowPremium.tsx`
- `components/friends/premium/FriendsActionSheet.tsx`
- `components/friends/premium/RequestRowPremium.tsx`
- `components/health/HealthConnectCard.tsx`
- `components/home/AISuggestionCard.tsx`
- `components/home/AnimatedStepPill.tsx`
- `components/home/MetricRing.tsx`
- `components/home/QuickActionRow.tsx`
- `components/insights/InsightCard.tsx`
- `components/insights/TrendMiniChart.tsx`
- `components/nutrition/AddFoodCard(old).tsx`
- `components/nutrition/AiDescribeCard(old).tsx`
- `components/nutrition/ExerciseCard(old).tsx`
- `components/nutrition/Header(old).tsx`
- `components/nutrition/MealSection(old).tsx`
- `components/nutrition/new(ALL NOT USED)/AddMealSheet.tsx`
- `components/nutrition/new(ALL NOT USED)/DayHeader.tsx`
- `components/nutrition/new(ALL NOT USED)/Glass.tsx`
- `components/nutrition/new(ALL NOT USED)/HistorySheet.tsx`
- `components/nutrition/new(ALL NOT USED)/HydrationCard.tsx`
- `components/nutrition/new(ALL NOT USED)/MealSection.tsx`
- `components/nutrition/new(ALL NOT USED)/NutritionScreen(old).tsx`
- `components/nutrition/new(ALL NOT USED)/NutritionTheme.ts`
- `components/nutrition/new(ALL NOT USED)/NutritionTypes.ts`
- `components/nutrition/new(ALL NOT USED)/RingSummaryCard.tsx`
- `components/nutrition/new(ALL NOT USED)/nutritionStore.ts`
- `components/nutrition/new(ALL NOT USED)/utils.ts`
- `components/nutrition/ui/AnimatedRing(old).tsx`
- `components/nutrition/ui/Field(old).tsx`
- `components/nutrition/ui/IconButton(old).tsx`
- `components/nutrition/ui/MacroBar(old).tsx`
- `components/nutrition/ui/MealSegmented(old).tsx`
- `components/nutrition/ui/Metric(old).tsx`
- `components/nutrition/uiNew/AnimatedRing.tsx`
- `components/nutrition/uiNew/DailyGoalsCard.tsx`
- `components/nutrition/uiNew/DayStrip.tsx`
- `components/nutrition/uiNew/GlassCard.tsx`
- `components/nutrition/uiNew/HydrationCard.tsx`
- `components/nutrition/uiNew/HydrationCardPremium.tsx`
- `components/nutrition/uiNew/MacroCompletionCard.tsx`
- `components/nutrition/uiNew/MealCard.tsx`
- `components/nutrition/uiNew/MealHealthScoreIndicator.tsx`
- `components/nutrition/uiNew/NutritionCalendarStrip.tsx`
- `components/nutrition/uiNew/NutritionSummaryCard.tsx`
- `components/nutrition/uiNew/PremiumHydrationBottle.tsx`
- `components/nutrition/uiNew/SectionHeader.tsx`
- `components/nutrition/utils/withAlpha.ts`
- `components/profile/FitAdaptReview.tsx`
- `components/profile/MacroGoalsCard.tsx`
- `components/profile/ProgressPhotos.tsx`
- `components/profile/WeeklyCheckin.tsx`
- `components/profile/cards/AdvancedCard.tsx`
- `components/profile/cards/BasicsCard.tsx`
- `components/profile/cards/DietPreferencesCard.tsx`
- `components/profile/cards/GoalSummaryCard.tsx`
- `components/profile/cards/GoalsMacrosCard.tsx`
- `components/profile/cards/MacroMethodExplainer.tsx`
- `components/profile/cards/MealScheduleCard.tsx`
- `components/profile/cards/MealTimingHintCard.tsx`
- `components/profile/premium/AppearenceCard.tsx`
- `components/profile/premium/BadgesPreviewReviewCard.tsx`
- `components/profile/premium/BodyTwinEvolveCard.tsx`
- `components/profile/premium/EmptyState.tsx`
- `components/profile/premium/FriendsPreviewCard.tsx`
- `components/profile/premium/GlassCard.tsx`
- `components/profile/premium/MetricsCard.tsx`
- `components/profile/premium/PremiumProfileHeader.tsx`
- `components/profile/premium/TrendsCard.tsx`
- `components/profile/premium/bodyMetrics/BodyMetricRow.tsx`
- `components/profile/premium/bodyMetrics/TrendMini.tsx`
- `components/profile/premium/bodyTwin/AvatarStage.tsx`
- `components/profile/premium/bodyTwin/CustomizationSheet.tsx`
- `components/profile/ui(NOT USED)/Field.tsx`
- `components/profile/ui(NOT USED)/Glass.tsx`
- `components/profile/ui(NOT USED)/PctField.tsx`
- `components/profile/ui(NOT USED)/Pill.tsx`
- `components/profile/ui(NOT USED)/Segmented.tsx`
- `components/profile/ui(NOT USED)/SummaryCard.tsx`
- `components/profile/uiNew/GlassAccordion.tsx`
- `components/profile/uiNew/GlassSurface.tsx`
- `components/profile/uiNew/ProfileHero.tsx`
- `components/profile/uiNew/SectionDock.tsx`
- `components/profile/uiNew/TargetsGlassPanel.tsx`
- `components/scanMeal/new/BottomActionBar.tsx`
- `components/scanMeal/new/ConfidenceLegend.tsx`
- `components/scanMeal/new/DetectedFoodList.tsx`
- `components/scanMeal/new/ExplainAIButton.tsx`
- `components/scanMeal/new/FoodRow.tsx`
- `components/scanMeal/new/MacroSummaryCard.tsx`
- `components/scanMeal/new/PhotoCard.tsx`
- `components/scanMeal/new/ScanMealHeader.tsx`
- `components/scanMeal/new/Toast.tsx`
- `components/scanMeal/new/bodyTwin/AchievementToast.tsx`
- `components/scanMeal/new/bodyTwin/BodyTwinAvatar.tsx`
- `components/scanMeal/new/bodyTwin/BodyTwinCard.tsx`
- `components/scanMeal/new/bodyTwin/BodyTwinCustomizeSheet.tsx`
- `components/scanMeal/new/bodyTwin/FutureSelfSheet.tsx`
- `components/scanMeal/new/services/logMealService.ts`
- `components/scanMeal/old/DetectedFoodCard.tsx`
- `components/scanMeal/old/MacroSummaryCard.tsx`
- `components/scanMeal/old/MealCategoryPills.tsx`
- `components/scanMeal/old/PortionControl.tsx`
- `components/scanMeal/old/ProcessingOverlay.tsx`
- `components/scanMeal/old/ScanMealCamera.tsx`
- `components/settings/PremiumSheet.tsx`
- `components/settings/SettingsPrimitives.tsx`
- `components/settings/ThemeChooser.tsx`
- `components/settings/ThemeChooserCard.tsx`
- `components/settings/ThemeModeSheet.tsx`
- `components/ui/BottomTapSpacer.tsx`
- `components/ui/EmptySuggestions.tsx`
- `components/ui/PremiumModalSheet.tsx`
- `components/workouts/AddWorkoutForm.tsx`
- `components/workouts/ExerciseSearchSheet.tsx`
- `components/workouts/Filters.tsx`
- `components/workouts/GroupedWorkouts.tsx`
- `components/workouts/Hero.tsx`
- `components/workouts/WeightPileBadge.tsx`
- `components/workouts/WeightPlateStacker.tsx`
- `components/workouts/WorkoutGenerator.tsx`
- `components/workouts/ui/Badge.tsx`
- `components/workouts/ui/CoachSparkCardPremium.tsx`
- `components/workouts/ui/EmptyState.tsx`
- `components/workouts/ui/Field.tsx`
- `components/workouts/ui/GradientButton.tsx`
- `components/workouts/ui/IconButton.tsx`
- `components/workouts/ui/Metric.tsx`
- `components/workouts/ui/SoftButton.tsx`
- `components/workouts/ui/TemplatesSectionPremium.tsx`
- `components/workouts/ui/WorkoutEntryCard.tsx`
- `components/workouts/ui/WorkoutSessionHeroCard.tsx`

Additional non-route TSX files: `archive/settings(old).tsx` is an archived implementation; `review/profile-assets/ProfileAssetReview.tsx` and `review/branding-5a/WorkoutImageReview.tsx` are offline visual-review fixtures, not application routes. None adds a live user-facing surface.

These include previous Account/Account Center shells, old nutrition/profile UI, unused settings choosers, dashboard preview, BodyTwin avatars, earlier workout cards and the standalone FitAdaptReview. They are not a mandate to revive features. Existing components with business logic are especially unsuitable as a visual foundation without tracing their side effects.

## Audit limitations and validation

- `pnpm typecheck`: passed; no TypeScript diagnostics. `pnpm test`: 156 passed, 0 failed, 0 skipped. These are current local checks, not device or cloud results. No new tests are needed for documentation-only changes.
- `xcrun simctl list devices booted`: failed in this environment with CoreSimulatorService connection invalid/refused and unavailable device set. No native screenshots or permission checks were performed.
- No Expo export rerun: this audit changes only Markdown. Existing preview HTML/PNGs were not overwritten. Future implementation gates are in the roadmap.
- No runtime account walkthrough or real-user data inspection was performed. Four deep-link-only routes, platform-owned UI, incomplete error handling in legacy views, older local-history provenance and calculated metrics need manual confirmation in their assigned checkpoint.
- No app file, approved asset, configuration, backend or existing debug log is intentionally changed. Review these documents before implementing 8B.
