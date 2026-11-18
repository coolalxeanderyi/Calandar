// 各畫面共用的區塊：任務列、進度條、習慣打卡鈕、小月曆，以及新增／編輯的對話框
import {
  esc, todayKey, relativeDay, diffDays, fmtMonthDay, fmtWeekday, fmtYearMonth, WEEKDAYS,
  orderedWeekdays, monthGrid, monthKey, uid, weekdayOf,
} from './utils.js';
import { icon, openModal, confirmDialog, fieldError, toast } from './ui.js';
import { store } from './store.js';
import { mascot } from './mascot.js';
import {
  PRIORITY_LABEL, goalProgress, isDone, AREA_SUGGESTIONS, ALL_DAYS, isChecked, compareTasks,
  REPEAT_LABEL, DURATIONS, repeatLabel, checklistProgress, isRepeating, REMIND_TIMED, REMIND_ALLDAY, MAX_TASK_TAGS,
} from './model.js';
import { allTags, tagMap, tagsOf, tagChip, tagVar, ensureTags } from './tags.js';
import { parseQuick, quickLabels } from './quickadd.js';
import { bridgeOn } from './gsync.js';

// ---------- 小元件 ----------
export function segRadio(name, options, value, label) {
  return `<div class="seg" role="radiogroup" aria-label="${esc(label || '')}">${options
    .map(([v, text]) => `<label class="seg-opt"><input type="radio" name="${name}" value="${esc(v)}" ${String(v) === String(value) ? 'checked' : ''}><span>${esc(text)}</span></label>`)
    .join('')}</div>`;
}

// tone：0～4，讓不同目標的進度條有不同的糖果色
export function progressBar(pct, label = '進度', tone = 0) {
  return `<div class="progress tone-${tone % 5}" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(label)}"><span style="width:${pct}%"></span></div>`;
}

export function emptyState(text, actionHTML = '', mood = 'smile') {
  return `<div class="empty"><span class="empty-mascot" aria-hidden="true">${mascot(mood, { size: 46 })}</span><p>${esc(text)}</p>${actionHTML}</div>`;
}

// 重複任務的某一次會多一個 data-occ（那一天），完成時只勾那一天
export const occAttr = (t) => (t.occ ? ` data-occ="${esc(t.occ)}"` : '');

// 任務列旁邊直接切換狀態（重複任務每一次只有完成或沒完成，所以沒有這個）
const STATUS_OPTS = [['todo', '待辦'], ['doing', '進行中'], ['done', '完成']];
export function statusSwitch(task) {
  return `<div class="task-status" role="group" aria-label="狀態：${esc(task.title)}">${STATUS_OPTS
    .map(([v, label]) => `<button type="button" class="ts-btn ts-${v}${task.status === v ? ' is-on' : ''}" aria-pressed="${task.status === v}" data-action="set-status" data-id="${esc(task.id)}" data-value="${v}">${label}</button>`)
    .join('')}</div>`;
}

