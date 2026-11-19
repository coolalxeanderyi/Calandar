// 生日小表單（form.html）：朋友不用登入，填完直接存到表單主人的 Firestore。
// 網址：form.html?f=表單編號。權限由 firestore.rules 把關：只能「新增」回覆，看不到別人填的。
import { firebaseConfig } from '../firebase-config.js';
import { mascot } from './mascot.js';
import { makeBirthday, splitBirthday, splitList, DAYS_IN } from './friendfmt.js';

const $ = (sel) => document.querySelector(sel);
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const params = new URLSearchParams(location.search);
const formId = (params.get('f') || '').trim();
const local = ['localhost', '127.0.0.1'].includes(location.hostname);
const host = local && params.has('emulators') ? 'http://127.0.0.1:8080' : 'https://firestore.googleapis.com';
const docRoot = `projects/${firebaseConfig.projectId}/databases/(default)/documents`;
const API = `${host}/v1/${docRoot}`;
const SENT_KEY = `planner.form.sent.${formId}`;

const el = document.querySelector('.fp-form');
let info = { title: '', intro: '', from: '', open: true };

// ---------- 小工具 ----------
const show = (state) => { document.body.dataset.state = state; };
const str = (f) => (f && typeof f.stringValue === 'string' ? f.stringValue : '');
// 中文和英文名字之間才空一格：「Alexander 想知道」、「小明想知道」
const sb = (name) => (/^[A-Za-z0-9]/.test(name) ? ' ' : '');
const sa = (name) => (/[A-Za-z0-9]$/.test(name) ? ' ' : '');
let lastSent = null; // 「你已經填過囉」→ 修改：把上次填的放回去

function todayParts() {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
}

function readSent() {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) || 'null');
  } catch {
    return null;
  }
}

function newId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return [...crypto.getRandomValues(new Uint8Array(20))].map((b) => chars[b % chars.length]).join('');
}

// ---------- 畫面 ----------
function setMascot(mood) {
  $('[data-mascot]').innerHTML = mascot(mood, { size: 78, label: '' });
}

function paintHead() {
  const who = info.from;
  $('[data-from]').textContent = who ? `${who}${sa(who)}想知道` : '';
  $('[data-title]').textContent = info.title || '生日小表單';
  $('[data-intro]').textContent = info.intro;
  document.title = info.title || '生日小表單';
  if (who) {
    $('[data-note-label]').textContent = `還有什麼想讓${sb(who)}${who}${sa(who)}知道的？`;
    $('[data-privacy]').textContent = `只有${sb(who)}${who}${sa(who)}看得到你填的內容。`;
  }
}

function message(title, text, { reload = false } = {}) {
  $('[data-msg-title]').textContent = title;
  $('[data-msg-text]').textContent = text;
  $('[data-reload]').hidden = !reload;
  setMascot('sleepy');
  show('msg');
}

// 月、日、年的選項
function fillSelects() {
  const { y } = todayParts();
  const opt = (v, label) => `<option value="${v}">${label}</option>`;
  el.month.insertAdjacentHTML('beforeend', Array.from({ length: 12 }, (_, i) => opt(i + 1, `${i + 1} 月`)).join(''));
  el.day.insertAdjacentHTML('beforeend', Array.from({ length: 31 }, (_, i) => opt(i + 1, `${i + 1} 日`)).join(''));
  el.year.insertAdjacentHTML('beforeend', Array.from({ length: y - 1929 }, (_, i) => opt(y - i, `${y - i} 年`)).join(''));
}

// 下一次生日：今年還沒過就是今年，過了就是明年（2/29 找下一個閏年）
function nextBirthday(m, d) {
  const t = todayParts();
  const today = Date.UTC(t.y, t.m - 1, t.d);
  for (let y = t.y; y < t.y + 9; y++) {
    const at = Date.UTC(y, m - 1, d);
    if (new Date(at).getUTCDate() !== d) continue; // 這年沒有 2/29
    if (at >= today) return { days: Math.round((at - today) / 86400000), weekday: new Date(at).getUTCDay() };
  }
  return null;
}

