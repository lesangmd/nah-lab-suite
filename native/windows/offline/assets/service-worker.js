const CACHE='nah-lab-suite-v1.58.56';
const STATIC=['./','assets/app.css','assets/app.js','assets/app-logo.png','assets/nah-logo.jpg','assets/lab-hero.png','assets/nah-hospital-phase2-login.jpg'];
const isStatic=u=>u.origin===location.origin&&(/\/assets\//.test(u.pathname)||/\.(?:css|js|png|jpg|jpeg|svg|ico|webmanifest)$/i.test(u.pathname));
const isRuntimeAsset=u=>u.origin===location.origin&&/\/assets\/(?:app\.js|app\.css)$/.test(u.pathname);
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>Promise.allSettled(STATIC.map(x=>c.add(x)))))});
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('nah-lab-suite-')&&k!==CACHE)await caches.delete(k);await self.clients.claim()})()));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 const u=new URL(e.request.url),scope=new URL(self.registration.scope);
 // OAuth action and callback requests must reach WordPress, never a cached shell.
 if(u.pathname.includes('/wp-json/nah-iso15189/v1/')||[...u.searchParams.keys()].some(k=>k.startsWith('nah_iso_drive_')||['code','state','drive'].includes(k))){e.respondWith(fetch(e.request));return;}
 // Runtime CSS/JS is network-first so a newly installed Web release is visible
 // on the first reload; the current cache remains the offline fallback.
 if(isRuntimeAsset(u)){e.respondWith((async()=>{const c=await caches.open(CACHE);try{const r=await fetch(e.request);if(r&&r.ok)await c.put(e.request,r.clone());return r}catch(_e){return (await c.match(e.request,{ignoreSearch:true}))||Response.error()}})());return;}
 if(isStatic(u)){e.respondWith((async()=>{const c=await caches.open(CACHE),hit=await c.match(e.request,{ignoreSearch:true});if(hit){e.waitUntil(fetch(e.request).then(r=>{if(r&&r.ok)c.put(e.request,r.clone())}).catch(()=>{}));return hit}const r=await fetch(e.request);if(r&&r.ok)c.put(e.request,r.clone());return r})());return;}
 if(e.request.mode==='navigate'&&u.origin===scope.origin&&u.pathname===scope.pathname){
  e.respondWith((async()=>{const c=await caches.open(CACHE);try{const r=await fetch(e.request);if(r&&r.ok)await c.put('./',r.clone());return r}catch(_e){return (await c.match('./'))||Response.error()}})());return;
 }
 // Leave other routes and other applications on the origin to the network.
});
