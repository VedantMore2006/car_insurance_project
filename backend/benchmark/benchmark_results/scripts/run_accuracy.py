import json, os, torch, cv2
from ultralytics import YOLO

cv2.setNumThreads(1)
torch.set_num_threads(1)

root = "/home/vedant/car ins"
data_yaml = f"{root}/car_damage_benchmark_bundle/dataset/data.yaml"
out = {}

def extract(r):
    return {
        'precision': float(r.box.mp),
        'recall': float(r.box.mr),
        'map50': float(r.box.map50),
        'map50-95': float(r.box.map),
        'per_class_ap50': {str(k): float(v) for k, v in zip(r.box.ap_class_index.tolist(), r.box.ap50.tolist())},
        'per_class_p': {str(k): float(v) for k, v in zip(r.box.ap_class_index.tolist(), r.box.p.tolist())} if hasattr(r.box,'p') else {},
        'per_class_r': {str(k): float(v) for k, v in zip(r.box.ap_class_index.tolist(), r.box.r.tolist())} if hasattr(r.box,'r') else {},
        'names': r.names,
    }

for name, weight, task_kw in [('pt', 'best.pt', {}), ('onnx', 'best.onnx', {'task':'detect'}), ('tflite', 'best.tflite', {'task':'detect'})]:
    try:
        m = YOLO(f"{root}/{weight}", **task_kw)
        r = m.val(data=data_yaml, imgsz=640, conf=0.25, iou=0.70, batch=1, device='cpu', verbose=False, plots=False)
        out[name] = extract(r)
        out[name]['status'] = 'ok'
        out[name]['path'] = 'ultralytics .val() direct'
    except Exception as e:
        out[name] = {'status': 'failed', 'error': str(e)}
    with open(f"{root}/benchmark_results/scripts/accuracy_results.json", "w") as f:
        json.dump(out, f, indent=2, default=str)

print("DONE")
print(json.dumps({k: {kk:vv for kk,vv in v.items() if kk not in ('per_class_ap50','per_class_p','per_class_r','names')} for k,v in out.items()}, indent=2))
