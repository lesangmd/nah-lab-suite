/*
 * Windows Native v1.3.25 — simple transport, server-first reads and durable offline mirror
 *
 * The native shell runs the exact WebApp DOM/CSS/JS. This adapter is the only
 * Desktop-specific browser layer: it maps the normal REST contract to a durable
 * IndexedDB read mirror and to the v1.38 device-token API when online.
 *
 * Security contract:
 * - credentials/passwords are never persisted here;
 * - first successful login requires Internet; the opaque device token and account profile persist per Windows user profile;
 * - the native host clears cookies at launch and exit;
 * - offline data is read-only; writes require an authenticated online session.
 */
(function(){
'use strict';

const VERSION='1.3.25';
const DB_NAME='nah_lab_desktop_full_mirror_v130';
const DB_VERSION=1;
const STORE_API='api';
const STORE_META='meta';
const SYNC_INTERVAL_MS=60*1000; // manifest check; full snapshots are version/age gated
const MAX_FULL_AGE_MS=10*60*1000; // safety refresh for backend state absent from dataset clock
const TOKEN_KEY='nahLabDesktopDeviceToken';
const USER_KEY='nahLabDesktopSessionUser';
const SYNC_KEY='nahLabDesktopLastSyncAt';
const API_BASE='https://sachyhoc.com/wp-json/nah-iso15189/v1/';
// No bundled default business database: authenticated server snapshots are canonical.
const nativeFetch=window.fetch.bind(window);
let syncPromise=null;
let dbPromise=null;
let lastSessionSyncAt=0;
let syncStripHideTimer=null;

function jsonResponse(data,status=200,extraHeaders={}){
  const headers=new Headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extraHeaders});
  return new Response(JSON.stringify(data),{status,headers});
}
function errorResponse(status,message,code='desktop_offline'){
  return jsonResponse({code,message,data:{status}},status);
}
const EXPIRES_KEY='nahLabDesktopDeviceTokenExpiresAt';
function readCachedUser(){try{const raw=localStorage.getItem(USER_KEY);return raw?JSON.parse(raw):null}catch(_e){return null}}
function readSessionUser(){return readCachedUser()}
function tokenExpired(){try{const raw=localStorage.getItem(EXPIRES_KEY)||'';if(!raw)return false;const t=Date.parse(raw);return Number.isFinite(t)&&t<=Date.now()}catch(_e){return false}}
function readToken(){try{if(tokenExpired())return'';return localStorage.getItem(TOKEN_KEY)||''}catch(_e){return''}}
function saveSession(token,user,expiresAt=''){try{if(token)localStorage.setItem(TOKEN_KEY,token);else localStorage.removeItem(TOKEN_KEY);if(user)localStorage.setItem(USER_KEY,JSON.stringify(user));if(expiresAt)localStorage.setItem(EXPIRES_KEY,expiresAt);else if(!token)localStorage.removeItem(EXPIRES_KEY)}catch(_e){}}
function clearTokenKeepProfile(){try{localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(EXPIRES_KEY)}catch(_e){}}
function clearSession(){try{localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(USER_KEY);localStorage.removeItem(EXPIRES_KEY)}catch(_e){}}
function restPathFromUrl(input){
  let raw='';
  if(typeof input==='string')raw=input;else if(input&&typeof input.url==='string')raw=input.url;else raw=String(input||'');
  const marker='/wp-json/nah-iso15189/v1/';
  const at=raw.indexOf(marker);
  if(at>=0)return raw.slice(at+marker.length);
  if(raw.startsWith(API_BASE))return raw.slice(API_BASE.length);
  return null;
}
function normalizeKey(path){
  path=String(path||'').replace(/^\/+/, '');
  const qAt=path.indexOf('?');
  const pathname=qAt>=0?path.slice(0,qAt):path;
  if(qAt<0)return pathname;
  const params=new URLSearchParams(path.slice(qAt+1));
  for(const k of ['_ts','ts','refresh','expect_ref'])params.delete(k);
  const pairs=[...params.entries()].sort((a,b)=>a[0]===b[0]?String(a[1]).localeCompare(String(b[1])):a[0].localeCompare(b[0]));
  const sorted=new URLSearchParams();for(const [k,v] of pairs)sorted.append(k,v);
  const q=sorted.toString();return q?pathname+'?'+q:pathname;
}
function requestMethod(input,init){return String((init&&init.method)||(input&&input.method)||'GET').toUpperCase()}
function cloneHeaders(input,init){
  const h=new Headers(input&&input.headers?input.headers:undefined);
  if(init&&init.headers)new Headers(init.headers).forEach((v,k)=>h.set(k,v));
  return h;
}
// The canonical WebApp v1.58.29 provides desktop/transport specifically for
// file:// WebView2 origins. An X-NAH-Device-Token request header triggers a CORS
// preflight and can fail even with a healthy Internet connection. JSON traffic
// must use a simple text/plain POST, with server-side REST permission checks.
async function desktopTransport(path,method='GET',body=null,timeoutMs=45000,signal=null){
  const token=readToken();
  if(!token)throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  const user=readSessionUser();
  const envelope={path:String(path||''),method:String(method||'GET').toUpperCase(),token,csrf:String(user?.csrf||'')};
  if(body!==null&&body!==undefined){
    if(typeof body==='string'){
      try{envelope.json=JSON.parse(body)}
      catch(_e){throw new Error('Dữ liệu gửi lên không đúng định dạng.')}
    }else envelope.json=body;
  }
  // text/plain is CORS-safelisted. No custom headers or application/json here.
  const options={method:'POST',credentials:'omit',cache:'no-store',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(envelope)};
  if(signal)options.signal=signal;
  return deadlineFetch(API_BASE+'desktop/transport',options,timeoutMs);
}
async function desktopUpload(path,init,token){
  // WordPress native multipart routes require PHP $_FILES; desktop/transport
  // accepts JSON only. Supply device identity in simple FormData fields instead
  // of custom headers, as implemented by NAH_ISO15189_Auth::request_session_token.
  const source=init?.body;
  if(!(source instanceof FormData))throw new Error('Không thể gửi tệp lên máy chủ. Vui lòng thử lại.');
  const data=new FormData();
  for(const [k,v] of source.entries())if(k!=='_nah_device_token'&&k!=='_nah_csrf')data.append(k,v);
  data.append('_nah_device_token',token);
  const user=readSessionUser();if(user?.csrf)data.append('_nah_csrf',user.csrf);
  // Browser must generate the multipart boundary automatically.
  return nativeFetch(API_BASE+path,{method:requestMethod(null,init),body:data,credentials:'omit',cache:'no-store',signal:init?.signal});
}
function onlineHint(){return navigator.onLine!==false}
async function deadlineFetch(url,options={},timeoutMs=180000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await nativeFetch(url,{...options,signal:controller.signal})}
  finally{clearTimeout(timer)}
}

