// Google 日曆同步：計劃版 → Google 日曆裡的「計劃版」日曆
//
// - 只動「計劃版」這個日曆，不碰你其他的行程。
// - 有日期的任務會變成行程：有時間的會照時長（預設 1 小時），開始前 10 分鐘提醒；沒時間的是全天行程。
// - 進行中目標的期限會變成全天行程。
// - 兩種連接方式：
//   1. 透過你自己的 Google Apps Script（gsync.js）：自動同步，不用重新確認（建議）
//   2. 直接用 Google 登入拿通行證（calendar.app.created）：通行證大約一小時會過期，
//      過期後有變更時，頁首會出現「點一下同步日曆」
import { store } from './store.js';
import { isDone, isRepeating, repeatDaysOf, remindMinutes } from './model.js';
import { addDays, toKey } from './utils.js';
import { emojiOf } from './dates.js';
import { plannerZone } from './zone.js';
import { birthdayStart, sameAsDate, likesText } from './friends.js';
import { bridgeOn, bridgeCall, SETUP_ERRORS, clearExternal } from './gsync.js';

export const GCAL_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';
const API = 'https://www.googleapis.com/calendar/v3';
const TOKEN_KEY = 'planner.v3.gcalToken';
export const CALENDAR_NAME = '計劃版'; // 在 Google 日曆裡建立的日曆名稱

let auth = null;
let started = false;
let state = { phase: 'off', message: '' }; // off | synced | waiting | syncing | need-auth | error
const listeners = new Set();
let syncing = false;
let again = false;
let timer = null;
let lastSynced = ''; // 這台裝置最後一次同步完成時的內容指紋
let retryTimer = null; // 透過 Apps Script 同步失敗時，等一下自動再試
let retryDelay = 0;
let heldSig = ''; // Apps Script 設定有問題時，等使用者改好設定再試
const bridgeSig = (s = store.state) => `${s.settings.gsUrl}|${s.settings.gsKey}`;

export const gcalState = () => state;
export function onGcalChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function setState(patch) {
  const next = { ...state, ...patch };
  if (next.phase === state.phase && next.message === state.message) return;
  state = next;
  for (const fn of listeners) fn(state);
}

export function initGcal(authApi) {
  auth = authApi;
  if (started) return;
  started = true;
  store.subscribe(evaluate);
  window.addEventListener('online', () => {
    if (state.phase !== 'error' || !bridgeOn()) return;
    clearTimeout(retryTimer);
    retryTimer = null;
    evaluate();
  });
  evaluate();
}

// 用計劃版設定的時區，不是這台裝置的：時區不同的兩台裝置才不會把行程改來改去
const timeZone = () => plannerZone(store.state.settings);
const pad = (n) => String(n).padStart(2, '0');

// ---- 通行證（存在這個分頁，關掉分頁就沒了） ----
function getToken() {
  try {
    const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null');
    if (t && t.exp > Date.now() + 60_000) return t.value;
  } catch { /* 忽略 */ }
  return null;
}
function saveToken(value) {
  try {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ value, exp: Date.now() + 55 * 60_000 }));
  } catch { /* 忽略 */ }
}
function dropToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch { /* 忽略 */ }
}

// ---- 要放進日曆的行程 ----
// Google 日曆的行程 ID 只能用 0-9 和 a-v，所以把任務 ID 轉成十六進位
const eventId = (prefix, id) => prefix + Array.from(new TextEncoder().encode(id), (b) => b.toString(16).padStart(2, '0')).join('');

function plusMinutes(date, time, minutes) {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const t = new Date(y, mo - 1, d, h, mi + minutes);
  return `${toKey(t)}T${pad(t.getHours())}:${pad(t.getMinutes())}:00`;
}

const COLORS = { high: '11', medium: '5', low: '7' }; // 番茄紅、香蕉黃、孔雀藍
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

