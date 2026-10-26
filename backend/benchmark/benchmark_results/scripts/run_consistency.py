import os, json, csv, cv2, numpy as np, torch
import onnxruntime as ort
from ai_edge_litert.interpreter import Interpreter
from ultralytics import YOLO

root = "/home/vedant/car ins"
img_dir = f"{root}/car_damage_benchmark_bundle/dataset/images/val"
with open(f"{root}/car_damage_benchmark_bundle/benchmark/latency_50_images.txt") as f:
    names = [l.strip() for l in f if l.strip()]
paths = [os.path.join(img_dir, n) for n in names if os.path.exists(os.path.join(img_dir, n))]
NC = 16
CONF_TH, IOU_TH = 0.25, 0.70

def letterbox(img, new_shape=640):
    h, w = img.shape[:2]
    r = min(new_shape/h, new_shape/w)
    nh, nw = int(round(h*r)), int(round(w*r))
    resized = cv2.resize(img, (nw, nh))
    canvas = np.full((new_shape, new_shape, 3), 114, dtype=np.uint8)
    top = (new_shape-nh)//2; left = (new_shape-nw)//2
    canvas[top:top+nh, left:left+nw] = resized
    return canvas, r, left, top

def xywh2xyxy(x):
    y = np.copy(x)
    y[...,0] = x[...,0]-x[...,2]/2; y[...,1] = x[...,1]-x[...,3]/2
    y[...,2] = x[...,0]+x[...,2]/2; y[...,3] = x[...,1]+x[...,3]/2
    return y

def nms(boxes, scores, iou_thres):
    idxs = scores.argsort()[::-1]; keep = []
    while idxs.size > 0:
        i = idxs[0]; keep.append(i)
        if idxs.size == 1: break
        rest = idxs[1:]
        xx1 = np.maximum(boxes[i,0], boxes[rest,0]); yy1 = np.maximum(boxes[i,1], boxes[rest,1])
        xx2 = np.minimum(boxes[i,2], boxes[rest,2]); yy2 = np.minimum(boxes[i,3], boxes[rest,3])
        w = np.maximum(0, xx2-xx1); h = np.maximum(0, yy2-yy1); inter = w*h
        area_i = (boxes[i,2]-boxes[i,0])*(boxes[i,3]-boxes[i,1])
        area_r = (boxes[rest,2]-boxes[rest,0])*(boxes[rest,3]-boxes[rest,1])
        iou = inter/(area_i+area_r-inter+1e-9)
        idxs = rest[iou <= iou_thres]
    return keep

def decode(out, conf_th=CONF_TH, iou_th=IOU_TH, normalized=False):
    pred = out[0].T
    boxes_xywh = pred[:, :4] * (640.0 if normalized else 1.0)
    scores_all = pred[:, 4:4+NC]
    cls = scores_all.argmax(1); conf = scores_all.max(1)
    mask = conf > conf_th
    boxes_xywh, cls, conf = boxes_xywh[mask], cls[mask], conf[mask]
    boxes_xyxy = xywh2xyxy(boxes_xywh)
    final = []
    for c in np.unique(cls):
        m = cls == c
        b, s = boxes_xyxy[m], conf[m]
        for k in nms(b, s, iou_th):
            final.append([*b[k], s[k], c])
    return np.array(final) if final else np.zeros((0,6))

def iou_matrix(a, b):
    if len(a)==0 or len(b)==0: return np.zeros((len(a), len(b)))
    ax1,ay1,ax2,ay2 = a[:,0:1],a[:,1:2],a[:,2:3],a[:,3:4]
    bx1,by1,bx2,by2 = b[:,0],b[:,1],b[:,2],b[:,3]
    xx1=np.maximum(ax1,bx1); yy1=np.maximum(ay1,by1); xx2=np.minimum(ax2,bx2); yy2=np.minimum(ay2,by2)
    w=np.clip(xx2-xx1,0,None); h=np.clip(yy2-yy1,0,None); inter=w*h
    area_a=(ax2-ax1)*(ay2-ay1); area_b=(bx2-bx1)*(by2-by1)
    return inter/(area_a+area_b-inter+1e-9)

