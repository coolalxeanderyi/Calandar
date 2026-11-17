// 行事曆：月檢視（點日期看當天清單）、週檢視、日檢視（一小時一格的時間軸）；桌機可以把任務拖到別天
import {
  esc, todayKey, isDateKey, fmtMonthDay, fmtWeekday, fmtYearMonth, monthGrid, weekKeys,
  orderedWeekdays, WEEKDAYS, weekdayOf, addDays, toKey, fromKey,
} from '../utils.js';
import { icon } from '../ui.js';
import { isDone, tasksByDate, expandTasks, compareTasks, endTime, repeatLabel, isRepeating } from '../model.js';
import { taskList, emptyState, goalsMap, occAttr, openTaskModal, eventList, evAttrs, evTimeText } from '../components.js';
import { eventsBetween, groupByDay } from '../gsync.js';

const ui = { mode: 'month', cursor: null, selected: null };

function goalsByDeadline(goals) {
  const map = new Map();
  for (const g of goals) {
    if (!g.deadline || g.status === 'done') continue;
    if (!map.has(g.deadline)) map.set(g.deadline, []);
    map.get(g.deadline).push(g);
  }
  return map;
}

function goalFlags(goals) {
  return goals
    .map((g) => `<button type="button" class="cal-goal" data-action="open-goal" data-id="${esc(g.id)}" title="目標期限">${icon('flag')}<span>${esc(g.title)}</span></button>`)
    .join('');
}

// 一格裡的東西依時間排：整天的在前面，再依開始時間
function cellEntries(key, items, evs) {
  const entries = [
    ...evs.map((ev) => ({
      order: ev.allDay || ev.startKey < key ? '0a' : `1${ev.startTime}`,
      html: `<button type="button" class="cal-item cal-ev"${evAttrs(ev)}>${!ev.allDay && ev.startKey === key ? `<span class="cal-time">${ev.startTime}</span>` : ''}<span class="cal-item-title">${esc(ev.title)}</span></button>`,
    })),
    ...items.map((t) => ({
      order: t.time ? `1${t.time}` : '0b',
      html: `<button type="button" class="cal-item prio-${t.priority}${isDone(t) ? ' is-done' : ''}${t.occ ? ' is-repeat' : ''}"${dragAttrs(t)} data-action="open-task" data-id="${esc(t.id)}"${occAttr(t)}>${t.time ? `<span class="cal-time">${t.time}</span>` : ''}<span class="cal-item-title">${esc(t.title)}</span></button>`,
    })),
  ];
  return entries.sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0));
}

function monthView(state, today, byDate, deadlines, evByDate) {
  const { weekStart } = state.settings;
  const [y, m] = ui.cursor.split('-').map(Number);
  const weeks = monthGrid(y, m - 1, weekStart);
  const head = orderedWeekdays(weekStart)
    .map((d) => `<div class="cal-wd${d === 0 ? ' is-sun' : ''}${d === 6 ? ' is-sat' : ''}" role="columnheader">${WEEKDAYS[d]}</div>`)
    .join('');

  const cell = (key) => {
    const items = byDate.get(key) || [];
    const evs = evByDate.get(key) || [];
    const goals = deadlines.get(key) || [];
    const open = items.filter((t) => !isDone(t)).length;
    const cls = [
      'cal-cell',
      key.slice(0, 7) !== ui.cursor.slice(0, 7) ? 'is-other' : '',
      key === today ? 'is-today' : '',
      key === ui.selected ? 'is-selected' : '',
      weekdayOf(key) === 0 ? 'is-sun' : '',
    ].join(' ');
    const entries = cellEntries(key, items, evs);
    const shown = entries.slice(0, 3);
    return `<div class="${cls}" role="gridcell" data-action="cal-select" data-date="${key}" data-drop-date="${key}">
      <button type="button" class="cal-num" data-action="cal-select" data-date="${key}" aria-pressed="${key === ui.selected}" aria-label="${fmtMonthDay(key)}${open ? `，${open} 個未完成任務` : ''}${evs.length ? `，${evs.length} 個行程` : ''}${goals.length ? `，${goals.length} 個目標到期` : ''}">${Number(key.slice(8))}</button>
      <div class="cal-items">
        ${goalFlags(goals)}
        ${shown.map((e) => e.html).join('')}
        ${entries.length > shown.length ? `<span class="cal-more">還有 ${entries.length - shown.length} 個</span>` : ''}
      </div>
      ${open || goals.length || evs.length ? `<span class="cal-dots" aria-hidden="true">${'<i></i>'.repeat(Math.min(3, open))}${evs.length ? '<i class="is-ev"></i>' : ''}${goals.length ? '<i class="is-goal"></i>' : ''}</span>` : ''}
    </div>`;
  };

  const sel = ui.selected;
  const selTasks = byDate.get(sel) || [];
  const selEvs = evByDate.get(sel) || [];
  const selGoals = deadlines.get(sel) || [];
  return `
    <div class="cal-month" role="grid" aria-label="${fmtYearMonth(y, m - 1)}">
      <div class="cal-row cal-head" role="row">${head}</div>
      ${weeks.map((week) => `<div class="cal-row" role="row">${week.map(cell).join('')}</div>`).join('')}
    </div>
    <section class="agenda" aria-labelledby="agenda-title">
      <header class="agenda-head">
        <h3 id="agenda-title" class="agenda-title">${fmtMonthDay(sel)}<span>${fmtWeekday(sel)}${sel === today ? '，今天' : ''}</span></h3>
        <div class="agenda-actions">
          <button type="button" class="btn small ghost" data-action="cal-mode" data-value="day">${icon('clock')}時間軸</button>
          <button type="button" class="btn small" data-action="new-task" data-date="${sel}">${icon('plus')}新增任務</button>
        </div>
      </header>
      ${selGoals.length ? `<div class="agenda-goals">${goalFlags(selGoals)}</div>` : ''}
      ${selEvs.length ? eventList(selEvs, sel) : ''}
      ${selTasks.length ? taskList(selTasks, { goalsById: goalsMap(), today, showDate: false }) : selEvs.length ? '' : emptyState('這天沒有任務。')}
    </section>`;
}

