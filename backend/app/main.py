import os
import uuid
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from fastapi import Depends, FastAPI, File, Form, HTTPException, Security, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import APIKeyHeader
import secrets

from .config import (
    MODEL_PATH,
    API_KEY,
    MAX_IMAGE_SIZE_BYTES,
    MAX_VIDEO_SIZE_BYTES,
    VIDEO_SAMPLE_FRAMES,
    DEFAULT_CONF_THRESHOLD,
    DEFAULT_IOU_THRESHOLD,
    DEBUG,
    VEHICLE_CLASSIFIER_ENABLED,
    VEHICLE_PROB_THRESHOLD,
)
from .schemas import (
    ClaimSubmissionRequest,
    ClaimSubmissionResponse,
    DetectionItem,
    DetectionResponse,
    HealthResponse,
    ImageMetadata,
)
from .services.inference import DamageDetector
from .services.vehicle_classifier import VehicleClassifier
from .utils.image import load_image_from_bytes
from .utils.video import extract_sampled_frames

VIDEO_CONTENT_TYPES = {"video/mp4", "video/quicktime", "video/x-m4v", "video/webm", "video/3gpp"}
VIDEO_EXTENSIONS = (".mp4", ".mov", ".m4v", ".webm", ".3gp")

logging.basicConfig(
    level=logging.INFO if not DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("cardd_backend")

# Global model runner instances
detector = DamageDetector(model_path=MODEL_PATH)
vehicle_classifier = VehicleClassifier()

# Security: API Key validation
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: Optional[str] = Security(api_key_header)):
    """
    Enforces API key authentication if API_KEY is set in the environment.
    Uses constant-time comparison to protect against timing attacks.
    """
    if not API_KEY:
        return True  # If API_KEY is empty in dev, allow access
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing required authentication header: X-API-Key",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    if not secrets.compare_digest(api_key, API_KEY):
        logger.warning("Unauthorized access attempt with invalid API key")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key provided",
        )
    return True


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Load YOLO model and perform warmup inference
    logger.info("Initializing DamageDetector with model: %s", MODEL_PATH)
    if API_KEY:
        logger.info("Security: API Key validation enabled (X-API-Key required)")
    else:
        logger.warning("Security: API_KEY not set - server is running without authentication")
    try:
        detector.load_model()
        logger.info("Model loaded successfully (%s engine ready)", detector.model_type)
    except Exception as e:
        logger.error("Failed to load model on startup: %s", e, exc_info=True)
        raise e
    if VEHICLE_CLASSIFIER_ENABLED:
        try:
            vehicle_classifier.load_model()
            logger.info(
                "Vehicle-presence gate enabled (threshold=%.3f)", VEHICLE_PROB_THRESHOLD
            )
        except Exception as e:
            logger.error(
                "Failed to load vehicle classifier on startup: %s", e, exc_info=True
            )
            raise e
    else:
        logger.warning("Vehicle-presence gate disabled (VEHICLE_CLASSIFIER_ENABLED=false)")
    yield
    # Shutdown logic if any
    logger.info("Shutting down Car Damage Detection API")


