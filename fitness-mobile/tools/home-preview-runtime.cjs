/* Local-only rendering/test adapter. No Firebase initialization or account I/O.
 * Browser rendering is not native layout/permission/device verification. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const req = createRequire(path.join(root, 'package.json'));
const ts = req('typescript'), React = req('react'), RN = req('react-native-web');
const { renderToStaticMarkup } = req('react-dom/server');
// Repeated synthetic cases compile the same immutable source. Cache code only,
// never React state, fixtures, module instances, or account data.
const flowCompileCache = new Map();
const glyphs = req('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json');

exports.createRuntime = function ({ dark = true, width = 390, fontScale = 1, account = {}, nutrition, workouts, profileReview, notifications, utilities, nutritionFlow, workoutFlow, profileFlow, socialFlow, sourceRoot } = {}) {
  const cache = new Map(), actions = [], routes = [], inputs = [];
  const fixtureDate = utilities?.today || '2026-10-19';
  const utilityStates = {
    'app/(tabs)/index.tsx': [false, !!utilities?.stepsOpen, utilities?.stepsMode || 'add', utilities?.stepsText || '', !!utilities?.saving],
    'app/profile/sync-history.tsx': [utilities?.snapshot ?? null],
    'app/(modals)/full-calendar.tsx': [utilities?.profile ?? null, utilities?.view || 'month',
      new Date(`${fixtureDate.slice(0, 7)}-01T12:00:00`), new Date(`${utilities?.weekStart || fixtureDate}T12:00:00`),
      Number(fixtureDate.slice(0, 4)), utilities?.selectedDate || fixtureDate, utilities?.sheetDate || null, null, utilities?.days || {}, true],
  };
  let modal; const modals = [];

  // Explicit offline hook fixtures; effects/subscriptions are not executed by SSR.
  const nutritionState = nutrition ? [nutrition.date, nutrition.foods, null, false, nutrition.water ?? null] : [];
  const workoutState = workouts ? [workouts.rows, workouts.templates, !!workouts.configOpen, '', '', '45', workouts.activities || [], false, null, null] : [];
  const profileState = [false], reviewActions = [];
  const notificationState = notifications ? [notifications.rows ?? null, notifications.filter || "All", !!notifications.busy, !!notifications.error, 0] : [];
  const effects = [], subscriptions = [];
  let listProps;
  let stateIndex = 0, editor, activitySheet;
  const writes = [], alerts = [];
  const fail = () => { throw new Error('Preview must never write account data'); };
  let theme;
  const Image = Object.assign(props => React.createElement('img', { src: props.source.uri,
    alt: props.accessibilityLabel, style: { display: 'block', ...props.style, objectFit: props.resizeMode } }),
  { resolveAssetSource: source => source });
  const Tabs = Object.assign(({ screenOptions, children }) => React.createElement(RN.View, {
    style: { ...screenOptions({ route: { name: 'index' } }).tabBarStyle, position: 'relative', left: 0, right: 0, bottom: 0,
      height: 'auto', minHeight: 66, margin: 8, flexDirection: 'row' },
  }, React.Children.toArray(children).map(child => {
    const options = screenOptions({ route: { name: child.props.name } });
    const color = child.props.name === (notifications ? 'notifications' : profileReview ? 'profile' : workouts ? 'workouts' : nutrition ? 'nutrition' : 'index') ? options.tabBarActiveTintColor : options.tabBarInactiveTintColor;
    return React.createElement(RN.View, { key: child.props.name, style: { flex: 1, alignItems: 'center', gap: 3 } },
      options.tabBarIcon({ color }), React.createElement(RN.Text, { style: { ...options.tabBarLabelStyle, color } }, child.props.options.title));
  })), { Screen: () => null });
  const mocks = {
    'react-native': { ...RN, Image, Alert: { alert: nutrition || workouts || notifications || utilities ? (...args) => alerts.push(args) : fail },
      FlatList: props => {
        listProps = props;
        return React.createElement(RN.View, { style: props.contentContainerStyle }, props.ListHeaderComponent,
          props.data.length ? props.data.map(item => React.createElement(RN.View, { key: props.keyExtractor(item), style: { marginBottom: 12 } }, props.renderItem({ item }))) : props.ListEmptyComponent);
      },
      Modal: props => { if (utilities && props.visible) { modal = props; return React.createElement(RN.View, { style: { minHeight: 600 } }, props.children); }
        return workouts && props.visible ? React.createElement(RN.View, null, props.children) : null; },
      TextInput: props => { inputs.push(props); return React.createElement(RN.TextInput, props); },
      Pressable: props => { actions.push(props); return React.createElement(RN.Pressable, props); },
      Text: props => {
        const style = RN.StyleSheet.flatten(props.style) || {};
        return React.createElement(RN.Text, { ...props, style: { ...style,
          ...(style.fontSize ? { fontSize: style.fontSize * fontScale } : {}),
          ...(style.lineHeight ? { lineHeight: style.lineHeight * fontScale } : {}) } });
      },
      useWindowDimensions: () => ({ width, height: 844, scale: 1, fontScale }) },
    'expo-haptics': { selectionAsync: fail },
    'react-native-reanimated': { useReducedMotion: () => true },
    '@/content/ThemeProvider': { useTheme: () => theme },
    '@/content/AuthContext': { useAuth: () => ({ user: (workouts || notifications || utilities) && account.uid ? { uid: account.uid, ...account.user } : null }) },
     '@/services/notifications': { subscribeUnreadCount: fail,
      subscribeNotifications: (uid, cb, options) => { const sub = { uid, cb, options, stopped: false }; subscriptions.push(sub); return () => { sub.stopped = true; }; },
      markNotificationRead: async (...args) => { writes.push(['read', ...args]); if (notifications?.failRead) throw Error('synthetic failure'); },
      markAllNotificationsRead: async (...args) => { writes.push(['mark-all', ...args]); if (notifications?.failMark) throw Error('synthetic failure'); },
      deleteNotification: async (...args) => { writes.push(['dismiss', ...args]); if (notifications?.failDismiss) throw Error('synthetic failure'); },
      notifyPingSafe: async (...args) => writes.push(['ping-notification', ...args]),
    },
    '@/services/friends/friends': { pingFriend: async (...args) => { writes.push(['ping', ...args]); if (notifications?.failPing) throw Error('synthetic failure'); } },
    '@/services/notificationTriggers': { notifyFriendPing: async (...args) => writes.push(['local-ping', ...args]) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) },
    'expo-router': { Tabs, useRouter: () => ({ push: route => routes.push(route), back: () => routes.push('BACK') }), useFocusEffect: () => {}, useLocalSearchParams: () => ({}) },
    '@/services/workouts': { subscribeWorkouts: fail },
    '@/services/templates': { subscribeWorkoutTemplates: fail,
      updateWorkoutTemplate: async (...args) => writes.push(['template-update', ...args]),
      deleteWorkoutTemplate: async (...args) => writes.push(['template-delete', ...args]) },
    '@/services/activity': { subscribeActivityBetween: fail,
      addActivity: async (...args) => writes.push(['activity-add', ...args]),
      updateActivity: async (...args) => writes.push(['activity-update', ...args]),
      deleteActivity: async (...args) => writes.push(['activity-delete', ...args]) },
    '@/components/activity/ActivityLogSheet': { __esModule: true, default: props => { activitySheet = props; return null; } },
    '@react-native-async-storage/async-storage': { __esModule: true, default: {
      getItem: async key => workouts?.storage?.[key] ?? utilities?.storage?.[key] ?? null,
      setItem: async (...args) => writes.push(['storage', ...args]) } },
    '@/components/designPreview/usePreviewAccount': { usePreviewAccount: () => account },
    '@/hooks/useFitAdaptReviewState': { useFitAdaptReviewState: () => ({
      busy: false, pending: null, note: null, current: null, activeSynced: false, loadFailed: false,
      ...profileReview, run: async action => { reviewActions.push(action); },
    }) },
    '@/services/profile': {
      subscribeProfile: utilities ? (uid, cb) => { subscriptions.push({ kind: 'profile', uid, cb }); return () => {}; } : fail,
      addStepsForDate: utilities ? async (...args) => { writes.push(['add-steps', ...args]); if (utilities.failSteps) throw Error('Synthetic steps failure'); if (utilities.stepsWait) await utilities.stepsWait; } : fail,
      setStepsForDate: utilities ? async (...args) => { writes.push(['set-steps', ...args]); if (utilities.failSteps) throw Error('Synthetic steps failure'); if (utilities.stepsWait) await utilities.stepsWait; } : fail,
    },
    '@/services/calendarData': { getCalendarRangeData: utilities ? async (...args) => { subscriptions.push({ kind: 'calendar', args }); return utilities.days || {}; } : fail },
    '@/services/integrations': {
      INTEGRATIONS: [{ id: 'appleHealth', name: 'Apple Health' }, { id: 'healthConnect', name: 'Health Connect' }],
      formatLastSync: value => value ? new Date(value).toLocaleString('en-CA') : 'Not yet',
      subscribeIntegrations: utilities ? (cb, store) => { subscriptions.push({ kind: 'integrations', cb, store }); return () => {}; } : fail,
      clearSyncHistory: utilities ? store => writes.push(['clear-sync', store.uid]) : fail,
    },
    '@/services/local/accountStore': { useAccountStorage: () => ({ uid: account.uid, getItem: fail,
      setItem: async (...args) => writes.push(['water', ...args]) }) },
    '@/services/nutrition': { subscribeFoodsByDate: fail,
      updateFood: async (...args) => writes.push(['update', ...args]), deleteFood: async (...args) => writes.push(['delete', ...args]) },
    '@/services/previewNutritionHandoff': { consumePreviewNutritionHandoffs: fail },
    '@/components/nutrition/uiNew/EditFoodSheet': { __esModule: true, default: props => { editor = props; return null; } },
    'expo-linear-gradient': { LinearGradient: ({ colors, start, end, style, ...props }) => {
      const angle = start && end ? 90 - Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI : 180;
      return React.createElement(RN.View, { ...props, style: [style, { backgroundImage: `linear-gradient(${angle}deg, ${colors.join(',')})` }] });
    } },
    'react-native-svg': { __esModule: true, default: 'svg', Line: 'line', Path: 'path' },
    '@expo/vector-icons': { Ionicons: ({ name, size, color }) => React.createElement('span', {
      'aria-hidden': true, title: name, style: { fontFamily: 'Ionicons', fontSize: size, color, flexShrink: 0, lineHeight: 1 },
    }, String.fromCodePoint(glyphs[name])) },
  };
  const flow = socialFlow ? require('./social-flow-runtime.cjs').install({ socialFlow, mocks, React, RN, account, actions, routes, inputs, writes, alerts, effects, subscriptions, modals, load: f => load(path.join(root, f)) }) : profileFlow ? require('./profile-flow-runtime.cjs').install({ profileFlow, mocks, React, RN, account, actions, routes, inputs, writes, alerts, effects, subscriptions, modals, load: f => load(path.join(root, f)) }) : workoutFlow ? require('./workout-flow-runtime.cjs').install({ workoutFlow, mocks, React, RN, account, actions, routes, inputs, writes, alerts, effects, subscriptions, modals, load: f => load(path.join(root, f)) }) : nutritionFlow ? require('./nutrition-flow-runtime.cjs').install({ nutritionFlow, mocks, React, RN, account, actions, routes, inputs, writes, alerts, effects, subscriptions, modals, load: f => load(path.join(root, f)) }) : null;
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    const requireForFile = name => {
      const relative = path.relative(root, file);
      if (flow && name === 'react') return { ...React, useEffect: (effect, deps) => effects.push({ effect, deps }) };
      if (utilities && name === 'react' && utilityStates[relative]) return { ...React,
        useEffect: (effect, deps) => effects.push({ effect, deps }),
        useState: () => { const index = stateIndex++, values = utilityStates[relative]; return [values[index], value => {
          values[index] = typeof value === 'function' ? value(values[index]) : value;
        }]; },
      };
      if (notifications && name === 'react' && file.endsWith('/app/(tabs)/notifications.tsx')) return { ...React,
        useEffect: (effect, deps) => effects.push({ effect, deps }),
        useState: () => { const index = stateIndex++; return [notificationState[index], value => {
          notificationState[index] = typeof value === 'function' ? value(notificationState[index]) : value;
        }]; },
      };
      if (profileReview && name === 'react'  && file.endsWith('/app/(tabs)/profile.tsx')) return { ...React,
        useState: () => [profileState[0], value => { profileState[0] = typeof value === 'function' ? value(profileState[0]) : value; }] };
      if (workouts && name === 'react' && file.endsWith('/app/(tabs)/workouts.tsx')) return { ...React,
        useState: () => {
          const index = stateIndex++;
          return [workoutState[index], value => { workoutState[index] = typeof value === 'function' ? value(workoutState[index]) : value; }];
        } };
      if (nutrition && name === 'react' && file.endsWith('/app/(tabs)/nutrition.tsx')) return { ...React,
        useState: () => {
          const index = stateIndex++;
          return [nutritionState[index], value => { nutritionState[index] = typeof value === 'function' ? value(nutritionState[index]) : value; }];
        } };
      if (name in mocks) return mocks[name];
      if (name.endsWith('.png')) {
        const asset = path.resolve(path.dirname(file), name), png = fs.readFileSync(asset);
        return { uri: '../../' + path.relative(root, asset), width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
      }
      if (workoutFlow && ['react-native-body-highlighter', 'react-native-body-highlighter/dist/index'].includes(name)) return load(req.resolve(name));
      if (name.startsWith('.') || name.startsWith('@/')) {
        const base = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name);
        if (base.endsWith('.json')) return JSON.parse(fs.readFileSync(base, 'utf8'));
        const target = ['.tsx', '.ts', ...(workoutFlow ? ['.js'] : [])].map(ext => base + ext).find(p => fs.existsSync(p));
        if (!target) throw new Error(`Preview module unavailable: ${name}`);
        return load(target);
      }
      if (!['react'].includes(name)) throw new Error(`Preview dependency not allowed: ${name}`);
      return req(name);
    };
    const original = sourceRoot && path.join(sourceRoot, path.relative(root, file));
    let source = fs.readFileSync(original && fs.existsSync(original) ? original : file, 'utf8');
    const compileKey = flow ? (socialFlow ? 'social' : profileFlow ? 'profile' : workoutFlow ? 'workout' : 'nutrition') + '\0' + file + '\0' + source : null;
    let code = compileKey && flowCompileCache.get(compileKey);
    if (!code) {
      if (flow) source = flow.instrument(source, path.relative(root, file), ts);
      code = ts.transpileModule(source, {
        compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
      }).outputText;
      if (compileKey) flowCompileCache.set(compileKey, code);
    }
    const PreviewDate = class extends Date { constructor(...args) { super(...(args.length ? args : [`${fixtureDate}T12:00:00`])); } static now() { return new Date(`${fixtureDate}T12:00:00`).getTime(); } };
    vm.runInNewContext(code, { React, exports, require: requireForFile, ...(utilities || flow ? { Date: PreviewDate, requestAnimationFrame: fn => fn() } : {}), ...(flow ? flow.globals(file) : {}) }, { filename: file });
    return exports;
  }
  const tokens = load(path.join(root, 'services/theme/semanticTokens.ts')).createSemanticTokens(dark);
  theme = { isDark: dark, semantic: tokens, colors: { primary: '#86506F', accent: '#79D7BF' } };
  function render(component, props = {}) {
    actions.length = 0; routes.length = 0; inputs.length = 0; modal = undefined; modals.length = 0;
    stateIndex = 0; effects.length = 0;
    RN.AppRegistry.registerComponent('SomataHomeReview', () => () => React.createElement(component, props));
    const { element, getStyleElement } = RN.AppRegistry.getApplication('SomataHomeReview');
    const body = renderToStaticMarkup(element);
    return { body, styles: renderToStaticMarkup(getStyleElement()) };
  }
  return { inputs, utilityStates, flow, modals, get modal() { return modal; }, load: relative => load(path.join(root, relative)), render, actions, routes, tokens, theme,
    nutritionState, workoutState, profileState, reviewActions, notificationState, effects, subscriptions, get listProps() { return listProps; }, writes, alerts, get editor() { return editor; }, get activitySheet() { return activitySheet; },
    notifications: () => render(load(path.join(root, 'app/(tabs)/notifications.tsx')).default),
    notificationsPreview: () => render(() => React.createElement(React.Fragment, null,
      React.createElement(load(path.join(root, 'app/(tabs)/notifications.tsx')).default),
      React.createElement(load(path.join(root, 'app/(tabs)/_layout.tsx')).default))),
    profile: () => render(load(path.join(root, 'app/(tabs)/profile.tsx')).default),
    profilePreview: () => render(() => React.createElement(React.Fragment, null,
      React.createElement(load(path.join(root, 'app/(tabs)/profile.tsx')).default),
      React.createElement(load(path.join(root, 'app/(tabs)/_layout.tsx')).default))),
    workouts: () => render(load(path.join(root, 'app/(tabs)/workouts.tsx')).default),
    workoutsPreview: () => render(() => React.createElement(React.Fragment, null,
      React.createElement(load(path.join(root, 'app/(tabs)/workouts.tsx')).default),
      React.createElement(load(path.join(root, 'app/(tabs)/_layout.tsx')).default))),
    nutrition: () => render(load(path.join(root, 'app/(tabs)/nutrition.tsx')).default),
    nutritionPreview: () => render(() => React.createElement(React.Fragment, null,
      React.createElement(load(path.join(root, 'app/(tabs)/nutrition.tsx')).default),
      React.createElement(load(path.join(root, 'app/(tabs)/_layout.tsx')).default))),
    home: () => render(load(path.join(root, 'app/(tabs)/index.tsx')).default),
    preview: () => render(() => React.createElement(React.Fragment, null,
      React.createElement(load(path.join(root, 'app/(tabs)/index.tsx')).default),
      React.createElement(load(path.join(root, 'app/(tabs)/_layout.tsx')).default))) };
};
