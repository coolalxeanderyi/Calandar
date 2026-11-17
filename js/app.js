// 網站進入點：決定要顯示登入畫面還是主畫面、處理換頁與所有點擊
import { store } from './store.js';
import { esc, todayKey, fmtMonthDay } from './utils.js';
import { icon, toast, confirmDialog, celebrateAt } from './ui.js';
import { coverSVG } from './covers.js';
import { createLocalBackend, hasLocalData, localItems, readLocalData } from './backend-local.js';
import { createFirebase } from './backend-firebase.js';
import { toStored, normalizeSettings, usesMascot, isDone, isScheduled, listTasks } from './model.js';
import { mascot } from './mascot.js';
import { openTaskModal, openGoalModal, openHabitModal, openEventModal, updateQuickPreview } from './components.js';
import { moveTo } from './views/tasks.js';
import { initTimeline, deferRender } from './timeline.js';
import { openSettings, openCoverPicker, openThemePicker } from './settings.js';
import { applyAppearance, cachedPalette, savedMode, getTheme, tintFor, onSystemThemeChange } from './themes.js';
import { initGcal, gcalState, onGcalChange, connect as gcalConnect, run as gcalRun, hasToken as gcalHasToken, forgetToken as gcalForgetToken } from './gcal.js';
import dashboard from './views/dashboard.js';
import tasks from './views/tasks.js';
import calendar from './views/calendar.js';
import goals from './views/goals.js';
import habits from './views/habits.js';
import review from './views/review.js';
import { startAutoUpdate } from './update.js';
import { bridgeOn, onExternalChange, startExternal, clearExternal, findEvent } from './gsync.js';

const MODE_KEY = 'planner.v1.mode';
const README_URL = 'https://github.com/coolalxeanderyi/Calandar#readme';

const VIEWS = { '': dashboard, tasks, calendar, goals, habits, review };
const NAV = [
  ['', '總覽', '🏠'],
  ['tasks', '任務', '✅'],
  ['calendar', '行事曆', '📅'],
  ['goals', '目標', '🎯'],
  ['habits', '習慣', '🌱'],
  ['review', '回顧', '📝'],
];
const SYNC_TEXT = {
  synced: ['已同步', '資料已經存到雲端'],
  pending: ['同步中', '正在把變更存到雲端'],
  connecting: ['連線中', '正在連到雲端，變更會先存在這台裝置，連上後自動同步'],
  offline: ['離線', '目前沒有網路，變更會先存在這台裝置，連線後自動同步'],
  local: ['試用模式', '資料只存在這台裝置的瀏覽器'],
};

const root = document.getElementById('app');
const drafts = new Map();
let firebase = null;
let configured = false;
let currentView = null;
let currentHash = null;
let headSig = '';
let editingTitle = false;
let lastToday = todayKey();
let dragId = null;

// ---------- 配色主題 ----------
// 設定還沒載入前，先用這台裝置上次的配色；換主題的視窗開著時，用正在預覽的配色
let preview = null; // { palette, theme, coverStyle, until? }
let previewTimer = null;

function currentLook() {
  const ready = store.state.status === 'ready';
  const s = store.state.settings;
  return {
    palette: preview?.palette ?? (ready ? s.palette : cachedPalette()),
    theme: preview?.theme ?? (ready ? s.theme : savedMode()),
    coverStyle: preview?.coverStyle ?? s.coverStyle,
  };
}

function refreshLook() {
  const look = currentLook();
  applyAppearance(look.palette, look.theme);
  renderHead();
}

const lookPreview = {
  set(next) {
    clearTimeout(previewTimer);
    preview = next ? { ...next } : null;
    refreshLook();
  },
  // 按下「套用」：等設定真的存好再拿掉預覽，避免一瞬間閃回舊的顏色
  keepUntilSaved(saved) {
    preview = { ...preview, ...saved, until: true };
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => lookPreview.set(null), 4000);
    refreshLook();
  },
};

function settlePreview() {
  if (!preview?.until) return;
  const s = store.state.settings;
  const same = ['palette', 'theme', 'coverStyle'].every((k) => preview[k] === undefined || preview[k] === s[k]);
  if (same) {
    clearTimeout(previewTimer);
    preview = null;
  }
}

