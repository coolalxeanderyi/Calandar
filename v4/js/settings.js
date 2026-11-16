// 設定：外觀（標題、圖示、配色主題、深淺模式、每週開始日、封面）、Google 日曆、備份、帳號
import { esc, downloadFile, todayKey } from './utils.js';
import { icon, openModal, confirmDialog, toast } from './ui.js';
import { store } from './store.js';
import { segRadio } from './components.js';
import { COVER_STYLES, coverSVG, randomSeed } from './covers.js';
import { mascot } from './mascot.js';
import { usesMascot } from './model.js';
import { THEMES, THEME_GROUPS, getTheme, tintFor, varsStyle } from './themes.js';
import { gcalState, onGcalChange, disconnect as gcalDisconnect, CALENDAR_NAME } from './gcal.js';

const ICONS = ['🌸', '📒', '🌈', '🍓', '🧋', '⭐', '🍀'];
const MODES = [['auto', '跟著系統'], ['light', '淺色'], ['dark', '深色']];

// ---------- 設定 ----------
export function openSettings(env, { focus } = {}) {
  const s = store.state.settings;
  const { mode, user } = store.state;
  const account = mode === 'cloud'
    ? `<p class="settings-text">已用 <b>${esc(user?.email || '你的 Google 帳號')}</b> 登入。資料會自動同步到你登入的每台裝置。</p>
       <button type="button" class="btn" data-signout>${icon('logout')}登出</button>`
    : `<p class="settings-text">現在是試用模式，資料只存在這台裝置的瀏覽器。</p>
       ${env.configured
         ? `<button type="button" class="btn primary" data-leave-demo>${icon('google')}用 Google 登入並同步</button>`
         : '<p class="hint">要在手機和電腦之間同步，請先照 README 的步驟設定 Firebase。</p>'}`;

  let stopGcal = () => {};
  let stopStore = () => {};

  openModal({
    title: '設定',
    size: 'lg',
    submitLabel: '儲存設定',
    body: `
      <section class="settings-sec" aria-labelledby="st-look">
        <h3 class="sub-title" id="st-look">外觀</h3>
        <div class="field-row emoji-row">
          <div class="field field-emoji"><label for="st-icon">圖示</label>
            <input id="st-icon" name="icon" value="${usesMascot(s.icon) ? '' : esc(s.icon)}" maxlength="8" autocomplete="off" class="emoji-input" placeholder="小日曆">
            <div class="emoji-picks" role="group" aria-label="常用圖示"><button type="button" class="emoji-pick mascot-pick" data-emoji="" aria-label="使用吉祥物小日曆">${mascot('smile', { size: 24, label: '' })}</button>${ICONS.map((e) => `<button type="button" class="emoji-pick" data-emoji="${e}" aria-label="使用 ${e}">${e}</button>`).join('')}</div>
          </div>
          <div class="field grow"><label for="st-title">標題</label><input id="st-title" name="title" value="${esc(s.title)}" maxlength="60" autocomplete="off"></div>
        </div>
        <div class="field"><span class="label">配色主題</span><div class="btn-row" data-theme-current>${themeCurrent(s.palette)}</div></div>
        <fieldset class="field"><legend>深淺模式</legend>${segRadio('theme', MODES, s.theme, '深淺模式')}</fieldset>
        <fieldset class="field"><legend>一週從哪天開始</legend>${segRadio('weekStart', [['1', '星期一'], ['0', '星期日']], s.weekStart, '一週從哪天開始')}</fieldset>
        <div class="field"><span class="label">封面</span><button type="button" class="btn" data-cover>${icon('image')}換封面</button></div>
      </section>
      <section class="settings-sec" aria-labelledby="st-gcal" data-gcal-sec>${gcalSection(env)}</section>
      <section class="settings-sec" aria-labelledby="st-backup">
        <h3 class="sub-title" id="st-backup">備份</h3>
        <p class="hint">備份檔是一個 JSON 檔，可以留一份副本，或把資料搬到另一個帳號。</p>
        <div class="btn-row">
          <button type="button" class="btn" data-export>${icon('download')}匯出備份</button>
          <button type="button" class="btn" data-import>${icon('upload')}匯入備份</button>
          <input type="file" accept="application/json,.json" data-import-file hidden>
        </div>
      </section>
      <section class="settings-sec" aria-labelledby="st-account">
        <h3 class="sub-title" id="st-account">帳號</h3>
        ${account}
      </section>`,
    onOpen(form, close) {
      // Google 日曆的狀態改變時，只更新那一段
      let gcalKey = sectionKey();
      const refreshGcal = () => {
        const sec = form.querySelector('[data-gcal-sec]');
        if (!sec) return;
        const key = sectionKey();
        if (key !== gcalKey) {
          gcalKey = key;
          const hadFocus = sec.contains(document.activeElement);
          sec.innerHTML = gcalSection(env);
          if (hadFocus) sec.querySelector('button')?.focus({ preventScroll: true });
          return;
        }
        const status = sec.querySelector('[data-gcal-status]');
        if (status) {
          const [cls, text] = statusInfo();
          status.className = `settings-text gcal-status is-${cls}`;
          status.textContent = text;
        }
        const last = sec.querySelector('[data-gcal-last]');
        if (last) last.textContent = lastSyncText();
      };
      stopGcal = onGcalChange(refreshGcal);
      stopStore = store.subscribe(refreshGcal);

      if (focus === 'gcal') {
        const sec = form.querySelector('[data-gcal-sec]');
        sec.scrollIntoView({ block: 'start' });
        sec.querySelector('button')?.focus({ preventScroll: true });
      }

      form.addEventListener('click', async (e) => {
        const pick = e.target.closest('.emoji-pick');
        if (pick) {
          e.preventDefault();
          form.elements.icon.value = pick.dataset.emoji;
          return;
        }
        if (e.target.closest('[data-themes]')) {
          e.preventDefault();
          openThemePicker(env, {
            onSaved(patch) {
              const radio = form.querySelector(`input[name="theme"][value="${patch.theme}"]`);
              if (radio) radio.checked = true;
              form.querySelector('[data-theme-current]').innerHTML = themeCurrent(patch.palette);
            },
          });
          return;
        }
        if (e.target.closest('[data-cover]')) {
          e.preventDefault();
          openCoverPicker(env);
          return;
        }
        if (e.target.closest('[data-gcal-connect]') || e.target.closest('[data-gcal-sync]')) {
          e.preventDefault();
          // 「連接」一定要問 Google；「立即同步」在通行證還有效時直接同步
          env.syncCalendar({ askAgain: !!e.target.closest('[data-gcal-connect]') });
          return;
        }
        if (e.target.closest('[data-gcal-off]')) {
          e.preventDefault();
          const ok = await confirmDialog(`之後的變更不會再送到 Google 日曆。已經同步過去的行程會留在「${CALENDAR_NAME}」日曆裡，不想要的話可以在 Google 日曆刪掉整個日曆。`, {
            title: '停止同步到 Google 日曆？',
            confirmLabel: '停止同步',
          });
          if (!ok) return;
          gcalDisconnect();
          toast('已停止同步到 Google 日曆');
          return;
        }
        if (e.target.closest('[data-export]')) {
          e.preventDefault();
          downloadFile(`計劃版備份-${todayKey()}.json`, JSON.stringify(store.exportData(), null, 2));
          toast('已匯出備份');
          return;
        }
        if (e.target.closest('[data-import]')) {
          e.preventDefault();
          form.querySelector('[data-import-file]').click();
          return;
        }
        if (e.target.closest('[data-signout]')) {
          e.preventDefault();
          close();
          env.signOut();
          return;
        }
        if (e.target.closest('[data-leave-demo]')) {
          e.preventDefault();
          close();
          env.leaveDemo();
        }
      });
      form.querySelector('[data-import-file]').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        let json;
        try {
          json = JSON.parse(await file.text());
          if (json?.app !== 'planner') throw new Error('not a backup');
        } catch {
          toast('這個檔案不是計劃版的備份檔，請選擇「匯出備份」產生的 JSON 檔。', { tone: 'error', duration: 6000 });
          return;
        }
        const n = ['tasks', 'goals', 'habits'].reduce((sum, c) => sum + (Array.isArray(json[c]) ? json[c].length : 0), 0);
        const ok = await confirmDialog(`備份檔裡有 ${n} 筆資料。相同的項目會被備份檔的內容取代，其他資料不受影響。`, {
          title: '匯入備份？',
          confirmLabel: '匯入',
        });
        if (!ok) return;
        try {
          const count = await store.importData(json);
          toast(`已匯入 ${count} 筆資料`);
          close();
        } catch (err) {
          toast(err.message || '匯入失敗', { tone: 'error' });
        }
      });
    },
    onClose() {
      stopGcal();
      stopStore();
    },
    onSubmit(form) {
      const f = form.elements;
      store.saveSettings({
        title: f.title.value.trim() || '計劃版',
        icon: f.icon.value.trim(), // 空白＝吉祥物
        theme: f.theme.value,
        weekStart: Number(f.weekStart.value),
      });
      toast('已儲存設定');
      return true;
    },
  });
}

