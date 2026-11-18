// 回顧頁：這個月的心情起伏，對照每週完成了幾件事、花了多少錢
import { esc, addDays, toKey, weekStartKey, weekKeys, fmtMonthDay, WEEKDAYS, weekdayOf } from './utils.js';
import { isDone, expandTasks, MOODS } from './model.js';
import { fmtMoney, currencyOf, daysInMonth } from './money.js';

const MOOD = new Map(MOODS.map(([v, emoji, label]) => [v, { emoji, label }]));
const pad2 = (n) => String(n).padStart(2, '0');
const short = (key) => `${Number(key.slice(5, 7))}/${Number(key.slice(8))}`;

// 一週以「中間那天」所在的月份為準（跨月的那週算在天數比較多的那個月）
export const monthOfWeek = (firstKey) => addDays(firstKey, 3).slice(0, 7);

export function moodMonthData(state, { month, weekStart = 1, today }) {
  const n = daysInMonth(month);
  const first = `${month}-01`;
  const last = `${month}-${pad2(n)}`;
  const from = weekStartKey(first, weekStart);
  const to = addDays(weekStartKey(last, weekStart), 6);
  const cur = currencyOf();

  // 完成的任務：照回顧頁的算法（有日期的看排在哪天，沒日期的看哪天完成）
  const done = new Map();
  const push = (key, title) => {
    if (!done.has(key)) done.set(key, []);
    done.get(key).push(title);
  };
  for (const t of expandTasks(state.tasks, from, to)) if (isDone(t)) push(t.date, t.title);
  for (const t of state.tasks) {
    if (t.date || !isDone(t) || !t.doneAt) continue;
    const k = toKey(new Date(t.doneAt));
    if (k >= from && k <= to) push(k, t.title);
  }
  // 每天的支出（只算新台幣）
  const spend = new Map();
  for (const e of state.ledger || []) {
    if (e.type !== 'out' || (e.currency || cur) !== cur || e.date < from || e.date > to) continue;
    spend.set(e.date, (spend.get(e.date) || 0) + e.amount);
  }
  const journal = new Map((state.journal || []).map((j) => [j.id, j]));
  const dayInfo = (key) => {
    const j = journal.get(key);
    return {
      key,
      mood: j?.mood || 0,
      text: j?.text || '',
      done: done.get(key) || [],
      spend: Math.round((spend.get(key) || 0) * 100) / 100,
      future: key > today,
    };
  };

  const days = [];
  for (let d = 1; d <= n; d++) days.push({ d, ...dayInfo(`${month}-${pad2(d)}`) });

  const weeks = [];
  for (let w = from; w <= last; w = addDays(w, 7)) {
    const keys = weekKeys(w, weekStart);
    const info = keys.map(dayInfo);
    const moods = info.filter((x) => x.mood);
    const inMonth = keys.filter((k) => k >= first && k <= last);
    weeks.push({
      first: keys[0],
      last: keys[6],
      fromDay: Number(inMonth[0].slice(8)),
      toDay: Number(inMonth[inMonth.length - 1].slice(8)),
      avg: moods.length ? Math.round((moods.reduce((s, x) => s + x.mood, 0) / moods.length) * 10) / 10 : null,
      moodDays: moods.length,
      done: info.reduce((s, x) => s + x.done.length, 0),
      spend: Math.round(info.reduce((s, x) => s + x.spend, 0) * 100) / 100,
      future: keys[0] > today,
    });
  }
  return { month, n, days, weeks, recorded: days.filter((x) => x.mood).length };
}

// 線：相鄰兩天都有記心情才連起來，中間沒記的地方斷開
function linePath(days) {
  let d = '';
  let prev = null;
  for (const x of days) {
    if (!x.mood) {
      prev = null;
      continue;
    }
    const px = x.d - 0.5;
    const py = 5 - x.mood;
    d += `${prev && prev.d === x.d - 1 ? 'L' : 'M'}${px} ${py}`;
    prev = x;
  }
  return d;
}

const moodFace = (v) => {
  const m = MOOD.get(Math.round(v));
  return m ? m.emoji : '';
};

