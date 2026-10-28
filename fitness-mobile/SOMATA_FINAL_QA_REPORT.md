# Somata — final premium UI QA

2026-10-28 · `profile-redesign` · Branding Checkpoint 13

**The premium redesign is accounted for across all 98 registered surfaces. Automated and browser QA do not establish a safe public release.** Four existing presentation files were corrected, with one new startup presentation component. Account preparation, navigation destinations, calculations, persistence and security behavior were preserved. Functional and release gaps below remain open.

## Review package and coverage

- [Complete 98-row ledger](review/branding-13/COVERAGE.md): every route, nested sheet/dialog and both startup gates; relevant source, states, tests, dark/light evidence and native limitations.
- [Current dark/light gallery](review/branding-13/index.html): **786 current-source HTML previews and 198 browser PNG captures**, covering **98/98 IDs**. Synthetic fixtures, no personal accounts or network requests. First family scenarios also include 320px / approximate 1.8× Text; auth has 320px normal-text views. Native TextInput scaling is not simulated.
- [Approved/current comparison](review/branding-13/comparisons.html), [safe-fix comparisons](review/branding-13/fixes.html), [browser measurements](review/branding-13/browser-checks.json).
- [Source audit](review/branding-13/source-audit.json): 106 registered source/shared modules, action/state lines, imports, source hashes, all 24 routing entries and six layouts. Static coverage is not a claim that each action executed against a backend.
- [Preservation evidence](review/branding-13/preservation.json), [validation receipt](review/branding-13/validation.json), [exact checkpoint file list](review/branding-13/changed-files.json).

| Family | Surfaces | Evidence / qualification |
|---|---:|---|
| Home utilities | 4 | Current JSX, normal/empty/loading where supported, steps and calendar sheets; mocked controller tests. |
| Nutrition | 17 | Search/manual/AI review, scanner variants/editors, builder, preferences/suggestions/water; synthetic success/failure states and handoffs. |
| Workouts | 22 | Session, exercise catalog, templates, history/recap, coach/activity/quick-entry sheets; controller tests and synthetic media placeholders. |
| Profile/FitAdapt/progress | 23 | Goal/setup/measurement/photo/insight/history states; target, history, account-storage and explicit review tests. |
| Social/settings/account | 21 | Shared/private/unavailable/loading/error states; confirmation and draft controls. User reports CP12 phone verification passed; this is prior family evidence, not a new exhaustive device pass. |
| Five tabs, three auth screens, recovery, two gates | 11 | Approved layouts retained, current render comparison, auth/route/subscription tests; isolated gate/recovery corrections. |
| **Total** | **98** | No surface omitted; none is labeled a newly completed native-device verification. |

The 24 aliases and six layouts are recorded separately, not added to the 98. Redirect source and existing canonical-route/SDK58 TabRouter tests were checked. Simple Account aliases discard unused query parameters; feature redirects preserve parameters where currently implemented. Native cold-link, swipe-dismiss and Android Back coverage is still outstanding. N09 and W11–W13 remain deep-link-only; no new entry point or navigation structure was added.

## Safe presentation fixes

1. **G01 launch/session loader:** replaced the inherited navy/pale-blue gradient with existing semantic charcoal/bone surfaces, warm indicator and readable copy. Approved S3 remains bounded at 120 points. Status-bar behavior is retained.
2. **G02 secure preparation/retry:** added the same presentation, scalable error text, a 48-point-minimum retry action and scrollable content. A local safe-area provider wraps only this gate. The account/private provider hierarchy is unchanged; private children still cannot mount until preparation succeeds. Before ThemeProvider is available, this surface follows system appearance without reading/writing another theme preference.
3. **T10 unknown-route recovery:** opted into the existing premium Task appearance. Back still uses the existing history when available; Home replacement is unchanged.
4. **Long labels:** the actual W01 long exercise fixture clipped “Add set to …”; W06 duration choices and P08 badge choices overflowed at simulated large text. Added `maxWidth: "100%"` and `minWidth: 0` to the existing premium Button and Choice. Text wraps inside its available width. No labels, callbacks, disabled state or selected values changed. Legacy/unopted recipes are unchanged.

Before-fix HTML/PNG evidence for affected label cases is preserved in this checkpoint's gallery. Historical review packages and all approved artwork were left untouched. Comparison of 96 historical/current primary/auth fixture bodies found 86 byte-identical bodies. The remaining ten Workouts cases use a moving seven-day date fixture (October 18 → October 28); these are not pixel-identical claims. All 96 comparisons are recorded in `approved-comparison.json`. Register/reset have new current previews; the historical auth capture package covers login only.

