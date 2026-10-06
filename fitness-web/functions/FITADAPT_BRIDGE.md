# Somata–FitAdapt bridge

`evaluateFitAdapt` is a Firebase callable function. Firebase verifies the caller's ID token and
the function reads only `users/{auth.uid}` and that account's `nutritionEntries` and
`fitadaptWeightEntries`. It sends a minimal `POST /v1/integrations/somata/profile-intelligence`
request. A valid numerical proposal is stored as pending in `fitadaptPlans/{auth.uid}`.
`getFitAdaptPlan`, `acceptFitAdaptPlan`, and `declineFitAdaptPlan` are authenticated callables.
Acceptance rechecks the source profile and asks FitAdapt to confirm the exact proposal before a
Firestore transaction writes accepted state, history, and a derived target projection in `users/{uid}`.
Decline writes history and leaves nutrition targets unchanged. Neither action runs automatically.
The older fitness-web profile service uses `profiles/{uid}`; this bridge follows the mobile
profile store and does not merge those separate documents.

Server configuration:

- Set the Firebase Functions string parameter `FITADAPT_SERVICE_URL` to the FitAdapt service
  root. Production requires HTTPS. The adapter accepts HTTP only for `localhost` or `127.0.0.1`.
- Set the Firebase Secret Manager secret `FITADAPT_BRIDGE_TOKEN` for the callable function.
- Set the same `FITADAPT_BRIDGE_TOKEN` in FitAdapt's server environment. Its protected route
  fails closed when absent. No URL or token is supplied in the repository.

Somata's saved `age`, `heightCm`, `weightKg`, `sex`, `activityLevel`, `goalInputs.mode`,
`goalResult.weeklyPaceKg`, and `goalInputs.proteinPriority` provide required profile fields.
The profile's `weightKg` is canonical kg even when `weightUnit` is `lb`; no display-unit
conversion is needed. The selected protein priority maps `standard` to FitAdapt `balanced`
and `high`/`very_high` to `higher_protein`. Unsupported or missing saved choices return
`{kind: "insufficient_data", missing: [...]}`. A saved cut/gain pace outside FitAdapt's
limits is treated as insufficient rather than clamped.

The function aggregates up to 90 days of account-scoped `nutritionEntries` by saved ISO
`date`, including recorded zero calories. If any entry for a day lacks calories, that day's
energy is unknown, not zero. The account-scoped `steps` map can contribute dated steps,
including zero. From this checkpoint onward, explicit mobile weight saves atomically write
`users/{uid}/fitadaptWeightEntries/{date}`; those account-scoped records contribute dated weights.
Device-local `@body_metrics_history:v1` is never migrated, read, or sent. The profile's current
weight remains a separate profile input. Users without enough new dated evidence can receive an
insufficient-data result rather than an invented proposal.

For local end-to-end verification, run FitAdapt with a temporary `FITADAPT_BRIDGE_TOKEN`, then
run the Auth, Firestore, and Functions emulators with a temporary loopback
`FITADAPT_SERVICE_URL` and matching secret. From `functions/`, run
`FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 node test/fitadapt-e2e.js`.
The script seeds only the `demo-somata-fitadapt` emulator project.
With the same Auth and Firestore emulators running, use `pnpm --dir fitness-web test:rules`
with `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` and
`FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` to verify client denials and Admin writes.
`fitness-web/firestore.rules` is the versioned rules source configured by `fitness-web/firebase.json`.

Production prerequisites: deploy the FitAdapt protected HTTPS endpoint; configure the Functions
URL parameter and bridge secret server-side; deploy the new callables and the versioned Firestore
rules. The rules permit owner reads of `fitadaptPlans/{uid}` and its history, deny all client writes
there, and deny changes to `users/{uid}.activeFitAdaptTargets` while retaining unrelated owner
profile updates. Admin SDK transactions bypass these client rules. No production URL or credential
is committed here.
