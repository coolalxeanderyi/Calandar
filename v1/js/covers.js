// 封面：用程式畫出來的「空拍」風景（農田、海灘、梯田、沙丘）。
// 同一個 seed 一定畫出同一張圖，換 seed 就是換一個版本。

export const COVER_STYLES = [
  { id: 'fields', name: '農田' },
  { id: 'coast', name: '海灘' },
  { id: 'terraces', name: '梯田' },
  { id: 'dunes', name: '沙丘' },
];


function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n) => Math.round(n * 10) / 10;
const pick = (r, list) => list[Math.floor(r() * list.length)];
const between = (r, a, b) => a + r() * (b - a);

// 用 Catmull-Rom 把點串成平滑曲線
function smooth(pts, start = 'M') {
  let d = `${start}${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
}

function band(top, bottom) {
  return `${smooth(top)} ${smooth([...bottom].reverse(), 'L')} Z`;
}

function polygon(points) {
  return points.map((p) => `${f(p[0])},${f(p[1])}`).join(' ');
}

// ---------- 農田 ----------
function fields(r, id, W, H) {
  const angle = between(r, -16, 16);
  const cols = 8 + Math.floor(r() * 3);
  const rows = Math.max(4, Math.round((H + 360) / 165));
  const x0 = -260;
  const y0 = -180;
  const cw = (W + 520) / cols;
  const rh = (H + 360) / rows;

  const V = [];
  for (let j = 0; j <= rows; j++) {
    V[j] = [];
    for (let i = 0; i <= cols; i++) {
      V[j][i] = [
        x0 + i * cw + (i > 0 && i < cols ? (r() - 0.5) * cw * 0.5 : 0),
        y0 + j * rh + (j > 0 && j < rows ? (r() - 0.5) * rh * 0.45 : 0),
      ];
    }
  }

  const crops = ['#6E9B4F', '#88AE5C', '#A3BE68', '#5C8442', '#D6C178', '#E1CD8B', '#C9AA61', '#9C7A55', '#B38E63', '#7C9A52'];
  const hedgeDark = r() < 0.5;
  const hedge = hedgeDark ? '#46653A' : '#E9E1C6';
  const stripeAngles = [0, 35, 90, 135];

  let defs = stripeAngles
    .map((a, k) => `<pattern id="${id}-s${k}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(${a + angle})"><rect width="7" height="2.4" fill="#1d2a12" fill-opacity=".13"/></pattern>`)
    .join('');
  defs += `<pattern id="${id}-o" width="15" height="15" patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})"><circle cx="7.5" cy="7.5" r="3.6" fill="#3B622F" fill-opacity=".7"/></pattern>`;

  let shapes = '';
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const pts = [V[j][i], V[j][i + 1], V[j + 1][i + 1], V[j + 1][i]];
      const fill = pick(r, crops);
      shapes += `<polygon points="${polygon(pts)}" fill="${fill}"/>`;
      const kind = r();
      if (kind < 0.62) shapes += `<polygon points="${polygon(pts)}" fill="url(#${id}-s${Math.floor(r() * stripeAngles.length)})"/>`;
      else if (kind < 0.74) shapes += `<polygon points="${polygon(pts)}" fill="url(#${id}-o)"/>`;
      shapes += `<polygon points="${polygon(pts)}" fill="none" stroke="${hedge}" stroke-width="${hedgeDark ? 3.4 : 2.6}" stroke-linejoin="round"/>`;
    }
  }

  // 河流
  const riverY = between(r, 40, 260);
  const river = [];
  for (let x = -320; x <= W + 320; x += 160) river.push([x, riverY + (r() - 0.5) * 130]);
  const riverPath = smooth(river);
  let trees = '';
  for (let k = 1; k < river.length - 1; k++) {
    const [rx, ry] = river[k];
    const n = 3 + Math.floor(r() * 5);
    for (let t = 0; t < n; t++) {
      const tx = rx + (r() - 0.5) * 120;
      const ty = ry + (r() < 0.5 ? -1 : 1) * between(r, 22, 42);
      const tr = between(r, 6, 11);
      trees += `<circle cx="${f(tx + 3)}" cy="${f(ty + 3)}" r="${f(tr)}" fill="#1f3318" fill-opacity=".28"/><circle cx="${f(tx)}" cy="${f(ty)}" r="${f(tr)}" fill="${pick(r, ['#3F6A33', '#4C7A3B', '#365C2C'])}"/>`;
    }
  }

  // 沿著某條田埂的道路
  const roadRow = 1 + Math.floor(r() * (rows - 1));
  const road = smooth(V[roadRow]);

  const body = `
    <rect x="-400" y="-400" width="${W + 800}" height="${H + 800}" fill="#7E9F57"/>
    ${shapes}
    <path d="${road}" fill="none" stroke="#8D908A" stroke-width="10" stroke-linecap="round"/>
    <path d="${road}" fill="none" stroke="#F4F1E6" stroke-width="1.6" stroke-dasharray="12 12"/>
    <path d="${riverPath}" fill="none" stroke="#B7C68C" stroke-width="44" stroke-linecap="round"/>
    <path d="${riverPath}" fill="none" stroke="#5F9DB5" stroke-width="28" stroke-linecap="round"/>
    <path d="${riverPath}" fill="none" stroke="#8FC3D4" stroke-width="9" stroke-linecap="round" stroke-opacity=".7"/>
    ${trees}`;
  return { defs, body: `<g transform="rotate(${f(angle)} ${W / 2} ${H / 2})">${body}</g>`, label: '農田空拍' };
}