function themeCurrent(paletteId) {
  const t = getTheme(paletteId);
  return `<span class="theme-now"><span class="pill-emoji" aria-hidden="true">${t.emoji}</span>${esc(t.name)}</span>
    <button type="button" class="btn small" data-themes>換主題</button>`;
}

// ---------- 設定裡的 Google 日曆 ----------
const sectionKey = () => `${store.state.mode}|${store.state.settings.gcalOn}`;

function statusInfo() {
  const { phase, message } = gcalState();
  if (phase === 'synced') return ['synced', `已同步到 Google 日曆的「${CALENDAR_NAME}」日曆。`];
  if (phase === 'waiting' || phase === 'syncing') return ['syncing', '正在同步…'];
  if (phase === 'need-auth') return ['need-auth', message || '有變更還沒送到 Google 日曆。Google 給的通行證大約一小時會過期，按「立即同步」再確認一次就好。'];
  if (phase === 'error') return ['error', message || '同步到 Google 日曆失敗。'];
  return ['syncing', '準備中…'];
}

function lastSyncText() {
  const at = store.state.settings.gcalAt;
  if (!at) return '還沒同步過。';
  const d = new Date(at);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const day = d.toDateString() === new Date().toDateString() ? '今天' : `${d.getMonth() + 1}/${d.getDate()}`;
  return `上次同步：${day} ${hm}`;
}

