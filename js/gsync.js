// Google 日曆（透過你自己的 Google Apps Script）
//
// 使用者在自己的 Google 帳號裡放一小段程式（js/gas-code.js 產生的），部署成網頁應用程式，
// 計劃版就能用那個網址加上一組密碼，跟 Google 日曆雙向同步：
//   - 讀：把 Google 日曆的行程拿回來，顯示在行事曆和「今天」（只讀，不會改你其他的日曆）
//   - 寫：gcal.js 用 bridgeCall('sync', …) 把任務放進「計劃版」日曆
// 不需要伺服器、不用每小時重新確認，全部免費。
import { store } from './store.js';
import { toKey, fromKey, addDays, todayKey } from './utils.js';

const CACHE_KEY = 'planner.gs.events';
const INFO_KEY = 'planner.gs.info';
const SINCE_KEY = 'planner.gs.since';
const FRESH = 5 * 60_000; // 舊版 Apps Script：行程多久算舊了
const RETRY = 60_000; // 抓失敗後，多久之後才再試
const MAX_MONTHS = 8; // 這台裝置最多記住幾個月的行程
// Google 日曆有變動就自動更新：新版 Apps Script 會回答「從某個時間之後，哪些行程改過」
export const CHANGES_VERSION = 3;
const CHECK_EVERY = 30_000; // 開著的時候，每 30 秒問一次有沒有變動（很輕，不會把行程全部傳回來）
const BACK_GAP = 5_000; // 切回計劃版時馬上問，但最快 5 秒一次
const OLD_REFRESH = 2 * 60_000; // 舊版 Apps Script 不會回答：每 2 分鐘整個重新讀
const CHECKED_LIMIT = 30 * 60_000; // 有在問的話，行程最多放 30 分鐘就重新讀一次（保險）

