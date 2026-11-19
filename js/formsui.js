// 生日表單的設定視窗（朋友頁 →「生日表單」）：建立表單、複製網址、做限動圖片、暫停、刪除。
// 第一次用的時候，Firebase 還沒有新的安全規則，這裡會教怎麼貼。
import { esc } from './utils.js';
import { icon, openModal, toast, confirmDialog } from './ui.js';
import { store } from './store.js';
import { mascot } from './mascot.js';
import {
  forms, onFormsChange, createForm, updateForm, deleteForm, retryForms, formUrl, FORM_DEFAULTS, FORM_LIMITS,
} from './forms.js';

let env = { leaveDemo: null, configured: false };
export function setFormsEnv(next) {
  env = { ...env, ...next };
}

// 中文和英文名字之間才空一格
const sa = (name) => (/[A-Za-z0-9]$/.test(name) ? ' ' : '');

let rulesText = '';
async function loadRules() {
  if (rulesText) return rulesText;
  const res = await fetch(new URL('../firestore.rules', import.meta.url), { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  rulesText = await res.text();
  return rulesText;
}

async function copyText(text, input) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (!input) return false;
    input.focus();
    input.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    }
  }
}

function kindOf() {
  if (forms.status === 'off') return 'off';
  if (forms.status === 'rules') return 'rules';
  if (forms.status === 'error') return 'error';
  if (forms.status === 'loading') return 'loading';
  return forms.form ? 'manage' : 'create';
}

const consoleUrl = () => (forms.projectId ? `https://console.firebase.google.com/project/${encodeURIComponent(forms.projectId)}/firestore/rules` : 'https://console.firebase.google.com/');

function textFields(f) {
  return `
    <div class="field"><label for="fm-title">標題</label>
      <input id="fm-title" name="fmTitle" value="${esc(f.title)}" maxlength="${FORM_LIMITS.title}" autocomplete="off"></div>
    <div class="field"><label for="fm-intro">說明</label>
      <textarea id="fm-intro" name="fmIntro" rows="3" maxlength="${FORM_LIMITS.intro}">${esc(f.intro)}</textarea></div>
    <div class="field"><label for="fm-from">你的名字（會寫在表單上：「○○ 想知道」）</label>
      <input id="fm-from" name="fmFrom" value="${esc(f.from)}" maxlength="${FORM_LIMITS.from}" autocomplete="off" placeholder="例如：Alexander"></div>`;
}

