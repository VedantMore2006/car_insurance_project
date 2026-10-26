"""
Custom TFLite accuracy adapter.
Ultralytics .val() requires the 'tensorflow' package for its TFLite backend
(AI's internal loader imports tensorflow.lite.Interpreter), which is not installed
and was NOT installed here (full tensorflow is a heavy, non-minimal dependency change,
unlike the lightweight ai-edge-litert runtime already used for raw inference).
This script implements the postprocessing independently:
  - decode raw (1,20,8400) box+class output (same layout verified against ONNX output)
  - class-aware NMS (conf=0.25, iou=0.70) matching Ultralytics defaults
  - greedy IoU>=0.5 class-aware matching against YOLO-format ground truth
  - precision/recall/AP50 per class (11-point/continuous interpolation) and mAP50-95
    averaged over IoU thresholds 0.50:0.95:0.05, mirroring Ultralytics' definition.
"""
import os, glob, json, numpy as np, cv2
from ai_edge_litert.interpreter import Interpreter

root = "/home/vedant/car ins"
ds = f"{root}/car_damage_benchmark_bundle/dataset"
img_dir = f"{ds}/images/val"
lbl_dir = f"{ds}/labels/val"
NC = 16
CONF_TH = 0.25
IOU_TH = 0.70

def letterbox(img, new_shape=640):
    h, w = img.shape[:2]
    r = min(new_shape/h, new_shape/w)
    nh, nw = int(round(h*r)), int(round(w*r))
    resized = cv2.resize(img, (nw, nh))
    canvas = np.full((new_shape, new_shape, 3), 114, dtype=np.uint8)
    top = (new_shape-nh)//2
    left = (new_shape-nw)//2
    canvas[top:top+nh, left:left+nw] = resized
    return canvas, r, left, top

def xywh2xyxy(x):
    y = np.copy(x)
    y[...,0] = x[...,0] - x[...,2]/2
    y[...,1] = x[...,1] - x[...,3]/2
    y[...,2] = x[...,0] + x[...,2]/2
    y[...,3] = x[...,1] + x[...,3]/2
    return y

def nms(boxes, scores, iou_thres):
    idxs = scores.argsort()[::-1]
    keep = []
    while idxs.size > 0:
        i = idxs[0]
        keep.append(i)
        if idxs.size == 1: break
        rest = idxs[1:]
        xx1 = np.maximum(boxes[i,0], boxes[rest,0])
        yy1 = np.maximum(boxes[i,1], boxes[rest,1])
        xx2 = np.minimum(boxes[i,2], boxes[rest,2])
        yy2 = np.minimum(boxes[i,3], boxes[rest,3])
        w = np.maximum(0, xx2-xx1); h = np.maximum(0, yy2-yy1)
        inter = w*h
        area_i = (boxes[i,2]-boxes[i,0])*(boxes[i,3]-boxes[i,1])
        area_r = (boxes[rest,2]-boxes[rest,0])*(boxes[rest,3]-boxes[rest,1])
        iou = inter/(area_i+area_r-inter+1e-9)
        idxs = rest[iou <= iou_thres]
    return keep

def decode(out, conf_th=CONF_TH, iou_th=IOU_TH):
    # out: (1,20,8400) -> (8400,20)
    pred = out[0].T
    boxes_xywh = pred[:, :4]
    scores_all = pred[:, 4:4+NC]
    cls = scores_all.argmax(1)
    conf = scores_all.max(1)
    mask = conf > conf_th
    boxes_xywh, cls, conf = boxes_xywh[mask], cls[mask], conf[mask]
    boxes_xyxy = xywh2xyxy(boxes_xywh)
    final = []
    for c in np.unique(cls):
        m = cls == c
        b, s = boxes_xyxy[m], conf[m]
        keep = nms(b, s, iou_th)
        for k in keep:
            final.append([*b[k], s[k], c])
    if not final:
        return np.zeros((0,6))
    return np.array(final)

