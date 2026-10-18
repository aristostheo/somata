import test from "node:test";
import assert from "node:assert/strict";
import { authErrorMessage } from "../lib/authErrorMessage";

test("sign-in errors do not distinguish an unknown account from a wrong password", () => {
  const message = authErrorMessage({ code: "auth/invalid-credential" }, "fallback");
  assert.equal(authErrorMessage({ code: "auth/user-not-found" }, "fallback"), message);
  assert.equal(authErrorMessage({ code: "auth/wrong-password" }, "fallback"), message);
});
test("authentication failures have safe retry guidance without exposing provider messages", () => {
  assert.match(authErrorMessage({ code: "auth/network-request-failed" }, "fallback"), /connection/);
  assert.match(authErrorMessage({ code: "auth/too-many-requests" }, "fallback"), /Wait/);
  assert.equal(authErrorMessage({ message: "internal provider payload" }, "Try again."), "Try again.");
  assert.equal(authErrorMessage(null, "Try again."), "Try again.");
});
