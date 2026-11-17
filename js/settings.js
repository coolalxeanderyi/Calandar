// 設定：外觀（標題、圖示、配色主題、深淺模式、每週開始日、封面）、Google 日曆、備份、帳號
import { esc, downloadFile, todayKey } from './utils.js';
import { icon, openModal, confirmDialog, toast } from './ui.js';
import { store } from './store.js';
import { segRadio } from './components.js';
import { COVER_STYLES, coverSVG, randomSeed } from './covers.js';
import { mascot } from './mascot.js';
import { usesMascot } from './model.js';
import { THEMES, THEME_GROUPS, getTheme, tintFor, varsStyle } from './themes.js';
import { gcalState, onGcalChange, disconnect as gcalDisconnect, setPush as gcalSetPush, CALENDAR_NAME } from './gcal.js';
import {
  bridgeOn, pingBridge, refreshInfo, checkScriptUrl, newKey, externalState, pickerCalendars, onExternalChange, reloadExternal,
} from './gsync.js';
import { scriptCode, SCRIPT_VERSION } from './gas-code.js';
import { backupNow, backupState, onBackupChange, BACKUP_VERSION } from './gsync.js';
import { allTags, tagVar, colorName, ensureTags, renameTag, cycleTagColor, deleteTag, MAX_TAGS } from './tags.js';

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
  let stopExternal = () => {};
  let stopBackup = () => {};

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
      <section class="settings-sec" aria-labelledby="st-tags" data-tags-sec>${tagsSection()}</section>
      <section class="settings-sec" aria-labelledby="st-tpl" data-tpl-sec>${templatesSection()}</section>
      <section class="settings-sec" aria-labelledby="st-gcal" data-gcal-sec>${gcalSection(env)}</section>
      <section class="settings-sec" aria-labelledby="st-iphone">${iphoneSection()}</section>
      <section class="settings-sec" aria-labelledby="st-backup">
        <h3 class="sub-title" id="st-backup">備份</h3>
        <p class="hint">備份檔是一個 JSON 檔，可以留一份副本，或把資料搬到另一個帳號。</p>
        <div class="btn-row">
          <button type="button" class="btn" data-export>${icon('download')}匯出備份</button>
          <button type="button" class="btn" data-import>${icon('upload')}匯入備份</button>
          <input type="file" accept="application/json,.json" data-import-file hidden>
        </div>
        <div class="backup-drive" data-backup-box>${backupBox()}</div>
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
      // 標籤、範本、雲端硬碟備份：內容變了才重畫那一段
      const parts = [['[data-tags-sec]', tagsSection], ['[data-tpl-sec]', templatesSection], ['[data-backup-box]', backupBox]];
      const partHTML = new Map(parts.map(([sel, fn]) => [sel, fn()]));
      const refreshParts = () => {
        for (const [sel, fn] of parts) {
          const box = form.querySelector(sel);
          const html = fn();
          if (!box || html === partHTML.get(sel)) continue;
          const active = document.activeElement;
          // 正在改標籤名稱時先不要重畫，免得打到一半的字不見（改完離開欄位後會再更新）
          if (box.contains(active) && active.matches('[data-tag-rename]')) continue;
          partHTML.set(sel, html);
          const keep = box.contains(active) && active.matches('[data-tag-create]') ? active.value : null;
          box.innerHTML = html;
          if (keep !== null) {
            const input = box.querySelector('[data-tag-create]');
            input.value = keep;
            input.focus({ preventScroll: true });
          }
        }
      };
      const refreshAll = () => {
        refreshGcal();
        refreshParts();
      };
      stopGcal = onGcalChange(refreshGcal);
      stopStore = store.subscribe(refreshAll);
      stopExternal = onExternalChange(refreshAll);
      stopBackup = onBackupChange(refreshParts);
      if (bridgeOn()) refreshInfo({ force: true }); // 順便更新日曆清單、檢查 Apps Script 的版本

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
        // ---- 標籤 ----
        if (e.target.closest('[data-tag-create-btn]')) {
          e.preventDefault();
          createTagFrom(form);
          return;
        }
        const colorBtn = e.target.closest('[data-tag-color]');
        if (colorBtn) {
          e.preventDefault();
          const tag = cycleTagColor(colorBtn.dataset.tagColor);
          if (tag) toast(`「${tag.name}」換成${colorName(tag.color)}色`);
          return;
        }
        const delTag = e.target.closest('[data-tag-delete]');
        if (delTag) {
          e.preventDefault();
          const tag = allTags().find((g) => g.id === delTag.dataset.tagDelete);
          if (!tag) return;
          const n = store.state.tasks.filter((t) => t.tags.includes(tag.id)).length;
          const ok = await confirmDialog(n ? `有 ${n} 個任務用了這個標籤。任務本身不會被刪掉，只會拿掉這個標籤。` : '這個標籤還沒有任務在用。', {
            title: `刪除標籤「${tag.name}」？`,
            confirmLabel: '刪除標籤',
            danger: true,
          });
          if (!ok) return;
          deleteTag(tag.id);
          toast(`已刪除標籤「${tag.name}」`);
          return;
        }
        // ---- 範本 ----
        const delTpl = e.target.closest('[data-tpl-delete]');
        if (delTpl) {
          e.preventDefault();
          const tpl = store.state.settings.templates.find((x) => x.id === delTpl.dataset.tplDelete);
          if (!tpl) return;
          const ok = await confirmDialog('用這個範本建立過的任務不會受影響。', { title: `刪除範本「${tpl.name}」？`, confirmLabel: '刪除範本', danger: true });
          if (!ok) return;
          store.saveSettings({ templates: store.state.settings.templates.filter((x) => x.id !== tpl.id) });
          toast(`已刪除範本「${tpl.name}」`);
          return;
        }
        // ---- 雲端硬碟備份 ----
        if (e.target.closest('[data-backup-now]')) {
          e.preventDefault();
          try {
            const r = await backupNow();
            if (r) toast(`已備份到 Google 雲端硬碟（${r.file}）`);
          } catch (err) {
            toast(backupState().error || err.message, { tone: 'error', duration: 8000 });
          }
          return;
        }
        if (e.target.closest('[data-gs-copy]')) {
          e.preventDefault();
          copyScript(form, e.target.closest('[data-gs-copy]'));
          return;
        }
        if (e.target.closest('[data-gs-download]')) {
          e.preventDefault();
          downloadFile('計劃版同步.gs', scriptCode(ensureKey()), 'text/plain');
          return;
        }
        if (e.target.closest('[data-gs-connect]')) {
          e.preventDefault();
          connectBridge(form);
          return;
        }
        if (e.target.closest('[data-gs-off]')) {
          e.preventDefault();
          const ok = await confirmDialog(`計劃版不會再顯示 Google 日曆的行程，也不會再把任務放進 Google 日曆。已經放進「${CALENDAR_NAME}」日曆的行程會留著。Apps Script 的專案還在你的 Google 帳號裡，不用的話可以到 script.google.com 刪掉。`, {
            title: '中斷 Google 日曆的連接？',
            confirmLabel: '中斷連接',
          });
          if (!ok) return;
          gcalDisconnect();
          toast('已中斷 Google 日曆的連接');
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
      // Google 日曆：勾選要顯示的日曆、開關「把任務放進 Google 日曆」
      form.addEventListener('change', (e) => {
        if (e.target.matches('[data-tag-rename]')) {
          const id = e.target.closest('[data-tag-id]').dataset.tagId;
          const old = allTags().find((g) => g.id === id);
          if (!old || e.target.value.trim() === old.name) {
            setTimeout(refreshParts, 0); // 名稱沒變：補上剛剛延後的更新
            return;
          }
          if (renameTag(id, e.target.value)) toast(`已改名為「${e.target.value.trim()}」`);
          else {
            toast(e.target.value.trim() ? '已經有同名的標籤了' : '標籤名稱不能空白', { tone: 'error' });
            e.target.value = old.name;
          }
          return;
        }
        if (e.target.matches('[data-backup-on]')) {
          store.saveSettings({ backupOn: e.target.checked });
          return;
        }
        if (e.target.matches('[data-gs-cal]')) {
          const ids = [...form.querySelectorAll('[data-gs-cal]:checked')].map((el) => el.value);
          store.saveSettings({ gsPick: true, gsCals: ids });
          reloadExternal();
        } else if (e.target.matches('[data-gs-push]')) {
          gcalSetPush(e.target.checked);
        }
      });
      form.addEventListener('input', (e) => {
        if (e.target.matches('[data-gs-url]')) urlDraft = e.target.value;
      });
      // 在網址欄按 Enter 是「連接」，不是儲存整個設定；在標籤欄按 Enter 是新增或改名
      form.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing && e.target.matches('[data-tag-create]')) {
          e.preventDefault();
          createTagFrom(form);
          return;
        }
        if (e.key === 'Enter' && !e.isComposing && e.target.matches('[data-tag-rename]')) {
          e.preventDefault();
          e.target.blur();
          return;
        }
        if (e.key === 'Enter' && e.target.matches('[data-gs-url]')) {
          e.preventDefault();
          connectBridge(form);
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
      stopExternal();
      stopBackup();
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

// ---------- 標籤 ----------
function tagsSection() {
  const tags = allTags();
  const counts = new Map();
  for (const t of store.state.tasks) for (const id of t.tags) counts.set(id, (counts.get(id) || 0) + 1);
  return `<h3 class="sub-title" id="st-tags">標籤</h3>
    <p class="hint">幫任務分類，例如「家教」「拍片」「學校」。在任務頁和行事曆可以用標籤篩選。點左邊的圓點可以換顏色，名稱直接改就好。</p>
    ${tags.length ? `<ul class="tag-admin">${tags.map((g) => `
      <li class="tag-admin-row" data-tag-id="${esc(g.id)}">
        <button type="button" class="tag-swatch" style="--tc:${tagVar(g.color)}" data-tag-color="${esc(g.id)}" aria-label="換「${esc(g.name)}」的顏色（現在是${colorName(g.color)}色）"></button>
        <input class="tag-name-input" value="${esc(g.name)}" maxlength="20" autocomplete="off" data-tag-rename aria-label="標籤名稱：${esc(g.name)}">
        <span class="tag-count">${counts.get(g.id) || 0} 個任務</span>
        <button type="button" class="icon-btn small" data-tag-delete="${esc(g.id)}" aria-label="刪除標籤「${esc(g.name)}」">${icon('trash')}</button>
      </li>`).join('')}</ul>` : ''}
    ${tags.length < MAX_TAGS ? `<div class="inline-add">
      <input data-tag-create placeholder="新標籤的名稱，例如：家教" maxlength="20" autocomplete="off" aria-label="新標籤的名稱">
      <button type="button" class="btn small" data-tag-create-btn>${icon('plus')}新增標籤</button>
    </div>` : `<p class="hint">標籤最多 ${MAX_TAGS} 個。</p>`}`;
}

function createTagFrom(form) {
  const input = form.querySelector('[data-tag-create]');
  if (!input) return;
  const name = input.value.trim();
  if (!name) {
    input.focus();
    return;
  }
  const { created } = ensureTags([name]);
  toast(created.length ? `已新增標籤「${created[0].name}」` : '已經有這個標籤了');
  input.value = '';
  input.focus();
}

// ---------- 任務範本 ----------
function templatesSection() {
  const list = store.state.settings.templates;
  return `<h3 class="sub-title" id="st-tpl">任務範本</h3>
    <p class="hint">把常用的步驟存起來，例如拍片流程。在新增或編輯任務的視窗按「存成範本」就會出現在這裡；新增任務時可以「從範本建立」。</p>
    ${list.length ? `<ul class="tpl-admin">${list.map((x) => `
      <li class="tpl-admin-row">
        <span class="tpl-name">${esc(x.name)}</span>
        <span class="tpl-meta">${x.checklist.length ? `${x.checklist.length} 個步驟` : '沒有小清單'}</span>
        <button type="button" class="icon-btn small" data-tpl-delete="${esc(x.id)}" aria-label="刪除範本「${esc(x.name)}」">${icon('trash')}</button>
      </li>`).join('')}</ul>` : '<p class="settings-text">還沒有範本。</p>'}`;
}

// ---------- 雲端硬碟備份 ----------
function backupBox() {
  const s = store.state.settings;
  if (!bridgeOn()) {
    return '<p class="hint">連接 Google 日曆之後（設定裡的「Google 日曆」），計劃版每天會自動備份一份到你的 Google 雲端硬碟。</p>';
  }
  const ext = externalState();
  if (ext.version && ext.version < BACKUP_VERSION) {
    return '<p class="hint">要自動備份到 Google 雲端硬碟，請先照「Google 日曆」裡「更新 Apps Script」的步驟換成新的程式碼。</p>';
  }
  const st = backupState();
  const last = s.backupDay ? `上次備份：${s.backupDay === todayKey() ? '今天' : s.backupDay}` : '還沒備份過';
  return `<label class="gs-toggle"><input type="checkbox" data-backup-on${s.backupOn ? ' checked' : ''}><span>每天自動備份到 Google 雲端硬碟（「計劃版備份」資料夾，留最近 30 天）</span></label>
    <p class="hint" role="status">${st.busy ? '正在備份…' : esc(st.error || last)}</p>
    <div class="btn-row">
      <button type="button" class="btn small" data-backup-now${st.busy ? ' disabled' : ''}>${icon('upload')}立即備份</button>
      ${s.backupUrl ? `<a class="btn small ghost" href="${esc(s.backupUrl)}" target="_blank" rel="noopener">${icon('external')}打開備份資料夾</a>` : ''}
    </div>`;
}

// ---------- 放到 iPhone 主畫面 ----------
// 兩種方法都是同一件事：主畫面多一個計劃版的圖示，點開是全螢幕
function iphoneSection() {
  return `<h3 class="sub-title" id="st-iphone">放到 iPhone 主畫面</h3>
    <p class="settings-text">放好之後主畫面會有計劃版的圖示，點開是全螢幕，沒網路也打得開，網站更新時也會自動更新。兩種方法選一種就好，都免費。</p>
    <details class="gcal-help">
      <summary>方法一：用 Safari 加入主畫面（最快）</summary>
      <ol>
        <li>用 iPhone 的 Safari 打開計劃版。</li>
        <li>按下方的「分享」按鈕（方框加一個往上的箭頭）。</li>
        <li>往下滑，選「加入主畫面」，再按「加入」。</li>
      </ol>
    </details>
    <details class="gcal-help">
      <summary>方法二：安裝描述檔</summary>
      <ol>
        <li>用 iPhone 的 Safari 打開這一頁，按這裡：<a class="btn small" href="iphone.mobileconfig">${icon('download')}下載描述檔</a></li>
        <li>如果跳出「要允許下載描述檔嗎」，按「允許」，直接跳到第 4 步。如果是問要不要下載檔案，按「下載」。</li>
        <li>打開「檔案」App，在「下載項目」裡點「iphone.mobileconfig」。</li>
        <li>打開「設定」，點最上面的「已下載描述檔」，按右上角的「安裝」，輸入手機密碼，再按「安裝」。</li>
      </ol>
      <p class="hint">安裝時會顯示「未簽署」，那是因為沒有花錢買簽名，是正常的。這個描述檔只會加一個圖示，不會改手機的其他設定；不想要的話，長按圖示刪掉就好。</p>
    </details>
    <p class="hint">第一次從主畫面打開要再登入一次（主畫面的計劃版跟 Safari 是分開記住的），登進去還是同一個帳號、同一份資料。</p>`;
}

// ---------- 設定裡的 Google 日曆 ----------
function sectionKey() {
  const { mode, settings: s } = store.state;
  const base = `${mode}|${s.gcalOn}|${gcalState().phase === 'error'}|${bridgeOn()}`;
  if (!bridgeOn()) return base;
  const ext = externalState();
  return `${base}|${ext.hasInfo}|${ext.version}|${ext.infoError}|${ext.error}|${pickerCalendars().map((c) => `${c.id}:${c.checked}`).join()}`;
}

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

// 用 Google 登入連接（舊方式）前，要在 Google Cloud 做的設定（直接連到這個 Firebase 專案的頁面）
function setupSteps(env, { open = false } = {}) {
  const q = env.projectId ? `?project=${encodeURIComponent(env.projectId)}` : '';
  return `<details class="gcal-help"${open ? ' open' : ''}>
      <summary>第一次使用前，先在 Google Cloud 做好這三步</summary>
      <ol>
        <li><a href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com${q}" target="_blank" rel="noopener">啟用 Google Calendar API</a>，按「啟用」。</li>
        <li>到 <a href="https://console.cloud.google.com/auth/scopes${q}" target="_blank" rel="noopener">資料存取</a> 按「新增或移除範圍」，在「手動新增範圍」貼上 <code>https://www.googleapis.com/auth/calendar.app.created</code>，再按「儲存」。</li>
        <li>到 <a href="https://console.cloud.google.com/auth/audience${q}" target="_blank" rel="noopener">目標對象</a> 看發布狀態：「測試中」的話，把自己的 Gmail 加進「測試使用者」；「已發布」就不用改。</li>
      </ol>
      <p class="hint">都要用建立 Firebase 的那個 Google 帳號登入。這些設定都是免費的。</p>
    </details>`;
}

const iphoneHelp = () => `<details class="gcal-help">
      <summary>想在 iPhone、iPad 的「行事曆」App 看到？</summary>
      <ol>
        <li>在 iPhone 的「設定」裡找到「行事曆」，在「行事曆帳號」加入同一個 Google 帳號（已經加過就跳過）。</li>
        <li>用瀏覽器打開 <a href="https://calendar.google.com/calendar/syncselect" target="_blank" rel="noopener">Google 日曆的同步設定</a>，勾選「${CALENDAR_NAME}」，再按「儲存」。</li>
        <li>回到「行事曆」App，就會看到「${CALENDAR_NAME}」這個日曆。</li>
      </ol>
    </details>`;

// ---- 透過自己的 Apps Script 連接（建議的方式） ----
let draftKey = '';
let urlDraft = '';

// 每個人的程式碼裡都有一組只屬於他的密碼；第一次複製時產生，存在設定裡（換裝置也一樣）
function ensureKey() {
  const s = store.state.settings;
  if (s.gsKey) return s.gsKey;
  if (!draftKey) {
    draftKey = newKey();
    store.saveSettings({ gsKey: draftKey });
  }
  return draftKey;
}

async function copyScript(form, btn) {
  const code = scriptCode(ensureKey());
  const box = btn.closest('li, details')?.querySelector('[data-gs-code]');
  try {
    await navigator.clipboard.writeText(code);
    if (box) box.hidden = true;
    toast('已複製程式碼，接著貼到 Apps Script');
  } catch {
    // 有些瀏覽器不讓網站直接寫入剪貼簿：把程式碼放在框框裡，選好讓使用者自己複製
    if (box) {
      box.value = code;
      box.hidden = false;
      box.focus();
      box.select();
    }
    toast('沒辦法自動複製。程式碼已經放在框框裡並選好了，請自己按「複製」。', { duration: 8000 });
  }
}

async function connectBridge(form) {
  const input = form.querySelector('[data-gs-url]');
  const msg = form.querySelector('[data-gs-msg]');
  const btn = form.querySelector('[data-gs-connect]');
  if (!input || !btn || btn.disabled) return;
  const say = (text, tone = '') => {
    msg.textContent = text;
    msg.className = `hint gs-msg${tone ? ` is-${tone}` : ''}`;
  };
  const { url, error } = checkScriptUrl(input.value);
  if (error) {
    say(error, 'error');
    input.focus();
    return;
  }
  const key = store.state.settings.gsKey || draftKey;
  if (!key) {
    say('請先按第 1 步的「複製程式碼」，貼到 Apps Script 並部署之後再連接。', 'error');
    return;
  }
  btn.disabled = true;
  say('連接中…');
  try {
    const found = await pingBridge({ url, key });
    store.saveSettings({ gsUrl: url, gsKey: key, gcalOn: true, gcalHash: '', gsPick: false, gsCals: [] });
    draftKey = '';
    urlDraft = '';
    toast(`已連接 Google 日曆（找到 ${found.calendars.length} 個日曆）`);
  } catch (err) {
    say(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

const copyButtons = `<div class="btn-row">
    <button type="button" class="btn small" data-gs-copy>${icon('copy')}複製程式碼</button>
    <button type="button" class="btn small ghost" data-gs-download>${icon('download')}下載成檔案</button>
  </div>
  <textarea class="gs-code" readonly hidden data-gs-code aria-label="Apps Script 的程式碼" rows="6"></textarea>`;

function bridgeSetup() {
  return `<div class="gs-setup">
      <p class="settings-text">連接之後會自動同步，不用再按任何按鈕：</p>
      <ul class="gs-points">
        <li>你在 Google 日曆裡的行程，會出現在計劃版的行事曆和「今天」（只會讀，不會改）</li>
        <li>計劃版有日期的任務和目標期限，會放進 Google 日曆裡一個叫「${CALENDAR_NAME}」的日曆</li>
      </ul>
      <p class="hint">做法是在你的 Google 帳號裡放一小段免費的程式（Google Apps Script）當橋樑。照下面做一次就好，大約 5 分鐘，建議用電腦。</p>
      <ol class="gs-steps">
        <li><span class="gs-step-title">複製程式碼</span>
          ${copyButtons}
          <p class="hint">程式碼裡有一組只屬於你的密碼，不要給別人。</p>
        </li>
        <li><span class="gs-step-title">貼到 Apps Script</span>
          <p>打開 <a href="https://script.google.com/home" target="_blank" rel="noopener">Apps Script</a>，按左上角的「新專案」（New project）。把編輯器裡原本的內容全部刪掉，貼上剛剛複製的程式碼，按「儲存」💾。左上角的「未命名的專案」可以改成「計劃版同步」。</p>
        </li>
        <li><span class="gs-step-title">加入日曆服務</span>
          <p>左邊「服務」（Services）旁邊按「＋」，選「Google Calendar API」，按「新增」（Add）。</p>
        </li>
        <li><span class="gs-step-title">部署</span>
          <p>右上角按「部署」（Deploy）→「新增部署作業」（New deployment）→ 按齒輪選「網頁應用程式」（Web app）。「執行身分」（Execute as）選「我」（Me），「誰可以存取」（Who has access）選「所有人」（Anyone），按「部署」（Deploy）。</p>
        </li>
        <li><span class="gs-step-title">授權</span>
          <p>按「授予存取權」（Authorize access），選你的 Google 帳號。看到「Google 尚未驗證這個應用程式」時，按「進階」（Advanced）→「前往 計劃版同步（不安全）」→「允許」（Allow）。這是你自己剛貼上的程式，所以沒關係。</p>
          <p class="hint">權限裡會有 Google 日曆和 Google 雲端硬碟。雲端硬碟是用來每天備份的，程式只會在「計劃版備份」資料夾裡放備份檔。</p>
        </li>
        <li><span class="gs-step-title">貼上網址</span>
          <p>複製「網頁應用程式」下面的網址（開頭是 https://script.google.com/macros/s/，結尾是 /exec），貼在這裡：</p>
          <div class="gs-connect">
            <input type="url" inputmode="url" autocomplete="off" spellcheck="false" data-gs-url value="${esc(urlDraft)}" aria-label="Apps Script 網頁應用程式的網址" placeholder="https://script.google.com/macros/s/…/exec">
            <button type="button" class="btn primary" data-gs-connect>${icon('calendar')}連接</button>
          </div>
          <p class="hint gs-msg" data-gs-msg role="status" aria-live="polite"></p>
        </li>
      </ol>
    </div>`;
}

function bridgeStatus() {
  const s = store.state.settings;
  const ext = externalState();
  const cals = pickerCalendars();
  const [cls, text] = statusInfo();
  const calList = cals.length
    ? `<div class="gs-cal-list">${cals.map((c) => `
        <label class="gs-cal"><input type="checkbox" data-gs-cal value="${esc(c.id)}"${c.checked ? ' checked' : ''}><span class="gs-swatch" style="--ev:${c.color}" aria-hidden="true"></span><span class="gs-cal-name">${esc(c.name)}</span></label>`).join('')}</div>`
    : `<p class="hint">${ext.infoError ? esc(ext.infoError) : '正在讀取你的日曆清單…'}</p>`;
  return `
    <p class="settings-text gs-on">${icon('check')}已連接，會自動同步。</p>
    ${ext.version && ext.version < SCRIPT_VERSION ? '<p class="gs-warn" role="status">Apps Script 裡的程式有新版本了。請照下面「更新 Apps Script」的步驟換成新的程式碼。</p>' : ''}
    <fieldset class="field gs-cals"><legend>在計劃版顯示這些日曆的行程</legend>
      ${calList}
      ${ext.error ? `<p class="hint is-error" role="status">${esc(ext.error)}</p>` : ''}
    </fieldset>
    <div class="field">
      <label class="gs-toggle"><input type="checkbox" data-gs-push${s.gcalOn ? ' checked' : ''}><span>把計劃版有日期的任務和目標期限，放進 Google 日曆的「${CALENDAR_NAME}」日曆</span></label>
      ${s.gcalOn ? `<p class="settings-text gcal-status is-${cls}" data-gcal-status role="status">${esc(text)}</p>
      <p class="hint" data-gcal-last>${lastSyncText()}</p>` : ''}
    </div>
    <div class="btn-row">
      ${s.gcalOn ? `<button type="button" class="btn" data-gcal-sync>${icon('repeat')}立即同步</button>` : ''}
      <a class="btn ghost" href="https://calendar.google.com/" target="_blank" rel="noopener">打開 Google 日曆</a>
      <button type="button" class="btn ghost danger-text" data-gs-off>中斷連接</button>
    </div>
    ${iphoneHelp()}
    <details class="gcal-help"${ext.version && ext.version < SCRIPT_VERSION ? ' open' : ''}>
      <summary>更新 Apps Script，或同步出問題了</summary>
      <ol>
        <li>重新複製程式碼：${copyButtons}</li>
        <li>打開 <a href="https://script.google.com/home" target="_blank" rel="noopener">Apps Script</a>，點「計劃版同步」這個專案，把裡面的程式全部換成剛複製的，按「儲存」💾。</li>
        <li>在上方的函式選單選 test，按「執行」（Run），照畫面允許權限。新版多了 Google 雲端硬碟的權限，是用來每天備份的，程式只會在「計劃版備份」資料夾裡放備份檔。</li>
        <li>右上角「部署」→「管理部署作業」（Manage deployments）→ 按鉛筆圖示（編輯）→「版本」選「新版本」（New version）→「部署」。網址不會變，不用重新貼。</li>
      </ol>
      <p class="hint">如果顯示「需要再授權一次」：一樣在函式選單選 test，按「執行」，允許權限就好。</p>
    </details>`;
}

// 用 Google 登入連接（舊方式）中的狀態
function legacyStatus(env) {
  const [cls, text] = statusInfo();
  return `
    <p class="settings-text gcal-status is-${cls}" data-gcal-status role="status">${esc(text)}</p>
    <p class="hint" data-gcal-last>${lastSyncText()}</p>
    <p class="hint">有時間的任務會照時長變成行程，開始前 10 分鐘提醒；沒有時間的是全天行程。在這裡修改，Google 日曆會跟著更新。</p>
    <div class="btn-row">
      <button type="button" class="btn" data-gcal-sync>${icon('repeat')}立即同步</button>
      <a class="btn ghost" href="https://calendar.google.com/" target="_blank" rel="noopener">打開 Google 日曆</a>
      <button type="button" class="btn ghost danger-text" data-gcal-off>停止同步</button>
    </div>
    ${gcalState().phase === 'error' ? setupSteps(env, { open: /API/.test(gcalState().message) }) : ''}
    ${iphoneHelp()}`;
}

function legacyConnect(env) {
  return `<details class="gcal-help gs-legacy">
      <summary>不想用 Apps Script？改用 Google 登入連接（每小時要重新確認一次）</summary>
      <p class="settings-text">這個方式只會把任務放進 Google 日曆，看不到 Google 日曆裡的行程。Google 給的通行證大約一小時就會過期，有新的變更時要再按一次。</p>
      ${setupSteps(env)}
      <div class="btn-row"><button type="button" class="btn" data-gcal-connect>${icon('calendar')}用 Google 登入連接</button></div>
      <p class="hint">第一次連接時，Google 會請你允許「建立日曆並管理裡面的行程」。如果看到「Google 尚未驗證這個應用程式」，按「進階」再按「前往」就可以繼續。</p>
    </details>`;
}

function gcalSection(env) {
  const head = `<h3 class="sub-title" id="st-gcal">Google 日曆</h3>`;
  const { mode, settings: s } = store.state;
  if (mode !== 'cloud') {
    return `${head}
      <p class="settings-text">登入 Google 之後，可以把 Google 日曆的行程放進計劃版，也可以把有日期的任務和目標期限放進 Google 日曆，iPhone 的「行事曆」也看得到。</p>
      ${env.configured ? `<div class="btn-row"><button type="button" class="btn" data-leave-demo>${icon('google')}用 Google 登入</button></div>` : ''}`;
  }
  if (bridgeOn()) return `${head}${bridgeStatus()}`;
  if (s.gcalOn) {
    return `${head}${legacyStatus(env)}
      <details class="gcal-help gs-upgrade" open>
        <summary>改用自動同步（建議）：不用再每小時確認，還能在計劃版看到 Google 日曆的行程</summary>
        ${bridgeSetup()}
      </details>`;
  }
  return `${head}${bridgeSetup()}${legacyConnect(env)}`;
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
