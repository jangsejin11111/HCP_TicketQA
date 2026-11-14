/* Pure timing model; wall time includes hidden tabs, active time does not. */
(function (root) {
  function createTracker({ now, uuid, emit, sessionId, debug = false }) {
    let current = null, last = now(), visible = true, playing = false;
    const counts = {};
    function tick() {
      const t = now(), delta = Math.max(0, t - last); last = t;
      if (!current) return;
      current.wallMs += delta;
      if (visible) {
        current.activeMs += delta;
        if (playing && current.status === 'playing') current.playMs += delta;
      }
    }
    function snapshot(event) {
      tick(); if (!current) return;
      current.seq++;
      emit({ ...current, event, observedAt: new Date(now()).toISOString() });
    }
    function enter(chapter) {
      if (current) { tick(); if (['playing','ready'].includes(current.status)) current.status = 'abandoned'; snapshot('leave'); }
      current = { schema: 1, version: 'qa-1', sessionId, debug, attemptId: uuid(),
        chapter, attempt: counts[chapter] = (counts[chapter] || 0) + 1,
        startedAt: new Date(now()).toISOString(), status: 'ready', seq: 0,
        wallMs: 0, activeMs: 0, playMs: 0, clearWallMs: null, clearActiveMs: null,
        failures: 0, reason: '', errors: 0 };
      last = now(); playing = false; snapshot('enter');
    }
    function sync(chapter, isPlaying, isVisible) {
      if (!current || current.chapter !== chapter) enter(chapter);
      tick(); visible = isVisible; playing = isPlaying;
      if (isPlaying && current.status === 'ready') { current.status = 'playing'; snapshot('start'); }
    }
    function finish(status, reason = '') {
      if (!current || !['ready','playing'].includes(current.status)) return;
      tick(); current.status = status; current.reason = reason;
      if (status === 'failed') current.failures = 1;
      if (status === 'cleared') { current.clearWallMs = current.wallMs; current.clearActiveMs = current.activeMs; }
      snapshot(status);
    }
    return { enter, sync, snapshot, finish,
      visibility(value) { tick(); visible = value; snapshot(value ? 'visible' : 'hidden'); },
      error() { if (current) { current.errors++; snapshot('error'); } }
    };
  }
  root.QACore = { createTracker };
})(globalThis);
