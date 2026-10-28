# Checkpoint 8B — Foundation + Home utilities

Completed implementation on `profile-redesign`, 2026-10-19. Ready for one family-level visual review. Native/device verification remains open; this is not a release-readiness claim.

## Review entry points

- [All 80 before/after state previews](index.html)
- [Side-by-side before/after comparisons](comparisons.html)
- [HTML state manifest](capture-manifest.json)
- [36 browser PNG captures and viewport checks](browser-capture-checks.json)
- [Preservation evidence](preservation-checks.json)
- [Exact generated-file inventory](files.json)

Previews render the actual React Native JSX through the existing offline React Native Web adapter. Every fixture is explicitly synthetic; no Firebase requests, device storage, or personal records are used. Actions are inert in HTML. Before previews use the source snapshot taken at the start of this checkpoint, not an older Git revision that would discard prior uncommitted work.

## Assigned surface completion

| ID | Surface / entry | New composition | Preserved behavior / evidence |
| --- | --- | --- | --- |
| T03 | Home → Explore → Connections → Sync history; `/profile/sync-history` | Event-count overview, chronological event journal, source/status details, compact duration/data metrics and separate clear action | Same account store, subscription, event order, timestamp formatter, duration calculation and immediate Clear history callback. Populated/success/failed-source, loading and empty previews. |
| T01 | Home → Explore → Calendar; `/(modals)/full-calendar` | Dedicated period/navigation panel, selected view rail, bounded date grid, period totals and selected-day record area. Week uses dated record cards with labeled energy/protein bars; year retains its scrollable date overview. | Same date helpers, local time-zone behavior, account-scoped range loading, profile subscription, statistics and activity calculations, Today/previous/next, date selection, long press, period swipes, persisted view and routes. There are three existing view choices: week/month/year; the day record is inline or in the detail sheet. |
| O01 | Home → Quick actions → Add steps / Set steps | Bottom sheet with current recorded count, explicit add-versus-replace explanation, labeled native input and separated primary/cancel actions | Same UID/date, number parsing, integer range 0–200,000, validation alert, saving guard, add/set callbacks, failure alert and retained value on failure. Backdrop dismissal remains disabled, as before. Native back/close/cancel do not write. |
| O18 | Calendar → hold a date, or select a date → expand | Warm nutrition overview, meal rows, separate training summary and secondary recorded details, with a consistent sheet header | Same `DayDetailSheet` props, date header, record values, optional fields and close callback. Log nutrition still appears only when the selected sheet is today and has no nutrition record; it keeps the existing dated add-meal destination. |

All four assigned presentations are implemented. No other family has been started. `DayDetailSheet.tsx` itself is unchanged: its existing `TaskSheet` and `CalendarRecord` children receive the new presentation through Calendar's explicit scope.

## Shared foundation

- `SomataTaskAppearance` opts into task presentation using the **existing** appearance context. `SomataHomeAppearance` defaults to its previous behavior; approved tabs do not inherit new TaskUI layouts.
- `useTaskPresentation` maps the existing semantic colors and typography and reuses `premiumHomeTheme` lighting recipes. No new theme provider, saved palette, persistence key or theme mutation was introduced.
- TaskUI: page/header, warm/neutral panels, compact panel option, primary/secondary/destructive/disabled buttons, icon buttons, focused native fields, selected choices, navigation rows, empty states, metrics and modal sheets.
- FlowUI: scoped selection rail and notice styling. Success/warning/error retain semantic colors instead of being converted to decorative orange.
- Light mode uses bone/white surfaces and warm ink accents. Dark mode uses charcoal/graphite and bounded warm gradients. Native labels and values remain native text; no artwork or screen-sized image was added.
- Main controls have 48–50 point minimum targets. Text wraps and scales. Month cells have at least 48 point width; the standard 390-point grid fits all seven days. Narrow or large-text grids scroll horizontally rather than squeezing dates. The period heading and arrow buttons still change periods when the grid needs horizontal scrolling.
- Sheets use the existing reduced-motion preference, native Modal, keyboard avoidance and safe-area bottom padding. These mechanisms still require real-device verification.

