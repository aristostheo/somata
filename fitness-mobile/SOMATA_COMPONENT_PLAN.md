# Somata premium component plan — Branding 8A

2026-10-19 · `profile-redesign` · **Proposal, not implementation.** This document and the [screen registry](SOMATA_SCREEN_REGISTRY.md) describe current source behavior. The [roadmap](SOMATA_REDESIGN_ROADMAP.md) assigns each surface to an independently reviewable checkpoint. No new theme provider, screen, asset, dependency or business rule is introduced here.

## Design authority and compatibility

The five approved implementations are the visual reference:

| Approved route | Presentation source | Pattern to carry forward |
|---|---|---|
| Home | `components/home/PremiumHomeUI.tsx`, `components/home/premiumTheme.ts` | Task-focused header, energy hero, compact secondary metrics, explicit next action, quick actions and navigation rows |
| Nutrition | `components/nutrition/PremiumNutritionUI.tsx` | Date-led record, real energy gauge, nutrient hierarchy, compact goal rows, grouped meal timeline and focused tools |
| Workouts | `components/workouts/PremiumWorkoutsUI.tsx` | Bounded photo hero, native actions, measured history bars, distinct built-in versus personal template desks |
| Profile | `components/profile/PremiumProfileUI.tsx` | Identity, accepted plan/saved goals, separate review state, measured progress, compact record/settings/collection groups |
| Alerts | `components/alerts/PremiumAlertsUI.tsx` | Signal header, category context, compact filter rail, legible virtualized inbox with unread/action hierarchy |

These are patterns, not five interchangeable templates. Editors need focused fields and stable save controls; history needs filters and readable records; scanner review needs image/result comparison. Do not put a large decorative dashboard hero above every form.

`content/ThemeProvider.tsx` remains the sole owner of mode, separate light/dark palette choices, persistence and `commitThemeDraft`. `services/theme/semanticTokens.ts` provides pure mode-aware brand tokens. `components/designPreview/Appearance.tsx` already supplies an **opt-in presentation context**, not a second stored theme. Keep that architecture; a clearer name can be considered separately, but route/storage renaming is unnecessary for migration.

### Observed split that must be handled deliberately

- `components/somata/theme.ts` returns both semantic tokens and legacy D/F. Legacy canvas/card/lime/teal/primary values remain in many subpages. The current palette defaults and saved customization are not evidence of user permission to overwrite preferences.
- `SomataHomeAppearance` + `usePresentation` maps legacy-shaped presentation colors for opted-in consumers. **TaskUI directly calls `useSomataTheme`, so wrapping a route alone does not update its controls.** FlowUI and inline styles need the same deliberate treatment.
- The static graph finds **61 direct reachable importers of TaskUI**, **54 of useSomataTheme**, **15 of useProfileFlowTheme**, and **4 of FlowUI**. These counts include component modules, not just screens. They establish leverage and regression scope, not safe permission for a global replacement.
- `useProfileFlowTheme` blends D/F surfaces with existing ThemeProvider colors. `accountSettings/Primitives.tsx` is still imported for `useScreenPalette` by Account and Settings; its earlier Screen/Section/Row exports are not their current layout. Do not refactor unused exports as if they are live UI.
- Unused StyleSheet/color constants remain at the bottom of some migrated files. A hex-code search reports both active and inactive styles. Confirm the JSX consumer before assigning an inconsistency or deleting code.

## Approved visual rules and their source

