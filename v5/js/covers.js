// 封面：用程式畫出來的圖案。可愛系（雲朵、格紋、糖霜、珍奶、西瓜、熱可可、蘑菇……）和空拍風景（農田、海灘、梯田、沙丘）。
// 同一個 seed 一定畫出同一張圖，換 seed 就是換一個版本。

export const COVER_STYLES = [
  { id: 'clouds', name: '雲朵' },
  { id: 'gingham', name: '野餐格紋' },
  { id: 'sprinkles', name: '糖霜彩針' },
  { id: 'boba', name: '珍珠奶茶' },
  { id: 'dots', name: '波點' },
  { id: 'waves', name: '海浪' },
  { id: 'lemons', name: '檸檬片' },
  { id: 'stars', name: '星空' },
  { id: 'watermelon', name: '西瓜' },
  { id: 'oranges', name: '橘子汽水' },
  { id: 'cocoa', name: '熱可可' },
  { id: 'xmas', name: '聖誕' },
  { id: 'mushrooms', name: '蘑菇' },
  { id: 'hibiscus', name: '扶桑花' },
  { id: 'cottoncandy', name: '棉花糖' },
  { id: 'waffle', name: '鬆餅' },
  { id: 'rainbow', name: '彩虹' },
  { id: 'arches', name: '莫蘭迪色塊' },
  { id: 'sakura', name: '櫻花' },
  { id: 'sunflowers', name: '向日葵' },
  { id: 'autumnleaves', name: '落葉' },
  { id: 'snowday', name: '雪天' },
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

// 把兩個顏色混在一起（t=0 是 a，t=1 是 b）
function mix(a, b, t) {
  const pa = a.replace('#', '').match(/../g).map((h) => parseInt(h, 16));
  const pb = b.replace('#', '').match(/../g).map((h) => parseInt(h, 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}
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


// ---------- 可愛系 ----------

function star4(x, y, s, fill) {
  return `<path transform="translate(${f(x)} ${f(y)}) scale(${f(s)})" d="M0-6C1-1 1-1 6 0 1 1 1 1 0 6-1 1-1 1-6 0-1-1-1-1 0-6z" fill="${fill}"/>`;
}

function heart(x, y, s, fill, rot = 0) {
  return `<path transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${f(s)})" d="M0 5C-7 0-9-4-6-7c2-2 5-1 6 1 1-2 4-3 6-1 3 3 1 7-6 12z" fill="${fill}"/>`;
}

function cloudShape(x, y, w, fill = '#fff') {
  const h = w * 0.42;
  const r1 = h * 0.62;
  const r2 = h * 0.8;
  const r3 = h * 0.55;
  return `<g>
    <ellipse cx="${f(x + w * 0.5)}" cy="${f(y + h * 0.95)}" rx="${f(w * 0.46)}" ry="${f(h * 0.12)}" fill="#B9A6E6" fill-opacity=".18"/>
    <circle cx="${f(x + w * 0.28)}" cy="${f(y + h * 0.55)}" r="${f(r1)}" fill="${fill}"/>
    <circle cx="${f(x + w * 0.52)}" cy="${f(y + h * 0.38)}" r="${f(r2)}" fill="${fill}"/>
    <circle cx="${f(x + w * 0.74)}" cy="${f(y + h * 0.58)}" r="${f(r3)}" fill="${fill}"/>
    <rect x="${f(x + w * 0.1)}" y="${f(y + h * 0.5)}" width="${f(w * 0.8)}" height="${f(h * 0.4)}" rx="${f(h * 0.2)}" fill="${fill}"/>
  </g>`;
}

function clouds(r, id, W, H) {
  const defs = `<linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#BFE3FF"/><stop offset=".55" stop-color="#E8E4FF"/><stop offset="1" stop-color="#FFE2EE"/>
    </linearGradient>`;
  let body = `<rect x="-10" y="-10" width="${W + 20}" height="${H + 20}" fill="url(#${id}-sky)"/>`;

  // 彩虹（一半的機率）
  if (r() < 0.55) {
    const cx = between(r, W * 0.2, W * 0.8);
    const cy = H * between(r, 1.05, 1.3);
    const R = H * between(r, 0.75, 0.95);
    ['#FFB3C7', '#FFD3A8', '#FFF0A8', '#BFEBD7', '#BFDFFF', '#D9CBF5'].forEach((c, i) => {
      body += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R - i * 13)}" fill="none" stroke="${c}" stroke-width="13" stroke-opacity=".85"/>`;
    });
  }

  // 太陽（有臉）
  const sx = r() < 0.5 ? between(r, W * 0.06, W * 0.2) : between(r, W * 0.8, W * 0.94);
  const sy = Math.min(H * 0.32, 95);
  body += `<circle cx="${f(sx)}" cy="${f(sy)}" r="56" fill="#FFF3B0" fill-opacity=".55"/>
    <circle cx="${f(sx)}" cy="${f(sy)}" r="36" fill="#FFE07A"/>
    <circle cx="${f(sx - 11)}" cy="${f(sy - 2)}" r="3.2" fill="#5B4636"/><circle cx="${f(sx + 11)}" cy="${f(sy - 2)}" r="3.2" fill="#5B4636"/>
    <path d="M${f(sx - 6)},${f(sy + 7)} q6 6 12 0" fill="none" stroke="#5B4636" stroke-width="2.6" stroke-linecap="round"/>
    <ellipse cx="${f(sx - 19)}" cy="${f(sy + 7)}" rx="5" ry="3" fill="#FF9EB8" fill-opacity=".7"/><ellipse cx="${f(sx + 19)}" cy="${f(sy + 7)}" rx="5" ry="3" fill="#FF9EB8" fill-opacity=".7"/>`;

  // 雲
  const n = Math.max(5, Math.round((W * H) / 62000));
  for (let i = 0; i < n; i++) {
    const w = between(r, 120, 230);
    const x = (i / n) * W + between(r, -40, 40) - 40;
    const y = between(r, 10, H - w * 0.42 - 6);
    body += cloudShape(x, y, w);
  }

  // 小星星
  for (let i = 0; i < Math.round((W * H) / 30000); i++) {
    body += star4(r() * W, r() * H, between(r, 0.6, 1.3), pick(r, ['#ffffff', '#FFE07A', '#FFB3C7']));
  }
  return { defs, body, label: '雲朵' };
}

function gingham(r, id, W, H, opts = {}) {
  const fallback = pick(r, ['#FF9BB8', '#8FD9C2', '#9CC9FF', '#FFD47A', '#C9B5EC']);
  const c = opts.tint || fallback;
  const size = 44;
  const defs = `<pattern id="${id}-g" width="${size}" height="${size}" patternUnits="userSpaceOnUse">
      <rect width="${size}" height="${size}" fill="#FFFDF9"/>
      <rect width="${size}" height="${size / 2}" fill="${c}" fill-opacity=".42"/>
      <rect width="${size / 2}" height="${size}" fill="${c}" fill-opacity=".42"/>
    </pattern>`;
  let body = `<rect x="-10" y="-10" width="${W + 20}" height="${H + 20}" fill="url(#${id}-g)"/>`;
  for (let i = 0; i < Math.round((W * H) / 26000); i++) {
    const x = r() * W;
    const y = r() * H;
    if (r() < 0.6) body += heart(x, y, between(r, 1.6, 2.6), '#fff', between(r, -25, 25)) + heart(x, y, between(r, 1.1, 1.6), c, between(r, -25, 25));
    else body += star4(x, y, between(r, 1.4, 2.2), '#ffffff');
  }
  return { defs, body, label: '野餐格紋' };
}

function sprinkles(r, id, W, H, opts = {}) {
  const fallback = pick(r, ['#FFD3E0', '#FFF1D6', '#D8F3EA', '#E6DDFB']);
  const base = opts.tint ? mix(opts.tint, '#ffffff', 0.45) : fallback;
  let body = `<rect x="-10" y="-10" width="${W + 20}" height="${H + 20}" fill="${base}"/>`;
  const colors = ['#FF6F9C', '#FFC93C', '#4CC9A6', '#5AA9F0', '#A47BE0', '#FF9A5C', '#ffffff'];
  const n = Math.round((W * H) / 1700);
  for (let i = 0; i < n; i++) {
    const x = r() * W;
    const y = r() * H;
    const c = pick(r, colors);
    if (r() < 0.78) {
      const len = between(r, 7, 13);
      const a = r() * Math.PI;
      const dx = Math.cos(a) * len;
      const dy = Math.sin(a) * len;
      body += `<path d="M${f(x - dx / 2)},${f(y - dy / 2)}l${f(dx)},${f(dy)}" stroke="${c}" stroke-width="4.6" stroke-linecap="round"/>`;
    } else {
      body += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(between(r, 2.4, 3.6))}" fill="${c}"/>`;
    }
  }
  return { defs: '', body, label: '糖霜彩針' };
}