const VIEWS = {
  off: () => `
    <div class="fm-hello">${mascot('smile', { size: 56, label: '' })}
      <p>生日表單要用 Google 帳號：朋友填的資料會存進你的雲端，手機、電腦都看得到。${env.configured ? '' : '要先設定好 Firebase 才能登入。'}</p></div>
    ${env.configured && env.leaveDemo ? `<div class="fm-actions"><button type="button" class="btn primary" data-fm="login">${icon('google')}用 Google 登入</button></div>` : ''}`,

  loading: () => `<p class="fm-wait" role="status">${navigator.onLine === false ? '現在沒有網路，連上網路之後再打開一次。' : '正在跟雲端確認…'}</p>
    <div class="fm-actions"><button type="button" class="btn" data-fm="retry">重新整理</button></div>`,

  error: () => `<p class="fm-wait" role="alert">連不上雲端：${esc(forms.error || '不知道為什麼')}</p>
    <div class="fm-actions"><button type="button" class="btn" data-fm="retry">再試一次</button></div>`,

  rules: (ui) => `
    <div class="fm-hello">${mascot('wave', { size: 56, label: '' })}
      <p><b>第一次用要先做一件事（只要一次）</b>：在 Firebase 換上新的安全規則，朋友才能不用登入就填表單。</p></div>
    <ol class="fm-steps">
      <li>用電腦打開 <a href="${esc(consoleUrl())}" target="_blank" rel="noopener">Firebase 後台的規則頁${icon('external')}</a>（Firestore Database →「規則」）</li>
      <li>把裡面原本的文字<b>全部刪掉</b>，貼上下面這段</li>
      <li>按「發布」，回來按「我貼好了」</li>
    </ol>
    <div class="fm-rules">
      <textarea class="fm-rules-text" readonly rows="7" aria-label="新的安全規則" data-fm-rules>${esc(rulesText || '載入中…')}</textarea>
      <button type="button" class="btn" data-fm="copy-rules">${icon('copy')}複製規則</button>
    </div>
    <p class="hint">新規則一樣只有你能看你的任務、記帳和朋友資料；多出來的只有：知道表單網址的人可以「送出」回覆，回覆也只有你看得到。</p>
    ${ui.retried ? '<p class="hint is-error" role="alert">還是被擋住了。確認有按「發布」，等一分鐘再按一次。</p>' : ''}
    <div class="fm-actions"><button type="button" class="btn primary" data-fm="retry-rules">我貼好了，再試一次</button></div>`,

  create: () => `
    <div class="fm-hello">${mascot('wave', { size: 56, label: '' })}
      <p>做一份表單，發到限時動態或傳給朋友。朋友不用登入，填好的生日和喜歡的東西會出現在朋友頁，按一下就能加進名單。</p></div>
    ${textFields({ title: FORM_DEFAULTS.title, intro: FORM_DEFAULTS.intro, from: (store.state.user?.name || '').slice(0, FORM_LIMITS.from) })}
    <div class="fm-actions"><button type="submit" class="btn primary" data-fm-create>建立表單</button></div>`,

  manage: () => {
    const f = forms.form;
    const url = formUrl(f.id);
    const canShare = typeof navigator.share === 'function';
    return `
    <label class="switch fm-open"><input type="checkbox" data-fm-open${f.open ? ' checked' : ''}><span class="switch-track"></span><span data-fm-open-text>${openText(f.open)}</span></label>
    <div class="field"><label for="fm-link">表單網址</label>
      <div class="fm-link"><input id="fm-link" readonly value="${esc(url)}" data-fm-link><button type="button" class="btn" data-fm="copy">${icon('copy')}複製</button></div></div>
    <div class="fm-row">
      ${canShare ? `<button type="button" class="btn" data-fm="share">分享…</button>` : ''}
      <a class="btn" href="${esc(url)}" target="_blank" rel="noopener">${icon('external')}打開看看</a>
      <button type="button" class="btn" data-fm="story">${icon('image')}做限動圖片</button>
    </div>
    <div class="fm-story" data-fm-story hidden></div>
    <p class="hint">發 IG 限動：選一張圖（可以用上面的限動圖片）→ 加「連結」貼紙 → 貼上網址。</p>
    <details class="fm-edit"><summary>改標題和說明</summary>
      ${textFields(f)}
      <div class="fm-actions"><button type="button" class="btn primary small" data-fm="save">儲存</button></div>
    </details>
    <div class="fm-foot"><span class="fm-count" data-fm-count>${countText()}</span>
      <button type="button" class="btn ghost danger-text small" data-fm="delete">${icon('trash')}刪除表單</button></div>`;
  },
};

const openText = (open) => (open ? '開放填寫中' : '暫停中：朋友打開會看到「暫停填寫」');
const countText = () => (forms.responses.length ? `有 ${forms.responses.length} 份回覆在朋友頁等你加入` : '還沒有新的回覆');

