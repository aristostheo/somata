/** Generate an ignored loopback-only emulator config for local schedule tests. */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = JSON.parse(fs.readFileSync(path.join(root, "firebase.json"), "utf8"));
const output = path.join(root, ".firebase.emulators.schedule.local.json");
source.emulators = {
  auth: { host: "127.0.0.1", port: 9099 },
  firestore: { host: "127.0.0.1", port: 8080 },
  functions: { host: "127.0.0.1", port: 5001 },
  pubsub: { host: "127.0.0.1", port: 8085 },
  ui: { enabled: false },
};
fs.writeFileSync(output, `${JSON.stringify(source, null, 2)}\n`, { mode: 0o600 });
console.log("Created ignored loopback-only config: .firebase.emulators.schedule.local.json");
