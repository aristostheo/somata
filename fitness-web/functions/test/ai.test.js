const test = require('node:test');
const assert = require('node:assert/strict');
const { parseInput, projectResponse, MAX_BODY_BYTES, MAX_IMAGE_BYTES } = require('../lib/ai/contract');
const { createAIHandler } = require('../lib/ai/handler');
const { generate } = require('../lib/ai/provider');
const meal = { name: 'Synthetic toast', qty: 1, unit: 'slice', calories: 100, protein: 4, carbs: 18, fat: 0 };
const request = { operation: 'meal', text: 'one slice toast' };
const envelope = value => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) }, finish_reason: 'stop' }] }));
const failure = code => error => error.code === code && !error.message.includes('private');

test('authenticated context owns quota; client UID and arbitrary provider options are rejected before a paid request', async () => {
  const owners = []; let calls = 0;
  const handle = createAIHandler({ reserve: async uid => owners.push(uid), generate: async () => { calls++; return meal; } });
  const context = { uid: 'verified-owner', contentType: 'application/json; charset=utf-8', bytes: 100 };
  await assert.rejects(handle(request, { ...context, uid: undefined }), failure('unauthenticated'));
  for (const extra of [{ uid: 'stranger' }, { profile: {} }, { model: 'expensive-model' }, { url: 'https://other.invalid' }])
    await assert.rejects(handle({ ...request, ...extra }, context), failure('invalid_input'));
  assert.equal(calls, 0);
  assert.deepEqual(await handle(request, context), meal);
  assert.deepEqual(owners, ['verified-owner']); assert.equal(calls, 1);
});
test('content type, envelope size, text fields and image MIME/magic/size are bounded', async () => {
  const handle = createAIHandler({ reserve: async () => assert.fail(), generate: async () => assert.fail() });
  await assert.rejects(handle(request, { uid: 'owner', contentType: 'text/plain', bytes: 10 }), failure('invalid_input'));
  await assert.rejects(handle(request, { uid: 'owner', contentType: 'application/json', bytes: MAX_BODY_BYTES + 1 }), failure('too_large'));
  for (const value of [null, [], {}, { ...request, text: '' }, { ...request, text: 'x'.repeat(12001) }, { ...request, operation: 'arbitrary' }])
    assert.throws(() => parseInput(value), failure('invalid_input'));
  for (const imageDataUrl of ['https://remote.invalid/a.jpg', 'data:image/gif;base64,R0lG', 'data:image/jpeg;base64,YmFk', 'data:image/png;base64,AAAA'])
    assert.throws(() => parseInput({ operation: 'photo', text: 'meal', imageDataUrl }), failure('unsupported_media'));
  assert.throws(() => parseInput({ operation: 'photo', text: 'meal', imageDataUrl: 'data:image/jpeg;base64,' + Buffer.alloc(MAX_IMAGE_BYTES + 1).toString('base64') }), failure('too_large'));
  assert.equal(parseInput({ operation: 'photo', text: 'meal', imageDataUrl: 'data:image/jpeg;base64,/9j/2Q==' }).operation, 'photo');
});
test('successful mock provider response is projected; missing values differ from true zero', async () => {
  let calls = 0;
  const result = await generate(request, 'synthetic', async (_url, options) => {
    calls++;
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'gpt-4o-mini'); assert.equal(Object.hasOwn(body, 'uid'), false);
    assert.ok(body.messages[0].content.includes('Estimate nutrition'));
    return envelope({ ...meal, providerPrivateField: 'private' });
  });
  assert.deepEqual(result, meal); assert.equal(calls, 1); assert.equal(result.fat, 0);
  for (const fat of [undefined, null, -1, '0', [], {}])
    assert.throws(() => projectResponse('meal', { ...meal, fat }), failure('invalid_response'));
});
test('all supported operation responses are validated, not just parseable JSON', () => {
  assert.deepEqual(projectResponse('mealFoods', { foods: [meal] }).foods, [meal]);
  assert.equal(projectResponse('foodMacros', meal).fat, 0);
  assert.equal(projectResponse('photo', { foods: [{ name: meal.name, confidence: 'medium', portion: { amount: 1, multiplier: 1, unit: 'piece' }, macros: meal }] }).foods[0].id, 'food_0');
  const workout = { name: 'Synthetic', tagline: 'Short session', duration: 20, warmup: [], cooldown: [], coachNote: 'Use control', estimatedCalories: 0, difficulty: 'Light',
    exercises: [{ name: 'Squat', sets: 2, reps: '8', rest: '60s', weight: 'bodyweight', muscleGroup: 'legs' }] };
  assert.equal(projectResponse('workout', workout).estimatedCalories, 0);
  assert.equal(projectResponse('mealIdeas', { meals: [{ ...meal, meal: 'lunch', ingredients: ['toast'] }], rationale: 'Simple' }).meals.length, 1);
  assert.equal(projectResponse('macroCompletion', { suggestions: [{ id: 'a', label: 'Toast', foods: ['toast'], macros: meal, tags: [] }], rationale: 'Simple' }).suggestions.length, 1);
  for (const operation of ['meal', 'mealFoods', 'photo', 'workout', 'mealIdeas', 'macroCompletion']) assert.throws(() => projectResponse(operation, {}), failure('invalid_response'));
});
test('429, provider denial/errors, malformed/oversized/truncated responses and timeouts never retry or invent food', async () => {
  for (const status of [401, 403, 429, 500]) {
    let calls = 0;
    await assert.rejects(generate(request, 'synthetic', async () => { calls++; return new Response('private provider diagnostic', { status }); }), failure(status === 429 ? 'rate_limited' : 'unavailable'));
    assert.equal(calls, 1);
  }
  for (const response of [new Response('bad'), envelope({}), new Response('x'.repeat(128 * 1024 + 1)),
    new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: JSON.stringify(meal) } }] }))])
    await assert.rejects(generate(request, 'synthetic', async () => response), failure('invalid_response'));
  let calls = 0; let aborted = false;
  await assert.rejects(generate(request, 'synthetic', async (_url, options) => {
    calls++; options.signal.addEventListener('abort', () => { aborted = true; }); return new Promise(() => {});
  }, 5), failure('timeout'));
  assert.equal(calls, 1); assert.ok(aborted);
  await assert.rejects(generate(request, '', async () => assert.fail()), failure('unavailable'));
});
