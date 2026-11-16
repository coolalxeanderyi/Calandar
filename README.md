# 計劃版

把任務、行事曆、目標和習慣放在同一個網站裡，用 Google 帳號登入後，手機和電腦的資料會自動同步。
版面參考 Notion 的 Planner OS 模板：上方是封面和分頁按鈕，下面是一塊一塊的區塊。
第三版（`v3/`）的名字改成「計劃版」，可以自己換配色主題，也可以把任務同步到 Google 日曆（iPhone 的「行事曆」也看得到）。

網站網址（開啟 GitHub Pages 之後）：<https://coolalxeanderyi.github.io/Calandar/>

## 功能

- **總覽**：今天和逾期的任務、本週任務（可依優先度篩選）、今天的習慣、進行中的目標、小月曆
- **任務**：依「逾期／今天／明天／接下來 7 天／之後／沒有日期」分組，可以設日期、時間、優先度、狀態、備註，並連到某個目標
- **行事曆**：月檢視和週檢視；手機上點日期就會在下方列出當天的任務；電腦上可以把任務直接拖到別天
- **目標**：依領域分組，進度可以依「相關任務完成比例」自動計算，或自己調整；顯示還剩幾天
- **習慣**：每週打卡表、目前連續天數、最長連續天數、本月完成率，以及最近 15 週的打卡紀錄
- **換主題**：頁首的主題按鈕（例如 🍓）可以從 10 套配色裡挑：草莓牛奶、抹茶拿鐵、珍珠奶茶、海鹽汽水、檸檬蘇打、藍莓優格、蜜桃烏龍、薄荷巧克力、星空、黑白簡約。每一套都有淺色和深色版本，點一下就能先預覽，吉祥物、紙膠帶、按鈕和彩紙都會跟著換顏色
- **封面**：12 種用程式畫的封面（雲朵、野餐格紋、糖霜彩針、珍珠奶茶、波點、海浪、檸檬片、星空，以及農田、海灘、梯田、沙丘空拍），格紋、彩針和波點會跟著主題換顏色
- **Google 日曆同步**：有日期的任務和目標期限會出現在 Google 日曆裡一個叫「計劃版」的日曆（只動這個日曆，不碰你其他的行程）
- **其他**：完成任務和打卡時的彩紙動畫、手機版的底部分頁列、可直接點標題改名、匯出／匯入備份、刪除後可以按「復原」、在電腦上按 <kbd>N</kbd> 可以快速新增任務
- **離線也能用**：沒有網路時照樣可以新增和打卡，連上網路後自動同步

## 第一次設定（大約 10 分鐘）

網站本身放在 GitHub Pages，資料放在 Firebase。兩邊都用免費方案就夠了，不需要信用卡。

### 1. 開啟 GitHub Pages

1. 打開這個 repo 的 **Settings → Pages**
2. **Source** 選 **Deploy from a branch**
3. **Branch** 選 `main`，資料夾選 `/ (root)`，按 **Save**
4. 等一兩分鐘，網站就會出現在 <https://coolalxeanderyi.github.io/Calandar/>

這時候打開網站，會看到「連接 Firebase 之後就能開始用」的畫面，也可以先按「先試用」看看（試用模式的資料只存在那台裝置）。

### 2. 建立 Firebase 專案

