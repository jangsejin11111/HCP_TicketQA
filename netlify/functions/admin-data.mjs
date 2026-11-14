import { getStore } from '@netlify/blobs';
import { json } from '../lib/validation.mjs';
import { sessions } from '../lib/auth.mjs';
export const config = { rateLimit: { windowLimit: 120, windowSize: 60, aggregateBy: ['ip','domain'] } };
export function createHandler(storeFactory = () => getStore({ name: 'clone-poem-qa-v1', consistency: 'strong' }), auth = sessions()) {
  return async request => {
    try {
      if (!await auth.verify(request)) return json({ error: '인증이 만료되었습니다. 인증번호로 다시 접속해 주세요.' },401);
      const store = storeFactory();
      if (request.method === 'GET') {
        const prefix = new URL(request.url).searchParams.get('hour');
        if (!/^\d{4}-\d\d-\d\dT(?:[01]\d|2[0-3])$/.test(prefix || '')) return json({ error: 'Valid UTC hour required' },400);
        const keys = [];
        for await (const page of store.list({ prefix: prefix + '/', paginate: true })) {
          keys.push(...page.blobs.map(x => x.key));
          if (keys.length > 20000) return json({ error: 'Too many records in this hour; use a dedicated database/export job.' },413);
        }
        return json({ keys });
      }
      if (request.method === 'POST') {
        const body = await request.text();
        if (Buffer.byteLength(body) > 12000) return json({ error: 'Too large' },413);
        let keys; try { keys = JSON.parse(body).keys; } catch { return json({ error: 'Invalid JSON' },400); }
        if (!Array.isArray(keys) || keys.length > 50 || keys.some(k => typeof k !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d\/[a-f0-9-]{36}\/[a-f0-9-]{36}$/i.test(k))) return json({ error: 'Invalid keys' },400);
        return json({ records: (await Promise.all(keys.map(k => store.get(k,{ type:'json' })))).filter(Boolean) });
      }
      return json({ error:'Method not allowed' },405);
    } catch { return json({ error:'Storage unavailable' },503); }
  };
}
export default createHandler();
