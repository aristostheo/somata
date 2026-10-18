import test from "node:test";
import assert from "node:assert/strict";
import { ownedDeletionKeys, deletionError } from "../services/account/deletionData";
test("deletion clears exact account namespaces, preserves other users and unscoped device data", () => {
  const owned=["workout:templateSeed:alice","workout:recap:alice:session1","@pending_add_meal:alice","@scan_quota_v2:alice:2026-10-14","@body_twin_v1:alice"];
  const other=["workout:templateSeed:alice2","workout:recap:alice2:session1","@pending_add_meal:bob","progress_photos","@body_metrics:v1","theme","firebase:authUser:alice"];
  assert.deepEqual(ownedDeletionKeys([...owned,...other],"alice"),owned);
});
test("deletion errors distinguish reauthentication, policy holds and retry without claiming success",()=>{
  assert.match(deletionError({details:{code:"reauthentication_required"}}),/five minutes/);
  assert.match(deletionError({details:{code:"retention_review_required"}}),/retention review/);
  assert.match(deletionError({details:{code:"storage_review_required"}}),/ownership review/);
  assert.match(deletionError(new Error("private internal error")),/resume/);
  assert.doesNotMatch(deletionError(new Error("private internal error")),/private internal/);
});
test('known retention reasons are actionable without disclosing record contents or inventing a policy',()=>{
  assert.match(deletionError({details:{code:'retention_review_required',reason:'legacy_ai_cache'}}),/older shared AI records/);
  assert.match(deletionError({details:{code:'retention_review_required',reason:'safety_report'}}),/safety record/);
  const fallback=deletionError({details:{code:'retention_review_required',reason:'private internal data'}});
  assert.match(fallback,/retention review/);assert.doesNotMatch(fallback,/private internal data/);
});
