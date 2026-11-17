// 試用模式：資料存在這台裝置的瀏覽器（localStorage），不需要登入。
import { DELETE, isPlainObject } from './utils.js';

const STORE_KEY = 'planner.v1.demo';
const COLS = ['tasks', 'goals', 'habits', 'reviews', 'journal'];

function emptyData() {
  return { tasks: {}, goals: {}, habits: {}, reviews: {}, journal: {}, settings: {} };
}

export function readLocalData() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    const data = emptyData();
    if (!raw || typeof raw !== 'object') return data;
    for (const c of COLS) if (isPlainObject(raw[c])) data[c] = raw[c];
    if (isPlainObject(raw.settings)) data.settings = raw.settings;
    return data;
  } catch {
    return emptyData();
  }
}

export function hasLocalData() {
  const data = readLocalData();
  return COLS.some((c) => Object.keys(data[c]).length > 0);
}

export function localItems() {
  const data = readLocalData();
  return COLS.flatMap((c) => Object.entries(data[c]).map(([id, doc]) => [c, id, doc]));
}

function applyPatch(target, patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (value === DELETE) delete target[key];
    else if (isPlainObject(value)) {
      if (!isPlainObject(target[key])) target[key] = {};
      applyPatch(target[key], value);
    } else target[key] = value;
  }
}

const clone = (o) => JSON.parse(JSON.stringify(o));

export function createLocalBackend() {
  let data = readLocalData();
  let h = null;

  const list = (c) => Object.entries(data[c]).map(([id, doc]) => ({ id, ...doc }));
  const emitCol = (c) => h?.onCollection(c, list(c));
  const emitAll = () => {
    for (const c of COLS) emitCol(c);
    h?.onSettings({ ...data.settings });
  };
  const save = () => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch {
      throw new Error('瀏覽器的儲存空間不足，這次的變更沒有存到。');
    }
  };
  // 同一台電腦開了兩個分頁時，互相同步
  const onStorage = (e) => {
    if (e.key !== STORE_KEY) return;
    data = readLocalData();
    emitAll();
  };

  return {
    kind: 'local',
    start(handlers) {
      h = handlers;
      emitAll();
      h.onSync('local');
      window.addEventListener('storage', onStorage);
    },
    stop() {
      window.removeEventListener('storage', onStorage);
      h = null;
    },
    async set(c, id, doc) {
      data[c][id] = clone(doc);
      save();
      emitCol(c);
    },
    async patch(c, id, patch) {
      const current = data[c][id];
      if (!current) return;
      applyPatch(current, patch);
      save();
      emitCol(c);
    },
    async remove(c, id) {
      delete data[c][id];
      save();
      emitCol(c);
    },
    async setSettings(patch) {
      applyPatch(data.settings, patch);
      save();
      h?.onSettings({ ...data.settings });
    },
    async setMany(items) {
      for (const [c, id, doc] of items) data[c][id] = clone(doc);
      save();
      emitAll();
    },
  };
}