| Element | Current evidence / proposed common rule for secondary surfaces |
|---|---|
| Palette | Charcoal `#0B0E12`, Graphite `#1A1F26`, Slate `#38434D`, Bone `#F4F3EE`, Orange `#FF6A00`, Coral `#FF5A2A`, Energy Yellow `#FFC629`; reuse `SOMATA_BRAND`, no duplicate palette constant |
| Surfaces | Semantic canvas/primary/secondary/inset; dark low-glare graphite, light bone/white/grey. `premiumHomeTheme` adds bounded warm/neutral gradients, dark `#10171C` surface and `#82442C` warm edge. Decoration stays inside card bounds and behind native content |
| Light mode | White/bone surfaces, restrained peach lighting; primary ink charcoal, secondary slate. Small warm action text uses `#B33B00`, not raw orange on white. Do not invert a dark screenshot or use white text on an untested bright CTA |
| Text | Semantic title 32/800, heading 20/700, body 16/24, caption 13/19, label 14/700, metric 32/800. Approved tabs intentionally vary: headings roughly 32–34, small eyebrow 10–11 with tracking, compact values 23–25 and large energy values. Use hierarchy, not one fixed font size everywhere; retain system scaling and tabular numeric text |
| Spacing | Existing token steps 4/8/12/16/20/24/32; primary page padding generally 16–20; compact controls separated from larger sections. Use content height, not fixed text boxes. Wrap paired fields/cards to one column at narrow width or large text |
| Corners and borders | Semantic control/card/hero radii 14/20/24, pills 999. Approved cards vary around 16–22 and controls 12–15. Extend existing recipes rather than forcing all current approved cards to one number. One subtle edge; stronger warm edge only for selected/primary context |
| Elevation/lighting | Low-opacity shadow and local warm tint/gradient, never glow behind body text. No mandatory blur or per-card animation. Root background remains calm; bounded approved artwork is decorative only |
| Action priority | One obvious primary action, gradient amber→orange→coral where appropriate and charcoal foreground; secondary raised/inset surface; text links in mode-correct accent ink. Destructive operations use semantic error text plus explicit confirmation, not a normal orange CTA |
| Inputs | Extend TaskUI Field: persistent label, readable filled/empty/disabled/error values, subtle control border, focus ring; preserve exact TextInput props/ref/keyboard/validation and imperative focus behavior |
| Selected state | Selection background/foreground/border tokens plus selected semantics and check/indicator. Do not rely on hue alone. Use accessible state for disabled, selected, expanded and busy |
| Icons | Keep established Ionicons for working actions. Reuse exact S3/F3 from `components/brand/Brand.tsx` with bounded aspect ratio/contain. No text/emoji replacement logos. Asset navigation trial remains a separate visual decision |
| Navigation | Current five tabs: Home, Workouts, Nutrition, Alerts, Profile. Floating rounded bar, semantic active/inactive colors and unread indicator; current outline icons are 24 px. Supplied asset trial size 28 px is not a mandate to replace icons or add tabs. Back/dismiss remain separate from destructive cancel |
| Touch/contrast | Target minimum 48-point control area from semantic tokens; don't copy small visual glyph size into hit area. Current TaskUI Choice/Item and Flow ChoiceRail have some 46/47-point minimums: adjust only in scoped migration with reflow review. Aim 4.5:1 normal text, 3:1 large text and essential UI boundaries; test rendered gradients, not just flat tokens |
| Motion | Existing token durations press 120 ms / transition 180 ms; follow reduced-motion setting. TaskSheet already avoids slide animation under reduced motion. No new constant shimmer, synthetic live chart or motion necessary for visual parity |
| Status/data | Success green, warning yellow, error coral/red and information blue remain semantic. Unknown stays unknown; zero stays zero. Data series get labels/units/legends and gaps. Do not paint all health/status categories orange |

### Data color inconsistency needing a deliberate later decision

The foundation's `semantic.data` maps protein blue, carbohydrate yellow and fat coral. Approved Home's recipe maps protein warm, carbohydrate blue and fat purple; approved Nutrition uses warm protein, blue carbs and warning/yellow fat. This is a **real naming/series inconsistency**, not permission to replace every blue/purple value. For each migration, retain the nearest approved parent screen's meaningful series colors and explicit legend; use common surface/action tokens. Before a final global data-color consolidation, review one cross-screen legend comparison and approve a single mapping. No chart calculations or stored preferences change with that decision.

Likewise, clarify the eventual product relationship between fixed official brand controls and user-chosen palettes. Current tabs use brand semantic styling while Theme Picker stores custom light/dark accents for legacy consumers. Preserve both behaviors during migration; do not turn saved custom colors into an unexplained no-op, silently overwrite them, or change Save/Cancel to live persistence. A future decision can define where personalization remains visible.

