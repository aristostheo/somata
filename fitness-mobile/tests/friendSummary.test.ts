import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { sharedTemplateItems } from "../services/friends/summaryData";
test("only shared complete exercise projections can become own templates; zero is preserved", () => {
  for (const section of [undefined, {status:"private"}, {status:"unavailable"}]) assert.equal(sharedTemplateItems(section as any),null);
  assert.equal(sharedTemplateItems({status:"shared",data:[]}),null);
  const exercise = {exercise:"Squat",sets:3,reps:5,weightKg:0,notes:"must not copy",uid:"private",extra:"private"};
  assert.deepEqual(sharedTemplateItems({status:"shared",data:[{title:"Training",exercises:[exercise]}]}),[{exercise:"Squat",sets:3,reps:5,weight:0,notes:""}]);
  for (const value of [null,undefined,NaN,-1]) assert.equal(sharedTemplateItems({status:"shared",data:[{title:"Training",exercises:[{...exercise,weightKg:value as any}]}]}),null);
});
test("friend destinations use the redacted boundary and never import private data readers", () => {
  const root=path.resolve(__dirname,"..");
  for (const file of ["app/friends.tsx","app/friends/[id].tsx","app/friends/[id]/workouts.tsx","app/friends/[id]/profile.tsx","app/friends/[id]/progress.tsx","app/friends/preview.tsx","components/friends/SharedSummary.tsx"]) {
    const source=fs.readFileSync(path.join(root,file),"utf8");
    assert.doesNotMatch(source,/subscribeProfile|subscribeFoodsByDate|subscribeWorkouts|firebase\/firestore|getDocs\(/,file);
    assert.match(source,/SharedSummary/,file);
  }
});
