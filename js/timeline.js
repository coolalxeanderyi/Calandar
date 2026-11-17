// 日檢視的時間軸：
// ・拖曳任務改開始時間，拉任務底部改長度（每 15 分鐘一格）
// ・把整天的任務、還沒排日期的任務拖進時間軸，就排到那個時間
// 滑鼠：按住拖曳。手機：長按一下再拖（底部的把手可以直接拉）。
import { store } from './store.js';
import { toast } from './ui.js';

const SNAP = 15;
const LONG_PRESS = 380;
const MOUSE_SLOP = 4;
const TOUCH_SLOP = 8;
const DAY = 24 * 60;

let drag = null;
let rerender = () => {};
let pendingRender = false;
let suppressUntil = 0;

export const timelineDragging = () => !!drag?.active;

// 拖曳中先不要重畫畫面，放開之後再畫
export function deferRender() {
  if (!drag?.active) return false;
  pendingRender = true;
  return true;
}

const pad2 = (n) => String(n).padStart(2, '0');
export const minToTime = (min) => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
const toMin = (hhmm) => {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return h * 60 + m;
};
const snap = (min) => Math.round(min / SNAP) * SNAP;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

export function initTimeline(opts = {}) {
  rerender = opts.rerender || rerender;
  document.addEventListener('pointerdown', onDown);
  // 拖完之後放開滑鼠會觸發 click，不要因此打開任務
  document.addEventListener('click', (e) => {
    if (Date.now() < suppressUntil) {
      e.preventDefault();
      e.stopPropagation();
      suppressUntil = 0;
    }
  }, true);
  // 長按開始拖曳之後，手指移動不要捲動頁面
  document.addEventListener('touchmove', (e) => {
    if (drag?.active) e.preventDefault();
  }, { passive: false });
  document.addEventListener('contextmenu', (e) => {
    if (drag) e.preventDefault();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drag?.active) {
      e.preventDefault();
      e.stopPropagation();
      finish(false);
    }
  }, true);
}

function trackInfo(track) {
  return {
    track,
    date: track.dataset.dropTime,
    startHour: Number(track.dataset.startHour) || 0,
    hour: Number(track.dataset.hour) || 56,
  };
}

