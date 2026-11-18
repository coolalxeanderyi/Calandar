// 資料中心：所有畫面都從這裡讀資料、透過這裡寫資料。
// 實際存到哪裡（Firebase 或本機試用）由 backend 決定。
import { uid, DELETE } from './utils.js';
import { normalize, normalizeSettings, newDoc, toStored, isDone, DEFAULT_SETTINGS } from './model.js';

export const COLLECTIONS = ['tasks', 'goals', 'habits', 'reviews', 'journal', 'shopping', 'ledger', 'dates'];

const state = {
  status: 'idle', // idle | loading | ready
  mode: null, // cloud | demo
  user: null,
  sync: 'synced', // synced | pending | offline | local
  tasks: [],
  goals: [],
  habits: [],
  reviews: [],
  journal: [], // 每天的心情和一句話（文件 ID 是日期）
  shopping: [], // 購物清單
  ledger: [], // 記帳簿
  dates: [], // 重要日子（倒數日、生日、紀念日）
  settings: { ...DEFAULT_SETTINGS },
};

const listeners = new Set();
const errorListeners = new Set();
let backend = null;
let scheduled = false;

function emit() {
  if (scheduled) return;
  scheduled = true;
  const flush = () => {
    scheduled = false;
    for (const fn of listeners) fn(state);
  };
  if (typeof requestAnimationFrame === 'function' && document.visibilityState === 'visible') requestAnimationFrame(flush);
  else setTimeout(flush, 0);
}

function reportError(err) {
  console.error(err);
  for (const fn of errorListeners) fn(err);
}

function run(fn) {
  try {
    const result = fn();
    if (result && typeof result.catch === 'function') result.catch(reportError);
  } catch (err) {
    reportError(err);
  }
}

const find = (col, id) => state[col].find((d) => d.id === id);