The five main tab sources and auth form sources are byte-identical to the checkpoint-start baseline; their layouts were not redesigned.

## Visual and accessibility findings

- Charcoal/graphite, orange/coral controls, bone/light equivalents and existing typography/radii remain consistent across adopted premium recipes. Authentication still uses the compact, proportional approved S3 horizontal lockup.
- S3/F3 master hashes and Profile/Workouts decorative PNG hashes were checked by the existing render tools. No mark was redrawn or replaced. No image/background data is being presented as native controls or real measurements.
- Meaningful success/warning/error and chart-series colors were preserved. **D01 — Low:** Home's fat series is purple, Nutrition's is yellow, and the semantic data defaults differ. Explicit labels remain; a future deliberate legend decision is needed before any global remapping.
- **D02 — Medium:** branded premium controls use fixed semantic colors while Theme Picker persists custom palettes for remaining legacy consumers. Save/Cancel works, but customization is not uniformly visible. This existing product-design split was not silently resolved by overwriting preferences.
- Token/auth contrast tests pass for their tested pairs. Representative dark/light pages were visually inspected; this is not a pixel-by-pixel contrast certification of every gradient, disabled state or native control.
- Premium shared actions use 48–50-point minimum hit areas, scalable labels and selection/disabled semantics. Successful browser overflow checks do not prove VoiceOver order, focus, exact touch geometry, or all native Dynamic Type sizes.
- Final browser measurement: **786/786 pages checked, zero horizontal document overflows, zero non-scrolling text-content overflows, no truncated captures**. The initial broad geometric scan is retained separately; the final classifier excludes deliberate horizontal scrollers and decorative SVG bounds.
- Calendar month/year grids, exercise/muscle filters, measurement pickers and Alerts filters intentionally scroll horizontally. The first geometric scan flagged these and clipped decorative SVG bounds; they were inspected separately rather than counted as broken page overflow.
- **A01 — Medium:** root route fading (`app/_layout.tsx`) still runs its existing 220ms animation without a reduced-motion branch. TaskSheet does honor reduced motion. No transition logic was changed in this presentation pass; native motion and screen-reader focus need a targeted accessibility follow-up.
- Static renders use inert/stand-in camera, photo, QR, native picker and media surfaces. They verify composition, not actual capture, scanning, image orientation, native video/GIF playback or permission handling.

## Cross-feature regression results

These are **synthetic unit/controller tests**, not one live end-to-end account session. The full mobile suite passed; relevant families are identified below. No paid provider request, production write, real deletion or live cloud verification was performed.

| Workflow | Current automated evidence | Still required |
|---|---|---|
| Food → review → Nutrition | `nutritionFamilyPresentation`, `nutritionDelivery`, `previewNutritionProjection`: selected date/meal, confirm-before-save, duplicate handoff, failed delivery/retry, edits/deletion callbacks. | Real emulator logging and native keyboard/back smoke check. |
| Scan → review → log | `aiBoundary`, `nutritionFamilyPresentation`: validated mocked estimates, review/edit, explicit confirmation, errors and no invented result. | Phone camera/library permissions, barcode capture, supported image formats and actual provider result. |
| Scan → Meal Builder | `mealBuilderHandoff`, nutrition controller tests: UID ownership, expiration, malformed/duplicate consumption, account switch, final bundle logging. | Native navigation/background/relaunch with two synthetic accounts. |
| Workout start/resume/finish | `workoutsBrandPresentation`, `workoutFamilyPresentation`: account draft, set completion/units, renamed/cancelled input, finish failure, confirmed deletion and routes. | Device restart and interrupted saves; duplicate-submit limitations below remain. |
| Templates/history/recap | Workout tests: existing ordering, failed-save draft retention, date range validation, scoped repeat/delete, actual history/recap data mapping. | End-to-end persistence/relaunch and remote exercise-media playback. |
| Saved goals/setup | `fitadaptSetup`, `profileFamilyPresentation`: validation, signed pace/units, save-before-review, insufficient data, retry and accepted-plan guards. | Native confirmation closure/measurement unit concerns below. |
| FitAdapt pending/accept/decline | `nutritionTargets`, `profilePlanPresentation`, `profileBrandPresentation`, history/insight/setup tests: accepted projection precedence; pending cannot replace current targets; explicit callbacks and stale/failure states. | Local/cloud callable acceptance and queue smoke tests were not rerun here. A passing UI mock is not cloud acceptance evidence. |
| Measurements/progress | Profile/history/insight/trend tests: dated records, missing vs zero, one-point trend, bounded event ordering, photo path validation/owner cleanup. | Native photo persistence and in-memory-only history deletion issue below. |
| Friends/privacy | `friendSummary`, `friendVisibility`, `socialAvailability`, `socialFamilyPresentation`: redaction/private states, accepted-friend consent, template refetch and settings fields. | Two synthetic accounts against deployed hardened rules/callable; report submission gap below. |
| Alerts | `alertsBrandPresentation`, `alertsSubscription`: filters, read/dismiss actions, route mapping, account subscription cleanup and error states. | Native notification permissions, remote delivery and deep-link opening. |
| Theme Save/Cancel | `themePicker`, `sdk58ThemeNavigation`, social tests: drafts, cancellation, duplicate saves, async dismissal guards, failed-save retained values/retry. | Native gestures, OS appearance changes and restart. |
| Account switch/deletion | `accountLocalStorage`, `progressPhotoStorage`, `accountDeletion`, release guards: scoped keys/files, ambiguous legacy isolation, confirmation/recent auth and failure behavior. New `finalQAGates`: failed preparation hides private children, retry, second-account failure, bounded startup artwork and recovery routing. | Synthetic device deletion/retry and rapid A→B→signed-out checks; unresolved server retention holds. |

