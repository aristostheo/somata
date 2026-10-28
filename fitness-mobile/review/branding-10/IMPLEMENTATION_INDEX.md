# Somata Branding — Checkpoint 10

Implementation and synthetic review, 2026-10-21. All 22 assigned surfaces are implemented for review on `profile-redesign`. No commit, push, merge, deployment, dependency, backend, schema, authentication, FitAdapt or artwork changes. This is a presentation checkpoint, not release certification.

## Review entry points

- [Full dark/light gallery](index.html), [before/after comparisons](comparisons.html), [individual files](manifest.json).
- Actual application JSX rendered offline with React Native Web; only synthetic records. Browser captures are not iPhone screenshots. The body map uses the installed body-highlighter package, not a traced or invented diagram.
- Use the existing Workouts tab's Start new / Open session, Plan a session, See all, Recent work / History, activity Log, and Workout tools. The tab dashboard itself is unchanged.
- From active session: Browse exercises, Rename workout, Edit set. From history: recap → Session actions → repeat/template/delete. From templates: Create a routine → Add exercise. From Coach Spark: Quick/custom → generated review → Swap exercise.
- W11–W13 remain direct-link-only. Their route paths below are for deliberate testing; no shortcuts were added.

## Complete scope and behavior inventory

Status for every row: **implemented; synthetic rendering verified; native walkthrough pending**. Route names and service boundaries are unchanged.

| ID | Surface / route or owner | New composition and retained behavior |
|---|---|---|
| W01 | `app/workouts/session.tsx` | Timer/recorded-metric strip, exercise ledger before entry form, explicit set completion, inset set editors/actions, persistent finish footer. Existing UID draft load/save/debounce, seed/resume, units, add/edit/remove, presets, leave/finish confirmation retained. |
| O37 | W01 title sheet | Session-identity context, title field, Save/Cancel; cancel does not rename the draft. |
| O38 | W01 set sheet | Prescription fields, separate muscle choices and notes, explicit completion, hide keyboard, Save/Cancel. |
| W02 | `app/(modals)/browse.tsx` | Search and scope inside the list's scrollable header, grouped filters, individual result cards, reset footer. Firestore-first/seed fallback, favorites, recents, preview, account-scoped selection payload and back navigation retained. |
| O15 | `components/exercises/ExercisePreviewSheet.tsx` | Movement metadata, bounded existing media or unavailable state, numbered technique, favorite/use actions. No exercise artwork invented. |
| W03 | `app/workouts/templates.tsx` | Library search/filter desk, numbered personal routine cards, start action. Same template IDs, archived filtering and seed mapping. |
| W04 | `app/(modals)/create-template.tsx` | Identity block, ordered movement list, reorder/remove controls, save footer. Same validation and fields. |
| O17 | W04 add-exercise sheet | Planned-prescription form with wrapping sets/reps/load and notes. Existing manual exercise entry retained. |
| W10 | `app/(modals)/save-workout-as-templates.tsx` | Routine identity and numbered source movements. Existing source-session mapping and save retained; no source workout mutation. |
| W07 | `app/workouts/history.tsx` | Period summary, search/date desk, recorded-session timeline cards and recap actions. Same session grouping, date boundaries, filters and calculations. |
| O35 | W07 month sheet | Wrapping month buttons, same last-18-month options and selection callback. |
| O36 | W07 custom-date sheet | Date-range context, wrapping From/To fields, presets, validation, Apply/Cancel. |
| W08 | `app/workouts/recap.tsx` | Recorded summary, real muscle map, numbered exercise records, reflection/note panel and share/detail actions. Existing score, comparison, muscle counts, fatigue, notes, Share/clipboard fallback retained. |
| W09 | `app/workouts/session-detail.tsx` | Summary/action desk, exercise and muscle records, notes, separate destructive management card. Existing repeat, save-template and confirmed deletion retained. |
| W05 | `app/(modals)/quick-workout.tsx` | Log identity, template starter, exercise composer, individual exercise/set cards and Save/Discard footer. Same presets, units, steppers, notes and write format. |
| O02 | Nested configuration modal in `app/(tabs)/workouts.tsx` | Session brief, name, focus and time sections; same start/cancel parameters. Only this nested overlay changed. |
| O03 | `components/activity/ActivityLogSheet.tsx` | Quick preset cards and custom activity form with separate optional values. Same quick/manual/create/edit/delete callbacks; shared Home entry receives this assigned sheet treatment. |
| W06 | `app/(modals)/coach-spark.tsx` | Session brief and preference groups, context, generate state/error, suggestion archive; generated review ordered warm-up → movements → cooldown → start/save. Same trusted AI call/validation, history, errors and guards. No FitAdapt branding added. |
| O16 | W06 swap sheet | Current movement context and alternative cards; selection only updates the existing generated review. |
| W11 | `app/(modals)/quick-cardio.tsx` | Numbered cardio starting cards, same choices/zero-load seed/start guard. Direct-link only. |
| W12 | `app/(modals)/quick-strength.tsx` | Numbered strength choices and existing full-body action. Direct-link only. |
| W13 | `app/(modals)/quick-mobility.tsx` | Distinct 10/15-minute starting cards, same movements and seed. Direct-link only. |

