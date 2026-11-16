// 共用小工具：HTML 跳脫、ID、日期計算
// 日期一律用本地時間的 'YYYY-MM-DD' 字串當作 key，方便比較與儲存。

export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

// 標記「刪除這個欄位」，雲端和本機兩種儲存方式都看得懂
export const DELETE = Symbol('delete-field');

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function uid() {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function isPlainObject(v) {
  return v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

const pad = (n) => String(n).padStart(2, '0');

export function toKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isDateKey(key) {
  return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key);
}

export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey() {
  return toKey(new Date());
}

export function addDays(key, n) {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

// b 減 a 的天數（b 在 a 之後為正數）
export function diffDays(a, b) {
  return Math.round((fromKey(b) - fromKey(a)) / 86400000);
}

export function weekdayOf(key) {
  return fromKey(key).getDay();
}

export function weekStartKey(key, weekStart = 1) {
  const d = fromKey(key);
  const back = (d.getDay() - weekStart + 7) % 7;
  d.setDate(d.getDate() - back);
  return toKey(d);
}

export function weekKeys(key, weekStart = 1) {
  const start = weekStartKey(key, weekStart);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function monthKey(key) {
  return key.slice(0, 7);
}

// 月曆格子：回傳每一週 7 天的 key（含前後月份補位）
export function monthGrid(year, month, weekStart = 1) {
  const first = toKey(new Date(year, month, 1));
  const start = weekStartKey(first, weekStart);
  const offset = diffDays(start, first);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const rows = Math.ceil((offset + daysInMonth) / 7);
  return Array.from({ length: rows }, (_, w) =>
    Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i)),
  );
}

export function orderedWeekdays(weekStart = 1) {
  return Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7);
}

export function fmtMonthDay(key) {
  const d = fromKey(key);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function fmtShort(key) {
  const d = fromKey(key);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function fmtWeekday(key) {
  return `星期${WEEKDAYS[weekdayOf(key)]}`;
}

export function fmtYearMonth(year, month) {
  return `${year} 年 ${month + 1} 月`;
}

// 任務日期的人性化顯示：今天、明天、週三、11/30
export function relativeDay(key, today = todayKey()) {
  const n = diffDays(today, key);
  if (n === 0) return '今天';
  if (n === 1) return '明天';
  if (n === -1) return '昨天';
  if (n > 1 && n < 7) return `週${WEEKDAYS[weekdayOf(key)]}`;
  return fmtShort(key);
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return '夜深了';
  if (h < 11) return '早安';
  if (h < 14) return '午安';
  if (h < 18) return '下午好';
  return '晚上好';
}

export function debounce(fn, wait = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export function downloadFile(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