Security inspection confirms the mobile AI path still invokes authenticated `generateSomataAI`; safe friend summaries remain callable-backed with no raw friend-document fallback. Local rules still deny client writes to accepted FitAdapt targets/plans/history. The checkpoint-start hashes prove no service, rule, auth form, notification permission, entitlement, deletion or backend implementation changed. This is preservation evidence, **not a fresh audit of deployed rules**; current production/staging deployment state was not queried.

## Functional issues requiring a separate checkpoint

Severity describes user impact, not permission to alter behavior. **No new confirmed Critical defect was established by this local UI pass.** Unknown deployed security posture must not be mistaken for a pass.

| ID / severity | Evidence and user impact | Separate action |
|---|---|---|
| **F01 High — blank nutrients become zero** | `quick-add.tsx:submitQuickMacros`, logged-food `toNum`, scanner AddFood and manual entry paths coerce blanks/defaults. Totals and evidence can look more complete than entered. Existing accepted-target precedence is unaffected. | Define required vs optional nutrients per boundary; preserve unknown, add save/edit/scan compatibility tests. Do not retroactively infer missing values. |
| **F02 High — false water success** | `quick-hydration.tsx:add` catches storage failure, then always shows “Logged …” and closes. Users can lose a record without knowing. | Await successful owner-scoped storage, keep draft on failure, show retry safely; test switch/failure/duplicate taps. |
| **F03 High — repeated workout saves** | `create-template.tsx:saveTemplate`, `save-workout-as-templates.tsx`, `quick-workout.tsx:saveWorkout` lack consistent in-flight/idempotency protection. Repeated taps or partial retries can create duplicate templates/entries. | Add focused submission guards and retry semantics without changing the existing record schema by assumption. |
| **F04 Low — session reorder not supported** | Active session W01 has no reorder action; W04 template editor does. Registry description overstates W01. | Product decision if session reordering is desired; not a lost redesign feature. |
| **F05 Medium — step averages include unknown days** | `steps-history.tsx` fills missing dates with zero before total/average/goal-hit/streak aggregates. Visible rows separately track recorded dates. Average can suggest inactivity rather than absence of evidence. | Adopt an explicit recorded-days vs calendar-days denominator and label it; test sparse/zero history. |
| **F06 Medium — mixed chart provenance** | General Insights, long-term progress and Advanced Metrics retain calculated scenarios, some zero-filled periods and legacy local interpretations. FitAdapt's dated, account-scoped trends are separate. Current goals are not proof of historical targets. | Audit each series/source/effective period and label estimates; no invented historical target overlay or data migration. |
| **F07 High — body-history removal is not persistent** | Body measurements removes an item from in-memory history only; reload can restore it. Editable draft defaults and metric picker option/step behavior also need functional review. | Define and implement actual owner-scoped deletion if intended; verify each metric/imperial picker. Do not broaden server deletion. |
| **F08 High — meal filtering can fall back to full library** | `what-should-i-eat.tsx` uses `filtered.length ? filtered : MEAL_DB`, so no-match restrictions/dislikes may be bypassed. Not an allergy-safe filter. | Preserve exclusions and show an honest no-match result; audit supported restriction semantics. |
| **F09 High — legacy workout failure handling** | Active-session draft persistence and quick-session seed writes catch errors; ActivityLogSheet can close without awaiting parent save. Quick workout persists first-set reps/load and varied sets as notes. | Retain draft/error feedback and define retry behavior; test interruption. Keep record-fidelity decisions separate from styling. |
| **F10 Medium — goal confirmation timing** | Goal weight-change confirmation sets confirmation state and invokes an existing save closure. React timing/reopening remains a native regression concern; no newly reproduced data loss is claimed. | Reproduce with a synthetic account and test both keep/recalculate actions before modifying logic. |
| **F11 High — reporting path unavailable** | `services/friends/friendsSafety.ts:createReport` writes `reports/{id}` through the client SDK; this collection is denied by the hardened rules; no supported authorized reporting backend is established in the current release reports. Some relationship failures offer limited feedback. | Implement an authenticated, abuse-resistant reporting operation and retention policy; never restore broad client access. |

