# Trusted Somata AI boundary

Implemented locally on `profile-redesign`; nothing deployed or configured in production.

## Endpoint and clients

`generateSomataAI` is exported from `src/index.ts` in `us-central1`. It is an HTTPS Function implementing Firebase's callable request/result/error protocol. Both clients call it with the Firebase `httpsCallable` SDK, which supplies the current Firebase ID token. The URL follows the selected Firebase project; there is no client-configurable provider URL or obsolete `parseMeal` URL.

- Mobile: `services/openai.ts` adapts existing presentation callers to the trusted endpoint. Description, photo, meal-builder estimates, single-food reanalysis, Coach Spark, meal ideas and macro completion all use it. Existing system prompts/model options in presentation callers are compatibility inputs only; the server chooses the prompt/model/output limits.
- Web: `src/services/aiMeal.js` uses the same endpoint and maps its validated flat meal estimate to the existing review form's `suggestedName`, `qty`, `unit`, `totals` shape.
- The old mobile `parseMealRemote` compatibility helper now delegates to this endpoint. No client references the missing `parseMeal` Function.
- Analysis returns an estimate only. The existing review/edit/confirm handoff is still required to save nutrition. No FitAdapt, profile, goal, workout, or meal document is written by this endpoint.

The old `describe` export remains for compatibility with any independently deployed consumers; the migrated clients do not use it. This checkpoint does not deploy or rewrite that legacy service.

## Contract and security

Firebase callable envelope:

```json
{"data":{"operation":"meal","text":"one slice of toast"}}
```

Supported operations: `meal`, `mealFoods`, `foodMacros`, `photo`, `workout`, `mealIdeas`, `macroCompletion`. Only `photo` accepts the optional `imageDataUrl` field. There is no client UID, profile, model, token budget, provider URL or system-message field.

- POST with JSON; verified Firebase ID token; UID comes only from Admin Auth verification.
- Maximum HTTP body 1,500 KiB, description 12,000 characters, decoded image 1 MiB. Photo data must be base64 JPEG/PNG with matching signature. Remote image URLs and unsupported media are rejected; there is no URL fetch/SSRF path.
- Provider: server-owned `gpt-4o-mini`, schema prompts, bounded output tokens per operation, 25-second deadline and abort, 128 KiB maximum response body. No automatic retries, including 429, malformed responses or server errors.
- Explicit projection validates required nutrients, finite nonnegative numbers, positive quantities/portions, arrays, confidence, exercise structures and bounded strings. Unknown optional nutrients stay absent. Invalid/refused/truncated results return an error; there is no fabricated estimate or heuristic fallback.
- Limits are atomic per verified UID: 5 attempts per UTC minute and 60 per UTC day, shared across operations. Failed provider attempts count; invalid input does not. Admin-only `aiUsageLimits/{uid}` stores just minute/day buckets and counts, one overwritten record per UID. Existing rules deny client reads/writes; rules were not changed. No request text, photo, result or token is stored there.
- Runtime: 40-second Function timeout, 2 maximum instances, concurrency 10 per instance. Clients use 35-second timeouts.
- Safe error detail codes: `unauthenticated`, `invalid_input`, `unsupported_media`, `too_large`, `rate_limited`, `timeout`, `unavailable`, `invalid_response`. Provider diagnostics/credentials are not returned or logged.
- A custom HTTP envelope handler is used because the installed Firebase callable wrapper logs the body of some malformed requests. This handler logs no request bodies or image bytes. Responses have `Cache-Control: no-store`.
- Existing local photo preparation/capture retention is unchanged; no new Storage upload or image persistence was added.

## Secrets and release prerequisites — operator actions only

The secret name is the existing **`OPENAI_API_KEY`**, attached only to Functions via `defineSecret`. Client OpenAI variables and obsolete AI endpoint overrides were removed from the local mobile/web `.env` files; other local settings were preserved. The client example no longer suggests supplying a key.

**Treat the formerly client-embedded credential as exposed.** The operator should revoke/rotate it in the provider account and replace any server secret that reused it. No key was displayed, revoked, rotated or configured in production by this checkpoint. Previously distributed builds cannot be made safe by editing this repository alone.

For an approved future rollout, an operator can set the secret through Firebase's interactive secret prompt, avoiding command-line/history exposure:

```sh
firebase functions:secrets:set OPENAI_API_KEY --project <CONFIRMED_FIREBASE_PROJECT_ID>
```

