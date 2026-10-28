# Home implementation specification — proposed Checkpoint 3B

**Specification only.** `app/(tabs)/index.tsx` and its behavior remain unchanged in 3A. Preserve current information architecture and order: header → energy hero → At a glance → Nutrition pulse → useful next step → Quick actions → Explore → existing bottom navigation.

Use `useTheme().semantic` from the existing provider. The consumer brand is Somata; FitAdapt appears as the secondary engine only under the current accepted-plan guard. Keep approved S3/F3 artwork unmodified. Do not replace a greeting, metric or status label with a logo.

## Visual rules

Charcoal canvas/Graphite cards in dark mode; Bone canvas/white cards in light. Orange for the primary action and energy progress, Coral for restrained brand accents, Yellow only for secondary emphasis or its labeled warning/data role. Remove teal/lime decoration from the Home opt-in presentation; keep semantic feedback distinct. No large watermark, multicolor card wall, fabricated sparkline, or glow behind readable text.

20px page gutters, 20px card padding, 16–24px inter-section rhythm; cards 20px radius, hero 24px, buttons 14px. System typography, 32px personalized greeting, 20px section headings, 16px body, 13px metadata. Metrics use tabular figures and adapt/wrap at large text sizes. Retain the scroll view and sufficient bottom clearance above the unchanged tab bar. No fixed-height clipping of labels or values. All action hit areas at least 48px; visible focus and selected state where applicable.

## Ordered screen specification

### 1. Header and personalized greeting

Keep “Today / Somata”, the existing `Hello, …` greeting, subtitle and Alerts button. The name remains the first word of saved profile displayName, then Firebase displayName, then “you”. Optional S3 at 28px may replace the existing textual brand identification within the eyebrow row; never a background image. Use primary text for the greeting, secondary text for subtitle, brand-safe ink for the eyebrow and bell. Keep Alerts destination `(tabs)/notifications`, its accessible label and touch target. No new toolbar action.

### 2. Today's goal / energy hero

Keep the current plan title and “Today, in motion”, percent, 24-segment progress, logged/target text, conditional attribution and pending-review action. Use a Graphite/white hero with a subtle border and compact orange detail, not the former green wash. Active segments use `data.energy`; inactive segments use `data.track`. A light-mode energy graphic uses the darker ink token for contrast; the approved raw orange remains the primary CTA fill.

The percentage stays today's **logged energy / current daily calorie target**, not percentage of a plan completed. Keep current rounding and visual cap at 100%; do not create a new over-target warning or “success” judgment. Numeric logged/target values remain visible even if the meter is capped. If either input is unavailable or the target is not positive, show the existing dash/unfilled meter with a clear “Progress unavailable” description; do not infer 0%.

`dashboardPreviewPlan` continues resolving targets through the shared helper. Show “Active plan” only for a matching valid accepted projection and recommendation; saved targets are “Your goals”. A valid accepted projection can still supply numbers while the plan record is unavailable; preserve the existing unavailable/loading plan title rather than presenting it as a verified active plan. Do not hide those valid account targets or substitute a pending proposal. The compact approved Powered by FitAdapt image remains conditional on `data.plan.kind === 'active'`.

Keep pending-review CTA separate and route to `(tabs)/profile`. It must never feed the hero numbers or acceptance state. No automatic evaluate/accept requests.

### 3. At a glance: steps and latest weight

Keep two compact neutral cards, with labels above large values and supporting captions beneath. Use a restrained energy accent for steps and neutral primary text for weight, replacing the green filled card/lime number treatment. Preserve wrapping into one column on narrow layouts/large text; do not add new links to static cards.

Steps: today's account record and the existing optional goal caption. Weight: latest valid dated account measurement in the current 30-day window, converted to the saved `lb` or `kg` unit and formatted to one decimal. Missing remains “—”. Do not substitute onboarding weight, unscoped legacy local history, generated trends or a new trend chart.

### 4. Nutrition pulse

Keep the existing section heading, Open action to `(tabs)/nutrition`, and Protein/Carbs/Fat amounts in grams. Place them in a single neutral card with an adaptive three-column/wrapping arrangement; labels and values remain more prominent than any colored marker. Optional small series markers use the new labeled data roles, not status-success colors. No new rings, invented completeness score or target percentage: this section shows logged amounts. Retain “Logged amounts are not a full-day estimate.”

### 5. A useful next step

Keep the single card, heading, caption, computed title/detail and existing CTA. Use a subtle selected-surface tint, plain readable text and secondary action styling. This is an existing **rule-based local suggestion**, not a newly generated FitAdapt rationale.

Preserve priority exactly:

1. Real pending proposal → Review proposal → `(tabs)/profile`.
2. Zero entries for today → Log food → `(modals)/add-meal?date={today}`.
3. Recorded steps below an available goal → Steps history → `/profile/steps-history`.
4. Otherwise → Open insights → `/profile/fitadapt-insights`.

Do not change the predicate order or turn unknown nutrition into “no entries”.

### 6. Every existing quick action

Keep the current wrapping action grid/order. Log food is the orange primary action; all others use secondary surfaces/ink, with clear icons and wrapping text. Do not remove less-prominent actions to make a screenshot cleaner.