export const SCRIPT_URL_RE = /^https:\/\/script\.google\.com\/(?:a\/macros\/[^/?#]+\/|macros\/)s\/[\w-]{20,}\/exec$/;

// ---------- 連線 ----------
const MESSAGES = {
  'bad-key': '密碼對不上：Apps Script 裡的程式碼不是這裡複製的那一份。請在設定裡重新「複製程式碼」，貼到 Apps Script 取代原本的內容，再更新部署。',
  'no-calendar-service': 'Apps Script 還沒加入「Google Calendar API」服務。請在 Apps Script 左邊「服務」旁邊按 ＋，選 Google Calendar API，按「新增」，再更新部署。',
  'need-auth': 'Apps Script 需要你再授權一次。請打開 Apps Script，在上方選 test、按「執行」，允許權限後再試一次。',
  'not-found': '找不到這個 Apps Script。請確認網址是「網頁應用程式」的網址，而且部署還在。',
  network: '連不上 Apps Script。請確認網路連線，還有部署時「誰可以存取」選的是「所有人」。',
  timeout: 'Apps Script 太久沒有回應，等一下會再試。',
  busy: '另一台裝置正在同步，等一下會自動再試。',
  'bad-response': 'Apps Script 回傳的內容看不懂。請確認貼的是「網頁應用程式」的網址（結尾是 /exec）。',
};

// 這些錯誤要使用者自己去 Apps Script 改設定，不會自動重試
export const SETUP_ERRORS = new Set(['bad-key', 'no-calendar-service', 'need-auth', 'not-found', 'bad-response']);

export class BridgeError extends Error {
  constructor(code, detail = '') {
    super(MESSAGES[code] || (detail ? `Google 日曆出了問題：${detail}` : 'Google 日曆出了問題。'));
    this.code = code;
    this.detail = detail;
  }
}

// 剛中斷連接的網址：設定還沒真正存好之前，不要再去抓行程
const revoked = new Set();

export function bridgeOn(s = store.state) {
  return s.mode === 'cloud' && s.status === 'ready' && !!(s.settings.gsUrl && s.settings.gsKey) && !revoked.has(s.settings.gsUrl);
}

export function checkScriptUrl(raw) {
  const url = String(raw || '').trim().replace(/[?#].*$/, '');
  if (SCRIPT_URL_RE.test(url)) return { url };
  if (!url) return { error: '請先貼上網址。' };
  if (/\/dev$/.test(url)) return { error: '這是測試用的網址。請貼「網頁應用程式」的網址，結尾是 /exec。' };
  if (/script\.google\.com\/(home|d)\//.test(url)) return { error: '這是編輯器的網址。請先部署，再貼「網頁應用程式」的網址，結尾是 /exec。' };
  return { error: '網址看起來不對。請貼「網頁應用程式」的網址：開頭是 https://script.google.com/macros/s/，結尾是 /exec。' };
}

// 每個人自己的密碼（只用英文小寫和數字，放進程式碼也不會出問題）
export function newKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => (b % 36).toString(36)).join('');
}

export async function bridgeCall(action, payload = {}, { url, key, timeout = 120_000 } = {}) {
  const s = store.state.settings;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    // 用純文字送出，瀏覽器就不用先問一次（Apps Script 不回應那種詢問）
    res = await fetch(url || s.gsUrl, {
      method: 'POST',
      body: JSON.stringify({ ...payload, action, key: key || s.gsKey }),
      credentials: 'omit',
      cache: 'no-store',
      signal: ctrl.signal,
    });
  } catch (err) {
    throw new BridgeError(err?.name === 'AbortError' ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text().catch(() => '');
  let data = null;
  try {
    data = JSON.parse(text);
  } catch { /* 不是 JSON：多半是 Google 的錯誤頁 */ }
  if (!data || typeof data !== 'object') {
    if (/authoriz|授權|權限/i.test(text)) throw new BridgeError('need-auth');
    if (res.status === 404 || /not found|找不到|無法開啟/i.test(text)) throw new BridgeError('not-found');
    throw new BridgeError('bad-response');
  }
  if (!data.ok) throw new BridgeError(data.error || 'failed', data.message || data.error || '');
  return data;
}

// ---------- 通知畫面更新 ----------
const listeners = new Set();
export function onExternalChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  for (const fn of listeners) fn();
}

const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const owner = () => `${store.state.user?.uid || ''}|${store.state.settings.gsUrl || ''}`;

function readJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}
function writeJSON(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch { /* 空間不夠或無痕模式 */ }
}

// ---------- 日曆清單（名稱、顏色）和 Apps Script 的版本 ----------
let info = null; // { owner, calendars, plannerCalendarId, version, at }
let infoError = '';
let infoLoading = false;
let infoTriedAt = 0;

function currentInfo() {
  if (!info) info = readJSON(INFO_KEY);
  if (info && info.owner !== owner()) info = null;
  return info;
}

export async function pingBridge({ url, key } = {}) {
  const data = await bridgeCall('ping', {}, { url, key, timeout: 60_000 });
  if (url) revoked.delete(url); // 重新連接
  else if (!bridgeOn()) return null; // 等回應的時候中斷連接或登出了
  info = {
    owner: `${store.state.user?.uid || ''}|${url || store.state.settings.gsUrl || ''}`,
    calendars: Array.isArray(data.calendars) ? data.calendars : [],
    plannerCalendarId: data.plannerCalendarId || '',
    version: Number(data.version) || 0,
    at: Date.now(),
  };
  infoError = '';
  writeJSON(INFO_KEY, info);
  if (info.version >= CHANGES_VERSION) check.none = false; // 換成新版了
  memo = new Map(); // 日曆的名稱和顏色可能變了
  emit();
  setTimeout(autoBackup, 0);
  return info;
}

// 打開設定或半天第一次用的時候，順便更新日曆清單
export function refreshInfo({ force = false } = {}) {
  if (!bridgeOn() || infoLoading) return;
  const cur = currentInfo();
  const now = Date.now();
  if (!force && cur && now - cur.at < 12 * 60 * 60_000) return;
  if (!force && now - infoTriedAt < RETRY) return;
  infoTriedAt = now;
  infoLoading = true;
  pingBridge()
    .catch((err) => {
      infoError = err.message;
      emit();
    })
    .finally(() => {
      infoLoading = false;
    });
}

const SAFE_COLOR = /^#[0-9a-f]{3,8}$/i;
// Google 日曆行程自己的顏色（colorId）
const EVENT_COLORS = {
  1: '#7986cb', 2: '#33b679', 3: '#8e24aa', 4: '#e67c73', 5: '#f6bf26', 6: '#f4511e',
  7: '#039be5', 8: '#616161', 9: '#3f51b5', 10: '#0b8043', 11: '#d50000',
};

export function calendarById(id) {
  return currentInfo()?.calendars.find((c) => c.id === id) || null;
}

// 設定裡要列出的日曆（不含「計劃版」自己的日曆）
export function pickerCalendars() {
  const s = store.state.settings;
  const cur = currentInfo();
  if (!cur) return [];
  const mine = new Set([s.gcalId, cur.plannerCalendarId].filter(Boolean));
  return cur.calendars
    .filter((c) => !mine.has(c.id) && !(c.name === '計劃版' && c.role === 'owner'))
    .map((c) => ({
      id: c.id,
      name: c.name || c.id,
      color: SAFE_COLOR.test(c.color) ? c.color : '#8e8e93',
      checked: s.gsPick ? s.gsCals.includes(c.id) : !!c.selected,
    }));
}

export function externalState() {
  const cur = currentInfo();
  return {
    loading: loading || infoLoading,
    error: pullError,
    infoError,
    version: cur?.version || 0,
    hasInfo: !!cur,
  };
}

// ---------- 行程快取（依月份） ----------
let cache = null; // { sig, months: { 'YYYY-MM': { at, raw: [...] } } }
let pullError = '';
let pullErrorAt = 0;
let loading = false;
const queued = new Set();
const inflight = new Set();
let lastMonths = [];
let memo = new Map(); // 月份 → 整理好的行程
let dirtyAt = 0; // 最近一次發現 Google 日曆有變動的時間（在這之前開始抓的行程都算舊的）
let fetchedAt = 0; // 上次整個讀回來的時間
const check = { busy: false, at: 0, none: false }; // none：這版 Apps Script 不會回答「有沒有變動」
const seen = new Set(); // 已經處理過的變動（同一個變動可能連續被回報兩三次）

function cacheSig() {
  const s = store.state.settings;
  return `${owner()}|${s.gsPick ? [...s.gsCals].sort().join(',') : '*'}|${s.gcalId || ''}`;
}

function currentCache() {
  const sig = cacheSig();
  if (!cache) cache = readJSON(CACHE_KEY);
  if (!cache || cache.sig !== sig || typeof cache.months !== 'object') {
    cache = { sig, months: {} };
    memo = new Map();
    pullError = '';
  }
  return cache;
}

function saveCache() {
  const months = Object.entries(cache.months).sort((a, b) => b[1].at - a[1].at).slice(0, MAX_MONTHS);
  cache.months = Object.fromEntries(months);
  writeJSON(CACHE_KEY, cache);
}

const monthOf = (key) => key.slice(0, 7);
const monthStart = (m) => fromKey(`${m}-01`);
const nextMonth = (m) => {
  const d = monthStart(m);
  return toKey(new Date(d.getFullYear(), d.getMonth() + 1, 1)).slice(0, 7);
};
function monthsBetween(from, to) {
  const out = [];
  for (let m = monthOf(from); m <= monthOf(to); m = nextMonth(m)) out.push(m);
  return out;
}

const pad = (n) => String(n).padStart(2, '0');
const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function normalize(raw) {
  const cal = calendarById(raw.cal);
  const base = {
    key: `${raw.cal}|${raw.id}`,
    cal: raw.cal,
    calName: cal?.name || '',
    title: String(raw.title || '').trim() || '（沒有標題）',
    location: String(raw.location || ''),
    link: /^https:\/\/(www\.google\.com\/calendar|calendar\.google\.com)\//.test(raw.link || '') ? raw.link : '',
    color: EVENT_COLORS[raw.color] || (SAFE_COLOR.test(cal?.color || '') ? cal.color : '#8e8e93'),
  };
  if (raw.allDay) {
    const startKey = String(raw.start).slice(0, 10);
    let endKey = addDays(String(raw.end || raw.start).slice(0, 10), -1);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startKey)) return null;
    if (!(endKey >= startKey)) endKey = startKey;
    return {
      ...base, allDay: true, startKey, endKey, startTime: '', endTime: '',
      startMs: fromKey(startKey).getTime(), endMs: fromKey(addDays(endKey, 1)).getTime(),
    };
  }
  const s = new Date(raw.start);
  if (Number.isNaN(s.getTime())) return null;
  let e = new Date(raw.end || raw.start);
  if (Number.isNaN(e.getTime()) || e < s) e = s;
  return {
    ...base,
    allDay: false,
    startKey: toKey(s),
    endKey: e > s ? toKey(new Date(e.getTime() - 1)) : toKey(s), // 半夜 00:00 結束的不算到隔天
    startTime: hhmm(s),
    endTime: hhmm(e),
    startMs: s.getTime(),
    endMs: e.getTime(),
  };
}

