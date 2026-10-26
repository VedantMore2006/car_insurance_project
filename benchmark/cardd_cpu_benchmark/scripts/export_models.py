#!/usr/bin/env python3
"""
Model Export Script for CarDD YOLOv8n CPU Runtime Benchmark
Exports best.pt to:
1. yolov8n.onnx (ONNX opset 17, simplified, 640x640)
2. yolov8n.tflite (TensorFlow Lite FP32, 640x640)
Validates tensor shapes, finiteness of outputs, and records export metadata.
"""

import os
import sys
import time
import json
import shutil
import numpy as np
import torch

try:
    from ultralytics import YOLO
except ImportError:
    print("Error: ultralytics is required.")
    sys.exit(1)


def get_file_size_mb(path):
    return round(os.path.getsize(path) / (1024 * 1024), 2)


def main():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    models_dir = os.path.join(base_dir, "models")
    os.makedirs(models_dir, exist_ok=True)

    source_pt = os.path.join(models_dir, "best.pt")
    if not os.path.exists(source_pt):
        # Fallback to parent benchmark directory
        alt_pt = os.path.join(base_dir, "..", "best.pt")
        if os.path.exists(alt_pt):
            shutil.copy2(alt_pt, source_pt)
        else:
            print(f"Error: source checkpoint best.pt not found at {source_pt}")
            sys.exit(1)

    print(f"[INFO] Using source checkpoint: {source_pt} ({get_file_size_mb(source_pt)} MB)")
    metadata = {
        "source_checkpoint": {
            "path": source_pt,
            "size_mb": get_file_size_mb(source_pt)
        },
        "exports": {}
    }

    # 1. Export ONNX
    onnx_target = os.path.join(models_dir, "yolov8n.onnx")
    print("\n--- 1. Exporting to ONNX (FP32, 640x640) ---")
    start_time = time.time()
    model = YOLO(source_pt)
    onnx_exported_file = model.export(
        format="onnx",
        imgsz=640,
        dynamic=False,
        simplify=True,
        opset=17
    )
    onnx_duration = round(time.time() - start_time, 2)
    if os.path.abspath(onnx_exported_file) != os.path.abspath(onnx_target):
        shutil.copy2(onnx_exported_file, onnx_target)

    # Validate ONNX model with onnxruntime
    import onnxruntime as ort
    ort_session = ort.InferenceSession(onnx_target, providers=["CPUExecutionProvider"])
    ort_inputs = ort_session.get_inputs()
    ort_outputs = ort_session.get_outputs()
    input_shape = ort_inputs[0].shape
    output_shape = ort_outputs[0].shape
    print(f"ONNX Exported: {onnx_target}")
    print(f"ONNX Input Shape: {input_shape}, Output Shape: {output_shape}")
    print(f"ONNX Size: {get_file_size_mb(onnx_target)} MB, Export Duration: {onnx_duration}s")

    # Sanity inference
    dummy_input = np.random.randn(*[dim if isinstance(dim, int) else 1 for dim in input_shape]).astype(np.float32)
    ort_out = ort_session.run(None, {ort_inputs[0].name: dummy_input})[0]
    assert np.isfinite(ort_out).all(), "ONNX output contains NaN or Inf!"

    metadata["exports"]["onnx"] = {
        "path": onnx_target,
        "size_mb": get_file_size_mb(onnx_target),
        "duration_sec": onnx_duration,
        "input_shape": input_shape,
        "output_shape": output_shape,
        "finite_output_verified": True
    }

    # 2. Export TFLite
    tflite_target = os.path.join(models_dir, "yolov8n.tflite")
    print("\n--- 2. Exporting to TensorFlow Lite (FP32, 640x640) ---")
    start_time = time.time()
    tflite_exported_file = model.export(
        format="tflite",
        imgsz=640,
        int8=False,
        half=False
    )
    tflite_duration = round(time.time() - start_time, 2)

    # Locate exported tflite file
    if os.path.isdir(tflite_exported_file):
        # Ultralytics might return saved_model folder containing float32.tflite
        found_tflite = None
        for root, _, files in os.walk(tflite_exported_file):
            for f in files:
                if f.endswith(".tflite") and "int8" not in f:
                    found_tflite = os.path.join(root, f)
                    break
        if found_tflite:
            shutil.copy2(found_tflite, tflite_target)
        else:
            raise FileNotFoundError(f"No tflite file found in {tflite_exported_file}")
    elif os.path.exists(tflite_exported_file):
        shutil.copy2(tflite_exported_file, tflite_target)
    else:
        raise FileNotFoundError(f"Export returned {tflite_exported_file} which does not exist")

    # Validate TFLite model
    try:
        import ai_edge_litert.interpreter as tflite
    except ImportError:
        import tensorflow.lite as tflite

    interpreter = tflite.Interpreter(model_path=tflite_target)
    interpreter.allocate_tensors()
    in_details = interpreter.get_input_details()
    out_details = interpreter.get_output_details()
    tflite_in_shape = in_details[0]["shape"].tolist()
    tflite_out_shape = out_details[0]["shape"].tolist()

    print(f"TFLite Exported: {tflite_target}")
    print(f"TFLite Input Shape: {tflite_in_shape}, Output Shape: {tflite_out_shape}")
    print(f"TFLite Size: {get_file_size_mb(tflite_target)} MB, Export Duration: {tflite_duration}s")

    # Sanity inference
    dummy_tflite_input = np.random.randn(*tflite_in_shape).astype(in_details[0]["dtype"])
    interpreter.set_tensor(in_details[0]["index"], dummy_tflite_input)
    interpreter.invoke()
    tflite_out = interpreter.get_tensor(out_details[0]["index"])
    assert np.isfinite(tflite_out).all(), "TFLite output contains NaN or Inf!"

    metadata["exports"]["tflite"] = {
        "path": tflite_target,
        "size_mb": get_file_size_mb(tflite_target),
        "duration_sec": tflite_duration,
        "input_shape": tflite_in_shape,
        "output_shape": tflite_out_shape,
        "finite_output_verified": True
    }

    metadata_path = os.path.join(models_dir, "export_metadata.json")
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"\n[SUCCESS] Model export complete. Metadata saved to {metadata_path}")


if __name__ == "__main__":
    main()