function gcalSection(env) {
  const head = `<h3 class="sub-title" id="st-gcal">Google 日曆</h3>`;
  const { mode, settings: s } = store.state;
  if (mode !== 'cloud') {
    return `${head}
      <p class="settings-text">登入 Google 之後，可以把有日期的任務和目標期限同步到 Google 日曆，iPhone 的「行事曆」也看得到。</p>
      ${env.configured ? `<div class="btn-row"><button type="button" class="btn" data-leave-demo>${icon('google')}用 Google 登入</button></div>` : ''}`;
  }
  if (!s.gcalOn) {
    return `${head}
      <p class="settings-text">把有日期的任務和目標期限，同步到 Google 日曆裡一個叫「${CALENDAR_NAME}」的新日曆。只會動這個日曆，不會碰你其他的行程。</p>
      <div class="btn-row"><button type="button" class="btn primary" data-gcal-connect>${icon('calendar')}連接 Google 日曆</button></div>
      <p class="hint">第一次連接時，Google 會請你允許「建立日曆並管理裡面的行程」。如果看到「Google 尚未驗證這個應用程式」，按「進階」再按「前往」就可以繼續。</p>`;
  }
  const [cls, text] = statusInfo();
  return `${head}
    <p class="settings-text gcal-status is-${cls}" data-gcal-status role="status">${esc(text)}</p>
    <p class="hint" data-gcal-last>${lastSyncText()}</p>
    <p class="hint">有時間的任務會變成 1 小時的行程，開始前 10 分鐘提醒；沒有時間的是全天行程。在這裡修改，Google 日曆會跟著更新。</p>
    <div class="btn-row">
      <button type="button" class="btn" data-gcal-sync>${icon('repeat')}立即同步</button>
      <a class="btn ghost" href="https://calendar.google.com/" target="_blank" rel="noopener">打開 Google 日曆</a>
      <button type="button" class="btn ghost danger-text" data-gcal-off>停止同步</button>
    </div>
    <details class="gcal-help">
      <summary>想在 iPhone、iPad 的「行事曆」App 看到？</summary>
      <ol>
        <li>在 iPhone 的「設定」裡找到「行事曆」，在「行事曆帳號」加入同一個 Google 帳號（已經加過就跳過）。</li>
        <li>用瀏覽器打開 <a href="https://calendar.google.com/calendar/syncselect" target="_blank" rel="noopener">Google 日曆的同步設定</a>，勾選「${CALENDAR_NAME}」，再按「儲存」。</li>
        <li>回到「行事曆」App，就會看到「${CALENDAR_NAME}」這個日曆。</li>
      </ol>
    </details>`;
}

