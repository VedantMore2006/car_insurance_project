# CarDD YOLOv8n CPU Runtime Benchmark & Deployment Report

**Author:** Senior Computer Vision Deployment Engineer  
**Date:** October 26, 2026  
**Target Hardware:** CPU-only VPS deployment  
**Target Architecture:** x86_64 CPU (Tested on Intel Core i5-10210U @ 1.60GHz, 4 physical cores / 8 threads, 8 GB RAM)  
**Dataset:** Kaggle-converted CarDD held-out test split (374 images, 785 ground-truth annotations, 6 damage classes)  

---

## 1. Executive Summary & Deployment Recommendation

### Primary Recommendation: **TensorFlow Lite (LiteRT with CPU XNNPACK)**
- **Fastest End-to-End Latency:** **85.24 ms** per image (compared to **102.66 ms** for ONNX Runtime and **143.71 ms** for PyTorch).
- **Highest Throughput:** **11.73 FPS** (1.69× throughput of PyTorch and 1.20× throughput of ONNX Runtime).
- **Forward Pass Latency:** **80.57 ms** mean (73.82 ms median).
- **Detection Quality:** **Zero degradation.** Exactly identical detection metrics down to sub-pixel coordinates across all 6 damage classes (mAP@50: **70.56%**, mAP@50–95: **55.73%**).
- **Cold Start:** **74.29 ms** (fastest cold start among all runtimes).
- **Secondary Deployment Option (ONNX Runtime CPU EP):** If minimal Docker image footprint and standard C++/Python interoperability are preferred without TensorFlow build dependencies, **ONNX Runtime CPU EP** is an outstanding alternative delivering **102.66 ms E2E** (9.74 FPS) with identical accuracy.

### Benchmark Summary Table

| Metric | PyTorch (CPU) | ONNX Runtime (CPU EP) | TensorFlow Lite (CPU + XNNPACK) | Best Runtime |
|---|:---:|:---:|:---:|:---:|
| **Model File Size** | 6.20 MB | 12.19 MB | 12.20 MB | PyTorch (weights only) |
| **Model Load Time** | 0.088 s | 0.105 s | 0.092 s | PyTorch |
| **Cold Start Latency** | 198.72 ms | 125.12 ms | **74.29 ms** | **TensorFlow Lite** |
| **Preprocessing Mean** | 5.95 ms | 5.50 ms | **3.47 ms** | **TensorFlow Lite** |
| **Forward Pass Mean** | 136.63 ms | 96.00 ms | **80.57 ms** | **TensorFlow Lite** (1.70× faster) |
| **Forward Pass Median** | 121.01 ms | 92.68 ms | **73.82 ms** | **TensorFlow Lite** |
| **Forward Pass P95** | 218.27 ms | 123.22 ms | **105.20 ms** | **TensorFlow Lite** |
| **Postprocessing (NMS)** | 1.13 ms | 1.16 ms | 1.20 ms | Parity (~1.1–1.2 ms) |
| **End-to-End Latency Mean** | 143.71 ms | 102.66 ms | **85.24 ms** | **TensorFlow Lite** (1.69× faster) |
| **End-to-End Latency Median**| 127.99 ms | 99.15 ms | **78.54 ms** | **TensorFlow Lite** |
| **End-to-End Latency P95** | 227.56 ms | 131.17 ms | **110.14 ms** | **TensorFlow Lite** |
| **Throughput (FPS)** | 6.96 FPS | 9.74 FPS | **11.73 FPS** | **TensorFlow Lite** (+68.5%) |
| **Peak RSS Memory** | **432.7 MB** | 499.8 MB | 486.2 MB | PyTorch |
| **Test Set mAP@50** | **70.56%** | **70.56%** | **70.56%** | **Exact Parity** |
| **Test Set mAP@50–95** | **55.73%** | **55.73%** | **55.73%** | **Exact Parity** |
| **Precision / Recall (Conf 0.25)**| 68.74% / 70.24% | 68.74% / 70.24% | 68.74% / 70.24% | **Exact Parity** |

---

## 2. Hardware and Environment Profile

All benchmarks were conducted natively on the target host hardware without background interference.

