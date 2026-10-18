import assert from "node:assert/strict";
import { test } from "node:test";
import { firebaseEmulatorMode, FITADAPT_DEMO_PROJECT_ID } from "../lib/firebaseEmulatorMode";

const valid = { flag: "true", development: true, projectId: FITADAPT_DEMO_PROJECT_ID, host: "192.168.1.25" };

test("emulator mode is off by default", () => {
  assert.equal(firebaseEmulatorMode({ ...valid, flag: undefined }), null);
  assert.equal(firebaseEmulatorMode({ ...valid, flag: "false" }), null);
});

test("emulator mode requires development, the demo project, and a private LAN host", () => {
  assert.deepEqual(firebaseEmulatorMode(valid), { host: "192.168.1.25", projectId: FITADAPT_DEMO_PROJECT_ID });
  assert.throws(() => firebaseEmulatorMode({ ...valid, development: false }), /development build/);
  assert.throws(() => firebaseEmulatorMode({ ...valid, projectId: "fitness-tracker-25254" }), /demo-somata-fitadapt/);
  for (const host of [undefined, "localhost", "127.0.0.1", "0.0.0.0", "8.8.8.8", "http://192.168.1.25:9099"]) {
    assert.throws(() => firebaseEmulatorMode({ ...valid, host }), /private LAN IPv4/);
  }
});
