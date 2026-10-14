/*
 * NAH LAB SUITE Desktop v1.3.9 — full WebApp offline mirror runtime
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

const VERSION='1.3.10';
const DB_NAME='nah_lab_desktop_full_mirror_v130';
const DB_VERSION=1;
const STORE_API='api';
const STORE_META='meta';
const SYNC_INTERVAL_MS=10*60*1000;
const TOKEN_KEY='nahLabDesktopDeviceToken';
const USER_KEY='nahLabDesktopSessionUser';
const SYNC_KEY='nahLabDesktopLastSyncAt';
const API_BASE='https://sachyhoc.com/wp-json/nah-iso15189/v1/';
const FACTORY=window.NAH_DESKTOP_FACTORY||{endpointCache:{}};
const FACTORY_CACHE=FACTORY.endpointCache||{};
const nativeFetch=window.fetch.bind(window);
let syncPromise=null;
let dbPromise=null;

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
function networkInit(input,init,token){
  const out={...(init||{})};
  out.method=requestMethod(input,init);
  out.headers=cloneHeaders(input,init);
  out.credentials='omit';
  out.cache='no-store';
  if(token)out.headers.set('X-NAH-Device-Token',token);
  const u=readSessionUser();if(u&&u.csrf&&!out.headers.has('X-NAH-CSRF'))out.headers.set('X-NAH-CSRF',u.csrf);
  return out;
}
function onlineHint(){return navigator.onLine!==false}

function openDb(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    if(!('indexedDB'in window)){reject(new Error('IndexedDB unavailable'));return}
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE_API))db.createObjectStore(STORE_API);if(!db.objectStoreNames.contains(STORE_META))db.createObjectStore(STORE_META)};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('IndexedDB open failed'));
  });
  return dbPromise;
}
async function idbGet(store,key){
  try{const db=await openDb();return await new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly');const req=tx.objectStore(store).get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}catch(_e){return undefined}
}
async function idbPut(store,key,value){
  try{const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});return true}catch(_e){return false}
}
async function idbPutMany(entries){
  try{const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE_API,'readwrite');const st=tx.objectStore(STORE_API);for(const [k,v] of entries)st.put(v,k);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});return true}catch(_e){return false}
}
async function idbClear(store){
  try{const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).clear();tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});return true}catch(_e){return false}
}
async function cached(key){
  const exact=await idbGet(STORE_API,key);if(exact!==undefined)return exact;
  if(Object.prototype.hasOwnProperty.call(FACTORY_CACHE,key))return FACTORY_CACHE[key];
  return undefined;
}
async function putCached(key,value){return idbPut(STORE_API,key,value)}
function offlineBootstrap(source){
  const factory=FACTORY_CACHE.bootstrap||{};
  const base=(source&&typeof source==='object')?source:factory;
  const safeUser=(factory&&factory.user)||{id:0,ref:'desktop:offline',username:'offline',name:'Thư viện ngoại tuyến',email:'',role:'offline',roleLabel:'Chỉ đọc ngoại tuyến',caps:['access','view_all','export'],csrf:'',isWpAdmin:false};
  return {...base,user:safeUser,canManageModules:[],notifications:{...(base.notifications||{}),unread:0},drive:{...(base.drive||{}),canUpload:false}};
}
function offlineAccountBootstrap(source,user){
  const base=offlineBootstrap(source);
  const u=user||{};
  const roleLabel=String(u.roleLabel||u.role_label||'Tài khoản cục bộ');
  const safeUser={...u,roleLabel:roleLabel+' · Ngoại tuyến',role_label:roleLabel+' · Ngoại tuyến',caps:['access','view_all','export'],csrf:'',offlineLocal:true};
  return {...base,user:safeUser,canManageModules:[],notifications:{...(base.notifications||{}),unread:0},drive:{...(base.drive||{}),canUpload:false}};
}
function authBootstrap(source,user){
  const base=(source&&typeof source==='object')?source:(FACTORY_CACHE.bootstrap||{});
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
function withCurrentPlan(path, payload){
  if(!payload||typeof payload!=='object')return payload;
  const endpoint=path.split('?')[0];
  if(endpoint==='roadmap'){
    const current=FACTORY_CACHE.roadmap||{};
    return {...payload,plannedMilestones:current.plannedMilestones||[],planSource:current.planSource||''};
  }
  if(endpoint==='dashboard/snapshot'){
    const current=FACTORY_CACHE.roadmap||{};
    return {...payload,roadmap:{...(payload.roadmap||{}),plannedMilestones:current.plannedMilestones||[],planSource:current.planSource||''}};
  }
  if(endpoint==='knowledge/implementation'){
    const current=FACTORY_CACHE['knowledge/implementation']||{};
    return {...payload,plan:{...(payload.plan||{}),accreditation_milestones:current.plan?.accreditation_milestones||[]}};
  }
  if(endpoint==='document-plan/summary'||endpoint==='document-plan/overview'){
    const reference=FACTORY_CACHE['document-plan/summary']||{};
    const staticRecords=new Map((reference.items||[]).map(x=>[x.code,x]));
    const rows=Array.isArray(payload.items)?payload.items.slice():[];
    const seen=new Set();
    const items=rows.map(x=>{
      const fixed=staticRecords.get(x.code);
      seen.add(x.code);
      return fixed?.data?.supervision?{...x,data:{...(x.data||{}),supervision:fixed.data.supervision}}:x;
    });
    // Missing source-only codes are placeholders, never marked published.
    for(const record of (reference.items||[])){
      if(!seen.has(record.code)&&record.status==='new'&&record.data?.supervision)items.push(record);
    }
    return {...payload,items,counts:{...(payload.counts||{}),total:items.length},supervision_reference:reference.supervision_reference||{}};
  }
  return payload;
}
async function derivedCache(path){
  const norm=normalizeKey(path);
  let v=await cached(norm);if(v!==undefined)return withCurrentPlan(norm,v);
  const pathname=norm.split('?')[0];
  if(pathname==='dashboard/snapshot'){
    const endpoints={dashboard:'dashboard',team:'team',quality:'quality-core/summary',evidence:'evidence-control/summary',roadmap:'roadmap',cert:'cert-progress/overview',docplan:'document-plan/overview'};
    const snapshot={version:'1.58.29',offline:true};
    for(const [key,endpoint] of Object.entries(endpoints))snapshot[key]=await cached(endpoint)||{};
    return withCurrentPlan(pathname,snapshot);
  }
  if(pathname==='search')return localSearch(norm);
  if(pathname==='records'){
    const u=new URL('https://local.invalid/'+norm),module=u.searchParams.get('module')||'';
    if(module){const base=await cached('records?module='+encodeURIComponent(module));if(base!==undefined)return filterRecords(base,norm)}
    let all=[];for(const m of ['qd2429','iso','isoforms','documents','forms','tasks','projects','indicators','incidents','risks','nc','capa','audits','meetings','training','equipment','suppliers','certprogress','docplan']){const rows=await cached('records?module='+encodeURIComponent(m));if(Array.isArray(rows))all.push(...rows)}return filterRecords(all,norm);
  }
  if(pathname==='activity'){const base=await cached('activity');return filterActivity(base||[],norm)}
  if(pathname==='evidence-control/registry'){const base=await cached('evidence-control/registry');return filterRegistry(base||[],norm)}
  return undefined;
}

async function boundedFetch(input,init={},timeoutMs=15000){
  const controller=new AbortController();
  const signal=init.signal;
  const abort=()=>controller.abort();
  if(signal?.aborted)abort();
  else signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,timeoutMs);
  try{const res=await nativeFetch(input,{...init,signal:controller.signal});const bytes=await res.arrayBuffer();return new Response([204,205,304].includes(res.status)?null:bytes,{status:res.status,statusText:res.statusText,headers:res.headers})}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
}
async function remoteJson(url,init,cacheKey){
  const token=readToken();if(!token)throw new Error('not authenticated');
  const res=await boundedFetch(url,networkInit(null,init,token));
  let data=null;try{data=await res.clone().json()}catch(_e){}
  if(res.ok&&cacheKey&&data!==null)await putCached(cacheKey,data);
  return{res,data};
}
async function fullSync(reason='periodic'){
  if(syncPromise)return syncPromise;
  const token=readToken();if(!token||!onlineHint())return false;
  syncPromise=(async()=>{
    try{
      const headers=new Headers({'Accept':'application/json','Cache-Control':'no-store','X-NAH-Device-Token':token});
      const u=readSessionUser();if(u&&u.csrf)headers.set('X-NAH-CSRF',u.csrf);
      const scope=(reason==='deep')?'':'?scope=core';
      const res=await boundedFetch(API_BASE+'desktop/mirror/full'+scope,{method:'GET',headers,credentials:'omit',cache:'no-store'},45000);
      if(!res.ok)throw new Error('sync '+res.status);
      const payload=await res.json();const entries=[];
      for(const [k,v] of Object.entries(payload.endpointCache||{}))if(!(v&&v.__mirror_error))entries.push([normalizeKey(k),v]);
      if(!entries.length||!entries.some(([k])=>k==='bootstrap'))throw new Error('incomplete mirror');
      if(!(await idbPutMany(entries)))throw new Error('mirror persistence failed');
      await idbPut(STORE_META,'mirror',{version:payload.version||'',generatedAt:payload.generatedAt||new Date().toISOString(),userRef:payload.userRef||'',endpointCount:entries.length,reason});
      try{localStorage.setItem(SYNC_KEY,payload.generatedAt||new Date().toISOString())}catch(_e){}
      window.dispatchEvent(new CustomEvent('nah-lab-desktop-sync',{detail:{ok:true,count:entries.length,reason,at:payload.generatedAt||''}}));
      return true;
    }catch(e){window.dispatchEvent(new CustomEvent('nah-lab-desktop-sync',{detail:{ok:false,reason,error:String(e&&e.message||e)}}));return false}
    finally{syncPromise=null}
  })();
  return syncPromise;
}
function scheduleSync(reason){setTimeout(()=>fullSync(reason).then(ok=>{if(ok&&['startup','login','reconnect'].includes(reason))setTimeout(()=>fullSync('deep'),60000)}),100)}

async function handleLogin(input,init){
  if(!onlineHint())return errorResponse(503,'Máy đang ngoại tuyến. Cần kết nối Internet để đăng nhập lần đầu.','desktop_offline_login');
  const headers=cloneHeaders(input,init);headers.set('Accept','application/json');headers.set('Content-Type','application/json');headers.set('Cache-Control','no-store');
  let res;try{res=await nativeFetch(API_BASE+'desktop/auth/login',{method:'POST',headers,body:init&&init.body,credentials:'omit',cache:'no-store'})}catch(_e){return errorResponse(503,'Không kết nối được máy chủ. Vui lòng thử lại khi có Internet.','desktop_network_error')}
  let data=null;try{data=await res.json()}catch(_e){}
  if(!res.ok||!data||!data.ok)return jsonResponse(data||{message:'Đăng nhập không thành công.'},res.status||401);
  saveSession(data.token||'',data.user||null,data.expiresAt||'');
  await putCached('desktop/session-user',data.user||null);
  scheduleSync('login');
  return jsonResponse({ok:true,user:data.user,handoff:'desktop-device-session-v132'},200);
}
async function handleConfirm(){const u=readSessionUser();if(!u||(!readToken()&&onlineHint()))return errorResponse(401,'Cần đăng nhập để xác nhận phiên thiết bị.','not_authenticated');return jsonResponse({ok:true,user:u,version:'1.58.29',localAccount:true,onlineSession:!!readToken()})}
async function handleLogout(){
  const token=readToken();if(token&&onlineHint()){try{const h=new Headers({'Accept':'application/json','X-NAH-Device-Token':token});const u=readSessionUser();if(u&&u.csrf)h.set('X-NAH-CSRF',u.csrf);await nativeFetch(API_BASE+'desktop/auth/logout',{method:'POST',headers:h,credentials:'omit',cache:'no-store'})}catch(_e){}}
  clearSession();await idbClear(STORE_API);await idbClear(STORE_META);try{localStorage.removeItem(SYNC_KEY)}catch(_e){}setTimeout(updateOfflineAccountLabel,100);return jsonResponse({ok:true,redirect:'./index.html'});
}
async function handleBootstrap(path,input,init){
  const token=readToken(),user=readSessionUser();
  // A factory catalog is not an authenticated account. A moved or newly installed
  // portable bundle must show the login view instead of a guest "offline library".
  if(!user||(!token&&onlineHint()))return errorResponse(401,'Cần đăng nhập để mở dữ liệu của tài khoản trên thiết bị này.','desktop_login_required');
  if(token&&onlineHint()){
    try{
      const {res,data}=await remoteJson(API_BASE+path,init,'bootstrap');
      if(res.ok&&data)return jsonResponse(data,res.status);
      if(res.status===401||res.status===403){clearTokenKeepProfile();return errorResponse(401,'Phiên thiết bị đã hết hiệu lực. Vui lòng đăng nhập lại.','desktop_session_expired')}
    }catch(_e){} // A network failure may use the enrolled account's read mirror.
  }
  const old=await cached('bootstrap');return jsonResponse(offlineAccountBootstrap(old,user));
}
async function handleGet(path,input,init){
  const norm=normalizeKey(path),token=readToken();
  if(token&&onlineHint()){
    try{
      const {res,data}=await remoteJson(API_BASE+path,init,norm);
      if(res.ok&&data!==null)return jsonResponse(data,res.status);
      if(res.status===401||res.status===403){clearTokenKeepProfile();updateOfflineAccountLabel();return errorResponse(401,'Phiên thiết bị đã hết hiệu lực. Vui lòng đăng nhập lại.','desktop_session_expired')}
    }catch(_e){}
  }
  const v=await derivedCache(norm);if(v!==undefined)return jsonResponse(v);
  return errorResponse(404,'Nội dung này chưa có trong bản sao ngoại tuyến. Hãy kết nối Internet và đồng bộ một lần để sử dụng ngoại tuyến.','desktop_cache_miss');
}
async function handleWrite(path,input,init){
  const token=readToken();if(!token)return errorResponse(401,'Cần đăng nhập và có kết nối Internet để thay đổi dữ liệu. Dữ liệu ngoại tuyến hiện ở chế độ chỉ đọc.','desktop_login_required');
  if(!onlineHint())return errorResponse(503,'Đang ngoại tuyến. Để bảo toàn tính nhất quán giữa các máy, thay đổi dữ liệu chỉ được ghi khi có kết nối Internet.','desktop_write_offline');
  try{
    const res=await nativeFetch(API_BASE+path,networkInit(input,init,token));
    if(res.ok)scheduleSync('mutation');
    return res;
  }catch(_e){return errorResponse(503,'Không kết nối được máy chủ; chưa ghi thay đổi.','desktop_network_error')}
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
window.addEventListener('nah-lab-desktop-sync',()=>updateOfflineAccountLabel());
document.addEventListener('DOMContentLoaded',()=>{updateOfflineAccountLabel();setInterval(updateOfflineAccountLabel,1500)});
setInterval(()=>{if(readToken()&&onlineHint())fullSync('periodic')},SYNC_INTERVAL_MS);
if(readToken()&&onlineHint())scheduleSync('startup');

window.NAHLAB_DESKTOP={version:VERSION,fullSync,hasSession:()=>!!readToken(),localAccount:()=>readCachedUser(),lastMirror:()=>idbGet(STORE_META,'mirror')};
})();
