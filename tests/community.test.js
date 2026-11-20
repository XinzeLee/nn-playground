import test from 'node:test';
import assert from 'node:assert/strict';
import { playgroundCounter } from '../hosting/playground-counter.js';

function database() {
  const actions = new Set();
  const totals = { visits: 0, likes: 0, updated_at: null };
  return { prepare(sql) {
    return {
      bind(kind, token, time) { return { async run() {
        const key = `${kind}:${token}`;
        if (!actions.has(key)) { actions.add(key); totals[kind === 'visit' ? 'visits' : 'likes']++; totals.updated_at = time; }
      } }; },
      async first() { assert.match(sql, /playground_totals/); return totals; }
    };
  } };
}
const env = { DB: database(), ALLOWED_ORIGINS: 'https://xinzelee.github.io' };
function req(path, method = 'GET', origin = 'https://xinzelee.github.io', body) {
  return new Request('https://counter.example/playground/v1/' + path, { method, headers: { Origin: origin, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body && JSON.stringify(body) });
}

test('separate counts are idempotent across retried visits and likes', async () => {
  const token = '0123456789abcdef0123456789abcdef';
  for (const kind of ['visit', 'visit', 'like', 'like']) {
    const response = await playgroundCounter(req(kind, 'POST', undefined, { token }), env);
    assert.equal(response.status, 200);
  }
  const response = await playgroundCounter(req('counts'), env);
  const { visits, likes } = await response.json();
  assert.deepEqual({ visits, likes }, { visits: 1, likes: 1 });
});

test('mutations require an allowed origin and a valid token', async () => {
  assert.equal((await playgroundCounter(req('like', 'POST', 'https://untrusted.example', { token: '0123456789abcdef' }), env)).status, 403);
  assert.equal((await playgroundCounter(req('like', 'POST', undefined, { token: 'short' }), env)).status, 400);
  assert.equal((await playgroundCounter(req('like', 'OPTIONS', 'https://untrusted.example'), env)).status, 403);
  assert.equal((await playgroundCounter(req('like', 'OPTIONS'), env)).status, 204);
});
