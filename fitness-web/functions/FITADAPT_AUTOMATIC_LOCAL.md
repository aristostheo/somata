# Local automatic FitAdapt review verification

The production `processFitAdaptAutoReviews` function runs every five minutes through Cloud Scheduler.
With the repository's Firebase CLI 14.20.0 and `firebase-functions` 5.1.1, the local Functions emulator
registers this v2 schedule as a Pub/Sub subscription named
`firebase-schedule-processFitAdaptAutoReviews`, but it does not publish messages on the cron interval.
Starting Pub/Sub alone is insufficient: the default `firebase.json` has no Pub/Sub emulator entry,
so `--only auth,firestore,functions,pubsub` prints `Not starting the pubsub emulator`.

The guarded harness calls `runScheduledFitAdaptReviews`, the same function called by the production
scheduled export. It supplies a test clock for queue eligibility and bookkeeping; it does not change
FitAdapt's evidence and cooldown logic. `--observe-schedule` instead waits
six minutes and fifteen seconds with a past-due job, verifies the emulator did not invoke the worker,
then runs the same handler. The harness requires a fresh `demo-somata-fitadapt` emulator session,
loopback-only hosts, the local FitAdapt URL, and the temporary bridge secret. It refuses any other
project or service URL and never prints credentials or personal payloads.

From `fitness-app/`, keep the existing bridge-only FitAdapt service running on
`http://127.0.0.1:8765` with `FITADAPT_SOMATA_ONLY=1` and the temporary token matching
`fitness-web/functions/.secret.local`. The local, ignored
`fitness-web/functions/.env.demo-somata-fitadapt` must contain
`FITADAPT_SERVICE_URL=http://127.0.0.1:8765`. Use synthetic emulator accounts only.

Build and create the ignored, loopback-only Firebase config:

```sh
pnpm --dir fitness-web/functions build
cd fitness-web
node scripts/create-fitadapt-schedule-config.cjs
firebase emulators:start --config .firebase.emulators.schedule.local.json \
  --project demo-somata-fitadapt --only auth,firestore,functions,pubsub
```

Use a second terminal from `fitness-web/functions/` after all four emulators are ready. The UI is
disabled in this local config; the harness assertions and Functions terminal are the test output.

```sh
GCLOUD_PROJECT=demo-somata-fitadapt \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
FUNCTIONS_EMULATOR_HOST=127.0.0.1:5001 \
PUBSUB_EMULATOR_HOST=127.0.0.1:8085 \
node test/fitadapt-schedule-local.js
```

The test creates a synthetic Auth account, seeds 41 days of meals and 42 days of account-scoped
weights, writes the final meal through the client SDK, observes a server-only queue document, and
checks that a pre-debounce drain does nothing. It invokes the shared production handler when that
job is eligible, verifies a live local FitAdapt pending proposal through `getFitAdaptPlan`, then
accepts it through `acceptFitAdaptPlan`. Legacy targets remain unchanged, and
`activeFitAdaptTargets` appears only after acceptance.

For the slower cron-emulator check, restart the emulators without import/export so they are empty,
then run the same command with `--observe-schedule`. It waits six minutes and fifteen seconds after
making the queue job due. A passing result means Pub/Sub was registered but did not independently
fire the scheduled handler during a full five-minute interval.

The focused queue tests use a fake engine to cover duplicate events, bursts, pending preservation,
insufficient inputs, no-proposal/cooldown responses, and bounded timeout retries. The trigger E2E
checks that relevant writes enqueue but unrelated and FitAdapt-owned writes do not. Run them against
the same local emulators:

```sh
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node --test test/fitadapt.test.js test/fitadapt-automatic.test.js
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FUNCTIONS_EMULATOR_HOST=127.0.0.1:5001 \
GCLOUD_PROJECT=demo-somata-fitadapt node test/fitadapt-triggers-e2e.js
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
node test/fitadapt-e2e.js
```

From `fitness-web/`, run the rules suite:

```sh
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 pnpm test:rules
```

Stop the emulators without import/export to discard fixtures, and remove the
ignored `.firebase.emulators.schedule.local.json` if no longer needed. No production configuration,
rules, functions, or service is changed by these commands.