// ---------- 啟動 ----------
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (location.protocol !== 'https:' && !local) return;
  // 自動化測試時預設不裝（網址加 ?sw=1 才裝），免得快取影響測試
  if (navigator.webdriver && !new URLSearchParams(location.search).has('sw')) return;
  navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('無法啟用離線功能', err));
  // 清掉舊版資料夾（/v5/、/v6/、/v7/…）留下來的離線功能和設定，那些網址現在都會回到首頁
  navigator.serviceWorker.getRegistrations?.().then((regs) => {
    for (const reg of regs) if (/\/v\d+\/$/.test(new URL(reg.scope).pathname)) reg.unregister();
  }).catch(() => {});
  try {
    localStorage.removeItem('planner.latestPath');
  } catch { /* 無痕模式 */ }
}

// 正在輸入或開著視窗時，自動更新會先問一聲
function isBusy() {
  if (document.getElementById('modal-root')?.children.length) return true;
  const el = document.activeElement;
  return !!el?.closest?.('input, textarea, select, [contenteditable="true"]');
}

async function boot() {
  registerServiceWorker();
  startAutoUpdate({ isBusy });
  applyAppearance(cachedPalette(), savedMode());
  wireEvents();
  store.onError(handleError);
  store.subscribe(onStateChange);

  const config = await loadConfig();
  configured = isConfigured(config);
  projectId = configured ? config.projectId : '';

  if (localStorage.getItem(MODE_KEY) === 'demo') {
    startDemo();
    return;
  }
  if (!configured) {
    renderGate('setup');
    return;
  }
  renderGate('loading');
  try {
    const params = new URLSearchParams(location.search);
    const emulators = params.has('emulators') && ['localhost', '127.0.0.1'].includes(location.hostname);
    firebase = await createFirebase(config, { emulators });
    initGcal(firebase.auth);
  } catch (err) {
    console.error(err);
    renderGate('error', '載入 Firebase 失敗。請確認網路連線，或檢查 firebase-config.js 的內容是否完整。');
    return;
  }
  firebase.auth.onChange((user) => {
    if (user) startCloud(user);
    else {
      store.disconnect();
      renderGate('login');
    }
  });
}

async function loadConfig() {
  // 先抓最新的設定檔（避免瀏覽器還留著舊版），離線時再退回快取
  for (const url of [`../firebase-config.js?v=${Date.now()}`, '../firebase-config.js']) {
    try {
      const mod = await import(url);
      if (mod.firebaseConfig) return mod.firebaseConfig;
    } catch (err) {
      console.warn('讀不到 firebase-config.js', err);
    }
  }
  return null;
}

function isConfigured(c) {
  return !!(c && typeof c.apiKey === 'string' && c.apiKey && c.projectId && c.appId);
}

function startDemo() {
  localStorage.setItem(MODE_KEY, 'demo');
  store.connect(createLocalBackend(), { mode: 'demo' });
  renderShell();
}

function leaveDemo() {
  localStorage.removeItem(MODE_KEY);
  location.reload();
}

function startCloud(user) {
  if (store.state.mode === 'cloud' && store.state.user?.uid === user.uid && store.state.status !== 'idle') return;
  const data = firebase.dataFor(user.uid);
  store.connect(data, { mode: 'cloud', user: { uid: user.uid, email: user.email, name: user.displayName } });
  renderShell();
  offerMigration(data, user.uid);
}

async function signOut() {
  const ok = await confirmDialog('登出後，這台裝置會回到登入畫面。你的資料仍然存在雲端。', { title: '要登出嗎？', confirmLabel: '登出' });
  if (!ok) return;
  try {
    gcalForgetToken();
    clearExternal();
    await firebase.auth.signOut();
    toast('已登出');
  } catch (err) {
    handleError(err);
  }
}

