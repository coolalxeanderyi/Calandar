// 字體大小：每台裝置各自記（例如 iPad 調大、手機維持原本的大小）
// index.html 開頭也有一段一樣的程式，打開時先套用，畫面才不會閃一下
export const FONT_SIZES = [['1', '標準'], ['1.12', '大'], ['1.25', '特大'], ['1.4', '超大']];
const KEY = 'planner.v1.fontScale';

const valid = (v) => FONT_SIZES.some(([x]) => x === v);

export function fontScale() {
  try {
    const v = localStorage.getItem(KEY);
    return valid(v) ? v : '1';
  } catch {
    return '1';
  }
}

export function applyFontScale(v = fontScale()) {
  const root = document.documentElement;
  if (!valid(v) || v === '1') {
    root.style.removeProperty('--fs');
    delete root.dataset.font;
  } else {
    root.style.setProperty('--fs', v);
    root.dataset.font = v;
  }
}

export function setFontScale(v) {
  const value = valid(v) ? v : '1';
  try {
    if (value === '1') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, value);
  } catch { /* 存不了：這次還是會套用 */ }
  applyFontScale(value);
}