## Existing component audit and proposed action

Paths below are relative to `fitness-mobile/`. Extend a small existing primitive only when at least two live consumers need the same contract. Keep task-specific view composition in its feature file.

| Capability / live implementation | Recommendation | Contract that must stay intact |
|---|---|---|
| TaskPage in `components/somata/TaskUI.tsx` | Extend through existing opt-in appearance with semantic header/surface/spacing; scoped pilot in Sync history | onBack, action/footer slots, scroll=false, keyboard avoidance, safe-area padding, scroll taps |
| FlowPage in `components/homeFlows/FlowUI.tsx` | Align its header/body rhythm with same tokens; retain as thin composition for read-only history, no new competing Page class | Back and supplied children; existing SomataSymbol and safe-area behavior |
| Panel/Heading in TaskUI; Card/Section recipes in PremiumHomeUI | Factor only shared surface recipe into existing `premiumTheme.ts` or pure sibling when proven needed; extend Panel variants for quiet, selected and caution | Arbitrary children, header actions, text wrapping; no service fetch inside Card |
| Button/IconButton in TaskUI; Home Action and feature Action wrappers | Align primary/secondary/danger/disabled/focus presentation, retaining established callbacks and busy guards in controllers | Semantic role/label, disabled, press/long-press where present, dynamic text height |
| Field in TaskUI; AuthControls fields | Extend TaskUI decoration/accessibility only; retain already branded auth fields | Ref forwarding, secure entry, keyboard type, value/change events, errors and labels; no trimming/parsing inside visual wrapper |
| Choice/Toggle in TaskUI; ChoiceRail in FlowUI | One token vocabulary, not necessarily one implementation. Keep chips wrapping or horizontally scrolling according to context | Selection values and change callbacks, switch immediate persistence, disabled state |
| Item in TaskUI; feature navigation rows | Align icon tile, typography, chevron/secondary text and hit areas | Entire-row versus nested action semantics, read-only rows, trailing controls, no duplicate press events |
| Search/filter interfaces | Use existing Field/Choice + `components/exercises/FilterBar.tsx`, `components/friends/premium/PremiumSegmented.tsx`; common decoration, preserve feature-specific query logic | Debounce/search state and source selection remain in existing controllers/hooks |
| TaskSheet | Highest-value shared overlay. Extend opt-in surface/heading/action treatment and accessible labels after a pilot; retain native Modal host | onRequestClose, backdrop close policy, keyboard, scroll, bottom inset, maxHeight, reduced motion; never auto-save on dismissal |
| Inline Home/Workouts Modals | Later adopt same visual recipe for O01/O02 without moving/changing parent tab content | Add versus set steps, planned-session fields, submit/cancel and busy guards |
| Confirmation controls | Retain existing Alert.alert and custom O13/O14/O29; standardize custom dialog presentation, not confirmation business logic | Destructive/cancel roles and exact callbacks; recalc is not FitAdapt acceptance |
| Empty/Metric in TaskUI; FlowNotice/SmallStat; approved InboxState | Align text, icon, surface and optional supplied retry action. Reuse one notice recipe instead of generic “not ready” alerts | No fallback numeric zero, no fabricated record, no retry if controller lacks safe retry; loading is not empty |
| Progress visuals in approved Home/Nutrition | Reuse pure visuals where inputs match; keep domain target projection outside | Explicit numerator/denominator, unknown/over-target label, accessibility value; pending targets never passed as active |
| `components/somata/Trend.tsx` + `trendGeometry.ts` | Keep geometry/data helper; migrate presentation/legend only. Use explicit per-series colors | Missing-point segmentation, date ordering and measured provenance; no smoothing that invents history |
| Inline Advanced Metrics charts | Migrate desk by desk in P10; extract only duplicated presentation after evidence | Scenarios/estimates/calculated outputs remain honestly labeled and computed identically |
| `components/somata/CalendarRecord.tsx` + calendar DayDetailSheet | Reuse read-only day content and its specific row interactions | Selected date, source records, dated Add food; no duplicate aggregation |
| `components/nutrition/uiNew/EditFoodSheet.tsx` | Keep live editor, align surface/inputs/actions | Quantity scaling from original, custom units, manual nutrients, save/delete callbacks |
| `components/somata/ScanItems.tsx`; scanMeal/new AddFoodSheet/EditFoodSheet/ExplainAIModal/MealCategoryPills | Align both scanner implementations through these shared presentation points | AI review before save, supported edits/units, original response validation, category state |
| `components/activity/ActivityLogSheet.tsx` | Keep quick/manual/edit variants in one sheet | Existing presets/optional values, validation, UID-scoped save/update |
| `components/exercises/ExercisePreviewSheet.tsx` | New focused visual composition using the existing data | Instruction/media fallback, favorites and selection callback |
| `components/profile/premium/bodyMetrics/MetricPickerSheet.tsx` | Shared picker treatment; no copy per body field | Field limits, measurement units, scroll selection, apply/cancel |
| `components/homeFlows/BadgeCollection.tsx` | Align collection and detail together; retain locked/earned distinction | Existing registry/reconciliation/progress source and reduced-motion Modal |
| `components/homeFlows/FitAdaptInsightsView.tsx` | Keep read-only view model and event/trend controls; align with Profile warm surfaces | Bounded history, actual persisted event fields, load more/error; no rationale/forecast invention |
| `components/friends/SharedSummary.tsx`, FriendsAddSheet, PremiumSegmented | Extend shared redacted summary composition once, review each mode | Authenticated callable, friendship/consent state, no private document fallback; template copy refetch |
| `components/somata/ConnectionsDesk.tsx` | Align provider list/details/status, retain capability-driven controls | Native module availability, permission/sync callbacks, local history and source priority |
| `components/brand/Brand.tsx`, SomataIcon | Leave artwork logic unchanged | Exact reconciled S3/F3, contain/aspect ratio, mode-specific lettering; caller controls valid FitAdapt attribution |
| AuthContext secure preparation gate | Keep fail-closed provider order and cleanup logic; plan an isolated pre-provider visual fallback for spinner/error/retry at final QA | ThemeProvider is not mounted yet; never mount private children early or introduce another stored theme |
| AuthUI/AuthControls/authPalette | Leave established compact S3/auth design; review with final navigation/keyboard QA | Provider configuration, remember-me/session restoration, form validation, recent reauth |
| `accountSettings/useProfileFlowTheme.ts`, Primitives/useScreenPalette, visualTokens | Plan gradual retirement of redundant visual mappings only after actual consumers migrate | Preserve ThemeProvider as data authority; do not remove unused exports in a presentation checkpoint |
| Dormant `settings/SettingsPrimitives`, PremiumSheet, ui/PremiumModalSheet, older cards/sheets | Do not adopt or rewrite simply because their name says “Premium” | No current route import path; deletion/cleanup is out of scope |

