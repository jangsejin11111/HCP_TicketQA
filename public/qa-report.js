export const names = ['','계단식 논','묘지산','임도','동굴','터널','고속도로','계류장','폐공장','매립지','도시','컨테이너','항구','바다','얼음 섬','작은 얼음섬'];
export function latestAttempts(records) {
  const latest = new Map();
  for (const record of records) {
    const old = latest.get(record.attemptId);
    if (!old || old.seq < record.seq) latest.set(record.attemptId,record);
  }
  return [...latest.values()].sort((a,b) => a.startedAt.localeCompare(b.startedAt));
}
export function chapterRows(records) {
  const groups = new Map();
  for (const r of latestAttempts(records)) {
    const key = r.sessionId + '/' + r.chapter;
    let g = groups.get(key);
    if (!g) { g = { sessionId:r.sessionId, chapter:r.chapter, chapterName:names[r.chapter], debug:r.debug,
      attempts:0, failures:0, clears:0, wallMs:0, activeMs:0, playMs:0, errors:0,
      firstEnteredAt:r.startedAt, firstClearAt:null, firstClearWallMs:null, firstClearActiveMs:null, lastStatus:'' }; groups.set(key,g); }
    g.attempts++; g.failures += r.failures; g.errors += r.errors;
    if (r.status === 'cleared') {
      g.clears++;
      if (g.firstClearAt === null) {
        g.firstClearAt = new Date(Date.parse(r.startedAt) + r.clearWallMs).toISOString();
        g.firstClearWallMs = Date.parse(g.firstClearAt) - Date.parse(g.firstEnteredAt);
        g.firstClearActiveMs = g.activeMs + r.clearActiveMs;
      }
    }
    g.wallMs += r.wallMs; g.activeMs += r.activeMs; g.playMs += r.playMs; g.lastStatus = r.status;
  }
  return [...groups.values()];
}
export function csv(rows) {
  if (!rows.length) return '\uFEFF';
  const keys = Object.keys(rows[0]);
  const cell = v => '"' + String(v ?? '').replace(/^[=+@\-\t\r]/,s => "'"+s).replaceAll('"','""') + '"';
  return '\uFEFF' + [keys.map(cell).join(','),...rows.map(row => keys.map(k=>cell(row[k])).join(','))].join('\r\n');
}