// ---------- 海灘 ----------
function coast(r, id, W, H) {
  const base = H > 400 ? H * between(r, 0.3, 0.4) : between(r, 120, 165);
  const amp = between(r, 10, 30);
  const freq = between(r, 0.004, 0.009);
  const phase = r() * Math.PI * 2;
  const shore = [];
  for (let x = -100; x <= W + 100; x += 100) {
    shore.push([x, base + Math.sin(x * freq + phase) * amp + (r() - 0.5) * 14]);
  }
  const shift = (pts, dy, jitter = 0) => pts.map(([x, y]) => [x, y + dy + (r() - 0.5) * jitter]);
  const top = shore.map(([x]) => [x, -20]);

  const defs = `
    <linearGradient id="${id}-sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0F5670"/><stop offset=".55" stop-color="#227F98"/>
      <stop offset=".85" stop-color="#3DAAB5"/><stop offset="1" stop-color="#7FCFC6"/>
    </linearGradient>`;

  let foam = '';
  for (let k = 1; k <= 4; k++) {
    const line = smooth(shift(shore, -k * 11 - r() * 4, 6));
    const dash = `${f(between(r, 30, 90))} ${f(between(r, 6, 18))} ${f(between(r, 10, 40))} ${f(between(r, 4, 12))}`;
    foam += `<path d="${line}" fill="none" stroke="#fff" stroke-width="${f(4.2 - k * 0.7)}" stroke-opacity="${f(0.9 - k * 0.17)}" stroke-dasharray="${dash}" stroke-linecap="round"/>`;
  }

  let grains = '';
  for (let k = 0; k < Math.round((260 * W * (H - base)) / (1200 * 150)); k++) {
    grains += `<circle cx="${f(r() * W)}" cy="${f(base + 20 + r() * (H - base))}" r="${f(between(r, 0.6, 1.6))}" fill="#C9AE7B" fill-opacity=".45"/>`;
  }

  // 遮陽傘
  const pairs = [['#E4572E', '#FFF7EC'], ['#2E86AB', '#FFF7EC'], ['#F2C14E', '#E4572E'], ['#3BB273', '#FFF7EC'], ['#7B5EA7', '#F2C14E'], ['#EF8A9F', '#FFF7EC']];
  let umbrellas = '';
  const rowsY = [];
  for (let y = base + between(r, 62, 80); y < H - 10; y += between(r, 44, 56)) rowsY.push(y);
  for (const rowY of rowsY) {
    let x = between(r, 20, 90);
    while (x < W - 20) {
      if (r() < 0.78) {
        const cx = x;
        const cy = rowY + (r() - 0.5) * 14;
        const R = between(r, 11, 15);
        const [a, b] = pick(r, pairs);
        if (r() < 0.6) {
          const tw = between(r, 10, 14);
          umbrellas += `<rect x="${f(cx + R + 2)}" y="${f(cy - 4)}" width="${f(tw)}" height="${f(tw * 1.8)}" rx="2" fill="${pick(r, ['#F25F5C', '#FFE066', '#247BA0', '#70C1B3', '#FFFFFF'])}" transform="rotate(${f(between(r, -25, 25))} ${f(cx + R + 2)} ${f(cy)})"/>`;
        }
        umbrellas += `<ellipse cx="${f(cx + 6)}" cy="${f(cy + 5)}" rx="${f(R)}" ry="${f(R * 0.92)}" fill="#5b4321" fill-opacity=".22"/>`;
        for (let k = 0; k < 8; k++) {
          const a0 = (k * Math.PI) / 4;
          const a1 = ((k + 1) * Math.PI) / 4;
          umbrellas += `<path d="M${f(cx)},${f(cy)} L${f(cx + R * Math.cos(a0))},${f(cy + R * Math.sin(a0))} A${f(R)},${f(R)} 0 0 1 ${f(cx + R * Math.cos(a1))},${f(cy + R * Math.sin(a1))} Z" fill="${k % 2 ? a : b}"/>`;
        }
        umbrellas += `<circle cx="${f(cx)}" cy="${f(cy)}" r="1.6" fill="#3a2a15"/>`;
      }
      x += between(r, 38, 70);
    }
  }

  const body = `
    <rect x="-20" y="-20" width="${W + 40}" height="${H + 40}" fill="#EAD7AC"/>
    ${grains}
    <path d="${band(shift(shore, -6), shift(shore, 22))}" fill="#D7BF8C" fill-opacity=".85"/>
    <path d="${band(top, shore)}" fill="url(#${id}-sea)"/>
    <path d="${band(shift(shore, -34), shore)}" fill="#9BE0D3" fill-opacity=".42"/>
    ${foam}
    ${umbrellas}`;
  return { defs, body, label: '海灘空拍' };
}

