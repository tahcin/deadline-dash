const CACHE_NAME = "app-cache-v2"; // Increment version when updating files
const ASSETS_TO_CACHE = ["/", "/index.html", "/styles.css", "/script.js"];

// Install event - Caches assets and forces update
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting(); // Activate immediately
});

// Activate event - Deletes old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME) // Remove old cache versions
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim(); // Take control of clients immediately
});

// Fetch event - Tries network first, falls back to cache
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, response.clone()); // Update cache
          return response;
        });
      })
      .catch(() => caches.match(event.request)) // Use cache if offline
  );
});
