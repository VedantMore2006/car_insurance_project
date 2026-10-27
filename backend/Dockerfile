# ==============================================================================
# Production Dockerfile for CarDD YOLOv8n Inference Backend
# ==============================================================================
FROM python:3.11-slim AS runtime

# Set environment flags
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MODEL_PATH=/app/model/yolov8n.tflite \
    PORT=7000 \
    HOST=0.0.0.0

# Install runtime system packages (curl for healthcheck, libglib for basic OS bindings)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency definition and install wheels
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy model artifacts and application code
COPY model/ ./model/
COPY app/ ./app/

# Create a non-privileged user for enhanced container security
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# Expose the API port
EXPOSE 7000

# Docker healthcheck checking the /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:7000/health || exit 1

# Launch uvicorn server with 2 worker processes
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7000", "--workers", "2"]
