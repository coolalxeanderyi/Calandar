// 購物清單：快速加入（「牛奶 2瓶 #全聯」）、依類別或店家分組、買到了打勾（可以順便記帳）、複製清單傳給別人
// 購物清單的類別跟記帳簿的類別分開，各自可以新增、改名、刪除
import { esc, uid } from '../utils.js';
import { icon, toast, openModal, fieldError, confirmDialog } from '../ui.js';
import { store } from '../store.js';
import { emptyState, catAdder, bindCatAdder } from '../components.js';
import { parseShop, shopCatsOf, shopCatOf, guessShopCat, ledgerCatFor, DEFAULT_SHOP_CATS } from '../shoplist.js';
import { fmtMoney, currencyOf, readAmount, roundMoney, catsOf, parseMoney, fallbackCat } from '../money.js';
import { openMoneyModal } from './money.js';

const NO_STORE = '-';
const GROUP_KEY = 'planner.shop.group';
const readGroup = () => {
  try {
    return localStorage.getItem(GROUP_KEY) === 'store' ? 'store' : 'cat';
  } catch {
    return 'cat';
  }
};
const ui = { store: '', group: readGroup() };

const byOrder = (a, b) => a.createdAt - b.createdAt;

// 新增時用哪個類別：自己選的 > #類別 > 看名稱猜 > 其他
function pickCat(chosen, parsed, cats) {
  if (chosen && cats.some((c) => c.id === chosen)) return chosen;
  if (parsed.cat) return parsed.cat;
  return guessShopCat(parsed.name, cats)?.id || 'other';
}

function itemMeta(item, cur, cats) {
  const meta = [];
  if (item.qty) meta.push(`<span class="tag">${esc(item.qty)}</span>`);
  if (ui.group === 'cat' && item.store) meta.push(`<span class="tag tag-store">🏪 ${esc(item.store)}</span>`);
  if (ui.group === 'store') {
    const c = shopCatOf(item, cats);
    meta.push(`<span class="tag tag-cat">${esc(c.emoji)} ${esc(c.name)}</span>`);
  }
  if (item.price !== null) meta.push(`<span class="tag tag-price">${fmtMoney(item.price, cur)}</span>`);
  if (item.note) meta.push(`<span class="shop-note">${esc(item.note)}</span>`);
  return meta.length ? `<span class="task-tags">${meta.join('')}</span>` : '';
}

// 刪除一項（可以復原）：視窗裡的「刪除」和往左滑都用這個
export function deleteShopItem(id) {
  const item = store.state.shopping.find((i) => i.id === id);
  if (!item) return;
  const doc = store.removeDoc('shopping', id);
  toast(`已刪除「${item.name}」`, { actionLabel: '復原', onAction: () => store.restore('shopping', doc) });
}

function itemRow(item, cur, cats) {
  return `<li class="task shop-item${item.done ? ' is-done' : ''}" data-id="${esc(item.id)}" data-swipe="shop">
    <button type="button" class="check" role="checkbox" aria-checked="${item.done}" data-action="shop-toggle" data-id="${esc(item.id)}" aria-label="${item.done ? '還沒買' : '買到了'}：${esc(item.name)}">${icon('check')}</button>
    <button type="button" class="task-main" data-action="shop-edit" data-id="${esc(item.id)}">
      <span class="task-title">${esc(item.name)}</span>
      ${itemMeta(item, cur, cats)}
    </button>
  </li>`;
}

function preview(form) {
  const text = form.elements.name.value;
  if (!text.trim()) return '';
  const cats = shopCatsOf(store.state.settings);
  const p = parseShop(text, cats);
  const cat = cats.find((c) => c.id === pickCat(form.elements.cat.value, p, cats));
  const parts = [`${cat.emoji} ${cat.name}`];
  if (p.qty) parts.push(p.qty);
  if (p.store) parts.push(`🏪 ${p.store}`);
  if (p.price !== null) parts.push(fmtMoney(p.price, currencyOf()));
  if (p.note) parts.push(`備註：${p.note}`);
  return `<span class="qa-label">會加上</span>${parts.map((x) => `<span class="qa-part">${esc(x)}</span>`).join('')}`;
}

