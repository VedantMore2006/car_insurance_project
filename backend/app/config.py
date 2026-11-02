import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Model configuration
DEFAULT_MODEL_PATH = str(BASE_DIR / "model" / "yolov8n.tflite")
MODEL_PATH = os.getenv("MODEL_PATH", DEFAULT_MODEL_PATH)

# Inference defaults
DEFAULT_CONF_THRESHOLD = float(os.getenv("DEFAULT_CONF_THRESHOLD", "0.25"))
DEFAULT_IOU_THRESHOLD = float(os.getenv("DEFAULT_IOU_THRESHOLD", "0.45"))
MAX_DETECTIONS = int(os.getenv("MAX_DETECTIONS", "300"))

# Vehicle-presence gate (rejects non-car images, e.g. a laptop/desk photo, before damage
# inference). Threshold is intentionally conservative -- see vehicle_classifier.py docstring.
VEHICLE_CLASSIFIER_MODEL_PATH = os.getenv(
    "VEHICLE_CLASSIFIER_MODEL_PATH",
    str(BASE_DIR / "model" / "mobilenetv2_imagenet.onnx"),
)
VEHICLE_PROB_THRESHOLD = float(os.getenv("VEHICLE_PROB_THRESHOLD", "0.02"))
VEHICLE_CLASSIFIER_ENABLED = os.getenv(
    "VEHICLE_CLASSIFIER_ENABLED", "true"
).lower() in ("true", "1", "yes")

# Security & API key configuration
API_KEY = os.getenv("API_KEY", "").strip()
MAX_IMAGE_SIZE_BYTES = int(os.getenv("MAX_IMAGE_SIZE_BYTES", str(25 * 1024 * 1024)))  # 25 MB max

# Video upload limits -- mirrors the mobile client's validation.ts (100MB / 60s), since both
# sides should reject the same inputs rather than disagreeing on what's "too big".
MAX_VIDEO_SIZE_BYTES = int(os.getenv("MAX_VIDEO_SIZE_BYTES", str(100 * 1024 * 1024)))  # 100 MB max
MAX_VIDEO_DURATION_SECONDS = int(os.getenv("MAX_VIDEO_DURATION_SECONDS", "60"))
# How many frames to sample evenly across the clip for damage inference. The overlay the mobile
# app draws is a single static set of boxes (not synced to video playback time), so we run
# detection per sampled frame and keep whichever frame scored the most/best detections.
VIDEO_SAMPLE_FRAMES = int(os.getenv("VIDEO_SAMPLE_FRAMES", "6"))

# Server configuration
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "7000"))
DEBUG = os.getenv("DEBUG", "false").lower() in ("true", "1", "yes")

# CarDD 6 damage classes mapping
CLASS_NAMES = {
    0: "dent",
    1: "scratch",
    2: "crack",
    3: "glass shatter",
    4: "lamp broken",
    5: "tire flat",
}