## Design and shared components

Uses the existing `SomataTaskAppearance`, ThemeProvider semantic tokens, premium TaskUI/FlowUI controls. Charcoal/graphite surfaces, bounded warm gradients, orange actions and borders; bone/light equivalents. Destructive buttons use the existing error token. Metrics and fields wrap instead of forcing fixed-width columns. No new theme, icon system or decorative assets.

New `components/workouts/WorkoutTaskUI.tsx` supplies four workout-only compositions: `WorkoutIntro`, `WorkoutStats`, `WorkoutFields`, `MovementHeading`. They accept values/content, not service dependencies. Existing shared TaskUI and FlowUI files are unchanged. Exercise `FilterBar` and `ExercisePreviewSheet` and shared `ActivityLogSheet` opt into the premium foundation. Screen controllers remain in their original files.

The new layouts reorder and group content around each task; they do not merely change the palette. In particular, active sets precede entry, history separates selection from records, recap separates recorded work from reflection, and Coach Spark distinguishes planning from reviewing.

## Exact source files

Modified application files (17):

- `app/workouts/session.tsx`
- `app/workouts/templates.tsx`
- `app/workouts/history.tsx`
- `app/workouts/recap.tsx`
- `app/workouts/session-detail.tsx`
- `app/(modals)/browse.tsx`
- `app/(modals)/create-template.tsx`
- `app/(modals)/save-workout-as-templates.tsx`
- `app/(modals)/quick-workout.tsx`
- `app/(modals)/coach-spark.tsx`
- `app/(modals)/quick-cardio.tsx`
- `app/(modals)/quick-strength.tsx`
- `app/(modals)/quick-mobility.tsx`
- `app/(tabs)/workouts.tsx` — imports and nested O02 only
- `components/activity/ActivityLogSheet.tsx`
- `components/exercises/ExercisePreviewSheet.tsx`
- `components/exercises/FilterBar.tsx`

Created application file: `components/workouts/WorkoutTaskUI.tsx`.

Review/test tooling:

- Modified `tools/home-preview-runtime.cjs`: optional isolated workout adapter and installed body-map module loading; default adapters retain their prior behavior.
- Created `tools/workout-flow-runtime.cjs`: synthetic I/O, named-state injection, native raw-text constraints; no production connections.
- Created `tools/render-workout-family-preview.cjs`: complete fixtures and reproducible gallery.
- Created `tests/workoutFamilyPresentation.test.ts`: controller/action regressions, not styling snapshots.
- Created `review/branding-10/` review HTML/PNG files, manifest, browser checks, preservation checks and this report. Exact generated paths are listed in `files.json`.

## Verification

Final results and exact commands are recorded in `validation.json`:

- TypeScript passed.
- Focused workout controller suite: 12/12 passed; the catalog action regression passed again after its scroll-header adjustment.
- Full mobile suite: 194/194 passed, zero failures.
- iOS and Android exports passed; all 68 iOS and 72 Android packaged asset references resolve to nonempty files.
- 202 HTML previews (90 before, 112 after), 128 Chrome PNG captures; no horizontal document overflow in captured cases. Includes 320px/1.8× text and long-name cases.
- 1,448 of 1,466 baseline files remained byte-identical. The 18 intentional existing-file edits are the 17 application files plus the optional preview-runtime adapter. All 125 baseline approved artwork files are unchanged.
- All 10 primary-tab, 24 Home-utility and 84 Nutrition fixture renders match the task-start snapshot. All 17 touched application files passed the non-JSX controller-statement comparison.
- Touched-path whitespace check passed. Existing Metro baseline-mapping and React Native Web deprecation warnings remain; no dependencies changed.

 Run commands from `fitness-mobile/`:

```sh
pnpm typecheck
TZ=America/Toronto node --import tsx --test tests/workoutFamilyPresentation.test.ts
pnpm test
EXPO_OFFLINE=1 pnpm exec expo export --platform ios --output-dir /private/tmp/somata10-ios --max-workers 2
EXPO_OFFLINE=1 pnpm exec expo export --platform android --output-dir /private/tmp/somata10-android --max-workers 2
node tools/render-workout-family-preview.cjs
```

The optional `--before-root /private/tmp/somata-10-before/fitness-mobile` uses the task-start working-tree snapshot, not Git HEAD. It is local to this execution. Saved before captures remain reviewable without that snapshot.

