# Car Damage Detection (Phase One)

React Native (CLI, TypeScript) Android app foundation for inspecting vehicle photos for damage.
This is **Phase One**: UI, navigation, state, storage, and a detection-service abstraction are all
built and tested, but there is **no live backend wired up yet** and the Android native build has
**not been run/verified** in this development environment (see "Current integration status" and
"Known limitations" below).

## Features (Phase One)

- Dashboard with a primary "Inspect Vehicle" action and a real recent-inspections list (empty
  state for first-time users — no fake stats).
- Gallery-based image selection (no camera permission requested), with format/size validation.
- Image preview with dimensions, replace/cancel actions.
- Detection progress screen with a generic "Analyzing..." state, cancel, and a retry-on-failure
  path — no fabricated progress percentage.
- Detection results screen: bounding-box overlay (real coordinate-scaling math, not approximate),
  per-detection class + confidence list, save-to-history, retry, return-to-dashboard.
- History screen backed by `AsyncStorage` (metadata + image file URI references only — never raw
  image bytes), with delete + confirmation and a graceful fallback when an image file is missing.
- Settings screen: backend URL (persisted), a "Test Connection" action against `/health`,
  confidence threshold (persisted, explicitly labeled as having no effect until a backend confirms
  support), clear-history, and a privacy note.

## Stack

- React Native 0.74.5 (CLI, **not** Expo), TypeScript
- React Navigation 6 (native-stack + bottom-tabs)
- `react-native-image-picker` (gallery only)
- `@react-native-async-storage/async-storage`
- Fetch-based HTTP client (no axios)
- Jest + `@testing-library/react-native` + `react-test-renderer`

## Project structure

```
src/
  app/            App.tsx, navigation/, providers/
  components/     Shared, presentational components
  features/
    dashboard/    DashboardScreen
    inspection/   Image selection -> preview -> progress -> results flow, detectionService,
                  detection.types.ts, inspectionSession.ts (in-memory handoff)
    history/      HistoryScreen
    settings/     SettingsScreen
  services/
    api/          apiClient.ts (fetch wrapper), apiConfig.ts (endpoints, base URL)
    storage/      historyStorage.ts (AsyncStorage-backed)
  config/         appConfig.ts, damageClasses.ts (SINGLE source of truth for class order), theme.ts
  hooks/          useDetection.ts (explicit lifecycle state machine)
  utils/          imageUtils.ts, formatters.ts, validation.ts
  types/          common.types.ts
```

## Prerequisites

- Node.js >= 18 (this environment has v26.12.0 — works, but RN 0.74 is tested primarily on 18/20 LTS)
- A JDK (17–20) for Android builds — **not installed in this dev environment**
- Android Studio + Android SDK (API 34 recommended) — **not installed in this dev environment**
- An Android emulator or physical device with USB debugging

## Install

```bash
npm install
```

## Run (requires a working Android toolchain — see "Current verification status")

```bash
npx react-native start      # Metro bundler
npx react-native run-android
```

### Physical device notes

- Enable Developer Options + USB debugging, connect via USB, confirm `adb devices` lists it.
- The backend URL you enter in Settings must NOT be `localhost` — on a physical device that
  resolves to the device itself, not your development machine. Use your machine's LAN IP
  (e.g. `http://192.168.1.50:8000`) or a real deployed URL.

### Emulator notes

- An Android Studio AVD works out of the box with `run-android`.
- `localhost`/`127.0.0.1` on the emulator refers to the emulator itself too; use `10.0.2.2` to
  reach your host machine's `localhost`, or `adb reverse`.

## Backend URL configuration

See `.env.example`. In this Phase One build there is no `react-native-config`/env-loading wired
up; the backend base URL is configured **at runtime from the Settings screen** and persisted via
AsyncStorage (see `src/services/storage/historyStorage.ts` `getSettings`/`saveSettings` and
`src/services/api/apiConfig.ts`).

## Current integration status

**No real backend exists in this repository.** `src/features/inspection/services/detectionService.ts`
implements a real `fetch`-based client against a *proposed* contract:

- `POST {API_BASE_URL}/api/v1/detect` — multipart upload, field `image`, optional
  `confidenceThreshold`/`iouThreshold`. Expected JSON response:
  ```json
  {
    "requestId": "optional string",
    "modelName": "optional string",
    "image": { "width": 1024, "height": 768 },
    "detections": [
      { "classId": 7, "className": "bonnet-dent", "confidence": 0.91,
        "bbox": { "x1": 10, "y1": 20, "x2": 300, "y2": 250 } }
    ],
    "annotatedImageUri": "optional string",
    "processingTimeMs": 1234
  }
  ```
- `GET {API_BASE_URL}/health` — used by the Settings screen's "Test Connection" button.

These endpoint names/shapes are illustrative, not confirmed against any real server — no backend
code was found anywhere in this repo during inspection. Calling "Analyze Damage" against the
default placeholder URL (`https://your-backend.example.com`) will fail with a network/DNS error,
which is the correct, honest behavior (no result is ever fabricated on failure).

**Remote vs. on-device model deployment is deliberately undecided** and isolated behind the
`DetectionService` interface (`src/features/inspection/types/detection.types.ts`). Only
`detectionService.ts` should need to change to add a real backend call or an on-device
ONNX/TFLite runtime — screens and the `useDetection` hook depend only on the interface.

## Tests

```bash
npx jest
```

Covers: dashboard render/empty-state, detection service success/failure/parse/validation (fetch
fully mocked, no real network calls), `useDetection` lifecycle (success, error, duplicate-tap
guard, retry, reset), damage-class config lookup, bbox coordinate-transform math (including
letterboxing), formatters, input validation, and history/settings AsyncStorage round-trips.

Actual result in this environment: **40 tests passed, 0 failed, across 9 suites** (see
`PHASE_ONE_REPORT.md` for the exact commands/output).

## Known limitations / what's NOT verified

- **Android build/launch (`npx react-native run-android`) has not been run or verified.** This
  development environment has no JDK, no `ANDROID_HOME`, no Android SDK, and no emulator/device
  (`npx react-native doctor` confirms all of this — see `PHASE_ONE_REPORT.md`). A developer with a
  real Android Studio + SDK + JDK 17-20 + emulator/device setup needs to run `npm install` then
  `npx react-native run-android` to get a first real build/launch.
- No real backend — detection requests against the default URL will fail; this is expected.
- No camera capture (explicitly out of scope for Phase One per the gallery-only requirement).
- Confidence threshold setting is stored and sent with requests but has no effect until a real
  backend implements support for it.
- `DetectionOverlay` coordinate math is unit-tested but has not been visually verified against a
  rendered device screen (no device/emulator available here).

## Next milestones

1. Stand up (or point at) a real detection backend; confirm/adjust the `/api/v1/detect` contract
   against it (field names, auth if any, error shapes) in `detectionService.ts` only.
2. On a machine with Android Studio/SDK/JDK, run `npx react-native run-android` and do a first
   real device/emulator verification pass (visual check of the overlay math, gallery picker
   permission flow on various Android versions, etc).
3. Decide remote vs. on-device inference; if on-device, add an ONNX Runtime/TFLite React Native
   binding and swap it in behind the same `DetectionService` interface — no other changes needed.
4. Add CI (lint + typecheck + test) once this becomes a tracked git repository.
