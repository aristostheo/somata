/* Offline workout controller adapter. Synthetic account data only; no native,
 * Firebase or provider access. Reuses the established nutrition hook harness. */
exports.install = args => {
 const {workoutFlow:f,mocks,React,RN,writes,subscriptions,account}=args;
 const flow=require('./nutrition-flow-runtime.cjs').install({...args,nutritionFlow:f});
 const write=kind=>async(...values)=>{if(!account.uid||f.accountInactive)throw Error('Inactive synthetic account');writes.push([kind,...values]);if(f.failSave)throw Error('Synthetic write failure');};
 const sub=kind=>(uid,cb)=>{subscriptions.push({kind,uid,cb});return()=>{};};
 mocks['@/services/workouts']={subscribeWorkouts:sub('workouts'),getRecentWorkouts:async()=>f.recent||[],addWorkout:write('workout-add'),deleteWorkout:write('workout-delete')};
 mocks['@/services/templates']={subscribeWorkoutTemplates:sub('templates'),saveWorkoutTemplate:write('template-save'),updateWorkoutTemplate:write('template-update'),deleteWorkoutTemplate:write('template-delete')};
 mocks['@/services/presets']={subscribeWorkoutPresets:sub('presets'),addWorkoutPreset:write('preset-add'),deleteWorkoutPreset:write('preset-delete')};
 mocks['@/services/exercises/firestore']={subscribeExercises:sub('catalog')};
 mocks['@/services/exercises/store']={loadFavorites:async()=>[],loadRecents:async()=>[],toggleFavorite:async(id,favorites,store)=>{store.assertCurrent();writes.push(['favorite',id,store.uid]);return new Set([...favorites,id]);},addRecent:async(id,store)=>{store.assertCurrent();writes.push(['recent',id,store.uid]);return[id];},clearRecents:async store=>writes.push(['clear-recents',store.uid])};
 mocks['@/services/integrations']={getRecoveryMetrics:()=>null,subscribeIntegrations:cb=>{subscriptions.push({kind:'integrations',cb});return()=>{};}};
 mocks['@/services/badges/store']={loadProgressLocal:async()=>({}),loadUnlocksLocal:async()=>({}),saveProgressLocal:write('badge-progress'),saveUnlocksLocal:write('badge-unlocks')};
 mocks['@/services/badges/reconcile']={reconcileBadgesFromSnapshot:async()=>({})};
 mocks['@/services/notificationTriggers']={notifyBadgeEarned:write('badge-notify'),notifyNewPR:write('pr-notify')};
 mocks['expo-clipboard']={setStringAsync:write('clipboard')};
 mocks['react-native'].Share={share:write('share')};
 const transition={duration(){return this;},delay(){return this;},springify(){return this;}};
 mocks['react-native-reanimated']={__esModule:true,default:{View:RN.View},FadeIn:transition,FadeInDown:transition,useReducedMotion:()=>true,useSharedValue:v=>({value:v}),useAnimatedStyle:fn=>fn(),withTiming:v=>v,withSpring:v=>v};
 mocks['react-native-svg']={...mocks['react-native-svg'],Svg:'svg',G:'g',Circle:'circle',Rect:'rect',Defs:'defs',LinearGradient:'linearGradient',Stop:'stop'};
 const oldList=mocks['react-native'].FlatList;
 mocks['react-native'].FlatList=props=>React.createElement(React.Fragment,null,React.createElement(oldList,props),props.ListFooterComponent);
 const gradient=mocks['expo-linear-gradient'].LinearGradient;
 mocks['expo-linear-gradient']={LinearGradient:props=>{const check=children=>React.Children.forEach(children,c=>{if(typeof c==='string'||typeof c==='number')throw Error('Raw native text in gradient: '+JSON.stringify(c));if(React.isValidElement(c)&&c.type===React.Fragment)check(c.props.children);});if(f.validateNativeText)check(props.children);return React.createElement(gradient,props);}};
 delete mocks['@/components/activity/ActivityLogSheet'];
 // Keep legacy color-dependent calculations usable while the rendered task UI
 // reads the actual semantic tokens. Only this offline adapter is affected.
 const oldTheme=mocks['@/content/ThemeProvider'].useTheme;
 mocks['@/content/ThemeProvider']={useTheme:()=>{const t=oldTheme();return{...t,colors:{bg:t.isDark?'#0B0E12':'#F4F3EE',text:t.isDark?'#F4F3EE':'#0B0E12',muted:'#83909C',border:'#38434D',card:t.isDark?'#1A1F26':'#FFFFFF',background:t.isDark?'#0B0E12':'#F4F3EE',...t.colors}};}};
 return flow;
};