export function openFormManager() {
  const ui = { kind: '', busy: false, retrying: false, retried: false, story: null };
  let off = () => {};
  const { form: modal, close } = openModal({
    title: '生日表單',
    body: '<div class="fm" data-fm-box></div>',
    hideFooter: true,
    onSubmit: () => {
      if (ui.kind === 'create') doCreate();
      else if (ui.kind === 'manage' && document.activeElement?.closest('.fm-edit')) saveText();
      return false;
    },
    onClose: () => {
      off();
      if (ui.story) URL.revokeObjectURL(ui.story.url);
    },
  });
  const box = modal.querySelector('[data-fm-box]');

  function paint(force = false) {
    const kind = kindOf();
    if (!force && (ui.busy || kind === ui.kind)) {
      refresh();
      return;
    }
    // 按了「我貼好了」又被擋回來：多提醒一句
    if (kind === 'rules' && ui.retrying) ui.retried = true;
    if (kind !== 'loading') ui.retrying = false;
    ui.kind = kind;
    box.innerHTML = VIEWS[kind](ui);
    if (kind === 'rules' && !rulesText) {
      loadRules().then((t) => {
        const area = box.querySelector('[data-fm-rules]');
        if (area) area.value = t;
      }).catch(() => {
        const area = box.querySelector('[data-fm-rules]');
        if (area) area.value = '讀不到規則檔，請到 GitHub 上的 firestore.rules 複製。';
      });
    }
  }

  // 同一個畫面，只更新會變的小地方（不要蓋掉正在輸入的字）
  function refresh() {
    if (ui.kind !== 'manage' || !forms.form) return;
    const count = box.querySelector('[data-fm-count]');
    if (count) count.textContent = countText();
    const sw = box.querySelector('[data-fm-open]');
    if (sw && !ui.busy && sw.checked !== forms.form.open) {
      sw.checked = forms.form.open;
      box.querySelector('[data-fm-open-text]').textContent = openText(forms.form.open);
    }
  }

  off = onFormsChange(() => paint());
  paint(true);

  async function doCreate() {
    if (ui.busy) return;
    const el = modal.elements;
    const from = el.fmFrom.value.trim();
    if (!from) {
      el.fmFrom.setAttribute('aria-invalid', 'true');
      el.fmFrom.focus();
      toast('寫上你的名字，朋友才知道是誰問的', { tone: 'error' });
      return;
    }
    const btn = box.querySelector('[data-fm-create]');
    ui.busy = true;
    btn.disabled = true;
    btn.textContent = '建立中…';
    try {
      await createForm({ title: el.fmTitle.value, intro: el.fmIntro.value, from });
      ui.busy = false;
      paint(true);
      toast('表單做好了！複製網址發到限動吧');
      box.querySelector('[data-fm="copy"]')?.focus();
    } catch (err) {
      ui.busy = false;
      if (forms.status === 'rules') paint(true);
      else {
        btn.disabled = false;
        btn.textContent = '建立表單';
        toast(`建立失敗：${err.message || err}`, { tone: 'error' });
      }
    }
  }

  async function saveText() {
    if (ui.busy) return;
    const el = modal.elements;
    const from = el.fmFrom.value.trim();
    if (!from) {
      el.fmFrom.focus();
      toast('寫上你的名字，朋友才知道是誰問的', { tone: 'error' });
      return;
    }
    ui.busy = true;
    try {
      await updateForm({ title: el.fmTitle.value, intro: el.fmIntro.value, from });
      toast('已儲存，朋友重新打開就會看到');
      ui.story = null; // 圖片上的字可能變了
      box.querySelector('.fm-edit')?.removeAttribute('open');
    } catch (err) {
      toast(`儲存失敗：${err.message || err}`, { tone: 'error' });
    } finally {
      ui.busy = false;
    }
  }

  async function setOpen(sw) {
    const open = sw.checked;
    box.querySelector('[data-fm-open-text]').textContent = openText(open);
    ui.busy = true;
    try {
      await updateForm({ open });
      toast(open ? '已開放，朋友可以填了' : '已暫停，朋友暫時不能填');
    } catch (err) {
      sw.checked = !open;
      box.querySelector('[data-fm-open-text]').textContent = openText(!open);
      toast(`改不了：${err.message || err}`, { tone: 'error' });
    } finally {
      ui.busy = false;
    }
  }

  async function showStory(btn) {
    const area = box.querySelector('[data-fm-story]');
    if (!ui.story) {
      btn.disabled = true;
      try {
        const blob = await storyImage(forms.form);
        ui.story = { blob, url: URL.createObjectURL(blob) };
      } catch (err) {
        console.error(err);
        toast('圖片做不出來，請再試一次', { tone: 'error' });
        return;
      } finally {
        btn.disabled = false;
      }
    }
    const file = new File([ui.story.blob], '生日表單限動.png', { type: 'image/png' });
    const canShareFile = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
    area.innerHTML = `
      <img src="${ui.story.url}" alt="限動圖片預覽：${esc(forms.form.title)}" width="1080" height="1920">
      <div class="fm-story-actions">
        ${canShareFile ? `<button type="button" class="btn primary" data-fm="story-share">${icon('upload')}分享／存到相簿</button>` : ''}
        <a class="btn${canShareFile ? '' : ' primary'}" href="${ui.story.url}" download="生日表單限動.png">${icon('download')}下載圖片</a>
      </div>
      <p class="hint">下面留了空位，可以把「連結」貼紙放在那裡。</p>`;
    area.hidden = false;
    area.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  box.addEventListener('change', (e) => {
    const sw = e.target.closest('[data-fm-open]');
    if (sw) setOpen(sw);
  });

  box.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-fm]');
    if (!btn) return;
    const act = btn.dataset.fm;
    if (act === 'login') {
      close();
      env.leaveDemo?.();
    } else if (act === 'retry' || act === 'retry-rules') {
      ui.retrying = act === 'retry-rules';
      ui.retried = false;
      retryForms();
    } else if (act === 'copy-rules') {
      const area = box.querySelector('[data-fm-rules]');
      const text = rulesText || (await loadRules().catch(() => ''));
      if (text && (await copyText(text, area))) toast('已複製，到 Firebase 的規則頁貼上');
      else toast('沒辦法自動複製，請長按或全選框框裡的文字複製', { tone: 'error' });
    } else if (act === 'copy') {
      const input = box.querySelector('[data-fm-link]');
      if (await copyText(input.value, input)) toast('已複製網址');
      else toast('沒辦法自動複製，請長按網址複製', { tone: 'error' });
    } else if (act === 'share') {
      const f = forms.form;
      try {
        await navigator.share({ title: f.title, text: `${f.title}（30 秒就好）`, url: formUrl(f.id) });
      } catch { /* 取消分享 */ }
    } else if (act === 'save') {
      saveText();
    } else if (act === 'story') {
      showStory(btn);
    } else if (act === 'story-share') {
      const file = new File([ui.story.blob], '生日表單限動.png', { type: 'image/png' });
      try {
        await navigator.share({ files: [file] });
      } catch { /* 取消分享 */ }
    } else if (act === 'delete') {
      const n = forms.responses.length;
      const ok = await confirmDialog(`刪掉之後網址就不能用了，朋友打開會看到「找不到這份表單」。${n ? `還沒加入的 ${n} 份回覆也會一起刪掉。` : ''}`, { title: '刪除生日表單？', confirmLabel: '刪除', danger: true });
      if (!ok) return;
      ui.busy = true;
      try {
        await deleteForm();
        toast('已刪除表單');
      } catch (err) {
        toast(`刪不掉：${err.message || err}`, { tone: 'error' });
      } finally {
        ui.busy = false;
        paint(true);
      }
    }
  });
}

