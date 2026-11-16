// 配色主題：每一套都有淺色和深色兩種版本。想新增主題，照著格式在 THEMES 裡加一筆就好。
// tapes：四條紙膠帶的顏色（今天、本週任務、習慣、目標）
// cover：選這個主題時建議搭配的封面；tint：格紋、彩針、波點封面會用這個顏色

export const THEMES = [
  {
    id: 'strawberry', name: '草莓牛奶', emoji: '🍓', cover: 'clouds', tint: '#ff9bb8',
    light: { bg: '#fff6f3', dot: '#f6d9df', paper: '#ffffff', wash: '#fff0f4', wash2: '#fbe1e9', ink: '#3d2a36', ink2: '#6a5361', ink3: '#7d6875', line: '#f3d6de', accent: '#ff8fb1', accentStrong: '#ec6c95', onAccent: '#3d2a36', accentText: '#c02e58', accentSoft: '#ffe3eb', tapes: ['#ffc4d6', '#c4e0ff', '#b8ecd9', '#ffe59a'], mascot: '#ff8fb1' },
    dark: { bg: '#1d1722', dot: '#2d2333', paper: '#282030', wash: '#322839', wash2: '#3e3146', ink: '#f8eaf2', ink2: '#cdb3c3', ink3: '#a48f9e', line: '#3f3247', accent: '#ff9dbb', accentStrong: '#ff79a5', onAccent: '#2a1622', accentText: '#ffa3c0', accentSoft: '#46263a', tapes: ['#8c4a64', '#2f5b85', '#2f6f5d', '#846624'], mascot: '#ff8fb1' },
  },
  {
    id: 'matcha', name: '抹茶拿鐵', emoji: '🍵', cover: 'gingham', tint: '#a6d18a',
    light: { bg: '#f6f8ef', dot: '#dde8c8', paper: '#ffffff', wash: '#eff5e4', wash2: '#e1ecd0', ink: '#2f3a29', ink2: '#515d49', ink3: '#646f5c', line: '#dbe6c9', accent: '#a6d18a', accentStrong: '#7cb35f', onAccent: '#26331f', accentText: '#3d7825', accentSoft: '#e5f3d9', tapes: ['#cfe8b8', '#f3e2c0', '#bfe3d0', '#f6d6c4'], mascot: '#9cc97f' },
    dark: { bg: '#161c14', dot: '#232c1f', paper: '#1f271c', wash: '#283224', wash2: '#33402e', ink: '#eef4e6', ink2: '#bccab0', ink3: '#919d86', line: '#34412e', accent: '#b4dc98', accentStrong: '#93c873', onAccent: '#1b2416', accentText: '#bfe6a3', accentSoft: '#2b3b23', tapes: ['#4d6a3a', '#6e5a35', '#2f5f4a', '#6f4b3b'], mascot: '#9cc97f' },
  },
  {
    id: 'milktea', name: '珍珠奶茶', emoji: '🧋', cover: 'boba', tint: '#e2b48a',
    light: { bg: '#fbf5ee', dot: '#ebdccb', paper: '#ffffff', wash: '#f7eee4', wash2: '#eedfcf', ink: '#45352a', ink2: '#685446', ink3: '#78675c', line: '#ead9c6', accent: '#e2b48a', accentStrong: '#c8925f', onAccent: '#3b2a1d', accentText: '#8a5428', accentSoft: '#f6e6d6', tapes: ['#f0d3b6', '#e7d7f0', '#cfe5d6', '#f7e3a8'], mascot: '#d9a273' },
    dark: { bg: '#1c1713', dot: '#2b231c', paper: '#251e18', wash: '#30271f', wash2: '#3c3127', ink: '#f6ece2', ink2: '#cdbcaa', ink3: '#9f9081', line: '#3d3228', accent: '#e9c09a', accentStrong: '#d7a172', onAccent: '#2a1d12', accentText: '#f0c9a3', accentSoft: '#3d2d1f', tapes: ['#7a5636', '#5a4a70', '#3d5e48', '#7a6630'], mascot: '#d9a273' },
  },
  {
    id: 'soda', name: '海鹽汽水', emoji: '🌊', cover: 'waves', tint: '#86cbe6',
    light: { bg: '#f1f8fc', dot: '#d1e7f1', paper: '#ffffff', wash: '#e8f4fa', wash2: '#d7ebf5', ink: '#213645', ink2: '#465c6b', ink3: '#5c707e', line: '#d2e6f0', accent: '#86cbe6', accentStrong: '#55acd0', onAccent: '#15303f', accentText: '#1f6f91', accentSoft: '#dcf1fa', tapes: ['#bfe3f3', '#d5f2e6', '#ffe3a3', '#f6d0e0'], mascot: '#7ec8e3' },
    dark: { bg: '#121b22', dot: '#1d2a33', paper: '#19252e', wash: '#213039', wash2: '#2b3c47', ink: '#e8f3fa', ink2: '#b1c6d3', ink3: '#849aa7', line: '#2c3d48', accent: '#93d3ec', accentStrong: '#64b8db', onAccent: '#0f2531', accentText: '#a3dcf2', accentSoft: '#1d3a49', tapes: ['#2f6584', '#2d6352', '#7a6531', '#74435a'], mascot: '#7ec8e3' },
  },
  {
    id: 'lemon', name: '檸檬蘇打', emoji: '🍋', cover: 'lemons', tint: '#ffd95a',
    light: { bg: '#fffcee', dot: '#f0e3b0', paper: '#ffffff', wash: '#fff8db', wash2: '#f9edc0', ink: '#3a3424', ink2: '#645c44', ink3: '#786f58', line: '#efe1ad', accent: '#ffd95a', accentStrong: '#e8b923', onAccent: '#3a3214', accentText: '#876800', accentSoft: '#fff3c4', tapes: ['#ffe78f', '#c9efdf', '#ffd1c2', '#d7e7ff'], mascot: '#ffd34d' },
    dark: { bg: '#1c1a12', dot: '#2b2819', paper: '#24221a', wash: '#2f2c20', wash2: '#3b372a', ink: '#faf4df', ink2: '#d3c9a6', ink3: '#9e9476', line: '#3b372a', accent: '#ffe07a', accentStrong: '#f2c84a', onAccent: '#2b250c', accentText: '#ffe38a', accentSoft: '#3d3518', tapes: ['#7d6a1f', '#2e6650', '#7a4434', '#3a5579'], mascot: '#ffd34d' },
  },
  {
    id: 'blueberry', name: '藍莓優格', emoji: '🫐', cover: 'sprinkles', tint: '#e6ddfb',
    light: { bg: '#f8f6fe', dot: '#e2daf7', paper: '#ffffff', wash: '#f1edfd', wash2: '#e5ddfa', ink: '#302945', ink2: '#5a5274', ink3: '#6e6785', line: '#e1d9f6', accent: '#bba6f2', accentStrong: '#9479e0', onAccent: '#251c40', accentText: '#5b3fb0', accentSoft: '#eee7fd', tapes: ['#d9ccfa', '#c9e2ff', '#ffd6e5', '#d6f2e4'], mascot: '#b39cf0' },
    dark: { bg: '#18152a', dot: '#262140', paper: '#201c35', wash: '#2a2541', wash2: '#362f52', ink: '#f1edff', ink2: '#c3bbe0', ink3: '#948cb0', line: '#383054', accent: '#c4b2f7', accentStrong: '#a68ff0', onAccent: '#1e163a', accentText: '#cdbcff', accentSoft: '#342a5c', tapes: ['#5b4a92', '#2f5585', '#7a3f5d', '#2f6652'], mascot: '#b39cf0' },
  },
  {
    id: 'peach', name: '蜜桃烏龍', emoji: '🍑', cover: 'gingham', tint: '#ffab8a',
    light: { bg: '#fff6f1', dot: '#f6d8ca', paper: '#ffffff', wash: '#ffeee6', wash2: '#fbdfd2', ink: '#45302a', ink2: '#6e534a', ink3: '#80675e', line: '#f4d6c8', accent: '#ffb08f', accentStrong: '#f08a63', onAccent: '#3f2219', accentText: '#a74b27', accentSoft: '#ffe6da', tapes: ['#ffcdb8', '#ffe9a6', '#cdebd9', '#e4d6f7'], mascot: '#ffab8a' },
    dark: { bg: '#1f1714', dot: '#30231e', paper: '#281e1a', wash: '#332621', wash2: '#40302a', ink: '#fbede7', ink2: '#d5bcb2', ink3: '#a38d83', line: '#42322b', accent: '#ffbb9e', accentStrong: '#f79b75', onAccent: '#321a12', accentText: '#ffc0a6', accentSoft: '#4a2c22', tapes: ['#7f4a36', '#7a6530', '#2f6450', '#5a4a80'], mascot: '#ffab8a' },
  },
  {
    id: 'mintchoco', name: '薄荷巧克力', emoji: '🍫', cover: 'dots', tint: '#7ddac3',
    light: { bg: '#f2fbf8', dot: '#cfece3', paper: '#ffffff', wash: '#e7f7f1', wash2: '#d4eee5', ink: '#3b2c27', ink2: '#69564f', ink3: '#796a64', line: '#cfe9e0', accent: '#7ddac3', accentStrong: '#4dbfa4', onAccent: '#2b1f1b', accentText: '#1b7861', accentSoft: '#dbf5ee', tapes: ['#b5ecdc', '#d9c3b5', '#ffe3a8', '#c9e2ff'], mascot: '#79d9c2' },
    dark: { bg: '#14201c', dot: '#1f302a', paper: '#1b2823', wash: '#22332d', wash2: '#2c4039', ink: '#eef8f4', ink2: '#b9cec6', ink3: '#8a9e97', line: '#2d413a', accent: '#8ae2cc', accentStrong: '#5ccfb3', onAccent: '#13241f', accentText: '#93e8d2', accentSoft: '#1f4238', tapes: ['#2f6b5a', '#5e4638', '#7a6530', '#2f5585'], mascot: '#79d9c2' },
  },
  {
    id: 'night', name: '星空', emoji: '🌙', cover: 'stars', tint: '#9aa5ff',
    light: { bg: '#f3f3fd', dot: '#dcdcf5', paper: '#ffffff', wash: '#ededfb', wash2: '#dedef6', ink: '#262a4a', ink2: '#505478', ink3: '#656887', line: '#dcddf3', accent: '#9aa5ff', accentStrong: '#7480f0', onAccent: '#1a1d3d', accentText: '#3f49b8', accentSoft: '#e6e8ff', tapes: ['#cdd2ff', '#fff0b0', '#d8c9f7', '#c6eadf'], mascot: '#9aa5ff' },
    dark: { bg: '#11142b', dot: '#1d2142', paper: '#181c38', wash: '#20254a', wash2: '#2a3058', ink: '#eef0ff', ink2: '#b9bde6', ink3: '#8a8eb5', line: '#2c3260', accent: '#ffd86b', accentStrong: '#f2c13f', onAccent: '#241c05', accentText: '#ffdd80', accentSoft: '#3a3520', tapes: ['#3b4594', '#7a6a2a', '#5b4a92', '#2d6355'], mascot: '#ffd86b' },
  },
  {
    id: 'mono', name: '黑白簡約', emoji: '🖤', cover: 'dots', tint: '#c9c9c9',
    light: { bg: '#f8f8f8', dot: '#e1e1e1', paper: '#ffffff', wash: '#f1f1f1', wash2: '#e5e5e5', ink: '#1f1f1f', ink2: '#585858', ink3: '#6b6b6b', line: '#e0e0e0', accent: '#2b2b2b', accentStrong: '#000000', onAccent: '#ffffff', accentText: '#1f1f1f', accentSoft: '#ebebeb', tapes: ['#e3e3e3', '#d6d6d6', '#ececec', '#dcdcdc'], mascot: '#4a4a4a' },
    dark: { bg: '#141414', dot: '#232323', paper: '#1c1c1c', wash: '#252525', wash2: '#303030', ink: '#f2f2f2', ink2: '#bdbdbd', ink3: '#8d8d8d', line: '#333333', accent: '#f2f2f2', accentStrong: '#ffffff', onAccent: '#111111', accentText: '#f2f2f2', accentSoft: '#333333', tapes: ['#444444', '#3a3a3a', '#4d4d4d', '#404040'], mascot: '#bdbdbd' },
  },
];