## Files changed in this checkpoint

Paths below are relative to `fitness-mobile/`. The repository already had unrelated modifications before this checkpoint; they are not included here.

**Modified (8):**

1. `components/designPreview/Appearance.tsx`
2. `components/somata/TaskUI.tsx`
3. `components/homeFlows/FlowUI.tsx`
4. `components/somata/CalendarRecord.tsx`
5. `app/profile/sync-history.tsx`
6. `app/(modals)/full-calendar.tsx`
7. `app/(tabs)/index.tsx` — nested steps dialog and its presentation helper only; the main Page composition and step controller are unchanged.
8. `tools/home-preview-runtime.cjs` — offline source-snapshot loading, utility fixtures and callback capture; no application data path.

**Created source/test tools (2):**

- `tests/homeUtilitiesPresentation.test.ts`
- `tools/render-branding-8b-preview.cjs`

**Created review artifacts:**

- `review/branding-8b/index.html`, `comparisons.html`, this index, and `files.json`.
- `capture-manifest.json`, `browser-capture-checks.json`, `preservation-checks.json`.
- 80 HTML state previews and 36 PNG browser captures; every exact path is listed in `files.json`.

No dependencies, Expo configuration, routes, providers, backend code, security rules, authentication, nutrition/workout/FitAdapt logic, storage services or approved asset files were changed.

## Validation results

Commands ran from `fitness-mobile/`, unless shown with an absolute script path.

| Command | Result |
| --- | --- |
| `pnpm typecheck` | Passed, exit 0. |
| `TZ=America/Toronto node --import tsx --test tests/homeUtilitiesPresentation.test.ts` | 10 passed, 0 failed. |
| `TZ=America/Toronto node --import tsx --test tests/homeBrandPresentation.test.ts tests/semanticTokens.test.ts tests/themePicker.test.ts` | 17 passed, 0 failed. |
| `pnpm test` | Full suite: 166 passed, 0 failed, 0 skipped. Includes the 10 new checks and existing account-isolation/theme/target/logging regressions. |
| `pnpm exec expo export --platform ios --output-dir /private/tmp/somata-8b-ios` | Passed, exit 0; iOS Hermes bundle and assets emitted. |
| `pnpm exec expo export --platform android --output-dir /private/tmp/somata-8b-android` | Passed, exit 0; Android Hermes bundle and assets emitted. |
| `TZ=America/Toronto node tools/render-branding-8b-preview.cjs --before-root /private/tmp/somata-8b-before/fitness-mobile` | Passed; 80 state previews and comparison index. |
| `TZ=America/Toronto node /private/tmp/somata-8b-preservation.cjs` | Passed; 1,022 of 1,030 pre-existing files unchanged, exactly the 8 intended files modified. All 125 pre-existing branding files unchanged. |
| `node /private/tmp/somata-8b-capture.cjs` | Passed; local Chrome/CDP captured 36 synthetic browser images at exact 390/320 CSS-pixel widths. No page-level horizontal overflow in these captures. |
| `xcrun simctl list devices booted` | With local tooling access, exit 0: iOS 26.0 listed, no booted device. No native app render was performed. |

The first sandboxed Simulator probe could not reach CoreSimulator; the permitted local read above succeeded but found no booted device. Exports are JavaScript/asset validation, **not** native builds or device verification.

Non-failing output included React Native Web shadow/pointerEvents deprecation notices and Node `NO_COLOR`/`FORCE_COLOR` warnings. No checks were suppressed or relabeled.

The new focused tests exercise real screen callbacks with synthetic service adapters: missing/invalid/zero/upper-bound step input, signed-out no-write, add versus set, failure/retry and busy duplicate guard, cancellation/native-back, Calendar period/date selection and persisted view, exact dated log route, owner-scoped range arguments, optional/missing/zero day fields, scoped sync subscription and immediate clear. They do not replace live device or emulator write verification.

