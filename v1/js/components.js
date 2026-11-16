// 各畫面共用的區塊：任務列、進度條、習慣打卡鈕、小月曆，以及新增／編輯的對話框
import {
  esc, todayKey, relativeDay, diffDays, fmtMonthDay, fmtYearMonth, WEEKDAYS,
  orderedWeekdays, monthGrid, monthKey,
} from './utils.js';
import { icon, openModal, confirmDialog, fieldError, toast } from './ui.js';
import { store } from './store.js';
import {
  PRIORITY_LABEL, goalProgress, isDone, AREA_SUGGESTIONS, ALL_DAYS, isChecked, compareTasks,
} from './model.js';

// ---------- 小元件 ----------
export function segRadio(name, options, value, label) {
  return `<div class="seg" role="radiogroup" aria-label="${esc(label || '')}">${options
    .map(([v, text]) => `<label class="seg-opt"><input type="radio" name="${name}" value="${esc(v)}" ${String(v) === String(value) ? 'checked' : ''}><span>${esc(text)}</span></label>`)
    .join('')}</div>`;
}

export function progressBar(pct, label = '進度') {
  return `<div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(label)}"><span style="width:${pct}%"></span></div>`;
}

export function emptyState(text, actionHTML = '') {
  return `<div class="empty"><p>${esc(text)}</p>${actionHTML}</div>`;
}

export function taskRow(task, { goalsById = new Map(), today = todayKey(), showDate = true } = {}) {
  const done = isDone(task);
  const overdue = !done && task.date && task.date < today;
  const goal = task.goalId ? goalsById.get(task.goalId) : null;
  const tags = [];
  if (task.status === 'doing') tags.push('<span class="tag tag-doing">進行中</span>');
  if (showDate && task.date) {
    tags.push(`<span class="tag tag-date${overdue ? ' is-over' : ''}">${relativeDay(task.date, today)}${task.time ? ` ${task.time}` : ''}</span>`);
  } else if (task.time) {
    tags.push(`<span class="tag tag-date">${task.time}</span>`);
  }
  if (task.priority !== 'none') {
    tags.push(`<span class="tag tag-prio prio-${task.priority}"><i class="dot" aria-hidden="true"></i>${PRIORITY_LABEL[task.priority]}</span>`);
  }
  if (goal) tags.push(`<span class="tag tag-goal">${esc(goal.emoji)} ${esc(goal.title)}</span>`);
  if (task.notes) tags.push('<span class="tag tag-note" title="有備註">備註</span>');

  return `<li class="task prio-${task.priority}${done ? ' is-done' : ''}" data-id="${esc(task.id)}">
    <button type="button" class="check" role="checkbox" aria-checked="${done}" data-action="toggle-task" data-id="${esc(task.id)}" aria-label="${done ? '標記為未完成' : '完成'}：${esc(task.title)}">${icon('check')}</button>
    <button type="button" class="task-main" data-action="open-task" data-id="${esc(task.id)}">
      <span class="task-title">${esc(task.title)}</span>
      ${tags.length ? `<span class="task-tags">${tags.join('')}</span>` : ''}
    </button>
  </li>`;
}

export function taskList(tasks, opts) {
  return `<ul class="task-list">${tasks.map((t) => taskRow(t, opts)).join('')}</ul>`;
}

export function habitCheck(habit, key, extraClass = '') {
  const on = isChecked(habit, key);
  return `<button type="button" class="habit-check${on ? ' is-on' : ''} ${extraClass}" role="checkbox" aria-checked="${on}" data-action="toggle-habit" data-id="${esc(habit.id)}" data-date="${key}" aria-label="${esc(habit.name)}，${fmtMonthDay(key)}">${icon('check')}</button>`;
}

export function goalsMap() {
  return new Map(store.state.goals.map((g) => [g.id, g]));
}