// ---------- 換主題 ----------
export function openThemePicker(env, { onSaved } = {}) {
  const startLook = env.currentLook();
  let palette = startLook.palette;
  let mode = store.state.settings.theme;
  let withCover = true;
  let saved = false;

  const card = (t) => `
    <button type="button" class="theme-pick${t.id === palette ? ' is-active' : ''}" role="radio" aria-checked="${t.id === palette}" data-palette="${t.id}">
      <span class="theme-mini" style="${varsStyle(t.id, mode)}" aria-hidden="true">
        <span class="theme-mini-cover">${coverSVG(t.cover, 3, 'tm', { width: 480, height: 120, tint: tintFor(t.cover, t.id) })}</span>
        <span class="theme-mini-icon">${mascot('smile', { size: 28, label: '' })}</span>
        <span class="theme-mini-tape t1"></span><span class="theme-mini-tape t2"></span>
        <span class="theme-mini-btn"></span>
        <span class="theme-mini-dots"><i style="background:var(--tape-3)"></i><i style="background:var(--tape-4)"></i><i style="background:var(--accent)"></i></span>
      </span>
      <span class="theme-name"><span aria-hidden="true">${t.emoji}</span>${esc(t.name)}</span>
    </button>`;

  // 依分類排好的主題卡片
  const allCards = () => THEME_GROUPS.map((g) => `
    <div class="theme-group">
      <h4 class="theme-group-title">${esc(g.name)}</h4>
      <div class="theme-picks">${g.ids.map((id) => card(getTheme(id))).join('')}</div>
    </div>`).join('');

  const coverLabel = () => {
    const name = COVER_STYLES.find((c) => c.id === getTheme(palette).cover)?.name || '';
    return `封面也換成「${name}」`;
  };

  const showPreview = () => env.lookPreview.set({ palette, theme: mode, coverStyle: withCover ? getTheme(palette).cover : undefined });

  openModal({
    title: '換主題',
    size: 'lg',
    submitLabel: '套用主題',
    body: `
      <div class="theme-groups" role="radiogroup" aria-label="配色主題" data-theme-picks>${allCards()}</div>
      <div class="theme-options">
        <label class="check-row"><input type="checkbox" name="withCover" checked><span data-cover-label>${coverLabel()}</span></label>
        <fieldset class="field"><legend>深淺模式</legend>${segRadio('pickerMode', MODES, mode, '深淺模式')}</fieldset>
        <p class="hint">點一下就能先看看效果，按「套用主題」才會存起來，所有登入的裝置都會一起換。</p>
      </div>`,
    extra: [{
      label: '隨機挑一個',
      icon: 'sparkle',
      closes: false,
      onClick: (form) => {
        const others = THEMES.filter((t) => t.id !== palette);
        palette = others[Math.floor(Math.random() * others.length)].id;
        select(form, true);
        return false;
      },
    }],
    onOpen(form) {
      form.addEventListener('click', (e) => {
        const b = e.target.closest('.theme-pick');
        if (!b) return;
        e.preventDefault();
        palette = b.dataset.palette;
        select(form, false);
      });
      form.addEventListener('change', (e) => {
        if (e.target.name === 'withCover') {
          withCover = e.target.checked;
          showPreview();
        } else if (e.target.name === 'pickerMode') {
          mode = e.target.value;
          // 卡片要換成淺色或深色的版本，整個重畫
          form.querySelector('[data-theme-picks]').innerHTML = allCards();
          showPreview();
        }
      });
    },
    onClose() {
      if (!saved) env.lookPreview.set(null);
    },
    onSubmit() {
      saved = true;
      const patch = { palette, theme: mode };
      if (withCover) patch.coverStyle = getTheme(palette).cover;
      store.saveSettings(patch);
      env.lookPreview.keepUntilSaved(patch);
      onSaved?.(patch);
      toast(`已換成「${getTheme(palette).name}」`);
      return true;
    },
  });

  // 換選取的主題：只改標示，不重畫卡片（20 張封面重畫一次會卡）
  function select(form, reveal) {
    for (const b of form.querySelectorAll('.theme-pick')) {
      const on = b.dataset.palette === palette;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-checked', String(on));
      if (on && reveal) {
        b.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        b.focus({ preventScroll: true });
      }
    }
    form.querySelector('[data-cover-label]').textContent = coverLabel();
    showPreview();
  }
}

