/* Synthetic-only rendering/controller adapter. No network, native or Firebase I/O. */
exports.install=args=>{
 const {socialFlow:f,mocks,React,RN,writes,subscriptions,account,load,inputs}=args;
 const flow=require('./profile-flow-runtime.cjs').install({...args,profileFlow:f});
 const write=kind=>async(...v)=>{if(!account.uid||f.accountInactive)throw Error('Inactive synthetic account');writes.push([kind,...v]);if(f.failSave||f.fail===kind)throw Error('Synthetic operation failed');};
 const sub=kind=>(uid,cb)=>{subscriptions.push({kind,uid,cb});return()=>{};};
 mocks['react-native'].Platform={OS:f.platform||'ios',select:v=>v[f.platform||'ios']??v.default};
 mocks['react-native'].Linking={openSettings:write('device-settings'),openURL:write('external-url')};
 mocks['react-native'].AccessibilityInfo={isReduceMotionEnabled:async()=>true};
 const Switch=mocks['react-native'].Switch;
 mocks['react-native'].Switch=props=>{inputs.push(props);return React.createElement(Switch,{...props,activeThumbColor:props.thumbColor||'#FFFFFF'});};
 // Undefined Modal.visible means visible in native React Native (old badge sheet).
 const Modal=mocks['react-native'].Modal;
 mocks['react-native'].Modal=props=>React.createElement(Modal,{...props,visible:props.visible!==false});
 const Icon=mocks['@expo/vector-icons'].Ionicons;
 Icon.glyphMap=require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json');
 mocks['react-native-qrcode-svg']={__esModule:true,default:()=>React.createElement(RN.View,{style:{width:156,height:156,borderWidth:4,borderColor:'#111',padding:12}},React.createElement(RN.Text,null,'Synthetic QR area — native QR rendering requires device review'))};
 mocks['@/services/friends/friends']={subscribeFriends:sub('friends'),subscribeFriendRequests:sub('requests'),sendFriendRequest:write('request'),respondToFriendRequest:write('respond'),cancelFriendRequest:write('cancel-request'),pingFriend:write('ping'),removeFriendship:write('remove-friend'),updateFriendNickname:write('nickname')};
 mocks['@/services/friends/friendsSafety']={createReport:write('report'),upsertBlock:write('block')};
 mocks['@/services/notifications']={...mocks['@/services/notifications'],notifyFriendAccepted:write('accepted-notification'),notifyFriendRequestSafe:write('request-notification'),notifyPingSafe:write('ping-notification')};
 mocks['@/hooks/useFriendSummary']={useFriendSummary:(uid,enabled)=>{subscriptions.push({kind:'summary',uid,enabled});return{data:f.summary??null,error:f.summaryError||null,loading:!!f.summaryLoading,refresh:()=>writes.push(['refresh-summary',uid])};}};
 mocks['@/services/friends/summary']={getFriendSummary:async uid=>{writes.push(['refetch-summary',uid]);return f.freshSummary||f.summary;},setFriendSummarySharing:write('consent'),friendSummaryError:()=> 'Synthetic request failure. Your private records have not been opened.'};
 mocks['@/services/badges/store']={loadUnlocksLocal:async()=>({}),loadFeaturedLocal:async()=>[],saveFeaturedLocal:write('featured')};
 // Extract only the real static provider catalogue. No service code is executed.
 const fs=require('fs'),ts=require('typescript'),vm=require('vm'),path=require('path');
 const src=fs.readFileSync(path.join(__dirname,'../services/integrations.ts'),'utf8');
 const ast=ts.createSourceFile('integration.ts',src,ts.ScriptTarget.Latest,true);
 let catalogue;const visit=n=>{if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='INTEGRATIONS')catalogue=n.initializer.getText(ast);ts.forEachChild(n,visit);};visit(ast);
 const defs=vm.runInNewContext('('+catalogue+')');
 mocks['@/services/integrations']={INTEGRATIONS:defs,subscribeIntegrations:cb=>{subscriptions.push({kind:'integrations',cb});return()=>{};},getGlobalSyncStatus:s=>({text:Object.values(s.connections).some(c=>c.status==='error')?'Sync needs attention':Object.values(s.connections).some(c=>c.connected)?'Connected sources':'No connected sources'}),getConnectionSyncLabel:(s,c)=>c.lastError||c.status||'Not synced',formatLastSync:d=>d?'Oct 19, 2026':'Not yet',formatSyncInterval:s=>s,describeSyncInterval:s=>'Selected interval: '+s,markPrimaryIntegration:write('primary-source'),runIntegrationSync:write('sync'),setIntegrationConnected:write('connection'),updateIntegrationConnection:write('connection-preference'),updateIntegrationSettings:write('sync-preference')};
 mocks['@/services/notificationSettings']={loadNotificationSettings:async()=>f.notifications,saveNotificationSettings:write('notification-settings')};
 mocks['expo-notifications']={getPermissionsAsync:async()=>({status:'denied',canAskAgain:true}),requestPermissionsAsync:write('notification-permission')};
 mocks['@react-native-community/datetimepicker']={__esModule:true,default:props=>{inputs.push({...props,accessibilityLabel:'Native time picker'});return React.createElement(RN.View,{style:{padding:20}},React.createElement(RN.Text,{style:{color:'#84919D'}},'Native time picker · '+props.value.toLocaleTimeString()));}};
 const oldTheme=mocks['@/content/ThemeProvider'].useTheme;
 mocks['@/content/ThemeProvider']={useTheme:()=>({...oldTheme(),modeSetting:'system',themeReady:true,themeLoadError:f.themeLoadError||null,refreshTheme:write('refresh-theme'),commitThemeDraft:write('theme-commit')})};
 mocks['expo-router'].usePreventRemove=()=>()=>{};
 const auth={get currentUser(){return f.accountInactive?{uid:'synthetic-other'}:account.uid?{uid:account.uid,...account.user,getIdToken:write('refresh-access')}:null;},signOut:write('signout')};
 mocks['@/lib/firebase']={auth,functions:{}};
 mocks['firebase/auth']={getAuth:()=>auth,reload:async()=>{},sendEmailVerification:write('verify-email'),sendPasswordResetEmail:write('reset-password'),EmailAuthProvider:{credential:()=>({synthetic:true})},reauthenticateWithCredential:write('reauth')};
 mocks['@/lib/authSocial']={isAppleSignInAllowed:()=>false,isGoogleSignInConfigured:()=>false,useGoogleLogin:()=>({reauthenticateGoogle:write('google-reauth')}),signInWithApple:write('apple-reauth')};
 mocks['@/services/account/deletion']={clearDeletedAccountDeviceData:write('delete-local'),deleteCurrentAccount:write('delete-server')};
 mocks['expo-web-browser']={openBrowserAsync:write('open-url')};
 mocks['@/services/checkout']={requestCheckout:()=>{throw Error('Checkout is disabled in offline review');}};
 mocks['firebase/functions']={httpsCallable:()=>write('callable')};
 mocks['@/lib/releaseConfig']={releaseConfig:{checkoutEnabled:false,privacyPolicyUrl:null,supportUrl:null,...f.releaseConfig}};
 mocks['@/content/useEntitlements']={useEntitlements:()=>({isPro:!!f.isPro,loading:!!f.accessLoading})};
 return flow;
};