function openDb(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    if(!('indexedDB'in window)){reject(new Error('Không thể mở dữ liệu lưu trên máy này.'));return}
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE_API))db.createObjectStore(STORE_API);if(!db.objectStoreNames.contains(STORE_META))db.createObjectStore(STORE_META)};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('Không thể mở dữ liệu đã lưu.'));
  }).catch(error=>{dbPromise=null;throw error});
  return dbPromise;
}
async function idbGet(store,key){
  try{const db=await openDb();return await new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly');const req=tx.objectStore(store).get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}catch(_e){return undefined}
}
async function idbPut(store,key,value){
  try{const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});return true}catch(_e){return false}
}
async function idbClear(store){
  try{const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).clear();tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});return true}catch(_e){return false}
}
async function cached(key){
  const user=readSessionUser();
  const mirror=await idbGet(STORE_META,'mirror');
  // Never mix accounts or resurrect bundled templates as account data.
  if(!user||!mirror||!mirror.userRef||mirror.userRef!==user.ref)return undefined;
  return idbGet(STORE_API,key);
}
async function putCached(key,value){return idbPut(STORE_API,key,value)}
// A full mirror must be committed with its metadata atomically. In particular,
// deleted server records must not survive a successful reconciliation.
// Save a small, complete first-level snapshot before requesting hundreds of
// expensive per-record/detail routes. Keep a previously completed full mirror.
async function mergeCoreMirror(entries,metadata){
  const db=await openDb();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction([STORE_API,STORE_META],'readwrite');
    const records=tx.objectStore(STORE_API),meta=tx.objectStore(STORE_META);
    const old=meta.get('mirror');
    old.onsuccess=()=>{
      const previous=old.result;
      if(!previous||previous.userRef!==metadata.userRef)records.clear();
      for(const [key,value] of entries)records.put(value,key);
      meta.put({...metadata,scope:'core',fetchedAtMs:Date.now()},'mirror');
    };
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
}
async function replaceMirror(entries,metadata){
  const db=await openDb();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction([STORE_API,STORE_META],'readwrite');
    const store=tx.objectStore(STORE_API);
    store.clear();
    for(const [key,value] of entries)store.put(value,key);
    tx.objectStore(STORE_META).put(metadata,'mirror');
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error||new Error('Không thể lưu dữ liệu đồng bộ.'));
    tx.onabort=()=>reject(tx.error||new Error('Lưu dữ liệu bị gián đoạn.'));
  });
}
// Small inline status row in the main workspace. Never block login or navigation.
function syncStatus(phase,message){
  const bar=document.getElementById('desktopSyncStrip');
  if(!bar)return;
  if(syncStripHideTimer){clearTimeout(syncStripHideTimer);syncStripHideTimer=null}
  bar.hidden=false;
  bar.dataset.phase=phase;
  const label=bar.querySelector('[data-desktop-sync-text]');
  if(label)label.textContent=message;
  const retry=bar.querySelector('[data-desktop-sync-retry]');
  if(retry)retry.hidden=phase!=='error';
  if(phase==='complete')syncStripHideTimer=setTimeout(()=>{bar.hidden=true},3200);
}
function hideSyncStatus(){
  const bar=document.getElementById('desktopSyncStrip');
  if(syncStripHideTimer){clearTimeout(syncStripHideTimer);syncStripHideTimer=null}
  if(bar)bar.hidden=true;
}
function bindSyncRetry(){
  const retry=document.querySelector('[data-desktop-sync-retry]');
  if(retry)retry.addEventListener('click',()=>{void fullSync('manual')});
}
function offlineBootstrap(source){
  const base=(source&&typeof source==='object')?source:{};
  return {...base,canManageModules:[],notifications:{...(base.notifications||{}),unread:0},drive:{...(base.drive||{}),canUpload:false}};
}
function offlineAccountBootstrap(source,user){
  const base=offlineBootstrap(source);
  const u=user||{};
  const roleLabel=String(u.roleLabel||u.role_label||'Tài khoản cục bộ');
  const safeUser={...u,roleLabel:roleLabel+' · Ngoại tuyến',role_label:roleLabel+' · Ngoại tuyến',caps:['access','view_all','export'],csrf:'',offlineLocal:true};
  return {...base,user:safeUser,canManageModules:[],notifications:{...(base.notifications||{}),unread:0},drive:{...(base.drive||{}),canUpload:false}};
}
function authBootstrap(source,user){
  const base=(source&&typeof source==='object')?source:{};
  return {...base,user:user||base.user,notifications:base.notifications||{unread:0}};
}