1. 到 [Firebase 主控台](https://console.firebase.google.com/)，按「建立專案」，名稱隨意（例如 `my-planner`）。Google Analytics 可以關掉。
2. 在專案首頁按網頁圖示 **`</>`**（新增網頁應用程式），取個名字後按「註冊應用程式」。不用勾 Firebase Hosting。
3. 畫面上會出現一段 `const firebaseConfig = { ... }`，先把它複製下來。

### 3. 把設定貼進 `firebase-config.js`

打開 repo 根目錄的 [`firebase-config.js`](firebase-config.js)，把剛剛複製的值填進對應的欄位，例如：

```js
export const firebaseConfig = {
  apiKey: 'AIza...',
  authDomain: 'my-planner.firebaseapp.com',
  projectId: 'my-planner',
  storageBucket: 'my-planner.firebasestorage.app',
  messagingSenderId: '1234567890',
  appId: '1:1234567890:web:abcdef',
};
```

這些值本來就會出現在網頁上，公開是正常的；真正保護資料的是下一步的安全規則。

### 4. 開啟 Google 登入

1. Firebase 主控台左側選 **Authentication（驗證）** → 「開始使用」
2. **Sign-in method（登入方式）** → 選 **Google** → 啟用 → 選一個支援用的 email → 儲存
3. **Settings（設定）** → **Authorized domains（授權網域）** → 新增 `coolalxeanderyi.github.io`

### 5. 建立資料庫並貼上安全規則

1. 左側選 **Firestore Database** → 「建立資料庫」
2. 位置選離你近的地方（例如 `europe-west2` 倫敦，或 `asia-east1` 台灣），之後不能改
3. 選「以正式版模式啟動」
4. 建立好之後切到 **規則（Rules）** 分頁，把 repo 裡 [`firestore.rules`](firestore.rules) 的內容整個貼上，按「發布」

這份規則的意思是：每個人只能讀寫自己帳號底下的資料。

### 6. 推上 GitHub，登入

把改好的 `firebase-config.js` commit 並 push。等 GitHub Pages 更新完（一兩分鐘），重新整理網站，按「用 Google 登入」就完成了。

如果你之前在這台裝置用過試用模式，第一次登入時網站會問要不要把試用資料搬到帳號裡。

### 7.（選用）同步到 Google 日曆

Firebase 專案背後就是一個 Google Cloud 專案，要在那邊打開日曆的功能：

1. 打開 [Google Calendar API 的頁面](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=calender-6f8ad)（右上角要是你建立 Firebase 的那個 Google 帳號），按 **啟用（Enable）**。
2. 建議也到 [Google Auth Platform → 資料存取（Data access）](https://console.cloud.google.com/auth/scopes?project=calender-6f8ad)，按「新增或移除範圍」，加入 `https://www.googleapis.com/auth/calendar.app.created`，再按儲存。這個權限只能「建立新的日曆，並管理這個日曆裡的行程」，看不到你其他的日曆。
3. 到 [目標對象（Audience）](https://console.cloud.google.com/auth/audience?project=calender-6f8ad) 看「發布狀態」：
   - 如果是 **測試中（Testing）**：在「測試使用者」加入你自己的 Google 帳號。測試模式的授權 7 天會過期，到時候網站會請你再按一次。
   - 如果是 **已發布（In production）**：不用改。連接時會看到「Google 尚未驗證這個應用程式」，因為這是只有你自己用的網站，按「進階」→「前往 calender-6f8ad.firebaseapp.com」就能繼續。
4. 回到網站：**設定 → Google 日曆 → 連接 Google 日曆**，允許權限後就會開始同步。

同步的規則：

- 有日期的任務會變成行程。有時間的是 1 小時的行程，開始前 10 分鐘提醒；沒有時間的是全天行程
- 進行中目標的期限會變成全天行程（名稱前面有 🎯）
- 完成的任務名稱前面會加上 ✅，顏色變灰，也不會再提醒
- 只會從網站同步到 Google 日曆（單向）。請在網站上修改；在 Google 日曆裡直接改的話，下次同步會被蓋回來

**想在 iPhone、iPad 的「行事曆」App 看到**：在 iPhone 的「設定」裡把同一個 Google 帳號加入「行事曆」（設定 → App → 行事曆 → 行事曆帳號），再用瀏覽器打開 <https://calendar.google.com/calendar/syncselect>，勾選「計劃版」並儲存。Mac 的「行事曆」App 也是一樣的做法。

## 在自己電腦上預覽

網站用的是 JavaScript 模組，不能直接雙擊 `index.html` 打開，要用一個簡單的伺服器：

```bash
cd Calandar
python3 -m http.server 8000
```

然後打開 <http://localhost:8000/>。`localhost` 預設就在 Firebase 的授權網域裡，所以本機也能登入。

## 檔案結構

```
Calandar/
├── index.html          自動轉到最新版本（現在是 v3/）
├── firebase-config.js  Firebase 設定，所有版本共用
├── firestore.rules     Firestore 安全規則（貼到 Firebase 主控台）
├── v1/                 第一版：簡潔的空拍風景風格
├── v2/                 第二版：可愛手帳風
└── v3/                 第三版：計劃版，可以換主題、同步 Google 日曆（目前使用中）
    ├── index.html
    ├── css/style.css
    ├── icons/          網站圖示（也可以加到手機主畫面）
    └── js/
        ├── app.js              進入點：登入流程、換頁、點擊事件
        ├── store.js            資料中心：讀寫任務、目標、習慣
        ├── model.js            資料格式、目標進度、習慣連續天數的計算
        ├── themes.js           10 套配色主題（淺色和深色）
        ├── gcal.js             Google 日曆同步
        ├── backend-firebase.js 雲端模式（Google 登入 + Firestore）
        ├── backend-local.js    試用模式（存在瀏覽器）
        ├── firebase-sdk.js     Firebase SDK 版本（從 CDN 載入）
        ├── covers.js           封面圖案（可愛系與空拍風景）
        ├── mascot.js           吉祥物「小日曆」
        ├── components.js       共用區塊與新增／編輯對話框
        ├── settings.js         設定、換主題、換封面
        └── views/              總覽、任務、行事曆、目標、習慣五個頁面
```

**想自己加一套主題**：打開 `v3/js/themes.js`，照著其他主題的格式在 `THEMES` 裡加一筆（名稱、emoji、淺色和深色的顏色），再到 `v3/js/model.js` 的 `PALETTE_IDS` 加上它的 `id`。

**版本規則**：之後要改版時，不要直接覆蓋舊的資料夾，而是複製成新的資料夾（例如 `v4/`）再修改，最後把根目錄 `index.html` 裡的 `./v3/` 改成新的路徑。舊版本會一直留著，網址加上 `/v1/`、`/v2/` 還是打得開。所有版本共用同一份 Firebase 資料。

## 常見問題

**按「用 Google 登入」沒反應，或說視窗被擋住**
瀏覽器擋住了彈出式視窗。請允許這個網站開啟彈出式視窗。LINE、Instagram 等 App 內建的瀏覽器常常會擋，請改用 Safari 或 Chrome 打開。

**登入時說這個網址還不能用來登入**
回到第 4 步，確認授權網域裡有 `coolalxeanderyi.github.io`。

**登入後說沒有權限讀寫資料**
回到第 5 步，確認 `firestore.rules` 的內容已經貼上並按了「發布」。

**右上角一直顯示「連線中」**
代表還連不到雲端，例如網路不穩，或 Firestore 資料庫還沒建立。這段期間的變更會先存在裝置上，連上之後自動同步。

**頁首出現「點一下同步日曆」**
Google 給網站的日曆通行證大約一小時就會過期，而這個網站沒有自己的伺服器可以在背後自動更新。有新的變更還沒送到 Google 日曆時就會出現這個按鈕，點一下、在小視窗裡確認，就會把變更送出去。

**出現「Google Calendar API 還沒啟用」**
回到第 7 步，確認 Google Calendar API 已經按了「啟用」。剛啟用可能要等幾分鐘才會生效。

**不想同步了，想把 Google 日曆裡的行程刪掉**
在網站的設定裡按「停止同步」。已經同步過去的行程會留在「計劃版」日曆裡，可以到 Google 日曆的設定裡把整個「計劃版」日曆刪除。

**資料存在哪裡？**
登入後存在你自己的 Firebase 專案（Firestore 的 `users/你的帳號ID/` 底下），只有你自己能讀寫。試用模式則只存在那台裝置的瀏覽器。設定裡可以隨時「匯出備份」成 JSON 檔。