That command was **not run**. Confirm the project deliberately, provider access/quota and billing first. The function still needs an explicitly authorized deployment before ordinary-account builds can use it. Until then, the normal app will show the safe unavailable state if this function is absent. Do not ship the migrated clients ahead of the server endpoint. No production URL, provider credential, Firebase configuration or deployment was guessed or changed.

For real local provider testing, supply a valid test key only in the Functions emulator's ignored `.secret.local` (or existing server local configuration). Never use `EXPO_PUBLIC_*` or `REACT_APP_*` for provider credentials. Do not repeatedly retry a provider rate-limit response.

## Reproducible mock emulator validation

These tests make no paid provider calls. The staging script creates a temporary package containing the actual compiled handler, contract, limiter and provider adapter. Only its provider transport is replaced with synthetic responses. Production code has no test switch or alternative provider URL. The fixture refuses execution outside the demo Functions emulator and its deliberately invalid synthetic secret.

From `fitness-web/functions`:

```sh
npm run build
node --test test/ai.test.js test/fitadapt.test.js test/fitadapt-automatic.test.js
npx eslint src/ai --ext .ts
node test/prepare-ai-emulators.cjs
```

The last command prints a temporary directory. In a separate terminal:

```sh
cd <PRINTED_TEMPORARY_DIRECTORY>
firebase emulators:start --project demo-somata-fitadapt --only auth,firestore,functions
```

Wait for `generateSomataAI` to initialize, then from `fitness-web/functions`:

```sh
GCLOUD_PROJECT=demo-somata-fitadapt \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
FUNCTIONS_EMULATOR_HOST=127.0.0.1:5001 \
node --test test/ai.emulator.cjs
```

The tests create only synthetic `example.test` users and demo data. They exercise real ID-token verification and Firebase SDK protocol, reject forged ownership, check quotas with concurrent requests, run all seven validated mock responses, check failures, and assert no nutrition or accepted-plan changes. Request text/image markers are also checked against isolated emulator logs during this checkpoint. Stop the emulators with Ctrl-C; discard the printed temporary package. No emulator data needs exporting. Keep its mock package out of deployment commands.

## Results for this checkpoint

- Functions build passed; 15 AI + existing bridge/queue unit tests passed.
- New AI source lint passed. Existing unrelated `describe.ts` lint errors were not changed or suppressed.
- Endpoint emulator tests: 6 passed (parent plus 5 cases), using the **mocked provider transport** with real Firebase Auth/Firestore/Functions.
- Existing Firestore rules suite: 11 passed.
- Mobile typecheck and 60 tests passed; iOS and Android Hermes exports passed.
- Web production build and 8 suites / 26 tests passed.
- Source/local-client-env safety check and generated-artifact safety check both passed. The artifact check decodes Hermes bytecode strings to avoid false matches inside concatenated “mask/task” icon names, and scans the web JS/source maps. No AI provider key, direct provider URL or provider-env reference was found.
- Exactly **one** small live request was attempted through the actual server provider adapter using the existing server-side local secret and synthetic toast description. It returned `unavailable`; successful live generation remains **not verified**. No subsequent live request or rate-limit retry was made. The safe error intentionally does not disclose upstream diagnostics; the operator must verify the server credential/provider availability before another controlled test.
- No physical-device camera, gallery permission or capture test was performed. Mock image transport is not evidence that those device features passed.

Client commands:

```sh
# fitness-mobile
npm run typecheck
npm test
npx expo export --platform all --max-workers 2 --output-dir /private/tmp/somata-ai-check/mobile-bundles

# fitness-web
CI=true npm test -- --watchAll=false --runInBand
npm run build
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npm run test:rules

# fitness-web/functions — choose the installed Hermes compiler matching the export
SOMATA_HERMESC_PATH=<ABSOLUTE_PATH_TO_MATCHING_HERMESC> \
SOMATA_AI_BUNDLE_DIRS=/private/tmp/somata-ai-check/mobile-bundles:<ABSOLUTE_WEB_BUILD_DIRECTORY> \
node --test test/ai-client-safety.test.js
```

The export used normal local environment loading after client-secret removal, rather than hiding keys with a one-off build flag. Keep the safety test as a release check. It prints violating filenames only, never matching credential text.

## Remaining device checks

With a correctly configured local authenticated backend, test camera/gallery denial, later permission grant, cancellation, JPEG conversion and oversized-photo feedback. Review/edit an estimate and verify that no nutrition entry appears until explicit confirmation. Test sign-out during a request, offline/timeout feedback and manual retry. Repeat web description review/save and mobile description, photo and workout actions after the trusted endpoint is available. Use synthetic emulator accounts for writes; do not accept or alter a personal FitAdapt plan for this checkpoint.