// 重複的任務在 Google 日曆裡用「重複行程」（RRULE）表示
function rrule(t) {
  let rule = `RRULE:FREQ=${{ daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY' }[t.repeat]}`;
  if (t.repeat === 'weekly') rule += `;BYDAY=${repeatDaysOf(t).map((d) => BYDAY[d]).join(',')}`;
  if (t.repeatUntil) {
    if (t.time) {
      // 有時間的行程要用 UTC 時間：重複到那天的 23:59:59（這台裝置的時區）
      const [y, m, d] = t.repeatUntil.split('-').map(Number);
      rule += `;UNTIL=${new Date(y, m - 1, d, 23, 59, 59).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`;
    } else {
      rule += `;UNTIL=${t.repeatUntil.replace(/-/g, '')}`;
    }
  }
  return rule;
}

// 行程說明：標籤放第一行，接著是備註
function describe(t, tagsById) {
  const names = (t.tags || []).map((id) => tagsById.get(id)?.name).filter(Boolean);
  return [names.length ? names.map((n) => `#${n}`).join(' ') : '', t.notes || ''].filter(Boolean).join('\n');
}

export function desiredEvents(s = store.state) {
  const zone = plannerZone(s.settings);
  const events = [];
  const tagsById = new Map((s.settings.tags || []).map((g) => [g.id, g]));
  for (const t of s.tasks) {
    if (!t.date) continue;
    const repeating = isRepeating(t);
    const done = !repeating && isDone(t);
    const minutes = remindMinutes(t);
    const ev = {
      id: eventId('t', t.id),
      summary: `${done ? '✅ ' : ''}${t.title}`,
      description: describe(t, tagsById),
      transparency: 'transparent',
      extendedProperties: { private: { planner: '1' } },
    };
    if (t.time) {
      ev.start = { dateTime: `${t.date}T${t.time}:00`, timeZone: zone };
      ev.end = { dateTime: plusMinutes(t.date, t.time, t.duration || 60), timeZone: zone };
    } else {
      ev.start = { date: t.date };
      ev.end = { date: addDays(t.date, 1) };
    }
    ev.reminders = { useDefault: false, overrides: done || minutes === null ? [] : [{ method: 'popup', minutes }] };
    const color = done ? '8' : COLORS[t.priority];
    if (color) ev.colorId = color;
    if (repeating) ev.recurrence = [rrule(t)];
    events.push(ev);
  }
  for (const g of s.goals) {
    if (!g.deadline || g.status === 'done') continue;
    events.push({
      id: eventId('g', g.id),
      summary: `🎯 ${g.title}（目標期限）`,
      description: g.why || '',
      transparency: 'transparent',
      start: { date: g.deadline },
      end: { date: addDays(g.deadline, 1) },
      colorId: '3',
      reminders: { useDefault: false, overrides: [] },
      extendedProperties: { private: { planner: '1' } },
    });
  }
  // 重要日子：倒數的日子放一次；生日、紀念日每年重複。前一週和前一天早上 9 點提醒
  for (const d of s.dates || []) {
    if (!d.date || !d.remind || d.kind === 'since') continue;
    const yearly = d.kind === 'birthday' || d.kind === 'anniversary';
    const title = d.kind === 'birthday' && !d.title.includes('生日') ? `${d.title}生日` : d.title;
    const ev = {
      id: eventId('d', d.id),
      summary: `${emojiOf(d)} ${title}`,
      description: d.note || '',
      transparency: 'transparent',
      start: { date: d.date },
      end: { date: addDays(d.date, 1) },
      reminders: { useDefault: false, overrides: DATE_REMINDERS },
      extendedProperties: { private: { planner: '1' } },
    };
    // 2/29 的生日：平年放在 2/28（二月的最後一天）
    if (yearly) ev.recurrence = [d.date.slice(5) === '02-29' ? 'RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1' : 'RRULE:FREQ=YEARLY'];
    events.push(ev);
  }
  // 朋友的生日：每年重複，說明裡寫他喜歡什麼（重要日子裡已經有同一個人的就不重複）
  for (const f of s.friends || []) {
    if (!f.birthday || !f.remind || sameAsDate(f, s.dates)) continue;
    const start = birthdayStart(f);
    const description = [likesText(f, 20), f.dislikes.length ? `不喜歡：${f.dislikes.join('、')}` : '', f.note].filter(Boolean).join('\n');
    events.push({
      id: eventId('f', f.id),
      summary: `🎂 ${f.name}生日`,
      description,
      transparency: 'transparent',
      start: { date: start },
      end: { date: addDays(start, 1) },
      reminders: { useDefault: false, overrides: DATE_REMINDERS },
      extendedProperties: { private: { planner: '1' } },
      recurrence: [start.slice(5) === '02-29' ? 'RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1' : 'RRULE:FREQ=YEARLY'],
    });
  }
  return events;
}

