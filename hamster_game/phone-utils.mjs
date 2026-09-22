export function normalizePhone(raw){
 let phone=String(raw||'').trim().replace(/[\s()-]/g,'');
 if(/^0\d{9}$/.test(phone))phone='+996'+phone.slice(1);
 else if(/^[1-9]\d{8}$/.test(phone))phone='+996'+phone;
 else if(/^996\d{9}$/.test(phone))phone='+'+phone;
 if(!/^\+996[1-9]\d{8}$/.test(phone))throw Error('Enter a Kyrgyzstan number, for example 0700 123 456 or +996 700 123 456.');
 return phone;
}
export function phoneError(error){
 const code=error?.code||'';
 const messages={
  'auth/captcha-check-failed':'The security check expired or failed. Try again and complete the new security check.',
  'auth/invalid-app-credential':'Firebase could not verify the browser security check. Refresh the page and try again. If it repeats, use email sign-in and share this error code with us.',
  'auth/missing-app-credential':'The browser security check did not finish. Refresh the page and try again.',
  'auth/network-request-failed':'The request could not reach Firebase. Check your connection and try again.',
  'auth/too-many-requests':'Firebase temporarily blocked further attempts. Wait before trying again, or use email sign-in.',
  'auth/quota-exceeded':'SMS verification is temporarily unavailable because the Firebase SMS limit was reached. Please use email sign-in.',
  'auth/billing-not-enabled':'SMS verification is unavailable because Firebase billing needs attention. Please use email sign-in.',
  'auth/operation-not-allowed':'Firebase is not allowing phone sign-in. Please use email sign-in and share this error code with us.',
  'auth/unauthorized-domain':'This website is not authorized for phone sign-in. Open https://oako.kg/hamster_game/ and try again.',
  'auth/app-not-authorized':'Firebase rejected this website’s authentication settings. Please use email sign-in and share this error code with us.',
  'auth/invalid-phone-number':'Check your Kyrgyzstan mobile number, including all nine digits after +996.',
  'auth/invalid-verification-code':'That SMS code is incorrect. Check the six digits and try again.',
  'auth/code-expired':'That SMS code expired. Request a new code.',
  'auth/session-expired':'That SMS code expired. Request a new code.',
  'auth/credential-already-in-use':'This number already has an account. Choose “Sign in to the existing phone account” below to restore its progress.'
 };
 return (messages[code]||error?.message||'Phone sign-in could not finish. Please try again.')+(code?` (${code})`:'');
}