function monthEvents(m) {
  const entry = cache.months[m];
  if (!entry) return [];
  let list = memo.get(m);
  if (!list || list.at !== entry.at) {
    list = entry.raw.map(normalize).filter(Boolean);
    list.at = entry.at;
    memo.set(m, list);
  }
  return list;
}

export function compareEvents(a, b) {
  return Number(b.allDay) - Number(a.allDay) || a.startMs - b.startMs || a.title.localeCompare(b.title, 'zh-Hant');
}

// 某段日期裡的 Google 日曆行程（會順便在背景更新）
export function eventsBetween(from, to) {
  if (!bridgeOn()) return [];
  currentCache();
  refreshInfo();
  const months = monthsBetween(from, to);
  lastMonths = months;
  request(months);
  const seen = new Set();
  const out = [];
  for (const m of months) {
    for (const ev of monthEvents(m)) {
      if (ev.endKey < from || ev.startKey > to) continue;
      const id = `${ev.key}|${ev.startMs}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(ev);
    }
  }
  return out.sort(compareEvents);
}

// 依日期分組（跨好幾天的行程，每一天都會出現）
export function groupByDay(events, from, to) {
  const map = new Map();
  for (const ev of events) {
    let day = ev.startKey < from ? from : ev.startKey;
    const last = ev.endKey > to ? to : ev.endKey;
    for (let i = 0; day <= last && i < 62; i++, day = addDays(day, 1)) {
      if (!map.has(day)) map.set(day, []);
      map.get(day).push(ev);
    }
  }
  return map;
}

export function findEvent(key, startMs) {
  if (!cache) return null;
  for (const m of Object.keys(cache.months)) {
    const hit = monthEvents(m).find((ev) => ev.key === key && (!startMs || ev.startMs === startMs));
    if (hit) return hit;
  }
  return null;
}

// 有在問「有沒有變動」的話，行程沒變就不用一直重新讀
const canCheck = () => !check.none && (currentInfo()?.version || 0) >= CHANGES_VERSION;

function isFresh(entry, now) {
  if (!entry || entry.stale) return false;
  return now - entry.at < (canCheck() && getSince() ? CHECKED_LIMIT : FRESH);
}

function request(months) {
  const now = Date.now();
  if (pullError && now - pullErrorAt < RETRY) return;
  let added = false;
  for (const m of months) {
    const entry = cache.months[m];
    if (inflight.has(m) || isFresh(entry, now)) continue;
    if (!queued.has(m)) {
      queued.add(m);
      added = true;
    }
  }
  if (added && !loading) setTimeout(pump, 0);
}

// 一次抓一段連續的月份
async function pump() {
  if (loading || !queued.size) return;
  if (!bridgeOn()) {
    queued.clear();
    return;
  }
  const sorted = [...queued].sort();
  const run = [sorted[0]];
  while (run.length < sorted.length && sorted[run.length] === nextMonth(run[run.length - 1])) run.push(sorted[run.length]);
  for (const m of run) {
    queued.delete(m);
    inflight.add(m);
  }
  loading = true;
  const sig = cacheSig();
  const s = store.state.settings;
  const startedAt = Date.now();
  let stale = false;
  try {
    const payload = {
      from: monthStart(run[0]).toISOString(),
      to: monthStart(nextMonth(run[run.length - 1])).toISOString(),
      timeZone: zone(),
    };
    if (s.gsPick) payload.calendars = s.gsCals.filter((id) => id && id !== s.gcalId);
    const data = s.gsPick && !payload.calendars.length ? { events: [] } : await bridgeCall('events', payload, { timeout: 60_000 });
    if (sig !== cacheSig() || !bridgeOn()) return; // 設定在這段時間改了（或中斷連接了），這次的結果不要了
    const raw = (Array.isArray(data.events) ? data.events : []).filter((e) => e && e.cal !== s.gcalId);
    const at = Date.now();
    // 讀的途中發現 Google 日曆又有變動：這次讀到的可能是改之前的，等一下再讀一次
    stale = startedAt < dirtyAt;
    for (const m of run) {
      const from = `${m}-01`;
      const to = addDays(`${nextMonth(m)}-01`, -1);
      cache.months[m] = { at, stale, raw: raw.filter((e) => String(e.start).slice(0, 10) <= to && String(e.end || e.start).slice(0, 10) >= from) };
    }
    pullError = '';
    fetchedAt = at;
    noteVersion(data.version);
    if (data.now && !getSince()) setSince(data.now); // 從這次讀的時間開始，之後只要問有沒有變動
    saveCache();
  } catch (err) {
    pullError = err.message;
    pullErrorAt = Date.now();
  } finally {
    for (const m of run) inflight.delete(m);
    loading = false;
    emit();
    if (stale) request(lastMonths);
    if (queued.size) setTimeout(pump, 0);
  }
}

// ---------- Google 日曆有變動就自動更新 ----------
// 「從什麼時候開始問」用 Google 那邊的時間，每台裝置、每種日曆選法各記各的
function getSince() {
  const v = readJSON(SINCE_KEY);
  return v && v.sig === cacheSig() && typeof v.since === 'string' ? v.since : '';
}
function setSince(since) {
  writeJSON(SINCE_KEY, since ? { sig: cacheSig(), since } : null);
}

// 換了新版 Apps Script：馬上開始用新功能
function noteVersion(version) {
  const v = Number(version) || 0;
  const cur = currentInfo();
  if (!v || !cur || cur.version === v) return;
  cur.version = v;
  writeJSON(INFO_KEY, cur);
  if (v >= CHANGES_VERSION) check.none = false;
}

// 有變動：所有記住的月份都算舊的，看得到的那幾個月馬上重新讀
function markStale() {
  dirtyAt = Date.now();
  if (cache) for (const entry of Object.values(cache.months)) entry.stale = true;
}

function calendarPayload() {
  const s = store.state.settings;
  return s.gsPick ? { calendars: s.gsCals.filter((id) => id && id !== s.gcalId) } : {};
}

async function checkChanges() {
  const since = getSince();
  if (check.busy || !since) return;
  const s = store.state.settings;
  if (s.gsPick && !calendarPayload().calendars.length) return; // 沒有要顯示的日曆
  // 太久沒問（例如一個禮拜沒打開）：直接整個重新讀
  if (Date.now() - Date.parse(since) > 6 * 24 * 3600_000) {
    setSince('');
    markStale();
    request(lastMonths);
    return;
  }
  check.busy = true;
  check.at = Date.now();
  const sig = cacheSig();
  try {
    const data = await bridgeCall('changes', { since, ...calendarPayload() }, { timeout: 30_000 });
    if (sig !== cacheSig() || !bridgeOn()) return;
    let changed = !!data.more;
    for (const it of Array.isArray(data.items) ? data.items : []) {
      const k = `${it.cal}|${it.id}|${it.u}`;
      if (!seen.has(k)) {
        seen.add(k);
        changed = true;
      }
    }
    if (seen.size > 400) for (const k of [...seen].slice(0, seen.size - 200)) seen.delete(k);
    noteVersion(data.version);
    if (data.now) setSince(data.now);
    if (changed) {
      markStale();
      request(lastMonths);
    }
  } catch (err) {
    if (err.code === 'bad-action') check.none = true; // 其實還是舊版：改回定時整個重新讀
  } finally {
    check.busy = false;
  }
}

// 每 10 秒、切回這個分頁、重新連上網路的時候看一下要不要更新
function tick(back = false) {
  if (document.visibilityState !== 'visible' || !bridgeOn() || !lastMonths.length) return;
  currentCache();
  const now = Date.now();
  if (back) pullError = '';
  if (canCheck() && getSince()) {
    if (!loading && now - check.at >= (back ? BACK_GAP : CHECK_EVERY)) checkChanges();
  } else if (now - fetchedAt >= (back ? 15_000 : canCheck() ? CHECK_EVERY : OLD_REFRESH)) {
    markStale(); // 舊版 Apps Script（或還不知道從哪裡開始問）：整個重新讀
  }
  request(lastMonths);
}

// 開著的時候一直看著 Google 日曆：切回這個分頁、重新連上網路時馬上看，平常每 10 秒看一下要不要問
let started = false;
export function startExternal() {
  if (started) return;
  started = true;
  const back = () => tick(true);
  document.addEventListener('visibilitychange', back);
  window.addEventListener('focus', back);
  window.addEventListener('online', back);
  setInterval(() => tick(false), 10_000);
  // 每天備份一次：打開後過一下、回到這個分頁、每 5 分鐘檢查一次
  const backupLater = () => {
    if (document.visibilityState === 'visible') autoBackup();
  };
  setTimeout(backupLater, 8000);
  document.addEventListener('visibilitychange', backupLater);
  setInterval(backupLater, FRESH);
}

// ---------- 每天自動備份到 Google 雲端硬碟（Apps Script 第 2 版以後） ----------
export const BACKUP_VERSION = 2;
let backupBusy = false;
let backupTriedAt = 0;
let backupError = '';
export const backupState = () => ({ busy: backupBusy, error: backupError });
const backupListeners = new Set();
export function onBackupChange(fn) {
  backupListeners.add(fn);
  return () => backupListeners.delete(fn);
}
const emitBackup = () => {
  for (const fn of backupListeners) fn();
};

export async function backupNow() {
  if (backupBusy) return null;
  backupBusy = true;
  backupError = '';
  emitBackup();
  try {
    const day = todayKey();
    const r = await bridgeCall('backup', { day, data: store.exportData() }, { timeout: 120_000 });
    store.saveSettings({ backupDay: day, ...(/^https:\/\/drive\.google\.com\//.test(r.folderUrl || '') ? { backupUrl: r.folderUrl } : {}) });
    return r;
  } catch (err) {
    backupError = err.code === 'bad-action' ? '要先更新 Apps Script 的程式碼，才能備份到雲端硬碟。' : err.message;
    throw err;
  } finally {
    backupBusy = false;
    emitBackup();
  }
}

// 打開計劃版時，今天還沒備份過就在背景備份一次（失敗的話 30 分鐘後再試）
export function autoBackup() {
  const s = store.state;
  if (!bridgeOn(s) || !s.settings.backupOn || s.settings.backupDay === todayKey() || backupBusy) return;
  const cur = currentInfo();
  if (!cur) {
    refreshInfo();
    return;
  }
  if (cur.version < BACKUP_VERSION || Date.now() - backupTriedAt < 30 * 60_000) return;
  backupTriedAt = Date.now();
  backupNow().catch(() => {});
}

// 立刻重新抓（例如換了要顯示的日曆）
export function reloadExternal() {
  if (!cache) return;
  cache.months = {};
  memo = new Map();
  pullError = '';
  writeJSON(CACHE_KEY, null);
  emit();
}

// 登出或中斷連接時，把這台裝置記住的行程清掉
export function clearExternal({ revoke = false } = {}) {
  if (revoke && store.state.settings.gsUrl) revoked.add(store.state.settings.gsUrl);
  cache = null;
  info = null;
  memo = new Map();
  pullError = '';
  infoError = '';
  infoTriedAt = 0;
  backupError = '';
  backupTriedAt = 0;
  queued.clear();
  seen.clear();
  check.none = false;
  check.at = 0;
  fetchedAt = 0;
  writeJSON(CACHE_KEY, null);
  writeJSON(INFO_KEY, null);
  writeJSON(SINCE_KEY, null);
  emit();
}
