# Checkpoint 11 — Profile, FitAdapt & Progress

Implemented on `profile-redesign`, 21 October 2026. This is a presentation checkpoint, not a release-readiness or live-backend certification.

[Dark/light review gallery](index.html) · [Before/after comparisons](comparisons.html) · [Exact scenario manifest](manifest.json) · [Controller checks](controller-checks.json) · [Preservation checks](preservation-checks.json)

## Presentation

The family now uses the existing opt-in `SomataTaskAppearance` and semantic tokens: charcoal/graphite, warm orange/coral controls, restrained gradient panels, and Bone/white light surfaces. No new theme provider or palette persistence was introduced.

- Saved goals: numbered direction, measurements and rhythm sections; separate draft calculation with macro tiles. Accepted-plan authority remains explicit.
- Advanced calculator: estimate summary, separate energy model, maintenance override, composition and macro distribution sections.
- FitAdapt setup: approved F3 symbol, staged details/review/result framing, grouped measurements and direction, and a clear confirmation desk. Existing loading, blocked, pending, accepted, insufficient-data and retry branches retained.
- Body metrics: editable draft first, measurement desk next, calculated context separate, then connected records and dated history. Pickers use a selected-value desk, step controls and horizontal value rail. Discard and saved-goal recalculation remain explicit.
- Photos: dedicated baseline/selected comparison and full-width dated journal entries with larger actions; separate source, review, privacy and viewer presentations.
- Check-ins: focused question cards, completion summary and dated reflection records. Responses remain distinct from measurements.
- Steps: period total, dated movement chart, period statistics and daily ledger cards. Recorded zero and missing dates remain visibly different.
- Insights: period overview, consistency calendar, collapsible/expanded trends, personal-best records, collection, and share preview.
- Long-term progress: body records separated from activity/consistency; latest dated value and shared record-detail timeline.
- Advanced Metrics: eight visible desks in a wrapping menu, chart wells separated from interpretation, and individually framed scenario assumptions. All existing calculations and scenario offsets retained.
- FitAdapt history: F3-led measured/history split, read-only dated event timeline and clear accepted versus unapplied proposal targets. Existing hide/show, range, metric, retry and pagination controls retained.

Large-text section headers stack rather than squeeze alongside their badges. Fields wrap. Existing native safe-area, keyboard-avoidance, scroll, button, selected-state and dismissal behavior remains in TaskUI/FlowUI.

## Complete surface inventory — 23/23

“Complete” below means implementation and offline JSX review coverage, not physical-device approval. Every named preview has dark/light versions; see manifest for filenames and source routes.

| ID | Surface | Status / review fixture | Reach from Profile |
|---|---|---|---|
| P01 | Saved profile & goals | Complete — P01-goals, accepted, invalid, busy | Edit saved profile & goals |
| P02 | Advanced goal calculator | Complete — P02-advanced, invalid | Goal setup → Advanced calculation settings |
| O29 | Weight-change decision | Complete — O29-weight-decision | Goal setup → save a qualifying weight change |
| P03 | FitAdapt setup/completion | Complete — P03-details, confirm, busy, invalid, insufficient, failure, pending, accepted, loading, status-error | Existing Complete-profile path; new-account setup |
| P04 | Body measurements | Complete — P04-records, empty, invalid, loading | Records & reflection → Body measurements |
| O12 | Measurement pickers | Complete — O12-weight, target, height, age, bodyfat, waist, neck, hip | Tap the corresponding measurement; hip retains equation-sex condition |
| O13 | Unsaved-measurement discard | Complete — O13-discard | Body measurements → edit → Back |
| O14 | Keep/recalculate saved goals | Complete — O14-recalculate | Save a qualifying weight change |
| P05 | Private photo journal | Complete — P05-journal, empty | Collection & connections → Progress photos |
| O20 | Camera/library chooser | Complete — O20-photo-source | Progress photos → + |
| O21 | Photo review/note | Complete — O21-photo-review | Choose/capture a photo |
| O22 | Photo privacy notice | Complete — O22-photo-privacy | Existing first-use notice |
| O23 | Photo viewer/comparison | Complete — O23-photo-viewer; P05-journal comparison | View photo / baseline or selected photo |
| P06 | Weekly check-in/journal | Complete — P06-step-0 through step-5, empty-history | Records & reflection → Weekly check-in |
| P07 | Steps history | Complete — P07-steps, empty, loading, unavailable | Records & reflection → Steps history |
| P08 | Insights & progress | Complete — P08-insights, empty | Records & reflection → Insights |
| P09 | Long-term progress | Complete — P09-longterm, empty | Records & reflection → Long-term progress |
| O19 | Long-term record detail | Complete — O19-records | Long-term progress → Inspect records |
| O26 | Expanded insight chart | Complete — O26-chart | Insights → Expand trend |
| O27 | Badge detail | Complete — O27-badge | Insights → collection badge |
| O28 | Weekly share preview | Complete — O28-share | Insights → share icon / Open share card |
| P10 | Advanced Metrics | Complete — P10-calories/protein/macros/weight/performance/hydration/activity/projection, plus empty case for each | Insights → Explore advanced metrics |
| P11 | FitAdapt Insights & History | Complete — P11-trends, hidden, history, history-error, history-loading, empty, empty-history | Profile → FitAdapt insights & history |

