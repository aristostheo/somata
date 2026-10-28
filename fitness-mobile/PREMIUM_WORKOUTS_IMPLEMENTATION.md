# Premium Workouts — Branding Checkpoint 5B

Implemented on `profile-redesign`. This is a Workouts presentation change, using the existing semantic theme, Home card/action recipes and Nutrition's responsive presentation primitives. No global theme, authentication, backend, stored-data, FitAdapt or navigation changes. No commit, push, merge or deployment.

## Section-by-section result

| Section | Visual implementation | Preserved behavior |
| --- | --- | --- |
| Header | Orange eyebrow, strong title, charcoal/Bone canvas, existing subtitle | Same Workouts entry. No settings control existed, so the concept's gear was not added. |
| Next session | Rounded image hero, warm edge/glow, separate readable native text, orange primary action, two secondary actions | Start new → `/workouts/session?freshStart=1`; Open session → `/workouts/session`; Plan a session → existing focus/duration sheet. |
| Planning sheet | Orange selected states, 48-point choices, wrapping durations, scrollable content and keyboard avoidance | Same optional name, muscle options, durations, cancel, trim/default and configured-session parameters. |
| Stats | Compact warm-gradient cards, orange metric icons, larger values | Original sets-today aggregation and visible/unarchived saved-template count; loading and no-record states retained. No fabricated sparkline. |
| Last seven days | Orange/coral bars, neutral tracks, brighter weekday labels and per-date screen-reader labels | Same dates, max scaling and recorded set counts; zero-height bars remain zero. No generated progress. |
| Built-ins | Six bounded photographic cards, native icon/name/movement count, chevron, two columns with single-column large-text fallback | Exact built-in catalog, UID-scoped launch payload and session parameters. |
| Surprise | Full-width orange-outlined gradient CTA | Same saved-only selection of least recently used nonempty visible template; existing empty alert. It is not a new randomization algorithm. |
| Saved template desk | Neutral document marks, untruncated names, separated entries and responsive management buttons; explicit destructive color | Use, Keep 30 days, Archive, Delete confirmation, busy states and archived Restore remain wired. No inferred photography. |
| Recent work | Icon-led session summary, date/exercise/sets hierarchy, History action | Same latest row and empty/loading states; `/workouts/history`. |
| Activity today | Icon-led editable records and Log action | Same account-scoped activity subscription and create/update/delete sheet callbacks. |
| Training tools | Compact two-column descriptive tool cards; one column at large text | All seven tools below retain their labels, descriptions and routes. |
| Navigation | Existing approved orange active Workouts state and neutral inactive states | Tab implementation is untouched: Home, Workouts, Nutrition, Alerts, Profile; unread badge unchanged. |

Training tool destinations:

- Template library → `/workouts/templates`
- Create a template → `/(modals)/create-template`
- Session history → `/workouts/history`
- Quick workout → `/(modals)/quick-workout`
- Connections → `/profile/integrations`
- Coach → `/(modals)/coach-spark`
- Coach quick pick → same Coach route with `instant: "1", quickPreset: "surprise"`

The original screen block containing state, subscriptions, date/sets calculations and all action handlers was compared with the pre-checkpoint copy and is byte-identical. Render callbacks are covered by focused tests. No loading/error contract was invented: the existing workout/template subscriptions do not expose a separate error state here. The existing Keep 30 days local key and lifecycle are unchanged; this checkpoint does not claim a storage or subscription audit.

## Artwork and treatment

The six template files supplied for 5B are **new 1122×1402 originals**, replacing the earlier 640×420 candidates before this checkpoint began. They now show the appropriate bench press, pull-up, squat, upper-body press, treadmill and mobility subjects. The mismatched-subject findings in the historical 5A report describe the earlier images; that report and its old manifest were preserved rather than rewritten.

| Source under `assets/branding/workouts/` | Mapping |
| --- | --- |
| `hero/hero-dark.png` | Dark-mode hero |
| `hero/hero-light.png` | Light-mode hero |
| `templates/push.png` | `auto-push` / Push (Strength) |
| `templates/pull.png` | `auto-pull` / Pull (Strength) |
| `templates/legs.png` | `auto-legs` / Legs (Strength) |
| `templates/upper.png` | `auto-upper` / Upper (Balanced) |
| `templates/cardio.png` | `auto-zone2` / Zone 2 Cardio |
| `templates/mobility.png` | `auto-mobility` / Mobility (10–15 min) |
| `hero/gym-equipment.png` | Decoded/audited, not used |

`builtInArtwork` checks both `source === "auto"` and an explicit own-property ID allowlist. A user template with a matching built-in name or ID still receives no photo. Unknown/prototype IDs return null.

All photography is decorative, hidden from accessibility, and cannot intercept touches. Native text, counts, buttons and chevrons remain separate. Images use `cover` inside clipped containers. Template image windows are 96×120, close to the portrait sources' aspect ratio; the surrounding card can grow with text. Hero artwork is capped at 288×216 points and additionally capped by source width/device density. This avoids enlarging the existing 960×720 hero into a full-width 3× image. No source files or approved brand assets were changed or recompressed.

Dark and light modes retain the user's selected mode through the current provider. Stronger image contrast is balanced with mode-specific native label backings and solid button surfaces. Gradients and modest shadows supply depth; no blur, autoplay or animation was added. The six original template PNGs total roughly 12 MiB compressed; real-device decode/scroll performance remains a check, not a measured claim.

## Review artifacts

Open [the gallery](review/branding-5b/index.html), or:

```sh
open /Users/aristos/Documents/fitness-app/fitness-mobile/review/branding-5b/index.html
```

