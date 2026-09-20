'use strict';
const crypto = require('node:crypto');
const DEFAULTS = Object.freeze({
  enabled:true, starterSpins:5, dailySpins:[3,3,4,4,5,5,8],
  lossPercent:55, jackpotPercent:5, pairSeeds:5, jackpotSeeds:40,
  purchaseSpins:5, codeExpiryDays:90, version:1,
  rewards:[
    {id:'cookie',name:'A little cookie joy',description:'One chocolate chip cookie',cost:80,img:'symbols/symbol-chocolate-cookies.png',color:'peach',active:true},
    {id:'bread',name:'Your daily bread',description:'A freshly baked sourdough loaf',cost:180,img:'rewards/reward-bread-classic.png',color:'butter',active:true},
    {id:'tea',name:'A cozy tea break',description:'A warm cup, on your hamster',cost:120,img:'rewards/reward-tea.png',color:'sage',active:true},
    {id:'box',name:'The happy baker bag',description:'A little assortment of baked treats',cost:400,img:'rewards/reward-bakery-bag.png',color:'lilac',active:true}
  ]
});
function fail(message){throw new Error(message);}
function integer(value,min,max,label){if(!Number.isInteger(value)||value<min||value>max)fail(`${label} must be an integer from ${min} to ${max}.`);return value;}
function validateSettings(value){
 if(!value||typeof value.enabled!=='boolean')fail('Choose whether the game is enabled.');
 const out={enabled:value.enabled};
 for(const [key,min,max] of [['starterSpins',0,20],['lossPercent',1,95],['jackpotPercent',1,20],['pairSeeds',1,100],['jackpotSeeds',1,1000],['purchaseSpins',1,50],['codeExpiryDays',1,365]])out[key]=integer(value[key],min,max,key);
 if(out.lossPercent+out.jackpotPercent>=100)fail('Leave a positive probability for pair wins.');
 if(out.jackpotSeeds<out.pairSeeds)fail('Jackpot must pay at least as much as a pair.');
 if(!Array.isArray(value.dailySpins)||value.dailySpins.length!==7)fail('Provide exactly seven daily spin amounts.');
 out.dailySpins=value.dailySpins.map(n=>integer(n,1,30,'Daily spins'));
 if(!Array.isArray(value.rewards)||value.rewards.length!==DEFAULTS.rewards.length)fail('Provide the four bakery rewards.');
 out.rewards=DEFAULTS.rewards.map(base=>{const r=value.rewards.find(r=>r.id===base.id);if(!r||typeof r.active!=='boolean')fail('Invalid reward.');return {...base,name:String(r.name||'').trim().slice(0,70)||base.name,cost:integer(r.cost,1,100000,'Reward cost'),active:r.active};});
 return out;
}
function settingsFrom(data){return data?.lossPercent!==undefined?{...DEFAULTS,...data}:{...DEFAULTS};}
function dayKey(now=Date.now()){return new Date(now+6*3600000).toISOString().slice(0,10);}
function yesterday(now){return dayKey(now-86400000);}
function nextDailyDay(player,now){return player.lastDailyDate===yesterday(now)?(player.dailyDay+1)%7:0;}
function roll(settings,randomInt=crypto.randomInt){
 const n=randomInt(10000);const outcome=n<settings.lossPercent*100?'loss':n<(100-settings.jackpotPercent)*100?'pair':'jackpot';
 const a=randomInt(4), b=(a+1+randomInt(3))%4;
 let reels=outcome==='jackpot'?[a,a,a]:outcome==='pair'?[a,a,b]:[a,b,[0,1,2,3].find(x=>x!==a&&x!==b)];
 for(let i=2;i>0;i--){const j=randomInt(i+1);[reels[i],reels[j]]=[reels[j],reels[i]];}
 return {outcome,reels,payout:outcome==='loss'?0:outcome==='pair'?settings.pairSeeds:settings.jackpotSeeds};
}
function initialPlayer(uid,settings,now){return {uid,seeds:0,spins:settings.starterSpins,totalSpins:0,wins:0,losses:0,earned:0,claimedTasks:[],lastDailyDate:null,dailyDay:-1,visited:false,styled:false,name:'Bun',theme:'sage',createdAt:now,updatedAt:now,lastSpinAt:0,registered:false,purchaseClaims:0};}
function normalizeCode(raw){const text=String(raw||'').trim();let value=text;try{const url=new URL(text);value=url.searchParams.get('code')||url.hash.match(/(?:^#|&)code=([^&]+)/)?.[1]||'';}catch{}return /^[a-f0-9]{32}$/i.test(value)?value.toLowerCase():null;}
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
module.exports={DEFAULTS,validateSettings,settingsFrom,dayKey,nextDailyDay,roll,initialPlayer,normalizeCode,hash};
