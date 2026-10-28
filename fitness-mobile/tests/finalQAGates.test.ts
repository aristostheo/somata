import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
const req = createRequire(import.meta.url);
const renderer = req('react-test-renderer');
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
function load(file: string, mocks: Record<string, unknown>) {
  const exports: Record<string, any> = {};
  runInNewContext(ts.transpileModule(readFileSync(resolve(file), 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, { exports, require: (name: string) => {
    if (name in mocks) return mocks[name];
    if (name === 'react') return React;
    throw Error('Unexpected dependency: ' + name);
  } });
  return exports;
}
test('secure gate keeps account children unmounted through failure, retry and account switching', async () => {
  let authCallback: (u: any) => void = () => {}, fail = true, retries = 0;
  const user = { uid: 'synthetic-gate-a' };
  const { AuthProvider } = load('content/AuthContext.tsx', {
    'react-native': { useColorScheme: () => 'dark' },
    '@/components/somata/StartupSurface': { StartupSurface: 'StartupSurface' },
    '@react-native-async-storage/async-storage': {},
    '@/services/local/migrateLocalData': { migrateOwnedLocalData: async () => {} },
    'firebase/auth': { onAuthStateChanged: (_: any, cb: typeof authCallback) => { authCallback = cb; retries++; cb(user); return () => {}; } },
    '@/lib/firebase': { auth: {} },
    '@/services/local/accountStore': { accountSessionChanged: () => {}, accountStorage: () => ({ assertCurrent: () => {} }) },
    '@/services/notifications': { clearAccountNotificationDelivery: async () => { if (fail) throw Error('synthetic'); } },
  });
  let tree: any;
  await React.act(async () => { tree = renderer.create(React.createElement(AuthProvider, null, React.createElement('private-content'))); });
  assert.equal(tree.root.findAllByType('private-content').length, 0);
  assert.equal(tree.root.findByType('StartupSurface').props.failed, true);
  fail = false;
  await React.act(async () => tree.root.findByType('StartupSurface').props.onRetry());
  assert.equal(retries, 2);
  assert.equal(tree.root.findAllByType('private-content').length, 1);
  fail = true;
  await React.act(async () => authCallback({ uid: 'synthetic-gate-b' }));
  assert.equal(tree.root.findAllByType('private-content').length, 0);
  assert.equal(tree.root.findByType('StartupSurface').props.failed, true);
  await React.act(async () => tree.unmount());
});
test('startup presentation uses no theme/provider hook, retains Retry and bounds approved artwork', async () => {
  const { createSemanticTokens } = await import('../services/theme/semanticTokens');
  const { StartupSurface } = load('components/somata/StartupSurface.tsx', {
    'react-native': Object.fromEntries(['ActivityIndicator', 'Pressable', 'ScrollView', 'Text', 'View'].map(n => [n,n])),
    'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView' },
    '@/components/brand/Brand': { SomataSymbol: 'SomataSymbol' },
    '@/services/theme/semanticTokens': { createSemanticTokens },
  });
  for (const dark of [false,true]) {
    let clicks=0, tree: any;
    await React.act(async () => { tree=renderer.create(React.createElement(StartupSurface,{dark,preparing:true,failed:true,onRetry:()=>clicks++})); });
    assert.equal(tree.root.findByType('SomataSymbol').props.size,120);
    assert.equal(tree.root.findAllByType('Text')[0].props.accessibilityRole,'alert');
    const button=tree.root.findByType('Pressable');
    assert(button.props.style({pressed:false}).minHeight>=48);
    button.props.onPress(); assert.equal(clicks,1);
    assert.equal(tree.root.findByType('SafeAreaView').props.style.backgroundColor,createSemanticTokens(dark).surface.canvas);
    await React.act(async () => tree.unmount());
  }
});
test('unknown-route recovery preserves back and cold-link Home actions', () => {
  let backAvailable=false;const calls:string[]=[];
  const { default: NotFound }=load('app/+not-found.tsx',{
    'expo-router': {useRouter:()=>({canGoBack:()=>backAvailable,back:()=>calls.push('back'),replace:(p:string)=>calls.push(p)})},
    '@/components/somata/TaskUI': {Button:'Button',Empty:'Empty',TaskPage:'TaskPage'},
    '@/components/designPreview/Appearance': {SomataTaskAppearance:'Appearance'},
  });
  const page=NotFound().props.children;
  page.props.onBack(); backAvailable=true; page.props.onBack();
  page.props.children[1].props.onPress();
  assert.deepEqual(calls,['/(tabs)','back','/(tabs)']);
});
