self.addEventListener('install',e=>{e.waitUntil(caches.open('my-schedule-v1').then(c=>c.addAll(['./','./index.html','./manifest.webmanifest','./icons/icon-192.png'])));self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{if(e.request.method==='GET')e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))});
