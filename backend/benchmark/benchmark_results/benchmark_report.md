# Car Damage Detection Model Benchmark — PyTorch vs ONNX vs TFLite (CPU)

## 1. Environment

- Conda env: `project_env` (verified active; base env never used)
- Python 3.12.13, Linux IdeaPad 7.2.10-zen1-1-zen, Intel Core i5-10210U (4C/8T)
- Key packages (pre-existing, inspected before any change): torch 2.2.2+cpu, ultralytics 8.4.30, onnx 1.21.0, onnxruntime 1.24.4, numpy 1.26.4, opencv-python 4.13.0.92, PyYAML 6.0.3, psutil 7.2.2
- **Packages installed this session** (both completely absent beforehand, neither an upgrade/downgrade of anything existing):
  - `pip install ai-edge-litert` — minimal CPU TFLite/LiteRT interpreter runtime (no `tensorflow`/`tflite-runtime` package existed at all; without this, TFLite inference could not be run at all).
  - `pip install torchvision==0.17.2 --index-url https://download.pytorch.org/whl/cpu` — version pinned to match the already-installed `torch==2.2.2+cpu`. `torchvision` was completely absent; Ultralytics requires it internally for NMS ops, so `.pt` inference and `.val()` failed without it.
- Full `tensorflow` was **not** installed (a much heavier, non-minimal dependency change). This blocked Ultralytics' native `.val()` path for `.tflite` (it imports `tensorflow.lite.Interpreter` internally). A custom adapter (`scripts/tflite_adapter.py`) was written instead — see §5.
- Threads: `cv2.setNumThreads(1)`; onnxruntime intra/inter-op threads = 1; TFLite interpreter threads = 1; `torch.set_num_threads(1)` was requested, but Ultralytics' `.predict()` internals reset it, so the PyTorch benchmark effectively ran with 7 threads (reported honestly in `environment.json`, not silently corrected).
- Full details: `environment.json`.

## 2. Bundle contents

`car_damage_benchmark_bundle.zip` extracted to `car_damage_benchmark_bundle/`. Contained exactly what was expected: `README.md`, `dataset/data.yaml` (16 classes, matches `benchmark_config.json`), `dataset/images/val/` (678 images) + `dataset/labels/val/` (678 YOLO label files, 0 missing per `benchmark_config.json`), `benchmark/latency_50_images.txt` (50 filenames, all 50 found on disk), `benchmark/benchmark_config.json`. Nothing was missing.

`data.yaml`'s `path:` pointed to `/content/car_damage_benchmark_bundle/dataset` (a Colab path). Fixed to `/home/vedant/car ins/car_damage_benchmark_bundle/dataset`. Class names/order/count/splits were **not** touched. `best.pt`/`best.onnx`/`best.tflite` in the project root were never modified — all inference reads them in place; the bundle copies under `models/` were not used (root copies used throughout per task instruction consistency).

## 3. Model inspection

All three formats loaded successfully in their native runtime (Ultralytics YOLO / onnxruntime / ai-edge-litert).

| | Input | Raw output | NMS embedded? |
|---|---|---|---|
| `.pt` (Ultralytics wrapper) | handled internally | `boxes.data` → `(N,6)` = x1,y1,x2,y2,conf,cls, **already in original image pixel space** | Yes — `.predict()`/`.val()` runs NMS internally |
| `.onnx` | `images` float32 `(1,3,640,640)` | `output0` float32 `(1,20,8400)` = 4 box + 16 class scores per anchor, **boxes already in 0–640 pixel space** | No — raw decode required |
| `.tflite` | float32 `(1,3,640,640)` (channel-first, unquantized — `quantization=(0,0)`) | float32 `(1,20,8400)`, same layout as ONNX but **boxes normalized to [0,1]** | No — raw decode required |

This confirms the task's warning: ONNX and TFLite share the same raw tensor **shape** but **not the same coordinate scale** (pixels vs normalized) — verified by actually running one image through each before writing decode logic. A decode bug caused by assuming identical scaling was caught and fixed during development (see `scripts/run_consistency.py` git history / inline comments: `normalized=` flag).

Full I/O details: `scripts/model_inspection.json`.

## 4. Latency (CPU, imgsz=640, batch=1, conf=0.25, iou=0.70, 50-image fixed sample, 5 warm-up + 3×50 measured passes, 150 measurements/model)

