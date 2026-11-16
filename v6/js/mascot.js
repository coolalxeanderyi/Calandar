// 吉祥物「小日曆」：一張有表情的日曆紙。原創角色，用 SVG 畫成。
// mood：smile（平常）、happy（都完成了）、sleepy（深夜）、wave（打招呼）
// 頭頂的顏色會跟著配色主題變（CSS 變數 --mascot-top）

const INK = '#3D2A36';
const PINK = '#FF8FB1';
const BLUSH = '#FF9EB8';

function eyes(mood) {
  if (mood === 'happy') {
    return `<path d="M33 57q5-6 10 0M57 57q5-6 10 0" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`;
  }
  if (mood === 'sleepy') {
    return `<path d="M33 58q5 3.5 10 0M57 58q5 3.5 10 0" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`;
  }
  return `<ellipse cx="38" cy="57" rx="4.2" ry="5.2" fill="${INK}"/><ellipse cx="62" cy="57" rx="4.2" ry="5.2" fill="${INK}"/>
    <circle cx="39.6" cy="55" r="1.5" fill="#fff"/><circle cx="63.6" cy="55" r="1.5" fill="#fff"/>`;
}

function mouth(mood) {
  if (mood === 'happy') {
    return `<path d="M43 65q7 9 14 0z" fill="${INK}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M46.5 68.3q3.5 3 7 0" fill="${PINK}"/>`;
  }
  if (mood === 'sleepy') return `<ellipse cx="50" cy="67" rx="3" ry="2.4" fill="${INK}"/>`;
  return `<path d="M44.5 65q5.5 5.5 11 0" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
}

function arms(mood) {
  const stroke = `class="mascot-arm" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"`;
  if (mood === 'happy') return `<path d="M15 60q-9-4-10-14M85 60q9-4 10-14" ${stroke}/>`;
  if (mood === 'wave') return `<path d="M15 64q-8 2-11 8M85 60q9-4 11-14" ${stroke}/>`;
  return `<path d="M15 64q-8 2-11 8M85 64q8 2 11 8" ${stroke}/>`;
}

function extras(mood) {
  if (mood === 'happy') {
    const star = (x, y, s, c) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0-6C1-1 1-1 6 0 1 1 1 1 0 6-1 1-1 1-6 0-1-1-1-1 0-6z" fill="${c}"/>`;
    return star(8, 22, 1.1, '#FFD670') + star(92, 26, 0.9, '#7ED7C1') + star(90, 86, 0.7, PINK);
  }
  if (mood === 'sleepy') {
    return `<text x="80" y="20" font-size="13" font-weight="700" fill="#A88BE0" font-family="Arial, sans-serif">z</text><text x="89" y="11" font-size="9" font-weight="700" fill="#A88BE0" font-family="Arial, sans-serif">z</text>`;
  }
  return '';
}

export function mascot(mood = 'smile', { size = 64, label = '小日曆' } = {}) {
  return `<svg class="mascot mascot-${mood}" width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="${label}">
    ${arms(mood)}
    <rect x="15" y="22" width="70" height="66" rx="18" fill="#fff" stroke="${INK}" stroke-width="3.2"/>
    <path class="mascot-top" d="M16.6 38V39h66.8v-1c0-8.8-7.2-14.4-16-14.4H32.6c-8.8 0-16 5.6-16 14.4z" fill="${PINK}"/>
    <path d="M15 38.5h70" stroke="${INK}" stroke-width="3.2"/>
    <rect x="31" y="12" width="7" height="18" rx="3.5" fill="#fff" stroke="${INK}" stroke-width="3"/>
    <rect x="62" y="12" width="7" height="18" rx="3.5" fill="#fff" stroke="${INK}" stroke-width="3"/>
    <ellipse cx="28.5" cy="66" rx="6.2" ry="3.6" fill="${BLUSH}" opacity=".75"/>
    <ellipse cx="71.5" cy="66" rx="6.2" ry="3.6" fill="${BLUSH}" opacity=".75"/>
    ${eyes(mood)}${mouth(mood)}${extras(mood)}
  </svg>`;
}