// 第一次登入時，如果這台裝置有試用模式的資料，問要不要搬到帳號裡
async function offerMigration(data, uid) {
  const flag = `planner.v1.migrated.${uid}`;
  if (localStorage.getItem(flag) || !hasLocalData()) return;
  let empty;
  try {
    empty = await data.isEmpty();
  } catch {
    return; // 離線時下次再問
  }
  if (!empty) {
    localStorage.setItem(flag, '1');
    return;
  }
  const items = localItems().map(([c, id, doc]) => [c, id, toStored(c, { ...doc, id })]);
  const ok = await confirmDialog(`這台裝置上有 ${items.length} 筆試用模式的資料。搬過去之後，就能在其他裝置看到。`, {
    title: '要把試用資料搬到你的帳號嗎？',
    confirmLabel: '搬到我的帳號',
  });
  localStorage.setItem(flag, '1');
  if (!ok) return;
  await data.setMany(items);
  const { settings } = readLocalData();
  if (Object.keys(settings).length) store.saveSettings(normalizeSettings(settings));
  toast(`已搬移 ${items.length} 筆資料`);
}

// ---------- 錯誤訊息 ----------
const AUTH_ERRORS = {
  'auth/popup-blocked': '瀏覽器擋住了登入視窗。請允許這個網站開啟彈出式視窗，再試一次。',
  'auth/unauthorized-domain': `這個網址還不能用來登入。請到 Firebase 後台的 Authentication → Settings → Authorized domains，加入「${location.hostname}」。`,
  'auth/operation-not-allowed': 'Firebase 還沒開啟 Google 登入。請到 Authentication → Sign-in method 啟用 Google。',
  'auth/network-request-failed': '連不上網路，請確認連線後再試一次。',
  'auth/invalid-api-key': 'firebase-config.js 裡的 apiKey 不正確，請重新從 Firebase 後台複製設定。',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'firebase-config.js 裡的 apiKey 不正確，請重新從 Firebase 後台複製設定。',
  'auth/configuration-not-found': 'Firebase 還沒開啟 Authentication。請到 Firebase 後台的 Authentication 按「開始使用」，再啟用 Google 登入。',
};
const DATA_ERRORS = {
  'permission-denied': '沒有權限讀寫資料。請確認已把 firestore.rules 的內容貼到 Firestore 的「規則」並發布。',
  'not-found': '找不到資料庫或這筆資料。請確認 Firebase 後台已建立 Firestore 資料庫。',
  'resource-exhausted': '今天的免費額度用完了，明天會自動恢復。',
  'failed-precondition': 'Firestore 還沒準備好。請確認已在 Firebase 後台建立 Firestore 資料庫。',
};
let lastError = { text: '', at: 0 };
let loadError = '';

function handleError(err) {
  const code = err?.code || '';
  if (code === 'unavailable') return; // 離線，Firestore 會自動重試
  const text = DATA_ERRORS[code] || AUTH_ERRORS[code] || err?.message || '發生錯誤，請再試一次。';
  // 資料還沒載入就出錯（通常是 Firebase 還沒設定好），直接在畫面上說明，不要一直顯示「載入中」
  if (store.state.status === 'loading' && DATA_ERRORS[code]) {
    loadError = text;
    renderView();
  }
  if (text === lastError.text && Date.now() - lastError.at < 5000) return;
  lastError = { text, at: Date.now() };
  toast(text, { tone: 'error', duration: 8000 });
}

// ---------- 登入前的畫面 ----------
function renderGate(kind, message = '') {
  currentView = null;
  currentHash = null;
  headSig = '';
  document.title = '計劃版';
  let text = '';
  let actions = '';
  let note = '';
  if (kind === 'loading') {
    text = '載入中…';
  } else if (kind === 'setup') {
    text = '這個網站用 Firebase 儲存資料，讓手機和電腦同步。照著 README 的步驟建立 Firebase 專案，把設定貼進 firebase-config.js，再重新整理這一頁。';
    actions = `<a class="btn primary" href="${README_URL}" target="_blank" rel="noopener">查看設定步驟</a>
      <button type="button" class="btn" data-gate="demo">先試用</button>`;
    note = '試用模式的資料只存在這台裝置。設定好 Firebase 之後登入，可以把資料搬到你的帳號。';
  } else if (kind === 'login') {
    text = '登入之後，你的任務、目標和習慣會在所有裝置之間同步。';
    actions = `<button type="button" class="btn primary btn-google" data-gate="signin">${icon('google')}用 Google 登入</button>
      <button type="button" class="btn ghost" data-gate="demo">先試用，不登入</button>`;
  } else if (kind === 'error') {
    text = message;
    actions = '<button type="button" class="btn primary" data-gate="reload">重新載入</button>';
  }
  root.innerHTML = `
    <div class="gate">
      <div class="gate-cover" aria-hidden="true">${gateCover()}</div>
      <main class="gate-card"${kind === 'loading' ? ' aria-busy="true"' : ''}>
        <div class="gate-icon" aria-hidden="true">${mascot(kind === 'error' ? 'sleepy' : 'wave', { size: 92 })}</div>
        <h1 class="gate-title">計劃版</h1>
        <p class="gate-text">${esc(text)}</p>
        <p class="gate-error" role="alert" hidden></p>
        ${actions ? `<div class="gate-actions">${actions}</div>` : ''}
        ${note ? `<p class="gate-note">${esc(note)}</p>` : ''}
      </main>
    </div>`;
}

