// 行事曆：月檢視（點日期看當天清單）與週檢視；桌機可以把任務拖到別天
import {
  esc, todayKey, isDateKey, fmtMonthDay, fmtWeekday, fmtYearMonth, monthGrid, weekKeys,
  orderedWeekdays, WEEKDAYS, weekdayOf, addDays, toKey, fromKey,
} from '../utils.js';
import { icon } from '../ui.js';
import { isDone, tasksByDate } from '../model.js';
import { taskList, emptyState, goalsMap } from '../components.js';

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

function monthView(state, today, byDate, deadlines) {
  const { weekStart } = state.settings;
  const [y, m] = ui.cursor.split('-').map(Number);
  const weeks = monthGrid(y, m - 1, weekStart);
  const head = orderedWeekdays(weekStart)
    .map((d) => `<div class="cal-wd${d === 0 ? ' is-sun' : ''}${d === 6 ? ' is-sat' : ''}" role="columnheader">${WEEKDAYS[d]}</div>`)
    .join('');

  const cell = (key) => {
    const items = byDate.get(key) || [];
    const goals = deadlines.get(key) || [];
    const open = items.filter((t) => !isDone(t)).length;
    const cls = [
      'cal-cell',
      key.slice(0, 7) !== ui.cursor.slice(0, 7) ? 'is-other' : '',
      key === today ? 'is-today' : '',
      key === ui.selected ? 'is-selected' : '',
      weekdayOf(key) === 0 ? 'is-sun' : '',
    ].join(' ');
    const shown = items.slice(0, 3);
    return `<div class="${cls}" role="gridcell" data-action="cal-select" data-date="${key}" data-drop-date="${key}">
      <button type="button" class="cal-num" data-action="cal-select" data-date="${key}" aria-pressed="${key === ui.selected}" aria-label="${fmtMonthDay(key)}${open ? `，${open} 個未完成任務` : ''}${goals.length ? `，${goals.length} 個目標到期` : ''}">${Number(key.slice(8))}</button>
      <div class="cal-items">
        ${goalFlags(goals)}
        ${shown.map((t) => `<button type="button" class="cal-item prio-${t.priority}${isDone(t) ? ' is-done' : ''}" draggable="true" data-drag-task="${esc(t.id)}" data-action="open-task" data-id="${esc(t.id)}">${t.time ? `<span class="cal-time">${t.time}</span>` : ''}<span class="cal-item-title">${esc(t.title)}</span></button>`).join('')}
        ${items.length > shown.length ? `<span class="cal-more">還有 ${items.length - shown.length} 個</span>` : ''}
      </div>
      ${open || goals.length ? `<span class="cal-dots" aria-hidden="true">${'<i></i>'.repeat(Math.min(3, open))}${goals.length ? '<i class="is-goal"></i>' : ''}</span>` : ''}
    </div>`;
  };

  const sel = ui.selected;
  const selTasks = byDate.get(sel) || [];
  const selGoals = deadlines.get(sel) || [];
  return `
    <div class="cal-month" role="grid" aria-label="${fmtYearMonth(y, m - 1)}">
      <div class="cal-row cal-head" role="row">${head}</div>
      ${weeks.map((week) => `<div class="cal-row" role="row">${week.map(cell).join('')}</div>`).join('')}
    </div>
    <section class="agenda" aria-labelledby="agenda-title">
      <header class="agenda-head">
        <h3 id="agenda-title" class="agenda-title">${fmtMonthDay(sel)}<span>${fmtWeekday(sel)}${sel === today ? '，今天' : ''}</span></h3>
        <button type="button" class="btn small" data-action="new-task" data-date="${sel}">${icon('plus')}新增任務</button>
      </header>
      ${selGoals.length ? `<div class="agenda-goals">${goalFlags(selGoals)}</div>` : ''}
      ${selTasks.length ? taskList(selTasks, { goalsById: goalsMap(), today, showDate: false }) : emptyState('這天沒有任務。')}
    </section>`;
}

function weekView(state, today, byDate, deadlines) {
  const keys = weekKeys(ui.cursor, state.settings.weekStart);
  return `<div class="cal-week">${keys.map((key) => {
    const items = byDate.get(key) || [];
    const goals = deadlines.get(key) || [];
    const wd = weekdayOf(key);
    return `<section class="week-col${key === today ? ' is-today' : ''}${wd === 0 ? ' is-sun' : ''}" data-drop-date="${key}" aria-label="${fmtMonthDay(key)} ${fmtWeekday(key)}">
      <header class="week-col-head"><span class="week-wd">${WEEKDAYS[wd]}</span><span class="week-num">${Number(key.slice(8))}</span></header>
      ${goals.length ? `<div class="week-goals">${goalFlags(goals)}</div>` : ''}
      <ul class="week-items">${items.map((t) => `
        <li class="week-item prio-${t.priority}${isDone(t) ? ' is-done' : ''}" draggable="true" data-drag-task="${esc(t.id)}">
          <button type="button" class="check small" role="checkbox" aria-checked="${isDone(t)}" data-action="toggle-task" data-id="${esc(t.id)}" aria-label="完成：${esc(t.title)}">${icon('check')}</button>
          <button type="button" class="week-item-main" data-action="open-task" data-id="${esc(t.id)}">${t.time ? `<span class="cal-time">${t.time}</span>` : ''}${esc(t.title)}</button>
        </li>`).join('')}</ul>
      <button type="button" class="week-add" data-action="new-task" data-date="${key}" aria-label="在 ${fmtMonthDay(key)} 新增任務">${icon('plus')}<span>新增</span></button>
    </section>`;
  }).join('')}</div>`;
}

export default {
  enter(params) {
    const d = params.get('d');
    if (isDateKey(d)) {
      ui.selected = d;
      ui.cursor = d;
      ui.mode = 'month';
    }
  },

  render(state) {
    const today = todayKey();
    ui.cursor ||= today;
    ui.selected ||= today;
    const byDate = tasksByDate(state.tasks);
    const deadlines = goalsByDeadline(state.goals);
    const [y, m] = ui.cursor.split('-').map(Number);
    let title;
    if (ui.mode === 'month') title = fmtYearMonth(y, m - 1);
    else {
      const keys = weekKeys(ui.cursor, state.settings.weekStart);
      title = `${fmtMonthDay(keys[0])} – ${fmtMonthDay(keys[6])}`;
    }
    const unit = ui.mode === 'month' ? '個月' : '週';

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
        </div>
      </div>
      ${ui.mode === 'month' ? monthView(state, today, byDate, deadlines) : weekView(state, today, byDate, deadlines)}
      <p class="cal-tip">提示：在電腦上可以直接把任務拖到別的日期。</p>
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
        ui.cursor = addDays(ui.cursor, step * 7);
        ui.selected = ui.cursor;
      }
      ctx.rerender();
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
    return { date: ui.selected || todayKey() };
  },
};
