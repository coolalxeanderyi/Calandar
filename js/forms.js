// 生日表單（給朋友填的）：從雲端拿「我的表單」和朋友填的回覆。
// 這裡只有資料和計算；設定視窗在 formsui.js，回覆列表在 views/friends.js，朋友看到的頁面是 form.html。
import { splitList, isBirthday, splitBirthday } from './friendfmt.js';

export const FORM_DEFAULTS = {
  title: '告訴我你的生日 🎂',
  intro: '我想記住大家的生日！花 30 秒填一下，你生日那天我就不會忘記了。',
};
export const FORM_LIMITS = { title: 40, intro: 200, from: 20 };
const SKIP_DELAY = 6000; // 按「略過」之後幾毫秒才真的刪掉（這段時間可以復原）

let api = null;
let uid = '';
let stopMine = null;
let stopAnswers = null;
let answersFor = '';
let allAnswers = [];
let retryTimer = 0;
const listeners = new Set();
const hidden = new Map(); // 回覆編號 → 計時器

export const forms = {
  status: 'off', // off：試用模式或還沒登入｜loading｜ready｜rules：還沒貼新的安全規則｜error
  form: null, // { id, title, intro, from, open, createdAt }
  responses: [], // 還沒處理的回覆，新的在前面
  error: '',
  projectId: '',
};

export function initForms(formsApi, { projectId = '' } = {}) {
  api = formsApi || null;
  forms.projectId = projectId;
}

export const formsAvailable = () => !!api;

export function onFormsChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit() {
  forms.responses = allAnswers.filter((r) => !hidden.has(r.id));
  for (const cb of [...listeners]) cb(forms);
}

const stamp = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : typeof t === 'number' ? t : 0);
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
export const isDenied = (err) => err?.code === 'permission-denied' || /permission|insufficient/i.test(err?.message || '');

export function cleanForm(d) {
  return {
    id: d.id,
    title: text(d.title, FORM_LIMITS.title) || FORM_DEFAULTS.title,
    intro: text(d.intro, FORM_LIMITS.intro),
    from: text(d.from, FORM_LIMITS.from),
    open: d.open !== false,
    createdAt: stamp(d.createdAt),
    pending: !!d.pending,
  };
}

export function cleanResponse(d) {
  const name = text(d.name, 30);
  if (!name) return null;
  return {
    id: d.id,
    name,
    birthday: isBirthday(d.birthday) ? d.birthday : '',
    likes: splitList(d.likes),
    dislikes: splitList(d.dislikes),
    note: text(d.note, 300),
    at: stamp(d.createdAt),
  };
}

// ---------- 跟雲端連線 ----------
export function startForms(userId) {
  if (!api || !userId) return;
  if (uid === userId && stopMine) return;
  unwatch();
  uid = userId;
  forms.status = 'loading';
  emit();
  stopMine = api.watchMine(uid, (list, fromCache) => {
    const mine = list.map(cleanForm).sort((a, b) => b.createdAt - a.createdAt)[0] || null;
    // 本機快取裡沒有表單，可能只是還沒問到雲端：等雲端回答再說「還沒有表單」
    if (mine || !fromCache) forms.status = 'ready';
    forms.form = mine;
    forms.error = '';
    // 剛建立、雲端還沒確認的表單先不要聽回覆：規則要看得到表單才會放行，太早問會被擋
    if (!mine?.pending) watchAnswers(mine?.id || '');
    emit();
  }, (err) => {
    stopMine = null;
    forms.status = isDenied(err) ? 'rules' : 'error';
    forms.error = err?.message || String(err);
    emit();
  });
}

function watchAnswers(formId, attempt = 0) {
  if (formId === answersFor && attempt === 0) return;
  stopAnswers?.();
  stopAnswers = null;
  clearTimeout(retryTimer);
  answersFor = formId;
  if (attempt === 0) allAnswers = [];
  if (!formId) return;
  stopAnswers = api.watchResponses(formId, (list) => {
    allAnswers = list.map(cleanResponse).filter(Boolean).sort((a, b) => b.at - a.at);
    emit();
  }, (err) => {
    // 被擋（例如表單剛建立，雲端還在處理）：過一下再試，最多試 5 次
    console.warn('讀不到表單回覆', err);
    stopAnswers = null;
    if (attempt < 5 && answersFor === formId) retryTimer = setTimeout(() => watchAnswers(formId, attempt + 1), 1500 * (attempt + 1));
  });
}

function unwatch() {
  clearTimeout(retryTimer);
  stopMine?.();
  stopAnswers?.();
  stopMine = null;
  stopAnswers = null;
  answersFor = '';
  allAnswers = [];
}

// 登出、回到試用模式
export function stopForms() {
  unwatch();
  uid = '';
  forms.status = 'off';
  forms.form = null;
  forms.error = '';
  emit();
}

// 貼好規則之後再試一次
export function retryForms() {
  const u = uid;
  if (!u) return;
  unwatch();
  uid = '';
  startForms(u);
}

