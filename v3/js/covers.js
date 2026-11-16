// 封面：用程式畫出來的圖案。可愛系（雲朵、格紋、糖霜、珍奶）和空拍風景（農田、海灘、梯田、沙丘）。
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

const GENERATORS = { fields, coast, terraces, dunes, clouds, gingham, sprinkles, boba, dots, waves, lemons, stars };
const cache = new Map();

export function coverSVG(style = 'clouds', seed = 1, prefix = 'cv', { width = 1200, height = 300, tint = '' } = {}) {
  const key = `${style}:${seed}:${prefix}:${width}x${height}:${tint}`;
  if (cache.has(key)) return cache.get(key);
  const gen = GENERATORS[style] || clouds;
  const id = `${prefix}-${style}-${seed}-${tint}`.replace(/[^a-z0-9-]/gi, '');
  const { defs, body, label } = gen(makeRng(seed * 7919 + style.length * 104729), id, width, height, { tint });
  const svg = `<svg class="cover-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="封面：${label}"><defs>${defs}</defs>${body}</svg>`;
  cache.set(key, svg);
  if (cache.size > 40) cache.delete(cache.keys().next().value);
  return svg;
}

export function randomSeed() {
  return Math.floor(Math.random() * 1e9);
}
