// 資料中心：所有畫面都從這裡讀資料、透過這裡寫資料。
// 實際存到哪裡（Firebase 或本機試用）由 backend 決定。
import { uid, DELETE } from './utils.js';
import { normalize, normalizeSettings, newDoc, toStored, isDone, DEFAULT_SETTINGS } from './model.js';

export const COLLECTIONS = ['tasks', 'goals', 'habits'];

const state = {
  status: 'idle', // idle | loading | ready
  mode: null, // cloud | demo
  user: null,
  sync: 'synced', // synced | pending | offline | local
  tasks: [],
  goals: [],
  habits: [],
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
      settings: { ...DEFAULT_SETTINGS },
    });
    const seen = new Set();
    const markSeen = (key) => {
      seen.add(key);
      if (seen.size === 4) state.status = 'ready';
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

  // 復原剛刪除的資料
  restore(col, doc) {
    if (!doc) return;
    run(() => backend.set(col, doc.id, toStored(col, doc)));
  },

  // ---- 設定 ----
  saveSettings(patch) {
    run(() => backend.setSettings(patch));
  },

  // ---- 備份 ----
  exportData() {
    return {
      app: 'planner',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: state.settings,
      tasks: state.tasks,
      goals: state.goals,
      habits: state.habits,
    };
  },

  async importData(json) {
    if (!json || typeof json !== 'object' || json.app !== 'planner') {
      throw new Error('這不是規劃本的備份檔');
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
      const { title, icon, coverStyle, coverSeed, theme, weekStart } = normalizeSettings(json.settings);
      run(() => backend.setSettings({ title, icon, coverStyle, coverSeed, theme, weekStart }));
    }
    return items.length;
  },
};
