// Browser integration against the real API handlers with an in-memory store.
// Netlify's hosted Blobs connection is verified separately after deployment.
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHandler as collectHandler } from '../netlify/functions/collect.mjs';
import { createHandler as loginHandler } from '../netlify/functions/admin-login.mjs';
import { sessions } from '../netlify/lib/auth.mjs';
import { createHandler as adminHandler } from '../netlify/functions/admin-data.mjs';
const saved=new Map(), secret=process.env.QA_ADMIN_PIN || '0123';
const store={setJSON:async(k,v)=>saved.set(k,v),get:async k=>saved.get(k),list:async function*({prefix}){yield{blobs:[...saved.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key}))};}};
const auth=sessions(()=>store);
const collect=collectHandler(()=>store),admin=adminHandler(()=>store,auth),login=loginHandler(auth,()=>secret);
const root=path.resolve('dist');
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1:'+server.address().port);
    if(url.pathname.startsWith('/.netlify/functions/')) {
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const request=new Request(url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})});
      const response=await(url.pathname.endsWith('/collect')?collect:url.pathname.endsWith('/admin-login')?login:admin)(request);
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
    }
    const target=path.resolve(root,'.'+decodeURIComponent(url.pathname)+(url.pathname.endsWith('/')?'index.html':''));
    if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    const content=await readFile(target);res.setHeader('Content-Type',target.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8');res.end(content);
  }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/#highway');
  await page.getByRole('heading',{name:'플레이 테스트 참여'}).waitFor();
  assert.equal(saved.size,0,'No transmission before consent');
  await page.screenshot({path:'test-results/consent.png'});
  await page.getByRole('button',{name:'동의하고 플레이'}).click();
  await page.locator('#titleBtn').click();
  await page.waitForFunction(()=>document.querySelector('#title').classList.contains('gone'));
  // Exercise a terminal outcome through the same public bridge used by game hooks.
  await page.evaluate(()=>window.GameQA.fail('car_collision'));
  await page.waitForTimeout(16000);
  assert.ok([...saved.values()].some(r=>r.chapter===6&&r.status==='failed'&&r.failures===1));
  assert.ok([...saved.values()].filter(r=>r.schema===1).every(r=>r.debug));
  await page.screenshot({path:'test-results/game.png'});
  const dashboard=await browser.newPage();await dashboard.goto(origin+'/admin/');
  await dashboard.locator('#token').fill(secret);await dashboard.locator('#debug').check();
  await dashboard.getByRole('button',{name:'데이터 불러오기'}).click();
  await dashboard.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('완료'));
  assert.match(await dashboard.locator('#rows').innerText(),/고속도로/);
  const downloaded=dashboard.waitForEvent('download');await dashboard.getByRole('button',{name:'세션·장별 CSV'}).click();
  const download=await downloaded;await download.saveAs('test-results/chapters.csv');
  const csv=await readFile('test-results/chapters.csv','utf8');assert.match(csv,/고속도로/);assert.match(csv,/car_collision|failures/);
  await dashboard.screenshot({path:'test-results/admin.png',fullPage:true});
  assert.deepEqual(errors,[],'Game must not throw JavaScript errors');
  await page.getByTitle('QA 데이터 수집 설정').click();await page.getByRole('button',{name:'수집 없이 플레이'}).click();
  const count=saved.size;await page.evaluate(()=>window.GameQA.fail('fall'));await page.waitForTimeout(1000);assert.equal(saved.size,count);
  console.log('Browser passed: consent, game startup, outcome delivery, admin authentication, CSV download, opt-out.');
}finally{await browser.close();server.close();}
