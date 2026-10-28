# Somata branding — Checkpoint 4

Premium Nutrition presentation on `profile-redesign`. No commit, push, merge, deployment, dependency change, cloud call or production-data change. Prior working changes and approved Home/authentication branding are preserved.

## Existing feature inventory and reference mapping

| Section | Current source / behavior retained | Presentation implemented |
| --- | --- | --- |
| Header | Existing full-calendar route; no Nutrition settings control exists | Home's premium header, orange eyebrow, large title, gradient calendar control |
| Date navigator | Local selected day, noon-based previous/next arithmetic, Go to today | Warm-edged card, centered date and TODAY/TAP FOR TODAY; 48-point controls |
| Energy | Selected-date `subscribeFoodsByDate(uid,date)`, `dashboardLoggedToday`, today's shared target projection | Orange-edged gradient hero; calories alongside a compact orange segmented arc; target caption and existing missing-data note |
| Macro summaries | Same logged protein/carbs/fat totals and `fmt` handling | Orange, blue and gold cards with icons, highlighted edges and full-width series strips |
| Goal tracker | Existing validity checks/fractions; today's targets only | Inline label/bar/value rows where width allows, stacked rows with large text/narrow width; matching series colors |
| On-device hydration | UID-bound `useAccountStorage()`, existing `@water:<date>` key, saved water goal aliases and 2400 ml fallback | Premium card, clear local-record description, orange Add 250 ml and secondary Clear day |
| Food actions | Existing date/meal parameters and routes | Orange Add food plus Quick add, Scan and Meal builder in a responsive grid |
| Meal timeline | Same Breakfast/Lunch/Dinner/Snacks grouping and entry count | Compact header/empty states, icons, prominent Add, real entry name/quantity/calories, edit chevron |
| Meal interactions | Food tap opens unchanged EditFoodSheet; meal-bundle tap opens existing delete confirmation; long press confirms deletion; save/update/delete retain UID | Existing callbacks preserved; no fake photo, changed editor or new bundle menu |
| Tools | Conditional remaining-target suggestion; Calendar; Diet choices; separate Quick water log | Compact two-column tiles with explanatory subtext and chevrons; one column with large text |
| Navigation | Existing shared premium five-tab navigator from 3C | Unchanged. Nutrition naturally receives its existing orange focused state. Unread subscription/badge logic untouched. |

### Important source limitations, preserved

- The reference's settings button has no existing counterpart on the current Nutrition screen. No new button or route was invented.
- Macro cards are read-only. Their reference chevrons were omitted because no corresponding detail action exists.
- `FoodEntry` has no reliable photo field. No sandwich/sample image was added to actual records.
- On-device hydration and Quick water log remain distinct stores/flows. Existing Add/Clear handlers are guarded by `water != null`; a missing local record therefore makes those actions no-ops. This checkpoint does not change or conceal that existing behavior.
- Historical dates have no reliably dated target comparison in this screen. The existing arc/goal tracker and remaining-target suggestion remain absent on past dates; the recorded-day explanation remains visible.
- The existing nutrition reader can normalize some absent nutrient fields to zero upstream. The UI/helper preserve distinctions they receive but cannot recover those lost values. The requested missing-data note remains; no completeness score or normalization change was introduced.
- Loading, error, empty meals, unknown nutrients and true zero are separately exercised. No placeholder values or hardcoded reference meal appear in the app.

## Implementation scope

Reuses the approved `PremiumHomeUI` Page/Card/Action and its lighting recipes **without changing those files**. Nutrition adds focused headings, calendar button, macro cards, responsive grids, meal groups and tool tiles. The existing presentation context is locally opted into under a Nutrition alias; it does not own or persist settings.

`ArcProgress` receives optional size/color parameters, with a large-text layout that moves the percentage below the arc. `GoalTrack` receives optional inline/color parameters. Their existing fill/percentage arithmetic and defaults remain; other callers need no changes. The Nutrition screen's data/subscription/handler block was verified byte-identical to the pre-checkpoint file.

No changes to authentication, FitAdapt calculations/acceptance, Firestore, notification behavior, backend contracts, meal scanning/building/editing logic, logging, date behavior, local-storage ownership, or theme persistence.

## Exact files

Modified:
- `app/(tabs)/nutrition.tsx`
- `components/designPreview/UI.tsx`
- `tools/home-preview-runtime.cjs`

Created:
- `components/nutrition/PremiumNutritionUI.tsx`
- `tests/nutritionBrandPresentation.test.ts`
- `tools/render-nutrition-preview.cjs`
- `PREMIUM_NUTRITION_IMPLEMENTATION.md`
- `review/branding-4/index.html`
- `review/branding-4/nutrition-dark-populated.html`
- `review/branding-4/nutrition-light-populated.html`
- `review/branding-4/nutrition-dark-empty.html`
- `review/branding-4/nutrition-light-empty.html`
- `review/branding-4/nutrition-dark-loading.html`
- `review/branding-4/nutrition-light-loading.html`
- `review/branding-4/nutrition-dark-error.html`
- `review/branding-4/nutrition-light-error.html`
- `review/branding-4/nutrition-dark-past.html`
- `review/branding-4/nutrition-light-past.html`
- `review/branding-4/nutrition-dark-pending.html`
- `review/branding-4/nutrition-light-pending.html`
- `review/branding-4/nutrition-dark-large-text.html`
- `review/branding-4/nutrition-light-large-text.html`
- `review/branding-4/nutrition-dark-populated.png`
- `review/branding-4/nutrition-light-populated.png`
- `review/branding-4/nutrition-dark-empty.png`
- `review/branding-4/nutrition-dark-large-text.png`

