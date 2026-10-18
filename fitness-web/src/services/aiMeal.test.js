jest.mock('../firebaseConfig', () => ({ auth: { currentUser: null, app: {} } }));
jest.mock('firebase/functions', () => ({ getFunctions: jest.fn(), httpsCallable: jest.fn() }));
import { requestMealEstimate } from './aiMeal';
const meal = { name: 'Synthetic toast', qty: 1, unit: 'slice', calories: 100, protein: 4, carbs: 18, fat: 0 };
test('authenticated request uses a real named operation, no token/UID/provider config payload; estimate still needs review', async () => {
  const call = jest.fn(async () => ({ data: meal }));
  const result = await requestMealEstimate({ text: 'toast', qty: 1, unit: 'slice' }, call, true);
  expect(result.totals.fat).toBe(0); expect(result.suggestedName).toBe(meal.name);
  expect(Object.keys(call.mock.calls[0][0])).toEqual(['operation', 'text']); expect(call).toHaveBeenCalledTimes(1);
});
test('unauthenticated and invalid inputs cannot call the backend', async () => {
  const call = jest.fn();
  await expect(requestMealEstimate({ text: 'toast' }, call, false)).rejects.toThrow(/Sign in/);
  for (const body of [{ text: '' }, { text: 'toast', qty: 0 }, { text: 'toast', qty: '1' }])
    await expect(requestMealEstimate(body, call, true)).rejects.toThrow(/Check/);
  expect(call).not.toHaveBeenCalled();
});
test('safe errors for rate limit, timeout and invalid results; no automatic retry', async () => {
  for (const code of ['rate_limited', 'timeout', 'unavailable', 'unauthenticated']) {
    const call = jest.fn(async () => { throw { details: { code }, message: 'private payload' }; });
    await expect(requestMealEstimate({ text: 'toast' }, call, true)).rejects.not.toThrow(/private/);
    expect(call).toHaveBeenCalledTimes(1);
  }
  for (const fat of [undefined, null, -1, '0']) await expect(requestMealEstimate({ text: 'toast' }, async () => ({ data: { ...meal, fat } }), true)).rejects.toThrow(/incomplete/);
});
