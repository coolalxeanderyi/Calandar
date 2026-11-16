// 習慣：每週打卡表、連續天數、最近 15 週的熱度圖
import {
  esc, todayKey, addDays, weekKeys, weekStartKey, WEEKDAYS, weekdayOf, fmtShort, fmtMonthDay,
} from '../utils.js';
import { icon } from '../ui.js';
import { activeHabits, habitStats, habitStart, isScheduled, isChecked, daysLabel } from '../model.js';
import { habitCheck, emptyState } from '../components.js';

const ui = { weekOffset: 0, archivedOpen: false };
const HEAT_WEEKS = 15;

function heatmap(habit, today, weekStart) {
  const start = weekStartKey(addDays(today, -(HEAT_WEEKS - 1) * 7), weekStart);
  const first = habitStart(habit, today);
  let cells = '';
  for (let i = 0; i < HEAT_WEEKS * 7; i++) {
    const key = addDays(start, i);
    let cls = 'heat-cell';
    let state = '';
    if (key > today) { cls += ' is-future'; state = '還沒到'; }
    else if (isChecked(habit, key)) { cls += ' is-on'; state = '完成'; }
    else if (key < first) { cls += ' is-before'; state = '還沒開始'; }
    else if (!isScheduled(habit, key)) { cls += ' is-off'; state = '不用做'; }
    else if (key === today) { cls += ' is-pending'; state = '今天還沒做'; }
    else { cls += ' is-miss'; state = '沒做到'; }
    cells += `<span class="${cls}" title="${fmtMonthDay(key)}：${state}"></span>`;
  }
  return `<div class="heatmap" style="--weeks:${HEAT_WEEKS}" role="img" aria-label="${esc(habit.name)} 最近 ${HEAT_WEEKS} 週的打卡紀錄">${cells}</div>`;
}

export default {
  render(state) {
    const today = todayKey();
    const { weekStart } = state.settings;
    const anchor = addDays(today, ui.weekOffset * 7);
    const days = weekKeys(anchor, weekStart);
    const habits = activeHabits(state.habits);
    const archived = state.habits.filter((h) => h.archived);
    const range = ui.weekOffset === 0 ? '本週' : `${fmtShort(days[0])} – ${fmtShort(days[6])}`;

    const toolbar = `
      <div class="view-toolbar">
        <div class="cal-nav">
          <button type="button" class="icon-btn" data-action="habit-week" data-step="-1" aria-label="上一週">${icon('left')}</button>
          <span class="range-label" aria-live="polite">${range}</span>
          <button type="button" class="icon-btn" data-action="habit-week" data-step="1" aria-label="下一週"${ui.weekOffset >= 0 ? ' disabled' : ''}>${icon('right')}</button>
          ${ui.weekOffset !== 0 ? '<button type="button" class="btn small ghost" data-action="habit-week" data-step="0">回到本週</button>' : ''}
        </div>
        <button type="button" class="btn primary" data-action="new-habit">${icon('plus')}新增習慣</button>
      </div>`;

    if (!habits.length) {
      return `<div class="habits-view">${toolbar}
        ${emptyState('還沒有習慣。從一件每天想做的小事開始，例如喝水或閱讀 10 分鐘。', `<button type="button" class="btn primary" data-action="new-habit">${icon('plus')}新增習慣</button>`)}
        ${archivedList(archived)}</div>`;
    }

    const head = `<div class="hb-row hb-head" role="row">
      <span class="hb-name" role="columnheader">習慣</span>
      ${days.map((k) => `<span class="hb-day${k === today ? ' is-today' : ''}${weekdayOf(k) === 0 ? ' is-sun' : ''}" role="columnheader" aria-label="${fmtMonthDay(k)}"><span class="hb-wd">${WEEKDAYS[weekdayOf(k)]}</span><span class="hb-num">${Number(k.slice(8))}</span></span>`).join('')}
      <span class="hb-streak" role="columnheader">連續</span>
    </div>`;

    const rows = habits.map((h) => {
      const s = habitStats(h, today);
      const cells = days.map((k) => {
        let inner;
        if (k > today) inner = '<span class="hb-future" aria-label="還沒到"></span>';
        else if (isScheduled(h, k) || isChecked(h, k)) inner = habitCheck(h, k);
        else inner = '<span class="hb-off" aria-label="這天不用做">–</span>';
        return `<span class="hb-cell${k === today ? ' is-today' : ''}" role="cell">${inner}</span>`;
      }).join('');
      return `<div class="hb-row" role="row">
        <button type="button" class="hb-name" role="rowheader" data-action="open-habit" data-id="${esc(h.id)}">
          <span class="habit-emoji" aria-hidden="true">${esc(h.emoji)}</span>
          <span class="hb-label"><span class="habit-name">${esc(h.name)}</span><span class="hb-days">${daysLabel(h.days)}</span></span>
        </button>
        ${cells}
        <span class="hb-streak" role="cell">${s.streak ? `${s.streak} 天` : '–'}</span>
      </div>`;
    }).join('');

    const stats = habits.map((h) => {
      const s = habitStats(h, today);
      return `<article class="hs-item">
        <h4 class="hs-title"><span aria-hidden="true">${esc(h.emoji)}</span> ${esc(h.name)}</h4>
        <dl class="hs-stats">
          <div><dt>目前連續</dt><dd>${s.streak} 天</dd></div>
          <div><dt>最長連續</dt><dd>${s.best} 天</dd></div>
          <div><dt>本月完成率</dt><dd>${s.monthRate === null ? '–' : `${s.monthRate}%`}</dd></div>
        </dl>
        ${heatmap(h, today, weekStart)}
      </article>`;
    }).join('');

    return `
    <div class="habits-view">
      ${toolbar}
      <div class="habit-board" role="table" aria-label="習慣打卡表，${range}">${head}${rows}</div>
      <section class="habit-stats" aria-labelledby="hs-title">
        <h3 class="section-title" id="hs-title">最近 ${HEAT_WEEKS} 週</h3>
        <div class="heat-legend" aria-hidden="true"><span class="heat-cell is-on"></span>完成<span class="heat-cell is-miss"></span>沒做到<span class="heat-cell is-off"></span>不用做</div>
        <div class="hs-list">${stats}</div>
      </section>
      ${archivedList(archived)}
    </div>`;
  },

  actions: {
    'habit-week'(el, e, ctx) {
      const step = Number(el.dataset.step);
      ui.weekOffset = step === 0 ? 0 : Math.min(0, ui.weekOffset + step);
      ctx.rerender();
    },
  },

  toggle: {
    archived(el) {
      ui.archivedOpen = el.open;
    },
  },

  newTaskDefaults() {
    return {};
  },
};

function archivedList(archived) {
  if (!archived.length) return '';
  return `<details class="archived" data-toggle="archived"${ui.archivedOpen ? ' open' : ''}>
    <summary>已封存的習慣（${archived.length}）</summary>
    <ul>${archived.map((h) => `<li><button type="button" class="link-btn" data-action="open-habit" data-id="${esc(h.id)}">${esc(h.emoji)} ${esc(h.name)}</button></li>`).join('')}</ul>
  </details>`;
}
