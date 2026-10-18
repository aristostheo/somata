# In-app release safeguards — 17 October 2026

Later staging preparation: [STAGING_BACKEND_ROLLOUT.md](STAGING_BACKEND_ROLLOUT.md) adds a separate guarded staging deployment config and makes the TestFlight profile require actual staging Firebase configuration as well as these URLs. Its checkout flag remains explicitly off. The retained production profile/configuration is unchanged. No cloud operation was performed; deletion/retention decisions below remain unresolved.

Local work on `profile-redesign`. **Not TestFlight readiness approval.** No commit, push, merge, branch creation, deployment, production data operation, or remote configuration/secret change. Existing working changes were preserved. The local TestFlight build profile now explicitly disables checkout and enables required-link validation; the production EAS profile, Firebase configuration, rules, and storage permissions were not edited.

Read alongside `TESTFLIGHT_READINESS.md`, `ACCOUNT_DELETION.md`, `LOCAL_ACCOUNT_ISOLATION.md`, `MEAL_BUILDER_HANDOFF.md`, and the latest safe-summary section of `FIRESTORE_SHARING_SECURITY.md`.

## Deletion audit: data, ownership, and current treatment

This is an implementation and repository audit, not an inspection of production user records or cloud retention settings. **Actual production counts, bucket objects/versions, backup schedules, log contents and provider-retention settings remain unverified.** “Exists” below means a defined writer/schema or retention mechanism exists in current code; it does not claim a particular production record exists.

| Category and evidence | Ownership and current deletion behavior | Remaining gap / decision |
|---|---|---|
| **Known UID-owned records**: `users`, `profiles`, FitAdapt roots, account-scoped AI/cache/quota records, outgoing/incoming sharing grants, references and current-device records listed in `ACCOUNT_DELETION.md` | Existing Admin cleanup recursively deletes exact UID roots and handles verified foreign references before deleting Auth. Current-device deletion drains tracked writes and clears exact UID namespaces/files. Existing cleanup already covers these; no new destructive behavior was needed. | Deploy/test the complete guarded backend separately. Other installations and ambiguous pre-isolation local records are not remotely erased. |
| **Unknown Storage files**: `auditStorageBucket` scans the default bucket in 100-file pages. Current clients have no supported cloud personal-file upload. Known shared assets are `public/exercises.seed.json` and `exercises/{id}/demo.gif`. | Known shared assets without owner-like metadata remain. Any other object, or even a known asset with owner-like metadata, causes `storage_review_required`. A name, photo URL or metadata field alone is not adopted as proof of ownership. The flow never deletes unknown objects. A single unknown object can block deletion for every account. | Inventory all buckets, versions/soft-deleted objects and upload sources. Identify which records have trustworthy ownership and authorize their treatment. Current audit covers only live objects in the default bucket. Candidate Storage rules are still not bound/deployed; remote write access needs the separately authorized review. |
| **Legacy AI caches**: still-exported `describe.ts` can write `aiMealIdeas/{derivedKey}` and `aiExerciseEstimates/{hash}` | Meal cache stores generated meals/rationale, a derived goal/notes-hash key and timestamp. Exercise cache includes lowercased input text, equation-sex and age/height/weight buckets, output and timestamp. Neither records a reliable UID. Any record in either collection blocks deletion globally with `retention_review_required`. A guessed match to the caller is forbidden. | Decide whether to retire the legacy writers and authorize a controlled purge, or establish verifiable provenance and a scoped replacement/retention policy. Clearing caches without retiring/reconciling their writers would allow the blocker to recur. The newer `generateSomataAI` persists owned usage counters, not prompts/images/results; those counters are already deleted by UID. |
| **Safety reports**: `reports/{id}` can contain `reporterUid`, `targetUid`, free-text reason and timestamp | Either participant's UID match pauses deletion; no reports are changed. The reporter and subject are different parties, so deleting the whole report as one person's property is not justified. Current hardened rules do not provide the legacy client report submission path with a working authorized backend. Old/admin-created records could still exist. | Specify who may access reports, retention duration, deletion/anonymization rules for each participant, and exceptions/holds. A separate supported reporting backend is still needed; rules were not broadened here. |
| **Backups and logs**: application/emulator diagnostic files, cloud/runtime logs, database exports/backups/PITR, Storage versions, provider-side logs/backups, device backups | Deletion has no backup/log purge API or UID-targeted backup traversal. Repository configuration does not establish their actual retention. Current AI boundary avoids logging personal requests/results; legacy exception logging and platform/provider logging are not proof of no personal data. Deleting live records does not establish deletion from these systems. | Inventory the enabled systems, set actual retention/access/expiry, and define restoration controls that prevent deleted data reappearing. No days/years are assumed. Existing logs were not erased. |
| **Shared contributions**: `foodCatalog` includes food name/unit/nutrients, derived ID/search tokens, timestamps, usage/verification and optional `submitterUid`; other owners' routines can include `fromFriendUid` | Existing deletion removes a matching `submitterUid` or `fromFriendUid`, preserving the food record or recipient's routine. Authored foreign comments/reactions and connection notifications/edges are deleted through existing ownership checks. Independently saved copies remain. Food IDs/content can be user-entered and catalog entries may be updated by multiple users, so attribution removal is **not proof of full anonymization**. | Confirm retention of shared catalog/recipient copies and handling of personal text that may remain in names/content/derived IDs. Do not erase another person's saved routine or shared food references by assumption. |
| **External authorization and health data**: Apple identity token → Firebase credential; Google ID-token flow; local health/integration connection records | Reauthentication proves identity but does not revoke provider authorization. Apple authorization codes are not exchanged/stored by an existing server revocation service; Google flow has no managed offline refresh-token revocation. Removing Firebase Auth/local connection state does not remove the Apple/Google account, provider grants, Apple Health data or Photos originals. | Choose the release-supported providers and supply the operator configuration for an implemented/tested revocation flow where required. Existing linked users still need a supported deletion path. Changing a local connected flag or hiding a sign-in button is not revocation. |
| **Deletion tombstones**: `accountDeletions/{uid}` | Server-only UID-keyed version/status/phase/start/completion timestamps, temporary cursor and lease. No profile/email/fitness payload. Existence is used by rules and trusted writers to reject late writes. Completed markers have no expiry/TTL; retries use them to acknowledge completion. | Decide retention and removal criteria based on token/job/backup-restore lifetimes. Keep the current fence until a tested replacement/removal design exists. Do not delete markers to unfreeze partially deleted accounts. No speculative TTL was added. |

