const test = require('node:test');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {resolveFunctionsRegion} = require('../lib/deployment');
const project = 'somata-staging-fixture';
const staging = {SOMATA_STAGING_PROJECT_ID: project, GCLOUD_PROJECT: project, SOMATA_FUNCTIONS_REGION:"northamerica-northeast2"};
test('staging requires an exact independent project; production and local emulator defaults are unchanged', () => {
  assert.equal(resolveFunctionsRegion({}), 'us-central1');
  assert.equal(resolveFunctionsRegion({GCLOUD_PROJECT:'demo-somata-fitadapt', FUNCTIONS_EMULATOR:'true'}), 'us-central1');
  assert.equal(resolveFunctionsRegion(staging), 'northamerica-northeast2');
  for (const patch of [{SOMATA_FUNCTIONS_REGION:undefined}, {SOMATA_FUNCTIONS_REGION:'us-central1'}, {SOMATA_STAGING_PROJECT_ID:''}, {SOMATA_STAGING_PROJECT_ID:'fitness-tracker-25254'}, {SOMATA_STAGING_PROJECT_ID:'eleven11-aristos'}, {SOMATA_STAGING_PROJECT_ID:'demo-somata-fitadapt'}, {GCLOUD_PROJECT:undefined}, {GCLOUD_PROJECT:'fitness-tracker-25254'}, {GOOGLE_CLOUD_PROJECT:'other-project'}, {FUNCTIONS_EMULATOR:'true'}, {FIREBASE_CONFIG:'bad'}, {FIREBASE_CONFIG:JSON.stringify({projectId:'other-project'})}]) {
    assert.throws(() => resolveFunctionsRegion({...staging,...patch}));
  }
  assert.equal(resolveFunctionsRegion({...staging,FIREBASE_CONFIG:JSON.stringify({projectId:project})}), 'northamerica-northeast2');
});
test('all twelve staging handlers register in Toronto, including Firestore triggers and scheduled worker', () => {
  const env = {...process.env, ...staging, FIREBASE_CONFIG:JSON.stringify({projectId:project}), GOOGLE_CLOUD_PROJECT:project};
  delete env.FUNCTIONS_EMULATOR;
  const source = `const assert=require('node:assert/strict'); const handlers=require('./lib/index');
    const names=['generateSomataAI','evaluateFitAdapt','getFitAdaptPlan','acceptFitAdaptPlan','declineFitAdaptPlan','getFriendSummary','setFriendSummarySharing','deleteSomataAccount','onFitAdaptProfileChanged','onFitAdaptNutritionChanged','onFitAdaptWeightChanged','processFitAdaptAutoReviews'];
    for (const name of names) assert.deepEqual(handlers[name].__endpoint.region.toCEL(),'{{ params.SOMATA_FUNCTIONS_REGION }}',name);
    assert.ok(handlers.processFitAdaptAutoReviews.__endpoint.scheduleTrigger);
    assert.equal(require('./lib/deployment').functionsRegion.value(),'northamerica-northeast2');`;
  execFileSync(process.execPath,['-e',source],{cwd:require('node:path').resolve(__dirname,'..'),env,stdio:'pipe'});
});

test('Firebase source discovery retains the region parameter before project .env loading', () => {
  const env={...process.env, GCLOUD_PROJECT:project,FIREBASE_CONFIG:JSON.stringify({projectId:project})};
  delete env.SOMATA_STAGING_PROJECT_ID; delete env.SOMATA_FUNCTIONS_REGION; delete env.GOOGLE_CLOUD_PROJECT;
  execFileSync(process.execPath,['-e',`const assert=require('node:assert/strict'); const h=require('./lib/index');
    assert.deepEqual(h.evaluateFitAdapt.__endpoint.region.toCEL(),'{{ params.SOMATA_FUNCTIONS_REGION }}');
    assert.deepEqual(h.processFitAdaptAutoReviews.__endpoint.region.toCEL(),'{{ params.SOMATA_FUNCTIONS_REGION }}');`],
    {cwd:require('node:path').resolve(__dirname,'..'),env,stdio:'pipe'});
});
