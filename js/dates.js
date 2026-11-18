// 重要日子：倒數（一次性）、生日、紀念日（每年同一天）、正數（從那天開始算第幾天）
import { DATE_KINDS } from './model.js';

const KIND = Object.fromEntries(DATE_KINDS.map(([id, label, emoji]) => [id, { id, label, emoji }]));
export const kindOf = (id) => KIND[id] || KIND.countdown;
export const emojiOf = (d) => d.emoji || kindOf(d.kind).emoji;

const toDate = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};
const keyOf = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
export const daysBetween = (from, to) => Math.round((toDate(to) - toDate(from)) / 86400000);

// 每年同一天：今年還沒到就是今年，過了就是明年（2/29 在平年算 2/28）
export function nextYearly(key, today) {
  const [, m, d] = key.split('-').map(Number);
  const make = (year) => {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return keyOf(new Date(year, m - 1, m === 2 && d === 29 && !leap ? 28 : d, 12));
  };
  const year = Number(today.slice(0, 4));
  const thisYear = make(year);
  return thisYear >= today ? thisYear : make(year + 1);
}

// 回傳 { target（下一次的日期）, days（離今天幾天，負的是已經過了）, big（大字）, unit, small（小字）, soon, isToday, past }
export function dateInfo(d, today) {
  if (!d.date) return null;
  if (d.kind === 'since' && d.date <= today) {
    const n = daysBetween(d.date, today) + 1;
    return { target: d.date, days: 0, big: String(n), unit: '天', small: `第 ${n} 天`, soon: false, isToday: n === 1, past: false, counting: true };
  }
  if (d.kind === 'birthday' || d.kind === 'anniversary') {
    const target = nextYearly(d.date, today);
    const days = daysBetween(today, target);
    const years = Number(target.slice(0, 4)) - Number(d.date.slice(0, 4));
    let extra = '';
    if (years > 0 && d.kind === 'birthday' && d.showAge) extra = `${years} 歲`;
    if (years > 0 && d.kind === 'anniversary') extra = `${years} 週年`;
    return { target, days, big: days === 0 ? '今天' : String(days), unit: days === 0 ? '' : '天', small: extra, soon: days <= 7, isToday: days === 0, past: false };
  }
  // 倒數（正數的日子還沒到時，也是倒數）
  const days = daysBetween(today, d.date);
  if (days < 0) return { target: d.date, days, big: String(-days), unit: '天前', small: '已經過了', soon: false, isToday: false, past: true };
  return { target: d.date, days, big: days === 0 ? '今天' : String(days), unit: days === 0 ? '' : '天', small: d.kind === 'since' ? '還沒開始' : '', soon: days <= 7, isToday: days === 0, past: false };
}

// 排序：今天的最前面，再來是快到的；正數的接在後面；已經過了的倒數放最後
export function sortDates(list, today) {
  const rank = (d, info) => {
    if (!info) return [3, 0];
    if (info.isToday) return [0, 0];
    if (info.past) return [3, -info.days];
    if (info.counting) return [2, -Number(info.big)];
    return [1, info.days];
  };
  return list
    .map((d) => ({ d, info: dateInfo(d, today) }))
    .sort((a, b) => {
      const ra = rank(a.d, a.info);
      const rb = rank(b.d, b.info);
      return ra[0] - rb[0] || ra[1] - rb[1] || a.d.title.localeCompare(b.d.title, 'zh-Hant');
    });
}

// 今天是重要日子的話，小日曆會說一句
export function todayLine(d, info) {
  if (!info?.isToday) return '';
  if (d.kind === 'birthday') return `今天是${d.title}${d.title.endsWith('生日') ? '' : '生日'}！${info.small ? `（${info.small}）` : ''}`;
  if (d.kind === 'anniversary') return `今天是「${d.title}」${info.small ? `${info.small}` : ''}！`;
  if (d.kind === 'since') return `「${d.title}」今天開始！`;
  return `就是今天：「${d.title}」！`;
}
