import {scaleBoxToDisplay, computeContainBox} from '../../src/utils/imageUtils';

describe('computeContainBox', () => {
  it('letterboxes a wider image inside a taller container (bars on top/bottom)', () => {
    // natural image is wide (1000x500), container is square (400x400)
    const box = computeContainBox(400, 400, 1000, 500);
    expect(box.width).toBeCloseTo(400);
    expect(box.height).toBeCloseTo(200);
    expect(box.x).toBeCloseTo(0);
    expect(box.y).toBeCloseTo(100);
  });

  it('letterboxes a taller image inside a wider container (bars on sides)', () => {
    const box = computeContainBox(400, 400, 500, 1000);
    expect(box.height).toBeCloseTo(400);
    expect(box.width).toBeCloseTo(200);
    expect(box.y).toBeCloseTo(0);
    expect(box.x).toBeCloseTo(100);
  });
});

describe('scaleBoxToDisplay', () => {
  it('scales an original-pixel bbox proportionally into a smaller display box', () => {
    const scaled = scaleBoxToDisplay(
      {x1: 100, y1: 100, x2: 300, y2: 400},
      1000,
      1000,
      500,
      500,
    );
    expect(scaled.left).toBeCloseTo(50);
    expect(scaled.top).toBeCloseTo(50);
    expect(scaled.width).toBeCloseTo(100);
    expect(scaled.height).toBeCloseTo(150);
  });

  it('returns a zero-sized box when original dimensions are invalid', () => {
    const scaled = scaleBoxToDisplay(
      {x1: 0, y1: 0, x2: 10, y2: 10},
      0,
      0,
      500,
      500,
    );
    expect(scaled).toEqual({left: 0, top: 0, width: 0, height: 0});
  });
});