## Native and release gates

| Gate | Evidence / status |
|---|---|
| iOS/Android JS and assets | Expo/Hermes exports are recorded in the validation receipt. **Not native builds.** |
| Simulator discovery | `xcrun simctl list devices booted` first hit sandbox denial; read-only retry outside sandbox succeeded, listing iOS 26.0 with **no booted device**. Available devices were discovered. An attempted iPhone 16e boot reported finished, but the immediate Expo Go container lookup failed with simulator error 405, **Shutting Down**. An initial UUID selection also booted the iPad A16; it was already shut down at cleanup. No app was launched, compatible Expo Go availability could not be established, and no native UI pass is claimed. |
| Local toolchain | `xcodebuild -version`: Xcode **26.0.1 / 17A400**. `sw_vers`: macOS **15.8.1**. Existing ignored native project was generated before SDK58 and was preserved. No fresh native compile, signed archive or provisioning verification here; see `../SDK_58_UPGRADE.md` and prior native-build report. |
| iPhone/Android hardware | Camera, photo permissions, keyboard, native sheets, exercise media, VoiceOver/TalkBack, Dynamic Type, reduced motion, launcher/splash, adaptive icon masks and Health provider states **untested in this run**. |
| **R01 High — cloud staging/backend** | Separate staging deployment and synthetic cloud verification are outstanding. Billing/resources are not approved. AI/FitAdapt worker/friends/deletion/rules must be verified in the actual isolated deployment before release. No production fallback may be used to fill missing staging config. |
| **R02 High — legal/support** | Published operator-approved privacy-policy and support HTTPS URLs are still required. Existing release checks remain fail-closed. No legal copy or placeholder URL was added. |
| **R03 High — deletion/retention** | Unknown Storage/legacy AI cache ownership, safety reports, backups/logs, shared contributions, provider revocation and tombstone retention still need explicit decisions. Existing holds are preserved; no broad deletion or retention policy invented. |
| **R04 High — native readiness** | Matching SDK58 native generation/toolchain, signing, device permissions, Health capability states, account switching and release update isolation need proof. Expo Go cannot verify launcher/splash or remote push/native Health support. |
| Checkout | Missing-backend checkout remains disabled. It is not a reason to expose a broken purchase action. Any future enablement requires a working server path and its release tests. |

Read current follow-ups in `../TESTFLIGHT_READINESS.md`, `../OFFLINE_LAUNCH_READINESS.md`, `../IN_APP_RELEASE_BLOCKERS.md`, `../ACCOUNT_DELETION.md`, `../LOCAL_ACCOUNT_ISOLATION.md` and `../STAGING_BACKEND_ROLLOUT.md`. Historical production observations in older documents are not current deployment evidence.

## Exact code/tool changes

Existing files changed in this checkpoint only:

- `app/_layout.tsx` — G01 presentation.
- `content/AuthContext.tsx` — G02 presentation and system appearance read; existing authentication/preparation effect unchanged.
- `app/+not-found.tsx` — scoped premium appearance.
- `components/somata/TaskUI.tsx` — premium Button/Choice width bounds only.

New files:

- `components/somata/StartupSurface.tsx` — stateless startup/retry UI; approved S3 and existing tokens.
- `tests/finalQAGates.test.ts` — three focused gate/retry/recovery tests.
- `tools/render-final-qa.cjs`, `tools/capture-final-qa.cjs`, `tools/audit-final-qa.cjs` — offline synthetic rendering, browser measurements and source/preservation receipts.
- `SOMATA_FINAL_QA_REPORT.md` and `review/branding-13/` — ledger, HTML/PNG gallery, comparisons and JSON receipts. `changed-files.json` names every generated file; `manifest.json` maps every current HTML preview to an ID/mode/state.