export function taskRow(task, { goalsById = new Map(), tagsById = tagMap(), today = todayKey(), showDate = true, rowAttrs = null, statusControl = true } = {}) {
  const done = isDone(task);
  const overdue = !done && !task.occ && task.date && task.date < today;
  const goal = task.goalId ? goalsById.get(task.goalId) : null;
  const tags = [];
  const withStatus = statusControl && !task.occ && !task.ended && !isRepeating(task);
  if (task.status === 'doing' && !withStatus) tags.push('<span class="tag tag-doing">進行中</span>');
  if (showDate && task.date) {
    tags.push(`<span class="tag tag-date${overdue ? ' is-over' : ''}">${relativeDay(task.date, today)}${task.time ? ` ${task.time}` : ''}</span>`);
  } else if (task.time) {
    tags.push(`<span class="tag tag-date">${task.time}</span>`);
  }
  if (task.priority !== 'none') {
    tags.push(`<span class="tag tag-prio prio-${task.priority}"><i class="dot" aria-hidden="true"></i>${PRIORITY_LABEL[task.priority]}</span>`);
  }
  if (isRepeating(task)) tags.push(`<span class="tag tag-repeat">${task.ended ? '已結束的重複任務' : `🔁 ${repeatLabel(task)}`}</span>`);
  const list = checklistProgress(task);
  if (list.total) tags.push(`<span class="tag tag-check${list.done === list.total ? ' is-full' : ''}">☑ ${list.done}/${list.total}</span>`);
  if (goal) tags.push(`<span class="tag tag-goal">${esc(goal.emoji)} ${esc(goal.title)}</span>`);
  for (const tag of tagsOf(task, tagsById)) tags.push(tagChip(tag));
  if (task.notes) tags.push('<span class="tag tag-note" title="有備註">備註</span>');

  const check = task.ended
    ? `<span class="check is-ended" aria-hidden="true">${icon('check')}</span>`
    : `<button type="button" class="check" role="checkbox" aria-checked="${done}" data-action="toggle-task" data-id="${esc(task.id)}"${occAttr(task)} aria-label="${done ? '標記為未完成' : '完成'}：${esc(task.title)}${task.occ ? `（${fmtMonthDay(task.occ)}）` : ''}">${icon('check')}</button>`;
  // 手機滑動手勢：往右滑完成、往左滑刪除（重複的任務不能用滑的刪，免得整串不見）
  const swipe = ` data-swipe="task"${isRepeating(task) || task.occ ? ' data-swipe-left="0"' : ''}${task.ended ? ' data-swipe-right="0"' : ''}`;
  return `<li class="task prio-${task.priority}${done ? ' is-done' : ''}" data-id="${esc(task.id)}"${swipe}${rowAttrs ? rowAttrs(task) : ''}>
    ${check}
    <button type="button" class="task-main" data-action="open-task" data-id="${esc(task.id)}"${occAttr(task)}>
      <span class="task-title">${esc(task.title)}</span>
      ${tags.length ? `<span class="task-tags">${tags.join('')}</span>` : ''}
    </button>
    ${withStatus ? statusSwitch(task) : ''}
  </li>`;
}

// ---------- Google 日曆的行程（只讀） ----------
// 在某一天顯示的時間：跨天的行程顯示「開始」「到幾點」或「整天」
export function evTimeText(ev, day) {
  if (ev.allDay) return '全天';
  const starts = ev.startKey === day;
  const ends = ev.endKey === day;
  if (starts && ends) return `${ev.startTime}–${ev.endTime}`;
  if (starts) return `${ev.startTime} 開始`;
  if (ends) return `到 ${ev.endTime}`;
  return '整天';
}

export const evAttrs = (ev) => ` data-action="open-gevent" data-ev="${esc(ev.key)}" data-start="${ev.startMs}" style="--ev:${ev.color}"`;

export function eventList(events, day, { showCal = true } = {}) {
  return `<ul class="gev-list">${events.map((ev) => {
    const when = evTimeText(ev, day);
    return `<li><button type="button" class="gev"${evAttrs(ev)} aria-label="${esc(`${ev.title}，${when}${ev.calName ? `，${ev.calName}` : ''}（Google 日曆）`)}">
      <span class="gev-time">${when}</span><span class="gev-title">${esc(ev.title)}</span>${showCal && ev.calName ? `<span class="gev-cal">${esc(ev.calName)}</span>` : ''}
    </button></li>`;
  }).join('')}</ul>`;
}

