import io
from typing import Tuple
import cv2
import numpy as np
from PIL import Image, ImageOps


def load_image_from_bytes(image_bytes: bytes) -> Tuple[np.ndarray, int, int]:
    """
    Decodes image bytes into an RGB numpy array while applying EXIF orientation
    correction (essential for phone camera captures).

    Returns:
        (image_rgb, original_width, original_height)
    """
    pil_image = Image.open(io.BytesIO(image_bytes))
    # Correct orientation based on EXIF tags (e.g. phone portrait/landscape)
    pil_image = ImageOps.exif_transpose(pil_image)
    if pil_image.mode != "RGB":
        pil_image = pil_image.convert("RGB")
    
    orig_w, orig_h = pil_image.size
    image_rgb = np.array(pil_image, dtype=np.uint8)
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
