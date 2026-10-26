import os, time, json, csv, cv2, numpy as np, psutil, torch
import onnxruntime as ort
from ai_edge_litert.interpreter import Interpreter
from ultralytics import YOLO

root = "/home/vedant/car ins"
cv2.setNumThreads(1)
torch.set_num_threads(1)

with open(f"{root}/car_damage_benchmark_bundle/benchmark/latency_50_images.txt") as f:
    names = [l.strip() for l in f if l.strip()]
img_dir = f"{root}/car_damage_benchmark_bundle/dataset/images/val"
paths = [os.path.join(img_dir, n) for n in names]
paths = [p for p in paths if os.path.exists(p)]
print(f"Latency sample: {len(paths)}/{len(names)} images found")

def letterbox(img, new_shape=640):
    h, w = img.shape[:2]
    r = min(new_shape/h, new_shape/w)
    nh, nw = int(round(h*r)), int(round(w*r))
    resized = cv2.resize(img, (nw, nh))
    canvas = np.full((new_shape, new_shape, 3), 114, dtype=np.uint8)
    top = (new_shape-nh)//2; left = (new_shape-nw)//2
    canvas[top:top+nh, left:left+nw] = resized
    return canvas

imgs_bgr = [cv2.imread(p) for p in paths]  # preload, excluded from timing

process = psutil.Process(os.getpid())

per_image_rows = []  # model, pass, image, latency_ms
model_stats = {}

def record_mem_peak():
    try:
        return process.memory_info().rss / (1024*1024)
    except Exception:
        return None

# ---------------- PT ----------------
t0 = time.perf_counter()
pt_model = YOLO(f"{root}/best.pt")
init_pt = (time.perf_counter() - t0) * 1000
torch.set_num_threads(1)

def pt_infer(img):
    t = time.perf_counter()
    pt_model.predict(img, imgsz=640, conf=0.25, iou=0.70, device='cpu', verbose=False)
    return (time.perf_counter() - t) * 1000

for i in range(5):
    pt_infer(imgs_bgr[i % len(imgs_bgr)])
mem_before = record_mem_peak()
peak_mem_pt = mem_before
for p in range(3):
    for idx, img in enumerate(imgs_bgr):
        lat = pt_infer(img)
        per_image_rows.append(['pt', p, names[idx], lat])
        m = record_mem_peak()
        if m and m > peak_mem_pt: peak_mem_pt = m
model_stats['pt'] = {'init_ms': init_pt, 'peak_mem_mb': peak_mem_pt, 'threads': torch.get_num_threads()}

# ---------------- ONNX ----------------
t0 = time.perf_counter()
so = ort.SessionOptions()
so.intra_op_num_threads = 1
so.inter_op_num_threads = 1
sess = ort.InferenceSession(f"{root}/best.onnx", sess_options=so, providers=['CPUExecutionProvider'])
init_onnx = (time.perf_counter() - t0) * 1000
inp_name = sess.get_inputs()[0].name

def preprocess_onnx(img):
    lb = letterbox(img, 640)
    im = cv2.cvtColor(lb, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    im = np.transpose(im, (2, 0, 1))[None, ...]
    return im

pre_onnx = [preprocess_onnx(img) for img in imgs_bgr]

def onnx_infer(im):
    t = time.perf_counter()
    sess.run(None, {inp_name: im})
    return (time.perf_counter() - t) * 1000

for i in range(5):
    onnx_infer(pre_onnx[i % len(pre_onnx)])
peak_mem_onnx = record_mem_peak()
for p in range(3):
    for idx, im in enumerate(pre_onnx):
        lat = onnx_infer(im)
        per_image_rows.append(['onnx', p, names[idx], lat])
        m = record_mem_peak()
        if m and m > peak_mem_onnx: peak_mem_onnx = m
model_stats['onnx'] = {'init_ms': init_onnx, 'peak_mem_mb': peak_mem_onnx, 'threads': so.intra_op_num_threads}

# ---------------- TFLite ----------------
t0 = time.perf_counter()
interp = Interpreter(model_path=f"{root}/best.tflite", num_threads=1)
interp.allocate_tensors()
init_tflite = (time.perf_counter() - t0) * 1000
inp_d = interp.get_input_details()[0]
out_d = interp.get_output_details()[0]

def preprocess_tflite(img):
    lb = letterbox(img, 640)
    im = cv2.cvtColor(lb, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    im = np.transpose(im, (2, 0, 1))[None, ...]
    return im

pre_tf = [preprocess_tflite(img) for img in imgs_bgr]

def tflite_infer(im):
    t = time.perf_counter()
    interp.set_tensor(inp_d['index'], im)
    interp.invoke()
    _ = interp.get_tensor(out_d['index'])
    return (time.perf_counter() - t) * 1000

for i in range(5):
    tflite_infer(pre_tf[i % len(pre_tf)])
peak_mem_tf = record_mem_peak()
for p in range(3):
    for idx, im in enumerate(pre_tf):
        lat = tflite_infer(im)
        per_image_rows.append(['tflite', p, names[idx], lat])
        m = record_mem_peak()
        if m and m > peak_mem_tf: peak_mem_tf = m
model_stats['tflite'] = {'init_ms': init_tflite, 'peak_mem_mb': peak_mem_tf, 'threads': 1}

# ---------------- aggregate ----------------
os.makedirs(f"{root}/benchmark_results", exist_ok=True)
with open(f"{root}/benchmark_results/per_image_latency.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(['model', 'pass', 'image', 'latency_ms'])
    w.writerows(per_image_rows)

file_sizes = {
    'pt': os.path.getsize(f"{root}/best.pt") / (1024*1024),
    'onnx': os.path.getsize(f"{root}/best.onnx") / (1024*1024),
    'tflite': os.path.getsize(f"{root}/best.tflite") / (1024*1024),
}

agg = {}
for model in ['pt', 'onnx', 'tflite']:
    lats = np.array([r[3] for r in per_image_rows if r[0] == model])
    agg[model] = {
        'mean_ms': float(lats.mean()),
        'median_ms': float(np.median(lats)),
        'p90_ms': float(np.percentile(lats, 90)),
        'p95_ms': float(np.percentile(lats, 95)),
        'stdev_ms': float(lats.std()),
        'throughput_img_s': float(1000.0 / lats.mean()),
        'init_ms': model_stats[model]['init_ms'],
        'peak_mem_mb': model_stats[model]['peak_mem_mb'],
        'threads': model_stats[model]['threads'],
        'file_size_mb': file_sizes[model],
        'n_measurements': len(lats),
    }

with open(f"{root}/benchmark_results/scripts/latency_summary.json", "w") as f:
    json.dump(agg, f, indent=2)

print(json.dumps(agg, indent=2))