function filterRecords(base,path){
  const u=new URL('https://local.invalid/'+path);
  const q=(u.searchParams.get('q')||'').trim().toLocaleLowerCase('vi');
  const status=(u.searchParams.get('status')||'').trim();
  let rows=Array.isArray(base)?base.slice():[];
  if(status)rows=rows.filter(r=>String(r&&r.status||'')===status);
  if(q)rows=rows.filter(r=>JSON.stringify([r&&r.code,r&&r.title,r&&r.description,r&&r.data]).toLocaleLowerCase('vi').includes(q));
  return rows;
}
function filterActivity(base,path){
  const u=new URL('https://local.invalid/'+path);let rows=Array.isArray(base)?base.slice():[];
  for(const k of ['module','action']){const v=u.searchParams.get(k);if(v)rows=rows.filter(x=>String(x&&x[k]||'')===v)}
  const from=u.searchParams.get('from'),to=u.searchParams.get('to');if(from)rows=rows.filter(x=>String(x&&x.created_at||'')>=from);if(to)rows=rows.filter(x=>String(x&&x.created_at||'').slice(0,10)<=to);
  const limit=Math.max(1,Math.min(5000,Number(u.searchParams.get('limit')||1000)));return rows.slice(0,limit);
}
function filterRegistry(base,path){
  const u=new URL('https://local.invalid/'+path),q=(u.searchParams.get('q')||'').trim().toLocaleLowerCase('vi');
  let rows=Array.isArray(base)?base:(Array.isArray(base&&base.items)?base.items:null);if(!rows)return base;
  if(q)rows=rows.filter(x=>JSON.stringify(x).toLocaleLowerCase('vi').includes(q));
  if(Array.isArray(base))return rows;return {...base,items:rows};
}
function excerpt(text,n=150){text=String(text||'').replace(/\s+/g,' ').trim();return text.length>n?text.slice(0,n-1)+'…':text}
function scoreText(haystack,needle){const h=String(haystack||'').toLocaleLowerCase('vi'),n=needle.toLocaleLowerCase('vi');if(!h.includes(n))return 0;return h.startsWith(n)?30:10}
async function localSearch(path){
  const u=new URL('https://local.invalid/'+path),q=(u.searchParams.get('q')||'').trim();if(q.length<2)return{query:q,results:[],total:0};
  const out=[];const push=(r,body)=>{const s=scoreText(body,q);if(s)out.push({...r,_score:s})};
  const modules=['iso','isoforms','documents','forms','tasks','projects','indicators','incidents','risks','nc','capa','audits','meetings','training','equipment','suppliers','certprogress','docplan','qd2429'];
  for(const m of modules){const rows=await cached('records?module='+encodeURIComponent(m));for(const r of (Array.isArray(rows)?rows:[]))push({type:'record',id:r.id,module:r.module,code:r.code||'',title:r.title||'',subtitle:'Bản ghi trong ứng dụng',snippet:excerpt(r.description||'')},JSON.stringify(r))}
  const hb=await cached('knowledge/handbook');for(const ch of (hb&&hb.chapters||[]))push({type:'handbook',module:'handbook',slug:ch.slug||'',code:(ch.clauses||[]).join(', '),title:ch.title||'',subtitle:'Sổ tay ISO 15189',snippet:excerpt(ch.summary||'')},JSON.stringify(ch));
  const learn=await cached('knowledge/learning');for(const l of (learn&&learn.lessons||[]))push({type:'learning',module:'learning',slug:l.slug||'',code:'',title:l.title||'',subtitle:'Bài học thực hành',snippet:excerpt((l.objectives||[]).join(' · '))},JSON.stringify(l));
  const qd=await cached('knowledge/qd2429');for(const c of (qd&&qd.criteria||[]))push({type:'record',id:c.id||0,module:'qd2429',code:c.code||'',title:c.text||c.title||'',subtitle:'Tiêu chí QĐ 2429',snippet:excerpt(c.guidance||'')},JSON.stringify(c));
  out.sort((a,b)=>b._score-a._score||String(a.title||'').localeCompare(String(b.title||''),'vi'));const results=out.slice(0,80).map(({_score,...x})=>x);return{query:q,results,total:out.length};
}
// Read canonical server snapshot only. Never overwrite personnel, roadmap or
// supervision state with static factory fixtures shipped in older installers.
function withCurrentPlan(_path,payload){return payload}
async function derivedCache(path){
  const norm=normalizeKey(path);
  let v=await cached(norm);if(v!==undefined)return withCurrentPlan(norm,v);
  const pathname=norm.split('?')[0];
  // Fallback only for static reference material; never invent user records.
  const catalogue=window.NAH_OFFLINE_REFERENCE_CATALOGUE;
  if(catalogue&&Object.prototype.hasOwnProperty.call(catalogue,pathname))return catalogue[pathname];
  if(pathname==='dashboard/snapshot'){
    const endpoints={dashboard:'dashboard',team:'team',quality:'quality-core/summary',evidence:'evidence-control/summary',roadmap:'roadmap',cert:'cert-progress/overview',docplan:'document-plan/overview'};
    const snapshot={version:'1.58.52',offline:true};
    for(const [key,endpoint] of Object.entries(endpoints))snapshot[key]=await cached(endpoint)||{};
    return withCurrentPlan(pathname,snapshot);
  }
  if(pathname==='search')return localSearch(norm);
  if(pathname==='records'){
    const u=new URL('https://local.invalid/'+norm),module=u.searchParams.get('module')||'';
    if(module){const base=await cached('records?module='+encodeURIComponent(module));if(base!==undefined)return filterRecords(base,norm)}
    let seenModule=false;let all=[];for(const m of ['qd2429','iso','isoforms','documents','forms','tasks','projects','indicators','incidents','risks','nc','capa','audits','meetings','training','equipment','suppliers','certprogress','docplan']){const rows=await cached('records?module='+encodeURIComponent(m));if(Array.isArray(rows)){seenModule=true;all.push(...rows)}}return seenModule?filterRecords(all,norm):undefined;
  }
  if(pathname==='activity'){const base=await cached('activity?limit=1000')??await cached('activity');return base===undefined?undefined:filterActivity(base,norm)}
  if(pathname==='evidence-control/registry'){const base=await cached('evidence-control/registry');return filterRegistry(base||[],norm)}
  return undefined;
}

