/* NAH LAB SUITE Windows: encrypted offline form outbox (v1.3.23).
 * This layer wraps only the form-reports API. Chat remains online-only.
 * A non-extractable AES-GCM key is persisted by Chromium in the user's
 * WebView2 profile. Windows profile protection is still required.
 */
(function(){
'use strict';
if (!window.NAHLAB_DESKTOP || !window.indexedDB || !window.crypto?.subtle) {
  // Fail closed: never silently treat a failed local save as committed.
  return;
}
const upstream=window.fetch.bind(window);
const ROOT='/wp-json/nah-iso15189/v1/';
const DB='nah_lab_windows_form_outbox_v1';
const V=1;
const PENDING='pending';const DETAILS='details';const META='meta';
const RETRY_MS=30000;
let dbOpen=null, flushing=null, contractAt=0;
const account=()=>window.NAHLAB_DESKTOP?.localAccount()?.ref||'';
const active=()=>!!window.NAHLAB_DESKTOP?.hasSession?.();
const uuid=()=>crypto.randomUUID?crypto.randomUUID().replace(/-/g,''):Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
const json=(d,status=200)=>new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store'}});
const offlineError=(msg,code='desktop_offline')=>json({code,message:msg,data:{status:503}},503);
function apiPath(url){const raw=typeof url==='string'?url:String(url?.url||url||'');const i=raw.indexOf(ROOT);return i<0?null:raw.substring(i+ROOT.length).split('?')[0];}
function open(){if(dbOpen)return dbOpen;dbOpen=new Promise((yes,no)=>{const req=indexedDB.open(DB,V);
 req.onupgradeneeded=()=>{const d=req.result;for(const st of [PENDING,DETAILS,META])if(!d.objectStoreNames.contains(st))d.createObjectStore(st)};
 req.onerror=()=>no(req.error||new Error('Không thể mở kho lưu báo cáo.'));req.onsuccess=()=>yes(req.result);
}).catch(e=>{dbOpen=null;throw e});return dbOpen}
async function dbRead(store,key){const db=await open();return new Promise((yes,no)=>{const tx=db.transaction(store,'readonly'),r=tx.objectStore(store).get(key);r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error);});}
async function dbAll(store){const db=await open();return new Promise((yes,no)=>{const tx=db.transaction(store,'readonly'),r=tx.objectStore(store).getAll();r.onsuccess=()=>yes(r.result||[]);r.onerror=()=>no(r.error);});}
async function dbWrite(store,key,value){const db=await open();return new Promise((yes,no)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value,key);tx.oncomplete=()=>yes(true);tx.onerror=()=>no(tx.error);tx.onabort=()=>no(tx.error);});}
async function dbRemove(store,key){const db=await open();return new Promise((yes,no)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(key);tx.oncomplete=()=>yes(true);tx.onerror=()=>no(tx.error);tx.onabort=()=>no(tx.error);});}
async function keyFor(ref){if(!ref)throw new Error('Cần đăng nhập một lần khi trực tuyến để dùng biểu mẫu ngoại tuyến.');
 let key=await dbRead(META,'key:'+ref);if(key)return key;
 key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 // Non-extractable key remains in the Windows WebView2 user profile.
 await dbWrite(META,'key:'+ref,key);return key;
}
async function seal(ref,data){const iv=crypto.getRandomValues(new Uint8Array(12)),key=await keyFor(ref),bytes=new TextEncoder().encode(JSON.stringify(data));
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(ref)},key,bytes);
 return {ref,iv:Array.from(iv),cipher:Array.from(new Uint8Array(cipher))};
}
async function unseal(wrapped,ref){if(!wrapped||wrapped.ref!==ref)throw new Error('Bản ghi không thuộc tài khoản đang mở.');
 const key=await keyFor(ref),bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(wrapped.iv),additionalData:new TextEncoder().encode(ref)},key,new Uint8Array(wrapped.cipher));
 return JSON.parse(new TextDecoder().decode(bytes));
}
async function readItem(store,id,ref){const entry=await dbRead(store,ref+':'+id);return entry?unseal(entry,ref):null;}
async function writeItem(store,id,ref,data){await dbWrite(store,ref+':'+id,await seal(ref,data));}
async function listItems(store,ref){const out=[];for(const w of await dbAll(store))if(w?.ref===ref){try{out.push(await unseal(w,ref))}catch(_e){/* never leak corrupted or other user's data */}}
 return out;
}
async function queuePending(ref,payload,existing=null){
 if(!ref)throw new Error('Không có tài khoản cục bộ đã xác thực.');
 if(!payload.client_uid && !existing?.client_uid)payload.client_uid=uuid();
 const uid=existing?.client_uid||payload.client_uid;
 if(!/^[A-Za-z0-9_-]{16,64}$/.test(uid))throw new Error('Mã báo cáo ngoại tuyến không hợp lệ.');
 const item={...(existing||{}),client_uid:uid,owner_ref:ref,template_id:payload.template_id||existing?.template_id,
  payload:{...payload,client_uid:uid},saved_at:new Date().toISOString(),state:'pending',error:''};
 if(existing?.server_id)item.server_id=existing.server_id;
 else if(existing?.id&&Number.isInteger(+existing.id)&&+existing.id>0)item.server_id=+existing.id;
 item.id=item.server_id||'offline_'+uid;
 await writeItem(PENDING,uid,ref,item);
 notify();
 return {...item.payload,id:item.id,client_uid:uid,owner_ref:ref,revision:existing?.revision||payload.revision||0,
  status:payload.status||'draft',title:payload.title||'',report:{values:payload.values||{},rows:payload.rows||[]},
  shared_refs:payload.shared_refs||[],offlineQueued:true,updated_at:item.saved_at};
}
async function pendingById(id,ref){for(const item of await listItems(PENDING,ref))if(String(item.id)===String(id)||String(item.server_id)===String(id))return item;return null}
async function cacheReport(ref,obj){if(!obj||!obj.id)return;await writeItem(DETAILS,'item:'+obj.id,ref,obj);if(obj.client_uid)await writeItem(DETAILS,'uid:'+obj.client_uid,ref,obj)}
async function cacheList(ref,list){if(Array.isArray(list))await writeItem(DETAILS,'list',ref,list)}
function display(item){return {id:item.id,client_uid:item.client_uid,template_id:item.template_id||item.payload.template_id,
  title:item.payload.title||'',status:item.payload.status||'draft',revision:item.payload.revision||0,
  owner_ref:item.owner_ref,shared_refs:item.payload.shared_refs||[],updated_at:item.saved_at,
  report:{values:item.payload.values||{},rows:item.payload.rows||[]},offlineQueued:true,
  syncError:item.state==='conflict'||item.state==='rejected'?item.error:''};}