// 整天的事件：提醒的分鐘數從那天 0 點往前算。前一天 9:00＝15 小時前、前一週 9:00＝6 天又 15 小時前
const DATE_REMINDERS = [{ method: 'popup', minutes: 15 * 60 }, { method: 'popup', minutes: (6 * 24 + 15) * 60 }];

function fingerprint(events) {
  const text = JSON.stringify(
    events
      .map((e) => [e.id, e.summary, e.description, e.start, e.end, e.colorId || '', e.reminders.overrides, e.recurrence || []])
      .sort((a, b) => (a[0] < b[0] ? -1 : 1)),
  );
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${(h >>> 0).toString(36)}.${text.length.toString(36)}.${timeZone()}`;
}

// ---- 判斷要不要同步 ----
function evaluate() {
  const s = store.state;
  if (s.mode !== 'cloud' || s.status !== 'ready' || !s.settings.gcalOn) {
    if (!syncing) setState({ phase: 'off', message: '' });
    return;
  }
  if (syncing) {
    again = true;
    return;
  }
  // 剛同步完、雲端的設定還沒更新的那一下，先用這台裝置記得的結果
  if (lastSynced && s.settings.gcalHash === lastSynced) lastSynced = '';
  const fp = fingerprint(desiredEvents(s));
  const pending = fp !== s.settings.gcalHash && fp !== lastSynced;
  if (!pending) {
    clearTimeout(timer);
    clearTimeout(retryTimer);
    retryTimer = null;
    setState({ phase: 'synced', message: '' });
    return;
  }
  if (bridgeOn(s)) {
    if (state.phase === 'error' && (retryTimer || (heldSig && heldSig === bridgeSig(s)))) return;
    setState({ phase: 'waiting', message: '' });
    clearTimeout(timer);
    timer = setTimeout(() => run().catch(() => {}), 1500);
  } else if (getToken()) {
    setState({ phase: 'waiting', message: '' });
    clearTimeout(timer);
    timer = setTimeout(() => run().catch(() => {}), 1500);
  } else {
    setState({ phase: 'need-auth', message: '' });
  }
}

// ---- 呼叫 Google 日曆 API ----
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, path, body, query, attempt = 0) {
  const token = getToken();
  if (!token) throw Object.assign(new Error('需要重新連接 Google 日曆'), { code: 'need-auth' });
  const url = `${API}${path}${query ? `?${new URLSearchParams(query)}` : ''}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error?.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.reason = data.error?.errors?.[0]?.reason || data.error?.status || '';
    // 一次送太多，等一下再試
    const tooFast = res.status === 429 || (res.status === 403 && /rateLimitExceeded|userRateLimitExceeded/.test(err.reason));
    if (tooFast && attempt < 4) {
      await sleep(800 * 2 ** attempt + Math.random() * 400);
      return api(method, path, body, query, attempt + 1);
    }
    throw err;
  }
  return data;
}

const enc = encodeURIComponent;

