# Checkpoint 12 — Social, Settings & Account

Presentation implementation is complete for the 21 assigned surfaces. TypeScript, the full mobile suite and both Expo platform exports passed. No production, staging or real-account verification is implied by this review.

## Open the review

- [Dark/light gallery](index.html): actual screen JSX with synthetic fixtures and inert service adapters.
- [Before/after comparisons](comparisons.html): the same fixtures against the pre-checkpoint source snapshot.
- [Exact surface and behavior inventory](COVERAGE.md).
- `manifest.json` lists all generated HTML files and their route/state/theme/width.
- Browser captures are not native iPhone screenshots. QR, time-picker and optional user-photo areas are labeled stand-ins. Native confirmations retain the system UI and are exercised through callback tests.

## All assigned surfaces

| ID | Disposition / presentation | Open from |
|---|---|---|
| S01 | Redesigned invitation hero, relationship filters/search and status-led cards | Profile → Friends; Alerts → Friends |
| O30 | Redesigned invitation form and separate own-code/QR area | Friends → Add someone / Add friend |
| O31 | Redesigned redacted activity desk, separate contact and safety controls | Friends → accepted friend |
| O32 | Redesigned selectable message grid with explicit Send | Friend → Send a nudge |
| O33 | Redesigned private-name editor with privacy explanation | Friend → Edit nickname |
| S02 | Redesigned shared progress tiles; both profile/progress wrappers retained | Friend → profile → Shared progress; existing profile deep link |
| S03 | Redesigned dated nutrition summaries, distinct private/missing values | Friend → meals; existing `/friends/[id]` deep link |
| S04 | Redesigned training records and existing validated template-copy controls | Friend → workouts → Open workouts |
| S05 | Redesigned owner-only redacted preview | Friend visibility → Preview my shared profile |
| S06 | Redesigned master privacy card and four grouped field desks | Account → Friend visibility |
| S07 | Redesigned warm collection hero, category counts and earned/locked cards | Home/Profile → Badges |
| O25 | Redesigned badge-detail sheet, earned date and criteria area | Badge → details |
| T02 | Redesigned connection-status hero, source groups and sync-preference desks | Settings/Profile → Health connections |
| O34 | Redesigned provider-status detail sheet, actual controls retained | Connections → Source details |
| T04 | Redesigned appearance entry, reminder groups, accessibility and health groups | Profile/tab settings action → Settings |
| O24 | Redesigned iOS time-draft sheet; Android system dialog verification only | Settings → Change reminder time |
| T05 | Redesigned mode panel, palette preview/library, custom fields and readability desk | Settings → Choose your theme |
| T06 | Redesigned identity card, security desk, sharing and account actions | Profile → identity/Account |
| T08 | Redesigned separate privacy-policy and support destination cards | Account → Privacy & support |
| T09 | Redesigned current-entitlement desk and accurate purchase availability | Existing paywall/subscription route |
| T07 | Redesigned destructive warning, cleanup explanation, numbered verification/confirmation | Account → Delete account |

`PremiumSegmented` has only a type import from the live Friends page. Its rendered implementation is dormant and was not revived. Native Alert confirmations, provider permission dialogs and Android time picker remain system-owned.

## Design and behavior

The family opts into existing `SomataTaskAppearance`, TaskUI and FlowUI. `components/accountSettings/PremiumUI.tsx` supplies small compositions over those primitives: icon-led intro, grouped desk, privacy/status note, and responsive columns. It creates no theme, provider state, service or stored preference. All typography scales; paired content stacks at narrow width or larger text. New cards use the existing semantic light/dark colors and bounded premium gradients. Destructive actions retain error-colored text and final native confirmation, distinct from ordinary orange primary actions.