app = FastAPI(
    title="Car Damage Detection Inference API",
    description="High-performance YOLOv8n inference backend for vehicle damage assessment",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for Expo Go and all external clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint to verify backend status and model readiness."""
    return HealthResponse(
        status="ok",
        model_loaded=detector.is_loaded,
        model_name=os.path.basename(detector.model_path),
        version="1.0.0",
    )


def _best_video_frame(
    frames, conf_thresh: float, iou_thresh: float
) -> Tuple[List[DetectionItem], float, bool]:
    """
    Runs the vehicle-presence gate + damage detector on each sampled frame and returns the
    detections/processing-time of whichever frame scored best (most detections, tie-broken by
    summed confidence) among frames that pass the vehicle gate. The mobile overlay is a single
    static set of boxes, not synced to playback time, so one representative frame's result is
    what gets returned -- matching how a single photo upload already behaves.

    Returns (detections, total_processing_time_ms, any_frame_had_vehicle).
    """
    best_detections: List[DetectionItem] = []
    best_score = (-1, -1.0)
    any_vehicle = False
    total_time_ms = 0.0

    for frame_rgb in frames:
        if VEHICLE_CLASSIFIER_ENABLED:
            vehicle_prob = vehicle_classifier.vehicle_probability(frame_rgb)
            if vehicle_prob < VEHICLE_PROB_THRESHOLD:
                continue
        any_vehicle = True

        h, w = frame_rgb.shape[:2]
        detections, processing_time_ms = detector.predict(
            image_rgb=frame_rgb,
            orig_w=w,
            orig_h=h,
            conf_threshold=conf_thresh,
            iou_threshold=iou_thresh,
        )
        total_time_ms += processing_time_ms

        score = (len(detections), sum(d.confidence for d in detections))
        if score > best_score:
            best_score = score
            best_detections = detections

    return best_detections, round(total_time_ms, 2), any_vehicle


@app.post(
    "/api/v1/detect",
    response_model=DetectionResponse,
    status_code=status.HTTP_200_OK,
)
@app.post(
    "/predict",
    response_model=DetectionResponse,
    status_code=status.HTTP_200_OK,
)
@app.post(
    "/api/v1/predict",
    response_model=DetectionResponse,
    status_code=status.HTTP_200_OK,
)
async def detect_damage(
    image: UploadFile = File(
        ..., description="Vehicle image (JPEG, PNG, WebP) or short video clip (MP4, MOV, WebM)"
    ),
    confidenceThreshold: Optional[float] = Form(
        None, description="Optional minimum detection confidence threshold [0.0 - 1.0]"
    ),
    iouThreshold: Optional[float] = Form(
        None, description="Optional NMS IoU overlap threshold [0.0 - 1.0]"
    ),
    _authorized: bool = Depends(verify_api_key),
):
    """
    Analyzes an uploaded car damage photo or short video clip, identifies damage classes, and
    returns accurate bounding box coordinates aligned to original frame dimensions.
    """
    request_id = str(uuid.uuid4())

    # 1. Validate file presence and format
    if not image or not image.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No image file provided in upload request",
        )

    filename_lower = image.filename.lower()
    is_video = (image.content_type in VIDEO_CONTENT_TYPES) or filename_lower.endswith(
        VIDEO_EXTENSIONS
    )

    # 2. Read file content and enforce size limits
    try:
        file_bytes = await image.read()
    except Exception as e:
        logger.error("Failed to read upload bytes: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read upload: {str(e)}",
        )

    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes)",
        )

    max_size = MAX_VIDEO_SIZE_BYTES if is_video else MAX_IMAGE_SIZE_BYTES
    if len(file_bytes) > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Uploaded file exceeds maximum allowed size ({max_size // (1024 * 1024)} MB)",
        )

    # 3. Resolve threshold parameters (shared by both paths)
    conf_thresh = (
        confidenceThreshold
        if confidenceThreshold is not None and 0.0 <= confidenceThreshold <= 1.0
        else DEFAULT_CONF_THRESHOLD
    )
    iou_thresh = (
        iouThreshold
        if iouThreshold is not None and 0.0 <= iouThreshold <= 1.0
        else DEFAULT_IOU_THRESHOLD
    )

    if is_video:
        # 4a. Decode and sample frames across the clip
        try:
            frames, orig_w, orig_h = extract_sampled_frames(file_bytes, VIDEO_SAMPLE_FRAMES)
        except ValueError as ve:
            logger.warning("Rejected invalid video upload (security check): %s", ve)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Security verification failed: {str(ve)}",
            )
        except Exception as e:
            logger.warning("Unexpected error during video decoding: %s", e)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Could not process video. Please upload a standard MP4, MOV, or WebM clip.",
            )

        # 5a. Run the vehicle gate + damage detector per sampled frame, keep the best frame
        try:
            detections, processing_time_ms, any_vehicle = _best_video_frame(
                frames, conf_thresh, iou_thresh
            )
        except Exception as e:
            logger.error("Video inference execution failed: %s", e, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Inference pipeline execution error: {str(e)}",
            )

        if VEHICLE_CLASSIFIER_ENABLED and not any_vehicle:
            logger.info("Rejected video upload: no vehicle detected in any sampled frame")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No vehicle detected in the video. Please record a clear clip of a car.",
            )

        logger.info(
            "Request %s: %d detections found in %.2f ms (video %dx%d, %d frames sampled)",
            request_id[:8],
            len(detections),
            processing_time_ms,
            orig_w,
            orig_h,
            len(frames),
        )
    else:
        # 4b. Decode image, sanitize metadata, and correct EXIF orientation
        try:
            image_rgb, orig_w, orig_h = load_image_from_bytes(file_bytes)
        except ValueError as ve:
            logger.warning("Rejected invalid image upload (security check): %s", ve)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Security verification failed: {str(ve)}",
            )
        except Exception as e:
            logger.warning("Unexpected error during image decoding: %s", e)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Could not process image. Please upload a standard JPEG, PNG, or WebP photo.",
            )

        # 5b. Reject images that don't plausibly contain a vehicle (e.g. a laptop/desk photo)
        # before running the damage model, which was never trained to recognize "is this a car".
        if VEHICLE_CLASSIFIER_ENABLED:
            try:
                vehicle_prob = vehicle_classifier.vehicle_probability(image_rgb)
            except Exception as e:
                logger.error("Vehicle-presence check failed: %s", e, exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Vehicle-presence check failed during image processing.",
                )
            if vehicle_prob < VEHICLE_PROB_THRESHOLD:
                logger.info(
                    "Rejected upload: no vehicle detected (vehicle_prob=%.4f < %.4f)",
                    vehicle_prob,
                    VEHICLE_PROB_THRESHOLD,
                )
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="No vehicle detected in the image. Please upload a clear photo of a car.",
                )

        # 6b. Run inference pipeline
        try:
            detections, processing_time_ms = detector.predict(
                image_rgb=image_rgb,
                orig_w=orig_w,
                orig_h=orig_h,
                conf_threshold=conf_thresh,
                iou_threshold=iou_thresh,
            )
        except Exception as e:
            logger.error("Inference execution failed: %s", e, exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Inference pipeline execution error: {str(e)}",
            )

        logger.info(
            "Request %s: %d detections found in %.2f ms (image %dx%d)",
            request_id[:8],
            len(detections),
            processing_time_ms,
            orig_w,
            orig_h,
        )

    return DetectionResponse(
        requestId=request_id,
        modelName=f"yolov8n-{detector.model_type}",
        image=ImageMetadata(width=orig_w, height=orig_h),
        detections=detections,
        annotatedImageUri=None,
        processingTimeMs=processing_time_ms,
    )


@app.post(
    "/api/v1/claims",
    response_model=ClaimSubmissionResponse,
    status_code=status.HTTP_201_CREATED,
)
@app.post(
    "/claims",
    response_model=ClaimSubmissionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_claim(
    claim_data: ClaimSubmissionRequest,
    _authorized: bool = Depends(verify_api_key),
):
    """
    Submits an insurance damage claim with verified claimant details and pre-populated
    damage report. Generates a trackable claim reference number.
    """
    claim_id = str(uuid.uuid4())
    year = datetime.now(timezone.utc).year
    random_code = secrets.token_hex(3).upper()
    reference_number = f"CLM-{year}-{random_code}"
    receipt_time = datetime.now(timezone.utc).isoformat()

    logger.info(
        "Claim received: ref=%s, claimant='%s', policy='%s', car='%s', damages=%d",
        reference_number,
        claim_data.claimantName,
        claim_data.policyNumber,
        claim_data.carRegistrationNumber,
        claim_data.damageReport.damageCount,
    )

    return ClaimSubmissionResponse(
        status="success",
        claimId=claim_id,
        referenceNumber=reference_number,
        message="Insurance claim submitted and registered successfully.",
        timestamp=receipt_time,
    )



@app.exception_handler(Exception)
async def generic_exception_handler(_request, exc):
    logger.error("Unhandled server exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred during request processing."},
    )
