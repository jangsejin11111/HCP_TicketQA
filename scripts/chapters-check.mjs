import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const source=process.argv[2]||'clone-poem-game.html',label=process.argv[3]||'after';
const hashes=['qa-ch1','myojisan','imdo','donggul','tunnel','highway','gyeryu','pyegong','maeripji','dosi','container','hanggu','bada','eoleum','jakeun'];
const cases=hashes.map((hash,i)=>({chapter:i+1,hash})).concat([
 {chapter:4,hash:'donggul-light'},
 {chapter:5,hash:'tunnel',action:'approach5()'},
 {chapter:7,hash:'gyeryu-near',action:'drawImage7(IMGS[0],10);imgCv.style.opacity=1'},
 {chapter:8,hash:'pyegong-in'},
 {chapter:9,hash:'maeripji-run',action:'breakWheels9()'},
 {chapter:10,hash:'dosi-window'}, {chapter:10,hash:'dosi-truck'},
 {chapter:12,hash:'hanggu-queue'},
 {chapter:13,hash:'bada',action:'squeeze13()'},
 {chapter:15,hash:'jakeun',action:'startPull15()'}
]);
const server=createServer(async(req,res)=>{try{const p=new URL(req.url,'http://local').pathname;const file=p==='/'?source:p.slice(1);if(file.includes('..'))throw Error();res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':'text/javascript');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));await mkdir('test-results/chapters',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const report=[];
try{
 for(const entry of cases){
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const row={...entry,errors:[]};page.on('pageerror',e=>row.errors.push(e.message));
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.addInitScript(()=>{localStorage.setItem('cp-qa-consent-v1','no');window.frameTimes=[];window.longTasks=[];const raf=requestAnimationFrame;window.requestAnimationFrame=fn=>raf(t=>{const s=performance.now();fn(t);frameTimes.push(performance.now()-s);});new PerformanceObserver(l=>longTasks.push(...l.getEntries().map(x=>x.duration))).observe({type:'longtask',buffered:true});});
  try{
   const begin=Date.now();await page.goto(`http://127.0.0.1:${server.address().port}/#${entry.hash}`,{timeout:60000});
   await page.waitForFunction(()=>typeof __e10==='function',{},{timeout:60000});
   if(await page.locator('#titleBtn').isVisible())await page.locator('#titleBtn').click();
   row.startMs=Date.now()-begin;await page.waitForTimeout(600);
   if(entry.action){const t=Date.now();await page.evaluate(s=>__e10(s),entry.action);row.actionMs=Date.now()-t;}
   await page.evaluate(()=>{frameTimes=[];});await page.waitForTimeout(1200);
   row.metrics=await page.evaluate(()=>{const a=frameTimes.sort((a,b)=>a-b);return{frames:a.length,p95:a[Math.floor(a.length*.95)]||0,max:a.at(-1)||0,longTaskMax:Math.max(0,...longTasks),runtime:__e10('({CH,zoomV,phase:CH===5?phase5:CH===9?phase9:"",geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles})')}});
   await page.locator('#menuBtn').click({timeout:6000});
   await page.locator('#zoomRange').evaluate(el=>{el.value='.8';el.dispatchEvent(new Event('input',{bubbles:true}));});
   await page.waitForTimeout(250);row.manualZoom=await page.evaluate(()=>__e10('zoomV'));
   await page.locator('#resetViewBtn').click({timeout:6000});await page.waitForTimeout(200);row.resetZoom=await page.evaluate(()=>__e10('zoomV'));
   // Scene effects must not transform settings or move them off screen.
   await page.evaluate(()=>document.querySelector('#scene').style.transform='scale(1.5)');
   row.menu=await page.locator('#menuBtn').boundingBox();row.menuInside=row.menu.x>=0&&row.menu.x+row.menu.width<=391&&row.menu.y>=0;
   await page.evaluate(()=>document.querySelector('#scene').style.transform='');
   await page.screenshot({path:`test-results/chapters/${label}-${entry.hash}.png`});
   await page.setViewportSize({width:844,height:390});await page.waitForTimeout(200);
   row.landscape=await page.evaluate(()=>({height:document.querySelector('#app').clientHeight,viewport:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth}));
  }catch(e){row.errors.push(e.message.slice(0,400));}
  report.push(row);console.log(JSON.stringify(row));await page.close();
 }
 await writeFile(`test-results/chapters-${label}.json`,JSON.stringify(report,null,2));
 if(label!=='before'){
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[],transitions=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('cp-qa-consent-v1','no'));
  await page.goto(`http://127.0.0.1:${server.address().port}/#qa-ch1`);
  await page.waitForFunction(()=>typeof __e10==='function');
  for(const chapter of [...Array.from({length:14},(_,i)=>i+2),1,8,9,8,9]){
   const state=await page.evaluate(ch=>__e10(`setUserZoom(2);scene.style.transform='scale(1.5)';${ch===1?'resetGame()':`startCh${ch}()`};({CH,zoomV,zoomOverride,transform:scene.style.transform})`),chapter);
   await page.waitForTimeout(300);
   if(state.CH!==chapter)errors.push(`Expected chapter ${chapter}, got ${state.CH}`);
   state.memory=await page.evaluate(()=>__e10('({...renderer.info.memory})'));transitions.push(state);
  }
  await writeFile(`test-results/transitions-${label}.json`,JSON.stringify({errors,transitions},null,2));
  for(const ch of [8,9]){const visits=transitions.filter(r=>r.CH===ch);const last=visits.at(-1).memory,prior=visits.at(-2).memory;if(last.geometries>prior.geometries||last.textures>prior.textures)errors.push(`Resources grow on repeat chapter ${ch}`);}
  const failures=report.filter(r=>r.errors.length||r.manualZoom!==.8||r.resetZoom!==1||!r.menuInside||r.landscape?.overflow);
  if(errors.length||transitions.some(r=>r.zoomV!==1||r.zoomOverride||r.transform)||failures.length)throw Error(JSON.stringify({errors,failures,transitions}));
  console.log(`PASS: ${report.length} mobile scenarios and ${transitions.length} chapter transitions`);await page.close();
 }
}finally{await browser.close();server.close();}
