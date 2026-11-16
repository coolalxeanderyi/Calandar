// 介面元件：圖示、對話框、確認視窗、提示訊息
import { esc } from './utils.js';
import { getTheme } from './themes.js';

// ---- 圖示（線條風格，使用目前文字顏色） ----
const PATHS = {
  home: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9h11v-9"/><path d="M10 19v-5h4v5"/>',
  tasks: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 3 3 5-6"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  repeat: '<path d="M17 4.5 19.5 7 17 9.5"/><path d="M5 12V10a3 3 0 0 1 3-3h11.5"/><path d="M7 19.5 4.5 17 7 14.5"/><path d="M19 12v2a3 3 0 0 1-3 3H4.5"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  left: '<path d="m14.5 6-6 6 6 6"/>',
  right: '<path d="m9.5 6 6 6-6 6"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="m3.5 16 5-5 4 4 2.5-2.5 5 5"/><circle cx="15.5" cy="9.5" r="1.5"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
  flag: '<path d="M6 20.5V4"/><path d="M6 4.5h11l-2.5 4 2.5 4H6"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M5 19.5h14"/>',
  upload: '<path d="M12 15.5v-11M7.5 9 12 4.5 16.5 9"/><path d="M5 19.5h14"/>',
  logout: '<path d="M14 4.5H6.5v15H14"/><path d="M10.5 12H20M16.5 8.5 20 12l-3.5 3.5"/>',
  google: '<path d="M20.5 12.2c0-.6-.1-1.2-.2-1.8H12v3.4h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.6-3.9 2.6-6.5Z" fill="#4285F4" stroke="none"/><path d="M12 21c2.4 0 4.5-.8 5.9-2.2L15 16.6c-.8.5-1.8.9-3 .9-2.3 0-4.3-1.6-5-3.7H4v2.3A9 9 0 0 0 12 21Z" fill="#34A853" stroke="none"/><path d="M7 13.8a5.4 5.4 0 0 1 0-3.5V8H4a9 9 0 0 0 0 8.1l3-2.3Z" fill="#FBBC05" stroke="none"/><path d="M12 6.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 4 8l3 2.3c.7-2.1 2.7-3.7 5-3.7Z" fill="#EA4335" stroke="none"/>',
  sparkle: '<path d="M12 4.5v15M4.5 12h15"/>',
  edit: '<path d="M5 19h3.5L19 8.5 15.5 5 5 15.5V19Z"/><path d="m13.5 7 3.5 3.5"/>',
};

