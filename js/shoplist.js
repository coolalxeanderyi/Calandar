// 購物清單：類別（跟記帳的類別分開），以及快速加入「牛奶 2瓶 #全聯」「雞蛋 12」「洗衣精 x2 120元」「優格（要無糖的）」

// 預設類別。words：看名稱猜類別用的字（自己新增的類別用名稱來猜）；ledger：買到了記帳時，對應到記帳簿的哪個類別
export const DEFAULT_SHOP_CATS = [
  { id: 'veg', name: '蔬果', emoji: '🥬', ledger: 'food', words: ['蔬菜', '青菜', '高麗菜', '菠菜', '生菜', '番茄', '洋蔥', '蔥', '蒜', '薑', '馬鈴薯', '紅蘿蔔', '胡蘿蔔', '菇', '豆芽', '地瓜', '玉米', '小黃瓜', '青椒', '茄子', '南瓜', '水果', '香蕉', '蘋果', '草莓', '葡萄', '檸檬', '橘子', '柳丁', '奇異果', '芭樂', '西瓜', '芒果', '酪梨', '藍莓', '沙拉'] },
  { id: 'meat', name: '肉類海鮮', emoji: '🥩', ledger: 'food', words: ['肉', '雞胸', '雞腿', '雞翅', '豬', '牛肉', '牛排', '羊', '絞肉', '魚', '鮭魚', '鯛魚', '蝦', '蟹', '花枝', '蛤', '海鮮', '培根', '火腿', '香腸', '熱狗'] },
  { id: 'dairy', name: '乳製品和蛋', emoji: '🥛', ledger: 'food', words: ['牛奶', '鮮奶', '奶粉', '優格', '優酪乳', '起司', '乳酪', '奶油', '鮮奶油', '雞蛋', '蛋', '豆漿'] },
  { id: 'grain', name: '麵包米麵', emoji: '🍞', ledger: 'food', words: ['麵包', '吐司', '貝果', '米', '麵', '義大利麵', '烏龍麵', '冬粉', '米粉', '燕麥', '麥片', '玉米片', '麵粉'] },
  { id: 'snack', name: '零食飲料', emoji: '🍪', ledger: 'food', words: ['零食', '洋芋片', '餅乾', '巧克力', '糖果', '軟糖', '堅果', '飲料', '可樂', '汽水', '果汁', '茶', '咖啡', '啤酒', '酒', '礦泉水', '氣泡水'] },
  { id: 'frozen', name: '冷凍食品', emoji: '🧊', ledger: 'food', words: ['冷凍', '冰淇淋', '冰棒', '水餃', '餃子', '鍋貼', '湯圓', '披薩'] },
  { id: 'season', name: '調味料', emoji: '🧂', ledger: 'food', words: ['鹽', '糖', '醬油', '醋', '沙拉油', '橄欖油', '麻油', '胡椒', '番茄醬', '美乃滋', '味噌', '咖哩', '醬', '調味'] },
  { id: 'household', name: '日用品', emoji: '🧻', ledger: 'daily', words: ['衛生紙', '面紙', '紙巾', '廚房紙巾', '垃圾袋', '保鮮膜', '鋁箔紙', '電池', '燈泡', '夾鏈袋', '衣架'] },
  { id: 'clean', name: '清潔用品', emoji: '🧽', ledger: 'daily', words: ['洗碗精', '洗衣精', '洗衣粉', '洗衣球', '柔軟精', '清潔劑', '漂白水', '菜瓜布', '海綿', '除臭', '芳香劑'] },
  { id: 'care', name: '個人護理', emoji: '🪥', ledger: 'daily', words: ['洗髮', '潤髮', '沐浴', '牙膏', '牙刷', '牙線', '洗面', '乳液', '面膜', '衛生棉', '刮鬍', '化妝', '卸妝', '防曬', '隱形眼鏡'] },
  { id: 'medicine', name: '藥品', emoji: '💊', ledger: 'health', words: ['藥', '維他命', '維生素', 'OK繃', '口罩', '感冒', '止痛', '酒精'] },
  { id: 'other', name: '其他', emoji: '📦', ledger: 'shopping', words: [] },
];
const SHOP_WORDS = Object.fromEntries(DEFAULT_SHOP_CATS.map((c) => [c.id, c.words]));

// 目前用的類別：自己改過就用自己的，沒改過用預設的；「其他」一定在
export function shopCatsOf(settings = {}) {
  const list = (settings.shopCats?.length ? settings.shopCats : DEFAULT_SHOP_CATS.map(({ words, ledger, ...c }) => c)).slice();
  if (!list.some((c) => c.id === 'other')) list.push({ id: 'other', name: '其他', emoji: '📦' });
  return list;
}

export const shopCatOf = (item, cats) => cats.find((c) => c.id === item.cat) || cats.find((c) => c.id === 'other');

// 看名稱猜類別：找到最長的那個關鍵字（「雞蛋」是蛋，不是雞肉；「番茄醬」是調味料，不是番茄）
export function guessShopCat(name, cats) {
  const text = String(name || '').toLowerCase();
  let best = null;
  let bestLen = 0;
  for (const c of cats) {
    for (const w of [...(SHOP_WORDS[c.id] || []), c.name]) {
      if (w && w.length > bestLen && text.includes(w.toLowerCase())) {
        best = c;
        bestLen = w.length;
      }
    }
  }
  return best;
}

// 買到了要記帳時，對應到記帳簿的哪個類別（預設類別有對應表，自己新增的用名稱猜）
export function ledgerCatFor(shopCat, ledgerCats, guess) {
  const def = DEFAULT_SHOP_CATS.find((c) => c.id === shopCat?.id);
  if (def && ledgerCats.some((c) => c.id === def.ledger && c.type === 'out')) return def.ledger;
  return guess(shopCat?.name || '') || (ledgerCats.some((c) => c.id === 'shopping' && c.type === 'out') ? 'shopping' : 'other');
}

// 回傳 { name, qty, store, price, note, cat }：#後面的字是類別名稱就當類別（cat 是類別 ID），不是的話當店家
const UNITS = '公斤|公克|公升|毫升|瓶|罐|盒|包|袋|個|顆|條|支|枝|片|件|雙|打|份|杯|張|本|組|箱|卷|捲|斤|克|入|串|根|粒|把|台|套|對|kg|ml|g|L';
const NUM = '\\d+(?:\\.\\d+)?|[一二兩两三四五六七八九十半]+';

export function parseShop(input, cats = shopCatsOf()) {
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
  // #類別、#店家（店家只取第一個）
  let cat = '';
  s = s.replace(/[#＃]([^\s#＃]{1,30})/g, (m, name) => {
    const c = cats.find((x) => x.name === name);
    if (c && !cat) cat = c.id;
    else if (!c && !store) store = name;
    return ' ';
  });
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
  return { name: s.replace(/\s+/g, ' ').trim(), qty, store, price, note: notes.join('，'), cat };
}
