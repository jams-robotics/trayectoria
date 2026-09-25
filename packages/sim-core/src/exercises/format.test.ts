import { describe, expect, test } from 'vitest';

import { format } from './format';

describe('F1-10 format', () => {
  test('golden value: format(20.944, "rad/s") = "20.9 rad/s"', () => {
    expect(format(20.944, 'rad/s')).toBe('20.9 rad/s');
  });

  test('golden value: format(0.670, "m/s") = "0.670 m/s"', () => {
    expect(format(0.67, 'm/s')).toBe('0.670 m/s');
  });

  test('keeps trailing zeros up to the requested significant figures', () => {
    expect(format(1, 'm')).toBe('1.00 m');
    expect(format(2.5, 'kg')).toBe('2.50 kg');
    expect(format(100, 'N')).toBe('100 N');
    expect(format(0.1, 's', 4)).toBe('0.1000 s');
  });

  test('rounds to the requested significant figures', () => {
    expect(format(1234, 'W')).toBe('1230 W');
    expect(format(0.0123456, 'm')).toBe('0.0123 m');
    expect(format(9.999, 'V', 2)).toBe('10 V');
    expect(format(20.944, 'rad/s', 5)).toBe('20.944 rad/s');
  });

  test('omits the space when the unit is empty', () => {
    expect(format(3.14159, '')).toBe('3.14');
    expect(format(0.5, '')).toBe('0.500');
  });

  test('handles zero and negative numbers', () => {
    expect(format(0, 'm')).toBe('0.00 m');
    expect(format(-0.670, 'm/s')).toBe('-0.670 m/s');
    expect(format(-1234, 'Nm')).toBe('-1230 Nm');
  });

  test('avoids exponential notation for 1e-3 <= |x| < 1e6', () => {
    expect(format(0.001, 'm')).toBe('0.00100 m');
    expect(format(999999, 'm')).toBe('1000000 m');
    expect(format(123456, 'm')).toBe('123000 m');
  });

  test('uses exponential notation outside 1e-3 <= |x| < 1e6', () => {
    expect(format(1e-4, 'm')).toBe('1.00e-4 m');
    expect(format(1.5e7, 'W')).toBe('1.50e+7 W');
  });

  test('shows floating-point noise around zero as zero, never exponential or "-0.00" (#350)', () => {
    expect(format(1e-16, 'm')).toBe('0.00 m');
    expect(format(-1e-16, 'm')).toBe('0.00 m');
    expect(format(-2.220446049250313e-16, 'm')).toBe('0.00 m');
    expect(format(-0, 'm')).toBe('0.00 m');
    // A small but real value keeps its exponential form.
    expect(format(1e-9, 'm')).toBe('1.00e-9 m');
  });

  test('rejects non-finite numbers and invalid significant figures', () => {
    expect(() => format(Number.NaN, 'm')).toThrow(/finite/);
    expect(() => format(Number.POSITIVE_INFINITY, 'm')).toThrow(/finite/);
    expect(() => format(1, 'm', 0)).toThrow(/sigFigs/);
    expect(() => format(1, 'm', 2.5)).toThrow(/sigFigs/);
  });
});
