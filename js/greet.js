// 總覽小日曆泡泡裡的問候：「早安，名字！」再加一句依時間隨機挑的話
// 早上 5 點到中午：早安；中午到傍晚 6 點：午安；其他時間：晚安
const PERIODS = {
  morning: { word: '早安', emoji: '☀️', lines: ['祝你有美好的一天', '早餐吃了嗎？', '今天也一起加油', '睡得好嗎？', '先喝杯水再開始吧', '新的一天開始囉', '今天也會是很棒的一天'] },
  noon: { word: '午安', emoji: '🌤️', lines: ['吃飯了嗎？', '午餐吃了嗎？', '下午也要加油喔', '累了就伸個懶腰', '記得多喝水', '來杯咖啡提提神？', '休息一下也沒關係'] },
  evening: { word: '晚安', emoji: '🌙', lines: ['晚餐吃了嗎？', '今天辛苦了', '好好休息', '洗個熱水澡放鬆一下', '今天過得怎麼樣？', '做完的事都很棒', '明天的事明天再說'] },
  night: { word: '晚安', emoji: '🌙', lines: ['還沒睡嗎？', '早點休息喔', '別熬夜太晚', '好好休息，明天見', '睡前放下手機吧'] },
};

export function periodOf(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'noon';
  if (h >= 18) return 'evening';
  return 'night';
}

export const greetLines = (period) => PERIODS[period].lines;

// 同一次看總覽時這句話不變（不會每按一下就換）；換頁回來或時段變了才重新挑
let pick = { period: '', line: '' };
let wantFresh = true;
export function newGreeting() {
  wantFresh = true;
}

export function greetFor(name, date = new Date()) {
  const period = periodOf(date);
  const p = PERIODS[period];
  if (wantFresh || pick.period !== period) {
    let line = p.lines[Math.floor(Math.random() * p.lines.length)];
    if (line === pick.line && p.lines.length > 1) line = p.lines[(p.lines.indexOf(line) + 1) % p.lines.length];
    pick = { period, line };
    wantFresh = false;
  }
  return { emoji: p.emoji, word: p.word, line: pick.line, text: `${p.word}，${name || '用戶'}！${pick.line}` };
}
