'use strict';
const CONSENT_TEXT='I agree to receive periodic discounts and updates from Kyrgyz Organics via WhatsApp. This is optional. I can opt out at any time in My hamster or by replying STOP.';
function contact(data){
 const phone=String(data.phone||'').trim().replace(/[\s()-]/g,'');
 if(!/^\+[1-9]\d{7,14}$/.test(phone))throw Error('Enter your WhatsApp number with country code, for example +996700123456.');
 if(data.confirmNumber!==true)throw Error('Confirm that this is your WhatsApp number.');
 if(typeof data.optedIn!=='boolean')throw Error('Choose your WhatsApp message preference.');
 return {phone,optedIn:data.optedIn};
}
function template(data){
 const text=String(data.text||'').trim(),image=String(data.image||'');
 if(text.length>2000)throw Error('Keep the message under 2,000 characters.');
 if(image&&(image.length>700000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(image)))throw Error('Choose a smaller PNG, JPEG or WebP picture.');
 return {text,image};
}
module.exports={CONSENT_TEXT,contact,template};
