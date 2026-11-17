// 購物清單：快速加入（「牛奶 2瓶 #全聯」）、依店家分組、買到了打勾（可以順便記帳）、複製清單傳給別人
import { esc } from '../utils.js';
import { icon, toast, openModal, fieldError, confirmDialog } from '../ui.js';
import { store } from '../store.js';
import { emptyState } from '../components.js';
import { parseShop } from '../shoplist.js';
import { fmtMoney, currencyOf, readAmount, roundMoney } from '../money.js';
import { openMoneyModal } from './money.js';

const NO_STORE = '-';
const ui = { store: '' };

const byOrder = (a, b) => a.createdAt - b.createdAt;

function itemMeta(item, cur) {
  const meta = [];
  if (item.qty) meta.push(`<span class="tag">${esc(item.qty)}</span>`);
  if (item.price !== null) meta.push(`<span class="tag tag-price">${fmtMoney(item.price, cur)}</span>`);
  if (item.note) meta.push(`<span class="shop-note">${esc(item.note)}</span>`);
  return meta.length ? `<span class="task-tags">${meta.join('')}</span>` : '';
}

function itemRow(item, cur) {
  return `<li class="shop-item${item.done ? ' is-done' : ''}" data-id="${esc(item.id)}">
    <button type="button" class="check" role="checkbox" aria-checked="${item.done}" data-action="shop-toggle" data-id="${esc(item.id)}" aria-label="${item.done ? '還沒買' : '買到了'}：${esc(item.name)}">${icon('check')}</button>
    <button type="button" class="task-main" data-action="shop-edit" data-id="${esc(item.id)}">
      <span class="task-title">${esc(item.name)}</span>
      ${itemMeta(item, cur)}
    </button>
  </li>`;
}

function preview(text) {
  if (!text.trim()) return '';
  const p = parseShop(text);
  const parts = [];
  if (p.qty) parts.push(p.qty);
  if (p.store) parts.push(`#${p.store}`);
  if (p.price !== null) parts.push(fmtMoney(p.price, currencyOf(store.state.settings)));
  return parts.length ? `<span class="qa-label">會加上</span>${parts.map((x) => `<span class="qa-part">${esc(x)}</span>`).join('')}` : '';
}