function weekView(state, today, byDate, deadlines, evByDate) {
  const keys = weekKeys(ui.cursor, state.settings.weekStart);
  return `<div class="cal-week">${keys.map((key) => {
    const items = byDate.get(key) || [];
    const evs = evByDate.get(key) || [];
    const goals = deadlines.get(key) || [];
    const wd = weekdayOf(key);
    return `<section class="week-col${key === today ? ' is-today' : ''}${wd === 0 ? ' is-sun' : ''}" data-drop-date="${key}" aria-label="${fmtMonthDay(key)} ${fmtWeekday(key)}">
      <header class="week-col-head"><span class="week-wd">${WEEKDAYS[wd]}</span><span class="week-num">${Number(key.slice(8))}</span></header>
      ${goals.length ? `<div class="week-goals">${goalFlags(goals)}</div>` : ''}
      ${evs.length ? eventList(evs, key, { showCal: false }) : ''}
      <ul class="week-items">${items.map((t) => `
        <li class="week-item prio-${t.priority}${isDone(t) ? ' is-done' : ''}${t.occ ? ' is-repeat' : ''}"${dragAttrs(t)}>
          <button type="button" class="check small" role="checkbox" aria-checked="${isDone(t)}" data-action="toggle-task" data-id="${esc(t.id)}"${occAttr(t)} aria-label="完成：${esc(t.title)}">${icon('check')}</button>
          <button type="button" class="week-item-main" data-action="open-task" data-id="${esc(t.id)}"${occAttr(t)}>${t.time ? `<span class="cal-time">${t.time}</span>` : ''}${esc(t.title)}</button>
        </li>`).join('')}</ul>
      <button type="button" class="week-add" data-action="new-task" data-date="${key}" aria-label="在 ${fmtMonthDay(key)} 新增任務">${icon('plus')}<span>新增</span></button>
    </section>`;
  }).join('')}</div>`;
}

// 拖曳只給一般任務；重複任務改日期要到編輯視窗改「從哪天開始」
const dragAttrs = (t) => (t.occ ? '' : ` draggable="true" data-drag-task="${esc(t.id)}"`);

// ---------- 日檢視：時間軸 ----------
const HOUR = 56; // 一小時的高度（px）
const toMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const pad2 = (n) => String(n).padStart(2, '0');

// 時間重疊的任務和行程並排放（每個 block 都有 start、end，單位是分鐘）
function layoutBlocks(blocks) {
  blocks.sort((a, b) => a.start - b.start || b.end - a.end);
  let group = [];
  let groupEnd = -1;
  const flush = () => {
    const cols = [];
    for (const b of group) {
      let c = cols.findIndex((end) => end <= b.start);
      if (c === -1) {
        c = cols.length;
        cols.push(0);
      }
      cols[c] = b.end;
      b.col = c;
    }
    for (const b of group) b.cols = cols.length;
    group = [];
  };
  for (const b of blocks) {
    if (b.start >= groupEnd && group.length) flush();
    group.push(b);
    groupEnd = Math.max(groupEnd, b.end);
  }
  if (group.length) flush();
  return blocks;
}

