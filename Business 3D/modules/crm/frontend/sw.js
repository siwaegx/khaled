const CACHE = 'crm-v2';
const SHELL = ['/crm/', '/crm/css/style.css', '/crm/js/app.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))));
self.addEventListener('fetch', e => {
  if (!e.request.url.includes('/api/')) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});