function gateCover() {
  const palette = cachedPalette();
  const style = getTheme(palette).cover;
  return coverSVG(style, 8, 'gate', { width: 1400, height: 1000, tint: tintFor(style, palette) });
}

function gateError(message) {
  const el = root.querySelector('.gate-error');
  if (!el) return toast(message, { tone: 'error', duration: 8000 });
  el.textContent = message;
  el.hidden = false;
}

async function onGateClick(btn) {
  const what = btn.dataset.gate;
  if (what === 'demo') startDemo();
  else if (what === 'reload') location.reload();
  else if (what === 'signin') {
    btn.disabled = true;
    try {
      await firebase.auth.signIn();
    } catch (err) {
      const code = err?.code || '';
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        gateError(AUTH_ERRORS[code] || `登入失敗（${code || err.message}）`);
      }
    } finally {
      btn.disabled = false;
    }
  }
}

// ---------- 主畫面 ----------
function renderShell() {
  loadError = '';
  headSig = '';
  currentView = null;
  currentHash = null;
  root.innerHTML = `
    <div class="shell">
      <header class="page-head">
        <div class="cover" data-cover></div>
        <div class="page-head-inner">
          <div class="page-icon" data-page-icon aria-hidden="true"></div>
          <div class="title-row">
            <h1 class="page-title" data-page-title></h1>
            <div class="head-tools">
              <button type="button" class="sync-pill" data-action="open-settings" data-sync></button>
              <button type="button" class="head-pill gcal-pill" data-action="gcal-pill" data-gcal hidden></button>
              <button type="button" class="head-pill theme-pill" data-action="open-themes" data-theme-pill></button>
              <button type="button" class="icon-btn" data-action="open-settings" aria-label="設定">${icon('settings')}</button>
            </div>
          </div>
        </div>
      </header>
      <nav class="tabs" aria-label="主要頁面">
        <div class="tabs-inner">
          ${NAV.map(([path, label, emoji]) => `<a class="tab" href="#/${path}" data-tab="${path}"><span class="tab-emoji" aria-hidden="true">${emoji}</span><span class="tab-label">${label}</span></a>`).join('')}
        </div>
      </nav>
      <main id="view" class="view" tabindex="-1"></main>
    </div>`;
  renderHead();
  renderView();
}

const GCAL_TEXT = {
  synced: ['已同步日曆', '有日期的任務已經同步到 Google 日曆。點一下開啟設定'],
  waiting: ['同步日曆中…', '正在把變更送到 Google 日曆'],
  syncing: ['同步日曆中…', '正在把變更送到 Google 日曆'],
  'need-auth': ['點一下同步日曆', '有變更還沒送到 Google 日曆，Google 需要你再確認一次'],
  error: ['日曆同步失敗', '同步到 Google 日曆時出了問題，點一下看看原因'],
};

