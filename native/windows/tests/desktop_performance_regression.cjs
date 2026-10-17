const fs=require('fs'),vm=require('vm'),assert=require('assert');
const app=fs.readFileSync(__dirname+'/../offline/assets/app.js','utf8');
function extract(name,next){const start=app.indexOf(name);assert(start>=0,name);const end=app.indexOf(next,start+name.length);assert(end>start,next);return app.slice(start,end)}
const activity=extract('async function renderActivity(){','async function refreshAdminDirectoryState()');
function deferred(){let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j});return{promise,resolve,reject}}
function elements(){
 const fields={module:{value:''},action:{value:''},from:{value:''},to:{value:''}};
 const all={};
 const create=id=>({id,isConnected:true,innerHTML:'',textContent:'',hidden:false,onclick:null,onsubmit:null,querySelector:q=>all[q.slice(1)]||null});
 for(const name of ['content','activityTbody','activityCount','activityFilter','activityExport','activityPdf','activityDocx','activityMore'])all[name]=create(name);
 all.activityFilter.elements=fields;
 const content=all.content;
 Object.defineProperty(content,'innerHTML',{get(){return this._html||''},set(v){this._html=v;all.activityExport.isConnected=true;}});
 return {all,$:q=>all[q.slice(1)]||null};
}
async function testActivityNormal(){
 const {all,$}=elements(),calls=[],d=deferred();const state={module:'activity',renderSeq:7};
 const ctx={URLSearchParams,Date,Promise,state,$,window:{},moduleMeta:{tasks:{label:'Công việc'}},actionLabels:{updated:'Cập nhật'},
 esc:x=>String(x??''),fmtDateTime:x=>String(x),activityDetailText:()=>'',api:async path=>{calls.push(path);return calls.length===1?d.promise:[{created_at:'2',action:'updated',module:'tasks',record_id:'2'}]},exportElementPdf:()=>{},exportElementDocx:()=>{}};
 vm.createContext(ctx);vm.runInContext(activity+'; globalThis.testRender=renderActivity;',ctx);const pending=ctx.testRender();
 assert(calls.length===1 && calls[0]==='activity?limit=200');
 assert(all.activityTbody.innerHTML.includes('Đang tải'));
 d.resolve([{created_at:'1',action:'updated',module:'tasks',record_id:'1'}]);await pending;
 assert(all.activityTbody.innerHTML.includes('Cập nhật') && all.activityCount.textContent==='1 sự kiện');
 const next=ctx.testRender();await next;
 assert(calls.length===2);
 return 'activity 200-row initial response + DOM updates';
}
async function testNavigationRace(){
 const {all,$}=elements(),d=deferred(),state={module:'activity',renderSeq:7};
 const ctx={URLSearchParams,Date,Promise,state,$,window:{},moduleMeta:{},actionLabels:{},esc:x=>String(x??''),fmtDateTime:x=>String(x),activityDetailText:()=>'',api:()=>d.promise,exportElementPdf:()=>{},exportElementDocx:()=>{}};
 vm.createContext(ctx);vm.runInContext(activity+'; globalThis.testRender=renderActivity;',ctx);
 const p=ctx.testRender();state.module='toolkit';state.renderSeq=8;all.activityExport.isConnected=false;d.resolve([{created_at:'1'}]);await p;
 assert(!all.activityTbody.innerHTML.includes('<tr><td>1'), 'stale UI overwritten');
 return 'activity stale response ignored after route change';
}
async function testOutOfOrderFilters(){
 const {all,$}=elements(),one=deferred(),two=deferred(),state={module:'activity',renderSeq:1};let count=0;
 const ctx={URLSearchParams,Date,Promise,state,$,window:{},moduleMeta:{},actionLabels:{},esc:x=>String(x??''),fmtDateTime:x=>String(x),activityDetailText:()=>'',api:()=>++count===1?one.promise:two.promise,exportElementPdf:()=>{},exportElementDocx:()=>{}};
 vm.createContext(ctx);vm.runInContext(activity+'; globalThis.testRender=renderActivity;',ctx);
 const p=ctx.testRender();all.activityFilter.onsubmit({preventDefault(){}});two.resolve([{created_at:'NEW'}]);await new Promise(setImmediate);one.resolve([{created_at:'OLD'}]);await p;
 assert(all.activityTbody.innerHTML.includes('NEW')&&!all.activityTbody.innerHTML.includes('OLD'));
 return 'activity overlapping filter responses ordered';
}
async function testToolKitRace(){
 const wrap=extract('async function renderToolkit(force=false){','function renderToolkitData(data){');
 const live=deferred(),state={module:'toolkit',renderSeq:3};let renders=0;
 const ctx={state,window:{NAHLAB_DESKTOP:{preview:async()=>({items:[{id:1}]})}},api:()=>live.promise,renderToolkitData:()=>{renders++},$:(s)=>({insertAdjacentHTML(){}})};
 vm.createContext(ctx);vm.runInContext(wrap+'; globalThis.testRender=renderToolkit;',ctx);
 const p=ctx.testRender();await new Promise(setImmediate);assert(renders===1,'fast preview');state.renderSeq=4;state.module='activity';live.resolve({items:[{id:2}]});await p;assert(renders===1,'stale server response ignored');
 return 'toolkit preview visible, late server response ignored';
}
async function testDocplanPreview(){
 const wrap=extract('async function renderDocumentPlan(){','function certProgressInfoHtml(');
 const live=deferred(),state={module:'docplan',renderSeq:3,docplanCache:null};const calls=[];
 const ctx={state,window:{NAHLAB_DESKTOP:{preview:async()=>({items:[],counts:{total:3}})}},api:()=>live.promise,renderDocumentPlanData:(x,opts)=>{calls.push([x.counts.total,opts?.driveLoading])},toast:()=>{}};
 vm.createContext(ctx);vm.runInContext(wrap+'; globalThis.testRender=renderDocumentPlan;',ctx);
 const p=ctx.testRender();await new Promise(setImmediate);assert(calls[0][0]===3&&calls[0][1]===true);
 live.resolve({items:[],counts:{total:5}});await p;assert(calls[1][0]===5&&calls[1][1]===undefined);
 return 'document plan snapshot then canonical server refresh';
}
async function testRenderTimerDoesNotEraseContent(){
 const render=extract('async function render(){','function enhanceResponsiveTables(){');
 const state={module:'activity',renderSeq:0},pending=deferred(),timers=[];
 const content={innerHTML:'old view'};
 const ctx={state,$:()=>content,setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout:()=>{},enhanceResponsiveTables:()=>{},renderActivity:()=>{content.innerHTML='<table id="activityTbody"></table>';return pending.promise;},esc:x=>x};
 vm.createContext(ctx);vm.runInContext(render+';globalThis.testRender=render;',ctx);
 const p=ctx.testRender();assert.equal(timers.length,1);
 timers[0]();assert.equal(content.innerHTML,'<table id="activityTbody"></table>','loading timer must not destroy an already rendered DOM');
 pending.resolve();await p;
 return 'global loading timer preserves progressive rendered UI';
}
async function testStaleErrorCannotDestroyNewView(){
 const render=extract('async function render(){','function enhanceResponsiveTables(){');
 const state={module:'activity',renderSeq:0},pending=deferred();
 const content={innerHTML:'old'};
 const ctx={state,$:()=>content,setTimeout:()=>1,clearTimeout:()=>{},enhanceResponsiveTables:()=>{},renderActivity:()=>pending.promise,esc:x=>x};
 vm.createContext(ctx);vm.runInContext(render+';globalThis.testRender=render;',ctx);
 const p=ctx.testRender();state.module='toolkit';state.renderSeq++;content.innerHTML='<div>NEW VIEW</div>';pending.reject(new Error('old request'));
 await p;assert.equal(content.innerHTML,'<div>NEW VIEW</div>','stale error clobbered new view');
 return 'stale errors cannot overwrite newer routes';
}
async function main(){for(const test of [testActivityNormal,testNavigationRace,testOutOfOrderFilters,testToolKitRace,testDocplanPreview,testRenderTimerDoesNotEraseContent,testStaleErrorCannotDestroyNewView]) console.log('PASS',await test());}
main().catch(e=>{console.error(e);process.exit(1)});
