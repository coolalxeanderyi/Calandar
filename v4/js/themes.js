// 配色主題：每一套都有淺色和深色兩種版本。想新增主題，照著格式在 THEMES 裡加一筆，再放進 THEME_GROUPS 的某個分類就好。
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
  {
    id: 'watermelon', name: '西瓜冰', emoji: '🍉', cover: 'watermelon', tint: '#ff7b8a',
    light: { bg: '#fff6f5', dot: '#f6d6d6', paper: '#ffffff', wash: '#fff0ef', wash2: '#fbdedd', ink: '#3b2a2c', ink2: '#6e5254', ink3: '#836769', line: '#f3d2d2', accent: '#ff7b8a', accentStrong: '#f0566a', onAccent: '#3a1418', accentText: '#be2d42', accentSoft: '#ffe2e5', tapes: ['#ffc2c9', '#bfe6b0', '#ffe9a6', '#cfe3ff'], mascot: '#ff7b8a' },
    dark: { bg: '#1e1517', dot: '#2e2124', paper: '#271c1e', wash: '#322427', wash2: '#3f2e31', ink: '#fbecee', ink2: '#d3b7bb', ink3: '#a48a8e', line: '#42302f', accent: '#ff8d9a', accentStrong: '#ff6b7d', onAccent: '#2c1014', accentText: '#ff9eaa', accentSoft: '#4a2329', tapes: ['#8a3f4a', '#3f6b3a', '#7a6530', '#3a5579'], mascot: '#ff7b8a' },
  },
  {
    id: 'orange', name: '橘子汽水', emoji: '🍊', cover: 'oranges', tint: '#ffa64d',
    light: { bg: '#fff8f0', dot: '#f7dfc4', paper: '#ffffff', wash: '#fff2e3', wash2: '#fbe3c8', ink: '#3d2f22', ink2: '#6c5642', ink3: '#7f6956', line: '#f3dcc0', accent: '#ffa64d', accentStrong: '#f2862a', onAccent: '#3a2208', accentText: '#a25109', accentSoft: '#ffe8cf', tapes: ['#ffd09e', '#c6ecf5', '#fff0a8', '#d9f0c6'], mascot: '#ffa64d' },
    dark: { bg: '#1e1812', dot: '#2f251b', paper: '#272018', wash: '#322920', wash2: '#3f3428', ink: '#fbf0e4', ink2: '#d6c1aa', ink3: '#a5917e', line: '#433629', accent: '#ffb466', accentStrong: '#ff9a3d', onAccent: '#2e1a06', accentText: '#ffbd7a', accentSoft: '#4a3018', tapes: ['#8a5a26', '#2f6377', '#7a6a2a', '#3f6b3a'], mascot: '#ffa64d' },
  },
  {
    id: 'cocoa', name: '熱可可', emoji: '☕', cover: 'cocoa', tint: '#9a6a4c',
    light: { bg: '#faf5f0', dot: '#e8dacd', paper: '#ffffff', wash: '#f5ece3', wash2: '#ebdccd', ink: '#3a2a22', ink2: '#685247', ink3: '#7c665b', line: '#e6d5c5', accent: '#9a6a4c', accentStrong: '#7d5136', onAccent: '#ffffff', accentText: '#7a4a2c', accentSoft: '#f1e2d6', tapes: ['#e7cdb9', '#f6d9e4', '#cfe2f2', '#d9ead0'], mascot: '#b07f60' },
    dark: { bg: '#1b1512', dot: '#2b221d', paper: '#241c18', wash: '#2f2520', wash2: '#3b2f29', ink: '#f7ece4', ink2: '#d2bdb0', ink3: '#a18c80', line: '#3e322b', accent: '#d6a989', accentStrong: '#c48d68', onAccent: '#2a1a10', accentText: '#e0b597', accentSoft: '#43302a', tapes: ['#6e4a36', '#7a4c5c', '#34557a', '#3f5e3a'], mascot: '#c08d6c' },
  },
  {
    id: 'xmas', name: '聖誕節', emoji: '🎄', cover: 'xmas', tint: '#cf3c43',
    light: { bg: '#fbf7f2', dot: '#ead9cf', paper: '#ffffff', wash: '#f6efe7', wash2: '#ece0d3', ink: '#2f2a26', ink2: '#5f564f', ink3: '#726962', line: '#e8dccf', accent: '#cf3c43', accentStrong: '#b02f37', onAccent: '#ffffff', accentText: '#b02a35', accentSoft: '#fbe1df', tapes: ['#f5b8b5', '#b9dfc0', '#f7e3a1', '#d6e6f5'], mascot: '#cf3c43' },
    dark: { bg: '#121a16', dot: '#1d2a23', paper: '#18231d', wash: '#203028', wash2: '#2a3c33', ink: '#f2f7f1', ink2: '#bfd0c4', ink3: '#879b90', line: '#2c3f35', accent: '#ff6f6f', accentStrong: '#f2545a', onAccent: '#2a0c0e', accentText: '#ff8c8c', accentSoft: '#4a2226', tapes: ['#8a3a3e', '#2f6b48', '#826c2d', '#3d5d7d'], mascot: '#ff6f6f' },
  },
  {
    id: 'mushroom', name: '蘑菇森林', emoji: '🍄', cover: 'mushrooms', tint: '#5fa36a',
    light: { bg: '#f6f8f1', dot: '#dce6d0', paper: '#ffffff', wash: '#eef3e6', wash2: '#e0e9d4', ink: '#27332a', ink2: '#4f5c53', ink3: '#627066', line: '#d8e3cc', accent: '#5fa36a', accentStrong: '#478a53', onAccent: '#10200f', accentText: '#2f6e3b', accentSoft: '#e1f0dc', tapes: ['#f4b9a8', '#c8e3bf', '#f2e2b6', '#d9cfe8'], mascot: '#e0635a' },
    dark: { bg: '#131a15', dot: '#1f2a21', paper: '#19221b', wash: '#212d23', wash2: '#2b392e', ink: '#eef5ee', ink2: '#b8c9bb', ink3: '#869789', line: '#2d3c30', accent: '#7cc386', accentStrong: '#5fb06c', onAccent: '#10200f', accentText: '#8fd199', accentSoft: '#223d27', tapes: ['#8a4436', '#3d6a40', '#7a6a35', '#57497a'], mascot: '#ef7d68' },
  },
  {
    id: 'hibiscus', name: '扶桑花', emoji: '🌺', cover: 'hibiscus', tint: '#cc3a76',
    light: { bg: '#fff5f8', dot: '#f6d3e1', paper: '#ffffff', wash: '#ffeef4', wash2: '#fbdbe7', ink: '#3b2531', ink2: '#6d4e5e', ink3: '#836373', line: '#f2cfdd', accent: '#cc3a76', accentStrong: '#b02c63', onAccent: '#ffffff', accentText: '#b72a6c', accentSoft: '#fde0ec', tapes: ['#f9b9d4', '#bfe8c9', '#ffe0a3', '#c9e6f2'], mascot: '#e9579a' },
    dark: { bg: '#1d1319', dot: '#2e1f28', paper: '#261a21', wash: '#31222b', wash2: '#3e2c37', ink: '#fcebf3', ink2: '#d6b6c6', ink3: '#a48795', line: '#432f3a', accent: '#ff7bb5', accentStrong: '#ff5ea3', onAccent: '#2e0a1b', accentText: '#ff8fc1', accentSoft: '#4d2338', tapes: ['#8c3a5f', '#2f6a49', '#7a6330', '#2f5f78'], mascot: '#ff7bb5' },
  },
  {
    id: 'cottoncandy', name: '棉花糖', emoji: '🍭', cover: 'cottoncandy', tint: '#d9a0ec',
    light: { bg: '#fbf7ff', dot: '#eadff5', paper: '#ffffff', wash: '#f7f0fd', wash2: '#ece2f8', ink: '#33283d', ink2: '#61556d', ink3: '#746881', line: '#e7dcf2', accent: '#d9a0ec', accentStrong: '#c17ad9', onAccent: '#33153d', accentText: '#8e3fae', accentSoft: '#f6e6fc', tapes: ['#ffc9e3', '#c9e2ff', '#e8d2fa', '#fff1b8'], mascot: '#9cc8ff' },
    dark: { bg: '#1a1520', dot: '#2a2233', paper: '#221b2a', wash: '#2c2436', wash2: '#382e44', ink: '#f6eefc', ink2: '#cdbfdc', ink3: '#978ba7', line: '#3b3048', accent: '#e3b3f5', accentStrong: '#d595f0', onAccent: '#2c1236', accentText: '#ebbffa', accentSoft: '#43294f', tapes: ['#7a3f62', '#2f5585', '#5e4380', '#7a6a2e'], mascot: '#9cc8ff' },
  },
  {
    id: 'waffle', name: '蜂蜜鬆餅', emoji: '🧇', cover: 'waffle', tint: '#eea83a',
    light: { bg: '#fffaf0', dot: '#f2e2c2', paper: '#ffffff', wash: '#fff4df', wash2: '#f8e8c8', ink: '#3b2f1e', ink2: '#6a583f', ink3: '#7e6b52', line: '#f0dfbd', accent: '#eea83a', accentStrong: '#d98f1f', onAccent: '#3a2606', accentText: '#945e00', accentSoft: '#fdeccb', tapes: ['#f9d692', '#f6d1c4', '#d4e9f7', '#e3efc8'], mascot: '#eea83a' },
    dark: { bg: '#1c1710', dot: '#2c2418', paper: '#251f15', wash: '#30281c', wash2: '#3c3326', ink: '#faf1e1', ink2: '#d5c4a6', ink3: '#a18f73', line: '#403526', accent: '#f6c25a', accentStrong: '#efab31', onAccent: '#2e1f04', accentText: '#f9cd70', accentSoft: '#4a3816', tapes: ['#7f5f22', '#7a4436', '#2f5878', '#4a6233'], mascot: '#eea83a' },
  },
  {
    id: 'rainbow', name: '彩虹', emoji: '🌈', cover: 'rainbow', tint: '#6f5fe6',
    light: { bg: '#fffaf7', dot: '#efe1dc', paper: '#ffffff', wash: '#fdf3ef', wash2: '#f6e6e0', ink: '#33292b', ink2: '#62575a', ink3: '#786c6f', line: '#efdfd9', accent: '#6f5fe6', accentStrong: '#5747cf', onAccent: '#ffffff', accentText: '#5040c4', accentSoft: '#ebe8ff', tapes: ['#ffb3ab', '#ffe08f', '#b8e6b0', '#b3d4ff'], mascot: '#ff7a72' },
    dark: { bg: '#17151f', dot: '#25222f', paper: '#1f1c28', wash: '#282433', wash2: '#332e40', ink: '#f3f0fa', ink2: '#c5bfd6', ink3: '#938ca2', line: '#363046', accent: '#a397ff', accentStrong: '#8a7cff', onAccent: '#16103a', accentText: '#b0a6ff', accentSoft: '#332b5c', tapes: ['#8a3b38', '#7f6526', '#3b6b38', '#33557f'], mascot: '#ff7a72' },
  },
  {
    id: 'morandi', name: '莫蘭迪', emoji: '🎨', cover: 'arches', tint: '#66788d',
    light: { bg: '#f6f4f1', dot: '#e2ddd7', paper: '#ffffff', wash: '#f0ede9', wash2: '#e5e0da', ink: '#35322f', ink2: '#5b5651', ink3: '#6d6864', line: '#e2ddd6', accent: '#66788d', accentStrong: '#55667a', onAccent: '#ffffff', accentText: '#4f6277', accentSoft: '#e6ebf0', tapes: ['#d9c2bd', '#c5cfbe', '#c8ced8', '#e3d6c3'], mascot: '#c9a9a3' },
    dark: { bg: '#1a1b1d', dot: '#28292c', paper: '#222326', wash: '#2b2c30', wash2: '#36373c', ink: '#efedea', ink2: '#c4c0bb', ink3: '#989490', line: '#38393e', accent: '#a9b7c7', accentStrong: '#93a3b6', onAccent: '#1a222c', accentText: '#b9c6d4', accentSoft: '#323a45', tapes: ['#6b5652', '#4f5c4b', '#4e5666', '#665c4c'], mascot: '#c9a9a3' },
  },
];

// 換主題視窗裡的分類（每個主題都要剛好出現在一個分類裡）
export const THEME_GROUPS = [
  { name: '飲料', ids: ['strawberry', 'matcha', 'milktea', 'soda', 'lemon', 'peach', 'orange', 'cocoa'] },
  { name: '甜點和水果', ids: ['blueberry', 'mintchoco', 'watermelon', 'waffle', 'cottoncandy'] },
  { name: '季節和自然', ids: ['night', 'mushroom', 'hibiscus', 'xmas', 'rainbow'] },
  { name: '簡約', ids: ['mono', 'morandi'] },
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
