# Premium Profile + FitAdapt — Branding Checkpoint 6B

Presentation-only implementation on `profile-redesign`. The supplied concept is the visual target; the existing Profile remains the functional source of truth. No backend, authentication, storage, rules, navigation structure, other tab, or approved artwork was changed in this checkpoint. No commit, push, merge, or deployment was performed.

## Section-by-section implementation and comparison

| Section | Implementation | Deliberate difference from the concept |
| --- | --- | --- |
| Header | Charcoal/Bone canvas, bounded ambient artwork, orange eyebrow, strong Profile title and supporting copy | Existing Hide/Show values action stays in the header; the concept's blue gear is not introduced. Settings remains in Your settings. |
| Account identity | Compact warm-edged panel, real account name/email/photo, existing Account action | Uses the existing initial fallback when there is no photo; does not invent an avatar. Long names and addresses wrap. |
| Current focus | Prominent goals backdrop, native target icon, balanced 2×2 target tiles, orange energy emphasis, saved-versus-accepted explanation and edit action | Actual shared-helper state determines Your goals, Active plan, or unavailable state. Existing accepted-plan attribution remains conditional. |
| Pending review | Separate opaque comparison card with current/proposed values and explicit Accept/Decline | Not pictured in the reference; remains a distinct state and never supplies the current-focus values. |
| FitAdapt review | Approved F3 symbol, restrained backdrop, native explanatory text, notes and warm actions | All existing real states are retained, not just the screenshot's unavailable state. No invented rationale or confidence. |
| Measured progress | Steps and latest weight tiles grouped with an opaque weight trace panel and Insights & history action | No illustrative bars or sample sparkline. Existing semantic steps orange and weight blue remain distinct. Only the original dated-record helper supplies a chart path. |
| Records & reflection | Seven framed compact rows with icons and chevrons | Minimum 48-point controls and scalable text make the real page taller than the one-frame concept. |
| Your settings | Five compact rows, existing labels and destinations | Theme choice and persistence are unchanged. |
| Collection & connections | Four actions in a responsive 2×2 grid | Stacks at narrow/large-text layouts; labels remain readable. |

The supplied backgrounds are soft atmospheric curves, not the concept's mountain/terrain rendering. They are used unchanged. No additional logo, texture, chart, or artwork was generated to imitate unavailable artwork. F3 uses `assets/branding/fitadapt/symbol-color.png`; the existing attribution uses `reconciled-1b/fitadapt/powered-by-f3-compact-{dark,light}.png`. No new S3 placement was added where the screen had no Somata logo.

## Assets, layout and accessibility

- `assets/branding/profile/ambient-{dark,light}.png`: bounded upper-page atmosphere.
- `assets/branding/profile/goals-{dark,light}.png`: current-focus card.
- `assets/branding/profile/fitadapt-{dark,light}.png`: review card.
- `assets/branding/profile/progress-{dark,light}.png`: measured-progress group, outside its opaque chart surface.
- All eight remain original 2400×1200 PNGs. Cover-scaled images are clipped inside rounded containers; their heights are independent of growing text. Density-aware bounds avoid increasing their drawn dimensions beyond source resolution.
- Images are decorative, non-interactive and hidden from accessibility. Text, values, chart paths, icons and buttons remain React Native components.
- Uses existing semantic tokens, premium Home surface tokens, appearance context and responsive grid. No new theme persistence or parallel palette store.
- Buttons/rows have 48-point minimum touch height; Hide/Show is 48×48. Text scaling remains enabled. Grid tiles stack, header wraps, and pending comparisons wrap rather than truncating values. Scroll content accommodates longer states.
- Dark and light surfaces use theme text/secondary text/disabled/focus tokens. Automated previews help inspect contrast but do not replace device/VoiceOver review.

## Preserved actions and data sources

The Profile data-derivation block, from router/account setup through target masking and pending formatting, is byte-identical to the checkpoint-start version. `usePreviewAccount`, `useFitAdaptReviewState`, the target helper, conversion helpers and chart helper are unchanged.

| Area/action | Existing destination or handler |
| --- | --- |
| Identity; Account | `/account` |
| Edit saved profile & goals; Training days & goals | `/profile/goal-setup` |
| FitAdapt insights & history | `/profile/fitadapt-insights` |
| Insights | `/profile/insights-progress` |
| Steps history | `/profile/steps-history` |
| Calendar | `/(modals)/full-calendar` |
| Body measurements; insufficient-evidence weight entry | `/(modals)/body-metrics` |
| Long-term progress | `/(modals)/long-term-progress` |
| Advanced metrics | `/profile/advanced-metrics` |
| Weekly check-in | `/(modals)/weekly-checkin` |
| Settings | `/(modals)/settings` |
| Theme picker | `/(modals)/theme-editor` |
| Diet choices | `/(modals)/diet-preferences` |
| Progress photos | `/(modals)/progress-photos` |
| Badges | `/(modals)/badges` |
| Friends | `/friends` |
| Apple Health & connections | `/profile/integrations` |
| Complete required inputs | `/fitadapt-setup` |
| Insufficient-evidence nutrition entry | `/(tabs)/nutrition` |
| Review / fresh review / retry status | Existing `review.run("evaluate" / "refresh")` |
| Accept / Decline | Existing `review.run("accept" / "decline")`, existing busy/profile guards |
| Hide/Show values | Existing local React state; masks targets/proposals/measurements and hides the trace |

