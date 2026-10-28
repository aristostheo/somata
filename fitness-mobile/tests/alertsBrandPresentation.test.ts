import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(resolve('package.json'));
const { createRuntime } = require('./tools/home-preview-runtime.cjs');
const rows = [
  { id: 'friend', type: 'friend:accepted', title: 'A friend accepted your request', readAt: null },
  { id: 'ping', type: 'ping', title: 'A nudge', body: 'Log a meal to keep your streak alive.', data: { fromUid: 'synthetic-friend', fromName: 'Synthetic friend' }, readAt: null },
  { id: 'workout', type: 'info', title: 'Workout recorded', body: 'Your recorded session.', readAt: 1 },
  { id: 'nutrition', type: 'info', title: 'Nutrition update', body: 'Your meal record.', readAt: null },
  { id: 'streak', type: 'info', title: 'Workout streak', body: 'Recorded milestone.', readAt: null },
  { id: 'coach', type: 'info', title: 'Your summary is ready', readAt: 1 },
  { id: 'sync', type: 'info', title: 'Sync failed — reconnect', readAt: null },
].map((r, i) => ({ ...r, createdAtMs: Date.UTC(2026, 9, 18 - i, 15) }));
function runtime(options: any = {}) {
  return createRuntime({ ...options, account: { uid: 'synthetic-owner', user: { displayName: 'Synthetic owner' }, ...options.account },
    notifications: { rows, ...options.notifications } });
}
const action = (r: any, label: string) => r.actions.find((a: any) => a.accessibilityLabel === label);
const tick = () => new Promise(resolve => setImmediate(resolve));

test('Alerts preserves all six categories, exact classification, global unread count and filtered count', () => {
  const r = runtime(); assert(r.notifications().body.includes('5 unread'));
  for (const [filter,ids,hero] of [
    ['All', rows.map(r => r.id), 'Your signal center'], ['Friends',['friend','ping'],'Friend activity'],
    ['Workouts',['workout'],'Training signals'], ['Nutrition',['nutrition'],'Fuel signals'],
    ['Streaks',['streak'],'Momentum center'], ['Coach',['coach'],'Your perspective'],
  ] as const) {
    action(r,`${filter} alerts`).onPress(); const body = r.notifications().body;
    assert.deepEqual(r.listProps.data.map((r: any) => r.id),ids); assert(body.includes(`${ids.length} shown`));
    assert(body.includes(hero)); assert(body.includes('5 unread'));
    assert(action(r,`${filter} alerts`).accessibilityState.selected);
  }
});

test('notification taps retain existing routes and mark only unread owner records', async () => {
  const r = runtime(); r.notifications();
  for (const [id,route] of [['friend','/friends'],['ping','/(tabs)/nutrition'],['workout','/(tabs)/workouts'],['nutrition','/(tabs)/nutrition'],['streak','/(tabs)'],['coach','/profile/insights-progress'],['sync','/profile/integrations']]) {
    const row = rows.find(r => r.id === id)!;
    action(r,`Open ${row.title}`).onPress(); await tick(); assert.equal(r.routes.at(-1),route);
  }
  assert.deepEqual(r.writes.filter((w: any) => w[0] === 'read').map((w: any) => w.slice(1)),
    rows.filter(r => !r.readAt).map(r => ['synthetic-owner',r.id]));
  const meal = runtime({ notifications: { rows: [{ id:'meal-streak',type:'info',title:'Meal streak',readAt:null }] } });
  meal.notifications(); action(meal,'Open Meal streak').onPress(); await tick(); assert.equal(meal.routes.at(-1),'/(tabs)/nutrition');
  const failed = runtime({ notifications: { failRead: true } }); failed.notifications();
  action(failed,`Open ${rows[0].title}`).onPress(); await tick(); assert.equal(failed.routes.at(-1),'/friends');
});

test('dismiss retains explicit cancel/confirm, owner/id and failure recovery', async () => {
  const r = runtime(); r.notifications(); action(r,'Dismiss').onPress();
  assert.equal(r.writes.length,0); assert.equal(r.alerts[0][0],'Dismiss alert?');
  assert.equal(r.alerts[0][2][0].style,'cancel');
  r.alerts[0][2][1].onPress(); await tick();
  assert.deepEqual(r.writes,[['dismiss','synthetic-owner','friend']]);
  const failed = runtime({ notifications: { failDismiss: true } }); failed.notifications(); action(failed,'Dismiss').onPress();
  failed.alerts[0][2][1].onPress(); await tick(); assert.equal(failed.alerts.at(-1)[0],'Could not dismiss');
});

test('Mark all remains account-wide even in a filtered view; busy and errors remain usable', async () => {
  const r = runtime({ notifications: { filter: 'Workouts' } }); r.notifications();
  await action(r,'Mark all').onPress(); assert.deepEqual(r.writes,[['mark-all','synthetic-owner']]);
  const busy = runtime({ notifications: { busy:true } }); busy.notifications(); assert(action(busy,'Marking…').disabled);
  await action(busy,'Marking…').onPress(); assert.equal(busy.writes.length,0);
  const failed = runtime({ notifications: { failMark:true } }); failed.notifications(); await action(failed,'Mark all').onPress();
  assert.equal(failed.alerts.at(-1)[0],'Could not mark alerts'); assert.equal(failed.notificationState[2],false);
  const read = runtime({ notifications: { rows: rows.map(r => ({ ...r,readAt:1 })) } });
  assert(read.notifications().body.includes("You&#x27;re all caught up.")); assert(!action(read,'Mark all'));
});

