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

# Security & API key configuration
API_KEY = os.getenv("API_KEY", "").strip()
MAX_IMAGE_SIZE_BYTES = int(os.getenv("MAX_IMAGE_SIZE_BYTES", str(25 * 1024 * 1024)))  # 25 MB max

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
