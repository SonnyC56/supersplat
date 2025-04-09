import { version as appVersion } from '../package.json';

// export default null
declare let self: ServiceWorkerGlobalScope;

const cacheName = `superSplat-v${appVersion}`;

const cacheUrls = [
    './',
    './index.html',
    './index.css',
    './index.js',
    './manifest.json',
    './static/icons/logo-192.png',
    './static/icons/logo-512.png',
    './static/images/screenshot-narrow.jpg',
    './static/images/screenshot-wide.jpg'
];

self.addEventListener('install', (event) => {
    console.log(`installing v${appVersion}`);

    // create cache for current version
    event.waitUntil(
        caches.open(cacheName)
        .then((cache) => {
            cache.addAll(cacheUrls);
        })
    );
});

self.addEventListener('activate', () => {
    console.log(`activating v${appVersion}`);

    // delete the old caches once this one is activated
    caches.keys().then((names) => {
        for (const name of names) {
            if (name !== cacheName) {
                caches.delete(name);
            }
        }
    });
});

self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    // Strategy: Network Falling Back to Cache for CSS and JS
    if (requestUrl.pathname.endsWith('/index.css') || requestUrl.pathname.endsWith('/index.js')) {
        event.respondWith(
            fetch(event.request).then((networkResponse) => {
                // If fetch is successful, clone the response, cache it, and return it
                const responseClone = networkResponse.clone();
                caches.open(cacheName).then((cache) => {
                    cache.put(event.request, responseClone);
                });
                return networkResponse;
            }).catch(() => {
                // If fetch fails (e.g., offline), try to get it from the cache
                return caches.match(event.request);
            })
        );
    } else {
        // Strategy: Cache First for all other requests (HTML, images, etc.)
        event.respondWith(
            caches.match(event.request)
            .then(response => response ?? fetch(event.request))
        );
    }
});
