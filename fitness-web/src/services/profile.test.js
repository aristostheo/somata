import { doc, getDoc, onSnapshot, runTransaction, setDoc } from "firebase/firestore";
import { auth } from "../firebaseConfig";
import { ensureProfile, importLegacyProfile, loadLegacyProfileImport, subscribeProfile, updateProfile } from "./profile";
import { legacyProfilePatch, selectedFields } from "./legacyProfileImport";

jest.mock("../firebaseConfig", () => ({ db: {}, auth: { currentUser: null } }));
jest.mock("firebase/firestore", () => ({
  doc: jest.fn(), getDoc: jest.fn(), onSnapshot: jest.fn(), runTransaction: jest.fn(), setDoc: jest.fn(),
}));

const snapshot = (data) => ({ exists: () => data != null, data: () => data, id: "owner" });

beforeEach(() => {
  jest.clearAllMocks();
  auth.currentUser = { uid: "owner", email: "owner@example.test" };
  doc.mockImplementation((db, collection, uid) => ({ collection, uid }));
});

test("same authenticated UID reads and writes only the canonical users document", async () => {
  const tx = { get: jest.fn().mockResolvedValue(snapshot(null)), set: jest.fn() };
  runTransaction.mockImplementation((db, work) => work(tx));
  await ensureProfile("owner");
  expect(tx.set).toHaveBeenCalledWith({ collection: "users", uid: "owner" },
    expect.objectContaining({ dailyCaloriesTarget: 2200, dailyProteinTarget: 130 }));

  const cb = jest.fn();
  onSnapshot.mockImplementation((ref, next) => { next(snapshot({ calorieGoal: 2100 })); return jest.fn(); });
  subscribeProfile("owner", cb);
  expect(onSnapshot).toHaveBeenCalledWith({ collection: "users", uid: "owner" },
    expect.any(Function), expect.any(Function));
  expect(cb).toHaveBeenCalledWith({ id: "owner", calorieGoal: 2100 });

  const protectedState = {
    activeFitAdaptTargets: { calories: 9999, protein: 0, carbs: 0, fat: 0 },
    currentRecommendation: { proposalId: "fake" }, pending: { id: "fake" }, adaptationHistory: [],
  };
  await updateProfile("owner", { calorieGoal: 2050, ...protectedState });
  expect(setDoc).toHaveBeenCalledWith({ collection: "users", uid: "owner" },
    expect.objectContaining({ calorieGoal: 2050 }), { merge: true });
  for (const field of Object.keys(protectedState)) expect(setDoc.mock.calls[0][1]).not.toHaveProperty(field);
});

test("legacy import is owner-scoped, reviewed, atomic, and idempotent", async () => {
  const legacy = { calorieGoal: 2150, proteinGoal: 125, carbGoal: 255, fatGoal: 60,
    weightKg: 72, weightUnit: "lb", age: 32, email: "ignore@example.test",
    activeFitAdaptTargets: { calories: 9999 } };
  const candidate = legacyProfilePatch(legacy);
  getDoc.mockResolvedValue(snapshot(legacy));
  expect(await loadLegacyProfileImport("owner")).toEqual(candidate);
  expect(getDoc).toHaveBeenCalledWith({ collection: "profiles", uid: "owner" });
  const accepted = { calories: 2300, protein: 140, carbs: 275, fat: 65 };
  const current = { dailyCaloriesTarget: 2200, calorieGoal: 2200, activeFitAdaptTargets: accepted };
  const tx = { get: jest.fn((ref) => Promise.resolve(snapshot(ref.collection === "profiles" ? legacy : current))), set: jest.fn() };
  runTransaction.mockImplementation((db, work) => work(tx));
  expect(await importLegacyProfile("owner", candidate, selectedFields(current, candidate))).toBe(true);
  expect(tx.set).toHaveBeenCalledWith({ collection: "users", uid: "owner" },
    expect.objectContaining({ dailyCaloriesTarget: 2150, weightKg: 72 }), { merge: true });
  expect(tx.set.mock.calls[0][1]).not.toHaveProperty("activeFitAdaptTargets");
  expect(tx.set.mock.calls[0][1]).not.toHaveProperty("email");

  const migrated = { ...current, ...candidate };
  tx.get.mockImplementation((ref) => Promise.resolve(snapshot(ref.collection === "profiles" ? legacy : migrated)));
  expect(await importLegacyProfile("owner", candidate, selectedFields(migrated, candidate))).toBe(false);
  expect(tx.set).toHaveBeenCalledTimes(1);
  expect(migrated.activeFitAdaptTargets).toEqual(accepted);
});

test("import rejects stale previews and other UIDs before writing", async () => {
  const legacy = { calorieGoal: 2050 };
  const candidate = legacyProfilePatch(legacy);
  const tx = { get: jest.fn((ref) => Promise.resolve(snapshot(ref.collection === "profiles" ? legacy : { calorieGoal: 2200 }))), set: jest.fn() };
  runTransaction.mockImplementation((db, work) => work(tx));
  await expect(importLegacyProfile("owner", candidate, { calorieGoal: 1800, dailyCaloriesTarget: undefined }))
    .rejects.toThrow("changed");
  expect(tx.set).not.toHaveBeenCalled();
  await expect(importLegacyProfile("other", candidate, {})).rejects.toThrow("own account");
  await expect(updateProfile("other", { calorieGoal: 1 })).rejects.toThrow("own account");
  expect(setDoc).not.toHaveBeenCalled();
});
