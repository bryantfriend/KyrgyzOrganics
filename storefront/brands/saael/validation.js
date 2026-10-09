import { destinationIds } from './content.js';
import { validateScheduling } from './calendar-data.js';
export function validateSaaelContent(content) {
 if (!content || typeof content !== 'object' || Array.isArray(content)) return ['Website settings must be an object.'];
 var errors=[];
 ['exploreLabel','servicesLabel','communityLabel','exploreServicesLabel','availabilityLabel','servicesTitle','servicesIntroduction','searchLabel','searchPlaceholder','headline','strapline','welcome','invitation','bookingLabel','bookingTitle','bookingText','bookingNotice','footerText','logoUrl'].forEach(function text(key){if(typeof content[key]!=='string'||content[key].length>12000)errors.push('Invalid '+key+'.');});
 ['textColor','accentColor','backgroundColor'].forEach(function color(key){if(!/^#[0-9a-f]{6}$/i.test(content[key]))errors.push('Invalid '+key+'.');});
 if(!['Georgia','Times New Roman','Palatino Linotype'].includes(content.headingFont)||!['Arial','Verdana','Tahoma'].includes(content.bodyFont))errors.push('Choose one of the available typefaces.');
 if (!content.headline || !content.bookingLabel) errors.push('Headline and booking button text are required.');
 function imageUrl(value,label){if(typeof value!=='string'||!/^https?:\/\//i.test(value))errors.push(label+' must be a complete HTTP or HTTPS URL.');}
 imageUrl(content.logoUrl,'Logo');
 if(!['map','list'].includes(content.defaultView)||typeof content.motion!=='boolean')errors.push('Invalid view or animation setting.');
 if(!Array.isArray(content.destinations)||content.destinations.length!==7)errors.push('All seven destination settings are required.');
 else destinationIds.forEach(function destination(id){var matches=content.destinations.filter(function match(item){return item&&item.id===id;});var item=matches[0];if(matches.length!==1||!item.title||typeof item.title!=='string'||typeof item.subtitle!=='string'||typeof item.introduction!=='string'||!/^#[0-9a-f]{6}$/i.test(item.color)||typeof item.enabled!=='boolean')errors.push('Check the '+id+' destination.');});
 ['services','articles','artworks'].forEach(function collection(key){var items=content[key];if(!Array.isArray(items)||items.length>100){errors.push(key+' must have at most 100 entries.');return;}items.forEach(function item(entry){if(!entry||typeof entry.title!=='string'||!entry.title.trim()){errors.push('Every '+key+' entry needs a title.');return;}var fields=key==='services'?['id','description','details']:key==='articles'?['summary','body']:['caption','imageUrl'];fields.forEach(function text(field){if(typeof entry[field]!=='string'||entry[field].length>12000)errors.push('Check '+key+' '+field+'.');});if(key==='artworks')imageUrl(entry.imageUrl,'Artwork');if(key==='services'&&typeof entry.sample!=='boolean')errors.push('Choose whether the service is a sample.');});});
 if(Array.isArray(content.services)){var ids=content.services.map(function id(item){return item && item.id;});if(ids.some(function duplicate(id,index){return !id||ids.indexOf(id)!==index;}))errors.push('Each service needs a unique reference ID.');}
 if(JSON.stringify(content).length>500000)errors.push('Settings are too large. Link to media rather than embedding it.');
 return errors.concat(validateScheduling(content));
}