No additional owned data store was found that could safely be deleted beyond the existing audited cleanup. No cleanup phase/order/schema or acceptance/target logic changed. Existing ambiguous-data holds remain before freezing an active account and are rechecked after freezing/on retries.

The only backend change is an additive, non-identifying error `details.reason`: `legacy_ai_cache` or `safety_report`, retaining `details.code = retention_review_required`. Mobile distinguishes those cases and retains a generic fallback for older servers/unknown reasons. No collection keys, report contents, counterpart UIDs, URLs or filenames are returned. Deletion UI now states that the technical deletion marker remains and that external authorization/backups/logs are not removed by this operation; it links to the operator-provided support destination. These are factual implementation limitations, not new legal policy text.

## Checkout: disabled unless explicitly configured

Current code still has no exported `createCheckoutSession` and no purchase/webhook/IAP lifecycle to deploy. No production endpoint was queried or assumed.

- `SOMATA_CHECKOUT_ENABLED` defaults to **false**. The local `eas.json` TestFlight profile explicitly sets it to `false`. A price ID alone does not enable checkout.
- The configuration is compiled into public `extra.release`. Old/missing/malformed manifests fail closed.
- Paywall retains its layout, access status, tools and refresh action, but hides **View checkout** when disabled. Direct navigation to `/paywall` cannot call the missing endpoint: the handler and service both enforce the flag. The page accurately says purchases are unavailable in this build.
- The meal-ideas entitlement prompt no longer offers **See Pro / Unlock** when purchases are disabled. Existing Pro/admin/tester claims remain unchanged; no free entitlement or beta-access policy was invented.
- The existing token-refresh action is labeled **Refresh access**, not **Restore**. It is not a purchase restoration implementation.
- Checkout implementation is preserved behind the flag. When enabled, it requires sign-in, accepts only the configured price ID, validates the returned HTTPS URL, aborts browser navigation after an account switch, locks duplicate taps, and has a 30-second callable timeout. It does not retry failures or update entitlements itself.

Before enabling:

1. Decide the beta access/payment model and validate the intended iOS/Android storefront approach; this checkpoint does not approve external Stripe checkout for a particular store/distribution policy. If native IAP is chosen, implement its separate purchase/restoration lifecycle rather than toggling this Stripe path.
2. Implement/test/deploy the authenticated `createCheckoutSession` callable in the existing Functions region (`us-central1`). Existing client contract: `{ priceId: string }` → `{ url: string }`; derive UID on the server, allowlist prices and enforce ownership. Keep payment keys/webhook secrets server-side. No client UID/customer identifier is supplied by this path.
3. Implement and verify trusted payment/entitlement updates, webhooks/idempotency, cancellation/refund handling, success/cancel return destinations and any restoration flow. Browser completion alone cannot grant Pro. Account deletion must handle the chosen subscription lifecycle; there is currently no cancellation integration.
4. Supply a real `EXPO_PUBLIC_STRIPE_PRICE_ID` and set `SOMATA_CHECKOUT_ENABLED=true` only in the reviewed build configuration. For TestFlight this means deliberately changing its explicit `false` override in `eas.json`; a remote value alone should not be assumed to override that profile. Provide approved price/terms information at the actual checkout. Validate both real destinations and the signed-device flow before distributing an enabled build.

The flag and price are public, not secrets or backend authorization controls. Config validation proves syntax/explicit opt-in, not that an endpoint or payment system exists.

## Required policy and support inputs

Supply these **two real, publicly reachable HTTPS URLs**, without login requirements:

| Build variable | Required destination |
|---|---|
| `SOMATA_PRIVACY_POLICY_URL` | Published privacy-policy page containing operator-approved wording for the actual data practices. No policy text was drafted here. |
| `SOMATA_SUPPORT_URL` | Working support/contact page with a real way for testers to contact the operator, including deletion holds. A bare mail address is not accepted as this URL; it may be shown on the operator's support page. |

There are no default/example URLs in shipped configuration. Values are read by `app.config.ts`, validated and embedded into `extra.release`; they are public configuration. Use the intended build environment when the actual URLs are available. No remote EAS/Firebase environment values were set in this checkpoint. No terms-of-service text/URL was invented; any future purchase terms are part of checkout enablement.

TestFlight and production profile config evaluation fails when either destination is absent/invalid. Explicit `SOMATA_RELEASE_BUILD=true` provides the same gate for local store checks or future release/update commands outside those profiles. The TestFlight profile sets it explicitly. Malformed booleans, unsafe schemes, URL credentials, literal IP/local/reserved/example hosts and obvious placeholders fail validation; the existing store-emulator prohibition remains. Parsing does not fetch URLs, prove operator ownership, check legal adequacy or test page uptime—operator/device verification is still required.

`/account/legal` is now a functional **Privacy & support** page, reached from Account, Delete account, Login and Register. Only that exact information route is allowed through the signed-out/setup navigation guard. Private account/deletion/fitness routes remain guarded. Development builds may omit URLs; they show honest unavailable states with no dead link buttons. Store builds cannot pass configuration with those omissions.

Local validation after supplying actual values through the build environment (no build/upload/deploy):

```sh
cd /Users/aristos/Documents/fitness-app/fitness-mobile
SOMATA_RELEASE_BUILD=true SOMATA_CHECKOUT_ENABLED=false EXPO_PUBLIC_USE_FIREBASE_EMULATORS=false npx expo config --type public
```

Until the URLs are supplied, that command is expected to fail with both variable names. Keep the release flag on for future store/OTA release validation; a development export is not a store configuration approval.

## Files changed

- `fitness-mobile/config/release.cjs`, `release.d.cts`, `lib/releaseConfig.ts`, `app.config.ts`, `eas.json`, `.env.example`: public build/runtime configuration and release gates.
- `fitness-mobile/services/checkout.ts`, `app/paywall.tsx`, `app/(modals)/ai-meal-suggestions.tsx`: guarded checkout, disabled entry action and accurate access refresh wording.
- `fitness-mobile/app/account/legal.tsx`, `account/index.tsx`, `(auth)/login.tsx`, `(auth)/register.tsx`, `app/_layout.tsx`, `lib/accountRouteAccess.ts`: working operator links and the narrow public information route.
- `fitness-mobile/app/account/delete.tsx`, `services/account/deletionData.ts`, `fitness-web/functions/src/account/deletion.ts`: factual deletion limits/support entry and safe category-specific hold messages.
- Mobile `tests/releaseConfig.test.ts`, `accountRouteAccess.test.ts`, `accountDeletion.test.ts`; Functions `test/account-deletion.test.js`: focused regressions.
- This report and follow-up links in `TESTFLIGHT_READINESS.md` / `ACCOUNT_DELETION.md`.

## Checks and limits

From repository root:

