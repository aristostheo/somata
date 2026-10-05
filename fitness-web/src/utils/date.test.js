import { dayKey, startOfWeek } from './date';

test('uses the local calendar day at midnight and late at night', () => {
  expect(dayKey(new Date(2026, 8, 23, 0, 1))).toBe('2026-09-23');
  expect(dayKey(new Date(2026, 8, 23, 23, 59))).toBe('2026-09-23');
});

test('handles local year boundaries', () => {
  expect(dayKey(new Date(2026, 0, 1, 0, 1))).toBe('2026-01-01');
  expect(dayKey(startOfWeek(new Date(2026, 0, 4)))).toBe('2025-12-29');
});
