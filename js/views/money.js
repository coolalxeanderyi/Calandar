// 記帳簿：快速記帳（「午餐 8.5」「家教 +40」）、每個月的支出／收入／結餘、預算、分類長條圖、最近 6 個月
import { esc, todayKey, WEEKDAYS, weekdayOf, fmtMonthDay, uid } from '../utils.js';
import { icon, toast, openModal, fieldError } from '../ui.js';
import { store } from '../store.js';
import { emptyState } from '../components.js';
import { MONEY_MAX } from '../model.js';
import {
  catsOf, catOf, currencyOf, curInfo, fmtMoney, parseMoney, summarize, addMonths, daysInMonth, readAmount, roundMoney,
  fallbackCat, CURRENCY_LIST, DEFAULT_CATS,
} from '../money.js';

const ui = { month: '' };

const monthLabel = (month) => `${Number(month.slice(0, 4))} 年 ${Number(month.slice(5))} 月`;

function dayLabel(key, today) {
  const base = `${fmtMonthDay(key)} 週${WEEKDAYS[weekdayOf(key)]}`;
  if (key === today) return `今天・${base}`;
  return base;
}

function preview(text, settings) {
  if (!text.trim()) return '';
  const cats = catsOf(settings);
  const today = todayKey();
  const p = parseMoney(text, { today, weekStart: settings.weekStart, cats });
  if (p.amount === null) return '<span class="qa-label">還沒看到金額，例如「午餐 8.5」</span>';
  const cat = cats.find((c) => c.id === p.cat);
  const cur = p.currency || currencyOf(settings);
  const parts = [
    p.type === 'in' ? '收入' : '支出',
    fmtMoney(roundMoney(p.amount, cur), cur),
    `${cat.emoji} ${cat.name}`,
  ];
  if (p.date !== today) parts.push(p.date === addDaysKey(today, -1) ? '昨天' : fmtMonthDay(p.date));
  return `<span class="qa-label">會記成</span>${parts.map((x) => `<span class="qa-part">${esc(x)}</span>`).join('')}`;
}