export const THEME_IDS = THEMES.map((t) => t.id);
export const getTheme = (id) => THEMES.find((t) => t.id === id) || THEMES[0];

const LOOK_KEY = 'planner.v3.look'; // 記住上次的配色，下次打開時不會先閃一下預設顏色
const MODE_KEY = 'planner.v1.theme';
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const TINTABLE = new Set(['gingham', 'sprinkles', 'dots']); // 這幾種封面會跟著主題換顏色

export function isDarkMode(mode) {
  return mode === 'dark' || (mode === 'auto' && darkQuery.matches);
}

export function themeVars(paletteId, mode) {
  const theme = getTheme(paletteId);
  const t = isDarkMode(mode) ? theme.dark : theme.light;
  return {
    '--bg': t.bg,
    '--dot': t.dot,
    '--paper': t.paper,
    '--wash': t.wash,
    '--wash-2': t.wash2,
    '--ink': t.ink,
    '--ink-2': t.ink2,
    '--ink-3': t.ink3,
    '--line': t.line,
    '--accent': t.accent,
    '--accent-strong': t.accentStrong,
    '--on-accent': t.onAccent,
    '--accent-text': t.accentText,
    '--accent-soft': t.accentSoft,
    '--focus': t.accentStrong,
    '--tape-1': t.tapes[0],
    '--tape-2': t.tapes[1],
    '--tape-3': t.tapes[2],
    '--tape-4': t.tapes[3],
    '--mascot-top': t.mascot,
  };
}

