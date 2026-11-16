// 自動更新：每次打開、回到這個分頁、重新連上網路，還有每 5 分鐘，
// 都去看一下根目錄的 latest.json；有更新的版本資料夾就自動換過去。
// 想停在這個版本（例如看舊版），網址加上 ?stay=1。
import { toast } from './ui.js';

export const APP_VERSION = 'v6';
const LATEST_KEY = 'planner.latestPath';
const num = (v) => Number(String(v).replace(/\D/g, '')) || 0;

async function fetchLatest() {
  const res = await fetch(`../latest.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return null;
  const info = await res.json();
  return info && /^v\d+$/.test(info.version) ? info.version : null;
}

// 確定新版本的資料夾真的在，才換過去（避免換到一個打不開的網址）
async function exists(version) {
  try {
    const res = await fetch(`../${version}/?t=${Date.now()}`, { cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

function go(version) {
  const params = new URLSearchParams(location.search);
  params.delete('stay');
  const q = params.toString();
  location.replace(`../${version}/${q ? `?${q}` : ''}${location.hash}`);
}

export function startAutoUpdate({ isBusy }) {
  if (new URLSearchParams(location.search).has('stay')) return;
  let asked = false;
  let checking = false;

  const check = async () => {
    if (checking || !navigator.onLine) return;
    checking = true;
    try {
      const latest = await fetchLatest();
      if (!latest) return;
      try {
        localStorage.setItem(LATEST_KEY, `./${latest}/`);
      } catch { /* 無痕模式 */ }
      if (num(latest) <= num(APP_VERSION) || !(await exists(latest))) return;
      if (!isBusy()) {
        toast('計劃版更新了，正在換成新版…');
        setTimeout(() => go(latest), 900);
      } else if (!asked) {
        // 正在輸入或開著視窗時先不要跳走，讓使用者自己按
        asked = true;
        toast('計劃版有新版本了', { actionLabel: '現在更新', duration: 15000, onAction: () => go(latest) });
      }
    } catch {
      /* 沒網路或檔案壞掉就下次再試 */
    } finally {
      checking = false;
    }
  };

  check();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  window.addEventListener('online', check);
  setInterval(check, 5 * 60_000);
}