- **Operating System:** Linux 7.2.10-zen1-1-zen (Garuda Linux x86_64, glibc 2.44)
- **CPU Model:** Intel® Core™ i5-10210U CPU @ 1.60GHz (Turbo boost up to 4.20 GHz)
- **Cores & Threads:** 4 Physical Cores, 8 Logical Threads (2 threads/core)
- **System Memory:** 7.49 GiB Total Physical RAM, 16.29 GiB Swap
- **Available Disk Space:** 91.45 GiB free on `/home`
- **GPU Status:** Integrated Intel UHD Graphics GT2 (rev 02); CUDA unavailable. Execution strictly CPU-only.
- **Python Runtime:** Python 3.12.13 (in isolated Conda environment `project_env`)
- **Key Installed Packages:**
  - `torch==2.2.2+cpu`, `torchvision==0.17.2+cpu`
  - `ultralytics==8.4.30`
  - `onnx==1.21.0`, `onnxruntime==1.24.4`, `onnxslim==0.1.90`
  - `tensorflow==2.19.0`, `tf_keras==2.19.0`, `onnx2tf==1.28.8`, `ai-edge-litert==2.3.0`
  - `opencv-python==4.13.0.92`, `numpy==1.26.4`, `pandas==3.0.1`, `matplotlib==3.10.8`

---

## 3. Dataset Integrity & Isolation Verification

The evaluation test set from `cardd_test_images_and_labels.zip` was extracted to `cardd_cpu_benchmark/dataset/`:

1. **Integrity Check:**
   - 374 image files in `test/images/` and 374 annotation files in `test/labels/` (100% 1-to-1 match).
   - All 374 image SHA-256 hashes matched the hash entries in `manifest.json`.
   - Zero corrupted files, zero syntax errors, and zero out-of-bounds normalized coordinates in any annotation file.
2. **Ground-Truth Instances:**
   - Total test bounding boxes: **785 instances**.
   - Class breakdown:
     - `dent` (Class 0): 236
     - `scratch` (Class 1): 307
     - `crack` (Class 2): 70
     - `glass shatter` (Class 3): 71
     - `lamp broken` (Class 4): 69
     - `tire flat` (Class 5): 32
3. **Strict Isolation Policy:**
   - Ground-truth labels were isolated exclusively for evaluation.
   - Inference runners received purely raw image pixels. No labels or dataset statistics were used during preprocessing, inference, or postprocessing.

---

## 4. Kaggle CarDD Dataset Limitation Analysis (Section 9)

An essential discovery during dataset auditing confirmed the critical caveat highlighted in Section 9:
- **71 ground-truth annotations** in the test set belong to class 3 (`glass shatter`).
- **23 of these 71 boxes (32.4%) span >80% of the entire image canvas**, with several bounding boxes covering 95%–99% of the frame.
- **Impact on Evaluation Metrics:**
  - Class 3 achieved **99.07% AP@50** and **94.16% AP@50–95**, with **97.18% recall**.
  - Because nearly the entire image is marked as a single large bounding box, any broad detection on the vehicle window achieves an artificially inflated IoU overlap (>0.50 and even >0.85).
  - **Engineering Caution:** This high AP score does **not** indicate sub-centimeter edge localization of broken glass shards; rather, it reflects an image-level or panoramic bounding box convention inherited from the Kaggle dataset conversion. Production damage estimation engines should treat `glass shatter` as a region-level indicator rather than precision point localization.

---

## 5. Model Export & Cross-Runtime Parity Verification

Using `cardd_cpu_benchmark/models/best.pt` (6.2 MB), two derived runtime formats were exported at 640×640 input resolution:

1. **ONNX Export (`yolov8n.onnx`):**
   - Exported with ONNX opset 17, simplified with `onnxslim`.
   - Input shape: `(1, 3, 640, 640)` (BCHW, RGB, normalized `/ 255.0`).
   - Output shape: `(1, 10, 8400)` (4 coordinate channels + 6 class probability channels across 8,400 anchors).
   - File size: **12.19 MB**. Export duration: **2.76 s**.
2. **TensorFlow Lite Export (`yolov8n.tflite`):**
   - Exported to FP32 baseline via TensorFlow 2.19.0 and `onnx2tf` (no INT8 quantization).
   - Input shape: `(1, 640, 640, 3)` (BHWC, RGB, normalized `/ 255.0`).
   - Output shape: `(1, 10, 8400)`.
   - File size: **12.20 MB**. Export duration: **17.87 s**.
