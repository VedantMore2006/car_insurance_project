import os
from typing import List

import numpy as np
import onnxruntime as ort
from PIL import Image

from ..config import VEHICLE_CLASSIFIER_MODEL_PATH, VEHICLE_PROB_THRESHOLD

# Indices into the standard 1000-class ImageNet label set (as used by torchvision's
# MobileNet_V2_Weights.IMAGENET1K_V2) that correspond to car-like motor vehicles. Used to gate the
# CarDD damage model, which was trained only on car panels and will happily report a "scratch" or
# "dent" on an arbitrary non-vehicle object (e.g. a laptop) since it was never taught what a car is.
VEHICLE_CLASS_INDICES: List[int] = [
    407,  # ambulance
    436,  # beach wagon
    468,  # cab
    511,  # convertible
    555,  # fire engine
    569,  # garbage truck
    609,  # jeep
    627,  # limousine
    654,  # minibus
    656,  # minivan
    675,  # moving van
    705,  # passenger car
    717,  # pickup
    734,  # police van
    751,  # racer
    757,  # recreational vehicle
    779,  # school bus
    803,  # snowplow
    817,  # sports car
    864,  # tow truck
    866,  # tractor
    867,  # trailer truck
]

_IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
_IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def _softmax(x: np.ndarray) -> np.ndarray:
    e = np.exp(x - np.max(x))
    return e / e.sum()


class VehicleClassifier:
    """
    Lightweight ImageNet-pretrained MobileNetV2 gate that estimates whether an uploaded image
    plausibly contains a motor vehicle at all, run BEFORE the CarDD damage model so that photos of
    unrelated objects (a laptop, a desk, a random product) are rejected with a clear error instead
    of producing a spurious "damage" detection.

    Known limitation: this uses whole-image ImageNet classification, which is reliable for
    full/medium shots of a vehicle but weaker on extreme close-up crops of a single damaged panel
    (little visible car context). The threshold is tuned conservatively low to avoid rejecting
    legitimate close-up damage photos; it mainly catches clearly non-vehicle images.
    """

    def __init__(self, model_path: str = VEHICLE_CLASSIFIER_MODEL_PATH):
        self.model_path = model_path
        self.session: ort.InferenceSession | None = None
        self.is_loaded = False

    def load_model(self) -> None:
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(
                f"Vehicle classifier model not found at: {self.model_path}"
            )
        opts = ort.SessionOptions()
        opts.intra_op_num_threads = 2
        self.session = ort.InferenceSession(
            self.model_path, sess_options=opts, providers=["CPUExecutionProvider"]
        )
        self.is_loaded = True
        self.warmup()

    def warmup(self) -> None:
        dummy = np.zeros((1, 3, 224, 224), dtype=np.float32)
        self.session.run(None, {"input": dummy})

    def _preprocess(self, image_rgb: np.ndarray) -> np.ndarray:
        img = Image.fromarray(image_rgb)
        w, h = img.size
        scale = 256 / min(w, h)
        img = img.resize((round(w * scale), round(h * scale)), Image.BILINEAR)
        w, h = img.size
        left = (w - 224) // 2
        top = (h - 224) // 2
        img = img.crop((left, top, left + 224, top + 224))
        arr = np.asarray(img).astype(np.float32) / 255.0
        arr = (arr - _IMAGENET_MEAN) / _IMAGENET_STD
        arr = arr.transpose(2, 0, 1)[None, ...].astype(np.float32)
        return arr

    def vehicle_probability(self, image_rgb: np.ndarray) -> float:
        """Returns the combined softmax probability mass over vehicle-related ImageNet classes."""
        if not self.is_loaded or self.session is None:
            raise RuntimeError("Vehicle classifier is not loaded. Call load_model() first.")
        inp = self._preprocess(image_rgb)
        logits = self.session.run(None, {"input": inp})[0][0]
        probs = _softmax(logits)
        return float(probs[VEHICLE_CLASS_INDICES].sum())

    def looks_like_vehicle(
        self, image_rgb: np.ndarray, threshold: float = VEHICLE_PROB_THRESHOLD
    ) -> bool:
        return self.vehicle_probability(image_rgb) >= threshold
