# Checkpoint 12 coverage and behavior contract

All fixtures are synthetic. The initial source snapshot is `/tmp/somata-checkpoint12-before`; file hashes are `/tmp/somata-checkpoint12-baseline.json`. No service, rule, tab, artwork or persisted-state changes are authorized.

| ID | Live source (relative to fitness-mobile) | Actions / states to preserve |
|---|---|---|
| S01 | app/friends.tsx | Friends/received/sent, search, UID copy, subscriptions, loading/empty/error, accepted/pending |
| O30 | components/friends/premium/FriendsAddSheet.tsx | Email/UID validation, nickname, send/busy, own QR/copy, dismiss |
| O31 | app/friends.tsx + SharedSummary | Overview/profile/meals/workouts, consent confirmation, remove/block/report, navigation |
| O32 | app/friends.tsx | Preset/blank ping, cooldown, send/dismiss |
| O33 | app/friends.tsx | Private nickname draft, save/error retention/dismiss |
| S02 | app/friends/[id]/progress.tsx and profile.tsx | Both wrappers, redacted progress, private/nonfriend/error |
| S03 | app/friends/[id].tsx | Permitted meals/date selection/refresh, no raw document fallback |
| S04 | app/friends/[id]/workouts.tsx | Permitted workouts, refetch and validate before template copy |
| S05 | app/friends/preview.tsx | Owner preview; no per-friend consent operation |
| S06 | app/profile/friend-visibility.tsx | Exact existing fields, immediate save, weight confirmation, reset, preview |
| S07 | app/(modals)/badges.tsx + BadgeCollection | Actual registry/unlocks, categories, featured selection, loading/locked/earned |
| O25 | components/homeFlows/BadgeCollection.tsx | Detail criteria/date/feature/dismiss; native Modal/reduced motion |
| T02 | app/profile/integrations.tsx + ConnectionsDesk | Sources, permissions, sync, preferences, priorities, history; unavailable provider |
| O34 | components/somata/ConnectionsDesk.tsx | Provider fields, status, sync override, primary source, RingConn guide |
| T04 | app/(modals)/settings.tsx | Immediate reminders/units, permissions, accessibility, appearance/health routes |
| O24 | app/(modals)/settings.tsx | iOS time draft Save/Cancel; Android native time dialog verification only |
| T05 | app/(modals)/theme-editor.tsx | Mode, independent palettes, presets/custom hex, contrast, reset, draft commit/cancel/retry |
| T06 | app/account/index.tsx | Read-only identity, provider-aware verify/recovery, sign-out confirmation, privacy/deletion |
| T08 | app/account/legal.tsx | Only configured destinations; missing values unavailable; browser failure |
| T09 | app/paywall.tsx | Actual access, existing tool list, refresh; gated checkout remains gated |
| T07 | app/account/delete.tsx | Reauth, exact DELETE, final confirmation, UID lock, cleanup/failure/retry/retention holds |

PremiumSegmented is imported only as a type by Friends; its old rendered implementation is dormant. Do not revive or restyle it. Native Alert confirmations and Android time/permission dialogs retain system presentation. Existing Sync history (T03, Checkpoint 8B) stays unchanged.