test('Ping back is limited to existing ping records and preserves sender/recipient and failures', async () => {
  const r = runtime(); r.notifications(); assert.equal(r.actions.filter((a:any) => a.accessibilityLabel === 'Ping back').length,1);
  action(r,'Ping back').onPress(); await tick();
  assert.deepEqual(JSON.parse(JSON.stringify(r.writes)),[['ping','synthetic-owner','synthetic-friend'],['ping-notification','synthetic-friend',{ uid:'synthetic-owner',displayName:'Synthetic owner' }]]);
  const trigger = runtime(); trigger.notifications(); trigger.effects[1].effect(); trigger.effects[1].effect(); await tick();
  assert.equal(trigger.writes.length,1); assert.equal(trigger.writes[0][0],'local-ping'); assert.equal(trigger.writes[0][2].uid,'synthetic-owner');
  const failed = runtime({ notifications: { failPing:true } }); failed.notifications(); action(failed,'Ping back').onPress(); await tick();
  assert.equal(failed.alerts.at(-1)[0],'Ping failed'); assert.equal(failed.writes.length,1);
});

test('loading, empty, failed query and retry stay distinct and listeners stop on cleanup', () => {
  const loading = runtime({ notifications:{ rows:null } }); assert(loading.notifications().body.includes('Loading account alerts'));
  const empty = runtime({ notifications:{ rows:[] } }); assert(empty.notifications().body.includes('Your inbox is clear'));
  const filtered = runtime({ notifications:{ rows:[],filter:'Friends' } }); assert(filtered.notifications().body.includes('No friends alerts yet'));
  const r = runtime(); r.notifications(); const cleanup = r.effects[0].effect();
  assert.equal(r.subscriptions[0].uid,'synthetic-owner'); assert.equal(r.subscriptions[0].options.max,120);
  r.subscriptions[0].cb([]); r.subscriptions[0].options.onError();
  assert(r.notifications().body.includes('Alerts couldn’t load')); assert(!r.notifications().body.includes('Your inbox is clear'));
  action(r,'Retry alerts').onPress(); assert.equal(r.notificationState[4],1);
  cleanup(); assert(r.subscriptions[0].stopped);
  r.subscriptions[0].cb(rows); assert.equal(r.notificationState[0].length,0);
  r.effects[0].effect(); assert.equal(r.subscriptions.length,2); assert.equal(r.notificationState[3],false); assert.equal(r.notificationState[0],null);
});

test('owner-scoped subscription and signed-out actions cannot write; no extra profile reads', async () => {
  for(const uid of ['synthetic-a','synthetic-b']) {
    const r = runtime({ account:{uid} });
    assert.equal(r.load('app/(tabs)/notifications.tsx').default().props.children.key,uid);
    r.notifications(); r.effects[0].effect();
    assert.equal(r.subscriptions[0].uid,uid); r.subscriptions[0].cb(rows); r.notifications();
    await action(r,'Mark all').onPress(); assert.deepEqual(r.writes,[['mark-all',uid]]);
  }
  const out = runtime({ account:{uid:null},notifications:{rows:null} });
  assert(out.notifications().body.includes('Sign in to view your alerts')); out.effects[0].effect(); assert.equal(out.subscriptions.length,0);
  const guard = runtime({account:{uid:null}}); guard.notifications();
  await action(guard,'Mark all').onPress(); action(guard,'Dismiss').onPress(); action(guard,'Ping back').onPress(); action(guard,`Open ${rows[0].title}`).onPress(); await tick();
  assert.equal(guard.writes.length,0); assert.equal(guard.routes.length,0); assert.equal(guard.alerts.length,0);
});

test('large inbox remains bounded/virtualized; both modes and long text retain controls and real metadata', () => {
  for(const dark of [true,false]) {
    const long = 'A long synthetic notification title '.repeat(8), body = 'Long recorded detail '.repeat(20);
    const r = runtime({ dark,width:320,fontScale:1.8,notifications:{ rows:Array.from({length:120},(_,i)=>({id:String(i),type:'info',title:long,body,readAt:i%2?1:null})) } });
    const html = r.notifications().body;
    assert(html.includes(long)); assert(html.includes(body)); assert(html.includes('Recorded alert')); assert(html.includes('120 shown'));
    assert.equal(r.listProps.initialNumToRender,8); assert.equal(r.listProps.windowSize,7);
    assert(action(r,'Mark all')); assert(action(r,'Dismiss'));
    assert(r.actions.some((a:any)=>a.accessibilityHint?.startsWith('Unread alert')));
    assert(r.actions.some((a:any)=>a.accessibilityHint?.startsWith('Read alert')));
  }
});

test('category heroes use only existing destinations; no unsupported reply/share or fake avatars', () => {
  const r = runtime();
  for (const [filter,label,route] of [['All','Open friends','/friends'],['Friends','Open friends','/friends'],['Workouts','Open workouts','/(tabs)/workouts'],['Nutrition','Open nutrition','/(tabs)/nutrition'],['Streaks','Open Home','/(tabs)'],['Coach','Open insights','/profile/insights-progress']]) {
    r.notificationState[1]=filter; const body = r.notifications().body; action(r,label).onPress(); assert.equal(r.routes.at(-1),route);
    assert(!action(r,'Reply')); assert(!action(r,'Share')); assert(!body.includes('<img'));
  }
});