## Validation

Run from `fitness-mobile/`:

```sh
pnpm typecheck
pnpm test
node tools/render-nutrition-preview.cjs
CI=1 EXPO_NO_DOTENV=1 pnpm exec expo export --platform all --max-workers 2 --output-dir /private/tmp/somata-4-export
```

Results:

- TypeScript: passed.
- Mobile suite: **130 passed, zero failed**, including six new tests.
- iOS and Android exports: passed (8.1 MB / 8.3 MB bundles). Existing `baseline-browser-mapping` age and terminal color-environment warnings remain; no dependencies were changed to silence them.
- Fourteen HTML previews and four PNG previews generated. Dark/light populated, empty and large-text browser layouts visually reviewed. Corrected action-grid rounding and large-text header wrapping after the first visual pass.
- Existing approved image files and Home/authentication/tab-navigation files remain byte-identical. The SHA-256 preservation audit checked **619 existing files**, with only the three listed existing files changed. No new raster imports require decoding; SVG arcs and the installed icon font render in previews and resolve in both exports.
- `git diff --check -- fitness-mobile`: passed.
- Offline browser compatibility warnings concern native shadow properties and the SVG accessibility-label adapter; these do not stop preview generation. Browser previews are not native device evidence.

Six new non-snapshot tests cover:

1. Pending proposal isolation and accepted target projection.
2. Unknown/zero/loading/error/empty states and no historical target substitution.
3. Previous/next date, per-meal Add, food/tool destinations and exact remaining-target parameters.
4. Food editing/save and bundle/long-press deletion confirmation, retaining the signed-in UID in mocked service calls.
5. Local hydration writes and the unknown-value guard, separate from Quick water log navigation.
6. Recorded values and working action callbacks at narrow widths and large text in both themes.

The offline harness seeds explicit hook state and invokes actual screen handlers against recording mocks. It never contacts Firebase, runs subscriptions/focus effects, persists device data, or tests a live editor modal. These tests verify callback wiring and presentation, not network/account-switch lifecycle or native gesture behavior. Existing service/account-isolation tests continue covering their own layers.

## Visual comparison and limitations

The 430-point dark preview follows the reference's section order, charcoal gradients, orange energy arc, three macro colors, tracker, hydration/action grouping and four meal groups. The light version uses Bone/white surfaces and darker semantic inks. Narrow/large-text layouts stack the hero and controls rather than clip labels.

It is not a pixel-exact reproduction. Controls retain practical touch targets, so meal groups and food actions have more vertical space. Four food actions fit one row at widths of at least 420 points with normal text; smaller phones use two columns and large text one. The concept's decorative header ribbon, nonexistent settings/macro-detail controls and unsupported food photo are omitted. Existing Ionicons are retained rather than approximating custom artwork. Macro bottom strips identify the series; they are not filled progress values. Only the goal bars/energy arc represent progress.

Previews render actual JSX with synthetic fixture state, the installed Ionicons font, SVG and CSS gradient adapters. The tab bar is shown using actual options in a static adapter after the page, not a live persistent navigator. Safe areas are zero and font scaling is simulated. Preview buttons are inert; edit sheets and native keyboard are not shown. No personal records were accessed. Existing PNGs remain unchanged; this Nutrition change introduces no new image imports or bitmap artwork.

## Phone verification

```sh
cd /Users/aristos/Documents/fitness-app/fitness-mobile
pnpm exec expo start --go --clear
```

Use the existing intended account/backend configuration; this checkpoint does not enable emulators or configure services. Review Nutrition on iPhone:

- Light, dark and System mode; narrow screen, large text, safe-area/tab-bar clearance, native SVG arc, gradients and scroll performance.
- Previous/next/today and full Calendar; past dates must not inherit today's goal comparison.
- Add food, Quick add, Scan, Meal builder and each meal's Add; verify return to the chosen date/meal.
- Tap an ordinary food, edit and save; cancel; long-press/delete confirmation. Test writes with synthetic records. Bundle tap must keep its existing confirmation behavior.
- Known on-device water value: Add 250 ml and Clear day; confirm Quick water log remains separate. Unknown local water retains the limitation above.
- Missing/loading/error, a real pending review, accepted targets, and suggestion availability when all required values exist.
- VoiceOver labels/reading order and numeric values; five-tab selection and unread indicator.

Physical-device interaction, camera permissions, live account writes, edit-modal keyboard and native performance have not been verified in this checkpoint. Expo exports are not native builds. Stop here for visual review; no other tab or subpage redesign has started.
