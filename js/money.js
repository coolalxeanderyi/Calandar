// 記帳簿：貨幣格式、分類、快速記帳（「午餐 8.5」「家教 +40」「昨天 超市 23.9 #日用品」）、每個月的加總
import { CURRENCIES, CURRENCY_IDS } from './model.js';
import { parseQuick } from './quickadd.js';

const CUR = Object.fromEntries(CURRENCIES.map(([id, symbol, name, digits]) => [id, { id, symbol, name, digits }]));
export const curInfo = (id) => CUR[id] || CUR.TWD;

// 預設分類。words 是快速記帳時拿來猜分類的字（自己新增的分類用名稱來猜）
export const DEFAULT_CATS = [
  { id: 'food', type: 'out', name: '飲食', emoji: '🍜', words: ['早餐', '午餐', '晚餐', '宵夜', '早午餐', '點心', '甜點', '咖啡', '拿鐵', '奶茶', '珍奶', '珍珠', '飲料', '手搖', '茶', '蛋糕', '麵包', '零食', '水果', '便當', '外送', '餐', '吃', '麵', '飯', '火鍋', '披薩', '漢堡', '麥當勞', '星巴克', 'coffee', 'lunch', 'dinner', 'breakfast', 'meal', 'pret', 'tesco meal'] },
  { id: 'transport', type: 'out', name: '交通', emoji: '🚇', words: ['公車', '捷運', '地鐵', '火車', '高鐵', '計程車', 'uber', 'bolt', '機票', '油錢', '加油', '停車', 'oyster', '車票', '交通', '巴士', 'bus', 'tube', 'train', 'taxi'] },
  { id: 'daily', type: 'out', name: '日用品', emoji: '🧴', words: ['衛生紙', '洗髮', '沐浴', '牙膏', '洗衣', '日用', '超市', '全聯', '家樂福', '雜貨', '生活用品', 'tesco', 'sainsbury', 'lidl', 'aldi', 'boots', '屈臣氏', '康是美'] },
  { id: 'shopping', type: 'out', name: '購物', emoji: '🛍️', words: ['衣服', '褲', '鞋', '包包', '網購', '蝦皮', 'momo', 'amazon', '購物', '買', 'uniqlo', 'primark', 'zara'] },
  { id: 'fun', type: 'out', name: '娛樂', emoji: '🎮', words: ['電影', '遊戲', '唱歌', 'ktv', 'netflix', 'spotify', 'disney', '演唱會', '門票', '展覽', '旅遊', '旅行', '酒吧', 'pub'] },
  { id: 'study', type: 'out', name: '學習', emoji: '📚', words: ['書', '課程', '學費', '文具', '教材', '考試', '報名費', 'ielts', '雅思'] },
  { id: 'home', type: 'out', name: '居住', emoji: '🏠', words: ['房租', '租金', '水費', '電費', '瓦斯', '網路費', '電話費', '手機費', '帳單', '管理費', 'rent', 'bill', 'council'] },
  { id: 'health', type: 'out', name: '醫療', emoji: '💊', words: ['藥', '看醫生', '掛號', '診所', '醫院', '牙醫', '健保', 'pharmacy'] },
  { id: 'gift', type: 'out', name: '送禮', emoji: '🎁', words: ['禮物', '送禮', '生日禮'] },
  { id: 'other', type: 'out', name: '其他', emoji: '📦', words: [] },
  { id: 'salary', type: 'in', name: '薪水', emoji: '💼', words: ['薪水', '薪資', '工資', '月薪', '打工', 'salary', 'wage'] },
  { id: 'tutor', type: 'in', name: '家教', emoji: '🧑‍🏫', words: ['家教', '上課費', 'tutor', 'lesson'] },
  { id: 'allowance', type: 'in', name: '零用錢', emoji: '🧧', words: ['零用錢', '生活費', '紅包'] },
  { id: 'other-in', type: 'in', name: '其他收入', emoji: '💰', words: ['收入', '退款', '獎學金', '中獎'] },
];
const WORDS = Object.fromEntries(DEFAULT_CATS.map((c) => [c.id, c.words]));
export const fallbackCat = (type) => (type === 'in' ? 'other-in' : 'other');

