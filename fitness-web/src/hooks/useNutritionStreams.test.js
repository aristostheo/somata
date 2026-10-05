import { act, renderHook, waitFor } from '@testing-library/react';
import { useNutritionStreams } from './useNutritionStreams';
import { ensureProfile, subscribeProfile } from '../services/profile';
import { getRecentFoods, subscribeFoodsByDate, subscribeExerciseByDate } from '../services/nutrition';

jest.mock('../services/profile');
jest.mock('../services/nutrition');

const user = { uid: 'test', email: 'test@example.com' };
let finishProfile;
let stopFoods;
let stopExercise;

beforeEach(() => {
  jest.clearAllMocks();
  stopFoods = jest.fn();
  stopExercise = jest.fn();
  subscribeFoodsByDate.mockReturnValue(stopFoods);
  subscribeExerciseByDate.mockReturnValue(stopExercise);
  getRecentFoods.mockResolvedValue([{ name: "Recent food" }]);
  ensureProfile.mockImplementation(() => new Promise(resolve => { finishProfile = resolve; }));
});

test('does not start a profile listener after unmounting', async () => {
  const { unmount } = renderHook(() => useNutritionStreams(user, '2026-09-23'));
  unmount();
  await act(async () => { finishProfile(); });
  expect(subscribeProfile).not.toHaveBeenCalled();
  expect(stopFoods).toHaveBeenCalledTimes(1);
  expect(stopExercise).toHaveBeenCalledTimes(1);
});

test('clears entries when switching days', async () => {
  const { result, rerender } = renderHook(({ date }) => useNutritionStreams(user, date), {
    initialProps: { date: '2026-09-23' },
  });
  await act(async () => {
    subscribeFoodsByDate.mock.calls[0][2]([{ id: 'food', meal: 'lunch', calories: 200 }]);
  });
  expect(result.current.totals.calories).toBe(200);
  rerender({ date: '2026-09-24' });
  await waitFor(() => expect(result.current.recent).toEqual([{ name: 'Recent food' }]));
  expect(result.current.foods).toEqual([]);
  expect(result.current.totals.calories).toBe(0);
  expect(stopFoods).toHaveBeenCalledTimes(1);
});
