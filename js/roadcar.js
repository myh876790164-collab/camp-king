// =============================================
//  公路求生：精细像素车辆（暖色沙漠末日风）
//  画法：先在一张「像素纸」上逐像素画好车身（渐变、锈斑抖点、深褐描边），存成图片缓存；
//  每帧只贴图 + 画会动的部分（轮子、尘土、司机），手机也流畅。
//  坐标：精细像素，x = 0 是车头，y = 0 是地面，向上为负（1 个世界像素 = RD_Q 个精细像素）
//  动画节奏：每秒 10 帧；行驶时车身每 2 帧颠 1 像素，轮子每帧转 1/4 格花纹，车尾尘土往后飘并变淡
// =============================================

// ---------- 调色板（暖色、描边用深褐不用纯黑） ----------
const RDC_PAL = {
  out: '#24160f', out2: '#5c3b26',                         // 描边：普通 / 朝上的亮边
  cream: ['#f6ead0', '#dccca4', '#bfa97e', '#8f7754', '#6a543a'], // 车漆：高光 亮 中 暗 最暗
  stripe: ['#f0a060', '#d9733a', '#b0522a', '#7a3418'],
  rust: ['#d08040', '#a85a2a', '#7a3a1c', '#4e2412'],
  metal: ['#d8d0c0', '#a09888', '#6e685e', '#48423a'],
  dark: ['#4a3a30', '#33271f', '#241a14'],
  glass: ['#e6efe4', '#93b8b4', '#5f8286', '#3a5056'],
  tire: ['#5e5048', '#40362f', '#2c241f', '#1b1511'],
  light: ['#fffbe0', '#ffe08a', '#e8a040'],
  tail: ['#ff7050', '#d03420', '#8a1e12'],
};
const RDC_CACHE = {};            // 缓存好的车身图片
let RDC_ANIM = { fr: -1, ph: 0 }; // 动画帧计数（轮子转动相位）

function rdcHex(c) { return parseInt(c.slice(1), 16); }
function rdcHash(x, y, s) { const v = Math.sin(x * 12.9898 + y * 78.233 + (s || 0) * 37.719) * 43758.5453; return v - Math.floor(v); }
function rdcNoise2(x, y, s) { // 平滑的二维噪声（用来画成片的锈斑）
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = rdcHash(xi, yi, s), b = rdcHash(xi + 1, yi, s), c = rdcHash(xi, yi + 1, s), d = rdcHash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// ---------- 像素纸：每个像素记颜色和「材质」（材质决定后面要不要生锈、描边颜色） ----------
// 材质：1 车漆 2 金属 3 玻璃 4 灯 5 轮胎 6 暗部 7 彩色条纹 8 描边
function rdcPaper(w, h, ox, oy) { return { w, h, ox, oy, c: new Int32Array(w * h).fill(-1), m: new Uint8Array(w * h) }; }
function rdcPix(B, x, y, col, mat) {
  const px = x + B.ox, py = y + B.oy;
  if (px < 0 || py < 0 || px >= B.w || py >= B.h) return;
  const i = py * B.w + px; B.c[i] = typeof col === 'number' ? col : rdcHex(col); B.m[i] = mat || 1;
}
function rdcGet(B, x, y) { const px = x + B.ox, py = y + B.oy; if (px < 0 || py < 0 || px >= B.w || py >= B.h) return -1; return B.c[py * B.w + px]; }
function rdcMat(B, x, y) { const px = x + B.ox, py = y + B.oy; if (px < 0 || py < 0 || px >= B.w || py >= B.h) return 0; return B.c[py * B.w + px] < 0 ? 0 : B.m[py * B.w + px]; }
function rdcRect(B, x, y, w, h, col, mat) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) rdcPix(B, x + i, y + j, col, mat); }
// 竖向渐变（ramp 从亮到暗），色带交界处用棋盘格抖点过渡
function rdcRampAt(ramp, t, x, y) {
  const v = t * (ramp.length - 1), i = Math.floor(v), f = v - i;
  const k = Math.min(ramp.length - 1, i + ((f > 0.66 || (f > 0.33 && ((x + y) & 1))) ? 1 : 0));
  return ramp[k];
}
// 多边形（扫描线填充）；ramp 为数组时按多边形的上下做渐变，t0/t1 控制渐变范围
function rdcPoly(B, pts, col, mat, t0, t1) {
  let y0 = 1e9, y1 = -1e9;
  for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const a = t0 == null ? 0 : t0, b = t1 == null ? 1 : t1;
  for (let y = Math.ceil(y0); y <= Math.floor(y1); y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      if ((p[1] <= y + 0.5 && q[1] > y + 0.5) || (q[1] <= y + 0.5 && p[1] > y + 0.5)) xs.push(p[0] + (y + 0.5 - p[1]) / (q[1] - p[1]) * (q[0] - p[0]));
    }
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) {
      const t = y1 > y0 ? a + (b - a) * (y - y0) / (y1 - y0) : a;
      rdcPix(B, x, y, Array.isArray(col) ? rdcRampAt(col, t, x, y) : col, mat);
    }
  }
}
function rdcBox(B, x, y, w, h, ramp, mat, t0, t1) { rdcPoly(B, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], ramp, mat, t0, t1); }
function rdcLine(B, x0, y0, x1, y1, col, mat) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (let n = 0; n < 400; n++) { rdcPix(B, x0, y0, col, mat); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}
// 铆钉：一个亮点 + 右下一个暗点
function rdcRivet(B, x, y) { rdcPix(B, x, y, RDC_PAL.metal[0], 2); rdcPix(B, x + 1, y + 1, RDC_PAL.metal[3], 2); }
// 面板接缝：一条暗线 + 旁边一条亮线（看起来是凹进去的缝）
function rdcSeamV(B, x, y0, y1) { for (let y = y0; y <= y1; y++) { if (rdcMat(B, x, y) === 1 || rdcMat(B, x, y) === 7) rdcPix(B, x, y, RDC_PAL.cream[4], 6); if (rdcMat(B, x + 1, y) === 1) rdcPix(B, x + 1, y, RDC_PAL.cream[0], 1); } }

