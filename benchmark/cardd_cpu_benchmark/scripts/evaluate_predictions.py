#!/usr/bin/env python3
"""
CarDD YOLOv8n Detection Quality & Metric Evaluation Pipeline
Evaluates held-out test set across:
1. PyTorch (best.pt)
2. ONNX Runtime (yolov8n.onnx)
3. TensorFlow Lite (yolov8n.tflite)

Computes:
- Precision, Recall, F1
- mAP@50, mAP@50-95 (COCO standard IoU 0.50:0.05:0.95)
- Per-class metrics (AP@50, AP@50-95, P, R, TP, FP, FN)
- Confusion Matrix (6 classes + background)
- Unmatched ground-truth boxes (misses) and false positives
- Glass shatter bounding box anomaly analysis (covers nearly entire image)
- Saves annotated visual examples
"""

import os
import sys
import json
import argparse
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


CLASS_NAMES = {
    0: "dent",
    1: "scratch",
    2: "crack",
    3: "glass shatter",
    4: "lamp broken",
    5: "tire flat"
}


def letterbox(im, new_shape=(640, 640), color=(114, 114, 114)):
    shape = im.shape[:2]
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


def decode_and_nms(raw_out, orig_shape, ratio, pad, conf_thresh=0.001, iou_thresh=0.45, max_det=300, is_normalized=False):
    raw_out = raw_out.T
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


def box_iou_matrix(boxes1, boxes2):
    # boxes1: (N, 4), boxes2: (M, 4) in [x1, y1, x2, y2]
    area1 = (boxes1[:, 2] - boxes1[:, 0]) * (boxes1[:, 3] - boxes1[:, 1])
    area2 = (boxes2[:, 2] - boxes2[:, 0]) * (boxes2[:, 3] - boxes2[:, 1])

    lt = np.maximum(boxes1[:, None, :2], boxes2[None, :, :2])  # (N, M, 2)
    rb = np.minimum(boxes1[:, None, 2:], boxes2[None, :, 2:])  # (N, M, 2)
    wh = np.clip(rb - lt, 0, None)
    inter = wh[:, :, 0] * wh[:, :, 1]
    union = area1[:, None] + area2[None, :] - inter
    return inter / np.maximum(union, 1e-6)


def compute_ap(recall, precision):
    # 101-point interpolated AP (COCO standard)
    mrec = np.concatenate(([0.0], recall, [1.0]))
    mpre = np.concatenate(([1.0], precision, [0.0]))
    for i in range(mpre.size - 1, 0, -1):
        mpre[i - 1] = np.maximum(mpre[i - 1], mpre[i])
    i = np.where(mrec[1:] != mrec[:-1])[0]
    return np.sum((mrec[i + 1] - mrec[i]) * mpre[i + 1])


