const cacheName = 'nourish360-shell-v2';
const shell = new URL('./', self.registration.scope).href;
const sameOrigin = (url) => url.origin === self.location.origin;
const api = (url) => url.pathname === '/api' || url.pathname.startsWith('/api/');
const viteRuntime = (path) => path.startsWith('/@fs/') &&
  /\/node_modules\/\.pnpm\/vite@[^/]+\/node_modules\/vite\/dist\/client\/(?:env|client)\.mjs$/.test(path);
const cacheable = (url) => sameOrigin(url) && !api(url) && (
  !url.pathname.includes('/.') || url.pathname.startsWith('/node_modules/.vite/deps/') || viteRuntime(url.pathname)
);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.add(shell)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([self.clients.claim(), caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('nourish360-shell-') && key !== cacheName).map(key => caches.delete(key))))]));
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'WARM_SHELL' || !Array.isArray(event.data.urls)) return;
  event.waitUntil(caches.open(cacheName).then(cache => Promise.all(event.data.urls.slice(0,400).map(value => {
    const url = new URL(value, shell);
    if (!cacheable(url)) return;
    return cache.match(url.href).then(existing => existing || cache.add(url.href)).catch(() => undefined);
  }))));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);
  if (!cacheable(url)) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match(shell)) ?? Response.error()));
    return;
  }
  if (!['script','style','font','image','worker'].includes(request.destination)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    try {
      const response = await fetch(request);
      if (response.ok) {
        try { await cache.put(request,response.clone()); } catch { /* shell can still load online */ }
      }
      return response;
    } catch { return (await cache.match(request)) ?? Response.error(); }
  })());
});
