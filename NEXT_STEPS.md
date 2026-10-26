# CarDD YOLOv8n Android Application: Decision Record & Roadmap (`NEXT_STEPS.md`)

**Project:** CarDD YOLOv8n Car Damage Detection  
**Document Purpose:** Engineering decision record and actionable implementation roadmap transitioning the project from completed model optimization and CPU benchmarking into native Android mobile deployment.  
**Author:** Senior Computer Vision Deployment Engineering  
**Date:** 2026-10-26  
**Status:** Approved for Android Phase Execution  

---

## 1. Executive Summary

A six-class YOLOv8n model trained on a Kaggle-converted version of the CarDD vehicle damage dataset was benchmarked across three CPU inference runtimes: PyTorch (`best.pt`), ONNX Runtime (`yolov8n.onnx`), and TensorFlow Lite (`yolov8n.tflite`). 

**Benchmark Result:** TensorFlow Lite (LiteRT) utilizing the CPU XNNPACK delegate achieved the lowest end-to-end latency (**85.24 ms**) and highest throughput (**11.73 FPS**) on host CPU hardware with **zero degradation in detection quality** (identical mAP@50 of **70.56%** and mAP@50–95 of **55.73%** across all runtimes).

The repository already houses an initial React Native frontend application (`android/CarDamageDetection/`) migrated to the Expo Managed Workflow (Expo SDK 58, React Native 0.88, React 19). The next phase focuses strictly on freezing the validated model artifact, bridging local on-device LiteRT inference to the application layer, and validating prediction accuracy on physical Android devices.

---

## 2. Locked Engineering Decisions

### Decision A: Primary Inference Runtime
* **Current Preferred Runtime:** **TensorFlow Lite (LiteRT) with CPU inference via XNNPACK**.
* **Rationale:** Outperformed PyTorch (1.69× faster E2E) and ONNX Runtime (1.20× faster E2E) on the reference CPU benchmark while eliminating heavyweight framework dependencies.
* **Scope Boundary:** This preference is based on measured benchmark evidence on x86_64 host hardware. It is **not** an assumption that TFLite will automatically be fastest across all heterogeneous mobile hardware (ARM SoCs, mobile GPUs, or NPUs).
* **Documented Fallback:** **ONNX Runtime CPU Execution Provider** remains the official alternative if mobile build constraints require it.
* **Canonical Checkpoint:** `best.pt` remains the immutable PyTorch training and evaluation source artifact. It will not be modified or replaced.

### Decision B: Model Configuration & Inference Contract
* **Architecture Family:** YOLOv8n Detection Model.
* **Input Resolution:** `640 × 640`.
* **Number of Classes:** 6 damage categories.
* **Class ID Mapping:**
  - `0`: `dent`
  - `1`: `scratch`
  - `2`: `crack`
  - `3`: `glass shatter`
  - `4`: `lamp broken`
  - `5`: `tire flat`
* **Input Tensor Specification (TFLite):**
  - Tensor Shape: `[1, 640, 640, 3]` (Batch, Height, Width, Channels — BHWC layout).
  - Data Type: `float32` (FP32 baseline, unquantized).
  - Color Space: RGB (OpenCV BGR converted to RGB).
  - Normalization: Pixel values scaled to `[0.0, 1.0]` by dividing by `255.0`.
  - Resize Policy: Aspect-ratio preserving letterbox with bilinear interpolation and constant border padding `(114, 114, 114)`.
* **Output Tensor Specification & Coordinate Decoding:**
  - Raw Output Shape: `[1, 10, 8400]` (Transposed to `[8400, 10]`).
  - Layout: First 4 rows are bounding box coordinates `[cx, cy, w, h]`; subsequent 6 rows are sigmoid-activated class probabilities.
  - **Coordinate Normalization Discovery:** TFLite exports coordinates **normalized to `[0.0, 1.0]`**, whereas PyTorch and ONNX output absolute pixels `[0, 640]`. Mobile postprocessing **must multiply TFLite coordinates by 640** before converting to `[x1, y1, x2, y2]`.
  - Unletterbox Transformation: Subtract letterbox padding offsets `(dw, dh)` and divide by the scale factor `r = min(640 / h0, 640 / w0)`. Clip coordinates to original image bounds `[w0, h0]`.
  - Detection Thresholds: Confidence threshold $\ge 0.25$; Non-Maximum Suppression (NMS) IoU threshold $\le 0.45$; Maximum detections $= 300$.