// 锈斑、泥点、划痕：车漆上成片的锈（越靠下、越靠边越多）+ 零散的单像素
function rdcWeather(B, seed, amt, lowY) {
  if (lowY == null) lowY = -46; // 从这个高度往下开始容易生锈
  const P = RDC_PAL, n = B.w * B.h, snap = B.c.slice(), mats = B.m.slice();
  const empty = (px, py) => px < 0 || py < 0 || px >= B.w || py >= B.h || snap[py * B.w + px] < 0;
  for (let py = 0; py < B.h; py++) for (let px = 0; px < B.w; px++) {
    const i = py * B.w + px, mt = mats[i];
    if (snap[i] < 0 || (mt !== 1 && mt !== 7 && mt !== 2)) continue;
    const x = px - B.ox, y = py - B.oy;
    // 离边缘多近（2 像素内算边）
    let edge = 0;
    for (let d = 1; d <= 3 && !edge; d++) if (empty(px - d, py) || empty(px + d, py) || empty(px, py + d)) edge = 1 - (d - 1) / 3;
    const low = Math.max(0, Math.min(1, (y - lowY) / 30)); // 越靠近车底越容易锈
    const nz = rdcNoise2(x / 12, y / 8, seed) * 0.7 + rdcNoise2(x / 3, y / 3, seed + 3) * 0.3;
    const score = nz + low * 0.3 + edge * 0.2 + amt - (mt === 2 ? 0.05 : 0);
    const h1 = rdcHash(x, y, seed + 9);
    if (score > 1.02) B.c[i] = rdcHex(score > 1.16 ? P.rust[3] : score > 1.08 ? P.rust[2] : P.rust[1]);
    else if (score > 0.97 && ((x + y) & 1)) B.c[i] = rdcHex(P.rust[1]); // 锈斑边缘的抖点
    else if (score > 0.93 && h1 < 0.25) B.c[i] = rdcHex(P.rust[0]);
    else if (h1 < 0.006) B.c[i] = rdcHex(mt === 7 ? P.stripe[3] : P.cream[3]); // 泥点
    else if (h1 > 0.996 && mt === 1) B.c[i] = rdcHex(P.cream[0]); // 划痕亮点
    if (mt === 1 && low > 0.7 && rdcHash(x, y, seed + 5) < (low - 0.7) * 0.25) B.c[i] = rdcHex(P.rust[2]); // 车底溅的泥
  }
}
// 描边：形状外面一圈深褐色；朝上的边用浅一点的褐色（高光那一侧不压黑）
function rdcOutline(B) {
  const snap = B.c.slice(), W = B.w, H = B.h, o1 = rdcHex(RDC_PAL.out), o2 = rdcHex(RDC_PAL.out2);
  const f = (px, py) => px >= 0 && py >= 0 && px < W && py < H && snap[py * W + px] >= 0;
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const i = py * W + px;
    if (snap[i] >= 0) continue;
    const down = f(px, py + 1), side = f(px - 1, py) || f(px + 1, py), up = f(px, py - 1);
    if (!down && !side && !up) continue;
    B.c[i] = (down && !up && !side) ? o2 : o1; B.m[i] = 8;
  }
}
function rdcToCanvas(B) {
  const cv = createCanvas(B.w, B.h), g = cv.getContext('2d'), im = g.createImageData(B.w, B.h), d = im.data;
  const wcv = createCanvas(B.w, B.h), wg = wcv.getContext('2d'), wim = wg.createImageData(B.w, B.h), wd = wim.data;
  for (let i = 0; i < B.w * B.h; i++) {
    const c = B.c[i]; if (c < 0) continue;
    d[i * 4] = (c >> 16) & 255; d[i * 4 + 1] = (c >> 8) & 255; d[i * 4 + 2] = c & 255; d[i * 4 + 3] = 255;
    wd[i * 4] = 255; wd[i * 4 + 1] = 250; wd[i * 4 + 2] = 235; wd[i * 4 + 3] = 255;
  }
  g.putImageData(im, 0, 0); wg.putImageData(wim, 0, 0);
  return { cv, white: wcv, ox: B.ox, oy: B.oy };
}

