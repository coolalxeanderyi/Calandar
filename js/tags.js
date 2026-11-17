// 標籤：使用者自己建立，名稱和顏色都可以改。存在設定裡，換裝置也一樣。
// 任務只記標籤的 id，所以改名、換顏色不用動到任務。
import { store } from './store.js';
import { esc, uid } from './utils.js';
import { TAG_COLORS, TAG_COLOR_IDS, MAX_TAGS } from './model.js';

export { TAG_COLORS, TAG_COLOR_IDS, MAX_TAGS };

export const allTags = () => store.state.settings.tags;
export const tagMap = () => new Map(allTags().map((t) => [t.id, t]));
export const tagVar = (color) => `var(--tag-${TAG_COLOR_IDS.includes(color) ? color : 'blue'})`;
export const colorName = (color) => TAG_COLORS.find((c) => c.id === color)?.name || '藍';

// 任務上的標籤（已經刪掉的標籤不顯示）
export function tagsOf(task, map = tagMap()) {
  return (task.tags || []).map((id) => map.get(id)).filter(Boolean);
}

export const tagChip = (tag) => `<span class="tag tag-label" style="--tc:${tagVar(tag.color)}"><i class="tag-dot" aria-hidden="true"></i>${esc(tag.name)}</span>`;

export function nextColor(tags = allTags()) {
  const used = new Set(tags.map((t) => t.color));
  return TAG_COLOR_IDS.find((c) => !used.has(c)) || TAG_COLOR_IDS[tags.length % TAG_COLOR_IDS.length];
}

export const cleanTagName = (name) => String(name || '').replace(/^[#＃]+/, '').replace(/\s+/g, ' ').trim().slice(0, 20);

export const findTag = (name, tags = allTags()) => {
  const n = cleanTagName(name).toLowerCase();
  return tags.find((t) => t.name.toLowerCase() === n) || null;
};

// 依名稱找標籤，沒有的就建立（依序拿下一個顏色）。回傳 id 和新建立的標籤。
export function ensureTags(names) {
  const tags = [...allTags()];
  const ids = [];
  const created = [];
  for (const raw of names) {
    const name = cleanTagName(raw);
    if (!name) continue;
    let tag = findTag(name, tags);
    if (!tag) {
      if (tags.length >= MAX_TAGS) continue;
      tag = { id: `g${uid().slice(0, 12)}`, name, color: nextColor(tags) };
      tags.push(tag);
      created.push(tag);
    }
    if (!ids.includes(tag.id)) ids.push(tag.id);
  }
  if (created.length) store.saveSettings({ tags });
  return { ids, created };
}

export function renameTag(id, name) {
  const clean = cleanTagName(name);
  if (!clean) return false;
  const other = findTag(clean);
  if (other && other.id !== id) return false; // 已經有同名的標籤
  store.saveSettings({ tags: allTags().map((t) => (t.id === id ? { ...t, name: clean } : t)) });
  return true;
}

export function cycleTagColor(id) {
  const tags = allTags().map((t) => {
    if (t.id !== id) return t;
    const i = TAG_COLOR_IDS.indexOf(t.color);
    return { ...t, color: TAG_COLOR_IDS[(i + 1) % TAG_COLOR_IDS.length] };
  });
  store.saveSettings({ tags });
  return tags.find((t) => t.id === id);
}

// 刪掉標籤：任務本身留著，只把這個標籤拿掉
export function deleteTag(id) {
  store.saveSettings({ tags: allTags().filter((t) => t.id !== id) });
  const changes = store.state.tasks.filter((t) => t.tags.includes(id)).map((t) => [t.id, { tags: t.tags.filter((x) => x !== id) }]);
  store.patchTasks(changes);
}

// 篩選列：「全部」加上每個標籤
export function tagFilterBar(active, action, label = '依標籤篩選') {
  const tags = allTags();
  if (!tags.length) return '';
  const chip = (value, text, color) => `<button type="button" class="chip tag-chip${active === value ? ' is-active' : ''}" aria-pressed="${active === value}" data-action="${action}" data-value="${esc(value)}"${color ? ` style="--tc:${tagVar(color)}"` : ''}>${color ? '<i class="tag-dot" aria-hidden="true"></i>' : ''}${esc(text)}</button>`;
  return `<div class="chips tag-filter" role="group" aria-label="${label}">${chip('', '所有標籤')}${tags.map((t) => chip(t.id, t.name, t.color)).join('')}</div>`;
}
