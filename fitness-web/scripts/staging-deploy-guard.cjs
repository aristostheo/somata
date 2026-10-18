// Invoked by the dedicated staging config for each deploy target. This script itself never deploys.
const fs = require('node:fs');
const path = require('node:path');
const { validateStaging, loadPlan } = require('./validate-staging.cjs');
function guard(env, plan, root = path.resolve(__dirname, '..')) {
  const checked = validateStaging(plan, env, true);
  if (!env.GCLOUD_PROJECT || env.GCLOUD_PROJECT !== checked.projectId) throw Error('Deployment target must exactly match the reviewed staging project. Production/default fallback refused.');
  if (env.GOOGLE_CLOUD_PROJECT && env.GOOGLE_CLOUD_PROJECT !== checked.projectId) throw Error('Conflicting GOOGLE_CLOUD_PROJECT; staging target required.');
  if (env.SOMATA_FUNCTIONS_REGION && env.SOMATA_FUNCTIONS_REGION !== plan.functionsRegion) throw Error('Conflicting SOMATA_FUNCTIONS_REGION; Toronto staging required.');
  if (env.SOMATA_STAGING_PROJECT_ID && env.SOMATA_STAGING_PROJECT_ID !== checked.projectId) throw Error('Conflicting SOMATA_STAGING_PROJECT_ID; staging target required.');
  if (env.FITADAPT_SERVICE_URL && env.FITADAPT_SERVICE_URL !== plan.serviceUrl) throw Error('FITADAPT_SERVICE_URL must match the reviewed staging service.');
  // Refuse accidental loading/shipping of laptop credentials or unrelated project parameters.
  const files = fs.readdirSync(path.join(root, 'functions'));
  if (files.some(name => name === '.env' || name.startsWith('.env.') && name !== `.env.${checked.projectId}` || name.startsWith('.secret')))
    throw Error('Use a clean reviewed staging checkout: local secrets or unrelated .env files are present. Do not delete your development files; stage a clean artifact separately.');
  const paramFile = path.join(root, 'functions', `.env.${checked.projectId}`);
  let lines;
  try { lines = fs.readFileSync(paramFile, 'utf8').split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#')); }
  catch { throw Error('The staging project parameter file must contain the staging project pin and FITADAPT_SERVICE_URL for the reviewed service.'); }
  const expected = [`FITADAPT_SERVICE_URL=${plan.serviceUrl}`, `SOMATA_STAGING_PROJECT_ID=${checked.projectId}`, `SOMATA_FUNCTIONS_REGION=${plan.functionsRegion}`];
  if (lines.length !== 3 || expected.some(line => !lines.includes(line)))
    throw Error('The staging parameter file must contain exactly the reviewed FITADAPT_SERVICE_URL, SOMATA_STAGING_PROJECT_ID and SOMATA_FUNCTIONS_REGION assignments; secrets belong in Secret Manager.');

}
if (require.main === module) {
  try {
    if (!process.env.SOMATA_STAGING_PLAN) throw Error('SOMATA_STAGING_PLAN must name the reviewed staging plan file');
    guard(process.env, loadPlan(process.env.SOMATA_STAGING_PLAN));
    console.log('PASS: staging target/input guard. Explicit deployment authorization is still required.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
exports.guard = guard;
