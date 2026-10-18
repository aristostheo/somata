# Scan → Meal Builder handoff repair

Implemented on `profile-redesign`, 14 October 2026. No deployment, production configuration/data operation, commit, push, merge or branch creation. Existing unrelated changes and debug logs preserved. **Not a TestFlight readiness approval.**

## Before and after

Before: Nutrition → Meal builder (`/(modals)/meal-builder`) → Photo pushed `/(modals)/scan-meal-v2`, a route re-export of `app/nutrition/scan-meal-v2.tsx`. Scan confirmation already returned with `router.back()` and wrote `@pending_meal_builder_additions_v1:${uid}` with `ownerUid`/`deliveryId`. The builder never read that key; its ingredients existed only in component state. There was no freshness or destination-session check, and a second builder transfer could overwrite the pending one. The existing Nutrition delivery reader intentionally handles different queues, so it could not solve this missing builder reader.

After:

1. Each mounted builder creates a session ID and passes it with `returnTo`, meal and date to Photo.
2. Scan confirmation writes an explicitly validated versioned envelope through the existing queue service. A synchronous confirmation lock prevents rapid duplicate taps; a successful screen remains locked until navigation removes it. Failed transfers retain the reviewed scan for retry.
3. Returning to the same builder triggers an account-bound focus reader. It checks the owner, auth-session generation, builder session, date, age, delivery ID and all food rows before applying anything.
4. Foods become editable ingredients via the existing `createMealBuilderItem`. Quantities and macros are already portion totals: they are not multiplied again. Sodium remains milligrams. Missing optional nutrients stay absent; actual zero stays zero. Same-name foods remain separate so different scan estimates are not merged using an unrelated food's nutrition ratios.
5. The confirmed transfer is acknowledged by removing only the same stored value. Repeated focus/replayed delivery IDs do not add duplicate rows. The user still explicitly taps **Log meal** to use the existing final Meal Builder → Nutrition logging flow; importing a scan does not save a meal to Firestore.

Both scan implementations support this envelope. Add Meal/Quick Add compatibility return paths carry the builder session, and Add Meal forwards it into its nested Photo route. The current builder opens Photo directly. A legacy/deep link with `returnTo=meal-builder` but no live builder session is rejected, rather than delivered to an arbitrary meal. A nested compatibility route retains its existing back stack; the builder consumes when it regains focus.

## Storage, validation and cleanup

- Same audited UID key: `@pending_meal_builder_additions_v1:${uid}`. No global read fallback, new account identity source, server write or stored goal change.
- Envelope: `version: 1`, `ownerUid`, `deliveryId`, `createdAt` (milliseconds), `builderSessionId`, ISO `date`, `meal`, `items`.
- Expiry: 30 minutes after confirmation; timestamps more than 30 seconds in the future are rejected. Old unstamped envelopes are not replayed.
- Maximum serialized length: 128 Ki characters; 1–100 items. Names/units/IDs are bounded. Quantity must be finite and positive; calories/protein/carbs/fat must be finite nonnegative numbers. Optional nutrients are validated only when supplied. Unexpected fields are not copied into the builder. All rows validate before any row is applied.
- Pending transfers are not overwritten. Producers and consumers serialize access per UID.
- Missing payload: no message or state change. Invalid, expired or different-session/date owned transfer: remove that transfer and show a rescan notice. Storage failure: actionable retry notice. A per-mounted-builder receipt prevents retry from restoring even an imported row the user subsequently edited/deleted.
- Explicit wrong/unknown owner: do not display, reassign or delete the contents; show an unavailable state. Such a corrupt/conflicting envelope remains isolated and can block a new transfer at that exact key; no guessed owner recovery or blanket storage reset is implemented. Normal writers cannot produce it.
- Account change is checked before/after asynchronous storage reads and before application/navigation. Existing AuthProvider remounts all account screens on sign-out/account switch, discarding the old builder's in-memory ingredients. A→B→A invalidates old callbacks too.
- Existing deletion already selects this exact UID queue. The new raw UID-key driver joins the existing account-local write fence so deletion drains in-flight handoff writes before removing the account's keys, and rejects late writes. Other accounts and ambiguous global legacy keys remain untouched.
- Legacy migration is unchanged. An attributable legacy transfer can be moved only for its recorded owner; missing timestamp/session then prevents import and the reader clears that obsolete transfer. Ambiguous global data stays quarantined.

