// =============================================
//  丧尸末世：地图和建筑换成公路求生的画风（暖色、晒褪色的末日风）
//  公路求生的画风要点（js/roadcar.js、js/roadscape.js）：
//    · 暖色、偏灰的调色板：冷灰蓝 → 暖灰褐，鲜艳的蓝绿红 → 褪色的青灰 / 橄榄 / 砖红
//    · 光从左上来：亮部偏暖黄、暗部偏冷紫（色相偏移），整块有体积感，用棋盘格抖点过渡
//    · 描边用深褐色而不是死黑；描边颜色取贴着它那块颜色的深色版本，顶边偏亮
//    · 做旧：成片的锈斑、泥污、雨水冲出的竖条污痕，越靠下越多；零星的划痕亮点
//  做法：原来的地图、建筑、街景小物件、树木、营地建筑照常画好，再逐像素「重画」一遍成上面的风格，
//        结果缓存起来（每张图只处理一次），每帧只贴图。
//  只在丧尸末世里生效，其他模式的画面不变。名字统一用 zst / ZST_ 前缀
// =============================================

function zstC(h) { return parseInt(h.slice(1), 16); }
// 暖色中性灰的色带（从最暗到最亮），冷灰蓝都换到这条带上
const ZST_GREY = ['#140e0c', '#24160f', '#33271f', '#4a3a30', '#6e685e', '#a09888', '#d8d0c0', '#f6ead0', '#fffbe0'].map((h) => { const c = zstC(h); return [c >> 16, (c >> 8) & 255, c & 255]; });
const ZST_HI = [255, 242, 196], ZST_SH = [46, 28, 58]; // 暖高光、冷阴影（和 rdcPolish 一样）
const ZST_OUT = [36, 22, 15];                           // 描边深褐
// 鲜艳的原色 → 公路风的褪色版本（只换「接近」这些颜色的像素，保留原来的细微差别）
const ZST_KEYS = [
  ['#1a1c2c', '#24160f'], ['#11131f', '#1b1511'],
  ['#2b3a6b', '#3a5056'], ['#4f6db0', '#6a908e'], ['#41579a', '#4c6a6e'], ['#5a6f9a', '#5f8286'], ['#29366f', '#3a4048'], ['#3b5dc9', '#4c7478'],
  ['#41a6f6', '#6a9ea0'], ['#73eff7', '#93c8bc'], ['#a9c4f0', '#a8c4bc'], ['#257179', '#466c62'],
  ['#b13e53', '#a8442e'], ['#8f2f2a', '#8a3420'], ['#ef7d57', '#d9733a'], ['#ffcd75', '#f0c070'], ['#d9a441', '#e8a040'], ['#c9a23a', '#d8b860'],
  ['#38b764', '#7c8050'], ['#5aa04c', '#8a9a50'], ['#a7f070', '#b4bc6c'], ['#38704a', '#58603a'], ['#2f5a3c', '#48502e'], ['#3b8f4a', '#66783c'],
  ['#1f5e3a', '#3c4a28'], ['#8db36b', '#a2a26c'], ['#5a7a45', '#6e7444'], ['#4a8c3f', '#7a7a4a'], ['#3c7434', '#666a42'],
  ['#5d275d', '#5e3c44'], ['#9a4fb0', '#8a5c74'], ['#b06cd0', '#a06a88'],
].map(([a, b]) => { const x = zstC(a), y = zstC(b); return [x >> 16, (x >> 8) & 255, x & 255, y >> 16, (y >> 8) & 255, y & 255]; });
const ZST_MEMO = new Map();