### Decision C: CPU Benchmark Reference Measurements

These measurements represent empirical results obtained from the dedicated host benchmark environment (Intel Core i5-10210U @ 1.60GHz, 4 physical cores / 8 threads, 8 GB RAM, Garuda Linux):

| Metric | PyTorch (CPU) | ONNX Runtime (CPU EP) | TFLite + XNNPACK (CPU) | Measured Advantage |
|---|---:|---:|---:|:---:|
| **Mean End-to-End Latency** | 143.71 ms | 102.66 ms | **85.24 ms** | **1.69× vs PyTorch** |
| **Mean Forward-Pass Latency** | 136.63 ms | 96.00 ms | **80.57 ms** | **1.70× vs PyTorch** |
| **Inference Throughput** | 6.96 FPS | 9.74 FPS | **11.73 FPS** | **+68.5% Throughput** |
| **P95 End-to-End Latency** | 227.56 ms | 131.17 ms | **110.14 ms** | **Most stable tail** |
| **Cold-Start Latency** | 198.72 ms | 125.12 ms | **74.29 ms** | **Fastest first inference** |
| **Model File Size** | 6.20 MB | 12.19 MB | 12.20 MB | Small mobile footprint |
| **Peak Process RSS Memory** | 432.7 MB | 499.8 MB | 486.2 MB | Stable memory usage |

*Note: These figures serve as an engineering reference baseline and are not mobile device performance guarantees.*

### Decision D: Detection-Quality Baseline

Measured on the 374-image held-out test split (785 ground-truth annotations):

* **mAP@50:** `70.56%` (across all three runtimes, zero conversion loss).
* **mAP@50–95:** `55.73%` (across all three runtimes).
* **Precision (at conf 0.25):** `68.74%`.
* **Recall (at conf 0.25):** `70.24%`.
* **Unmatched Ground-Truth Boxes (Misses):** `263 / 785`.
* **Unmatched Predictions (False Positives):** `294`.

#### Per-Class Performance Summary

| Class ID | Class Name | Ground-Truth Instances | AP@50 | AP@50–95 | Class Status & Mobile Notes |
|:---:|:---|:---:|---:|---:|:---|
| 0 | `dent` | 236 | 57.63% | 32.45% | Moderate; often co-located with surface scratches. |
| 1 | `scratch` | 307 | 57.30% | 31.96% | High variance; shallow scratches need clear lighting. |
| 2 | `crack` | 70 | 37.97% | 21.77% | **Weakest class**; bumper panel gaps generate false positives. |
| 3 | `glass shatter` | 71 | 99.07% | 94.16% | **Dataset Anomaly**; see critical limitation note below. |
| 4 | `lamp broken` | 69 | 81.51% | 67.06% | Strong; distinct headlight/taillight geometry. |
| 5 | `tire flat` | 32 | 89.87% | 86.98% | Highest precision; high wheel-rim contrast. |

#### Critical Dataset Limitation (Section 9 Analysis)
* **Glass Shatter Annotation Anomaly:** `23 of 71` test annotations for `glass shatter` cover more than `80%` of the image canvas.
* **Engineering Impact:** High AP scores (99.07% AP@50) are an artifact of image-spanning ground-truth boxes in the Kaggle conversion, which make IoU overlap trivially easy to achieve. **This score does not prove fine-grained glass fracture localization.** The mobile app must treat glass damage as an area-level warning.
* **Priority Weak Classes:** `crack`, `scratch`, and `dent` are the primary sources of false positives and misses.

