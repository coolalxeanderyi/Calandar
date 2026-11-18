// 每週回顧：這週完成了什麼、還有什麼沒做、習慣做得怎樣，再寫下心得和下週的重點
import { esc, todayKey, weekStartKey, weekKeys, fmtMonthDay, addDays, toKey, WEEKDAYS, weekdayOf } from '../utils.js';
import { icon, toast } from '../ui.js';
import { store } from '../store.js';
import { isDone, expandTasks, activeHabits, isScheduled, isChecked, habitStart, MOODS } from '../model.js';
import { taskList, emptyState, goalsMap } from '../components.js';
import { tagMap, tagVar } from '../tags.js';
import { moodMonthData, moodChart, monthOfWeek, wireMoodChart, rememberMoodData } from '../moodchart.js';

const ui = { week: '' };

export function fmtMinutes(min) {
  if (min < 60) return `${min} 分鐘`;
  const h = Math.round((min / 60) * 10) / 10;
  return `${h} 小時`;
}

// 這週排進時間軸的任務，依標籤加總時間（一個任務有兩個標籤時兩邊都算）
export function timeByTag(occ, tagsById) {
  const rows = new Map();
  let total = 0;
  let totalDone = 0;
  for (const t of occ) {
    if (!t.time) continue;
    const min = t.duration || 60;
    const done = isDone(t);
    total += min;
    if (done) totalDone += min;
    const ids = t.tags.filter((id) => tagsById.has(id));
    for (const id of ids.length ? ids : ['']) {
      const row = rows.get(id) || { id, min: 0, done: 0, count: 0 };
      row.min += min;
      if (done) row.done += min;
      row.count += 1;
      rows.set(id, row);
    }
  }
  const list = [...rows.values()].sort((a, b) => b.min - a.min || (a.id === '' ? 1 : b.id === '' ? -1 : 0));
  return { list, total, totalDone };
}

function timeSection(occ) {
  const tagsById = tagMap();
  const { list, total, totalDone } = timeByTag(occ, tagsById);
  if (!total) {
    return emptyState('這週還沒有排時間的任務。在任務裡設定時間，這裡就會算出時間花在哪些標籤。');
  }
  const max = Math.max(...list.map((r) => r.min));
  const MAX_ROWS = 8;
  const shown = list.slice(0, MAX_ROWS);
  const rest = list.slice(MAX_ROWS);
  if (rest.length) {
    shown.push(rest.reduce((o, r) => ({ ...o, min: o.min + r.min, done: o.done + r.done, count: o.count + r.count }), { id: '*', min: 0, done: 0, count: 0 }));
  }
  const rows = shown.map((r) => {
    const tag = tagsById.get(r.id);
    const name = tag ? tag.name : r.id === '*' ? `其他 ${rest.length} 個標籤` : '沒有標籤';
    const color = tag ? tagVar(tag.color) : 'var(--bar-neutral)';
    const pct = Math.max(2, Math.round((r.min / max) * 100));
    const tip = `${name}：${fmtMinutes(r.min)}，完成 ${fmtMinutes(r.done)}，${r.count} 個任務`;
    return `<li class="time-row" title="${esc(tip)}">
      <span class="time-name"><i class="tag-dot" style="--tc:${color}" aria-hidden="true"></i>${esc(name)}</span>
      <span class="time-track" aria-hidden="true"><span class="time-bar" style="width:${pct}%;--tc:${color}"></span></span>
      <span class="time-val">${fmtMinutes(r.min)}<span class="time-sub">${!r.done ? '還沒完成' : r.done === r.min ? '全部完成' : `完成 ${fmtMinutes(r.done)}`}</span></span>
    </li>`;
  }).join('');
  return `<p class="time-total">這週排了 <strong>${fmtMinutes(total)}</strong>${totalDone ? `，完成 ${fmtMinutes(totalDone)}` : ''}</p>
    <ul class="time-bars" aria-label="依標籤的時間">${rows}</ul>
    <p class="hint">只算有設定時間的任務。一個任務有兩個標籤時，兩邊都會算進去。</p>`;
}

function journalSection(keys, today, journal) {
  const byDay = new Map(journal.map((j) => [j.id, j]));
  const any = keys.some((k) => byDay.get(k)?.mood || byDay.get(k)?.text);
  if (!any) return emptyState('在總覽寫下每天的心情和一句話，這週的紀錄就會出現在這裡。');
  return `<ul class="journal-week">${keys.map((k) => {
    const j = byDay.get(k);
    const mood = MOODS.find(([v]) => v === j?.mood);
    return `<li class="journal-day${k === today ? ' is-today' : ''}${k > today ? ' is-future' : ''}">
      <span class="jd-day">週${WEEKDAYS[weekdayOf(k)]}<span class="jd-date">${fmtMonthDay(k)}</span></span>
      <span class="jd-mood"${mood ? ` title="${mood[2]}" aria-label="心情：${mood[2]}"` : ' aria-label="沒有記心情"'}>${mood ? mood[1] : '<span aria-hidden="true">·</span>'}</span>
      <span class="jd-text">${j?.text ? esc(j.text) : '<span class="jd-empty">沒有寫</span>'}</span>
    </li>`;
  }).join('')}</ul>`;
}

