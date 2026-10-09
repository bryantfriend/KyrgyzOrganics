async (page) => {
 const integration=await page.context().newPage();
 const errors=[];integration.on('pageerror',error=>errors.push(String(error)));
 await integration.route('**/storefront/store-loader.js',route=>route.fulfill({contentType:'text/javascript',body:'export async function loadStoreConfig(){return {companyId:"saael-s",name:"UNIVERSE OF SaaEl",launchStatus:"live",theme:{backgroundColor:"#ffffff",textColor:"#302e29",primaryColor:"#917337"},features:{},content:{saael:{headline:"Integrated storefront test"}},layout:[]};}'}));
 await integration.goto('http://127.0.0.1:19828/index.html?companyId=saael-s&preview=1');
 await integration.locator('#saael-root h1').waitFor({timeout:25000});
 if(await integration.locator('#saael-root h1').innerText()!=='Integrated storefront test')throw Error('Saved config not loaded in shared storefront');
 if(await integration.locator('.header').isVisible())throw Error('Shared header still displayed');
 await integration.locator('.sa-header [data-action=services]').click();
 if(!await integration.locator('dialog').evaluate(el=>el.open))throw Error('Integrated dialog failed');
 if(errors.length)throw Error(errors.join('\n'));
 await integration.close();return 'PASS: real index.html/home.js loads SaaEl settings from store-loader adapter, renders the universe and opens service dialogs without page errors.';
}
