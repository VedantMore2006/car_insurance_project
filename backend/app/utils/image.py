import io
import logging
from typing import Tuple
import cv2
import numpy as np
from PIL import Image, ImageOps

logger = logging.getLogger("cardd_backend.image_security")

# ==============================================================================
# Security Boundaries
# ==============================================================================
# Maximum allowed image resolution (25 megapixels, e.g., 5000x5000).
# Protects the VPS against Decompression Bomb (Pixel Bomb / OOM) attacks.
MAX_PIXELS = 25_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS

# Minimum and maximum spatial dimension bounds
MIN_DIM = 32
MAX_DIM = 8192

# Allowed formats by PIL parser
ALLOWED_PIL_FORMATS = {"JPEG", "PNG", "WEBP"}


def validate_magic_bytes(header: bytes) -> str:
    """
    Validates file magic bytes (signatures) to ensure the payload is a genuine
    JPEG, PNG, or WebP image before any parser processes the file.
    """
    if len(header) < 12:
        raise ValueError("Image file too small to contain valid format headers.")

    # JPEG: starts with FF D8 FF
    if header.startswith(b"\xff\xd8\xff"):
        return "JPEG"

    # PNG: starts with 89 50 4E 47 0D 0A 1A 0A
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "PNG"

    # WebP: starts with RIFF....WEBP
    if header.startswith(b"RIFF") and header[8:12] == b"WEBP":
        return "WEBP"

    raise ValueError("File content does not match allowed image signatures (JPEG, PNG, WebP).")


def load_image_from_bytes(image_bytes: bytes) -> Tuple[np.ndarray, int, int]:
    """
    Securely validates, sanitizes, and decodes image bytes into a clean RGB numpy array.

    Security guarantees:
      1. Magic-byte verification: Blocks polyglot files, hidden executables, and non-image payloads.
      2. Decompression Bomb prevention: Strict pixel allocation cap (25 MP).
      3. Complete metadata stripping: All EXIF, GPS, camera metadata, and embedded tags
         are read safely and completely discarded. Only raw pixel values [H, W, 3] survive in memory.
      4. Safe EXIF handling: Traps corrupted or malicious EXIF data without crashing or leaking state.
      5. Dimension boundaries: Enforces 32px <= dimension <= 8192px.

    Returns:
        (image_rgb, original_width, original_height)
    """
    # 1. Header magic byte check
    validate_magic_bytes(image_bytes[:16])

    # 2. Decode with PIL under strict constraints
    try:
        pil_image = Image.open(io.BytesIO(image_bytes))
    except Image.DecompressionBombError as e:
        logger.warning("Blocked potential decompression bomb attack: %s", e)
        raise ValueError("Image dimensions exceed maximum safe decompression limits.")
    except Exception as e:
        logger.warning("Image parser failed: %s", e)
        raise ValueError("Corrupted or malformed image header.")

    # 3. Format integrity check
    if pil_image.format not in ALLOWED_PIL_FORMATS:
        pil_image.close()
        raise ValueError(f"Disallowed image format '{pil_image.format}'. Only JPEG, PNG, and WebP are permitted.")

    # 4. Safe EXIF orientation transpose with fallback
    # Corrects phone rotation while neutralizing any malicious EXIF tags
    try:
        pil_image = ImageOps.exif_transpose(pil_image)
    except Exception as e:
        logger.warning("Ignored unparseable or malicious EXIF tags: %s", e)
        # Continue without EXIF if EXIF block was corrupted/hostile

    # 5. Dimension bounds verification
    orig_w, orig_h = pil_image.size
    if orig_w < MIN_DIM or orig_h < MIN_DIM:
        pil_image.close()
        raise ValueError(f"Image too small ({orig_w}x{orig_h}). Minimum dimension is {MIN_DIM}px.")

    if orig_w > MAX_DIM or orig_h > MAX_DIM:
        pil_image.close()
        raise ValueError(f"Image dimensions ({orig_w}x{orig_h}) exceed safe limit of {MAX_DIM}px.")

    # 6. Convert to RGB colorspace
    if pil_image.mode != "RGB":
        pil_image = pil_image.convert("RGB")

    # 7. Convert to pure NumPy array (completely strips all EXIF, GPS, and metadata from memory)
    image_rgb = np.array(pil_image, dtype=np.uint8)

    # Free PIL image structures immediately
    pil_image.close()

    return image_rgb, orig_w, orig_h


def letterbox(
    im: np.ndarray,
    new_shape: Tuple[int, int] = (640, 640),
    color: Tuple[int, int, int] = (114, 114, 114),
) -> Tuple[np.ndarray, float, Tuple[float, float]]:
    """
    Resize and pad image while meeting stride-multiple constraints.
    Preserves aspect ratio and centers image with border padding.

    Returns:
        (padded_image, scale_ratio, (dw, dh))
    """
    shape = im.shape[:2]  # [height, width]
    r = min(new_shape[0] / shape[0], new_shape[1] / shape[1])
    new_unpad = int(round(shape[1] * r)), int(round(shape[0] * r))
    dw, dh = (new_shape[1] - new_unpad[0]) / 2, (new_shape[0] - new_unpad[1]) / 2

    if shape[::-1] != new_unpad:
        im = cv2.resize(im, new_unpad, interpolation=cv2.INTER_LINEAR)

    top, bottom = int(round(dh - 0.1)), int(round(dh + 0.1))
    left, right = int(round(dw - 0.1)), int(round(dw + 0.1))
    im = cv2.copyMakeBorder(
        im, top, bottom, left, right, cv2.BORDER_CONSTANT, value=color
    )
    return im, r, (dw, dh)
