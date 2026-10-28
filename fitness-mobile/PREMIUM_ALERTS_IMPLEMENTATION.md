# Premium Alerts — Branding Checkpoint 7

Implemented on `profile-redesign`, preserving unrelated working changes. This checkpoint changes the Alerts presentation and exposes an existing client fetch failure to that presentation. No backend service, Firestore rule, authentication flow, notification generation, scheduling, permissions, FitAdapt behavior, other tab, or approved artwork was changed. No commit, push, merge, or deployment was performed.

## Audit: actual functionality and data

- Screen: `app/(tabs)/notifications.tsx`. The comparison route `app/design-preview/notifications.tsx` already redirects here and remains unchanged.
- Inbox: authenticated `users/{uid}/notifications`, descending `createdAt`, latest **120** records. Header unread count is computed from that loaded window; category count is the matching subset. Neither is an invented total.
- Actual stored fields: `id`, `type`, `title`, optional `body`, `data`, `readAt`, `createdAt`, `createdAtMs`. No authorized avatar/photo field is defined by this interface; no additional friend-profile read was added.
- Existing categories are **All, Friends, Workouts, Nutrition, Streaks, Coach**. Coach was absent from the concepts but is retained. Classification remains the original ordered type/text heuristic: friends/pings, streak, workout/PR, nutrition keywords, coach/recovery/summary, then All.
- Original destination precedence remains unchanged, including sync/reconnect → integrations, weekly summary → insights, and meal-streak text → Nutrition before the category fallback. Consequently, a friend ping about a meal streak can open Nutrition. No routing correction/migration is included here.
- Opening an unread item marks that owner/id as read, then follows the original route. The original behavior of navigating even if marking read fails is preserved.
- Dismiss remains available on **every item**, with Cancel/confirmation and the original failure alert. Ping back remains limited to `type === "ping"` with a string `data.fromUid`, using the original friend and safe notification services.
- Mark all remains **account-wide**, including when a filter is selected: up to **400** unread documents per invocation, as in the existing service. It is hidden when the loaded window has no unread items and disabled during work.
- Bottom-tab unread badge uses its separate existing `subscribeUnreadCount` stream, bounded at **200**. The tab file, unread semantics, order and routes remain unchanged.
- Native scheduled reminders, PR/badge/goal-hit notifications and the Firestore inbox are distinct paths. Some local OS notifications are not persisted inbox entries. This checkpoint does not copy local notifications into Firestore or infer inbox events from workouts/nutrition records.
- Client fetch errors previously logged a warning and returned `[]`, making them indistinguishable from a genuinely empty inbox. The optional `onError` observer now lets Alerts present an explicit failure/retry state. Existing callers still receive `[]`; the query, normalization and write operations are unchanged.

## Visual implementation and reference comparison

| Area | Implemented treatment | Difference/constraint |
| --- | --- | --- |
| Header | Orange spaced eyebrow, 40-point title, real unread status, compact Mark all; category title follows selection | No blue settings gear added. Existing Alerts had none; existing Settings navigation remains elsewhere. Header stacks at smaller width/larger text. |
| Hero | Elevated charcoal surface, warm edges, bell/category icon, prominent action, restrained native wave lines | Static native SVG curves and gradients approximate the atmosphere, not the reference's exact raster mesh. No logos redrawn or unrelated imagery introduced. |
| Filters | Orange gradient selected pill, quieter charcoal inactive pills, category icons, 48-point touch targets | Six filters including Coach. Horizontal scrolling keeps selection visible; they are not compressed into one narrow row. |
| Inbox cards | Large readable titles, body, real date/category, native icon tile, unread dot/chevron, warm unread edges | Read cards use quieter surfaces/borders/icons. No expensive per-item blur, animation or glow. Dismiss remains on all cards, making real cards taller than some concepts. |
| Friends | Friend icon, real stored title/body, Ping back only where supported | No invented avatars, photo previews, Reply, Share or unsupported reactions/actions. |
| Workouts | Training signals hero and workout category icon | No new PR detection, recap calculations, coaching or session reminders. |
| Nutrition | Fuel signals hero and nutrition icon | No inferred remaining calories/protein, hydration amount, meal suggestions or Add water action. |
| Streaks | Momentum center hero, flame icon, stored milestone text | No new streak computation, rewards, Share or View streaks route. Hero opens existing Home. |
| Empty/error/loading | Native spinner; distinct empty category, clear inbox, signed-out and recoverable fetch error panels | No fabricated sample notifications in the application. Error retry only reattaches the original query. |
| Bottom navigation | Existing five-tab implementation and unread badge | Unchanged; offline preview tab adapter does not simulate a live badge. |
| Light mode | Bone canvas, white/peach surfaces, darker orange links, semantic text contrast | Keeps theme choice/persistence; no global palette change. |

