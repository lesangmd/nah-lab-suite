/* NAH LAB Windows v1.3.16: online transport, nonblocking login and mirror regression tests. */
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../offline/desktop-mirror.js','utf8');
const local=new Map(),tables={api:new Map(),meta:new Map()},shortTimers=[];
function fakeIDB(){
 const db={objectStoreNames:{contains:k=>k in tables},createObjectStore(k){tables[k]=new Map()},transaction(names){
   const tx={oncomplete:null,onerror:null,onabort:null,error:null,objectStore(k){const map=tables[k];return{
      get(key){const r={};setImmediate(()=>{r.result=map.get(key);r.onsuccess?.()});return r},
      put(val,key){map.set(key,val)},clear(){map.clear()}}}};
   setImmediate(()=>tx.oncomplete?.());return tx;
 }};
 return{open(){const req={result:db};setImmediate(()=>req.onsuccess?.());return req}};
}
let online=true,remoteVersion='dataset-A',failMirror=false,holdFull=true,releaseFull,failNetwork=false,serverError=0;
const TOKEN='a'.repeat(64); const transportCalls=[];
const counter={login:0,manifest:0,full:0,bootstrap:0};
const strip={hidden:true,dataset:{phase:''},text:{textContent:''},retry:{hidden:true,addEventListener(){}},querySelector(q){return q==='[data-desktop-sync-text]'?this.text:this.retry}};
const endpointCache=()=>({bootstrap:{user:{ref:'acct-A',name:'User A'},version:'1.58.29'},dashboard:{total:3},'dashboard/snapshot':{dashboard:{total:3}},team:{members:[{id:5,status:remoteVersion}]},roadmap:{plannedMilestones:[{key:'documents',title:remoteVersion}]},'records?module=iso':[{id:1,status:remoteVersion}],'activity?limit=1000':[{created_at:'2026-10-14 08:00:00',action:'updated',module:'tasks',detail:{item:'A'}},{created_at:'2026-10-13 08:00:00',action:'created',module:'forms'}], 'knowledge/sources':{items:[{id:'s1',name:'ISO'}]}, 'document-plan/overview':{counts:{total:174},items:[]} });
async function network(url,options={}){
 if(url.endsWith('desktop/auth/login')){counter.login++;return Response.json({ok:true,token:TOKEN,user:{ref:'acct-A',csrf:'xyz'}})}
 if(url.endsWith('desktop/transport')){
  if(failNetwork)throw new TypeError('Failed to fetch');
  assert.equal(options.method,'POST');
  assert.equal(options.headers['Content-Type'],'text/plain;charset=UTF-8');
  assert.equal(Object.keys(options.headers).length,1,'transport must be CORS-simple');
  const payload=JSON.parse(options.body);
  assert.equal(payload.token,TOKEN); assert.equal(payload.csrf,'xyz');
  transportCalls.push(payload);
  const mapped='https://sachyhoc.com/wp-json/nah-iso15189/v1/'+payload.path;
  return networkRoute(mapped,payload.method);
 }
 if(options.body instanceof FormData){assert.equal(options.body.get('_nah_device_token'),TOKEN);assert.equal(options.body.get('_nah_csrf'),'xyz');return Response.json({uploaded:true})}
 return networkRoute(url,options.method||'GET');
}
async function networkRoute(url,method='GET'){
 if(serverError&&url.includes('/roadmap'))return Response.json({code:'forbidden',message:'Không có quyền xem dữ liệu',data:{status:serverError}},{status:serverError});
 if(url.endsWith('desktop/dataset/manifest')){counter.manifest++;return Response.json({schema:'nah-lab-dataset-manifest/v1',datasetVersion:remoteVersion,userRef:'acct-A'})}
 if(url.endsWith('desktop/mirror/full')){
  counter.full++;
  if(holdFull)await new Promise(resolve=>releaseFull=resolve);
  if(failMirror)return new Response('error',{status:503});
  const ec=endpointCache();return Response.json({schema:'nah-lab-desktop-full-mirror/v1',scope:'full',userRef:'acct-A',version:'1.58.29',endpointCount:Object.keys(ec).length,endpointCache:ec,generatedAt:new Date().toISOString()});
 }
 if(url.includes('/bootstrap')){counter.bootstrap++;return Response.json({user:{ref:'acct-A',name:'Tester'},version:'1.58.29'})}
 if(url.endsWith('/roadmap'))return Response.json({plannedMilestones:[{key:'a',title:remoteVersion}]});
 return Response.json({ok:true});
}
const ls={getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)};
const window={fetch:network,addEventListener(){},dispatchEvent(){},NAHLAB_DESKTOP:null};
const document={body:{appendChild(){throw new Error('Modal overlay must not be inserted')}},hidden:false,addEventListener(){},getElementById(id){return id==='desktopSyncStrip'?strip:null},querySelector(){return null}};
const ctx={window,document,localStorage:ls,navigator:{get onLine(){return online}},indexedDB:fakeIDB(),Headers,Response,FormData,URL,URLSearchParams,CustomEvent:class{constructor(n,opt){this.type=n;this.detail=opt.detail}},setInterval(){},setTimeout(fn,delay){if(delay===100)shortTimers.push(fn);return 1},clearTimeout(){},AbortController,console,Date,Promise};
window.indexedDB=ctx.indexedDB;
vm.runInNewContext(source,ctx);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function until(predicate){for(let i=0;i<40;i++){if(predicate())return;await tick()}throw new Error('Timed out waiting for async mock condition')}
async function flushScheduled(){while(shortTimers.length){const actions=shortTimers.splice(0);actions.forEach(f=>f());await tick()}}
(async()=>{
 const base='https://sachyhoc.com/wp-json/nah-iso15189/v1/';
 assert.equal(tables.api.size,0,'no factory business dataset');
 const login=await window.fetch(base+'auth/login',{method:'POST',body:'{}'});
 assert.equal(login.status,200,'authentication completes without waiting for full mirror');
 assert.equal((await login.json()).handoff,'desktop-device-session-v133');
 assert.equal(counter.full,0,'full mirror download was not awaited by login');
 assert.equal(strip.hidden,false,'thin sync strip shown');
 assert.equal(strip.dataset.phase,'running');
 const bootstrap=await window.fetch(base+'bootstrap',{method:'GET'});
 assert.equal(bootstrap.status,200,'live bootstrap is available while full mirror is pending');
 assert.equal(counter.bootstrap,1);
 assert.equal(counter.full,0,'bootstrap does not await full mirror');
 await flushScheduled();
 await until(()=>counter.full===1);
 assert.equal(tables.meta.has('mirror'),false,'full mirror still pending, login remains allowed');
 holdFull=false;releaseFull();
 await until(()=>tables.meta.has('mirror'));
 assert.equal(tables.meta.get('mirror').datasetVersion,'dataset-A');
 assert.equal(tables.api.get('roadmap').plannedMilestones[0].title,'dataset-A');
 const activityPreview=await window.NAHLAB_DESKTOP.preview('activity?limit=200&module=tasks');
 assert.equal(activityPreview.length,1,'offline mirror activity key must match activity?limit=1000');
 assert.equal(activityPreview[0].module,'tasks');
 assert.equal((await window.NAHLAB_DESKTOP.preview('knowledge/sources')).items[0].name,'ISO');
 assert.equal((await window.NAHLAB_DESKTOP.preview('document-plan/overview')).counts.total,174);
 await until(()=>strip.dataset.phase==='complete');
 online=false;
 const offline=await window.fetch(base+'roadmap');
 assert.equal((await offline.json()).plannedMilestones[0].title,'dataset-A','offline reads persist');
 online=true;
 await window.NAHLAB_DESKTOP.fullSync('periodic');
 assert.equal(counter.full,1,'unchanged manifest does not fetch mirror again');
 remoteVersion='dataset-B';await window.NAHLAB_DESKTOP.fullSync('periodic');
 assert.equal(counter.full,2);assert.equal(tables.api.get('roadmap').plannedMilestones[0].title,'dataset-B');
 remoteVersion='dataset-C';failMirror=true;
 assert.equal(await window.NAHLAB_DESKTOP.fullSync('periodic'),false,'failed sync does not force logout');
 assert.equal(tables.meta.get('mirror').datasetVersion,'dataset-B','previous snapshot stays after sync failure');
 assert.equal(strip.dataset.phase,'error','failure uses inline status not modal');
 assert.equal(strip.retry.hidden,false,'retry affordance is available');
 assert.equal(local.get('nahLabDesktopDeviceToken'),TOKEN,'failure retains authenticated session');
 serverError=403;
 const denied=await window.fetch(base+'roadmap');assert.equal(denied.status,403,'live 403 must not turn into cache miss');
 assert.equal((await denied.json()).code,'forbidden');
 serverError=0;
 const live=await window.fetch(base+'roadmap');assert.equal(live.status,200);assert.equal((await live.json()).plannedMilestones[0].title,'dataset-C','live must outrank cached dataset-B');
 assert.ok(transportCalls.some(x=>x.path==='roadmap'&&x.method==='GET'));
 assert.ok(transportCalls.some(x=>x.path==='desktop/mirror/full'));
 assert.ok(transportCalls.some(x=>x.path==='desktop/dataset/manifest'));
 const upload=await window.fetch(base+'drive/files',{method:'POST',body:(()=>{const d=new FormData();d.append('file',new Blob(['test']),'test.txt');return d})()});
 assert.equal(upload.status,200,'multipart upload remains supported');
 failNetwork=true;const cachedRoadmap=await window.fetch(base+'roadmap');assert.equal(cachedRoadmap.status,200,'cached fallback after true fetch failure');
 assert.equal((await cachedRoadmap.json()).plannedMilestones[0].title,'dataset-B','preserve previous mirror on fetch failure');
 const notCached=await window.fetch(base+'unknown-feature');assert.equal(notCached.status,503,'network failure must be 503, not offline 404');
 assert.equal((await notCached.json()).code,'desktop_network_error');
 console.log('PASS: CORS-simple online transport, live 403 handling, multipart upload, true network fallback, nonblocking login, durable offline mirror, manifest delta');
})().catch(e=>{console.error(e);process.exitCode=1});
