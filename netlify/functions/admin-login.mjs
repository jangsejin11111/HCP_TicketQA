import { sessions, sameSecret } from '../lib/auth.mjs';
import { json } from '../lib/validation.mjs';
// PIN attempts are limited separately from authenticated data downloads.
export const config = { rateLimit: { windowLimit: 5, windowSize: 60, aggregateBy: ['ip','domain'] } };
export function createHandler(auth = sessions(), pin = () => process.env.QA_ADMIN_PIN) {
  return async request => {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' },405);
    if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'Origin rejected' },403);
    const expected = pin();
    if (!expected || !/^\d{4,12}$/.test(expected)) return json({ error: '서버 환경변수 QA_ADMIN_PIN을 설정해 주세요.' },503);
    let supplied;
    try {
      const body = await request.text();
      if (Buffer.byteLength(body)>512) return json({error:'Too large'},413);
      supplied = JSON.parse(body).pin;
    } catch { return json({error:'Invalid JSON'},400); }
    if (typeof supplied !== 'string' || !sameSecret(expected,supplied)) return json({error:'관리자 인증번호가 일치하지 않습니다.'},401);
    try { return json(await auth.issue()); }
    catch { return json({error:'인증 저장소에 연결하지 못했습니다.'},503); }
  };
}
export default createHandler();
