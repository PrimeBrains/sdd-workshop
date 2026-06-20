import { describe, expect, it } from 'vitest';
import { computeCpi, computeSpi } from './indices.js';

describe('SPI / CPI (§3 MODEL:201)', () => {
  it('SPI = EV_abs / PV, null when PV = 0', () => {
    expect(computeSpi(20, 25)).toBeCloseTo(0.8, 10);
    expect(computeSpi(10, 0)).toBeNull();
  });

  it('CPI = EV_abs / AC, null when AC = 0', () => {
    expect(computeCpi(20, 25)).toBeCloseTo(0.8, 10);
    expect(computeCpi(10, 0)).toBeNull();
  });
});
