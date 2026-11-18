// 天氣：用 Open-Meteo（免費、不用申請帳號、不用金鑰）
// 查到的天氣存在這台裝置 30 分鐘，不會每次打開都去問
const CACHE = 'planner.weather';
const FRESH = 30 * 60 * 1000; // 30 分鐘內的資料直接用
const STALE = 3 * 60 * 60 * 1000; // 沒網路時，3 小時內的舊資料還可以顯示
const RETRY = 60 * 1000; // 問失敗了，一分鐘後才再問

export const CREDIT_URL = 'https://open-meteo.com/';

const listeners = new Set();
const tried = new Map(); // 地點 → 上次去問的時間
let pending = '';

export function onWeather(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const placeKey = (p) => `${p.lat},${p.lon}`;

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE) || 'null');
  } catch {
    return null;
  }
}

function writeCache(v) {
  try {
    localStorage.setItem(CACHE, JSON.stringify(v));
  } catch { /* 存不了就算了，下次再問 */ }
}

// 拿天氣：夠新就直接用；舊了先用舊的，同時在背景更新（好了會通知重畫）
export function weatherFor(place, now = Date.now()) {
  if (!place) return null;
  const c = readCache();
  const hit = c && c.key === placeKey(place) ? c : null;
  if (!hit || now - hit.at > FRESH) refresh(place);
  return hit && now - hit.at < STALE ? hit.data : null;
}

function refresh(place) {
  const key = placeKey(place);
  if (pending === key || Date.now() - (tried.get(key) || 0) < RETRY) return;
  pending = key;
  tried.set(key, Date.now());
  fetchWeather(place)
    .then((data) => {
      writeCache({ key, at: Date.now(), data });
      for (const fn of listeners) fn();
    })
    .catch(() => { /* 沒網路或服務暫時不能用：先不顯示，之後再試 */ })
    .finally(() => {
      if (pending === key) pending = '';
    });
}

const round = (v) => (Number.isFinite(v) ? Math.round(v) : null);

export async function fetchWeather({ lat, lon }) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + '&current=temperature_2m,weather_code'
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
    + '&timezone=auto&forecast_days=2';
  const r = await fetch(url);
  if (!r.ok) throw new Error(`天氣服務回應 ${r.status}`);
  const j = await r.json();
  const d = j.daily || {};
  return {
    offset: Number(j.utc_offset_seconds) || 0, // 那個地方的時差（秒），用來判斷那裡現在幾點
    temp: round(j.current?.temperature_2m),
    days: (d.time || []).map((date, i) => ({
      date,
      code: d.weather_code?.[i] ?? null,
      max: round(d.temperature_2m_max?.[i]),
      min: round(d.temperature_2m_min?.[i]),
      rain: round(d.precipitation_probability_max?.[i]), // 下雨機率（%）
    })),
  };
}

// 用城市名稱找地點
export async function searchPlaces(query) {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=zh&format=json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`找地點的服務回應 ${r.status}`);
  const j = await r.json();
  // 用中文搜尋時，名稱就用使用者打的字（服務回傳的常是簡體字）
  const typedName = /[㐀-鿿]/.test(q) ? q.slice(0, 40) : '';
  return (j.results || []).map((x) => ({
    name: typedName || x.name,
    found: x.name,
    area: [x.admin1, x.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i && v !== x.name).join('，'),
    lat: x.latitude,
    lon: x.longitude,
  }));
}

// ---- 天氣代碼（WMO）→ 文字 ----
const DRIZZLE = new Set([51, 53, 55, 56, 57]);
const RAIN = new Set([61, 63, 65, 66, 67, 80, 81, 82]);
const SNOW = new Set([71, 73, 75, 77, 85, 86]);
const STORM = new Set([95, 96, 99]);
const FOG = new Set([45, 48]);

function sky(code) {
  if (STORM.has(code)) return ['⛈️', '有雷雨'];
  if (SNOW.has(code)) return ['🌨️', '會下雪'];
  if (RAIN.has(code)) return ['🌧️', '會下雨'];
  if (DRIZZLE.has(code)) return ['🌦️', '會下毛毛雨'];
  if (FOG.has(code)) return ['🌫️', '有霧'];
  if (code === 0) return ['☀️', '晴天'];
  if (code === 1) return ['🌤️', '大致晴朗'];
  if (code === 2) return ['⛅', '晴時多雲'];
  if (code === 3) return ['☁️', '陰天'];
  return ['🌡️', ''];
}

// 那個地方現在的日期和幾點
function localNow(offset, now) {
  const d = new Date(now + offset * 1000);
  const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return { key, hour: d.getUTCHours() };
}

function nextKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

// 小日曆說的那一句天氣，例如「倫敦現在 8°C，今天 5～10°C，會下雨，記得帶傘」
// 晚上 6 點以後改說明天的天氣，讓你先準備
export function weatherLine(data, place, now = Date.now()) {
  if (!data) return null;
  const { key, hour } = localNow(data.offset || 0, now);
  const evening = hour >= 18;
  const day = data.days.find((x) => x.date === (evening ? nextKey(key) : key));
  const where = place?.name && place.name !== '目前位置' ? place.name : '';
  const parts = [];
  if (data.temp !== null) parts.push(`${where}現在 ${data.temp}°C`);
  if (!day) {
    if (!parts.length) return null;
    return { emoji: '🌡️', text: parts[0] };
  }
  const [emoji, desc0] = sky(day.code);
  const wet = STORM.has(day.code) || RAIN.has(day.code) || DRIZZLE.has(day.code);
  const snowy = SNOW.has(day.code);
  const tips = [];
  let desc = desc0;
  if (wet && day.rain !== null && day.rain < 40) {
    desc = '可能會下雨';
    tips.push('帶把傘比較保險');
  } else if (wet) {
    tips.push('記得帶傘');
  } else if (!snowy && day.rain !== null && day.rain >= 50) {
    desc = desc ? `${desc}，可能會下雨` : '可能會下雨';
    tips.push('帶把傘比較保險');
  }
  if (snowy) tips.push('路上小心滑');
  if (day.max !== null && day.max <= 10) tips.push('穿暖一點');
  else if (day.min !== null && day.min <= 8) tips.push('早晚涼，多帶件外套');
  if (day.max !== null && day.max >= 33) tips.push('記得多喝水');
  if (FOG.has(day.code) && tips.length < 2) tips.push('出門注意安全');
  // 溫度範圍用「～」，零下的時候才看得清楚（例如 -3～1°C）
  const range = day.min !== null && day.max !== null ? ` ${day.min}～${day.max}°C` : '';
  parts.push(`${parts.length ? '' : where}${evening ? '明天' : '今天'}${range}`);
  if (desc) parts.push(desc);
  if (tips.length) parts.push(tips.slice(0, 2).join('、'));
  return { emoji, text: parts.join('，') };
}
