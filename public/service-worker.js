// Kill switch: any browser that still has the old service worker installed
// will unregister it and wipe its caches on next visit, then fall back to
// plain HTTP caching. Do not register a service worker from page code.

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
        await self.registration.unregister();
        const clients = await self.clients.matchAll({ type: 'window' });
        for (const client of clients) client.navigate(client.url);
    })());
});