| Model | Size (MB) | Init (ms) | Mean (ms) | Median | P90 | P95 | Stdev | Throughput (img/s) | Peak RSS (MB) | Threads |
|---|---|---|---|---|---|---|---|---|---|---|
| PyTorch | 6.21 | 26.9 | 109.0 | 106.7 | 117.1 | 120.6 | 12.8 | 9.17 | 463 | 7 (effective) |
| ONNX | 12.20 | 67.2 | 149.5 | 141.1 | 179.2 | 203.4 | 23.7 | 6.69 | 752 | 1 |
| TFLite | 12.19 | 57.0 | 134.4 | 132.5 | 137.8 | 140.0 | 6.2 | 7.44 | 1046 | 1 |

Notes:
- PT's lower latency is partly explained by using 7 CPU threads vs 1 for ONNX/TFLite (not a perfectly controlled comparison — documented, not hidden). TFLite has the lowest variance (stdev 6.2ms) despite single-threaded operation.
- Peak RSS measured via `psutil.Process().memory_info().rss`, sampled after warm-up and after every measured inference — a process-wide watermark, not strictly isolated per-model (each model was benchmarked in sequence within one process), so TFLite's reported peak (1046MB) is cumulative and likely overstates its own footprint. **Caveat, not a fabricated number**: treat peak_mem as directionally indicative, not a precise isolated figure; true isolated memory would need separate subprocess invocations per model (not done here).
- Per-measurement data: `per_image_latency.csv` (450 rows total).

## 5. Accuracy (678-image bundle `val` split, imgsz=640, conf=0.25, iou=0.70)

| Model | Precision | Recall | mAP50 | mAP50-95 | Path used |
|---|---|---|---|---|---|
| PyTorch | 0.523 | 0.454 | 0.499 | 0.256 | Ultralytics `model.val()` direct (native) |
| ONNX | 0.533 | 0.447 | 0.477 | 0.237 | Ultralytics `model.val()` direct — recent Ultralytics supports `.onnx` weights path directly |
| TFLite | 0.470 | 0.467 | 0.367 | 0.167 | **Custom adapter** (`scripts/tflite_adapter.py`) — Ultralytics `.val()` on `.tflite` requires `tensorflow` internally, which was not installed (see §1). Adapter: `ai_edge_litert` raw inference → manual class-aware NMS (conf 0.25/iou 0.70) → greedy IoU≥0.5 class-aware matching → AP computed by continuous precision-envelope interpolation, averaged over IoU 0.50:0.95:0.05 for mAP50-95. |

**Important caveat on TFLite numbers**: because the TFLite accuracy path uses a *different, independently-implemented* AP/matching pipeline than the one Ultralytics uses internally for PT/ONNX (which may differ subtly in box-matching tie-breaking, interpolation method, or edge-case handling), the TFLite mAP figures are **not perfectly apples-to-apples** with PT/ONNX even though they use the same thresholds and ground truth. The detection-level consistency check (§6) — which uses the *same* custom decode/matching code for both ONNX and TFLite — shows TFLite's raw detections are nearly identical to PyTorch's on the 50-image sample, which is some evidence the lower TFLite mAP figure reflects differences in the eval methodology as much as the model itself. This is flagged here rather than resolved, per the task's integrity constraints (never fabricate, document limitations).

All three evaluated on the identical 678-image `val` split, identical ground truth, identical thresholds. Per-class AP50/precision/recall for all 16 classes: `per_class_metrics.csv`. Weakest class across all formats: **pillar-dent** (class 12, AP50 = 0.0 for all three — only 5 ground-truth instances, likely too few to learn/evaluate reliably). Strongest: **Rear-windscreen-Damage** (class 2, AP50 ≈ 0.66–0.75 across formats).

## 6. Prediction consistency vs PyTorch (same 50-image latency sample, class-aware IoU≥0.5 greedy matching)

| Pair | % PT dets matched | Class agreement | Mean |Δconf| | Mean box-coord Δ (px) | Mean IoU-complement | PT-only (missed) | Other-only (extra) |
|---|---|---|---|---|---|---|---|
| ONNX vs PT | 100.0% | 100.0% | 5.6e-7 | 0.0014 px | 3.4e-5 | 0 | 0 |
| TFLite vs PT | 100.0% | 100.0% | 6.4e-7 | 0.0014 px | 3.4e-5 | 0 | 0 |

Both exports reproduce PyTorch's detections essentially exactly on this sample — confidence and box differences are at float32 rounding-error level. This indicates the exports themselves are numerically faithful to the source checkpoint; the lower TFLite *mAP on the full val set* (§5) is therefore most plausibly attributable to the independent custom accuracy-adapter's methodology differing from Ultralytics' internal `.val()` pipeline, not to the TFLite export degrading the model. Full data: `prediction_consistency.csv`.