Builder drafts are still in-memory. This checkpoint does not add draft persistence across process termination, logout, or builder remount. A transfer for an abandoned session is intentionally not resurrected into a different builder. UID/session checks protect app-level cross-account access; they do not encrypt device storage against a compromised device.

## Files

- New `fitness-mobile/services/mealBuilderHandoff.ts`: pure validated queue/consumer and ID-based append helper.
- `fitness-mobile/services/queueNutritionHandoff.ts`: dispatch builder additions to that adapter; regular Nutrition queue protocol unchanged.
- `fitness-mobile/services/local/accountStoreCore.ts`, `accountStore.ts`: guarded driver for existing UID-suffixed keys using the existing deletion write fence.
- `fitness-mobile/app/(modals)/meal-builder.tsx`: session-bound focus import, notice/retry and route parameter.
- `fitness-mobile/app/nutrition/scan-meal-v2.tsx`, `scan-meal.tsx`: session envelope, confirmation lock, account check before returning.
- `fitness-mobile/app/(modals)/add-meal.tsx`, `quick-add.tsx`: compatibility session propagation and return ownership check.
- New `fitness-mobile/tests/mealBuilderHandoff.test.ts`; this report and `LOCAL_ACCOUNT_ISOLATION.md` follow-up references.

## Verification

From repository root:

```sh
npm run typecheck --prefix fitness-mobile
npm test --prefix fitness-mobile
git diff --check
```

All PASS. Mobile suite: **99 tests passed, 0 failed** (84 existing + 15 new handoff tests).

Focused command, from `fitness-mobile`:

```sh
TZ=America/Toronto node --import tsx --test tests/mealBuilderHandoff.test.ts
```

**15 passed, 0 failed**. Covers successful import, preserved totals/units/zeros/missing nutrients, existing ingredients, malformed/partial/oversized input, expiry/future/unstamped payloads, destination mismatch, duplicate confirmation/focus/replay, failed apply/write/acknowledgment retry, sign-out, A→B→A, switch/blur during reads, switch during cleanup, wrong-owner/global isolation, replacement preservation, legacy migration, and account deletion write-draining/key selection.

Tests exercise the production adapter with synthetic in-memory storage and captured account sessions; they do not call Firebase, FitAdapt or an AI provider. No server/rules changes, so their suites were not needed. Native exports were not rerun for this focused checkpoint. `xcrun simctl list devices booted` failed because CoreSimulatorService was unavailable in this session; no simulator/device pass is claimed.

## Phone checks still required

Use the existing Expo/native test setup, preferably two synthetic accounts against the existing emulators. The local adapter itself does not require an emulator; real scanning still uses the app's existing authenticated AI endpoint. Never test destructive account deletion on a personal account.

1. Sign into A. Nutrition → **Meal builder** → add one manual food → **Photo**. Capture/select a meal, run the existing scan, and review/edit the food names, portions and macros. Tap **Add to meal** once. Expect the original food plus every scanned row, matching reviewed totals and selected meal category/date.
2. Tap confirmation rapidly: only one transfer. Back out of Photo without confirming: original builder ingredients remain unchanged. Scan again: the new distinct scan appends once.
3. Edit quantities, reorder/remove imported rows, navigate away/back, and verify no duplicates or restored deleted rows. Explicitly **Log meal**, then verify Nutrition receives one meal with the expected ingredients/totals. Import alone must not create a Nutrition log.
4. Start/review a scan, then sign out or switch accounts. B must never see A's ingredients or queued scan. Return to A and open a fresh builder: do not resurrect the abandoned session. Repeat while a scan/storage operation is delayed if using a development test harness.
5. On a disposable development installation, inject expired/malformed envelopes into A's exact queue to verify the rescan notice; simulate storage acknowledgment failure to verify **Retry scan transfer** never adds a second copy. These failure cases are already unit-tested; do not manually alter personal records.
6. Check both iOS and Android camera/library permissions, cancellation, large text, notice/retry controls and modal back navigation. No photo capture, OS permission, live AI generation or physical-device navigation success is claimed by automated tests.
