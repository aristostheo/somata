// Copied only into a temporary emulator package by prepare-ai-emulators.cjs.
// Production source has no mock flag, alternative provider URL or fake-result branch.
const { generate } = require('./provider-real');
const meal = { name: 'Synthetic toast', qty: 1, unit: 'slice', calories: 100, protein: 4, carbs: 18, fat: 0 };
exports.generate = (input, secret) => {
if (process.env.FUNCTIONS_EMULATOR !== 'true' || process.env.GCLOUD_PROJECT !== 'demo-somata-fitadapt' ||
    process.env.OPENAI_API_KEY !== 'synthetic-invalid-emulator-only') throw new Error('Local synthetic fixture only');
return generate(input, secret, async () => {
  if (input.text === 'test:429') return new Response('private diagnostic', { status: 429 });
  if (input.text === 'test:500') return new Response('private diagnostic', { status: 500 });
  if (input.text === 'test:timeout') return new Promise(() => {});
  let result = meal;
  if (input.text === 'test:malformed') result = { calories: 'bad' };
  else if (input.operation === 'photo') result = { foods: [{ name: 'Synthetic toast', confidence: 'medium', portion: { amount: 1, unit: 'piece', multiplier: 1 }, macros: meal }] };
  else if (input.operation === 'mealFoods') result = { foods: [meal] };
  else if (input.operation === 'mealIdeas') result = { meals: [{ ...meal, meal: 'lunch', ingredients: ['toast'] }], rationale: 'Synthetic only' };
  else if (input.operation === 'macroCompletion') result = { suggestions: [{ id: 'one', label: 'Toast', foods: ['toast'], macros: meal, tags: [] }], rationale: 'Synthetic only' };
  else if (input.operation === 'workout') result = { name: 'Synthetic session', tagline: 'Test only', duration: 20, warmup: [], cooldown: [],
    exercises: [{ name: 'Squat', sets: 2, reps: '8', rest: '60s', weight: 'bodyweight', muscleGroup: 'legs' }],
    estimatedCalories: 100, coachNote: 'Synthetic only', difficulty: 'Light' };
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(result) }, finish_reason: 'stop' }] }));
}, 100);
};