function renderGcalPill() {
  const pill = root.querySelector('[data-gcal]');
  if (!pill) return;
  const st = gcalState();
  const on = store.state.mode === 'cloud' && store.state.status === 'ready' && store.state.settings.gcalOn && st.phase !== 'off';
  pill.hidden = !on;
  if (!on) return;
  const [label, detail] = GCAL_TEXT[st.phase] || GCAL_TEXT.synced;
  pill.className = `head-pill gcal-pill gcal-${st.phase}`;
  pill.innerHTML = `${icon('calendar')}<span class="pill-text">${label}</span>`;
  pill.title = st.phase === 'error' && st.message ? st.message : detail;
  pill.setAttribute('aria-label', `Google 日曆：${label}。${pill.title}`);
}

function renderHead() {
  if (editingTitle || !root.querySelector('.shell')) return;
  const { settings: s, sync, mode, status } = store.state;
  const look = currentLook();
  const ready = status === 'ready';
  const sig = JSON.stringify([s.title, s.icon, look.coverStyle, s.coverSeed, look.palette, sync, mode, ready]);
  renderGcalPill();
  if (sig === headSig) return;
  headSig = sig;
  const tint = tintFor(look.coverStyle, look.palette);
  // 設定還沒載入時先不畫封面，免得先出現預設的雲朵再換掉
  root.querySelector('[data-cover]').innerHTML = ready
    ? `${coverSVG(look.coverStyle, s.coverSeed, 'head', { tint })}
    <button type="button" class="cover-btn" data-action="open-cover">${icon('image')}換封面</button>`
    : '';
  const theme = getTheme(look.palette);
  const themePill = root.querySelector('[data-theme-pill]');
  themePill.innerHTML = `<span class="pill-emoji" aria-hidden="true">${theme.emoji}</span><span class="pill-text">換主題</span>`;
  themePill.setAttribute('aria-label', `換主題（目前是${theme.name}）`);
  themePill.title = `換主題（目前是${theme.name}）`;
  const iconEl = root.querySelector('[data-page-icon]');
  iconEl.classList.toggle('is-mascot', usesMascot(s.icon));
  iconEl.innerHTML = usesMascot(s.icon) ? mascot('smile', { size: 92 }) : esc(s.icon);
  root.querySelector('[data-page-title]').innerHTML = `<button type="button" class="title-btn" data-action="edit-title" title="點一下修改標題">${esc(s.title)}</button>`;
  const [label, detail] = SYNC_TEXT[sync] || SYNC_TEXT.synced;
  const pill = root.querySelector('[data-sync]');
  pill.className = `sync-pill sync-${sync}`;
  pill.innerHTML = `<i aria-hidden="true"></i>${label}`;
  pill.title = detail;
  pill.setAttribute('aria-label', `${label}：${detail}。開啟設定`);
  document.title = s.title;
}

function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs = ''] = raw.split('?');
  return { name: path in VIEWS ? path : '', params: new URLSearchParams(qs) };
}

function ctx() {
  return { rerender: renderView, clearDrafts, forgetDrafts: (keys) => keys.forEach((k) => drafts.delete(k)) };
}

let pendingFocus = null;
function focusPending() {
  if (!pendingFocus) return;
  const target = document.querySelector(pendingFocus);
  pendingFocus = null;
  target?.focus();
}

function renderView() {
  const el = document.getElementById('view');
  if (!el) return;
  if (deferRender()) return; // 正在拖曳時間軸上的任務：放開之後再畫
  const { name, params } = parseRoute();
  const view = VIEWS[name];
  if (location.hash !== currentHash || view !== currentView) {
    currentHash = location.hash;
    currentView = view;
    view.enter?.(params);
    for (const tab of root.querySelectorAll('[data-tab]')) {
      const on = tab.dataset.tab === name;
      tab.classList.toggle('is-active', on);
      if (on) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }
  }
  if (store.state.status !== 'ready') {
    el.innerHTML = loadError
      ? `<div class="load-error" role="alert"><p>${esc(loadError)}</p><button type="button" class="btn" data-gate="reload">重新載入</button></div>`
      : '<p class="loading" aria-busy="true">載入中…</p>';
    return;
  }

  // 重畫之前記住正在輸入的欄位，畫完再放回去
  const active = document.activeElement;
  const keep = el.contains(active) ? active?.dataset?.keep : null;
  let selection = null;
  if (keep) {
    try {
      selection = [active.selectionStart, active.selectionEnd];
    } catch { /* 日期欄位沒有選取範圍 */ }
  }
  el.innerHTML = view.render(store.state, ctx());
  for (const input of el.querySelectorAll('[data-keep]')) {
    if (drafts.has(input.dataset.keep)) input.value = drafts.get(input.dataset.keep);
  }
  for (const input of el.querySelectorAll('[data-quick]')) if (input.value) updateQuickPreview(input);
  focusPending();
  if (keep) {
    const again = el.querySelector(`[data-keep="${keep}"]`);
    if (again) {
      again.focus({ preventScroll: true });
      if (selection && selection[0] !== null) {
        try {
          again.setSelectionRange(...selection);
        } catch { /* 有些欄位不支援 */ }
      }
    }
  }
}

