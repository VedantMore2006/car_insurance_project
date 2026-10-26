#!/usr/bin/env python3
"""
CarDD YOLOv8n CPU Runtime Benchmark
Compares:
1. PyTorch (best.pt)
2. ONNX Runtime CPU EP (yolov8n.onnx)
3. TensorFlow Lite CPU Interpreter (yolov8n.tflite)

Measures:
- Model load time
- Cold start latency
- Warm-up phase (>= 20 inferences)
- Preprocessing latency
- Forward inference latency
- Postprocessing (decode + NMS) latency
- End-to-end latency
- Throughput (FPS)
- Peak RSS memory (MB)
- Multi-run statistical stability (mean, median, p90, p95, std)
"""

import os
import sys
import time
import json
import argparse
import psutil
import cv2
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# PyTorch
import torch
from ultralytics import YOLO

# ONNX Runtime
import onnxruntime as ort

# TFLite
try:
    import ai_edge_litert.interpreter as tflite
except ImportError:
    import tensorflow.lite as tflite


def get_process_memory_mb():
    process = psutil.Process(os.getpid())
    return round(process.memory_info().rss / (1024 * 1024), 2)


def letterbox(im, new_shape=(640, 640), color=(114, 114, 114)):
    shape = im.shape[:2]  # [h, w]
    r = min(new_shape[0] / shape[0], new_shape[1] / shape[1])
    new_unpad = int(round(shape[1] * r)), int(round(shape[0] * r))
    dw, dh = (new_shape[1] - new_unpad[0]) / 2, (new_shape[0] - new_unpad[1]) / 2
    if shape[::-1] != new_unpad:
        im = cv2.resize(im, new_unpad, interpolation=cv2.INTER_LINEAR)
    top, bottom = int(round(dh - 0.1)), int(round(dh + 0.1))
    left, right = int(round(dw - 0.1)), int(round(dw + 0.1))
    im = cv2.copyMakeBorder(im, top, bottom, left, right, cv2.BORDER_CONSTANT, value=color)
    return im, r, (dw, dh)


def nms(boxes, scores, iou_threshold=0.45):
    x1, y1, x2, y2 = boxes[:, 0], boxes[:, 1], boxes[:, 2], boxes[:, 3]
    areas = (x2 - x1) * (y2 - y1)
    order = scores.argsort()[::-1]
    keep = []
    while order.size > 0:
        i = order[0]
        keep.append(i)
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        w = np.maximum(0.0, xx2 - xx1)
        h = np.maximum(0.0, yy2 - yy1)
        inter = w * h
        ovr = inter / np.maximum(areas[i] + areas[order[1:]] - inter, 1e-6)
        inds = np.where(ovr <= iou_threshold)[0]
        order = order[inds + 1]
    return keep


def decode_and_nms(raw_out, orig_shape, ratio, pad, conf_thresh=0.25, iou_thresh=0.45, max_det=300, is_normalized=False):
    # raw_out: shape (10, 8400)
    raw_out = raw_out.T  # (8400, 10)
    boxes = raw_out[:, :4].copy()
    if is_normalized:
        boxes *= 640.0
    scores = raw_out[:, 4:]
    cls_ids = np.argmax(scores, axis=1)
    max_scores = np.max(scores, axis=1)
    mask = max_scores >= conf_thresh
    if not np.any(mask):
        return np.empty((0, 6), dtype=np.float32)

    b = boxes[mask]
    s = max_scores[mask]
    c = cls_ids[mask]

    x1 = b[:, 0] - b[:, 2] / 2
    y1 = b[:, 1] - b[:, 3] / 2
    x2 = b[:, 0] + b[:, 2] / 2
    y2 = b[:, 1] + b[:, 3] / 2

    dw, dh = pad
    x1 = (x1 - dw) / ratio
    y1 = (y1 - dh) / ratio
    x2 = (x2 - dw) / ratio
    y2 = (y2 - dh) / ratio

    h0, w0 = orig_shape
    x1 = np.clip(x1, 0, w0)
    y1 = np.clip(y1, 0, h0)
    x2 = np.clip(x2, 0, w0)
    y2 = np.clip(y2, 0, h0)

    max_wh = 7680
    c_offset = c * max_wh
    boxes_offset = np.stack([x1 + c_offset, y1 + c_offset, x2 + c_offset, y2 + c_offset], axis=1)
    keep = nms(boxes_offset, s, iou_thresh)[:max_det]

    return np.stack([x1[keep], y1[keep], x2[keep], y2[keep], s[keep], c[keep]], axis=1)


