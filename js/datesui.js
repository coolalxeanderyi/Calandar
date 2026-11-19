// 重要日子：總覽上的倒數小卡、新增／編輯的視窗、全部的清單
import { esc, todayKey, fmtMonthDay, WEEKDAYS, weekdayOf } from './utils.js';
import { icon, openModal, fieldError, toast } from './ui.js';
import { store } from './store.js';
import { DATE_KINDS } from './model.js';
import { dateInfo, sortDates, emojiOf, kindOf, todayLine } from './dates.js';
import { birthdayInfo, sameAsDate, likesText, STRIP_DAYS } from './friends.js';

const SHOW = 6; // 總覽最多放幾張
const EMOJIS = ['✈️', '📝', '🎂', '💝', '🎓', '🏠', '🎄', '🎉', '💼', '🌱', '❤️', '⭐'];
const KIND_HINT = {
  countdown: '一次性的日子，例如考試、出國、搬家。',
  birthday: '每年同一天，會自動算下一次還有幾天。',
  anniversary: '每年同一天，會算出是第幾週年。',
  since: '從那天開始算第幾天，例如開始運動、在一起。',
};

// 日期：今年的寫「11月27日（五）」，別的年份寫短一點「2027/11/11（四）」
export function whenText(key, today) {
  const wd = `（${WEEKDAYS[weekdayOf(key)]}）`;
  if (key.slice(0, 4) === today.slice(0, 4)) return `${fmtMonthDay(key)}${wd}`;
  return `${Number(key.slice(0, 4))}/${Number(key.slice(5, 7))}/${Number(key.slice(8))}${wd}`;
}

// 大字的部分：還有 9 天／就是今天／第 120 天／已經過了 3 天
function countHTML(d, info) {
  if (info.isToday) return '<span class="dt-count is-today"><b>就是今天</b></span>';
  if (info.counting) return `<span class="dt-count">第 <b>${info.big}</b> 天</span>`;
  if (info.past) return `<span class="dt-count is-past">已經過了 <b>${info.big}</b> 天</span>`;
  return `<span class="dt-count">還有 <b>${info.big}</b> 天</span>`;
}

function subText(d, info, today) {
  if (info.counting) return `從${whenText(d.date, today)}開始`;
  return `${whenText(info.target, today)}${info.small && !info.past ? `　${info.small}` : ''}`;
}

const ticket = (d, info, today) => `<li><button type="button" class="day-ticket kind-${d.kind}${info.soon ? ' is-soon' : ''}${info.isToday ? ' is-today' : ''}${info.past ? ' is-past' : ''}" data-action="open-date" data-id="${esc(d.id)}">
    <span class="dt-top"><span class="dt-emoji" aria-hidden="true">${esc(emojiOf(d))}</span><span class="dt-title">${esc(d.title)}</span>${info.small && !info.past && !info.counting ? `<span class="dt-badge">${esc(info.small)}</span>` : ''}</span>
    ${countHTML(d, info)}
    <span class="dt-when">${esc(info.counting ? `從${whenText(d.date, today)}開始` : whenText(info.target, today))}</span>
  </button></li>`;

// 總覽的一排小卡
// 朋友的生日（14 天內、還沒在重要日子裡的）
function friendBirthdays(state, today, within = STRIP_DAYS) {
  return (state.friends || [])
    .map((f) => ({ f, info: birthdayInfo(f, today) }))
    .filter(({ f, info }) => info && info.days <= within && !sameAsDate(f, state.dates))
    .sort((a, b) => a.info.days - b.info.days || a.f.name.localeCompare(b.f.name, 'zh-Hant'));
}

const friendTicket = (f, info, today) => `<li><button type="button" class="day-ticket kind-birthday is-friend${info.days <= 7 ? ' is-soon' : ''}${info.isToday ? ' is-today' : ''}" data-action="open-friend" data-id="${esc(f.id)}">
    <span class="dt-top"><span class="dt-emoji" aria-hidden="true">🎂</span><span class="dt-title">${esc(f.name)}</span>${info.age ? `<span class="dt-badge">${info.age} 歲</span>` : ''}</span>
    ${info.isToday ? '<span class="dt-count is-today"><b>就是今天</b></span>' : `<span class="dt-count">還有 <b>${info.days}</b> 天</span>`}
    <span class="dt-when">${esc(whenText(info.target, today))}</span>
  </button></li>`;

// 排順序：今天的最前面，再來是快到的（重要日子和朋友生日混在一起排）
const rankOf = (info) => (info.isToday ? [0, 0] : info.counting ? [2, -Number(info.big)] : [1, info.days]);