const addDaysKey = (key, n) => {
  const d = new Date(`${key}T12:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function entryRow(e, cats, cur) {
  const cat = catOf(e, cats);
  const c = e.currency || cur;
  return `<li><button type="button" class="money-row" data-action="money-edit" data-id="${esc(e.id)}">
    <span class="money-emoji" aria-hidden="true">${esc(cat.emoji)}</span>
    <span class="money-text"><span class="money-title">${esc(e.title || cat.name)}</span>${e.title ? `<span class="money-cat">${esc(cat.name)}${e.note ? `・${esc(e.note)}` : ''}</span>` : e.note ? `<span class="money-cat">${esc(e.note)}</span>` : ''}</span>
    <span class="money-amt${e.type === 'in' ? ' is-in' : ''}">${fmtMoney(e.type === 'in' ? e.amount : -e.amount, c, { sign: true })}</span>
  </button></li>`;
}

// 支出分類：一個顏色的橫條（長度＝金額），旁邊寫名稱、金額和百分比
function catBars(sum, cats, cur) {
  const rows = [...sum.byCat.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return '<p class="hint">這個月還沒有支出。</p>';
  const max = rows[0][1];
  return `<ul class="time-bars money-bars" aria-label="這個月的支出分類">${rows.map(([id, v]) => {
    const cat = cats.find((c) => c.id === id) || cats.find((c) => c.id === 'other');
    const pct = sum.out ? Math.round((v / sum.out) * 100) : 0;
    return `<li class="time-row" title="${esc(`${cat.name}：${fmtMoney(v, cur)}，佔支出 ${pct}%`)}">
      <span class="time-name"><span aria-hidden="true">${esc(cat.emoji)}</span>${esc(cat.name)}</span>
      <span class="time-track" aria-hidden="true"><span class="time-bar money-bar" style="width:${Math.max(2, Math.round((v / max) * 100))}%"></span></span>
      <span class="time-val">${fmtMoney(v, cur)}<span class="time-sub">${pct}%</span></span>
    </li>`;
  }).join('')}</ul>`;
}

// 最近 6 個月的支出（直的長條，選到的月份顏色比較深）
function trend(entries, month, cur, cats) {
  const months = Array.from({ length: 6 }, (_, i) => addMonths(month, i - 5));
  const values = months.map((m) => summarize(entries.filter((e) => e.date.startsWith(m)), cur, cats).out);
  if (!values.some((v) => v > 0)) return '';
  const max = Math.max(...values);
  return `<section class="block money-trend" aria-labelledby="mt-trend">
    <header class="block-head"><h3 id="mt-trend" class="tape tape-2"><span aria-hidden="true">📊</span>最近 6 個月的支出</h3></header>
    <div class="block-body">
      <ol class="trend-bars">${months.map((m, i) => `
        <li class="trend-col${m === month ? ' is-current' : ''}" title="${esc(`${monthLabel(m)}：${fmtMoney(values[i], cur)}`)}">
          <span class="trend-track" aria-hidden="true"><span class="trend-bar" style="height:${values[i] ? Math.max(3, Math.round((values[i] / max) * 100)) : 0}%"></span></span>
          <span class="trend-month">${Number(m.slice(5))}月</span>
          <span class="trend-val">${values[i] ? fmtMoney(values[i], cur) : '—'}</span>
        </li>`).join('')}</ol>
    </div>
  </section>`;
}

function budgetBox(sum, settings, month, today, cur) {
  const budget = settings.budget;
  if (!budget) {
    return `<p class="money-budget-empty"><button type="button" class="link-btn" data-action="money-settings">設定每月預算</button>，就看得到這個月還剩多少可以用。</p>`;
  }
  const spent = sum.out;
  const pct = Math.min(100, Math.round((spent / budget) * 100));
  const left = roundMoney(budget - spent, cur);
  const isNow = month === today.slice(0, 7);
  let text;
  if (left < 0) {
    text = `<span class="money-over">${icon('alert')}超出預算 ${fmtMoney(-left, cur)}</span>`;
  } else if (isNow) {
    const daysLeft = daysInMonth(month) - Number(today.slice(8)) + 1;
    text = `還剩 <strong>${fmtMoney(left, cur)}</strong>，這個月還有 ${daysLeft} 天，平均每天可以花 ${fmtMoney(roundMoney(left / daysLeft, cur), cur)}`;
  } else {
    text = month < today.slice(0, 7) ? `用了 ${pct}%，剩下 ${fmtMoney(left, cur)}` : `預算 ${fmtMoney(budget, cur)}`;
  }
  return `<div class="money-budget${left < 0 ? ' is-over' : pct >= 80 ? ' is-near' : ''}">
    <div class="money-budget-head"><span>每月預算 ${fmtMoney(budget, cur)}</span><span>${pct}%</span></div>
    <div class="money-budget-track" role="progressbar" aria-label="這個月的預算用了多少" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>
    <p class="money-budget-text">${text}</p>
  </div>`;
}

export default {
  render(state) {
    const today = todayKey();
    const settings = state.settings;
    const cur = currencyOf(settings);
    const cats = catsOf(settings);
    const month = ui.month || today.slice(0, 7);
    const entries = state.ledger.filter((e) => e.date);
    const inMonth = entries.filter((e) => e.date.startsWith(month)).sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
    const sum = summarize(inMonth, cur, cats);
    const isNow = month === today.slice(0, 7);

    const days = [];
    for (const e of inMonth) {
      if (!days.length || days[days.length - 1].key !== e.date) days.push({ key: e.date, items: [] });
      days[days.length - 1].items.push(e);
    }
    const others = [...sum.others.entries()].map(([c, o]) => [o.out ? `支出 ${fmtMoney(o.out, c)}` : '', o.in ? `收入 ${fmtMoney(o.in, c)}` : ''].filter(Boolean).join('、')).filter(Boolean);

    return `
    <div class="money-view">
      <form class="add-bar money-add" data-submit="money-add">
        <input name="text" data-keep="money-add" data-input="money-preview" data-preview placeholder="記一筆，例如：午餐 8.5、家教 +40、昨天 超市 23.9" autocomplete="off" aria-label="記一筆帳" aria-describedby="money-add-preview" maxlength="200">
        <button class="btn primary" type="submit">${icon('plus')}記下來</button>
        <button class="btn ghost" type="button" data-action="money-new">詳細</button>
        <p class="qa-preview" id="money-add-preview" data-money-preview aria-live="polite"></p>
      </form>

      <div class="money-head">
        <div class="money-nav">
          <button type="button" class="icon-btn" data-action="money-month" data-step="-1" aria-label="上個月">${icon('left')}</button>
          <h2 class="money-month" aria-live="polite">${monthLabel(month)}</h2>
          <button type="button" class="icon-btn" data-action="money-month" data-step="1" aria-label="下個月">${icon('right')}</button>
          ${isNow ? '' : '<button type="button" class="btn small ghost" data-action="money-month" data-step="0">回到這個月</button>'}
        </div>
        <button type="button" class="btn small ghost" data-action="money-settings">${icon('settings')}貨幣、預算、分類</button>
      </div>

      <div class="money-stats">
        <div class="money-stat"><span class="money-stat-label">支出</span><span class="money-stat-num">${fmtMoney(sum.out, cur)}</span></div>
        <div class="money-stat"><span class="money-stat-label">收入</span><span class="money-stat-num">${fmtMoney(sum.in, cur)}</span></div>
        <div class="money-stat"><span class="money-stat-label">結餘</span><span class="money-stat-num${sum.net < 0 ? ' is-neg' : ''}">${fmtMoney(sum.net, cur)}</span></div>
      </div>
      ${others.length ? `<p class="hint money-others">另外還有其他貨幣：${esc(others.join('；'))}（不會換算，也不算在上面）</p>` : ''}
      ${budgetBox(sum, settings, month, today, cur)}

      <div class="money-grid">
        <section class="block" aria-labelledby="mt-cats">
          <header class="block-head"><h3 id="mt-cats" class="tape tape-1"><span aria-hidden="true">🧾</span>錢花在哪</h3></header>
          <div class="block-body">${catBars(sum, cats, cur)}</div>
        </section>
        ${trend(entries, month, cur, cats)}
      </div>

      <section class="money-list" aria-label="${monthLabel(month)}的紀錄">
        ${days.length ? days.map((d) => {
          const ds = summarize(d.items, cur, cats);
          const tail = [ds.out ? `支出 ${fmtMoney(ds.out, cur)}` : '', ds.in ? `收入 ${fmtMoney(ds.in, cur)}` : ''].filter(Boolean).join('・');
          return `<div class="money-day">
            <h3 class="group-title">${esc(dayLabel(d.key, today))}<span class="money-day-sum">${tail}</span></h3>
            <ul class="money-rows">${d.items.map((e) => entryRow(e, cats, cur)).join('')}</ul>
          </div>`;
        }).join('') : emptyState(isNow ? '這個月還沒有記帳。在上面輸入「午餐 8.5」，按 Enter 就記好了。' : `${monthLabel(month)}沒有紀錄。`)}
      </section>
    </div>`;
  },

  actions: {
    'money-month'(el, e, ctx) {
      const today = todayKey().slice(0, 7);
      const step = Number(el.dataset.step);
      ui.month = step === 0 ? '' : addMonths(ui.month || today, step);
      if (ui.month === today) ui.month = '';
      ctx.rerender();
    },
    'money-new'(el) {
      const input = el.form?.elements.text;
      const settings = store.state.settings;
      const p = input?.value.trim() ? parseMoney(input.value, { today: todayKey(), weekStart: settings.weekStart, cats: catsOf(settings) }) : null;
      openMoneyModal(null, p ? { title: p.title, amount: p.amount ?? '', type: p.type, cat: p.cat, date: p.date, currency: p.currency } : {}, {
        onSaved: () => {
          if (input) {
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        },
      });
    },
    'money-edit'(el) {
      const entry = store.state.ledger.find((x) => x.id === el.dataset.id);
      if (entry) openMoneyModal(entry);
    },
    'money-settings'() {
      openMoneySettings();
    },
  },

  input: {
    'money-preview'(el) {
      const box = el.form?.querySelector('[data-money-preview]');
      if (box) box.innerHTML = preview(el.value, store.state.settings);
    },
  },

  submit: {
    'money-add'(form, e, ctx) {
      const input = form.elements.text;
      if (!input.value.trim()) {
        input.focus();
        return;
      }
      const settings = store.state.settings;
      const cats = catsOf(settings);
      const p = parseMoney(input.value, { today: todayKey(), weekStart: settings.weekStart, cats });
      if (p.amount === null || p.amount <= 0) {
        toast('請寫上金額，例如「午餐 8.5」', { tone: 'error' });
        input.focus();
        return;
      }
      const currency = p.currency || currencyOf(settings);
      const amount = roundMoney(Math.min(p.amount, MONEY_MAX), currency);
      const data = { type: p.type, amount, currency, cat: p.cat, title: p.title, date: p.date };
      const id = store.addDoc('ledger', data);
      const cat = cats.find((c) => c.id === p.cat);
      toast(`已記下：${p.title || cat.name} ${fmtMoney(p.type === 'in' ? amount : -amount, currency, { sign: true })}（${cat.name}）`, {
        actionLabel: '修改',
        onAction: () => {
          const entry = store.state.ledger.find((x) => x.id === id);
          if (entry) openMoneyModal(entry);
        },
      });
      ctx.clearDrafts(form);
      form.querySelector('[data-money-preview]').innerHTML = '';
      input.focus();
    },
  },

  // 在這一頁按 N：記一筆
  onNew() {
    openMoneyModal(null);
  },
};

// ---------- 記一筆／編輯 ----------
function catPicks(cats, type, selected) {
  return cats.filter((c) => c.type === type).map((c) => `<label class="cat-pick"><input type="radio" name="cat" value="${esc(c.id)}"${c.id === selected ? ' checked' : ''}><span><span class="cat-emoji" aria-hidden="true">${esc(c.emoji)}</span>${esc(c.name)}</span></label>`).join('');
}

// defaults：{ title, amount, type, cat, date, currency, guess（用來猜分類的字）, fallback（猜不到時的分類） }
export function openMoneyModal(entry = null, defaults = {}, { onSaved } = {}) {
  const settings = store.state.settings;
  const cats = catsOf(settings);
  const base = entry || {
    type: defaults.type === 'in' ? 'in' : 'out',
    amount: defaults.amount ?? '',
    currency: defaults.currency || currencyOf(settings),
    cat: defaults.cat || '',
    title: defaults.title || '',
    date: defaults.date || todayKey(),
    note: '',
  };
  if (!entry && !base.cat && defaults.guess) {
    const p = parseMoney(`${defaults.guess} 1`, { today: todayKey(), cats });
    base.cat = p.cat !== fallbackCat(base.type) ? p.cat : (cats.some((c) => c.id === defaults.fallback && c.type === base.type) ? defaults.fallback : p.cat);
  }
  const selected = catOf({ type: base.type, cat: base.cat }, cats).id;
  const cur = base.currency || currencyOf(settings);
  const body = `
    <div class="seg money-type" role="radiogroup" aria-label="支出還是收入">
      <label class="seg-opt"><input type="radio" name="type" value="out"${base.type === 'out' ? ' checked' : ''}><span>支出</span></label>
      <label class="seg-opt"><input type="radio" name="type" value="in"${base.type === 'in' ? ' checked' : ''}><span>收入</span></label>
    </div>
    <div class="field"><label for="mm-amount">金額</label>
      <div class="money-input">
        <select name="currency" aria-label="貨幣">${CURRENCY_LIST.map((c) => `<option value="${c.id}"${c.id === cur ? ' selected' : ''}>${esc(c.symbol)}</option>`).join('')}</select>
        <input id="mm-amount" name="amount" value="${base.amount === '' ? '' : esc(String(base.amount))}" inputmode="decimal" autocomplete="off" autofocus placeholder="0">
      </div></div>
    <fieldset class="field"><legend>分類</legend>
      <div class="cat-picks" data-cat-picks>${catPicks(cats, base.type, selected)}</div></fieldset>
    <div class="field-row">
      <div class="field grow"><label for="mm-title">說明</label>
        <input id="mm-title" name="title" value="${esc(base.title)}" maxlength="100" autocomplete="off" placeholder="例如：午餐（可不填）"></div>
      <div class="field"><label for="mm-date">日期</label>
        <input id="mm-date" type="date" name="date" value="${esc(base.date)}"></div>
    </div>
    <div class="field"><label for="mm-note">備註</label>
      <input id="mm-note" name="note" value="${esc(base.note)}" maxlength="500" autocomplete="off" placeholder="可不填"></div>`;

  const extra = entry ? [{
    label: '刪除',
    icon: 'trash',
    className: 'ghost danger-text',
    onClick: () => {
      const doc = store.removeDoc('ledger', entry.id);
      toast('已刪除這筆紀錄', { actionLabel: '復原', onAction: () => store.restore('ledger', doc) });
    },
  }] : [];

  openModal({
    title: entry ? '編輯這筆帳' : '記一筆',
    body,
    submitLabel: entry ? '儲存' : '記下來',
    extra,
    onOpen(form) {
      // 換成收入／支出時，分類跟著換
      form.addEventListener('change', (e) => {
        if (e.target.name !== 'type') return;
        const type = e.target.value;
        const picks = form.querySelector('[data-cat-picks]');
        picks.innerHTML = catPicks(cats, type, fallbackCat(type));
      });
    },
    onSubmit(form) {
      const f = form.elements;
      const amount = readAmount(f.amount.value);
      if (amount === null || amount <= 0) {
        fieldError(form, 'amount', '請輸入金額，例如 8.5');
        return false;
      }
      if (amount > MONEY_MAX) {
        fieldError(form, 'amount', '金額太大了');
        return false;
      }
      if (!f.date.value) {
        fieldError(form, 'date', '請選日期');
        return false;
      }
      const type = form.querySelector('input[name="type"]:checked')?.value === 'in' ? 'in' : 'out';
      const currency = f.currency.value;
      const data = {
        type,
        amount: roundMoney(amount, currency),
        currency,
        cat: form.querySelector('input[name="cat"]:checked')?.value || fallbackCat(type),
        title: f.title.value.trim(),
        date: f.date.value,
        note: f.note.value.trim(),
      };
      if (entry) {
        store.updateDoc('ledger', entry.id, data);
        toast('已儲存');
      } else {
        store.addDoc('ledger', data);
        toast(`已記下 ${fmtMoney(type === 'in' ? data.amount : -data.amount, currency, { sign: true })}`);
      }
      onSaved?.();
      return true;
    },
  });
}

// ---------- 貨幣、預算、分類 ----------
function catRow(c, isDefault) {
  const locked = c.id === fallbackCat(c.type);
  return `<li class="cat-row" data-cat-row data-id="${esc(c.id)}" data-type="${c.type}">
    <input class="cat-emoji-input" name="emoji" value="${esc(c.emoji)}" maxlength="4" autocomplete="off" aria-label="「${esc(c.name)}」的圖示">
    <input class="cat-name-input" name="catname" value="${esc(c.name)}" maxlength="12" autocomplete="off" aria-label="分類名稱：${esc(c.name)}">
    ${locked ? '<span class="cat-lock">一定要有</span>' : `<button type="button" class="icon-btn small" data-cat-del aria-label="刪除分類「${esc(c.name)}」">${icon('trash')}</button>`}
  </li>`;
}

export function openMoneySettings() {
  const settings = store.state.settings;
  const cats = catsOf(settings);
  const cur = currencyOf(settings);
  const isDefault = !settings.ledgerCats.length;
  const list = (type) => `<ul class="cat-list" data-cat-list="${type}">${cats.filter((c) => c.type === type).map((c) => catRow(c, isDefault)).join('')}</ul>
    <button type="button" class="btn small ghost" data-cat-add="${type}">${icon('plus')}新增${type === 'in' ? '收入' : '支出'}分類</button>`;
  const body = `
    <div class="field-row">
      <div class="field grow"><label for="ms-cur">貨幣</label>
        <select id="ms-cur" name="currency">${CURRENCY_LIST.map((c) => `<option value="${c.id}"${c.id === cur ? ' selected' : ''}>${esc(c.symbol)} ${esc(c.name)}（${c.id}）</option>`).join('')}</select></div>
      <div class="field grow"><label for="ms-budget">每月支出預算（不填＝不設）</label>
        <input id="ms-budget" name="budget" value="${settings.budget || ''}" inputmode="decimal" autocomplete="off" placeholder="例如 500"></div>
    </div>
    <p class="hint">換貨幣之後，以前記的帳還是用原本的貨幣，不會換算。</p>
    <fieldset class="field"><legend>支出分類</legend>${list('out')}</fieldset>
    <fieldset class="field"><legend>收入分類</legend>${list('in')}</fieldset>
    ${isDefault ? '' : '<button type="button" class="link-btn" data-cat-reset>恢復預設分類</button>'}`;

  openModal({
    title: '貨幣、預算、分類',
    body,
    size: 'lg',
    onOpen(form) {
      form.addEventListener('click', (e) => {
        const add = e.target.closest('[data-cat-add]');
        if (add) {
          e.preventDefault();
          const type = add.dataset.catAdd;
          const ul = form.querySelector(`[data-cat-list="${type}"]`);
          if (form.querySelectorAll('[data-cat-row]').length >= 40) return;
          ul.insertAdjacentHTML('beforeend', catRow({ id: `c${uid().slice(0, 10)}`, type, name: '', emoji: type === 'in' ? '💰' : '🏷️' }));
          ul.lastElementChild.querySelector('.cat-name-input').focus();
          return;
        }
        const del = e.target.closest('[data-cat-del]');
        if (del) {
          e.preventDefault();
          const row = del.closest('[data-cat-row]');
          const next = row.nextElementSibling || row.previousElementSibling;
          row.remove();
          next?.querySelector('.cat-name-input')?.focus();
          return;
        }
        if (e.target.closest('[data-cat-reset]')) {
          e.preventDefault();
          for (const type of ['out', 'in']) {
            form.querySelector(`[data-cat-list="${type}"]`).innerHTML = DEFAULT_CATS.filter((c) => c.type === type).map((c) => catRow(c, true)).join('');
          }
        }
      });
    },
    onSubmit(form) {
      const f = form.elements;
      let budget = 0;
      if (f.budget.value.trim()) {
        budget = readAmount(f.budget.value);
        if (budget === null) {
          fieldError(form, 'budget', '請輸入數字，例如 500');
          return false;
        }
      }
      const rows = [...form.querySelectorAll('[data-cat-row]')];
      const next = [];
      const names = new Set();
      for (const row of rows) {
        const nameInput = row.querySelector('.cat-name-input');
        const name = nameInput.value.trim();
        const type = row.dataset.type;
        if (!name) {
          if (row.dataset.id === fallbackCat(type)) {
            nameInput.focus();
            toast('「其他」的名稱不能空白', { tone: 'error' });
            return false;
          }
          continue; // 沒寫名稱的新分類就不加
        }
        if (names.has(`${type}:${name}`)) {
          nameInput.focus();
          toast(`有兩個分類都叫「${name}」`, { tone: 'error' });
          return false;
        }
        names.add(`${type}:${name}`);
        next.push({ id: row.dataset.id, type, name, emoji: row.querySelector('.cat-emoji-input').value.trim() || (type === 'in' ? '💰' : '📦') });
      }
      const same = JSON.stringify(next) === JSON.stringify(DEFAULT_CATS.map(({ words, ...c }) => c));
      store.saveSettings({ currency: f.currency.value, budget: roundMoney(budget, f.currency.value), ledgerCats: same ? [] : next });
      toast('已儲存');
      return true;
    },
  });
}
