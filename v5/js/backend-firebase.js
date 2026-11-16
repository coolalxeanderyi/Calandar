// 雲端模式：Google 登入 + Firestore。
// 資料放在 users/{你的 uid}/ 底下，安全規則只讓本人讀寫（見 firestore.rules）。
// Firestore 會在瀏覽器裡保留一份快取，所以離線時也能用，連線後自動同步。
import { DELETE, isPlainObject } from './utils.js';

const COLS = ['tasks', 'goals', 'habits', 'reviews'];

export async function createFirebase(config, { emulators = false } = {}) {
  const fb = await import('./firebase-sdk.js');
  const app = fb.initializeApp(config);
  const auth = fb.getAuth(app);

  let db;
  try {
    db = fb.initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: fb.persistentLocalCache({ tabManager: fb.persistentMultipleTabManager() }),
    });
  } catch (err) {
    console.warn('無法啟用離線快取，改用預設設定', err);
    db = fb.getFirestore(app);
  }

  // 只在本機開發測試時連到 Firebase 模擬器（網址加上 ?emulators=1 且在 localhost）
  if (emulators) {
    fb.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    fb.connectFirestoreEmulator(db, '127.0.0.1', 8080);
    // 自動化測試用：模擬器接受未簽章的 Google 憑證
    window.__plannerEmulator = {
      signInAs: (email) =>
        fb.signInWithCredential(auth, fb.GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true }))),
      calendarToken: null, // 測試時設定一個假的通行證，就不會開 Google 的視窗
    };
  }

  return {
    auth: {
      onChange: (callback) => fb.onAuthStateChanged(auth, callback),
      signIn() {
        const provider = new fb.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        return fb.signInWithPopup(auth, provider);
      },
      signOut: () => fb.signOut(auth),
      // 跟 Google 要一張可以管理日曆的通行證（會開一個小視窗，第一次需要按「允許」）
      async requestCalendarToken(scope) {
        if (emulators && window.__plannerEmulator?.calendarToken) return window.__plannerEmulator.calendarToken;
        const user = auth.currentUser;
        if (!user) throw Object.assign(new Error('請先登入'), { code: 'auth/no-current-user' });
        const provider = new fb.GoogleAuthProvider();
        provider.addScope(scope);
        if (user.email) provider.setCustomParameters({ login_hint: user.email });
        const result = await fb.reauthenticateWithPopup(user, provider);
        return fb.GoogleAuthProvider.credentialFromResult(result)?.accessToken || null;
      },
    },
    dataFor: (uid) => createCloudBackend(fb, db, uid),
  };
}

function createCloudBackend(fb, db, uid) {
  const unsubs = [];
  const pending = {};
  const cached = {};
  let h = null;

  const colRef = (c) => fb.collection(db, 'users', uid, c);
  const docRef = (c, id) => fb.doc(db, 'users', uid, c, id);
  const settingsRef = () => fb.doc(db, 'users', uid, 'meta', 'settings');

  // { log: { '2026-11-16': DELETE } } → FieldPath('log','2026-11-16'), deleteField()
  function flatten(patch, path = [], out = []) {
    for (const [key, value] of Object.entries(patch)) {
      const p = [...path, key];
      if (isPlainObject(value) && Object.keys(value).length) flatten(value, p, out);
      else out.push(new fb.FieldPath(...p), value === DELETE ? fb.deleteField() : value);
    }
    return out;
  }

  function convert(value) {
    if (value === DELETE) return fb.deleteField();
    if (isPlainObject(value)) {
      const out = {};
      for (const [k, v] of Object.entries(value)) out[k] = convert(v);
      return out;
    }
    return value;
  }

  // 同步狀態：沒網路 → 離線；資料還沒跟雲端確認過 → 連線中；有變更還沒送出 → 同步中
  function updateSync() {
    if (!h) return;
    const offline = navigator.onLine === false;
    const fromCache = Object.values(cached).some(Boolean);
    const busy = Object.values(pending).some(Boolean);
    h.onSync(offline ? 'offline' : fromCache ? 'connecting' : busy ? 'pending' : 'synced');
  }

  const fail = (err) => h?.onError(err);

  return {
    kind: 'cloud',
    start(handlers) {
      h = handlers;
      for (const c of COLS) {
        unsubs.push(
          fb.onSnapshot(colRef(c), { includeMetadataChanges: true }, (snap) => {
            pending[c] = snap.metadata.hasPendingWrites;
            cached[c] = snap.metadata.fromCache;
            h?.onCollection(c, snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            updateSync();
          }, fail),
        );
      }
      unsubs.push(
        fb.onSnapshot(settingsRef(), { includeMetadataChanges: true }, (snap) => {
          pending.settings = snap.metadata.hasPendingWrites;
          cached.settings = snap.metadata.fromCache;
          h?.onSettings(snap.exists() ? snap.data() : {});
          updateSync();
        }, fail),
      );
      window.addEventListener('online', updateSync);
      window.addEventListener('offline', updateSync);
    },
    stop() {
      for (const u of unsubs.splice(0)) u();
      window.removeEventListener('online', updateSync);
      window.removeEventListener('offline', updateSync);
      h = null;
    },
    // 寫入會先更新畫面（本機快取），再在背景送到雲端，所以這裡不等待伺服器回應
    set: (c, id, data) => fb.setDoc(docRef(c, id), data),
    patch: (c, id, patch) => fb.updateDoc(docRef(c, id), ...flatten(patch)),
    remove: (c, id) => fb.deleteDoc(docRef(c, id)),
    setSettings: (patch) => fb.setDoc(settingsRef(), convert(patch), { merge: true }),
    setMany(items) {
      for (let i = 0; i < items.length; i += 400) {
        const batch = fb.writeBatch(db);
        for (const [c, id, data] of items.slice(i, i + 400)) batch.set(docRef(c, id), data);
        batch.commit().catch(fail);
      }
      return Promise.resolve();
    },
    // 用來判斷新帳號是否還沒有任何資料（決定要不要詢問搬移試用資料）
    async isEmpty() {
      for (const c of COLS) {
        const snap = await fb.getDocsFromServer(fb.query(colRef(c), fb.limit(1)));
        if (!snap.empty) return false;
      }
      return true;
    },
  };
}
