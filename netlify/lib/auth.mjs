import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { getStore } from '@netlify/blobs';
const hash = value => createHash('sha256').update(value).digest('hex');
export const sameSecret = (a, b) => timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
export function sessions(storeFactory = () => getStore({ name: 'clone-poem-qa-auth-v1', consistency: 'strong' })) {
  return {
    async issue() {
      const token = randomBytes(32).toString('hex');
      const expiresAt = Date.now() + 3600000;
      await storeFactory().setJSON(hash(token), { expiresAt });
      return { token, expiresAt };
    },
    async verify(request) {
      const token = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
      if (!/^[a-f0-9]{64}$/.test(token)) return false;
      const store = storeFactory(), key = hash(token);
      const session = await store.get(key, { type: 'json' });
      if (!session) return false;
      if (session.expiresAt <= Date.now()) { await store.delete(key); return false; }
      return true;
    }
  };
}