function boba(r, id, W, H) {
  const defs = `<linearGradient id="${id}-tea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F6E7D6"/><stop offset=".55" stop-color="#E9CBAA"/><stop offset="1" stop-color="#D5A97F"/>
    </linearGradient>`;
  let body = `<rect x="-10" y="-10" width="${W + 20}" height="${H + 20}" fill="url(#${id}-tea)"/>`;

  // 冰塊
  for (let i = 0; i < Math.round(W / 140); i++) {
    const s = between(r, 34, 54);
    const x = (i / Math.round(W / 140)) * W + between(r, -10, 40);
    const y = between(r, 4, H * 0.42);
    body += `<rect x="${f(x)}" y="${f(y)}" width="${f(s)}" height="${f(s)}" rx="11" fill="#fff" fill-opacity=".38" stroke="#fff" stroke-opacity=".65" stroke-width="2" transform="rotate(${f(between(r, -20, 20))} ${f(x + s / 2)} ${f(y + s / 2)})"/>`;
  }

  // 吸管
  const strawX = r() < 0.5 ? between(r, W * 0.12, W * 0.3) : between(r, W * 0.7, W * 0.88);
  body += `<g transform="rotate(${f(between(r, 12, 20))} ${f(strawX)} ${f(H / 2)})">
      <rect x="${f(strawX - 17)}" y="-60" width="34" height="${f(H + 120)}" rx="17" fill="#FF9BB8"/>
      <rect x="${f(strawX - 17)}" y="-60" width="10" height="${f(H + 120)}" rx="5" fill="#fff" fill-opacity=".45"/>
    </g>`;

  // 粉圓（有些有表情）
  const count = Math.round((W * Math.max(H * 0.42, 110)) / 1500);
  for (let i = 0; i < count; i++) {
    const R = between(r, 12, 18);
    const x = r() * W;
    const y = H - between(r, 6, Math.max(H * 0.42, 110));
    body += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="#3B2418"/><ellipse cx="${f(x - R * 0.35)}" cy="${f(y - R * 0.4)}" rx="${f(R * 0.28)}" ry="${f(R * 0.18)}" fill="#fff" fill-opacity=".55"/>`;
    if (r() < 0.12) {
      body += `<circle cx="${f(x - R * 0.3)}" cy="${f(y + R * 0.05)}" r="${f(R * 0.11)}" fill="#fff"/><circle cx="${f(x + R * 0.3)}" cy="${f(y + R * 0.05)}" r="${f(R * 0.11)}" fill="#fff"/>
        <path d="M${f(x - R * 0.15)},${f(y + R * 0.3)}q${f(R * 0.15)} ${f(R * 0.15)} ${f(R * 0.3)} 0" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`;
    }
  }
  return { defs, body, label: '珍珠奶茶' };
}

function dots(r, id, W, H, opts = {}) {
  const c = opts.tint || pick(r, ['#FF9BB8', '#8FD9C2', '#9CC9FF', '#FFD47A', '#C9B5EC']);
  const base = mix(c, '#ffffff', 0.8);
  const gap = between(r, 46, 58);
  const R = gap * between(r, 0.2, 0.26);
  const defs = `<pattern id="${id}-p" width="${f(gap)}" height="${f(gap)}" patternUnits="userSpaceOnUse">
      <circle cx="${f(gap / 4)}" cy="${f(gap / 4)}" r="${f(R)}" fill="${c}"/>
      <circle cx="${f((gap * 3) / 4)}" cy="${f((gap * 3) / 4)}" r="${f(R)}" fill="${c}"/>
    </pattern>`;
  let body = `<rect x="-10" y="-10" width="${W + 20}" height="${H + 20}" fill="${base}"/><rect x="-10" y="-10" width="${W + 20}" height="${H + 20}" fill="url(#${id}-p)"/>`;
  for (let i = 0; i < Math.round((W * H) / 45000); i++) body += heart(r() * W, r() * H, between(r, 1.8, 2.6), '#ffffff', between(r, -20, 20));
  return { defs, body, label: '波點' };
}

function waves(r, id, W, H) {
  const blues = ['#d9f1fb', '#b6e2f5', '#8fd0ee', '#68bbe3', '#4aa6d6', '#3790c4'];
  const defs = `<linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eaf8ff"/><stop offset="1" stop-color="#cdeefa"/></linearGradient>`;
  let body = `<rect x="-10" y="-10" width="${W + 20}" height="${H + 20}" fill="url(#${id}-sky)"/>`;
  const bands = Math.max(5, Math.round(H / 55));
  for (let k = 0; k < bands; k++) {
    const y0 = H * 0.18 + (k * (H * 0.9)) / bands;
    const step = between(r, 46, 70);
    const amp = step * between(r, 0.32, 0.42);
    const shift = r() * step;
    let d = `M-80,${f(H + 20)} L-80,${f(y0)}`;
    for (let x = -80 - shift; x < W + 80; x += step) d += ` q${f(step / 2)},${f(-amp)} ${f(step)},0`;
    d += ` L${W + 80},${f(H + 20)} Z`;
    const color = blues[Math.min(blues.length - 1, k + 1)];
    body += `<path d="${d}" fill="${color}"/>`;
    let foam = `M-80,${f(y0)}`;
    for (let x = -80 - shift; x < W + 80; x += step) foam += ` q${f(step / 2)},${f(-amp)} ${f(step)},0`;
    body += `<path d="${foam}" fill="none" stroke="#ffffff" stroke-width="3" stroke-opacity=".75" stroke-linecap="round" stroke-dasharray="${f(step * 0.55)} ${f(step * 0.45)}"/>`;
  }
  // 小帆船
  const bx = between(r, W * 0.12, W * 0.88);
  const by = H * 0.18 + (H * 0.9) / bands - 6;
  body += `<g transform="translate(${f(bx)} ${f(by)})">
      <path d="M-26,0 h52 l-8,12 h-36 z" fill="#ff8fb1"/>
      <path d="M0,-2 V-44 L24,-6 z" fill="#ffffff"/><path d="M-3,-4 V-36 L-20,-6 z" fill="#ffe08a"/>
    </g>`;
  for (let i = 0; i < Math.round(W / 40); i++) {
    body += `<circle cx="${f(r() * W)}" cy="${f(between(r, H * 0.45, H))}" r="${f(between(r, 2, 5))}" fill="none" stroke="#ffffff" stroke-opacity=".7" stroke-width="1.6"/>`;
  }
  return { defs, body, label: '海浪' };
}

function lemonSlice(x, y, R, rot) {
  let g = `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})">
    <circle r="${f(R)}" fill="#ffcf3d"/><circle r="${f(R * 0.88)}" fill="#fff6c8"/><circle r="${f(R * 0.8)}" fill="#ffe67a"/>`;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    g += `<path d="M0,0 L${f(Math.cos(a) * R * 0.8)},${f(Math.sin(a) * R * 0.8)}" stroke="#fff6c8" stroke-width="${f(R * 0.07)}" stroke-linecap="round"/>`;
  }
  return `${g}<circle r="${f(R * 0.1)}" fill="#fff6c8"/></g>`;
}

function lemons(r, id, W, H) {
  const base = pick(r, ['#fffbe3', '#eaf8ee', '#f0f8ff']);
  let body = `<rect x="-10" y="-10" width="${W + 20}" height="${H + 20}" fill="${base}"/>`;
  const n = Math.round((W * H) / 16000);
  for (let i = 0; i < n; i++) {
    const x = ((i + r() * 0.8) / n) * W;
    const y = between(r, 10, H - 10);
    const kind = r();
    if (kind < 0.55) body += lemonSlice(x, y, between(r, 22, 36), r() * 90);
    else if (kind < 0.8) {
      const rot = between(r, -40, 40);
      body += `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})"><ellipse rx="30" ry="22" fill="#ffd84d"/><ellipse cx="-30" rx="6" ry="4" fill="#ffd84d"/><ellipse cx="30" rx="6" ry="4" fill="#ffd84d"/><ellipse cx="-8" cy="-8" rx="10" ry="5" fill="#fff3b0" fill-opacity=".8"/></g>`;
    } else {
      const rot = r() * 360;
      body += `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})"><path d="M0,0 C10,-14 30,-14 40,0 C30,14 10,14 0,0 z" fill="#8fd17e"/><path d="M2,0 H36" stroke="#6bb35c" stroke-width="2" stroke-linecap="round"/></g>`;
    }
  }
  return { defs: '', body, label: '檸檬片' };
}

