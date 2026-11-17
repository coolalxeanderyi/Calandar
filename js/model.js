// 資料規則：欄位預設值、排序、目標進度、習慣統計
import { todayKey, addDays, weekdayOf, toKey, diffDays, isDateKey, clamp } from './utils.js';
import { COVER_STYLES } from './covers.js';
import { THEME_IDS } from './themes.js';

export const PRIORITY_LABEL = { high: '高', medium: '中', low: '低', none: '無' };
const RANK = { high: 0, medium: 1, low: 2, none: 3 };
export const STATUS_LABEL = { todo: '待辦', doing: '進行中', done: '完成' };
export const GOAL_STATUS_LABEL = { active: '進行中', done: '已完成', paused: '暫停' };
export const AREA_SUGGESTIONS = ['工作', '學習', '健康', '財務', '生活', '創作'];
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const COVER_IDS = COVER_STYLES.map((c) => c.id);
const PALETTE_IDS = THEME_IDS;

// 標籤的八種顏色。順序固定：新標籤依序拿下一個顏色，相鄰的顏色色盲也分得出來。
// 實際顏色在 style.css 的 --tag-*（淺色、深色各一組）。
export const TAG_COLORS = [
  { id: 'blue', name: '藍' }, { id: 'orange', name: '橘' }, { id: 'aqua', name: '青' }, { id: 'yellow', name: '黃' },
  { id: 'magenta', name: '粉' }, { id: 'green', name: '綠' }, { id: 'violet', name: '紫' }, { id: 'red', name: '紅' },
];
export const TAG_COLOR_IDS = TAG_COLORS.map((c) => c.id);
export const MAX_TAGS = 40;
export const MAX_TASK_TAGS = 8;

// 提醒：-1＝不提醒，null＝預設（有時間的任務前 10 分鐘，全天的不提醒）
export const REMIND_TIMED = [[-1, '不提醒'], [0, '準時'], [5, '前 5 分鐘'], [10, '前 10 分鐘'], [30, '前 30 分鐘'], [60, '前 1 小時'], [1440, '前一天']];
export const REMIND_ALLDAY = [[-1, '不提醒'], [180, '前一天晚上 9 點']];
const REMINDS = [-1, 0, 5, 10, 30, 60, 180, 1440];
export const remindVal = (v) => (REMINDS.includes(v) ? v : null);
// 實際要提醒幾分鐘前（沒有提醒回傳 null）
export function remindMinutes(t) {
  if (t.time) {
    const v = t.remind === null || t.remind === undefined || t.remind === 180 ? 10 : t.remind;
    return v < 0 ? null : v;
  }
  return t.remind === 180 ? 180 : null;
}

// 每天的心情：1～5
export const MOODS = [[1, '😞', '很糟'], [2, '😕', '不太好'], [3, '😐', '普通'], [4, '🙂', '不錯'], [5, '😄', '很棒']];

// 頁面圖示：沒有設定、或是第一版的預設日曆圖示時，改用吉祥物
export const usesMascot = (icon) => !icon || icon === '🗓️';

// 依領域給目標一個小圖示
export const AREA_EMOJI = { 工作: '💼', 學習: '📚', 健康: '💪', 財務: '💰', 生活: '🏡', 創作: '🎨' };

export const DEFAULT_SETTINGS = {
  title: '計劃版',
  icon: '', // 空白代表使用吉祥物「小日曆」
  coverStyle: 'clouds',
  coverSeed: 20261116,
  theme: 'auto',
  palette: 'strawberry',
  weekStart: 1,
  // Google 日曆同步
  gcalOn: false,
  gcalId: '',
  gcalHash: '',
  gcalAt: 0,
  // 透過自己的 Google Apps Script 連接（網址和密碼），以及要在計劃版顯示哪些日曆
  gsUrl: '',
  gsKey: '',
  gsPick: false, // false＝顯示 Google 日曆裡有勾選的日曆
  gsCals: [],
  // 自己建立的標籤 [{ id, name, color }] 和任務範本
  tags: [],
  templates: [],
  // 每天自動備份到 Google 雲端硬碟（透過 Apps Script）
  backupOn: true,
  backupDay: '',
  backupUrl: '',
};

