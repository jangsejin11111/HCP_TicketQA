import { latestAttempts, chapterRows, csv, names } from '../qa-report.js';
const $ = s => document.querySelector(s);
let records = [], accessToken = null, expiresAt = 0;
const today = new Date(Date.now()+9*3600000).toISOString().slice(0,10);
$('#from').value = $('#to').value = today;
const filtered = () => records.filter(x => $('#debug').checked || !x.debug);
function render() {
  const groups = chapterRows(filtered()); $('#rows').replaceChildren();
  for (let chapter=1;chapter<=15;chapter++) {
    const entries=groups.filter(x=>x.chapter===chapter), cleared=entries.filter(x=>x.clears);
    const avg = (a,k) => a.length ? (a.reduce((s,x)=>s+x[k],0)/a.length/1000).toFixed(1) : '—';
    const tr=document.createElement('tr');
    for(const text of [chapter+' · '+names[chapter],entries.length,cleared.length,entries.reduce((s,x)=>s+x.failures,0),avg(entries,'activeMs'),avg(cleared,'firstClearWallMs')]) {
      const td=document.createElement('td');td.textContent=text;tr.append(td);
    } $('#rows').append(tr);
  }
  for(const id of ['summary','attempts','raw']) $('#'+id).disabled=!groups.length;
}
async function api(url, options={}) {
  for (let attempt=0;attempt<4;attempt++) {
    const response=await fetch(url,{...options,headers:{'Authorization':'Bearer '+accessToken,'Content-Type':'application/json'},signal:AbortSignal.timeout(30000)});
    if (response.status===429 && attempt<3) { $('#status').textContent='요청 제한으로 잠시 대기 중입니다…';await new Promise(r=>setTimeout(r,20000));continue; }
    const result=await response.json();if(!response.ok) throw new Error(result.error||'조회 실패');return result;
  }
}
$('#form').onsubmit=async e=>{
  e.preventDefault();const start=Date.parse($('#from').value+'T00:00:00+09:00'),end=Date.parse($('#to').value+'T00:00:00+09:00')+86400000;
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>7*86400000){$('#status').textContent='시작일부터 종료일까지 1~7일을 선택하세요.';return;}
  $('#load').disabled=true; $('#logout').disabled=true; records=[];render();
  try{
    if (!accessToken || expiresAt <= Date.now()) {
      const response = await fetch('/.netlify/functions/admin-login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({pin:$('#token').value}), signal:AbortSignal.timeout(15000)});
      if (response.status === 429) throw new Error('인증 시도가 많습니다. 1분 후 다시 시도해 주세요.');
      const login = await response.json(); if (!response.ok) throw new Error(login.error || '인증 실패');
      accessToken = login.token; expiresAt = login.expiresAt;
      $('#token').value = ''; $('#token').required = false;
    }
    const keys=[];
    for(let t=start;t<end;t+=3600000){$('#status').textContent=`목록 조회 중… ${Math.round((t-start)/(end-start)*100)}%`;const data=await api('/.netlify/functions/admin-data?hour='+new Date(t).toISOString().slice(0,13));keys.push(...data.keys);}
    for(let i=0;i<keys.length;i+=50){$('#status').textContent=`기록 불러오는 중… ${i} / ${keys.length}`;const data=await api('/.netlify/functions/admin-data',{method:'POST',body:JSON.stringify({keys:keys.slice(i,i+50)})});records.push(...data.records);}
    render();$('#status').textContent=`완료 · 이벤트 ${records.length}개 / 시도 ${latestAttempts(filtered()).length}개 · 한국 시간 기준`;
  }catch(error){accessToken=null;expiresAt=0;$('#token').required=true;records=[];render();$('#status').textContent='불러오지 못했습니다: '+error.message+' (배포 환경과 관리자 인증번호를 확인하세요.)';}
  finally{$('#load').disabled=false;$('#logout').disabled=false;}
};
$('#debug').onchange=render;
$('#logout').onclick=()=>{$('#token').value='';$('#token').required=true;accessToken=null;expiresAt=0;records=[];render();$('#status').textContent='로그아웃했습니다. 인증정보와 조회 데이터를 지웠습니다.';};
function download(name, data, type){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=`clone-poem-${$('#from').value}-${name}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#summary').onclick=()=>download('chapters.csv',csv(chapterRows(filtered())),'text/csv;charset=utf-8');
$('#attempts').onclick=()=>download('attempts.csv',csv(latestAttempts(filtered())),'text/csv;charset=utf-8');
$('#raw').onclick=()=>download('events.json',JSON.stringify(filtered(),null,2),'application/json');
render();
