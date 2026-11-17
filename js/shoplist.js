// 購物清單的快速加入：「牛奶 2瓶 #全聯」「雞蛋 12」「洗衣精 x2 120元」「優格（要無糖的）」
// 回傳 { name, qty, store, price, note }
const UNITS = '公斤|公克|公升|毫升|瓶|罐|盒|包|袋|個|顆|條|支|枝|片|件|雙|打|份|杯|張|本|組|箱|卷|捲|斤|克|入|串|根|粒|把|台|套|對|kg|ml|g|L';
const NUM = '\\d+(?:\\.\\d+)?|[一二兩两三四五六七八九十半]+';

export function parseShop(input) {
  let s = ` ${String(input || '')} `;
  let store = '';
  let price = null;
  let qty = '';
  // 括號裡的字是備註：「優格（要無糖的）」
  const notes = [];
  s = s.replace(/[（(]([^（）()]*)[）)]/g, (m, text) => {
    if (text.trim()) notes.push(text.trim());
    return ' ';
  });
  // #店家（只取第一個）
  s = s.replace(/[#＃]([^\s#＃]{1,30})/, (m, name) => {
    store = name;
    return ' ';
  });
  s = s.replace(/[#＃]\S*/g, ' ');
  // 價錢：£3.5、$3、NT$120、120元、@3.5
  const toNum = (v) => Number(v.replace('．', '.'));
  s = s.replace(/(?:NT\$|US\$|HK\$|[£$€¥₩@＠])\s*(\d+(?:[.．]\d{1,2})?)|(\d+(?:[.．]\d{1,2})?)\s*(?:元|塊錢|塊|鎊)/, (m, a, b) => {
    price = toNum(a || b);
    return ' ';
  });
  // 數量：x2、×2、2x
  s = s.replace(/(^|\s)(?:[x×X*＊]\s*(\d{1,3})|(\d{1,3})\s*[x×X*＊])(?=\s)/, (m, lead, a, b) => {
    qty = `×${a || b}`;
    return lead;
  });
  // 數量：2瓶、兩盒、半打、1.5公斤
  if (!qty) {
    s = s.replace(new RegExp(`(${NUM})\\s*(${UNITS})`), (m, n, unit) => {
      qty = `${n}${unit}`;
      return ' ';
    });
  }
  // 最後面單獨的數字：有小數點的是價錢，整數是數量
  if (price === null) {
    s = s.replace(/\s(\d+[.．]\d{1,2})\s*$/, (m, n) => {
      price = toNum(n);
      return ' ';
    });
  }
  if (!qty) {
    s = s.replace(/\s(\d{1,2})\s*$/, (m, n) => {
      qty = `×${n}`;
      return ' ';
    });
  }
  return { name: s.replace(/\s+/g, ' ').trim(), qty, store, price, note: notes.join('，') };
}