Identity comes from the current account profile/auth identity. Current targets come from `account.plan.targets` resolved by the existing shared plan/target helpers, not from pending proposals. Steps and dated weight records remain account-scoped; the latest weight preserves kg/lb conversion. `measuredTrendPath` still requires sufficient measured history. Missing values remain unknown, and measured zero remains zero.

## Exact checkpoint files

Modified existing files (relative to `fitness-mobile/`):

- `app/(tabs)/profile.tsx`
- `tools/home-preview-runtime.cjs` — offline Profile renderer, mocked hook/actions/state, SVG Path support; no production service path.

Created:

- `components/profile/PremiumProfileUI.tsx`
- `tests/profileBrandPresentation.test.ts`
- `tools/render-profile-preview.cjs`
- `PREMIUM_PROFILE_IMPLEMENTATION.md`
- `review/branding-6b/index.html`
- `review/branding-6b/profile-{dark,light}-{goals,active,pending,active-pending,busy,unavailable,incomplete,insufficient,loading,empty,syncing,stale,hidden,large-text}.html` — 28 pages, every mode/scenario combination.
- `review/branding-6b/profile-dark-unavailable.png`
- `review/branding-6b/profile-light-goals.png`
- `review/branding-6b/profile-dark-active-pending.png`
- `review/branding-6b/profile-dark-large-text.png`
- `review/branding-6b/profile-light-large-text.png`

The pre-existing worktree was already dirty. Checkpoint-start SHA-256 comparison confirms only the two existing files above changed among audited application, service, hook, component, theme, tool, test, config, review and artwork files. Existing debug logs and all approved/source artwork remain unchanged.

## Visual review

Open `review/branding-6b/index.html` for all 28 actual-Profile-JSX previews. Default phone width is 430 px; large-text cases use 320 px and a simulated 1.8 font scale. PNGs are Chromium captures of the offline React Native Web renderer, not iPhone screenshots. Font metrics, safe insets, shadows, SVG accessibility and native image decoding still require device verification.

All preview account identities and plan targets are explicitly synthetic fixtures. Preview weight/step records are empty; no fake measurement series is drawn. Render tests separately use synthetic dated records to validate real-path versus insufficient-history behavior. Preview actions are inert and no Firebase account, subscription, device store or live FitAdapt endpoint is contacted.

## Validation

Commands run from `fitness-mobile/` unless noted:

| Check | Result |
| --- | --- |
| `pnpm typecheck` | Passed. |
| `pnpm test` | Passed: 144 tests, 0 failures, 0 skipped. |
| `TZ=America/Toronto node --import tsx --test tests/profileBrandPresentation.test.ts` | Passed: 7 focused tests. Covers resolved/accepted/mismatched/pending target states; explicit actions and guards; all routes; missing/zero/unit handling; measured-only paths; Hide/Show; status notes and large text in both modes. |
| `node tools/render-profile-preview.cjs` | Passed: all eight backgrounds decoded and hash-verified; S3/F3 hashes unchanged; 28 previews rendered. |
| `CI=1 EXPO_NO_DOTENV=1 pnpm exec expo export --platform all --max-workers 2 --output-dir /private/tmp/somata-6b-export` | Passed, including a final rerun after metric typography adjustment: one Android Hermes bundle (8.4 MB), one iOS Hermes bundle (8.2 MB), metadata and resolved assets. This is a bundle export, not a native build. |
| `git diff --check -- fitness-mobile` (repo root) | Passed. |
| `xcrun simctl list devices booted` | Unavailable in this environment: CoreSimulatorService connection invalid, connection refused; no native simulator verification claimed. |

Mocked presentation tests prove wiring/formatting, not live callable acceptance or device integration. No server behavior changed, and no cloud acceptance operation was run. Typecheck and the seven focused tests were rerun successfully after the final metric typography adjustment. React Native Web emitted existing shadow/pointerEvents deprecation warnings; the offline SVG adapter also warns about the native accessibility label in DOM output. Expo reported stale baseline-browser-mapping data and conflicting color-output environment flags; neither blocked exports. No dependencies were changed.

## iPhone review before approval

1. Start the app using your existing normal or synthetic-emulator configuration with `pnpm exec expo start --clear --lan` from `fitness-mobile/`. This checkpoint needs no new environment flag or native module. Keep whichever backend setup you already use; do not switch projects to review visuals.
2. Open Profile in Expo Go. Compare header, identity, 2×2 targets, F3 review, grouped progress and all three lower action groups against the reference. Verify scrolling to the final connection row above the tab bar.
3. Use the existing Theme picker to inspect dark and light modes; verify the choice survives the usual navigation and restart flow. Test increased iOS text size, a smaller phone, long identity text, and VoiceOver labels/focus.
4. Toggle Hide/Show: current and proposed targets, steps, weight and trace should follow the existing privacy behavior. Check genuine empty/missing records without illustrative charts; inspect real dated weight records only when available.
5. On synthetic emulator accounts, inspect accepted, pending, busy, insufficient-data and unavailable/retry states. Explicitly Accept/Decline only if intending to change that test account's state. Verify the existing current-target behavior and back navigation; do not use personal data merely to populate screenshots.
6. Tap every route listed above and return to Profile. Device touch, native shadows/image clipping, safe areas, screen-reader output and live review transitions are still manual checks.

Stop here for visual approval. No other tab or Profile subpage redesign is included.