function dayView(state, today, deadlines) {
  const key = ui.cursor;
  const items = expandTasks(state.tasks, key, key).sort(compareTasks);
  const allDay = items.filter((t) => !t.time);
  const timed = items.filter((t) => t.time);
  const goals = deadlines.get(key) || [];

  // Google 日曆的行程：整天的（或跨過一整天的）放上面，其他的放進時間軸
  const dayStart = fromKey(key).getTime();
  const evAllDay = [];
  const evBlocks = [];
  for (const ev of eventsBetween(key, key)) {
    const start = Math.max(0, Math.round((ev.startMs - dayStart) / 60_000));
    const end = Math.min(24 * 60, Math.round((ev.endMs - dayStart) / 60_000));
    if (ev.allDay || (start <= 0 && end >= 24 * 60)) evAllDay.push(ev);
    else evBlocks.push({ ev, start, end: Math.min(Math.max(end, start + 15), 24 * 60) });
  }
  const taskBlocks = timed.map((t) => ({ t, start: toMin(t.time), end: Math.min(toMin(t.time) + (t.duration || 60), 24 * 60) }));
  const all = [...taskBlocks, ...evBlocks];
  const earliest = all.length ? Math.floor(Math.min(...all.map((b) => b.start)) / 60) : 7;
  const startHour = Math.min(7, earliest);
  const hours = [];
  for (let h = startHour; h < 24; h++) hours.push(h);
  const top = (min) => ((min - startHour * 60) / 60) * HOUR;

  const blocks = layoutBlocks(all).map(({ t, ev, start, end, col, cols }) => {
    const height = Math.max(((end - start) / 60) * HOUR - 4, 30);
    const short = height < 46;
    const box = `top:${top(start) + 2}px;height:${height}px;left:calc(${(col / cols) * 100}% + 4px);width:calc(${100 / cols}% - 8px)`;
    if (ev) {
      return `<div class="day-block day-ev${short ? ' is-short' : ''}" style="--ev:${ev.color};${box}">
        <button type="button" class="day-block-main" data-action="open-gevent" data-ev="${esc(ev.key)}" data-start="${ev.startMs}">
          <span class="day-block-title">${esc(ev.title)}</span>
          <span class="day-block-time">${evTimeText(ev, key)}${ev.calName ? `・${esc(ev.calName)}` : ''}</span>
        </button>
      </div>`;
    }
    return `<div class="day-block prio-${t.priority}${isDone(t) ? ' is-done' : ''}${short ? ' is-short' : ''}" style="${box}">
      <button type="button" class="check small" role="checkbox" aria-checked="${isDone(t)}" data-action="toggle-task" data-id="${esc(t.id)}"${occAttr(t)} aria-label="完成：${esc(t.title)}">${icon('check')}</button>
      <button type="button" class="day-block-main" data-action="open-task" data-id="${esc(t.id)}"${occAttr(t)}>
        <span class="day-block-title">${esc(t.title)}</span>
        <span class="day-block-time">${t.time}–${endTime(t)}${isRepeating(t) ? `・🔁 ${repeatLabel(t)}` : ''}</span>
      </button>
    </div>`;
  }).join('');

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const nowLine = key === today && nowMin >= startHour * 60
    ? `<div class="day-now" style="top:${top(nowMin)}px" aria-hidden="true"><span>${pad2(Math.floor(nowMin / 60))}:${pad2(nowMin % 60)}</span></div>`
    : '';

  return `
    <div class="day-view">
      <div class="day-allday">
        <span class="day-allday-label">整天</span>
        <div class="day-allday-items">
          ${goalFlags(goals)}
          ${evAllDay.length ? eventList(evAllDay, key) : ''}
          ${allDay.length ? taskList(allDay, { goalsById: goalsMap(), today, showDate: false }) : goals.length || evAllDay.length ? '' : '<p class="hint">沒有整天的任務。</p>'}
        </div>
      </div>
      <div class="day-grid" style="height:${hours.length * HOUR}px">
        <div class="day-hours" aria-hidden="true">${hours.map((h) => `<span style="top:${(h - startHour) * HOUR}px">${pad2(h)}:00</span>`).join('')}</div>
        <div class="day-track">
          ${hours.map((h) => `<button type="button" class="day-slot" style="top:${(h - startHour) * HOUR}px;height:${HOUR}px" data-action="day-slot" data-time="${pad2(h)}:00" aria-label="在 ${pad2(h)}:00 新增任務"></button>`).join('')}
          ${blocks}
          ${nowLine}
        </div>
      </div>
    </div>`;
}

