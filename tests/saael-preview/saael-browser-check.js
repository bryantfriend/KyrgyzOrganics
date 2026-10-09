async (page) => {
 const errors=[];page.on('pageerror',error=>errors.push(String(error)));
 await page.setViewportSize({width:1440,height:1050});
 await page.reload();
 const names=['Library','Community','Art Gallery','Create','Healing Room','Serve','Shop'];
 for(const name of names){
  await page.locator('.sa-map').getByRole('button',{name,exact:true}).click();
  if(await page.locator('#sa-panel-title').innerText()!==name)throw Error('Wrong panel: '+name);
  await page.getByRole('button',{name:'Close panel',exact:true}).click();
 }
 const healing=page.locator('.sa-map').getByRole('button',{name:'Healing Room',exact:true});
 await healing.focus();await page.keyboard.press('Enter');
 await page.keyboard.press('Tab');
 if(!await page.evaluate(()=>document.activeElement.closest('dialog')!==null))throw Error('Dialog focus escaped');
 await page.keyboard.press('Escape');
 if(!await healing.evaluate(element=>element===document.activeElement))throw Error('Focus did not return');
 await page.locator('[data-view=list]').click();
 if(!await page.locator('.sa-destination-list').isVisible())throw Error('List not visible');
 await page.locator('.sa-destination-list').getByRole('button',{name:/Healing Room/}).click();
 await page.locator('.sa-panel-paths').getByRole('button',{name:'Library',exact:true}).click();
 await page.locator('[data-article]').click();
 if(!await page.locator('.sa-reading').isVisible())throw Error('Reading missing');
 await page.keyboard.press('Escape');
 await page.locator('.sa-header').getByRole('button',{name:'Services',exact:true}).click();
 await page.getByRole('searchbox').fill('not-a-service');
 if(await page.locator('[data-service]').count())throw Error('Search failed');
 await page.getByRole('searchbox').fill('Session');await page.locator('[data-service]').click();
 await page.getByRole('button',{name:/View availability/}).click();
 if(!await page.locator('.sa-calendar').isVisible())throw Error('Calendar missing');
 await page.keyboard.press('Escape');
 await page.locator('.sa-destination-list').getByRole('button',{name:/Art Gallery/}).click();
 await page.locator('[data-artwork]').click();
 if(!await page.locator('.sa-lightbox-image').isVisible())throw Error('Lightbox missing');
 await page.keyboard.press('Escape');
 for(const target of ['.sa-header [data-action=booking]','.sa-booking-card [data-action=booking]','.sa-controls [data-action=services]']){
  await page.locator(target).click();if(!await page.locator('dialog').evaluate(el=>el.open))throw Error('Entry point failed');await page.keyboard.press('Escape');
 }
 await page.locator('[data-view=map]').click();
 await page.screenshot({path:'KyrgyzOrganics/output/playwright/saael-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'KyrgyzOrganics/output/playwright/saael-phone.png',fullPage:true});
 if(!await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth))throw Error('Horizontal overflow');
 await page.locator('.sa-map').getByRole('button',{name:'Healing Room',exact:true}).click();
 await page.screenshot({path:'KyrgyzOrganics/output/playwright/saael-phone-panel.png'});await page.keyboard.press('Escape');
 await page.emulateMedia({reducedMotion:'reduce'});
 if(await page.locator('.sa-pigment').first().evaluate(el=>getComputedStyle(el).animationName)!=='none')throw Error('Reduced motion ignored');
 if(errors.length)throw Error(errors.join('\n'));
 console.log('PASS: seven map destinations, focus trap/restore, Escape, list, panel switching, reading, gallery, filtering, booking entry points, phone layout and reduced motion; no page errors.');
}
