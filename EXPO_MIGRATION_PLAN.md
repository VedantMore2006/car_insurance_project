# Migration Plan: React Native CLI → Expo (CarDamageDetection)

## Why

The app was originally built on the plain React Native CLI (no Expo), per the original project spec ("Expo-free... workflow"). That decision is being reversed: the goal now is to preview the app on a physical Android device via the **Expo Go** app, without needing a local Android SDK / Gradle build for every iteration. Expo Go can only run apps built entirely from the managed Expo SDK's JS-only or Expo-supported native modules — it cannot load arbitrary third-party native code. This plan migrates the existing app to Expo's **managed workflow** so `npx expo start` + Expo Go works, while keeping a path to a real standalone APK later via EAS Build or `npx expo prebuild`.

## Current state (verified by inspection, 2026-10-26)

Project: `android/CarDamageDetection/`, React Native 0.74.5, TypeScript, React 18.2.0.

Dependencies:
- `@react-navigation/native` `^6.1.18`, `bottom-tabs` `^6.6.1`, `native-stack` `^6.11.0`
- `react-native-screens` `^3.34.0`, `react-native-safe-area-context` `^4.10.9`
- `@react-native-async-storage/async-storage` `^1.23.1`
- `react-native-image-picker` `^7.1.2`

Native code: **no custom native modules**, only the standard RN Android boilerplate (`MainActivity.kt`, `MainApplication.kt` under `com.cardamagedetection`). No iOS Pods customization. This means the migration is low-risk — nothing hand-written in native Kotlin/Java/Swift needs porting.

The one blocker for Expo Go specifically is **`react-native-image-picker`** — it is a third-party native module not bundled in Expo Go, so it cannot run inside Expo Go as-is. It has a direct managed-workflow equivalent: `expo-image-picker`.

Everything else (`@react-navigation/*`, `react-native-screens`, `react-native-safe-area-context`, `@react-native-async-storage/async-storage`) has official Expo-compatible versions and works fine in Expo Go once installed via `npx expo install` (which pins versions matched to the installed Expo SDK).

## Target end state

- `npx expo start` launches Metro + a QR code; scanning it in the Expo Go app on the Android phone runs the app live, matching the current RN CLI skeleton screen-for-screen.
- All current screens/navigation/state logic/tests are preserved unchanged — only the image-picker integration and project scaffolding change.
- A standalone installable APK remains possible later via `npx expo prebuild` (regenerates `android/` and `ios/` native projects) followed by a normal Gradle build, or via `eas build` — so this does not lock the project out of a real production Android build down the line.

## Migration steps

### 1. Snapshot current state
- Confirm a clean git working tree (`git status`) before starting; commit or stash anything uncommitted first.
- Create a new branch for this migration, e.g. `git checkout -b expo-migration`, so the RN-CLI version remains recoverable on `master` if something goes wrong.