// ---------- 換封面 ----------
export function openCoverPicker(env) {
  const palette = env?.currentLook ? env.currentLook().palette : store.state.settings.palette;
  let style = store.state.settings.coverStyle;
  let seed = store.state.settings.coverSeed;
  const draw = (id, prefix) => coverSVG(id, seed, prefix, { tint: tintFor(id, palette) });

  const picks = () => COVER_STYLES.map((c) => `
    <button type="button" class="cover-pick${c.id === style ? ' is-active' : ''}" role="radio" aria-checked="${c.id === style}" data-style="${c.id}">
      <span class="cover-thumb">${draw(c.id, 'th')}</span><span class="cover-name">${c.name}</span>
    </button>`).join('');

  openModal({
    title: '換封面',
    size: 'lg',
    submitLabel: '套用封面',
    body: `
      <div class="cover-preview" data-preview>${draw(style, 'pv')}</div>
      <div class="cover-picks" role="radiogroup" aria-label="封面樣式" data-picks>${picks()}</div>
      <p class="hint">每一張都是用程式畫的。按「換一個版本」會重新排列圖案；格紋、彩針和波點會跟著配色主題換顏色。</p>`,
    extra: [{ label: '換一個版本', icon: 'sparkle', closes: false, onClick: (form) => { seed = randomSeed(); update(form); return false; } }],
    onOpen(form) {
      form.addEventListener('click', (e) => {
        const b = e.target.closest('[data-style]');
        if (!b) return;
        e.preventDefault();
        style = b.dataset.style;
        update(form, true);
      });
    },
    onSubmit() {
      store.saveSettings({ coverStyle: style, coverSeed: seed });
      toast('已套用封面');
      return true;
    },
  });

  function update(form, focusPick = false) {
    form.querySelector('[data-preview]').innerHTML = draw(style, 'pv');
    const holder = form.querySelector('[data-picks]');
    holder.innerHTML = picks();
    if (focusPick) holder.querySelector('.is-active')?.focus({ preventScroll: true });
  }
}
