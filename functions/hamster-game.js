'use strict';
const crypto=require('node:crypto');
const D=require('./hamster-domain');
const ROOT='stores/kyrgyz-organics/games/hamster-spin';
module.exports=function createHamsterGame({db,functions,admin}){
 const error=(code,message)=>{throw new functions.https.HttpsError(code,message);};
 const ref=path=>db.doc(`${ROOT}/${path}`);
 const uidOf=req=>req.auth?.uid||error('unauthenticated','Please sign in first.');
 const isRegistered=req=>req.auth?.token?.firebase?.sign_in_provider!=='anonymous';
 const verified=req=>{if(!isRegistered(req)||!req.auth.token?.email_verified)error('failed-precondition','Register and verify your email first.');};
 async function staff(req){const uid=uidOf(req),snap=await db.doc(`users/${uid}`).get(),p=snap.data()||{};if(!['admin','owner','manager','superadmin','super_admin'].includes(p.role))error('permission-denied','Staff access is required.');if(!['superadmin','super_admin'].includes(p.role)&&(p.companyId||'kyrgyz-organics')!=='kyrgyz-organics')error('permission-denied','This game belongs to Kyrgyz Organics.');return uid;}
 function requestId(data){return typeof data.requestId==='string'&&/^[a-zA-Z0-9_-]{16,80}$/.test(data.requestId)?data.requestId:error('invalid-argument','A valid request ID is required.');}
 function metrics(tx,date,changes){for(const key of ['all',date])tx.set(ref(`metrics/${key}`),Object.fromEntries(Object.entries(changes).map(([k,n])=>[k,admin.firestore.FieldValue.increment(n)])),{merge:true});}
 function publicSettings(s){const {updatedBy,...safe}=s;return safe;}
 async function snapshot(uid){const [p,s,c]=await Promise.all([ref(`players/${uid}`).get(),ref('settings/main').get(),db.collection(`${ROOT}/coupons`).where('uid','==',uid).get()]);return {player:p.data(),settings:publicSettings(D.settingsFrom(s.data())),coupons:c.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>b.createdAt-a.createdAt).slice(0,100),serverNow:Date.now(),dayKey:D.dayKey()};}
 const game=functions.https.onCall(async req=>{
  const uid=uidOf(req),data=req.data||{},action=data.action,now=Date.now(),date=D.dayKey(now);
  if(action==='load'){
   await db.runTransaction(async tx=>{const [ps,ss,vs]=await Promise.all([tx.get(ref(`players/${uid}`)),tx.get(ref('settings/main')),tx.get(ref(`visits/${date}_${uid}`))]);
    const settings=D.settingsFrom(ss.data());let p=ps.data();const counts={};
    if(!p){p=D.initialPlayer(uid,settings,now);counts.players=1;}
    if(isRegistered(req)&&!p.registered){p.registered=true;counts.registrations=1;}
    if(!ps.exists||p.registered!==ps.data()?.registered)tx.set(ref(`players/${uid}`),p);
    if(!vs.exists){tx.set(ref(`visits/${date}_${uid}`),{uid,date,createdAt:now});counts.activePlayers=1;}
    if(Object.keys(counts).length)metrics(tx,date,counts);
   });return snapshot(uid);
  }
  if(!['spin','daily','purchase','redeem','profile','task','visit'].includes(action))error('invalid-argument','Unknown game action.');
  if(['daily','purchase','redeem'].includes(action))verified(req);
  const id=requestId(data),requestRef=ref(`players/${uid}/requests/${id}`),fingerprint=D.hash(JSON.stringify({...data,requestId:undefined}));
  // Randomness is drawn on the server and remains fixed if Firestore retries the transaction.
  const randomBytes=crypto.randomBytes(128);let ri=0;const rng=max=>{const limit=4294967296-4294967296%max;let n;do{n=ri<randomBytes.length?randomBytes.readUInt32BE(ri):crypto.randomInt(4294967296);ri+=4;}while(n>=limit);return n%max;};
  const result=await db.runTransaction(async tx=>{
   const [ps,ss,prior]=await Promise.all([tx.get(ref(`players/${uid}`)),tx.get(ref('settings/main')),tx.get(requestRef)]);
   if(prior.exists){if(prior.data().fingerprint!==fingerprint)error('already-exists','Request ID was already used for another action.');return prior.data().result;}
   if(!ps.exists)error('failed-precondition','Open the game before playing.');
   const p={...ps.data()},s=D.settingsFrom(ss.data());
   if(!s.enabled&&!['profile','visit'].includes(action))error('failed-precondition','The bakery game is taking a short break.');
   let extra={},counts={};
   if(action==='spin'){
    if(p.spins<1)error('failed-precondition','No spins left. Claim your daily gift or scan a purchase code.');
    if(now-p.lastSpinAt<1600)error('resource-exhausted','Please wait for your current spin to finish.');
    ri=0;const outcome=D.roll(s,rng);p.spins--;p.totalSpins++;p.lastSpinAt=now;p.seeds+=outcome.payout;p.earned+=outcome.payout;
    if(outcome.outcome==='loss')p.losses++;else p.wins++;
    extra=outcome;counts={spins:1,seedsAwarded:outcome.payout,[outcome.outcome==='loss'?'losses':'wins']:1};
   }else if(action==='daily'){
    if(p.lastDailyDate===date)error('already-exists','Today’s gift has already been collected.');
    const day=D.nextDailyDay(p,now);p.spins+=s.dailySpins[day];p.dailyDay=day;p.lastDailyDate=date;extra={spinsAdded:s.dailySpins[day]};counts={dailyClaims:1,bonusSpins:s.dailySpins[day]};
   }else if(action==='purchase'){
    const token=D.normalizeCode(data.code);if(!token)error('invalid-argument','That is not a purchase reward code.');
    const codeRef=ref(`purchaseCodes/${D.hash(token)}`),cs=await tx.get(codeRef),code=cs.data();
    if(!code)error('not-found','Purchase code not found.');
    if(code.claimedBy)error('already-exists','This purchase code has already been used.');
    const bs=await tx.get(ref(`batches/${code.batchId}`));
    if(!bs.exists||bs.data().revoked||code.expiresAt<now)error('failed-precondition','This purchase code has expired or was cancelled.');
    p.spins+=code.spins;p.purchaseClaims++;tx.update(codeRef,{claimedBy:uid,claimedAt:now});
    extra={spinsAdded:code.spins};counts={purchaseClaims:1,purchaseSpins:code.spins};
   }else if(action==='redeem'){
    const reward=s.rewards.find(r=>r.id===data.rewardId&&r.active);if(!reward)error('not-found','This reward is unavailable.');
    if(p.seeds<reward.cost)error('failed-precondition','Not enough seeds for this treat.');
    const cid=D.hash(uid+id).slice(0,24),coupon={uid,name:reward.name,rewardId:reward.id,cost:reward.cost,status:'active',createdAt:now,code:cid.toUpperCase()};
    p.seeds-=reward.cost;tx.create(ref(`coupons/${cid}`),coupon);extra={coupon:{id:cid,...coupon}};counts={redemptions:1,seedsSpent:reward.cost};
   }else if(action==='profile'){
    const name=String(data.name||'').trim();if(name.length<1||name.length>18||!['sage','peach','lilac'].includes(data.theme))error('invalid-argument','Enter a name up to 18 characters and a valid corner color.');
    p.name=name;p.theme=data.theme;p.styled=true;
   }else if(action==='visit'){p.visited=true;
   }else if(action==='task'){
    const tasks={spin3:{progress:p.totalSpins>=3,spins:2},win2:{progress:p.wins>=2,spins:2},visit:{progress:p.visited,spins:1},style:{progress:p.styled,spins:1}},task=tasks[data.taskId];
    if(!task||!task.progress)error('failed-precondition','Complete this task first.');
    if(p.claimedTasks.includes(data.taskId))error('already-exists','Task reward already collected.');
    p.claimedTasks=[...p.claimedTasks,data.taskId];p.spins+=task.spins;extra={spinsAdded:task.spins};counts={taskClaims:1,bonusSpins:task.spins};
   }
   p.updatedAt=now;tx.set(ref(`players/${uid}`),p);
   if(Object.keys(counts).length)metrics(tx,date,counts);
   const result={player:p,settings:publicSettings(s),...extra,serverNow:now,dayKey:date};
   tx.create(requestRef,{action,fingerprint,result,createdAt:now});
   tx.set(ref(`events/${D.hash(uid+id)}`),{uid,action,createdAt:now,date,payout:extra.payout||0,spinsAdded:extra.spinsAdded||0});
   return result;
  });return result;
 });
 const management=functions.https.onCall(async req=>{
  const actor=await staff(req),data=req.data||{},now=Date.now();
  if(data.action==='dashboard'){
   const recentDays=Promise.all(Array.from({length:31},(_,i)=>ref(`metrics/${D.dayKey(now-i*86400000)}`).get())).then(docs=>({docs:docs.filter(d=>d.exists)}));
   const [ss,all,days,players,batches,coupons]=await Promise.all([ref('settings/main').get(),ref('metrics/all').get(),recentDays,db.collection(`${ROOT}/players`).orderBy('updatedAt','desc').limit(50).get(),db.collection(`${ROOT}/batches`).orderBy('createdAt','desc').limit(30).get(),db.collection(`${ROOT}/coupons`).orderBy('createdAt','desc').limit(50).get()]);
   return {settings:D.settingsFrom(ss.data()),metrics:all.data()||{},days:days.docs.filter(d=>d.id!=='all').map(d=>({date:d.id,...d.data()})),players:players.docs.map(d=>({id:d.id,...d.data()})),batches:batches.docs.map(d=>{const {tokens,...b}=d.data();return {id:d.id,...b};}),coupons:coupons.docs.map(d=>({id:d.id,...d.data()}))};
  }
  if(data.action==='settings'){
   let settings;try{settings=D.validateSettings(data.settings);}catch(e){error('invalid-argument',e.message);}
   await db.runTransaction(async tx=>{const old=await tx.get(ref('settings/main'));const version=D.settingsFrom(old.data()).version;if(data.version!==version)error('aborted','Settings changed elsewhere. Refresh before saving.');tx.set(ref('settings/main'),{...settings,version:version+1,updatedAt:now,updatedBy:actor});tx.set(ref(`adminAudit/${crypto.randomUUID()}`),{actor,action:'settings',before:old.data()||D.DEFAULTS,after:settings,createdAt:now});});return {ok:true};
  }
  if(data.action==='generateCodes'){
   const id=requestId(data),count=data.count;
   if(!Number.isInteger(count)||count<1||count>50)error('invalid-argument','Generate between 1 and 50 codes.');
   const label=String(data.label||'').trim().slice(0,100);if(!label)error('invalid-argument','Add a batch label or receipt reference.');
   return db.runTransaction(async tx=>{const [old,ss]=await Promise.all([tx.get(ref(`batches/${id}`)),tx.get(ref('settings/main'))]);if(old.exists){if(old.data().count!==count||old.data().label!==label)error('already-exists','Request ID already used.');return {id,...old.data()};}const s=D.settingsFrom(ss.data()),tokens=Array.from({length:count},()=>crypto.randomBytes(16).toString('hex')),expiresAt=now+s.codeExpiryDays*86400000;const batch={tokens,label,count,spins:s.purchaseSpins,expiresAt,createdAt:now,createdBy:actor,revoked:false};tx.create(ref(`batches/${id}`),batch);for(const token of tokens)tx.create(ref(`purchaseCodes/${D.hash(token)}`),{batchId:id,spins:s.purchaseSpins,expiresAt,claimedBy:null});return {id,...batch};});
  }
  if(['batch','revokeBatch'].includes(data.action)){
   if(!/^[a-zA-Z0-9_-]{16,80}$/.test(data.id||''))error('invalid-argument','Invalid batch ID.');
   const r=ref(`batches/${data.id}`),s=await r.get();if(!s.exists)error('not-found','Batch not found.');
   if(data.action==='revokeBatch'){await r.update({revoked:true,revokedAt:now,revokedBy:actor});return {ok:true};}return {id:s.id,...s.data()};
  }
  if(data.action==='useCoupon'){
   const id=String(data.code||'').trim().toLowerCase();if(!/^[a-f0-9]{24}$/.test(id))error('invalid-argument','Enter the coupon code.');
   return db.runTransaction(async tx=>{const r=ref(`coupons/${id}`),cs=await tx.get(r);if(!cs.exists)error('not-found','Coupon not found.');if(cs.data().status==='used')error('already-exists','Coupon has already been used.');tx.update(r,{status:'used',usedAt:now,usedBy:actor});metrics(tx,D.dayKey(now),{couponsUsed:1});return {ok:true,name:cs.data().name};});
  }
  error('invalid-argument','Unknown admin action.');
 });
 return {hamsterGame:game,hamsterAdmin:management};
};