function info(message,phase){const bar=document.querySelector('#desktopSyncStrip');if(!bar)return;bar.hidden=false;bar.dataset.phase=phase||'running';const label=bar.querySelector('[data-desktop-sync-text]');if(label)label.textContent=message;}
async function notify(){try{const ref=account();if(!ref)return;const pending=await listItems(PENDING,ref),blocked=pending.filter(x=>x.state==='conflict'||x.state==='rejected');
 let badge=document.getElementById('nahFormOutboxBadge');
 if(!badge&&document.body){badge=document.createElement('div');badge.id='nahFormOutboxBadge';badge.className='nah-form-outbox-badge';badge.setAttribute('role','status');badge.setAttribute('aria-live','polite');document.body.appendChild(badge)}
 if(badge){badge.hidden=pending.length===0;badge.dataset.error=blocked.length?'1':'0';badge.replaceChildren();
  if(pending.length){const label=document.createElement('span');label.textContent=blocked.length
    ?`${pending.length} báo cáo chưa đồng bộ · ${blocked.length} cần xử lý`:`${pending.length} báo cáo đang chờ đồng bộ`;
   badge.appendChild(label);const action=document.createElement('button');action.type='button';action.textContent='Đồng bộ';action.disabled=!navigator.onLine||!active()||blocked.length===pending.length;action.onclick=()=>{void flush()};badge.appendChild(action)}}
 if(pending.length)info(`${pending.length} báo cáo lưu trên máy, chưa đồng bộ`+(blocked.length?` · ${blocked.length} cần kiểm tra xung đột`:'')+'.',blocked.length?'error':'running');
 window.dispatchEvent(new CustomEvent('nah-forms-outbox',{detail:{pending:pending.length,blocked:blocked.length}}));
 }catch(_e){}
}
async function remote(input,init){return upstream(input,init)}
function transient(code,status){return status===503&&['desktop_offline','desktop_write_offline','desktop_network_error'].includes(code)}
async function readJson(r){try{return await r.clone().json()}catch(_e){return {}}}
async function requestForm(path,method,input,init){
 const ref=account();if(!ref)return upstream(input,init);
 const match=path.match(/^form-reports(?:\/(offline_[A-Za-z0-9_-]+|\d+))?$/);
 if(!match)return upstream(input,init);
 let id=match[1]||'';let forwardedInput=input;
 if(method==='GET'){
  if(id.startsWith('offline_')){const pending=await pendingById(id,ref);if(pending)return json(display(pending));const mapped=await readItem(DETAILS,'uid:'+id.slice(8),ref);return mapped?json(mapped):json({code:'not_found',message:'Không tìm thấy báo cáo lưu cục bộ.'},404)}
  const queued=id?await pendingById(id,ref):null;
  if(!navigator.onLine){
   if(id){if(queued)return json(display(queued));const d=await readItem(DETAILS,'item:'+id,ref);return d?json({...d,offlineCached:true}):offlineError('Báo cáo chưa được tải xuống trên máy; cần kết nối mạng để mở lần đầu.','desktop_cache_miss')}
   const stored=await readItem(DETAILS,'list',ref)||[];const locals=(await listItems(PENDING,ref)).map(display);return json([...locals,...stored.filter(x=>!locals.some(y=>String(y.id)===String(x.id)))]);
  }
  let response;try{response=await remote(input,init)}catch(_e){response=offlineError('Không kết nối máy chủ.','desktop_network_error')}
  if(response.ok){const data=await readJson(response);if(id){await cacheReport(ref,data);return queued?json(display(queued)):response}
   await cacheList(ref,data);const locals=(await listItems(PENDING,ref)).map(display);return json([...locals,...(Array.isArray(data)?data:[]).filter(x=>!locals.some(y=>String(y.id)===String(x.id)))])}
  const error=await readJson(response);
  if(transient(error.code,response.status)){
   if(id){if(queued)return json(display(queued));const d=await readItem(DETAILS,'item:'+id,ref);return d?json({...d,offlineCached:true}):response}
   const stored=await readItem(DETAILS,'list',ref)||[];return json([...(await listItems(PENDING,ref)).map(display),...stored]);
  }
  return response;
 }
 if(!['POST','PUT'].includes(method))return upstream(input,init);
 let body;try{body=JSON.parse(init?.body||'{}')}catch(_e){return json({code:'bad_json',message:'Dữ liệu báo cáo không hợp lệ.'},400)}
 if(!body||!body.template_id && !id)return json({code:'bad_template',message:'Chưa chọn biểu mẫu.'},400);
 const existing=id?await pendingById(id,ref):null;
 // The report may have finished syncing while its original editor stayed open.
 // Resolve the local draft ID to the confirmed server ID without guessing revisions.
 if(id.startsWith('offline_')&&!existing){
   const mapped=await readItem(DETAILS,'uid:'+id.slice(8),ref);
   if(!mapped)return json({code:'not_found',message:'Không tìm thấy báo cáo đã đồng bộ; vui lòng mở lại từ danh sách.'},404);
   id=String(mapped.id);forwardedInput='https://sachyhoc.com'+ROOT+'form-reports/'+id;
   body.client_uid=mapped.client_uid;body.revision=mapped.revision;
 }
 if(existing){
  const updated=await queuePending(ref,{...existing.payload,...body,template_id:existing.template_id,client_uid:existing.client_uid},existing);
  if(active()&&navigator.onLine)void flush();return json(updated,200);
 }
 if(id.startsWith('offline_'))return json({code:'not_found',message:'Không tìm thấy bản nháp cục bộ.'},404);
 if(!body.client_uid)body.client_uid=uuid();
 const contract=navigator.onLine&&active()?await serverReady():'unreachable';
 if(contract==='incompatible')return json({code:'server_version_unsupported',message:'Cần cập nhật WebApp v1.58.50 để đồng bộ an toàn. Báo cáo chưa được gửi.',data:{status:426}},426);
 if(contract==='unreachable'&&navigator.onLine&&active())return json(await queuePending(ref,body,id?{id:+id,server_id:+id,revision:body.revision,client_uid:body.client_uid}:null),202);
 if(!navigator.onLine||!active()){
  if(!active()&&navigator.onLine)return json({code:'desktop_login_required',message:'Cần đăng nhập để tiếp tục đồng bộ.'},401);
  const queued=await queuePending(ref,body,id?{id:+id,server_id:+id,revision:body.revision,client_uid:body.client_uid}:null);
  return json(queued,202);
 }
 let response;
 try{
  response=await remote(forwardedInput,{...init,body:JSON.stringify(body)});
  if(response.ok){const saved=await readJson(response);await cacheReport(ref,saved);return response}
 }catch(_e){response=offlineError('Mạng gián đoạn khi lưu báo cáo.','desktop_network_error')}
 const err=await readJson(response);
 if(transient(err.code,response.status)){
  const queued=await queuePending(ref,body,id?{id:+id,server_id:+id,revision:body.revision,client_uid:body.client_uid}:null);
  return json(queued,202);
 }
 return response;
}
async function serverReady(){
 if(Date.now()-contractAt<60000)return 'ready';
 try{
  const r=await remote('https://sachyhoc.com'+ROOT+'health',{method:'GET'});
  if(!r.ok)return 'unreachable';
  const data=await readJson(r),parts=String(data.version||'0').split('.').map(Number);
  if(parts[0]>1||(parts[0]===1&&(parts[1]>58||(parts[1]===58&&parts[2]>=50)))){
    contractAt=Date.now();return 'ready';
  }
  info('Máy chủ cần nâng cấp WebApp lên v1.58.50 để đồng bộ an toàn; báo cáo đã lưu vẫn ở trên máy.','error');
  return 'incompatible';
 }catch(_e){return 'unreachable'}
}

