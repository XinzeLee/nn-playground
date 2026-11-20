// Shared counters are independent of the workshop and personal-site counters.
(function () {
  const api = 'https://xinzelee-counter.xinzelee.workers.dev/playground/v1/';
  const prefix = 'nn-playground-community-v1-';
  const memory = {};
  const root = document.querySelector('[data-community]');
  if (!root) return;
  const visits = root.querySelector('[data-visit-count]');
  const likes = root.querySelector('[data-like-count]');
  const button = root.querySelector('[data-like-btn]');
  const status = root.querySelector('[data-counter-status]');
  const isFile = location.protocol === 'file:';
  let counts = null, live = false, busy = false, visible = false, stopped = false, timer = null;

  function read(key, session = false) {
    try { return (session ? sessionStorage : localStorage).getItem(prefix + key) || memory[key]; }
    catch { return memory[key]; }
  }
  function write(key, value, session = false) {
    memory[key] = String(value);
    try { (session ? sessionStorage : localStorage).setItem(prefix + key, String(value)); } catch { /* Storage can be blocked. */ }
  }
  function identity(key, session = false) {
    let id = read(key, session);
    if (!id) {
      id = globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      write(key, id, session);
    }
    return id;
  }
  function valid(value) { return value && Number.isSafeInteger(value.visits) && value.visits >= 0 && Number.isSafeInteger(value.likes) && value.likes >= 0; }
  try { const saved = JSON.parse(read('counts') || 'null'); if (valid(saved)) counts = saved; } catch { /* No saved counts. */ }
  function paint() {
    visits.textContent = counts ? counts.visits.toLocaleString() + ' visits' + (live ? '' : ' (saved)') : 'Visits unavailable';
    likes.textContent = counts ? counts.likes.toLocaleString() + ' likes' + (live ? '' : ' (saved)') : 'Likes unavailable';
    const liked = read('liked') === '1';
    button.disabled = busy || liked || isFile;
    button.setAttribute('aria-pressed', String(liked));
    button.textContent = busy ? 'Saving like…' : liked ? '♥ Liked' : '♡ Like this playground';
    status.textContent = isFile ? 'Open the hosted playground to view counts or leave a like.' : read('pending-like') ? 'Your like is saved on this device and will sync when connected.' : '';
    status.hidden = !status.textContent;
  }
  async function request(path, body) {
    if (!navigator.onLine || isFile) throw new Error('Offline');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(new URL(path, api), { method: body ? 'POST' : 'GET', cache: 'no-store', signal: controller.signal, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
      if (!response.ok) throw new Error('Counter unavailable');
      const data = await response.json();
      if (!valid(data)) throw new Error('Invalid counter response');
      counts = data; live = true; stopped = false; write('counts', JSON.stringify(data));
    } finally { clearTimeout(timeout); }
  }
  function schedule() {
    clearTimeout(timer);
    if (visible && !document.hidden && navigator.onLine && !stopped && !navigator.connection?.saveData) timer = setTimeout(refresh, 60000);
  }
  function fail() { live = false; stopped = true; paint(); schedule(); }
  async function syncLike() {
    const token = read('pending-like');
    if (!token || busy) return;
    busy = true; paint();
    try { await request('like', { token }); write('pending-like', ''); }
    catch { fail(); }
    finally { busy = false; paint(); schedule(); }
  }
  async function refresh() {
    try { await request('counts'); paint(); }
    catch { fail(); }
    schedule();
  }
  async function start() {
    try {
      if (!read('visited', true)) {
        await request('visit', { token: identity('visit-token', true) });
        write('visited', '1', true);
      } else await request('counts');
      paint();
    } catch { fail(); }
    await syncLike(); schedule();
  }
  button.addEventListener('click', () => {
    if (read('liked') === '1' || busy || isFile) return;
    write('liked', '1'); write('pending-like', identity('like-token')); paint(); syncLike();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); schedule(); }).observe(root);
  } else visible = true;
  document.addEventListener('visibilitychange', () => { if (!document.hidden && stopped) start(); else schedule(); });
  window.addEventListener('offline', fail);
  window.addEventListener('online', start);
  window.addEventListener('storage', paint);
  paint(); if (!isFile) start();
})();
