import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import { latestAttempts, chapterRows, csv } from '../public/qa-report.js';
import { validateRecord } from '../netlify/lib/validation.mjs';
import { createHandler as collectHandler } from '../netlify/functions/collect.mjs';
import { createHandler as adminHandler } from '../netlify/functions/admin-data.mjs';
import { createHandler as loginHandler } from '../netlify/functions/admin-login.mjs';
import { sessions } from '../netlify/lib/auth.mjs';
await import('../public/qa-core.js');
function setup() {
  let time=Date.parse('2026-11-14T10:00:00.000Z');const records=[];
  const tracker=QACore.createTracker({now:()=>time,uuid:randomUUID,sessionId:randomUUID(),emit:r=>records.push({id:randomUUID(),...r})});
  return {tracker,records,advance:ms=>time+=ms};
}
test('visible and hidden time, clear time frozen after result screen',()=>{
  const {tracker:t,records:r,advance}=setup();t.sync(1,true,true);advance(1000);t.visibility(false);advance(4000);t.visibility(true);advance(2000);t.finish('cleared');advance(10000);t.snapshot('heartbeat');
  const last=r.at(-1);assert.equal(last.wallMs,17000);assert.equal(last.activeMs,13000);assert.equal(last.playMs,3000);assert.equal(last.clearWallMs,7000);assert.equal(last.clearActiveMs,3000);
});
test('failure counted once; retry contributes to first clear timing',()=>{
  const {tracker:t,records:r,advance}=setup();t.sync(2,true,true);advance(2000);t.finish('failed','fall');t.finish('failed','fall');advance(1000);t.enter(2);t.sync(2,true,true);advance(4000);t.finish('cleared');
  const [row]=chapterRows(r);assert.equal(row.attempts,2);assert.equal(row.failures,1);assert.equal(row.clears,1);assert.equal(row.firstClearWallMs,7000);assert.equal(row.firstClearActiveMs,7000);
});
test('chapter jump is abandonment, never an inferred clear',()=>{
  const {tracker:t,records:r}=setup();t.sync(1,true,true);t.enter(7);assert.equal(latestAttempts(r)[0].status,'abandoned');assert.equal(chapterRows(r)[0].clears,0);
});
test('heartbeat retries and out-of-order records do not double metrics',()=>{
  const {tracker:t,records:r,advance}=setup();t.sync(1,true,true);advance(2000);t.snapshot('heartbeat');assert.equal(chapterRows([...r,...r].reverse())[0].wallMs,2000);
});
test('ready title time is separated from gameplay time',()=>{
  const {tracker:t,records:r,advance}=setup();t.sync(1,false,true);advance(3000);t.sync(1,true,true);advance(2000);t.snapshot('heartbeat');assert.equal(r.at(-1).activeMs,5000);assert.equal(r.at(-1).playMs,2000);
});
test('schema whitelists fields and rejects impossible metrics',()=>{
  const {tracker:t,records:r}=setup();t.sync(1,true,true);assert.equal(validateRecord({...r[0],email:'secret'}).email,undefined);assert.throws(()=>validateRecord({...r[0],chapter:16}));assert.throws(()=>validateRecord({...r[0],activeMs:1}));assert.throws(()=>validateRecord({...r[0],observedAt:'2026-11-14T../../anything'}));
});
test('CSV escapes formulas, commas and quotes, includes Excel UTF-8 BOM',()=>{
  const output=csv([{value:'=SUM(1,2)',other:'a"b'}]);assert.ok(output.startsWith('\uFEFF'));assert.ok(output.includes("'=SUM(1,2)"));assert.ok(output.includes('a""b'));
});
const makeRequest=(records,options={})=>new Request('https://game.example/.netlify/functions/collect',{method:'POST',headers:{origin:'https://game.example','content-type':'application/json'},body:JSON.stringify({records}),...options});
test('collect persists records idempotently and acknowledges only saved data',async()=>{
  const {tracker:t,records:r}=setup();t.sync(1,true,true);const saved=new Map();const handler=collectHandler(()=>({setJSON:async(k,v)=>saved.set(k,v)}));
  assert.equal((await handler(makeRequest(r))).status,200);assert.equal((await handler(makeRequest(r))).status,200);assert.equal(saved.size,r.length);assert.ok([...saved.values()][0].receivedAt);
});
test('collect rejects cross-origin, invalid batches, and handles storage failure',async()=>{
  const {tracker:t,records:r}=setup();t.sync(1,true,true);const handler=collectHandler(()=>({setJSON:async()=>{throw Error();}}));
  assert.equal((await handler(makeRequest(r,{headers:{origin:'https://evil.example'}}))).status,403);
  assert.equal((await handler(makeRequest([]))).status,400);
  assert.equal((await handler(makeRequest(r))).status,503);
  assert.equal((await handler(new Request('https://game.example'))).status,405);
});
test('PIN login keeps leading zero, rejects invalid credentials and expires sessions',async()=>{
  const saved=new Map();const store={setJSON:async(k,v)=>saved.set(k,v),get:async k=>saved.get(k),delete:async k=>saved.delete(k)};
  const auth=sessions(()=>store),handler=loginHandler(auth,()=> '0123');
  const request=pin=>new Request('https://game.example/login',{method:'POST',headers:{origin:'https://game.example'},body:JSON.stringify({pin})});
  assert.equal((await handler(request('123'))).status,401);
  assert.equal((await handler(request('wrong'))).status,401);
  const result=await handler(request('0123'));assert.equal(result.status,200);const login=await result.json();assert.equal(login.token.length,64);
  const authorized=new Request('https://game.example/',{headers:{authorization:'Bearer '+login.token}});
  assert.equal(await auth.verify(authorized),true);
  const key=[...saved.keys()][0];saved.set(key,{expiresAt:0});assert.equal(await auth.verify(authorized),false);assert.equal(saved.size,0);
  assert.equal((await loginHandler(auth,()=>undefined)(request('0123'))).status,503);
});
test('admin rejects unauthenticated requests',async()=>{
  assert.equal((await adminHandler(()=>{}, {verify:async()=>false})(new Request('https://game.example/'))).status,401);
});
test('authenticated admin lists all pages and fetches bounded records',async()=>{
  const handler=adminHandler(()=>({list:async function*(){yield{blobs:[{key:'one'}]};yield{blobs:[{key:'two'}]};},get:async()=>({status:'cleared'})}),{verify:async()=>true});
  const headers={authorization:'Bearer '+'a'.repeat(32)};
  const response=await handler(new Request('https://game.example/?hour=2026-11-14T10',{headers}));assert.deepEqual((await response.json()).keys,['one','two']);
  assert.equal((await handler(new Request('https://game.example/',{method:'POST',headers,body:JSON.stringify({keys:['../../secret']})}))).status,400);
});
test('all game scripts compile and all chapter hooks connect to telemetry',async()=>{
  const html=await readFile('clone-poem-game.html','utf8');const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(Boolean);
  scripts.forEach(s=>new vm.Script(s));
  const hook=scripts[0].split('/* QA hooks:')[1].split('if(!location.hash) prologue();')[0];
  const code='/* QA hooks:'+hook;const calls=[];const context={scene3:null,renderer:null,resetChapterView:()=>{},CH:1,started:true,window:{GameQA:{enter:(ch)=>calls.push(['enter',ch]),clear:()=>calls.push(['clear']),fail:r=>calls.push(['fail',r]),sync:()=>{}}}};
  for(const name of ['start','resetGame','showFinale','finale2','explode4','crash9','theEnd15','startFall','leaveCart','hitByCar','die7','approach8','starve9','deathScreen14']) context[name]=()=>{};
  for(let n=2;n<=15;n++)context['startCh'+n]=()=>context.CH=n;
  vm.createContext(context);vm.runInContext(code,context);
  for(let n=2;n<=15;n++) context['startCh'+n]();context.crash9();context.hitByCar();
  assert.equal(calls.filter(x=>x[0]==='enter').length,14);assert.deepEqual(calls.at(-2),['clear']);assert.deepEqual(calls.at(-1),['fail','car_collision']);
});