All 225 component-path modules are accounted for by the registry's 50 imported and 175 no-route-import-path lists. Nonvisual helper/type modules are not counted as independent reusable UI or screens.

## Safe migration mechanics

1. Freeze the assigned screen's route/action/state contract from the registry and inspect current source again. Prior work may have changed it since this audit.
2. Capture old layout with clearly synthetic fixtures and list actual states missing a renderer. Keep source assets and real data untouched.
3. Extend the existing appearance mechanism so **only opted-in primitives/consumers** receive premium recipes. Keep exports stable; do not change default D/F globally. Capture one unopted screen alongside the pilot to prove no spillover.
4. Build task-appropriate compositions with existing Field/Button/Sheet/Panel, not a full-page background wrapper. Keep data hooks, calculations, subscriptions, state lifetimes and action callbacks in their current owners. Do not copy screen business logic into a preview component.
5. Check both inline `D/F` usage and nested overlays. Some fields use `useProfileFlowTheme` or other palette hooks; documenting the boundary is safer than overriding every `primary` string.
6. Review all states together. Return/save/cancel, pending data, retained drafts, validation and UID ownership must behave identically. If source lacks safe behavior, document the defect and request a separate functional scope; do not silently add a feature under styling.
7. Run affected behavior tests plus full mobile typecheck/tests. Export both platforms after implementation. Perform relevant native checks; stop for visual approval before the next family.
8. Keep checkpoint changes reversible by bounded file scope; no route renames, schema migrations, new provider state, or wholesale replacement of approved screens.