// 寫成 style="--bg:…" 的字串，給主題預覽卡片用
export function varsStyle(paletteId, mode) {
  return Object.entries(themeVars(paletteId, mode)).map(([k, v]) => `${k}:${v}`).join(';');
}

export const tintFor = (style, paletteId) => (TINTABLE.has(style) ? getTheme(paletteId).tint : '');

export function cachedPalette() {
  try {
    return getTheme(JSON.parse(localStorage.getItem(LOOK_KEY) || 'null')?.palette).id;
  } catch {
    return THEMES[0].id;
  }
}

export const savedMode = () => {
  try {
    return localStorage.getItem(MODE_KEY) || 'auto';
  } catch {
    return 'auto';
  }
};

// 套用配色主題和深淺模式
let applied = '';
export function applyAppearance(paletteId, mode) {
  const theme = getTheme(paletteId);
  const dark = isDarkMode(mode);
  const key = `${theme.id}|${mode}|${dark}`;
  if (key === applied) return;
  applied = key;
  const root = document.documentElement;
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.palette = theme.id;
  const vars = themeVars(theme.id, mode);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', vars['--bg']);
  try {
    localStorage.setItem(LOOK_KEY, JSON.stringify({ palette: theme.id, light: themeVars(theme.id, 'light'), dark: themeVars(theme.id, 'dark') }));
    localStorage.setItem(MODE_KEY, mode);
  } catch { /* 無痕模式可能不能存 */ }
}

export function onSystemThemeChange(fn) {
  darkQuery.addEventListener('change', () => {
    applied = '';
    fn();
  });
}