// ---------- 梯田 ----------
function terraces(r, id, W, H) {
  const n = Math.round(((H + 120) / 420) * (13 + Math.floor(r() * 4)));
  const freq = between(r, 0.006, 0.011);
  const freq2 = between(r, 0.013, 0.02);
  const phase = r() * Math.PI * 2;
  const phase2 = r() * Math.PI * 2;
  const amp = between(r, 35, 70);
  const xs = [];
  for (let x = -60; x <= W + 60; x += 60) xs.push(x);

  const curves = [];
  for (let k = 0; k <= n; k++) {
    const baseY = -60 + (k * (H + 120)) / n;
    const local = between(r, 0.6, 1.25);
    curves.push(
      xs.map((x, i) => {
        let y = baseY + Math.sin(x * freq + phase + k * 0.08) * amp * local + Math.sin(x * freq2 + phase2) * 10;
        if (k > 0) y = Math.max(y, curves[k - 1][i][1] + 9);
        return [x, y];
      }),
    );
  }

  const greens = ['#6F9A4E', '#7EA858', '#8DB363', '#5E8A45', '#9BBE6E', '#76A152'];
  const defs = `
    <linearGradient id="${id}-w" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#A6C6CC"/><stop offset=".5" stop-color="#CFE2E3"/><stop offset="1" stop-color="#9DBFC6"/>
    </linearGradient>
    <pattern id="${id}-rows" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.1" fill="#2f4a22" fill-opacity=".22"/></pattern>`;

  let shapes = '';
  for (let k = 0; k < n; k++) {
    const flooded = r() < 0.24;
    const d = band(curves[k], curves[k + 1]);
    shapes += `<path d="${d}" fill="${flooded ? `url(#${id}-w)` : pick(r, greens)}"/>`;
    if (!flooded) shapes += `<path d="${d}" fill="url(#${id}-rows)"/>`;
  }
  let walls = '';
  for (let k = 1; k < n; k++) {
    const line = smooth(curves[k]);
    walls += `<path d="${line}" fill="none" stroke="#3B5A31" stroke-width="2.6"/>`;
    walls += `<path d="${smooth(curves[k].map(([x, y]) => [x, y + 2.6]))}" fill="none" stroke="#C3DA97" stroke-width="1.2" stroke-opacity=".7"/>`;
  }

  // 小路與樹叢
  const pathPts = [];
  const startX = between(r, 150, W - 150);
  for (let y = -20; y <= H + 20; y += 40) pathPts.push([startX + Math.sin(y * 0.03 + phase) * 60 + (y / H) * between(r, -120, 120), y]);
  let trees = '';
  const clusterX = r() < 0.5 ? between(r, 0, 220) : between(r, W - 220, W);
  for (let t = 0; t < 26; t++) {
    const tx = clusterX + (r() - 0.5) * 220;
    const ty = r() * H;
    const tr = between(r, 7, 13);
    trees += `<circle cx="${f(tx + 3)}" cy="${f(ty + 3)}" r="${f(tr)}" fill="#1c2e16" fill-opacity=".3"/><circle cx="${f(tx)}" cy="${f(ty)}" r="${f(tr)}" fill="${pick(r, ['#355E2B', '#41703A', '#2E5226'])}"/>`;
  }

  const body = `
    <rect x="-20" y="-20" width="${W + 40}" height="${H + 40}" fill="#5E8A45"/>
    ${shapes}${walls}
    <path d="${smooth(pathPts)}" fill="none" stroke="#E4D8B4" stroke-width="5" stroke-linecap="round"/>
    ${trees}`;
  return { defs, body, label: '梯田空拍' };
}

// ---------- 沙丘 ----------
function dunes(r, id, W, H) {
  const n = Math.round(((H + 100) / 400) * (6 + Math.floor(r() * 3)));
  const xs = [];
  for (let x = -80; x <= W + 80; x += 80) xs.push(x);
  const ridges = [];
  for (let k = 0; k <= n; k++) {
    const baseY = -50 + (k * (H + 100)) / n;
    const amp = between(r, 18, 46);
    const freq = between(r, 0.004, 0.009);
    const ph = r() * Math.PI * 2;
    ridges.push(xs.map((x) => [x, baseY + Math.sin(x * freq + ph) * amp + (r() - 0.5) * 10]));
  }
  const tones = [['#F2CFA0', '#C98A57'], ['#EDC08C', '#BD7A49'], ['#F4D6AE', '#CF9562'], ['#E9B47F', '#B26D3F']];
  let defs = '';
  let shapes = '';
  for (let k = 0; k < n; k++) {
    const [light, dark] = pick(r, tones);
    defs += `<linearGradient id="${id}-g${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${dark}"/><stop offset=".35" stop-color="${light}"/><stop offset="1" stop-color="${light}"/></linearGradient>`;
    shapes += `<path d="${band(ridges[k], ridges[k + 1])}" fill="url(#${id}-g${k})"/>`;
  }
  let ripples = '';
  for (let k = 0; k < 40; k++) {
    const y = r() * H;
    const x = r() * W;
    const len = between(r, 60, 180);
    ripples += `<path d="M${f(x)},${f(y)} q${f(len / 4)},${f(-4)} ${f(len / 2)},0 t${f(len / 2)},0" fill="none" stroke="#7a4a26" stroke-opacity=".08" stroke-width="1.2"/>`;
  }
  let crests = '';
  for (let k = 1; k < n; k++) crests += `<path d="${smooth(ridges[k])}" fill="none" stroke="#FBE7C8" stroke-width="1.6" stroke-opacity=".8"/>`;
  const body = `<rect x="-20" y="-20" width="${W + 40}" height="${H + 40}" fill="#E8B987"/>${shapes}${ripples}${crests}`;
  return { defs, body, label: '沙丘空拍' };
}

const GENERATORS = { fields, coast, terraces, dunes };
const cache = new Map();

export function coverSVG(style = 'fields', seed = 1, prefix = 'cv', { width = 1200, height = 300 } = {}) {
  const key = `${style}:${seed}:${prefix}:${width}x${height}`;
  if (cache.has(key)) return cache.get(key);
  const gen = GENERATORS[style] || fields;
  const id = `${prefix}-${style}-${seed}`.replace(/[^a-z0-9-]/gi, '');
  const { defs, body, label } = gen(makeRng(seed * 7919 + style.length * 104729), id, width, height);
  const svg = `<svg class="cover-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="封面：${label}"><defs>${defs}</defs>${body}</svg>`;
  cache.set(key, svg);
  if (cache.size > 40) cache.delete(cache.keys().next().value);
  return svg;
}

export function randomSeed() {
  return Math.floor(Math.random() * 1e9);
}
