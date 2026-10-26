import json, numpy as np, cv2, time
import onnxruntime as ort
from ai_edge_litert.interpreter import Interpreter
from ultralytics import YOLO

root = "/home/vedant/car ins"
img_path = f"{root}/car_damage_benchmark_bundle/dataset/images/val"
import os
sample_img = os.path.join(img_path, os.listdir(img_path)[0])
img = cv2.imread(sample_img)

results = {}

# PT
pt = YOLO(f"{root}/best.pt")
r = pt.predict(sample_img, imgsz=640, conf=0.25, iou=0.70, verbose=False)
results['pt'] = {
    'names': pt.names,
    'nc': len(pt.names),
    'output_boxes_shape': list(r[0].boxes.data.shape) if r[0].boxes is not None else None,
    'note': 'Ultralytics wrapper, NMS applied internally by .predict()'
}

# ONNX
sess = ort.InferenceSession(f"{root}/best.onnx", providers=['CPUExecutionProvider'])
inp = sess.get_inputs()[0]
outs = sess.get_outputs()
im = cv2.resize(img, (640,640))
im = cv2.cvtColor(im, cv2.COLOR_BGR2RGB).astype(np.float32)/255.0
im = np.transpose(im, (2,0,1))[None,...]
out = sess.run(None, {inp.name: im})
results['onnx'] = {
    'input_name': inp.name, 'input_shape': inp.shape, 'input_type': str(inp.type),
    'output_names': [o.name for o in outs],
    'output_shapes_declared': [o.shape for o in outs],
    'output_shapes_actual': [list(o.shape) for o in out],
    'note': 'raw output, shape (1, 4+nc, num_anchors) -> NMS NOT embedded, needs decode'
}

# TFLite
interp = Interpreter(model_path=f"{root}/best.tflite")
interp.allocate_tensors()
inp_d = interp.get_input_details()
out_d = interp.get_output_details()
imt = cv2.resize(img, (640,640))
imt = cv2.cvtColor(imt, cv2.COLOR_BGR2RGB)
dtype = inp_d[0]['dtype']
if dtype == np.uint8 or dtype == np.int8:
    imt_in = imt.astype(dtype)
else:
    imt_in = (imt.astype(np.float32)/255.0)
print("TFLITE INPUT SHAPE EXPECTED:", inp_d[0]['shape'])
if list(inp_d[0]['shape']) == [1,3,640,640]:
    imt_in = np.transpose(imt_in, (2,0,1))
imt_in = imt_in[None,...]
interp.set_tensor(inp_d[0]['index'], imt_in)
interp.invoke()
outs_t = [interp.get_tensor(o['index']) for o in out_d]
results['tflite'] = {
    'input_details': [{'shape': d['shape'].tolist(), 'dtype': str(d['dtype']), 'quant': d.get('quantization')} for d in inp_d],
    'output_details': [{'shape': d['shape'].tolist(), 'dtype': str(d['dtype']), 'quant': d.get('quantization')} for d in out_d],
    'output_shapes_actual': [list(o.shape) for o in outs_t],
    'note': 'raw output similarly shaped, NMS NOT embedded unless shape indicates otherwise'
}

with open(f"{root}/benchmark_results/scripts/model_inspection.json", "w") as f:
    json.dump(results, f, indent=2, default=str)
print(json.dumps(results, indent=2, default=str))
