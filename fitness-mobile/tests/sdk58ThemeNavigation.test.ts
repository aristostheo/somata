import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import React from 'react';
import ts from 'typescript';
import * as themeState from '../services/theme/themeState';
import * as themeColor from '../lib/themeColor';
import { visualTokens } from '../components/accountSettings/visualTokens';

const require = createRequire(import.meta.url);
const { act, create } = require('react-test-renderer');
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Execute the real picker with inert native controls and the SDK 58 navigation contract.
async function picker() {
  const saved = themeState.copyTheme({ mode: 'system', ...themeState.OCEAN });
  const calls: any[] = [];
  const pending: { resolve: () => void; reject: (e: Error) => void }[] = [];
  let prevented = false;
  const navigate = () => { if (!prevented) calls.push('back'); };
  const modules: Record<string, any> = {
    react: React,
    '@/components/designPreview/Appearance': { SomataTaskAppearance: ({children}: any) => children, useTaskPresentation: () => ({ D: {}, F: {} }) },
    '@/components/accountSettings/PremiumUI': { DeskIntro: 'intro', DeskSection: 'section', DeskColumns: 'columns', StatusNote: 'note' },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': { View: 'view', Text: 'text', Pressable: 'pressable', useColorScheme: () => 'dark' },
    'expo-linear-gradient': { LinearGradient: 'gradient' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    'expo-router': {
      useRouter: () => ({ canGoBack: () => true, back: navigate, replace: navigate }),
      usePreventRemove: (value: boolean) => {
        prevented = value;
        return () => { prevented = false; calls.push('unblock'); };
      },
    },
    '@/components/somata/TaskUI': {
      Button: 'button', Empty: 'empty', Field: 'field', Heading: 'heading', Choice: 'choice', Panel: 'panel',
      TaskPage: (props: any) => React.createElement('page', props, props.children, props.footer),
    },
    '@/components/somata/theme': { useSomataTheme: () => ({ D: {}, F: {} }) },
    '@/components/accountSettings/visualTokens': { visualTokens },
    '@/lib/themeColor': themeColor,
    '@/services/theme/themeState': themeState,
    '@/content/ThemeProvider': { useTheme: () => ({
      modeSetting: saved.mode, themeAccents: saved, isDark: true, themeReady: true, themeLoadError: null,
      commitThemeDraft: (draft: any) => {
        calls.push(themeState.copyTheme(draft));
        return new Promise<void>((resolve, reject) => pending.push({ resolve, reject }));
      },
    }) },
  };
  const exports: any = {};
  const code = ts.transpileModule(readFileSync('app/(modals)/theme-editor.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  runInNewContext(code, { exports, require: (name: string) => {
    assert(name in modules, `Unexpected dependency: ${name}`); return modules[name];
  } });
  let renderer: any;
  await act(async () => { renderer = create(React.createElement(exports.default)); });
  return {
    calls, saved, pending, navigate,
    blocked: () => prevented,
    button: (label: string) => renderer.root.findAllByType('button').find((n: any) => n.props.label === label),
    choice: (label: string) => renderer.root.findAllByType('choice').find((n: any) => n.props.label === label),
    close: () => act(async () => renderer.unmount()),
  };
}

test('SDK 58 picker blocks dismissal during commit, ignores duplicate taps, then navigates after success', async () => {
  const p = await picker();
  try {
    await act(async () => p.choice('Dark').props.onPress());
    const save = p.button('Save theme').props.onPress;
    let task: Promise<void>;
    await act(async () => { task = save(); });
    assert(p.blocked());
    p.navigate();
    await act(async () => save());
    assert.equal(p.pending.length, 1);
    assert.equal(p.calls.length, 1);
    assert.equal(p.calls[0].mode, 'dark');
    await act(async () => { p.pending[0].resolve(); await task!; });
    assert.deepEqual(p.calls.slice(1), ['unblock', 'back']);
  } finally { await p.close(); }
});

test('SDK 58 picker preserves draft on save failure and supports retry', async () => {
  const p = await picker();
  try {
    await act(async () => p.choice('Light').props.onPress());
    let task: Promise<void>;
    await act(async () => { task = p.button('Save theme').props.onPress(); });
    await act(async () => { p.pending[0].reject(new Error('synthetic offline')); await task!; });
    assert.equal(p.blocked(), false);
    assert.equal(p.choice('Light').props.selected, true);
    assert.equal(p.calls.length, 1);
    await act(async () => { task = p.button('Save theme').props.onPress(); });
    assert.deepEqual(p.calls[0], p.calls[1]);
    await act(async () => { p.pending[1].resolve(); await task!; });
    assert.equal(p.calls.at(-1), 'back');
  } finally { await p.close(); }
});

test('SDK 58 picker cancellation never commits draft edits', async () => {
  const p = await picker();
  try {
    await act(async () => p.choice('Dark').props.onPress());
    await act(async () => p.button('Cancel changes').props.onPress());
    assert.deepEqual(p.calls, ['back']);
    assert.equal(p.saved.mode, 'system');
    assert.equal(p.pending.length, 0);
  } finally { await p.close(); }
});
