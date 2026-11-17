// 自動更新：每次打開、回到這個分頁、重新連上網路，還有每 5 分鐘，
// 都去看一下 latest.json 的 build；跟這份網站的不一樣，就代表網站更新了，自動重新載入成新版。
// 更新網站時，這裡的 APP_BUILD 和 latest.json 的 build 要一起改成新的值。
import { toast } from './ui.js';

export const APP_BUILD = '2026-11-17-3';
const TRIED_KEY = 'planner.updateTried';

async function fetchLatestBuild() {
  const res = await fetch(`latest.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return null;
  const info = await res.json();
  return info && typeof info.build === 'string' && info.build ? info.build : null;
}

function reloadTo(build) {
  // 同一個新版本只自動重新載入一次，避免檔案還沒更新完時一直重新整理
  try {
    if (sessionStorage.getItem(TRIED_KEY) === build) return false;
    sessionStorage.setItem(TRIED_KEY, build);
  } catch { /* 無痕模式 */ }
  location.reload();
  return true;
}

export function startAutoUpdate({ isBusy }) {
  let asked = false;
  let checking = false;

  const check = async () => {
    if (checking || !navigator.onLine) return;
    checking = true;
    try {
      const latest = await fetchLatestBuild();
      if (!latest || latest === APP_BUILD) return;
      if (!isBusy()) {
        toast('計劃版更新了，正在換成新版…');
        setTimeout(() => {
          if (!reloadTo(latest)) toast('計劃版更新了，請重新整理頁面', { duration: 10000 });
        }, 900);
      } else if (!asked) {
        // 正在輸入或開著視窗時先不要重新載入，讓使用者自己按
        asked = true;
        toast('計劃版有新版本了', { actionLabel: '現在更新', duration: 15000, onAction: () => location.reload() });
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
