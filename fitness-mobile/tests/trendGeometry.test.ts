import assert from 'node:assert/strict';
import test from 'node:test';
import {recordedTrace} from '../components/somata/trendGeometry';
test('recorded charts never connect across missing or invalid measurements',()=>{
 assert.equal(recordedTrace([3,null,0,2,NaN,4],i=>i*10,v=>100-v),'M0,97 M20,100 L30,98 M50,96');
 assert.equal(recordedTrace([null,NaN,null],i=>i,v=>v),'');
});
test('a single measured point does not become a generated trend',()=>{
 assert.equal(recordedTrace([null,75,null],i=>i,v=>v),'M1,75');
});
