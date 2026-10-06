# FitAdapt production rollout — operator runbook

This package prepares deployment; it does not deploy anything. Execute only after the operator
confirms the values below and reviews the tested source revision. Use a synthetic Firebase account
for smoke tests, and never paste credentials or personal fitness data into tickets or shell history.

## Inputs to confirm before deployment

| Input | Current evidence | Operator decision |
| --- | --- | --- |
| Firebase project ID | `.firebaserc` and mobile config name `fitness-tracker-25254`. This is a configured default, not proof it is the intended production target. | **Confirm `<FIREBASE_PROJECT_ID>`** and its billing/permissions. Always pass `--project`. |
| Callable region | FitAdapt callables have no explicit region; mobile `getFunctions(app)` and local E2E use the SDK/default `us-central1`. | **Confirm `<CALLABLE_REGION>` is `us-central1`** before deploying. A different region requires coordinated source/mobile changes. |
| Cloud Run project and region | No FitAdapt host exists in source. | **Choose `<RUN_PROJECT_ID>` and `<RUN_REGION>`**; same project and nearby region are recommended, subject to data-residency and billing review. |
| Service name and identity | No service or service account is configured. | **Choose `<RUN_SERVICE>` and `<RUN_SERVICE_ACCOUNT>`** and grant that identity Secret Manager access to the bridge secret only. |
| HTTPS service URL | None configured. | **Record the actual Cloud Run HTTPS root URL as `<FITADAPT_SERVICE_URL>`** after deployment; do not append the route or a trailing path. |
| Secret value | `FITADAPT_BRIDGE_TOKEN` is named in both services; no value is committed. | **Generate one high-entropy value**, store it in Secret Manager for both runtimes, and record only secret version IDs. |

Firebase Functions use `defineString("FITADAPT_SERVICE_URL")` and
`defineSecret("FITADAPT_BRIDGE_TOKEN")`; only `evaluateFitAdapt` and `acceptFitAdaptPlan` bind the
secret. The client never receives either setting. Admin SDK transactions write
`fitadaptPlans/{uid}`, `fitadaptPlans/{uid}/history/{proposalId}`, and
`users/{uid}.activeFitAdaptTargets`. `fitness-web/firestore.rules` allows owner reads but denies
client writes to those locations. Confirm that the target project's currently published rules
have not changed since this file was prepared; the file was based on the then-published rules and
preserves their scan-quota clauses.

## Build and local gate

FitAdapt has no configured host. Recommend **Cloud Run** because it accepts this Python container,
provides managed HTTPS and Secret Manager in the same Google Cloud ecosystem as Firebase, and can
scale to zero. Render or Railway would require another account and separate secret management;
they are viable only if the operator already prefers them. Cloud Run billing, Artifact Registry,
Cloud Build, Secret Manager access, API enablement, and appropriate IAM roles need operator setup.

From `fitadapt/`, `Dockerfile` uses Python 3.12, uv 0.12.9, and `uv.lock` with non-editable runtime
dependencies. It runs as a non-root user, serves only `/health` and the protected Somata bridge in
production mode, disables access logs, and bounds bridge JSON to 128 KiB. Cloud Run settings below
bound instances, concurrency, and request duration; Somata's adapter times out at 10 seconds.
The Hatch build inclusion list keeps the Python sdist and wheel free of local `.env`, web,
`node_modules`, and data files; CI inspects both artifacts after `uv build`.
`GET /health` returns service/version metadata only. The public general-purpose API remains
available in local development when `FITADAPT_SOMATA_ONLY` is unset.

Run before any rollout:

```sh
# fitadapt/
uv sync --locked
uv run pytest tests/integration/api/test_somata_bridge_api.py
uv run pytest --cov=fitadapt --cov-branch --cov-fail-under=95
uv run ruff check .
uv run ruff format --check .
uv build
docker build -t fitadapt:rollout-check .

# fitness-app/
pnpm --dir fitness-web install --frozen-lockfile
pnpm --dir fitness-web/functions run build
node --test fitness-web/functions/test/fitadapt.test.js
cd fitness-web
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
  firebase emulators:exec --project demo-somata-fitadapt --only auth,firestore "pnpm test:rules"
```

Run the full local callable acceptance replay in `FITADAPT_BRIDGE.md` with a temporary local token
and loopback URL. Never point that script at a production project. The new Somata CI workflow runs
adapter/callable unit tests and owner-only rules tests; FitAdapt CI runs bridge and full API tests.
The cross-repository local acceptance replay remains an explicit release gate.

## Operator deployment sequence (commands are documentation only)

1. Record the current Cloud Run revision (if any), current callable versions, and the published
   Firestore ruleset ID. Confirm the Firebase project and callable region above. Set
   `FITADAPT_BRIDGE_TOKEN` using `firebase functions:secrets:set FITADAPT_BRIDGE_TOKEN --project
   <FIREBASE_PROJECT_ID>` with an interactive prompt, or an equivalent Secret Manager operation.
   Do not put its value in `--set-env-vars`, a committed file, or a command argument. If Cloud Run
   uses another project, create a separate Secret Manager secret with the same value through the
   operator's approved secure workflow. Grant `<RUN_SERVICE_ACCOUNT>` access only to that secret.