// 小月曆（總覽頁右側）
export function miniCalendar(viewKey, { weekStart, today, counts }) {
  const [y, m] = viewKey.split('-').map(Number);
  const weeks = monthGrid(y, m - 1, weekStart);
  const head = orderedWeekdays(weekStart)
    .map((d) => `<span class="mini-wd${d === 0 ? ' is-sun' : ''}" aria-hidden="true">${WEEKDAYS[d]}</span>`)
    .join('');
  const cells = weeks.flat().map((key) => {
    const n = counts.get(key) || 0;
    const other = monthKey(key) !== viewKey.slice(0, 7);
    const cls = ['mini-day', other ? 'is-other' : '', key === today ? 'is-today' : '', n ? 'has-tasks' : ''].join(' ');
    return `<a class="${cls}" href="#/calendar?d=${key}" aria-label="${fmtMonthDay(key)}${n ? `，${n} 個未完成任務` : ''}">${Number(key.slice(8))}</a>`;
  }).join('');
  return `<div class="mini-cal">
    <div class="mini-cal-head">
      <button type="button" class="icon-btn small" data-action="mini-month" data-step="-1" aria-label="上個月">${icon('left')}</button>
      <span class="mini-cal-title">${fmtYearMonth(y, m - 1)}</span>
      <button type="button" class="icon-btn small" data-action="mini-month" data-step="1" aria-label="下個月">${icon('right')}</button>
    </div>
    <div class="mini-cal-grid">${head}${cells}</div>
  </div>`;
}

const GOAL_EMOJIS = ['🎯', '📚', '💼', '💪', '💰', '🎬', '✈️', '🏠'];
const HABIT_EMOJIS = ['💧', '📖', '🏃', '🧘', '😴', '🥗', '✍️', '🎸'];

function emojiField(id, value, choices, label = '圖示') {
  return `<div class="field field-emoji">
    <label for="${id}">${label}</label>
    <input id="${id}" name="emoji" value="${esc(value)}" maxlength="8" autocomplete="off" class="emoji-input">
    <div class="emoji-picks" role="group" aria-label="常用圖示">${choices.map((e) => `<button type="button" class="emoji-pick" data-emoji="${e}" aria-label="使用 ${e}">${e}</button>`).join('')}</div>
  </div>`;
}

function bindEmojiPicks(form) {
  form.addEventListener('click', (e) => {
    const b = e.target.closest('.emoji-pick');
    if (!b) return;
    e.preventDefault();
    form.elements.emoji.value = b.dataset.emoji;
  });
}

// ---------- 任務 ----------
export function deleteTaskWithUndo(id) {
  const doc = store.removeTask(id);
  if (doc) toast('已刪除任務', { actionLabel: '復原', onAction: () => store.restore('tasks', doc) });
}

export function openTaskModal(task = null, defaults = {}) {
  const t = task || { title: '', notes: '', date: '', time: '', priority: 'none', status: 'todo', goalId: '', ...defaults };
  const goals = store.state.goals.filter((g) => g.status !== 'done' || g.id === t.goalId);
  const body = `
    <div class="field"><label for="tm-title">任務名稱</label>
      <input id="tm-title" name="title" value="${esc(t.title)}" maxlength="300" autocomplete="off" autofocus placeholder="例如：準備週三的課"></div>
    <div class="field-row">
      <div class="field"><label for="tm-date">日期</label><input id="tm-date" type="date" name="date" value="${esc(t.date)}"></div>
      <div class="field"><label for="tm-time">時間</label><input id="tm-time" type="time" name="time" value="${esc(t.time)}"></div>
    </div>
    <fieldset class="field"><legend>優先度</legend>${segRadio('priority', [['none', '無'], ['low', '低'], ['medium', '中'], ['high', '高']], t.priority, '優先度')}</fieldset>
    <fieldset class="field"><legend>狀態</legend>${segRadio('status', [['todo', '待辦'], ['doing', '進行中'], ['done', '完成']], t.status, '狀態')}</fieldset>
    <div class="field"><label for="tm-goal">屬於哪個目標</label>
      <select id="tm-goal" name="goalId"><option value="">不屬於任何目標</option>${goals
        .map((g) => `<option value="${esc(g.id)}"${g.id === t.goalId ? ' selected' : ''}>${esc(g.emoji)} ${esc(g.title)}</option>`)
        .join('')}</select></div>
    <div class="field"><label for="tm-notes">備註</label><textarea id="tm-notes" name="notes" rows="3">${esc(t.notes)}</textarea></div>`;

  openModal({
    title: task ? '編輯任務' : '新增任務',
    body,
    submitLabel: task ? '儲存' : '新增任務',
    extra: task ? [{ label: '刪除', icon: 'trash', className: 'ghost danger-text', onClick: () => deleteTaskWithUndo(task.id) }] : [],
    onSubmit(form) {
      const f = form.elements;
      const data = {
        title: f.title.value.trim(),
        date: f.date.value,
        time: f.time.value,
        priority: f.priority.value || 'none',
        status: f.status.value || 'todo',
        goalId: f.goalId.value,
        notes: f.notes.value.trim(),
      };
      if (!data.title) {
        fieldError(form, 'title', '請輸入任務名稱');
        return false;
      }
      if (task) {
        if (data.status === 'done' && task.status !== 'done') data.doneAt = Date.now();
        if (data.status !== 'done') data.doneAt = null;
        store.updateTask(task.id, data);
        toast('已儲存');
      } else {
        store.addTask({ ...data, doneAt: data.status === 'done' ? Date.now() : null });
        toast('已新增任務');
      }
      return true;
    },
  });
}

