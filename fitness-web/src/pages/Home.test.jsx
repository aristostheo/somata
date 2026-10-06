import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home';
import { dayKey } from '../utils/date';
import { subscribeProfile, ensureProfile } from '../services/profile';
import { subscribeFoodsByDate, subscribeExerciseByDate, subscribeFoodsBetween, subscribeExerciseBetween } from '../services/nutrition';
import { subscribeWorkouts } from '../services/workouts';

jest.mock('../context/AuthContext', () => {
  const user = { uid: 'test' };
  return { useAuth: () => ({ user }) };
});
jest.mock('../services/profile');
jest.mock('../services/nutrition');
jest.mock('../services/workouts');
jest.mock('../components/WeeklyCaloriesChart', () => () => null);
jest.mock('../components/ProgressRing', () => ({ label, target }) => <div>{label}: {target}</div>);

beforeEach(() => {
  jest.clearAllMocks();
  ensureProfile.mockResolvedValue();
  subscribeProfile.mockImplementation((uid, cb) => {
    cb({ calorieGoal: 2500, proteinGoal: 160 });
    return jest.fn();
  });
  [subscribeFoodsByDate, subscribeExerciseByDate, subscribeFoodsBetween, subscribeExerciseBetween, subscribeWorkouts]
    .forEach(fn => fn.mockReturnValue(jest.fn()));
});

test('shows saved profile goals and counts actual workouts beyond seven days', async () => {
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Home /></MemoryRouter>);
  expect(await screen.findByText('Calorie Goal: 2500')).toBeInTheDocument();
  expect(screen.getByText('Protein Goal: 160')).toBeInTheDocument();

  const start = new Date();
  start.setDate(start.getDate() - 29);
  expect(subscribeFoodsBetween.mock.calls[0][1]).toBe(dayKey(start));
  expect(subscribeWorkouts.mock.calls[0][2]).toEqual({ from: dayKey(start), to: dayKey(new Date()) });

  const entries = Array.from({ length: 10 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return { date: dayKey(date) };
  });
  act(() => {
    subscribeFoodsBetween.mock.calls[0][3](entries);
    subscribeWorkouts.mock.calls[0][1](entries);
  });
  expect(screen.getAllByText('10 days')).toHaveLength(2);
});
