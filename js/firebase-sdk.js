// Firebase SDK（從 Google 的 CDN 載入，不需要安裝任何東西）
// 要升級 Firebase 版本時，只要把下面三個網址裡的 13.3.0 換掉。
export { initializeApp } from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js';
export {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  reauthenticateWithPopup,
  signInWithCredential,
  signOut,
  onAuthStateChanged,
  connectAuthEmulator,
} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js';
export {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  query,
  limit,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  FieldPath,
  writeBatch,
  getDocsFromServer,
  connectFirestoreEmulator,
} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js';