function stars(r, id, W, H) {
  const defs = `<linearGradient id="${id}-n" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#20245a"/><stop offset=".6" stop-color="#4a3f8a"/><stop offset="1" stop-color="#b48fd8"/>
    </linearGradient>
    <mask id="${id}-moon"><rect x="-200" y="-200" width="400" height="400" fill="#000"/><circle r="38" fill="#fff"/><circle cx="18" cy="-12" r="34" fill="#000"/></mask>`;
  let body = `<rect x="-10" y="-10" width="${W + 20}" height="${H + 20}" fill="url(#${id}-n)"/>`;
  for (let i = 0; i < Math.round((W * H) / 900); i++) {
    body += `<circle cx="${f(r() * W)}" cy="${f(r() * H * 0.85)}" r="${f(between(r, 0.6, 1.8))}" fill="#ffffff" fill-opacity="${f(between(r, 0.4, 1))}"/>`;
  }
  for (let i = 0; i < Math.round((W * H) / 26000); i++) body += star4(r() * W, r() * H * 0.8, between(r, 0.9, 2), pick(r, ['#fff2b3', '#ffffff', '#ffd0e1']));
  // 流星
  const sx = between(r, W * 0.2, W * 0.7);
  const sy = between(r, 20, H * 0.35);
  body += `<path d="M${f(sx)},${f(sy)} l-90,34" stroke="#ffffff" stroke-opacity=".7" stroke-width="2.4" stroke-linecap="round"/>` + star4(sx, sy, 1.4, '#fff2b3');
  // 想睡的月亮
  const mx = r() < 0.5 ? between(r, W * 0.08, W * 0.2) : between(r, W * 0.8, W * 0.92);
  const my = Math.min(H * 0.34, 92);
  body += `<g transform="translate(${f(mx)} ${f(my)})"><circle r="58" fill="#fff2b3" fill-opacity=".12"/><g mask="url(#${id}-moon)"><circle r="38" fill="#ffe9a8"/></g>
      <path d="M-24,2 q4,3 8,0" fill="none" stroke="#6b5a3a" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M-14,14 q4,3 8,0" fill="none" stroke="#6b5a3a" stroke-width="2" stroke-linecap="round"/>
      <ellipse cx="-27" cy="10" rx="4.5" ry="2.6" fill="#ff9eb8" fill-opacity=".75"/></g>`;
  // 下方的雲
  for (let i = 0; i < Math.max(3, Math.round(W / 300)); i++) {
    const w = between(r, 140, 240);
    body += cloudShape((i / Math.max(3, Math.round(W / 300))) * W + between(r, -30, 30) - 40, H - w * 0.32, w, '#d9c9f5');
  }
  return { defs, body, label: '星空' };
}

// ---------- 第四版新增的封面 ----------

const bg = (W, H, fill) => `<rect x="-10" y="-10" width="${W + 20}" height="${H + 20}" fill="${fill}"/>`;

function vGradient(id, stops) {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
}

// 一群散開的小點點
function confettiDots(r, W, H, n, colors, [min, max] = [1.6, 3.2]) {
  let s = '';
  for (let i = 0; i < n; i++) s += `<circle cx="${f(r() * W)}" cy="${f(r() * H)}" r="${f(between(r, min, max))}" fill="${pick(r, colors)}"/>`;
  return s;
}

// ---------- 西瓜 ----------
function melonWedge(r, x, y, R, rot) {
  const a = 0.62;
  const sector = (rad) => `M0,0 L${f(-Math.sin(a) * rad)},${f(Math.cos(a) * rad)} A${f(rad)},${f(rad)} 0 0 0 ${f(Math.sin(a) * rad)},${f(Math.cos(a) * rad)} Z`;
  let g = `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})">
    <path d="${sector(R)}" fill="#5cb85c"/><path d="${sector(R * 0.9)}" fill="#eaf8da"/><path d="${sector(R * 0.84)}" fill="#ff6b7a"/>`;
  for (let k = 0; k < 4; k++) {
    const t = between(r, -a * 0.55, a * 0.55);
    const rad = R * between(r, 0.38, 0.7);
    g += `<ellipse cx="${f(Math.sin(t) * rad)}" cy="${f(Math.cos(t) * rad)}" rx="${f(R * 0.035)}" ry="${f(R * 0.065)}" transform="rotate(${f((-t * 180) / Math.PI)} ${f(Math.sin(t) * rad)} ${f(Math.cos(t) * rad)})" fill="#3b2a2c"/>`;
  }
  return `${g}</g>`;
}

function melonHalf(r, x, y, R, rot) {
  const half = (rad) => `M${f(-rad)},0 A${f(rad)},${f(rad)} 0 0 0 ${f(rad)},0 Z`;
  let g = `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})">
    <path d="${half(R)}" fill="#5cb85c"/><path d="${half(R * 0.92)}" fill="#eaf8da"/><path d="${half(R * 0.86)}" fill="#ff6b7a"/>`;
  for (let k = 0; k < 7; k++) {
    const t = between(r, 0.35, Math.PI - 0.35);
    const rad = R * between(r, 0.3, 0.68);
    const sx = Math.cos(t) * rad;
    const sy = Math.sin(t) * rad;
    g += `<ellipse cx="${f(sx)}" cy="${f(sy)}" rx="${f(R * 0.03)}" ry="${f(R * 0.055)}" transform="rotate(${f((t * 180) / Math.PI - 90)} ${f(sx)} ${f(sy)})" fill="#3b2a2c"/>`;
  }
  return `${g}</g>`;
}

function watermelon(r, id, W, H) {
  let body = bg(W, H, pick(r, ['#eefaf0', '#fff1f2', '#f4fbea']));
  body += confettiDots(r, W, H, Math.round((W * H) / 2600), ['#bfe7b8', '#ffc9cf'], [2, 4]);
  const n = Math.round((W * H) / 15000);
  for (let i = 0; i < n; i++) {
    const x = ((i + r() * 0.8) / n) * W;
    const y = between(r, 0, H);
    if (r() < 0.62) body += melonWedge(r, x, y - 24, between(r, 38, 54), between(r, -40, 40) + (r() < 0.5 ? 0 : 180));
    else body += melonHalf(r, x, y, between(r, 30, 44), between(r, -30, 30));
  }
  for (let i = 0; i < Math.round((W * H) / 40000); i++) body += heart(r() * W, r() * H, between(r, 1.2, 1.8), '#ffffff', between(r, -25, 25));
  return { defs: '', body, label: '西瓜' };
}

// ---------- 橘子汽水 ----------
function citrusSlice(x, y, R, rot, c) {
  let g = `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})">
    <circle r="${f(R)}" fill="${c.rind}"/><circle r="${f(R * 0.88)}" fill="${c.pith}"/><circle r="${f(R * 0.8)}" fill="${c.flesh}"/>`;
  for (let k = 0; k < 10; k++) {
    const a = (k * Math.PI) / 5;
    g += `<path d="M0,0 L${f(Math.cos(a) * R * 0.8)},${f(Math.sin(a) * R * 0.8)}" stroke="${c.pith}" stroke-width="${f(R * 0.07)}" stroke-linecap="round"/>`;
  }
  return `${g}<circle r="${f(R * 0.1)}" fill="${c.pith}"/></g>`;
}

function oranges(r, id, W, H) {
  const defs = vGradient(`${id}-soda`, [[0, '#fff6ea'], [1, '#ffe1bf']]);
  let body = bg(W, H, `url(#${id}-soda)`);
  const ORANGE = { rind: '#ff9a2e', pith: '#fff1dc', flesh: '#ffb551' };
  // 汽水泡泡
  for (let i = 0; i < Math.round((W * H) / 2200); i++) {
    const R = between(r, 2.5, 9);
    const x = r() * W;
    const y = r() * H;
    body += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="#ffffff" fill-opacity=".35" stroke="#ffffff" stroke-width="1.6" stroke-opacity=".9"/>`;
  }
  const n = Math.round((W * H) / 17000);
  for (let i = 0; i < n; i++) {
    const x = ((i + r() * 0.8) / n) * W;
    const y = between(r, 10, H - 10);
    const kind = r();
    if (kind < 0.55) body += citrusSlice(x, y, between(r, 24, 38), r() * 90, ORANGE);
    else if (kind < 0.85) {
      const R = between(r, 22, 30);
      body += `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(between(r, -30, 30))})">
        <circle r="${f(R)}" fill="#ffa233"/><circle cx="${f(-R * 0.35)}" cy="${f(-R * 0.35)}" r="${f(R * 0.22)}" fill="#ffc77a" fill-opacity=".8"/>
        <circle cy="${f(-R + 2)}" r="2.4" fill="#c9701a"/>
        <path d="M2,${f(-R + 1)} C10,${f(-R - 12)} 24,${f(-R - 10)} 28,${f(-R - 4)} C20,${f(-R + 2)} 8,${f(-R + 2)} 2,${f(-R + 1)} z" fill="#6cc06a"/></g>`;
    } else {
      body += `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(r() * 360)})"><path d="M0,0 C10,-14 30,-14 40,0 C30,14 10,14 0,0 z" fill="#7cc875"/><path d="M2,0 H36" stroke="#5aa957" stroke-width="2" stroke-linecap="round"/></g>`;
    }
  }
  return { defs, body, label: '橘子汽水' };
}

// ---------- 熱可可 ----------
const MUGS = ['#ff9bb8', '#9cc9ff', '#ffd47a', '#ffffff', '#b8e6c9', '#c9b5ec'];

