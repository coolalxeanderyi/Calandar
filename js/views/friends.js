// 朋友：記朋友的生日和喜歡的東西。生日快到時，總覽和 Google 日曆會提醒
import { esc, todayKey, fmtMonthDay, WEEKDAYS, weekdayOf } from '../utils.js';
import { icon, toast, openModal, fieldError } from '../ui.js';
import { store } from '../store.js';
import { emptyState } from '../components.js';
import { tagVar } from '../tags.js';
import {
  DEFAULT_GROUPS, SOON_DAYS, parseFriend, birthdayInfo, sortFriends, matchFriend, splitList,
  makeBirthday, splitBirthday, avatarColor, initialOf,
} from '../friends.js';
import {
  forms, friendFor, nameKey, mergeResponse, mergeChanges, friendFromResponse, removeResponse, hideResponses,
} from '../forms.js';
import { openFormManager } from '../formsui.js';

const ui = { q: '', group: '' };

const avatar = (f, size = '') => `<span class="friend-avatar${size}" style="--av:${tagVar(avatarColor(f.name))}" aria-hidden="true">${esc(initialOf(f.name))}</span>`;

const dayText = (key) => `${fmtMonthDay(key)}（${WEEKDAYS[weekdayOf(key)]}）`;

// 還有幾天：今天／明天／還有 X 天
function countdown(info) {
  if (info.isToday) return '<span class="fr-count is-today">今天生日！</span>';
  if (info.days === 1) return '<span class="fr-count is-soon">明天生日</span>';
  return `<span class="fr-count${info.soon ? ' is-soon' : ''}">還有 <b>${info.days}</b> 天</span>`;
}

const likeChips = (list, max) => {
  const shown = list.slice(0, max);
  return `${shown.map((x) => `<span class="tag fr-like">${esc(x)}</span>`).join('')}${list.length > max ? `<span class="tag fr-more">+${list.length - max}</span>` : ''}`;
};

// 「快到了」的卡片：一眼看到幾天後、幾歲、喜歡什麼（挑禮物用）
function soonCard(f, info) {
  return `<li><button type="button" class="friend-card${info.isToday ? ' is-today' : ''}" data-action="open-friend" data-id="${esc(f.id)}">
      <span class="fc-top">${avatar(f)}<span class="fc-name">${esc(f.name)}</span>${f.group ? `<span class="tag">${esc(f.group)}</span>` : ''}</span>
      ${countdown(info)}
      <span class="fc-when">${esc(dayText(info.target))}${info.age ? `　滿 ${info.age} 歲` : ''}</span>
      ${f.likes.length ? `<span class="fc-likes"><span class="fc-label">喜歡</span>${likeChips(f.likes, 6)}</span>` : ''}
      ${f.dislikes.length ? `<span class="fc-dislikes">不喜歡：${esc(f.dislikes.join('、'))}</span>` : ''}
      ${f.note ? `<span class="fc-note">${esc(f.note)}</span>` : ''}
    </button></li>`;
}

function friendRow(f, info) {
  const { month, day } = splitBirthday(f.birthday);
  return `<li class="friend-row" data-id="${esc(f.id)}" data-swipe="friend" data-swipe-right="0">
      <button type="button" class="friend-main" data-action="open-friend" data-id="${esc(f.id)}">
        ${avatar(f)}
        <span class="fr-text">
          <span class="fr-name">${esc(f.name)}${f.group ? `<span class="tag">${esc(f.group)}</span>` : ''}</span>
          <span class="fr-sub">${month ? `<span>${month}月${day}日</span>${countdown(info)}${info.age ? `<span>滿 ${info.age} 歲</span>` : ''}` : '<span>還沒填生日</span>'}</span>
        </span>
        ${f.likes.length ? `<span class="fr-likes">${likeChips(f.likes, 3)}</span>` : ''}
      </button>
    </li>`;
}

// 依「下一次生日」的月份分組，從這個月開始；沒填生日的放最後
function groupByMonth(rows, today) {
  const groups = [];
  const thisYear = today.slice(0, 4);
  for (const r of rows) {
    const key = r.info ? r.info.target.slice(0, 7) : 'none';
    let g = groups.find((x) => x.key === key);
    if (!g) {
      const label = r.info ? `${key.slice(0, 4) === thisYear ? '' : `${Number(key.slice(0, 4))}年`}${Number(key.slice(5))}月` : '還沒填生日';
      g = { key, label, rows: [] };
      groups.push(g);
    }
    g.rows.push(r);
  }
  return groups;
}

