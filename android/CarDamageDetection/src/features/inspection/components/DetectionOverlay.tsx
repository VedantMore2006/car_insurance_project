import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {colors, typography} from '../../../config/theme';
import {Detection} from '../types/detection.types';
import {computeContainBox, scaleBoxToDisplay} from '../../../utils/imageUtils';
import {formatConfidence} from '../../../utils/formatters';

interface DetectionOverlayProps {
  detections: Detection[];
  originalWidth: number;
  originalHeight: number;
  containerWidth: number;
  containerHeight: number;
}

/**
 * Renders bounding boxes over an image displayed with resizeMode="contain" inside a container of
 * size containerWidth x containerHeight. Computes the letterboxed image box first, then scales
 * each detection's original-pixel bbox into that box's coordinate space.
 */
export default function DetectionOverlay({
  detections,
  originalWidth,
  originalHeight,
  containerWidth,
  containerHeight,
}: DetectionOverlayProps) {
  if (
    !originalWidth ||
    !originalHeight ||
    !containerWidth ||
    !containerHeight
  ) {
    return null;
  }
  const imageBox = computeContainBox(
    containerWidth,
    containerHeight,
    originalWidth,
    originalHeight,
  );

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      testID="detection-overlay">
      {detections.map((detection, index) => {
        const scaled = scaleBoxToDisplay(
          detection.bbox,
          originalWidth,
          originalHeight,
          imageBox.width,
          imageBox.height,
        );
        return (
          <View
            key={`${detection.classId}-${index}`}
            style={[
              styles.box,
              {
                left: imageBox.x + scaled.left,
                top: imageBox.y + scaled.top,
                width: scaled.width,
                height: scaled.height,
              },
            ]}>
            <Text style={styles.label} numberOfLines={1}>
              {detection.className} {formatConfidence(detection.confidence)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.overlayBox,
    borderRadius: 2,
  },
  label: {
    ...typography.caption,
    color: colors.textPrimary,
    backgroundColor: colors.overlayBox,
    position: 'absolute',
    top: -18,
    left: -2,
    paddingHorizontal: 4,
  },
});