function mug(r, x, y, s, rot) {
  const c = pick(r, MUGS);
  const white = c === '#ffffff';
  const handle = 'M28,-6 c18,0 18,26 0,26';
  const pink = r() < 0.5;
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${f(s)})">
    ${white ? `<path d="${handle}" fill="none" stroke="#e8d3c4" stroke-width="11" stroke-linecap="round"/>` : ''}
    <path d="${handle}" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/>
    <rect x="-30" y="-22" width="60" height="50" rx="14" fill="${c}"${white ? ' stroke="#e8d3c4" stroke-width="2"' : ''}/>
    <ellipse cy="-21" rx="26" ry="6" fill="#8a5a3c"/>
    <rect x="-15" y="-31" width="12" height="11" rx="3.5" fill="#ffffff" transform="rotate(-12 -9 -26)"/>
    <rect x="3" y="-30" width="12" height="11" rx="3.5" fill="${pink ? '#ffd3e1' : '#ffffff'}" transform="rotate(10 9 -25)"/>
    ${heart(0, 3, 1.5, c === '#ffffff' ? '#ff9bb8' : '#ffffff')}
    <path d="M-9,-40 q-6,-7 0,-14 q6,-7 0,-14" fill="none" stroke="#ffffff" stroke-width="3.4" stroke-linecap="round" stroke-opacity=".85"/>
    <path d="M9,-42 q-6,-7 0,-14 q6,-7 0,-14" fill="none" stroke="#ffffff" stroke-width="3.4" stroke-linecap="round" stroke-opacity=".7"/>
  </g>`;
}

function cocoa(r, id, W, H) {
  const gap = 34;
  const defs = `<pattern id="${id}-p" width="${gap}" height="${gap}" patternUnits="userSpaceOnUse"><circle cx="${gap / 4}" cy="${gap / 4}" r="3" fill="#e9cdb9"/><circle cx="${(gap * 3) / 4}" cy="${(gap * 3) / 4}" r="3" fill="#e9cdb9"/></pattern>`;
  let body = bg(W, H, '#f6e6d9') + bg(W, H, `url(#${id}-p)`);
  // 小棉花糖和可可粉
  for (let i = 0; i < Math.round((W * H) / 9000); i++) {
    const s = between(r, 9, 14);
    const x = r() * W;
    const y = r() * H;
    body += `<rect x="${f(x)}" y="${f(y)}" width="${f(s)}" height="${f(s * 0.9)}" rx="${f(s * 0.3)}" fill="${pick(r, ['#ffffff', '#ffd3e1', '#ffffff'])}" transform="rotate(${f(between(r, -30, 30))} ${f(x + s / 2)} ${f(y + s / 2)})"/>`;
  }
  body += confettiDots(r, W, H, Math.round((W * H) / 5000), ['#b07a55', '#c8916b'], [1.4, 2.6]);
  const n = Math.max(3, Math.round((W * H) / 38000));
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.2 + r() * 0.6) / n) * W;
    const y = between(r, 58, Math.max(60, H - 34));
    body += mug(r, x, y, between(r, 0.85, 1.15), between(r, -10, 10));
  }
  return { defs, body, label: '熱可可' };
}

// ---------- 聖誕 ----------
function snowflake(x, y, s, opacity) {
  let d = '';
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI) / 3;
    const dx = Math.cos(a) * s;
    const dy = Math.sin(a) * s;
    d += `M${f(x - dx)},${f(y - dy)} L${f(x + dx)},${f(y + dy)} `;
  }
  return `<path d="${d}" stroke="#ffffff" stroke-opacity="${opacity}" stroke-width="${f(Math.max(1.4, s * 0.18))}" stroke-linecap="round"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(s * 0.22)}" fill="#ffffff" fill-opacity="${opacity}"/>`;
}

function xmasTree(r, x, base, h) {
  const greens = ['#4caf7a', '#5fbf88', '#3f9e6c'];
  const g = pick(r, greens);
  const w = h * 0.62;
  let s = `<rect x="${f(x - h * 0.05)}" y="${f(base - h * 0.14)}" width="${f(h * 0.1)}" height="${f(h * 0.14)}" rx="2" fill="#8a5a3c"/>`;
  for (let t = 0; t < 3; t++) {
    const top = base - h * 0.12 - h * (0.3 + t * 0.26);
    const bottom = base - h * 0.1 - t * h * 0.24;
    const half = (w / 2) * (1 - t * 0.22);
    s += `<path d="M${f(x)},${f(top)} L${f(x + half)},${f(bottom)} Q${f(x)},${f(bottom + h * 0.05)} ${f(x - half)},${f(bottom)} Z" fill="${g}" stroke="${g}" stroke-width="3" stroke-linejoin="round"/>`;
  }
  for (let k = 0; k < 6; k++) {
    const yy = between(r, base - h * 0.78, base - h * 0.16);
    const span = ((yy - (base - h * 0.95)) / (h * 0.85)) * (w / 2) * 0.8;
    s += `<circle cx="${f(x + between(r, -span, span))}" cy="${f(yy)}" r="${f(h * 0.035)}" fill="${pick(r, ['#ff6b6b', '#ffd166', '#7bdff2', '#ffafcc', '#ffffff'])}"/>`;
  }
  return s + star4(x, base - h * 0.95, h * 0.022 + 0.6, '#ffd166');
}

function xmas(r, id, W, H) {
  const defs = vGradient(`${id}-pine`, [[0, '#1d4a39'], [1, '#2f6e54']]);
  let body = bg(W, H, `url(#${id}-pine)`);
  // 遠方的雪花
  for (let i = 0; i < Math.round((W * H) / 1600); i++) body += `<circle cx="${f(r() * W)}" cy="${f(r() * H)}" r="${f(between(r, 0.8, 2.2))}" fill="#ffffff" fill-opacity="${f(between(r, 0.35, 0.9))}"/>`;
  for (let i = 0; i < Math.round((W * H) / 22000); i++) body += snowflake(r() * W, r() * H * 0.8, between(r, 5, 10), f(between(r, 0.55, 0.95)));
  // 上方的燈串
  const sag = Math.min(46, H * 0.16);
  const seg = between(r, 170, 230);
  let x0 = -between(r, 0, seg);
  while (x0 < W + 20) {
    const x1 = x0 + seg;
    body += `<path d="M${f(x0)},6 Q${f((x0 + x1) / 2)},${f(6 + sag * 2)} ${f(x1)},6" fill="none" stroke="#123326" stroke-width="2.4"/>`;
    for (let k = 1; k < 6; k++) {
      const t = k / 6;
      const bx = x0 + seg * t;
      const by = 6 + sag * 2 * 2 * t * (1 - t);
      const c = pick(r, ['#ff6b6b', '#ffd166', '#7bdff2', '#b8f2a6', '#ffafcc']);
      body += `<circle cx="${f(bx)}" cy="${f(by + 9)}" r="11" fill="${c}" fill-opacity=".22"/><rect x="${f(bx - 2.5)}" y="${f(by)}" width="5" height="4" fill="#123326"/><ellipse cx="${f(bx)}" cy="${f(by + 9)}" rx="4.6" ry="7" fill="${c}"/>`;
    }
    x0 = x1;
  }
  // 雪地和樹
  const ground = H - Math.min(34, H * 0.12);
  const pts = [];
  for (let x = -40; x <= W + 40; x += 80) pts.push([x, ground + between(r, -8, 8)]);
  const nTrees = Math.max(3, Math.round(W / 170));
  for (let i = 0; i < nTrees; i++) {
    const x = ((i + 0.5 + between(r, -0.3, 0.3)) / nTrees) * W;
    body += xmasTree(r, x, ground + 6, between(r, Math.min(110, H * 0.4), Math.min(150, H * 0.55)));
  }
  body += `<path d="${smooth(pts)} L${W + 40},${H + 20} L-40,${H + 20} Z" fill="#f4f8ff"/>`;
  // 拐杖糖
  for (let i = 0; i < Math.max(2, Math.round(W / 420)); i++) {
    const x = between(r, 20, W - 20);
    const y = between(r, H * 0.3, ground - 10);
    const cane = `M0,34 V0 a10,10 0 0 1 20,0`;
    body += `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(between(r, -25, 25))})"><path d="${cane}" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/><path d="${cane}" fill="none" stroke="#ff5a5f" stroke-width="7" stroke-dasharray="5 6" stroke-linecap="butt"/></g>`;
  }
  return { defs, body, label: '聖誕' };
}