| Action | Existing destination/operation to preserve |
| --- | --- |
| Log food | `(modals)/add-meal?date={today}` |
| Scan food | `(modals)/scan-meal?date={today}` |
| Add steps | Existing local step sheet in add mode, then `addStepsForDate(uid, today, amount)` |
| Set steps | Same sheet in set mode, then `setStepsForDate(uid, today, amount)` |
| Start workout | `/workouts/session?freshStart=1` |
| Log activity | `(tabs)/workouts?activity=1` |
| Quick workout | `(modals)/quick-workout` |
| Water log | `(modals)/quick-hydration` — a real existing logging destination, not a fabricated hydration dashboard metric |

The step sheet is Home-owned presentation: apply neutral surfaces, legible labels, focused control border and orange Save. Preserve add/set labels, date, whole-number validation 0–200,000, UID requirement, duplicate-save guard, error alerts, Save/Cancel, keyboard avoidance and dismissal. Do not change date handling or write semantics.

### 7. Explore

One neutral grouped list, subtle dividers, small brand-ink icons and primary text. Preserve working row actions: Calendar → `(modals)/full-calendar`; Insights & history → `/profile/fitadapt-insights`; Connections → `/profile/integrations`; Badges → `(modals)/badges`. Do not redesign the destination pages in 3B.

### 8. Bottom navigation

Retain Home, Workouts, Nutrition, Alerts, Profile, in that order, with the existing routes, icons and unread behavior. The eventual shared navigation foundation uses `navigation.background`, active/inactive inks and badge semantics. **Do not recolor the shared tab bar as a side effect of Home-only 3B**: it belongs to all five tabs. Seek explicit approval for shared navigation styling when that scope is next included. No raster-icon swap yet; keep the bell and the complete consistent Ionicons set. The supplied PNG mapping is in `VISUAL_FOUNDATION.md`.

## Actual data sources and honest states

| Display/input | Current source | Preserve |
| --- | --- | --- |
| Identity, units, saved goals, accepted target projection, steps | AuthContext Firebase user; `subscribeProfile(uid)` → `users/{uid}`; `recordedStepsForDate` | UID-bound subscriptions and reset on account switch; no friend/raw cross-account access |
| FitAdapt state | `getFitAdaptPlan()` from `usePreviewAccount` on focus; `dashboardPreviewPlan` + `profilePlanPresentation` | Existing authenticated callable, loading/error/record-match checks, explicit review route |
| Today's nutrition | `subscribeFoodsByDate(uid,today)` → `users/{uid}/nutritionEntries`; `dashboardLoggedToday` | Date scoped, no fabricated calorie/macro totals, original logging unchanged |
| Recorded weight | `users/{uid}/fitadaptWeightEntries`, newest 90 records by date; `recordedWeightDays` selects recent 30 days | Account scope, measured dated records, kg-to-lb display conversion only |
| Unread alerts | Tab layout's `subscribeUnreadCount(uid)` | Subscription cleanup/count semantics, accessible unread indication |

`usePreviewAccount` is a historical name for the current shared data hook; reuse it. No cloned subscriptions/calculations, new caches, storage writes, history formats or migration. Maintain date refresh on focus/minute tick and stale-account exclusion.

Current UI often shares the same dash for loading/empty/error, and step/weight hooks do not expose independent loading versus error states. Do not fabricate a precise status that the hook cannot supply. The plan has explicit status; nutrition returns null on error and undefined before load. Where reliable distinctions exist, retain them in accessible descriptions. Otherwise say unavailable rather than claim the user has never logged data.

**Existing data limitation:** `services/nutrition.ts` currently coerces some missing nutrient fields with `Number(data.calories || 0)` and analogous macro expressions before the dashboard helper sees them. `dashboardLoggedToday` preserves missing versus zero in its own inputs but cannot recover information already lost upstream. 3A does not change this normalizer or nutrition logging. 3B must not add a claim that every displayed legacy zero is a verified measured zero, nor new completeness/quality scores. Correcting legacy normalization requires a separately scoped data checkpoint and regression checks; do not silently fix it as styling.

## Proposed 3B implementation, not started

1. Freeze the current Home route/action/data checklist above and capture light/dark reference images. Confirm the fixed-brand Home trial versus saved custom-palette expectations described in the foundation report.
2. Add an explicit opt-in visual variant to the existing current-tab presentation components that Home needs. Default remains legacy. Avoid globally replacing D/F or editing business hooks. Scope the variant to Home and its step sheet only; do not start other tabs/subpages.
3. Apply the documented surfaces, type, spacing, action hierarchy and data-role colors to the same sections/order. Use approved existing artwork only at existing identity placements. Preserve every route, payload/date, state guard and calculation.
4. Verify light/dark/System, 320/390px widths, large text, keyboard/step sheet, null/zero/loading/error states, accepted versus pending plan, account switch, and all action destinations. Add focused tests only if a new presentation-state mapping warrants them. Run mobile TypeScript/tests and both Expo exports; obtain physical iPhone review before expanding scope.

Stop at this specification in 3A. No Home implementation or next checkpoint begins without approval.
