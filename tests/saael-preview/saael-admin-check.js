async (page) => {
 await page.setViewportSize({width:1200,height:900});
 await page.evaluate(async()=>{
  document.body.className='';document.body.innerHTML='<form id="editor-form"><button type="submit">Save Store (test)</button></form>';
  const {mountSaaelEditor}=await import('/storefront/brands/saael/admin-editor.js');
  window.adminEditor=mountSaaelEditor(document.querySelector('form'),{companyId:'saael-s',content:{}});
  window.testWrites=[];
  document.querySelector('form').addEventListener('submit',async event=>{
   event.preventDefault();
   const {createSaveSaaelSettingsIntent}=await import('/ICF/Intents/SaveSaaelSettingsIntent.js');
   const {default:pipeline}=await import('/ICF/engine/pipeline.js');
   const config={companyId:'saael-s',content:{saael:adminEditor.read()}};
   const intent=createSaveSaaelSettingsIntent({actor:{id:'saikal'},config,repository:{loadIdentity:async()=>({uid:'saikal',role:'owner'}),save:async(value)=>{testWrites.push(value);sessionStorage.setItem('saael-test-config',JSON.stringify(value));}}});
   window.testResult=await pipeline.run(intent);
  });
 });
 await page.locator('[name=sa-headline]').fill('Saikal can change this herself.');
 await page.locator('[name=sa-motion]').uncheck();
 await page.locator('[name=sa-defaultView]').selectOption('list');
 await page.getByText('Map destinations',{exact:true}).click();
 await page.locator('[data-map-id=library] [name=title]').fill('Saikal’s Library');
 await page.locator('[data-map-id=shop] [name=enabled]').uncheck();
 await page.getByText('Services',{exact:true}).click();
 await page.locator('[data-add=services]').click();
 const added=page.locator('[data-collection=services] fieldset').last();
 await added.locator('[name=id]').fill('confirmed-title');await added.locator('[name=title]').fill('Editable service');
 await added.locator('[name=description]').fill('Editable introduction');await added.locator('[name=details]').fill('Editable details');
 await page.getByText('Library readings',{exact:true}).click();
 await page.locator('[data-collection=articles] [data-remove]').click();
 await page.getByRole('button',{name:'Save Store (test)'}).click();
 await page.waitForFunction(()=>window.testResult);
 const result=await page.evaluate(()=>({ok:testResult.ok,count:testWrites.length,settings:testWrites[0].content.saael}));
 if(!result.ok||result.count!==1||result.settings.services.length!==2||result.settings.articles.length!==0)throw Error('Editor save failed');
 if(result.settings.destinations.find(item=>item.id==='shop').enabled!==false)throw Error('Visibility did not save');
 await page.screenshot({path:'KyrgyzOrganics/output/playwright/saael-admin.png',fullPage:true});
 await page.reload();
 await page.evaluate(async()=>{
  const config=JSON.parse(sessionStorage.getItem('saael-test-config'));
  const {applySaaelPresentation,renderSaaelDetails}=await import('/storefront/brands/saael/presentation.js');
  applySaaelPresentation(config);renderSaaelDetails(config);
 });
 if(await page.locator('h1').innerText()!=='Saikal can change this herself.')throw Error('Saved headline not shown');
 if(await page.locator('.sa-map-frame').isVisible())throw Error('Starting list setting ignored');
 if(await page.locator('.sa-destination-list [data-destination=shop]').count())throw Error('Disabled destination visible');
 await page.locator('.sa-destination-list [data-destination=library]').click();
 if(await page.locator('#sa-panel-title').innerText()!=='Saikal’s Library')throw Error('Destination title ignored');
 if(!await page.getByText('No readings have been published yet.').isVisible())throw Error('Empty collection ignored');
 await page.keyboard.press('Escape');
 await page.evaluate(async()=>{
  const {renderSaaelDetails}=await import('/storefront/brands/saael/presentation.js');
  renderSaaelDetails({companyId:'saael-s',content:{saael:{artworks:[{title:'Missing artwork',imageUrl:'http://127.0.0.1:19828/missing.png',caption:'Unavailable asset check'}],services:[],articles:[]}}});
 });
 await page.locator('.sa-map [data-destination=gallery]').click();
 await page.getByText('Artwork is unavailable. Missing artwork',{exact:true}).waitFor();
 await page.keyboard.press('Escape');
 await page.locator('.sa-header [data-action=services]').click();
 if(!await page.getByText('No services have been published yet.').isVisible())throw Error('Empty services failed');
 await page.keyboard.press('Escape');
 await page.reload();
 return 'PASS: admin add/remove and editable fields, ICF save through test repository, reload reflects settings, hidden destinations, empty collections and unavailable artwork.';
}
