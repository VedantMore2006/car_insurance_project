import React, {useEffect, useState} from 'react';
import {Image, LayoutChangeEvent, StyleSheet, View} from 'react-native';
import Svg, {Rect, Text as SvgText} from 'react-native-svg';
import {Detection} from '../features/inspection/types/detection.types';
import {computeContainBox, scaleBoxToDisplay} from '../utils/imageUtils';
import {getSeverityColor} from '../utils/damageSeverity';
import {colors, radius} from '../config/theme';

interface DamageOverlayViewProps {
  /** URI of the captured/selected vehicle image to display underneath the overlay. */
  imageUri: string;
  /** Damage detections returned by the model, in ORIGINAL image pixel coordinates. */
  detections: Detection[];
  /**
   * Original (model-output) image dimensions the bbox coordinates are expressed in. If omitted,
   * they're resolved from the image file itself via Image.getSize so the component also works
   * standalone with just a uri + detections.
   */
  originalWidth?: number;
  originalHeight?: number;
  testID?: string;
}

const LABEL_HEIGHT = 18;
const LABEL_CHAR_WIDTH = 6.5; // rough monospace-ish estimate for label background sizing
const LABEL_PADDING_X = 4;

/**
 * Draws the source image with color-coded SVG bounding boxes + labels over each detected damage
 * zone, scaled from the model's original-pixel coordinates to the actual on-screen image box
 * (accounting for resizeMode="contain" letterboxing).
 *
 * Color coding is confidence-based: red (> 0.75), orange (0.5 - 0.75), yellow (< 0.5).
 */
export default function DamageOverlayView({
  imageUri,
  detections,
  originalWidth,
  originalHeight,
  testID = 'damage-overlay-view',
}: DamageOverlayViewProps) {
  const [containerSize, setContainerSize] = useState({width: 0, height: 0});
  const [naturalSize, setNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(
    originalWidth && originalHeight
      ? {width: originalWidth, height: originalHeight}
      : null,
  );

  useEffect(() => {
    if (originalWidth && originalHeight) {
      return;
    }
    let cancelled = false;
    Image.getSize(
      imageUri,
      (width, height) => {
        if (!cancelled) {
          setNaturalSize({width, height});
        }
      },
      () => {
        // Leave naturalSize as-is; overlay simply won't render boxes until resolved.
      },
    );
    return () => {
      cancelled = true;
    };
  }, [imageUri, originalWidth, originalHeight]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const {width, height} = event.nativeEvent.layout;
    setContainerSize({width, height});
  };

  const canRenderOverlay =
    !!naturalSize &&
    naturalSize.width > 0 &&
    naturalSize.height > 0 &&
    containerSize.width > 0 &&
    containerSize.height > 0;

  const imageBox = canRenderOverlay
    ? computeContainBox(
        containerSize.width,
        containerSize.height,
        naturalSize!.width,
        naturalSize!.height,
      )
    : null;

  return (
    <View style={styles.container} onLayout={handleLayout} testID={testID}>
      <Image source={{uri: imageUri}} style={styles.image} resizeMode="contain" />
      {canRenderOverlay && imageBox && (
        <Svg
          style={StyleSheet.absoluteFill}
          width={containerSize.width}
          height={containerSize.height}
          testID={`${testID}-svg`}>
          {detections.map((detection, index) => {
            const scaled = scaleBoxToDisplay(
              detection.bbox,
              naturalSize!.width,
              naturalSize!.height,
              imageBox.width,
              imageBox.height,
            );
            const x = imageBox.x + scaled.left;
            const y = imageBox.y + scaled.top;
            const color = getSeverityColor(detection.confidence);
            const label = `${detection.className} ${Math.round(
              detection.confidence * 100,
            )}%`;
            const labelWidth = label.length * LABEL_CHAR_WIDTH + LABEL_PADDING_X * 2;
            const labelY = Math.max(0, y - LABEL_HEIGHT);

            return (
              <React.Fragment key={`${detection.classId}-${index}`}>
                <Rect
                  x={x}
                  y={y}
                  width={scaled.width}
                  height={scaled.height}
                  stroke={color}
                  strokeWidth={2}
                  fill="transparent"
                  testID={`${testID}-box-${index}`}
                />
                <Rect
                  x={x}
                  y={labelY}
                  width={labelWidth}
                  height={LABEL_HEIGHT}
                  fill={color}
                  rx={radius.sm}
                />
                <SvgText
                  x={x + LABEL_PADDING_X}
                  y={labelY + LABEL_HEIGHT - 5}
                  fill={colors.background}
                  fontSize={11}
                  fontWeight="700">
                  {label}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {width: '100%', height: '100%'},
});