// ---------- 快递车：参照真实的 4.2 米轻型厢式货车（平头驾驶室、车顶导流罩、货厢、侧防护栏、反光贴）----------
// 真实比例（按 6 米车长 ≈ 138 像素，1 米 ≈ 23 像素）：前悬 1 米，轴距 3.3 米，轮径约 0.9 米，
// 驾驶室高 2.5 米，货厢顶 3.4 米。末日改装：货厢上开了带铁丝网的小窗、伸出炉子烟囱、焊补丁板、钢管前护杠
// 尺寸：长 138（= 46 世界像素 × 3），货厢顶 y = -78，轮子圆心 x = -24 / -102，半径 11
const RDC_CARS = {
  courier: { wheels: [-24, -102], r: 11, dustX: -115, driver: [-23, -53], mesh: [-34, -55, -6, -40] },
};
function rdcBuildCourier() {
  const P = RDC_PAL, B = rdcPaper(176, 124, 156, 112);
  const C = P.cream, M = P.metal, D = P.dark, T = P.tire;
  const FX = -24, RX = -102, WR = 11; // 前轮、后轮、轮半径
  // —— 车架大梁（从车头到车尾的一根黑色长梁，货厢和驾驶室都坐在上面）
  rdcBox(B, -134, -25, 128, 7, [D[0], D[1], D[2]], 6);
  for (let x = -130; x < -46; x += 12) rdcRect(B, x, -26, 3, 2, D[1], 6); // 货厢底的横梁头
  // —— 货厢：上下铝边框、前后立柱，中间是蒙皮
  rdcBox(B, -138, -78, 95, 54, C, 1, 0.02, 1);
  rdcBox(B, -138, -78, 95, 3, [M[0], M[1], M[2]], 2);            // 顶边框
  rdcBox(B, -138, -29, 95, 4, [M[1], M[2], M[3]], 2);            // 底边框
  rdcBox(B, -138, -78, 3, 54, [M[1], M[2], M[3]], 2, 0, 0.6);    // 后立柱
  rdcBox(B, -46, -78, 3, 54, [M[1], M[2], M[3]], 2, 0, 0.6);     // 前立柱
  for (const y of [-72, -52, -34]) { rdcRect(B, -140, y, 3, 4, M[2], 2); rdcPix(B, -140, y, M[0], 2); } // 后门铰链
  // 货厢板缝（几块拼起来的板）
  for (const sx of [-113, -88, -66]) rdcSeamV(B, sx, -75, -30);
  // 顶部反光、腰线下阴影
  for (let x = -135; x < -46; x++) { if (rdcMat(B, x, -75) === 1) rdcPix(B, x, -75, C[0], 1); if ((x & 1) && rdcMat(B, x, -74) === 1) rdcPix(B, x, -74, C[0], 1); }
  // 橙色腰线 + 包裹标志
  rdcBox(B, -135, -49, 89, 6, P.stripe, 7, 0, 1);
  rdcLine(B, -135, -50, -47, -50, C[0], 1);
  for (let x = -135; x < -46; x++) { if (rdcMat(B, x, -43) === 1) rdcPix(B, x, -43, C[3], 1); if ((x & 1) && rdcMat(B, x, -42) === 1) rdcPix(B, x, -42, C[3], 1); }
  const lx = -96, ly = -70;
  rdcRect(B, lx, ly, 12, 1, P.stripe[2], 7); rdcRect(B, lx, ly + 10, 12, 1, P.stripe[2], 7); rdcRect(B, lx, ly, 1, 11, P.stripe[2], 7); rdcRect(B, lx + 11, ly, 1, 11, P.stripe[2], 7);
  rdcRect(B, lx + 5, ly, 2, 4, P.stripe[1], 7); rdcRect(B, lx + 1, ly + 1, 10, 1, P.stripe[0], 7);
  rdcRect(B, lx + 15, ly + 4, 12, 2, P.stripe[1], 7); for (let k = 0; k < 4; k++) rdcRect(B, lx + 25 + k, ly + 1 + k, 1, 8 - k * 2, P.stripe[1], 7);
  for (let k = 0; k < 6; k++) if (rdcHash(k, 3, 1) > 0.25) rdcRect(B, lx + k * 5, ly + 14, 3 + (k % 2), 2, C[3], 1); // 褪色的字
  // 反光贴（红白相间，真实货车都有）
  for (let x = -135; x < -46; x += 8) { rdcRect(B, x, -32, 4, 2, '#d8402a', 4); rdcRect(B, x + 4, -32, 4, 2, '#f4efe6', 4); }
  // 侧面示廓灯（琥珀色小灯）
  for (const x of [-128, -96, -62]) { rdcRect(B, x, -28, 2, 2, P.light[2], 4); rdcPix(B, x, -28, P.light[1], 4); }
  // 末日改装：货厢上开的小窗（焊了窗框和铁丝网，里面住人）
  const win = (x, y, w, h) => {
    rdcBox(B, x - 1, y - 1, w + 2, h + 2, [M[1], M[2], M[3]], 2);
    rdcBox(B, x, y, w, h, P.glass, 3, 0.15, 1);
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if ((xx - x) % 4 === 1 || (yy - y) % 4 === 1) rdcPix(B, xx, yy, (yy - y) % 4 === 1 ? M[2] : M[3], 2);
    rdcPix(B, x + 1, y + 1, P.glass[0], 3);
    rdcRivet(B, x - 1, y - 1); rdcRivet(B, x + w - 1, y - 1); rdcRivet(B, x - 1, y + h - 1); rdcRivet(B, x + w - 1, y + h - 1);
  };
  win(-130, -69, 13, 10); win(-62, -69, 11, 10);
  // 焊上去的补丁板
  const patch = (x, y, w, h) => { rdcBox(B, x, y, w, h, [P.rust[0], P.rust[1], P.rust[2]], 2); rdcRect(B, x, y, w, 1, M[1], 2); rdcRivet(B, x + 1, y + 2); rdcRivet(B, x + w - 3, y + 2); rdcRivet(B, x + 1, y + h - 3); rdcRivet(B, x + w - 3, y + h - 3); };
  patch(-123, -41, 14, 9); patch(-80, -40, 9, 8);
  // 货厢顶：一根炉子烟囱（车里住人生火做饭）
  rdcBox(B, -118, -87, 3, 9, [M[1], M[2], M[3]], 2); rdcRect(B, -120, -89, 7, 2, M[2], 2); rdcRect(B, -119, -90, 5, 1, M[1], 2);
  // —— 驾驶室（平头）：前脸微微后倾，前上角圆
  rdcPoly(B, [[-42, -58], [-6, -58], [-3, -56], [-1, -52], [0, -20], [0, -18], [-42, -18]], C, 1, 0.02, 1);
  rdcRect(B, -41, -58, 34, 1, C[0], 1);
  // 前脸侧边（往后倾斜的那一窄条，暗一点）
  for (let y = -55; y < -20; y++) { const x = Math.round(-2 + (y + 55) * 0.06) - 1; rdcPix(B, x, y, C[2], 1); }
  // 车顶导流罩：从驾驶室顶斜着升到货厢顶
  rdcPoly(B, [[-42, -78], [-36, -78], [-14, -60], [-8, -58], [-42, -58]], C, 1, 0, 0.8);
  rdcLine(B, -36, -78, -14, -60, C[0], 1); rdcLine(B, -35, -78, -13, -60, C[0], 1); rdcLine(B, -14, -60, -8, -58, C[0], 1);
  rdcLine(B, -41, -59, -9, -59, C[3], 1); // 导流罩和驾驶室的接缝
  // 车门：门缝、车窗、门把手
  rdcSeamV(B, -38, -56, -22); rdcSeamV(B, -5, -50, -28);
  rdcPoly(B, [[-34, -55], [-9, -55], [-6, -50], [-6, -40], [-34, -40]], P.glass, 3, 0.05, 1);
  rdcRect(B, -35, -56, 30, 1, C[3], 1); rdcRect(B, -35, -39, 30, 1, C[0], 1);
  for (let k = 0; k < 5; k++) rdcLine(B, -30 + k * 3, -54, -34 + k * 3, -48, P.glass[0], 3); // 玻璃反光
  rdcRect(B, -31, -36, 5, 2, M[2], 2); rdcRect(B, -31, -36, 5, 1, M[0], 2);
  // 驾驶室后面的一小块侧窗
  rdcBox(B, -40, -54, 3, 10, [P.glass[2], P.glass[3]], 3);
  // 大后视镜（货车那种长杆镜）
  rdcLine(B, -6, -46, 2, -49, M[3], 2); rdcLine(B, -6, -47, 2, -50, M[2], 2);
  rdcBox(B, 1, -59, 4, 14, [M[2], M[3], D[1]], 2); rdcRect(B, 2, -57, 2, 9, P.glass[2], 3); rdcPix(B, 2, -57, P.glass[0], 3);
  // 前保险杠、大灯、转向灯
  rdcBox(B, -6, -24, 9, 6, [M[1], M[2], M[3]], 2); rdcRect(B, -6, -24, 9, 1, M[0], 2);
  rdcBox(B, -3, -29, 3, 5, [P.light[0], P.light[1], P.light[2]], 4); rdcPix(B, -2, -28, '#ffffff', 4);
  rdcRect(B, -3, -31, 3, 2, P.light[2], 4);
  // 上车踏板（前轮前面）
  rdcBox(B, -9, -21, 6, 2, [M[1], M[3]], 2);
  // 车门上的橙色线（接货厢的腰线）
  rdcBox(B, -42, -35, 36, 3, P.stripe, 7, 0, 1);
  patch(-39, -31, 8, 7);
  // —— 轮拱：前轮挖进驾驶室，后轮上面是挡泥瓦
  for (let y = -30; y <= -18; y++) for (let x = FX - 17; x <= FX + 17; x++) {
    const d = Math.hypot(x - FX, y + WR);
    if (d <= WR + 3.5 && rdcMat(B, x, y)) rdcPix(B, x, y, d > WR + 2 ? D[0] : D[2], 6);
    else if (d <= WR + 5.5 && (rdcMat(B, x, y) === 1 || rdcMat(B, x, y) === 7 || rdcMat(B, x, y) === 2)) rdcPix(B, x, y, d < WR + 4.5 ? C[3] : C[0], 1);
  }
  for (let y = -30; y <= -11; y++) for (let x = RX - 17; x <= RX + 17; x++) {
    const d = Math.hypot(x - RX, y + WR);
    if (d > WR + 2.5 && d <= WR + 5 && y <= -11) rdcPix(B, x, y, d > WR + 4 ? T[0] : T[2], 5);
    else if (d <= WR + 2.5 && rdcMat(B, x, y)) rdcPix(B, x, y, D[2], 6);
  }
  // 挡泥皮
  rdcBox(B, RX - 18, -14, 3, 11, [T[1], T[2], T[3]], 5); rdcBox(B, FX - 17, -18, 2, 8, [T[1], T[2], T[3]], 5);
  // 侧防护栏（两根横杆，真实货车两轮之间都有）+ 支架
  for (const y of [-17, -11]) rdcBox(B, -84, y, 44, 3, [M[0], M[1], M[2]], 2);
  for (const x of [-80, -60, -45]) rdcRect(B, x, -18, 2, 10, M[3], 2);
  // 油箱（挂在大梁上，铝的）
  rdcBox(B, -72, -20, 16, 12, [M[0], M[1], M[2], M[3]], 2); rdcRect(B, -70, -21, 3, 1, M[3], 2);
  // 排气管
  rdcBox(B, -90, -16, 6, 3, [M[2], M[3]], 2); rdcPix(B, -91, -15, D[2], 6);
  // 后防撞架 + 尾灯
  rdcRect(B, -134, -18, 2, 8, M[3], 2); rdcBox(B, -139, -11, 12, 3, [M[1], M[2], M[3]], 2);
  rdcBox(B, -140, -22, 4, 4, P.tail, 4); rdcPix(B, -139, -21, '#ffc0a0', 4);
  // 车尘、锈斑、泥点
  rdcWeather(B, 7, 0, -36);
  // —— 前护杠（焊的钢管，生锈）：画在锈之后，自己单独做旧
  rdcBox(B, 3, -44, 3, 26, [M[0], M[1], M[2]], 2); rdcRect(B, 0, -38, 4, 2, M[2], 2); rdcRect(B, 0, -26, 4, 2, M[2], 2);
  for (const [x, y, k] of [[4, -42, 1], [4, -35, 2], [5, -30, 1], [3, -21, 2]]) rdcPix(B, x, y, P.rust[k], 2);
  rdcOutline(B);
  return rdcToCanvas(B);
}