- Friends: no new social capabilities or fabricated people. Existing email/UID lookup, nickname, QR, received/sent requests, six-hour ping cooldown, remove/block/report handlers are preserved.
- Sharing: only `useFriendSummary`/the trusted existing service supplies data. `Private`, unavailable and null records stay distinct from zero. Consent confirmation remains per friend. Template copy still refetches and validates the shared workout before writing to the owner’s library.
- Privacy: exact existing field allowlist and defaults preserved. Immediate switches stay immediate; directional weight sharing still asks for confirmation. The existing per-field “Preview” actions remain informational native dialogs.
- Badges: actual registry, local unlocks, category earned counts, criteria and featured state. No new unlock calculations. The collection controller does not expose validated per-badge numeric progress, so no invented percentage bars were added.
- Connections: actual sources, source priorities, existing permission/sync callbacks and history route preserved. Unsupported sources remain disabled; native provider failure stays visible. No promise that Expo Go can sync Apple Health.
- Settings: notification switches save immediately; iOS reminder time remains a Save/Cancel draft. Android retains its native commit/dismiss behavior. Unit editing and system accessibility information stay unchanged.
- Theme: separate light/dark palettes, all presets/custom hex values, contrast feedback, reset, draft Save/Cancel and commit-failure retry stay intact. The SDK 58 dismissal guard still prevents leaving during a commit. Fixed Somata branding and legacy customizable surfaces coexist; the screen now explains this. A broader personalization policy remains a product decision, not an implicit migration.
- Account: existing identity is read-only; provider-aware verification/recovery only. No identity editor was invented. Sign-out and deletion keep their confirmations.
- Deletion: recent reauthentication, exact `DELETE`, final dialog, UID-change checks, server-cleanup-before-local/signout, partial failure and retention holds preserved. No deletion was executed against an account.
- Legal/access: no legal wording or real URLs added; synthetic configured examples use `example.invalid` only in offline tools. Missing destinations remain unavailable. Checkout stays behind its existing release gate; no backend or entitlement changes.

## Exact source files changed

Paths relative to `fitness-mobile/`:

- `app/friends.tsx`
- `app/friends/[id].tsx`
- `app/friends/[id]/profile.tsx`
- `app/friends/[id]/progress.tsx`
- `app/friends/[id]/workouts.tsx`
- `app/friends/preview.tsx`
- `app/profile/friend-visibility.tsx`
- `app/profile/integrations.tsx`
- `app/(modals)/badges.tsx`
- `app/(modals)/settings.tsx`
- `app/(modals)/theme-editor.tsx`
- `app/account/index.tsx`
- `app/account/delete.tsx`
- `app/account/legal.tsx`
- `app/paywall.tsx`
- `components/friends/SharedSummary.tsx`
- `components/friends/premium/FriendsAddSheet.tsx`
- `components/homeFlows/BadgeCollection.tsx`
- `components/somata/ConnectionsDesk.tsx`
- `tools/home-preview-runtime.cjs` — opt-in social adapter; immutable compiled-code cache only, with fresh runtime/fixture/account state per case.
- `tests/sdk58ThemeNavigation.test.ts` — inert mocks for the new presentation imports; assertions unchanged.

New:

- `components/accountSettings/PremiumUI.tsx`
- `tools/social-flow-runtime.cjs`
- `tools/render-social-family-preview.cjs`
- `tools/verify-social-family-preservation.cjs`
- `tools/capture-social-family-preview.cjs`
- `tests/socialFamilyPresentation.test.ts`
- `review/branding-12/` — this report, coverage, gallery/comparisons, manifest and validation artifacts.

Shared TaskUI, FlowUI, ThemeProvider, premium token recipes and the approved five tabs themselves were not changed.

## Validation

All commands ran from `fitness-mobile/` with Node **22.23.4** on PATH (the Mac’s default Node 25 is outside Expo 58’s supported runtime).

| Command / check | Result |
|---|---|
| `pnpm typecheck` | PASS, exit 0; rerun after final avatar contrast correction |
| `TZ=America/Toronto pnpm exec node --import tsx --test --test-concurrency=2 tests/*.test.ts` | PASS: **232 tests**, 0 failed/skipped |
| `TZ=America/Toronto node --import tsx --test --test-concurrency=1 tests/socialFamilyPresentation.test.ts tests/sdk58ThemeNavigation.test.ts` | PASS: **18 tests**, 0 failed; final focused rerun |
| `TZ=America/Toronto node --import tsx --test tests/sdk58ThemeNavigation.test.ts tests/friendSummary.test.ts tests/friendVisibility.test.ts tests/socialAvailability.test.ts tests/accountDeletion.test.ts tests/themePicker.test.ts` | PASS: **19 tests**, including existing privacy, deletion and theme behavior |
| `CI=1 pnpm exec expo export --platform ios --platform android --max-workers 2 --output-dir /tmp/somata-12-export-final` | PASS: both Hermes bundles and asset metadata generated; final run includes the contrast correction |
| `node tools/render-social-family-preview.cjs --before-root /tmp/somata-checkpoint12-before` | **294 HTML previews**, 63 states; 126 before, 168 after, covering all 21 IDs |
| `node tools/capture-social-family-preview.cjs` | PASS: **168 PNG captures**, no horizontal document/content overflow and no truncated captures; see `browser-checks.json` |
| `node tools/verify-social-family-preservation.cjs /tmp/somata-checkpoint12-baseline.json` | PASS: no unexpected changes or missing baseline files |
| `git diff --check` on the touched tracked source files | PASS |
| `xcrun simctl list devices booted` | iOS 26 runtime listed, **no booted simulator**. No native visual/device check performed. |

