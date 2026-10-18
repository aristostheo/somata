const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const {validateStaging} = require('../scripts/validate-staging.cjs');
const {guard} = require('../scripts/staging-deploy-guard.cjs');
const project = 'somata-staging-fixture';
const client = {apiKey:'AIza'+'0'.repeat(35),projectId:project,authDomain:`${project}.firebaseapp.com`,storageBucket:`${project}.firebasestorage.app`,messagingSenderId:'123456789012',appId:'1:123456789012:web:synthetic'};
const env=()=>({EXPO_PUBLIC_SOMATA_BACKEND_ENV:'staging',EXPO_PUBLIC_SOMATA_STAGING_PROJECT_ID:project,SOMATA_STAGING_FIREBASE_CONFIG:JSON.stringify(client),SOMATA_CHECKOUT_ENABLED:'false',EXPO_PUBLIC_USE_FIREBASE_EMULATORS:'false',SOMATA_PRIVACY_POLICY_URL:'https://policy.somata-fixture.org/privacy',SOMATA_SUPPORT_URL:'https://help.somata-fixture.org/support'});
const plan=()=>({firebaseProjectId:project,firebaseProjectNumber:'123456789012',firestoreLocation:'nam5',storageBucket:client.storageBucket,functionsRegion:'northamerica-northeast2',runProjectId:project,runRegion:'us-central1',runService:'fitadapt-staging',runServiceAccount:`fitadapt-staging@${project}.iam.gserviceaccount.com`,imageDigest:`us-central1-docker.pkg.dev/${project}/fixture/engine@sha256:${'0'.repeat(64)}`,bridgeSecretVersion:'1',serviceUrl:''});
test('offline preparation allows an unallocated Run URL but later deployment requires it',()=>{
  assert.equal(validateStaging(plan(),env()).serviceUrlReady,false);
  assert.throws(()=>validateStaging(plan(),env(),true),/serviceUrl/);
  assert.equal(validateStaging({...plan(),serviceUrl:'https://synthetic-stage.us-central1.run.app'},env(),true).serviceUrlReady,true);
});
test('Toronto database, Run and Functions settings align with the staging mobile client',()=>{
  const toronto={...plan(),firestoreLocation:'northamerica-northeast2',runRegion:'northamerica-northeast2',
    imageDigest:`northamerica-northeast2-docker.pkg.dev/${project}/fixture/engine@sha256:${'0'.repeat(64)}`};
  assert.equal(validateStaging(toronto,env()).functionsRegion,'northamerica-northeast2');
  assert.throws(()=>validateStaging({...toronto,functionsRegion:'us-central1'},env()),/functionsRegion/);
});
test('staging preflight rejects production, mixed project/bucket, checkout, emulators, absent URLs and unknown secret fields',()=>{
  for(const patch of [{firebaseProjectId:'fitness-tracker-25254'},{runProjectId:'fitness-tracker-25254'},{storageBucket:'fitness-tracker-25254.firebasestorage.app'}, {functionsRegion:'europe-west1'},{bridgeSecretVersion:'latest'},{imageDigest:'image:latest'}, {serviceUrl:'http://127.0.0.1:8765'}, {OPENAI_API_KEY:'never-log-this'}])
    assert.throws(()=>validateStaging({...plan(),...patch},env()), e=>!e.message.includes('never-log-this'));
  for(const patch of [{EXPO_PUBLIC_SOMATA_BACKEND_ENV:'production'},{SOMATA_CHECKOUT_ENABLED:'true'},{EXPO_PUBLIC_USE_FIREBASE_EMULATORS:'true'}, {SOMATA_SUPPORT_URL:''},{SOMATA_PRIVACY_POLICY_URL:''}]) assert.throws(()=>validateStaging(plan(),{...env(),...patch}));
});
test('deployment hooks refuse default/production targets and local config contamination without modifying files',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'somata-stage-guard-')); fs.mkdirSync(path.join(root,'functions'));
  const ready={...plan(),serviceUrl:'https://synthetic-stage.us-central1.run.app'};
  try {
    assert.throws(()=>guard(env(),ready,root),/target/);
    assert.throws(()=>guard({...env(),GCLOUD_PROJECT:'fitness-tracker-25254'},ready,root),/target/);
    const checked={...env(),GCLOUD_PROJECT:project};
    assert.throws(()=>guard(checked,ready,root),/parameter file/);
    const param=path.join(root,'functions',`.env.${project}`);
    fs.writeFileSync(param,`FITADAPT_SERVICE_URL=${ready.serviceUrl}\nSOMATA_STAGING_PROJECT_ID=${project}\nSOMATA_FUNCTIONS_REGION=northamerica-northeast2\n`);
    assert.doesNotThrow(()=>guard(checked,ready,root));
    assert.throws(()=>guard({...checked,SOMATA_STAGING_PROJECT_ID:'fitness-tracker-25254'},ready,root),/Conflicting/);
    assert.throws(()=>guard({...checked,GOOGLE_CLOUD_PROJECT:'fitness-tracker-25254'},ready,root),/Conflicting/);
    assert.throws(()=>guard({...checked,FITADAPT_SERVICE_URL:'https://other-service.run.app'},ready,root),/must match/);
    fs.writeFileSync(param,'FITADAPT_SERVICE_URL=https://other-service.run.app\n');assert.throws(()=>guard(checked,ready,root),/parameter file/);
    fs.writeFileSync(param,`FITADAPT_SERVICE_URL=${ready.serviceUrl}\nSOMATA_STAGING_PROJECT_ID=${project}\nSOMATA_FUNCTIONS_REGION=northamerica-northeast2\n`);
    for(const name of ['.env','.env.local','.env.demo-somata-fitadapt','.secret.local']) {
      const file=path.join(root,'functions',name);fs.writeFileSync(file,'synthetic');assert.throws(()=>guard(checked,ready,root),/clean reviewed/);assert.equal(fs.readFileSync(file,'utf8'),'synthetic');fs.unlinkSync(file);
    }
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
test('dedicated staging config guards rules, Storage and Functions; normal configuration stays separate',()=>{
  const config=require('../firebase.staging.json');
  for(const target of [config.firestore,config.storage,...config.functions]) assert.ok(target.predeploy[0].includes('staging-deploy-guard.cjs'));
  assert.equal(config.storage.rules,'storage.rules');
  assert.equal(config.functions[0].runtime,'nodejs22');
  const eas=require('../../fitness-mobile/eas.json').build.testflight;
  assert.equal(eas.environment,'preview');assert.equal(eas.channel,'testflight-staging');
  assert.equal(eas.env.EXPO_PUBLIC_SOMATA_BACKEND_ENV,'staging');assert.equal(eas.env.SOMATA_CHECKOUT_ENABLED,'false');
});