def load_gt(label_path, iw, ih):
    boxes = []
    if os.path.exists(label_path):
        with open(label_path) as f:
            for line in f:
                p = line.split()
                if len(p) < 5: continue
                c, x, y, w, h = int(p[0]), *map(float, p[1:5])
                x1 = (x - w/2) * iw; y1 = (y - h/2) * ih
                x2 = (x + w/2) * iw; y2 = (y + h/2) * ih
                boxes.append([x1,y1,x2,y2,c])
    return np.array(boxes) if boxes else np.zeros((0,5))

def iou_matrix(a, b):
    if len(a) == 0 or len(b) == 0:
        return np.zeros((len(a), len(b)))
    ax1,ay1,ax2,ay2 = a[:,0:1],a[:,1:2],a[:,2:3],a[:,3:4]
    bx1,by1,bx2,by2 = b[:,0],b[:,1],b[:,2],b[:,3]
    xx1 = np.maximum(ax1, bx1); yy1 = np.maximum(ay1, by1)
    xx2 = np.minimum(ax2, bx2); yy2 = np.minimum(ay2, by2)
    w = np.clip(xx2-xx1, 0, None); h = np.clip(yy2-yy1, 0, None)
    inter = w*h
    area_a = (ax2-ax1)*(ay2-ay1)
    area_b = (bx2-bx1)*(by2-by1)
    return inter / (area_a + area_b - inter + 1e-9)

def ap_from_pr(rec, prec):
    mrec = np.concatenate(([0.], rec, [1.]))
    mpre = np.concatenate(([1.], prec, [0.]))
    for i in range(mpre.size-1, 0, -1):
        mpre[i-1] = max(mpre[i-1], mpre[i])
    idx = np.where(mrec[1:] != mrec[:-1])[0]
    return float(np.sum((mrec[idx+1]-mrec[idx]) * mpre[idx+1]))

