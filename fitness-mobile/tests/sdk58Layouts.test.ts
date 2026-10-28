import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import React from 'react';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const { TabRouter } = require('expo-router/build/react-navigation/routers/TabRouter');

function layout(path: string) {
  const Navigator = Object.assign(() => null, { Screen: () => null });
  const modules: Record<string, any> = {
    react: { ...React, useState: (value: any) => [value, () => {}], useEffect: () => {} },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': { View: 'view', Platform: { OS: 'ios' } },
    'expo-router': { Tabs: Navigator, Stack: Navigator, useRouter: () => ({}) },
    '@expo/vector-icons': { Ionicons: 'icon' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    '@/content/AuthContext': { useAuth: () => ({ user: null }) },
    '@/components/somata/theme': { useSomataTheme: () => ({ D: {}, semantic: {} }) },
    '@/services/notifications': { subscribeUnreadCount: () => { throw Error('No live subscriptions'); } },
  };
  const exports: any = {};
  runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { exports, require: (name: string) => {
    assert(name in modules, `Unexpected import ${name}`); return modules[name];
  } });
  return { settings: exports.unstable_settings, element: exports.default() };
}

test('SDK 58 tabs retain all five destinations and Back returns to Home from every other tab', () => {
  const { settings, element } = layout('app/(tabs)/_layout.tsx');
  const routeNames = React.Children.toArray(element.props.children).map((child: any) => child.props.name);
  assert.deepEqual(routeNames, ['index', 'workouts', 'nutrition', 'notifications', 'profile']);
  assert.equal(settings.initialRouteName, undefined);
  // Router translates the layout anchor to the underlying router's initialRouteName.
  const router = TabRouter({ initialRouteName: settings.anchor, backBehavior: element.props.backBehavior });
  const options = { routeNames, routeParamList: {}, routeGetIdList: {} };
  assert.equal(settings.anchor, 'index');
  assert.equal(element.props.backBehavior, 'initialRoute');
  const initial = router.getStateForDeclaredRoutes({
    key: 'synthetic-tabs', type: 'tab', stale: false, routeKeySeq: 5,
    index: 0, routeNames, routes: routeNames.map(name => ({ name, key: name })),
  }, routeNames);
  assert.equal(initial.routes[initial.index].name, 'index');
  for (const name of routeNames.slice(1)) {
    const opened = router.getStateForAction(initial, { type: 'JUMP_TO', payload: { name } }, options).state;
    assert.equal(opened.routes[opened.index].name, name);
    const back = router.getStateForAction(opened, { type: 'GO_BACK' }, options).state;
    assert.equal(back.routes[back.index].name, 'index');
  }
});

test('modal group children use a normal inner stack without fabricating a backing screen', () => {
  const { settings, element } = layout('app/(modals)/_layout.tsx');
  assert.equal(element.props.screenOptions.presentation, 'card');
  assert.equal(element.props.screenOptions.headerShown, false);
  assert.equal(settings, undefined);
  const names = React.Children.toArray(element.props.children).map((child: any) => child.props.name);
  assert(names.includes('progress-photos'));
  assert(!names.includes('index'));
});