export function dayTip(x) {
  const date = `${fmtMonthDay(x.key)}（${WEEKDAYS[weekdayOf(x.key)]}）`;
  if (x.future) return { date, lines: ['還沒到'] };
  const m = MOOD.get(x.mood);
  const lines = [m ? `${m.emoji} ${m.label}${x.text ? `：${x.text}` : ''}` : x.text ? `沒記心情：${x.text}` : '沒記心情'];
  if (x.done.length) {
    const names = x.done.slice(0, 3).join('、');
    lines.push(`完成 ${x.done.length} 件：${names}${x.done.length > 3 ? ' 等' : ''}`);
  } else {
    lines.push('沒有完成的任務');
  }
  lines.push(x.spend ? `花了 ${fmtMoney(x.spend)}` : '沒有支出');
  return { date, lines };
}

export function moodChart(data, { selFirst, today }) {
  const { n, days, weeks } = data;
  const [, mm] = data.month.split('-').map(Number);
  const cur = currencyOf();
  const sel = weeks.find((w) => w.first === selFirst);
  const bands = weeks.map((w, i) => `<span class="mc-band${i % 2 ? ' is-alt' : ''}${w === sel ? ' is-current' : ''}" style="--from:${w.fromDay};--to:${w.toDay}"></span>`).join('');
  // 鍵盤：整張圖只佔一個 Tab 位置（今天，或這個月的最後一天），用左右鍵換日子
  const focusKey = days.some((x) => x.key === today) ? today : days[days.length - 1].key;
  const cols = days.map((x) => {
    const tip = dayTip(x);
    const label = `${tip.date}，${tip.lines.join('，')}`;
    return `<button type="button" class="mc-day${x.future ? ' is-future' : ''}${x.key === today ? ' is-today' : ''}" data-mc-day="${x.key}" tabindex="${x.key === focusKey ? 0 : -1}" aria-label="${esc(label)}" style="--d:${x.d}">${x.mood ? `<i class="mc-dot" style="--v:${x.mood}"></i>` : ''}</button>`;
  }).join('');
  // 橫軸：1 號、每週第一天、今天。太靠近（只差一天）的話只留一個，今天優先
  const todayDay = today.slice(0, 7) === data.month ? Number(today.slice(8)) : 0;
  const kept = [];
  for (const d of [...new Set([1, ...weeks.map((w) => w.fromDay), ...(todayDay ? [todayDay] : [])])].sort((a, b) => a - b)) {
    const prev = kept[kept.length - 1];
    if (prev && d - prev < 2) {
      if (d === todayDay) kept[kept.length - 1] = d;
      continue;
    }
    kept.push(d);
  }
  const xLabels = kept.map((d) => `<span class="${d === todayDay ? 'is-today' : ''}" style="--d:${d}">${d}</span>`).join('');
  const maxSpend = Math.max(0, ...weeks.map((w) => w.spend));
  const rows = weeks.map((w) => {
    const pct = w.spend > 0 ? Math.max(3, Math.round((w.spend / maxSpend) * 100)) : 0;
    return `<tr class="${w === sel ? 'is-current' : ''}${w.future ? ' is-future' : ''}">
      <th scope="row">${short(w.first)}–${short(w.last)}${w === sel ? '<span class="mc-now">這週</span>' : ''}</th>
      <td>${w.avg === null ? '<span class="mc-none">沒記</span>' : `<span class="mc-face" aria-hidden="true">${moodFace(w.avg)}</span>${w.avg}`}</td>
      <td>${w.done} 件</td>
      <td class="mc-spend"><span class="mc-spend-val">${fmtMoney(w.spend, cur)}</span>${pct ? `<span class="mc-spend-bar" aria-hidden="true" style="width:${pct}%"></span>` : ''}</td>
    </tr>`;
  }).join('');
  return `<div class="mood-chart">
      <div class="mc-frame" style="--days:${n}">
        <div class="mc-y" aria-hidden="true">${[5, 4, 3, 2, 1].map((v) => `<span style="--v:${v}" title="${MOOD.get(v).label}">${MOOD.get(v).emoji}</span>`).join('')}</div>
        <div class="mc-plot" data-mc-plot>
          <div class="mc-bands" aria-hidden="true">${bands}</div>
          <div class="mc-grid" aria-hidden="true">${[5, 4, 3, 2, 1].map((v) => `<i style="--v:${v}"></i>`).join('')}</div>
          <svg class="mc-line" viewBox="0 0 ${n} 4" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="${linePath(days)}" vector-effect="non-scaling-stroke"/></svg>
          <div class="mc-days" role="group" aria-label="${mm}月每天的心情（點一下看那天做了什麼）">${cols}</div>
          <div class="mc-tip" data-mc-tip hidden></div>
        </div>
        <div class="mc-x" aria-hidden="true">${xLabels}</div>
      </div>
      ${data.recorded ? '' : '<p class="hint mc-empty">這個月還沒有記心情。在總覽點今天的心情，這裡就會畫出起伏。</p>'}
      <div class="mc-table-wrap"><table class="mc-table">
        <caption class="sr-only">${mm}月每週的心情、完成的任務和花費</caption>
        <thead><tr><th scope="col">那一週</th><th scope="col">平均心情</th><th scope="col">完成</th><th scope="col">花費</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;
}

// 滑鼠移到某一天、或用手指點一下：顯示那天的心情、做了什麼、花了多少
let wired = false;
let pinned = null;
let lastData = null;

export function rememberMoodData(data) {
  lastData = data;
  pinned = null;
}

function showTip(btn) {
  const plot = btn.closest('[data-mc-plot]');
  const tip = plot?.querySelector('[data-mc-tip]');
  const x = lastData?.days.find((d) => d.key === btn.dataset.mcDay);
  if (!tip || !x) return;
  const t = dayTip(x);
  tip.innerHTML = `<b>${esc(t.date)}</b>${t.lines.map((l) => `<span>${esc(l)}</span>`).join('')}`;
  tip.hidden = false;
  for (const b of plot.querySelectorAll('.mc-day.is-hover')) b.classList.remove('is-hover');
  btn.classList.add('is-hover');
  // 放在那一天的旁邊，不要超出圖表
  const box = plot.getBoundingClientRect();
  const r = btn.getBoundingClientRect();
  const w = tip.offsetWidth;
  const center = r.left + r.width / 2 - box.left;
  const left = Math.min(Math.max(center - w / 2, 0), box.width - w);
  tip.style.left = `${Math.round(left)}px`;
}

function hideTip(plot) {
  const tip = plot?.querySelector('[data-mc-tip]');
  if (tip) tip.hidden = true;
  for (const b of plot?.querySelectorAll('.mc-day.is-hover') || []) b.classList.remove('is-hover');
}

export function wireMoodChart() {
  if (wired) return;
  wired = true;
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const btn = e.target.closest?.('.mc-day');
    if (btn) showTip(btn);
  });
  document.addEventListener('pointerout', (e) => {
    if (e.pointerType === 'touch') return;
    const btn = e.target.closest?.('.mc-day');
    if (!btn || e.relatedTarget?.closest?.('.mc-day')) return;
    if (pinned && pinned.isConnected) {
      showTip(pinned);
      return;
    }
    hideTip(btn.closest('[data-mc-plot]'));
  });
  document.addEventListener('focusin', (e) => {
    const btn = e.target.closest?.('.mc-day');
    if (btn) showTip(btn);
  });
  document.addEventListener('focusout', (e) => {
    const btn = e.target.closest?.('.mc-day');
    if (btn && !e.relatedTarget?.closest?.('.mc-day')) hideTip(btn.closest('[data-mc-plot]'));
  });
  document.addEventListener('click', (e) => {
    const btn = e.target.closest?.('.mc-day');
    if (btn) {
      pinned = pinned === btn ? null : btn;
      if (pinned) showTip(btn);
      else hideTip(btn.closest('[data-mc-plot]'));
      return;
    }
    if (pinned && !e.target.closest?.('[data-mc-tip]')) {
      hideTip(pinned.closest('[data-mc-plot]'));
      pinned = null;
    }
  });
  document.addEventListener('keydown', (e) => {
    const btn = document.activeElement?.closest?.('.mc-day');
    if (!btn) return;
    if (e.key === 'Escape') {
      hideTip(btn.closest('[data-mc-plot]'));
      return;
    }
    const all = [...btn.parentElement.querySelectorAll('.mc-day')];
    const i = all.indexOf(btn);
    const next = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: all.length - 1 }[e.key];
    if (next === undefined || !all[next]) return;
    e.preventDefault();
    btn.tabIndex = -1;
    all[next].tabIndex = 0;
    all[next].focus();
  });
}