// 依店家分組：有店家的照筆數排前面，沒寫店家的放最後
function groupByStore(items) {
  const groups = new Map();
  for (const it of items) {
    const key = it.store || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  return [...groups.entries()].sort((a, b) => (a[0] === '') - (b[0] === '') || b[1].length - a[1].length || a[0].localeCompare(b[0], 'zh-Hant'));
}

export function shoppingText(items) {
  const lines = ['🛒 購物清單'];
  for (const [name, list] of groupByStore(items)) {
    if (name || groupByStore(items).length > 1) lines.push('', name ? `【${name}】` : '【其他】');
    for (const it of list.sort(byOrder)) lines.push(`□ ${it.name}${it.qty ? ` ${it.qty}` : ''}${it.note ? `（${it.note}）` : ''}`);
  }
  return lines.join('\n');
}

export default {
  render(state) {
    const cur = currencyOf(state.settings);
    const all = state.shopping;
    const toBuy = all.filter((i) => !i.done);
    const bought = all.filter((i) => i.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
    const stores = groupByStore(toBuy).filter(([name]) => name);
    if (ui.store && ui.store !== NO_STORE && !stores.some(([name]) => name === ui.store)) ui.store = '';
    const visible = ui.store === NO_STORE ? toBuy.filter((i) => !i.store) : ui.store ? toBuy.filter((i) => i.store === ui.store) : toBuy;
    const groups = groupByStore(visible);
    const total = visible.reduce((sum, i) => sum + (i.price || 0), 0);
    const priced = visible.filter((i) => i.price !== null).length;

    let body;
    if (!all.length) {
      body = emptyState('還沒有要買的東西。在上面輸入，按 Enter 就會加入，例如「牛奶 2瓶 #全聯」。');
    } else if (!toBuy.length) {
      body = emptyState('都買齊了！', '', 'happy');
    } else {
      body = groups.map(([name, items]) => `
        <section class="task-group shop-group" aria-label="${esc(name || '沒寫店家')}">
          ${groups.length > 1 || name ? `<h3 class="group-title"><span class="group-emoji" aria-hidden="true">${name ? '🏪' : '🛒'}</span>${esc(name || '沒寫店家')}<span class="count">${items.length}</span></h3>` : ''}
          <ul class="task-list shop-list">${items.sort(byOrder).map((i) => itemRow(i, cur)).join('')}</ul>
        </section>`).join('');
    }

    return `
    <div class="shop-view">
      <form class="add-bar shop-add" data-submit="shop-add">
        <input name="name" data-keep="shop-add" data-input="shop-preview" data-preview placeholder="要買什麼？例如：牛奶 2瓶 #全聯" autocomplete="off" aria-label="要買的東西" aria-describedby="shop-add-preview" maxlength="200">
        <button class="btn primary" type="submit">${icon('plus')}加入</button>
        <p class="qa-preview" id="shop-add-preview" data-shop-preview aria-live="polite"></p>
      </form>

      ${toBuy.length ? `<div class="toolbar shop-toolbar">
        ${stores.length ? `<div class="chips" role="group" aria-label="依店家篩選">
          <button type="button" class="chip${ui.store ? '' : ' is-active'}" aria-pressed="${!ui.store}" data-action="shop-store" data-value="">全部 ${toBuy.length}</button>
          ${stores.map(([name, items]) => `<button type="button" class="chip${ui.store === name ? ' is-active' : ''}" aria-pressed="${ui.store === name}" data-action="shop-store" data-value="${esc(name)}">${esc(name)} ${items.length}</button>`).join('')}
          ${toBuy.some((i) => !i.store) ? `<button type="button" class="chip${ui.store === NO_STORE ? ' is-active' : ''}" aria-pressed="${ui.store === NO_STORE}" data-action="shop-store" data-value="${NO_STORE}">沒寫店家</button>` : ''}
        </div>` : ''}
        <span class="shop-sum">${priced ? `預估 ${fmtMoney(roundMoney(total, cur), cur)}${priced < visible.length ? `（${visible.length - priced} 樣沒寫價錢）` : ''}` : ''}</span>
        <button type="button" class="btn small ghost" data-action="shop-copy">${icon('copy')}複製清單</button>
      </div>` : ''}

      ${body}

      ${bought.length ? `<section class="task-group shop-bought" aria-labelledby="shop-bought-title">
        <div class="group-head">
          <h3 class="group-title" id="shop-bought-title"><span class="group-emoji" aria-hidden="true">✅</span>已買<span class="count">${bought.length}</span></h3>
          <button type="button" class="btn small ghost" data-action="shop-clear">${icon('trash')}清除已買</button>
        </div>
        <ul class="task-list shop-list">${bought.slice(0, 30).map((i) => itemRow(i, cur)).join('')}</ul>
      </section>` : ''}
      <p class="cal-tip">提示：「#店家」會分組，「2瓶」「x2」是數量，「£3.5」「120元」是價錢。買到了打勾時，可以順便記到記帳簿。</p>
    </div>`;
  },

  actions: {
    'shop-store'(el, e, ctx) {
      ui.store = ui.store === el.dataset.value ? '' : el.dataset.value;
      ctx.rerender();
    },
    'shop-toggle'(el) {
      const item = store.state.shopping.find((i) => i.id === el.dataset.id);
      if (!item) return;
      if (item.done) {
        store.updateDoc('shopping', item.id, { done: false, doneAt: null });
        return;
      }
      store.updateDoc('shopping', item.id, { done: true, doneAt: Date.now() });
      toast(`已買「${item.name}」`, {
        actionLabel: '記帳',
        onAction: () => openMoneyModal(null, { title: item.name, amount: item.price ?? '', type: 'out', guess: `${item.name} ${item.store}`, fallback: 'shopping' }),
      });
    },
    'shop-edit'(el) {
      const item = store.state.shopping.find((i) => i.id === el.dataset.id);
      if (item) openItemModal(item);
    },
    async 'shop-copy'() {
      const items = store.state.shopping.filter((i) => !i.done);
      const visible = ui.store === NO_STORE ? items.filter((i) => !i.store) : ui.store ? items.filter((i) => i.store === ui.store) : items;
      try {
        await navigator.clipboard.writeText(shoppingText(visible));
        toast('已複製購物清單，可以貼到 LINE 或訊息裡');
      } catch {
        toast('沒辦法複製，請在瀏覽器允許使用剪貼簿', { tone: 'error' });
      }
    },
    async 'shop-clear'() {
      const list = store.state.shopping.filter((i) => i.done);
      if (!list.length) return;
      const ok = list.length < 5 || await confirmDialog(`會清掉 ${list.length} 樣已經買到的東西。`, { title: '清除已買？', confirmLabel: '清除' });
      if (!ok) return;
      const docs = list.map((i) => store.removeDoc('shopping', i.id));
      toast(`已清除 ${docs.length} 樣`, { actionLabel: '復原', onAction: () => docs.forEach((d) => store.restore('shopping', d)) });
    },
  },

  input: {
    'shop-preview'(el) {
      const box = el.form?.querySelector('[data-shop-preview]');
      if (box) box.innerHTML = preview(el.value);
    },
  },

  submit: {
    'shop-add'(form, e, ctx) {
      const input = form.elements.name;
      const p = parseShop(input.value);
      if (!p.name) {
        if (input.value.trim()) toast('請輸入要買的東西', { tone: 'error' });
        input.focus();
        return;
      }
      const storeName = p.store || (ui.store && ui.store !== NO_STORE ? ui.store : '');
      store.addDoc('shopping', { name: p.name, qty: p.qty, store: storeName, price: p.price });
      ctx.clearDrafts(form);
      form.querySelector('[data-shop-preview]').innerHTML = '';
      input.focus();
    },
  },

  // 在這一頁按 N：輸入要買的東西
  onNew() {
    document.querySelector('.shop-add input')?.focus();
  },
};

export function openItemModal(item) {
  const cur = currencyOf(store.state.settings);
  const stores = [...new Set(store.state.shopping.map((i) => i.store).filter(Boolean))].sort();
  const body = `
    <div class="field"><label for="sm-name">要買什麼</label>
      <input id="sm-name" name="name" value="${esc(item.name)}" maxlength="120" autocomplete="off" autofocus></div>
    <div class="field-row">
      <div class="field grow"><label for="sm-qty">數量</label>
        <input id="sm-qty" name="qty" value="${esc(item.qty)}" maxlength="20" autocomplete="off" placeholder="例如：2瓶"></div>
      <div class="field grow"><label for="sm-price">價錢（${esc(fmtMoney(0, cur).replace(/[\d.,]+$/, ''))}，可不填）</label>
        <input id="sm-price" name="price" value="${item.price ?? ''}" inputmode="decimal" autocomplete="off" placeholder="0"></div>
    </div>
    <div class="field"><label for="sm-store">店家</label>
      <input id="sm-store" name="store" value="${esc(item.store)}" maxlength="30" autocomplete="off" list="sm-stores" placeholder="例如：全聯、Tesco">
      <datalist id="sm-stores">${stores.map((s) => `<option value="${esc(s)}"></option>`).join('')}</datalist></div>
    <div class="field"><label for="sm-note">備註</label>
      <input id="sm-note" name="note" value="${esc(item.note)}" maxlength="300" autocomplete="off" placeholder="例如：要低脂的"></div>`;

  openModal({
    title: '編輯要買的東西',
    body,
    extra: [{
      label: '刪除',
      icon: 'trash',
      className: 'ghost danger-text',
      onClick: () => {
        const doc = store.removeDoc('shopping', item.id);
        toast(`已刪除「${item.name}」`, { actionLabel: '復原', onAction: () => store.restore('shopping', doc) });
      },
    }],
    onSubmit(form) {
      const f = form.elements;
      const name = f.name.value.trim();
      if (!name) {
        fieldError(form, 'name', '請輸入要買的東西');
        return false;
      }
      let price = null;
      if (f.price.value.trim()) {
        price = readAmount(f.price.value);
        if (price === null) {
          fieldError(form, 'price', '價錢請輸入數字，例如 3.5');
          return false;
        }
      }
      store.updateDoc('shopping', item.id, { name, qty: f.qty.value.trim(), store: f.store.value.trim(), price, note: f.note.value.trim() });
      toast('已儲存');
      return true;
    },
  });
}