// ---------- 蘑菇 ----------
function mushroom(r, x, base, h) {
  const kind = pick(r, [
    { cap: '#e8635a', dot: '#ffffff' },
    { cap: '#c98b5a', dot: '#f7e4c8' },
    { cap: '#f29bb0', dot: '#ffffff' },
    { cap: '#e8635a', dot: '#ffffff' },
  ]);
  const capW = h * between(r, 0.75, 1.05);
  const capH = h * 0.5;
  const stemW = capW * 0.32;
  const top = base - h;
  let s = `<path d="M${f(x - stemW / 2)},${f(base)} C${f(x - stemW / 2 - 2)},${f(base - h * 0.4)} ${f(x - stemW * 0.4)},${f(top + capH * 0.9)} ${f(x - stemW * 0.35)},${f(top + capH * 0.8)} L${f(x + stemW * 0.35)},${f(top + capH * 0.8)} C${f(x + stemW * 0.4)},${f(top + capH * 0.9)} ${f(x + stemW / 2 + 2)},${f(base - h * 0.4)} ${f(x + stemW / 2)},${f(base)} Z" fill="#fff4e3"/>`;
  s += `<ellipse cx="${f(x)}" cy="${f(top + capH * 0.86)}" rx="${f(capW * 0.42)}" ry="${f(capH * 0.14)}" fill="#f1d9bf"/>`;
  s += `<path d="M${f(x - capW / 2)},${f(top + capH * 0.85)} C${f(x - capW / 2)},${f(top - capH * 0.1)} ${f(x + capW / 2)},${f(top - capH * 0.1)} ${f(x + capW / 2)},${f(top + capH * 0.85)} Q${f(x)},${f(top + capH)} ${f(x - capW / 2)},${f(top + capH * 0.85)} Z" fill="${kind.cap}"/>`;
  for (let k = 0; k < 5; k++) {
    const dx = between(r, -capW * 0.32, capW * 0.32);
    const dy = between(r, capH * 0.1, capH * 0.6) - Math.abs(dx) * 0.2;
    s += `<circle cx="${f(x + dx)}" cy="${f(top + dy)}" r="${f(capW * between(r, 0.05, 0.08))}" fill="${kind.dot}"/>`;
  }
  return s;
}

function mushrooms(r, id, W, H) {
  const defs = vGradient(`${id}-sky`, [[0, '#f1f8e8'], [1, '#dcefcf']]);
  let body = bg(W, H, `url(#${id}-sky)`);
  // 後面的樹叢
  const back = [];
  for (let x = -60; x <= W + 60; x += 70) back.push([x, H * 0.55 + between(r, -18, 12)]);
  body += `<path d="${smooth(back)} L${W + 60},${H + 20} L-60,${H + 20} Z" fill="#c9e4b4"/>`;
  // 螢火蟲
  for (let i = 0; i < Math.round((W * H) / 14000); i++) {
    const x = r() * W;
    const y = r() * H * 0.6;
    body += `<circle cx="${f(x)}" cy="${f(y)}" r="7" fill="#fff4a8" fill-opacity=".35"/><circle cx="${f(x)}" cy="${f(y)}" r="2.4" fill="#fff07a"/>`;
  }
  const ground = H - Math.min(30, H * 0.12);
  const n = Math.max(4, Math.round(W / 120));
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.5 + between(r, -0.35, 0.35)) / n) * W;
    const h = between(r, Math.min(46, H * 0.18), Math.min(92, H * 0.38));
    body += mushroom(r, x, ground + between(r, 0, 10), h);
    if (r() < 0.6) body += mushroom(r, x + between(r, 24, 40), ground + 8, h * between(r, 0.45, 0.6));
  }
  // 草地、小花、三葉草
  const grass = [];
  for (let x = -40; x <= W + 40; x += 60) grass.push([x, ground + between(r, -4, 6)]);
  body += `<path d="${smooth(grass)} L${W + 40},${H + 20} L-40,${H + 20} Z" fill="#8fc77a"/>`;
  for (let i = 0; i < Math.round(W / 14); i++) {
    const x = r() * W;
    const y = ground + between(r, -2, 8);
    body += `<path d="M${f(x)},${f(y + 8)} q2,-8 ${f(between(r, -4, 4))},-14" stroke="#6fb35d" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  }
  for (let i = 0; i < Math.round(W / 60); i++) {
    const x = r() * W;
    const y = ground + between(r, 4, 16);
    const c = pick(r, ['#ffffff', '#fff3a8', '#ffd1dc']);
    body += `<g transform="translate(${f(x)} ${f(y)})"><circle cx="0" cy="-4" r="3" fill="${c}"/><circle cx="4" cy="0" r="3" fill="${c}"/><circle cx="0" cy="4" r="3" fill="${c}"/><circle cx="-4" cy="0" r="3" fill="${c}"/><circle r="2.2" fill="#ffc93c"/></g>`;
  }
  return { defs, body, label: '蘑菇' };
}

// ---------- 扶桑花 ----------
function tropicalLeaf(x, y, L, rot, c) {
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})">
    <path d="M0,0 C${f(L * 0.25)},${f(-L * 0.3)} ${f(L * 0.72)},${f(-L * 0.28)} ${f(L)},0 C${f(L * 0.72)},${f(L * 0.28)} ${f(L * 0.25)},${f(L * 0.3)} 0,0 Z" fill="${c}"/>
    <path d="M${f(L * 0.05)},0 L${f(L * 0.92)},0" stroke="#ffffff" stroke-opacity=".45" stroke-width="2" stroke-linecap="round"/></g>`;
}

function hibiscusFlower(r, x, y, R, rot) {
  const c = pick(r, ['#e9579a', '#ff7b6b', '#ff9cc2', '#ffb347', '#e9579a']);
  const center = mix(c, '#7a1040', 0.45);
  let g = `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})">`;
  for (let k = 0; k < 5; k++) {
    g += `<path transform="rotate(${k * 72})" d="M0,0 C${f(-R * 0.6)},${f(-R * 0.2)} ${f(-R * 0.78)},${f(-R * 0.98)} 0,${f(-R)} C${f(R * 0.78)},${f(-R * 0.98)} ${f(R * 0.6)},${f(-R * 0.2)} 0,0 Z" fill="${c}" stroke="${mix(c, '#ffffff', 0.35)}" stroke-width="1.4"/>`;
  }
  g += `<circle r="${f(R * 0.22)}" fill="${center}"/>`;
  g += `<path d="M0,0 L${f(R * 0.5)},${f(-R * 0.5)}" stroke="${mix(c, '#ffffff', 0.5)}" stroke-width="${f(R * 0.06)}" stroke-linecap="round"/>`;
  for (let k = 0; k < 5; k++) g += `<circle cx="${f(R * 0.5 + between(r, -R * 0.08, R * 0.08))}" cy="${f(-R * 0.5 + between(r, -R * 0.08, R * 0.08))}" r="${f(R * 0.05)}" fill="#ffd84d"/>`;
  return `${g}</g>`;
}

function hibiscus(r, id, W, H) {
  const defs = vGradient(`${id}-bg`, [[0, '#fff3f7'], [1, '#fde3ec']]);
  let body = bg(W, H, `url(#${id}-bg)`);
  const greens = ['#4fb383', '#7fcf9f', '#3f9e74'];
  for (let i = 0; i < Math.round((W * H) / 11000); i++) {
    body += tropicalLeaf(r() * W, r() * H, between(r, 60, 110), r() * 360, pick(r, greens));
  }
  body += confettiDots(r, W, H, Math.round((W * H) / 6000), ['#ffffff', '#ffd84d'], [2, 3.4]);
  const n = Math.round((W * H) / 20000);
  for (let i = 0; i < n; i++) {
    body += hibiscusFlower(r, ((i + r() * 0.8) / n) * W, between(r, 10, H - 10), between(r, 26, 40), r() * 360);
  }
  return { defs, body, label: '扶桑花' };
}

// ---------- 棉花糖 ----------
function cottonCandy(r, x, y, s, rot) {
  const colors = pick(r, [['#ffc2dc', '#ffd9e9'], ['#c4dcff', '#dbe9ff'], ['#e2ccfb', '#efe2ff'], ['#ffc2dc', '#c4dcff']]);
  let g = `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${f(s)})">
    <path d="M-9,8 L9,8 L0,74 Z" fill="#ffffff"/><path d="M-6,20 L6,16 M-4,34 L5,30 M-2,48 L4,45" stroke="#ff9bb8" stroke-width="3" stroke-linecap="round"/>`;
  const blobs = [[0, -18, 26], [-20, -6, 18], [20, -6, 18], [-12, -34, 17], [13, -33, 18], [0, 2, 18]];
  blobs.forEach(([bx, by, br], k) => {
    g += `<circle cx="${bx}" cy="${by}" r="${br}" fill="${colors[k % 2]}"/>`;
  });
  g += `<circle cx="-10" cy="-30" r="5" fill="#ffffff" fill-opacity=".7"/><circle cx="-3" cy="-22" r="2.6" fill="#ffffff" fill-opacity=".7"/>`;
  return `${g}</g>`;
}

function cottoncandy(r, id, W, H) {
  const defs = `<linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3e9ff"/><stop offset=".5" stop-color="#fdeef7"/><stop offset="1" stop-color="#e8f1ff"/></linearGradient>`;
  let body = bg(W, H, `url(#${id}-bg)`);
  body += confettiDots(r, W, H, Math.round((W * H) / 2400), ['#ffffff', '#ffc2dc', '#c4dcff', '#e2ccfb', '#fff1b8'], [1.8, 3.6]);
  for (let i = 0; i < Math.round((W * H) / 30000); i++) body += heart(r() * W, r() * H, between(r, 1.3, 2), pick(r, ['#ffffff', '#ffb3d1']), between(r, -25, 25));
  const n = Math.max(3, Math.round((W * H) / 36000));
  for (let i = 0; i < n; i++) {
    body += cottonCandy(r, ((i + 0.2 + r() * 0.6) / n) * W, between(r, 50, Math.max(52, H - 70)), between(r, 0.85, 1.15), between(r, -22, 22));
  }
  return { defs, body, label: '棉花糖' };
}