### 2. Decide: fresh Expo init + copy `src/`, vs. in-place `npx expo install`
Recommended: **fresh Expo app + copy `src/`**, because it guarantees a clean, correctly-versioned Expo project structure rather than retrofitting config onto the existing RN CLI scaffold (which has its own `android/`, `ios/`, `metro.config.js`, `babel.config.js`, `index.js` that are RN-CLI-specific and will conflict with Expo's own versions of those files).

Steps:
1. In `android/`, run `npx create-expo-app@latest CarDamageDetection-expo --template blank-typescript` (or similar current Expo TS template name — check what the installed `create-expo-app` offers at migration time) in a sibling directory, NOT overwriting the existing `CarDamageDetection/` folder yet.
2. Copy the entire `src/` tree, `__tests__/`, `.env.example`, `jest.config.js` (adapted — see step 5), `.eslintrc.js`, `.prettierrc.js`, `README.md`, `IMPLEMENTATION_PLAN.md`, `PHASE_ONE_REPORT.md` from the old `CarDamageDetection/` into the new Expo project.
3. Do **not** copy `android/`, `ios/`, `metro.config.js`, `babel.config.js`, `index.js`, `app.json` from the old project — Expo provides its own versions of these; merge only project-specific settings (app display name, package identifier `com.cardamagedetection`, icon/splash if any) into the new Expo `app.json`/`app.config.ts`.
4. Once verified working, delete the old `CarDamageDetection/` and rename `CarDamageDetection-expo/` → `CarDamageDetection/`.

### 3. Replace `react-native-image-picker` with `expo-image-picker`
- `npx expo install expo-image-picker`
- Locate every import of `react-native-image-picker` (expected in `src/features/inspection/screens/ImageSelectionScreen.tsx` and/or a shared `imageUtils.ts` helper — confirm exact call sites by grepping `react-native-image-picker` across `src/`).
- Replace `launchImageLibrary(...)` calls with `expo-image-picker`'s `ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, ... })`.
- Map the returned asset shape (`result.assets[0].uri`, `.width`, `.height`, `.fileSize`, `.mimeType`) onto whatever internal type the app currently expects from the old picker's response — check `detection.types.ts` / `imageUtils.ts` for the shape currently consumed, and adjust the mapping function, not the downstream screens, so the rest of the app (preview, validation, upload) needs no changes.
- Expo Go requires runtime permission via `ImagePicker.requestMediaLibraryPermissionsAsync()` before launching the picker — add this check (gallery-only permission, no camera permission, consistent with the original "don't request camera permission unless camera capture is implemented" rule).
- Update `.env.example` / docs if any picker-specific config var existed (unlikely, but check).

### 4. Re-install the rest of the dependencies the Expo way
Run, inside the new Expo project:
```
npx expo install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
npx expo install react-native-screens react-native-safe-area-context
npx expo install @react-native-async-storage/async-storage
```
`expo install` (not plain `npm install`) is required here — it resolves the exact versions compatible with the installed Expo SDK, which avoids the most common source of "works on RN CLI, crashes in Expo Go" bugs.

### 5. Fix config files
- `app.json` (Expo's, not the old RN CLI one): set `name`, `slug`, `android.package` = `com.cardamagedetection` (keep the existing applicationId so nothing downstream — e.g. any future Play Console listing — needs to change), icon/splash if the old project had any configured (check `android/app/src/main/res/` for custom icons worth porting as Expo asset-based icons).
- `jest.config.js`: Expo's TS template ships `jest-expo` as the recommended preset; migrate the existing 40 tests' config to extend `jest-expo` instead of `@react-native/metro-config`'s RN preset. The test *files* themselves should need no changes since they test app logic (services, hooks, utils), not picker internals directly — except any test that mocks `react-native-image-picker`, which must be updated to mock `expo-image-picker` instead.
- `babel.config.js` / `metro.config.js`: use Expo's generated defaults; do not carry over the old RN-CLI ones.
- `tsconfig.json`: Expo's TS template provides one; merge in any path aliases the old project used (check old `tsconfig.json` for `paths`/`baseUrl` customizations first).

### 6. Verify
- `npx tsc --noEmit` — must be clean, matching the previous verified result.
- `npm run lint` — fix anything the Expo template's default ESLint config flags beyond the original "0 errors, 1 stylistic warning" baseline.
- `npx jest` — all 40 existing tests must still pass (update the image-picker mock as in step 3/5; no other test should need behavior changes since app logic didn't change).
- `npx expo start` — launch Metro, scan the QR with Expo Go on the actual Android phone, and manually walk the full workflow: Dashboard → Image Selection (pick from gallery) → Preview → (Detection Progress/Results will still show the "not yet connected to a backend" error state, which is correct/expected) → History → Settings. Confirm no red-screen errors, and that navigation, image picking, and AsyncStorage-backed history/settings all work live on-device.
- This `npx expo start` + Expo Go walkthrough is the thing this plan is *for* — do not consider the migration done until it's been done on the real phone, not just "should work."

### 7. Keep the standalone-build path open (do later, not part of this plan)
- Note for the record, don't implement yet: `npx expo prebuild` regenerates native `android/`/`ios/` folders from the Expo config when a real installable APK/AAB is needed later (e.g. for the eventual production build or Play Store submission), or `eas build -p android` builds one in the cloud without a local Android SDK at all. Either remains available after this migration — Expo's managed workflow does not permanently forgo a standalone build, it just defers needing a local SDK until you actually need one.

## What does NOT change
- All screen components, navigation structure, `useDetection` hook/state machine, `detectionService`/`apiClient`/`apiConfig`, `historyStorage`, `damageClasses.ts`, `theme.ts`, and all existing tests for that logic — these are plain React/TypeScript and are Expo-agnostic. Only the image-picker call site(s) and the project scaffolding/config files change.
- The model files and backend benchmark artifacts under `backend/` — untouched, unrelated to this migration.
- The "no live backend yet" status — this migration does not add or fake a backend connection; Detection Progress/Results screens will still correctly show the not-yet-connected error state against Expo Go, exactly as they do now.

## Risks / things to double check during implementation
- Confirm the exact current Expo SDK version's compatible React/React Native version before fixing `react`/`react-native` versions in the new project — do not keep `0.74.5` pinned if the current Expo SDK bundles a different RN version; let `create-expo-app` pick it, then re-verify everything against that version.
- If any screen relied on an RN-CLI-only API with no Expo equivalent (unlikely given the audit above, but re-grep `src/` for any other `react-native-*` native-module imports beyond the ones already listed, in case something was added after this plan was written), surface it immediately rather than attempting a silent workaround — it needs a replacement plan, not an assumption.
- Re-confirm `android.package` / applicationId stays `com.cardamagedetection` so this isn't an accidental rename of the app's identity.

## Definition of done
- [x] New Expo-based project replaces the RN CLI one at `android/CarDamageDetection/`, old RN CLI version recoverable from git history on `master` if needed.
- [x] `expo-image-picker` fully replaces `react-native-image-picker`; gallery permission requested correctly; no camera permission requested.
- [x] `npx tsc --noEmit` clean, lint clean (same baseline as before), all 40+ tests passing (with the picker mock updated).
- [ ] `npx expo start` + Expo Go on the real Android phone confirmed working end-to-end through Dashboard → Image Selection → Preview → History → Settings, with Detection Progress/Results correctly showing the "no backend yet" state (Metro bundling verified clean; ready for on-device scan).
- [x] `README.md` updated to describe the Expo-based run instructions (`npx expo start`, Expo Go) instead of the old `npx react-native run-android` instructions, and to note the `expo prebuild`/`eas build` path for a future standalone APK.
- [x] A short completion report listing exact files changed, exact commands run, and actual verified outcomes (not assumed) — see `android/EXPO_MIGRATION_REPORT.md`.
