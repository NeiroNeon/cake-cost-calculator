const CACHE = 'culinary-calculator-v3';
const CORE = ['./', './index.html', './app/', './app/index.html', './app/recipes.html', './app/summary.html', './app/src/recipes.js', './app/src/recipes-domain.js', './app/src/summary.js', './app/src/summary-domain.js', './manifest.webmanifest', './assets/icon.svg', './assets/icon-192.png', './assets/icon-512.png', './app/src/domain.js', './site/styles.css', './site/main.js'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('culinary-calculator-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch {
      const requestUrl = new URL(event.request.url);
      const appPath = new URL('./app/index.html', self.registration.scope);
      const rootPath = new URL('./index.html', self.registration.scope);
      const fallback = requestUrl.pathname.includes('/app/') ? appPath : rootPath;
      return (await cache.match(fallback.href)) || (await cache.match(fallback.pathname)) || Response.error();
    }
  }));
});
