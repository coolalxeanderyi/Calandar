// Firebase 設定（所有版本共用這一份）
//
// 1. 到 Firebase 後台 → 專案設定 → 一般 → 你的應用程式，找到「SDK 設定和配置」。
// 2. 把裡面 firebaseConfig 的內容，照著下面的欄位貼上。
// 3. 存檔、推上 GitHub，重新整理網站就會出現「用 Google 登入」。
//
// 這些值會公開在網站上是正常的；真正保護資料的是 firestore.rules 的安全規則。
// 欄位留空的話，網站會顯示設定說明，並提供「先試用」模式。

export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};
