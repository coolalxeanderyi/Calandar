// 總覽：今天要做的事、本週任務、今天的習慣、進行中的目標、小月曆
import { esc, todayKey, fmtMonthDay, fmtWeekday, greeting, weekKeys } from '../utils.js';
import { icon } from '../ui.js';
import { store } from '../store.js';
import {
  isDone, compareTasks, goalProgress, deadlineInfo, activeHabits, isScheduled,
} from '../model.js';
import { taskList, emptyState, habitCheck, progressBar, miniCalendar, goalsMap } from '../components.js';
import { mascot } from '../mascot.js';

const ui = { weekFilter: 'all', miniMonth: null };
const FILTERS = [['all', '全部'], ['high', '高'], ['medium', '中'], ['low', '低']];

function byDoneThenOrder(a, b) {
  return Number(isDone(a)) - Number(isDone(b)) || compareTasks(a, b);
}

export default {
  render(state) {
    const today = todayKey();
    const { weekStart } = state.settings;
    const goalsById = goalsMap();
    const overdue = state.tasks.filter((t) => !isDone(t) && t.date && t.date < today).sort(compareTasks);
    const todays = state.tasks.filter((t) => t.date === today).sort(byDoneThenOrder);
    const left = overdue.length + todays.filter((t) => !isDone(t)).length;
    const allDone = todays.length > 0 && left === 0;
    const hour = new Date().getHours();
    const mood = allDone ? 'happy' : hour >= 23 || hour < 5 ? 'sleepy' : 'smile';
    const summary = left
      ? `今天有 ${left} 件事要做，一件一件來就好。`
      : allDone ? '今天的任務都完成了，辛苦了！' : '今天沒有排任務，可以喘口氣。';

    const week = weekKeys(today, weekStart);
    const weekTasks = state.tasks
      .filter((t) => t.date >= week[0] && t.date <= week[6])
      .filter((t) => ui.weekFilter === 'all' || t.priority === ui.weekFilter)
      .sort(byDoneThenOrder);

    const habits = activeHabits(state.habits);
    const todayHabits = habits.filter((h) => isScheduled(h, today));
    const doneHabits = todayHabits.filter((h) => h.log[today]).length;

    const goals = state.goals
      .filter((g) => g.status === 'active')
      .sort((a, b) => (a.deadline || '9999') .localeCompare(b.deadline || '9999') || a.createdAt - b.createdAt)
      .slice(0, 4);

    const counts = new Map();
    for (const t of state.tasks) if (t.date && !isDone(t)) counts.set(t.date, (counts.get(t.date) || 0) + 1);
    const miniMonth = ui.miniMonth || today.slice(0, 7);

    return `
    <div class="dash">
      <header class="dash-head">
        <div class="dash-mascot" aria-hidden="true">${mascot(mood, { size: 88 })}</div>
        <div class="dash-bubble">
          <h2 class="dash-date"><span class="dash-day">${fmtMonthDay(today)}</span><span class="dash-weekday">${fmtWeekday(today)}</span></h2>
          <p class="dash-summary">${greeting()}！${summary}</p>
        </div>
      </header>
      <div class="dash-grid">
        <div class="dash-main">
          <section class="block" aria-labelledby="b-today">
            <header class="block-head"><h3 id="b-today" class="tape tape-1"><span aria-hidden="true">☀️</span>今天</h3></header>
            <div class="block-body">
              ${overdue.length ? `<p class="list-label is-over">逾期 ${overdue.length} 件</p>${taskList(overdue, { goalsById, today })}` : ''}
              ${overdue.length && todays.length ? '<p class="list-label">今天</p>' : ''}
              ${todays.length ? taskList(todays, { goalsById, today, showDate: false }) : overdue.length ? '' : emptyState('今天沒有排任務。')}
              <form class="quick-add" data-submit="quick-add" data-date="${today}">
                <input name="title" data-keep="dash-quick" placeholder="新增今天的任務，按 Enter 加入" autocomplete="off" aria-label="新增今天的任務" maxlength="300">
                <button class="btn small" type="submit">${icon('plus')}新增</button>
              </form>
            </div>
          </section>

          <section class="block" aria-labelledby="b-week">
            <header class="block-head">
              <h3 id="b-week" class="tape tape-2"><span aria-hidden="true">🗓️</span>本週任務</h3>
              <div class="chips" role="group" aria-label="依優先度篩選">
                ${FILTERS.map(([v, label]) => `<button type="button" class="chip${ui.weekFilter === v ? ' is-active' : ''}" aria-pressed="${ui.weekFilter === v}" data-action="dash-filter" data-value="${v}">${label}</button>`).join('')}
              </div>
            </header>
            <div class="block-body">
              ${weekTasks.length ? taskList(weekTasks, { goalsById, today }) : emptyState(ui.weekFilter === 'all' ? '這週還沒有排任務。' : '這週沒有這個優先度的任務。')}
            </div>
          </section>
        </div>

        <aside class="dash-side">
          <section class="block" aria-labelledby="b-habits">
            <header class="block-head">
              <h3 id="b-habits" class="tape tape-3"><span aria-hidden="true">🌱</span>今天的習慣</h3>
              ${todayHabits.length ? `<span class="block-count">${doneHabits} / ${todayHabits.length}</span>` : ''}
            </header>
            <div class="block-body">
              ${todayHabits.length
                ? `<ul class="habit-lines">${todayHabits.map((h) => `
                  <li class="habit-line${h.log[today] ? ' is-on' : ''}">
                    <button type="button" class="habit-line-main" data-action="open-habit" data-id="${esc(h.id)}">
                      <span class="habit-emoji" aria-hidden="true">${esc(h.emoji)}</span><span class="habit-name">${esc(h.name)}</span>
                    </button>
                    ${habitCheck(h, today)}
                  </li>`).join('')}</ul>`
                : habits.length
                  ? emptyState('今天沒有排定的習慣。')
                  : emptyState('還沒有習慣。', `<button type="button" class="btn small" data-action="new-habit">${icon('plus')}新增習慣</button>`)}
            </div>
          </section>

          <section class="block" aria-labelledby="b-goals">
            <header class="block-head">
              <h3 id="b-goals" class="tape tape-4"><span aria-hidden="true">🎯</span>進行中的目標</h3>
              ${goals.length ? '<a class="block-link" href="#/goals">全部</a>' : ''}
            </header>
            <div class="block-body">
              ${goals.length
                ? `<ul class="goal-minis">${goals.map((g, i) => {
                  const { pct } = goalProgress(g, state.tasks);
                  const due = deadlineInfo(g.deadline, today);
                  return `<li><button type="button" class="goal-mini" data-action="open-goal" data-id="${esc(g.id)}">
                    <span class="goal-mini-top"><span class="goal-mini-title">${esc(g.emoji)} ${esc(g.title)}</span><span class="goal-mini-pct">${pct}%</span></span>
                    ${progressBar(pct, `${g.title} 的進度`, i)}
                    <span class="goal-mini-due tone-${due.tone}">${due.text}</span>
                  </button></li>`;
                }).join('')}</ul>`
                : emptyState('還沒有目標。', `<button type="button" class="btn small" data-action="new-goal">${icon('plus')}新增目標</button>`)}
            </div>
          </section>

          <section class="block block-cal" aria-label="月曆">
            <div class="block-body">${miniCalendar(`${miniMonth}-01`, { weekStart, today, counts })}</div>
          </section>
        </aside>
      </div>
    </div>`;
  },

  actions: {
    'dash-filter'(el, e, ctx) {
      ui.weekFilter = el.dataset.value;
      ctx.rerender();
    },
    'mini-month'(el, e, ctx) {
      const [y, m] = (ui.miniMonth || todayKey().slice(0, 7)).split('-').map(Number);
      const d = new Date(y, m - 1 + Number(el.dataset.step), 1);
      ui.miniMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      ctx.rerender();
    },
  },

  submit: {
    'quick-add'(form, e, ctx) {
      const input = form.elements.title;
      const title = input.value.trim();
      if (!title) return;
      store.addTask({ title, date: form.dataset.date });
      ctx.clearDrafts(form);
      input.focus();
    },
  },

  newTaskDefaults() {
    return { date: todayKey() };
  },
};