export const store = {
  get state() {
    return state;
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  onError(fn) {
    errorListeners.add(fn);
    return () => errorListeners.delete(fn);
  },

  connect(next, { mode, user = null }) {
    this.disconnect();
    backend = next;
    Object.assign(state, {
      status: 'loading',
      mode,
      user,
      sync: mode === 'demo' ? 'local' : 'synced',
      tasks: [],
      goals: [],
      habits: [],
      reviews: [],
      journal: [],
      shopping: [],
      ledger: [],
      dates: [],
      settings: { ...DEFAULT_SETTINGS },
    });
    const seen = new Set();
    const markSeen = (key) => {
      seen.add(key);
      if (seen.size === COLLECTIONS.length + 1) state.status = 'ready';
    };
    backend.start({
      onCollection(col, docs) {
        state[col] = docs.map((d) => normalize(col, d));
        markSeen(col);
        emit();
      },
      onSettings(doc) {
        state.settings = normalizeSettings(doc || {});
        markSeen('settings');
        emit();
      },
      onSync(s) {
        if (state.sync !== s) {
          state.sync = s;
          emit();
        }
      },
      onError: reportError,
    });
    emit();
  },

  disconnect() {
    backend?.stop();
    backend = null;
    state.status = 'idle';
  },

  get backend() {
    return backend;
  },

  // ---- 任務 ----
  addTask(data) {
    const id = uid();
    run(() => backend.set('tasks', id, newDoc('tasks', data)));
    return id;
  },

  updateTask(id, patch) {
    run(() => backend.patch('tasks', id, { ...patch, updatedAt: Date.now() }));
  },

  toggleTask(id) {
    const task = find('tasks', id);
    if (!task) return;
    const done = !isDone(task);
    this.updateTask(id, { status: done ? 'done' : 'todo', doneAt: done ? Date.now() : null });
  },

  // 直接設定狀態：待辦、進行中、完成
  setTaskStatus(id, status) {
    const task = find('tasks', id);
    if (!task || !['todo', 'doing', 'done'].includes(status) || task.status === status) return;
    this.updateTask(id, { status, doneAt: status === 'done' ? Date.now() : null });
  },

  // 重複任務的某一次：完成／取消完成（只動那一天）
  toggleOccurrence(id, key) {
    const task = find('tasks', id);
    if (!task) return;
    const done = !!task.doneOn[key];
    run(() => backend.patch('tasks', id, { doneOn: { [key]: done ? DELETE : true }, updatedAt: Date.now() }));
  },

  // 小清單的某一項：打勾／取消
  toggleChecklistItem(id, itemId) {
    const task = find('tasks', id);
    if (!task) return;
    const checklist = task.checklist.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i));
    this.updateTask(id, { checklist });
  },

  removeTask(id) {
    const task = find('tasks', id);
    run(() => backend.remove('tasks', id));
    return task;
  },

  // ---- 目標 ----
  addGoal(data) {
    const id = uid();
    run(() => backend.set('goals', id, newDoc('goals', data)));
    return id;
  },

  updateGoal(id, patch) {
    run(() => backend.patch('goals', id, { ...patch, updatedAt: Date.now() }));
  },

  // 刪除目標時，原本連到它的任務保留下來、只取消連結
  removeGoal(id) {
    const goal = find('goals', id);
    const taskIds = state.tasks.filter((t) => t.goalId === id).map((t) => t.id);
    run(() => backend.remove('goals', id));
    for (const tid of taskIds) this.updateTask(tid, { goalId: '' });
    return { goal, taskIds };
  },

  relinkTasks(taskIds, goalId) {
    for (const tid of taskIds) if (find('tasks', tid)) this.updateTask(tid, { goalId });
  },

  // ---- 習慣 ----
  addHabit(data) {
    const id = uid();
    const order = state.habits.reduce((max, h) => Math.max(max, h.order), 0) + 1;
    run(() => backend.set('habits', id, newDoc('habits', { order, ...data })));
    return id;
  },

  updateHabit(id, patch) {
    run(() => backend.patch('habits', id, { ...patch, updatedAt: Date.now() }));
  },

  toggleHabit(id, key) {
    const habit = find('habits', id);
    if (!habit) return;
    const checked = !!habit.log[key];
    run(() => backend.patch('habits', id, { log: { [key]: checked ? DELETE : true }, updatedAt: Date.now() }));
  },

  removeHabit(id) {
    const habit = find('habits', id);
    run(() => backend.remove('habits', id));
    return habit;
  },

  // ---- 購物清單、記帳簿（以及其他簡單的資料） ----
  addDoc(col, data) {
    const id = uid();
    run(() => backend.set(col, id, newDoc(col, data)));
    return id;
  },

  updateDoc(col, id, patch) {
    run(() => backend.patch(col, id, { ...patch, updatedAt: Date.now() }));
  },

  removeDoc(col, id) {
    const doc = find(col, id);
    run(() => backend.remove(col, id));
    return doc;
  },

  // 復原剛刪除的資料
  restore(col, doc) {
    if (!doc) return;
    run(() => backend.set(col, doc.id, toStored(col, doc)));
  },

  // ---- 每週回顧（文件 ID 是那週第一天，例如 2026-11-16） ----
  saveReview(week, data) {
    const exists = state.reviews.some((r) => r.id === week);
    if (exists) run(() => backend.patch('reviews', week, { ...data, updatedAt: Date.now() }));
    else run(() => backend.set('reviews', week, newDoc('reviews', { week, ...data })));
  },

  // ---- 每天的心情和一句話（文件 ID 是日期，例如 2026-11-17） ----
  saveJournal(day, data) {
    const exists = state.journal.some((j) => j.id === day);
    if (exists) run(() => backend.patch('journal', day, { ...data, updatedAt: Date.now() }));
    else run(() => backend.set('journal', day, newDoc('journal', { date: day, ...data })));
  },

  // 一次改好幾個任務（例如把逾期的全部移到今天），回傳原本的值，給「復原」用
  patchTasks(changes) {
    const before = [];
    for (const [id, patch] of changes) {
      const task = find('tasks', id);
      if (!task) continue;
      before.push([id, Object.fromEntries(Object.keys(patch).map((k) => [k, task[k]]))]);
      this.updateTask(id, patch);
    }
    return before;
  },

  // ---- 設定 ----
  saveSettings(patch) {
    run(() => backend.setSettings(patch));
  },

  // ---- 備份 ----
  exportData() {
    // 連接 Google 日曆用的網址和密碼不放進備份檔，免得分享備份檔時一起給出去
    const { gsUrl, gsKey, ...settings } = state.settings;
    return {
      app: 'planner',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings,
      tasks: state.tasks,
      goals: state.goals,
      habits: state.habits,
      reviews: state.reviews,
      journal: state.journal,
      shopping: state.shopping,
      ledger: state.ledger,
      dates: state.dates,
    };
  },

  async importData(json) {
    if (!json || typeof json !== 'object' || json.app !== 'planner') {
      throw new Error('這不是計劃版的備份檔');
    }
    const items = [];
    for (const col of COLLECTIONS) {
      const list = Array.isArray(json[col]) ? json[col] : [];
      for (const raw of list) {
        if (!raw || typeof raw !== 'object') continue;
        const id = typeof raw.id === 'string' && /^[\w-]{1,64}$/.test(raw.id) ? raw.id : uid();
        items.push([col, id, toStored(col, { ...raw, id })]);
      }
    }
    await backend.setMany(items);
    if (json.settings && typeof json.settings === 'object') {
      const { title, icon, coverStyle, coverSeed, theme, palette, weekStart, tags, templates, currency, budget, ledgerCats, shopCats, userName, weatherOn, weatherPlace, timeZone } = normalizeSettings(json.settings);
      run(() => backend.setSettings({ title, icon, coverStyle, coverSeed, theme, palette, weekStart, tags, templates, currency, budget, ledgerCats, shopCats, userName, weatherOn, weatherPlace, ...(timeZone ? { timeZone } : {}) }));
    }
    return items.length;
  },
};
