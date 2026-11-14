(function () {
  'use strict';
  const consentKey = 'cp-qa-consent-v1', queueKey = 'cp-qa-pending-v1';
  let enabled = false, tracker = null, state = { chapter: 1, playing: false }, queue = [], busy = false;
  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  const uuid = () => crypto.randomUUID();
  let status;
  function persist() { write(queueKey, JSON.stringify(queue)); }
  function emit(record) {
    // Bound offline storage; normal delivery flushes every 15 seconds.
    queue.push({ id: uuid(), ...record });
    if (queue.length > 1000) queue.splice(0, queue.length - 1000);
    persist();
  }
  async function flush() {
    if (!enabled || busy || !queue.length || !/^https?:$/.test(location.protocol)) return;
    busy = true;
    const batch = queue.slice(0, 20);
    try {
      const response = await fetch('/.netlify/functions/collect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: batch }), keepalive: true,
        signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) throw new Error('upload');
      const ids = new Set(batch.map(x => x.id));
      queue = queue.filter(x => !ids.has(x.id)); persist();
      if (status && enabled) status.textContent = 'QA 수집 중 · 저장됨';
    } catch {
      if (status && enabled) status.textContent = 'QA 수집 중 · 전송 재시도 대기';
    } finally { busy = false; }
  }
  function enable() {
    if (enabled) return;
    enabled = true; write(consentKey, 'yes');
    try { queue = JSON.parse(read(queueKey) || '[]'); if (!Array.isArray(queue)) queue = []; } catch { queue = []; }
    tracker = QACore.createTracker({ now: () => Date.now(), uuid, emit, sessionId: uuid(), debug: !!location.hash });
    tracker.sync(state.chapter, state.playing, !document.hidden);
    if (status) status.textContent = /^https?:$/.test(location.protocol) ? 'QA 수집 중' : 'QA · 로컬 파일에서는 서버 저장 불가';
    flush();
  }
  function disable() {
    enabled = false; tracker = null; queue = []; persist(); write(consentKey, 'no');
    if (status) status.textContent = 'QA 수집 꺼짐';
  }
  window.GameQA = {
    sync(chapter, playing) { state = { chapter, playing }; tracker?.sync(chapter, playing, !document.hidden); },
    enter(chapter, playing) { state = { chapter, playing }; tracker?.enter(chapter); tracker?.sync(chapter, playing, !document.hidden); },
    clear() { tracker?.finish('cleared'); flush(); },
    fail(reason) { tracker?.finish('failed', reason); flush(); }
  };
  document.addEventListener('visibilitychange', () => { tracker?.visibility(!document.hidden); flush(); });
  window.addEventListener('pagehide', () => { tracker?.snapshot('pagehide'); flush(); });
  window.addEventListener('online', flush);
  // Only counts, never exception text, URLs, microphone data or typed content.
  let errors = 0;
  const recordError = () => { if (errors++ < 20) tracker?.error(); };
  window.addEventListener('error', recordError);
  window.addEventListener('unhandledrejection', recordError);
  setInterval(() => { tracker?.snapshot('heartbeat'); flush(); }, 15000);
  function showSettings() {
    if (document.getElementById('qa-dialog')) return;
    const overlay = document.createElement('div'); overlay.id = 'qa-dialog';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#000c;display:grid;place-items:center;padding:24px;color:#eee;font:16px/1.7 system-ui';
    const card = document.createElement('section');
    card.setAttribute('role','dialog'); card.setAttribute('aria-modal','true'); card.setAttribute('aria-labelledby','qa-heading');
    card.style.cssText = 'max-width:480px;max-height:calc(100dvh - 48px);overflow:auto;background:#181c22;border:1px solid #59606b;border-radius:16px;padding:28px';
    card.innerHTML = '<h2 id="qa-heading" style="margin-top:0">플레이 테스트 참여</h2><p>게임 개선을 위해 장별 체류·클리어 시간, 실패·재시작 횟수, 오류 발생 횟수를 서버에 저장해도 될까요?</p><p>이름·연락처·음성은 수집하지 않습니다. 무작위 플레이 세션 번호를 사용하며, 관리자가 데이터를 내려받아 분석합니다. 전송 대기 기록은 이 브라우저에 임시 보관됩니다.</p><p style="font-size:13px;color:#b8c0ca">수집 없이도 게임을 할 수 있습니다. 왼쪽 아래 QA 설정에서 언제든 중단할 수 있습니다. 중단 전 이미 서버에 저장된 데이터는 유지됩니다.</p>';
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap';
    for (const [label, action] of [['동의하고 플레이', enable], ['수집 없이 플레이', disable]]) {
      const button = document.createElement('button'); button.textContent = label;
      button.style.cssText = 'padding:12px;border-radius:8px;border:1px solid #aaa;cursor:pointer;background:#f1f3f6;color:#111;font:inherit';
      button.onclick = e => { e.stopPropagation(); action(); overlay.remove(); status.focus(); }; row.append(button);
    }
    card.append(row); overlay.append(card); overlay.addEventListener('keydown', e => {
      if(e.key === 'Tab') { const buttons = [...row.querySelectorAll('button')]; e.preventDefault(); buttons[document.activeElement === buttons[0] ? 1 : 0].focus(); }
      e.stopPropagation();
    });
    overlay.addEventListener('click', e => e.stopPropagation()); document.body.append(overlay); row.firstChild.focus();
  }
  function mount() {
    status = document.createElement('button'); status.type = 'button'; status.title = 'QA 데이터 수집 설정';
    status.style.cssText = 'position:fixed;bottom:calc(64px + env(safe-area-inset-bottom,0px));left:max(8px,env(safe-area-inset-left,0px));z-index:99999;padding:5px 9px;background:#16191eee;color:#ddd;border:1px solid #666;border-radius:6px;font:11px system-ui;cursor:pointer';
    status.textContent = 'QA 설정 · 수집 꺼짐'; status.onclick = showSettings; document.body.append(status);
    if (read(consentKey) === 'yes') enable(); else if (read(consentKey) !== 'no') showSettings();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
