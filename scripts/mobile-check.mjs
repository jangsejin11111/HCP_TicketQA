import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://local').pathname;const file=pathname==='/'?(process.argv[2]||'clone-poem-game.html'):pathname.slice(1);if(file.includes('..'))throw Error();res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':'text/javascript');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await page.addInitScript(()=>{
   localStorage.setItem('cp-qa-consent-v1','no');
   window.mobileMetrics={resizes:0,draws:0,times:[]};
   for(const key of ['width','height']){const d=Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,key);Object.defineProperty(HTMLCanvasElement.prototype,key,{...d,set(v){if(this.id==='gl')mobileMetrics.resizes++;d.set.call(this,v);}});}
   for(const kind of [WebGLRenderingContext,WebGL2RenderingContext]){const clear=kind.prototype.clear;kind.prototype.clear=function(...args){mobileMetrics.draws++;return clear.apply(this,args);};}
   const raf=window.requestAnimationFrame;window.requestAnimationFrame=fn=>raf.call(window,t=>{const start=performance.now();fn(t);mobileMetrics.times.push(performance.now()-start);});
 });
 await page.goto('http://127.0.0.1:'+server.address().port+'/#qa-mobile');await page.locator('#titleBtn').click();await page.waitForTimeout(2000);
 await page.evaluate(()=>{mobileMetrics.resizes=0;mobileMetrics.draws=0;mobileMetrics.times=[];});
 await page.mouse.move(195,550);await page.mouse.down();await page.waitForTimeout(5000);await page.mouse.up();
 const result=await page.evaluate(()=>{const a=mobileMetrics.times.sort((a,b)=>a-b),app=document.querySelector('#app').getBoundingClientRect(),gl=document.querySelector('#gl');return {innerWidth,innerHeight,viewportWidth:visualViewport.width,app:{width:app.width,height:app.height,left:app.left,top:app.top},canvas:{width:gl.width,height:gl.height},canvasResizeWrites:mobileMetrics.resizes,draws:mobileMetrics.draws,rafCallbacks:a.length,callbackMedianMs:a[Math.floor(a.length*.5)],callbackP95Ms:a[Math.floor(a.length*.95)],over50ms:a.filter(x=>x>50).length};});
 result.errors=errors;
 if(!process.argv[2]?.includes('before')){assert.equal(result.innerWidth,390);assert.equal(result.app.height,844);assert.equal(result.canvasResizeWrites,0);assert.ok(result.draws<=160);assert.deepEqual(errors,[]);}
 const label=process.argv[3]||'after';await page.screenshot({path:`test-results/mobile-${label}.png`});
 await writeFile(`test-results/mobile-${label}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 await page.setViewportSize({width:844,height:390});await page.waitForTimeout(1000);
 console.log('landscape',await page.evaluate(()=>({innerWidth,innerHeight,appHeight:document.querySelector('#app').clientHeight,canvasHeight:document.querySelector('#gl').clientHeight})));
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);
 // Real touch dispatch: two-finger spreads must change neither page nor game zoom.
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:150,y:450,id:1},{x:230,y:450,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:60,y:450,id:1},{x:330,y:450,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.equal(await page.locator('#zoomRange').inputValue(),'1');
 assert.equal(await page.evaluate(()=>visualViewport.scale),1);
 // End a pointer on a different overlay, then deliver a stray move and second touch.
 await page.evaluate(()=>{
  const scene=document.querySelector('#scene'),panel=document.querySelector('#panel');
  scene.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:31,pointerType:'touch',clientX:100,clientY:400}));
  panel.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:31,pointerType:'touch'}));
  scene.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:31,pointerType:'touch',clientX:350,clientY:400}));
  scene.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:32,pointerType:'touch',clientX:120,clientY:400}));
  window.dispatchEvent(new Event('blur'));
  scene.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:32,pointerType:'touch'}));
  panel.hidden=false;panel.style.opacity='1';panel.style.pointerEvents='auto';
  panel.textContent='대사 영역 연속 탭 검사';
 });
 await page.touchscreen.tap(195,650);await page.waitForTimeout(50);await page.touchscreen.tap(195,650);await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>visualViewport.scale),1);
 assert.equal(await page.locator('#zoomRange').inputValue(),'1');
 await page.getByRole('button',{name:'설정',exact:true}).click();
 await page.locator('#zoomRange').evaluate(el=>{el.value='2';el.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.equal(await page.locator('#zoomVal').textContent(),'2.0×');
 await page.getByRole('button',{name:'화면 확대 원래대로'}).click();
 assert.equal(await page.locator('#zoomVal').textContent(),'1.0×');
 const menu=await page.locator('#menuPanel').boundingBox();assert.ok(menu.x>=0&&menu.x+menu.width<=390);
 assert.deepEqual(errors,[]);
 console.log('Touch regression passed: pinch, overlay cancellation, blur, rapid taps, manual zoom/reset and menu bounds.');
}finally{await browser.close();server.close();}