2. From `fitadapt/`, deploy the reviewed image/source to Cloud Run. The Dockerfile is the build
   definition. For example, after substituting reviewed values:

   ```sh
   gcloud run deploy <RUN_SERVICE> --source . --project <RUN_PROJECT_ID> --region <RUN_REGION> \
     --service-account <RUN_SERVICE_ACCOUNT> --allow-unauthenticated --ingress all \
     --set-secrets FITADAPT_BRIDGE_TOKEN=FITADAPT_BRIDGE_TOKEN:<SECRET_VERSION> \
     --set-env-vars FITADAPT_SOMATA_ONLY=1 --timeout=15s --concurrency=10 \
     --max-instances=3 --min-instances=0 --memory=1Gi --cpu=1
   ```

   Cloud Run must allow unauthenticated HTTP transport because the current Somata adapter sends
   an application bearer credential, not a Google IAM ID token. Production mode exposes only the
   health route and credential-checked bridge; do not disable that mode. Record the deployed URL
   and revision. If policy requires Cloud Run IAM-only invocation, implement a separate service
   identity/ID-token change before rollout; do not merely flip the ingress/auth switch.
3. Verify `GET <FITADAPT_SERVICE_URL>/health` returns no user or secret data; a bridge POST with
   no token returns 401, and general API/docs paths return 404. Set the Functions string parameter
   `FITADAPT_SERVICE_URL` to the confirmed HTTPS root through the Firebase CLI's prompted
   parameter flow or the approved server-side environment mechanism. Ensure no stale `.env.local`
   is used for production. Do not include the URL in mobile or Expo configuration.
4. From `fitness-web/`, deploy `firestore:rules` to the **explicit confirmed project** before
   enabling the callables. Re-run the owner/cross-owner denial checks against the target project
   using synthetic accounts. The new rules permit normal owner profile writes and deny protected
   writes. Do not roll back to the previously published owner-write wildcard; it permits target
   tampering.

   ```sh
   firebase deploy --project <FIREBASE_PROJECT_ID> --only firestore:rules
   ```

5. Deploy only `evaluateFitAdapt`, `getFitAdaptPlan`, `acceptFitAdaptPlan`, and
   `declineFitAdaptPlan` using the Firebase CLI's `--only functions:<name>,...` selector and
   `--project <FIREBASE_PROJECT_ID>`. Verify their actual region and secret binding. The current
   `firebase.json` predeploy hook runs frozen pnpm install and TypeScript build; it does **not** run
   lint. The known 17 unrelated `describe.ts` lint errors do not block this hook, but should be
   fixed narrowly before lint is made a release gate. Deploying these four names avoids changing
   the unrelated `describe` function.

   ```sh
   firebase deploy --project <FIREBASE_PROJECT_ID> \
     --only functions:evaluateFitAdapt,functions:getFitAdaptPlan,functions:acceptFitAdaptPlan,functions:declineFitAdaptPlan
   ```

## Synthetic smoke test

Create a dedicated synthetic Firebase Auth account in the confirmed project. Use the app's normal
authenticated flow or approved Admin tooling to seed only fictional, account-scoped profile,
nutrition, and dated weight inputs. With that account, request an evaluation explicitly. Confirm
one pending proposal, unchanged active goals, then accept it explicitly and verify
`currentRecommendation`, history, and `activeFitAdaptTargets` agree. Repeat acceptance to verify
idempotence; use another synthetic account to verify isolation. Client SDK attempts to create,
merge, alter, or delete protected plan/history/target data must return permission denied, while a
normal profile-field update and dated-weight write still succeed. Clean up synthetic accounts and
data through approved Admin tooling after evidence is recorded. Use operation names and status
codes in logs; never record request payloads, tokens, or personal data.

## Rollback

- **Service:** route traffic to the recorded prior Cloud Run revision with `gcloud run services
  update-traffic <RUN_SERVICE> --to-revisions <PRIOR_REVISION>=100 --project <RUN_PROJECT_ID>
  --region <RUN_REGION>`. If this is the first revision, disable callable evaluation/acceptance
  before taking the service offline. Verify the URL and secret binding after rollback.
- **Functions:** redeploy the prior reviewed source revision for the same four callable names and
  explicit Firebase project. Preserve the existing plan documents. If no prior callable version
  exists, stop new evaluations at the application/release gate while keeping protected data read
  access. Re-run synthetic read and rule-denial checks.
- **Rules:** redeploy the last tested **hardened** rules revision. The pre-Checkpoint-7 rules are
  not a safe rollback because they allow client changes to accepted targets. For an initial
  rollout regression, fix the narrow conflicting rule while retaining the FitAdapt guards, test
  it in the emulator, then deploy that corrected ruleset. Do not restore the old unrestricted
  owner-write wildcard.

Cloud Run and Firebase deployment procedures: [Cloud Run source deployment](https://cloud.google.com/run/docs/deploying-source-code), [Cloud Run secrets](https://cloud.google.com/run/docs/configuring/services/secrets), [Firebase Functions configuration](https://firebase.google.com/docs/functions/config-env), and [Firestore rules deployment](https://firebase.google.com/docs/rules/manage-deploy).