// 一个颜色 → 公路风颜色（结果按颜色缓存）
function zstGrade(r, g, b) {
  const key = (r << 16) | (g << 8) | b, hit = ZST_MEMO.get(key);
  if (hit !== undefined) return hit;
  let best = 1e9, bk = null;
  for (const k of ZST_KEYS) { const d = (r - k[0]) ** 2 + (g - k[1]) ** 2 + (b - k[2]) ** 2; if (d < best) { best = d; bk = k; } }
  let o;
  if (bk && best < 14 * 14 * 3) { // 很接近某个原色：换成对应的褪色色，保留差值（范围太大会把灰蓝沥青当成玻璃）
    o = [bk[3] + (r - bk[0]) * 0.7, bk[4] + (g - bk[1]) * 0.7, bk[5] + (b - bk[2]) * 0.7];
  } else {
    const L = 0.3 * r + 0.59 * g + 0.11 * b, cr = r - L, cg = g - L, cb = b - L, chroma = Math.hypot(cr, cg, cb);
    if (chroma < 42 || (cb > cr && chroma < 70)) { // 灰色 / 灰蓝：换到暖灰色带上，只留一点点原来的色彩
      const v = Math.max(0, Math.min(ZST_GREY.length - 1.001, L / 255 * (ZST_GREY.length - 1) * 1.02)), i = Math.floor(v), f = v - i, A = ZST_GREY[i], B = ZST_GREY[i + 1];
      o = [A[0] + (B[0] - A[0]) * f + cr * 0.25, A[1] + (B[1] - A[1]) * f + cg * 0.25, A[2] + (B[2] - A[2]) * f + cb * 0.15];
    } else if (b >= r && b >= g) { // 鲜蓝：公路风里几乎没有，褪成偏青的灰蓝
      o = [L + cr * 0.45, L + cg * 0.45 + 6, (L + cb * 0.45) * 0.92];
    } else { // 有颜色的：降低一点饱和度 + 晒褪色的暖调
      o = [(L + cr * 0.72) * 1.04, (L + cg * 0.72) * 1.0, (L + cb * 0.6) * 0.88];
    }
    // 色相偏移：亮的偏暖黄，暗的偏冷紫
    const L2 = (0.3 * o[0] + 0.59 * o[1] + 0.11 * o[2]) / 255;
    if (L2 > 0.62) o = zstMix(o, ZST_HI, (L2 - 0.62) * 0.3);
    else if (L2 < 0.32) o = zstMix(o, ZST_SH, (0.32 - L2) * 0.45);
  }
  o = [Math.max(0, Math.min(255, Math.round(o[0]))), Math.max(0, Math.min(255, Math.round(o[1]))), Math.max(0, Math.min(255, Math.round(o[2])))];
  if (ZST_MEMO.size > 200000) ZST_MEMO.clear();
  ZST_MEMO.set(key, o);
  return o;
}
function zstMix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
// 画的时候直接用的颜色（栅栏、门垫之类每帧画的东西）
const ZST_HEX = {};
function zstHex(h) {
  if (G.mode !== 'zombie' || h[0] !== '#') return h;
  if (ZST_HEX[h]) return ZST_HEX[h];
  const c = zstC(h), o = zstGrade(c >> 16, (c >> 8) & 255, c & 255);
  return (ZST_HEX[h] = '#' + ((1 << 24) | (o[0] << 16) | (o[1] << 8) | o[2]).toString(16).slice(1));
}
function zstHash(x, y, s) { const v = Math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453; return v - Math.floor(v); }

