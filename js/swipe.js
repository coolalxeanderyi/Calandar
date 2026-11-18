// 手機滑動手勢：任務、購物清單往右滑＝完成（再滑一次＝取消完成），往左滑＝刪除（可以復原）
// 只用在觸控螢幕。上下捲動、長按拖曳到時間軸都照舊。
import { timelineDragging } from './timeline.js';

const START = 12; // 手指橫向移動超過這麼多 px 才算在滑
const MIN_TRIGGER = 80; // 至少要滑這麼遠
const RATIO = 0.3; // 或是列寬的 30%（取比較大的那個，但不超過 160px）
const MAX_TRIGGER = 160;
const BLOCKED_PULL = 28; // 不能往那邊滑時，最多只拉動這麼一點

let g = null; // 目前的手勢
let pending = false;
let suppressUntil = 0;
let opts = { onSwipe: () => {}, onBlocked: () => {}, rerender: () => {} };

export const swiping = () => !!g?.locked;

// 滑動中先不要重畫（不然手指下的那一列會被換掉），放開之後再畫
export function deferSwipeRender() {
  if (!g || g.locked !== 'x') return false;
  pending = true;
  return true;
}

export function initSwipe(options) {
  opts = { ...opts, ...options };
  document.addEventListener('touchstart', onStart, { passive: true });
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd);
  document.addEventListener('touchcancel', () => reset(true));
  // 滑完放開時，不要順便點開任務
  document.addEventListener('click', (e) => {
    if (Date.now() < suppressUntil) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
}

function onStart(e) {
  if (g || e.touches.length !== 1) {
    if (g) reset(true);
    return;
  }
  const row = e.target.closest?.('[data-swipe]');
  if (!row || row.closest('.modal') || e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
  const t = e.touches[0];
  g = {
    row,
    x0: t.clientX,
    y0: t.clientY,
    dx: 0,
    locked: null, // null＝還不知道、'x'＝橫向在滑、'y'＝在捲動頁面
    width: row.getBoundingClientRect().width,
    armed: false,
  };
}

function trigger() {
  return Math.min(MAX_TRIGGER, Math.max(MIN_TRIGGER, g.width * RATIO));
}

const allowed = (row, dir) => row.dataset[dir === 'right' ? 'swipeRight' : 'swipeLeft'] !== '0';

function onMove(e) {
  if (!g) return;
  if (timelineDragging() || e.touches.length !== 1) {
    reset(true);
    return;
  }
  const t = e.touches[0];
  const dx = t.clientX - g.x0;
  const dy = t.clientY - g.y0;
  if (!g.locked) {
    if (Math.abs(dx) < START && Math.abs(dy) < START) return;
    if (Math.abs(dy) >= Math.abs(dx)) {
      g.locked = 'y'; // 在捲動：不管了
      return;
    }
    g.locked = 'x';
    g.row.classList.add('is-swiping');
    labels(g.row);
  }
  if (g.locked !== 'x') return;
  if (e.cancelable) e.preventDefault(); // 橫向在滑：頁面不要跟著捲
  const dir = dx > 0 ? 'right' : 'left';
  let x = dx - Math.sign(dx) * START; // 從 0 開始，不要一下跳 12px
  if (!allowed(g.row, dir)) x = Math.sign(x) * Math.min(BLOCKED_PULL, Math.abs(x) * 0.25);
  g.dx = x;
  g.dir = dir;
  const armed = allowed(g.row, dir) && Math.abs(x) >= trigger();
  if (armed !== g.armed) {
    g.armed = armed;
    g.row.classList.toggle('is-armed', armed);
    if (armed) navigator.vibrate?.(8);
  }
  g.row.classList.toggle('swipe-right', x > 0);
  g.row.classList.toggle('swipe-left', x < 0);
  g.row.style.setProperty('--swipe-x', `${Math.round(x)}px`);
}

// 底下露出來的字：右滑「完成／取消完成」、左滑「刪除」
function labels(row) {
  const done = row.classList.contains('is-done');
  const shop = row.dataset.swipe === 'shop';
  row.dataset.swipeR = done ? (shop ? '↩ 還沒買' : '↩ 取消完成') : (shop ? '✓ 買到了' : '✓ 完成');
  row.dataset.swipeL = '刪除 ✕';
}

function onEnd() {
  if (!g) return;
  const { row, locked, armed, dir, dx } = g;
  if (locked !== 'x') {
    g = null;
    return;
  }
  suppressUntil = Date.now() + 400;
  if (!armed) {
    if (dir && !allowed(row, dir) && Math.abs(dx) >= BLOCKED_PULL * 0.6) opts.onBlocked(row, dir);
    settle(row, 0, () => clear(row));
    finish();
    return;
  }
  const id = row.dataset.id;
  const occ = row.querySelector('[data-occ]')?.dataset.occ || '';
  const kind = row.dataset.swipe;
  const act = () => {
    suppressUntil = 0; // 接下來是我們自己按的勾勾，不要擋掉
    opts.onSwipe({ row, id, occ, kind, dir });
  };
  if (dir === 'left') {
    // 往左滑出去，再刪掉
    settle(row, -row.getBoundingClientRect().width - 24, act);
  } else {
    // 彈回來，再打勾
    settle(row, 0, () => {
      clear(row);
      act();
    });
  }
  finish();
}

function settle(row, x, done) {
  row.classList.add('is-settling');
  row.style.setProperty('--swipe-x', `${x}px`);
  let called = false;
  const end = () => {
    if (called) return;
    called = true;
    row.removeEventListener('transitionend', end);
    done();
  };
  row.addEventListener('transitionend', end);
  setTimeout(end, 260); // 有些情況不會觸發 transitionend
}

function clear(row) {
  row.classList.remove('is-swiping', 'is-settling', 'is-armed', 'swipe-left', 'swipe-right');
  row.style.removeProperty('--swipe-x');
}

function finish() {
  g = null;
  if (pending) {
    pending = false;
    setTimeout(() => opts.rerender(), 280);
  }
}

function reset(cancel) {
  if (!g) return;
  const { row, locked } = g;
  g = null;
  if (cancel && locked === 'x') settle(row, 0, () => clear(row));
  if (pending) {
    pending = false;
    opts.rerender();
  }
}