class PyTorchRunner:
    def __init__(self, model_path, num_threads=4):
        self.model_path = model_path
        self.num_threads = num_threads
        torch.set_num_threads(num_threads)
        self.model = None

    def load(self):
        t0 = time.perf_counter()
        yolo = YOLO(self.model_path)
        self.model = yolo.model.eval()
        torch.set_num_threads(self.num_threads)
        return round(time.perf_counter() - t0, 4)

    def preprocess(self, img_bgr):
        im, r, pad = letterbox(img_bgr)
        rgb = cv2.cvtColor(im, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        tensor = torch.from_numpy(np.ascontiguousarray(rgb.transpose(2, 0, 1)[None]))
        return tensor, r, pad

    def forward(self, preprocessed_tensor):
        with torch.no_grad():
            out = self.model(preprocessed_tensor)[0].numpy()[0]
        return out

    def postprocess(self, raw_out, orig_shape, ratio, pad, conf=0.25, iou=0.45):
        return decode_and_nms(raw_out, orig_shape, ratio, pad, conf, iou, is_normalized=False)


class ONNXRunner:
    def __init__(self, model_path, num_threads=4):
        self.model_path = model_path
        self.num_threads = num_threads
        self.session = None
        self.input_name = None

    def load(self):
        t0 = time.perf_counter()
        opts = ort.SessionOptions()
        opts.intra_op_num_threads = self.num_threads
        opts.inter_op_num_threads = 1
        opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.session = ort.InferenceSession(self.model_path, sess_options=opts, providers=["CPUExecutionProvider"])
        self.input_name = self.session.get_inputs()[0].name
        return round(time.perf_counter() - t0, 4)

    def preprocess(self, img_bgr):
        im, r, pad = letterbox(img_bgr)
        rgb = cv2.cvtColor(im, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        tensor = np.ascontiguousarray(rgb.transpose(2, 0, 1)[None])
        return tensor, r, pad

    def forward(self, preprocessed_tensor):
        out = self.session.run(None, {self.input_name: preprocessed_tensor})[0][0]
        return out

    def postprocess(self, raw_out, orig_shape, ratio, pad, conf=0.25, iou=0.45):
        return decode_and_nms(raw_out, orig_shape, ratio, pad, conf, iou, is_normalized=False)


class TFLiteRunner:
    def __init__(self, model_path, num_threads=4):
        self.model_path = model_path
        self.num_threads = num_threads
        self.interpreter = None
        self.in_idx = None
        self.out_idx = None

    def load(self):
        t0 = time.perf_counter()
        self.interpreter = tflite.Interpreter(model_path=self.model_path, num_threads=self.num_threads)
        self.interpreter.allocate_tensors()
        self.in_idx = self.interpreter.get_input_details()[0]["index"]
        self.out_idx = self.interpreter.get_output_details()[0]["index"]
        return round(time.perf_counter() - t0, 4)

    def preprocess(self, img_bgr):
        im, r, pad = letterbox(img_bgr)
        rgb = cv2.cvtColor(im, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        tensor = np.ascontiguousarray(rgb[None])
        return tensor, r, pad

    def forward(self, preprocessed_tensor):
        self.interpreter.set_tensor(self.in_idx, preprocessed_tensor)
        self.interpreter.invoke()
        out = self.interpreter.get_tensor(self.out_idx)[0]
        return out

    def postprocess(self, raw_out, orig_shape, ratio, pad, conf=0.25, iou=0.45):
        return decode_and_nms(raw_out, orig_shape, ratio, pad, conf, iou, is_normalized=True)


def benchmark_runtime(name, runner_cls, model_path, image_paths, num_runs=3, warmup=20, threads=4):
    print(f"\n=======================================================")
    print(f"  Benchmarking: {name}")
    print(f"  Model Path:   {model_path}")
    print(f"  CPU Threads:  {threads}")
    print(f"  Runs:         {num_runs} (over {len(image_paths)} images)")
    print(f"  Warmup:       {warmup} iterations")
    print(f"=======================================================")

    runner = runner_cls(model_path, num_threads=threads)
    mem_before = get_process_memory_mb()
    load_time_sec = runner.load()
    mem_after_load = get_process_memory_mb()
    print(f"[{name}] Model Load Time: {load_time_sec:.3f} s (RSS: {mem_after_load:.1f} MB, +{mem_after_load - mem_before:.1f} MB)")

    # Cold start test on the very first image
    first_im = cv2.imread(image_paths[0])
    t_cs_start = time.perf_counter()
    tensor_cs, r_cs, pad_cs = runner.preprocess(first_im)
    raw_cs = runner.forward(tensor_cs)
    _ = runner.postprocess(raw_cs, first_im.shape[:2], r_cs, pad_cs)
    cold_start_ms = (time.perf_counter() - t_cs_start) * 1000.0
    print(f"[{name}] Cold Start Latency: {cold_start_ms:.2f} ms")

    # Warmup
    print(f"[{name}] Executing {warmup} warmup iterations...")
    for i in range(warmup):
        im_warm = cv2.imread(image_paths[i % len(image_paths)])
        t_w, r_w, p_w = runner.preprocess(im_warm)
        raw_w = runner.forward(t_w)
        _ = runner.postprocess(raw_w, im_warm.shape[:2], r_w, p_w)
    print(f"[{name}] Warmup complete.")

    all_runs_records = []
    run_aggregates = []

    for run_idx in range(1, num_runs + 1):
        print(f"[{name}] Run {run_idx}/{num_runs} in progress...", end="", flush=True)
        run_prep = []
        run_fwd = []
        run_post = []
        run_e2e = []

        t_run_start = time.perf_counter()
        for img_p in image_paths:
            im = cv2.imread(img_p)
            orig_shape = im.shape[:2]

            # Preprocessing
            t0 = time.perf_counter()
            tensor, r, pad = runner.preprocess(im)
            t1 = time.perf_counter()

            # Forward
            raw = runner.forward(tensor)
            t2 = time.perf_counter()

            # Postprocessing
            _ = runner.postprocess(raw, orig_shape, r, pad)
            t3 = time.perf_counter()

            prep_ms = (t1 - t0) * 1000.0
            fwd_ms = (t2 - t1) * 1000.0
            post_ms = (t3 - t2) * 1000.0
            e2e_ms = (t3 - t0) * 1000.0

            run_prep.append(prep_ms)
            run_fwd.append(fwd_ms)
            run_post.append(post_ms)
            run_e2e.append(e2e_ms)

            all_runs_records.append({
                "runtime": name,
                "run": run_idx,
                "image": os.path.basename(img_p),
                "preprocess_ms": prep_ms,
                "forward_ms": fwd_ms,
                "postprocess_ms": post_ms,
                "e2e_ms": e2e_ms
            })

        run_total_sec = time.perf_counter() - t_run_start
        fps = len(image_paths) / run_total_sec
        mean_prep = np.mean(run_prep)
        mean_fwd = np.mean(run_fwd)
        mean_post = np.mean(run_post)
        mean_e2e = np.mean(run_e2e)
        print(f" Done! Mean Forward: {mean_fwd:.2f} ms | Mean E2E: {mean_e2e:.2f} ms | FPS: {fps:.2f}")

        run_aggregates.append({
            "run": run_idx,
            "mean_prep_ms": mean_prep,
            "mean_fwd_ms": mean_fwd,
            "mean_post_ms": mean_post,
            "mean_e2e_ms": mean_e2e,
            "fps": fps
        })

    peak_mem_mb = get_process_memory_mb()
    file_size_mb = round(os.path.getsize(model_path) / (1024 * 1024), 2)

    df_records = pd.DataFrame(all_runs_records)
    fwd_vals = df_records["forward_ms"].values
    e2e_vals = df_records["e2e_ms"].values
    prep_vals = df_records["preprocess_ms"].values
    post_vals = df_records["postprocess_ms"].values

    stats = {
        "runtime": name,
        "model_path": model_path,
        "model_file_size_mb": file_size_mb,
        "cpu_threads": threads,
        "model_load_time_sec": load_time_sec,
        "cold_start_ms": round(cold_start_ms, 2),
        "peak_rss_mb": peak_mem_mb,
        "runs": num_runs,
        "total_inferences": len(df_records),
        "forward": {
            "mean_ms": round(float(np.mean(fwd_vals)), 2),
            "std_ms": round(float(np.std(fwd_vals)), 2),
            "median_ms": round(float(np.median(fwd_vals)), 2),
            "p90_ms": round(float(np.percentile(fwd_vals, 90)), 2),
            "p95_ms": round(float(np.percentile(fwd_vals, 95)), 2),
            "min_ms": round(float(np.min(fwd_vals)), 2),
            "max_ms": round(float(np.max(fwd_vals)), 2),
            "fps": round(1000.0 / float(np.mean(fwd_vals)), 2)
        },
        "preprocessing": {
            "mean_ms": round(float(np.mean(prep_vals)), 2),
            "median_ms": round(float(np.median(prep_vals)), 2),
            "std_ms": round(float(np.std(prep_vals)), 2)
        },
        "postprocessing": {
            "mean_ms": round(float(np.mean(post_vals)), 2),
            "median_ms": round(float(np.median(post_vals)), 2),
            "std_ms": round(float(np.std(post_vals)), 2)
        },
        "end_to_end": {
            "mean_ms": round(float(np.mean(e2e_vals)), 2),
            "std_ms": round(float(np.std(e2e_vals)), 2),
            "median_ms": round(float(np.median(e2e_vals)), 2),
            "p90_ms": round(float(np.percentile(e2e_vals, 90)), 2),
            "p95_ms": round(float(np.percentile(e2e_vals, 95)), 2),
            "min_ms": round(float(np.min(e2e_vals)), 2),
            "max_ms": round(float(np.max(e2e_vals)), 2),
            "throughput_fps": round(1000.0 / float(np.mean(e2e_vals)), 2)
        }
    }

    return stats, df_records


def generate_plots(results_dict, all_dfs, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    combined_df = pd.concat(all_dfs, ignore_index=True)

    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    fig.suptitle("CarDD YOLOv8n CPU Runtime Benchmark (Intel i5-10210U, 4 Threads)", fontsize=16, fontweight="bold")

    runtimes = list(results_dict.keys())
    colors = ["#2b5c8f", "#e67e22", "#27ae60"]

    # 1. Forward vs E2E Latency (Mean & P95)
    ax1 = axes[0, 0]
    x = np.arange(len(runtimes))
    width = 0.35
    fwd_means = [results_dict[r]["forward"]["mean_ms"] for r in runtimes]
    e2e_means = [results_dict[r]["end_to_end"]["mean_ms"] for r in runtimes]
    e2e_p95 = [results_dict[r]["end_to_end"]["p95_ms"] for r in runtimes]

    b1 = ax1.bar(x - width/2, fwd_means, width, label="Forward Inference", color="#3498db")
    b2 = ax1.bar(x + width/2, e2e_means, width, label="End-to-End (Total)", color="#e74c3c")
    ax1.set_ylabel("Latency (ms)")
    ax1.set_title("Mean Latency Comparison (Forward vs E2E)")
    ax1.set_xticks(x)
    ax1.set_xticklabels(runtimes)
    ax1.legend()
    ax1.grid(axis="y", linestyle="--", alpha=0.7)
    for b in b1 + b2:
        height = b.get_height()
        ax1.annotate(f"{height:.1f}ms",
                     xy=(b.get_x() + b.get_width() / 2, height),
                     xytext=(0, 3), textcoords="offset points",
                     ha="center", va="bottom", fontsize=9, fontweight="bold")

    # 2. Pipeline Stage Breakdown (Preprocess, Forward, Postprocess)
    ax2 = axes[0, 1]
    prep_means = [results_dict[r]["preprocessing"]["mean_ms"] for r in runtimes]
    post_means = [results_dict[r]["postprocessing"]["mean_ms"] for r in runtimes]

    ax2.bar(runtimes, prep_means, label="Preprocessing (Letterbox+RGB)", color="#9b59b6")
    ax2.bar(runtimes, fwd_means, bottom=prep_means, label="Forward Pass", color="#3498db")
    ax2.bar(runtimes, post_means, bottom=[p + f for p, f in zip(prep_means, fwd_means)], label="Postprocessing (NMS)", color="#f1c40f")
    ax2.set_ylabel("Latency (ms)")
    ax2.set_title("Latency Breakdown by Pipeline Stage")
    ax2.legend()
    ax2.grid(axis="y", linestyle="--", alpha=0.7)

    # 3. Throughput (FPS)
    ax3 = axes[1, 0]
    fps_fwd = [results_dict[r]["forward"]["fps"] for r in runtimes]
    fps_e2e = [results_dict[r]["end_to_end"]["throughput_fps"] for r in runtimes]
    b3 = ax3.bar(x - width/2, fps_fwd, width, label="Forward FPS", color="#1abc9c")
    b4 = ax3.bar(x + width/2, fps_e2e, width, label="End-to-End FPS", color="#16a085")
    ax3.set_ylabel("Throughput (Frames / Sec)")
    ax3.set_title("Inference Throughput (FPS)")
    ax3.set_xticks(x)
    ax3.set_xticklabels(runtimes)
    ax3.legend()
    ax3.grid(axis="y", linestyle="--", alpha=0.7)
    for b in b3 + b4:
        height = b.get_height()
        ax3.annotate(f"{height:.1f}",
                     xy=(b.get_x() + b.get_width() / 2, height),
                     xytext=(0, 3), textcoords="offset points",
                     ha="center", va="bottom", fontsize=9, fontweight="bold")

    # 4. End-to-End Latency Boxplot (Outliers, Spread, P90, P95)
    ax4 = axes[1, 1]
    data_to_plot = [combined_df[combined_df["runtime"] == r]["e2e_ms"].values for r in runtimes]
    bp = ax4.boxplot(data_to_plot, patch_artist=True, tick_labels=runtimes, showmeans=True)
    for patch, color in zip(bp["boxes"], colors):
        patch.set_facecolor(color)
        patch.set_alpha(0.7)
    ax4.set_ylabel("End-to-End Latency (ms)")
    ax4.set_title("Latency Distribution & Stability Across Images")
    ax4.grid(axis="y", linestyle="--", alpha=0.7)

    plt.tight_layout()
    chart_path = os.path.join(output_dir, "timing_plots.png")
    plt.savefig(chart_path, dpi=300)
    plt.close()
    print(f"\n[INFO] Timing plots saved to: {chart_path}")


def main():
    parser = argparse.ArgumentParser(description="YOLOv8 CPU Runtime Benchmark")
    parser.add_argument("--num-runs", type=int, default=3, help="Number of benchmark repetitions over test set")
    parser.add_argument("--warmup", type=int, default=20, help="Number of warm-up iterations")
    parser.add_argument("--threads", type=int, default=4, help="CPU threads to assign to each runtime")
    args = parser.parse_args()

    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    models_dir = os.path.join(base_dir, "models")
    dataset_dir = os.path.join(base_dir, "dataset", "test", "images")
    results_dir = os.path.join(base_dir, "results")
    os.makedirs(results_dir, exist_ok=True)

    pt_model = os.path.join(models_dir, "best.pt")
    onnx_model = os.path.join(models_dir, "yolov8n.onnx")
    tflite_model = os.path.join(models_dir, "yolov8n.tflite")

    for p in [pt_model, onnx_model, tflite_model]:
        if not os.path.exists(p):
            raise FileNotFoundError(f"Model file not found: {p}")

    image_files = sorted([os.path.join(dataset_dir, f) for f in os.listdir(dataset_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))])
    print(f"[INFO] Loaded {len(image_files)} test images for CPU benchmark.")

    runtimes = [
        ("PyTorch (CPU)", PyTorchRunner, pt_model),
        ("ONNX Runtime (CPU EP)", ONNXRunner, onnx_model),
        ("TensorFlow Lite (CPU)", TFLiteRunner, tflite_model)
    ]

    results = {}
    all_dfs = []
    summary_rows = []

    for name, runner_cls, model_p in runtimes:
        stats, df_rec = benchmark_runtime(name, runner_cls, model_p, image_files,
                                          num_runs=args.num_runs, warmup=args.warmup, threads=args.threads)
        results[name] = stats
        all_dfs.append(df_rec)

        summary_rows.append({
            "Runtime": name,
            "Model Size (MB)": stats["model_file_size_mb"],
            "Load Time (s)": stats["model_load_time_sec"],
            "Cold Start (ms)": stats["cold_start_ms"],
            "Preprocess Mean (ms)": stats["preprocessing"]["mean_ms"],
            "Forward Mean (ms)": stats["forward"]["mean_ms"],
            "Forward Median (ms)": stats["forward"]["median_ms"],
            "Forward P90 (ms)": stats["forward"]["p90_ms"],
            "Forward P95 (ms)": stats["forward"]["p95_ms"],
            "Forward Std (ms)": stats["forward"]["std_ms"],
            "Forward FPS": stats["forward"]["fps"],
            "Postprocess Mean (ms)": stats["postprocessing"]["mean_ms"],
            "E2E Mean (ms)": stats["end_to_end"]["mean_ms"],
            "E2E Median (ms)": stats["end_to_end"]["median_ms"],
            "E2E P90 (ms)": stats["end_to_end"]["p90_ms"],
            "E2E P95 (ms)": stats["end_to_end"]["p95_ms"],
            "E2E Std (ms)": stats["end_to_end"]["std_ms"],
            "E2E Throughput (FPS)": stats["end_to_end"]["throughput_fps"],
            "Peak RSS (MB)": stats["peak_rss_mb"]
        })

    # Save summary CSV
    summary_df = pd.DataFrame(summary_rows)
    csv_path = os.path.join(results_dir, "benchmark_summary.csv")
    summary_df.to_csv(csv_path, index=False)
    print(f"\n[INFO] Summary saved to: {csv_path}")

    # Save raw records CSV
    combined_df = pd.concat(all_dfs, ignore_index=True)
    raw_csv = os.path.join(results_dir, "benchmark_per_image_latencies.csv")
    combined_df.to_csv(raw_csv, index=False)

    # Save JSON summary
    json_path = os.path.join(results_dir, "latency_summary.json")
    with open(json_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"[INFO] Latency summary JSON saved to: {json_path}")

    # Generate plots
    generate_plots(results, all_dfs, results_dir)

    print("\n================== BENCHMARK SUMMARY TABLE ==================")
    print(summary_df.to_string(index=False))
    print("=============================================================")


if __name__ == "__main__":
    main()
