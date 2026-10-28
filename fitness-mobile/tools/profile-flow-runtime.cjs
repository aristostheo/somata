/* Synthetic, offline Profile-family adapter. No Firebase/native/provider access. */
exports.install=args=>{
 const {profileFlow:f,mocks,React,RN,writes,subscriptions,account}=args;
 const image=mocks['react-native'].Image;
 const flow=require('./workout-flow-runtime.cjs').install({...args,workoutFlow:f});
 delete mocks['@/components/accountSettings/useProfileFlowTheme'];
 const oldTheme=mocks['@/content/ThemeProvider'].useTheme;
 mocks['@/content/ThemeProvider']={useTheme:()=>({...oldTheme(),themeAccents:{dark:{primary:'#86506F',accent:'#79D7BF'},light:{primary:'#86506F',accent:'#79D7BF'}}})};
 const photo=props=>React.createElement(RN.View,{style:[props.style,{overflow:'hidden',backgroundColor:'#38434D',alignItems:'center',justifyContent:'center'}]},React.createElement(RN.Text,{style:{fontSize:10,color:'#F4F3EE',padding:4,textAlign:'center'}},'SYNTHETIC PHOTO')); 
 mocks['react-native'].Image=Object.assign(props=>React.createElement(props.source?.width?image:photo,props),{resolveAssetSource:image.resolveAssetSource});
 mocks['react-native-svg']={...mocks['react-native-svg'],Polygon:'polygon',Text:'text'};
 mocks['@react-native-community/slider']={__esModule:true,default:props=>{args.inputs.push(props);return React.createElement('input',{type:'range','aria-label':props.accessibilityLabel,min:props.minimumValue,max:props.maximumValue,value:props.value,readOnly:true,style:{width:'100%',accentColor:props.minimumTrackTintColor}});}};
 mocks['react-native'].FlatList=props=>React.createElement(RN.ScrollView,{horizontal:props.horizontal,contentContainerStyle:props.contentContainerStyle},props.data.map((item,index)=>React.createElement(RN.View,{key:props.keyExtractor(item,index)},props.renderItem({item,index}))));
 const write=kind=>async(...v)=>{if(!account.uid||f.accountInactive)throw Error('Inactive synthetic account');writes.push([kind,...v]);if(f.failSave)throw Error('Synthetic write failure');};
 const sub=kind=>(uid,...args)=>{subscriptions.push({kind,uid,cb:args.find(x=>typeof x==='function')});return()=>{};};
 mocks['@/services/nutrition']={subscribeFoodsBetween:sub('foods'),subscribeExerciseBetween:sub('exercise')};
 mocks['@/services/activity']={subscribeActivityBetween:sub('activity')};
 mocks['@/services/profile/bodyMetrics']={loadBodyMetrics:async()=>f.bodyMetrics||null,loadBodyMetricsHistory:async()=>f.history||[],saveBodyMetrics:write('body-save'),appendBodyMetricsHistory:write('body-history')};
 mocks['@/services/progressPhotos']={getPhotos:async()=>f.photos||[],hasSeenProgressPhotoPrivacyNotice:async()=>true,markProgressPhotoPrivacyNoticeSeen:write('photo-privacy'),addPhoto:write('photo-add'),deletePhoto:write('photo-delete')};
 mocks['@/services/weeklyCheckin']={getCurrentWeekStart:()=> '2026-10-19',getWeekRangeLabel:d=>'Week of '+d,getThisWeeksCheckin:async()=>f.completed||null,getCheckins:async()=>f.checkins||[],getWeeklyConsistencyStats:async()=>f.stats||null,saveCheckin:write('checkin-save'),scheduleWeeklyCheckinReminders:write('checkin-reminder')};
 mocks['@/lib/firebase']={auth:{currentUser:{uid:account.uid}}};
 mocks['firebase/auth']={signOut:write('signout')};
 mocks['@/services/fitadaptOnboarding']={clearFitAdaptSetupMarker:write('setup-marker-clear'),fitAdaptSetupPendingFor:async()=>!!f.newUser};
 mocks['@/services/fitadapt']={getFitAdaptPlan:async()=>f.plan||{currentRecommendation:null,pending:null},requestFitAdaptEvaluation:async()=>{writes.push(['evaluate']);if(f.reviewError)throw Error(f.reviewError);return f.reviewResult||{kind:'insufficient_data',missing:['history.weight']};}};
 mocks['@/services/profile/accountWeightEntries']={subscribeAccountWeightEntries:sub('weight')};
 mocks['@/services/profile/fitadaptHistory']={loadFitAdaptHistoryPage:async(...v)=>{subscriptions.push({kind:'history',args:v});if(f.historyError)throw Error('Synthetic history failure');return f.historyPage||{events:[],cursor:null,hasMore:false};}};
 const instrument=flow.instrument, globals=flow.globals;
 return {...flow,
   instrument(source,file,ts) {
     let out=instrument(source,file,ts);
     // Repeated pickers/cards have independent React state in the app. Preserve
     // that identity in SSR instead of sharing one fixture slot across instances.
     if(file.endsWith('MetricPickerSheet.tsx')||file.endsWith('long-term-progress.tsx'))
       out=out.replace(/__flowState\(("[^"\n]+:(?:internal|focused)"),/g, '__flowInstanceState($1, title,');
     return out;
   },
   globals() { const g=globals();return {...g,__flowInstanceState(key,identity,initial) {
     const name=key.slice(key.lastIndexOf(':')+1), instance=key+':'+identity;
     const value=Object.hasOwn(f.states||{},instance)?f.states[instance]:Object.hasOwn(f.states||{},key)?f.states[key]:Object.hasOwn(f.states||{},name)?f.states[name]:initial;
     return g.__flowState(instance,value);
   }}; },
 };
};
