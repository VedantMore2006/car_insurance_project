# Implementation Plan — Car Damage Detection RN App (Phase One)

## Step 1/2 — Inspection findings (2026-10-24)

- No existing RN/Expo project, no `package.json`, no `android/`/`ios/` prior to this task.
- Existing assets at project root: `best.pt`, `best.onnx`, `best.tflite` (left untouched), plus
  `benchmark_results/`, `car_damage_benchmark_bundle/`, `runs/` (benchmark artifacts — not touched).
- Class order source of truth: `car_damage_benchmark_bundle/dataset/data.yaml` — confirmed identical
  to the 16 classes listed in the task brief, in the same order. Used verbatim in `src/config/damageClasses.ts`.
- No existing backend code anywhere in the repo. There is **no real API** to integrate against.
  `detectionService` therefore targets a **proposed, currently-unimplemented** contract
  (`POST /api/v1/detect`, `GET /health`) against a user-configured base URL. This is explicitly
  documented as not-yet-live in README.md and Settings screen copy.
- Toolchain found in this environment:
  - Node: v26.12.0, npm: 12.2.1 — present.
  - Java: **not installed** (`java -version` → command not found).
  - `ANDROID_HOME`: unset. `adb` binary exists on PATH but with no SDK/emulator behind it.
  - No emulator/device available.
  - Consequence: Gradle/Android native build (`npx react-native run-android`) **cannot be executed
    or verified in this environment**. This is called out explicitly rather than assumed to work.
- Chose React Native **0.74.5** (stable, not bleeding-edge) with the official TypeScript template via
  `@react-native-community/cli init`, since Node 26 and npm 12 are new enough to support it and no
  conflicting older toolchain constraint was found (Java/Gradle version can't be checked here, but
  0.74.x is widely compatible with JDK 17, which is what a real dev machine would install).

## Plan

1. Scaffold RN CLI TS project `CarDamageDetection/` under project root (done).
2. Install: React Navigation (native-stack + bottom-tabs) + screens/safe-area-context peer deps,
   `react-native-image-picker` (gallery only), `@react-native-async-storage/async-storage`.
   No axios, no Redux, no camera permission, no analytics/auth.
3. Build `src/` feature-oriented tree per spec, each file real and imported.
4. Wire navigation: bottom tabs (Dashboard/History/Settings) + a stack for the inspection flow
   (Image Selection → Preview → Progress → Results), pushed from Dashboard.
5. `detectionService` is a real `fetch`-based HTTP client hitting a configurable base URL, with
   typed errors (`DetectionServiceError` with kind: `network|timeout|server|parse|validation|cancelled`).
   It does not fabricate results — on any failure it rejects with a typed error, never a fake success.
6. `useDetection` hook models explicit lifecycle states and guards against duplicate requests / stale
   results / stale retries.
7. Theme: dark charcoal/navy, electric-blue accent, status colors, spacing/radius tokens.
8. `.env.example` with `API_BASE_URL` (placeholder, not a real machine IP) — README explains
   localhost-on-device pitfall.
9. Jest tests for the areas listed in the spec, using RN template's Jest, all mocked (no real network).
10. Verification commands run and their *actual* results recorded in `PHASE_ONE_REPORT.md`
    (not assumed). Android run/build explicitly left **UNVERIFIED** with reasons and exact steps
    a developer with a real SDK/emulator needs to follow.
11. `README.md` + this plan + `PHASE_ONE_REPORT.md` retained as historical record.

No backend exists yet; model deployment (on-device vs remote) decision is deliberately deferred and
isolated behind `DetectionService` so only `detectionService.ts` needs to change later.