// 目前用的分類：自己改過就用自己的，沒改過用預設的；「其他」一定在（分類被刪掉的紀錄會算到這裡）
export function catsOf(settings = {}) {
  const base = settings.ledgerCats?.length ? settings.ledgerCats : DEFAULT_CATS.map(({ words, ...c }) => c);
  const list = base.slice();
  for (const type of ['out', 'in']) {
    if (!list.some((c) => c.id === fallbackCat(type))) {
      const def = DEFAULT_CATS.find((c) => c.id === fallbackCat(type));
      list.push({ id: def.id, type, name: def.name, emoji: def.emoji });
    }
  }
  return list;
}

export function catOf(entry, cats) {
  return cats.find((c) => c.id === entry.cat && c.type === entry.type) || cats.find((c) => c.id === fallbackCat(entry.type));
}

// ---- 貨幣 ----
const TZ_CURRENCY = {
  'Europe/London': 'GBP', 'Asia/Taipei': 'TWD', 'Asia/Hong_Kong': 'HKD', 'Asia/Macau': 'HKD', 'Asia/Tokyo': 'JPY',
  'Asia/Shanghai': 'CNY', 'Asia/Seoul': 'KRW', 'Asia/Singapore': 'SGD', 'Asia/Kuala_Lumpur': 'MYR',
};
export function guessCurrency(tz) {
  let zone = tz;
  if (zone === undefined) {
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch {
      zone = '';
    }
  }
  if (TZ_CURRENCY[zone]) return TZ_CURRENCY[zone];
  if (zone.startsWith('America/')) return zone === 'America/Toronto' || zone === 'America/Vancouver' ? 'CAD' : 'USD';
  if (zone.startsWith('Australia/')) return 'AUD';
  if (zone.startsWith('Europe/')) return 'EUR';
  return 'TWD';
}
// 記帳一律用新台幣（以前記成其他貨幣的也當成新台幣顯示）
export const LEDGER_CURRENCY = 'TWD';
export const currencyOf = () => LEDGER_CURRENCY;

// 新台幣：平常是整數，有小數時最多兩位（例如 NT$8.5）
const digitsOf = (cur) => (cur === 'TWD' ? [0, 2] : [curInfo(cur).digits, curInfo(cur).digits]);

export function roundMoney(n, cur = LEDGER_CURRENCY) {
  const f = 10 ** digitsOf(cur)[1];
  return Math.round(n * f) / f;
}

export function fmtMoney(n, cur = LEDGER_CURRENCY, { sign = false } = {}) {
  const c = curInfo(cur);
  const [min, max] = digitsOf(cur);
  const abs = Math.abs(n);
  const text = abs.toLocaleString('en-US', { minimumFractionDigits: min, maximumFractionDigits: max });
  const pre = n < 0 ? '−' : sign && n > 0 ? '+' : '';
  return `${pre}${c.symbol}${text}`;
}

// 使用者輸入的金額：「8.5」「1,200」「8,50」「£8.50」
export function readAmount(text) {
  let s = String(text || '').trim().replace(/[＋+\s]/g, '').replace(/^(NT\$|US\$|HK\$|A\$|C\$|S\$|CN¥|RM|[£$€¥₩])/i, '').replace(/(元|塊錢|塊|鎊)$/, '');
  s = s.replace(/[．。]/g, '.');
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ---- 快速記帳 ----
const SYMBOL_CUR = { 'NT$': 'TWD', 'US$': 'USD', 'HK$': 'HKD', 'A$': 'AUD', 'C$': 'CAD', 'S$': 'SGD', 'CN¥': 'CNY', RM: 'MYR', '£': 'GBP', '€': 'EUR', '₩': 'KRW', '¥': 'JPY', 鎊: 'GBP', 英鎊: 'GBP' };
// 金額：前面不是數字或日期符號，後面不是「點、號、月、/」之類的（那是時間或日期）
const AMOUNT_RE = /(^|[^\d.,/:：])([+＋-]?)\s*(NT\$|US\$|HK\$|A\$|C\$|S\$|CN¥|RM|[£$€¥₩])?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:[.．](\d{1,2}))?\s*(英鎊|塊錢|元|塊|鎊|圓|円)?(?![\d/:：點点時號号日月分])/gi;
const INCOME_HINT = /收到|收入|入帳|進帳|賺/;

