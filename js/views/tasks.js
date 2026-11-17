// 任務：新增列、依日期分組的清單或看板、優先度和標籤篩選、搜尋
import { esc, todayKey, relativeDay } from '../utils.js';
import { icon, toast } from '../ui.js';
import { store } from '../store.js';
import { isDone, listTasks, isRepeating, PRIORITY_LABEL, checklistProgress, compareTasks } from '../model.js';
import { taskList, emptyState, groupTasks, goalsMap, quickAddField, quickPreview, addQuickTask } from '../components.js';
import { tagMap, tagsOf, tagChip, tagFilterBar } from '../tags.js';

const MODE_KEY = 'planner.tasks.mode';
const readMode = () => {
  try {
    return localStorage.getItem(MODE_KEY) === 'board' ? 'board' : 'list';
  } catch {
    return 'list';
  }
};
const ui = { prio: 'all', tag: '', showDone: false, query: '', mode: readMode() };
const FILTERS = [['all', '全部'], ['high', '高'], ['medium', '中'], ['low', '低']];
const COLUMNS = [['todo', '待辦', '📋'], ['doing', '進行中', '🏃'], ['done', '完成', '✅']];
const DONE_LIMIT = 30;

function boardCard(t, { goalsById, tagsById, today, col }) {
  const overdue = col !== 'done' && t.date && t.date < today;
  const goal = t.goalId ? goalsById.get(t.goalId) : null;
  const meta = [];
  if (t.date) meta.push(`<span class="tag tag-date${overdue ? ' is-over' : ''}">${relativeDay(t.date, today)}${t.time ? ` ${t.time}` : ''}</span>`);
  if (t.priority !== 'none') meta.push(`<span class="tag tag-prio prio-${t.priority}"><i class="dot" aria-hidden="true"></i>${PRIORITY_LABEL[t.priority]}</span>`);
  const list = checklistProgress(t);
  if (list.total) meta.push(`<span class="tag tag-check${list.done === list.total ? ' is-full' : ''}">☑ ${list.done}/${list.total}</span>`);
  if (goal) meta.push(`<span class="tag tag-goal">${esc(goal.emoji)} ${esc(goal.title)}</span>`);
  for (const tag of tagsOf(t, tagsById)) meta.push(tagChip(tag));
  const i = COLUMNS.findIndex(([id]) => id === col);
  const prev = COLUMNS[i - 1];
  const next = COLUMNS[i + 1];
  return `<li class="board-card prio-${t.priority}${col === 'done' ? ' is-done' : ''}" draggable="true" data-drag-task="${esc(t.id)}" data-id="${esc(t.id)}">
    <button type="button" class="board-open" data-action="open-task" data-id="${esc(t.id)}"><span class="task-title">${esc(t.title)}</span></button>
    ${meta.length ? `<span class="task-tags">${meta.join('')}</span>` : ''}
    <span class="board-move">
      ${prev ? `<button type="button" class="icon-btn small" data-action="board-move" data-id="${esc(t.id)}" data-to="${prev[0]}" aria-label="把「${esc(t.title)}」移到${prev[1]}">${icon('left')}</button>` : ''}
      ${next ? `<button type="button" class="icon-btn small" data-action="board-move" data-id="${esc(t.id)}" data-to="${next[0]}" aria-label="把「${esc(t.title)}」移到${next[1]}">${icon('right')}</button>` : ''}
    </span>
  </li>`;
}

function boardHTML(tasks, ctx) {
  const plain = tasks.filter((t) => !isRepeating(t));
  const repeating = tasks.filter((t) => isRepeating(t) && !t.occ).length;
  const cols = COLUMNS.map(([id, name, emoji]) => {
    let items = plain.filter((t) => t.status === id);
    let more = 0;
    if (id === 'done') {
      items.sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
      more = Math.max(0, items.length - DONE_LIMIT);
      items = items.slice(0, DONE_LIMIT);
    } else {
      items.sort(compareTasks);
    }
    return `<section class="board-col col-${id}" data-drop-status="${id}" aria-labelledby="bc-${id}">
      <h3 class="board-title" id="bc-${id}"><span aria-hidden="true">${emoji}</span>${name}<span class="count">${items.length + more}</span></h3>
      ${items.length ? `<ul class="board-list">${items.map((t) => boardCard(t, { ...ctx, col: id })).join('')}</ul>` : `<p class="board-empty">${id === 'doing' ? '把正在做的任務拖到這裡' : id === 'done' ? '完成的任務會在這裡' : '沒有待辦的任務'}</p>`}
      ${more ? `<p class="board-more">只顯示最近完成的 ${DONE_LIMIT} 件</p>` : ''}
    </section>`;
  }).join('');
  return `<div class="board" data-board>${cols}</div>
    ${repeating ? `<p class="hint board-note">重複的任務不會出現在看板上（${repeating} 個），請在清單裡看。</p>` : ''}`;
}

