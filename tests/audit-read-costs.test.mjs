import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';

const sources = await Promise.all(['AuditTab','StoresTab'].map(name => fs.readFile(new URL(`../admin/tabs/${name}.js`,import.meta.url),'utf8')));
function harness(kind) {
  const name = kind === 0 ? 'AuditTab' : 'StoresTab';
  const source = sources[kind].replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm,'').replace(`export class ${name}`,`class ${name}`);
  let company = 'a'; const reads = []; const pending = [];
  const globals = { BaseTab:class{}, db:{}, console:{error(){},warn(){}}, getCurrentCompanyId:()=>company, getSelectedCompanyId:()=>company, matchesCompanyId:()=>true,
    collection:(_,name)=>({name}), where:(...args)=>({where:args}), orderBy:(...args)=>({orderBy:args}),limit:n=>({limit:n}),query:(ref,...constraints)=>({...ref,constraints}),
    getDocs:q=>{reads.push(q);return new Promise((resolve,reject)=>pending.push({resolve,reject}));} };
  const Class = new Function(...Object.keys(globals),`${source}\nreturn ${name};`)(...Object.values(globals));
  const tab = Object.create(Class.prototype); const element = {innerHTML:''};
  Object.assign(tab,{isActive:true,token:1,list:element,activityTimeline:element,getActivityToken(){return this.token;},isActivityCurrent(token){return this.isActive && token===this.token;}});
  return {tab,element,reads,pending,load:()=>kind===0?tab.loadLogs():tab.loadStoreActivityTimeline(),switchStore(){company='b';tab.token++;}};
}
for (const [kind,name,size] of [[0,'Audit',50],[1,'Stores activity',12]]) {
  test(`${name} coalesces requests and only queries ordered limited store logs`,async()=>{
    const h=harness(kind); const a=h.load(),b=h.load(); assert.equal(h.reads.length,1);
    assert.deepEqual(h.reads[0],{name:'audit_logs',constraints:[{where:['companyId','==','a']},{orderBy:['timestamp','desc']},{limit:size}]});
    h.pending[0].resolve({docs:[]});await Promise.all([a,b]);assert.match(h.element.innerHTML,/No (logs|activity)/);
  });
  test(`${name} missing index never falls back and allows visible-error retry`,async()=>{
    const h=harness(kind);const a=h.load();h.pending[0].reject(new Error('requires an index'));await a;
    assert.equal(h.reads.length,1);assert.match(h.element.innerHTML,/Refresh to retry/);
    const b=h.load();assert.equal(h.reads.length,2);h.pending[1].resolve({docs:[]});await b;
  });
  test(`${name} stale store result cannot overwrite current pending request`,async()=>{
    const h=harness(kind);const a=h.load();h.switchStore();const b=h.load();const loading=h.element.innerHTML;
    h.pending[0].resolve({docs:[]});await a;assert.equal(h.element.innerHTML,loading);
    const c=h.load();assert.equal(h.reads.length,2);h.pending[1].resolve({docs:[]});await Promise.all([b,c]);
  });
  test(`${name} hidden tabs do no work and ignore in-flight errors`,async()=>{
    const h=harness(kind);const a=h.load();h.tab.isActive=false;h.element.innerHTML='hidden';h.pending[0].reject(new Error('offline'));await a;
    await h.load();assert.equal(h.reads.length,1);assert.equal(h.element.innerHTML,'hidden');
  });
}
test('audit fix cache bumps entry and both changed tabs without replacing Analytics guard',async()=>{
  const html=await fs.readFile(new URL('../admin/admin.html',import.meta.url),'utf8');
  const js=await fs.readFile(new URL('../admin/admin.js',import.meta.url),'utf8');
  assert(html.includes('/admin/admin.js?v=3.32-audit-counts'));
  assert(js.includes('./tabs/AuditTab.js?v=3.32-audit-counts'));
  assert(js.includes('./tabs/StoresTab.js?v=3.32-audit-counts'));
  assert(js.includes('./tabs/AnalyticsTab.js?v=3.31-costguard'));
});
