/** Generate an ignored, local-only Firebase emulator config; never use it for deploy. */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = JSON.parse(fs.readFileSync(path.join(root, "firebase.json"), "utf8"));
const output = path.join(root, ".firebase.emulators.lan.local.json");
source.emulators = {
  auth: { host: "0.0.0.0", port: 9099 },
  firestore: { host: "0.0.0.0", port: 8080 },
  functions: { host: "0.0.0.0", port: 5001 },
  ui: { enabled: false },
};
fs.writeFileSync(output, `${JSON.stringify(source, null, 2)}\n`, { mode: 0o600 });
console.log("Created ignored local Firebase emulator config: .firebase.emulators.lan.local.json");