- [Dark populated](review/branding-5b/workouts-dark-populated.png)
- [Light populated](review/branding-5b/workouts-light-populated.png)
- [Dark empty](review/branding-5b/workouts-dark-empty.png)
- [Light empty](review/branding-5b/workouts-light-empty.png)
- [Dark large text](review/branding-5b/workouts-dark-large-text.png)
- [Light large text](review/branding-5b/workouts-light-large-text.png)

Ten HTML pages render the **actual screen JSX** in dark/light populated, empty, loading, large-text and planning-sheet states. Data fixtures are explicitly synthetic and only exist in tooling/tests. Effects, subscriptions and real writes never run. The browser uses the installed icon font and gradient/image adapters. Native font scaling is simulated; safe insets are zero. The static tab adapter highlights Workouts but is not a live navigator. The planning sheet is rendered inline to inspect controls; it is not proof of native modal/keyboard behavior. PNGs are browser review captures; full content is available in the scrolling HTML pages.

## Comparison with the concept

The implementation follows the reference's hierarchy, prominent session card, paired stats, seven-day chart, six template grid, full-width Surprise CTA and management desk, then continues naturally into recent work, activity and tools. It uses the same charcoal/orange family as Home and Nutrition, with a corresponding light treatment.

It is **not pixel-exact**. The hero uses the supplied dark/light athlete images rather than the concept's unavailable floor-dumbbell photograph. Template images are the supplied exercise scenes rather than the concept's isolated muscle cutouts. Photos are bounded, with visible native text backings to protect contrast. No chart-like decorative line is shown on Sets today. Saved templates have neutral document marks, not the reference's inferred body imagery. Management actions use a two-column grid on ordinary phones to retain touch size, with a single column for large text. Built-in cards are taller to support real names and counts. Existing icon-library drawings are retained. Unsupported header/settings and chart-chevron actions were not invented; the existing Template library and History actions remain available.

## Validation

Commands from `fitness-mobile/`:

```sh
pnpm typecheck
pnpm test
node tools/render-workouts-preview.cjs
CI=1 EXPO_NO_DOTENV=1 pnpm exec expo export --platform all --max-workers 2 --output-dir /private/tmp/somata-5b-export
```

- TypeScript passed.
- Full mobile suite: **137 passed, zero failed**.
- Final iOS and Android Expo exports passed: **8.2 MB iOS / 8.3 MB Android** JavaScript bundles, with all eight imported workout images resolved. Output is local at `/private/tmp/somata-5b-export`; no upload or native build was performed.
- Seven new non-snapshot tests cover exact built-in mapping/user exclusion; recorded/zero/empty/loading states; session/tool destinations and planning controls; owner-scoped template launch seeds and saved usage updates; keep/archive/restore/delete confirmation/busy states; saved surprise selection and activity callbacks; both themes at narrow width/large text.
- Nine PNGs decoded and hashed; all asset imports resolve in the browser renderer. The 5B asset manifest freezes the current originals and asserts preservation on rerun.
- Ten HTML previews and six PNG captures generated. Dark/light populated, empty and large-text compositions were visually reviewed.
- `git diff --check -- fitness-mobile` passed. Existing debug logs are untouched.
- Preservation audit checked **667 existing files**: only the Workouts screen and offline preview runtime changed. All existing assets, unrelated working changes, Home, Nutrition, authentication, tab layout, services and logs remain byte-identical to the start of 5B.
- Browser preview tooling reports existing native-shadow and `pointerEvents` deprecation warnings. Expo reports the existing baseline-browser-mapping age and terminal color-environment warnings; no dependencies were changed to silence them.

The focused tests run real screen callbacks against recording mocks. They do not prove Firebase availability, native gesture handling, account-switch lifecycle or live persistence. No production accounts or data were accessed.

## Exact files changed/created

Modified:

- `app/(tabs)/workouts.tsx`
- `tools/home-preview-runtime.cjs` — Workouts-only fixtures, recording mocks and static tab selection; existing Home/Nutrition tests still pass.

Created:

- `components/workouts/PremiumWorkoutsUI.tsx`
- `tests/workoutsBrandPresentation.test.ts`
- `tools/render-workouts-preview.cjs`
- `PREMIUM_WORKOUTS_IMPLEMENTATION.md`
- `review/branding-5b/asset-audit.json`
- `review/branding-5b/index.html`
- `review/branding-5b/workouts-{dark,light}-{populated,empty,loading,large-text,plan-sheet}.html` — all ten combinations.
- `review/branding-5b/workouts-{dark,light}-{populated,empty,large-text}.png` — all six combinations.

## Phone review still required

```sh
cd /Users/aristos/Documents/fitness-app/fitness-mobile
pnpm exec expo start --go --clear
```

Use the existing intended backend/account configuration; nothing here enables emulators or changes production settings. Use synthetic records for write tests.

1. Open Workouts. Compare dark, light and System; scroll from hero to tools, check image sharpness/performance, safe-area/tab-bar clearance and large Dynamic Type.
2. Start new/Open session and return. Plan a session, open the keyboard, choose focus/duration, cancel and start; verify the same session workspace and parameters.
3. Launch all six built-ins. Confirm their names/movement counts and session contents. Confirm a custom template has neutral artwork even when named like a built-in.
4. On synthetic saved templates: Use, Keep 30 days, Archive, Restore, Cancel deletion and confirmed Delete. Confirm Surprise still selects a saved template and retains its empty behavior.
5. Verify live seven-day/today counts, History, activity Log/Edit/Delete and each training tool route.
6. VoiceOver reading order, chart date/count labels, long template names, button hit areas, five-tab selection and Alerts badge.

`xcrun simctl list devices booted` could not connect to CoreSimulatorService in this environment; native simulator checks were not completed. Physical-device actions, modal keyboard, live service persistence and image memory/scroll behavior are unverified. Expo exports are not native builds. Stop after this checkpoint for visual review.