# ---- PT detections (via ultralytics, pixel space, xyxy) ----
pt_model = YOLO(f"{root}/best.pt")
pt_dets = {}
for p, name in zip(paths, names):
    r = pt_model.predict(p, imgsz=640, conf=CONF_TH, iou=IOU_TH, device='cpu', verbose=False)[0]
    if r.boxes is not None and len(r.boxes):
        d = r.boxes.data.cpu().numpy()  # x1,y1,x2,y2,conf,cls
    else:
        d = np.zeros((0,6))
    pt_dets[name] = d

# ---- ONNX detections ----
sess = ort.InferenceSession(f"{root}/best.onnx", providers=['CPUExecutionProvider'])
inp_name = sess.get_inputs()[0].name
onnx_dets = {}
for p, name in zip(paths, names):
    img = cv2.imread(p)
    lb, r, pad_l, pad_t = letterbox(img, 640)
    im = cv2.cvtColor(lb, cv2.COLOR_BGR2RGB).astype(np.float32)/255.0
    im = np.transpose(im,(2,0,1))[None,...]
    out = sess.run(None, {inp_name: im})[0]
    d = decode(out, normalized=False)
    if len(d):
        d[:,[0,2]] = (d[:,[0,2]]-pad_l)/r
        d[:,[1,3]] = (d[:,[1,3]]-pad_t)/r
    onnx_dets[name] = d

# ---- TFLite detections ----
interp = Interpreter(model_path=f"{root}/best.tflite")
interp.allocate_tensors()
inp_d = interp.get_input_details()[0]; out_d = interp.get_output_details()[0]
tflite_dets = {}
for p, name in zip(paths, names):
    img = cv2.imread(p)
    lb, r, pad_l, pad_t = letterbox(img, 640)
    im = cv2.cvtColor(lb, cv2.COLOR_BGR2RGB).astype(np.float32)/255.0
    im = np.transpose(im,(2,0,1))[None,...]
    interp.set_tensor(inp_d['index'], im)
    interp.invoke()
    out = interp.get_tensor(out_d['index'])
    d = decode(out, normalized=True)
    if len(d):
        d[:,[0,2]] = (d[:,[0,2]]-pad_l)/r
        d[:,[1,3]] = (d[:,[1,3]]-pad_t)/r
    tflite_dets[name] = d

def compare(ref_dets, other_dets, label):
    total_ref = 0; matched = 0; class_agree = 0
    conf_diffs = []; box_diffs = []; iou_complements = []
    ref_missing = 0; other_extra = 0
    for name in names:
        ref = ref_dets[name]; other = other_dets[name]
        total_ref += len(ref)
        matched_other = np.zeros(len(other), dtype=bool)
        ious = iou_matrix(ref[:,:4], other[:,:4]) if len(ref) and len(other) else np.zeros((len(ref), len(other)))
        for i in range(len(ref)):
            best_j, best_iou = -1, 0
            for j in range(len(other)):
                if matched_other[j]: continue
                if other[j,5] != ref[i,5]: continue  # class-aware
                if ious[i,j] >= 0.5 and ious[i,j] > best_iou:
                    best_j, best_iou = j, ious[i,j]
            if best_j >= 0:
                matched_other[best_j] = True
                matched += 1
                class_agree += 1  # class-aware match by construction
                conf_diffs.append(abs(ref[i,4]-other[best_j,4]))
                box_diffs.append(np.abs(ref[i,:4]-other[best_j,:4]).mean())
                iou_complements.append(1-best_iou)
            else:
                ref_missing += 1
        other_extra += (~matched_other).sum()
    pct_matched = matched/total_ref*100 if total_ref else float('nan')
    return {
        'pair': label,
        'total_ref_detections': int(total_ref),
        'pct_ref_matched': pct_matched,
        'class_agreement_rate_among_matches': 100.0 if matched else float('nan'),
        'mean_abs_conf_diff': float(np.mean(conf_diffs)) if conf_diffs else float('nan'),
        'mean_abs_box_coord_diff_px': float(np.mean(box_diffs)) if box_diffs else float('nan'),
        'mean_iou_complement_among_matches': float(np.mean(iou_complements)) if iou_complements else float('nan'),
        'count_in_ref_missing_in_other': int(ref_missing),
        'count_in_other_not_in_ref': int(other_extra),
    }

results = [
    compare(pt_dets, onnx_dets, 'onnx_vs_pt'),
    compare(pt_dets, tflite_dets, 'tflite_vs_pt'),
]

with open(f"{root}/benchmark_results/prediction_consistency.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(results[0].keys()))
    w.writeheader()
    for r in results: w.writerow(r)

print(json.dumps(results, indent=2))
