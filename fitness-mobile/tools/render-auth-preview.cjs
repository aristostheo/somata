/* Offline browser previews of the real login presentation. Native services are
 * stubbed; this does not authenticate, mount Firebase, or test iOS rendering. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const localRequire = createRequire(path.join(root, 'package.json'));
const ts = localRequire('typescript');
const React = localRequire('react');
const { renderToStaticMarkup } = localRequire('react-dom/server');
const RN = localRequire('react-native-web');
const output = path.join(root, 'review/branding-2b');
fs.mkdirSync(output, { recursive: true });
let dark = true, viewport = 390;
// RN Web's Image waits for a client effect; use an ordinary img for offline SSR.
const Image = Object.assign(props => React.createElement('img', { src: props.source.uri, alt: props.accessibilityLabel,
  style: { display: 'block', ...props.style, objectFit: props.resizeMode } }), { resolveAssetSource: source => source });
const noop = () => {};
const mocks = {
  'react-native': { ...RN, Image, Switch: props => React.createElement(RN.Switch, { ...props, activeThumbColor: props.thumbColor, activeTrackColor: props.trackColor?.true }), useWindowDimensions: () => ({ width: viewport, height: 844, scale: 1, fontScale: 1 }) },
  '@/content/ThemeProvider': { useTheme: () => ({ isDark: dark }) },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) },
  'expo-router': { useRouter: () => ({ push: noop, replace: noop }) },
  'expo-apple-authentication': {},
  'firebase/auth': {},
  '@react-native-async-storage/async-storage': {},
  '@/lib/firebase': {},
  '@/lib/authErrorMessage': {},
  '@/services/fitadaptOnboarding': {},
  '@/lib/authSocial': { isAppleSignInAllowed: () => false, isGoogleSignInConfigured: () => false },
  '@expo/vector-icons': { Ionicons: ({ size, color }) => React.createElement(RN.Text, { style: { fontSize: size, color }, 'aria-hidden': true }, '◉') },
};
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const requireForFile = name => {
    if (name in mocks) return mocks[name];
    if (name.endsWith('.png')) {
      const asset = path.resolve(path.dirname(file), name), png = fs.readFileSync(asset);
      return { uri: '../../' + path.relative(root, asset), width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
    }
    if (name.startsWith('.') || name.startsWith('@/')) {
      const base = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name);
      return load(['.tsx', '.ts'].map(ext => base + ext).find(p => fs.existsSync(p)));
    }
    return localRequire(name);
  };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, require: requireForFile }, { filename: file });
  return exports;
}
const Login = load(path.join(root, 'app/(auth)/login.tsx')).default;
RN.AppRegistry.registerComponent('BrandingLogin', () => Login);
const pages = [];
for (const mode of ['dark', 'light']) for (const width of [390, 320]) {
  dark = mode === 'dark'; viewport = width;
  const { element, getStyleElement } = RN.AppRegistry.getApplication('BrandingLogin');
  const body = renderToStaticMarkup(element), styles = renderToStaticMarkup(getStyleElement());
  const name = `login-${mode}-${width}.html`; pages.push({ name, mode, width });
  fs.writeFileSync(path.join(output, name), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Somata login — ${mode} ${width}px preview</title>${styles}<style>html,body,#root{margin:0;min-height:100%;height:100%;}body{width:${width}px;max-width:100%;background:${dark ? '#0B0E12' : '#F4F3EE'}}#root{display:flex;flex-direction:column;max-width:${width}px;margin:auto}</style><div id="root">${body}</div></html>`);
}
const Button = load(path.join(root, 'components/somata/AuthControls.tsx')).Button;
const buttonPreviews = ['dark', 'light'].map(mode => {
  dark = mode === 'dark';
  return `<section style="padding:24px;background:${dark ? '#0B0E12' : '#F4F3EE'};width:294px;border-radius:14px">${renderToStaticMarkup(React.createElement(Button, { label: 'Sign in', primary: true, onPress: noop }))}</section>`;
}).join('');
const previewStyles = renderToStaticMarkup(RN.AppRegistry.getApplication('BrandingLogin').getStyleElement());
fs.writeFileSync(path.join(output, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Checkpoint 2B — login review</title>${previewStyles}<style>body{font:16px/1.5 system-ui;background:#e4e6e8;color:#0B0E12;padding:24px}main{display:flex;gap:24px;flex-wrap:wrap}iframe{border:1px solid #73808b;border-radius:20px;height:844px;max-width:100%}h2{font-size:18px}a{color:#9d3500}</style><h1>Authentication · light and dark review</h1><p>Rendered from the actual login and brand components through React Native Web. These are <strong>browser previews, not iPhone screenshots</strong>. Scroll inside each preview. No authentication/network operation runs. Inputs start empty; Sign in is correctly disabled.</p><h2>Enabled sign-in button · both modes</h2><main>${buttonPreviews}</main><p>Safe-area insets are zero in these previews; native keyboard, VoiceOver, dynamic type, platform eye/switch controls and conditional social providers still need device review. The eye glyph is a preview stand-in; images use an HTML img adapter for static rendering. Approved logo PNGs are unchanged. The logo is 280 × 101.1 logical pixels, capped by available width.</p><main>${pages.map(p => `<section><h2>${p.mode} · ${p.width}px</h2><p><a href="${p.name}">Open full preview</a></p><iframe title="${p.mode} ${p.width}px login" width="${p.width}" src="${p.name}"></iframe></section>`).join('')}</main>`);
console.log(`Generated ${pages.length} offline login previews and index in review/branding-2b/`);
