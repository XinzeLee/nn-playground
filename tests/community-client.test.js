import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../community.js', import.meta.url), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
function storage() {
  const map = new Map();
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
}
function setup({ fetch, localStorage = storage(), sessionStorage = storage(), protocol = 'https:' }) {
  const elements = {};
  for (const key of ['visit-count', 'like-count', 'like-btn', 'counter-status']) elements[key] = {
    textContent: '', hidden: false, disabled: false, attributes: {}, handlers: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, handler) { this.handlers[name] = handler; }
  };
  const root = { querySelector: selector => elements[selector.slice(6, -1)] };
  const events = {};
  const window = { addEventListener: (name, handler) => { events[name] = handler; } };
  const document = { querySelector: () => root, addEventListener() {}, hidden: false };
  vm.runInNewContext(source, { document, window, location: { protocol }, navigator: { onLine: true, connection: { saveData: true } }, localStorage, sessionStorage, fetch, URL, AbortController, setTimeout, clearTimeout, crypto: { randomUUID: () => '01234567-89ab-cdef-0123-456789abcdef' } });
  return { elements, events, localStorage, sessionStorage };
}

test('client records one visit per session and saves a shared like', async () => {
  const actions = [];
  const remote = { visits: 0, likes: 0 };
  const fetch = async (url, options) => {
    const path = url.pathname.split('/').pop();
    actions.push(path);
    if (path === 'visit') remote.visits++;
    if (path === 'like') remote.likes++;
    return { ok: true, json: async () => ({ ...remote }) };
  };
  const first = setup({ fetch });
  await flush();
  assert.equal(first.elements['visit-count'].textContent, '1 visits');
  first.elements['like-btn'].handlers.click();
  await flush();
  assert.equal(first.elements['like-count'].textContent, '1 likes');
  assert.equal(first.elements['like-btn'].attributes['aria-pressed'], 'true');
  const second = setup({ fetch, localStorage: first.localStorage, sessionStorage: first.sessionStorage });
  await flush();
  assert.deepEqual(actions, ['visit', 'like', 'counts']);
  assert.equal(second.elements['like-btn'].disabled, true);
});

test('client queues failed likes and retries them with the same token', async () => {
  let offline = true;
  const tokens = [];
  const fetch = async (url, options) => {
    if (options.body && url.pathname.endsWith('/like')) tokens.push(JSON.parse(options.body).token);
    if (offline) throw new Error('offline');
    return { ok: true, json: async () => ({ visits: 1, likes: 1 }) };
  };
  const page = setup({ fetch });
  await flush();
  page.elements['like-btn'].handlers.click();
  await flush();
  assert.match(page.elements['counter-status'].textContent, /will sync/);
  offline = false;
  await page.events.online();
  assert.equal(page.elements['counter-status'].hidden, true);
  assert.equal(tokens.length, 2);
  assert.equal(tokens[0], tokens[1]);
});
