// Read-only deployment prerequisites. Never prints authentication tokens.
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const token=execFileSync('C:/Users/Bryant/google-cloud-sdk/bin/gcloud.cmd',['auth','print-access-token'],{encoding:'utf8',shell:true}).trim();
const project='oa-kyrgyz-organic',headers={Authorization:`Bearer ${token}`,'x-goog-user-project':project};
(async()=>{
 for(const [label,url]of [['auth',`https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`],['rules',`https://firebaserules.googleapis.com/v1/projects/${project}/releases/cloud.firestore`]]){
  const r=await fetch(url,{headers}),data=await r.json();
  if(!r.ok)throw Error(`${label}: ${r.status} ${data.error?.message}`);
  if(label==='auth')console.log(JSON.stringify({emailPasswordEnabled:data.signIn?.email?.enabled,anonymousEnabled:data.signIn?.anonymous?.enabled,authorizedDomains:data.authorizedDomains}));
  else{const r=await fetch(`https://firebaserules.googleapis.com/v1/${data.rulesetName}`,{headers});const rules=await r.json();fs.mkdirSync('test-results/hamster',{recursive:true});fs.writeFileSync('test-results/hamster/deployed-firestore.rules',rules.source.files.map(f=>f.content).join('\n'));console.log('Deployed Firestore rules captured for read-only inspection.');}
 }
})().catch(e=>{console.error(e.message);process.exit(1);});