export function openEventModal(ev) {
  const sameDay = ev.startKey === ev.endKey;
  const when = ev.allDay
    ? (sameDay ? `${fmtMonthDay(ev.startKey)} ${fmtWeekday(ev.startKey)}，全天` : `${fmtMonthDay(ev.startKey)} – ${fmtMonthDay(ev.endKey)}，全天`)
    : (sameDay ? `${fmtMonthDay(ev.startKey)} ${fmtWeekday(ev.startKey)} ${ev.startTime}–${ev.endTime}` : `${fmtMonthDay(ev.startKey)} ${ev.startTime} – ${fmtMonthDay(ev.endKey)} ${ev.endTime}`);
  const minutes = Math.round((ev.endMs - ev.startMs) / 60_000);
  openModal({
    title: ev.title,
    size: 'sm',
    cancelLabel: '關閉',
    body: `<div class="gev-detail" style="--ev:${ev.color}">
        <p class="gev-row">${icon('clock')}<span>${esc(when)}</span></p>
        ${ev.location ? `<p class="gev-row">${icon('pin')}<span>${esc(ev.location)}</span></p>` : ''}
        <p class="gev-row"><span class="gs-swatch" aria-hidden="true"></span><span>${esc(ev.calName || 'Google 日曆')}</span></p>
        <p class="hint">這是 Google 日曆裡的行程，要修改請到 Google 日曆。想在計劃版打勾追蹤的話，可以把它變成任務。</p>
        ${ev.link ? `<div class="btn-row"><a class="btn small ghost" href="${esc(ev.link)}" target="_blank" rel="noopener">${icon('external')}在 Google 日曆打開</a></div>` : ''}
      </div>`,
    extra: [{
      label: '變成任務',
      icon: 'plus',
      onClick: () => {
        const defaults = { title: ev.title, date: ev.startKey, notes: ev.location ? `地點：${ev.location}` : '' };
        if (!ev.allDay) {
          defaults.time = ev.startTime;
          if (sameDay && minutes > 0) defaults.duration = Math.min(Math.max(minutes, 15), 24 * 60);
        }
        // 等這個視窗關掉、焦點回去之後再開任務視窗
        setTimeout(() => openTaskModal(null, defaults), 0);
      },
    }],
  });
}

export function taskList(tasks, opts = {}) {
  opts = { tagsById: tagMap(), ...opts };
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

// ---------- 在選類別的地方直接新增類別（購物清單、記帳簿都用） ----------
export function catAdder(label = '新增類別') {
  return `<span class="cat-adder" data-cat-adder>
    <button type="button" class="cat-add-btn" data-cat-add-open>${icon('plus')}${esc(label)}</button>
    <span class="cat-add-form" hidden>
      <input class="cat-add-emoji" data-cat-add-emoji maxlength="4" placeholder="🏷️" autocomplete="off" aria-label="新類別的圖示（可不填）">
      <input class="cat-add-name" data-cat-add-name maxlength="12" placeholder="類別名稱" autocomplete="off" aria-label="新類別的名稱">
      <button type="button" class="btn small" data-cat-add-save>加入</button>
    </span>
  </span>`;
}

// onAdd(name, emoji, adder)：回傳 true 表示加好了（輸入框會清空、收起來）
export function bindCatAdder(form, onAdd) {
  const save = (box) => {
    const nameInput = box.querySelector('[data-cat-add-name]');
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      return;
    }
    const emoji = box.querySelector('[data-cat-add-emoji]').value.trim();
    if (onAdd(name, emoji, box) === false) return;
    nameInput.value = '';
    box.querySelector('[data-cat-add-emoji]').value = '';
    box.querySelector('.cat-add-form').hidden = true;
    const open = box.querySelector('[data-cat-add-open]');
    open.hidden = false;
  };
  form.addEventListener('click', (e) => {
    const open = e.target.closest('[data-cat-add-open]');
    if (open) {
      e.preventDefault();
      const box = open.closest('[data-cat-adder]');
      open.hidden = true;
      box.querySelector('.cat-add-form').hidden = false;
      box.querySelector('[data-cat-add-name]').focus();
      return;
    }
    const btn = e.target.closest('[data-cat-add-save]');
    if (btn) {
      e.preventDefault();
      save(btn.closest('[data-cat-adder]'));
    }
  });
  form.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing || !e.target.matches('[data-cat-add-name], [data-cat-add-emoji]')) return;
    e.preventDefault(); // 不要送出整個表單
    save(e.target.closest('[data-cat-adder]'));
  });
}

