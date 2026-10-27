# CarDD YOLOv8n FastAPI Inference Backend

Production-ready, Dockerized FastAPI backend serving YOLOv8n vehicle damage detection on CPU using TensorFlow Lite (LiteRT + XNNPACK) or ONNX Runtime.

---

## 1. Quick Start with Docker (Local or VPS)

### Build and Run with Docker Compose
```bash
cd backend
docker compose up -d --build
```

### Check Logs & Status
```bash
docker compose logs -f
```

The server will be reachable at `http://<YOUR_IP>:7000`.

---

## 2. API Endpoints

### Health Check: `GET /health`
```bash
curl -s http://localhost:7000/health | jq
```
Response:
```json
{
  "status": "ok",
  "model_loaded": true,
  "model_name": "yolov8n.tflite",
  "version": "1.0.0"
}
```

### Damage Detection: `POST /api/v1/detect`
```bash
curl -X POST http://localhost:7000/api/v1/detect \
  -F "image=@/path/to/car_photo.jpg" \
  -F "confidenceThreshold=0.25" \
  -F "iouThreshold=0.45" | jq
```

Response format strictly matches the mobile app's contract:
```json
{
  "requestId": "2f40da5b-7b75-4d76-b633-899ca84b5c77",
  "modelName": "yolov8n-tflite",
  "image": {
    "width": 1920,
    "height": 1080
  },
  "detections": [
    {
      "classId": 0,
      "className": "dent",
      "confidence": 0.8942,
      "bbox": {
        "x1": 210.5,
        "y1": 140.2,
        "x2": 580.0,
        "y2": 420.8
      }
    }
  ],
  "annotatedImageUri": null,
  "processingTimeMs": 84.5
}
```

---

## 3. Deployment on VPS

1. **Clone the repository onto your VPS**:
   ```bash
   git clone <REPO_URL>
   cd car_insurance_project/backend
   ```
2. **Start the Docker container**:
   ```bash
   docker compose up -d --build
   ```
3. **Verify the public endpoint from your terminal**:
   ```bash
   curl http://<YOUR_VPS_PUBLIC_IP>:7000/health
   ```
4. **Connect your Android App in Expo Go**:
   - Open the **CarDamageDetection** app on your phone.
   - Navigate to the **Settings** tab.
   - Enter your VPS URL: `http://<YOUR_VPS_PUBLIC_IP>:7000`.
   - Tap **Save**.
   - Capture a vehicle photo and tap **Analyse Damage**.