No dependency, Expo config, theme persistence, approved artwork, tab structure, service, calculation, rule, production/staging configuration or existing log was changed. The exact-start baseline includes **2,850 existing files**. All changes outside the four allowlisted presentation files fail the preservation script. Root/Auth effect callbacks compare exactly to the before snapshot. No commit, push, merge, deployment or migration occurred.

## Validation commands

From `fitness-mobile/`, the installed supported runtime was selected without changing system Node:

```sh
export PATH=/Users/aristos/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin:$PATH
pnpm typecheck
TZ=America/Toronto pnpm exec node --import tsx --test --test-concurrency=2 tests/*.test.ts
CI=1 pnpm exec expo export --platform ios --platform android --max-workers 2 --output-dir /tmp/somata-13-export-final
TZ=America/Toronto node tools/render-final-qa.cjs
node tools/capture-final-qa.cjs
node tools/audit-final-qa.cjs /tmp/somata-checkpoint13-baseline.json /tmp/somata-checkpoint13-before
```

Capture requires the isolated local Chrome debugging session on port 9322; it does not run the app backend. Preservation needs the pre-edit snapshot, not a baseline generated after editing. The complete test suite includes all applicable focused tests; a separate focused gate run was also used while correcting its fixture assertion. No snapshot-only styling tests were added. Mobile has no lint script; no lint pass is claimed. Existing browser-mapping, RN Web prop and react-test-renderer deprecation warnings remain unsuppressed. Exports/test results and browser totals are recorded in `review/branding-13/validation.json`.

## Phone handoff and prioritized next actions

1. **Behavioral reliability:** address F01/F02/F03/F07/F08/F09 in a separate, tested behavior checkpoint. Confirm F10 on device. These are not repaired by prettier screens.
2. **Accessibility/native walkthrough:** open the gallery with `open review/branding-13/index.html`; it needs no emulators. Then use the existing synthetic local setup in [FITADAPT_EXPO_GO_LOCAL.md](../fitness-web/functions/FITADAPT_EXPO_GO_LOCAL.md), not a personal account for destructive tests. With its demo Auth/Firestore/Functions and local FitAdapt running, start the phone app:

   ```sh
   cd /Users/aristos/Documents/fitness-app/fitness-mobile
   export PATH=/Users/aristos/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin:$PATH
   EXPO_PUBLIC_USE_FIREBASE_EMULATORS=true \
   EXPO_PUBLIC_FIREBASE_EMULATOR_PROJECT_ID=demo-somata-fitadapt \
   EXPO_PUBLIC_FIREBASE_EMULATOR_HOST="$(ipconfig getifaddr en0)" \
   pnpm exec expo start --go --lan --clear
   ```

   Use the active Wi-Fi interface if not `en0`; phone and Mac must share Wi-Fi. Permit local-network/firewall access if prompted. Use the fixture's synthetic email/password. Do not paste credentials in the report. Fully restart Expo when changing Firebase targets; do not rely on hot reload.
3. **iPhone checklist:** test dark/light and system appearance; narrow display and maximum accessibility text; keyboard-open login/search/edit/reauth forms; VoiceOver names/order/focus; reduced-motion behavior; back/swipe dismissal for sheets and cold links. Check the long workout action/duration/badge labels. Force a synthetic account-preparation failure and retry without exposing old-account content.
4. **Cross-feature device checklist:** food manual→review→save/edit/delete; camera allow/deny/retry→review→log; scanner→Builder once; start/resume/finish workout then reopen history/recap/template; save goals without changing accepted FitAdapt targets; fresh synthetic proposals for Accept and Decline; photo save/relaunch/metadata/missing-file state; two-account friendship/privacy/read/dismiss notifications; theme Cancel then Save/restart; sign out/switch/deletion failure/retry with synthetic accounts only.
5. **Native build checklist:** use a fresh audited SDK58 development build to verify notification permissions/delivery, Health capability-unavailable/available states, launcher/splash and Android adaptive masks. Do not treat this export or an old SDK57 native folder as a signed release artifact.
6. **Release inputs and backend:** supply published URLs and retention decisions; separately authorize staging billing/resources before rollout. Deploy and verify hardened rules/Storage, trusted services/functions and scheduled worker in staging following the existing guarded runbook. Verify security denials and complete account cleanup using synthetic accounts. Keep checkout disabled.

**No TestFlight or public-launch readiness claim is made.** The UI migration has a complete evidence ledger; native, cloud and the explicitly listed behavioral/release gates still need closure.