The full suite used the same test files as `pnpm test`, with concurrency limited to two. Initial high-concurrency test/export jobs were interrupted because of severe local memory pressure; they are not counted as successful runs. The final commands above completed successfully. Existing baseline-browser-mapping age, renderer deprecation/React Native Web attribute and terminal color warnings were not suppressed or addressed by unrelated dependency changes.

The added 15 screen-level tests execute the real JSX/controllers with inert synthetic services: all 21 IDs in dark/light at 320 px and 1.8× text, requests/search, nickname failure, ping selection, remove/block/report confirmations, redaction/null/zero, consent and account switching, safe template refetch, immediate privacy saves, badge feature ownership, reminder draft/cancel/commit, connection scopes, provider-dependent account actions, unavailable legal/checkout, and deletion ordering/partial retry. These mocks do **not** establish live backend authorization, successful native permissions, notification delivery or real account deletion.

For the visual gallery:

```sh
cd /Users/aristos/Documents/fitness-app
open fitness-mobile/review/branding-12/index.html
```

For Expo Go, preserve your existing local emulator configuration when testing synthetic account actions:

```sh
cd /Users/aristos/Documents/fitness-app/fitness-mobile
npm exec --yes --package=node@22.23.4 -- pnpm exec expo start --go --lan --clear
```

No emulator/production flags were changed by this checkpoint. Keep the existing emulators running for synthetic sharing/deletion tests; this command only starts Expo. The complete device checklist below lists the destinations to review.

The 2,373-file baseline checksum audit found only the 21 explicitly allowed existing files changed. All other baseline files, including source/processed artwork, services, rules, Expo config, previous galleries, five tabs and debug logs are byte-identical. A source AST comparison confirmed 299 non-JSX controller functions/callbacks unchanged (badge presentation helpers intentionally excluded).

## Device and backend verification still required

Use a synthetic emulator account for sharing changes, requests and deletion. Do not exercise destructive flows on a personal account.

1. Launch Expo Go with your existing **emulator configuration** and open Profile → Friends. Verify search, received/sent requests, add/QR/copy, nickname keyboard, ping, all detail views and Back/dismiss. Repeat with large system text and light mode.
2. With two synthetic friends, check field-level consent and per-person approval, private and nonfriend states, and safe template copy. Confirm denied/private state after revoking consent. These require backend/emulator verification beyond the offline presentation tests.
3. Check badges at light/dark and large text, criteria, featured toggle and sheet dismissal. No synthetic awards are added by the app.
4. Settings: test permission denied/granted, reminder switches, time Save/Cancel, units and persistence after restarting. Check Android’s system time dialog separately.
5. Connections: verify Expo Go’s unavailable-module state. Native permissions, provider sync, source priority and background operation require a configured development build/device. Follow Sync history; that previously completed screen is unchanged.
6. Theme: edit both palettes, cancel and reopen; save a custom palette, restart; check System mode and commit failure/retry. Review the fixed-brand/custom-palette coexistence.
7. Account: verify identity, password-provider recovery/verification and sign-out. Missing privacy/support destinations must remain unavailable. Checkout must remain unavailable in the current release configuration.
8. **Synthetic account only:** deletion reauthentication, invalid confirmation, final Cancel, retention hold, partial failure/retry and local cleanup/account switching. Actual server cleanup, provider revocation and retention-policy decisions are not proven by mocked screen tests.

Existing limitations carried forward: not all sharing categories have verified summaries; QR/native media and native system dialogs cannot be validated by browser stand-ins; some relationship/integration failure handlers have limited in-app feedback; no new retry/error semantics were added. Retention decisions, published privacy/support URLs, cloud deployment and other TestFlight gates remain unresolved outside this visual checkpoint.

No commit, push, merge, deployment, cloud configuration, production data changes or artwork edits. Stop here for visual review.