// ---------- 限動圖片（1080×1920）：撕頁日曆 + 小日曆，下面留位置放連結貼紙 ----------
const C = { bg: '#FFF6F3', dot: '#F6D9DF', ink: '#3D2A36', ink2: '#6A5361', pink: '#FF8FB1', pinkText: '#C02E58', paper: '#FFFFFF', strong: '#EC6C95' };
const FONT = '"Huninn", "jf open 粉圓 2.1", "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif';
const NO_START = /^[，。！？、；：」』）〉》,.!?;:)\]%…]$/u; // 不能放在一行開頭的標點

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// 中文一個字一個字斷行，英文單字不切開
export function wrapText(measure, text, maxWidth, maxLines) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    const tokens = para.match(/[A-Za-z0-9'’\-]+|\s+|./gu) || [];
    let line = '';
    for (const t of tokens) {
      const next = line + t;
      if (line.trim() && measure(next) > maxWidth && !NO_START.test(t)) {
        lines.push(line.trim());
        line = t.trimStart();
      } else {
        line = next;
      }
    }
    if (line.trim()) lines.push(line.trim());
  }
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/.$/u, '')}…`;
  }
  return lines;
}

async function storyImage(f) {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  const who = f.from || '';
  const fromLine = who ? `${who}${sa(who)}想知道` : '';
  try {
    await document.fonts.load(`80px Huninn`, `${f.title}${f.intro}${fromLine}？月你的生日點連結填寫秒就好`);
  } catch { /* 字型載不到就用系統字 */ }

  // 點點紙背景
  g.fillStyle = C.bg;
  g.fillRect(0, 0, W, H);
  g.fillStyle = C.dot;
  for (let y = 30; y < H; y += 54) {
    for (let x = 30; x < W; x += 54) {
      g.beginPath();
      g.arc(x, y, 3.4, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';

  // 上面：誰想知道 + 標題（限動上方 250px 會被頭像擋住，從 300 開始）
  let y = 330;
  if (fromLine) {
    g.font = `52px ${FONT}`;
    g.fillStyle = C.ink2;
    g.fillText(fromLine, W / 2, y);
    y += 40;
  }
  g.font = `100px ${FONT}`;
  g.fillStyle = C.ink;
  const titleLines = wrapText((s) => g.measureText(s).width, f.title, 900, 2);
  for (const line of titleLines) {
    y += 122;
    g.fillText(line, W / 2, y);
  }

  // 撕頁日曆（微微歪一邊）
  const cw = 560;
  const ch = 600;
  const cx = W / 2 + 30;
  const cy = y + 110 + ch / 2;
  g.save();
  g.translate(cx, cy);
  g.rotate((-2.5 * Math.PI) / 180);
  const x0 = -cw / 2;
  const y0 = -ch / 2;
  g.fillStyle = 'rgba(61, 42, 54, 0.12)';
  roundRect(g, x0, y0 + 16, cw, ch, 80);
  g.fill();
  g.fillStyle = C.paper;
  g.strokeStyle = C.ink;
  g.lineWidth = 8;
  roundRect(g, x0, y0, cw, ch, 80);
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = C.pink;
  g.fillRect(x0, y0, cw, 150);
  g.restore();
  g.beginPath();
  g.moveTo(x0, y0 + 150);
  g.lineTo(x0 + cw, y0 + 150);
  g.stroke();
  roundRect(g, x0, y0, cw, ch, 80);
  g.stroke();
  for (const rx of [x0 + 130, x0 + cw - 130 - 36]) {
    g.fillStyle = C.paper;
    roundRect(g, rx, y0 - 42, 36, 86, 18);
    g.fill();
    g.stroke();
  }
  g.fillStyle = C.ink;
  g.font = `66px ${FONT}`;
  g.fillText('？月', 0, y0 + 112);
  g.fillStyle = C.pinkText;
  g.font = `280px ${FONT}`;
  g.fillText('？', 0, y0 + 430);
  g.fillStyle = C.ink2;
  g.font = `50px ${FONT}`;
  g.fillText('你的生日是？', 0, y0 + 530);
  g.restore();

  // 小日曆從左下角探出頭
  const svg = mascot('wave', { size: 240, label: '' }).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  try {
    await img.decode();
    g.save();
    g.translate(cx - cw / 2 - 10, cy + ch / 2 - 90);
    g.rotate((-8 * Math.PI) / 180);
    g.drawImage(img, -120, -120, 240, 240);
    g.restore();
  } catch { /* 沒有吉祥物也沒關係 */ }

  // 說明
  y = cy + ch / 2 + 110;
  if (f.intro) {
    g.font = `48px ${FONT}`;
    g.fillStyle = C.ink2;
    for (const line of wrapText((s) => g.measureText(s).width, f.intro, 860, 3)) {
      g.fillText(line, W / 2, y);
      y += 72;
    }
  }

  // 「點連結填寫」的貼紙（下面空著放 IG 的連結貼紙）
  const label = '點下面的連結填寫 👇';
  g.font = `54px ${FONT}`;
  const lw = g.measureText(label).width + 110;
  const ly = Math.max(y + 10, 1460);
  g.fillStyle = C.strong;
  roundRect(g, (W - lw) / 2, ly + 10, lw, 110, 55);
  g.fill();
  g.fillStyle = C.pink;
  g.strokeStyle = C.strong;
  g.lineWidth = 5;
  roundRect(g, (W - lw) / 2, ly, lw, 110, 55);
  g.fill();
  g.stroke();
  g.fillStyle = C.ink;
  g.fillText(label, W / 2, ly + 74);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'));
}
