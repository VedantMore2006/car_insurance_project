import os
import time
from typing import List, Tuple
import numpy as np

from ..config import (
    MODEL_PATH,
    CLASS_NAMES,
    DEFAULT_CONF_THRESHOLD,
    DEFAULT_IOU_THRESHOLD,
    MAX_DETECTIONS,
)
from ..schemas import BoundingBox, DetectionItem
from ..utils.image import letterbox


def nms(boxes: np.ndarray, scores: np.ndarray, iou_threshold: float = 0.45) -> List[int]:
    """
    Standard Greedy Non-Maximum Suppression (NMS).
    boxes: (N, 4) in [x1, y1, x2, y2]
    scores: (N,)
    """
    if len(boxes) == 0:
        return []

    x1, y1, x2, y2 = boxes[:, 0], boxes[:, 1], boxes[:, 2], boxes[:, 3]
    areas = (x2 - x1) * (y2 - y1)
    order = scores.argsort()[::-1]
    keep = []

    while order.size > 0:
        i = order[0]
        keep.append(int(i))
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


class DamageDetector:
    """
    Unified YOLOv8n detector supporting both TensorFlow Lite (LiteRT) and ONNX Runtime.
    """

    def __init__(self, model_path: str = MODEL_PATH):
        self.model_path = model_path
        self.model_type = "tflite" if model_path.endswith(".tflite") else "onnx"
        self.session = None
        self.interpreter = None
        self.input_details = None
        self.output_details = None
        self.input_name = None
        self.output_name = None
        self.is_loaded = False

    def load_model(self) -> None:
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"Model file not found at: {self.model_path}")

        if self.model_type == "tflite":
            try:
                # Try ai_edge_litert first (official LiteRT 2.x)
                from ai_edge_litert.interpreter import Interpreter
            except ImportError:
                try:
                    # Fallback to standard tflite_runtime
                    from tflite_runtime.interpreter import Interpreter
                except ImportError:
                    # Fallback to tensorflow if present
                    from tensorflow.lite.python.interpreter import Interpreter

            self.interpreter = Interpreter(model_path=self.model_path, num_threads=4)
            self.interpreter.allocate_tensors()
            self.input_details = self.interpreter.get_input_details()
            self.output_details = self.interpreter.get_output_details()
            self.is_loaded = True
        else:
            import onnxruntime as ort

            opts = ort.SessionOptions()
            opts.intra_op_num_threads = 4
            opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            self.session = ort.InferenceSession(
                self.model_path, sess_options=opts, providers=["CPUExecutionProvider"]
            )
            self.input_name = self.session.get_inputs()[0].name
            self.output_name = self.session.get_outputs()[0].name
            self.is_loaded = True

        # Warmup forward pass
        self.warmup()

    def warmup(self) -> None:
        dummy = np.zeros((1, 640, 640, 3) if self.model_type == "tflite" else (1, 3, 640, 640), dtype=np.float32)
        if self.model_type == "tflite":
            self.interpreter.set_tensor(self.input_details[0]["index"], dummy)
            self.interpreter.invoke()
        else:
            self.session.run([self.output_name], {self.input_name: dummy})

    def predict(
        self,
        image_rgb: np.ndarray,
        orig_w: int,
        orig_h: int,
        conf_threshold: float = DEFAULT_CONF_THRESHOLD,
        iou_threshold: float = DEFAULT_IOU_THRESHOLD,
    ) -> Tuple[List[DetectionItem], float]:
        if not self.is_loaded:
            raise RuntimeError("Model is not loaded. Call load_model() first.")

        t0 = time.perf_counter()

        # 1. Letterbox resizing to 640x640 with border padding (114, 114, 114)
        padded_im, ratio, (dw, dh) = letterbox(image_rgb, (640, 640))

        # 2. Preprocessing & Input tensor formatting
        if self.model_type == "tflite":
            # TFLite input: [1, 640, 640, 3], float32 scaled to [0, 1]
            input_tensor = np.expand_dims(padded_im.astype(np.float32) / 255.0, axis=0)
            self.interpreter.set_tensor(self.input_details[0]["index"], input_tensor)
            self.interpreter.invoke()
            raw_out = self.interpreter.get_tensor(self.output_details[0]["index"])[0]  # [10, 8400]
            is_normalized = True
        else:
            # ONNX input: [1, 3, 640, 640], float32 scaled to [0, 1]
            input_tensor = np.expand_dims(padded_im.transpose(2, 0, 1).astype(np.float32) / 255.0, axis=0)
            raw_out = self.session.run([self.output_name], {self.input_name: input_tensor})[0][0]  # [10, 8400]
            is_normalized = False

        # 3. Decoding and Postprocessing
        raw_out = raw_out.T  # Shape: [8400, 10]
        boxes = raw_out[:, :4].copy()

        # TFLite outputs coordinates normalized to [0, 1] -> scale back to [0, 640]
        if is_normalized:
            boxes *= 640.0

        scores = raw_out[:, 4:]  # Shape: [8400, 6]
        cls_ids = np.argmax(scores, axis=1)
        max_scores = np.max(scores, axis=1)

        mask = max_scores >= conf_threshold
        if not np.any(mask):
            processing_time_ms = (time.perf_counter() - t0) * 1000.0
            return [], round(processing_time_ms, 2)

        b = boxes[mask]
        s = max_scores[mask]
        c = cls_ids[mask]

        # Convert center [cx, cy, w, h] to corner [x1, y1, x2, y2]
        x1 = b[:, 0] - b[:, 2] / 2.0
        y1 = b[:, 1] - b[:, 3] / 2.0
        x2 = b[:, 0] + b[:, 2] / 2.0
        y2 = b[:, 1] + b[:, 3] / 2.0

        # Unletterbox back to original image coordinates
        x1 = (x1 - dw) / ratio
        y1 = (y1 - dh) / ratio
        x2 = (x2 - dw) / ratio
        y2 = (y2 - dh) / ratio

        # Clip coordinates to original image bounds [orig_w, orig_h]
        x1 = np.clip(x1, 0, orig_w)
        y1 = np.clip(y1, 0, orig_h)
        x2 = np.clip(x2, 0, orig_w)
        y2 = np.clip(y2, 0, orig_h)

        # Class-offset NMS (prevents suppression across different damage classes)
        max_wh = 7680.0
        c_offset = c.astype(np.float32) * max_wh
        boxes_offset = np.stack(
            [x1 + c_offset, y1 + c_offset, x2 + c_offset, y2 + c_offset], axis=1
        )
        keep = nms(boxes_offset, s, iou_threshold)[:MAX_DETECTIONS]

        detections: List[DetectionItem] = []
        for idx in keep:
            class_id = int(c[idx])
            class_name = CLASS_NAMES.get(class_id, f"damage_class_{class_id}")
            confidence = float(s[idx])
            detections.append(
                DetectionItem(
                    classId=class_id,
                    className=class_name,
                    confidence=round(confidence, 4),
                    bbox=BoundingBox(
                        x1=round(float(x1[idx]), 1),
                        y1=round(float(y1[idx]), 1),
                        x2=round(float(x2[idx]), 1),
                        y2=round(float(y2[idx]), 1),
                    ),
                )
            )

        processing_time_ms = (time.perf_counter() - t0) * 1000.0
        return detections, round(processing_time_ms, 2)
