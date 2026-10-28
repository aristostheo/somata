/* Offline adapter for actual Nutrition JSX/controllers. All I/O is synthetic.
 * State overrides are named by source variable, never shipped to the app. */
exports.install = function ({ nutritionFlow: f, mocks, React, RN, account, routes, writes, alerts, effects, subscriptions, modals, load }) {
  const state = new Map(), timers = [], providerCalls = [], memory = new Map(Object.entries(f.storage || {}));
  const denied = () => { throw Error('Native/provider access is disabled in offline previews'); };
  const current = () => { if (!account.uid || f.accountInactive) throw Error('Synthetic account is inactive'); };
  const store = { uid: account.uid, assertCurrent: current, getItem: async key => { current(); return memory.get(key) ?? null; },
    setItem: async (key, value) => { current(); writes.push(['local', key, value, account.uid]); memory.set(key, value); },
    removeItem: async key => { current(); memory.delete(key); } };
  mocks['@/services/local/accountStore'] = { useAccountStorage: () => store, accountStorage: () => store, accountUidKeyStorage: () => store };
  mocks['@/content/AuthContext'] = { useAuth: () => ({ user: account.uid ? { uid: account.uid, ...account.user } : null }) };
  mocks['expo-router'] = { ...mocks['expo-router'], useNavigation: () => ({ setOptions() {} }),
    useLocalSearchParams: () => f.params || {}, useFocusEffect: effect => effects.push({ effect, focus: true }),
    useRouter: () => ({ push: r => routes.push(r), replace: r => routes.push(r), back: () => routes.push('BACK'), canGoBack: () => f.canGoBack !== false }) };
  mocks['react-native'] = { ...mocks['react-native'], Alert: { alert: (...args) => alerts.push(args) },
    Modal: props => { if (!props.visible) return null; modals.push(props); return React.createElement(RN.View, { style: { minHeight: 500 } }, props.children); },
    Keyboard: { dismiss() {} }, LayoutAnimation: { configureNext() {}, Presets: { easeInEaseOut: {} } }, UIManager: {},
    Image: props => React.createElement(RN.View, { style: props.style, accessibilityLabel: props.accessibilityLabel }, React.createElement(RN.Text, { style: { color: '#73808B', padding: 18 } }, 'SYNTHETIC PHOTO AREA · native image not verified')),
  };
  // Web accepts raw whitespace under View; native throws. Opt into that native
  // constraint for render regressions, including strings hidden in fragments.
  if (f.validateNativeText) {
    const check = children => React.Children.forEach(children, child => {
      if ((typeof child === 'string' && child !== '') || typeof child === 'number') {
        throw Error('Text strings must be rendered within a <Text> component. Raw child: ' + JSON.stringify(child));
      }
      if (React.isValidElement(child) && child.type === React.Fragment) check(child.props.children);
    });
    for (const name of ['View', 'ScrollView']) {
      const Component = mocks['react-native'][name];
      mocks['react-native'][name] = React.forwardRef((props, ref) => {
        check(props.children);
        return React.createElement(Component, { ...props, ref });
      });
    }
  }
  mocks['expo-haptics'] = { selectionAsync: async () => {}, impactAsync: async () => {}, notificationAsync: async () => {}, ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' }, NotificationFeedbackType: { Success: 'success', Error: 'error' } };
  mocks['expo-camera'] = { useCameraPermissions: () => [{ granted: !!f.cameraGranted }, denied],
    CameraView: props => React.createElement(RN.View, { style: props.style }, React.createElement(RN.Text, { style: { color: '#73808B', padding: 18 } }, 'OFFLINE CAMERA AREA · device check required')) };
  mocks['expo-image-picker'] = { requestCameraPermissionsAsync: denied, requestMediaLibraryPermissionsAsync: denied, launchCameraAsync: denied, launchImageLibraryAsync: denied };
  mocks['expo-constants'] = { __esModule: true, default: { expoConfig: { extra: {} } } };
  mocks['@react-native-async-storage/async-storage'] = { __esModule: true, default: {
    getItem: async key => memory.get(key) ?? null, setItem: async (key, value) => { writes.push(['storage', key, value]); if(f.failStorage)throw Error('Synthetic storage failure');memory.set(key, value); }, removeItem: async key => memory.delete(key) } };
  mocks['@/services/queueNutritionHandoff'] = { queueNutritionHandoff: async (key, payload, owner) => { owner.assertCurrent(); writes.push(['handoff', key, payload, owner.uid]); if(f.failSave)throw Error('Synthetic save failure');if(f.saveWait)await f.saveWait; } };
  mocks['@/services/foodCatalog'] = { searchCatalog: async () => f.catalog || [] };
  mocks['@/services/nutritionRecents'] = { fetchMyRecentFoods: async () => [], fetchMyTopFoods: async () => [] };
  mocks['@/services/profile'] = { subscribeProfile: (uid, cb) => { subscriptions.push({ kind: 'profile', uid, cb }); return () => {}; }, ensureProfile: async () => {},
    updateProfile: async (uid, patch) => { current(); writes.push(['profile', uid, patch]);if(f.failSave)throw Error('Synthetic save failure'); } };
  mocks['@/components/accountSettings/useProfileFlowTheme'] = { useProfileFlowTheme: () => ({ colors: { border: '#38434D', surface: '#1A1F26', surface2: '#242B34', muted: '#BCC3CA', text: '#F4F3EE', primary: '#FF6A00' }, isDark: true }) };
  mocks['@/components/profile/premium/ui'] = { withAlpha: x => x };
  mocks['@/content/useEntitlements'] = { useEntitlements: () => ({ isPro: !!f.isPro }) };
  mocks['@/lib/releaseConfig'] = { releaseConfig: { checkoutEnabled: false } };
  mocks['@/services/openai'] = { callOpenAIJson: async (...args) => { providerCalls.push(args);if(f.providerError)throw Error(f.providerError);if(!f.providerResult)throw Error('Offline provider result not supplied');return f.providerResult; }, extractJsonFromText: JSON.parse };
  mocks['@/components/scanMeal/new/services/scanMealService'] = { scanMealFromImage: async (...args) => { providerCalls.push(args);if(f.providerError)throw Error(f.providerError);if(!f.scanResult)throw Error('Offline scan result not supplied');return f.scanResult; } };
  mocks['@/services/scanMeal/scanQuota'] = { getScanQuotaStatus: async () => ({ remaining: 2, used: 0, limit: 2, unlimited: false }), reserveScanToken: async () => ({ allowed: !f.quotaDenied, remaining: f.quotaDenied ? 0 : 1, used: 1, limit: 2, unlimited: false }), refundScanToken: async () => {} };
  // The production logged-food editor is mocked only by the tab adapter, not here.
  delete mocks['@/components/nutrition/uiNew/EditFoodSheet'];
  return {
    state, timers, providerCalls, memory,
    instrument(source, file, ts) {
      if (!file.endsWith('.tsx')) return source;
      const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX), edits=[];
      const visit=node=>{ if(ts.isVariableDeclaration(node)&&ts.isArrayBindingPattern(node.name)&&node.initializer&&ts.isCallExpression(node.initializer)){
        const call=node.initializer, target=call.expression.getText(ast);
        if(target==='useState'||target==='React.useState') edits.push({start:call.getStart(ast),end:call.end,text:`__flowState(${JSON.stringify(file+':'+node.name.elements[0].name.getText(ast))}, ${call.arguments[0]?.getText(ast)||'undefined'})`});
      }ts.forEachChild(node,visit);};visit(ast);
      for(const e of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,e.start)+e.text+source.slice(e.end);return source;
    },
    globals() { return { __flowState(key,initial) { if(!state.has(key)){ const name=key.slice(key.lastIndexOf(':')+1); const raw=Object.hasOwn(f.states||{},key)?f.states[key]:Object.hasOwn(f.states||{},name)?f.states[name]:initial;state.set(key,typeof raw==='function'?raw():raw); }return [state.get(key),next=>state.set(key,typeof next==='function'?next(state.get(key)):next)]; },
      setTimeout: (fn,delay) => { timers.push({fn,delay});return timers.length; }, clearTimeout() {}, setInterval: denied, clearInterval() {}, console,
      fetch: denied, URL, URLSearchParams,
    }; },
  };
};