async function createCalendar() {
  const cal = await api('POST', '/calendars', {
    summary: CALENDAR_NAME,
    description: '由「計劃版」網站自動同步的任務與目標期限。在網站上修改，這裡會跟著更新。',
    timeZone: timeZone(),
  });
  store.saveSettings({ gcalId: cal.id });
  return cal.id;
}

async function listEvents(calId) {
  let items = [];
  let pageToken;
  do {
    const query = { maxResults: '2500', showDeleted: 'false', privateExtendedProperty: 'planner=1', timeZone: timeZone() };
    if (pageToken) query.pageToken = pageToken;
    const data = await api('GET', `/calendars/${enc(calId)}/events`, null, query);
    items = items.concat(data.items || []);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return items;
}

const when = (t) => (t?.date ? `d:${t.date}` : t?.dateTime ? `t:${t.dateTime.slice(0, 16)}` : '');
// 提醒比對時不管先後順序（Google 回傳的順序可能跟放進去的不一樣）
const remKey = (list) => JSON.stringify((list || []).map((r) => `${r.method}:${r.minutes}`).sort());
function differs(want, have) {
  const wantRem = remKey(want.reminders.overrides);
  const haveRem = have.reminders?.useDefault ? 'default' : remKey(have.reminders?.overrides);
  return (
    want.summary !== (have.summary || '') ||
    (want.description || '') !== (have.description || '') ||
    (want.colorId || '') !== (have.colorId || '') ||
    when(want.start) !== when(have.start) ||
    when(want.end) !== when(have.end) ||
    wantRem !== haveRem ||
    (want.recurrence || []).join('|') !== (have.recurrence || []).join('|')
  );
}

async function upsert(calId, ev, exists) {
  if (exists) return api('PUT', `/calendars/${enc(calId)}/events/${ev.id}`, ev);
  try {
    return await api('POST', `/calendars/${enc(calId)}/events`, ev);
  } catch (err) {
    // 這個 ID 以前用過（行程被刪掉過），改成更新並恢復
    if (err.status === 409) return api('PUT', `/calendars/${enc(calId)}/events/${ev.id}`, { ...ev, status: 'confirmed' });
    throw err;
  }
}

async function pool(jobs, size = 4) {
  let i = 0;
  const workers = Array.from({ length: Math.min(size, jobs.length) }, async () => {
    while (i < jobs.length) await jobs[i++]();
  });
  await Promise.all(workers);
}

function explain(err) {
  const text = `${err.message} ${err.reason}`;
  if (/has not been used|is disabled|accessNotConfigured|SERVICE_DISABLED/i.test(text)) {
    return 'Google Calendar API 還沒啟用。請到 Google Cloud 主控台啟用「Google Calendar API」後再試一次。';
  }
  if (err.status === 403) return 'Google 日曆拒絕了這次同步，請重新連接並允許日曆權限。';
  if (err instanceof TypeError) return '連不上 Google 日曆，請確認網路連線。';
  return `同步到 Google 日曆失敗：${err.message}`;
}

// 直接呼叫 Google 日曆 API，在這台裝置比對要新增、更新、刪除哪些行程
async function pushViaApi(desired) {
  let calId = store.state.settings.gcalId || (await createCalendar());
  let existing;
  try {
    existing = await listEvents(calId);
  } catch (err) {
    if (err.status !== 404) throw err;
    calId = await createCalendar(); // 日曆被刪掉了，重新建一個
    existing = [];
  }
  const have = new Map(existing.map((e) => [e.id, e]));
  const wanted = new Set(desired.map((e) => e.id));
  const jobs = [];
  for (const ev of desired) {
    const cur = have.get(ev.id);
    if (!cur) jobs.push(() => upsert(calId, ev, false));
    else if (differs(ev, cur)) jobs.push(() => upsert(calId, ev, true));
  }
  for (const e of existing) {
    if (!wanted.has(e.id)) {
      jobs.push(() => api('DELETE', `/calendars/${enc(calId)}/events/${e.id}`).catch((err) => {
        if (err.status !== 404 && err.status !== 410) throw err;
      }));
    }
  }
  await pool(jobs);
  return jobs.length;
}

// 交給使用者自己的 Apps Script 比對和寫入（一次做不完會分幾次）
async function pushViaBridge(desired) {
  let calId = store.state.settings.gcalId;
  let changed = 0;
  for (let round = 0; round < 10; round++) {
    const r = await bridgeCall('sync', { name: CALENDAR_NAME, calendarId: calId, timeZone: timeZone(), events: desired }, { timeout: 330_000 });
    if (r.calendarId && r.calendarId !== store.state.settings.gcalId) store.saveSettings({ gcalId: r.calendarId });
    calId = r.calendarId || calId;
    changed += (r.created || 0) + (r.updated || 0) + (r.removed || 0);
    if (Array.isArray(r.errors) && r.errors.length) {
      throw Object.assign(new Error(`有 ${r.errors.length} 個行程沒有放進 Google 日曆：${r.errors[0].message}`), { code: 'partial' });
    }
    if (r.done !== false) break;
  }
  return changed;
}

function scheduleRetry() {
  retryDelay = Math.min(retryDelay ? retryDelay * 2 : 30_000, 10 * 60_000);
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    evaluate();
  }, retryDelay);
}