### Decision E: Immediate Development Priority
The immediate priority is to build and validate the Android app using the current exported FP32 model (`yolov8n.tflite`). Additional model retraining, INT8 quantization, or architecture modifications are explicitly deferred until the first mobile prototype is operational and profiled on physical devices.

---

## 3. Current Project Status

### Completed Work (Verified by Repository Evidence)
- [x] **YOLOv8n Training & Checkpoint:** Source checkpoint verified at `benchmark/cardd_cpu_benchmark/models/best.pt`.
- [x] **Model Exports:**
  - ONNX model exported at `benchmark/cardd_cpu_benchmark/models/yolov8n.onnx` (Opset 17, simplified).
  - TFLite model exported at `benchmark/cardd_cpu_benchmark/models/yolov8n.tflite` (FP32 baseline, `onnx2tf`).
  - Export metadata recorded in `benchmark/cardd_cpu_benchmark/models/export_metadata.json`.
- [x] **Dataset Isolation & Integrity:** 374 test images and 374 labels extracted to `benchmark/cardd_cpu_benchmark/dataset/`; all 374 SHA-256 hashes verified against `manifest.json`.
- [x] **CPU Runtime Benchmarking:** Full statistical comparison of PyTorch, ONNX, and TFLite executed across 3 repetitions and recorded in `benchmark/cardd_cpu_benchmark/results/benchmark_summary.csv`.
- [x] **Detection Quality Evaluation:** Full mAP and per-class metrics computed and stored in `benchmark/cardd_cpu_benchmark/results/per_class_metrics.csv` and `evaluation_summary.json`.
- [x] **Visual Evidence Generated:** Timing charts (`timing_plots.png`), confusion matrices (`confusion_matrix_*.png`), and annotated sample detections in `predictions/annotated_examples/`.
- [x] **Mobile UI Skeleton Migrated:** `android/CarDamageDetection/` migrated to Expo SDK 58 Managed Workflow (`app.json`, TypeScript, `expo-image-picker`, React Navigation), documented in `android/EXPO_MIGRATION_REPORT.md`.

### Pending Work
- [ ] Packaging the verified `.tflite` model and metadata into the mobile application structure.
- [ ] Implementation of the native Android on-device inference bridge using LiteRT / TensorFlow Lite.
- [ ] Integration of the validated preprocessing (letterbox + normalizer) and postprocessing (TFLite coordinate scaler + NMS) pipeline into the mobile application layer.
- [ ] Real-device regression testing and hardware-specific latency/memory profiling.

---

## 4. Next Three Steps: Execution Roadmap

### Step 1: Freeze and Package the Model Artifact

**Objective:** Establish an immutable, checksum-verified model package and regression dataset for mobile integration.

* **Tasks:**
  - [ ] **Verify Artifact Provenance:** Confirm `benchmark/cardd_cpu_benchmark/models/yolov8n.tflite` as the single source of truth:
    - Path: `benchmark/cardd_cpu_benchmark/models/yolov8n.tflite`
    - File Size: `12,796,260 bytes` (~12.20 MB)
    - SHA-256: `8c68a48dd599131a2f75d3773b1ed44d903f8d202575ddbe5b8fce62e74aa547`
  - [ ] **Bundle Asset Contract:** Create a dedicated model asset directory inside the mobile workspace (e.g., `android/CarDamageDetection/assets/model/`):
    - Copy `yolov8n.tflite`.
    - Generate a companion `model_manifest.json` locking the class list, input tensor dimensions `[1, 640, 640, 3]`, output shape `[1, 10, 8400]`, normalization constant `255.0`, coordinate multiplier `640.0`, default confidence threshold `0.25`, and NMS IoU threshold `0.45`.
  - [ ] **Establish Regression Golden Set:** Select 5 representative test images from `benchmark/cardd_cpu_benchmark/dataset/test/images/` covering all 6 classes:
    - `000012.jpg` (tire flat — class 5, conf 0.9548)
    - `000015.jpg` (scratch — class 1, conf 0.5764)
    - `000023.jpg` (dent — class 0, conf 0.7124)
    - `000033.jpg` (lamp broken — class 4, multi-detection)
    - `000040.jpg` (crack — class 2)
  - [ ] **Export Expected Regression Outputs:** Store the reference detection coordinates and confidence scores for these 5 images in `assets/model/regression_golden.json` for automated comparison.
  - [ ] **Retain Reference Checkpoints:** Ensure `best.pt` (`2cd24da...`) and `yolov8n.onnx` (`81ec7a7...`) remain untouched as reference fallback assets.