function habitWeek(habit, keys, until) {
  const start = habitStart(habit);
  const cells = keys.map((k) => {
    if (!isScheduled(habit, k) || k < start) return { k, state: 'off' };
    if (k > until) return { k, state: 'future' };
    return { k, state: isChecked(habit, k) ? 'done' : 'miss' };
  });
  const due = cells.filter((c) => c.state === 'done' || c.state === 'miss').length;
  const done = cells.filter((c) => c.state === 'done').length;
  return { cells, due, done };
}

export default {
  render(state) {
    const today = todayKey();
    const { weekStart } = state.settings;
    const thisWeek = weekStartKey(today, weekStart);
    ui.week ||= thisWeek;
    const keys = weekKeys(ui.week, weekStart);
    const first = keys[0];
    const last = keys[6];
    const isCurrent = ui.week === thisWeek;
    const isFuture = ui.week > thisWeek;
    const until = isCurrent ? today : last;
    const goalsById = goalsMap();

    // 這週的任務（重複的任務展開成每一次）
    const occ = expandTasks(state.tasks, first, last);
    const inWeek = (ts) => {
      if (!ts) return false;
      const k = toKey(new Date(ts));
      return k >= first && k <= last;
    };
    const done = [...occ.filter(isDone), ...state.tasks.filter((t) => !t.date && isDone(t) && inWeek(t.doneAt))];
    const open = occ.filter((t) => !isDone(t) && t.date <= until);
    const planned = occ.filter((t) => !isDone(t) && t.date > until);

    // 習慣
    const habits = activeHabits(state.habits).map((h) => ({ h, ...habitWeek(h, keys, until) }));
    const due = habits.reduce((n, x) => n + x.due, 0);
    const checked = habits.reduce((n, x) => n + x.done, 0);
    const rate = due ? Math.round((checked / due) * 100) : null;

    const review = state.reviews.find((r) => r.id === ui.week) || { wins: '', improve: '', focus: ['', '', ''] };
    const k = (name) => `rv-${ui.week}-${name}`;
    const nextFirst = addDays(first, 7);
    const title = `${fmtMonthDay(first)} – ${fmtMonthDay(last)}`;

    // 這個月的心情起伏（跨月的那週，算在天數比較多的那個月）
    const month = monthOfWeek(first);
    const moodData = moodMonthData(state, { month, weekStart, today });
    rememberMoodData(moodData);
    wireMoodChart();

    const stat = (num, label, tone = '') => `<div class="review-stat${tone ? ` is-${tone}` : ''}"><span class="review-num">${num}</span><span class="review-label">${label}</span></div>`;

    return `
    <div class="review-view">
      <div class="cal-toolbar">
        <h2 class="view-title">${title}<span class="view-sub">${isCurrent ? '這週' : isFuture ? '之後' : '之前'}</span></h2>
        <div class="cal-nav">
          <button type="button" class="icon-btn" data-action="review-step" data-step="-1" aria-label="上一週">${icon('left')}</button>
          <button type="button" class="btn small ghost" data-action="review-today">這週</button>
          <button type="button" class="icon-btn" data-action="review-step" data-step="1" aria-label="下一週">${icon('right')}</button>
        </div>
      </div>

      <div class="review-stats">
        ${stat(done.length, '完成的任務', 'good')}
        ${stat(open.length, isFuture ? '還沒開始' : '還沒完成', open.length ? 'warn' : '')}
        ${stat(rate === null ? '—' : `${rate}%`, '習慣達成率')}
      </div>

      <div class="review-grid">
        <section class="block" aria-labelledby="rv-done">
          <header class="block-head"><h3 id="rv-done" class="tape tape-3"><span aria-hidden="true">🎉</span>完成的事</h3></header>
          <div class="block-body">${done.length ? taskList(done, { goalsById, today }) : emptyState(isFuture ? '這週還沒開始。' : '這週還沒有完成的任務。')}</div>
        </section>
        <section class="block" aria-labelledby="rv-open">
          <header class="block-head"><h3 id="rv-open" class="tape tape-1"><span aria-hidden="true">📌</span>${isFuture ? '這週的計畫' : '還沒完成'}</h3></header>
          <div class="block-body">
            ${open.length || (isFuture && planned.length) ? taskList(isFuture ? planned : open, { goalsById, today }) : emptyState(isFuture ? '這週還沒有排任務。' : '沒有漏掉的任務，很棒！', '', 'happy')}
            ${!isFuture && planned.length ? `<p class="list-label">這週接下來還有 ${planned.length} 件</p>` : ''}
          </div>
        </section>
        <section class="block review-time" aria-labelledby="rv-time">
          <header class="block-head"><h3 id="rv-time" class="tape tape-4"><span aria-hidden="true">⏱️</span>時間花在哪</h3></header>
          <div class="block-body">${timeSection(occ)}</div>
        </section>
        <section class="block review-journal" aria-labelledby="rv-journal">
          <header class="block-head"><h3 id="rv-journal" class="tape tape-1"><span aria-hidden="true">📝</span>每天的心情</h3></header>
          <div class="block-body">${journalSection(keys, today, state.journal)}</div>
        </section>
        <section class="block review-moods" aria-labelledby="rv-moods">
          <header class="block-head"><h3 id="rv-moods" class="tape tape-3"><span aria-hidden="true">📈</span>${Number(month.slice(5))}月的心情起伏</h3></header>
          <div class="block-body">${moodChart(moodData, { selFirst: first, today })}</div>
        </section>
        <section class="block review-habits" aria-labelledby="rv-habits">
          <header class="block-head"><h3 id="rv-habits" class="tape tape-2"><span aria-hidden="true">🌱</span>習慣</h3></header>
          <div class="block-body">
            ${habits.length ? `<div class="rh-head" aria-hidden="true"><span></span>${keys.map((d) => `<span>${WEEKDAYS[weekdayOf(d)]}</span>`).join('')}<span></span></div>
              ${habits.map(({ h, cells, due: n, done: c }) => `<div class="rh-row">
                <span class="rh-name"><span aria-hidden="true">${esc(h.emoji)}</span>${esc(h.name)}</span>
                ${cells.map((cell) => `<span class="rh-cell is-${cell.state}" title="${fmtMonthDay(cell.k)}"></span>`).join('')}
                <span class="rh-rate">${n ? `${c}/${n}` : '—'}</span>
              </div>`).join('')}`
              : emptyState('還沒有習慣。', '<a class="btn small" href="#/habits">去新增習慣</a>')}
          </div>
        </section>
      </div>

      <form class="block review-form" data-submit="save-review" aria-labelledby="rv-write">
        <header class="block-head"><h3 id="rv-write" class="tape tape-4"><span aria-hidden="true">✍️</span>寫下這週</h3></header>
        <div class="block-body">
          <div class="field"><label for="rv-wins">這週做得好的事</label>
            <textarea id="rv-wins" name="wins" rows="3" data-keep="${k('wins')}" placeholder="例如：每天都有背單字">${esc(review.wins)}</textarea></div>
          <div class="field"><label for="rv-improve">下次可以更好的地方</label>
            <textarea id="rv-improve" name="improve" rows="3" data-keep="${k('improve')}" placeholder="例如：晚上太晚睡">${esc(review.improve)}</textarea></div>
          <fieldset class="field"><legend>下週的三個重點</legend>
            ${[0, 1, 2].map((i) => `<div class="focus-row">
              <span class="focus-num" aria-hidden="true">${i + 1}</span>
              <input name="focus${i}" data-keep="${k(`focus${i}`)}" value="${esc(review.focus[i])}" maxlength="200" autocomplete="off" aria-label="下週重點 ${i + 1}">
              <button type="button" class="btn small ghost" data-action="focus-to-task" data-index="${i}" data-date="${nextFirst}">${icon('plus')}變成任務</button>
            </div>`).join('')}
          </fieldset>
          <div class="btn-row"><button type="submit" class="btn primary">${icon('check')}儲存回顧</button>
            ${review.updatedAt ? `<span class="hint">上次儲存：${fmtMonthDay(toKey(new Date(review.updatedAt)))}</span>` : ''}</div>
        </div>
      </form>
    </div>`;
  },

  actions: {
    'review-step'(el, e, ctx) {
      ui.week = addDays(ui.week, Number(el.dataset.step) * 7);
      ctx.rerender();
    },
    'review-today'(el, e, ctx) {
      ui.week = '';
      ctx.rerender();
    },
    'focus-to-task'(el) {
      const input = el.closest('.focus-row').querySelector('input');
      const title = input.value.trim();
      if (!title) {
        input.focus();
        return;
      }
      store.addTask({ title, date: el.dataset.date, priority: 'high' });
      toast(`已加到 ${fmtMonthDay(el.dataset.date)} 的任務`);
    },
  },

  submit: {
    'save-review'(form, e, ctx) {
      const f = form.elements;
      store.saveReview(ui.week, {
        wins: f.wins.value.trim(),
        improve: f.improve.value.trim(),
        focus: [f.focus0.value.trim(), f.focus1.value.trim(), f.focus2.value.trim()],
      });
      ctx.forgetDrafts(['wins', 'improve', 'focus0', 'focus1', 'focus2'].map((n) => `rv-${ui.week}-${n}`));
      toast('已儲存這週的回顧');
    },
  },

  newTaskDefaults() {
    return {};
  },
};