// 分組：依類別（照類別的順序，「其他」最後）或依店家（筆數多的在前，沒寫店家的最後）
function groupItems(items, cats) {
  if (ui.group === 'cat') {
    const map = new Map(cats.map((c) => [c.id, []]));
    for (const it of items) map.get(shopCatOf(it, cats).id).push(it);
    const order = [...cats.filter((c) => c.id !== 'other'), cats.find((c) => c.id === 'other')];
    return order.filter((c) => map.get(c.id).length).map((c) => ({ key: c.id, label: c.name, emoji: c.emoji, items: map.get(c.id) }));
  }
  const map = new Map();
  for (const it of items) {
    const key = it.store || '';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(it);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] === '') - (b[0] === '') || b[1].length - a[1].length || a[0].localeCompare(b[0], 'zh-Hant'))
    .map(([key, list]) => ({ key, label: key || '沒寫店家', emoji: key ? '🏪' : '🛒', items: list }));
}

export function shoppingText(items, cats = shopCatsOf(store.state.settings)) {
  const lines = ['🛒 購物清單'];
  const groups = groupItems(items, cats);
  for (const g of groups) {
    if (groups.length > 1 || ui.group === 'cat' || g.key) lines.push('', `【${g.label}】`);
    for (const it of g.items.sort(byOrder)) lines.push(`□ ${it.name}${it.qty ? ` ${it.qty}` : ''}${it.note ? `（${it.note}）` : ''}`);
  }
  return lines.join('\n');
}