* **Acceptance Criteria:**
  1. The mobile model artifact is verifiable against SHA-256 `8c68a48dd599...`.
  2. A machine-readable `model_manifest.json` specifies all tensor metadata and preprocessing contracts.
  3. Five regression images and their reference prediction outputs are bundled without ground-truth labels.
  4. No existing model file in `benchmark/` is altered or overwritten.

---

### Step 2: Build the Android Application Skeleton & Inference Boundary

**Objective:** Wire a modular, testable inference interface into the existing React Native / Expo application (`android/CarDamageDetection/`), isolating native model execution from UI components.

* **Tasks:**
  - [ ] **Evaluate Native Bridge Approach:** Review compatibility for loading the local `.tflite` model in Expo SDK 58 / React Native 0.88:
    - Option 1 (Native Module / Prebuild): Use `expo prebuild` / config plugins with an Android native module wrapping `com.google.ai.edge.litert:litert` (or `org.tensorflow:tensorflow-lite`).
    - Option 2 (Maintained Community Library): Evaluate `react-native-fast-tflite` or ONNX Runtime React Native for React Native 0.88 compatibility.
    - *Decision Gate:* Test build feasibility in a standalone test harness before modifying core app screens.
  - [ ] **Implement Local `DetectionService`:** Replace the placeholder HTTP service in `android/CarDamageDetection/src/features/inspection/services/detectionService.ts` with a decoupled `LocalDetectionService` adhering to the existing `DetectionService` TypeScript interface:
    ```typescript
    export interface DetectionService {
      analyzeImage(imageUri: string, options?: DetectionRequestOptions): Promise<DetectionResult>;
      checkHealth(): Promise<boolean>;
    }
    ```
  - [ ] **Implement Pure-JS Transformation Layer:**
    - Letterbox utility: Scaled aspect-ratio calculation and canvas padding.
    - Coordinate unletterbox utility: Rescaling bounding boxes `[x1, y1, x2, y2]` back to original image dimensions.
    - Class-specific Non-Maximum Suppression (NMS) algorithm matching the Python reference implementation.
  - [ ] **Connect UI Screens to Local Inference:**
    - `ImageSelectionScreen.tsx`: Select or capture car photo via `expo-image-picker`.
    - `DetectionProgressScreen.tsx`: Display progress state machine (`loading_model` $\rightarrow$ `preprocessing` $\rightarrow$ `running_inference` $\rightarrow$ `postprocessing`).
    - `DetectionResultsScreen.tsx`: Render detected damage summary, confidence chips, and interactive bounding box overlays.
  - [ ] **Handle Error & Fallback States:** Gracefully handle out-of-memory (OOM) conditions, unreadable images, zero-detection scenarios, and runtime init failures.

* **Acceptance Criteria:**
  1. The UI layer communicates strictly through the `DetectionService` contract with zero direct model dependencies in components.
  2. The inference layer is swappable (allowing ONNX Runtime or Mock fallback without UI alterations).
  3. Preprocessing, coordinate scaling (`× 640`), and NMS logic are implemented and covered by unit tests.
  4. The application builds and launches without bundling Python or external backend requirements.

---

### Step 3: Integrate and Validate on Real Android Devices

**Objective:** Verify that on-device LiteRT inference executes accurately, stably, and with acceptable latency on physical Android hardware.

