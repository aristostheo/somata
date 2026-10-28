# Expo SDK 58 upgrade

Somata mobile now uses Expo 58.0.19, React Native 0.88.0, and React/React DOM 19.3.0. Work remains on `profile-redesign`; no commit, deployment, cloud configuration, or backend changes were made.

## Changes

- `fitness-mobile/package.json`: align Expo/native packages with SDK 58's bundled compatibility map; align React test renderer; explicitly resolve SDK 58 DOM WebView and RN Metro peers; remove the ineffective mobile-only safe-area override; declare supported Node 22.
- `pnpm-lock.yaml`: resolved dependency graph.
- `pnpm-workspace.yaml`: narrowly scoped calendar safe-area and HealthKit config-plugin overrides. The HealthKit plugin uses the same supported `withInfoPlist`/`withEntitlementsPlist` API; its existing native patch remains intact.
- `fitness-mobile/.nvmrc`: Node 22.23.4. The machine's default Node 25 is unsupported by SDK 58. Validation used a temporary npm-provided Node 22.23.4, without changing the system installation.
- `fitness-mobile/app.config.ts`: add SDK-required datetimepicker/status-bar plugins; use `fingerprint` runtime policy so native-incompatible OTA updates cannot share the old app-version runtime. Preserve branding, identifiers, permissions, update URL, and backend/release configuration.
- `fitness-mobile/app/(tabs)/_layout.tsx`: move the Home initial-route setting to the Router layout settings export. Five tab names, order and destinations remain intact.
- `fitness-mobile/app/(modals)/theme-editor.tsx`: replace removed `beforeRemove` event handling with Router's `usePreventRemove`; release prevention only after a successful save. Failed saves retain drafts and permit retry/cancellation.
- `fitness-mobile/content/ThemeProvider.tsx`: normalize a null system appearance to the existing light fallback.
- `fitness-mobile/components/nutrition/uiNew/MealCard.tsx`: use supported Reanimated Swipeable, retaining callbacks.
- `fitness-mobile/components/nutrition/uiNew/PremiumHydrationBottle.tsx`: use immutable Skia paths created by `PathBuilder`, preserving the existing geometry and animation inputs.
- `fitness-mobile/tsconfig.json`: use SDK 58's documented legacy RN type compatibility condition for the existing RN/Moti components. `strict` stays enabled. This is temporary compatibility work: migrate to RN's generated strict API before the legacy surface is removed after RN 0.89.
- `fitness-mobile/tests/sdk58ThemeNavigation.test.ts`: real picker/controller tests with inert native controls and mocked navigation/storage; cover blocked dismissal during save, duplicate taps, success, failure/retry, and cancellation. These are not device gesture tests.

Existing unrelated changes, artwork, logs, Firebase configuration, security rules, account ownership and FitAdapt behavior are preserved.

## Validation

Commands below were run inside `fitness-mobile` with Node 22.23.4 selected:

| Command | Result |
| --- | --- |
| `pnpm exec expo install --fix` | SDK dependencies aligned; required plugins added manually to dynamic config |
| `pnpm dlx expo-doctor` | 20/20 checks passed after resolving duplicate/incompatible dependencies |
| `pnpm typecheck` | Passed |
| `pnpm test` | All 205 existing tests passed |
| `TZ=America/Toronto node --import tsx --test tests/themePicker.test.ts tests/sdk58ThemeNavigation.test.ts tests/stagingBackend.test.ts` | 15 passed, including 3 new navigation tests, after final compatibility changes |
| `CI=1 pnpm exec expo export --platform ios --platform android --output-dir /tmp/somata-sdk58-export` | Passed; both Hermes bundles generated |
| `git diff --check` (upgrade files) | Passed |
| Local `expo start --go --localhost --port 8083` smoke check | iOS manifest reports SDK 58.0.0; iOS development bundle returned HTTP 200 (2,625 modules). Temporary server stopped afterward. No device rendering claimed. |

Remaining non-blocking dependency warnings: the pre-existing Firebase AsyncStorage peer range; legacy web React/TypeScript peer ranges; deprecated Health Connect package; stale browser compatibility metadata; React's deprecated test-renderer notice. None were hidden by new doctor exclusions. The separate web application's source and package manifest were not changed; the shared workspace lockfile was re-resolved.

## Run on iPhone

Stop the old Metro terminal with Ctrl+C. From a new terminal:

```sh
cd /Users/aristos/Documents/fitness-app/fitness-mobile
npm exec --yes --package=node@22.23.4 -- pnpm exec expo start --go --lan --clear
```

This selects Node 22 for this command without replacing system Node. If using nvm instead: `nvm install && nvm use`, then `pnpm exec expo start --go --lan --clear`.

Open the SDK 58 Expo Go app and scan the new QR code. Phone and Mac must be on the same Wi-Fi; allow local-network access if prompted. Existing Firebase mode flags still determine the backend. This upgrade does not turn emulators on or off.

Check all five tabs, light/dark appearance, theme Save/Cancel and swipe-back, camera permission/food scan, meal confirmation, keyboard/form focus, calendar/date selection, and workout navigation. Loading a bundle successfully does not verify these physical-device behaviors.

## Native build follow-up

The existing ignored `fitness-mobile/ios` directory was left intact to preserve local native work. It was generated for the older SDK and must not be treated as an upgraded SDK 58 native project. Before a native development/TestFlight build, back it up, audit any custom edits, then regenerate with SDK 58's prebuild process and install matching pods using compatible Xcode tooling. A new development binary is required; an SDK 57 development binary cannot run this JS update. No native build or device check is claimed here. Do not publish updates to old binaries.

Expo Go does not validate custom Apple Health modules, signed provider authentication, launcher/splash behavior, or TestFlight release gates. Staging remains fail-closed without its required configuration; existing release blockers remain.

References: [Expo upgrade steps](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/), [SDK 58 release notes and legacy type compatibility option](https://expo.dev/changelog/sdk-58).

## October 26 phone-warning follow-up

- Tabs now declare `unstable_settings.anchor: "index"` and `backBehavior="initialRoute"`. This replaces the deprecated setting while preserving Home as the Back destination.
- The inner `(modals)` navigator now uses card presentation. The root still presents the entire group as `fullScreenModal`; no fake underlying screen or extra route was added. This corrects the first-child modal warnings for badges/progress photos and other entries in that group. Subsequent pages within the group use normal stack transitions.
- Notification warnings remain visible: SDK 58's package warns on import in Expo Go, and its push-token warning also uses Android wording on iOS. Notifications were not disabled or warnings suppressed. Remote-push verification requires a development build; an Expo Go run cannot establish that it works.
- Validation: mobile typecheck passed; 8 focused layout, theme navigation, and notification-service tests passed. The layout regression exercises the installed SDK 58 TabRouter's Back behavior for all four non-Home tabs. Phone modal presentation, dismissal, and Android hardware Back still require device verification.
