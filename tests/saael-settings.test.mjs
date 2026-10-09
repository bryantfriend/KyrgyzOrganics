import assert from 'node:assert/strict';
import pipeline from '../ICF/engine/pipeline.js';
import registry from '../ICF/engine/intentRegistry.js';
import { createSaveSaaelSettingsIntent } from '../ICF/Intents/SaveSaaelSettingsIntent.js';
import { resolveSaaelContent } from '../storefront/brands/saael/content.js';
import { validateSaaelContent } from '../storefront/brands/saael/validation.js';
const content=resolveSaaelContent({logoUrl:'https://example.org/logo.jpg',artworks:[]});
assert.deepEqual(validateSaaelContent(content),[]);
assert.equal(resolveSaaelContent({services:[]}).services.length,0);
assert.equal(resolveSaaelContent({destinations:[{id:'library',title:'Custom title',color:'invalid'}]}).destinations[0].title,'Custom title');
assert.equal(resolveSaaelContent({destinations:[{id:'library',color:'invalid'}]}).destinations[0].color,'#9860ba');
registry.registerIntent('SaveSaaelSettingsIntent',createSaveSaaelSettingsIntent);
let writes=0;
async function execute(role,settings=content,uid='saikal') {
 const options={actor:{id:'saikal',role:'admin'},config:{companyId:'saael-s',content:{saael:settings}},repository:{loadIdentity:async()=>({uid,role}),save:async()=>{writes++;}}};
 const created=registry.createIntent('SaveSaaelSettingsIntent',options);assert.equal(created.ok,true);
 return pipeline.run(created.intent);
}
const valid=await execute('owner');assert.equal(valid.ok,true);assert.equal(writes,1);
assert.deepEqual(valid.meta.pipelineTrace.map(item=>item.stageName||item.stage),['Validate','Normalize','AddContext','Authorize','Process','Emit']);
assert.equal((await execute('customer')).ok,false);assert.equal(writes,1);
assert.equal((await execute('owner',content,'different-user')).ok,false);assert.equal(writes,1);
assert.equal((await execute('owner',{...content,logoUrl:'javascript:alert(1)'})).ok,false);assert.equal(writes,1);
assert.equal((await execute('owner',{...content,services:[{id:'duplicate',title:'First',description:'',details:'',sample:true},{id:'duplicate',title:'Second',description:'',details:'',sample:true}]})).ok,false);assert.equal(writes,1);
console.log('SaaEl checks passed: six-stage save, verified identity, rejected unauthorized/invalid writes, saved empty content and configurable defaults.');
