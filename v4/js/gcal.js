// Google 日曆同步（單向：計劃版 → Google 日曆）
//
// - 在你的 Google 日曆裡建立一個專屬的「計劃版」日曆，只動這個日曆，不碰你其他的行程。
// - 有日期的任務會變成行程：有時間的是 1 小時的行程（開始前 10 分鐘提醒），沒時間的是全天行程。
// - 進行中目標的期限會變成全天行程。
// - 權限只要求「建立並管理這個 App 自己建立的日曆」（calendar.app.created）。
// - Google 給的通行證大約一小時會過期；過期後有變更時，頁首會出現「同步日曆」按鈕，點一下就好。
import { store } from './store.js';
import { isDone } from './model.js';
import { addDays, toKey } from './utils.js';

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
  evaluate();
}

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
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

export function desiredEvents(s = store.state) {
  const zone = timeZone();
  const events = [];
  for (const t of s.tasks) {
    if (!t.date) continue;
    const done = isDone(t);
    const ev = {
      id: eventId('t', t.id),
      summary: `${done ? '✅ ' : ''}${t.title}`,
      description: t.notes || '',
      transparency: 'transparent',
      extendedProperties: { private: { planner: '1' } },
    };
    if (t.time) {
      ev.start = { dateTime: `${t.date}T${t.time}:00`, timeZone: zone };
      ev.end = { dateTime: plusMinutes(t.date, t.time, 60), timeZone: zone };
      ev.reminders = { useDefault: false, overrides: done ? [] : [{ method: 'popup', minutes: 10 }] };
    } else {
      ev.start = { date: t.date };
      ev.end = { date: addDays(t.date, 1) };
      ev.reminders = { useDefault: false, overrides: [] };
    }
    const color = done ? '8' : COLORS[t.priority];
    if (color) ev.colorId = color;
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
  return events;
}

function fingerprint(events) {
  const text = JSON.stringify(
    events
      .map((e) => [e.id, e.summary, e.description, e.start, e.end, e.colorId || '', e.reminders.overrides])
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
    if (state.phase !== 'error') setState({ phase: 'synced', message: '' });
    return;
  }
  if (getToken()) {
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
function differs(want, have) {
  const wantRem = JSON.stringify(want.reminders.overrides);
  const haveRem = JSON.stringify(have.reminders?.useDefault ? null : have.reminders?.overrides || []);
  return (
    want.summary !== (have.summary || '') ||
    (want.description || '') !== (have.description || '') ||
    (want.colorId || '') !== (have.colorId || '') ||
    when(want.start) !== when(have.start) ||
    when(want.end) !== when(have.end) ||
    wantRem !== haveRem
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

export async function run() {
  if (syncing) {
    again = true;
    return;
  }
  syncing = true;
  setState({ phase: 'syncing', message: '' });
  try {
    const desired = desiredEvents();
    const hash = fingerprint(desired);
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
    lastSynced = hash;
    store.saveSettings({ gcalHash: hash, gcalAt: Date.now() });
    setState({ phase: 'synced', message: '' });
    return { changed: jobs.length, total: desired.length };
  } catch (err) {
    if (err.code === 'need-auth' || err.status === 401) {
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

// 停止同步（Google 日曆裡已經同步過去的行程會留著，想刪掉可以直接刪掉整個日曆）
export function disconnect() {
  dropToken();
  lastSynced = '';
  store.saveSettings({ gcalOn: false, gcalHash: '' });
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
