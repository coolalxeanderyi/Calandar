// 設定：外觀（標題、圖示、主題、每週開始日、封面）、備份、帳號
import { esc, downloadFile, todayKey } from './utils.js';
import { icon, openModal, confirmDialog, toast } from './ui.js';
import { store } from './store.js';
import { segRadio } from './components.js';
import { COVER_STYLES, coverSVG, randomSeed } from './covers.js';
import { mascot } from './mascot.js';
import { usesMascot } from './model.js';

const ICONS = ['🌸', '📒', '🌈', '🍓', '🧋', '⭐', '🍀'];

export function openSettings(env) {
  const s = store.state.settings;
  const { mode, user } = store.state;
  const account = mode === 'cloud'
    ? `<p class="settings-text">已用 <b>${esc(user?.email || '你的 Google 帳號')}</b> 登入。資料會自動同步到你登入的每台裝置。</p>
       <button type="button" class="btn" data-signout>${icon('logout')}登出</button>`
    : `<p class="settings-text">現在是試用模式，資料只存在這台裝置的瀏覽器。</p>
       ${env.configured
         ? `<button type="button" class="btn primary" data-leave-demo>${icon('google')}用 Google 登入並同步</button>`
         : '<p class="hint">要在手機和電腦之間同步，請先照 README 的步驟設定 Firebase。</p>'}`;

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
        <fieldset class="field"><legend>主題</legend>${segRadio('theme', [['auto', '跟著系統'], ['light', '淺色'], ['dark', '深色']], s.theme, '主題')}</fieldset>
        <fieldset class="field"><legend>一週從哪天開始</legend>${segRadio('weekStart', [['1', '星期一'], ['0', '星期日']], s.weekStart, '一週從哪天開始')}</fieldset>
        <div class="field"><span class="label">封面</span><button type="button" class="btn" data-cover>${icon('image')}換封面</button></div>
      </section>
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
      form.addEventListener('click', async (e) => {
        const pick = e.target.closest('.emoji-pick');
        if (pick) {
          e.preventDefault();
          form.elements.icon.value = pick.dataset.emoji;
          return;
        }
        if (e.target.closest('[data-cover]')) {
          e.preventDefault();
          openCoverPicker();
          return;
        }
        if (e.target.closest('[data-export]')) {
          e.preventDefault();
          downloadFile(`規劃本備份-${todayKey()}.json`, JSON.stringify(store.exportData(), null, 2));
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
          toast('這個檔案不是規劃本的備份檔，請選擇「匯出備份」產生的 JSON 檔。', { tone: 'error', duration: 6000 });
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
    onSubmit(form) {
      const f = form.elements;
      store.saveSettings({
        title: f.title.value.trim() || '我的規劃本',
        icon: f.icon.value.trim(), // 空白＝吉祥物
        theme: f.theme.value,
        weekStart: Number(f.weekStart.value),
      });
      toast('已儲存設定');
      return true;
    },
  });
}

export function openCoverPicker() {
  let style = store.state.settings.coverStyle;
  let seed = store.state.settings.coverSeed;

  const picks = () => COVER_STYLES.map((c) => `
    <button type="button" class="cover-pick${c.id === style ? ' is-active' : ''}" role="radio" aria-checked="${c.id === style}" data-style="${c.id}">
      <span class="cover-thumb">${coverSVG(c.id, seed, 'th')}</span><span class="cover-name">${c.name}</span>
    </button>`).join('');

  openModal({
    title: '換封面',
    size: 'lg',
    submitLabel: '套用封面',
    body: `
      <div class="cover-preview" data-preview>${coverSVG(style, seed, 'pv')}</div>
      <div class="cover-picks" role="radiogroup" aria-label="封面樣式" data-picks>${picks()}</div>
      <p class="hint">每一張都是用程式畫的。按「換一個版本」會重新排列雲朵、愛心、粉圓和田地。</p>`,
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
    form.querySelector('[data-preview]').innerHTML = coverSVG(style, seed, 'pv');
    const holder = form.querySelector('[data-picks]');
    holder.innerHTML = picks();
    if (focusPick) holder.querySelector('.is-active')?.focus({ preventScroll: true });
  }
}
