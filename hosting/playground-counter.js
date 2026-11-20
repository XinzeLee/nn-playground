// Additive Cloudflare Worker route: /playground/v1/{counts,visit,like}.
const PREFIX = '/playground/v1/';
function json(data, status, origin = '*') {
  return new Response(JSON.stringify(data), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': origin, 'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type'
  } });
}
async function totals(env) {
  const row = await env.DB.prepare('SELECT visits, likes, updated_at FROM playground_totals WHERE id = 1').first();
  return { visits: row?.visits ?? 0, likes: row?.likes ?? 0, updatedAt: row?.updated_at ?? null };
}
export async function playgroundCounter(request, env) {
  const path = new URL(request.url).pathname.slice(PREFIX.length);
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.PLAYGROUND_ALLOWED_ORIGINS || env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).includes(origin);
  if (request.method === 'OPTIONS') return allowed ? new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type'
  } }) : json({ error: 'Origin not allowed' }, 403);
  try {
    if (request.method === 'GET' && path === 'counts') return json(await totals(env), 200);
    if (request.method !== 'POST' || !['visit', 'like'].includes(path)) return json({ error: 'Not found' }, 404);
    if (!allowed) return json({ error: 'Origin not allowed' }, 403);
    if (Number(request.headers.get('Content-Length') || 0) > 1000) return json({ error: 'Payload too large' }, 413, origin);
    const text = await request.text();
    if (text.length > 1000) return json({ error: 'Payload too large' }, 413, origin);
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: 'Invalid JSON' }, 400, origin); }
    if (!/^[a-zA-Z0-9_-]{16,80}$/.test(body?.token || '')) return json({ error: 'Invalid action token' }, 400, origin);
    await env.DB.prepare('INSERT OR IGNORE INTO playground_actions (kind, token, created_at) VALUES (?1, ?2, ?3)').bind(path, body.token, new Date().toISOString()).run();
    return json(await totals(env), 200, origin);
  } catch (error) {
    console.error('Playground counter failed', error);
    return json({ error: 'Counter temporarily unavailable' }, 503, allowed ? origin : '*');
  }
}