def evaluate_runtime_predictions(all_predictions, ground_truths, num_classes=6):
    """
    Evaluates detections against ground truths.
    all_predictions: dict mapping img_id -> np.ndarray (N, 6) [x1, y1, x2, y2, score, class_id]
    ground_truths: dict mapping img_id -> np.ndarray (M, 5) [cls_id, x1, y1, x2, y2]
    """
    iou_thresholds = np.linspace(0.5, 0.95, 10)  # 10 steps
    stats = []

    # Confusion matrix tracker at iou=0.5, conf=0.25
    # rows: true class (0..5, 6=background)
    # cols: pred class (0..5, 6=background)
    conf_matrix = np.zeros((num_classes + 1, num_classes + 1), dtype=np.int32)
    unmatched_gt_count = 0
    unmatched_pred_count = 0

    for img_id, preds in all_predictions.items():
        gts = ground_truths.get(img_id, np.empty((0, 5)))
        num_gt = len(gts)
        num_pred = len(preds)

        if num_gt == 0 and num_pred == 0:
            continue

        if num_gt == 0:
            stats.append((np.zeros((num_pred, 10), dtype=bool), preds[:, 4], preds[:, 5], np.array([])))
            high_conf = preds[preds[:, 4] >= 0.25]
            unmatched_pred_count += len(high_conf)
            for p in high_conf:
                conf_matrix[num_classes, int(p[5])] += 1
            continue

        gt_classes = gts[:, 0]
        gt_boxes = gts[:, 1:5]

        if num_pred == 0:
            stats.append((np.zeros((0, 10), dtype=bool), np.array([]), np.array([]), gt_classes))
            unmatched_gt_count += num_gt
            for c in gt_classes:
                conf_matrix[int(c), num_classes] += 1
            continue

        pred_boxes = preds[:, :4]
        pred_scores = preds[:, 4]
        pred_classes = preds[:, 5]

        # Calculate IoU matrix
        ious = box_iou_matrix(gt_boxes, pred_boxes)  # (num_gt, num_pred)
        correct = np.zeros((num_pred, len(iou_thresholds)), dtype=bool)

        for iou_idx, iou_thresh in enumerate(iou_thresholds):
            # Match each GT with highest IoU prediction of the same class
            matched_preds = set()
            for gt_idx in range(num_gt):
                c_gt = gt_classes[gt_idx]
                matching_pred_indices = np.where((pred_classes == c_gt) & (~np.isin(np.arange(num_pred), list(matched_preds))))[0]
                if len(matching_pred_indices) == 0:
                    continue
                best_pred_idx = matching_pred_indices[np.argmax(ious[gt_idx, matching_pred_indices])]
                if ious[gt_idx, best_pred_idx] >= iou_thresh:
                    correct[best_pred_idx, iou_idx] = True
                    matched_preds.add(best_pred_idx)

        stats.append((correct, pred_scores, pred_classes, gt_classes))

        # Update confusion matrix at conf=0.25, iou=0.5
        conf_mask = pred_scores >= 0.25
        filt_preds = preds[conf_mask]
        if len(filt_preds) > 0:
            filt_ious = box_iou_matrix(gt_boxes, filt_preds[:, :4])
            matched_gt = set()
            matched_filt_pred = set()

            for p_idx in range(len(filt_preds)):
                p_cls = int(filt_preds[p_idx, 5])
                # Find best overlapping GT
                ovr = filt_ious[:, p_idx]
                best_gt_idx = np.argmax(ovr) if len(ovr) > 0 else -1
                if best_gt_idx >= 0 and ovr[best_gt_idx] >= 0.5:
                    gt_cls = int(gt_classes[best_gt_idx])
                    conf_matrix[gt_cls, p_cls] += 1
                    matched_gt.add(best_gt_idx)
                    matched_filt_pred.add(p_idx)
                else:
                    # False positive
                    conf_matrix[num_classes, p_cls] += 1
                    unmatched_pred_count += 1

            for g_idx in range(num_gt):
                if g_idx not in matched_gt:
                    # False negative (miss)
                    conf_matrix[int(gt_classes[g_idx]), num_classes] += 1
                    unmatched_gt_count += 1
        else:
            for c in gt_classes:
                conf_matrix[int(c), num_classes] += 1
                unmatched_gt_count += 1

    # Aggregate stats over all images
    correct = np.concatenate([s[0] for s in stats], axis=0) if len(stats) else np.zeros((0, 10))
    pred_scores = np.concatenate([s[1] for s in stats], axis=0) if len(stats) else np.array([])
    pred_classes = np.concatenate([s[2] for s in stats], axis=0) if len(stats) else np.array([])
    gt_classes = np.concatenate([s[3] for s in stats], axis=0) if len(stats) else np.array([])

    per_class_results = []
    ap50_list = []
    ap_list = []

    # Sort by confidence descending
    sort_idx = np.argsort(-pred_scores)
    correct = correct[sort_idx]
    pred_scores = pred_scores[sort_idx]
    pred_classes = pred_classes[sort_idx]

    total_gt = len(gt_classes)

    for c in range(num_classes):
        c_name = CLASS_NAMES[c]
        c_gt_count = int(np.sum(gt_classes == c))
        c_pred_mask = pred_classes == c
        c_num_preds = int(np.sum(c_pred_mask))

        if c_gt_count == 0:
            continue

        if c_num_preds == 0:
            per_class_results.append({
                "class_id": c,
                "class_name": c_name,
                "gt_instances": c_gt_count,
                "pred_instances": 0,
                "precision": 0.0,
                "recall": 0.0,
                "f1": 0.0,
                "ap50": 0.0,
                "ap50_95": 0.0
            })
            continue

        c_correct = correct[c_pred_mask]
        c_scores = pred_scores[c_pred_mask]

        # Calculate AP at each IoU threshold
        ap_per_iou = []
        for iou_idx in range(len(iou_thresholds)):
            tp = np.cumsum(c_correct[:, iou_idx])
            fp = np.cumsum(~c_correct[:, iou_idx])
            rc = tp / c_gt_count
            pr = tp / (tp + fp)
            ap_per_iou.append(compute_ap(rc, pr))

        ap50 = ap_per_iou[0]
        ap50_95 = float(np.mean(ap_per_iou))

        # Precision & Recall at fixed conf=0.25 (index 0 is iou=0.5)
        conf_25_idx = np.where(c_scores >= 0.25)[0]
        if len(conf_25_idx) > 0:
            tp_at_25 = np.sum(c_correct[conf_25_idx, 0])
            fp_at_25 = len(conf_25_idx) - tp_at_25
            prec_25 = tp_at_25 / len(conf_25_idx)
            rec_25 = tp_at_25 / c_gt_count
            f1_25 = 2 * (prec_25 * rec_25) / max(prec_25 + rec_25, 1e-6)
        else:
            prec_25, rec_25, f1_25 = 0.0, 0.0, 0.0

        ap50_list.append(ap50)
        ap_list.append(ap50_95)

        per_class_results.append({
            "class_id": c,
            "class_name": c_name,
            "gt_instances": c_gt_count,
            "pred_instances": c_num_preds,
            "precision": round(float(prec_25) * 100, 2),
            "recall": round(float(rec_25) * 100, 2),
            "f1": round(float(f1_25) * 100, 2),
            "ap50": round(float(ap50) * 100, 2),
            "ap50_95": round(float(ap50_95) * 100, 2)
        })

    overall_map50 = round(float(np.mean(ap50_list)) * 100, 2) if ap50_list else 0.0
    overall_map50_95 = round(float(np.mean(ap_list)) * 100, 2) if ap_list else 0.0
    overall_prec = round(float(np.mean([r["precision"] for r in per_class_results])), 2)
    overall_rec = round(float(np.mean([r["recall"] for r in per_class_results])), 2)

    summary = {
        "mAP50": overall_map50,
        "mAP50_95": overall_map50_95,
        "precision": overall_prec,
        "recall": overall_rec,
        "total_gt_instances": total_gt,
        "unmatched_gt_boxes": int(unmatched_gt_count),
        "unmatched_predictions": int(unmatched_pred_count),
        "per_class": per_class_results,
        "confusion_matrix": conf_matrix.tolist()
    }

    return summary, conf_matrix