// ---------- 把一张图重画成公路风 ----------
// o.weather：做旧程度（0 = 不做旧，建筑约 0.1）；o.polish：体积光；o.outline：深褐彩色描边；o.seed：做旧花纹
function zstStyle(src, o) {
  o = o || {};
  const W = src.width, H = src.height, cv = createCanvas(W, H), g = cv.getContext('2d');
  g.drawImage(src, 0, 0);
  const im = g.getImageData(0, 0, W, H), d = im.data, N = W * H, seed = o.seed || 1;
  const A = new Uint8Array(N); for (let i = 0; i < N; i++) A[i] = d[i * 4 + 3] > 40 ? 1 : 0;
  const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && A[y * W + x] === 1;
  // 1) 换颜色
  const dark = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (!d[i * 4 + 3]) continue;
    const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2];
    if (r + gg + b < 110 && Math.max(r, gg, b) - Math.min(r, gg, b) < 40) dark[i] = 1; // 原来的黑色描边 / 线条
    const c = zstGrade(r, gg, b);
    d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2];
  }
  // 每一列从上到下连着的一段：算出每个像素在这一段里的上下位置（体积光用）
  const tv = new Float32Array(N);
  if (o.polish) for (let x = 0; x < W; x++) for (let y = 0; y < H;) {
    if (!A[y * W + x]) { y++; continue; }
    let e = y; while (e < H && A[e * W + x]) e++;
    for (let k = y; k < e; k++) tv[k * W + x] = e - y > 1 ? (k - y) / (e - y - 1) : 0.5;
    y = e;
  }
  const snap = d.slice(), px = (i) => [snap[i * 4], snap[i * 4 + 1], snap[i * 4 + 2]];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!A[i]) continue;
    let c = px(i);
    const edge = !solid(x, y - 1) || !solid(x, y + 1) || !solid(x - 1, y) || !solid(x + 1, y);
    if (o.outline && dark[i] && edge) { // 2) 彩色描边：取里面那块颜色的深色版本
      const up = solid(x, y - 1), dn = solid(x, y + 1);
      let nb = null;
      for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) { const j = (y + dy) * W + x + dx; if (solid(x + dx, y + dy) && !dark[j]) { nb = px(j); break; } }
      c = !up && dn ? zstMix(ZST_OUT, nb || ZST_OUT, 0.42) : up && !dn ? ZST_OUT : zstMix(ZST_OUT, nb || ZST_OUT, 0.22);
    } else if (!dark[i]) {
      const chk = ((x + y) & 1) ? 0.04 : -0.04;
      // 3) 体积光：上部偏暖亮、下部越往下越冷暗（抖点过渡）
      if (o.polish) {
        const t = tv[i];
        if (t < 0.3) c = zstMix(c, ZST_HI, Math.max(0, (0.3 - t + chk) * 0.3 * o.polish));
        else if (t > 0.62) c = zstMix(c, ZST_SH, Math.max(0, (t - 0.62 + chk) * 0.45 * o.polish));
        if (!solid(x, y - 1)) c = zstMix(c, ZST_HI, 0.22 * o.polish);      // 顶边轮廓光
        else if (!solid(x, y + 1)) c = zstMix(c, ZST_SH, 0.25 * o.polish); // 底边压暗
      }
      // 4) 做旧：成片的锈斑 / 泥污（越靠下越多）、雨水冲出的竖条污痕、零星的划痕亮点
      if (o.weather) {
        const low = y / H, sc = (o.scale || 1);
        const nz = rdpxN2(x / (12 * sc) + seed, y / (8 * sc)) * 0.7 + rdpxN2(x / (3 * sc), y / (3 * sc) + seed * 3) * 0.3;
        const score = nz + low * 0.3 + o.weather, h1 = zstHash(x, y, seed);
        if (score > 1.08) c = zstMix(c, score > 1.18 ? [78, 36, 18] : [122, 58, 28], 0.42);       // 锈斑
        else if (score > 1.02 && ((x + y) & 1)) c = zstMix(c, [168, 90, 42], 0.3);                 // 锈斑边缘的抖点
        else if (score > 0.96 && h1 < 0.3) c = zstMix(c, [74, 58, 42], 0.22);                      // 泥污
        const col = Math.floor(x / (2 * sc)), sx = zstHash(col, 7, seed);                          // 竖条污痕：某些列从上往下淌
        if (sx < 0.06 && low > zstHash(col, 3, seed) * 0.6 && ((y >> 1) + col) % 5 !== 0) c = zstMix(c, [58, 42, 32], 0.18);
        if (h1 > 0.997) c = zstMix(c, ZST_HI, 0.5);
      }
    }
    d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2];
  }
  g.putImageData(im, 0, 0);
  return cv;
}