// ---------- 轮子：静态部分（轮胎、轮毂的明暗）缓存，转动的花纹每帧画 ----------
function rdcWheelDisc(r) {
  const key = 'wheel' + r;
  if (RDC_CACHE[key]) return RDC_CACHE[key];
  const P = RDC_PAL, s = r * 2 + 3, B = rdcPaper(s, s, r + 1, r + 1);
  for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
    const d = Math.hypot(x, y), lit = (-x - y) / (d || 1); // 左上亮
    if (d > r + 0.5) continue;
    let col;
    if (d > r - 0.5) col = P.out;
    else if (d > r * 0.62) { const t = 0.35 - lit * 0.35 + (d > r - 2 ? 0.2 : 0); col = rdcRampAt(P.tire, Math.max(0, Math.min(1, t)), x, y); }
    else if (d > r * 0.55) col = P.tire[3];
    else if (d > r * 0.24) { const t = 0.4 - lit * 0.4 + (d > r * 0.46 ? 0.25 : 0); col = rdcRampAt(P.metal, Math.max(0, Math.min(1, t)), x, y); }
    else if (d > r * 0.14) col = P.metal[3];
    else col = P.metal[1];
    rdcPix(B, x, y, col, 5);
  }
  // 轮毂下半边的尘土泥点
  for (let k = 0; k < 14; k++) { const a = 0.3 + rdcHash(k, 0, 2) * 2.5, d = r * (0.3 + rdcHash(k, 1, 2) * 0.6); rdcPix(B, Math.round(Math.cos(a) * d), Math.round(Math.sin(a) * d), k % 3 ? '#8a6a48' : '#a88458', 5); }
  rdcPix(B, -Math.round(r * 0.35), -Math.round(r * 0.35), '#f0e8d8', 2);
  return (RDC_CACHE[key] = rdcToCanvas(B));
}
// cx, cy：轮心（屏幕上的精细像素）；ph：转动相位（每帧 +1 = 转 1/4 格花纹）
function rdcDrawWheel(g, cx, cy, r, ph) {
  const d = rdcWheelDisc(r), P = RDC_PAL;
  g.drawImage(d.cv, cx - d.ox, cy - d.oy);
  const N = 16, step = Math.PI * 2 / N, a0 = ph * step / 4;
  // 轮胎花纹：外圈一格一格的凹槽
  for (let k = 0; k < N; k++) {
    const a = a0 + k * step, ca = Math.cos(a), sa = Math.sin(a);
    g.fillStyle = P.tire[3]; g.fillRect(Math.round(cx + ca * (r - 1.6) - 0.5), Math.round(cy + sa * (r - 1.6) - 0.5), 1, 1);
    g.fillRect(Math.round(cx + ca * (r - 2.8) - 0.5), Math.round(cy + sa * (r - 2.8) - 0.5), 1, 1);
    if (sa < -0.2 && ca < 0.5) { g.fillStyle = P.tire[0]; g.fillRect(Math.round(cx + Math.cos(a + step / 2) * (r - 2) - 0.5), Math.round(cy + Math.sin(a + step / 2) * (r - 2) - 0.5), 1, 1); }
  }
  // 轮毂上 5 颗螺栓 + 辐条暗缝
  for (let k = 0; k < 5; k++) {
    const a = a0 + k * Math.PI * 2 / 5, ca = Math.cos(a), sa = Math.sin(a);
    g.fillStyle = P.metal[3]; g.fillRect(Math.round(cx + ca * r * 0.4 - 0.5), Math.round(cy + sa * r * 0.4 - 0.5), 1, 1);
    g.fillStyle = P.metal[0]; g.fillRect(Math.round(cx + ca * r * 0.3 - 0.5), Math.round(cy + sa * r * 0.3 - 0.5), 1, 1);
  }
}

