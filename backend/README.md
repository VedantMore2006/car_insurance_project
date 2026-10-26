# Backend

Not implemented yet. This folder currently holds model artifacts and benchmark results from the CV workstream, kept separate from application code until a real backend service is built.

## Contents

- `model/` — exported YOLOv8n car-damage-detection checkpoints: `best.pt` (PyTorch), `best.onnx`, `best.tflite`. Do not modify or retrain these.
- `benchmark/` — CPU latency/accuracy benchmark results comparing the three export formats (`benchmark_results/`), the validation dataset bundle used for benchmarking (`car_damage_benchmark_bundle/`, `car_damage_benchmark_bundle.zip`), and raw Ultralytics run logs (`runs/`). See `benchmark/benchmark_results/benchmark_report.md` for full methodology and the deployment-format recommendation (PyTorch recommended primary, ONNX as fallback; TFLite needs re-validation).

## Planned

A FastAPI (or equivalent) inference service exposing something like:

- `POST /api/v1/detect` — multipart image upload, returns structured detections.
- `GET /health` — health check.

This contract is already anticipated by the Android app's `DetectionService` interface (`../android/CarDamageDetection/src/features/inspection/services/detectionService.ts`), so wiring up the real backend later should not require Android UI changes — only that service implementation.
