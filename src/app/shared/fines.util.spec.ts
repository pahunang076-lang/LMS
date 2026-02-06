import { describe, it, expect } from 'vitest';
import { calculateFine } from './fines.util';

describe('calculateFine', () => {
  it('returns 0 when returned on or before due date', () => {
    const due = new Date('2026-02-10T12:00:00Z');
    const onTime = new Date('2026-02-10T11:59:59Z');
    const early = new Date('2026-02-09T12:00:00Z');

    expect(calculateFine(due, onTime, 5)).toBe(0);
    expect(calculateFine(due, early, 5)).toBe(0);
  });

  it('charges for each started late day', () => {
    const due = new Date('2026-02-10T12:00:00Z');
    const oneDayLate = new Date('2026-02-11T11:59:59Z');
    const slightlyOverOneDayLate = new Date('2026-02-11T12:00:01Z');

    expect(calculateFine(due, oneDayLate, 5)).toBe(5);
    expect(calculateFine(due, slightlyOverOneDayLate, 5)).toBe(10);
  });
});

