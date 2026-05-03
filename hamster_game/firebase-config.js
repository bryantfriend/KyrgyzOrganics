import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB2azgMx3VRCqKTVj4zhdqv51o6w1cAtxI",
  authDomain: "oa-kyrgyz-organic.firebaseapp.com",
  projectId: "oa-kyrgyz-organic",
  storageBucket: "oa-kyrgyz-organic.firebasestorage.app",
  messagingSenderId: "350088203372",
  appId: "1:350088203372:web:128e39d7f0cebc5be51c49",
  measurementId: "G-HD4B2XSVVT"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false
});

export { app, db };