async function flush(){if(flushing||!active()||!navigator.onLine)return flushing;
 flushing=(async()=>{const ref=account();if(!ref)return;
  const all=(await listItems(PENDING,ref)).filter(x=>x.state==='pending').sort((a,b)=>a.saved_at.localeCompare(b.saved_at));
  if(!all.length || (await serverReady())!=='ready')return;
  for(const item of all){if(!active()||account()!==ref||!navigator.onLine)break;
    const url='https://sachyhoc.com'+ROOT+'form-reports'+(item.server_id?'/'+item.server_id:'');
    const init={method:item.server_id?'PUT':'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},body:JSON.stringify({...item.payload,revision:item.payload.revision||item.revision||0})};
    let r;try{r=await remote(url,init)}catch(_e){break}
    const data=await readJson(r);
    if(r.ok){
      const latest=await readItem(PENDING,item.client_uid,ref);if(!latest)continue;
      await cacheReport(ref,data);
      if(latest.saved_at===item.saved_at){await dbRemove(PENDING,ref+':'+item.client_uid)}
      else{
        // User edited while syncing: retain the newer entry and send it as PUT next time.
        latest.server_id=+data.id;latest.id=+data.id;latest.payload.revision=+data.revision;
        await writeItem(PENDING,item.client_uid,ref,latest);
      }
    }else if([401,403].includes(r.status)){info('Cần đăng nhập lại và kiểm tra quyền trước khi đồng bộ báo cáo.','error');break}
    else if([409,400,404].includes(r.status)){
      const latest=await readItem(PENDING,item.client_uid,ref);
      if(latest&&latest.saved_at===item.saved_at){latest.state=r.status===409?'conflict':'rejected';latest.error=data.message||`Lỗi ${r.status}`;await writeItem(PENDING,item.client_uid,ref,latest)}
    }else break;
  }
  await notify();
 })().finally(()=>{flushing=null});return flushing;
}
window.fetch=async function(input,init={}){
 const path=apiPath(input);if(path===null)return upstream(input,init);
 const method=String(init?.method||input?.method||'GET').toUpperCase();
 const match=path.match(/^form-reports(?:\/.*)?$/);
 if(match){try{return await requestForm(path,method,input,init)}catch(e){return json({code:'desktop_local_save_failed',message:'Không thể lưu báo cáo trên máy: '+String(e?.message||e)},507)}}
 if(path==='auth/logout'&&method==='POST'){
  const ref=account();const count=ref?(await listItems(PENDING,ref)).length:0;
  if(count)return json({code:'outbox_not_empty',message:`Còn ${count} báo cáo chưa đồng bộ. Hãy kết nối mạng và hoàn tất đồng bộ trước khi đăng xuất.`,data:{status:409}},409);
 }
 return upstream(input,init);
};
window.addEventListener('online',()=>setTimeout(()=>{void flush()},1500));
window.addEventListener('focus',()=>{void flush()});
window.addEventListener('nah-lab-desktop-sync',()=>{void flush()});
setInterval(()=>{void flush()},RETRY_MS);
setTimeout(()=>{void notify();void flush()},3200);
window.NAHLAB_FORM_OUTBOX={flush,pending:async()=>listItems(PENDING,account()),status:notify};
})();
