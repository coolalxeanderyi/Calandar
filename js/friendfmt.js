// 朋友資料的格式：生日怎麼存、「喜歡的東西」怎麼切。
// 計劃版和公開的生日表單（form.html）都用這一份，所以這裡不能 import 其他模組。

export const pad2 = (n) => String(n).padStart(2, '0');
export const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// 生日存成「2001-03-14」，不知道年份就是「--03-14」，沒填是「」
export function makeBirthday(month, day, year = 0) {
  const m = Number(month);
  const d = Number(day);
  if (!m || !d || m < 1 || m > 12 || d < 1 || d > DAYS_IN[m - 1]) return '';
  const y = Number(year);
  if (y) {
    if (y < 1900 || y > 2100) return '';
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    if (m === 2 && d === 29 && !leap) return '';
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }
  return `--${pad2(m)}-${pad2(d)}`;
}

export function splitBirthday(b) {
  const m = /^(?:(\d{4})-|--)(\d{2})-(\d{2})$/.exec(b || '');
  if (!m) return { year: 0, month: 0, day: 0 };
  return { year: m[1] ? Number(m[1]) : 0, month: Number(m[2]), day: Number(m[3]) };
}

// 是不是合法的生日（格式對，而且真的有這一天）
export function isBirthday(b) {
  const { year, month, day } = splitBirthday(b);
  return !!month && makeBirthday(month, day, year) === b;
}

// 「貓、抹茶, 周杰倫」→ ['貓', '抹茶', '周杰倫']
export function splitList(text) {
  const seen = new Set();
  const out = [];
  for (const raw of String(text || '').split(/[、,，;；/／\n]+/)) {
    const v = raw.trim().slice(0, 30);
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
    if (out.length >= 20) break;
  }
  return out;
}
