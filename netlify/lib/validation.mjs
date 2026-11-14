const id = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const statuses = new Set(['ready','playing','cleared','failed','abandoned']);
const events = new Set(['enter','start','leave','cleared','failed','heartbeat','pagehide','visible','hidden','error']);
const reasons = new Set(['','fall','cart_abandoned','car_collision','escape_failure','dog_attack','starvation','ice_melt']);
export function validateRecord(r) {
  if (!r || !id.test(r.id) || !id.test(r.sessionId) || !id.test(r.attemptId)) throw new Error('Invalid ID');
  if (r.schema !== 1 || r.version !== 'qa-1' || typeof r.debug !== 'boolean') throw new Error('Invalid version');
  for (const [key, min, max] of [['chapter',1,15],['attempt',1,100000],['seq',1,1000000],['failures',0,1],['errors',0,20],['wallMs',0,604800000],['activeMs',0,604800000],['playMs',0,604800000]]) {
    if (!Number.isInteger(r[key]) || r[key] < min || r[key] > max) throw new Error('Invalid metric');
  }
  if (!statuses.has(r.status) || !events.has(r.event) || !reasons.has(r.reason)) throw new Error('Invalid category');
  for (const key of ['startedAt','observedAt']) if (typeof r[key] !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(r[key]) || !Number.isFinite(Date.parse(r[key])) || new Date(r[key]).toISOString() !== r[key]) throw new Error('Invalid date');
  for (const key of ['clearWallMs','clearActiveMs']) if (r[key] !== null && (!Number.isInteger(r[key]) || r[key] < 0 || r[key] > r.wallMs)) throw new Error('Invalid clear time');
  if (r.activeMs > r.wallMs || r.playMs > r.activeMs) throw new Error('Invalid timing');
  const keys = ['id','schema','version','sessionId','attemptId','debug','chapter','attempt','seq','startedAt','observedAt','status','event','wallMs','activeMs','playMs','clearWallMs','clearActiveMs','failures','reason','errors'];
  return Object.fromEntries(keys.map(k => [k,r[k]]));
}
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
