import { resolveSaaelContent, destinationIds } from './content.js';
import { escapeText } from './map.js';
import { mountAvailabilityEditor } from './availability-editor.js';

function field(name, label, value, type) {
 var control;
 if (type === 'checkbox') control='<input name="'+name+'" type="checkbox" '+(value?'checked':'')+'>';
 else if (type === 'textarea') control='<textarea name="'+name+'" rows="3">'+escapeText(value)+'</textarea>';
 else control='<input name="'+name+'" type="'+(type||'text')+'" value="'+escapeText(value)+'" '+(type==='number'?'min="0" step="any"':type==='color'?'':'maxlength="12000"')+'>';
 return '<label class="sa-admin-field"><span>'+escapeText(label)+'</span>'+control+'</label>';
}
var collectionFields = {
 services: [['id','Reference ID'],['title','Service name'],['description','Short introduction','textarea'],['details','Full details','textarea'],['price','Price (blank = not confirmed)','number'],['durationMinutes','Session duration in minutes','number'],['sample','Show sample offering label','checkbox']],
 articles: [['title','Reading title'],['summary','Preview','textarea'],['body','Full reading','textarea']],
 artworks: [['title','Artwork title'],['imageUrl','Image URL','url'],['caption','Caption','textarea']]
};

export function mountSaaelEditor(form, config) {
 var previous=form.querySelector('#saael-settings');
 if(previous)previous.remove();
 if(config.companyId!=='saael-s')return null;
 var content=resolveSaaelContent(config.content && config.content.saael);
 var editor=document.createElement('section');editor.id='saael-settings';
 editor.innerHTML='<style>#saael-settings{padding:24px;border:1px solid #d8c8a4;border-radius:12px;background:#fffcf5;margin:20px 0}#saael-settings h2{font:28px Georgia,serif}#saael-settings details{border-top:1px solid #ded4bd;padding:16px 0}#saael-settings summary{cursor:pointer;font-weight:600;min-height:44px;padding:10px 0}.sa-admin-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}.sa-admin-field{display:flex;flex-direction:column;gap:8px;margin:12px 0}.sa-admin-field input,.sa-admin-field textarea,.sa-admin-field select{max-width:100%;padding:10px;border:1px solid #cdbf9f;border-radius:5px;font:inherit}.sa-admin-field input[type=checkbox]{align-self:start;width:22px;height:22px}.sa-admin-record{border:1px solid #d8c8a4;border-radius:8px;padding:16px;margin:16px 0}#saael-settings button{padding:12px;min-height:44px;border:1px solid #cdbf9f;background:white;border-radius:6px}</style><h2>UNIVERSE OF SaaEl settings</h2><p>Edit the public website here. Use Save Store to publish these settings to the selected storefront; refresh the website to see the changes.</p><details open><summary>Homepage & appearance</summary><div class="sa-admin-fields">'+[['headline','Main headline'],['strapline','HEAL / CREATE / LEARN / SERVE line'],['welcome','Welcome line'],['invitation','Map invitation'],['footerText','Footer text'],['logoUrl','Original logo URL','url'],['motion','Enable subtle pigment animation','checkbox'],['textColor','Text colour','color'],['accentColor','Accent colour','color'],['backgroundColor','Background colour','color']].map(function item(spec){return field('sa-'+spec[0],spec[1],content[spec[0]],spec[2]);}).join('')+'<label class="sa-admin-field"><span>Heading typeface</span><select name="sa-headingFont"><option>Georgia</option><option>Times New Roman</option><option>Palatino Linotype</option></select></label><label class="sa-admin-field"><span>Body typeface</span><select name="sa-bodyFont"><option>Arial</option><option>Verdana</option><option>Tahoma</option></select></label><label class="sa-admin-field"><span>Starting view</span><select name="sa-defaultView"><option value="map">Map</option><option value="list">List</option></select></label></div></details><details><summary>Navigation, services & booking text</summary><p>These fields change the invitation only. Live scheduling and payments require an integration.</p>'+[['exploreLabel','Explore navigation label'],['servicesLabel','Services navigation label'],['communityLabel','Community navigation label'],['exploreServicesLabel','Explore services button'],['availabilityLabel','Availability button'],['servicesTitle','Service catalogue heading'],['servicesIntroduction','Service catalogue introduction','textarea'],['searchLabel','Search label'],['searchPlaceholder','Search placeholder'],['bookingLabel','Button text'],['bookingTitle','Invitation title'],['bookingText','Invitation description','textarea'],['bookingNotice','Business information shown in preview','textarea']].map(function item(spec){return field('sa-'+spec[0],spec[1],content[spec[0]],spec[2]);}).join('')+'</details><details><summary>Map destinations</summary>'+content.destinations.map(function destination(item){return '<fieldset class="sa-admin-record" data-map-id="'+item.id+'"><legend>'+escapeText(item.title)+'</legend><div class="sa-admin-fields">'+[['title','Display name'],['subtitle','Map subtitle'],['introduction','Panel introduction','textarea'],['color','Watercolour pigment','color'],['enabled','Show this destination','checkbox']].map(function input(spec){return field(spec[0],spec[1],item[spec[0]],spec[2]);}).join('')+'</div></fieldset>';}).join('')+'</details>'+Object.keys(collectionFields).map(function collection(key){return '<details><summary>'+({services:'Services',articles:'Library readings',artworks:'Gallery artwork'})[key]+'</summary><div data-collection="'+key+'"></div><button type="button" data-add="'+key+'">Add '+({services:'service',articles:'reading',artworks:'artwork'})[key]+'</button></details>';}).join('');
 form.prepend(editor);
 editor.querySelector('[name=sa-defaultView]').value=content.defaultView;
 editor.querySelector('[name=sa-headingFont]').value=content.headingFont;
 editor.querySelector('[name=sa-bodyFont]').value=content.bodyFont;
 var records=new WeakMap();
 function addRecord(key,item) {
  var container=editor.querySelector('[data-collection='+key+']');
  var record=document.createElement('fieldset');record.className='sa-admin-record';records.set(record,item);
  record.innerHTML='<legend>'+({services:'Service',articles:'Reading',artworks:'Artwork'})[key]+'</legend>'+collectionFields[key].map(function input(spec){return field(spec[0],spec[1],item[spec[0]],spec[2]);}).join('')+'<button type="button" data-remove>Remove entry</button>';
  container.appendChild(record);
 }
 Object.keys(collectionFields).forEach(function populate(key){content[key].forEach(function record(item){addRecord(key,item);});});
 editor.addEventListener('click',function editCollection(event){var button=event.target.closest('button');if(!button)return;if(button.dataset.add){var key=button.dataset.add;addRecord(key,key==='services'?{sample:true}:{});editor.dispatchEvent(new Event('input',{bubbles:true}));}if(button.hasAttribute('data-remove')){button.closest('fieldset').remove();editor.dispatchEvent(new Event('input',{bubbles:true}));}});
 var scheduling = mountAvailabilityEditor(editor, content, function servicesForCalendar() {
  return Array.from(editor.querySelector('[data-collection=services]').children).map(function service(record) { return { id: record.querySelector('[name=id]').value.trim(), title: record.querySelector('[name=title]').value.trim() }; });
 });
 function readFields(container,base){var result=Object.assign({},base);container.querySelectorAll('input,textarea,select').forEach(function read(input){result[input.name.replace(/^sa-/,'')]=input.type==='checkbox'?input.checked:input.value.trim();});return result;}
 return { read: function readSaaelEditor(){
  var result=Object.assign({},content);
  editor.querySelectorAll('[name^=sa-]').forEach(function read(input){result[input.name.slice(3)]=input.type==='checkbox'?input.checked:input.value.trim();});
  result.destinations=destinationIds.map(function destination(id){var base=content.destinations.find(function match(item){return item.id===id;});return readFields(editor.querySelector('[data-map-id='+id+']'),base);});
  Object.keys(collectionFields).forEach(function collection(key){result[key]=Array.from(editor.querySelector('[data-collection='+key+']').children).map(function record(element){return readFields(element,records.get(element));});});
  result.currency = result.currency.toUpperCase();
  result.availability = scheduling.read();
  result.services.forEach(function numbers(service) { service.price = service.price === '' ? null : Number(service.price); service.durationMinutes = service.durationMinutes === '' ? null : Number(service.durationMinutes); });
  return result;
 }};
}