function clearDrafts(form, keys) {
  for (const input of form.querySelectorAll('[data-keep]')) {
    if (keys && !keys.includes(input.dataset.keep)) continue;
    drafts.delete(input.dataset.keep);
    input.value = input.tagName === 'SELECT' ? input.options[0]?.value ?? '' : '';
  }
}

function onStateChange() {
  if (!root.querySelector('.shell')) return;
  settlePreview();
  refreshLook();
  renderView();
}

function onRoute() {
  if (!root.querySelector('.shell')) return;
  renderView();
  // 換頁時捲到內容開頭（桌機的導覽列黏在上方，要扣掉它的高度）
  const view = document.getElementById('view');
  const nav = root.querySelector('.tabs');
  const stickyTop = nav && getComputedStyle(nav).position === 'sticky' ? nav.offsetHeight : 0;
  const top = view.getBoundingClientRect().top + window.scrollY - stickyTop;
  if (window.scrollY > top) window.scrollTo({ top });
}

function editTitle(btn) {
  const h1 = btn.closest('.page-title');
  const current = store.state.settings.title;
  editingTitle = true;
  h1.innerHTML = `<input class="title-input" value="${esc(current)}" maxlength="60" aria-label="標題">`;
  const input = h1.querySelector('input');
  input.focus();
  input.select();
  let finished = false;
  const finish = (save) => {
    if (finished) return;
    finished = true;
    editingTitle = false;
    const value = input.value.trim();
    headSig = '';
    if (save && value && value !== current) store.saveSettings({ title: value });
    renderHead();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finish(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
    }
  });
  input.addEventListener('blur', () => finish(true));
}

// ---------- 事件 ----------
const find = (col, id) => store.state[col].find((d) => d.id === id);
let projectId = '';
const env = () => ({ configured, projectId, signOut, leaveDemo, syncCalendar, lookPreview, currentLook });

// ---------- Google 日曆 ----------
const GCAL_AUTH_ERRORS = {
  'auth/user-mismatch': '請選擇目前登入這個網站的 Google 帳號。',
  'auth/popup-blocked': '瀏覽器擋住了 Google 的視窗。請允許這個網站開啟彈出式視窗，再試一次。',
  'auth/network-request-failed': '連不上網路，請確認連線後再試一次。',
};

// 用 Google 登入連接時，一定要在點擊事件裡直接呼叫（瀏覽器才會讓 Google 的視窗打開）；
// 透過 Apps Script 連接時直接同步，不用開視窗
async function syncCalendar({ askAgain = false } = {}) {
  try {
    const result = bridgeOn() ? await gcalRun() : askAgain || !gcalHasToken() ? await gcalConnect() : await gcalRun();
    if (result) toast(result.changed ? `已同步到 Google 日曆（更新了 ${result.changed} 個行程）` : '已同步到 Google 日曆，沒有新的變更');
    return true;
  } catch (err) {
    const code = err?.code || '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return false;
    const text = GCAL_AUTH_ERRORS[code] || gcalState().message || err?.message || '同步到 Google 日曆失敗';
    toast(text, { tone: 'error', duration: 9000 });
    return false;
  }
}

function onGcalPill() {
  const { phase, message } = gcalState();
  if (phase === 'need-auth') syncCalendar({ askAgain: true });
  else if (phase === 'error') {
    toast(message || '同步到 Google 日曆失敗', {
      tone: 'error',
      duration: 10000,
      actionLabel: '再試一次',
      onAction: () => syncCalendar({ askAgain: true }),
    });
  } else openSettings(env(), { focus: 'gcal' });
}