* **Tasks:**
  - [ ] **Deploy to Physical Test Devices:** Install the application on at least two distinct Android devices (e.g., mid-range and high-end ARM64 devices).
  - [ ] **Execute Golden Regression Suite:** Run inference on the 5 regression images packaged in Step 1:
    - Compare detected bounding boxes, class labels, and confidence scores against `regression_golden.json`.
    - Tolerance limit: Coordinates must align within $\pm 3.0$ pixels of reference; confidence scores must match within $\pm 0.02$.
  - [ ] **Measure Mobile Performance Profile:**
    - Model initialization / load latency (ms).
    - Cold-start inference latency (ms).
    - Steady-state warm inference latency (ms).
    - End-to-end user-perceived latency (image capture to bounding box render).
    - Peak Android process RAM (PSS / RSS via Android Profiler).
  - [ ] **Edge-Case & Robustness Testing:**
    - Test diverse aspect ratios (16:9, 4:3, 1:1) and high-resolution camera captures (e.g., 12 MP / 48 MP photos).
    - Validate correct box alignment after letterbox reversal on vertical vs. horizontal orientations.
    - Test sustained multi-image inspections to detect memory leaks or thermal throttling.
  - [ ] **Document Mobile Performance Reality:** Record actual device metrics in `MOBILE_VALIDATION_REPORT.md`. Do not assume desktop CPU benchmark numbers transfer directly to mobile chips.

* **Acceptance Criteria:**
  1. Model executes fully on-device on a physical Android handset with no network connection.
  2. Regression suite predictions match desktop reference outputs within documented tolerances.
  3. Bounding boxes render accurately aligned over actual vehicle damage on the original image.
  4. Cold-start, warm inference, and memory profiles are recorded and documented with device specifications.
  5. Known model limitations (cracks, shallow scratches, glass shatter boundary) are documented in the user-facing release notes.

---

## 5. Explicitly Out of Scope for Initial Android Prototype

The following initiatives are deferred until the initial on-device prototype is fully functional and profiled:

* **Model Retraining:** Re-training YOLOv8n or altering loss functions.
* **Quantization & Pruning:** INT8 Post-Training Quantization (PTQ), FP16 half-precision, or Quantization-Aware Training (QAT).
* **Hardware Acceleration (NNAPI / GPU / NPU):** Initial Android validation will use CPU XNNPACK only. GPU/NNAPI delegates will be evaluated in a later phase.
* **Backend Cloud API:** Cloud sync, user authentication, multi-tenant databases, or remote server inference.
* **Insurance Claim Workflows:** Repair cost estimation, PDF report generation, and claims adjustor management.
* **Google Play Release:** Production code obfuscation (ProGuard), app store signing, and distribution hardening.

---

## 6. Definition of Done for Initial Android Prototype

The Android CarDD application prototype will be declared **Done** when all the following conditions are met:

1. **Standalone Local Inference:** The user can pick or take a car photo and receive bounding box detections entirely offline on an Android device.
2. **Numeric Fidelity:** Bounding boxes and confidence scores match the reference `yolov8n.tflite` outputs within $\pm 3$ pixels on the 5 regression images.
3. **Visual Alignment:** Rendered SVG/Canvas bounding boxes correctly overlay the physical damage regardless of camera resolution or aspect ratio.
4. **Performance Target:** End-to-end mobile processing time on a modern mid-range Android phone is under **350 ms**.
5. **Stability:** Zero crashes or Out-Of-Memory exceptions across 20 consecutive image evaluations.
6. **Documentation:** A completed `MOBILE_VALIDATION_REPORT.md` documenting device models, Android OS versions, measured latencies, and limitations.

---

## 7. Change Log

| Date | Author | Summary of Changes |
|---|---|---|
| **2026-10-26** | Senior CV Deployment Engineer | **Document Created.** Recorded final selection of **TensorFlow Lite (LiteRT + XNNPACK)** following the 3-runtime CPU benchmark (85.24 ms E2E, 11.73 FPS). Established model metadata, class mapping, Kaggle glass-shatter limitation analysis, and defined the 3-step execution roadmap for Android mobile integration. |
