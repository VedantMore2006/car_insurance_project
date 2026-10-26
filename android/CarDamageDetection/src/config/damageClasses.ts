/**
 * Centralized, single source of truth for damage class names/order.
 *
 * This MUST match `car_damage_benchmark_bundle/dataset/data.yaml` (`names:` list) used to train
 * best.pt / best.onnx / best.tflite. Do not re-sort this list — class index order is load-bearing:
 * a model's `classId` output is an index into this array.
 *
 * Kept replaceable: nothing else in the app hardcodes "16" or copies this list. Code should use
 * `DAMAGE_CLASSES.length` and `getClassName()` so a future model with a different class set only
 * requires editing this one file.
 */
export const DAMAGE_CLASSES: readonly string[] = [
  'Front-Windscreen-Damage',
  'Headlight-Damage',
  'Rear-windscreen-Damage',
  'RunningBoard-Dent',
  'Sidemirror-Damage',
  'Signlight-Damage',
  'Taillight-Damage',
  'bonnet-dent',
  'boot-dent',
  'doorouter-dent',
  'fender-dent',
  'front-bumper-dent',
  'pillar-dent',
  'quaterpanel-dent',
  'rear-bumper-dent',
  'roof-dent',
] as const;

/** Safe lookup: returns a placeholder instead of throwing if the backend sends an out-of-range id. */
export function getClassName(classId: number): string {
  if (
    !Number.isInteger(classId) ||
    classId < 0 ||
    classId >= DAMAGE_CLASSES.length
  ) {
    return `Unknown-Class-${classId}`;
  }
  return DAMAGE_CLASSES[classId];
}