// ---------- 快速新增（看得懂「明天下午3點 家教 #工作」） ----------
export function quickAddField({ keep, placeholder, label }) {
  return `<input name="title" data-keep="${keep}" data-quick placeholder="${esc(placeholder)}" autocomplete="off" aria-label="${esc(label)}" aria-describedby="${keep}-preview" maxlength="300">`;
}
export const quickPreview = (keep) => `<p class="qa-preview" id="${keep}-preview" data-qa-preview aria-live="polite"></p>`;

export function updateQuickPreview(input) {
  const box = input.form?.querySelector('[data-qa-preview]');
  if (!box) return;
  const today = todayKey();
  const p = parseQuick(input.value, { today, weekStart: store.state.settings.weekStart });
  const parts = input.value.trim() ? quickLabels(p, today) : [];
  box.innerHTML = parts.length ? `<span class="qa-label">會加上</span>${parts.map((x) => `<span class="qa-part">${esc(x)}</span>`).join('')}` : '';
}

// 回傳 { data } 或 { error }
export function addQuickTask(text, { date = '', priority = 'none' } = {}) {
  const today = todayKey();
  const p = parseQuick(text, { today, weekStart: store.state.settings.weekStart });
  if (!p.title) return { error: '請輸入任務名稱' };
  const { ids, created } = ensureTags(p.tags);
  const data = { title: p.title, date: p.date || date, time: p.time, priority: p.priority || priority, tags: ids };
  if (p.duration) data.duration = Math.min(Math.max(p.duration, 5), 24 * 60);
  store.addTask(data);
  const notes = [];
  if (data.date && data.date !== date) notes.push(`${relativeDay(data.date, today)}${data.time ? ` ${data.time}` : ''}`);
  else if (data.time) notes.push(data.time);
  if (created.length) notes.push(`新標籤 ${created.map((g) => `#${g.name}`).join(' ')}`);
  if (notes.length) toast(`已新增「${data.title}」：${notes.join('，')}`);
  return { data };
}

// ---------- 任務 ----------
export function deleteTaskWithUndo(id) {
  const doc = store.removeTask(id);
  if (doc) toast('已刪除任務', { actionLabel: '復原', onAction: () => store.restore('tasks', doc) });
}

const checkItem = (i) => `<li class="check-item" data-item="${esc(i.id)}">
    <input type="checkbox" class="check-done"${i.done ? ' checked' : ''} aria-label="完成這一項">
    <input class="check-text" value="${esc(i.text)}" maxlength="200" aria-label="小步驟" autocomplete="off">
    <button type="button" class="icon-btn small" data-check-remove aria-label="刪除這一項">${icon('x')}</button>
  </li>`;

// ---- 任務視窗裡的標籤、提醒、範本 ----
const tagPick = (tag, checked) => `<label class="tag-pick" style="--tc:${tagVar(tag.color)}"><input type="checkbox" name="tags" value="${esc(tag.id)}"${checked ? ' checked' : ''}><span><i class="tag-dot" aria-hidden="true"></i>${esc(tag.name)}</span></label>`;

function remindOptions(timed, value) {
  const list = timed ? REMIND_TIMED : REMIND_ALLDAY;
  const v = value === null || value === undefined ? 'default' : String(value);
  const known = list.some(([n]) => String(n) === v);
  return `<option value="default"${known ? '' : ' selected'}>${timed ? '預設（前 10 分鐘）' : '預設（不提醒）'}</option>${list
    .map(([n, label]) => `<option value="${n}"${String(n) === v ? ' selected' : ''}>${label}</option>`).join('')}`;
}

// 存成範本：用一個小視窗問名稱
function saveAsTemplate(data) {
  const templates = store.state.settings.templates;
  openModal({
    title: '存成範本',
    size: 'sm',
    submitLabel: '儲存範本',
    body: `<div class="field"><label for="tpl-name">範本名稱</label><input id="tpl-name" name="name" maxlength="40" value="${esc(data.title)}" autocomplete="off" autofocus></div>
      <p class="hint">之後新增任務時，在「從範本建立」選它，名稱、小清單、標籤、時長、優先度和提醒都會幫你填好。同名的範本會被更新。</p>`,
    onSubmit(form) {
      const name = form.elements.name.value.trim().slice(0, 40);
      if (!name) {
        fieldError(form, 'name', '請輸入範本名稱');
        return false;
      }
      const list = [...templates];
      const at = list.findIndex((x) => x.name === name);
      if (at < 0 && list.length >= 30) {
        fieldError(form, 'name', '範本最多 30 個，請先到設定刪掉用不到的');
        return false;
      }
      const tpl = { id: at >= 0 ? list[at].id : `p${uid().slice(0, 12)}`, name, ...data };
      if (at >= 0) list[at] = tpl;
      else list.push(tpl);
      store.saveSettings({ templates: list });
      toast(at >= 0 ? `已更新範本「${name}」` : `已存成範本「${name}」`);
      return true;
    },
  });
}

export function openTaskModal(task = null, defaults = {}) {
  const base = { title: '', notes: '', date: '', time: '', duration: 60, priority: 'none', status: 'todo', goalId: '', repeat: 'none', repeatDays: [], repeatUntil: '', checklist: [], tags: [], remind: null };
  // 新任務沒有指定日期時，預設是今天（不想排日期可以把日期清掉）
  const t = task ? { ...base, ...task } : { ...base, ...defaults, date: defaults.date || todayKey() };
  const tags = allTags();
  const templates = store.state.settings.templates;
  const calendarOn = bridgeOn() || store.state.settings.gcalOn;
  const weekStart = store.state.settings.weekStart;
  const repeating = t.repeat !== 'none';
  const days = t.repeatDays.length ? t.repeatDays : t.date ? [weekdayOf(t.date)] : [];
  const goals = store.state.goals.filter((g) => g.status !== 'done' || g.id === t.goalId);
  const body = `
    ${!task && templates.length ? `<div class="field"><label for="tm-template">從範本建立</label>
      <select id="tm-template" data-template><option value="">不用範本</option>${templates
        .map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select></div>` : ''}
    <div class="field"><label for="tm-title">任務名稱</label>
      <input id="tm-title" name="title" value="${esc(t.title)}" maxlength="300" autocomplete="off" autofocus placeholder="例如：準備週三的課"></div>
    <div class="field-row field-row-3">
      <div class="field"><label for="tm-date">${repeating ? '從哪天開始' : '日期'}</label><input id="tm-date" type="date" name="date" value="${esc(t.date)}"></div>
      <div class="field"><label for="tm-time">時間</label><input id="tm-time" type="time" name="time" value="${esc(t.time)}"></div>
      <div class="field"><label for="tm-duration">時長</label><select id="tm-duration" name="duration">${DURATIONS
        .map(([v, label]) => `<option value="${v}"${v === t.duration ? ' selected' : ''}>${label}</option>`).join('')}${DURATIONS.some(([v]) => v === t.duration) ? '' : `<option value="${t.duration}" selected>${t.duration} 分鐘</option>`}</select></div>
    </div>
    <fieldset class="field"><legend>重複</legend>
      ${segRadio('repeat', Object.entries(REPEAT_LABEL), t.repeat, '重複')}
      <div class="repeat-more"${repeating ? '' : ' hidden'}>
        <div class="day-picks repeat-days"${t.repeat === 'weekly' ? '' : ' hidden'}>${orderedWeekdays(weekStart)
          .map((d) => `<label class="day-pick"><input type="checkbox" name="repeatDays" value="${d}"${days.includes(d) ? ' checked' : ''}><span>${WEEKDAYS[d]}</span></label>`)
          .join('')}</div>
        <div class="repeat-until"><label for="tm-until">重複到</label><input id="tm-until" type="date" name="repeatUntil" value="${esc(t.repeatUntil)}"><span class="hint">不填就一直重複</span></div>
        <p class="hint">每一次可以分開打勾。Google 日曆會用重複行程顯示。</p>
      </div>
    </fieldset>
    <fieldset class="field" data-status-field${repeating ? ' hidden' : ''}><legend>狀態</legend>${segRadio('status', [['todo', '待辦'], ['doing', '進行中'], ['done', '完成']], t.status, '狀態')}</fieldset>
    <fieldset class="field" data-priority-field><legend>優先度</legend>${segRadio('priority', [['none', '無'], ['low', '低'], ['medium', '中'], ['high', '高']], t.priority, '優先度')}</fieldset>
    <fieldset class="field tag-field"><legend>標籤</legend>
      <div class="tag-picks" data-tag-picks>${tags.length ? tags.map((g) => tagPick(g, t.tags.includes(g.id))).join('') : '<span class="hint" data-tag-empty>還沒有標籤。在下面輸入名稱，就會建立第一個標籤。</span>'}</div>
      <div class="inline-add">
        <input data-tag-new placeholder="新增標籤，按 Enter 加入" maxlength="20" autocomplete="off" aria-label="新增標籤">
        <button type="button" class="btn small" data-tag-add>${icon('plus')}新增</button>
      </div>
    </fieldset>
    <div class="field"><label for="tm-remind">提醒</label>
      <select id="tm-remind" name="remind">${remindOptions(!!t.time, t.remind)}</select>
      <p class="hint">${calendarOn ? '會透過 Google 日曆通知你的手機。' : '連接 Google 日曆之後，手機會在這個時間通知你。'}</p></div>
    <div class="field"><span class="label" id="tm-check-label">小清單</span>
      <ul class="checklist" data-checklist aria-labelledby="tm-check-label">${t.checklist.map(checkItem).join('')}</ul>
      <div class="inline-add">
        <input data-check-new placeholder="新增一個小步驟，按 Enter 加入" autocomplete="off" aria-label="新增小步驟" maxlength="200">
        <button type="button" class="btn small" data-check-add>${icon('plus')}新增</button>
      </div>
    </div>
    <div class="field"><label for="tm-goal">屬於哪個目標</label>
      <select id="tm-goal" name="goalId"><option value="">不屬於任何目標</option>${goals
        .map((g) => `<option value="${esc(g.id)}"${g.id === t.goalId ? ' selected' : ''}>${esc(g.emoji)} ${esc(g.title)}</option>`)
        .join('')}</select></div>
    <div class="field"><label for="tm-notes">備註</label><textarea id="tm-notes" name="notes" rows="3">${esc(t.notes)}</textarea></div>`;

  openModal({
    title: task ? '編輯任務' : '新增任務',
    body,
    submitLabel: task ? '儲存' : '新增任務',
    extra: [
      ...(task ? [{ label: '刪除', icon: 'trash', className: 'ghost danger-text', onClick: () => deleteTaskWithUndo(task.id) }] : []),
      {
        label: '存成範本',
        icon: 'copy',
        className: 'ghost',
        closes: false,
        onClick(form) {
          const f = form.elements;
          const title = f.title.value.trim();
          if (!title) {
            fieldError(form, 'title', '先輸入任務名稱，再存成範本');
            return false;
          }
          saveAsTemplate({
            title,
            notes: f.notes.value.trim(),
            checklist: [...form.querySelectorAll('.check-item .check-text')].map((el) => el.value.trim()).filter(Boolean),
            tags: [...form.querySelectorAll('input[name="tags"]:checked')].map((b) => b.value),
            time: f.time.value,
            duration: Number(f.duration.value) || 60,
            priority: f.priority.value || 'none',
            remind: f.remind.value === 'default' ? null : Number(f.remind.value),
          });
          return false;
        },
      },
    ],
    onOpen(form) {
      const more = form.querySelector('.repeat-more');
      const dayBox = form.querySelector('.repeat-days');
      const statusField = form.querySelector('[data-status-field]');
      const dateLabel = form.querySelector('label[for="tm-date"]');
      const list = form.querySelector('[data-checklist]');
      const newItem = form.querySelector('[data-check-new]');
      const tagBox = form.querySelector('[data-tag-picks]');
      const tagNew = form.querySelector('[data-tag-new]');
      const remindSel = form.elements.remind;
      const refreshRemind = (value = remindSel.value === 'default' ? null : Number(remindSel.value)) => {
        remindSel.innerHTML = remindOptions(!!form.elements.time.value, value);
      };
      form.elements.time.addEventListener('input', () => refreshRemind());
      const addTag = () => {
        const name = tagNew.value.trim();
        if (!name) return;
        const { ids, created } = ensureTags([name]);
        if (!ids.length) {
          toast('標籤最多 40 個，請先到設定刪掉用不到的', { tone: 'error' });
          return;
        }
        const box = [...tagBox.querySelectorAll('input[name="tags"]')].find((b) => b.value === ids[0]);
        if (box) box.checked = true;
        else {
          const tag = created[0] || allTags().find((g) => g.id === ids[0]);
          tagBox.querySelector('[data-tag-empty]')?.remove();
          tagBox.insertAdjacentHTML('beforeend', tagPick(tag, true));
        }
        tagNew.value = '';
        tagNew.focus();
      };
      const applyTemplate = (tpl) => {
        const f = form.elements;
        f.title.value = tpl.title || tpl.name;
        if (tpl.notes && !f.notes.value.trim()) f.notes.value = tpl.notes;
        list.innerHTML = tpl.checklist.map((text) => checkItem({ id: uid().slice(0, 12), text, done: false })).join('');
        for (const b of tagBox.querySelectorAll('input[name="tags"]')) b.checked = tpl.tags.includes(b.value);
        if (![...f.duration.options].some((o) => Number(o.value) === tpl.duration)) f.duration.insertAdjacentHTML('beforeend', `<option value="${tpl.duration}">${tpl.duration} 分鐘</option>`);
        f.duration.value = String(tpl.duration);
        const prio = form.querySelector(`input[name="priority"][value="${tpl.priority}"]`);
        if (prio) prio.checked = true;
        if (tpl.time) f.time.value = tpl.time;
        refreshRemind(tpl.remind);
      };
      form.addEventListener('change', (e) => {
        if (e.target.matches('[data-template]')) {
          const tpl = store.state.settings.templates.find((x) => x.id === e.target.value);
          if (tpl) applyTemplate(tpl);
          return;
        }
        if (e.target.name === 'tags' && e.target.checked && form.querySelectorAll('input[name="tags"]:checked').length > MAX_TASK_TAGS) {
          e.target.checked = false;
          toast(`一個任務最多 ${MAX_TASK_TAGS} 個標籤`);
          return;
        }
        if (e.target.name !== 'repeat') return;
        const v = e.target.value;
        more.hidden = v === 'none';
        dayBox.hidden = v !== 'weekly';
        statusField.hidden = v !== 'none';
        dateLabel.textContent = v === 'none' ? '日期' : '從哪天開始';
        if (v !== 'none' && !form.elements.date.value) form.elements.date.value = todayKey();
        if (v === 'weekly' && !form.querySelector('input[name="repeatDays"]:checked')) {
          const wd = weekdayOf(form.elements.date.value || todayKey());
          const box = form.querySelector(`input[name="repeatDays"][value="${wd}"]`);
          if (box) box.checked = true;
        }
      });
      const addItem = () => {
        const text = newItem.value.trim();
        if (!text) return;
        list.insertAdjacentHTML('beforeend', checkItem({ id: uid().slice(0, 12), text, done: false }));
        newItem.value = '';
        newItem.focus();
      };
      newItem.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing) {
          e.preventDefault();
          addItem();
        }
      });
      form.addEventListener('keydown', (e) => {
        // 在小清單的文字框按 Enter，跳到新增欄位，不要直接送出
        if (e.key === 'Enter' && !e.isComposing && e.target.classList.contains('check-text')) {
          e.preventDefault();
          newItem.focus();
        }
        if (e.key === 'Enter' && !e.isComposing && e.target === tagNew) {
          e.preventDefault();
          addTag();
        }
      });
      form.addEventListener('click', (e) => {
        if (e.target.closest('[data-check-add]')) {
          e.preventDefault();
          addItem();
        }
        if (e.target.closest('[data-tag-add]')) {
          e.preventDefault();
          addTag();
        }
        const rm = e.target.closest('[data-check-remove]');
        if (rm) {
          e.preventDefault();
          rm.closest('.check-item').remove();
          newItem.focus();
        }
      });
    },
    onSubmit(form) {
      const f = form.elements;
      const repeat = f.repeat.value || 'none';
      const data = {
        title: f.title.value.trim(),
        date: f.date.value,
        time: f.time.value,
        duration: Number(f.duration.value) || 60,
        priority: f.priority.value || 'none',
        status: repeat === 'none' ? f.status.value || 'todo' : 'todo',
        goalId: f.goalId.value,
        notes: f.notes.value.trim(),
        repeat,
        repeatDays: repeat === 'weekly' ? [...form.querySelectorAll('input[name="repeatDays"]:checked')].map((b) => Number(b.value)) : [],
        repeatUntil: repeat === 'none' ? '' : f.repeatUntil.value,
        checklist: [...form.querySelectorAll('.check-item')]
          .map((li) => ({ id: li.dataset.item, text: li.querySelector('.check-text').value.trim(), done: li.querySelector('.check-done').checked }))
          .filter((i) => i.text),
        tags: [...form.querySelectorAll('input[name="tags"]:checked')].map((b) => b.value).slice(0, MAX_TASK_TAGS),
        remind: f.remind.value === 'default' ? null : Number(f.remind.value),
      };
      // 還沒按「新增」的標籤名稱也收進去
      const pendingTag = form.querySelector('[data-tag-new]').value.trim();
      if (pendingTag) data.tags = [...new Set([...data.tags, ...ensureTags([pendingTag]).ids])].slice(0, MAX_TASK_TAGS);
      // 還沒按「新增」的小步驟也收進去
      const pending = form.querySelector('[data-check-new]').value.trim();
      if (pending) data.checklist.push({ id: uid().slice(0, 12), text: pending, done: false });
      if (!data.title) {
        fieldError(form, 'title', '請輸入任務名稱');
        return false;
      }
      if (repeat !== 'none') {
        if (!data.date) data.date = todayKey();
        if (repeat === 'weekly' && !data.repeatDays.length) data.repeatDays = [weekdayOf(data.date)];
        if (data.repeatUntil && data.repeatUntil < data.date) {
          fieldError(form, 'repeatUntil', '結束日期要在開始日期之後');
          return false;
        }
      }
      if (task) {
        if (data.status === 'done' && task.status !== 'done') data.doneAt = Date.now();
        if (data.status !== 'done') data.doneAt = null;
        store.updateTask(task.id, data);
        toast('已儲存');
      } else {
        store.addTask({ ...data, doneAt: data.status === 'done' ? Date.now() : null });
        toast(repeat === 'none' ? '已新增任務' : '已新增重複任務');
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
    { id: 'overdue', emoji: '⏰', title: '逾期', items: [] },
    { id: 'today', emoji: '☀️', title: '今天', items: [] },
    { id: 'tomorrow', emoji: '🌤️', title: '明天', items: [] },
    { id: 'week', emoji: '📆', title: '接下來 7 天', items: [] },
    { id: 'later', emoji: '🔭', title: '之後', items: [] },
    { id: 'nodate', emoji: '📝', title: '沒有日期', items: [] },
    { id: 'done', emoji: '✅', title: '已完成', items: [] },
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
