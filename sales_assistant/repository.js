import { auth, db } from "../firebase-config.js";
import * as firestore from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { login } from "../tenant-auth.js";
import { createRepository } from "./repository-core.mjs";
const repository = createRepository(firestore, db, auth);
const signIn = login;
function logout() {
  return signOut(auth);
}
function observeSession(callback) {
  let stopProfile = function() {
  };
  let generation = 0;
  let profileTimer;
  const stopAuth = onAuthStateChanged(auth, function(user) {
    generation += 1;
    const current = generation;
    stopProfile();
    clearTimeout(profileTimer);
    callback(null, null, !!user);
    if (!user) return;
    profileTimer = setTimeout(function() {
      if (current === generation) callback(null, { code: "timeout" }, false);
    }, 18e3);
    stopProfile = firestore.onSnapshot(firestore.doc(db, "users", user.uid), { includeMetadataChanges: true }, function(snapshot) {
      if (snapshot.metadata.fromCache || current !== generation) return;
      clearTimeout(profileTimer);
      callback(snapshot.exists() ? { ...snapshot.data(), uid: user.uid } : { uid: user.uid, role: "" }, null, false);
    }, function(error) {
      clearTimeout(profileTimer);
      if (current === generation) callback(null, error, false);
    });
  });
  return function() {
    clearTimeout(profileTimer);
    stopProfile();
    stopAuth();
  };
}
export {
  logout,
  observeSession,
  repository,
  signIn
};
