import {DAMAGE_CLASSES, getClassName} from '../../src/config/damageClasses';

describe('damageClasses config', () => {
  it('has exactly 16 classes in the documented order', () => {
    expect(DAMAGE_CLASSES).toHaveLength(16);
    expect(DAMAGE_CLASSES[0]).toBe('Front-Windscreen-Damage');
    expect(DAMAGE_CLASSES[15]).toBe('roof-dent');
  });

  it('returns the correct class name for a valid id', () => {
    expect(getClassName(7)).toBe('bonnet-dent');
  });

  it('returns a placeholder for an out-of-range id instead of throwing', () => {
    expect(getClassName(999)).toBe('Unknown-Class-999');
    expect(getClassName(-1)).toBe('Unknown-Class--1');
  });
});