### Functional boundaries that presentation cannot cross

- Nutrition targets: `services/nutritionTargets.ts` remains authoritative accepted projection → saved goals fallback. Existing period summaries must not imply historic targets unless supported by actual effective records. Don't add another calculator to a visual component.
- FitAdapt: `hooks/useFitAdaptReviewState.ts`, profile plan presentation helpers, existing callable service and persisted history remain the sole flows. Pending review cannot replace active targets; explicit accept/decline only. No new history, attribution claims or automatic requests.
- AI/scanning: trusted authenticated service boundary; native review/confirmation before logging; no client credential or fabricated provider result; avoid paid requests during screenshot generation.
- Nutrition/scan handoffs: preserve current UID-scoped queue/payload consumption, selected date and duplicate/stale checks.
- Workouts: preserve draft ownership, seeded session behavior, units and session/template distinction. Purely visual exercise cards must not mark sets complete or write history.
- Social: `SharedSummary` is the safe allowlisted path. Private/unavailable is meaningful content. Never recover “missing” details by directly reading a friend's private documents.
- Settings: distinguish immediate toggles from drafts; theme Save/Cancel unchanged. System accessibility status is not a new local accessibility preference.
- Deletion/auth: recent reauthentication, explicit confirmation, server cleanup/retry/retention blockers and local account clearing remain intact. Synthetic accounts for destructive verification.
- Notifications: unread/read timestamps, filtering, dismissal, routing and subscriptions remain unchanged. Reference screenshots do not authorize creating additional notification categories or actions.

## Known limitations to carry into review

- Quick hydration N08 appends to `hydration:quickLogs:${uid}`, shows a saved toast and closes; it is **not a history editor**, and the current catch ignores storage failures. Do not advertise a history/clear flow or claim failure handling is sound. Record this for a separate behavioral fix.
- Step-history totals/averages have existing missing-day aggregation assumptions even though visible rows distinguish recorded dates. Advanced Metrics and older Insights mix local history, calculated scenarios and account records. Preserve calculations in visual work; separately audit a proposed semantic change before making it.
- Sync history clears immediately through its existing service callback; there is no current confirmation or dedicated clear-failure screen. Preserve that exact behavior during styling; a confirmation addition would be a separate behavior decision.
- Account currently displays name/email/photo and provider labels; it does not offer a full identity-edit form. `account/edit-profile` redirects there. Do not invent editing controls in the redesign.
- Entitlement checkout, legal URLs, native provider setup, external service deployment and deletion retention decisions remain independent release concerns. A beautiful unavailable state does not make a backend available.
- AuthContext has its own preparation/error-retry surface outside ThemeProvider; it is counted as G02 separately from the branded root loading gate. Provider reordering would risk account isolation and is not a visual fix.
- Native screenshot automation is currently unavailable; browser rendering differs in safe areas, text measurement, camera surfaces, native sheets, virtualized lists and focus behavior.

## Foundation acceptance checklist (8B)

- [ ] Existing ThemeProvider remains the only stored mode/palette source; existing theme tests pass.
- [ ] TaskUI/FlowUI opt-in uses approved semantic tokens and preserves legacy defaults elsewhere.
- [ ] One low-risk pilot (T03 Sync history) plus an unchanged control screen is captured dark/light, empty/populated, narrow/large text.
- [ ] Reusable header/card/action/field/notice/sheet recipes are reviewed before broad rollout; unused abstractions are not added speculatively.
- [ ] Focus, disabled, error, destructive and selected treatments pass contrast/readability checks; 48-point targets and scalable labels fit.
- [ ] No approved tab layout, service, storage, permission, theme persistence or brand asset changes.

No foundation changes have been made in Checkpoint 8A.