export function datesStrip(state, today = todayKey()) {
  const all = sortDates(state.dates || [], today).filter((x) => x.info);
  const friends = friendBirthdays(state, today);
  const items = [
    ...all.filter((x) => !x.info.past).map((x) => ({ rank: rankOf(x.info), friend: false, html: ticket(x.d, x.info, today) })),
    ...friends.map((x) => ({ rank: rankOf(x.info), friend: true, html: friendTicket(x.f, x.info, today) })),
  ].sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1]);
  const shown = items.slice(0, SHOW);
  const more = all.length - shown.filter((x) => !x.friend).length;
  return `<section class="dash-days" aria-labelledby="b-days">
    <header class="block-head"><h3 id="b-days" class="tape tape-2"><span aria-hidden="true">⏳</span>重要日子</h3>
      ${all.length ? `<button type="button" class="block-link link-btn" data-action="all-dates">${more > 0 ? `全部 ${all.length} 個` : '管理'}</button>` : ''}</header>
    <ul class="day-tickets">
      ${shown.map((x) => x.html).join('')}
      <li><button type="button" class="day-ticket is-add" data-action="new-date">
        <span class="dt-plus" aria-hidden="true">${icon('plus')}</span>
        <span class="dt-add-text">${all.length ? '新增' : '新增倒數日、生日、紀念日'}</span>
      </button></li>
    </ul>
  </section>`;
}

// 今天是生日、紀念日、倒數的那天：小日曆會說一句
export function specialLines(state, today = todayKey()) {
  const dates = sortDates(state.dates || [], today)
    .map(({ d, info }) => (info?.isToday ? { emoji: emojiOf(d), text: todayLine(d, info) } : null))
    .filter((x) => x && x.text);
  // 朋友今天生日：順便說他喜歡什麼，挑禮物用
  const friends = friendBirthdays(state, today, 0).map(({ f, info }) => {
    const likes = likesText(f, 3);
    return { emoji: '🎂', text: `今天是${f.name}生日！${info.age ? `（${info.age} 歲）` : ''}${likes ? ` ${likes}` : ''}` };
  });
  return [...dates, ...friends].slice(0, 3);
}

// ---------- 新增／編輯 ----------
export function openDateModal(doc = null, defaults = {}) {
  const base = doc || { title: '', date: defaults.date || '', kind: defaults.kind || 'countdown', emoji: '', showAge: true, remind: true, note: '' };
  const body = `
    <fieldset class="field"><legend>種類</legend>
      <div class="cat-picks" role="radiogroup" aria-label="種類">${DATE_KINDS.map(([id, label, emoji]) => `<label class="cat-pick"><input type="radio" name="kind" value="${id}"${base.kind === id ? ' checked' : ''}><span><span class="cat-emoji" aria-hidden="true">${emoji}</span>${label}</span></label>`).join('')}</div>
      <p class="hint" data-kind-hint>${KIND_HINT[base.kind]}</p></fieldset>
    <div class="field"><label for="dd-title">名稱</label>
      <input id="dd-title" name="title" value="${esc(base.title)}" maxlength="60" autocomplete="off" autofocus placeholder="例如：回台灣、多益考試、媽媽生日"></div>
    <div class="field-row">
      <div class="field"><label for="dd-date" data-date-label>${base.kind === 'birthday' ? '出生日期' : base.kind === 'since' ? '從哪天開始' : '日期'}</label>
        <input id="dd-date" type="date" name="date" value="${esc(base.date)}"></div>
      <div class="field grow field-emoji"><label for="dd-emoji">圖示</label>
        <input id="dd-emoji" name="emoji" value="${esc(base.emoji)}" maxlength="8" autocomplete="off" class="emoji-input" placeholder="${esc(kindOf(base.kind).emoji)}" data-emoji-input>
        <div class="emoji-picks" role="group" aria-label="常用圖示">${EMOJIS.map((e) => `<button type="button" class="emoji-pick" data-emoji="${e}" aria-label="使用 ${e}">${e}</button>`).join('')}</div></div>
    </div>
    <label class="check-row" data-age-row${base.kind === 'birthday' ? '' : ' hidden'}><input type="checkbox" name="showAge"${base.showAge ? ' checked' : ''}><span>顯示幾歲（不知道出生年份就取消勾選）</span></label>
    <label class="check-row" data-remind-row${base.kind === 'since' ? ' hidden' : ''}><input type="checkbox" name="remind"${base.remind ? ' checked' : ''}><span>放進 Google 日曆，前一週和前一天提醒我</span></label>
    <p class="hint" data-remind-hint${base.kind === 'since' ? ' hidden' : ''}>要在設定裡連接 Google 日曆才會提醒。生日和紀念日每年都會提醒。</p>
    <div class="field"><label for="dd-note">備註</label>
      <input id="dd-note" name="note" value="${esc(base.note)}" maxlength="200" autocomplete="off" placeholder="可不填，例如：要訂機票、準備禮物"></div>`;

  const extra = doc ? [{
    label: '刪除',
    icon: 'trash',
    className: 'ghost danger-text',
    onClick: () => {
      const removed = store.removeDoc('dates', doc.id);
      toast(`已刪除「${doc.title}」`, { actionLabel: '復原', onAction: () => store.restore('dates', removed) });
    },
  }] : [];

  openModal({
    title: doc ? '編輯重要日子' : '新增重要日子',
    body,
    submitLabel: doc ? '儲存' : '新增',
    extra,
    onOpen(form) {
      form.addEventListener('change', (e) => {
        if (e.target.name !== 'kind') return;
        const kind = e.target.value;
        form.querySelector('[data-kind-hint]').textContent = KIND_HINT[kind];
        form.querySelector('[data-date-label]').textContent = kind === 'birthday' ? '出生日期' : kind === 'since' ? '從哪天開始' : '日期';
        form.querySelector('[data-age-row]').hidden = kind !== 'birthday';
        form.querySelector('[data-remind-row]').hidden = kind === 'since';
        form.querySelector('[data-remind-hint]').hidden = kind === 'since';
        form.elements.emoji.placeholder = kindOf(kind).emoji;
      });
      form.addEventListener('click', (e) => {
        const pick = e.target.closest('.emoji-pick');
        if (!pick) return;
        e.preventDefault();
        form.elements.emoji.value = pick.dataset.emoji;
      });
    },
    onSubmit(form) {
      const f = form.elements;
      const title = f.title.value.trim();
      if (!title) {
        fieldError(form, 'title', '請輸入名稱，例如：回台灣');
        return false;
      }
      if (!f.date.value) {
        fieldError(form, 'date', '請選日期');
        return false;
      }
      const kind = form.querySelector('input[name="kind"]:checked')?.value || 'countdown';
      const data = {
        title,
        date: f.date.value,
        kind,
        emoji: f.emoji.value.trim(),
        showAge: f.showAge.checked,
        remind: f.remind.checked,
        note: f.note.value.trim(),
      };
      if (doc) {
        store.updateDoc('dates', doc.id, data);
        toast('已儲存');
      } else {
        store.addDoc('dates', data);
        const info = dateInfo(data, todayKey());
        toast(info?.isToday ? `已新增「${title}」，就是今天！` : info?.counting ? `已新增「${title}」，今天是第 ${info.big} 天` : info?.past ? `已新增「${title}」` : `已新增「${title}」，還有 ${info.big} 天`);
      }
      return true;
    },
  });
}

