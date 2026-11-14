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
 await page.evaluate(()=>__e10('start();setFs(26);talkClear();const block=talkBlock("mq");for(let n=0;n<12;n++)talkLine(block,"긴 대사를 큰 글자로 읽을 때에도 화면 밖으로 잘리지 않고 스크롤할 수 있어야 합니다.");choicesEl.hidden=false;choicesEl.innerHTML=`<button class="choice">계속하기</button>`'));
 for(const size of [{width:320,height:568},{width:844,height:390}]){
  await page.setViewportSize(size);await page.waitForTimeout(700);
  const bounds=await page.evaluate(()=>{const t=document.querySelector('#talk'),c=document.querySelector('#choices');return{talkBottom:t.getBoundingClientRect().bottom,choiceTop:c.getBoundingClientRect().top,scrollable:t.scrollHeight>t.clientHeight,overflow:document.documentElement.scrollWidth>innerWidth};});
  assert.ok(bounds.scrollable);assert.ok(bounds.talkBottom<=bounds.choiceTop);assert.equal(bounds.overflow,false);
  await page.locator('#talk').evaluate(el=>{el.scrollTop=0;});assert.equal(await page.locator('#talk').evaluate(el=>el.scrollTop),0);
 }
 console.log('Dialogue layout passed: 320px portrait and landscape, largest font, long text scrolling, choices remain separate.');
}finally{await browser.close();server.close();}
