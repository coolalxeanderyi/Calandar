// 朋友：生日、喜歡的東西。這裡只有計算，畫面在 views/friends.js
import { nextYearly, daysBetween } from './dates.js';
import { pad2, makeBirthday, splitBirthday, splitList } from './friendfmt.js';

export { makeBirthday, splitBirthday, splitList, isBirthday } from './friendfmt.js';

export const DEFAULT_GROUPS = ['朋友', '家人', '同學', '同事', '學生'];
export const SOON_DAYS = 30; // 「快到了」：30 天內
export const STRIP_DAYS = 14; // 總覽的重要日子：14 天內的朋友生日也放上去

// 字串裡找生日：3/14、3-14、3月14日、3月14號、2001/3/14、2001-03-14、2001年3月14日
const DATE_RE = /(?:^|\s)(?:(\d{4})\s*[/.\-年]\s*)?(\d{1,2})\s*[/.\-月]\s*(\d{1,2})\s*[日號号]?(?=\s|$)/;

export function findBirthday(text) {
  const m = DATE_RE.exec(text);
  if (!m) return null;
  const birthday = makeBirthday(m[2], m[3], m[1] || 0);
  return birthday ? { birthday, match: m[0] } : null;
}

// 快速新增：「小美 3/14 #同學 喜歡貓、抹茶」
export function parseFriend(input) {
  let text = String(input || '').trim();
  let likes = [];
  const like = /\s*喜歡\s*[:：]?\s*(.+)$/.exec(text);
  if (like) {
    likes = splitList(like[1]);
    text = text.slice(0, like.index);
  }
  let group = '';
  text = text.replace(/[#＃](\S+)/, (_, g) => {
    group = g.slice(0, 20);
    return ' ';
  });
  const b = findBirthday(text);
  if (b) text = text.replace(b.match, ' ');
  const name = text.replace(/\s+/g, ' ').trim().slice(0, 30);
  return { name, birthday: b?.birthday || '', group, likes };
}

// 下一次生日：{ target, days, age（知道年份才有）, isToday, soon }
export function birthdayInfo(friend, today) {
  const { year, month, day } = splitBirthday(friend.birthday);
  if (!month) return null;
  const target = nextYearly(`2000-${pad2(month)}-${pad2(day)}`, today);
  const days = daysBetween(today, target);
  const age = year ? Number(target.slice(0, 4)) - year : 0;
  return { target, days, age: age > 0 ? age : 0, isToday: days === 0, soon: days <= SOON_DAYS };
}

// 照下一次生日排；沒填生日的放最後（照名字）
export function sortFriends(list, today) {
  return list
    .map((f) => ({ f, info: birthdayInfo(f, today) }))
    .sort((a, b) => {
      if (!a.info !== !b.info) return a.info ? -1 : 1;
      if (a.info && b.info && a.info.days !== b.info.days) return a.info.days - b.info.days;
      return a.f.name.localeCompare(b.f.name, 'zh-Hant');
    });
}

// 找朋友：名字、關係、喜歡的東西、不喜歡的、備註都找得到
export function matchFriend(f, q) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [f.name, f.group, f.note, ...(f.likes || []), ...(f.dislikes || [])].some((v) => String(v || '').toLowerCase().includes(s));
}

// 頭像顏色：同一個名字永遠同一個顏色
const AVATAR_COLORS = ['blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red'];
export function avatarColor(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
export const initialOf = (name) => [...String(name).trim()][0] || '？';

// 重要日子裡已經有同一個人的生日（同一天、名稱裡有他的名字）：就不重複提醒
export function sameAsDate(friend, dates) {
  const { month, day } = splitBirthday(friend.birthday);
  if (!month) return false;
  const md = `${pad2(month)}-${pad2(day)}`;
  return (dates || []).some((d) => d.kind === 'birthday' && d.date && d.date.slice(5) === md && d.title.includes(friend.name));
}

// 放進 Google 日曆的那天（不知道年份就從 2000 年開始每年重複）
export function birthdayStart(friend) {
  const { year, month, day } = splitBirthday(friend.birthday);
  if (!month) return '';
  return `${year || 2000}-${pad2(month)}-${pad2(day)}`;
}

// 小日曆、Google 日曆的說明會用到：「喜歡：貓、抹茶」
export function likesText(f, max = 4) {
  const likes = (f.likes || []).slice(0, max);
  return likes.length ? `喜歡：${likes.join('、')}${(f.likes || []).length > max ? ' 等' : ''}` : '';
}