function onDown(e) {
  if (drag || (e.pointerType === 'mouse' && e.button !== 0) || !e.isPrimary) return;
  const track = document.querySelector('.day-track[data-drop-time]');
  if (!track) return;
  const resizeEl = e.target.closest('[data-tl-resize]');
  const block = e.target.closest('.day-block[data-tl-id]');
  const place = e.target.closest('[data-tl-place]');
  let kind;
  let el;
  if (resizeEl && block) {
    kind = 'resize';
    el = block;
  } else if (block) {
    if (e.target.closest('.check')) return; // 勾選完成的按鈕
    kind = 'move';
    el = block;
  } else if (place) {
    if (e.target.closest('.check')) return;
    kind = 'place';
    el = place;
  } else {
    return;
  }
  const id = kind === 'place' ? place.dataset.tlPlace : block.dataset.tlId;
  const task = store.state.tasks.find((t) => t.id === id);
  if (!task || task.repeat !== 'none') return;

  drag = {
    kind, id, el, task, ...trackInfo(track),
    pointerId: e.pointerId,
    touch: e.pointerType !== 'mouse',
    x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY,
    active: false, timer: 0, raf: 0,
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  if (drag.touch) {
    if (kind === 'resize') activate();
    else drag.timer = setTimeout(activate, LONG_PRESS);
  }
}

function activate() {
  if (!drag || drag.active) return;
  drag.active = true;
  clearTimeout(drag.timer);
  navigator.vibrate?.(8);
  document.body.classList.add('is-tl-dragging');
  const { kind, task } = drag;
  if (kind === 'place') {
    drag.duration = task.time ? task.duration || 60 : clamp(task.duration || 60, SNAP, 4 * 60);
    drag.grab = Math.min(30, drag.duration / 2); // 手指在預覽方塊的上半部
    const ghost = document.createElement('div');
    ghost.className = 'tl-ghost';
    ghost.textContent = task.title;
    document.body.append(ghost);
    drag.ghost = ghost;
    const preview = document.createElement('div');
    preview.className = 'day-block tl-preview';
    preview.setAttribute('aria-hidden', 'true');
    preview.innerHTML = '<span class="tl-time"></span>';
    preview.hidden = true;
    drag.track.append(preview);
    drag.preview = preview;
    drag.el.classList.add('is-lifted');
  } else {
    drag.start = toMin(task.time);
    drag.duration = task.duration || 60;
    drag.anchor = pointerMin(drag.y0); // 按下去的位置：改長度時看手指移動了多少
    drag.grab = drag.anchor - drag.start;
    drag.el.classList.add('is-moving');
    const label = document.createElement('span');
    label.className = 'tl-time';
    drag.el.append(label);
    drag.label = label;
  }
  update();
}

function pointerMin(clientY) {
  const r = drag.track.getBoundingClientRect();
  return drag.startHour * 60 + ((clientY - r.top) / drag.hour) * 60;
}

const topPx = (min) => ((min - drag.startHour * 60) / 60) * drag.hour;
const heightPx = (dur) => Math.max((dur / 60) * drag.hour - 4, 30);

function update() {
  if (!drag?.active) return;
  const lo = drag.startHour * 60;
  if (drag.kind === 'move') {
    drag.newStart = clamp(snap(pointerMin(drag.y) - drag.grab), lo, DAY - drag.duration);
    drag.newDur = drag.duration;
    drag.el.style.top = `${topPx(drag.newStart) + 2}px`;
  } else if (drag.kind === 'resize') {
    drag.newStart = drag.start;
    drag.newDur = clamp(snap(drag.duration + pointerMin(drag.y) - drag.anchor), SNAP, DAY - drag.start);
    drag.el.style.height = `${heightPx(drag.newDur)}px`;
  } else {
    const r = drag.track.getBoundingClientRect();
    const over = drag.x >= r.left && drag.x <= r.right && drag.y >= r.top && drag.y <= r.bottom;
    drag.over = over;
    drag.ghost.style.transform = `translate(${drag.x + 12}px, ${drag.y - 18}px)`;
    drag.ghost.classList.toggle('is-over', over);
    drag.preview.hidden = !over;
    if (over) {
      drag.newStart = clamp(snap(pointerMin(drag.y) - drag.grab), lo, DAY - SNAP);
      drag.newDur = Math.min(drag.duration, DAY - drag.newStart);
      drag.preview.style.top = `${topPx(drag.newStart) + 2}px`;
      drag.preview.style.height = `${heightPx(drag.newDur)}px`;
    }
  }
  const label = drag.kind === 'place' ? drag.preview.querySelector('.tl-time') : drag.label;
  if (label && drag.newStart !== undefined) label.textContent = `${minToTime(drag.newStart)}–${minToTime(drag.newStart + drag.newDur)}`;
  autoScroll();
}

// 拖到畫面上下邊緣時自動捲動
function autoScroll() {
  if (!drag?.active || drag.raf) return;
  const edge = 56;
  const speed = drag.y < edge ? -(edge - drag.y) / 4 : drag.y > innerHeight - edge ? (drag.y - (innerHeight - edge)) / 4 : 0;
  if (!speed) return;
  drag.raf = requestAnimationFrame(() => {
    if (!drag) return;
    drag.raf = 0;
    window.scrollBy(0, speed);
    update();
  });
}

function onMove(e) {
  if (!drag || e.pointerId !== drag.pointerId) return;
  drag.x = e.clientX;
  drag.y = e.clientY;
  const moved = Math.hypot(drag.x - drag.x0, drag.y - drag.y0);
  if (!drag.active) {
    if (drag.touch) {
      // 還沒長按就移動了：是在捲動頁面，不是拖曳
      if (moved > TOUCH_SLOP) cleanup();
      return;
    }
    if (moved < MOUSE_SLOP) return;
    activate();
    return;
  }
  e.preventDefault();
  update();
}

function onUp(e) {
  if (!drag || e.pointerId !== drag.pointerId) return;
  if (!drag.active) {
    cleanup();
    return;
  }
  drag.x = e.clientX;
  drag.y = e.clientY;
  update();
  finish(true);
}

function onCancel(e) {
  if (!drag || e.pointerId !== drag.pointerId) return;
  if (drag.active) finish(false);
  else cleanup();
}

function finish(commit) {
  const d = drag;
  // 滑鼠拖完放開時會接著觸發 click，擋掉那一次；手指拖過之後瀏覽器本來就不會觸發 click
  suppressUntil = d.touch ? 0 : Date.now() + 300;
  let change = null;
  if (commit && d.newStart !== undefined && (d.kind !== 'place' || d.over)) {
    const time = minToTime(d.newStart);
    const t = d.task;
    if (d.kind === 'place') change = { date: d.date, time, duration: d.newDur };
    else if (time !== t.time || d.newDur !== t.duration) change = { time, duration: d.newDur };
    if (change) {
      const before = { date: t.date, time: t.time, duration: t.duration };
      const range = `${time}–${minToTime(d.newStart + d.newDur)}`;
      const msg = d.kind === 'place' ? `「${t.title}」排到 ${range}` : d.kind === 'resize' ? `「${t.title}」改成 ${range}` : `「${t.title}」移到 ${range}`;
      cleanup({ render: false }); // 存檔之後畫面會自己更新
      store.updateTask(t.id, change);
      toast(msg, { actionLabel: '復原', onAction: () => store.updateTask(t.id, before) });
      return;
    }
  }
  cleanup();
}

function cleanup({ render = true } = {}) {
  const d = drag;
  if (!d) return;
  drag = null;
  clearTimeout(d.timer);
  if (d.raf) cancelAnimationFrame(d.raf);
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
  window.removeEventListener('pointercancel', onCancel);
  document.body.classList.remove('is-tl-dragging');
  d.ghost?.remove();
  d.preview?.remove();
  d.label?.remove();
  d.el?.classList.remove('is-moving', 'is-lifted');
  // 拖過的方塊位置改過了，重畫一次放回正確的位置（拖曳中延後的重畫也在這裡補上）
  const again = (d.active && render) || pendingRender;
  pendingRender = false;
  if (again) rerender();
}