// ---------- 鬆餅 ----------
function waffle(r, id, W, H) {
  const c = 46;
  const defs = `<pattern id="${id}-w" width="${c}" height="${c}" patternUnits="userSpaceOnUse">
      <rect width="${c}" height="${c}" fill="#e9a94a"/>
      <rect x="7" y="7" width="${c - 14}" height="${c - 14}" rx="6" fill="#f6cf80"/>
      <path d="M8,${c - 9} V13 Q8,8 13,8 H${c - 9}" fill="none" stroke="#dc9536" stroke-width="3" stroke-linecap="round"/>
    </pattern>`;
  let body = bg(W, H, `url(#${id}-w)`);
  // 蜂蜜從上面流下來
  let honey = `M-20,-10 L${W + 20},-10 L${W + 20},18`;
  let x = W + 20;
  while (x > -20) {
    const w = between(r, 50, 110);
    const drip = r() < 0.55 ? between(r, 30, Math.min(110, H * 0.45)) : between(r, 8, 18);
    const mid = x - w / 2;
    honey += ` L${f(x)},${f(16 + between(r, -4, 4))} C${f(mid + 14)},${f(18)} ${f(mid + 10)},${f(drip)} ${f(mid)},${f(drip + 8)} C${f(mid - 10)},${f(drip)} ${f(mid - 14)},18 ${f(x - w)},${f(16 + between(r, -4, 4))}`;
    x -= w;
  }
  honey += ` L-20,18 Z`;
  body += `<path d="${honey}" fill="#f2a51a" fill-opacity=".9"/><path d="${honey}" fill="none" stroke="#ffd36b" stroke-width="2" stroke-opacity=".7"/>`;
  // 奶油、藍莓、草莓片
  for (let i = 0; i < Math.max(2, Math.round(W / 300)); i++) {
    const bx = between(r, 40, W - 40);
    const by = between(r, H * 0.35, H - 40);
    const s = between(r, 38, 50);
    body += `<g transform="rotate(${f(between(r, -14, 14))} ${f(bx)} ${f(by)})"><rect x="${f(bx - s / 2)}" y="${f(by - s / 2 + 5)}" width="${f(s)}" height="${f(s * 0.8)}" rx="9" fill="#e0b545" fill-opacity=".5"/><rect x="${f(bx - s / 2)}" y="${f(by - s / 2)}" width="${f(s)}" height="${f(s * 0.8)}" rx="9" fill="#fff2a8"/><rect x="${f(bx - s / 2 + 6)}" y="${f(by - s / 2 + 5)}" width="${f(s * 0.4)}" height="${f(s * 0.16)}" rx="4" fill="#ffffff" fill-opacity=".8"/></g>`;
  }
  for (let i = 0; i < Math.round((W * H) / 9000); i++) {
    const bx = r() * W;
    const by = between(r, H * 0.2, H);
    if (r() < 0.6) {
      body += `<circle cx="${f(bx)}" cy="${f(by)}" r="9" fill="#5b6fd6"/><circle cx="${f(bx - 3)}" cy="${f(by - 3)}" r="2.6" fill="#ffffff" fill-opacity=".45"/><path d="M${f(bx - 3)},${f(by - 6)} l3,2 l3,-2" stroke="#33408f" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
    } else {
      body += heart(bx, by, between(r, 2.2, 2.8), '#ff5a6e', between(r, -30, 30)) + heart(bx, by - 1, between(r, 1.2, 1.4), '#ffc2cb', 0);
    }
  }
  return { defs, body, label: '鬆餅' };
}

// ---------- 彩虹 ----------
const RAINBOW = ['#ff9aa2', '#ffc48a', '#ffe68a', '#b5e7a0', '#9fd3ff', '#c7b3ff'];

function rainbowSticker(x, y, R, bands, rot) {
  const w = R / (bands + 1.4);
  let g = `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})">`;
  for (let k = 0; k < bands; k++) {
    const rr = R - w * (k + 0.5);
    g += `<path d="M${f(-rr)},0 A${f(rr)},${f(rr)} 0 0 1 ${f(rr)},0" fill="none" stroke="${RAINBOW[k]}" stroke-width="${f(w + 0.6)}"/>`;
  }
  const mid = R - (w * bands) / 2;
  const cw = w * bands * 1.7;
  g += cloudShape(-mid - cw / 2, -cw * 0.22, cw) + cloudShape(mid - cw / 2, -cw * 0.22, cw);
  return `${g}</g>`;
}

function rainbow(r, id, W, H) {
  const defs = vGradient(`${id}-sky`, [[0, '#e3f2ff'], [1, '#fff3f8']]);
  let body = bg(W, H, `url(#${id}-sky)`);
  body += confettiDots(r, W, H, Math.round((W * H) / 2600), RAINBOW, [2, 3.6]);
  const n = Math.max(3, Math.round((W * H) / 26000));
  for (let i = 0; i < n; i++) {
    const R = between(r, 34, 58);
    body += rainbowSticker(((i + 0.15 + r() * 0.7) / n) * W, between(r, R + 6, H - 14), R, pick(r, [4, 5, 6]), between(r, -16, 16));
  }
  for (let i = 0; i < Math.round((W * H) / 24000); i++) body += heart(r() * W, r() * H, between(r, 1.2, 1.8), pick(r, ['#ffffff', '#ffb3c7']), between(r, -25, 25));
  return { defs, body, label: '彩虹' };
}

// ---------- 莫蘭迪色塊 ----------
const MORANDI = ['#d8b4a8', '#b7c2ae', '#a9b6c4', '#ddc39b', '#c8a597', '#cfc6bb'];

function arches(r, id, W, H) {
  let body = bg(W, H, '#efe8e1');
  const cell = between(r, 130, 160);
  const cols = Math.ceil(W / cell) + 1;
  for (let i = 0; i < cols; i++) {
    const cx = i * cell + between(r, -18, 18);
    const kind = r();
    const colors = [...MORANDI].sort(() => r() - 0.5);
    if (kind < 0.34) {
      // 拱門
      const R = between(r, 40, 58);
      const base = between(r, H * 0.75, H + 10);
      const leg = between(r, 20, 60);
      for (let k = 0; k < 4; k++) {
        const rr = R - k * (R / 4.2);
        body += `<path d="M${f(cx - rr)},${f(base)} L${f(cx - rr)},${f(base - leg)} A${f(rr)},${f(rr)} 0 0 1 ${f(cx + rr)},${f(base - leg)} L${f(cx + rr)},${f(base)} Z" fill="${colors[k]}"/>`;
      }
    } else if (kind < 0.56) {
      // 太陽
      const R = between(r, 28, 44);
      const cy = between(r, R + 10, H - R - 10);
      body += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R)}" fill="${colors[0]}"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R + 12)}" fill="none" stroke="${colors[0]}" stroke-width="2" stroke-dasharray="2 7" stroke-linecap="round"/>`;
    } else if (kind < 0.76) {
      // 半圓
      const R = between(r, 34, 52);
      const cy = between(r, H * 0.35, H * 0.8);
      body += `<path d="M${f(cx - R)},${f(cy)} A${f(R)},${f(R)} 0 0 0 ${f(cx + R)},${f(cy)} Z" fill="${colors[0]}"/><path d="M${f(cx - R * 0.6)},${f(cy)} A${f(R * 0.6)},${f(R * 0.6)} 0 0 0 ${f(cx + R * 0.6)},${f(cy)} Z" fill="${colors[1]}"/>`;
    } else {
      // 膠囊
      const w = between(r, 26, 34);
      const h = between(r, 80, 120);
      const cy = between(r, h / 2, H - h / 2);
      body += `<rect x="${f(cx - w / 2)}" y="${f(cy - h / 2)}" width="${f(w)}" height="${f(h)}" rx="${f(w / 2)}" fill="${colors[0]}" transform="rotate(${f(between(r, -35, 35))} ${f(cx)} ${f(cy)})"/>`;
    }
    // 點點和波浪線
    if (r() < 0.5) {
      const dx = cx + cell / 2;
      const dy = between(r, 20, H - 40);
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) body += `<circle cx="${f(dx + a * 9)}" cy="${f(dy + b * 9)}" r="2" fill="#a8968a"/>`;
    } else {
      const wx = cx + cell * 0.35;
      const wy = between(r, 24, H - 24);
      body += `<path d="M${f(wx)},${f(wy)} q8,-8 16,0 t16,0 t16,0" fill="none" stroke="#a8968a" stroke-width="2.4" stroke-linecap="round"/>`;
    }
  }
  return { defs: '', body, label: '莫蘭迪色塊' };
}

// ---------- 四季（第五版新增） ----------

// 櫻花
function sakuraFlower(x, y, R, rot, c = '#ffc9d9') {
  const petal = `M0,0 C${f(-R * 0.6)},${f(-R * 0.3)} ${f(-R * 0.5)},${f(-R * 0.98)} ${f(-R * 0.14)},${f(-R)} L0,${f(-R * 0.84)} L${f(R * 0.14)},${f(-R)} C${f(R * 0.5)},${f(-R * 0.98)} ${f(R * 0.6)},${f(-R * 0.3)} 0,0 Z`;
  let g = `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})">`;
  for (let k = 0; k < 5; k++) g += `<path transform="rotate(${k * 72})" d="${petal}" fill="${c}" stroke="#ffb3c9" stroke-width="1"/>`;
  g += `<circle r="${f(R * 0.2)}" fill="#ff8fb1"/>`;
  for (let k = 0; k < 5; k++) {
    const a = (k * 72 + 36) * (Math.PI / 180);
    g += `<circle cx="${f(Math.sin(a) * R * 0.34)}" cy="${f(-Math.cos(a) * R * 0.34)}" r="${f(R * 0.06)}" fill="#e0607e"/>`;
  }
  return `${g}</g>`;
}

