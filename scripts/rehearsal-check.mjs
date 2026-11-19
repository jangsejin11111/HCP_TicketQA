import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve('dist');
const server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://local');const p=path.resolve(root,'.'+u.pathname+(u.pathname.endsWith('/')?'index.html':''));if(!p.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',p.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8');res.end(await readFile(p));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=process.argv[2]||`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[],uploads=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/.netlify/functions/collect',r=>{uploads.push(r.request().url());return r.fulfill({status:500,body:'unexpected upload'});});
 await page.goto(origin+'/rehearsal/');
 await page.evaluate(()=>{localStorage.setItem('cp-qa-consent-v1','yes');localStorage.setItem('cp-qa-pending-v1','[]');});
 assert.equal(await page.locator('#chapters a').count(),15);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const entries=await page.locator('#chapters a').evaluateAll(els=>els.map(e=>({href:e.getAttribute('href'),chapter:Number(e.dataset.chapter)})));
 for(const {href,chapter} of entries){
  await page.goto(origin+'/rehearsal/');await page.goto(origin+href);await page.waitForFunction(()=>typeof __e10==='function');
  assert.equal(await page.evaluate(()=>__e10('CH')),chapter);
  assert.equal(await page.getByRole('navigation',{name:'리허설 조작'}).count(),1);
  assert.equal(await page.locator('#qa-dialog').count(),0);
  await page.evaluate(()=>{GameQA.sync(1,true);GameQA.clear();GameQA.fail('test');dispatchEvent(new Event('online'));});
  assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('cp-qa-consent-v1'),localStorage.getItem('cp-qa-pending-v1')]),['yes','[]']);
 }
 await Promise.all([page.waitForEvent('load'),page.getByRole('button',{name:'이 구간 다시 시작'}).click()]);await page.waitForFunction(()=>typeof __e10==='function');assert.equal(await page.evaluate(()=>__e10('CH')),15);
 await page.getByRole('link',{name:'장 목록',exact:true}).click();await page.waitForURL('**/rehearsal/');
 await page.locator('summary').click();const checkpoints=await page.locator('#checkpoints a').evaluateAll(els=>els.map(e=>({href:e.getAttribute('href'),chapter:Number(e.textContent.match(/^\d+/)[0])})));
 for(const {href,chapter} of checkpoints){await page.goto(origin+'/rehearsal/');await page.goto(origin+href);await page.waitForFunction(()=>typeof __e10==='function');assert.equal(await page.evaluate(()=>__e10('CH')),chapter);}
 await page.goto(origin+'/admin/');assert.equal(await page.locator('a[href="/rehearsal/"]').count(),1);
 assert.deepEqual(uploads,[]);assert.deepEqual(errors,[]);
 console.log('PASS: 15 chapters, 8 checkpoints, restart/back, admin entry, mobile width, no uploads or consent changes.');
}finally{await browser.close();server.close();}