// 完成任務或打卡時放一點彩紙；今天的事都做完時放大一點
function cheerTask(el, id, occ = '') {
  const task = find('tasks', id);
  if (!task) return;
  const me = occ ? { ...task, date: occ, status: task.doneOn[occ] ? 'done' : 'todo' } : task;
  if (isDone(me)) return;
  const today = todayKey();
  const dueToday = (t) => t.date && t.date <= today;
  const stillOpen = listTasks(store.state.tasks, today)
    .filter((t) => !(t.id === id && (t.occ || '') === occ) && dueToday(t) && !isDone(t)).length;
  if (dueToday(me) && stillOpen === 0) {
    celebrateAt(el, { big: true });
    toast('今天的任務都完成了！🎉');
  } else {
    celebrateAt(el);
  }
}

function cheerHabit(el, id, key) {
  const habit = find('habits', id);
  if (!habit || habit.log[key]) return;
  celebrateAt(el);
  const today = todayKey();
  if (key !== today) return;
  const left = store.state.habits.filter((h) => !h.archived && h.id !== id && isScheduled(h, today) && !h.log[today]).length;
  if (left === 0) toast('今天的習慣都打卡了！🌱');
}

const GLOBAL_ACTIONS = {
  'toggle-task': (el) => {
    const occ = el.dataset.occ || '';
    cheerTask(el, el.dataset.id, occ);
    if (occ) store.toggleOccurrence(el.dataset.id, occ);
    else store.toggleTask(el.dataset.id);
  },
  'toggle-check-item': (el) => store.toggleChecklistItem(el.dataset.id, el.dataset.item),
  'set-status': (el) => {
    const { id, value } = el.dataset;
    const task = find('tasks', id);
    if (!task || task.status === value) return;
    // 畫面重畫之後，焦點放回同一個按鈕（用鍵盤操作時不會跑掉）
    const sel = `[data-action="set-status"][data-id="${CSS.escape(id)}"][data-value="${value}"]`;
    const hadFocus = document.activeElement === el;
    const nth = [...document.querySelectorAll(`.task-status [data-id="${CSS.escape(id)}"]`)].indexOf(el);
    if (value === 'done') cheerTask(el, id, '');
    store.setTaskStatus(id, value);
    if (hadFocus) refocus(sel, Math.floor(Math.max(nth, 0) / 3));
  },
  'open-task': (el) => {
    const t = find('tasks', el.dataset.id);
    if (t) openTaskModal(t);
  },
  'new-task': (el) => openTaskModal(null, { date: el.dataset.date || '' }),
  'toggle-habit': (el) => {
    cheerHabit(el, el.dataset.id, el.dataset.date);
    store.toggleHabit(el.dataset.id, el.dataset.date);
  },
  'open-habit': (el) => {
    const h = find('habits', el.dataset.id);
    if (h) openHabitModal(h);
  },
  'new-habit': () => openHabitModal(),
  'open-goal': (el) => {
    const g = find('goals', el.dataset.id);
    if (g) openGoalModal(g);
  },
  'new-goal': () => openGoalModal(),
  'open-gevent': (el) => {
    const ev = findEvent(el.dataset.ev, Number(el.dataset.start) || 0);
    if (ev) openEventModal(ev);
  },
  'open-settings': () => openSettings(env()),
  'open-cover': () => openCoverPicker(env()),
  'open-themes': () => openThemePicker(env()),
  'gcal-pill': () => onGcalPill(),
  'edit-title': (el) => editTitle(el),
};

// 重畫之後把焦點放回「同一個位置」的按鈕（同一個任務可能同時出現在好幾個清單裡）
function refocus(sel, nth = 0) {
  const tryFocus = () => {
    if (document.activeElement?.matches?.(sel)) return true;
    const el = document.querySelectorAll(sel)[nth] || document.querySelector(sel);
    el?.focus({ preventScroll: true });
    return !!el;
  };
  requestAnimationFrame(() => {
    tryFocus();
    setTimeout(tryFocus, 150); // 雲端模式的資料晚一點才回來
  });
}