def run():
    interp = Interpreter(model_path=f"{root}/best.tflite")
    interp.allocate_tensors()
    inp_d = interp.get_input_details()[0]
    out_d = interp.get_output_details()[0]

    img_files = sorted(glob.glob(f"{img_dir}/*"))
    # per-class, per-iou-threshold accumulation: list of (conf, tp/fp)
    iou_thresholds = np.arange(0.5, 1.0, 0.05)
    all_preds = {c: [] for c in range(NC)}  # c -> list of (conf, correct_at_0.5)
    all_preds_multi = {c: {round(t,2): [] for t in iou_thresholds} for c in range(NC)}
    gt_counts = {c: 0 for c in range(NC)}

    for img_path in img_files:
        img = cv2.imread(img_path)
        ih, iw = img.shape[:2]
        lb, r, pad_l, pad_t = letterbox(img, 640)
        im = cv2.cvtColor(lb, cv2.COLOR_BGR2RGB).astype(np.float32)/255.0
        im = np.transpose(im, (2,0,1))[None,...]
        interp.set_tensor(inp_d['index'], im)
        interp.invoke()
        out = interp.get_tensor(out_d['index'])
        det = decode(out)  # x1,y1,x2,y2,conf,cls normalized [0,1] in 640-space
        if det.shape[0]:
            det[:, :4] *= 640.0
            det[:, [0,2]] = (det[:, [0,2]] - pad_l) / r
            det[:, [1,3]] = (det[:, [1,3]] - pad_t) / r

        base = os.path.splitext(os.path.basename(img_path))[0]
        label_path = f"{lbl_dir}/{base}.txt"
        gt = load_gt(label_path, iw, ih)
        for c in gt[:,4].astype(int) if len(gt) else []:
            gt_counts[c] += 1

        for c in range(NC):
            det_c = det[det[:,5]==c] if len(det) else np.zeros((0,6))
            gt_c = gt[gt[:,4]==c] if len(gt) else np.zeros((0,5))
            if len(det_c) == 0:
                continue
            order = det_c[:,4].argsort()[::-1]
            det_c = det_c[order]
            ious = iou_matrix(det_c[:,:4], gt_c[:,:4]) if len(gt_c) else np.zeros((len(det_c),0))
            for thr in iou_thresholds:
                matched = np.zeros(len(gt_c), dtype=bool)
                for i in range(len(det_c)):
                    correct = 0
                    if len(gt_c):
                        j = ious[i].argmax() if ious.shape[1] else -1
                        if j >= 0 and ious[i,j] >= thr and not matched[j]:
                            matched[j] = True
                            correct = 1
                    all_preds_multi[c][round(thr,2)].append((det_c[i,4], correct))
            # for precision/recall @0.5 and AP50 explicitly
            matched05 = np.zeros(len(gt_c), dtype=bool)
            for i in range(len(det_c)):
                correct = 0
                if len(gt_c):
                    j = ious[i].argmax() if ious.shape[1] else -1
                    if j >= 0 and ious[i,j] >= 0.5 and not matched05[j]:
                        matched05[j] = True
                        correct = 1
                all_preds[c].append((det_c[i,4], correct))

    results = {'per_class': {}, 'map50_95_by_class': {}}
    ap50s, precs, recs = [], [], []
    for c in range(NC):
        preds = sorted(all_preds[c], key=lambda x: -x[0])
        n_gt = gt_counts[c]
        if len(preds) == 0:
            ap50 = 0.0 if n_gt > 0 else float('nan')
            p = 0.0; rc = 0.0
        else:
            tp = np.array([x[1] for x in preds])
            fp = 1 - tp
            tp_cum = np.cumsum(tp); fp_cum = np.cumsum(fp)
            rec = tp_cum / (n_gt + 1e-9)
            prec = tp_cum / (tp_cum + fp_cum + 1e-9)
            ap50 = ap_from_pr(rec, prec) if n_gt > 0 else 0.0
            p = float(tp.sum() / (len(tp)+1e-9))
            rc = float(tp.sum() / (n_gt+1e-9)) if n_gt>0 else 0.0
        aps_over_iou = []
        for thr in iou_thresholds:
            preds_t = sorted(all_preds_multi[c][round(thr,2)], key=lambda x: -x[0])
            if len(preds_t) == 0 or n_gt == 0:
                aps_over_iou.append(0.0)
                continue
            tp = np.array([x[1] for x in preds_t])
            fp = 1 - tp
            tp_cum = np.cumsum(tp); fp_cum = np.cumsum(fp)
            rec = tp_cum / (n_gt + 1e-9)
            prec = tp_cum / (tp_cum + fp_cum + 1e-9)
            aps_over_iou.append(ap_from_pr(rec, prec))
        map50_95_c = float(np.mean(aps_over_iou))
        results['per_class'][c] = {'ap50': ap50, 'precision': p, 'recall': rc, 'gt_count': n_gt, 'map50_95': map50_95_c}
        if n_gt > 0:
            ap50s.append(ap50); precs.append(p); recs.append(rc)

    results['precision'] = float(np.mean(precs)) if precs else 0.0
    results['recall'] = float(np.mean(recs)) if recs else 0.0
    results['map50'] = float(np.mean(ap50s)) if ap50s else 0.0
    results['map50-95'] = float(np.mean([results['per_class'][c]['map50_95'] for c in range(NC) if results['per_class'][c]['gt_count']>0]))
    results['status'] = 'ok'
    results['path'] = 'custom adapter: ai_edge_litert raw inference + manual class-aware NMS + greedy IoU matching (documented in tflite_adapter.py)'
    return results

if __name__ == '__main__':
    r = run()
    with open(f"{root}/benchmark_results/scripts/tflite_accuracy.json", "w") as f:
        json.dump(r, f, indent=2)
    print(json.dumps({k:v for k,v in r.items() if k!='per_class'}, indent=2))