// ---------- 目標 ----------
export function openGoalModal(goal = null) {
  const g = goal || { title: '', why: '', area: '', emoji: '🎯', deadline: '', status: 'active', progressMode: 'tasks', progress: 0 };
  const areas = [...new Set([...AREA_SUGGESTIONS, ...store.state.goals.map((x) => x.area).filter(Boolean)])];
  const body = `
    <div class="field-row emoji-row">
      ${emojiField('gm-emoji', g.emoji, GOAL_EMOJIS)}
      <div class="field grow"><label for="gm-title">目標</label>
        <input id="gm-title" name="title" value="${esc(g.title)}" maxlength="300" autocomplete="off" autofocus placeholder="例如：TOEIC 考到 750"></div>
    </div>
    <div class="field-row">
      <div class="field"><label for="gm-area">領域</label>
        <input id="gm-area" name="area" list="gm-areas" value="${esc(g.area)}" maxlength="40" placeholder="例如：學習" autocomplete="off">
        <datalist id="gm-areas">${areas.map((a) => `<option value="${esc(a)}">`).join('')}</datalist></div>
      <div class="field"><label for="gm-deadline">期限</label><input id="gm-deadline" type="date" name="deadline" value="${esc(g.deadline)}"></div>
    </div>
    <div class="field"><label for="gm-why">為什麼想完成</label><textarea id="gm-why" name="why" rows="2" placeholder="寫下動機，卡關的時候回來看">${esc(g.why)}</textarea></div>
    <fieldset class="field"><legend>進度怎麼算</legend>
      ${segRadio('progressMode', [['tasks', '依任務完成比例'], ['manual', '自己調整']], g.progressMode, '進度怎麼算')}
      <div class="manual-progress"${g.progressMode === 'manual' ? '' : ' hidden'}>
        <input type="range" name="progress" min="0" max="100" step="5" value="${g.progress}" aria-label="目前進度">
        <output class="manual-progress-value">${g.progress}%</output>
      </div>
    </fieldset>
    <fieldset class="field"><legend>狀態</legend>${segRadio('status', [['active', '進行中'], ['paused', '暫停'], ['done', '已完成']], g.status, '狀態')}</fieldset>
    ${goal ? `<section class="goal-tasks" aria-labelledby="gm-tasks-title">
        <h3 id="gm-tasks-title" class="sub-title">相關任務</h3>
        <div data-goal-tasks></div>
        <div class="inline-add">
          <input name="newTask" placeholder="新增一個步驟，按 Enter 加入" autocomplete="off" aria-label="新增相關任務">
          <button type="button" class="btn small" data-goal-add>${icon('plus')}新增</button>
        </div>
      </section>` : '<p class="hint">建立目標之後，可以把任務連到這個目標，進度會依完成的任務自動計算。</p>'}`;

  let unsubscribe = null;
  openModal({
    title: goal ? '編輯目標' : '新增目標',
    body,
    size: 'lg',
    submitLabel: goal ? '儲存' : '新增目標',
    extra: goal ? [{ label: '刪除', icon: 'trash', className: 'ghost danger-text', closes: false, onClick: (form, close) => { deleteGoalFlow(goal, close); return false; } }] : [],
    onOpen(form) {
      bindEmojiPicks(form);
      const manual = form.querySelector('.manual-progress');
      const out = form.querySelector('.manual-progress-value');
      form.addEventListener('change', (e) => {
        if (e.target.name === 'progressMode') manual.hidden = e.target.value !== 'manual';
      });
      form.addEventListener('input', (e) => {
        if (e.target.name === 'progress') out.textContent = `${e.target.value}%`;
      });
      if (!goal) return;
      const holder = form.querySelector('[data-goal-tasks]');
      const render = () => {
        const tasks = store.state.tasks.filter((t) => t.goalId === goal.id)
          .sort((a, b) => Number(isDone(a)) - Number(isDone(b)) || compareTasks(a, b));
        const current = store.state.goals.find((x) => x.id === goal.id) || goal;
        const { pct, done, total } = goalProgress(current, store.state.tasks);
        holder.innerHTML = tasks.length
          ? `<p class="goal-tasks-summary">完成 ${done} / ${total}，進度 ${pct}%</p>${taskList(tasks, { goalsById: new Map() })}`
          : '<p class="hint">還沒有相關任務。把目標拆成幾個小步驟，加在下面。</p>';
      };
      render();
      unsubscribe = store.subscribe(render);
      const input = form.elements.newTask;
      const add = () => {
        const title = input.value.trim();
        if (!title) return;
        store.addTask({ title, goalId: goal.id });
        input.value = '';
        input.focus();
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          add();
        }
      });
      form.querySelector('[data-goal-add]').addEventListener('click', add);
    },
    onClose: () => unsubscribe?.(),
    onSubmit(form) {
      const f = form.elements;
      const data = {
        emoji: f.emoji.value.trim() || '🎯',
        title: f.title.value.trim(),
        area: f.area.value.trim(),
        deadline: f.deadline.value,
        why: f.why.value.trim(),
        progressMode: f.progressMode.value || 'tasks',
        progress: Number(f.progress.value) || 0,
        status: f.status.value || 'active',
      };
      if (!data.title) {
        fieldError(form, 'title', '請輸入目標');
        return false;
      }
      if (goal) {
        if (data.status === 'done' && goal.status !== 'done') data.doneAt = Date.now();
        if (data.status !== 'done') data.doneAt = null;
        store.updateGoal(goal.id, data);
        toast('已儲存');
      } else {
        store.addGoal(data);
        toast('已新增目標');
      }
      return true;
    },
  });
}