Focused tests exercise explicit completion, unit conversion and UID draft keys; rename cancellation and deletion confirmation; finish failure; browser selection/favorites; template order and failed-save retention; reversed date validation; owner-scoped repeat/delete; optional activity zero versus missing; quick workout units; mocked AI success/429/malformed output; review-only swapping, zero-load start seed and existing template busy guard. All preview fixtures assert no writes or provider calls during rendering.

Non-JSX controller statements are compared with the task-start snapshot; inline callbacks also receive focused tests. This is useful regression evidence, not a proof of every native failure path. Source hashes cover all previously tracked/nonignored files, including artwork and unrelated changes. Main tabs, 8B utilities and Nutrition are rendered against that snapshot for preservation checks.

## Existing limitations retained, not silently repaired

- W01 has no active-session reorder control in the inspected implementation, despite the registry description. W04 does have reorder controls; these remain. No new reorder behavior was invented.
- W03 reads the account template library. Exact built-in artwork mappings exist on the unchanged dashboard, not this library. No images were assigned to saved templates by name or resemblance.
- O17 is manual exercise entry, not a catalog-search sheet. Existing fields and validation remain.
- Some flows do not expose distinct loading/query-error or in-flight submission states. No fake loading/error controls or new save guards were added. W04/W10 and quick-workout do not gain duplicate-submit protection from this visual work; existing guards elsewhere remain.
- Active session draft persistence catches storage errors; direct-link quick-session seed writes catch errors before navigating. These pre-existing persistence limitations remain outside scope. Native restart/retry validation remains necessary.
- Quick workout's existing saved record uses the first set's reps/load and puts varied sets into notes. Its workout name/timer state does not become a new persisted session format here. Its existing set-default behavior is unchanged; W01 completion remains explicit.
- ActivityLogSheet invokes parent callbacks and closes without awaiting the parent's save. This redesign does not claim new asynchronous failure/draft protection.
- History retains its existing kg volume display; recap/details follow the saved weight-unit preference. Existing session scores, duration inference, comparisons and PR calculations were not changed or reinterpreted as FitAdapt insights.
- Coach Spark still uses its existing AI generation and local suggestion history. A generated plan is not a logged workout. No live paid generation was performed. Offline image areas do not verify remote GIF loading.

## iPhone verification still required

```sh
cd /Users/aristos/Documents/fitness-app/fitness-mobile
pnpm exec expo start --lan
```

Use the established local/emulator setup and synthetic account for save/delete/provider-failure checks. Keep the current environment configuration; this checkpoint did not change backend targeting. Open the QR code with Expo Go on the same Wi-Fi. A Metro export is not a native iOS build.

1. In both light/dark modes, open all routes through the paths in the table. Check small iPhone width and large system text with long exercise/template names.
2. Start/resume an unfinished session. Add/edit reps and load in each supported unit, explicitly mark/unmark complete, rename/cancel, remove/cancel, save/delete an exercise preset. Background/reopen and verify the same account draft; switch synthetic accounts and verify isolation.
3. Open set editor with the keyboard shown. Scroll to Save/Cancel, dismiss keyboard, use VoiceOver/focus and verify the finish footer remains reachable. Verify sheet safe areas, backdrop/back dismissal and touch targets.
4. Browse with the keyboard and large text. Search/filter/favorite/recent/reset; preview an exercise with and without media/instructions; choose it and verify return to the same session. Test catalog unavailable/fallback in the existing emulator setup.
5. Create a template, reorder/remove, cancel and save. Launch the same saved ID. Save a recorded session as a template; confirm the original record is unchanged. Try repeated taps and interrupted saves to characterize the retained controller limitations above.
6. Finish a synthetic session; cancel confirmation first, then save. Open history, all period filters/month/custom dates, recap/map, fatigue/notes, share/clipboard, repeat and delete confirmation. Check totals against the original logged data.
7. Test quick workout units/steppers/notes/discard and activity quick/manual/edit/delete; leave optional calories/steps blank and try explicit zero.
8. Check Coach quick/custom preferences, approved synthetic/mock generation failure and review, swap, warm-up/cooldown, start/template save and local archive. Live provider verification requires a deliberate separate request; the gallery never makes one.
9. Deliberate deep links: `/(modals)/quick-cardio`, `/(modals)/quick-strength`, `/(modals)/quick-mobility`. Verify original seed/start behavior; no dashboard entry was added.

`xcrun simctl list devices booted` failed here with CoreSimulatorService connection invalid / connection refused. Native keyboard, accessibility focus, media, haptics, background persistence and platform share sheets remain unverified on-device.

Stop for design review after this checkpoint. No later family is started.
