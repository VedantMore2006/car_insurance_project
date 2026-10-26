export interface ScaledBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Scales a detection bbox (expressed in the ORIGINAL image's pixel coordinates) into coordinates
 * for a displayed preview of size displayWidth x displayHeight (e.g. a React Native <Image> sized
 * with `resizeMode="contain"`'s rendered box may differ from the raw bbox space).
 *
 * Assumes the displayed image fills exactly displayWidth x displayHeight (i.e. caller passes the
 * actual rendered image box, not the outer container, when resizeMode='contain' introduces
 * letterboxing). See DetectionOverlay for how this is used with a "contain"-fitted box.
 */
export function scaleBoxToDisplay(
  bbox: {x1: number; y1: number; x2: number; y2: number},
  originalWidth: number,
  originalHeight: number,
  displayWidth: number,
  displayHeight: number,
): ScaledBox {
  if (originalWidth <= 0 || originalHeight <= 0) {
    return {left: 0, top: 0, width: 0, height: 0};
  }
  const scaleX = displayWidth / originalWidth;
  const scaleY = displayHeight / originalHeight;
  const left = bbox.x1 * scaleX;
  const top = bbox.y1 * scaleY;
  const width = Math.max(0, (bbox.x2 - bbox.x1) * scaleX);
  const height = Math.max(0, (bbox.y2 - bbox.y1) * scaleY);
  return {left, top, width, height};
}

/**
 * Given a container size and an image's natural size, computes the rendered box of the image
 * under resizeMode="contain" (letterboxed) — needed before calling scaleBoxToDisplay so overlay
 * boxes line up with the actual pixels, not the empty letterbox bars.
 */
export function computeContainBox(
  containerWidth: number,
  containerHeight: number,
  naturalWidth: number,
  naturalHeight: number,
): {x: number; y: number; width: number; height: number} {
  if (
    naturalWidth <= 0 ||
    naturalHeight <= 0 ||
    containerWidth <= 0 ||
    containerHeight <= 0
  ) {
    return {x: 0, y: 0, width: containerWidth, height: containerHeight};
  }
  const containerRatio = containerWidth / containerHeight;
  const imageRatio = naturalWidth / naturalHeight;
  let width: number;
  let height: number;
  if (imageRatio > containerRatio) {
    width = containerWidth;
    height = containerWidth / imageRatio;
  } else {
    height = containerHeight;
    width = containerHeight * imageRatio;
  }
  const x = (containerWidth - width) / 2;
  const y = (containerHeight - height) / 2;
  return {x, y, width, height};
}

export function fileNameFromUri(uri: string): string {
  const parts = uri.split('/');
  return parts[parts.length - 1] || uri;
}
