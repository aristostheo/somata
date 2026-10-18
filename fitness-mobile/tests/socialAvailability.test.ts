import test from "node:test";
import assert from "node:assert/strict";
import { googleClientId } from "../lib/socialAvailability";

test("social sign-in does not offer placeholder, absent or mismatched platform credentials", () => {
  const web = "123-test.apps.googleusercontent.com";
  assert.equal(googleClientId("ios", { web }), null);
  assert.equal(googleClientId("android", { ios: web }), null);
  assert.equal(googleClientId("ios", { ios: "YOUR_IOS_CLIENT_ID.apps.googleusercontent.com" }), null);
  assert.equal(googleClientId("ios", { ios: "https://example.test" }), null);
  assert.equal(googleClientId("web", { web }), web);
  assert.equal(googleClientId("ios", { ios: ` ${web} ` }), web);
});
