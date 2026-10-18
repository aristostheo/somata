# Native compatibility patches

`react-native-health@1.19.0.patch` removes two assignments in `emitEventInternal:` that replace React Native's configured event invoker and call `setBridge:`. React Native 0.86 removes that selector when the legacy architecture is removed. The module still calls inherited `sendEventWithName:body:` with the same event name and payload; React Native's `RCTEventEmitter` owns its invoker.

Evidence: current installed RN `RCTCallableJSModules.m` / `RCTEventEmitter.m`, the reproduced Xcode compiler error, and [upstream issue #443](https://github.com/agencyenterprise/react-native-health/issues/443). No health reads, permissions, logging, storage, or requested event payloads are changed by the patch. Native device event delivery still requires verification; compilation is not proof of HealthKit access.

The root `pnpm-workspace.yaml` registers this exact-version patch and `pnpm-lock.yaml` pins its hash. `pnpm install --frozen-lockfile` applies it on clean installs, including the mobile build archive. Do not fix this by editing `node_modules` alone or disabling health features. Reassess/remove the patch when adopting an upstream version with the equivalent fix. Native validation and remaining gates are in `OFFLINE_LAUNCH_READINESS.md`.