// 選了月和日：上面的撕頁日曆跟著變，下面寫「下次生日是星期幾」
function paintDate() {
  const m = Number(el.month.value);
  const d = Number(el.day.value);
  // 這個月沒有的日子不能選（例如 4 月沒有 31 日）
  const max = m ? DAYS_IN[m - 1] : 31;
  for (const o of el.day.options) if (o.value) o.disabled = Number(o.value) > max;
  $('[data-cal-month]').textContent = m ? `${m} 月` : '？月';
  $('[data-cal-day]').textContent = d || '？';
  const next = m && d && d <= max ? nextBirthday(m, d) : null;
  let line = '';
  if (next) {
    line = next.days === 0 ? '今天就是你的生日！生日快樂 🎉' : `下次生日是星期${WEEK[next.weekday]}，還有 ${next.days} 天`;
  }
  $('[data-cal-foot]').textContent = next ? (next.days === 0 ? '就是今天！' : `星期${WEEK[next.weekday]}`) : '你的生日';
  $('[data-next]').textContent = line;
}

function paintChips() {
  const list = splitList(el.likes.value);
  $('[data-chips]').innerHTML = list.map((x) => `<span class="fp-chip">${escapeHtml(x)}</span>`).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function setError(name, msg) {
  const box = name === 'name' ? $('#fp-name-err') : $('#fp-bday-err');
  box.textContent = msg;
  const fields = name === 'name' ? [el.name] : [el.month, el.day, el.year];
  for (const f of fields) f.setAttribute('aria-invalid', msg ? 'true' : 'false');
}

function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = $('.fp-confetti');
  const colors = ['#ff8fb1', '#ffcd57', '#63cfae', '#88c2ff', '#c3b1e1', '#ec6c95'];
  box.innerHTML = Array.from({ length: 28 }, (_, i) => {
    const left = Math.random() * 100;
    const x = `${(Math.random() - 0.5) * 160}px`;
    const r = `${Math.round(Math.random() * 720 - 360)}deg`;
    const t = `${1.4 + Math.random() * 1.2}s`;
    return `<i style="left:${left}%;background:${colors[i % colors.length]};--x:${x};--r:${r};--t:${t};animation-delay:${Math.random() * 0.25}s"></i>`;
  }).join('');
  setTimeout(() => { box.innerHTML = ''; }, 3200);
}

function showDone(sent, { again = false } = {}) {
  const who = info.from || '發表單的人';
  $('[data-done-title]').textContent = again ? '你已經填過囉' : `收到了，謝謝${sb(sent.name)}${sent.name}！`;
  $('[data-done-text]').textContent = again
    ? `填錯了的話可以修改，${who}${sa(who)}會收到新的版本。`
    : `${who}${sa(who)}會在你生日那天記得你 🎉`;
  const { year, month, day } = splitBirthday(sent.birthday);
  const items = [];
  if (month) items.push(`🎂 ${year ? `${year} 年 ` : ''}${month} 月 ${day} 日`);
  if (sent.likes) items.push(`喜歡：${sent.likes}`);
  $('[data-summary]').innerHTML = items.map((x) => `<li>${escapeHtml(x)}</li>`).join('');
  // 只能改自己填的（帶回上次的內容），不提供「幫別人填」
  $('[data-again]').hidden = !again;
  lastSent = sent;
  if (month) {
    $('[data-cal-month]').textContent = `${month} 月`;
    $('[data-cal-day]').textContent = day;
    const next = nextBirthday(month, day);
    $('[data-cal-foot]').textContent = next ? (next.days === 0 ? '就是今天！' : `星期${WEEK[next.weekday]}`) : '你的生日';
  }
  setMascot('happy');
  show('done');
  if (!again) confetti();
  $('[data-done-title]').focus({ preventScroll: true });
}

function backToForm() {
  el.reset();
  if (lastSent) {
    const { year, month, day } = splitBirthday(lastSent.birthday);
    el.name.value = lastSent.name || '';
    if (month) {
      el.month.value = String(month);
      el.day.value = String(day);
      if (year) el.year.value = String(year);
    }
    el.likes.value = lastSent.likes || '';
  }
  paintChips();
  paintDate();
  setMascot('wave');
  show('form');
  el.name.focus();
}