// ---------- 全部的重要日子 ----------
export function openDatesManager() {
  const render = () => {
    const today = todayKey();
    const all = sortDates(store.state.dates || [], today).filter((x) => x.info);
    if (!all.length) return '<p class="hint">還沒有重要日子。</p>';
    const row = ({ d, info }) => `<li><button type="button" class="date-line${info.past ? ' is-past' : ''}" data-date-edit="${esc(d.id)}">
        <span class="dl-emoji" aria-hidden="true">${esc(emojiOf(d))}</span>
        <span class="dl-main"><span class="dl-title">${esc(d.title)}</span><span class="dl-when">${esc(kindOf(d.kind).label)}　${esc(subText(d, info, today))}</span></span>
        ${countHTML(d, info)}
      </button></li>`;
    const upcoming = all.filter((x) => !x.info.past);
    const past = all.filter((x) => x.info.past);
    return `${upcoming.length ? `<ul class="date-lines">${upcoming.map(row).join('')}</ul>` : ''}
      ${past.length ? `<p class="list-label">已經過了</p><ul class="date-lines">${past.map(row).join('')}</ul>` : ''}`;
  };
  let stop = () => {};
  openModal({
    title: '重要日子',
    body: `<div data-dates-list>${render()}</div>`,
    hideFooter: true,
    onOpen(form, close) {
      const box = form.querySelector('[data-dates-list]');
      stop = store.subscribe(() => {
        box.innerHTML = render();
      });
      form.insertAdjacentHTML('beforeend', `<footer class="modal-foot"><div class="modal-foot-left"></div>
        <button type="button" class="btn primary" data-date-new>${icon('plus')}新增</button></footer>`);
      form.addEventListener('click', (e) => {
        const edit = e.target.closest('[data-date-edit]');
        if (edit) {
          const doc = store.state.dates.find((x) => x.id === edit.dataset.dateEdit);
          if (doc) openDateModal(doc);
          return;
        }
        if (e.target.closest('[data-date-new]')) openDateModal();
      });
    },
    onClose() {
      stop();
    },
  });
}