// 重複：none（不重複）、daily、weekly（repeatDays 是星期幾，0＝星期日）、monthly（每月同一天）
export const REPEAT_LABEL = { none: '不重複', daily: '每天', weekly: '每週', monthly: '每月' };
const REPEATS = Object.keys(REPEAT_LABEL);
export const DURATIONS = [[15, '15 分鐘'], [30, '30 分鐘'], [45, '45 分鐘'], [60, '1 小時'], [90, '1.5 小時'], [120, '2 小時'], [180, '3 小時'], [240, '4 小時']];

const DEFAULTS = {
  tasks: () => ({
    title: '', notes: '', date: '', time: '', duration: 60, priority: 'none', status: 'todo', goalId: '',
    repeat: 'none', repeatDays: [], repeatUntil: '', doneOn: {}, checklist: [], tags: [], remind: null, doneAt: null, createdAt: 0, updatedAt: 0,
  }),
  journal: () => ({ date: '', mood: 0, text: '', createdAt: 0, updatedAt: 0 }),
  reviews: () => ({ week: '', wins: '', improve: '', focus: ['', '', ''], createdAt: 0, updatedAt: 0 }),
  goals: () => ({ title: '', why: '', area: '', emoji: '🎯', deadline: '', status: 'active', progressMode: 'tasks', progress: 0, doneAt: null, createdAt: 0, updatedAt: 0 }),
  habits: () => ({ name: '', emoji: '✅', days: [...ALL_DAYS], log: {}, archived: false, order: 0, createdAt: 0, updatedAt: 0 }),
};

const ENUMS = {
  priority: Object.keys(RANK),
  status: ['todo', 'doing', 'done'],
  goalStatus: ['active', 'done', 'paused'],
  progressMode: ['tasks', 'manual'],
};

const str = (v, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
const date = (v) => (isDateKey(v) ? v : '');
const time = (v) => (typeof v === 'string' && /^\d{2}:\d{2}$/.test(v) ? v : '');
const dayList = (v) => (Array.isArray(v) ? [...new Set(v.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort() : []);
function dateMap(v) {
  const out = {};
  if (v && typeof v === 'object') for (const [k, on] of Object.entries(v)) if (isDateKey(k) && on) out[k] = true;
  return out;
}
const ID_RE = /^[\w-]{1,24}$/;
function idList(v, max = MAX_TASK_TAGS) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((id) => typeof id === 'string' && ID_RE.test(id)))].slice(0, max);
}
function tagList(v) {
  if (!Array.isArray(v)) return [];
  const seen = new Set();
  const out = [];
  for (const t of v) {
    if (!t || typeof t !== 'object' || !ID_RE.test(t.id) || seen.has(t.id)) continue;
    const name = str(t.name, 20).trim();
    if (!name) continue;
    seen.add(t.id);
    out.push({ id: t.id, name, color: TAG_COLOR_IDS.includes(t.color) ? t.color : 'blue' });
  }
  return out.slice(0, MAX_TAGS);
}
function templateList(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const t of v) {
    if (!t || typeof t !== 'object' || !ID_RE.test(t.id)) continue;
    const name = str(t.name, 40).trim();
    if (!name) continue;
    out.push({
      id: t.id,
      name,
      title: str(t.title, 300),
      notes: str(t.notes, 2000),
      checklist: Array.isArray(t.checklist) ? t.checklist.filter((x) => typeof x === 'string' && x.trim()).slice(0, 50).map((x) => x.slice(0, 200)) : [],
      tags: idList(t.tags),
      time: time(t.time),
      duration: clamp(Math.round(num(t.duration, 60)), 5, 1440),
      priority: oneOf(t.priority, ENUMS.priority, 'none'),
      remind: remindVal(t.remind),
    });
  }
  return out.slice(0, 30);
}

function checklist(v) {
  if (!Array.isArray(v)) return [];
  return v
    .filter((i) => i && typeof i === 'object' && typeof i.text === 'string' && i.text.trim())
    .slice(0, 50)
    .map((i, n) => ({ id: str(i.id, 40) || `c${n}`, text: str(i.text, 200), done: !!i.done }));
}

