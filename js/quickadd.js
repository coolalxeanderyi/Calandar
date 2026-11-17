// 快速新增：從一句話裡找出日期、時間、時長、優先度和 #標籤，剩下的就是任務名稱。
// 例如「明天下午3點半 家教 2小時 #工作 !高」
import { addDays, fromKey, toKey, weekStartKey, relativeDay } from './utils.js';

const CN = { 零: 0, 〇: 0, 一: 1, 二: 2, 兩: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const N = '(\\d{1,2}|[零〇一二兩两三四五六七八九十]{1,3})';
const WD = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
const WEEK = '(?:週|周|星期|禮拜|礼拜)';

// 「三」「十二」「二十」「12」→ 數字
export function cnNumber(text) {
  const s = String(text || '').trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  if (!s || [...s].some((ch) => !(ch in CN))) return NaN;
  if (s.includes('十')) {
    const [a, b] = s.split('十');
    return (a ? CN[a] : 1) * 10 + (b ? CN[b] : 0);
  }
  return [...s].reduce((n, ch) => n * 10 + CN[ch], 0);
}

const pad = (n) => String(n).padStart(2, '0');

function validDate(y, m, d) {
  const date = new Date(y, m - 1, d);
  return date.getMonth() === m - 1 && date.getDate() === d ? toKey(date) : '';
}

// 月／日：已經過了一個月以上的，當成明年
function monthDay(m, d, today) {
  const y = Number(today.slice(0, 4));
  const key = validDate(y, m, d);
  if (!key) return '';
  return key < addDays(today, -30) ? validDate(y + 1, m, d) : key;
}

// 這週或下週的星期幾（「週五」＝今天以後最近的星期五，今天是星期五就是今天）
function upcomingWeekday(wd, today) {
  const cur = fromKey(today).getDay();
  return addDays(today, (wd - cur + 7) % 7);
}
function nextWeekday(wd, today, weekStart) {
  const start = addDays(weekStartKey(today, weekStart), 7);
  const offset = (wd - weekStart + 7) % 7;
  return addDays(start, offset);
}

function hourOf(period, h, loose) {
  if (!(h >= 0 && h <= 24)) return NaN;
  if (/下午|傍晚|晚上|今晚|夜裡/.test(period)) return h < 12 ? h + 12 : h;
  if (period === '中午') return h === 12 ? 12 : h < 6 ? h + 12 : h;
  if (/凌晨|半夜/.test(period)) return h === 12 ? 0 : h;
  if (period) return h === 24 ? 0 : h; // 早上、上午、清晨
  // 沒說上午下午：1～6 點當成下午（「3點開會」通常是下午）
  if (loose && h >= 1 && h <= 6) return h + 12;
  return h === 24 ? 0 : h;
}

export function parseQuick(input, { today, weekStart = 1 } = {}) {
  let text = ` ${String(input || '')} `;
  const out = { title: '', date: '', time: '', duration: 0, priority: '', tags: [] };
  const take = (re, fn) => {
    text = text.replace(re, (...m) => {
      const keep = fn(...m);
      return keep === false ? m[0] : ' ';
    });
  };

  // 口語的縮寫：「今晚8點」＝今天晚上 8 點；後面沒有幾點的「今晚」就只當成日期
  const SHORT = { 今晚: ['今天', '晚上'], 明晚: ['明天', '晚上'], 今早: ['今天', '早上'], 明早: ['明天', '早上'] };
  text = text.replace(new RegExp(`(今晚|明晚|今早|明早)(?=\\s*${N}\\s*(?:點|点|時|[:：]))`, 'g'), (w) => SHORT[w].join(''));
  text = text.replace(/今晚|明晚|今早|明早/g, (w) => SHORT[w][0]);

  // #標籤
  take(/[#＃]([^\s#＃,，。、!！?？]+)/g, (_, name) => {
    if (!out.tags.includes(name)) out.tags.push(name);
  });

  // 優先度：!高 !中 !低，或 !!!（高）、!!（中）
  take(/[!！]\s*(高|中|低)/, (_, p) => {
    out.priority = { 高: 'high', 中: 'medium', 低: 'low' }[p];
  });
  if (!out.priority) {
    take(/(^|\s)([!！]{2,3})(?=\s|$)/, (_, pre, marks) => {
      out.priority = marks.length >= 3 ? 'high' : 'medium';
    });
  }

  // 時長：2小時、1.5小時、一個半小時、半小時、90分鐘、1小時30分
  take(/(\d+(?:\.\d+)?|[一二兩两三四五六七八九十]+)\s*個?\s*(半)?\s*(?:小時|鐘頭|hours?|hrs?|h)(?:\s*(\d{1,2}|[一二三四五六七八九十]{1,3})\s*分(?:鐘)?)?(?![a-z])/i, (_, h, half, m) => {
    const total = Math.round((cnNumber(h) + (half ? 0.5 : 0)) * 60 + (m ? cnNumber(m) : 0));
    if (!(total > 0)) return false;
    out.duration = total;
  });
  if (!out.duration) {
    take(/半\s*個?\s*(?:小時|鐘頭)/, () => {
      out.duration = 30;
    });
  }
  if (!out.duration) {
    take(/(\d{1,3}|[一二兩两三四五六七八九十]{1,3})\s*(?:分鐘|mins?)/i, (_, m) => {
      const n = cnNumber(m);
      if (!(n > 0)) return false;
      out.duration = n;
    });
  }

  // 日期
  const rel = { 大後天: 3, 後天: 2, 明天: 1, 明日: 1, 今天: 0, 今日: 0 };
  take(/大後天|後天|明天|明日|今天|今日/, (w) => {
    out.date = addDays(today, rel[w]);
  });
  if (!out.date) {
    take(new RegExp(`下(?:個)?${WEEK}([一二三四五六日天])`), (_, d) => {
      out.date = nextWeekday(WD[d], today, weekStart);
    });
  }
  if (!out.date) {
    take(new RegExp(`下(?:個)?${WEEK}?末`), () => {
      out.date = nextWeekday(6, today, weekStart);
    });
  }
  if (!out.date) {
    take(new RegExp(`(?:這|这|本)?${WEEK}([一二三四五六日天])`), (_, d) => {
      out.date = upcomingWeekday(WD[d], today);
    });
  }
  if (!out.date) {
    take(/(?:這|这|本)?(?:週|周)末/, () => {
      out.date = upcomingWeekday(6, today);
    });
  }
  if (!out.date) {
    take(new RegExp(`${N}\\s*月\\s*${N}\\s*[日號号]?`), (_, m, d) => {
      const key = monthDay(cnNumber(m), cnNumber(d), today);
      if (!key) return false;
      out.date = key;
    });
  }
  if (!out.date) {
    take(/(?<![\d:：])(\d{1,2})\s*[/／]\s*(\d{1,2})(?![\d/／])/, (_, m, d) => {
      const key = monthDay(Number(m), Number(d), today);
      if (!key) return false;
      out.date = key;
    });
  }
  if (!out.date) {
    take(new RegExp(`下個月\\s*${N}\\s*[日號号]?`), (_, d) => {
      const t = fromKey(today);
      const key = validDate(t.getFullYear(), t.getMonth() + 2, cnNumber(d));
      if (!key) return false;
      out.date = key;
    });
  }
  if (!out.date) {
    // 用數字的「20日」「20號」，或中文的「二十號」（中文配「日」容易跟「三日遊」搞混，不算）
    take(/(?<![\d月])(?:(\d{1,2})\s*[日號号]|([一二三四五六七八九十]{1,3})\s*[號号])(?!\s*(?:點|:|：))/, (_, d1, d2) => {
      const t = fromKey(today);
      const day = cnNumber(d1 || d2);
      let key = validDate(t.getFullYear(), t.getMonth() + 1, day);
      if (key && key < today) key = validDate(t.getFullYear(), t.getMonth() + 2, day);
      if (!key) return false;
      out.date = key;
    });
  }

  // 時間：下午3點半、晚上8點15分、早上9點、15:30、3點
  const PERIOD = '(凌晨|清晨|早上|上午|中午|下午|傍晚|晚上|半夜)?';
  take(new RegExp(`${PERIOD}\\s*(\\d{1,2})\\s*[:：]\\s*(\\d{2})(?!\\d)`), (_, period = '', h, m) => {
    const hour = hourOf(period, Number(h), false);
    if (!(hour >= 0 && hour <= 23) || Number(m) > 59) return false;
    out.time = `${pad(hour)}:${m}`;
  });
  if (!out.time) {
    take(new RegExp(`${PERIOD}\\s*${N}\\s*(?:點鐘|點|点|時)\\s*(半|${N}\\s*分?)?`), (_, period = '', h, extra = '', m) => {
      // 「快一點」「多一點」的「一點」不是時間
      if (!period && /^[一]$/.test(h) && !extra) return false;
      const hour = hourOf(period, cnNumber(h), !period);
      const min = extra === '半' ? 30 : m ? cnNumber(m) : 0;
      if (!(hour >= 0 && hour <= 23) || !(min >= 0 && min <= 59)) return false;
      out.time = `${pad(hour)}:${pad(min)}`;
    });
  }

  out.title = text.replace(/\s+/g, ' ').replace(/^[\s，,、。.:：-]+|[\s，,、。.:：-]+$/g, '').trim();
  return out;
}

// 給預覽用：「明天」「15:30」「2 小時」「高」「#工作」
export function quickLabels(p, today) {
  const parts = [];
  if (p.date) parts.push(relativeDay(p.date, today));
  if (p.time) parts.push(p.time);
  if (p.duration) parts.push(p.duration % 60 === 0 ? `${p.duration / 60} 小時` : p.duration > 60 ? `${Math.floor(p.duration / 60)} 小時 ${p.duration % 60} 分` : `${p.duration} 分鐘`);
  if (p.priority) parts.push(`優先度${{ high: '高', medium: '中', low: '低' }[p.priority]}`);
  for (const t of p.tags) parts.push(`#${t}`);
  return parts;
}
