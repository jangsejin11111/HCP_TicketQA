import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=createServer(async(req,res)=>{try{const p=new URL(req.url,'http://local').pathname;res.setHeader('Content-Type',p==='/'?'text/html':'text/javascript');res.end(await readFile(p==='/'?'clone-poem-game.html':p.slice(1)));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:320,height:568},isMobile:true,hasTouch:true});
 await page.addInitScript(()=>localStorage.setItem('cp-qa-consent-v1','no'));
 await page.goto(`http://127.0.0.1:${server.address().port}/#qa-ch1`);await page.waitForFunction(()=>typeof __e10==='function');
 await page.evaluate(()=>__e10('start();cam.z=30;arrive();arrivedAt=0;startCruise();tap("birds")'));
 for(let n=0;n<16;n++){await page.touchscreen.tap(160,220);await page.waitForTimeout(160);}
 assert.equal(await page.evaluate(()=>__e10('i')),2);
 const before=await page.evaluate(()=>__e10('({zoomV,x:cam.x,z:cam.z,y:cam.y})'));
 const nativePrevented=await page.locator('.breath.last').evaluate(el=>{const e=new Event('touchend',{bubbles:true,cancelable:true});el.dispatchEvent(e);return e.defaultPrevented;});assert.equal(nativePrevented,true);
 await page.locator('.breath.last').tap();await page.waitForTimeout(200);
 await page.touchscreen.tap(285,125);await page.waitForTimeout(1000);
 assert.equal(await page.evaluate(()=>__e10('ntTarget')),1);
 assert.equal(await page.evaluate(()=>__e10('zoomV')),before.zoomV);
 assert.equal(await page.evaluate(()=>visualViewport.scale),1);
 const after=await page.evaluate(()=>__e10('({zoomV,x:cam.x,z:cam.z,y:cam.y})'));
 assert.deepEqual(after,before);
 await page.locator('#menuBtn').click();await page.locator('#resetViewBtn').click();
 assert.equal(await page.evaluate(()=>__e10('zoomV')),1);
 console.log('Night transition passed: all 16 taps, last breath, repeated tap, stable camera and viewport, reset control.');
}finally{await browser.close();server.close();}