export function icon(name, cls = '') {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${PATHS[name] || ''}</svg>`;
}

// ---- 對話框 ----
let modalCount = 0;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 開一個對話框。
 * body：HTML 字串；form 為 true 時整個內容包在 <form> 裡，按 Enter 或主要按鈕會觸發 onSubmit。
 * onSubmit(form) 回傳 false 會讓對話框保持開啟（例如欄位沒填）。
 */
export function openModal({
  title,
  body,
  submitLabel = '儲存',
  cancelLabel = '取消',
  onSubmit,
  danger,
  extra = [],
  size = 'md',
  onOpen,
  onClose,
  hideFooter = false,
}) {
  const root = document.getElementById('modal-root');
  const id = `modal-${++modalCount}`;
  const previous = document.activeElement;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const extraButtons = extra
    .map((b, i) => `<button type="button" class="btn ${b.className || ''}" data-extra="${i}">${b.icon ? icon(b.icon) : ''}${esc(b.label)}</button>`)
    .join('');

  backdrop.innerHTML = `
    <form class="modal modal-${size}" role="dialog" aria-modal="true" aria-labelledby="${id}-title" novalidate>
      <header class="modal-head">
        <h2 id="${id}-title" class="modal-title">${esc(title)}</h2>
        <button type="button" class="icon-btn" data-dismiss aria-label="關閉">${icon('x')}</button>
      </header>
      <div class="modal-body">${body}</div>
      ${hideFooter ? '' : `
      <footer class="modal-foot">
        <div class="modal-foot-left">${extraButtons}</div>
        <div class="modal-foot-right">
          <button type="button" class="btn ghost" data-dismiss>${esc(cancelLabel)}</button>
          ${onSubmit ? `<button type="submit" class="btn ${danger ? 'danger' : 'primary'}">${esc(submitLabel)}</button>` : ''}
        </div>
      </footer>`}
    </form>`;

  const form = backdrop.querySelector('form');
  let closed = false;

  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey, true);
    backdrop.classList.add('closing');
    const done = () => backdrop.remove();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) done();
    else setTimeout(done, 140);
    onClose?.();
    if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
  }

  function onKey(e) {
    if (root.lastElementChild !== backdrop) return; // 只處理最上層的對話框
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      const items = [...form.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  // 只有在背景上按下又放開才關閉，避免選取文字時誤關
  let downOnBackdrop = false;
  backdrop.addEventListener('mousedown', (e) => { downOnBackdrop = e.target === backdrop; });
  backdrop.addEventListener('mouseup', (e) => {
    if (downOnBackdrop && e.target === backdrop) close();
    downOnBackdrop = false;
  });

  form.addEventListener('click', (e) => {
    if (e.target.closest('[data-dismiss]')) {
      e.preventDefault();
      close();
      return;
    }
    const extraBtn = e.target.closest('[data-extra]');
    if (extraBtn) {
      e.preventDefault();
      const result = extra[Number(extraBtn.dataset.extra)].onClick?.(form, close);
      if (result !== false && extra[Number(extraBtn.dataset.extra)].closes !== false) close();
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!onSubmit) return;
    const result = onSubmit(form, close);
    if (result !== false) close();
  });

  document.addEventListener('keydown', onKey, true);
  root.append(backdrop);
  onOpen?.(form, close);
  const autofocus = form.querySelector('[autofocus]') || form.querySelector('.modal-body ' + FOCUSABLE);
  (autofocus || form).focus?.({ preventScroll: true });
  return { form, close };
}

export function confirmDialog(message, { title = '確定嗎？', confirmLabel = '確定', danger = false } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    openModal({
      title,
      size: 'sm',
      body: `<p class="confirm-text">${esc(message)}</p>`,
      submitLabel: confirmLabel,
      danger,
      onSubmit: () => {
        answered = true;
        resolve(true);
      },
      onClose: () => {
        if (!answered) resolve(false);
      },
    });
  });
}

// 在欄位旁顯示錯誤訊息
export function fieldError(form, name, message) {
  const input = form.elements[name];
  if (!input) return;
  const field = input.closest('.field') || input.parentElement;
  field.querySelector('.field-error')?.remove();
  input.removeAttribute('aria-invalid');
  if (message) {
    input.setAttribute('aria-invalid', 'true');
    field.insertAdjacentHTML('beforeend', `<p class="field-error" role="alert">${esc(message)}</p>`);
    input.focus();
  }
}

// ---- 提示訊息 ----
export function toast(message, { actionLabel, onAction, duration = 4200, tone = 'info' } = {}) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast toast-${tone}`;
  el.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  el.innerHTML = `<span class="toast-text">${esc(message)}</span>${actionLabel ? `<button type="button" class="toast-action">${esc(actionLabel)}</button>` : ''}`;
  let timer;
  const remove = () => {
    clearTimeout(timer);
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 180);
  };
  el.querySelector('.toast-action')?.addEventListener('click', () => {
    onAction?.();
    remove();
  });
  root.append(el);
  while (root.children.length > 3) root.firstElementChild.remove();
  timer = setTimeout(remove, duration);
  return remove;
}

// ---------- 慶祝動畫（完成任務、打卡時的彩紙） ----------
// 彩紙用目前配色主題的顏色（主色加四條紙膠帶的顏色，深色模式也用亮一點的那組）
function confettiColors() {
  const t = getTheme(document.documentElement.dataset.palette).light;
  return [t.accent, t.tapes[0], t.tapes[1], t.accentStrong, t.tapes[2], t.tapes[3]];
}

export function celebrate(x, y, { big = false } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = document.createElement('div');
  layer.className = 'confetti';
  layer.style.left = `${x}px`;
  layer.style.top = `${y}px`;
  const count = big ? 28 : 12;
  const CONFETTI = confettiColors();
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('i');
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
    const dist = (big ? 110 : 34) + Math.random() * (big ? 90 : 22);
    piece.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    piece.style.setProperty('--dy', `${Math.sin(angle) * dist - (big ? 30 : 6)}px`);
    piece.style.setProperty('--rot', `${Math.round(Math.random() * 360)}deg`);
    piece.style.background = CONFETTI[i % CONFETTI.length];
    piece.style.animationDelay = `${Math.round(Math.random() * 60)}ms`;
    if (i % 3 === 0) piece.className = 'is-star';
    else if (i % 3 === 1) piece.className = 'is-bar';
    layer.append(piece);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), big ? 1300 : 900);
}

export function celebrateAt(el, opts) {
  if (!el?.getBoundingClientRect) return;
  const box = el.getBoundingClientRect();
  celebrate(box.left + box.width / 2, box.top + box.height / 2, opts);
}