async function deleteGoalFlow(goal, closeModal) {
  const linked = store.state.tasks.filter((t) => t.goalId === goal.id).length;
  const ok = await confirmDialog(
    linked ? `相關的 ${linked} 個任務會保留，只是不再屬於這個目標。` : '刪除後可以在提示訊息裡按「復原」。',
    { title: `刪除目標「${goal.title}」？`, confirmLabel: '刪除目標', danger: true },
  );
  if (!ok) return;
  closeModal();
  const { goal: removed, taskIds } = store.removeGoal(goal.id);
  toast('已刪除目標', {
    actionLabel: '復原',
    onAction: () => {
      store.restore('goals', removed);
      store.relinkTasks(taskIds, removed.id);
    },
  });
}

// ---------- 習慣 ----------
export function openHabitModal(habit = null) {
  const weekStart = store.state.settings.weekStart;
  const h = habit || { name: '', emoji: '💧', days: [...ALL_DAYS], archived: false };
  const body = `
    <div class="field-row emoji-row">
      ${emojiField('hm-emoji', h.emoji, HABIT_EMOJIS)}
      <div class="field grow"><label for="hm-name">習慣</label>
        <input id="hm-name" name="name" value="${esc(h.name)}" maxlength="120" autocomplete="off" autofocus placeholder="例如：喝 8 杯水"></div>
    </div>
    <fieldset class="field"><legend>哪幾天要做</legend>
      <div class="day-picks">${orderedWeekdays(weekStart)
        .map((d) => `<label class="day-pick"><input type="checkbox" name="days" value="${d}"${h.days.includes(d) ? ' checked' : ''}><span>${WEEKDAYS[d]}</span></label>`)
        .join('')}</div>
      <div class="day-presets">
        <button type="button" class="link-btn" data-days="0,1,2,3,4,5,6">每天</button>
        <button type="button" class="link-btn" data-days="1,2,3,4,5">平日</button>
        <button type="button" class="link-btn" data-days="0,6">週末</button>
      </div>
    </fieldset>
    ${habit?.archived ? '<p class="hint">這個習慣已封存，不會出現在每日打卡裡。</p>' : ''}`;

  const extra = [];
  if (habit) {
    extra.push({
      label: habit.archived ? '恢復' : '封存',
      className: 'ghost',
      onClick: () => {
        store.updateHabit(habit.id, { archived: !habit.archived });
        toast(habit.archived ? '已恢復習慣' : '已封存習慣');
      },
    });
    extra.push({
      label: '刪除',
      icon: 'trash',
      className: 'ghost danger-text',
      closes: false,
      onClick: (form, close) => {
        confirmDialog('打卡紀錄也會一起刪除。不想再看到它的話，可以改用「封存」。', {
          title: `刪除習慣「${habit.name}」？`,
          confirmLabel: '刪除習慣',
          danger: true,
        }).then((ok) => {
          if (!ok) return;
          close();
          const doc = store.removeHabit(habit.id);
          toast('已刪除習慣', { actionLabel: '復原', onAction: () => store.restore('habits', doc) });
        });
        return false;
      },
    });
  }

  openModal({
    title: habit ? '編輯習慣' : '新增習慣',
    body,
    submitLabel: habit ? '儲存' : '新增習慣',
    extra,
    onOpen(form) {
      bindEmojiPicks(form);
      form.addEventListener('click', (e) => {
        const b = e.target.closest('[data-days]');
        if (!b) return;
        e.preventDefault();
        const set = b.dataset.days.split(',').map(Number);
        for (const box of form.querySelectorAll('input[name="days"]')) box.checked = set.includes(Number(box.value));
      });
    },
    onSubmit(form) {
      const name = form.elements.name.value.trim();
      const days = [...form.querySelectorAll('input[name="days"]:checked')].map((b) => Number(b.value));
      if (!name) {
        fieldError(form, 'name', '請輸入習慣名稱');
        return false;
      }
      if (!days.length) {
        const fs = form.querySelector('.day-picks').closest('fieldset');
        fs.querySelector('.field-error')?.remove();
        fs.insertAdjacentHTML('beforeend', '<p class="field-error" role="alert">至少選一天</p>');
        return false;
      }
      const data = { name, days, emoji: form.elements.emoji.value.trim() || '✅' };
      if (habit) {
        store.updateHabit(habit.id, data);
        toast('已儲存');
      } else {
        store.addHabit(data);
        toast('已新增習慣');
      }
      return true;
    },
  });
}

// 依「逾期／今天／明天…」把任務分組
export function groupTasks(tasks, today = todayKey()) {
  const groups = [
    { id: 'overdue', title: '逾期', items: [] },
    { id: 'today', title: '今天', items: [] },
    { id: 'tomorrow', title: '明天', items: [] },
    { id: 'week', title: '接下來 7 天', items: [] },
    { id: 'later', title: '之後', items: [] },
    { id: 'nodate', title: '沒有日期', items: [] },
    { id: 'done', title: '已完成', items: [] },
  ];
  const byId = Object.fromEntries(groups.map((g) => [g.id, g]));
  for (const t of tasks) {
    if (isDone(t)) byId.done.items.push(t);
    else if (!t.date) byId.nodate.items.push(t);
    else {
      const n = diffDays(today, t.date);
      if (n < 0) byId.overdue.items.push(t);
      else if (n === 0) byId.today.items.push(t);
      else if (n === 1) byId.tomorrow.items.push(t);
      else if (n <= 7) byId.week.items.push(t);
      else byId.later.items.push(t);
    }
  }
  for (const g of groups) g.items.sort(compareTasks);
  byId.done.items.sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  return groups;
}