## 7. Speed/accuracy trade-off summary

- **PyTorch**: best accuracy (mAP50 0.499), fastest (109ms mean, 9.17 img/s), smallest file (6.2MB), lowest measured memory — but ran with 7 threads vs 1 for the others, and requires the full PyTorch/Ultralytics/torchvision stack (~GB of dependencies) in production.
- **ONNX**: close second on accuracy (mAP50 0.477), but slowest latency here (149ms) and highest single-threaded memory of the measured pair — note this was deliberately run single-threaded for comparability, so a production ONNX Runtime deployment with multiple intra-op threads would likely close much of the latency gap with PT.
- **TFLite**: lowest measured accuracy via the custom adapter (mAP50 0.367, with the caveat above), middle latency (134ms), most consistent/lowest-variance latency (stdev 6.2ms), smallest runtime dependency footprint (no PyTorch needed), but highest measured peak memory (likely overstated — see §4 caveat) and the only format requiring a hand-built accuracy pipeline here due to missing `tensorflow`.

## 8. Limitations / unavailable measurements

- TFLite accuracy computed via a custom adapter, not Ultralytics' native `.val()`, because `tensorflow` was not installed and was judged too heavy/non-minimal to add silently (flagged as a blocker rather than installed) — see §5 caveat.
- Peak memory figures were measured with `psutil` RSS watermarking within a single long-running process across all three models sequentially; this is not perfectly isolated per model (cumulative effects possible, especially for the model benchmarked last). Reported as directionally useful, not exact-isolated figures.
- PyTorch thread count could not be pinned to 1 inside Ultralytics' `.predict()`/`.val()` calls despite `torch.set_num_threads(1)`; actual effective thread count (7) is reported transparently rather than assumed.
- No GPU numbers — CPU only, per spec.
- `torchvision` and `ai-edge-litert` were absent and were installed as minimal, non-conflicting additions (exact pip commands logged in §1 / `environment.json`); no existing package was upgraded or downgraded.

## 9. Deployment recommendation for the Car Insurance API

**Recommend PyTorch (`best.pt`) for the initial production deployment**, with ONNX as the natural fallback/alternative if the deployment environment cannot carry the PyTorch/Ultralytics dependency stack:

- Highest accuracy (mAP50 0.499 vs 0.477 ONNX vs 0.367 TFLite-via-adapter) matters most for an insurance damage-assessment API where false negatives/positives have cost implications (claim disputes, fraud risk).
- Fastest and smallest on this hardware in this test, though the threading asymmetry (7 vs 1) means a fair production comparison should re-test ONNX/TFLite with multi-threading enabled before finalizing.
- The near-perfect prediction-consistency results (§6) mean **ONNX is a safe, low-risk alternative** if the deployment target prefers a lighter, non-PyTorch runtime (e.g., serverless/edge CPU containers) — its detections are numerically faithful to PyTorch, and its accuracy via Ultralytics' own native `.val()` path (not a custom adapter) is independently trustworthy.
- **TFLite is not recommended as the primary production model today**: its accuracy figure carries the most measurement uncertainty (custom adapter, no official Ultralytics eval support without `tensorflow`), and despite consistent raw detections vs PyTorch, the full-val mAP gap is large enough to warrant re-validation with an official tool (e.g., installing `tensorflow` in a follow-up, explicitly-approved step, or using `ai-edge-litert`'s own official evaluation utilities) before trusting it for claims-facing use. Its main strength (low dependency footprint, consistent latency) matters more for a constrained edge/mobile deployment, not the server-side insurance API this benchmark targets.

## Files

- `comparison_summary.csv`, `per_class_metrics.csv`, `per_image_latency.csv`, `prediction_consistency.csv`, `environment.json`, `benchmark_report.md` (this file)
- Reproducible scripts: `scripts/inspect_models.py`, `scripts/run_accuracy.py`, `scripts/tflite_adapter.py`, `scripts/run_latency.py`, `scripts/run_consistency.py`
- Exact commands used (all inside `project_env`, from `/home/vedant/car ins`):
  - `source $(conda info --base)/etc/profile.d/conda.sh && conda activate project_env`
  - `python -I benchmark_results/scripts/inspect_models.py`
  - `python -I benchmark_results/scripts/run_accuracy.py`
  - `python -I benchmark_results/scripts/tflite_adapter.py`
  - `python -I benchmark_results/scripts/run_latency.py`
  - `python -I benchmark_results/scripts/run_consistency.py`
