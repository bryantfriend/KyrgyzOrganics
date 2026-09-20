// Explicit live smoke test: isolated users/codes, cleaned up in finally; no emails sent.
const {execFileSync}=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const token=execFileSync('C:/Users/Bryant/google-cloud-sdk/bin/gcloud.cmd',['auth','print-access-token'],{encoding:'utf8',shell:true}).trim();
const project='oa-kyrgyz-organic',apiKey='AIzaSyB2azgMx3VRCqKTVj4zhdqv51o6w1cAtxI';
const root='stores/kyrgyz-organics/games/hamster-spin',db=`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`,prefix=`projects/${project}/databases/(default)/documents/`,users=[],batches=[];
const enc=v=>v===null?{nullValue:null}:typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?{integerValue:String(v)}:typeof v==='string'?{stringValue:v}:Array.isArray(v)?{arrayValue:{values:v.map(enc)}}:{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,n])=>[k,enc(n)]))}};
const dec=v=>v.stringValue??(v.integerValue!==undefined?Number(v.integerValue):v.doubleValue??v.booleanValue??(v.mapValue?Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,n])=>[k,dec(n)])):v.arrayValue?(v.arrayValue.values||[]).map(dec):null));
const data=d=>Object.fromEntries(Object.entries(d.fields||{}).map(([k,v])=>[k,dec(v)]));
async function req(url,{auth=token,body,method=body?'POST':'GET',allow=[]}={}){const r=await fetch(url,{method,headers:{...(auth?{Authorization:`Bearer ${auth}`}:{'x-goog-api-key':apiKey}),'Content-Type':'application/json',...(auth===token?{'x-goog-user-project':project}:{})},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json().catch(()=>({}));if(!r.ok&&!allow.includes(r.status))throw Error(`${r.status} ${new URL(url).pathname}: ${j.error?.message}`);return {status:r.status,...j};}
async function user(registered=false){const body={returnSecureToken:true};if(registered){body.email=`hamster-smoke-${crypto.randomUUID()}@example.com`;body.password=crypto.randomBytes(20).toString('hex');}const u=await req(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,{auth:null,body});users.push(u);if(registered)await verify(u,body.email,body.password);return u;}
async function verify(u,email,password){await req(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:update`,{body:{localId:u.localId,emailVerified:true}});const signed=await req(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,{auth:null,body:{email,password,returnSecureToken:true}});Object.assign(u,signed);}
async function call(user,action,payload={},admin=false){const r=await req(`https://us-central1-${project}.cloudfunctions.net/${admin?'hamsterAdmin':'hamsterGame'}`,{auth:user.idToken,body:{data:{action,requestId:crypto.randomUUID(),...payload}}});if(r.error)throw Error(r.error.message);return r.result;}
async function query(collection,uid){const r=await req(`${db}/${root}:runQuery`,{body:{structuredQuery:{from:[{collectionId:collection}],where:{fieldFilter:{field:{fieldPath:'uid'},op:'EQUAL',value:{stringValue:uid}}}}}});return Array.isArray(r)?r.filter(x=>x.document).map(x=>x.document):Object.values(r).filter(x=>x?.document).map(x=>x.document);}
async function remove(path){await req(db+'/'+path,{method:'DELETE',allow:[404]});}
(async()=>{try{
 const customer=await user();let saved=await call(customer,'load');assert.equal(saved.player.spins,5);assert.equal(saved.player.seeds,0);
 const spinId=crypto.randomUUID();const spin=await call(customer,'spin',{requestId:spinId}),retry=await call(customer,'spin',{requestId:spinId});assert.deepEqual(spin,retry);assert.equal(spin.player.spins,4);
 const update=await req(`${db}/${root}/players/${customer.localId}?updateMask.fieldPaths=seeds`,{auth:customer.idToken,method:'PATCH',body:{fields:{seeds:{integerValue:'999999'}}},allow:[403]});assert.equal(update.status,403);
 const email=`hamster-link-${crypto.randomUUID()}@example.com`,password=crypto.randomBytes(20).toString('hex');const linked=await req(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,{auth:null,body:{idToken:customer.idToken,email,password,returnSecureToken:true}});Object.assign(customer,linked);await verify(customer,email,password);
 saved=await call(customer,'load');assert.equal(saved.player.spins,4);assert.equal(saved.player.seeds,spin.payout);assert.equal(saved.player.registered,true);
 await call(customer,'daily');await assert.rejects(call(customer,'daily'));
 const other=await user(true);await call(other,'load');
 const staff=await user();await req(`${db}/users/${staff.localId}`,{method:'PATCH',body:{fields:{role:{stringValue:'admin'},companyId:{stringValue:'kyrgyz-organics'}}}});
 const dashboard=await call(staff,'dashboard',{},true);assert.ok(dashboard.settings.dailySpins.length===7);
 const batch=await call(staff,'generateCodes',{label:'HAMSTER SMOKE TEST — DELETE',count:2},true);batches.push(batch);
 const claimId=crypto.randomUUID();const purchase=await call(customer,'purchase',{code:batch.tokens[0],requestId:claimId});assert.equal(purchase.spinsAdded,5);assert.deepEqual(await call(customer,'purchase',{code:batch.tokens[0],requestId:claimId}),purchase);await assert.rejects(call(other,'purchase',{code:batch.tokens[0]}));
 await call(staff,'revokeBatch',{id:batch.id},true);await assert.rejects(call(other,'purchase',{code:batch.tokens[1]}));
 const secret=await req(`${db}/${root}/purchaseCodes/${crypto.createHash('sha256').update(batch.tokens[0]).digest('hex')}`,{auth:customer.idToken,allow:[403]});assert.equal(secret.status,403);
 await req(`${db}/${root}/players/${customer.localId}?updateMask.fieldPaths=seeds`,{method:'PATCH',body:{fields:{seeds:{integerValue:'100'}}}});
 const coupon=await call(customer,'redeem',{rewardId:'cookie',cost:0});assert.equal(coupon.player.seeds,20);await assert.rejects(call(customer,'useCoupon',{code:coupon.coupon.code},true));await call(staff,'useCoupon',{code:coupon.coupon.code},true);await assert.rejects(call(staff,'useCoupon',{code:coupon.coupon.code},true));
 if(process.env.HAMSTER_BROWSER_URL){
  const {chromium}=require('C:/Users/fangb_kyiapn1/.codex/skills/develop-web-game/node_modules/playwright');
  const browser=await chromium.launch({headless:true});try{
   const page=await browser.newPage({viewport:{width:393,height:650}}),errors=[];page.on('pageerror',e=>errors.push(e.message));const host=process.env.HAMSTER_BROWSER_URL;
   await page.route('**/hamster-browser-test',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Temporary game check</title>'}));await page.goto(host+'/hamster-browser-test');
   await page.evaluate(async({email,password})=>{const {app}=await import('/hamster_game/firebase-config.js');const {getAuth,signInWithEmailAndPassword}=await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');await signInWithEmailAndPassword(getAuth(app),email,password);},{email,password});
   await page.goto(host+'/hamster_game/');await page.waitForSelector('#spin:enabled',{timeout:60000});const before=await page.evaluate(()=>JSON.parse(render_game_to_text()));
   const spinBox=await page.locator('#spin').boundingBox(),navBox=await page.locator('.bottom-nav').boundingBox();assert.ok(spinBox.y+spinBox.height<=navBox.y,'Spin button visible above navigation');
   await page.locator('#spin').click();const widths=await page.evaluate(async()=>{const values=[];for(let i=0;i<120;i++){values.push([document.documentElement.scrollWidth,document.querySelector('.machine-card').getBoundingClientRect().width,document.querySelector('.reel-mascot').getBoundingClientRect().width]);await new Promise(r=>setTimeout(r,25));}return values;});for(let col=0;col<3;col++)assert.ok(Math.max(...widths.map(r=>r[col]))-Math.min(...widths.map(r=>r[col]))<1,'Stable mobile spin width');
   await page.waitForFunction(()=>!JSON.parse(render_game_to_text()).spinning,{},{timeout:60000});const after=await page.evaluate(()=>JSON.parse(render_game_to_text()));assert.equal(after.spins,before.spins-1);await page.reload();await page.waitForSelector('#spin:enabled',{timeout:60000});assert.equal((await page.evaluate(()=>JSON.parse(render_game_to_text()))).spins,after.spins);assert.deepEqual(errors,[]);
   require('node:fs').mkdirSync('test-results/hamster',{recursive:true});await page.screenshot({path:'test-results/hamster/published-mobile.png'});console.log('PUBLIC BROWSER PASS: signed-in Firestore game, visible spin button, stable mobile widths, reload persistence.');
  }finally{await browser.close();}
 }
 console.log('LIVE PASS: guest-to-email progress preservation, protected balances, idempotent spins, daily claim limit, admin dashboard, single-use/revoked/private QR codes, server pricing and staff-only coupon use.');
 }finally{
  const counts={};const add=(day,k,n=1)=>{counts[day]??={};counts[day][k]=(counts[day][k]||0)+n;};
  const pending=[];
  for(const u of users){
   const p=await req(`${db}/${root}/players/${u.localId}`,{allow:[404]});
   if(p.status!==404){const v=data(p),day=new Date(v.createdAt+21600000).toISOString().slice(0,10);add(day,'players');if(v.registered)add(day,'registrations');
    const requests=await req(`${db}/${root}/players/${u.localId}/requests`);for(const d of requests.documents||[])pending.push(d.name.slice(prefix.length));pending.push(`${root}/players/${u.localId}`);
   }
   for(const d of await query('visits',u.localId)){const v=data(d);add(v.date,'activePlayers');pending.push(d.name.slice(prefix.length));}
   for(const d of await query('events',u.localId)){const v=data(d);if(v.action==='spin'){add(v.date,'spins');add(v.date,'seedsAwarded',v.payout);add(v.date,v.payout?'wins':'losses');}if(v.action==='daily'){add(v.date,'dailyClaims');add(v.date,'bonusSpins',v.spinsAdded);}if(v.action==='task'){add(v.date,'taskClaims');add(v.date,'bonusSpins',v.spinsAdded);}if(v.action==='purchase'){add(v.date,'purchaseClaims');add(v.date,'purchaseSpins',v.spinsAdded);}pending.push(d.name.slice(prefix.length));}
   for(const d of await query('coupons',u.localId)){const v=data(d),day=new Date(v.createdAt+21600000).toISOString().slice(0,10);add(day,'redemptions');add(day,'seedsSpent',v.cost);if(v.status==='used')add(new Date(v.usedAt+21600000).toISOString().slice(0,10),'couponsUsed');pending.push(d.name.slice(prefix.length));}
   pending.push(`users/${u.localId}`);
  }
  const all={};for(const c of Object.values(counts))for(const [k,n]of Object.entries(c))all[k]=(all[k]||0)+n;
  if(Object.keys(all).length){counts.all=all;await req(`${db}:commit`,{body:{writes:Object.entries(counts).map(([day,c])=>({transform:{document:prefix+root+'/metrics/'+day,fieldTransforms:Object.entries(c).map(([k,n])=>({fieldPath:k,increment:{integerValue:String(-n)}}))}}))}});}
  for(const b of batches){pending.push(`${root}/batches/${b.id}`);for(const t of b.tokens)pending.push(`${root}/purchaseCodes/${crypto.createHash('sha256').update(t).digest('hex')}`);}
  for(const p of pending)await remove(p);
  for(const u of users)await req(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:delete`,{body:{localId:u.localId}});
  console.log('Temporary users, data, codes and test analytics removed.');
 }
})().catch(e=>{console.error(e.message);process.exit(1);});