// ---------- 表單 ----------
function newFormId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return [...bytes].map((b) => chars[b % chars.length]).join('');
}

export function formUrl(id, base = location.href) {
  const url = new URL('form.html', base.split('#')[0]);
  url.search = `?f=${encodeURIComponent(id)}`;
  return url.href;
}

export async function createForm({ title, intro, from }) {
  if (!api || !uid) throw new Error('請先登入');
  const id = newFormId();
  try {
    await api.createForm(id, {
      owner: uid,
      title: text(title, FORM_LIMITS.title) || FORM_DEFAULTS.title,
      intro: text(intro, FORM_LIMITS.intro),
      from: text(from, FORM_LIMITS.from),
      open: true,
    });
  } catch (err) {
    if (isDenied(err)) {
      forms.status = 'rules';
      emit();
    }
    throw err;
  }
  return id;
}

export function updateForm(patch) {
  if (!forms.form) return Promise.resolve();
  const clean = {};
  if ('open' in patch) clean.open = !!patch.open;
  for (const k of ['title', 'intro', 'from']) if (k in patch) clean[k] = text(patch[k], FORM_LIMITS[k]);
  if ('title' in clean && !clean.title) clean.title = FORM_DEFAULTS.title;
  return api.updateForm(forms.form.id, clean);
}

export function deleteForm() {
  if (!forms.form) return Promise.resolve();
  return api.deleteForm(forms.form.id);
}

// ---------- 回覆 ----------
// 處理好了（加入朋友之後）：直接刪掉
export function removeResponse(id) {
  if (!forms.form) return;
  allAnswers = allAnswers.filter((r) => r.id !== id);
  emit();
  api.deleteResponse(forms.form.id, id).catch((err) => console.warn('刪不掉回覆', err));
}

// 略過：先藏起來，幾秒後才刪，在這之前可以復原。回傳「復原」用的函式
export function hideResponses(ids) {
  const formId = forms.form?.id;
  for (const id of ids) {
    clearTimeout(hidden.get(id));
    hidden.set(id, setTimeout(() => {
      hidden.delete(id);
      allAnswers = allAnswers.filter((r) => r.id !== id);
      if (formId) api?.deleteResponse(formId, id).catch((err) => console.warn('刪不掉回覆', err));
      emit();
    }, SKIP_DELAY));
  }
  emit();
  return () => {
    for (const id of ids) {
      clearTimeout(hidden.get(id));
      hidden.delete(id);
    }
    emit();
  };
}

// 關掉網頁前，把「略過」的回覆真的刪掉
export function flushHidden() {
  const formId = forms.form?.id;
  for (const [id, timer] of hidden) {
    clearTimeout(timer);
    if (formId) api?.deleteResponse(formId, id).catch(() => {});
  }
  hidden.clear();
}

// ---------- 跟現有的朋友比對 ----------
export const nameKey = (s) => String(s || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();

export function friendFor(resp, friends) {
  const k = nameKey(resp.name);
  return (k && friends.find((f) => nameKey(f.name) === k)) || null;
}

function pickBirthday(old, fresh) {
  if (!fresh) return old;
  if (!old) return fresh;
  const a = splitBirthday(old);
  const b = splitBirthday(fresh);
  if (a.month === b.month && a.day === b.day) return b.year ? fresh : old; // 同一天：留有年份的
  return fresh; // 不一樣的話，相信朋友自己填的
}

const union = (a, b) => splitList([...(a || []), ...(b || [])].join('\n'));

function joinNote(old, add) {
  if (!add || (old || '').includes(add)) return old || '';
  return old ? `${old}\n${add}` : add;
}

// 已經有這位朋友：把回覆補進去（生日、喜歡、不喜歡、備註）
export function mergeResponse(friend, resp) {
  return {
    birthday: pickBirthday(friend.birthday, resp.birthday),
    likes: union(friend.likes, resp.likes),
    dislikes: union(friend.dislikes, resp.dislikes),
    note: joinNote(friend.note, resp.note),
  };
}

// 會改到哪些地方：['生日', '喜歡 2 項', …]；空的就是資料都一樣
export function mergeChanges(friend, resp) {
  const m = mergeResponse(friend, resp);
  const out = [];
  if (m.birthday !== friend.birthday) out.push(friend.birthday ? '生日' : '補上生日');
  const moreLikes = m.likes.length - (friend.likes || []).length;
  if (moreLikes > 0) out.push(`喜歡 ${moreLikes} 項`);
  const moreDislikes = m.dislikes.length - (friend.dislikes || []).length;
  if (moreDislikes > 0) out.push(`不喜歡 ${moreDislikes} 項`);
  if (m.note !== (friend.note || '')) out.push('備註');
  return out;
}

// 回覆 → 新朋友的資料
export const friendFromResponse = (r) => ({
  name: r.name,
  birthday: r.birthday,
  group: '',
  likes: r.likes,
  dislikes: r.dislikes,
  note: r.note,
  remind: true,
});