### Preservation evidence

- All five main tabs produced identical before/after rendered markup in dark and light mode (10 comparisons), with Home's dialog closed.
- Home's main `<Page>` composition and open/save step callbacks match the baseline source exactly.
- The legacy quick-water page produced identical markup in both themes at normal and narrow/large text (4 comparisons). It is included as a visible unchanged control.
- The baseline hash audit covers tracked and nonignored untracked files present at the start. Unrelated work, logs, approved artwork and other screens are unchanged by this checkpoint.
- Saved palette values are unchanged by the task scope in the tests. New utility presentation uses the established semantic brand roles; legacy surfaces retain their saved palette behavior.

## Gallery coverage and limitations

- Dark/light: Sync populated/empty/loading; Calendar month/week/year/empty; day detail populated/empty; Add/Set/saving steps; unchanged water-log control.
- 320-point width with simulated 1.8× text: Sync journal, Calendar month/week, day detail, Add/Set steps, legacy control. Normal preview width is 390.
- Sync failed-source status is a real persisted event field and is represented in the synthetic journal. Step validation/save failure remains the existing native Alert; its callback behavior is tested, but its native appearance is not browser-rendered.
- Calendar's existing controller has no distinct load-error/retry UI or explicit loading display. No new state or fabricated record was added to cover that gap.
- Sync History still clears immediately and has no separate clear-failure state. This checkpoint intentionally preserves that behavior.
- Preview dates are fixed synthetic October 2026 fixtures. Application date calculations and time-zone behavior are unchanged. Month navigation crosses real month boundaries in callback tests; DST/device-local time-zone behavior still needs a phone check.
- PNGs are browser captures, not iPhone screenshots. Safe-area fixtures are zero, font scaling is simulated, native sheets are expanded for content review, and gestures/keyboard/VoiceOver are not verified by HTML.
- Browser layout checks detect page overflow; they do not certify every native touch target, scroll boundary, accessibility focus order or screenshot pixel match.

## iPhone review checklist

Use the existing development environment and a synthetic emulator account for write tests. This checkpoint does not require new backend deployment or change environment targeting.

1. From `fitness-mobile/`, run `pnpm exec expo start --lan`, then open the project in the compatible installed Expo Go/development client. Keep the existing emulator services running when using the synthetic account. This command does not switch Firebase targets.
2. Home → **Add steps**: inspect dark and light, enter a valid count, verify the recorded total increases once. **Set steps**: verify it replaces the total, including zero. Try blank, fractional, negative and >200,000 values. Cancel without saving. Check the number pad, smallest supported phone width and large system text.
3. Simulate an unavailable backend for a step save: confirm the existing failure alert, retained input and retry behavior. Restore the local backend. Do not use personal records for destructive/replace tests.
4. Home → **Calendar**: test Today, previous/next, week/month/year, date tap, long press and selected-day expand. Check month/year boundaries and current device time zone. Test period-heading swipe and horizontally scrolling narrow/large-text grids.
5. Calendar day detail: review recorded versus empty dates; check all available nutrition/training/step/water/optional record values. On today with no nutrition, **Log nutrition** must open the existing add-meal route with that date. Dismiss and return reliably.
6. Home → **Connections** → **Sync history**: check loading/empty and available recorded successful/failed events. **Clear history** clears immediately, as before; use a synthetic account. Reopen to confirm the account-local result.
7. In light/dark/System mode and with a saved custom palette, check contrast, safe areas, scroll-to-bottom, VoiceOver labels/focus, Reduce Motion, back/close and sheet presentation. Android hardware-back verification remains separate.
8. Revisit all five main tabs and the quick-water control to confirm their approved layouts remain unchanged on device.

No device checks above have been claimed passed. No commit, push, merge or deployment was performed. Stop here for Checkpoint 8B family review before starting Checkpoint 9.