async function remoteJson(path,init,_cacheKey){
  if(!readToken())throw new Error('not authenticated');
  // Online responses are consumed live. Only the validated FULL snapshot may
  // mutate IndexedDB; individual GETs must not create mixed-version mirrors.
  const res=await desktopTransport(path,requestMethod(null,init),init?.body,45000,init?.signal);
  let data=null;try{data=await res.clone().json()}catch(_e){}
  return {res,data};
}

async function fullSync(reason='periodic'){
  if(syncPromise)return syncPromise;
  const token=readToken(),user=readSessionUser();
  if(!token||!user||!user.ref||!onlineHint())return false;
  syncPromise=(async()=>{
    let attemptedFull=false;
    let coreReady=false;
    try{
      // Dataset routes also travel through the same CORS-simple transport.
      const foregroundNotice=['login','manual','reconnect'].includes(reason);
      if(foregroundNotice)syncStatus('running','Đang kiểm tra dữ liệu mới nhất…');
      const mres=await desktopTransport('desktop/dataset/manifest','GET',null,25000);
      if(!mres.ok)throw new Error('dataset manifest HTTP '+mres.status);
      const manifest=await mres.json();
      if(manifest.schema!=='nah-lab-dataset-manifest/v1'||!manifest.datasetVersion||manifest.userRef!==user.ref)
        throw new Error('Dataset manifest không hợp lệ hoặc không đúng tài khoản');
      const previous=await idbGet(STORE_META,'mirror');
      const reasonsAlwaysRefresh=['login','mutation','manual','reconnect'];
      const needsFull=!previous||previous.userRef!==user.ref||previous.datasetVersion!==manifest.datasetVersion
        ||!previous.fetchedAtMs||Date.now()-previous.fetchedAtMs>=MAX_FULL_AGE_MS
        ||previous.scope!=='full'||reasonsAlwaysRefresh.includes(reason);
      if(!needsFull){
        lastSessionSyncAt=Date.now();
        if(foregroundNotice)syncStatus('complete','Dữ liệu đã cập nhật.');
        window.dispatchEvent(new CustomEvent('nah-lab-desktop-sync',{detail:{ok:true,unchanged:true,reason,datasetVersion:manifest.datasetVersion}}));
        return true;
      }
      attemptedFull=true;
      syncStatus('running','Đang tải danh mục và hồ sơ chính…');
      const coreRes=await desktopTransport('desktop/mirror/full?scope=core','GET',null,90000);
      if(!coreRes.ok)throw new Error('core mirror HTTP '+coreRes.status);
      const corePayload=await coreRes.json();
      const coreCache=corePayload?.endpointCache;
      if(corePayload?.scope!=='core'||corePayload.userRef!==user.ref||!coreCache||typeof coreCache!=='object')
        throw new Error('Bản dữ liệu cơ bản không hợp lệ.');
      const coreRequired=['bootstrap','knowledge/handbook','knowledge/qd2429','knowledge/learning','records?module=forms','records?module=documents'];
      for(const key of coreRequired)if(!Object.prototype.hasOwnProperty.call(coreCache,key)||coreCache[key]?.__mirror_error)
        throw new Error('Bản dữ liệu cơ bản thiếu '+key);
      if(!Array.isArray(coreCache['knowledge/handbook']?.formTemplates)||!coreCache['knowledge/handbook'].formTemplates.length)
        throw new Error('Danh mục biểu mẫu chưa sẵn sàng.');
      if(readToken()!==token||readSessionUser()?.ref!==user.ref)return false;
      const coreEntries=Object.entries(coreCache).filter(([,v])=>!v?.__mirror_error).map(([k,v])=>[normalizeKey(k),v]);
      await mergeCoreMirror(coreEntries,{version:corePayload.version||'',datasetVersion:manifest.datasetVersion,userRef:user.ref,generatedAt:corePayload.generatedAt||'',endpointCount:coreEntries.length,reason});
      coreReady=true;
      syncStatus('complete','Đã cập nhật biểu mẫu, hồ sơ và dữ liệu chính.');
      // A deep snapshot is optional for first paint. If it fails, the core
      // snapshot remains usable; the next sync can resume.
      syncStatus('running','Đang bổ sung dữ liệu chi tiết…');
      const res=await desktopTransport('desktop/mirror/full','GET',null,180000);
      if(!res.ok)throw new Error('full mirror HTTP '+res.status);
      const payload=await res.json();
      const ec=payload&&payload.endpointCache;
      if(!payload||payload.schema!=='nah-lab-desktop-full-mirror/v1'||payload.scope!=='full'
        ||payload.userRef!==user.ref||!ec||typeof ec!=='object'||Array.isArray(ec))
        throw new Error('Full mirror không hợp lệ hoặc sai tài khoản');
      const required=['bootstrap','dashboard','dashboard/snapshot','team','roadmap'];
      for(const key of required)if(!Object.prototype.hasOwnProperty.call(ec,key)||ec[key]?.__mirror_error)
        throw new Error('Full mirror thiếu dữ liệu bắt buộc: '+key);
      const entries=[];let errors=0;
      for(const [key,value] of Object.entries(ec)){
        if(value&&value.__mirror_error){errors++;continue}
        entries.push([normalizeKey(key),value]);
      }
      // Partial mirrors cannot be silently advertised as complete.
      if(errors||entries.length!==Number(payload.endpointCount))
        throw new Error('Full mirror chưa đầy đủ ('+errors+' endpoint lỗi)');
      const now=Date.now();
      const metadata={version:payload.version||'',scope:'full',datasetVersion:manifest.datasetVersion,
        generatedAt:payload.generatedAt||'',userRef:user.ref,endpointCount:entries.length,reason,fetchedAtMs:now};
      // A user can log out or switch accounts while this long transfer runs.
      // Do not commit a snapshot from a superseded authenticated session.
      if(readToken()!==token||readSessionUser()?.ref!==user.ref)return false;
      await replaceMirror(entries,metadata);
      lastSessionSyncAt=now;
      syncStatus('complete','Đã đồng bộ dữ liệu mới nhất.');
      try{localStorage.setItem(SYNC_KEY,new Date(now).toISOString())}catch(_e){}
      window.dispatchEvent(new CustomEvent('nah-lab-desktop-sync',{detail:{ok:true,count:entries.length,reason,at:metadata.generatedAt,datasetVersion:manifest.datasetVersion}}));
      return true;
    }catch(e){
      if(readToken()===token&&readSessionUser()?.ref===user.ref){
        const last=await idbGet(STORE_META,'mirror');
        if(attemptedFull||['login','manual','reconnect'].includes(reason)||!last)
          syncStatus(coreReady?'complete':'error',coreReady
            ?'Dữ liệu chính đã sẵn sàng; chi tiết sẽ tiếp tục đồng bộ.'
            :last&&last.userRef===user.ref?'Đồng bộ chưa hoàn tất; dữ liệu đã lưu vẫn an toàn.':'Chưa tải đủ dữ liệu ngoại tuyến; có thể làm việc trực tuyến.');
      }
      window.dispatchEvent(new CustomEvent('nah-lab-desktop-sync',{detail:{ok:false,reason,error:String(e&&e.message||e)}}));
      return false;
    }finally{syncPromise=null}
  })();
  return syncPromise;
}
function scheduleSync(reason){setTimeout(()=>{void fullSync(reason)},100)}

