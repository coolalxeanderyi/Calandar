// 時區：有時間的任務放進 Google 日曆時，用哪個時區。
// 存在設定裡，每台裝置都一樣。不然一台已經是台灣時間、一台還是英國時間的話，
// 兩台輪流打開，Google 日曆上的行程就會被改來改去（差 8 小時）。

const NAMES = {
  UTC: '世界標準時間',
  'Asia/Taipei': '台北',
  'Europe/London': '倫敦',
  'Asia/Tokyo': '東京',
  'Asia/Seoul': '首爾',
  'Asia/Hong_Kong': '香港',
  'Asia/Macau': '澳門',
  'Asia/Shanghai': '上海',
  'Asia/Singapore': '新加坡',
  'Asia/Kuala_Lumpur': '吉隆坡',
  'Asia/Bangkok': '曼谷',
  'Asia/Ho_Chi_Minh': '胡志明市',
  'Asia/Manila': '馬尼拉',
  'Asia/Jakarta': '雅加達',
  'Asia/Kolkata': '印度',
  'Asia/Dubai': '杜拜',
  'Australia/Perth': '伯斯',
  'Australia/Brisbane': '布里斯本',
  'Australia/Sydney': '雪梨',
  'Australia/Melbourne': '墨爾本',
  'Pacific/Auckland': '奧克蘭',
  'Europe/Dublin': '都柏林',
  'Europe/Lisbon': '里斯本',
  'Europe/Paris': '巴黎',
  'Europe/Berlin': '柏林',
  'Europe/Amsterdam': '阿姆斯特丹',
  'Europe/Madrid': '馬德里',
  'Europe/Rome': '羅馬',
  'Europe/Zurich': '蘇黎世',
  'America/New_York': '紐約',
  'America/Toronto': '多倫多',
  'America/Chicago': '芝加哥',
  'America/Denver': '丹佛',
  'America/Los_Angeles': '洛杉磯',
  'America/Vancouver': '溫哥華',
  'Pacific/Honolulu': '夏威夷',
};

export function validZone(zone) {
  if (!zone || typeof zone !== 'string' || zone.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export function deviceZone() {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return validZone(z) ? z : 'UTC';
  } catch {
    return 'UTC';
  }
}

// 計劃版用的時區：設定裡的；還沒設定（舊資料）就先用這台裝置的
export const plannerZone = (settings) => (validZone(settings?.timeZone) ? settings.timeZone : deviceZone());

// 那個時區在某個時間點比 UTC 快幾分鐘（台北 = 480，倫敦冬天 = 0、夏天 = 60）
export function zoneOffset(zone, at = Date.now()) {
  const t = Math.floor(at / 60000) * 60000;
  const parts = {};
  for (const p of new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(new Date(t))) parts[p.type] = p.value;
  const wall = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour) % 24, Number(parts.minute));
  return Math.round((wall - t) / 60000);
}

export function offsetText(min) {
  if (!min) return 'UTC+0';
  const sign = min > 0 ? '+' : '-';
  const a = Math.abs(min);
  return `UTC${sign}${Math.floor(a / 60)}${a % 60 ? `:${String(a % 60).padStart(2, '0')}` : ''}`;
}

export const zoneCity = (zone) => NAMES[zone] || String(zone).split('/').pop().replace(/_/g, ' ');
export const zoneLabel = (zone, at = Date.now()) => `${zoneCity(zone)}（${offsetText(zoneOffset(zone, at))}）`;

// 設定裡可以選的時區：常用的，加上這台裝置的和現在設定的，照時差排
export function zoneChoices(current, at = Date.now()) {
  const list = new Set([...Object.keys(NAMES), deviceZone(), current].filter(validZone));
  return [...list].sort((a, b) => zoneOffset(a, at) - zoneOffset(b, at) || zoneCity(a).localeCompare(zoneCity(b), 'zh-Hant'));
}

// 兩個時區現在和半年後的時差都一樣（例如倫敦和都柏林），就當成一樣
export function sameClock(a, b, at = Date.now()) {
  if (a === b) return true;
  const later = at + 182 * 86400000;
  return zoneOffset(a, at) === zoneOffset(b, at) && zoneOffset(a, later) === zoneOffset(b, later);
}

// 這台裝置選過「維持」的話就不再問（只記這一組：裝置的時區 → 設定的時區）
const SKIP = 'planner.zoneSkip';

export function skipZone(device, planner) {
  try {
    localStorage.setItem(SKIP, `${device}>${planner}`);
  } catch { /* 存不了就下次再問 */ }
}

function skipped(device, planner) {
  try {
    return localStorage.getItem(SKIP) === `${device}>${planner}`;
  } catch {
    return false;
  }
}

// 這台裝置的時區跟計劃版的不一樣：只有放進 Google 日曆時才有影響，才需要問
export function zoneMismatch(settings) {
  if (!settings?.gcalOn || !validZone(settings.timeZone)) return null;
  const device = deviceZone();
  const planner = settings.timeZone;
  if (sameClock(device, planner) || skipped(device, planner)) return null;
  return { device, planner };
}
