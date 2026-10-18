import { accountStorage, type AccountStore } from '@/services/local/accountStore';
import * as FileSystem from "expo-file-system/legacy";
import { accountPhotoDirectory, deleteOwnedPhoto } from "./local/accountFiles";
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

async function readAll(localStore: AccountStore = accountStorage()): Promise<ProgressPhoto[]> {
  try {
    const raw = await localStore.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ProgressPhoto[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(next: ProgressPhoto[], localStore: AccountStore = accountStorage()) {
  await localStore.setItem(KEY, JSON.stringify(next));
}

async function weightForToday(localStore: AccountStore = accountStorage()) {
  const history = await loadBodyMetricsHistory(localStore);
  const today = Date.now();
  const match = history
    .filter((point) => typeof point.weightLb === "number" && sameDay(point.t, today))
    .sort((a, b) => b.t - a.t)[0];
  return typeof match?.weightLb === "number" ? match.weightLb : null;
}

export async function addPhoto(uri: string, note?: string, localStore: AccountStore = accountStorage()): Promise<ProgressPhoto> {
  localStore.assertCurrent();
  const created = new Date().toISOString();
  const normalized = await manipulateAsync(
    uri,
    [{ resize: { width: 1200 } }],
    { compress: 0.92, format: SaveFormat.JPEG }
  );
  const id = makeId();
  const folder = accountPhotoDirectory(localStore.uid!);
  const ownedUri = `${folder}${id}.jpg`;
  try {
    localStore.assertCurrent();
    await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
    localStore.assertCurrent();
    await FileSystem.copyAsync({ from: normalized.uri, to: ownedUri });
    localStore.assertCurrent();
  } catch (error) {
    await FileSystem.deleteAsync(ownedUri, { idempotent: true });
    throw error;
  } finally {
    await FileSystem.deleteAsync(normalized.uri, { idempotent: true });
  }
  const photo: ProgressPhoto = {
    id,
    uri: ownedUri,
    date: todayYmd(),
    weight: await weightForToday(localStore),
    note: note?.trim() ? note.trim() : null,
    createdAt: created,
  };
  const current = await readAll(localStore);
  current.push(photo);
  current.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  await writeAll(current, localStore);
  return photo;
}

export async function getPhotos(localStore: AccountStore = accountStorage()): Promise<ProgressPhoto[]> {
  const rows = await readAll(localStore);
  return rows.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function deletePhoto(id: string, localStore: AccountStore = accountStorage()): Promise<void> {
  const rows = await readAll(localStore);
  const target = rows.find((item) => item.id === id);
  const next = rows.filter((item) => item.id !== id);
  await writeAll(next, localStore);
  if (target?.uri) await deleteOwnedPhoto(localStore.uid!, target.uri);
}

export async function getLatestPhoto(localStore: AccountStore = accountStorage()): Promise<ProgressPhoto | null> {
  const rows = await getPhotos(localStore);
  return rows.length ? rows[rows.length - 1] : null;
}

export async function getFirstPhoto(localStore: AccountStore = accountStorage()): Promise<ProgressPhoto | null> {
  const rows = await getPhotos(localStore);
  return rows.length ? rows[0] : null;
}

export async function hasSeenProgressPhotoPrivacyNotice(localStore: AccountStore = accountStorage()) {
  return (await localStore.getItem(PRIVACY_KEY)) === "1";
}

export async function markProgressPhotoPrivacyNoticeSeen(localStore: AccountStore = accountStorage()) {
  await localStore.setItem(PRIVACY_KEY, "1");
}
