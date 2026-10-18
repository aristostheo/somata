# Local FitAdapt review from Expo Go

This path uses only the `demo-somata-fitadapt` emulators and a synthetic account. Keep the existing
FitAdapt process running at `http://127.0.0.1:8765` with `FITADAPT_SOMATA_ONLY=1` and the same
temporary bridge token already configured for the local Functions emulator. The phone calls the
Firebase emulators on your Mac; only the Functions emulator calls FitAdapt on loopback. Use a trusted
Wi-Fi network shared by the phone and Mac. Do not use a public network while the emulators listen on
the LAN.

From `fitness-app/`, build the Functions code and start the emulators in separate terminals. Stop any
emulators already occupying ports 9099, 8080, or 5001 first; the default `firebase.json` binds Auth
to loopback and cannot serve a physical phone. The generator creates an ignored, local-only config
that binds the three required ports to the Mac's interfaces. Only `--config` selects it. This does
not change the default Firebase or production configuration.

```sh
pnpm --dir fitness-web/functions run build
cd fitness-web
node scripts/create-fitadapt-lan-config.cjs
firebase emulators:start --config .firebase.emulators.lan.local.json --project demo-somata-fitadapt --only auth,firestore,functions
```

The existing uncommitted `functions/.env.demo-somata-fitadapt` must contain the local
`FITADAPT_SERVICE_URL=http://127.0.0.1:8765`, and `functions/.secret.local` must contain the matching
temporary `FITADAPT_BRIDGE_TOKEN`. Confirm the Functions emulator reports that it loaded both files;
do not paste the token into Expo variables or source files. Do not add `--import` or `--export-on-exit`
for this disposable test.

In a second terminal, from `fitness-web/functions/`, create one fresh synthetic account. The fixture
refuses any project other than `demo-somata-fitadapt` or emulator hosts other than the Mac's own
loopback ports. It prints a generated email and password for local sign-in. It seeds the same
synthetic profile and 42 dated nutrition and account-scoped weight records used by the backend E2E
test, with dates ending today; it never reads personal data.

```sh
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
  node test/seed-fitadapt-mobile.js --project demo-somata-fitadapt
```

Find the Mac's Wi-Fi LAN address with `ipconfig getifaddr en0` (use the active Wi-Fi interface if
it is not `en0`). From `fitness-mobile/`, start Metro with command-scoped variables, replacing the
placeholder with that private IPv4 address. The address must be reachable from the phone; do not
use `localhost`, `127.0.0.1`, or a public IP. The explicit flag defaults to off, and the app also
requires `__DEV__` and the exact demo project ID.

```sh
EXPO_PUBLIC_USE_FIREBASE_EMULATORS=true \
EXPO_PUBLIC_FIREBASE_EMULATOR_PROJECT_ID=demo-somata-fitadapt \
EXPO_PUBLIC_FIREBASE_EMULATOR_HOST="$(ipconfig getifaddr en0)" \
pnpm exec expo start --host lan --clear
```

Open the QR code in Expo Go on the phone. If macOS asks whether Node, Java, or Firebase may accept
incoming network connections, allow access on this trusted local network. Sign in with the
fixture's email and password. Open **Profile → FitAdapt review → Review my plan**. A **Pending review**
proposal should appear while **Your goals** stay active. Tap **Accept plan** and verify the pending
proposal clears and the accepted targets appear. This changes emulator data only. For **Decline**,
sign out and run the fixture again to create a fresh account, then repeat the review and tap
**Decline**; the saved goals should remain. You can also restart the emulators without import/export
between runs to clear all synthetic data. Never use a real account for this flow.

For backend verification from `fitness-web/functions/` while the local services are running:

```sh
node --test test/fitadapt.test.js
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
  node test/fitadapt-e2e.js
```

When finished, stop Metro and the emulators. Restarting emulators without import/export removes
the fixture, its proposals, and its history. Delete `fitness-web/.firebase.emulators.lan.local.json`
and keep the temporary `.env.demo-somata-fitadapt` and `.secret.local` files outside version control,
or delete them if no longer needed. Fully close Expo
Go, then restart the normal app without the three `EXPO_PUBLIC_` variables (and with any local
`.env` override removed): `cd fitness-mobile && pnpm exec expo start --clear`. A full restart is required
when switching Firebase projects or LAN hosts; hot reload only reuses an existing connection.