// ---------- 生日表單的回覆 ----------
function whenText(ms) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  if (diff < 60_000) return '剛剛';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分鐘前`;
  const d = new Date(ms);
  const hm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (new Date().toDateString() === d.toDateString()) return `今天 ${hm}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

function inboxCard(r, friends, outdated) {
  const match = friendFor(r, friends);
  const changes = match && !outdated ? mergeChanges(match, r) : [];
  const { year, month, day } = splitBirthday(r.birthday);
  let main;
  if (outdated) main = '';
  else if (!match) main = `<button type="button" class="btn primary small" data-action="resp-add" data-id="${esc(r.id)}">${icon('plus')}加入朋友</button>`;
  else if (changes.length) main = `<button type="button" class="btn primary small" data-action="resp-merge" data-id="${esc(r.id)}">更新「${esc(match.name)}」</button>`;
  else main = '';
  return `<li class="inbox-card" data-rid="${esc(r.id)}">
      <div class="ib-top">${avatar(r)}<span class="ib-name">${esc(r.name)}</span>
        ${outdated ? '<span class="tag ib-match">舊的：後來又填了一次</span>' : match ? `<span class="tag ib-match">${changes.length ? '已經有這位朋友' : '資料都一樣'}</span>` : ''}
        <span class="ib-when">${esc(whenText(r.at))}</span></div>
      ${month ? `<span class="ib-bday">🎂 ${year ? `${year} 年 ` : ''}${month} 月 ${day} 日</span>` : ''}
      ${r.likes.length ? `<span class="fc-likes"><span class="fc-label">喜歡</span>${likeChips(r.likes, 8)}</span>` : ''}
      ${r.dislikes.length ? `<span class="fc-dislikes">不喜歡：${esc(r.dislikes.join('、'))}</span>` : ''}
      ${r.note ? `<span class="ib-note">${esc(r.note)}</span>` : ''}
      ${changes.length ? `<span class="ib-changes">會補上：${esc(changes.join('、'))}</span>` : ''}
      <div class="ib-actions">${main}
        <button type="button" class="btn ghost small" data-action="resp-skip" data-id="${esc(r.id)}">${outdated || (match && !changes.length) ? '收起來' : '略過'}</button></div>
    </li>`;
}

