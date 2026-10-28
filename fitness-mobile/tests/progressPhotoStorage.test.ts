import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { createAccountStore, accountLocalKey, accountPhotoFolder } from '../services/local/accountStoreCore';
import * as photoPaths from '../services/local/photoPaths';

function fixture() {
  let session = { uid: 'synthetic-A' as string | null, generation: 1 };
  const data = new Map<string, string>(), files = new Set<string>(), probes: string[] = [], deletes: string[] = [];
  const driver = {
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => { data.set(key, value); },
    removeItem: async (key: string) => { data.delete(key); },
  };
  const fs = {
    documentDirectory: 'file:///new-container/Documents/',
    getInfoAsync: async (uri: string) => { probes.push(uri); return { exists: files.has(uri), isDirectory: false }; },
    makeDirectoryAsync: async () => {},
    copyAsync: async ({ to }: { to: string }) => { files.add(to); },
    deleteAsync: async (uri: string) => { deletes.push(uri); files.delete(uri); },
  };
  const store = () => createAccountStore(driver, { ...session }, () => session);
  function load(path: string, modules: Record<string, any>) {
    const exports: any = {};
    const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, esModuleInterop: true,
    } }).outputText;
    runInNewContext(code, { exports, require: (name: string) => {
      assert(name in modules, `Unexpected dependency ${name}`); return modules[name];
    } });
    return exports;
  }
  const accountFiles = load('services/local/accountFiles.ts', {
    './accountStoreCore': { accountPhotoFolder }, 'expo-file-system/legacy': fs, './photoPaths': photoPaths,
  });
  const api = load('services/progressPhotos.ts', {
    '@/services/local/accountStore': { accountStorage: store }, 'expo-file-system/legacy': fs,
    './local/accountFiles': accountFiles, './local/photoPaths': photoPaths,
    'expo-image-manipulator': { manipulateAsync: async () => ({ uri: 'file:///synthetic-temporary.jpg' }), SaveFormat: { JPEG: 'jpeg' } },
    '@/services/profile/bodyMetrics': { loadBodyMetricsHistory: async () => [] },
  });
  const key = accountLocalKey('synthetic-A', 'progress_photos');
  return { api, fs, data, files, probes, deletes, key, store, accountFiles,
    switchTo: (uid: string | null) => { session = { uid, generation: session.generation + 1 }; } };
}
const row = (uri: string, id = 'photo_saved') => ({ id, uri, note: 'Synthetic caption', date: '2026-10-20', weight: 0, createdAt: '2026-10-20T12:00:00Z' });
const folder = accountPhotoFolder('synthetic-A');

test('old sandbox paths resolve within the current owner directory without rewriting captions or source records', async () => {
  const f = fixture();
  const original = JSON.stringify([row(`file:///old-container/Documents/${folder}photo_saved.jpg`)]);
  f.data.set(f.key, original);
  const current = f.fs.documentDirectory + folder + 'photo_saved.jpg'; f.files.add(current);
  const photos = await f.api.getPhotos(f.store());
  assert.equal(photos[0].uri, current); assert.equal(photos[0].imageStatus, 'available');
  assert.equal(photos[0].note, 'Synthetic caption'); assert.equal(photos[0].weight, 0);
  assert.equal(f.data.get(f.key), original); assert.deepEqual(f.probes, [current]);
});

test('missing, unreadable and unverified files retain their metadata and never probe another owner or legacy cache', async () => {
  const f = fixture();
  const source = JSON.stringify([
    row(folder + 'photo_missing.jpg'), row(accountPhotoFolder('synthetic-B') + 'other.jpg', 'other'),
    row('file:///old/Caches/manipulated.jpg', 'legacy'), row('https://example.invalid/private.jpg', 'remote'),
  ]);
  f.data.set(f.key, source);
  const photos = await f.api.getPhotos(f.store());
  assert.deepEqual(Array.from(photos, (p: any) => p.imageStatus), ['missing', 'unverified', 'unverified', 'unverified']);
  assert.equal(photos[1].uri, ''); assert.equal(f.probes.length, 1); assert.equal(f.data.get(f.key), source);
  f.fs.getInfoAsync = async () => { throw Error('synthetic read failure'); };
  assert.equal((await f.api.getPhotos(f.store()))[0].imageStatus, 'unavailable');
});

test('new saves persist an owner-relative reference that survives another container change', async () => {
  const f = fixture();
  const photo = await f.api.addPhoto('file:///synthetic-picker.jpg', '  Keep this note  ', f.store());
  const stored = JSON.parse(f.data.get(f.key)!)[0];
  assert(stored.uri.startsWith(folder)); assert(!stored.uri.includes('file://'));
  assert.equal(stored.note, 'Keep this note'); assert.equal(stored.imageStatus, undefined);
  assert.equal(stored.weight, null); assert(photo.uri.startsWith(f.fs.documentDirectory));
  f.fs.documentDirectory = 'file:///another-container/Documents/';
  f.files.add(f.fs.documentDirectory + stored.uri);
  assert.equal((await f.api.getPhotos(f.store()))[0].imageStatus, 'available');
});

test('sign-out or account switch during image lookup rejects the old result', async () => {
  for (const next of [null, 'synthetic-B']) {
    const f = fixture(); f.data.set(f.key, JSON.stringify([row(folder + 'photo_saved.jpg')]));
    let finish!: () => void;
    const waiting = new Promise<void>(resolve => { finish = resolve; });
    let began!: () => void; const started = new Promise<void>(resolve => { began = resolve; });
    f.fs.getInfoAsync = async () => { began(); await waiting; return { exists: true, isDirectory: false }; };
    const read = f.api.getPhotos(f.store()); await started;
    f.switchTo(next); finish(); await assert.rejects(read, /Account changed/);
    if (next) assert.equal((await f.api.getPhotos(f.store())).length, 0);
    assert(f.data.has(f.key));
  }
});

test('deletion resolves old paths only inside the current owner folder and leaves other files alone', async () => {
  const f = fixture(); const other = f.fs.documentDirectory + accountPhotoFolder('synthetic-B') + 'photo_saved.jpg';
  f.files.add(other); f.data.set(f.key, JSON.stringify([row(`file:///old/Documents/${folder}photo_saved.jpg`)]));
  await f.api.deletePhoto('photo_saved', f.store());
  assert.deepEqual(f.deletes, [f.fs.documentDirectory + folder + 'photo_saved.jpg']); assert(f.files.has(other));
  await assert.rejects(f.accountFiles.deleteOwnedPhoto('synthetic-A', other), /ownership/);
  f.data.set(f.key, JSON.stringify([row('file:///legacy/cache.jpg')]));
  await f.api.deletePhoto('photo_saved', f.store()); assert.equal(f.deletes.length, 1);
});

test('path resolution refuses traversal, foreign UIDs, malformed filenames and remote URLs', () => {
  for (const value of [folder + '../other.jpg', folder + '%2e%2e.jpg', folder + 'nested/file.jpg',
    folder + 'photo.jpg?query=1', accountPhotoFolder('synthetic-B') + 'photo.jpg',
    `https://example.invalid/${folder}photo.jpg`, '', null]) {
    assert.equal(photoPaths.ownedPhotoRelativePath('synthetic-A', value as string), null);
  }
});