export default {
  enter(params) {
    const d = params.get('d');
    if (isDateKey(d)) {
      ui.selected = d;
      ui.cursor = d;
      ui.mode = ['month', 'week', 'day'].includes(params.get('mode')) ? params.get('mode') : 'month';
    }
  },

  render(state) {
    const today = todayKey();
    ui.cursor ||= today;
    ui.selected ||= today;
    const deadlines = goalsByDeadline(state.goals);
    const [y, m] = ui.cursor.split('-').map(Number);
    const { weekStart } = state.settings;
    let title;
    let byDate;
    let evByDate = new Map();
    if (ui.mode === 'month') {
      title = fmtYearMonth(y, m - 1);
      const grid = monthGrid(y, m - 1, weekStart).flat();
      const [first, last] = [grid[0], grid[grid.length - 1]];
      byDate = tasksByDate(state.tasks, first, last);
      evByDate = groupByDay(eventsBetween(first, last), first, last);
    } else if (ui.mode === 'week') {
      const keys = weekKeys(ui.cursor, weekStart);
      title = `${fmtMonthDay(keys[0])} – ${fmtMonthDay(keys[6])}`;
      byDate = tasksByDate(state.tasks, keys[0], keys[6]);
      evByDate = groupByDay(eventsBetween(keys[0], keys[6]), keys[0], keys[6]);
    } else {
      title = `${fmtMonthDay(ui.cursor)}<span class="view-sub">${fmtWeekday(ui.cursor)}${ui.cursor === today ? '，今天' : ''}</span>`;
    }
    const unit = { month: '個月', week: '週', day: '天' }[ui.mode];
    const view = ui.mode === 'month' ? monthView(state, today, byDate, deadlines, evByDate)
      : ui.mode === 'week' ? weekView(state, today, byDate, deadlines, evByDate) : dayView(state, today, deadlines);
    const tip = ui.mode === 'day' ? '提示：點時間軸上的空白時段，可以直接在那個時間新增任務。' : '提示：在電腦上可以直接把任務拖到別的日期（重複的任務除外）。';

    return `
    <div class="cal-view">
      <div class="cal-toolbar">
        <h2 class="view-title">${title}</h2>
        <div class="cal-nav">
          <button type="button" class="icon-btn" data-action="cal-step" data-step="-1" aria-label="上一${unit}">${icon('left')}</button>
          <button type="button" class="btn small ghost" data-action="cal-today">今天</button>
          <button type="button" class="icon-btn" data-action="cal-step" data-step="1" aria-label="下一${unit}">${icon('right')}</button>
        </div>
        <div class="chips" role="group" aria-label="檢視方式">
          <button type="button" class="chip${ui.mode === 'month' ? ' is-active' : ''}" aria-pressed="${ui.mode === 'month'}" data-action="cal-mode" data-value="month">月</button>
          <button type="button" class="chip${ui.mode === 'week' ? ' is-active' : ''}" aria-pressed="${ui.mode === 'week'}" data-action="cal-mode" data-value="week">週</button>
          <button type="button" class="chip${ui.mode === 'day' ? ' is-active' : ''}" aria-pressed="${ui.mode === 'day'}" data-action="cal-mode" data-value="day">日</button>
        </div>
      </div>
      ${view}
      <p class="cal-tip">${tip}</p>
    </div>`;
  },

  actions: {
    'cal-select'(el, e, ctx) {
      const key = el.dataset.date;
      ui.selected = key;
      if (key.slice(0, 7) !== ui.cursor.slice(0, 7)) ui.cursor = key;
      ctx.rerender();
    },
    'cal-step'(el, e, ctx) {
      const step = Number(el.dataset.step);
      if (ui.mode === 'month') {
        const d = fromKey(ui.cursor);
        const next = new Date(d.getFullYear(), d.getMonth() + step, 1);
        ui.cursor = toKey(next);
        // 換月時，選取的日期跟著移到同一天（超過月底就用月底）
        const sel = fromKey(ui.selected);
        const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        ui.selected = toKey(new Date(next.getFullYear(), next.getMonth(), Math.min(sel.getDate(), last)));
      } else {
        ui.cursor = addDays(ui.cursor, step * (ui.mode === 'week' ? 7 : 1));
        ui.selected = ui.cursor;
      }
      ctx.rerender();
    },
    'day-slot'(el) {
      openTaskModal(null, { date: ui.cursor, time: el.dataset.time });
    },
    'cal-today'(el, e, ctx) {
      ui.cursor = todayKey();
      ui.selected = ui.cursor;
      ctx.rerender();
    },
    'cal-mode'(el, e, ctx) {
      ui.mode = el.dataset.value;
      ui.cursor = ui.selected || todayKey();
      ctx.rerender();
    },
  },

  newTaskDefaults() {
    return { date: (ui.mode === 'day' ? ui.cursor : ui.selected) || todayKey() };
  },
};