async function handleLogin(input,init){
  if(!onlineHint())return errorResponse(503,'Máy đang ngoại tuyến. Cần kết nối Internet để đăng nhập lần đầu.','desktop_offline_login');
  const headers={'Content-Type':'text/plain;charset=UTF-8'};
  let res;try{res=await deadlineFetch(API_BASE+'desktop/auth/login',{method:'POST',headers,body:init&&init.body,credentials:'omit',cache:'no-store'},25000)}catch(_e){return errorResponse(503,'Không kết nối được máy chủ. Vui lòng thử lại khi có Internet.','desktop_network_error')}
  let data=null;try{data=await res.json()}catch(_e){}
  if(!res.ok||!data||!data.ok)return jsonResponse(data||{message:'Đăng nhập không thành công.'},res.status||401);
  saveSession(data.token||'',data.user||null,data.expiresAt||'');
  // Authentication succeeds independently of full mirror hydration. Start the
  // durable snapshot refresh in the background; navigation must never await it.
  // The workspace still fetches live REST endpoints when online. Without a
  // snapshot, offline reads will correctly report cache-miss, never fake data.
  syncStatus('running','Đang đồng bộ dữ liệu mới nhất…');
  scheduleSync('login');
  return jsonResponse({ok:true,user:data.user,handoff:'desktop-device-session-v133'},200);
}
async function handleConfirm(){const u=readSessionUser();if(!u||(!readToken()&&onlineHint()))return errorResponse(401,'Cần đăng nhập để xác nhận phiên thiết bị.','not_authenticated');return jsonResponse({ok:true,user:u,version:'1.58.52',localAccount:true,onlineSession:!!readToken()})}
async function handleLogout(){
  const token=readToken();if(token&&onlineHint()){try{await desktopTransport('desktop/auth/logout','POST',null,15000)}catch(_e){}}
  hideSyncStatus();clearSession();await idbClear(STORE_API);await idbClear(STORE_META);try{localStorage.removeItem(SYNC_KEY)}catch(_e){}setTimeout(updateOfflineAccountLabel,100);return jsonResponse({ok:true,redirect:'./index.html'});
}
async function handleBootstrap(path,input,init){
  const token=readToken(),user=readSessionUser();
  if(!user||(!token&&onlineHint()))return errorResponse(401,'Cần đăng nhập để mở dữ liệu của tài khoản trên thiết bị này.','desktop_login_required');
  let networkFailed=false;
  if(token&&onlineHint()){
    try{
      if(!syncPromise&&(!lastSessionSyncAt||Date.now()-lastSessionSyncAt>SYNC_INTERVAL_MS))scheduleSync('startup');
      const {res,data}=await remoteJson(path,init,'bootstrap');
      if(res.ok)return res;
      if(res.status===401){clearTokenKeepProfile();updateOfflineAccountLabel();}
      // Preserve server HTTP/permission errors. Never mask 403/404/500 as a
      // missing offline cache or silently return stale data for authorization errors.
      return res;
    }catch(_e){networkFailed=true}
  }
  const old=await cached('bootstrap');
  if(old!==undefined)return jsonResponse(offlineAccountBootstrap(old,user));
  return errorResponse(503,networkFailed
    ?'Không kết nối được API máy chủ. Kiểm tra kết nối đến sachyhoc.com rồi thử lại.'
    :'Chưa có bản dữ liệu được xác thực cho tài khoản này; cần đồng bộ trực tuyến lần đầu.',
    networkFailed?'desktop_network_error':'desktop_no_authenticated_mirror');
}
async function handleGet(path,input,init){
  const norm=normalizeKey(path),token=readToken();
  let networkFailed=false;
  if(token&&onlineHint()){
    try{
      const {res}=await remoteJson(path,init,norm);
      if(res.status===401){clearTokenKeepProfile();updateOfflineAccountLabel()}
      // Live server response is authoritative, including valid HTTP errors.
      // An HTTP 404 is not an offline cache miss; an HTTP 403 is not logout.
      return res;
    }catch(_e){networkFailed=true}
  }
  const v=await derivedCache(norm);if(v!==undefined)return jsonResponse(v);
  if(networkFailed)return errorResponse(503,'Không thể kết nối API máy chủ; dữ liệu phân hệ này chưa được lưu ngoại tuyến. Vui lòng thử lại.','desktop_network_error');
  if(onlineHint()&&!token)return errorResponse(401,'Phiên Desktop đã hết hiệu lực. Vui lòng đăng nhập lại.','desktop_session_expired');
  return errorResponse(503,'Phân hệ này chưa có bản sao ngoại tuyến. Khi có kết nối, dữ liệu sẽ được tải trực tiếp từ máy chủ.','desktop_cache_miss');
}
async function handleWrite(path,input,init){
  const token=readToken();if(!token)return errorResponse(401,'Cần đăng nhập để thay đổi dữ liệu.','desktop_login_required');
  if(!onlineHint())return errorResponse(503,'Đang ngoại tuyến. Thay đổi dữ liệu chỉ được ghi khi có kết nối Internet.','desktop_write_offline');
  try{
    const res=init?.body instanceof FormData
      ?await desktopUpload(path,init,token)
      :await desktopTransport(path,requestMethod(input,init),init?.body,45000,init?.signal);
    if(res.status===401){clearTokenKeepProfile();updateOfflineAccountLabel()}
    if(res.ok)scheduleSync('mutation');
    return res;
  }catch(_e){return errorResponse(503,'Không kết nối được API máy chủ; chưa ghi thay đổi. Vui lòng thử lại.','desktop_network_error')}
}

