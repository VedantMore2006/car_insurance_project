import React from 'react';
import {render, act} from '@testing-library/react-native';
import {processColor} from 'react-native';
import DamageOverlayView from '../../src/components/DamageOverlayView';
import {computeContainBox, scaleBoxToDisplay} from '../../src/utils/imageUtils';
import {Detection} from '../../src/features/inspection/types/detection.types';
import {colors} from '../../src/config/theme';

/**
 * Fixtures standing in for 5 real car-scan photos: different camera orientations/resolutions and
 * damage bbox placements, used to validate that DamageOverlayView's scaling math (shared with the
 * already-covered imageUtils helpers) lines boxes up with the right pixels for each one, and that
 * severity color coding is applied correctly at each confidence tier.
 */
const FIXTURES: {
  name: string;
  originalWidth: number;
  originalHeight: number;
  containerSize: {width: number; height: number};
  detection: Detection;
}[] = [
  {
    name: 'landscape photo, front bumper dent (major)',
    originalWidth: 4032,
    originalHeight: 3024,
    containerSize: {width: 360, height: 360},
    detection: {
      classId: 0,
      className: 'dent',
      confidence: 0.92,
      bbox: {x1: 1200, y1: 1400, x2: 2000, y2: 2100},
    },
  },
  {
    name: 'portrait photo, door scratch (moderate)',
    originalWidth: 3024,
    originalHeight: 4032,
    containerSize: {width: 320, height: 480},
    detection: {
      classId: 1,
      className: 'scratch',
      confidence: 0.64,
      bbox: {x1: 400, y1: 1800, x2: 1600, y2: 2400},
    },
  },
  {
    name: 'square crop, windshield crack (major)',
    originalWidth: 2000,
    originalHeight: 2000,
    containerSize: {width: 300, height: 300},
    detection: {
      classId: 2,
      className: 'crack',
      confidence: 0.81,
      bbox: {x1: 100, y1: 100, x2: 900, y2: 700},
    },
  },
  {
    name: 'wide landscape, light scratch (minor)',
    originalWidth: 4000,
    originalHeight: 2250,
    containerSize: {width: 400, height: 225},
    detection: {
      classId: 1,
      className: 'scratch',
      confidence: 0.38,
      bbox: {x1: 3000, y1: 1500, x2: 3800, y2: 2000},
    },
  },
  {
    name: 'tall portrait, flat tire near edge (moderate)',
    originalWidth: 1080,
    originalHeight: 1920,
    containerSize: {width: 270, height: 480},
    detection: {
      classId: 5,
      className: 'tire flat',
      confidence: 0.55,
      bbox: {x1: 0, y1: 1400, x2: 400, y2: 1900},
    },
  },
];

async function triggerLayout(
  element: {props: {onLayout?: (event: unknown) => void}},
  size: {width: number; height: number},
) {
  await act(async () => {
    element.props.onLayout?.({
      nativeEvent: {layout: {x: 0, y: 0, ...size}},
    });
    await Promise.resolve();
  });
}

function expectedBoxFor(fixture: (typeof FIXTURES)[number]) {
  const imageBox = computeContainBox(
    fixture.containerSize.width,
    fixture.containerSize.height,
    fixture.originalWidth,
    fixture.originalHeight,
  );
  const scaled = scaleBoxToDisplay(
    fixture.detection.bbox,
    fixture.originalWidth,
    fixture.originalHeight,
    imageBox.width,
    imageBox.height,
  );
  return {
    x: imageBox.x + scaled.left,
    y: imageBox.y + scaled.top,
    width: scaled.width,
    height: scaled.height,
  };
}

describe('DamageOverlayView alignment across real-scan-like fixtures', () => {
  it.each(FIXTURES)(
    '$name: draws the bounding box at the correctly scaled position',
    async fixture => {
      const {getByTestId} = await render(
        <DamageOverlayView
          imageUri="file:///scan.jpg"
          detections={[fixture.detection]}
          originalWidth={fixture.originalWidth}
          originalHeight={fixture.originalHeight}
        />,
      );

      await triggerLayout(getByTestId('damage-overlay-view'), fixture.containerSize);

      const box = getByTestId('damage-overlay-view-box-0');
      const expected = expectedBoxFor(fixture);

      expect(box.props.x).toBeCloseTo(expected.x, 1);
      expect(box.props.y).toBeCloseTo(expected.y, 1);
      expect(box.props.width).toBeCloseTo(expected.width, 1);
      expect(box.props.height).toBeCloseTo(expected.height, 1);

      // The box must stay within the rendered image region, never inside the letterbox bars.
      const imageBox = computeContainBox(
        fixture.containerSize.width,
        fixture.containerSize.height,
        fixture.originalWidth,
        fixture.originalHeight,
      );
      expect(box.props.x).toBeGreaterThanOrEqual(imageBox.x - 0.5);
      expect(box.props.y).toBeGreaterThanOrEqual(imageBox.y - 0.5);
      expect(box.props.x + box.props.width).toBeLessThanOrEqual(
        imageBox.x + imageBox.width + 0.5,
      );
      expect(box.props.y + box.props.height).toBeLessThanOrEqual(
        imageBox.y + imageBox.height + 0.5,
      );
    },
  );

  it.each(FIXTURES)(
    '$name: colors the box by its confidence severity tier',
    async fixture => {
      const {getByTestId} = await render(
        <DamageOverlayView
          imageUri="file:///scan.jpg"
          detections={[fixture.detection]}
          originalWidth={fixture.originalWidth}
          originalHeight={fixture.originalHeight}
        />,
      );

      await triggerLayout(getByTestId('damage-overlay-view'), fixture.containerSize);

      const box = getByTestId('damage-overlay-view-box-0');
      const confidence = fixture.detection.confidence;
      const expectedColor =
        confidence > 0.75
          ? colors.severityMajor
          : confidence >= 0.5
            ? colors.severityModerate
            : colors.severityMinor;

      // react-native-svg's native Rect encodes "stroke" as a processed color object rather than
      // the raw hex string, so compare via the same color-processing pipeline.
      expect(box.props.stroke.payload).toBe(processColor(expectedColor));
    },
  );
});

describe('DamageOverlayView edge cases', () => {
  it('renders nothing until container layout is known, even with natural size provided', async () => {
    const {queryByTestId} = await render(
      <DamageOverlayView
        imageUri="file:///scan.jpg"
        detections={[]}
        originalWidth={1000}
        originalHeight={1000}
      />,
    );
    expect(queryByTestId('damage-overlay-view-svg')).toBeNull();
  });

  it('renders one box per detection', async () => {
    const detections: Detection[] = [
      {classId: 0, className: 'dent', confidence: 0.9, bbox: {x1: 0, y1: 0, x2: 100, y2: 100}},
      {classId: 1, className: 'scratch', confidence: 0.3, bbox: {x1: 200, y1: 200, x2: 300, y2: 300}},
    ];
    const {getByTestId} = await render(
      <DamageOverlayView
        imageUri="file:///scan.jpg"
        detections={detections}
        originalWidth={1000}
        originalHeight={1000}
      />,
    );

    await triggerLayout(getByTestId('damage-overlay-view'), {width: 300, height: 300});

    expect(getByTestId('damage-overlay-view-box-0')).toBeTruthy();
    expect(getByTestId('damage-overlay-view-box-1')).toBeTruthy();
  });
});