function storesOf(items) {
  const counts = new Map();
  for (const it of items) if (it.store) counts.set(it.store, (counts.get(it.store) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hant'));
}

function catOptions(cats, selected = '', { auto = false } = {}) {
  return `${auto ? `<option value=""${selected ? '' : ' selected'}>類別：自動判斷</option>` : ''}${cats.map((c) => `<option value="${esc(c.id)}"${c.id === selected ? ' selected' : ''}>${esc(c.emoji)} ${esc(c.name)}</option>`).join('')}`;
}

export default {
  render(state) {
    const cur = currencyOf();
    const cats = shopCatsOf(state.settings);
    const all = state.shopping;
    const toBuy = all.filter((i) => !i.done);
    const bought = all.filter((i) => i.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
    const stores = storesOf(toBuy);
    if (ui.store && ui.store !== NO_STORE && !stores.some(([name]) => name === ui.store)) ui.store = '';
    const visible = ui.store === NO_STORE ? toBuy.filter((i) => !i.store) : ui.store ? toBuy.filter((i) => i.store === ui.store) : toBuy;
    const groups = groupItems(visible, cats);
    const total = visible.reduce((sum, i) => sum + (i.price || 0), 0);
    const priced = visible.filter((i) => i.price !== null).length;

    let body;
    if (!all.length) {
      body = emptyState('還沒有要買的東西。在上面輸入，按 Enter 就會加入，例如「牛奶 2瓶 #全聯」。');
    } else if (!toBuy.length) {
      body = emptyState('都買齊了！', '', 'happy');
    } else {
      body = groups.map((g) => `
        <section class="task-group shop-group" aria-label="${esc(g.label)}">
          <h3 class="group-title"><span class="group-emoji" aria-hidden="true">${esc(g.emoji)}</span>${esc(g.label)}<span class="count">${g.items.length}</span></h3>
          <ul class="task-list shop-list">${g.items.sort(byOrder).map((i) => itemRow(i, cur, cats)).join('')}</ul>
        </section>`).join('');
    }

    return `
    <div class="shop-view">
      <form class="add-bar shop-add" data-submit="shop-add">
        <input name="name" data-keep="shop-add" data-input="shop-preview" data-preview placeholder="要買什麼？例如：牛奶 2瓶 #全聯" autocomplete="off" aria-label="要買的東西" aria-describedby="shop-add-preview" maxlength="200">
        <input name="note" data-keep="shop-add-note" placeholder="備註（可不填），例如：要低脂的" autocomplete="off" aria-label="備註" maxlength="300">
        <select name="cat" data-keep="shop-add-cat" data-input="shop-preview" aria-label="類別">${catOptions(cats, '', { auto: true })}</select>
        <button class="btn primary" type="submit">${icon('plus')}加入</button>
        <button class="btn ghost" type="button" data-action="shop-new">詳細</button>
        <p class="qa-preview" id="shop-add-preview" data-shop-preview aria-live="polite"></p>
      </form>

      <div class="toolbar shop-toolbar">
        <div class="seg seg-buttons" role="group" aria-label="分組方式">
          <button type="button" class="seg-btn${ui.group === 'cat' ? ' is-on' : ''}" aria-pressed="${ui.group === 'cat'}" data-action="shop-group" data-value="cat">依類別</button>
          <button type="button" class="seg-btn${ui.group === 'store' ? ' is-on' : ''}" aria-pressed="${ui.group === 'store'}" data-action="shop-group" data-value="store">依店家</button>
        </div>
        ${stores.length ? `<div class="chips" role="group" aria-label="依店家篩選">
          <button type="button" class="chip${ui.store ? '' : ' is-active'}" aria-pressed="${!ui.store}" data-action="shop-store" data-value="">全部店家</button>
          ${stores.map(([name, n]) => `<button type="button" class="chip${ui.store === name ? ' is-active' : ''}" aria-pressed="${ui.store === name}" data-action="shop-store" data-value="${esc(name)}">${esc(name)} ${n}</button>`).join('')}
          ${toBuy.some((i) => !i.store) ? `<button type="button" class="chip${ui.store === NO_STORE ? ' is-active' : ''}" aria-pressed="${ui.store === NO_STORE}" data-action="shop-store" data-value="${NO_STORE}">沒寫店家</button>` : ''}
        </div>` : ''}
        <span class="shop-sum">${priced ? `預估 ${fmtMoney(roundMoney(total, cur), cur)}${priced < visible.length ? `（${visible.length - priced} 樣沒寫價錢）` : ''}` : ''}</span>
        <div class="btn-row shop-tools">
          ${toBuy.length ? `<button type="button" class="btn small ghost" data-action="shop-copy">${icon('copy')}複製清單</button>` : ''}
          <button type="button" class="btn small ghost" data-action="shop-cats">${icon('tag')}管理類別</button>
        </div>
      </div>

      ${body}

      ${bought.length ? `<section class="task-group shop-bought" aria-labelledby="shop-bought-title">
        <div class="group-head">
          <h3 class="group-title" id="shop-bought-title"><span class="group-emoji" aria-hidden="true">✅</span>已買<span class="count">${bought.length}</span></h3>
          <button type="button" class="btn small ghost" data-action="shop-clear">${icon('trash')}清除已買</button>
        </div>
        <ul class="task-list shop-list">${bought.slice(0, 30).map((i) => itemRow(i, cur, cats)).join('')}</ul>
      </section>` : ''}
      <p class="cal-tip">提示：會依名稱自動分類，也可以在「類別」選，或打「#類別名稱」。「#店家」記店家，「2瓶」「x2」是數量，「120元」是價錢，括號裡的字是備註。買到了打勾時，可以順便記到記帳簿。</p>
    </div>`;
  },

  actions: {
    'shop-group'(el, e, ctx) {
      ui.group = el.dataset.value === 'store' ? 'store' : 'cat';
      try {
        localStorage.setItem(GROUP_KEY, ui.group);
      } catch { /* 無痕模式 */ }
      ctx.rerender();
    },
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
        onAction: () => {
          // 記帳用記帳簿自己的類別（例如蔬果、肉類 → 飲食）
          const settings = store.state.settings;
          const ledgerCats = catsOf(settings);
          const guess = (name) => {
            const p = parseMoney(`${name} ${item.name} 1`, { today: '2000-01-01', cats: ledgerCats });
            return p.cat !== fallbackCat('out') ? p.cat : '';
          };
          const cat = ledgerCatFor(shopCatOf(item, shopCatsOf(settings)), ledgerCats, guess);
          openMoneyModal(null, { title: item.name, amount: item.price ?? '', type: 'out', cat });
        },
      });
    },
    'shop-edit'(el) {
      const item = store.state.shopping.find((i) => i.id === el.dataset.id);
      if (item) openItemModal(item);
    },
    // 「詳細」：一欄一欄填（剛剛打到一半的字會帶進去）
    'shop-new'(el, e, ctx) {
      const form = el.form;
      const cats = shopCatsOf(store.state.settings);
      const p = parseShop(form.elements.name.value, cats);
      const note = [p.note, form.elements.note.value.trim()].filter(Boolean).join('，');
      const storeName = p.store || (ui.store && ui.store !== NO_STORE ? ui.store : '');
      const cat = p.name || form.elements.cat.value || p.cat ? pickCat(form.elements.cat.value, p, cats) : '';
      openItemModal(null, { name: p.name, qty: p.qty, store: storeName, price: p.price, note, cat }, {
        onSaved: () => {
          ctx.forgetDrafts(['shop-add', 'shop-add-note', 'shop-add-cat']);
          if (!form.isConnected) return;
          form.elements.name.value = '';
          form.elements.note.value = '';
          form.elements.cat.value = '';
          form.querySelector('[data-shop-preview]').innerHTML = '';
        },
      });
    },
    'shop-cats'() {
      openShopCats();
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
      if (box) box.innerHTML = preview(el.form);
    },
  },

  submit: {
    'shop-add'(form, e, ctx) {
      const input = form.elements.name;
      const cats = shopCatsOf(store.state.settings);
      const p = parseShop(input.value, cats);
      if (!p.name) {
        if (input.value.trim()) toast('請輸入要買的東西', { tone: 'error' });
        input.focus();
        return;
      }
      const storeName = p.store || (ui.store && ui.store !== NO_STORE ? ui.store : '');
      const note = [p.note, form.elements.note.value.trim()].filter(Boolean).join('，');
      const cat = pickCat(form.elements.cat.value, p, cats);
      store.addDoc('shopping', { name: p.name, qty: p.qty, store: storeName, cat, price: p.price, note });
      ctx.clearDrafts(form);
      form.elements.note.value = '';
      form.elements.cat.value = '';
      form.querySelector('[data-shop-preview]').innerHTML = '';
      input.focus();
    },
  },

  // 在這一頁按 N：輸入要買的東西
  onNew() {
    document.querySelector('.shop-add input[name="name"]')?.focus();
  },
};