window.fetch=async function(input,init={}){
  const path=restPathFromUrl(input);if(path===null)return nativeFetch(input,init);
  const method=requestMethod(input,init),norm=normalizeKey(path),pathname=norm.split('?')[0];
  if(pathname==='auth/client-start')return jsonResponse({ok:true,clientKind:'desktop',clearedSession:false,freshLoginRequired:false,firstOnlineLoginRequired:true,sessionPolicy:'persistent-device',offlineMirror:true,desktopVersion:VERSION});
  if(pathname==='auth/login'&&method==='POST')return handleLogin(input,init);
  if(pathname==='auth/confirm'&&method==='POST')return handleConfirm();
  if(pathname==='auth/logout'&&method==='POST')return handleLogout();
  if(pathname==='bootstrap'&&method==='GET')return handleBootstrap(path,input,init);
  if(method==='GET'||method==='HEAD')return handleGet(path,input,init);
  return handleWrite(path,input,init);
};

function updateOfflineAccountLabel(){
  const btn=document.querySelector('[data-account="logout"]');if(!btn)return;
  const token=readToken(),user=readCachedUser(),online=onlineHint();
  btn.textContent=token?'Đăng xuất':user?(online?'Đăng nhập lại & đồng bộ':'Đăng xuất tài khoản cục bộ'):'Đăng nhập & đồng bộ';
  btn.classList.toggle('danger-text',!!token||(!online&&!!user));
  const role=document.getElementById('roleLabel');
  if(role&&!token&&user){const label=String(user.roleLabel||user.role_label||'Tài khoản cục bộ');role.textContent=label+' · Ngoại tuyến'}
  else if(role&&!token&&!user&&/Chỉ đọc ngoại tuyến|Đang tải quyền/.test(role.textContent||''))role.textContent='Chỉ đọc ngoại tuyến';
}
window.addEventListener('online',()=>{if(readToken())scheduleSync('reconnect')});
window.addEventListener('focus',()=>{if(readToken()&&onlineHint())scheduleSync('foreground')});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&readToken()&&onlineHint())scheduleSync('foreground')});
window.addEventListener('nah-lab-desktop-sync',()=>updateOfflineAccountLabel());
document.addEventListener('DOMContentLoaded',()=>{updateOfflineAccountLabel();bindSyncRetry();setInterval(updateOfflineAccountLabel,1500)});
setInterval(()=>{if(readToken()&&onlineHint())fullSync('periodic')},SYNC_INTERVAL_MS);
if(readToken()&&onlineHint())scheduleSync('startup');

window.NAHLAB_DESKTOP={version:VERSION,fullSync,hasSession:()=>!!readToken(),localAccount:()=>readCachedUser(),lastMirror:()=>idbGet(STORE_META,'mirror'),
  preview:async path=>{
    // Fast initial display only; pages must replace this with their live response.
    if(!readToken()||!onlineHint()||!(['knowledge/sources','document-plan/overview'].includes(path)||path.startsWith('activity?')))return undefined;
    return derivedCache(path);
  }};
})();