```sh
npm run typecheck --prefix fitness-mobile
npm test --prefix fitness-mobile
npm run build --prefix fitness-web/functions
cd fitness-web/functions
env -u FIRESTORE_EMULATOR_HOST node --test test/*.test.js
./node_modules/.bin/eslint src/account/*.ts
npm run lint
```

- Mobile typecheck: PASS.
- Mobile tests: **107 passed, 0 failed**. New tests cover build/link requirements and unsafe values, missing-manifest checkout denial, signed-out/disabled checkout making zero calls, exact price payload, success/failure/invalid response/account switch, no retries, the single public information route and private-route guards, and safe retention-reason messages.
- Functions build: PASS.
- Functions unit tests: **20 passed, 0 failed**. New tests exercise both legacy cache collections and both report UID directions, prove rejection before account freeze/deletion, and verify only the reason category is returned. Existing authentication/ownership/confirmation/Storage and AI/FitAdapt tests pass. These tests use synthetic fakes, not production data or a live provider.
- Account Functions lint: PASS. Full Functions lint remains **17 pre-existing errors / 91 warnings**, including the known `describe.ts` errors; nothing suppressed or repaired outside scope. Current predeploy hooks run install/build, not lint; this is still an unresolved quality gate.
- Actual Expo TestFlight config with URLs absent: **expected failure**, listing `SOMATA_PRIVACY_POLICY_URL` and `SOMATA_SUPPORT_URL`.
- Actual Expo TestFlight and production config probes with process-only synthetic HTTPS fixtures: PASS, checkout disabled and runtime manifest decoded correctly. Fixtures were not saved as app defaults, fetched, deployed or asserted to be real policy/support sites. The first probe exposed Expo's conversion of optional null values to empty objects; app config now omits absent optional values and the final probes pass.
- iOS and Android Expo exports: PASS, output under `/private/tmp/somata-release-blockers-export`. This validates bundle/module resolution, not a signed release or native device behavior. The exact command from `fitness-mobile` was:

  ```sh
  CI=1 EXPO_NO_DOTENV=1 EAS_BUILD_PROFILE=development SOMATA_RELEASE_BUILD=false SOMATA_CHECKOUT_ENABLED=false SOMATA_PRIVACY_POLICY_URL= SOMATA_SUPPORT_URL= EXPO_PUBLIC_USE_FIREBASE_EMULATORS=false npx expo export --platform all --max-workers 2 --output-dir /private/tmp/somata-release-blockers-export
  ```

  This intentionally checks the development missing-link/disabled-checkout state; the separate store configuration probes above verify that a release cannot omit the URLs. Existing baseline-browser-mapping age and terminal color warnings were reported by the exporter; no dependencies were changed.
- `git diff --check -- . ':!**/*.log'`: PASS. Full `git diff --check` also reports the pre-existing trailing blank line in `fitness-web/firestore-debug.log`; it was not edited.
- No emulator/rules suites were rerun: rules, deletion ownership, cleanup phases and persistence behavior are unchanged. Existing emulators were already running on 9099/8080/5001; they were not stopped or used to seed test data. Their `fitness-web/firebase-debug.log` changed while the watcher was running; no existing log was edited, truncated or reverted by this checkpoint.

No physical-device check, live checkout, provider revocation, real URL availability, signed binary or production deletion was verified. Manual checks remain: disabled paywall via direct navigation and meal ideas, unchanged existing access/refresh, policy/support browser opening/back/failure from signed-out and signed-in states with the supplied URLs, and distinct deletion-hold messages. Other release blockers in the readiness report remain.

## Decisions still needed

1. **Storage:** verified owners/upload sources for every unknown bucket/object class, and authorized deletion/retention treatment including versions.
2. **Legacy AI:** retire/purge versus verified-provenance replacement, with a plan to stop the old writers recreating unattributable records.
3. **Safety reports:** retention duration, access, participant anonymization/deletion and exceptions/holds.
4. **Backups/logs:** enabled systems, retention/expiry and a restore procedure that preserves deletion decisions; also treatment of ambiguous old local records and other-device copies.
5. **Shared contributions:** retain catalog/recipient copies after attribution removal, and handling of residual personal text.
6. **Provider authorization:** release-supported providers and the configured/tested revocation path for linked accounts; health/Photos/provider records remain separate.
7. **Tombstones:** retention and tested removal/replacement criteria without reopening late writes or restoring deleted accounts.

Separately provide the two URLs above. Checkout can remain disabled for this checkpoint; enabling it later requires the reviewed backend/payment lifecycle and explicit build opt-in described above.