All titles, bodies, values, dates, icons and controls are native UI. Only decorative curves are SVG paths, hidden from accessibility and pointer events. There are no new image assets or dependencies. Existing semantic tokens and premium Home surface recipes are reused.

Hero destinations are existing app destinations only:

- All / Friends → **Open friends**, `/friends`.
- Workouts → **Open workouts**, `/(tabs)/workouts`.
- Nutrition → **Open nutrition**, `/(tabs)/nutrition`.
- Streaks → **Open Home**, `/(tabs)`.
- Coach → **Open insights**, `/profile/insights-progress`.

## State, accessibility and performance

A single category-driven screen uses `FlatList` instead of rendering all records inside a vertical ScrollView: 8 initial rows, 6 per batch, window size 7, stable notification IDs. The existing maximum 120-record subscription is unchanged. No new pagination or data fetch behavior was added.

The signed-in UID keys the inner screen so prior-account inbox state cannot remain in a new account's render. Subscription cleanup detaches the listener and ignores any late callback. Retry repeats the same owner query. No ownership is inferred from notification text.

Controls have minimum 48-point touch height; text is not truncated or capped. Large-text layouts stack icon/body and header/actions. Read/unread is conveyed through text hints and weight as well as color. Category tabs retain selected accessibility state. Decorative effects are static, so there is no motion to disable; selected-filter scrolling is nonanimated. Native VoiceOver, focus behavior, safe areas, scrolling performance and touch behavior still need physical-device review.

## Exact files changed

Modified existing files, relative to `fitness-mobile/`:

1. `app/(tabs)/notifications.tsx` — new presentation composition, virtualized list, UID-keyed state, error/retry presentation. The classification, dates, item destinations and open/dismiss/ping/mark-all handler blocks are byte-identical to the checkpoint-start copy.
2. `services/notifications.ts` — optional client-only `onError?: () => void` observer on `subscribeNotifications`; invoked after the existing error fallback. No backend or write-path modification.
3. `tools/home-preview-runtime.cjs` — offline Alerts state/service/FlatList adapters for tests and previews; production code does not use these adapters.

Created:

- `components/alerts/PremiumAlertsUI.tsx`
- `tests/alertsBrandPresentation.test.ts`
- `tests/alertsSubscription.test.ts`
- `tools/render-alerts-preview.cjs`
- `PREMIUM_ALERTS_IMPLEMENTATION.md`
- `review/branding-7/index.html`
- `review/branding-7/alerts-{dark,light}-{all,friends,workouts,nutrition,streaks,coach,empty,category-empty,loading,error,read,busy,large-text,long-text,signed-out}.html` — exactly 30 mode/state combinations.
- `review/branding-7/alerts-{dark,light}-{all,friends,workouts,nutrition,streaks,large-text,error}.png` — exactly 14 mode/state captures.

Checkpoint-start SHA-256 comparison identifies only the three existing files above as changed in the audited app/component/service/hook/theme/config/tool/test/review/asset trees. Original and approved branding files, prior previews, other tabs and existing debug logs are preserved byte-for-byte.

## Validation

Commands from `fitness-mobile/` unless noted:

| Command | Result |
| --- | --- |
| `pnpm typecheck` | Passed. |
| `pnpm test` | Passed: **156 tests, 0 failures, 0 skipped**. |
| `TZ=America/Toronto node --import tsx --test tests/alertsBrandPresentation.test.ts tests/alertsSubscription.test.ts` | Passed: **12 tests** covering all six filters, exact existing routes, owner/record write arguments, read/unread, Mark all scope/busy/failure, dismiss confirmation/failure, ping eligibility/ownership/failure, subscription error/retry/cleanup, signed-out guards, large inbox/long text, existing hero routes and SDK subscription/write boundaries. Final rerun also verifies UID remount keys and existing local-ping deduplication. |
| `node tools/render-alerts-preview.cjs` | Passed: 30 actual-screen JSX previews; Ionicons font resolved. Native SVG/gradient dependencies resolved during typecheck/export. |
| `CI=1 EXPO_NO_DOTENV=1 pnpm exec expo export --platform all --max-workers 2 --output-dir /private/tmp/somata-7-export` | Passed: Android Hermes bundle (8.4 MB), iOS Hermes bundle (8.2 MB), metadata and resolved assets. This is not a native build. |
| `git diff --check -- fitness-mobile` (repository root) | Passed. |

The tests use inert SDK/service doubles and synthetic records; they do not contact Firebase, alter account records, schedule push delivery or prove live permission behavior. The subscription tests execute the real client service with mocked Firestore operations. Browser previews render all rows intentionally; native virtualization performance is not inferred from them.

Non-blocking warnings: existing React Native Web shadow/pointerEvents deprecations; the offline SVG adapter's native `accessible` prop warning; Expo baseline-browser-mapping age and NO_COLOR/FORCE_COLOR notices. No dependency or unrelated warning fixes were made.

## Preview and device review

Open `review/branding-7/index.html` for dark/light All, Friends, Workouts, Nutrition, Streaks, Coach and nine additional states. PNG files are headless Chromium captures at 430-pixel width, or 320 pixels with simulated 1.8 font scale for large text. They are **not native iPhone screenshots**. Preview account events are explicitly synthetic and actions are inert. The preview adapter scrolls the selected category into view because server rendering does not run native layout effects.

Start the app with the existing backend configuration:

```sh
cd /Users/aristos/Documents/fitness-app/fitness-mobile
pnpm exec expo start --clear --lan
```

No new environment variable or native module is required. Use the same Expo Go setup already working for the app. Use synthetic emulator accounts for destructive action checks.

1. Open Alerts; inspect the All view in dark and light modes. Confirm header status and tab badge follow their actual respective streams.
2. Select all six filters, including Coach. Swipe the filter strip on a narrow phone; confirm the selected pill remains visible. Validate counts against the loaded records, not an assumed global total.
3. Open read and unread alerts; confirm original destination and read status after returning. Test a meal-streak ping to confirm its preserved Nutrition destination.
4. Select a category and tap Mark all; verify it still marks account-wide unread records rather than only the visible category. Confirm busy handling and error alert when a real operation fails.
5. Cancel Dismiss, then confirm Dismiss on a synthetic record. Verify only that owner's record disappears. Test eligible Ping back with a synthetic accepted friend.
6. Check loading, no alerts, no category results and failed fetch → Retry. If airplane mode uses cached Firestore data, it may not produce an error; do not mistake offline cache behavior for a successful error-state test.
7. Sign out/switch between synthetic accounts; confirm inbox contents and badges follow the new account. No old-account record should flash or remain interactive.
8. Increase iOS text size; use VoiceOver; test long notification messages, safe areas and scroll-to-bottom above the tab bar. Check a large real synthetic inbox for native scroll performance.
9. Push permission prompts, native delivery, hardware-back behavior and actual OS notification routing are unchanged and **not verified by browser/unit tests**. No device-only pass is claimed.

## Remaining fidelity/approval items

- The native light trails are deliberately restrained. Exact photographic/mesh texture would require separately approved dark/light Alerts ambient and hero-only background artwork without text, icons, metrics or controls. No additional artwork is required for the implemented UI to function.
- No blue gear, unverifiable friend photos, unsupported contextual actions, new streak tracker or notifications from inferred measurements were added.
- Real content and retained Dismiss controls produce varying card heights. Large text uses more scrolling than the concepts.
- Native-device visual verification remains outstanding. No simulator/native screenshot or live push verification is claimed.

Stop after this checkpoint for visual approval.