// 把任何來源（雲端、本機、備份檔）的資料整理成正確格式
export function normalize(col, raw = {}) {
  const d = { ...DEFAULTS[col](), ...raw };
  if (col === 'tasks') {
    return {
      id: raw.id,
      title: str(d.title, 300),
      notes: str(d.notes),
      date: date(d.date),
      time: time(d.time),
      duration: clamp(Math.round(num(d.duration, 60)), 5, 1440),
      priority: oneOf(d.priority, ENUMS.priority, 'none'),
      status: oneOf(d.status, ENUMS.status, 'todo'),
      goalId: str(d.goalId, 100),
      repeat: oneOf(d.repeat, REPEATS, 'none'),
      repeatDays: dayList(d.repeatDays),
      repeatUntil: date(d.repeatUntil),
      doneOn: dateMap(d.doneOn),
      checklist: checklist(d.checklist),
      tags: idList(d.tags),
      remind: remindVal(d.remind),
      doneAt: typeof d.doneAt === 'number' ? d.doneAt : null,
      createdAt: num(d.createdAt),
      updatedAt: num(d.updatedAt),
    };
  }
  if (col === 'journal') {
    return {
      id: raw.id,
      date: date(d.date) || date(raw.id),
      mood: clamp(Math.round(num(d.mood)), 0, 5),
      text: str(d.text, 300),
      createdAt: num(d.createdAt),
      updatedAt: num(d.updatedAt),
    };
  }
  if (col === 'goals') {
    return {
      id: raw.id,
      title: str(d.title, 300),
      why: str(d.why),
      area: str(d.area, 40),
      emoji: str(d.emoji, 16) || '🎯',
      deadline: date(d.deadline),
      status: oneOf(d.status, ENUMS.goalStatus, 'active'),
      progressMode: oneOf(d.progressMode, ENUMS.progressMode, 'tasks'),
      progress: clamp(num(d.progress), 0, 100),
      doneAt: typeof d.doneAt === 'number' ? d.doneAt : null,
      createdAt: num(d.createdAt),
      updatedAt: num(d.updatedAt),
    };
  }
  if (col === 'habits') {
    const days = Array.isArray(d.days) ? [...new Set(d.days.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort() : [...ALL_DAYS];
    const log = {};
    if (d.log && typeof d.log === 'object') {
      for (const [k, v] of Object.entries(d.log)) if (isDateKey(k) && v) log[k] = true;
    }
    return {
      id: raw.id,
      name: str(d.name, 120),
      emoji: str(d.emoji, 16) || '✅',
      days: days.length ? days : [...ALL_DAYS],
      log,
      archived: !!d.archived,
      order: num(d.order),
      createdAt: num(d.createdAt),
      updatedAt: num(d.updatedAt),
    };
  }
  if (col === 'reviews') {
    const focus = Array.isArray(d.focus) ? d.focus.slice(0, 3).map((x) => str(x, 200)) : [];
    while (focus.length < 3) focus.push('');
    return {
      id: raw.id,
      week: date(d.week) || date(raw.id),
      wins: str(d.wins, 4000),
      improve: str(d.improve, 4000),
      focus,
      createdAt: num(d.createdAt),
      updatedAt: num(d.updatedAt),
    };
  }
  return { ...raw };
}

export function normalizeSettings(raw = {}) {
  const s = { ...DEFAULT_SETTINGS, ...raw };
  return {
    // 第一、二版的預設名稱「我的規劃本」自動換成「計劃版」
    title: (str(s.title, 60) || DEFAULT_SETTINGS.title).replace(/^我的規劃本$/, DEFAULT_SETTINGS.title),
    icon: str(s.icon, 16),
    coverStyle: oneOf(s.coverStyle, COVER_IDS, 'clouds'),
    coverSeed: Number.isInteger(s.coverSeed) ? s.coverSeed : DEFAULT_SETTINGS.coverSeed,
    theme: oneOf(s.theme, ['auto', 'light', 'dark'], 'auto'),
    palette: oneOf(s.palette, PALETTE_IDS, 'strawberry'),
    weekStart: s.weekStart === 0 ? 0 : 1,
    gcalOn: s.gcalOn === true,
    gcalId: str(s.gcalId, 300),
    gcalHash: str(s.gcalHash, 80),
    gcalAt: num(s.gcalAt),
    gsUrl: /^https:\/\/script\.google\.com\//.test(str(s.gsUrl, 300)) ? str(s.gsUrl, 300) : '',
    gsKey: /^[a-z0-9]{16,64}$/.test(str(s.gsKey, 64)) ? str(s.gsKey, 64) : '',
    gsPick: s.gsPick === true,
    gsCals: Array.isArray(s.gsCals) ? s.gsCals.filter((id) => typeof id === 'string' && id && id.length <= 300).slice(0, 50) : [],
    tags: tagList(s.tags),
    templates: templateList(s.templates),
    backupOn: s.backupOn !== false,
    backupDay: date(s.backupDay),
    backupUrl: /^https:\/\/drive\.google\.com\//.test(str(s.backupUrl, 300)) ? str(s.backupUrl, 300) : '',
  };
}

// 存檔用：去掉 id 欄位
export function toStored(col, doc) {
  const { id, ...rest } = normalize(col, doc);
  return rest;
}

export function newDoc(col, data = {}) {
  const now = Date.now();
  return toStored(col, { ...data, createdAt: now, updatedAt: now });
}

// ---- 任務 ----
export function compareTasks(a, b) {
  if (a.date !== b.date) {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date < b.date ? -1 : 1;
  }
  if (a.time !== b.time) {
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time < b.time ? -1 : 1;
  }
  if (RANK[a.priority] !== RANK[b.priority]) return RANK[a.priority] - RANK[b.priority];
  return a.createdAt - b.createdAt;
}

export const isDone = (t) => t.status === 'done';

// ---- 重複的任務 ----
// 清單裡的「這一次」是一份任務的複本：date 換成那一天、occ 記著是哪一天，完成與否看 doneOn
export const isRepeating = (t) => t.repeat !== 'none' && !!t.date;
export const repeatDaysOf = (t) => (t.repeatDays.length ? t.repeatDays : [weekdayOf(t.date)]);

export function occursOn(t, key) {
  if (!isRepeating(t)) return t.date === key;
  if (key < t.date || (t.repeatUntil && key > t.repeatUntil)) return false;
  if (t.repeat === 'daily') return true;
  if (t.repeat === 'weekly') return repeatDaysOf(t).includes(weekdayOf(key));
  return key.slice(8) === t.date.slice(8);
}

export function nextOccurrence(t, from, limit = 400) {
  let k = from < t.date ? t.date : from;
  for (let i = 0; i < limit; i++, k = addDays(k, 1)) {
    if (t.repeatUntil && k > t.repeatUntil) return '';
    if (occursOn(t, k)) return k;
  }
  return '';
}

export function occurrence(t, key) {
  const done = !!t.doneOn[key];
  return { ...t, date: key, occ: key, status: done ? 'done' : 'todo', doneAt: done ? t.updatedAt || 0 : null };
}

export function repeatLabel(t) {
  if (!isRepeating(t)) return '';
  if (t.repeat === 'daily') return '每天';
  if (t.repeat === 'monthly') return `每月 ${Number(t.date.slice(8))} 號`;
  return daysLabel(repeatDaysOf(t));
}

// 某段日期裡的所有任務（重複的任務展開成每一次）
export function expandTasks(tasks, from, to) {
  const out = [];
  for (const t of tasks) {
    if (!isRepeating(t)) {
      if (t.date && t.date >= from && t.date <= to) out.push(t);
      continue;
    }
    let k = from < t.date ? t.date : from;
    for (let i = 0; k <= to && i < 800; i++, k = addDays(k, 1)) {
      if (t.repeatUntil && k > t.repeatUntil) break;
      if (occursOn(t, k)) out.push(occurrence(t, k));
    }
  }
  return out;
}

// 清單用：重複的任務只放今天那次和下一次（今天沒做完就只放今天）；已經結束的放在「已完成」
export function listTasks(tasks, today = todayKey()) {
  const out = [];
  for (const t of tasks) {
    if (!isRepeating(t)) {
      out.push(t);
      continue;
    }
    const todayOcc = occursOn(t, today) ? occurrence(t, today) : null;
    if (todayOcc) out.push(todayOcc);
    // 今天的那次做完了（或今天沒有），就把下一次也放進來
    if (!todayOcc || isDone(todayOcc)) {
      const next = nextOccurrence(t, addDays(today, 1));
      if (next) out.push(occurrence(t, next));
      else if (!todayOcc) out.push({ ...t, status: 'done', ended: true, doneAt: t.updatedAt || 0 });
    }
  }
  return out;
}

// 時間範圍（給時間軸和 Google 日曆用）
export function endTime(t) {
  if (!t.time) return '';
  const [h, m] = t.time.split(':').map(Number);
  const total = Math.min(h * 60 + m + (t.duration || 60), 24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function checklistProgress(t) {
  const total = t.checklist.length;
  return { total, done: t.checklist.filter((i) => i.done).length };
}

export function tasksByDate(tasks, from = '', to = '') {
  const map = new Map();
  for (const t of from && to ? expandTasks(tasks, from, to) : tasks) {
    if (!t.date) continue;
    if (!map.has(t.date)) map.set(t.date, []);
    map.get(t.date).push(t);
  }
  for (const list of map.values()) list.sort((a, b) => Number(isDone(a)) - Number(isDone(b)) || compareTasks(a, b));
  return map;
}

// ---- 目標 ----
// 重複的任務是例行公事，不算進目標進度
export function goalProgress(goal, tasks) {
  const linked = tasks.filter((t) => t.goalId === goal.id && !isRepeating(t));
  const done = linked.filter(isDone).length;
  let pct;
  if (goal.status === 'done') pct = 100;
  else if (goal.progressMode === 'manual') pct = clamp(Math.round(goal.progress), 0, 100);
  else pct = linked.length ? Math.round((done / linked.length) * 100) : 0;
  return { pct, done, total: linked.length, linked };
}

export function deadlineInfo(deadline, today = todayKey()) {
  if (!deadline) return { text: '沒有期限', tone: 'muted' };
  const n = diffDays(today, deadline);
  if (n === 0) return { text: '今天到期', tone: 'warn' };
  if (n < 0) return { text: `已過期 ${-n} 天`, tone: 'over' };
  if (n <= 7) return { text: `還有 ${n} 天`, tone: 'warn' };
  return { text: `還有 ${n} 天`, tone: 'muted' };
}

// ---- 習慣 ----
export function isScheduled(habit, key) {
  return habit.days.includes(weekdayOf(key));
}

export function isChecked(habit, key) {
  return !!habit.log[key];
}

export function habitStart(habit, today = todayKey()) {
  const created = habit.createdAt ? toKey(new Date(habit.createdAt)) : today;
  const first = Object.keys(habit.log).sort()[0];
  return first && first < created ? first : created;
}

export function habitStats(habit, today = todayKey()) {
  const start = habitStart(habit, today);

  // 目前連續：今天還沒打卡不算中斷，從昨天開始往回算
  let streak = 0;
  let key = today;
  if (isScheduled(habit, key) && !isChecked(habit, key)) key = addDays(key, -1);
  for (let i = 0; i < 3660 && key >= start; i++, key = addDays(key, -1)) {
    if (!isScheduled(habit, key)) continue;
    if (isChecked(habit, key)) streak++;
    else break;
  }

  let best = 0;
  let run = 0;
  for (let k = start, i = 0; k <= today && i < 3660; k = addDays(k, 1), i++) {
    if (!isScheduled(habit, k)) continue;
    if (isChecked(habit, k)) {
      run++;
      best = Math.max(best, run);
    } else if (k !== today) run = 0;
  }

  const monthStart = `${today.slice(0, 8)}01`;
  let scheduled = 0;
  let done = 0;
  for (let k = monthStart > start ? monthStart : start, i = 0; k <= today && i < 40; k = addDays(k, 1), i++) {
    if (!isScheduled(habit, k)) continue;
    const c = isChecked(habit, k);
    if (k === today && !c) continue;
    scheduled++;
    if (c) done++;
  }
  return { streak, best: Math.max(best, streak), monthRate: scheduled ? Math.round((done / scheduled) * 100) : null };
}

export function daysLabel(days) {
  const set = [...days].sort().join('');
  if (set === '0123456') return '每天';
  if (set === '12345') return '平日';
  if (set === '06') return '週末';
  const names = ['日', '一', '二', '三', '四', '五', '六'];
  const order = [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d));
  return `每週${order.map((d) => names[d]).join('、')}`;
}

export function activeHabits(habits) {
  return habits.filter((h) => !h.archived).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}