function viewHandler(group, name) {
  return currentView?.[group]?.[name];
}

function wireEvents() {
  document.addEventListener('click', (e) => {
    const gate = e.target.closest('[data-gate]');
    if (gate) {
      onGateClick(gate);
      return;
    }
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const name = el.dataset.action;
    const handler = (root.contains(el) && viewHandler('actions', name)) || GLOBAL_ACTIONS[name];
    if (!handler) return;
    e.preventDefault();
    handler(el, e, ctx());
  });

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-submit]');
    if (!form) return;
    e.preventDefault();
    viewHandler('submit', form.dataset.submit)?.(form, e, ctx());
  });

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset?.keep) drafts.set(t.dataset.keep, t.value);
    if (t.dataset && 'quick' in t.dataset) updateQuickPreview(t);
    if (t.dataset?.input) viewHandler('input', t.dataset.input)?.(t, e, ctx());
  });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset?.keep) drafts.set(t.dataset.keep, t.value);
    if (t.dataset?.change) viewHandler('change', t.dataset.change)?.(t, e, ctx());
  });

  document.addEventListener('toggle', (e) => {
    const t = e.target;
    if (t.dataset?.toggle) viewHandler('toggle', t.dataset.toggle)?.(t, e, ctx());
  }, true);

  // 快速鍵：按 N 新增任務
  document.addEventListener('keydown', (e) => {
    if (!['n', 'N', '/'].includes(e.key)) return;
    if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
    if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (document.getElementById('modal-root').children.length || !currentView || store.state.status !== 'ready') return;
    e.preventDefault();
    if (e.key === '/') {
      // 跳到任務頁的搜尋框
      pendingFocus = '[data-keep="tasks-search"]';
      if (location.hash === '#/tasks') focusPending();
      else location.hash = '#/tasks';
      return;
    }
    openTaskModal(null, currentView.newTaskDefaults?.() || {});
  });

  // 拖曳任務到別的日期（行事曆）
  document.addEventListener('dragstart', (e) => {
    const el = e.target.closest?.('[data-drag-task]');
    if (!el) return;
    dragId = el.dataset.dragTask;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragId);
    el.classList.add('is-dragging');
  });
  document.addEventListener('dragover', (e) => {
    if (!dragId) return;
    const cell = e.target.closest?.('[data-drop-date], [data-drop-status]');
    if (!cell) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    for (const c of document.querySelectorAll('.is-drop')) if (c !== cell) c.classList.remove('is-drop');
    cell.classList.add('is-drop');
  });
  document.addEventListener('drop', (e) => {
    const col = e.target.closest?.('[data-drop-status]');
    if (col && dragId) {
      // 看板：拖到別的欄位＝換狀態
      e.preventDefault();
      moveTo(dragId, col.dataset.dropStatus);
      endDrag();
      return;
    }
    const cell = e.target.closest?.('[data-drop-date]');
    if (!cell || !dragId) return;
    e.preventDefault();
    const task = find('tasks', dragId);
    const date = cell.dataset.dropDate;
    if (task && task.repeat === 'none' && task.date !== date) {
      store.updateTask(task.id, { date });
      toast(`已移到${fmtMonthDay(date)}`);
    }
    endDrag();
  });
  document.addEventListener('dragend', endDrag);

  initTimeline({ rerender: renderView });

  window.addEventListener('hashchange', onRoute);
  onSystemThemeChange(refreshLook);
  onGcalChange(renderGcalPill);
  // Google 日曆的行程抓回來了：重畫目前的頁面
  onExternalChange(() => {
    if (root.querySelector('.shell') && store.state.status === 'ready') renderView();
  });
  startExternal();

  // 過了午夜自動更新「今天」
  const checkDay = () => {
    const now = todayKey();
    if (now !== lastToday) {
      lastToday = now;
      renderView();
    }
  };
  setInterval(checkDay, 60_000);
  document.addEventListener('visibilitychange', checkDay);
}

function endDrag() {
  dragId = null;
  for (const el of document.querySelectorAll('.is-drop, .is-dragging')) el.classList.remove('is-drop', 'is-dragging');
}

boot();