## Sources and protected behavior

| Presentation | Existing source retained |
|---|---|
| Saved-goal calculation | `services/macroCalculator.ts`, authenticated `services/profile.ts`, shared in-memory goal draft |
| FitAdapt setup | `services/fitadaptSetup.ts`, `fitadaptOnboarding.ts`, `fitadapt.ts`; UID-scoped setup draft; existing save-before-review runner |
| Body measurements | Authenticated profile plus account-scoped `services/profile/bodyMetrics.ts`; existing units/conversions/history |
| Private photos | `services/progressPhotos.ts` and account-local files/store; no upload or new retention behavior |
| Check-ins | `services/weeklyCheckin.ts`, existing account-local answers and existing weekly-stat queries |
| Steps | Current account profile's dated steps, existing denominator and goal/default behavior |
| Insights / Advanced Metrics | Existing nutrition/exercise/activity queries, current `nutritionTargets`, account-local water/body history and badges |
| Long-term | Existing body history, workouts, food records, filters and current-goal consistency calculations |
| FitAdapt history/trends | `fitadaptHistory.ts` owner-scoped bounded history; `fitadaptHistoryData.ts` allowlist; recorded account weight, nutrition and steps via `fitadaptInsightData.ts` |

No service, backend, rule, permission, route, storage format, authentication, target helper or calculation file changed. No new evaluation, acceptance, decline or server-owned write path. All five main-tab sources remain byte-identical to the starting working tree, including the main Profile review component and its explicit Accept/Decline flow.

Controller audit: all 13 changed screen/picker/view files retain their non-JSX function statements, excluding visual hook selection and the Advanced Metrics color mapper. No existing inline event attribute was removed. Setup's error-state Return to Profile now uses the existing premium Button with the same route callback instead of the local visual button helper. These static checks complement interaction tests; they are not a proof of native runtime behavior.

## Exact files changed in this checkpoint

Existing files, relative to `fitness-mobile/`:

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
- `app/profile/advanced-metrics.tsx`
- `app/profile/fitadapt-insights.tsx`
- `components/homeFlows/FitAdaptInsightsView.tsx`
- `components/accountSettings/useProfileFlowTheme.ts` — new explicit `usePremiumProfileFlowTheme` export; original hook unchanged for other destinations.
- `components/somata/Trend.tsx` — optional `premiumProfile` colors; existing geometry and default appearance unchanged.
- `tools/home-preview-runtime.cjs` — optional offline Profile adapter only.

New files:

- `components/profile/ProfileTaskUI.tsx` — presentation-only intro, section, field group, metric tiles and dated record components.
- `tools/profile-flow-runtime.cjs` — synthetic service/state adapter; native/provider access blocked; independent repeated picker/card state.
- `tools/render-profile-family-preview.cjs` — synthetic fixtures and gallery generator.
- `tools/verify-profile-family-preservation.cjs` — snapshot/hash, controller and earlier-family render verification.
- `tests/profileFamilyPresentation.test.ts` — 11 regression tests exercising actual screen JSX/actions, not styling snapshots.
- `review/branding-11/` — this report, validation/preservation/controller/browser JSON, manifest, index, comparisons and explicitly labeled synthetic HTML/PNG previews. `manifest.json` lists every generated HTML filename; `browser-capture-checks.json` lists every PNG filename.

Unrelated work, debug logs, master artwork, Expo configuration and dependencies were preserved. No commits, branches, push, merge or deployment.

## Validation

Commands run from `fitness-mobile/`:

```sh
pnpm typecheck
pnpm test
TZ=America/Toronto node --import tsx --test tests/profileFamilyPresentation.test.ts
TZ=America/Toronto node --import tsx --test tests/fitadaptSetup.test.ts tests/nutritionTargets.test.ts
TZ=America/Toronto node --import tsx --test tests/localAccountIsolation.test.ts tests/fitadaptSetup.test.ts tests/profileBrandPresentation.test.ts
TZ=America/Toronto node --import tsx --test tests/fitadaptInsightData.test.ts tests/fitadaptHistoryData.test.ts tests/fitadaptSetup.test.ts
EXPO_OFFLINE=1 pnpm exec expo export --platform ios --output-dir /private/tmp/somata11-ios --max-workers 2
EXPO_OFFLINE=1 pnpm exec expo export --platform android --output-dir /private/tmp/somata11-android --max-workers 2
node tools/render-profile-family-preview.cjs --before-root /private/tmp/somata-11-before/fitness-mobile
node tools/verify-profile-family-preservation.cjs --before-root /private/tmp/somata-11-before/fitness-mobile --baseline /private/tmp/somata-11-before-hashes.json
xcrun simctl list devices available
```