// ---------- 尘土：车尾每帧冒一团，往后飘、变小、变淡（2~3 种土色的小方块） ----------
function rdcDust(g, x, y, fr, ground, big) {
  const lt = rdShade(ground, 0.28), md = rdShade(ground, 0.05), dk = rdShade(ground, -0.28);
  const life = big ? 8 : 6;
  for (let age = 0; age < life; age++) {
    const id = fr - age, h = rdcHash(id, 0, 11), h2 = rdcHash(id, 1, 11);
    const px = Math.round(x - 4 - age * (7 + h * 3)), py = Math.round(y - 1 - age * (0.8 + h2) - h * 2);
    const s = Math.max(1, Math.round((big ? 4 : 3) + age * 0.35 - (age > life - 3 ? (age - life + 3) * 1.2 : 0) + h * 1.5));
    g.globalAlpha = Math.max(0, 0.75 - age / life * 0.7);
    rdcBlob(g, px, py - s, s, md);
    rdcBlob(g, px - 1 - (s >> 2), py - s - (s >> 2), Math.max(1, Math.round(s * 0.55)), lt);
    g.fillStyle = dk; g.fillRect(px - (s >> 1), py, Math.max(1, s), 1);
    // 散开的单像素颗粒
    for (let k = 0; k < 5; k++) { const hh = rdcHash(id, k + 2, 11); g.fillStyle = k & 1 ? dk : lt; g.fillRect(px - s - 1 - Math.round(hh * s * 3), py - Math.round(rdcHash(id, k + 7, 11) * s * 2.5), 1, 1); }
  }
  g.globalAlpha = 1;
}