// ---------- 類別：新增一個（在選類別的地方直接加） ----------
function addShopCat(name, emoji) {
  const settings = store.state.settings;
  const cats = shopCatsOf(settings);
  const same = cats.find((c) => c.name === name);
  if (same) return same;
  const cat = { id: `c${uid().slice(0, 10)}`, name: name.slice(0, 12), emoji: emoji || '🏷️' };
  // 新類別放在「其他」前面
  const at = cats.findIndex((c) => c.id === 'other');
  const next = at < 0 ? [...cats, cat] : [...cats.slice(0, at), cat, ...cats.slice(at)];
  store.saveSettings({ shopCats: next });
  return cat;
}

function catPicks(cats, selected) {
  return cats.map((c) => `<label class="cat-pick"><input type="radio" name="cat" value="${esc(c.id)}"${c.id === selected ? ' checked' : ''}><span><span class="cat-emoji" aria-hidden="true">${esc(c.emoji)}</span>${esc(c.name)}</span></label>`).join('');
}

// item：要編輯的東西；null＝新增（defaults 是預先填好的欄位）
export function openItemModal(item, defaults = {}, { onSaved } = {}) {
  const isNew = !item;
  item = item || { name: '', qty: '', store: '', cat: '', price: null, note: '', ...defaults };
  let cats = shopCatsOf(store.state.settings);
  const selected = item.cat && cats.some((c) => c.id === item.cat) ? item.cat : isNew ? '' : 'other';
  const stores = [...new Set(store.state.shopping.map((i) => i.store).filter(Boolean))].sort();
  const body = `
    <div class="field"><label for="sm-name">要買什麼</label>
      <input id="sm-name" name="name" value="${esc(item.name)}" maxlength="120" autocomplete="off" autofocus></div>
    <fieldset class="field"><legend>類別${isNew ? '（不選會依名稱自動判斷）' : ''}</legend>
      <div class="cat-picks" data-cat-picks>${catPicks(cats, selected)}${catAdder()}</div></fieldset>
    <div class="field-row">
      <div class="field grow"><label for="sm-qty">數量</label>
        <input id="sm-qty" name="qty" value="${esc(item.qty)}" maxlength="20" autocomplete="off" placeholder="例如：2瓶"></div>
      <div class="field grow"><label for="sm-price">價錢（新台幣，可不填）</label>
        <input id="sm-price" name="price" value="${item.price ?? ''}" inputmode="decimal" autocomplete="off" placeholder="0"></div>
    </div>
    <div class="field"><label for="sm-store">店家</label>
      <input id="sm-store" name="store" value="${esc(item.store)}" maxlength="30" autocomplete="off" list="sm-stores" placeholder="例如：全聯、Tesco">
      <datalist id="sm-stores">${stores.map((s) => `<option value="${esc(s)}"></option>`).join('')}</datalist></div>
    <div class="field"><label for="sm-note">備註</label>
      <input id="sm-note" name="note" value="${esc(item.note)}" maxlength="300" autocomplete="off" placeholder="例如：要低脂的"></div>`;

  openModal({
    title: isNew ? '新增要買的東西' : '編輯要買的東西',
    body,
    submitLabel: isNew ? '加入' : '儲存',
    extra: isNew ? [] : [{
      label: '刪除',
      icon: 'trash',
      className: 'ghost danger-text',
      onClick: () => deleteShopItem(item.id),
    }],
    onOpen(form) {
      bindCatAdder(form, (name, emoji) => {
        const cat = addShopCat(name, emoji);
        cats = shopCatsOf(store.state.settings).some((c) => c.id === cat.id) ? shopCatsOf(store.state.settings) : [...cats.filter((c) => c.id !== cat.id), cat];
        const picks = form.querySelector('[data-cat-picks]');
        picks.querySelectorAll('.cat-pick').forEach((el) => el.remove());
        picks.insertAdjacentHTML('afterbegin', catPicks(cats, cat.id));
        picks.querySelector(`input[value="${CSS.escape(cat.id)}"]`)?.focus();
        return true;
      });
    },
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
          fieldError(form, 'price', '價錢請輸入數字，例如 45');
          return false;
        }
      }
      const chosen = form.querySelector('input[name="cat"]:checked')?.value || '';
      const cat = chosen || guessShopCat(name, cats)?.id || 'other';
      const data = { name, qty: f.qty.value.trim(), store: f.store.value.trim(), cat, price, note: f.note.value.trim() };
      if (isNew) {
        store.addDoc('shopping', data);
        toast(`已加入「${name}」`);
      } else {
        store.updateDoc('shopping', item.id, data);
        toast('已儲存');
      }
      onSaved?.();
      return true;
    },
  });
}

