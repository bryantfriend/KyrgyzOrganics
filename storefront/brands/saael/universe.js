import { renderMap, escapeText } from './map.js';
import { safeImageUrl } from './content.js';
import { mountBookingCalendar } from './booking-calendar.js';
import { formatServicePrice } from './calendar-data.js';

export function mountUniverse(host, content) {
 var previous = document.getElementById('saael-root');
 var signature = JSON.stringify(content);
 if (previous && previous.dataset.content === signature) return;
 if (previous) { previous.remove(); document.body.classList.remove('sa-dialog-open'); }
 var root = document.createElement('div');
 root.id = 'saael-root'; root.dataset.content = signature;
 root.className = content.motion === false ? 'sa-still' : '';
 var destinations = content.destinations.filter(function visible(item) { return item.enabled !== false; });
 root.innerHTML = '<a class="sa-skip" href="#sa-explore">Skip to explore</a><header class="sa-header"><a class="sa-brand" href="#sa-explore"><img src="'+escapeText(content.logoUrl)+'" alt="Original crowned-profile logo" width="56" height="56"><span>UNIVERSE <small>OF SaaEl</small></span></a><nav aria-label="Main navigation"><a href="#sa-explore">'+escapeText(content.exploreLabel)+'</a><button data-action="services">'+escapeText(content.servicesLabel)+'</button>'+(destinations.some(function community(item){return item.id==='community';})?'<button data-destination="community">'+escapeText(content.communityLabel)+'</button>':'')+'</nav><button class="sa-primary" data-action="booking">'+escapeText(content.bookingLabel)+' <span aria-hidden="true">↗</span></button></header><main><section class="sa-intro"><div><p class="sa-eyebrow">'+escapeText(content.strapline)+'</p><h1>'+escapeText(content.headline)+'</h1><p class="sa-intro-note">'+escapeText(content.welcome)+'</p></div><aside class="sa-booking-card"><span class="sa-small-star" aria-hidden="true">✧</span><h2>'+escapeText(content.bookingTitle)+'</h2><p>'+escapeText(content.bookingText)+'</p><button data-action="booking">'+escapeText(content.bookingLabel)+' <span aria-hidden="true">↗</span></button></aside></section><section id="sa-explore" tabindex="-1" aria-label="Explore the universe"><div class="sa-map-frame">'+renderMap(content)+'<div class="sa-crowned"><img src="'+escapeText(content.logoUrl)+'" alt="Original SaaEl crowned profile"></div></div><div class="sa-destination-list" hidden>'+destinations.map(function card(item){return '<button class="sa-list-card" data-destination="'+item.id+'" style="--destination-color:'+item.color+'"><span class="sa-list-symbol" aria-hidden="true">✧</span><span><strong>'+escapeText(item.title)+'</strong><small>'+escapeText(item.subtitle)+'</small></span><span aria-hidden="true">↗</span></button>';}).join('')+'</div><div class="sa-controls"><div class="sa-view-toggle" role="group" aria-label="Explore view"><button data-view="map" aria-pressed="true">◈ &nbsp; Map</button><button data-view="list" aria-pressed="false">☷ &nbsp; List</button></div><p>'+escapeText(content.invitation)+'</p><button data-action="services">'+escapeText(content.exploreServicesLabel)+' <span aria-hidden="true">↗</span></button></div></section></main><footer class="sa-footer"><span>UNIVERSE OF SaaEl</span><p>'+escapeText(content.footerText)+'</p><a href="/admin/admin.html?companyId=saael-s">Admin login ↗</a></footer><dialog class="sa-dialog" aria-labelledby="sa-panel-title"><div class="sa-dialog-top"><span>UNIVERSE OF SaaEl</span><button class="sa-close" aria-label="Close panel">×</button></div><div class="sa-panel-body"></div><nav class="sa-panel-paths" aria-label="Explore another destination">'+destinations.map(function path(item){return '<button data-destination="'+item.id+'">'+escapeText(item.title)+'</button>';}).join('')+'</nav></dialog>';
 root.style.setProperty('--ink',content.textColor);
 root.style.setProperty('--gold',content.accentColor);
 root.style.setProperty('--page-background',content.backgroundColor);
 root.style.setProperty('--heading-font',content.headingFont);
 root.style.setProperty('--body-font',content.bodyFont);
 host.appendChild(root);
 document.title = 'UNIVERSE OF SaaEl';
 var dialog = root.querySelector('dialog');
 var panel = root.querySelector('.sa-panel-body');
 var trigger = null;
 function setView(view) {
  root.querySelector('.sa-map-frame').hidden = view !== 'map';
  root.querySelector('.sa-destination-list').hidden = view !== 'list';
  root.querySelectorAll('[data-view]').forEach(function pressed(button){button.setAttribute('aria-pressed', String(button.dataset.view===view));});
 }
 function showPanel(markup) {
  panel.innerHTML = markup;
  if (!dialog.open) { trigger = document.activeElement; dialog.showModal(); document.body.classList.add('sa-dialog-open'); }
  panel.querySelector('h2').setAttribute('tabindex','-1');
  panel.querySelector('h2').focus();
  dialog.scrollTop = 0;
  panel.querySelectorAll('img').forEach(function fallback(image){image.addEventListener('error',function missing(){image.hidden=true;var message=document.createElement('p');message.textContent='Artwork is unavailable. '+image.alt;image.after(message);});});
 }
 function heading(title, body) { return '<p class="sa-eyebrow">A PATH THROUGH THE UNIVERSE</p><h2 id="sa-panel-title">'+escapeText(title)+'</h2><p class="sa-panel-intro">'+escapeText(body)+'</p>'; }
 function pricing(item) { return '<p class="sa-service-price">'+escapeText(formatServicePrice(item,content.currency))+(item.durationMinutes?' · '+item.durationMinutes+' minutes':'')+'</p>'; }
 function openBooking(serviceId) {
  showPanel('<p class="sa-eyebrow">BOOKING CALENDAR · PREVIEW</p><h2 id="sa-panel-title">'+escapeText(content.calendarTitle)+'</h2><p class="sa-panel-intro">'+escapeText(content.bookingNotice)+'</p><div class="sa-booking-calendar-host"></div>');
  mountBookingCalendar(panel.querySelector('.sa-booking-calendar-host'),content,serviceId);
 }
 function serviceCards(items) {
  return items.length ? items.map(function service(item){var index=content.services.indexOf(item);return '<button class="sa-content-card" data-service="'+index+'">'+(item.sample!==false?'<small>Sample offering</small>':'')+'<h3>'+escapeText(item.title)+'</h3><p>'+escapeText(item.description)+'</p>'+pricing(item)+'<span>View details ↗</span></button>';}).join('') : '<p class="sa-empty">No services have been published yet.</p>';
 }
 function openServices() {
  showPanel(heading(content.servicesTitle,content.servicesIntroduction)+'<label class="sa-search">'+escapeText(content.searchLabel)+'<input type="search" placeholder="'+escapeText(content.searchPlaceholder)+'" aria-controls="sa-service-results"></label><div id="sa-service-results" class="sa-content-grid">'+serviceCards(content.services)+'</div><button class="sa-primary" data-action="booking">'+escapeText(content.availabilityLabel)+' ↗</button>');
  panel.querySelector('input').addEventListener('input',function search(event){var query=event.target.value.toLowerCase().trim();panel.querySelector('#sa-service-results').innerHTML=serviceCards(content.services.filter(function match(item){return (item.title+' '+item.description).toLowerCase().includes(query);}));});
 }
 function openDestination(id) {
  var item=destinations.find(function match(destination){return destination.id===id;});
  if (!item) return;
  var markup=heading(item.title,item.introduction);
  if (id==='healing') markup+='<div class="sa-content-grid">'+serviceCards(content.services)+'</div><button class="sa-primary" data-action="booking">'+escapeText(content.availabilityLabel)+' ↗</button>';
  if (id==='library') markup+='<div class="sa-content-grid">'+(content.articles.length?content.articles.map(function article(item,index){return '<button class="sa-content-card" data-article="'+index+'"><h3>'+escapeText(item.title)+'</h3><p>'+escapeText(item.summary)+'</p><span>Read ↗</span></button>';}).join(''):'<p class="sa-empty">No readings have been published yet.</p>')+'</div>';
  if (id==='gallery') markup+='<div class="sa-content-grid">'+(content.artworks.length?content.artworks.map(function artwork(item,index){return '<button class="sa-content-card" data-artwork="'+index+'"><img loading="lazy" src="'+escapeText(safeImageUrl(item.imageUrl))+'" alt="'+escapeText(item.title)+'"><h3>'+escapeText(item.title)+'</h3><span>View artwork ↗</span></button>';}).join(''):'<p class="sa-empty">No artworks have been published yet.</p>')+'</div>';
  showPanel(markup);
 }
 root.addEventListener('click',function handleClick(event){
  var button=event.target.closest('button, [data-destination]');
  if (!button) return;
  if (button.dataset.view) setView(button.dataset.view);
  if (button.classList.contains('sa-close')) dialog.close();
  if (button.dataset.destination) openDestination(button.dataset.destination);
  if (button.dataset.action==='services') openServices();
  if (button.dataset.action==='booking') openBooking(button.dataset.bookService);
  if (button.dataset.service!==undefined) {var service=content.services[Number(button.dataset.service)];showPanel(heading(service.title,service.description)+(service.sample!==false?'<p class="sa-preview-notice">Sample offering — details awaiting confirmation.</p>':'')+pricing(service)+'<p class="sa-reading">'+escapeText(service.details)+'</p><button class="sa-primary" data-action="booking" data-book-service="'+escapeText(service.id)+'">'+escapeText(content.availabilityLabel)+' ↗</button>');}
  if (button.dataset.article!==undefined) {var article=content.articles[Number(button.dataset.article)];showPanel(heading(article.title,article.summary)+'<article class="sa-reading">'+escapeText(article.body)+'</article><button data-destination="library">← Back to Library</button>');}
  if (button.dataset.artwork!==undefined) {var artwork=content.artworks[Number(button.dataset.artwork)];showPanel(heading(artwork.title,artwork.caption)+'<img class="sa-lightbox-image" src="'+escapeText(safeImageUrl(artwork.imageUrl))+'" alt="'+escapeText(artwork.title)+'"><button data-destination="gallery">← Back to Art Gallery</button>');}
 });
 root.addEventListener('keydown',function activateRegion(event){if(event.target.matches('.sa-region')&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
 dialog.addEventListener('close',function restoreFocus(){
  // A delayed close event must not steal focus from a newly opened panel or
  // from a control the visitor has already moved to after closing.
  if (dialog.open) return;
  document.body.classList.remove('sa-dialog-open');
  if(trigger&&trigger.isConnected&&(document.activeElement===document.body||dialog.contains(document.activeElement)))trigger.focus();
 });
 dialog.addEventListener('click',function backdrop(event){if(event.target===dialog){var rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
 setView(content.defaultView);
 root.querySelectorAll('.sa-brand img,.sa-crowned img').forEach(function logoFallback(image){image.addEventListener('error',function fallback(){image.hidden=true;});});
}
