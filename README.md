# Car Insurance Project — Car Damage Detection

AI-assisted vehicle damage inspection: a YOLOv8-based computer vision model plus an Android client for submitting vehicle photos and reviewing detected damage.

## Structure

```
car insurance project/
├── android/    # React Native (CLI, TypeScript) Android app — CarDamageDetection/
├── backend/    # Model artifacts + benchmark results (CV workstream); inference API not yet built
└── frontend/   # Reserved for a future web frontend; empty for now
```

### `android/`

The Android client, `CarDamageDetection/`. React Native CLI + TypeScript, not Expo. Implements the full inspection workflow UI (dashboard, image selection/preview, detection progress/results, history, settings) against a `DetectionService` interface that is not yet wired to a live backend. See `android/CarDamageDetection/README.md`, `IMPLEMENTATION_PLAN.md`, and `PHASE_ONE_REPORT.md` for what's implemented, what's verified, and what's still outstanding (notably: no Android SDK/emulator has been available to actually run the app in this environment yet).

### `backend/`

Not implemented yet. Currently holds the exported model checkpoints (`model/best.pt`, `.onnx`, `.tflite`) and their CPU benchmark results (`benchmark/`). See `backend/README.md`. A real inference service (FastAPI or equivalent) will live here later, exposing the `POST /api/v1/detect` / `GET /health` contract the Android app already anticipates.

### `frontend/`

Empty placeholder for a possible future web frontend. Not needed for the current phase.

## Status

- [x] CV model trained, exported to three formats, and benchmarked on CPU (see `backend/benchmark/benchmark_results/benchmark_report.md`).
- [x] Android app foundation (Phase One): navigation, screens, state management, detection-service abstraction, local history/settings persistence — implemented and unit-tested, Android build/launch unverified in this environment.
- [ ] Backend inference API — not started.
- [ ] Web frontend — not started, not currently needed.

## Next steps

See the Android app's `PHASE_ONE_REPORT.md` for the detailed next-steps list on the client side; backend implementation is the next major piece of work once the client foundation is confirmed on a real device/emulator.