// ---------- 類別：新增、改名、換圖示、刪除（只影響購物清單，不會動到記帳的類別） ----------
function catRow(c) {
  const locked = c.id === 'other';
  return `<li class="cat-row" data-cat-row data-id="${esc(c.id)}">
    <input class="cat-emoji-input" name="emoji" value="${esc(c.emoji)}" maxlength="4" autocomplete="off" aria-label="「${esc(c.name)}」的圖示">
    <input class="cat-name-input" name="catname" value="${esc(c.name)}" maxlength="12" autocomplete="off" aria-label="類別名稱：${esc(c.name)}">
    ${locked ? '<span class="cat-lock">一定要有</span>' : `<button type="button" class="icon-btn small" data-cat-del aria-label="刪除類別「${esc(c.name)}」">${icon('trash')}</button>`}
  </li>`;
}

export function openShopCats() {
  const settings = store.state.settings;
  const cats = shopCatsOf(settings);
  const isDefault = !settings.shopCats.length;
  const body = `
    <p class="hint">這是購物清單的類別，跟記帳簿的類別分開。刪掉的類別裡的東西會移到「其他」。</p>
    <ul class="cat-list" data-cat-list>${cats.map(catRow).join('')}</ul>
    <div class="btn-row">
      <button type="button" class="btn small ghost" data-cat-add-row>${icon('plus')}新增類別</button>
      ${isDefault ? '' : '<button type="button" class="link-btn" data-cat-reset>恢復預設類別</button>'}
    </div>`;

  openModal({
    title: '購物清單的類別',
    body,
    size: 'md',
    onOpen(form) {
      form.addEventListener('click', (e) => {
        if (e.target.closest('[data-cat-add-row]')) {
          e.preventDefault();
          const ul = form.querySelector('[data-cat-list]');
          if (ul.children.length >= 40) return;
          const other = ul.querySelector('[data-id="other"]');
          other.insertAdjacentHTML('beforebegin', catRow({ id: `c${uid().slice(0, 10)}`, name: '', emoji: '🏷️' }));
          other.previousElementSibling.querySelector('.cat-name-input').focus();
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
          form.querySelector('[data-cat-list]').innerHTML = DEFAULT_SHOP_CATS.map(catRow).join('');
        }
      });
    },
    onSubmit(form) {
      const next = [];
      const names = new Set();
      for (const row of form.querySelectorAll('[data-cat-row]')) {
        const nameInput = row.querySelector('.cat-name-input');
        const name = nameInput.value.trim();
        if (!name) {
          if (row.dataset.id === 'other') {
            nameInput.focus();
            toast('「其他」的名稱不能空白', { tone: 'error' });
            return false;
          }
          continue; // 沒寫名稱的新類別就不加
        }
        if (names.has(name)) {
          nameInput.focus();
          toast(`有兩個類別都叫「${name}」`, { tone: 'error' });
          return false;
        }
        names.add(name);
        next.push({ id: row.dataset.id, name, emoji: row.querySelector('.cat-emoji-input').value.trim() || '🏷️' });
      }
      const same = JSON.stringify(next) === JSON.stringify(DEFAULT_SHOP_CATS.map(({ words, ledger, ...c }) => c));
      store.saveSettings({ shopCats: same ? [] : next });
      toast('已儲存類別');
      return true;
    },
  });
}
