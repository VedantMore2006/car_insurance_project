from typing import List, Optional
from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    x1: float = Field(..., description="Top-left X coordinate in original image pixels")
    y1: float = Field(..., description="Top-left Y coordinate in original image pixels")
    x2: float = Field(..., description="Bottom-right X coordinate in original image pixels")
    y2: float = Field(..., description="Bottom-right Y coordinate in original image pixels")


class DetectionItem(BaseModel):
    classId: int = Field(..., description="0-indexed class ID (0: dent, 1: scratch, 2: crack, etc.)")
    className: str = Field(..., description="Human-readable damage category name")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence score")
    bbox: BoundingBox


class ImageMetadata(BaseModel):
    width: int = Field(..., gt=0, description="Original image width in pixels")
    height: int = Field(..., gt=0, description="Original image height in pixels")


class DetectionResponse(BaseModel):
    requestId: Optional[str] = Field(None, description="Unique identifier for request tracing")
    modelName: Optional[str] = Field(None, description="Name and runtime of the inference model")
    image: ImageMetadata
    detections: List[DetectionItem]
    annotatedImageUri: Optional[str] = Field(None, description="Optional URI to annotated overlay image")
    processingTimeMs: Optional[float] = Field(None, description="Total inference + postprocess latency in milliseconds")


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_name: str
    version: str = "1.0.0"


class DamageSummaryPayload(BaseModel):
    detectedLabels: List[str] = Field(default_factory=list, description="Unique damage class labels detected")
    damageCount: int = Field(0, description="Total number of detected damages")
    highestConfidenceClass: Optional[str] = Field(None, description="Class name with highest confidence")
    highestConfidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Highest confidence score")
    detections: List[DetectionItem] = Field(default_factory=list, description="Full list of detections")
    imageUri: Optional[str] = Field(None, description="Reference URI to scanned image")


class ClaimSubmissionRequest(BaseModel):
    claimantName: str = Field(..., min_length=1, description="Full name of claimant")
    policyNumber: str = Field(..., min_length=1, description="Insurance policy number")
    carRegistrationNumber: str = Field(..., min_length=1, description="Vehicle registration plate number")
    contactPhone: str = Field(..., min_length=1, description="Contact phone number")
    damageReport: DamageSummaryPayload = Field(..., description="Pre-populated damage report from model")
    submittedAt: Optional[str] = Field(None, description="ISO timestamp of submission")


class ClaimSubmissionResponse(BaseModel):
    status: str = Field("success", description="Status string: success or error")
    claimId: str = Field(..., description="Unique UUID for the submitted claim")
    referenceNumber: str = Field(..., description="Human-friendly claim reference code, e.g. CLM-2026-A8F9B2")
    message: str = Field("Claim submitted successfully", description="Status message")
    timestamp: str = Field(..., description="ISO timestamp of claim receipt")

