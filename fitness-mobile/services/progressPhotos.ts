import AsyncStorage from "@react-native-async-storage/async-storage";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

import { loadBodyMetricsHistory } from "@/services/profile/bodyMetrics";

export interface ProgressPhoto {
  id: string;
  uri: string;
  date: string;
  weight: number | null;
  note: string | null;
  createdAt: string;
}

const KEY = "progress_photos";
const PRIVACY_KEY = "progress_photos_privacy_seen";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function sameDay(a: number, b: number) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function makeId() {
  return `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function readAll(): Promise<ProgressPhoto[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ProgressPhoto[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(next: ProgressPhoto[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

async function weightForToday() {
  const history = await loadBodyMetricsHistory();
  const today = Date.now();
  const match = history
    .filter((point) => typeof point.weightLb === "number" && sameDay(point.t, today))
    .sort((a, b) => b.t - a.t)[0];
  return typeof match?.weightLb === "number" ? match.weightLb : null;
}

export async function addPhoto(uri: string, note?: string): Promise<ProgressPhoto> {
  const created = new Date().toISOString();
  const normalized = await manipulateAsync(
    uri,
    [{ resize: { width: 1200 } }],
    { compress: 0.92, format: SaveFormat.JPEG }
  );
  const photo: ProgressPhoto = {
    id: makeId(),
    uri: normalized.uri,
    date: todayYmd(),
    weight: await weightForToday(),
    note: note?.trim() ? note.trim() : null,
    createdAt: created,
  };
  const current = await readAll();
  current.push(photo);
  current.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  await writeAll(current);
  return photo;
}

export async function getPhotos(): Promise<ProgressPhoto[]> {
  const rows = await readAll();
  return rows.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function deletePhoto(id: string): Promise<void> {
  const rows = await readAll();
  const target = rows.find((item) => item.id === id);
  const next = rows.filter((item) => item.id !== id);
  await writeAll(next);
  if (target?.uri) {
    try {
      const fs = require("expo-file-system");
      if (typeof fs.deleteAsync === "function") {
        await fs.deleteAsync(target.uri, { idempotent: true });
      }
    } catch {
      // Optional cleanup only.
    }
  }
}

export async function getLatestPhoto(): Promise<ProgressPhoto | null> {
  const rows = await getPhotos();
  return rows.length ? rows[rows.length - 1] : null;
}

export async function getFirstPhoto(): Promise<ProgressPhoto | null> {
  const rows = await getPhotos();
  return rows.length ? rows[0] : null;
}

export async function hasSeenProgressPhotoPrivacyNotice() {
  return (await AsyncStorage.getItem(PRIVACY_KEY)) === "1";
}

export async function markProgressPhotoPrivacyNoticeSeen() {
  await AsyncStorage.setItem(PRIVACY_KEY, "1");
}