// 還不在名單裡的回覆（同一個名字只算一次）
function newResponses(friends) {
  const seen = new Set();
  return forms.responses.filter((r) => {
    const k = nameKey(r.name);
    if (friendFor(r, friends) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function inbox(friends) {
  const list = forms.responses;
  if (!list.length) return '';
  const fresh = newResponses(friends);
  return `<section class="friend-inbox" aria-labelledby="fr-inbox">
      <div class="inbox-head">
        <h3 class="group-title" id="fr-inbox"><span class="group-emoji" aria-hidden="true">📮</span>生日表單的回覆<span class="count">${list.length}</span></h3>
        ${fresh.length > 1 ? `<button type="button" class="btn small" data-action="resp-all">全部加入（${fresh.length}）</button>` : ''}
      </div>
      <ul class="inbox-list">${list.map((r, i) => inboxCard(r, friends, list.slice(0, i).some((x) => nameKey(x.name) === nameKey(r.name)))).join('')}</ul>
    </section>`;
}

function preview(form) {
  const text = form.elements.name.value;
  if (!text.trim()) return '';
  const p = parseFriend(text);
  const parts = [];
  if (p.birthday) {
    const { year, month, day } = splitBirthday(p.birthday);
    parts.push(`🎂 ${year ? `${year}年` : ''}${month}月${day}日`);
  } else {
    parts.push('還沒填生日');
  }
  if (p.group) parts.push(p.group);
  if (p.likes.length) parts.push(`喜歡：${p.likes.join('、')}`);
  return `<span class="qa-label">${esc(p.name || '名字？')}</span>${parts.map((x) => `<span class="qa-part">${esc(x)}</span>`).join('')}`;
}

export default {
  render(state) {
    const today = todayKey();
    const all = state.friends;
    const groupsInUse = [...new Set(all.map((f) => f.group).filter(Boolean))];
    if (ui.group && !groupsInUse.includes(ui.group)) ui.group = '';
    const rows = sortFriends(all.filter((f) => (!ui.group || f.group === ui.group) && matchFriend(f, ui.q)), today);
    const soon = rows.filter((r) => r.info?.soon);

    let body;
    if (!all.length) {
      body = emptyState('還沒有朋友的資料。在上面輸入，按 Enter 就會加入，例如「小美 3/14 #同學 喜歡貓、抹茶」。也可以按「生日表單」做一份表單，發限動讓朋友自己填。');
    } else if (!rows.length) {
      body = emptyState(ui.q ? `找不到「${ui.q}」` : '這一組還沒有人。');
    } else {
      body = `
      ${soon.length ? `<section class="friend-soon" aria-labelledby="fr-soon">
        <h3 class="group-title" id="fr-soon"><span class="group-emoji" aria-hidden="true">🎂</span>${SOON_DAYS} 天內生日<span class="count">${soon.length}</span></h3>
        <ul class="friend-cards">${soon.map((r) => soonCard(r.f, r.info)).join('')}</ul>
      </section>` : ''}
      ${groupByMonth(rows, today).map((g) => `
        <section class="task-group friend-group" aria-label="${esc(g.label)}">
          <h3 class="group-title"><span class="group-emoji" aria-hidden="true">${g.key === 'none' ? '📇' : '🗓️'}</span>${esc(g.label)}<span class="count">${g.rows.length}</span></h3>
          <ul class="friend-list">${g.rows.map((r) => friendRow(r.f, r.info)).join('')}</ul>
        </section>`).join('')}`;
    }

    return `
    <div class="friends-view">
      <form class="add-bar friend-add" data-submit="friend-add">
        <input name="name" data-keep="friend-add" data-input="friend-preview" data-preview placeholder="新增朋友，例如：小美 3/14 #同學 喜歡貓、抹茶" autocomplete="off" aria-label="新增朋友" aria-describedby="friend-add-preview" maxlength="200">
        <button class="btn primary" type="submit">${icon('plus')}加入</button>
        <button class="btn ghost" type="button" data-action="friend-new">詳細</button>
        <p class="qa-preview" id="friend-add-preview" data-friend-preview aria-live="polite"></p>
      </form>

      <div class="toolbar friend-toolbar">
        ${all.length ? `<label class="search">${icon('search')}<input type="search" data-input="friend-search" data-keep="friend-search" value="${esc(ui.q)}" placeholder="找名字或喜歡的東西，例如：貓" aria-label="找朋友"></label>` : ''}
        <button type="button" class="btn friend-form-btn" data-action="form-open"><span aria-hidden="true">📮</span>生日表單${forms.responses.length ? `<span class="btn-badge">${forms.responses.length}</span><span class="sr-only">份新回覆</span>` : ''}</button>
        ${all.length && groupsInUse.length ? `<div class="chips" role="group" aria-label="依關係篩選">
          <button type="button" class="chip${ui.group ? '' : ' is-active'}" aria-pressed="${!ui.group}" data-action="friend-group" data-value="">全部 ${all.length}</button>
          ${groupsInUse.map((g) => `<button type="button" class="chip${ui.group === g ? ' is-active' : ''}" aria-pressed="${ui.group === g}" data-action="friend-group" data-value="${esc(g)}">${esc(g)} ${all.filter((f) => f.group === g).length}</button>`).join('')}
        </div>` : ''}
      </div>

      ${inbox(all)}
      ${body}
      <p class="cal-tip">提示：生日前一週和前一天，Google 日曆會提醒你（要先在設定連接 Google 日曆）；14 天內的生日也會出現在總覽的「重要日子」，當天小日曆會跟你說。不知道年份就只打月和日，例如「3/14」。</p>
    </div>`;
  },

  actions: {
    'friend-new'(el, e, ctx) {
      const input = document.querySelector('.friend-add input[name="name"]');
      const p = parseFriend(input?.value || '');
      openFriendModal(null, p, {
        onSaved: () => {
          if (input) input.value = '';
          ctx.forgetDrafts(['friend-add']);
          document.querySelector('[data-friend-preview]')?.replaceChildren();
        },
      });
    },
    'open-friend'(el) {
      const f = store.state.friends.find((x) => x.id === el.dataset.id);
      if (f) openFriendModal(f);
    },
    'friend-group'(el, e, ctx) {
      ui.group = el.dataset.value;
      ctx.rerender();
    },
    'form-open'() {
      openFormManager();
    },
    'resp-add'(el) {
      const r = forms.responses.find((x) => x.id === el.dataset.id);
      if (r) openFriendModal(null, friendFromResponse(r), { onSaved: () => removeResponse(r.id) });
    },
    'resp-merge'(el) {
      const r = forms.responses.find((x) => x.id === el.dataset.id);
      const f = r && friendFor(r, store.state.friends);
      if (f) openFriendModal({ ...f, ...mergeResponse(f, r) }, {}, { onSaved: () => removeResponse(r.id) });
    },
    'resp-skip'(el) {
      const r = forms.responses.find((x) => x.id === el.dataset.id);
      if (!r) return;
      const undo = hideResponses([r.id]);
      toast(`已收起「${r.name}」的回覆`, { actionLabel: '復原', onAction: undo });
    },
    // 還不在名單裡的人一次加進去（已經有的朋友留著，一個一個確認要不要更新）
    'resp-all'() {
      const fresh = newResponses(store.state.friends);
      if (!fresh.length) return;
      const added = fresh.map((r) => store.addDoc('friends', friendFromResponse(r)));
      const undo = hideResponses(fresh.map((r) => r.id));
      toast(`已加入 ${fresh.length} 位朋友`, {
        actionLabel: '復原',
        duration: 6000,
        onAction: () => {
          for (const id of added) store.removeDoc('friends', id);
          undo();
        },
      });
    },
  },

  input: {
    'friend-preview'(el) {
      const box = el.form?.querySelector('[data-friend-preview]');
      if (box) box.innerHTML = preview(el.form);
    },
    'friend-search'(el, e, ctx) {
      ui.q = el.value.trim();
      ctx.rerender();
    },
  },

  submit: {
    'friend-add'(form, e, ctx) {
      const input = form.elements.name;
      const p = parseFriend(input.value);
      if (!p.name) {
        if (input.value.trim()) toast('請輸入朋友的名字', { tone: 'error' });
        input.focus();
        return;
      }
      const group = p.group || ui.group;
      store.addDoc('friends', { name: p.name, birthday: p.birthday, group, likes: p.likes, dislikes: [], note: '', remind: true });
      const info = birthdayInfo(p, todayKey());
      toast(info ? (info.isToday ? `已加入「${p.name}」，今天就是生日！` : `已加入「${p.name}」，生日還有 ${info.days} 天`) : `已加入「${p.name}」，可以點開來補生日`);
      ctx.clearDrafts(form);
      form.querySelector('[data-friend-preview]').innerHTML = '';
      input.focus();
    },
  },

  // 在這一頁按 N：新增朋友
  onNew() {
    document.querySelector('.friend-add input[name="name"]')?.focus();
  },
};

// 刪除一位朋友（可以復原）：視窗裡的「刪除」和往左滑都用這個
export function deleteFriend(id) {
  const f = store.state.friends.find((x) => x.id === id);
  if (!f) return;
  const doc = store.removeDoc('friends', id);
  toast(`已刪除「${f.name}」`, { actionLabel: '復原', onAction: () => store.restore('friends', doc) });
}

// ---------- 新增／編輯 ----------
export function openFriendModal(friend = null, defaults = {}, { onSaved } = {}) {
  const base = friend || { name: defaults.name || '', birthday: defaults.birthday || '', group: defaults.group || '', likes: defaults.likes || [], dislikes: defaults.dislikes || [], note: defaults.note || '', remind: true };
  const { year, month, day } = splitBirthday(base.birthday);
  const thisYear = Number(todayKey().slice(0, 4));
  const groups = [...new Set([...DEFAULT_GROUPS, ...store.state.friends.map((f) => f.group).filter(Boolean)])];
  const opt = (v, label, sel) => `<option value="${v}"${sel ? ' selected' : ''}>${label}</option>`;
  const body = `
    <div class="field"><label for="fr-name">名字</label>
      <input id="fr-name" name="name" value="${esc(base.name)}" maxlength="30" autocomplete="off" autofocus placeholder="例如：小美"></div>
    <fieldset class="field"><legend>生日</legend>
      <div class="birthday-row">
        <select name="month" aria-label="月">${opt('', '月', !month)}${Array.from({ length: 12 }, (_, i) => opt(i + 1, `${i + 1} 月`, month === i + 1)).join('')}</select>
        <select name="day" aria-label="日">${opt('', '日', !day)}${Array.from({ length: 31 }, (_, i) => opt(i + 1, `${i + 1} 日`, day === i + 1)).join('')}</select>
        <input name="year" type="number" inputmode="numeric" min="1900" max="${thisYear}" value="${year || ''}" placeholder="出生年（可不填）" aria-label="出生年（可不填）">
      </div>
      <p class="hint">不知道年份可以不填；填了會顯示滿幾歲。</p></fieldset>
    <div class="field"><label for="fr-group">關係</label>
      <input id="fr-group" name="group" value="${esc(base.group)}" list="fr-groups" maxlength="20" autocomplete="off" placeholder="例如：同學、家人、同事">
      <datalist id="fr-groups">${groups.map((g) => `<option value="${esc(g)}"></option>`).join('')}</datalist></div>
    <div class="field"><label for="fr-likes">喜歡的東西</label>
      <input id="fr-likes" name="likes" value="${esc(base.likes.join('、'))}" maxlength="400" autocomplete="off" placeholder="用頓號隔開，例如：貓、抹茶、周杰倫"></div>
    <div class="field"><label for="fr-dislikes">不喜歡的東西</label>
      <input id="fr-dislikes" name="dislikes" value="${esc(base.dislikes.join('、'))}" maxlength="400" autocomplete="off" placeholder="例如：香菜、太甜的"></div>
    <div class="field"><label for="fr-note">備註</label>
      <textarea id="fr-note" name="note" rows="2" maxlength="500" placeholder="送禮點子、上次送了什麼…">${esc(base.note)}</textarea></div>
    <label class="check-row"><input type="checkbox" name="remind"${base.remind ? ' checked' : ''}><span>生日前一週和前一天提醒我（放進 Google 日曆）</span></label>`;

  openModal({
    title: friend ? '編輯朋友' : '新增朋友',
    body,
    submitLabel: friend ? '儲存' : '加入',
    extra: friend ? [{ label: '刪除', icon: 'trash', className: 'ghost danger-text', onClick: () => deleteFriend(friend.id) }] : [],
    onSubmit(form) {
      const f = form.elements;
      const name = f.name.value.trim();
      if (!name) {
        fieldError(form, 'name', '請輸入名字');
        return false;
      }
      const m = f.month.value;
      const d = f.day.value;
      const y = f.year.value.trim();
      let birthday = '';
      if (m || d || y) {
        if (!m || !d) {
          fieldError(form, m ? 'day' : 'month', '月和日都要選，不知道生日就都不要選');
          return false;
        }
        if (y && (Number(y) < 1900 || Number(y) > thisYear)) {
          fieldError(form, 'year', `年份要在 1900 到 ${thisYear} 之間，不知道可以不填`);
          return false;
        }
        birthday = makeBirthday(m, d, y);
        if (!birthday) {
          fieldError(form, 'day', `${y ? `${y} 年` : ''}${m} 月沒有 ${d} 日`);
          return false;
        }
      }
      const data = {
        name: name.slice(0, 30),
        birthday,
        group: f.group.value.trim().slice(0, 20),
        likes: splitList(f.likes.value),
        dislikes: splitList(f.dislikes.value),
        note: f.note.value.trim(),
        remind: f.remind.checked,
      };
      if (friend) {
        store.updateDoc('friends', friend.id, data);
        toast('已儲存');
      } else {
        store.addDoc('friends', data);
        const info = birthdayInfo(data, todayKey());
        toast(info ? (info.isToday ? `已加入「${name}」，今天就是生日！` : `已加入「${name}」，生日還有 ${info.days} 天`) : `已加入「${name}」`);
      }
      onSaved?.();
      return true;
    },
  });
}
