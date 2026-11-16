// 目標：依領域分組，顯示進度、期限與相關任務數
import { esc, todayKey, fmtShort, toKey } from '../utils.js';
import { icon } from '../ui.js';
import { goalProgress, deadlineInfo, AREA_SUGGESTIONS } from '../model.js';
import { progressBar, emptyState } from '../components.js';

const ui = { filter: 'open' };
const FILTERS = [['open', '進行中'], ['done', '已完成'], ['all', '全部']];

function areaOrder(a, b) {
  const ia = AREA_SUGGESTIONS.indexOf(a);
  const ib = AREA_SUGGESTIONS.indexOf(b);
  if (a === '' || b === '') return a === '' ? 1 : -1;
  if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  return a.localeCompare(b, 'zh-Hant');
}

function goalRow(g, tasks, today) {
  const { pct, done, total } = goalProgress(g, tasks);
  const due = g.status === 'done'
    ? { text: g.doneAt ? `${fmtShort(toKey(new Date(g.doneAt)))} 完成` : '已完成', tone: 'done' }
    : deadlineInfo(g.deadline, today);
  return `<li>
    <button type="button" class="goal-row status-${g.status}" data-action="open-goal" data-id="${esc(g.id)}">
      <span class="goal-emoji" aria-hidden="true">${esc(g.emoji)}</span>
      <span class="goal-body">
        <span class="goal-title">${esc(g.title)}</span>
        <span class="goal-tags">
          ${g.status === 'paused' ? '<span class="tag">暫停中</span>' : ''}
          <span class="tag tone-${due.tone}">${due.text}</span>
          ${g.progressMode === 'tasks' ? `<span class="tag">${done} / ${total} 個任務</span>` : '<span class="tag">自己調整進度</span>'}
        </span>
        ${progressBar(pct, `${g.title} 的進度`)}
      </span>
      <span class="goal-pct">${pct}<small>%</small></span>
    </button>
  </li>`;
}

export default {
  render(state) {
    const today = todayKey();
    const goals = state.goals.filter((g) => {
      if (ui.filter === 'open') return g.status !== 'done';
      if (ui.filter === 'done') return g.status === 'done';
      return true;
    });

    const groups = new Map();
    for (const g of goals) {
      const area = g.area.trim();
      if (!groups.has(area)) groups.set(area, []);
      groups.get(area).push(g);
    }
    const areas = [...groups.keys()].sort(areaOrder);
    const sortGoals = (a, b) =>
      (a.status === 'paused') - (b.status === 'paused') ||
      (a.deadline || '9999').localeCompare(b.deadline || '9999') ||
      a.createdAt - b.createdAt;

    let body;
    if (!state.goals.length) {
      body = emptyState('還沒有目標。先寫下一件這個月想完成的事，再把它拆成幾個任務。', `<button type="button" class="btn primary" data-action="new-goal">${icon('plus')}新增目標</button>`);
    } else if (!goals.length) {
      body = emptyState(ui.filter === 'done' ? '還沒有完成的目標。' : '目前沒有進行中的目標。');
    } else {
      body = areas.map((area, i) => `
        <section class="goal-group" aria-labelledby="ga-${i}">
          <h3 class="group-title" id="ga-${i}">${esc(area || '未分類')}<span class="count">${groups.get(area).length}</span></h3>
          <ul class="goal-list">${groups.get(area).sort(sortGoals).map((g) => goalRow(g, state.tasks, today)).join('')}</ul>
        </section>`).join('');
    }

    return `
    <div class="goals-view">
      <div class="view-toolbar">
        <div class="chips" role="group" aria-label="篩選目標">
          ${FILTERS.map(([v, label]) => `<button type="button" class="chip${ui.filter === v ? ' is-active' : ''}" aria-pressed="${ui.filter === v}" data-action="goal-filter" data-value="${v}">${label}</button>`).join('')}
        </div>
        <button type="button" class="btn primary" data-action="new-goal">${icon('plus')}新增目標</button>
      </div>
      ${body}
    </div>`;
  },

  actions: {
    'goal-filter'(el, e, ctx) {
      ui.filter = el.dataset.value;
      ctx.rerender();
    },
  },

  newTaskDefaults() {
    return {};
  },
};