function petalBit(x, y, s, rot) {
  return `<path transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${f(s)})" d="M0,0 C-4,-3 -4,-9 -1,-11 L0,-9.5 L1,-11 C4,-9 4,-3 0,0 Z" fill="#ffc2d4"/>`;
}

function sakura(r, id, W, H) {
  const defs = vGradient(`${id}-sky`, [[0, '#dff0ff'], [1, '#ffeef4']]);
  let body = bg(W, H, `url(#${id}-sky)`);
  // 從上面兩側伸出來的樹枝
  const branches = Math.max(2, Math.round(W / 420));
  for (let b = 0; b < branches; b++) {
    const fromLeft = b % 2 === 0;
    const x0 = fromLeft ? between(r, -40, W * 0.15) + (b * W) / branches : W - between(r, -40, W * 0.15) - (b * W) / branches;
    const dir = fromLeft ? 1 : -1;
    const pts = [[x0, -10]];
    let px = x0;
    let py = -10;
    for (let k = 0; k < 4; k++) {
      px += dir * between(r, 60, 110);
      py += between(r, 18, Math.min(46, H * 0.16));
      pts.push([px, py]);
    }
    body += `<path d="${smooth(pts)}" fill="none" stroke="#8a5a4a" stroke-width="9" stroke-linecap="round"/>`;
    // 小樹枝和花
    for (let k = 1; k < pts.length; k++) {
      const [bx, by] = pts[k];
      const tx = bx + dir * between(r, 20, 50);
      const ty = by + between(r, -30, 30);
      body += `<path d="M${f(bx)},${f(by)} Q${f((bx + tx) / 2)},${f(by - 12)} ${f(tx)},${f(ty)}" fill="none" stroke="#8a5a4a" stroke-width="4" stroke-linecap="round"/>`;
      for (let n = 0; n < 3; n++) body += sakuraFlower(tx + between(r, -22, 22), ty + between(r, -18, 18), between(r, 11, 17), r() * 72, pick(r, ['#ffc9d9', '#ffd9e5', '#ffffff']));
      body += sakuraFlower(bx + between(r, -16, 16), by + between(r, -14, 14), between(r, 12, 18), r() * 72);
      if (r() < 0.5) body += `<ellipse cx="${f(tx + 14)}" cy="${f(ty + 10)}" rx="9" ry="4.5" fill="#9ccc65" transform="rotate(${f(between(r, -40, 40))} ${f(tx + 14)} ${f(ty + 10)})"/>`;
    }
  }
  // 飄落的花瓣
  for (let i = 0; i < Math.round((W * H) / 3200); i++) body += petalBit(r() * W, r() * H, between(r, 0.9, 1.6), r() * 360);
  for (let i = 0; i < Math.round((W * H) / 30000); i++) body += sakuraFlower(r() * W, between(r, H * 0.4, H), between(r, 8, 12), r() * 72);
  return { defs, body, label: '櫻花' };
}

// 向日葵
function sunflower(r, x, base, h) {
  const R = h * between(r, 0.2, 0.26);
  const top = base - h;
  let s = `<path d="M${f(x)},${f(base + 20)} Q${f(x + between(r, -10, 10))},${f(base - h / 2)} ${f(x)},${f(top)}" fill="none" stroke="#5aa957" stroke-width="5" stroke-linecap="round"/>`;
  for (const side of [-1, 1]) {
    const ly = base - h * between(r, 0.3, 0.6);
    s += `<path d="M${f(x)},${f(ly)} C${f(x + side * 10)},${f(ly - 16)} ${f(x + side * 30)},${f(ly - 14)} ${f(x + side * 38)},${f(ly - 4)} C${f(x + side * 28)},${f(ly + 6)} ${f(x + side * 12)},${f(ly + 4)} ${f(x)},${f(ly)} Z" fill="#6cc06a"/>`;
  }
  let head = `<g transform="translate(${f(x)} ${f(top)}) rotate(${f(between(r, -15, 15))})">`;
  for (let k = 0; k < 14; k++) head += `<ellipse cx="0" cy="${f(-R * 1.05)}" rx="${f(R * 0.32)}" ry="${f(R * 0.62)}" fill="${k % 2 ? '#ffc531' : '#ffd84d'}" transform="rotate(${f((k * 360) / 14)})"/>`;
  head += `<circle r="${f(R * 0.78)}" fill="#8a5a2b"/><circle r="${f(R * 0.55)}" fill="#6b4220"/>`;
  for (let k = 0; k < 10; k++) head += `<circle cx="${f(between(r, -R * 0.5, R * 0.5))}" cy="${f(between(r, -R * 0.5, R * 0.5))}" r="${f(R * 0.06)}" fill="#a87436"/>`;
  return `${s + head}</g>`;
}

function sunflowers(r, id, W, H) {
  const defs = vGradient(`${id}-sky`, [[0, '#a9dcff'], [1, '#e9f7ff']]);
  let body = bg(W, H, `url(#${id}-sky)`);
  const sx = r() < 0.5 ? between(r, W * 0.08, W * 0.22) : between(r, W * 0.78, W * 0.92);
  const sy = Math.min(H * 0.3, 80);
  body += `<circle cx="${f(sx)}" cy="${f(sy)}" r="62" fill="#fff3b0" fill-opacity=".45"/><circle cx="${f(sx)}" cy="${f(sy)}" r="40" fill="#ffd84d"/>`;
  for (let i = 0; i < Math.max(3, Math.round(W / 320)); i++) {
    const w = between(r, 100, 170);
    body += cloudShape(between(r, -40, W), between(r, 6, H * 0.35), w);
  }
  const ground = H - Math.min(26, H * 0.1);
  const n = Math.max(5, Math.round(W / 90));
  const flowers = [];
  for (let i = 0; i < n; i++) flowers.push([((i + 0.5 + between(r, -0.3, 0.3)) / n) * W, between(r, Math.min(90, H * 0.36), Math.min(170, H * 0.62))]);
  flowers.sort((a, b) => b[1] - a[1]);
  for (const [x, h] of flowers) body += sunflower(r, x, ground + between(r, 4, 16), h);
  const grass = [];
  for (let x = -40; x <= W + 40; x += 60) grass.push([x, ground + between(r, -4, 5)]);
  body += `<path d="${smooth(grass)} L${W + 40},${H + 20} L-40,${H + 20} Z" fill="#7cc06a"/>`;
  for (let i = 0; i < Math.max(2, Math.round(W / 500)); i++) {
    const bx = between(r, W * 0.2, W * 0.8);
    const by = between(r, 20, H * 0.3);
    body += `<path d="M${f(bx - 8)},${f(by)} q4,-5 8,0 q4,-5 8,0" fill="none" stroke="#5b6b7d" stroke-width="2" stroke-linecap="round"/>`;
  }
  return { defs, body, label: '向日葵' };
}

// 落葉
function mapleLeaf(x, y, s, rot, c) {
  // 從頂端開始，依 [半徑, 角度] 繞一圈；角度 0 在正上方，順時針
  const poly = [[0, -1]];
  const spec = [[0.42, 32], [0.85, 65], [0.36, 95], [0.62, 128], [0.24, 180], [0.62, 232], [0.36, 265], [0.85, 295], [0.42, 328]];
  for (const [rad, deg] of spec) {
    const a = (deg * Math.PI) / 180;
    poly.push([Math.sin(a) * rad, -Math.cos(a) * rad]);
  }
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${f(s)})">
    <path d="M0,0.2 L0,0.75" stroke="${mix(c, '#5a2a10', 0.35)}" stroke-width="0.07" stroke-linecap="round"/>
    <polygon points="${poly.map(([a, b]) => `${f(a * 100) / 100},${f(b * 100) / 100}`).join(' ')}" fill="${c}" stroke="${c}" stroke-width="0.08" stroke-linejoin="round"/>
    <path d="M0,0.2 L0,-0.75 M0,0 L0.6,-0.32 M0,0 L-0.6,-0.32 M0,0.1 L0.42,0.3 M0,0.1 L-0.42,0.3" stroke="${mix(c, '#ffffff', 0.35)}" stroke-width="0.04" stroke-linecap="round" fill="none"/>
  </g>`;
}

function ginkgoLeaf(x, y, s, rot) {
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${f(s)})">
    <path d="M0,0 L0,0.45" stroke="#c9a227" stroke-width="0.07" stroke-linecap="round"/>
    <path d="M0,0 C-0.25,-0.2 -0.8,-0.5 -0.62,-0.86 Q-0.3,-1.02 -0.05,-0.82 L0,-0.7 L0.05,-0.82 Q0.3,-1.02 0.62,-0.86 C0.8,-0.5 0.25,-0.2 0,0 Z" fill="#f6c945"/>
  </g>`;
}