function guessCat(text, type, cats) {
  const lower = text.toLowerCase();
  for (const c of cats) {
    if (type && c.type !== type) continue;
    const words = [...(WORDS[c.id] || []), c.name];
    if (words.some((w) => w && lower.includes(w.toLowerCase()))) return c;
  }
  return null;
}

// 回傳 { title, amount, type, cat, date, currency }；沒有金額時 amount 是 null
export function parseMoney(input, { today, weekStart = 1, cats = catsOf() } = {}) {
  const text = String(input || '');
  let last = null;
  for (const m of text.matchAll(AMOUNT_RE)) last = m;
  let amount = null;
  let sign = '';
  let currency = '';
  let rest = text;
  if (last) {
    const [all, lead, sg, sym, int, dec, unit] = last;
    amount = Number(int.replace(/,/g, '') + (dec ? `.${dec}` : ''));
    sign = sg === '＋' ? '+' : sg;
    currency = SYMBOL_CUR[sym === '$' ? '' : sym] || SYMBOL_CUR[unit] || '';
    const start = last.index + lead.length;
    rest = `${text.slice(0, start)} ${text.slice(last.index + all.length)}`;
  }
  const p = parseQuick(rest, { today, weekStart });
  // #分類：先找名稱一樣的分類（會順便決定是支出還是收入）
  let cat = null;
  for (const name of p.tags) {
    cat = cats.find((c) => c.name === name) || cat;
    if (cat) break;
  }
  const words = `${p.title} ${p.tags.join(' ')}`;
  let type;
  if (sign === '+') type = 'in';
  else if (sign === '-') type = 'out';
  else if (cat) type = cat.type;
  else if (INCOME_HINT.test(words)) type = 'in';
  else type = guessCat(words, 'in', cats) && !guessCat(words, 'out', cats) ? 'in' : 'out';
  if (!cat || cat.type !== type) cat = guessCat(words, type, cats) || cats.find((c) => c.id === fallbackCat(type));
  const title = p.title.replace(/^(收到|收入|入帳|進帳)\s*/, '').trim();
  return { title, amount, type, cat: cat.id, date: p.date || today, currency };
}

// ---- 加總 ----
// entries：某段時間的紀錄。用 cur 這個貨幣加總，其他貨幣另外列出來（不換算）
export function summarize(entries, cur, cats) {
  let out = 0;
  let inc = 0;
  const byCat = new Map();
  const others = new Map();
  for (const e of entries) {
    const c = e.currency || cur;
    if (c !== cur) {
      const o = others.get(c) || { out: 0, in: 0 };
      o[e.type] += e.amount;
      others.set(c, o);
      continue;
    }
    if (e.type === 'in') {
      inc += e.amount;
    } else {
      out += e.amount;
      const id = catOf(e, cats).id;
      byCat.set(id, (byCat.get(id) || 0) + e.amount);
    }
  }
  for (const [id, v] of byCat) byCat.set(id, roundMoney(v, cur));
  for (const o of others.values()) {
    o.out = Math.round(o.out * 100) / 100;
    o.in = Math.round(o.in * 100) / 100;
  }
  return { out: roundMoney(out, cur), in: roundMoney(inc, cur), net: roundMoney(inc - out, cur), byCat, others };
}

export function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const daysInMonth = (month) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

export const CURRENCY_LIST = CURRENCY_IDS.map((id) => CUR[id]);
