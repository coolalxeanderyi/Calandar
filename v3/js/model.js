// 資料規則：欄位預設值、排序、目標進度、習慣統計
import { todayKey, addDays, weekdayOf, toKey, diffDays, isDateKey, clamp } from './utils.js';

export const PRIORITY_LABEL = { high: '高', medium: '中', low: '低', none: '無' };
const RANK = { high: 0, medium: 1, low: 2, none: 3 };
export const STATUS_LABEL = { todo: '待辦', doing: '進行中', done: '完成' };
export const GOAL_STATUS_LABEL = { active: '進行中', done: '已完成', paused: '暫停' };
export const AREA_SUGGESTIONS = ['工作', '學習', '健康', '財務', '生活', '創作'];
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const COVER_IDS = ['clouds', 'gingham', 'sprinkles', 'boba', 'dots', 'waves', 'lemons', 'stars', 'fields', 'coast', 'terraces', 'dunes'];
const PALETTE_IDS = ['strawberry', 'matcha', 'milktea', 'soda', 'lemon', 'blueberry', 'peach', 'mintchoco', 'night', 'mono'];

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
};

const DEFAULTS = {
  tasks: () => ({ title: '', notes: '', date: '', time: '', priority: 'none', status: 'todo', goalId: '', doneAt: null, createdAt: 0, updatedAt: 0 }),
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
      priority: oneOf(d.priority, ENUMS.priority, 'none'),
      status: oneOf(d.status, ENUMS.status, 'todo'),
      goalId: str(d.goalId, 100),
      doneAt: typeof d.doneAt === 'number' ? d.doneAt : null,
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

export function tasksByDate(tasks) {
  const map = new Map();
  for (const t of tasks) {
    if (!t.date) continue;
    if (!map.has(t.date)) map.set(t.date, []);
    map.get(t.date).push(t);
  }
  for (const list of map.values()) list.sort((a, b) => Number(isDone(a)) - Number(isDone(b)) || compareTasks(a, b));
  return map;
}

// ---- 目標 ----
export function goalProgress(goal, tasks) {
  const linked = tasks.filter((t) => t.goalId === goal.id);
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