// ---------- 精灵（树、车、营地建筑、墙）：{ img, flip, white } → 公路风版本（缓存在精灵上） ----------
function zstSpr(spr) {
  if (!spr || G.mode !== 'zombie') return spr;
  if (spr._zst) return spr._zst;
  const img = zstStyle(spr.img, { outline: 1, polish: 0.8, weather: 0.02, seed: 3, scale: 0.5 });
  let flip = img;
  if (spr.flip !== spr.img) { flip = createCanvas(img.width, img.height); const f = flip.getContext('2d'); f.translate(img.width, 0); f.scale(-1, 1); f.drawImage(img, 0, 0); }
  return (spr._zst = Object.assign({}, spr, { img, flip }));
}
// 城市建筑、街景小物件（已经是画布）
function zstCanvas(cv, seed, weather) {
  return zstStyle(cv, { outline: 1, polish: 1, weather: weather == null ? 0.1 : weather, seed: seed || 1 });
}

// ---------- 地面：整张地图重新调色 + 风沙 ----------
// 风吹来的沙土成片盖在路面、人行道和草地上（抖点边缘），路面上多几道干裂
function zstGround(cv) {
  // 整张图有一千万个像素：噪声按 4×4 小块算一次，颜色换算按「上一个像素同色就直接用」加速
  const W = cv.width, H = cv.height, g = cv.getContext('2d'), im = g.getImageData(0, 0, W, H), d = im.data;
  const DUST = [200, 168, 112], BW = (W >> 2) + 1, BH = (H >> 2) + 1, NB = new Float32Array(BW * BH);
  for (let by = 0; by < BH; by++) for (let bx = 0; bx < BW; bx++) NB[by * BW + bx] = rdpxN2(bx / 18, by / 18) * 0.65 + rdpxN2(bx / 4.5 + 9, by / 4.5) * 0.35;
  let lastK = -1, lastC = null;
  for (let y = 0; y < H; y++) {
    const row = (y >> 2) * BW;
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4, k = (d[o] << 16) | (d[o + 1] << 8) | d[o + 2];
      if (k !== lastK) { lastK = k; lastC = zstGrade(d[o], d[o + 1], d[o + 2]); }
      let r = lastC[0], gg = lastC[1], b = lastC[2];
      const n = NB[row + (x >> 2)];
      if (n > 0.64) { // 风吹来的沙土：一片片盖上去，边缘用抖点
        const t = Math.min(0.24, (n - 0.64) * 1.6) * (RDPX_BAYER[(y & 3) * 4 + (x & 3)] < 11 ? 1 : 0.35);
        r += (DUST[0] - r) * t; gg += (DUST[1] - gg) * t; b += (DUST[2] - b) * t;
      }
      if ((((x * 374761393) ^ (y * 668265263)) >>> 0) % 997 === 0) { r += (255 - r) * 0.3; gg += (242 - gg) * 0.3; b += (196 - b) * 0.3; } // 小石子反光
      d[o] = r; d[o + 1] = gg; d[o + 2] = b;
    }
  }
  g.putImageData(im, 0, 0);
}
// 丧尸末世的地面底色（暖色、干枯）
const ZST_GROUND = {
  [TER.GRASS]: ['#76764c', '#686a42', '#848252'],  // 枯黄的杂草地
  [TER.DIRT]: ['#8a7252', '#7c6648', '#98805e'],
  [TER.SAND]: ['#d8b888', '#c09c6a', '#e8cca0'],
  [TER.ROAD]: ['#5a5450', '#4a4442', '#6a6460'],   // 晒白的旧沥青
  [TER.PAVE]: ['#a49a88', '#908676', '#b4aa98'],   // 水泥人行道
  [TER.LOT]: ['#7a756c', '#6a655e', '#8a8478'],
  [TER.WATER]: ['#4e6a64', '#36484a', '#6e8a7c'],  // 浑浊的河水
};