function acorn(x, y, s, rot) {
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${f(s)})">
    <ellipse cx="0" cy="0.25" rx="0.42" ry="0.55" fill="#c98a4b"/><ellipse cx="-0.14" cy="0.15" rx="0.1" ry="0.22" fill="#e3b07a"/>
    <path d="M-0.55,-0.08 Q0,-0.55 0.55,-0.08 Q0,0.08 -0.55,-0.08 Z" fill="#7a4f2a"/>
    <path d="M0,-0.32 L0.08,-0.55" stroke="#7a4f2a" stroke-width="0.09" stroke-linecap="round"/>
  </g>`;
}

function autumnleaves(r, id, W, H) {
  const gap = 30;
  const defs = `<pattern id="${id}-p" width="${gap}" height="${gap}" patternUnits="userSpaceOnUse"><circle cx="${gap / 2}" cy="${gap / 2}" r="1.6" fill="#ecd7bd"/></pattern>`;
  let body = bg(W, H, '#fbf1e4') + bg(W, H, `url(#${id}-p)`);
  const colors = ['#e2562f', '#f08a3c', '#d9402b', '#f2a93b', '#b8452a'];
  const n = Math.round((W * H) / 7000);
  for (let i = 0; i < n; i++) {
    const x = ((i + r() * 0.9) / n) * W;
    const y = between(r, -10, H + 10);
    const k = r();
    if (k < 0.55) body += mapleLeaf(x, y, between(r, 20, 34), between(r, -50, 50), pick(r, colors));
    else if (k < 0.8) body += ginkgoLeaf(x, y, between(r, 22, 32), between(r, -60, 60));
    else if (k < 0.92) body += acorn(x, y, between(r, 18, 24), between(r, -30, 30));
    else body += `<g><circle cx="${f(x)}" cy="${f(y)}" r="6" fill="#d9402b"/><circle cx="${f(x + 10)}" cy="${f(y + 4)}" r="5.5" fill="#e2562f"/><path d="M${f(x)},${f(y - 6)} Q${f(x + 6)},${f(y - 16)} ${f(x + 10)},${f(y - 2)}" stroke="#7a4f2a" stroke-width="1.6" fill="none"/></g>`;
  }
  return { defs, body, label: '落葉' };
}

// 雪天
function snowman(x, base, s) {
  return `<g transform="translate(${f(x)} ${f(base)}) scale(${f(s)})">
    <ellipse cx="0" cy="2" rx="40" ry="7" fill="#c9d8ea" fill-opacity=".7"/>
    <circle cx="0" cy="-30" r="32" fill="#ffffff" stroke="#d6e2f0" stroke-width="2"/>
    <circle cx="0" cy="-82" r="23" fill="#ffffff" stroke="#d6e2f0" stroke-width="2"/>
    <path d="M-20,-50 Q0,-42 20,-50 L20,-58 Q0,-50 -20,-58 Z" fill="#e2564f"/>
    <path d="M12,-54 L22,-30 L14,-28 L6,-52 Z" fill="#e2564f"/>
    <circle cx="-8" cy="-88" r="2.6" fill="#34405a"/><circle cx="8" cy="-88" r="2.6" fill="#34405a"/>
    <path d="M0,-82 L16,-79 L0,-77 Z" fill="#ff9a3c"/>
    <circle cx="0" cy="-34" r="2.6" fill="#34405a"/><circle cx="0" cy="-22" r="2.6" fill="#34405a"/>
    <path d="M-30,-48 L-56,-64 M-46,-58 L-52,-70 M30,-48 L56,-62 M46,-56 L54,-68" stroke="#8a5a3c" stroke-width="3.4" stroke-linecap="round"/>
  </g>`;
}

function snowPine(x, base, h) {
  const w = h * 0.55;
  let s = `<rect x="${f(x - 4)}" y="${f(base - 10)}" width="8" height="12" fill="#6b4a36"/>`;
  for (let t = 0; t < 3; t++) {
    const top = base - h + t * h * 0.22;
    const bottom = base - 8 - (2 - t) * h * 0.18;
    const half = (w / 2) * (0.55 + t * 0.22);
    s += `<path d="M${f(x)},${f(top)} L${f(x + half)},${f(bottom)} L${f(x - half)},${f(bottom)} Z" fill="#3f7a6a"/>`;
    s += `<path d="M${f(x)},${f(top)} L${f(x + half * 0.45)},${f(top + (bottom - top) * 0.45)} Q${f(x)},${f(top + (bottom - top) * 0.55)} ${f(x - half * 0.45)},${f(top + (bottom - top) * 0.45)} Z" fill="#ffffff"/>`;
  }
  return s;
}

function snowday(r, id, W, H) {
  const knit = 26;
  const defs = `${vGradient(`${id}-sky`, [[0, '#d7e6f7'], [1, '#f7fafd']])}
    <pattern id="${id}-knit" width="${knit}" height="${knit}" patternUnits="userSpaceOnUse">
      <rect width="${knit}" height="${knit}" fill="#e2564f"/>
      <path d="M${knit / 2},4 L${knit - 4},${knit / 2} L${knit / 2},${knit - 4} L4,${knit / 2} Z" fill="#ffffff"/>
      <circle cx="${knit / 2}" cy="${knit / 2}" r="3" fill="#e2564f"/>
    </pattern>`;
  let body = bg(W, H, `url(#${id}-sky)`);
  const band = Math.min(26, H * 0.09);
  const far = [];
  for (let x = -60; x <= W + 60; x += 90) far.push([x, H * 0.62 + between(r, -16, 10)]);
  body += `<path d="${smooth(far)} L${W + 60},${H + 20} L-60,${H + 20} Z" fill="#eaf1fa"/>`;
  const n = Math.max(3, Math.round(W / 160));
  for (let i = 0; i < n; i++) body += snowPine(((i + 0.5 + between(r, -0.3, 0.3)) / n) * W, H * 0.66 + between(r, -6, 8), between(r, Math.min(60, H * 0.22), Math.min(100, H * 0.36)));
  const near = [];
  for (let x = -60; x <= W + 60; x += 80) near.push([x, H - band - between(r, 18, 34)]);
  body += `<path d="${smooth(near)} L${W + 60},${H + 20} L-60,${H + 20} Z" fill="#ffffff"/>`;
  const snowmen = Math.max(1, Math.round(W / 700));
  for (let i = 0; i < snowmen; i++) body += snowman(((i + 0.5) / snowmen) * W + between(r, -W * 0.15, W * 0.15), H - band - 18, Math.min(1, H / 300) * between(r, 0.8, 1));
  for (let i = 0; i < Math.round((W * H) / 1400); i++) body += `<circle cx="${f(r() * W)}" cy="${f(r() * (H - band))}" r="${f(between(r, 1, 3))}" fill="#ffffff" fill-opacity="${f(between(r, 0.6, 1))}"/>`;
  for (let i = 0; i < Math.round((W * H) / 26000); i++) body += snowflake(r() * W, r() * (H - band) * 0.7, between(r, 6, 11), 0.95).replace(/#ffffff/g, '#9cc0e8');
  body += `<rect x="-10" y="${f(H - band)}" width="${W + 20}" height="${f(band + 10)}" fill="url(#${id}-knit)"/><rect x="-10" y="${f(H - band)}" width="${W + 20}" height="3" fill="#34405a"/>`;
  return { defs, body, label: '雪天' };
}

const GENERATORS = {
  fields, coast, terraces, dunes, clouds, gingham, sprinkles, boba, dots, waves, lemons, stars,
  watermelon, oranges, cocoa, xmas, mushrooms, hibiscus, cottoncandy, waffle, rainbow, arches,
  sakura, sunflowers, autumnleaves, snowday,
};
const cache = new Map();

export function coverSVG(style = 'clouds', seed = 1, prefix = 'cv', { width = 1200, height = 300, tint = '' } = {}) {
  const key = `${style}:${seed}:${prefix}:${width}x${height}:${tint}`;
  if (cache.has(key)) return cache.get(key);
  const gen = GENERATORS[style] || clouds;
  const id = `${prefix}-${style}-${seed}-${tint}`.replace(/[^a-z0-9-]/gi, '');
  const { defs, body, label } = gen(makeRng(seed * 7919 + style.length * 104729), id, width, height, { tint });
  const svg = `<svg class="cover-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="封面：${label}"><defs>${defs}</defs>${body}</svg>`;
  cache.set(key, svg);
  if (cache.size > 120) cache.delete(cache.keys().next().value);
  return svg;
}

export function randomSeed() {
  return Math.floor(Math.random() * 1e9);
}