Results:

- TypeScript passed.
- Full mobile suite: **205 passed, 0 failed** (194 existing + 11 new).
- Focused family suite: **11 passed**. Additional stage suites: 12, 14 and 13 tests passed respectively.
- iOS and Android Expo/Hermes exports passed; approved S3/F3 image modules resolved. These are JS/assets exports, not native builds.
- **1,792 of 1,808 preexisting files unchanged**; only the 16 listed existing files changed. **125 existing branding files unchanged**.
- Identical before/after markup for **10 primary-tab**, **24 Home utility**, **84 Nutrition family** and **90 Workouts family** cases.
- **342 HTML previews**: 79 named scenarios in both themes, before/after, plus 26 narrow/large-text after states. Browser screenshots are synthetic, not iPhone screenshots. 204 browser PNG captures completed with 0 horizontal document overflows at the tested widths. The capture JSON records the results.
- CoreSimulator failed with `CoreSimulatorService connection became invalid` / `Connection refused` in this session. No native visual, camera, permission or keyboard pass is claimed.
- Existing React Native Web DOM/deprecation warnings and Expo's stale browser-mapping warning remain. No dependency upgrades or unrelated warning suppression.

The first added measurement test used a fixture whose new value equaled its original value, correctly producing no discard prompt. The fixture was corrected; production behavior was not changed. Repeated measurement picker state was also isolated in the offline adapter so gallery values match each picker, rather than sharing an SSR fixture slot.

## Known inherited limitations — unchanged

- General Insights/Advanced Metrics/long-term summaries retain existing missing-day denominators, some zero-filled aggregates, legacy interpretation text and fixed scenarios. No new sample measurements or smoothing were added. These summaries are explicitly distinguished from FitAdapt's recorded-only views. Changing their statistical assumptions needs a separate behavior checkpoint.
- Body measurements has legacy draft defaults when no saved values exist. The new label says editable draft; those defaults are not dated history. Existing picker option arrays and conversions were preserved, including metric-mode option/step behavior that needs a separate functional audit.
- Body-history removal currently affects the in-memory history view only; it is not a persistent history-deletion operation. This behavior and its native confirmation were preserved.
- The saved-goal weight-change confirmation sets confirmation state and calls the existing save closure; React state timing/reopening deserves a native regression check. No save handler was rewritten here.
- Advanced goals updates the shared draft immediately and returns to Goal setup for saving. Picker selections similarly edit the parent draft immediately; Done does not itself save a profile. No fictitious Apply/Cancel rollback was added.
- Weekly share is an existing **screenshot preview**, not a native Share-sheet operation. Some Advanced Metrics `onExpand` callbacks are dormant because the existing ChartCard does not expose an expand control; existing working scenario expansion remains. No placeholder actions were introduced.
- Photo fixtures use neutral synthetic areas; they do not verify native image orientation, capture, persistence or permissions.
- FitAdapt does not gain historical rationale, confidence or forecast fields. Invalid/incomplete persisted history still shows the existing unavailable detail message.

## iPhone review

Start the existing development configuration without changing its backend target:

```sh
cd /Users/aristos/Documents/fitness-app/fitness-mobile
pnpm exec expo start --lan --clear
```

Open in the installed compatible Expo Go/development build and use the existing synthetic emulator setup for any destructive, save, review or acceptance tests. This checkpoint did not change environment flags or cloud configuration. Browsing the gallery needs neither Firebase nor FitAdapt.

```sh
open review/branding-11/index.html
open review/branding-11/comparisons.html
```

- Check both light/dark modes, narrow iPhone layout and large Dynamic Type. Confirm VoiceOver labels/order, focus, keyboard avoidance and reachable sticky Save/Continue buttons.
- Follow all routes in the surface table. Check all eight measurement pickers in both unit modes and the optional hip path; verify Back/discard and keep/recalculate choices using synthetic records.
- Edit saved goals and advanced draft; ensure accepted targets remain active. Test setup details → confirmation → saved/insufficient/error, retry/continue, existing pending/accepted guard paths. Accept/Decline still occur on the unchanged main Profile only.
- Exercise camera/library allowed, denied and canceled; review/note/save/cancel; baseline/selected comparison, previous/next and explicit delete. Verify only the current account's local photos are visible.
- Complete a check-in, reopen its journal, inspect empty/recorded steps and trends, badges and the screenshot share preview. Check ranges and all eight Advanced Metrics desks/scenario expansion.
- In FitAdapt Insights & History, test all three recorded metrics, Hide/Show, resolved accepted/declined events, retry and Load older decisions. Verify no current target changes from viewing history.

Stop here for visual review; no next checkpoint was started.
