// 總覽小日曆泡泡裡的問候：「早安，名字！」再加一句依時間挑的話
// 早上 5 點到中午：早安；中午到傍晚 6 點：午安；晚上：晚安；半夜：晚安（勸你去睡）
// 每個時段的句子洗牌後一句一句出，全部出完才重新洗，所以每次打開看到的都不一樣
const ANYTIME = [
  '你今天也很棒',
  '慢慢來沒關係',
  '記得對自己好一點',
  '有我幫你記著，放心',
  '累了就休息，不用勉強',
  '今天也要開開心心的',
  '要做的事都在這裡，不怕忘記',
];

const PERIODS = {
  morning: {
    word: '早安',
    emoji: '☀️',
    lines: [
      '祝你有美好的一天', '早餐吃了嗎？', '今天也一起加油', '睡得好嗎？', '先喝杯水再開始吧',
      '新的一天開始囉', '今天也會是很棒的一天', '起床辛苦了', '伸個懶腰，準備出發', '今天想先完成哪件事？',
      '早起的你超厲害', '今天天氣怎麼樣？', '記得吃早餐喔', '慢慢醒來就好，不用急', '今天也要對自己好一點',
      '先做一件小事暖暖身', '帶著好心情出門吧', '今天會有好事發生的', '深呼吸，今天也沒問題', '喝咖啡還是喝茶？',
      '今天的你也很可以', '一步一步來就好', '出門前記得帶鑰匙', '打開窗戶透透氣吧', '先看看今天有哪些事吧',
    ],
  },
  noon: {
    word: '午安',
    emoji: '🌤️',
    lines: [
      '吃飯了嗎？', '午餐吃了嗎？', '下午也要加油喔', '累了就伸個懶腰', '記得多喝水',
      '來杯咖啡提提神？', '休息一下也沒關係', '午餐吃了什麼好料？', '吃飽才有力氣做事', '下午茶時間到了嗎？',
      '眼睛累了就看看遠方', '站起來走一走吧', '今天過一半了，你做得很好', '剩下的慢慢來', '有點睏就閉眼休息五分鐘',
      '別忘了吃點水果', '小小進度也是進度', '偷偷休息一下也可以', '給自己一點小獎勵吧', '午後的陽光很舒服',
      '肩膀放鬆一下', '再撐一下就下班下課了', '待辦清單還順利嗎？', '喝口水，繼續衝', '你比自己想的還厲害',
    ],
  },
  evening: {
    word: '晚安',
    emoji: '🌙',
    lines: [
      '晚餐吃了嗎？', '今天辛苦了', '好好休息', '洗個熱水澡放鬆一下', '今天過得怎麼樣？',
      '做完的事都很棒', '明天的事明天再說', '晚上就放慢腳步吧', '今天也努力了一整天', '給今天的自己拍拍手',
      '晚餐想吃什麼？', '追劇時間到了嗎？', '記得跟家人聊聊天', '沒做完的也沒關係', '今天有什麼開心的事嗎？',
      '喝杯熱的暖暖身子', '先把明天要帶的東西準備好', '放點喜歡的音樂吧', '今晚好好犒賞自己', '今天的你已經很棒了',
      '放下手機讓眼睛休息一下', '寫下今天的一句話吧', '今天花了多少？記一下帳吧', '看一下明天的行程吧', '伸展一下再休息',
    ],
  },
  night: {
    word: '晚安',
    emoji: '🌙',
    lines: [
      '還沒睡嗎？', '早點休息喔', '別熬夜太晚', '好好休息，明天見', '睡前放下手機吧',
      '夜深了，讓腦袋也下班吧', '今天就到這裡吧', '睡飽了明天才有精神', '熬夜的你辛苦了', '喝杯溫水準備睡覺',
      '把煩惱留給明天', '星星都睡了喔', '做個好夢', '關燈、躺平、休息', '你值得好好睡一覺',
      '明天的你會感謝早睡的你', '再看一下就去睡吧？', '待辦都記好了，安心睡吧', '今天的事都辛苦了', '睡前深呼吸三次',
    ],
  },
};

export function periodOf(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'noon';
  if (h >= 18) return 'evening';
  return 'night';
}

// 這個時段可能出現的所有句子
export const greetLines = (period) => [...PERIODS[period].lines, ...ANYTIME];

// ---- 洗牌袋：記在這台裝置的瀏覽器裡（不同裝置各自記） ----
const BAG_KEY = 'planner.greet';
function readBag() {
  try {
    const data = JSON.parse(localStorage.getItem(BAG_KEY));
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}
function writeBag(data) {
  try {
    localStorage.setItem(BAG_KEY, JSON.stringify(data));
  } catch { /* 無痕模式存不了也沒關係 */ }
}
function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 從這個時段的袋子拿下一句；袋子空了就重新洗（新的一輪第一句不會跟上一次看到的一樣）
function nextLine(period) {
  const lines = greetLines(period);
  const data = readBag();
  let queue = Array.isArray(data[period]) ? data[period].filter((t) => lines.includes(t)) : [];
  if (!queue.length) {
    queue = shuffle(lines);
    if (queue[0] === data.last && queue.length > 1) [queue[0], queue[1]] = [queue[1], queue[0]];
  }
  const line = queue.shift();
  data[period] = queue;
  data.last = line;
  writeBag(data);
  return line;
}

// 同一次看總覽時這句話不變（不會每按一下就換）；重新打開、換頁回來、時段變了才換下一句
let pick = { period: '', line: '' };
let wantFresh = true;
export function newGreeting() {
  wantFresh = true;
}

export function greetFor(name, date = new Date()) {
  const period = periodOf(date);
  const p = PERIODS[period];
  if (wantFresh || pick.period !== period || !pick.line) {
    pick = { period, line: nextLine(period) };
    wantFresh = false;
  }
  return { emoji: p.emoji, word: p.word, line: pick.line, text: `${p.word}，${name || '用戶'}！${pick.line}` };
}
