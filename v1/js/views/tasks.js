// 任務：新增列、依日期分組的清單、優先度篩選、搜尋
import { esc, todayKey } from '../utils.js';
import { icon } from '../ui.js';
import { store } from '../store.js';
import { isDone } from '../model.js';
import { taskList, emptyState, groupTasks, goalsMap } from '../components.js';

const ui = { prio: 'all', showDone: false, query: '' };
const FILTERS = [['all', '全部'], ['high', '高'], ['medium', '中'], ['low', '低']];

export default {
  render(state) {
    const today = todayKey();
    const goalsById = goalsMap();
    let tasks = state.tasks;
    if (ui.prio !== 'all') tasks = tasks.filter((t) => t.priority === ui.prio);
    if (ui.query) {
      const q = ui.query.toLowerCase();
      tasks = tasks.filter((t) => t.title.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q));
    }
    const doneCount = tasks.filter(isDone).length;
    const groups = groupTasks(tasks, today).filter((g) => g.items.length && (g.id !== 'done' || ui.showDone));
    const filtered = ui.prio !== 'all' || ui.query;

    let body;
    if (groups.length) {
      body = groups.map((g) => `
        <section class="task-group group-${g.id}" aria-labelledby="tg-${g.id}">
          <h3 class="group-title" id="tg-${g.id}">${g.title}<span class="count">${g.items.length}</span></h3>
          ${taskList(g.items, { goalsById, today, showDate: g.id !== 'today' })}
        </section>`).join('');
    } else if (!state.tasks.length) {
      body = emptyState('還沒有任務。在上面輸入第一件要做的事，按 Enter 就會加入。');
    } else if (filtered) {
      body = emptyState('沒有符合的任務。換個篩選條件或關鍵字試試。');
    } else {
      body = emptyState('所有任務都完成了。');
    }

    return `
    <div class="tasks-view">
      <form class="add-bar" data-submit="add-task">
        <input name="title" data-keep="tasks-add" placeholder="新增任務，按 Enter 加入" aria-label="任務名稱" autocomplete="off" maxlength="300">
        <input type="date" name="date" data-keep="tasks-add-date" aria-label="日期（可不填）">
        <select name="priority" data-keep="tasks-add-prio" aria-label="優先度">
          <option value="none">優先度</option><option value="high">高</option><option value="medium">中</option><option value="low">低</option>
        </select>
        <button class="btn primary" type="submit">${icon('plus')}新增</button>
      </form>

      <div class="toolbar">
        <div class="chips" role="group" aria-label="依優先度篩選">
          ${FILTERS.map(([v, label]) => `<button type="button" class="chip${ui.prio === v ? ' is-active' : ''}" aria-pressed="${ui.prio === v}" data-action="task-filter" data-value="${v}">${label}</button>`).join('')}
        </div>
        <label class="switch"><input type="checkbox" data-change="show-done"${ui.showDone ? ' checked' : ''}><span class="switch-track" aria-hidden="true"></span>顯示已完成（${doneCount}）</label>
        <label class="search">${icon('search')}<input type="search" data-input="search" data-keep="tasks-search" value="${esc(ui.query)}" placeholder="搜尋任務" aria-label="搜尋任務"></label>
      </div>

      ${body}
    </div>`;
  },

  actions: {
    'task-filter'(el, e, ctx) {
      ui.prio = el.dataset.value;
      ctx.rerender();
    },
  },

  change: {
    'show-done'(el, e, ctx) {
      ui.showDone = el.checked;
      ctx.rerender();
    },
  },

  input: {
    search(el, e, ctx) {
      ui.query = el.value.trim();
      ctx.rerender();
    },
  },

  submit: {
    'add-task'(form, e, ctx) {
      const f = form.elements;
      const title = f.title.value.trim();
      if (!title) {
        f.title.focus();
        return;
      }
      store.addTask({ title, date: f.date.value, priority: f.priority.value });
      // 只清掉名稱，日期和優先度留著，方便連續新增同一天的任務
      ctx.clearDrafts(form, ['tasks-add']);
      f.title.focus();
    },
  },

  newTaskDefaults() {
    return {};
  },
};