export async function run() {
  if (syncing) {
    again = true;
    return;
  }
  syncing = true;
  clearTimeout(retryTimer);
  retryTimer = null;
  const viaBridge = bridgeOn();
  setState({ phase: 'syncing', message: '' });
  try {
    const desired = desiredEvents();
    const hash = fingerprint(desired);
    const changed = viaBridge ? await pushViaBridge(desired) : await pushViaApi(desired);
    lastSynced = hash;
    retryDelay = 0;
    heldSig = '';
    store.saveSettings({ gcalHash: hash, gcalAt: Date.now() });
    setState({ phase: 'synced', message: '' });
    return { changed, total: desired.length };
  } catch (err) {
    if (viaBridge) {
      setState({ phase: 'error', message: err.message });
      if (SETUP_ERRORS.has(err.code)) heldSig = bridgeSig();
      else scheduleRetry();
    } else if (err.code === 'need-auth' || err.status === 401) {
      dropToken();
      setState({ phase: 'need-auth', message: '' });
    } else if (err.status === 403 && /insufficient|scope/i.test(`${err.message} ${err.reason}`)) {
      dropToken();
      setState({ phase: 'need-auth', message: '需要允許日曆權限' });
    } else {
      setState({ phase: 'error', message: explain(err) });
    }
    throw err;
  } finally {
    syncing = false;
    if (again) {
      again = false;
      evaluate();
    }
  }
}

// 由使用者點按鈕觸發（需要開登入視窗）
export async function connect() {
  const token = await auth.requestCalendarToken(GCAL_SCOPE);
  if (!token) throw new Error('沒有取得 Google 日曆的權限');
  saveToken(token);
  if (!store.state.settings.gcalOn) store.saveSettings({ gcalOn: true });
  return run();
}

// 只開關「把任務放進 Google 日曆」（透過 Apps Script 連接時，Google 日曆的行程照樣會顯示）
export function setPush(on) {
  store.saveSettings(on ? { gcalOn: true, gcalHash: '' } : { gcalOn: false });
}

// 停止同步／中斷連接（Google 日曆裡已經同步過去的行程會留著，想刪掉可以直接刪掉整個日曆）
export function disconnect() {
  dropToken();
  lastSynced = '';
  clearTimeout(retryTimer);
  retryTimer = null;
  heldSig = '';
  clearExternal({ revoke: true });
  store.saveSettings({ gcalOn: false, gcalHash: '', gsUrl: '', gsKey: '', gsPick: false, gsCals: [] });
  setState({ phase: 'off', message: '' });
}

// 登出時把這個分頁的通行證丟掉
export function forgetToken() {
  dropToken();
  lastSynced = '';
}

export function hasToken() {
  return !!getToken();
}