// ---------- 跟雲端說話 ----------
async function load() {
  show('loading');
  setMascot('wave');
  if (!/^[A-Za-z0-9]{12,40}$/.test(formId)) {
    message('找不到這份表單', '網址好像不完整。請跟傳給你連結的人再要一次。');
    return;
  }
  let res;
  try {
    res = await fetch(`${API}/forms/${formId}`);
  } catch {
    message('連不上網路', '確認一下網路，再重新整理一次。', { reload: true });
    return;
  }
  if (res.status === 404) {
    message('找不到這份表單', '可能已經被刪掉，或網址不完整。請跟傳給你連結的人確認一下。');
    return;
  }
  if (!res.ok) {
    message('表單暫時打不開', `請稍後再試一次（錯誤 ${res.status}）。`, { reload: true });
    return;
  }
  const doc = await res.json();
  const f = doc.fields || {};
  info = {
    title: str(f.title).slice(0, 40),
    intro: str(f.intro).slice(0, 200),
    from: str(f.from).slice(0, 20),
    open: !(f.open && f.open.booleanValue === false),
  };
  paintHead();
  if (!info.open) {
    const who = info.from || '發表單的人';
    message('這份表單暫停填寫了', `${who}${sa(who)}暫時關掉了這份表單，晚點再來看看吧。`);
    return;
  }
  const sent = readSent();
  if (sent) showDone(sent, { again: true });
  else show('form');
}

async function send(data) {
  const fields = { name: { stringValue: data.name }, birthday: { stringValue: data.birthday } };
  for (const k of ['likes', 'dislikes', 'note']) if (data[k]) fields[k] = { stringValue: data[k] };
  const body = {
    writes: [{
      update: { name: `${docRoot}/forms/${formId}/responses/${newId()}`, fields },
      currentDocument: { exists: false },
      updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
    }],
  };
  return fetch(`${API}:commit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

async function onSubmit(e) {
  e.preventDefault();
  const name = el.name.value.trim().slice(0, 30);
  const m = el.month.value;
  const d = el.day.value;
  const y = el.year.value;
  setError('name', name ? '' : '請寫上你的名字（暱稱也可以）');
  let birthday = '';
  let bdayMsg = '';
  if (!m || !d) bdayMsg = '請選你生日的月和日（年份可以不填）';
  else {
    birthday = makeBirthday(m, d, y);
    if (!birthday) bdayMsg = `${y ? `${y} 年` : ''}${m} 月沒有 ${d} 日`;
  }
  setError('bday', bdayMsg);
  if (!name || bdayMsg) {
    (!name ? el.name : !m ? el.month : el.day).focus();
    return;
  }
  const data = {
    name,
    birthday,
    likes: splitList(el.likes.value).join('、').slice(0, 300),
    dislikes: splitList(el.dislikes.value).join('、').slice(0, 300),
    note: el.note.value.trim().slice(0, 300),
  };
  const button = el.querySelector('.fp-send');
  const errBox = $('[data-send-err]');
  errBox.textContent = '';
  button.disabled = true;
  button.textContent = '送出中…';
  try {
    const res = await send(data);
    if (res.ok) {
      const sent = { name, birthday, likes: data.likes, at: Date.now() };
      try {
        localStorage.setItem(SENT_KEY, JSON.stringify(sent));
      } catch { /* 無痕模式存不了，沒關係 */ }
      showDone(sent);
      return;
    }
    if (res.status === 403) {
      // 可能剛好被暫停了：重新看一下表單
      await load();
      if (document.body.dataset.state === 'form') errBox.textContent = '送不出去，請稍後再試一次。';
      return;
    }
    errBox.textContent = `送不出去（錯誤 ${res.status}），請再按一次送出。`;
  } catch {
    errBox.textContent = '網路好像不太穩，請再按一次送出。';
  } finally {
    button.disabled = false;
    button.textContent = '送出';
  }
}

// ---------- 開始 ----------
fillSelects();
paintDate();
el.addEventListener('submit', onSubmit);
el.month.addEventListener('change', paintDate);
el.day.addEventListener('change', paintDate);
el.year.addEventListener('change', () => setError('bday', ''));
el.likes.addEventListener('input', paintChips);
el.name.addEventListener('input', () => { if (el.name.value.trim()) setError('name', ''); });
for (const s of [el.month, el.day]) s.addEventListener('change', () => { if (el.month.value && el.day.value) setError('bday', ''); });
$('[data-again]').addEventListener('click', backToForm);
$('[data-reload]').addEventListener('click', () => location.reload());
load();
