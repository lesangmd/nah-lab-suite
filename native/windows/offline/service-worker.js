const CACHE='nah-lab-suite-desktop-v1.3.20-activityfix';
const STATIC=['./','assets/app.css','assets/app.js','assets/app-logo.png','assets/nah-logo.jpg','assets/lab-hero.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>Promise.allSettled(STATIC.map(x=>c.add(x)))))});
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==CACHE)await caches.delete(k);await self.clients.claim()})()));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.pathname.includes('/wp-json/nah-iso15189/v1/')){e.respondWith(fetch(e.request));return;}e.respondWith((async()=>{const c=await caches.open(CACHE);const hit=await c.match(e.request);try{const r=await fetch(e.request);if(r&&r.ok&&u.origin===location.origin)c.put(e.request,r.clone());return r}catch(_e){return hit||c.match('./')||Response.error()}})())});