3. **Critical Postprocessing Discovery & Parity Alignment:**
   - Verification of raw output tensors revealed that **TFLite normalized its bounding box coordinates `[cx, cy, w, h]` to `[0, 1]`**, whereas ONNX and PyTorch output coordinates in absolute pixels `[0, 640]`.
   - Adapting the unified decoder to scale TFLite box coordinates by 640 before unletterboxing resulted in **identical predictions across PyTorch, ONNX Runtime, and TFLite down to 0.005 pixels**.
   - Sample cross-validation on `000012.jpg`:
     - PyTorch: `Class 5 (tire flat), Conf 0.9548, Box [26.4, 218.3, 359.2, 554.1]`
     - ONNX Runtime: `Class 5 (tire flat), Conf 0.9548, Box [26.4, 218.3, 359.2, 554.1]`
     - TensorFlow Lite: `Class 5 (tire flat), Conf 0.9548, Box [26.4, 218.3, 359.2, 554.1]`

---

## 6. Comprehensive Latency & Throughput Benchmark

The benchmark was executed with batch size 1, across all 374 test images, repeated 3 independent times (total 1,122 inferences per runtime, preceded by 20 warm-up cycles), with CPU threads locked to 4 (`intra_op_num_threads=4` for ONNX, `set_num_threads(4)` for TFLite and PyTorch).

### Latency Breakdown by Stage (Milliseconds per Image)

```
+---------------------------------------------------------------------------------------+
| Stage                      | PyTorch (CPU)    | ONNX Runtime (CPU) | TFLite (CPU+XNNPACK)     |
+----------------------------+------------------+--------------------+--------------------------+
| Preprocessing (Letterbox)  | 5.95 ms          | 5.50 ms            | 3.47 ms                  |
| Forward Model Pass         | 136.63 ms        | 96.00 ms           | 80.57 ms                 |
| Postprocessing (NMS)       | 1.13 ms          | 1.16 ms            | 1.20 ms                  |
+----------------------------+------------------+--------------------+--------------------------+
| Total End-to-End Latency   | 143.71 ms        | 102.66 ms          | 85.24 ms                 |
| Throughput (FPS)           | 6.96 FPS         | 9.74 FPS           | 11.73 FPS                |
+---------------------------------------------------------------------------------------+
```

### Statistical Distribution (End-to-End Latency)

| Runtime | Mean (ms) | Median (ms) | P90 (ms) | P95 (ms) | Std Dev (ms) | Min (ms) | Max (ms) |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **PyTorch (CPU)** | 143.71 | 127.99 | 194.65 | 227.56 | 38.56 | 98.77 | 312.44 |
| **ONNX Runtime (CPU EP)** | 102.66 | 99.15 | 114.58 | 131.17 | 11.95 | 87.21 | 185.34 |
| **TensorFlow Lite (CPU)** | **85.24** | **78.54** | **106.19** | **110.14** | **14.43** | **72.10** | **156.88** |

### Key Latency Insights:
1. **Forward Pass Superiority:** TensorFlow Lite with its built-in XNNPACK CPU delegate achieves the lowest forward pass latency (**80.57 ms**), outperforming ONNX Runtime (**96.00 ms**, 16% slower) and PyTorch (**136.63 ms**, 70% slower).
2. **Jitter & Tail Latency:** ONNX Runtime displayed the lowest standard deviation (**11.95 ms**), but TFLite's P95 latency (**110.14 ms**) was significantly lower than ONNX's P95 (**131.17 ms**) and PyTorch's P95 (**227.56 ms**).
3. **Cold Start:** TFLite initiated inference on the first image in **74.29 ms**, compared to **125.12 ms** for ONNX and **198.72 ms** for PyTorch.