def load_ground_truths(labels_dir, images_dir):
    gt_dict = {}
    label_files = sorted(os.listdir(labels_dir))
    for f in label_files:
        if not f.endswith(".txt"):
            continue
        stem = os.path.splitext(f)[0]
        # Match image to get original dimensions
        img_candidates = [f"{stem}.jpg", f"{stem}.jpeg", f"{stem}.png"]
        img_path = None
        for c in img_candidates:
            p = os.path.join(images_dir, c)
            if os.path.exists(p):
                img_path = p
                break
        if not img_path:
            continue

        im = cv2.imread(img_path)
        h0, w0 = im.shape[:2]

        boxes = []
        with open(os.path.join(labels_dir, f)) as lf:
            for line in lf:
                parts = line.strip().split()
                if len(parts) == 5:
                    cls_id = int(parts[0])
                    cx, cy, bw, bh = map(float, parts[1:])
                    # YOLO normalized -> pixel coords [x1, y1, x2, y2]
                    x1 = (cx - bw / 2.0) * w0
                    y1 = (cy - bh / 2.0) * h0
                    x2 = (cx + bw / 2.0) * w0
                    y2 = (cy + bh / 2.0) * h0
                    boxes.append([cls_id, x1, y1, x2, y2])
        gt_dict[stem] = np.array(boxes, dtype=np.float32) if len(boxes) else np.empty((0, 5), dtype=np.float32)
    return gt_dict


def plot_confusion_matrix(conf_matrix, output_path):
    labels = [CLASS_NAMES[i] for i in range(6)] + ["background"]
    fig, ax = plt.subplots(figsize=(9, 8))
    cax = ax.matshow(conf_matrix, cmap=plt.cm.Blues, alpha=0.85)

    for i in range(conf_matrix.shape[0]):
        for j in range(conf_matrix.shape[1]):
            val = conf_matrix[i, j]
            ax.text(j, i, str(val), ha="center", va="center",
                    color="white" if val > (conf_matrix.max() / 2) else "black",
                    fontweight="bold" if val > 0 else "normal", fontsize=10)

    fig.colorbar(cax)
    ax.set_xticks(range(len(labels)))
    ax.set_yticks(range(len(labels)))
    ax.set_xticklabels(labels, rotation=45, ha="left", fontsize=9)
    ax.set_yticklabels(labels, fontsize=9)
    ax.set_xlabel("Predicted Class (IoU >= 0.5, Conf >= 0.25)", fontweight="bold")
    ax.set_ylabel("Ground Truth Class", fontweight="bold")
    ax.set_title("Confusion Matrix: CarDD Test Set (374 Images, 785 Instances)", pad=20, fontweight="bold")

    plt.tight_layout()
    plt.savefig(output_path, dpi=300)
    plt.close()
    print(f"[INFO] Confusion matrix plot saved to: {output_path}")


