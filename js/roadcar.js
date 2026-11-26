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
  olive: ['#c8c492', '#a2a26c', '#7c8050', '#585c3a', '#3c3f27'],  // 垃圾车：晒褪色的橄榄绿
  hazard: ['#f0b048', '#d08a2a', '#2e2016'],                        // 警示斜纹：琥珀黄 / 深褐
  beacon: ['#fff4c0', '#ffc040', '#e07a1a', '#8a4012'],             // 警示灯
  bike: ['#b4ccd2', '#86a6b2', '#60808e', '#445e6a', '#2e3f48'],    // 电单车：晒褪色的钢蓝
  leather: ['#7a5640', '#5e3e2c', '#44291c', '#2e1a12'],            // 坐垫皮革
  crate: ['#b08a5e', '#8c6a44', '#6a4e30', '#4a3420'],              // 木箱
  canvas: ['#dcc690', '#bca06a', '#98804e', '#725a36', '#4e3c24'],  // 帐篷帆布
  fire: ['#fff8d8', '#ffd860', '#f08a30', '#c03a1c', '#6a1e10'],    // 火焰：白 → 黄 → 橙 → 红
  brick: ['#dca088', '#bc705c', '#985040', '#6e352a', '#4a221c'],   // 皮卡：晒褪色的砖红
  rose: ['#f2d4c8', '#dcaaa4', '#b88488', '#8a5c64', '#5e3c44'],    // 冰淇淋车：晒褪色的粉
  mint: ['#c4e4d0', '#94c4b0', '#68988a', '#466c62'],               // 薄荷绿条纹
  waffle: ['#f0c888', '#d4a05c', '#a87438', '#7a4e24'],             // 蛋筒
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
  t = t > 1 ? 1 : t > 0 ? t : 0; // 超出范围时取两头的颜色
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
// len：车长（阴影用）；bob：每帧的颠簸（10 帧/秒循环）；glint：车窗反光起点；beacons：警示灯；stack：竖排气管口；roof：车顶高度（世界像素）
const RDC_CARS = {
  courier: { build: () => rdcBuildCourier(), wheels: [-24, -102], r: 11, dustX: -115, driver: [-23, -53], glint: [-30, -54], len: 142, bob: [0, 0, -1, -1] },
  garbage: { build: () => rdcBuildGarbage(), wheels: [-20, -112, -138], r: 12, dustX: -150, driver: [-24, -61], glint: [-30, -63], len: 172, heavy: true,
    bob: [0, 0, -1, -1, -2, -2, -1, 0], beacons: [[-30, -77], [-153, -97]], stack: [-48, -101], roof: -29 },
  // 电单车：骑手每帧画（rider），轮子是细辐条（bike），车尾天线上挂一块布条（flag）
  pickup: { build: () => rdcBuildPickup(), wheels: [-22, -104], r: 11, dustX: -128, driver: [-58, -62], glint: [-62, -62], len: 136, bob: [0, 0, -1, -1], roof: -22, spots: [[-82, -83], [-74, -83]] },
  icecream: { build: () => rdcBuildIcecream(), wheels: [-24, -102], r: 11, dustX: -115, driver: [-30, -67], glint: [-34, -70], len: 142, bob: [0, 0, -1, -1], roof: -27,
    bulbs: { x0: -134, x1: -46, y: -84 }, horn: [-50, -94] },
  ebike: { build: () => rdcBuildBike(), wheels: [-12, -52], r: 9, dustX: -62, len: 70, bob: [0, -1, -1, 0], bike: true, rider: true, flag: [-68, -64] },
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

// ---------- 通用小零件 ----------
// 焊上去的带铁丝网小窗
function rdcMeshWin(B, x, y, w, h) {
  const P = RDC_PAL, M = P.metal;
  rdcBox(B, x - 1, y - 1, w + 2, h + 2, [M[1], M[2], M[3]], 2);
  rdcBox(B, x, y, w, h, P.glass, 3, 0.15, 1);
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if ((xx - x) % 4 === 1 || (yy - y) % 4 === 1) rdcPix(B, xx, yy, (yy - y) % 4 === 1 ? M[2] : M[3], 2);
  rdcPix(B, x + 1, y + 1, P.glass[0], 3);
  rdcRivet(B, x - 1, y - 1); rdcRivet(B, x + w - 1, y - 1); rdcRivet(B, x - 1, y + h - 1); rdcRivet(B, x + w - 1, y + h - 1);
}
// 生锈的补丁板（四角铆钉）
function rdcPatchPlate(B, x, y, w, h) {
  const P = RDC_PAL;
  rdcBox(B, x, y, w, h, [P.rust[0], P.rust[1], P.rust[2]], 2); rdcRect(B, x, y, w, 1, P.metal[1], 2);
  rdcRivet(B, x + 1, y + 2); rdcRivet(B, x + w - 3, y + 2); rdcRivet(B, x + 1, y + h - 3); rdcRivet(B, x + w - 3, y + h - 3);
}
// 任意车漆色的面板接缝
function rdcSeamC(B, x, y0, y1, ramp) { for (let y = y0; y <= y1; y++) { const m = rdcMat(B, x, y); if (m === 1 || m === 7) rdcPix(B, x, y, ramp[4], 6); if (rdcMat(B, x + 1, y) === 1) rdcPix(B, x + 1, y, ramp[0], 1); } }
// 轮拱：x0 / x1 是一组轮子最前、最后的轮心（双桥就是一段「跑道形」）；fender 为真时画一圈挡泥瓦，否则挖进车身
function rdcArch(B, x0, x1, WR, ramp, fender) {
  const T = RDC_PAL.tire, D = RDC_PAL.dark;
  for (let y = -WR * 2 - 8; y <= -8; y++) for (let x = x1 - WR - 7; x <= x0 + WR + 7; x++) {
    const dx = x > x0 ? x - x0 : x < x1 ? x - x1 : 0, d = Math.hypot(dx, y + WR), m = rdcMat(B, x, y);
    if (fender) {
      if (d > WR + 2.5 && d <= WR + 5 && y <= -9) rdcPix(B, x, y, d > WR + 4 ? T[0] : T[2], 5);
      else if (d <= WR + 2.5 && m) rdcPix(B, x, y, D[2], 6);
    } else if (d <= WR + 3.5 && m) rdcPix(B, x, y, d > WR + 2 ? D[0] : D[2], 6);
    else if (d <= WR + 5.5 && (m === 1 || m === 7 || m === 2)) rdcPix(B, x, y, d < WR + 4.5 ? ramp[3] : ramp[0], 1);
  }
}

// ---------- 垃圾车：后装压缩式垃圾车（平头驾驶室 + 带加强筋的压缩厢 + 后面能翻起来的尾门），全部原创 ----------
// 车长约 170（≈ 56 世界像素），压缩厢顶 y = -86，驾驶室顶 -70；前轮 x = -20，后面双桥 -112 / -138，轮半径 12
// 末日改装：厢体侧面开了带铁丝网的小窗（住人）、焊补丁、竖排气管加隔热罩、尾部站人踏板和扶手、挂着铁链
function rdcBuildGarbage() {
  const P = RDC_PAL, B = rdcPaper(204, 132, 182, 118);
  const O = P.olive, M = P.metal, D = P.dark, Hz = P.hazard;
  const FX = -20, R1 = -112, R2 = -138, WR = 12;
  // —— 车架大梁
  rdcBox(B, -150, -31, 146, 8, [D[0], D[1], D[2]], 6);
  for (let x = -146; x < -50; x += 11) rdcRect(B, x, -32, 3, 2, D[1], 6);
  // —— 压缩厢：前上角、后上角削圆
  rdcPoly(B, [[-146, -81], [-141, -86], [-57, -86], [-52, -81], [-52, -30], [-146, -30]], O, 1, 0.02, 1);
  rdcBox(B, -142, -87, 86, 3, [M[0], M[1], M[2]], 2);              // 顶部包边
  rdcBox(B, -146, -35, 94, 5, [M[1], M[2], M[3]], 2);              // 底部包边
  for (let x = -143; x < -53; x++) { if (rdcMat(B, x, -84) === 1) rdcPix(B, x, -84, O[0], 1); if ((x & 1) && rdcMat(B, x, -83) === 1) rdcPix(B, x, -83, O[0], 1); }
  // 厢体中间一道褪色的米白腰带（原来的反光带），上面有模糊的字
  rdcBox(B, -145, -62, 92, 6, [P.cream[1], P.cream[2], P.cream[3]], 7, 0, 1);
  for (let k = 0; k < 9; k++) if (rdcHash(k, 4, 2) > 0.3) rdcRect(B, -136 + k * 7, -60, 4 + (k % 2), 2, O[3], 7);
  // 竖向加强筋（压缩厢两侧一根根凸起的钢筋）：左亮、中、右暗
  for (const rx of [-138, -124, -110, -96, -82, -68]) {
    for (let y = -83; y < -35; y++) { rdcPix(B, rx, y, O[0], 1); rdcPix(B, rx + 1, y, O[1], 1); rdcPix(B, rx + 2, y, O[2], 1); rdcPix(B, rx + 3, y, O[4], 6); }
    rdcRivet(B, rx + 1, -81); rdcRivet(B, rx + 1, -40);
  }
  // 腰带下方阴影（抖点）
  for (let x = -145; x < -52; x++) if (rdcMat(B, x, -55) === 1 && (x & 1)) rdcPix(B, x, -55, O[3], 1);
  // 末日改装：住人的小窗、补丁板
  rdcMeshWin(B, -120, -78, 12, 10); rdcMeshWin(B, -78, -78, 10, 10);
  rdcPatchPlate(B, -134, -50, 12, 9); rdcPatchPlate(B, -92, -52, 9, 8);
  // —— 尾门（装垃圾的后斗）：比厢体高一点、往后鼓出来，下半截刷警示斜纹
  rdcPoly(B, [[-147, -91], [-156, -90], [-163, -82], [-168, -62], [-169, -40], [-166, -27], [-147, -27]], [O[1], O[2], O[3], O[4]], 1, 0, 1);
  rdcLine(B, -156, -90, -147, -91, O[0], 1); rdcLine(B, -163, -82, -157, -89, O[0], 1);
  for (let y = -91; y <= -27; y++) { rdcPix(B, -147, y, D[2], 6); rdcPix(B, -146, y, O[0], 1); } // 尾门和厢体之间的缝
  for (let y = -44; y < -28; y++) for (let x = -169; x < -148; x++) if (rdcMat(B, x, y) === 1) rdcPix(B, x, y, (((x + y) % 8) + 8) % 8 < 4 ? Hz[0] : Hz[2], 7);
  rdcRect(B, -168, -45, 20, 1, M[2], 2); rdcRect(B, -167, -28, 19, 1, M[3], 2);
  // 尾门铰链（顶上）+ 举升油缸（从厢体斜拉到尾门）
  rdcBox(B, -150, -95, 6, 5, [M[1], M[2], M[3]], 2); rdcPix(B, -148, -93, M[0], 2);
  rdcLine(B, -142, -80, -158, -56, M[3], 2); rdcLine(B, -141, -80, -157, -56, M[2], 2); rdcLine(B, -140, -80, -156, -56, M[2], 2);
  rdcLine(B, -149, -69, -158, -56, M[0], 2);                           // 镀铬的活塞杆
  rdcBox(B, -143, -82, 4, 4, [M[1], M[3]], 2); rdcBox(B, -160, -58, 4, 4, [M[1], M[3]], 2);
  // 尾灯、后踏板（环卫工站的地方）、扶手
  rdcBox(B, -170, -50, 3, 5, P.tail, 4); rdcPix(B, -169, -49, '#ffc0a0', 4);
  rdcBox(B, -176, -21, 16, 3, [M[0], M[1], M[2]], 2); for (let x = -175; x < -161; x += 3) rdcPix(B, x, -20, M[3], 2);
  rdcRect(B, -174, -18, 2, 6, M[3], 2);
  rdcRect(B, -172, -64, 2, 44, M[1], 2); rdcRect(B, -173, -64, 1, 44, M[0], 2); rdcRect(B, -171, -64, 1, 44, M[3], 2);
  rdcRect(B, -172, -66, 5, 2, M[2], 2); rdcRect(B, -172, -40, 4, 2, M[2], 2);
  // 尾部顶上的警示灯底座（灯罩每帧画）
  rdcBox(B, -157, -96, 8, 3, [M[1], M[2], M[3]], 2);
  // —— 厢体下面：液压油箱、燃油箱、电瓶箱、侧防护栏
  rdcBox(B, -100, -27, 14, 12, [M[1], M[2], M[3]], 2); rdcRect(B, -100, -27, 14, 1, M[0], 2); rdcRect(B, -96, -29, 3, 2, M[3], 2); // 液压油箱
  rdcBox(B, -82, -27, 22, 13, [M[0], M[1], M[2], M[3]], 2); rdcRect(B, -80, -28, 3, 1, M[3], 2); for (const x of [-75, -66]) rdcRect(B, x, -27, 1, 13, M[3], 2); // 燃油箱（绑带）
  rdcBox(B, -56, -27, 10, 9, [D[0], D[1], D[2]], 6); rdcRect(B, -55, -27, 8, 1, M[2], 2);  // 电瓶箱
  for (const y of [-14, -9]) rdcBox(B, -98, y, 52, 2, [M[0], M[1], M[2]], 2);
  // —— 竖排气管（驾驶室和厢体之间）+ 隔热罩 + 防雨帽
  rdcBox(B, -50, -100, 3, 72, [M[1], M[2], M[3]], 2);
  rdcBox(B, -51, -76, 5, 22, [M[0], M[1], M[2]], 2); for (let y = -75; y < -55; y += 3) for (let x = -50; x < -46; x += 2) rdcPix(B, x + ((y / 3) & 1), y, D[1], 6);
  rdcRect(B, -52, -101, 6, 1, M[2], 2); rdcRect(B, -51, -102, 4, 1, M[1], 2);
  rdcRect(B, -50, -100, 3, 1, D[2], 6); // 管口熏黑
  // —— 驾驶室（平头，高大方正）：前脸下半截往前凸
  rdcPoly(B, [[-46, -70], [-7, -70], [-3, -68], [-1, -64], [0, -40], [2, -36], [2, -22], [-46, -22]], O, 1, 0.02, 1);
  rdcRect(B, -45, -70, 37, 1, O[0], 1); for (let x = -45; x < -9; x += 2) rdcPix(B, x, -69, O[0], 1);
  for (let y = -66; y < -38; y++) rdcPix(B, -3 + Math.round((y + 66) * 0.04), y, O[2], 1);
  // 遮阳檐（焊的铁皮）
  rdcBox(B, -12, -74, 14, 3, [M[2], M[3], D[0]], 2); rdcRect(B, -12, -74, 14, 1, M[1], 2);
  // 侧窗 + 窗框
  rdcPoly(B, [[-40, -64], [-9, -64], [-6, -59], [-6, -46], [-40, -46]], P.glass, 3, 0.05, 1);
  rdcRect(B, -41, -65, 33, 1, O[3], 1); rdcRect(B, -41, -45, 36, 1, O[0], 1);
  for (let k = 0; k < 5; k++) rdcLine(B, -30 + k * 3, -63, -34 + k * 3, -56, P.glass[0], 3);
  rdcRect(B, -13, -64, 1, 18, O[3], 1); // 窗框立柱（前面的三角窗）
  // 车门缝、门把手
  rdcSeamC(B, -43, -66, -24, O); rdcSeamC(B, -6, -44, -26, O);
  rdcRect(B, -38, -42, 5, 2, M[2], 2); rdcRect(B, -38, -42, 5, 1, M[0], 2);
  // 车门上原来的标志：涂掉了，只剩一圈印子
  for (let a = 0; a < 6.28; a += 0.3) rdcPix(B, Math.round(-27 + Math.cos(a) * 5), Math.round(-35 + Math.sin(a) * 4), O[3], 1);
  // 长杆后视镜
  rdcLine(B, -6, -56, 3, -60, M[3], 2); rdcLine(B, -6, -57, 3, -61, M[2], 2);
  rdcBox(B, 2, -71, 4, 15, [M[2], M[3], D[1]], 2); rdcRect(B, 3, -69, 2, 10, P.glass[2], 3); rdcPix(B, 3, -69, P.glass[0], 3);
  // 大灯、转向灯、格栅（前脸侧边能看到的几根）
  rdcBox(B, -2, -37, 4, 6, [P.light[0], P.light[1], P.light[2]], 4); rdcPix(B, -1, -36, '#ffffff', 4);
  rdcRect(B, -2, -40, 4, 2, P.light[2], 4);
  for (let y = -30; y < -24; y += 2) rdcRect(B, -3, y, 5, 1, D[1], 6);
  // 车顶警示灯底座
  rdcBox(B, -34, -73, 9, 3, [M[1], M[2], M[3]], 2);
  // 驾驶室后下方的上车踏板（两级）
  for (const y of [-21, -13]) rdcBox(B, -46, y, 10, 2, [M[0], M[2]], 2);
  rdcRect(B, -46, -21, 1, 10, M[3], 2); rdcRect(B, -37, -21, 1, 10, M[3], 2);
  // —— 轮拱 + 挡泥瓦 + 挡泥皮
  rdcArch(B, FX, FX, WR, O, false);
  rdcArch(B, R1, R2, WR, O, true);
  rdcBox(B, R2 - 19, -15, 3, 12, [P.tire[1], P.tire[2], P.tire[3]], 5); rdcBox(B, FX - 17, -19, 2, 8, [P.tire[1], P.tire[2], P.tire[3]], 5);
  // 厚钢板前保险杠（后来焊的，带螺栓）
  rdcBox(B, -6, -27, 12, 8, [M[0], M[1], M[2], M[3]], 2); for (const y of [-25, -21]) rdcRivet(B, 2, y);
  // 车尘、锈斑、泥点（垃圾车更脏）
  rdcWeather(B, 13, 0.05, -44);
  { const w0 = rdcHex(P.cream[0]), o0 = rdcHex(O[0]); for (let i = 0; i < B.c.length; i++) if (B.c[i] === w0 && B.m[i] === 1) B.c[i] = o0; } // 划痕亮点换成浅橄榄色（米白色在绿漆上像雪花）
  // 挂在后扶手上的一圈铁链（锈后画）
  for (let k = 0; k < 7; k++) { const cx = -166 + k * 2, cy = -60 + Math.round(Math.sin(k / 6 * Math.PI) * 6); rdcPix(B, cx, cy, k & 1 ? M[2] : P.rust[1], 2); rdcPix(B, cx, cy + 1, M[3], 2); }
  rdcOutline(B);
  return rdcToCanvas(B);
}
// 警示灯：灯罩 + 转动的亮点 + 一闪一闪的光晕（10 帧/秒，4 帧转一圈）；on 为假时只画暗着的灯罩
function rdcBeacon(g, x, y, fr, on, ph) {
  const P = RDC_PAL.beacon, f = (fr + ph) & 3;
  if (on) {
    const r = f === 0 ? 16 : f === 1 ? 11 : 7, gr = g.createRadialGradient(x, y - 2, 1, x, y - 2, r);
    gr.addColorStop(0, 'rgba(255,190,70,' + (f === 0 ? 0.55 : 0.35) + ')'); gr.addColorStop(1, 'rgba(255,150,40,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - 2 - r, r * 2, r * 2);
  }
  g.fillStyle = RDC_PAL.out; g.fillRect(x - 4, y - 4, 8, 5); g.fillRect(x - 3, y - 5, 6, 1);
  g.fillStyle = on ? P[2] : '#8a5a2a'; g.fillRect(x - 3, y - 4, 6, 4);
  g.fillStyle = on ? P[1] : '#a87038'; g.fillRect(x - 2, y - 4, 4, 2);
  if (on) { const hx = [-3, -1, 1, 2][f]; g.fillStyle = P[0]; g.fillRect(x + hx, y - 4, f === 3 ? 1 : 2, 3); }
  else { g.fillStyle = '#d0a060'; g.fillRect(x - 2, y - 4, 1, 1); }
}
// 竖排气管冒的黑烟：一团团往后上方飘、变大变淡
function rdcStackSmoke(g, x, y, fr, fast) {
  const life = 7;
  for (let age = 0; age < life; age++) {
    const id = fr - age, h = rdcHash(id, 3, 17);
    const px = Math.round(x - 2 - age * (fast ? 7 : 4) - h * 2), py = Math.round(y - 2 - age * (fast ? 2 : 3.2) - h * 2);
    const s = 2 + Math.round(age * 0.7 + h);
    g.globalAlpha = Math.max(0, 0.6 - age / life * 0.55);
    rdcBlob(g, px, py, s, age < 2 ? '#3e352e' : '#5e544a');
    rdcBlob(g, px - 1, py - 1, Math.max(1, s - 2), age < 2 ? '#56493e' : '#7a6e62');
  }
  g.globalAlpha = 1;
}

// ---------- 皮卡：单排座越野皮卡（长车头 + 驾驶室 + 后斗），全部原创 ----------
// 车长约 132（前轮 x = -22，后轮 -104，轮半径 11）；驾驶室顶 -67，后斗围栏 -48
// 末日改装：后斗里焊了两个炮座（武器挂点 1、2 就架在上面）、驾驶室后面防滚架 + 两盏探照灯、
// 车头钢管防撞架、进气管（涉水喉）顺着 A 柱爬上车顶、斗侧焊补丁、斗里绑着油桶
function rdcBuildPickup() {
  const P = RDC_PAL, B = rdcPaper(160, 112, 142, 100);
  const K = P.brick, M = P.metal, D = P.dark;
  const FX = -22, RX = -104, WR = 11;
  // —— 车架大梁
  rdcBox(B, -126, -27, 120, 6, [D[0], D[1], D[2]], 6);
  // —— 后斗里面（先画，后面被斗壁挡住下半截）：炮座、油桶
  for (const px of [-88, -116]) {
    rdcBox(B, px - 2, -58, 5, 30, [M[1], M[2], M[3]], 2);                  // 立柱
    rdcBox(B, px - 6, -59, 13, 3, [M[0], M[1], M[2]], 2); rdcRivet(B, px - 5, -58); rdcRivet(B, px + 4, -58); // 转盘
    rdcLine(B, px - 6, -50, px - 2, -56, M[3], 2); rdcLine(B, px + 7, -50, px + 3, -56, M[3], 2); // 斜撑
  }
  for (const [x, c] of [[-109, ['#c05a3a', '#9a4028', '#6e2c1c']], [-102, ['#7a8050', '#5c6238', '#424626']]]) { // 两个油桶
    rdcBox(B, x, -57, 7, 12, c, 1, 0, 1); rdcRect(B, x + 1, -58, 3, 1, M[2], 2); rdcRect(B, x, -52, 7, 1, c[2], 1);
  }
  // —— 后斗外壁：腰线（一道折痕：上亮下暗）、斗围栏包边 + 绑货孔、尾门
  rdcBox(B, -131, -48, 56, 28, K, 1, 0.05, 1);
  rdcBox(B, -132, -50, 58, 3, [M[0], M[1], M[2]], 2);
  for (let x = -128; x < -78; x += 9) rdcRect(B, x, -49, 3, 1, D[2], 6);
  rdcBox(B, -132, -48, 4, 28, [K[2], K[3], K[4]], 1); rdcRect(B, -131, -40, 2, 3, M[2], 2); // 尾门侧边 + 把手
  // —— 驾驶室：后窗柱、圆角车顶、斜风挡
  rdcPoly(B, [[-76, -20], [-76, -62], [-72, -67], [-47, -67], [-41, -61], [-33, -48], [-33, -20]], K, 1, 0.02, 1);
  rdcRect(B, -73, -67, 25, 1, K[0], 1); for (let x = -73; x < -48; x += 2) rdcPix(B, x, -66, K[0], 1);
  // 侧窗（前面一小块三角窗）+ 反光
  rdcPoly(B, [[-71, -63], [-48, -63], [-42, -57], [-37, -49], [-71, -49]], P.glass, 3, 0.05, 1);
  rdcRect(B, -72, -48, 36, 1, K[0], 1); rdcRect(B, -72, -64, 25, 1, K[3], 1);
  rdcRect(B, -47, -62, 1, 13, K[3], 1);
  for (let k = 0; k < 5; k++) rdcLine(B, -64 + k * 3, -62, -68 + k * 3, -55, P.glass[0], 3);
  // —— 车头：长引擎盖，前脸微微往后斜
  rdcPoly(B, [[-34, -48], [-5, -45], [-1, -43], [0, -32], [-1, -21], [-34, -20]], K, 1, 0.1, 1);
  rdcLine(B, -33, -48, -5, -45, K[0], 1); rdcLine(B, -33, -47, -6, -44, K[0], 1);
  rdcLine(B, -33, -46, -34, -24, K[3], 1); // 引擎盖和驾驶室之间的缝
  // 整车一道腰线折痕（从车头到车尾）
  for (let x = -130; x < -1; x++) { if (rdcMat(B, x, -38) === 1) rdcPix(B, x, -38, K[0], 1); if (rdcMat(B, x, -37) === 1) rdcPix(B, x, -37, K[3], 1); }
  // 车门缝、门把手、后视镜
  rdcSeamC(B, -73, -62, -27, K); rdcSeamC(B, -37, -47, -27, K);
  rdcRect(B, -69, -45, 5, 2, M[2], 2); rdcRect(B, -69, -45, 5, 1, M[0], 2);
  rdcLine(B, -38, -51, -34, -54, M[3], 2); rdcBox(B, -35, -59, 4, 6, [M[2], M[3]], 2); rdcPix(B, -34, -58, P.glass[1], 3);
  // 大灯、转向灯、格栅、保险杠、尾灯
  rdcBox(B, -3, -42, 3, 5, [P.light[0], P.light[1], P.light[2]], 4); rdcPix(B, -2, -41, '#ffffff', 4);
  rdcRect(B, -3, -36, 3, 2, P.light[2], 4);
  for (let y = -33; y < -27; y += 2) rdcRect(B, -2, y, 2, 1, D[1], 6);
  rdcBox(B, -5, -28, 8, 5, [M[1], M[2], M[3]], 2);
  rdcBox(B, -133, -46, 3, 7, P.tail, 4); rdcPix(B, -132, -45, '#ffc0a0', 4);
  rdcBox(B, -134, -27, 10, 4, [M[1], M[2], M[3]], 2); // 后保险杠
  // 侧踏板、排气管
  rdcBox(B, -90, -19, 56, 3, [M[0], M[2], M[3]], 2); for (let x = -88; x < -36; x += 4) rdcPix(B, x, -19, M[3], 2);
  rdcBox(B, -128, -21, 6, 3, [M[2], M[3]], 2); rdcPix(B, -129, -20, D[2], 6);
  // 末日改装：斗侧补丁、门上一块焊的护板
  rdcPatchPlate(B, -124, -45, 13, 8); rdcPatchPlate(B, -66, -36, 10, 8);
  // —— 轮拱（挖进车身，带翼子板外扩）+ 挡泥皮
  rdcArch(B, FX, FX, WR, K, false); rdcArch(B, RX, RX, WR, K, false);
  rdcBox(B, RX - 15, -16, 2, 9, [P.tire[1], P.tire[3]], 5); rdcBox(B, FX - 15, -17, 2, 8, [P.tire[1], P.tire[3]], 5);
  // 车尘、锈、泥点
  rdcWeather(B, 17, 0.02, -40);
  // —— 锈之后画的钢管件（自己带锈点）：防滚架 + 探照灯底座、车头防撞架、涉水喉
  rdcBox(B, -80, -80, 3, 32, [M[0], M[1], M[2]], 2); rdcBox(B, -86, -80, 18, 3, [M[0], M[1], M[2]], 2);
  rdcLine(B, -79, -78, -70, -67, M[2], 2); rdcLine(B, -78, -78, -69, -67, M[3], 2); // 斜撑到车顶
  for (const sx of [-82, -74]) rdcRect(B, sx - 1, -81, 3, 1, M[3], 2);
  rdcBox(B, 2, -48, 3, 26, [M[0], M[1], M[2]], 2); rdcRect(B, -2, -46, 5, 2, M[2], 2); rdcRect(B, -2, -32, 5, 2, M[2], 2);
  rdcLine(B, 3, -47, -2, -41, M[2], 2); rdcLine(B, 3, -33, -2, -39, M[2], 2); // 防撞架的交叉斜杆
  rdcBox(B, -32, -46, 3, 12, [M[1], M[2], M[3]], 2); rdcLine(B, -31, -46, -41, -66, M[2], 2); rdcLine(B, -30, -46, -40, -66, M[3], 2); // 涉水喉
  rdcBox(B, -43, -71, 5, 5, [M[1], M[2], M[3]], 2); rdcRect(B, -39, -70, 2, 3, D[2], 6);
  for (const [x, y, k] of [[3, -44, 1], [4, -36, 2], [-79, -70, 1], [-79, -58, 2], [-84, -79, 1], [-31, -40, 2]]) rdcPix(B, x, y, P.rust[k], 2);
  rdcOutline(B);
  return rdcToCanvas(B);
}
// 防滚架上的探照灯：白天暗着，晚上开车时亮，前面一道光束
function rdcSpot(g, x, y, lit) {
  const P = RDC_PAL;
  g.fillStyle = P.out; g.fillRect(x - 3, y - 3, 7, 6);
  g.fillStyle = P.metal[2]; g.fillRect(x - 2, y - 2, 5, 4); g.fillStyle = P.metal[1]; g.fillRect(x - 2, y - 2, 5, 1);
  g.fillStyle = lit ? P.light[0] : '#c8c0a0'; g.fillRect(x + 2, y - 2, 2, 4);
  if (lit) { const gr = g.createLinearGradient(x + 4, 0, x + 70, 0); gr.addColorStop(0, 'rgba(255,240,190,0.35)'); gr.addColorStop(1, 'rgba(255,240,190,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(x + 4, y - 2); g.lineTo(x + 70, y - 12); g.lineTo(x + 70, y + 14); g.lineTo(x + 4, y + 2); g.fill(); }
}

// ---------- 冰淇淋车：方头步入式厢车（大售货窗 + 卷帘遮阳棚 + 车顶大甜筒 + 喇叭），全部原创 ----------
// 车长约 138（和快递车一样，前轮 -24，后轮 -102，轮半径 11）；厢顶 -80，甜筒顶约 -112
// 末日改装：售货窗一半焊了铁丝网、甜筒裂了用铁皮箍着、车尾窗钉了木板、侧面补丁
function rdcBuildIcecream() {
  const P = RDC_PAL, B = rdcPaper(160, 140, 146, 128);
  const K = P.rose, Mt = P.mint, M = P.metal, D = P.dark, Wf = P.waffle;
  const FX = -24, RX = -102, WR = 11;
  rdcBox(B, -132, -25, 126, 7, [D[0], D[1], D[2]], 6); // 大梁
  // —— 车身：后上角圆、前面是斜风挡 + 短车鼻
  rdcPoly(B, [[-138, -74], [-135, -79], [-131, -81], [-44, -81], [-38, -79], [-16, -58], [-6, -55], [-2, -52], [0, -44], [0, -20], [-138, -20]], K, 1, 0.02, 1);
  rdcRect(B, -130, -81, 85, 1, K[0], 1); for (let x = -130; x < -46; x += 2) rdcPix(B, x, -80, K[0], 1);
  // 顶上一圈「融化的奶油」：米白色的波浪滴落边
  for (let x = -136; x < -40; x++) { const d = 3 + Math.round(Math.abs(Math.sin(x * 0.45)) * 2 + (rdcHash(x, 0, 41) < 0.12 ? 3 : 0)); for (let y = -79; y < -79 + d; y++) if (rdcMat(B, x, y) === 1) rdcPix(B, x, y, y === -79 + d - 1 ? P.cream[2] : P.cream[(y + 79) > 1 ? 1 : 0], 1); }
  // 薄荷绿腰带（波浪上沿）+ 下面一条细线
  for (let x = -137; x < -1; x++) { const top = -40 + Math.round(Math.sin(x * 0.3) * 1.5); for (let y = top; y < -33; y++) if (rdcMat(B, x, y) === 1) rdcPix(B, x, y, rdcRampAt(Mt, (y - top) / 8, x, y), 7); }
  rdcLine(B, -137, -30, -2, -30, Mt[1], 7);
  // —— 风挡 + 侧窗 + 车门
  rdcPoly(B, [[-38, -77], [-18, -58], [-14, -58], [-14, -52], [-38, -52]], P.glass, 3, 0.05, 1);
  rdcRect(B, -39, -51, 26, 1, K[0], 1); rdcRect(B, -26, -73, 1, 21, K[3], 1);
  for (let k = 0; k < 4; k++) rdcLine(B, -36 + k * 3, -72, -39 + k * 3, -66, P.glass[0], 3);
  rdcSeamC(B, -41, -78, -22, K); rdcSeamC(B, -13, -56, -24, K);
  rdcRect(B, -36, -46, 5, 2, M[2], 2); rdcRect(B, -36, -46, 5, 1, M[0], 2);
  // —— 售货窗：深色窗洞（里面能看到冷柜的盖子和一排甜筒）、外翻的窗板、台面、一半焊铁丝网
  rdcBox(B, -110, -70, 40, 22, ['#3a2a26', '#2c201c', '#20160f'], 6, 0, 1);
  rdcBox(B, -108, -56, 36, 5, [M[0], M[1], M[2]], 2);                          // 冷柜不锈钢盖子
  for (let k = 0; k < 6; k++) { const x = -106 + k * 6; rdcPoly(B, [[x, -62], [x + 3, -62], [x + 1.5, -57]], [Wf[1], Wf[2]], 1); rdcBox(B, x - 1, -65, 5, 3, [['#f0b0b0', '#d88888'], ['#c4e4d0', '#88b8a0'], ['#f2e4c0', '#d0c098']][k % 3], 1); } // 架子上的甜筒
  rdcBox(B, -112, -48, 44, 3, [M[0], M[1], M[2]], 2); rdcRect(B, -110, -45, 2, 4, M[3], 2); rdcRect(B, -71, -45, 2, 4, M[3], 2); // 台面 + 支架
  for (let y = -70; y < -48; y++) for (let x = -90; x < -70; x++) if ((x + 90) % 4 === 1 || (y + 70) % 4 === 1) rdcPix(B, x, y, (y + 70) % 4 === 1 ? M[2] : M[3], 2);
  for (const [x, y] of [[-91, -71], [-71, -71], [-91, -49], [-71, -49]]) rdcRivet(B, x, y);
  // 菜单板（褪色的彩色圆点 + 价格横线）
  rdcBox(B, -64, -70, 14, 18, ['#4a3a36', '#3a2c28'], 6); rdcRect(B, -65, -71, 16, 1, M[2], 2);
  for (let k = 0; k < 4; k++) { rdcRect(B, -62, -67 + k * 4, 2, 2, ['#e8a0a0', '#a8d8c0', '#f0d890', '#c0a0d0'][k], 4); rdcRect(B, -58, -66 + k * 4, 6, 1, P.cream[2], 4); }
  // 车尾小窗：钉了木板
  rdcBox(B, -134, -68, 14, 12, ['#3a2a26', '#20160f'], 6);
  for (const [y, dy] of [[-67, 2], [-62, -1]]) rdcLine(B, -135, y, -119, y + dy, P.crate[1], 1);
  for (const [y, dy] of [[-66, 2], [-61, -1]]) rdcLine(B, -135, y, -119, y + dy, P.crate[3], 1);
  // 车鼻：大灯、转向灯、格栅、保险杠；尾灯、后保险杠
  rdcBox(B, -3, -43, 3, 5, [P.light[0], P.light[1], P.light[2]], 4); rdcPix(B, -2, -42, '#ffffff', 4);
  rdcRect(B, -3, -37, 3, 2, P.light[2], 4);
  for (let y = -33; y < -25; y += 2) rdcRect(B, -2, y, 2, 1, D[1], 6);
  rdcBox(B, -6, -24, 9, 6, [M[0], M[1], M[2], M[3]], 2);
  rdcBox(B, -140, -46, 3, 6, P.tail, 4); rdcPix(B, -139, -45, '#ffc0a0', 4);
  rdcBox(B, -141, -22, 12, 4, [M[0], M[1], M[2]], 2);
  // 长杆后视镜
  rdcLine(B, -14, -52, -6, -58, M[3], 2); rdcBox(B, -7, -66, 4, 11, [M[2], M[3]], 2); rdcPix(B, -6, -64, P.glass[1], 3);
  // 补丁
  rdcPatchPlate(B, -128, -48, 11, 8); rdcPatchPlate(B, -58, -44, 9, 7);
  // —— 车顶：大喇叭（放音乐）+ 灯泡支架
  rdcBox(B, -52, -86, 4, 5, [M[1], M[2], M[3]], 2);
  rdcPoly(B, [[-52, -91], [-46, -95], [-44, -95], [-44, -85], [-46, -85], [-52, -89]], [M[0], M[1], M[2], M[3]], 2);
  rdcRect(B, -44, -95, 1, 10, D[2], 6);
  // —— 轮拱 + 挡泥皮
  rdcArch(B, FX, FX, WR, K, false); rdcArch(B, RX, RX, WR, K, false);
  rdcBox(B, RX - 15, -16, 2, 9, [P.tire[1], P.tire[3]], 5); rdcBox(B, FX - 15, -17, 2, 8, [P.tire[1], P.tire[3]], 5);
  rdcWeather(B, 29, -0.03, -40);
  { const w0 = rdcHex(P.cream[0]); for (let i = 0; i < B.c.length; i++) if (B.c[i] === w0 && B.m[i] === 1 && rdcHash(i, 1, 7) < 0.5) B.c[i] = rdcHex(K[0]); }
  // —— 车顶大甜筒（锈后画）：蛋筒（格子纹）+ 两个球（粉 + 薄荷，上面一颗樱桃）；裂了一道，用铁皮箍着
  const cx = -90;
  rdcPoly(B, [[cx - 9, -96], [cx + 9, -96], [cx + 1, -81], [cx - 1, -81]], Wf, 1, 0, 1);
  for (let y = -96; y < -81; y++) for (let x = cx - 9; x <= cx + 9; x++) if (rdcMat(B, x, y) === 1 && (((x + y) % 5 + 5) % 5 === 0 || ((x - y) % 5 + 5) % 5 === 0)) rdcPix(B, x, y, Wf[3], 1);
  const ball = (bx, by, r, ramp) => { for (let y = -r; y <= r; y++) for (let x = -r - 1; x <= r + 1; x++) { const d = Math.hypot(x * 0.9, y); if (d > r) continue; const lit = (-x - y) / (d || 1); rdcPix(B, bx + x, by + y, rdcRampAt(ramp, Math.max(0, Math.min(1, 0.45 - lit * 0.35 + d / r * 0.25)), x, y), 1); } };
  ball(cx, -99, 9, ['#f8d8d4', '#eab4b4', '#cc8c90', '#9a6068']);
  for (let x = cx - 9; x <= cx + 9; x++) { const d = 1 + Math.round(Math.abs(Math.sin(x * 0.8)) * 2); for (let y = -96; y < -96 + d; y++) rdcPix(B, x, y, '#cc8c90', 1); } // 球底下垂的奶油
  ball(cx + 1, -110, 7, ['#d8f0e0', '#a8d4c0', '#78a898', '#4e766a']);
  rdcBox(B, cx, -120, 4, 4, ['#e05050', '#b02a2a', '#7a1a1a'], 4); rdcPix(B, cx + 1, -119, '#ffb0a0', 4); rdcLine(B, cx + 2, -120, cx + 4, -123, '#6a8a3a', 2);
  rdcLine(B, cx - 3, -104, cx + 2, -94, '#7a4e48', 1); rdcLine(B, cx - 2, -104, cx + 3, -94, '#9a6068', 1); // 裂缝
  rdcBox(B, cx - 9, -102, 18, 2, [M[1], M[3]], 2); rdcRivet(B, cx - 7, -102); rdcRivet(B, cx + 6, -102); // 箍着的铁皮
  rdcBox(B, cx - 3, -83, 6, 3, [M[1], M[2]], 2); // 甜筒底座
  rdcOutline(B);
  return rdcToCanvas(B);
}
// 车顶边上一排灯泡：3 帧一轮「跑马灯」；不开时是暗的
function rdcBulbs(g, X, Y, b, fr, on) {
  for (let x = b.x0, k = 0; x <= b.x1; x += 6, k++) {
    const lit = on && (k + fr) % 3 === 0;
    g.fillStyle = RDC_PAL.out; g.fillRect(X + x - 1, Y + b.y - 1, 4, 4);
    g.fillStyle = lit ? '#fff4c0' : on ? '#e0a050' : '#8a6a50'; g.fillRect(X + x, Y + b.y, 2, 2);
    if (lit) { g.globalAlpha = 0.35; g.fillStyle = '#ffd880'; g.fillRect(X + x - 2, Y + b.y - 2, 6, 6); g.globalAlpha = 1; }
  }
}
// 喇叭放音乐：飘出的音符（往后上方飘、变淡）
function rdcHornNotes(g, x, y, fr) {
  for (let k = 0; k < 3; k++) {
    const t = ((fr + k * 4) % 12) / 12, nx = Math.round(x + 4 - t * 14 + Math.sin(t * 9) * 2), ny = Math.round(y - 2 - t * 16);
    g.globalAlpha = 1 - t; g.fillStyle = RDC_PAL.out; g.fillRect(nx - 1, ny + 3, 4, 4); g.fillRect(nx + 2, ny - 2, 2, 6);
    g.fillStyle = ['#f8d8a0', '#c4e4d0', '#f2c0c0'][k]; g.fillRect(nx, ny + 4, 2, 2); g.fillRect(nx + 2, ny - 1, 1, 6); g.fillRect(nx + 2, ny - 1, 3, 1);
  }
  g.globalAlpha = 1;
}

// ---------- 电单车：自己拼装的电动越野车（钢蓝车壳 + 大电池包 + 后货架木箱和折叠太阳能板），全部原创 ----------
// 车长约 70（前轮 x = -12，后轮 -52，轮半径 9）；骑手 1.8 米 ≈ 42 精细像素，和货车比例一致
function rdcLine2(B, x0, y0, x1, y1, c1, c2, mat) { rdcLine(B, x0, y0, x1, y1, c1, mat); rdcLine(B, x0, y0 + 1, x1, y1 + 1, c2, mat); }
function rdcBuildBike() {
  const P = RDC_PAL, B = rdcPaper(92, 72, 80, 64);
  const K = P.bike, M = P.metal, D = P.dark, L = P.leather, W = P.crate;
  const FX = -12, RX = -52, WR = 9;
  // —— 后摇臂（后轮轴 → 车架下方的转轴）+ 后减震（弹簧：金属和锈交替）
  for (let k = 0; k < 3; k++) rdcLine(B, RX, -WR + k - 1, -32, -17 + k, k === 0 ? M[1] : k === 1 ? M[2] : M[3], 2);
  for (let k = 0; k < 13; k++) { const x = -44 + Math.round(k * 4 / 13), y = -15 - k; rdcPix(B, x, y, k & 1 ? M[0] : P.rust[1], 2); rdcPix(B, x + 1, y, M[3], 2); }
  rdcBox(B, -45, -30, 4, 3, [M[1], M[3]], 2);
  // —— 车架主梁（转向头 → 后座下面）
  rdcLine2(B, -21, -36, -27, -21, M[2], M[3], 2); rdcLine2(B, -22, -35, -46, -28, M[2], M[3], 2);
  rdcLine2(B, -40, -28, -66, -31, M[2], M[3], 2); // 后货架的支撑
  // —— 电池包：方盒 + 散热片 + 电量灯 + 黄色闪电贴纸
  rdcBox(B, -44, -25, 22, 11, K, 1, 0.1, 1); rdcRect(B, -44, -25, 22, 1, K[0], 1);
  for (let x = -42; x < -24; x += 3) for (let y = -22; y < -16; y++) rdcPix(B, x, y, K[4], 6);
  rdcRect(B, -42, -24, 3, 1, '#7ad070', 4); rdcPix(B, -38, -24, '#3a6a3a', 4);
  rdcRect(B, -29, -24, 3, 3, '#e0b040', 7); rdcPix(B, -28, -23, D[2], 7);
  rdcRect(B, -44, -14, 22, 1, D[1], 6); for (const x of [-42, -26]) rdcRect(B, x, -13, 2, 3, M[3], 2); // 电池包下的托架
  // 电线：从电池包绕到车头
  for (let k = 0; k < 8; k++) rdcPix(B, -23 + Math.round(k / 3), -26 - k, k & 1 ? D[0] : D[2], 6);
  // —— 油箱位置的车壳（电动车，这里是放控制器的壳）
  rdcPoly(B, [[-40, -30], [-24, -37], [-18, -34], [-22, -26], [-40, -26]], K, 1, 0, 1);
  rdcLine(B, -38, -30, -24, -36, K[0], 1);
  rdcRect(B, -33, -30, 6, 1, K[3], 1); rdcRect(B, -32, -29, 4, 1, K[3], 1); // 壳上的通风口
  // —— 坐垫（皮革，有缝线，破了一个口用胶带缠着）
  rdcPoly(B, [[-56, -29], [-52, -32], [-36, -32], [-34, -30], [-38, -27], [-54, -27]], L, 1, 0, 1);
  for (let x = -52; x < -38; x += 2) rdcPix(B, x, -30, L[2], 1);
  rdcRect(B, -47, -32, 3, 5, '#8a8478', 1); rdcPix(B, -46, -31, '#a8a294', 1);
  // —— 后货架 + 木箱 + 折叠太阳能板 + 挂着的小锅
  rdcBox(B, -71, -33, 19, 2, [M[1], M[3]], 2);
  rdcBox(B, -70, -47, 16, 14, W, 1, 0, 1);
  for (const y of [-43, -38]) rdcRect(B, -70, y, 16, 1, W[3], 1);
  for (const x of [-70, -55]) rdcRect(B, x, -47, 1, 14, W[3], 1);
  for (const [x, y] of [[-69, -46], [-56, -46], [-69, -35], [-56, -35]]) rdcRivet(B, x, y);
  rdcRect(B, -63, -47, 2, 14, '#8a3a2a', 7); rdcRect(B, -63, -47, 1, 14, '#a8503a', 7); // 绑带
  rdcBox(B, -72, -51, 20, 4, [M[1], M[2]], 2);
  for (let x = -71; x < -53; x++) for (let y = -50; y < -48; y++) rdcPix(B, x, y, ((x + 71) % 4 === 0) ? '#6a7aa0' : y === -50 ? '#3e5078' : '#2a3656', 3);
  rdcBox(B, -76, -40, 6, 5, [M[1], M[2], M[3]], 2); rdcRect(B, -77, -40, 8, 1, M[3], 2); rdcLine(B, -76, -41, -73, -45, M[3], 2); // 小锅
  // 天线（布条每帧画）
  rdcLine(B, -66, -51, -68, -64, M[2], 2);
  // —— 前叉：上面粗、下面镀铬
  rdcLine2(B, -19, -38, -15, -24, M[2], M[3], 2); rdcLine2(B, -18, -38, -14, -24, M[1], M[2], 2);
  rdcLine2(B, -15, -24, -12, -10, M[0], M[1], 2);
  // —— 挡泥板（前后）
  for (let a = -2.7; a < -0.45; a += 0.03) for (const rr of [WR + 2, WR + 3]) rdcPix(B, Math.round(FX + Math.cos(a) * rr), Math.round(-WR + Math.sin(a) * rr), rr === WR + 3 ? K[1] : K[3], 1);
  for (let a = -3.0; a < -1.1; a += 0.03) for (const rr of [WR + 2, WR + 3]) rdcPix(B, Math.round(RX + Math.cos(a) * rr), Math.round(-WR + Math.sin(a) * rr), rr === WR + 3 ? K[1] : K[3], 1);
  rdcBox(B, RX - 13, -10, 2, 8, [P.tire[1], P.tire[3]], 5); // 后挡泥皮
  // —— 车头：小风挡（刮花了）、圆大灯、车把、后视镜、号码牌位置焊了块铁皮
  rdcPoly(B, [[-21, -52], [-17, -52], [-14, -41], [-18, -41]], P.glass, 3, 0, 1); rdcLine(B, -19, -50, -17, -43, P.glass[0], 3);
  rdcBox(B, -17, -41, 7, 7, [M[1], M[2], M[3]], 2); rdcBox(B, -14, -40, 4, 5, [P.light[0], P.light[1], P.light[2]], 4); rdcPix(B, -13, -39, '#ffffff', 4);
  rdcLine2(B, -24, -43, -18, -42, M[3], D[1], 2); rdcRect(B, -26, -44, 3, 2, D[1], 6);
  rdcLine(B, -20, -43, -22, -49, M[3], 2); rdcRect(B, -24, -51, 3, 2, M[2], 2); rdcPix(B, -23, -51, P.glass[1], 3);
  rdcPatchPlate(B, -10, -33, 5, 6);
  // 脚踏
  rdcRect(B, -32, -15, 4, 2, M[2], 2); rdcPix(B, -32, -15, M[0], 2);
  rdcWeather(B, 21, -0.02, -30);
  rdcOutline(B);
  return rdcToCanvas(B);
}
// 电单车的轮子：细轮胎 + 8 根转动的辐条；hub 为真时是后轮的轮毂电机（大轮毂）
function rdcBikeWheel(g, cx, cy, r, ph, hub) {
  const P = RDC_PAL, a0 = ph * Math.PI / 16;
  for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
    const d = Math.hypot(x, y), lit = (-x - y) / (d || 1);
    if (d > r + 0.5) continue;
    let c = null;
    if (d > r - 0.5) c = P.out;
    else if (d > r - 2.5) c = rdcRampAt(P.tire, Math.max(0, Math.min(1, 0.4 - lit * 0.35)), x, y);
    else if (d > r - 3.5) c = lit > 0.3 ? P.metal[0] : P.metal[2];
    else if (d <= (hub ? 4.2 : 2.2)) c = d > (hub ? 3.2 : 1.2) ? P.metal[3] : P.metal[1];
    if (c) { g.fillStyle = c; g.fillRect(cx + x, cy + y, 1, 1); }
  }
  g.fillStyle = P.metal[2];
  for (let k = 0; k < 8; k++) { const a = a0 + k * Math.PI / 4, ca = Math.cos(a), sa = Math.sin(a); for (let t = hub ? 4.5 : 2.5; t < r - 3; t += 0.8) g.fillRect(Math.round(cx + ca * t - 0.5), Math.round(cy + sa * t - 0.5), 1, 1); }
  g.fillStyle = P.tire[3];
  for (let k = 0; k < 12; k++) { const a = a0 + k * Math.PI / 6; g.fillRect(Math.round(cx + Math.cos(a) * (r - 1.5) - 0.5), Math.round(cy + Math.sin(a) * (r - 1.5) - 0.5), 1, 1); }
  if (!hub) { g.fillStyle = P.metal[1]; for (let k = 0; k < 6; k++) { const a = -a0 + k * Math.PI / 3; g.fillRect(Math.round(cx + Math.cos(a) * 3.5 - 0.5), Math.round(cy + Math.sin(a) * 3.5 - 0.5), 1, 1); } } // 刹车盘
  else { g.fillStyle = '#7ad070'; g.fillRect(cx - 1, cy - 1, 1, 1); }
}
// 骑手（精细像素，每帧画）：前倾握把、围巾和长发往后飘（4 帧一轮）、胳膊 2 帧一换；停车时一只脚撑地
// X, Y：车头 / 地面（精细像素）
function rdcRider(g, X, Y, fr, moving, fast) {
  const AL = avLook(), skin = AV_SKIN[AL.skin], hair = AL.hc, top = AL.tc, pants = AL.bc, scarf = avHas(AL, 'scarf') || '#a8604c';
  const longHair = ['long', 'bob', 'braid', 'twintail', 'ponytail'].includes(AL.hair);
  const f4 = fr & 3, arm = moving && (fr >> 1) & 1 ? 1 : 0, lean = moving ? (fast ? 2 : 1) : 0;
  const Hp = [-41, -31], Sh = [-32 + lean, -49 + lean], Hd = [-23, -42], El = [-28 + lean, -43 + arm];
  const hx = Sh[0] - 3, hy = Sh[1] - 12; // 头的左上角
  const Kn = moving ? [-29, -27] : [-30, -24], Ft = moving ? [-31, -16] : [-27, -1];
  const shirtD = rdShade(top, -0.3), pantsD = rdShade(pants, -0.3), skinD = rdShade(skin, -0.25);
  const limb = (a, b, w, c) => { const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); for (let i = 0; i <= n; i++) { const t = n ? i / n : 0; g.fillStyle = c; g.fillRect(Math.round(X + a[0] + (b[0] - a[0]) * t - w / 2), Math.round(Y + a[1] + (b[1] - a[1]) * t - w / 2), w, w); } };
  const box = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(X + x, Y + y, w, h); };
  // 飘动的东西：围巾 3 段、长发
  const wave = [0, -1, 0, 1], tail = fast ? 12 : moving ? 9 : 4;
  const flutter = (sx, sy, len, w, c, ph) => { for (let i = 0; i < len; i++) box(sx - i, sy + (moving ? wave[(f4 + ph + (i >> 2)) & 3] : Math.floor(i / 3)), 1, w, c); };
  // 第一遍：深褐描边（每个部件放大 1 像素）
  const O = RDC_PAL.out;
  limb(Hp, Kn, 7, O); limb(Kn, Ft, 6, O); limb(Hp, Sh, 8, O); limb(Sh, El, 5, O); limb(El, Hd, 5, O);
  box(hx - 1, hy - 2, 9, 12, O); box(hx + 7, hy + 3, 2, 3, O); box(Sh[0] - 10, Sh[1] - 1, 7, 11, O);
  flutter(Sh[0] - 5, Sh[1] - 2, tail, 4, O, 0); if (longHair) flutter(Sh[0] - 5, Sh[1] - 9, tail - 2, 4, O, 1);
  // 第二遍：上色
  flutter(Sh[0] - 5, Sh[1] - 1, tail, 2, scarf, 0); flutter(Sh[0] - 5, Sh[1], tail - 1, 1, rdShade(scarf, -0.3), 0);
  if (longHair) flutter(Sh[0] - 5, Sh[1] - 8, tail - 2, 2, hair, 1);
  box(Sh[0] - 9, Sh[1], 5, 9, '#6e4a2e'); box(Sh[0] - 9, Sh[1], 5, 1, '#8f6a42'); box(Sh[0] - 9, Sh[1] + 4, 5, 1, '#4a3020'); // 背包
  limb(Hp, Kn, 5, pants); limb([Hp[0], Hp[1] + 1], [Kn[0], Kn[1] + 1], 3, pantsD);
  limb(Kn, Ft, 4, pants); box(Ft[0] - 2, Ft[1] - 2, 6, 3, '#2a2018'); box(Ft[0] - 2, Ft[1] - 2, 6, 1, '#4a3a2e'); // 靴子
  limb(Hp, Sh, 6, top); limb([Hp[0] + 1, Hp[1] - 1], [Sh[0] + 2, Sh[1] + 1], 2, shirtD);
  box(Sh[0] - 1, Sh[1] - 1, 4, 2, scarf); // 脖子上的围巾
  limb(Sh, El, 3, top); limb(El, Hd, 3, top); box(Hd[0] - 1, Hd[1] - 1, 3, 3, skin); box(Hd[0] - 1, Hd[1] + 1, 3, 1, skinD);
  // 头：脸、头发、护目镜
  box(hx, hy, 7, 9, skin); box(hx, hy + 8, 7, 1, skinD); box(hx + 7, hy + 4, 1, 1, skin); box(hx + 5, hy + 7, 2, 1, skinD); // 脸、鼻子、嘴
  box(hx, hy - 1, 6, 3, hair); box(hx, hy, 2, 6, hair); box(hx + 2, hy + 2, 1, 1, hair); // 头发（后脑勺在左）
  box(hx, hy + 3, 4, 1, '#2a2018'); box(hx + 4, hy + 2, 3, 3, '#2a2018'); box(hx + 5, hy + 3, 2, 1, '#e0a040'); box(hx + 5, hy + 2, 1, 1, '#fff0c0'); // 推到眼前的护目镜
}
// 天线上的布条：4 帧飘一轮，停车时垂下来
function rdcFlag(g, x, y, fr, moving) {
  const w = [0, -1, -1, 0], f = fr & 3;
  for (let i = 0; i < 9; i++) {
    const dy = moving ? w[(f + (i >> 1)) & 3] : Math.floor(i * 0.9);
    const dx = moving ? -i : -Math.floor(i / 3);
    g.fillStyle = RDC_PAL.out; g.fillRect(x + dx, y + dy - 1, 1, 5);
    g.fillStyle = i < 3 ? '#b85a3a' : i < 6 ? '#9a4630' : '#7a3424'; g.fillRect(x + dx, y + dy, 1, 3);
  }
}

// ---------- 露营地：帆布帐篷（缓存）+ 篝火（每帧画）----------
// 帐篷正面（A 字形）：H 是帐篷高（精细像素）；补丁、缝线、卷起来的门帘、门里的睡袋、拉绳和地钉
function rdcBuildTent(H) {
  const P = RDC_PAL, C = P.canvas, Wd = Math.round(H * 1.7), half = Wd >> 1;
  const B = rdcPaper(Wd + 40, H + 16, half + 20, H + 10);
  // 拉绳（从顶点到两边地钉）+ 地钉
  rdcLine(B, 0, -H + 2, -half - 16, 0, '#a08860', 2); rdcLine(B, 0, -H + 2, half + 16, 0, '#a08860', 2);
  for (const sx of [-1, 1]) { rdcRect(B, sx * (half + 16) - 1, -2, 2, 3, P.metal[2], 2); }
  // 两片帆布：左边亮（受光）、右边暗
  rdcPoly(B, [[0, -H], [-half, 0], [0, 0]], C, 1, 0, 0.7);
  rdcPoly(B, [[0, -H], [half, 0], [0, 0]], [C[1], C[2], C[3], C[4]], 1, 0.1, 1);
  // 横向缝线、补丁
  for (const k of [0.35, 0.65]) { const y = Math.round(-H * k); for (let x = -half; x <= half; x++) if (rdcMat(B, x, y) === 1 && (x & 1)) rdcPix(B, x, y, C[3], 1); }
  rdcBox(B, -Math.round(half * 0.7), -Math.round(H * 0.3), Math.round(half * 0.3), Math.round(H * 0.2), ['#8a9060', '#6e7448', '#525836'], 1);
  rdcBox(B, Math.round(half * 0.35), -Math.round(H * 0.55), Math.round(half * 0.25), Math.round(H * 0.15), ['#a86a4a', '#8a5038'], 1);
  // 门：深色三角洞 + 卷起来的门帘 + 里面露出的睡袋
  const dh = Math.round(H * 0.62), dw = Math.round(half * 0.5);
  rdcPoly(B, [[0, -dh], [-dw, 0], [dw, 0]], ['#3a2a1e', '#2a1e16', '#1e1610'], 6, 0, 1);
  rdcBox(B, -dw + 2, -4, dw * 2 - 4, 4, ['#8a3a2a', '#6a2a1e'], 1);
  rdcPoly(B, [[0, -dh], [-dw - 3, -Math.round(dh * 0.35)], [-dw + 1, -Math.round(dh * 0.3)]], [C[0], C[1]], 1);
  rdcRect(B, -dw - 3, -Math.round(dh * 0.35), 3, 2, '#6a4a2a', 2);
  // 顶上伸出的帐篷杆、地布边
  rdcRect(B, -1, -H - 3, 2, 4, P.metal[2], 2); rdcPix(B, -1, -H - 3, P.metal[0], 2);
  rdcRect(B, -half - 2, 0, Wd + 4, 1, '#5a4a36', 6);
  rdcWeather(B, 31, -0.15, -20);
  rdcOutline(B);
  return rdcToCanvas(B);
}
// 帐篷：x = 帐篷中心，y = 地面（精细像素）；night 时门里透出灯光
function rdcTent(g, x, y, H, night) {
  const key = 'tent' + H;
  if (!RDC_CACHE[key]) RDC_CACHE[key] = rdcBuildTent(H);
  const t = RDC_CACHE[key];
  if (night) { const gr = g.createRadialGradient(x, y - 8, 2, x, y - 8, H * 0.6); gr.addColorStop(0, 'rgba(255,200,110,0.35)'); gr.addColorStop(1, 'rgba(255,200,110,0)'); g.fillStyle = gr; g.fillRect(x - H, y - H, H * 2, H); }
  g.drawImage(t.cv, x - t.ox, y - t.oy);
  if (night) { g.globalAlpha = 0.55; g.fillStyle = '#ffc870'; g.fillRect(x - 3, y - Math.round(H * 0.4), 6, Math.round(H * 0.4) - 4); g.globalAlpha = 1; }
}
// 篝火：石头圈 + 交叉的柴 + 火焰（4 帧一轮，从里到外 白→黄→橙→红）+ 往上飘的火星和烟 + 三脚架吊锅
// x = 火堆中心，y = 地面（精细像素），s = 大小（1 普通）
function rdcCampfire(g, x, y, fr, night, s) {
  const F = RDC_PAL.fire, f = fr & 3, box = (dx, dy, w, h, c) => { g.fillStyle = c; g.fillRect(x + dx, y + dy, w, h); };
  s = s || 1;
  // 地上的光
  const gr = g.createRadialGradient(x, y - 6, 2, x, y - 6, (night ? 60 : 26) * s);
  gr.addColorStop(0, night ? 'rgba(255,170,70,0.45)' : 'rgba(255,170,70,0.18)'); gr.addColorStop(1, 'rgba(255,140,50,0)');
  g.fillStyle = gr; g.fillRect(x - 60 * s, y - 66 * s, 120 * s, 72 * s);
  // 烟（往上、往左飘）
  for (let a = 0; a < 5; a++) { const id = fr - a * 2, h = rdcHash(id, 1, 23); g.globalAlpha = 0.35 - a * 0.06; rdcBlob(g, Math.round(x - a * 3 - h * 2), Math.round(y - 22 * s - a * 6), 2 + (a >> 1), '#7a6e62'); }
  g.globalAlpha = 1;
  // 三脚架 + 吊锅
  const TH = Math.round(36 * s), py = -Math.round(29 * s), sl = 13 * s / TH;
  g.fillStyle = RDC_PAL.out; for (let k = 0; k < TH; k++) { g.fillRect(Math.round(x - 13 * s + k * sl) - 1, Math.round(y - k), 3, 1); g.fillRect(Math.round(x + 13 * s - k * sl) - 1, Math.round(y - k), 3, 1); }
  g.fillStyle = '#6a5040'; for (let k = 0; k < TH; k++) { g.fillRect(Math.round(x - 13 * s + k * sl), Math.round(y - k), 1, 1); g.fillRect(Math.round(x + 13 * s - k * sl), Math.round(y - k), 1, 1); }
  box(0, -TH, 1, TH + py, RDC_PAL.metal[3]); // 吊锅的链子
  box(-5, py, 11, 7, RDC_PAL.out); box(-4, py + 1, 9, 5, RDC_PAL.metal[3]); box(-4, py + 1, 9, 1, RDC_PAL.metal[1]); box(-6, py + 1, 1, 2, RDC_PAL.out); box(6, py + 1, 1, 2, RDC_PAL.out);
  if ((fr >> 1) & 1) box(-2 + ((fr >> 2) & 1) * 3, py - 2 - (fr & 1), 1, 1, '#d8d0c0'); // 锅里冒的热气
  // 柴（交叉）
  for (let k = 0; k < 14; k++) { box(-7 + k, -2 - (k >> 2), 2, 2, k & 2 ? '#5a3a22' : '#6e4a2e'); box(7 - k, -2 - (k >> 2), 2, 2, k & 2 ? '#4a2e1a' : '#5a3a22'); }
  // 火焰：外红 → 橙 → 黄 → 白芯，高度每帧变
  const hs = [[17, 13, 8, 4], [20, 15, 10, 5], [15, 11, 7, 3], [18, 14, 9, 4]][f].map((h) => Math.round(h * s));
  const ws = [6, 5, 3, 1], sway = [0, 1, 0, -1][f];
  for (let L = 0; L < 4; L++) for (let r = 0; r < hs[L]; r++) { const w = Math.max(1, Math.round(ws[L] * (1 - r / (hs[L] + 2)))); box(-w + (r > hs[L] / 2 ? sway : 0), -3 - r, w * 2, 1, F[3 - L]); }
  // 火星：往上飘、闪
  for (let k = 0; k < 4; k++) { const id = fr + k * 5, t = (id % 10) / 10, h = rdcHash(Math.floor(id / 10), k, 29); if (t < 0.85) box(Math.round((h - 0.5) * 12 + Math.sin(t * 6) * 2), -6 - Math.round(t * 26 * s), 1, 1, t < 0.4 ? F[1] : F[2]); }
  // 石头圈
  for (let k = 0; k < 7; k++) { const sx = -12 + k * 4; box(sx - 1, -3, 5, 4, RDC_PAL.out); box(sx, -2, 3, 3, k & 1 ? '#8a8070' : '#a09888'); box(sx, -2, 3, 1, '#c0b8a8'); }
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
function rdcHasCar(veh) { return !!RDC_CARS[veh]; }
function rdcCarRoof(veh) { const cf = RDC_CARS[veh]; return cf && cf.roof; }
function rdcDrawCar(g, x, y, o) {
  const R = G.road, Q = RD_Q;
  const key = R.veh, cf = RDC_CARS[key];
  if (!RDC_CACHE[key]) RDC_CACHE[key] = cf.build();
  const car = RDC_CACHE[key];
  // 10 帧/秒的动画帧
  const fr = Math.floor(G.time * 10);
  if (fr !== RDC_ANIM.fr) { if (o.moving) RDC_ANIM.ph++; RDC_ANIM.fr = fr; }
  const bob = o.moving ? cf.bob[fr % cf.bob.length] : 0; // 快递车每 2 帧颠 1 像素；垃圾车重，8 帧慢慢颠 2 像素
  const X = Math.round(x * Q), Y = Math.round(y * Q);
  const baseA = g.globalAlpha;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  // 地面：车身抬高（悬挂）或悬浮时，轮子、阴影、尘土还在地上（GY），车身在 Y
  const GY = o.gy != null ? Math.round(o.gy * Q) : Y, lift = GY - Y;
  // 阴影：车底一条暗影，两头淡（悬浮时更淡）
  g.globalAlpha = baseA * (o.hover ? 0.2 : 0.35); g.fillStyle = '#2a1a10';
  g.fillRect(X - cf.len + 2, GY - 1, cf.len - 6, 3); g.fillRect(X - cf.len - 4, GY, cf.len + 6, 2);
  g.globalAlpha = baseA;
  // 反重力漂浮 / 履带 / 轮子（不跟车身颠）；抬高的悬挂露出减震（js/roadmods.js）
  if (o.hover) rdmHover(g, X, Y + bob, GY, cf, o.chs, fr);
  else if (o.wheels) {
    if (lift > 0 && o.chs) rdmSuspension(g, X, GY, cf, o.chs, lift, fr);
    if (o.tire === 'tire8') rdmTrack(g, X, GY, cf, RDC_ANIM.ph, key);
    else cf.wheels.forEach((wx, i) => o.tire ? rdmWheel(g, X + wx, GY - cf.r, cf.r, RDC_ANIM.ph, o.tire, cf.bike, i > 0) : cf.bike ? rdcBikeWheel(g, X + wx, GY - cf.r, cf.r, RDC_ANIM.ph, i > 0) : rdcDrawWheel(g, X + wx, GY - cf.r, cf.r, RDC_ANIM.ph));
  }
  // 电单车停车时放下侧撑
  if (cf.bike && !o.moving && !o.hover) { g.fillStyle = RDC_PAL.out; for (let k = 0; k < 14; k++) g.fillRect(X - 37 - Math.round(k * 0.35), Y - 14 + k, 3, 1); g.fillStyle = RDC_PAL.metal[2]; for (let k = 0; k < 13; k++) g.fillRect(X - 36 - Math.round(k * 0.35), Y - 14 + k, 1, 1); }
  // 车身 + 外装甲 + 前撞角
  g.drawImage(car.cv, X - car.ox, Y - car.oy + bob);
  if (o.armor) rdmArmor(g, X, Y + bob, key, o.armor, fr);
  if (o.ram) rdmRam(g, X, Y + bob, key, o.ram, fr);
  if (o.hit) { g.globalAlpha = baseA * 0.55; g.drawImage(car.white, X - car.ox, Y - car.oy + bob); g.globalAlpha = baseA; }
  // 冰淇淋车：车顶跑马灯（开车或晚上亮）、喇叭飘音符（开车时）
  if (cf.bulbs) rdcBulbs(g, X, Y + bob, cf.bulbs, fr, R.driving || rdDaylight() < 0.5);
  if (cf.horn && o.moving && o.dust) rdcHornNotes(g, X + cf.horn[0], Y + cf.horn[1] + bob, fr);
  // 皮卡：防滚架上的探照灯（晚上开车时亮）
  if (cf.spots) for (const s of cf.spots) rdcSpot(g, X + s[0], Y + s[1] + bob, R.driving && rdDaylight() < 0.5);
  // 电单车：骑手、布条
  if (cf.rider && o.driver) rdcRider(g, X, Y + bob, fr, o.moving, o.fast);
  if (cf.flag) rdcFlag(g, X + cf.flag[0], Y + cf.flag[1] + bob, fr, o.moving);
  // 司机：侧窗里的头（用玩家设置的发色肤色）
  if (o.driver && cf.driver) {
    const AL = avLook(), hx = X + cf.driver[0], hy = Y + cf.driver[1] + bob;
    g.fillStyle = RDC_PAL.out; g.fillRect(hx - 1, hy - 1, 9, 13);
    g.fillStyle = AV_SKIN[AL.skin]; g.fillRect(hx, hy + 3, 7, 7);
    g.fillStyle = rdShade(AV_SKIN[AL.skin], -0.25); g.fillRect(hx, hy + 8, 7, 2); g.fillRect(hx + 6, hy + 3, 1, 5);
    g.fillStyle = AL.hc; g.fillRect(hx, hy, 7, 4); g.fillRect(hx, hy + 4, 2, 3);
    g.fillStyle = RDC_PAL.out; g.fillRect(hx + 5, hy + 5, 1, 1);
    g.fillStyle = RDC_PAL.metal[3]; g.fillRect(hx - 1, hy + 11, 9, 2); // 座椅肩部
    // 玻璃反光盖在头上（半透明）
    g.fillStyle = RDC_PAL.glass[0]; g.globalAlpha = baseA * 0.55;
    for (let k = 0; k < 5; k++) { const lx = X + cf.glint[0] + k * 3; for (let t = 0; t < 6; t++) { const px = lx - Math.round(t * 4 / 6), py = Y + cf.glint[1] + bob + t; if (px >= hx - 1 && px <= hx + 7 && py >= hy - 1 && py <= hy + 12) g.fillRect(px, py, 1, 1); } }
    g.globalAlpha = baseA;
  }
  // 警示灯（开车时转、停车时暗着）、竖排气管冒烟
  if (cf.beacons) cf.beacons.forEach((b, i) => rdcBeacon(g, X + b[0], Y + b[1] + bob, fr, o.moving || R.driving, i * 2));
  if (cf.stack && o.moving && o.dust) rdcStackSmoke(g, X + cf.stack[0], Y + cf.stack[1] + bob, fr, o.fast);
  // 尘土
  if (o.moving && o.dust) rdcDust(g, X + cf.dustX, GY, fr, o.ground || '#c99464', o.fast || cf.heavy);
  g.restore();
  return bob;
}
