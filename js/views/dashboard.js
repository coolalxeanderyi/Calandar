// 總覽：今天要做的事、本週任務、今天的習慣、進行中的目標、小月曆
import { esc, todayKey, fmtMonthDay, fmtWeekday, weekKeys, addDays } from '../utils.js';
import { greetFor } from '../greet.js';
import { icon, toast } from '../ui.js';
import { store } from '../store.js';
import {
  isDone, compareTasks, goalProgress, deadlineInfo, activeHabits, isScheduled, listTasks, expandTasks, MOODS,
} from '../model.js';
import {
  taskList, emptyState, habitCheck, progressBar, miniCalendar, goalsMap, eventList, quickAddField, quickPreview, addQuickTask,
} from '../components.js';
import { eventsBetween } from '../gsync.js';
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
    const items = listTasks(state.tasks, today);
    const overdue = items.filter((t) => !isDone(t) && t.date && t.date < today).sort(compareTasks);
    const todays = items.filter((t) => t.date === today).sort(byDoneThenOrder);
    const events = eventsBetween(today, today); // Google 日曆的行程
    const left = overdue.length + todays.filter((t) => !isDone(t)).length;
    const allDone = todays.length > 0 && left === 0;
    const hour = new Date().getHours();
    const mood = allDone ? 'happy' : hour >= 23 || hour < 5 ? 'sleepy' : 'smile';
    const summary = left
      ? `今天有 ${left} 件事要做${events.length ? `、${events.length} 個行程` : ''}，一件一件來就好。`
      : allDone ? '今天的任務都完成了，辛苦了！'
        : events.length ? `今天沒有排任務，有 ${events.length} 個行程。` : '今天沒有排任務，可以喘口氣。';

    const week = weekKeys(today, weekStart);
    const weekTasks = items
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

    const note = state.journal.find((j) => j.id === today) || { mood: 0, text: '' };
    const hi = greetFor(state.settings.userName);

    const miniMonth = ui.miniMonth || today.slice(0, 7);
    const counts = new Map();
    for (const t of expandTasks(state.tasks, `${miniMonth.slice(0, 7)}-01`, `${miniMonth.slice(0, 7)}-31`)) {
      if (!isDone(t)) counts.set(t.date, (counts.get(t.date) || 0) + 1);
    }

    return `
    <div class="dash">
      <header class="dash-head">
        <div class="dash-mascot" aria-hidden="true">${mascot(mood, { size: 88 })}</div>
        <div class="dash-bubble">
          <h2 class="dash-date"><span class="dash-day">${fmtMonthDay(today)}</span><span class="dash-weekday">${fmtWeekday(today)}</span></h2>
          <p class="dash-greet"><span class="greet-emoji" aria-hidden="true">${hi.emoji}</span>${esc(hi.text)}</p>
          <p class="dash-summary">${summary}</p>
        </div>
      </header>
      <div class="dash-grid">
        <div class="dash-main">
          <section class="block" aria-labelledby="b-today">
            <header class="block-head"><h3 id="b-today" class="tape tape-1"><span aria-hidden="true">☀️</span>今天</h3>
              <a class="link-btn" href="#/calendar?d=${today}&amp;mode=day">${icon('clock')}看時間軸</a></header>
            <div class="block-body">
              ${events.length ? `<p class="list-label">Google 日曆的行程</p>${eventList(events, today)}` : ''}
              ${overdue.length ? `<div class="list-label-row"><p class="list-label is-over">逾期 ${overdue.length} 件</p>
                <div class="btn-row"><button type="button" class="btn small" data-action="overdue-move" data-to="today">全部移到今天</button>
                <button type="button" class="btn small ghost" data-action="overdue-move" data-to="tomorrow">全部延到明天</button></div></div>
                ${taskList(overdue, { goalsById, today })}` : ''}
              ${(overdue.length || events.length) && todays.length ? `<p class="list-label">${overdue.length ? '今天' : '今天的任務'}</p>` : ''}
              ${todays.length ? taskList(todays, { goalsById, today, showDate: false }) : overdue.length ? '' : emptyState('今天沒有排任務。')}
              <form class="quick-add" data-submit="quick-add" data-date="${today}">
                ${quickAddField({ keep: 'dash-quick', placeholder: '新增今天的任務，例如：下午3點 家教 #工作', label: '新增今天的任務' })}
                <button class="btn small" type="submit">${icon('plus')}新增</button>
                ${quickPreview('dash-quick')}
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
          <section class="block block-mood" aria-labelledby="b-mood">
            <header class="block-head"><h3 id="b-mood" class="tape tape-4"><span aria-hidden="true">📝</span>今天過得怎樣</h3></header>
            <div class="block-body">
              <div class="mood-picks" role="group" aria-label="今天的心情">
                ${MOODS.map(([v, emoji, label]) => `<button type="button" class="mood-pick${note.mood === v ? ' is-on' : ''}" aria-pressed="${note.mood === v}" data-action="set-mood" data-value="${v}" aria-label="心情：${label}" title="${label}"><span aria-hidden="true">${emoji}</span></button>`).join('')}
              </div>
              <form class="note-line" data-submit="save-note">
                <input name="text" data-keep="dash-note-${today}" data-change="save-note" value="${esc(note.text)}" placeholder="用一句話記下今天" maxlength="300" autocomplete="off" aria-label="今天的一句話">
                <button class="btn small" type="submit">記下來</button>
              </form>
            </div>
          </section>

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
    'set-mood'(el) {
      const today = todayKey();
      const cur = store.state.journal.find((j) => j.id === today);
      const v = Number(el.dataset.value);
      store.saveJournal(today, { mood: cur?.mood === v ? 0 : v });
    },
    'overdue-move'(el) {
      const today = todayKey();
      const target = el.dataset.to === 'tomorrow' ? addDays(today, 1) : today;
      const overdue = listTasks(store.state.tasks, today).filter((t) => !isDone(t) && !t.occ && t.date && t.date < today);
      if (!overdue.length) return;
      const before = store.patchTasks(overdue.map((t) => [t.id, { date: target }]));
      toast(`已把 ${overdue.length} 件逾期的任務移到${target === today ? '今天' : '明天'}`, {
        actionLabel: '復原',
        onAction: () => store.patchTasks(before),
      });
    },
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
      if (!input.value.trim()) return;
      const r = addQuickTask(input.value, { date: form.dataset.date });
      if (r.error) {
        toast(r.error, { tone: 'error' });
        return;
      }
      ctx.clearDrafts(form);
      input.focus();
    },
    'save-note'(form, e, ctx) {
      saveNote(form.elements.text.value);
      ctx.clearDrafts(form);
      form.elements.text.blur();
      toast(form.elements.text.value.trim() ? '已記下今天的一句話' : '已清掉今天的一句話');
    },
  },

  change: {
    'save-note'(el, e, ctx) {
      ctx.forgetDrafts([el.dataset.keep]);
      saveNote(el.value);
    },
  },

  newTaskDefaults() {
    return { date: todayKey() };
  },
};

function saveNote(value) {
  const today = todayKey();
  const text = value.trim().slice(0, 300);
  const cur = store.state.journal.find((j) => j.id === today);
  if ((cur?.text || '') === text) return;
  store.saveJournal(today, { text });
}