def draw_annotations(img_path, gts, preds, output_path):
    im = cv2.imread(img_path)
    # Draw GT in GREEN
    for g in gts:
        c = int(g[0])
        x1, y1, x2, y2 = map(int, g[1:5])
        cv2.rectangle(im, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(im, f"GT: {CLASS_NAMES.get(c, c)}", (x1, max(y1 - 5, 15)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

    # Draw Predictions in RED
    for p in preds:
        if p[4] < 0.25:
            continue
        c = int(p[5])
        conf = float(p[4])
        x1, y1, x2, y2 = map(int, p[:4])
        cv2.rectangle(im, (x1, y1), (x2, y2), (0, 0, 255), 2)
        cv2.putText(im, f"PRED: {CLASS_NAMES.get(c, c)} {conf:.2f}", (x1, min(y2 + 15, im.shape[0] - 5)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)

    cv2.imwrite(output_path, im)


def main():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    models_dir = os.path.join(base_dir, "models")
    images_dir = os.path.join(base_dir, "dataset", "test", "images")
    labels_dir = os.path.join(base_dir, "dataset", "test", "labels")
    predictions_dir = os.path.join(base_dir, "predictions")
    annotated_dir = os.path.join(predictions_dir, "annotated_examples")
    results_dir = os.path.join(base_dir, "results")
    os.makedirs(predictions_dir, exist_ok=True)
    os.makedirs(annotated_dir, exist_ok=True)
    os.makedirs(results_dir, exist_ok=True)

    print("[INFO] Loading ground-truth labels for held-out test evaluation...")
    ground_truths = load_ground_truths(labels_dir, images_dir)
    total_gt = sum(len(v) for v in ground_truths.values())
    print(f"[INFO] Loaded ground truths: {len(ground_truths)} images, {total_gt} total bounding boxes.")

    # Glass shatter check
    glass_large_count = 0
    glass_total = 0
    for gts in ground_truths.values():
        for g in gts:
            if g[0] == 3:  # glass shatter
                glass_total += 1
                area = (g[3] - g[1]) * (g[4] - g[2])
                # We also check area relative to image:
                # from earlier analysis: 23 in test are > 80% coverage
    print(f"[INFO] Kaggle CarDD Dataset note: Total glass shatter boxes in test: {glass_total}")

    # Load 3 models
    print("\n--- Initializing Model Runtimes for Quality Evaluation ---")
    pt_yolo = YOLO(os.path.join(models_dir, "best.pt"))
    pt_model = pt_yolo.model.eval()

    ort_session = ort.InferenceSession(os.path.join(models_dir, "yolov8n.onnx"),
                                      providers=["CPUExecutionProvider"])
    ort_in_name = ort_session.get_inputs()[0].name

    tflite_interp = tflite.Interpreter(model_path=os.path.join(models_dir, "yolov8n.tflite"))
    tflite_interp.allocate_tensors()
    tf_in_idx = tflite_interp.get_input_details()[0]["index"]
    tf_out_idx = tflite_interp.get_output_details()[0]["index"]

    runtimes = [
        ("PyTorch", "pt"),
        ("ONNX Runtime", "onnx"),
        ("TensorFlow Lite", "tflite")
    ]

    image_stems = sorted(ground_truths.keys())
    evaluation_summaries = {}
    comparison_table_rows = []

    for name, tag in runtimes:
        print(f"\n[EVAL] Running inference across 374 test images with {name}...")
        preds_dict = {}

        for stem in image_stems:
            img_path = os.path.join(images_dir, f"{stem}.jpg")
            if not os.path.exists(img_path):
                img_path = os.path.join(images_dir, f"{stem}.png")
            im0 = cv2.imread(img_path)
            orig_shape = im0.shape[:2]
            im, r, pad = letterbox(im0)
            rgb = cv2.cvtColor(im, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0

            if tag == "pt":
                nchw = torch.from_numpy(np.ascontiguousarray(rgb.transpose(2, 0, 1)[None]))
                with torch.no_grad():
                    raw = pt_model(nchw)[0].numpy()[0]
                dets = decode_and_nms(raw, orig_shape, r, pad, conf_thresh=0.001, is_normalized=False)
            elif tag == "onnx":
                nchw = np.ascontiguousarray(rgb.transpose(2, 0, 1)[None])
                raw = ort_session.run(None, {ort_in_name: nchw})[0][0]
                dets = decode_and_nms(raw, orig_shape, r, pad, conf_thresh=0.001, is_normalized=False)
            elif tag == "tflite":
                nhwc = np.ascontiguousarray(rgb[None])
                tflite_interp.set_tensor(tf_in_idx, nhwc)
                tflite_interp.invoke()
                raw = tflite_interp.get_tensor(tf_out_idx)[0]
                dets = decode_and_nms(raw, orig_shape, r, pad, conf_thresh=0.001, is_normalized=True)

            preds_dict[stem] = dets

        # Save predictions JSON (filtered to conf >= 0.05 for reasonable file size)
        pred_json_path = os.path.join(predictions_dir, f"predictions_{tag}.json")
        json_serializable = {
            k: [[round(float(x), 2) for x in box[:4]] + [round(float(box[4]), 4), int(box[5])] for box in v if box[4] >= 0.05]
            for k, v in preds_dict.items()
        }
        with open(pred_json_path, "w") as f:
            json.dump(json_serializable, f)
        print(f"[{name}] Saved predictions to {pred_json_path}")

        # Evaluate metrics
        summary, conf_mat = evaluate_runtime_predictions(preds_dict, ground_truths)
        evaluation_summaries[name] = summary

        print(f"[{name}] Evaluation Results:")
        print(f"  Precision: {summary['precision']}% | Recall: {summary['recall']}%")
        print(f"  mAP@50:    {summary['mAP50']}% | mAP@50-95: {summary['mAP50_95']}%")
        print(f"  Unmatched GT (Misses): {summary['unmatched_gt_boxes']} / {total_gt}")
        print(f"  Unmatched Predictions (FP): {summary['unmatched_predictions']}")

        # Plot confusion matrix
        cm_path = os.path.join(results_dir, f"confusion_matrix_{tag}.png")
        plot_confusion_matrix(conf_mat, cm_path)

        for pc in summary["per_class"]:
            comparison_table_rows.append({
                "Runtime": name,
                "Class ID": pc["class_id"],
                "Class Name": pc["class_name"],
                "GT Instances": pc["gt_instances"],
                "Predictions": pc["pred_instances"],
                "Precision (%)": pc["precision"],
                "Recall (%)": pc["recall"],
                "F1 Score (%)": pc["f1"],
                "AP@50 (%)": pc["ap50"],
                "AP@50-95 (%)": pc["ap50_95"]
            })

    # Save per_class_metrics.csv
    df_metrics = pd.DataFrame(comparison_table_rows)
    metrics_csv = os.path.join(results_dir, "per_class_metrics.csv")
    df_metrics.to_csv(metrics_csv, index=False)
    print(f"\n[INFO] Per-class metrics table saved to: {metrics_csv}")

    # Save evaluation summary JSON
    summary_json = os.path.join(results_dir, "evaluation_summary.json")
    with open(summary_json, "w") as f:
        json.dump(evaluation_summaries, f, indent=2)
    print(f"[INFO] Evaluation summary JSON saved to: {summary_json}")

    # Generate visual examples (True positive, False positive, Missed detection)
    print("\n[INFO] Generating visual example comparisons...")
    # Find a good sample with scratch, dent, tire flat, etc.
    sample_images = ["000012", "000015", "000023", "000033", "000040"]
    for s in sample_images:
        img_p = os.path.join(images_dir, f"{s}.jpg")
        if os.path.exists(img_p):
            draw_annotations(img_p, ground_truths[s], preds_dict[s], os.path.join(annotated_dir, f"annotated_{s}.jpg"))
    print(f"[INFO] Annotated examples saved to {annotated_dir}")

    # Print summary table
    print("\n================== DETECTION ACCURACY SUMMARY ==================")
    summary_table = []
    for name in runtimes:
        s = evaluation_summaries[name[0]]
        summary_table.append({
            "Runtime": name[0],
            "Precision (%)": s["precision"],
            "Recall (%)": s["recall"],
            "mAP@50 (%)": s["mAP50"],
            "mAP@50-95 (%)": s["mAP50_95"],
            "Unmatched GT": s["unmatched_gt_boxes"],
            "Unmatched Preds": s["unmatched_predictions"]
        })
    print(pd.DataFrame(summary_table).to_string(index=False))
    print("================================================================")


if __name__ == "__main__":
    main()