export default {
  render(state) {
    const today = todayKey();
    const goalsById = goalsMap();
    const tagsById = tagMap();
    if (ui.tag && !tagsById.has(ui.tag)) ui.tag = ''; // 標籤被刪掉了
    const board = ui.mode === 'board';
    // 看板用任務本身（不展開重複任務），清單用今天看得到的那一次
    let tasks = board ? state.tasks.slice() : listTasks(state.tasks, today);
    if (ui.prio !== 'all') tasks = tasks.filter((t) => t.priority === ui.prio);
    if (ui.tag) tasks = tasks.filter((t) => t.tags.includes(ui.tag));
    if (ui.query) {
      // 名稱、備註、小清單、所屬目標、標籤都會找
      const q = ui.query.toLowerCase();
      const has = (text) => (text || '').toLowerCase().includes(q);
      tasks = tasks.filter((t) => has(t.title) || has(t.notes) || t.checklist.some((i) => has(i.text)) || has(goalsById.get(t.goalId)?.title)
        || tagsOf(t, tagsById).some((g) => has(g.name)));
    }
    const filtered = ui.prio !== 'all' || ui.query || ui.tag;

    let body;
    if (board) {
      body = state.tasks.length ? boardHTML(tasks, { goalsById, tagsById, today }) : emptyState('還沒有任務。在上面輸入第一件要做的事，按 Enter 就會加入。');
    } else {
      const groups = groupTasks(tasks, today).filter((g) => g.items.length && (g.id !== 'done' || ui.showDone));
      if (groups.length) {
        body = groups.map((g) => `
        <section class="task-group group-${g.id}" aria-labelledby="tg-${g.id}">
          <h3 class="group-title" id="tg-${g.id}"><span class="group-emoji" aria-hidden="true">${g.emoji}</span>${g.title}<span class="count">${g.items.length}</span></h3>
          ${taskList(g.items, { goalsById, tagsById, today, showDate: g.id !== 'today' })}
        </section>`).join('');
      } else if (!state.tasks.length) {
        body = emptyState('還沒有任務。在上面輸入第一件要做的事，按 Enter 就會加入。');
      } else if (filtered) {
        body = emptyState('沒有符合的任務。換個篩選條件或關鍵字試試。');
      } else {
        body = emptyState('所有任務都完成了。');
      }
    }
    const doneCount = board ? 0 : tasks.filter(isDone).length;

    return `
    <div class="tasks-view${board ? ' is-board' : ''}">
      <form class="add-bar" data-submit="add-task">
        ${quickAddField({ keep: 'tasks-add', placeholder: '新增任務，例如：明天下午3點 家教 #工作', label: '任務名稱' })}
        <input type="date" name="date" data-keep="tasks-add-date" aria-label="日期（可不填）">
        <select name="priority" data-keep="tasks-add-prio" aria-label="優先度">
          <option value="none">優先度</option><option value="high">高</option><option value="medium">中</option><option value="low">低</option>
        </select>
        <button class="btn primary" type="submit">${icon('plus')}新增</button>
        ${quickPreview('tasks-add')}
      </form>

      <div class="toolbar">
        <div class="seg seg-buttons" role="group" aria-label="顯示方式">
          <button type="button" class="seg-btn${board ? '' : ' is-on'}" aria-pressed="${!board}" data-action="task-mode" data-value="list">${icon('list')}清單</button>
          <button type="button" class="seg-btn${board ? ' is-on' : ''}" aria-pressed="${board}" data-action="task-mode" data-value="board">${icon('board')}看板</button>
        </div>
        <div class="chips" role="group" aria-label="依優先度篩選">
          ${FILTERS.map(([v, label]) => `<button type="button" class="chip${ui.prio === v ? ' is-active' : ''}" aria-pressed="${ui.prio === v}" data-action="task-filter" data-value="${v}">${label}</button>`).join('')}
        </div>
        ${board ? '' : `<label class="switch"><input type="checkbox" data-change="show-done"${ui.showDone ? ' checked' : ''}><span class="switch-track" aria-hidden="true"></span>顯示已完成（${doneCount}）</label>`}
        <label class="search">${icon('search')}<input type="search" data-input="search" data-keep="tasks-search" value="${esc(ui.query)}" placeholder="搜尋任務（按 / ）" aria-label="搜尋任務"></label>
      </div>
      ${tagFilterBar(ui.tag, 'task-tag')}

      ${body}
    </div>`;
  },

  actions: {
    'task-filter'(el, e, ctx) {
      ui.prio = el.dataset.value;
      ctx.rerender();
    },
    'task-tag'(el, e, ctx) {
      ui.tag = ui.tag === el.dataset.value ? '' : el.dataset.value;
      ctx.rerender();
    },
    'task-mode'(el, e, ctx) {
      ui.mode = el.dataset.value === 'board' ? 'board' : 'list';
      try {
        localStorage.setItem(MODE_KEY, ui.mode);
      } catch { /* 無痕模式 */ }
      ctx.rerender();
    },
    'board-move'(el) {
      moveTo(el.dataset.id, el.dataset.to);
      // 移動之後，焦點留在同一張卡片上
      requestAnimationFrame(() => {
        const card = document.querySelector(`.board-card[data-id="${CSS.escape(el.dataset.id)}"]`);
        (card?.querySelector(`[data-action="board-move"][data-to]`) || card?.querySelector('.board-open'))?.focus({ preventScroll: true });
      });
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
      if (!f.title.value.trim()) {
        f.title.focus();
        return;
      }
      const r = addQuickTask(f.title.value, { date: f.date.value, priority: f.priority.value });
      if (r.error) {
        toast(r.error, { tone: 'error' });
        f.title.focus();
        return;
      }
      // 只清掉名稱，日期和優先度留著，方便連續新增同一天的任務
      ctx.clearDrafts(form, ['tasks-add']);
      form.querySelector('[data-qa-preview]').textContent = '';
      f.title.focus();
    },
  },

  newTaskDefaults() {
    return ui.tag ? { tags: [ui.tag] } : {};
  },
};

// 看板：換欄位＝換狀態
export function moveTo(id, status) {
  const t = store.state.tasks.find((x) => x.id === id);
  if (!t || isRepeating(t) || !COLUMNS.some(([c]) => c === status) || t.status === status) return false;
  store.updateTask(id, { status, doneAt: status === 'done' ? Date.now() : null });
  const name = COLUMNS.find(([c]) => c === status)[1];
  toast(`「${t.title}」移到${name}`);
  return true;
}
