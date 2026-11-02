import logging
import os
import tempfile
from typing import List, Tuple

import cv2
import numpy as np

from ..config import MAX_VIDEO_DURATION_SECONDS
from .image import MAX_DIM, MIN_DIM

logger = logging.getLogger("cardd_backend.video")

# Container magic-byte signatures, same spirit as image.py's validate_magic_bytes -- blocks
# payloads that aren't actually one of the video formats the mobile client offers (mp4/mov/webm).
# MP4/MOV (ISO base media / QuickTime) files store their type in an "ftyp" box, not at byte 0.
_FTYP_BRANDS = (b"isom", b"mp42", b"mp41", b"qt  ", b"M4V ", b"3gp", b"dash")


def validate_video_magic_bytes(header: bytes) -> None:
    if len(header) < 12:
        raise ValueError("Video file too small to contain valid format headers.")

    if header[4:8] == b"ftyp" and any(header[8:12].startswith(b) for b in _FTYP_BRANDS):
        return
    # WebM/Matroska: EBML header
    if header.startswith(b"\x1a\x45\xdf\xa3"):
        return

    raise ValueError(
        "File content does not match allowed video signatures (MP4, MOV, WebM)."
    )


def extract_sampled_frames(
    video_bytes: bytes, max_frames: int
) -> Tuple[List[np.ndarray], int, int]:
    """
    Decodes a video and returns up to `max_frames` RGB frames, evenly spaced across the clip,
    along with the video's (width, height). OpenCV's VideoCapture needs a real file path, not an
    in-memory buffer, so the bytes are written to a temp file for the duration of the read.

    Returns:
        (frames_rgb, width, height)
    """
    validate_video_magic_bytes(video_bytes[:16])

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp.write(video_bytes)
        tmp_path = tmp.name

    try:
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            raise ValueError("Could not open video. Please upload a standard MP4, MOV, or WebM clip.")

        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 0
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        if width < MIN_DIM or height < MIN_DIM:
            cap.release()
            raise ValueError(f"Video frame size too small ({width}x{height}).")
        if width > MAX_DIM or height > MAX_DIM:
            cap.release()
            raise ValueError(f"Video frame size ({width}x{height}) exceeds safe limit of {MAX_DIM}px.")
        if frame_count <= 0:
            cap.release()
            raise ValueError("Video contains no readable frames.")
        if fps > 0 and frame_count / fps > MAX_VIDEO_DURATION_SECONDS + 1:
            cap.release()
            raise ValueError(
                f"Video duration exceeds the maximum allowed length of {MAX_VIDEO_DURATION_SECONDS}s."
            )

        sample_count = min(max_frames, frame_count)
        # Evenly spaced indices across the clip, skipping the very first/last frame (often a
        # black or motion-blurred transition frame on mobile camera recordings).
        indices = np.linspace(0, frame_count - 1, sample_count + 2, dtype=int)[1:-1]

        frames: List[np.ndarray] = []
        for idx in indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
            ok, frame_bgr = cap.read()
            if not ok or frame_bgr is None:
                continue
            frames.append(cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB))

        cap.release()

        if not frames:
            raise ValueError("Could not decode any frames from the uploaded video.")

        return frames, width, height
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            logger.warning("Failed to remove temp video file: %s", tmp_path)
