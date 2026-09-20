import {app} from './firebase-config.js';
import {getAuth,onAuthStateChanged,signInAnonymously,signInWithEmailAndPassword,EmailAuthProvider,PhoneAuthProvider,RecaptchaVerifier,signInWithCredential,linkWithCredential,sendEmailVerification,sendPasswordResetEmail,signOut,reload} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js';
const auth=getAuth(app),call= httpsCallable(getFunctions(app),'hamsterGame',{timeout:20000});
const id=()=>Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16).padStart(8,'0')).join('');
export const account=()=>auth.currentUser;
export async function boot(){await new Promise(resolve=>{const stop=onAuthStateChanged(auth,()=>{stop();resolve();});});if(!auth.currentUser)await signInAnonymously(auth);return load();}
export async function load(){return (await call({action:'load'})).data;}
export async function mutate(action,payload={}){
 const key=`hg_pending_${auth.currentUser.uid}_${action}`,fingerprint=JSON.stringify(payload);
 let pending;try{pending=JSON.parse(localStorage.getItem(key));}catch{}
 if(!pending||pending.fingerprint!==fingerprint)pending={requestId:id(),fingerprint};
 localStorage.setItem(key,JSON.stringify(pending));
 try{const {data}=await call({action,...payload,requestId:pending.requestId});localStorage.removeItem(key);return data;}catch(error){if(!['functions/unavailable','functions/deadline-exceeded','functions/internal'].includes(error.code))localStorage.removeItem(key);throw error;}
}
export async function register(email,password,contact){if(password.length<8)throw new Error('Use a password with at least 8 characters.');await mutate('contact',contact);await linkWithCredential(auth.currentUser,EmailAuthProvider.credential(email,password));await sendEmailVerification(auth.currentUser);return load();}
export async function login(email,password){await signInWithEmailAndPassword(auth,email,password);return load();}
export async function refreshVerification(){await reload(auth.currentUser);await auth.currentUser.getIdToken(true);return load();}
export async function resendVerification(){await sendEmailVerification(auth.currentUser);}
export async function resetPassword(email){await sendPasswordResetEmail(auth,email);}
export async function logout(){await signOut(auth);await signInAnonymously(auth);return load();}
let phoneVerifier=null,phoneSession=null,phoneGeneration=0,lastSmsAt=0;
export function cancelPhone(){phoneGeneration++;phoneSession=null;phoneVerifier?.clear();phoneVerifier=null;}
export async function sendPhoneCode(raw,mode,contact){
 const phone=String(raw||'').replace(/[\s()-]/g,'');if(!/^\+996\d{9}$/.test(phone))throw Error('Enter a Kyrgyzstan mobile number with +996 and nine digits.');
 if(Date.now()-lastSmsAt<60000)throw Error('Please wait one minute before requesting another code.');
 if(!['register','login'].includes(mode))throw Error('Choose registration or sign-in.');
 cancelPhone();const generation=phoneGeneration,uid=auth.currentUser?.uid;
 phoneVerifier=new RecaptchaVerifier(auth,'phone-recaptcha',{size:'normal'});
 try{const verificationId=await new PhoneAuthProvider(auth).verifyPhoneNumber(phone,phoneVerifier);if(generation!==phoneGeneration)throw Error('Phone sign-in cancelled.');phoneSession={verificationId,phone,mode,uid,contact};lastSmsAt=Date.now();return phone;}finally{phoneVerifier?.clear();phoneVerifier=null;}
}
export async function confirmPhoneCode(code,useExisting=false){
 const s=phoneSession;if(!s)throw Error('Request a new SMS code.');if(!/^\d{6}$/.test(code))throw Error('Enter the six-digit SMS code.');
 const credential=PhoneAuthProvider.credential(s.verificationId,code);
 if(s.mode==='register'&&!useExisting){if(auth.currentUser?.uid!==s.uid||!auth.currentUser.isAnonymous)throw Error('Your account changed. Start registration again.');await linkWithCredential(auth.currentUser,credential);}else await signInWithCredential(auth,credential);
 phoneSession=null;let result=await load();if(s.mode==='register'&&!useExisting)result=await mutate('contact',s.contact);return result;
}