*(The latency comparison charts and boxplots are saved in [`timing_plots.png`](file:///home/vedant/car_insurance_project/benchmark/cardd_cpu_benchmark/results/timing_plots.png).)*

---

## 7. Detection Quality & Evaluation Results

The evaluation pipeline processed all 374 test images using standard COCO-style 101-point interpolated precision-recall evaluation across 10 IoU thresholds ($0.50 \le \text{IoU} \le 0.95$, step 0.05).

### Aggregate Metrics Comparison

| Runtime | Precision (%) | Recall (%) | mAP@50 (%) | mAP@50–95 (%) | Unmatched GT (Misses) | Unmatched Preds (FP) |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **PyTorch** | 68.74 | 70.24 | 70.56 | 55.73 | 263 / 785 | 294 |
| **ONNX Runtime** | 68.74 | 70.24 | 70.56 | 55.73 | 263 / 785 | 294 |
| **TensorFlow Lite** | 68.74 | 70.24 | 70.56 | 55.73 | 263 / 785 | 294 |

*Note: All three runtimes produce mathematically identical aggregate metrics down to the hundredth of a percent.*

### Per-Class Metrics Breakdown (Held-Out Test Set)

| Class ID | Class Name | Ground-Truth Count | Predictions | Precision (%) | Recall (%) | F1 Score (%) | AP@50 (%) | AP@50–95 (%) |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 0 | `dent` | 236 | 2,399 | 60.26 | 58.47 | 59.35 | 57.63 | 32.45 |
| 1 | `scratch` | 307 | 3,481 | 50.85 | 58.63 | 54.46 | 57.30 | 31.96 |
| 2 | `crack` | 70 | 1,795 | 41.33 | 44.29 | 42.76 | 37.97 | 21.77 |
| 3 | `glass shatter` | 71 | 174 | 88.46 | 97.18 | 92.62 | 99.07 | 94.16 |
| 4 | `lamp broken` | 69 | 196 | 81.25 | 75.36 | 78.20 | 81.51 | 67.06 |
| 5 | `tire flat` | 32 | 92 | 90.32 | 87.50 | 88.89 | 89.87 | 86.98 |
| **Overall** | **Macro Average** | **785** | **8,137** | **68.74** | **70.24** | **69.48** | **70.56** | **55.73** |

### Confusion Matrix Analysis (IoU $\ge$ 0.50, Conf $\ge$ 0.25)
Confusion matrix visualizations have been generated and saved:
- [`confusion_matrix_pt.png`](file:///home/vedant/car_insurance_project/benchmark/cardd_cpu_benchmark/results/confusion_matrix_pt.png)
- [`confusion_matrix_onnx.png`](file:///home/vedant/car_insurance_project/benchmark/cardd_cpu_benchmark/results/confusion_matrix_onnx.png)
- [`confusion_matrix_tflite.png`](file:///home/vedant/car_insurance_project/benchmark/cardd_cpu_benchmark/results/confusion_matrix_tflite.png)

**Key Observations:**
1. **Dent vs. Scratch Overlap:** `dent` (236 instances) and `scratch` (307 instances) are frequently co-located on body panels. The model occasionally confuses shallow elongated dents with wide surface scratches.
2. **Crack Challenges:** `crack` had the lowest AP@50 (37.97%) and highest background false positives due to subtle lighting variations on vehicle bumpers and panel gaps mimicking fine cracks.
3. **High Confidence Classes:** `tire flat` (AP@50 89.87%) and `lamp broken` (AP@50 81.51%) show distinct geometric features (wheels/headlights) and suffer minimal confusion with other classes.

---

## 8. Deployment Decision Matrix for CPU-Only VPS

| Evaluation Criterion | PyTorch (`best.pt`) | ONNX Runtime (`yolov8n.onnx`) | TensorFlow Lite (`yolov8n.tflite`) | Winning Option |
|---|:---:|:---:|:---:|:---:|
| **Inference Latency (E2E)** | 143.71 ms | 102.66 ms | **85.24 ms** | **TensorFlow Lite** |
| **Throughput (FPS)** | 6.96 FPS | 9.74 FPS | **11.73 FPS** | **TensorFlow Lite** |
| **Memory Footprint (RSS)** | **432.7 MB** | 499.8 MB | 486.2 MB | **PyTorch** |
| **Python Dependency Size** | ~800 MB (`torch`, `torchvision`) | **~35 MB** (`onnxruntime`, `numpy`) | **~45 MB** (`ai-edge-litert`, `numpy`) | **ONNX Runtime / LiteRT** |
| **Container Image Build** | Heavy / Slow | **Ultra-lightweight** | **Ultra-lightweight** | **ONNX Runtime / LiteRT** |
| **Accuracy Preservation** | Baseline | **100% Exact Parity** | **100% Exact Parity** | **Tie (All Identical)** |
| **Target VPS Recommendation** | Not Recommended | **Strong Contender** | **Primary Choice (Fastest)** | **TensorFlow Lite** |

### Final Engineering Verdict:
1. **Deploy TensorFlow Lite (LiteRT)** if your priority is **minimizing CPU inference latency and maximizing throughput** on budget VPS instances (e.g., 2 to 4 vCPUs). TFLite's integrated XNNPACK engine provides superior FP32 vectorization on x86_64 CPUs, achieving **85 ms per request** at **11.7 FPS**.
2. **Deploy ONNX Runtime** if your team prefers standard ONNX ecosystem tools, or if you plan to deploy C++ microservices without any TensorFlow/LiteRT dependencies. At **102 ms per request** (9.7 FPS), ONNX Runtime is also exceptionally competitive and vastly superior to PyTorch.
3. **Do Not Deploy PyTorch in Production on CPU VPS:** PyTorch requires >800 MB in container dependencies, uses more CPU cycles, and is **70% slower** (143.7 ms) without providing any accuracy advantage.

---

## 9. Instructions for Reproducing on CPU-Only VPS

### Step 1: Provision Environment
```bash
# In your VPS terminal (Ubuntu / Debian / Alpine / Arch):
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip

# Install lightweight runtime dependencies (Only ~50 MB total for TFLite deployment)
pip install ai-edge-litert opencv-python-headless numpy
```

*(For running the complete benchmark and export suite, install `pip install -r cardd_cpu_benchmark/requirements.txt`)*

### Step 2: Run Export Pipeline
```bash
python cardd_cpu_benchmark/scripts/export_models.py
```
Outputs:
- `cardd_cpu_benchmark/models/yolov8n.onnx`
- `cardd_cpu_benchmark/models/yolov8n.tflite`
- `cardd_cpu_benchmark/models/export_metadata.json`

### Step 3: Run CPU Latency Benchmark
```bash
# Benchmark with 4 CPU threads and 3 repetitions over the test set:
python cardd_cpu_benchmark/scripts/benchmark_runtimes.py --threads 4 --num-runs 3 --warmup 20
```
Outputs:
- `cardd_cpu_benchmark/results/benchmark_summary.csv`
- `cardd_cpu_benchmark/results/latency_summary.json`
- `cardd_cpu_benchmark/results/timing_plots.png`

### Step 4: Run Detection Quality Evaluation
```bash
python cardd_cpu_benchmark/scripts/evaluate_predictions.py
```
Outputs:
- `cardd_cpu_benchmark/results/per_class_metrics.csv`
- `cardd_cpu_benchmark/results/evaluation_summary.json`
- `cardd_cpu_benchmark/results/confusion_matrix_*.png`
- `cardd_cpu_benchmark/predictions/annotated_examples/`

---

## 10. Experiment Artifacts Index

All generated artifacts are organized inside `cardd_cpu_benchmark/`:
```
cardd_cpu_benchmark/
├── dataset/
│   ├── classes.json
│   ├── manifest.json
│   └── test/
│       ├── images/ (374 test images)
│       └── labels/ (374 YOLO labels)
├── models/
│   ├── best.pt (6.2 MB PyTorch checkpoint)
│   ├── yolov8n.onnx (12.19 MB ONNX opset 17)
│   ├── yolov8n.tflite (12.20 MB TFLite FP32)
│   └── export_metadata.json
├── predictions/
│   ├── predictions_pt.json
│   ├── predictions_onnx.json
│   ├── predictions_tflite.json
│   └── annotated_examples/
│       ├── annotated_000012.jpg
│       ├── annotated_000015.jpg
│       ├── annotated_000023.jpg
│       ├── annotated_000033.jpg
│       └── annotated_000040.jpg
├── results/
│   ├── benchmark_summary.csv
│   ├── per_class_metrics.csv
│   ├── latency_summary.json
│   ├── evaluation_summary.json
│   ├── environment.json
│   ├── timing_plots.png
│   ├── confusion_matrix_pt.png
│   ├── confusion_matrix_onnx.png
│   ├── confusion_matrix_tflite.png
│   └── experiment_report.md
└── requirements.txt
```