// 圆圆的一团（逐行画，像素边缘）
function rdcBlob(g, cx, cy, r, col) {
  g.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) { const hw = Math.round(Math.sqrt(r * r - dy * dy) * 1.25); if (hw > 0) g.fillRect(cx - hw, cy + dy, hw * 2, 1); }
}
// ---------- 画一辆精细车（目前只有快递车）；x, y 是世界像素的车头/地面；返回车身颠簸（精细像素） ----------
function rdcHasCar(veh) { return veh === 'courier'; }
function rdcDrawCar(g, x, y, o) {
  const R = G.road, Q = RD_Q;
  const key = R.veh;
  if (!RDC_CACHE[key]) RDC_CACHE[key] = rdcBuildCourier();
  const car = RDC_CACHE[key], cf = RDC_CARS[key];
  // 10 帧/秒的动画帧
  const fr = Math.floor(G.time * 10);
  if (fr !== RDC_ANIM.fr) { if (o.moving) RDC_ANIM.ph++; RDC_ANIM.fr = fr; }
  const bob = o.moving && ((fr >> 1) & 1) ? -1 : 0; // 每 2 帧颠 1 像素
  const X = Math.round(x * Q), Y = Math.round(y * Q);
  const baseA = g.globalAlpha;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  // 阴影：车底一条暗影，两头淡
  g.globalAlpha = baseA * 0.35; g.fillStyle = '#2a1a10';
  g.fillRect(X - 140, Y - 1, 136, 3); g.fillRect(X - 146, Y, 148, 2);
  g.globalAlpha = baseA;
  // 轮子（不跟车身颠）
  if (o.wheels) for (const wx of cf.wheels) rdcDrawWheel(g, X + wx, Y - cf.r, cf.r, RDC_ANIM.ph);
  // 车身
  g.drawImage(car.cv, X - car.ox, Y - car.oy + bob);
  if (o.hit) { g.globalAlpha = baseA * 0.55; g.drawImage(car.white, X - car.ox, Y - car.oy + bob); g.globalAlpha = baseA; }
  // 司机：侧窗里的头（用玩家设置的发色肤色）
  if (o.driver) {
    const AL = avLook(), hx = X + cf.driver[0], hy = Y + cf.driver[1] + bob;
    g.fillStyle = RDC_PAL.out; g.fillRect(hx - 1, hy - 1, 9, 13);
    g.fillStyle = AV_SKIN[AL.skin]; g.fillRect(hx, hy + 3, 7, 7);
    g.fillStyle = rdShade(AV_SKIN[AL.skin], -0.25); g.fillRect(hx, hy + 8, 7, 2); g.fillRect(hx + 6, hy + 3, 1, 5);
    g.fillStyle = AL.hc; g.fillRect(hx, hy, 7, 4); g.fillRect(hx, hy + 4, 2, 3);
    g.fillStyle = RDC_PAL.out; g.fillRect(hx + 5, hy + 5, 1, 1);
    g.fillStyle = RDC_PAL.metal[3]; g.fillRect(hx - 1, hy + 11, 9, 2); // 座椅肩部
    // 玻璃反光盖在头上（半透明）
    g.fillStyle = RDC_PAL.glass[0]; g.globalAlpha = baseA * 0.55;
    for (let k = 0; k < 5; k++) { const lx = X - 30 + k * 3; for (let t = 0; t < 6; t++) { const px = lx - Math.round(t * 4 / 6), py = Y - 54 + bob + t; if (px >= hx - 1 && px <= hx + 7 && py >= hy - 1 && py <= hy + 12) g.fillRect(px, py, 1, 1); } }
    g.globalAlpha = baseA;
  }
  // 尘土
  if (o.moving && o.dust) rdcDust(g, X + cf.dustX, Y, fr, o.ground || '#c99464', o.fast);
  g.restore();
  return bob;
}
