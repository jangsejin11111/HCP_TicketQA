import { getStore } from '@netlify/blobs';
import { validateRecord, json } from '../lib/validation.mjs';
export const config = { rateLimit: { windowLimit: 120, windowSize: 60, aggregateBy: ['ip','domain'] } };
export function createHandler(storeFactory = () => getStore('clone-poem-qa-v1')) {
  return async request => {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' },405);
    if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'Origin rejected' },403);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'JSON required' },415);
    let records;
    try {
      const body = await request.text();
      if (Buffer.byteLength(body) > 48000) return json({ error: 'Too large' },413);
      const data = JSON.parse(body);
      if (!Array.isArray(data.records) || data.records.length < 1 || data.records.length > 20) throw new Error();
      records = data.records.map(validateRecord);
    } catch { return json({ error: 'Invalid records' },400); }
    try {
      const store = storeFactory(), receivedAt = new Date().toISOString();
      // Stable record keys make retransmission idempotent, including after midnight.
      await Promise.all(records.map(record => store.setJSON(`${record.observedAt.slice(0,13)}/${record.sessionId}/${record.id}`, { ...record, receivedAt })));
      return json({ accepted: records.length });
    } catch { return json({ error: 'Storage unavailable' },503); }
  };
}
export default createHandler();
